import os
import sys
import subprocess
from pathlib import Path
from typing import Dict, Any
from app.config import BACKEND_DIR, OUTPUT_DIR

class PyMOLService:
    def __init__(self):
        self.script_path = BACKEND_DIR / "scripts" / "render_mutant.py"
        
        # Use virtual environment python executable if available, fallback to sys.executable
        venv_python = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
        if not venv_python.exists():
            # Unix-like path fallback just in case
            venv_python = BACKEND_DIR / ".venv" / "bin" / "python"
            
        self.python_exe = str(venv_python) if venv_python.exists() else sys.executable

    def mutate_and_render(
        self,
        structure_path: str,
        residue: str,
        target_aa: str,
        chain: str = "A"
    ) -> Dict[str, Any]:
        """
        Executes render_mutant.py in silico mutagenesis and collects visual assets and metrics.
        """
        # Create a unique output subdirectory for this mutagenesis run
        output_sub = OUTPUT_DIR / f"{Path(structure_path).stem}_mut_{residue}_{target_aa}"
        output_sub.mkdir(parents=True, exist_ok=True)
        
        cmd_args = [
            self.python_exe,
            str(self.script_path),
            "--structure", structure_path,
            "--residue", residue,
            "--chain", chain,
            "--target_aa", target_aa,
            "--output_dir", str(output_sub)
        ]
        
        # Set environment variable for headless rendering (OSMesa)
        env = os.environ.copy()
        env["PYOPENGL_PLATFORM"] = "osmesa"
        
        try:
            result = subprocess.run(
                cmd_args,
                capture_output=True,
                text=True,
                check=True,
                env=env
            )
            stdout = result.stdout
            
            # Parse metrics from stdout
            metrics = {
                "original_aa": "",
                "target_aa": target_aa,
                "wildtype_contacts": 0,
                "mutant_contacts": 0,
                "success": True
            }
            
            if "METRICS_START" in stdout:
                start_part = stdout.split("METRICS_START")[1]
                metrics_section = start_part.split("METRICS_END")[0].strip()
                
                for line in metrics_section.split("\n"):
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip()
                        if k == "original_aa":
                            metrics["original_aa"] = v
                        elif k == "target_aa":
                            metrics["target_aa"] = v
                        elif k == "wildtype_contacts":
                            metrics["wildtype_contacts"] = int(v)
                        elif k == "mutant_contacts":
                            metrics["mutant_contacts"] = int(v)

            # Generate URLs/relative filepaths for serving via backend
            rel_path_base = f"output/{output_sub.name}"

            # Build rotation view relative paths
            rotation_views = [
                f"{rel_path_base}/mut_view_0.png",
                f"{rel_path_base}/mut_view_90.png",
                f"{rel_path_base}/mut_view_180.png",
            ]
            # Only include views that were actually created
            rotation_views_existing = [
                rv for rv in rotation_views
                if (BACKEND_DIR / rv).exists()
            ]

            return {
                "success": True,
                "metrics": metrics,
                "files": {
                    "wt_pocket":      f"{rel_path_base}/wt_pocket.png",
                    "mut_pocket":     f"{rel_path_base}/mut_pocket.png",
                    "mutant_full":    f"{rel_path_base}/mutant_full.png",
                    "session_file":   f"{rel_path_base}/mutant_session.pse",
                    "structure_file": f"{rel_path_base}/mutant_structure.pdb",
                    "rotation_views": rotation_views_existing,
                },
                "log": stdout
            }
            
        except subprocess.CalledProcessError as e:
            return {
                "success": False,
                "error": e.stderr or str(e),
                "log": e.stdout
            }

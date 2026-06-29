import os
import sys
import json
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.config import DATA_DIR

class ScienceService:
    def __init__(self):
        # Locate the plugin directory on Naresh's home path
        self.plugin_base = Path("C:/Users/Naresh/.gemini/config/plugins/science/skills")
        
    def _run_skill_script(self, skill_name: str, script_rel_path: str, args: List[str]) -> Dict[str, Any]:
        """
        Runs a skill script using the host python environment (via uv run) and returns parsed output.
        """
        script_path = self.plugin_base / skill_name / script_rel_path
        if not script_path.exists():
            raise FileNotFoundError(f"Skill script not found at {script_path}")

        cmd = ["uv", "--no-cache", "run", str(script_path)] + args
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            # Some scripts print json or log status to stdout.
            # We return stdout if any, or a success status
            return {
                "success": True,
                "stdout": result.stdout,
                "stderr": result.stderr
            }
        except subprocess.CalledProcessError as e:
            return {
                "success": False,
                "stdout": e.stdout,
                "stderr": e.stderr,
                "error": str(e)
            }

    def fetch_uniprot_info(self, accession: str) -> Dict[str, Any]:
        """
        Retrieves metadata and sequence for a UniProt accession.
        """
        args = ["get", accession]
        res = self._run_skill_script("uniprot_database", "scripts/uniprot_tools.py", args)
        if not res["success"]:
            raise RuntimeError(f"UniProt fetch failed: {res['stderr']}")
        
        try:
            # Parse output which is expected to be a JSON string of the entry
            return json.loads(res["stdout"])
        except Exception:
            # Fallback if the output contains text logs or other formatting
            # Let's inspect if there are JSON objects inside stdout
            stdout = res["stdout"]
            # Look for JSON brackets
            start_idx = stdout.find("{")
            end_idx = stdout.rfind("}")
            if start_idx != -1 and end_idx != -1:
                return json.loads(stdout[start_idx:end_idx+1])
            return {"raw_output": stdout}

    def search_uniprot(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Searches UniProt entries for a given query string.
        """
        args = ["search", query, "--limit", str(limit)]
        res = self._run_skill_script("uniprot_database", "scripts/uniprot_tools.py", args)
        if not res["success"]:
            return []
        try:
            # Parse array of search results
            stdout = res["stdout"]
            start_idx = stdout.find("[")
            end_idx = stdout.rfind("]")
            if start_idx != -1 and end_idx != -1:
                return json.loads(stdout[start_idx:end_idx+1])
            return [{"raw": stdout}]
        except Exception:
            return [{"raw": res["stdout"]}]

    def download_structure(self, accession: str) -> str:
        """
        Downloads AlphaFold mmCIF model for a UniProt Accession.
        Returns the local path of the downloaded mmCIF file.
        """
        # We output to the local DATA_DIR
        out_dir = DATA_DIR / accession
        out_dir.mkdir(parents=True, exist_ok=True)
        
        # Check if file already exists in DATA_DIR
        existing_cifs = list(out_dir.glob("*.cif")) + list(out_dir.glob("*.pdb"))
        if existing_cifs:
            return str(existing_cifs[0])

        # Fetch structure using the AlphaFold database skill fetch script
        # Command format: fetch_structure.py <accession> -o <output_dir>
        args = [accession, "-o", str(out_dir)]
        res = self._run_skill_script("alphafold_database_fetch_and_analyze", "scripts/fetch_structure.py", args)
        if not res["success"]:
            # Fallback: check if we can search/download via PDB database
            # Try pdb download: download_coordinate_files.py <pdb_id> -o <output_dir>
            # Let's search PDB first
            pdb_args = ["--search", accession, "--output", str(out_dir / "pdb_search.json")]
            self._run_skill_script("pdb_database", "scripts/search_pdb.py", pdb_args)
            
            try:
                with open(out_dir / "pdb_search.json", "r") as f:
                    pdb_results = json.load(f)
                if pdb_results and len(pdb_results) > 0:
                    pdb_id = pdb_results[0].get("rcsb_id")
                    if pdb_id:
                        dl_args = [pdb_id, "-o", str(out_dir)]
                        self._run_skill_script("pdb_database", "scripts/download_coordinate_files.py", dl_args)
            except Exception:
                pass
                
        # Look for downloaded .cif or .pdb files
        cifs = list(out_dir.glob("*.cif")) + list(out_dir.glob("*.pdb"))
        if not cifs:
            raise FileNotFoundError(f"Could not find or download structure file for {accession} in {out_dir}")
        return str(cifs[0])

    def query_chembl_ligands(self, uniprot_accession: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Retrieves active compounds matching the target UniProt protein from ChEMBL.
        """
        out_file = DATA_DIR / f"chembl_target_{uniprot_accession}.json"
        
        # 1. Find ChEMBL target from UniProt
        target_args = ["target", "--filter", f"target_components__accession={uniprot_accession}", "--output", str(out_file), "--limit", "1"]
        res = self._run_skill_script("chembl_database", "scripts/chembl_api.py", target_args)
        
        target_chembl_id = None
        if res["success"] and out_file.exists():
            try:
                with open(out_file, "r") as f:
                    target_data = json.load(f)
                targets = target_data.get("targets", [])
                if targets:
                    target_chembl_id = targets[0].get("target_chembl_id")
            except Exception:
                pass
                
        if not target_chembl_id:
            return []

        # 2. Query activities (IC50) for this target
        activities_file = DATA_DIR / f"chembl_activities_{uniprot_accession}.json"
        activity_args = [
            "activity", 
            "--filter", f"target_chembl_id={target_chembl_id}", "standard_type=IC50", 
            "--normalize", 
            "--limit", str(limit), 
            "--output", str(activities_file)
        ]
        res = self._run_skill_script("chembl_database", "scripts/chembl_api.py", activity_args)
        
        if res["success"] and activities_file.exists():
            try:
                with open(activities_file, "r") as f:
                    act_data = json.load(f)
                return act_data.get("activities", [])
            except Exception:
                return []
        return []

    def get_pubchem_compound(self, name: str) -> Dict[str, Any]:
        """
        Resolves a ligand name to chemical properties using PubChem.
        """
        res_file = DATA_DIR / f"pubchem_{name}.json"
        args = ["resolve", "--name", name, "--output", str(res_file)]
        res = self._run_skill_script("pubchem_database", "scripts/pubchem_api.py", args)
        
        if res["success"] and res_file.exists():
            try:
                with open(res_file, "r") as f:
                    mol_data = json.load(f)
                cid = mol_data.get("CID")
                if cid:
                    # Fetch detailed properties
                    prop_file = DATA_DIR / f"pubchem_props_{cid}.json"
                    prop_args = ["properties", "--cid", str(cid), "--output", str(prop_file)]
                    self._run_skill_script("pubchem_database", "scripts/pubchem_api.py", prop_args)
                    
                    if prop_file.exists():
                        with open(prop_file, "r") as pf:
                            props = json.load(pf)
                        mol_data["properties"] = props
                return mol_data
            except Exception as e:
                return {"error": str(e), "raw": res["stdout"]}
        return {"error": "Compound resolution failed"}

    def query_gtex_expression(self, gene_symbol: str) -> List[Dict[str, Any]]:
        """
        Fetch GTEx tissue expression median values (TPM) for a gene symbol.
        """
        try:
            # 1. Resolve GENCODE ID
            resolve_file = DATA_DIR / f"gtex_resolve_{gene_symbol}.json"
            res = self._run_skill_script("gtex_database", "scripts/gtex_cli.py", ["resolve-gencode-id", gene_symbol, "--output", str(resolve_file)])
            
            if not res["success"] or not resolve_file.exists():
                return []
                
            with open(resolve_file, "r") as f:
                resolve_data = json.load(f)
            gencode_id = resolve_data.get("gencode_id")
            if not gencode_id:
                return []
                
            # 2. Get top tissues
            tissues_file = DATA_DIR / f"gtex_tissues_{gene_symbol}.json"
            res2 = self._run_skill_script("gtex_database", "scripts/gtex_cli.py", ["get-top-expressed-tissues", gencode_id, "--n", "5", "--output", str(tissues_file)])
            
            if res2["success"] and tissues_file.exists():
                with open(tissues_file, "r") as f:
                    return json.load(f)
            return []
        except Exception as e:
            print(f"Error querying GTEx: {e}")
            return []

    def query_reactome_pathways(self, uniprot_accession: str) -> List[Dict[str, Any]]:
        """
        Retrieve biological pathways containing the target protein accession from Reactome.
        """
        try:
            reactome_file = DATA_DIR / f"reactome_{uniprot_accession}.json"
            res = self._run_skill_script("reactome_database", "scripts/reactome_analysis.py", ["identifier", "--id", uniprot_accession, "--output", str(reactome_file)])
            
            if res["success"] and reactome_file.exists():
                with open(reactome_file, "r") as f:
                    data = json.load(f)
                # Sort and filter top 5 pathways
                pathways = data.get("pathways", [])
                sorted_pathways = sorted(pathways, key=lambda x: x.get("entities", {}).get("pValue", 1.0))
                
                parsed = []
                for p in sorted_pathways[:5]:
                    parsed.append({
                        "stId": p.get("stId", "N/A"),
                        "name": p.get("name", "Unknown Pathway"),
                        "pValue": p.get("entities", {}).get("pValue", 1.0),
                        "fdr": p.get("entities", {}).get("fdr", 1.0)
                    })
                return parsed
            return []
        except Exception as e:
            print(f"Error querying Reactome: {e}")
            return []

    def query_clinical_trials(self, gene_symbol: str) -> List[Dict[str, Any]]:
        """
        Retrieve matching clinical trials for a gene condition from ClinicalTrials.gov.
        """
        try:
            trials_file = DATA_DIR / f"trials_{gene_symbol}.json"
            res = self._run_skill_script("clinical_trials_database", "scripts/clinical_trials_api.py", ["search", "--term", gene_symbol, "--limit", "5", "--output", str(trials_file)])
            
            if res["success"] and trials_file.exists():
                with open(trials_file, "r") as f:
                    data = json.load(f)
                studies = data.get("studies", [])
                parsed = []
                for s in studies:
                    proto = s.get("protocolSection", {})
                    parsed.append({
                        "nct_id": proto.get("identificationModule", {}).get("nctId", "N/A"),
                        "title": proto.get("identificationModule", {}).get("briefTitle", "N/A"),
                        "phase": ", ".join(proto.get("designModule", {}).get("phases", [])),
                        "status": proto.get("statusModule", {}).get("overallStatus", "N/A"),
                        "sponsor": proto.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name", proto.get("identificationModule", {}).get("organization", {}).get("fullName", "N/A")),
                        "summary": proto.get("descriptionModule", {}).get("briefSummary", "N/A")
                    })
                return parsed
            return []
        except Exception as e:
            print(f"Error querying Clinical Trials: {e}")
            return []


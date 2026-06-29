# /// script
# requires-python = ">=3.10, <3.13"
# dependencies = [
#     "pymol-open-source-whl",
#     "numpy",
# ]
# ///

import os
import sys
import argparse

# Set environment variable for headless rendering before loading PyMOL
os.environ["PYOPENGL_PLATFORM"] = "osmesa"

import pymol # pytype: disable=import-error
pymol.pymol_argv = ["pymol", "-cq"]
pymol.finish_launching()

from pymol import cmd, util # pytype: disable=import-error

def main():
    parser = argparse.ArgumentParser(description="In Silico Mutagenesis and Visualization Automation using PyMOL")
    parser.add_argument("--structure", required=True, help="Path to input structure file (.cif or .pdb)")
    parser.add_argument("--residue", required=True, help="Residue number to mutate (e.g., 600)")
    parser.add_argument("--chain", default="A", help="Target chain (default: A)")
    parser.add_argument("--target_aa", required=True, help="Target 3-letter amino acid (e.g., GLU)")
    parser.add_argument("--output_dir", required=True, help="Directory to save visual output files")
    
    args = parser.parse_args()
    
    # 1. Verification and Setup
    struct_path = args.structure
    if not os.path.exists(struct_path):
        print(f"Error: Structure file {struct_path} does not exist.")
        sys.exit(1)
        
    out_dir = args.output_dir
    os.makedirs(out_dir, exist_ok=True)
    
    target_resi = args.residue
    chain = args.chain
    target_aa = args.target_aa.upper()
    
    wt_sel = f"prot and chain {chain} and resi {target_resi}"
    
    # 2. Load wild-type structure
    cmd.load(struct_path, "prot")
    
    n_atoms = cmd.count_atoms("prot")
    if n_atoms == 0:
        print("Error: Loaded structure has 0 atoms.")
        cmd.quit()
        sys.exit(1)
        
    # Get the original residue name to confirm it exists
    wt_residues = []
    cmd.iterate(f"{wt_sel} and name CA", "wt_residues.append(resn)", space=locals())
    if not wt_residues:
        print(f"Error: Residue {target_resi} on Chain {chain} not found.")
        cmd.quit()
        sys.exit(1)
    orig_aa = wt_residues[0]
    
    print(f"Loaded structure successfully. Total atoms: {n_atoms}")
    print(f"Targeting Residue: {orig_aa} {target_resi} on Chain {chain}")

    # Standard styling configuration
    cmd.bg_color("white")
    cmd.set("ray_opaque_background", 1)
    
    # 3. Create Wild-Type visual representation
    # Select pocket (residues within 5.0 Angstroms of target residue)
    cmd.select("pocket_wt", f"byres (prot and (all within 5.0 of {wt_sel}))")
    
    # Render cartoon background
    cmd.show("cartoon", "prot")
    cmd.color("gray80", "prot")
    cmd.set("cartoon_transparency", 0.4, "prot")
    
    # Render pocket residues and mutated residue as sticks
    cmd.show("sticks", "pocket_wt")
    util.cbac("pocket_wt") # Cyan carbon coloring
    util.cnc("pocket_wt")  # Heteroatom color correction (nitrogen=blue, oxygen=red)
    
    cmd.show("sticks", wt_sel)
    util.cbag(wt_sel)      # Green carbon coloring for the mutated residue
    util.cnc(wt_sel)
    cmd.hide("sticks", "hydro") # Hide hydrogens for cleaner presentation
    
    # Map polar contacts (hydrogen bonds)
    wt_polar_name = f"wt_polar_{target_resi}"
    wt_contacts = 0
    try:
        cmd.distance(wt_polar_name, wt_sel, "pocket_wt", cutoff=3.5, mode=2)
        if wt_polar_name in cmd.get_names("all"):
            cmd.set("dash_color", "yellow")
            cmd.set("dash_gap", 0.4)
            cmd.set("dash_radius", 0.08)
            cmd.hide("labels", wt_polar_name)
            wt_contacts = cmd.count_atoms(wt_polar_name) // 2
    except Exception as e:
        print(f"No wild-type polar contacts mapped or error: {e}")
    
    # Orient view
    cmd.orient(f"{wt_sel} | pocket_wt")
    cmd.zoom(f"{wt_sel} | pocket_wt", buffer=3.0)
    
    # Save camera view to ensure exact match for mutant render
    view = cmd.get_view()
    
    # Save Wild-Type Pocket PNG
    wt_img_path = os.path.join(out_dir, "wt_pocket.png")
    cmd.png(wt_img_path, width=1000, height=800, dpi=150)
    print(f"Saved Wild-Type pocket render to: {wt_img_path}")
    
    # Delete temporary selections/distances to clean up canvas before mutation
    if wt_polar_name in cmd.get_names("all"):
        cmd.delete(wt_polar_name)
    cmd.delete("pocket_wt")

    # 4. Perform Mutagenesis in-place
    print(f"Applying in silico mutation: {orig_aa} {target_resi} -> {target_aa}")
    
    # Create a temporary selection name to avoid the cmd.delete expression bug
    cmd.select("temp_target", wt_sel)
    
    # Initialize PyMOL mutagenesis wizard
    cmd.wizard("mutagenesis")
    cmd.get_wizard().set_mode(target_aa)
    cmd.get_wizard().do_select("temp_target")
    
    # Select optimal rotamer if multiple conformations are present
    # We apply first state (most probable rotamer)
    cmd.get_wizard().apply()
    cmd.set_wizard() # Close wizard
    
    # 5. Create Mutant visual representation
    # Select pocket around mutant
    cmd.select("pocket_mut", f"byres (prot and (all within 5.0 of {wt_sel}))")
    
    cmd.show("cartoon", "prot")
    cmd.color("gray80", "prot")
    cmd.set("cartoon_transparency", 0.4, "prot")
    
    cmd.show("sticks", "pocket_mut")
    util.cbac("pocket_mut")
    util.cnc("pocket_mut")
    
    cmd.show("sticks", wt_sel)
    util.cbam(wt_sel)      # Magenta carbon coloring for mutant residue
    util.cnc(wt_sel)
    cmd.hide("sticks", "hydro")
    
    # Map polar contacts for mutant
    mut_polar_name = f"mut_polar_{target_resi}"
    mut_contacts = 0
    try:
        cmd.distance(mut_polar_name, wt_sel, "pocket_mut", cutoff=3.5, mode=2)
        if mut_polar_name in cmd.get_names("all"):
            cmd.set("dash_color", "yellow")
            cmd.set("dash_gap", 0.4)
            cmd.set("dash_radius", 0.08)
            cmd.hide("labels", mut_polar_name)
            mut_contacts = cmd.count_atoms(mut_polar_name) // 2
    except Exception as e:
        print(f"No mutant polar contacts mapped or error: {e}")
    
    # Keep the camera orientation identical to WT for seamless side-by-side comparison
    cmd.set_view(view)
    
    # Save Mutant Pocket PNG
    mut_img_path = os.path.join(out_dir, "mut_pocket.png")
    cmd.png(mut_img_path, width=1000, height=800, dpi=150)
    print(f"Saved Mutant pocket render to: {mut_img_path}")

    # ── Enhancement 2: Multi-Angle Rotation Views for Gemma 4 Spatial Reasoning ──
    # Generate 3 rotation frames around Y-axis at 0°, 90°, 180° so Gemma 4
    # can reason about the full 3D geometry of the mutation site.
    rotation_views = []
    angles = [0, 90, 180]
    for angle in angles:
        # Rotate from the locked pocket view
        cmd.set_view(view)
        cmd.rotate("y", angle, "all")
        rot_path = os.path.join(out_dir, f"mut_view_{angle}.png")
        cmd.png(rot_path, width=800, height=640, dpi=120)
        rotation_views.append(rot_path)
        print(f"Saved rotation view {angle}° to: {rot_path}")

    # Restore canonical pocket view
    cmd.set_view(view)

    # ── Full protein secondary structure cartoon for 3rd assessor image ──
    cmd.show("cartoon", "prot")
    cmd.color("salmon", "ss h and prot")      # helices = salmon
    cmd.color("palegreen", "ss s and prot")   # sheets  = pale green
    cmd.color("wheat", "ss l+'' and prot")    # loops   = wheat
    # Highlight the mutation site in the full view
    cmd.show("sticks", wt_sel)
    util.cbam(wt_sel)
    cmd.orient("prot")
    cartoon_img_path = os.path.join(out_dir, "mutant_full.png")
    cmd.png(cartoon_img_path, width=1000, height=800, dpi=150)
    print(f"Saved full protein cartoon render to: {cartoon_img_path}")
    
    # Save the PyMOL session (.pse) and mutated coordinates (.pdb)
    cmd.save(os.path.join(out_dir, "mutant_session.pse"))
    cmd.save(os.path.join(out_dir, "mutant_structure.pdb"), "prot")
    
    # Print structural change data to stdout (to be parsed by backend)
    print(f"METRICS_START")
    print(f"wildtype_contacts={wt_contacts}")
    print(f"mutant_contacts={mut_contacts}")
    print(f"original_aa={orig_aa}")
    print(f"target_aa={target_aa}")
    for i, angle in enumerate(angles):
        print(f"rotation_view_{angle}={rotation_views[i]}")
    print(f"METRICS_END")
    
    cmd.quit()

if __name__ == "__main__":
    main()


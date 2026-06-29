from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from pathlib import Path
from app.services.cerebras_service import CerebrasService
from app.services.science_service import ScienceService
from app.config import BACKEND_DIR

router = APIRouter()
science_service = ScienceService()


class AgentAssessmentRequest(BaseModel):
    wt_image_rel_path:     str
    mut_image_rel_path:    str
    mutation_description:  str
    reasoning_effort:      Optional[str] = "high"
    compounds:             Optional[List[Dict[str, Any]]] = []
    # Enhancement 1 — 3rd image: full protein cartoon
    full_protein_rel_path: Optional[str] = None
    # Enhancement 2 — spatial rotation views
    rotation_view_paths:   Optional[List[str]] = []


class ChartInterpretRequest(BaseModel):
    """Enhancement 3 — GTEx/chart image sent as base64 for Gemma 4 interpretation."""
    chart_image_b64: str
    chart_context:   str
    gene_name:       str


def extract_uniprot_annotations(uniprot_data: Dict[str, Any], residue_idx: int) -> str:
    """
    Extracts real mutagenesis and variant features from UniProtKB JSON matching the target residue.
    """
    if not uniprot_data or "features" not in uniprot_data:
        return "No direct annotations found in UniProt KB for this position."

    matched = []
    features = uniprot_data.get("features", [])
    for f in features:
        location = f.get("location", {})
        start = location.get("start", {}).get("value")
        end   = location.get("end",   {}).get("value")

        if start is not None and end is not None:
            if start <= residue_idx <= end:
                feat_type = f.get("type", "Feature")
                desc      = f.get("description", "").strip()
                alt_seq   = f.get("alternativeSequence", "")

                info = f"- [{feat_type}] at position {start}"
                if alt_seq:
                    info += f" (mutated to {alt_seq})"
                if desc:
                    info += f": {desc}"
                matched.append(info)

    if not matched:
        return "No documented variants or mutagenesis features are annotated for this residue position in UniProt KB."

    return "\n".join(matched)


# ── POST /api/agent/assess ─────────────────────────────────────────────────────
@router.post("/assess")
def assess_mutation(payload: AgentAssessmentRequest):
    """
    Runs a 5-agent consensus pipeline using Gemma 4 multimodal capabilities:

    1. Assessor Agent  (Multimodal — 3-image interleaved): WT pocket + Mutant pocket + Full protein
    2. Spatial Agent   (Multimodal — 3 rotation frames):   Multi-angle 3D geometric reasoning
    3. Evolution Agent (Text):  UniProtKB conservation & variant annotations
    4. Chem Agent      (Text):  Ligand binding impact prediction
    5. Director Agent  (Text):  Final synthesized consensus report
    """
    wt_abs_path  = BACKEND_DIR / payload.wt_image_rel_path
    mut_abs_path = BACKEND_DIR / payload.mut_image_rel_path

    if not wt_abs_path.exists():
        raise HTTPException(status_code=400, detail=f"Wild-type render not found at {wt_abs_path}")
    if not mut_abs_path.exists():
        raise HTTPException(status_code=400, detail=f"Mutant render not found at {mut_abs_path}")

    # Resolve optional full-protein image (Enhancement 1)
    full_protein_abs: Optional[str] = None
    if payload.full_protein_rel_path:
        fp = BACKEND_DIR / payload.full_protein_rel_path
        if fp.exists():
            full_protein_abs = str(fp)

    # Resolve rotation view paths (Enhancement 2)
    rotation_abs_paths: List[str] = []
    for rel in (payload.rotation_view_paths or []):
        rp = BACKEND_DIR / rel
        if rp.exists():
            rotation_abs_paths.append(str(rp))

    # Extract UniProt accession + residue index from folder path
    path_parts  = Path(payload.wt_image_rel_path).parts
    folder_name = path_parts[1] if len(path_parts) > 1 else ""

    accession    = ""
    residue_idx  = 1

    if "_mut_" in folder_name:
        try:
            parts    = folder_name.split("_mut_")
            accession  = parts[0]
            subparts = parts[1].split("_")
            if subparts:
                residue_idx = int(subparts[0])
        except Exception:
            pass

    # Fetch real UniProtKB annotations
    uniprot_annotations = "No direct annotations found in UniProt KB for this position."
    if accession and residue_idx:
        try:
            uniprot_data       = science_service.fetch_uniprot_info(accession)
            uniprot_annotations = extract_uniprot_annotations(uniprot_data, residue_idx)
        except Exception as e:
            uniprot_annotations = f"Could not fetch annotations from database: {str(e)}"

    try:
        cerebras = CerebrasService()

        # ── Agent 1: Assessor — Interleaved 3-Image Multimodal ────────────────
        assessor_res = cerebras.assess_mutant_multimodal(
            wildtype_img_path     = str(wt_abs_path),
            mutant_img_path       = str(mut_abs_path),
            mutation_description  = payload.mutation_description,
            full_protein_img_path = full_protein_abs,
            reasoning_effort      = payload.reasoning_effort or "high",
        )
        assessor_content  = assessor_res["content"]
        assessor_metrics  = assessor_res["metrics"]
        assessor_vision   = assessor_res.get("vision_metadata", {})

        # ── Agent 2: Spatial — Multi-Angle 3D Reasoning ───────────────────────
        spatial_content = ""
        spatial_metrics = {"total_latency_sec": 0, "tokens_per_sec": 0}
        spatial_usage   = {"total_tokens": 0}
        spatial_vision  = {}

        if rotation_abs_paths:
            spatial_res    = cerebras.analyze_spatial_views(
                rotation_view_paths  = rotation_abs_paths,
                mutation_description = payload.mutation_description,
            )
            spatial_content = spatial_res["content"]
            spatial_metrics = spatial_res["metrics"]
            spatial_usage   = spatial_res["usage"]
            spatial_vision  = spatial_res.get("vision_metadata", {})

        # ── Agent 3: Evolution — Text + UniProt annotation grounding ──────────
        evolution_prompt = (
            f"You are the Evolutionary Biology Agent. Analyze the mutation details, the Assessor's visual findings, "
            f"and these actual documented annotations from the UniProt database for this position.\n\n"
            f"Mutation: {payload.mutation_description}\n"
            f"Target Position: Residue {residue_idx} in Protein {accession}\n\n"
            f"UniProtKB Documented Annotations at Residue {residue_idx}:\n"
            f"{uniprot_annotations}\n\n"
            f"Assessor Visual Findings:\n{assessor_content}\n\n"
            + (f"Spatial Geometry Analysis:\n{spatial_content}\n\n" if spatial_content else "")
            + "Provide an evolutionary conservation check. Discuss if this residue is highly conserved, "
            "and comment on any documented mutagenesis or natural variant effects listed in the UniProt database above."
        )
        evolution_res     = cerebras.chat_completion(
            messages=[{"role": "user", "content": evolution_prompt}],
            reasoning_effort="none",
            temperature=0.2,
        )
        evolution_content = evolution_res["content"]

        # ── Agent 4: Cheminformatics — Drug binding impact ────────────────────
        compounds_str = (
            ", ".join([c.get("molecule_chembl_id", "N/A") for c in payload.compounds])
            if payload.compounds
            else "None found"
        )
        chem_prompt = (
            f"You are the Cheminformatics & Drug Design Agent. Review the target ligands and the Assessor's visual pocket report.\n\n"
            f"Active molecules found in database: {compounds_str}\n\n"
            f"Assessor Visual Report:\n{assessor_content}\n\n"
            + (f"Spatial Geometry Context:\n{spatial_content}\n\n" if spatial_content else "")
            + "Evaluate how the structural alterations in the active site (e.g. hydrogen bonding shifts, volume changes) "
            "will affect binding interactions with these small-molecule ligands. Predict potential drug resistance."
        )
        chem_res     = cerebras.chat_completion(
            messages=[{"role": "user", "content": chem_prompt}],
            reasoning_effort="none",
            temperature=0.2,
        )
        chem_content = chem_res["content"]

        # ── Agent 5: Director — Synthesized consensus report ──────────────────
        director_prompt = (
            f"You are the Consensus Director Agent. Synthesize the findings from our specialized agents:\n\n"
            f"--- ASSESSOR REPORT (Multimodal — {assessor_vision.get('images_used', 2)} images analyzed) ---\n"
            f"{assessor_content}\n\n"
            + (f"--- SPATIAL GEOMETRY REPORT (Multi-angle: {spatial_vision.get('angles_degrees', [])}°) ---\n{spatial_content}\n\n" if spatial_content else "")
            + f"--- EVOLUTION REPORT ---\n{evolution_content}\n\n"
            f"--- CHEMINFORMATICS REPORT ---\n{chem_content}\n\n"
            f"Generate a unified molecular synthesis report with these sections:\n"
            f"1. Executive Mutation Impact Summary\n"
            f"2. Structural Pocket Evaluation (from visual analysis)\n"
            f"3. 3D Spatial Geometry Assessment\n"
            f"4. Evolutionary and Stability Profile\n"
            f"5. Small Molecule Ligand Binding Impact\n"
            f"6. Overall Risk Classification [Stabilizing / Destabilizing / Neutral / Drug-Resistant]"
        )
        director_res     = cerebras.chat_completion(
            messages=[{"role": "user", "content": director_prompt}],
            reasoning_effort="none",
            temperature=0.2,
        )
        director_content = director_res["content"]

        # ── Aggregate metrics ─────────────────────────────────────────────────
        total_latency = (
            assessor_metrics["total_latency_sec"]
            + spatial_metrics.get("total_latency_sec", 0)
            + evolution_res["metrics"]["total_latency_sec"]
            + chem_res["metrics"]["total_latency_sec"]
            + director_res["metrics"]["total_latency_sec"]
        )

        total_tokens = (
            assessor_res["usage"]["total_tokens"]
            + spatial_usage.get("total_tokens", 0)
            + evolution_res["usage"]["total_tokens"]
            + chem_res["usage"]["total_tokens"]
            + director_res["usage"]["total_tokens"]
        )

        return {
            "success": True,
            "transcripts": {
                "assessor":       assessor_content,
                "spatial":        spatial_content,
                "evolution":      evolution_content,
                "cheminformatics": chem_content,
                "director":       director_content,
            },
            "vision_metadata": {
                "assessor": assessor_vision,
                "spatial":  spatial_vision,
            },
            "metrics": {
                "total_latency_sec": round(total_latency, 3),
                "tokens_per_sec":    assessor_metrics["tokens_per_sec"],
                "is_cerebras":       True,
            },
            "usage": {
                "total_tokens": total_tokens,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /api/agent/interpret-chart ───────────────────────────────────────────
@router.post("/interpret-chart")
def interpret_chart(payload: ChartInterpretRequest):
    """
    Enhancement 3: Receives a base64-encoded scientific chart image from the
    frontend (GTEx tissue expression chart rendered to canvas) and sends it to
    Gemma 4 for clinical interpretation — identifying off-target toxicity risks,
    therapeutic window assessment, and drug development recommendations.
    """
    try:
        cerebras = CerebrasService()
        result   = cerebras.interpret_scientific_chart(
            chart_image_b64 = payload.chart_image_b64,
            chart_context   = payload.chart_context,
            gene_name       = payload.gene_name,
        )

        return {
            "success":         True,
            "interpretation":  result["content"],
            "vision_metadata": result.get("vision_metadata", {}),
            "metrics": {
                "total_latency_sec": result["metrics"]["total_latency_sec"],
                "tokens_per_sec":    result["metrics"]["tokens_per_sec"],
                "is_cerebras":       True,
            },
            "usage": result["usage"],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

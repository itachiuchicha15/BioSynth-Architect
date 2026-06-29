from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.pymol_service import PyMOLService

router = APIRouter()
pymol_service = PyMOLService()

class MutationRequest(BaseModel):
    structure_path: str
    residue: str
    target_aa: str
    chain: Optional[str] = "A"

@router.post("/run")
def run_mutagenesis(payload: MutationRequest):
    """
    Executes in silico mutagenesis on the specified residue and chain,
    generating 3D renders of both wild-type and mutant residues in pocket.
    """
    try:
        result = pymol_service.mutate_and_render(
            structure_path=payload.structure_path,
            residue=payload.residue,
            target_aa=payload.target_aa,
            chain=payload.chain
        )
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error", "PyMOL rendering failed."))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

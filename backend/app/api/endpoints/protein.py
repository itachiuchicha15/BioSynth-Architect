from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.science_service import ScienceService

router = APIRouter()
science_service = ScienceService()

class SearchQuery(BaseModel):
    query: str
    limit: Optional[int] = 5

@router.post("/search")
def search_proteins(payload: SearchQuery):
    """
    Search UniProtKB database for entries matching a query.
    """
    try:
        results = science_service.search_uniprot(payload.query, limit=payload.limit)
        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/info/{accession}")
def get_protein_info(accession: str):
    """
    Fetch comprehensive UniProt metadata for a specific accession ID.
    """
    try:
        info = science_service.fetch_uniprot_info(accession)
        return {"success": True, "data": info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/structure/{accession}")
def download_protein_structure(accession: str):
    """
    Downloads structural mmCIF/PDB files for the target accession.
    """
    try:
        local_path = science_service.download_structure(accession)
        return {"success": True, "filepath": local_path}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/compounds/{accession}")
def get_chembl_compounds(accession: str, limit: Optional[int] = 10):
    """
    Query ChEMBL for active chemical ligands and drug candidates matching the target.
    """
    try:
        compounds = science_service.query_chembl_ligands(accession, limit=limit)
        return {"success": True, "compounds": compounds}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/gtex/{gene_symbol}")
def get_gtex_expression(gene_symbol: str):
    """
    Fetch GTEx tissue expression median values (TPM) for a gene symbol.
    """
    try:
        results = science_service.query_gtex_expression(gene_symbol)
        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pathways/{accession}")
def get_reactome_pathways(accession: str):
    """
    Retrieve biological pathways containing the target protein accession from Reactome.
    """
    try:
        results = science_service.query_reactome_pathways(accession)
        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trials/{gene_symbol}")
def get_clinical_trials(gene_symbol: str):
    """
    Retrieve matching clinical trials for a gene condition from ClinicalTrials.gov.
    """
    try:
        results = science_service.query_clinical_trials(gene_symbol)
        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


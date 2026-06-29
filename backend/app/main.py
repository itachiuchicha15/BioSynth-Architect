import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import OUTPUT_DIR

from app.api.endpoints.protein import router as protein_router
from app.api.endpoints.mutate import router as mutate_router
from app.api.endpoints.agent import router as agent_router
from app.api.endpoints.benchmark import router as benchmark_router

app = FastAPI(
    title="BioSynth Architect API",
    description="FAANG-level modular backend for the Cerebras + Gemma 4 Protein Simulator",
    version="1.0.0"
)

# Enable CORS for the React/Vite development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to frontend host in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static file directory to serve rendered PNGs and PyMOL sessions
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")

# Register routers
app.include_router(protein_router, prefix="/api/protein", tags=["Protein"])
app.include_router(mutate_router, prefix="/api/mutate", tags=["Mutagenesis"])
app.include_router(agent_router, prefix="/api/agent", tags=["Agent Assessment"])
app.include_router(benchmark_router, prefix="/api/benchmark", tags=["Benchmark"])

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "BioSynth Architect API",
        "docs": "/docs"
    }

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

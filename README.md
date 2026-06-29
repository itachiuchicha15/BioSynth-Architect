# BioSynth Architect: Multimodal Protein Engineering & Mutation Simulator

BioSynth Architect is an autonomous molecular engineering lab and in silico mutation simulator developed for the **Cerebras and Google DeepMind Gemma 4 24-Hour Hackathon**. It empowers synthetic biology researchers to evaluate structural, evolutionary, and chemical profiles of mutated proteins in milliseconds using Cerebras' ultra-fast inference and Gemma-4-31B.

---

## Key Features

1. **In Silico Mutagenesis Simulator (Renderer Agent):** 
   Headless PyMOL rendering powered by OSMesa. Performs residue substitutions, aligns pockets, calculates hydrogen bonds (polar contacts), and renders side-by-side wild-type vs. mutated states.
2. **Multimodal Agent Evaluation (Assessor Agent):**
   Submits rendered pocket images to Gemma-4-31B on Cerebras with reasoning enabled. Analyzes steric clashes, pocket distortions, and hydrogen bond disruptions in sub-seconds.
3. **Target Ligand Discovery (Cheminformatics Agent):**
   Interfaces with the ChEMBL database to retrieve active small molecules, binding affinities, and indications matching the target system.
4. **Cerebras Speed Benchmark Panel:**
   An interactive comparison bench showing Cerebras' massive speedup (TTFT and throughput multipliers) against standard GPU cloud instances.

---

## Directory Architecture (FAANG-Level Modular)

```
e:\Gemma Hackathon/
├── .env                  # Global environment parameters (CEREBRAS_API_KEY)
├── README.md             # Project documentation
├── backend/              # Python FastAPI Backend Service
│   ├── .venv/            # Python virtual environment
│   ├── pyproject.toml    # Modern python project declaration and dependencies
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py       # FastAPI application entrypoint and routes registration
│   │   ├── config.py     # Configuration, directories, and environment loader
│   │   ├── api/          # Modular API routers
│   │   │   ├── __init__.py
│   │   │   └── endpoints/
│   │   │       ├── __init__.py
│   │   │       ├── protein.py   # Protein search, metadata, and ligand discovery
│   │   │       ├── mutate.py    # Trigger PyMOL mutagenesis
│   │   │       ├── agent.py     # Multimodal Gemma-4 visual evaluation
│   │   │       └── benchmark.py # Cerebras latency vs GPU benchmarking
│   │   └── services/     # Decoupled business logic and SDK handlers (DRY)
│   │       ├── __init__.py
│   │       ├── cerebras_service.py # Gemma-4-31B client (Vision + Reasoning)
│   │       ├── science_service.py  # Wrapper for UniProt and ChEMBL skill tools
│   │       └── pymol_service.py    # Headless subprocess wrapper for PyMOL
│   └── scripts/          # Independent automation templates
│       └── render_mutant.py # Headless PyMOL mutation & rendering routine
└── frontend/             # React + TypeScript Vite Frontend
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── index.css     # Premium dark-mode biotech stylesheets
        ├── App.tsx       # State coordinator & Dashboard frame
        ├── types/        # TypeScript interfaces
        │   └── index.ts
        ├── services/     # API request clients
        │   └── api.ts
        └── components/   # Reusable UI elements
            ├── ProteinSearch.tsx
            ├── MutationForm.tsx
            ├── StructureViewer.tsx
            ├── AgentConsole.tsx
            └── SpeedMetrics.tsx
```

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.10+) with `uv` package manager installed globally.

### 1. Configure API Key
Create a `.env` file at the root of the project containing your Cerebras API key (already pre-loaded in this workspace):
```env
CEREBRAS_API_KEY=csk-dtmkxdejct8py9xf43nr3x6hkfjnwpyf9mp25mfy23dvjnt5
```

### 2. Start the Backend API
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Activate the virtual environment:
   * **Windows Powershell:** `.venv\Scripts\activate`
   * **Linux/macOS:** `source .venv/bin/activate`
3. Launch the Uvicorn server:
   ```bash
   uvicorn app.main:app --port 8000 --reload
   ```
   The API will be available at `http://127.0.0.1:8000`. You can inspect the Swagger documentation at `http://127.0.0.1:8000/docs`.

### 3. Start the Frontend React App
1. Navigate to the `frontend` folder:
   ```bash
   cd ../frontend
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

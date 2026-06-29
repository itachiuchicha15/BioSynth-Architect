import os
from pathlib import Path
from dotenv import load_dotenv

# Resolve paths relative to project layout
BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent

# Load environment variables
load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")

CEREBRAS_API_KEY = os.environ.get("CEREBRAS_API_KEY", "")
MODEL_NAME = "gemma-4-31b"

# Configure global User-Agent to bypass EBI database blocks
os.environ["SCIENCE_SKILLS_USER_AGENT"] = "BioSynthArchitect/1.0 (contact: naresh@example.com)"

# Directories for structures and rendered assets
DATA_DIR = BACKEND_DIR / "data"
OUTPUT_DIR = BACKEND_DIR / "output"

DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

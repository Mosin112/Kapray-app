"""Make `kapray_ingest` importable when pytest is run from anywhere."""
import sys
from pathlib import Path

INGEST_DIR = Path(__file__).resolve().parent.parent
if str(INGEST_DIR) not in sys.path:
    sys.path.insert(0, str(INGEST_DIR))

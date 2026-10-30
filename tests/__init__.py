import os
import tempfile

# Keep tests away from the real data/appu.db. Run with: python -m unittest discover -s tests -t .
os.environ.setdefault("APPU_DB_PATH", os.path.join(tempfile.mkdtemp(prefix="appu-tests-"), "appu.db"))

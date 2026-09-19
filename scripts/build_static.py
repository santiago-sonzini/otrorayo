"""Copy public website assets only. Never read or inject environment variables."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "landing"
OUTPUT = ROOT / "public"
SUFFIXES = {".html", ".css", ".js", ".jpg", ".jpeg", ".png", ".webp", ".svg", ".ico", ".woff2", ".mp4", ".webm"}
DOCUMENTS = {"robots.txt", "sitemap.xml", "llms.txt"}


def build():
    if OUTPUT.is_symlink():
        raise RuntimeError("Output must be a local directory")
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()
    count = 0
    for source in SOURCE.rglob("*"):
        relative = source.relative_to(SOURCE)
        if not source.is_file() or source.is_symlink() or any(p.startswith(".") for p in relative.parts):
            continue
        if source.suffix.lower() not in SUFFIXES and relative.as_posix() not in DOCUMENTS:
            continue
        target = OUTPUT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        count += 1
    print(f"Prepared {count} public website files.")


if __name__ == "__main__":
    build()

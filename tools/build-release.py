from __future__ import annotations

import hashlib
import json
import shutil
import sys
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ZIP_PATH = DIST / "character-state-tracker-v12.zip"
RUNTIME_ROOTS = ("scripts", "styles", "templates", "lang", "assets")
ROOT_FILES = ("module.json", "README.md", "README_EN.md", "CHANGELOG.md")
EXCLUDED_PARTS = {".git", ".github", "tests", "tools", "docs", "dist", "node_modules", "_reference", "_rejected"}
EXCLUDED_SUFFIXES = {".rar", ".zip", ".wav", ".tmp", ".bak", ".swp"}
FIXED_DATE = (2020, 1, 1, 0, 0, 0)


def fail(message: str) -> None:
    raise RuntimeError(message)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def runtime_files() -> list[Path]:
    files: list[Path] = []
    for name in ROOT_FILES:
        path = ROOT / name
        if not path.is_file():
            fail(f"Missing release file: {name}")
        files.append(path)
    for root_name in RUNTIME_ROOTS:
        root = ROOT / root_name
        if not root.is_dir():
            fail(f"Missing runtime directory: {root_name}")
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            relative = path.relative_to(ROOT)
            if any(part in EXCLUDED_PARTS for part in relative.parts):
                continue
            if path.suffix.lower() in EXCLUDED_SUFFIXES:
                continue
            files.append(path)
    return sorted(set(files), key=lambda item: item.relative_to(ROOT).as_posix())


def validate_manifest() -> dict:
    manifest = json.loads((ROOT / "module.json").read_text(encoding="utf-8"))
    if manifest.get("id") != "character-state-tracker":
        fail("Unexpected module id")
    version = manifest.get("version")
    expected = f"/v{version}-fvtt12/character-state-tracker-v12.zip"
    if not str(manifest.get("download", "")).endswith(expected):
        fail("Manifest download URL does not match version")
    return manifest


def build() -> None:
    manifest = validate_manifest()
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    files = runtime_files()
    with ZipFile(ZIP_PATH, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            arcname = PurePosixPath(path.relative_to(ROOT).as_posix()).as_posix()
            info = ZipInfo(arcname, FIXED_DATE)
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    with ZipFile(ZIP_PATH) as archive:
        names = archive.namelist()
        if "module.json" not in names:
            fail("module.json is not at ZIP root")
        if any("\\" in name for name in names):
            fail("ZIP contains Windows path separators")
        if any(name.startswith("character-state-tracker/") for name in names):
            fail("ZIP has an unwanted wrapper directory")
        if any(Path(name).suffix.lower() in {".rar", ".zip", ".wav"} for name in names):
            fail("ZIP contains a forbidden source/archive file")
    dist_manifest = DIST / "module.json"
    dist_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    checksums = [
        f"{sha256(ZIP_PATH)}  {ZIP_PATH.name}",
        f"{sha256(dist_manifest)}  {dist_manifest.name}",
    ]
    (DIST / "SHA256SUMS.txt").write_text("\n".join(checksums) + "\n", encoding="ascii")
    print(f"Built {ZIP_PATH} ({ZIP_PATH.stat().st_size} bytes, {len(files)} files)")


if __name__ == "__main__":
    try:
        build()
    except Exception as error:
        print(f"Release build failed: {error}", file=sys.stderr)
        raise SystemExit(1)

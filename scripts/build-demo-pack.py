"""Build docs/conductor-demo.zip from voice-forge output + demo manifest + events.

Usage (run from the repo root):
    python scripts/build-demo-pack.py
    python scripts/build-demo-pack.py --voice-source X:/voice-forge/output

The output zip contains:
    manifest.json                              <- from docs/demos/manifest.json
    audio/countdown-voice.wav, countdown-and.wav
    voices/*.wav                                <- 60 action phrase files
    notices/notice-*.wav                        <- 60 notice cue files
    events/*.json                               <- 8 event scripts

Missing WAVs that the manifest references are reported as warnings.
"""
import argparse
import json
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent  # scripts/ -> repo root
DEMOS = REPO / "docs" / "demos"
DEFAULT_VOICE_SOURCE = Path("X:/voice-forge/output")
OUT_ZIP = REPO / "docs" / "conductor-demo.zip"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice-source", type=Path, default=DEFAULT_VOICE_SOURCE,
                        help="voice-forge output dir (contains audio/, voices/, notices/)")
    parser.add_argument("--out", type=Path, default=OUT_ZIP)
    args = parser.parse_args()

    voice_source: Path = args.voice_source
    manifest_path = DEMOS / "manifest.json"

    if not manifest_path.exists():
        sys.exit(f"Missing manifest: {manifest_path}")
    if not voice_source.exists():
        sys.exit(f"Missing voice source: {voice_source}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    # Resolve every cue file from voice-forge output
    missing = []
    cue_files = []
    for cue_id, rel_path in manifest["cues"].items():
        src = voice_source / rel_path
        if not src.exists():
            missing.append(rel_path)
            continue
        cue_files.append((src, rel_path))

    # Resolve every event file from docs/demos/
    event_files = []
    for ev in manifest["events"]:
        rel = ev["file"]  # e.g. "events/the-stillness.json"
        # Strip the events/ prefix to find the source in docs/demos/
        src_name = Path(rel).name  # "the-stillness.json"
        src = DEMOS / src_name
        if not src.exists():
            missing.append(rel)
            continue
        event_files.append((src, rel))

    if missing:
        print("WARN: the following entries are missing source files (will be omitted):")
        for m in missing:
            print(f"  - {m}")

    # Build the zip in a temp file then atomic-move to OUT_ZIP
    with tempfile.NamedTemporaryFile(
        suffix=".zip", dir=args.out.parent, delete=False
    ) as tmp:
        tmp_path = Path(tmp.name)

    try:
        with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("manifest.json", json.dumps(manifest, indent=2))
            for src, rel in cue_files:
                zf.write(src, rel)
            for src, rel in event_files:
                zf.write(src, rel)
        shutil.move(str(tmp_path), str(args.out))
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise

    size_mb = args.out.stat().st_size / (1024 * 1024)
    print(f"\nBuilt {args.out}")
    print(f"  Size: {size_mb:.1f} MB")
    print(f"  Cues: {len(cue_files)}/{len(manifest['cues'])}")
    print(f"  Events: {len(event_files)}/{len(manifest['events'])}")
    if missing:
        print(f"  Missing: {len(missing)} (zip built without them)")
        sys.exit(1)


if __name__ == "__main__":
    main()

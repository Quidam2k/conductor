"""Build the demo resource packs from voice-forge output + demo manifest + events.

Default (v53+): per-event MINI-PACKS — one small zip per demo event, audio
transcoded to 32 kbps mono MP3 so each pack is beamable via QR and light on
weak signal (~100-250 KB each vs the 19 MB WAV monolith).

Usage (run from the repo root):
    python scripts/build-demo-pack.py                     # 8 minis -> docs/packs/demo-<slug>.zip
    python scripts/build-demo-pack.py --monolith          # legacy docs/conductor-demo.zip (WAV)
    python scripts/build-demo-pack.py --voice-source X:/voice-forge/output

Each mini zip contains:
    manifest.json                   <- id "demo-<slug>", only that event's cues
    voices/*.mp3, notices/*.mp3     <- 32 kbps mono MP3 (lameenc), STORE'd
    events/<slug>.json              <- the one event, pack ids rewritten to the mini id

The legacy monolith path is kept for reference but is retired as the linked
pack — docs/conductor-demo.zip stays served for old URLs (ios-audio-test
fetches it) and is NOT rebuilt by the default run.

Missing WAVs that the manifest references are reported as warnings.
"""
import argparse
import copy
import json
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent  # scripts/ -> repo root
DEMOS = REPO / "docs" / "demos"
DEFAULT_VOICE_SOURCE = Path("X:/voice-forge/output")
MONOLITH_ZIP = REPO / "docs" / "conductor-demo.zip"
PACKS_DIR = REPO / "docs" / "packs"
PAGES_BASE = "https://quidam2k.github.io/conductor/packs"
MP3_KBPS = 32
SIZE_WARN_KB = 400  # beamable target; tests guard the same bound


def load_manifest():
    manifest_path = DEMOS / "manifest.json"
    if not manifest_path.exists():
        sys.exit(f"Missing manifest: {manifest_path}")
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def atomic_write_zip(out_path: Path, write_entries):
    """Build a zip via temp file + atomic rename. write_entries(zf) fills it."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        suffix=".zip", dir=out_path.parent, delete=False
    ) as tmp:
        tmp_path = Path(tmp.name)
    try:
        with zipfile.ZipFile(tmp_path, "w") as zf:
            write_entries(zf)
        shutil.move(str(tmp_path), str(out_path))
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise


# ─── MP3 transcode (mirrors the browser's encodeAudioBufferToMp3) ────────

def make_transcoder():
    """Return wav_to_mp3(path) with a per-run cache (cues shared across minis)."""
    import numpy as np
    import lameenc
    import soundfile

    cache = {}

    def wav_to_mp3(src: Path) -> bytes:
        key = str(src)
        if key not in cache:
            data, rate = soundfile.read(src, dtype="float32")
            if data.ndim > 1:  # downmix to mono
                data = data.mean(axis=1)
            pcm16 = (np.clip(data, -1.0, 1.0) * 32767).astype(np.int16)
            enc = lameenc.Encoder()
            enc.set_bit_rate(MP3_KBPS)
            enc.set_in_sample_rate(int(rate))
            enc.set_channels(1)
            enc.set_quality(2)
            cache[key] = bytes(enc.encode(pcm16.tobytes())) + bytes(enc.flush())
        return cache[key]

    return wav_to_mp3


# ─── Mini-packs (default) ────────────────────────────────────────────────

def event_cue_ids(event: dict, master_cues: dict):
    """Cues this event's timeline references, plus their notice- prep phrases.

    Legacy audio/countdown-* system cues are excluded — tonal beeps replaced
    the spoken countdown in v40.
    """
    cues = []
    seen = set()

    def add(cue_id):
        if cue_id in seen:
            return
        path = master_cues.get(cue_id)
        if path and path.startswith("audio/countdown"):
            return
        seen.add(cue_id)
        cues.append(cue_id)

    for action in event.get("timeline", []):
        cue = action.get("cue")
        if not cue:
            continue
        add(cue)
        if f"notice-{cue}" in master_cues:
            add(f"notice-{cue}")
    return cues


def build_minis(args, manifest):
    wav_to_mp3 = make_transcoder()
    master_cues = manifest["cues"]
    voice_source: Path = args.voice_source
    if not voice_source.exists():
        sys.exit(f"Missing voice source: {voice_source}")

    all_missing = []
    report = []

    for ev in manifest["events"]:
        slug = Path(ev["file"]).stem  # "events/the-stillness.json" -> "the-stillness"
        mini_id = f"demo-{slug}"
        src_json = DEMOS / f"{slug}.json"
        if not src_json.exists():
            all_missing.append(str(src_json))
            continue
        event = json.loads(src_json.read_text(encoding="utf-8"))

        cue_ids = event_cue_ids(event, master_cues)
        unknown = [a.get("cue") for a in event.get("timeline", [])
                   if a.get("cue") and a["cue"] not in master_cues]
        for cue in unknown:
            print(f"WARN: {slug}: timeline cue '{cue}' not in master cue map")

        mini_cues = {}
        audio_entries = []  # (zip_path, mp3_bytes)
        missing = []
        for cue_id in cue_ids:
            wav_rel = master_cues[cue_id]
            src = voice_source / wav_rel
            if not src.exists():
                missing.append(wav_rel)
                continue
            mp3_rel = str(Path(wav_rel).with_suffix(".mp3")).replace("\\", "/")
            mini_cues[cue_id] = mp3_rel
            audio_entries.append((mp3_rel, wav_to_mp3(src)))

        # The embedded event copy points at the mini pack, not the master set.
        event_copy = copy.deepcopy(event)
        for action in event_copy.get("timeline", []):
            if "pack" in action:
                action["pack"] = mini_id

        mini_manifest = {
            "id": mini_id,
            "name": f"Demo: {ev['name']}",
            "version": "1.0.0",
            "description": f"{ev['role']} — voice cues for the '{ev['name']}' demo event.",
            "url": f"{PAGES_BASE}/{mini_id}.zip",
            "cues": mini_cues,
            "events": [ev],
        }

        out_zip = PACKS_DIR / f"{mini_id}.zip"

        def write_entries(zf, _m=mini_manifest, _e=event_copy, _a=audio_entries, _f=ev["file"]):
            zf.writestr("manifest.json", json.dumps(_m, indent=2),
                        compress_type=zipfile.ZIP_DEFLATED)
            zf.writestr(_f, json.dumps(_e, indent=2),
                        compress_type=zipfile.ZIP_DEFLATED)
            for rel, mp3 in _a:
                zf.writestr(rel, mp3, compress_type=zipfile.ZIP_STORED)

        atomic_write_zip(out_zip, write_entries)
        size_kb = out_zip.stat().st_size / 1024
        report.append((out_zip.name, size_kb, len(mini_cues), missing))
        all_missing.extend(missing)

    print(f"\nBuilt {len(report)} mini-packs in {PACKS_DIR}")
    total_kb = 0
    for name, size_kb, cue_count, missing in report:
        total_kb += size_kb
        flag = ""
        if size_kb > SIZE_WARN_KB:
            flag = f"  ⚠ over {SIZE_WARN_KB} KB target"
        if missing:
            flag += f"  ({len(missing)} missing cues omitted)"
        print(f"  {name:32} {size_kb:8.1f} KB  {cue_count:3} cues{flag}")
    print(f"  {'TOTAL':32} {total_kb:8.1f} KB")

    if all_missing:
        print(f"\nWARN: {len(all_missing)} missing source files:")
        for m in all_missing:
            print(f"  - {m}")
        sys.exit(1)


# ─── Legacy monolith (retired as the linked pack; kept for reference) ────

def build_monolith(args, manifest):
    voice_source: Path = args.voice_source
    if not voice_source.exists():
        sys.exit(f"Missing voice source: {voice_source}")

    missing = []
    cue_files = []
    for cue_id, rel_path in manifest["cues"].items():
        src = voice_source / rel_path
        if not src.exists():
            missing.append(rel_path)
            continue
        cue_files.append((src, rel_path))

    event_files = []
    for ev in manifest["events"]:
        rel = ev["file"]  # e.g. "events/the-stillness.json"
        src = DEMOS / Path(rel).name
        if not src.exists():
            missing.append(rel)
            continue
        event_files.append((src, rel))

    if missing:
        print("WARN: the following entries are missing source files (will be omitted):")
        for m in missing:
            print(f"  - {m}")

    out = args.out or MONOLITH_ZIP

    def write_entries(zf):
        zf.writestr("manifest.json", json.dumps(manifest, indent=2),
                    compress_type=zipfile.ZIP_DEFLATED)
        for src, rel in cue_files:
            zf.write(src, rel, compress_type=zipfile.ZIP_DEFLATED)
        for src, rel in event_files:
            zf.write(src, rel, compress_type=zipfile.ZIP_DEFLATED)

    atomic_write_zip(out, write_entries)

    size_mb = out.stat().st_size / (1024 * 1024)
    print(f"\nBuilt {out}")
    print(f"  Size: {size_mb:.1f} MB")
    print(f"  Cues: {len(cue_files)}/{len(manifest['cues'])}")
    print(f"  Events: {len(event_files)}/{len(manifest['events'])}")
    if missing:
        print(f"  Missing: {len(missing)} (zip built without them)")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice-source", type=Path, default=DEFAULT_VOICE_SOURCE,
                        help="voice-forge output dir (contains audio/, voices/, notices/)")
    parser.add_argument("--monolith", action="store_true",
                        help="build the legacy all-in-one conductor-demo.zip instead of minis")
    parser.add_argument("--out", type=Path, default=None,
                        help="(--monolith only) output zip path")
    args = parser.parse_args()

    manifest = load_manifest()
    if args.monolith:
        build_monolith(args, manifest)
    else:
        build_minis(args, manifest)


if __name__ == "__main__":
    main()

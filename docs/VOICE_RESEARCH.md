# Voice Quality Research

**Date:** February 16, 2026
**Phase:** 5 (final) of the Viral Distribution cascade
**Status:** Research only -- no production code changes

## Background

Conductor uses the browser's Web Speech API for all spoken cues. This works reliably -- even on iOS with screen locked -- but voice quality varies by platform. Safari in particular exposes only low-quality "compact" TTS voices. This document evaluates options for improving voice quality.

---

## 1. Piper TTS via WASM

### Current State

The original [rhasspy/piper](https://github.com/rhasspy/piper) repository is **archived and read-only** (last release: 2023.11.14-2). Development moved to [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl) under the Open Home Foundation (latest: v1.3.0, February 2026).

There is **no official WASM build**. All browser implementations are community-driven:

| Project | Description |
|---------|-------------|
| [diffusionstudio/piper-wasm](https://github.com/diffusionstudio/piper-wasm) | Core WASM compilation, most widely adopted |
| [diffusionstudio/vits-web](https://github.com/diffusionstudio/vits-web) | Higher-level JS API on top of piper-wasm |
| [Poket-Jony/piper-tts-web](https://github.com/Poket-Jony/piper-tts-web) | Independent impl with WebWorker + WebGPU |
| [sherpa-onnx](https://k2-fsa.github.io/sherpa/onnx/tts/wasm/index.html) | Separate C++ runtime that runs Piper ONNX models |

### Download Size

| Component | Size |
|-----------|------|
| piper-wasm (WASM + espeak-ng data) | ~18.8 MB |
| onnxruntime-web (WASM inference) | ~8 MB (3 MB custom build) |
| **Runtime total (before any voice)** | **~22-27 MB** |
| Voice model (medium, single-speaker) | ~63 MB |
| Voice model (high, multi-speaker) | ~75-137 MB |
| **Typical total first-load** | **~85-100 MB** |

Models are cached in IndexedDB/OPFS after first download and work fully offline thereafter.

### Web Worker Support

**Yes.** Multiple projects demonstrate Web Worker operation:
- Poket-Jony provides explicit `PiperWebWorkerEngine`
- clowerweb's demo uses a dedicated `tts-worker.js`
- jawebada published a streaming Web Worker example

Standard architecture: main thread (UI) + Web Worker (inference) + AudioWorklet (playback). Main thread stays responsive during synthesis.

### Latency

No published browser benchmarks exist. Estimates based on native performance:

| Platform | Estimated latency (short phrase) |
|----------|----------------------------------|
| Desktop browser (modern CPU) | 0.5-1.2 seconds |
| Mobile browser | 1-3 seconds |
| Native desktop (baseline) | ~0.4 seconds |

First inference is slower due to ONNX session initialization. Subsequent calls are faster via session reuse.

### Voice Quality

Piper uses VITS (neural end-to-end TTS). Quality is a clear step up from browser TTS compact voices, with four tiers (x_low, low, medium, high). Medium at 22.05 kHz is the recommended balance. Over 900 pre-trained voices are available across dozens of languages on [HuggingFace](https://huggingface.co/rhasspy/piper-voices).

### Licensing -- BLOCKER

**The Piper WASM runtime is effectively GPLv3.**

- espeak-ng (the phonemization backend) is GPLv3
- piper-phonemize wraps espeak-ng and inherits GPL
- WASM builds compile espeak-ng into the binary
- The successor project explicitly changed its license to GPLv3

This is **not compatible** with Conductor's distribution model (single HTML file, MIT-style freedom). Even loading Piper dynamically is legally murky under GPL interpretation.

A [piper-without-espeak](https://github.com/gudrob/piper-without-espeak) fork exists but is English-only, lower quality, and minimally maintained.

Voice model licenses vary per voice (CC BY 4.0, CC BY-NC-SA 4.0, Blizzard License). Models with CC BY 4.0 are freely redistributable but useless without the GPL-encumbered engine.

### Can Models Be Bundled in Resource Packs?

Technically yes -- a resource pack could contain a `.onnx` model file. But at 63-137 MB per voice model plus the 22-27 MB runtime, this is impractical for a lightweight PWA. The GPL licensing issue makes this moot regardless.

### Verdict: NOT RECOMMENDED for Conductor

The GPL licensing conflict is a hard blocker. The 85-100 MB download size is also incompatible with the project's lightweight ethos. The lack of an official WASM build and unverified iOS Safari support add further risk.

---

## 2. Pre-recorded Audio Cues

### Common Cues for Conductor Events

A "voice pack" for synchronized group actions would need:

| Category | Examples | Count |
|----------|----------|-------|
| Countdown numbers | "Ten" through "One" | 10 |
| Terminal actions | "Now!", "Go!", "Stop!", "Hold!", "Switch!", "Release!" | 6 |
| Preparation phrases | "Get ready", "Coming up next", "Stand by", "On my mark", "Here we go" | 10-15 |
| Composable building blocks | Action verbs ("wave", "clap", "jump"), directions ("left", "right"), connectors ("in", "to the") | ~20 |
| Pre-rendered compound phrases | "Wave right in 5", "Get ready to clap", "[Action] now!" | 40-60 |
| **Total** | | **~70-100 clips** |

### Interaction with Resource Pack System

The existing resource pack system already supports this perfectly:

```
voice-pack.zip
  manifest.json          # Pack ID, name, version, cue mappings
  voices/
    countdown-10.mp3     # "Ten"
    countdown-5.mp3      # "Five"
    countdown-1.mp3      # "One"
    trigger.mp3          # "Now!"
    notice-wave.mp3      # "Get ready to wave"
    ...
```

The `manifest.json` `cues` map links cue IDs to file paths. The existing `resourcePackResolver` in `audioService.js` already follows the fallback chain: pack audio -> TTS. No architecture changes needed.

### Size Budget

At MP3 64 kbps mono (optimal for speech):

| Pack Size | Clip Count | Average Duration | Total Size |
|-----------|------------|------------------|------------|
| Minimal | ~30 clips | 1.0 sec | ~250 KB |
| Standard | ~70 clips | 1.3 sec | ~700 KB |
| Full | ~100 clips | 1.5 sec | ~1.2 MB |
| Premium (128 kbps) | ~100 clips | 1.5 sec | ~2.5 MB |

**A complete 100-clip voice pack is ~1-1.5 MB.** This is very reasonable -- smaller than most website images.

### Audio Format

**MP3 is the only safe choice for universal compatibility.** Safari/iOS had incomplete OGG/Opus support until Safari 18.5 (2025). Older iOS devices stuck on earlier versions cannot play OGG at all.

Recommended encoding: MP3, mono, 64 kbps CBR, 22050 Hz sample rate. This is transparent (indistinguishable from higher bitrates) for speech content.

### AI Voice Generation Tools

Several tools can generate a complete cue set:

| Tool | Quality | Speed | License | Best For |
|------|---------|-------|---------|----------|
| **Kokoro (82M)** | Excellent | 96x real-time | Apache 2.0 | **Top pick** -- fast, tiny, #1 on HF Arena |
| StyleTTS2 | Excellent | Fast | MIT | Alternative if Kokoro voice doesn't suit |
| Bark (Suno) | Good (variable) | Moderate | MIT | Expressive cues ("Now!") |
| MeloTTS | Very good | Real-time | MIT | Multilingual packs |
| Tortoise TTS | Excellent | Very slow | Apache 2.0 | Maximum quality, if time permits |
| OpenVoice | Good | Moderate | MIT | Voice cloning from a reference |

**Commercial APIs** can also generate the full ~2,000 characters of cue text for free:

| Service | Cost for ~100 cues | Can Redistribute? |
|---------|-------------------|-------------------|
| Amazon Polly (neural) | $0 (free tier) | Yes -- most permissive, you own output |
| Google Cloud TTS | $0 (free tier) | Yes |
| Azure Speech | $0 (free tier) | Yes |
| ElevenLabs | $5 one-time (Starter) | Yes (paid plans only) |

**Coqui TTS note:** The company shut down December 2025. A community fork (`coqui-tts` on PyPI) is maintained by Idiap Research Institute.

### Verdict: RECOMMENDED -- Low-hanging Fruit

Pre-recorded cues are the simplest, most effective voice quality improvement. The resource pack system already supports them. A complete voice pack is ~1 MB. Multiple free tools can generate the audio. No code changes needed.

---

## 3. Browser TTS Voice Selection

### Current Voice Selection Logic

`audioService.js` lines 98-112 implement `chooseBestVoice()`:

```javascript
function chooseBestVoice(voices) {
    const enUS = voices.filter(v => v.lang.startsWith('en-US'));
    const enGB = voices.filter(v => v.lang.startsWith('en-GB'));
    const enAny = voices.filter(v => v.lang.startsWith('en'));
    for (const pool of [enUS, enGB, enAny]) {
        if (pool.length > 0) {
            const remote = pool.find(v => !v.localService);
            return remote || pool[0];
        }
    }
    return voices[0] || null;
}
```

This already prefers remote (network) voices, which is good. But it misses several opportunities.

### Voice Quality by Platform

| Platform | Best Available | Quality | Network? |
|----------|---------------|---------|----------|
| Chrome/Windows | "Google US English" | Good (cloud neural) | Yes |
| Chrome/macOS | "Alex" / "Google US English" | Good | Yes / No |
| Chrome/Android | Google TTS engine (neural) | Good | No (local neural) |
| Safari/iOS | "Samantha" (compact) | **Poor** | No |
| Safari/macOS | "Alex" (if downloaded) | Good | No |
| Firefox/Windows | "Microsoft David/Zira" | Poor-Medium | No |
| Firefox/macOS | "Alex"/"Samantha" | Medium-Good | No |

### Improvement Opportunities

**1. Name-based quality ranking.** The current code picks the first remote voice, or the first local voice. It could rank known high-quality voices by name:

```javascript
const qualityPatterns = [
    /^Google/i,                    // Tier 1: Chrome cloud voices
    /^Alex$/i,                     // Tier 2: macOS premium
    /^Samantha$/i,                 // Tier 3: macOS standard
    /^Microsoft.*Online/i,         // Tier 3: Windows neural (rare)
    /^Microsoft (David|Zira)/i,    // Tier 4: Windows standard
];
```

**2. Offline fallback for Chrome network voices.** Chrome's Google voices require internet. If the user is offline, they silently fail. Conductor should detect this:

```javascript
if (!navigator.onLine && selectedVoice && !selectedVoice.localService) {
    // Fall back to best local voice
}
```

**3. Rate tuning for low-quality voices.** Low-quality voices sound noticeably better at rate 0.9 vs the current 1.2. The rate could be adjusted based on detected voice quality.

**4. Text preprocessing.** Adding commas for natural pausing improves all voices:
- "Wave right in 5" -> "Wave right, in 5" (slight pause before countdown)
- Expanding abbreviations: "sec" -> "second", "min" -> "minute"

### iOS Safari -- No Fix Available

Apple restricts enhanced/premium/Siri voices to native apps. This is intentional platform differentiation and has not improved in iOS 16, 17, or 18. `getVoices()` exposes only compact voices regardless of what the user has downloaded in Settings.

**The resource pack system is the correct architectural answer for iOS voice quality.** There is no Web Speech API workaround.

### Chrome 15-Second Bug

Chrome silently stops speaking if a single utterance exceeds ~15 seconds. The standard workaround is periodic pause/resume. This is unlikely to affect Conductor's short cues but is worth noting.

### Verdict: MINOR IMPROVEMENTS POSSIBLE

The current voice selection is reasonable. A few targeted improvements (name-based ranking, offline fallback, rate tuning) could help, but the fundamental limitation on iOS is unsolvable via the Web Speech API. The real solution is resource packs with pre-recorded audio.

---

## 4. Hybrid Approach

### Could Resource Packs Contain Piper Models?

Technically possible but impractical:
- A single Piper model is 63-137 MB (vs ~1 MB for a complete voice pack of pre-recorded clips)
- GPL licensing of the runtime engine blocks Conductor from bundling or depending on it
- No verified iOS Safari support for Piper WASM
- The complexity of shipping a TTS engine vs. pre-recorded files is orders of magnitude different

### Recommended Fallback Chain

The best architecture is already what Conductor has, with one refinement:

```
1. Resource pack audio (pre-recorded clips in the pack)
   |
   v  (cue not found in pack)
2. Browser TTS with improved voice selection
   |
   v  (speechSynthesis unavailable)
3. Visual-only mode (text on screen, no audio)
```

This is exactly what `audioService.js` already implements. The `resourcePackResolver` tries the pack first, then falls through to TTS. No architectural changes needed.

### Voice Pack + TTS Hybrid

The most practical hybrid: a voice pack covers the ~30 most common cues (countdown, "Now!", preparation phrases) while TTS handles custom action names that can't be pre-recorded. This gives high-quality audio for the predictable parts and acceptable TTS for the dynamic parts.

Example flow for "Get ready to wave right":
1. Pack has `notice-wave-right.mp3`? Play it. Done.
2. Pack has `notice-wave.mp3`? Play it. Done.
3. Fall through to TTS: speak "Get ready to wave right"

This already works with the existing cue resolution in `resolveAudioCue()`.

---

## 5. Alternative: Kokoro TTS via WebGPU

One finding worth highlighting: [Kokoro-TTS](https://huggingface.co/hexgrad/Kokoro-82M) is a compact (82M parameter) model that:
- Ranks #1 on HuggingFace TTS Spaces Arena
- Runs at 96x real-time on GPU
- Uses Apache 2.0 license (no GPL issues)
- Has a ~300 MB model (vs Piper's 63-137 MB + 22 MB runtime)

A browser implementation exists that uses **WebGPU** for inference. However:
- WebGPU is **not supported on Safari/iOS** (Chrome 116+ and Edge only)
- 300 MB model download is still heavy for a PWA
- Would only benefit Chrome/Edge desktop users

This could be a future option if WebGPU support broadens, but is not viable for Conductor today given the iOS requirement.

---

## Recommendation

### Primary Strategy: Pre-recorded Voice Packs (RECOMMENDED)

**Why:** Simplest, most effective, already supported by the architecture.

1. **Create a "Conductor Standard" voice pack** with ~70-100 pre-recorded cues
2. **Use Kokoro (82M)** for generation -- Apache 2.0, best quality among free tools, fast
3. **Encode as MP3 64 kbps mono** for universal browser support including iOS
4. **Total pack size: ~1-1.5 MB** -- smaller than most website images
5. **Distribute as a zip** importable through the existing Pack Manager
6. **No code changes needed** -- the resource pack system already handles everything

### Secondary Strategy: Improve Browser TTS Voice Selection

**Why:** Free improvement for users without resource packs.

Targeted changes to `chooseBestVoice()`:
1. Rank known high-quality voices by name pattern
2. Add offline fallback for Chrome network voices
3. Consider rate adjustment (0.9 vs 1.2) for low-quality voices

This is a small code change (~20 lines) that improves the baseline experience.

### NOT Recommended

| Approach | Why Not |
|----------|---------|
| Piper TTS WASM | GPL licensing blocker, 85-100 MB download, unverified on iOS |
| Kokoro WebGPU in-browser | No Safari/iOS support, 300 MB model |
| Any in-browser neural TTS | Too heavy, licensing risks, iOS compatibility uncertain |

### Implementation Priority

1. **Voice pack creation** (separate project, not code changes to Conductor)
   - Use Kokoro or Amazon Polly to generate ~100 cues
   - Package as a resource pack zip
   - Publish alongside the app

2. **Voice selection improvements** (small code change, future plan)
   - Enhance `chooseBestVoice()` with name-based ranking
   - Add offline fallback
   - ~20 lines of code, low risk

3. **Voice pack format documentation** (already partially covered in CLAUDE.md)
   - Document recommended cue IDs for pack creators
   - Publish a "voice pack creation guide" so others can make packs too

---

## Summary

The existing architecture is sound. Resource packs are the right answer for voice quality -- they work on every platform, require no runtime dependencies, and the infrastructure is already built. The immediate next step is creating content (the voice pack itself), not writing more code.

Piper TTS via WASM is not viable for Conductor due to GPL licensing. Browser TTS improvements are worth making but won't fix the fundamental iOS quality gap. Pre-recorded voice packs are the clear winner: simple, small, universal, and already supported.

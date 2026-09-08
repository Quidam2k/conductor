# Killer-App Prototype — High-Bandwidth Cultural-Touchstone Demo (#4485 / suggestion 1720)

Date: 2026-09-07
Ask (Todd): a "super catchy from the get-go" flagship Conductor event that demonstrates
high-bandwidth *cultural-touchstone compression* (Darmok / "linguistic protein folding").
Each spoken reference should "detonate its full implications in the listener's head —
three paragraphs in three sentences, if not tighter."

Method Todd specified: SEED a large pool of high-recognition touchstones → PLUCK the most
recognizable AND pertinent → WEAVE into a short scored event where references chain to
compound meaning. Guardrail: below recognition threshold = a "shaka" miss (the reference
fails because the listener doesn't hold the codebook).

## The core insight this demo is built on
A touchstone is a *compression codec*. "Shaka, when the walls fell" carries three paragraphs
IF the listener shares the myth. Conductor is uniquely suited to exploit this because it plays
**synchronized** cues to a **crowd** — so the demo can be self-instantiating: the crowd hears
a touchstone about collective power *while being* a collective. Medium = message.

**Design principle that answers the shaka-risk: graceful degradation.** Write each touchstone
LINE so it (a) full-detonates for those who hold the reference, and (b) still carries a literal,
resonant meaning for those who don't. "It took six days to forget which you were" works with or
without knowing the Stanford Prison Experiment. This is the counter to Todd's own guardrail.

## Technical reality (must flag — do not let this ship silently as TTS-only)
- Conductor's pocket-proof (screen-locked) channel bakes ONLY beeps + **recorded pack voice cues**.
  TTS is screen-ON only. So the *shipping* version needs a resource pack of recorded touchstone
  lines (each line = one pack cue). The prototype/demo can run on TTS screen-on to prove the concept.
- "DJ / audio capabilities" for the music bed = a long pack audio cue (WAV bed) and/or layered
  pack cues. The `random` action type (emergent harmony) is the killer feature here: e.g. the
  "I'm Spartacus" line fired as `random` across N phones → a real rippling crowd-murmur of the
  line, different voices/takes — the crowd literally re-enacts the Spartacus scene.

---

## THEME A — "WE ARE MANY" (crowd-pleaser flagship; high recognition, self-referential)
Touchstones about the individual dissolving into the collective and the collective's power —
which is exactly what the crowd is DOING. Safest bet for "catchy from the get-go."

Seed pool: "I'm Spartacus" · Braveheart "FREEDOM / never take our freedom" · Network "mad as hell" ·
V for Vendetta "governments should be afraid of their people" / "remember the 5th of November" ·
Gandhi escalation ladder ("first they ignore you…") · Shelley "Ye are many — they are few" ·
MLK "free at last" · Rosa Parks (stayed seated) · Niemöller "first they came" · "torches & pitchforks".

Plucked (5): escalation ladder → I'm Spartacus → never take our freedom → mad as hell →
governments afraid of their people → we are many, they are few.

### Sample script (Theme A) — ~2 min, TTS-demo form
```
Title: We Are Many
Description: A scored crowd piece. Stand together. Screen on for the demo.
Start: 2026-09-15 7:00 PM

[TIMELINE]
0:00  [no-notify, no-countdown] (cello drone begins — held breath)
0:08  [no-notify] First they ignore you.
0:16  [no-notify] Then they laugh at you.
0:24  [no-notify] Then they fight you.
0:32  [emphasis, no-notify] Then you win.
0:40  [no-notify] I am Spartacus.
0:44  [no-notify] I am Spartacus.          # fire as `random` across phones → crowd murmur
0:52  [emphasis, haptic:triple, no-notify] They will never take our freedom.
1:00  [alert, no-notify] I am mad as hell —
1:05  [no-notify] — and I am not going to take this anymore.
1:14  [no-notify] People should not be afraid of their governments.
1:20  [emphasis, no-notify] Governments should be afraid of their people.
1:30  [countdown:5, no-notify] (five beeps — the crowd knows)
1:35  [emphasis, haptic:triple, no-notify] We are many. They are few.
1:44  [no-notify] (major chord resolves, sustained)
2:00  [no-notify, no-countdown] (silence — hold)
```

### Chain / ricochet (Theme A)
ignored→laughed→fought→won (escalation ladder primes "struggle that wins") → "I am Spartacus"
(the many protect one by becoming indistinguishable — individual dissolves into crowd; and the
crowd performing it re-enacts the scene) → "never take our freedom" (the stakes) → "mad as hell"
(emotional ignition / refusal) → "governments afraid of their people" (power inversion named) →
"we are many, they are few" (the QED — literally true in that moment; the crowd is the evidence).

---

## THEME B — "THE EXPERIMENT" (connoisseur; the psychology angle Todd seeded; higher bandwidth, higher shaka-risk)
The obedience/conformity experiments Todd named (Milgram's 37, Stanford Prison), stacked as
successive proofs of one thesis — situational conformity — then snapped by refusal.

Seed pool: Milgram ("the experiment requires that you continue" / 37 of 40) · Stanford Prison
(roles consume identity) · Asch conformity (line-length) · bystander effect / Kitty Genovese ·
Arendt "banality of evil" · Niemöller "first they came" · "just following orders".

Plucked (5): Milgram prod → 37 of 40 → Stanford roles → Asch → Niemöller → "break the circuit".

### Sample script (Theme B) — ~1:40
```
Title: The Experiment
Description: A scored piece on obedience — and the break. Screen on for the demo.
Start: 2026-09-15 7:00 PM

[TIMELINE]
0:00  [no-notify, no-countdown] (clinical metronome tick begins)
0:08  [no-notify] The experiment requires that you continue.
0:18  [no-notify] Thirty-seven of forty kept going.
0:30  [no-notify] Prisoner. Guard. It took six days to forget which you were.
0:44  [no-notify] Which line matches? — You knew. You said the wrong one anyway.
1:00  [emphasis, no-notify] First they came — and you said nothing.
1:12  [alert, haptic:triple, no-notify] Break the circuit.   # metronome STOPS here
1:20  [emphasis, no-notify] You always had the choice to stop.
1:30  [no-notify] (warm chord, held)
```

### Chain / ricochet (Theme B)
Milgram (you will obey) → 37/40 (and so did almost everyone) → Stanford (the role eats you) →
Asch (even your own eyes surrender) → Niemöller (here is the bill) → "break the circuit" (but
you can refuse; the metronome — the machine of obedience — literally stops) → "you always had
the choice." Each experiment is a different proof of the same thesis, stacking toward
inevitability, then broken.

---

## Recognition-rate table (estimates + why it clears / risks the threshold)
Threshold framing: >~70% concept-recognition = safe; 50–70% = carried by graceful-degradation
phrasing; <50% = shaka-risk, keep only if the line stands alone literally.

THEME A
| Touchstone | Est. recognition | Notes |
|---|---|---|
| "First they ignore you…then you win" | 70% | Ubiquitous activist meme; carries literally regardless of Gandhi attribution. |
| "I am Spartacus" | 85% | Meme-level even for non-viewers (parodied endlessly). The crowd-murmur staging is the payoff. |
| "never take our freedom" (Braveheart) | 80% | "FREEDOM!" is iconic; line carries stakes literally. |
| "mad as hell / not going to take this anymore" (Network) | 60% | Concept > attribution; the refusal reads plainly. |
| "governments should be afraid of their people" (V) | 70% | Strong Conductor-thesis line; V-mask cultural halo. |
| "we are many, they are few" (Shelley) | 55% as quote / ~95% by plain sense | Below quote-threshold but self-evident in a crowd; Occupy "99%" revival. The literal truth in the moment carries it. |

THEME B
| Touchstone | Est. recognition | Notes |
|---|---|---|
| Milgram "requires that you continue" / 37 of 40 | 55% | Cold institutional voice lands even without the name; the stat is the detonation. Shaka-adjacent — mitigated by phrasing. |
| Stanford Prison ("forget which you were") | 60% | Widely taught; the LINE works with zero prior knowledge. |
| Asch ("said the wrong one anyway") | 40% | **Shaka-risk.** Kept only because the line is fully self-contained literally. |
| Niemöller "first they came" | 70% | Broadly known; deliberately left unfinished so the crowd fills it. |
| "break the circuit" | n/a (original) | The turn/release; no recognition dependency. |

## Recommendation for Todd (react / pick)
- **Theme A** is the flagship-catchy, low-risk, self-referential choice — recommend as the demo.
- **Theme B** is the higher-bandwidth "linguistic protein folding" showcase but carries real
  shaka-risk (Asch especially); best as a second, "for the connoisseurs" piece or B-side.
- Open questions for Todd: (1) pick A, B, or a hybrid; (2) tone target — anthemic/uplifting (A)
  vs. unsettling-then-release (B); (3) OK to commit to recording a voice pack for the real
  pocket version, or keep it a screen-on TTS demo for now?

## Status
Plan-back submitted to Jarvis (event_type=question, low crit). Awaiting PROCEED / Todd's pick
before producing the final scored event + (if greenlit) the pack cue list. No code/repo changes yet.

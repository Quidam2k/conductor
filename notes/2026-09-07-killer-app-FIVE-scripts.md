# Conductor Killer-App — FIVE Touchstone Scripts (rank-ready)
#4486 (supersedes #4485) · suggestion 1720 · Todd's Darmok / "linguistic protein folding" hunt

**How to use this:** experience all five, rank 1–5, then draw a CUTLINE ("below this, not even
good enough to use"). That ranking + cutline is the eval. They are built for SPREAD on purpose —
theme, touchstone mix, tone, recognition, and compression-depth all vary — so the cutline actually
tells us where the approach shines and where it breaks.

## The one idea underneath all five
A touchstone is a *compression codec*. "Shaka, when the walls fell" delivers three paragraphs in
three words — **if** the listener holds the myth. Conductor is the perfect player because it fires
**synchronized** cues to a **crowd**, so a line about collective power detonates *while the crowd is
being one*. Medium = message.

**The move that beats the shaka-risk: graceful degradation.** Each line is written to (a) full-detonate
for people who hold the reference, and (b) still land literally for people who don't. "It took six days
to forget which you were" works with or without knowing the Stanford Prison Experiment. Where a line
can't degrade gracefully, that's the shaka-risk — flagged per script.

## Spread map (so the ranking has range to chew on)
| # | Script | Theme | Tone | Recognition | Compression-depth |
|---|--------|-------|------|-------------|-------------------|
| 1 | We Are Many | uprising / collective power | anthemic, rising | HIGH | HIGH — the thesis sweet spot |
| 2 | The Experiment | psychology of obedience | clinical dread → release | MID | HIGHEST (shaka-risk) |
| 3 | Shaka, When the Walls Fell | meta / Darmok itself | mythic, alien | POLARIZING | HIGH *if you hold it*, else near-zero |
| 4 | Tears in Rain | grief / memory | elegiac, tender | MID-HIGH | emotional depth (proves non-political range) |
| 5 | This Is Sparta | memes / one-liners | rowdy, party | VERY HIGH | LOW (recognition-candy — the anti-thesis probe) |

## Technical reality (flagging, don't let it ship as-is silently)
Conductor's screen-locked ("pocket") channel bakes only **beeps + recorded pack voice cues** — TTS is
screen-ON only. So the shipping version of any of these needs a **recorded voice pack** (each line = one
pack cue) plus a **music-bed pack cue** (a long WAV). These scripts are written TTS-demo form (screen-on)
to prove the concept; the music plans assume a pack bed. The `random` action type (emergent harmony) is
used where noted — different phones fire different takes of one line → a real rippling crowd-murmur.

---
---

# 1 · WE ARE MANY
*Uprising / collective power. Anthemic. The safe flagship — highest floor.*

**Seed pool:** "I'm Spartacus" · Braveheart "FREEDOM / never take our freedom" · Network "mad as hell" ·
V for Vendetta "governments should be afraid of their people" · Gandhi escalation ladder · Shelley
"Ye are many — they are few" · MLK "free at last" · Rosa Parks · Niemöller · torches-and-pitchforks.
**Plucked (6):** escalation ladder → I am Spartacus → never take our freedom → mad as hell →
governments afraid of their people → we are many, they are few.

```
Title: We Are Many
Description: A scored crowd piece. Stand together. Screen on for the demo.
Start: 2026-09-15 7:00 PM
[TIMELINE]
0:00  [no-notify, no-countdown] (cello drone in — a held breath)
0:08  [no-notify] First they ignore you.
0:16  [no-notify] Then they laugh at you.
0:24  [no-notify] Then they fight you.
0:32  [emphasis, no-notify] Then you win.                          # drum enters
0:40  [no-notify] I am Spartacus.
0:44  [no-notify] I am Spartacus.                                  # fire as `random` → crowd murmur ripples
0:52  [emphasis, haptic:triple, no-notify] They will never take our freedom.
1:00  [alert, no-notify] I am mad as hell —
1:05  [no-notify] — and I am not going to take this anymore.
1:14  [no-notify] People should not be afraid of their governments.
1:20  [emphasis, no-notify] Governments should be afraid of their people.
1:30  [countdown:5, no-notify] (five ascending beeps — the crowd knows)
1:35  [emphasis, haptic:triple, no-notify] We are many. They are few.
1:44  [no-notify] (full major chord blooms, sustained)
2:00  [no-notify, no-countdown] (cut to silence — hold)
```
**Music plan:** lone cello drone (0:00) → a single struck drum at "Then you win" (0:32) → the drum
becomes a heartbeat pulse under the Spartacus murmur → strings stack one note per line through
1:00–1:20 (each touchstone adds an instrument, so the *arrangement* thickens exactly as the *crowd*
thesis builds) → countdown beeps ride over a suspended chord → the chord RESOLVES on "we are many"
(1:35) → sustained major bloom → silence. The band = the crowd; both fill in as the piece goes.

**Recognition:** ladder 70% (meme, carries literally) · I am Spartacus 85% (meme-level even for
non-viewers; the crowd-murmur staging is the payoff) · never take our freedom 80% · mad as hell 60%
(concept > attribution) · governments afraid 70% (V-mask halo) · we are many/they are few 55% as quote
but ~95% by plain sense (Occupy "99%" revival; the line is literally *true* in the moment). **All clear.**

**Chain:** ignored→laughed→fought→won primes "a struggle that wins" → "I am Spartacus" (the many hide
one by becoming one — and the crowd performing it *re-enacts the scene*) → "never take our freedom"
(stakes) → "mad as hell" (ignition/refusal) → "governments afraid of their people" (power inversion
named) → "we are many, they are few" (QED — the crowd standing there is the evidence).

---
---

# 2 · THE EXPERIMENT
*Psychology of obedience — and the break. Clinical dread to catharsis. Highest bandwidth, real shaka-risk.*

**Seed pool:** Milgram ("the experiment requires that you continue" / 37 of 40) · Stanford Prison ·
Asch conformity (lines) · bystander effect / Kitty Genovese · Arendt "banality of evil" · Niemöller ·
"just following orders." **Plucked (6):** Milgram prod → 37 of 40 → Stanford → Asch → Niemöller →
"break the circuit."

```
Title: The Experiment
Description: A scored piece on obedience — and the break. Screen on for the demo.
Start: 2026-09-15 7:00 PM
[TIMELINE]
0:00  [no-notify, no-countdown] (clinical metronome tick begins — 60 bpm)
0:08  [no-notify] The experiment requires that you continue.
0:18  [no-notify] Thirty-seven of forty kept going.
0:30  [no-notify] Prisoner. Guard. It took six days to forget which you were.
0:44  [no-notify] Which line matches? You knew. You said the wrong one anyway.
1:00  [emphasis, no-notify] First they came — and you said nothing.
1:12  [alert, haptic:triple, no-notify] Break the circuit.       # metronome STOPS dead here
1:20  [emphasis, no-notify] You always had the choice to stop.
1:30  [no-notify] (one warm sustained chord, held)
```
**Music plan:** a cold metronome/sine tick is the ONLY sound under the whole obedience section — it is
the machine of compliance made audible, and it never wavers as the horrors stack (that flatness is the
dread). At "Break the circuit" the metronome cuts to **silence** mid-tick — the single most important
audio event in the piece. Then a warm major chord fades up into the void it left. No melody until the
break; the reward for refusing is the first *human* sound in the piece.

**Recognition:** Milgram prod / 37 of 40 55% (the cold institutional voice lands even without the name;
the *statistic* is the detonation — shaka-adjacent, mitigated by phrasing) · Stanford "forget which you
were" 60% (widely taught; line works with zero prior knowledge) · Asch "said the wrong one anyway" **40%
— shaka-risk**, kept only because it's fully self-contained literally · Niemöller 70% (left unfinished so
the crowd fills it) · "break the circuit" original (no dependency). **The eval question this script asks:
does the highest-bandwidth entry survive its own recognition risk, or land below the cutline?**

**Chain:** Milgram (you'll obey) → 37/40 (and so did nearly everyone) → Stanford (the role eats you) →
Asch (even your own eyes surrender) → Niemöller (here's the bill) → "break the circuit" (but you can
refuse — the machine literally stops) → "you always had the choice." Five different proofs of one thesis,
stacked toward inevitability, then snapped.

---
---

# 3 · SHAKA, WHEN THE WALLS FELL
*Meta. The touchstone piece ABOUT touchstones — it speaks in Tamarian. The deliberate gamble that
probes the thesis itself. Will be polarizing in the ranking; that's the point.*

**Seed pool (all from TNG "Darmok"):** "Darmok and Jalad at Tanagra" (enemies unite vs. a common foe) ·
"Temba, his arms wide" (a gift, giving) · "Shaka, when the walls fell" (failure, collapse) · "Sokath,
his eyes uncovered!" (sudden understanding) · "Darmok and Jalad on the ocean" (two who fought together,
now bonded). **Plucked (5): all of them** — the whole point is to run the codec end to end.

```
Title: Shaka, When the Walls Fell
Description: A myth told in a language of myths. Stand with a stranger. Screen on.
Start: 2026-09-15 7:00 PM
[TIMELINE]
0:00  [no-notify, no-countdown] (wind / open-ocean ambience, no melody — an alien shore)
0:10  [no-notify] Darmok and Jalad. At Tanagra.
0:22  [no-notify] Temba. His arms wide.                            # a rising, offering figure
0:34  [emphasis, no-notify] Shaka. When the walls fell.           # everything drops out — silence 3s
0:48  [alert, haptic:triple, no-notify] Sokath! His eyes uncovered!   # sudden bright chord — the aha
1:00  [emphasis, no-notify] Darmok and Jalad. On the ocean.
1:12  [no-notify] (the ocean ambience returns, now with a warm drone under it)
1:25  [no-notify, no-countdown] (silence)
```
**Music plan:** deliberately WITHOUT a tune for most of it — wind and water, so the *words* are the only
figures on an empty ground (mirrors the Tamarians having no vocabulary but myth). "Temba, his arms wide"
gets a single rising string gesture (arms opening). "Shaka" drops EVERYTHING to raw silence — the walls
falling = the music falling. "Sokath, his eyes uncovered" is the ONLY bright, resolved chord in the piece
— understanding arrives as the first harmony. Closes back on the ocean, but now a warm drone underneath:
the two strangers are bonded, the shore is no longer empty.

**Recognition — this is the whole gamble:** among people who know "Darmok" (Trek fans + the phrase has
leaked widely via the famous "Shaka, when the walls fell" essay and meme), ~35–50% and for THEM the
bandwidth is enormous — five phrases carry an entire hour of TV and a theory of language. Among everyone
else: **near-zero recognition — a textbook shaka-miss.** BUT partial graceful degradation exists: the
*shape* still reads (offering → collapse → sudden light → union) even as pure sound-poetry. **This script's
job in the eval is to sit right on the cutline and show us exactly where recognition-dependence breaks.**

**Chain:** Tanagra (two enemies must unite) → Temba/arms wide (one offers) → Shaka/walls fell (the attempt
fails, the low point) → Sokath/eyes uncovered (they suddenly *understand each other*) → on the ocean (now
allies). It's the arc of the whole episode — and the arc of the crowd learning to read touchstones at all.

---
---

# 4 · TEARS IN RAIN
*Grief / memory. Elegiac, intimate — proves the technique isn't only for uprisings. A vigil piece
(pairs with the existing "Lights Out" demo — phones as candles).*

**Seed pool:** Blade Runner "like tears in rain / time to die" · E.T. "I'll be right here" · Dylan Thomas
"Do not go gentle / rage against the dying of the light" · Vonnegut "So it goes" · "To live in hearts we
leave behind is not to die" · Lion King "he lives in you." **Plucked (5):** tears in rain → I'll be right
here → do not go gentle → so it goes → he lives in you.

```
Title: Tears in Rain
Description: A vigil. Raise your phone light. Screen on — let it glow.
Start: 2026-09-15 8:30 PM
[TIMELINE]
0:00  [no-notify, no-countdown] (soft piano, single notes, wide space)
0:10  [no-notify] All those moments will be lost in time...
0:18  [emphasis, no-notify] ...like tears in rain.
0:30  [no-notify] I'll be right here.                             # (a fingertip; a promise)
0:44  [no-notify] Do not go gentle.
0:50  [emphasis, haptic:double, no-notify] Rage against the dying of the light.
1:04  [no-notify] So it goes.                                      # the piano rests a beat
1:16  [emphasis, no-notify] He lives in you.
1:28  [no-notify] (strings swell warm under the piano, then settle)
1:45  [no-notify, no-countdown] (a single held note, fading)
```
**Music plan:** solo piano, lots of air — grief needs space, not a wall of sound. "Tears in rain" leaves
the piano hanging on an unresolved note. "Rage against the dying of the light" is the one moment the piece
lifts its voice — a swell, then it recedes (you can't sustain rage; grief pulls it back). "So it goes"
literally stops the music for a breath (Vonnegut's shrug). "He lives in you" brings strings up warm for
the only full resolution. Candle-light staging: fire the whole thing as gentle, no alerts except the one
haptic on "rage" so the *body* feels the single defiant beat.

**Recognition:** tears in rain 65% (meme-famous monologue) · I'll be right here 70% (E.T.'s glowing
finger is iconic) · do not go gentle 70% (the most-quoted villanelle in English; Interstellar boosted it)
· so it goes 50% (Vonnegut/Slaughterhouse — mid, but degrades perfectly: it reads as a plain sigh) · he
lives in you 55% (Lion King). **All clear or gracefully degrading.** Emotional payload survives even where
the *source* isn't placed — which is the point of including a non-political entry.

**Chain:** tears in rain (everything is lost) → I'll be right here (but presence persists) → do not go
gentle / rage (refuse the loss) → so it goes (…and yet, acceptance) → he lives in you (the resolution:
the dead persist in the living). Denial → defiance → acceptance → continuance — the grief arc, in five
lines.

---
---

# 5 · THIS IS SPARTA
*Memes / movie one-liners. Rowdy, call-and-response, party. VERY high recognition, LOW depth — the
deliberate anti-thesis probe. Tests: does the machine still delight when the payload is pure dopamine,
not "three paragraphs"? A flash-mob crowd-igniter.*

**Seed pool:** "This is Sparta!" (300) · "I'll be back" (Terminator) · "You shall not pass!" (LotR) ·
"May the Force be with you" · "Here's Johnny!" · "It's over 9000!" · Wilhelm scream · "Wubba lubba dub
dub" · "Say hello to my little friend." **Plucked (5):** This is Sparta → You shall not pass → I'll be
back → may the Force be with you → (crowd yells back).

```
Title: This Is Sparta
Description: Loud, dumb, together. Yell along. Screen on, sound UP.
Start: 2026-09-15 9:00 PM
[TIMELINE]
0:00  [no-notify, no-countdown] (a big cinematic BRAAAM — Inception horn)
0:06  [alert, haptic:triple, no-notify] THIS. IS. SPARTA!         # crowd is meant to yell it back
0:14  [no-notify] (Wilhelm scream — someone "falls in the pit")
0:20  [alert, haptic:double, no-notify] You shall not PASS!
0:30  [no-notify] I'll be back.                                   # (comic beat — deadpan)
0:38  [emphasis, no-notify] May the Force be with you.
0:44  [countdown:3, no-notify] (three beeps — everybody wind up)
0:47  [alert, haptic:triple, no-notify] IT'S OVER NINE THOUSAND!  # the release — max energy
0:54  [no-notify] (BRAAAM reprise + cheer bed)
1:05  [no-notify, no-countdown] (cut — laughter)
```
**Music plan:** all bombast, no subtlety — the Inception BRAAAM as a recurring stinger, a Wilhelm scream
as a literal punchline, an air-horn/riser into "over nine thousand," and a crowd-cheer bed to close. This
is the DJ-drop-the-beat mode of Conductor. Fire the big lines as `random` so a stadium's worth of phones
yell "THIS IS SPARTA" in a ragged, hilarious near-unison — the imperfection is the joy.

**Recognition:** This is Sparta 90% · You shall not pass 88% · I'll be back 92% · May the Force be with
you 95% · It's over 9000 70% (skews younger/online). **Highest recognition of all five, by far —** but
each detonates a *vibe*, not three paragraphs. **The eval question: is recognition-candy above or below
Todd's cutline?** If a piece this catchy-but-shallow ranks high, "catchy from the get-go" and "high-
bandwidth compression" are partly separable goals — worth knowing. If it ranks low, depth is the real
currency.

**Chain (loose by design):** it doesn't compound meaning — it *stacks hype*. Sparta (aggression) →
Wilhelm (slapstick undercut) → you shall not pass (defiance) → I'll be back (comic cool) → the Force
(benediction) → over 9000 (blowoff). The "chain" is an energy curve, not an argument — which is exactly
what makes it the useful outlier in the set.

---
---

## What the cutline will tell us
- If **1 (We Are Many)** tops it → the sweet spot is *high-recognition + self-referential collective themes*. Build the killer app there.
- If **2 (The Experiment)** survives despite Asch → depth beats recognition; lean into connoisseur bandwidth.
- Where **3 (Shaka)** lands → the exact price of recognition-dependence, measured.
- If **4 (Tears in Rain)** ranks high → the technique generalizes past politics (vigils, memorials, weddings) — much bigger market.
- If **5 (This Is Sparta)** ranks high → "catchy" and "deep" are separable; a party mode is its own killer app.

## Status / next
Deliverable = these 5 rank-ready scripts (this file). No repo/code changes. Awaiting Todd's ranking +
cutline. On greenlight of any script: produce final scored event JSON/txt + the recorded voice-pack cue
list (each line → one pack cue) + music-bed WAV spec so it runs pocket-proof.

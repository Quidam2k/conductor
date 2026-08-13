# Jessica session — 2026-08-11 (56 min)

Source: `input/jessica-2026-08-11-session/transcript.md` (914 segments, faster-whisper
large-v3, both Craig tracks interleaved). Recording started 2026-08-12T00:58Z.

This is the call that produced v55 and v56 — Todd relayed findings to the bot live, so
most of the technical content is already in `2026-08-11-v55-merged-group-preps.md`. What
follows is what the transcript adds **beyond** what got shipped that night.

## The gate cleared (in-session, on the rebuilt pack)

At [30:43]–[33:49] Jessica ran practice with the screen off, iPhone, and reported:

> "Get ready to freeze, hold your position in robot voice, but then I'm hearing the beeps
> correctly and hold your position in my voice." … "Freeze was in my voice." …
> "The screen's still off. Well, this is an improvement."

That is **her recorded pack voice playing from the baked track in a locked pocket** — the
question the whole evening was built around, answered green. The robot voice she kept
insisting she heard with the screen off was the merged prep, not a TTS-survives-lock
counterexample; she was right about hearing it and right that it was robotic, and the
earlier reasoning that dismissed it was wrong. Both v55 and v56 came out of that exchange.

Preceding it: the v53 MP3 slimming had produced files Safari's `decodeAudioData` refuses,
all six recorded cues failed to decode, everything fell back to TTS, TTS can't be baked,
so the bake was beeps-only — which she described as "buzzes," "like hitting a drum with a
little metal brush." Rebuilt pack (artifact labelled v54) fixed it mid-call.

## NEW — Todd's directives to "the bot reading this transcription later"

Two things he said explicitly for the transcript that are **not** in any note or memory:

### 1. Script overlap warning — a quality check in the editor [37:40]–[38:40]

> "We should make a point of making it hard for people to make scripts that step on its own
> toes. We should have some sort of like quality check in there to warn people saying, hey,
> this doesn't make a whole lot of sense, because you're trying to do two things at once, or
> these overlap."

Context: he'd just diagnosed The Stillness's timing problems as a *script* fault, not an
engine fault ("I think that that is just a fault of the script"). This is an editor feature
request, unscheduled, and it belongs with the Grandma Test editor work.

### 2. Enumerated group prep + per-cue beep bursts [41:47]–[45:53]

He re-raised a design he believes was agreed earlier and asked the bot to find it in memory
and re-ingest it:

> "Get ready to do things one, two, and three, and then you hear beep beep beep thing one,
> beep beep beep thing two, beep beep beep thing three. So that way we can have things closer
> to each other without necessarily stepping on each other's toes. Now if it's so close that
> we don't have enough time for all the beeps, then maybe we only have a couple of beeps."

**This is in direct tension with what v55 shipped hours later.** v55 replaced the enumerated
prep with the group **leader's** recorded notice — "Get ready to freeze," dropping the "and
hold your position" tail — precisely because an enumerated sentence is assembled at runtime,
which makes it TTS-only, which makes it unbakeable, which makes it *silent in the pocket*.
Todd accepted that trade in-session at [34:00] ("we lose the tail, which costs nothing since
hold is marked"), then argued for enumeration as the general principle seven minutes later.

Both positions are coherent; they optimise different things. Enumeration names every cue but
can't survive lock. Leader-only survives lock but names one cue. **The reconciliation Todd
himself points at is recording:** if the author records the group prep as a clip, it bakes and
it enumerates. That requires the recorder to prompt for a *group* prep — which is exactly
Jessica's next complaint, and which neither v55 nor v56 implements.

The beep half is largely already built: v41 capped countdown beeps at 3, and beats are
filtered to fit gaps between close cues.

## NEW — UX findings from watching Jessica

- **[40:08] The recorder never prompts for the "get ready to."** Her words: *"How would I do
  the, like, get ready to part and whatever? It's not prompting me to do that. It just says,
  put the next cue."* Todd's follow-up at [40:19] and again at [41:47] is an explicit ask that
  the recorder prompt for "the interstitial stuff like the get ready to and other sorts of
  things that aren't themselves audio cues." Note she was on a pre-v56 build; v56 added a
  per-action card that *says* when a prep can't fire — verify against v56 before acting, but
  the "prompt me for the group prep" gap is real regardless.
- **[28:58]–[29:23] She could not find the pack delete button.** *"I see them, but, like, I
  can't figure out how to delete them."* Took ~30 s of Todd talking her through it. Third
  discoverability complaint from her in three sessions.
- **[26:31]–[29:33] Artifact caching confusion** — she and Todd saw different version labels
  on the same refreshed artifact link (he saw v53 repeatedly while telling her it should say
  v54), which cost several minutes and nearly had her testing the wrong pack.

## ⚠ NEXT WEEK'S PLAN HAS A BROKEN STEP

The agreed homework [38:54]–[40:08]: each writes a script, records every cue **including the
"get ready to" interstitials**, renames the pack, and next week they test each other's. Good —
that's the plan already in the notes.

The **beam test as described will not work**:

> "We can each post the screenshot of the QR code and then we can each scan the QR code and
> test out, hey, was I able to import Jessica's pack just by scanning the QR code that she
> posted?"

QR beam is an **animated** transfer. `startBeamLoop()` runs `setInterval(renderBeamFrame, …)`
at 5–10 fps, emitting a different LT fountain frame each tick; the receiver accumulates frames
until it has enough blocks to peel the payload. One screenshot is one frame — ~900 bytes of a
payload that is tens of KB. Posting a still image cannot transfer a pack, and no amount of
scanning it will complete.

Todd's stated mental model at [41:43] — *"the QR code isn't itself a link, it is the data
itself"* — is true of a beam frame and false of the event QR (which **is** a URL). Both halves
of that need correcting before next week or the session burns on a test that can't pass.

**What they can actually do:**
- **Swap packs remotely:** export the pack zip and send the file. They said themselves they'll
  have internet ([40:57]), so the beam isn't needed for the swap — it's for no-signal, in-person.
- **Swap events remotely:** the event QR/code works fine posted as a screenshot; it's a single
  static code, and each will have a script the other lacks.
- **Test the beam properly:** two phones in the same room, one screen beaming live to the other's
  camera. That is still the unmeasured item in `2026-08-06-beam-field-test.md`, and it stays
  unmeasured until they're physically co-located.

## Non-Conductor

Rough week for Todd (family conversation re: Thanksgiving; a convincing debt-collection scam
call). Piano going well. Jessica's slowcontinuum.com project is having model-dependent
reliability trouble with agents refusing to self-submit a form; Todd offered to look at Google
indexing problems on it. Witchlight cancelled this week.

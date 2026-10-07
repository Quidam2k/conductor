# 2026-10-06 Jessica session — touchstone rating feedback (processed)

Source: Craig recording `craig_3Mf2hY7okOO5` → `../input/jessica-2026-10-06-session/transcript.md`
(faster-whisper large-v3; ADTS .aac decoded clean this time). Rating talk runs ~[35:00]–[01:14:00].

## Ingest
- Issues #3 (@Teafaerie, 147 lines) and #4 (Todd, 123 lines) ingested into `data/touchstone-ratings.json`.
- Todd's rule for these two issues: untouched = ignore; **tag edit with no stars = 3**
  (3 such lines, recorded as `tagOnlyAsThree` on each ingest record).
- Result: 155/184 rated. **130 of the 155 averaged 5.0**, because both raters switched to a
  "five-star sweep" near the end. The stars barely tell good from bad here; the spoken comments
  below carry more.
- Lowest (2.0): never-take-our-freedom (Mel Gibson), temba, sokath, darmok-jalad-tanagra,
  he-lives-in-you, i-see-dead-people. 3.0: rosa-parks, torches-and-pitchforks. 3.5: ye-are-many.
- Unrated (29): the psych descriptors (stanford-prison, asch, bystander, banality-of-evil), most ad
  slogans, several later film/TV lines, Gangnam Style, seven-nation-army.

## Rate-page asks (beyond v2 = notes + quotes + autosave)
1. **Show the actual quote** for descriptor entries — "Gandhi escalation ladder" got 4 instead of 5
   only because nobody recognized it from the label. (Already in the v2 plan as `context`.)
2. **Free-text notes** — per entry and general. (Already in the v2 plan.)
3. **Explicit skip / "don't know it" (N/A)** that is NOT read as a 3. Todd wants "I don't know it"
   recorded as a distinct signal, and only once he can see the full quote.
4. **Two rows of stars**: *how well known* vs *how much I'd use it / love it*. ("I didn't know it, but
   now I do and I love it" = 1 for known, 5 for love.) Optional second row; don't make people click more.
5. Half stars (a wish, low priority).
6. Work should survive across devices / when signed in, and a resubmit should "add to the same issue".
   (Today: localStorage on that one browser; a resubmit makes a new issue and the latest wins per rater.)

## Generation lessons for the next batch (beyond 184)
- **A cliché is good.** The more cliché a line is, the faster it unpacks in your head. Don't mark a line down for being overused.
- **Quotes > descriptors.** Rosa Parks, Stanford Prison, Asch, torches & pitchforks are touchstones
  but not lines you can drop into a script. Either replace them with a real quotable line that points at
  them, or keep only idioms that work spoken as-is ("torches and pitchforks" passes).
- **Recognition floor holds:** Darmok family = niche (2★), keep only Shaka. Obscure-but-great lines
  (Ye are many, escalation ladder) get dinged until the quote is shown.
- **Watch for baggage:** a source tied to someone toxic (Braveheart/Gibson) or a work with racist
  associations (Gone with the Wind) gets marked down, even when the line itself is fine. New tag:
  `potentially-problematic`. Creepy subtext ("How you doin'") is a no.
- **Flash-mob fit and visuals matter**: Jessica asks "can you see it in a flash mob?" ("King of the
  world": someone leaning out, a strong visual). Some well-known lines just don't fit (I see dead people).
- **Corporate slogans:** keep the ones that have become cultural phrases ("Just Do It", "Think
  Different", "Be All You Can Be", "Taste the Rainbow" for pride). Skip anything that is just a product name.
- **Songs as clips / sing-alongs**: crowd-participation hooks (Sweet Caroline's "bah bah bah", Seven Nation
  Army chant) suit clip-mode events where people sing along. Some songs only work if sung.
- **Call-and-response** lines (More Cowbell) are a useful category; the line splits into two halves.
- Too long = skip (box of chocolates). Known but not well known by the rater = skip (Gangnam Style).
- **Tag vocabulary the crowd added**: solidarity, rage, energetic, anti-authoritarian, authoritarian,
  racism, nonviolence, violence (≠ `military`, Todd wants both), crime, nazi, escalation, star-trek,
  metaphor, ai, robot, time, wwii, the-south, pride, call-and-response, potentially-problematic.
  Fold `raceism`→racism, `violent`→violence.

## Use case (Todd's framing, for docs)
The library is a "basic Lego set" or "box of crayons" of high-density cultural metaphors. A script
author drops one in every so often, like **coming up for air**, to win back a crowd that has started
to glaze over. The killer-app script ("a hit song for Conductor") is built from these.

## Side ideas (parked → IDEAS.md)
- Letter props beyond umbrellas: snap-open folding fans (loud and visual), paper lanterns, balloons
  (can be popped), each person holding a few colors/letters cued "unfurl blue" to spell words.
- Promo video via the MiniMax/image-gen pipeline; needs a tight script or it reads as AI slop.

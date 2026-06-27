# TypeQuest working context (living document)

The shared strategic scratchpad: recent activity, open questions, and the decision log
with the REASONING behind each call, so a future session inherits the why and does not
"simplify" a deliberate choice back to its naive form. The locked/architectural
decisions and the schema invariants themselves live in `HANDOFF.md` and
`docs/schemas.md`; this file holds the running thread and the rationale.

<!-- AUTHORED — DO NOT REGENERATE BELOW -->

## Decision log

### 2026-06-24 - Safety gate is a per-locale content hash, not a boolean

`StoryNode.safetyReview` holds, per content locale, an `approvedContentHash` (plus
`date` and `criteriaVersion`) rather than an `approved: boolean`. Invariant 7: for each
shipped locale a review record must exist whose hash matches the recomputed hash of the
node's resolved prose; the linter recomputes and compares.

Rationale (verbatim from Tom -- do NOT re-simplify back to a boolean):

> Replace approved: boolean with approvedContentHash (a hash over the node's resolved
> prose). Keep date and criteriaVersion. Keep the field required on StoryNode. The
> reason: a boolean stamps the node id, but the child reads the resolved prose, so when
> prose changes under a stable textKey (the normal case in generate-and-curate), the
> boolean stays green and ships un-reviewed text. The hash diverges when prose changes,
> forcing re-review.
>
> Make the hash per-locale, not per-node. One hash per rendered string per locale, so a
> Flemish edit re-triggers only the Flemish review and leaves a future French approval
> intact (same per-graph-not-global instinct as invariant #3).

Untouched by this change (correct as-is, do not second-guess): invariants #8 and #9,
the `band: 'band-1'` tag, the lowercase / no-Shift consequence, and the
curriculum/story decoupling. `criteriaVersion` stays a stub -- a genuine future
conversation, not this change.

### 2026-06-24 - band-1 target = age 6 (provisional), drills deferred, maxWordLen 7 provisional

The first real band-1 arc (`content/band-1/band1_arc.ts`) targets age 6, to test the
6yo band machinery; older bands come later. Track-1 motor DRILLS were deliberately NOT
authored alongside it: pairing drills with AZERTY reactivates the
home-row-has-no-vowels problem already logged, and that does not need resolving yet.

Band-1 spec is provisional: all-lowercase (locked) + simple Flemish + `maxWordLen: 7`
(replacing the example's placeholder 10, which was tuned looser). The earlier example
band was renamed `band-1` -> `example-band` so there is exactly one authoritative
band-1 spec.

Evidence for the length-vs-familiarity question (resolved 2026-06-25, see decision log): writing readable 6yo Flemish
within 7 chars was mostly fine, but it forced `overkant` (8) -> `andere kant` and
`gevonden` (8) -> `vindt`, and pushed `rammelt` to sit exactly at the ceiling (7).
7 still admits common kid-fantasy words (ridder, skelet, zwaard, kasteel, monster,
prinses) but blocks others (avontuur, gevonden, overkant, tovenaar). So 7 is workable
but not free -- real evidence that a pure length cap has a vocabulary cost.

### 2026-06-25 - Length-vs-familiarity: RESOLVED as a per-band balance, not one rule

Not an open "length cap vs familiarity, pick one" question. Resolution (from playing
band-1): difficulty is a balance managed per level. `maxWordLen: 7` sits at a good point
for the first / typing-first levels -- simple short words serve typing practice and make
good test material -- without being a permanent or universal rule. The balance point
moves for higher bands, where longer familiar words earn their place. Free to vary
because `maxWordLen` is per-band metadata, not a global. Stays live only for later bands.

### 2026-06-25 - Typing-reactive graphics v1: DONE (aliveness, not a second progress signal)

The character animates from observed state + hysteresis (borrowed from the reference's
`render/locomotion.ts`), NOT from raw keypresses. In-place animation -- walk/idle/arrived
gated by active-typing -- NOT literal scene travel. Record this as a POSITION, not a
deferral: the reveal window already carries narrative forward-progress, so the
character's job is aliveness, not a second (weaker, janky-on-placeholders) progress
signal. Literal travel is not planned unless a real reason emerges that the reveal is not
already doing the progress job.

### 2026-06-25 - SceneActivity { progress, activity, intensity }: the multi-input junction, DONE

One struct the renderer reads; each signal writes its own field -- `progress` now
(typing), `activity` later (word-meaning, v2/3), `intensity` reserved/neutral now
(per-profile typing level). Adding the level signal later sets one field, with no new
path into the renderer.

### 2026-06-25 - Keyboard layout lifted to its own axis: CLOSED

Was the open item "lift the layout out before the test arc is deleted." Now
`keyboard/be-azerty.ts`; content no longer owns a layout, so deleting throwaway test
content can't break real content's keyboard. Resolved.

### 2026-06-25 - Band ids are a managed namespace

Three distinct band ids -- `example-band` (illustration), `test-band` (engine
validation), `band-1` (real) -- after catching two `band-1` and two `be-azerty`
collisions. Band ids are now a managed namespace: unique and meaningful, not decorative,
so future bands do not collide by accident.

### 2026-06-26 - Real CC0 models + reference-borrowed render techniques

The band-1 slice now renders real CC0 art (6 GLBs) instead of placeholder boxes. Models
are pulled from the reference project's vetted packs and resolved through the
AssetVocabulary BY ID -- descriptors still carry ids, never model paths, so the
content<->asset decoupling is intact; a missing/failed model falls back to the visible
red placeholder (invariant #1). Lighting + ACES tone mapping, locomotion hysteresis, clip
selection (AnimationMixer), and height-fit scaling were all borrowed from the reference
rather than invented (extracted by running analytical sub-agents over it).

ADAPTED, NOT COPIED -- flag for future sessions: the reference's locomotion assumes real
WORLD-DISPLACEMENT (it samples how far an entity actually moved). We feed it
PROGRESS-DERIVED, in-place motion (typing advances a number, not a world position), so the
borrowed locomotion code does something subtly different from its origin -- do not assume
reference behaviour transfers 1:1. (This also UPDATES the 2026-06-25 "aliveness, not a
second progress signal" position: literal scene travel was later added on top of the
in-place animation -- a reason emerged, the visuals wanted it.)

### 2026-06-26 - Three seam reads added to IGameView (progress, nodeId, ending)

`IGameView` gained `progress`, `nodeId`, `ending`. All three are PURE DERIVATIONS of
game/run state that the renderer reflects -- the view asks core "what is true," never "do
render work," so they are legitimate, not seam creep. GUARD for future sessions: a new
seam read that returns RENDER-SHAPED data (colours, positions, animation clip names,
camera angles) WOULD be the creep this isn't -- reject those. The renderer derives its own
visuals from the declarative state; it does not receive them through the seam.

### 2026-06-26 - Render-side scene composition is deliberately imperative (for now)

Scene staging for band-1's two scene types (treelines, path, water, travel path, threat
choreography, chest placement) is hand-coded in the composer, not data-driven. That is
CORRECT while there is one consumer per scene type -- it is NOT debt yet. Do not build the
already-logged anchor-default-composition system early, and do NOT add unit tests for
hand-placed staging (they would only pin arbitrary constants). TRIGGER to promote it to
the data-driven system: authoring a SECOND scene of an already-composed type (a second
forest layout, a second dungeon). That is when hand-staging stops paying and the
default-per-location-in-vocabulary pattern earns its keep.

### 2026-06-26 - EXCEPTION: protagonist position is render-authored, not content-authored

A named, bounded exception to the descriptor contract. Normally content authors where an
actor stands (the scene descriptor's actor anchor) and render reflects it. For the
PROTAGONIST (lead actor) only, render OVERRIDES that: the lead ignores its descriptor
anchor and walks the composer's travel path. Recorded as an EXCEPTION, not a "small
inconsistency," because it is the first crack in the content<->render decoupling the whole
design protects. Naming it means the NEXT such case meets FRICTION (a deliberate decision)
rather than a shrug. REVISIT if a second actor (e.g. the skeleton) starts "mostly
following the composer" instead of its anchor -- at that point the override is a pattern,
not an exception, and the contract needs renegotiating.

### 2026-06-26 - Pedagogical progression: STORY-FIRST, VOLUME-DRIVEN, NO DRILL LADDER

SUPERSEDES the deferred two-track-drill framing as the SPINE of the curriculum (HANDOFF
section 2's "TWO TRACKS" and the 2026-06-24 "drills deferred" entry).

The mechanism that teaches typing is VOLUME of motivated, real typing -- not finger
drills. Evidence: the owner is self-taught to 100 wpm eyes-free with no course/drills
(transcribing and writing his own stories -- the exact mechanism the game uses); and a
never-typed 7-year-old reached good speed with roughly-correct fingering in the demo, on
the full-keyset story with on-screen finger hints.

- FULL KEYSET from beat one; NO motor key-set ladder. Difficulty is two continuous knobs
  -- story LENGTH and word COMPLEXITY (word length, vocab familiarity) -- ramped in a
  deliberate sequence, NOT letter-gating. This fully DISSOLVES the AZERTY
  home-row-has-no-vowels problem: there is no vowelless motor ladder to climb.
- The deliverable is EYES-FREE typing, NOT canonical fingering. Correct-fingering-per-a-
  chart is explicitly judged low-value and is NOT enforced. The loop already pressures
  eyes-on-screen (reveal window + on-screen finger hints + story pull), so good habits
  emerge as a byproduct of playing.
- ONE scaffold kept: the home-row anchor (f/j), taught from the start, never gated -- the
  cheapest accelerant to the eyes-free state (one verbal cue worked immediately on the
  7-year-old), not a technique rule.
- DRILLS are demoted from spine to OPTIONAL: they may exist as optional targeted practice
  (the schema already supports this, decoupled), but they are NOT the progression and NOT
  required. The track-1 motor curriculum is no longer a deferred-but-planned spine; it is
  optional side-practice if ever built.
- Technique is handled REACTIVELY, not prescriptively. Sloppy fingering (e.g. the
  ring/pinky confusion seen in the demo) is worth addressing ONLY if it produces enough
  errors to frustrate a real child -- a playtest observation, not a design assumption.
  Default: leave it alone and trust volume + the anchor.

## Open questions / future conversations
- Anchor default compositions: a default composition per location in the asset vocabulary
  (anchor -> pose/offset defaults) that a node overrides only for specifics -- the same
  override-the-default pattern as band metadata. Models have now LANDED and staging is
  hand-coded (correct for now -- see the 2026-06-26 imperative-composition decision); the
  BUILD TRIGGER is a second scene of an already-composed type, NOT "when models land."
- Protagonist-position exception (2026-06-26): the lead is render-authored, overriding its
  descriptor anchor (see decision log). Watch: if a SECOND actor starts mostly following
  the composer rather than its anchor, the override has become a pattern, not an exception
  -- renegotiate the content<->render contract then.
- Weak-finger errors (REACTIVE WATCH): watch real playtests for whether sloppy fingering
  (ring/pinky confusion etc.) causes quitting-level frustration; ONLY then add light,
  targeted help. Default is to leave it -- trust volume + the home-row anchor. (Collapses
  the old "length-vs-familiarity" and fingering watch items: difficulty is now story
  length + word complexity, see the 2026-06-26 progression decision.)
- Reconcile drills "core track" -> "optional side-practice" (consequence of the 2026-06-26
  progression decision): HANDOFF section 2 ("TWO TRACKS"), section 5 ("home-row drills
  (track 1)"), section 9's deferred "author track-1 drills" item, and schemas.md's
  curriculum/track-1 language still present drills as a required/core track. Reconcile them
  to optional side-practice -- drills are NOT the progression spine.
- Narration vs reveal-window sync: the render-only reveal window (paints ~4 words ahead
  of the cursor) and a future narration word-highlight must stay in sync. Flagged when
  the reveal window was added; not solved yet.
- `criteriaVersion`: what the safety criteria actually are, who signs off, and what a
  version bump re-triggers across already-approved nodes. (Deliberately a stub today.)
- Hash canonicalization: the exact normalization of resolved prose before hashing
  (whitespace, punctuation, choice-word inclusion) -- pin this when the linter is written.

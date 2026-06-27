# TypeQuest -- Migration brief: TypeScript/Three.js -> Godot 4.x

> **Audience:** a fresh Claude Code session starting an empty Godot 4.x repository,
> with NO access to this repo's source. This document is the complete handoff.
> **Nature:** a clean-room reimplementation guided by decisions and intent, **NOT a
> code port.** There is intentionally no TypeScript below -- only specifications,
> data, and reasoning. Build the Godot version from this brief alone.
> **The original repo stays intact as the fallback.** This brief is additive; nothing
> was deleted. If a spec here is ambiguous, the TS repo is the tiebreaker, but you
> should not need it.
> **House style (carry it):** no em dashes, no en dashes, no emojis in code, docs, or
> commits. Use `--`. Conventional Commits with a scope.

---

## 0. How to read this brief

Everything worth carrying is sorted into three explicit buckets:

- **Bucket A -- Engine-independent.** The real value. Carry verbatim; these do not
  care what engine renders them. Pedagogy, difficulty model, axis decoupling, safety
  gate, privacy invariant + profile schema + API, scoring model, the actual band-1
  Flemish content, the AZERTY facts.
- **Bucket B -- Principle survives, mechanism must be re-derived in Godot.** State the
  principle; the Godot "how" is open. Input-position scoring, pure-core isolation +
  its guard, render-reads-observed-state, vocabulary-by-id composition, reveal window,
  finger guidance, the progress primitive, determinism.
- **Bucket C -- Drop.** TS/Three artifacts that were never the point. Listed so you
  know they were deliberately dropped and where their intent (if it mattered) lives.

Then: the ClaudeCraft reference is demoted (Section 5), the open questions and
decision-log reasoning are carried (Sections 6-7), and the in-flight backend state is
declared honestly (Section 8).

**Prime directive:** these decisions were made deliberately, often against a naive
"simpler" default. Do not re-litigate or silently simplify them. Where this brief
quotes reasoning, treat it like the original repo's `AUTHORED -- DO NOT REGENERATE`
sentinel: inherit the why, do not regress to the naive form.

---

## 1. The game (concept, LOCKED 2026-06-24)

**A gamified touch-typing tutor disguised as a branching fantasy gamebook.**

A child reads and *types* an unfolding story shown as lightly-navigable 3D scenes
built from CC0 fantasy art. Typing the narrative prose reveals and advances the story;
typing a choice word picks the fork (go left / go right). Real typing pedagogy
underneath, but **motivation-first and heavily gamified**. Target age **6 and up**;
difficulty scales with reading + typing level.

- **What the child types:** BOTH the narrative passage (to reveal/read it) AND the
  choice word (to branch). Maximizes teaching per scene.
- **Reading support:** audio narration as an **optional toggle** (TTS or recorded) with
  live letter/word highlighting; defaulted on for young children, off for older.
- **3D:** lightly-navigable composed scenes with idle animation and small
  camera/character movement; NOT an open world.
- **Gamification:** XP, stars, unlockable companions/cosmetics, multiple kid profiles
  with saved progress (siblings / classroom).
- **Platform:** desktop/laptop with a **real physical keyboard** (non-negotiable for a
  typing tutor; on-screen keyboards undermine the goal).
- **PoC language + keyboard:** **Flemish (Belgian) Dutch on Belgian AZERTY**
  (`be-latin1`). NOT French AZERTY (symbol/number rows differ; Flanders uses Belgian).
- **Content production:** HYBRID, generate + curate, spec-first. Offline generation
  against a difficulty spec written BEFORE generation; then human curation for
  readability, engagement, safety. Live runtime expansion is a later phase reusing the
  same gates.

Why Godot now: the render/UI/input layer is being rebuilt on Godot's native systems
(nodes/scenes, `InputEvent`, `AnimationPlayer`/`AnimationTree`, its own audio). The
pedagogy and content -- the actual value -- are engine-independent and transfer whole.

---

## 2. BUCKET A -- Engine-independent (carry verbatim)

### A1. The pedagogy (THE core value)

**STORY-FIRST, VOLUME-DRIVEN, single spine. No drill ladder.** Decided 2026-06-26;
supersedes any earlier "two tracks of drills" framing.

The mechanism that teaches typing is the **VOLUME of motivated, real typing** in the
story -- not finger drills. Concretely:

- **Full keyset from beat one.** No motor key-set ladder, no letter-introduction
  sequence. Every letter is available immediately, so real Flemish prose appears from
  the first sentence.
- **Eyes-free is the deliverable, NOT canonical fingering.** Correct-finger-per-chart
  is explicitly judged low-value and is NOT enforced. The loop already pressures
  eyes-on-screen (reveal window + on-screen finger hints + story pull), so good habits
  emerge as a byproduct of playing, not as a rule imposed.
- **One scaffold kept: the home-row anchor (f/j),** taught from the start, never gated.
  It is the cheapest accelerant to the eyes-free state (a single verbal cue worked
  immediately on a 7-year-old in testing), framed as an anchor, not a technique rule.
- **Drills are OPTIONAL side-practice, never the progression and never required.** The
  data model may support constrained key-set drills as decoupled optional practice, but
  they are not the spine. Do not build them on the critical path.
- **Technique is handled REACTIVELY, not prescriptively.** Sloppy fingering (ring/pinky
  confusion, etc.) is worth addressing ONLY if real playtests show it causes
  quitting-level frustration. Default: leave it alone; trust volume + the anchor.

**Evidence (do not discard -- this is why the above is not a guess):**
- The project owner is self-taught to ~100 wpm eyes-free with **no course and no
  drills** -- by transcribing and writing his own stories. That is exactly the mechanism
  the game productizes.
- A never-typed 7-year-old reached good speed with roughly-correct fingering in a demo,
  on the full-keyset story with on-screen finger hints. No drill ladder was involved.

**Implication for Godot:** the game loop is "read + type prose to advance," with finger
hints and an optional narration toggle. Do not add a drills-first tutorial mode. Do not
add speed pressure at the first band (see A6). Do not enforce fingering.

### A2. The difficulty model

Difficulty is **two continuous knobs**, ramped in a deliberate authored sequence:
1. **Story LENGTH** (how much prose per beat / across the arc).
2. **Word COMPLEXITY** -- word length and vocabulary familiarity.

**Never by gating letters.** There is no "introduce these keys, then those." Tempo
targets (WPM/accuracy goals, time pressure, narration auto-advance) and linguistic
complexity (sentence/word length, vocab tier, repetition) are the difficulty surface.

This is encoded as a **band** on the story axis (a `StoryBand`-equivalent record), which
carries ONLY linguistic + tempo fields -- never any key/finger term. Keeping
key/finger terms out of the band is what keeps story difficulty decoupled from the
keyboard layout (see A3, A8).

- **PoC ships ONE band** (`band-1`, ~6 years old). But the schema/engine stays
  multi-band-capable: nodes always tag their band, invariants and logic stay band-aware
  even with one band. Adding band 2 later is **additive data plus one spec row, never a
  migration**. This is the same "reserve the dimension" move as keeping an AltGr slot
  you do not yet use.
- **band-1 spec values** (provisional, tuned against real play; carry these as the
  starting point):
  - `minAccuracy: 0.8`, `timePressure: false`, `narrationAutoAdvance: false`
  - `maxWordLen: 7`, `maxSentenceLen: 10`
  - `vocab: familiar`, `repetition: high`, `charSet: lower-no-altgr`
  - `targetWpm: 5` -- NOTE: band-1 does NOT score speed (A6) and `timePressure: false`, so
    this is NOT a scoring gate and has zero effect on xp/stars. It is a nominal, non-scoring
    pacing reference the band schema carries for EVERY band (later bands, where speed becomes
    a genuine signal, actually use it); at band-1 it is a deliberately low floor. Keep the
    field for schema uniformity; do NOT wire it into scoring.
- **`maxWordLen: 7` is a per-band balance point, not a universal rule.** Evidence from
  authoring band-1: 7 chars was mostly fine for readable 6yo Flemish but forced
  `overkant` (8) -> `andere kant` and `gevonden` (8) -> `vindt`, and pushed `rammelt`
  to sit exactly at 7. It still admits common kid-fantasy words (ridder, skelet, zwaard,
  kasteel, monster, prinses) and blocks others (avontuur, gevonden, overkant, tovenaar).
  So 7 is workable but has a real vocabulary cost; higher bands raise it for longer
  familiar words. It is per-band metadata, free to vary, not a global constant.

### A3. The three-axis decoupling (the load-bearing principle)

Keep three concerns **independent**, so adding one never touches the engine:

1. **Story** -- a language-agnostic branching graph (nodes, forks, scene descriptors).
   No words baked into structure; no model paths baked into scenes.
2. **Content language** -- Flemish Dutch now: the words, narration, locale formatting.
3. **Keyboard layout** -- Belgian AZERTY now: physical-key -> character mapping plus the
   finger map used for on-screen guidance.

**Language is NOT the keyboard axis.** "Flemish Dutch on AZERTY" is one (content,
layout) pair. Adding Walloon French, QWERTY, or a translated story each touches exactly
ONE axis. This is the entire future-proofing strategy.

**The one rule that makes the axes independent:** *the story graph carries keys, never
words, and ids, never models.*
- Narrative + choice words are text keys resolved against a locale catalog. Swap the
  catalog (`nl-BE` -> `fr-BE`) and the same graph plays in another language.
- Scenes are bags of ids drawn from an asset vocabulary. Swap the art pack behind the
  vocabulary and the same graph renders from different models.
- Finger guidance comes from the layout's `position -> char + finger` table. Swap AZERTY
  for QWERTY and the same prose is taught on another layout.

In Godot this stays identical at the data level. (The mechanisms for each axis -- how
input is read, how text is localized, how scenes are instanced -- are Bucket B.)

### A4. The content-hash safety gate (per-locale)

Every story node carries a **safety review record per content locale**. Each record is
`{ approvedContentHash, date, criteriaVersion }`. A linter/build gate recomputes the
hash of the node's **resolved prose** in each shipped locale and **blocks the build** if
no record matches. A mismatch means prose changed under a stable text key since
sign-off, so it must be re-reviewed before it can ship.

**Why a hash and not a boolean (do NOT regress to a boolean):** a boolean stamps the
node id, but the child reads the *resolved prose*. In generate-and-curate, prose
routinely changes under a stable text key; a boolean would stay green and ship
un-reviewed text. The hash diverges when prose changes and forces re-review.

**Why per-locale and not per-node:** one hash per rendered string per locale, so a
Flemish edit re-triggers only the Flemish review and leaves a future French approval
intact. (Same per-graph-not-global instinct as "every text key resolves in every
locale.")

This gate is the human safety sign-off made into an enforced build gate, not
discipline. The same gate guards the later live-expansion phase unchanged.

**The hash algorithm (carry exactly, so existing hashes in A7 stay valid):**
FNV-1a, 32-bit. Offset basis `0x811c9dc5`, prime `0x01000193`. For each character: XOR
the accumulator with the character's code unit, then multiply by the prime modulo 2^32.
Emit as zero-padded 8-digit lowercase hex, prefixed `fnv1a:`. It currently hashes the
raw resolved prose string with NO normalization (see open question on canonicalization,
Section 6). Reproduce the algorithm faithfully in Godot (GDScript/C#) so the band-1
hashes in A7 verify; if you change canonicalization, you must re-review and re-stamp all
nodes deliberately.

**HARD RULE -- a failing hash means fix the PROSE encoding, NEVER regenerate the hash.**
When the band-1 content is re-encoded into Godot resources, byte-level differences (a
trailing newline, leading/trailing whitespace, resource-serializer normalization,
string-literal escaping, character encoding) can make an A7 hash fail verification on first
import even though the words are identical. The correct fix is to make the imported prose
BYTE-IDENTICAL to the string in A7 -- not to recompute the hash. Recomputing silently
defeats the gate: it would then certify "matches whatever I just imported," not "matches
what a human reviewed." So a failing hash means an encoding mismatch to REPAIR, never a hash
to regenerate. The ONLY time a hash is legitimately re-stamped is when a human is
DELIBERATELY re-reviewing that node's prose. If a Godot session sees a hash mismatch, it
must treat it as an import bug, not as stale metadata to overwrite.

`criteriaVersion` is intentionally a stub today (what the criteria are, who signs off,
what a version bump re-triggers across approved nodes is a future conversation). Keep the
field; do not invent criteria.

### A5. Profile/progress: privacy invariant + schema + API (all engine-independent)

This is the backend design. It is independent of TS, Mongo, and Godot. The TS wiring is
Bucket C; everything here transfers.

**PRIVACY INVARIANT (load-bearing -- a deliberate design choice):** a profile is
**non-identifying by design**. A full database compromise must leak nothing
attributable to a real child.
- `profileId` is an **opaque random id** (e.g. a UUID). It is the REAL key, NOT the
  hero name.
- `heroName` is a **decorative, non-unique display label**. Two kids can both be
  "DragonKnight"; the id distinguishes them. Always framed in UI as "pick your hero
  name," never "your name." Bias toward non-real names: provide a generator / pick-list
  so the easy default is something like "DappereBeer," and add a SOFT, non-blocking
  warning if a name looks like "Firstname Lastname" (two capitalized words). Warn, never
  block.
- `progress` is **coarse game state only**: total XP, best stars per node id, completed
  node ids, current band.

**EXPLICITLY NOT STORED** (do not add without reopening this decision deliberately):
real names, contact info, age, IP address, login/timestamps, geolocation, device ids,
raw per-key error history, or anything that could identify a child or record their
behaviour. Any future identifying/behavioural field REOPENS this invariant -- and the
no-auth posture that depends on it.

**Profile schema (data shapes, not code):**
- `Profile { profileId: string (opaque), heroName: string (decorative, non-unique),
  progress: Progress }`
- `Progress { xp: number, starsByNode: map<nodeId, 0..3>, completedNodeIds: string[],
  band: string }`
- Fresh progress: `{ xp: 0, starsByNode: {}, completedNodeIds: [], band: 'band-1' }`.

**Persistence seam (one contract, swappable backends):**
- `createProfile(heroName) -> Profile` (store assigns the opaque id)
- `getProfile(profileId) -> Profile | null`
- `saveProgress(profileId, progress) -> void`
Profiles are addressed only by their opaque id. Implementations in the TS repo: in-memory
(tests/dev), HTTP (browser client), Mongo (server). In Godot, re-derive the same three
operations behind one interface; an in-memory/local-file impl is enough for a single-
device PoC, with an HTTP impl when a backend is wanted.

**HTTP API shape (if/when a backend tier exists):**
- `POST /api/profiles { heroName }` -> `201 Profile`
- `GET /api/profiles/:id` -> `200 Profile | 404`
- `PUT /api/profiles/:id/progress { progress }` -> `204 | 404 | 400`

**SECURITY POSTURE, coupled to the invariant (carry this coupling, it is the point):**
NO AUTH, NO OWNERSHIP MODEL. Anyone can read/write any profile by its opaque id. This is
acceptable **only because** profile data carries no identifying or sensitive fields
(worst case: someone alters a kid's star count). The no-auth choice and the
non-identifying-data invariant are explicitly linked: **relaxing the data minimization
reopens the no-auth decision.** Comment this link at the API layer so the next person who
adds a field sees that it also forces an auth conversation. Credentials (if a real
backend is used) come only from the environment, never committed.

**Multi-profile UX:** multiple kid profiles per device. The device keeps a local roster
(hero-name label -> opaque id) for a picker; the opaque id is the key. Hero name is just
the label in the list.

### A6. The scoring model

Pure function: given ONE completed unit of typing, return `{ xp, stars }`. Profile-
agnostic and deterministic. WHERE the score accumulates per child is a separate concern
(A5); scoring never touches it.

**Philosophy: COMPLETION + ACCURACY only. SPEED has ZERO influence at band-1.**
(Decided 2026-06-26.) Rewarding speed early encourages hunt-and-peck racing, which fights
the eyes-free/technique goal (A1). So:
- **Completing the unit is the baseline reward** (you finish to progress; volume is the
  teaching mechanism): a flat completion bonus plus at least 1 star.
- **Accuracy is the only quality knob:** it scales the volume XP and gates the 2nd/3rd
  stars.
- **Speed is not scored.**

**The fast-sloppy-cannot-win invariant:** two runs identical in accuracy and correct-char
count but different in WPM produce IDENTICAL xp and stars. A child cannot buy a better
score by racing. Preserve this as a test in Godot.

**Exact formula and constants (carry; tune against real play, but keep speed at zero for
band-1):**
- `XP_PER_CORRECT_CHAR = 1` (volume reward)
- `COMPLETION_BONUS = 20` (finishing matters)
- `ACCURACY_FLOOR = 0.5` (even a sloppy run keeps half its volume XP -- encouraging, not
  punishing)
- `STAR2_ACCURACY = 0.85`, `STAR3_ACCURACY = 0.95`
- Computation: `accuracyFactor = ACCURACY_FLOOR + (1 - ACCURACY_FLOOR) * accuracy`;
  `volumeXp = correctChars * XP_PER_CORRECT_CHAR * accuracyFactor`;
  `xp = round((completed ? COMPLETION_BONUS : 0) + volumeXp)`.
- Stars: `0` if not completed; else `1`, bumped to `2` at accuracy >= 0.85, to `3` at
  accuracy >= 0.95.
- `accuracy = correct / typed` (and `accuracy = 1` when nothing was typed). That
  "empty target = accuracy 1" rule exists ONLY so progress reads as complete; it must NOT
  be used to score anything.
- **A pre-revealed node (A9, e.g. naGrot) produces NO score at all -- not even the
  completion bonus -- and the scoring path must NEVER be invoked for it.** No keystrokes
  happened, so there is nothing to reward; do not let the completion bonus or the
  empty-target accuracy rule leak a phantom XP/star onto a beat the child only read.

**FUTURE-BAND HOOK (keep, do not implement at band-1):** a later band where speed is a
genuine skill signal would add a speed term that is BAND-GATED (a parameter on the
scoring function), never global. Band-1 must keep zero speed dependence.

**Accumulation rules (app-level, carry the intent):**
- XP adds; stars keep the BEST per node; a node is "completed" when typed (stars >= 1).
- **Score each node at most once per run.** With the cave-bounces-back-to-the-fork loop
  (A7), a node can be revisited; scoring once per run prevents XP farming by looping.
- Persist accumulated progress through the profile store (A5).

### A7. The band-1 Flemish content (carry verbatim, including the safety hashes)

This is real authored content (AUTHORED -- do not regenerate it casually). Graph id
`band1-arc`, start node `start`, vocabulary id `fantasy-poc`, all nodes tagged band
`band-1`. Prose is all-lowercase Flemish, every word <= 7 chars, <= 10 words/sentence,
no AltGr characters, no capitals (Shift is entirely out of PoC scope).

**Locale `nl-BE` (label "Vlaams (Belgie)"). Prose, narration, and the safety hash per
node. The hash is FNV-1a (A4) over the exact resolved prose string shown.**

1. **start** -- scene: `forest_path`, mood `day`; actor `hero` at anchor `path_near`,
   pose `idle`, facing `camera`. Choice: type `verder` -> `kruispunt` (hint `forward`).
   - prose: `de kleine ridder loopt door het bos. hij zoekt een grote schat en wil verder.`
   - narration: `luister goed en typ elk woord dat je leest.`
   - safety hash nl-BE: `fnv1a:1eef94d0`

2. **kruispunt** (the fork) -- scene: `forest_path`, `day`, **path `fork`**; actor `hero`
   at `center`, `idle`. Choices: type `grot` -> `grot` (hint `left`); type `brug` ->
   `brug` (hint `right`).
   - prose: `het pad gaat twee kanten op. links gaapt een zwarte grot. rechts staat een oude brug.`
   - narration: `kies je weg en typ het woord.`
   - safety hash nl-BE: `fnv1a:fc978a65`

3. **grot** (the cave -- a SETBACK, not a dead end) -- scene: `dungeon`, mood `dark`;
   actors `hero` at `center` (`idle`) and `skeleton` at `far_right` (`idle`, facing
   `camera`). No choices. `ending: neutral`. **`returnTo: naGrot`.**
   - prose: `in de grot rammelt een wit skelet. de ridder rent snel terug naar het licht.`
   - narration: `wees moedig en lees rustig verder.`
   - safety hash nl-BE: `fnv1a:3778a255`
   - Behaviour: it is a neutral ending so the end-of-beat transition (the vignette,
     Section B) plays, BUT instead of restarting the run it bounces to `naGrot` with the
     child's progress intact. The skeleton scares the knight back to the fork; the child
     can still reach the win via the bridge. (See A9 for the returnTo mechanism.)

4. **naGrot** (post-cave fork -- ADDED this session) -- scene: `forest_path`, `day`, path
   `fork`; actor `hero` at `center`, `idle`. **`prerevealed: true`** (prose shown
   already-complete; the child reads it and goes straight to the choice; nothing is
   scored here). Single choice: type `brug` -> `brug` (hint `right`). The grot is NOT
   offered again -- the knight has learned its lesson.
   - prose: `de ridder kiest nu voor de veilige brug.`
   - narration: `de ridder kiest de veilige weg.`
   - safety hash nl-BE: `fnv1a:859459c1`

5. **brug** (the bridge) -- scene: `forest_path`, `day`; actor `hero` at `path_near`,
   pose `walk`; prop `bridge` at anchor `center`. Choice: type `kist` -> `schat` (hint
   `forward`).
   - prose: `de ridder stapt over de smalle brug. aan de andere kant wacht een grote kist.`
   - narration: `stap voor stap over de brug.`
   - safety hash nl-BE: `fnv1a:a8d13156`

6. **schat** (the treasure -- the WIN) -- scene: `forest_path`, `day`; actor `hero` at
   `center`, `idle`; prop `chest` at anchor `treasure`. No choices. `ending: win`.
   - prose: `de ridder opent de kist vol goud. hij vindt de schat en is heel blij.`
   - narration: `goed gedaan kleine held.`
   - safety hash nl-BE: `fnv1a:1f2d5082`

**Choice words (resolved nl-BE):** `verder`, `grot`, `brug`, `kist`. (naGrot reuses the
`brug` choice word.)

**The arc shape:** `start -> kruispunt -> { grot (setback, returns to naGrot -> brug ->
schat) | brug -> schat }`. Two ways to the win; the cave is a recoverable detour, not a
loss.

**Asset vocabulary `fantasy-poc` (ids -> what they are; rebind to Godot resources):**
- locations: `forest_path`, `dungeon`. Each location defines a set of named placement
  **anchors** and valid camera presets.
- characters: `hero` (a knight), `skeleton`.
- props: `chest` (a gold chest whose lid is a separate child node -- relevant to the win,
  Section B), `bridge`.
- moods: `day`, `dark`.
- anchors used by band-1 (each is a named point a location offers): `center`,
  `path_near`, `path_far`, `far`, `far_right`, `far_left`, `treasure`, plus left/right.
- The original art is CC0 (KayKit dungeon + characters; a Quaternius/Kenney-style nature
  set for trees). In Godot, rebuild the vocabulary as id -> Godot scene/resource, keep
  the same ids, and keep the "missing/unknown id renders a visible RED placeholder" rule
  so a bad id is loud, never silent.

**Scene descriptor schema (the data each node carries; engine-independent):**
`{ location, mood?, actors?: [{ asset, anchor, pose?, facing? }], props?: [{ asset,
anchor }], camera?, path?: 'straight' | 'fork' }`. `facing` is one of
`camera|left|right|away`. `path` is a presentation hint for path-style locations (a
single straight track vs a visibly forking road); presentation only, never affects logic.

### A8. Belgian AZERTY facts (and what they implied)

- The Belgian AZERTY **home row carries NO vowels.** The resting row is `q s d f g h j k
  l m` (plus modifiers); a, e, i, o, u, y are not on it.
- **All Dutch vowels live on the TOP row** (`a z e r t y u i o p`): a, e, y, u, i, o are
  top-row; the remaining vowel sound material is reachable there too.
- **What this implied (and why A1/A2 are shaped as they are):** a traditional
  home-row-first motor drill ladder would be *vowelless* and could not spell real Dutch
  words for many lessons -- a dead end on this layout. The story-first, full-keyset,
  no-letter-gating decision **dissolves this problem entirely**: there is no vowelless
  motor ladder to climb, because there is no motor ladder. Prose uses every row from beat
  one, and finger guidance (Section B) handles "which key, which finger" live. The home-
  row anchor (f/j) is kept ONLY as an orientation scaffold, not as a drill stage.
- PoC keyboard scope: 3 letter rows + space + period, lowercase, no AltGr, no Shift
  (capitals are out of PoC scope until a later band). The layout is `be-latin1`
  (Belgian), explicitly NOT French AZERTY -- they differ on the symbol/number rows.

### A9. Story-flow mechanisms added this session (engine-independent data-model)

These were designed and added while building the TS version; they are data-model + intent,
not TS-specific. Carry them into the Godot story model.

- **Setback `returnTo`:** a non-win ending node may declare `returnTo: <nodeId>`. Meaning:
  it is a real ending (its end-of-beat transition plays), but instead of restarting the
  run, the run resumes at `returnTo` with progress intact. Pedagogical reason: a young
  child who picks the "wrong" path should get the scare and a gentle bounce-back, not lose
  all their work and restart. The win must stay reachable. Used by `grot -> naGrot`.
- **`prerevealed` beat:** a node may declare `prerevealed: true`. Its prose is shown
  ALREADY complete (no typing challenge); the child reads the line and goes straight to
  the choice. For short connective/narrative beats where the point is to read and decide,
  not to type. **A pre-revealed beat produces NO score at all -- not even the completion
  bonus -- and the scoring path must NEVER be invoked for it** (no keystrokes happened; see
  the consolidated rule in A6). Used
  by `naGrot` so that, after the cave, the child lands directly at the decision, is told
  "de ridder kiest nu voor de veilige brug," and only the safe bridge is offered.
- **Score-once-per-run:** because `returnTo` can revisit a node, the accumulation layer
  scores each node at most once per run (track the set of scored node ids for the run).
  Prevents XP farming by looping the cave.
- **Win flourish (intent, not mechanism):** the win beat should feel rewarding -- a flash
  of light and the treasure chest opening. The chest model's lid is a separate node, so
  "open" is a lid hinge; a brief white flash masks the swap. This is render intent
  (mechanism is Bucket B), but the *intent* -- celebrate the win, open the chest -- is
  carried here.

---

## 3. BUCKET B -- Principle survives, mechanism re-derived in Godot

For each: the principle is gold; the Three.js/DOM "how" does not transfer. State the
principle, build the Godot mechanism fresh.

### B1. Score physical keyboard POSITIONS, regardless of OS layout

**Principle:** a child practises true Belgian AZERTY *positions* even if the OS is set to
QWERTY or anything else. The score and the finger guidance are about where the key
physically is, not what character the OS thinks it produced.

- TS mechanism (dropped): read `KeyboardEvent.code` (physical position) and map it to a
  character via the layout's `code -> char` table, ignoring `event.key`.
- **Godot (re-derive):** Godot's `InputEvent`/`InputEventKey` exposes physical vs
  unicode/keycode distinctions (physical keycode is the position-based one). Build the
  layout as a `physical position -> (character, finger)` table and resolve typed input
  from the physical position, not the OS-produced character. Verify on a machine whose OS
  layout differs from Belgian AZERTY. Keep the layout as its own axis-data resource
  (B4/A3), so QWERTY etc. is a new table, not an engine change.

### B2. Pure, deterministic core, isolated from render, enforced by a guard

**Principle:** the game logic (story traversal, typing comparison + stats, scoring,
curriculum helpers) is pure, deterministic, replayable, and has ZERO knowledge of
rendering, input devices, or networking. It is unit-testable headless. A guard enforces
the isolation so it cannot rot.

- TS mechanism (dropped): a `core/` folder with an architecture test that scans source for
  forbidden imports (DOM, Three, network) and bans `Math.random`/`Date.now`.
- **Godot (re-derive):** keep game logic in plain GDScript/C# classes (or a Resource-based
  model) that never touch `Node`, scene tree, `Input`, rendering, or HTTP. No node
  lifecycle in the logic layer. Re-derive the guard as a test/CI check that the logic
  scripts do not reference engine/scene/Input/rendering singletons, and that randomness
  and time come from injected sources, not from global RNG/clock. Determinism: any
  randomness goes through a **seeded RNG** passed in; timestamps are supplied by the caller
  (so a recorded keystroke log reproduces the exact score). This is what makes bugs
  reproducible and scoring replayable -- keep it.

### B3. Render reads an observed-state struct (with hysteresis), not raw input

**Principle:** the visuals are driven by a small **observed-state struct**, not by raw
keypresses. The character animates from "what is true" (how far through the prose, are we
actively typing, arrived?) with **hysteresis** so it does not jitter on every keystroke.
There are TWO animation layers and a fresh session must build BOTH (in-place alone is NOT
the spec):
- **In-place aliveness (the base):** idle / active-typing / arrived animation gated by
  whether the child is currently typing, so the scene feels alive even when nothing moves
  through space.
- **Literal scene travel (layered on where the scene calls for it):** the protagonist
  actually walks the staged path -- down the forest path, across the bridge, up to the fork
  -- driven by the same observed state. This is visual STAGING, not a second progress
  signal: narrative forward-progress is carried by the reveal window (B5); the travel only
  dresses it. Do NOT read "the knight reached the end of the path" as a separate progress
  channel, and do NOT re-couple animation to scoring -- the travel is the same `progress`
  number expressed as motion, nothing more. (This resolves the earlier "aliveness, not a
  second progress signal" position: in-place is the base, travel was added on top when the
  visuals wanted it; both are current and both ship.)

- The struct (carry its shape): `SceneActivity { progress: 0..1, activity:
  idle|moving|arrived, intensity: number }`. `progress` is driven by typing now;
  `activity` is the coarse locomotion the renderer switches on (with hysteresis);
  `intensity` is RESERVED and neutral (=1) now, earmarked for a future per-profile
  typing-level signal -- adding it later sets one field with no new path into the renderer.
- TS mechanism (dropped): a Three.js scene composer + a borrowed `locomotion.ts` that
  derived walk/idle/arrived from how a "progress" number changed frame to frame, plus
  literal in-place + travel motion.
- **Godot (re-derive):** feed the same struct to an `AnimationTree`/`AnimationPlayer` for
  the in-place clips AND a transform tween / path-follow for the literal travel along the
  composer's staged path, both driven from the same observed state. Keep the hysteresis (do
  not switch states on a single keystroke flip). Keep the rule: the renderer derives its own
  visuals from declarative/observed state; it never receives render-shaped data (colours,
  positions, clip names, camera angles) through the seam.
- **A caveat to carry:** the borrowed TS locomotion assumed real WORLD displacement (it
  sampled how far an entity actually moved), but here it was fed PROGRESS-derived, in-place
  motion (typing advances a number, not a world position). So it did something subtly
  different from its origin. In Godot, derive locomotion from the typing-progress signal
  directly and do not assume any imported "move by displacement" logic fits.

### B4. Scenes composed from an asset vocabulary BY ID, not by path

**Principle (gold):** content names scene elements by **id** drawn from an asset
vocabulary; it never references a model path. The vocabulary maps id -> concrete art. Swap
the art pack behind the vocabulary and the same story renders from different models. A
validator checks every id in every scene descriptor against the vocabulary; an
unknown/missing asset renders a loud RED placeholder, never a silent failure.

- **Godot (re-derive):** the vocabulary becomes id -> Godot scene/resource (PackedScene or
  mesh resource). The composer instances by id, places actors/props on the location's
  named anchors, and applies the mood (lighting preset) and `path` hint. Keep the
  validator (build/CI check that every descriptor id resolves) and the RED-placeholder
  fallback.
- **Composition is deliberately imperative FOR NOW, and that is correct, not debt.** Scene
  staging (treelines, the path/fork geometry, water, travel path, threat choreography,
  chest placement) is hand-coded per scene type while there is ONE consumer per type. Do
  NOT prematurely build the data-driven "default composition per location in the
  vocabulary" system. Do NOT add unit tests that pin hand-placed staging constants. The
  **trigger** to promote to the data-driven system is authoring a SECOND scene of an
  already-composed type (a second forest layout, a second dungeon) -- that is when
  hand-staging stops paying. (This is the open "anchor-default-composition" item, Section
  6.)
- **One named EXCEPTION to the id-by-content rule:** the PROTAGONIST (lead actor) position
  is render-authored, not content-authored. The lead ignores its descriptor anchor and
  walks the composer's travel path. This is recorded as a deliberate, bounded EXCEPTION --
  the first crack in the content<->render decoupling -- so the NEXT such case meets
  friction, not a shrug. WATCH: if a SECOND actor (e.g. the skeleton) starts mostly
  following the composer instead of its anchor, the override has become a pattern and the
  content<->render contract must be renegotiated.

### B5. The reveal window

**Principle:** the prose is revealed progressively as the child types -- the UI paints
roughly a few words ahead of the cursor and keeps already-typed text visible, so the
child always has a little runway but cannot read the whole passage at once. It carries the
narrative forward-progress (which is why the character animation is freed up to be mere
aliveness, B3). It reads the existing cursor/target; it never truncates the target or
gates input on what is visible (the typing logic still scores against the full prose).

- **Godot (re-derive):** implement in the type-along text UI (RichTextLabel or custom),
  reading the typing cursor. Keep "paint ~N words ahead, show typed text, never gate input
  on visibility." (N was ~4 in the TS version.)
- **Sync caveat (open question, Section 6):** when audio narration with a word-highlight
  lands, the reveal window and the narration highlight must stay in sync. Unsolved; design
  for it.

### B6. Finger-guidance hints

**Principle:** from sentence one, the UI shows WHICH key and WHICH finger to press for the
next expected character, on an on-screen keyboard. This is load-bearing pedagogy (the
story no longer pre-teaches keys, so guidance carries it). The home-row anchor (f/j) is
highlighted/oriented from the start. Guidance derives from the keyboard layout's `position
-> char + finger` table (B1).

- **Godot (re-derive):** an on-screen keyboard scene that highlights the next key and
  finger from the layout table and the next expected character from the typing state. Keep
  finger colour-coding. Keep it driven by the layout axis-data, so swapping layouts swaps
  guidance with no logic change.

### B7. The progress primitive

**Principle:** "progress through the current prose" is THE canonical 0..1 signal:
typed-cursor over full target length. Every character of the target counts (letters,
spaces, trailing punctuation -- all things the child types). The CHOICE word is NOT part of
prose progress (a fork's word is a separate typing target, matched separately). An empty
target reads as fully complete (1). Many consumers inherit this (animation now;
level-modulation and pacing later), so it is pinned in ONE place.

- **Godot (re-derive):** compute it once in the typing model and expose it; do not let each
  consumer re-derive it differently.

### B8. Determinism, seeded RNG, replay

**Principle (also under B2, restated because it is load-bearing):** all randomness flows
through a seeded RNG; all time is injected. Same seed + same input log -> same result. This
gives reproducible bugs, replay, and headless automated tests. Keep it in the Godot logic
layer (do not reach for Godot's global RNG/clock inside game logic).

---

## 4. BUCKET C -- Drop (TS/Three artifacts; intent preserved elsewhere)

These were implementation, never the point. Dropped deliberately; where intent mattered,
it lives in A or B.

- **The specific `IGameView` interface shape.** The SEAM idea survives (B2/B3: render reads
  game state through one boundary, never a concrete engine class, and never pulls
  render-shaped data). The exact TS interface members do not transfer; design the Godot
  boundary natively. Note the discipline that DID matter: seam reads must be pure
  derivations of game state ("what is true"), never "do render work" -- adding a read that
  returns colours/positions/clip-names/camera-angles would be seam creep; reject those.
- **The Three.js scene composer and `locomotion.ts` code.** Dropped wholesale -- Godot has
  `AnimationTree`, tweens, lighting/environment, and PackedScenes. The *principles* (B3
  observed-state + hysteresis, B4 vocabulary-by-id, the imperative-for-now staging, the
  protagonist-position exception) are carried; the code is not.
- **Vite / Vitest / tsconfig / ESM-strict setup.** Pure toolchain. Godot has its own
  project, test, and build story. Carry only "tiny dependency set; reach for the platform
  before a library" as philosophy.
- **`noUnusedLocals`-based proofs and similar TS-compiler tricks.** E.g. leaving a
  commented hook instead of an unused constant to satisfy the compiler. Irrelevant in
  Godot; the underlying intent (leave a clearly-commented hook for a future band's speed
  term) is captured in A6.
- **The MongoDB integration code (the TS driver wiring, the Node HTTP server, the Vite
  proxy, the in-memory/HTTP/Mongo class plumbing).** Dropped. **KEEP** the profile schema,
  the API shape, the privacy invariant, and the no-auth-coupled-to-non-identifying-data
  posture -- all in A5. The backend is engine-independent; only its TS wiring drops. (See
  Section 8 for its in-flight status.)
- **The headless-Chromium screenshot + ImageMagick montage visual-check workflow** and the
  `?node=`/`?progress=`/`?chest=open` URL dev affordances. These were a TS/web harness. The
  PRINCIPLE worth carrying: *graphics drive this game, so any change that adds or moves
  something on screen gets a quick visual pass before it is called done -- tests do not
  catch placement.* Re-derive a Godot equivalent (in-editor checks, screenshot tooling, or
  deterministic "jump to scene X at state Y" debug entry points). This visual-check
  discipline caught real bugs in the TS build (a panel overlapping the title, a character
  walking off a path, an animation firing too early); keep the habit, drop the harness.

---

## 5. The ClaudeCraft reference -- DEMOTED to historical context

The TS project studied `world-of-claudecraft` (a solo-dev + Claude MMO) primarily as a
source of **animation/render patterns**: locomotion-from-observed-state, height-fit model
scaling, lighting + tone mapping, `AnimationMixer` clip selection, the one-seam +
architecture-test idea, and the buy-CC0-art/engineer-the-systems philosophy.

**Because the render layer is being rebuilt in Godot's native systems, ClaudeCraft is now
largely irrelevant to the new repo.** Do NOT plan to study it. What was worth taking from
it has already been distilled into Bucket B (observed-state + hysteresis, vocabulary-by-id,
seam discipline, determinism) and Bucket A (CC0-art philosophy). Treat ClaudeCraft as
historical context for *why* those patterns are here, not as a thing to read. Specifically:
its Three.js locomotion code is not a model for Godot (and even in TS it was adapted, not
copied -- it assumed world displacement; we fed it progress-derived motion, see B3).

The CC0 art philosophy DOES carry: **buy/download CC0 art (KayKit, Quaternius, Kenney);
engineer the systems. No generating 3D art in code.** Credit assets (a CREDITS file). This
is engine-independent and stays.

---

## 6. Open questions / future conversations (CARRY THESE -- inherit the reasoning, do not re-litigate)

Each is deliberately open. Carry the framing so the new repo does not "solve" them naively
or re-open settled parts.

- **Anchor-default compositions.** A future system: a default composition per location in
  the vocabulary (anchor -> pose/offset defaults) that a node overrides only for specifics
  -- the same override-the-default pattern as band metadata. NOT to be built early. BUILD
  TRIGGER: authoring a SECOND scene of an already-composed type (second forest, second
  dungeon). Until then, imperative hand-staging is correct (B4).
- **Protagonist-position exception.** The lead is render-authored, overriding its
  descriptor anchor (B4). WATCH: if a second actor starts mostly following the composer
  rather than its anchor, the override is a pattern, not an exception -- renegotiate the
  content<->render contract then.
- **Weak-finger frustration (REACTIVE WATCH).** Watch real playtests for whether sloppy
  fingering (ring/pinky confusion, etc.) causes quitting-level frustration. ONLY then add
  light, targeted help. Default: leave it; trust volume + the home-row anchor. (Do not
  pre-build fingering correction.)
- **Narration vs reveal-window sync.** The reveal window (paints ~N words ahead) and a
  future narration word-highlight must stay in sync. Flagged, not solved. Design for it
  when narration lands (B5).
- **`criteriaVersion`.** What the safety criteria actually are, who signs off, and what a
  version bump re-triggers across already-approved nodes. Deliberately a stub. Keep the
  field; do not invent criteria (A4).
- **Hash canonicalization.** The exact normalization of resolved prose before hashing
  (whitespace, punctuation, whether choice words are included). Currently NONE (raw
  resolved string). Pin this when you write the linter; if you change it, you must
  deliberately re-review and re-stamp every node, because all hashes in A7 will change
  (A4).
- **Level-modulation via `SceneActivity.intensity`.** The reserved, neutral-now field is
  earmarked for a per-profile typing-level signal that modulates animation/pacing. Adding
  it later should set ONE field, with no new path into the renderer (B3). Intent recorded;
  not built.
- **Reconcile "drills" language.** Older docs in the TS repo still occasionally framed
  drills as a core/required track; the 2026-06-26 decision demoted them to OPTIONAL
  side-practice. In the Godot repo, write drills (if ever) as optional from the start;
  never as the progression spine (A1).

---

## 7. Decision-log history (CARRY THE WHY)

Inherit not just conclusions but the reasoning, so the new repo does not regress a
deliberate choice to its naive form. Treat as `AUTHORED -- DO NOT REGENERATE`.

- **2026-06-24 -- Safety gate is a per-locale content hash, not a boolean.** A boolean
  stamps the node id, but the child reads resolved prose; under generate-and-curate, prose
  changes under a stable text key, so a boolean ships un-reviewed text. The hash diverges
  on change and forces re-review. Per-locale so a Flemish edit re-triggers only Flemish.
  (-> A4. Do not regress to a boolean.)
- **2026-06-24 -- Story difficulty = FULL KEY SET + SCALED LANGUAGE.** Supersedes any
  letter-introduction progression. Full keyset from beat one; difficulty scales by tempo +
  linguistic complexity, never by gating letters. Encoded on the story axis (band), which
  carries no key/finger terms. (-> A2, A3.)
- **2026-06-24 -- Content pipeline: GENERATE + CURATE, spec-first.** Spec authored before
  generation; generator owns countable limits (linter-enforced), human owns judgment
  (readability, engagement, safety). (-> A1, A4.)
- **2026-06-24 -- PoC difficulty: ONE BAND.** Single band-1 (~6yo); schema stays
  multi-band-capable; band 2 is additive data, not a migration. Consequence: PoC is fully
  lowercase, no Shift in scope at all. (-> A2.)
- **2026-06-24 -- band-1 target age 6; drills deferred; maxWordLen 7 provisional.** Drills
  deliberately not authored (pairing them with AZERTY reactivates the home-row-no-vowels
  problem). (-> A2, A8.)
- **2026-06-25 -- Length-vs-familiarity RESOLVED as a per-band balance, not one rule.**
  maxWordLen is per-band metadata with a real vocabulary cost at 7; the balance point moves
  for higher bands. Not a global. (-> A2.)
- **2026-06-25 -- Input scoring: PHYSICAL REMAP.** Score on physical key position +
  layout table, not the OS-produced character, so the child practises true AZERTY positions
  regardless of OS layout. (-> B1.)
- **2026-06-25 -- Typing-reactive graphics v1: aliveness, not a second progress signal.**
  Character animates from observed state + hysteresis, not raw keypresses; the reveal window
  already carries narrative forward-progress. (Later updated: literal scene travel was added
  on top of in-place animation when the visuals wanted it.) (-> B3, B5.)
- **2026-06-25 -- `SceneActivity { progress, activity, intensity }`: the multi-input
  junction.** One struct the renderer reads; each signal writes its own field; intensity
  reserved for the future per-profile level signal. (-> B3, Section 6.)
- **2026-06-25 -- Keyboard layout lifted to its own axis.** Content no longer owns a layout,
  so deleting throwaway content cannot break real content's keyboard. (-> A3.)
- **2026-06-26 -- Real CC0 models + reference-borrowed render techniques.** Models resolved
  through the vocabulary BY ID; missing model -> red placeholder. Borrowed lighting/
  locomotion/clip-selection/height-fit from the reference -- ADAPTED, NOT COPIED (the
  reference assumed world displacement; we fed progress-derived in-place motion). (-> B3,
  B4, Section 5.)
- **2026-06-26 -- Seam reads are pure derivations.** Added progress/nodeId/ending to the
  view as pure derivations of run state -- legitimate, not creep. GUARD: a read returning
  render-shaped data (colours, positions, clip names, camera angles) WOULD be creep; reject
  it. (-> B2, C.)
- **2026-06-26 -- Render-side scene composition is deliberately imperative (for now).**
  Correct while one consumer per scene type; not debt. Trigger to go data-driven: a second
  scene of an already-composed type. (-> B4, Section 6.)
- **2026-06-26 -- EXCEPTION: protagonist position is render-authored.** A named, bounded
  crack in the content<->render decoupling, so the next such case meets friction. (-> B4,
  Section 6.)
- **2026-06-26 -- Pedagogy: STORY-FIRST, VOLUME-DRIVEN, NO DRILL LADDER.** The spine.
  Full evidence (owner self-taught to 100wpm eyes-free by writing stories; a 7-year-old
  reached speed on the full-keyset story with hints). Eyes-free not fingering; home-row
  anchor kept; drills optional; technique handled reactively. (-> A1.)
- **2026-06-26 -- Scoring: completion + accuracy, ZERO speed at band-1.** Speed dropped
  entirely; rewarding it early breeds hunt-and-peck racing that fights eyes-free. Two runs
  equal in accuracy + correct chars but different in WPM score identically. Future bands may
  reintroduce speed BAND-GATED, never global. (-> A6.)
- **(This session) -- Cave is a setback that returns to the fork; post-cave fork is
  pre-revealed and bridge-only; score each node once per run; win opens the chest under a
  flash.** A wrong turn should scare-and-bounce, not restart; the recovery beat should land
  the child at the decision, not re-type a passage; revisits must not farm XP; the win
  should feel rewarding. (-> A7, A9, B4-win-intent.)

---

## 8. In-flight state, declared honestly: the profile/persistence layer

When this brief was written, the TS repo had a **profile/progress persistence layer
mid-build**: the privacy invariant, the `Profile`/`Progress` schema, the three-operation
`ProfileStore` seam, an in-memory impl, an HTTP client impl, a Node HTTP server, and a
MongoDB-backed impl (verified end-to-end against a local replica set, including
cross-restart durability). It was wired into the dev app (create a hero, play band-1,
XP/stars accumulate and persist). Tests cover the store contract and scoring->profile
accumulation.

**What transfers (Bucket A5):** the privacy invariant, the profile + progress schema, the
three-operation store contract, the HTTP API shape, and the no-auth-coupled-to-non-
identifying-data posture. All engine-independent.

**What does NOT transfer (Bucket C):** every line of the TS/Node/Mongo wiring -- the
driver code, the HTTP server, the Vite proxy, the class plumbing.

**Recommendation for the Godot repo:** do NOT port the TS backend, and do NOT block on a
backend at all for the first milestone. Build the game loop against a **single local
in-memory/file-backed `ProfileStore`** implementing the three operations (A5). The schema
+ invariant make a later HTTP/Mongo (or any) backend a drop-in behind the same interface.
The TS Mongo impl already proved the schema and API are sound, so there is no need to
finish or reference it as a "reference implementation" -- the SPEC in A5 is the reference.
Treat the TS repo as the fallback if a wire-format detail is ever in doubt.

---

## 9. Suggested Godot project shape (orientation, not prescription)

A way to lay out the Godot repo that respects the principles above. Adjust freely; the
buckets are the contract, this is a convenience.

- **Logic layer (pure, no nodes):** story-graph traversal + run state; typing comparison +
  stats; scoring; band/curriculum helpers; the asset-vocabulary + scene-descriptor data
  model; the safety-hash function; the seeded RNG. Plain scripts/resources, no scene-tree
  or `Input` access. (B2, B8.)
- **Axis data (resources):** locale catalogs (`nl-BE` first), keyboard layout tables
  (Belgian AZERTY first: physical position -> char + finger), asset vocabulary
  (id -> Godot resource). (A3, B1, B4, B6.)
- **Content (data):** the band-1 arc (A7) as data resources, with the per-locale safety
  records; the band spec. AUTHORED -- do not regenerate casually.
- **Render/UI (nodes/scenes):** scene composer (vocabulary-by-id, imperative staging for
  now, RED placeholder, protagonist-position exception); type-along text UI with the reveal
  window; on-screen keyboard with finger guidance; the `SceneActivity`-driven character
  animation with hysteresis; the win flash + chest-open; the setback vignette.
- **Input:** read physical key positions via Godot's input system; resolve through the
  layout table; feed the logic layer characters. (B1.)
- **Profiles:** one local `ProfileStore` (in-memory/file) behind the three-operation
  contract; non-identifying data only. (A5.)
- **Guards/tests:** logic-purity guard (no engine/scene/Input refs in the logic layer);
  content validator (every scene id resolves; every text key resolves in every locale;
  every choice/link target exists; safety hash matches; band limits hold; band carries no
  key/finger terms); scoring tests (including the fast-sloppy-cannot-win invariant); a
  visual-check habit for anything that adds/moves something on screen.

**Build order (IMPORTANT -- this inverts the obvious order ON PURPOSE).** Get a minimal
scaffold up so that composing ONE band-1 scene in the Godot editor happens as EARLY as
possible. That composition loop -- a scene descriptor (ids + anchors + mood + path) resolved
through the asset vocabulary into a staged Godot scene, with the protagonist walking the
path -- is the UNPROVEN HYPOTHESIS this whole migration exists to de-risk. The logic layer
is the opposite: it is a faithful translation of already-tested code (story traversal,
typing, scoring, the safety gate), so it is KNOWN-GOOD and low-risk. Therefore the FIRST
milestone must prove the COMPOSITION LOOP, not re-prove the logic. Concretely: stand up only
enough logic + one band-1 scene descriptor + the vocabulary to render that single scene
in-editor and walk the knight down the path; ONLY THEN build out the full logic port + its
tests, the type-along UI / finger guidance / reveal window, the remaining scenes and
flourishes, and profiles. Re-proving the known-good logic before testing composition would
spend the low-risk effort first and defer the actual experiment -- do not do that. Narration
toggle and additional bands are later.

---

## 10. One-paragraph essence (if you read nothing else)

Build a typing tutor that is really a branching fantasy gamebook for ages 6+, where a
child types unfolding Flemish prose to reveal a 3D-scened story and types a choice word to
pick forks. The teaching mechanism is VOLUME of motivated real typing, not drills:
full keyset from sentence one, on-screen finger hints, a kept home-row anchor, eyes-free as
the goal, technique fixed only reactively. Difficulty scales by length + word complexity,
never by gating letters; one band for the PoC, schema ready for more. Keep three axes
independent (story / language / keyboard) by carrying ids and keys, never words and model
paths. Score completion + accuracy with zero speed influence so fast-and-sloppy cannot win.
Gate every node's prose behind a per-locale content hash so edited text re-reviews before
shipping. Store only non-identifying profile data (opaque id, decorative hero name, coarse
progress) and let the no-auth posture rest on that. Carry the band-1 content and its safety
hashes verbatim. Rebuild input, render, and animation on Godot's native systems from the
principles in Bucket B -- and do not re-litigate the decisions whose reasoning is recorded
here.

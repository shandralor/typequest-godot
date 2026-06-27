# TypeQuest data schemas (draft, 2026-06-24)

The contract every later layer depends on: generation, the engine, and the renderer
all talk through these shapes. Drafted before any engine or build setup, because
they are the seam between the three orthogonal axes (HANDOFF sections 3-4).

No build is wired yet (no `package.json`/`tsconfig`); these are `.ts` so they will
type-check the moment the skeleton lands. They contain types and example data only,
zero engine logic.

## Files

| Schema | File | Axis |
| --- | --- | --- |
| Shared id primitives (`TextKey`, `NodeId`) | `core/types/ids.ts` | - |
| Story graph, node, choice, `StoryBand`, `SafetyReview` | `core/types/story.ts` | Story (structure) |
| Scene descriptor + asset vocabulary | `core/types/scene.ts` | Story (presentation) |
| Curriculum, key-set, drill, word list | `core/types/curriculum.ts` | Curriculum (+ language for words) |
| Keyboard layout + finger map | `keyboard/types.ts` | Keyboard layout |
| Locale catalog + narration | `i18n/types.ts` | Content language |
| Worked example (all of the above) | `content/example/woudpad_example.ts` | - |

## The one rule that makes the axes independent

**The story graph carries keys, never words, and ids, never models.**

- Narrative + choice words are `TextKey`s resolved against a `LocaleCatalog`. Swap
  the catalog (`nl-BE` to `fr-BE`) and the same graph plays in another language.
- Scenes are bags of ids drawn from an `AssetVocabulary`. Swap the art pack behind
  the vocabulary and the same graph renders from different models.
- Finger guidance comes from the `KeyboardLayout`'s `code -> char + finger` table.
  Swap AZERTY for QWERTY and the same prose is taught on another layout.

Adding a language, a layout, or a story therefore touches exactly one axis.

## Data flow (how a single beat plays)

1. Engine is at `StoryNode`. It reads `node.textKey`, resolves it via the active
   `LocaleCatalog` -> the **typing target** (the prose string).
2. As the child types, the typing engine compares characters to the target; for the
   next expected char it asks the `KeyboardLayout` for `CharGuidance` (which key,
   which finger) and the UI highlights it.
3. Finishing the prose reveals it; the child then types one `Choice.wordKey`'s
   resolved word to pick a fork -> `Choice.to` is the next `NodeId`.
4. In parallel, the renderer takes `node.scene` (a `SceneDescriptor`) and composes it
   from the `AssetVocabulary` named by `graph.vocabularyId`.
5. Drills (OPTIONAL side-practice, not the progression -- the story is) bypass the story:
   a `DrillLesson`'s `{kind:'words'}` step pulls from the `WordList` for the active
   `(locale, keySetId)`. Drills remain schema-supported but are never required.

## Validation invariants (future `architecture.test.ts` / content linter)

1. Every `SceneDescriptor` id resolves in its graph's `AssetVocabulary`: `location`,
   each `actors[].asset`, each `props[].asset`, every `mood`/`camera`.
2. Every `Actor.anchor` / `PropPlacement.anchor` is listed on that location's
   `anchors`; every `Actor.pose` is in that character's `poses`; every `camera` is in
   the location's `cameras`.
3. Every `TextKey` used by a graph (node `textKey`/`narrationKey`, choice `wordKey`)
   exists in every shipped `LocaleCatalog`. Missing key = build failure, no fallback.
4. Every `Choice.to` and `graph.start` references a node in `graph.nodes`.
5. (Optional drills only, if built) Each `WordList`'s words use only the cumulative chars
   unlocked through its `keySetId` in the named `Curriculum`. Still applies to any drills
   authored; drills are optional side-practice, never required. Story prose is NOT subject
   to this -- the free story uses the full letter set and is never letter-gated.
6. `core/` imports nothing from DOM/Three/network (the enforced seam).
7. For each shipped locale, every `StoryNode` has a `safetyReview` record whose
   `approvedContentHash` matches the freshly recomputed hash of the node's resolved
   prose in that locale. The linter recomputes and compares; a mismatch (prose edited
   under a stable `textKey`) blocks the build until re-review. Per-locale, so a Flemish
   edit re-triggers only the Flemish review. This is the human safety sign-off as an
   enforced build gate, not discipline.
8. Every node's prose conforms to its `StoryBand` limits: word/sentence length, vocab
   tier, and `charSet`. For the PoC's single `band-1` that means lowercase only, no
   AltGr, and no Shift at all (capitals are out of PoC scope until a later band).
9. `StoryBand` fields carry no key/finger terms -- story difficulty is linguistic +
   tempo only, which is what keeps story content decoupled from the keyboard layout.

## Resolved decisions (2026-06-24)

1. **Input scoring: PHYSICAL REMAP.** The engine scores on `KeyboardEvent.code` +
   the layout's `code -> char` table, not `event.key`. A child practises true Belgian
   AZERTY positions regardless of the OS's active layout. `KeyboardLayout` already
   encodes this; the engine must remap, not trust `event.key`.
2. **AltGr: NOT in the PoC.** PoC prose, choice words, and drills stay within base +
   Shift; no AltGr chord characters (@, euro, brackets) appear in content. The schema
   keeps the `altgr` slot for later languages/levels. A content linter should reject
   any PoC string containing an AltGr-only character.
3. **Capitalisation: LOWERCASE, and for the PoC NO SHIFT AT ALL.** Band-1 prose is
   all-lowercase. Because the PoC ships a single band (decision 7), Shift drops
   entirely from PoC scope -- not in content, not in keyboard guidance, not in the
   linter, not in the curation checklist. It returns only with a later band, as its
   own key-set. A future session must NOT add sentence-case prose to band-1.
4. **Story difficulty: FULL KEY SET + SCALED LANGUAGE.** Supersedes any story
   letter-introduction progression. The free-story track exposes home + top row from
   the first beat (all Dutch vowels are top-row), so prose is real Flemish from beat
   one. Difficulty scales via TEMPO (WPM/accuracy targets, time pressure, narration
   auto-advance) and LINGUISTIC complexity (sentence/word length, vocab familiarity,
   repetition) -- never by restricting letters. Encoded as `StoryBand` on the story
   axis, NOT in the track-1 `Curriculum` (invariant 9). Consequence: on-screen finger
   guidance is load-bearing from sentence one (the story no longer pre-teaches keys).
   The drill curriculum (key-sets / home-row) is unchanged and stays a separate,
   decoupled artifact -- OPTIONAL side-practice, not the progression (see the 2026-06-26
   progression decision in working-context.md), never required.
5. **Content pipeline: GENERATE + CURATE, spec-first.** Offline Claude generation
   against a difficulty spec WRITTEN BEFORE generation, then human curation against
   that fixed yardstick (not per-sentence judgment). The generator owns countable /
   mechanical constraints (word & sentence length, vocab tier, character set:
   lowercase band-1, no AltGr) -- linter-enforced (invariant 8). The human curator
   owns judgment: readability, engagement, and safety/age-appropriateness.
6. **Safety seam: SCHEMA GATE (content-hash, per-locale).** Resolves the "content
   safety is first-class but unschematized" gap. Every `StoryNode` carries a
   `safetyReview` keyed by content locale; each record holds an `approvedContentHash`
   (hash over the resolved prose the child actually reads) + `date` + `criteriaVersion`.
   Linter gate (invariant 7): for each shipped locale a record must exist whose hash
   matches the recomputed hash of the current resolved prose. A boolean was rejected
   because it stamps the node id while the child reads resolved prose -- so prose edited
   under a stable `textKey` (the normal generate-and-curate case) would stay green and
   ship un-reviewed. The hash diverges on change and forces re-review. Per-locale so a
   Flemish edit re-triggers only Flemish review, leaving a future French approval
   intact. The same gate guards the later live-expansion phase. (`criteriaVersion`
   stays a stub for a future conversation.)
7. **PoC difficulty: ONE BAND.** The PoC ships a single band (`band-1`, ~6-year-old):
   one flat set of limits + locked global rules. The schema stays multi-band-capable
   (nodes always tag `band-1` in the PoC); adding band 2 later is additive content +
   one spec row, never a migration (same reserve-the-dimension move as the AltGr slot).
   Guard: invariants and engine logic stay band-aware even with one band, so band 2 is
   data, not surgery.

## Not yet drafted (deliberately)

Profile/progress state and the typing-engine run-state/score types: those are engine
shapes, drafted with the `core/` skeleton, not content schemas. The `TypingTarget`
bridge (resolved prose + expected-char cursor) lands there too.

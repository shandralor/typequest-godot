# TypeQuest - Project Handoff (a typing-tutor RPG gamebook, built with Claude)

> **Status:** Concept LOCKED (2026-06-24). Named **TypeQuest** (project/working
> name; an audience-facing Dutch name can come later). Architecture proposed. No
> code yet.
> **Working folder:** `/mnt/professional/projects/code/typequest/`.
> **Reference repo (sibling):** `/mnt/professional/projects/code/world-of-claudecraft/`
> **Purpose of this doc:** A complete, self-contained capture so any future session
> (or the user months from now) resumes with full context without re-deriving anything.

---

## 1. Why this project exists

The user (Tom, tom.teck@gmail.com) has long wanted to build a game **together with
Claude** but never knew how to start. We studied a real solo-dev + Claude Fable
game (World of ClaudeCraft) for its architecture and asset strategy, then defined
our own original game and locked the concept.

---

## 2. THE GAME (concept, locked)

**A gamified touch-typing tutor disguised as a branching fantasy gamebook.**

A child reads and *types* an unfolding story shown as lightly-navigable 3D scenes
built from open-source (CC0) fantasy art. Typing the narrative reveals the story;
typing the choice word picks the fork (e.g. go left / go right). Real typing
pedagogy underneath, but **motivation-first and heavily gamified**. Target age
**6 and up**; difficulty scales with reading + typing level.

### Locked decisions
- **Content production: HYBRID, generate + curate (spec-first).** PoC ships a curated,
  pre-generated branching story tree: offline Claude generation against a difficulty
  spec written BEFORE generation (generator owns the mechanical limits, linter-
  enforced), then human curation for readability, engagement, and safety. Every node
  carries a per-locale `safetyReview` gate keyed by a content hash of the resolved
  prose; the linter recomputes and blocks any locale whose prose changed since sign-off
  -- nothing ships un-reviewed. **Live runtime expansion is a later phase** reusing the
  same gate plus asset-vocabulary validation.
- **Typing instruction: STORY-FIRST, volume-driven (single spine).** What teaches typing
  is the VOLUME of motivated real typing in the story, not finger drills. Full keyset from
  the first beat (all Dutch vowels reachable immediately); difficulty ramps by story LENGTH
  and word COMPLEXITY (word length, vocabulary familiarity), NEVER by gating letters.
  Load-bearing on-screen finger guidance from sentence one, with the home-row anchor (f/j)
  taught from the start as the one kept scaffold (not a technique rule). The deliverable is
  EYES-FREE typing, not canonical fingering. Constrained key-set DRILLS remain possible as
  OPTIONAL targeted side-practice (schema-supported, decoupled), but they are NOT the
  progression and NOT required. (Full rationale + evidence: `docs/working-context.md`,
  2026-06-26 progression decision.)
- **Reading support: audio narration as an optional toggle.** TTS or recorded
  narration plus live letter/word highlighting; defaulted on by age/level (a
  6-year-old often cannot read fluently yet), toggleable for older kids.
- **What the child types: BOTH** the narrative passage (to reveal/read it) **and**
  the choice word (to branch). Maximizes teaching per scene.
- **3D: lightly navigable scenes.** Each story beat shows a composed 3D scene with
  idle animations and small camera/character movement; not a full open world.
- **Gamification: XP, stars, unlockable companions, and multiple kid profiles**
  with saved progress (siblings / classroom). Rewards are cosmetics/companions
  drawn from the CC0 packs.
- **Platform: web app, physical keyboard, desktop/laptop.** Stack mirrors the
  reference: TypeScript + Three.js + Vite, tiny dependency set. A real keyboard is
  required for a typing tutor (tablets/on-screen keyboards undermine the goal).
- **PoC language + keyboard: Flemish (Belgian) Dutch content on Belgian AZERTY
  (`be-latin1`).** NOT French AZERTY (they differ in symbol/number positions;
  Flanders uses Belgian). Multiple languages and keyboards are foreseen.

---

## 3. The load-bearing architectural insight: THREE ORTHOGONAL AXES

Keep these three independent so adding a language, a keyboard, or a story never
touches the engine:

1. **Story** - a language-agnostic branching graph (nodes, forks, scene
   descriptors). No words baked into structure.
2. **Content language** - Flemish Dutch now; the words, narration, locale
   formatting. (Mirrors the reference's strict `t()` i18n discipline.)
3. **Keyboard layout** - Belgian AZERTY now; physical-key -> character mapping
   plus the finger map used for on-screen guidance.

**Language is NOT the same axis as keyboard.** "Flemish Dutch on AZERTY" is one
(content, layout) pair. Adding Walloon French, QWERTY, or a translated story each
touches exactly one axis. This is the entire future-proofing strategy.

---

## 4. Proposed architecture (the reference's lessons, applied)

- **`core/` - deterministic, zero DOM/Three/network, seeded RNG, fully unit-tested
  under Vitest.** Contains:
  - **Story-graph engine**: node traversal, fork resolution, run state.
  - **Typing engine**: compares typed *characters* to the target text; scores
    accuracy, WPM, and per-key error stats; deterministic and replayable.
  - **Curriculum (optional drills)**: key-sets and per-key-set word lists for OPTIONAL
    targeted side-practice. NOT the progression (the story is) -- the story-difficulty ramp
    lives on the story axis (StoryBand), not here.
  - **Profile/progress** state.
- **`content/` - data-as-code:** story trees (localized text keys), drill lessons,
  **per-key-set word lists per language**, scene descriptors, reward/cosmetic defs.
  New content is declarative and cannot break engine logic.
- **A seam** (the project's `IWorld` equivalent, e.g. `IGameView`): render, UI, and
  audio read game state through one interface, never a concrete engine class.
  Enforce with an architecture test that scans `core/` for forbidden imports.
- **`keyboard/`**: layout definitions (Belgian AZERTY first), key->char, finger map,
  on-screen keyboard model. Independent of language.
- **`i18n/`**: locale catalogs (Flemish Dutch first) + formatting. Independent of layout.
- **`render/` (Three.js):** a **scene composer** that turns a node's declarative
  scene descriptor into a posed, lightly-navigable scene from the CC0 asset
  vocabulary; the on-screen keyboard with finger highlighting; the type-along text UI.
- **`audio/`**: narration (TTS or recorded) + key sounds; optional toggle.
- **`app/`**: raw input capture (keydown -> engine), main loop, profile selection.

### The "generation drives graphics" twist, solved
Offline generation emits, per story node, BOTH the localized text AND a
**structured scene descriptor constrained to a fixed CC0-asset vocabulary**
(location + characters + mood, only referencing assets we actually shipped). So the
graphics can always follow the story, because the story can only reference scenes
we can render. Live expansion later reuses the same schema plus a safety +
asset-vocabulary validation pass.

### Determinism & testing
Typing scoring, the curriculum helpers, and story traversal are all pure and
unit-tested. An architecture test forbids DOM/Three imports in `core/` (copied from
the reference's `tests/architecture.test.ts` idea).

---

## 5. PoC scope (proposed)
- One short Flemish-Dutch fantasy arc (~12-20 nodes, a couple of forks).
- Belgian AZERTY layout + on-screen keyboard with finger highlight.
- The free story arc itself (the progression). Drills are OPTIONAL side-practice, not
  part of the core PoC.
- TTS narration toggle.
- ~4 scene types from KayKit/Quaternius (village, forest path, dungeon, creature
  encounter), lightly navigable.
- XP + stars + 1-2 unlockable companions; local kid profiles.
- Validate on the 6-8 age band; engine scales upward.

---

## 6. The reference project (World of ClaudeCraft) - condensed

`levy-street/world-of-claudecraft`, cloned at `../world-of-claudecraft/`. A
classic-WoW-style browser MMO + headless RL env, one person + Claude Fable, MIT.
Stack: TS (ESM strict) + Three.js r165 + ws + Postgres + Vite/esbuild + Vitest.

Ideas we are copying:
- **One deterministic sim core runs in three hosts** (offline browser, server, RL);
  same seed -> same world. `IWorld` (`src/world_api.ts`) is the only seam; render/ui
  never import a concrete world. Enforced by `tests/architecture.test.ts`.
- Determinism: fixed 20 Hz tick, all randomness via `Rng` (never Math.random/Date.now).
- Content as declarative data in `src/sim/content/`.
- Strict `t()` i18n across 14 locales.

**Asset reality (important):** the README's "procedural everything" is overstated.
The 3D models are **bought/downloaded CC0 packs**, not procedural: KayKit
(characters, skeletons, dungeon), Quaternius (creatures, nature, village), Kenney
(kits, particles). 710 GLBs, ~46 MB. Class ability icons are CraftPix premium
(purchased). What IS procedural: terrain, runtime textures (CanvasTexture),
placement/scatter, VFX, skyboxes. See `CREDITS.md` in the reference.

---

## 7. Build philosophy (the takeaways driving us)
1. **Buy/download CC0 art; engineer the systems.** Holy trinity: KayKit
   (kaylousberg.itch.io), Quaternius (quaternius.com / poly.pizza), Kenney
   (kenney.nl). All free, commercial-OK, fantasy-themed (fits our story).
2. **Separate "what happens" from "how it looks"** - a pure, headless-testable core.
3. **One seam, enforced by a test.**
4. **Content as declarative data**, never inline in engine code.
5. **A great CLAUDE.md per area**, loaded on demand.
6. **Deterministic core + seeded RNG** = reproducible bugs, replay, automated tests.
7. **Tiny dependency set**; reach for the platform (Canvas, WebAudio) before a lib.

---

## 8. Decisions log
- Reference repo kept as **sibling** at `code/world-of-claudecraft` (no nested copy).
- Handoff strategy: maximum durable capture (this doc + project `CLAUDE.md` +
  persistent memory), not reliance on a session log.
- Concept, story-first typing (single spine; drills optional, see Section 2 + the
  2026-06-26 progression decision in working-context.md), audio toggle, lightly-navigable
  3D, XP/stars/profiles, web + physical keyboard, Flemish-Dutch + Belgian AZERTY PoC: all
  locked (Section 2).
- Engine approach: **hand-rolled TS + Three.js + Vite**, mirroring the reference.
- Story difficulty model: FULL KEY SET + SCALED LANGUAGE (2026-06-24, supersedes story
  letter-introduction progression). Story complexity is linguistic + tempo only,
  encoded as `StoryBand` on the story axis; any letter/finger practice lives in the
  optional track-1 drills (side-practice), not in the story. Finger guidance is
  load-bearing from sentence one.
- Content pipeline: GENERATE + CURATE, spec-first (2026-06-24). Spec authored before
  generation; generator owns countable limits (linter-enforced), human owns judgment
  (readability, engagement, safety).
- Safety seam: SCHEMA GATE, content-hash per-locale (2026-06-24). `StoryNode.
  safetyReview` is keyed by content locale; each record is `approvedContentHash` (hash
  of the resolved prose the child reads) + date + criteriaVersion. Linter recomputes
  and blocks any locale whose prose changed under a stable textKey. A boolean was
  rejected (it stamps the node id, not the text the child reads). Per-locale so a
  Flemish edit re-reviews only Flemish. Scales to live expansion unchanged.
- PoC difficulty: ONE BAND (2026-06-24). Single `band-1` (~6yo); schema stays
  multi-band-capable (band 2 = additive data, not a migration). Consequence: PoC is
  fully lowercase, no Shift in scope at all (not content, guidance, linter, or
  curation). Shift returns only with a later band.

## 9. Open / next steps
- [x] Named **TypeQuest**; folder renamed to `code/typequest/` (2026-06-24).
- [x] Scaffold the skeleton (2026-06-24). Vite + TS (ESM strict) + Vitest wired
      (`package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`,
      `index.html`). Pure `core/`: `rng`, `hash`, `story-graph`, `typing`,
      `curriculum`, the `IGameView` seam (`game-view.ts`), and `engine.ts`
      (`GameEngine` implements the seam, takes a `Resolver` so core never imports
      i18n). Content linter in `lint/validate.ts` (invariants 1-5, 7-9). Render:
      `render/scene-composer.ts` (Three.js placeholders, unknown assets render RED)
      + `render/keyboard-view.ts` (DOM AZERTY, finger colours, highlight) + `app/
      main.ts` wiring keydown -> physical-remap -> engine. `tests/architecture.test.ts`
      enforces invariant 6 (scans `core/`, comment-stripped, also bans
      Math.random/Date.now). Verified: `tsc --noEmit` clean, 121 tests pass,
      `vite build` succeeds. Run: `npm run typecheck` / `npm test` / `npm run dev`.
- [~] Define the data schemas: DRAFTED 2026-06-24. Type files at their axis homes
      (`core/types/{ids,story,scene,curriculum}.ts`, `keyboard/types.ts`,
      `i18n/types.ts`), a worked example threading all axes
      (`content/example/woudpad_example.ts`), and the contract doc
      `docs/schemas.md` (data-flow + validation invariants). Build not wired yet.
      Decisions RESOLVED 2026-06-24: physical-remap input scoring (score on
      KeyboardEvent.code, not event.key); no AltGr in PoC content; PoC fully lowercase
      / Shift out of scope; story difficulty = FULL KEY SET + SCALED LANGUAGE via
      `StoryBand` (no letter-gating); content pipeline generate+curate spec-first;
      safety SCHEMA GATE via `StoryNode.safetyReview`; PoC ships ONE band.
- [x] Author a throwaway engine-validation arc (2026-06-24): `content/test-arc/
      test_arc.ts`, tagged `test-band` (NOT band-1). 5 nodes / 1 fork / 2 endings,
      forest_path + dungeon scenes, one narration node + four without, lowercase
      Flemish (~8-10yo) spanning all keyboard rows, real per-locale FNV-1a safety
      hashes. Verified: `validateContent` returns [] (invariants 1-5,7-9), tsc clean,
      tests pass, `vite build` + `vite dev` both succeed.
- [x] Lift the Belgian AZERTY layout onto the keyboard axis (2026-06-25):
      `keyboard/be-azerty.ts` (3 letter rows + space + period, provisional be-latin1).
      Removed from `content/test-arc/test_arc.ts`; the woudpad example now re-exports it
      (single `be-azerty` source). app + any arc import the layout from the keyboard
      axis, so deleting the throwaway test arc no longer breaks band-1's keyboard.
- [~] Author the REAL band-1 arc: DONE for the story (2026-06-24),
      `content/band-1/band1_arc.ts`, tagged `band-1`. Target age 6 (provisional;
      older bands later). 5 nodes / 1 fork / 2 endings, forest_path + dungeon,
      lowercase Flemish, narration on every node, real per-locale FNV-1a hashes.
      Band spec provisional: `maxWordLen: 7` (replaced the example's placeholder 10),
      `maxSentenceLen: 10`. Validated clean (invariants 1-5,7-9). The woudpad example
      band was renamed `band-1` -> `example-band` to avoid two conflicting band-1
      specs. Home-row DRILLS deliberately NOT authored: per the 2026-06-26 progression
      decision, drills are OPTIONAL side-practice, not the progression (which is the
      story), so band-1 needs none -- and the home-row-has-no-vowels problem is dissolved
      (no motor drill ladder to climb). maxWordLen 7 evidence captured in
      working-context.md.
- [x] Render layer now exists (2026-06-26): band-1 plays with real CC0 models (NOT
      placeholder boxes) -- reference-borrowed lighting/animation/locomotion + per-scene
      composition, all render-side; `core/` stays pure and the architecture guard is
      green. Render decisions + rationale (incl. a "reference behaviour does not transfer
      1:1" flag) live in `docs/working-context.md` -- pointer, not a copy; that file is
      the single source of truth for them.
- [ ] OPTIONAL (not on the critical path): build track-1 drills as side-practice if ever
      wanted. They are NOT the progression (the story is) and NOT required -- see the
      2026-06-26 progression decision in working-context.md.
- [ ] Write per-area CLAUDE.md invariants once the skeleton exists.

## 10. How to resume
Conversation continuity in Claude Code is per working directory:
- From this folder: `claude --continue` (most recent) or `claude --resume` (picker).
- NOTE: the originating conversation ran in the PARENT dir
  (`/mnt/professional/projects/code`), resumable from there - which is why this doc
  is the real handoff.

A fresh session in this folder should read, in order: `CLAUDE.md` (auto-loaded) ->
this `docs/HANDOFF.md` -> the reference at `../world-of-claudecraft/`.

Folder is `code/typequest/` (renamed from the provisional `game-project` on
2026-06-24).

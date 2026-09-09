# CLAUDE.md -- TypeQuest

Cross-device context carrier. Committed on purpose: it is how a session on any
machine recovers state. Read this first, then `docs/working-context.md`.

## What this is

A gamified touch-typing tutor disguised as a branching fantasy gamebook for ages
6+. A child reads and TYPES unfolding Flemish (Belgian Dutch, AZERTY) prose to
reveal a lightly-navigable 3D story, and types a choice word to pick forks. The
teaching mechanism is VOLUME of motivated real typing, not drills.

## Where the live code is (READ THIS FIRST)

The game is **`web/`** -- Three.js + TypeScript + Vite. Since 2026-09-09 that is the
one build that ships. `cd web && npm run dev`.

**`godot/` is REFERENCE ONLY.** It holds the Godot 4.7 implementation the web build
was ported from (a clean-room reimplementation of an even earlier TS project, guided
by the migration brief). Do not add features there. When porting a behaviour, read
the `.gd` and carry its constants VERBATIM -- that is how the camera rigs, finger
colours and scoring stayed identical. See `godot/README.md`.

`assets/` at the repo root is the shared art + music store; both trees symlink into
it. The pure Godot tree, before the web build landed on main, is preserved on the
`godot-reference` branch.

## Sources of truth (read in this order)

0. `docs/working-context.md` -- the LIVE state + next step. Start here.
1. `docs/MIGRATION-TO-GODOT.md` -- the design source of truth (engine-neutral). Bucket-sorted:
   A = carry verbatim, B = principle survives but re-derive the Godot mechanism,
   C = dropped. Honor its **Prime Directive**: these decisions were made
   deliberately against naive defaults; do NOT re-litigate or silently simplify
   them. Treat `AUTHORED -- DO NOT REGENERATE` markers literally.
2. `web/README.md` + `web/docs/` (editor blueprint, rendering playbook) -- the LIVE
   implementation guide. `docs/godot-handoff.md` is the same guide for the reference
   tree: still the best description of how a behaviour is SUPPOSED to work.
3. `HANDOFF.md`, `docs/schemas.md`, `docs/visual-checks.md` -- carried durable docs
   (from the TS project; some wording is TS-era -- the migration brief wins on any
   conflict). `docs/outreach-kaykit-nl.md` -- the asset-creator outreach message (NL).
4. `docs/working-context-legacy-ts.md` -- the FIRST TypeScript project's working context
   (pre-Godot), kept for reference only.

## Canonical path

`/mnt/professional/projects/code/typequest-godot/typequest`

Matching this path across devices is a **convenience, not the sync mechanism**.
The GitHub remote is the sync mechanism.

## Cross-device workflow (the rule)

Conversation history (`--continue` / `--resume`) does NOT sync between physical
devices. Cross-device continuity is: **git pull, then read CLAUDE.md +
docs/working-context.md.** Therefore every working session ends by updating
`docs/working-context.md` with current state + next step, then commit and push.

## House style (carry it)

No em dashes, no en dashes, no emojis in code, docs, or commits. Use `--`.
Conventional Commits with a scope. Credentials come only from the environment,
never committed.

## Architecture guardrails (from the brief)

- **Three axes stay independent:** story graph (keys + ids, never words/models),
  content language (nl-BE now), keyboard layout (Belgian AZERTY now). Adding a
  language or layout must touch exactly one axis.
- **Pure logic layer:** story traversal, typing compare/stats, scoring, the
  FNV-1a safety hash, seeded RNG, the progress primitive -- plain modules under
  `web/src/logic/` with NO DOM / three.js / render / network access. Randomness via
  injected seeded RNG; time injected.
- **Composition is imperative for now (B4):** one consumer per scene type,
  hand-staged. Do not build the data-driven anchor-default system until a SECOND
  scene of an already-composed type exists. Protagonist position is render-authored
  (the one named exception). Unknown asset id -> loud RED placeholder.
- **Safety gate (A4):** per-locale FNV-1a content hash over resolved prose. A
  failing hash means fix the PROSE encoding to be byte-identical, NEVER regenerate
  the hash.
- **Scoring (A6):** completion + accuracy only, ZERO speed at band-1. Fast-sloppy
  must not out-score careful.
- **Privacy (A5):** profiles store only non-identifying data (opaque id, decorative
  hero name, coarse progress). The no-auth posture rests on that; adding any
  identifying field reopens it.

## Current milestone

The web build is the direction and band-1 is at parity. Open: fold the last Godot-era
docs forward, and the deferred perf/optimization pass. See `docs/working-context.md`.

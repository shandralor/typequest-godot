# CLAUDE.md -- TypeQuest (Godot)

Cross-device context carrier. Committed on purpose: it is how a session on any
machine recovers state. Read this first, then `docs/working-context.md`.

## What this is

A gamified touch-typing tutor disguised as a branching fantasy gamebook for ages
6+. A child reads and TYPES unfolding Flemish (Belgian Dutch, AZERTY) prose to
reveal a lightly-navigable 3D story, and types a choice word to pick forks. The
teaching mechanism is VOLUME of motivated real typing, not drills. This repo is a
clean-room Godot 4.x reimplementation guided by a migration brief -- NOT a port of
the old TypeScript/Three.js code.

## Sources of truth (read in this order)

1. `docs/MIGRATION-TO-GODOT.md` -- THE handoff and source of truth. Bucket-sorted:
   A = carry verbatim, B = principle survives but re-derive the Godot mechanism,
   C = dropped. Honor its **Prime Directive**: these decisions were made
   deliberately against naive defaults; do NOT re-litigate or silently simplify
   them. Treat `AUTHORED -- DO NOT REGENERATE` markers literally.
2. `HANDOFF.md`, `docs/schemas.md`, `docs/visual-checks.md` -- carried durable docs
   (from the TS project; some wording is TS-era -- the migration brief wins on any
   conflict).
3. `docs/working-context.md` -- the LIVE state + next step (update it every session).
4. `docs/working-context-legacy-ts.md` -- the TS project's working context, kept for
   reference only.

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
  FNV-1a safety hash, seeded RNG, the progress primitive -- plain GDScript with NO
  Node / scene-tree / Input / render / network access. Randomness via injected
  seeded RNG; time injected. (Logic port is the NEXT milestone, not yet done.)
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

Scene-first (brief Section 9): prove the editor composition loop with ONE band-1
scene before porting the known-good logic. See `docs/working-context.md`.

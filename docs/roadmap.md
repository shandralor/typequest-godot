# TypeQuest -- Roadmap / Backlog (living)

Captured 2026-07-16. This is the ordered idea list for TypeQuest -- the seeded backlog
(already-deferred work) plus a batch of new owner ideas, sequenced into build waves.
Nothing here is a committed build until it graduates into its own focused plan/session.

House rules that constrain everything (from CLAUDE.md / the brief): band-1 = completion
+ accuracy, ZERO speed; the three axes stay independent (story graph / content language
/ keyboard layout); composition stays imperative until a 2nd consumer exists (B4);
privacy A5 (no identifying data); typed prose stays lowercase, no Shift/AltGr; read-aloud
text may use full punctuation; per-locale FNV-1a safety hash over resolved prose (A4).

---

## Proposed build order

Two FOUNDATIONS unblock most ideas: (1) the objectives / flag / conditional-content
spine, and (2) real persistence / profiles (A5). One DESIGN KNOT is settled early --
variant/dynamic prose vs. the A4 safety hash + band limits -- because G1/G6/G7 depend on
it. De-hardcoding (G8) happens incrementally, as each feature provides the "second
consumer" B4 was waiting for. Quick wins + the optimization pass slot in opportunistically.

**Wave 1 -- foundations + the first full loop**
1. Objectives / discoverability (A): map badge on the target site + a short read-aloud
   nudge, authored as DATA. First objective: "get your bow." [ready now]
2. Bow fetch payoff (B): return-home fetch -> sets has_bow_a; completes objective #1 and
   proves the loop end-to-end. [ready now]
3. DESIGN SPIKE (decision, not a big build): variant/dynamic prose vs. A4 hash + band.
   Gates G1/G6/G7 -- cheap to decide, expensive to get wrong later.
4. Persistence / profiles foundation (C/A5): persist stats + flags + a profile
   (AppProgress -> a ProfileStore contract). Unblocks G2/G3/G9 + "earned" content.

**Wave 2 -- player-facing surfaces on the foundations**
5. Quest log scroll (G4): renders the same objectives DATA as Wave-1 #1.
6. Progress screen (G9): persisted stats, encouraging + never-judgmental framing.
7. Character choice + variety (G1/G2): needs #3 + #4 + de-hardcoding HERO_MODEL. The big
   one; the G8 hotspots (scenario/win-branch table, house-item lock list) land here.

**Wave 3 -- diversity on characters + flags**
8. Item/character-gated scene variants (G6 + G7): skeleton flees when armed; magelight vs.
   lantern; the extra forest path. Uses #3's resolution + conditional composition.
9. Outfit recolours as star rewards (G3): cosmetic; needs #4 + characters.
10. Harder archery difficulty (B): unlocks bow_B; a variant scene riding #8's patterns.

**Wave 4 -- bigger world + playful modes**
11. Island expansion (G5): reveal-by-flag region; when there is content to expand toward.
12. Typing fight (G10): word-choice combat; self-contained, richer once #8 exists.

**Anytime / parallel**
- Intro rise + framing polish (E): small quick win.
- Optimization pass (F): before the big content push (Wave 2+); standing memory note.
- Composer Phase-4 refactor (F): folds into the G8 de-hardcoding during Waves 2-3.

---

## Seeded backlog (already deferred before this session)

- **A. Objectives / discoverability** (owner-confirmed: map badge + nudge, reusable):
  `content/objectives.gd` data list -- each = { active-on-flag, target site, done-on-flag,
  short hint }. Overworld badges the target site; a read-aloud nudge fires on activation.
  Reuses AppProgress flags. First objective: "haal je boog" (active archery_done, target
  thuis, done has_bow_a).
- **B. Bow fetch payoff**: return-home visit walks to a `bow_point`, takes the unlocked
  bow (reuse house_pickup_*/_attach_to_hand), sets has_bow_a. **Harder archery
  difficulty**: sets archery_hard_done -> unlocks bow_B; plus the deferred "fewer errors
  -> closer to centre" archery mode (A6: never reward speed).
- **C. A5 profiles / persistence**: XP + stars persist across runs (today only intro_seen
  + flags persist, per-machine); hero-name picker; multi-profile roster; sites EARNED.
  **Star-total rewards**: cosmetics/upgrades keyed off total stars (NOT the bow gates).
- **D. More content**: house items (shield exists; cloak = a recolor/mesh-swap, not a
  standalone model); per-scenario music (a folder + one play_context call).
- **E. Intro polish**: the getting-up reads as rising through the bed/floor + the framing
  is unbalanced -- move the rise point beside the bed + rebalance the fixed camera.
- **F. Tech**: optimization pass (draw calls / instanced models, texture/atlas, ~34MB+
  committed art -> Git LFS if history bloats, re-composition cost, per-frame work);
  composer Phase-4 refactor (mechanics -> effect components, was deferred per B4).

---

## New ideas (this session)

- **G1. Character variety (shared rig, dynamic subject noun)**: reuse all KayKit
  Adventurers on the shared Rig_Medium (Knight, Barbarian, Mage, Ranger, Rogue; the Mage
  themed/recoloured as "de goede heks"/"de druide"). A character = { model, subject noun,
  gear set }. Hook: swap HERO_MODEL in render/hero_rig.gd (verify each has Skeleton3D +
  handslot.l/.r). The dynamic subject ("de ridder" -> "de goede heks") is the thorny bit
  (see the design knot). Each character's gear lives in the house, shown/hidden by
  character + flag (reuse set_house_item_locked + a character filter).
- **G2. Character choice screen**: a roster/picker (reuse menu_banner/menu_screen); the
  choice persists (AppProgress / A5). The hero-name picker becomes a hero-CHARACTER picker.
- **G3. Outfit recolours as star rewards**: material tint on the character mesh, unlocked
  by star totals. Merges with C + G1/G2. Cosmetic only; never touches band-1 scoring.
- **G4. Quest log on a scroll texture**: a readable parchment log; EXTENDS A (same
  objectives data). Age 6: keep lines short + icon-led, never a wall of text.
- **G5. Island expansion on requirements**: the hand-authored hex island grows by flag.
  Cleanest: author the full island, HIDE the locked region (tiles + site + route) until a
  flag reveals it (fade/pop-in). Avoids procedural generation. Camera reads set markers.
- **G6. Item-gated world changes / logic puzzles**: scenes change on collected items/flags
  (skeleton flees once armed; an extra forest path opens) -> revisits. Needs conditional
  scene composition + a per-flag PROSE VARIANT (same hash/band tension as G1).
- **G7. Switch / earn a 2nd character -> ability-gated diversity**: obstacles cleared by
  an INNATE ability OR a collected item (cave dark: Mage magelight vs. others fetch a
  lantern). Gate checks has_ability(x) OR has_item(y). Ties G1/G2 + G6 + C. The diversity
  engine, but the most system-heavy -- sequence after the foundations.
- **G8. De-hardcode into data-driven/reusable** (governing principle): where something is
  hardcoded and will vary, make it a variable / reusable function / data row, so adding
  content is DATA not editing branches. The expansion ideas ARE the "second consumers" B4
  waited for. Hotspots: HERO_MODEL (G1); prose subject/beats (G1/G6); scenario registry +
  is_work/archery/house branches in _resolve_ending/_process/_camera_rig -> a per-scene
  handler table (relates to F); house item locks -> a data list; overworld sites/markers
  -> reveal-by-flag (G5); objectives as data from the start (A/G4).
- **G9. Progress screen -- encouraging, NEVER judgmental** (hard pedagogical constraint):
  show ACCUMULATION/growth (words typed, adventures done, stars, collectibles, map filling
  in, a growing tree/garden), positive framing -- never grades/percentages, no ranking, no
  "you failed". Needs persisted stats (A5/C); privacy A5 (non-identifying only).
- **G10. Interactive typing "fight"**: type ONE of 3-4 offered words -> attack/defense;
  combos give outcomes (scare vs. frighten vs. get-stuck). Extends the choice mechanic
  (ui/choice_banner.gd + story-graph choices); a small rules table maps word(combos) ->
  outcome. Outcomes can depend on item/character (G6/G7). NON-punishing (G9): a "wrong"
  word is just a different, retry-friendly outcome, never a fail.

---

## Cross-cutting design decisions (decide before the dependent builds)

- **Dynamic / variant prose vs. A4 hash + band limits** (G1 + G6): the biggest one. A
  per-character SUBJECT and per-flag scene VARIANTS both mean one scene can resolve to
  several prose strings, each of which today needs its own hash. Reshapes the content
  model -- needs its own mini-design (Wave-1 #3) before any character or puzzle work.
- **Where character/cosmetic/progress state lives**: pushes A5 profiles (C) earlier --
  character choice, star cosmetics, and the progress screen all want real cross-run
  persistence, not just per-machine flags.
- **Reading load for age 6** (G4 + dynamic text): keep typed prose short; keep the quest
  log terse + visual.

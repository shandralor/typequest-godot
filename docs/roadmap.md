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

## Session 2 additions (2026-07-16, batch 2) -- review pass + campaign spine

Owner play-tested Wave 1 and added near-term fixes, an intro/house rework, and a CAMPAIGN
PROGRESSION SPINE (forest first, cave obligatory, meeting the skeleton unlocks the rest).
Some REWORKS just-built pieces (the intro fetch-quest, all-sites-unlocked, gold treasure).
The campaign spine becomes "Wave 1.5" between the done Wave 1 and the Wave 2 surfaces.

**Near-term fixes (a cleanup pass first)**
- **F1. Snap the eyeballed south hexes to the grid** (overworld.tscn). Grid = x multiples
  of 3, z multiples of 5.196, rows alternate parity. Owner's placed ~z15.573/x2.958,8.900
  -> 15.588 / 3, 9; water ~z20.833 -> 20.784.
- **F2. Fix the rise-from-bed animation**: knight rises through the bed/floor -> move the
  rise point beside the bed + rebalance the fixed intro camera.
- **F3. Fix the smidse see-through** (forge.gd): outside shows on the right at the end ->
  add/extend the right wall or fix the win-camera framing.
- **F4. Forest transition beat**: after a choice word (grot/brug), walk the knight toward
  the chosen path ~1-2s before composing the next scene (no brutal cut).

**Intro + house items rework**
- **H1. Intro = a MORNING WALK**; the sword + keys are LOOKED AT, not taken (a hint says
  come back / needed later). Remove the pickup legs from intro.prose -> re-hash. Flows into
  scenario 1 (the forest, the only unlocked site per C1).
- **H2. Sword + keys become CONDITIONAL house items** (like the bow): visible, fetched
  later when their requirement is met, hidden once collected. 2nd/3rd consumer -> GENERALISE
  `_apply_house_locks` + house_pickup_* + has_<item> flags into a DATA list (the G8 hotspot).

**Campaign progression spine (Wave 1.5)** -- C1-C4 below are SUPERSEDED by "Campaign
spine v2" (see the next section); kept for reference. Forest/campaign build is ON HOLD.
- **C1. Sites are EARNED**: only bos open at start; smidse + boog locked until
  `met_skeleton` (overworld.gd `unlocked` -> flag check; locked shows overworld.locked).
- **C2. Cave obligatory before the bridge -- FENCE gate**: keep the kruispunt fork, but a
  fence locks `brug` until the cave is done; seeing the skeleton sets `met_skeleton`, then
  the knight JUMPS THE FENCE out of fear to cross (slight naGrot/brug text edit -> re-hash).
- **C3. Post-cave cutscene**: the hero realises they must TRAIN + MAINTAIN WEAPONS before
  facing the skeleton -- motivates the smidse + boog just unlocked.
- **C4. Bridge treasure is NOT gold** -- a hint / first COLLECTIBLE that appears in the
  house (rework schat.prose + reward; ties to H2 + objectives). Which collectible: TBD.

**Overworld life**
- **O1. Windmill**: animate the blades turning; make it a destination that shows a "come
  back later" (overworld.locked) banner on arrival. A placeholder site.

**Design / UX**
- **U1. Transparent scoring**: stars/xp come from ACCURACY (scoring.gd: xp = 20 +
  correct_chars x (0.5+0.5xacc); stars done->1 / >=.85->2 / >=.95->3; zero speed). Make it
  visible + encouraging (win / progress screen), never judgmental. Folds into G9.
- **U2. Reuse the choice banners** (ui/choice_banner.gd) in more scenes (cutscene, G10).

Re-sequence: F1-F4 + O1 (cleanup) -> Wave 1.5 campaign (see v2 below) -> U1 with the
progress screen -> then Wave 2 (quest log, progress screen, characters).

---

## Campaign spine v2 (2026-07-17, revised) -- SUPERSEDES C1-C4. BUILD ON HOLD.

Owner revised the opening into a hub-and-spoke: FAIL at the cave -> TRAIN in three
places -> BEAT the skeleton -> find the BRIDGE KEY -> next region. Forest changes (the
C2 fork-lock etc.) are on hold pending this design; F4's fork walk-beat stays (harmless,
reusable). New shape:

1. **Only the grot (cave) is open first.** The knight enters; the skeleton FRIGHTENS him
   -- he flees, unprepared. No fight yet. (This is why he "jumps the fence out of fear"
   framing from C2 evolved into fleeing to train.)
2. The scare motivates TRAINING -- three activities become available:
   - **Bow** -- train at the archery range (boog).
   - **Sword** -- sharpen it at the smithy (smidse, the grinding scenario).
   - **Strength** -- get strong at the MILL (windmill): a NEW scenario where he CARRIES
     BAGS, with a CHOICE of where to put each bag (word-choice per bag -> reuses the
     choice banners [U2], G10-adjacent; non-punishing per G9).
3. After all three training activities AND beating the skeleton (re-enter the grot, now
   prepared -> a WINNABLE skeleton beat -- likely the typing-fight G10 / an armed variant
   G6), he FINDS SOMETHING in the grot.
4. That grot item ACTIVATES / REPAIRS THE BRIDGE, opening the NEXT REGION (island
   expansion G5). The bridge is no longer "cross to gold" -- it is the gated gateway.

Pulls backlog ideas into the CORE spine:
- G5 island expansion = the next region across the repaired bridge.
- G6 skeleton variant = frighten-when-unprepared vs. beatable-when-trained.
- G10 typing fight = the skeleton beat; word-choice also drives the mill bag-placement.
- The grot collectible (was C4) = the bridge-repair item, NOT gold.
- Sites-earned (C1) sequence: grot -> {bow, sword, mill} -> skeleton beat -> bridge/region 2.

NEW scenario needed: the MILL (bag-carrying + placement choice) -> makes the windmill a
REAL scenario, not the O1 "come back later" placeholder. Update O1 accordingly.

Open questions (resolve at build): mill bag-choice right/wrong or flavour? must all three
training be done before the skeleton, or any order? is the skeleton beat the G10 fight or
an auto-resolve once trained+armed? what is the grot "bridge key" item?

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

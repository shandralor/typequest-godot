# KayKit asset library -- catalog

The **full KayKit Complete Collection v6.1** (23 packs, ~28.9k files, 1.4 GB) is
extracted on Tom's device at:

    /mnt/professional/projects/game-dev/_kaykit-assets/

It is a **device-local library, NOT in the repo** (mirrors the `_music-assets`
convention). It is deliberately kept OUT of the Godot project so the editor does
not import 28k files. Only **active assets** -- the ones a committed scene actually
references -- live in the repo under `assets/kaykit/<pack>/`.

## Workflow: promoting an asset to "active"

1. Browse the library folder above (or this catalog) and pick a model.
2. Copy its `.gltf` **and its textures** (usually the pack's `Textures/` +
   the `.bin`/image the gltf refers to) into `assets/kaykit/<pack>/`.
3. Reference `res://assets/kaykit/<pack>/<model>.gltf`; the loud RED placeholder
   fires if the id/path is wrong.
4. Commit the copied asset (it is now tracked). Everything left in the library
   stays device-local.

To recreate the library on another device: re-download the Complete Collection
and extract to the same path.

## Handy picks for current work

- **Bridge crystal** (replace the placeholder emissive box): `KayKit Resource Bits 1.0/
  Assets/gltf/Gem_Large.gltf` (also `Gem_Medium/Small`). Gems_Pile/Chest/Sack also there.
- **Treasure / collectibles**: Dungeon Pack `chest_*`, `coin*`; Resource Bits gem piles.
- **Quest-log / keys / potions**: RPG Tools Bits (`Lorekeeper_Tome`, keys, scrolls, potions).
- **More house items** (shield/cloak/furniture): Fantasy Weapons Bits + Furniture Bits.

## Packs at a glance

| Pack | Models | TypeQuest relevance |
|------|-------:|---------------------|
| KayKit Adventurers 2.0 | 58 | IN USE (hero). Char-variety roadmap G1/G2. |
| KayKit Block Bits 1.0 | 58 | Low relevance. |
| KayKit Board Game Bits 1.0 | 243 | Low relevance. |
| KayKit Character Animations 1.1 | 0 | IN USE (hero clips via HeroRig). |
| KayKit City Builder Bits 1.0 | 73 | Off-theme (modern). |
| KayKit Dungeon Pack 1.1 | 283 | IN USE (grot). Interiors, treasure. |
| KayKit Fantasy Weapons Bits 1.0 | 48 | IN USE (hero gear). House items. |
| KayKit Forest Nature Pack 1.0 | 202 | IN USE (forest sets). |
| KayKit Furniture Bits 1.0 | 74 | IN USE (house). Shelves/bed. |
| KayKit Halloween Bits 1.0 | 102 | Seasonal; maybe cave dressing. |
| KayKit Holiday Bits 1.0 | 138 | Seasonal. |
| KayKit Medieval Hexagon Pack 1.0.1 | 403 | IN USE (overworld island). |
| KayKit Mystery Monthly Series 4 (1.1) | 49 | Grab-bag; check per-asset. |
| KayKit Mystery Monthly Series 5 (1.1) | 46 | Grab-bag; check per-asset. |
| KayKit Mystery Monthly Series 6 (1.1) | 36 | Grab-bag; check per-asset. |
| KayKit Platformer Pack 1.0 | 525 | Off-genre. |
| KayKit Prototype Bits 1.1 | 85 | Dev/blockout only. |
| KayKit RPG Tools Bits 1.0 | 69 | Keys/scrolls/gems -> crystal, quest log. |
| KayKit Resource Bits 1.0 | 132 | Crystal candidates for the bridge key. |
| KayKit Restaurant Bits 1.0 | 225 | Off-theme (modern). |
| KayKit Skeletons 1.1 | 19 | IN USE (cave skeleton). Fight G10. |
| KayKit Space Base Bits 1.0 | 69 | Off-theme (sci-fi). |

Model counts are DISTINCT base names (colour variants like `_Color1..4` collapsed).
`raw` gltf file counts are higher where colour variants exist (e.g. Forest Nature
1588 files -> 202 distinct models).

## Models per pack

Full model lists for the fantasy/medieval-relevant packs; the rest show a summary
line only (browse the folder if you need them).

### KayKit Adventurers 2.0

Playable heroes on shared rigs (Knight, Barbarian, Mage, Ranger, Rogue) + gear.  
*58 models -- IN USE (hero). Char-variety roadmap G1/G2.*

- ammo_crate
- ammo_crate_withLid
- arrow_bow
- arrow_bow_bundle
- arrow_crossbow
- arrow_crossbow_bundle
- axe_1handed
- axe_1handed_Large
- axe_2handed
- axe_2handed_Large
- bow
- bow_withString
- crossbow_1handed
- crossbow_2handed
- dagger
- druid_staff
- engineer_Wrench
- mug_empty
- mug_empty_Large
- mug_full
- mug_full_Large
- potion_huge_blue
- potion_huge_green
- potion_huge_orange
- potion_huge_red
- potion_large_blue
- potion_large_green
- potion_large_orange
- potion_large_red
- potion_medium_blue
- potion_medium_green
- potion_medium_orange
- potion_medium_red
- potion_small_blue
- potion_small_green
- potion_small_orange
- potion_small_red
- quiver
- shield_badge
- shield_badge_color
- shield_round
- shield_round_barbarian
- shield_round_barbarian_Large
- shield_round_color
- shield_spikes
- shield_spikes_color
- shield_square
- shield_square_color
- shotgun
- smokebomb
- spellbook_closed
- spellbook_open
- staff
- sword_1handed
- sword_2handed
- sword_2handed_color
- turret_base
- wand

### KayKit Block Bits 1.0

Blocky building kit.  
*58 models -- Low relevance.*

_Summary only (58 models). Browse the folder to pick._

### KayKit Board Game Bits 1.0

Board-game pieces, dice, meeples.  
*243 models -- Low relevance.*

_Summary only (243 models). Browse the folder to pick._

### KayKit Character Animations 1.1

Animation clips (Rig_Medium/Large) grafted onto characters.  
*0 models -- IN USE (hero clips via HeroRig).*

### KayKit City Builder Bits 1.0

Modern city buildings.  
*73 models -- Off-theme (modern).*

_Summary only (73 models). Browse the folder to pick._

### KayKit Dungeon Pack 1.1

Dungeon interiors: walls, floors, doors, props, torches, chests.  
*283 models -- IN USE (grot). Interiors, treasure.*

- banner_blue
- banner_brown
- banner_green
- banner_patternA_blue
- banner_patternA_brown
- banner_patternA_green
- banner_patternA_red
- banner_patternA_white
- banner_patternA_yellow
- banner_patternB_blue
- banner_patternB_brown
- banner_patternB_green
- banner_patternB_red
- banner_patternB_white
- banner_patternB_yellow
- banner_patternC_blue
- banner_patternC_brown
- banner_patternC_green
- banner_patternC_red
- banner_patternC_white
- banner_patternC_yellow
- banner_red
- banner_shield_blue
- banner_shield_brown
- banner_shield_green
- banner_shield_red
- banner_shield_white
- banner_shield_yellow
- banner_thin_blue
- banner_thin_brown
- banner_thin_green
- banner_thin_red
- banner_thin_white
- banner_thin_yellow
- banner_triple_blue
- banner_triple_brown
- banner_triple_green
- banner_triple_red
- banner_triple_white
- banner_triple_yellow
- banner_white
- banner_yellow
- bar_innercorner
- bar_outercorner
- bar_straight_A
- bar_straight_A_short
- bar_straight_B
- bar_straight_B_short
- bar_straight_C
- bar_straight_C_short
- barrel_large
- barrel_large_decorated
- barrel_small
- barrel_small_stack
- barrier
- barrier_colum_half
- barrier_column
- barrier_corner
- barrier_half
- bartop_A_large
- bartop_A_medium
- bartop_A_small
- bartop_B_large
- bartop_B_medium
- bartop_B_small
- bed_A_double
- bed_A_single
- bed_A_stacked
- bed_B_double
- bed_B_single
- bed_decorated
- bed_floor
- bed_frame
- bench
- book_brown
- book_grey
- book_tan
- bookcase_double
- bookcase_double_decoratedA
- bookcase_double_decoratedB
- bookcase_single
- bookcase_single_decoratedA
- bookcase_single_decoratedB
- bottle_A_brown
- bottle_A_green
- bottle_A_labeled_brown
- bottle_A_labeled_green
- bottle_B_brown
- bottle_B_green
- bottle_C_brown
- bottle_C_green
- box_large
- box_small
- box_small_decorated
- box_stacked
- bucket
- bucket_pickaxes
- candle
- candle_lit
- candle_melted
- candle_thin
- candle_thin_lit
- candle_triple
- ceiling_tile
- chair
- chest
- chest_gold
- chest_large
- chest_large_gold
- chest_mimic
- coin
- coin_stack_large
- coin_stack_medium
- coin_stack_small
- column
- crate_large
- crate_large_decorated
- crate_small
- crates_stacked
- floor_dirt_large
- floor_dirt_large_rocky
- floor_dirt_small_A
- floor_dirt_small_B
- floor_dirt_small_C
- floor_dirt_small_D
- floor_dirt_small_corner
- floor_dirt_small_weeds
- floor_foundation_allsides
- floor_foundation_corner
- floor_foundation_diagonal_corner
- floor_foundation_front
- floor_foundation_front_and_back
- floor_foundation_front_and_sides
- floor_tile_big_grate
- floor_tile_big_grate_open
- floor_tile_big_spikes
- floor_tile_extralarge_grates
- floor_tile_extralarge_grates_open
- floor_tile_grate
- floor_tile_grate_open
- floor_tile_large
- floor_tile_large_rocks
- floor_tile_small
- floor_tile_small_broken_A
- floor_tile_small_broken_B
- floor_tile_small_corner
- floor_tile_small_decorated
- floor_tile_small_weeds_A
- floor_tile_small_weeds_B
- floor_wood_large
- floor_wood_large_dark
- floor_wood_small
- floor_wood_small_dark
- keg
- keg_decorated
- key
- key_gold
- keyring
- keyring_hanging
- pickaxe
- pickaxe_gold
- pillar
- pillar_decorated
- plate
- plate_food_A
- plate_food_B
- plate_small
- plate_stack
- post
- rocks
- rocks_decorated
- rocks_gold
- rocks_small
- rubble_half
- rubble_large
- scaffold_beam_corner
- scaffold_beam_wall
- scaffold_beams_connected
- scaffold_frame_large
- scaffold_frame_small
- scaffold_pillar_corner
- scaffold_pillar_wall
- scaffold_pillar_wall_cross
- scaffold_pillar_wall_cross_top
- scaffold_pillar_wall_torch
- scaffold_pillars_connected
- scaffold_pillars_connected_torch
- shelf_large
- shelf_small
- shelf_small_books
- shelf_small_candles
- shelves
- shelves_decorated
- stairs
- stairs_long
- stairs_long_modular_center
- stairs_long_modular_left
- stairs_long_modular_right
- stairs_modular_center
- stairs_modular_left
- stairs_modular_right
- stairs_narrow
- stairs_wall_left
- stairs_wall_right
- stairs_walled
- stairs_wide
- stairs_wood
- stairs_wood_decorated
- stool
- stool_round
- sword_shield
- sword_shield_broken
- sword_shield_gold
- table_long
- table_long_broken
- table_long_decorated_A
- table_long_decorated_B
- table_long_decorated_C
- table_long_tablecloth
- table_long_tablecloth_decorated_A
- table_medium
- table_medium_broken
- table_medium_decorated_A
- table_medium_decorated_B
- table_medium_tablecloth
- table_medium_tablecloth_decorated_B
- table_round_large
- table_round_medium
- table_round_small
- table_small
- table_small_decorated_A
- table_small_decorated_B
- table_small_decorated_C
- torch
- torch_lit
- torch_mounted
- trunk_large_A
- trunk_large_B
- trunk_large_C
- trunk_medium_A
- trunk_medium_B
- trunk_medium_C
- trunk_small_A
- trunk_small_B
- trunk_small_C
- wall
- wall_Tsplit
- wall_Tsplit_sloped
- wall_arched
- wall_archedwindow_gated
- wall_archedwindow_gated_scaffold
- wall_archedwindow_open
- wall_broken
- wall_corner
- wall_corner_gated
- wall_corner_scaffold
- wall_corner_small
- wall_cracked
- wall_crossing
- wall_doorway
- wall_doorway_Tsplit
- wall_doorway_scaffold
- wall_doorway_sides
- wall_endcap
- wall_gated
- wall_half
- wall_half_endcap
- wall_half_endcap_sloped
- wall_inset
- wall_inset_candles
- wall_inset_shelves
- wall_inset_shelves_broken
- wall_inset_shelves_decoratedA
- wall_inset_shelves_decoratedB
- wall_open_scaffold
- wall_pillar
- wall_scaffold
- wall_shelves
- wall_sloped
- wall_window_closed
- wall_window_closed_scaffold
- wall_window_open
- wall_window_open_scaffold

### KayKit Fantasy Weapons Bits 1.0

Swords, bows, axes, staves, shields.  
*48 models -- IN USE (hero gear). House items.*

- arrow_A
- arrow_B
- arrow_C
- axe_A
- axe_B
- axe_C
- axe_D
- bow_A
- bow_A_withString
- bow_B
- bow_B_withString
- bow_C
- bow_C_withString
- dagger_A
- dagger_B
- dagger_C
- fistweapon_A
- fistweapon_A_stacked
- fistweapon_B
- fistweapon_B_stacked
- fistweapon_C_left
- fistweapon_C_right
- fistweapon_C_stacked
- halberd
- hammer_A
- hammer_B
- hammer_C
- hammer_D
- scythe
- shield_A
- shield_B
- shield_C
- shield_D
- spear_A
- spear_B
- staff_A
- staff_B
- staff_C
- staff_D
- sword_A
- sword_B
- sword_C
- sword_D
- sword_E
- sword_F
- sword_G
- wand_A
- wand_B

### KayKit Forest Nature Pack 1.0

Trees, bushes, rocks, grass, terrain, water, bridges.  
*202 models -- IN USE (forest sets).*

- Bush_1_A
- Bush_1_B
- Bush_1_C
- Bush_1_D
- Bush_1_E
- Bush_1_F
- Bush_1_G
- Bush_2_A
- Bush_2_B
- Bush_2_C
- Bush_2_D
- Bush_2_E
- Bush_2_F
- Bush_3_A
- Bush_3_B
- Bush_3_C
- Bush_4_A
- Bush_4_B
- Bush_4_C
- Bush_4_D
- Bush_4_E
- Bush_4_F
- Grass_1_A
- Grass_1_A_Singlesided
- Grass_1_B
- Grass_1_B_Singlesided
- Grass_1_C
- Grass_1_C_Singlesided
- Grass_1_D
- Grass_1_D_Singlesided
- Grass_1_Mesh
- Grass_1_SingleSided_Mesh
- Grass_2_A
- Grass_2_A_Singlesided
- Grass_2_B
- Grass_2_B_Singlesided
- Grass_2_C
- Grass_2_C_Singlesided
- Grass_2_D
- Grass_2_D_Singlesided
- Grass_2_Mesh
- Grass_2_SingleSided_Mesh
- Hill_12x12x2
- Hill_12x12x4
- Hill_12x12x8
- Hill_12x6x2
- Hill_12x6x4
- Hill_12x6x8
- Hill_2x2x2
- Hill_2x2x4
- Hill_2x2x8
- Hill_4x2x2
- Hill_4x2x4
- Hill_4x2x8
- Hill_4x4x2
- Hill_4x4x4
- Hill_4x4x8
- Hill_8x4x2
- Hill_8x4x4
- Hill_8x4x8
- Hill_8x8x2
- Hill_8x8x4
- Hill_8x8x8
- Hill_Cliff_A_InnerCorner
- Hill_Cliff_A_OuterCorner
- Hill_Cliff_B_Side
- Hill_Cliff_C_InnerCorner
- Hill_Cliff_C_OuterCorner
- Hill_Cliff_D_Side
- Hill_Cliff_E
- Hill_Cliff_F_Side
- Hill_Cliff_G_InnerCorner
- Hill_Cliff_G_OuterCorner
- Hill_Cliff_H_Side
- Hill_Cliff_I_InnerCorner
- Hill_Cliff_I_OuterCorner
- Hill_Cliff_Tall_A_InnerCorner
- Hill_Cliff_Tall_A_OuterCorner
- Hill_Cliff_Tall_B_Side
- Hill_Cliff_Tall_C_InnerCorner
- Hill_Cliff_Tall_C_OuterCorner
- Hill_Cliff_Tall_D_Side
- Hill_Cliff_Tall_E
- Hill_Cliff_Tall_F_Side
- Hill_Cliff_Tall_G_InnerCorner
- Hill_Cliff_Tall_G_OuterCorner
- Hill_Cliff_Tall_H_Side
- Hill_Cliff_Tall_I_InnerCorner
- Hill_Cliff_Tall_I_OuterCorner
- Hill_Top_A_InnerCorner
- Hill_Top_A_OuterCorner
- Hill_Top_B_Side
- Hill_Top_C_InnerCorner
- Hill_Top_C_OuterCorner
- Hill_Top_D_Side
- Hill_Top_E_Cap
- Hill_Top_E_Center
- Hill_Top_F_Side
- Hill_Top_G_InnerCorner
- Hill_Top_G_OuterCorner
- Hill_Top_H_Side
- Hill_Top_I_InnerCorner
- Hill_Top_I_OuterCorner
- Rock_1_A
- Rock_1_B
- Rock_1_C
- Rock_1_D
- Rock_1_E
- Rock_1_F
- Rock_1_G
- Rock_1_H
- Rock_1_I
- Rock_1_J
- Rock_1_K
- Rock_1_L
- Rock_1_M
- Rock_1_N
- Rock_1_O
- Rock_1_P
- Rock_1_Q
- Rock_2_A
- Rock_2_B
- Rock_2_C
- Rock_2_D
- Rock_2_E
- Rock_2_F
- Rock_2_G
- Rock_2_H
- Rock_3_A
- Rock_3_B
- Rock_3_C
- Rock_3_D
- Rock_3_E
- Rock_3_F
- Rock_3_G
- Rock_3_H
- Rock_3_I
- Rock_3_J
- Rock_3_K
- Rock_3_L
- Rock_3_M
- Rock_3_N
- Rock_3_O
- Rock_3_P
- Rock_3_Q
- Rock_3_R
- Rock_4_A
- Rock_4_B
- Rock_4_C
- Rock_4_D
- Rock_4_E
- Rock_4_F
- Rock_4_G
- Rock_4_H
- Rock_5_A
- Rock_5_B
- Rock_5_C
- Rock_5_D
- Rock_5_E
- Rock_5_F
- Rock_5_G
- Rock_5_H
- Rock_6_A
- Rock_6_B
- Rock_6_C
- Rock_6_D
- Rock_6_E
- Rock_6_F
- Rock_6_G
- Rock_6_H
- Tree_1_A
- Tree_1_B
- Tree_1_C
- Tree_2_A
- Tree_2_B
- Tree_2_C
- Tree_2_D
- Tree_2_E
- Tree_3_A
- Tree_3_B
- Tree_3_C
- Tree_4_A
- Tree_4_B
- Tree_4_C
- Tree_5_A
- Tree_5_B
- Tree_5_C
- Tree_5_D
- Tree_5_E
- Tree_5_F
- Tree_6_A
- Tree_6_B
- Tree_6_C
- Tree_7_A
- Tree_7_B
- Tree_7_C
- Tree_Bare_1_A
- Tree_Bare_1_B
- Tree_Bare_1_C
- Tree_Bare_2_A
- Tree_Bare_2_B
- Tree_Bare_2_C

### KayKit Furniture Bits 1.0

Beds, tables, shelves, chests, chairs.  
*74 models -- IN USE (house). Shelves/bed.*

- armchair
- armchair_pillows
- bed_double_A
- bed_double_B
- bed_single_A
- bed_single_B
- book_set
- book_single
- cabinet_medium
- cabinet_medium_decorated
- cabinet_small
- cabinet_small_decorated
- cactus_medium_A
- cactus_medium_B
- cactus_small_A
- cactus_small_B
- chair_A
- chair_A_wood
- chair_B
- chair_B_wood
- chair_C
- chair_desk_A
- chair_desk_B
- chair_stool
- chair_stool_wood
- couch
- couch_pillows
- cup
- cup_pencils
- desk
- desk_decorated
- desk_large
- desk_large_decorated
- gameconsole_handheld
- keyboard
- lamp_desk
- lamp_desk_headphones
- lamp_standing
- lamp_table
- monitor
- mouse
- mousepad_A
- mousepad_B
- mousepad_large_A
- mousepad_large_B
- mug_A
- mug_B
- pictureframe_large_A
- pictureframe_large_B
- pictureframe_medium
- pictureframe_small_A
- pictureframe_small_B
- pictureframe_small_C
- pictureframe_standing_A
- pictureframe_standing_B
- pillow_A
- pillow_B
- rug_oval_A
- rug_oval_B
- rug_rectangle_A
- rug_rectangle_B
- rug_rectangle_stripes_A
- rug_rectangle_stripes_B
- shelf_A_big
- shelf_A_small
- shelf_B_large
- shelf_B_large_decorated
- shelf_B_small
- shelf_B_small_decorated
- table_low
- table_low_decorated
- table_medium
- table_medium_long
- table_small

### KayKit Halloween Bits 1.0

Spooky props: pumpkins, graves, bats.  
*102 models -- Seasonal; maybe cave dressing.*

_Summary only (102 models). Browse the folder to pick._

### KayKit Holiday Bits 1.0

Winter/Christmas props.  
*138 models -- Seasonal.*

_Summary only (138 models). Browse the folder to pick._

### KayKit Medieval Hexagon Pack 1.0.1

Hex terrain tiles + medieval buildings for the island map.  
*403 models -- IN USE (overworld island).*

- anchor
- banner
- banner_blue_accent
- banner_blue_full
- banner_green_accent
- banner_green_full
- banner_red_accent
- banner_red_full
- banner_yellow_accent
- banner_yellow_full
- barrel
- boat
- boatrack
- bow
- bow_blue_accent
- bow_blue_full
- bow_green_accent
- bow_green_full
- bow_red_accent
- bow_red_full
- bow_yellow_accent
- bow_yellow_full
- bucket_arrows
- bucket_empty
- bucket_water
- building_archeryrange_blue
- building_archeryrange_green
- building_archeryrange_red
- building_archeryrange_yellow
- building_barracks_blue
- building_barracks_green
- building_barracks_red
- building_barracks_yellow
- building_blacksmith_blue
- building_blacksmith_green
- building_blacksmith_red
- building_blacksmith_yellow
- building_bridge_A
- building_bridge_B
- building_castle_blue
- building_castle_green
- building_castle_red
- building_castle_yellow
- building_church_blue
- building_church_green
- building_church_red
- building_church_yellow
- building_destroyed
- building_dirt
- building_docks_blue
- building_docks_green
- building_docks_red
- building_docks_yellow
- building_grain
- building_home_A_blue
- building_home_A_green
- building_home_A_red
- building_home_A_yellow
- building_home_B_blue
- building_home_B_green
- building_home_B_red
- building_home_B_yellow
- building_lumbermill_blue
- building_lumbermill_green
- building_lumbermill_red
- building_lumbermill_yellow
- building_market_blue
- building_market_green
- building_market_red
- building_market_yellow
- building_mine_blue
- building_mine_green
- building_mine_red
- building_mine_yellow
- building_scaffolding
- building_shipyard_blue
- building_shipyard_green
- building_shipyard_red
- building_shipyard_yellow
- building_shrine_blue
- building_shrine_green
- building_shrine_red
- building_shrine_yellow
- building_stables_blue
- building_stables_green
- building_stables_red
- building_stables_yellow
- building_stage_A
- building_stage_B
- building_stage_C
- building_tavern_blue
- building_tavern_green
- building_tavern_red
- building_tavern_yellow
- building_tent_blue
- building_tent_green
- building_tent_red
- building_tent_yellow
- building_tower_A_blue
- building_tower_A_green
- building_tower_A_red
- building_tower_A_yellow
- building_tower_B_blue
- building_tower_B_green
- building_tower_B_red
- building_tower_B_yellow
- building_tower_base_blue
- building_tower_base_green
- building_tower_base_red
- building_tower_base_yellow
- building_tower_cannon_blue
- building_tower_cannon_green
- building_tower_cannon_red
- building_tower_cannon_yellow
- building_tower_catapult_blue
- building_tower_catapult_green
- building_tower_catapult_red
- building_tower_catapult_yellow
- building_townhall_blue
- building_townhall_green
- building_townhall_red
- building_townhall_yellow
- building_watchtower_blue
- building_watchtower_green
- building_watchtower_red
- building_watchtower_yellow
- building_watermill_blue
- building_watermill_green
- building_watermill_red
- building_watermill_yellow
- building_well_blue
- building_well_green
- building_well_red
- building_well_yellow
- building_windmill_blue
- building_windmill_green
- building_windmill_red
- building_windmill_yellow
- building_workshop_blue
- building_workshop_green
- building_workshop_red
- building_workshop_yellow
- cannon
- cannon_blue_accent
- cannon_blue_full
- cannon_green_accent
- cannon_green_full
- cannon_red_accent
- cannon_red_full
- cannon_yellow_accent
- cannon_yellow_full
- cannonball_pallet
- cart
- cart_blue_accent
- cart_blue_full
- cart_green_accent
- cart_green_full
- cart_merchant
- cart_merchant_blue_accent
- cart_merchant_blue_full
- cart_merchant_green_accent
- cart_merchant_green_full
- cart_merchant_red_accent
- cart_merchant_red_full
- cart_merchant_yellow_accent
- cart_merchant_yellow_full
- cart_red_accent
- cart_red_full
- cart_yellow_accent
- cart_yellow_full
- catapult
- catapult_blue_accent
- catapult_blue_full
- catapult_green_accent
- catapult_green_full
- catapult_red_accent
- catapult_red_full
- catapult_yellow_accent
- catapult_yellow_full
- cloud_big
- cloud_small
- crate_A_big
- crate_A_small
- crate_B_big
- crate_B_small
- crate_long_A
- crate_long_B
- crate_long_C
- crate_long_empty
- crate_open
- fence_stone_straight
- fence_stone_straight_gate
- fence_wood_straight
- fence_wood_straight_gate
- flag_blue
- flag_green
- flag_red
- flag_yellow
- hammer
- haybale
- helmet
- helmet_blue_accent
- helmet_blue_full
- helmet_green_accent
- helmet_green_full
- helmet_red_accent
- helmet_red_full
- helmet_yellow_accent
- helmet_yellow_full
- hex_coast_A
- hex_coast_A_waterless
- hex_coast_B
- hex_coast_B_waterless
- hex_coast_C
- hex_coast_C_waterless
- hex_coast_D
- hex_coast_D_waterless
- hex_coast_E
- hex_coast_E_waterless
- hex_grass
- hex_grass_bottom
- hex_grass_sloped_high
- hex_grass_sloped_low
- hex_river_A
- hex_river_A_curvy
- hex_river_A_curvy_waterless
- hex_river_A_waterless
- hex_river_B
- hex_river_B_waterless
- hex_river_C
- hex_river_C_waterless
- hex_river_D
- hex_river_D_waterless
- hex_river_E
- hex_river_E_waterless
- hex_river_F
- hex_river_F_waterless
- hex_river_G
- hex_river_G_waterless
- hex_river_H
- hex_river_H_waterless
- hex_river_I
- hex_river_I_waterless
- hex_river_J
- hex_river_J_waterless
- hex_river_K
- hex_river_K_waterless
- hex_river_L
- hex_river_L_waterless
- hex_river_crossing_A
- hex_river_crossing_A_waterless
- hex_river_crossing_B
- hex_river_crossing_B_waterless
- hex_road_A
- hex_road_A_sloped_high
- hex_road_A_sloped_low
- hex_road_B
- hex_road_C
- hex_road_D
- hex_road_E
- hex_road_F
- hex_road_G
- hex_road_H
- hex_road_I
- hex_road_J
- hex_road_K
- hex_road_L
- hex_road_M
- hex_transition
- hex_water
- hill_single_A
- hill_single_B
- hill_single_C
- hills_A
- hills_A_trees
- hills_B
- hills_B_trees
- hills_C
- hills_C_trees
- horse_A
- horse_B
- horse_C
- horse_D
- horse_E
- horse_F
- horse_G
- horse_blue_accent
- horse_blue_full
- horse_green_accent
- horse_green_full
- horse_red_accent
- horse_red_full
- horse_saddle
- horse_yellow_accent
- horse_yellow_full
- icon_combat
- icon_range
- ladder
- mountain_A
- mountain_A_grass
- mountain_A_grass_trees
- mountain_B
- mountain_B_grass
- mountain_B_grass_trees
- mountain_C
- mountain_C_grass
- mountain_C_grass_trees
- pallet
- projectile_arrow
- projectile_arrow_blue_accent
- projectile_arrow_blue_full
- projectile_arrow_green_accent
- projectile_arrow_green_full
- projectile_arrow_red_accent
- projectile_arrow_red_full
- projectile_arrow_yellow_accent
- projectile_arrow_yellow_full
- projectile_cannonball
- projectile_catapult
- resource_lumber
- resource_stone
- rock_single_A
- rock_single_B
- rock_single_C
- rock_single_D
- rock_single_E
- sack
- shield
- shield_blue_accent
- shield_blue_full
- shield_green_accent
- shield_green_full
- shield_red_accent
- shield_red_full
- shield_yellow_accent
- shield_yellow_full
- ship
- ship_blue_accent
- ship_blue_full
- ship_green_accent
- ship_green_full
- ship_red_accent
- ship_red_full
- ship_yellow_accent
- ship_yellow_full
- shovel
- spear
- spear_blue_accent
- spear_blue_full
- spear_green_accent
- spear_green_full
- spear_red_accent
- spear_red_full
- spear_yellow_accent
- spear_yellow_full
- sword
- sword_blue_accent
- sword_blue_full
- sword_green_accent
- sword_green_full
- sword_red_accent
- sword_red_full
- sword_yellow_accent
- sword_yellow_full
- target
- tent
- tree_single_A
- tree_single_A_cut
- tree_single_B
- tree_single_B_cut
- trees_A_cut
- trees_A_large
- trees_A_medium
- trees_A_small
- trees_B_cut
- trees_B_large
- trees_B_medium
- trees_B_small
- trough
- trough_long
- unit
- unit_blue_accent
- unit_blue_full
- unit_green_accent
- unit_green_full
- unit_red_accent
- unit_red_full
- unit_yellow_accent
- unit_yellow_full
- wall_corner_A_gate
- wall_corner_A_inside
- wall_corner_A_outside
- wall_corner_B_inside
- wall_corner_B_outside
- wall_straight
- wall_straight_gate
- waterlily_A
- waterlily_B
- waterplant_A
- waterplant_B
- waterplant_C
- weaponrack
- wheelbarrow

### KayKit Mystery Monthly Series 4 (1.1)

Rotating themed mini-set.  
*49 models -- Grab-bag; check per-asset.*

- ActionFigure_Head_B
- ActionFigure_Head_C
- ActionFigure_Head_D
- ActionFigure_Head_Normal
- Grenade
- Guitar
- Gun
- Muzzleflash
- Muzzleflash_Long
- Ninja_Katana
- Ninja_Shuriken
- Robot_ChargingStation
- SpaceRanger_Blade
- SpaceRanger_Helmet
- SpaceRanger_Jetpack
- SpaceRanger_Rifle
- axe
- backpack
- ballistic_shield_A
- ballistic_shield_B
- balloon_blue
- balloon_dog_blue
- balloon_dog_green
- balloon_dog_red
- balloon_dog_yellow
- balloon_green
- balloon_red
- balloon_yellow
- building_C_broken
- circus_hoop
- circus_podium
- clown_ball
- clown_bomb
- clown_hammer
- firehydrant
- juggling_pin_blue
- juggling_pin_green
- juggling_pin_red
- juggling_pin_yellow
- log_A
- log_B
- log_split
- log_stacks
- paladin_book
- paladin_hammer
- paladin_shield
- paladin_statue
- shotgun
- stopsign

### KayKit Mystery Monthly Series 5 (1.1)

Rotating themed mini-set.  
*46 models -- Grab-bag; check per-asset.*

- Basket
- Basket_Mushrooms
- BlackKnight_Shield
- BlackKnight_Shield_Large
- BlackKnight_Sword
- BlackKnight_Sword_Large
- Broom
- Campfire_Base
- Campfire_Logs
- Candycane
- Cape_SingleSidedForClothPhysics
- Cauldron
- Caveman_Axe
- Caveman_Club
- Caveman_Spear
- CombatMech_Axe
- CombatMech_Minigun
- Drawers
- FrostGolem_Axe
- FrostGolem_Axe_Large
- Gem_Large
- Gem_Medium
- Gem_Small
- Glue_A
- Glue_B
- Hammer
- Lamp_Workbench
- LandingImpact
- Laserbeam
- Mortar
- Mushroom
- Pestle
- Potionstation
- Potionstation_decorated
- Table_Small
- Tent
- Tiefling_Sword
- Tiefling_SwordsBackpack
- Toy_Train_Paint
- Toy_Train_Wood
- Toy_Workbench
- Toy_Workbench_decorated
- Vampire_Goblet
- Vampire_Sword
- Vampire_Throne
- Waterbottle

### KayKit Mystery Monthly Series 6 (1.1)

Rotating themed mini-set.  
*36 models -- Grab-bag; check per-asset.*

- 4GTN_Katana
- AvianSwordsman_Sword
- Cleric_Font
- Cleric_Mace
- Cleric_Shield
- Cleric_Tome
- Hoarder_Backpack
- Hoarder_Sword
- Lorekeeper_Staff
- Lorekeeper_Tome
- MagicalGirl_Wand
- Marksman_Rifle
- Monstrosity_BarndoorShield
- Monstrosity_BarndoorShield_Large
- Monstrosity_Pitchfork
- Monstrosity_Pitchfork_Large
- Orc_Axe
- Orc_Axe_Large
- Orc_Banner
- Orc_Banner_Large
- PlantWarrior_Arrow
- PlantWarrior_Bow
- PlantWarrior_Bow_withString
- PlantWarrior_Shield
- PlantWarrior_Spear
- Present_Base
- Present_UnwrappedBase
- ToySoldier_Rifle
- ToySoldier_Trumpet
- Trainingdummy_Base
- carrot
- dirt_plot
- lettuce
- pitchfork
- wheelbarrow
- wheelbarrow_empty

### KayKit Platformer Pack 1.0

2.5D platformer kit.  
*525 models -- Off-genre.*

_Summary only (525 models). Browse the folder to pick._

### KayKit Prototype Bits 1.1

Greybox primitives for blockouts.  
*85 models -- Dev/blockout only.*

_Summary only (85 models). Browse the folder to pick._

### KayKit RPG Tools Bits 1.0

Adventuring props: potions, scrolls, keys, chests, gems.  
*69 models -- Keys/scrolls/gems -> crystal, quest log.*

- anvil
- axe
- blueprint
- blueprint_stacked
- bucket_metal
- chisel
- compass_base
- drafting_compass
- file
- fishing_floater
- fishing_hook_A
- fishing_hook_B
- fishing_rod
- fishing_rod_base
- fishing_tacklebox
- fishing_tacklebox_empty
- fishing_worm
- grindstone
- hammer
- handdrill
- handplane
- journal_closed
- journal_open
- key_A
- key_B
- key_C
- knife
- lantern
- lock_A
- lock_B
- lock_C
- lockpick_A
- lockpick_A_old
- lockpick_B
- lockpick_C
- lockpick_D
- lockpick_set
- magnifying_glass
- mallet
- map
- map_empty
- map_rolled
- nail
- pencil_A_long
- pencil_A_short
- pencil_B_long
- pencil_B_short
- pickaxe
- rope_bundle_A
- rope_bundle_B
- saw
- scissors
- screw_A
- screw_B
- screwdriver_A_long
- screwdriver_A_long_color
- screwdriver_A_short
- screwdriver_A_short_color
- screwdriver_B_long
- screwdriver_B_long_color
- screwdriver_B_short
- screwdriver_B_short_color
- shovel
- tongs
- torch
- torch_burnt
- trowel
- wrench_A
- wrench_B

### KayKit Resource Bits 1.0

Gatherable resources: ore, wood, crystals, gems, plants.  
*132 models -- Crystal candidates for the bridge key.*

- Containers_Box_Large
- Containers_Box_Large_Dirty
- Containers_Box_Medium
- Containers_Box_Small
- Containers_Crate_Large
- Containers_Crate_Medium_Grey
- Containers_Crate_Medium_Tan
- Containers_Crate_Medium_Wood
- Containers_Crate_Small_Green
- Containers_Crate_Small_Grey
- Containers_Pile_Large
- Containers_Pile_Medium
- Containers_Pile_Small
- Copper_Bar
- Copper_Bars
- Copper_Bars_Stack_Large
- Copper_Bars_Stack_Medium
- Copper_Bars_Stack_Small
- Copper_Nugget_Large
- Copper_Nugget_Medium
- Copper_Nugget_Small
- Copper_Nuggets
- Food_Apple_Green
- Food_Apple_Red
- Food_Barrel_Empty
- Food_Barrel_Fish
- Food_Basket_A_Berries
- Food_Basket_A_Empty
- Food_Basket_B_Berries
- Food_Basket_B_Empty
- Food_Berry_Blue
- Food_Berry_Orange
- Food_Cheese
- Food_Crate_Large_Apples
- Food_Crate_Large_Empty
- Food_Crate_Small_Berries
- Food_Crate_Small_Empty
- Food_Flour
- Food_Pile_Large
- Food_Pile_Medium
- Food_Pile_Small
- Fuel_A_Barrel
- Fuel_A_Barrel_Dirty
- Fuel_A_Barrels
- Fuel_A_Jerrycan
- Fuel_B_Barrel
- Fuel_B_Barrel_Dirty
- Fuel_B_Barrels
- Fuel_B_Jerrycan
- Fuel_C_Barrel
- Fuel_C_Barrel_Dirty
- Fuel_C_Barrels
- Fuel_C_Jerrycan
- Gem_Large
- Gem_Medium
- Gem_Small
- Gems_Chest
- Gems_Chest_Empty
- Gems_Pile_Large
- Gems_Pile_Small
- Gems_Sack
- Gold_Bar
- Gold_Bars
- Gold_Bars_Stack_Large
- Gold_Bars_Stack_Medium
- Gold_Bars_Stack_Small
- Gold_Nugget_Large
- Gold_Nugget_Medium
- Gold_Nugget_Small
- Gold_Nuggets
- Iron_Bar
- Iron_Bars
- Iron_Bars_Stack_Large
- Iron_Bars_Stack_Medium
- Iron_Bars_Stack_Small
- Iron_Nugget_Large
- Iron_Nugget_Medium
- Iron_Nugget_Small
- Iron_Nuggets
- Money_Bill
- Money_Bill_Arched
- Money_Bills_Stack_Large
- Money_Bills_Stack_Medium
- Money_Bills_Stack_Small
- Money_Coins_Stack_Large
- Money_Coins_Stack_Medium
- Money_Coins_Stack_Single
- Money_Coins_Stack_Small
- Money_Pile_Large
- Money_Pile_Medium
- Money_Pile_Small
- Money_Single
- Pallet_Plastic_Blue
- Pallet_Plastic_Grey
- Pallet_Plastic_Orange
- Pallet_Wood
- Pallet_Wood_Covered_A
- Pallet_Wood_Covered_B
- Parts_Cog
- Parts_Pile_Large
- Parts_Pile_Medium
- Parts_Pile_Small
- Silver_Bar
- Silver_Bars
- Silver_Bars_Stack_Large
- Silver_Bars_Stack_Medium
- Silver_Bars_Stack_Small
- Silver_Nugget_Large
- Silver_Nugget_Medium
- Silver_Nugget_Small
- Silver_Nuggets
- Stone_Brick
- Stone_Bricks_Stack_Large
- Stone_Bricks_Stack_Medium
- Stone_Bricks_Stack_Small
- Stone_Chunks_Large
- Stone_Chunks_Small
- Textiles_A
- Textiles_B
- Textiles_C
- Textiles_Stack_Large
- Textiles_Stack_Large_Colored
- Textiles_Stack_Small
- Wood_Log_A
- Wood_Log_B
- Wood_Log_Stack
- Wood_Plank_A
- Wood_Plank_B
- Wood_Plank_C
- Wood_Planks_Stack_Large
- Wood_Planks_Stack_Medium
- Wood_Planks_Stack_Small

### KayKit Restaurant Bits 1.0

Diner/kitchen props.  
*225 models -- Off-theme (modern).*

_Summary only (225 models). Browse the folder to pick._

### KayKit Skeletons 1.1

Skeleton enemies + bones on the shared rig.  
*19 models -- IN USE (cave skeleton). Fight G10.*

- Skeleton_Arrow
- Skeleton_Arrow_Broken
- Skeleton_Arrow_Broken_Half
- Skeleton_Arrow_Half
- Skeleton_Axe
- Skeleton_Blade
- Skeleton_Crossbow
- Skeleton_Dagger
- Skeleton_Golem_Axe
- Skeleton_Golem_Axe_Large
- Skeleton_Mace
- Skeleton_Mace_Large
- Skeleton_Quiver
- Skeleton_Scythe
- Skeleton_Shield_Large_A
- Skeleton_Shield_Large_B
- Skeleton_Shield_Small_A
- Skeleton_Shield_Small_B
- Skeleton_Staff

### KayKit Space Base Bits 1.0

Sci-fi base modules.  
*69 models -- Off-theme (sci-fi).*

_Summary only (69 models). Browse the folder to pick._


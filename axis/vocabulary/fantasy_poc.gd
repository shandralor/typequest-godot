class_name FantasyPocVocabulary
extends RefCounted

## Asset vocabulary `fantasy-poc` (brief A7/B4): id -> Godot resource path.
##
## Data only. Content names scene elements BY ID; it never references a model
## path. Swap the paths behind these ids to swap the art pack, and the same story
## renders from different models -- the ids never change. An unknown id resolves
## to "" and the SceneComposer renders a loud RED placeholder (never silent).
##
## NOTE: location ids (forest_path, dungeon) are NOT here. A location is not a
## single model; it is composed imperatively by the SceneComposer (anchors +
## ground + staging). Only actors and props resolve to a single resource.

const ID := "fantasy-poc"

const ASSETS := {
	# characters
	"hero": "res://assets/kaykit/characters/Mannequin_Medium.glb",  # knight stand-in
	"skeleton": "res://assets/kaykit/skeletons/Skeleton_Warrior.glb",
	# props (referenced by later scenes; the start scene uses none)
	"chest": "res://assets/kaykit/dungeon/chest_gold.gltf",  # A7: a gold chest, lid a separate child
	"bridge": "res://assets/kaykit/resource_bits/Wood_Planks_Stack_Large.gltf",
}

static func resolve(asset_id: String) -> String:
	return ASSETS.get(asset_id, "")

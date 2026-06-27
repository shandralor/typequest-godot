class_name Scenarios
extends RefCounted

## The list of playable scenarios shown in the scenario menu. Currently one (the
## band-1 arc). Add a row here (and a build branch) to offer another adventure;
## the menu picks them up automatically. To reorder the menu, reorder this list.

const Band1Arc = preload("res://content/band1/band1_arc.gd")
const Band1Scenes = preload("res://content/band1/scene_descriptors.gd")


static func list() -> Array:
	return [
		{"id": "band1", "title": "De ridder en de schat"},
	]


static func build(id: String):
	match id:
		_:
			return Band1Arc.build()


## The scene shown as a backdrop behind the menus.
static func backdrop_scene():
	return Band1Scenes.start()

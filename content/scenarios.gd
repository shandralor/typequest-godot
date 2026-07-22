class_name Scenarios
extends RefCounted

## The playable scenarios. Started from the OVERWORLD (content/overworld.gd maps a
## typed site word to a scenario id here). Add a row + a build branch to offer
## another adventure, then give it a site on the island.

const Band1Arc = preload("res://content/band1/band1_arc.gd")
const GrindArc = preload("res://content/grind/grind_arc.gd")
const ArcheryArc = preload("res://content/archery/archery_arc.gd")
const HomeArc = preload("res://content/home/home_arc.gd")
const MillArc = preload("res://content/mill/mill_arc.gd")


static func list() -> Array:
	return [
		{"id": "band1", "title": "De ridder en de schat"},
		{"id": "grind", "title": "Slijp je zwaard"},
		{"id": "archery", "title": "Boogschieten"},
		{"id": "home", "title": "Thuis"},
		{"id": "mill", "title": "De molenaar"},
	]


static func build(id: String):
	match id:
		"grind":
			return GrindArc.build()
		"archery":
			return ArcheryArc.build()
		"home":
			return HomeArc.build()
		"mill":
			return MillArc.build()
		_:
			return Band1Arc.build()

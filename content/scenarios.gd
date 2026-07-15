class_name Scenarios
extends RefCounted

## The playable scenarios. Started from the OVERWORLD (content/overworld.gd maps a
## typed site word to a scenario id here). Add a row + a build branch to offer
## another adventure, then give it a site on the island.

const Band1Arc = preload("res://content/band1/band1_arc.gd")
const GrindArc = preload("res://content/grind/grind_arc.gd")
const ArcheryArc = preload("res://content/archery/archery_arc.gd")


static func list() -> Array:
	return [
		{"id": "band1", "title": "De ridder en de schat"},
		{"id": "grind", "title": "Slijp je zwaard"},
		{"id": "archery", "title": "Boogschieten"},
	]


static func build(id: String):
	match id:
		"grind":
			return GrindArc.build()
		"archery":
			return ArcheryArc.build()
		_:
			return Band1Arc.build()

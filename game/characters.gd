class_name Characters
extends RefCounted

## Playable hero roster (character choice -- roadmap G1/G2). Each hero is a KayKit model
## on the shared Rig_Medium, so the grafted animation set (idle/walk/pickup/cheer/lie/bow)
## works for EVERY one -- adding a hero is a DATA row here. `label` is read-aloud (free
## capitals/spaces, not typed). The chosen id persists via AppProgress ([profile] hero).

const DEFAULT_ID := "knight"
const ADV := "res://assets/kaykit/adventurers/"
const HERO := "res://assets/kaykit/heroes/"


## The TYPED subject word per hero (the {held} token in prose) lives in the LOCALE, keyed
## "hero.<id>" -- it is nl-BE content, band-1 safe, and the content validator checks every
## variant. `label` is the read-aloud picker name.
static func all() -> Array:
	return [
		{"id": "knight",    "model": ADV + "Knight.glb",    "label": "Ridder"},
		{"id": "barbarian", "model": ADV + "Barbarian.glb", "label": "Barbaar"},
		{"id": "mage",      "model": ADV + "Mage.glb",      "label": "Tovenaar"},
		{"id": "ranger",    "model": ADV + "Ranger.glb",    "label": "Jager"},
		{"id": "rogue",     "model": ADV + "Rogue.glb",     "label": "Dief"},
		{"id": "witch",     "model": HERO + "Witch.glb",    "label": "Heks"},
	]


static func _find(id: String) -> Dictionary:
	for c in all():
		if c.id == id:
			return c
	return all()[0]


static func model_for(id: String) -> String:
	return _find(id).model


static func label_for(id: String) -> String:
	return _find(id).label

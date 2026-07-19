class_name Characters
extends RefCounted

## Playable hero roster (character choice -- roadmap G1/G2). Each hero is a KayKit model
## on the shared Rig_Medium, so the grafted animation set (idle/walk/pickup/cheer/lie/bow)
## works for EVERY one -- adding a hero is a DATA row here. `label` is read-aloud (free
## capitals/spaces, not typed). The chosen id persists via AppProgress ([profile] hero).

const DEFAULT_ID := "knight"
const ADV := "res://assets/kaykit/adventurers/"
const HERO := "res://assets/kaykit/heroes/"


static func all() -> Array:
	return [
		{"id": "knight",      "model": ADV + "Knight.glb",         "label": "Ridder"},
		{"id": "barbarian",   "model": ADV + "Barbarian.glb",      "label": "Barbaar"},
		{"id": "mage",        "model": ADV + "Mage.glb",           "label": "Tovenaar"},
		{"id": "ranger",      "model": ADV + "Ranger.glb",         "label": "Jager"},
		{"id": "rogue",       "model": ADV + "Rogue.glb",          "label": "Dief"},
		{"id": "blackknight", "model": HERO + "BlackKnight.glb",   "label": "Zwarte ridder"},
		{"id": "cleric",      "model": HERO + "Cleric.glb",        "label": "Priester"},
		{"id": "lorekeeper",  "model": HERO + "Lorekeeper.glb",    "label": "Wijze"},
		{"id": "witch",       "model": HERO + "Witch.glb",         "label": "Heks"},
		{"id": "vampire",     "model": HERO + "Vampire.glb",       "label": "Vampier"},
		{"id": "tiefling",    "model": HERO + "Tiefling.glb",      "label": "Duiveltje"},
		{"id": "orc",         "model": HERO + "OrcBrute.glb",      "label": "Ork"},
		{"id": "plant",       "model": HERO + "PlantWarrior.glb",  "label": "Groenling"},
		{"id": "avian",       "model": HERO + "AvianSwordsman.glb","label": "Vogelridder"},
		{"id": "magicalgirl", "model": HERO + "MagicalGirl.glb",   "label": "Tovermeisje"},
		{"id": "monster",     "model": HERO + "Monstrosity.glb",   "label": "Monster"},
		{"id": "golem",       "model": HERO + "FrostGolem.glb",    "label": "IJsgolem"},
		{"id": "caveman",     "model": HERO + "Caveman.glb",       "label": "Holbewoner"},
		{"id": "farmer",      "model": HERO + "Farmer_A.glb",      "label": "Boer"},
		{"id": "hoarder",     "model": HERO + "Hoarder.glb",       "label": "Verzamelaar"},
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

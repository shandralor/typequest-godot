extends SceneTree

## Verifies logic/fnv1a.gd reproduces the six band-1 safety hashes from brief A7.
## Run: godot --headless --script res://tests/test_fnv1a.gd
## A failing hash means the prose below is not byte-identical to A7 -- fix the
## prose, never the hash (brief A4).

const Fnv1a = preload("res://logic/fnv1a.gd")

const CASES := [
	["de kleine ridder wandelt door het bos. hij volgt het pad en stapt verder.", "fnv1a:dff7ec80", "start"],
	["het pad gaat twee kanten op. links gaapt een zwarte grot. rechts staat een oude brug.", "fnv1a:fc978a65", "kruispunt"],
	["in de grot rammelt een wit skelet. de ridder rent snel terug naar het licht.", "fnv1a:3778a255", "grot"],
	["de ridder kiest nu voor de veilige brug.", "fnv1a:859459c1", "naGrot"],
	["de brug ligt naar beneden. de ridder stapt over de brug en gaat verder.", "fnv1a:a585a423", "brug"],
	["de ridder opent de kist vol goud. hij vindt de schat en is heel blij.", "fnv1a:1f2d5082", "schat"],
]


func _initialize() -> void:
	var failed := 0
	for c in CASES:
		var got: String = Fnv1a.hash_prose(c[0])
		var ok: bool = got == c[1]
		if not ok:
			failed += 1
		print("%-5s %-10s expected %s got %s" % ["OK" if ok else "FAIL", c[2], c[1], got])
	print("fnv1a: %d/%d passed" % [CASES.size() - failed, CASES.size()])
	quit(failed)

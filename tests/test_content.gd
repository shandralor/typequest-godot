extends SceneTree

## Content build-gate: runs the ContentValidator over the band-1 arc and asserts
## zero problems (hashes match, targets exist, band limits hold, ids resolve, the
## band carries no key/finger term, prose is typeable on AZERTY).
## Run: godot --headless --script res://tests/test_content.gd

const ContentValidator = preload("res://logic/content_validator.gd")
const Band1Arc = preload("res://content/band1/band1_arc.gd")
const LocaleNlBe = preload("res://axis/locale/nl_be.gd")
const Band1Spec = preload("res://content/band1/band_spec.gd")


func _initialize() -> void:
	var problems = ContentValidator.validate(Band1Arc.build(), LocaleNlBe.new(), Band1Spec.SPEC)
	for p in problems:
		print("PROBLEM: ", p)
	print("test_content: %d problems" % problems.size())
	quit(problems.size())

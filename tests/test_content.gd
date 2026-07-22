extends SceneTree

## Content build-gate: runs the ContentValidator over the band-1 arc and asserts
## zero problems (hashes match, targets exist, band limits hold, ids resolve, the
## band carries no key/finger term, prose is typeable on AZERTY). Also validates
## the OVERWORLD sites: words resolve, are lowercase + AZERTY-typeable, no word is
## a prefix of another (a shorter word would complete first and shadow the longer
## one), and unlocked sites map to known scenarios.
## Run: godot --headless --script res://tests/test_content.gd

const ContentValidator = preload("res://logic/content_validator.gd")
const Band1Arc = preload("res://content/band1/band1_arc.gd")
const GrindArc = preload("res://content/grind/grind_arc.gd")
const ArcheryArc = preload("res://content/archery/archery_arc.gd")
const IntroArc = preload("res://content/intro/intro_arc.gd")
const HomeArc = preload("res://content/home/home_arc.gd")
const MillArc = preload("res://content/mill/mill_arc.gd")
const LocaleNlBe = preload("res://axis/locale/nl_be.gd")
const Band1Spec = preload("res://content/band1/band_spec.gd")
const OverworldSites = preload("res://content/overworld.gd")
const Objectives = preload("res://content/objectives.gd")
const Scenarios = preload("res://content/scenarios.gd")
const Layout = preload("res://axis/layout/be_azerty.gd")


func _initialize() -> void:
	var total := 0
	for graph in [Band1Arc.build(), GrindArc.build(), ArcheryArc.build(), IntroArc.build(), HomeArc.build(), MillArc.build()]:
		var problems = ContentValidator.validate(graph, LocaleNlBe.new(), Band1Spec.SPEC)
		for p in problems:
			print("PROBLEM: ", p)
		total += problems.size()
	total += _check_overworld()
	print("test_content: %d problems" % total)
	quit(total)


func _check_overworld() -> int:
	var problems: Array = []
	var locale = LocaleNlBe.new()
	var scenario_ids: Array = []
	for s in Scenarios.list():
		scenario_ids.append(s.id)
	var words: Array = []
	for site in OverworldSites.sites():
		var word: String = locale.resolve(site.word_key)
		if word == "":
			problems.append("site '%s': word key '%s' does not resolve" % [site.id, site.word_key])
			continue
		if word != word.to_lower():
			problems.append("site '%s': word '%s' is not lowercase" % [site.id, word])
		if not Layout.supports_text(word):
			problems.append("site '%s': word '%s' not typeable on AZERTY" % [site.id, word])
		words.append(word)
		if site.unlocked and site.scenario == "":
			problems.append("site '%s': unlocked but has no scenario" % site.id)
		if site.scenario != "" and site.scenario not in scenario_ids:
			problems.append("site '%s': unknown scenario '%s'" % [site.id, site.scenario])
	for a in words:
		for b in words:
			if a != b and b.begins_with(a):
				problems.append("site word '%s' is a prefix of '%s' -- it would shadow it" % [a, b])
	# objectives: target site exists, hint resolves
	var site_ids: Array = []
	for site in OverworldSites.sites():
		site_ids.append(site.id)
	for o in Objectives.all():
		if o.target_site not in site_ids:
			problems.append("objective '%s': unknown target_site '%s'" % [o.id, o.target_site])
		if locale.resolve(o.hint_key) == "":
			problems.append("objective '%s': hint_key '%s' does not resolve" % [o.id, o.hint_key])
	for p in problems:
		print("PROBLEM: ", p)
	return problems.size()

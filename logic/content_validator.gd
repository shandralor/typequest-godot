class_name ContentValidator
extends RefCounted

## The content build-gate (brief A4 / Section 9 guards). Pure: validates a story
## graph against a locale, the band spec, the keyboard layout, and the asset
## vocabulary, and returns a list of human-readable problems (empty == valid).
##
## Checks:
##  - every text key resolves in the locale (prose, narration, choice words);
##  - every choice target and every return_to exists in the graph;
##  - the per-locale safety hash matches the resolved prose (A4 -- a mismatch means
##    the PROSE must be fixed to be byte-identical, never the hash);
##  - band limits hold on resolved prose (maxWordLen, maxSentenceLen);
##  - the band spec carries NO key/finger term (A2/A3 decoupling);
##  - every prose character is typeable on the layout (charSet lower-no-altgr);
##  - every scene actor/prop id resolves in the vocabulary, and the location is known.

const Fnv1a = preload("res://logic/fnv1a.gd")
const Layout = preload("res://axis/layout/be_azerty.gd")
const Vocabulary = preload("res://axis/vocabulary/fantasy_poc.gd")

const LOCATION_IDS := ["forest_path", "dungeon", "forge", "archery_range"]
# The band must not encode per-key or per-finger gating (A2/A3). `charSet` legitimately
# names a coarse character class (e.g. "lower-no-altgr"), so we flag only "finger".
const FORBIDDEN_BAND_TERMS := ["finger"]


static func validate(graph, locale, band_spec: Dictionary) -> Array:
	var problems: Array = []
	_check_band_terms(problems, band_spec)
	for id in graph.nodes:
		_check_node(problems, graph, locale, band_spec, graph.nodes[id])
	return problems


static func _check_band_terms(problems: Array, band_spec: Dictionary) -> void:
	for k in band_spec.keys():
		var blob := (str(k) + "=" + str(band_spec[k])).to_lower()
		for term in FORBIDDEN_BAND_TERMS:
			if blob.find(term) != -1:
				problems.append("band spec field '%s' carries forbidden key/finger term '%s'" % [k, term])


static func _check_node(problems: Array, graph, locale, band_spec: Dictionary, node) -> void:
	var id: String = node.id
	# text keys resolve
	_check_key(problems, locale, node.prose_key, id, "prose_key")
	_check_key(problems, locale, node.narration_key, id, "narration_key")
	for ch in node.choices:
		_check_key(problems, locale, ch.word_key, id, "choice word_key")
		if not graph.has_node(ch.target):
			problems.append("node '%s' choice target '%s' does not exist" % [id, ch.target])
	if node.return_to != "" and not graph.has_node(node.return_to):
		problems.append("node '%s' return_to '%s' does not exist" % [id, node.return_to])

	var prose: String = locale.resolve(node.prose_key)
	# safety hash matches resolved prose, per locale
	var locale_id: String = locale.LOCALE_ID
	if node.safety.has(locale_id):
		var approved: String = node.safety[locale_id]["hash"]
		if not Fnv1a.matches(prose, approved):
			problems.append("node '%s' safety hash mismatch: prose hashes %s, approved %s -- FIX THE PROSE, not the hash" % [id, Fnv1a.hash_prose(prose), approved])
	else:
		problems.append("node '%s' has no safety record for locale %s" % [id, locale_id])

	# band limits + layout typeability on resolved prose
	_check_limits(problems, id, prose, band_spec)
	if not Layout.supports_text(prose):
		problems.append("node '%s' prose has characters not typeable on the layout" % id)

	# scene ids resolve
	if node.scene != null:
		_check_scene(problems, id, node.scene)


static func _check_key(problems: Array, locale, key: String, id: String, role: String) -> void:
	if key == "" or not locale.has_key(key):
		problems.append("node '%s' %s '%s' does not resolve in the locale" % [id, role, key])


static func _check_limits(problems: Array, id: String, prose: String, band_spec: Dictionary) -> void:
	var max_word: int = band_spec["maxWordLen"]
	var max_sentence: int = band_spec["maxSentenceLen"]
	for sentence in prose.split(".", false):
		var words := sentence.strip_edges().split(" ", false)
		if words.size() > max_sentence:
			problems.append("node '%s' sentence exceeds maxSentenceLen %d (%d words)" % [id, max_sentence, words.size()])
		for w in words:
			var clean := w.lstrip(",.").rstrip(",.")
			if clean.length() > max_word:
				problems.append("node '%s' word '%s' exceeds maxWordLen %d" % [id, clean, max_word])


static func _check_scene(problems: Array, id: String, scene) -> void:
	if not (scene.location in LOCATION_IDS):
		problems.append("node '%s' scene location '%s' is not a known location" % [id, scene.location])
	for a in scene.actors:
		if Vocabulary.resolve(a.asset) == "":
			problems.append("node '%s' actor asset '%s' does not resolve in the vocabulary" % [id, a.asset])
	for p in scene.props:
		if Vocabulary.resolve(p.asset) == "":
			problems.append("node '%s' prop asset '%s' does not resolve in the vocabulary" % [id, p.asset])

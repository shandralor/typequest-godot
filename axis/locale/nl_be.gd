class_name LocaleNlBe
extends RefCounted

## Content-language axis (brief A3): the nl-BE catalog. Text keys -> resolved
## strings. The story graph carries keys; swap this catalog (nl-BE -> fr-BE) and
## the same graph plays in another language without touching the graph or engine.
##
## Prose and narration are AUTHORED band-1 content (brief A7). The prose strings
## are byte-identical to A7 so their FNV-1a safety hashes verify (see A4 / the
## test). Do not edit prose casually -- an edit re-triggers the safety review.

const LOCALE_ID := "nl-BE"
const LABEL := "Vlaams (Belgie)"

const CATALOG := {
	# hero subject nouns (the {held} token in typed prose -> the chosen character). BAND-1
	# CONTENT: lowercase, <=7 chars, no Shift/AltGr -- the content validator substitutes each
	# into every {held} prose and re-checks band + typeability. Add a hero -> add a key here.
	"hero.knight": "ridder",
	"hero.barbarian": "barbaar",
	"hero.mage": "magier",
	"hero.ranger": "jager",
	"hero.rogue": "dief",
	"hero.witch": "heks",
	# primary weapon per hero (the {wapen} token) -- same band-1 rules; the intro names it and
	# the house wall shows the matching prop (composer picks the chosen hero's weapon node).
	"wapen.knight": "zwaard",
	"wapen.barbarian": "bijl",
	"wapen.mage": "staf",
	"wapen.ranger": "kruisboog",
	"wapen.rogue": "dolk",
	"wapen.witch": "staf",
	# prose (typed to reveal the beat)
	"start.prose": "de kleine {held} wandelt door het bos. de {held} volgt het pad en stapt verder.",
	"kruispunt.prose": "het pad gaat twee kanten op. links gaapt een zwarte grot. rechts staat een oude brug.",
	"grot.prose": "in de grot rammelt een wit skelet. de {held} rent snel terug naar het licht.",
	"brug.prose": "de brug ligt naar beneden. de {held} stapt over de brug en gaat verder.",
	# narration (read aloud; optional toggle later)
	"start.narration": "Luister goed en typ elk woord dat je leest.",
	"kruispunt.narration": "Kies je weg en typ het woord.",
	"grot.narration": "Wees moedig en lees rustig verder.",
	"grot.win": "Het skelet is te eng! Jouw {held} moet eerst sterker worden en de wapens halen.",
	"brug.narration": "Stap voor stap over de brug.",
	"brug.lower": "De kristal laat de brug zakken!",
	# placeholder end-of-demo message (read aloud on the crossing win; free text, not typed)
	"demo.end": "Knap gedaan! Je hebt de demo uitgespeeld. Nieuwe avonturen komen binnenkort!",
	# grinding session (the slijplied -- a short song the child types)
	"slijpen.prose": "slijp slijp slijp het grote zwaard. draai het wiel heel snel rond. vonken vliegen door de lucht. de {held} houdt het staal goed vast. het wiel draait rond en rond. kijk de vonken dansen fel. nog een keer en dan nog een. het zwaard wordt heel erg scherp. bijna klaar roept de smid. de laatste vonken spatten hoog. nu is het zwaard weer scherp. de {held} lacht heel blij.",
	"slijpen.narration": "Zing het slijplied en typ elk woord.",
	"slijpen.win": "Goed gedaan! Je zwaard is scherp.",
	# archery session -- sentences grow longer so each arrow lands closer to the bullseye
	"boog.prose": "de boog is klaar. de {held} mikt goed op het doel. de pijl vliegt snel recht door de lucht. de {held} raakt het doel precies in het midden.",
	"boog.narration": "Span de boog en typ elk woord.",
	"boog.win": "Raak! Recht in de roos.",
	# molen -- meet the miller; he tips you how to cross the old bridge (need a crystal)
	"mill.prose": "de molenaar maalt het graan tot fijn meel. hij ziet je bij de open deur. de oude man weet veel over het bos. de oude brug opent met een kristal. het skelet in de grot bewaakt het. versla het en pak het kristal. de molenaar zwaait je vrolijk uit.",
	"mill.narration": "De molenaar heeft een tip voor je.",
	"mill.win": "Nu weet je hoe je de brug opent!",
	# grotFight -- the ARMED return: type the fight, beat the skeleton, win the crystal
	"grotFight.prose": "de {held} spant de sterke boog. een pijl vliegt door de lucht. het skelet wankelt even. de {held} trekt het scherpe zwaard. het zwaard klieft de botten. daar ligt een glanzend kristal. de {held} pakt het kristal snel op.",
	"grotFight.narration": "Wees dapper! Nu ben je sterk genoeg.",
	"grotFight.win": "Je verslaat het skelet! Het kristal is van jou.",
	# intro -- short words teach the core move: type a sentence, the knight does the deed
	# (4 sentences = 4 legs: rise, fetch the sword, fetch the key, leave)
	"intro.prose": "het is morgen. de {held} loopt naar het rek aan de muur. hier hangt je {wapen}. aan de andere kant hangt de sleutel. deze komt later nog van pas. je maakt een ommetje in het bos.",
	"intro.narration": "Typ de woorden.",
	"intro.win": "Jouw {held} maakt een ommetje in het bos!",
	# home -- a RETURN visit: walk in, then CHOOSE which gear to collect (campaign v2)
	"home.prose": "de {held} is weer thuis. de {held} pakt iets van de muur.",
	"home.sword_prose": "de {held} pakt het zwaard van de plank.",
	"home.bow_prose": "de {held} pakt de boog van de muur.",
	"home.narration": "Typ de woorden.",
	"home.win": "Tot de volgende keer!",
	"home.win_sword": "Je hebt je zwaard gehaald!",
	"home.win_bow": "Je hebt je boog gehaald!",
	"home.nothing": "Je hebt alles al gehaald!",
	# site-prerequisite hints (read aloud): go get the gear first
	"hint.smidse": "Haal eerst je zwaard thuis!",
	"hint.boog": "Haal eerst je boog thuis!",
	# objectives -- short read-aloud nudges (not typed, so free punctuation)
	"objective.wapens": "Haal je wapens thuis op!",
	"objective.molen": "Ga naar de molen voor een tip!",
	"objective.grot": "Keer terug naar de grot en versla het skelet!",
	# choice words (typed to pick a fork)
	"word.verder": "verder",
	"word.grot": "grot",
	"word.brug": "brug",
	"word.kist": "kist",
	"word.zwaard": "zwaard",
	"word.boog": "boog",
	# overworld site words (typed to travel to an adventure site)
	"site.bos": "bos",
	"site.smidse": "smidse",
	"site.boog": "boog",
	"site.thuis": "thuis",
	"site.molen": "molen",
	"overworld.narration": "Waar ga je naartoe? Typ het woord.",
	"overworld.locked": "Nog niet open",
	# revisiting a site whose objective is already done -- a gentle beat before the (optional)
	# replay, so a return does not feel like blind repetition (read-aloud, free punctuation)
	"overworld.again": "Dit heb je al gedaan. Oefenen mag altijd!",
}

# Intro briefing: read-aloud sentences that roll across the screen one by one BEFORE
# the typing starts (game_controller plays them). Not typed -- so free capitals and
# punctuation, no band/hash/layout constraints. EDIT / ADD / REORDER these freely.
const INTRO_BRIEFING := [
	"Dit is jouw {held}.",
	"Jouw {held} beweegt als je de woorden typt die je onderaan ziet verschijnen.",
	"Volg zo goed mogelijk de aanwijzingen voor het plaatsen van je vingers.",
]


func briefing() -> Array:
	return INTRO_BRIEFING


func resolve(key: String) -> String:
	return CATALOG.get(key, "")


## The hero ids the prose tokens can resolve for (derived from the "hero.*" keys, so the
## roster of typable heroes lives entirely in this content axis -- the validator stays pure).
func hero_ids() -> Array:
	var ids: Array = []
	for k in CATALOG:
		if (k as String).begins_with("hero."):
			ids.append((k as String).substr(5))
	return ids


## Fill the per-hero prose tokens for ONE hero: {held} -> subject noun (hero.<id>),
## {wapen} -> primary weapon (wapen.<id>). Used at runtime for the chosen hero and by the
## validator/tests for every hero. An unknown token key resolves to "" (caught by the checks).
func fill_tokens(text: String, hero_id: String) -> String:
	text = text.replace("{held}", CATALOG.get("hero." + hero_id, ""))
	text = text.replace("{wapen}", CATALOG.get("wapen." + hero_id, ""))
	return text


## Every concrete string a child could type from a template: no token -> [text]; with a
## {held}/{wapen} token -> one fully-filled string PER hero (the tokens are correlated, so
## this is per-hero, not a cross-product). The content validator + layout test check each.
func hero_prose_variants(text: String) -> Array:
	if not (text.contains("{held}") or text.contains("{wapen}")):
		return [text]
	var out: Array = []
	for id in hero_ids():
		out.append(fill_tokens(text, id))
	return out


func has_key(key: String) -> bool:
	return CATALOG.has(key)


func keys() -> Array:
	return CATALOG.keys()

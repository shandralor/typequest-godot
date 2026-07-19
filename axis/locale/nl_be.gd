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
	# prose (typed to reveal the beat)
	"start.prose": "de kleine {held} wandelt door het bos. hij volgt het pad en stapt verder.",
	"kruispunt.prose": "het pad gaat twee kanten op. links gaapt een zwarte grot. rechts staat een oude brug.",
	"grot.prose": "in de grot rammelt een wit skelet. de {held} rent snel terug naar het licht.",
	"naGrot.prose": "de {held} kiest nu voor de veilige brug.",
	"brug.prose": "de brug ligt naar beneden. de {held} stapt over de brug en gaat verder.",
	"schat.prose": "de {held} opent de kist vol goud. hij vindt de schat en is heel blij.",
	# narration (read aloud; optional toggle later)
	"start.narration": "Luister goed en typ elk woord dat je leest.",
	"kruispunt.narration": "Kies je weg en typ het woord.",
	"grot.narration": "Wees moedig en lees rustig verder.",
	"grot.win": "Het skelet is te eng! De ridder moet eerst sterker worden en zijn wapens halen.",
	"naGrot.narration": "De ridder kiest de veilige weg.",
	"brug.narration": "Stap voor stap over de brug.",
	"brug.lower": "De kristal laat de brug zakken!",
	"schat.narration": "Goed gedaan, kleine held!",
	"schat.win": "Goed gedaan! Je hebt de schat.",
	# grinding session (the slijplied -- a short song the child types)
	"slijpen.prose": "slijp slijp slijp het grote zwaard. draai het wiel heel snel rond. vonken vliegen door de lucht. de {held} houdt het staal goed vast. het wiel draait rond en rond. kijk de vonken dansen fel. nog een keer en dan nog een. het zwaard wordt heel erg scherp. bijna klaar roept de smid. de laatste vonken spatten hoog. nu is het zwaard weer scherp. de {held} lacht heel blij.",
	"slijpen.narration": "Zing het slijplied en typ elk woord.",
	"slijpen.win": "Goed gedaan! Je zwaard is scherp.",
	# archery session -- sentences grow longer so each arrow lands closer to the bullseye
	"boog.prose": "de boog is klaar. de {held} mikt goed op het doel. de pijl vliegt snel recht door de lucht. de {held} raakt het doel precies in het midden.",
	"boog.narration": "Span de boog en typ elk woord.",
	"boog.win": "Raak! Recht in de roos.",
	# intro -- short words teach the core move: type a sentence, the knight does the deed
	# (4 sentences = 4 legs: rise, fetch the sword, fetch the key, leave)
	"intro.prose": "hij loopt naar de muur. hier hangt zijn zwaard. de sleutel heeft hij later nodig. nu gaat hij naar de deur.",
	"intro.narration": "Typ de woorden.",
	"intro.win": "Hij maakt een ommetje in het bos!",
	# home -- a RETURN visit: walk in, then CHOOSE which gear to collect (campaign v2)
	"home.prose": "de {held} is weer thuis. hij pakt iets van de muur.",
	"home.sword_prose": "hij pakt zijn zwaard van de plank.",
	"home.bow_prose": "hij pakt zijn boog van de muur.",
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
	"overworld.narration": "Waar ga je naartoe? Typ het woord.",
	"overworld.locked": "Nog niet open",
}

# Intro briefing: read-aloud sentences that roll across the screen one by one BEFORE
# the typing starts (game_controller plays them). Not typed -- so free capitals and
# punctuation, no band/hash/layout constraints. EDIT / ADD / REORDER these freely.
const INTRO_BRIEFING := [
	"Dit is jouw ridder.",
	"Hij zal bewegen als je de woorden typt die je onderaan ziet verschijnen.",
	"Volg zo goed mogelijk de aanwijzingen voor het plaatsen van je vingers.",
]


func briefing() -> Array:
	return INTRO_BRIEFING


func resolve(key: String) -> String:
	return CATALOG.get(key, "")


## Every hero subject noun (the "hero.*" keys) -- the content validator substitutes each
## into every {held} prose so ALL variants are proven band-1 + typeable, not just one.
func hero_nouns() -> Array:
	var nouns: Array = []
	for k in CATALOG:
		if (k as String).begins_with("hero."):
			nouns.append(CATALOG[k])
	return nouns


## Resolve a prose key AND fill the {held} token with a specific hero noun (runtime typing
## target). `noun` empty -> the raw template (with the token) is returned.
func resolve_held(key: String, noun: String) -> String:
	var text: String = CATALOG.get(key, "")
	if noun == "":
		return text
	return text.replace("{held}", noun)


func has_key(key: String) -> bool:
	return CATALOG.has(key)


func keys() -> Array:
	return CATALOG.keys()

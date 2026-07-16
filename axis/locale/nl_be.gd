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
	# prose (typed to reveal the beat)
	"start.prose": "de kleine ridder loopt door het bos. hij zoekt een grote schat en wil verder.",
	"kruispunt.prose": "het pad gaat twee kanten op. links gaapt een zwarte grot. rechts staat een oude brug.",
	"grot.prose": "in de grot rammelt een wit skelet. de ridder rent snel terug naar het licht.",
	"naGrot.prose": "de ridder kiest nu voor de veilige brug.",
	"brug.prose": "de ridder stapt over de smalle brug. aan de andere kant wacht een grote kist.",
	"schat.prose": "de ridder opent de kist vol goud. hij vindt de schat en is heel blij.",
	# narration (read aloud; optional toggle later)
	"start.narration": "Luister goed en typ elk woord dat je leest.",
	"kruispunt.narration": "Kies je weg en typ het woord.",
	"grot.narration": "Wees moedig en lees rustig verder.",
	"naGrot.narration": "De ridder kiest de veilige weg.",
	"brug.narration": "Stap voor stap over de brug.",
	"schat.narration": "Goed gedaan, kleine held!",
	"schat.win": "Goed gedaan! Je hebt de schat.",
	# grinding session (the slijplied -- a short song the child types)
	"slijpen.prose": "slijp slijp slijp het grote zwaard. draai het wiel heel snel rond. vonken vliegen door de lucht. de ridder houdt het staal goed vast. het wiel draait rond en rond. kijk de vonken dansen fel. nog een keer en dan nog een. het zwaard wordt heel erg scherp. bijna klaar roept de smid. de laatste vonken spatten hoog. nu is het zwaard weer scherp. de ridder lacht heel blij.",
	"slijpen.narration": "Zing het slijplied en typ elk woord.",
	"slijpen.win": "Goed gedaan! Je zwaard is scherp.",
	# archery session -- sentences grow longer so each arrow lands closer to the bullseye
	"boog.prose": "de boog is klaar. de ridder mikt goed op het doel. de pijl vliegt snel recht door de lucht. de ridder raakt het doel precies in het midden.",
	"boog.narration": "Span de boog en typ elk woord.",
	"boog.win": "Raak! Recht in de roos.",
	# intro -- short words teach the core move: type a sentence, the knight does the deed
	# (4 sentences = 4 legs: rise, fetch the sword, fetch the key, leave)
	"intro.prose": "de ridder staat op. hij pakt zijn zwaard. hij loopt naar de kast en pakt de sleutel. daarna opent hij de deur.",
	"intro.narration": "Typ de woorden.",
	"intro.win": "Klaar voor het avontuur!",
	# home -- a RETURN visit to the house (overworld "thuis" site): walk in, look around
	"home.prose": "de ridder is weer thuis. hij loopt naar binnen en kijkt rond.",
	"home.narration": "Typ de woorden.",
	"home.win": "Tot de volgende keer!",
	# choice words (typed to pick a fork)
	"word.verder": "verder",
	"word.grot": "grot",
	"word.brug": "brug",
	"word.kist": "kist",
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


func has_key(key: String) -> bool:
	return CATALOG.has(key)


func keys() -> Array:
	return CATALOG.keys()

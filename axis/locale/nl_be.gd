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
	"start.narration": "luister goed en typ elk woord dat je leest.",
	"kruispunt.narration": "kies je weg en typ het woord.",
	"grot.narration": "wees moedig en lees rustig verder.",
	"naGrot.narration": "de ridder kiest de veilige weg.",
	"brug.narration": "stap voor stap over de brug.",
	"schat.narration": "goed gedaan kleine held.",
	"schat.win": "goed gedaan. je hebt de schat.",
	# grinding session (the slijplied -- a short song the child types)
	"slijpen.prose": "slijp slijp slijp het grote zwaard. draai het wiel heel snel rond. vonken vliegen door de lucht. de ridder houdt het staal goed vast. het wiel draait rond en rond. kijk de vonken dansen fel. nog een keer en dan nog een. het zwaard wordt heel erg scherp. bijna klaar roept de smid. de laatste vonken spatten hoog. nu is het zwaard weer scherp. de ridder lacht heel blij.",
	"slijpen.narration": "zing het slijplied en typ elk woord.",
	"slijpen.win": "goed gedaan. je zwaard is scherp.",
	# choice words (typed to pick a fork)
	"word.verder": "verder",
	"word.grot": "grot",
	"word.brug": "brug",
	"word.kist": "kist",
	# overworld site words (typed to travel to an adventure site)
	"site.bos": "bos",
	"site.smidse": "smidse",
	"site.boog": "boog",
	"overworld.narration": "waar ga je naartoe? typ het woord.",
	"overworld.locked": "nog niet open",
}


func resolve(key: String) -> String:
	return CATALOG.get(key, "")


func has_key(key: String) -> bool:
	return CATALOG.has(key)


func keys() -> Array:
	return CATALOG.keys()

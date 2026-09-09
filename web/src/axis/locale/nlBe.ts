// Content-language axis (brief A3): the nl-BE catalog. Faithful port of
// axis/locale/nl_be.gd. The story graph carries KEYS; swap this catalog and the
// same graph plays in another language without touching graph or engine.
//
// Prose strings are byte-identical to the Godot catalog so their FNV-1a safety
// hashes verify. Do not edit prose casually -- it re-triggers the safety review.

export const LOCALE_ID = "nl-BE";
export const LABEL = "Vlaams (Belgie)";

export const CATALOG: Record<string, string> = {
  // hero subject nouns (the {held} token -> the chosen character)
  "hero.knight": "ridder",
  "hero.barbarian": "barbaar",
  "hero.mage": "magier",
  "hero.ranger": "jager",
  "hero.rogue": "verkenner",
  "hero.witch": "heks",
  // Primary weapon per hero (the {wapen} token). GRAMMAR TRAP: only "zwaard" is a het-word --
  // bijl, staf, kruisboog and dolk are all de-words. So never write "het {wapen}" or "de {wapen}";
  // write "je {wapen}", which is correct for both genders (and matches the game's register).
  "wapen.knight": "zwaard",
  "wapen.barbarian": "bijl",
  "wapen.mage": "staf",
  "wapen.ranger": "kruisboog",
  "wapen.rogue": "dolk",
  "wapen.witch": "staf",
  // prose (typed to reveal the beat)
  "start.prose": "de kleine {held} wandelt door het bos. de {held} volgt het pad en stapt verder.",
  "kruispunt.prose": "het pad gaat twee kanten op. links gaapt een zwarte grot. rechts staat een oude brug.",
  "grot.prose": "in de grot rammelt een wit skelet. de {held} rent snel terug naar het licht.",
  "brug.prose": "de brug ligt naar beneden. de {held} stapt over de brug en gaat verder.",
  // narration (read aloud)
  "start.narration": "Luister goed en typ elk woord dat je leest.",
  "kruispunt.narration": "Kies je weg en typ het woord.",
  "grot.narration": "Wees moedig en lees rustig verder.",
  "grot.win": "Het skelet is te eng! Jouw {held} moet eerst sterker worden en de wapens halen.",
  "brug.narration": "Stap voor stap over de brug.",
  "brug.lower": "De kristal laat de brug zakken!",
  "demo.end": "Knap gedaan! Je hebt de demo uitgespeeld. Nieuwe avonturen komen binnenkort!",
  // grinding session (the slijplied)
  "slijpen.prose": "slijp slijp slijp het grote zwaard. draai het wiel heel snel rond. vonken vliegen door de lucht. de {held} houdt het staal goed vast. het wiel draait rond en rond. kijk de vonken dansen fel. nog een keer en dan nog een. het zwaard wordt heel erg scherp. bijna klaar roept de smid. de laatste vonken spatten hoog. nu is het zwaard weer scherp. de {held} lacht heel blij.",
  "slijpen.narration": "Zing het slijplied en typ elk woord.",
  "slijpen.win": "Goed gedaan! Je zwaard is scherp.",
  // archery session
  "boog.prose": "de {held} maakt zich klaar. de {held} mikt goed op het doel. het vliegt snel en recht door de lucht. de {held} raakt het doel precies in het midden.",
  "boog.narration": "Mik goed en typ elk woord.",
  "boog.win": "Raak! Recht in de roos.",
  // molen
  "mill.prose": "de molenaar maalt het graan tot fijn meel. hij ziet je bij de open deur. de oude man weet veel over het bos. de oude brug opent met een kristal. het skelet in de grot bewaakt het. versla het en pak het kristal. de molenaar zwaait je vrolijk uit.",
  "mill.narration": "De molenaar heeft een tip voor je.",
  "mill.win": "Nu weet je hoe je de brug opent!",
  // grotFight -- the armed return
  "grotFight.prose": "de {held} maakt zich klaar voor de strijd. het skelet komt met grote stappen dichtbij. de {held} valt het skelet dapper aan. het skelet wankelt even. nog een keer en het valt om. daar ligt een glanzend kristal. de {held} pakt het kristal snel op.",
  "grotFight.narration": "Wees dapper! Nu ben je sterk genoeg.",
  "grotFight.win": "Je verslaat het skelet! Het kristal is van jou.",
  // intro
  "intro.prose": "het is morgen. de {held} loopt naar het rek aan de muur. hier hangt je {wapen}. aan de andere kant hangt de sleutel. deze komt later nog van pas. je maakt een ommetje in het bos.",
  "intro.narration": "Typ de woorden.",
  "intro.win": "Jouw {held} maakt een ommetje in het bos!",
  // home -- a return visit
  "home.prose": "de {held} is weer thuis. de {held} pakt iets van de muur.",
  "home.sword_prose": "de {held} pakt je {wapen} van de plank.",
  "home.bow_prose": "de {held} pakt het wapen van de muur.",
  "home.narration": "Typ de woorden.",
  "home.win": "Tot de volgende keer!",
  "home.win_sword": "Je hebt je {wapen} gehaald!",
  "home.win_bow": "Je hebt je wapen gehaald!",
  "home.nothing": "Je hebt alles al gehaald!",
  // site-prerequisite hints
  "hint.smidse": "Haal eerst je {wapen} thuis!",
  "hint.boog": "Haal eerst je wapen thuis!",
  // objectives
  "objective.wapens": "Haal je wapens thuis op!",
  "objective.molen": "Ga naar de molen voor een tip!",
  "objective.grot": "Keer terug naar de grot en versla het skelet!",
  // choice words (typed to pick a fork)
  "word.verder": "verder",
  "word.grot": "grot",
  "word.brug": "brug",
  "word.kist": "kist",
  "word.zwaard": "{wapen}",
  "word.boog": "wapen",
  // overworld site words
  "site.bos": "bos",
  "site.smidse": "smidse",
  "site.boog": "oefenplein",
  "site.thuis": "thuis",
  "site.molen": "molen",
  "overworld.narration": "Waar ga je naartoe? Typ het woord.",
  "overworld.locked": "Nog niet open",
  "overworld.again": "Dit heb je al gedaan. Oefenen mag altijd!",
};

export function resolve(key: string): string {
  return CATALOG[key] ?? "";
}

export function hasKey(key: string): boolean {
  return key in CATALOG;
}

export function keys(): string[] {
  return Object.keys(CATALOG);
}

// The hero ids the prose tokens can resolve for (derived from the "hero.*" keys).
export function heroIds(): string[] {
  return keys()
    .filter((k) => k.startsWith("hero."))
    .map((k) => k.slice("hero.".length));
}

// Fill the per-hero prose tokens for ONE hero: {held} -> hero.<id>, {wapen} -> wapen.<id>.
export function fillTokens(text: string, heroId: string): string {
  return text
    .split("{held}").join(CATALOG["hero." + heroId] ?? "")
    .split("{wapen}").join(CATALOG["wapen." + heroId] ?? "");
}

// Every concrete string a child could type from a template: no token -> [text];
// with a token -> one fully-filled string PER hero.
export function heroProseVariants(text: string): string[] {
  if (!(text.includes("{held}") || text.includes("{wapen}"))) return [text];
  return heroIds().map((id) => fillTokens(text, id));
}

// The Locale shape RunState + the validator consume.
export const nlBe = {
  LOCALE_ID,
  resolve,
  hasKey,
  keys,
  heroProseVariants,
};

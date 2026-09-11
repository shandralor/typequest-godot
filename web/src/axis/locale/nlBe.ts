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
  "grot.prose": "in de grot rammelt een eng skelet. de {held} rent snel terug naar het licht.",
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
  // The forge beat comes in three flavours, because a staf and a kruisboog cannot be sharpened
  // (characters.weaponGroupFor): blades grind, the ranger fletches, casters study. Each is its
  // own node with its own safety hash -- the sentences differ in structure, so the {wapen}
  // template trick that carries the hero nouns cannot carry these.
  "slijpen.blades.prose": "slijp slijp slijp je {wapen} scherp. draai het wiel heel snel rond. vonken vliegen door de lucht. de {held} houdt het staal goed vast. het wiel draait rond en rond. kijk de vonken dansen fel. nog een keer en dan nog een. je {wapen} wordt heel erg scherp. bijna klaar nog even doorgaan. de laatste vonken spatten hoog. nu is je {wapen} weer scherp. de {held} lacht heel blij.",
  "slijpen.blades.narration": "Zing het slijplied en typ elk woord.",
  "slijpen.blades.win": "Goed gedaan! Je {wapen} is scherp.",
  "slijpen.ranged.prose": "de {held} maakt nieuwe pijlen. snijd het hout heel recht. leg de pijlen op een rij. tel ze samen een voor een. de koker raakt langzaam vol. nu is je {wapen} weer klaar. de {held} lacht heel blij.",
  "slijpen.ranged.narration": "Maak je pijlen en typ elk woord.",
  "slijpen.ranged.win": "Goed gedaan! Je pijlen zijn klaar.",
  "slijpen.caster.prose": "de {held} slaat het boek open. lees de woorden hardop voor. het licht danst om je {wapen}. de letters gloeien warm en fel. nog een keer en dan nog een. nu is je {wapen} weer sterk. de {held} lacht heel blij.",
  "slijpen.caster.narration": "Lees de spreuk en typ elk woord.",
  "slijpen.caster.win": "Goed gedaan! Je {wapen} gloeit weer.",
  // archery session
  "boog.prose": "de {held} maakt zich klaar. de {held} mikt goed op het doel. de {held} haalt diep adem. de {held} raakt het doel precies in het midden.",
  "boog.narration": "Mik goed en typ elk woord.",
  "boog.win": "Raak! Recht in de roos.",
  // molen
  // Rewritten to what is actually ON SCREEN: the windmill model's door is baked shut, the miller
  // stands outside on the path, and nothing mills or waves. The tip he gives is the point of the
  // beat and is unchanged.
  "mill.prose": "de molenaar loopt rond zijn molen. hij ziet je meteen staan. hij weet veel over het bos. de oude brug opent met een kristal. het skelet in de grot bewaakt het. versla het en pak het kristal. de molenaar wenst je veel geluk.",
  "mill.narration": "De molenaar heeft een tip voor je.",
  "mill.win": "Nu weet je hoe je de brug opent!",
  // grotFight -- the armed return. The prose is the APPROACH only; the fight itself is three
  // staged phases the child steers with a typed word (word.sla / word.blok / word.duik), and
  // strijdVal.prose is the payoff they type once the skeleton is down.

  "grotFight.prose": "de {held} stapt de donkere grot in. het skelet ligt stil op de grond. dan beweegt er iets in het donker. de {held} maakt zich klaar voor de strijd.",
  "grotFight.narration": "Wees dapper! Nu ben je sterk genoeg.",
  "strijdVal.prose": "het skelet valt met een klap om. daar ligt een glanzend kristal. de {held} pakt het kristal snel op.",
  "strijdVal.narration": "Het is gelukt! Typ elk woord.",
  "grotFight.win": "Je verslaat het skelet! Het kristal is van jou.",

  // The three fight phases. Each one READS what the skeleton is doing and the child answers
  // with the matching word -- that is the whole rule, and it is telegraphed every time, so a
  // six-year-old can learn it rather than guess. Narration only: these beats are steered, not
  // typed, and the typing volume lives in the approach and the payoff around them.
  // Each phase is a passage the child TYPES and then a fork. The passage is also the tell:
  // it says plainly what the skeleton is doing, which is how the child knows which word
  // answers it. Typing it is the point -- the fork steers the fight, it does not replace it.
  "strijd.slag.prose": "het skelet komt langzaam overeind. het kijkt de {held} recht aan. dan haalt het hard uit met zijn arm.",
  "strijd.slag.narration": "Het skelet haalt uit! Blok of duik!",
  "strijd.open.prose": "het skelet staat nu heel even stil. zijn armen hangen laag naar beneden. dit is het moment om te slaan.",
  "strijd.open.narration": "Het skelet staat open. Sla toe!",
  "strijd.wankel.prose": "het skelet wankelt heen en weer. er vallen botjes op de grond. nog een keer en het valt om.",
  "strijd.wankel.narration": "Het skelet wankelt! Nog een keer!",
  // the setbacks. Nobody loses the run: the phase simply comes round again.
  "strijd.raak.prose": "het skelet raakt de {held} op de arm. dat doet pijn maar het gaat wel. de {held} staat weer stevig klaar.",
  "strijd.raak.narration": "Au! Het skelet raakt jouw {held}. Probeer het nog eens.",
  "strijd.mis.prose": "de {held} wacht te lang met slaan. het skelet stapt weer naar achteren. de {held} moet weer goed kijken.",
  "strijd.mis.narration": "Je wacht te lang. Het skelet komt weer op je af.",
  "strijd.herrijst.prose": "het skelet krabbelt langzaam weer omhoog. de botten klikken zacht tegen elkaar. het staat weer recht voor de {held}.",
  "strijd.herrijst.narration": "Het skelet staat weer op! Sla nog een keer.",
  // intro
  // Third person THROUGHOUT: it read "de barbaar loopt ... hier hangt JE bijl ... JE maakt een
  // ommetje", swapping person mid-passage. "een {wapen}" also dodges the de/het trap, since
  // only "zwaard" is a het-word.
  "intro.prose": "het is morgen. de {held} loopt naar het rek aan de muur. daar hangt een {wapen}. aan de andere kant hangt de sleutel. deze komt later nog van pas. de {held} maakt een ommetje in het bos.",
  "intro.narration": "Typ de woorden.",
  "intro.win": "Jouw {held} maakt een ommetje in het bos!",
  // home -- a return visit
  "home.prose": "de {held} is weer thuis. de {held} pakt iets van de muur.",
  "home.sword_prose": "de {held} pakt een {wapen} van de plank.",
  // the ranged weapon is the child's CHOICE, not the class's: boog or kruisboog
  "home.bow_prose": "de {held} pakt de boog van de muur.",
  "home.crossbow_prose": "de {held} pakt de kruisboog van de muur.",
  "home.narration": "Typ de woorden.",
  "home.win": "Tot de volgende keer!",
  "home.win_sword": "Je hebt je {wapen} gehaald!",
  // the RPG item-get banner over the puff. POSSESSIVE, not an article: "het" is only correct
  // for zwaard, and "de" only for the other five -- "je" is right for both genders.
  "itemget.wapen": "Je hebt nu je {wapen}!",
  "itemget.bow": "Je hebt nu je boog!",
  "itemget.crossbow": "Je hebt nu je kruisboog!",
  "home.win_bow": "Je hebt je boog gehaald!",
  "home.win_crossbow": "Je hebt je kruisboog gehaald!",
  "home.nothing": "Je hebt alles al gehaald!",
  // site-prerequisite hints
  "hint.smidse": "Haal eerst je {wapen} thuis!",
  "hint.boog": "Haal eerst een boog thuis!",
  // objectives
  "objective.wapens": "Haal je wapens thuis op!",
  "objective.molen": "Ga naar de molen voor een tip!",
  "objective.grot": "Keer terug naar de grot en versla het skelet!",
  // choice words (typed to pick a fork)
  "word.verder": "verder",
  "word.grot": "grot",
  "word.brug": "brug",
  "word.kist": "kist",
  // the fight words. Short, unambiguous imperatives a six-year-old can read at a glance:
  // "wijk" was rejected because a Flemish child reads it first as a neighbourhood.
  "word.sla": "sla",
  "word.blok": "blok",
  "word.duik": "duik",
  "word.zwaard": "{wapen}",
  "word.boog": "boog",
  "word.kruisboog": "kruisboog",
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
// The bundled locale. fillTokens belongs here as much as resolve does: main.ts happened to
// reach for the module export instead, so this object silently lacked it and anything handed
// `nlBe` (tests, the validator, the pure layer) resolved "{wapen}" to a literal.
export const nlBe = {
  LOCALE_ID,
  resolve,
  hasKey,
  keys,
  fillTokens,
  heroIds,
  heroProseVariants,
};

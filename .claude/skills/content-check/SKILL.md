---
name: content-check
description: >-
  Review added or changed TypeQuest game TEXT for contextual sense and consistency before it
  ships. Use this WHENEVER you add, edit, rename, or neutralize any user-facing string -- prose
  (*.prose), narration/win/hint/objective/briefing lines, choice words (word.*), site words
  (site.*), hero/weapon nouns (hero.* / wapen.*) -- anywhere in axis/locale/nl_be.gd or
  content/. Trigger it even when the user just says "add this line", "rename the word",
  "make the prose neutral", or "translate/adjust the text", not only when they say "review".
  Its whole job is to catch text that does not fit its context -- above all a word being
  GENERALIZED or reused for the wrong thing (the classic bug: "doel" means the target, so it
  must never become the word for a weapon or a place), plus hero-naming, register/band, and
  scene-fit mistakes. If in doubt whether a text change is worth checking, check it.
---

# TypeQuest content check

You are reviewing Flemish (nl-BE) game text for a touch-typing gamebook aimed at ages 6+.
Every string a child reads or types has a JOB: it names a specific thing, addresses the
child, or narrates a beat. The failure this skill exists to prevent is text that reads fine
in isolation but is WRONG in context -- most often a word quietly generalized so it no longer
means what it means everywhere else. A child who reads "doel" as the target on one screen and
types "doel" to fetch a weapon on the next is being taught that a word means two things. That
erodes exactly what the game teaches. So the first question for every changed word is: **does
this word already mean something else here?**

Work from the actual change: `git diff -- axis/locale/nl_be.gd content/` (or the specific
strings the user just wrote). Review only what changed, but cross-check it against the whole
catalog. Do the checks below, then report using the format at the end.

## 1. Word-meaning consistency -- the doel test (most important)

One word, one referent, across the whole game. Before accepting a new or renamed word, grep
the catalog for that word AND for the concept it names, and confirm you are not overloading a
word that already has a job.

- `grep -n '"<word>"' axis/locale/nl_be.gd` -- is this word already used, and for what?
- Read the prose/lines around the existing uses. A word that appears in prose as a THING the
  child reads about (the target: "raakt het doel") cannot also be a word the child TYPES to
  mean something else (a weapon, a place). If it needs a second meaning, pick a different word.

Check the **glossary** below for the canonical meaning of the recurring words. If a change
contradicts the glossary, that is the bug. If a change adds a new recurring word, add it to the
glossary in this file so the next check catches misuse.

## 2. Referent match -- does the word name what it points at?

A typed word should name the thing it selects. Verify each:
- a **site word** (site.*) names the PLACE you travel to (bos = forest, smidse = forge,
  oefenplein = the practice yard, thuis = home, molen = mill). Not its target, not its reward.
- a **choice/fetch word** (word.*) names WHAT it fetches or the direction it goes
  (word.zwaard = the sword; word.wapen-slot = "wapen", the ranged weapon; word.grot/brug = the
  path). A weapon word must name a weapon, never a target or an activity.
- a **hero/weapon noun** (hero.* / wapen.*) is the character or their weapon, per class.

If a word points at the wrong kind of thing (a weapon called after a target, a place called
after its prize), that is a referent mismatch -- flag it and propose a word that fits.

## 3. Hero naming -- dynamic, gender-neutral, never hardcoded

The chosen hero is one of six, including the witch (heks, female). So:
- Refer to the hero with the token: **`jouw {held}`** in READ-ALOUD lines (narration, win,
  hint, objective, briefing -- they address the child), and **`de {held}`** in narrated PROSE
  (third person). The token resolves to ridder/jager/heks/... per the chosen class.
- NEVER hardcode a class: "de ridder" mislabels every non-knight.
- NEVER a gendered pronoun for the hero: "hij"/"zijn" misgenders the witch. Re-name with
  `{held}` or restructure. (A pronoun for a clearly-male NPC like the miller is fine -- check
  who the pronoun refers to before flagging.)

## 4. Register + band + house style

Two registers, different rules:
- **Typed prose** (keys ending `.prose`, and typed word./site. words): lowercase only; the
  only characters are a-z, space, and a period; band-1 limits hold (word <= 9 letters,
  sentence <= 10 words); everything typeable on Belgian AZERTY with no Shift/AltGr. This is
  what a 6-year-old physically types, so a stray capital or a 12-letter word is a real defect.
- **Read-aloud** (narration/win/hint/objective/briefing): free capitals and punctuation, but
  keep it short and warm.
- **House style everywhere**: no em/en dashes and no emojis -- use `--`. Flemish (nl-BE), not
  Netherlands-Dutch; concrete, age-6 words; short sentences.

## 5. Scene fit -- true for every variant

The line must match what is on screen for that beat, for EVERY character and flag it can play
under. The trap: a scene that varies per class or per flag needs text that stays true across
all of them. The archery/oefenplein beat is played by a bow, a crossbow, a wand and thrown
weapons, so its prose is weapon-NEUTRAL ("mikt op het doel", never "de boog"/"de pijl"). When
you review a line, ask: is this still true if the hero is the witch? if the flag is off? If not,
it needs a neutral phrasing or a per-variant line.

## 6. Hash awareness (safety gate A4)

Prose keys (`*.prose`) carry a per-locale FNV-1a safety hash in their arc
(content/*/…_arc.gd). If you CHANGE a prose string, its hash no longer matches and
`tests/test_content.gd` fails. That is by design: the fix is to recompute the hash over the
new resolved template and update the arc -- never to weaken the check. Flag any prose change
that did not update its hash, and point at the arc file. (Read-aloud lines and word./site.
words are not hashed.) After any change, `bash tests/run.sh` should still pass.

## Glossary -- canonical meanings (keep this current)

These words have ONE meaning in the game. A change that reuses one for something else is the
bug this skill exists to catch. Add a row when a new recurring content word is introduced.

| word | means | never |
| --- | --- | --- |
| doel | the TARGET you aim at (range prose) + the practice-yard's target | a weapon, a place-name |
| oefenplein | the ranged-training SITE (practice yard) | the weapon, the target |
| wapen | the ranged WEAPON the child fetches (word.boog / the {wapen} noun) | the target, the site |
| zwaard | the sword (melee weapon) | any non-sword |
| smidse | the forge SITE (melee training) | the weapon |
| bos / thuis / molen | forest / home / mill SITES | anything else |
| grot / brug | the cave / bridge (forest fork paths) | — |
| {held} | the CHOSEN hero noun (ridder/jager/heks/...) -- always via the token | a hardcoded class, a pronoun |
| {wapen} | the chosen hero's primary weapon noun -- via the token | a hardcoded weapon |

## Report format

Lead with the verdict, then the issues. Keep it tight.

```
Content check: <OK> | <N issue(s)>

<key or string> -- <what's wrong, in one line> (which check)
  fix: <the concrete correction>
```

If everything holds, say so plainly and note what you cross-checked (e.g. "grepped the catalog
for 'doel'/'wapen'; tokens + register + band OK; hashes updated; tests pass"). If you changed
prose, remind that the FNV hash needs recomputing and `bash tests/run.sh` should pass.

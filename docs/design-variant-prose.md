# Design decision: variant / dynamic prose vs. the A4 safety hash

Status: RECOMMENDATION (Wave-1 design spike). Not yet built. Confirm before the
character work (Wave 2 G1) or the item-gated scenes (Wave 3 G6) start. This touches A4
(the per-locale FNV-1a safety hash), which the brief holds sacred -- so it is captured
here for the owner to veto, per the Prime Directive.

## The problem

Today one story node has ONE prose string, resolved from one `prose_key`, and its
hash is the sign-off (content_validator: hash + band limits + typeability all run on
that single resolved string). Two roadmap ideas break the one-string assumption:

- **G1 (per-character subject)**: "de ridder loopt..." should become "de goede heks
  loopt..." per character -- the SUBJECT noun varies inside otherwise-identical prose.
- **G6 (variant beats)**: a scene changes on a flag -- e.g. the grot skeleton flees
  once the player is armed -- so a scene has 2+ entirely different prose strings.

## Recommendation

Treat the two cases DIFFERENTLY -- they are not the same mechanism.

### G6 (whole-beat variants) -- no new hash mechanism needed
A variant is just a DIFFERENT authored prose string, each with its own normal hash. The
scene selects a `prose_key` by flag (e.g. `grot.prose` vs `grot.prose_armed`); each key
is a fully-authored, individually-hashed, band-checked string exactly as today. The only
new thing is the SELECTION (a flag -> which key), which lives in the story graph / scene
descriptor, not in the hashing. A4 is untouched: every string the child sees is a
normal signed-off string.

### G1 (per-character subject) -- template token + approved value list
The prose becomes a TEMPLATE with a token, e.g. `"{held} loopt naar de deur."`. The
subject nouns ("de ridder", "de goede heks", "de druide", ...) come from a small
APPROVED, band-1-validated list on the character/vocabulary axis.

Safety model (preserves A4's INTENT -- nothing unreviewed reaches the child -- without
an explosion of hashes):
1. **Hash the TEMPLATE** (the authored skeleton, token literal included). This is the
   A4 sign-off on the fixed prose; it still guards against silent encoding drift.
2. **Vet the values**: the approved subject-noun list is authored once and each value is
   checked band-1 typeable (lowercase, no AltGr, <= maxWordLen per word).
3. **Enumerate at build time**: test_content resolves EVERY (template x value) combo and
   runs the band-limit + typeability checks on each resolved string -- so a long name
   that would overflow maxSentenceLen is caught. (Cheap: values are a small finite list.)

Why not hash every resolved (node x character) string? That is the maximally-strict
alternative -- airtight but N hashes per node, and every prose edit regenerates all of
them, which erodes the "hash is a manual sign-off" property. The template-hash +
vetted-value-list + enumerated-band-check gives the same safety GUARANTEE (every string
the child sees is composed of reviewed parts, all combinations band/typeability checked)
at far lower friction. If the owner prefers maximal strictness, switch to per-resolution
hashes -- the validator change is small.

## Consequence for the content axes
- The token substitution is a CONTENT-LANGUAGE-axis concern (nl-BE supplies the noun
  list; a future fr-BE supplies its own). The story graph stays free of words (A2).
- The character axis supplies { model, subject-noun-key, gear } (G1); the noun resolves
  through the locale like any other key.
- De-hardcode (G8): prose becomes template + token; the noun list + variant-key
  selection are data.

## Build order when this lands
1. Add token resolution to the locale/prose path (`{held}` -> resolved noun) + the
   approved noun list.
2. Validator: hash the template; enumerate (template x noun) for band/typeability.
3. For G6: teach the scene/graph to pick a `prose_key` by flag (each key normally hashed).

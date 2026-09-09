class_name Band1Spec
extends RefCounted

## The band-1 difficulty spec (brief A2). Difficulty is two continuous knobs --
## story LENGTH and word COMPLEXITY -- never by gating letters. This record carries
## ONLY linguistic + tempo fields; it must contain NO key/finger term (that is what
## keeps story difficulty decoupled from the keyboard layout, A3/A8). The validator
## enforces the no-key/finger-term rule.
##
## PoC ships ONE band, but the schema stays multi-band-capable: adding band 2 later
## is additive data plus one spec row, never a migration.

const SPEC := {
	"id": "band-1",
	"minAccuracy": 0.8,
	"timePressure": false,
	"narrationAutoAdvance": false,
	"maxWordLen": 9,           # per-band balance point, not a universal rule (A2); raised
	                           # 7 -> 9 so weapon nouns like "kruisboog" (crossbow) are typeable
	"maxSentenceLen": 10,
	"vocab": "familiar",
	"repetition": "high",
	"charSet": "lower-no-altgr",
	# NOTE (A2): band-1 does NOT score speed (A6) and timePressure is false, so
	# targetWpm is a nominal, non-scoring pacing reference carried for schema
	# uniformity across bands. Do NOT wire it into scoring.
	"targetWpm": 5,
}

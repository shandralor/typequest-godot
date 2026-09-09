class_name Scoring
extends RefCounted

## The scoring model (brief A6). Pure function: given ONE completed unit of typing,
## return { xp, stars }. Profile-agnostic and deterministic. WHERE the score
## accumulates per child is a separate concern (RunState / profiles); scoring never
## touches it.
##
## PHILOSOPHY: COMPLETION + ACCURACY only. SPEED has ZERO influence at band-1.
## Speed is not even a parameter here, which is what structurally guarantees the
## fast-sloppy-cannot-win invariant: two runs equal in accuracy and correct-char
## count score IDENTICALLY regardless of how fast they were typed.
##
## FUTURE-BAND HOOK (keep, do not implement at band-1): a later band where speed is
## a real signal would add a BAND-GATED speed term (a parameter), never a global one.

const XP_PER_CORRECT_CHAR := 1
const COMPLETION_BONUS := 20
const ACCURACY_FLOOR := 0.5    # even a sloppy run keeps half its volume XP
const STAR2_ACCURACY := 0.85
const STAR3_ACCURACY := 0.95


## Returns { "xp": int, "stars": int }.
static func score(completed: bool, correct_chars: int, accuracy: float) -> Dictionary:
	var accuracy_factor := ACCURACY_FLOOR + (1.0 - ACCURACY_FLOOR) * accuracy
	var volume_xp := correct_chars * XP_PER_CORRECT_CHAR * accuracy_factor
	var xp := int(round((COMPLETION_BONUS if completed else 0.0) + volume_xp))
	var stars := 0
	if completed:
		stars = 1
		if accuracy >= STAR2_ACCURACY:
			stars = 2
		if accuracy >= STAR3_ACCURACY:
			stars = 3
	return {"xp": xp, "stars": stars}

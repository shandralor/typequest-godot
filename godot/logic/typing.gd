class_name TypingState
extends RefCounted

## Type-along comparison + stats for ONE typing target (brief B7, and the input
## side of A6). Pure and deterministic: no Input, no Node, no time.
##
## Model: the child types the target character by character. A keystroke that
## matches the next expected character advances the cursor (a correct char); a
## mismatch counts as a keystroke but does not advance. So `correct == cursor` and
## `accuracy = correct / typed`.
##
## THE PROGRESS PRIMITIVE (B7): progress = cursor / target length. Every character
## of the target counts (letters, spaces, trailing punctuation). An empty target
## reads as fully complete (1). This is the ONE canonical 0..1 signal; consumers
## (animation now; pacing/level-modulation later) read it, they do not re-derive it.
##
## A fork's CHOICE word is a SEPARATE TypingState, matched separately; it is never
## part of prose progress (B7).

var target: String
var cursor: int = 0   # correctly-typed chars so far (== correct count)
var typed: int = 0    # total keystrokes


func _init(p_target: String = "") -> void:
	target = p_target


func reset(p_target: String) -> void:
	target = p_target
	cursor = 0
	typed = 0


## Feed one typed character. Returns true if it was the expected next character.
func type_char(c: String) -> bool:
	if is_complete():
		return false
	typed += 1
	if c == target.substr(cursor, 1):
		cursor += 1
		return true
	return false


func is_complete() -> bool:
	return cursor >= target.length()


## B7 canonical progress signal in [0, 1]. Empty target -> 1.
func progress() -> float:
	if target.length() == 0:
		return 1.0
	return float(cursor) / float(target.length())


func correct_chars() -> int:
	return cursor


## accuracy = correct / typed; accuracy = 1 when nothing was typed (A6). That
## empty-input rule exists ONLY so progress reads as complete; do not use it to
## score a beat where no typing happened (see RunState prerevealed handling).
func accuracy() -> float:
	if typed == 0:
		return 1.0
	return float(cursor) / float(typed)

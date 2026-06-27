class_name RevealWindow
extends RefCounted

## The reveal window (brief B5), pure. The prose is revealed progressively as the
## child types: already-typed text stays visible and the UI paints roughly a few
## words ahead of the cursor, so there is always a little runway but never the whole
## passage at once. This reads the cursor/target; it never truncates the real target
## or gates input on visibility (the typing logic still scores against full prose).

const DEFAULT_WORDS_AHEAD := 4


## Returns the index (exclusive) up to which prose should be shown: the cursor's
## current word plus `words_ahead` further words. Already-typed text (before the
## cursor) is always visible; everything past the returned index is hidden.
static func visible_end(prose: String, cursor: int, words_ahead: int = DEFAULT_WORDS_AHEAD) -> int:
	var n := prose.length()
	var i: int = clampi(cursor, 0, n)
	var words := 0
	# finish the word the cursor is in, then consume `words_ahead` more words
	while i < n and words <= words_ahead:
		while i < n and prose.substr(i, 1) != " ":
			i += 1
		while i < n and prose.substr(i, 1) == " ":
			i += 1
		words += 1
	return i

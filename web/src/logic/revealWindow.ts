// The reveal window (brief B5), pure. Faithful port of logic/reveal_window.gd.
//
// The prose is revealed progressively as the child types: already-typed text stays visible and
// the UI paints roughly a few words ahead of the cursor, so there is always a little runway but
// never the whole passage at once. Seeing a wall of text is discouraging at age 6, and reading
// ahead is not the exercise -- the exercise is reading and typing the word in front of you.
//
// This READS cursor/target; it never truncates the real target and never gates input on
// visibility. The typing logic still compares and scores against the full prose.

export const DEFAULT_WORDS_AHEAD = 4;
export const DEFAULT_CHARS_BEHIND = 40;

/**
 * The start of the visible window: keep roughly `charsBehind` characters of already-typed text
 * before the cursor, snapped forward to a word boundary, so the panel shows a stable couple of
 * lines around the cursor instead of the whole (growing) passage. Older text scrolls off.
 */
export function windowStart(prose: string, cursor: number, charsBehind = DEFAULT_CHARS_BEHIND): number {
  if (cursor <= charsBehind) return 0;
  let i = cursor - charsBehind;
  while (i < cursor && prose[i] !== " ") i += 1;
  while (i < cursor && prose[i] === " ") i += 1;
  return i;
}

/**
 * The index (exclusive) up to which prose should be shown: the cursor's current word plus
 * `wordsAhead` further words. Everything past it is hidden.
 */
export function visibleEnd(prose: string, cursor: number, wordsAhead = DEFAULT_WORDS_AHEAD): number {
  const n = prose.length;
  let i = Math.min(Math.max(cursor, 0), n);
  let words = 0;
  // finish the word the cursor is in, then consume `wordsAhead` more words
  while (i < n && words <= wordsAhead) {
    while (i < n && prose[i] !== " ") i += 1;
    while (i < n && prose[i] === " ") i += 1;
    words += 1;
  }
  return i;
}

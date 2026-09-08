// Pure typing model for the island: the child types a SITE word; prefix matching across all
// candidate words keeps shared prefixes (bos / boog) reachable, so no site shadows another.
// Port of _ow_char / _update_ow_highlight. No DOM, no Three.

export interface Candidate<T> {
  word: string;
  site: T;
}

export class SiteTyper<T> {
  buffer = "";
  constructor(readonly candidates: Candidate<T>[]) {}

  matches(prefix = this.buffer): Candidate<T>[] {
    return this.candidates.filter((c) => c.word.startsWith(prefix));
  }

  /** Feed a character. Returns the completed candidate, or null (accepted-but-incomplete or rejected). */
  typeChar(c: string): Candidate<T> | null {
    const next = this.buffer + c;
    const m = this.matches(next);
    if (m.length === 0) return null; // not a prefix of any site word: ignored
    this.buffer = next;
    return m.find((x) => x.word === next) ?? null;
  }

  /** The next expected key, only once the prefix singles a site out. */
  nextKey(): string {
    const m = this.matches();
    if (m.length === 1 && this.buffer.length < m[0].word.length) return m[0].word.charAt(this.buffer.length);
    return "";
  }

  reset(): void {
    this.buffer = "";
  }
}

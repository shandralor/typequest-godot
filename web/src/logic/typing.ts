// Type-along comparison + stats for ONE typing target (brief B7, input side of A6).
// Pure and deterministic. Faithful port of logic/typing.gd.
//
// A keystroke matching the next expected character advances the cursor; a mismatch
// counts as a keystroke but does not advance. correct == cursor; accuracy = correct/typed.
// progress() is the B7 canonical 0..1 signal (empty target -> 1).

export class TypingState {
  target: string;
  cursor = 0; // correctly-typed chars so far (== correct count)
  typed = 0; // total keystrokes

  constructor(target = "") {
    this.target = target;
  }

  reset(target: string): void {
    this.target = target;
    this.cursor = 0;
    this.typed = 0;
  }

  // Feed one typed character. Returns true if it was the expected next character.
  typeChar(c: string): boolean {
    if (this.isComplete()) return false;
    this.typed += 1;
    if (c === charAt(this.target, this.cursor)) {
      this.cursor += 1;
      return true;
    }
    return false;
  }

  isComplete(): boolean {
    return this.cursor >= charLength(this.target);
  }

  // B7 canonical progress signal in [0, 1]. Empty target -> 1.
  progress(): number {
    const len = charLength(this.target);
    if (len === 0) return 1.0;
    return this.cursor / len;
  }

  correctChars(): number {
    return this.cursor;
  }

  // accuracy = correct / typed; accuracy = 1 when nothing was typed (A6).
  accuracy(): number {
    if (this.typed === 0) return 1.0;
    return this.cursor / this.typed;
  }
}

// Godot String indexing is by code point; mirror that so cursor math matches.
function charLength(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

function charAt(s: string, i: number): string {
  let n = 0;
  for (const ch of s) {
    if (n === i) return ch;
    n++;
  }
  return "";
}

// FNV-1a, 32-bit (migration brief A4). The per-locale content-safety hash.
//
// Offset basis 0x811c9dc5, prime 0x01000193. For each character: XOR the
// accumulator with the character's code point, then multiply by the prime modulo
// 2^32. Emit as zero-padded 8-digit lowercase hex, prefixed `fnv1a:`.
//
// Faithful port of logic/fnv1a.gd. Two correctness pins vs. the naive JS version:
//   - iterate by CODE POINT ([...prose]) to match Godot's String.length()/unicode_at();
//   - use Math.imul for the 32-bit multiply -- `h * PRIME` overflows 2^53 and would
//     lose precision. Math.imul(h, PRIME) >>> 0 == (h * PRIME) & 0xffffffff exactly.
//
// HARD RULE (A4): a failing hash means fix the PROSE to be byte-identical to the
// reviewed string -- NEVER regenerate the hash. Recomputing defeats the safety gate.

const OFFSET_BASIS = 0x811c9dc5;
const PRIME = 0x01000193;
const PREFIX = "fnv1a:";

export function hashProse(prose: string): string {
  let h = OFFSET_BASIS;
  for (const ch of prose) {
    h = (h ^ (ch.codePointAt(0) as number)) >>> 0;
    h = Math.imul(h, PRIME) >>> 0;
  }
  return PREFIX + h.toString(16).padStart(8, "0");
}

// True when the prose still hashes to the approved record.
export function matches(prose: string, approvedHash: string): boolean {
  return hashProse(prose) === approvedHash;
}

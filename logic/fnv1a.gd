class_name Fnv1a
extends RefCounted

## FNV-1a, 32-bit (migration brief A4). The per-locale content-safety hash.
##
## Offset basis 0x811c9dc5, prime 0x01000193. For each character: XOR the
## accumulator with the character's code unit, then multiply by the prime modulo
## 2^32. Emit as zero-padded 8-digit lowercase hex, prefixed `fnv1a:`.
##
## Hashes the RAW resolved prose string with NO normalization (brief A4 / the
## open canonicalization question in Section 6). Band-1 prose is all ASCII, so a
## Unicode code point equals the UTF-16 code unit the original implementation used.
##
## HARD RULE (A4): a failing hash means fix the PROSE encoding to be byte-identical
## to the reviewed string -- NEVER regenerate the hash. Recomputing silently
## defeats the safety gate.

const OFFSET_BASIS := 0x811c9dc5
const PRIME := 0x01000193
const MASK := 0xffffffff
const PREFIX := "fnv1a:"


static func hash_prose(prose: String) -> String:
	var h := OFFSET_BASIS
	for i in prose.length():
		h = (h ^ prose.unicode_at(i)) & MASK
		h = (h * PRIME) & MASK
	return PREFIX + "%08x" % h


## True when the prose still hashes to the approved record.
static func matches(prose: String, approved_hash: String) -> bool:
	return hash_prose(prose) == approved_hash

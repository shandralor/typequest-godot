// The band-1 difficulty spec (brief A2). Faithful port of content/band1/band_spec.gd.
// Difficulty is story LENGTH + word COMPLEXITY, never by gating letters. Carries NO
// key/finger term (that decoupling is enforced by the validator).

export const BAND1_SPEC: Record<string, unknown> = {
  id: "band-1",
  minAccuracy: 0.8,
  timePressure: false,
  narrationAutoAdvance: false,
  maxWordLen: 9, // raised 7 -> 9 so "kruisboog" is typeable
  maxSentenceLen: 10,
  vocab: "familiar",
  repetition: "high",
  charSet: "lower-no-altgr",
  targetWpm: 5, // nominal, non-scoring pacing reference; NOT wired into scoring
};

// The scoring model (brief A6). Pure function. Faithful port of logic/scoring.gd.
//
// COMPLETION + ACCURACY only. SPEED has ZERO influence at band-1 -- it is not even a
// parameter, which structurally guarantees fast-sloppy cannot out-score careful.

const XP_PER_CORRECT_CHAR = 1;
const COMPLETION_BONUS = 20;
const ACCURACY_FLOOR = 0.5; // even a sloppy run keeps half its volume XP
const STAR2_ACCURACY = 0.85;
const STAR3_ACCURACY = 0.95;

export interface Score {
  xp: number;
  stars: number;
}

export function score(completed: boolean, correctChars: number, accuracy: number): Score {
  const accuracyFactor = ACCURACY_FLOOR + (1.0 - ACCURACY_FLOOR) * accuracy;
  const volumeXp = correctChars * XP_PER_CORRECT_CHAR * accuracyFactor;
  const xp = Math.round((completed ? COMPLETION_BONUS : 0.0) + volumeXp);
  let stars = 0;
  if (completed) {
    stars = 1;
    if (accuracy >= STAR2_ACCURACY) stars = 2;
    if (accuracy >= STAR3_ACCURACY) stars = 3;
  }
  return { xp, stars };
}

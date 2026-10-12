const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Pull score toward moving cells and quiet the static plate. Strength 0 leaves the score alone. */
export function motionWeightedScore(score: number, motion: number, motionDensity: number) {
  const strength = clamp01(motionDensity / 100);
  const safeScore = clamp01(score);
  const safeMotion = clamp01(motion);
  if (strength === 0) return safeScore;
  const boosted = safeScore * (1 - strength * 0.5) + safeMotion * strength;
  const quietPenalty = (1 - safeMotion) * strength * 0.35 * safeScore;
  return clamp01(boosted - quietPenalty);
}

export function motionThreshold(base: number, motion: number, motionDensity: number) {
  const strength = clamp01(motionDensity / 100);
  const safeMotion = clamp01(motion);
  return base + (1 - safeMotion) * strength * 0.2 - safeMotion * strength * 0.08;
}

/** How likely a feature is kept once motion density is applied. */
export function motionKeepChance(densityChance: number, motion: number, motionDensity: number) {
  const strength = clamp01(motionDensity / 100);
  const safeMotion = clamp01(motion);
  const scaled = densityChance * (1 - strength * 0.75 + safeMotion * strength * 1.35);
  return Math.max(0, Math.min(1, scaled));
}

// Scoring (spec.md section 10): points per enemy destroyed plus a
// time-survived component, so the score reflects both combat and endurance.
export const SURVIVAL_POINTS_PER_SEC = 2

export function survivalPoints(elapsed: number): number {
  return elapsed * SURVIVAL_POINTS_PER_SEC
}

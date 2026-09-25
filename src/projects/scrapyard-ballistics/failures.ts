// Imperfect hardware (SPEC.md section 6). A seeded hazard per burning
// second rolls one of four failures; the dashboard's BYPASS clears any of
// them after a half-power spool. Heat is its own gauge -- a "running hot"
// failure only makes it climb faster.
import type { Rng } from './rng'
import type { EngineStats } from './parts'

export type FailureKind = 'stuck' | 'hot' | 'uneven' | 'leak'

export const FAILURE_LABEL: Record<FailureKind, string> = {
  stuck: 'valve stuck',
  hot: 'running hot',
  uneven: 'uneven burn',
  leak: 'fuel leak',
}

export const BYPASS_TIME = 2 // s at half power while the bypass spools

export function rollFailure(rng: Rng, engine: EngineStats, throttle: number, heat: number, dt: number): FailureKind | null {
  const p = engine.failureRate * throttle * dt * (1 + 2 * heat)
  if (rng.next() >= p) return null
  const options: [FailureKind, number][] = [
    ['hot', 0.3],
    ['uneven', 0.3],
  ]
  if (engine.throttleable) options.push(['stuck', 0.25])
  if (!engine.internalFuel) options.push(['leak', 0.15])
  const total = options.reduce((s, [, w]) => s + w, 0)
  let roll = rng.next() * total
  for (const [kind, w] of options) {
    roll -= w
    if (roll <= 0) return kind
  }
  return options[0][0]
}

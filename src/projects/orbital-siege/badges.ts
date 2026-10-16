// Efficiency badges (SPEC.md section 10). Measured against the level's base
// platform so upgrades can't make them easier to earn.
import type { SimResult } from './sim'
import type { Level } from './types'
import { basePlatform } from './upgrades'

export type BadgeId = 'minimalist' | 'hyper' | 'surgical'

export const BADGE_INFO: Record<BadgeId, { name: string; icon: string }> = {
  minimalist: { name: 'Minimalist', icon: '🔋' },
  hyper: { name: 'Hyper-Velocity', icon: '⏱️' },
  surgical: { name: 'Surgical', icon: '🩺' },
}

export function minimalistCap(level: Level) {
  return level.minimalist ?? Math.floor(basePlatform(level).energy * 0.6)
}

// Surgical only exists where there's something to be careful around.
export function badgesFor(level: Level): BadgeId[] {
  const out: BadgeId[] = ['minimalist', 'hyper']
  if (level.structures.some((s) => s.kind === 'site')) out.push('surgical')
  return out
}

export function badgeGoal(level: Level, b: BadgeId) {
  if (b === 'minimalist') return `Use ${minimalistCap(level)} MW or less`
  if (b === 'hyper') return `Win by tick ${level.parTick}`
  return 'Leave every protected site untouched'
}

export function earnedBadges(level: Level, r: SimResult): BadgeId[] {
  if (r.outcome !== 'win') return []
  return badgesFor(level).filter((b) => {
    if (b === 'minimalist') return r.energy <= minimalistCap(level)
    if (b === 'hyper') return r.winTick! <= level.parTick
    return r.collateral === 0
  })
}

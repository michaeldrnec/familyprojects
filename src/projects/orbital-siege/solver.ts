// Brute-force search over small plans. The daily generator uses it as the
// too-easy filter (no plan of two or fewer actions may win), and the DEV
// selfcheck uses it to report each level's cheapest short solution.
import { validTargets, weaponsFor } from './defenses'
import { simulate } from './sim'
import type { Action, Level, Plan, Platform } from './types'
import { WEAPONS } from './weapons'

// Every single action worth trying: anything that would land on time.
export function candidateActions(level: Level): Action[] {
  const out: Action[] = []
  for (const w of weaponsFor(level)) {
    const d = WEAPONS[w]
    for (let tick = 1; tick + d.charge + d.transit <= level.ticks; tick++) {
      for (const target of validTargets(level, w)) out.push({ w, tick, target })
    }
  }
  return out
}

// Calls visit() for every multiset of up to maxActions candidates that fits
// the energy budget. visit returns true to stop the search.
export function enumeratePlans(
  level: Level,
  platform: Platform,
  maxActions: number,
  visit: (plan: Plan) => boolean,
) {
  const cands = candidateActions(level)
  const plan: Plan = []
  const rec = (start: number, energy: number): boolean => {
    if (plan.length && visit(plan.slice())) return true
    if (plan.length >= maxActions) return false
    for (let i = start; i < cands.length; i++) {
      const e = energy + WEAPONS[cands[i].w].energy
      if (e > platform.energy) continue
      plan.push(cands[i])
      const stop = rec(i, e)
      plan.pop()
      if (stop) return true
    }
    return false
  }
  rec(0, 0)
}

export function findWin(level: Level, platform: Platform, maxActions: number): Plan | null {
  let found: Plan | null = null
  enumeratePlans(level, platform, maxActions, (plan) => {
    if (simulate(level, plan, platform, true).outcome === 'win') {
      found = plan
      return true
    }
    return false
  })
  return found
}

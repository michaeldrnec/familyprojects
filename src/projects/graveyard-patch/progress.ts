// The week so far, saved through the site's shared storage helper (per
// player profile, versioned, never throws): which nights are open, the best
// stars on each, the Overtime Pay in the wallet and the upgrades bought.
import { createStore } from '../../shared/storage'
import { NIGHTS, UPGRADES, type UpgradeId } from './sim/config'
import type { NightResult } from './sim/night'

export interface Progress {
  unlocked: number // nights 0..unlocked are playable
  bestStars: number[]
  pay: number
  owned: UpgradeId[]
}

function fresh(): Progress {
  return { unlocked: 0, bestStars: NIGHTS.map(() => 0), pay: 0, owned: [] }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const UPGRADE_IDS = new Set<string>(UPGRADES.map((u) => u.id))

const store = createStore<Progress>({
  key: 'graveyard-patch:progress',
  version: 1,
  defaults: fresh,
  parse: (p) => ({
    unlocked: Math.min(NIGHTS.length - 1, Math.max(0, Math.floor(num(p.unlocked)))),
    bestStars: NIGHTS.map((_, i) => num(Array.isArray(p.bestStars) ? p.bestStars[i] : 0)),
    pay: Math.max(0, num(p.pay)),
    owned: Array.isArray(p.owned) ? p.owned.filter((id: unknown): id is UpgradeId => typeof id === 'string' && UPGRADE_IDS.has(id)) : [],
  }),
  summary: {
    slug: 'graveyard-patch',
    describe(p) {
      const shipped = p.bestStars.filter((s) => s > 0).length
      if (shipped === 0 && p.owned.length === 0) return null
      const nights = shipped === NIGHTS.length ? 'Whole week shipped' : `Night ${shipped}/${NIGHTS.length}`
      return p.owned.length ? `${nights} · ${p.owned.length} upgrade${p.owned.length === 1 ? '' : 's'}` : nights
    },
  },
})

export const loadProgress = store.load

export function recordNight(p: Progress, night: number, result: NightResult): Progress {
  const survived = result.outcome === 'survived'
  const next: Progress = {
    ...p,
    unlocked: survived ? Math.max(p.unlocked, Math.min(NIGHTS.length - 1, night + 1)) : p.unlocked,
    bestStars: p.bestStars.map((s, i) => (i === night ? Math.max(s, result.stars) : s)),
    pay: p.pay + result.pay,
  }
  store.save(next)
  return next
}

export function buyUpgrade(p: Progress, id: UpgradeId): Progress {
  const upgrade = UPGRADES.find((u) => u.id === id)
  if (!upgrade || p.owned.includes(id) || p.pay < upgrade.cost) return p
  const next = { ...p, pay: p.pay - upgrade.cost, owned: [...p.owned, id] }
  store.save(next)
  return next
}

// The Refit Bay: a few small, salvage-bought boosts on top of each level's
// base platform. Levels are all tuned (and badge-checked) at base stats.
import { BASE_COOL, BASE_ENERGY, BASE_HEAT } from './defenses'
import type { Level, Platform } from './types'

export type UpgradeId = 'capacitor' | 'heatsink' | 'cooling' | 'targeting'

export interface UpgradeDef {
  id: UpgradeId
  name: string
  icon: string
  blurb: string
  cost: number
  max: number
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'capacitor', name: 'Capacitor Bank', icon: '🔋', blurb: '+10 MW energy every mission.', cost: 5, max: 2 },
  { id: 'heatsink', name: 'Heat Sink', icon: '🧊', blurb: '+1 heat cap.', cost: 5, max: 2 },
  { id: 'cooling', name: 'Cooling Loop', icon: '❄️', blurb: '+1 cooling per tick.', cost: 8, max: 1 },
  {
    id: 'targeting',
    name: 'Targeting Computer',
    icon: '🎯',
    blurb: 'The sequencer marks which of your shots a PDC will shoot down.',
    cost: 6,
    max: 1,
  },
]

export type Owned = Partial<Record<UpgradeId, number>>

export function basePlatform(level: Level): Platform {
  return {
    energy: level.energy ?? BASE_ENERGY,
    heatCap: level.heatCap ?? BASE_HEAT,
    cool: level.cool ?? BASE_COOL,
    targeting: false,
  }
}

export function platformFor(level: Level, owned: Owned): Platform {
  const base = basePlatform(level)
  return {
    energy: base.energy + 10 * (owned.capacitor ?? 0),
    heatCap: base.heatCap + (owned.heatsink ?? 0),
    cool: base.cool + (owned.cooling ?? 0),
    targeting: (owned.targeting ?? 0) > 0,
  }
}

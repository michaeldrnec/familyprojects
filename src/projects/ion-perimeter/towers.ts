// Tower type definitions -- see SPEC.md section 4. Each tower has 3 stat
// tiers (upgraded with credits) and a single tier-3 specialization choice
// between two branches, rather than a deeper tree -- enough to make the
// "upgrade vs. build new" decision matter without ballooning scope.

export type TowerId = 'cannon' | 'laser' | 'flak' | 'disruptor' | 'railgun'
export type BranchId = 'a' | 'b'
export type FireMode = 'projectile' | 'beam' | 'chain'

export interface TowerTierStats {
  damage: number
  range: number
  fireInterval: number // seconds between shots
  projectileSpeed: number // px/sec; only meaningful for fireMode 'projectile'
  splashRadius: number // 0 = no splash
  pierce: number // beam mode: how many enemies one shot can hit
  slowFactor: number // chain mode: speed multiplier applied to enemies in range
  chainCount: number // chain mode: how many enemies one tick can jump to
}

export interface TowerBranch {
  id: BranchId
  name: string
  description: string
  unlockWave?: number // min best-wave-reached (any past run) required; undefined = always available
  apply(stats: TowerTierStats): TowerTierStats
}

export interface TowerDef {
  id: TowerId
  name: string
  description: string
  cost: number
  color: string
  fireMode: FireMode
  ignoresArmor: boolean
  unlockWave?: number // min best-wave-reached required to build this tower at all
  tiers: [TowerTierStats, TowerTierStats, TowerTierStats]
  upgradeCost: [number, number] // cost to go tier0->1, tier1->2
  branches: [TowerBranch, TowerBranch]
}

const mul = (stats: TowerTierStats, patch: Partial<TowerTierStats>): TowerTierStats => ({ ...stats, ...patch })

export const TOWER_DEFS: Record<TowerId, TowerDef> = {
  cannon: {
    id: 'cannon',
    name: 'Pulse Cannon',
    description: 'Cheap, rapid single-target kinetic fire. The cost-efficient early workhorse.',
    cost: 40,
    color: '#67e8f9',
    fireMode: 'projectile',
    ignoresArmor: false,
    tiers: [
      { damage: 8, range: 130, fireInterval: 0.45, projectileSpeed: 420, splashRadius: 0, pierce: 1, slowFactor: 1, chainCount: 0 },
      { damage: 14, range: 145, fireInterval: 0.38, projectileSpeed: 440, splashRadius: 0, pierce: 1, slowFactor: 1, chainCount: 0 },
      { damage: 22, range: 160, fireInterval: 0.32, projectileSpeed: 460, splashRadius: 0, pierce: 1, slowFactor: 1, chainCount: 0 },
    ],
    upgradeCost: [35, 60],
    branches: [
      {
        id: 'a',
        name: 'Twin Barrel',
        description: 'Much higher fire rate.',
        apply: (s) => mul(s, { fireInterval: s.fireInterval * 0.6 }),
      },
      {
        id: 'b',
        name: 'Overcharged Round',
        description: 'Bigger hits with a small splash.',
        apply: (s) => mul(s, { damage: s.damage * 1.8, splashRadius: 18 }),
      },
    ],
  },
  laser: {
    id: 'laser',
    name: 'Laser Lance',
    description: 'Instant-hit beam that pierces every enemy in a line. Strong vs. groups.',
    cost: 70,
    color: '#f472b6',
    fireMode: 'beam',
    ignoresArmor: false,
    tiers: [
      { damage: 5, range: 150, fireInterval: 0.6, projectileSpeed: 0, splashRadius: 0, pierce: 3, slowFactor: 1, chainCount: 0 },
      { damage: 8, range: 165, fireInterval: 0.55, projectileSpeed: 0, splashRadius: 0, pierce: 4, slowFactor: 1, chainCount: 0 },
      { damage: 12, range: 180, fireInterval: 0.5, projectileSpeed: 0, splashRadius: 0, pierce: 6, slowFactor: 1, chainCount: 0 },
    ],
    upgradeCost: [55, 90],
    branches: [
      {
        id: 'a',
        name: 'Phase Beam',
        description: 'Pierces without limit and briefly slows everything it hits.',
        apply: (s) => mul(s, { pierce: 99, slowFactor: 0.7 }),
      },
      {
        id: 'b',
        name: 'Focus Array',
        description: 'Narrows to a single target for much higher damage.',
        apply: (s) => mul(s, { pierce: 1, damage: s.damage * 2.5 }),
      },
    ],
  },
  flak: {
    id: 'flak',
    name: 'Flak Battery',
    description: 'Arcing shells that splash on impact. Best against clustered swarms.',
    cost: 55,
    color: '#fb923c',
    fireMode: 'projectile',
    ignoresArmor: false,
    tiers: [
      { damage: 10, range: 120, fireInterval: 0.9, projectileSpeed: 300, splashRadius: 40, pierce: 1, slowFactor: 1, chainCount: 0 },
      { damage: 16, range: 130, fireInterval: 0.8, projectileSpeed: 320, splashRadius: 46, pierce: 1, slowFactor: 1, chainCount: 0 },
      { damage: 24, range: 140, fireInterval: 0.7, projectileSpeed: 340, splashRadius: 52, pierce: 1, slowFactor: 1, chainCount: 0 },
    ],
    upgradeCost: [45, 75],
    branches: [
      {
        id: 'a',
        name: 'Cluster Charge',
        description: 'Much wider blast radius.',
        apply: (s) => mul(s, { splashRadius: s.splashRadius * 1.5 }),
      },
      {
        id: 'b',
        name: 'Proximity Fuze',
        description: 'Faster reload, tighter blast.',
        apply: (s) => mul(s, { fireInterval: s.fireInterval * 0.65, splashRadius: s.splashRadius * 0.8 }),
      },
    ],
  },
  disruptor: {
    id: 'disruptor',
    name: 'Ion Disruptor',
    description: 'Slows everything in range and arcs chain damage between nearby targets.',
    cost: 65,
    color: '#22d3ee',
    fireMode: 'chain',
    ignoresArmor: true,
    tiers: [
      { damage: 3, range: 110, fireInterval: 1.0, projectileSpeed: 0, splashRadius: 0, pierce: 0, slowFactor: 0.75, chainCount: 2 },
      { damage: 5, range: 120, fireInterval: 0.9, projectileSpeed: 0, splashRadius: 0, pierce: 0, slowFactor: 0.65, chainCount: 3 },
      { damage: 8, range: 130, fireInterval: 0.8, projectileSpeed: 0, splashRadius: 0, pierce: 0, slowFactor: 0.55, chainCount: 4 },
    ],
    upgradeCost: [50, 85],
    branches: [
      {
        id: 'a',
        name: 'Deep Freeze',
        description: 'A much stronger slow.',
        apply: (s) => mul(s, { slowFactor: Math.max(0.25, s.slowFactor - 0.15) }),
      },
      {
        id: 'b',
        name: 'Chain Reactor',
        description: 'The chain jumps to far more targets.',
        unlockWave: 14,
        apply: (s) => mul(s, { chainCount: s.chainCount + 3 }),
      },
    ],
  },
  railgun: {
    id: 'railgun',
    name: 'Railgun',
    description: 'Long range, devastating single-target damage, ignores armor. Slow to reload.',
    cost: 110,
    color: '#facc15',
    fireMode: 'beam',
    ignoresArmor: true,
    unlockWave: 8,
    tiers: [
      { damage: 55, range: 220, fireInterval: 1.6, projectileSpeed: 0, splashRadius: 0, pierce: 1, slowFactor: 1, chainCount: 0 },
      { damage: 80, range: 235, fireInterval: 1.4, projectileSpeed: 0, splashRadius: 0, pierce: 1, slowFactor: 1, chainCount: 0 },
      { damage: 115, range: 250, fireInterval: 1.2, projectileSpeed: 0, splashRadius: 0, pierce: 1, slowFactor: 1, chainCount: 0 },
    ],
    upgradeCost: [90, 140],
    branches: [
      {
        id: 'a',
        name: 'Penetrator Slug',
        description: 'The shot punches through to a second target.',
        apply: (s) => mul(s, { pierce: 2 }),
      },
      {
        id: 'b',
        name: 'Siege Coil',
        description: 'Massive bonus damage against bosses specifically.',
        apply: (s) => mul(s, { damage: s.damage * 1.0 }), // boss bonus applied at hit-time (see IonPerimeter.tsx)
      },
    ],
  },
}

export const TOWER_ORDER: TowerId[] = ['cannon', 'laser', 'flak', 'disruptor', 'railgun']

// Multiplier applied to Siege Coil-branch Railgun hits against boss-flagged
// enemies -- kept as a constant here (rather than baked into apply()) since
// it needs the target's boss flag at hit time, not just the tower's stats.
export const SIEGE_COIL_BOSS_MULTIPLIER = 1.9

export interface TowerInstance {
  id: number
  defId: TowerId
  padId: string
  x: number
  y: number
  tier: number // 0, 1, or 2 (tier 2 = max stat tier, "tier 3" in player-facing text)
  branch: BranchId | null
  cooldown: number
  totalSpent: number // cost + every upgrade paid so far, for sell refund
  angle: number // current aim angle, radians, for rendering the barrel
  fxTimer: number // seconds remaining on a beam/chain firing visual
  fxTargetX: number
  fxTargetY: number
}

// Effective stats for a tower right now: its current tier's base stats,
// with the chosen branch's modifier applied on top once tier 3 is reached.
export function towerStats(tower: TowerInstance): TowerTierStats {
  const def = TOWER_DEFS[tower.defId]
  const base = def.tiers[tower.tier]
  if (tower.tier === 2 && tower.branch) {
    const branch = def.branches.find((b) => b.id === tower.branch)!
    return branch.apply(base)
  }
  return base
}

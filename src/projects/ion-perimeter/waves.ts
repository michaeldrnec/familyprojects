// The 20-wave campaign, hand-authored rather than procedurally generated --
// see SPEC.md section 6. With a finite, fixed wave count the whole curve is
// tunable by hand; enemies.ts applies a mild per-wave HP multiplier so this
// table only needs to describe *composition*, not restate every stat.
import type { EnemyId } from './enemies'

export interface WaveSpawnEntry {
  defId: EnemyId
  count: number
  interval: number // seconds between each spawn in this entry
  delay: number // seconds after wave start before this entry's first spawn
}

export interface WaveDef {
  index: number // 1-based
  spawns: WaveSpawnEntry[]
  boss?: EnemyId
  bossDelay: number // seconds after the last regular spawn before the boss launches
}

function spawn(defId: EnemyId, count: number, interval: number, delay: number): WaveSpawnEntry {
  return { defId, count, interval, delay }
}

// A wave's entries can overlap in time (different `delay`s), which is how
// e.g. wave 9 mixes three enemy types arriving in a braided order rather
// than strictly back to back.
function wave(index: number, spawns: WaveSpawnEntry[], boss?: EnemyId, bossDelay = 3.5): WaveDef {
  return { index, spawns, boss, bossDelay }
}

export const WAVES: WaveDef[] = [
  wave(1, [spawn('scout', 6, 0.8, 0)]),
  wave(2, [spawn('scout', 8, 0.7, 0), spawn('cruiser', 2, 1.2, 2)]),
  wave(3, [spawn('cruiser', 6, 0.9, 0), spawn('scout', 4, 0.6, 1)]),
  wave(4, [spawn('swarmling', 10, 0.25, 0), spawn('cruiser', 3, 1.0, 3)]),
  wave(5, [spawn('hulk', 2, 1.6, 0), spawn('cruiser', 4, 0.9, 1), spawn('scout', 4, 0.5, 4)]),
  wave(6, [spawn('skiff', 4, 1.1, 0), spawn('cruiser', 4, 0.8, 1.5)]),
  wave(7, [spawn('swarmling', 14, 0.22, 0), spawn('hulk', 2, 1.5, 2)]),
  wave(8, [spawn('phantom', 4, 1.0, 0), spawn('cruiser', 6, 0.7, 1)]),
  wave(9, [spawn('hulk', 3, 1.4, 0), spawn('skiff', 3, 1.1, 1), spawn('scout', 6, 0.5, 2)]),
  wave(
    10,
    [spawn('cruiser', 4, 0.8, 0)],
    'dreadnought',
    4,
  ),
  wave(11, [spawn('phantom', 6, 0.8, 0), spawn('swarmling', 12, 0.22, 1)]),
  wave(12, [spawn('hulk', 4, 1.2, 0), spawn('skiff', 4, 1.0, 1), spawn('cruiser', 4, 0.8, 2)]),
  wave(13, [spawn('hulk', 5, 1.1, 0), spawn('phantom', 4, 0.9, 1.5), spawn('scout', 8, 0.4, 3)]),
  wave(14, [spawn('skiff', 6, 0.9, 0), spawn('swarmling', 16, 0.2, 1), spawn('cruiser', 4, 0.7, 2)]),
  wave(15, [spawn('hulk', 6, 1.0, 0), spawn('phantom', 6, 0.8, 1), spawn('cruiser', 6, 0.7, 2.5)]),
  wave(16, [
    spawn('hulk', 4, 1.1, 0),
    spawn('skiff', 4, 1.0, 1),
    spawn('phantom', 4, 0.9, 2),
    spawn('swarmling', 12, 0.2, 3),
  ]),
  wave(17, [spawn('swarmling', 20, 0.18, 0), spawn('hulk', 4, 1.0, 1), spawn('skiff', 4, 0.9, 2)]),
  wave(18, [spawn('phantom', 8, 0.7, 0), spawn('hulk', 6, 0.9, 1), spawn('cruiser', 8, 0.6, 2)]),
  wave(19, [
    spawn('hulk', 6, 0.9, 0),
    spawn('skiff', 6, 0.85, 1),
    spawn('phantom', 6, 0.8, 2),
    spawn('cruiser', 8, 0.6, 3),
  ]),
  wave(
    20,
    [spawn('cruiser', 6, 0.7, 0), spawn('hulk', 2, 1.4, 2)],
    'harbinger',
    5,
  ),
]

export const TOTAL_WAVES = WAVES.length

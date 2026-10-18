// The Conductor: the boss that replaces the formation every BOSS_EVERY
// waves. It sways across the top of the screen and attacks on the beat.
//
// Phases:
//   shielded  -- two side pods power a shield over the core. Only the pods
//                can be hurt; they take turns firing aimed bolts.
//   exposed   -- both pods down, the shield breaks. The core takes full
//                damage (the hull plating only a quarter, Needle aside) and
//                fires aimed bolts plus fan volleys.
//   overdrive -- core below 40%: it sways faster, fans widen, and it calls
//                orbital markers down on the cannon.
// The tempo reads the boss's remaining HP as an invader count, so the music
// and the attacks speed up as it breaks apart (capped near 165 BPM).
import {
  BOSS_AIM_EVERY,
  BOSS_AIM_LIMIT,
  BOSS_CORE_HP,
  BOSS_CORE_HP_PER,
  BOSS_ENTRY_Y,
  BOSS_EVERY,
  BOSS_FAN_EVERY,
  BOSS_FAN_SPREAD,
  BOSS_HALF_H,
  BOSS_MARKER_EVERY,
  BOSS_POD_DX,
  BOSS_POD_DY,
  BOSS_POD_EVERY,
  BOSS_POD_HP,
  BOSS_POD_HP_PER,
  BOSS_SWAY,
  BOSS_SWAY_RATE,
  BOSS_TEMPO_FLOOR,
  BOSS_Y,
  N0,
  PLAYER_Y,
  VIEW_W,
  WAVE_INTRO_TIME,
} from './constants'

export type BossPhase = 'shielded' | 'exposed' | 'overdrive'

export interface BossPod {
  side: -1 | 1
  hp: number
  maxHp: number
  flash: number
}

export interface Boss {
  level: number // 1 for the first boss (wave 5), 2 for wave 10, ...
  x: number
  y: number
  sway: number // accumulated sway angle, so changing speed never jumps
  coreHp: number
  coreMaxHp: number
  coreFlash: number
  pods: BossPod[]
  phase: BossPhase
  beats: number // beats since the fight began
  dying: number // > 0 while the death explosions play out
}

export interface BossVolley {
  bolts: { x: number; y: number; angle: number }[]
  markers: number[] // x positions for orbital markers
}

export const BOSS_DEATH_TIME = 1.6

export function isBossWave(wave: number): boolean {
  return wave > 0 && wave % BOSS_EVERY === 0
}

export function newBoss(wave: number): Boss {
  const level = Math.max(1, Math.floor(wave / BOSS_EVERY))
  const podHp = BOSS_POD_HP + BOSS_POD_HP_PER * (level - 1)
  const coreHp = BOSS_CORE_HP + BOSS_CORE_HP_PER * (level - 1)
  return {
    level,
    x: VIEW_W / 2,
    y: BOSS_ENTRY_Y,
    sway: 0,
    coreHp,
    coreMaxHp: coreHp,
    coreFlash: 0,
    pods: [-1, 1].map((side) => ({ side: side as -1 | 1, hp: podHp, maxHp: podHp, flash: 0 })),
    phase: 'shielded',
    beats: 0,
    dying: 0,
  }
}

export function podX(boss: Boss, pod: BossPod): number {
  return boss.x + pod.side * BOSS_POD_DX
}

export function podY(boss: Boss): number {
  return boss.y + BOSS_POD_DY
}

export function livingPods(boss: Boss): BossPod[] {
  return boss.pods.filter((p) => p.hp > 0)
}

// Remaining HP across the core and pods, 0..1.
export function bossHealth(boss: Boss): number {
  let hp = Math.max(0, boss.coreHp)
  let max = boss.coreMaxHp
  for (const p of boss.pods) {
    hp += Math.max(0, p.hp)
    max += p.maxHp
  }
  return hp / max
}

// The boss stands in for this many invaders on the beat clock and in the
// music's tiers: full health plays like a full formation (60 BPM), and the
// tempo climbs as it breaks apart, stopping short of the last-invader frenzy.
export function bossTempoN(boss: Boss): number {
  return Math.max(BOSS_TEMPO_FLOOR, Math.round(N0 * bossHealth(boss)))
}

// Still flying in from the top of the screen.
export function bossEntering(boss: Boss): boolean {
  return boss.y < BOSS_Y
}

export function bossFighting(boss: Boss): boolean {
  return !bossEntering(boss) && boss.dying <= 0
}

export function updateBoss(boss: Boss, dt: number) {
  boss.coreFlash = Math.max(0, boss.coreFlash - dt)
  for (const p of boss.pods) p.flash = Math.max(0, p.flash - dt)
  if (boss.dying > 0) {
    boss.dying = Math.max(0, boss.dying - dt)
    return
  }
  if (bossEntering(boss)) {
    // Descends over the "WAVE n" banner.
    boss.y = Math.min(BOSS_Y, boss.y + ((BOSS_Y - BOSS_ENTRY_Y) / WAVE_INTRO_TIME) * dt)
    return
  }
  const rate = BOSS_SWAY_RATE[boss.phase === 'shielded' ? 0 : boss.phase === 'exposed' ? 1 : 2]
  boss.sway += rate * dt
  boss.x = VIEW_W / 2 + BOSS_SWAY * Math.sin(boss.sway)
}

function aimAt(x: number, y: number, targetX: number): number {
  const a = Math.atan2(targetX - x, PLAYER_Y - y)
  return Math.max(-BOSS_AIM_LIMIT, Math.min(BOSS_AIM_LIMIT, a))
}

function fan(x: number, y: number, count: number): BossVolley['bolts'] {
  const out: BossVolley['bolts'] = []
  for (let i = 0; i < count; i++) out.push({ x, y, angle: -BOSS_FAN_SPREAD + (2 * BOSS_FAN_SPREAD * i) / (count - 1) })
  return out
}

// One beat of the fight: what the boss fires this beat. Pure, so the attack
// pattern can be tested without the rest of the game.
export function bossBeat(boss: Boss, playerX: number): BossVolley {
  const volley: BossVolley = { bolts: [], markers: [] }
  if (!bossFighting(boss)) return volley
  boss.beats++
  const b = boss.beats
  const coreY = boss.y + BOSS_HALF_H
  // From the second boss on, the fans are wider.
  const fanSize = boss.level > 1 ? 7 : 5

  if (boss.phase === 'shielded') {
    const pods = livingPods(boss)
    if (pods.length > 0 && b % BOSS_POD_EVERY === 0) {
      const pod = pods[(b / BOSS_POD_EVERY) % pods.length]
      const x = podX(boss, pod)
      const y = podY(boss) + 30
      volley.bolts.push({ x, y, angle: aimAt(x, y, playerX) })
    }
    if (b % (BOSS_FAN_EVERY * 2) === 0) volley.bolts.push(...fan(boss.x, coreY, 3))
    return volley
  }

  if (b % BOSS_AIM_EVERY === 0) volley.bolts.push({ x: boss.x, y: coreY, angle: aimAt(boss.x, coreY, playerX) })
  if (b % BOSS_FAN_EVERY === 0) volley.bolts.push(...fan(boss.x, coreY, boss.phase === 'overdrive' ? fanSize + 2 : fanSize))
  if (boss.phase === 'overdrive' && b % BOSS_MARKER_EVERY === 0) volley.markers.push(playerX)
  return volley
}

import { describe, expect, it } from 'vitest'
import { BOSS_Y, CELL_HP, PLAYER_CELL_DAMAGE, PLAYER_Y } from './constants'
import { bossBeat, isBossWave, newBoss, podX } from './boss'
import { newGame, startWave, stepGame, type GameState } from './game'
import { livingCount } from './grid'
import type { FrameInput } from './input'

const STEP = 1 / 120

function idle(over: Partial<FrameInput> = {}): FrameInput {
  return { move: 0, fire: false, dash: false, vent: false, cycle: 0, select: null, pause: false, ...over }
}

// A game at the start of wave `wave`, with the intro banner already over.
function gameAtWave(wave: number): GameState {
  const gs = newGame(42)
  while (gs.wave < wave) startWave(gs)
  gs.waveIntro = 0
  if (gs.boss) gs.boss.y = BOSS_Y
  return gs
}

function shotAt(gs: GameState, x: number, y: number) {
  gs.shots.push({ id: gs.ids++, weapon: 'disruptor', x, y, vx: 0, vy: -1400, damage: 20, pierceLeft: 1, hitIds: [], perfect: false, age: 0 })
}

describe('Invader Protocol: player shots vs. bunkers', () => {
  it('stops a shot at the first bunker cell and chips it without charging the bunker', () => {
    const gs = gameAtWave(1)
    const b = gs.bunkers[1]
    const before = gs.grid.invaders.reduce((sum, inv) => sum + inv.hp, 0)
    shotAt(gs, b.x, PLAYER_Y - 30)
    for (let i = 0; i < 30; i++) stepGame(gs, idle(), STEP)
    expect(gs.shots).toHaveLength(0)
    const hurt = b.cells.filter((c) => c.hp < CELL_HP)
    expect(hurt).toHaveLength(1)
    expect(hurt[0].hp).toBe(CELL_HP - PLAYER_CELL_DAMAGE)
    expect(b.energy).toBe(0)
    expect(gs.grid.invaders.reduce((sum, inv) => sum + inv.hp, 0)).toBe(before)
  })

  it('lets shots through the gaps between bunkers', () => {
    const gs = gameAtWave(1)
    const gap = (gs.bunkers[0].x + gs.bunkers[1].x) / 2
    shotAt(gs, gap, PLAYER_Y - 30)
    stepGame(gs, idle(), STEP * 10)
    expect(gs.shots).toHaveLength(1)
    expect(gs.bunkers.every((b) => b.cells.every((c) => c.hp === CELL_HP))).toBe(true)
  })
})

describe('Invader Protocol: The Conductor', () => {
  it('arrives every fifth wave', () => {
    expect([1, 2, 3, 4, 5, 6, 9, 10, 15].filter(isBossWave)).toEqual([5, 10, 15])
    expect(gameAtWave(4).boss).toBeNull()
    const gs = gameAtWave(5)
    expect(gs.boss).not.toBeNull()
    expect(livingCount(gs.grid)).toBe(0)
    expect(gameAtWave(10).boss!.coreMaxHp).toBeGreaterThan(gs.boss!.coreMaxHp)
  })

  it('only fires from its pods while shielded, then adds fans and markers', () => {
    const boss = newBoss(5)
    boss.y = BOSS_Y
    const shielded = Array.from({ length: 8 }, () => bossBeat(boss, 960))
    const podXs = boss.pods.map((p) => podX(boss, p))
    const aimed = shielded.flatMap((v) => v.bolts).filter((b) => b.angle !== 0 || podXs.includes(b.x))
    expect(aimed.length).toBeGreaterThan(0)
    expect(shielded.every((v) => v.markers.length === 0)).toBe(true)

    for (const p of boss.pods) p.hp = 0
    boss.phase = 'overdrive'
    const late = Array.from({ length: 8 }, () => bossBeat(boss, 960))
    expect(late.some((v) => v.bolts.length >= 7)).toBe(true)
    expect(late.some((v) => v.markers.length > 0)).toBe(true)
  })

  it('is immune behind its shield until both pods fall, then breaks and clears the wave', () => {
    const gs = gameAtWave(5)
    const boss = gs.boss!
    gs.bunkers = [] // keep the line of fire clear for this test
    const fireAt = (x: number) => {
      shotAt(gs, x, PLAYER_Y - 30)
      for (let i = 0; i < 90 && gs.shots.length > 0; i++) {
        boss.sway = 0 // hold the boss still
        gs.player.invuln = 1 // and keep the cannon alive through its fire
        stepGame(gs, idle(), STEP)
      }
    }

    fireAt(boss.x)
    expect(boss.coreHp).toBe(boss.coreMaxHp)

    for (const pod of boss.pods) for (let i = 0; i < 100 && pod.hp > 0; i++) fireAt(podX(boss, pod))
    expect(boss.phase).toBe('exposed')

    fireAt(boss.x)
    expect(boss.coreHp).toBeLessThan(boss.coreMaxHp)

    boss.coreHp = 10
    fireAt(boss.x)
    expect(boss.dying).toBeGreaterThan(0)
    for (let i = 0; i < 120 * 5 && gs.wave === 5; i++) {
      gs.player.invuln = 1
      stepGame(gs, idle(), STEP)
    }
    expect(gs.boss).toBeNull()
    expect(gs.wave).toBe(6)
    expect(livingCount(gs.grid)).toBeGreaterThan(0)
  })

  it('can be beaten by a simple bot in a reasonable time', () => {
    const gs = gameAtWave(5)
    gs.player.lives = 99
    let t = 0
    let lastX = gs.boss!.x
    while (gs.boss && t < 240) {
      const boss = gs.boss
      const pods = boss.pods.filter((p) => p.hp > 0)
      // Lead the target by the shot's flight time, as a player would.
      const vx = (boss.x - lastX) / STEP
      lastX = boss.x
      const flight = (PLAYER_Y - boss.y) / 1400
      const target = (pods.length > 0 ? podX(boss, pods[0]) : boss.x) + vx * flight
      const dx = target - gs.player.x
      stepGame(gs, idle({ move: Math.abs(dx) < 12 ? 0 : Math.sign(dx), fire: true }), STEP)
      t += STEP
    }
    expect(gs.over).toBeNull()
    expect(gs.boss).toBeNull()
    expect(t).toBeGreaterThan(20) // a real fight, not a pushover
  })
})

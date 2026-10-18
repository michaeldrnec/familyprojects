// The whole simulation: GameState, wave setup, and one fixed-size update
// step in the order the plan lays out (input -> player -> beat -> grid/boss ->
// enemy fire -> weapons -> projectiles -> bunkers/beams -> UFO -> deaths ->
// wave/game-over -> effects). Every BOSS_EVERY-th wave is a boss wave: an
// empty formation and The Conductor (boss.ts). The React component only drives the clock
// and draws.
import {
  BOSS_HALF_H,
  BOSS_HALF_W,
  INVADER_HALF_H,
  INVADER_HALF_W,
  INVADER_POINTS,
  FAIL_Y,
  MARKER_HALF_W,
  PERFECT_SCORE_MULT,
  PLAYER_HALF_W,
  PLAYER_Y,
  ROW_SPACING,
  VIEW_W,
  WAVE_DROP,
  WAVE_DROP_MAX,
  WAVE_FIRE_SCALE,
  WAVE_INTRO_TIME,
  BONUS_LIFE_EVERY,
  WEAPONS,
} from './constants'
import { isPerfectBeat, newBeatClock, stepFrequency, tickBeat, type BeatClock } from './beat'
import {
  checkColumnSnaps,
  columnX,
  emptyGrid,
  invaderX,
  invaderY,
  livingCount,
  lowestBottom,
  marchStep,
  newGrid,
  triggerFrenzy,
  updateEnemyFire,
  updateGrid,
  type Grid,
  type Invader,
} from './grid'
import { isAlive, isVulnerable, newPlayer, updatePlayer, type Player } from './player'
import { canFire, cycleWeapon, fire, newWeaponState, selectWeapon, updateHeat, type PlayerShot, type WeaponState } from './weapons'
import { canVent, eraseRect, newBunkers, updateBunkers, vent, BUNKER_HALF_W, type Bunker, type VentBeam } from './bunkers'
import { makeBolt, makeFragments, type EnemyShot } from './fragments'
import { markerDone, markerFiring, nextUfoDelay, spawnUfo, updateUfo, type Marker, type Ufo } from './ufo'
import { burst, floater, flash, newEffects, ring, shake, updateEffects, type Effects } from './effects'
import { addScore, damageBossInSpan, damageInvader, damageUfo, hitPlayer, stepEnemyShots, stepPlayerShots } from './projectiles'
import { BOSS_DEATH_TIME, bossBeat, bossTempoN, isBossWave, newBoss, updateBoss, type Boss } from './boss'
import type { FrameInput } from './input'
import { makeRng, type Rng } from '../../shared/rng'
import * as audio from './audio'

export interface PendingKill {
  inv: Invader
  perfect: boolean
}

export interface GameState {
  rng: Rng
  clock: BeatClock
  grid: Grid
  player: Player
  weapon: WeaponState
  shots: PlayerShot[]
  enemyShots: EnemyShot[]
  bunkers: Bunker[]
  beams: VentBeam[]
  boss: Boss | null
  ufo: Ufo | null
  ufoTimer: number
  markers: Marker[]
  fx: Effects
  kills: PendingKill[]
  score: number
  wave: number
  nextBonus: number
  waveIntro: number // grid holds still while the "WAVE n" banner shows
  waveClear: number // > 0 between clearing a wave and the next one spawning
  over: null | 'invaded' | 'destroyed'
  overLinger: number // effects keep playing briefly after the run ends
  ids: number
  // Stats for the game-over screen.
  shotsFired: number
  perfectShots: number
  barrierBlocks: number
  // Brief HUD flash on the heat bar when a vent is refused, etc.
  notice: string
  noticeTimer: number
}

export const OVER_LINGER = 1.4

function fireScaleFor(wave: number): number {
  return Math.pow(WAVE_FIRE_SCALE, wave - 1)
}

export function newGame(seed: number): GameState {
  const rng = makeRng(seed)
  const gs: GameState = {
    rng,
    clock: newBeatClock(),
    grid: null as unknown as Grid,
    player: newPlayer(),
    weapon: newWeaponState(),
    shots: [],
    enemyShots: [],
    bunkers: newBunkers(),
    beams: [],
    boss: null,
    ufo: null,
    ufoTimer: nextUfoDelay(rng),
    markers: [],
    fx: newEffects(),
    kills: [],
    score: 0,
    wave: 1,
    nextBonus: BONUS_LIFE_EVERY,
    waveIntro: WAVE_INTRO_TIME,
    waveClear: 0,
    over: null,
    overLinger: 0,
    ids: 1,
    shotsFired: 0,
    perfectShots: 0,
    barrierBlocks: 0,
    notice: '',
    noticeTimer: 0,
  }
  gs.grid = newGrid(rng, 0, 1, () => gs.ids++)
  return gs
}

// The next wave spawns lower and fires faster; all three bunkers rebuild.
// A boss wave brings The Conductor instead of a formation.
export function startWave(gs: GameState) {
  gs.wave++
  if (isBossWave(gs.wave)) {
    gs.grid = emptyGrid(gs.rng, fireScaleFor(gs.wave), () => gs.ids++)
    gs.boss = newBoss(gs.wave)
    if (gs.ufo) {
      gs.ufo = null
      audio.stopUfoHum()
    }
    audio.playBossWarning()
  } else {
    gs.grid = newGrid(gs.rng, Math.min(WAVE_DROP * (gs.wave - 1), WAVE_DROP_MAX), fireScaleFor(gs.wave), () => gs.ids++)
  }
  gs.bunkers = newBunkers()
  gs.beams = []
  gs.enemyShots = []
  gs.markers = []
  gs.waveIntro = WAVE_INTRO_TIME
}

function notice(gs: GameState, text: string) {
  gs.notice = text
  gs.noticeTimer = 1.2
}

const KILL_COLORS: Record<Invader['type'], string[]> = {
  command: ['#f0abfc', '#e879f9', '#ffffff'],
  drone: ['#93c5fd', '#60a5fa', '#e2e8f0'],
  grunt: ['#fb923c', '#fbbf24', '#f87171'],
  raider: ['#4ade80', '#a3e635', '#d9f99d'],
}

function resolveKills(gs: GameState) {
  if (gs.kills.length === 0) return
  const grid = gs.grid
  let big = false
  for (const { inv, perfect } of gs.kills) {
    const x = invaderX(grid, inv)
    const y = invaderY(grid, inv)
    const points = Math.round(INVADER_POINTS[inv.type] * (perfect ? PERFECT_SCORE_MULT : 1))
    addScore(gs, points)
    floater(gs.fx, x, y - 30, `+${points}`, perfect ? '#fde047' : '#e5e7eb', inv.type === 'command' ? 32 : 24)
    burst(gs.fx, gs.rng, x, y, KILL_COLORS[inv.type], inv.type === 'command' ? 26 : 14, 320, 0.55)
    if (inv.type === 'command') {
      big = true
      triggerFrenzy(grid, inv.col)
      ring(gs.fx, x, y, 110, '#e879f9', 0.45, 4)
      floater(gs.fx, x, y + 40, 'FRENZY', '#f0abfc', 22)
    } else if (inv.type === 'grunt') {
      gs.enemyShots.push(...makeFragments(gs.rng, x, y + INVADER_HALF_H))
    }
  }
  gs.kills = []
  audio.playExplosion(big ? 'large' : 'small')

  for (const col of checkColumnSnaps(grid)) {
    const x = columnX(grid, col)
    const midY = grid.originY + 2 * ROW_SPACING
    ring(gs.fx, x, midY, 420, '#c4b5fd', 0.6, 8)
    ring(gs.fx, x, midY, 260, '#ffffff', 0.4, 3)
    shake(gs.fx, 0.3, 12)
    flash(gs.fx, '196,181,253')
    floater(gs.fx, x, midY - 140, 'COLUMN SNAP', '#c4b5fd', 30)
    audio.playSnap()
  }
}

// Moves the boss; once its core is gone, a chain of explosions plays out
// across the hull before it's removed and the wave counts as cleared.
function updateBossDeath(gs: GameState, dt: number) {
  const boss = gs.boss!
  const before = boss.dying
  updateBoss(boss, dt)
  if (before <= 0) return
  const pops = (t: number) => Math.floor((BOSS_DEATH_TIME - t) * 8)
  if (pops(boss.dying) !== pops(before)) {
    const x = boss.x + gs.rng.range(-BOSS_HALF_W, BOSS_HALF_W)
    const y = boss.y + gs.rng.range(-BOSS_HALF_H, BOSS_HALF_H)
    burst(gs.fx, gs.rng, x, y, ['#e879f9', '#fde047', '#fb923c', '#ffffff'], 18, 360, 0.6)
    ring(gs.fx, x, y, 90, '#fde047', 0.4, 3)
    audio.playExplosion('small')
  }
  if (boss.dying > 0) return
  burst(gs.fx, gs.rng, boss.x, boss.y, ['#e879f9', '#fde047', '#fb923c', '#ffffff', '#67e8f9'], 90, 760, 1.2)
  ring(gs.fx, boss.x, boss.y, 520, '#e879f9', 0.9, 10)
  ring(gs.fx, boss.x, boss.y, 320, '#ffffff', 0.6, 4)
  floater(gs.fx, VIEW_W / 2, 420, 'THE CONDUCTOR FALLS', '#fde047', 48)
  shake(gs.fx, 0.6, 20)
  flash(gs.fx, '253,224,71')
  audio.playExplosion('large')
  gs.boss = null
}

function tryVent(gs: GameState) {
  const p = gs.player
  if (!isAlive(p)) return
  const b = gs.bunkers.find((bk) => canVent(bk, p.x))
  if (!b) {
    const near = gs.bunkers.find((bk) => !bk.vented && Math.abs(p.x - bk.x) <= BUNKER_HALF_W)
    notice(gs, near ? 'BUNKER CHARGE TOO LOW' : 'STAND UNDER A BUNKER TO VENT')
    return
  }
  const beam = vent(b)
  gs.beams.push(beam)
  burst(gs.fx, gs.rng, b.x, b.y, ['#fde047', '#fbbf24', '#67e8f9', '#ffffff'], 40, 500, 0.8)
  shake(gs.fx, 0.35, 10)
  flash(gs.fx, '253,224,71')
  audio.playVent(beam.t)
}

export function stepGame(gs: GameState, input: FrameInput, dt: number) {
  updateEffects(gs.fx, dt)
  if (gs.over) {
    gs.overLinger += dt
    return
  }
  gs.noticeTimer = Math.max(0, gs.noticeTimer - dt)
  const grid = gs.grid
  const p = gs.player

  // --- Input edges -------------------------------------------------------
  if (input.select && input.select !== gs.weapon.current) {
    selectWeapon(gs.weapon, input.select)
    audio.playSwitch()
  }
  if (input.cycle !== 0) {
    cycleWeapon(gs.weapon, input.cycle)
    audio.playSwitch()
  }

  // --- Player ------------------------------------------------------------
  if (updatePlayer(p, input.move, input.dash, dt)) {
    audio.playDash()
    burst(gs.fx, gs.rng, p.x, PLAYER_Y + 10, ['#67e8f9', '#e879f9'], 10, 220, 0.3)
  }

  // --- Beat clock, grid & boss --------------------------------------------
  // In a boss wave the boss's remaining health stands in for the invader
  // count, so the tempo still climbs as it breaks apart.
  const n = livingCount(grid)
  const tempoN = gs.boss ? bossTempoN(gs.boss) : Math.max(1, n)
  const freq = stepFrequency(tempoN)
  if (tickBeat(gs.clock, dt, freq)) {
    audio.onBeat(gs.clock.index - 1, tempoN, 1 / freq)
    if (gs.waveIntro <= 0 && n > 0) marchStep(grid, gs.rng)
    if (gs.boss && gs.waveIntro <= 0) {
      const volley = bossBeat(gs.boss, p.x)
      for (const b of volley.bolts) gs.enemyShots.push(makeBolt(b.x, b.y, b.angle))
      for (const x of volley.markers) gs.markers.push({ x, t: 0, hitDone: false })
      if (volley.bolts.length > 0) audio.playBossFire()
    }
  }
  updateGrid(grid, dt)
  if (gs.boss) updateBossDeath(gs, dt)
  gs.waveIntro = Math.max(0, gs.waveIntro - dt)
  if (gs.waveIntro <= 0) {
    updateEnemyFire(grid, dt, gs.rng, (x, y, angle) => gs.enemyShots.push(makeBolt(x, y, angle)))
  }

  // --- Weapons -----------------------------------------------------------
  if (updateHeat(gs.weapon, dt)) audio.playCooled()
  if (input.fire && isAlive(p) && canFire(gs.weapon)) {
    const perfect = isPerfectBeat(gs.clock)
    const result = fire(gs.weapon, p.x, PLAYER_Y - 30, perfect, () => gs.ids++)
    gs.shots.push(...result.shots)
    gs.shotsFired++
    audio.playShot(gs.weapon.current)
    if (perfect) {
      gs.perfectShots++
      audio.playChime()
      ring(gs.fx, p.x, PLAYER_Y, 70, '#fde047', 0.3, 3)
      burst(gs.fx, gs.rng, p.x, PLAYER_Y - 30, ['#fde047', '#ffffff'], 6, 160, 0.25)
    }
    if (result.overheated) {
      audio.playOverheat()
      floater(gs.fx, p.x, PLAYER_Y - 70, 'OVERHEAT', '#f87171', 28)
      burst(gs.fx, gs.rng, p.x, PLAYER_Y - 20, ['#f87171', '#fca5a5', '#e5e7eb'], 16, 200, 0.5)
    }
  }
  if (input.vent) tryVent(gs)

  // --- Projectiles -------------------------------------------------------
  stepPlayerShots(gs, dt)
  stepEnemyShots(gs, dt)

  // --- Bunkers, vent beams, invader contact ------------------------------
  updateBunkers(gs.bunkers, dt)
  for (const beam of gs.beams) {
    beam.t -= dt
    for (const inv of grid.invaders) {
      if (!inv.alive) continue
      if (Math.abs(invaderX(grid, inv) - beam.x) <= beam.halfW + INVADER_HALF_W && invaderY(grid, inv) < beam.baseY) {
        damageInvader(gs, inv, beam.dps * dt, false)
      }
    }
    if (gs.ufo && Math.abs(gs.ufo.x - beam.x) <= beam.halfW) damageUfo(gs, beam.dps * dt)
    damageBossInSpan(gs, beam.x, beam.halfW, beam.dps * dt)
  }
  gs.beams = gs.beams.filter((b) => b.t > 0)
  for (const inv of grid.invaders) {
    if (!inv.alive) continue
    const x = invaderX(grid, inv)
    const y = invaderY(grid, inv)
    for (const b of gs.bunkers) eraseRect(b, x - INVADER_HALF_W, y - INVADER_HALF_H, x + INVADER_HALF_W, y + INVADER_HALF_H)
  }

  // --- Apex Transponder & laser markers ----------------------------------
  if (gs.ufo) {
    if (!updateUfo(gs.ufo, dt, gs.rng, gs.bunkers, gs.markers)) {
      gs.ufo = null
      gs.ufoTimer = nextUfoDelay(gs.rng)
      audio.stopUfoHum()
    }
  } else if (gs.waveIntro <= 0 && gs.waveClear <= 0 && !gs.boss) {
    gs.ufoTimer -= dt
    if (gs.ufoTimer <= 0) {
      gs.ufo = spawnUfo(gs.rng)
      audio.startUfoHum()
    }
  }
  for (const m of gs.markers) {
    const wasFiring = markerFiring(m)
    if (m.t === 0) audio.playMarkerArm()
    m.t += dt
    if (markerFiring(m)) {
      if (!wasFiring) {
        audio.playMarkerBeam()
        shake(gs.fx, 0.2, 6)
      }
      if (isVulnerable(p) && Math.abs(p.x - m.x) < MARKER_HALF_W + PLAYER_HALF_W * 0.6) hitPlayer(gs)
    }
  }
  gs.markers = gs.markers.filter((m) => !markerDone(m))

  // --- Deaths, wave clear, game over -------------------------------------
  resolveKills(gs)

  if (gs.waveClear > 0) {
    gs.waveClear -= dt
    if (gs.waveClear <= 0) startWave(gs)
  } else if (livingCount(grid) === 0 && !gs.boss) {
    gs.waveClear = 1.8
    gs.enemyShots = gs.enemyShots.filter((s) => s.kind === 'fragment')
    floater(gs.fx, VIEW_W / 2, 480, `WAVE ${gs.wave} CLEAR`, '#e879f9', 56)
    audio.playWaveClear()
  }

  if (!gs.over && livingCount(grid) > 0 && lowestBottom(grid) >= FAIL_Y) {
    gs.over = 'invaded'
    shake(gs.fx, 0.6, 18)
    flash(gs.fx, '248,113,113')
  }
  if (gs.over) {
    audio.stopUfoHum()
    audio.playGameOver()
  }
}

// HUD helper: the heat bar's color (weapon color, orange when hot, red
// while locked out).
export function heatColor(ws: WeaponState): string {
  if (ws.overheated) return '#f87171'
  if (ws.heat > 70) return '#fb923c'
  return WEAPONS[ws.current].color
}

// Draws one frame in the 1920x1080 logical space (the component sets the
// canvas transform). Playfield first (shaken on impacts), then the HUD.
import {
  BOSS_CORE_R,
  BOSS_HALF_H,
  BOSS_HALF_W,
  BOSS_POD_HALF,
  CELL_HP,
  CELL_R,
  COLS,
  DASH_COOLDOWN,
  ENERGY_MAX,
  FAIL_Y,
  HEAT_MAX,
  INVADER_HALF_H,
  INVADER_HALF_W,
  MARKER_HALF_W,
  MARKER_TELEGRAPH,
  PERFECT_WINDOW,
  PLAYER_Y,
  ROW_SPACING,
  UFO_HP,
  VENT_MIN_ENERGY,
  VENT_TIME,
  VIEW_H,
  VIEW_W,
  WEAPONS,
  WEAPON_ORDER,
} from './constants'
import { nextBeatTime } from './beat'
import { BUNKER_HALF_H, BUNKER_HALF_W, canVent, type Bunker } from './bunkers'
import { hasBarrier, invaderX, invaderY, livingCount, type Invader } from './grid'
import { isAlive } from './player'
import { markerFiring } from './ufo'
import { DAMAGE_LIFE, FLASH_LIFE, FLOATER_LIFE } from './effects'
import { tierFor } from './audio'
import { heatColor, type GameState } from './game'
import { BOSS_DEATH_TIME, bossHealth, podX, podY, type Boss } from './boss'
import type { Rng } from '../../shared/rng'

export interface Star {
  x: number
  y: number
  r: number
  twinkle: number
}

export function makeStars(rng: Rng): Star[] {
  return Array.from({ length: 160 }, () => ({
    x: rng.range(0, VIEW_W),
    y: rng.range(0, VIEW_H),
    r: rng.next() < 0.15 ? 2 : 1.2,
    twinkle: rng.range(0, Math.PI * 2),
  }))
}

// 0 right after a beat, rising to 1 just before the next.
function beatPhase(gs: GameState): number {
  return gs.clock.phase
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const k = Math.max(0, Math.min(1, t))
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`
}

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

// --- Background -----------------------------------------------------------

function drawBackground(ctx: CanvasRenderingContext2D, gs: GameState, stars: Star[]) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  g.addColorStop(0, '#05030f')
  g.addColorStop(1, '#0c0620')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  // The whole field breathes with the beat.
  const pulse = Math.pow(1 - beatPhase(gs), 4)
  for (const s of stars) {
    const a = 0.35 + 0.35 * Math.sin(gs.clock.time * 1.5 + s.twinkle) + pulse * 0.3
    ctx.fillStyle = `rgba(226,232,240,${Math.max(0.1, Math.min(1, a))})`
    ctx.fillRect(s.x, s.y, s.r, s.r)
  }

  ctx.strokeStyle = `rgba(232,121,249,${0.05 + pulse * 0.08})`
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= VIEW_W; x += 120) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, VIEW_H)
  }
  ctx.stroke()

  // The invasion line.
  ctx.setLineDash([18, 14])
  ctx.strokeStyle = 'rgba(248,113,113,0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, FAIL_Y)
  ctx.lineTo(VIEW_W, FAIL_Y)
  ctx.stroke()
  ctx.setLineDash([])
}

// --- Invaders -------------------------------------------------------------

function drawInvader(ctx: CanvasRenderingContext2D, gs: GameState, inv: Invader) {
  const grid = gs.grid
  let x = invaderX(grid, inv)
  const y = invaderY(grid, inv)
  const frenzied = inv.frenzy > 0
  if (frenzied) x += (Math.random() * 2 - 1) * 3
  const legs = gs.clock.index % 2 === 0
  const white = inv.flash > 0

  ctx.save()
  ctx.translate(x, y)
  ctx.shadowBlur = inv.type === 'command' ? 24 : 12

  if (inv.type === 'command') {
    const c = white ? '#ffffff' : frenzied ? '#f87171' : '#e879f9'
    ctx.shadowColor = '#e879f9'
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.moveTo(0, -22)
    ctx.lineTo(26, 0)
    ctx.lineTo(0, 20)
    ctx.lineTo(-26, 0)
    ctx.closePath()
    ctx.fill()
    // Crown spikes
    ctx.beginPath()
    ctx.moveTo(-18, -8)
    ctx.lineTo(-24, -24)
    ctx.lineTo(-10, -14)
    ctx.moveTo(18, -8)
    ctx.lineTo(24, -24)
    ctx.lineTo(10, -14)
    ctx.fill()
    ctx.fillStyle = '#1e0b2e'
    ctx.beginPath()
    ctx.arc(0, 0, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fde047'
    ctx.beginPath()
    ctx.arc(0, 0, 3.5 + 1.5 * Math.pow(1 - beatPhase(gs), 3), 0, Math.PI * 2)
    ctx.fill()
  } else if (inv.type === 'drone') {
    const c = white ? '#ffffff' : frenzied ? '#fca5a5' : '#60a5fa'
    ctx.shadowColor = '#60a5fa'
    ctx.fillStyle = c
    hexPath(ctx, 0, 0, 24)
    ctx.fill()
    ctx.strokeStyle = white ? '#ffffff' : '#cbd5e1'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(-12, -4, 24, 8)
    ctx.fillStyle = '#93c5fd'
    ctx.fillRect(-8, -2, 16, 4)
    ctx.fillStyle = c
    ctx.fillRect(-30, legs ? -6 : 0, 8, 6)
    ctx.fillRect(22, legs ? -6 : 0, 8, 6)
  } else if (inv.type === 'grunt') {
    const c = white ? '#ffffff' : frenzied ? '#f87171' : '#fb923c'
    ctx.shadowColor = '#fb923c'
    ctx.fillStyle = c
    ctx.fillRect(-26, -16, 52, 28)
    ctx.fillRect(-18, -22, 36, 6)
    ctx.fillRect(legs ? -26 : -20, 12, 10, 10)
    ctx.fillRect(legs ? 16 : 10, 12, 10, 10)
    ctx.fillStyle = '#1c0a00'
    ctx.fillRect(-16, -8, 10, 8)
    ctx.fillRect(6, -8, 10, 8)
    ctx.fillStyle = '#fde047'
    ctx.beginPath()
    ctx.arc(0, 6, 4 + Math.sin(gs.clock.time * 10) * 1, 0, Math.PI * 2)
    ctx.fill()
  } else {
    const c = white ? '#ffffff' : frenzied ? '#f87171' : '#4ade80'
    ctx.shadowColor = '#4ade80'
    ctx.fillStyle = c
    // Classic crab silhouette, legs swapping every beat.
    ctx.fillRect(-20, -12, 40, 20)
    ctx.fillRect(-28, -4, 8, 12)
    ctx.fillRect(20, -4, 8, 12)
    ctx.fillRect(-14, -20, 6, 8)
    ctx.fillRect(8, -20, 6, 8)
    if (legs) {
      ctx.fillRect(-28, 8, 8, 10)
      ctx.fillRect(20, 8, 8, 10)
    } else {
      ctx.fillRect(-16, 8, 8, 10)
      ctx.fillRect(8, 8, 8, 10)
    }
    ctx.fillStyle = '#052e16'
    ctx.fillRect(-12, -6, 7, 7)
    ctx.fillRect(5, -6, 7, 7)
  }
  ctx.shadowBlur = 0

  if (inv.hp < inv.maxHp) {
    ctx.fillStyle = 'rgba(15,23,42,0.8)'
    ctx.fillRect(-INVADER_HALF_W, -INVADER_HALF_H - 10, INVADER_HALF_W * 2, 4)
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(-INVADER_HALF_W, -INVADER_HALF_H - 10, INVADER_HALF_W * 2 * Math.max(0, inv.hp / inv.maxHp), 4)
  }
  ctx.restore()
}

// The Drone's barrier: a shimmering arc under the Grunt it protects,
// facing the player.
function drawBarriers(ctx: CanvasRenderingContext2D, gs: GameState) {
  const grid = gs.grid
  for (let c = 0; c < COLS; c++) {
    if (!hasBarrier(grid, c)) continue
    const grunt = grid.invaders[2 * COLS + c]
    const drone = grid.invaders[COLS + c]
    const x = invaderX(grid, grunt)
    const y = invaderY(grid, grunt)
    const shimmer = 0.45 + 0.2 * Math.sin(gs.clock.time * 6 + c)
    ctx.strokeStyle = `rgba(147,197,253,${shimmer})`
    ctx.lineWidth = 4
    ctx.shadowColor = '#93c5fd'
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.arc(x, y - 6, 42, Math.PI * 0.15, Math.PI * 0.85)
    ctx.stroke()
    ctx.shadowBlur = 0
    // Faint link from the projector to the arc.
    ctx.strokeStyle = 'rgba(147,197,253,0.18)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(invaderX(grid, drone), invaderY(grid, drone) + 18)
    ctx.lineTo(x, y - ROW_SPACING / 2 + 20)
    ctx.stroke()
  }
}

// --- The Conductor ----------------------------------------------------------

function drawBoss(ctx: CanvasRenderingContext2D, gs: GameState, boss: Boss) {
  const pulse = Math.pow(1 - beatPhase(gs), 3)
  const dying = boss.dying > 0
  const overdrive = boss.phase === 'overdrive'
  ctx.save()
  if (dying) {
    // Flickers and judders more as the death chain runs on.
    const k = 1 - boss.dying / BOSS_DEATH_TIME
    ctx.globalAlpha = Math.floor(gs.clock.time * 20) % 2 ? 1 : 0.55 + 0.4 * (1 - k)
    ctx.translate((Math.random() * 2 - 1) * 6 * k, (Math.random() * 2 - 1) * 6 * k)
  }
  ctx.translate(boss.x, boss.y)

  // Shield links from each living pod up to the core.
  if (boss.phase === 'shielded') {
    ctx.strokeStyle = `rgba(147,197,253,${0.25 + 0.25 * pulse})`
    ctx.lineWidth = 3
    ctx.beginPath()
    for (const pod of boss.pods) {
      if (pod.hp <= 0) continue
      ctx.moveTo(podX(boss, pod) - boss.x, podY(boss) - boss.y)
      ctx.lineTo(0, 0)
    }
    ctx.stroke()
  }

  // Hull.
  const W = BOSS_HALF_W
  const H = BOSS_HALF_H
  const hull = ctx.createLinearGradient(0, -H, 0, H)
  hull.addColorStop(0, overdrive ? '#7f1d1d' : '#581c87')
  hull.addColorStop(1, overdrive ? '#450a0a' : '#2e1065')
  ctx.fillStyle = hull
  ctx.shadowColor = overdrive ? '#f87171' : '#e879f9'
  ctx.shadowBlur = 24 + 16 * pulse
  ctx.beginPath()
  ctx.moveTo(-W, -8)
  ctx.lineTo(-W + 50, -H)
  ctx.lineTo(W - 50, -H)
  ctx.lineTo(W, -8)
  ctx.lineTo(W - 30, H - 14)
  ctx.lineTo(70, H)
  ctx.lineTo(-70, H)
  ctx.lineTo(-W + 30, H - 14)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = overdrive ? '#fca5a5' : '#e879f9'
  ctx.lineWidth = 3
  ctx.stroke()

  // Equalizer bars either side of the core, jumping on every beat: it
  // conducts the music the formation marches to.
  for (let i = 0; i < 5; i++) {
    const wobble = 0.55 + 0.45 * Math.sin(gs.clock.index * 1.7 + i * 2.1)
    const h = 8 + 30 * pulse * wobble
    ctx.fillStyle = mix([232, 121, 249], [253, 224, 71], i / 4)
    for (const side of [-1, 1]) ctx.fillRect(side * (70 + i * 22) - 7, 6 - h, 14, h)
  }

  // Core.
  const coreR = BOSS_CORE_R - 6 + 6 * pulse
  if (boss.phase !== 'shielded' || boss.coreFlash > 0) {
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, coreR)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.35, boss.coreFlash > 0 ? '#ffffff' : overdrive ? '#fca5a5' : '#fde047')
    g.addColorStop(1, overdrive ? '#dc2626' : '#f59e0b')
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = '#a16207'
  }
  ctx.shadowColor = overdrive ? '#f87171' : '#fde047'
  ctx.shadowBlur = boss.phase === 'shielded' ? 10 : 30
  ctx.beginPath()
  ctx.arc(0, 0, coreR, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  if (boss.phase === 'shielded') {
    const shimmer = 0.5 + 0.2 * Math.sin(gs.clock.time * 6)
    ctx.strokeStyle = `rgba(147,197,253,${shimmer})`
    ctx.fillStyle = `rgba(147,197,253,${shimmer * 0.25})`
    ctx.lineWidth = 4
    ctx.shadowColor = '#93c5fd'
    ctx.shadowBlur = 16
    hexPath(ctx, 0, 0, BOSS_CORE_R + 16)
    ctx.fill()
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  // Pods: live ones are the targets while the shield is up.
  for (const pod of boss.pods) {
    const px = podX(boss, pod) - boss.x
    const py = podY(boss) - boss.y
    if (pod.hp <= 0) {
      ctx.fillStyle = '#1e1b4b'
      hexPath(ctx, px, py, BOSS_POD_HALF - 8)
      ctx.fill()
      ctx.strokeStyle = '#475569'
      ctx.lineWidth = 2
      ctx.stroke()
      continue
    }
    ctx.fillStyle = pod.flash > 0 ? '#ffffff' : '#0ea5e9'
    ctx.shadowColor = '#38bdf8'
    ctx.shadowBlur = 18
    hexPath(ctx, px, py, BOSS_POD_HALF)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#e0f2fe'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = '#082f49'
    ctx.fillRect(px - 7, py + 10, 14, 26)
    ctx.fillStyle = '#7dd3fc'
    ctx.beginPath()
    ctx.arc(px, py - 2, 9 + 3 * pulse, 0, Math.PI * 2)
    ctx.fill()
    if (pod.hp < pod.maxHp) {
      ctx.fillStyle = 'rgba(15,23,42,0.85)'
      ctx.fillRect(px - 34, py - BOSS_POD_HALF - 12, 68, 5)
      ctx.fillStyle = '#7dd3fc'
      ctx.fillRect(px - 34, py - BOSS_POD_HALF - 12, 68 * (pod.hp / pod.maxHp), 5)
    }
  }
  ctx.restore()
}

// Health bar across the top while the boss is in play.
function drawBossBar(ctx: CanvasRenderingContext2D, boss: Boss) {
  const w = 640
  const x = (VIEW_W - w) / 2
  const y = 62
  ctx.fillStyle = 'rgba(15,23,42,0.85)'
  ctx.fillRect(x, y, w, 12)
  ctx.fillStyle = boss.phase === 'overdrive' ? '#f87171' : boss.phase === 'exposed' ? '#fde047' : '#e879f9'
  ctx.fillRect(x, y, w * bossHealth(boss), 12)
  ctx.strokeStyle = 'rgba(226,232,240,0.45)'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, 12)
}

// --- Bunkers, beams, markers ----------------------------------------------

const COOL: [number, number, number] = [56, 189, 248]
const HOT: [number, number, number] = [251, 191, 36]

function drawBunker(ctx: CanvasRenderingContext2D, gs: GameState, b: Bunker) {
  if (b.vented) return
  const base = b.energy / ENERGY_MAX
  for (const c of b.cells) {
    if (c.hp <= 0) continue
    const cx = b.x + c.dx
    const cy = b.y + c.dy
    const heat = Math.max(c.charge, base * 0.55)
    const color = mix(COOL, HOT, heat)
    ctx.globalAlpha = 0.25 + 0.6 * (c.hp / CELL_HP)
    ctx.fillStyle = color
    hexPath(ctx, cx, cy, CELL_R - 2)
    ctx.fill()
    ctx.globalAlpha = 0.9
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Charge meter under the bunker.
  const w = BUNKER_HALF_W * 2 - 20
  const mx = b.x - w / 2
  const my = b.y + BUNKER_HALF_H + 12
  ctx.fillStyle = 'rgba(15,23,42,0.85)'
  ctx.fillRect(mx, my, w, 8)
  ctx.fillStyle = b.energy >= VENT_MIN_ENERGY ? '#fbbf24' : '#64748b'
  ctx.fillRect(mx, my, w * base, 8)
  ctx.fillStyle = '#e2e8f0'
  ctx.fillRect(mx + w * (VENT_MIN_ENERGY / ENERGY_MAX), my - 2, 2, 12)
  if (isAlive(gs.player) && canVent(b, gs.player.x)) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(gs.clock.time * 8)
    ctx.fillStyle = '#fde047'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('VENT READY [F]', b.x, my + 28)
    ctx.globalAlpha = 1
  }
}

function drawBeams(ctx: CanvasRenderingContext2D, gs: GameState) {
  for (const beam of gs.beams) {
    const life = beam.t / VENT_TIME
    const flicker = 0.85 + 0.15 * Math.sin(gs.clock.time * 60)
    const g = ctx.createLinearGradient(beam.x - beam.halfW, 0, beam.x + beam.halfW, 0)
    g.addColorStop(0, 'rgba(253,224,71,0)')
    g.addColorStop(0.2, `rgba(251,191,36,${0.5 * life * flicker})`)
    g.addColorStop(0.5, `rgba(255,255,255,${0.9 * life * flicker})`)
    g.addColorStop(0.8, `rgba(251,191,36,${0.5 * life * flicker})`)
    g.addColorStop(1, 'rgba(253,224,71,0)')
    ctx.fillStyle = g
    ctx.fillRect(beam.x - beam.halfW, 0, beam.halfW * 2, beam.baseY)
  }
}

function drawMarkers(ctx: CanvasRenderingContext2D, gs: GameState) {
  for (const m of gs.markers) {
    if (markerFiring(m)) {
      const g = ctx.createLinearGradient(m.x - MARKER_HALF_W, 0, m.x + MARKER_HALF_W, 0)
      g.addColorStop(0, 'rgba(248,113,113,0)')
      g.addColorStop(0.5, 'rgba(255,240,240,0.95)')
      g.addColorStop(1, 'rgba(248,113,113,0)')
      ctx.fillStyle = g
      ctx.fillRect(m.x - MARKER_HALF_W, 0, MARKER_HALF_W * 2, VIEW_H)
    } else {
      const blink = Math.floor(m.t * (6 + (m.t / MARKER_TELEGRAPH) * 10)) % 2 === 0
      ctx.strokeStyle = blink ? 'rgba(248,113,113,0.85)' : 'rgba(248,113,113,0.3)'
      ctx.lineWidth = 2
      ctx.setLineDash([10, 10])
      ctx.beginPath()
      ctx.moveTo(m.x - MARKER_HALF_W, 0)
      ctx.lineTo(m.x - MARKER_HALF_W, VIEW_H)
      ctx.moveTo(m.x + MARKER_HALF_W, 0)
      ctx.lineTo(m.x + MARKER_HALF_W, VIEW_H)
      ctx.stroke()
      ctx.setLineDash([])
      // Target reticle on the player line.
      const r = 30 * (1 - m.t / MARKER_TELEGRAPH) + 14
      ctx.beginPath()
      ctx.arc(m.x, PLAYER_Y, r, 0, Math.PI * 2)
      ctx.moveTo(m.x - 40, PLAYER_Y)
      ctx.lineTo(m.x + 40, PLAYER_Y)
      ctx.moveTo(m.x, PLAYER_Y - 40)
      ctx.lineTo(m.x, PLAYER_Y + 40)
      ctx.stroke()
    }
  }
}

// --- UFO, player, projectiles ---------------------------------------------

function drawUfo(ctx: CanvasRenderingContext2D, gs: GameState) {
  const ufo = gs.ufo
  if (!ufo) return
  ctx.save()
  ctx.translate(ufo.x, ufo.y)
  ctx.shadowColor = '#f0abfc'
  ctx.shadowBlur = 24
  ctx.fillStyle = ufo.flash > 0 ? '#ffffff' : '#a855f7'
  ctx.beginPath()
  ctx.ellipse(0, 4, 52, 14, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = ufo.flash > 0 ? '#ffffff' : '#f0abfc'
  ctx.beginPath()
  ctx.ellipse(0, -6, 22, 16, 0, Math.PI, 0)
  ctx.fill()
  ctx.shadowBlur = 0
  for (let i = 0; i < 6; i++) {
    const on = (Math.floor(gs.clock.time * 10) + i) % 3 === 0
    ctx.fillStyle = on ? '#fde047' : '#581c87'
    ctx.beginPath()
    ctx.arc(-40 + i * 16, 6, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  if (ufo.hp < UFO_HP) {
    ctx.fillStyle = 'rgba(15,23,42,0.8)'
    ctx.fillRect(-50, -34, 100, 5)
    ctx.fillStyle = '#f0abfc'
    ctx.fillRect(-50, -34, 100 * Math.max(0, ufo.hp / UFO_HP), 5)
  }
  ctx.restore()
}

function drawPlayer(ctx: CanvasRenderingContext2D, gs: GameState) {
  const p = gs.player
  if (!isAlive(p)) return
  if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return

  // Beat ring: closes in on the cannon, turning gold in the perfect window.
  const until = nextBeatTime(gs.clock) - gs.clock.time
  const since = gs.clock.time - gs.clock.lastBeat
  const inWindow = Math.min(until, since) <= PERFECT_WINDOW
  const r = 34 + 90 * (1 - beatPhase(gs))
  ctx.strokeStyle = inWindow ? 'rgba(253,224,71,0.95)' : `rgba(232,121,249,${0.15 + 0.4 * beatPhase(gs)})`
  ctx.lineWidth = inWindow ? 4 : 2
  ctx.beginPath()
  ctx.arc(p.x, PLAYER_Y, r, Math.PI, Math.PI * 2)
  ctx.stroke()

  if (p.dashT > 0) {
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.25 / i
      ctx.fillStyle = '#67e8f9'
      ctx.fillRect(p.x - p.dashDir * i * 30 - 34, PLAYER_Y - 10, 68, 26)
    }
    ctx.globalAlpha = 1
  }

  ctx.save()
  ctx.translate(p.x, PLAYER_Y)
  ctx.shadowColor = gs.weapon.overheated ? '#f87171' : '#67e8f9'
  ctx.shadowBlur = 18
  ctx.fillStyle = gs.weapon.overheated ? '#fca5a5' : '#67e8f9'
  ctx.beginPath()
  ctx.moveTo(-38, 18)
  ctx.lineTo(-30, 0)
  ctx.lineTo(-10, -6)
  ctx.lineTo(-6, -24)
  ctx.lineTo(6, -24)
  ctx.lineTo(10, -6)
  ctx.lineTo(30, 0)
  ctx.lineTo(38, 18)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = WEAPONS[gs.weapon.current].color
  ctx.fillRect(-4, -30, 8, 10)
  ctx.fillStyle = '#0e7490'
  ctx.fillRect(-20, 6, 40, 6)
  ctx.restore()
}

function drawShots(ctx: CanvasRenderingContext2D, gs: GameState) {
  ctx.lineCap = 'round'
  for (const s of gs.shots) {
    const def = WEAPONS[s.weapon]
    const speed = Math.hypot(s.vx, s.vy) || 1
    const ux = s.vx / speed
    const uy = s.vy / speed
    ctx.shadowColor = s.perfect ? '#fde047' : def.color
    ctx.shadowBlur = 12
    if (s.weapon === 'siege') {
      // Straight flight; the arc is a scale-up/down with a ground shadow.
      const prog = Math.max(0, Math.min(1, (PLAYER_Y - s.y) / (PLAYER_Y - 100)))
      const lift = Math.sin(prog * Math.PI)
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.ellipse(s.x + 18 * lift, s.y + 24 * lift, 9, 5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 16
      ctx.fillStyle = s.perfect ? '#fde047' : def.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, 9 + 8 * lift, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff7ed'
      ctx.beginPath()
      ctx.arc(s.x - 3, s.y - 3, 3 + 2 * lift, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    const len = s.weapon === 'needle' ? 70 : s.weapon === 'disruptor' ? 26 : 16
    ctx.strokeStyle = s.perfect ? '#fde047' : def.color
    ctx.lineWidth = s.weapon === 'needle' ? 4 : s.weapon === 'spread' ? 6 : 5
    ctx.beginPath()
    ctx.moveTo(s.x - ux * len, s.y - uy * len)
    ctx.lineTo(s.x, s.y)
    ctx.stroke()
  }
  ctx.shadowBlur = 0

  for (const s of gs.enemyShots) {
    if (s.kind === 'bolt') {
      ctx.strokeStyle = '#f87171'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(s.x, s.y - 18)
      ctx.lineTo(s.x + 5, s.y - 12)
      ctx.lineTo(s.x - 5, s.y - 6)
      ctx.lineTo(s.x, s.y)
      ctx.stroke()
    } else {
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.age * 14)
      ctx.fillStyle = Math.floor(s.age * 16) % 2 ? '#fbbf24' : '#fb923c'
      ctx.beginPath()
      ctx.moveTo(0, -9)
      ctx.lineTo(7, 6)
      ctx.lineTo(-7, 6)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }
  ctx.lineCap = 'butt'
}

function drawEffects(ctx: CanvasRenderingContext2D, gs: GameState) {
  const fx = gs.fx
  for (const p of fx.particles) {
    ctx.globalAlpha = 1 - p.age / p.life
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  for (const r of fx.rings) {
    const k = r.age / r.life
    ctx.globalAlpha = 1 - k
    ctx.strokeStyle = r.color
    ctx.lineWidth = r.width * (1 - k * 0.5)
    ctx.beginPath()
    ctx.arc(r.x, r.y, r.maxR * (0.2 + 0.8 * Math.sqrt(k)), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.textAlign = 'center'
  for (const f of fx.floaters) {
    const k = f.age / FLOATER_LIFE
    ctx.globalAlpha = 1 - k * k
    ctx.fillStyle = f.color
    ctx.font = `bold ${f.size}px sans-serif`
    ctx.fillText(f.text, f.x, f.y - k * 50)
  }
  ctx.globalAlpha = 1
}

// --- HUD ------------------------------------------------------------------

function drawHud(ctx: CanvasRenderingContext2D, gs: GameState) {
  const p = gs.player
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 34px sans-serif'
  ctx.fillText(gs.score.toLocaleString(), 28, 48)
  ctx.font = '18px sans-serif'
  ctx.fillStyle = '#c4b5fd'
  ctx.fillText(`WAVE ${gs.wave}`, 30, 76)
  for (let i = 0; i < p.lives; i++) {
    ctx.fillStyle = '#67e8f9'
    const lx = 130 + i * 30
    ctx.beginPath()
    ctx.moveTo(lx - 11, 76)
    ctx.lineTo(lx, 60)
    ctx.lineTo(lx + 11, 76)
    ctx.closePath()
    ctx.fill()
  }

  // Tempo readout, top center.
  const n = livingCount(gs.grid)
  const bpm = Math.round(gs.clock.freq * 60)
  ctx.textAlign = 'center'
  ctx.font = 'bold 20px sans-serif'
  const pulse = Math.pow(1 - beatPhase(gs), 3)
  ctx.fillStyle = `rgba(232,121,249,${0.55 + pulse * 0.45})`
  ctx.fillText(`♩ ${bpm} BPM`, VIEW_W / 2, 30)
  ctx.font = '14px sans-serif'
  ctx.fillStyle = 'rgba(226,232,240,0.6)'
  if (gs.boss) {
    const label = gs.boss.phase === 'shielded' ? 'SHIELDED · TAKE OUT THE PODS' : gs.boss.phase === 'exposed' ? 'CORE EXPOSED' : 'OVERDRIVE'
    ctx.fillText(`THE CONDUCTOR · ${label}`, VIEW_W / 2, 50)
    drawBossBar(ctx, gs.boss)
  } else {
    ctx.fillText(`${n} INVADERS · TIER ${tierFor(Math.max(1, n))}`, VIEW_W / 2, 50)
  }

  // Heat bar, bottom left.
  const ws = gs.weapon
  const hx = 28
  const hy = 1036
  const hw = 380
  ctx.textAlign = 'left'
  ctx.font = 'bold 14px sans-serif'
  ctx.fillStyle = ws.overheated ? '#f87171' : '#cbd5e1'
  ctx.fillText(ws.overheated ? 'OVERHEATED' : 'HEAT', hx, hy - 8)
  ctx.fillStyle = 'rgba(15,23,42,0.85)'
  ctx.fillRect(hx, hy, hw, 16)
  const blink = ws.overheated && Math.floor(gs.clock.time * 8) % 2 === 0
  ctx.fillStyle = blink ? '#fecaca' : heatColor(ws)
  ctx.fillRect(hx, hy, hw * (ws.heat / HEAT_MAX), 16)
  ctx.strokeStyle = 'rgba(226,232,240,0.4)'
  ctx.lineWidth = 1
  ctx.strokeRect(hx, hy, hw, 16)

  // Dash pip.
  const ready = p.dashCooldown <= 0
  ctx.fillStyle = ready ? '#67e8f9' : 'rgba(103,232,249,0.25)'
  ctx.beginPath()
  ctx.arc(hx + hw + 30, hy + 8, 10, 0, Math.PI * 2)
  ctx.fill()
  if (!ready) {
    ctx.strokeStyle = '#67e8f9'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(hx + hw + 30, hy + 8, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.dashCooldown / DASH_COOLDOWN))
    ctx.stroke()
  }
  ctx.fillStyle = '#cbd5e1'
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText('DASH', hx + hw + 48, hy + 13)

  // Weapon selector, bottom right.
  const slotW = 150
  const sx0 = VIEW_W - 28 - slotW * 4 - 30
  WEAPON_ORDER.forEach((id, i) => {
    const def = WEAPONS[id]
    const x = sx0 + i * (slotW + 10)
    const y = 1012
    const active = ws.current === id
    ctx.fillStyle = active ? 'rgba(232,121,249,0.18)' : 'rgba(15,23,42,0.7)'
    ctx.fillRect(x, y, slotW, 48)
    ctx.strokeStyle = active ? def.color : 'rgba(148,163,184,0.35)'
    ctx.lineWidth = active ? 3 : 1
    ctx.strokeRect(x, y, slotW, 48)
    ctx.fillStyle = def.color
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${i + 1}`, x + 8, y + 18)
    ctx.fillStyle = active ? '#f8fafc' : '#94a3b8'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText(def.name, x + 24, y + 20)
    ctx.font = '12px sans-serif'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(`${def.heat} heat · ${(1 / def.cooldown).toFixed(1)}/s`, x + 24, y + 38)
  })

  if (gs.noticeTimer > 0) {
    ctx.globalAlpha = Math.min(1, gs.noticeTimer * 2)
    ctx.textAlign = 'center'
    ctx.font = 'bold 22px sans-serif'
    ctx.fillStyle = '#fca5a5'
    ctx.fillText(gs.notice, VIEW_W / 2, 930)
    ctx.globalAlpha = 1
  }

  if (gs.waveIntro > 0 && !gs.over) {
    ctx.globalAlpha = Math.min(1, gs.waveIntro * 1.5)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#e879f9'
    ctx.shadowColor = '#e879f9'
    ctx.shadowBlur = 30
    ctx.font = 'bold 84px sans-serif'
    ctx.fillText(`WAVE ${gs.wave}`, VIEW_W / 2, 620)
    if (gs.boss) {
      ctx.fillStyle = '#f87171'
      ctx.shadowColor = '#f87171'
      ctx.font = 'bold 40px sans-serif'
      ctx.fillText('⚠ THE CONDUCTOR ⚠', VIEW_W / 2, 684)
    }
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }
}

export function render(ctx: CanvasRenderingContext2D, gs: GameState, stars: Star[]) {
  drawBackground(ctx, gs, stars)

  ctx.save()
  if (gs.fx.shake > 0) {
    const m = gs.fx.shakeMag * Math.min(1, gs.fx.shake / 0.2)
    ctx.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m)
  }
  drawMarkers(ctx, gs)
  for (const b of gs.bunkers) drawBunker(ctx, gs, b)
  drawBeams(ctx, gs)
  drawBarriers(ctx, gs)
  for (const inv of gs.grid.invaders) if (inv.alive) drawInvader(ctx, gs, inv)
  if (gs.boss) drawBoss(ctx, gs, gs.boss)
  drawUfo(ctx, gs)
  drawShots(ctx, gs)
  drawPlayer(ctx, gs)
  drawEffects(ctx, gs)
  ctx.restore()

  if (gs.fx.damage > 0) {
    const a = (gs.fx.damage / DAMAGE_LIFE) * 0.5
    const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.65)
    v.addColorStop(0, 'rgba(239,68,68,0)')
    v.addColorStop(1, `rgba(239,68,68,${a})`)
    ctx.fillStyle = v
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  }
  if (gs.fx.flash > 0) {
    ctx.fillStyle = `rgba(${gs.fx.flashColor},${(gs.fx.flash / FLASH_LIFE) * 0.25})`
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  }

  drawHud(ctx, gs)
}

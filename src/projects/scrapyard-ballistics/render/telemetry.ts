// Flight rendering (SPEC.md section 10): a green-phosphor wireframe of the
// rig in a camera that follows the main craft with local "up" (away from
// the planet) pointing up the screen; sky fading to black with altitude;
// clouds and the launch pad for a sense of speed; flickering exhaust;
// chute canopies; blast rings. Plus the orbit map (minimap or full screen).
import type { FlightSim, FlightPart } from '../flight'
import { PPM } from '../structure'
import { ATMOSPHERE_TOP, heatFlux } from '../atmosphere'
import { PLANET_RADIUS, conicPoints } from '../orbit'
import { WIREFRAME_STYLE, drawPartArt, type ArtStyle } from './partArt'

const DEBRIS_STYLE: ArtStyle = { ...WIREFRAME_STYLE, stroke: '#4f9e70', accent: '#a0703a' }

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function mix(a: number[], b: number[], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

export interface FlightDrawOptions {
  time: number // wall-clock seconds, for flicker
  zoom: number // user zoom multiplier
}

export function drawFlight(ctx: CanvasRenderingContext2D, w: number, h: number, sim: FlightSim, o: FlightDrawOptions) {
  const alt = sim.altitude
  // --- Sky ---
  const t = Math.min(1, Math.max(0, alt / 45_000))
  const top = mix([40, 95, 160], [2, 3, 10], Math.min(1, t * 1.4))
  const bottom = mix([120, 175, 225], [5, 8, 20], t)
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, top)
  sky.addColorStop(1, bottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  // Darken the whole thing toward the CRT look.
  ctx.fillStyle = 'rgba(0,12,6,0.45)'
  ctx.fillRect(0, 0, w, h)

  // Camera: rotate so local up is screen-up, scale to fit the rig.
  const up = sim.localUp
  const camAngle = -Math.PI / 2 - Math.atan2(up.y, up.x)
  let extent = 4
  for (const p of sim.parts.values()) {
    if (!p.alive || !p.main) continue
    extent = Math.max(extent, Math.hypot(p.rp.body.position.x, p.rp.body.position.y) / PPM + 1)
  }
  const scale = Math.max(4, Math.min(48, (Math.min(w, h) * 0.3) / extent)) * o.zoom
  const shake = Math.min(6, sim.q / 6000 + sim.maxStressRatio * 3) * (sim.status === 'flying' ? 1 : 0)
  const sx = (Math.random() - 0.5) * shake
  const sy = (Math.random() - 0.5) * shake

  // Stars fade in above ~25 km.
  if (alt > 20_000) {
    const a = Math.min(1, (alt - 20_000) / 30_000)
    ctx.fillStyle = `rgba(210,255,225,${0.7 * a})`
    for (let i = 0; i < 90; i++) {
      ctx.fillRect(hash(i) * w, hash(i + 500) * h, 1.3, 1.3)
    }
  }

  // Ground, clouds and pad are drawn in screen space (local up = screen
  // up) before the rig itself.

  drawSurface(ctx, w, h, sim, scale, sx, sy)

  ctx.save()
  ctx.translate(w / 2 + sx, h * 0.52 + sy)
  ctx.rotate(camAngle)
  ctx.scale(scale, scale)

  // Re-entry plasma sheath.
  const flux = heatFlux(alt, sim.speed)
  if (flux > 0.25 && alt < ATMOSPHERE_TOP) {
    const v = { x: sim.frame.v.x, y: -sim.frame.v.y }
    const vm = Math.hypot(v.x, v.y) || 1
    const ahead = { x: (v.x / vm) * extent * 0.8, y: (v.y / vm) * extent * 0.8 }
    const g = ctx.createRadialGradient(ahead.x, ahead.y, 0, ahead.x, ahead.y, extent * 1.6)
    const a = Math.min(0.7, (flux - 0.25) * 0.8)
    g.addColorStop(0, `rgba(255,170,80,${a})`)
    g.addColorStop(1, 'rgba(255,80,40,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(ahead.x, ahead.y, extent * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }

  const jitter = Math.min(0.08, sim.q / 200_000 + sim.maxStressRatio * 0.04)
  for (const p of sim.parts.values()) {
    if (!p.alive) continue
    drawPartBody(ctx, p, o.time, jitter, sim)
  }

  // Blasts
  for (const b of sim.blasts) {
    const k = b.age / 0.9
    ctx.strokeStyle = `rgba(255,200,90,${1 - k})`
    ctx.lineWidth = 0.15
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.size * (0.5 + k * 3), 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = `rgba(255,120,40,${(1 - k) * 0.5})`
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.size * (0.3 + k * 1.5), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // Prograde marker (velocity direction) around the craft.
  if (sim.speed > 3) {
    const v = { x: sim.frame.v.x, y: -sim.frame.v.y }
    const ang = Math.atan2(v.y, v.x) + camAngle
    const r = Math.min(w, h) * 0.36
    const px = w / 2 + Math.cos(ang) * r
    const py = h * 0.52 + Math.sin(ang) * r
    ctx.strokeStyle = 'rgba(255,230,120,0.8)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(px, py, 7, 0, Math.PI * 2)
    ctx.moveTo(px - 13, py)
    ctx.lineTo(px - 7, py)
    ctx.moveTo(px + 7, py)
    ctx.lineTo(px + 13, py)
    ctx.moveTo(px, py - 7)
    ctx.lineTo(px, py - 13)
    ctx.stroke()
  }

  // Scanlines + phosphor vignette.
  ctx.fillStyle = 'rgba(0,0,0,0.13)'
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)
}

// Ground, launch pad and clouds, drawn in screen space with local-up =
// screen-up. Positions come from altitude and downrange distance relative
// to the craft, so they scroll past as it flies.
function drawSurface(ctx: CanvasRenderingContext2D, w: number, h: number, sim: FlightSim, scale: number, sx: number, sy: number) {
  const alt = sim.altitude
  const cx = w / 2 + sx
  const cy = h * 0.52 + sy
  const downrange = sim.downrange

  // Clouds between 1 and 9 km, placed on a fixed surface lattice.
  if (alt < 16_000) {
    const cell = 700
    const first = Math.floor((downrange - (w / 2 / scale) - 2000) / cell)
    const last = Math.ceil((downrange + (w / 2 / scale) + 2000) / cell)
    for (let i = first; i <= last && i - first < 400; i++) {
      for (let layer = 0; layer < 3; layer++) {
        const seed = i * 7 + layer * 1301
        if (hash(seed) > 0.35) continue
        const cAlt = 1200 + layer * 2600 + hash(seed + 1) * 1800
        const x = cx + (i * cell + hash(seed + 2) * cell - downrange) * scale
        const y = cy + (alt - cAlt) * scale
        if (y < -200 || y > h + 200 || x < -400 || x > w + 400) continue
        const len = (120 + hash(seed + 3) * 260) * scale
        ctx.strokeStyle = 'rgba(190,255,215,0.25)'
        ctx.lineWidth = Math.max(1, Math.min(4, scale * 6))
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + len, y)
        ctx.moveTo(x + len * 0.15, y - Math.max(2, scale * 14))
        ctx.lineTo(x + len * 0.8, y - Math.max(2, scale * 14))
        ctx.stroke()
      }
    }
  }

  // Ground
  const groundY = cy + alt * scale
  if (groundY < h + 50) {
    const ocean = sim.isOcean()
    ctx.fillStyle = ocean ? 'rgba(20,70,110,0.9)' : 'rgba(30,60,25,0.95)'
    ctx.fillRect(0, groundY, w, h - groundY + 60)
    ctx.strokeStyle = ocean ? '#6fc3ff' : '#8ce99a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, groundY)
    ctx.lineTo(w, groundY)
    ctx.stroke()
    // Fence posts every 5 m (the neighbor's fence!) for low-altitude speed.
    if (scale > 3) {
      ctx.strokeStyle = 'rgba(160,230,180,0.5)'
      ctx.lineWidth = 1
      const step = 5
      const first = Math.floor((downrange - w / 2 / scale) / step)
      for (let i = first; i < first + w / (step * scale) + 2; i++) {
        const x = cx + (i * step - downrange) * scale
        ctx.beginPath()
        ctx.moveTo(x, groundY)
        ctx.lineTo(x, groundY - 1.2 * scale)
        ctx.stroke()
      }
    }
    // Launch gantry at downrange 0.
    const padX = cx - downrange * scale
    if (padX > -200 && padX < w + 200) {
      ctx.strokeStyle = '#ffd166'
      ctx.lineWidth = 1.5
      const gw = 3 * scale
      const gh = 16 * scale
      const gx = padX - 7 * scale
      ctx.strokeRect(gx - gw / 2, groundY - gh, gw, gh)
      for (let k = 0; k < 6; k++) {
        const y0 = groundY - (k / 6) * gh
        const y1 = groundY - ((k + 1) / 6) * gh
        ctx.beginPath()
        ctx.moveTo(gx - gw / 2, y0)
        ctx.lineTo(gx + gw / 2, y1)
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(255,209,102,0.3)'
      ctx.fillRect(padX - 6 * scale, groundY - 0.6 * scale, 12 * scale, 0.6 * scale)
    }
  }
}

function drawPartBody(ctx: CanvasRenderingContext2D, p: FlightPart, time: number, jitter: number, sim: FlightSim) {
  const b = p.rp.body
  const x = b.position.x / PPM + (Math.random() - 0.5) * jitter
  const y = b.position.y / PPM + (Math.random() - 0.5) * jitter
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(b.angle)

  // Exhaust plume, drawn in the part's rotated frame (nozzle = local +y).
  if (p.throttleOut > 0 && p.def.engine) {
    ctx.save()
    ctx.rotate((p.rp.rot * Math.PI) / 2)
    const vac = sim.altitude > 40_000
    const len = (0.8 + Math.sqrt(p.def.engine.thrust / 4000) * 1.2) * p.throttleOut * (vac ? 2.2 : 1) * (0.85 + Math.random() * 0.3)
    const half = p.def.h / 2
    const wid = 0.35 * (vac ? 1.6 : 1)
    const g = ctx.createLinearGradient(0, half, 0, half + len)
    g.addColorStop(0, 'rgba(255,245,200,0.95)')
    g.addColorStop(0.4, p.failure === 'hot' ? 'rgba(255,80,40,0.8)' : 'rgba(255,170,60,0.75)')
    g.addColorStop(1, 'rgba(255,90,30,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(-wid, half)
    ctx.quadraticCurveTo(-wid * 1.3, half + len * 0.4, (Math.sin(time * 40) * 0.08), half + len)
    ctx.quadraticCurveTo(wid * 1.3, half + len * 0.4, wid, half)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  const style = p.main ? WIREFRAME_STYLE : DEBRIS_STYLE
  const hot = p.def.engine ? p.heat : 0
  const glow = Math.max(hot > 0.6 ? (hot - 0.6) * 2.5 : 0, p.scorch)
  const partStyle: ArtStyle = glow > 0.05 ? { ...style, stroke: `rgb(255,${Math.round(220 - glow * 160)},${Math.round(120 - glow * 100)})` } : style
  drawPartArt(ctx, p.def, p.rp.rot, 1, { ...partStyle, lineWidth: 0.06 })
  if (p.failure) {
    // blinking fault marker
    if (Math.floor(time * 4) % 2 === 0) {
      ctx.strokeStyle = '#ff4d4d'
      ctx.lineWidth = 0.08
      ctx.strokeRect(-p.rp.w / 2, -p.rp.h / 2, p.rp.w, p.rp.h)
    }
  }
  ctx.restore()

  // Parachute canopy trails upwind of the part.
  if (p.def.chute && p.chute !== 'packed') {
    const v = { x: sim.frame.v.x, y: -sim.frame.v.y }
    const vm = Math.hypot(v.x, v.y)
    const dir = vm > 0.5 ? { x: -v.x / vm, y: -v.y / vm } : { x: 0, y: -1 }
    const open = p.chute === 'shredded' ? 0.4 : p.chuteOpen
    const dist = 2 + 5 * open
    const cxp = x + dir.x * dist
    const cyp = y + dir.y * dist
    const r = 0.6 + 3.6 * open
    const ang = Math.atan2(dir.y, dir.x)
    ctx.strokeStyle = p.chute === 'shredded' ? 'rgba(255,140,140,0.8)' : '#ffe8a3'
    ctx.lineWidth = 0.08
    ctx.beginPath()
    if (p.chute === 'shredded') {
      for (let k = 0; k < 5; k++) {
        const a = ang - 1 + k * 0.5
        ctx.moveTo(x, y)
        ctx.lineTo(cxp + Math.cos(a) * r, cyp + Math.sin(a) * r + Math.sin(time * 12 + k) * 0.3)
      }
    } else {
      ctx.arc(cxp, cyp, r, ang - Math.PI / 2, ang + Math.PI / 2)
      for (const k of [-1, -0.5, 0, 0.5, 1]) {
        const a = ang + (k * Math.PI) / 2
        ctx.moveTo(x, y)
        ctx.lineTo(cxp + Math.cos(a) * r, cyp + Math.sin(a) * r)
      }
    }
    ctx.stroke()
  }
}

// ---------------------------------------------------------------------------
// Orbit map
// ---------------------------------------------------------------------------

export function drawMap(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sim: FlightSim, full: boolean) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.fillStyle = full ? 'rgba(2,8,5,0.96)' : 'rgba(2,10,6,0.82)'
  ctx.fillRect(x, y, w, h)
  const el = sim.orbit
  const craftR = Math.hypot(sim.frame.p.x, sim.frame.p.y)
  let viewR = PLANET_RADIUS * 1.45
  if (Number.isFinite(el.apoapsis)) viewR = Math.max(viewR, (el.apoapsis + PLANET_RADIUS) * 1.1)
  viewR = Math.min(Math.max(viewR, craftR * 1.15), PLANET_RADIUS * 5)
  const s = (Math.min(w, h) / 2 - 8) / viewR
  const cx = x + w / 2
  const cy = y + h / 2
  const toScreen = (gx: number, gy: number) => ({ x: cx + gx * s, y: cy - gy * s })

  // Atmosphere + planet
  ctx.fillStyle = 'rgba(60,140,255,0.12)'
  ctx.beginPath()
  ctx.arc(cx, cy, (PLANET_RADIUS + ATMOSPHERE_TOP) * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0d2a1a'
  ctx.strokeStyle = '#7dffb0'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(cx, cy, PLANET_RADIUS * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // Ocean bands, matching FlightSim.isOcean.
  ctx.strokeStyle = 'rgba(111,195,255,0.7)'
  ctx.lineWidth = 3
  for (let i = 0; i < 360; i++) {
    const phi = (i / 360) * Math.PI * 2 - Math.PI
    if (Math.abs(phi) < 0.01 || Math.sin(phi * 9 + 0.8) <= 0.2) continue
    const a = Math.PI / 2 - phi
    ctx.beginPath()
    ctx.arc(cx, cy, PLANET_RADIUS * s - 2, -a - 0.009, -a + 0.009)
    ctx.stroke()
  }
  // Launch site
  const pad = toScreen(0, PLANET_RADIUS)
  ctx.fillStyle = '#ffd166'
  ctx.fillRect(pad.x - 2, pad.y - 2, 4, 4)

  // Trajectory conic
  const pts = conicPoints(el, full ? 360 : 180)
  ctx.strokeStyle = sim.warnings.orbit ? '#8ce99a' : '#ffd166'
  ctx.lineWidth = full ? 1.8 : 1.2
  ctx.setLineDash(sim.warnings.orbit ? [] : [5, 4])
  ctx.beginPath()
  let pen = false
  for (const p of pts) {
    if (!Number.isFinite(p.x) || Math.hypot(p.x, p.y) < PLANET_RADIUS) {
      pen = false
      continue
    }
    const q = toScreen(p.x, p.y)
    if (!pen) ctx.moveTo(q.x, q.y)
    else ctx.lineTo(q.x, q.y)
    pen = true
  }
  ctx.stroke()
  ctx.setLineDash([])

  // Ap / Pe markers
  ctx.font = `600 ${full ? 12 : 9}px ui-monospace, monospace`
  ctx.textAlign = 'center'
  const markers: [string, number, number][] = []
  if (el.bound && el.ecc > 0.001) {
    const rp = el.periapsis + PLANET_RADIUS
    const ra = el.apoapsis + PLANET_RADIUS
    markers.push(['Pe', rp * Math.cos(el.argPeri), rp * Math.sin(el.argPeri)])
    markers.push(['Ap', ra * Math.cos(el.argPeri + Math.PI), ra * Math.sin(el.argPeri + Math.PI)])
  }
  for (const [label, gx, gy] of markers) {
    if (Math.hypot(gx, gy) < PLANET_RADIUS && label === 'Pe') continue
    const q = toScreen(gx, gy)
    ctx.fillStyle = label === 'Ap' ? '#74c0fc' : '#ff8787'
    ctx.beginPath()
    ctx.arc(q.x, q.y, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillText(label, q.x, q.y - 6)
  }

  // Craft
  const c = toScreen(sim.frame.p.x, sim.frame.p.y)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(c.x, c.y, full ? 4 : 3, 0, Math.PI * 2)
  ctx.fill()
  const vm = sim.speed
  if (vm > 1) {
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(c.x, c.y)
    ctx.lineTo(c.x + (sim.frame.v.x / vm) * 12, c.y - (sim.frame.v.y / vm) * 12)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(125,255,176,0.5)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.restore()
}

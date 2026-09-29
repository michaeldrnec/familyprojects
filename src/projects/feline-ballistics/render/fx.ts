// Cosmetic effects (SPEC.md section 7): pooled particles (glints, dust,
// lint, sparks, feathers), comic popups, the Siamese sonic ring, Calico
// swipe arcs, zoomies streaks and the "cat trots off" poof. Fed from
// GameWorld events; uses Math.random freely since none of it touches the
// deterministic physics.
import type { GameEvent } from '../game/world'
import { SCREAM_RADIUS, SWIPE_RADIUS } from '../game/world'
import type { MaterialId } from '../game/materials'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  kind: 'dot' | 'glint' | 'puff' | 'feather'
  rot: number
}

interface Popup {
  x: number
  y: number
  text: string
  big: boolean
  age: number
}

interface Ring {
  x: number
  y: number
  age: number
  max: number
  radius: number
  color: string
  kind: 'ring' | 'swipe'
}

const MAX_PARTICLES = 500

const BREAK_COLORS: Partial<Record<MaterialId, string[]>> = {
  thinGlass: ['#e6f7ff', '#bfe8ff', '#ffffff'],
  glass: ['#cdeeff', '#9fd6f5', '#ffffff'],
  ceramic: ['#fffaf0', '#e9e2d0', '#6aa3ff'],
  wood: ['#c48a5a', '#8a5a36'],
  floorboard: ['#a57649', '#6b4a2f'],
  cardboard: ['#e0b67a', '#b98c55'],
  electronics: ['#ffe066', '#5fd0ff', '#ffffff'],
}

export class Fx {
  particles: Particle[] = []
  popups: Popup[] = []
  rings: Ring[] = []

  private emit(p: Omit<Particle, 'rot'>) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift()
    this.particles.push({ ...p, rot: Math.random() * Math.PI })
  }

  burst(x: number, y: number, n: number, colors: string[], speed: number, kind: Particle['kind'], size = 3, life = 0.8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.3 + Math.random() * 0.7)
      this.emit({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, life, max: life, size: size * (0.6 + Math.random() * 0.8), color: colors[i % colors.length], kind })
    }
  }

  handle(e: GameEvent) {
    switch (e.kind) {
      case 'break': {
        const colors = BREAK_COLORS[e.material.id] ?? ['#ffffff']
        const glassy = e.material.sound === 'glass'
        this.burst(e.x, e.y, glassy ? 26 : 16, colors, glassy ? 420 : 300, glassy ? 'glint' : 'dot', glassy ? 4 : 3.5, 0.9)
        this.burst(e.x, e.y, 6, ['rgba(220,220,255,0.35)'], 90, 'puff', 16, 0.9)
        if (e.material.id === 'electronics') this.burst(e.x, e.y, 14, ['#ffe066', '#ffffff'], 380, 'glint', 3, 0.5)
        if (e.precious) this.burst(e.x, e.y, 18, ['#ffd166', '#fff4c2'], 360, 'glint', 5, 1.1)
        break
      }
      case 'impact':
        if (e.strength > 0.25) {
          if (e.sound === 'fabric') this.burst(e.x, e.y, 5, ['#f2a0c0', '#e6d9ff', '#ffffff'], 120, 'feather', 5, 1.4)
          else this.burst(e.x, e.y, 4, ['rgba(220,220,255,0.4)'], 60, 'puff', 10, 0.6)
        }
        break
      case 'popup': {
        // Chain reactions fire several popups at once; stagger them upward
        // so they read as a combo instead of overprinting.
        const recent = this.popups.filter((q) => q.age < 0.35 && Math.abs(q.x - e.x) < 220).length
        this.popups.push({ x: e.x, y: e.y - recent * 46, text: e.text, big: e.big, age: 0 })
        if (this.popups.length > 12) this.popups.shift()
        break
      }
      case 'ability':
        if (e.breed === 'siamese') this.rings.push({ x: e.x, y: e.y, age: 0, max: 0.6, radius: SCREAM_RADIUS, color: '#5fb7ff', kind: 'ring' })
        else if (e.breed === 'calico') this.rings.push({ x: e.x, y: e.y, age: 0, max: 0.3, radius: SWIPE_RADIUS, color: '#ffd166', kind: 'swipe' })
        else if (e.breed === 'coon') this.burst(e.x, e.y, 10, ['#c9b39a', '#ffffff'], 200, 'puff', 12, 0.5)
        else this.burst(e.x, e.y, 12, ['#ffd27a', '#f29a3a'], 260, 'dot', 4, 0.5)
        break
      case 'swish':
        this.burst(e.x, e.y, 8, e.glide ? ['#ffffff', '#e6d9ff'] : ['#ffd27a'], 140, 'feather', 5, 0.8)
        break
      case 'grip':
        this.burst(e.x, e.y, 8, ['#ffffff', '#c29be0'], 110, 'feather', 4, 0.7)
        break
      case 'fan':
        this.rings.push({ x: e.x, y: e.y, age: 0, max: 0.4, radius: 70, color: '#ffffff', kind: 'ring' })
        break
      case 'catLeave':
        this.burst(e.x, e.y, 14, ['rgba(255,255,255,0.6)', 'rgba(255,220,180,0.6)'], 120, 'puff', 14, 0.8)
        break
      case 'bark':
        this.popups.push({ x: e.x + 40, y: e.y - 50, text: 'WOOF!', big: false, age: 0 })
        break
      case 'stir':
        this.popups.push({ x: e.x, y: e.y - 70, text: 'mmmf…', big: false, age: 0 })
        break
      default:
        break
    }
  }

  update(dt: number) {
    for (const p of this.particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      const drag = p.kind === 'puff' ? 0.9 : p.kind === 'feather' ? 0.94 : 0.985
      p.vx *= Math.pow(drag, dt * 60)
      p.vy = p.vy * Math.pow(drag, dt * 60) + (p.kind === 'puff' ? -20 : p.kind === 'feather' ? 60 : 900) * dt
      p.rot += dt * 4
    }
    this.particles = this.particles.filter((p) => p.life > 0)
    for (const q of this.popups) q.age += dt
    this.popups = this.popups.filter((q) => q.age < 1.2)
    for (const r of this.rings) r.age += dt
    this.rings = this.rings.filter((r) => r.age < r.max)
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const r of this.rings) {
      const k = r.age / r.max
      ctx.strokeStyle = r.color
      ctx.globalAlpha = 1 - k
      if (r.kind === 'ring') {
        ctx.lineWidth = 6 * (1 - k) + 1
        for (const m of [1, 0.7]) {
          ctx.beginPath()
          ctx.arc(r.x, r.y, r.radius * k * m, 0, Math.PI * 2)
          ctx.stroke()
        }
      } else {
        ctx.lineWidth = 8
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.radius, -Math.PI * 0.8 + k * 2, -Math.PI * 0.1 + k * 2)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.max)
      ctx.globalAlpha = p.kind === 'puff' ? a * 0.5 : a
      ctx.fillStyle = p.color
      if (p.kind === 'glint') {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillRect(-p.size, -p.size * 0.3, p.size * 2, p.size * 0.6)
        ctx.restore()
      } else if (p.kind === 'feather') {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(Math.sin(p.rot) * 0.8)
        ctx.beginPath()
        ctx.ellipse(0, 0, p.size, p.size * 0.35, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      } else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.kind === 'puff' ? p.size * (1.6 - a * 0.6) : p.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const q of this.popups) {
      const k = q.age / 1.2
      const pop = q.age < 0.12 ? q.age / 0.12 : 1
      const size = (q.big ? 44 : 28) * (0.6 + 0.4 * pop)
      ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4
      ctx.font = `900 ${size}px "Comic Sans MS", "Chalkboard SE", ui-rounded, system-ui, sans-serif`
      ctx.lineWidth = 6
      ctx.strokeStyle = '#1b1320'
      ctx.fillStyle = q.big ? '#ffd166' : '#ffffff'
      const y = q.y - q.age * 50
      ctx.save()
      ctx.translate(q.x, y)
      ctx.rotate(-0.08)
      ctx.strokeText(q.text, 0, 0)
      ctx.fillText(q.text, 0, 0)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }
}

export function drawAimPreview(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], power: number) {
  pts.forEach((p, i) => {
    const k = i / pts.length
    ctx.globalAlpha = 0.9 * (1 - k)
    ctx.fillStyle = power > 0.85 ? '#ffd166' : '#ffffff'
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5 - k * 3, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.globalAlpha = 1
}

// Visuals for hazards (slime, mirror walls, Trick Treats, goo, dancing
// furniture, wail rings, jelly decoys) and a small pool of particles for the
// moments: scare stars, crumbs, fizz, sparkles and poofs.
import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  RingGeometry,
  SphereGeometry,
  type Object3D,
  type Scene,
} from 'three'
import { PARTY_RADIUS } from '../sim/hazards'
import { FLOOR, cellAt, tileX, tileY, type Maze } from '../sim/maze'
import type { Hazard } from '../sim/types'
import { makeGhost } from './models'

export const WALL_H = 1.1

// --- Particles ------------------------------------------------------------

interface Particle {
  mesh: Mesh
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  gravity: number
  grow: number
}

const dot = new SphereGeometry(1, 8, 6)
const mats = new Map<string, MeshBasicMaterial>()
function mat(color: string, additive = false) {
  const key = color + (additive ? '+' : '')
  let m = mats.get(key)
  if (!m) {
    m = new MeshBasicMaterial({ color, transparent: true, depthWrite: false })
    if (additive) m.blending = AdditiveBlending
    mats.set(key, m)
  }
  return m
}

export class Particles {
  private live: Particle[] = []
  private free: Mesh[] = []
  private group = new Group()
  constructor(scene: Scene) {
    scene.add(this.group)
  }

  spawn(
    x: number,
    y: number,
    z: number,
    color: string,
    o: { count?: number; speed?: number; up?: number; size?: number; life?: number; gravity?: number; grow?: number; additive?: boolean } = {},
  ) {
    const count = o.count ?? 8
    for (let k = 0; k < count; k++) {
      if (this.live.length > 220) return
      const mesh = this.free.pop() ?? new Mesh(dot)
      mesh.material = mat(color, o.additive)
      const a = Math.random() * Math.PI * 2
      const s = (o.speed ?? 1.5) * (0.5 + Math.random() * 0.7)
      mesh.position.set(x, y, z)
      mesh.scale.setScalar(o.size ?? 0.05)
      this.group.add(mesh)
      const max = (o.life ?? 0.7) * (0.7 + Math.random() * 0.6)
      this.live.push({ mesh, vx: Math.cos(a) * s, vy: (o.up ?? 1.5) * (0.6 + Math.random() * 0.8), vz: Math.sin(a) * s, life: max, max, gravity: o.gravity ?? 4, grow: o.grow ?? 0 })
    }
  }

  // A sweet hopping from (x, z) to (tx, tz).
  arc(x: number, z: number, tx: number, tz: number, color: string) {
    const mesh = this.free.pop() ?? new Mesh(dot)
    mesh.material = mat(color)
    mesh.position.set(x, 0.5, z)
    mesh.scale.setScalar(0.08)
    this.group.add(mesh)
    const t = 0.55
    this.live.push({ mesh, vx: (tx - x) / t, vy: 3.2, vz: (tz - z) / t, life: t, max: t, gravity: 9, grow: 0 })
  }

  update(dt: number) {
    for (let k = this.live.length - 1; k >= 0; k--) {
      const p = this.live[k]
      p.life -= dt
      if (p.life <= 0) {
        this.group.remove(p.mesh)
        this.free.push(p.mesh)
        this.live.splice(k, 1)
        continue
      }
      p.vy -= p.gravity * dt
      p.mesh.position.x += p.vx * dt
      p.mesh.position.y = Math.max(0.03, p.mesh.position.y + p.vy * dt)
      p.mesh.position.z += p.vz * dt
      if (p.grow) p.mesh.scale.multiplyScalar(1 + p.grow * dt)
      p.mesh.visible = p.life / p.max > 0.08
    }
  }
}

// --- Hazards --------------------------------------------------------------

const slimeGeo = new CircleGeometry(0.45, 24)
const gooGeo = new CircleGeometry(0.52, 28)
const ringGeo = new RingGeometry(0.85, 1, 40)
const treatGeo = new OctahedronGeometry(0.15)
const bubbleGeo = new SphereGeometry(0.06, 8, 6)
const propGeo = new BoxGeometry(0.22, 0.16, 0.3)

export interface HazardView {
  root: Object3D
  update(h: Hazard, t: number): void
}

export function makeHazard(h: Hazard, m: Maze, reducedMotion: boolean): HazardView {
  const root = new Group()
  root.position.set(h.x, 0, h.y)
  switch (h.kind) {
    case 'slime': {
      const puddle = new Mesh(slimeGeo, new MeshBasicMaterial({ color: '#5eead4', transparent: true, opacity: 0.7 }))
      puddle.rotation.x = -Math.PI / 2
      puddle.position.y = 0.02
      root.add(puddle)
      return {
        root,
        update(hz, t) {
          const s = 1 + Math.sin(t * 3 + hz.id) * 0.06
          puddle.scale.set(s, 1 / s, 1)
          ;(puddle.material as MeshBasicMaterial).opacity = 0.7 * Math.min(1, hz.t / 1.5)
        },
      }
    }
    case 'mirror': {
      const x = tileX(m, h.tile)
      const y = tileY(m, h.tile)
      const ew = cellAt(m, x - 1, y) === FLOOR || cellAt(m, x + 1, y) === FLOOR
      const mirrorMat = new MeshStandardMaterial({ color: '#f5d0fe', emissive: '#86198f', emissiveIntensity: 0.3, metalness: 0.85, roughness: 0.15, transparent: true, opacity: 0.8 })
      const pane = new Mesh(new BoxGeometry(ew ? 0.14 : 1, WALL_H, ew ? 1 : 0.14), mirrorMat)
      pane.position.y = WALL_H / 2
      root.add(pane)
      return {
        root,
        update(hz, t) {
          mirrorMat.emissiveIntensity = 0.25 + 0.15 * Math.sin(t * 2)
          mirrorMat.opacity = 0.8 * Math.min(1, hz.t / 1)
        },
      }
    }
    case 'trick': {
      const gem = new Mesh(treatGeo, new MeshLambertMaterial({ color: '#c084fc', emissive: '#a855f7', emissiveIntensity: 0.8 }))
      gem.position.y = 0.3
      root.add(gem)
      const hues = ['#f472b6', '#facc15', '#22d3ee', '#a78bfa']
      return {
        root,
        update(hz, t) {
          gem.rotation.y = t * 2
          gem.position.y = 0.3 + Math.sin(t * 3) * 0.05
          ;(gem.material as MeshLambertMaterial).emissive.set(hues[Math.floor(t * 3) % hues.length])
          gem.visible = hz.t > 1 || Math.floor(t * 8) % 2 === 0
        },
      }
    }
    case 'goo': {
      const pool = new Mesh(gooGeo, new MeshBasicMaterial({ color: '#4c1d95', transparent: true, opacity: 0.9 }))
      pool.rotation.x = -Math.PI / 2
      pool.position.y = 0.025
      root.add(pool)
      const bubbles = Array.from({ length: 6 }, (_, k) => {
        const b = new Mesh(bubbleGeo, new MeshLambertMaterial({ color: '#7c3aed', emissive: '#5b21b6' }))
        const a = (k / 6) * Math.PI * 2
        b.position.set(Math.cos(a) * 0.28, 0.04, Math.sin(a) * 0.28)
        root.add(b)
        return b
      })
      return {
        root,
        update(hz, t) {
          bubbles.forEach((b, k) => b.scale.setScalar(reducedMotion ? 0.8 : 0.5 + ((t * 1.3 + k * 0.37) % 1)))
          ;(pool.material as MeshBasicMaterial).opacity = 0.9 * Math.min(1, hz.t / 1)
        },
      }
    }
    case 'party': {
      const colors = ['#a16207', '#7c2d12', '#57534e', '#9a3412']
      const props = Array.from({ length: 7 }, (_, k) => {
        const p = new Mesh(propGeo, new MeshLambertMaterial({ color: colors[k % colors.length] }))
        root.add(p)
        return p
      })
      const ring = new Mesh(ringGeo, new MeshBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.25, side: DoubleSide }))
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.03
      ring.scale.setScalar(PARTY_RADIUS)
      root.add(ring)
      return {
        root,
        update(_hz, t) {
          props.forEach((p, k) => {
            const a = t * (0.9 + (k % 3) * 0.25) + (k / props.length) * Math.PI * 2
            const r = 1 + (k % 3) * 0.6
            p.position.set(Math.cos(a) * r, 0.6 + Math.sin(t * 2 + k) * 0.3, Math.sin(a) * r)
            p.rotation.set(t * 1.5 + k, t + k, 0)
          })
        },
      }
    }
    case 'wail': {
      const rings = [0, 1, 2].map(() => {
        const r = new Mesh(ringGeo, new MeshBasicMaterial({ color: '#fdba74', transparent: true, opacity: 0.6, side: DoubleSide }))
        r.position.y = 0.7
        root.add(r)
        return r
      })
      return {
        root,
        update(_hz, t) {
          rings.forEach((r, k) => {
            const p = (t * 0.8 + k / 3) % 1
            r.scale.setScalar(0.3 + p * 2.5)
            r.lookAt(r.position.x, r.position.y + 1, r.position.z)
            ;(r.material as MeshBasicMaterial).opacity = 0.6 * (1 - p)
          })
        },
      }
    }
    case 'decoy': {
      const jelly = makeGhost('#86efac', 1.3)
      jelly.root.scale.setScalar(0.7)
      jelly.mat.opacity = 0.75
      root.add(jelly.root)
      return {
        root,
        update(_hz, t) {
          jelly.root.scale.set(0.7 + Math.sin(t * 9) * 0.04, 0.7 - Math.sin(t * 9) * 0.04, 0.7)
          jelly.root.rotation.y = t
        },
      }
    }
  }
}

// A soft glow sprite-ish disc, used for wisps and the active ghost's ring.
export function glowDisc(color: string, radius: number) {
  const disc = new Mesh(new CircleGeometry(radius, 28), new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }))
  disc.rotation.x = -Math.PI / 2
  return disc
}

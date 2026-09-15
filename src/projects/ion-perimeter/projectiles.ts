// Physical projectiles (Pulse Cannon slugs, Flak shells) plus the short-
// lived firing effects for beam towers (Laser Lance, Railgun) and the Ion
// Disruptor's chain arcs. Kept as pure step functions -- like the other
// canvas games' physics.ts modules -- with damage application itself left
// to the caller (IonPerimeter.tsx), since applying damage touches shields,
// armor, kill credit, and score all at once.
import { VIEW_WIDTH, VIEW_HEIGHT } from './path'

export interface Projectile {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  targetId: number
  aimX: number // where the target was when this shot was fired
  aimY: number
  damage: number
  splashRadius: number
  ignoresArmor: boolean
  color: string
  radius: number
}

export interface ProjectileImpact {
  x: number
  y: number
  targetId: number | null // null if the original target died in flight (splash-only impact)
  damage: number
  splashRadius: number
  ignoresArmor: boolean
}

export function fireProjectile(
  id: number,
  fromX: number,
  fromY: number,
  aimX: number,
  aimY: number,
  targetId: number,
  speed: number,
  damage: number,
  splashRadius: number,
  ignoresArmor: boolean,
  color: string,
): Projectile {
  const dx = aimX - fromX
  const dy = aimY - fromY
  const dist = Math.hypot(dx, dy) || 1
  return {
    id,
    x: fromX,
    y: fromY,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    targetId,
    aimX,
    aimY,
    damage,
    splashRadius,
    ignoresArmor,
    color,
    radius: splashRadius > 0 ? 4 : 3,
  }
}

const BOUNDS_MARGIN = 60

export function stepProjectiles(
  projectiles: Projectile[],
  dt: number,
  findTarget: (id: number) => { x: number; y: number; radius: number } | null,
): { alive: Projectile[]; impacts: ProjectileImpact[] } {
  const alive: Projectile[] = []
  const impacts: ProjectileImpact[] = []
  for (const p of projectiles) {
    const speed = Math.hypot(p.vx, p.vy)
    const step = speed * dt
    const target = findTarget(p.targetId)
    let vx = p.vx
    let vy = p.vy
    if (target) {
      const dx = target.x - p.x
      const dy = target.y - p.y
      const dist = Math.hypot(dx, dy)
      if (dist <= Math.max(step, target.radius + 5)) {
        impacts.push({ x: target.x, y: target.y, targetId: p.targetId, damage: p.damage, splashRadius: p.splashRadius, ignoresArmor: p.ignoresArmor })
        continue
      }
      // Home toward the target's current position every frame (constant
      // speed, re-aimed direction) rather than flying a fixed line toward
      // where it was at fire time -- at these speeds a live enemy easily
      // drifts outside the hit radius of a stale aim point before a
      // straight-line shot arrives, so a "fire and forget" ballistic would
      // whiff most shots against anything but a stationary target.
      if (dist > 0) {
        vx = (dx / dist) * speed
        vy = (dy / dist) * speed
      }
    } else {
      const distToAim = Math.hypot(p.aimX - p.x, p.aimY - p.y)
      if (distToAim <= step) {
        if (p.splashRadius > 0) {
          impacts.push({ x: p.aimX, y: p.aimY, targetId: null, damage: p.damage, splashRadius: p.splashRadius, ignoresArmor: p.ignoresArmor })
        }
        continue
      }
    }
    const nx = p.x + vx * dt
    const ny = p.y + vy * dt
    if (nx < -BOUNDS_MARGIN || nx > VIEW_WIDTH + BOUNDS_MARGIN || ny < -BOUNDS_MARGIN || ny > VIEW_HEIGHT + BOUNDS_MARGIN) continue
    alive.push({ ...p, x: nx, y: ny, vx, vy })
  }
  return { alive, impacts }
}

// Brief firing visuals for beam towers (a flash line) and the Ion
// Disruptor's chain (a polyline through every enemy the chain touched).
// Both just age out -- see explosions.ts for the same pattern.
export interface BeamFx {
  id: number
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  life: number
  maxLife: number
}

export interface ChainFx {
  id: number
  points: { x: number; y: number }[]
  color: string
  life: number
  maxLife: number
}

export function stepFx<T extends { life: number }>(items: T[], dt: number): T[] {
  const out: T[] = []
  for (const item of items) {
    const life = item.life - dt
    if (life > 0) out.push({ ...item, life })
  }
  return out
}

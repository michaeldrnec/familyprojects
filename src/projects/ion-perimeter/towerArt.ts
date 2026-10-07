// Tower rendering and upgrade effects. Each tower type gets its own
// silhouette (base plate shape + turret), and both stat tiers and the tier-3
// branch visibly change the hardware -- more barrels, lenses, tubes, orbiting
// nodes, rail coils -- so a glance at the map tells you what a pad is and how
// far it has been invested in, not just its color.
import { TOWER_DEFS, towerStats, type TowerInstance, type TowerId, type BranchId } from './towers'
import type { Rng } from './rng'

const TAU = Math.PI * 2
const HULL = 'rgba(8,12,20,0.94)'
const HULL_LIGHT = '#131c2e'

export const BRANCH_COLORS: Record<BranchId, string> = { a: '#fbbf24', b: '#f472b6' }

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export function towerSize(tier: number): number {
  return 13 + tier * 2.5
}

// Base plate shape per type: polygon side count (0 = circle) and rotation.
const BASE_SHAPE: Record<TowerId, { sides: number; rot: number }> = {
  cannon: { sides: 4, rot: Math.PI / 4 },
  laser: { sides: 3, rot: -Math.PI / 2 },
  flak: { sides: 8, rot: Math.PI / 8 },
  disruptor: { sides: 0, rot: 0 },
  railgun: { sides: 6, rot: 0 },
}

function shapePath(ctx: CanvasRenderingContext2D, sides: number, rot: number, r: number) {
  ctx.beginPath()
  if (sides === 0) {
    ctx.arc(0, 0, r, 0, TAU)
    return
  }
  for (let i = 0; i < sides; i++) {
    const a = rot + (TAU / sides) * i
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath()
}

function vertices(sides: number, rot: number, r: number): { x: number; y: number }[] {
  const n = sides === 0 ? 6 : sides
  const out = []
  for (let i = 0; i < n; i++) {
    const a = rot + (TAU / n) * i
    out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r })
  }
  return out
}

function drawBase(ctx: CanvasRenderingContext2D, tower: TowerInstance, color: string, size: number, t: number) {
  const { sides, rot } = BASE_SHAPE[tower.defId]

  // Tier 3: a pulsing aura under the platform.
  if (tower.tier >= 2) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3 + tower.id)
    const r = size * 2
    const g = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, r)
    g.addColorStop(0, withAlpha(color, 0.16 + 0.12 * pulse))
    g.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, TAU)
    ctx.fill()
  }

  ctx.shadowColor = color
  ctx.shadowBlur = 8 + tower.fxTimer * 40
  shapePath(ctx, sides, rot, size)
  ctx.fillStyle = HULL
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.shadowBlur = 0

  shapePath(ctx, sides, rot, size * 0.72)
  ctx.strokeStyle = withAlpha(color, 0.3)
  ctx.lineWidth = 1
  ctx.stroke()

  // Tier 2+: armor studs bolted onto each corner of the plate.
  if (tower.tier >= 1) {
    ctx.fillStyle = color
    for (const v of vertices(sides, sides === 0 ? t * 0.5 : rot, size)) {
      ctx.beginPath()
      ctx.arc(v.x, v.y, 2.4, 0, TAU)
      ctx.fill()
    }
  }

  // Tier 3: a slowly spinning targeting ring.
  if (tower.tier >= 2) {
    ctx.save()
    ctx.rotate(t * 0.8)
    ctx.setLineDash([4, 5])
    ctx.strokeStyle = withAlpha(color, 0.7)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(0, 0, size + 6, 0, TAU)
    ctx.stroke()
    ctx.restore()
  }

  // Specialized: three counter-rotating arcs in the branch's color.
  if (tower.branch) {
    ctx.save()
    ctx.rotate(-t * 1.2)
    ctx.strokeStyle = BRANCH_COLORS[tower.branch]
    ctx.shadowColor = BRANCH_COLORS[tower.branch]
    ctx.shadowBlur = 6
    ctx.lineWidth = 2.2
    for (let k = 0; k < 3; k++) {
      ctx.beginPath()
      ctx.arc(0, 0, size + 10, (k * TAU) / 3, (k * TAU) / 3 + 0.9)
      ctx.stroke()
    }
    ctx.restore()
  }
}

function recoilOf(tower: TowerInstance, max: number): number {
  return Math.min(1, tower.fxTimer * 10) * max
}

function barrel(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, len: number) {
  ctx.fillStyle = HULL_LIGHT
  ctx.strokeStyle = color
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.rect(x, y - w / 2, len, w)
  ctx.fill()
  ctx.stroke()
}

function muzzleFlash(ctx: CanvasRenderingContext2D, tower: TowerInstance, color: string, x: number, y: number, r: number) {
  if (tower.fxTimer <= 0.04) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, tower.fxTimer * 12)
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = color
  ctx.shadowBlur = 14
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ctx.restore()
}

function drawCannon(ctx: CanvasRenderingContext2D, tower: TowerInstance, color: string, size: number) {
  ctx.save()
  ctx.rotate(tower.angle)
  const recoil = recoilOf(tower, 4)
  const len = size + 8 + tower.tier * 2
  if (tower.branch === 'a') {
    // Twin Barrel: paired barrels fed by a side ammo drum
    barrel(ctx, color, -recoil, -3.6, 4, len)
    barrel(ctx, color, -recoil * 0.4, 3.6, 4, len)
    ctx.fillStyle = withAlpha(color, 0.5)
    ctx.fillRect(-size * 0.7, size * 0.35, size * 0.6, size * 0.35)
    muzzleFlash(ctx, tower, color, len + 2, -3.6, 4)
    muzzleFlash(ctx, tower, color, len + 2, 3.6, 4)
  } else if (tower.branch === 'b') {
    // Overcharged Round: one fat barrel wrapped in glowing charge bands
    barrel(ctx, color, -recoil, 0, 9, len + 2)
    ctx.fillStyle = BRANCH_COLORS.b
    ctx.shadowColor = BRANCH_COLORS.b
    ctx.shadowBlur = 8
    for (let i = 0; i < 3; i++) ctx.fillRect(size * 0.55 + i * 5 - recoil, -6.5, 2, 13)
    ctx.beginPath()
    ctx.arc(len + 2 - recoil, 0, 3, 0, TAU)
    ctx.fill()
    ctx.shadowBlur = 0
    muzzleFlash(ctx, tower, color, len + 4, 0, 6)
  } else {
    const w = 4 + tower.tier
    barrel(ctx, color, -recoil, 0, w, len)
    if (tower.tier >= 1) {
      // muzzle brake
      ctx.fillStyle = color
      ctx.fillRect(len - 4 - recoil, -w / 2 - 2, 4, w + 4)
    }
    if (tower.tier >= 2) {
      // cooling fins
      ctx.strokeStyle = withAlpha(color, 0.8)
      ctx.lineWidth = 1
      for (let i = 0; i < 3; i++) {
        const x = size * 0.6 + i * 3.5 - recoil
        ctx.beginPath()
        ctx.moveTo(x, -w / 2 - 2.5)
        ctx.lineTo(x, w / 2 + 2.5)
        ctx.stroke()
      }
    }
    muzzleFlash(ctx, tower, color, len + 2, 0, 4)
  }
  // turret dome
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.5, 0, TAU)
  ctx.fillStyle = HULL_LIGHT
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(-size * 0.12, -size * 0.14, size * 0.16, 0, TAU)
  ctx.fillStyle = withAlpha(color, 0.6)
  ctx.fill()
  ctx.restore()
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x, y + r * 0.7)
  ctx.lineTo(x - r, y)
  ctx.lineTo(x, y - r * 0.7)
  ctx.closePath()
}

function drawLaser(ctx: CanvasRenderingContext2D, tower: TowerInstance, color: string, size: number, t: number) {
  ctx.save()
  ctx.rotate(tower.angle)
  const len = size + 10 + tower.tier * 2

  // emitter rod
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(size * 0.3, 0)
  ctx.lineTo(len, 0)
  ctx.stroke()

  if (tower.tier >= 1) {
    // focusing rings along the rod
    ctx.lineWidth = 1.3
    for (const f of [0.55, 0.78]) {
      ctx.beginPath()
      ctx.ellipse(len * f, 0, 1.4, 4.5, 0, 0, TAU)
      ctx.stroke()
    }
  }

  if (tower.branch === 'a') {
    // Phase Beam: a wide fork with a standing wave shimmering between prongs
    ctx.lineWidth = 2
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(0, s * size * 0.5)
      ctx.lineTo(len * 0.6, s * 8)
      ctx.lineTo(len + 2, s * 8)
      ctx.stroke()
    }
    ctx.strokeStyle = withAlpha(BRANCH_COLORS.a, 0.85)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let y = -7; y <= 7; y += 1) {
      const x = len + Math.sin(t * 14 + y * 0.9) * 2.5
      if (y === -7) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  } else if (tower.tier >= 2) {
    // side prongs
    ctx.lineWidth = 1.6
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(0, s * size * 0.45)
      ctx.lineTo(len * 0.8, s * 5)
      ctx.stroke()
    }
  }

  // body: forward-pointing arrowhead
  ctx.beginPath()
  ctx.moveTo(size * 0.75, 0)
  ctx.lineTo(-size * 0.55, size * 0.6)
  ctx.lineTo(-size * 0.25, 0)
  ctx.lineTo(-size * 0.55, -size * 0.6)
  ctx.closePath()
  ctx.fillStyle = HULL_LIGHT
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  ctx.stroke()

  // lens crystal(s)
  const charge = 0.55 + 0.45 * Math.min(1, tower.fxTimer * 10)
  ctx.shadowColor = color
  ctx.shadowBlur = 10 * charge
  ctx.fillStyle = withAlpha(color, charge)
  if (tower.branch === 'b') {
    // Focus Array: one big lens flanked by two smaller ones
    diamond(ctx, len + 1, 0, 6.5)
    ctx.fill()
    diamond(ctx, len - 6, -5.5, 3)
    ctx.fill()
    diamond(ctx, len - 6, 5.5, 3)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    diamond(ctx, len + 1, 0, 2.5)
    ctx.fill()
  } else {
    diamond(ctx, len, 0, 3.5 + tower.tier * 0.7)
    ctx.fill()
  }
  ctx.restore()
}

function drawFlak(ctx: CanvasRenderingContext2D, tower: TowerInstance, color: string, size: number, t: number) {
  ctx.save()
  ctx.rotate(tower.angle)
  const recoil = recoilOf(tower, 3)

  if (tower.branch === 'b') {
    // Proximity Fuze: a sweeping radar dish mounted behind the launcher
    ctx.save()
    ctx.translate(-size * 0.75, 0)
    ctx.rotate(t * 4)
    ctx.strokeStyle = BRANCH_COLORS.b
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 5.5, -1.1, 1.1)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(5, 0)
    ctx.stroke()
    ctx.restore()
  }

  // launcher box
  const w = size * 1.05
  const h = size * (1.1 + tower.tier * 0.1)
  ctx.fillStyle = HULL_LIGHT
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.roundRect(-w * 0.5 - recoil, -h / 2, w, h, 3)
  ctx.fill()
  ctx.stroke()

  // launch tubes: 2 -> 3 -> 4, and 6 for Cluster Charge
  const count = tower.branch === 'a' ? 6 : [2, 3, 4][tower.tier]
  const cols = count >= 4 ? 2 : 1
  const perCol = Math.ceil(count / cols)
  const tubeR = tower.branch === 'a' ? 2.2 : 2.6
  for (let c = 0; c < cols; c++) {
    const x = w * 0.5 - recoil - c * 5
    for (let i = 0; i < perCol; i++) {
      const y = perCol === 1 ? 0 : -h * 0.32 + (i * h * 0.64) / (perCol - 1)
      ctx.fillStyle = HULL_LIGHT
      ctx.fillRect(x - 2, y - tubeR - 0.8, 6 + c * 5, tubeR * 2 + 1.6)
      ctx.strokeRect(x - 2, y - tubeR - 0.8, 6 + c * 5, tubeR * 2 + 1.6)
      ctx.beginPath()
      ctx.arc(x + 4 + c * 5, y, tubeR, 0, TAU)
      ctx.fillStyle = tower.branch === 'a' ? BRANCH_COLORS.a : '#05070f'
      ctx.fill()
      ctx.stroke()
    }
  }
  // hazard stripe across the box
  ctx.fillStyle = withAlpha(color, 0.55)
  ctx.fillRect(-w * 0.5 - recoil + 3, -1.5, w * 0.45, 3)
  muzzleFlash(ctx, tower, color, w * 0.5 + 8, 0, 5)
  ctx.restore()
}

function zigzag(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seed: number) {
  const segs = 5
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  for (let i = 1; i < segs; i++) {
    const f = i / segs
    const off = Math.sin(seed * 37.1 + i * 12.7) * 3.5
    ctx.lineTo(x1 + dx * f + nx * off, y1 + dy * f + ny * off)
  }
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function drawDisruptor(ctx: CanvasRenderingContext2D, tower: TowerInstance, color: string, size: number, t: number) {
  const freeze = tower.branch === 'a'
  const reactor = tower.branch === 'b'
  const core = freeze ? '#e0f2fe' : color

  if (freeze) {
    // Deep Freeze: ice shards radiating from the coil
    ctx.save()
    ctx.rotate(t * 0.3)
    ctx.fillStyle = withAlpha('#e0f2fe', 0.75)
    for (let i = 0; i < 6; i++) {
      ctx.save()
      ctx.rotate((i * TAU) / 6)
      ctx.beginPath()
      ctx.moveTo(size * 0.45, -2)
      ctx.lineTo(size * 1.15, 0)
      ctx.lineTo(size * 0.45, 2)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    ctx.restore()
  }

  // coil windings
  ctx.strokeStyle = withAlpha(core, 0.55)
  ctx.lineWidth = 1.2
  for (let i = 0; i <= tower.tier; i++) {
    ctx.beginPath()
    ctx.arc(0, 0, size * (0.48 + i * 0.12), 0, TAU)
    ctx.stroke()
  }

  // orbiting emitter nodes: 2 -> 3 -> 4, plus an outer counter-rotating
  // ring for Chain Reactor
  const orbits: { r: number; n: number; speed: number }[] = [{ r: size * 0.85, n: 2 + tower.tier, speed: 1.4 }]
  if (reactor) orbits.push({ r: size * 1.25, n: 4, speed: -2.2 })
  const nodes: { x: number; y: number }[] = []
  for (const o of orbits) {
    if (reactor && o.speed < 0) {
      ctx.save()
      ctx.setLineDash([2, 4])
      ctx.strokeStyle = withAlpha(BRANCH_COLORS.b, 0.6)
      ctx.beginPath()
      ctx.arc(0, 0, o.r, 0, TAU)
      ctx.stroke()
      ctx.restore()
    }
    for (let i = 0; i < o.n; i++) {
      const a = t * o.speed + (i * TAU) / o.n + tower.id
      nodes.push({ x: Math.cos(a) * o.r, y: Math.sin(a) * o.r })
    }
  }
  ctx.shadowColor = core
  ctx.shadowBlur = 6
  ctx.fillStyle = core
  for (const n of nodes) {
    ctx.beginPath()
    ctx.arc(n.x, n.y, 2.6, 0, TAU)
    ctx.fill()
  }

  // central orb
  const firing = Math.min(1, tower.fxTimer * 8)
  const orbR = size * 0.36 * (1 + 0.08 * Math.sin(t * 6 + tower.id) + firing * 0.25)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, orbR)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.5, core)
  g.addColorStop(1, withAlpha(core, 0.15))
  ctx.fillStyle = g
  ctx.shadowBlur = 12 + firing * 14
  ctx.beginPath()
  ctx.arc(0, 0, orbR, 0, TAU)
  ctx.fill()
  ctx.shadowBlur = 0

  // crackling arcs from orb to every node while discharging
  if (firing > 0) {
    ctx.strokeStyle = withAlpha('#ffffff', firing)
    ctx.lineWidth = 1
    nodes.forEach((n, i) => zigzag(ctx, 0, 0, n.x, n.y, Math.floor(t * 30) + i))
  }
}

function drawRailgun(ctx: CanvasRenderingContext2D, tower: TowerInstance, color: string, size: number) {
  ctx.save()
  ctx.rotate(tower.angle)
  const stats = towerStats(tower)
  const charge = 1 - Math.min(1, tower.cooldown / stats.fireInterval)
  const recoil = recoilOf(tower, 5)
  const len = size + 16 + tower.tier * 3
  const gap = 4.5

  if (tower.tier >= 1) {
    // rear capacitor banks
    ctx.fillStyle = withAlpha(color, 0.35 + 0.5 * charge)
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.rect(-size * 0.95 - recoil, s * size * 0.35 - 3, 6, 6)
      ctx.fill()
      ctx.stroke()
    }
  }

  // breech body
  ctx.fillStyle = HULL_LIGHT
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(-size * 0.7 - recoil, -size * 0.45)
  ctx.lineTo(size * 0.35 - recoil, -size * 0.45)
  ctx.lineTo(size * 0.55 - recoil, -gap - 2)
  ctx.lineTo(size * 0.55 - recoil, gap + 2)
  ctx.lineTo(size * 0.35 - recoil, size * 0.45)
  ctx.lineTo(-size * 0.7 - recoil, size * 0.45)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // twin rails
  ctx.fillStyle = color
  for (const s of [-1, 1]) {
    ctx.fillRect(0 - recoil, s * gap - 1.25, len, 2.5)
    if (tower.branch === 'a') {
      // Penetrator Slug: spiked rail tips
      ctx.beginPath()
      ctx.moveTo(len - recoil, s * gap - 2)
      ctx.lineTo(len + 6 - recoil, s * gap * 0.4)
      ctx.lineTo(len - recoil, s * gap + 2)
      ctx.closePath()
      ctx.fillStyle = BRANCH_COLORS.a
      ctx.fill()
      ctx.fillStyle = color
    }
  }

  // charge building between the rails as the shot reloads
  if (charge > 0.05) {
    ctx.save()
    ctx.strokeStyle = withAlpha('#ffffff', 0.35 + 0.6 * charge)
    ctx.shadowColor = color
    ctx.shadowBlur = 10 * charge
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(size * 0.2 - recoil, 0)
    ctx.lineTo(size * 0.2 + (len - size * 0.2) * charge - recoil, 0)
    ctx.stroke()
    ctx.restore()
  }

  // magnetic coils
  if (tower.tier >= 2) {
    const siege = tower.branch === 'b'
    const coilColor = siege ? '#f87171' : color
    ctx.strokeStyle = coilColor
    ctx.lineWidth = siege ? 2.4 : 1.6
    if (siege) {
      ctx.shadowColor = coilColor
      ctx.shadowBlur = 6 + 8 * charge
    }
    const n = siege ? 4 : 3
    for (let i = 0; i < n; i++) {
      const x = len * (0.32 + (0.55 * i) / (n - 1)) - recoil
      ctx.strokeRect(x - 1.5, -gap - 3.5, 3, gap * 2 + 7)
    }
    ctx.shadowBlur = 0
  }
  muzzleFlash(ctx, tower, color, len + 3, 0, 6)
  ctx.restore()
}

// Rank chevrons under the platform: one per stat tier, plus a star once
// a branch is chosen.
function drawRank(ctx: CanvasRenderingContext2D, tower: TowerInstance, color: string, size: number) {
  const y = size + 9
  const count = tower.tier + 1
  const spacing = 6
  const startX = -((count - 1) * spacing) / 2 - (tower.branch ? 4 : 0)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  for (let i = 0; i < count; i++) {
    const x = startX + i * spacing
    ctx.beginPath()
    ctx.moveTo(x - 2.5, y + 1.5)
    ctx.lineTo(x, y - 1.5)
    ctx.lineTo(x + 2.5, y + 1.5)
    ctx.stroke()
  }
  if (tower.branch) {
    const sx = startX + count * spacing + 2
    ctx.fillStyle = BRANCH_COLORS[tower.branch]
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 === 0 ? 4 : 1.8
      if (i === 0) ctx.moveTo(sx + Math.cos(a) * r, y + Math.sin(a) * r)
      else ctx.lineTo(sx + Math.cos(a) * r, y + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
  }
}

export function drawTowerArt(ctx: CanvasRenderingContext2D, tower: TowerInstance, t: number, showRank = true) {
  const def = TOWER_DEFS[tower.defId]
  const size = towerSize(tower.tier)
  ctx.save()
  ctx.translate(tower.x, tower.y)
  // Brief swell right after a build/upgrade
  if (tower.pop > 0) ctx.scale(1 + tower.pop * 0.5, 1 + tower.pop * 0.5)
  drawBase(ctx, tower, def.color, size, t)
  switch (tower.defId) {
    case 'cannon':
      drawCannon(ctx, tower, def.color, size)
      break
    case 'laser':
      drawLaser(ctx, tower, def.color, size, t)
      break
    case 'flak':
      drawFlak(ctx, tower, def.color, size, t)
      break
    case 'disruptor':
      drawDisruptor(ctx, tower, def.color, size, t)
      break
    case 'railgun':
      drawRailgun(ctx, tower, def.color, size)
      break
  }
  if (showRank) drawRank(ctx, tower, def.color, size)
  ctx.restore()
}

// A throwaway instance for drawing a tower outside the map (shop icons).
export function previewTower(defId: TowerId, tier = 0, branch: BranchId | null = null): TowerInstance {
  return {
    id: 0,
    defId,
    padId: '',
    x: 0,
    y: 0,
    tier,
    branch,
    cooldown: 0,
    totalSpent: 0,
    angle: -Math.PI / 4,
    fxTimer: 0,
    fxTargetX: 0,
    fxTargetY: 0,
    pop: 0,
  }
}

// ---------------------------------------------------------------------------
// Build / upgrade / specialize effects
// ---------------------------------------------------------------------------

export type UpgradeFxKind = 'build' | 'tier' | 'branch'

export interface UpgradeFx {
  id: number
  x: number
  y: number
  color: string
  accent: string
  kind: UpgradeFxKind
  label: string
  age: number
  duration: number
  sparks: { angle: number; speed: number; size: number }[]
}

export function spawnUpgradeFx(
  rng: Rng,
  id: number,
  x: number,
  y: number,
  color: string,
  kind: UpgradeFxKind,
  label: string,
  accent = color,
): UpgradeFx {
  const count = kind === 'build' ? 10 : kind === 'tier' ? 22 : 34
  const sparks = []
  for (let i = 0; i < count; i++) {
    sparks.push({ angle: rng.range(0, TAU), speed: rng.range(25, kind === 'branch' ? 110 : 80), size: rng.range(1.2, 2.8) })
  }
  return { id, x, y, color, accent, kind, label, age: 0, duration: kind === 'build' ? 0.6 : kind === 'tier' ? 1.1 : 1.5, sparks }
}

export function stepUpgradeFx(list: UpgradeFx[], dt: number): UpgradeFx[] {
  const out: UpgradeFx[] = []
  for (const fx of list) {
    const age = fx.age + dt
    if (age < fx.duration) out.push({ ...fx, age })
  }
  return out
}

export function drawUpgradeFx(ctx: CanvasRenderingContext2D, fx: UpgradeFx) {
  const p = fx.age / fx.duration
  const ease = 1 - (1 - p) * (1 - p)
  ctx.save()
  ctx.translate(fx.x, fx.y)

  // light pillar shooting up from the platform
  if (fx.kind !== 'build') {
    const h = (fx.kind === 'branch' ? 150 : 110) * Math.min(1, p * 4)
    const w = (fx.kind === 'branch' ? 22 : 14) * (1 - p)
    const g = ctx.createLinearGradient(0, 0, 0, -h)
    g.addColorStop(0, withAlpha(fx.accent, 0.75 * (1 - p)))
    g.addColorStop(1, withAlpha(fx.accent, 0))
    ctx.fillStyle = g
    ctx.fillRect(-w / 2, -h, w, h)
  }

  // shockwave rings
  const maxR = fx.kind === 'branch' ? 80 : fx.kind === 'tier' ? 56 : 34
  ctx.shadowColor = fx.accent
  ctx.shadowBlur = 12
  for (const lag of fx.kind === 'build' ? [0] : [0, 0.18]) {
    const q = Math.max(0, (p - lag) / (1 - lag))
    if (q <= 0) continue
    ctx.strokeStyle = withAlpha(lag ? fx.color : fx.accent, 1 - q)
    ctx.lineWidth = 3.5 * (1 - q) + 0.5
    ctx.beginPath()
    ctx.arc(0, 0, 10 + q * maxR, 0, TAU)
    ctx.stroke()
  }

  // specialization: a rotating starburst flare
  if (fx.kind === 'branch') {
    ctx.save()
    ctx.rotate(p * 2.5)
    ctx.strokeStyle = withAlpha(fx.accent, 0.9 * (1 - p))
    ctx.lineWidth = 2
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8
      const r1 = 14 + ease * 10
      const r2 = 14 + ease * (i % 2 ? 34 : 52)
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1)
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2)
      ctx.stroke()
    }
    ctx.restore()
  }
  ctx.shadowBlur = 0

  // rising sparks
  for (const s of fx.sparks) {
    const d = s.speed * fx.age
    ctx.globalAlpha = Math.max(0, 1 - p)
    ctx.fillStyle = s.size > 2 ? '#ffffff' : fx.accent
    ctx.beginPath()
    ctx.arc(Math.cos(s.angle) * d, Math.sin(s.angle) * d * 0.6 - 60 * fx.age, s.size, 0, TAU)
    ctx.fill()
  }

  // floating label
  if (fx.label) {
    ctx.globalAlpha = p < 0.75 ? 1 : (1 - p) / 0.25
    ctx.font = `bold ${fx.kind === 'branch' ? 15 : 13}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(3,4,10,0.85)'
    const y = -30 - ease * 26
    ctx.strokeText(fx.label, 0, y)
    ctx.fillStyle = fx.accent
    ctx.fillText(fx.label, 0, y)
  }
  ctx.restore()
}

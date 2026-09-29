// Drawing the liquid cat (SPEC.md sections 3 and 7). The body outline is
// a smooth closed curve through the soft-body ring, so every squash and
// pour is visible; ears ride two ring particles, the face sits toward the
// head, and each breed gets its own markings clipped to the body.
import type { Breed } from '../game/breeds'
import { RING_N, catAngle, catCenter, catVelocity, type Cat } from '../game/cat'

type Pt = { x: number; y: number }
export type Face = 'focus' | 'wide' | 'smug' | 'yowl'

function smoothPath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  const n = pts.length
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const start = mid(pts[n - 1], pts[0])
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const m = mid(p, pts[(i + 1) % n])
    ctx.quadraticCurveTo(p.x, p.y, m.x, m.y)
  }
  ctx.closePath()
}

// Push ring points outward by the particle radius so the drawn fur hugs
// the collision edge rather than the particle centres.
function inflate(pts: Pt[], c: Pt, by: number): Pt[] {
  return pts.map((p) => {
    const dx = p.x - c.x
    const dy = p.y - c.y
    const d = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / d) * by, y: p.y + (dy / d) * by }
  })
}

export interface CatPose {
  pts: Pt[] // ring points in order
  center: Pt
  angle: number // head direction offset (0 = upright)
  face: Face
  loaf: boolean
  glide: boolean
  gripping: boolean
  vel: Pt
  tailPhase: number
}

export function poseFromCat(cat: Cat, time: number): CatPose {
  const vel = catVelocity(cat)
  return {
    pts: cat.ring.map((p) => ({ x: p.position.x, y: p.position.y })),
    center: catCenter(cat),
    angle: catAngle(cat),
    face: cat.face,
    loaf: cat.loaf,
    glide: cat.glide > 0,
    gripping: !!cat.grip,
    vel,
    tailPhase: time * 8 + cat.spin * 4,
  }
}

// A resting cat on the perch: a slightly squat ring with a butt wiggle
// while the player pulls back.
export function perchedPose(breed: Breed, x: number, y: number, time: number, wiggle: number, face: Face): CatPose {
  const pts: Pt[] = []
  const w = Math.sin(time * 18) * 3 * wiggle
  for (let i = 0; i < RING_N; i++) {
    const a = (i / RING_N) * Math.PI * 2
    const squat = 1 + 0.08 * Math.sin(a) // wider at the bottom
    pts.push({ x: x + Math.cos(a) * breed.radius * 1.08 + (Math.sin(a) > 0.3 ? w : 0), y: y + Math.sin(a) * breed.radius * 0.9 * squat })
  }
  return { pts, center: { x, y }, angle: 0, face, loaf: false, glide: false, gripping: false, vel: { x: 0, y: 0 }, tailPhase: time * 3 }
}

export function drawCat(ctx: CanvasRenderingContext2D, breed: Breed, pose: CatPose) {
  const body = inflate(pose.pts, pose.center, breed.particleRadius * 0.85)
  const up = { x: Math.sin(pose.angle), y: -Math.cos(pose.angle) }
  const R = breed.radius

  // Tail: from the lower back, curling away from travel.
  const tailBase = body[Math.round(RING_N * 0.2) % RING_N]
  const back = Math.hypot(pose.vel.x, pose.vel.y) > 1 ? { x: -pose.vel.x, y: -pose.vel.y } : { x: 1, y: -0.4 }
  const bl = Math.hypot(back.x, back.y) || 1
  const tx = (back.x / bl) * R * 1.3
  const ty = (back.y / bl) * R * 1.3 - R * 0.4
  const wag = Math.sin(pose.tailPhase) * R * 0.35
  ctx.strokeStyle = breed.id === 'siamese' ? breed.furDark : breed.furDark
  ctx.lineCap = 'round'
  ctx.lineWidth = breed.id === 'coon' ? R * 0.42 : R * 0.26
  ctx.beginPath()
  ctx.moveTo(tailBase.x, tailBase.y)
  ctx.quadraticCurveTo(tailBase.x + tx * 0.6 - wag, tailBase.y + ty * 0.2, tailBase.x + tx + wag, tailBase.y + ty)
  ctx.stroke()

  // Ears ride the two ring particles either side of "up".
  const earIdx = earIndices(pose)
  for (const i of earIdx) {
    const p = body[i]
    const dx = p.x - pose.center.x
    const dy = p.y - pose.center.y
    const d = Math.hypot(dx, dy) || 1
    const ox = dx / d
    const oy = dy / d
    const tip = { x: p.x + ox * R * 0.55 + up.x * R * 0.2, y: p.y + oy * R * 0.55 + up.y * R * 0.2 }
    const side = { x: -oy * R * 0.3, y: ox * R * 0.3 }
    ctx.fillStyle = breed.id === 'siamese' ? breed.furDark : breed.id === 'calico' ? '#2d2522' : breed.fur
    ctx.strokeStyle = '#1b1320'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(p.x - side.x, p.y - side.y)
    ctx.lineTo(tip.x, tip.y)
    ctx.lineTo(p.x + side.x, p.y + side.y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // Body
  smoothPath(ctx, body)
  ctx.fillStyle = breed.fur
  ctx.fill()
  ctx.save()
  smoothPath(ctx, body)
  ctx.clip()
  drawMarkings(ctx, breed, pose, up)
  // belly
  ctx.fillStyle = breed.belly
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.ellipse(pose.center.x - up.x * R * 0.35, pose.center.y - up.y * R * 0.35, R * 0.55, R * 0.4, pose.angle, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
  smoothPath(ctx, body)
  ctx.strokeStyle = '#1b1320'
  ctx.lineWidth = breed.id === 'coon' ? 4 : 3
  ctx.stroke()

  // Paws: tucked (loaf), spread (glide) or reaching (gripping).
  ctx.fillStyle = breed.belly
  ctx.strokeStyle = '#1b1320'
  ctx.lineWidth = 2
  if (pose.glide || pose.gripping) {
    for (const s of [-1, 1]) {
      const px = pose.center.x + (-up.y * s) * R * 1.15 + up.x * R * 0.1
      const py = pose.center.y + (up.x * s) * R * 1.15 + up.y * R * 0.1
      ctx.beginPath()
      ctx.ellipse(px, py, R * 0.22, R * 0.14, pose.angle, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  drawFace(ctx, breed, pose, up)
}

function earIndices(pose: CatPose): [number, number] {
  // Ring index whose rest angle is "up" (-π/2), rotated by the head angle.
  const upIdx = ((Math.round(((pose.angle - Math.PI / 2) / (Math.PI * 2)) * RING_N) % RING_N) + RING_N) % RING_N
  return [(upIdx + RING_N - 1) % RING_N, (upIdx + 1) % RING_N]
}

function drawMarkings(ctx: CanvasRenderingContext2D, breed: Breed, pose: CatPose, up: Pt) {
  const { center: c } = pose
  const R = breed.radius
  const side = { x: -up.y, y: up.x }
  if (breed.id === 'tabby') {
    ctx.strokeStyle = breed.furDark
    ctx.lineWidth = R * 0.14
    for (let k = -2; k <= 2; k++) {
      const ox = c.x + side.x * k * R * 0.38
      const oy = c.y + side.y * k * R * 0.38
      ctx.beginPath()
      ctx.moveTo(ox + up.x * R * 1.2, oy + up.y * R * 1.2)
      ctx.quadraticCurveTo(ox + side.x * R * 0.2, oy + side.y * R * 0.2, ox - up.x * R * 0.2, oy - up.y * R * 0.2)
      ctx.stroke()
    }
  } else if (breed.id === 'coon') {
    // shaggy darker saddle + ruff
    ctx.fillStyle = breed.furDark
    ctx.beginPath()
    ctx.ellipse(c.x + up.x * R * 0.6, c.y + up.y * R * 0.6, R * 1.1, R * 0.6, pose.angle, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 2
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(c.x + Math.cos(a) * R * 0.6, c.y + Math.sin(a) * R * 0.6)
      ctx.lineTo(c.x + Math.cos(a) * R * 1.3, c.y + Math.sin(a) * R * 1.3)
      ctx.stroke()
    }
  } else if (breed.id === 'siamese') {
    // points: dark face mask
    const g = ctx.createRadialGradient(c.x + up.x * R * 0.4, c.y + up.y * R * 0.4, 0, c.x + up.x * R * 0.4, c.y + up.y * R * 0.4, R * 0.7)
    g.addColorStop(0, breed.furDark)
    g.addColorStop(1, 'rgba(74,58,51,0)')
    ctx.fillStyle = g
    ctx.fillRect(c.x - R * 2, c.y - R * 2, R * 4, R * 4)
  } else {
    // calico patches
    ctx.fillStyle = '#e8883a'
    ctx.beginPath()
    ctx.ellipse(c.x + side.x * R * 0.6 + up.x * R * 0.3, c.y + side.y * R * 0.6 + up.y * R * 0.3, R * 0.6, R * 0.45, pose.angle + 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = breed.furDark
    ctx.beginPath()
    ctx.ellipse(c.x - side.x * R * 0.55 - up.x * R * 0.2, c.y - side.y * R * 0.55 - up.y * R * 0.2, R * 0.5, R * 0.4, pose.angle - 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawFace(ctx: CanvasRenderingContext2D, breed: Breed, pose: CatPose, up: Pt) {
  const R = breed.radius
  const side = { x: -up.y, y: up.x }
  const fc = { x: pose.center.x + up.x * R * 0.3, y: pose.center.y + up.y * R * 0.3 }
  const eyeGap = R * 0.34
  const face = pose.loaf ? 'focus' : pose.face
  for (const s of [-1, 1]) {
    const ex = fc.x + side.x * eyeGap * s
    const ey = fc.y + side.y * eyeGap * s
    if (face === 'smug') {
      ctx.strokeStyle = '#1b1320'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(ex, ey, R * 0.12, Math.PI * 0.15 + pose.angle, Math.PI * 0.85 + pose.angle)
      ctx.stroke()
      continue
    }
    const er = face === 'wide' || face === 'yowl' ? R * 0.17 : R * 0.13
    ctx.fillStyle = breed.eye
    ctx.strokeStyle = '#1b1320'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(ex, ey, er, face === 'focus' ? er * 0.55 : er, pose.angle, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#120c14'
    ctx.beginPath()
    const pupilW = face === 'focus' ? er * 0.22 : er * 0.55
    ctx.ellipse(ex + pose.vel.x * 0.1, ey + pose.vel.y * 0.1, pupilW, er * 0.8, pose.angle, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(ex - er * 0.3, ey - er * 0.35, er * 0.22, 0, Math.PI * 2)
    ctx.fill()
  }
  // nose + mouth
  const nx = fc.x - up.x * R * 0.18
  const ny = fc.y - up.y * R * 0.18
  ctx.fillStyle = '#ff8fa8'
  ctx.beginPath()
  ctx.arc(nx, ny, R * 0.07, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#1b1320'
  ctx.lineWidth = 2
  if (face === 'yowl') {
    ctx.fillStyle = '#4a1024'
    ctx.beginPath()
    ctx.ellipse(nx - up.x * R * 0.18, ny - up.y * R * 0.18, R * 0.12, R * 0.15, pose.angle, 0, Math.PI * 2)
    ctx.fill()
  } else {
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(nx - up.x * R * 0.08 + side.x * R * 0.07 * s, ny - up.y * R * 0.08 + side.y * R * 0.07 * s, R * 0.07, 0, Math.PI)
      ctx.stroke()
    }
  }
  // whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 1.2
  for (const s of [-1, 1]) {
    for (const k of [-0.12, 0.05]) {
      ctx.beginPath()
      ctx.moveTo(nx + side.x * R * 0.18 * s, ny + side.y * R * 0.18 * s)
      ctx.lineTo(nx + side.x * R * 0.85 * s - up.x * R * k * 2, ny + side.y * R * 0.85 * s - up.y * R * k * 2)
      ctx.stroke()
    }
  }
}

export function drawCatIcon(ctx: CanvasRenderingContext2D, breed: Breed, x: number, y: number, scale: number, time: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  drawCat(ctx, breed, perchedPose(breed, 0, 0, time, 0, 'smug'))
  ctx.restore()
}

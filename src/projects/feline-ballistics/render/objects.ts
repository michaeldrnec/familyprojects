// Drawing household objects (SPEC.md section 7): each body's own parts
// filled in its material colours, then a few prefab-specific details
// (mug handle, glass shine, monitor glow, book spines, laundry lumps) in
// the body's local frame. Precious items get a dashed gold outline *and*
// sparkles, so they read without relying on colour alone.
import type Matter from 'matter-js'
import type { GameWorld, WorldObject } from '../game/world'

const FURNITURE: Partial<Record<string, { fill: string; stroke: string }>> = {
  shelf: { fill: '#7a5a3e', stroke: '#b98d62' },
  bookcase: { fill: '#6b4b33', stroke: '#a57649' },
  counter: { fill: '#34466a', stroke: '#6f86b0' },
  fridge: { fill: '#c9d3df', stroke: '#eef3f9' },
  table: { fill: '#7a5a3e', stroke: '#b98d62' },
  desk: { fill: '#5d4a3a', stroke: '#9c7d61' },
  sofa: { fill: '#5b4a8a', stroke: '#8c7bc2' },
  bed: { fill: '#5d7fb0', stroke: '#9cbde6' },
  nightstand: { fill: '#7a5a3e', stroke: '#b98d62' },
  block: { fill: '#2f2c4a', stroke: '#4c4775' },
  dogBed: { fill: '#b0556f', stroke: '#e08aa3' },
}

function partPath(ctx: CanvasRenderingContext2D, part: Matter.Body) {
  const v = part.vertices
  ctx.beginPath()
  ctx.moveTo(v[0].x, v[0].y)
  for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y)
  ctx.closePath()
}

function bodyParts(b: Matter.Body): Matter.Body[] {
  return b.parts.length > 1 ? b.parts.slice(1) : [b]
}

export function drawObjects(ctx: CanvasRenderingContext2D, world: GameWorld, time: number, layer: 'back' | 'front') {
  for (const o of world.objects) {
    if (!o.alive || o.prefab === 'floor' || o.prefab === 'wall') continue
    const isBack = !!o.sensor || o.isStatic
    if ((layer === 'back') !== isBack) continue
    if (o.sensor) drawSensor(ctx, o, time)
    else if (o.prefab === 'dog') drawDog(ctx, o, world, time)
    else drawSolid(ctx, o, time)
  }
}

function drawSolid(ctx: CanvasRenderingContext2D, o: WorldObject, time: number) {
  const b = o.body
  const furn = FURNITURE[o.prefab]
  let fill = furn?.fill ?? o.material.fill
  let stroke = furn?.stroke ?? o.material.stroke
  if (o.husk) {
    fill = '#16181f'
    stroke = '#505866'
  }
  let alpha = 1
  if (o.prefab === 'shard') alpha = Math.min(1, o.life / 1)
  if (o.prefab === 'crumple') {
    fill = '#8a6a44'
  }
  ctx.globalAlpha = alpha
  for (const part of bodyParts(b)) {
    partPath(ctx, part)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = o.prefab === 'shard' ? 1 : 2.5
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  if (o.prefab !== 'shard' && o.prefab !== 'crumple') drawDetails(ctx, o, time)
  if (o.precious && !o.broken) drawPrecious(ctx, o, time)
}

// Details in the body's local frame (centre = body position, unrotated).
function drawDetails(ctx: CanvasRenderingContext2D, o: WorldObject, time: number) {
  const b = o.body
  const w = o.w
  const h = o.h
  ctx.save()
  ctx.translate(b.position.x, b.position.y)
  ctx.rotate(b.angle)
  ctx.lineWidth = 2
  switch (o.prefab) {
    case 'mug':
    case 'mugWorld':
      ctx.strokeStyle = o.material.stroke
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(w / 2 + 4, 0, 9, -Math.PI / 2, Math.PI / 2)
      ctx.stroke()
      ctx.fillStyle = o.prefab === 'mugWorld' ? '#ff7aa2' : '#6aa3ff'
      ctx.fillRect(-w / 2 + 4, -h / 6, w - 8, 7)
      break
    case 'wineGlass':
    case 'vase':
    case 'jar':
    case 'perfume':
    case 'spiceJar':
    case 'glassPane':
    case 'windowPane':
    case 'snowGlobe': {
      // shine streak
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-w * 0.2, -h * 0.35)
      ctx.lineTo(-w * 0.2, h * 0.1)
      ctx.stroke()
      if (o.prefab === 'spiceJar') {
        ctx.fillStyle = ['#d9643a', '#e8c13a', '#7fae3a', '#b0403a'][o.id % 4]
        ctx.fillRect(-w / 2 + 2, -h / 2 + 10, w - 4, h - 12)
        ctx.fillStyle = '#3a2a1a'
        ctx.fillRect(-w / 2, -h / 2, w, 7)
      }
      if (o.prefab === 'jar') {
        ctx.fillStyle = '#c98b4a'
        for (let k = 0; k < 3; k++) {
          ctx.beginPath()
          ctx.arc(-6 + k * 7, h * 0.2 - k * 4, 5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#e9e2d0'
        ctx.fillRect(-w / 2 - 2, -h / 2 - 2, w + 4, 8)
      }
      if (o.prefab === 'perfume') {
        ctx.fillStyle = '#ffb6d9'
        ctx.fillRect(-w / 2 + 3, -h / 2 + 12, w - 6, h - 15)
        ctx.fillStyle = '#e8c13a'
        ctx.fillRect(-5, -h / 2 - 6, 10, 8)
      }
      if (o.prefab === 'snowGlobe') {
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        for (let k = 0; k < 6; k++) ctx.fillRect(Math.sin(time + k) * 10, Math.cos(time * 0.7 + k * 2) * 10, 2, 2)
      }
      if (o.prefab === 'vase') {
        ctx.fillStyle = '#ff6f91'
        for (const dx of [-8, 0, 8]) {
          ctx.beginPath()
          ctx.arc(dx, -h / 2 - 8, 6, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.strokeStyle = '#6fbf73'
        ctx.beginPath()
        ctx.moveTo(0, -h / 2 + 4)
        ctx.lineTo(0, -h / 2 - 6)
        ctx.stroke()
      }
      break
    }
    case 'monitor':
      if (!o.husk) {
        ctx.fillStyle = '#5fd0ff'
        ctx.globalAlpha = 0.5 + 0.15 * Math.sin(time * 3 + o.id)
        ctx.fillRect(-w / 2 + 6, -h / 2 + 5, w - 12, 54)
        ctx.globalAlpha = 1
        ctx.fillStyle = '#e8f6ff'
        for (let k = 0; k < 4; k++) ctx.fillRect(-w / 2 + 12, -h / 2 + 12 + k * 10, 30 + ((o.id * 13 + k * 17) % 50), 3)
      } else if (Math.random() < 0.15) {
        ctx.fillStyle = '#ffe066'
        ctx.fillRect(-w / 4 + Math.random() * w / 2, -h / 2 + Math.random() * 50, 3, 3)
      }
      break
    case 'alarmClock':
      ctx.fillStyle = o.husk ? '#333' : '#1a1a22'
      ctx.fillRect(-w / 2 + 5, -h / 2 + 8, w - 10, h - 16)
      if (!o.husk) {
        ctx.fillStyle = '#ff4d4d'
        ctx.font = 'bold 13px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('3:15', 0, 1)
      }
      break
    case 'book':
    case 'bookFlat': {
      const colors = ['#b0403a', '#3a6ab0', '#3aa06a', '#b08a3a', '#7a3ab0']
      ctx.fillStyle = colors[o.id % colors.length]
      ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6)
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath()
      if (o.prefab === 'book') {
        ctx.moveTo(-w / 2 + 4, -h / 4)
        ctx.lineTo(w / 2 - 4, -h / 4)
      } else {
        ctx.moveTo(-w / 4, -h / 2 + 3)
        ctx.lineTo(-w / 4, h / 2 - 3)
      }
      ctx.stroke()
      break
    }
    case 'box':
      ctx.strokeStyle = '#8a6a3a'
      ctx.beginPath()
      ctx.moveTo(-w / 2, -h / 2 + 10)
      ctx.lineTo(w / 2, -h / 2 + 10)
      ctx.moveTo(0, -h / 2)
      ctx.lineTo(0, -h / 2 + 10)
      ctx.stroke()
      break
    case 'crate':
    case 'woodBlock':
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath()
      ctx.moveTo(-w / 2 + 4, -h / 2 + 4)
      ctx.lineTo(w / 2 - 4, h / 2 - 4)
      ctx.moveTo(w / 2 - 4, -h / 2 + 4)
      ctx.lineTo(-w / 2 + 4, h / 2 - 4)
      ctx.stroke()
      break
    case 'plank':
    case 'post':
    case 'cuttingBoard':
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath()
      ctx.moveTo(-w / 2 + 6, 0)
      ctx.lineTo(w / 2 - 6, 0)
      ctx.stroke()
      break
    case 'laundryBasket':
      ctx.fillStyle = '#f2a0c0'
      for (let k = 0; k < 4; k++) {
        ctx.beginPath()
        ctx.arc(-w / 2 + 18 + k * 14, -h / 2 + 12 + (k % 2) * 4, 11, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath()
        ctx.moveTo(k * 14, -h / 2 + 22)
        ctx.lineTo(k * 14, h / 2 - 6)
        ctx.stroke()
      }
      break
    case 'laundryPile':
    case 'pillow':
      ctx.fillStyle = o.prefab === 'pillow' ? '#e6d9ff' : '#f2a0c0'
      for (let k = 0; k < 3; k++) {
        ctx.beginPath()
        ctx.arc(-w / 3 + k * (w / 3), -h / 6, h / 3, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    case 'sofa':
      // decorative legs (no physics -- see objects.ts) + cushion seams
      ctx.fillStyle = '#3a2a1a'
      for (const x0 of [-w / 2 + 14, w / 2 - 14]) {
        ctx.beginPath()
        ctx.moveTo(x0 - 5, h / 2 - 40)
        ctx.lineTo(x0 + 5, h / 2 - 40)
        ctx.lineTo(x0 + 2, h / 2)
        ctx.lineTo(x0 - 2, h / 2)
        ctx.closePath()
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.moveTo(0, -h / 2 + 4)
      ctx.lineTo(0, h / 2 - 44)
      ctx.stroke()
      break
    case 'counter':
      // wooden worktop + cabinet doors
      ctx.fillStyle = '#8a6a4a'
      ctx.fillRect(-w / 2 - 6, -h / 2, w + 12, 16)
      ctx.strokeStyle = 'rgba(200,220,255,0.35)'
      for (let k = 0; k < 3; k++) {
        const x0 = -w / 2 + 14 + (k * (w - 28)) / 3
        ctx.strokeRect(x0, -h / 2 + 30, (w - 28) / 3 - 10, h - 44)
        ctx.beginPath()
        ctx.arc(x0 + (w - 28) / 3 - 24, -h / 2 + 50, 3, 0, Math.PI * 2)
        ctx.stroke()
      }
      break
    case 'nightstand':
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      for (const y0 of [-h / 2 + 20, 4]) {
        ctx.strokeRect(-w / 2 + 10, y0, w - 20, h / 2 - 20)
        ctx.fillStyle = '#e8c13a'
        ctx.fillRect(-6, y0 + h / 4 - 12, 12, 4)
      }
      break
    case 'block':
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      for (let y0 = -h / 2 + 24; y0 < h / 2; y0 += 24) {
        ctx.beginPath()
        ctx.moveTo(-w / 2, y0)
        ctx.lineTo(w / 2, y0)
        ctx.stroke()
      }
      break
    case 'fridge':
      ctx.strokeStyle = '#8e9aa8'
      ctx.beginPath()
      ctx.moveTo(-w / 2, -h / 2 + 130)
      ctx.lineTo(w / 2, -h / 2 + 130)
      ctx.stroke()
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(-w / 2 + 16, -h / 2 + 40)
      ctx.lineTo(-w / 2 + 16, -h / 2 + 100)
      ctx.moveTo(-w / 2 + 16, -h / 2 + 160)
      ctx.lineTo(-w / 2 + 16, -h / 2 + 240)
      ctx.stroke()
      break
    case 'bed':
      ctx.fillStyle = '#e8edf7'
      ctx.beginPath()
      ctx.roundRect(-w / 2 + 10, -h / 2 - 16, 110, 34, 12)
      ctx.fill()
      break
    case 'candle':
      ctx.fillStyle = `rgba(255, 200, 90, ${0.7 + 0.3 * Math.sin(time * 12 + o.id)})`
      ctx.beginPath()
      ctx.ellipse(0, -h / 2 - 7, 4, 8, 0, 0, Math.PI * 2)
      ctx.fill()
      break
  }
  ctx.restore()
}

function drawPrecious(ctx: CanvasRenderingContext2D, o: WorldObject, time: number) {
  const b = o.body.bounds
  const pad = 6
  ctx.save()
  ctx.strokeStyle = '#ffd166'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 5])
  ctx.lineDashOffset = -time * 20
  ctx.strokeRect(b.min.x - pad, b.min.y - pad, b.max.x - b.min.x + pad * 2, b.max.y - b.min.y + pad * 2)
  ctx.setLineDash([])
  // sparkles
  for (let k = 0; k < 3; k++) {
    const t = time * 1.6 + k * 2.1 + o.id
    const x = b.min.x + ((Math.sin(t * 0.7) + 1) / 2) * (b.max.x - b.min.x)
    const y = b.min.y - 8 + ((Math.cos(t) + 1) / 2) * (b.max.y - b.min.y) * 0.6
    const s = 3 + 2 * Math.sin(t * 3)
    ctx.fillStyle = '#fff4c2'
    ctx.beginPath()
    ctx.moveTo(x, y - s * 2)
    ctx.lineTo(x + s * 0.5, y - s * 0.5)
    ctx.lineTo(x + s * 2, y)
    ctx.lineTo(x + s * 0.5, y + s * 0.5)
    ctx.lineTo(x, y + s * 2)
    ctx.lineTo(x - s * 0.5, y + s * 0.5)
    ctx.lineTo(x - s * 2, y)
    ctx.lineTo(x - s * 0.5, y - s * 0.5)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function drawSensor(ctx: CanvasRenderingContext2D, o: WorldObject, time: number) {
  const b = o.body
  const w = o.w
  const h = o.h
  ctx.save()
  ctx.translate(b.position.x, b.position.y)
  if (o.sensor === 'grip') {
    if (o.prefab === 'beam') {
      ctx.fillStyle = '#6b4a2f'
      ctx.strokeStyle = '#a57649'
      ctx.lineWidth = 3
      ctx.fillRect(-w / 2, -h / 2, w, h)
      ctx.strokeRect(-w / 2, -h / 2, w, h)
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      for (let x = -w / 2 + 20; x < w / 2; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, -h / 2 + 4)
        ctx.lineTo(x + 10, h / 2 - 4)
        ctx.stroke()
      }
    } else {
      // curtain / towel: gently swaying folds
      const color = o.prefab === 'towel' ? '#e36f6f' : '#8a5ab0'
      const light = o.prefab === 'towel' ? '#ffb0b0' : '#c29be0'
      const sway = Math.sin(time * 1.3 + o.id) * 6
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(-w / 2, -h / 2)
      ctx.lineTo(w / 2, -h / 2)
      ctx.quadraticCurveTo(w / 2 + sway, 0, w / 2 + sway * 1.5, h / 2)
      ctx.lineTo(-w / 2 + sway * 1.5, h / 2)
      ctx.quadraticCurveTo(-w / 2 + sway, 0, -w / 2, -h / 2)
      ctx.fill()
      ctx.strokeStyle = light
      ctx.lineWidth = 2
      for (let k = 1; k < 4; k++) {
        const x = -w / 2 + (k * w) / 4
        ctx.beginPath()
        ctx.moveTo(x, -h / 2)
        ctx.quadraticCurveTo(x + sway, 0, x + sway * 1.5, h / 2)
        ctx.stroke()
      }
      if (o.prefab === 'towel') {
        ctx.fillStyle = '#fff'
        ctx.fillRect(-w / 2, -h / 2 + 14, w, 5)
        ctx.fillRect(-w / 2, h / 2 - 16, w, 5)
      } else {
        ctx.fillStyle = '#c9a86a'
        ctx.fillRect(-w / 2 - 10, -h / 2 - 8, w + 20, 8)
      }
    }
    // claw-mark hint
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1.5
    for (let k = 0; k < 3; k++) {
      ctx.beginPath()
      ctx.moveTo(-8 + k * 6, -10)
      ctx.lineTo(-12 + k * 6, 10)
      ctx.stroke()
    }
  } else if (o.sensor === 'fan') {
    const r = w / 2
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 8])
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    // rod to ceiling
    ctx.strokeStyle = '#9aa3b5'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -900)
    ctx.stroke()
    ctx.save()
    ctx.rotate(time * 7)
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2)
      ctx.fillStyle = '#7a5a3e'
      ctx.strokeStyle = '#b98d62'
      ctx.beginPath()
      ctx.ellipse(r * 0.5, 0, r * 0.45, 14, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
    ctx.fillStyle = '#c9d3df'
    ctx.beginPath()
    ctx.arc(0, 0, 16, 0, Math.PI * 2)
    ctx.fill()
  } else if (o.sensor === 'face') {
    // the sleeping human's head on the pillow
    ctx.fillStyle = '#f0c8a0'
    ctx.strokeStyle = '#1b1320'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.ellipse(0, 0, w * 0.35, h * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#5a3a2a'
    ctx.beginPath()
    ctx.ellipse(-w * 0.1, -h * 0.35, w * 0.33, h * 0.25, -0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#1b1320'
    ctx.beginPath()
    ctx.arc(-8, 2, 5, 0.1, Math.PI - 0.1)
    ctx.arc(10, 2, 5, 0.1, Math.PI - 0.1)
    ctx.stroke()
    drawZzz(ctx, w * 0.3, -h * 0.6, time)
  }
  ctx.restore()
}

function drawDog(ctx: CanvasRenderingContext2D, o: WorldObject, world: GameWorld, time: number) {
  const b = o.body
  const frenzy = world.dog?.state === 'frenzy'
  const dir = world.dog?.dir ?? 1
  ctx.save()
  ctx.translate(b.position.x, b.position.y + (frenzy ? Math.abs(Math.sin(time * 20)) * -6 : 0))
  ctx.scale(frenzy ? dir : 1, 1)
  ctx.fillStyle = '#c28a4a'
  ctx.strokeStyle = '#1b1320'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(-48, -20, 96, 42, 18)
  ctx.fill()
  ctx.stroke()
  // head
  ctx.beginPath()
  ctx.arc(42, -12, 20, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#7a4a2a'
  ctx.beginPath()
  ctx.ellipse(34, -24, 8, 16, frenzy ? -0.8 : 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1b1320'
  ctx.beginPath()
  ctx.arc(60, -10, 4, 0, Math.PI * 2)
  ctx.fill()
  if (frenzy) {
    ctx.beginPath()
    ctx.arc(46, -16, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ff7a9a'
    ctx.fillRect(52, 0, 10, 12)
  } else {
    ctx.strokeStyle = '#1b1320'
    ctx.beginPath()
    ctx.arc(46, -14, 4, 0.1, Math.PI - 0.1)
    ctx.stroke()
  }
  // tail
  ctx.strokeStyle = '#c28a4a'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-46, -10)
  ctx.lineTo(-60, -24 + Math.sin(time * (frenzy ? 30 : 2)) * 8)
  ctx.stroke()
  ctx.restore()
  if (!frenzy) drawZzz(ctx, b.position.x + 50, b.position.y - 50, time)
}

export function drawZzz(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  ctx.fillStyle = 'rgba(220,230,255,0.8)'
  ctx.font = 'bold 16px ui-rounded, system-ui, sans-serif'
  ctx.textAlign = 'center'
  for (let k = 0; k < 3; k++) {
    const t = (time * 0.6 + k / 3) % 1
    ctx.globalAlpha = 1 - t
    ctx.fillText('z', x + t * 20 + k * 4, y - t * 40)
  }
  ctx.globalAlpha = 1
}

// Camera (SPEC.md section 7): fits the whole room while aiming, follows
// the cat with velocity look-ahead in flight, eases back afterwards. A
// "peek" flag forces the fit view so the player can scout.
import type { GameWorld } from '../game/world'
import { catCenter, catVelocity } from '../game/cat'

export class Camera {
  x = 0 // world point at the screen centre
  y = 0
  zoom = 1 // screen px per world unit
  shake = 0
  private init = false

  fit(world: GameWorld, w: number, h: number) {
    const L = world.level
    const zoom = Math.min(w / (L.width + 80), h / (L.height + 40))
    return { x: L.width / 2, y: L.height - h / zoom / 2 + 10, zoom }
  }

  update(world: GameWorld, w: number, h: number, dt: number, peek: boolean, reducedMotion: boolean) {
    const fit = this.fit(world, w, h)
    let tx = fit.x
    let ty = fit.y
    let tz = fit.zoom
    const cat = world.cat
    if (!peek && cat && cat.state !== 'gone') {
      const c = catCenter(cat)
      const v = catVelocity(cat)
      tz = Math.min(fit.zoom * 1.45, 1.6)
      const halfW = w / tz / 2
      const halfH = h / tz / 2
      tx = c.x + v.x * 8
      ty = c.y + v.y * 5
      // Stay within the room horizontally and never show below the floor.
      tx = Math.max(halfW - 40, Math.min(world.level.width + 40 - halfW, tx))
      ty = Math.min(world.level.height + 10 - halfH, ty)
    }
    if (!this.init) {
      this.x = tx
      this.y = ty
      this.zoom = tz
      this.init = true
    }
    const k = 1 - Math.pow(0.02, dt)
    this.x += (tx - this.x) * k
    this.y += (ty - this.y) * k
    this.zoom += (tz - this.zoom) * k
    this.shake = reducedMotion ? 0 : Math.max(0, this.shake - dt * 30)
  }

  addShake(amount: number) {
    this.shake = Math.min(14, Math.max(this.shake, amount))
  }

  apply(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0
    ctx.translate(w / 2 + sx, h / 2 + sy)
    ctx.scale(this.zoom, this.zoom)
    ctx.translate(-this.x, -this.y)
  }

  toWorld(px: number, py: number, w: number, h: number) {
    return { x: (px - w / 2) / this.zoom + this.x, y: (py - h / 2) / this.zoom + this.y }
  }
}

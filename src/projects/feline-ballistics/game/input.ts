// Gesture recognizer (SPEC.md section 3). Pure: pointer samples in, game
// gestures out, so the thresholds can be checked headlessly. Two modes:
//   aim    -- a drag anywhere pulls back the slingshot (opposite direction)
//   flight -- tap / hold / swipe become reflexes
export const TAP_MAX_MS = 180
export const MOVE_SLOP_PX = 12
export const SWIPE_MIN_PX = 40
export const SWIPE_MAX_MS = 250
export const AIM_FULL_PULL_PX = 170

export type Gesture =
  | { kind: 'aim'; angle: number; power: number }
  | { kind: 'launch'; angle: number; power: number }
  | { kind: 'aimCancel' }
  | { kind: 'tap' }
  | { kind: 'holdStart' }
  | { kind: 'holdEnd' }
  | { kind: 'swipe'; dx: number; dy: number }

export class Gestures {
  private down: { x: number; y: number; t: number } | null = null
  private mode: 'aim' | 'flight' = 'aim'
  private holding = false
  private swiped = false
  private maxMove = 0

  setMode(mode: 'aim' | 'flight') {
    if (this.mode !== mode) {
      this.mode = mode
      this.down = null
      this.holding = false
    }
  }

  pointerDown(x: number, y: number, t: number): Gesture[] {
    this.down = { x, y, t }
    this.holding = false
    this.swiped = false
    this.maxMove = 0
    return []
  }

  private aimFrom(d: { x: number; y: number }, x: number, y: number) {
    const dx = x - d.x
    const dy = y - d.y
    const dist = Math.hypot(dx, dy)
    return { angle: Math.atan2(-dy, -dx), power: Math.min(1, dist / AIM_FULL_PULL_PX), dist }
  }

  pointerMove(x: number, y: number, t: number): Gesture[] {
    const d = this.down
    if (!d) return []
    const dist = Math.hypot(x - d.x, y - d.y)
    this.maxMove = Math.max(this.maxMove, dist)
    if (this.mode === 'aim') {
      const a = this.aimFrom(d, x, y)
      return a.dist > MOVE_SLOP_PX ? [{ kind: 'aim', angle: a.angle, power: a.power }] : []
    }
    if (!this.swiped && !this.holding && dist >= SWIPE_MIN_PX && t - d.t <= SWIPE_MAX_MS) {
      this.swiped = true
      return [{ kind: 'swipe', dx: x - d.x, dy: y - d.y }]
    }
    return []
  }

  pointerUp(x: number, y: number, t: number): Gesture[] {
    const d = this.down
    this.down = null
    if (!d) return []
    if (this.mode === 'aim') {
      const a = this.aimFrom(d, x, y)
      return a.dist > MOVE_SLOP_PX * 2 ? [{ kind: 'launch', angle: a.angle, power: a.power }] : [{ kind: 'aimCancel' }]
    }
    if (this.holding) {
      this.holding = false
      return [{ kind: 'holdEnd' }]
    }
    if (!this.swiped && t - d.t < TAP_MAX_MS && this.maxMove < MOVE_SLOP_PX) return [{ kind: 'tap' }]
    return []
  }

  // Call every frame: a finger resting still long enough becomes a hold.
  tick(t: number): Gesture[] {
    const d = this.down
    if (this.mode !== 'flight' || !d || this.holding || this.swiped) return []
    if (t - d.t >= TAP_MAX_MS && this.maxMove < MOVE_SLOP_PX) {
      this.holding = true
      return [{ kind: 'holdStart' }]
    }
    return []
  }
}

// Keyboard, mouse, gamepad, and on-screen touch buttons all merge into one
// FrameInput that the game loop reads once per frame. Held controls (move,
// fire) are levels; dash, vent, weapon cycling/selection, and pause are
// edge-triggered, so holding a button doesn't repeat the action.
import { WEAPON_ORDER, type WeaponId } from './constants'

export interface FrameInput {
  move: number // -1..1
  fire: boolean
  dash: boolean
  vent: boolean
  cycle: number // -1, 0, +1
  select: WeaponId | null
  pause: boolean
}

export type TouchHold = 'left' | 'right' | 'fire'
export type TouchTap = 'dash' | 'vent'

export interface InputController {
  attach(canvas: HTMLCanvasElement): () => void
  poll(): FrameInput
  setTouch(key: TouchHold, down: boolean): void
  tap(action: TouchTap): void
  tapSelect(id: WeaponId): void
  reset(): void
}

const STICK_DEADZONE = 0.3
// Standard-mapping gamepad button indices.
const PAD = { A: 0, B: 1, LB: 4, RB: 5, LT: 6, RT: 7, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 }
const DPAD_WEAPONS: [number, WeaponId][] = [
  [PAD.UP, 'disruptor'],
  [PAD.RIGHT, 'needle'],
  [PAD.DOWN, 'spread'],
  [PAD.LEFT, 'siege'],
]

export function createInput(): InputController {
  const held = { left: false, right: false, fire: false, mouseFire: false }
  const touch = { left: false, right: false, fire: false }
  let edges = { dash: false, vent: false, cycle: 0, select: null as WeaponId | null, pause: false }
  let padPrev: boolean[] = []
  let lastWheel = 0

  function onKeyDown(e: KeyboardEvent) {
    const key = e.key.toLowerCase()
    if (key === 'a' || key === 'arrowleft') held.left = true
    else if (key === 'd' || key === 'arrowright') held.right = true
    else if (key === ' ' || e.code === 'Space') held.fire = true
    else if (key === 'shift') {
      if (!e.repeat) edges.dash = true
    } else if (key === 'f') {
      if (!e.repeat) edges.vent = true
    } else if (key === 'q') {
      if (!e.repeat) edges.cycle = -1
    } else if (key === 'e') {
      if (!e.repeat) edges.cycle = 1
    } else if (key >= '1' && key <= '4') {
      edges.select = WEAPON_ORDER[Number(key) - 1]
    } else if (key === 'escape' || key === 'p') {
      if (!e.repeat) edges.pause = true
    } else return
    e.preventDefault()
  }

  function onKeyUp(e: KeyboardEvent) {
    const key = e.key.toLowerCase()
    if (key === 'a' || key === 'arrowleft') held.left = false
    else if (key === 'd' || key === 'arrowright') held.right = false
    else if (key === ' ' || e.code === 'Space') held.fire = false
    else return
    e.preventDefault()
  }

  function readGamepad() {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []
    const pad = Array.from(pads).find((p) => p && p.connected)
    if (!pad) {
      padPrev = []
      return { move: 0, fire: false }
    }
    const pressed = pad.buttons.map((b) => b.pressed || b.value > 0.3)
    const fresh = (i: number) => !!pressed[i] && !padPrev[i]
    if (fresh(PAD.A) || fresh(PAD.LT)) edges.dash = true
    if (fresh(PAD.B)) edges.vent = true
    if (fresh(PAD.LB)) edges.cycle = -1
    if (fresh(PAD.RB)) edges.cycle = 1
    if (fresh(PAD.START)) edges.pause = true
    for (const [btn, id] of DPAD_WEAPONS) if (fresh(btn)) edges.select = id
    padPrev = pressed
    const x = pad.axes[0] ?? 0
    return { move: Math.abs(x) > STICK_DEADZONE ? x : 0, fire: !!pressed[PAD.RT] }
  }

  function clearHeld() {
    held.left = held.right = held.fire = held.mouseFire = false
    touch.left = touch.right = touch.fire = false
  }

  return {
    attach(canvas) {
      function onPointerDown(e: PointerEvent) {
        if (e.pointerType !== 'mouse') return
        if (e.button === 0) held.mouseFire = true
        else if (e.button === 2) edges.vent = true
      }
      function onPointerUp(e: PointerEvent) {
        if (e.pointerType === 'mouse' && e.button === 0) held.mouseFire = false
      }
      function onContextMenu(e: Event) {
        e.preventDefault()
      }
      function onWheel(e: WheelEvent) {
        e.preventDefault()
        const now = performance.now()
        if (now - lastWheel < 120 || e.deltaY === 0) return
        lastWheel = now
        edges.cycle = e.deltaY > 0 ? 1 : -1
      }
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      window.addEventListener('blur', clearHeld)
      canvas.addEventListener('pointerdown', onPointerDown)
      window.addEventListener('pointerup', onPointerUp)
      canvas.addEventListener('contextmenu', onContextMenu)
      canvas.addEventListener('wheel', onWheel, { passive: false })
      return () => {
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
        window.removeEventListener('blur', clearHeld)
        canvas.removeEventListener('pointerdown', onPointerDown)
        window.removeEventListener('pointerup', onPointerUp)
        canvas.removeEventListener('contextmenu', onContextMenu)
        canvas.removeEventListener('wheel', onWheel)
      }
    },

    poll() {
      const pad = readGamepad()
      let move = (held.right || touch.right ? 1 : 0) - (held.left || touch.left ? 1 : 0)
      if (move === 0) move = pad.move
      const out: FrameInput = {
        move,
        fire: held.fire || held.mouseFire || touch.fire || pad.fire,
        ...edges,
      }
      edges = { dash: false, vent: false, cycle: 0, select: null, pause: false }
      return out
    },

    setTouch(key, down) {
      touch[key] = down
    },

    tap(action) {
      edges[action] = true
    },

    tapSelect(id) {
      edges.select = id
    },

    reset() {
      clearHeld()
      edges = { dash: false, vent: false, cycle: 0, select: null, pause: false }
    },
  }
}

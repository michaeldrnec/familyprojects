// Keyboard, mouse (pointer lock) and gamepad, read once a frame into one
// snapshot. Touch controls write into `touch` (see TouchControls.tsx) and get
// folded in here too, so the game loop only ever looks at the snapshot.
import type { CameraMode } from '../render/camera'

export interface TouchState {
  stickX: number // −1..1, right
  stickY: number // −1..1, forward
  look: number // radians to turn, accumulated
  casts: number[]
  swaps: number[]
}

export const touch: TouchState = { stickX: 0, stickY: 0, look: 0, casts: [], swaps: [] }

export interface Snapshot {
  forward: number
  right: number
  turn: number // radians this frame
  cast: number | null
  swap: number | null // ghost index
  nextGhost: boolean
  pause: boolean
}

const CAST_KEYS: Record<string, number> = { KeyQ: 0, KeyJ: 0, Space: 0, KeyE: 1, KeyK: 1, KeyR: 2, KeyL: 2 }
const SWAP_KEYS: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }
const TURN_SPEED = 2.6 // radians per second from the arrow keys
const DEAD = 0.22

export interface Controls {
  read(dt: number, mode: CameraMode): Snapshot
  dispose(): void
}

export function createControls(host: HTMLElement, getSensitivity: () => number, getMode: () => CameraMode): Controls {
  const held = new Set<string>()
  const casts: number[] = []
  let swap: number | null = null
  let nextGhost = false
  let mouseTurn = 0
  let padPrev: boolean[] = []

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea')) return
    if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault()
    held.add(e.code)
    if (e.repeat) return
    if (e.code in CAST_KEYS) casts.push(CAST_KEYS[e.code])
    if (e.code in SWAP_KEYS) swap = SWAP_KEYS[e.code]
    if (e.code === 'Tab') nextGhost = true
  }
  const onKeyUp = (e: KeyboardEvent) => held.delete(e.code)
  const onBlur = () => held.clear()
  const locked = () => document.pointerLockElement === host
  const onMouseMove = (e: MouseEvent) => {
    if (locked()) mouseTurn += e.movementX * 0.0024 * getSensitivity()
  }
  const onMouseDown = (e: MouseEvent) => {
    if (e.target !== host && !(e.target instanceof HTMLCanvasElement)) return
    if (getMode() === 'overhead') return
    if (!locked()) {
      // Only a click starts pointer lock; Esc gives the mouse back.
      try {
        void host.requestPointerLock?.()?.catch?.(() => {})
      } catch {
        // pointer lock unavailable
      }
      return
    }
    if (e.button === 0) casts.push(0)
    if (e.button === 2) casts.push(1)
  }
  const noMenu = (e: Event) => {
    if (locked()) e.preventDefault()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  document.addEventListener('mousemove', onMouseMove)
  host.addEventListener('mousedown', onMouseDown)
  host.addEventListener('contextmenu', noMenu)

  return {
    read(dt, mode) {
      const key = (...codes: string[]) => (codes.some((c) => held.has(c)) ? 1 : 0)
      let forward = key('KeyW') - key('KeyS')
      let right = key('KeyD') - key('KeyA')
      let turn = mouseTurn
      mouseTurn = 0
      if (mode === 'overhead') {
        forward += key('ArrowUp') - key('ArrowDown')
        right += key('ArrowRight') - key('ArrowLeft')
      } else {
        forward += key('ArrowUp') - key('ArrowDown')
        turn += (key('ArrowRight') - key('ArrowLeft')) * TURN_SPEED * dt
      }
      let pause = false

      // The first connected gamepad.
      const pad = navigator.getGamepads?.().find((p) => p && p.connected)
      if (pad) {
        const ax = (i: number) => (Math.abs(pad.axes[i] ?? 0) > DEAD ? pad.axes[i] : 0)
        right += ax(0)
        forward -= ax(1)
        turn += ax(2) * TURN_SPEED * dt
        const pressed = pad.buttons.map((b) => b.pressed)
        const edge = (i: number) => pressed[i] && !padPrev[i]
        if (edge(0)) casts.push(0)
        if (edge(1)) casts.push(1)
        if (edge(3)) casts.push(2)
        if (edge(5)) nextGhost = true
        if (edge(4)) swap = -1 // previous ghost
        if (edge(9)) pause = true
        padPrev = pressed
      }

      forward += touch.stickY
      right += touch.stickX
      turn += touch.look
      touch.look = 0
      casts.push(...touch.casts)
      touch.casts.length = 0
      if (touch.swaps.length) swap = touch.swaps[touch.swaps.length - 1]
      touch.swaps.length = 0

      const len = Math.hypot(forward, right)
      if (len > 1) {
        forward /= len
        right /= len
      }
      const snap: Snapshot = { forward, right, turn, cast: casts.shift() ?? null, swap, nextGhost, pause }
      casts.length = 0
      swap = null
      nextGhost = false
      return snap
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('mousemove', onMouseMove)
      host.removeEventListener('mousedown', onMouseDown)
      host.removeEventListener('contextmenu', noMenu)
      if (locked()) document.exitPointerLock?.()
    },
  }
}

// The three cameras: over the shoulder (the default with a keyboard), an
// angled overhead view (the default on touch screens, and the easiest for
// little ones) and first person. Plus turning stick/keys input into grid
// movement for whichever camera is on.
import type { PerspectiveCamera, Vector3 } from 'three'
import { WALL_H } from './effects'

export type CameraMode = 'shoulder' | 'overhead' | 'first'

export interface View {
  mode: CameraMode
  yaw: number // heading in grid terms (0 = east, π/2 = south); fixed north-up overhead
  fov: number
}

// Forward/right input (−1..1) to grid movement for the current camera.
export function moveFromInput(view: View, forward: number, right: number): { mx: number; my: number } {
  if (view.mode === 'overhead') return { mx: right, my: -forward }
  const fx = Math.cos(view.yaw)
  const fy = Math.sin(view.yaw)
  return { mx: fx * forward - fy * right, my: fy * forward + fx * right }
}

// Places the camera for the active ghost at grid (x, y), floating at height h.
// Eases toward the ideal spot so swaps and turns glide.
export function placeCamera(cam: PerspectiveCamera, view: View, x: number, y: number, h: number, dt: number, shake: Vector3) {
  const k = 1 - Math.exp(-dt * 10)
  let px: number
  let py: number
  let pz: number
  let lx: number
  let ly: number
  let lz: number
  if (view.mode === 'overhead') {
    // Taller screens (phones held upright) need to sit further back.
    const tall = Math.max(1, 1.25 / Math.max(0.4, cam.aspect))
    px = x
    py = 10 * Math.sqrt(tall)
    pz = y + 3.4 * Math.sqrt(tall)
    lx = x
    ly = 0
    lz = y + 0.2
  } else if (view.mode === 'first') {
    const fx = Math.cos(view.yaw)
    const fy = Math.sin(view.yaw)
    px = x
    py = h + 0.42
    pz = y
    lx = x + fx * 4
    ly = h + 0.2
    lz = y + fy * 4
  } else {
    const fx = Math.cos(view.yaw)
    const fy = Math.sin(view.yaw)
    px = x - fx * 2.5
    py = WALL_H + 1.25
    pz = y - fy * 2.5
    lx = x + fx * 1.8
    ly = 0.35
    lz = y + fy * 1.8
  }
  const first = view.mode === 'first'
  // First person snaps (gliding behind your own eyes is woozy).
  const ease = first ? 1 : k
  cam.position.x += (px - cam.position.x) * ease
  cam.position.y += (py - cam.position.y) * ease
  cam.position.z += (pz - cam.position.z) * ease
  cam.position.add(shake)
  const target = cam.userData.look as { x: number; y: number; z: number } | undefined
  const look = target ?? { x: lx, y: ly, z: lz }
  look.x += (lx - look.x) * ease
  look.y += (ly - look.y) * ease
  look.z += (lz - look.z) * ease
  cam.userData.look = look
  cam.lookAt(look.x, look.y, look.z)
  const fov = view.mode === 'overhead' ? 50 : view.fov
  if (Math.abs(cam.fov - fov) > 0.01) {
    cam.fov = fov
    cam.updateProjectionMatrix()
  }
}

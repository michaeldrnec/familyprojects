// A WebGL canvas that fills its parent: creates the three.js renderer,
// keeps its size (× devicePixelRatio, capped at 2) matched to the parent's,
// runs the frame loop and cleans everything up on unmount.
//
// Resizing follows the parent, not the canvas itself, so setting the
// canvas's backing size can never feed back into its CSS size (the loop
// IMPROVEMENT-PLAN item 12 found). If frames stay slow, it drops to 1×.
import { useEffect, useRef, useState } from 'react'
import { WebGLRenderer } from 'three'

export interface ThreeFrame {
  renderer: WebGLRenderer
  width: number // CSS pixels
  height: number
  dt: number
}

export function useThreeView(frame: (f: ThreeFrame) => void) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef(frame)
  frameRef.current = frame
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    } catch {
      setFailed(true)
      return
    }
    const canvas = renderer.domElement
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.touchAction = 'none'
    host.prepend(canvas)

    let maxRatio = 2
    let width = 0
    let height = 0
    const resize = () => {
      const w = Math.max(1, Math.round(host.clientWidth))
      const h = Math.max(1, Math.round(host.clientHeight))
      const ratio = Math.min(maxRatio, window.devicePixelRatio || 1)
      if (w === width && h === height && renderer.getPixelRatio() === ratio) return
      width = w
      height = h
      renderer.setPixelRatio(ratio)
      renderer.setSize(w, h, false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    let raf = 0
    let last = performance.now()
    let slow = 0
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      // Under ~45 fps for two seconds straight: render fewer pixels.
      slow = dt > 1 / 45 ? slow + dt : 0
      if (slow > 2 && maxRatio > 1) {
        maxRatio = 1
        slow = 0
        resize()
      }
      frameRef.current({ renderer, width, height, dt })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.dispose()
      canvas.remove()
    }
  }, [])

  return { hostRef, failed }
}

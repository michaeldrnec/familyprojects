// A canvas that fills its parent, redraws every animation frame, and keeps
// its backing store matched to CSS size × devicePixelRatio. The draw
// callback is read through a ref so screens can close over fresh React
// state without tearing the loop down every render.
import { useEffect, useRef } from 'react'

export type DrawFn = (ctx: CanvasRenderingContext2D, width: number, height: number, dt: number, time: number) => void

export function useCanvasLoop(draw: DrawFn) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let cssW = 0
    let cssH = 0
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cssW = rect.width
      cssH = rect.height
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const dpr = canvas.width / Math.max(1, cssW)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawRef.current(ctx, cssW, cssH, dt, now / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return canvasRef
}

// Pointer position in CSS pixels relative to the canvas.
export function pointerPos(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement | null) {
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

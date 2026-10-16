// Sharp rendering for canvases drawn in a fixed logical coordinate space
// (e.g. a 960x540 playfield) and stretched or shrunk by CSS. Without this,
// the backing store stays at the logical size, so the game looks blurry on
// high-density screens (phones, tablets, retina laptops) and whenever CSS
// scales the canvas up.
//
// useHiDpiCanvas() sizes the backing store to the canvas's real on-screen
// pixel size; scaledContext() hands back a 2D context pre-transformed so
// draw code keeps working in logical units. Games that use the fill-the-
// parent useCanvasLoop() don't need this -- it already does the same.
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

// Above 2x the extra pixels cost more fill-rate than they're visibly worth.
const MAX_SCALE = 2

const scales = new WeakMap<HTMLCanvasElement, number>()

interface Options {
  // For canvases sized by CSS `width/height: auto` (so their on-screen size
  // comes from the backing store's intrinsic size): caps the CSS size at the
  // logical size, so enlarging the backing store doesn't also enlarge the
  // canvas on the page.
  capToLogical?: boolean
}

export function useHiDpiCanvas(
  ref: RefObject<HTMLCanvasElement | null>,
  logicalW: number,
  logicalH: number,
  { capToLogical = false }: Options = {},
) {
  const setup = useRef<{ canvas: HTMLCanvasElement; w: number; h: number; ro: ResizeObserver } | null>(null)

  // Runs after every render (cheaply) so a canvas that mounts later, gets
  // swapped for a new element, or changes logical size is picked up.
  useLayoutEffect(() => {
    const canvas = ref.current
    const cur = setup.current
    if (cur && cur.canvas === canvas && cur.w === logicalW && cur.h === logicalH) return
    cur?.ro.disconnect()
    setup.current = null
    if (!canvas || logicalW <= 0 || logicalH <= 0) return
    if (capToLogical) {
      canvas.style.maxWidth = `min(100%, ${logicalW}px)`
      canvas.style.maxHeight = `min(100%, ${logicalH}px)`
    }
    const resize = () => {
      const cssW = canvas.clientWidth
      if (cssW <= 0) return
      const dpr = window.devicePixelRatio || 1
      // A CSS-auto-sized canvas never shows bigger than its logical size, so
      // device pixels alone decide the scale. Deriving it from the CSS size
      // here would loop: the rounded backing size nudges the intrinsic
      // aspect ratio, which nudges the CSS size, which resizes (and clears)
      // the canvas again every frame.
      const wanted = capToLogical ? dpr : (cssW * dpr) / logicalW
      const scale = Math.min(MAX_SCALE, Math.max(1, wanted))
      const w = Math.round(logicalW * scale)
      const h = Math.round(logicalH * scale)
      // Assigning width/height clears the canvas, so only do it on change.
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h
      scales.set(canvas, w / logicalW)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    setup.current = { canvas, w: logicalW, h: logicalH, ro }
  })

  useEffect(() => () => setup.current?.ro.disconnect(), [])
}

// The canvas's 2D context, transformed so (0,0)-(logicalW,logicalH) covers
// the whole backing store. Call at the start of every frame: resizing the
// backing store resets the context's transform.
export function scaledContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const s = scales.get(canvas) ?? 1
  ctx.setTransform(s, 0, 0, s, 0, 0)
  return ctx
}

// A pointer event's position in the canvas's logical coordinates.
export function logicalPoint(
  e: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  logicalW: number,
  logicalH: number,
) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * logicalW,
    y: ((e.clientY - rect.top) / rect.height) * logicalH,
  }
}

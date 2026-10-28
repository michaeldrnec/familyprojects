// On-screen controls for phones and tablets: a thumb stick on the left, and
// (over the shoulder or first person) drag anywhere else to look around.
// The ability buttons and ghost portraits live in the HUD and work with a
// mouse too.
import { useRef, useState, type PointerEvent } from 'react'
import { touch } from './controls'

const RADIUS = 52

export default function TouchControls({ canLook }: { canLook: boolean }) {
  const stickId = useRef<number | null>(null)
  const origin = useRef({ x: 0, y: 0 })
  const lookId = useRef<number | null>(null)
  const lookX = useRef(0)
  const [knob, setKnob] = useState<{ ox: number; oy: number; x: number; y: number } | null>(null)

  function stickDown(e: PointerEvent<HTMLDivElement>) {
    if (stickId.current !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    stickId.current = e.pointerId
    const r = e.currentTarget.getBoundingClientRect()
    origin.current = { x: e.clientX, y: e.clientY }
    setKnob({ ox: e.clientX - r.left, oy: e.clientY - r.top, x: 0, y: 0 })
  }
  function stickMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== stickId.current) return
    let dx = e.clientX - origin.current.x
    let dy = e.clientY - origin.current.y
    const d = Math.hypot(dx, dy)
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS
      dy = (dy / d) * RADIUS
    }
    touch.stickX = dx / RADIUS
    touch.stickY = -dy / RADIUS
    setKnob((k) => (k ? { ...k, x: dx, y: dy } : k))
  }
  function stickUp(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== stickId.current) return
    stickId.current = null
    touch.stickX = 0
    touch.stickY = 0
    setKnob(null)
  }

  function lookDown(e: PointerEvent<HTMLDivElement>) {
    if (!canLook || lookId.current !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    lookId.current = e.pointerId
    lookX.current = e.clientX
  }
  function lookMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== lookId.current) return
    touch.look += (e.clientX - lookX.current) * 0.009
    lookX.current = e.clientX
  }
  function lookUp(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId === lookId.current) lookId.current = null
  }

  return (
    <>
      {canLook && (
        <div className="hs-look-zone" onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} aria-hidden="true" />
      )}
      <div className="hs-stick-zone" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp} aria-hidden="true">
        {knob ? (
          <div className="hs-stick" style={{ left: knob.ox, top: knob.oy }}>
            <div className="hs-stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
          </div>
        ) : (
          <div className="hs-stick hs-stick-idle">
            <div className="hs-stick-knob" />
          </div>
        )}
      </div>
    </>
  )
}

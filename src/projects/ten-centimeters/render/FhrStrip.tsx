// One fetal heart rate strip: a live trace of the last 20 seconds of beats
// per minute over the shaded safe band (110-160), coloured by how the baby is
// doing. Green and steady is fine, yellow and jittery is a warning, red and
// dipping (or racing) means the baby's oxygen is draining.
import { useCanvasLoop } from '../../../shared/useCanvasLoop'
import { CONDITION_LABELS } from '../content'
import { FHR_HISTORY, FHR_NORMAL, HIGH_STRESS, TICK } from '../sim/config'
import { patientStatus } from '../sim/shift'
import type { Patient, ShiftState } from '../sim/types'
import { STATUS_COLORS } from './drawFloor'

const LOW = 60
const HIGH = 210

export default function FhrStrip({
  get,
  find,
  label,
  patient,
  selected,
  reducedMotion,
  onSelect,
}: {
  get: () => ShiftState | null
  find: (s: ShiftState) => Patient | undefined
  label: string
  patient: Patient | undefined
  selected: boolean
  reducedMotion: boolean
  onSelect?: () => void
}) {
  const canvasRef = useCanvasLoop((ctx, w, h, _dt, time) => {
    ctx.fillStyle = '#07101d'
    ctx.fillRect(0, 0, w, h)
    const yOf = (bpm: number) => h - ((bpm - LOW) / (HIGH - LOW)) * h
    ctx.fillStyle = 'rgba(34, 197, 94, 0.12)'
    ctx.fillRect(0, yOf(FHR_NORMAL[1]), w, yOf(FHR_NORMAL[0]) - yOf(FHR_NORMAL[1]))
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)'
    ctx.lineWidth = 1
    for (let x = w; x > 0; x -= w / 10) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    const s = get()
    const p = s ? find(s) : undefined
    if (!s || !p || p.fhrHistory.length < 2) return
    const status = patientStatus(p)
    const color = status === 'ready' ? STATUS_COLORS.normal : STATUS_COLORS[status]
    // Scroll smoothly between 10 Hz samples.
    const step = w / (FHR_HISTORY - 1)
    const shift = (s.tickAcc / TICK) * step
    const hist = p.fhrHistory
    ctx.strokeStyle = color
    ctx.lineWidth = status === 'critical' ? 2.5 : 2
    ctx.lineJoin = 'round'
    ctx.beginPath()
    for (let i = 0; i < hist.length; i++) {
      const x = w - (hist.length - 1 - i) * step - shift
      const y = yOf(hist[i])
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    if (status === 'critical') {
      ctx.fillStyle = color
      ctx.globalAlpha = reducedMotion ? 0.18 : 0.1 + 0.1 * Math.sin(time * 6)
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1
    }
  })

  const status = patient ? patientStatus(patient) : null
  const className = 'tc-strip' + (status ? ` is-${status}` : ' is-empty') + (selected ? ' is-selected' : '')
  const body = (
    <>
      <div className="tc-strip-head">
        <span className="tc-strip-bay">{label}</span>
        {patient ? (
          <>
            <span className="tc-strip-name">{patient.name}</span>
            <span className="tc-strip-cm">{patient.dilation >= 10 ? '10 cm!' : `${patient.dilation.toFixed(1)} cm`}</span>
          </>
        ) : (
          <span className="tc-strip-name tc-dim">Empty</span>
        )}
      </div>
      <canvas ref={canvasRef} className="tc-strip-trace" aria-hidden="true" />
      {patient && (
        <div className="tc-strip-foot">
          <span className="tc-bpm">♥ {Math.round(patient.fetalHeartRate)}</span>
          <span className={'tc-cond' + (patient.condition !== 'NORMAL' ? ' is-alert' : '')}>{CONDITION_LABELS[patient.condition]}</span>
          <span className={'tc-stress' + (patient.maternalStress >= HIGH_STRESS ? ' is-alert' : '')} title="Mom's stress">
            😣 {Math.round(patient.maternalStress)}
          </span>
          {patient.fetalOxygen < 99.5 && <span className="tc-o2">O₂ {Math.round(patient.fetalOxygen)}%</span>}
        </div>
      )}
    </>
  )
  return onSelect ? (
    <button type="button" className={className} onClick={onSelect} aria-pressed={selected}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  )
}

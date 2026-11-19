// The procedure panel: the delivery or Code Stork mini-game, over the floor
// and action bar while the rest of the floor runs in slow motion. Keyed by
// patient, so each procedure starts fresh.
import { useState } from 'react'
import PushGame from './minigames/PushGame'
import StorkGame from './minigames/StorkGame'
import { STORK_STEPS } from './minigames/stork'
import type { ShiftState } from './sim/types'

export default function Procedure({
  s,
  frozen,
  reducedMotion,
  onDone,
}: {
  s: ShiftState
  frozen: () => boolean
  reducedMotion: boolean
  onDone: (quality: number) => void
}) {
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000_000))
  const [step, setStep] = useState(0)
  const proc = s.procedure
  if (!proc) return null
  const p = proc.patient
  const csection = proc.kind === 'csection'
  const info = STORK_STEPS[step]
  return (
    <div className={'tc-procedure' + (csection ? ' is-surgery' : '')} role="dialog" aria-label={csection ? 'Code Stork surgery' : 'Delivery'}>
      <div className="tc-procedure-head">
        <h2>{csection ? `🚨 Code Stork: ${p.name}` : `👶 Delivering ${p.name}’s baby`}</h2>
        {csection ? (
          <>
            <ol className="tc-steps" aria-label="Surgery steps">
              {STORK_STEPS.map((st, i) => (
                <li key={st.id} className={i < step ? 'is-done' : i === step ? 'is-current' : ''}>
                  {st.title}
                </li>
              ))}
            </ol>
            <p className="tc-procedure-hint">
              <strong>
                Step {step + 1}/{STORK_STEPS.length}:
              </strong>{' '}
              {info.hint}
            </p>
          </>
        ) : (
          <p className="tc-procedure-hint">
            Push when the marker is in the green; the gold middle is perfect.
            {p.hasEpidural ? ' Her epidural keeps things calm.' : p.maternalStress > 60 ? ' She’s stressed, so the meter is quick!' : ''}
          </p>
        )}
      </div>
      {csection ? (
        <StorkGame patient={p} seed={seed} frozen={frozen} reducedMotion={reducedMotion} onDone={onDone} onStep={setStep} />
      ) : (
        <PushGame patient={p} seed={seed} frozen={frozen} reducedMotion={reducedMotion} onDone={onDone} />
      )}
      <p className="tc-dim tc-small tc-procedure-foot">The rest of the floor keeps going in slow motion.</p>
    </div>
  )
}

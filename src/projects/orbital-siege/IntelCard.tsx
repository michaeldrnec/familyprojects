import { intelFor, modifierLines } from './defenses'
import type { Level, Target } from './types'

interface Props {
  level: Level
  target: Target | null
}

// Recon: the selected structure's intel, or the mission brief when nothing
// is selected.
export default function IntelCard({ level, target }: Props) {
  const intel = intelFor(level, target)
  if (intel) {
    return (
      <div className="os-intel">
        <h3>{intel.title}</h3>
        <ul>
          {intel.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    )
  }
  const mods = modifierLines(level)
  return (
    <div className="os-intel">
      <h3>Mission brief</h3>
      <p>{level.brief}</p>
      {mods.length > 0 && (
        <ul className="os-mods">
          {mods.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {level.tip && <p className="os-tip">💡 {level.tip}</p>}
      <p className="os-muted">Tap anything on the battlefield for its intel.</p>
    </div>
  )
}

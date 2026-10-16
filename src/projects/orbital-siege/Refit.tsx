// The Refit Bay: spend salvage on small platform boosts.
import * as audio from './audio'
import { buyUpgrade, type SaveData } from './progress'
import { UPGRADES } from './upgrades'

interface Props {
  save: SaveData
  onChange: (save: SaveData) => void
  onBack: () => void
}

export default function Refit({ save, onChange, onBack }: Props) {
  return (
    <div className="os-screen os-refit">
      <header className="os-bar">
        <button className="os-btn" onClick={onBack}>
          ◀ Map
        </button>
        <h2>🔧 Refit Bay</h2>
        <span className="os-salvage">⚙️ {save.salvage} salvage</span>
      </header>
      <p className="os-muted">
        Salvage comes from first clears (+3) and new badges (+1 each). Every mission is solvable without upgrades, and
        badges and the daily are always judged at base stats.
      </p>
      <div className="os-upgrades">
        {UPGRADES.map((u) => {
          const have = save.owned[u.id] ?? 0
          const maxed = have >= u.max
          return (
            <div key={u.id} className="os-panel os-upgrade">
              <h3>
                {u.icon} {u.name}
              </h3>
              <p>{u.blurb}</p>
              <p className="os-muted">
                Owned {have}/{u.max}
              </p>
              <button
                className="os-btn os-btn-primary"
                disabled={maxed || save.salvage < u.cost}
                onClick={() => {
                  const next = buyUpgrade(save, u.id)
                  if (next) {
                    audio.init()
                    audio.play('win')
                    onChange(next)
                  }
                }}
              >
                {maxed ? 'Installed' : `Buy · ⚙️ ${u.cost}`}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

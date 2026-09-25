import { CONTRACTS } from './contracts'
import type { PartDef } from './parts'
import { partSpecs } from './format'
import type { SaveData } from './progress'
import { buy, listed, sell, shopParts, SELL_FRACTION } from './shop'
import * as audio from './audio'

interface Props {
  save: SaveData
  onChange: (save: SaveData) => void
  onBack: () => void
}

export default function Shop({ save, onChange, onBack }: Props) {
  function doBuy(def: PartDef) {
    const next = buy(save, def.id)
    if (!next) return audio.playDenied()
    audio.playBuy()
    onChange(next)
  }
  function doSell(def: PartDef) {
    const next = sell(save, def.id)
    if (!next) return audio.playDenied()
    audio.playRemove()
    onChange(next)
  }

  return (
    <div className="sb-screen sb-shop">
      <header className="sb-bar">
        <button className="sb-btn" onClick={onBack}>
          ← Barn
        </button>
        <h2>Black Market</h2>
        <span className="sb-cash">${save.cash.toLocaleString()}</span>
      </header>
      <p className="sb-shop-note">
        Cash only. No questions. Pawn parts back for {Math.round(SELL_FRACTION * 100)}%.
      </p>
      <div className="sb-shop-grid">
        {shopParts().map((def) => {
          const open = listed(def, save.completed)
          const owned = save.inventory[def.id] ?? 0
          const unlockTitle = def.unlock ? CONTRACTS.find((c) => c.id === def.unlock)?.title : undefined
          return (
            <article key={def.id} className={`sb-card sb-shop-item${open ? '' : ' locked'}`}>
              <div className="sb-shop-head">
                <h3>{def.name}</h3>
                <span className="sb-shop-owned">×{owned}</span>
              </div>
              <p className="sb-shop-blurb">{def.blurb}</p>
              <p className="sb-shop-specs">{partSpecs(def).join(' · ')}</p>
              {open ? (
                <div className="sb-shop-actions">
                  <button className="sb-btn sb-btn-primary" disabled={save.cash < def.cost} onClick={() => doBuy(def)}>
                    Buy ${def.cost.toLocaleString()}
                  </button>
                  <button className="sb-btn sb-btn-small" disabled={owned === 0} onClick={() => doSell(def)}>
                    Pawn ${Math.floor(def.cost * SELL_FRACTION)}
                  </button>
                </div>
              ) : (
                <p className="sb-shop-lock">🔒 After “{unlockTitle}”</p>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

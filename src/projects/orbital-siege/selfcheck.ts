// DEV-only sanity check (SPEC.md section 14): every level's reference
// solution must win cleanly at base stats, and the next 30 dailies must
// generate without falling back. Runs after load, a little at a time, so it
// never holds up the first paint. Problems go to console.error.
import { dateKey, generateDaily, isBackupDaily } from './daily'
import { LEVELS } from './levels'
import { simulate } from './sim'
import { basePlatform } from './upgrades'

let ran = false

export function runSelfcheck() {
  if (ran) return
  ran = true
  let bad = 0
  for (const level of LEVELS) {
    const r = simulate(level, level.solution, basePlatform(level))
    if (r.outcome !== 'win') {
      bad++
      console.error(`[orbital-siege] ${level.id} reference solution fails: ${r.reason} (${r.cause ?? 'no cause'})`)
    } else if (r.collateral > 0) {
      bad++
      console.error(`[orbital-siege] ${level.id} reference solution causes collateral damage`)
    }
  }
  console.info(`[orbital-siege] selfcheck: ${LEVELS.length - bad}/${LEVELS.length} reference solutions win`)

  const start = new Date()
  let day = 0
  let fallbacks = 0
  const next = () => {
    if (day >= 30) {
      if (fallbacks) console.error(`[orbital-siege] ${fallbacks} of the next 30 dailies fell back to the backup level`)
      else console.info('[orbital-siege] selfcheck: next 30 dailies generate and verify')
      return
    }
    const d = new Date(start)
    d.setDate(d.getDate() + day++)
    const level = generateDaily(dateKey(d))
    const r = simulate(level, level.solution, basePlatform(level))
    if (isBackupDaily(level)) fallbacks++
    else if (r.outcome !== 'win') console.error(`[orbital-siege] daily ${level.id} reference solution fails: ${r.reason}`)
    setTimeout(next, 0)
  }
  setTimeout(next, 500)
}

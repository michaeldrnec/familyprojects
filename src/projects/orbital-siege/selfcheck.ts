// Sanity checks (SPEC.md section 14): every level's reference solution must
// win cleanly at base stats, and upcoming dailies must generate without
// falling back to the backup level. The pure check functions are run by
// the test suite (selfcheck.test.ts); runSelfcheck() also runs them in DEV
// after load, a little at a time, so problems show up in the console
// without holding up the first paint.
import { dateKey, generateDaily, isBackupDaily } from './daily'
import { LEVELS } from './levels'
import { simulate } from './sim'
import { basePlatform } from './upgrades'

// Problems with the campaign levels' reference solutions (empty = all good).
export function levelProblems(): string[] {
  const problems: string[] = []
  for (const level of LEVELS) {
    const r = simulate(level, level.solution, basePlatform(level))
    if (r.outcome !== 'win') problems.push(`${level.id} reference solution fails: ${r.reason} (${r.cause ?? 'no cause'})`)
    else if (r.collateral > 0) problems.push(`${level.id} reference solution causes collateral damage`)
  }
  return problems
}

// Problems with one day's daily puzzle (empty = it generated and verifies).
export function dailyProblems(day: Date): string[] {
  const level = generateDaily(dateKey(day))
  if (isBackupDaily(level)) return [`daily ${dateKey(day)} fell back to the backup level`]
  const r = simulate(level, level.solution, basePlatform(level))
  return r.outcome === 'win' ? [] : [`daily ${level.id} reference solution fails: ${r.reason}`]
}

let ran = false

export function runSelfcheck() {
  if (ran) return
  ran = true
  const bad = levelProblems()
  for (const p of bad) console.error(`[orbital-siege] ${p}`)
  console.info(`[orbital-siege] selfcheck: ${LEVELS.length - bad.length}/${LEVELS.length} reference solutions win`)

  const start = new Date()
  let day = 0
  let failures = 0
  const next = () => {
    if (day >= 30) {
      if (!failures) console.info('[orbital-siege] selfcheck: next 30 dailies generate and verify')
      return
    }
    const d = new Date(start)
    d.setDate(d.getDate() + day++)
    const problems = dailyProblems(d)
    failures += problems.length
    for (const p of problems) console.error(`[orbital-siege] ${p}`)
    setTimeout(next, 0)
  }
  setTimeout(next, 500)
}

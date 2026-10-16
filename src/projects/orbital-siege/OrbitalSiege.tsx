import { useEffect, useRef, useState } from 'react'
import * as audio from './audio'
import { dateKey, generateDaily, prettyDate } from './daily'
import Debrief from './Debrief'
import Execute from './Execute'
import { LEVELS, levelById } from './levels'
import Mission from './Mission'
import {
  clearSave,
  freshSave,
  isUnlocked,
  levelSave,
  liveStreak,
  loadSave,
  settleDaily,
  settleLevel,
  writeSave,
  type SaveData,
  type Settlement,
} from './progress'
import Refit from './Refit'
import { copyText, decodePlan, encodePlan, parseCode } from './share'
import { simulate, type SimResult } from './sim'
import StarMap from './StarMap'
import type { Level, Plan, Platform } from './types'
import { basePlatform, platformFor } from './upgrades'
import './OrbitalSiege.css'

// The screen machine from SPEC.md section 13:
// star map -> mission (recon + sequencer) -> execute -> debrief, with the
// Refit Bay off the star map. The save is written through on every change.
type Screen =
  | { kind: 'map' }
  | { kind: 'refit' }
  | { kind: 'mission'; level: Level; daily: boolean }
  | {
      kind: 'execute'
      level: Level
      daily: boolean
      plan: Plan
      result: SimResult
      settlement: Settlement | null // null for a replay
    }

const UNDO_LIMIT = 80

export default function OrbitalSiege() {
  const [save, setSave] = useState<SaveData>(() => {
    const s = loadSave()
    audio.setMuted(s.muted)
    return s
  })
  const [screen, setScreen] = useState<Screen>({ kind: 'map' })
  const [today, setToday] = useState(() => dateKey())
  // Plan undo/redo for the current mission (this session only).
  const history = useRef<{ undo: Plan[]; redo: Plan[] }>({ undo: [], redo: [] })
  const [, setHistoryTick] = useState(0)

  useEffect(() => {
    if (import.meta.env.DEV) void import('./selfcheck').then((m) => m.runSelfcheck())
  }, [])

  function commit(next: SaveData) {
    setSave(next)
    writeSave(next)
  }

  function platformOf(level: Level, daily: boolean): Platform {
    return daily ? basePlatform(level) : platformFor(level, save.owned)
  }

  function openMission(level: Level, daily: boolean, plan?: Plan, base = save) {
    audio.init()
    history.current = { undo: [], redo: [] }
    setHistoryTick((n) => n + 1)
    if (plan) commit({ ...base, drafts: { ...base.drafts, [level.id]: plan } })
    setScreen({ kind: 'mission', level, daily })
  }

  function openDaily() {
    const key = dateKey()
    setToday(key)
    // Drop drafts from earlier dailies.
    const drafts = Object.fromEntries(Object.entries(save.drafts).filter(([id]) => !id.startsWith('D') || id === `D${key}`))
    const next = { ...save, drafts }
    commit(next)
    openMission(generateDaily(key), true, undefined, next)
  }

  const current = screen.kind === 'mission' ? screen : null
  const plan: Plan = current ? (save.drafts[current.level.id] ?? []) : []

  function setPlan(next: Plan) {
    if (!current) return
    const h = history.current
    h.undo.push(plan)
    if (h.undo.length > UNDO_LIMIT) h.undo.shift()
    h.redo = []
    setHistoryTick((n) => n + 1)
    commit({ ...save, drafts: { ...save.drafts, [current.level.id]: next } })
  }

  function undo() {
    const prev = history.current.undo.pop()
    if (!current || !prev) return audio.play('denied')
    history.current.redo.push(plan)
    setHistoryTick((n) => n + 1)
    commit({ ...save, drafts: { ...save.drafts, [current.level.id]: prev } })
  }

  function redo() {
    const next = history.current.redo.pop()
    if (!current || !next) return audio.play('denied')
    history.current.undo.push(plan)
    setHistoryTick((n) => n + 1)
    commit({ ...save, drafts: { ...save.drafts, [current.level.id]: next } })
  }

  function execute() {
    if (!current) return
    const { level, daily } = current
    const platform = platformOf(level, daily)
    const result = simulate(level, plan, platform)
    const settlement = daily ? settleDaily(save, level, plan, result, dateKey()) : settleLevel(save, level, plan, result, platform)
    commit(settlement.save)
    setScreen({ kind: 'execute', level, daily, plan, result, settlement })
  }

  function replay(level: Level, daily: boolean, best: Plan, platform: Platform) {
    audio.init()
    setScreen({ kind: 'execute', level, daily, plan: best, result: simulate(level, best, platform), settlement: null })
  }

  function loadCode(code: string): string | null {
    const head = parseCode(code)
    if (!head) return 'That doesn’t look like an Orbital Siege code (OS1-…).'
    let level: Level | undefined
    const daily = head.levelId.startsWith('D')
    if (daily) level = generateDaily(head.levelId.slice(1))
    else {
      level = levelById(head.levelId)
      if (!level) return `No level ${head.levelId}.`
      if (!isUnlocked(save, level.id)) return `Level ${level.id} is still locked. Clear the levels before it first.`
    }
    const decoded = decodePlan(level, head.body)
    if (!decoded) return 'That code doesn’t fit its level.'
    openMission(level, daily, decoded)
    return null
  }

  function copyCode(level: Level, p: Plan) {
    void copyText(encodePlan(level, p))
  }

  function resetSave() {
    clearSave()
    const fresh = freshSave()
    fresh.muted = save.muted
    commit(fresh)
    setScreen({ kind: 'map' })
  }

  function toggleMute() {
    const muted = !save.muted
    audio.setMuted(muted)
    commit({ ...save, muted })
  }

  let body
  if (screen.kind === 'map') {
    body = (
      <StarMap
        save={save}
        today={today}
        onPlay={(id) => openMission(levelById(id)!, false)}
        onReplay={(id) => {
          const ls = levelSave(save, id)
          const level = levelById(id)!
          if (ls.best) replay(level, false, ls.best, ls.bestPlatform ?? platformFor(level, save.owned))
        }}
        onCopyBest={(id) => {
          const ls = levelSave(save, id)
          if (ls.best) copyCode(levelById(id)!, ls.best)
        }}
        onDaily={openDaily}
        onReplayDaily={() => {
          const level = generateDaily(today)
          if (save.daily.best) replay(level, true, save.daily.best, basePlatform(level))
        }}
        onRefit={() => setScreen({ kind: 'refit' })}
        onLoadCode={loadCode}
        onReset={resetSave}
      />
    )
  } else if (screen.kind === 'refit') {
    body = <Refit save={save} onChange={commit} onBack={() => setScreen({ kind: 'map' })} />
  } else if (screen.kind === 'mission') {
    const { level, daily } = screen
    body = (
      <Mission
        key={level.id}
        level={level}
        isDaily={daily}
        platform={platformOf(level, daily)}
        plan={plan}
        fails={levelSave(save, level.id).fails}
        onPlan={setPlan}
        onUndo={undo}
        onRedo={redo}
        canUndo={history.current.undo.length > 0}
        canRedo={history.current.redo.length > 0}
        onExecute={execute}
        onBack={() => setScreen({ kind: 'map' })}
      />
    )
  } else {
    const { level, daily, result, settlement } = screen
    const idx = LEVELS.findIndex((l) => l.id === level.id)
    const next = !daily && result.outcome === 'win' && idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null
    const title = daily ? `Daily · ${prettyDate(level.id.slice(1))} · ${level.name}` : `${level.id} · ${level.name}`
    body = (
      <Execute
        key={`${level.id}-${screen.plan.length}-${result.endTick}-${settlement ? 'run' : 'replay'}`}
        level={level}
        result={result}
        title={settlement ? title : `${title} (replay)`}
        onEdit={() => openMission(level, daily)}
        debrief={
          <Debrief
            level={level}
            result={result}
            settlement={settlement}
            isDaily={daily}
            streak={liveStreak(save, today)}
            onRetry={() => openMission(level, daily)}
            onNext={next ? () => openMission(next, false) : null}
            onMap={() => setScreen({ kind: 'map' })}
            onCopy={() => copyCode(level, screen.plan)}
          />
        }
      />
    )
  }

  return (
    <div className="orbital-siege fullscreen">
      <button className="os-mute" onClick={toggleMute} aria-label={save.muted ? 'Unmute' : 'Mute'}>
        {save.muted ? '🔇' : '🔊'}
      </button>
      {body}
    </div>
  )
}

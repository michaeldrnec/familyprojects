import { useState } from 'react'
import { Title, RoomSelect, LevelSelect } from './screens/Menus'
import Play from './screens/Play'
import { levelById, nextLevel } from './levels/index'
import type { RoomId } from './levels/types'
import { loadProgress, saveProgress, recordResult, type Progress } from './progress'
import * as audio from './audio'
import './FelineBallistics.css'

// Screen state machine (SPEC.md section 7): title -> rooms -> levels ->
// play (with its own results overlay). `?level=<id>` jumps straight in,
// which is handy while tuning.
type Screen = { kind: 'title' } | { kind: 'rooms' } | { kind: 'levels'; room: RoomId } | { kind: 'play'; levelId: string }

function initialScreen(): Screen {
  try {
    const id = new URLSearchParams(window.location.search).get('level')
    if (id && levelById(id)) return { kind: 'play', levelId: id }
  } catch {
    // ignore
  }
  return { kind: 'title' }
}

export default function FelineBallistics() {
  const [progress, setProgress] = useState<Progress>(() => {
    const p = loadProgress()
    audio.setMuted(p.settings.muted)
    return p
  })
  const [screen, setScreen] = useState<Screen>(initialScreen)

  function commit(next: Progress) {
    setProgress(next)
    saveProgress(next)
  }

  function go(next: Screen) {
    audio.init()
    audio.click()
    setScreen(next)
  }

  function toggleMute() {
    const muted = !progress.settings.muted
    audio.setMuted(muted)
    commit({ ...progress, settings: { ...progress.settings, muted } })
  }

  function toggleMotion() {
    commit({ ...progress, settings: { ...progress.settings, reducedMotion: !progress.settings.reducedMotion } })
  }

  const level = screen.kind === 'play' ? levelById(screen.levelId) : undefined

  return (
    <div className="feline-ballistics fullscreen">
      {screen.kind === 'title' && (
        <Title onPlay={() => go({ kind: 'rooms' })} settings={progress.settings} onToggleMotion={toggleMotion} onToggleMute={toggleMute} />
      )}
      {screen.kind === 'rooms' && <RoomSelect progress={progress} onPick={(room) => go({ kind: 'levels', room })} onBack={() => go({ kind: 'title' })} />}
      {screen.kind === 'levels' && (
        <LevelSelect room={screen.room} progress={progress} onPlay={(id) => go({ kind: 'play', levelId: id })} onBack={() => go({ kind: 'rooms' })} />
      )}
      {screen.kind === 'play' && level && (
        <Play
          level={level}
          hasNext={!!nextLevel(level.id)}
          coachSeen={progress.coachSeen}
          reducedMotion={progress.settings.reducedMotion}
          muted={progress.settings.muted}
          onToggleMute={toggleMute}
          onCoachSeen={(key) => commit({ ...progress, coachSeen: [...progress.coachSeen, key] })}
          onResult={(stars, score) => commit(recordResult(progress, level.id, stars, score))}
          onNext={() => {
            const n = nextLevel(level.id)
            if (n) go({ kind: 'play', levelId: n.id })
          }}
          onExit={() => go({ kind: 'levels', room: level.room })}
        />
      )}
    </div>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  addProfile,
  deleteProfile,
  DEFAULT_PROFILE_ID,
  MAX_NAME_LENGTH,
  MAX_PROFILES,
  PROFILE_EMOJIS,
  switchProfile,
  updateProfile,
  useProfiles,
} from '../shared/profiles'
import './site.css'

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; id: string }

// The "Who's playing?" picker in the site header. Each profile keeps its
// own saves; `onChange` runs after the active profile changes.
export default function ProfileMenu({ onChange }: { onChange: () => void }) {
  const { profiles, activeId } = useProfiles()
  const active = profiles.find((p) => p.id === activeId) ?? profiles[0]
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(PROFILE_EMOJIS[0])
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle() {
    setOpen((o) => !o)
    setMode({ kind: 'list' })
  }

  function pick(id: string) {
    setOpen(false)
    if (id === activeId) return
    switchProfile(id)
    onChange()
  }

  function startAdd() {
    setName('')
    setEmoji(PROFILE_EMOJIS[profiles.length % PROFILE_EMOJIS.length])
    setMode({ kind: 'add' })
  }

  function startEdit(id: string) {
    const p = profiles.find((x) => x.id === id)
    if (!p) return
    setName(p.name)
    setEmoji(p.emoji)
    setMode({ kind: 'edit', id })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (mode.kind === 'add') {
      if (!addProfile(name, emoji)) return
      setOpen(false)
      onChange()
    } else if (mode.kind === 'edit') {
      updateProfile(mode.id, name, emoji)
      setMode({ kind: 'list' })
    }
  }

  function remove(id: string) {
    const p = profiles.find((x) => x.id === id)
    if (!p || !window.confirm(`Delete ${p.name} and all of their saved progress? This can't be undone.`)) return
    const wasActive = id === activeId
    deleteProfile(id)
    setMode({ kind: 'list' })
    if (wasActive) {
      setOpen(false)
      onChange()
    }
  }

  return (
    <div className="profile-menu" ref={rootRef}>
      <button
        type="button"
        className="profile-chip"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Switch player"
      >
        <span aria-hidden="true">{active.emoji}</span>
        <span className="profile-chip-name">{active.name}</span>
      </button>

      {open && (
        <div className="profile-panel" role="dialog" aria-label="Who's playing?">
          {mode.kind === 'list' ? (
            <>
              <p className="profile-panel-title">Who's playing?</p>
              <ul className="profile-list">
                {profiles.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={'profile-option' + (p.id === activeId ? ' active' : '')}
                      onClick={() => pick(p.id)}
                      aria-current={p.id === activeId}
                    >
                      <span aria-hidden="true">{p.emoji}</span> {p.name}
                    </button>
                    <button type="button" className="profile-edit" onClick={() => startEdit(p.id)} aria-label={`Edit ${p.name}`}>
                      ✎
                    </button>
                  </li>
                ))}
              </ul>
              {profiles.length < MAX_PROFILES && (
                <button type="button" className="profile-add" onClick={startAdd}>
                  + Add player
                </button>
              )}
              <p className="profile-note">Each player keeps their own saves and best scores on this device.</p>
            </>
          ) : (
            <form onSubmit={submit} className="profile-form">
              <p className="profile-panel-title">{mode.kind === 'add' ? 'New player' : 'Edit player'}</p>
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME_LENGTH} autoFocus required />
              </label>
              <div className="profile-emojis" role="radiogroup" aria-label="Icon">
                {PROFILE_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    role="radio"
                    aria-checked={e === emoji}
                    className={e === emoji ? 'active' : ''}
                    onClick={() => setEmoji(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="profile-form-actions">
                <button type="submit" className="site-button" disabled={!name.trim()}>
                  {mode.kind === 'add' ? 'Add and play' : 'Save'}
                </button>
                <button type="button" className="profile-cancel" onClick={() => setMode({ kind: 'list' })}>
                  Cancel
                </button>
              </div>
              {mode.kind === 'edit' && mode.id !== DEFAULT_PROFILE_ID && (
                <button type="button" className="profile-delete" onClick={() => remove(mode.id)}>
                  Delete this player
                </button>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  )
}

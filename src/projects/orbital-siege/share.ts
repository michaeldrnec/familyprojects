// Share codes (SPEC.md section 12): OS1-<level>-<base64url(actions)>.
// Each action packs into 2 bytes: weapon (3 bits), fire tick (4), target
// index into targetsOf(level) (5), and 4 reserved flag bits.
import { canTarget, targetsOf, weaponsFor } from './defenses'
import type { Level, Plan } from './types'
import { WEAPON_ORDER } from './weapons'

const PREFIX = 'OS1'

function toBase64Url(bytes: number[]) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): number[] | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    return Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

export function encodePlan(level: Level, plan: Plan): string {
  const targets = targetsOf(level)
  const bytes: number[] = []
  for (const a of plan) {
    const word =
      (WEAPON_ORDER.indexOf(a.w) << 13) | ((a.tick & 0xf) << 9) | ((targets.indexOf(a.target) & 0x1f) << 4)
    bytes.push(word >> 8, word & 0xff)
  }
  return `${PREFIX}-${level.id}-${toBase64Url(bytes)}`
}

// Just the header, so the caller can find (or generate) the level first.
export function parseCode(code: string): { levelId: string; body: string } | null {
  const m = code.trim().match(/^OS1-(\d-\d|D\d{8})-([A-Za-z0-9_-]*)$/)
  return m ? { levelId: m[1], body: m[2] } : null
}

// Decodes the body against its level, dropping anything that doesn't fit.
export function decodePlan(level: Level, body: string): Plan | null {
  const bytes = fromBase64Url(body)
  if (!bytes || bytes.length % 2) return null
  const targets = targetsOf(level)
  const allowed = weaponsFor(level)
  const plan: Plan = []
  for (let i = 0; i < bytes.length; i += 2) {
    const word = (bytes[i] << 8) | bytes[i + 1]
    const w = WEAPON_ORDER[word >> 13]
    const tick = (word >> 9) & 0xf
    const target = targets[(word >> 4) & 0x1f]
    if (!w || !allowed.includes(w) || !target || tick < 1 || tick > level.ticks || !canTarget(level, w, target)) return null
    plan.push({ w, tick, target })
  }
  return plan
}

// Clipboard, with a prompt() fallback where the clipboard API is blocked.
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    window.prompt('Copy this code:', text)
    return false
  }
}

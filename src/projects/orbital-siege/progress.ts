// Persistent save (SPEC.md section 13), stored through the site's shared
// storage helper (per player profile, versioned, never throws). Every field
// is validated on load. Sound is muted site-wide (shared/audio.ts), so
// it isn't part of this save.
import { createStore } from '../../shared/storage'
import { badgesFor, earnedBadges, type BadgeId } from './badges'
import { LEVELS } from './levels'
import type { SimResult } from './sim'
import type { Level, Plan, Platform } from './types'
import { UPGRADES, type Owned, type UpgradeId } from './upgrades'
import { WEAPONS } from './weapons'

export interface LevelSave {
  cleared: boolean
  badges: BadgeId[]
  best: Plan | null // fewest energy, then earliest win tick
  bestPlatform: Platform | null // what it ran on, so a replay is identical
  bestEnergy: number
  bestTick: number
  fails: number
}

export interface DailySave {
  date: string // the YYYYMMDD of `best`
  best: Plan | null
  bestEnergy: number
  bestTick: number
  streak: number
  lastWin: string // YYYYMMDD of the last daily won
}

export interface SaveData {
  levels: Record<string, LevelSave>
  salvage: number
  owned: Owned
  drafts: Record<string, Plan> // the in-progress plan per level
  daily: DailySave
}

export function freshSave(): SaveData {
  return {
    levels: {},
    salvage: 0,
    owned: {},
    drafts: {},
    daily: { date: '', best: null, bestEnergy: 0, bestTick: 0, streak: 0, lastWin: '' },
  }
}

export function emptyLevelSave(): LevelSave {
  return { cleared: false, badges: [], best: null, bestPlatform: null, bestEnergy: 0, bestTick: 0, fails: 0 }
}

export function parsePlan(x: unknown): Plan | null {
  if (!Array.isArray(x)) return null
  const plan: Plan = []
  for (const a of x) {
    if (!a || typeof a !== 'object') return null
    const { w, tick, target } = a as Record<string, unknown>
    if (typeof w !== 'string' || !(w in WEAPONS) || typeof tick !== 'number' || typeof target !== 'string') return null
    plan.push({ w: w as Plan[number]['w'], tick: Math.floor(tick), target })
  }
  return plan
}

const num = (x: unknown, fallback = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : fallback)
const str = (x: unknown) => (typeof x === 'string' ? x : '')

function parsePlatform(x: unknown): Platform | null {
  if (!x || typeof x !== 'object') return null
  const p = x as Record<string, unknown>
  const energy = num(p.energy, -1)
  const heatCap = num(p.heatCap, -1)
  const cool = num(p.cool, -1)
  if (energy <= 0 || heatCap <= 0 || cool < 0) return null
  return { energy, heatCap, cool, targeting: p.targeting === true }
}

function parseLevelSave(x: unknown): LevelSave | null {
  if (!x || typeof x !== 'object') return null
  const l = x as Record<string, unknown>
  return {
    cleared: l.cleared === true,
    badges: Array.isArray(l.badges)
      ? l.badges.filter((b): b is BadgeId => b === 'minimalist' || b === 'hyper' || b === 'surgical')
      : [],
    best: parsePlan(l.best),
    bestPlatform: parsePlatform(l.bestPlatform),
    bestEnergy: num(l.bestEnergy),
    bestTick: num(l.bestTick),
    fails: num(l.fails),
  }
}

const store = createStore<SaveData>({
  key: 'orbital-siege:save',
  version: 1,
  defaults: freshSave,
  parse(p) {
    const save = freshSave()
    if (p.levels && typeof p.levels === 'object') {
      for (const [id, v] of Object.entries(p.levels)) {
        const ls = parseLevelSave(v)
        if (ls) save.levels[id] = ls
      }
    }
    save.salvage = Math.max(0, Math.floor(num(p.salvage)))
    if (p.owned && typeof p.owned === 'object') {
      for (const u of UPGRADES) {
        const n = num(p.owned[u.id])
        if (n > 0) save.owned[u.id] = Math.min(u.max, Math.floor(n))
      }
    }
    if (p.drafts && typeof p.drafts === 'object') {
      for (const [id, v] of Object.entries(p.drafts)) {
        const plan = parsePlan(v)
        if (plan) save.drafts[id] = plan
      }
    }
    if (p.daily && typeof p.daily === 'object') {
      save.daily = {
        date: str(p.daily.date),
        best: parsePlan(p.daily.best),
        bestEnergy: num(p.daily.bestEnergy),
        bestTick: num(p.daily.bestTick),
        streak: Math.max(0, Math.floor(num(p.daily.streak))),
        lastWin: str(p.daily.lastWin),
      }
    }
    return save
  },
  summary: {
    slug: 'orbital-siege',
    describe(save) {
      const cleared = LEVELS.filter((l) => save.levels[l.id]?.cleared).length
      return cleared > 0 ? `${cleared}/${LEVELS.length} fortresses` : null
    },
  },
})

export const loadSave = store.load
export const writeSave = store.save
export const clearSave = store.clear

export function levelSave(save: SaveData, id: string): LevelSave {
  return save.levels[id] ?? emptyLevelSave()
}

// Campaign levels open one at a time.
export function isUnlocked(save: SaveData, id: string) {
  const i = LEVELS.findIndex((l) => l.id === id)
  return i === 0 || (i > 0 && levelSave(save, LEVELS[i - 1].id).cleared)
}

function better(energy: number, tick: number, oldEnergy: number, oldTick: number, hadBest: boolean) {
  return !hadBest || energy < oldEnergy || (energy === oldEnergy && tick < oldTick)
}

export interface Settlement {
  save: SaveData
  firstClear: boolean
  newBadges: BadgeId[]
  badges: BadgeId[] // earned this run
  salvage: number
  newBest: boolean
}

export const SALVAGE_CLEAR = 3
export const SALVAGE_BADGE = 1

// Applies a campaign run's result to the save.
export function settleLevel(save: SaveData, level: Level, plan: Plan, r: SimResult, platform: Platform): Settlement {
  const prev = levelSave(save, level.id)
  if (r.outcome !== 'win') {
    return {
      save: { ...save, levels: { ...save.levels, [level.id]: { ...prev, fails: prev.fails + 1 } } },
      firstClear: false,
      newBadges: [],
      badges: [],
      salvage: 0,
      newBest: false,
    }
  }
  const badges = earnedBadges(level, r)
  const newBadges = badges.filter((b) => !prev.badges.includes(b))
  const firstClear = !prev.cleared
  const salvage = (firstClear ? SALVAGE_CLEAR : 0) + newBadges.length * SALVAGE_BADGE
  const newBest = better(r.energy, r.winTick!, prev.bestEnergy, prev.bestTick, !!prev.best)
  const next: LevelSave = {
    cleared: true,
    badges: badgesFor(level).filter((b) => prev.badges.includes(b) || badges.includes(b)),
    best: newBest ? plan : prev.best,
    bestPlatform: newBest ? platform : prev.bestPlatform,
    bestEnergy: newBest ? r.energy : prev.bestEnergy,
    bestTick: newBest ? r.winTick! : prev.bestTick,
    fails: prev.fails,
  }
  return {
    save: { ...save, salvage: save.salvage + salvage, levels: { ...save.levels, [level.id]: next } },
    firstClear,
    newBadges,
    badges,
    salvage,
    newBest,
  }
}

function previousDay(key: string) {
  const d = new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6)))
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

// Daily runs only count toward the streak and best on the day itself.
export function settleDaily(save: SaveData, level: Level, plan: Plan, r: SimResult, today: string): Settlement {
  const key = level.id.slice(1)
  const base: Settlement = { save, firstClear: false, newBadges: [], badges: earnedBadges(level, r), salvage: 0, newBest: false }
  if (r.outcome !== 'win' || key !== today) return base
  const d = save.daily
  const firstClear = d.lastWin !== today
  const streak = d.lastWin === today ? d.streak : d.lastWin === previousDay(today) ? d.streak + 1 : 1
  const sameDay = d.date === today
  const newBest = better(r.energy, r.winTick!, d.bestEnergy, d.bestTick, sameDay && !!d.best)
  return {
    ...base,
    firstClear,
    newBest,
    save: {
      ...save,
      daily: {
        date: today,
        best: newBest ? plan : d.best,
        bestEnergy: newBest ? r.energy : d.bestEnergy,
        bestTick: newBest ? r.winTick! : d.bestTick,
        streak,
        lastWin: today,
      },
    },
  }
}

// The streak still counts if the last win was today or yesterday.
export function liveStreak(save: SaveData, today: string) {
  const { lastWin, streak } = save.daily
  return lastWin === today || lastWin === previousDay(today) ? streak : 0
}

export function buyUpgrade(save: SaveData, id: UpgradeId): SaveData | null {
  const def = UPGRADES.find((u) => u.id === id)!
  const have = save.owned[id] ?? 0
  if (have >= def.max || save.salvage < def.cost) return null
  return { ...save, salvage: save.salvage - def.cost, owned: { ...save.owned, [id]: have + 1 } }
}

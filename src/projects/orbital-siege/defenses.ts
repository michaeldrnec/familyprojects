// Defense and structure rules that aren't tick-dependent: what a weapon may
// aim at, how targets are labelled, and the intel text shown in Recon.
import type { Level, PdcDef, ShieldDef, StructureDef, Target, WeaponId } from './types'
import { WEAPONS, WEAPON_ORDER } from './weapons'

export const BASE_ENERGY = 100
export const BASE_HEAT = 10
export const BASE_COOL = 3

export const PRIORITY_TEXT: Record<PdcDef['priority'], string> = {
  mass: 'shoots the heaviest projectile first',
  nearest: 'shoots the projectile closest to impact first',
  first: 'shoots the earliest-launched projectile first',
}

export const KIND_ICON: Record<StructureDef['kind'], string> = {
  core: '◆',
  hangar: '▣',
  relay: '⌁',
  generator: '⏻',
  battery: '⊥',
  site: '❀',
}

export function colTarget(col: number): Target {
  return `c${col}`
}

export function targetCol(t: Target): number | null {
  return t[0] === 'c' && /^c\d+$/.test(t) ? Number(t.slice(1)) : null
}

// Every target in the level, in a fixed order (share codes index into it).
export function targetsOf(level: Level): Target[] {
  const out: Target[] = []
  for (let c = 0; c < level.width; c++) out.push(colTarget(c))
  for (const p of level.pdcs) out.push(p.id)
  for (const s of level.shields) out.push(s.id)
  if (level.field) out.push('field')
  return out
}

export function weaponsFor(level: Level): WeaponId[] {
  return WEAPON_ORDER.filter((w) => WEAPONS[w].sector <= level.sector && !level.banned?.includes(w))
}

export function canTarget(level: Level, w: WeaponId, t: Target): boolean {
  if (targetCol(t) !== null) return targetCol(t)! < level.width
  if (level.pdcs.some((p) => p.id === t)) return w === 'laser' || w === 'chaff' || w === 'emp'
  if (level.shields.some((s) => s.id === t)) return w === 'emp'
  if (t === 'field') return w === 'emp' && !!level.field
  return false
}

export function validTargets(level: Level, w: WeaponId): Target[] {
  return targetsOf(level).filter((t) => canTarget(level, w, t))
}

export function structureAt(level: Level, col: number): StructureDef | undefined {
  return level.structures.find((s) => s.col === col)
}

export function fieldName(level: Level) {
  return level.field?.kind === 'magneto' ? 'Magnetosphere' : 'Ion Field'
}

export function targetLabel(level: Level, t: Target): string {
  const col = targetCol(t)
  if (col !== null) {
    const s = structureAt(level, col)
    return s ? s.name : `Ground ${col + 1}`
  }
  if (t === 'field') return fieldName(level)
  return level.pdcs.find((p) => p.id === t)?.name ?? level.shields.find((s) => s.id === t)?.name ?? t
}

function powerName(level: Level, id?: string) {
  if (!id) return null
  return level.structures.find((s) => s.id === id)?.name ?? id
}

// Things a power source keeps running.
export function poweredBy(level: Level, id: string): string[] {
  return [
    ...level.structures.filter((s) => s.power === id).map((s) => s.name),
    ...level.pdcs.filter((p) => p.power === id).map((p) => p.name),
    ...level.shields.filter((s) => s.power === id).map((s) => s.name),
  ]
}

export interface Intel {
  title: string
  lines: string[]
}

const ARMOR_TEXT = {
  light: 'Light armor: lasers, missiles, thermobarics, resonance, lances and drills all work.',
  medium: 'Medium armor: needs a missile, lance or drill.',
  hardened: 'Hardened armor: only a Kinetic Lance or Drill Laser gets through.',
}

export function structureIntel(level: Level, s: StructureDef): Intel {
  const lines: string[] = []
  if (level.objectives.includes(s.id)) lines.push('OBJECTIVE: destroy this.')
  if (s.kind === 'site') {
    lines.push(
      s.hard
        ? 'Protected site. Damaging it ABORTS the mission.'
        : 'Protected site. Damaging it costs the Surgical badge.',
    )
  }
  lines.push(ARMOR_TEXT[s.armor])
  if ((s.hp ?? 1) > 1) lines.push(`Takes ${s.hp} hits to destroy.`)
  if (s.kind === 'battery') {
    lines.push(`Anti-orbital battery: fires at the platform at the END of tick ${s.fireAt}. Destroy it first.`)
    lines.push('If it is disabled or unpowered on that tick, it fires as soon as it comes back.')
  }
  const links = poweredBy(level, s.id)
  if (links.length) lines.push(`Powers: ${links.join(', ')}. Destroy or EMP it to drop them.`)
  const p = powerName(level, s.power)
  if (p) lines.push(`Powered by ${p}.`)
  const shield = level.shields.find((d) => s.col >= d.from && s.col <= d.to)
  if (shield) lines.push(`Under ${shield.name}.`)
  return { title: s.name, lines }
}

export function pdcIntel(level: Level, p: PdcDef): Intel {
  const lines = [
    `Point defense guarding columns ${p.zone[0] + 1}–${p.zone[1] + 1}.`,
    `Fires ${p.barrels ?? 1} shot${(p.barrels ?? 1) > 1 ? 's' : ''} per tick; ${PRIORITY_TEXT[p.priority]}.`,
    'Only hits physical projectiles while they are in flight (lance 2 ticks, missile/thermobaric 1).',
    p.armored ? 'Armored: lasers glance off. Blind it with chaff or EMP it.' : 'Unarmored: a laser destroys it.',
  ]
  const pw = powerName(level, p.power)
  if (pw) lines.push(`Powered by ${pw}.`)
  return { title: p.name, lines }
}

export function shieldIntel(level: Level, s: ShieldDef): Intel {
  const lines = [
    `Kinetic shield over columns ${s.from + 1}–${s.to + 1}, strength ${s.strength}.`,
    'Blocks missiles and thermobarics. Each laser or drill hit drains 1 (the beam is absorbed).',
    s.strength <= 1
      ? 'A lance will shatter it (and be spent).'
      : 'Destroys lances while its strength is above 1.',
    'An EMP collapses it for 2 ticks. Resonance beams pass straight through.',
  ]
  const pw = powerName(level, s.power)
  if (pw) lines.push(`Powered by ${pw}: no power, no shield.`)
  return { title: s.name, lines }
}

export function fieldIntel(level: Level): Intel {
  const f = level.field!
  const dir = f.drift > 0 ? 'right' : 'left'
  const lines =
    f.kind === 'ion'
      ? [
          `Weak ion field. Scrambles guided missiles: they land one column to the ${dir}.`,
          'An EMP aimed at the field takes it down for 2 ticks. Everything else passes untouched.',
        ]
      : [
          `Strong magnetosphere. Missiles drift one column to the ${dir}; lasers and drills are refracted.`,
          'It swallows any single EMP. Two EMPs landing on the same tick overload it for 2 ticks.',
          'Lances, chaff and resonance beams pass untouched.',
        ]
  return { title: fieldName(level), lines }
}

export function modifierLines(level: Level): string[] {
  const m = level.modifiers ?? {}
  const out: string[] = []
  if (m.solarStorm) out.push('☀️ Solar storm: EMPs last 3 ticks.')
  if (m.dustTicks?.length) out.push(`🪨 Dust ring: physical projectiles in flight on tick ${m.dustTicks.join(', ')} are destroyed.`)
  if (m.volatile) out.push('🔥 Volatile atmosphere: thermobaric splash covers the whole surface.')
  if (level.banned?.length) out.push(`🚫 Offline this mission: ${level.banned.map((w) => WEAPONS[w].name).join(', ')}.`)
  return out
}

// Recon: the intel card for whatever was tapped.
export function intelFor(level: Level, t: Target | null): Intel | null {
  if (!t) return null
  const col = targetCol(t)
  if (col !== null) {
    const s = level.structures.find((d) => d.col === col)
    if (s) return structureIntel(level, s)
    const dome = level.shields.find((d) => col >= d.from && col <= d.to)
    return { title: `Column ${col + 1}`, lines: [dome ? `Empty ground under ${dome.name}.` : 'Empty ground.'] }
  }
  if (t === 'field' && level.field) return fieldIntel(level)
  const p = level.pdcs.find((d) => d.id === t)
  if (p) return pdcIntel(level, p)
  const s = level.shields.find((d) => d.id === t)
  if (s) return shieldIntel(level, s)
  return null
}

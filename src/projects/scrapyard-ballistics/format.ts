// Small display helpers shared by the screens.
import { fuelFlow, wetMass, type PartDef } from './parts'

export function formatAlt(m: number): string {
  if (!Number.isFinite(m)) return '∞'
  const neg = m < 0 ? '−' : ''
  const a = Math.abs(m)
  return a >= 10_000 ? `${neg}${(a / 1000).toFixed(1)} km` : `${neg}${Math.round(a).toLocaleString()} m`
}

export function formatSpeed(v: number): string {
  return `${Math.round(v).toLocaleString()} m/s`
}

export function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `T+${m}:${r.toString().padStart(2, '0')}`
}

export function partSpecs(def: PartDef): string[] {
  const out = [`${Math.round(wetMass(def))} kg`]
  if (def.engine) {
    out.push(`${(def.engine.thrust / 1000).toFixed(1)} kN`)
    out.push(`Isp ${def.engine.isp}s`)
    if (def.engine.internalFuel) out.push(`${(def.engine.internalFuel / fuelFlow(def.engine)).toFixed(0)}s burn`)
    if (!def.engine.throttleable) out.push('no throttle')
    if (def.engine.gimbal) out.push('gimbal')
  }
  if (def.tank) out.push(`${def.tank.fuel} kg fuel`)
  if (def.gyro && !def.command) out.push(`${(def.gyro.torque / 1000).toFixed(1)} kN·m`)
  out.push(`weld ${(def.integrity / 1000).toFixed(0)} kN`)
  if (def.heatTolerance >= 2) out.push('heat-proof')
  return out
}

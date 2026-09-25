// Atmosphere model (SPEC.md section 5): exponential density, a
// dynamic-pressure readout, a speed of sound for the Mach gauge, a
// wind-shear band and a crude re-entry heat flux. Everything returns plain
// numbers -- flight.ts applies the forces.

export const ATMOSPHERE_TOP = 80_000 // m
const RHO0 = 1.225 // kg/m³
const SCALE_HEIGHT = 6_500 // m

export function density(altitude: number): number {
  if (altitude >= ATMOSPHERE_TOP) return 0
  return RHO0 * Math.exp(-Math.max(0, altitude) / SCALE_HEIGHT)
}

export function dynamicPressure(altitude: number, speed: number): number {
  return 0.5 * density(altitude) * speed * speed
}

// A piecewise-linear sound speed curve through the troposphere and
// stratosphere -- enough to make "Mach 1 below 10 km" mean something.
export function speedOfSound(altitude: number): number {
  if (altitude < 11_000) return 340 - (altitude / 11_000) * 45
  if (altitude < 20_000) return 295
  return 295 + Math.min(1, (altitude - 20_000) / 30_000) * 35
}

// Horizontal wind (m/s, positive = east / +x in local "surface" terms) with
// a gusty shear band between 6 and 14 km. `t` is flight time, so gusts
// shift as you climb through them.
export function windAt(altitude: number, t: number, seed: number): number {
  if (altitude > 20_000) return 0
  const base = 6 * Math.min(1, altitude / 2000)
  let shear = 0
  if (altitude > 6_000 && altitude < 14_000) {
    const band = Math.sin(((altitude - 6_000) / 8_000) * Math.PI)
    shear = band * (28 * Math.sin(t * 0.7 + seed) + 14 * Math.sin(t * 2.3 + seed * 3.1))
  }
  return base + shear
}

// Re-entry heating proxy: ρ·v³ scaled so a 1.5 km/s dive at ~30 km lands
// around 1.0 (enough to cook a lawn chair; a bathtub is fine).
export function heatFlux(altitude: number, speed: number): number {
  return (density(altitude) * speed * speed * speed) / 6e7
}

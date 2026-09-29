// The four cats (SPEC.md section 4). Physics personality lives in these
// numbers; the tap abilities themselves are executed in world.ts because
// they reach out and touch the rest of the room.

export type BreedId = 'tabby' | 'coon' | 'siamese' | 'calico'
export type AbilityId = 'zoomies' | 'slam' | 'scream' | 'swipe'

export interface Breed {
  id: BreedId
  name: string
  nickname: string
  blurb: string
  radius: number // ring radius, world units
  particleRadius: number
  mass: number // whole-cat mass (Matter units)
  ringStiffness: number // lower = more liquid
  spokeStiffness: number
  pressure: number // how hard it pushes back toward its rest area
  restitution: number
  friction: number // ring particles; low so a squeezed cat keeps flowing (M0 spike)
  maxSpeed: number // launch speed at full pull, units per 1/60 s
  ability: AbilityId
  abilityUses: number
  abilityName: string
  abilityHint: string
  chaosBounce?: boolean // Tabby ricochets at random angles
  woodCrusher?: boolean // Coon: ×4 vs wood, can punch floorboards
  // palette
  fur: string
  furDark: string
  belly: string
  eye: string
}

export const BREEDS: Record<BreedId, Breed> = {
  tabby: {
    id: 'tabby',
    name: 'Orange Tabby',
    nickname: 'Chaos Neutral',
    blurb: 'One brain cell, zero dampening. Ricochets off hard things at angles nobody predicted.',
    radius: 26,
    particleRadius: 8,
    mass: 8,
    ringStiffness: 0.35,
    spokeStiffness: 0.06,
    pressure: 1.1,
    restitution: 0.85,
    friction: 0.03, // low: liquid cats pour through gaps instead of wedging
    maxSpeed: 27,
    ability: 'zoomies',
    abilityUses: 1,
    abilityName: 'Zoomies',
    abilityHint: 'Tap mid-air for a burst of speed.',
    chaosBounce: true,
    fur: '#f29a3a',
    furDark: '#c2661b',
    belly: '#ffd9a8',
    eye: '#9be15d',
  },
  coon: {
    id: 'coon',
    name: 'Maine Coon',
    nickname: 'Heavy Chonk',
    blurb: 'Slow, low and enormous. Bulldozes wood and goes straight through floorboards.',
    radius: 34,
    particleRadius: 10,
    mass: 26,
    ringStiffness: 0.6,
    spokeStiffness: 0.14,
    pressure: 1.4,
    restitution: 0.1,
    friction: 0.15, // low: liquid cats pour through gaps instead of wedging
    maxSpeed: 21,
    ability: 'slam',
    abilityUses: 1,
    abilityName: 'Chonk Slam',
    abilityHint: 'Tap mid-air to drop straight down like a sack of bricks.',
    woodCrusher: true,
    fur: '#6b5646',
    furDark: '#3f3129',
    belly: '#c9b39a',
    eye: '#f2c14e',
  },
  siamese: {
    id: 'siamese',
    name: 'Siamese',
    nickname: 'The Screamer',
    blurb: 'Light, fast and LOUD. One meow shatters thin glass and wakes the dog.',
    radius: 24,
    particleRadius: 7.5,
    mass: 6,
    ringStiffness: 0.35,
    spokeStiffness: 0.06,
    pressure: 1.1,
    restitution: 0.3,
    friction: 0.03, // low: liquid cats pour through gaps instead of wedging
    maxSpeed: 29,
    ability: 'scream',
    abilityUses: 1,
    abilityName: 'Screamer Meow',
    abilityHint: 'Tap mid-air to MEOW — thin glass nearby shatters.',
    fur: '#f1e6d2',
    furDark: '#4a3a33',
    belly: '#fff7ea',
    eye: '#5fb7ff',
  },
  calico: {
    id: 'calico',
    name: 'Calico',
    nickname: 'Precision Swatter',
    blurb: 'Measured, judgmental, deadly accurate. Swats trinkets off shelves mid-flight.',
    radius: 26,
    particleRadius: 8,
    mass: 8,
    ringStiffness: 0.35,
    spokeStiffness: 0.07,
    pressure: 1.1,
    restitution: 0.25,
    friction: 0.04, // low: liquid cats pour through gaps instead of wedging
    maxSpeed: 25,
    ability: 'swipe',
    abilityUses: 3,
    abilityName: 'Paw Swipe',
    abilityHint: 'Tap mid-air to swat everything small within reach (3 swats).',
    fur: '#f4efe6',
    furDark: '#2d2522',
    belly: '#fffaf2',
    eye: '#e8b33d',
  },
}

export const BREED_ORDER: BreedId[] = ['tabby', 'coon', 'siamese', 'calico']

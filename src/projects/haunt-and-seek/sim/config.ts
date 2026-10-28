// Every tuning number in Haunt & Seek, the four ghosts and their abilities,
// the difficulties and the six manors. The rules (world.ts and friends) read
// from here; the balance bot (balance.test.ts) is what these were tuned
// against.
import { MANOR_MAPS } from './manors'

export type GhostId = 'ember' | 'blush' | 'drizzle' | 'marm'

export type AbilityId =
  // Offense, by ghost: primary, utility, ultimate.
  | 'swoop'
  | 'snuff'
  | 'behind'
  | 'wallflower'
  | 'mirror'
  | 'hallway'
  | 'slime'
  | 'trick'
  | 'party'
  | 'thump'
  | 'wail'
  | 'goo'
  // Defense, for every ghost during a Sugar Rush.
  | 'slip'
  | 'decoy'
  | 'dash'

export const TUNING = {
  step: 1 / 60,

  // Snaxley, in tiles per second.
  snaxSpeed: 1.9,
  hungerSpeed: 0.35, // speed × (1 + this × hunger)
  munch: 0.15, // seconds per sweet
  rushSpeed: 1.2,
  spookSpeed: 1.45,
  fleeSpeed: 1.8,
  blindSpeed: 1.5,
  skidSpeed: 2.2,

  // His senses.
  visionRange: 6,
  visionHalfAngle: (35 * Math.PI) / 180,
  snuffRange: 3,
  snuffHalfAngle: (20 * Math.PI) / 180,
  hearRange: 1.8, // a moving ghost this close makes him look round
  seenThreshold: 1, // seconds in his headlamp before a scare is "seen coming"
  seenDecay: 0.25, // per second out of sight
  seenMul: 0.5,

  // Fear.
  habitMul: 0.6,
  habitFloor: 0.3,
  comboWindow: 2.5,
  comboMul: 1.5,
  subtleResist: 0.5, // subtle scares × (1 − this × hunger)
  bigResist: 0.25,
  decayDelay: 6,
  decayRate: 0.5,
  tier: 25,
  stumbleFrom: 40,
  stumbleRate: 0.15, // chance per second at 100% fear
  stumbleTime: 0.6,
  wrongTurn: 0.4, // chance at an intersection × fear (above stumbleFrom)

  // Danger: a per-tile heat he routes around.
  dangerHalfLife: 3.1, // seconds (about 20% a second)
  dangerCost: 6,
  slimeCost: 4,
  wailRadius: 3,

  // The ghosts.
  ghostSpeed: 3.4,
  ghostRadius: 0.3,
  swapCooldown: 1,
  helperScare: 0.5, // scares by ghosts the player isn't flying count for less
  ectoMax: 100,
  ectoStart: 50,
  ectoRegen: 2.5,
  ectoRefund: 0.25,
  wispEvery: 6,
  wispMax: 4,
  wispValue: 15,
  wispMinDist: 6,
  wispPickup: 0.6,

  // Sugar Rush.
  rushSense: 8,
  bonkRange: 0.6,
  bonkFear: 8,
  bonkEcto: 10,
  respawn: 4,
} as const

export interface AbilityDef {
  id: AbilityId
  name: string
  icon: string
  cost: number
  // The scare's base fear (per second for ultimates that hold him).
  fear: number
  cooldown: number
  blurb: string
  // Defense: costs fear from the meter instead of (or as well as) ecto.
  fearCost?: number
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  swoop: { id: 'swoop', name: 'Swoop', icon: '💨', cost: 20, fear: 15, cooldown: 4, blurb: 'Dash 3 tiles, even through a wall. End right next to him: BOO!' },
  snuff: { id: 'snuff', name: 'Lantern Snuff', icon: '🕯️', cost: 30, fear: 8, cooldown: 10, blurb: 'Fade out this hallway’s lanterns. He freezes when he walks in.' },
  behind: { id: 'behind', name: 'Right Behind You', icon: '👣', cost: 70, fear: 20, cooldown: 45, blurb: 'Go invisible and tiptoe right behind him, then send him running blind.' },
  wallflower: { id: 'wallflower', name: 'Wallflower', icon: '🖼️', cost: 20, fear: 18, cooldown: 4, blurb: 'Hide in the wall as a portrait. Burst out when he walks past!' },
  mirror: { id: 'mirror', name: 'Mirror Wall', icon: '🪞', cost: 30, fear: 6, cooldown: 10, blurb: 'A fake wall in front of you. He thinks the way is blocked.' },
  hallway: { id: 'hallway', name: 'Endless Hallway', icon: '🌀', cost: 70, fear: 4, cooldown: 45, blurb: 'He runs and runs but goes nowhere, and can’t eat a thing.' },
  slime: { id: 'slime', name: 'Slime Spit', icon: '🫧', cost: 20, fear: 10, cooldown: 4, blurb: 'A slippery puddle. He skids down the hall and bonks the wall.' },
  trick: { id: 'trick', name: 'Trick Treat', icon: '🍬', cost: 30, fear: 12, cooldown: 10, blurb: 'A sparkly fake sweet he can’t resist. It fizzes in his face.' },
  party: { id: 'party', name: 'Poltergeist Party', icon: '🪑', cost: 70, fear: 3, cooldown: 45, blurb: 'Make the furniture dance. Near you, he can’t steer straight.' },
  thump: { id: 'thump', name: 'Wall Thump', icon: '💥', cost: 20, fear: 12, cooldown: 4, blurb: 'A shockwave through the walls. Knocks the sweet right out of his paws.' },
  wail: { id: 'wail', name: 'Wail', icon: '📣', cost: 30, fear: 6, cooldown: 10, blurb: 'A spooky moan from up ahead. He turns and goes the other way.' },
  goo: { id: 'goo', name: 'Gloom Goo', icon: '🟣', cost: 70, fear: 5, cooldown: 45, blurb: 'Turn the nearest crossroads into goo. He gets stuck fast.' },
  slip: { id: 'slip', name: 'Wall Slip', icon: '🧱', cost: 15, fear: 0, cooldown: 3, blurb: 'Slip into the walls for a moment. He can’t bonk you there.' },
  decoy: { id: 'decoy', name: 'Ecto-Decoy', icon: '🍮', cost: 25, fear: 0, cooldown: 6, blurb: 'Leave a wobbly jelly ghost. He stops to eat it.' },
  dash: { id: 'dash', name: 'Desperation Dash', icon: '🏃', cost: 0, fear: 0, fearCost: 10, cooldown: 8, blurb: 'Double speed for 3 s. Costs 10 fear. Get home!' },
}

export const DEFENSE: [AbilityId, AbilityId, AbilityId] = ['slip', 'decoy', 'dash']

export interface GhostDef {
  id: GhostId
  name: string
  color: string
  role: string
  abilities: [AbilityId, AbilityId, AbilityId]
}

export const GHOSTS: GhostDef[] = [
  { id: 'ember', name: 'Ember', color: '#f87171', role: 'Chaser', abilities: ['swoop', 'snuff', 'behind'] },
  { id: 'blush', name: 'Blush', color: '#f9a8d4', role: 'Ambusher', abilities: ['wallflower', 'mirror', 'hallway'] },
  { id: 'drizzle', name: 'Drizzle', color: '#67e8f9', role: 'Trickster', abilities: ['slime', 'trick', 'party'] },
  { id: 'marm', name: 'Marm', color: '#fdba74', role: 'Heavy', abilities: ['thump', 'wail', 'goo'] },
]

export function ghostDef(id: GhostId): GhostDef {
  return GHOSTS.find((g) => g.id === id)!
}

export type DifficultyId = 'little' | 'spooky' | 'very'

export interface DifficultyDef {
  id: DifficultyId
  name: string
  blurb: string
  speedMul: number // Snaxley's speed
  scareMul: number
  ectoMul: number // passive refill
  wispEvery: number
}

export const DIFFICULTIES: DifficultyDef[] = [
  { id: 'little', name: 'Little Ghost', blurb: 'A slower Snaxley, bigger scares, more ecto.', speedMul: 0.85, scareMul: 1.3, ectoMul: 1.5, wispEvery: 6 },
  { id: 'spooky', name: 'Spooky', blurb: 'The way it’s meant to be haunted.', speedMul: 1, scareMul: 1, ectoMul: 1, wispEvery: 6 },
  { id: 'very', name: 'Very Spooky', blurb: 'A quicker Snaxley, tougher nerves, fewer wisps.', speedMul: 1.1, scareMul: 0.85, ectoMul: 1, wispEvery: 9 },
]

export function difficultyDef(id: DifficultyId): DifficultyDef {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1]
}

export interface ManorDef {
  name: string
  map: readonly string[]
  ghosts: GhostId[]
  ultimates: boolean
  rushSeconds: number
  speedMul: number
  habitWindow: number
  visionMul: number // the Attic is darker
  briefing: string[]
}

export const MANORS: ManorDef[] = [
  {
    name: 'The Foyer',
    map: MANOR_MAPS[0],
    ghosts: ['ember', 'blush'],
    ultimates: false,
    rushSeconds: 8,
    speedMul: 0.85,
    habitWindow: 15,
    visionMul: 1,
    briefing: [
      'Snaxley the raccoon has crept in through the front door, and he wants every sweet in the house.',
      'Sneak up behind him and BOO! Scares from out of his headlamp’s view count double.',
      'Ember Swoops. Blush hides in the walls. Two ghosts scaring him close together make a Boo-Combo.',
    ],
  },
  {
    name: 'The Library',
    map: MANOR_MAPS[1],
    ghosts: ['ember', 'blush', 'drizzle'],
    ultimates: false,
    rushSeconds: 8,
    speedMul: 0.92,
    habitWindow: 15,
    visionMul: 1,
    briefing: [
      'Drizzle joins the haunt: slippery slime and fizzing Trick Treats.',
      'Watch the glowing gumballs! One gives Snaxley a Sugar Rush, and he’ll chase YOU.',
      'During a Sugar Rush your buttons turn into escapes. Slip into a wall, drop a jelly decoy, or dash home.',
    ],
  },
  {
    name: 'The Conservatory',
    map: MANOR_MAPS[2],
    ghosts: ['ember', 'blush', 'drizzle', 'marm'],
    ultimates: true,
    rushSeconds: 8,
    speedMul: 1,
    habitWindow: 15,
    visionMul: 1,
    briefing: [
      'Marm, the big orange one, thumps walls and wails to herd Snaxley around.',
      'Ultimates unlocked! Only the ghost you’re flying can use one, so swap ghosts to use them.',
    ],
  },
  {
    name: 'The Kitchen',
    map: MANOR_MAPS[3],
    ghosts: ['ember', 'blush', 'drizzle', 'marm'],
    ultimates: true,
    rushSeconds: 6,
    speedMul: 1.05,
    habitWindow: 15,
    visionMul: 1,
    briefing: ['Snaxley smelled the kitchen and he’s extra hungry, so he’s a little faster.', 'Sugar Rushes are shorter here, but there are more gumballs.'],
  },
  {
    name: 'The Attic',
    map: MANOR_MAPS[4],
    ghosts: ['ember', 'blush', 'drizzle', 'marm'],
    ultimates: true,
    rushSeconds: 6,
    speedMul: 1.1,
    habitWindow: 15,
    visionMul: 0.75,
    briefing: ['Hardly any lanterns up here. His headlamp doesn’t reach as far, but you can’t see far either.'],
  },
  {
    name: 'The Great Hall',
    map: MANOR_MAPS[5],
    ghosts: ['ember', 'blush', 'drizzle', 'marm'],
    ultimates: true,
    rushSeconds: 6,
    speedMul: 1.15,
    habitWindow: 25,
    visionMul: 1,
    briefing: [
      'The biggest room in Hollowmere, and the most sweets.',
      'Snaxley gets used to the same trick faster here, so mix up your scares.',
    ],
  },
]

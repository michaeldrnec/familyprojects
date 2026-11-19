// Every name and message the game shows, written ahead of time and checked
// word by word with isFamilySafe in content.test.ts.

export const NAMES = [
  'Maya', 'Priya', 'Rosa', 'Hannah', 'Aisha', 'Mei', 'Grace', 'Lucia', 'Nora', 'Fatima',
  'Ingrid', 'Keiko', 'Amara', 'Sofia', 'Leah', 'Yuna', 'Zara', 'Elena', 'Ruth', 'Imani',
  'Chloe', 'Anika', 'Beatriz', 'Olga', 'Tamar', 'Nia', 'Freya', 'Lin', 'Carmen', 'Dana',
  'Esther', 'Willa', 'Joy', 'Paloma', 'Ada', 'Thandi', 'Mira', 'Rania', 'Siobhan', 'Ivy',
]

export const ITEM_LABELS = {
  pitocin: { name: 'Pitocin', short: 'Pit', icon: '💧' },
  epidural: { name: 'Epidural', short: 'Epi', icon: '💉' },
  magnesium: { name: 'Magnesium', short: 'Mag', icon: '🧪' },
  oxygen: { name: 'Oxygen mask', short: 'O₂', icon: '😷' },
} as const

export const ACTION_LABELS = {
  pitocin: { name: 'Pitocin', icon: '💧' },
  epidural: { name: 'Epidural', icon: '💉' },
  magnesium: { name: 'Magnesium', icon: '🧪' },
  oxygen: { name: 'Oxygen', icon: '😷' },
  reposition: { name: 'Reposition', icon: '🔄' },
  deliver: { name: 'Deliver', icon: '👶' },
  codeStork: { name: 'Code Stork', icon: '🚨' },
} as const

export const CONDITION_LABELS = {
  NORMAL: 'Laboring',
  STALLED_LABOR: 'Stalled',
  FETAL_DISTRESS: 'Fetal distress',
  PREECLAMPSIA: 'Preeclampsia',
} as const

// Why an action can't be done right now.
export const REASONS = {
  triage: 'Still in triage',
  inOr: 'In the OR',
  notYet: 'Not at 10 cm yet',
  ready: 'Ready to deliver!',
  need: 'Get it from Supply',
  hasEpidural: 'Already has one',
  tooLate: 'Too late (past 8 cm)',
  notNeeded: 'Not needed',
  calm: 'Baby is fine',
  resting: 'Just moved her',
  noComplication: 'Only for complications',
  orBusy: 'The OR is busy',
  locked: 'Not on this shift',
} as const

export const MESSAGES = {
  arrival: (name: string) => `${name} has arrived in triage.`,
  toBay: (name: string, bay: number) => `${name} is settled in Bay ${bay}.`,
  stalled: (name: string) => `${name}’s labor has stalled.`,
  distress: (name: string) => `${name}’s baby is in distress!`,
  preeclampsia: (name: string) => `${name} has preeclampsia. Watch her stress.`,
  crisis: (name: string) => `${name}’s blood pressure spiked! Baby in distress!`,
  ready: (name: string) => `${name} is at 10 cm. Time to deliver!`,
  delivered: (name: string, stars: number) => `${name}’s baby is here! ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`,
  csection: (name: string, stars: number) => `Code Stork success! ${name}’s baby is here! ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`,
  midwife: (name: string) => `The midwife delivered ${name}’s baby while you were busy.`,
  transfer: (name: string) => `The specialist team rushed in to take over for ${name}. Mom and baby are in good hands.`,
  codeStork: (name: string) => `Code Stork! ${name} is on her way to the OR. Scrub in!`,
  scrubbed: 'Scrubbed in. Head to the OR.',
  scrubFirst: 'Scrub in at the sink before surgery.',
  handsFull: 'Your hands are full. Tap an item to put it back.',
  doubledPitocin: 'Doubling up on Pitocin is risky for the baby.',
  epidural: (name: string) => `${name} is comfortable now.`,
  magnesium: (name: string) => `Magnesium is calming ${name}’s blood pressure.`,
  stabilized: (name: string) => `${name}’s baby is steady, for now.`,
  pitocin: (name: string) => `Pitocin started for ${name}.`,
  restarted: (name: string) => `Pitocin got ${name}’s labor moving again.`,
} as const

// A title for the shift, by its stars.
export const RANKS = ['A rough night on the floor', 'Steady Hands', 'Charge Doctor', 'Chief of the Stork Squad'] as const

export const RESULT_LINES = {
  complete: 'Shift complete! Time to hand over to the day team.',
  sentHome: 'The specialist team took over the floor. Rest up and try again.',
} as const

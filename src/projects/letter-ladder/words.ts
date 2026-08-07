// Small curated word list for the ladder validator + puzzle generator.
// Common 3-letter English words, all same length so ladder steps are
// single-letter substitutions.
export const WORDS_3: string[] = [
  'CAT', 'COT', 'COG', 'DOG', 'DOT', 'DOE', 'CAR', 'BAT', 'BAG', 'BIG', 'BID',
  'BIT', 'BET', 'BED', 'BEG', 'LOG', 'LOT', 'LID', 'LIP', 'LAP', 'MAP', 'MAT',
  'MAN', 'MAD', 'MOD', 'MOP', 'MOB', 'MOM', 'MOO', 'MOW', 'NOW', 'NOT', 'NUT',
  'HOT', 'HOP', 'HIP', 'HIT', 'HAT', 'HAM', 'HEM', 'HEN', 'TEN', 'TAN', 'TAP',
  'TOP', 'TOE', 'TIE', 'DIE', 'DYE', 'DAY', 'BAY', 'BOY', 'TOY', 'JOY', 'JAB',
  'JAM', 'JAR', 'JOG', 'FOG', 'FIG', 'FIN', 'FAN', 'FAT', 'FIT', 'SIT', 'SIP',
  'SAP', 'SAD', 'SAW', 'SOW', 'SON', 'SUN', 'FUN', 'RUN', 'RUG', 'RAG', 'RAT',
  'RAW', 'ROW', 'COW', 'COP', 'CAP', 'CAB', 'CUB', 'CUT', 'CUP', 'PUP', 'PIN',
  'PIG', 'PAT', 'PAD', 'PAN', 'PAY', 'POT', 'POP', 'PEN', 'PET', 'PEA', 'SEA',
  'SEE', 'BEE',
]

export const WORD_SET = new Set(WORDS_3.map((w) => w.toUpperCase()))

export function isValidWord(word: string): boolean {
  return WORD_SET.has(word.toUpperCase())
}

export function isOneLetterOff(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff++
    if (diff > 1) return false
  }
  return diff === 1
}

export interface Puzzle {
  start: string
  end: string
}

// Each pair below is verified reachable via WORD_SET (checked with a BFS),
// e.g. CAT -> COT -> COG -> DOG
export const PUZZLES: Puzzle[] = [
  { start: 'CAT', end: 'DOG' }, // CAT -> COT -> COG -> DOG
  { start: 'PIG', end: 'RUN' }, // PIG -> FIG -> FIN -> FUN -> RUN
  { start: 'SUN', end: 'SEA' }, // SUN -> FUN -> FIN -> PIN -> PEN -> PEA -> SEA
]

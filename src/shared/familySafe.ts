// One family-safe word filter for every word game on the site. Puzzles are
// generated at random, so players never choose which words appear -- this
// keeps profanity, slurs and sexual terms out of puzzles, and stops them
// counting as valid answers.
//
// It is deliberately not a list of "grown-up topics": ordinary words like
// DRUG, KILL or CASINO, and identity words like GAY or LESBIAN, are fine.
//
// Two lists: whole words, and roots that are never innocent inside a longer
// word (so FUCKER and SHITTY are caught too). Roots that do appear inside
// innocent words (ASS in CLASS, SEX in SEXTANT, RAPE in GRAPE, COCK in
// PEACOCK, TWAT in SALTWATER, WANK in SWANK) belong in the whole-word list
// instead.

const BLOCKED_WORDS = new Set([
  'ANAL', 'ANUS', 'ARSE', 'ARSES', 'ASS', 'ASSES', 'ASSHOLE', 'ASSHOLES', 'BASTARD', 'BASTARDS',
  'BONDAGE', 'BOOB', 'BOOBS', 'BOOBIES', 'CHINK', 'CHINKS', 'COCK', 'COCKS', 'COON', 'COONS',
  'CRAP', 'CRAPPY', 'CUM', 'DAMN', 'DAMNED', 'DAMNIT', 'DICK', 'DICKS', 'DOUCHE', 'DYKE',
  'DYKES', 'EROTIC', 'EROTICA', 'ERECTION', 'FAG', 'FAGS', 'FETISH', 'FETISHES', 'GOOK', 'GOOKS',
  'HELL', 'HOMO', 'HOMOS', 'HORNY', 'JAP', 'JAPS', 'KIKE', 'KIKES', 'KINKY', 'NAKED',
  'NUDE', 'NUDES', 'NUDITY', 'PENIS', 'PENISES', 'PIMP', 'PIMPS', 'PISS', 'PISSED', 'PISSES',
  'PISSING', 'RAPE', 'RAPED', 'RAPES', 'RAPING', 'RAPIST', 'RAPISTS', 'RETARD', 'RETARDED', 'RETARDS',
  'SCROTUM', 'SEX', 'SEXES', 'SEXIER', 'SEXIEST', 'SEXUAL', 'SEXUALLY', 'SEXY', 'SKANK', 'SPAZ',
  'SPIC', 'SPICS', 'STRIPPER', 'STRIPPERS', 'TESTICLE', 'TESTICLES', 'TIT', 'TITS', 'TITTY', 'TITTIES',
  'TRANNY', 'TWAT', 'TWATS', 'VAGINA', 'VAGINAS', 'WANK', 'WANKED', 'WANKER', 'WANKERS', 'WANKING',
  'WANKS', 'WETBACK', 'WETBACKS', 'WOP', 'WOPS',
])

const BLOCKED_ROOTS = [
  'BITCH', 'BOLLOCK', 'CUNT', 'DILDO', 'FAGGOT', 'FUCK', 'JIZZ', 'MASTURBAT', 'NIGGA',
  'NIGGER', 'ORGASM', 'PAEDOPHIL', 'PEDOPHIL', 'PORN', 'SHIT', 'SLUT', 'WHORE',
]

export function isFamilySafe(word: string): boolean {
  const upper = word.trim().toUpperCase()
  if (BLOCKED_WORDS.has(upper)) return false
  return !BLOCKED_ROOTS.some((root) => upper.includes(root))
}

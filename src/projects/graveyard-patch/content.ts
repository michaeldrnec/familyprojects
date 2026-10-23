// Every line of text the night can show: bug titles, Chirp posts, teammate
// messages. All written ahead of time (content.test.ts runs every word
// through isFamilySafe). The game you're keeping alive is Galaxy Gardeners.
import type { GameKind, Severity } from './sim/config'

export interface Handle {
  name: string
  avatar: string
}

export const PLAYERS: Handle[] = [
  { name: '@pixel_pam', avatar: '🦄' },
  { name: '@speedrun_sid', avatar: '🏃' },
  { name: '@gardengran', avatar: '👵' },
  { name: '@moss_boss', avatar: '🌿' },
  { name: '@turnip_tim', avatar: '🥕' },
  { name: '@lil_leafy', avatar: '🍃' },
  { name: '@comet_kid', avatar: '☄️' },
  { name: '@sprout_queen', avatar: '👑' },
  { name: '@captain_compost', avatar: '🧑‍🚀' },
  { name: '@beetle_bex', avatar: '🐞' },
  { name: '@nova_nan', avatar: '🌟' },
  { name: '@froggo_fan', avatar: '🐸' },
  { name: '@rake_runner', avatar: '🧹' },
  { name: '@petal_pete', avatar: '🌸' },
]

export const STREAMER: Handle = { name: '@StreamQueenZara', avatar: '🎥' }
export const TEAMMATE: Handle = { name: '@kai_in_sydney', avatar: '🦘' }

export const TITLES: Record<Severity, Record<GameKind, string[]>> = {
  P3: {
    hunt: [
      'Space carrots render upside down',
      'Shop button is two pixels off',
      'Moon tulips flicker purple',
      'Hat clips through the space helmet',
      'Credits scroll backwards',
      'Font turns into tiny squares',
      'Cloud shadows are bright pink',
      'Gnome statue blinks (it should not blink)',
    ],
    unravel: [
      'Watering can floats above your hand',
      'Pause menu opens sideways',
      'Map icons pile up in one corner',
      'Inventory grid overlaps itself',
      'Tooltip wires tangled on the star map',
    ],
  },
  P1: {
    hunt: [
      'Saves vanish after harvesting a moon melon',
      'Infinite seed glitch crashes the market',
      'Achievement spam fills the save file',
      'Trading two pumpkins duplicates the planet',
    ],
    unravel: [
      'Memory leak in the comet greenhouse',
      'Rocket garage eats all the memory',
      'Game freezes when two players hug a tree',
      'Garden sync loops forever',
    ],
  },
  P0: {
    hunt: ['Server fire: login servers are down', 'Server fire: matchmaking melted'],
    unravel: ['Server fire: every garden is on the wrong planet', 'Server fire: the database stopped answering'],
  },
}

export const COMPLAINTS: Record<Severity, string[]> = {
  P3: [
    'the carrots are upside down again. i am fine. everything is fine.',
    'why is the shop button doing a little dance',
    'not a big deal but my gnome just winked at me',
    'tiny glitch, still love this game. please fix tho',
    'is it supposed to look like that? asking for a friend',
    'my space helmet has a hat sticking out of it lol',
    'the clouds are pink now. kinda cute? still a bug',
    'one star until the tulips stop flickering. ok two stars',
  ],
  P1: [
    'my 400 hour garden is GONE. GONE.',
    'game crashed three times in ten minutes 😤',
    'lost my whole harvest. not happy, devs',
    'my save file is now the size of a small moon',
    'everything froze right before i planted the golden bean',
    'the market crashed and took my pumpkins with it',
  ],
  P0: [
    'IS ANYONE AWAKE AT THIS STUDIO 🚨',
    'servers down. tell my plants i love them',
    'cannot log in. cannot garden. cannot cope.',
    'whole server is on fire, metaphorically. i hope.',
  ],
}

export const THANKS = [
  'ok the patch fixed it. thank you night shift dev 🙏',
  'carrots are right side up. we are so back',
  'patch notes just dropped and they actually fixed stuff??',
  'whoever is awake at the studio: you are a hero',
  'game feels smooth again. five stars, back on the menu',
  'my garden is safe. i can sleep now. unlike the devs',
]

export const BROKEN = [
  'uhh the patch broke the patch??',
  'new update and now NOTHING loads. what happened',
  'they shipped a fix for the fix and it needs a fix',
]

export const STREAMER_BUG = 'Streamer bug: planting a seed launches you into orbit'
export const STREAMER_POST = 'LOL chat look at this. i planted ONE seed 🚀🚀🚀 (48k watching)'
export const DUPE_POSTS = [
  'saw it on stream, same thing happened to me!!',
  'just tried it. i am in orbit now. send help',
  'ORBIT SEED IS REAL',
  'came from the stream. can confirm, very orbit',
  'my turnip is also in orbit',
]

export const TEAM_PUSH = [
  'good morning from Sydney! pushed a few commits to main ☕',
  'just merged my branch, hope that’s ok!',
  'quick refactor before breakfast, should be harmless 🙂',
  'renamed some files. you won’t even notice!',
]
export const CONFLICT_TITLES = [
  'Merge conflict: teammate renamed the garden module',
  'Merge conflict: two versions of the seed shop',
  'Merge conflict: the build script changed overnight',
]

export const PHANTOM_TOAST = [
  'That ticket was never there. You need sleep.',
  'Huh. It vanished. Were you dreaming?',
  'No bug here. Just your tired brain.',
]

// The code Bug Hunt's bugs crawl across.
export const CODE_LINES = [
  'function plantSeed(garden, seed) {',
  '  if (!seed.isReady) return',
  '  garden.add(seed)',
  '  water(garden, 2)',
  '}',
  '',
  'function harvest(planet) {',
  '  for (const melon of planet.melons) {',
  '    basket.push(melon)',
  '  }',
  '  save(game)',
  '}',
  '',
  'const rocket = launch({ fuel: 100 })',
  'rocket.flyTo(moon)',
]

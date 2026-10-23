// The one list of every game on the site. The homepage grid, the routes,
// the full-viewport layout and the header all read from here, so adding a
// game means adding one entry (see the new-game checklist in CLAUDE.md).
// Newest last: the last entry is the homepage's featured card.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const RELOAD_FLAG = 'familyprojects:chunk-reload'

// lazy() that recovers from a stale deploy: a tab opened before a new
// version went live asks for game code that no longer exists, so the
// import fails. Reloading once picks up the new version; the flag stops a
// genuinely broken chunk (or being offline) from reloading forever.
function lazyGame(load: () => Promise<{ default: ComponentType }>): LazyExoticComponent<ComponentType> {
  return lazy(() =>
    load().then(
      (mod) => {
        try {
          sessionStorage.removeItem(RELOAD_FLAG)
        } catch {
          // storage unavailable
        }
        return mod
      },
      (err: unknown) => {
        let reloaded = true
        try {
          reloaded = sessionStorage.getItem(RELOAD_FLAG) === '1'
          if (!reloaded) sessionStorage.setItem(RELOAD_FLAG, '1')
        } catch {
          // storage unavailable -- don't risk a reload loop
        }
        if (!reloaded && navigator.onLine) window.location.reload()
        throw err
      },
    ),
  )
}

export const CATEGORIES = ['Words & Learning', 'Puzzles', 'Space Arcade', 'Physics Mayhem', 'Arcade Chaos'] as const
export type Category = (typeof CATEGORIES)[number]

export interface Project {
  slug: string
  title: string
  description: string
  category: Category
  icon: string // a single emoji/glyph used as the project's badge
  accent: string // the project's signature color, used for glows and tints
  // Loaded on demand, so the homepage doesn't download every game.
  component: LazyExoticComponent<ComponentType>
  // Fills the viewport below the header instead of the centered, scrolling
  // article column (canvas games).
  fullscreen?: boolean
  // A logo shown next to the site logo in the header while playing.
  headerLogo?: { src: string; alt: string }
}

export const projects: Project[] = [
  {
    slug: 'letter-ladder',
    title: 'Letter Ladder',
    description: 'Change one letter at a time to climb from the start word to the end word.',
    category: 'Words & Learning',
    icon: '🪜',
    accent: '#4ade80',
    component: lazyGame(() => import('./projects/letter-ladder/LetterLadder')),
  },
  {
    slug: 'trigaword',
    title: 'Trigaword',
    description: 'Fill in the letter pyramid — every row is a word, from 2 letters up to 8.',
    category: 'Words & Learning',
    icon: '🔺',
    accent: '#facc15',
    component: lazyGame(() => import('./projects/trigaword/Trigaword')),
  },
  {
    slug: 'sentence-spin',
    title: 'Sentence Spin',
    description: 'Spin the wheel for a letter and build a themed sentence, 7 words or more.',
    category: 'Words & Learning',
    icon: '🎡',
    accent: '#f472b6',
    component: lazyGame(() => import('./projects/sentence-spin/SentenceSpin')),
  },
  {
    slug: 'flashigana',
    title: 'Flashigana',
    description: 'Hiragana flashcards — pick the right romaji reading for each character.',
    category: 'Words & Learning',
    icon: 'あ',
    accent: '#f87171',
    component: lazyGame(() => import('./projects/flashigana/Flashigana')),
  },
  {
    slug: 'rainglow',
    title: 'Rainglow',
    description: 'Mix colored lenses to match the target color — 10 levels, N lenses for level N.',
    category: 'Puzzles',
    icon: '🌈',
    accent: '#a78bfa',
    component: lazyGame(() => import('./projects/rainglow/Rainglow')),
  },
  {
    slug: 'lexicon',
    title: 'LexiCon',
    description: 'Multiple-choice trivia — pick a round length and see how many you get right.',
    category: 'Words & Learning',
    icon: '🧠',
    accent: '#60a5fa',
    component: lazyGame(() => import('./projects/lexicon/LexiCon')),
  },
  {
    slug: 'gravity-well',
    title: 'Gravity Well',
    description: 'Aim your rocket home to Earth, bending its path around asteroids, planets, and stars.',
    category: 'Space Arcade',
    icon: '🚀',
    accent: '#38bdf8',
    component: lazyGame(() => import('./projects/gravity-well/GravityWell')),
    fullscreen: true,
    headerLogo: { src: '/gravity_well_header.webp', alt: 'Gravity Well' },
  },
  {
    slug: 'xenofuse',
    title: 'Xenofuse',
    description: 'Decipher the alien glyphs and defuse each panel before the shared timer hits zero.',
    category: 'Puzzles',
    icon: '👽',
    accent: '#34d399',
    component: lazyGame(() => import('./projects/xenofuse/Xenofuse')),
  },
  {
    slug: 'starwarden',
    title: 'Starwarden',
    description: 'Hold the line in a scrolling alien warzone — survive as long as fuel and power crystals last.',
    category: 'Space Arcade',
    icon: '🛸',
    accent: '#a3e635',
    component: lazyGame(() => import('./projects/starwarden/Starwarden')),
    fullscreen: true,
    headerLogo: { src: '/StarwardenHeader.svg', alt: 'Starwarden' },
  },
  {
    slug: 'solar-ward',
    title: 'Solar Ward',
    description: 'Orbit a dying star and intercept photon beams and diving fighters before they reach the core.',
    category: 'Space Arcade',
    icon: '☀️',
    accent: '#fb923c',
    component: lazyGame(() => import('./projects/solar-ward/SolarWard')),
    fullscreen: true,
  },
  {
    slug: 'ion-perimeter',
    title: 'Ion Perimeter',
    description: 'Build and upgrade weapon platforms along a space lane to hold your outpost core for 20 waves.',
    category: 'Space Arcade',
    icon: '🛰️',
    accent: '#67e8f9',
    component: lazyGame(() => import('./projects/ion-perimeter/IonPerimeter')),
    fullscreen: true,
  },
  {
    slug: 'scrapyard-ballistics',
    title: 'Scrapyard Ballistics',
    description: 'Bolt a rocket together from lawn mower engines and soda kegs, wire the staging, and fly it to orbit.',
    category: 'Physics Mayhem',
    icon: '🔧',
    accent: '#f59e0b',
    component: lazyGame(() => import('./projects/scrapyard-ballistics/ScrapyardBallistics')),
    fullscreen: true,
  },
  {
    slug: 'feline-ballistics',
    title: 'Feline Ballistics',
    description: 'It’s 3 AM. Fling squishy, liquid cats to knock the humans’ precious things off every shelf.',
    category: 'Physics Mayhem',
    icon: '🐈',
    accent: '#fb7185',
    component: lazyGame(() => import('./projects/feline-ballistics/FelineBallistics')),
    fullscreen: true,
  },
  {
    slug: 'lux-tenebris',
    title: 'Lux Tenebris',
    description: 'Every step dims your flashlight. Memorize the cave while it’s lit, then cross the dark from memory.',
    category: 'Puzzles',
    icon: '🔦',
    accent: '#fcd34d',
    component: lazyGame(() => import('./projects/lux-tenebris/LuxTenebris')),
    fullscreen: true,
  },
  {
    slug: 'invader-protocol',
    title: 'Invader Protocol',
    description: 'Break the marching alien lattice on the beat — four hot-running weapons, ventable hardlight bunkers, and a tempo that climbs as they fall.',
    category: 'Space Arcade',
    icon: '👾',
    accent: '#e879f9',
    component: lazyGame(() => import('./projects/invader-protocol/InvaderProtocol')),
    fullscreen: true,
  },
  {
    slug: 'orbital-siege',
    title: 'Orbital Siege',
    description: 'Program an orbital platform’s strike timeline to crack rogue robot fortresses, layer by layer. Every tick is deterministic.',
    category: 'Puzzles',
    icon: '🪐',
    accent: '#818cf8',
    component: lazyGame(() => import('./projects/orbital-siege/OrbitalSiege')),
    fullscreen: true,
  },
  {
    slug: 'graveyard-patch',
    title: 'Graveyard Patch',
    description: 'It’s 11 PM and launch is at 6. Squash bugs, ship patches and stay awake through the night shift.',
    category: 'Arcade Chaos',
    icon: '🦉',
    accent: '#2dd4bf',
    component: lazyGame(() => import('./projects/graveyard-patch/GraveyardPatch')),
    fullscreen: true,
  },
]

export function projectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug)
}

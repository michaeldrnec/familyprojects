export type Category = 'Words & Learning' | 'Puzzles' | 'Space Arcade' | 'Physics Mayhem'

export interface Project {
  slug: string
  title: string
  description: string
  category: Category
  icon: string // a single emoji/glyph used as the project's badge
  accent: string // the project's signature color, used for glows and tints
}

export const projects: Project[] = [
  {
    slug: 'letter-ladder',
    title: 'Letter Ladder',
    description: 'Change one letter at a time to climb from the start word to the end word.',
    category: 'Words & Learning',
    icon: '🪜',
    accent: '#4ade80',
  },
  {
    slug: 'trigaword',
    title: 'Trigaword',
    description: 'Fill in the letter pyramid — every row is a word, from 2 letters up to 8.',
    category: 'Words & Learning',
    icon: '🔺',
    accent: '#facc15',
  },
  {
    slug: 'sentence-spin',
    title: 'Sentence Spin',
    description: 'Spin the wheel for a letter and build a themed sentence, 7 words or more.',
    category: 'Words & Learning',
    icon: '🎡',
    accent: '#f472b6',
  },
  {
    slug: 'flashigana',
    title: 'Flashigana',
    description: 'Hiragana flashcards — pick the right romaji reading for each character.',
    category: 'Words & Learning',
    icon: 'あ',
    accent: '#f87171',
  },
  {
    slug: 'rainglow',
    title: 'Rainglow',
    description: 'Mix colored lenses to match the target color — 10 levels, N lenses for level N.',
    category: 'Puzzles',
    icon: '🌈',
    accent: '#a78bfa',
  },
  {
    slug: 'lexicon',
    title: 'LexiCon',
    description: 'Multiple-choice trivia — pick a round length and see how many you get right.',
    category: 'Words & Learning',
    icon: '🧠',
    accent: '#60a5fa',
  },
  {
    slug: 'gravity-well',
    title: 'Gravity Well',
    description: 'Aim your rocket home to Earth, bending its path around asteroids, planets, and stars.',
    category: 'Space Arcade',
    icon: '🚀',
    accent: '#38bdf8',
  },
  {
    slug: 'xenofuse',
    title: 'Xenofuse',
    description: 'Decipher the alien glyphs and defuse each panel before the shared timer hits zero.',
    category: 'Puzzles',
    icon: '👽',
    accent: '#34d399',
  },
  {
    slug: 'starwarden',
    title: 'Starwarden',
    description: 'Hold the line in a scrolling alien warzone — survive as long as fuel and power crystals last.',
    category: 'Space Arcade',
    icon: '🛸',
    accent: '#a3e635',
  },
  {
    slug: 'solar-ward',
    title: 'Solar Ward',
    description: 'Orbit a dying star and intercept photon beams and diving fighters before they reach the core.',
    category: 'Space Arcade',
    icon: '☀️',
    accent: '#fb923c',
  },
  {
    slug: 'ion-perimeter',
    title: 'Ion Perimeter',
    description: 'Build and upgrade weapon platforms along a space lane to hold your outpost core for 20 waves.',
    category: 'Space Arcade',
    icon: '🛰️',
    accent: '#67e8f9',
  },
  {
    slug: 'scrapyard-ballistics',
    title: 'Scrapyard Ballistics',
    description: 'Bolt a rocket together from lawn mower engines and soda kegs, wire the staging, and fly it to orbit.',
    category: 'Physics Mayhem',
    icon: '🔧',
    accent: '#f59e0b',
  },
  {
    slug: 'feline-ballistics',
    title: 'Feline Ballistics',
    description: 'It’s 3 AM. Fling squishy, liquid cats to knock the humans’ precious things off every shelf.',
    category: 'Physics Mayhem',
    icon: '🐈',
    accent: '#fb7185',
  },
]

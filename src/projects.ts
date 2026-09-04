export interface Project {
  slug: string
  title: string
  description: string
}

export const projects: Project[] = [
  {
    slug: 'letter-ladder',
    title: 'Letter Ladder',
    description: 'Change one letter at a time to climb from the start word to the end word.',
  },
  {
    slug: 'trigaword',
    title: 'Trigaword',
    description: 'Fill in the letter pyramid — every row is a word, from 2 letters up to 8.',
  },
  {
    slug: 'sentence-spin',
    title: 'Sentence Spin',
    description: 'Spin the wheel for a letter and build a themed sentence, 7 words or more.',
  },
  {
    slug: 'flashigana',
    title: 'Flashigana',
    description: 'Hiragana flashcards — pick the right romaji reading for each character.',
  },
  {
    slug: 'rainglow',
    title: 'Rainglow',
    description: 'Mix colored lenses to match the target color — 10 levels, N lenses for level N.',
  },
  {
    slug: 'lexicon',
    title: 'LexiCon',
    description: 'Multiple-choice trivia — pick a round length and see how many you get right.',
  },
  {
    slug: 'gravity-well',
    title: 'Gravity Well',
    description: 'Aim your rocket home to Earth, bending its path around asteroids, planets, and stars.',
  },
  {
    slug: 'xenofuse',
    title: 'Xenofuse',
    description: 'Decipher the alien glyphs and defuse each panel before the shared timer hits zero.',
  },
  {
    slug: 'starwarden',
    title: 'Starwarden',
    description: 'Hold the line in a scrolling alien warzone — survive as long as fuel and power crystals last.',
  },
]

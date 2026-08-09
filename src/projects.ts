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
]

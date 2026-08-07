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
]

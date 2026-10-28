// Every line of text Snaxley says, plus the how-to-play tips. All written
// ahead of time and checked word by word with isFamilySafe (content.test.ts).
import type { BarkKind } from './sim/events'

export const BARKS: Record<BarkKind, string[]> = {
  scared: ['Eek!', 'Yikes!', 'Nope nope nope!', 'Was that a sock?', 'Who said that?', 'My tail!', 'Not cool, house!', 'Eep!', 'Mama!'],
  munch: ['Mmm, toffee!', 'Crunchy!', 'Just one more...', 'Gummy!', 'Yum yum yum.', 'So sweet!', 'Snack time!'],
  rush: ['SUGAR RUSH!', 'I feel AMAZING!', 'Who’s scared now?', 'Here I come!'],
  flee: ['I’m outta here!', 'Keep the candy!', 'Never again!', 'Bye bye, spooky house!'],
  confused: ['Which way is up?', 'Fizzy!', 'My whiskers tingle!', 'Wobbly...'],
  stuck: ['My feet!', 'Sticky sticky!', 'Ew, goo!', 'Help, I’m stuck!'],
  skid: ['Whoooa!', 'Slippery!', 'Bonk!'],
  spot: ['Huh? Who’s there?', 'I see you...', 'Hello?', 'Something moved!'],
  bonk: ['Bonk!', 'Gotcha!', 'Boop!', 'Tag, you’re it!'],
  treat: ['Ooh, sparkly!', 'A fancy one!', 'Pretty candy!'],
  treadmill: ['Why am I not moving?', 'This hall is so long!', 'Am I getting anywhere?'],
}

export const TIPS: string[] = [
  'Sneak up from behind. A scare he sees coming only counts half.',
  'Two ghosts scaring him close together make a Boo-Combo, worth half again.',
  'He gets used to the same trick, so mix up your scares.',
  'Some scares make him drop sweets, and that’s less for him to eat.',
  'Collect the green wisps to refill your ecto.',
  'Fear never slides back below a quarter-way mark once he’s reached it.',
  'Swap ghosts often. Only the one you’re flying can use its ultimate.',
]

export const TAGLINE =
  'Snaxley the raccoon has crept into Hollowmere Manor to eat every sweet in the house. Four friendly ghosts live here. Scare him out before he eats the lot!'

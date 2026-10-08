// The 20 hand-built caverns, in four chapters of five (see SPEC.md).
//
// Legend:  # rock   . stone   S start   E exit   C chasm   = plank
//          ~ water  B spare cell   M moss   / \ mirrors   k key   D door
//          p plate  g/G gate open/closed   h/H bridge raised/lowered
//
// battery  = lit steps before the beam dies (spare cells add more)
// maxReach = beam length in tiles on a full battery
// time     = seconds of air (before the difficulty multiplier)
// echoes   = sonar pulses available
// Levels are checked by solver.ts: solvable, plus how much of the shortest
// route is lit -- chapter 1 keeps nearly all of it lit, chapter 4 leaves
// the final 5-8 steps in the dark.

export interface Critter {
  path: [number, number][] // adjacent tiles, walked back and forth
  speed: number // tiles per second
}

export interface Level {
  name: string
  hint: string
  map: string[]
  battery: number
  maxReach: number
  time: number
  echoes: number
  facing?: number // initial beam angle, radians (default: right)
  critters?: Critter[]
}

export const CHAPTERS = ['The Basics', 'Sightlines', 'Mechanisms', 'Blind Faith']

const DOWN = Math.PI / 2
const LEFT = Math.PI

export const LEVELS: Level[] = [
  // ---------------- Chapter 1: The Basics ----------------
  {
    name: 'First Light',
    hint: 'Arrow keys or WASD to walk. Every step dims your light. Mind the chasms.',
    map: [
      '##########',
      '#S....C###',
      '#####.####',
      '#####.####',
      '###C..####',
      '####.#####',
      '####...E##',
      '##########',
    ],
    battery: 14,
    maxReach: 6,
    time: 60,
    echoes: 0,
  },
  {
    name: 'Stepping Stones',
    hint: 'Look before you leap: the safe path winds through the dark.',
    map: [
      '############',
      '#S.CCCCCCCC#',
      '#C.C...C...#',
      '#C.C.C.C.C.#',
      '#C...C...C.#',
      '#CCCCCCCCC.#',
      '#CCCCCCCCCE#',
      '############',
    ],
    battery: 18,
    maxReach: 5,
    time: 60,
    echoes: 0,
  },
  {
    name: 'Spare Cell',
    hint: 'A spare cell recharges your light. Is the detour worth it?',
    map: [
      '#############',
      '#S......#####',
      '#######.B####',
      '#####......##',
      '#CCCC.CCCCC##',
      '#CC...C...C##',
      '#CC.CCC.C.C##',
      '#CC.....C.C##',
      '#CCCCCCCC.E##',
      '#############',
    ],
    battery: 18,
    maxReach: 5,
    time: 70,
    echoes: 0,
  },
  {
    name: 'Moss Trail',
    hint: 'Moss keeps glowing once your light touches it. Light it up early.',
    map: [
      '##############',
      '#S.....M.....#',
      '#CCCCCCCCCCC.#',
      '#CM....CCCCC.#',
      '#C.CCC.CM...M#',
      '#C.CCC.C.CCCC#',
      '#CM..C.M.CCCC#',
      '#CCC.CCCCCCCC#',
      '#E...MCCCCCCC#',
      '##############',
    ],
    battery: 26,
    maxReach: 7,
    time: 80,
    echoes: 0,
  },
  {
    name: 'Fork in the Dark',
    hint: 'Two ways forward. The short one is mostly chasm.',
    map: [
      '###############',
      '#S............#',
      '#.###########.#',
      '#.#.........#.#',
      '#.#.#######.#.#',
      '#...#CCCCCC.#.#',
      '###.C..C.CC.#.#',
      '###.C.CC...CC.#',
      '###...CCCC.C..#',
      '#####CCCCC...E#',
      '###############',
    ],
    battery: 16,
    maxReach: 6,
    time: 70,
    echoes: 0,
    facing: DOWN,
  },

  // ---------------- Chapter 2: Sightlines ----------------
  {
    name: 'Calcite',
    hint: 'Calcite mirrors bend your beam around corners. Shift + direction aims without walking.',
    map: [
      '##############',
      '#S..........\\#',
      '###########..#',
      '#E.CC...CCCC.#',
      '##....C.CC...#',
      '##CCCCC....CC#',
      '##############',
    ],
    battery: 14,
    maxReach: 14,
    time: 70,
    echoes: 0,
  },
  {
    name: 'Periscope',
    hint: 'Shine into the mirror to scout the next chamber before you get there.',
    map: [
      '###############',
      '#S....#########',
      '#####.#/.....##',
      '#####.#.CC.C.##',
      '#####...C..C.##',
      '#######.C.CC.##',
      '#######...C..##',
      '#########.C.C##',
      '#########...E##',
      '###############',
    ],
    battery: 12,
    maxReach: 12,
    time: 70,
    echoes: 0,
  },
  {
    name: 'Locked',
    hint: 'Doors need a key. Keys are never on the easy path.',
    map: [
      '##############',
      '#S.....D....E#',
      '#.####.###C###',
      '#.#..#.#.....#',
      '#.#k.#.#.CCC.#',
      '#.##.#.#.C.C.#',
      '#....#...C...#',
      '##############',
    ],
    battery: 16,
    maxReach: 6,
    time: 75,
    echoes: 0,
  },
  {
    name: 'Hall of Mirrors',
    hint: 'Follow the reflections. The beam goes where you cannot.',
    map: [
      '###############',
      '#S...........\\#',
      '############..#',
      '#CCC....CC....#',
      '#E.C.CC.CC.CC/#',
      '#C...CC....CC##',
      '###############',
    ],
    battery: 20,
    maxReach: 16,
    time: 90,
    echoes: 0,
  },
  {
    name: 'Reflected Key',
    hint: 'The key is across the chasm field. Scout it in the mirror first.',
    map: [
      '###############',
      '#S...........\\#',
      '#.##########..#',
      '#.#CC..CC.C...#',
      '#.#..CC..C..CC#',
      '#.#.C..C.CC.kC#',
      '#.#.CC.....CCC#',
      '#.#...CC.C..CC#',
      '#D#############',
      '#E#############',
      '###############',
    ],
    battery: 14,
    maxReach: 14,
    time: 100,
    echoes: 0,
  },

  // ---------------- Chapter 3: Mechanisms ----------------
  {
    name: 'Pressure',
    hint: 'Stepping on a plate opens the gates. Step on it again to close them.',
    map: [
      '############',
      '#S...G....E#',
      '#.##########',
      '#.CC...CC..#',
      '#..C.C..C..#',
      '#C...CC...p#',
      '############',
    ],
    battery: 20,
    maxReach: 6,
    time: 80,
    echoes: 0,
  },
  {
    name: 'Drawbridge',
    hint: 'A raised bridge is just a hole in the floor. Find the plate that lowers it.',
    map: [
      '##############',
      '#S.....CC....#',
      '#.C.C..CC.CC.#',
      '#...CC.hh..CE#',
      '#CC..C.CCC...#',
      '#CCC..pCCCCCC#',
      '##############',
    ],
    battery: 14,
    maxReach: 6,
    time: 75,
    echoes: 0,
  },
  {
    name: 'Glow-worms',
    hint: 'Glow-worms light the stones they crawl over. Let them show you the way.',
    map: [
      '###############',
      '#S.CCCCCCCCCCC#',
      '#.CC...C...CCC#',
      '#..C.C.C.C.CCC#',
      '##...C...C...E#',
      '###############',
    ],
    battery: 6,
    maxReach: 5,
    time: 70,
    echoes: 0,
    critters: [
      { path: [[3, 4], [4, 4], [4, 3], [4, 2], [5, 2], [6, 2], [6, 3], [6, 4], [7, 4], [8, 4]], speed: 2 },
      { path: [[8, 4], [8, 3], [8, 2], [9, 2], [10, 2], [10, 3], [10, 4], [11, 4], [12, 4]], speed: 2 },
    ],
  },
  {
    name: 'Toggle Twice',
    hint: 'Every plate flips every gate. Count your flips — one plate may need two.',
    map: [
      '##############',
      '#S...g......p#',
      '############.#',
      '#E.G.C...C...#',
      '####.C.CpC.CC#',
      '####...C...CC#',
      '##############',
    ],
    battery: 18,
    maxReach: 6,
    time: 80,
    echoes: 0,
  },
  {
    name: 'Waterworks',
    hint: 'Water splashes underfoot. Listen to where you are.',
    map: [
      '###############',
      '#S~~~~CCC~~~~.#',
      '#C~CC~~~C~CC~.#',
      '#C~~C.p.~~C~~.#',
      '#CC~~CCC~C~~C.#',
      '#C~~~~~~~CC~~G#',
      '###########~~E#',
      '###############',
    ],
    battery: 14,
    maxReach: 6,
    time: 90,
    echoes: 1,
  },

  // ---------------- Chapter 4: Blind Faith ----------------
  {
    name: 'Last Light',
    hint: 'Your light will die before the exit. Memorize the way, then trust it.',
    map: [
      '##############',
      '#S...........#',
      '#CCCC.CCCCCC.#',
      '#C...C....C..#',
      '#C.C...C..CC.#',
      '#C.CCCCC.CCC.#',
      '#C.....C.....#',
      '#CCCCCECCCCCC#',
      '##############',
    ],
    battery: 33,
    maxReach: 8,
    time: 80,
    echoes: 1,
    facing: DOWN,
  },
  {
    name: 'Echo Chamber',
    hint: 'Press E (or ECHO) to send a sonar pulse: it shows the walls for a moment.',
    map: [
      '###############',
      '#S.#...#......#',
      '#..#.#.#.####.#',
      '#....#...#..#.#',
      '######.###.##.#',
      '#C...#.C...C#.#',
      '#C.C...C.C.C..#',
      '#C.CCCCC.C.CCC#',
      '#E.......C....#',
      '###############',
    ],
    battery: 17,
    maxReach: 6,
    time: 110,
    echoes: 2,
  },
  {
    name: 'Count Your Steps',
    hint: 'A wide dark hall and one safe plank. Count every step.',
    map: [
      '################',
      '#S.............#',
      '#..............#',
      '#..............#',
      '#CCCCCCC=CCCCCCC',
      '#CCCCCCC=CCCCCCC',
      '#..............#',
      '#.............E#',
      '################',
    ],
    battery: 13,
    maxReach: 9,
    time: 70,
    echoes: 1,
    facing: DOWN,
  },
  {
    name: 'Constellation',
    hint: 'In the dark, the moss is your map.',
    map: [
      '###############',
      '#S..M.CCCCCCCC#',
      '#CCC.CCCM...CC#',
      '#CCC.CCC.CC.MC#',
      '#CCCM...M.C..C#',
      '#CCCCCCCC.CC.C#',
      '#CCCCCM....M.C#',
      '#CCCCC.CCCCCCC#',
      '#CCCCCM....E.C#',
      '###############',
    ],
    battery: 17,
    maxReach: 10,
    time: 90,
    echoes: 1,
  },
  {
    name: 'Lux Tenebris',
    hint: 'Everything you have learned. Light, mirror, key, plate, and faith.',
    map: [
      '################',
      '#S...C........\\#',
      '#.##.C.CCC.C#..#',
      '#.#k.C...C.C##.#',
      '#.####.C.C..##.#',
      '#......CpCC.##.#',
      '##############D#',
      '#E.C..C...C.h..#',
      '#C......C...CCC#',
      '################',
    ],
    battery: 57,
    maxReach: 10,
    time: 120,
    echoes: 2,
    facing: LEFT,
  },
]


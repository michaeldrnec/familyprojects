// Hand-curated theme word lists for Sentence Spin.
//
// These are no longer used to validate individual words — any real
// dictionary word is accepted (see words.ts/isValidWord), since a program
// can't judge whether a whole finished sentence "fits" a theme, only a
// human can. The theme is shown as a creative prompt for the player's
// overall sentence, and these per-letter lists are surfaced in the UI as
// optional inspiration ("Need ideas?") for whichever letter was spun.

export interface Theme {
  name: string
  words: Record<string, string[]>
}

const ANIMALS: Theme = {
  name: 'Animals',
  words: {
    A: ['ANTELOPE', 'ALLIGATOR', 'ANT', 'ARMADILLO', 'ANTEATER', 'ALBATROSS'],
    B: ['BEAR', 'BUFFALO', 'BAT', 'BEAVER', 'BADGER', 'BOBCAT', 'BISON'],
    C: ['CAT', 'CAMEL', 'COYOTE', 'CHEETAH', 'CROCODILE', 'CHIMPANZEE', 'COBRA'],
    D: ['DOG', 'DOLPHIN', 'DUCK', 'DEER', 'DONKEY', 'DINGO'],
    E: ['ELEPHANT', 'EAGLE', 'EEL', 'EMU', 'ELK'],
    F: ['FOX', 'FALCON', 'FERRET', 'FLAMINGO', 'FROG'],
    G: ['GOAT', 'GIRAFFE', 'GORILLA', 'GAZELLE', 'GOOSE', 'GUPPY'],
    H: ['HORSE', 'HIPPO', 'HAWK', 'HAMSTER', 'HEDGEHOG', 'HYENA'],
    I: ['IGUANA', 'IBEX', 'IMPALA', 'INCHWORM'],
    J: ['JAGUAR', 'JACKAL', 'JELLYFISH', 'JAY'],
    K: ['KANGAROO', 'KOALA', 'KINGFISHER', 'KIWI'],
    L: ['LION', 'LEOPARD', 'LLAMA', 'LEMUR', 'LOBSTER', 'LYNX'],
    M: ['MONKEY', 'MOOSE', 'MOUSE', 'MEERKAT', 'MANATEE', 'MOLE'],
    N: ['NEWT', 'NARWHAL', 'NIGHTINGALE', 'NUTHATCH'],
    O: ['OTTER', 'OWL', 'OCTOPUS', 'ORANGUTAN', 'OSTRICH', 'ORCA'],
    P: ['PANDA', 'PENGUIN', 'PARROT', 'PORCUPINE', 'PELICAN', 'PONY'],
    Q: ['QUAIL', 'QUOKKA'],
    R: ['RABBIT', 'RACCOON', 'RHINO', 'RAVEN', 'ROOSTER'],
    S: ['SNAKE', 'SHARK', 'SQUIRREL', 'SEAL', 'SLOTH', 'SPARROW', 'STINGRAY'],
    T: ['TIGER', 'TURTLE', 'TOUCAN', 'TARANTULA', 'TERMITE'],
    U: ['URCHIN', 'UAKARI'],
    V: ['VULTURE', 'VIPER'],
    W: ['WOLF', 'WALRUS', 'WOMBAT', 'WEASEL', 'WOODPECKER'],
    X: ['XERUS'],
    Y: ['YAK'],
    Z: ['ZEBRA'],
  },
}

const FOODS: Theme = {
  name: 'Foods',
  words: {
    A: ['APPLE', 'AVOCADO', 'ALMOND', 'ASPARAGUS', 'APRICOT'],
    B: ['BANANA', 'BREAD', 'BACON', 'BROCCOLI', 'BURRITO', 'BAGEL'],
    C: ['CARROT', 'CHEESE', 'COOKIE', 'CHOCOLATE', 'CUCUMBER', 'CEREAL', 'CHILI'],
    D: ['DONUT', 'DUMPLING', 'DATES'],
    E: ['EGGPLANT', 'EGGS', 'ENCHILADA'],
    F: ['FUDGE', 'FIGS', 'FRIES', 'FALAFEL'],
    G: ['GRAPE', 'GRANOLA', 'GARLIC', 'GRAVY', 'GUACAMOLE'],
    H: ['HONEY', 'HUMMUS', 'HAM', 'HOTDOG'],
    I: ['ICING', 'ICE CREAM'],
    J: ['JELLY', 'JAM'],
    K: ['KIWI', 'KETCHUP', 'KALE'],
    L: ['LEMON', 'LETTUCE', 'LASAGNA', 'LIME'],
    M: ['MANGO', 'MUFFIN', 'MEATBALL', 'MUSHROOM', 'MUSTARD'],
    N: ['NOODLE', 'NUTS', 'NACHOS'],
    O: ['ORANGE', 'OATMEAL', 'OLIVE', 'ONION'],
    P: ['PIZZA', 'PASTA', 'PANCAKE', 'POPCORN', 'PRETZEL', 'PEACH', 'PEPPER'],
    Q: ['QUICHE'],
    R: ['RAISIN', 'RICE', 'RADISH'],
    S: ['SALAD', 'SAUSAGE', 'SPINACH', 'SUSHI', 'STRAWBERRY', 'SOUP'],
    T: ['TACO', 'TOAST', 'TOMATO', 'TORTILLA', 'TURKEY'],
    U: ['UDON'],
    V: ['VANILLA', 'VINEGAR'],
    W: ['WAFFLE', 'WALNUT', 'WATERMELON'],
    X: ['XIGUA'],
    Y: ['YOGURT', 'YAM'],
    Z: ['ZUCCHINI', 'ZITI'],
  },
}

const COUNTRIES: Theme = {
  name: 'Countries',
  words: {
    A: ['ARGENTINA', 'AUSTRALIA', 'AUSTRIA'],
    B: ['BRAZIL', 'BELGIUM', 'BOLIVIA'],
    C: ['CANADA', 'CHINA', 'CHILE', 'COLOMBIA', 'CROATIA', 'CUBA'],
    D: ['DENMARK'],
    E: ['EGYPT', 'ECUADOR', 'ESTONIA'],
    F: ['FRANCE', 'FINLAND'],
    G: ['GERMANY', 'GREECE', 'GHANA'],
    H: ['HUNGARY', 'HONDURAS'],
    I: ['INDIA', 'ITALY', 'IRELAND', 'ICELAND', 'INDONESIA'],
    J: ['JAPAN', 'JAMAICA'],
    K: ['KENYA'],
    L: ['LAOS', 'LATVIA', 'LEBANON'],
    M: ['MEXICO', 'MOROCCO', 'MALTA', 'MONGOLIA'],
    N: ['NORWAY', 'NEPAL', 'NIGERIA'],
    O: ['OMAN'],
    P: ['PERU', 'POLAND', 'PORTUGAL', 'PANAMA', 'PARAGUAY'],
    Q: ['QATAR'],
    R: ['RUSSIA', 'ROMANIA'],
    S: ['SPAIN', 'SWEDEN', 'SWITZERLAND', 'SCOTLAND', 'SENEGAL'],
    T: ['TURKEY', 'THAILAND', 'TUNISIA'],
    U: ['UGANDA', 'URUGUAY'],
    V: ['VIETNAM', 'VENEZUELA'],
    W: ['WALES'],
    X: ['XHOSA'],
    Y: ['YEMEN'],
    Z: ['ZAMBIA'],
  },
}

const SPORTS: Theme = {
  name: 'Sports',
  words: {
    A: ['ARCHERY'],
    B: ['BASEBALL', 'BOXING', 'BOWLING', 'BADMINTON', 'BIATHLON'],
    C: ['CRICKET', 'CYCLING', 'CURLING', 'CANOEING', 'CLIMBING'],
    D: ['DARTS', 'DIVING'],
    E: ['EQUESTRIAN'],
    F: ['FENCING', 'FOOTBALL'],
    G: ['GOLF', 'GYMNASTICS'],
    H: ['HOCKEY', 'HANDBALL', 'HURDLES'],
    I: ['ICE HOCKEY'],
    J: ['JUDO'],
    K: ['KARATE', 'KICKBALL', 'KAYAKING'],
    L: ['LACROSSE'],
    M: ['MOTOCROSS'],
    N: ['NETBALL'],
    O: ['ORIENTEERING'],
    P: ['POLO', 'PICKLEBALL', 'PADDLEBOARDING'],
    Q: ['QUIDDITCH'],
    R: ['RUGBY', 'ROWING', 'RUNNING'],
    S: ['SOCCER', 'SWIMMING', 'SKIING', 'SURFING', 'SOFTBALL', 'SKATING'],
    T: ['TENNIS', 'TRIATHLON'],
    U: ['ULTIMATE'],
    V: ['VOLLEYBALL'],
    W: ['WRESTLING'],
    X: ['XTREME SPORTS'],
    Y: ['YACHTING'],
    Z: ['ZORBING'],
  },
}

export const THEMES: Theme[] = [ANIMALS, FOODS, COUNTRIES, SPORTS]

export function randomTheme(): Theme {
  return THEMES[Math.floor(Math.random() * THEMES.length)]
}

/** True if `word` appears anywhere in the theme's curated lists (any letter). */
export function themeContainsWord(theme: Theme, word: string): boolean {
  const upper = word.trim().toUpperCase()
  return Object.values(theme.words).some((options) =>
    options.some((w) => w.toUpperCase() === upper),
  )
}

export const ALPHABET: string[] = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i),
)

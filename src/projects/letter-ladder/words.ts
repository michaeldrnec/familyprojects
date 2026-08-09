// Word lists for the ladder validator + puzzle generator.
// Common English words, filtered from Google's 10,000-common-word corpus
// intersected with a real dictionary (to strip abbreviations/acronyms),
// split by length so ladder steps are single-letter substitutions.
export const WORDS_3: string[] = [
  'AAA', 'ABC', 'ABS', 'ABU', 'ACC', 'ACE', 'ACT', 'ADA', 'ADD', 'ADS', 'AGE',
  'AGO', 'AID', 'AIM', 'AIR', 'AKA', 'ALA', 'ALL', 'ALT', 'AMP', 'AMY', 'ANA',
  'AND', 'ANN', 'ANT', 'ANY', 'APP', 'APR', 'APT', 'ARC', 'ARE', 'ARG', 'ARM',
  'ART', 'ASH', 'ASK', 'ASP', 'ATA', 'ATE', 'ATI', 'ATM', 'AUD', 'AUG', 'AUS',
  'AVE', 'AVG', 'AYE', 'BAD', 'BAG', 'BAN', 'BAR', 'BAT', 'BAY', 'BBS', 'BED',
  'BEE', 'BEN', 'BET', 'BID', 'BIG', 'BIN', 'BIO', 'BIT', 'BIZ', 'BOB', 'BOC',
  'BON', 'BOW', 'BOX', 'BOY', 'BRA', 'BUG', 'BUS', 'BUT', 'BUY', 'BYE', 'CAB',
  'CAD', 'CAL', 'CAM', 'CAN', 'CAP', 'CAR', 'CAT', 'CHI', 'CHO', 'CIA', 'CIR',
  'COD', 'COL', 'COM', 'CON', 'COP', 'COS', 'COW', 'CPU', 'CRY', 'CST', 'CUP',
  'CUT', 'DAD', 'DAM', 'DAN', 'DAS', 'DAT', 'DAY', 'DEC', 'DEE', 'DEF', 'DEL',
  'DEM', 'DEN', 'DER', 'DES', 'DEV', 'DID', 'DIE', 'DIG', 'DIM', 'DIP', 'DIR',
  'DIS', 'DIV', 'DOC', 'DOD', 'DOE', 'DOG', 'DOM', 'DON', 'DOS', 'DOT', 'DOW',
  'DRY', 'DUE', 'DUI', 'DUO', 'EAR', 'EAT', 'EAU', 'ECO', 'EDS', 'EGG', 'END',
  'ENG', 'EOS', 'EPA', 'ERA', 'EST', 'ETC', 'EVA', 'EVE', 'EXP', 'EXT', 'EYE',
  'FAN', 'FAQ', 'FAR', 'FAT', 'FAX', 'FBI', 'FED', 'FEE', 'FEW', 'FIG', 'FIN',
  'FIT', 'FIX', 'FLU', 'FLY', 'FOG', 'FOO', 'FOR', 'FOX', 'FUN', 'FUR', 'FWD',
  'GAP', 'GAS', 'GAY', 'GEL', 'GEM', 'GEN', 'GEO', 'GET', 'GIF', 'GIG', 'GIS',
  'GNU', 'GOT', 'GPS', 'GUN', 'GUY', 'GYM', 'HAD', 'HAM', 'HAS', 'HAT', 'HAY',
  'HER', 'HEY', 'HIM', 'HIP', 'HIS', 'HIT', 'HON', 'HOP', 'HOT', 'HOW', 'HRS',
  'HUB', 'HWY', 'IAN', 'IBM', 'ICE', 'IDE', 'IDS', 'III', 'ILL', 'INC', 'IND',
  'INF', 'ING', 'INK', 'INN', 'INS', 'INT', 'ION', 'IPS', 'IRA', 'IRS', 'ISO',
  'IST', 'ITS', 'JAM', 'JAN', 'JAR', 'JAY', 'JET', 'JIM', 'JOB', 'JOE', 'JON',
  'JOY', 'JUN', 'KAI', 'KAY', 'KEN', 'KEY', 'KID', 'KIM', 'KIT', 'LAB', 'LAN',
  'LAP', 'LAS', 'LAT', 'LAW', 'LAY', 'LBS', 'LCD', 'LED', 'LEE', 'LEG', 'LEN',
  'LEO', 'LES', 'LET', 'LEU', 'LIB', 'LID', 'LIE', 'LIP', 'LIT', 'LIZ', 'LOC',
  'LOG', 'LOT', 'LOU', 'LOW', 'MAC', 'MAD', 'MAE', 'MAG', 'MAN', 'MAP', 'MAR',
  'MAS', 'MAT', 'MAX', 'MAY', 'MED', 'MEL', 'MEM', 'MEN', 'MET', 'MHZ', 'MIA',
  'MID', 'MIL', 'MIN', 'MIT', 'MIX', 'MOD', 'MOM', 'MON', 'MPG', 'MPH', 'MRS',
  'MSG', 'MUD', 'MUG', 'NAM', 'NAT', 'NAV', 'NEO', 'NET', 'NEW', 'NIL', 'NON',
  'NOR', 'NOT', 'NOV', 'NOW', 'NUT', 'OAK', 'OBJ', 'OCT', 'ODD', 'OFF', 'OIL',
  'OLD', 'ONE', 'ONS', 'OPT', 'ORG', 'OUR', 'OUT', 'OWN', 'PAC', 'PAD', 'PAL',
  'PAM', 'PAN', 'PAR', 'PAS', 'PAT', 'PAY', 'PCI', 'PCT', 'PEE', 'PEN', 'PER',
  'PET', 'PHI', 'PIC', 'PIE', 'PIG', 'PIN', 'PIT', 'PIX', 'POD', 'POP', 'POR',
  'POS', 'POT', 'PPM', 'PRE', 'PRO', 'PSI', 'PST', 'PTS', 'PTY', 'PUB', 'PUT',
  'QTY', 'QUE', 'QUI', 'RAM', 'RAN', 'RAP', 'RAT', 'RAW', 'RAY', 'REC', 'RED',
  'REF', 'REG', 'REP', 'RES', 'REV', 'RID', 'RIM', 'RIO', 'RIP', 'ROB', 'ROD',
  'ROM', 'RON', 'ROW', 'ROY', 'RPM', 'RUG', 'RUN', 'SAD', 'SAM', 'SAN', 'SAO',
  'SAP', 'SAT', 'SAW', 'SAY', 'SCI', 'SEA', 'SEC', 'SEE', 'SEN', 'SEP', 'SEQ',
  'SER', 'SET', 'SHE', 'SIC', 'SIE', 'SIG', 'SIM', 'SIN', 'SIP', 'SIR', 'SIT',
  'SIX', 'SKI', 'SKY', 'SOC', 'SOL', 'SON', 'SOX', 'SPA', 'SPY', 'SRI', 'STD',
  'STR', 'SUB', 'SUE', 'SUM', 'SUN', 'SUR', 'TAB', 'TAG', 'TAN', 'TAP', 'TAR',
  'TAX', 'TEA', 'TED', 'TEE', 'TEL', 'TEN', 'TEX', 'THE', 'THY', 'TIE', 'TIL',
  'TIM', 'TIN', 'TIP', 'TOE', 'TOM', 'TON', 'TOO', 'TOP', 'TOY', 'TRI', 'TRY',
  'TUB', 'TUE', 'TWO', 'UNA', 'UNI', 'UPS', 'URI', 'USA', 'USE', 'VAL', 'VAN',
  'VAR', 'VAT', 'VER', 'VIA', 'VIC', 'VII', 'VIP', 'VOL', 'VON', 'WAN', 'WAR',
  'WAS', 'WAX', 'WAY', 'WEB', 'WED', 'WET', 'WHO', 'WHY', 'WIN', 'WIT', 'WON',
  'WOW', 'YEA', 'YEN', 'YES', 'YET', 'YOU', 'YRS', 'ZEN', 'ZIP', 'ZOO',
]

export const WORDS_4: string[] = [
  'ABLE', 'ACER', 'ACID', 'ACNE', 'ACRE', 'ACTS', 'ADAM', 'ADDS', 'AGED', 'AGES', 'AIDS',
  'AIMS', 'ALAN', 'ALEX', 'ALSO', 'ALTO', 'ANDY', 'ANNA', 'ANNE', 'ANTI', 'AQUA', 'ARAB',
  'ARCH', 'AREA', 'ARMS', 'ARMY', 'ARTS', 'ASIA', 'ASKS', 'ATOM', 'AUTO', 'AWAY', 'AXIS',
  'BABE', 'BABY', 'BACK', 'BAGS', 'BALD', 'BALI', 'BALL', 'BAND', 'BANG', 'BANK', 'BARE',
  'BARN', 'BARS', 'BASE', 'BASS', 'BATH', 'BEAM', 'BEAN', 'BEAR', 'BEAT', 'BEDS', 'BEEF',
  'BEEN', 'BEER', 'BELL', 'BELT', 'BEND', 'BENT', 'BEST', 'BETA', 'BETH', 'BIAS', 'BIDS',
  'BIKE', 'BILL', 'BIND', 'BIOL', 'BIOS', 'BIRD', 'BITE', 'BITS', 'BLAH', 'BLOW', 'BLUE',
  'BLVD', 'BOAT', 'BODY', 'BOLD', 'BOLT', 'BOMB', 'BOND', 'BONE', 'BOOK', 'BOOL', 'BOOM',
  'BOOT', 'BORN', 'BOSS', 'BOTH', 'BOWL', 'BOYS', 'BRAD', 'BRAS', 'BUCK', 'BUGS', 'BULK',
  'BULL', 'BURN', 'BUSH', 'BUSY', 'BUYS', 'BUZZ', 'BYTE', 'CAFE', 'CAGE', 'CAKE', 'CALL',
  'CALM', 'CAME', 'CAMP', 'CAMS', 'CANT', 'CAPE', 'CAPS', 'CARD', 'CARE', 'CARL', 'CARS',
  'CART', 'CASA', 'CASE', 'CASH', 'CAST', 'CATS', 'CAVE', 'CELL', 'CENT', 'CHAD', 'CHAN',
  'CHAR', 'CHAT', 'CHEF', 'CHEM', 'CHEN', 'CHIP', 'CIAO', 'CITE', 'CITY', 'CLAN', 'CLAY',
  'CLIP', 'CLUB', 'COAL', 'COAT', 'CODE', 'COIN', 'COLD', 'COLE', 'COME', 'COMM', 'COMP',
  'CONF', 'CONS', 'COOK', 'COOL', 'COPE', 'COPY', 'CORD', 'CORE', 'CORK', 'CORN', 'CORP',
  'COST', 'COVE', 'CREW', 'CROP', 'CTRL', 'CUBA', 'CUBE', 'CULT', 'CUPS', 'CURE', 'CUTE',
  'CUTS', 'DALE', 'DAME', 'DANA', 'DARE', 'DARK', 'DASH', 'DATA', 'DATE', 'DAVE', 'DAWN',
  'DAYS', 'DEAD', 'DEAF', 'DEAL', 'DEAN', 'DEAR', 'DEBT', 'DECK', 'DEEP', 'DEER', 'DELL',
  'DEMO', 'DENY', 'DEPT', 'DESK', 'DIAL', 'DICE', 'DIED', 'DIES', 'DIET', 'DIFF', 'DIRT',
  'DISC', 'DISH', 'DISK', 'DIST', 'DIVE', 'DOCK', 'DOCS', 'DOES', 'DOGS', 'DOLL', 'DOME',
  'DONE', 'DONT', 'DOOM', 'DOOR', 'DOSE', 'DOUG', 'DOWN', 'DRAG', 'DRAW', 'DREW', 'DROP',
  'DRUG', 'DRUM', 'DUAL', 'DUCK', 'DUDE', 'DUKE', 'DUMB', 'DUMP', 'DUST', 'DUTY', 'EACH',
  'EARL', 'EARN', 'EARS', 'EASE', 'EAST', 'EASY', 'ECHO', 'EDEN', 'EDGE', 'EDIT', 'EGGS',
  'ELSE', 'EMMA', 'ENDS', 'EPIC', 'ERIC', 'ERIK', 'EURO', 'EVAL', 'EVEN', 'EVER', 'EVIL',
  'EXAM', 'EXEC', 'EXIT', 'EXPO', 'EYED', 'EYES', 'FACE', 'FACT', 'FAIL', 'FAIR', 'FAKE',
  'FALL', 'FAME', 'FANS', 'FARE', 'FARM', 'FAST', 'FATE', 'FEAR', 'FEAT', 'FEED', 'FEEL',
  'FEES', 'FEET', 'FELL', 'FELT', 'FIJI', 'FILE', 'FILL', 'FILM', 'FIND', 'FINE', 'FIRE',
  'FIRM', 'FISH', 'FIST', 'FITS', 'FIVE', 'FLAG', 'FLAT', 'FLEX', 'FLIP', 'FLOW', 'FLUX',
  'FOAM', 'FOLD', 'FOLK', 'FONT', 'FOOD', 'FOOL', 'FOOT', 'FORD', 'FORK', 'FORM', 'FORT',
  'FOUL', 'FOUR', 'FRED', 'FREE', 'FROG', 'FROM', 'FUEL', 'FUJI', 'FULL', 'FUND', 'FUNK',
  'GAGE', 'GAIN', 'GALE', 'GAME', 'GANG', 'GAPS', 'GARY', 'GATE', 'GAVE', 'GAYS', 'GEAR',
  'GEEK', 'GENE', 'GETS', 'GIFT', 'GIRL', 'GIVE', 'GLAD', 'GLEN', 'GLOW', 'GOAL', 'GOAT',
  'GODS', 'GOES', 'GOLD', 'GOLF', 'GONE', 'GOOD', 'GORE', 'GOTO', 'GRAB', 'GRAD', 'GRAS',
  'GRAY', 'GREG', 'GREW', 'GREY', 'GRID', 'GRIP', 'GROW', 'GUAM', 'GULF', 'GUNS', 'GURU',
  'GUYS', 'HACK', 'HAIR', 'HALF', 'HALL', 'HALO', 'HAND', 'HANG', 'HANS', 'HARD', 'HARM',
  'HART', 'HASH', 'HATE', 'HATS', 'HAVE', 'HAWK', 'HEAD', 'HEAR', 'HEAT', 'HEEL', 'HELD',
  'HELP', 'HERB', 'HERE', 'HERO', 'HIDE', 'HIGH', 'HILL', 'HINT', 'HIRE', 'HIST', 'HITS',
  'HOLD', 'HOLE', 'HOLY', 'HOME', 'HONG', 'HOOD', 'HOOK', 'HOPE', 'HORN', 'HOSE', 'HOST',
  'HOUR', 'HUGE', 'HUGH', 'HUGO', 'HULL', 'HUNG', 'HUNT', 'HURT', 'ICON', 'IDEA', 'IDLE',
  'IDOL', 'IEEE', 'INCH', 'INCL', 'INFO', 'INNS', 'INTL', 'INTO', 'IOWA', 'IRAN', 'IRAQ',
  'IRON', 'ISLE', 'ITEM', 'JACK', 'JADE', 'JAIL', 'JAKE', 'JANE', 'JAVA', 'JAZZ', 'JEAN',
  'JEEP', 'JEFF', 'JETS', 'JEWS', 'JILL', 'JOAN', 'JOBS', 'JOEL', 'JOHN', 'JOIN', 'JOKE',
  'JOSE', 'JOSH', 'JUAN', 'JUDY', 'JULY', 'JUMP', 'JUNE', 'JUNK', 'JURY', 'JUST', 'KARL',
  'KATE', 'KEEN', 'KEEP', 'KENO', 'KENT', 'KEPT', 'KEYS', 'KICK', 'KIDS', 'KILL', 'KIND',
  'KING', 'KIRK', 'KISS', 'KITS', 'KNEE', 'KNEW', 'KNIT', 'KNOW', 'KONG', 'KURT', 'KYLE',
  'LABS', 'LACE', 'LACK', 'LADY', 'LAID', 'LAKE', 'LAMB', 'LAMP', 'LAND', 'LANE', 'LANG',
  'LAOS', 'LAST', 'LATE', 'LAWN', 'LAWS', 'LAZY', 'LEAD', 'LEAF', 'LEAN', 'LEFT', 'LEGS',
  'LENS', 'LEON', 'LESS', 'LETS', 'LEVY', 'LIBS', 'LIES', 'LIFE', 'LIFT', 'LIKE', 'LIME',
  'LINE', 'LINK', 'LION', 'LIPS', 'LISA', 'LIST', 'LITE', 'LIVE', 'LOAD', 'LOAN', 'LOCK',
  'LOGO', 'LOGS', 'LONE', 'LONG', 'LOOK', 'LOOP', 'LORD', 'LOSE', 'LOSS', 'LOST', 'LOTS',
  'LOUD', 'LOVE', 'LOWS', 'LUCK', 'LUCY', 'LUIS', 'LUKE', 'LUNG', 'LYNN', 'MADE', 'MAIL',
  'MAIN', 'MAKE', 'MALE', 'MALI', 'MALL', 'MANY', 'MAPS', 'MARC', 'MARK', 'MARS', 'MART',
  'MARY', 'MASK', 'MASS', 'MATE', 'MATH', 'MATS', 'MATT', 'MEAL', 'MEAN', 'MEAT', 'MEET',
  'MEMO', 'MENS', 'MENT', 'MENU', 'MERE', 'MESA', 'MESH', 'MESS', 'META', 'MICE', 'MIDI',
  'MIKE', 'MILD', 'MILE', 'MILK', 'MILL', 'MIME', 'MIND', 'MINE', 'MINI', 'MINS', 'MINT',
  'MISC', 'MISS', 'MODE', 'MODS', 'MOLD', 'MOMS', 'MONO', 'MOOD', 'MOON', 'MORE', 'MOSS',
  'MOST', 'MOVE', 'MUCH', 'MUST', 'MYTH', 'NAIL', 'NAME', 'NASA', 'NATO', 'NAVY', 'NEAR',
  'NECK', 'NEED', 'NEIL', 'NEON', 'NEST', 'NEWS', 'NEXT', 'NICE', 'NICK', 'NIKE', 'NINE',
  'NODE', 'NONE', 'NOON', 'NORM', 'NOSE', 'NOTE', 'NOVA', 'NUKE', 'NULL', 'NUTS', 'OAKS',
  'ODDS', 'OHIO', 'OILS', 'OKAY', 'OMAN', 'ONCE', 'ONES', 'ONLY', 'ONTO', 'OOPS', 'OPEN',
  'ORAL', 'OURS', 'OVAL', 'OVEN', 'OVER', 'OWEN', 'OWNS', 'PACE', 'PACK', 'PADS', 'PAGE',
  'PAID', 'PAIN', 'PAIR', 'PALE', 'PALM', 'PARA', 'PARK', 'PART', 'PASO', 'PASS', 'PAST',
  'PATH', 'PAUL', 'PAYS', 'PEAK', 'PEAS', 'PEER', 'PENS', 'PERU', 'PEST', 'PETE', 'PETS',
  'PHIL', 'PHYS', 'PICK', 'PICS', 'PIKE', 'PILL', 'PINE', 'PING', 'PINK', 'PINS', 'PIPE',
  'PLAN', 'PLAY', 'PLOT', 'PLUG', 'PLUS', 'POEM', 'POET', 'POLE', 'POLL', 'POLO', 'POLY',
  'POND', 'POOL', 'POOR', 'POPE', 'PORK', 'PORT', 'POSE', 'POST', 'POUR', 'PRAY', 'PREP',
  'PREV', 'PRIX', 'PROC', 'PROS', 'PUBS', 'PULL', 'PUMP', 'PUNK', 'PURE', 'PUSH', 'PUTS',
  'QUAD', 'QUIT', 'QUIZ', 'RACE', 'RACK', 'RAGE', 'RAID', 'RAIL', 'RAIN', 'RAND', 'RANK',
  'RARE', 'RATE', 'RATS', 'RAYS', 'READ', 'REAL', 'REAR', 'REED', 'REEF', 'REEL', 'REID',
  'RELY', 'RENO', 'RENT', 'REST', 'RICE', 'RICH', 'RICK', 'RIDE', 'RING', 'RIPE', 'RISE',
  'RISK', 'ROAD', 'ROCK', 'ROLE', 'ROLL', 'ROME', 'ROOF', 'ROOM', 'ROOT', 'ROPE', 'ROSA',
  'ROSE', 'ROSS', 'ROWS', 'RUBY', 'RUGS', 'RULE', 'RUNS', 'RUSH', 'RUTH', 'SAFE', 'SAGE',
  'SAID', 'SAIL', 'SAKE', 'SALE', 'SALT', 'SAME', 'SAND', 'SANS', 'SARA', 'SAVE', 'SAYS',
  'SCAN', 'SEAL', 'SEAN', 'SEAS', 'SEAT', 'SEED', 'SEEK', 'SEEM', 'SEEN', 'SEES', 'SELF',
  'SELL', 'SEMI', 'SEND', 'SENT', 'SEPT', 'SETS', 'SHAW', 'SHED', 'SHIP', 'SHOE', 'SHOP',
  'SHOT', 'SHOW', 'SHUT', 'SICK', 'SIDE', 'SIGN', 'SILK', 'SIMS', 'SING', 'SINK', 'SITE',
  'SIZE', 'SKIN', 'SKIP', 'SLIM', 'SLIP', 'SLOT', 'SLOW', 'SNAP', 'SNOW', 'SOAP', 'SOFA',
  'SOFT', 'SOIL', 'SOLD', 'SOLE', 'SOLO', 'SOMA', 'SOME', 'SONG', 'SONS', 'SOON', 'SORT',
  'SOUL', 'SOUP', 'SPAM', 'SPAN', 'SPAS', 'SPEC', 'SPIN', 'SPOT', 'STAN', 'STAR', 'STAT',
  'STAY', 'STEM', 'STEP', 'STOP', 'STUD', 'SUCH', 'SUIT', 'SURE', 'SURF', 'SWAP', 'SWIM',
  'SYNC', 'TABS', 'TAGS', 'TAIL', 'TAKE', 'TALE', 'TALK', 'TALL', 'TANK', 'TAPE', 'TASK',
  'TAXI', 'TEAM', 'TEAR', 'TECH', 'TEEN', 'TELL', 'TEMP', 'TEND', 'TENT', 'TERM', 'TEST',
  'TEXT', 'THAI', 'THAN', 'THAT', 'THEE', 'THEM', 'THEN', 'THEY', 'THIN', 'THIS', 'THOU',
  'THRU', 'THUS', 'TIDE', 'TIED', 'TIER', 'TIES', 'TILE', 'TILL', 'TIME', 'TINY', 'TIPS',
  'TIRE', 'TODD', 'TOLD', 'TOLL', 'TONE', 'TONS', 'TONY', 'TOOK', 'TOOL', 'TOPS', 'TOUR',
  'TOWN', 'TOYS', 'TRAP', 'TRAY', 'TREE', 'TREK', 'TRIM', 'TRIO', 'TRIP', 'TROY', 'TRUE',
  'TUBE', 'TUNE', 'TURN', 'TWIN', 'TYPE', 'UGLY', 'UNDO', 'UNIT', 'UNIV', 'UNIX', 'UNTO',
  'UPON', 'URGE', 'USED', 'USER', 'USES', 'UTAH', 'VARY', 'VAST', 'VERY', 'VICE', 'VIEW',
  'VIII', 'VISA', 'VOID', 'VOLT', 'VOTE', 'WAGE', 'WAIT', 'WAKE', 'WALK', 'WALL', 'WALT',
  'WANT', 'WARD', 'WARE', 'WARM', 'WARS', 'WASH', 'WATT', 'WAVE', 'WAYS', 'WEAK', 'WEAR',
  'WEED', 'WEEK', 'WELL', 'WENT', 'WERE', 'WEST', 'WHAT', 'WHEN', 'WHOM', 'WIDE', 'WIFE',
  'WILD', 'WILL', 'WIND', 'WINE', 'WING', 'WINS', 'WIRE', 'WISE', 'WISH', 'WITH', 'WOLF',
  'WOOD', 'WOOL', 'WORD', 'WORK', 'WORM', 'WORN', 'WRAP', 'YALE', 'YANG', 'YARD', 'YARN',
  'YEAH', 'YEAR', 'YOGA', 'YORK', 'YOUR', 'ZERO', 'ZINC', 'ZONE', 'ZOOM',
]

export const WORDS_5: string[] = [
  'AARON', 'ABOUT', 'ABOVE', 'ABUSE', 'ACIDS', 'ACRES', 'ACTOR', 'ACUTE', 'ADAMS', 'ADDED', 'ADMIN',
  'ADMIT', 'ADOBE', 'ADOPT', 'ADULT', 'AFTER', 'AGAIN', 'AGENT', 'AGING', 'AGREE', 'AHEAD', 'AIMED',
  'ALARM', 'ALBUM', 'ALERT', 'ALIAS', 'ALICE', 'ALIEN', 'ALIGN', 'ALIKE', 'ALIVE', 'ALLAH', 'ALLAN',
  'ALLEN', 'ALLOW', 'ALLOY', 'ALONE', 'ALONG', 'ALPHA', 'ALTER', 'AMBER', 'AMEND', 'AMINO', 'AMONG',
  'ANGEL', 'ANGER', 'ANGLE', 'ANGRY', 'ANIME', 'ANNEX', 'ANNIE', 'APART', 'APPLE', 'APPLY', 'APRIL',
  'ARBOR', 'AREAS', 'ARENA', 'ARGUE', 'ARISE', 'ARMED', 'ARMOR', 'ARRAY', 'ARROW', 'ASCII', 'ASIAN',
  'ASIDE', 'ASKED', 'ASSET', 'ATLAS', 'AUDIO', 'AUDIT', 'AUTOS', 'AVOID', 'AWARD', 'AWARE', 'AWFUL',
  'BABES', 'BACON', 'BADGE', 'BADLY', 'BAKER', 'BANDS', 'BANKS', 'BARRY', 'BASED', 'BASES', 'BASIC',
  'BASIN', 'BASIS', 'BATCH', 'BATHS', 'BEACH', 'BEADS', 'BEANS', 'BEARS', 'BEAST', 'BEATS', 'BEGAN',
  'BEGIN', 'BEGUN', 'BEING', 'BELLE', 'BELLY', 'BELOW', 'BELTS', 'BENCH', 'BERRY', 'BETTY', 'BIBLE',
  'BIKES', 'BILLS', 'BILLY', 'BINGO', 'BIRDS', 'BIRTH', 'BLACK', 'BLADE', 'BLAIR', 'BLAKE', 'BLAME',
  'BLANK', 'BLAST', 'BLEND', 'BLESS', 'BLIND', 'BLINK', 'BLOCK', 'BLOND', 'BLOOD', 'BLOOM', 'BLUES',
  'BOARD', 'BOATS', 'BOBBY', 'BONDS', 'BONES', 'BONUS', 'BOOKS', 'BOOST', 'BOOTH', 'BOOTS', 'BOOTY',
  'BORED', 'BOUND', 'BOXED', 'BOXES', 'BRAIN', 'BRAKE', 'BRAND', 'BRASS', 'BRAVE', 'BREAD', 'BREAK',
  'BREED', 'BRIAN', 'BRICK', 'BRIDE', 'BRIEF', 'BRING', 'BROAD', 'BROKE', 'BROOK', 'BROWN', 'BRUCE',
  'BRUSH', 'BRYAN', 'BUCKS', 'BUDDY', 'BUILD', 'BUILT', 'BUNCH', 'BUNNY', 'BURKE', 'BURNS', 'BURST',
  'BUSES', 'BUTTS', 'BUYER', 'BYTES', 'CABIN', 'CABLE', 'CACHE', 'CAKES', 'CALLS', 'CAMEL', 'CAMPS',
  'CANAL', 'CANDY', 'CANON', 'CARDS', 'CAREY', 'CARGO', 'CARLO', 'CAROL', 'CARRY', 'CASES', 'CASEY',
  'CATCH', 'CAUSE', 'CEDAR', 'CELLS', 'CENTS', 'CHAIN', 'CHAIR', 'CHAOS', 'CHARM', 'CHART', 'CHASE',
  'CHEAP', 'CHEAT', 'CHECK', 'CHESS', 'CHEST', 'CHEVY', 'CHICK', 'CHIEF', 'CHILD', 'CHILE', 'CHINA',
  'CHIPS', 'CHOIR', 'CHOSE', 'CHRIS', 'CHUCK', 'CINDY', 'CISCO', 'CITED', 'CIVIC', 'CIVIL', 'CLAIM',
  'CLARA', 'CLARK', 'CLASS', 'CLEAN', 'CLEAR', 'CLERK', 'CLICK', 'CLIFF', 'CLIMB', 'CLIPS', 'CLOCK',
  'CLONE', 'CLOSE', 'CLOTH', 'CLOUD', 'CLUBS', 'COACH', 'COAST', 'CODES', 'COHEN', 'COINS', 'COLIN',
  'COLON', 'COLOR', 'COMBO', 'COMES', 'COMIC', 'CONDO', 'CONGO', 'CONST', 'CORAL', 'CORPS', 'COSTA',
  'COSTS', 'COULD', 'COUNT', 'COURT', 'COVER', 'CRACK', 'CRAFT', 'CRAIG', 'CRAPS', 'CRASH', 'CRAZY',
  'CREAM', 'CREEK', 'CREST', 'CRIME', 'CROPS', 'CROSS', 'CROWD', 'CROWN', 'CRUDE', 'CUBIC', 'CURVE',
  'CYBER', 'CYCLE', 'CZECH', 'DADDY', 'DAILY', 'DAIRY', 'DAISY', 'DANCE', 'DANNY', 'DATED', 'DATES',
  'DAVID', 'DAVIS', 'DEALS', 'DEALT', 'DEATH', 'DEBUG', 'DEBUT', 'DECOR', 'DELAY', 'DELHI', 'DELTA',
  'DENSE', 'DEPOT', 'DEPTH', 'DERBY', 'DEREK', 'DEVEL', 'DEVIL', 'DEVON', 'DIANA', 'DIANE', 'DIARY',
  'DIEGO', 'DIGIT', 'DIRTY', 'DISCO', 'DISCS', 'DISKS', 'DODGE', 'DOING', 'DOLLS', 'DONNA', 'DONOR',
  'DOORS', 'DOUBT', 'DOVER', 'DOZEN', 'DRAFT', 'DRAIN', 'DRAMA', 'DRAWN', 'DRAWS', 'DREAM', 'DRESS',
  'DRIED', 'DRILL', 'DRINK', 'DRIVE', 'DROPS', 'DROVE', 'DRUGS', 'DRUMS', 'DRUNK', 'DRYER', 'DUTCH',
  'DYING', 'DYLAN', 'EAGLE', 'EARLY', 'EARTH', 'EBONY', 'EDDIE', 'EDGAR', 'EDGES', 'EGYPT', 'EIGHT',
  'ELDER', 'ELECT', 'ELITE', 'ELLEN', 'ELVIS', 'EMAIL', 'EMILY', 'EMPTY', 'ENDED', 'ENEMY', 'ENJOY',
  'ENTER', 'ENTRY', 'EQUAL', 'ERROR', 'ESSAY', 'ESSEX', 'EUROS', 'EVANS', 'EVENT', 'EVERY', 'EXACT',
  'EXAMS', 'EXCEL', 'EXIST', 'EXTRA', 'FACED', 'FACES', 'FACTS', 'FAILS', 'FAIRY', 'FAITH', 'FALLS',
  'FALSE', 'FANCY', 'FARES', 'FARMS', 'FATAL', 'FATTY', 'FAULT', 'FAVOR', 'FEARS', 'FEEDS', 'FEELS',
  'FENCE', 'FERRY', 'FEVER', 'FEWER', 'FIBER', 'FIBRE', 'FIELD', 'FIFTH', 'FIFTY', 'FIGHT', 'FILED',
  'FILES', 'FILMS', 'FINAL', 'FINDS', 'FIRED', 'FIRES', 'FIRMS', 'FIRST', 'FIXED', 'FIXES', 'FLAGS',
  'FLAME', 'FLASH', 'FLEET', 'FLESH', 'FLOAT', 'FLOOD', 'FLOOR', 'FLOUR', 'FLOWS', 'FLOYD', 'FLUID',
  'FLUSH', 'FLYER', 'FOCAL', 'FOCUS', 'FOLKS', 'FONTS', 'FOODS', 'FORCE', 'FORGE', 'FORMS', 'FORTH',
  'FORTY', 'FORUM', 'FOUND', 'FRAME', 'FRANK', 'FRAUD', 'FRESH', 'FRONT', 'FROST', 'FRUIT', 'FULLY',
  'FUNDS', 'FUNKY', 'FUNNY', 'FUZZY', 'GAINS', 'GAMES', 'GAMMA', 'GATES', 'GAUGE', 'GENES', 'GENRE',
  'GHANA', 'GHOST', 'GIANT', 'GIFTS', 'GIRLS', 'GIVEN', 'GIVES', 'GLASS', 'GLENN', 'GLOBE', 'GLORY',
  'GNOME', 'GOALS', 'GOING', 'GONNA', 'GOODS', 'GOTTA', 'GRACE', 'GRADE', 'GRAIN', 'GRAMS', 'GRAND',
  'GRANT', 'GRAPH', 'GRASS', 'GRAVE', 'GREAT', 'GREEK', 'GREEN', 'GRILL', 'GROSS', 'GROUP', 'GROVE',
  'GROWN', 'GROWS', 'GUARD', 'GUESS', 'GUEST', 'GUIDE', 'GUILD', 'HAIRY', 'HAITI', 'HANDS', 'HANDY',
  'HAPPY', 'HARRY', 'HAVEN', 'HAYES', 'HEADS', 'HEARD', 'HEART', 'HEATH', 'HEAVY', 'HELEN', 'HELLO',
  'HELPS', 'HENCE', 'HENRY', 'HERBS', 'HIGHS', 'HILLS', 'HINDU', 'HINTS', 'HIRED', 'HOBBY', 'HOLDS',
  'HOLES', 'HOLLY', 'HOMES', 'HONDA', 'HONEY', 'HONOR', 'HOPED', 'HOPES', 'HORSE', 'HOSTS', 'HOTEL',
  'HOURS', 'HOUSE', 'HUMAN', 'HUMOR', 'ICONS', 'IDAHO', 'IDEAL', 'IDEAS', 'IMAGE', 'INDEX', 'INDIA',
  'INNER', 'INPUT', 'INTEL', 'INTER', 'INTRO', 'IRAQI', 'IRISH', 'ISAAC', 'ISLAM', 'ISSUE', 'ITALY',
  'ITEMS', 'IVORY', 'JACOB', 'JAMES', 'JAMIE', 'JANET', 'JAPAN', 'JASON', 'JEANS', 'JENNY', 'JERRY',
  'JESSE', 'JESUS', 'JEWEL', 'JIMMY', 'JOHNS', 'JOINS', 'JOINT', 'JOKES', 'JONES', 'JOYCE', 'JUDGE',
  'JUICE', 'JULIA', 'JULIE', 'KAREN', 'KARMA', 'KATHY', 'KATIE', 'KEEPS', 'KEITH', 'KELLY', 'KENNY',
  'KENYA', 'KERRY', 'KEVIN', 'KILLS', 'KINDS', 'KINGS', 'KITTY', 'KNIFE', 'KNOCK', 'KNOWN', 'KNOWS',
  'KODAK', 'KOREA', 'LABEL', 'LABOR', 'LADEN', 'LAKES', 'LAMPS', 'LANCE', 'LANDS', 'LANES', 'LARGE',
  'LARRY', 'LASER', 'LATER', 'LATEX', 'LATIN', 'LAUGH', 'LAURA', 'LAYER', 'LEADS', 'LEARN', 'LEASE',
  'LEAST', 'LEAVE', 'LEEDS', 'LEGAL', 'LEMON', 'LEONE', 'LEVEL', 'LEWIS', 'LIGHT', 'LIKED', 'LIKES',
  'LIMIT', 'LINDA', 'LINED', 'LINES', 'LINKS', 'LIONS', 'LISTS', 'LIVED', 'LIVER', 'LIVES', 'LLOYD',
  'LOADS', 'LOANS', 'LOBBY', 'LOCAL', 'LOCKS', 'LODGE', 'LOGAN', 'LOGIC', 'LOGIN', 'LOGOS', 'LOOKS',
  'LOOPS', 'LOOSE', 'LOTUS', 'LOUIS', 'LOVED', 'LOVER', 'LOVES', 'LOWER', 'LUCIA', 'LUCKY', 'LUNCH',
  'LYING', 'LYRIC', 'MACRO', 'MAGIC', 'MAILS', 'MAINE', 'MAJOR', 'MAKER', 'MAKES', 'MALES', 'MALTA',
  'MAMBO', 'MANGA', 'MANOR', 'MAPLE', 'MARCH', 'MARCO', 'MARDI', 'MARIA', 'MARIE', 'MARIO', 'MARKS',
  'MARSH', 'MASON', 'MATCH', 'MAYBE', 'MAYOR', 'MAZDA', 'MEALS', 'MEANS', 'MEANT', 'MEDAL', 'MEDIA',
  'MEETS', 'MENUS', 'MERCY', 'MERGE', 'MERIT', 'MERRY', 'METAL', 'METER', 'METRO', 'MIAMI', 'MICRO',
  'MIGHT', 'MILAN', 'MILES', 'MILLS', 'MINDS', 'MINES', 'MINOR', 'MINUS', 'MIXED', 'MIXER', 'MODEL',
  'MODEM', 'MODES', 'MONEY', 'MONTE', 'MONTH', 'MOORE', 'MORAL', 'MOSES', 'MOTEL', 'MOTOR', 'MOUNT',
  'MOUSE', 'MOUTH', 'MOVED', 'MOVES', 'MOVIE', 'MULTI', 'MUSIC', 'NAILS', 'NAKED', 'NAMED', 'NAMES',
  'NANCY', 'NASTY', 'NAVAL', 'NEEDS', 'NEPAL', 'NERVE', 'NEVER', 'NEWER', 'NEWLY', 'NIGHT', 'NIKON',
  'NOBLE', 'NODES', 'NOISE', 'NORTH', 'NOTED', 'NOTES', 'NOTRE', 'NOVEL', 'NURSE', 'NYLON', 'OASIS',
  'OCCUR', 'OCEAN', 'OFFER', 'OFTEN', 'OLDER', 'OLIVE', 'OMAHA', 'OMEGA', 'ONION', 'OPENS', 'OPERA',
  'ORBIT', 'ORDER', 'ORGAN', 'OSCAR', 'OTHER', 'OUGHT', 'OUTER', 'OWNED', 'OWNER', 'OXIDE', 'OZONE',
  'PACKS', 'PAGES', 'PAINT', 'PAIRS', 'PANEL', 'PANIC', 'PANTS', 'PAPER', 'PAPUA', 'PARIS', 'PARKS',
  'PARTS', 'PARTY', 'PASTA', 'PASTE', 'PATCH', 'PATHS', 'PATIO', 'PEACE', 'PEARL', 'PEERS', 'PENNY',
  'PERRY', 'PETER', 'PHASE', 'PHONE', 'PHOTO', 'PIANO', 'PICKS', 'PIECE', 'PILLS', 'PILOT', 'PIPES',
  'PITCH', 'PIXEL', 'PIZZA', 'PLACE', 'PLAIN', 'PLANE', 'PLANS', 'PLANT', 'PLATE', 'PLAYS', 'PLAZA',
  'PLOTS', 'POEMS', 'POINT', 'POKER', 'POLAR', 'POLLS', 'POOLS', 'PORTS', 'POSTS', 'POUND', 'POWER',
  'PRESS', 'PRICE', 'PRIDE', 'PRIME', 'PRINT', 'PRIOR', 'PRIZE', 'PROBE', 'PROMO', 'PROOF', 'PROUD',
  'PROVE', 'PROXY', 'PULSE', 'PUMPS', 'PUNCH', 'PUPPY', 'PURSE', 'QATAR', 'QUEEN', 'QUERY', 'QUEST',
  'QUEUE', 'QUICK', 'QUIET', 'QUILT', 'QUITE', 'QUOTE', 'RACES', 'RACKS', 'RADAR', 'RADIO', 'RAISE',
  'RALLY', 'RALPH', 'RANCH', 'RANDY', 'RANGE', 'RANKS', 'RAPID', 'RATED', 'RATES', 'RATIO', 'REACH',
  'READS', 'READY', 'REALM', 'REBEL', 'REFER', 'RELAX', 'RELAY', 'REMIX', 'RENEW', 'REPLY', 'RESET',
  'RETRO', 'RICKY', 'RIDER', 'RIDES', 'RIDGE', 'RIGHT', 'RINGS', 'RISKS', 'RIVER', 'ROADS', 'ROBIN',
  'ROBOT', 'ROCKS', 'ROCKY', 'ROGER', 'ROLES', 'ROLLS', 'ROMAN', 'ROOMS', 'ROOTS', 'ROSES', 'ROUGE',
  'ROUGH', 'ROUND', 'ROUTE', 'ROVER', 'ROYAL', 'RUGBY', 'RULED', 'RULES', 'RURAL', 'SAFER', 'SAINT',
  'SALAD', 'SALEM', 'SALES', 'SALLY', 'SALON', 'SAMBA', 'SAMOA', 'SANDY', 'SANTA', 'SARAH', 'SATIN',
  'SAUCE', 'SAUDI', 'SAVED', 'SAVER', 'SAVES', 'SCALE', 'SCARY', 'SCENE', 'SCOOP', 'SCOPE', 'SCORE',
  'SCOTT', 'SCOUT', 'SCREW', 'SCUBA', 'SEATS', 'SEEDS', 'SEEKS', 'SEEMS', 'SELLS', 'SENDS', 'SENSE',
  'SERUM', 'SERVE', 'SETUP', 'SEVEN', 'SHADE', 'SHAFT', 'SHAKE', 'SHALL', 'SHAME', 'SHAPE', 'SHARE',
  'SHARK', 'SHARP', 'SHEEP', 'SHEER', 'SHEET', 'SHELF', 'SHELL', 'SHIFT', 'SHINE', 'SHIPS', 'SHIRT',
  'SHOCK', 'SHOES', 'SHOOT', 'SHOPS', 'SHORE', 'SHORT', 'SHOTS', 'SHOWN', 'SHOWS', 'SIDES', 'SIGHT',
  'SIGMA', 'SIGNS', 'SILLY', 'SIMON', 'SINCE', 'SINGH', 'SITES', 'SIXTH', 'SIZED', 'SIZES', 'SKILL',
  'SKINS', 'SKIRT', 'SLAVE', 'SLEEP', 'SLIDE', 'SLOPE', 'SLOTS', 'SMALL', 'SMART', 'SMELL', 'SMILE',
  'SMITH', 'SMOKE', 'SNAKE', 'SOCKS', 'SOLAR', 'SOLID', 'SOLVE', 'SONGS', 'SONIC', 'SORRY', 'SORTS',
  'SOULS', 'SOUND', 'SOUTH', 'SPACE', 'SPAIN', 'SPANK', 'SPARE', 'SPEAK', 'SPECS', 'SPEED', 'SPELL',
  'SPEND', 'SPENT', 'SPERM', 'SPICE', 'SPIES', 'SPINE', 'SPLIT', 'SPOKE', 'SPORT', 'SPOTS', 'SPRAY',
  'SQUAD', 'STACK', 'STAFF', 'STAGE', 'STAKE', 'STAMP', 'STAND', 'STARS', 'START', 'STATE', 'STATS',
  'STAYS', 'STEAL', 'STEAM', 'STEEL', 'STEPS', 'STEVE', 'STICK', 'STILL', 'STOCK', 'STONE', 'STOOD',
  'STOPS', 'STORE', 'STORM', 'STORY', 'STRAP', 'STRIP', 'STUCK', 'STUDY', 'STUFF', 'STYLE', 'SUDAN',
  'SUGAR', 'SUITE', 'SUITS', 'SUNNY', 'SUPER', 'SURGE', 'SUSAN', 'SWEET', 'SWIFT', 'SWING', 'SWISS',
  'SWORD', 'SYRIA', 'TABLE', 'TAKEN', 'TAKES', 'TALES', 'TALKS', 'TAMIL', 'TAMPA', 'TANKS', 'TAPES',
  'TASKS', 'TASTE', 'TAXES', 'TEACH', 'TEAMS', 'TEARS', 'TEDDY', 'TEENS', 'TEETH', 'TELLS', 'TERMS',
  'TERRY', 'TESTS', 'TEXAS', 'TEXTS', 'THANK', 'THATS', 'THEFT', 'THEIR', 'THEME', 'THERE', 'THESE',
  'THETA', 'THICK', 'THING', 'THINK', 'THIRD', 'THONG', 'THOSE', 'THREE', 'THROW', 'THUMB', 'TIGER',
  'TIGHT', 'TILES', 'TIMER', 'TIMES', 'TIRED', 'TIRES', 'TITLE', 'TODAY', 'TOKEN', 'TOKYO', 'TOMMY',
  'TONER', 'TONES', 'TOOLS', 'TOOTH', 'TOPIC', 'TOTAL', 'TOUCH', 'TOUGH', 'TOURS', 'TOWER', 'TOWNS',
  'TOXIC', 'TRACE', 'TRACK', 'TRACT', 'TRACY', 'TRADE', 'TRAIL', 'TRAIN', 'TRANS', 'TRASH', 'TREAT',
  'TREES', 'TREND', 'TRIAL', 'TRIBE', 'TRICK', 'TRIED', 'TRIES', 'TRIPS', 'TROUT', 'TRUCK', 'TRULY',
  'TRUNK', 'TRUST', 'TRUTH', 'TUBES', 'TULSA', 'TUMOR', 'TUNER', 'TUNES', 'TURBO', 'TURNS', 'TWICE',
  'TWINS', 'TWIST', 'TYLER', 'TYPES', 'ULTRA', 'UNCLE', 'UNDER', 'UNION', 'UNITS', 'UNITY', 'UNTIL',
  'UPPER', 'UPSET', 'URBAN', 'USAGE', 'USERS', 'USING', 'USUAL', 'VALID', 'VALUE', 'VALVE', 'VAULT',
  'VEGAS', 'VENUE', 'VERDE', 'VERSE', 'VIDEO', 'VIEWS', 'VILLA', 'VINYL', 'VIRAL', 'VIRUS', 'VISIT',
  'VISTA', 'VITAL', 'VOCAL', 'VOICE', 'VOTED', 'VOTES', 'WAGES', 'WAGON', 'WALES', 'WALKS', 'WALLS',
  'WANNA', 'WANTS', 'WASTE', 'WATCH', 'WATER', 'WATTS', 'WAVES', 'WAYNE', 'WEEKS', 'WEIRD', 'WELLS',
  'WELSH', 'WENDY', 'WHALE', 'WHATS', 'WHEAT', 'WHEEL', 'WHERE', 'WHICH', 'WHILE', 'WHITE', 'WHOLE',
  'WHOSE', 'WIDER', 'WIDTH', 'WINDS', 'WINES', 'WINGS', 'WIRED', 'WIRES', 'WITCH', 'WIVES', 'WOMAN',
  'WOMEN', 'WOODS', 'WORDS', 'WORKS', 'WORLD', 'WORRY', 'WORSE', 'WORST', 'WORTH', 'WOULD', 'WOUND',
  'WRIST', 'WRITE', 'WRONG', 'WROTE', 'XEROX', 'YACHT', 'YAHOO', 'YARDS', 'YEARS', 'YEAST', 'YEMEN',
  'YIELD', 'YOUNG', 'YOURS', 'YOUTH', 'YUKON', 'ZONES',
]

export type WordLength = 3 | 4 | 5

const WORD_LISTS: Record<WordLength, string[]> = {
  3: WORDS_3,
  4: WORDS_4,
  5: WORDS_5,
}

const WORD_SETS: Record<WordLength, Set<string>> = {
  3: new Set(WORDS_3.map((w) => w.toUpperCase())),
  4: new Set(WORDS_4.map((w) => w.toUpperCase())),
  5: new Set(WORDS_5.map((w) => w.toUpperCase())),
}

export function wordsForLength(length: WordLength): string[] {
  return WORD_LISTS[length]
}

export function isValidWord(word: string): boolean {
  const upper = word.toUpperCase()
  const set = WORD_SETS[upper.length as WordLength]
  return set ? set.has(upper) : false
}

export function isOneLetterOff(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff++
    if (diff > 1) return false
  }
  return diff === 1
}

export interface Puzzle {
  start: string
  end: string
}

// --- Graph + BFS utilities, used for puzzle generation, the "steps
// remaining" indicator, and hints. ---

export type Graph = Map<string, string[]>

/** Build an adjacency map where an edge connects words that are one letter apart. */
export function buildGraph(words: string[]): Graph {
  const graph: Graph = new Map()
  for (const word of words) graph.set(word, [])
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      if (isOneLetterOff(words[i], words[j])) {
        graph.get(words[i])!.push(words[j])
        graph.get(words[j])!.push(words[i])
      }
    }
  }
  return graph
}

interface BfsResult {
  distance: Map<string, number>
  prev: Map<string, string>
}

/** BFS from `start` over `graph`, returning distances and predecessors for every reachable word. */
export function bfsFrom(graph: Graph, start: string): BfsResult {
  const distance = new Map<string, number>([[start, 0]])
  const prev = new Map<string, string>()
  const queue = [start]
  let head = 0
  while (head < queue.length) {
    const word = queue[head++]
    const d = distance.get(word)!
    for (const next of graph.get(word) ?? []) {
      if (!distance.has(next)) {
        distance.set(next, d + 1)
        prev.set(next, word)
        queue.push(next)
      }
    }
  }
  return { distance, prev }
}

/** Reconstruct the shortest path from `start` to `end` using a BFS result rooted at `start`. */
export function pathFromBfs(bfs: BfsResult, start: string, end: string): string[] | null {
  if (!bfs.distance.has(end)) return null
  const path = [end]
  let cur = end
  while (cur !== start) {
    const p = bfs.prev.get(cur)
    if (!p) return null
    path.push(p)
    cur = p
  }
  return path.reverse()
}

/** Shortest path between two words in `graph`, or null if unreachable. */
export function shortestPath(graph: Graph, start: string, end: string): string[] | null {
  return pathFromBfs(bfsFrom(graph, start), start, end)
}

const MIN_STEPS = 3
const MAX_STEPS = 8

/**
 * Pick a random start/end pair from `graph` with a shortest-path distance
 * in a "reasonable difficulty" range, widening the range if too few
 * candidates are found (e.g. for sparser graphs).
 */
export function randomPuzzleFromGraph(graph: Graph): Puzzle {
  const words = [...graph.keys()]
  let low = MIN_STEPS
  let high = MAX_STEPS
  for (let attempt = 0; attempt < 20; attempt++) {
    const start = words[Math.floor(Math.random() * words.length)]
    const bfs = bfsFrom(graph, start)
    const candidates = [...bfs.distance.entries()].filter(
      ([, d]) => d >= low && d <= high,
    )
    if (candidates.length > 0) {
      const [end] = candidates[Math.floor(Math.random() * candidates.length)]
      return { start, end }
    }
    // Widen the acceptable range every few misses so sparse graphs still resolve.
    if (attempt % 5 === 4) {
      low = Math.max(1, low - 1)
      high += 2
    }
  }
  // Last resort: any two distinct reachable words.
  const start = words[Math.floor(Math.random() * words.length)]
  const bfs = bfsFrom(graph, start)
  const reachable = [...bfs.distance.keys()].filter((w) => w !== start)
  const end = reachable.length > 0 ? reachable[Math.floor(Math.random() * reachable.length)] : start
  return { start, end }
}


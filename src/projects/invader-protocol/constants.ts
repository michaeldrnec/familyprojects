// Every tuning number for Invader Protocol in one place: the values from
// SPEC.md plus the defaults chosen where the spec was silent (see the
// "Resolved gaps & interpretations" table in SPEC.md section 6).

// --- Playfield (logical 1920x1080; the canvas is scaled to fit) ----------
export const VIEW_W = 1920
export const VIEW_H = 1080
export const PLAYER_Y = 980
export const FAIL_Y = 940 // any living invader's bottom edge reaching this ends the run

// --- Player ---------------------------------------------------------------
export const PLAYER_MAX_SPEED = 600
export const PLAYER_ACCEL = 3600
export const PLAYER_FRICTION = 4800
export const PLAYER_HALF_W = 38
export const PLAYER_HALF_H = 20
export const PLAYER_MIN_X = 60
export const PLAYER_MAX_X = VIEW_W - 60
export const DASH_DISTANCE = 180
export const DASH_TIME = 0.15
export const DASH_COOLDOWN = 1.2
export const START_LIVES = 3
export const RESPAWN_DELAY = 1.0
export const RESPAWN_INVULN = 1.5
export const BONUS_LIFE_EVERY = 10_000

// --- Grid & tempo ---------------------------------------------------------
export const ROWS = 5
export const COLS = 11
export const N0 = ROWS * COLS
export const F_MIN = 1.0 // Hz (60 BPM)
export const F_MAX = 3.5 // Hz (210 BPM)
export const TEMPO_EXPONENT = 1.8
export const COL_SPACING = 120
export const ROW_SPACING = 80
export const GRID_START_X = (VIEW_W - (COLS - 1) * COL_SPACING) / 2 // 360
export const GRID_START_Y = 140
export const INVADER_HALF_W = 30
export const INVADER_HALF_H = 22
export const STEP_DX = 16
export const STEP_DY = 32
export const BOUND_LEFT = 120
export const BOUND_RIGHT = 1800
export const SNAP_DX = 40
export const SNAP_TWEEN = 0.12
export const SNAP_STUN = 0.6
export const FRENZY_TIME = 4.0
export const FRENZY_JITTER = 0.3 // +/- fraction of STEP_DX added per beat
export const FRENZY_FIRE_RATE = 1.5
export const FRENZY_AIM_SPREAD = (12 * Math.PI) / 180
export const WAVE_DROP = 32
export const WAVE_DROP_MAX = 160
export const WAVE_FIRE_SCALE = 0.92
export const FIRE_INTERVAL_MIN = 1.5
export const FIRE_INTERVAL_MAX = 4.0
export const WAVE_INTRO_TIME = 1.6

export type InvaderType = 'command' | 'drone' | 'grunt' | 'raider'
export const ROW_TYPES: InvaderType[] = ['command', 'drone', 'grunt', 'raider', 'raider']
export const INVADER_HP: Record<InvaderType, number> = { command: 60, drone: 120, grunt: 80, raider: 40 }
export const INVADER_POINTS: Record<InvaderType, number> = { command: 500, drone: 30, grunt: 20, raider: 10 }

// --- Weapons & heat -------------------------------------------------------
export type WeaponId = 'disruptor' | 'needle' | 'spread' | 'siege'
export const WEAPON_ORDER: WeaponId[] = ['disruptor', 'needle', 'spread', 'siege']

export interface WeaponDef {
  name: string
  speed: number // px/s, upward
  heat: number
  cooldown: number
  damage: number
  pierce: number // entities a single projectile can pass through
  color: string
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  disruptor: { name: 'Disruptor', speed: 1400, heat: 6, cooldown: 0.18, damage: 20, pierce: 1, color: '#67e8f9' },
  needle: { name: 'Needle Rail', speed: 2400, heat: 24, cooldown: 0.55, damage: 45, pierce: 3, color: '#f0abfc' },
  spread: { name: 'Arc Spread', speed: 1100, heat: 18, cooldown: 0.3, damage: 14, pierce: 1, color: '#a3e635' },
  siege: { name: 'Siege Mortar', speed: 900, heat: 35, cooldown: 0.8, damage: 70, pierce: 1, color: '#fb923c' },
}

export const SPREAD_ANGLE = (15 * Math.PI) / 180
export const SIEGE_SPLASH_RADIUS = 75
export const SIEGE_SPLASH_DAMAGE = 45
export const SIEGE_CEILING_Y = 100
export const DRONE_ARMOR_MULT = 0.5

export const HEAT_MAX = 100
export const OVERHEAT_TIME = 2.5
export const COOL_RATE = 25
export const COOL_DELAY = 0.3

export const PERFECT_WINDOW = 0.05
export const PERFECT_SPEED_MULT = 1.25
export const PERFECT_SCORE_MULT = 1.2

// --- Enemy fire -----------------------------------------------------------
export const BOLT_SPEED = 520
export const BOLT_DAMAGE = 25
export const FRAGMENT_SPEED = 450
export const FRAGMENT_DAMAGE = 30
export const FRAGMENT_COUNT = 3

// --- Bunkers --------------------------------------------------------------
export const BUNKER_Y = 820
export const BUNKER_XS = [480, 960, 1440]
export const BUNKER_COLS = 6
export const BUNKER_ROWS = 4
export const CELL_R = 20 // hex circumradius
export const CELL_HP = 75
export const BUNKER_MAX_HP = BUNKER_COLS * BUNKER_ROWS * CELL_HP // 1800
export const ENERGY_PER_DAMAGE = 0.5
export const ENERGY_MAX = 100
export const VENT_MIN_ENERGY = 10
export const VENT_TIME = 1.5
export const VENT_DPS_BASE = 30
export const VENT_DPS_PER_ENERGY = 1.6

// --- Apex Transponder (UFO) ----------------------------------------------
export const UFO_Y = 60
export const UFO_HP = 150
export const UFO_SPEED = 230
export const UFO_INTERVAL_MIN = 25
export const UFO_INTERVAL_MAX = 40
export const UFO_HALF_W = 52
export const UFO_HALF_H = 20
export const UFO_RESTORE = BUNKER_MAX_HP * 0.25 // 450
export const MARKERS_PER_PASS = 2
export const MARKER_TELEGRAPH = 1.2
export const MARKER_BEAM = 0.5
export const MARKER_HALF_W = 34

// The rules of one night shift, with no React or DOM: newNight() builds the
// state, stepNight() advances it, and the action functions below are what
// the buttons and keys call. Randomness comes from a seeded rng so a night
// (and the balance tests in night.test.ts) can be replayed exactly.
import { makeRng, type Rng } from '../../../shared/rng'
import {
  BROKEN,
  COMPLAINTS,
  CONFLICT_TITLES,
  DUPE_POSTS,
  PHANTOM_TOAST,
  PLAYERS,
  STREAMER,
  STREAMER_BUG,
  STREAMER_POST,
  TEAMMATE,
  TEAM_PUSH,
  THANKS,
  TITLES,
  type Handle,
} from '../content'
import {
  CAT_PET_RELIEF,
  COFFEE_JITTERS,
  COFFEE_POTENCY,
  COFFEE_REFILL,
  CRASH_AFTER,
  CRASH_AT,
  CRASH_MULT,
  CRASH_SECONDS,
  CRASH_ZONE_MULT,
  DEPLOY_SECONDS,
  DOZE_LIMIT,
  DRAIN,
  HALLUCINATING,
  MAX_BROKEN_CHANCE,
  MAX_RATING,
  MAX_MISTAP,
  MERGE_AT,
  NIGHTS,
  NIGHT_SECONDS,
  PAY,
  PHANTOMS_AT,
  QUICK_PATCH_FAIL,
  RESTORE,
  REVIEW_BOMB_AT,
  REVIEW_BOMB_RATE,
  REVIEW_BOMB_SECONDS,
  SHAKE_COST,
  SHAKE_RECOVER,
  SHAKE_RELIEF,
  STARTING_USERS,
  START_RATING,
  MISTAP_SLEEP,
  WATER_AWAY,
  WATER_CLEAR_SECONDS,
  WATER_COOLDOWN,
  WATER_RELIEF,
  type GameKind,
  type NightConfig,
  type Severity,
  type UpgradeId,
} from './config'

export interface Ticket {
  id: number
  severity: Severity
  game: GameKind
  title: string
  age: number
  phantom: boolean // imaginary: vanishes when opened, never drains
  conflict: boolean // reopened by a teammate's push
  root: boolean // the streamer bug: deploying it closes every duplicate
  dupeOf: number | null
}

export type PostTone = Severity | 'good' | 'bad' | 'team' | 'stream'

export interface Post {
  id: number
  handle: Handle
  text: string
  tone: PostTone
  at: number
}

export interface Deploy {
  patches: Ticket[]
  progress: number // 0..1
  duration: number
  risk: number // chance of a broken dependency, fixed when the deploy starts
  halted: boolean
}

export type CatPhase = 'away' | 'walking' | 'sitting'

export type SimEvent =
  | 'report'
  | 'p0'
  | 'fixed'
  | 'fixFailed'
  | 'quickPatch'
  | 'deployStart'
  | 'deployDone'
  | 'broken'
  | 'ping'
  | 'phantom'
  | 'coffee'
  | 'crash'
  | 'water'
  | 'shake'
  | 'reviewBomb'
  | 'conflict'
  | 'crashZone'
  | 'cat'
  | 'catPet'
  | 'catSit'

export type Outcome = 'survived' | 'asleep' | 'rating'

export interface NightStats {
  fixed: number
  shipped: number
  quickPatches: number
  quickBackfires: number
  broken: number
  coffees: number
  waters: number
  pay: number
}

export interface NightState {
  night: number
  cfg: NightConfig
  owned: Set<UpgradeId>
  rng: Rng
  t: number
  nextId: number

  rating: number
  users: number
  tickets: Ticket[]
  staged: Ticket[]
  deploy: Deploy | null
  activeId: number | null
  feed: Post[]
  toast: { text: string; until: number } | null
  banner: { title: string; text: string; until: number } | null

  sleep: number
  dozing: number // seconds spent at 100%
  shakeStamina: number
  coffeeRefill: number
  coffeeStreak: number
  jitters: number
  crash: number
  away: number
  waterCooldown: number
  clearEyes: number // seconds of sharp vision after a splash
  invert: number // Crash Zone color drift, 0..1

  spawnTimer: number
  delayedSpawns: number[] // times when Quick Patch backfires land
  bomb: { rootId: number; left: number; closed: boolean } | null
  bombDone: boolean
  phantomTimer: number
  mergeTimer: number
  crashZoneStarted: boolean

  cat: { phase: CatPhase; x: number; timer: number }

  events: SimEvent[]
  stats: NightStats
  over: Outcome | null
}

const pick = <T>(rng: Rng, items: readonly T[]): T => items[rng.int(0, items.length)]

export function newNight(night: number, owned: Iterable<UpgradeId>, seed: number): NightState {
  const cfg = NIGHTS[night]
  const rng = makeRng(seed)
  return {
    night,
    cfg,
    owned: new Set(owned),
    rng,
    t: 0,
    nextId: 1,
    rating: START_RATING,
    users: STARTING_USERS,
    tickets: [],
    staged: [],
    deploy: null,
    activeId: null,
    feed: [],
    toast: null,
    banner: null,
    sleep: 0.1,
    dozing: 0,
    shakeStamina: 1,
    coffeeRefill: 0,
    coffeeStreak: 0,
    jitters: 0,
    crash: 0,
    away: 0,
    waterCooldown: 0,
    clearEyes: 0,
    invert: 0,
    spawnTimer: 3,
    delayedSpawns: [],
    bomb: null,
    bombDone: false,
    phantomTimer: rng.range(7, 12),
    mergeTimer: rng.range(6, 12),
    crashZoneStarted: false,
    cat: { phase: 'away', x: 0, timer: rng.range(18, 28) },
    events: [],
    stats: { fixed: 0, shipped: 0, quickPatches: 0, quickBackfires: 0, broken: 0, coffees: 0, waters: 0, pay: 0 },
    over: null,
  }
}

// --- Derived values ----------------------------------------------------------

export function openP0(s: NightState): boolean {
  return s.tickets.some((t) => t.severity === 'P0' && !t.phantom)
}

export function hallucinating(s: NightState): boolean {
  return s.sleep > HALLUCINATING
}

// Chance a deploy started right now ships a broken dependency.
export function deployRisk(s: NightState): number {
  return hallucinating(s) ? ((s.sleep - HALLUCINATING) / (1 - HALLUCINATING)) * MAX_BROKEN_CHANCE : 0
}

// Chance a Bug Hunt tap lands off target.
export function mistapChance(s: NightState): number {
  if (s.sleep <= MISTAP_SLEEP) return 0
  const base = ((s.sleep - MISTAP_SLEEP) / (1 - MISTAP_SLEEP)) * MAX_MISTAP
  return s.owned.has('mouse') ? base * 0.35 : base
}

export function deploySeconds(s: NightState): number {
  return s.owned.has('router') ? DEPLOY_SECONDS / 2 : DEPLOY_SECONDS
}

export function coffeeRefillSeconds(s: NightState): number {
  return s.owned.has('espresso') ? COFFEE_REFILL * 0.75 : COFFEE_REFILL
}

export function crashZone(s: NightState): boolean {
  return s.cfg.crashZone && s.t >= CRASH_AT
}

export function sleepRate(s: NightState): number {
  let rate = s.cfg.sleepRate
  if (s.crash > 0) rate *= CRASH_MULT
  if (crashZone(s)) rate *= CRASH_ZONE_MULT
  return rate
}

// The visual side of being tired, all 0..1.
export function tiredness(s: NightState) {
  const blur = Math.max(0, (s.sleep - 0.5) / 0.5) * (s.clearEyes > 0 ? 0.2 : 1)
  // The lids stay thin while you're fighting it, and only really close once you doze.
  const lids = s.sleep < 0.82 ? 0 : ((s.sleep - 0.82) / 0.18) * 0.25 + (s.dozing / DOZE_LIMIT) * 0.7
  return { blur, lids: Math.min(0.95, lids), vignette: Math.max(0, (s.sleep - 0.35) / 0.65) }
}

// Crash Zone: the screen flips to inverted colors now and then, more of the
// time the longer you go without splashing water. Slow (a cycle every ~6.5
// seconds, faded in CSS), never a strobe.
export function inverted(s: NightState): boolean {
  return s.invert >= 0.3 && Math.sin(s.t * 0.95) > 1 - s.invert * 1.2
}

export type DeployBlock = 'nothing' | 'busy' | 'p0' | 'away' | null

export function deployBlock(s: NightState): DeployBlock {
  if (s.deploy) return 'busy'
  if (s.away > 0) return 'away'
  if (s.staged.length === 0) return 'nothing'
  if (openP0(s)) return 'p0'
  return null
}

// --- Feed and tickets ---------------------------------------------------------

function post(s: NightState, handle: Handle, text: string, tone: PostTone) {
  s.feed.unshift({ id: s.nextId++, handle, text, tone, at: s.t })
  if (s.feed.length > 40) s.feed.length = 40
}

function chooseSeverity(s: NightState): Severity {
  const w = { ...s.cfg.weights }
  // One server fire at a time is plenty.
  if (openP0(s)) w.P0 = 0
  const total = w.P3 + w.P1 + w.P0
  let r = s.rng.next() * total
  for (const sev of ['P3', 'P1', 'P0'] as const) {
    r -= w[sev]
    if (r < 0) return sev
  }
  return 'P3'
}

function addTicket(s: NightState, fields: Partial<Ticket> & Pick<Ticket, 'severity' | 'game' | 'title'>): Ticket {
  const ticket: Ticket = { id: s.nextId++, age: 0, phantom: false, conflict: false, root: false, dupeOf: null, ...fields }
  s.tickets.push(ticket)
  return ticket
}

function spawnReport(s: NightState, regression = false) {
  if (s.bomb && !s.bomb.closed && !regression) {
    addTicket(s, { severity: 'P3', game: 'hunt', title: `Dupe: ${STREAMER_BUG.replace('Streamer bug: ', '')}`, dupeOf: s.bomb.rootId })
    post(s, pick(s.rng, PLAYERS), pick(s.rng, DUPE_POSTS), 'P3')
    s.events.push('report')
    return
  }
  // Quick Patch backfires are small regressions, never fires.
  const severity = regression ? 'P3' : chooseSeverity(s)
  const game = pick(s.rng, s.cfg.games)
  addTicket(s, { severity, game, title: pick(s.rng, TITLES[severity][game]) })
  post(s, pick(s.rng, PLAYERS), pick(s.rng, COMPLAINTS[severity]), severity)
  s.events.push(severity === 'P0' ? 'p0' : 'report')
}

function nextSpawnDelay(s: NightState): number {
  const progress = s.t / NIGHT_SECONDS
  let every = s.cfg.spawnEvery * (1 - 0.3 * progress)
  if (s.bomb && !s.bomb.closed) every /= REVIEW_BOMB_RATE
  return every * s.rng.range(0.75, 1.25)
}

function setBanner(s: NightState, title: string, text: string) {
  s.banner = { title, text, until: s.t + 4.5 }
}

function setToast(s: NightState, text: string) {
  s.toast = { text, until: s.t + 2.5 }
}

// --- Hazards ------------------------------------------------------------------

function stepHazards(s: NightState, dt: number) {
  const { cfg } = s

  if (cfg.reviewBomb && !s.bombDone && !s.bomb && s.t >= REVIEW_BOMB_AT) {
    const root = addTicket(s, { severity: 'P1', game: 'unravel', title: STREAMER_BUG, root: true })
    s.bomb = { rootId: root.id, left: REVIEW_BOMB_SECONDS, closed: false }
    post(s, STREAMER, STREAMER_POST, 'stream')
    setBanner(s, 'Review Bomb!', 'A streamer hit a glitch live. Reports are pouring in. Fix the streamer bug to close the duplicates.')
    s.spawnTimer = 0.5
    s.events.push('reviewBomb')
  }
  if (s.bomb && !s.bomb.closed) {
    s.bomb.left -= dt
    if (s.bomb.left <= 0) s.bomb.closed = true
  }

  if (cfg.phantoms && s.t >= PHANTOMS_AT) {
    s.phantomTimer -= dt
    if (s.phantomTimer <= 0) {
      s.phantomTimer = s.rng.range(11, 18)
      s.events.push('ping')
      if (s.rng.next() < 0.3 + 0.6 * s.sleep) {
        const severity: Severity = s.rng.next() < 0.6 ? 'P3' : 'P1'
        const game = pick(s.rng, cfg.games)
        addTicket(s, { severity, game, title: pick(s.rng, TITLES[severity][game]), phantom: true })
      }
    }
    // Imaginary tickets fade on their own after a while.
    s.tickets = s.tickets.filter((t) => !t.phantom || t.age < 14 || t.id === s.activeId)
  }

  if (cfg.mergeConflict && s.t >= MERGE_AT) {
    s.mergeTimer -= dt
    if (s.mergeTimer <= 0) {
      s.mergeTimer = s.rng.range(16, 24)
      post(s, TEAMMATE, pick(s.rng, TEAM_PUSH), 'team')
      if (s.staged.length > 0) {
        const victim = s.staged.splice(s.rng.int(0, s.staged.length), 1)[0]
        s.tickets.push({ ...victim, age: 0, game: 'unravel', conflict: true, title: victim.title.startsWith('Merge conflict') ? victim.title : `Merge conflict: ${victim.title}` })
      } else {
        addTicket(s, { severity: 'P3', game: 'unravel', title: pick(s.rng, CONFLICT_TITLES), conflict: true })
      }
      s.events.push('conflict')
    }
  }

  if (crashZone(s)) {
    if (!s.crashZoneStarted) {
      s.crashZoneStarted = true
      setBanner(s, '5 AM Crash Zone', 'Sleep is coming twice as fast and the colors are getting weird. Splash water to clear your head.')
      s.events.push('crashZone')
    }
    s.invert = Math.min(1, s.invert + dt / 14)
  }
}

function stepCat(s: NightState, dt: number) {
  if (!s.owned.has('cat')) return
  const cat = s.cat
  cat.timer -= dt
  if (cat.phase === 'walking') {
    cat.x = Math.min(1, cat.x + dt / 8)
    if (cat.timer <= 0) {
      cat.phase = 'sitting'
      cat.timer = 10
      s.events.push('catSit')
    }
  } else if (cat.phase === 'sitting') {
    if (cat.timer <= 0) {
      cat.phase = 'away'
      cat.timer = s.rng.range(25, 40)
    }
  } else if (cat.timer <= 0) {
    cat.phase = 'walking'
    cat.x = 0
    cat.timer = 8
    s.events.push('cat')
  }
}

// --- Deploys ------------------------------------------------------------------

function finishDeploy(s: NightState, d: Deploy) {
  s.deploy = null
  if (s.rng.next() < d.risk) {
    // Broken dependency: everything in the build goes back to the queue.
    for (const p of d.patches) s.tickets.push({ ...p, age: 0 })
    s.stats.broken++
    post(s, pick(s.rng, PLAYERS), pick(s.rng, BROKEN), 'bad')
    setToast(s, 'Broken dependency! You shipped half asleep and the patches bounced back.')
    s.events.push('broken')
    return
  }
  let restored = 0
  for (const p of d.patches) {
    restored += RESTORE[p.severity]
    s.stats.pay += PAY[p.severity]
    s.stats.shipped++
    if (p.root) {
      // The streamer bug is fixed for real, so every duplicate closes with it.
      const dupes = s.tickets.filter((t) => t.dupeOf === p.id).length
      s.tickets = s.tickets.filter((t) => t.dupeOf !== p.id)
      s.staged = s.staged.filter((t) => t.dupeOf !== p.id)
      restored += dupes * (RESTORE.P3 / 2)
      s.stats.pay += dupes
      if (s.bomb) s.bomb.closed = true
      s.bombDone = true
    }
  }
  s.rating = Math.min(MAX_RATING, s.rating + restored)
  post(s, pick(s.rng, PLAYERS), pick(s.rng, THANKS), 'good')
  s.events.push('deployDone')
}

// --- Step ---------------------------------------------------------------------

export function stepNight(s: NightState, dt: number) {
  if (s.over) return
  s.t += dt

  // Timers.
  s.coffeeRefill = Math.max(0, s.coffeeRefill - dt)
  s.jitters = Math.max(0, s.jitters - dt)
  s.crash = Math.max(0, s.crash - dt)
  s.away = Math.max(0, s.away - dt)
  s.waterCooldown = Math.max(0, s.waterCooldown - dt)
  s.clearEyes = Math.max(0, s.clearEyes - dt)
  s.shakeStamina = Math.min(1, s.shakeStamina + SHAKE_RECOVER * dt)
  if (s.toast && s.t > s.toast.until) s.toast = null
  if (s.banner && s.t > s.banner.until) s.banner = null

  // Sleep.
  s.sleep = Math.min(1, s.sleep + sleepRate(s) * dt)
  if (s.sleep >= 1) s.dozing += dt
  else s.dozing = Math.max(0, s.dozing - dt * 2)

  // New bug reports.
  s.spawnTimer -= dt
  if (s.spawnTimer <= 0) {
    spawnReport(s)
    s.spawnTimer = nextSpawnDelay(s)
  }
  s.delayedSpawns = s.delayedSpawns.filter((at) => {
    if (s.t < at) return true
    spawnReport(s, true)
    return false
  })

  stepHazards(s, dt)
  stepCat(s, dt)

  // Open tickets drain your rating and scare players off.
  let drain = 0
  let leaks = 0
  for (const t of s.tickets) {
    t.age += dt
    if (t.phantom) continue
    drain += DRAIN[t.severity]
    if (t.severity !== 'P3') leaks++
  }
  s.rating = Math.max(0, s.rating - drain * dt)
  const targetUsers = STARTING_USERS * (0.25 + 0.75 * (s.rating / MAX_RATING)) * Math.pow(0.85, leaks)
  s.users += (targetUsers - s.users) * Math.min(1, dt * 0.5)

  if (s.deploy) {
    s.deploy.halted = openP0(s)
    if (!s.deploy.halted) s.deploy.progress += dt / s.deploy.duration
    if (s.deploy.progress >= 1) finishDeploy(s, s.deploy)
  }

  if (s.activeId !== null && !s.tickets.some((t) => t.id === s.activeId)) s.activeId = null

  if (s.rating <= 0) s.over = 'rating'
  else if (s.dozing >= DOZE_LIMIT) s.over = 'asleep'
  else if (s.t >= NIGHT_SECONDS) s.over = 'survived'
}

// --- Actions ------------------------------------------------------------------

export type OpenResult = 'opened' | 'phantom' | null

export function openTicket(s: NightState, id: number): OpenResult {
  if (s.over || s.away > 0 || s.activeId !== null) return null
  const ticket = s.tickets.find((t) => t.id === id)
  if (!ticket) return null
  if (ticket.phantom) {
    s.tickets = s.tickets.filter((t) => t.id !== id)
    setToast(s, pick(s.rng, PHANTOM_TOAST))
    s.events.push('phantom')
    return 'phantom'
  }
  s.activeId = id
  return 'opened'
}

export function abandonTicket(s: NightState) {
  s.activeId = null
}

function stage(s: NightState, id: number): Ticket | null {
  const ticket = s.tickets.find((t) => t.id === id)
  if (!ticket) return null
  s.tickets = s.tickets.filter((t) => t.id !== id)
  s.staged.push({ ...ticket, conflict: false })
  s.stats.fixed++
  return ticket
}

export function completeFix(s: NightState, id: number) {
  if (s.activeId === id) s.activeId = null
  if (stage(s, id)) s.events.push('fixed')
}

export function failFix(s: NightState, id: number) {
  if (s.activeId === id) s.activeId = null
  setToast(s, 'Tests failed. The bug is still there.')
  s.events.push('fixFailed')
}

export function canQuickPatch(s: NightState, ticket: Ticket): boolean {
  return !s.over && s.away <= 0 && ticket.severity !== 'P0' && s.activeId !== ticket.id
}

// 80%: fixed. 20%: also fixed... but two new small bugs quietly show up a few seconds later.
export function quickPatch(s: NightState, id: number): boolean {
  const ticket = s.tickets.find((t) => t.id === id)
  if (!ticket || !canQuickPatch(s, ticket)) return false
  if (ticket.phantom) {
    openTicket(s, id)
    return false
  }
  stage(s, id)
  s.stats.quickPatches++
  if (s.rng.next() < QUICK_PATCH_FAIL) {
    s.stats.quickBackfires++
    s.delayedSpawns.push(s.t + s.rng.range(4, 8), s.t + s.rng.range(8, 12))
  }
  s.events.push('quickPatch')
  return true
}

export function startDeploy(s: NightState): boolean {
  if (s.over || deployBlock(s)) return false
  s.deploy = { patches: s.staged, progress: 0, duration: deploySeconds(s), risk: deployRisk(s), halted: false }
  s.staged = []
  s.events.push('deployStart')
  return true
}

export function coffeeReady(s: NightState): boolean {
  return s.cfg.coffee && s.coffeeRefill <= 0 && s.away <= 0 && !s.over
}

export function drinkCoffee(s: NightState): boolean {
  if (!coffeeReady(s)) return false
  const espresso = s.owned.has('espresso')
  s.sleep = Math.max(0, s.sleep - (espresso ? COFFEE_POTENCY * 1.25 : COFFEE_POTENCY))
  s.jitters = espresso ? COFFEE_JITTERS * 0.4 : COFFEE_JITTERS
  s.coffeeRefill = coffeeRefillSeconds(s)
  s.coffeeStreak++
  s.stats.coffees++
  s.events.push('coffee')
  if (s.coffeeStreak >= CRASH_AFTER) {
    s.coffeeStreak = 0
    s.crash = CRASH_SECONDS
    setToast(s, 'Caffeine crash! Too much coffee, not enough water.')
    s.events.push('crash')
  }
  return true
}

export function waterReady(s: NightState): boolean {
  return s.waterCooldown <= 0 && s.away <= 0 && !s.over
}

// Three seconds away from the desk: clears your eyes, the Crash Zone colors,
// and the coffee streak.
export function splashWater(s: NightState): boolean {
  if (!waterReady(s)) return false
  s.away = WATER_AWAY
  s.waterCooldown = WATER_AWAY + WATER_COOLDOWN
  s.sleep = Math.max(0, s.sleep - WATER_RELIEF)
  s.clearEyes = WATER_CLEAR_SECONDS
  s.invert = 0
  s.coffeeStreak = 0
  s.crash = 0
  s.stats.waters++
  s.events.push('water')
  return true
}

// One tap of the wake-up mash. Strong at first, weaker as you tire your arms out.
export function shakeAwake(s: NightState) {
  if (s.over || s.away > 0) return
  s.sleep = Math.max(0, s.sleep - SHAKE_RELIEF * s.shakeStamina)
  s.shakeStamina = Math.max(0, s.shakeStamina - SHAKE_COST)
  s.events.push('shake')
}

export function petCat(s: NightState): boolean {
  if (s.over || s.cat.phase === 'away') return false
  s.sleep = Math.max(0, s.sleep - CAT_PET_RELIEF)
  s.cat.phase = 'away'
  s.cat.timer = s.rng.range(25, 40)
  s.events.push('catPet')
  return true
}

// Whether the ignored cat is lying across the screen (it blocks part of Bug Hunt).
export function catOnScreen(s: NightState): boolean {
  return s.cat.phase === 'sitting'
}

// --- Results ------------------------------------------------------------------

export interface NightResult {
  outcome: Outcome
  stars: number
  pay: number
  stats: NightStats
  reached: number // seconds into the night
}

export function nightResult(s: NightState): NightResult {
  const outcome = s.over ?? 'survived'
  const survived = outcome === 'survived'
  const stars = survived ? Math.max(0.5, Math.round(s.rating * 2) / 2) : 0
  let pay = s.stats.pay
  if (survived) pay += 15 + Math.floor(s.rating) * 6
  else pay = Math.floor(pay / 2)
  return { outcome, stars, pay, stats: { ...s.stats }, reached: s.t }
}

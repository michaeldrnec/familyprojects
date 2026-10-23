import { describe, expect, it } from 'vitest'
import { makeRng } from '../../../shared/rng'
import { DOZE_LIMIT, NIGHTS, NIGHT_SECONDS, REVIEW_BOMB_AT, UPGRADES, clockLabel, type UpgradeId } from './config'
import {
  coffeeReady,
  coffeeRefillSeconds,
  completeFix,
  deployBlock,
  deploySeconds,
  drinkCoffee,
  failFix,
  newNight,
  nightResult,
  openTicket,
  petCat,
  quickPatch,
  splashWater,
  shakeAwake,
  startDeploy,
  stepNight,
  mistapChance,
  waterReady,
  type NightState,
  type Ticket,
} from './night'

const DT = 0.1

// A steady, decent player: works the worst ticket first, takes several
// seconds per mini-game (and fails some), quick-patches bugs (smallest first)
// when the queue backs up, deploys in batches and keeps itself awake.
function playNight(night: number, seed: number, owned: UpgradeId[] = []): NightState {
  const s = newNight(night, owned, seed)
  const rng = makeRng(seed * 2654435761)
  let working: { id: number; left: number; fail: number } | null = null
  let thinking = 0
  const rank = (t: Ticket) => (t.severity === 'P0' ? 0 : t.severity === 'P1' ? 1 : 2) * 1000 - t.age
  while (!s.over) {
    stepNight(s, DT)
    if (s.over) break

    if (s.cfg.coffee && s.sleep > 0.65 && coffeeReady(s)) drinkCoffee(s)
    else if ((s.coffeeStreak >= 2 || s.invert > 0.5 || (s.sleep > 0.6 && !s.cfg.coffee)) && waterReady(s) && !working) splashWater(s)
    if (s.sleep > 0.8 && Math.round(s.t / DT) % 2 === 0) shakeAwake(s)
    if (s.cat.phase !== 'away') petCat(s)

    if (!deployBlock(s) && (s.staged.length >= 3 || s.staged.some((t) => t.severity !== 'P3') || s.t > NIGHT_SECONDS - 20)) startDeploy(s)

    if (working) {
      working.left -= DT
      if (working.left <= 0) {
        if (s.activeId === working.id) {
          if (rng.next() < 0.15) failFix(s, working.id)
          else completeFix(s, working.id)
        }
        working = null
        thinking = 1.5
      }
    } else if ((thinking -= DT) <= 0 && s.away <= 0 && s.tickets.length > 0) {
      // Swamped: roll the dice on the oldest small bug instead.
      const small = s.tickets.find((t) => t.severity === 'P3') ?? s.tickets.find((t) => t.severity === 'P1')
      if (s.tickets.length >= 5 && small) {
        quickPatch(s, small.id)
        thinking = 1.5
        continue
      }
      const next = [...s.tickets].sort((a, b) => rank(a) - rank(b))[0]
      if (openTicket(s, next.id) === 'opened') {
        // A Bug Hunt lasts about as long as its bugs take to arrive; sleepy mis-taps make it harder to pass.
        const hunt = { P3: 7, P1: 8.5, P0: 10 }[next.severity] / s.cfg.speed
        working =
          next.game === 'hunt'
            ? { id: next.id, left: hunt, fail: 0.12 + mistapChance(s) }
            : { id: next.id, left: 11 + (next.severity === 'P0' ? 3 : 0), fail: 0.12 }
      }
    }
  }
  return s
}

// Does nothing at all.
function idleNight(night: number, seed: number): NightState {
  const s = newNight(night, [], seed)
  while (!s.over) stepNight(s, DT)
  return s
}

describe('the clock', () => {
  it('runs from 11 PM to 6 AM', () => {
    expect(clockLabel(0)).toBe('11:00 PM')
    expect(clockLabel(REVIEW_BOMB_AT)).toBe('1:00 AM')
    expect(clockLabel(NIGHT_SECONDS)).toBe('6:00 AM')
  })
})

describe('balance', () => {
  for (let night = 0; night < NIGHTS.length; night++) {
    it(`a steady player survives ${NIGHTS[night].day} with no upgrades`, () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const s = playNight(night, seed)
        expect(s.over, `seed ${seed}`).toBe('survived')
        expect(s.rating, `seed ${seed}`).toBeGreaterThan(1.5)
      }
    })

    it(`an idle player loses ${NIGHTS[night].day}`, () => {
      for (const seed of [1, 2, 3]) expect(idleNight(night, seed).over).not.toBe('survived')
    })
  }

  it('each upgrade helps', () => {
    const plain = newNight(4, [], 1)
    const kitted = newNight(4, ['mouse', 'espresso', 'router', 'cat'], 1)
    plain.sleep = kitted.sleep = 0.9
    expect(mistapChance(kitted)).toBeLessThan(mistapChance(plain))
    expect(deploySeconds(kitted)).toBeLessThan(deploySeconds(plain))
    expect(coffeeRefillSeconds(kitted)).toBeLessThan(coffeeRefillSeconds(plain))
    drinkCoffee(plain)
    drinkCoffee(kitted)
    expect(kitted.sleep).toBeLessThan(plain.sleep)
    expect(kitted.jitters).toBeLessThan(plain.jitters)
    kitted.cat.phase = 'walking'
    const before = kitted.sleep
    expect(petCat(kitted)).toBe(true)
    expect(kitted.sleep).toBeLessThan(before)
  })

  it('pays enough over a good week to buy every upgrade', () => {
    let total = 0
    for (let night = 0; night < NIGHTS.length; night++) total += nightResult(playNight(night, 7)).pay
    expect(total).toBeGreaterThan(UPGRADES.reduce((sum, u) => sum + u.cost, 0))
  })
})

describe('rules', () => {
  function withTicket(night = 1): [NightState, Ticket] {
    const s = newNight(night, [], 42)
    while (s.tickets.length === 0) stepNight(s, DT)
    return [s, s.tickets[0]]
  }

  it('only restores rating once a patch is deployed', () => {
    const [s, ticket] = withTicket()
    openTicket(s, ticket.id)
    completeFix(s, ticket.id)
    const before = s.rating
    expect(s.staged).toHaveLength(1)
    expect(startDeploy(s)).toBe(true)
    while (s.deploy) stepNight(s, DT)
    expect(s.rating).toBeGreaterThan(before)
    expect(s.stats.shipped).toBe(1)
  })

  it('blocks deploys while a P0 is open', () => {
    const [s, ticket] = withTicket(2)
    openTicket(s, ticket.id)
    completeFix(s, ticket.id)
    s.tickets.push({ ...ticket, id: 999, severity: 'P0' })
    expect(deployBlock(s)).toBe('p0')
    expect(startDeploy(s)).toBe(false)
  })

  it('halts a running deploy when a P0 lands', () => {
    const [s, ticket] = withTicket(2)
    openTicket(s, ticket.id)
    completeFix(s, ticket.id)
    startDeploy(s)
    s.tickets.push({ ...ticket, id: 999, severity: 'P0' })
    stepNight(s, 1)
    expect(s.deploy?.halted).toBe(true)
    expect(s.deploy?.progress).toBe(0)
  })

  it('sends patches back when you deploy half asleep and it breaks', () => {
    const [s, ticket] = withTicket()
    openTicket(s, ticket.id)
    completeFix(s, ticket.id)
    s.sleep = 0.99
    startDeploy(s)
    s.deploy!.risk = 1
    s.sleep = 0.2
    while (s.deploy) stepNight(s, DT)
    expect(s.stats.broken).toBe(1)
    expect(s.tickets.some((t) => t.id === ticket.id)).toBe(true)
  })

  it('backfires on about 20% of quick patches', () => {
    let backfires = 0
    const tries = 400
    for (let seed = 0; seed < tries; seed++) {
      const [s, ticket] = (() => {
        const st = newNight(0, [], seed)
        while (st.tickets.length === 0) stepNight(st, DT)
        return [st, st.tickets[0]] as const
      })()
      expect(quickPatch(s, ticket.id)).toBe(true)
      backfires += s.stats.quickBackfires
    }
    expect(backfires / tries).toBeGreaterThan(0.14)
    expect(backfires / tries).toBeLessThan(0.26)
  })

  it('quick patch backfires bring two new bugs a few seconds later', () => {
    for (let seed = 0; ; seed++) {
      const s = newNight(0, [], seed)
      while (s.tickets.length === 0) stepNight(s, DT)
      quickPatch(s, s.tickets[0].id)
      if (!s.stats.quickBackfires) continue
      expect(s.delayedSpawns).toHaveLength(2)
      s.spawnTimer = 1000
      for (let i = 0; i < 130; i++) stepNight(s, DT)
      expect(s.tickets).toHaveLength(2)
      break
    }
  })

  it('will not quick-patch a server fire', () => {
    const [s, ticket] = withTicket(2)
    ticket.severity = 'P0'
    expect(quickPatch(s, ticket.id)).toBe(false)
  })

  it('crashes after three coffees without water', () => {
    const s = newNight(1, [], 1)
    for (let i = 0; i < 3; i++) {
      s.coffeeRefill = 0
      drinkCoffee(s)
    }
    expect(s.crash).toBeGreaterThan(0)
    s.crash = 0
    s.coffeeStreak = 2
    splashWater(s)
    expect(s.coffeeStreak).toBe(0)
  })

  it('falls asleep after a few seconds at 100%', () => {
    const s = newNight(0, [], 1)
    s.sleep = 1
    let t = 0
    while (!s.over) {
      stepNight(s, DT)
      t += DT
    }
    expect(s.over).toBe('asleep')
    expect(t).toBeCloseTo(DOZE_LIMIT, 0)
  })

  it('fixing and deploying the streamer bug closes its duplicates', () => {
    const s = newNight(2, [], 3)
    // Keep the night alive while we wait for 1 AM.
    const advance = () => {
      s.rating = 5
      s.sleep = 0
      stepNight(s, DT)
    }
    while (!s.bomb) advance()
    for (let i = 0; i < 100; i++) advance()
    const root = s.tickets.find((t) => t.root)!
    expect(s.tickets.some((t) => t.dupeOf === root.id)).toBe(true)
    // Clear any server fire so the deploy can go out.
    s.tickets = s.tickets.filter((t) => t.severity !== 'P0')
    openTicket(s, root.id)
    completeFix(s, root.id)
    startDeploy(s)
    s.deploy!.risk = 0
    s.spawnTimer = 1000
    while (s.deploy) advance()
    expect(s.tickets.some((t) => t.dupeOf === root.id)).toBe(false)
  })

  it('phantom tickets vanish when opened and never drain', () => {
    const [s, ticket] = withTicket()
    ticket.phantom = true
    expect(openTicket(s, ticket.id)).toBe('phantom')
    expect(s.tickets).toHaveLength(0)
  })
})

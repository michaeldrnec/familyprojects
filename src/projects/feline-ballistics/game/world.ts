// GameWorld: one level's simulation (SPEC.md sections 2-5). No DOM: the
// Play screen owns one, feeds it input, calls step() every frame and draws
// from its state; the QA harness drives the same class headlessly.
//
// Units: Matter's own (≈ px). Velocities are per 1/60 s (Matter's
// "baseDelta" convention). Physics runs in fixed 1/180 s substeps, so a
// replayed sequence of shots and actions reproduces exactly.
import Matter from 'matter-js'
import { BREEDS, type Breed, type BreedId } from './breeds'
import { MATERIALS, type Material, type SoundKind } from './materials'
import { PREFABS, buildPrefab, buildShard, sliceShards, CAT_WORLD, CAT_CATBODY, CAT_SHARD, type PrefabId } from './objects'
import {
  createCat,
  removeCat,
  stepCat,
  setLoaf,
  catCenter,
  catVelocity,
  addCatVelocity,
  setCatVelocity,
  catMass,
  type Cat,
} from './cat'
import { makeRng, type Rng } from '../rng'
import { floorY, type LevelDef, type Shot, type ShotAction } from '../levels/types'

export const SUBSTEP = 1 / 180 // s
const SUBSTEP_MS = SUBSTEP * 1000
const MAX_SUBSTEPS_PER_FRAME = 12
const PRESETTLE_STEPS = 90
export const GRAVITY = 1000 // units/s² (Matter gravity 1 × scale 0.001, per ms²)
export const UNUSED_CAT_BONUS = 5000
const SETTLE_SPEED = 0.35
const SETTLE_TIME = 1.0
const SHOT_CAP = 12
const MAX_SHARDS = 90
const SHARD_LIFE = 5
export const SCREAM_RADIUS = 260
export const SWIPE_RADIUS = 90

export type Phase = 'aim' | 'flying' | 'won' | 'lost'

export interface WorldObject {
  id: number
  prefab: PrefabId | 'floor' | 'wall' | 'dog' | 'shard' | 'crumple'
  body: Matter.Body
  material: Material
  w: number
  h: number
  hp: number
  precious: boolean
  alive: boolean
  broken: boolean
  husk: boolean
  toppled: boolean
  isStatic: boolean
  sensor?: 'grip' | 'fan' | 'face'
  spawn: { x: number; y: number; angle: number }
  life: number // shards: seconds left
  lastSound: number
}

export type GameEvent =
  | { kind: 'break'; x: number; y: number; material: Material; precious: boolean }
  | { kind: 'impact'; x: number; y: number; sound: SoundKind; strength: number }
  | { kind: 'popup'; x: number; y: number; text: string; big: boolean }
  | { kind: 'launch'; breed: BreedId; x: number; y: number }
  | { kind: 'ability'; breed: BreedId; x: number; y: number }
  | { kind: 'swish'; x: number; y: number; glide: boolean }
  | { kind: 'loaf'; x: number; y: number }
  | { kind: 'grip'; x: number; y: number }
  | { kind: 'fan'; x: number; y: number }
  | { kind: 'bark'; x: number; y: number }
  | { kind: 'stir'; x: number; y: number }
  | { kind: 'catLeave'; x: number; y: number; breed: BreedId }
  | { kind: 'shake'; amount: number }
  | { kind: 'won' }
  | { kind: 'lost' }

interface Dog {
  obj: WorldObject
  state: 'sleep' | 'frenzy'
  t: number
  dir: number
  barkT: number
}

interface PendingDamage {
  obj: WorldObject
  impact: number
  byCat: Cat | null
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export class GameWorld {
  readonly level: LevelDef
  readonly engine: Matter.Engine
  readonly objects: WorldObject[] = []
  readonly rng: Rng
  private byBody = new Map<number, WorldObject>()
  private nextId = 1
  phase: Phase = 'aim'
  lineupIndex = 0 // next cat to launch
  cat: Cat | null = null
  dog: Dog | null = null
  time = 0 // sim seconds since load
  shotTime = 0
  private calm = 0
  chaos = 0
  bonus = 0
  private chain = 0
  private lastBreakT = -10
  private burst = 0
  private burstT = -10
  slowmo = 0 // real seconds of slow motion left
  aim = { angle: -Math.PI / 4, power: 0.7 }
  events: GameEvent[] = []
  private damageOn = false
  private pending: PendingDamage[] = []
  private pendingBounce = false
  private gripContact: { particle: Matter.Body; t: number } | null = null
  private wakeQueue: Matter.Body[] = []
  private faceHit = false
  private fanUsed = false
  private script: ShotAction[] = []
  private acc = 0
  shotsTaken = 0

  constructor(level: LevelDef, seed?: number) {
    this.level = level
    this.rng = makeRng(seed ?? hashString(level.id))
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 },
      enableSleeping: true,
      positionIterations: 10,
      velocityIterations: 8,
      constraintIterations: 4,
    })
    this.buildRoom()
    for (const spec of level.objects) this.addObject(spec.prefab, spec.x, spec.y, spec.angle ?? 0, spec.w, spec.h, !!spec.precious, spec.material)
    if (level.dog) this.addDog(level.dog.x)

    Matter.Events.on(this.engine, 'collisionStart', (e) => this.onCollisionStart(e.pairs))
    Matter.Events.on(this.engine, 'collisionActive', (e) => this.onCollisionActive(e.pairs))

    // Let everything find its footing, then freeze it asleep so towers
    // never jitter over before the first cat arrives.
    for (let i = 0; i < PRESETTLE_STEPS; i++) Matter.Engine.update(this.engine, SUBSTEP_MS)
    for (const o of this.objects) {
      if (o.isStatic || !o.alive) continue
      o.spawn = { x: o.body.position.x, y: o.body.position.y, angle: o.body.angle }
      if (o.prefab !== 'dog') Matter.Sleeping.set(o.body, true)
    }
    this.events = []
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  get floorY() {
    return floorY(this.level)
  }

  private register(o: Omit<WorldObject, 'id' | 'alive' | 'broken' | 'husk' | 'toppled' | 'life' | 'lastSound' | 'spawn'>): WorldObject {
    const obj: WorldObject = {
      ...o,
      id: this.nextId++,
      alive: true,
      broken: false,
      husk: false,
      toppled: false,
      life: 0,
      lastSound: -1,
      spawn: { x: o.body.position.x, y: o.body.position.y, angle: o.body.angle },
    }
    this.objects.push(obj)
    this.byBody.set(o.body.id, obj)
    for (const part of o.body.parts) this.byBody.set(part.id, obj)
    if (!o.isStatic) {
      Matter.Events.on(o.body, 'sleepEnd', () => this.wakeQueue.push(o.body))
    }
    Matter.Composite.add(this.engine.world, o.body)
    return obj
  }

  private buildRoom() {
    const { width: W } = this.level
    const fy = this.floorY
    const opts = { isStatic: true, friction: 0.8, restitution: 0.1, collisionFilter: { category: CAT_WORLD, mask: CAT_WORLD | CAT_CATBODY | CAT_SHARD } }
    const floor = Matter.Bodies.rectangle(W / 2, fy + 150, W + 3000, 300, opts)
    const left = Matter.Bodies.rectangle(-80, fy - 1200, 160, 3000, opts)
    const right = Matter.Bodies.rectangle(W + 80, fy - 1200, 160, 3000, opts)
    const mat = MATERIALS.static
    for (const [body, kind] of [[floor, 'floor'], [left, 'wall'], [right, 'wall']] as const) {
      this.register({ prefab: kind, body, material: mat, w: 0, h: 0, hp: Infinity, precious: false, isStatic: true })
    }
  }

  addObject(prefab: PrefabId, x: number, y: number, angle = 0, w?: number, h?: number, precious = false, materialOverride?: Material['id']): WorldObject {
    const def = PREFABS[prefab]
    const body = buildPrefab(prefab, x, y, angle, w, h)
    const material = MATERIALS[materialOverride ?? def.material]
    return this.register({
      prefab,
      body,
      material,
      w: w ?? def.w,
      h: h ?? def.h,
      hp: material.hp,
      precious,
      isStatic: !!def.isStatic,
      sensor: def.sensor,
    })
  }

  private addDog(x: number) {
    const fy = this.floorY
    const body = Matter.Bodies.rectangle(x, fy - 24, 100, 46, {
      density: 0.004,
      friction: 0.3,
      restitution: 0.1,
      chamfer: { radius: 14 },
      sleepThreshold: -1,
      inertia: Infinity, // it runs, it doesn't tumble
      collisionFilter: { category: CAT_WORLD, mask: CAT_WORLD | CAT_CATBODY | CAT_SHARD },
    })
    const obj = this.register({ prefab: 'dog', body, material: MATERIALS.fabric, w: 100, h: 46, hp: Infinity, precious: false, isStatic: false })
    this.dog = { obj, state: 'sleep', t: 0, dir: 1, barkT: 0 }
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  get currentBreed(): Breed | null {
    const id = this.level.lineup[this.lineupIndex]
    return id ? BREEDS[id] : null
  }

  get catsLeft(): number {
    return this.level.lineup.length - this.lineupIndex
  }

  get perch() {
    return this.level.perch
  }

  // "Down" = broken, knocked off its perch (dropped), or -- for things
  // already on the floor -- batted well away, cat-under-the-fridge style.
  isDown(o: WorldObject): boolean {
    if (o.broken) return true
    if (o.body.position.y - o.spawn.y > o.h * 0.6) return true
    return Math.abs(o.body.position.x - o.spawn.x) > Math.max(80, o.w * 2.5)
  }

  get precious(): WorldObject[] {
    return this.objects.filter((o) => o.precious)
  }

  get preciousLeft(): number {
    return this.precious.filter((o) => !this.isDown(o)).length
  }

  get score(): number {
    return Math.round(this.chaos + this.bonus)
  }

  get stars(): number {
    if (this.phase !== 'won') return 0
    const s = this.score
    const [, two, three] = this.level.stars
    return s >= three ? 3 : s >= two ? 2 : 1
  }

  // Ballistic preview in world coordinates for the current aim.
  previewPoints(n = 22, horizon = 0.8): { x: number; y: number }[] {
    const breed = this.currentBreed
    if (!breed) return []
    const v = this.launchVelocity(breed)
    const pts: { x: number; y: number }[] = []
    for (let i = 1; i <= n; i++) {
      const t = (i / n) * horizon
      pts.push({ x: this.perch.x + v.x * 60 * t, y: this.perch.y + v.y * 60 * t + 0.5 * GRAVITY * t * t })
    }
    return pts
  }

  private launchVelocity(breed: Breed) {
    const speed = breed.maxSpeed * Math.max(0.15, Math.min(1, this.aim.power))
    return { x: Math.cos(this.aim.angle) * speed, y: Math.sin(this.aim.angle) * speed }
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  setAim(angle: number, power: number) {
    // Keep aim in the forward hemisphere-ish so a cat can't be fired into the wall behind.
    this.aim.angle = Math.max(-Math.PI * 0.95, Math.min(Math.PI * 0.45, angle))
    this.aim.power = Math.max(0, Math.min(1, power))
  }

  launch(shot?: Shot): boolean {
    if (this.phase !== 'aim') return false
    const breed = this.currentBreed
    if (!breed) return false
    if (shot) this.setAim(shot.angle, shot.power)
    this.script = shot?.actions ? [...shot.actions].sort((a, b) => a.at - b.at) : []
    this.cat = createCat(this.engine.world, breed, this.perch.x, this.perch.y)
    setCatVelocity(this.cat, this.launchVelocity(breed))
    this.lineupIndex++
    this.shotsTaken++
    this.phase = 'flying'
    this.shotTime = 0
    this.calm = 0
    this.damageOn = true
    this.faceHit = false
    this.fanUsed = false
    this.events.push({ kind: 'launch', breed: breed.id, x: this.perch.x, y: this.perch.y })
    return true
  }

  private get flying(): Cat | null {
    return this.phase === 'flying' && this.cat && this.cat.state !== 'gone' ? this.cat : null
  }

  tap(): boolean {
    const cat = this.flying
    if (!cat || cat.abilityLeft <= 0) return false
    cat.abilityLeft--
    const c = catCenter(cat)
    this.events.push({ kind: 'ability', breed: cat.breed.id, x: c.x, y: c.y })
    switch (cat.breed.ability) {
      case 'zoomies': {
        const v = catVelocity(cat)
        const cap = cat.breed.maxSpeed * 1.5
        const sp = Math.hypot(v.x, v.y)
        const k = Math.min(1.6, cap / Math.max(1, sp))
        addCatVelocity(cat, { x: v.x * (k - 1), y: v.y * (k - 1) })
        cat.zoom = 0.8
        break
      }
      case 'slam': {
        setCatVelocity(cat, { x: 0, y: 16 })
        cat.slam = 1.2
        cat.face = 'yowl'
        break
      }
      case 'scream': {
        cat.face = 'yowl'
        for (const o of this.objects) {
          if (!o.alive || o.sensor || o.prefab === 'shard' || o.prefab === 'crumple') continue
          const d = Math.hypot(o.body.position.x - c.x, o.body.position.y - c.y)
          if (d > SCREAM_RADIUS) continue
          if (o.material.sonicVulnerable) {
            this.breakObject(o)
          } else if (!o.isStatic && o.prefab !== 'dog' && o.body.mass < 2.5) {
            Matter.Sleeping.set(o.body, false)
            const k = 3 * (1 - d / SCREAM_RADIUS)
            const v = Matter.Body.getVelocity(o.body)
            Matter.Body.setVelocity(o.body, { x: v.x + ((o.body.position.x - c.x) / (d || 1)) * k, y: v.y + ((o.body.position.y - c.y) / (d || 1)) * k - 1 })
          }
        }
        if (this.dog) {
          const dp = this.dog.obj.body.position
          if (Math.hypot(dp.x - c.x, dp.y - c.y) < SCREAM_RADIUS * 1.6) this.wakeDog()
        }
        break
      }
      case 'swipe': {
        const v = catVelocity(cat)
        const dir = v.x >= 0 ? 1 : -1
        for (const o of this.objects) {
          if (!o.alive || o.isStatic || o.sensor || o.prefab === 'dog' || o.prefab === 'shard') continue
          if (o.body.mass > 5) continue
          const dx = o.body.position.x - c.x
          const dy = o.body.position.y - c.y
          const reach = SWIPE_RADIUS + Math.max(o.w, o.h) / 2
          if (Math.hypot(dx, dy) > reach) continue
          Matter.Sleeping.set(o.body, false)
          const ov = Matter.Body.getVelocity(o.body)
          Matter.Body.setVelocity(o.body, { x: ov.x + dir * 7, y: ov.y - 3 })
          Matter.Body.setAngularVelocity(o.body, dir * 0.25)
        }
        break
      }
    }
    return true
  }

  holdStart() {
    const cat = this.flying
    if (!cat) return
    cat.holding = true
    if (!this.tryGrip(cat)) {
      setLoaf(cat, true)
      const c = catCenter(cat)
      this.events.push({ kind: 'loaf', x: c.x, y: c.y })
    }
  }

  holdEnd() {
    const cat = this.flying
    if (!cat) return
    cat.holding = false
    if (cat.grip) this.releaseGrip(cat, true)
    setLoaf(cat, false)
  }

  swipe(dx: number, dy: number): boolean {
    const cat = this.flying
    if (!cat || cat.swishes <= 0 || cat.grip) return false
    const len = Math.hypot(dx, dy)
    if (len < 1e-3) return false
    cat.swishes--
    const c = catCenter(cat)
    if (dy < 0 && Math.abs(dy) > Math.abs(dx)) {
      cat.glide = 1.2
      this.events.push({ kind: 'swish', x: c.x, y: c.y, glide: true })
    } else {
      addCatVelocity(cat, { x: (dx / len) * 2.7, y: (dy / len) * 2.7 })
      cat.spin = dx >= 0 ? 1 : -1
      this.events.push({ kind: 'swish', x: c.x, y: c.y, glide: false })
    }
    return true
  }

  private tryGrip(cat: Cat): boolean {
    if (cat.gripUsed || cat.grip || !this.gripContact || this.time - this.gripContact.t > 0.05) return false
    const p = this.gripContact.particle
    setLoaf(cat, false)
    cat.grip = Matter.Constraint.create({
      bodyA: p,
      pointB: { x: p.position.x, y: p.position.y },
      length: 0,
      stiffness: 0.5,
      damping: 0.08,
    })
    Matter.Composite.add(this.engine.world, cat.grip)
    cat.gripUsed = true
    cat.gripTime = 0
    cat.state = 'gripping'
    this.events.push({ kind: 'grip', x: p.position.x, y: p.position.y })
    return true
  }

  private releaseGrip(cat: Cat, boost: boolean) {
    if (!cat.grip) return
    Matter.Composite.remove(this.engine.world, cat.grip)
    cat.grip = null
    cat.state = 'flying'
    if (boost) {
      const v = catVelocity(cat)
      addCatVelocity(cat, { x: v.x * 0.2, y: v.y * 0.2 - 1.5 })
    }
  }

  // -------------------------------------------------------------------------
  // Stepping
  // -------------------------------------------------------------------------

  // Advance by a real-time frame delta (slow-mo aware). Returns substeps run.
  step(frameDt: number): number {
    if (this.slowmo > 0) this.slowmo = Math.max(0, this.slowmo - frameDt)
    this.acc += Math.min(0.1, frameDt) * (this.slowmo > 0 ? 0.35 : 1)
    let n = 0
    while (this.acc >= SUBSTEP && n < MAX_SUBSTEPS_PER_FRAME) {
      this.acc -= SUBSTEP
      this.substep()
      n++
    }
    if (n === MAX_SUBSTEPS_PER_FRAME) this.acc = 0
    return n
  }

  // Run the current shot to completion (headless / QA).
  runShot(maxSeconds = SHOT_CAP + 2) {
    let t = 0
    while (this.phase === 'flying' && t < maxSeconds) {
      this.substep()
      t += SUBSTEP
    }
  }

  substep() {
    this.time += SUBSTEP
    const cat = this.flying
    if (cat) {
      this.shotTime += SUBSTEP
      this.runScript(cat)
      stepCat(cat, SUBSTEP)
      if (cat.grip) {
        cat.gripTime += SUBSTEP
        if (cat.gripTime > 2) this.releaseGrip(cat, true)
      } else if (cat.holding) {
        this.tryGrip(cat)
      }
    }
    this.stepDog()

    Matter.Engine.update(this.engine, SUBSTEP_MS)

    this.processWakes()
    this.applyDamage()
    if (this.pendingBounce && this.cat && this.cat.state !== 'gone') {
      this.pendingBounce = false
      const v = catVelocity(this.cat)
      const a = this.rng.range(-0.44, 0.44)
      const c = Math.cos(a)
      const s = Math.sin(a)
      addCatVelocity(this.cat, { x: v.x * c - v.y * s - v.x, y: v.x * s + v.y * c - v.y })
    }
    this.stepShards()
    if (Math.round(this.time / SUBSTEP) % 10 === 0) this.checkTopples()
    if (this.phase === 'flying') this.checkShotEnd()
  }

  private runScript(cat: Cat) {
    while (this.script.length && this.script[0].at <= this.shotTime) {
      const a = this.script.shift()!
      if (a.kind === 'tap') this.tap()
      else if (a.kind === 'hold') this.holdStart()
      else if (a.kind === 'release') this.holdEnd()
      else if (a.kind === 'swipe') this.swipe(a.dx, a.dy)
      if (cat.state === 'gone') break
    }
  }

  private checkShotEnd() {
    const cat = this.cat
    if (cat && cat.state !== 'gone') {
      const c = catCenter(cat)
      const { width: W } = this.level
      if (c.x < -300 || c.x > W + 300 || c.y > this.floorY + 400 || c.y < -3000) {
        this.dismissCat()
      }
    }
    let maxSpeed = 0
    for (const o of this.objects) {
      if (!o.alive || o.isStatic || o.prefab === 'shard' || o.body.isSleeping) continue
      maxSpeed = Math.max(maxSpeed, o.body.speed)
    }
    if (cat && cat.state !== 'gone') {
      const v = catVelocity(cat)
      maxSpeed = Math.max(maxSpeed, Math.hypot(v.x, v.y) * (cat.grip ? 0 : 1))
      if (cat.grip) this.calm = 0
    }
    if (this.dog?.state === 'frenzy') maxSpeed = Math.max(maxSpeed, 1)
    if (this.shotTime > 0.8 && maxSpeed < SETTLE_SPEED) this.calm += SUBSTEP
    else this.calm = 0
    if (this.calm >= SETTLE_TIME || this.shotTime >= SHOT_CAP) this.endShot()
  }

  private dismissCat() {
    const cat = this.cat
    if (!cat || cat.state === 'gone') return
    const c = catCenter(cat)
    this.events.push({ kind: 'catLeave', x: c.x, y: c.y, breed: cat.breed.id })
    removeCat(this.engine.world, cat)
  }

  private endShot() {
    this.dismissCat()
    this.cat = null
    this.script = []
    if (this.preciousLeft === 0) {
      this.bonus = this.catsLeft * UNUSED_CAT_BONUS
      this.phase = 'won'
      this.events.push({ kind: 'won' })
    } else if (this.catsLeft <= 0) {
      this.phase = 'lost'
      this.events.push({ kind: 'lost' })
    } else {
      this.phase = 'aim'
    }
  }

  // -------------------------------------------------------------------------
  // Collisions & damage
  // -------------------------------------------------------------------------

  private catOf(body: Matter.Body): Cat | null {
    if (body.label !== 'cat' || !this.cat) return null
    return this.cat
  }

  private massOf(body: Matter.Body): number {
    const cat = this.catOf(body)
    if (cat) return catMass(cat) * (cat.slam > 0 ? 5 : 1)
    return body.isStatic ? Infinity : body.mass
  }

  private onCollisionStart(pairs: Matter.Pair[]) {
    for (const pair of pairs) {
      const A = pair.bodyA.parent
      const B = pair.bodyB.parent
      if (pair.isSensor) {
        this.onSensor(A, B)
        continue
      }
      if (!this.damageOn) continue
      const vA = Matter.Body.getVelocity(A)
      const vB = Matter.Body.getVelocity(B)
      const n = pair.collision.normal
      const speed = Math.abs((vA.x - vB.x) * n.x + (vA.y - vB.y) * n.y)
      const mA = this.massOf(A)
      const mB = this.massOf(B)
      const mEff = !Number.isFinite(mA) ? mB : !Number.isFinite(mB) ? mA : (mA * mB) / (mA + mB)
      if (!Number.isFinite(mEff)) continue
      const impact = speed * mEff
      const oA = this.byBody.get(A.id) ?? this.byBody.get(pair.bodyA.id)
      const oB = this.byBody.get(B.id) ?? this.byBody.get(pair.bodyB.id)
      const catA = this.catOf(A)
      const catB = this.catOf(B)
      if (oA) this.pending.push({ obj: oA, impact, byCat: catB })
      if (oB) this.pending.push({ obj: oB, impact, byCat: catA })

      const cat = catA ?? catB
      if (cat) {
        const other = catA ? oB : oA
        if (cat.breed.chaosBounce && (other?.material.hard ?? true) && speed > 3 && this.time - cat.lastBounce > 0.2) {
          cat.lastBounce = this.time
          this.pendingBounce = true
        }
        if (cat.slam > 0 && speed > 4) cat.slam = Math.min(cat.slam, 0.25)
        if (other?.prefab === 'dog') this.wakeDog()
      }
      // Impact sounds, throttled per object.
      for (const o of [oA, oB]) {
        if (!o || o.isStatic || impact < 6 || this.time - o.lastSound < 0.12) continue
        o.lastSound = this.time
        this.events.push({ kind: 'impact', x: o.body.position.x, y: o.body.position.y, sound: o.material.sound, strength: Math.min(1, impact / 120) })
      }
      if (cat && speed > 6 && this.time - cat.lastBounce > 0.05) {
        const c = catCenter(cat)
        this.events.push({ kind: 'impact', x: c.x, y: c.y, sound: 'fabric', strength: Math.min(1, speed / 25) })
      }
    }
  }

  private onCollisionActive(pairs: Matter.Pair[]) {
    for (const pair of pairs) {
      if (!pair.isSensor) continue
      this.onSensor(pair.bodyA.parent, pair.bodyB.parent)
    }
  }

  private onSensor(A: Matter.Body, B: Matter.Body) {
    const catBody = A.label === 'cat' ? A : B.label === 'cat' ? B : null
    if (!catBody || !this.cat || this.cat.state === 'gone') return
    const sensorBody = catBody === A ? B : A
    const o = this.byBody.get(sensorBody.id)
    if (!o?.sensor) return
    if (o.sensor === 'grip') {
      this.gripContact = { particle: catBody, t: this.time }
    } else if (o.sensor === 'fan' && !this.fanUsed) {
      this.fanUsed = true
      const c = catCenter(this.cat)
      const fx = o.body.position.x
      const fy = o.body.position.y
      const dx = c.x - fx
      const dy = c.y - fy
      const d = Math.hypot(dx, dy) || 1
      // Blades spin clockwise on screen: tangent = (−dy, dx).
      setCatVelocity(this.cat, { x: (-dy / d) * 20, y: (dx / d) * 20 - 3 })
      this.cat.spin = 1
      this.events.push({ kind: 'fan', x: c.x, y: c.y })
    } else if (o.sensor === 'face' && !this.faceHit) {
      this.faceHit = true
      this.chaos = Math.max(0, this.chaos - 1500)
      this.events.push({ kind: 'stir', x: o.body.position.x, y: o.body.position.y })
      this.events.push({ kind: 'popup', x: o.body.position.x, y: o.body.position.y - 40, text: 'The human stirs… −1500', big: false })
    }
  }

  private applyDamage() {
    const list = this.pending
    this.pending = []
    for (const d of list) {
      const o = d.obj
      if (!o.alive || !Number.isFinite(o.hp) || o.husk || o.sensor) continue
      const mat = o.material
      let mult = 1
      const coon = d.byCat?.breed.woodCrusher
      if (mat.coonOnly && !(coon && (d.byCat!.slam > 0 || d.impact > 400))) continue
      if (mat.id === 'wood' && coon) mult = 4
      const dmg = Math.max(0, d.impact - mat.toughness) * mult
      if (dmg <= 0) continue
      o.hp -= dmg
      if (o.hp <= 0) this.breakObject(o)
    }
  }

  breakObject(o: WorldObject) {
    if (!o.alive || o.broken) return
    const mat = o.material
    const pos = { x: o.body.position.x, y: o.body.position.y }
    const vel = Matter.Body.getVelocity(o.body)
    o.broken = true
    switch (mat.breaks) {
      case 'shards':
      case 'chunks':
      case 'planks': {
        this.removeObject(o)
        const shards = this.objects.filter((q) => q.alive && q.prefab === 'shard').length
        if (shards < MAX_SHARDS) {
          for (const spec of sliceShards(o.w, o.h, mat.breaks, this.rng)) {
            const body = buildShard(spec, o.body, mat.id)
            Matter.Body.setVelocity(body, { x: vel.x + this.rng.range(-3, 3), y: vel.y + this.rng.range(-4, 0.5) })
            Matter.Body.setAngularVelocity(body, this.rng.range(-0.3, 0.3))
            const sh = this.register({ prefab: 'shard', body, material: mat, w: 0, h: 0, hp: Infinity, precious: false, isStatic: false })
            sh.life = SHARD_LIFE
          }
        }
        break
      }
      case 'crumple': {
        this.removeObject(o)
        const w = o.w * 0.8
        const h = Math.max(8, o.h * 0.45)
        const body = Matter.Bodies.rectangle(pos.x, pos.y + o.h / 2 - h / 2, w, h, {
          density: mat.density,
          friction: 0.9,
          angle: o.body.angle,
          collisionFilter: { category: CAT_WORLD, mask: CAT_WORLD | CAT_CATBODY | CAT_SHARD },
        })
        Matter.Body.setVelocity(body, vel)
        this.register({ prefab: 'crumple', body, material: mat, w, h, hp: Infinity, precious: false, isStatic: false })
        break
      }
      case 'husk':
        o.husk = true
        o.hp = Infinity
        break
      case 'hole':
        this.removeObject(o)
        break
      case 'none':
        return
    }
    this.scoreBreak(o, pos)
  }

  private removeObject(o: WorldObject) {
    o.alive = false
    Matter.Composite.remove(this.engine.world, o.body)
  }

  private scoreBreak(o: WorldObject, pos: { x: number; y: number }) {
    const mat = o.material
    if (this.time - this.lastBreakT < 0.5) this.chain++
    else this.chain = 0
    this.lastBreakT = this.time
    const mult = Math.min(3, Math.pow(1.5, this.chain))
    const pts = mat.noise * mult * (o.precious ? 2 : 1)
    this.chaos += pts
    if (this.time - this.burstT > 0.6) this.burst = 0
    this.burst += pts
    this.burstT = this.time
    if (this.burst > 2000 && this.slowmo <= 0) {
      this.slowmo = 0.5
      this.burst = -1e9 // once per burst
    }
    const word: Record<string, string> = {
      glass: 'SHATTER!',
      ceramic: 'CRASH!',
      wood: 'CRACK!',
      electronics: 'FZZT!',
      paper: 'SQUISH',
      metal: 'CLANG!',
    }
    const text = mat.id === 'floorboard' ? 'CRUNCH!' : (word[mat.sound] ?? 'BONK!')
    this.events.push({ kind: 'break', x: pos.x, y: pos.y, material: mat, precious: o.precious })
    this.events.push({ kind: 'popup', x: pos.x, y: pos.y - 20, text: mult > 1 ? `${text} ×${mult.toFixed(1).replace('.0', '')}` : text, big: o.precious || mult >= 2 })
    this.events.push({ kind: 'shake', amount: Math.min(12, 3 + pts / 250) })
    if (this.dog && mat.sound === 'glass') {
      const dp = this.dog.obj.body.position
      if (Math.hypot(dp.x - pos.x, dp.y - pos.y) < 200) this.wakeDog()
    }
  }

  private checkTopples() {
    if (!this.damageOn) return
    for (const o of this.objects) {
      if (!o.alive || o.isStatic || o.toppled || o.prefab === 'shard' || o.prefab === 'dog' || o.prefab === 'crumple') continue
      const turned = Math.abs(o.body.angle - o.spawn.angle) > 1.05
      const dropped = o.body.position.y - o.spawn.y > Math.max(20, o.h * 0.8)
      if (!turned && !dropped) continue
      o.toppled = true
      const unbreakable = !Number.isFinite(o.material.hp)
      const pts = unbreakable ? o.material.noise : 50
      this.chaos += pts
      if (unbreakable && pts >= 100) {
        this.events.push({ kind: 'popup', x: o.body.position.x, y: o.body.position.y - 20, text: o.material.id === 'metal' ? 'CLANG!' : 'THUMP', big: false })
      }
    }
  }

  private processWakes() {
    // Matter never checks sleeping-vs-sleeping contacts, so when one body
    // wakes we wake whatever it's touching -- otherwise the top of a
    // tower floats in mid-air after the bottom is knocked out.
    let guard = 0
    while (this.wakeQueue.length && guard++ < 400) {
      const b = this.wakeQueue.shift()!
      const bx = b.bounds
      for (const o of this.objects) {
        const ob = o.body
        if (!o.alive || o.isStatic || !ob.isSleeping) continue
        const q = ob.bounds
        if (q.min.x > bx.max.x + 4 || q.max.x < bx.min.x - 4 || q.min.y > bx.max.y + 4 || q.max.y < bx.min.y - 4) continue
        Matter.Sleeping.set(ob, false) // fires sleepEnd -> queued
      }
    }
  }

  private stepShards() {
    for (const o of this.objects) {
      if (!o.alive || o.prefab !== 'shard') continue
      o.life -= SUBSTEP
      if (o.life <= 0) this.removeObject(o)
    }
  }

  // -------------------------------------------------------------------------
  // The dog
  // -------------------------------------------------------------------------

  private wakeDog() {
    const dog = this.dog
    if (!dog || dog.state === 'frenzy') return
    dog.state = 'frenzy'
    dog.t = 4
    dog.dir = dog.obj.body.position.x < this.level.width / 2 ? 1 : -1
    dog.barkT = 0
  }

  private stepDog() {
    const dog = this.dog
    if (!dog || dog.state !== 'frenzy') return
    dog.t -= SUBSTEP
    dog.barkT -= SUBSTEP
    const b = dog.obj.body
    if (dog.barkT <= 0) {
      dog.barkT = 0.9
      this.events.push({ kind: 'bark', x: b.position.x, y: b.position.y })
    }
    if (b.position.x > this.level.width - 90) dog.dir = -1
    if (b.position.x < 90) dog.dir = 1
    const v = Matter.Body.getVelocity(b)
    Matter.Body.setVelocity(b, { x: v.x + (dog.dir * 11 - v.x) * 0.08, y: v.y })
    if (dog.t <= 0) dog.state = 'sleep'
  }

  // Test hook: arm the damage model without launching (QA drop tests).
  armDamage() {
    this.damageOn = true
  }

  drainEvents(): GameEvent[] {
    const e = this.events
    this.events = []
    return e
  }
}

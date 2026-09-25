// The flight simulation (SPEC.md sections 5-7). No DOM, no React: the
// Flight screen owns one of these, calls `advance()` each animation frame,
// sets `controls`, and reads state back out for rendering.
//
// Frames and units:
//   * Global: planet-centred metres, y up (orbit.ts).
//   * Local: the Matter world, Matter units (PPM per metre), y down, axes
//     parallel to global (x same, y flipped). It rides a free-falling frame
//     `frame` -- gravity is applied to the frame only, never to bodies.
//   * Matter forces: N · N_TO_MATTER. Matter velocities are per-step
//     displacements, so all velocity reads/writes go through the helpers in
//     structure.ts.
//
// Each fixed step: wiring -> per-part forces -> Matter step -> weld loads
// and breakups -> rebase the main craft's COM into the frame -> gravity on
// the frame -> ground contact, heat, fuel, failures, stats.
import Matter from 'matter-js'
import { G0, fuelFlow, type PartDef } from './parts'
import { components, type Blueprint, type Vec } from './workshop'
import { WiringRuntime, settingsFor, type ButtonId, type InputPort, type SourceRef } from './wiring'
import {
  buildRig,
  updateWeldLoads,
  rigidMotion,
  breakWeld,
  breakAllWeldsOf,
  removePartBody,
  aliveEdges,
  bodyVelocity,
  setBodyVelocity,
  bodyAngularVelocity,
  internals,
  PPM,
  STEP,
  STEP_MS,
  N_TO_MATTER,
  NM_TO_MATTER,
  type Rig,
  type RigPart,
  type PartLoad,
} from './structure'
import { ATMOSPHERE_TOP, density, speedOfSound, windAt, heatFlux } from './atmosphere'
import {
  PLANET_RADIUS,
  altitude as altitudeOf,
  elements,
  isStableOrbit,
  propagate,
  radialUp,
  stepGravity,
  type FrameState,
  type OrbitElements,
} from './orbit'
import { rollFailure, BYPASS_TIME, FAILURE_LABEL, type FailureKind } from './failures'
import { makeRng, type Rng } from './rng'

export type FlightStatus = 'pad' | 'flying' | 'ended'
export type SasMode = 'off' | 'hold' | 'prograde' | 'retrograde'

export const WARP_LEVELS = [1, 2, 4, 10, 50, 200, 1000]
export const PHYSICS_WARP_MAX = 10 // above this, Matter freezes (coast warp)

export type Cue =
  | 'ignite'
  | 'bolt'
  | 'snap'
  | 'chute'
  | 'shred'
  | 'explode'
  | 'failure'
  | 'orbit'
  | 'crash'
  | 'land'
  | 'ding'
  | 'burnup'
  | 'denied'

export interface FlightPart {
  uid: number
  def: PartDef
  rp: RigPart
  alive: boolean
  main: boolean // still attached to the command seat's group
  fuel: number // tank fuel or internal propellant, kg
  ignited: boolean
  starved: boolean
  variance: number // thrust multiplier rolled at launch
  heat: number // engine heat, 1 = boom
  failure: FailureKind | null
  stuckAt: number
  bypass: number // seconds of bypass spool left
  skew: number // uneven-burn thrust angle, radians
  throttleOut: number // effective throttle this step (for render / audio)
  chute: 'packed' | 'open' | 'shredded'
  chuteOpen: number // 0..1 deployment ramp
  venting: boolean
  scorch: number // re-entry heat soak, 1 = burned up
  lost?: boolean // debris resolved as lost
  recovered?: boolean // debris resolved as recovered
}

export interface Blast {
  x: number // local metres
  y: number
  age: number
  size: number
}

export interface FlightLog {
  t: number
  text: string
  tone: 'info' | 'warn' | 'bad' | 'good'
}

export interface FlightStats {
  maxAltitude: number
  maxSpeed: number
  maxMach: number
  maxQ: number
  sonicLow: boolean // Mach 1 below 10 km
  reachedSpace: boolean
  orbitAchieved: boolean
  satDelivered: boolean
}

export interface FlightOutcome {
  kind: 'landed' | 'crashed' | 'splashdown' | 'abandoned' | 'orbit' | 'scrubbed'
  impactSpeed: number
  commandSurvived: boolean
  recovered: number[] // uids
  lost: number[] // uids
  stats: FlightStats
  flightTime: number
}

export interface Warnings {
  maxQ: boolean
  overheat: boolean
  stuck: boolean
  spin: boolean
  stress: boolean
  fuel: boolean
  orbit: boolean
}

const LIFTOFF_ALT = 0.5
const SHIELD = 0.05
const CHUTE_SHRED_Q = 3500 // Pa
const CHUTE_MAX_FORCE = 24000 // N -- the bedsheet stretches rather than rips the weld
const DEBRIS_CULL = 600 // m from the main craft
const FIN_CL = 3.5 // per radian of slip
const FIN_DEFLECT = 0.35 // radians of full steer
// Part faces are 1 m grid cells, but the junk on them is narrower and
// rounder than a flat square metre; without this even the starter rig is
// terminal-velocity-limited at 35 m/s. Fins and chutes aren't scaled.
const AERO_SCALE = 0.35

export class FlightSim {
  readonly bp: Blueprint
  readonly rig: Rig
  readonly parts = new Map<number, FlightPart>()
  readonly wiring: WiringRuntime
  readonly rng: Rng
  readonly seed: number
  frame: FrameState
  t = 0
  status: FlightStatus = 'pad'
  warp = 1
  controls = { throttle: 1, steer: 0 }
  sas: SasMode = 'off'
  private sasTarget = 0
  mainSet = new Set<number>()
  stats: FlightStats = {
    maxAltitude: 0,
    maxSpeed: 0,
    maxMach: 0,
    maxQ: 0,
    sonicLow: false,
    reachedSpace: false,
    orbitAchieved: false,
    satDelivered: false,
  }
  log: FlightLog[] = []
  cues: Cue[] = []
  blasts: Blast[] = []
  outcome: FlightOutcome | null = null
  // Per-step readouts for the HUD.
  q = 0
  mach = 0
  omega = 0
  thrustNow = 0
  maxStressRatio = 0
  orbit: OrbitElements
  private liftedOff = false
  private prevAltitude = 0
  private feedGroup = new Map<number, number>()
  private lowestOffset = 0 // metres from COM to lowest point, along -up

  constructor(bp: Blueprint, seed: number) {
    this.bp = bp
    this.seed = seed
    this.rng = makeRng(seed)
    this.rig = buildRig(bp)
    this.wiring = new WiringRuntime(bp)
    for (const rp of this.rig.parts.values()) {
      const def = rp.def
      const e = def.engine
      this.parts.set(rp.uid, {
        uid: rp.uid,
        def,
        rp,
        alive: true,
        main: false,
        fuel: def.tank?.fuel ?? e?.internalFuel ?? 0,
        ignited: false,
        starved: false,
        variance: e ? 1 + this.rng.range(-e.thrustVariance, e.thrustVariance) : 1,
        heat: 0,
        failure: null,
        stuckAt: 1,
        bypass: 0,
        skew: 0,
        throttleOut: 0,
        chute: 'packed',
        chuteOpen: 0,
        venting: false,
        scorch: 0,
      })
    }
    this.refreshTopology(true)
    this.rebase()
    this.lowestOffset = this.computeLowestOffset()
    this.frame = { p: { x: 0, y: PLANET_RADIUS + this.lowestOffset }, v: { x: 0, y: 0 } }
    this.orbit = elements(this.frame)
    this.prevAltitude = this.altitude
    this.say('On the pad. Wind is light. Neighbors are watching.', 'info')
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  get ended(): boolean {
    return this.status === 'ended'
  }

  get altitude(): number {
    return altitudeOf(this.frame.p)
  }

  get speed(): number {
    return Math.hypot(this.frame.v.x, this.frame.v.y)
  }

  get verticalSpeed(): number {
    const up = radialUp(this.frame.p)
    return this.frame.v.x * up.x + this.frame.v.y * up.y
  }

  get commandPart(): FlightPart | undefined {
    return this.rig.commandUid !== null ? this.parts.get(this.rig.commandUid) : undefined
  }

  // Craft attitude: the command seat's body angle (0 = blueprint-up is
  // local -y). Falls back to the heaviest main part if the seat is gone.
  get craftAngle(): number {
    const c = this.commandPart
    if (c && c.alive && c.main) return c.rp.body.angle
    let best: FlightPart | undefined
    for (const uid of this.mainSet) {
      const p = this.parts.get(uid)!
      if (!best || p.rp.body.mass > best.rp.body.mass) best = p
    }
    return best ? best.rp.body.angle : 0
  }

  // Direction of local "up" (away from the planet) expressed in the local
  // frame, which is what the renderer rotates the camera by.
  get localUp(): Vec {
    const up = radialUp(this.frame.p)
    return { x: up.x, y: -up.y }
  }

  get hasGuidance(): boolean {
    for (const uid of this.mainSet) if (this.parts.get(uid)!.def.guidance) return true
    return false
  }

  get anyThrust(): boolean {
    return this.thrustNow > 1
  }

  get canCoastWarp(): boolean {
    return this.status === 'flying' && this.altitude > ATMOSPHERE_TOP && !this.anyThrust
  }

  get warnings(): Warnings {
    let overheat = false
    let stuck = false
    let fuel = false
    for (const p of this.parts.values()) {
      if (!p.alive || !p.main || !p.def.engine) continue
      if (p.heat > 0.75) overheat = true
      if (p.failure === 'stuck') stuck = true
      if (p.ignited && p.starved) fuel = true
    }
    return {
      maxQ: this.q > 14000,
      overheat,
      stuck,
      spin: Math.abs(this.omega) > 1.6,
      stress: this.maxStressRatio > 0.75,
      fuel,
      orbit: isStableOrbit(this.orbit, ATMOSPHERE_TOP),
    }
  }

  // Fuel remaining across the main craft, as a fraction of launch fuel.
  get fuelFraction(): number {
    let now = 0
    let full = 0
    for (const p of this.parts.values()) {
      const cap = p.def.tank?.fuel ?? p.def.engine?.internalFuel ?? 0
      if (!cap) continue
      full += cap
      if (p.alive && p.main) now += p.fuel
    }
    return full > 0 ? now / full : 0
  }

  mainParts(): FlightPart[] {
    return [...this.mainSet].map((u) => this.parts.get(u)!)
  }

  // -------------------------------------------------------------------------
  // Player input
  // -------------------------------------------------------------------------

  pressButton(id: ButtonId) {
    if (this.status === 'ended') return
    const acted = this.fireSource({ kind: 'button', id })
    if (!acted && !this.wiring.hasWiresFrom({ kind: 'button', id })) {
      this.say(`${id === 'IGNITE' ? 'IGNITE' : id.replace('STAGE', 'STAGE ')} isn't wired to anything.`, 'warn')
      this.cues.push('denied')
    }
    this.warp = 1
  }

  bypass(uid: number) {
    const p = this.parts.get(uid)
    if (!p || !p.alive || !p.def.engine || p.bypass > 0) return
    p.bypass = BYPASS_TIME
    this.say(`Bypassing ${p.def.name}…`, 'info')
  }

  cutEngine(uid: number) {
    const p = this.parts.get(uid)
    if (!p || !p.alive || !p.def.engine) return
    if (!p.def.engine.canShutdown) {
      this.say(`${p.def.name} can't be shut down. It will burn until it's done.`, 'warn')
      this.cues.push('denied')
      return
    }
    if (p.ignited) {
      p.ignited = false
      this.say(`${p.def.name} shut down.`, 'info')
    } else if (p.fuel > 0 || !p.def.engine.internalFuel) {
      this.act(uid, 'ignite')
    }
  }

  toggleVent(uid: number) {
    const p = this.parts.get(uid)
    if (!p || !p.alive || !p.def.tank) return
    p.venting = !p.venting
    this.say(p.venting ? `Venting ${p.def.name}.` : `Vent closed.`, 'info')
  }

  setSas(mode: SasMode) {
    if (mode !== 'off' && !this.hasGuidance) return
    this.sas = mode
    this.sasTarget = this.craftAngle
  }

  setWarp(level: number) {
    if (level > PHYSICS_WARP_MAX && !this.canCoastWarp) {
      this.warp = Math.min(level, PHYSICS_WARP_MAX)
      return
    }
    this.warp = level
  }

  endFlight() {
    if (this.status === 'ended') return
    this.finish(null)
  }

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------

  advance(frameDt: number) {
    if (this.status === 'ended') return
    const dt = Math.min(frameDt, 1 / 20)
    if (this.warp > PHYSICS_WARP_MAX) {
      if (!this.canCoastWarp) {
        this.warp = PHYSICS_WARP_MAX
      } else {
        this.coast(dt * this.warp)
        return
      }
    }
    const steps = Math.max(1, Math.round((dt * this.warp) / STEP))
    for (let i = 0; i < steps && !this.ended; i++) this.step()
    this.blasts = this.blasts.filter((b) => (b.age += dt) < 0.9)
  }

  // Coast warp: Matter frozen, frame on rails. Timers and barometers keep
  // running so a wired sequence still fires mid-warp.
  private coast(dt: number) {
    this.cullAllDebris()
    const chunks = Math.max(1, Math.ceil(dt / 2))
    const h = dt / chunks
    for (let i = 0; i < chunks; i++) {
      propagate(this.frame, h, 0.5)
      this.t += h
      this.runWiringClock()
      this.checkBarometers()
      if (this.altitude < ATMOSPHERE_TOP) {
        this.warp = PHYSICS_WARP_MAX
        this.say('Entering atmosphere — warp dropped.', 'warn')
        break
      }
    }
    this.orbit = elements(this.frame)
    this.trackStats()
    this.prevAltitude = this.altitude
  }

  private step() {
    this.t += STEP
    this.runWiringClock()
    this.checkBarometers()

    const loads = this.computeForces()
    Matter.Engine.update(this.rig.engine, STEP_MS)

    if (this.mainSet.size > 0) {
      const motion = rigidMotion(this.rig, this.mainSet, loads, this.omega)
      const broken = updateWeldLoads(this.rig, this.mainSet, loads, motion, STEP, this.liftedOff ? 1 : 0.5)
      this.maxStressRatio = 0
      for (const w of this.rig.welds) {
        if (w.alive && this.mainSet.has(w.a)) this.maxStressRatio = Math.max(this.maxStressRatio, w.load / w.rating)
      }
      if (broken.length > 0) {
        for (const w of broken) breakWeld(this.rig, w)
        const a = this.parts.get(broken[0].a)!.def.name
        const b = this.parts.get(broken[0].b)!.def.name
        this.say(`CRACK — the weld between ${a} and ${b} let go!`, 'bad')
        this.cues.push('snap')
        this.refreshTopology()
      }
    }

    this.rebase()
    stepGravity(this.frame, STEP)
    this.groundContact()
    if (this.status === 'ended') return
    this.updateThermal()
    this.cullFarDebris()
    this.orbit = elements(this.frame)
    this.trackStats()
    this.prevAltitude = this.altitude
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------

  private fireSource(src: SourceRef): boolean {
    const actions = this.wiring.fire(src, this.t)
    for (const a of actions) this.act(a.uid, a.port)
    return actions.length > 0
  }

  private runWiringClock() {
    for (const uid of this.wiring.dueTimers(this.t)) {
      const p = this.parts.get(uid)
      if (!p || !p.alive) continue
      this.cues.push('ding')
      this.fireSource({ kind: 'part', uid, port: 'ding' })
    }
  }

  private checkBarometers() {
    const alt = this.altitude
    for (const p of this.parts.values()) {
      if (!p.alive || !p.def.barometer) continue
      const s = settingsFor(this.bp, p.uid)
      const crossedUp = this.prevAltitude < s.altitude! && alt >= s.altitude!
      const crossedDown = this.prevAltitude > s.altitude! && alt <= s.altitude!
      if ((s.direction === 'up' && crossedUp) || (s.direction === 'down' && crossedDown)) {
        this.fireSource({ kind: 'part', uid: p.uid, port: 'trip' })
      }
    }
  }

  private act(uid: number, port: InputPort) {
    const p = this.parts.get(uid)
    if (!p || !p.alive) return
    switch (port) {
      case 'ignite': {
        if (!p.def.engine || p.ignited) return
        if (p.def.engine.internalFuel && p.fuel <= 0) return
        p.ignited = true
        p.starved = false
        this.cues.push('ignite')
        this.say(`${p.def.name} lit!`, 'info')
        if (this.status === 'pad') this.status = 'flying'
        return
      }
      case 'shutdown': {
        if (!p.def.engine?.canShutdown || !p.ignited) return
        p.ignited = false
        this.say(`${p.def.name} shut down.`, 'info')
        return
      }
      case 'blow': {
        breakAllWeldsOf(this.rig, uid)
        this.cues.push('bolt')
        this.addBlast(p, 0.6)
        this.say('BANG — explosive bolts fired.', 'info')
        this.refreshTopology()
        return
      }
      case 'deploy': {
        if (p.chute !== 'packed') return
        p.chute = 'open'
        this.cues.push('chute')
        this.say(this.status === 'pad' ? 'The parachute flops out onto the launch pad.' : 'Chute out!', this.status === 'pad' ? 'warn' : 'info')
        return
      }
      case 'vent': {
        p.venting = true
        this.say(`${p.def.name} venting.`, 'info')
        return
      }
      case 'start':
        return // timers are handled inside the wiring runtime
    }
  }

  // -------------------------------------------------------------------------
  // Forces
  // -------------------------------------------------------------------------

  private computeForces(): Map<number, PartLoad> {
    const loads = new Map<number, PartLoad>()
    const alt = this.altitude
    const rho = density(alt)
    const up = radialUp(this.frame.p)
    const east = { x: up.y, y: -up.x }
    const wind = windAt(alt, this.t, this.seed % 97)
    // Air velocity relative to the craft frame, in local coords.
    const airLocal = { x: east.x * wind - this.frame.v.x, y: -(east.y * wind - this.frame.v.y) }

    const angle = this.craftAngle
    const omega = this.omega
    const steer = this.effectiveSteer(angle, omega)
    const qFrame = 0.5 * rho * (airLocal.x * airLocal.x + airLocal.y * airLocal.y)

    // Main COM (metres) for steering sign decisions.
    const com = this.mainCom()
    let thrustTotal = 0

    for (const p of this.parts.values()) {
      if (!p.alive) continue
      const b = p.rp.body
      const load: PartLoad = { fx: 0, fy: 0, torque: 0 }
      const cos = Math.cos(b.angle)
      const sin = Math.sin(b.angle)
      const toWorld = (v: Vec): Vec => ({ x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos })
      const toBody = (v: Vec): Vec => ({ x: v.x * cos + v.y * sin, y: -v.x * sin + v.y * cos })
      const rx = b.position.x / PPM - com.x
      const ry = b.position.y / PPM - com.y

      // --- Engines ---
      p.throttleOut = 0
      const e = p.def.engine
      if (e && p.ignited) {
        let throttle = e.throttleable ? this.controls.throttle : 1
        if (p.failure === 'stuck') throttle = p.stuckAt
        if (p.bypass > 0) throttle *= 0.5
        const flow = fuelFlow(e) * throttle * STEP
        const got = this.drawFuel(p, flow)
        if (got < flow * 0.5 && flow > 0) {
          if (!p.starved) {
            p.starved = true
            if (e.internalFuel) {
              p.ignited = false
              this.say(`${p.def.name} burned out.`, 'info')
              this.fireSource({ kind: 'part', uid: p.uid, port: 'empty' })
            } else {
              this.say(`${p.def.name} is sputtering — no fuel on its stage.`, 'warn')
            }
          }
        } else {
          p.starved = false
        }
        if (!p.starved && flow > 0) {
          p.throttleOut = throttle
          const mag = e.thrust * p.variance * throttle
          let dir = toWorld(p.rp.localUp)
          let gimbal = p.skew
          if (e.gimbal && steer !== 0) {
            // Pick the gimbal direction whose torque matches the steer sign.
            const perp = { x: -dir.y, y: dir.x }
            const tq = rx * perp.y - ry * perp.x
            gimbal += e.gimbal * Math.abs(steer) * Math.sign(steer) * (tq >= 0 ? 1 : -1)
          }
          if (gimbal !== 0) {
            const c = Math.cos(gimbal)
            const s = Math.sin(gimbal)
            dir = { x: dir.x * c - dir.y * s, y: dir.x * s + dir.y * c }
          }
          load.fx += dir.x * mag
          load.fy += dir.y * mag
          thrustTotal += p.main ? mag : 0
          this.engineWear(p, throttle)
        }
      } else if (e) {
        p.heat = Math.max(0, p.heat - 0.05 * STEP)
      }

      // --- Venting tanks ---
      if (p.venting && p.fuel > 0) {
        p.fuel = Math.max(0, p.fuel - 25 * STEP)
        Matter.Body.setMass(b, p.def.mass + p.fuel)
        if (p.fuel === 0) {
          p.venting = false
          this.fireSource({ kind: 'part', uid: p.uid, port: 'empty' })
        }
      }

      // --- Aerodynamics ---
      if (rho > 0) {
        const pv = bodyVelocity(b, STEP)
        const relWorld = { x: pv.x - airLocal.x, y: pv.y - airLocal.y } // part velocity through the air
        const rel = toBody(relWorld)
        const speed = Math.hypot(rel.x, rel.y)
        if (speed > 0.01) {
          const faceY = rel.y < 0 ? 0 : 2
          const faceX = rel.x > 0 ? 1 : 3
          const shieldY = p.rp.neighbors[faceY].length > 0 ? SHIELD : 1
          const shieldX = p.rp.neighbors[faceX].length > 0 ? SHIELD : 1
          let cdAxial = p.def.cd
          if (p.def.id === 'noseCone') {
            const tipFace = (0 + p.rp.rot) % 4
            cdAxial = faceY === tipFace || faceX === tipFace ? 0.2 : 1.0
          }
          const cdLat = Math.max(p.def.cd, 0.8)
          const k = 0.5 * rho * speed * AERO_SCALE
          let fbx = -k * rel.x * cdLat * p.rp.h * shieldX
          let fby = -k * rel.y * cdAxial * p.rp.w * shieldY
          // Fins: weathervane lift against sideslip, plus steering deflection.
          if (p.def.fin && p.main) {
            const qLocal = 0.5 * rho * speed * speed
            const slip = Math.atan2(rel.x, Math.abs(rel.y) + 1e-6)
            const lift = -qLocal * p.def.fin.area * FIN_CL * Math.max(-0.6, Math.min(0.6, slip))
            fbx += lift
            if (steer !== 0) {
              const side = toWorld({ x: 1, y: 0 })
              const tq = rx * side.y - ry * side.x
              const sign = Math.sign(steer) * (tq >= 0 ? 1 : -1)
              fbx += sign * qLocal * p.def.fin.area * FIN_CL * FIN_DEFLECT * Math.abs(steer) * 0.5
            }
          }
          // Parachute: ramped open, force capped by bedsheet stretch.
          if (p.chute === 'open') {
            p.chuteOpen = Math.min(1, p.chuteOpen + STEP / 1.5)
            const qLocal = 0.5 * rho * speed * speed
            if (qLocal > CHUTE_SHRED_Q && p.chuteOpen > 0.2) {
              p.chute = 'shredded'
              this.cues.push('shred')
              this.say('The bedsheet shredded — deployed way too fast!', 'bad')
            } else {
              const f = Math.min(CHUTE_MAX_FORCE, qLocal * p.def.chute!.area * 1.3 * p.chuteOpen * p.chuteOpen)
              const w = toWorld({ x: fbx, y: fby })
              load.fx += w.x - (relWorld.x / speed) * f
              load.fy += w.y - (relWorld.y / speed) * f
              fbx = 0
              fby = 0
            }
          }
          const fw = toWorld({ x: fbx, y: fby })
          load.fx += fw.x
          load.fy += fw.y
        }
      }

      // --- Gyroscope ---
      if (p.def.gyro && p.main && steer !== 0) {
        load.torque += p.def.gyro.torque * steer
      }

      // Aerodynamic rotational damping keeps a long stack from tumbling on
      // solver noise alone; scales with q so it vanishes in vacuum.
      if (p.main && qFrame > 0) {
        load.torque += -omega * Math.min(4000, qFrame * 0.08) * (p.rp.w * p.rp.h)
      }

      if (load.fx !== 0 || load.fy !== 0) {
        Matter.Body.applyForce(b, b.position, { x: load.fx * N_TO_MATTER, y: load.fy * N_TO_MATTER })
      }
      if (load.torque !== 0) b.torque += load.torque * NM_TO_MATTER
      loads.set(p.uid, load)
    }
    this.thrustNow = thrustTotal
    this.q = qFrame
    this.mach = Math.sqrt((airLocal.x * airLocal.x + airLocal.y * airLocal.y)) / speedOfSound(alt)
    return loads
  }

  private effectiveSteer(angle: number, omega: number): number {
    const manual = this.controls.steer
    if (manual !== 0 || this.sas === 'off' || !this.hasGuidance) return manual
    let target = this.sasTarget
    if (this.sas === 'prograde' || this.sas === 'retrograde') {
      const v = this.frame.v
      if (Math.hypot(v.x, v.y) < 5) return 0
      const lx = this.sas === 'prograde' ? v.x : -v.x
      const ly = this.sas === 'prograde' ? -v.y : v.y
      target = Math.atan2(lx, -ly)
    }
    let err = target - angle
    err = Math.atan2(Math.sin(err), Math.cos(err))
    return Math.max(-1, Math.min(1, 3 * err - 1.5 * omega))
  }

  // Draw fuel for an engine from its internal load or its stage's tanks.
  private drawFuel(p: FlightPart, want: number): number {
    if (want <= 0) return 0
    const e = p.def.engine!
    if (e.internalFuel) {
      const got = Math.min(p.fuel, want)
      p.fuel -= got
      Matter.Body.setMass(p.rp.body, p.def.mass + p.fuel)
      return got
    }
    const group = this.feedGroup.get(p.uid)
    const tanks: FlightPart[] = []
    for (const q of this.parts.values()) {
      if (q.alive && q.def.tank && q.fuel > 0 && this.feedGroup.get(q.uid) === group) tanks.push(q)
    }
    if (tanks.length === 0) return 0
    const leak = p.failure === 'leak' ? 3 : 1
    let got = 0
    const each = (want * leak) / tanks.length
    for (const tank of tanks) {
      const take = Math.min(tank.fuel, each)
      tank.fuel -= take
      got += take
      Matter.Body.setMass(tank.rp.body, tank.def.mass + tank.fuel)
      if (tank.fuel <= 0) {
        tank.fuel = 0
        this.fireSource({ kind: 'part', uid: tank.uid, port: 'empty' })
      }
    }
    return got / leak
  }

  private engineWear(p: FlightPart, throttle: number) {
    const e = p.def.engine!
    const hot = p.failure === 'hot' ? 2.5 : 1
    p.heat += (e.heatRate * throttle * hot - 0.01 * (1 - throttle)) * STEP
    if (p.bypass > 0) {
      p.bypass -= STEP
      if (p.bypass <= 0 && p.failure) {
        this.say(`${p.def.name}: ${FAILURE_LABEL[p.failure]} cleared.`, 'good')
        p.failure = null
        p.skew = 0
      }
    }
    if (!p.failure && p.main) {
      const f = rollFailure(this.rng, e, throttle, p.heat, STEP)
      if (f) {
        p.failure = f
        if (f === 'stuck') p.stuckAt = throttle
        if (f === 'uneven') p.skew = this.rng.range(0.06, 0.14) * (this.rng.next() < 0.5 ? -1 : 1)
        this.cues.push('failure')
        this.say(`${p.def.name}: ${FAILURE_LABEL[f].toUpperCase()}!`, 'bad')
      }
    }
    if (p.heat >= 1) this.explode(p, 'overheated and blew apart')
  }

  // -------------------------------------------------------------------------
  // Topology: who's still attached to the seat, and fuel-feed groups.
  // -------------------------------------------------------------------------

  private refreshTopology(initial = false) {
    const alive = [...this.parts.values()].filter((p) => p.alive).map((p) => p.uid)
    const edges = aliveEdges(this.rig)
    const comps = components(alive, edges)
    const cmd = this.rig.commandUid
    let main = comps.find((c) => cmd !== null && c.includes(cmd) && this.parts.get(cmd)!.alive)
    if (!main) main = comps.reduce<number[] | undefined>((best, c) => (!best || c.length > best.length ? c : best), undefined) ?? []
    const wasMain = this.mainSet
    this.mainSet = new Set(main)
    for (const p of this.parts.values()) p.main = p.alive && this.mainSet.has(p.uid)

    // Feed groups: components with every bolt-adjacent weld cut.
    const bolts = new Set([...this.parts.values()].filter((p) => p.def.bolt).map((p) => p.uid))
    const feedEdges = edges.filter((e) => !bolts.has(e.a) && !bolts.has(e.b))
    this.feedGroup.clear()
    components(alive, feedEdges).forEach((g, i) => g.forEach((u) => this.feedGroup.set(u, i)))

    if (initial) return
    const detached = [...wasMain].filter((u) => !this.mainSet.has(u) && this.parts.get(u)!.alive)
    if (detached.length > 0) {
      const stable = isStableOrbit(elements(this.frame), ATMOSPHERE_TOP)
      for (const u of detached) {
        const p = this.parts.get(u)!
        if (p.def.payload && stable && !this.stats.satDelivered) {
          this.stats.satDelivered = true
          this.say('Pirate Radio is ON THE AIR from orbit! 📻', 'good')
          this.cues.push('orbit')
        }
      }
    }
  }

  private mainCom(): Vec {
    let m = 0
    let x = 0
    let y = 0
    for (const uid of this.mainSet) {
      const b = this.parts.get(uid)!.rp.body
      m += b.mass
      x += b.mass * b.position.x
      y += b.mass * b.position.y
    }
    return m > 0 ? { x: x / m / PPM, y: y / m / PPM } : { x: 0, y: 0 }
  }

  // Fold the main craft's COM motion into the frame and recentre Matter.
  private rebase() {
    if (this.mainSet.size === 0) return
    let m = 0
    let px = 0
    let py = 0
    let vx = 0
    let vy = 0
    let wSum = 0
    for (const uid of this.mainSet) {
      const b = this.parts.get(uid)!.rp.body
      const v = bodyVelocity(b, STEP)
      m += b.mass
      px += b.mass * b.position.x
      py += b.mass * b.position.y
      vx += b.mass * v.x
      vy += b.mass * v.y
      wSum += bodyAngularVelocity(b, STEP) * b.mass
    }
    px /= m
    py /= m
    vx /= m
    vy /= m
    this.omega = wSum / m
    if (this.frame) {
      this.frame.p.x += px / PPM
      this.frame.p.y -= py / PPM
      this.frame.v.x += vx
      this.frame.v.y -= vy
    }
    for (const p of this.parts.values()) {
      if (!p.alive) continue
      const b = p.rp.body
      const v = bodyVelocity(b, STEP)
      // Translate carries positionPrev along, so velocity is preserved.
      Matter.Body.translate(b, { x: -px, y: -py })
      setBodyVelocity(b, { x: v.x - vx, y: v.y - vy }, STEP)
    }
    for (const bl of this.blasts) {
      bl.x -= px / PPM
      bl.y -= py / PPM
    }
  }

  // Distance (m) from the COM to the craft's lowest point along local down.
  private computeLowestOffset(): number {
    const up = this.frame ? this.localUp : { x: 0, y: -1 }
    const com = this.mainCom()
    let low = 0
    for (const uid of this.mainSet) {
      for (const v of this.parts.get(uid)!.rp.body.vertices) {
        const d = -((v.x / PPM - com.x) * up.x + (v.y / PPM - com.y) * up.y)
        if (d > low) low = d
      }
    }
    return low
  }

  private groundContact() {
    this.lowestOffset = this.computeLowestOffset()
    const clearance = this.altitude - this.lowestOffset
    if (!this.liftedOff) {
      if (clearance > LIFTOFF_ALT) {
        this.liftedOff = true
        this.say('LIFTOFF!', 'good')
      } else {
        // Sitting on the pad: the ground pushes back and the launch
        // clamps stop it spinning in place.
        for (const uid of this.mainSet) {
          const b = this.parts.get(uid)!.rp.body
          internals(b).anglePrev = b.angle
        }
        const up = radialUp(this.frame.p)
        const vr = this.frame.v.x * up.x + this.frame.v.y * up.y
        if (vr < 0 || clearance < 0) {
          this.frame.v.x = 0
          this.frame.v.y = 0
          const r = PLANET_RADIUS + this.lowestOffset
          this.frame.p.x = up.x * r
          this.frame.p.y = up.y * r
        }
        return
      }
    }
    if (clearance <= 0) this.finish(this.speed)
  }

  private updateThermal() {
    const alt = this.altitude
    if (alt > ATMOSPHERE_TOP) return
    const flux = heatFlux(alt, this.speed)
    if (flux < 0.2) {
      for (const p of this.parts.values()) p.scorch = Math.max(0, p.scorch - 0.05 * STEP)
      return
    }
    const vLocal = { x: this.frame.v.x, y: -this.frame.v.y }
    for (const uid of [...this.mainSet]) {
      const p = this.parts.get(uid)!
      const b = p.rp.body
      const cos = Math.cos(b.angle)
      const sin = Math.sin(b.angle)
      const rel = { x: vLocal.x * cos + vLocal.y * sin, y: -vLocal.x * sin + vLocal.y * cos }
      const face = Math.abs(rel.y) > Math.abs(rel.x) ? (rel.y < 0 ? 0 : 2) : rel.x > 0 ? 1 : 3
      const shielded = p.rp.neighbors[face].length > 0
      const local = flux * (shielded ? 0.3 : 1)
      const excess = local - p.def.heatTolerance
      if (excess > 0) p.scorch += excess * STEP * 0.6
      else p.scorch = Math.max(0, p.scorch - 0.05 * STEP)
      if (p.scorch >= 1) this.explode(p, this.verticalSpeed > 0 ? 'burned up — too fast in thick air' : 'burned up on re-entry', 'burnup')
    }
  }

  private explode(p: FlightPart, why: string, cue: Cue = 'explode') {
    if (!p.alive) return
    this.addBlast(p, 1.4)
    removePartBody(this.rig, p.uid)
    p.alive = false
    p.main = false
    p.ignited = false
    this.cues.push(cue)
    this.say(`${p.def.name} ${why}!`, 'bad')
    this.refreshTopology()
  }

  private addBlast(p: FlightPart, size: number) {
    this.blasts.push({ x: p.rp.body.position.x / PPM, y: p.rp.body.position.y / PPM, age: 0, size })
  }

  // -------------------------------------------------------------------------
  // Debris
  // -------------------------------------------------------------------------

  private resolveDebris(p: FlightPart) {
    if (!p.alive || p.main || p.lost || p.recovered) return
    const inAir = this.altitude < ATMOSPHERE_TOP
    // Everything welded to an open chute floats down with it.
    const recovered = inAir && this.debrisHasChute(p.uid)
    if (recovered) p.recovered = true
    else p.lost = true
    Matter.Composite.remove(this.rig.engine.world, p.rp.body)
    p.alive = false
  }

  private debrisHasChute(uid: number): boolean {
    const comps = components(
      [...this.parts.values()].filter((q) => q.alive && !q.main).map((q) => q.uid),
      aliveEdges(this.rig),
    )
    const group = comps.find((c) => c.includes(uid)) ?? [uid]
    return group.some((u) => this.parts.get(u)!.chute === 'open')
  }

  private cullFarDebris() {
    for (const p of this.parts.values()) {
      if (!p.alive || p.main) continue
      const d = Math.hypot(p.rp.body.position.x, p.rp.body.position.y) / PPM
      if (d > DEBRIS_CULL) this.resolveDebris(p)
    }
  }

  private cullAllDebris() {
    for (const p of this.parts.values()) if (p.alive && !p.main) this.resolveDebris(p)
  }

  // -------------------------------------------------------------------------
  // Stats & ending
  // -------------------------------------------------------------------------

  private trackStats() {
    const alt = this.altitude
    const s = this.stats
    if (alt > s.maxAltitude) s.maxAltitude = alt
    if (this.speed > s.maxSpeed) s.maxSpeed = this.speed
    if (this.mach > s.maxMach) s.maxMach = this.mach
    if (this.q > s.maxQ) s.maxQ = this.q
    if (this.mach >= 1 && alt < 10_000 && !s.sonicLow) {
      s.sonicLow = true
      this.say('SONIC BOOM! Every window in the county rattles.', 'good')
    }
    if (alt >= ATMOSPHERE_TOP && !s.reachedSpace) {
      s.reachedSpace = true
      this.say('You are in SPACE. In a lawn chair.', 'good')
    }
    if (!s.orbitAchieved && isStableOrbit(this.orbit, ATMOSPHERE_TOP)) {
      s.orbitAchieved = true
      this.cues.push('orbit')
      this.say('STABLE ORBIT! Periapsis is above the atmosphere.', 'good')
    }
  }

  // impactSpeed null = player ended the flight in the air.
  private finish(impactSpeed: number | null) {
    const recovered: number[] = []
    const lost: number[] = []
    let kind: FlightOutcome['kind']
    let commandSurvived = false
    const cmd = this.rig.commandUid

    this.cullAllDebris()
    if (impactSpeed === null) {
      if (!this.liftedOff) kind = 'scrubbed'
      else kind = isStableOrbit(this.orbit, ATMOSPHERE_TOP) ? 'orbit' : 'abandoned'
    } else {
      kind = 'landed'
    }

    const ocean = this.isOcean()
    for (const p of this.parts.values()) {
      if (p.recovered) {
        recovered.push(p.uid)
        continue
      }
      if (!p.alive || !p.main) {
        lost.push(p.uid)
        continue
      }
      let survives: boolean
      if (kind === 'scrubbed') survives = true
      else if (kind === 'orbit' || kind === 'abandoned') survives = false
      else survives = impactSpeed! <= p.def.crashTolerance * (ocean ? 1.5 : 1)
      if (survives) recovered.push(p.uid)
      else lost.push(p.uid)
      if (p.uid === cmd && survives && kind !== 'scrubbed') commandSurvived = true
    }
    if (kind === 'landed') {
      kind = !commandSurvived ? 'crashed' : ocean ? 'splashdown' : 'landed'
      this.cues.push(commandSurvived ? 'land' : 'crash')
      this.say(
        commandSurvived
          ? `Touchdown at ${impactSpeed!.toFixed(1)} m/s${ocean ? ' — in the drink' : ''}. The pilot waves.`
          : `Impact at ${impactSpeed!.toFixed(0)} m/s. That's going to leave a crater.`,
        commandSurvived ? 'good' : 'bad',
      )
    }
    this.outcome = {
      kind,
      impactSpeed: impactSpeed ?? 0,
      commandSurvived,
      recovered,
      lost,
      stats: { ...this.stats },
      flightTime: this.t,
    }
    this.status = 'ended'
  }

  isOcean(): boolean {
    const phi = Math.atan2(this.frame.p.x, this.frame.p.y) // 0 at the pad, + east
    if (Math.abs(phi) < 0.01) return false // 3 km of farmland around the pad
    return Math.sin(phi * 9 + 0.8) > 0.2
  }

  // Downrange distance along the surface, metres.
  get downrange(): number {
    return Math.atan2(this.frame.p.x, this.frame.p.y) * PLANET_RADIUS
  }

  get twrNow(): number {
    let m = 0
    for (const uid of this.mainSet) m += this.parts.get(uid)!.rp.body.mass
    const g = G0 * (PLANET_RADIUS / (PLANET_RADIUS + this.altitude)) ** 2
    return m > 0 ? this.thrustNow / (m * g) : 0
  }

  private say(text: string, tone: FlightLog['tone']) {
    this.log.push({ t: this.t, text, tone })
    if (this.log.length > 60) this.log.shift()
  }

  drainCues(): Cue[] {
    const c = this.cues
    this.cues = []
    return c
  }
}

// The 3D manor: built once from the maze, then kept in step with the world
// every frame (ghosts, Snaxley, sweets, hazards, lantern light) and dressed
// up with particles from the step's events.
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  DirectionalLight,
  AmbientLight,
  type Material,
  type Texture,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { frontTile, slotAbility } from '../sim/abilities'
import { GHOSTS, ghostDef } from '../sim/config'
import type { WorldEvent } from '../sim/events'
import { hunger } from '../sim/fear'
import { visionCone } from '../sim/intruder'
import { FLOOR, PROP, WALL, neighbors, tileAt, tileX, tileY } from '../sim/maze'
import type { World } from '../sim/types'
import { placeCamera, type View } from './camera'
import { Particles, WALL_H, glowDisc, makeHazard, type HazardView } from './effects'
import { lightMapped, makeGhost, makeRaccoon, shared, yawFor, type GhostModel, type RaccoonModel } from './models'
import { baseLight, brickTexture, floorTexture, lightTexture, portraitTexture } from './textures'

const SWEET_COLORS = ['#f472b6', '#facc15', '#4ade80', '#60a5fa', '#fb923c', '#c084fc']
const AIMED = new Set(['mirror', 'slime', 'trick'])

interface GhostView {
  model: GhostModel
  portrait: Mesh
  ring: Mesh
  lift: number
  phase: number
}

const m4 = new Matrix4()
const q = new Quaternion()
const v3 = new Vector3()
const s3 = new Vector3()
const UP = new Vector3(0, 1, 0)

export class HauntScene {
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(62, 1, 0.05, 90)
  private ghosts: GhostView[] = []
  private snax: RaccoonModel
  private sweets: InstancedMesh
  private sweetTiles: number[] = []
  private gums: InstancedMesh
  private gumTiles: number[]
  private wisps: Mesh[] = []
  private hazards = new Map<number, HazardView>()
  private particles: Particles
  private base: Float32Array
  private light: Float32Array
  private lightTex
  private lanterns: { flame: Mesh; tile: number }[] = []
  private aim: Mesh
  private houseDoor: Mesh<PlaneGeometry, MeshBasicMaterial>
  private shake = new Vector3()
  private shakeT = 0
  private bodyYaw = 0
  private time = 0
  private textures: Texture[] = []

  private reducedMotion: boolean

  constructor(w: World, reducedMotion: boolean) {
    this.reducedMotion = reducedMotion
    const m = w.maze
    const scene = this.scene
    scene.background = new Color('#0b0716')
    scene.fog = new Fog('#0b0716', 9, 26)

    scene.add(new HemisphereLight('#9d8cff', '#2a1d3d', 1.15))
    scene.add(new AmbientLight('#ffffff', 0.25))
    const moon = new DirectionalLight('#b9c6ff', 0.55)
    moon.position.set(-4, 10, -6)
    scene.add(moon)

    // Light map: lantern pools, darkened by Lantern Snuff.
    this.base = baseLight(m, w.manor.visionMul)
    this.light = Float32Array.from(this.base)
    this.lightTex = lightTexture(m)
    shared.uLight.value = this.lightTex
    shared.uMazeSize.value.set(m.w, m.h)
    this.writeLight(true)

    // Floor and the garden outside.
    const floorTex = floorTexture(m)
    const floor = new Mesh(new PlaneGeometry(m.w, m.h), lightMapped(new MeshLambertMaterial({ map: floorTex })))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(m.w / 2 - 0.5, 0, m.h / 2 - 0.5)
    scene.add(floor)
    const garden = new Mesh(new PlaneGeometry(m.w + 60, m.h + 60), new MeshLambertMaterial({ color: '#132018' }))
    garden.rotation.x = -Math.PI / 2
    garden.position.set(m.w / 2 - 0.5, -0.01, m.h / 2 - 0.5)
    scene.add(garden)
    this.textures.push(floorTex, this.lightTex)

    // Walls.
    const walls: number[] = []
    for (let i = 0; i < m.cells.length; i++) if (m.cells[i] === WALL) walls.push(i)
    const brick = brickTexture()
    this.textures.push(brick)
    const wallMesh = new InstancedMesh(new BoxGeometry(1, WALL_H, 1), lightMapped(new MeshLambertMaterial({ map: brick }), true), walls.length)
    walls.forEach((i, k) => {
      m4.makeTranslation(tileX(m, i), WALL_H / 2, tileY(m, i))
      wallMesh.setMatrixAt(k, m4)
    })
    scene.add(wallMesh)
    const capMesh = new InstancedMesh(new BoxGeometry(1.02, 0.08, 1.02), lightMapped(new MeshLambertMaterial({ color: '#2e2442' }), true), walls.length)
    walls.forEach((i, k) => {
      m4.makeTranslation(tileX(m, i), WALL_H + 0.04, tileY(m, i))
      capMesh.setMatrixAt(k, m4)
    })
    scene.add(capMesh)

    // Lanterns on the walls, facing the hall.
    const flameGeo = new SphereGeometry(0.08, 10, 8)
    const bracketGeo = new BoxGeometry(0.12, 0.2, 0.12)
    const bracketMat = new MeshLambertMaterial({ color: '#3f3a4f' })
    for (const l of m.lanterns) {
      const open = neighbors(m, l).find((n) => m.cells[n] !== WALL)
      if (open === undefined) continue
      const dx = tileX(m, open) - tileX(m, l)
      const dy = tileY(m, open) - tileY(m, l)
      const g = new Group()
      g.position.set(tileX(m, l) + dx * 0.56, 0.75, tileY(m, l) + dy * 0.56)
      const bracket = new Mesh(bracketGeo, bracketMat)
      const flame = new Mesh(flameGeo, new MeshBasicMaterial({ color: '#fcd34d' }))
      flame.position.y = 0.17
      g.add(bracket, flame)
      scene.add(g)
      this.lanterns.push({ flame, tile: open })
    }

    // Furniture.
    const seat = new MeshLambertMaterial({ color: '#7f1d1d' })
    const wood = new MeshLambertMaterial({ color: '#57361f' })
    for (const p of m.props) {
      const g = new Group()
      g.position.set(tileX(m, p), 0, tileY(m, p))
      const base = new Mesh(new BoxGeometry(0.7, 0.32, 0.7), seat)
      base.position.y = 0.2
      const back = new Mesh(new BoxGeometry(0.7, 0.55, 0.16), seat)
      back.position.set(0, 0.5, -0.27)
      const legs = new Mesh(new BoxGeometry(0.76, 0.06, 0.76), wood)
      legs.position.y = 0.03
      g.add(base, back, legs)
      scene.add(g)
    }

    // The front door: an arch, with moonlight beyond.
    const dx = tileX(m, m.door)
    const dy = tileY(m, m.door)
    const archMat = new MeshLambertMaterial({ color: '#8b5e34' })
    for (const side of [-1, 1]) {
      const post = new Mesh(new BoxGeometry(0.14, WALL_H + 0.4, 0.3), archMat)
      post.position.set(dx + side * 0.48, (WALL_H + 0.4) / 2, dy)
      scene.add(post)
    }
    const lintel = new Mesh(new BoxGeometry(1.1, 0.16, 0.3), archMat)
    lintel.position.set(dx, WALL_H + 0.4, dy)
    scene.add(lintel)
    const moonlight = glowDisc('#a5b4fc', 0.9)
    moonlight.position.set(dx, 0.02, dy + 0.9)
    scene.add(moonlight)

    // The Ghost House door: a shimmering curtain only ghosts pass.
    const hx = tileX(m, m.houseDoor)
    const hy = tileY(m, m.houseDoor)
    this.houseDoor = new Mesh(
      new PlaneGeometry(1, WALL_H),
      new MeshBasicMaterial({ color: '#f9a8d4', transparent: true, opacity: 0.35, side: DoubleSide, depthWrite: false }),
    )
    this.houseDoor.position.set(hx, WALL_H / 2, hy)
    scene.add(this.houseDoor)

    // Sweets: one instance per floor tile, hidden where there's none.
    const sweetGeo = mergeGeometries([
      new SphereGeometry(0.1, 12, 8).scale(1.4, 1, 1),
      new ConeGeometry(0.07, 0.12, 8).rotateZ(Math.PI / 2).translate(0.19, 0, 0),
      new ConeGeometry(0.07, 0.12, 8).rotateZ(-Math.PI / 2).translate(-0.19, 0, 0),
    ])
    for (let i = 0; i < m.cells.length; i++) if (m.cells[i] === FLOOR) this.sweetTiles.push(i)
    this.sweets = new InstancedMesh(sweetGeo, new MeshLambertMaterial({ color: '#ffffff', emissive: '#331a33' }), this.sweetTiles.length)
    this.sweetTiles.forEach((_, k) => this.sweets.setColorAt(k, new Color(SWEET_COLORS[k % SWEET_COLORS.length])))
    scene.add(this.sweets)

    this.gumTiles = [...m.gumballs]
    this.gums = new InstancedMesh(new SphereGeometry(0.2, 18, 14), new MeshLambertMaterial({ color: '#ffffff', emissive: '#ff4fd8', emissiveIntensity: 0.6 }), Math.max(1, this.gumTiles.length))
    this.gumTiles.forEach((_, k) => this.gums.setColorAt(k, new Color(['#f472b6', '#38bdf8', '#a3e635', '#fbbf24'][k % 4])))
    this.gums.count = this.gumTiles.length
    scene.add(this.gums)

    const wispGeo = new SphereGeometry(0.12, 12, 10)
    for (let k = 0; k < 4; k++) {
      const wisp = new Mesh(wispGeo, new MeshBasicMaterial({ color: '#a7f3d0', transparent: true, opacity: 0.85 }))
      wisp.add(glowDisc('#6ee7b7', 0.4))
      wisp.visible = false
      scene.add(wisp)
      this.wisps.push(wisp)
    }

    // The ghosts.
    for (const [k, g] of w.ghosts.entries()) {
      const def = ghostDef(g.id)
      const model = makeGhost(def.color, k * 1.7)
      const tex = portraitTexture(def.color)
      this.textures.push(tex)
      const portrait = new Mesh(new PlaneGeometry(0.62, 0.82), new MeshBasicMaterial({ map: tex }))
      portrait.visible = false
      const ring = new Mesh(new RingGeometry(0.36, 0.44, 32), new MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.7, side: DoubleSide }))
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.03
      scene.add(model.root, portrait, ring)
      this.ghosts.push({ model, portrait, ring, lift: 0, phase: k * 1.3 })
    }

    this.snax = makeRaccoon()
    scene.add(this.snax.root)

    this.aim = new Mesh(new RingGeometry(0.42, 0.5, 4, 1, Math.PI / 4), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, side: DoubleSide }))
    this.aim.rotation.x = -Math.PI / 2
    this.aim.position.y = 0.04
    scene.add(this.aim)

    this.particles = new Particles(scene)
    const a = w.ghosts[w.active]
    this.camera.position.set(a.x, 10, a.y + 6)
    this.bodyYaw = yawFor(Math.atan2(w.intruder.dirY, w.intruder.dirX))
  }

  // Eases the light map toward its target (lanterns snuffed or not) and
  // uploads it when it changed.
  private writeLight(force = false, w?: World, dt = 0) {
    const m = w?.maze
    let changed = force
    const rate = (this.reducedMotion ? 1 : 2.5) * dt
    for (let i = 0; i < this.light.length; i++) {
      let target = this.base[i]
      if (w && m) {
        let snuffed = w.snuff[i] > 0
        if (!snuffed && m.cells[i] === WALL) snuffed = neighbors(m, i).some((n) => w.snuff[n] > 0)
        if (snuffed) target = Math.min(target, 0.1)
      }
      const cur = this.light[i]
      if (cur !== target) {
        this.light[i] = force ? target : cur + Math.max(-rate, Math.min(rate, target - cur))
        changed = true
      }
    }
    if (!changed) return
    const data = this.lightTex.image.data as Uint8Array
    for (let i = 0; i < this.light.length; i++) data[i * 4] = Math.round(this.light[i] * 255)
    this.lightTex.needsUpdate = true
  }

  // Draws one frame's worth of the world.
  update(w: World, view: View, dt: number, events: WorldEvent[]) {
    this.time += dt
    const t = this.time
    shared.uTime.value = t
    const m = w.maze
    for (const e of events) this.onEvent(w, e)

    this.writeLight(false, w, dt)
    for (const l of this.lanterns) {
      const lit = this.light[l.tile]
      l.flame.scale.setScalar(0.3 + 0.7 * Math.min(1, lit * 1.5) + (this.reducedMotion ? 0 : Math.sin(t * 3 + l.tile) * 0.04))
    }

    // Sweets bob and turn; eaten ones vanish.
    const bob = this.reducedMotion ? 0 : 0.03
    this.sweetTiles.forEach((i, k) => {
      const on = w.sweets[i] === 1
      q.setFromAxisAngle(UP, t * 1.2 + k)
      v3.set(tileX(m, i), 0.2 + Math.sin(t * 2 + k) * bob, tileY(m, i))
      s3.setScalar(on ? 1 : 0)
      this.sweets.setMatrixAt(k, m4.compose(v3, q, s3))
    })
    this.sweets.instanceMatrix.needsUpdate = true
    this.gumTiles.forEach((i, k) => {
      const on = w.gumballs[i] === 1
      const pulse = 1 + Math.sin(t * 2.4 + k) * 0.08
      q.identity()
      v3.set(tileX(m, i), 0.28 + Math.sin(t * 1.6 + k) * bob * 2, tileY(m, i))
      s3.setScalar(on ? pulse : 0)
      this.gums.setMatrixAt(k, m4.compose(v3, q, s3))
    })
    this.gums.instanceMatrix.needsUpdate = true

    this.wisps.forEach((wisp, k) => {
      const p = w.wisps[k]
      wisp.visible = !!p
      if (p) wisp.position.set(p.x, 0.55 + Math.sin(t * 2 + k) * 0.12, p.y)
    })

    // Hazards come and go by id.
    const live = new Set<number>()
    for (const h of w.hazards) {
      live.add(h.id)
      let view = this.hazards.get(h.id)
      if (!view) {
        view = makeHazard(h, m, this.reducedMotion)
        this.hazards.set(h.id, view)
        this.scene.add(view.root)
      }
      view.update(h, t)
    }
    for (const [id, view] of this.hazards) {
      if (live.has(id)) continue
      this.scene.remove(view.root)
      this.hazards.delete(id)
    }

    this.updateGhosts(w, view, dt)
    this.updateRaccoon(w, dt)

    // The tile the active ghost would aim a trap at.
    const active = w.ghosts[w.active]
    const aimed = [0, 1, 2].some((s) => AIMED.has(slotAbility(w, active, s) ?? ''))
    this.aim.visible = aimed && active.respawn <= 0 && active.hidden <= 0 && !w.over
    if (this.aim.visible) {
      const ft = frontTile(w, active)
      this.aim.position.set(tileX(m, ft), 0.04, tileY(m, ft))
      ;(this.aim.material as MeshBasicMaterial).color.set(ghostDef(active.id).color)
    }

    this.houseDoor.material.opacity = 0.28 + Math.sin(t * 1.5) * 0.08
    this.particles.update(dt)

    // Camera, with a little shake after a big scare.
    this.shakeT = Math.max(0, this.shakeT - dt)
    if (this.shakeT > 0 && !this.reducedMotion) this.shake.set((Math.random() - 0.5) * 0.12 * this.shakeT, (Math.random() - 0.5) * 0.08 * this.shakeT, 0)
    else this.shake.set(0, 0, 0)
    const ag = this.ghosts[w.active]
    placeCamera(this.camera, view, active.x, active.y, ag ? ag.model.root.position.y : 0.2, dt, this.shake)
    this.camera.updateMatrixWorld()
  }

  private updateGhosts(w: World, view: View, dt: number) {
    const m = w.maze
    const t = this.time
    w.ghosts.forEach((g, k) => {
      const gv = this.ghosts[k]
      const { root, body, mat } = gv.model
      const isActive = k === w.active
      const overProp = m.cells[tileAt(m, g.x, g.y)] === PROP
      gv.lift += ((overProp ? 0.45 : 0) - gv.lift) * Math.min(1, dt * 6)
      const bob = this.reducedMotion ? 0 : Math.sin(t * 2.5 + gv.phase) * 0.05
      root.position.set(g.x, 0.14 + gv.lift + bob, g.y)
      root.rotation.y = yawFor(g.facing)
      const stretch = g.dash ? 1.5 : 1
      root.scale.set(1 / Math.sqrt(stretch), 1, stretch)
      let opacity = 0.93
      if (g.respawn > 0) {
        opacity = 0.3
        root.scale.setScalar(0.6)
      } else if (g.invisible > 0) opacity = isActive ? 0.22 : 0.12
      else if (g.noclip > 0 || g.intangible > 0) opacity = 0.5
      mat.opacity = opacity
      mat.emissiveIntensity = isActive ? 1.15 : 0.8
      const hidden = g.hidden > 0
      root.visible = !hidden && !(isActive && view.mode === 'first')
      body.visible = root.visible
      gv.portrait.visible = hidden
      if (hidden) {
        gv.portrait.position.set(g.x + g.hideDir.x * 0.49, 0.72, g.y + g.hideDir.y * 0.49)
        gv.portrait.lookAt(g.x, 0.72, g.y)
      }
      gv.ring.visible = isActive && !hidden && g.respawn <= 0
      gv.ring.position.set(g.x, 0.03 + gv.lift, g.y)
      if (g.boost > 0 && Math.random() < dt * 30) this.particles.spawn(g.x, 0.3, g.y, ghostDef(g.id).color, { count: 1, speed: 0.3, up: 0.2, size: 0.04, life: 0.4, gravity: 0 })
    })
  }

  private updateRaccoon(w: World, dt: number) {
    const it = w.intruder
    const s = it.status
    const r = this.snax
    const t = this.time
    const moving = it.next !== it.cur && s.stumble <= 0 && s.frozen <= 0 && s.stuck <= 0 && s.munch <= 0
    const running = moving || s.treadmill > 0
    const fast = it.state === 'flee' || it.state === 'spooked' || s.blind > 0 || s.treadmill > 0

    // Body faces the way he walks; the head (and lamp) turns to look.
    const want = yawFor(Math.atan2(it.dirY, it.dirX))
    let d = want - this.bodyYaw
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    this.bodyYaw += d * Math.min(1, dt * 12)
    r.root.rotation.y = this.bodyYaw
    let headTurn = yawFor(it.look) - this.bodyYaw
    while (headTurn > Math.PI) headTurn -= Math.PI * 2
    while (headTurn < -Math.PI) headTurn += Math.PI * 2
    r.head.rotation.y = Math.max(-1.3, Math.min(1.3, headTurn))

    const sink = s.stuck > 0 ? -0.14 : 0
    const stride = running ? Math.sin(t * (fast ? 22 : 14)) : 0
    const shiver = !this.reducedMotion && (s.frozen > 0 || it.state === 'spooked' || it.state === 'flee') ? Math.sin(t * 60) * 0.02 : 0
    r.root.position.set(it.x + shiver, sink, it.y)
    r.body.position.y = running ? Math.abs(stride) * 0.05 : 0
    r.body.rotation.z = s.stumble > 0 ? Math.sin(t * 10) * 0.25 : s.confused > 0 && !this.reducedMotion ? Math.sin(t * 4) * 0.12 : 0
    r.body.rotation.x = it.state === 'flee' || s.blind > 0 ? 0.25 : s.munch > 0 ? 0.18 + Math.sin(t * 30) * 0.05 : 0
    r.feet[0].position.z = 0.05 + stride * 0.1
    r.feet[1].position.z = 0.05 - stride * 0.1
    r.tail.rotation.y = Math.sin(t * (running ? 9 : 2)) * 0.35

    // Fear flattens his ears; hunger fills his sack.
    const scared = w.fear >= 75 || it.state !== 'forage'
    for (const ear of r.ears) ear.rotation.x = scared ? -0.8 : 0
    r.sack.visible = it.state !== 'flee'
    r.sack.scale.setScalar(0.6 + hunger(w) * 0.9)
    r.root.scale.setScalar(it.rush > 0 ? 1.15 : 1)
    r.glow.emissive.setRGB(it.rush > 0 ? 0.55 + Math.sin(t * 3) * 0.15 : 0, 0, it.rush > 0 ? 0.35 : 0)

    // The headlamp shows what he can see.
    const cone = visionCone(w)
    r.lamp.distance = cone.range + 1.5
    r.lamp.angle = cone.half * 1.25
    r.lamp.intensity = s.blind > 0 ? 2 : 9
  }

  private onEvent(w: World, e: WorldEvent) {
    const it = w.intruder
    const p = this.particles
    switch (e.type) {
      case 'scare':
        p.spawn(it.x, 1, it.y, '#fde047', { count: 14, speed: 2.4, up: 2.5, size: 0.06 })
        if (e.amount >= 8) this.shakeT = Math.max(this.shakeT, e.combo ? 1 : 0.6)
        break
      case 'eat':
        p.spawn(e.x, 0.5, e.y, SWEET_COLORS[Math.floor(Math.random() * SWEET_COLORS.length)], { count: 3, speed: 0.8, up: 1, size: 0.025, life: 0.4 })
        break
      case 'drop':
        for (const i of e.tiles) p.arc(it.x, it.y, tileX(w.maze, i), tileY(w.maze, i), SWEET_COLORS[i % SWEET_COLORS.length])
        break
      case 'fizz':
        p.spawn(e.x, 0.6, e.y, '#c084fc', { count: 16, speed: 1.2, up: 0.8, size: 0.09, life: 1.1, gravity: -0.5, grow: 0.8 })
        break
      case 'shatter':
        p.spawn(e.x, 0.7, e.y, '#f5d0fe', { count: 18, speed: 2.5, up: 2, size: 0.05 })
        break
      case 'bonk':
        p.spawn(e.x, 0.4, e.y, '#ffffff', { count: 18, speed: 1.5, up: 1, size: 0.1, life: 0.9, gravity: 0, grow: 0.6 })
        break
      case 'wisp':
        p.spawn(e.x, 0.5, e.y, '#6ee7b7', { count: 12, speed: 1.2, up: 1.5, size: 0.04, additive: true })
        break
      case 'gumball':
        p.spawn(e.x, 0.4, e.y, '#f472b6', { count: 20, speed: 2.2, up: 2.2, size: 0.06, additive: true })
        break
      case 'skid':
        p.spawn(e.x, 0.1, e.y, '#5eead4', { count: 10, speed: 1.5, up: 1, size: 0.05 })
        break
      case 'bump':
        p.spawn(e.x, 0.9, e.y, '#fde047', { count: 8, speed: 1, up: 1.5, size: 0.05 })
        break
      case 'cast': {
        const color = GHOSTS.find((g) => g.id === e.ghost)?.color ?? '#ffffff'
        p.spawn(e.x, 0.4, e.y, color, { count: 8, speed: 1.4, up: 0.6, size: 0.04, additive: true })
        break
      }
      case 'respawn': {
        const g = w.ghosts.find((gh) => gh.id === e.ghost)
        if (g) p.spawn(g.x, 0.4, g.y, '#ffffff', { count: 10, speed: 0.8, up: 1, size: 0.05, additive: true })
        break
      }
      default:
        break
    }
  }

  // Where a point in the world lands on screen, in CSS pixels.
  project(x: number, h: number, y: number, width: number, height: number) {
    v3.set(x, h, y).project(this.camera)
    return { x: (v3.x * 0.5 + 0.5) * width, y: (-v3.y * 0.5 + 0.5) * height, behind: v3.z > 1 }
  }

  // Sets the see-through hole around the active ghost (device pixels).
  setHole(w: World, view: View, bufferW: number, bufferH: number) {
    const g = w.ghosts[w.active]
    if (view.mode === 'first' || g.respawn > 0) {
      shared.uHole.value.set(0, 0, 0)
      return
    }
    const gv = this.ghosts[w.active]
    v3.set(g.x, gv.model.root.position.y + 0.3, g.y)
    const dist = v3.distanceTo(this.camera.position)
    v3.project(this.camera)
    shared.uHole.value.set((v3.x * 0.5 + 0.5) * bufferW, (v3.y * 0.5 + 0.5) * bufferH, bufferH * (view.mode === 'overhead' ? 0.09 : 0.14))
    shared.uHoleDepth.value = dist - 0.45
    const cx = this.camera.position.x - g.x
    const cz = this.camera.position.z - g.y
    const len = Math.hypot(cx, cz) || 1
    shared.uHoleAt.value.set(g.x, g.y, cx / len, cz / len)
  }

  dispose() {
    const seen = new Set<Material | Material[]>()
    this.scene.traverse((o) => {
      const mesh = o as Mesh
      mesh.geometry?.dispose()
      if (mesh.material && !seen.has(mesh.material)) {
        seen.add(mesh.material)
        for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) mat.dispose()
      }
    })
    for (const t of this.textures) t.dispose()
  }
}

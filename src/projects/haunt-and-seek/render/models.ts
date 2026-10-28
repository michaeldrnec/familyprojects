// The cast, built from primitives: bedsheet ghosts with wobbly skirts, and
// Snaxley the raccoon with his headlamp and candy sack. Plus the shared
// shader tweaks: the per-tile light map, and the see-through hole that keeps
// the ghost you're flying visible behind walls.
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  SphereGeometry,
  SpotLight,
  Vector2,
  Vector3,
  Vector4,
  type Material,
  type Texture,
} from 'three'

// Uniforms shared by every material that reads the light map or the hole.
export const shared = {
  uLight: { value: null as Texture | null },
  uMazeSize: { value: new Vector2(1, 1) },
  uHole: { value: new Vector3(0, 0, 0) }, // screen x, y (device px), radius (0 = off)
  uHoleDepth: { value: 0 },
  uHoleAt: { value: new Vector4(0, 0, 0, 0) }, // ghost x, z; flat direction toward the camera
  uTime: { value: 0 },
}

// Multiplies the material's color by the light map at its world position.
// `hole` also dithers away anything between the camera and the active ghost.
export function lightMapped<T extends Material>(mat: T, hole = false): T {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHsWorld;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 hsWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          hsWorld = instanceMatrix * hsWorld;
        #endif
        vHsWorld = (modelMatrix * hsWorld).xyz;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vHsWorld;
        uniform sampler2D uLight;
        uniform vec2 uMazeSize;
        uniform vec3 uHole;
        uniform float uHoleDepth;
        uniform vec4 uHoleAt;`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        ${
          hole
            ? `if (uHole.z > 0.0) {
          float hd = distance(gl_FragCoord.xy, uHole.xy) / uHole.z;
          // Only what stands between the camera and the ghost.
          float front = dot(vHsWorld.xz - uHoleAt.xy, uHoleAt.zw);
          if (hd < 1.0 && vViewPosition.z < uHoleDepth && front > 0.2) {
            // 4×4 ordered dither: a screen-door fade, densest at the middle.
            const float bayer[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
            ivec2 p = ivec2(mod(floor(gl_FragCoord.xy), 4.0));
            float b = (bayer[p.y * 4 + p.x] + 0.5) / 16.0;
            if (b > smoothstep(0.5, 1.0, hd)) discard;
          }
        }`
            : ''
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float hsLight = texture2D(uLight, (vHsWorld.xz + 0.5) / uMazeSize).r;
        diffuseColor.rgb *= mix(0.22, 1.35, hsLight);`,
      )
  }
  return mat
}

// --- Ghosts -------------------------------------------------------------

const ghostBody = (() => {
  const pts: Vector2[] = []
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * (Math.PI / 2)
    pts.push(new Vector2(Math.sin(a) * 0.3, 0.32 + Math.cos(a) * 0.3))
  }
  pts.push(new Vector2(0.32, 0.18), new Vector2(0.35, 0.02))
  return new LatheGeometry(pts.reverse(), 28)
})()

const eyeWhite = new SphereGeometry(0.07, 12, 10)
const eyePupil = new SphereGeometry(0.036, 10, 8)
const whiteMat = new MeshBasicMaterial({ color: '#ffffff' })
const pupilMat = new MeshBasicMaterial({ color: '#1b1530' })

// The skirt ripples: vertices near the hem sway with time.
function wobbly(mat: MeshLambertMaterial, phase: number) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float hem = clamp(1.0 - position.y / 0.3, 0.0, 1.0);
        float ang = atan(position.z, position.x);
        transformed.y += sin(ang * 6.0 + uTime * 5.0 + ${phase.toFixed(2)}) * 0.035 * hem;
        transformed.xz *= 1.0 + sin(ang * 3.0 - uTime * 3.0) * 0.04 * hem;`,
      )
  }
  mat.customProgramCacheKey = () => `ghost-wobble-${phase.toFixed(2)}`
  return mat
}

export interface GhostModel {
  root: Group
  body: Mesh
  mat: MeshLambertMaterial
}

export function makeGhost(color: string, phase = 0): GhostModel {
  const root = new Group()
  const mat = wobbly(
    new MeshLambertMaterial({ color, emissive: new Color(color).multiplyScalar(0.45), transparent: true, opacity: 0.93, side: DoubleSide }),
    phase,
  )
  const body = new Mesh(ghostBody, mat)
  root.add(body)
  for (const side of [-1, 1]) {
    const eye = new Mesh(eyeWhite, whiteMat)
    eye.position.set(side * 0.1, 0.44, 0.255)
    const pupil = new Mesh(eyePupil, pupilMat)
    pupil.position.set(side * 0.1, 0.44, 0.315)
    body.add(eye, pupil)
  }
  return { root, body, mat }
}

// --- Snaxley ------------------------------------------------------------

export interface RaccoonModel {
  root: Group
  body: Group // bobs and tilts
  head: Group // turns toward the headlamp's aim
  sack: Mesh
  tail: Group
  ears: Mesh[]
  feet: Mesh[]
  lamp: SpotLight
  lampTarget: Object3D
  glow: MeshLambertMaterial // body material (glows in a Sugar Rush)
}

export function makeRaccoon(): RaccoonModel {
  const fur = new MeshLambertMaterial({ color: '#9a9aa6', emissive: '#000000' })
  const pale = new MeshLambertMaterial({ color: '#d9d6df' })
  const dark = new MeshLambertMaterial({ color: '#2a2633' })
  const root = new Group()
  const body = new Group()
  root.add(body)

  const torso = new Mesh(new SphereGeometry(0.28, 20, 16), fur)
  torso.scale.set(1, 0.92, 1.15)
  torso.position.y = 0.32
  const belly = new Mesh(new SphereGeometry(0.2, 16, 12), pale)
  belly.position.set(0, 0.3, 0.13)
  body.add(torso, belly)

  const head = new Group()
  head.position.set(0, 0.62, 0.14)
  body.add(head)
  const skull = new Mesh(new SphereGeometry(0.21, 20, 16), fur)
  const mask = new Mesh(new SphereGeometry(0.215, 20, 8, 0, Math.PI * 2, Math.PI * 0.36, Math.PI * 0.18), dark)
  const snout = new Mesh(new SphereGeometry(0.1, 14, 10), pale)
  snout.scale.set(1, 0.8, 1.2)
  snout.position.set(0, -0.06, 0.18)
  const nose = new Mesh(new SphereGeometry(0.035, 10, 8), dark)
  nose.position.set(0, -0.04, 0.3)
  head.add(skull, mask, snout, nose)
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.045, 10, 8), whiteMat)
    eye.position.set(side * 0.08, 0.03, 0.18)
    const pupil = new Mesh(new SphereGeometry(0.024, 8, 6), pupilMat)
    pupil.position.set(side * 0.08, 0.03, 0.22)
    head.add(eye, pupil)
  }
  const ears: Mesh[] = []
  for (const side of [-1, 1]) {
    const ear = new Mesh(new ConeGeometry(0.07, 0.14, 10), fur)
    ear.position.set(side * 0.13, 0.19, -0.02)
    ear.rotation.z = -side * 0.35
    head.add(ear)
    ears.push(ear)
  }
  // The headlamp.
  const lampBody = new Mesh(new CylinderGeometry(0.05, 0.05, 0.05, 12), new MeshBasicMaterial({ color: '#fde68a' }))
  lampBody.rotation.x = Math.PI / 2
  lampBody.position.set(0, 0.13, 0.17)
  head.add(lampBody)
  const lamp = new SpotLight('#ffe9b0', 9, 8, Math.PI / 5, 0.55, 1.2)
  lamp.position.set(0, 0.13, 0.2)
  const lampTarget = new Object3D()
  lampTarget.position.set(0, -0.3, 3)
  head.add(lamp, lampTarget)
  lamp.target = lampTarget

  const tail = new Group()
  tail.position.set(0, 0.28, -0.3)
  body.add(tail)
  for (let k = 0; k < 5; k++) {
    const ring = new Mesh(new CylinderGeometry(0.075 - k * 0.006, 0.08 - k * 0.006, 0.1, 12), k % 2 ? dark : fur)
    ring.rotation.x = -0.9 + k * 0.12
    ring.position.set(0, k * 0.06, -k * 0.075)
    tail.add(ring)
  }

  const sack = new Mesh(new SphereGeometry(0.2, 16, 12), new MeshLambertMaterial({ color: '#7c4dbd' }))
  sack.position.set(0, 0.5, -0.22)
  body.add(sack)

  const feet: Mesh[] = []
  for (const side of [-1, 1]) {
    const foot = new Mesh(new SphereGeometry(0.07, 10, 8), dark)
    foot.scale.set(1, 0.6, 1.4)
    foot.position.set(side * 0.13, 0.04, 0.05)
    root.add(foot)
    feet.push(foot)
  }
  return { root, body, head, sack, tail, ears, feet, lamp, lampTarget, glow: fur }
}

// A ghost's heading in the grid (0 = east, π/2 = south) as a y-rotation for
// a model that faces +z.
export function yawFor(angle: number) {
  return Math.atan2(Math.cos(angle), Math.sin(angle))
}

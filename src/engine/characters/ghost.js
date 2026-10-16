// Shared kit for the two ghosts (Lavinia, Pike): the ghost shader, the depth pre-pass twins, geometry helpers
// (vertex colours, UV remap, merge), a 3D two-bone IK, a morphing gloved hand, and the haze / mist / mote effects.
//
// THE GLOW RECIPE (see docs/notes/characters.md):
//   * every visible part is a ShaderMaterial ("ghost"): albedo × a fixed half-lambert key (lit from within, not by
//     the room), plus an inner glow that rises toward the silhouette, plus a fresnel rim added on top (premultiplied
//     "additive rim"), alpha ≈ 0.75, the hem dissolving into noise (mist) in character space;
//   * each part has a depth-only twin drawn first, so the figure shows only its front surface (no arms seen through
//     the bodice, no inner skirt): a clean translucent person, not a stack of glass;
//   * the colour is luminance-capped (uMaxLum) so the body stays under the bloom threshold; only the rim edge
//     touches it, which gives a soft halo instead of a blown-out blob;
//   * a soft haze sprite behind, a few mist puffs at the hem, slow motes; one small point light (Lavinia only).
// Render order: the character's top THREE.Group gets renderOrder 2 (three's groupOrder), and every internal pivot is a
// plain Object3D, so the whole figure draws after the room's own transparent things: twins (renderOrder 0), then
// colour (1), then the effects (2).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const PI = Math.PI;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const easeInOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * t));
export const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
export const rand = (a, b) => a + Math.random() * (b - a);
/** attack / hold / release envelope, 0..1 */
export function env(t, a, h, r) {
  if (t <= 0) return 0;
  if (t < a) return smooth(t / a);
  if (t < a + h) return 1;
  if (t < a + h + r) return 1 - smooth((t - a - h) / r);
  return 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTex(w, h, draw, { repeatU = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeatU) t.wrapS = THREE.RepeatWrapping;
  return t;
}

let _white = null;
export function whiteTex() {
  if (!_white) _white = canvasTex(4, 4, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 4, 4); });
  return _white;
}

let _blob = null;
/** soft round blob (white, alpha falloff) for haze, mist and motes */
export function blobTex() {
  if (_blob) return _blob;
  _blob = canvasTex(128, 128, (g, W) => {
    const gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.15)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, W);
  });
  return _blob;
}

// ------------------------------------------------------------------------------------------------------------
// The ghost shader
// ------------------------------------------------------------------------------------------------------------

const VERT = /* glsl */`
#include <common>
#include <fog_pars_vertex>
uniform mat4 uCharInv;
attribute float cloth;
varying vec3 vNormalV;
varying vec3 vViewV;
varying vec3 vCP;
varying vec2 vUv;
varying vec3 vCol;
varying float vCloth;
void main() {
  vec4 lp = vec4(position, 1.0);
  vec3 ln = normal;
  #ifdef USE_INSTANCING
    lp = instanceMatrix * lp;
    ln = mat3(instanceMatrix) * ln;
  #endif
  vec4 wp = modelMatrix * lp;
  vCP = (uCharInv * wp).xyz;
  vec4 mvPosition = viewMatrix * wp;
  vNormalV = normalize(normalMatrix * ln);
  vViewV = -mvPosition.xyz;
  vUv = uv;
  #ifdef USE_COLOR
    vCol = color;
  #else
    vCol = vec3(1.0);
  #endif
  vCloth = cloth;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uMap;
uniform vec3 uGown;   // cloth: base colour (R channel of the map shades it)
uniform vec3 uTrim;   // cloth: G channel (beading, braid)
uniform vec3 uLace;   // cloth: B channel (lace, shirt)
uniform vec3 uGlow;   // inner glow, low in the body
uniform vec3 uCore;   // inner glow, high in the body
uniform vec3 uRim;    // additive fresnel rim
uniform float uOpacity;
uniform float uPresence;
uniform float uHover;
uniform float uTime;
uniform float uMistY0;
uniform float uMistY1;
uniform float uMaxLum;
uniform float uRimAmt;
uniform float uGlowAmt;
uniform float uBright;
uniform float uPartGlow;
uniform float uTint;
varying vec3 vNormalV;
varying vec3 vViewV;
varying vec3 vCP;
varying vec2 vUv;
varying vec3 vCol;
varying float vCloth;

float ghHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ghNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ghHash(i), ghHash(i + vec2(1.0, 0.0)), f.x), mix(ghHash(i + vec2(0.0, 1.0)), ghHash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec4 tex = texture2D(uMap, vUv);
  vec3 cloth = uGown * (0.5 + 0.5 * tex.r);
  cloth = mix(cloth, uTrim, tex.g);
  cloth = mix(cloth, uLace, tex.b);
  vec3 albedo = mix(vCol * tex.rgb, vCol * cloth, vCloth);
  float texA = tex.a;

  vec3 n = normalize(vNormalV);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vViewV);
  float ndv = clamp(abs(dot(n, v)), 0.0, 1.0);
  vec3 L = normalize(vec3(-0.35, 0.8, 0.5));
  float hl = dot(n, L) * 0.5 + 0.5;
  float lit = mix(0.42, 1.0, hl * hl);
  float hk = smoothstep(uMistY1 - 0.1, uMistY1 + 1.0, vCP.y);
  vec3 glowC = mix(uGlow, uCore, hk);
  // ghosts are a little monochrome: pull the albedo toward its own luminance, tinted by the inner light
  float aLum = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
  albedo = mix(albedo, aLum * normalize(glowC + 0.05) * 1.6, uTint);
  vec3 col = albedo * lit * uBright;
  col += glowC * (uGlowAmt + uPartGlow) * (0.35 + 0.65 * (1.0 - ndv));
  float fres = pow(1.0 - ndv, 2.6);
  vec3 rimAdd = uRim * fres * uRimAmt;

  // the hem dissolves into a slow mist
  float ang = atan(vCP.x, vCP.z);
  float nz = 0.55 * ghNoise(vCP.xz * 6.0 + vec2(uTime * 0.35, -uTime * 0.27)) + 0.45 * ghNoise(vec2(ang * 2.2, vCP.y * 5.0 - uTime * 0.5));
  float mist = smoothstep(uMistY0, uMistY1, vCP.y + (nz - 0.5) * 0.22);

  float a = clamp(uOpacity + fres * 0.18, 0.0, 1.0) * texA * mist * uPresence;
  col *= 1.0 + uHover * 0.22;
  rimAdd *= (1.0 + uHover * 0.7) * mist * uPresence * texA;
  // soft luminance ceiling (keeps the gradation, never reaches the bloom threshold)
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= uMaxLum * (1.0 - exp(-lum * 1.4 / uMaxLum)) / max(lum, 1e-4);

#ifdef DEPTH_ONLY
  // the depth pass ignores presence (so a fading ghost still shows only its front surface) until she is gone
  if (a < 0.28 * max(uPresence, 0.001) || uPresence < 0.02) discard;
  gl_FragColor = vec4(0.0);
#else
  if (a < 0.003) discard;
  gl_FragColor = vec4(col * a + rimAdd, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * gl_FragColor.a, fogFactor);
  #endif
#endif
}`;

/**
 * Shared uniforms for one character (by reference: every material of the character sees the same objects).
 * @param {object} look  { gown, trim, lace, glow, core, rim, opacity, maxLum, rimAmt, glowAmt, bright, tint, mist }
 */
export function ghostUniforms(look) {
  const c = (x) => new THREE.Color(x);
  return {
    uCharInv: { value: new THREE.Matrix4() },
    uGown: { value: c(look.gown ?? '#ffffff') },
    uTrim: { value: c(look.trim ?? '#ffffff') },
    uLace: { value: c(look.lace ?? '#ffffff') },
    uGlow: { value: c(look.glow) },
    uCore: { value: c(look.core ?? look.glow) },
    uRim: { value: c(look.rim) },
    uOpacity: { value: look.opacity ?? 0.75 },
    uPresence: { value: 1 },
    uHover: { value: 0 },
    uTime: { value: 0 },
    uMistY0: { value: look.mist?.[0] ?? -1 },
    uMistY1: { value: look.mist?.[1] ?? -0.9 },
    uMaxLum: { value: look.maxLum ?? 0.7 },
    uRimAmt: { value: look.rimAmt ?? 0.5 },
    uGlowAmt: { value: look.glowAmt ?? 0.15 },
    uBright: { value: look.bright ?? 1 },
    uTint: { value: look.tint ?? 0 },
  };
}

/** A colour material and its depth-only twin, sharing `U`. `map` is a texture (cloth channels if `cloth` parts). */
export function ghostMaterials(U, { map = null, side = THREE.DoubleSide, partGlow = 0 } = {}) {
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    ...U,
    uMap: { value: map || whiteTex() },
    uPartGlow: { value: partGlow },
  };
  const color = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: true, side, fog: true, vertexColors: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const depth = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG, defines: { DEPTH_ONLY: 1 },
    transparent: true, colorWrite: false, depthWrite: true, depthTest: true, side, fog: false, vertexColors: true,
    blending: THREE.NoBlending,
  });
  color.userData.noHighlight = true;
  depth.userData.noHighlight = true;
  return { color, depth };
}

const _noRay = () => {};
/** A ghost mesh: the visible colour mesh plus its depth twin as a child (same geometry, drawn first). */
export function ghostMesh(geo, mats, { instanced = 0 } = {}) {
  let mesh, twin;
  if (instanced) {
    mesh = new THREE.InstancedMesh(geo, mats.color, instanced);
    twin = new THREE.InstancedMesh(geo, mats.depth, instanced);
    twin.instanceMatrix = mesh.instanceMatrix; // shared
  } else {
    mesh = new THREE.Mesh(geo, mats.color);
    twin = new THREE.Mesh(geo, mats.depth);
  }
  mesh.renderOrder = 1;
  twin.renderOrder = 0;
  twin.raycast = _noRay;
  twin.userData.noRaycast = true;
  mesh.castShadow = false; mesh.receiveShadow = false;
  twin.castShadow = false;
  mesh.add(twin);
  mesh.userData.twin = twin;
  return mesh;
}

/** Make an object (and its subtree) invisible to clicks. */
export function noRaycast(o) {
  o.traverse((x) => { x.raycast = _noRay; x.userData.noRaycast = true; });
  return o;
}

// ------------------------------------------------------------------------------------------------------------
// Geometry helpers
// ------------------------------------------------------------------------------------------------------------

/** Ensure the attributes every ghost geometry needs: color (vec3), cloth (float), uv. Paint it `hex`. */
export function paint(geo, hex = '#ffffff', { cloth = 0 } = {}) {
  const n = geo.attributes.position.count;
  const c = new THREE.Color(hex);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('cloth', new THREE.BufferAttribute(new Float32Array(n).fill(cloth), 1));
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return geo;
}

/** Squeeze a geometry's UVs into the rect [u0,u1]×[v0,v1] (or collapse them to a point when u1/v1 are omitted). */
export function remapUV(geo, u0, v0, u1 = u0, v1 = v0) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i)));
  uv.needsUpdate = true;
  return geo;
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
/** Apply position / euler rotation / scale to a geometry (baked). */
export function place(geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], order = 'XYZ' } = {}) {
  const e = new THREE.Euler(r[0], r[1], r[2], order);
  _m4.compose(new THREE.Vector3(p[0], p[1], p[2]), _q.setFromEuler(e), new THREE.Vector3(s[0], s[1], s[2]));
  geo.applyMatrix4(_m4);
  return geo;
}

/** A capsule from point a to point b (radii ra at a, rb at b) as a baked geometry. */
export function capsuleAB(a, b, ra, rb = ra, { radial = 12, cap = 4 } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const len = d.length();
  const r = Math.max(ra, rb);
  const g = new THREE.CapsuleGeometry(r, Math.max(1e-4, len), cap, radial);
  // taper: scale x/z by height
  if (Math.abs(ra - rb) > 1e-5) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = clamp((y + len / 2) / len, 0, 1);
      const s = lerp(ra, rb, k) / r;
      p.setXYZ(i, p.getX(i) * s, y, p.getZ(i) * s);
    }
    g.computeVertexNormals();
  }
  g.applyMatrix4(_m4.compose(A.clone().add(B).multiplyScalar(0.5), _q.setFromUnitVectors(_up, d.normalize()), new THREE.Vector3(1, 1, 1)));
  return g;
}

/** Sphere/ellipsoid geometry baked at a position. */
export function ellipsoid(rx, ry, rz, p = [0, 0, 0], { ws = 20, hs = 14, r = [0, 0, 0] } = {}) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  return place(g, { p, r, s: [rx, ry, rz] });
}

/** Merge geometries that were all paint()ed (non-indexed ones are indexed first). */
export function merge(list) {
  const ok = list.map((g) => {
    if (!g.index) {
      const n = g.attributes.position.count;
      const idx = new Array(n); for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(idx);
    }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'cloth'].includes(k)) g.deleteAttribute(k);
    return g;
  });
  const m = mergeGeometries(ok, false);
  if (!m) throw new Error('[characters] merge failed (attribute mismatch)');
  return m;
}

/** Lathe from [[r, y], ...] (bottom to top) with optional per-vertex displacement fn(v3, theta, k) (k: 0 bottom .. 1 top). */
export function lathe(profile, segs, fn = null) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), segs);
  if (fn) {
    const p = g.attributes.position, uv = g.attributes.uv, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const th = Math.atan2(v.x, v.z);
      fn(v, th, uv.getY(i), uv.getX(i));
      p.setXYZ(i, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  stitchLatheSeam(g, profile.length, segs);
  return g;
}

/** Like lathe(), but open at the front (+Z): a gap of `gap` radians centred on the front. No seam stitching. */
export function latheOpen(profile, segs, gap, fn = null) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), segs, gap / 2, TAU - gap);
  if (fn) {
    const p = g.attributes.position, uv = g.attributes.uv, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      fn(v, Math.atan2(v.x, v.z), uv.getY(i), uv.getX(i));
      p.setXYZ(i, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

export function stitchLatheSeam(g, rows, segs) {
  const n = g.attributes.normal;
  for (let r = 0; r < rows; r++) {
    const a = r, b = segs * rows + r;
    const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l);
  }
  n.needsUpdate = true;
}

/** After displacing a SphereGeometry: normals, plus stitch the u-seam and poles. */
export function smoothSphereNormals(geo, ws, hs) {
  geo.computeVertexNormals();
  const n = geo.attributes.normal;
  const row = ws + 1;
  for (let iy = 0; iy <= hs; iy++) {
    const a = iy * row, b = iy * row + ws;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
  for (const iy of [0, hs]) {
    let x = 0, y = 0, z = 0;
    for (let ix = 0; ix <= ws; ix++) { const i = iy * row + ix; x += n.getX(i); y += n.getY(i); z += n.getZ(i); }
    const l = Math.hypot(x, y, z) || 1;
    for (let ix = 0; ix <= ws; ix++) n.setXYZ(iy * row + ix, x / l, y / l, z / l);
  }
  n.needsUpdate = true;
}

export function displacedSphere(ws, hs, fn) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
  smoothSphereNormals(g, ws, hs);
  return g;
}

/** A thin tube along a list of points (CatmullRom), painted. */
export function tubeAlong(points, radius, { segs = 16, radial = 6, taper = 0 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  if (taper) {
    // shrink toward both ends
    const p = g.attributes.position, uv = g.attributes.uv;
    const c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const u = uv.getX(i);
      curve.getPointAt(clamp(u, 0, 1), c);
      v.fromBufferAttribute(p, i).sub(c);
      const s = 1 - taper * Math.pow(Math.abs(u - 0.5) * 2, 2);
      v.multiplyScalar(s).add(c);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
  }
  return g;
}

// ------------------------------------------------------------------------------------------------------------
// Two-bone IK in 3D and segment orientation
// ------------------------------------------------------------------------------------------------------------

const _d = new THREE.Vector3(), _pp = new THREE.Vector3();
/** Shoulder S, wrist target T, lengths a, b, pole direction P (where the elbow points). Writes elbow to outE and the
 *  reachable wrist to outW. */
export function ik2(S, T, a, b, P, outE, outW) {
  _d.subVectors(T, S);
  let dist = _d.length();
  if (dist < 1e-5) { _d.set(0, -1, 0); dist = 1e-5; } else _d.divideScalar(dist);
  const d = clamp(dist, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  outW.copy(S).addScaledVector(_d, d);
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const along = a * cosA, h = a * Math.sqrt(1 - cosA * cosA);
  _pp.copy(P).addScaledVector(_d, -P.dot(_d));
  if (_pp.lengthSq() < 1e-8) _pp.set(0, 0, -1).addScaledVector(_d, -_d.z);
  _pp.normalize();
  outE.copy(S).addScaledVector(_d, along).addScaledVector(_pp, h);
}

const _dir = new THREE.Vector3();
/** Place an object built along +Y from its origin so it runs from `from` toward `to` (twist: keeps `side` roughly +X). */
export function orientSegment(obj, from, to) {
  obj.position.copy(from);
  _dir.subVectors(to, from).normalize();
  obj.quaternion.setFromUnitVectors(_up, _dir);
}

const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _bm = new THREE.Matrix4();
/** Orient a hand: local +Y along `fingers`, local +Z along `palm` (orthogonalised). */
export function orientBasis(obj, fingers, palm) {
  _by.copy(fingers).normalize();
  _bz.copy(palm).addScaledVector(_by, -palm.dot(_by));
  if (_bz.lengthSq() < 1e-8) _bz.set(0, 0, 1);
  _bz.normalize();
  _bx.crossVectors(_by, _bz).normalize();
  _bm.makeBasis(_bx, _by, _bz);
  obj.quaternion.setFromRotationMatrix(_bm);
}

// ------------------------------------------------------------------------------------------------------------
// The hand (gloved or bare): one mesh whose vertices morph between open (0), relaxed (0.5) and curled (1)
// ------------------------------------------------------------------------------------------------------------

/**
 * Hand-local frame: origin at the wrist, +Y toward the fingertips, +Z out of the palm. `side` +1 = the character's
 * left hand (+X), -1 = right. Returns { geo, setCurl(k) }.
 */
export function buildHand(side, hex, { scale = 1, spread = 1 } = {}) {
  const thumbSide = -side;
  const S = scale;
  const snapshot = (curl) => {
    const parts = [];
    // palm: a flattened capsule, slightly cupped toward +Z when curled
    const palm = new THREE.CapsuleGeometry(0.021 * S, 0.05 * S, 3, 10); // ENGINE-FIX tris: was 4, 12
    place(palm, { p: [0, 0.046 * S, 0.002 * S + curl * 0.004 * S], s: [1.62, 1, 0.62] });
    parts.push(palm);
    // wrist plug
    parts.push(capsuleAB([0, -0.012 * S, 0], [0, 0.02 * S, 0], 0.019 * S, 0.02 * S, { radial: 8, cap: 2 }));
    const fingers = [
      { x: 0.024, len: 0.07, r: 0.0084, sp: 0.1 },
      { x: 0.008, len: 0.078, r: 0.0088, sp: 0.02 },
      { x: -0.008, len: 0.072, r: 0.0084, sp: -0.06 },
      { x: -0.023, len: 0.058, r: 0.0075, sp: -0.16 },
    ];
    // ENGINE-FIX tris: finger and thumb capsules were radial 8, cap 3 (the hand was 2,800 triangles)
    for (const [i, f] of fingers.entries()) {
      const base = new THREE.Vector3(f.x * thumbSide * S, 0.088 * S, 0.0);
      const a1 = curl * 1.35 + 0.12 + i * 0.03 * curl, a2 = curl * 1.55 + 0.14;
      const sp = f.sp * spread * thumbSide * (1 - curl * 0.6);
      // direction after the knuckle: rotate +Y about X by a1 (toward +Z), then about Z by -sp
      const d1 = new THREE.Vector3(0, Math.cos(a1), Math.sin(a1)).applyAxisAngle(new THREE.Vector3(0, 0, 1), -sp);
      const d2 = new THREE.Vector3(0, Math.cos(a1 + a2), Math.sin(a1 + a2)).applyAxisAngle(new THREE.Vector3(0, 0, 1), -sp);
      const l1 = f.len * 0.55 * S, l2 = f.len * 0.45 * S;
      const m = base.clone().addScaledVector(d1, l1);
      const e = m.clone().addScaledVector(d2, l2);
      parts.push(capsuleAB(base.toArray(), m.toArray(), f.r * S, f.r * 0.94 * S, { radial: 6, cap: 2 }));
      parts.push(capsuleAB(m.toArray(), e.toArray(), f.r * 0.92 * S, f.r * 0.8 * S, { radial: 6, cap: 2 }));
    }
    // thumb: from the heel of the palm, out to the side, curling across the palm
    const tb = new THREE.Vector3(0.026 * thumbSide * S, 0.024 * S, 0.008 * S);
    const tOpen = new THREE.Vector3(0.75 * thumbSide, 0.72, 0.3).normalize();
    const tCurl = new THREE.Vector3(-0.25 * thumbSide, 0.55, 0.8).normalize();
    const td1 = tOpen.clone().lerp(tCurl, curl * 0.75).normalize();
    const td2 = tOpen.clone().lerp(tCurl, Math.min(1, curl * 1.2 + 0.15)).normalize();
    const tm = tb.clone().addScaledVector(td1, 0.036 * S);
    const te = tm.clone().addScaledVector(td2, 0.03 * S);
    parts.push(capsuleAB(tb.toArray(), tm.toArray(), 0.0105 * S, 0.0095 * S, { radial: 6, cap: 2 }));
    parts.push(capsuleAB(tm.toArray(), te.toArray(), 0.009 * S, 0.008 * S, { radial: 6, cap: 2 }));
    for (const p of parts) paint(p, hex);
    return merge(parts);
  };
  const keys = [0, 0.5, 1].map(snapshot);
  const geo = keys[0].clone();
  const P = keys.map((k) => k.attributes.position.array);
  const N = keys.map((k) => k.attributes.normal.array);
  const pos = geo.attributes.position.array, nor = geo.attributes.normal.array;
  geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
  geo.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  let last = -1;
  const setCurl = (k) => {
    k = clamp(k, 0, 1);
    if (Math.abs(k - last) < 0.004) return;
    last = k;
    const seg = k < 0.5 ? 0 : 1, f = k < 0.5 ? k / 0.5 : (k - 0.5) / 0.5;
    const A = P[seg], B = P[seg + 1], NA = N[seg], NB = N[seg + 1];
    for (let i = 0; i < pos.length; i++) { pos[i] = A[i] + (B[i] - A[i]) * f; nor[i] = NA[i] + (NB[i] - NA[i]) * f; }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
  };
  geo.computeBoundingSphere();
  geo.boundingSphere.radius += 0.05 * S;
  setCurl(0.3);
  return { geo, setCurl };
}

// ------------------------------------------------------------------------------------------------------------
// Effects: haze sprite, hem mist, motes (all unclickable, additive, drawn after the figure)
// ------------------------------------------------------------------------------------------------------------

export function makeHaze(color, w, h) {
  const m = new THREE.SpriteMaterial({
    map: blobTex(), color: new THREE.Color(color), transparent: true, opacity: 0.2,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: true,
  });
  m.userData.noHighlight = true;
  const s = new THREE.Sprite(m);
  s.scale.set(w, h, 1);
  s.renderOrder = 2;
  return noRaycast(s);
}

/**
 * Point cloud of soft puffs (mist at the hem, motes around the figure). Positions/colours are written by the owner
 * each frame through `pts.userData.pos` / `.col` and `pts.userData.commit()`.
 */
export function makePuffs(n, size, { sizeAttenuation = true } = {}) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const m = new THREE.PointsMaterial({
    map: blobTex(), size, sizeAttenuation, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: true,
  });
  m.userData.noHighlight = true;
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.renderOrder = 2;
  pts.userData.pos = pos;
  pts.userData.col = col;
  pts.userData.commit = () => { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; };
  return noRaycast(pts);
}

/** Collect every ghost ShaderMaterial in a subtree (for dispose). */
export function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose?.();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) m.dispose?.();
  });
}

// ------------------------------------------------------------------------------------------------------------
// Arm targets and the arm rig (two-bone IK + an oriented, curling hand)
// ------------------------------------------------------------------------------------------------------------

/**
 * An arm target, in the torso frame the arm hangs from: W wrist position, F finger direction, N palm normal,
 * P elbow pole (where the elbow points), C hand curl 0..1.
 */
export function T(W, F, N, P, C = 0.3) {
  return { W: new THREE.Vector3(...W), F: new THREE.Vector3(...F).normalize(), N: new THREE.Vector3(...N).normalize(), P: new THREE.Vector3(...P).normalize(), C };
}
/** The same target for the other arm (mirrored in X). */
export function mirrorT(t) {
  const m = (v) => new THREE.Vector3(-v.x, v.y, v.z);
  return { W: m(t.W), F: m(t.F), N: m(t.N), P: m(t.P), C: t.C };
}
export function copyT(dst, src) {
  dst.W.copy(src.W); dst.F.copy(src.F); dst.N.copy(src.N); dst.P.copy(src.P); dst.C = src.C;
  return dst;
}
/** dst = lerp(dst, src, k) (vectors renormalised) */
export function lerpT(dst, src, k) {
  if (k <= 0) return dst;
  dst.W.lerp(src.W, k); dst.F.lerp(src.F, k).normalize(); dst.N.lerp(src.N, k).normalize();
  dst.P.lerp(src.P, k).normalize(); dst.C += (src.C - dst.C) * k;
  return dst;
}
export function newT() { return T([0, 0, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], 0.3); }

export class ArmRig {
  /**
   * @param {{ side: number, shoulder: THREE.Vector3, a: number, b: number, upper: THREE.Object3D,
   *           fore: THREE.Object3D, hand: THREE.Object3D, setCurl: (k:number)=>void }} o
   */
  constructor(o) {
    Object.assign(this, o);
    this.cur = newT();
    this.elbow = new THREE.Vector3();
    this.wrist = new THREE.Vector3();
    this._smoothed = false;
  }

  /** Solve and place the meshes for target t (in the parent frame of the meshes). `lag` smooths toward it. */
  apply(t, dt = 0, lag = 0) {
    const c = this.cur;
    if (!this._smoothed || lag <= 0) { copyT(c, t); this._smoothed = true; }
    else lerpT(c, t, 1 - Math.exp(-lag * dt));
    ik2(this.shoulder, c.W, this.a, this.b, c.P, this.elbow, this.wrist);
    orientSegment(this.upper, this.shoulder, this.elbow);
    orientSegment(this.fore, this.elbow, this.wrist);
    this.hand.position.copy(this.wrist);
    orientBasis(this.hand, c.F, c.N);
    this.setCurl(c.C);
  }
}

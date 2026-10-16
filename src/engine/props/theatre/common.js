// Shared helpers for the theatre prop modules (PROPS). Not part of the public catalogue except where re-exported
// from theatre.js (bulbSet, textPlate, catenary, mergeInto, ropeLine).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as M from '../materials.js';
import { roundedBoxGeometry } from '../furniture.js';
import { labelPlate, ropeTexture } from '../theatre-textures.js';
import { rng as _rng } from '../textures.js';

export const TAU = Math.PI * 2;
export { THREE, M, roundedBoxGeometry };

/** Mesh with shadows on. */
export function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
/** Never raycast (glows, halos, beams). */
export function noRay(o) { o.raycast = () => {}; o.userData.noRaycast = true; return o; }
export function grp(name) { const g = new THREE.Group(); g.name = name; return g; }
/** Position (and optionally rotate) an object; returns it. */
export function at(o, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; }
/** Bevelled box geometry translated to (x,y,z). */
export function boxG(w, h, d, x = 0, y = 0, z = 0, r = 0.004) {
  if (r <= 0.0015) return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  return roundedBoxGeometry(w, h, d, r, r >= 0.012 ? 2 : 1).clone().translate(x, y, z);
}
export function cylG(rt, rb, h, seg = 16, x = 0, y = 0, z = 0, open = false) { return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open).translate(x, y, z); }
export function latheG(points, seg = 24) { return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(Math.max(1e-4, x), y)), seg); }

/** Normalise geometries so mergeGeometries accepts them (non-indexed; position/normal/uv only). */
function prep(g) {
  let h = g.index ? g.toNonIndexed() : g.clone();
  for (const n of Object.keys(h.attributes)) if (!['position', 'normal', 'uv'].includes(n)) h.deleteAttribute(n);
  if (!h.attributes.normal) h.computeVertexNormals();
  if (!h.attributes.uv) h.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
  h.clearGroups();
  return h;
}
/** Merge a list of geometries into one (one draw call). Disposes the prepared copies. */
export function mergeG(geos) {
  const list = geos.filter(Boolean).map(prep);
  const m = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  return m;
}
/** Merge geometries into a mesh with `mat`. */
export function mergeInto(geos, mat, opts) { return mesh(mergeG(geos), mat, opts); }

/**
 * Loft: a tube through elliptical cross-sections, top to bottom. sections: [{ y, rx, rz, x?, z?, f? }] where f is
 * the fold amplitude (m) at that section (cloth). arc: [a0, a1] angular range (θ = 0 faces +Z) for open fronts.
 * capTop / capBottom close the ends. Returns an indexed BufferGeometry with outward normals and uvs (u round, v down).
 */
export function loftG(sections, { seg = 32, seed = 1, arc = [0, TAU], folds = [5, 9, 14], capTop = false, capBottom = false, uScale = 2 } = {}) {
  const r = _rng(seed), ph = folds.map(() => r() * TAU);
  const [a0, a1] = arc, closed = a1 - a0 >= TAU - 1e-6, row = seg + 1;
  const pos = [], uv = [], idx = [];
  let v = 0;
  sections.forEach((s, j) => {
    if (j) { const p = sections[j - 1]; v += Math.hypot(s.y - p.y, s.rx - p.rx); }
    for (let i = 0; i <= seg; i++) {
      const th = a0 + (a1 - a0) * i / seg;
      let f = 0;
      if (s.f) folds.forEach((k, m) => { f += Math.sin(th * k + ph[m] + j * 0.37 * (m + 1)) / (m + 1); });
      const fo = (s.f || 0) * f;
      pos.push((s.x || 0) + Math.sin(th) * (s.rx + fo), s.y, (s.z || 0) + Math.cos(th) * (s.rz + fo * (s.rz / Math.max(1e-4, s.rx))));
      uv.push(i / seg * uScale, v);
    }
  });
  for (let j = 0; j < sections.length - 1; j++) for (let i = 0; i < seg; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const cap = (j, up) => {
    const s = sections[j], ci = pos.length / 3;
    pos.push(s.x || 0, s.y, s.z || 0); uv.push(0.5, up ? 0 : v);
    for (let i = 0; i < seg; i++) { const p = j * row + i; if (up) idx.push(ci, p, p + 1); else idx.push(ci, p + 1, p); }
  };
  if (capTop) cap(0, true);
  if (capBottom) cap(sections.length - 1, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  if (closed) { // weld the seam normals
    const n = geo.attributes.normal;
    for (let j = 0; j < sections.length; j++) {
      const a = j * row, b = a + seg;
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
    }
  }
  return geo;
}

/** Points along a hanging catenary-ish curve from a to b, sagging `sag` metres at the middle. */
export function catenary(a, b, sag = 0.1, n = 16) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = A.clone().lerp(B, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return pts;
}

/** Tube geometry along points (Vector3 or [x,y,z]). */
export function tubeG(points, r = 0.01, { seg = 0, radial = 8, closed = false, tension = 0.5 } = {}) {
  const pts = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
  const curve = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', tension);
  return new THREE.TubeGeometry(curve, seg || Math.max(8, pts.length * 6), r, radial, closed);
}

const ropeMats = new Map();
/** Hemp rope material (twist texture). */
export function ropeMat(tint = '#a88c5c') {
  if (!ropeMats.has(tint)) {
    const t = ropeTexture({ tint }).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 60); t.needsUpdate = true;
    ropeMats.set(tint, new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
  }
  return ropeMats.get(tint);
}
/** A hemp rope from a to b with a sag. Returns a Mesh. */
export function ropeLine(a, b, { r = 0.012, sag = 0.05, tint } = {}) {
  return mesh(tubeG(catenary(a, b, sag, 12), r, { radial: 6 }), ropeMat(tint), { cast: true, receive: false });
}

/** A flat label/plate mesh (labelPlate texture) of width w (m); height from the canvas aspect. */
export function textPlate(text, w = 0.2, opts = {}) {
  const { pw = 512, ph = 128, emissive = false, glow = 1, metal = opts.style === 'brass' } = opts;
  const tex = labelPlate(text, { w: pw, h: ph, ...opts });
  const mat = emissive
    ? new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1, 1, 1).multiplyScalar(glow), toneMapped: false })
    : new THREE.MeshStandardMaterial({ map: tex, roughness: metal ? 0.35 : 0.7, metalness: metal ? 0.7 : 0 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * ph / pw), mat);
  m.receiveShadow = true;
  return m;
}

/** A plane with an arbitrary texture (papers, posters). */
export function texPlane(w, h, map, { side = THREE.FrontSide, roughness = 0.85, transparent = false, alphaTest = 0 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness, side, transparent, alphaTest }));
  m.receiveShadow = true;
  return m;
}

const BULB_ON = new THREE.Color('#ffd9a0');
/**
 * A set of bulbs as ONE InstancedMesh (one draw call). Each bulb's brightness is its instance colour.
 * positions: [[x,y,z], ...]; r: bulb radius; color: lit colour; intensity: lit brightness (>1 blooms);
 * shape: 'round' | 'candle' | 'pear'; lit: initial level 0..1.
 * Returns the InstancedMesh with userData: { setBulb(i, level), setAll(level), levels[], count }.
 */
export function bulbSet(positions, { r = 0.02, color = BULB_ON, intensity = 2.4, offColor = '#3a342a', shape = 'round', lit = 1, seg = 12 } = {}) {
  let geo;
  if (shape === 'candle') geo = latheG([[0, 0], [r * 0.6, 0.001], [r * 0.75, r * 0.9], [r * 0.6, r * 1.9], [r * 0.15, r * 2.6], [0, r * 2.7]], 10);
  else if (shape === 'pear') geo = latheG([[0, 0], [r * 0.35, 0], [r * 0.4, r * 0.5], [r * 0.95, r * 1.3], [r, r * 1.8], [r * 0.7, r * 2.4], [0, r * 2.55]], 12).translate(0, -r * 2.55, 0);
  else geo = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4));
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const im = new THREE.InstancedMesh(geo, mat, positions.length);
  const m4 = new THREE.Matrix4();
  positions.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m4); });
  const on = new THREE.Color(color).multiplyScalar(intensity), off = new THREE.Color(offColor), c = new THREE.Color();
  const levels = positions.map(() => lit);
  const apply = (i) => { c.copy(off).lerp(on, levels[i]); im.setColorAt(i, c); };
  levels.forEach((_, i) => apply(i));
  im.instanceColor.needsUpdate = true;
  im.userData.levels = levels;
  im.userData.count = positions.length;
  im.userData.setBulb = (i, level) => { levels[i] = level === true ? 1 : level === false ? 0 : level; apply(i); im.instanceColor.needsUpdate = true; };
  im.userData.setAll = (level) => { for (let i = 0; i < levels.length; i++) { levels[i] = level; apply(i); } im.instanceColor.needsUpdate = true; };
  im.userData.setColor = (col, inten = intensity) => { on.set(col).multiplyScalar(inten); levels.forEach((_, i) => apply(i)); im.instanceColor.needsUpdate = true; };
  im.castShadow = false; im.receiveShadow = false;
  return im;
}

/** Soft additive halo sprite (a camera-facing glow) for lamps; scale it. Returns a Sprite (noRaycast). */
let haloTex = null;
export function halo(color = '#ffd9a0', size = 0.4, opacity = 0.6) {
  if (!haloTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    haloTex = new THREE.CanvasTexture(c); haloTex.colorSpace = THREE.SRGBColorSpace;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.scale.setScalar(size);
  s.userData.baseOpacity = opacity;
  s.renderOrder = 7;
  return noRay(s);
}

/** Soft additive cone (a lamp's beam), apex at the origin pointing down -Y; length, radius. */
export function beamCone(length = 3, radius = 0.8, color = '#fff2d0', opacity = 0.12) {
  const geo = new THREE.ConeGeometry(radius, length, 32, 1, true).translate(0, -length / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uLen: { value: length } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uLen; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float along = clamp(-vY / uLen, 0.0, 1.0); float fall = (1.0 - along) * smoothstep(0.0, 0.08, along);
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
        gl_FragColor = vec4(uColor * uOpacity * fall * edge, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const m = noRay(new THREE.Mesh(geo, mat));
  m.renderOrder = 5;
  m.userData.setOpacity = (o) => { mat.uniforms.uOpacity.value = o; };
  return m;
}

/** A unique emissive-capable material for glass that lights up (lamp lenses, jewels). level 0..1 via setLevel. */
export function glowGlass(color = '#ffd9a0', { opacity = 0.9, intensity = 2.5, offColor = '#2a2420', roughness = 0.2 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: offColor, emissive: new THREE.Color(color), emissiveIntensity: 0, roughness, transparent: opacity < 1, opacity });
  mat.userData.setLevel = (k) => { mat.emissiveIntensity = k * intensity; mat.color.set(offColor).lerp(new THREE.Color(color), k * 0.6); };
  return mat;
}

/** Smoothly chase a value inside update: returns the new value. */
export function chase(cur, target, dt, rate = 6) { return cur + (target - cur) * Math.min(1, dt * rate); }

/** Instanced mesh from a geometry + list of { p:[x,y,z], r:[x,y,z], s:[x,y,z]|number, c:colour }. */
export function instances(geo, mat, list, { cast = true, receive = true } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const o = new THREE.Object3D();
  list.forEach((it, i) => {
    o.position.set(...(it.p || [0, 0, 0])); o.rotation.set(...(it.r || [0, 0, 0]));
    if (typeof it.s === 'number') o.scale.setScalar(it.s); else o.scale.set(...(it.s || [1, 1, 1]));
    o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    if (it.c) im.setColorAt(i, new THREE.Color(it.c));
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = cast; im.receiveShadow = receive;
  return im;
}

/** Deterministic PRNG (re-export). */
export { rng } from '../textures.js';

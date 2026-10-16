// Dressing Room No. 1 (SET-dressing). buildSet(ctx, group) builds the whole room into `group` (world coords: floor
// centre at the origin; the dressing table against the north wall at -Z; the wardrobe, photograph and window on the
// west wall at -X; the chaise along the east wall at +X; the room door on the south wall behind the vantage, seen only
// in the mirror) and returns `handles`: every object the puzzles touch and every delight, with animation hooks and
// focus framings. index.js registers hotspots against these handles; PUZZLES wires the mechanics.
// See docs/notes/set-dressing.md.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as T from '../../engine/props/theatre.js';
import * as Lt from '../../engine/props/lights.js';
import * as P from '../../engine/props/particles.js';
import { mesh, noRay, grp, at, boxG, cylG, latheG, tubeG, mergeG, mergeInto, TAU } from '../../engine/props/theatre/common.js';
import { makeCanvas, canvasTexture, rng } from '../../engine/props/textures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as D from './props.js';

const FONTS = T.FONTS;
export const ROOM = { x0: -2.1, x1: 2.1, z0: -2.0, z1: 2.0, H: 3.2 };
export const VANTAGE = { position: [0.1, 1.45, 0.95], lookAt: [-0.04, 1.0, -2.0], fov: 60 };
const DADO = 0.9, RAIL = 2.45, FRIEZE = 3.05;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const keep = (o) => { o.userData.keep = true; return o; };

// placements (world)
export const PLACE = {
  table: v3(-0.25, 0, -1.71),
  sideTable: v3(1.0, 0, -1.74),
  chaise: v3(1.74, 0, -0.75),
  wardrobe: v3(-1.79, 0, -0.97),
  stand: v3(-1.42, 0, -1.74),
  window: v3(-2.1, 1.55, 0.75),
  photo: v3(-2.1, 1.62, 0.07),
  sign: v3(-2.1, 1.56, -0.25),
};

// =====================================================================================================
// small helpers
// =====================================================================================================
function cv(w, h) { const c = makeCanvas(w, h); return [c, c.getContext('2d')]; }
/** Invisible pick box (a hit proxy). */
function proxy(w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.userData.hitProxy = true; m.castShadow = false; m.receiveShadow = false;
  return m;
}
/** A proxy fitted to obj's world AABB, added to `parent` (the room group at the origin). */
function aabbProxy(parent, obj, pad = 0.015, shrink = null) {
  obj.updateWorldMatrix(true, true);
  const b = new THREE.Box3().setFromObject(obj, true), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  if (shrink) { s.multiply(shrink); }
  const p = proxy(s.x + pad * 2, s.y + pad * 2, s.z + pad * 2); p.position.copy(c); parent.add(p);
  p.name = `hit:${obj.name}`;
  return p;
}
/** A focus framing looking at obj's centre from `dist` m away, toward the vantage side, raised by `up` m. */
function frame(obj, { dist = 0.8, up = 0.25, toward = v3(...VANTAGE.position), lookUp = 0, side = 0 } = {}) {
  obj.updateWorldMatrix(true, true);
  const c = new THREE.Box3().setFromObject(obj, true).getCenter(new THREE.Vector3());
  c.y += lookUp;
  const dir = toward.clone().sub(c); dir.y = 0; dir.normalize();
  const sideV = v3(-dir.z, 0, dir.x);
  const pos = c.clone().addScaledVector(dir, dist).addScaledVector(sideV, side); pos.y += up;
  return { position: pos.toArray().map((n) => +n.toFixed(3)), lookAt: c.toArray().map((n) => +n.toFixed(3)) };
}
const ease = {
  inOut: (t) => t * t * (3 - 2 * t),
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t * t,
  back: (t) => { const s = 1.9; const u = t - 1; return 1 + (s + 1) * u ** 3 + s * u ** 2; },
  bounce: (t) => { // falls and settles with two small bounces (a heavy frame on its stops)
    if (t < 0.6) return (t / 0.6) ** 2;
    if (t < 0.85) { const u = (t - 0.725) / 0.125; return 1 - 0.06 * (1 - u * u); }
    const u = (t - 0.925) / 0.075; return 1 - 0.015 * (1 - u * u);
  },
};
/** A tiny tween runner on an Object3D whose userData.update the Room collects. tween(dur, fn(k), ease, key) → Promise. */
function makeTweener(group) {
  const live = new Set();
  const o = new THREE.Object3D(); o.name = 'dressingTweens';
  o.userData.update = (dt) => {
    for (const tw of [...live]) {
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      tw.fn(tw.ease(tw.t));
      if (tw.t >= 1) { live.delete(tw); tw.resolve(); }
    }
  };
  group.add(o);
  return (dur, fn, e = ease.inOut, key = null) => new Promise((resolve) => {
    if (key) for (const tw of live) if (tw.key === key) { live.delete(tw); tw.resolve(); }
    if (!(dur > 0)) { fn(1); resolve(); return; }
    live.add({ t: 0, dur, fn, ease: e, resolve, key });
  });
}

// =====================================================================================================
// SURFACES: walls in bands (cream dado, lily paper, deep-rose frieze), grime in vertex colours
// =====================================================================================================
let _friezeTex = null;
function friezeTex() {
  if (_friezeTex) return _friezeTex;
  const W = 1024, H = 512, [c, g] = cv(W, H), r = rng(301);
  g.fillStyle = '#a77670'; g.fillRect(0, 0, W, H);
  // smoke darkening toward the cornice
  const sm = g.createLinearGradient(0, 0, 0, H); sm.addColorStop(0, 'rgba(60,34,30,0.35)'); sm.addColorStop(0.6, 'rgba(60,34,30,0.08)'); sm.addColorStop(1, 'rgba(60,34,30,0)');
  g.fillStyle = sm; g.fillRect(0, 0, W, H);
  // a stencilled ribbon-and-lily garland, cream, just above the picture rail
  const y0 = H * 0.66;
  g.strokeStyle = 'rgba(236,214,196,0.75)'; g.lineWidth = 5;
  for (let i = 0; i < 2; i++) { const x0 = i * W / 2, x1 = x0 + W / 2; g.beginPath(); g.moveTo(x0, y0 - 40); g.quadraticCurveTo((x0 + x1) / 2, y0 + 70, x1, y0 - 40); g.stroke(); }
  g.fillStyle = 'rgba(236,214,196,0.8)';
  for (let i = 0; i <= 2; i++) { const x = i * W / 2; g.beginPath(); g.arc(x, y0 - 44, 12, 0, TAU); g.fill(); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * 24, y0 - 30, 18, 6, s * 0.6, 0, TAU); g.fill(); } }
  for (let i = 0; i < 2; i++) {
    const x = i * W / 2 + W / 4;
    g.save(); g.translate(x, y0 + 12); g.fillStyle = 'rgba(240,222,204,0.85)';
    for (const a of [-0.9, 0, 0.9]) { g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-16, -40, -4, -70); g.quadraticCurveTo(12, -60, 14, -46); g.quadraticCurveTo(8, -20, 0, 0); g.fill(); g.restore(); }
    g.restore();
  }
  // a fine double line at the bottom
  g.fillStyle = 'rgba(232,206,180,0.6)'; g.fillRect(0, H - 22, W, 3); g.fillRect(0, H - 12, W, 2);
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(40,20,16,0.08)' : 'rgba(255,236,220,0.05)'; g.fillRect(r() * W, r() * H, 2, 2); }
  _friezeTex = canvasTexture(c, { repeat: [1, 1] });
  return _friezeTex;
}

const WALLS = {
  N: { pos: [0, 0, ROOM.z0], ry: 0, len: ROOM.x1 - ROOM.x0 },
  S: { pos: [0, 0, ROOM.z1], ry: Math.PI, len: ROOM.x1 - ROOM.x0 },
  W: { pos: [ROOM.x0, 0, 0], ry: Math.PI / 2, len: ROOM.z1 - ROOM.z0 },
  E: { pos: [ROOM.x1, 0, 0], ry: -Math.PI / 2, len: ROOM.z1 - ROOM.z0 },
};
// holes per wall in wall-local (a, y): the window on the west wall (world z 0.4..1.1 → a = -z)
const WIN = { a0: -1.1, a1: -0.4, y0: 1.05, y1: 2.05 };
const HOLES = { W: [WIN] };

const n1 = D.noise2(7), n2 = D.noise2(19), n3 = D.noise2(31);
const sstep = (e0, e1, x) => { const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
/** Grime as a multiplier colour for a wall point. */
function wallGrime(id, a, y, len) {
  let k = 1;
  k -= 0.10 * (n1(a * 1.1 + id.charCodeAt(0), y * 1.1) - 0.3);
  k -= 0.08 * n2(a * 3.3, y * 3.3);
  k -= 0.22 * (1 - sstep(0, 0.45, y));           // kicked and scuffed low down
  k -= 0.26 * sstep(2.3, 3.2, y);                // smoke under the ceiling
  const ce = Math.min(Math.abs(a + len / 2), Math.abs(a - len / 2));
  k -= 0.2 * (1 - sstep(0, 0.5, ce));            // corners
  // drips from the picture rail
  const drip = Math.max(0, n3(a * 6, 0.5) - 0.62) * 2.2 * sstep(1.2, 2.4, y);
  k -= 0.18 * drip;
  let r = k, g = k * 0.975, b = k * 0.95;
  if (id === 'W') {
    // the window: a water stain below the sill, soot fanned up from the radiator
    const da = a - (WIN.a0 + WIN.a1) / 2;
    const stain = Math.exp(-(da * da) / 0.18) * sstep(1.05, 0.55, y) * sstep(0.2, 0.6, y);
    r -= 0.16 * stain; g -= 0.12 * stain; b -= 0.06 * stain;
    const soot = Math.exp(-(da * da) / 0.25) * sstep(0.7, 1.0, y) * (1 - sstep(1.0, 2.4, y));
    r -= 0.1 * soot; g -= 0.1 * soot; b -= 0.1 * soot;
  }
  if (id === 'N') {
    // warmer and darker round the mirror: thirty years of greasepaint, powder and hot bulbs
    const da = a - PLACE.table.x;
    const halo = Math.exp(-(da * da) / 0.5) * Math.exp(-((y - 1.3) ** 2) / 0.6);
    r -= 0.05 * halo; g -= 0.08 * halo; b -= 0.12 * halo;
  }
  return [Math.max(0.35, r), Math.max(0.33, g), Math.max(0.3, b)];
}
/** One horizontal band of one wall (y0..y1), minus holes, subdivided, UVs in metres / uvScale. */
function wallBand(id, y0, y1, { uvScale = 0.52, vOrigin = 0, uvScaleY = uvScale, cell = 0.12 } = {}) {
  const { len } = WALLS[id], holes = (HOLES[id] || []).filter((h) => h.y1 > y0 && h.y0 < y1);
  const xs = [-len / 2, len / 2]; for (const h of holes) xs.push(h.a0, h.a1);
  xs.sort((p, q) => p - q);
  const geos = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const xa = xs[i], xb = xs[i + 1]; if (xb - xa < 1e-4) continue;
    const mid = (xa + xb) / 2;
    let spans = [[y0, y1]];
    for (const h of holes) if (mid > h.a0 && mid < h.a1) spans = spans.flatMap(([s0, s1]) => [[s0, Math.min(s1, h.y0)], [Math.max(s0, h.y1), s1]].filter(([p, q]) => q - p > 1e-4));
    for (const [s0, s1] of spans) {
      const w = xb - xa, h = s1 - s0;
      const geo = new THREE.PlaneGeometry(w, h, Math.max(1, Math.ceil(w / cell)), Math.max(1, Math.ceil(h / cell))).translate(mid, (s0 + s1) / 2, 0);
      const p = geo.attributes.position, uv = geo.attributes.uv, col = new Float32Array(p.count * 3);
      for (let k = 0; k < p.count; k++) {
        const a = p.getX(k), y = p.getY(k);
        uv.setXY(k, a / uvScale, (y - vOrigin) / uvScaleY);
        const [r, g, b] = wallGrime(id, a, y, len); col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geos.push(geo);
    }
  }
  return mergeGeometries(geos, false); // keeps the colour attribute (mergeG strips it)
}
function wallGroup(id) {
  const w = WALLS[id], g = grp(`wall${id}`);
  g.position.set(...w.pos); g.rotation.y = w.ry;
  return g;
}

function buildShell(group) {
  const paper = new THREE.MeshStandardMaterial({ map: D.wallpaperTex(), vertexColors: true, roughness: 0.88 });
  const dado = new THREE.MeshStandardMaterial({ color: '#dccbab', vertexColors: true, roughness: 0.55 });
  const frieze = new THREE.MeshStandardMaterial({ map: friezeTex(), vertexColors: true, roughness: 0.92 });
  const cream = M.enamel('#e2d2b0', { roughness: 0.45, metalness: 0 });
  const skirt = M.enamel('#6a4a38', { roughness: 0.4, metalness: 0 });
  // cornice profile (x: out from the wall, y: height), extruded along the wall
  const cs = new THREE.Shape();
  cs.moveTo(0, FRIEZE - 0.01); cs.lineTo(0.02, FRIEZE - 0.01); cs.lineTo(0.022, FRIEZE + 0.01); cs.quadraticCurveTo(0.03, 3.13, 0.11, 3.16); cs.lineTo(0.13, 3.165); cs.lineTo(0.135, ROOM.H); cs.lineTo(0, ROOM.H); cs.closePath();
  for (const id of Object.keys(WALLS)) {
    const g = wallGroup(id), { len } = WALLS[id];
    group.add(g);
    g.add(mesh(wallBand(id, 0.17, DADO, { uvScale: 1 }), dado, { cast: false }));
    g.add(mesh(wallBand(id, DADO, RAIL), paper, { cast: false }));
    g.add(mesh(wallBand(id, RAIL, FRIEZE, { uvScale: len / Math.round(len / 1.1), uvScaleY: FRIEZE - RAIL, vOrigin: RAIL }), frieze, { cast: false }));
    // skirting, chair rail, picture rail
    const segs = [];
    const xs = [-len / 2, len / 2];
    segs.push(boxG(len, 0.17, 0.022, 0, 0.085, 0.011, 0.004), boxG(len, 0.018, 0.03, 0, 0.17, 0.015, 0.006));
    const crs = [[-len / 2, len / 2]];
    const holes = HOLES[id] || [];
    let runs = crs; for (const h of holes) if (h.y0 < DADO + 0.03 && h.y1 > DADO) runs = runs.flatMap(([p, q]) => [[p, h.a0], [h.a1, q]]);
    for (const [p, q] of runs) segs.push(boxG(q - p, 0.045, 0.026, (p + q) / 2, DADO, 0.013, 0.008), boxG(q - p, 0.012, 0.034, (p + q) / 2, DADO + 0.02, 0.017, 0.004));
    g.add(mergeInto(segs.filter((s, i) => i >= 2), cream, { cast: false }));
    g.add(mergeInto(segs.slice(0, 2), skirt, { cast: false }));
    g.add(mergeInto([boxG(len, 0.03, 0.024, 0, RAIL, 0.012, 0.006), boxG(len, 0.01, 0.03, 0, RAIL + 0.016, 0.015, 0.003)], cream, { cast: false }));
    // dado panels: a raised moulding every ~0.7 m
    const n = Math.round(len / 0.72), pw = len / n, pm = [];
    for (let i = 0; i < n; i++) {
      const cx = -len / 2 + pw * (i + 0.5), w = pw - 0.12, y0 = 0.28, y1 = DADO - 0.1, hy = (y0 + y1) / 2;
      pm.push(boxG(w, 0.014, 0.012, cx, y0, 0.006, 0.003), boxG(w, 0.014, 0.012, cx, y1, 0.006, 0.003), boxG(0.014, y1 - y0, 0.012, cx - w / 2, hy, 0.006, 0.003), boxG(0.014, y1 - y0, 0.012, cx + w / 2, hy, 0.006, 0.003));
    }
    g.add(mergeInto(pm, cream, { cast: false }));
    // cornice
    const cg = new THREE.ExtrudeGeometry(cs, { depth: len + 0.3, bevelEnabled: false, curveSegments: 6 }).rotateY(-Math.PI / 2).translate(len / 2 + 0.15, 0, 0);
    g.add(mesh(cg, cream, { cast: false }));
    void xs;
  }
  // floor: old boards, darker at the walls; a rug over most of the middle
  const RW = ROOM.x1 - ROOM.x0, RD = ROOM.z1 - ROOM.z0;
  const fgeo = new THREE.PlaneGeometry(RW, RD, 22, 22).rotateX(-Math.PI / 2);
  const fp = fgeo.attributes.position, fc = new Float32Array(fp.count * 3);
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i), e = Math.min(RW / 2 - Math.abs(x), RD / 2 - Math.abs(z));
    const k = 0.62 + 0.38 * sstep(0, 0.7, e) - 0.08 * n1(x * 1.5, z * 1.5);
    fc[i * 3] = k; fc[i * 3 + 1] = k * 0.96; fc[i * 3 + 2] = k * 0.92;
  }
  fgeo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  const floorMat = M.floorboards({ repeat: [1.6, 1.6], unique: true }); floorMat.vertexColors = true; floorMat.color = new THREE.Color('#9a7a64');
  group.add(mesh(fgeo, floorMat, { cast: false }));
  const rug = mesh(new THREE.PlaneGeometry(2.0, 2.6, 1, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ map: D.rugTex(), roughness: 0.97 }), { cast: false });
  rug.position.set(0.05, 0.005, -0.62); rug.rotation.y = 0.02; group.add(rug);
  // ceiling: plaster with a brown water stain over the window corner, a plaster rose
  const cgeo = new THREE.PlaneGeometry(RW, RD, 16, 16).rotateX(Math.PI / 2).translate(0, ROOM.H, 0);
  const cp = cgeo.attributes.position, cc = new Float32Array(cp.count * 3);
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), z = cp.getZ(i), st = Math.exp(-((x + 1.7) ** 2 + (z - 0.8) ** 2) / 0.5);
    const k = 0.85 - 0.12 * n2(x, z);
    cc[i * 3] = k - 0.18 * st; cc[i * 3 + 1] = k - 0.24 * st; cc[i * 3 + 2] = k - 0.34 * st;
  }
  cgeo.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  const ceil = M.plaster({ tint: '#e4d6c0', repeat: [2, 2], unique: true }); ceil.vertexColors = true;
  group.add(mesh(cgeo, ceil, { cast: false }));
  group.add(at(mesh(latheG([[0, 0], [0.3, 0], [0.29, -0.015], [0.24, -0.02], [0.22, -0.035], [0.12, -0.04], [0.1, -0.06], [0.04, -0.07], [0, -0.075]], 40), cream, { cast: false }), 0.05, ROOM.H, 0.15));
  return { paper };
}

// =====================================================================================================
// THE WINDOW onto the brick wall: reveal, sash with rain, sill, curtains, the wall a metre away, rain falling
// =====================================================================================================
function rainStreakTex() {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(411);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) {
    const x = r() * W, y = r() * H, l = 30 + r() * 70;
    const gr = g.createLinearGradient(x, y, x, y + l); gr.addColorStop(0, 'rgba(200,214,230,0)'); gr.addColorStop(1, `rgba(200,214,230,${0.25 + r() * 0.35})`);
    g.strokeStyle = gr; g.lineWidth = 1 + r() * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + l); g.stroke();
  }
  return canvasTexture(c, { repeat: [2, 1.5] });
}
function buildWindow(group) {
  const g = grp('window'); g.position.copy(PLACE.window); g.rotation.y = Math.PI / 2; group.add(g);
  const W = WIN.a1 - WIN.a0, H = WIN.y1 - WIN.y0, DEP = 0.24;
  const cream = M.enamel('#e2d2b0', { roughness: 0.45, metalness: 0 });
  // reveal (the wall's thickness) and a deep sill board
  g.add(mergeInto([
    boxG(W + 0.04, 0.02, DEP, 0, H / 2 + 0.01, -DEP / 2, 0.002), boxG(0.02, H, DEP, -W / 2 - 0.01, 0, -DEP / 2, 0.002), boxG(0.02, H, DEP, W / 2 + 0.01, 0, -DEP / 2, 0.002),
    boxG(W + 0.16, 0.035, DEP + 0.08, 0, -H / 2 - 0.0175, -DEP / 2 + 0.04, 0.008),
    // architrave
    boxG(0.07, H + 0.1, 0.02, -W / 2 - 0.035, 0.03, 0.01, 0.004), boxG(0.07, H + 0.1, 0.02, W / 2 + 0.035, 0.03, 0.01, 0.004), boxG(W + 0.2, 0.07, 0.022, 0, H / 2 + 0.07, 0.011, 0.004),
  ], cream));
  const pane = T.rainPane({ w: W, h: H, bars: [2, 3], beyond: null, frame: true, speed: 0.22 });
  pane.position.set(0, 0, -DEP + 0.06); g.add(pane);
  // the brick wall a metre beyond, wet and grey-lit; a downpipe; rain falling between
  const brick = T.brickTexture({ tint: '#5a3a30', mortar: '#3a3430', soot: 0.6, seed: 47, size: 512, rows: 12, cols: 4 });
  const bt = brick.clone(); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(3, 4.5); bt.needsUpdate = true;
  const brickMat = new THREE.MeshStandardMaterial({ map: bt, emissiveMap: bt, emissive: new THREE.Color('#8a9ab0'), emissiveIntensity: 0.22, roughness: 0.4, color: '#8a8a90' });
  g.add(at(mesh(new THREE.PlaneGeometry(3, 4), brickMat, { cast: false }), 0, 0.3, -1.25));
  g.add(at(mesh(mergeG([cylG(0.045, 0.045, 4, 12, 0, 0, 0), cylG(0.055, 0.055, 0.08, 12, 0, 0.5, 0), cylG(0.055, 0.055, 0.08, 12, 0, -0.6, 0)]), new THREE.MeshStandardMaterial({ color: '#2a2a2c', emissive: '#4a5260', emissiveIntensity: 0.2, roughness: 0.3, metalness: 0.4 }), { cast: false }), 0.42, 0.3, -1.17));
  const rainTex = rainStreakTex();
  const rain = noRay(mesh(new THREE.PlaneGeometry(1.4, 2.0), new THREE.MeshBasicMaterial({ map: rainTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: '#8a9ab0' }), { cast: false, receive: false }));
  rain.position.set(0, 0, -0.6); rain.renderOrder = 2; g.add(rain);
  rain.userData.update = (dt) => { rainTex.offset.y += dt * 1.6; };
  // curtains: faded rose velvet, tied back, on a brass pole
  const pole = mesh(mergeG([cylG(0.012, 0.012, W + 0.5, 10).rotateZ(Math.PI / 2).translate(0, H / 2 + 0.2, 0.08), new THREE.SphereGeometry(0.025, 12, 8).translate(-(W + 0.5) / 2, H / 2 + 0.2, 0.08), new THREE.SphereGeometry(0.025, 12, 8).translate((W + 0.5) / 2, H / 2 + 0.2, 0.08)]), M.tarnishedBrass({ amount: 0.6 }));
  g.add(pole);
  for (const s of [-1, 1]) {
    const d = T.drape({ w: 0.42, h: 1.62, color: '#9c625e', pleatW: 0.09, depth: 0.04, anchor: s < 0 ? 'left' : 'right', sway: 0.0, seed: 5 + s, wear: 0.6, flare: 0.25 });
    d.position.set(s * (W / 2 + 0.12), H / 2 + 0.19, 0.08); g.add(d);
    d.userData.setGather?.(0.55);
    g.add(at(mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16).scale(1, 0.5, 1), M.matte('#c9a24a', { roughness: 0.5 }), { cast: false }), s * (W / 2 + 0.12), -0.22, 0.1, Math.PI / 2, 0, 0));
  }
  const hit = proxy(W + 0.1, H + 0.1, 0.12); hit.position.set(0, 0, -0.08); g.add(hit);
  return { object: g, pane, hit, rain };
}

// =====================================================================================================
// small extras built here: the room door (behind, never in the first frame), the exit sign, a shoe
// =====================================================================================================
function buildRoomDoor(group) {
  const g = wallGroup('S'); group.add(g);
  const a = 1.5, w = 0.86, h = 2.08;
  const cream = M.enamel('#e2d2b0', { roughness: 0.45, metalness: 0 });
  const leaf = grp('roomDoorLeaf'); leaf.position.set(a, 0, 0.02); g.add(leaf);
  const pnl = [boxG(w, h, 0.04, 0, h / 2, 0.0, 0.004)];
  for (const [py, ph] of [[1.5, 0.75], [0.55, 0.75]]) for (const px of [-0.2, 0.2]) pnl.push(boxG(0.3, ph, 0.012, px, py, 0.024, 0.006));
  leaf.add(mergeInto(pnl, M.enamel('#cdbb98', { roughness: 0.5, metalness: 0 })));
  leaf.add(mesh(mergeG([new THREE.SphereGeometry(0.028, 12, 8).translate(-w / 2 + 0.08, 1.0, 0.06), boxG(0.05, 0.16, 0.008, -w / 2 + 0.08, 1.0, 0.024, 0.002), latheG([[0, 0], [0.008, 0], [0.008, 0.06], [0.02, 0.07], [0, 0.075]], 10).rotateX(Math.PI / 2).translate(0, 1.85, 0.02)]), M.brass()));
  // her dressing gown on the hook (it is also painted into the reflection)
  const gown = T.garment({ type: 'coat', color: '#b8a4d6', seed: 77 }); gown.scale.setScalar(0.92); gown.position.set(0, 1.9, 0.09); leaf.add(gown);
  g.add(mergeInto([boxG(0.07, h + 0.07, 0.025, a - w / 2 - 0.035, (h + 0.07) / 2, 0.012, 0.004), boxG(0.07, h + 0.07, 0.025, a + w / 2 + 0.035, (h + 0.07) / 2, 0.012, 0.004), boxG(w + 0.14, 0.07, 0.027, a, h + 0.035, 0.013, 0.004)], cream));
  return { object: g, leaf };
}
function signTex() {
  const W = 512, H = 192, [c, g] = cv(W, H), r = rng(431);
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1e2a4a'; g.lineWidth = 10; g.strokeRect(10, 10, W - 20, H - 20);
  g.fillStyle = '#1e2a4a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold 92px ${FONTS.display}`; g.fillText('DOOR', W * 0.58, H * 0.47);
  // a pointing hand, back over the shoulder
  g.save(); g.translate(W * 0.16, H * 0.5); g.scale(-1, 1);
  g.beginPath(); g.moveTo(-40, -16); g.lineTo(18, -16); g.quadraticCurveTo(44, -16, 44, -6); g.quadraticCurveTo(44, 2, 20, 2); g.lineTo(20, 18); g.quadraticCurveTo(20, 28, 6, 28); g.lineTo(-40, 28); g.closePath(); g.fill();
  g.fillRect(-56, -22, 18, 56);
  g.restore();
  // chips in the enamel
  for (let i = 0; i < 22; i++) { g.fillStyle = `rgba(30,30,34,${0.4 + r() * 0.5})`; const x = r() < 0.5 ? r() * 30 + 4 : W - 34 + r() * 30, y = r() * H; g.beginPath(); g.ellipse(x, y, 2 + r() * 5, 1.5 + r() * 3, r() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(80,60,40,0.06)'; g.fillRect(r() * W, r() * H, 2, 2); }
  return canvasTexture(c);
}
function buildSign(group) {
  // an enamel blade sign standing out from the west wall: both faces read DOOR (the door is behind you)
  const g = grp('doorSign'); g.position.copy(PLACE.sign); group.add(g);
  const t = signTex(), mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, metalness: 0.05 });
  const W = 0.34, H = 0.13;
  const blade = grp('blade'); blade.position.set(0.06 + W / 2, 0, 0); g.add(blade);
  blade.add(mesh(new THREE.PlaneGeometry(W, H), mat, { cast: false }));
  const back = mesh(new THREE.PlaneGeometry(W, H), mat, { cast: false }); back.rotation.y = Math.PI; blade.add(back);
  blade.add(mesh(boxG(W + 0.008, H + 0.008, 0.004, 0, 0, 0, 0.001), M.matte('#1e2a4a', { roughness: 0.4 }), { cast: false }));
  g.add(mesh(mergeG([boxG(0.015, 0.2, 0.05, 0.0075, 0, 0, 0.003), cylG(0.006, 0.006, 0.07, 8).rotateZ(Math.PI / 2).translate(0.04, 0.05, 0), cylG(0.006, 0.006, 0.07, 8).rotateZ(Math.PI / 2).translate(0.04, -0.05, 0)]), M.ironBlack(), { cast: false }));
  const hit = proxy(W + 0.12, H + 0.1, 0.08); hit.position.set(0.06 + W / 2, 0, 0); g.add(hit);
  return { object: g, blade, hit };
}
function satinShoe(color = '#e2b4b0') {
  const g = grp('shoe');
  const sole = new THREE.Shape(); sole.moveTo(-0.11, 0); sole.bezierCurveTo(-0.11, 0.035, -0.04, 0.04, 0.02, 0.032); sole.bezierCurveTo(0.08, 0.03, 0.12, 0.02, 0.12, 0); sole.bezierCurveTo(0.12, -0.022, 0.07, -0.028, 0.02, -0.03); sole.bezierCurveTo(-0.04, -0.032, -0.11, -0.03, -0.11, 0);
  const sg = new THREE.ExtrudeGeometry(sole, { depth: 0.008, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, 0.008, 0);
  const sp = sg.attributes.position; for (let i = 0; i < sp.count; i++) { const x = sp.getX(i); if (x < 0) sp.setY(i, sp.getY(i) + 0.05 * sstep(0.0, -0.09, x)); }
  sg.computeVertexNormals();
  const satin = new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, sheen: 1, sheenColor: new THREE.Color('#fff0f0') });
  g.add(mesh(sg, M.leather('#3a2420')));
  g.add(mesh(new THREE.SphereGeometry(0.06, 16, 10, 0, TAU, 0, Math.PI / 2).scale(0.95, 0.5, 0.5).translate(0.055, 0.02, 0), satin));
  g.add(mesh(mergeG([cylG(0.012, 0.008, 0.055, 10, -0.095, 0.028, 0), boxG(0.006, 0.006, 0.07, -0.02, 0.05, 0, 0.002)]), satin));
  g.add(at(mesh(new THREE.SphereGeometry(0.008, 8, 6), M.gold()), -0.02, 0.052, 0.036));
  return g;
}

// =====================================================================================================
// BUILD
// =====================================================================================================
export function buildSet(ctx, group) {
  const tween = makeTweener(group);
  const H = {};
  buildShell(group);
  const win = buildWindow(group);
  const roomDoor = buildRoomDoor(group);
  const sign = buildSign(group);

  // ---------------------------------------------------------------------------------------------------
  // the dressing table, its mirror, the writing slope, the basket, the sundries
  // ---------------------------------------------------------------------------------------------------
  const table = D.dressingTable(); table.position.copy(PLACE.table); group.add(table);
  const tu = table.userData, TOP = tu.topY;
  const runner = D.laceRunner(1.32, 0.34); runner.position.set(0, TOP + 0.0008, 0.04); table.add(runner);

  const reflection = D.reflectionTex();
  const birthdayTex = { lines: ['MANY HAPPY RETURNS ON YOUR', 'FIFTY-THIRD DARLING STOP STILL THE', 'YOUNGEST IN EVERY PROGRAMME STOP', 'MOTHER'], to: 'MISS L THRUSH EMPRESS THEATRE PELHAM ST', office: 'BRIGHTON', time: '9.02 AM  2 APR 1930', seed: 23, age: 0.55 };
  const mirror = D.swingMirror({
    reflection,
    telegrams: {
      ada: { lines: ['ENJOY YOUR LAST NIGHT STOP', 'NOT TOO MUCH STOP ADA'], to: 'MISS THRUSH EMPRESS THEATRE', office: 'PELHAM ST STN', time: '4.15 PM', seed: 21, age: 0.5 },
      rupert: { lines: ['SEE YOU AT THE HALF STOP', 'RUPERT'], to: 'MISS L THRUSH DRESSING ROOM ONE', office: 'PELHAM ST STN', time: '5.50 PM', seed: 22, age: 0.5 },
      birthday: birthdayTex,
    },
  });
  mirror.position.set(0, TOP, -0.12); table.add(mirror);
  const mu = mirror.userData;

  const slope = D.writingSlope(); slope.position.set(-0.52, TOP, 0.09); slope.rotation.y = 0.06; table.add(slope);
  const ash = D.ashSheet(); slope.userData.mount.add(ash); ash.visible = false;
  slope.userData.onAngle = (d) => ash.userData.setAngle(d);

  const basket = D.wasteBasket(); basket.position.set(-0.6, 0, 0.42); basket.rotation.y = 0.7; table.add(basket);
  const curl = D.ashCurl(); basket.userData.ashSpot.add(curl);

  const tins = D.greasepaint(); tins.position.set(0.24, TOP, 0.13); tins.rotation.y = -0.2; table.add(tins);
  const powder = D.powderBowl(); powder.position.set(0.5, TOP, 0.13); table.add(powder);
  const perfume = T.perfumeBottle(); perfume.position.set(0.6, TOP, -0.1); perfume.rotation.y = -0.6; table.add(perfume);
  const tonic = D.tonicBottle(); tonic.position.set(0.66, TOP, 0.1); tonic.rotation.y = 0.15; table.add(tonic);
  const letters = D.fanLetters(); letters.position.set(-0.2, TOP, 0.15); letters.rotation.y = 0.35; table.add(letters);
  const vanity = D.vanitySet(); vanity.position.set(0.02, TOP, 0.12); vanity.rotation.y = -0.4; table.add(vanity);
  for (const o of [tins, powder, perfume, tonic, letters, vanity]) keep(o);

  // ---------------------------------------------------------------------------------------------------
  // the chaise, the side table with the rose lamp and the gramophone, the jewel case, a shoe
  // ---------------------------------------------------------------------------------------------------
  const chaise = D.chaise(); chaise.position.copy(PLACE.chaise); chaise.rotation.y = -Math.PI / 2; group.add(chaise);
  const cu = chaise.userData;
  const side = D.sideTableRect({ w: 0.74, d: 0.44, h: 0.68 }); side.position.copy(PLACE.sideTable); side.rotation.y = 0.04; group.add(side);
  const lamp = T.tableLamp({ style: 'rose', lit: 1 }); lamp.position.set(0.24, side.userData.topY, -0.08); side.add(lamp);
  lamp.userData.setLit?.(1, true);
  const gram = D.gramophone({ notch: 2 }); gram.position.set(-0.16, side.userData.topY, 0.0); gram.rotation.y = -0.28; side.add(gram);
  const gu = gram.userData;
  const jewel = D.jewelCase({ values: [1, 9, 0, 0] });
  jewel.position.copy(cu.jewelSpot).add(v3(0, 0, 0.09)); jewel.rotation.y = 0.12; chaise.add(jewel);
  jewel.visible = false;
  const ju = jewel.userData;
  const shoe = satinShoe(); shoe.position.set(0.62, 0, CHAISE_FZ() + 0.04); shoe.rotation.y = 1.2; chaise.add(shoe);
  function CHAISE_FZ() { return D.CHAISE.depth / 2; }

  // ---------------------------------------------------------------------------------------------------
  // the west wall: wardrobe, the DOOR sign, the photograph, the radiator; the corner lilies
  // ---------------------------------------------------------------------------------------------------
  const wardrobe = D.wardrobe(); wardrobe.position.copy(PLACE.wardrobe); wardrobe.rotation.y = Math.PI / 2; group.add(wardrobe);
  const hb = T.hatbox({ r: 0.17, h: 0.2, colors: ['#e8dcc0', '#9c6a64'], seed: 84, label: 'L.T.' }); hb.position.set(0.18, D.WARDROBE.h + 0.04, 0.02); hb.rotation.y = 0.4; wardrobe.add(hb);
  const case_ = mesh(mergeG([boxG(0.5, 0.16, 0.34, 0, 0.08, 0, 0.02)]), M.leather('#6a4a30')); case_.position.set(-0.24, D.WARDROBE.h + 0.04, 0.0); case_.rotation.y = -0.1; wardrobe.add(case_);
  wardrobe.add(at(mesh(mergeG([boxG(0.5, 0.012, 0.012, 0, 0.0, 0.17, 0.004), boxG(0.012, 0.012, 0.34, 0.2, 0, 0, 0.004), boxG(0.012, 0.012, 0.34, -0.2, 0, 0, 0.004)]), M.tarnishedBrass({ amount: 0.5 }), { cast: false }), -0.24, D.WARDROBE.h + 0.2, 0.0, 0, -0.1, 0));
  keep(wardrobe.userData.doors[0]); keep(wardrobe.userData.doors[1]);

  const photoTex = T.sepiaPhotoTexture({ subject: 'portrait', caption: 'Miss Thrush as Grace, 1912', seed: 1912, w: 384, h: 512 });
  const photo = T.photoFrame({ w: 0.3, h: 0.4, texture: photoTex, style: 'gilt', stand: false, border: 0.04 });
  photo.position.copy(PLACE.photo).add(v3(0.012, 0, 0)); photo.rotation.y = Math.PI / 2; photo.rotation.z = 0.015; group.add(photo);
  keep(photo);
  // cords from the picture rail
  const cordTop = v3(ROOM.x0 + 0.03, RAIL + 0.01, PLACE.photo.z), cordMat = M.matte('#6a5030', { roughness: 0.8 });
  group.add(mesh(mergeG([tubeG([[cordTop.x, cordTop.y, cordTop.z - 0.02], [ROOM.x0 + 0.02, PLACE.photo.y + 0.22, PLACE.photo.z - 0.13]], 0.0018, { radial: 4, seg: 2 }), tubeG([[cordTop.x, cordTop.y, cordTop.z + 0.02], [ROOM.x0 + 0.02, PLACE.photo.y + 0.22, PLACE.photo.z + 0.13]], 0.0018, { radial: 4, seg: 2 }), new THREE.SphereGeometry(0.012, 8, 6).translate(cordTop.x, cordTop.y + 0.004, cordTop.z)]), cordMat, { cast: false }));

  const radiator = T.radiator({ sections: 11, h: 0.66, color: '#c4b496' }); radiator.position.set(ROOM.x0, 0, PLACE.window.z); radiator.rotation.y = Math.PI / 2; group.add(radiator);
  radiator.traverse((o) => { o.castShadow = false; }); // 10k triangles of fins: not worth a shadow pass
  keep(radiator);

  const stand = D.plantStand(0.84); stand.position.copy(PLACE.stand); group.add(stand);
  const lilies = T.lilyVase({ dried: true, stems: 6, vase: '#d8cfc0', seed: 9 }); lilies.position.set(0, stand.userData.topY, 0); lilies.rotation.y = 0.5; stand.add(lilies);
  keep(lilies);
  const card = D.lilyCard(); card.position.set(0.07, stand.userData.topY + 0.38, 0.06); card.rotation.set(-0.15, 0.25, 0.08); stand.add(card); keep(card);

  // ---------------------------------------------------------------------------------------------------
  // playbills on the north wall, the pendant
  // ---------------------------------------------------------------------------------------------------
  const pb1 = T.posterFrame({ w: 0.46, h: 0.66, style: 'gilt', door: false, border: 0.045, texture: T.posterTexture({ title: 'THE LAMP AT GULL POINT', subtitle: 'A Drama in Three Acts and a Storm', lines: ['MISS LAVINIA THRUSH', 'as GRACE'], date: 'OPENING 9th SEPTEMBER 1912', seed: 12, age: 0.7 }) });
  pb1.position.set(-1.26, 1.8, ROOM.z0 + 0.005); pb1.rotation.z = 0.012; group.add(pb1);
  const pb2 = T.posterFrame({ w: 0.42, h: 0.6, style: 'gilt', door: false, border: 0.04, texture: T.posterTexture({ title: 'THE BELLE OF PELHAM', subtitle: 'A Musical Comedy', lines: ['MISS LAVINIA THRUSH', 'MR RUPERT VOLLEY'], date: '1904', accent: '#2a4a6a', seed: 19, age: 0.75, style: 'playbill' }) });
  pb2.position.set(0.78, 1.84, ROOM.z0 + 0.005); pb2.rotation.z = -0.02; group.add(pb2);
  const pendant = T.pendantLamp({ style: 'glass', drop: 0.45, lit: 0 }); pendant.position.set(0.05, ROOM.H - 0.075, 0.15); group.add(pendant);

  // ---------------------------------------------------------------------------------------------------
  // LIGHTS: a rose lamp, the grey window, the mirror's ring of bulbs (on its tilt switch)
  // ---------------------------------------------------------------------------------------------------
  group.add(Lt.ambientRig({ sky: '#e6b8b0', ground: '#2a1814', hemi: 0.32, ambient: '#3a2428', ambientIntensity: 0.22 }));
  group.updateMatrixWorld(true);
  const lampPos = lamp.localToWorld((lamp.userData.bulbPos || v3(0, 0.36, 0)).clone());
  const lampLight = new THREE.PointLight('#ffad85', 2.4, 5, 1.6); lampLight.position.copy(lampPos); group.add(lampLight);
  const lampHalo = T.halo('#ffb090', 0.5, 0.35); lampHalo.position.copy(lampPos); group.add(lampHalo);
  // a low warm fill so the corners are dim, not black
  const fill = new THREE.PointLight('#c98e86', 0.6, 7, 1.4); fill.position.set(0.3, 2.7, 0.2); group.add(fill);
  // shadow light 1: the grey window light
  const winKey = Lt.keyLight({ color: '#a9b8d0', intensity: 9, position: [-3.0, 2.55, 0.6], target: [-0.7, 0.0, 0.0], angle: 0.42, penumbra: 0.8, distance: 7, decay: 1.4, castShadow: true, mapSize: 1024 });
  group.add(winKey);
  // shadow light 2: the mirror bulbs (intensity 0 while the mirror is down; it stays a shadow light so nothing recompiles)
  const mirrorCentre = v3(PLACE.table.x, TOP + D.MIRROR.pivot + D.MIRROR.centre, PLACE.table.z - 0.12);
  const mirKey = Lt.keyLight({ color: '#ffe0b4', intensity: 0, position: [mirrorCentre.x, mirrorCentre.y + 0.08, mirrorCentre.z + 0.22], target: [mirrorCentre.x + 0.2, 0.35, 1.0], angle: 1.15, penumbra: 0.9, distance: 6, decay: 1.5, castShadow: true, mapSize: 1024 });
  const mirSpot = mirKey.userData.light; mirSpot.shadow.camera.near = 0.08;
  group.add(mirKey);
  const mirFill = new THREE.PointLight('#ffd9a8', 0, 3.2, 1.6); mirFill.position.set(mirrorCentre.x, mirrorCentre.y, mirrorCentre.z + 0.35); group.add(mirFill);
  const MIR = { spot: 14, fill: 2.6 };
  // dust in the window light and in the lamp's glow
  group.add(P.dustMotes({ box: [1.8, 1.6, 1.2], center: [-1.3, 1.3, 0.55], count: 110, color: '#c8d4e8', size: 0.012, opacity: 0.35 }));
  group.add(P.dustMotes({ box: [1.4, 1.2, 1.0], center: [0.9, 1.2, -1.5], count: 80, color: '#ffd6b8', size: 0.011, opacity: 0.4 }));

  // ---------------------------------------------------------------------------------------------------
  // HANDLES
  // ---------------------------------------------------------------------------------------------------
  group.updateMatrixWorld(true);

  // ---- the mirror ----
  const { glass: GW, border: B } = D.MIRROR, FW = GW + 2 * B;
  const mirrorHit = proxy(FW + 0.04, FW + 0.06, 0.08); mu.frame.add(mirrorHit);
  // Dot's card in the glass at the LEFT stop (k = -1): canvas x 690..930 of the 480..1120 slice, y 64..352 of 640
  const { x0, x1, y0, y1 } = D.CARD_RECT, sl = (-1 + 2) * D.REFLECTION.step;
  const cu0 = (x0 - sl) / D.REFLECTION.slice, cu1 = (x1 - sl) / D.REFLECTION.slice, cv0 = y0 / D.REFLECTION.h, cv1 = y1 / D.REFLECTION.h;
  const cardHit = new THREE.Mesh(new THREE.PlaneGeometry((cu1 - cu0) * GW + 0.02, (cv1 - cv0) * GW + 0.02), new THREE.MeshBasicMaterial({ visible: false }));
  cardHit.userData.hitProxy = true; cardHit.position.set(((cu0 + cu1) / 2 - 0.5) * GW, (0.5 - (cv0 + cv1) / 2) * GW, 0.03); mu.frame.add(cardHit);
  const tgHits = {};
  for (const [id, m] of Object.entries(mu.telegrams)) { const p = proxy(0.16, 0.12, 0.045); p.position.copy(m.position); p.rotation.z = m.rotation.z; mu.frame.add(p); tgHits[id] = { object: m, hit: p }; }
  let mirLit = 0;
  const setMirrorLit = (l) => {
    mirLit = l; mu.setBulbs(l);
    mirSpot.intensity = l * MIR.spot; mirFill.intensity = l * MIR.fill;
    // a dark shadow light still renders its shadow map; skip the pass while the bulbs are off (no recompile)
    mirSpot.shadow.autoUpdate = l > 0.001; if (l <= 0.001) mirSpot.shadow.needsUpdate = false;
    ash.userData.setLit(0.15 + 0.85 * l);
  };
  setMirrorLit(0);
  const tiltFor = (d) => { mu.setTiltDeg(d); mu.setSheen(d > -1 ? 0 : Math.min(1, 0.35 + Math.abs(d) / 40)); };
  let upright = false;
  H.mirror = {
    object: mirror, hit: mirrorHit, frame: mu.frame, glass: mu.glass, bulbs: mu.bulbs, reflection,
    wingL: mu.wingLProxy, wingR: mu.wingRProxy, wingLNut: mu.wingL, wingRNut: mu.wingR,
    cardHit, telegrams: tgHits,
    STOPS: D.REFLECTION.stops, MIN_TILT: -80, SNAP: -40,
    /** Instant tilt in degrees (-80 face-down .. 0 upright), for dragging: the glass shows only its sheen. */
    setTilt(deg) { upright = false; setMirrorLit(0); tiltFor(THREE.MathUtils.clamp(deg, -80, 0)); },
    tilt: () => mu.tiltDeg,
    /** Swing upright and lock (thunk), then the tilt switch lights the bulbs. Returns a Promise. */
    async stand({ instant = false } = {}) {
      const from = mu.tiltDeg;
      await tween(instant ? 0 : 0.45 * Math.max(0.3, Math.abs(from) / 80), (k) => tiltFor(from + (0 - from) * k), ease.back, 'mirrorTilt');
      upright = true; mu.setSheen(0);
      if (instant) { setMirrorLit(1); return; }
      // the bulbs come up with a stutter
      await tween(0.08, (k) => setMirrorLit(0.6 * k), ease.out, 'mirrorLit');
      await tween(0.06, (k) => setMirrorLit(0.6 - 0.5 * k), ease.out, 'mirrorLit');
      await tween(0.35, (k) => setMirrorLit(0.1 + 0.9 * k), ease.out, 'mirrorLit');
    },
    /** Fall back face-down (bulbs off at once). */
    async fall({ instant = false } = {}) {
      upright = false; setMirrorLit(0);
      const from = mu.tiltDeg;
      await tween(instant ? 0 : 0.55, (k) => tiltFor(from + (-80 - from) * k), ease.bounce, 'mirrorTilt');
    },
    setUpright(b, opts) { return b ? this.stand(opts) : this.fall(opts); },
    isUpright: () => upright,
    /** Turn to stop k (-2 far left .. 2 far right): 0.3 s; the reflection slides with it. */
    async setStop(k, { instant = false } = {}) {
      k = THREE.MathUtils.clamp(Math.round(k), -2, 2);
      // from where the glass actually is (a rapid second click starts from mid-swing, not from the old stop), and only
      // the latest target snaps at the end (a superseded tween resolves early) // CHANGED BY puzzles-dressing
      const sw = mu.swivel, from = sw.rotation.y / mu.STEP;
      mu.stop = k;
      await tween(instant ? 0 : 0.3, (e) => { const kf = from + (k - from) * e; sw.rotation.y = kf * mu.STEP; reflection.offset.x = D.stopOffset(kf); }, ease.inOut, 'mirrorSwivel');
      if (mu.stop === k) mu.setSwivel(k);
    },
    turn(dir) { return this.setStop(mu.stop + dir); },
    stop: () => mu.stop,
    /** True when the card can be read in the glass (upright, left stop). */
    cardVisible: () => upright && mu.stop === -1,
    setLit: setMirrorLit, lit: () => mirLit,
    lights: { spot: mirSpot, fill: mirFill },
    focus: null, // set below
  };
  H.mirror.setTilt(-80);

  // ---- the writing slope and the ash ----
  const ashHit = ash.userData.sheet;
  H.slope = {
    object: slope, board: slope.userData.board, hit: aabbProxy(group, slope, 0.01),
    setAngle: (d) => slope.userData.setAngle(d), angle: () => slope.userData.angle(), MAX: 60,
    ash: { object: ash, hit: ashHit, legible: () => ash.visible && ash.userData.legible(), printFor: D.printFor, setLit: ash.userData.setLit },
    /** Put the ash on the slope (or back in the basket). */
    setAsh(onSlope) { ash.visible = !!onSlope; curl.visible = !onSlope; },
    /** The basket → slope move: the curl vanishes, the sheet settles on the leather. */
    async liftAsh() {
      curl.visible = false; ash.visible = true;
      await tween(0.6, (k) => { ash.position.y = 0.06 * (1 - k); ash.rotation.z = 0.2 * (1 - k); ash.scale.setScalar(0.85 + 0.15 * k); }, ease.out, 'ash');
    },
    focus: null,
  };
  H.basket = { object: basket, hit: aabbProxy(group, basket, 0.02), ash: curl, focus: null };

  // ---- the drawers and the secret drawer ----
  const drawerItems = tu.drawers.map((dr, i) => {
    const front = dr.userData.front;
    return {
      kind: dr.userData.kind, object: dr, hit: front, plaque: dr.userData.plaque, contents: Object.values(tu.contents)[i],
      setOpen: (t) => tu.setDrawer(i, t),
      open: () => tween(0.35, (k) => tu.setDrawer(i, k), ease.out, `drawer${i}`),
      close: (fast = false) => { const z0 = dr.position.z / tu.drawerTravel; return tween(fast ? 0.14 : 0.3, (k) => tu.setDrawer(i, z0 * (1 - k)), fast ? ease.in : ease.inOut, `drawer${i}`); },
      isOpen: () => dr.position.z > 0.01,
    };
  });
  const noteHit = tu.pikeNote, winderHit = proxy(0.17, 0.05, 0.08); tu.winder.add(winderHit); winderHit.position.set(0.08, 0.03, 0);
  const drawersHit = proxy(D.TABLE.w + 0.02, D.TABLE.h - 0.47, 0.05); drawersHit.position.set(0, (D.TABLE.h + 0.47) / 2 - 0.02, D.TABLE.d / 2 + 0.03); table.add(drawersHit);
  H.drawers = {
    object: table, hit: drawersHit, items: drawerItems, kinds: drawerItems.map((d) => d.kind),
    slamAll: () => Promise.all(drawerItems.map((d) => (d.isOpen() ? d.close(true) : null))),
    shutAll: () => drawerItems.forEach((d) => d.setOpen(0)),
    secret: {
      object: tu.secret,
      setOpen: (t) => tu.setSecret(t),
      /** The spring: it shoots out of the apron and overshoots. */
      open: () => tween(0.42, (k) => tu.setSecret(k), ease.back, 'secret'),
      note: { object: tu.pikeNote, hit: noteHit, setVisible: (b) => { tu.pikeNote.visible = b; } },
      winder: { object: tu.winder, hit: winderHit, setVisible: (b) => { tu.winder.visible = b; } },
    },
    focus: null,
  };

  // ---- the gramophone ----
  const armHit = proxy(0.07, 0.06, 0.24); armHit.position.set(-0.006, 0.0, 0.11); gu.arm.add(armHit);
  const socketHit = proxy(0.06, 0.07, 0.07); socketHit.position.copy(gu.socket).add(v3(0.02, 0, 0)); gram.add(socketHit);
  const platterHit = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 24), new THREE.MeshBasicMaterial({ visible: false }));
  platterHit.userData.hitProxy = true; platterHit.position.copy(gu.platterCentre).add(v3(0, 0.02, 0)); gram.add(platterHit);
  const leverLocal = new THREE.Vector3();
  let winding = false;
  H.gramophone = {
    object: gram, hit: aabbProxy(group, gram, 0.01), spin: gu.spin, rings: gu.rings, NOTCHES: gu.NOTCHES,
    arm: { object: gu.arm, hit: armHit }, lever: { object: gu.lever, hit: gu.leverProxy }, socket: { hit: socketHit }, platter: { hit: platterHit },
    get rpm() { return gu.rpm; }, get notch() { return gu.notch; }, get playing() { return gu.playing; }, get armT() { return gu.armT; },
    setNotch: (i) => gu.setLever(THREE.MathUtils.clamp(Math.round(i), 0, 12)),
    /** The notch nearest a world point (for dragging the lever along its arc). */
    notchAt(worldPoint) { leverLocal.copy(worldPoint); gram.worldToLocal(leverLocal); const lp = gu.lever.position; return gu.notchFromAngle(Math.atan2(leverLocal.x - lp.x, leverLocal.z - lp.z)); },
    setArm: (t) => gu.setArm(t),
    dropNeedle: () => tween(0.7, (k) => gu.setArm(k), ease.inOut, 'arm'),
    liftNeedle: () => { const a = gu.armT; return tween(0.5, (k) => gu.setArm(a * (1 - k)), ease.inOut, 'arm'); },
    setPlaying: (b) => gu.setPlaying(b),
    setWound: (b) => gu.setWound(b),
    /** The winder appears in the socket and turns `turns` times (it stays there after). */
    async wind(turns = 3) {
      if (winding) return; winding = true; gu.setWound(true);
      await tween(0.8 * turns, (k) => gu.turnWinder(k * turns * TAU), ease.inOut, 'winder');
      winding = false;
    },
    focus: null,
  };

  // ---- the jewel case ----
  const jewelHit = proxy(D.JEWEL.w + 0.04, D.JEWEL.h + 0.06, D.JEWEL.d + 0.04); jewelHit.position.set(0, D.JEWEL.h / 2, 0); jewel.add(jewelHit);
  const wheelHits = [];
  const wv = ju.wheels.userData;
  for (let i = 0; i < 4; i++) {
    const wx = ju.wheels.position.x + wv.wheelX(i), wz = ju.wheels.position.z + 0.0105;
    const up = proxy(0.016, 0.012, 0.012); up.position.set(wx, 0.006, wz); ju.clasp.add(up);
    const dn = proxy(0.016, 0.012, 0.012); dn.position.set(wx, -0.006, wz); ju.clasp.add(dn);
    wheelHits.push({ up, down: dn });
  }
  const buttonHit = proxy(0.026, 0.026, 0.02); buttonHit.position.copy(ju.button.position).add(v3(0, 0, 0.006)); ju.clasp.add(buttonHit);
  let jGlint = 0;
  ju.glint.userData.update = (dt, t) => { if (jGlint > 0) { ju.glint.material.opacity = jGlint * (0.45 + 0.35 * Math.sin(t * 3.1)); } };
  H.jewelcase = {
    object: jewel, hit: jewelHit, wheels: ju.wheels, wheelHits, button: { object: ju.button, hit: buttonHit },
    values: () => wv.values.slice(),
    setValues: (vals, instant = true) => vals.forEach((v, i) => wv.setValue(i, v, instant)),
    step: (i, d) => wv.step(i, d),
    pressButton: () => tween(0.18, (k) => { ju.button.position.z = 0.01 - 0.004 * Math.sin(Math.PI * k); }, ease.inOut, 'jbutton'),
    setLid: (t) => ju.setLid(t),
    open: () => tween(1.1, (k) => ju.setLid(k), ease.back, 'jlid'),
    page: { object: ju.lastPage, hit: ju.lastPage, setVisible: (b) => ju.setPage(b) },
    setVisible: (b) => { jewel.visible = b; },
    setGlint: (l) => { jGlint = l; ju.glint.visible = l > 0.001; if (l <= 0.001) ju.glint.material.opacity = 0; },
    focus: null,
  };

  // ---- the wardrobe (a delight) ----
  const wu = wardrobe.userData;
  H.wardrobe = {
    object: wardrobe, hit: aabbProxy(group, wardrobe, 0.0, v3(0.92, 0.95, 0.92)), doors: wu.doors,
    setOpen: (t) => wu.setOpen(t),
    open: () => { wu.sigh(); return tween(1.0, (k) => wu.setOpen(k), ease.out, 'wardrobe'); },
    close: () => tween(0.8, (k) => wu.setOpen(1 - k), ease.inOut, 'wardrobe'),
    isOpen: () => wu.doors[1].rotation.y > 0.05,
    focus: null,
  };

  // ---- small delights ----
  const delight = (name, obj, extra = {}, opts = {}) => { H[name] = { object: obj, hit: aabbProxy(group, obj, opts.pad ?? 0.015), focus: frame(obj, opts.frame || { dist: 0.55, up: 0.2 }), ...extra }; return H[name]; };
  delight('tonic', tonic);
  delight('perfume', perfume, { squeeze: () => perfume.userData.squeeze?.() });
  delight('fanletters', letters, {}, { pad: 0.02 });
  delight('greasepaint', tins, {}, { pad: 0.012 });
  delight('powder', powder, {
    /** The puff lifts and drops; a soft cloud. */
    async puff() {
      const p = powder.userData.puff, y0 = 0.046;
      const w = powder.localToWorld(v3(0, 0.08, 0));
      P.burst(ctx, group, w, { color: '#fff0ea', color2: '#f4dcd8', count: 70, radius: 0.22, duration: 1.8, size: 0.02 });
      await tween(0.5, (k) => { p.position.y = y0 + Math.sin(Math.PI * k) * 0.06; p.rotation.z = Math.sin(Math.PI * k) * 0.3; }, ease.inOut, 'puff');
    },
  });
  delight('photo', photo, {}, { frame: { dist: 0.8, up: 0.0 } });
  delight('radiator', radiator, {}, { frame: { dist: 0.9, up: 0.4 } });
  H.window = { object: win.object, hit: win.hit, pane: win.pane, focus: frame(win.pane, { dist: 1.1, up: 0.0 }) };
  H.lilies = {
    object: lilies, hit: aabbProxy(group, lilies, 0.0, v3(0.8, 1, 0.8)), card: { object: card, hit: card },
    setShimmer: (v) => lilies.userData.setShimmer?.(v),
    focus: frame(lilies, { dist: 0.75, up: 0.1 }),
  };
  H.telegrams = { ...tgHits, focus: null };
  H.chaiseunder = { object: chaise, hit: cu.underProxy, shoe, valance: cu.valance, focus: frame(cu.underProxy, { dist: 0.9, up: 0.35 }) };
  H.chaise = { object: chaise, seatY: cu.seatY };
  H.lamp = { object: lamp, light: lampLight, halo: lampHalo };
  H.footlights = H.tonic; // the delight's name in the spec

  // ---- perches and doors ----
  const perchLocal = v3(-D.CHAISE.len / 2 + 0.42, cu.seatY + 0.03, D.CHAISE.depth / 2 - 0.16);
  const perchWorld = chaise.localToWorld(perchLocal.clone());
  H.perches = { lavinia: { position: perchWorld.toArray().map((n) => +n.toFixed(3)), rotationY: -1.0, pose: 'perch' } };
  H.doors = { stage: { object: sign.hit, sign: sign.object, blade: sign.blade, frame: roomDoor.object, leaf: roomDoor.leaf } };
  keep(sign.blade);

  // ---------------------------------------------------------------------------------------------------
  // FOCUS FRAMINGS (checked at 1280×800)
  // ---------------------------------------------------------------------------------------------------
  const tw = (o, x, y, z) => o.localToWorld(v3(x, y, z));
  const fr = (p, l) => ({ position: p.toArray().map((n) => +n.toFixed(3)), lookAt: l.toArray().map((n) => +n.toFixed(3)) });
  // the mirror: square on, far enough back to see it lying down and standing up
  H.mirror.focus = fr(tw(table, 0, 1.42, 1.12), tw(table, 0, 1.08, -0.12));
  // the slope: square to the board at 40°, the bulbs reflected across the ash
  {
    const s = slope.userData, a = 40 * Math.PI / 180, D0 = D.SLOPE.d;
    const cL = v3(0, D.SLOPE.baseH + Math.sin(a) * D0 / 2, D0 / 2 - Math.cos(a) * D0 / 2);
    const c = slope.localToWorld(cL.clone()), n = v3(0, Math.cos(a), Math.sin(a)).transformDirection(slope.matrixWorld);
    H.slope.focus = fr(c.clone().addScaledVector(n, 0.42), c);
    void s;
  }
  H.basket.focus = fr(tw(table, -0.5, 0.78, 1.05), tw(table, -0.6, 0.14, 0.42));
  H.drawers.focus = fr(tw(table, 0, 0.9, 1.2), tw(table, 0, 0.6, 0.2)); // CHANGED BY puzzles-dressing: back far enough that the glove drawer (far left) is in frame
  {
    const c = gram.localToWorld(gu.platterCentre.clone().add(v3(0.03, 0, 0.02)));
    const p = gram.localToWorld(gu.platterCentre.clone().add(v3(0.03, 0.42, 0.34)));
    H.gramophone.focus = fr(p, c);
  }
  {
    // closed: square-ish to the clasp so the wheels read; open: from above, into the silk
    const c = jewel.localToWorld(v3(0, 0.055, 0.05));
    const p = jewel.localToWorld(v3(0, 0.13, 0.22));
    H.jewelcase.focus = fr(p, c);
    H.jewelcase.focusOpen = fr(jewel.localToWorld(v3(0, 0.3, 0.17)), jewel.localToWorld(v3(0, 0.06, 0.0)));
  }
  H.wardrobe.focus = fr(wardrobe.localToWorld(v3(0.05, 1.62, 1.5)), wardrobe.localToWorld(v3(0, 1.3, 0)));
  H.telegrams.focus = H.mirror.focus;

  // the ambient things the room animates
  H.ambient = { winKey, lampLight, fill, mirSpot, mirFill, rain: win.rain, pane: win.pane };
  H.tween = tween;
  return H;
}

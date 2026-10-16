// Wardrobe & Props Loft (`wardrobe`): room-specific props built by SET-wardrobe with the shared catalogue's helpers and
// palette. The shared pieces (garment geometry, dummy, wig head, hatbox, sewing machine, beehive lamp, lens rings,
// spiral stair, cloak, pendant, festoon) come from engine/props/theatre.js; this file holds the one-off puzzle objects
// (card tags, rub pad, metronome, oil can, the skirt under the needle, the worn cape, the felt tray, the ring of light),
// the props-shelf fakes (rubber chicken, cardboard cake, ALAS skull, wooden ham, tin crown) and set dressing.
// Conventions: metres, +Y up, the front faces +Z, floor props have their origin at the base centre.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import { mesh, noRay, grp, at, boxG, cylG, latheG, loftG, mergeG, mergeInto, tubeG, halo, chase, TAU } from '../../engine/props/theatre/common.js';
import { FONTS, grime } from '../../engine/props/theatre-textures.js';
import { makeCanvas, canvasTexture, rng } from '../../engine/props/textures.js';

// =====================================================================================================================
// small helpers
// =====================================================================================================================

/** A flat ribbon along points; ups[i] is the direction of the width at point i. u runs along the ribbon in metres. */
export function ribbonG(points, ups, width) {
  const pos = [], uv = [], idx = [];
  let len = 0;
  points.forEach((p, i) => {
    if (i) len += p.distanceTo(points[i - 1]);
    const u = ups[i].clone().normalize().multiplyScalar(width / 2);
    pos.push(p.x - u.x, p.y - u.y, p.z - u.z, p.x + u.x, p.y + u.y, p.z + u.z);
    uv.push(len, 0, len, 1);
  });
  for (let i = 0; i < points.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  g.userData.length = len;
  return g;
}

/** Two strands twisted round a curve (a fat twist of thread). r = strand radius. */
export function twistG(points, r = 0.0022, { turns = 6, seg = 48 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
  const fr = curve.computeFrenetFrames(seg, false);
  const out = [];
  for (const ph of [0, Math.PI]) {
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, a = ph + t * turns * TAU, p = curve.getPointAt(t);
      pts.push(p.add(fr.normals[i].clone().multiplyScalar(Math.cos(a) * r * 0.8)).add(fr.binormals[i].clone().multiplyScalar(Math.sin(a) * r * 0.8)));
    }
    out.push(tubeG(pts, r, { radial: 4, seg }));
  }
  return mergeG(out);
}

let glintTex = null;
/** A twinkling four-point glint (for small takeable things). userData: { setOn(b) }. Never raycast. */
export function glint({ size = 0.09, color = '#fff4d8', rate = 1, phase = 0 } = {}) {
  if (!glintTex) {
    const c = makeCanvas(128, 128), g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.4, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [w, h] of [[3, 120], [120, 3]]) { const lg = g.createLinearGradient(64 - w / 2 * 20, 64 - h / 2, 64, 64); g.globalAlpha = 0.85; g.fillRect(64 - w / 2, 64 - h / 2, w, h); }
    glintTex = canvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.scale.setScalar(size);
  s.renderOrder = 8;
  let on = true, t0 = phase;
  s.userData.update = (dt, t) => {
    if (!on) { s.material.opacity = 0; return; }
    const k = (Math.sin((t + t0) * 2.2 * rate) + Math.sin((t + t0) * 3.7 * rate + 1.3)) * 0.5;
    const f = Math.max(0, k - 0.35) / 0.65;
    s.material.opacity = f * 0.9;
    s.material.rotation = (t + t0) * 0.6;
    s.scale.setScalar(size * (0.6 + 0.6 * f));
  };
  s.userData.setOn = (b) => { on = !!b; };
  return noRay(s);
}

// =====================================================================================================================
// THE SKYLIGHT: rain on glass over a sodium-lit night (a shader quad; uv.y = 0 at the eaves edge, 1 at the ridge side)
// =====================================================================================================================
const rainVert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const rainFrag = /* glsl */`
  uniform float uTime; varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
  vec3 sky(vec2 uv){
    vec3 deep = vec3(0.018, 0.022, 0.036);
    vec3 sod = vec3(0.62, 0.30, 0.085);
    float glow = exp(-uv.y * 2.0);
    vec3 col = mix(deep, sod * 0.42, glow);
    float cl = fbm(uv * vec2(2.2, 1.5) + vec2(uTime * 0.011, -uTime * 0.005));
    col += sod * 0.32 * smoothstep(0.45, 0.85, cl) * glow;          // cloud underbellies lit by the street lamps
    col += vec3(0.05, 0.045, 0.05) * smoothstep(0.55, 0.9, cl) * (1.0 - glow);
    return col;
  }
  vec3 drops(vec2 uv, float t, float scale, float seed, inout vec2 off){
    vec2 g = uv * vec2(scale, scale * 0.55);
    vec2 id = floor(g); vec2 f = fract(g) - 0.5;
    float h = hash(id + seed);
    float y = fract(t * (0.14 + h * 0.3) + h * 7.0);
    vec2 p = vec2((hash(id + 3.1 + seed) - 0.5) * 0.6, 0.5 - y);       // runs down the slope (toward v = 0)
    vec2 d = (f - p) * vec2(1.0, 1.5);
    float r = 0.09 + 0.07 * hash(id + 9.0 + seed);
    float on = step(0.3, h);
    float m = smoothstep(r, r * 0.55, length(d)) * on;
    float trail = smoothstep(0.05, 0.0, abs(f.x - p.x)) * smoothstep(p.y, p.y + 0.06, f.y) * (1.0 - smoothstep(0.0, 0.7, f.y - p.y)) * on;
    off += d * m * 0.1;
    return vec3(m, trail, 0.0);
  }
  void main(){
    vec2 uv = vUv; vec2 off = vec2(0.0);
    vec3 a = drops(uv, uTime, 7.0, 0.0, off);
    vec3 b = drops(uv * 1.6 + 0.3, uTime * 1.25, 7.0, 4.0, off);
    float sheet = noise(vec2(uv.x * 38.0, uv.y * 5.0 + uTime * 1.7));
    float beads = smoothstep(0.78, 0.97, noise(uv * 55.0)) * 0.7;
    vec3 col = sky(uv + off + vec2(0.0, (sheet - 0.5) * 0.012));
    vec3 lit = vec3(0.9, 0.58, 0.3);
    col += lit * (a.x + b.x) * 0.17 + lit * (a.y + b.y) * 0.07 + lit * beads * 0.06 + vec3(0.025) * sheet;
    vec2 e = min(uv, 1.0 - uv);
    col *= 0.55 + 0.45 * smoothstep(0.0, 0.07, min(e.x, e.y));
    gl_FragColor = vec4(col, 1.0);
  }`;
/** The skylight's rain shader (unique per call). Drive with mat.userData.update(dt, t). */
export function rainSkylightMaterial() {
  const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: rainVert, fragmentShader: rainFrag });
  mat.userData.update = (dt, t) => { mat.uniforms.uTime.value = t; };
  return mat;
}

// =====================================================================================================================
// COSTUME TAGS (rack): a 10 × 6 cm buff card, a stamped show symbol, a fat twist of thread through the hole, 1–3 notches
// =====================================================================================================================
export const THREAD_COLORS = { lilac: '#b98ae8', green: '#2f8f3c', brown: '#7c4a22', navy: '#1c2c7c' };
export const TAG_W = 0.1, TAG_H = 0.06;
const HOLE_X = -TAG_W / 2 + 0.012;

/** Draw a stamp symbol centred at (0,0), size s (px): 'lighthouse' | 'crown' | 'heart'. Filled in the current style. */
function drawSymbol(g, sym, s) {
  g.beginPath();
  if (sym === 'lighthouse') {
    // rock
    g.moveTo(-s * 0.42, s * 0.46); g.quadraticCurveTo(-s * 0.3, s * 0.3, -s * 0.12, s * 0.33); g.lineTo(s * 0.14, s * 0.33); g.quadraticCurveTo(s * 0.32, s * 0.3, s * 0.42, s * 0.46); g.closePath(); g.fill();
    // tower with two clear bands
    const band = (y0, y1) => { const w0 = s * (0.15 - 0.07 * (y0 + 0.3) / 0.62), w1 = s * (0.15 - 0.07 * (y1 + 0.3) / 0.62); g.beginPath(); g.moveTo(-w0, -y0 * s + s * 0.03); g.lineTo(w0, -y0 * s + s * 0.03); g.lineTo(w1, -y1 * s + s * 0.03); g.lineTo(-w1, -y1 * s + s * 0.03); g.closePath(); g.fill(); };
    band(-0.3, -0.12); band(-0.07, 0.07); band(0.12, 0.26);
    g.fillRect(-s * 0.14, -s * 0.3, s * 0.28, s * 0.045);                  // gallery
    g.fillRect(-s * 0.075, -s * 0.42, s * 0.15, s * 0.12);                 // lantern
    g.beginPath(); g.moveTo(-s * 0.1, -s * 0.42); g.lineTo(0, -s * 0.5); g.lineTo(s * 0.1, -s * 0.42); g.closePath(); g.fill();
    // beams
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * s * 0.08, -s * 0.37); g.lineTo(d * s * 0.48, -s * 0.47); g.lineTo(d * s * 0.48, -s * 0.27); g.closePath(); g.fill(); }
  } else if (sym === 'crown') {
    g.fillRect(-s * 0.36, s * 0.12, s * 0.72, s * 0.16);                    // band
    g.beginPath(); g.moveTo(-s * 0.36, s * 0.12); g.lineTo(-s * 0.42, -s * 0.24); g.lineTo(-s * 0.18, -s * 0.02); g.lineTo(0, -s * 0.36); g.lineTo(s * 0.18, -s * 0.02); g.lineTo(s * 0.42, -s * 0.24); g.lineTo(s * 0.36, s * 0.12); g.closePath(); g.fill();
    for (const [x, y] of [[-0.42, -0.28], [0, -0.41], [0.42, -0.28]]) { g.beginPath(); g.arc(x * s, y * s, s * 0.06, 0, TAU); g.fill(); }
  } else {
    g.moveTo(0, s * 0.38);
    g.bezierCurveTo(-s * 0.1, s * 0.25, -s * 0.46, s * 0.06, -s * 0.44, -s * 0.15);
    g.bezierCurveTo(-s * 0.42, -s * 0.38, -s * 0.12, -s * 0.42, 0, -s * 0.2);
    g.bezierCurveTo(s * 0.12, -s * 0.42, s * 0.42, -s * 0.38, s * 0.44, -s * 0.15);
    g.bezierCurveTo(s * 0.46, s * 0.06, s * 0.1, s * 0.25, 0, s * 0.38);
    g.closePath(); g.fill();
  }
}

/**
 * One canvas atlas for all the tags (4 × 3 cells, 512 × 307 px each, so a tag held up to the camera stays crisp).
 * tags: [{ sym }]. Returns { texture, rect(i) → [u0, v0, u1, v1] }.
 */
export function tagAtlas(tags) {
  const CW = 512, CH = 307, cols = 4, rows = Math.ceil(tags.length / cols);
  const c = makeCanvas(CW * cols, 1024), g = c.getContext('2d');
  const ink = makeCanvas(CW, CH), ig = ink.getContext('2d');
  tags.forEach((t, i) => {
    const x0 = (i % cols) * CW, y0 = Math.floor(i / cols) * CH, r = rng(31 + i * 7);
    g.save(); g.translate(x0, y0);
    g.fillStyle = '#e6d5aa'; g.fillRect(0, 0, CW, CH);
    grime(g, CW, CH, { seed: 40 + i, color: '#a08048', octaves: [[4, 0.22], [18, 0.12], [70, 0.08]] });
    // fibres and handling
    for (let k = 0; k < 140; k++) { g.fillStyle = `rgba(120,90,40,${0.05 + r() * 0.08})`; g.fillRect(r() * CW, r() * CH, 2 + r() * 10, 1); }
    const vg = g.createRadialGradient(CW * 0.55, CH * 0.5, CH * 0.3, CW * 0.55, CH * 0.5, CW * 0.62); vg.addColorStop(0, 'rgba(90,60,20,0)'); vg.addColorStop(1, 'rgba(90,60,20,0.38)');
    g.fillStyle = vg; g.fillRect(0, 0, CW, CH);
    // reinforcing ring round the eyelet
    const hx = CW * (HOLE_X + TAG_W / 2) / TAG_W, hy = CH / 2;
    g.fillStyle = '#c4a96e'; g.beginPath(); g.arc(hx, hy, CH * 0.15, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(80,55,20,0.6)'; g.lineWidth = 3; g.beginPath(); g.arc(hx, hy, CH * 0.15, 0, TAU); g.stroke();
    // printed header + rule (faint)
    g.fillStyle = 'rgba(70,45,20,0.6)'; g.font = `${Math.round(CH * 0.075)}px ${FONTS.typed}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('EMPRESS THEATRE  ·  WARDROBE', CW * 0.6, CH * 0.9);
    g.fillRect(CW * 0.28, CH * 0.83, CW * 0.64, 2);
    // the stamp: drawn on its own layer so the rubber texture only bites the ink
    ig.clearRect(0, 0, CW, CH);
    ig.save(); ig.translate(CW * 0.6, CH * 0.5); ig.rotate((r() - 0.5) * 0.12);
    ig.fillStyle = '#3b2a66'; ig.strokeStyle = '#3b2a66';
    ig.lineWidth = CH * 0.03; ig.beginPath(); ig.arc(0, 0, CH * 0.36, 0, TAU); ig.stroke();
    drawSymbol(ig, t.sym, CH * 0.56);
    ig.restore();
    ig.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 260; k++) { ig.globalAlpha = 0.3 + r() * 0.6; ig.beginPath(); ig.arc(r() * CW, r() * CH, 0.6 + r() * 2.2, 0, TAU); ig.fill(); }
    ig.globalAlpha = 1; ig.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.88; g.drawImage(ink, 0, 0); g.globalAlpha = 1;
    g.restore();
  });
  const tex = canvasTexture(c);
  const W = CW * cols, H = 1024;
  const rect = (i) => { const x0 = (i % cols) * CW, y0 = Math.floor(i / cols) * CH; return [x0 / W, 1 - (y0 + CH) / H, (x0 + CW) / W, 1 - y0 / H]; };
  return { texture: tex, rect, rows };
}

/** Notch centres along the top edge (card-local x) for 1–3 notches. */
export function notchCentres(n) { return n === 1 ? [0.028] : n === 2 ? [0.019, 0.037] : [0.011, 0.028, 0.045]; }

/**
 * A tag's card geometry: notches cut in the top edge, the eyelet hole, uvs into an atlas rect. Card-local: centred,
 * in the XY plane, front +Z.
 */
export function tagCardGeometry(notches, [u0, v0, u1, v1]) {
  const hw = TAG_W / 2, hh = TAG_H / 2, nw = 0.012, nd = 0.0145;
  const s = new THREE.Shape();
  s.moveTo(-hw + 0.011, hh);
  for (const cx of notchCentres(notches)) { s.lineTo(cx - nw / 2, hh); s.lineTo(cx - 0.0012, hh - nd); s.lineTo(cx + 0.0012, hh - nd); s.lineTo(cx + nw / 2, hh); }
  s.lineTo(hw - 0.002, hh); s.lineTo(hw, hh - 0.002); s.lineTo(hw, -hh + 0.002); s.lineTo(hw - 0.002, -hh); s.lineTo(-hw + 0.011, -hh); s.lineTo(-hw, -hh + 0.011); s.lineTo(-hw, hh - 0.011); s.closePath();
  const hole = new THREE.Path(); hole.absarc(HOLE_X, 0, 0.0042, 0, TAU, true); s.holes.push(hole);
  const geo = new THREE.ShapeGeometry(s, 10);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, u0 + (p.getX(i) + hw) / TAG_W * (u1 - u0), v0 + (p.getY(i) + hh) / TAG_H * (v1 - v0));
  return geo;
}

/** The thread twist through the eyelet, with two tails (card-local). */
export function tagThreadGeometry() {
  const x = HOLE_X;
  const loop = twistG([[x + 0.004, -0.005, 0.003], [x, 0, 0.0], [x - 0.003, 0.005, -0.003], [x - 0.012, 0.004, -0.002], [-TAG_W / 2 - 0.003, 0, 0], [x - 0.012, -0.004, 0.003], [x - 0.002, -0.006, 0.004]], 0.0021, { turns: 3, seg: 18 });
  const t1 = twistG([[x - 0.001, -0.006, 0.004], [x + 0.006, -0.02, 0.006], [x + 0.011, -0.035, 0.004]], 0.0021, { turns: 2.5, seg: 9 });
  const t2 = twistG([[x - 0.003, -0.006, 0.004], [x - 0.006, -0.022, 0.007], [x - 0.009, -0.038, 0.003]], 0.0021, { turns: 2.5, seg: 9 });
  return mergeG([loop, t1, t2]);
}

/** Molly's Marks key card (pinned to the rack's end post): small drawn version of the paper. 0.1 × 0.14 m. */
export function marksCardTexture() {
  const W = 360, H = 504, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(77);
  g.fillStyle = '#ece0bc'; g.fillRect(0, 0, W, H);
  grime(g, W, H, { seed: 77, color: '#a08048', octaves: [[4, 0.2], [20, 0.1]] });
  g.fillStyle = '#2a1e30'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold 34px ${FONTS.fell}`; g.fillText("MOLLY'S MARKS", W / 2, 46);
  g.fillRect(40, 72, W - 80, 2);
  g.textAlign = 'left'; g.font = `22px ${FONTS.hand}`;
  const rows = [['lighthouse', 'GULL POINT'], ['crown', "PRETENDER'S"], ['heart', 'SWEET NELL']];
  rows.forEach(([s, t], i) => { g.save(); g.translate(62, 118 + i * 54); drawSymbol(g, s, 40); g.restore(); g.fillText(t, 100, 120 + i * 54); });
  const threads = [['#b98ae8', 'THRUSH'], ['#2f8f3c', 'MOSS'], ['#7c4a22', 'VOLLEY'], ['#1c2c7c', 'DANE']];
  threads.forEach(([col, t], i) => { g.fillStyle = col; g.fillRect(44, 286 + i * 34, 36, 12); g.fillStyle = '#2a1e30'; g.fillText(t, 100, 292 + i * 34); });
  g.font = `22px ${FONTS.hand}`; g.fillText('notches = the Act', 44, 440);
  g.font = `18px ${FONTS.hand}`; g.fillText('Touch nothing. — M.B.', 120, 478);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(90,60,30,${r() * 0.12})`; g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3); }
  return canvasTexture(c);
}

// =====================================================================================================================
// WIG HEADS: extras on the shared wigHead() (ringlets, a powdered tower, a painted monocle)
// =====================================================================================================================
/** Long ringlets (spiral tubes) hanging round the back of a wig head at height y0. */
export function ringletsG({ y0 = 0.42, n = 7, len = 0.16, seed = 3 } = {}) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 0.55 + (i / (n - 1)) * Math.PI * 0.9 + (r() - 0.5) * 0.15; // round the back and sides
    const cx = Math.sin(a) * 0.08, cz = Math.cos(a) * 0.085, pts = [];
    for (let k = 0; k <= 30; k++) { const t = k / 30, th = t * TAU * 3.5, rr = 0.012 * (1 - t * 0.3); pts.push([cx + Math.cos(th) * rr + Math.sin(a) * t * 0.02, y0 - t * len * (0.8 + r() * 0.4), cz + Math.sin(th) * rr + Math.cos(a) * t * 0.02]); }
    out.push(tubeG(pts, 0.0065, { radial: 4, seg: 24 }));
  }
  return mergeG(out);
}
/** A powdered tower (stacked puffs) on top of a wig head. */
export function towerG({ y0 = 0.47, seed = 5 } = {}) {
  const r = rng(seed), out = [];
  const puff = new THREE.IcosahedronGeometry(0.031, 0);
  for (let i = 0; i < 26; i++) { const t = i / 26, a = i * 2.4, rr = 0.06 * (1 - t * 0.75); const s = 1.2 - t * 0.6 + r() * 0.2; out.push(puff.clone().scale(s, s * 0.9, s).translate(Math.cos(a) * rr, y0 + t * 0.2, Math.sin(a) * rr * 0.9 - 0.01)); }
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) out.push(new THREE.TorusGeometry(0.016, 0.008, 5, 9).rotateY(Math.PI / 2).translate(sx * 0.082, 0.39 - k * 0.032, -0.01));
  return mergeG(out);
}

// =====================================================================================================================
// CUTTING TABLE and what's on it
// =====================================================================================================================
function tableTopTexture() {
  const W = 1024, H = 512, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(12);
  g.fillStyle = '#b8935e'; g.fillRect(0, 0, W, H);
  // boards along the length (u) with grain
  for (let b = 0; b < 4; b++) {
    g.fillStyle = `rgba(${120 + r() * 30},${80 + r() * 20},40,0.18)`; g.fillRect(0, b * H / 4, W, H / 4);
    for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(90,55,25,${0.08 + r() * 0.12})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const y = b * H / 4 + r() * H / 4; g.moveTo(0, y); for (let x = 0; x <= W; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + k) * 3 + (r() - 0.5) * 2); g.stroke(); }
    g.fillStyle = 'rgba(40,24,10,0.6)'; g.fillRect(0, b * H / 4 - 1, W, 3);
  }
  grime(g, W, H, { seed: 12, color: '#5a3a18', octaves: [[5, 0.2], [24, 0.12], [90, 0.06]] });
  // knife scores, needle pricks
  for (let k = 0; k < 120; k++) { g.strokeStyle = `rgba(50,30,15,${0.2 + r() * 0.3})`; g.lineWidth = 1; g.beginPath(); const x = r() * W, y = r() * H, a = (r() - 0.5) * 0.6 + (r() < 0.5 ? 0 : Math.PI / 2), l = 10 + r() * 80; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  // old chalk lines (blue, white, yellow)
  for (let k = 0; k < 14; k++) {
    g.strokeStyle = ['rgba(160,180,220,0.35)', 'rgba(240,236,220,0.3)', 'rgba(230,210,120,0.3)'][k % 3]; g.lineWidth = 2 + r() * 3;
    g.beginPath(); const x = r() * W, y = r() * H; g.moveTo(x, y); g.bezierCurveTo(x + r() * 200, y + (r() - 0.5) * 120, x + r() * 260, y + (r() - 0.5) * 120, x + 120 + r() * 200, y + (r() - 0.5) * 60); g.stroke();
  }
  // an iron scorch, ink spots
  const sx = W * 0.72, sy = H * 0.3; const sg = g.createRadialGradient(sx, sy, 6, sx, sy, 60); sg.addColorStop(0, 'rgba(40,20,8,0.55)'); sg.addColorStop(1, 'rgba(40,20,8,0)'); g.fillStyle = sg; g.beginPath(); g.ellipse(sx, sy, 70, 42, 0.3, 0, TAU); g.fill();
  for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(20,20,40,0.45)'; g.beginPath(); g.arc(r() * W, r() * H, 2 + r() * 5, 0, TAU); g.fill(); }
  // an inlaid brass yard rule along the near long edge
  g.fillStyle = '#c9a24a'; g.fillRect(0, H - 26, W, 20); g.fillStyle = '#4a3410';
  for (let i = 0; i <= 72; i++) { const x = i / 72 * W; g.fillRect(x, H - 26, 2, i % 12 === 0 ? 18 : i % 2 === 0 ? 11 : 7); }
  return canvasTexture(c, { anisotropy: 8 });
}

/** Long scarred cutting table (length along Z). Origin: floor centre. userData: { topY }. */
export function cuttingTable({ l = 2.0, w = 0.9, h = 0.9 } = {}) {
  const g = grp('cuttingTable');
  const wood = M.wood({ tint: '#8a6238', planks: 0, seed: 22, roughness: 0.7 });
  const frame = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) frame.push(boxG(0.07, h - 0.05, 0.07, sx * (w / 2 - 0.06), (h - 0.05) / 2, sz * (l / 2 - 0.08), 0.006));
  for (const sx of [-1, 1]) frame.push(boxG(0.03, 0.1, l - 0.2, sx * (w / 2 - 0.06), h - 0.1, 0, 0.004), boxG(0.03, 0.05, l - 0.2, sx * (w / 2 - 0.06), 0.18, 0, 0.004));
  for (const sz of [-1, 1]) frame.push(boxG(w - 0.16, 0.1, 0.03, 0, h - 0.1, sz * (l / 2 - 0.08), 0.004));
  frame.push(boxG(w - 0.1, 0.02, l - 0.22, 0, 0.2, 0, 0.004)); // pot board
  g.add(mergeInto(frame, wood));
  const top = mesh(boxG(w, 0.05, l, 0, h - 0.025, 0, 0.008), M.wood({ tint: '#9a7044', planks: 0, seed: 23, roughness: 0.65 }));
  g.add(top);
  const tex = tableTopTexture();
  const plane = mesh(new THREE.PlaneGeometry(l, w).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72 }), { cast: false });
  plane.position.y = h + 0.0008; g.add(plane);
  g.userData.topY = h;
  return g;
}

/** Bolts of cloth for the pot board / floor: a flat card board wrapped in fabric. */
export function boltG(w = 0.6, h = 0.06, d = 0.22) { return boxG(w, h, d, 0, h / 2, 0, 0.02); }

/** Tailor's chalk: a flat triangle, rounded, blue-grey. Origin: centre, lying flat. */
export function chalkStick({ color = '#8e9cb4' } = {}) {
  const g = grp('chalk');
  const s = new THREE.Shape(); const R = 0.026;
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + Math.PI / 2; const x = Math.cos(a) * R, y = Math.sin(a) * R; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.003, bevelSegments: 2 }).rotateX(-Math.PI / 2).translate(0, 0.0015, 0);
  const m = mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1 }), { cast: false });
  g.add(m); g.userData.body = m;
  return g;
}

/** Dressmaker's shears lying flat, slightly open. Origin: pivot on the table. 2 draw calls. */
export function shears({ open = 0.32 } = {}) {
  const g = grp('shears');
  const blade = new THREE.Shape();
  blade.moveTo(0, -0.008); blade.lineTo(0.17, -0.002); blade.lineTo(0.175, 0.0); blade.lineTo(0, 0.009); blade.lineTo(-0.03, 0.006); blade.lineTo(-0.03, -0.006); blade.closePath();
  const bg = new THREE.ExtrudeGeometry(blade, { depth: 0.003, bevelEnabled: false }).rotateX(-Math.PI / 2);
  const steel = [bg.clone().rotateY(open / 2).translate(0, 0.004, 0), bg.clone().rotateY(-open / 2).translate(0, 0.008, 0), cylG(0.006, 0.006, 0.012, 12, 0, 0.006, 0)];
  g.add(mergeInto(steel, M.iron({ color: '#b8b8b4', roughness: 0.25 })));
  const h = [];
  for (const [s, sc] of [[1, [1, 1.4]], [-1, [1, 1]]]) {
    const a = Math.PI + s * open / 2;
    h.push(new THREE.TorusGeometry(0.022, 0.0055, 8, 20).scale(sc[1], sc[0], 1).rotateX(Math.PI / 2).translate(Math.cos(a) * 0.065, 0.006, -Math.sin(a) * 0.065));
    h.push(boxG(0.04, 0.006, 0.01, Math.cos(a) * 0.035, 0.006, -Math.sin(a) * 0.035, 0.002).rotateY(0));
  }
  g.add(mergeInto(h, M.japanned()));
  return g;
}

/** Tomato pincushion with a strawberry emery, pins, and one long pearl hatpin through its heart. */
export function pincushion() {
  const g = grp('pincushion');
  const sg = new THREE.SphereGeometry(0.045, 28, 16), p = sg.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const th = Math.atan2(z, x); const k = 1 - 0.07 * Math.pow(Math.abs(Math.sin(th * 4)), 0.6) * (1 - Math.abs(y) / 0.045); p.setXYZ(i, x * k, y * 0.66, z * k); }
  sg.computeVertexNormals(); sg.translate(0, 0.03, 0);
  g.add(mesh(sg, new THREE.MeshStandardMaterial({ color: '#b8241c', roughness: 0.85, map: null })));
  const leaf = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i * TAU / 10, rr = i % 2 ? 0.006 : 0.022; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? leaf.lineTo(x, y) : leaf.moveTo(x, y); } leaf.closePath();
  const greens = [new THREE.ShapeGeometry(leaf).rotateX(-Math.PI / 2).translate(0, 0.0605, 0), cylG(0.003, 0.003, 0.012, 6, 0, 0.066, 0), tubeG([[0.02, 0.05, 0.03], [0.05, 0.02, 0.06], [0.065, 0.02, 0.07]], 0.0015, { radial: 4 }), latheG([[0, 0], [0.008, 0.004], [0.01, 0.014], [0.006, 0.024], [0, 0.026]], 10).rotateX(Math.PI).translate(0.066, 0.028, 0.072)];
  g.add(mergeInto(greens, M.matte('#3e6a2a', { roughness: 0.9 })));
  const pins = [], heads = [], r = rng(9);
  for (let i = 0; i < 9; i++) {
    const th = r() * TAU, ph = 0.3 + r() * 0.9, d = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph) * 0.7, Math.sin(ph) * Math.sin(th)).normalize();
    const base = d.clone().multiplyScalar(0.04).add(new THREE.Vector3(0, 0.03, 0)), tip = base.clone().add(d.clone().multiplyScalar(0.018));
    pins.push(tubeG([base, tip], 0.0006, { radial: 3, seg: 1 }));
    heads.push(new THREE.SphereGeometry(0.0028, 8, 6).translate(tip.x, tip.y, tip.z));
  }
  // the hatpin through its heart
  pins.push(cylG(0.0011, 0.0011, 0.15, 6).rotateZ(Math.PI / 2 - 0.25).rotateY(0.4).translate(0.0, 0.035, 0));
  const hp = new THREE.Vector3(0.075, 0, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), -0.25).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.4).add(new THREE.Vector3(0, 0.035, 0));
  g.add(mergeInto(pins, M.iron({ color: '#c8c8c4', roughness: 0.3 }), { cast: false }));
  g.add(mergeInto(heads, M.porcelain('#e8e2d6'), { cast: false }));
  g.add(at(mesh(new THREE.SphereGeometry(0.0075, 12, 8), M.porcelain('#f4ece0'), { cast: false }), hp.x, hp.y, hp.z));
  return g;
}

function tapeTexture() {
  const W = 2048, H = 64, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#e2c24a'; g.fillRect(0, 0, W, H);
  grime(g, W, H, { seed: 5, color: '#8a6a20', octaves: [[8, 0.15]] });
  g.fillStyle = '#2a1a0c'; g.font = `bold 26px ${FONTS.ui}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i <= 64; i++) { const x = i / 64 * W; g.fillRect(x, 0, 2, i % 4 === 0 ? 22 : 12); if (i % 4 === 0) g.fillText(String(i), x + 14, 44); }
  const t = canvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(1 / 0.8, 1); return t;
}
/** A coiled tape measure (spiral ribbon on edge) with a tail lying out and draping over the edge at (tail). */
export function tapeMeasure({ tail = [[0.05, 0], [0.2, 0.02], [0.3, 0.03]], drape = 0.12 } = {}) {
  const g = grp('tapeMeasure');
  const pts = [], ups = [], wdt = 0.016, turns = 4.5;
  for (let i = 0; i <= 160; i++) { const th = i / 160 * turns * TAU, rr = 0.012 + 0.024 * i / 160; pts.push(new THREE.Vector3(Math.cos(th) * rr, wdt / 2 + 0.0005, Math.sin(th) * rr)); ups.push(new THREE.Vector3(0, 1, 0)); }
  // the tail: twists flat and runs out across the table, then over the edge and down
  const last = pts[pts.length - 1].clone();
  const flat = (a, b) => new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3(0, 1, 0)).normalize();
  let prev = last;
  tail.forEach(([x, z], i) => { const p = new THREE.Vector3(last.x + x, 0.0012, last.z + z); const k = Math.min(1, (i + 1) / 2); const f = flat(prev, p); ups.push(new THREE.Vector3(0, 1, 0).lerp(f, k).normalize()); pts.push(p); prev = p; });
  const end = pts[pts.length - 1].clone(), dir = new THREE.Vector3().subVectors(end, pts[pts.length - 2]).setY(0).normalize();
  for (let k = 1; k <= 4; k++) { const t = k / 4, p = end.clone().add(dir.clone().multiplyScalar(0.012 * Math.sin(t * Math.PI / 2) + 0.004)); p.y = -drape * (1 - Math.cos(t * Math.PI / 2)) * 1.0; pts.push(p); ups.push(flat(end, end.clone().add(dir))); }
  g.add(mesh(ribbonG(pts, ups, wdt), new THREE.MeshStandardMaterial({ map: tapeTexture(), roughness: 0.6, side: THREE.DoubleSide }), { cast: false }));
  // brass end tab
  const tip = pts[pts.length - 1];
  g.add(at(mesh(boxG(0.018, 0.012, 0.004, 0, 0, 0, 0.001), M.brass(), { cast: false }), tip.x, tip.y - 0.004, tip.z));
  return g;
}

// =====================================================================================================================
// THE ORDER PAD (rubbing surface): a dynamic canvas. Paper + chalk layer with the indented writing cut out of it.
// =====================================================================================================================
const PAD_TEXT = ['Thrush storm cape —', 'oilskin, sea-green —', 'in the RED hatbox,', 'BOTTOM of the pile', '(sorry).', 'Storm skirt hem at', 'the machine.   — M.'];
/**
 * The order pad lying flat. Origin: centre of the pad's base; the top of the page faces -Z (the reader stands at +Z).
 * userData: { sheet (Mesh with uv), rubAt(u, v, r), rubLine(u0, v0, u1, v1, r), coverage() (0..1 of the writing),
 * setRevealed(b), reset(), uvFromRay(ray) → {u, v} | null, textRect [u0, v0, u1, v1] }. r is in u units (0..1 of the
 * width). Cost: 2 draw calls.
 */
export function orderPad({ w = 0.15, h = 0.21 } = {}) {
  const g = grp('orderPad');
  const W = 512, H = Math.round(512 * h / w);
  // block: card back + paper edges
  g.add(mergeInto([boxG(w + 0.004, 0.003, h + 0.004, 0, 0.0015, 0, 0.001)], M.matte('#5a4630', { roughness: 0.9 }), { cast: false }));
  g.add(mergeInto([boxG(w, 0.009, h, 0, 0.0075, 0, 0.0015)], M.matte('#e8e0cc', { roughness: 0.95 }), { cast: false }));
  // paper base (printed header, faint rules)
  const paper = makeCanvas(W, H), pg = paper.getContext('2d');
  pg.fillStyle = '#d6ccb2'; pg.fillRect(0, 0, W, H);
  grime(pg, W, H, { seed: 66, color: '#b09060', octaves: [[4, 0.1], [20, 0.06]] });
  pg.fillStyle = '#a3201c'; pg.textAlign = 'center'; pg.textBaseline = 'middle';
  pg.font = `bold 30px ${FONTS.fell}`; pg.fillText('EMPRESS THEATRE', W / 2, 44);
  pg.font = `20px ${FONTS.typed}`; pg.fillText('WARDROBE  —  ORDER / NOTE', W / 2, 78);
  pg.fillRect(36, 96, W - 72, 2);
  pg.fillStyle = 'rgba(80,110,170,0.22)'; for (let y = 150; y < H - 30; y += 64) pg.fillRect(36, y + 26, W - 72, 1.5);
  pg.fillStyle = 'rgba(163,32,28,0.35)'; pg.fillRect(70, 100, 1.5, H - 130);
  // the indent mask: Molly's writing, pressed through from the sheet above
  const indent = makeCanvas(W, H), ig = indent.getContext('2d');
  ig.fillStyle = '#fff'; ig.textAlign = 'left'; ig.textBaseline = 'alphabetic'; ig.font = `34px ${FONTS.hand}`;
  ig.lineWidth = 2.2; ig.strokeStyle = '#fff';
  PAD_TEXT.forEach((t, i) => { const y = 168 + i * 64; ig.fillText(t, 84, y); ig.strokeText(t, 84, y); });
  ig.beginPath(); ig.moveTo(300, 168 + 3 * 64 + 10); ig.lineTo(460, 168 + 3 * 64 + 6); ig.lineWidth = 3; ig.stroke(); // underline BOTTOM
  // faint raking-light trace of the indents (barely there before rubbing)
  pg.save(); pg.globalAlpha = 0.07; pg.drawImage(indent, 1, 1); pg.globalAlpha = 0.05; pg.globalCompositeOperation = 'multiply'; pg.filter = 'none'; pg.restore();
  pg.save(); pg.globalAlpha = 0.06; pg.globalCompositeOperation = 'source-over';
  const shadowCv = makeCanvas(W, H), sgc = shadowCv.getContext('2d'); sgc.drawImage(indent, 0, 0); sgc.globalCompositeOperation = 'source-in'; sgc.fillStyle = '#6a5a40'; sgc.fillRect(0, 0, W, H);
  pg.drawImage(shadowCv, -1, -1); pg.restore();
  // text rect + coverage grid (only cells that contain writing count)
  const tx0 = 76, tx1 = 476, ty0 = 128, ty1 = 168 + 6 * 64 + 16;
  const GX = 26, GY = 22, cells = new Uint8Array(GX * GY), textCell = new Uint8Array(GX * GY);
  const idata = ig.getImageData(0, 0, W, H).data;
  let textCells = 0;
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const x0 = tx0 + (tx1 - tx0) * i / GX, x1 = tx0 + (tx1 - tx0) * (i + 1) / GX, y0 = ty0 + (ty1 - ty0) * j / GY, y1 = ty0 + (ty1 - ty0) * (j + 1) / GY;
    let n = 0;
    for (let y = Math.floor(y0); y < y1; y += 2) for (let x = Math.floor(x0); x < x1; x += 2) if (idata[(y * W + x) * 4 + 3] > 40) n++;
    if (n > 2) { textCell[j * GX + i] = 1; textCells++; }
  }
  const chalk = makeCanvas(W, H), cg = chalk.getContext('2d');
  const view = makeCanvas(W, H), vg = view.getContext('2d');
  const tex = canvasTexture(view);
  const sheet = mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }), { cast: false });
  sheet.position.y = 0.0122; sheet.name = 'padSheet';
  g.add(sheet);
  const r = rng(5);
  const compose = () => {
    cg.save(); cg.globalCompositeOperation = 'destination-out'; cg.drawImage(indent, 0, 0); cg.restore();
    vg.clearRect(0, 0, W, H); vg.drawImage(paper, 0, 0); vg.drawImage(chalk, 0, 0);
    tex.needsUpdate = true;
  };
  const dab = (x, y, rad) => {
    for (let k = 0; k < 7; k++) {
      const a = r() * TAU, d = Math.sqrt(r()) * rad;
      cg.fillStyle = `rgba(${96 + r() * 20},${108 + r() * 20},${132 + r() * 20},${0.16 + r() * 0.12})`;
      cg.beginPath(); cg.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, rad * (0.25 + r() * 0.3), rad * (0.12 + r() * 0.12), r() * 3, 0, TAU); cg.fill();
    }
    // mark coverage cells
    const ci0 = Math.floor((x - rad - tx0) / (tx1 - tx0) * GX), ci1 = Math.floor((x + rad - tx0) / (tx1 - tx0) * GX);
    const cj0 = Math.floor((y - rad - ty0) / (ty1 - ty0) * GY), cj1 = Math.floor((y + rad - ty0) / (ty1 - ty0) * GY);
    for (let j = Math.max(0, cj0); j <= Math.min(GY - 1, cj1); j++) for (let i = Math.max(0, ci0); i <= Math.min(GX - 1, ci1); i++) {
      const cx = tx0 + (tx1 - tx0) * (i + 0.5) / GX, cy = ty0 + (ty1 - ty0) * (j + 0.5) / GY;
      if ((cx - x) ** 2 + (cy - y) ** 2 < rad * rad * 1.1) cells[j * GX + i] = Math.min(255, cells[j * GX + i] + 1);
    }
  };
  const toPx = (u, v) => [u * W, (1 - v) * H];
  g.userData.rubLine = (u0, v0, u1, v1, rr = 0.06) => {
    const [x0, y0] = toPx(u0, v0), [x1, y1] = toPx(u1, v1), rad = rr * W;
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (rad * 0.35)));
    for (let i = 0; i <= n; i++) dab(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, rad);
    compose();
  };
  g.userData.rubAt = (u, v, rr = 0.06) => g.userData.rubLine(u, v, u, v, rr);
  g.userData.coverage = () => { let n = 0; for (let i = 0; i < cells.length; i++) if (textCell[i] && cells[i] >= 2) n++; return textCells ? n / textCells : 0; };
  g.userData.setRevealed = (b) => {
    cg.clearRect(0, 0, W, H); cells.fill(0);
    if (b) { cg.fillStyle = 'rgba(110,122,146,0.85)'; cg.beginPath(); cg.roundRect(tx0 - 18, ty0 - 4, tx1 - tx0 + 30, ty1 - ty0 + 10, 30); cg.fill(); for (let i = 0; i < 900; i++) dab(tx0 + r() * (tx1 - tx0), ty0 + r() * (ty1 - ty0), 18); cells.fill(4); }
    compose();
  };
  g.userData.reset = () => g.userData.setRevealed(false);
  const ray0 = new THREE.Raycaster();
  g.userData.uvFromRay = (ray) => { ray0.ray.copy(ray); const hit = ray0.intersectObject(sheet, false)[0]; return hit && hit.uv ? { u: hit.uv.x, v: hit.uv.y, point: hit.point } : null; };
  g.userData.textRect = [tx0 / W, 1 - ty1 / H, tx1 / W, 1 - ty0 / H];
  g.userData.sheet = sheet;
  compose();
  return g;
}

// =====================================================================================================================
// SEWING: metronome (with bell and red spring flag), oil can, the skirt under the needle, needle bar, presser foot
// =====================================================================================================================
function metronomeFaceTexture() {
  const W = 256, H = 512, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#e8dcbc'; g.fillRect(0, 0, W, H);
  grime(g, W, H, { seed: 3, color: '#8a6a3a', octaves: [[4, 0.2], [16, 0.1]] });
  g.fillStyle = '#3a2410'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold 22px ${FONTS.fell}`; g.fillText('MAELZEL', W / 2, 40);
  const marks = [40, 52, 60, 72, 84, 96, 108, 120, 144, 176, 208];
  marks.forEach((m, i) => { const y = 470 - i * 38; g.fillRect(W / 2 - 22, y, 44, 2); g.font = `${m === 60 ? 'bold ' : ''}18px ${FONTS.fell}`; g.fillStyle = m === 60 ? '#a3201c' : '#3a2410'; g.fillText(String(m), W / 2 + 52, y + 1); g.fillStyle = '#3a2410'; });
  g.font = `italic 16px ${FONTS.fell}`; g.fillText('Largo', W / 2 - 60, 450); g.fillText('Allegro', W / 2 - 60, 200);
  return canvasTexture(c);
}
/**
 * A wooden pyramid metronome with a swinging arm, a brass bell on a bracket at the top right and a red flag on a spring
 * that flicks up on each ONE. Origin: base centre; faces +Z. ~0.3 m tall.
 * userData: { arm (pivot group, rotation.z), flag (pivot group), bell (group), setArm(rad), setFlag(0..1),
 *   ring() (bell shudder + flag up for flagHold s, visual only), run(startMs, { bpm, beatsPerBar }), stop(),
 *   running, beatAt(ms) → { beat, index, isOne, sinceOne, untilOne }, inWindow(ms, before=0.1, after=0.5) (the ONE
 *   window from the metronome's own clock), onBeat(fn(index, isOne)) → unsubscribe, flagHold }.
 * The run clock is performance.now(): it never depends on frame callbacks for timing.
 */
export function metronome({ scale = 1 } = {}) {
  const g = grp('metronome');
  const S = scale, H = 0.27 * S, B = 0.15 * S, T = 0.055 * S;
  const walnut = M.walnut();
  // body: a square frustum, front face open to a recessed scale panel
  const body = new THREE.CylinderGeometry(T / Math.SQRT2 * 1.0, B / Math.SQRT2 * 1.0, H, 4, 1).rotateY(Math.PI / 4).translate(0, H / 2 + 0.015 * S, 0);
  const base = boxG(B + 0.03 * S, 0.018 * S, B + 0.03 * S, 0, 0.009 * S, 0, 0.003);
  const cap = new THREE.CylinderGeometry(0.004, T / Math.SQRT2 + 0.006 * S, 0.035 * S, 4).rotateY(Math.PI / 4).translate(0, H + 0.015 * S + 0.0175 * S, 0);
  g.add(mergeInto([body, base, cap], walnut));
  // the scale panel on the front face (a slanted plane)
  const slope = Math.atan2((B - T) / 2, H);
  const panel = mesh(new THREE.PlaneGeometry(T * 0.62, H * 0.78), new THREE.MeshStandardMaterial({ map: metronomeFaceTexture(), roughness: 0.7 }), { cast: false });
  panel.position.set(0, 0.015 * S + H * 0.47, (B + T) / 4 + 0.0025); panel.rotation.x = -slope; g.add(panel);
  // the arm: pivot near the base, rod up past the top, a sliding brass weight
  const arm = grp('arm'); arm.position.set(0, 0.04 * S, (B / 2) - 0.012 * S + 0.006); g.add(arm);
  arm.add(mergeInto([cylG(0.0025 * S, 0.0025 * S, H * 1.08, 6, 0, H * 0.54, 0), new THREE.CylinderGeometry(0.012 * S, 0.016 * S, 0.026 * S, 4).rotateY(Math.PI / 4).translate(0, H * 0.62, 0.004)], M.brass({ polished: true })));
  // bell bracket and bell on the top right; flag on a spring
  const bell = grp('bell'); bell.position.set(T / 2 + 0.03 * S, H * 0.92, 0); g.add(bell);
  bell.add(mergeInto([latheG([[0, 0.028 * S], [0.008 * S, 0.027 * S], [0.02 * S, 0.016 * S], [0.026 * S, 0.0], [0.024 * S, -0.002 * S], [0.0, 0.004 * S]], 20)], M.brass({ polished: true })));
  g.add(mergeInto([tubeG([[T / 2 - 0.004, H * 0.8, 0], [T / 2 + 0.02 * S, H * 0.86, 0], [T / 2 + 0.03 * S, H * 0.94, 0]], 0.0022 * S, { radial: 5 })], M.iron({ color: '#4a4640' })));
  const flag = grp('flag'); flag.position.set(T / 2 + 0.058 * S, H * 0.9, 0.006); g.add(flag);
  const spring = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * TAU * 6; spring.push([Math.cos(a) * 0.004 * S, t * 0.03 * S, Math.sin(a) * 0.004 * S]); }
  flag.add(mergeInto([tubeG(spring, 0.0009 * S, { radial: 4, seg: 80 }), cylG(0.0013 * S, 0.0013 * S, 0.06 * S, 5, 0, 0.06 * S, 0)], M.iron({ color: '#5a5650', roughness: 0.4 }), { cast: false }));
  const flagMat = new THREE.MeshStandardMaterial({ color: '#d81e18', roughness: 0.6, emissive: '#5a0806', emissiveIntensity: 0.6, side: THREE.DoubleSide });
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(0.05 * S, 0.004 * S); fs.lineTo(0.044 * S, 0.018 * S); fs.lineTo(0.05 * S, 0.034 * S); fs.lineTo(0, 0.035 * S); fs.closePath();
  const flagMesh = mesh(new THREE.ShapeGeometry(fs).translate(0.0012 * S, 0.055 * S, 0), flagMat, { cast: false });
  flag.add(flagMesh);
  const DOWN = -2.05, UP = 0.0;
  let armA = 0, flagK = 0, flagT = 0, ringT = 0;
  g.userData.setArm = (a) => { armA = a; arm.rotation.z = a; };
  g.userData.setFlag = (k) => { flagK = k; flagT = k; flag.rotation.z = DOWN + (UP - DOWN) * k; };
  g.userData.flagHold = 0.5;
  const subs = new Set();
  let run = null;
  g.userData.onBeat = (fn) => { subs.add(fn); return () => subs.delete(fn); };
  g.userData.run = (startMs = performance.now(), { bpm = 60, beatsPerBar = 3 } = {}) => { run = { start: startMs, period: 60000 / bpm, bpb: beatsPerBar, last: -1 }; g.userData.running = true; };
  g.userData.stop = () => { run = null; g.userData.running = false; flagT = 0; };
  g.userData.running = false;
  g.userData.beatAt = (ms = performance.now()) => {
    if (!run) return null;
    const beat = (ms - run.start) / run.period, index = Math.floor(beat), bar = run.bpb * run.period / 1000;
    const sinceBar = ((beat % run.bpb) + run.bpb) % run.bpb * run.period / 1000;
    return { beat, index, isOne: index >= 0 && index % run.bpb === 0, sinceOne: sinceBar, untilOne: bar - sinceBar };
  };
  g.userData.inWindow = (ms = performance.now(), before = 0.1, after = 0.5) => {
    const b = g.userData.beatAt(ms); if (!b || b.beat < -before * 1000 / run.period) return false;
    return b.sinceOne <= after || b.untilOne <= before;
  };
  g.userData.ring = () => { ringT = 0.35; flagT = 1; flagK = Math.max(flagK, 0.001); };
  g.userData.update = (dt) => {
    if (run) {
      const b = g.userData.beatAt();
      // the arm reaches an extreme on every beat: swing = A·cos(π·beat)
      arm.rotation.z = 0.42 * Math.cos(Math.PI * b.beat);
      if (b.index !== run.last && b.index >= 0) { run.last = b.index; for (const f of subs) { try { f(b.index, b.isOne); } catch (e) { console.error(e); } } if (b.isOne) ringT = 0.35; }
      flagT = b.beat >= 0 && b.sinceOne <= g.userData.flagHold ? 1 : 0;
    } else {
      arm.rotation.z = chase(arm.rotation.z, armA, dt, 4);
    }
    flagK = chase(flagK, flagT, dt, flagT > flagK ? 30 : 9);
    flag.rotation.z = DOWN + (UP - DOWN) * flagK + (flagT > 0.5 ? Math.sin(performance.now() / 30) * 0.05 * (1 - Math.min(1, flagK)) : 0);
    if (ringT > 0) { ringT = Math.max(0, ringT - dt); bell.rotation.z = Math.sin(ringT * 90) * 0.12 * (ringT / 0.35); }
  };
  g.userData.arm = arm; g.userData.flag = flag; g.userData.bell = bell; g.userData.flagMesh = flagMesh;
  g.userData.setFlag(0);
  return g;
}

/** A pump oil can (tinned steel, red band, long spout). Origin: base centre; spout toward +X. 2 draw calls. */
export function oilCan() {
  const g = grp('oilCan');
  const body = latheG([[0, 0], [0.045, 0], [0.048, 0.006], [0.046, 0.03], [0.036, 0.046], [0.014, 0.056], [0.012, 0.066], [0.0, 0.066]], 24);
  const spout = tubeG([[0.008, 0.06, 0], [0.05, 0.085, 0], [0.11, 0.11, 0], [0.16, 0.128, 0]], 0.004, { radial: 6 });
  const pump = cylG(0.007, 0.007, 0.02, 10, -0.02, 0.05, 0).rotateZ(0.5);
  const handle = tubeG([[-0.03, 0.044, 0], [-0.06, 0.04, 0], [-0.062, 0.016, 0], [-0.042, 0.01, 0]], 0.003, { radial: 5 });
  g.add(mergeInto([body, spout, pump, handle], M.iron({ color: '#8c887c', roughness: 0.35 })));
  g.add(mergeInto([cylG(0.0475, 0.0475, 0.012, 24, 0, 0.018, 0, true)], M.enamel('#a8201a', { roughness: 0.45 }), { cast: false }));
  return g;
}

function skirtTexture() {
  const W = 1024, H = 1024, c = makeCanvas(W, H);
  return { c, g: c.getContext('2d'), W, H };
}
/**
 * The storm-grey skirt pinned under the needle (machine-local coordinates of T.sewingMachine(): the bed at
 * y = 0.81, the sewer at +Z). The hem runs along X across the bed in four chalk-marked quarters.
 * userData: { cloth, setStitches(n 0..4), stitches, quarterX[4] ([x0, x1] machine-local), hemZ }.
 */
export function machineSkirt({ color = '#7c8590', drop = 0.3 } = {}) {
  const g = grp('machineSkirt');
  const x0 = -0.5, x1 = 0.1, zBack = -0.16, zEdge = 0.235, topY = 0.79, nx = 40, nz = 34;
  const geo = new THREE.PlaneGeometry(1, 1, nx, nz), p = geo.attributes.position, uv = geo.attributes.uv;
  const r = rng(4);
  const totalLen = (zEdge - zBack) + drop;
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i), v = 1 - uv.getY(i); // v: 0 at the back, 1 at the hanging end
    const x = x0 + (x1 - x0) * u, s = v * totalLen;
    let y, z;
    if (s <= zEdge - zBack) { z = zBack + s; y = topY + 0.002 + (x > -0.2 && x < 0.2 && z < 0.055 && z > -0.135 ? 0.02 : 0); }
    else { const d = s - (zEdge - zBack); const a = Math.min(1, d / 0.05); z = zEdge + 0.02 * Math.sin(a * Math.PI / 2) + d * 0.08; y = topY - d; }
    // folds grow with the drop
    const hang = Math.max(0, s - (zEdge - zBack));
    const fold = Math.sin(x * 38 + 1.3) * 0.012 + Math.sin(x * 71 + 0.4) * 0.006;
    z += fold * Math.min(1, hang / 0.25) + (r() - 0.5) * 0.0008;
    // the front of the bed lifts the cloth slightly where it rides over the edge
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const { c, g: cg, W, H } = skirtTexture();
  const tex = canvasTexture(c);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, side: THREE.DoubleSide });
  const cloth = mesh(geo, mat); cloth.castShadow = false; g.add(cloth);
  // hem geometry in texture space: u along x, v along the cloth from the back
  const hemZ = 0.0, hemV = (hemZ - zBack) / totalLen;
  const qx = [[-0.43, -0.33], [-0.33, -0.23], [-0.23, -0.13], [-0.13, -0.03]];
  const ux = (x) => (x - x0) / (x1 - x0) * W, vy = (v) => v * H;
  const base = makeCanvas(W, H), bg = base.getContext('2d');
  bg.fillStyle = color; bg.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 3) { bg.fillStyle = `rgba(255,255,255,${0.025 + Math.random() * 0.03})`; bg.fillRect(0, y, W, 1); }
  for (let x = 0; x < W; x += 3) { bg.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.03})`; bg.fillRect(x, 0, 1, H); }
  // silk sheen bands
  for (let k = 0; k < 6; k++) { const gx = Math.random() * W; const gr = bg.createLinearGradient(gx - 60, 0, gx + 60, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.07)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); bg.fillStyle = gr; bg.fillRect(gx - 60, 0, 120, H); }
  // the folded hem: a darker band whose edge is the hem line (stitched part done to the left of the quarters)
  const hy = vy(hemV);
  bg.fillStyle = 'rgba(30,34,40,0.22)'; bg.fillRect(0, hy - 34, W, 34);
  bg.fillStyle = 'rgba(255,255,255,0.12)'; bg.fillRect(0, hy - 36, W, 3);
  // already-done hem stitching to the left of the quarters
  bg.strokeStyle = '#3c424a'; bg.lineWidth = 3; bg.setLineDash([10, 6]); bg.beginPath(); bg.moveTo(0, hy - 14); bg.lineTo(ux(qx[0][0]) - 4, hy - 14); bg.stroke(); bg.setLineDash([]);
  // pins along the hem beyond the quarters
  bg.fillStyle = '#d8d8d4'; for (let x = ux(qx[3][1]) + 20; x < W; x += 50) { bg.fillRect(x, hy - 40, 3, 50); bg.beginPath(); bg.arc(x + 1.5, hy - 42, 5, 0, TAU); bg.fill(); }
  let n = 0;
  const draw = () => {
    cg.drawImage(base, 0, 0);
    qx.forEach(([a, b], i) => {
      const xa = ux(a) + 3, xb = ux(b) - 3;
      // quarter tick marks (chalk)
      cg.fillStyle = 'rgba(240,240,236,0.95)'; cg.fillRect(ux(a) - 2, hy - 44, 5, 40);
      if (i === 3) cg.fillRect(ux(b) - 2, hy - 44, 5, 40);
      if (i < n) { // stitched
        cg.strokeStyle = '#2a2e34'; cg.lineWidth = 4; cg.setLineDash([12, 5]); cg.beginPath(); cg.moveTo(xa, hy - 14); cg.lineTo(xb, hy - 14); cg.stroke(); cg.setLineDash([]);
        cg.strokeStyle = 'rgba(200,200,190,0.18)'; cg.lineWidth = 2; cg.beginPath(); cg.moveTo(xa, hy - 16); cg.lineTo(xb, hy - 16); cg.stroke();
      } else { // the chalk line
        cg.strokeStyle = 'rgba(236,236,230,0.9)'; cg.lineWidth = 5; cg.setLineDash([16, 10]); cg.beginPath(); cg.moveTo(xa, hy - 14); cg.lineTo(xb, hy - 14); cg.stroke(); cg.setLineDash([]);
      }
    });
    tex.needsUpdate = true;
  };
  g.userData.setStitches = (k) => { n = Math.max(0, Math.min(4, k | 0)); g.userData.stitches = n; draw(); };
  g.userData.setStitches(0);
  g.userData.cloth = cloth; g.userData.quarterX = qx; g.userData.hemZ = hemZ;
  return g;
}

// =====================================================================================================================
// CAPES: worn on the dummy (open front) and folded in the red hatbox. Sea-green oilskin.
// =====================================================================================================================
let oilskinMat = null;
export function oilskin() {
  if (!oilskinMat) oilskinMat = new THREE.MeshPhysicalMaterial({ color: '#3e8a78', roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.3, side: THREE.DoubleSide, map: null });
  return oilskinMat;
}
/** The cape as worn on the dressmaker's dummy (dummy-local, ~1.5 m dummy). */
export function dummyCapeGeometry() {
  const S = (y, rx, rz, f = 0, z = 0) => ({ y, rx, rz, f, z });
  const body = loftG([S(1.405, 0.062, 0.05), S(1.37, 0.16, 0.115), S(1.32, 0.235, 0.16, 0.004), S(1.2, 0.27, 0.19, 0.012, -0.01), S(0.95, 0.3, 0.22, 0.025, -0.015), S(0.62, 0.34, 0.25, 0.035, -0.02)], { seg: 48, seed: 12, arc: [0.42, TAU - 0.42], folds: [6, 11, 17] });
  const collar = loftG([S(1.45, 0.072, 0.062), S(1.405, 0.078, 0.066), S(1.38, 0.1, 0.085)], { seg: 28, seed: 13, arc: [0.5, TAU - 0.5] });
  return mergeG([body, collar]);
}
/** A folded oilskin bundle (for the inside of the red hatbox). Origin: base centre. */
export function capeBundle() {
  const S = (y, rx, rz, f = 0) => ({ y, rx, rz, f });
  const g = loftG([S(0.11, 0.02, 0.015), S(0.1, 0.13, 0.1, 0.006), S(0.06, 0.17, 0.13, 0.01), S(0.0, 0.18, 0.14, 0.008)], { seg: 36, seed: 21, capTop: true, folds: [3, 7, 12] });
  const m = mesh(g, oilskin());
  return m;
}

// =====================================================================================================================
// LENS: felt tray, ring of light
// =====================================================================================================================
/** Felt-lined tray for the lens rings. Origin: base centre. 2 draw calls. */
export function feltTray({ w = 1.1, d = 0.27 } = {}) {
  const g = grp('feltTray');
  const t = 0.012, h = 0.035;
  g.add(mergeInto([boxG(w, 0.01, d, 0, 0.005, 0, 0.002), boxG(w, h, t, 0, h / 2, d / 2 - t / 2, 0.002), boxG(w, h, t, 0, h / 2, -d / 2 + t / 2, 0.002), boxG(t, h, d, w / 2 - t / 2, h / 2, 0, 0.002), boxG(t, h, d, -w / 2 + t / 2, h / 2, 0, 0.002)], M.walnut()));
  g.add(at(mesh(new THREE.PlaneGeometry(w - 2 * t, d - 2 * t).rotateX(-Math.PI / 2), M.baize('#2e4a7a'), { cast: false }), 0, 0.0105, 0));
  return g;
}
/** A soft ring of light (additive) for the wall behind the finished lamp. userData: { setLevel(0..1) }. */
export function ringOfLight({ r0 = 0.12, r1 = 0.42 } = {}) {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,220,150,0.0)'); gr.addColorStop(0.42, 'rgba(255,220,150,0.05)'); gr.addColorStop(0.62, 'rgba(255,226,170,0.85)'); gr.addColorStop(0.7, 'rgba(255,236,190,1)'); gr.addColorStop(0.8, 'rgba(255,220,150,0.35)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  // prism banding
  g.globalCompositeOperation = 'destination-out'; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3;
  for (const rr of [70, 84, 98, 112]) { g.beginPath(); g.arc(128, 128, rr, 0, TAU); g.stroke(); }
  const tex = canvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(1.6, 1.4, 1.1) });
  const m = noRay(new THREE.Mesh(new THREE.PlaneGeometry(r1 * 2, r1 * 2), mat));
  m.renderOrder = 6;
  m.userData.setLevel = (k) => { mat.opacity = k; m.visible = k > 0.001; };
  m.userData.setLevel(0);
  return m;
}

// =====================================================================================================================
// THE PROPS SHELF: bays, labels atlas, the five named fakes and the clutter
// =====================================================================================================================
/**
 * One bay of timber props shelving: uprights only at the ends, shelves with lips, a plank back.
 * Origin: base centre; faces +Z. userData: { shelfY[], w, d }. Pure statics (merge them).
 */
export function shelfBay({ w = 1.6, h = 3.0, d = 0.42, shelves = 6 } = {}) {
  const g = grp('shelfBay');
  const geos = [];
  for (const s of [-1, 1]) for (const z of [-1, 1]) geos.push(boxG(0.055, h, 0.055, s * (w / 2 - 0.0275), h / 2, z * (d / 2 - 0.0275), 0.004));
  const ys = [];
  for (let i = 0; i < shelves; i++) {
    const y = 0.12 + i * (h - 0.2) / (shelves - 1);
    geos.push(boxG(w - 0.11, 0.03, d - 0.01, 0, y, 0, 0.004), boxG(w - 0.11, 0.045, 0.02, 0, y + 0.012, d / 2 - 0.012, 0.003));
    ys.push(y + 0.015);
  }
  g.add(mergeInto(geos, M.dustyWood()));
  g.add(mesh(boxG(w - 0.02, h - 0.04, 0.012, 0, h / 2, -d / 2 + 0.006, 0.002), M.wood({ tint: '#5e4c3a', planks: 6, seed: 4, roughness: 0.9 })));
  g.userData.shelfY = ys; g.userData.w = w; g.userData.d = d;
  return g;
}

/** All the shelf-edge card labels in one atlas mesh. items: [{ text, pos:[x,y,z], w }]. 1 draw call. */
export function labelStrip(items, { seed = 3 } = {}) {
  const PW = 384, PH = 96, cols = 4, rows = Math.ceil(items.length / cols);
  const c = makeCanvas(PW * cols, PH * rows), g = c.getContext('2d'), r = rng(seed);
  const geos = [];
  items.forEach((it, i) => {
    const x0 = (i % cols) * PW, y0 = Math.floor(i / cols) * PH;
    g.save(); g.translate(x0, y0);
    g.fillStyle = '#e6d4a8'; g.fillRect(2, 2, PW - 4, PH - 4);
    grime(g, PW, PH, { seed: seed + i, color: '#8a6a3a', octaves: [[4, 0.25], [20, 0.12]] });
    g.fillStyle = '#2a2018'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let sz = 46; g.font = `${sz}px ${FONTS.hand}`; while (g.measureText(it.text).width > PW - 40 && sz > 16) { sz -= 2; g.font = `${sz}px ${FONTS.hand}`; }
    g.fillText(it.text, PW / 2 + (r() - 0.5) * 10, PH / 2 + 4);
    g.restore();
    const w = it.w || 0.2, h = w * PH / PW;
    const pg = new THREE.PlaneGeometry(w, h), uv = pg.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (x0 + uv.getX(k) * PW) / c.width, 1 - (y0 + (1 - uv.getY(k)) * PH) / c.height);
    pg.rotateZ((r() - 0.5) * 0.06); pg.translate(...it.pos);
    geos.push(pg);
  });
  const m = mesh(mergeG(geos), new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.85 }), { cast: false });
  m.name = 'shelfLabels';
  return m;
}

/** Rubber chicken lying on a shelf with its neck dangling over the front edge (+Z). Origin: on the shelf. */
export function rubberChicken() {
  const g = grp('rubberChicken');
  const S = (y, rx, rz, z = 0, x = 0) => ({ y, rx, rz, z, x });
  const body = loftG([S(0.11, 0.01, 0.01), S(0.09, 0.05, 0.04), S(0.03, 0.07, 0.055), S(-0.05, 0.065, 0.05), S(-0.11, 0.035, 0.03), S(-0.13, 0.005, 0.005)], { seg: 20, capTop: true, capBottom: true }).rotateX(Math.PI / 2).translate(0, 0.05, -0.02);
  const neck = tubeG([[0, 0.06, 0.08], [0, 0.065, 0.13], [0.01, 0.04, 0.2], [0.015, -0.02, 0.23], [0.02, -0.1, 0.235]], 0.016, { radial: 8, seg: 24 });
  const head = new THREE.SphereGeometry(0.026, 14, 10).scale(1, 1.2, 0.9).translate(0.02, -0.13, 0.24);
  const legs = [tubeG([[0.03, 0.03, -0.12], [0.05, 0.02, -0.17], [0.06, 0.0, -0.2]], 0.006, { radial: 5 }), tubeG([[-0.03, 0.03, -0.12], [-0.06, 0.01, -0.16], [-0.08, 0.0, -0.17]], 0.006, { radial: 5 })];
  const wings = [new THREE.SphereGeometry(0.04, 10, 8).scale(0.3, 0.6, 1.2).translate(0.07, 0.07, 0.0), new THREE.SphereGeometry(0.04, 10, 8).scale(0.3, 0.6, 1.2).translate(-0.07, 0.07, 0.0)];
  g.add(mergeInto([body, neck, head, ...wings], new THREE.MeshPhysicalMaterial({ color: '#e8c41c', roughness: 0.35, clearcoat: 0.4 })));
  const comb = []; for (let i = 0; i < 4; i++) comb.push(new THREE.SphereGeometry(0.009, 8, 6).translate(0.02, -0.16 - i * 0.01, 0.24 + (i - 1.5) * 0.008));
  comb.push(new THREE.ConeGeometry(0.008, 0.03, 8).rotateX(-Math.PI / 2).rotateZ(0.0).translate(0.02, -0.128, 0.27)); // beak (dangling, pointing down the front)
  g.add(mergeInto(comb, M.matte('#d03a1c', { roughness: 0.5 })));
  g.add(mergeInto(legs, M.matte('#e07a1a', { roughness: 0.5 })));
  return g;
}

function cakeTexture() {
  const W = 512, H = 128, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#ecc8cc'; g.fillRect(0, 0, W, H);
  grime(g, W, H, { seed: 8, color: '#8a6a50', octaves: [[4, 0.25], [16, 0.15]] });
  g.strokeStyle = '#fbf3ea'; g.lineWidth = 6;
  for (let x = 0; x < W; x += 32) { g.beginPath(); g.arc(x + 16, 18, 14, 0, Math.PI); g.stroke(); }
  g.fillStyle = '#a8303a'; for (let x = 16; x < W; x += 32) { g.beginPath(); g.arc(x, 40, 5, 0, TAU); g.fill(); }
  // cardboard showing where the paint has gone
  g.fillStyle = 'rgba(150,110,60,0.7)'; g.fillRect(300, 60, 60, 40); g.strokeStyle = 'rgba(90,60,30,0.6)'; g.lineWidth = 2; for (let y = 64; y < 100; y += 6) { g.beginPath(); g.moveTo(300, y); g.lineTo(360, y); g.stroke(); }
  return canvasTexture(c);
}
/** A three-tier cardboard cake with one candle. Origin: base centre. 3 draw calls. */
export function cardboardCake() {
  const g = grp('cardboardCake');
  const mat = new THREE.MeshStandardMaterial({ map: cakeTexture(), roughness: 0.9 });
  const tiers = [[0.13, 0.08], [0.095, 0.07], [0.06, 0.06]];
  let y = 0; const sides = [], tops = [];
  for (const [r, h] of tiers) { sides.push(cylG(r, r, h, 28, 0, y + h / 2, 0, true)); tops.push(new THREE.CircleGeometry(r, 28).rotateX(-Math.PI / 2).translate(0, y + h, 0)); y += h; }
  g.add(mergeInto(sides, mat));
  g.add(mergeInto(tops, M.matte('#f4ece2', { roughness: 0.9 })));
  g.add(mergeInto([cylG(0.006, 0.006, 0.07, 8, 0.0, y + 0.035, 0.0), cylG(0.001, 0.001, 0.012, 4, 0, y + 0.076, 0)], M.matte('#d8c8e8')));
  return g;
}

/** A plaster skull with a card tied on (ALAS). Origin: base centre; faces +Z. */
export function skull() {
  const g = grp('skull');
  const cr = new THREE.SphereGeometry(0.075, 24, 18), p = cr.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x * 0.86, y * (y < 0 ? 0.7 : 0.92), z * (z > 0 ? 1.0 : 1.12)); }
  cr.computeVertexNormals(); cr.translate(0, 0.1, -0.01);
  const face = new THREE.SphereGeometry(0.052, 18, 12).scale(1, 0.85, 0.85).translate(0, 0.055, 0.03);
  const jaw = boxG(0.07, 0.03, 0.05, 0, 0.018, 0.035, 0.012);
  g.add(mergeInto([cr, face, jaw], M.matte('#d8cfba', { roughness: 0.75 })));
  const dark = [new THREE.SphereGeometry(0.017, 10, 8).scale(1, 1.1, 0.6).translate(-0.026, 0.083, 0.064), new THREE.SphereGeometry(0.017, 10, 8).scale(1, 1.1, 0.6).translate(0.026, 0.083, 0.064), new THREE.ConeGeometry(0.009, 0.02, 3).rotateX(Math.PI).translate(0, 0.058, 0.072)];
  for (let i = -3; i <= 3; i++) dark.push(boxG(0.002, 0.012, 0.004, i * 0.008, 0.033, 0.06, 0.0005));
  g.add(mergeInto(dark, M.matte('#2a221a', { roughness: 0.9 }), { cast: false }));
  return g;
}

/** A painted wooden ham (a big teardrop with a bone). Origin: on the shelf; lies along X. */
export function woodenHam() {
  const g = grp('woodenHam');
  const body = latheG([[0, 0], [0.04, 0.01], [0.075, 0.05], [0.085, 0.1], [0.07, 0.15], [0.04, 0.19], [0.02, 0.21], [0, 0.215]], 24).rotateZ(-Math.PI / 2).scale(1, 0.85, 1).translate(-0.1, 0.07, 0);
  g.add(mergeInto([body], M.wood({ tint: '#9a4a2a', planks: 0, seed: 31, roughness: 0.45 })));
  const bone = [cylG(0.014, 0.014, 0.07, 10).rotateZ(Math.PI / 2).translate(0.145, 0.07, 0), new THREE.SphereGeometry(0.018, 10, 8).translate(0.18, 0.08, 0.006), new THREE.SphereGeometry(0.018, 10, 8).translate(0.18, 0.06, -0.006)];
  g.add(mergeInto(bone, M.matte('#ece2cc', { roughness: 0.6 })));
  return g;
}

/** A tin crown, dented, with glass jewels. Origin: base centre. */
export function tinCrown() {
  const g = grp('tinCrown');
  const R = 0.085, H = 0.05, pts = 7, seg = pts * 8;
  const pos = [], idx = [];
  const r = rng(6);
  for (let i = 0; i <= seg; i++) {
    const a = i / seg * TAU, ph = (i % 8) / 8, top = H + 0.045 * (1 - Math.abs(ph - 0.5) * 2), dent = 1 + (r() - 0.5) * 0.04;
    pos.push(Math.sin(a) * R * dent, 0, Math.cos(a) * R * dent, Math.sin(a) * R * dent, top, Math.cos(a) * R * dent);
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const band = [geo, cylG(R + 0.003, R + 0.003, 0.012, 40, 0, 0.006, 0, true), cylG(R + 0.003, R + 0.003, 0.008, 40, 0, H - 0.004, 0, true)];
  const tin = new THREE.MeshStandardMaterial({ color: '#c4bfaa', metalness: 0.85, roughness: 0.35, side: THREE.DoubleSide });
  g.add(mergeInto(band, tin));
  const jewels = [];
  for (let i = 0; i < pts; i++) { const a = (i + 0.5) / pts * TAU; jewels.push(new THREE.SphereGeometry(0.009, 10, 8).scale(1, 1, 0.6).translate(Math.sin(a) * (R + 0.004), 0.028, Math.cos(a) * (R + 0.004))); }
  g.add(mergeInto(jewels.filter((_, i) => i % 2 === 0), new THREE.MeshPhysicalMaterial({ color: '#c01830', roughness: 0.1, clearcoat: 1 }), { cast: false }));
  g.add(mergeInto(jewels.filter((_, i) => i % 2 === 1), new THREE.MeshPhysicalMaterial({ color: '#1a8a4a', roughness: 0.1, clearcoat: 1 }), { cast: false }));
  return g;
}

/**
 * Shelf clutter: fake everything, merged by material (one draw call per material). spots: [{ x, y, z, w, kind? }]
 * where y is the shelf surface and w the space to fill along X. Returns a Group of merged meshes (statics).
 */
export function shelfClutter(spots, { seed = 11 } = {}) {
  const r = rng(seed);
  const B = { plaster: [], brass: [], red: [], green: [], blue: [], wood: [], silver: [], dark: [], card: [], gold: [], cream: [] };
  const pick = (a) => a[Math.floor(r() * a.length)];
  const put = (kind, x, y, z) => {
    switch (kind) {
      case 'urn': { const h = 0.18 + r() * 0.12; B[pick(['plaster', 'green', 'blue', 'red'])].push(latheG([[0, 0], [0.05, 0], [0.04, 0.02], [0.07, h * 0.45], [0.05, h * 0.85], [0.035, h * 0.9], [0.045, h], [0, h]].map(([a, b]) => [a * (h / 0.25), b]), 9).translate(x, y, z)); return 0.15 * h / 0.25; }
      case 'books': { const n = 3 + Math.floor(r() * 5); let dx = 0; for (let i = 0; i < n; i++) { const w = 0.03 + r() * 0.03, h = 0.18 + r() * 0.08; B[pick(['red', 'green', 'blue', 'dark', 'card'])].push(boxG(w, h, 0.15, x + dx + w / 2, y + h / 2, z, 0.001).rotateZ(i === n - 1 ? 0.25 : 0)); dx += w + 0.003; } return dx + 0.04; }
      case 'bottle': { const h = 0.2 + r() * 0.1; B[pick(['green', 'dark', 'brass'])].push(latheG([[0, 0], [0.035, 0], [0.036, h * 0.6], [0.012, h * 0.75], [0.011, h], [0, h]], 8).translate(x, y, z)); return 0.08; }
      case 'sword': { const L = 0.7 + r() * 0.2; const a = 0.15 + r() * 0.1; B.silver.push(boxG(0.025, L, 0.004, x, y + L / 2, z, 0.001).rotateZ(0).translate(0, 0, 0)); B.brass.push(boxG(0.12, 0.015, 0.02, x, y + 0.14, z, 0.004), cylG(0.012, 0.012, 0.12, 8, x, y + 0.07, z)); return 0.12; }
      case 'mask': { B[pick(['plaster', 'gold', 'cream'])].push(new THREE.SphereGeometry(0.075, 8, 6, 0, Math.PI).scale(1, 1.25, 0.5).rotateX(-0.3).translate(x, y + 0.09, z)); return 0.16; }
      case 'lantern': { const h = 0.22; B.dark.push(boxG(0.12, 0.01, 0.12, x, y + 0.005, z), boxG(0.12, 0.01, 0.12, x, y + h, z), new THREE.ConeGeometry(0.09, 0.06, 4).rotateY(Math.PI / 4).translate(x, y + h + 0.03, z)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.dark.push(boxG(0.01, h, 0.01, x + sx * 0.055, y + h / 2, z + sz * 0.055, 0.001)); B.brass.push(tubeG([[x - 0.04, y + h + 0.06, z], [x, y + h + 0.11, z], [x + 0.04, y + h + 0.06, z]], 0.004, { radial: 4 })); return 0.16; }
      case 'fruit': { B.wood.push(latheG([[0, 0], [0.09, 0.0], [0.12, 0.05], [0.115, 0.055], [0.08, 0.01], [0, 0.01]], 10).translate(x, y, z)); for (let i = 0; i < 6; i++) B[pick(['red', 'green', 'gold'])].push(new THREE.SphereGeometry(0.03, 6, 4).translate(x + (r() - 0.5) * 0.12, y + 0.05 + r() * 0.04, z + (r() - 0.5) * 0.1)); return 0.26; }
      case 'globe': { B.blue.push(new THREE.SphereGeometry(0.09, 10, 7).translate(x, y + 0.17, z)); B.brass.push(new THREE.TorusGeometry(0.1, 0.004, 4, 16).rotateY(0.4).translate(x, y + 0.17, z), cylG(0.05, 0.06, 0.02, 14, x, y + 0.01, z), cylG(0.008, 0.008, 0.08, 6, x, y + 0.05, z)); return 0.22; }
      case 'bust': { B.plaster.push(latheG([[0, 0], [0.07, 0], [0.065, 0.03], [0.03, 0.06], [0.11, 0.1], [0.1, 0.16], [0.05, 0.19], [0.03, 0.22], [0, 0.22]], 10).translate(x, y, z), new THREE.SphereGeometry(0.06, 8, 6).scale(0.9, 1.15, 1).translate(x, y + 0.28, z + 0.005)); return 0.24; }
      case 'candles': { for (let i = 0; i < 2; i++) { const cx = x + i * 0.08; B.brass.push(latheG([[0, 0], [0.04, 0], [0.03, 0.01], [0.01, 0.03], [0.012, 0.16], [0.025, 0.17], [0, 0.17]], 8).translate(cx, y, z)); B.cream.push(cylG(0.01, 0.01, 0.1, 8, cx, y + 0.22, z)); } return 0.18; }
      case 'scrolls': { for (let i = 0; i < 4; i++) B.card.push(cylG(0.018, 0.018, 0.24, 10).rotateZ(Math.PI / 2).rotateY((r() - 0.5) * 0.4).translate(x + 0.12, y + 0.02 + (i > 2 ? 0.035 : 0), z + (i - 1.5) * 0.04)); return 0.28; }
      case 'fish': { B.silver.push(new THREE.SphereGeometry(0.05, 8, 4).scale(3, 0.9, 0.35).translate(x + 0.15, y + 0.05, z), new THREE.ConeGeometry(0.05, 0.08, 4).rotateZ(Math.PI / 2).scale(1, 1, 0.3).translate(x - 0.02, y + 0.05, z)); return 0.32; }
      case 'box': { const w = 0.18 + r() * 0.15, h = 0.1 + r() * 0.12; B[pick(['card', 'wood', 'red', 'card'])].push(boxG(w, h, 0.22 + r() * 0.1, x + w / 2, y + h / 2, z, 0.001)); return w + 0.02; }
      case 'trumpet': { B.gold.push(tubeG([[x, y + 0.03, z], [x + 0.2, y + 0.03, z]], 0.006, { radial: 6 }), latheG([[0.006, 0], [0.012, 0.05], [0.04, 0.1], [0.045, 0.105]], 8).rotateZ(-Math.PI / 2).translate(x + 0.2, y + 0.03, z)); return 0.34; }
      case 'shield': { B[pick(['red', 'blue', 'gold'])].push(new THREE.CylinderGeometry(0.16, 0.16, 0.015, 16).rotateX(Math.PI / 2 - 0.25).translate(x + 0.15, y + 0.16, z - 0.06)); B.brass.push(new THREE.SphereGeometry(0.025, 6, 4).translate(x + 0.15, y + 0.17, z - 0.045)); return 0.32; }
      case 'boots': { for (let i = 0; i < 2; i++) { const bx = x + 0.04 + i * 0.1; B.dark.push(cylG(0.035, 0.04, 0.26, 12, bx, y + 0.15, z), boxG(0.08, 0.035, 0.14, bx, y + 0.018, z + 0.04, 0.012)); } return 0.22; }
      default: return 0.1;
    }
  };
  const kinds = ['urn', 'books', 'bottle', 'mask', 'lantern', 'fruit', 'globe', 'bust', 'candles', 'scrolls', 'fish', 'box', 'trumpet', 'shield', 'boots'];
  for (const s of spots) {
    let x = s.x - s.w / 2;
    const end = s.x + s.w / 2;
    const list = s.kinds || kinds;
    let guard = 0;
    while (x < end - 0.08 && guard++ < 20) { const k = pick(list); const used = put(k, x + 0.05, s.y, s.z + (r() - 0.5) * 0.06); x += used + 0.02 + r() * 0.05; }
  }
  const mats = {
    plaster: M.matte('#ddd4c2', { roughness: 0.85 }), brass: M.tarnishedBrass({ amount: 0.45 }), red: M.matte('#8a1e22', { roughness: 0.7 }), green: M.matte('#2f5a3a', { roughness: 0.6 }),
    blue: M.matte('#2a4a7a', { roughness: 0.65 }), wood: M.wood({ tint: '#7a5232', seed: 9 }), silver: M.iron({ color: '#a8a8a2', roughness: 0.35 }), dark: M.matte('#2a221c', { roughness: 0.6 }),
    card: M.matte('#b89a6a', { roughness: 0.9 }), gold: M.matte('#c49a3a', { roughness: 0.45 }), cream: M.matte('#efe4c8', { roughness: 0.8 }),
  };
  const out = grp('shelfClutter');
  for (const [k, list] of Object.entries(B)) if (list.length) out.add(mergeInto(list, mats[k], { cast: false }));
  return out;
}

/** A battered costume trunk with the lid propped open and fabric spilling out. Origin: base centre; front +Z. */
export function costumeTrunk({ w = 0.9, d = 0.5, h = 0.48, color = '#3a2a1e' } = {}) {
  const g = grp('trunk');
  const body = [boxG(w, h, d, 0, h / 2, 0, 0.01)];
  g.add(mergeInto(body, M.leather(color)));
  const straps = [];
  for (const sx of [-0.3, 0.3]) straps.push(boxG(0.05, h + 0.005, d + 0.006, sx * w, h / 2, 0, 0.002));
  straps.push(boxG(w + 0.006, 0.03, d + 0.006, 0, h * 0.85, 0, 0.002), boxG(w + 0.006, 0.03, d + 0.006, 0, 0.04, 0, 0.002));
  g.add(mergeInto(straps, M.matte('#6a4a2a', { roughness: 0.6 })));
  const lid = grp('lid'); lid.position.set(0, h, -d / 2); lid.rotation.x = -1.95; g.add(lid);
  lid.add(mergeInto([boxG(w, 0.08, d, 0, 0.04, d / 2, 0.012)], M.leather(color)));
  const spill = loftG([{ y: 0.06, rx: 0.3, rz: 0.15, f: 0.03 }, { y: 0.0, rx: 0.36, rz: 0.2, f: 0.04 }, { y: -0.25, rx: 0.25, rz: 0.08, f: 0.03, z: 0.18 }], { seg: 30, seed: 3, capTop: true });
  g.add(at(mesh(spill, new THREE.MeshStandardMaterial({ color: '#7a1e3a', roughness: 0.8, map: null, side: THREE.DoubleSide })), 0, h, 0.05));
  g.add(at(mesh(loftG([{ y: 0.04, rx: 0.2, rz: 0.1, f: 0.02 }, { y: 0.0, rx: 0.22, rz: 0.12, f: 0.03 }, { y: -0.3, rx: 0.12, rz: 0.04, f: 0.02, z: 0.15 }], { seg: 24, seed: 5, capTop: true }), new THREE.MeshStandardMaterial({ color: '#c9a03a', roughness: 0.7, side: THREE.DoubleSide })), 0.25, h + 0.01, 0.12));
  return g;
}

/**
 * The shared T.wigHead is built for close-ups (~5k tris); six of them up on the high shelf cost 31k at the vantage.
 * This swaps in lighter geometry with the same silhouette and the same curl placement (same rng sequence), ~1.6k each.
 */
export function lightenWigHead(hd, { style = 'curls', seed = 2 } = {}) {
  const hm = hd.userData.head, wm = hd.userData.wig;
  if (hm) {
    hm.geometry.dispose();
    hm.geometry = mergeG([
      new THREE.SphereGeometry(0.085, 16, 12).scale(0.86, 1.12, 0.96).translate(0, 0.4, 0),
      cylG(0.028, 0.04, 0.11, 10, 0, 0.29, 0.004),
      new THREE.SphereGeometry(0.01, 6, 4).scale(0.7, 1.5, 0.9).translate(0, 0.392, 0.079),
    ]);
  }
  if (wm && style && style !== 'bob') {
    const r = rng(seed), parts = [new THREE.SphereGeometry(0.09, 14, 8, 0, TAU, 0, Math.PI * 0.55).scale(0.9, 1.1, 1).translate(0, 0.41, -0.004)];
    const curl = new THREE.IcosahedronGeometry(0.024, 0);
    for (let i = 0; i < 46; i++) {
      const th = r() * TAU, phi = 0.15 + r() * 1.25;
      const dir = new THREE.Vector3(Math.sin(phi) * Math.sin(th), Math.cos(phi), Math.sin(phi) * Math.cos(th));
      if (dir.z > 0.45 && dir.y < 0.55) continue;
      const s = 0.7 + r() * 0.6;
      parts.push(curl.clone().scale(s * 1.08, s * 1.08, s * 1.08).rotateY(r() * TAU).translate(dir.x * 0.084, 0.41 + dir.y * 0.098, dir.z * 0.088 - 0.004));
    }
    wm.geometry.dispose();
    wm.geometry = mergeG(parts);
  }
  return hd;
}

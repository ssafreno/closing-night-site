// The Foyer & Box Office (SET-foyer). buildSet(ctx, group) builds the whole room into `group` (world coords: floor
// centre at the origin; the glass street doors in the north wall at -Z; the grand staircase against the west wall,
// -X; the box office booth in the north-east corner; the auditorium doors in the east wall) and returns `handles`:
// every object the puzzles touch and every delight, with animation hooks and focus framings. index.js registers the
// hotspots against these handles; PUZZLES wires the mechanics. See docs/notes/set-foyer.md.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as T from '../../engine/props/theatre.js';
import * as Lt from '../../engine/props/lights.js';
import * as P from '../../engine/props/particles.js';
import { makeCanvas, canvasTexture, rng } from '../../engine/props/textures.js';
import { mesh, noRay, grp, boxG, cylG, latheG, mergeG, mergeInto, tubeG, instances, halo, glowGlass, chase, TAU, textPlate, catenary } from '../../engine/props/theatre/common.js';
import * as D from './props.js';

const FONTS = T.FONTS;
export const ROOM = { x0: -7.5, x1: 7.5, z0: -7, z1: 7, H: 6.8 };
export const VANTAGE = { position: [-2.0, 1.6, 4.6], lookAt: [-1.05, 3.05, -7], fov: 60 };

// staircase
const RISE = 0.17, GOING = 0.3, STEPS = 13, STAIR_X0 = -7.5, STAIR_X1 = -5.0, STAIR_Z0 = 3.6;
const LANDING_Y = RISE * 14, LANDING_Z0 = -0.3, LANDING_Z1 = -3.6, LANDING_T = 0.25;
// the chandelier
const CH = { x: -0.8, z: -1.6, chain: 0.35, tiers: 4 };
CH.H = 0.55 + CH.tiers * 0.32;
CH.restBottom = ROOM.H - CH.chain - CH.H - 0.25;
CH.dropMax = CH.restBottom - 1.8;
// the box office booth
const BOOTH = { x0: 4.6, x1: 7.5, z0: -7, z1: -3.6, H: 3.4, winZ: -5.5 };
const AUD = { z: -1.2, w: 1.8, h: 2.4 };

const SODIUM = '#ff8a2e', WARM = '#ffc887', EXITG = '#3cff86';

function at(o, x, y, z, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; return o; }
function keep(o) { o.userData.keep = true; return o; }
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
/** World position of a local point on an object (after placement). */
function world(o, p) { o.updateWorldMatrix(true, false); return o.localToWorld(p.clone()); }

// =====================================================================================================
// SURFACES
// =====================================================================================================
const PXM = 200; // pixels per metre in the wall texture
function foyerWallTexture() {
  // a 4 m wide strip, the full 6.8 m high: dado (hidden by the panelling), faded oxblood damask paper to the picture
  // rail at 4.4 m, a gilt-and-cream frieze, cream plaster to the cornice. Soot, damp, a peeling seam, ghost frames.
  const W = 4 * PXM, H = Math.round(ROOM.H * PXM), r = rng(23);
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const y = (m) => H - m * PXM;
  g.fillStyle = '#d8c8a4'; g.fillRect(0, 0, W, H);
  // paper
  g.fillStyle = '#5c1d1c'; g.fillRect(0, y(4.4), W, y(1.0) - y(4.4));
  g.fillStyle = 'rgba(214,170,110,0.13)';
  for (let row = 0; row < 18; row++) for (let col = 0; col < 7; col++) {
    const cx = col * W / 6 + (row % 2) * W / 12, cy = y(1.0) - row * 0.2 * PXM - 10;
    g.save(); g.translate(cx, cy);
    g.beginPath(); g.moveTo(0, -26); g.bezierCurveTo(14, -18, 18, -2, 0, 22); g.bezierCurveTo(-18, -2, -14, -18, 0, -26); g.fill();
    g.beginPath(); g.ellipse(-16, 6, 4, 10, -0.6, 0, TAU); g.ellipse(16, 6, 4, 10, 0.6, 0, TAU); g.fill();
    g.restore();
  }
  // vertical seams, one peeling
  g.strokeStyle = 'rgba(30,8,6,0.35)'; g.lineWidth = 1.5;
  for (let k = 1; k < 8; k++) { g.beginPath(); g.moveTo(k * W / 8, y(4.4)); g.lineTo(k * W / 8, y(1.0)); g.stroke(); }
  g.fillStyle = '#c9b48c'; g.beginPath(); g.moveTo(W * 0.625, y(4.4)); g.lineTo(W * 0.625 + 26, y(4.25)); g.lineTo(W * 0.625 + 8, y(3.7)); g.lineTo(W * 0.625, y(3.5)); g.fill();
  T.grime(g, W, H, { seed: 31, color: '#3a2412', octaves: [[3, 0.2], [10, 0.12], [40, 0.07]] });
  // soot rising toward the cornice, and a damp bloom from the ceiling
  const sm = g.createLinearGradient(0, 0, 0, y(3.0)); sm.addColorStop(0, 'rgba(40,28,18,0.6)'); sm.addColorStop(1, 'rgba(40,28,18,0)');
  g.fillStyle = sm; g.fillRect(0, 0, W, y(3.0));
  for (let i = 0; i < 3; i++) {
    const x = r() * W, rad = 80 + r() * 140, gr = g.createRadialGradient(x, 0, rad * 0.2, x, 0, rad * 2.2);
    gr.addColorStop(0, 'rgba(90,70,30,0.35)'); gr.addColorStop(0.7, 'rgba(90,70,30,0.12)'); gr.addColorStop(1, 'rgba(90,70,30,0)');
    g.fillStyle = gr; g.fillRect(x - rad * 2.2, 0, rad * 4.4, rad * 2.4);
  }
  // the frieze: a gilt band with egg-and-dart, cream above
  g.fillStyle = '#a07a34'; g.fillRect(0, y(4.75), W, y(4.4) - y(4.75));
  g.fillStyle = 'rgba(255,226,150,0.35)';
  for (let x = 0; x < W; x += 24) { g.beginPath(); g.ellipse(x + 12, y(4.575), 8, 18, 0, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(40,24,8,0.5)'; g.fillRect(0, y(4.75), W, 4); g.fillRect(0, y(4.4) - 4, W, 4);
  // ghost rectangles where frames hung (paper less faded)
  for (let i = 0; i < 2; i++) { g.fillStyle = 'rgba(120,30,28,0.35)'; g.fillRect(60 + r() * (W - 300), y(3.6), 160 + r() * 80, 220 + r() * 60); }
  const t = canvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
// POLISH: a panel of faded old-gold silk damask, stretched inside a gilt moulding (UV 0..1 over the panel)
function silkPanelTexture() {
  const W = 256, H = 304, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(57);
  g.fillStyle = '#6e5228'; g.fillRect(0, 0, W, H);
  // the damask: a tall pomegranate repeat in a slightly brighter satin weave
  g.fillStyle = 'rgba(214,176,104,0.22)';
  for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
    const cx = (col + 0.5 + (row % 2) * 0.5) * W / 3.5 - W / 7, cy = (row + 0.5) * H / 4.5;
    g.save(); g.translate(cx, cy);
    g.beginPath(); g.moveTo(0, -30); g.bezierCurveTo(20, -22, 24, 4, 0, 30); g.bezierCurveTo(-24, 4, -20, -22, 0, -30); g.fill();
    g.beginPath(); g.ellipse(-22, -4, 5, 13, -0.5, 0, TAU); g.ellipse(22, -4, 5, 13, 0.5, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(0, 36, 3, 6, 0, 0, TAU); g.fill();
    g.restore();
  }
  // a fine vertical weave, and fading
  for (let x = 0; x < W; x += 2) { g.fillStyle = `rgba(${r() < 0.5 ? '255,230,170' : '30,18,6'},${0.03 + r() * 0.03})`; g.fillRect(x, 0, 1, H); }
  T.grime(g, W, H, { seed: 59, color: '#2a1a0c', octaves: [[3, 0.14], [12, 0.08]] });
  // soot and shadow gathered at the moulding
  const edge = (x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(26,14,6,0.55)'); gr.addColorStop(1, 'rgba(26,14,6,0)'); return gr; };
  g.fillStyle = edge(0, 0, 0, 34); g.fillRect(0, 0, W, 34);
  g.fillStyle = edge(0, H, 0, H - 26); g.fillRect(0, H - 26, W, 26);
  g.fillStyle = edge(0, 0, 24, 0); g.fillRect(0, 0, 24, H);
  g.fillStyle = edge(W, 0, W - 24, 0); g.fillRect(W - 24, 0, 24, H);
  return canvasTexture(c);
}

function wallMaterial() {
  const map = foyerWallTexture();
  return new THREE.MeshStandardMaterial({ map, roughness: 0.88, shadowSide: THREE.DoubleSide });
}

/** A wall in its XY plane (x along the wall, centred; y up), facing +Z, with holes; UV = metres / (4, H). */
function wallGeo(len, H, holes = []) {
  const s = new THREE.Shape(); s.moveTo(-len / 2, 0); s.lineTo(len / 2, 0); s.lineTo(len / 2, H); s.lineTo(-len / 2, H); s.closePath();
  for (const h of holes) {
    const p = new THREE.Path();
    if (h.arch) { p.moveTo(h.x - h.w / 2, h.y); p.lineTo(h.x + h.w / 2, h.y); p.lineTo(h.x + h.w / 2, h.y + h.h); p.absarc(h.x, h.y + h.h, h.w / 2, 0, Math.PI, false); p.lineTo(h.x - h.w / 2, h.y); }
    else { p.moveTo(h.x - h.w / 2, h.y); p.lineTo(h.x + h.w / 2, h.y); p.lineTo(h.x + h.w / 2, h.y + h.h); p.lineTo(h.x - h.w / 2, h.y + h.h); p.lineTo(h.x - h.w / 2, h.y); }
    s.holes.push(p);
  }
  const geo = new THREE.ShapeGeometry(s, 24);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 4, p.getY(i) / ROOM.H);
  return geo;
}

function ceilingTexture() {
  // 3 m of coffered plaster per tile: cream fields, gilt ribs with bead, soot over the chandelier, a water stain
  const S = 1024, c = makeCanvas(S, S), g = c.getContext('2d'), r = rng(41);
  g.fillStyle = '#cfc09c'; g.fillRect(0, 0, S, S);
  T.grime(g, S, S, { seed: 43, color: '#6a5634', octaves: [[4, 0.22], [16, 0.12], [64, 0.06]] });
  const rib = 70;
  for (const [x, y, w, h] of [[0, 0, S, rib / 2], [0, S - rib / 2, S, rib / 2], [0, 0, rib / 2, S], [S - rib / 2, 0, rib / 2, S], [S / 2 - rib / 2, 0, rib, S], [0, S / 2 - rib / 2, S, rib]]) {
    const gr = g.createLinearGradient(x, y, x + (w > h ? 0 : w), y + (w > h ? h : 0));
    gr.addColorStop(0, '#7a5a24'); gr.addColorStop(0.5, '#c9a24a'); gr.addColorStop(1, '#6a4a1c');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  }
  // inner moulding round each coffer, and a rosette
  for (const cx of [S / 4, S * 3 / 4]) for (const cy of [S / 4, S * 3 / 4]) {
    g.strokeStyle = 'rgba(150,110,40,0.7)'; g.lineWidth = 6; g.strokeRect(cx - S / 4 + rib / 2 + 18, cy - S / 4 + rib / 2 + 18, S / 2 - rib - 36, S / 2 - rib - 36);
    g.fillStyle = 'rgba(170,130,60,0.55)'; for (let k = 0; k < 8; k++) { g.beginPath(); g.ellipse(cx + Math.cos(k / 8 * TAU) * 22, cy + Math.sin(k / 8 * TAU) * 22, 16, 8, k / 8 * TAU, 0, TAU); g.fill(); }
  }
  for (let i = 0; i < 2; i++) { const x = r() * S, y = r() * S, rad = 60 + r() * 90; const gr = g.createRadialGradient(x, y, rad * 0.5, x, y, rad); gr.addColorStop(0, 'rgba(120,90,40,0.12)'); gr.addColorStop(0.85, 'rgba(110,80,30,0.35)'); gr.addColorStop(1, 'rgba(110,80,30,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); }
  const t = canvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function runnerTexture() {
  // oxblood stair carpet: a gold Greek-key border, worn pale down the middle where the feet went
  const W = 512, H = 128, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#5a1216'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#b08a3a'; g.fillRect(0, 0, 26, H); g.fillRect(W - 26, 0, 26, H);
  g.fillStyle = '#5a1216'; for (let y = 0; y < H; y += 16) { g.fillRect(8, y + 4, 10, 6); g.fillRect(W - 18, y + 4, 10, 6); }
  const wr = g.createLinearGradient(0, 0, W, 0); wr.addColorStop(0.25, 'rgba(160,110,90,0)'); wr.addColorStop(0.5, 'rgba(160,110,90,0.3)'); wr.addColorStop(0.75, 'rgba(160,110,90,0)');
  g.fillStyle = wr; g.fillRect(0, 0, W, H);
  T.grime(g, W, H, { seed: 61, color: '#2a0a08', octaves: [[6, 0.2], [30, 0.12]] });
  const t = canvasTexture(c); t.wrapT = THREE.RepeatWrapping;
  return t;
}

function winchLabelTexture() {
  const W = 512, H = 360, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(5);
  g.fillStyle = '#ece4cc'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1d3a6a'; g.lineWidth = 12; g.beginPath(); g.roundRect(14, 14, W - 28, H - 28, 22); g.stroke();
  g.fillStyle = '#1d3a6a'; g.textAlign = 'center';
  g.font = `bold 58px ${FONTS.ui}`; g.fillText('CHANDELIER', W / 2, 92);
  g.fillRect(70, 112, W - 140, 4);
  g.font = `bold 30px ${FONTS.ui}`; g.fillText('LOWER FOR CLEANING', W / 2, 160);
  g.font = `600 24px ${FONTS.ui}`;
  ['HANDLE KEPT ON THE', 'STAR TRAP WINCH,', 'UNDER STAGE'].forEach((l, i) => g.fillText(l, W / 2, 212 + i * 36));
  // chips to the black iron, round the screws and the edges
  for (let i = 0; i < 14; i++) { g.fillStyle = '#1a1714'; const ex = r() < 0.5, x = ex ? (r() < 0.5 ? 8 + r() * 20 : W - 8 - r() * 20) : r() * W, yy = ex ? r() * H : (r() < 0.5 ? 8 + r() * 14 : H - 8 - r() * 14); g.beginPath(); g.arc(x, yy, 3 + r() * 9, 0, TAU); g.fill(); }
  for (const [x, yy] of [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]]) { g.fillStyle = '#5a5248'; g.beginPath(); g.arc(x, yy, 9, 0, TAU); g.fill(); g.strokeStyle = '#2a2420'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 6, yy); g.lineTo(x + 6, yy); g.stroke(); }
  T.grime(g, W, H, { seed: 7, color: '#5a4020', octaves: [[4, 0.18], [18, 0.1]] });
  return canvasTexture(c);
}

function emptyFrameTexture() {
  // the TONIGHT frame with the bill torn out: brown backing board, drawing-pin holes, paper scraps under the pins
  const W = 384, H = 512, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(9);
  g.fillStyle = '#5a4630'; g.fillRect(0, 0, W, H);
  T.grime(g, W, H, { seed: 12, color: '#2a1a0c', octaves: [[5, 0.3], [24, 0.15]] });
  // a paler rectangle where the bill kept the light off
  g.fillStyle = 'rgba(150,120,80,0.25)'; g.fillRect(10, 10, W - 20, H - 20);
  for (const [x, y] of [[16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16], [W / 2, 14], [W / 2, H - 14]]) {
    g.fillStyle = '#e8dcbc'; g.beginPath(); g.moveTo(x - 10 - r() * 8, y - 8); g.lineTo(x + 12 + r() * 6, y - 10); g.lineTo(x + 8, y + 12 + r() * 6); g.lineTo(x - 12, y + 9); g.closePath(); g.fill();
    g.fillStyle = '#8a6a2a'; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill();
  }
  for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(10,6,2,0.7)'; g.beginPath(); g.arc(r() * W, r() * H, 1.4, 0, TAU); g.fill(); }
  return canvasTexture(c);
}

function calendarTexture() {
  const W = 300, H = 400;
  return T.agedPaperTexture({ w: W, h: H, tint: '#efe4c8', seed: 88, age: 0.6, key: 'foyer-calendar', draw: (g) => {
    g.fillStyle = '#a3201c'; g.fillRect(0, 0, W, 70);
    g.fillStyle = '#f2e6c8'; g.textAlign = 'center'; g.font = `30px ${FONTS.display}`; g.fillText('MARCH 1931', W / 2, 48);
    g.fillStyle = '#2a2018'; g.font = `14px ${FONTS.fell}`;
    'SMTWTFS'.split('').forEach((d, i) => g.fillText(d, 28 + i * 40, 98));
    g.font = `20px ${FONTS.fell}`;
    for (let d = 1; d <= 31; d++) { const k = d - 1, col = k % 7, row = Math.floor(k / 7); g.fillStyle = col === 0 ? '#a3201c' : '#2a2018'; g.fillText(String(d), 28 + col * 40, 134 + row * 44); }
    // days crossed off up to the 14th, then nothing
    g.strokeStyle = 'rgba(30,30,60,0.7)'; g.lineWidth = 2;
    for (let d = 1; d <= 14; d++) { const k = d - 1, x = 28 + (k % 7) * 40, yy = 128 + Math.floor(k / 7) * 44; g.beginPath(); g.moveTo(x - 12, yy - 10); g.lineTo(x + 12, yy + 6); g.stroke(); }
    g.font = `13px ${FONTS.fell}`; g.fillStyle = '#5a4a3a'; g.fillText('Pelham Coal & Coke Co. — Deliveries Daily', W / 2, H - 18);
  } });
}

function webTexture() {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), r = rng(3);
  g.clearRect(0, 0, S, S); g.strokeStyle = 'rgba(230,230,220,0.55)'; g.lineWidth = 1;
  const spokes = 9;
  for (let k = 0; k < spokes; k++) { const a = k / spokes * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * S * 1.1, Math.sin(a) * S * 1.1); g.stroke(); }
  for (let ring = 1; ring < 12; ring++) { g.beginPath(); for (let k = 0; k <= spokes; k++) { const a = Math.min(k, spokes - 1) / (spokes - 1) * Math.PI / 2, rad = ring * 20 + r() * 6; const x = Math.cos(a) * rad, yy = Math.sin(a) * rad; if (k === 0) g.moveTo(x, yy); else g.lineTo(x, yy); } g.stroke(); }
  const t = canvasTexture(c); return t;
}

// =====================================================================================================
// BUILD
// =====================================================================================================
export function buildSet(ctx, G) {
  const h = { perches: {}, doors: {} };
  const R = ROOM;
  const updaters = [];
  const onUpdate = (fn) => updaters.push(fn);

  // ---------------------------------------------------------------------------------------------------
  // SHELL: floor, walls, ceiling, cornice, dado
  // ---------------------------------------------------------------------------------------------------
  const floorMap = D.chequerTexture(); floorMap.repeat.set((R.x1 - R.x0) / 2.4, (R.z1 - R.z0) / 2.4);
  const floorRough = D.floorRoughTexture(); floorRough.repeat.set(3, 3);
  const floorMat = new THREE.MeshPhysicalMaterial({ map: floorMap, roughnessMap: floorRough, roughness: 0.6, clearcoat: 0.18, clearcoatRoughness: 0.45, color: '#d9cdb8' });
  const floor = mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0).rotateX(-Math.PI / 2), floorMat, { cast: false });
  G.add(floor);
  // a lino patch inside the booth
  G.add(mesh(new THREE.PlaneGeometry(BOOTH.x1 - BOOTH.x0 - 0.1, BOOTH.z1 - BOOTH.z0 - 0.1).rotateX(-Math.PI / 2).translate((BOOTH.x0 + BOOTH.x1) / 2, 0.004, (BOOTH.z0 + BOOTH.z1) / 2), M.linoleum ? M.linoleum({}) : M.matte('#4a3020'), { cast: false }));

  const wallMat = wallMaterial();
  const wallN = mesh(wallGeo(R.x1 - R.x0, R.H, [
    { x: 0, y: 0, w: 3.2, h: 2.7, arch: true },          // the street entrance (fanlight to 4.3 m)
    { x: 5.05, y: 2.2, w: 0.6, h: 0.7 },                 // the booth's barred high window
  ]), wallMat, { cast: true }); at(wallN, 0, 0, R.z0); G.add(wallN);
  const wallE = mesh(wallGeo(R.z1 - R.z0, R.H, [{ x: AUD.z, y: 0, w: AUD.w, h: AUD.h }]), wallMat); at(wallE, R.x1, 0, 0, -Math.PI / 2); G.add(wallE);
  const wallW = mesh(wallGeo(R.z1 - R.z0, R.H, [{ x: 2.3, y: LANDING_Y, w: 1.7, h: 1.8, arch: true }]), wallMat); at(wallW, R.x0, 0, 0, Math.PI / 2); G.add(wallW);
  const wallS = mesh(wallGeo(R.x1 - R.x0, R.H), wallMat); at(wallS, 0, 0, R.z1, Math.PI); G.add(wallS);

  const ceilMap = ceilingTexture(); ceilMap.repeat.set((R.x1 - R.x0) / 3, (R.z1 - R.z0) / 3);
  const ceiling = mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0).rotateX(Math.PI / 2).translate(0, R.H, 0), new THREE.MeshStandardMaterial({ map: ceilMap, roughness: 0.8, metalness: 0.15 }), { cast: false });
  G.add(ceiling);
  // ceiling rose under the chandelier
  G.add(at(mesh(latheG([[0, 0], [0.75, 0], [0.7, -0.04], [0.55, -0.07], [0.35, -0.08], [0.25, -0.12], [0.12, -0.14], [0, -0.15]], 40), M.gilt({ pattern: 'acanthus' }), { cast: false }), CH.x, R.H, CH.z));

  // cornice (gilt), picture rail, dado panelling and skirting along every wall (with gaps for openings)
  const gilt = M.gilt({ pattern: 'moulding' }), mah = M.mahogany();
  const cornice = [], dado = [], rail = [];
  const run = (axis, fixed, a0, a1, inward, gaps = []) => {
    // a straight run of wall trim from a0 to a1 along `axis` ('x' or 'z'), at the wall `fixed`, `inward` = ±1
    const segs = []; let s = a0;
    for (const [g0, g1] of gaps.sort((p, q) => p[0] - q[0])) { if (g0 > s) segs.push([s, g0]); s = Math.max(s, g1); }
    if (s < a1) segs.push([s, a1]);
    return segs;
  };
  const trim = (axis, fixed, a0, a1, inward, y, hh, dd, list) => {
    const len = a1 - a0, mid = (a0 + a1) / 2;
    if (axis === 'x') list.push(boxG(len, hh, dd, mid, y, fixed + inward * dd / 2, 0.006));
    else list.push(boxG(dd, hh, len, fixed + inward * dd / 2, y, mid, 0.006));
  };
  const walls = [
    { axis: 'x', fixed: R.z0, a0: R.x0, a1: BOOTH.x0, inward: 1, dadoGaps: [[-1.62, 1.62]] },
    { axis: 'x', fixed: R.z0, a0: BOOTH.x0, a1: R.x1, inward: 1, dadoGaps: [], booth: true },
    { axis: 'x', fixed: R.z1, a0: R.x0, a1: R.x1, inward: -1, dadoGaps: [] },
    { axis: 'z', fixed: R.x1, a0: R.z0, a1: R.z1, inward: -1, dadoGaps: [[AUD.z - AUD.w / 2 - 0.12, AUD.z + AUD.w / 2 + 0.12]] },
    { axis: 'z', fixed: R.x0, a0: R.z0, a1: R.z1, inward: 1, dadoGaps: [[LANDING_Z1, STAIR_Z0]] },
  ];
  for (const w of walls) {
    trim(w.axis, w.fixed, w.a0, w.a1, w.inward, R.H - 0.18, 0.36, 0.22, cornice);
    if (!w.booth) trim(w.axis, w.fixed, w.a0, w.a1, w.inward, 4.4, 0.06, 0.05, rail);
    for (const [s0, s1] of run(w.axis, w.fixed, w.a0, w.a1, w.inward, w.dadoGaps)) {
      trim(w.axis, w.fixed, s0, s1, w.inward, 0.55, 1.1, 0.04, dado);
      trim(w.axis, w.fixed, s0, s1, w.inward, 1.12, 0.06, 0.07, dado);
      trim(w.axis, w.fixed, s0, s1, w.inward, 0.09, 0.18, 0.06, dado);
    }
  }
  G.add(mergeInto(cornice, gilt, { cast: false }));
  G.add(mergeInto(rail, gilt, { cast: false }));
  G.add(mergeInto(dado, mah));
  // gilt panel mouldings on the open walls (east wall either side of the doors, the south wall)
  const panels = [];
  const panelRect = (cx, cy, w, hh, place) => { const t = 0.045, d = 0.03; [[0, hh / 2, w, t], [0, -hh / 2, w, t], [-w / 2, 0, t, hh], [w / 2, 0, t, hh]].forEach(([x, y, ww, hy]) => panels.push(place(boxG(ww, hy, d, cx + x, cy + y, d / 2, 0.006)))); };
  const onE = (geo) => geo.rotateY(-Math.PI / 2).translate(R.x1, 0, 0);
  const onS = (geo) => geo.rotateY(Math.PI).translate(0, 0, R.z1);
  for (const z of [1.4, 4.4]) panelRect(z, 2.75, 2.2, 2.6, (geo) => onE(geo));
  for (const x of [-4.5, -1.5, 1.5, 4.5]) panelRect(-x, 2.75, 2.2, 2.6, (geo) => onS(geo));
  G.add(mergeInto(panels, gilt, { cast: false }));
  // POLISH: the panels were bare wallpaper inside their gilt mouldings, which read as empty picture frames. Each now
  // holds a stretched silk damask infill, faded old gold, soot-darkened at the edges (one merged mesh, one call).
  const silk = [];
  for (const z of [1.4, 4.4]) silk.push(onE(new THREE.PlaneGeometry(2.11, 2.51).translate(z, 2.75, 0.006)));
  for (const x of [-4.5, -1.5, 1.5, 4.5]) silk.push(onS(new THREE.PlaneGeometry(2.11, 2.51).translate(-x, 2.75, 0.006)));
  G.add(noRay(mergeInto(silk, new THREE.MeshStandardMaterial({ map: silkPanelTexture(), roughness: 0.62, metalness: 0.05 }), { cast: false })));

  // marble pilasters / columns flanking the street entrance and at the corners of the north wall
  for (const x of [-1.95, 1.95]) { const col = T.marbleColumn({ h: 4.4, r: 0.22, order: 'ionic', fluted: false }); at(col, x, 0, R.z0 + 0.26); G.add(col); }

  // ---------------------------------------------------------------------------------------------------
  // THE GRAND STAIRCASE (west wall): 13 marble steps + the half-landing, oxblood runner, brass rods,
  // a mahogany handrail on turned balusters, a newel lamp at the foot, an arch up to the circle
  // ---------------------------------------------------------------------------------------------------
  const marble = M.agedMarble({ base: '#d6ccb8', vein: '#8a8072' });
  const steps = [], runner = [], rods = [];
  const runW = 1.55, runX = (STAIR_X0 + STAIR_X1) / 2 + 0.05;
  const stepEast = (i) => (i === 0 ? -3.65 : i === 1 ? -4.15 : i === 2 ? -4.6 : STAIR_X1);
  for (let i = 0; i < STEPS; i++) {
    const top = (i + 1) * RISE, zf = STAIR_Z0 - i * GOING, x1 = stepEast(i);
    steps.push(boxG(x1 - STAIR_X0, top, GOING, (STAIR_X0 + x1) / 2, top / 2, zf - GOING / 2, 0.004));
    if (i < 3) steps.push(cylG(GOING / 2, GOING / 2, top, 24, x1, top / 2, zf - GOING / 2)); // the curtail
    // a nosing lip
    steps.push(boxG(x1 - STAIR_X0 + 0.02, 0.025, 0.04, (STAIR_X0 + x1) / 2 + 0.01, top - 0.0125, zf + 0.015, 0.008));
    runner.push(new THREE.PlaneGeometry(runW, GOING - 0.02).rotateX(-Math.PI / 2).translate(runX, top + 0.004, zf - GOING / 2 - 0.01));
    runner.push(new THREE.PlaneGeometry(runW, RISE).translate(runX, top - RISE / 2, zf + 0.037));
    rods.push(cylG(0.009, 0.009, runW + 0.12, 8).rotateZ(Math.PI / 2).translate(runX, top - RISE + 0.012, zf + 0.04));
    rods.push(cylG(0.014, 0.014, 0.02, 8).rotateZ(Math.PI / 2).translate(runX - runW / 2 - 0.07, top - RISE + 0.012, zf + 0.04), cylG(0.014, 0.014, 0.02, 8).rotateZ(Math.PI / 2).translate(runX + runW / 2 + 0.07, top - RISE + 0.012, zf + 0.04));
  }
  // the landing: a slab with a gilt fascia on its east edge, the runner across it
  steps.push(boxG(STAIR_X1 - STAIR_X0, LANDING_T, LANDING_Z0 - LANDING_Z1, (STAIR_X0 + STAIR_X1) / 2, LANDING_Y - LANDING_T / 2, (LANDING_Z0 + LANDING_Z1) / 2, 0.006));
  runner.push(new THREE.PlaneGeometry(runW, LANDING_Z0 - LANDING_Z1 - 0.1).rotateX(-Math.PI / 2).translate(runX, LANDING_Y + 0.004, (LANDING_Z0 + LANDING_Z1) / 2));
  runner.push(new THREE.PlaneGeometry(runW + 0.6, 1.7).rotateX(-Math.PI / 2).rotateY(Math.PI / 2).translate(STAIR_X0 + 0.85, LANDING_Y + 0.005, -2.3));
  G.add(mergeInto(steps, marble));
  // the closed string and the panelled spandrel under the flight (east face, x = STAIR_X1), hiding the step ends
  {
    const nose = (z) => RISE + (STAIR_Z0 - z) / GOING * RISE;
    const zA = STAIR_Z0 - 3 * GOING, zB = LANDING_Z0, top = (z) => nose(z) - 0.3;
    const sh = new THREE.Shape([new THREE.Vector2(-zA, 0), new THREE.Vector2(-zB, 0), new THREE.Vector2(-zB, top(zB)), new THREE.Vector2(-zA, top(zA))]);
    const spG = new THREE.ShapeGeometry(sh).rotateY(Math.PI / 2).translate(STAIR_X1 + 0.002, 0, 0);
    G.add(mesh(spG, M.mahogany({ tint: '#3a1a10' }), { cast: false }));
    const len = Math.hypot(zA - zB, nose(zB) - nose(zA)), ang = Math.atan2(nose(zB) - nose(zA), zA - zB);
    const mid = (zA + zB) / 2, midY = (nose(zA) + nose(zB)) / 2;
    const bar = (z0, y0, z1, y1, t = 0.012, w = 0.024) => { const L = Math.hypot(z1 - z0, y1 - y0); return boxG(t, w, L, 0, 0, 0, 0.002).rotateX(Math.atan2(-(y1 - y0), z1 - z0)).translate(STAIR_X1 + 0.01, (y0 + y1) / 2, (z0 + z1) / 2); };
    G.add(mesh(boxG(0.06, 0.36, len + 0.1, 0, 0, 0, 0.008).rotateX(ang).translate(STAIR_X1 + 0.02, midY - 0.13, mid), M.mahogany()));
    const gb = [bar(zA, nose(zA) - 0.31, zB, nose(zB) - 0.31, 0.03, 0.03), boxG(0.03, 0.16, zA - zB, STAIR_X1 + 0.015, 0.08, mid, 0.004)];
    for (const [za, zb] of [[2.2, 1.25], [1.05, 0.3]]) {
      const y0 = 0.26, ta = top(za) - 0.12, tb = top(zb) - 0.12;
      gb.push(bar(za, y0, zb, y0), bar(zb, y0, zb, tb), bar(zb, tb, za, ta), bar(za, ta, za, y0));
    }
    G.add(mergeInto(gb, M.gilt({ pattern: 'plain' }), { cast: false }));
  }
  const runTex = runnerTexture();
  const runMat = new THREE.MeshStandardMaterial({ map: runTex, roughness: 0.95 });
  G.add(mesh(mergeG(runner), runMat, { cast: false }));
  G.add(mergeInto(rods, M.brass({ roughness: 0.3 }), { cast: false }));
  G.add(mesh(boxG(0.03, 0.2, LANDING_Z0 - LANDING_Z1, STAIR_X1 + 0.015, LANDING_Y - 0.12, (LANDING_Z0 + LANDING_Z1) / 2, 0.006), M.gilt({ pattern: 'acanthus' }), { cast: false }));

  // balusters + handrail
  const balX = STAIR_X1 - 0.07, balH = 0.88;
  const balGeo = latheG([[0, 0], [0.04, 0], [0.04, 0.06], [0.025, 0.1], [0.02, 0.25], [0.045, 0.42], [0.022, 0.6], [0.018, 0.78], [0.03, 0.82], [0.03, 0.86], [0, 0.86]], 6);
  const bal = [];
  const noseY = (z) => RISE + (STAIR_Z0 - z) / GOING * RISE; // the pitch line through the nosings
  for (let i = 3; i < STEPS; i++) { const zf = STAIR_Z0 - i * GOING, top = (i + 1) * RISE; for (const dz of [0.075, 0.225]) { const z = zf - dz; bal.push({ p: [balX, top, z], s: [1, (noseY(z) + balH - top) / 0.86, 1] }); } }
  for (let z = LANDING_Z0 - 0.15; z > LANDING_Z1 + 0.05; z -= 0.16) bal.push({ p: [balX, LANDING_Y, z], s: [1, balH / 0.86, 1] });
  // the curtail sweep: balusters round the first three steps
  const sweep = [[-3.95, 0.17, 3.42], [-4.25, 0.34, 3.2], [-4.55, 0.51, 2.95], [-4.82, 0.51, 2.72]];
  for (const [x, y, z] of sweep) bal.push({ p: [x, y, z], s: [1, (noseY(Math.min(z, 3.3)) + balH - y) / 0.86, 1] });
  G.add(instances(balGeo, M.mahogany(), bal));
  const railPts = [[-3.76, 1.2, 3.42], [-4.2, 1.25, 3.25], [-4.65, 1.38, 2.95], [balX, noseY(2.55) + balH, 2.55], [balX, noseY(LANDING_Z0) + balH, LANDING_Z0 + 0.02], [balX, LANDING_Y + balH, LANDING_Z0 - 0.25], [balX, LANDING_Y + balH, LANDING_Z1 + 0.02]];
  G.add(mesh(tubeG(railPts, 0.038, { radial: 8, seg: 80, tension: 0.2 }), M.mahogany()));
  // the newel post and its lamp
  const newel = D.newelPost({ h: 1.25 }); at(newel, -3.7, RISE, 3.45); G.add(keep(newel));
  h.newel = { object: newel, setLit: (k) => newel.userData.setLit(k) };
  // the landing's corner post
  G.add(at(mesh(mergeG([boxG(0.14, 1.05, 0.14, 0, 0.525, 0, 0.01), latheG([[0, 1.05], [0.09, 1.05], [0.06, 1.15], [0, 1.2]], 12)]), M.mahogany()), balX, LANDING_Y, LANDING_Z1 + 0.05));

  // the arch up to the circle: a dark passage of steps rising west, a gilt sign, a velvet rope across
  const passage = grp('circlePassage'); G.add(passage);
  const pm = M.matte('#120c0a', { roughness: 0.95 });
  const pz = -2.3, pw = 1.7;
  const pass = [boxG(0.02, 2.8, pw + 0.2, R.x0 - 2.6, LANDING_Y + 1.4, pz, 0.002), boxG(2.6, 2.8, 0.02, R.x0 - 1.3, LANDING_Y + 1.4, pz - pw / 2 - 0.01, 0.002), boxG(2.6, 2.8, 0.02, R.x0 - 1.3, LANDING_Y + 1.4, pz + pw / 2 + 0.01, 0.002), boxG(2.6, 0.02, pw, R.x0 - 1.3, LANDING_Y + 2.7, pz, 0.002)];
  for (let i = 0; i < 6; i++) pass.push(boxG(0.32, RISE * (i + 1), pw, R.x0 - 0.5 - i * 0.32, LANDING_Y + RISE * (i + 1) / 2, pz, 0.004));
  passage.add(mergeInto(pass, pm, { cast: false }));
  passage.add(mesh(new THREE.PlaneGeometry(pw * 0.9, 1.9).rotateX(-Math.PI / 2).rotateY(Math.PI / 2).translate(R.x0 - 0.8, LANDING_Y + 0.006, pz), runMat, { cast: false }));
  const archTrim = [];
  for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI, rr = pw / 2 + 0.05; archTrim.push(boxG(0.15, 0.1, 0.14, 0, 0, 0, 0.004).rotateZ(a - Math.PI / 2).translate(Math.cos(a) * rr, LANDING_Y + 1.8 + Math.sin(a) * rr, 0)); }
  archTrim.push(boxG(0.1, 1.8, 0.14, -pw / 2 - 0.05, LANDING_Y + 0.9, 0, 0.006), boxG(0.1, 1.8, 0.14, pw / 2 + 0.05, LANDING_Y + 0.9, 0, 0.006));
  G.add(mesh(mergeG(archTrim).rotateY(Math.PI / 2).translate(R.x0 + 0.03, 0, pz), gilt, { cast: false }));
  const circleSign = textPlate('DRESS CIRCLE  ·  BOXES', 1.3, { style: 'gilt', pw: 1280, ph: 150, font: FONTS.display }); circleSign.rotation.y = Math.PI / 2; circleSign.position.set(R.x0 + 0.04, LANDING_Y + 2.95, pz); G.add(circleSign);
  const ropeParts = [];
  for (const dz of [-0.75, 0.75]) ropeParts.push(latheG([[0, 0], [0.11, 0], [0.11, 0.02], [0.03, 0.05], [0.022, 0.9], [0.04, 0.93], [0.045, 0.98], [0, 1.02]], 16).translate(R.x0 + 0.35, LANDING_Y, pz + dz));
  G.add(mergeInto(ropeParts, M.brass({ roughness: 0.3 })));
  const rope = tubeG(catenary([R.x0 + 0.35, LANDING_Y + 0.95, pz - 0.75], [R.x0 + 0.35, LANDING_Y + 0.95, pz + 0.75], 0.22, 20), 0.028, { radial: 8 });
  G.add(mesh(rope, M.velvetRed()));
  h.stairs = { hit: D.hitBox(STAIR_X1 - STAIR_X0, 0.5, STAIR_Z0 - LANDING_Z0), focus: null };
  h.stairs.hit.position.set((STAIR_X0 + STAIR_X1) / 2, 1.3, (STAIR_Z0 + LANDING_Z0) / 2); h.stairs.hit.rotation.x = Math.atan2(RISE, GOING); G.add(h.stairs.hit);
  h.stairs.circleHit = D.hitBox(0.3, 1.9, pw); h.stairs.circleHit.position.set(R.x0 + 0.2, LANDING_Y + 0.95, pz); G.add(h.stairs.circleHit);
  h.stairs.lavinia = { up: [STAIR_X0 + 1.2, LANDING_Y, pz], back: null };

  // ---------------------------------------------------------------------------------------------------
  // UNDER THE LANDING (its east face, x = -5.0): the winch cabinet, the cloakroom hatch, the pass door
  // ---------------------------------------------------------------------------------------------------
  const SPAN_Z = (LANDING_Z0 + LANDING_Z1) / 2, spanH = LANDING_Y - LANDING_T;
  const zl = (z) => -(z - SPAN_Z); // world z → the spandrel wall's local x
  const HATCH = { z0: -1.32, z1: -2.38, y0: 1.0, y1: 1.92 }, PASS = { z: -3.06, w: 0.84, h: 1.95 };
  const span = mesh(wallGeo(LANDING_Z0 - LANDING_Z1, spanH, [
    { x: zl((HATCH.z0 + HATCH.z1) / 2), y: HATCH.y0, w: HATCH.z0 - HATCH.z1, h: HATCH.y1 - HATCH.y0 },
    { x: zl(PASS.z), y: 0, w: PASS.w, h: PASS.h },
  ]), wallMat);
  at(span, STAIR_X1, 0, SPAN_Z, Math.PI / 2); G.add(span);
  // the void under the landing, seen through the openings: dark, with the cloakroom cubby behind the hatch
  const cub = [], cubX = STAIR_X1 - 0.75;
  cub.push(boxG(0.02, HATCH.y1 - HATCH.y0 + 0.9, HATCH.z0 - HATCH.z1 + 0.6, cubX, (HATCH.y0 + HATCH.y1) / 2 + 0.1, (HATCH.z0 + HATCH.z1) / 2, 0.002));
  cub.push(boxG(0.75, 0.02, HATCH.z0 - HATCH.z1 + 0.6, cubX + 0.375, HATCH.y0 - 0.01, (HATCH.z0 + HATCH.z1) / 2, 0.002));
  cub.push(boxG(0.7, 0.025, HATCH.z0 - HATCH.z1 + 0.5, cubX + 0.35, HATCH.y1 - 0.18, (HATCH.z0 + HATCH.z1) / 2, 0.003));
  G.add(mergeInto(cub, M.wood({ tint: '#2a1a10' }), { cast: false }));
  G.add(mesh(new THREE.PlaneGeometry(LANDING_Z0 - LANDING_Z1, spanH).rotateY(Math.PI / 2).translate(STAIR_X0 + 0.3, spanH / 2, SPAN_Z), M.matte('#0a0806'), { cast: false }));
  // coats on the pegs in the cubby, hat boxes on the shelf
  const coatGeo = new THREE.CapsuleGeometry(0.16, 0.6, 4, 10).scale(1, 1, 0.45);
  G.add(instances(coatGeo, new THREE.MeshStandardMaterial({ roughness: 0.95 }), [
    { p: [cubX + 0.14, 1.32, -1.55], r: [0, Math.PI / 2, 0.05], c: '#2a2622' }, { p: [cubX + 0.14, 1.3, -1.95], r: [0, Math.PI / 2, -0.04], c: '#3a2a1a' }, { p: [cubX + 0.16, 1.35, -2.2], r: [0, Math.PI / 2, 0.02], c: '#1e2430' },
  ]));
  G.add(instances(cylG(0.13, 0.13, 0.16, 16), new THREE.MeshStandardMaterial({ roughness: 0.8 }), [
    { p: [cubX + 0.25, HATCH.y1 - 0.08, -1.55], c: '#7a2a2a' }, { p: [cubX + 0.3, HATCH.y1 - 0.08, -1.9], c: '#2f5a3a', s: [0.8, 1.2, 0.8] }, { p: [cubX + 0.2, HATCH.y1 - 0.09, -2.2], c: '#d8ccb0', s: [1, 0.8, 1] },
  ]));
  // the hatch: a counter, a frame, a CLOAKROOM plate, a brass bell
  G.add(mergeInto([
    boxG(0.34, 0.05, HATCH.z0 - HATCH.z1 + 0.12, STAIR_X1 + 0.12, HATCH.y0 - 0.025, (HATCH.z0 + HATCH.z1) / 2, 0.01),
    boxG(0.06, HATCH.y1 - HATCH.y0 + 0.1, 0.06, STAIR_X1 + 0.03, (HATCH.y0 + HATCH.y1) / 2, HATCH.z0 + 0.03, 0.008),
    boxG(0.06, HATCH.y1 - HATCH.y0 + 0.1, 0.06, STAIR_X1 + 0.03, (HATCH.y0 + HATCH.y1) / 2, HATCH.z1 - 0.03, 0.008),
    boxG(0.06, 0.08, HATCH.z0 - HATCH.z1 + 0.12, STAIR_X1 + 0.03, HATCH.y1 + 0.04, (HATCH.z0 + HATCH.z1) / 2, 0.008),
    boxG(0.04, 0.12, 0.3, STAIR_X1 + 0.05, HATCH.y0 - 0.1, (HATCH.z0 + HATCH.z1) / 2, 0.006),
  ], mah));
  const cloak = textPlate('CLOAKROOM', 0.62, { style: 'gilt', pw: 1024, ph: 150, font: FONTS.display }); cloak.rotation.y = Math.PI / 2; cloak.position.set(STAIR_X1 + 0.065, HATCH.y1 + 0.135, (HATCH.z0 + HATCH.z1) / 2); G.add(cloak);
  G.add(at(mesh(mergeG([new THREE.SphereGeometry(0.04, 16, 8, 0, TAU, 0, Math.PI / 2), cylG(0.006, 0.006, 0.03, 6, 0, 0.05, 0), cylG(0.05, 0.05, 0.008, 16, 0, 0.004, 0)]), M.brass({ roughness: 0.25 })), STAIR_X1 + 0.18, HATCH.y0, HATCH.z0 - 0.16));
  // lost property on the counter: one long glove, the ear trumpet (glinting); the umbrella tub on the floor
  const glove = D.eveningGlove(); at(glove, STAIR_X1 + 0.16, HATCH.y0, -1.72, 2.2); G.add(keep(glove));
  h.glove = { object: glove, hit: D.hitBox(0.14, 0.08, 0.5) };
  h.glove.hit.position.set(STAIR_X1 + 0.16, HATCH.y0 + 0.03, -1.6); G.add(h.glove.hit);
  const trumpet = D.earTrumpet({ tag: true }); at(trumpet, STAIR_X1 + 0.17, HATCH.y0 + 0.055, -2.12, 1.25); trumpet.rotation.z = 0.05; G.add(keep(trumpet));
  const trumpetGlint = halo('#fff0c8', 0.14, 0.0); trumpetGlint.position.set(STAIR_X1 + 0.2, HATCH.y0 + 0.12, -2.25); G.add(trumpetGlint);
  h.earTrumpet = {
    object: trumpet, hit: D.hitBox(0.22, 0.16, 0.42), glint: trumpetGlint,
    setPresent(on) { trumpet.visible = !!on; trumpetGlint.visible = !!on; h.earTrumpet.hit.visible = true; },
  };
  h.earTrumpet.hit.position.set(STAIR_X1 + 0.18, HATCH.y0 + 0.08, -2.1); G.add(h.earTrumpet.hit);
  // POLISH: the tub stands against the stair panelling, clear of the counter (it stood right under the trumpet)
  const TUB = { x: STAIR_X1 + 0.32, z: -1.05 };
  const tub = D.umbrellaTub({ count: 18 }); at(tub, TUB.x, 0, TUB.z); G.add(tub);
  h.umbrellas = { object: tub, hit: D.hitBox(0.6, 0.88, 0.6) }; h.umbrellas.hit.position.set(TUB.x, 0.44, TUB.z); G.add(h.umbrellas.hit);
  // dado on the spandrel face
  const sd = [];
  for (const [z0, z1] of [[LANDING_Z0, HATCH.z0 + 0.06], [HATCH.z1 - 0.06, PASS.z + PASS.w / 2 + 0.1], [PASS.z - PASS.w / 2 - 0.1, LANDING_Z1]]) {
    const len = z0 - z1, mid = (z0 + z1) / 2;
    sd.push(boxG(0.03, 0.9, len, STAIR_X1 + 0.015, 0.45, mid, 0.005), boxG(0.06, 0.05, len, STAIR_X1 + 0.03, 0.92, mid, 0.006), boxG(0.05, 0.16, len, STAIR_X1 + 0.025, 0.08, mid, 0.005));
  }
  G.add(mergeInto(sd, mah));
  // the pass door to the stage (FRONT OF HOUSE)
  const passDoor = T.theatreDoor({ style: 'iron', w: PASS.w, h: PASS.h, plates: ['PRIVATE'] });
  at(passDoor, STAIR_X1, 0, PASS.z, Math.PI / 2); G.add(passDoor);
  const passBeyond = passDoor.children[passDoor.children.length - 1];
  const passPlate = textPlate('PASS DOOR  ·  STAGE', 0.62, { style: 'brass', pw: 1024, ph: 128 }); passPlate.rotation.y = Math.PI / 2; passPlate.position.set(STAIR_X1 + 0.02, PASS.h + 0.11, PASS.z); G.add(passPlate);
  keep(passDoor.userData.leaves[0]);
  h.doors.pass = { object: passDoor, leaf: passDoor.userData.leaves[0], hit: D.hitBox(0.12, PASS.h, PASS.w), setOpen: (t) => { passDoor.userData.setOpen(t); passBeyond.visible = true; } };
  h.doors.pass.hit.position.set(STAIR_X1 + 0.06, PASS.h / 2, PASS.z); G.add(h.doors.pass.hit);

  // the winch cabinet, its enamel label beside it, the chain up to the ceiling and across to the chandelier
  const cab = D.winchCabinet(); at(cab, STAIR_X1, 1.42, -0.8, Math.PI / 2); G.add(keep(cab));
  const label = mesh(new THREE.PlaneGeometry(0.42, 0.42 * 360 / 512), new THREE.MeshPhysicalMaterial({ map: winchLabelTexture(), roughness: 0.3, clearcoat: 0.6 }), { cast: false });
  // the enamel label is screwed to the inside of the open door (which faces the room)
  label.rotation.y = Math.PI; label.position.set(0.31, 0.06, -0.004); cab.userData.door.add(label);
  const cabHit = D.hitBox(0.42, 0.98, 0.7); cabHit.position.set(STAIR_X1 + 0.2, 1.42, -0.8); G.add(cabHit);
  const driveHit = D.hitBox(0.1, 0.12, 0.12); cab.add(driveHit); driveHit.position.set(0.06, -0.24, 0.27);
  const cu = cab.userData;
  h.winch = {
    object: cab, hit: cabHit, drive: cu.drive, driveHit, handle: cu.handle, label, labelHit: null,
    setHandle: cu.setHandle, setTurn: cu.setTurn, getTurn: cu.getTurn, setDoor: cu.setDoor,
    /** World centre of the crank's rotation (the drive) and its radius, for a circular drag. */
    hub: world(cab, v3(0.06, -0.24, 0.27)), radius: 0.18,
    focus: { position: [-3.62, 1.52, -0.42], lookAt: [-4.95, 1.4, -0.48] },
    focusWide: { position: [-2.2, 1.75, 2.2], lookAt: [-2.75, 3.1, -1.6] },
  };
  h.winch.labelHit = D.hitBox(0.46, 0.32, 0.04); h.winch.labelHit.position.set(0.31, 0.06, -0.02); cab.userData.door.add(h.winch.labelHit);
  const exitW = world(cab, cu.chainExit);
  const ceilY = R.H - 0.16;
  const chainPath = [[exitW.x, exitW.y, exitW.z], [exitW.x, ceilY, exitW.z], [CH.x - 0.12, ceilY, CH.z]];
  const liftChain = D.chainRun(chainPath, { pitch: 0.05, r: 0.016, wire: 0.0048, material: M.iron({ color: '#3a3632', roughness: 0.5 }) });
  G.add(liftChain);
  for (const [x, z, ry] of [[exitW.x, exitW.z, Math.atan2(CH.x - exitW.x, CH.z - exitW.z)], [CH.x - 0.12, CH.z, Math.atan2(CH.x - exitW.x, CH.z - exitW.z)]]) {
    const pb = T.pulleyBlock({ r: 0.09, hook: true }); at(pb, x, R.H, z, ry + Math.PI / 2); pb.traverse((m) => { m.castShadow = false; }); G.add(pb);
  }

  // ---------------------------------------------------------------------------------------------------
  // THE CHANDELIER: four tiers of prisms; lowers on its chain to 1.8 m; the pull-chain hangs from its heart
  // ---------------------------------------------------------------------------------------------------
  const chand = T.chandelier({ tiers: CH.tiers, radius: 1.0, chain: CH.chain, arms: 8, prismsPerSwag: 7, lit: 0 });
  at(chand, CH.x, R.H, CH.z); G.add(keep(chand));
  const cud = chand.userData, body = cud.body;
  const chSpot = new THREE.SpotLight(WARM, 0, 24, 1.22, 0.75, 1.35);
  chSpot.castShadow = true; chSpot.shadow.mapSize.set(2048, 2048); chSpot.shadow.bias = -0.0012; chSpot.shadow.normalBias = 0.03; chSpot.shadow.radius = 4; chSpot.shadow.camera.near = 0.3; chSpot.shadow.camera.far = 22;
  chSpot.position.set(0, -CH.H - 0.32, 0); chSpot.target.position.set(0, -CH.H - 6, 0.15);
  body.add(chSpot, chSpot.target);
  const chPoint = new THREE.PointLight(WARM, 0, 28, 1.5); chPoint.position.set(0, -CH.H * 0.72, 0); body.add(chPoint);
  const pullHit = D.hitBox(0.14, 0.95, 0.14); pullHit.position.set(0.06, -CH.H - 0.55, 0); body.add(pullHit);
  const crystalsHit = D.hitBox(1.9, CH.H + 0.2, 1.9); crystalsHit.position.set(0, -CH.H / 2, 0); body.add(crystalsHit);
  let drop = 0, swayAmp = 0.004, swayKick = 0;
  h.chandelier = {
    object: chand, body, pull: cud.pull, pullHit, crystalsHit, dropMax: CH.dropMax, height: CH.H,
    /** Lower the body by m metres (0 = up, dropMax = 1.8 m off the floor); the lift chain pays out with it. */
    setDrop(m) { drop = THREE.MathUtils.clamp(m, 0, CH.dropMax); cud.setDrop(drop); liftChain.userData.setTravel(drop); },
    getDrop: () => drop,
    /** Bulbs + prisms glow (the room's light rig follows via h.lighting.set). */
    setLit: (t, instant) => cud.setLit(t, instant),
    /** A shiver through the prisms (the crystals delight; the crank). */
    tinkle(k = 1) { swayKick = Math.max(swayKick, 0.02 * k); },
    /** World position of the pull tassel at the current drop. */
    pullWorld: () => world(body, v3(0.06, -CH.H - 0.96, 0)),
    focus: { position: [-0.8, 1.62, 1.35], lookAt: [-0.8, 2.0, -1.6] },    // lowered: the body and its pull-chain
    focusUp: { position: [-1.6, 1.6, 2.6], lookAt: [-0.8, 5.0, -1.6] },    // at rest, looking up into it
  };
  h.chandelier.setDrop(0);
  onUpdate((dt, t) => {
    swayKick *= Math.exp(-dt * 0.8);
    const a = swayAmp + swayKick;
    chand.rotation.z = Math.sin(t * 0.9) * a; chand.rotation.x = Math.sin(t * 0.7 + 1) * a * 0.7;
  });

  // ---------------------------------------------------------------------------------------------------
  // NORTH WALL: the glass street doors, the stopped clock, the TONIGHT frame, the reviews, the kiosk
  // ---------------------------------------------------------------------------------------------------
  const street = D.streetScreen({ w: 3.2, h: 2.6 }); at(street, 0, 0, R.z0); G.add(keep(street));
  h.street = { object: street, hit: D.hitBox(3.2, 2.6, 0.25), driveBus: () => street.userData.driveBus(), leaves: street.userData.leaves };
  h.street.hit.position.set(0, 1.3, R.z0 + 0.12); G.add(h.street.hit);
  h.doors.street = { object: street, hit: h.street.hit };

  const clock = T.wallClock({ style: 'dial', time: [7, 30], r: 0.36, label: 'EMPRESS' }); at(clock, 0, 4.88, R.z0); G.add(clock);
  h.clock = { object: clock, hit: D.hitBox(0.84, 0.84, 0.2) }; h.clock.hit.position.set(0, 4.88, R.z0 + 0.1); G.add(h.clock.hit);

  const exitN = T.exitSign({ w: 0.5, lit: 1 }); at(exitN, -2.85, 2.6, R.z0); G.add(exitN);
  const exitE = T.exitSign({ w: 0.5, lit: 1 }); at(exitE, R.x1, AUD.h + 0.45, AUD.z, -Math.PI / 2); G.add(exitE);
  const exitLight = new THREE.PointLight(EXITG, 0.6, 3.2, 2); exitLight.position.set(-2.85, 2.45, R.z0 + 0.35); G.add(exitLight);

  // the TONIGHT frame: the bill torn out, the glass door hanging open, six pieces against the wall below
  const TON = { x: -2.85, y: 1.38 };
  // POLISH: the glass door hangs square to the wall (was 0.82 ≈ 75°, which crossed the bill's left column in the close-up)
  const POSTER_DOOR_OPEN = 1.0;
  const frame = T.posterFrame({ w: D.BILL.w, h: D.BILL.h, texture: emptyFrameTexture(), style: 'gilt', door: true, border: 0.07 });
  at(frame, TON.x, TON.y, R.z0); G.add(keep(frame));
  frame.userData.setOpen(POSTER_DOOR_OPEN); frame.userData.door.rotation.z = -0.035;
  const tonPlate = textPlate('TONIGHT', 0.34, { style: 'brass', pw: 512, ph: 128 }); tonPlate.position.set(TON.x, TON.y + D.BILL.h / 2 + 0.13, R.z0 + 0.012); G.add(tonPlate);
  const lastTex = D.lastNightTexture();
  const pieceMat = new THREE.MeshStandardMaterial({ map: lastTex, roughness: 0.88, side: THREE.DoubleSide });
  const defs = D.billPieces({ seed: 14 });
  const floorOrder = [3, 0, 5, 1, 4, 2];
  const pieces = defs.map((d, i) => {
    const m = keep(mesh(d.geo, pieceMat, { cast: true }));
    m.name = `billPiece${i}`;
    const home = v3(TON.x + d.home[0], TON.y + d.home[1], R.z0 + 0.024 + i * 0.0006);
    const slot = floorOrder.indexOf(i);
    // three lean against the skirting, three lie on the floor in front (clear of the column and the kiosk)
    const back = slot < 3, col = slot % 3, jz = [0.06, -0.08, 0.04, -0.05, 0.09, -0.03][slot];
    const rx = back ? -0.2 : -Math.PI / 2 + 0.28;
    const floorPos = back
      ? v3(TON.x - 0.6 + col * 0.45, d.size[1] / 2 * Math.cos(0.2) + 0.005, R.z0 + 0.11 + col * 0.012)
      : v3(TON.x - 0.55 + col * 0.45, d.size[1] / 2 * Math.sin(0.28) + 0.006, R.z0 + 0.62 + (col % 2) * 0.06);
    m.position.copy(floorPos); m.rotation.set(rx, 0, jz);
    G.add(m);
    const p = {
      mesh: m, index: i, home, floor: floorPos, size: d.size, words: d.words, col: d.col, row: d.row,
      /** 0 on the floor (leaning), 1 in its place in the frame. */
      setPlaced(t) { m.position.lerpVectors(floorPos, home, t); m.rotation.set(rx * (1 - t), 0, jz * (1 - t)); },
    };
    return p;
  });
  h.poster = {
    object: frame, frameDoor: frame.userData.door, pieces, plate: tonPlate,
    hit: D.hitBox(D.BILL.w + 0.14, D.BILL.h + 0.14, 0.12),
    /** The glass door: 0 shut, 1 wide (it hangs open at `doorOpen` until the bill is whole). */
    doorOpen: POSTER_DOOR_OPEN, // POLISH
    setDoor(t) { frame.userData.setOpen(t); frame.userData.door.rotation.z = t > 0.5 ? -0.035 : 0; dirtyShadows(); },
    /** The frame plane (world): pieces snap within 6 cm of their `home`. */
    snap: 0.06,
    focus: { position: [TON.x - 0.12, 2.12, R.z0 + 2.3], lookAt: [TON.x - 0.15, 0.98, R.z0 + 0.25] },
  };
  h.poster.hit.position.set(TON.x, TON.y, R.z0 + 0.06); G.add(h.poster.hit);

  // the reviews and An Ordinary Cat (right of the doors)
  // FIXED BY qa-foyer: curly quotes; IM Fell draws a straight " as a closing quote, so each review opened with ”
  const REV = [
    { id: 'review_times', quote: '“I have seen it.”', paper: 'The Times', date: '1909', x: 2.64, seed: 101 },
    { id: 'review_stage', quote: '“Miss Thrush was audible.”', paper: 'The Stage', date: '', x: 3.16, seed: 102 },
    { id: 'review_punch', quote: '“Bring sandwiches.”', paper: 'Punch', date: '', x: 3.68, seed: 103 },
  ];
  h.reviews = REV.map((r) => {
    const f = T.posterFrame({ w: 0.42, h: 0.6, texture: D.reviewTexture(r), style: 'black', door: false, border: 0.05 });
    at(f, r.x, 1.62, R.z0); G.add(f);
    const hit = D.hitBox(0.52, 0.7, 0.08); hit.position.set(r.x, 1.62, R.z0 + 0.04); G.add(hit);
    return { id: r.id, object: f, hit, focus: { position: [r.x + 0.06, 1.6, R.z0 + 0.92], lookAt: [r.x, 1.6, R.z0] } };
  });
  const ocat = T.posterFrame({ w: 0.6, h: 0.85, texture: D.ordinaryCatTexture(), style: 'gilt', door: false, border: 0.055 });
  at(ocat, 4.22, 1.66, R.z0); G.add(ocat);
  h.ordinaryCat = { object: ocat, hit: D.hitBox(0.72, 0.97, 0.08), focus: { position: [4.2, 1.66, R.z0 + 1.32], lookAt: [4.22, 1.66, R.z0] } };
  h.ordinaryCat.hit.position.set(4.22, 1.66, R.z0 + 0.04); G.add(h.ordinaryCat.hit);

  // the kiosk in the far-left corner, with a stack of programmes and a card
  const kiosk = T.kiosk({ w: 1.6, label: 'ICES  ·  CHOCOLATES  ·  PROGRAMMES', seed: 4 }); at(kiosk, -5.0, 0, R.z0 + 0.62, 0.3); G.add(kiosk);
  const progs = [];
  for (let i = 0; i < 9; i++) progs.push({ p: [-0.45 + (i % 3) * 0.012, 0.95 + 0.045 + i * 0.004, 0.2 + (i % 2) * 0.006], r: [-Math.PI / 2, 0, (i % 3 - 1) * 0.08] });
  kiosk.add(instances(new THREE.PlaneGeometry(0.15, 0.21), new THREE.MeshStandardMaterial({ map: T.posterTexture({ title: 'PROGRAMME', subtitle: 'The Lamp at Gull Point', style: 'bill', w: 256, h: 360, seed: 12 }), roughness: 0.9 }), progs, { cast: false }));
  const priceCard = textPlate('PROGRAMMES  2d', 0.3, { style: 'card', pw: 512, ph: 120 }); priceCard.position.set(0.4, 1.42, 0.05); priceCard.rotation.x = -0.1; kiosk.add(priceCard);
  h.kiosk = { object: kiosk, hit: D.hitBox(1.7, 1.45, 0.7) };
  h.kiosk.hit.position.set(0, 0.72, 0); kiosk.add(h.kiosk.hit);

  // ---------------------------------------------------------------------------------------------------
  // THE BOX OFFICE: a mahogany booth in the north-east corner, its grilled window facing west, a side door
  // ajar on its south face. Inside: the counter (Bartholomew on his cushion, the ticket machine, the ticket
  // rack), the house board on the back wall, the seating plan on the side wall, the green safe in the corner.
  // ---------------------------------------------------------------------------------------------------
  const B = BOOTH, bw = 0.09;
  const booth = grp('booth'); G.add(booth);
  const win = T.boxOfficeWindow({ w: 1.8, h: 2.5, label: 'BOX OFFICE' }); at(win, B.x0, 0, B.winZ, -Math.PI / 2); booth.add(win);
  noRay(win.userData.glass);
  const bp = [];
  // front fillers either side of the window, the band above it, the south face round the door, the roof
  const wz0 = B.winZ - 0.9, wz1 = B.winZ + 0.9, DZ = { x0: 6.3, x1: 7.1, h: 2.1 };
  bp.push(boxG(bw, B.H, wz0 - B.z0, B.x0 - bw / 2, B.H / 2, (B.z0 + wz0) / 2, 0.01));
  bp.push(boxG(bw, B.H, B.z1 - wz1, B.x0 - bw / 2, B.H / 2, (wz1 + B.z1) / 2, 0.01));
  bp.push(boxG(bw, B.H - 2.5, wz1 - wz0, B.x0 - bw / 2, 2.5 + (B.H - 2.5) / 2, B.winZ, 0.01));
  bp.push(boxG(DZ.x0 - B.x0, B.H, bw, (B.x0 + DZ.x0) / 2, B.H / 2, B.z1 + bw / 2, 0.01));
  bp.push(boxG(B.x1 - DZ.x1, B.H, bw, (DZ.x1 + B.x1) / 2, B.H / 2, B.z1 + bw / 2, 0.01));
  bp.push(boxG(DZ.x1 - DZ.x0, B.H - DZ.h, bw, (DZ.x0 + DZ.x1) / 2, DZ.h + (B.H - DZ.h) / 2, B.z1 + bw / 2, 0.01));
  bp.push(boxG(B.x1 - B.x0 + 0.1, 0.08, B.z1 - B.z0 + 0.1, (B.x0 + B.x1) / 2 - 0.05, B.H + 0.04, (B.z0 + B.z1) / 2 + 0.05, 0.01));
  // raised panels and a plinth on the outside faces
  for (const z of [(B.z0 + wz0) / 2, (wz1 + B.z1) / 2]) for (const y of [0.55, 1.75]) bp.push(boxG(0.03, y < 1 ? 0.7 : 1.3, Math.min(0.75, (wz0 - B.z0) * 0.7), B.x0 - bw - 0.012, y, z, 0.012));
  for (const x of [(B.x0 + DZ.x0) / 2]) for (const y of [0.55, 1.75]) bp.push(boxG(1.2, y < 1 ? 0.7 : 1.3, 0.03, x, y, B.z1 + bw + 0.012, 0.012));
  bp.push(boxG(0.05, 0.14, B.z1 - B.z0, B.x0 - bw - 0.02, 0.07, (B.z0 + B.z1) / 2, 0.006), boxG(B.x1 - B.x0, 0.14, 0.05, (B.x0 + B.x1) / 2, 0.07, B.z1 + bw + 0.02, 0.006));
  // door frame
  bp.push(boxG(0.07, DZ.h + 0.05, 0.13, DZ.x0 - 0.02, (DZ.h + 0.05) / 2, B.z1 + bw / 2, 0.008), boxG(0.07, DZ.h + 0.05, 0.13, DZ.x1 + 0.02, (DZ.h + 0.05) / 2, B.z1 + bw / 2, 0.008), boxG(DZ.x1 - DZ.x0 + 0.1, 0.07, 0.13, (DZ.x0 + DZ.x1) / 2, DZ.h + 0.03, B.z1 + bw / 2, 0.008));
  booth.add(mergeInto(bp, mah));
  // gilt cornice round the roof's two open faces
  booth.add(mergeInto([boxG(0.14, 0.22, B.z1 - B.z0 + 0.14, B.x0 - 0.12, B.H - 0.06, (B.z0 + B.z1) / 2 + 0.07, 0.01), boxG(B.x1 - B.x0 + 0.14, 0.22, 0.14, (B.x0 + B.x1) / 2 - 0.07, B.H - 0.06, B.z1 + 0.12, 0.01)], gilt, { cast: false }));
  // the side door, ajar into the booth (hinged on its east jamb)
  const sideDoor = keep(grp('boothDoor')); sideDoor.position.set(DZ.x1, 0, B.z1 + 0.02); booth.add(sideDoor);
  sideDoor.add(mesh(mergeG([boxG(DZ.x1 - DZ.x0 - 0.02, DZ.h - 0.02, 0.045, -(DZ.x1 - DZ.x0) / 2, DZ.h / 2, 0, 0.008), boxG(0.5, 0.7, 0.012, -(DZ.x1 - DZ.x0) / 2, 0.6, 0.028, 0.01), boxG(0.5, 0.8, 0.012, -(DZ.x1 - DZ.x0) / 2, 1.55, 0.028, 0.01)]), mah));
  sideDoor.add(mesh(mergeG([new THREE.SphereGeometry(0.03, 12, 8).translate(-(DZ.x1 - DZ.x0) + 0.08, 1.0, 0.05), boxG(0.05, 0.14, 0.004, -(DZ.x1 - DZ.x0) + 0.08, 1.0, 0.025, 0.002)]), M.brass({ roughness: 0.3 })));
  const privPlate = textPlate('PRIVATE', 0.2, { style: 'brass', pw: 384, ph: 110 }); privPlate.position.set(-(DZ.x1 - DZ.x0) / 2, 1.45, 0.036); sideDoor.add(privPlate);
  sideDoor.rotation.y = -1.25;
  h.doors.booth = { object: sideDoor, hit: D.hitBox(DZ.x1 - DZ.x0, DZ.h, 0.3) };
  h.doors.booth.hit.position.set((DZ.x0 + DZ.x1) / 2, DZ.h / 2, B.z1 + 0.1); G.add(h.doors.booth.hit);

  // the price board above the window (outside, facing the queue)
  const priceBoard = mesh(new THREE.PlaneGeometry(1.5, 1.5 * 448 / 1024), new THREE.MeshStandardMaterial({ map: D.priceBoardTexture(), roughness: 0.45, metalness: 0.1 }), { cast: false });
  priceBoard.rotation.y = -Math.PI / 2; priceBoard.position.set(B.x0 - bw - 0.03, 2.94, B.winZ); booth.add(keep(priceBoard));
  booth.add(mesh(boxG(0.05, 1.5 * 448 / 1024 + 0.08, 1.58, B.x0 - bw - 0.01, 2.94, B.winZ, 0.01), gilt, { cast: false }));
  h.priceBoard = { object: priceBoard, hit: D.hitBox(0.08, 0.72, 1.56), focus: { position: [B.x0 - 1.55, 2.5, B.winZ], lookAt: [B.x0, 2.9, B.winZ] } };
  h.priceBoard.hit.position.set(B.x0 - bw - 0.05, 2.94, B.winZ); G.add(h.priceBoard.hit);

  // inside: lino, the counter along the window wall, a cushion, a stool, a pendant lamp, a calendar
  const CT = { x0: B.x0 + 0.01, x1: B.x0 + 0.62, y: 1.02 };
  booth.add(mergeInto([
    boxG(CT.x1 - CT.x0, 0.045, B.z1 - B.z0 - 0.2, (CT.x0 + CT.x1) / 2, CT.y - 0.0225, (B.z0 + B.z1) / 2 - 0.05, 0.008),
    boxG(0.04, CT.y - 0.05, B.z1 - B.z0 - 0.24, CT.x1 - 0.04, (CT.y - 0.05) / 2, (B.z0 + B.z1) / 2 - 0.05, 0.006),
    boxG(CT.x1 - CT.x0 - 0.06, 0.02, B.z1 - B.z0 - 0.3, (CT.x0 + CT.x1) / 2, 0.45, (B.z0 + B.z1) / 2 - 0.05, 0.004),
  ], M.wood({ tint: '#4a2a18' })));
  const cushion = mesh(boxG(0.44, 0.08, 0.5, 0, 0.04, 0, 0.035), M.velvetRed({ color: '#6a1820', wear: 0.6 }));
  const CAT = { x: B.x0 + 0.33, z: -5.82 };
  at(cushion, CAT.x, CT.y, CAT.z, 0.12); booth.add(cushion);
  h.perches.cat = { position: [CAT.x, CT.y + 0.075, CAT.z], rotationY: -Math.PI / 2 + 0.5, pose: 'sleep' };
  const stool = mergeInto([cylG(0.17, 0.17, 0.05, 20, 0, 0.66, 0), ...[0, 1, 2].map((k) => cylG(0.016, 0.022, 0.66, 8, Math.cos(k / 3 * TAU) * 0.13, 0.33, Math.sin(k / 3 * TAU) * 0.13)), new THREE.TorusGeometry(0.13, 0.01, 6, 20).rotateX(Math.PI / 2).translate(0, 0.25, 0)], M.wood({ tint: '#5a3a22' }));
  at(stool, B.x0 + 0.95, 0, -5.1); stool.rotation.z = 0.04; booth.add(stool);
  const lamp = T.pendantLamp({ style: 'enamel', color: '#1f4a30', drop: 0.75, lit: 0 }); at(lamp, 5.95, B.H, -5.2); booth.add(keep(lamp));
  const cal = mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshStandardMaterial({ map: calendarTexture(), roughness: 0.9 }), { cast: false });
  cal.rotation.y = -Math.PI / 2; cal.rotation.z = 0.03; cal.position.set(R.x1 - 0.01, 1.85, -4.2); booth.add(cal);
  // Bartholomew's high window: bars, a sill, the sodium-lit brick of the alley beyond
  const hw = { x: 5.05, y0: 2.2, w: 0.6, h: 0.7 };
  booth.add(mergeInto([...[-0.2, -0.067, 0.067, 0.2].map((dx) => cylG(0.012, 0.012, hw.h, 8, hw.x + dx, hw.y0 + hw.h / 2, R.z0 + 0.02)), boxG(hw.w + 0.1, 0.05, 0.16, hw.x, hw.y0 - 0.02, R.z0 + 0.05, 0.006)], M.ironBlack()));
  const alley = mesh(new THREE.PlaneGeometry(1.2, 1.0), new THREE.MeshBasicMaterial({ color: '#7a4018' }), { cast: false, receive: false }); alley.position.set(hw.x, hw.y0 + hw.h / 2, R.z0 - 0.35); booth.add(alley);

  // the ticket machine beside the cat (faces into the booth, +X)
  const machine = D.ticketMachine({ values: [2, 2, 3, 12, 2] }); at(machine, B.x0 + 0.3, CT.y, -4.6, Math.PI / 2); booth.add(keep(machine));
  const mHit = D.hitBox(0.36, 0.42, 0.56); mHit.position.set(B.x0 + 0.3, CT.y + 0.21, -4.6); G.add(mHit);
  h.machine = { object: machine, hit: mHit, ...machine.userData, focus: { position: [B.x0 + 0.84, CT.y + 0.34, -4.6], lookAt: [B.x0 + 0.3, CT.y + 0.19, -4.6] } };
  // the ticket rack at the far end of the counter
  const rack = T.ticketRack({ rows: 6, cols: 6, cell: 0.07, fill: 0.7 }); at(rack, B.x0 + 0.2, CT.y, -6.62, Math.PI / 2); booth.add(rack);

  // the house board on the back (north) wall
  const board = D.houseBoard(); at(board, 6.25, 1.52, R.z0); booth.add(keep(board));
  const boardHit = D.hitBox(1.16, 0.92, 0.12); boardHit.position.set(6.25, 1.52, R.z0 + 0.06); G.add(boardHit);
  h.houseboard = { object: board, hit: boardHit, ...board.userData, focus: { position: [6.25, 1.5, R.z0 + 1.05], lookAt: [6.25, 1.5, R.z0] } };
  h.wiringcard = { object: board.userData.card, focus: h.houseboard.focus };

  // the seating plan on the back (north) wall, left of the house board, over the end of the counter
  const plan = T.posterFrame({ w: 0.72, h: 0.54, texture: D.seatPlanTexture(), style: 'oak', door: false, border: 0.04 });
  at(plan, 5.32, 1.64, R.z0); booth.add(plan);
  const planHit = D.hitBox(0.8, 0.62, 0.08); planHit.position.set(5.32, 1.64, R.z0 + 0.04); G.add(planHit);
  h.seatplan = { object: plan, hit: planHit, focus: { position: [5.32, 1.62, R.z0 + 0.95], lookAt: [5.32, 1.62, R.z0] } };

  // the safe in the north-east corner, door toward the booth
  const safe = D.foyerSafe(); at(safe, 7.0, 0, -6.47, -Math.PI / 4); booth.add(keep(safe));
  const sfu = safe.userData;
  const safeHit = D.hitBox(0.8, 1.1, 0.75); safe.add(safeHit); safeHit.position.set(0, 0.55, 0);
  // POLISH: a touch further back and lower, so the maker's transfer at the foot of the door clears the inventory bar
  const sfFocusPos = world(safe, v3(0, 0.57, 1.17)), sfLook = world(safe, v3(0, 0.54, 0.3));
  h.safe = {
    object: safe, hit: safeHit, ...sfu,
    get value() { return sfu.value; },
    focus: { position: sfFocusPos.toArray(), lookAt: sfLook.toArray() },
    focusInside: { position: world(safe, v3(0.1, 0.75, 0.9)).toArray(), lookAt: world(safe, v3(0, 0.45, 0.0)).toArray() },
  };

  // the booth as a whole: overview from inside the side door
  h.booth = {
    window: win, hit: D.hitBox(0.3, 0.75, 0.82),
    focus: { position: [6.85, 1.72, -3.85], lookAt: [5.25, 1.12, -6.1] },
    windowFocus: { position: [B.x0 - 1.25, 1.55, B.winZ + 0.1], lookAt: [B.x0 + 0.3, 1.2, B.winZ - 0.2] },
  };
  h.booth.hit.position.set(B.x0 - 0.12, 1.5, B.winZ); G.add(h.booth.hit);
  // the booth's puzzle props are drawn only when the camera is near the booth (from the vantage they are behind its
  // walls and the window shows the cat's corner): ~90 draw calls and ~14k triangles saved at the vantage
  const boothInterior = [safe, machine, board];
  const camPos = new THREE.Vector3(); let interiorOn = null;
  onUpdate(() => {
    const cam = ctx.camera?.camera; if (!cam) return;
    cam.getWorldPosition(camPos); G.worldToLocal(camPos);
    const on = camPos.x > 3.0 && camPos.z < -1.5;
    if (on !== interiorOn) { interiorOn = on; for (const o of boothInterior) o.visible = on; }
  });
  h.booth.interior = boothInterior;

  // ---------------------------------------------------------------------------------------------------
  // THE AUDITORIUM DOORS (east wall): padded leather, brass portholes, chain and padlock, Crane's notice;
  // beyond them a glimpse of the dark house (only built visible when they open)
  // ---------------------------------------------------------------------------------------------------
  const aud = T.theatreDoor({ style: 'padded', double: true, w: AUD.w, h: AUD.h, window: 'porthole' });
  at(aud, R.x1, 0, AUD.z, -Math.PI / 2); G.add(aud);
  const audBeyond = aud.children[aud.children.length - 1];
  aud.userData.leaves.forEach(keep);
  const chainLock = D.chainAndPadlock({ gap: 0.2 }); chainLock.position.set(0, 0.88, 0.05); aud.add(keep(chainLock));
  const notice = mesh(new THREE.PlaneGeometry(0.32, 0.42), new THREE.MeshStandardMaterial({ map: D.noticeTexture(), roughness: 0.9 }), { cast: false });
  notice.position.set(AUD.w / 4, 1.24, 0.032); notice.rotation.z = 0.035; aud.userData.leaves[0].add(notice);
  // the glow under the doors (house lights up, doors still shut)
  const gapGlow = mesh(new THREE.PlaneGeometry(AUD.w - 0.05, 0.03).translate(0, 0.015, 0.03), new THREE.MeshBasicMaterial({ color: '#ffb35a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), { cast: false, receive: false });
  aud.add(noRay(gapGlow));
  const spillTex = (() => { const c = makeCanvas(256, 128), g = c.getContext('2d'); const gr = g.createRadialGradient(128, 0, 4, 128, 0, 128); gr.addColorStop(0, 'rgba(255,190,110,1)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); return canvasTexture(c); })();
  const spill = mesh(new THREE.PlaneGeometry(AUD.w + 0.8, 1.6).rotateX(-Math.PI / 2).translate(0, 0.006, 0.8), new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), { cast: false, receive: false });
  aud.add(noRay(spill));
  const audHit = D.hitBox(AUD.w, AUD.h, 0.2); audHit.position.set(0, AUD.h / 2, 0.08); aud.add(audHit);
  const lockHit = D.hitBox(0.12, 0.16, 0.1); lockHit.position.set(0, 0.8, 0.09); aud.add(lockHit);
  const noticeHit = D.hitBox(0.34, 0.44, 0.04); noticeHit.position.set(AUD.w / 4, 1.24, 0.04); aud.userData.leaves[0].add(noticeHit);

  // the glimpse: the back of the stalls, the far stage, the Gull Point cloth in moonlight, the Royal Box
  const house = keep(grp('auditoriumGlimpse')); at(house, R.x1, 0, AUD.z, -Math.PI / 2); G.add(house);
  const hm = M.matte('#1a0c0c', { roughness: 0.95 });
  house.add(mergeInto([
    boxG(14, 0.02, 18, 0, -0.01, -9.2, 0.002), boxG(14, 0.1, 18, 0, 9, -9.2, 0.002),
    boxG(1.6, 0.1, 0.4, -AUD.w / 2 - 0.8, AUD.h + 0.1, -0.2, 0.002),
  ], hm, { cast: false }));
  // POLISH: the side walls in the foyer's own damask (shared material) so the house reads as a lit room, not a black box
  // (from the vantage the open leaf shows only the near side wall); was part of the near-black matte
  const hwGeo = mergeG([wallGeo(18, 9).rotateY(Math.PI / 2).translate(-7, 0, -9.2), wallGeo(18, 9).rotateY(-Math.PI / 2).translate(7, 0, -9.2)]);
  house.add(mesh(hwGeo, wallMat, { cast: false }));
  // a glimpse only: four short rows (the full block is ~115k triangles), and nothing in the house casts
  // POLISH: 4 × 10 → 3 × 8 seats (74k → 45k triangles): the doorway only ever shows the middle of the front rows, and the
  // cat's walk past the open doors (camera following him) peaked at 267k with the new proscenium
  const rows = T.makeRows({ rows: 3, perRow: 8, spacing: 0.52, rowGap: 0.92, rake: 0.0, curve: 18, aisles: [3], tipped: 0.9, steps: false, seed: 6 });
  rows.position.set(0, 0, -8.0); rows.rotation.y = Math.PI; house.add(rows);
  const cloth = mesh(new THREE.PlaneGeometry(9.4, 5.6), new THREE.MeshBasicMaterial({ map: T.seascapeTexture({ time: 'night', lighthouse: true, w: 1024, h: 512 }), color: '#5a6a8a' }), { cast: false, receive: false });
  cloth.position.set(0, 3.8, -17.6); house.add(cloth); // POLISH: fills the new arch's opening (was 9 × 4.6 at 3.2)
  // POLISH: the real gilt proscenium (5 calls) on the stage front, in place of four acanthus-mapped boxes whose texture
  // stretched to metres and read as wood planks; the stage front is dark panelling
  const pros = T.proscenium({ w: 14, h: 7.9, opening: [8.4, 5.3], depth: 0.4, rise: 0.7 });
  pros.position.set(0, 1.1, -16.8); house.add(pros);
  house.add(mesh(boxG(11, 1.1, 1.2, 0, 0.55, -16.4, 0.01), M.wood({ tint: '#2a1a10' }), { cast: false }));
  // POLISH: the side-wall sconces lit with the house (sprites, no lights)
  const sconces = [];
  for (const sx of [-1, 1]) for (const z of [-4, -10]) { const s = halo('#ffc070', 1.1, 0); s.position.set(sx * 6.85, 3.6, z); house.add(s); sconces.push(s); }
  const rbox = T.royalBox({ w: 2.2, h: 2.4, d: 1.2 }); rbox.position.set(-6.2, 2.6, -12.5); rbox.rotation.y = Math.PI / 2; house.add(rbox);
  const royalGlow = halo('#ffc860', 3.2, 0); royalGlow.position.set(-5.6, 3.6, -12.5); house.add(royalGlow);
  const houseLight = new THREE.PointLight('#ffb070', 0, 22, 1.6); houseLight.position.set(0, 6.5, -9); house.add(houseLight);
  const moon = new THREE.PointLight('#8aa0d0', 0.0, 10, 2); moon.position.set(0, 4, -15); house.add(moon);
  house.traverse((o) => { o.castShadow = false; });
  house.visible = false;
  h.auditorium = {
    object: aud, hit: audHit, lock: chainLock.userData.lock, lockHit, notice, noticeHit, chain: chainLock, glimpse: house,
    leaves: aud.userData.leaves,
    /** 0 shut, 1 open (the glimpse beyond shows while open). */
    setOpen(t) { aud.userData.setOpen(t); const open = t > 0.01; house.visible = open; audBeyond.visible = !open; moon.intensity = open ? 2 : 0; },
    /** The chain off: heaped on the floor, padlock hanging open in the heap. */
    setFallen: (on) => chainLock.userData.setFallen(on),
    setNotice(on) { notice.visible = !!on; },
    focus: { position: [R.x1 - 2.4, 1.45, AUD.z], lookAt: [R.x1, 1.3, AUD.z] },
    lockFocus: { position: [R.x1 - 0.85, 1.05, AUD.z], lookAt: [R.x1, 0.85, AUD.z] },
  };
  h.doors.auditorium = { object: aud, leaves: aud.userData.leaves, hit: audHit };
  let houseK = 0, houseT = 0;
  const applyHouse = () => {
    const open = house.visible;
    gapGlow.material.opacity = houseK * (open ? 0 : 0.9);
    spill.material.opacity = houseK * (open ? 0.55 : 0.28);
    houseLight.intensity = houseK * 30; royalGlow.material.opacity = houseK * 0.7; royalGlow.visible = houseK > 0.01;
    for (const s of sconces) { s.material.opacity = houseK * 0.8; s.visible = houseK > 0.01; } // POLISH
    audLight.intensity = houseK * (open ? 6 : 1.5);
  };
  const audLight = new THREE.PointLight('#ffae60', 0, 6, 2); audLight.position.set(R.x1 - 0.4, 0.4, AUD.z); G.add(audLight);
  h.house = {
    /** The house lights (houseboard solved): glow under / through the auditorium doors, the Royal Box gold. */
    set(t, instant) { houseT = +t; if (instant) { houseK = houseT; applyHouse(); } },
  };
  onUpdate((dt) => { if (Math.abs(houseK - houseT) > 0.002) { houseK = chase(houseK, houseT, dt, 0.8); applyHouse(); } });

  // ---------------------------------------------------------------------------------------------------
  // LIVED-IN: rain under the doors, a drip into a bucket, a fallen stanchion, programmes underfoot, a sand bin,
  // a dead aspidistra, cobwebs, a red carpet strip from the doors, dust on the booth roof
  // ---------------------------------------------------------------------------------------------------
  const wet = new THREE.MeshPhysicalMaterial({ color: '#101418', roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.55, depthWrite: false });
  const puddle = mesh(new THREE.CircleGeometry(1, 40).scale(1.5, 0.75, 1).rotateX(-Math.PI / 2).translate(0.3, 0.003, R.z0 + 0.9), wet, { cast: false });
  G.add(noRay(puddle));
  const puddle2 = mesh(new THREE.CircleGeometry(0.35, 24).rotateX(-Math.PI / 2).translate(2.6, 0.003, -2.2), wet, { cast: false }); G.add(noRay(puddle2));
  const drip = T.bucket({ style: 'water' }); at(drip, 2.6, 0, -2.2); G.add(drip);
  // a drop falls from a ceiling stain into the bucket every ~2.5 s
  const dropMesh = noRay(mesh(new THREE.SphereGeometry(0.012, 8, 6).scale(1, 1.6, 1), new THREE.MeshStandardMaterial({ color: '#cfe0ea', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.7, emissive: '#3a4650', emissiveIntensity: 0.4 }), { cast: false, receive: false }));
  dropMesh.position.set(2.6, R.H, -2.2); G.add(keep(dropMesh));
  let dropT = 0;
  onUpdate((dt) => { dropT += dt; const k = dropT % 2.6; dropMesh.visible = k < 1.1; dropMesh.position.y = R.H - 0.05 - 0.5 * 9.8 * k * k; if (dropMesh.position.y < 0.24) dropMesh.visible = false; });
  // the carpet runner from the doors toward the stairs and box office (oxblood, worn, a ruck)
  const runway = mesh(new THREE.PlaneGeometry(1.8, 8.2).rotateX(-Math.PI / 2).translate(0, 0.006, R.z0 + 4.6), new THREE.MeshStandardMaterial({ map: (() => { const t = runnerTexture().clone(); t.repeat.set(1, 6); t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t; })(), roughness: 0.95 }), { cast: false });
  G.add(runway);
  // sand bin and fire bucket by the auditorium doors, a fallen brass stanchion with its rope
  const fire = T.bucket({ style: 'fire' }); at(fire, R.x1 - 0.3, 0, AUD.z + 1.45); G.add(fire);
  const stanParts = [latheG([[0, 0], [0.13, 0], [0.13, 0.025], [0.035, 0.06], [0.025, 0.92], [0.045, 0.95], [0.05, 1.0], [0, 1.04]], 16)];
  const stanchionUp = mesh(mergeG(stanParts.map((g) => g.clone())), M.brass({ roughness: 0.32 })); at(stanchionUp, 3.4, 0, 0.6); G.add(stanchionUp);
  const stanchionDown = mesh(mergeG(stanParts.map((g) => g.clone())), M.brass({ roughness: 0.32 })); stanchionDown.position.set(4.4, 0.13, 1.1); stanchionDown.rotation.set(0, 0.6, -Math.PI / 2 + 0.12); G.add(stanchionDown);
  G.add(mesh(tubeG([[3.4, 0.95, 0.6], [3.7, 0.5, 0.75], [4.0, 0.06, 0.95], [4.35, 0.04, 1.2], [4.9, 0.05, 1.05]], 0.026, { radial: 8, seg: 40 }), M.velvetRed()));
  // programmes and tickets underfoot
  const litter = [], lr = rng(77);
  for (let i = 0; i < 26; i++) { const x = -4 + lr() * 10, z = -6.2 + lr() * 9; if (x < -4.8 && z > -3.6) continue; litter.push({ p: [x, 0.004 + i * 0.0002, z], r: [-Math.PI / 2, 0, lr() * TAU], s: [0.7 + lr() * 0.6, 0.7 + lr() * 0.6, 1], c: ['#e8dcc0', '#d8c8a0', '#c8a8a0', '#e0d8c8'][i % 4] }); }
  G.add(instances(new THREE.PlaneGeometry(0.14, 0.2), new THREE.MeshStandardMaterial({ map: T.posterTexture({ title: 'PROGRAMME', subtitle: 'The Lamp at Gull Point', style: 'bill', w: 256, h: 360, seed: 12 }), roughness: 0.92, side: THREE.DoubleSide }), litter, { cast: false }));
  // a dead aspidistra in a jardinière by the foot of the stairs
  const jard = mergeInto([latheG([[0, 0], [0.12, 0], [0.16, 0.06], [0.2, 0.3], [0.22, 0.36], [0.19, 0.38], [0, 0.38]], 20)], M.porcelain('#2f5a6a'));
  at(jard, -2.75, 0, 3.3); G.add(jard);
  const leaves = [];
  for (let i = 0; i < 11; i++) { const a = i / 11 * TAU + lr() * 0.4, len = 0.35 + lr() * 0.25, droop = 0.3 + lr() * 0.6; leaves.push(tubeG([[0, 0.36, 0], [Math.cos(a) * 0.08, 0.5, Math.sin(a) * 0.08], [Math.cos(a) * len * 0.6, 0.36 + len * 0.6 - droop * 0.2, Math.sin(a) * len * 0.6], [Math.cos(a) * len, 0.36 + len * 0.4 - droop * 0.5, Math.sin(a) * len]], 0.012, { radial: 4, seg: 10 }).scale(1, 1, 1)); }
  const plant = mesh(mergeG(leaves), new THREE.MeshStandardMaterial({ color: '#5a5030', roughness: 0.9 })); at(plant, -2.75, 0, 3.3); G.add(plant);
  // cobwebs in corners: over the kiosk, in the chandelier rose, the booth roof corner, the clock
  const webMat = new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  for (const [x, y, z, ry, s] of [[R.x0 + 0.01, R.H - 0.42, R.z0 + 0.01, 0, 1.0], [R.x1 - 0.01, R.H - 0.42, R.z0 + 0.01, -Math.PI / 2, 0.8], [B.x0 - 0.05, B.H + 0.12, B.z1 + 0.05, Math.PI, 0.5], [R.x1 - 0.01, R.H - 0.42, R.z1 - 0.01, Math.PI, 0.9]]) {
    const w = noRay(mesh(new THREE.PlaneGeometry(s, s).translate(s / 2, -s / 2, 0), webMat, { cast: false, receive: false })); w.position.set(x, y, z); w.rotation.y = ry; G.add(w);
  }
  // the booth roof: dust sheets over boxes, a rolled carpet, a broken bust
  const roof = grp('boothRoof'); roof.position.set(0, B.H + 0.08, 0); G.add(roof);
  roof.add(mergeInto([boxG(0.6, 0.4, 0.5, 5.4, 0.2, -6.3, 0.02), boxG(0.5, 0.3, 0.4, 6.1, 0.15, -6.4, 0.02), boxG(0.4, 0.5, 0.4, 6.9, 0.25, -5.0, 0.02)], M.wood({ tint: '#6a4a2a' })));
  roof.add(mesh(cylG(0.16, 0.16, 2.4, 16).rotateZ(Math.PI / 2).rotateY(0.25).translate(6.0, 0.16, -4.3), new THREE.MeshStandardMaterial({ color: '#5a2a24', roughness: 0.95 })));

  // ---------------------------------------------------------------------------------------------------
  // LIGHTS: dark (street only) and lit (the chandelier) and everything between; dust in the street beam
  // ---------------------------------------------------------------------------------------------------
  const amb = Lt.ambientRig({ sky: '#7a88aa', ground: '#1a120c', hemi: 0.06, ambient: '#2a2232', ambientIntensity: 0.05 });
  G.add(amb);
  const hemi = amb.userData.hemi, ambient = amb.children.find((c) => c.isAmbientLight);
  const sodiumRig = Lt.keyLight({ color: SODIUM, intensity: 60, position: [0.35, 3.9, R.z0 - 2.7], target: [-0.7, 0, -0.6], angle: 0.6, penumbra: 0.55, distance: 22, decay: 1.25, castShadow: true, mapSize: 2048 });
  G.add(sodiumRig);
  const sodium = sodiumRig.userData.light;
  sodium.shadow.camera.near = 0.5;
  // the headlight sweep: a car turning in the street every ~25 s, its beams raking the ceiling
  const headRig = Lt.keyLight({ color: '#fff0d8', intensity: 0, position: [-6, 0.6, R.z0 - 4], target: [-6, R.H, 0], angle: 0.32, penumbra: 0.7, distance: 26, decay: 1.1, castShadow: false });
  G.add(headRig);
  const head = headRig.userData.light;
  let headT = 14;
  const headSweep = () => { headT = 0; };
  onUpdate((dt) => {
    headT += dt;
    const k = headT / 3.4;
    if (k <= 1) {
      const x = -7 + k * 14;
      head.position.set(x * 0.35, 0.6, R.z0 - 4); head.target.position.set(x, R.H, -1 + Math.sin(k * Math.PI) * 2.5);
      head.intensity = Math.sin(k * Math.PI) ** 1.5 * 90 * (1 - lightK * 0.7);
      if (k > 0.2 && k < 0.25 && !street.userData.bus.visible && Math.random() < 0.02) street.userData.driveBus();
    } else head.intensity = 0;
    if (headT > 25) headT = 0;
  });
  const catSpot = Lt.keyLight({ color: SODIUM, intensity: 9, position: [5.05, 3.25, R.z0 - 1.3], target: [CAT.x, CT.y + 0.1, CAT.z], angle: 0.2, penumbra: 0.6, distance: 9, decay: 1.4, castShadow: false });
  G.add(catSpot);
  const boothLight = new THREE.PointLight(WARM, 0, 6.5, 1.8); boothLight.position.set(5.95, 2.45, -5.2); G.add(boothLight);
  // the street beam through the doors, dust in it, dust under the chandelier when lit
  const shaft = Lt.lightShaft({ from: [0, 3.0, R.z0 - 0.2], to: [-0.5, 0, -2.2], radiusTop: 1.5, radiusBottom: 2.4, color: '#ff9a48', opacity: 0.075, square: true });
  G.add(shaft);
  const fanShaft = Lt.lightShaft({ from: [0, 3.6, R.z0 - 0.1], to: [-0.6, 0.6, -2.4], radiusTop: 1.2, radiusBottom: 1.9, color: '#ff9a48', opacity: 0.04, square: false });
  G.add(fanShaft);
  const dustStreet = P.dustMotes({ box: [3.2, 3.2, 4.2], center: [-0.3, 1.6, -4.6], count: 260, color: '#ffc890', size: 0.016, opacity: 0.55 });
  G.add(dustStreet);
  const dustChand = P.dustMotes({ box: [6, 4.5, 6], center: [CH.x, 2.6, CH.z], count: 380, color: '#ffe8c0', size: 0.016, opacity: 0.0 });
  G.add(dustChand);
  const setDustOpacity = (pts, o) => { const m = pts.material; if (m.uniforms?.uOpacity) m.uniforms.uOpacity.value = o; else m.opacity = o; pts.visible = o > 0.01; };

  const DARK = { hemi: 0.07, amb: 0.05, sodium: 60, chSpot: 0, chPoint: 0, booth: 0, cat: 9, exposure: 1.32, bloom: 0.5, sky: new THREE.Color('#7a88aa'), shaft: 0.075 };
  const LIT = { hemi: 0.3, amb: 0.1, sodium: 30, chSpot: 150, chPoint: 42, booth: 2.5, cat: 4, exposure: 0.92, bloom: 0.36, sky: new THREE.Color('#ffd8a8'), shaft: 0.03 };
  let lightK = 0, lightT = 0;
  function dirtyShadows() { chSpot.shadow.needsUpdate = true; sodium.shadow.needsUpdate = true; }
  const applyLight = () => {
    const k = lightK, L = (a, b) => a + (b - a) * k;
    hemi.intensity = L(DARK.hemi, LIT.hemi); hemi.color.copy(DARK.sky).lerp(LIT.sky, k);
    if (ambient) ambient.intensity = L(DARK.amb, LIT.amb);
    sodium.intensity = L(DARK.sodium, LIT.sodium);
    chSpot.intensity = L(DARK.chSpot, LIT.chSpot); chPoint.intensity = L(DARK.chPoint, LIT.chPoint);
    boothLight.intensity = L(DARK.booth, LIT.booth); catSpot.userData.light.intensity = L(DARK.cat, LIT.cat);
    shaft.userData.setOpacity(L(DARK.shaft, LIT.shaft)); fanShaft.userData.setOpacity(L(DARK.shaft, LIT.shaft) * 0.5);
    setDustOpacity(dustChand, 0.5 * k);
    lamp.userData.setLit(k, true);
    newel.userData.setLit(k);
    // one shadow map at a time: the street lamp's while dark, the chandelier's once lit (same count: no recompile)
    const chShadow = k > 0.5;
    if (chSpot.castShadow !== chShadow) { chSpot.castShadow = chShadow; sodium.castShadow = !chShadow; }
    dirtyShadows();
  };
  // Both shadow maps are redrawn only when something that casts moves (the lights, the cat, the passing bus, a hook
  // that calls h.lighting.refreshShadows()): the room is static, and a full-room spot shadow pass costs ~40-50k triangles.
  chSpot.shadow.autoUpdate = false; sodium.shadow.autoUpdate = false;
  let catSig = '';
  onUpdate(() => {
    if (street.userData.bus?.visible) dirtyShadows();
    const cg = ctx.characters?.cat?.group;
    const sig = cg && cg.parent ? `${cg.position.x.toFixed(3)},${cg.position.y.toFixed(3)},${cg.position.z.toFixed(3)},${cg.rotation.y.toFixed(2)},${cg.visible}` : '';
    if (sig !== catSig) { catSig = sig; dirtyShadows(); }
  });
  h.lighting = {
    /** 0 = dark (the street only), 1 = the chandelier lit. Chased over ~1.5 s unless instant. */
    set(t, instant) { lightT = THREE.MathUtils.clamp(+t, 0, 1); if (instant) { lightK = lightT; applyLight(); } },
    get level() { return lightK; },
    exposure: () => DARK.exposure + (LIT.exposure - DARK.exposure) * lightK,
    bloom: () => DARK.bloom + (LIT.bloom - DARK.bloom) * lightK,
    sweep: headSweep,
    /** Redraw the (static) shadow map once: call after moving anything that casts. */
    refreshShadows: () => dirtyShadows(),
    DARK, LIT,
  };
  onUpdate((dt) => { if (Math.abs(lightK - lightT) > 0.001) { lightK = chase(lightK, lightT, dt, 1.6); if (Math.abs(lightK - lightT) < 0.002) lightK = lightT; applyLight(); } });
  applyLight();

  // ---------------------------------------------------------------------------------------------------
  // PERCHES and the update loop
  // ---------------------------------------------------------------------------------------------------
  h.perches.lavinia = { position: [-5.62, LANDING_Y, -1.05], rotationY: 0.62, pose: 'stand' };
  h.perches.laviniaStairs = { position: [-6.2, RISE * 4, STAIR_Z0 - 3 * GOING - 0.15], rotationY: 0.6, pose: 'hover' };
  h.perches.catStairsTop = { position: [R.x0 - 1.6, LANDING_Y + RISE * 6, -2.3], rotationY: -Math.PI / 2 };
  h.perches.catPath = [[CAT.x + 0.8, 0, -4.6], [6.7, 0, -3.3], [3.0, 0, 1.5], [-3.9, RISE * 1, 3.0], [-6.2, RISE * 6, 2.2], [-6.2, LANDING_Y, -1.6], [R.x0 + 0.4, LANDING_Y, -2.3], [R.x0 - 1.6, LANDING_Y + RISE * 6, -2.3]];
  h.update = (dt, t) => { for (const f of updaters) f(dt, t); };
  h.consts = { ROOM, VANTAGE, CH, BOOTH, AUD, LANDING_Y };
  // shadow budget: small things (and the chandelier, lit from within) do not cast
  const sph = new THREE.Sphere(); G.updateMatrixWorld(true);
  G.traverse((o) => {
    if (!o.isMesh || !o.castShadow) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
    if (!o.isInstancedMesh && sph.radius < 0.22) o.castShadow = false;
  });
  chand.traverse((o) => { o.castShadow = false; });
  aud.traverse((o) => { o.castShadow = false; });
  for (const c of G.children) if (c.name === 'marbleColumn') c.children[1].castShadow = false; // the gilt capitals
  // the booth's contents sit under its roof; the winch is inside its cabinet; the chain and umbrellas are fine detail
  for (const o of [h.safe.object, h.machine.object, h.houseboard.object, h.winch.object, h.auditorium.chain, h.umbrellas.object, h.glove.object, h.kiosk.object, liftChain]) o?.traverse?.((m) => { m.castShadow = false; });
  return h;
}

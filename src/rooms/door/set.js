// The Stage Door & Green Room (SET-door). buildSet(ctx, group) builds the whole room into `group` (world coords:
// floor centre at the origin, the pass door on the north wall at -Z, the stage door on the west wall at -X) and
// returns `handles`: every object the puzzles touch and every delight, with animation hooks and focus framings.
// The room's index.js registers hotspots against these handles; PUZZLES wires the mechanics. See docs/notes/set-door.md.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as T from '../../engine/props/theatre.js';
import * as Lt from '../../engine/props/lights.js';
import * as P from '../../engine/props/particles.js';
import { rng } from '../../engine/props/textures.js';
import * as D from './props.js';

const { mesh, boxG, cylG, merged, noRay, grp, proxy, canvasTex, TAU } = D;
const FONTS = T.FONTS;

export const ROOM = { x0: -2.9, x1: 2.9, z0: -3.2, z1: 3.2, H: 3.3 };
export const VANTAGE = { position: [-0.85, 1.6, 2.55], lookAt: [-1.2, 1.3, -3.2], fov: 60 };
const DADO = 1.1;

// colours of the two light states
const SODIUM = '#ff8a2e', LILAC = '#cdb8ff', WARM = '#ffb36a';

/** Place o at (x,y,z) with a yaw; returns o. */
function at(o, x, y, z, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; return o; }
/** Mark an object (and so its subtree) as never merged by mergeStatic. */
function keep(o) { o.userData.keep = true; return o; }
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// =====================================================================================================
// SURFACES
// =====================================================================================================
function wallMaterial() {
  // 3 m × 3.3 m of wall per tile: bottle-green gloss dado below 1.1 m, nicotine distemper above, smoke toward the top
  const PX_W = 1024, PX_H = 1024, mW = 3, mH = ROOM.H;
  const yPx = (m) => PX_H - (m / mH) * PX_H;
  const map = canvasTex(PX_W, PX_H, (g, w, h) => {
    const r = rng(17);
    g.fillStyle = '#d4c293'; g.fillRect(0, 0, w, h);
    T.grime(g, w, h, { seed: 21, color: '#8a7448', octaves: [[3, 0.22], [12, 0.14], [48, 0.08]] });
    // smoke darkening toward the ceiling, and drips from the picture rail
    const sm = g.createLinearGradient(0, 0, 0, yPx(2.2)); sm.addColorStop(0, 'rgba(70,52,26,0.55)'); sm.addColorStop(1, 'rgba(70,52,26,0)');
    g.fillStyle = sm; g.fillRect(0, 0, w, yPx(2.2));
    for (let i = 0; i < 9; i++) {
      const x = r() * w, y = yPx(2.55) + r() * 20, len = 60 + r() * 220;
      const gr = g.createLinearGradient(x, y, x, y + len); gr.addColorStop(0, 'rgba(110,80,36,0.22)'); gr.addColorStop(1, 'rgba(110,80,36,0)');
      g.fillStyle = gr; g.fillRect(x - 3 - r() * 8, y, 6 + r() * 14, len);
    }
    // cracks
    g.strokeStyle = 'rgba(60,44,26,0.5)'; g.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { let x = r() * w, y = yPx(3.0) + r() * 260; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 18; k++) { x += (r() - 0.5) * 16; y += 5 + r() * 9; g.lineTo(x, y); } g.stroke(); }
    // ghost rectangles where pictures once hung
    for (let i = 0; i < 2; i++) { const x = 80 + r() * (w - 300), y = yPx(2.1); g.fillStyle = 'rgba(240,226,180,0.25)'; g.fillRect(x, y, 140 + r() * 80, 110 + r() * 60); }
    // the dado: gloss bottle green, chipped to the cream undercoat, kicked black at the bottom
    const y0 = yPx(DADO);
    g.fillStyle = '#21402e'; g.fillRect(0, y0, w, h - y0);
    T.grime(g, w, h, { seed: 26, color: '#0c1a12', octaves: [[6, 0.18], [30, 0.1]] });
    g.fillStyle = '#d4c293'; g.fillRect(0, 0, w, y0); // re-cover the upper wall where the dado grime spilled
    T.grime(g, w, y0, { seed: 22, color: '#8a7448', octaves: [[3, 0.2], [12, 0.12], [48, 0.07]] });
    const sm2 = g.createLinearGradient(0, 0, 0, yPx(2.2)); sm2.addColorStop(0, 'rgba(70,52,26,0.55)'); sm2.addColorStop(1, 'rgba(70,52,26,0)');
    g.fillStyle = sm2; g.fillRect(0, 0, w, yPx(2.2));
    // a few chips, mostly knocked along the rail edge (chairs) rather than scattered like confetti
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(150,138,100,${0.3 + r() * 0.3})`; const s = 1.5 + r() * 4; g.beginPath(); g.ellipse(r() * w, y0 + 6 + Math.pow(r(), 2.5) * (h - y0 - 8), s, s * 0.5, r() * 3, 0, TAU); g.fill(); }
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(10,10,6,${0.15 + r() * 0.25})`; g.fillRect(r() * w, h - 8 - r() * 70, 8 + r() * 50, 1 + r() * 3); }
    const hl = g.createLinearGradient(0, y0, 0, h); hl.addColorStop(0, 'rgba(255,255,255,0.06)'); hl.addColorStop(0.4, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.fillRect(0, y0, w, h - y0);
  });
  const rough = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#ececec'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a5a5a'; g.fillRect(0, h - (DADO / ROOM.H) * h, w, h);
  }, { srgb: false });
  for (const t of [map, rough]) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1 / mW, 1 / mH); t.needsUpdate = true; }
  return new THREE.MeshStandardMaterial({ map, roughnessMap: rough, roughness: 1, shadowSide: THREE.DoubleSide });
}

function floorMaterial() {
  // the whole floor in one canvas: brown lino, sheet seams, a worn path stage door → pass door, and to the hutch ledge
  const S = 1024;
  const px = (x) => (x - ROOM.x0) / (ROOM.x1 - ROOM.x0) * S, pz = (z) => (z - ROOM.z0) / (ROOM.z1 - ROOM.z0) * S;
  const map = canvasTex(S, S, (g) => {
    const r = rng(51);
    g.fillStyle = '#6a4630'; g.fillRect(0, 0, S, S);
    T.grime(g, S, S, { seed: 52, color: '#3a2214', octaves: [[6, 0.25], [24, 0.15], [90, 0.08]] });
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(150,110,80,${0.05 + r() * 0.08})`; g.fillRect(r() * S, r() * S, 4 + r() * 22, 1); }
    // marbling flecks of the old lino
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,22,12' : '140,100,64'},0.18)`; g.beginPath(); g.ellipse(r() * S, r() * S, 3 + r() * 10, 1 + r() * 3, r() * 3, 0, TAU); g.fill(); }
    // worn path: soft pale blobs along polylines
    const wear = (pts, width, a) => {
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, z0] = pts[k], [x1, z1] = pts[k + 1];
        const n = Math.ceil(Math.hypot(px(x1) - px(x0), pz(z1) - pz(z0)) / 10);
        for (let i = 0; i <= n; i++) {
          const t = i / n, x = px(x0 + (x1 - x0) * t) + (r() - 0.5) * 14, y = pz(z0 + (z1 - z0) * t) + (r() - 0.5) * 14;
          const rad = width * (0.8 + r() * 0.4);
          const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(176,140,100,${a})`); gr.addColorStop(1, 'rgba(176,140,100,0)');
          g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
      }
    };
    wear([[-2.6, 1.3], [-1.6, 0.6], [-0.6, -1.2], [0.15, -2.6], [0.15, -3.1]], 70, 0.09);
    wear([[-1.6, 0.6], [-2.0, -1.2]], 55, 0.08);
    wear([[-0.6, -1.0], [1.0, -0.2], [1.9, 0.4]], 50, 0.06);
    wear([[-0.4, -1.8], [1.1, -2.7]], 40, 0.06);
    // dirt along the skirting
    const edge = 40;
    for (const [x, y, w, h, dir] of [[0, 0, S, edge, 'v'], [0, S - edge, S, edge, 'v-'], [0, 0, edge, S, 'h'], [S - edge, 0, edge, S, 'h-']]) {
      const gr = dir === 'v' ? g.createLinearGradient(0, 0, 0, edge) : dir === 'v-' ? g.createLinearGradient(0, S, 0, S - edge) : dir === 'h' ? g.createLinearGradient(0, 0, edge, 0) : g.createLinearGradient(S, 0, S - edge, 0);
      gr.addColorStop(0, 'rgba(20,12,6,0.55)'); gr.addColorStop(1, 'rgba(20,12,6,0)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    }
    // sheet seams every 0.92 m (running north-south), slightly lifted and dark
    g.strokeStyle = 'rgba(25,14,8,0.55)'; g.lineWidth = 2;
    for (let x = ROOM.x0 + 0.62; x < ROOM.x1; x += 0.92) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x) + 3, S); g.stroke(); }
    // a few cigarette burns and a scorched patch in front of the sofa
    for (const [x, z] of [[1.7, 0.1], [1.4, 1.0], [-0.3, 0.3], [2.0, -0.9]]) { g.fillStyle = 'rgba(10,6,2,0.7)'; g.beginPath(); g.ellipse(px(x), pz(z), 5, 3, r() * 3, 0, TAU); g.fill(); }
    // wet footprints at the stage door
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(40,24,12,0.28)'; g.beginPath(); g.ellipse(px(-2.45 + i * 0.16), pz(1.2 + (i % 2) * 0.16 - i * 0.05), 9, 20, 1.2, 0, TAU); g.fill(); }
  });
  return new THREE.MeshStandardMaterial({ map, roughness: 0.58, metalness: 0 });
}

/** One wall: ShapeGeometry (metre UVs) with holes, plus skirting / dado rail / picture rail / cornice runs. */
function wall({ len, pos, ry, holes = [], gaps = [], mat, trimMat, darkMat }) {
  const g = grp('wall');
  const geo = D.wallGeo(len, ROOM.H, holes);
  const m = mesh(geo, mat, { cast: true, receive: true });
  g.add(m);
  // runs: a horizontal moulding along the wall, interrupted by the gaps [[x0, x1], ...] (in wall-local x)
  const runs = (y0, y1) => {
    const segs = []; let a = -len / 2;
    const gs = gaps.filter(([, , gy0, gy1]) => !(y1 < gy0 || y0 > gy1)).map(([x0, x1]) => [x0, x1]).sort((p, q) => p[0] - q[0]);
    for (const [x0, x1] of gs) { if (x0 > a) segs.push([a, x0]); a = Math.max(a, x1); }
    if (a < len / 2) segs.push([a, len / 2]);
    return segs;
  };
  const trims = [], dark = [];
  for (const [a, b] of runs(0, 0.18)) dark.push(boxG(b - a, 0.17, 0.025, (a + b) / 2, 0.085, 0.0125), boxG(b - a, 0.02, 0.035, (a + b) / 2, 0.17, 0.0175));
  for (const [a, b] of runs(DADO - 0.03, DADO + 0.03)) trims.push(boxG(b - a, 0.045, 0.03, (a + b) / 2, DADO, 0.015), boxG(b - a, 0.015, 0.04, (a + b) / 2, DADO + 0.025, 0.02));
  for (const [a, b] of runs(2.6, 2.65)) trims.push(boxG(b - a, 0.035, 0.022, (a + b) / 2, 2.62, 0.011));
  // cornice: a stepped profile at the ceiling
  trims.push(boxG(len, 0.06, 0.07, 0, ROOM.H - 0.03, 0.035), boxG(len, 0.05, 0.04, 0, ROOM.H - 0.085, 0.02), boxG(len, 0.025, 0.11, 0, ROOM.H - 0.0125, 0.055));
  if (trims.length) g.add(merged(trims, trimMat));
  if (dark.length) g.add(merged(dark, darkMat));
  g.position.set(...pos); g.rotation.y = ry;
  return g;
}

/** Typed call sheet (the callboard paper), drawn onto aged paper. Legible at the focus view. */
function callsheetTexture() {
  return T.agedPaperTexture({
    w: 600, h: 760, seed: 33, age: 0.55, key: 'door-callsheet',
    draw: (g, w, h) => {
      g.fillStyle = '#1e1810'; g.textAlign = 'center';
      g.font = `30px ${FONTS.typed}`; g.fillText('EMPRESS THEATRE, PELHAM STREET', w / 2, 70);
      g.font = `52px ${FONTS.typed}`; g.fillText('CALLS', w / 2, 140);
      g.fillRect(70, 160, w - 140, 3);
      g.font = `26px ${FONTS.typed}`; g.fillText('SATURDAY 14th MARCH 1931', w / 2, 210);
      g.fillStyle = '#9a1c16'; g.font = `30px ${FONTS.typed}`; g.fillText('— CLOSING NIGHT —', w / 2, 252);
      g.fillStyle = '#1e1810'; g.textAlign = 'left';
      g.font = `30px ${FONTS.typed}`; g.fillText('MATINEE', 60, 320);
      g.font = `26px ${FONTS.typed}`;
      g.fillText('The Half ........ 1.55', 80, 362); g.fillText('Beginners ....... 2.25', 80, 398); g.fillText('Curtain ......... 2.30', 80, 434);
      g.font = `30px ${FONTS.typed}`; g.fillText('EVENING', 60, 500);
      g.font = `26px ${FONTS.typed}`;
      g.fillText('The Half ........ 6.55', 80, 542); g.fillText('Beginners ....... 7.25', 80, 578); g.fillText('Curtain ......... 7.30', 80, 614);
      // Alf's pencil ring round the evening Half
      g.strokeStyle = 'rgba(60,60,72,0.75)'; g.lineWidth = 3; g.beginPath(); g.ellipse(300, 534, 220, 28, -0.03, 0, TAU); g.stroke();
      g.font = `20px ${FONTS.typed}`; g.fillText('All company to sign in BY THE HALF.', 60, 668);
      g.font = `24px ${FONTS.hand}`; g.fillStyle = '#2a2440'; g.fillText('H. Pike, S.M.', w - 250, 720);
    },
  });
}
/** A small handwritten slip for the call board. */
function slipTexture(lines, seed, { tint = '#efe4c4', ink = '#2a2440', font = FONTS.hand, size = 30 } = {}) {
  return T.agedPaperTexture({
    w: 400, h: 250, seed, tint, age: 0.6, key: 'door-slip-' + seed,
    draw: (g, w) => {
      g.fillStyle = ink; g.font = `${size}px ${font}`; g.textAlign = 'left';
      lines.forEach((l, i) => g.fillText(l, 26, 70 + i * (size * 1.5)));
    },
  });
}

// =====================================================================================================
// BUILD
// =====================================================================================================
export function buildSet(ctx, group) {
  const G = group;
  const H = {}; // handles
  const fx = []; // per-frame jobs of the set (glow breathing, glint, light flicker, kettle)
  const R = rng(9);

  // ---- materials shared across the set -----------------------------------------------------------------
  const wallMat = wallMaterial();
  const trimMat = M.wood({ tint: '#3c2414', seed: 61, roughness: 0.4 });
  const darkMat = M.wood({ tint: '#24160c', seed: 62, roughness: 0.55 });
  const varnish = M.wood({ tint: '#5a3418', seed: 41, roughness: 0.42 });

  // ---- shell -------------------------------------------------------------------------------------------
  const floor = mesh(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0).rotateX(-Math.PI / 2), floorMaterial(), { cast: false });
  floor.name = 'floor'; G.add(floor);
  const ceilMat = new THREE.MeshStandardMaterial({ map: T.wornPlasterTexture({ tint: '#a89670', seed: 71, stains: 5 }), roughness: 0.95 });
  ceilMat.map = ceilMat.map.clone(); ceilMat.map.wrapS = ceilMat.map.wrapT = THREE.RepeatWrapping; ceilMat.map.repeat.set(2, 2); ceilMat.map.needsUpdate = true;
  const ceil = mesh(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0).rotateX(Math.PI / 2).translate(0, ROOM.H, 0), ceilMat, { cast: false });
  ceil.name = 'ceiling'; G.add(ceil);
  const PASS_X = 0.15, STAGE_Z = 1.3, RAINWIN_Z = -2.25;
  G.add(wall({ len: 5.8, pos: [0, 0, ROOM.z0], ry: 0, holes: [[PASS_X, 0, 0.95, 2.12]], gaps: [[PASS_X - 0.6, PASS_X + 0.6, 0, 2.3]], mat: wallMat, trimMat, darkMat }));
  G.add(wall({ len: 5.8, pos: [0, 0, ROOM.z1], ry: Math.PI, mat: wallMat, trimMat, darkMat }));
  // west: shape x = -world z
  G.add(wall({ len: 6.4, pos: [ROOM.x0, 0, 0], ry: Math.PI / 2, holes: [[-STAGE_Z, 0, 1.0, 2.58], [-RAINWIN_Z, 1.15, 0.45, 0.6]], gaps: [[-STAGE_Z - 0.62, -STAGE_Z + 0.62, 0, 2.8]], mat: wallMat, trimMat, darkMat }));
  G.add(wall({ len: 6.4, pos: [ROOM.x1, 0, 0], ry: -Math.PI / 2, mat: wallMat, trimMat, darkMat }));

  // ceiling furniture: pipes along the north wall and across, two roses for the pendants
  G.add(T.pipeRun([[-2.85, 3.12, -3.1], [2.85, 3.12, -3.1]], { r: 0.035, color: '#5a544a', wallDir: [0, 1, 0] }));
  G.add(T.pipeRun([[-2.85, 3.2, -2.95], [1.6, 3.2, -2.95], [1.6, 3.2, 3.1]], { r: 0.022, color: '#6a5a44', wallDir: [0, 1, 0] }));
  G.add(T.pipeRun([[2.82, 0.12, -3.1], [2.82, 0.12, 3.1]], { r: 0.03, color: '#4a3e30', wallDir: [1, 0, 0] }));

  // =====================================================================================================
  // LIGHTING RIG (dark start; setLit swaps to the honey-and-bottle-green state)
  // =====================================================================================================
  const amb = Lt.ambientRig({ sky: '#ffcf9e', ground: '#1e140c', hemi: 0.3, ambient: '#3a2e2a', ambientIntensity: 0.22 });
  G.add(amb);
  const hemi = amb.userData.hemi, ambient = amb.children.find((c) => c.isAmbientLight);
  // 1. sodium streetlamp through the fanlight: the room's single shadow caster
  const sodium = Lt.keyLight({ color: SODIUM, intensity: 14, position: [ROOM.x0 + 0.12, 2.42, STAGE_Z - 0.05], target: [-2.05, 0.55, -1.45], angle: 0.62, penumbra: 0.55, distance: 9, decay: 1.5, castShadow: true, mapSize: 1024 });
  sodium.userData.light.shadow.camera.near = 0.1;
  G.add(sodium);
  const shaft = Lt.lightShaft({ from: [ROOM.x0 + 0.05, 2.36, STAGE_Z], to: [-2.0, 0.6, -1.1], radiusTop: 0.32, radiusBottom: 0.9, color: '#ffa458', opacity: 0.075 });
  G.add(shaft);
  G.add(P.dustMotes({ box: [0.8, 1.6, 2.2], center: [-2.4, 1.5, -0.2], count: 90, color: '#ffc890', size: 0.014, opacity: 0.35 }));
  // 2. EXIT sign green spill
  const exitLight = new THREE.PointLight('#46ff8a', 0.28, 3.2, 2); exitLight.position.set(ROOM.x0 + 0.3, 2.85, STAGE_Z); G.add(exitLight);
  // 3. the lilac glow under the pass door (Lavinia's presence): emissive strip + floor spill + a faint point light
  const glowLight = new THREE.PointLight(LILAC, 0.6, 2.6, 2); glowLight.position.set(PASS_X, 0.06, ROOM.z0 + 0.1); G.add(glowLight);
  // 4. cool rain-window light inside the hutch
  const boothLight = new THREE.PointLight('#8fa6c8', 0.35, 2.2, 2); boothLight.position.set(-2.55, 1.3, -2.2); G.add(boothLight);
  // 5. lit state: two green-shaded pendants + the hutch desk lamp (no shadows)
  const pendants = [], pendantLights = [];
  for (const [x, z] of [[-0.85, -1.45], [1.55, 0.3]]) {
    const p = T.pendantLamp({ style: 'enamel', color: '#1f4a30', drop: 0.78, lit: 0 });
    at(p, x, ROOM.H, z); G.add(keep(p)); pendants.push(p);
    const l = new THREE.PointLight(WARM, 0, 8, 2); l.position.set(x, ROOM.H - 0.04 + p.userData.bulbPos.y, z); G.add(l); pendantLights.push(l);
  }

  // =====================================================================================================
  // WEST WALL (near left): stage door, EXIT, coat stand
  // =====================================================================================================
  const stageDoor = T.theatreDoor({ style: 'maroon', w: 1.0, h: 2.1, fanlight: true });
  at(stageDoor, ROOM.x0, 0, STAGE_Z, Math.PI / 2); G.add(stageDoor);
  stageDoor.userData.glass && (stageDoor.userData.glass.castShadow = false, noRay(stageDoor.userData.glass));
  // the streetlamp beyond the fanlight: a warm wet glow with rain running down it
  const fanTex = canvasTex(512, 192, (g, w, h) => {
    const gr = g.createRadialGradient(w * 0.7, h * 0.15, 4, w * 0.6, h * 0.4, w * 0.75);
    gr.addColorStop(0, '#ffd58a'); gr.addColorStop(0.3, '#ff9a3a'); gr.addColorStop(1, '#5a2a10');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const fanGlow = noRay(mesh(new THREE.PlaneGeometry(1.0, 0.38), new THREE.MeshBasicMaterial({ map: fanTex, color: new THREE.Color(1.7, 1.7, 1.7), toneMapped: false }), { cast: false, receive: false }));
  fanGlow.position.set(0, 2.38, -0.2); stageDoor.add(fanGlow);
  const fanRain = noRay(mesh(new THREE.PlaneGeometry(1.0, 0.36), T.rainGlassMaterial({ opacity: 0.4, speed: 0.22 }), { cast: false, receive: false }));
  fanRain.position.set(0, 2.38, -0.03); fanRain.renderOrder = 1; stageDoor.add(fanRain);
  fanRain.userData.update = (dt) => fanRain.material.userData.update(dt);
  // a heavy iron draw bolt and a push bar on the leaf (the inside), and a notice
  const sLeaf = stageDoor.userData.leaves[0];
  sLeaf.add(merged([boxG(0.32, 0.035, 0.02, 0.3, 1.82, 0.04), boxG(0.06, 0.06, 0.03, 0.14, 1.82, 0.04), boxG(0.06, 0.06, 0.03, 0.42, 1.82, 0.04), cylG(0.012, 0.012, 0.08, 8).rotateZ(Math.PI / 2).translate(0.5, 1.82, 0.055)], M.ironBlack()));
  sLeaf.add(merged([cylG(0.018, 0.018, 0.72, 12).rotateZ(Math.PI / 2).translate(0.5, 1.02, 0.11), boxG(0.03, 0.03, 0.09, 0.17, 1.02, 0.07), boxG(0.03, 0.03, 0.09, 0.83, 1.02, 0.07)], M.enamel('#3a3a36', { roughness: 0.4, metalness: 0.6 })));
  const sdSign = T.enamelSign({ text: 'ALL COMPANY\nSIGN IN AT THE HUTCH', w: 0.36, h: 0.16, bg: '#e8dfc8', fg: '#1f3d2c', seed: 5 });
  sdSign.position.set(0.5, 1.45, 0.03); sLeaf.add(sdSign);
  const exitSign = T.exitSign({ text: 'EXIT', w: 0.44, lit: 1 });
  at(exitSign, ROOM.x0 + 0.005, 2.9, STAGE_Z, Math.PI / 2); G.add(exitSign);
  // a coconut mat inside the door, an umbrella stand with two umbrellas
  const matTex = canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#7a5a34'; g.fillRect(0, 0, w, h); T.grime(g, w, h, { seed: 81, color: '#2a1a0c', octaves: [[8, 0.3], [60, 0.2]] });
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${i % 2 ? '170,130,80' : '60,40,20'},0.25)`; g.fillRect(Math.random() * w, Math.random() * h, 1, 3); }
    g.fillStyle = 'rgba(20,12,6,0.35)'; g.fillRect(0, h * 0.4, w, h * 0.3);
  });
  G.add(at(mesh(boxG(0.62, 0.018, 0.95, 0, 0.009, 0), new THREE.MeshStandardMaterial({ map: matTex, roughness: 1 }), { cast: false }), -2.45, 0, STAGE_Z));
  const umb = grp('umbrellaStand');
  umb.add(merged([D.latheG([[0, 0], [0.11, 0], [0.12, 0.02], [0.11, 0.5], [0.12, 0.52], [0.105, 0.52], [0.095, 0.02], [0, 0.02]], 20)], M.enamel('#2a3a30', { roughness: 0.4, metalness: 0.4 })));
  for (const [x, z, rx, rz, col] of [[0.03, 0, 0.12, 0.1, '#1a1612'], [-0.03, 0.02, -0.1, -0.16, '#3a1a1c']]) {
    const u = grp('umbrella');
    u.add(merged([cylG(0.006, 0.006, 0.86, 6, 0, 0.43, 0), D.latheG([[0.001, 0.3], [0.04, 0.42], [0.05, 0.6], [0.035, 0.78], [0.008, 0.86], [0.001, 0.86]], 10)], M.matte(col, { roughness: 0.7 })));
    u.add(mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 12, Math.PI).rotateZ(Math.PI).translate(0.03, 0.88, 0), M.wood({ tint: '#4a2a14' })));
    u.position.set(x, 0.02, z); u.rotation.set(rx, R() * 3, rz); umb.add(u);
  }
  G.add(at(umb, -2.62, 0, 2.15));

  // the coat stand with Alf's long brown overcoat and flat cap; the right-hand pocket glints
  const stand = T.coatStand({ coat: { color: '#5e4128', capColor: '#4a4238', seed: 5 }, tint: '#3a2212' });
  at(stand, -2.45, 0, 0.02, 0.56); G.add(stand);
  // a scarf on another hook, a bowler on the top
  const scarf = mesh(T.tubeG([[0, 1.62, 0], [0.12, 1.5, -0.04], [0.14, 1.2, -0.06], [0.13, 0.98, -0.05]], 0.025, { radial: 8, seg: 14 }), M.matte('#6a1a1c', { roughness: 0.95 }));
  scarf.rotation.y = -2.2; stand.add(scarf);
  const coat = stand.userData.coat;
  const pocketLocal = coat.userData.pocket.clone();
  // a small brass key peeping out of the pocket (hidden once taken)
  const pocketKey = T.key({ style: 'mortice', metal: 'brass', len: 0.05 });
  pocketKey.scale.setScalar(0.85); pocketKey.position.copy(pocketLocal).add(v3(0.0, 0.025, 0.0)); pocketKey.rotation.set(0.2, 0.3, Math.PI / 2 - 0.3);
  coat.add(keep(pocketKey));
  const glint = D.glintSprite('#ffe6b0', 0.13); glint.position.copy(pocketLocal).add(v3(0.0, 0.05, 0.03)); coat.add(glint);
  const glintHalo = T.halo('#ffd9a0', 0.12, 0.0); glintHalo.position.copy(glint.position); coat.add(glintHalo);
  const pocketHit = proxy(0.2, 0.18, 0.14); pocketHit.position.copy(pocketLocal); coat.add(pocketHit);
  const coatHit = proxy(0.55, 1.35, 0.45); coatHit.position.set(0, -0.62, 0.2); coat.add(coatHit);
  G.updateMatrixWorld(true);
  const pocketWorld = coat.localToWorld(pocketLocal.clone());
  const coatFacing = v3(Math.sin(0.56), 0, Math.cos(0.56));
  let glintOn = 1, glintLevel = 1;
  fx.push((dt, t) => {
    glintLevel += ((glintOn ? 1 : 0) - glintLevel) * Math.min(1, dt * 4);
    const tw = Math.pow(Math.max(0, Math.sin(t * 1.9)), 10) * 0.9 + 0.25 * (0.6 + 0.4 * Math.sin(t * 5.3));
    glint.userData.setLevel(glintLevel * tw);
    glint.material.rotation = t * 0.4;
    glintHalo.material.opacity = glintLevel * (0.25 + 0.35 * tw);
  });
  H.coat = {
    object: coat, stand, hit: coatHit, pocket: pocketHit, pocketKey, glint,
    pocketWorld,
    setGlint: (on) => { glintOn = on ? 1 : 0; },
    setKeyVisible: (b) => { pocketKey.visible = !!b; },
    focus: { position: pocketWorld.clone().add(coatFacing.clone().multiplyScalar(0.9)).add(v3(0.05, 0.12, 0)).toArray(), lookAt: pocketWorld.clone().add(v3(0, 0.1, 0)).toArray() },
  };

  // =====================================================================================================
  // THE HUTCH (north-west corner, front angled 45°)
  // =====================================================================================================
  const HF = v3(-2.275, 0, -1.975); // floor centre of the front
  const hutch = D.hutchFront({ W: 1.77, H: 2.35 });
  at(hutch, HF.x, 0, HF.z, Math.PI / 4); G.add(hutch);
  const hx = v3(Math.SQRT1_2, 0, -Math.SQRT1_2), hn = v3(Math.SQRT1_2, 0, Math.SQRT1_2); // front's local +X and +Z (out)
  const hutchAt = (lx, y, lz = 0) => HF.clone().addScaledVector(hx, lx).addScaledVector(hn, lz).setY(y);
  // side wall (x = -1.65), panelled outside, and the booth's lid with clutter on it
  const side = [boxG(0.06, 2.38, 0.6, -1.65 + 0.03 - 0.06, 1.19, -2.9)];
  side.push(boxG(0.02, 0.85, 0.42, -1.65 + 0.005, 0.5, -2.9), boxG(0.02, 0.95, 0.42, -1.65 + 0.005, 1.6, -2.9));
  G.add(merged(side, varnish));
  const lid = new THREE.Shape(); lid.moveTo(-2.9, 1.35); lid.lineTo(-1.65, 2.6); lid.lineTo(-1.65, 3.2); lid.lineTo(-2.9, 3.2); lid.closePath();
  G.add(mesh(new THREE.ExtrudeGeometry(lid, { depth: 0.04, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, 2.36, 0), darkMat));
  const hatbox = mesh(cylG(0.17, 0.17, 0.2, 24, 0, 0.1, 0), M.matte('#6a5a4a', { roughness: 0.9 })); at(hatbox, -2.55, 2.4, -2.55); G.add(hatbox);
  const crate = T.crate({ w: 0.48, h: 0.3, d: 0.36, stencil: 'EMPRESS\nPROPS', seed: 4 }); at(crate, -2.2, 2.4, -2.95, 0.3); G.add(crate);
  G.add(at(merged([cylG(0.04, 0.04, 0.7, 12).rotateZ(Math.PI / 2 - 0.12).translate(0, 0.05, 0), cylG(0.035, 0.035, 0.62, 12).rotateZ(Math.PI / 2 + 0.05).translate(0.02, 0.12, 0.06)], M.matte('#d8c8a0', { roughness: 0.95 })), -2.45, 2.42, -2.1, 0.8));

  // inside the booth: the desk along the west wall, a stool, the key press on the back (north) wall
  const deskX0 = -2.9, deskX1 = -2.44, deskZ0 = -1.86, deskZ1 = -3.16, deskTop = 0.78;
  const dz = (deskZ0 + deskZ1) / 2, dl = deskZ0 - deskZ1;
  const desk = [boxG(deskX1 - deskX0 + 0.02, 0.035, dl, (deskX0 + deskX1) / 2 + 0.01, deskTop - 0.0175, dz)];
  desk.push(boxG(0.03, deskTop - 0.035, dl - 0.04, deskX1 - 0.03, (deskTop - 0.035) / 2, dz)); // modesty board
  desk.push(boxG(deskX1 - deskX0 - 0.04, deskTop - 0.035, 0.03, (deskX0 + deskX1) / 2, (deskTop - 0.035) / 2, deskZ0 - 0.02));
  desk.push(boxG(deskX1 - deskX0 - 0.04, 0.03, dl, (deskX0 + deskX1) / 2, 0.2, dz)); // shelf under
  G.add(merged(desk, varnish));
  G.add(merged([boxG(0.012, 0.11, 0.38, deskX1 + 0.01, deskTop - 0.1, dz + 0.2), boxG(0.012, 0.11, 0.38, deskX1 + 0.01, deskTop - 0.1, dz - 0.25)], darkMat));
  G.add(merged([cylG(0.012, 0.012, 0.03, 8).rotateZ(Math.PI / 2).translate(deskX1 + 0.03, deskTop - 0.1, dz + 0.2), cylG(0.012, 0.012, 0.03, 8).rotateZ(Math.PI / 2).translate(deskX1 + 0.03, deskTop - 0.1, dz - 0.25)], M.brass()));
  const stool = T.bentwoodChair({ tint: '#3a2212' }); at(stool, -2.28, 0, -2.62, -1.2); G.add(stool);
  // desk dressing: a blotter, a mug with a pencil, biscuit tin, a newspaper pile under the desk
  G.add(at(mesh(boxG(0.34, 0.006, 0.46, 0, 0.003, 0), M.leather('#2a3a2c'), { cast: false }), -2.68, deskTop, -2.42, 0.06));
  const mug = merged([D.latheG([[0.001, 0], [0.038, 0], [0.04, 0.09], [0.036, 0.09], [0.034, 0.006], [0.001, 0.006]], 16), new THREE.TorusGeometry(0.022, 0.006, 6, 10).translate(0.044, 0.05, 0)], M.porcelain('#e8e0c8'));
  G.add(at(mug, -2.82, deskTop, -2.78, 1.2));
  G.add(at(mesh(cylG(0.004, 0.004, 0.16, 6).rotateZ(0.25).translate(0, 0.1, 0), M.matte('#c8a020'), { cast: false }), -2.82, deskTop, -2.78));
  const bisc = T.tin({ label: 'PEEK FREAN', r: 0.07, h: 0.09, color: '#1f3d6a', seed: 9 }); at(bisc, -2.6, deskTop, -3.02, 0.4); G.add(bisc);
  const pile = D.paperPile(7, 4); at(pile, -2.66, 0.215, -2.6, 1.57); G.add(pile);
  // the TEA FUND tin, on the desk beside the lamp, in sight from the open half-door (PUZZLES-door moved it from the
  // front corner under the window, where the hutch front hid it from every view)
  const tin = T.tin({ label: 'TEA FUND', r: 0.058, h: 0.13, color: '#7a1a1c', seed: 3 });
  const TIN = v3(-2.54, deskTop, -2.7);
  at(tin, TIN.x, deskTop, TIN.z, 0.8); G.add(keep(tin));
  const tinShilling = mesh(new THREE.CylinderGeometry(0.0118, 0.0118, 0.002, 18), M.iron({ color: '#b8b4a8', roughness: 0.3 }), { cast: false });
  tinShilling.position.set(0.01, 0.012, 0.01); tin.add(tinShilling);
  const tinSlip = mesh(new THREE.CircleGeometry(0.05, 18).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: slipTexture(['Owing:', 'Mr Pike 2d'], 91, { size: 52 }), roughness: 0.9, side: THREE.DoubleSide }), { cast: false });
  tinSlip.position.y = -0.012; tin.userData.lid.add(tinSlip);
  const tinHit = proxy(0.16, 0.2, 0.16); tinHit.position.set(0, 0.08, 0); tin.add(tinHit);
  let tinOpen = 0, tinTarget = 0;
  fx.push((dt) => { if (Math.abs(tinOpen - tinTarget) > 0.001) { tinOpen += (tinTarget - tinOpen) * Math.min(1, dt * 6); const L = tin.userData.lid; L.position.set(0.06 * tinOpen, 0.13 + 0.03 * Math.sin(tinOpen * Math.PI) - 0.005 * tinOpen, 0.02 * tinOpen); L.rotation.z = -1.1 * tinOpen; } });
  H.tin = {
    object: tin, hit: tinHit, lid: tin.userData.lid, shilling: tinShilling,
    setOpen: (t) => { tinTarget = t; },
    setEmpty: (b) => { tinShilling.visible = !b; },
    focus: { position: [TIN.x + 0.36, deskTop + 0.38, TIN.z + 0.36], lookAt: [TIN.x, deskTop + 0.07, TIN.z] },
  };
  // brass desk lamp and the wireless
  const deskLamp = T.tableLamp({ style: 'brass', lit: 0 }); at(deskLamp, -2.74, deskTop, -2.62, Math.PI / 2 + 0.5); G.add(keep(deskLamp));
  G.updateMatrixWorld(true);
  const lampLight = new THREE.PointLight('#ffc27a', 0, 3.5, 2); lampLight.position.copy(deskLamp.localToWorld(deskLamp.userData.bulbPos.clone())); G.add(lampLight);
  const wl = D.wireless(); at(wl, -2.74, deskTop, -2.98, Math.PI / 2 - 0.05); G.add(keep(wl));
  const wlHit = proxy(0.24, 0.38, 0.38); wlHit.position.set(-2.74, deskTop + 0.19, -2.98); G.add(wlHit);
  H.deskLamp = { object: deskLamp, setLit: (t, instant) => { deskLamp.userData.setLit(t, instant); } };
  H.wireless = { object: wl, hit: wlHit, setOn: (v) => wl.userData.setOn(v), focus: { position: [-2.3, 1.2, -2.72], lookAt: [-2.74, 0.95, -2.98] } };
  // the small rain window over the desk (west wall), with a faint cold street beyond
  const rainWin = T.rainPane({ w: 0.45, h: 0.6, bars: [1, 2], beyond: 'street', speed: 0.3 });
  at(rainWin, ROOM.x0 - 0.0, 1.45, RAINWIN_Z, Math.PI / 2); G.add(rainWin);
  rainWin.userData.glass && noRay(rainWin.userData.glass);
  // the stock cream sash glares under the booth light at this range: a sooty, unpainted frame instead
  rainWin.traverse((o) => { if (o.isMesh && o !== rainWin.userData.glass && o.material?.color && !o.material.map) { o.material = o.material.clone(); o.material.color.set('#4a4036'); } });
  // calendar and a coat hook with Alf's muffler on the side wall (inside)
  const cal = D.calendar(); at(cal, -1.95, 1.5, ROOM.z0 + 0.006); G.add(cal);
  // the key press on the booth's back (north) wall, Alf's note taped above
  const kp = D.keyPress(); at(kp, -2.25, 1.45, ROOM.z0); G.add(keep(kp));
  const note = D.alfNote(); at(note, -2.25, 1.94, ROOM.z0 + 0.008); note.rotation.z = 0.04; G.add(note);
  const noteHit = proxy(0.22, 0.15, 0.03); noteHit.position.set(-2.25, 1.94, ROOM.z0 + 0.02); G.add(noteHit);
  const kpd = kp.userData;
  const kpHit = proxy(0.5, 0.7, 0.16); kpHit.position.set(-2.25, 1.45, ROOM.z0 + 0.08); G.add(kpHit);
  let keyTaken = false;
  H.keypress = {
    object: kp, hit: kpHit, wheels: kpd.wheels, wheelHits: kpd.wheelHits, tryButton: kpd.tryButton, tryHit: kpd.tryHit,
    glassDoor: kpd.glassDoor, hooks: kpd.hooks, passKey: kpd.passKey, cellarKey: kpd.cellarKey,
    tags: Object.fromEntries(kpd.hooks.map((h) => [h.id, h.tag])),
    setOpen: (t, instant) => kpd.setOpen(t, instant),
    pressTry: () => kpd.pressTry(),
    setKeyTaken: (b) => { keyTaken = !!b; kpd.passKey.visible = !keyTaken; },
    focus: { position: [-2.25, 1.43, -2.52], lookAt: [-2.25, 1.43, ROOM.z0] },
    focusWheels: { position: [-2.25, 1.24, -2.86], lookAt: [-2.25, 1.24, ROOM.z0] },
  };
  for (const w of kpd.wheelHits) { keep(w.up); keep(w.down); }
  keep(kpd.wheels); keep(kpd.tryButton); kpd.hooks.forEach((h) => { if (h.key) keep(h.key); keep(h.tag); });
  H.alfnote = { object: note, hit: noteHit, focus: { position: [-2.25, 1.9, -2.72], lookAt: [-2.25, 1.9, ROOM.z0] } };

  // the hutch front's live parts
  const hd = hutch.userData;
  keep(hd.door); keep(hd.sash);
  const lockHit = proxy(0.12, 0.16, 0.08); lockHit.position.set(-hd.doorW + 0.09, 0.86, 0.04); hd.door.add(lockHit);
  const doorHit = proxy(hd.doorW, 1.98, 0.08); doorHit.position.set(-hd.doorW / 2, 0.99, 0.0); hd.door.add(doorHit);
  const plateHit = proxy(0.38, 0.16, 0.05); plateHit.position.set(-hd.doorW / 2, 1.5, 0.045); hd.door.add(plateHit);
  const windowHit = proxy(0.95, 0.8, 0.06); windowHit.position.set(hd.ledgeX, 1.46, -0.03); hutch.add(windowHit);
  const doorMid = hutchAt(hd.doorX, 1.2);
  H.hutchDoor = {
    object: hd.door, hit: doorHit, lock: lockHit, plate: hd.plate, plateHit,
    lockWorld: hutch.localToWorld(hd.lockPos.clone()),
    setOpen: (t, instant) => hd.setDoorOpen(t, instant),
    focus: { position: doorMid.clone().addScaledVector(hn, 1.05).add(v3(0, 0.22, 0)).toArray(), lookAt: doorMid.clone().add(v3(0, 0.02, 0)).toArray() },
  };
  H.hutchWindow = { object: hd.sash, hit: windowHit, glass: hd.glass, focus: { position: hutchAt(hd.ledgeX, 1.5, 0.95).toArray(), lookAt: hutchAt(hd.ledgeX, 1.3, -0.4).toArray() } };
  // the sign-in book on the ledge
  const pageL = T.ledgerPageTexture({ title: 'SATURDAY 14th MARCH 1931', columns: ['NAME', 'IN', 'OUT'], widths: [0.62, 0.24, 0.14], ruled: 16, seed: 17, rows: [
    ['Miss M. Bright (Wardrobe)', '4.00'], ['Wm. Sparks (Elec.)', '5.00'], ['Miss D. Fenn (Dresser)', '5.15'], ['Miss L. Thrush', '5.30'],
    ['Mr B. Volley', '6.10'], ['Miss A. Moss', '6.15'], ['Mr R. Dane', '6.20'], ['Sig. Pozzi (Piano)', '6.30'], ['Mr H. Pike, S.M.', '3.00  (Half 6.55)'], ['', '  ❀'],
  ] });
  const pageR0 = T.ledgerPageTexture({ title: '', columns: ['NAME', 'IN', 'OUT'], widths: [0.62, 0.24, 0.14], ruled: 16, seed: 18, rows: [] });
  const pageR1 = T.ledgerPageTexture({ title: 'SATURDAY 14th MARCH 2026', columns: ['NAME', 'IN', 'OUT'], widths: [0.62, 0.24, 0.14], ruled: 16, seed: 18, rows: [['The Inspector (Borough of Pelham)', '11.14']], ink: '#1a2a5a' });
  const book = T.ledger({ w: 0.46, d: 0.32, left: pageL, right: pageR0, cover: '#3a1a14' });
  book.position.set(hd.ledgeX - 0.02, hd.ledgeY, hd.ledgeZ + 0.02); book.rotation.y = 0.08; hutch.add(keep(book));
  // a pencil on a string beside the book (Pike's rule: sign in)
  const pencil = mesh(cylG(0.004, 0.004, 0.15, 6).rotateZ(Math.PI / 2).rotateY(0.4), M.matte('#c8a020'), { cast: false });
  pencil.position.set(hd.ledgeX + 0.32, hd.ledgeY + 0.005, hd.ledgeZ + 0.06); hutch.add(pencil);
  hutch.add(mesh(T.tubeG([[hd.ledgeX + 0.39, hd.ledgeY + 0.005, hd.ledgeZ + 0.03], [hd.ledgeX + 0.43, hd.ledgeY - 0.1, hd.ledgeZ + 0.18], [hd.ledgeX + 0.42, hd.ledgeY - 0.05, 0.05]], 0.0012, { radial: 3, seg: 10 }), M.matte('#c8b890'), { cast: false }));
  const bookHit = proxy(0.5, 0.08, 0.36); bookHit.position.copy(book.position).add(v3(0, 0.03, 0)); hutch.add(bookHit);
  G.updateMatrixWorld(true);
  const bookWorld = hutch.localToWorld(book.position.clone());
  H.ledger = {
    object: book, hit: bookHit,
    setSigned: (b) => book.userData.setPages(null, b ? pageR1 : pageR0),
    focus: { position: bookWorld.clone().addScaledVector(hn, 0.42).add(v3(0, 0.5, 0)).toArray(), lookAt: bookWorld.clone().addScaledVector(hn, -0.02).toArray() },
  };
  // a brass bell on the ledge and a handwritten card propped in the window
  const bell = merged([D.latheG([[0.001, 0], [0.045, 0], [0.04, 0.012], [0.03, 0.04], [0.012, 0.05], [0.004, 0.065], [0.001, 0.07]], 18)], M.brass({ polished: true }));
  bell.position.set(hd.ledgeX - 0.38, hd.ledgeY, hd.ledgeZ + 0.06); hutch.add(bell);
  // FIXED BY qa-door: the polished bell catches the streetlamp like a glint, and the pencil on its string sits right by
  // the book; both were dead to clicks. Hit proxies here, captions in index.js.
  const bellHit = proxy(0.12, 0.1, 0.12); bellHit.position.copy(bell.position).add(v3(0, 0.04, 0)); hutch.add(bellHit);
  const pencilHit = proxy(0.18, 0.04, 0.07); pencilHit.position.copy(pencil.position); pencilHit.rotation.y = 0.4; hutch.add(pencilHit);
  H.ledgeBell = { object: keep(bell), hit: bellHit };
  H.ledgePencil = { object: keep(pencil), hit: pencilHit };
  const backSoon = T.textPlate('BACK IN\n5 MINUTES', 0.14, { style: 'card', pw: 384, ph: 256, seed: 12 });
  backSoon.position.set(hd.ledgeX + 0.28, 1.17, 0.005); backSoon.rotation.z = -0.06; hutch.add(backSoon);

  // =====================================================================================================
  // NORTH WALL (ahead): call board, pass door (+ glow, cue box), coin meter, fire bell
  // =====================================================================================================
  // ---- call board
  const board = T.callBoard({ w: 0.82, h: 0.62, title: 'CALL BOARD' });
  at(board, -1.08, 1.52, ROOM.z0); G.add(board);
  const sheet = board.userData.addPaper(callsheetTexture(), -0.02, -0.02, { w: 0.2, h: 0.253, pins: 2, curl: 0.012 });
  const slipA = board.userData.addPaper(slipTexture(['LOST: one aigrette,', 'white. — L.T.'], 101), -0.27, 0.16, { w: 0.15, h: 0.094, rot: 0.06, curl: 0.006 });
  const slipB = board.userData.addPaper(slipTexture(['Band call Monday', '10 sharp. — Pozzi'], 102, { tint: '#e9e2cf' }), 0.27, 0.17, { w: 0.15, h: 0.094, rot: -0.05, curl: 0.006 });
  const slipC = board.userData.addPaper(slipTexture(['WHO HAS MY GLUE.', '— Wardrobe'], 103, { font: FONTS.typed, ink: '#3a1810', size: 28 }), 0.27, -0.16, { w: 0.15, h: 0.094, rot: 0.09, curl: 0.006 });
  // flavour: a fire notice and a torn programme
  board.userData.addPaper(T.agedPaperTexture({ w: 300, h: 400, seed: 104, key: 'door-fire', draw: (g, w) => { g.fillStyle = '#9a1c16'; g.font = `40px ${FONTS.display}`; g.textAlign = 'center'; g.fillText('IN CASE', w / 2, 70); g.fillText('OF FIRE', w / 2, 115); g.fillStyle = '#1e1810'; g.font = `18px ${FONTS.typed}`; ['Leave by the', 'STAGE DOOR.', 'Do not stop for', 'costumes, wigs', 'or notices.', '', 'By order.'].forEach((l, i) => g.fillText(l, w / 2, 170 + i * 30)); } }), -0.28, -0.12, { w: 0.13, h: 0.173, rot: -0.04, pins: 1, curl: 0.01 });
  for (const p of [sheet, slipA, slipB, slipC]) keep(p);
  G.updateMatrixWorld(true);
  H.callboard = {
    object: board, card: sheet, slips: { aigrette: slipA, band: slipB, glue: slipC },
    focus: { position: [-1.08, 1.52, -2.42], lookAt: [-1.08, 1.52, ROOM.z0] },
  };

  // ---- pass door (green, iron-bound), the lilac glow beneath, a dark passage beyond
  const pass = T.theatreDoor({ style: 'iron', w: 0.95, h: 2.1 });
  // drop the prop's flat black "beyond" plane: a real recess sits behind instead, so the leaf can swing into it
  const beyond = pass.children.find((c) => c.isMesh && c.material?.color?.getHexString?.() === '050404');
  if (beyond) pass.remove(beyond);
  at(pass, PASS_X, 0, ROOM.z0); G.add(pass);
  const leaf = pass.userData.leaves[0]; keep(leaf);
  leaf.position.y = 0.028; // a gap under the door for the glow
  // brass plates: name high, Pike's rule at eye level (both on the leaf, so they swing with it)
  const plateTex = (lines, w, h, seed) => canvasTex(w, h, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d6b05a'); gr.addColorStop(0.5, '#b8913e'); gr.addColorStop(1, '#7a5a22');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    T.grime(g, w, h, { seed, color: '#3a3018', octaves: [[4, 0.16], [16, 0.08]] });
    g.strokeStyle = 'rgba(50,34,8,0.7)'; g.lineWidth = 5; g.strokeRect(10, 10, w - 20, h - 20);
    for (const x of [26, w - 26]) { g.fillStyle = '#3a2a10'; g.beginPath(); g.arc(x, h / 2, 8, 0, TAU); g.fill(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([txt, size, font], i) => {
      g.font = `${size}px ${font}`;
      const y = h / 2 + (i - (lines.length - 1) / 2) * size * 1.25;
      g.fillStyle = 'rgba(255,240,200,0.45)'; g.fillText(txt, w / 2 + 1.5, y + 1.5);
      g.fillStyle = '#24180a'; g.fillText(txt, w / 2, y);
    });
  });
  const lw = 0.95, lcx = lw / 2;
  const namePlate = mesh(new THREE.PlaneGeometry(0.38, 0.13), new THREE.MeshStandardMaterial({ map: plateTex([['PASS DOOR — STAGE', 44, FONTS.fell], ['KEEP SHUT', 40, FONTS.fell]], 768, 260, 3), metalness: 0.45, roughness: 0.45 }), { cast: false });
  namePlate.position.set(lcx, 1.86, 0.029); leaf.add(namePlate);
  const rulePlate = mesh(new THREE.PlaneGeometry(0.46, 0.131), new THREE.MeshStandardMaterial({ map: plateTex([['NOBODY PASSES TO THE STAGE', 40, FONTS.fell], ['WITHOUT SIGNING IN.', 40, FONTS.fell], ['— H. PIKE, S.M.', 30, FONTS.fell]], 840, 240, 4), metalness: 0.45, roughness: 0.45 }), { cast: false });
  rulePlate.position.set(lcx, 1.52, 0.029); leaf.add(rulePlate);
  // the lock: an escutcheon under the knob, and the PASS DOOR key that sits in it once used
  const knobX = pass.userData.handle.x;
  leaf.add(merged([boxG(0.05, 0.13, 0.006, knobX, 0.86, 0.028), cylG(0.006, 0.006, 0.004, 10).rotateX(Math.PI / 2).translate(knobX, 0.875, 0.032)], M.tarnishedBrass({ amount: 0.4 })));
  leaf.add(mesh(mergeKeyhole(knobX, 0.86, 0.0325), M.matte('#060504'), { cast: false }));
  const lockKey = T.key({ style: 'mortice', metal: 'iron', len: 0.085 });
  lockKey.rotation.set(0, -Math.PI / 2, 0); lockKey.position.set(knobX, 0.862, 0.12); lockKey.visible = false; leaf.add(keep(lockKey));
  const lockTag = T.cardTag({ text: 'PASS DOOR', w: 0.06, seed: 20 }); lockTag.position.set(0, 0, 0.0); lockTag.rotation.set(0, Math.PI / 2, 0); lockKey.add(lockTag);
  const passLockHit = proxy(0.12, 0.18, 0.1); passLockHit.position.set(knobX, 0.88, 0.05); leaf.add(passLockHit);
  const passHit = proxy(0.95, 2.1, 0.1); passHit.position.set(lcx, 1.05, 0.0); leaf.add(passHit);
  const openingHit = proxy(0.95, 2.1, 0.04); openingHit.position.set(0, 1.05, -0.08); pass.add(openingHit); // the doorway, once open
  const rulePlateHit = proxy(0.44, 0.36, 0.05); rulePlateHit.position.set(lcx, 1.68, 0.04); leaf.add(rulePlateHit);
  // the passage beyond: a dark recess, a step down, a faint floor
  const recess = mesh(new THREE.BoxGeometry(1.3, 2.4, 1.8).translate(PASS_X, 1.2, ROOM.z0 - 0.9), new THREE.MeshStandardMaterial({ color: '#0b0908', roughness: 1, side: THREE.BackSide }), { cast: false });
  G.add(recess);
  // the glow: a strip in the gap, a soft spill fan on the floor, a halo on the lino
  const glowStrip = noRay(mesh(new THREE.PlaneGeometry(0.93, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(LILAC).multiplyScalar(2.4), toneMapped: false, transparent: true, opacity: 1 }), { cast: false, receive: false }));
  glowStrip.position.set(PASS_X, 0.016, ROOM.z0 - 0.005); glowStrip.renderOrder = 3; G.add(glowStrip);
  const glowFan = D.glowDecal(1.25, 0.95, LILAC, 0.55, { shape: 'fan' });
  glowFan.rotation.x = -Math.PI / 2; glowFan.position.set(PASS_X, 0.004, ROOM.z0 + 0.47); G.add(glowFan);
  const glowSoft = D.glowDecal(2.0, 1.4, LILAC, 0.16); glowSoft.rotation.x = -Math.PI / 2; glowSoft.position.set(PASS_X, 0.005, ROOM.z0 + 0.5); G.add(glowSoft);
  const glowHit = proxy(0.95, 0.12, 0.35); glowHit.position.set(PASS_X, 0.06, ROOM.z0 + 0.18); G.add(glowHit);
  let glowLevel = 1, glowTarget = 1;
  fx.push((dt, t) => {
    glowLevel += (glowTarget - glowLevel) * Math.min(1, dt * 1.5);
    const breath = 0.78 + 0.22 * Math.sin(t * TAU * 0.2);
    const k = glowLevel * breath;
    glowStrip.material.opacity = Math.min(1, k * 1.1);
    glowFan.userData.setOpacity(0.55 * k);
    glowSoft.userData.setOpacity(0.16 * k);
    glowLight.intensity = 0.6 * k;
  });
  H.glow = { strip: glowStrip, hit: glowHit, light: glowLight, setLevel: (v, instant) => { glowTarget = v; if (instant) glowLevel = v; }, position: v3(PASS_X, 0.1, ROOM.z0 + 0.15) };
  let passOpen = 0, passTarget = 0;
  fx.push((dt) => { if (Math.abs(passOpen - passTarget) > 0.0005) { passOpen += (passTarget - passOpen) * Math.min(1, dt * 1.6); pass.userData.setOpen(passOpen); } });
  H.passDoor = {
    object: leaf, door: pass, hit: passHit, lock: passLockHit, key: lockKey, namePlate, rulePlate, rulePlateHit,
    setOpen: (t, instant) => { passTarget = t; if (instant) { passOpen = t; pass.userData.setOpen(t); } },
    setKey: (b) => { lockKey.visible = !!b; },
    focus: { position: [PASS_X + 0.1, 1.45, -2.05], lookAt: [PASS_X + 0.08, 1.33, ROOM.z0] },
  };
  // cue-light box above the pass door
  const cue = T.cueLightBox({ state: 'off' }); at(cue, PASS_X, 2.42, ROOM.z0); G.add(keep(cue));
  H.cueBox = { object: cue, setState: (s, instant) => cue.userData.setState(s, instant) };
  G.add(T.pipeRun([[PASS_X + 0.16, 2.42, ROOM.z0 + 0.02], [PASS_X + 0.16, 3.08, ROOM.z0 + 0.02]], { r: 0.01, color: '#2a2622', brackets: true }));

  // ---- coin meter (right of the pass door)
  const meter = D.shillingMeter(); at(meter, 1.18, 1.36, ROOM.z0); G.add(keep(meter));
  const md = meter.userData;
  keep(md.handle); keep(md.coin); keep(md.flip);
  G.add(T.pipeRun([[1.08, 1.36 + md.H / 2 + 0.05, ROOM.z0 + 0.08], [1.08, 3.08, ROOM.z0 + 0.08]], { r: 0.018, color: '#2a2826', brackets: true }));
  const meterHit = proxy(0.44, 0.66, 0.24); meterHit.position.set(1.18, 1.36, ROOM.z0 + 0.12); G.add(meterHit);
  const handleHit = proxy(0.34, 0.34, 0.08); handleHit.position.copy(md.hub).add(v3(0, 0, 0.03)); meter.add(handleHit);
  const plateHitM = proxy(0.36, 0.19, 0.04); plateHitM.position.set(0, 0.19, md.D + 0.01); meter.add(plateHitM);
  G.updateMatrixWorld(true);
  H.meter = {
    object: meter, hit: meterHit, slot: md.slotHit, handle: md.handle, handleHit, plateHit: plateHitM, coin: md.coin, flip: md.flip,
    hubWorld: meter.localToWorld(md.hub.clone()), radius: md.spoke,
    setTurn: (a) => md.setTurn(a), getTurn: () => md.getTurn(),
    setCoin: (b) => md.setCoin(b),
    setCredit: (n, instant) => md.setCredit(n, instant),
    focus: { position: [1.18, 1.4, -2.3], lookAt: [1.18, 1.36, ROOM.z0] },
  };
  // fire bell (the room's one red), a fire bucket on a hook, a playbill, a fuse box
  const bellR = D.fireBell(); at(bellR, 1.95, 2.32, ROOM.z0); G.add(bellR);
  const bucket = T.fireBucket({ hook: true }); at(bucket, 1.95, 0.55, ROOM.z0 + 0.17); G.add(bucket);
  const bill = T.texPlane(0.36, 0.54, T.posterTexture({ style: 'playbill', title: 'THE LAMP AT GULL POINT', subtitle: 'A Drama in Three Acts and a Storm', lines: ['*MISS LAVINIA THRUSH', 'as the Keeper\'s Daughter', '~with', 'Mr Bertram Volley · Miss Ada Moss', 'Mr Roland Dane'], date: 'LAST NIGHT · SATURDAY 14th MARCH 1931', torn: 0.3, seed: 12, w: 384, h: 576 }));
  bill.position.set(2.45, 1.5, ROOM.z0 + 0.006); bill.rotation.z = 0.02; G.add(bill);
  const fuse = grp('fuseBox');
  fuse.add(mesh(boxG(0.3, 0.38, 0.1, 0, 0, 0.05), M.wood({ tint: '#2e2014', seed: 66 })));
  const fl = T.textPlate('DANGER\n415 VOLTS', 0.16, { style: 'enamel', bg: '#e8dfc8', fg: '#a3201c', pw: 384, ph: 192 }); fl.position.set(0, 0.06, 0.101); fuse.add(fl);
  at(fuse, 2.55, 2.4, ROOM.z0); G.add(fuse);

  // =====================================================================================================
  // EAST WALL (right): the green room
  // =====================================================================================================
  const EW = ROOM.x1, east = (o, z, y = 0) => at(o, EW, y, z, -Math.PI / 2);
  // sink + shelf with the kettle
  const sink = D.sinkUnit(); east(sink, -2.5); G.add(sink);
  const sd = sink.userData;
  const kettle = T.kettle({ style: 'chrome', electric: true }); kettle.position.set(-0.12, sd.shelfY, 0.13); kettle.rotation.y = 0.5; sink.add(keep(kettle));
  const caddy = T.tin({ label: 'TYPHOO', r: 0.045, h: 0.12, color: '#1f3d2c', seed: 14 }); caddy.position.set(0.12, sd.shelfY, 0.1); sink.add(caddy);
  const teapot = D.teapot(); teapot.position.set(0.3, sd.shelfY, 0.12); teapot.rotation.y = -0.6; sink.add(teapot);
  for (let i = 0; i < 3; i++) { const c = T.teacup({ saucer: false, color: ['#f4efe4', '#e8e4d4', '#efe0c8'][i] }); c.position.set(-0.36 + i * 0.002, sd.shelfY + i * 0.052, 0.12); c.rotation.y = i * 0.9; sink.add(c); }
  // the kettle's cord to a brass wall socket
  sink.add(mesh(T.tubeG([[-0.12, sd.shelfY + 0.04, 0.025], [-0.2, sd.shelfY + 0.0, 0.02], [-0.3, sd.shelfY + 0.12, 0.01], [-0.32, sd.shelfY + 0.22, 0.01]], 0.005, { radial: 5, seg: 14 }), M.bakelite('#2a1a10'), { cast: false }));
  sink.add(merged([boxG(0.08, 0.08, 0.02, -0.32, sd.shelfY + 0.25, 0.01)], M.brass()));
  sink.add(D.mesh(new THREE.PlaneGeometry(0.3, 0.2), new THREE.MeshStandardMaterial({ map: slipTexture(['Wash your OWN cup.', '— Mgt.'], 105, { font: FONTS.typed, size: 26 }), roughness: 0.9 }), { cast: false }).translateX(0.18).translateY(sd.shelfY + 0.3).translateZ(0.003));
  G.updateMatrixWorld(true);
  const kettleHit = proxy(0.24, 0.3, 0.24); kettleHit.position.set(0, 0.12, 0); kettle.add(kettleHit);
  // kettle boil: steam ramps over the boil, a jiggle at the whistle
  let boil = -1, boilDur = 8;
  fx.push((dt) => {
    if (boil < 0) return;
    boil += dt;
    const k = boil < boilDur ? boil / boilDur : boil < boilDur + 3 ? 1 : Math.max(0, 1 - (boil - boilDur - 3) / 2.5);
    kettle.userData.setSteam(k);
    kettle.rotation.z = boil > boilDur * 0.7 && boil < boilDur + 3 ? Math.sin(boil * 60) * 0.006 * k : 0;
    if (boil > boilDur + 5.5) { boil = -1; kettle.userData.setSteam(0); kettle.rotation.z = 0; }
  });
  const kettleWorld = kettle.getWorldPosition(v3());
  H.kettle = {
    object: kettle, hit: kettleHit,
    setSteam: (v) => kettle.userData.setSteam(v),
    boil: (seconds = 8) => { boilDur = seconds; boil = 0; },
    boiling: () => boil >= 0,
    focus: { position: kettleWorld.clone().add(v3(-0.75, 0.2, 0.05)).toArray(), lookAt: kettleWorld.clone().add(v3(0, 0.08, 0)).toArray() },
  };
  // pigeonholes (4×3), with name labels, letters in some
  const PH_NAMES = ['THRUSH', 'PIKE', 'CRANE', 'CAT', 'BRIGHT', 'SPARKS', 'FENN', 'VOLLEY', 'MOSS', 'DANE', 'POZZI', 'HOBDAY'];
  const ph = T.pigeonholes({ cols: 4, rows: 3, cw: 0.24, ch: 0.18, d: 0.26, labels: PH_NAMES, letters: [], seed: 6 });
  east(ph, -1.25, 1.62); G.add(ph);
  // THRUSH is stuffed with fan mail: a wad of envelopes bursting out; CRANE has a cobweb; CAT a mouse (a grey lump)
  // envelopes: thin addressed boxes, standing against the backs of a few holes or lying flat; THRUSH's is a stack
  // that has slid forward over the lip. One merged mesh, one texture.
  const envTex = canvasTex(256, 168, (g, w, h) => {
    g.fillStyle = '#e6dcc4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,70,40,0.25)'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#9a3a2a'; g.fillRect(w - 52, 12, 36, 42); g.fillStyle = 'rgba(40,30,30,0.5)'; g.beginPath(); g.arc(w - 60, 34, 22, 0, TAU); g.lineWidth = 3; g.strokeStyle = 'rgba(40,30,40,0.45)'; g.stroke();
    g.strokeStyle = 'rgba(30,30,60,0.75)'; g.lineWidth = 3;
    for (let k = 0; k < 3; k++) { const y = 78 + k * 24; g.beginPath(); g.moveTo(60 + k * 10, y); for (let x = 60 + k * 10; x < 200 - k * 12; x += 8) g.lineTo(x, y + Math.sin(x * 0.4 + k) * 3); g.stroke(); }
  });
  const envG = [];
  const PH = { W: 4 * 0.24, H: 3 * 0.18, d: 0.26, cw: 0.24, ch: 0.18 };
  const slotFloor = (i) => PH.H / 2 - (i + 1) * PH.ch + 0.0075;
  const slotX = (j) => -PH.W / 2 + (j + 0.5) * PH.cw;
  const env = (x, y, z, rx, ry, rz, w = 0.15, hh = 0.095) => envG.push(new THREE.BoxGeometry(w, hh, 0.003).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z));
  // standing, leaning back against the rear board
  for (const [i, j, n] of [[0, 1, 1], [1, 0, 2], [1, 2, 1], [2, 1, 1], [2, 3, 3]])
    for (let k = 0; k < n; k++) env(slotX(j) + (R() - 0.5) * 0.04, slotFloor(i) + 0.047, 0.05 + k * 0.012, -0.22 - R() * 0.1, (R() - 0.5) * 0.15, (R() - 0.5) * 0.12);
  // THRUSH: a slithering stack, lying flat, the top ones pushed out past the front edge
  for (let k = 0; k < 11; k++) env(slotX(0) + (R() - 0.5) * 0.05, slotFloor(0) + 0.003 + k * 0.0075, 0.1 + k * 0.011 + R() * 0.02, -Math.PI / 2 + (R() - 0.5) * 0.08, 0, (R() - 0.5) * 0.5);
  ph.add(mesh(T.mergeG(envG), new THREE.MeshStandardMaterial({ map: envTex, roughness: 0.92 }), { cast: false }));
  const web = canvasTex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(230,230,220,0.55)'; g.lineWidth = 1; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(i / 8 * Math.PI / 2) * w, Math.sin(i / 8 * Math.PI / 2) * h); g.stroke(); } for (let r2 = 12; r2 < w; r2 += 14) { g.beginPath(); g.arc(0, 0, r2, 0, Math.PI / 2); g.stroke(); } }, { srgb: false });
  const webM = noRay(mesh(new THREE.PlaneGeometry(0.17, 0.13), new THREE.MeshBasicMaterial({ map: web, transparent: true, depthWrite: false, side: THREE.DoubleSide }), { cast: false, receive: false }));
  webM.position.set(0.12 + 0.025, 0.18 + 0.02, 0.2); webM.rotation.z = -Math.PI / 2; ph.add(webM);
  const mouse = mesh(new THREE.SphereGeometry(0.03, 10, 8).scale(1.6, 0.8, 1).translate(0, 0.024, 0), M.matte('#6a6258', { roughness: 1 }));
  mouse.position.set(0.36, 0.0975, 0.14); mouse.rotation.y = 0.5; ph.add(mouse); // on the floor of the top row (H/2 - ch)
  const phSlots = [];
  PH_NAMES.forEach((name, k) => {
    const i = Math.floor(k / 4), j = k % 4;
    const p = ph.userData.slotPos(i, j);
    const hit = proxy(0.22, 0.16, 0.06); hit.position.copy(p).add(v3(0, 0, 0.0)); hit.name = `pigeon.${name}`; ph.add(hit);
    phSlots.push({ name, hit, local: p });
  });
  H.pigeonholes = { object: ph, slots: phSlots, focus: { position: [2.08, 1.62, -1.25], lookAt: [EW, 1.62, -1.25] } };
  // sofa, low table with three teacups, a bentwood chair
  const sofa = T.sofa({ w: 1.75, seed: 3 }); east(sofa, 0.42); sofa.position.x = EW - 0.45; G.add(sofa);
  sofa.rotation.z = 0.0;
  const sag = mesh(new THREE.SphereGeometry(0.2, 12, 8).scale(1.4, 0.25, 1.0), M.wornVelvetGreen()); sag.position.set(0.1, 0.43, 0.08); sofa.add(sag);
  const cushion = mesh(D.boxG(0.38, 0.36, 0.12).translate(0, 0.18, 0), M.velvet({ color: '#7a3a1c' })); cushion.position.set(-0.6, 0.47, -0.2); cushion.rotation.set(-0.35, 0.25, 0.12); sofa.add(cushion);
  const sofaHit = proxy(1.75, 0.9, 0.85); sofaHit.position.set(0, 0.45, 0); sofa.add(sofaHit);
  const table = D.lowTable({ w: 0.9, d: 0.48, h: 0.42 }); at(table, 1.55, 0, 0.42, Math.PI / 2); G.add(table);
  const cups = [];
  for (const [x, z, tea] of [[-0.25, 0.08, false], [0.05, -0.1, true], [0.28, 0.1, false]]) { const c = T.teacup({ tea }); c.position.set(x, table.userData.topY, z); c.rotation.y = R() * 6; table.add(c); cups.push(c); }
  const spoon = mesh(boxG(0.1, 0.003, 0.012, 0, 0, 0), M.iron({ color: '#c8c4bc', roughness: 0.25 }), { cast: false }); spoon.position.set(0.16, table.userData.topY + 0.002, -0.12); spoon.rotation.y = 0.6; table.add(spoon);
  const ashtray = mesh(D.latheG([[0.001, 0], [0.06, 0], [0.065, 0.02], [0.05, 0.02], [0.045, 0.008], [0.001, 0.008]], 18), M.glass({ color: '#6a7a6a', opacity: 0.7 }), { cast: false }); ashtray.position.set(-0.05, table.userData.topY, 0.14); table.add(ashtray);
  const chair = T.bentwoodChair({ tint: '#3a2414' }); at(chair, 1.0, 0, 1.5, 2.3); G.add(chair);
  // three framed company photographs, the QUIET PLEASE sign, the dartboard
  const photos = [];
  const photoDefs = [
    { z: -0.08, tex: T.sepiaPhotoTexture({ subject: 'company', caption: 'Empress Company · Panto 1929', seed: 41 }), w: 0.36, h: 0.28 },
    { z: 0.43, tex: T.sepiaPhotoTexture({ subject: 'company', caption: 'Empress Company 1931', seed: 42 }), w: 0.4, h: 0.3 },
    { z: 0.92, tex: T.sepiaPhotoTexture({ subject: 'cat', caption: 'Bartholomew', seed: 43, w: 384, h: 480 }), w: 0.22, h: 0.28 },
  ];
  photoDefs.forEach((p, i) => {
    const f = T.photoFrame({ w: p.w, h: p.h, texture: p.tex, style: i === 2 ? 'gilt' : 'oak', stand: false, border: 0.024 });
    east(f, p.z, 1.66 + (i === 1 ? 0.04 : 0)); f.rotation.z = [0.03, -0.015, 0.02][i]; G.add(f);
    const hit = proxy(p.w + 0.02, p.h + 0.02, 0.05); hit.position.set(0, 0, 0.02); f.add(hit);
    photos.push({ object: f, hit });
  });
  // the 1931 photo: an aigrette dead centre (a white plume painted over the print)
  const aig = mesh(new THREE.PlaneGeometry(0.008, 0.03), M.matte('#f0e8d8'), { cast: false }); aig.position.set(0.0, 0.035, 0.012); photos[1].object.add(aig);
  H.photos = photos;
  const quiet = T.enamelSign({ text: 'QUIET PLEASE', w: 0.56, h: 0.16, seed: 7 }); east(quiet, 0.42, 2.18); G.add(quiet);
  const quietHit = proxy(0.58, 0.18, 0.04); quietHit.position.set(0, 0, 0.01); quiet.add(quietHit);
  H.quiet = { object: quiet, hit: quietHit };
  const dart = D.dartboard(); east(dart, 2.15, 1.73); G.add(keep(dart));
  const dartHit = proxy(0.5, 0.5, 0.08); dartHit.position.set(0, 0, 0.04); dart.add(dartHit);
  // chalk scores on the wall next to it
  const chalk = T.texPlane(0.3, 0.38, canvasTex(256, 320, (g, w, h) => { g.fillStyle = '#1a1a18'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7a6a50'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = 'rgba(230,228,215,0.85)'; g.font = `24px ${FONTS.hand}`; g.fillText('ALF   SPARKS', 22, 44); g.fillRect(w / 2, 56, 2, h - 80); ['301', '261', '180', '140', '121'].forEach((s, i) => g.fillText(s, 34, 90 + i * 40)); ['301', '277', '233'].forEach((s, i) => g.fillText(s, 150, 90 + i * 40)); }));
  east(chalk, 2.68, 1.62); G.add(chalk);
  H.dartboard = { object: dart, hit: dartHit, throw: () => dart.userData.throw() };
  // the wall clock on the south wall, stopped at 7.30 (curtain-up on the night)
  const clock = grp('clock');
  clock.add(mesh(cylG(0.17, 0.17, 0.05, 32).rotateX(Math.PI / 2).translate(0, 0, 0.025), M.wood({ tint: '#3a2212' })));
  const dial = T.dialTexture({ numbers: 12, style: 'enamel', size: 256 });
  const clockFace = mesh(new THREE.CircleGeometry(0.145, 32), new THREE.MeshStandardMaterial({ map: dial, roughness: 0.5 }), { cast: false }); clockFace.position.z = 0.051; clock.add(clockFace);
  const hand = (len, w, ang) => { const m = mesh(boxG(w, len, 0.003, 0, len / 2 - 0.01, 0), M.matte('#14100c'), { cast: false }); m.rotation.z = -ang; m.position.z = 0.054; return m; };
  clock.add(hand(0.09, 0.008, 7.5 / 12 * TAU), hand(0.125, 0.005, 0.5 * TAU)); // stopped at curtain-up
  at(clock, 0.6, 2.62, ROOM.z1, Math.PI); G.add(clock);
  H.clock = { object: clock };

  // =====================================================================================================
  // HANDLES that span the room
  // =====================================================================================================
  H.exit = { object: exitSign, hit: (() => { const p = proxy(0.46, 0.18, 0.14); p.position.set(0, 0, 0.06); exitSign.add(p); return p; })() };
  H.stageDoor = { object: stageDoor, leaf: sLeaf, hit: (() => { const p = proxy(1.0, 2.1, 0.12); p.position.set(0, 1.05, 0.03); stageDoor.add(p); return p; })() };
  H.sofa = { object: sofa, hit: sofaHit };
  H.doors = {
    stage: { object: stageDoor, hit: H.stageDoor.hit },
    pass: { object: pass, leaf, hit: passHit, frame: pass },
  };
  H.perches = { glow: H.glow.position.clone() }; // Lavinia is only a voice here; the glow marks her presence
  H.lights = {
    sodium: sodium.userData.light, exit: exitLight, glow: glowLight, booth: boothLight, pendants, pendantLights, desk: lampLight, hemi, ambient,
  };
  H.shaft = shaft;

  // ---- light states -------------------------------------------------------------------------------------
  const DARK = { hemi: 0.42, ambient: 0.26, sodium: 14, booth: 0.8, pendant: 0, desk: 0, shaft: 0.075 };
  const LIT = { hemi: 0.55, ambient: 0.3, sodium: 7, booth: 0.2, pendant: 5.5, desk: 1.6, shaft: 0.035 };
  let lit = 0, litTarget = 0, flick = -1;
  // flicker twice, then stay on: [time, level] steps
  const FLICK = [[0, 1], [0.09, 0.1], [0.2, 0.9], [0.27, 0.05], [0.55, 0.6], [0.62, 0.2], [0.75, 1]];
  const applyLit = (k) => {
    hemi.intensity = DARK.hemi + (LIT.hemi - DARK.hemi) * k;
    if (ambient) ambient.intensity = DARK.ambient + (LIT.ambient - DARK.ambient) * k;
    sodium.userData.light.intensity = DARK.sodium + (LIT.sodium - DARK.sodium) * Math.min(1, k);
    boothLight.intensity = DARK.booth + (LIT.booth - DARK.booth) * k;
    pendantLights.forEach((l) => { l.intensity = LIT.pendant * k; });
    pendants.forEach((p) => p.userData.setLit(k, true));
    lampLight.intensity = LIT.desk * k;
    deskLamp.userData.setLit(k, true);
    shaft.userData.setOpacity(DARK.shaft + (LIT.shaft - DARK.shaft) * k);
  };
  fx.push((dt) => {
    if (flick >= 0) {
      flick += dt;
      let k = 1; for (const [tt, v] of FLICK) if (flick >= tt) k = v;
      lit = k; applyLit(k);
      if (flick > FLICK[FLICK.length - 1][0]) flick = -1;
      return;
    }
    if (Math.abs(lit - litTarget) > 0.001) { lit += (litTarget - lit) * Math.min(1, dt * 5); applyLit(lit); }
  });
  H.lights.setLit = (on, { flicker = false, instant = false } = {}) => {
    litTarget = on ? 1 : 0;
    if (on && flicker) { flick = 0; return; }
    if (instant) { lit = litTarget; applyLit(lit); }
  };
  H.lights.isLit = () => litTarget > 0;
  applyLit(0);

  // ---- per-frame jobs: one animated node that mergeStatic leaves alone -----------------------------------
  const fxNode = new THREE.Object3D(); fxNode.name = 'door.fx';
  fxNode.userData.update = (dt, t) => { for (const f of fx) f(dt, t); };
  G.add(fxNode);

  // small meshes should not cast shadows (one shadow caster; keep the shadow pass lean)
  G.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere);
    const s = o.getWorldScale(v3()).x;
    if (p && p.radius * s < 0.12) o.castShadow = false;
  });
  floor.castShadow = false; ceil.castShadow = false;

  return H;
}

/** Keyhole geometry (a circle + a slot) at x, y, z facing +Z. */
function mergeKeyhole(x, y, z) {
  return T.mergeG([new THREE.CircleGeometry(0.006, 12).translate(x, y + 0.006, z), new THREE.PlaneGeometry(0.004, 0.014).translate(x, y - 0.002, z)]);
}

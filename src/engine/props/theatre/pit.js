// Orchestra pit and effects props (PROPS): the pianola, conductor's stand, music stands and band chairs, the double
// bass under its dust sheet, the pit rail, the storm machines (thunder sheet, wind machine, rain drum and gears,
// lightning flash box), the bass drum, the portable gramophone and the wall winch. Conventions as in stage.js.
import { THREE, M, TAU, mesh, noRay, grp, at, boxG, cylG, latheG, mergeG, mergeInto, tubeG, catenary, textPlate, bulbSet, halo, chase, instances, rng, ropeMat } from './common.js';
import { drape, dustSheet } from './cloth.js';
import { bentwoodGeometry, caneMaterial } from './backstage.js';
import { labelPlate, agedPaperTexture, FONTS, grime } from '../theatre-textures.js';
import { makeCanvas, canvasTexture } from '../textures.js';

// =====================================================================================================
// TEXTURES (pit-specific)
// =====================================================================================================

/** Pianola roll paper: cream with punched slots in note columns (tile along V). seed varies the tune. */
export function pianolaRollTexture({ seed = 103, cols = 64, w = 256, h = 1024 } = {}) {
  const c = makeCanvas(w, h), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = '#e6dcc0'; g.fillRect(0, 0, w, h);
  grime(g, w, h, { seed, color: '#a08050', octaves: [[4, 0.12], [20, 0.06]] });
  g.fillStyle = '#2a2018';
  const cw = (w - 20) / cols;
  for (let k = 0; k < 140; k++) {
    const col = Math.floor(cols * (0.2 + 0.6 * r())), y = r() * h, len = 6 + r() * 40;
    g.fillRect(10 + col * cw, y, Math.max(1.5, cw * 0.6), len);
    if (r() < 0.5) g.fillRect(10 + (col + 4 + Math.floor(r() * 4)) * cw, y, Math.max(1.5, cw * 0.6), len * 0.8);
  }
  g.fillStyle = 'rgba(90,60,30,0.5)'; g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h);
  const t = canvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * The wind machine's painted speed dial: six bands over a 240° arc (bands: [{ name, from, to }], fractions 0..1 of
 * the arc), chalk circle round one band and a chalk arrow off to the right edge (chalk: band name or null).
 */
export const WIND_BANDS = [
  { name: 'CALM', from: 0, to: 30 / 240, color: '#d8d0b0' }, { name: 'BREEZE', from: 30 / 240, to: 65 / 240, color: '#b8c8a0' },
  { name: 'BLOW', from: 65 / 240, to: 105 / 240, color: '#d8c070' }, { name: 'GALE', from: 105 / 240, to: 150 / 240, color: '#d89040' },
  { name: 'STORM', from: 150 / 240, to: 195 / 240, color: '#c05030' }, { name: 'DO NOT', from: 195 / 240, to: 1, color: '#7a1a18' },
];
const DIAL_SWEEP = (240 / 360) * TAU, DIAL_START = -DIAL_SWEEP / 2; // needle angle measured from straight up, clockwise
export function windDialTexture({ chalk = 'GALE', size = 512 } = {}) {
  const c = makeCanvas(size, size), g = c.getContext('2d'), cx = size / 2, cy = size / 2, R = size * 0.46;
  g.fillStyle = '#efe6cc'; g.beginPath(); g.arc(cx, cy, R + 8, 0, TAU); g.fill();
  const ang = (f) => DIAL_START + f * DIAL_SWEEP - Math.PI / 2; // canvas angle (0 = +x, clockwise)
  for (const b of WIND_BANDS) {
    g.fillStyle = b.color; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, ang(b.from), ang(b.to)); g.closePath(); g.fill();
    g.strokeStyle = '#2a1c10'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ang(b.from)) * R, cy + Math.sin(ang(b.from)) * R); g.stroke();
  }
  g.fillStyle = '#efe6cc'; g.beginPath(); g.arc(cx, cy, R * 0.52, 0, TAU); g.fill();
  g.strokeStyle = '#2a1c10'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R, ang(0), ang(1)); g.stroke();
  g.fillStyle = '#1e140c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const b of WIND_BANDS) {
    const a = ang((b.from + b.to) / 2), rr = R * 0.76;
    g.save(); g.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); g.rotate(a + Math.PI / 2);
    g.font = `${b.name.length > 5 ? 26 : 32}px ${FONTS.display}`; g.fillStyle = b.name === 'DO NOT' ? '#f0e0c0' : '#1e140c'; g.fillText(b.name, 0, 0); g.restore();
  }
  g.font = `30px ${FONTS.fell}`; g.fillStyle = '#3a2a1a'; g.fillText('WIND', cx, cy + R * 0.3);
  if (chalk) {
    const b = WIND_BANDS.find((x) => x.name === chalk);
    if (b) {
      const a = ang((b.from + b.to) / 2), rr = R * 0.76, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      g.strokeStyle = 'rgba(250,250,245,0.85)'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.ellipse(x, y, 62, 34, a + Math.PI / 2, 0.2, TAU + 0.1); g.stroke();
      g.beginPath(); g.moveTo(x + 50, y + 30); g.quadraticCurveTo(size * 0.86, cy + 30, size * 0.97, cy + 110); g.stroke();
      g.beginPath(); g.moveTo(size * 0.97, cy + 110); g.lineTo(size * 0.93, cy + 80); g.moveTo(size * 0.97, cy + 110); g.lineTo(size * 0.92, cy + 112); g.stroke();
    }
  }
  return canvasTexture(c);
}
/** Needle angle (rad, about +Z, 0 = up) for a dial value 0..1. */
export const windDialAngle = (v) => -(DIAL_START + THREE.MathUtils.clamp(v, 0, 1) * DIAL_SWEEP);

// =====================================================================================================
// PIANOLA
// =====================================================================================================

const BLACK_AFTER = new Set([0, 2, 3, 5, 6]); // white-key letters (A=0 … G=6) that have a black key to their right
/**
 * Upright player piano (pianola): walnut case with a hinged lid, a fold-down upper front panel over the spool box
 * (roll, take-up spool, brass tracker bar), music desk ledge, fallboard, 52 white + 36 black keys (two
 * InstancedMeshes; each key can be depressed), toe blocks, pedals, and a pin block under the lid.
 * Origin: floor centre; the player sits at +Z. W 1.52 × H 1.32 × D 0.66.
 * userData: { lid (pivot at the back: rotation.x negative opens), front (pivot at its bottom edge: rotation.x positive
 * folds it down toward the player), fallboard (rotation.x), setKey(n 0..87, depth 0..1), setPlaying(bool), roll (paper
 * mesh), rollTex, trackerBar, spoolBox (Vector3 local, the roll seat), interior (Vector3, inside the top), lidTopY }.
 * Cost: ~11 draw calls.
 */
export function playerPiano({ lidOpen = 0, frontOpen = 0, fallboardOpen = 1 } = {}) {
  const g = grp('playerPiano');
  const W = 1.52, H = 1.32, D = 0.66, keyY = 0.72, caseZ0 = -D / 2, caseZ1 = 0.12;
  const wood = M.walnut({ tint: '#3e2414' });
  const cd = caseZ1 - caseZ0, cz = (caseZ0 + caseZ1) / 2;
  const c = [
    boxG(0.05, H - 0.02, cd, -W / 2 + 0.025, (H - 0.02) / 2, cz, 0.008), boxG(0.05, H - 0.02, cd, W / 2 - 0.025, (H - 0.02) / 2, cz, 0.008), // sides
    boxG(W - 0.1, H - 0.05, 0.03, 0, (H - 0.05) / 2, caseZ0 + 0.015, 0.004), // back
    boxG(W - 0.1, 0.6, 0.025, 0, 0.36, 0.11, 0.006), // knee board
    boxG(W - 0.08, 0.05, 0.03, 0, 0.04, 0.115, 0.008), // plinth
    boxG(W - 0.12, 0.045, 0.24, 0, keyY - 0.04, 0.2, 0.004), // keybed
    boxG(W - 0.1, 0.05, 0.022, 0, keyY - 0.03, 0.33, 0.006), // key slip
    boxG(W - 0.1, 0.05, 0.06, 0, 0.83, 0.13, 0.008), // name board rail behind the keys
  ];
  for (const s of [-1, 1]) {
    c.push(boxG(0.07, 0.22, 0.22, s * (W / 2 - 0.035), keyY + 0.02, 0.21, 0.012)); // key cheeks
    c.push(boxG(0.06, 0.06, 0.22, s * (W / 2 - 0.08), 0.03, 0.22, 0.01)); // toe blocks
    c.push(latheG([[0.001, 0], [0.03, 0], [0.034, 0.05], [0.022, 0.12], [0.03, 0.4], [0.035, 0.6], [0.001, 0.6]], 12).translate(s * (W / 2 - 0.08), 0.06, 0.29)); // turned columns
  }
  g.add(mergeInto(c, wood));
  // lid (hinged at the back edge)
  const lid = grp('lid'); lid.position.set(0, H, caseZ0);
  lid.add(mergeInto([boxG(W, 0.025, cd + 0.03, 0, 0.0125, cd / 2 + 0.01, 0.008)], wood));
  g.add(lid);
  // upper front panel (hinged at its bottom edge, folds down toward the player) with a music desk ledge
  const front = grp('front'); front.position.set(0, 0.86, caseZ1 + 0.012);
  front.add(mergeInto([boxG(W - 0.1, H - 0.9, 0.025, 0, (H - 0.9) / 2, 0, 0.008), boxG(W * 0.5, 0.03, 0.05, 0, 0.12, 0.03, 0.006), boxG(W * 0.62, H - 1.02, 0.008, 0, (H - 0.9) / 2 + 0.02, 0.014, 0.004)], wood));
  g.add(front);
  // spool box interior: dark recess, the roll and take-up spools, paper between, brass tracker bar
  const boxY0 = 0.88, boxY1 = H - 0.05, rollW = 0.29;
  g.add(mesh(mergeG([boxG(W - 0.12, boxY1 - boxY0, 0.01, 0, (boxY0 + boxY1) / 2, caseZ0 + 0.24, 0.002), boxG(W - 0.12, 0.012, 0.16, 0, boxY0, caseZ0 + 0.32, 0.002)]), M.matte('#1c120c', { roughness: 0.9 })));
  const rollTex = pianolaRollTexture();
  rollTex.repeat.set(1, 0.6);
  const paperMat = new THREE.MeshStandardMaterial({ map: rollTex, roughness: 0.85, side: THREE.DoubleSide });
  const spoolZ = caseZ0 + 0.3, topSpoolY = 1.17, botSpoolY = 0.95;
  const rollMesh = mesh(cylG(0.04, 0.04, rollW, 24).rotateZ(Math.PI / 2), paperMat); rollMesh.position.set(0, topSpoolY, spoolZ); g.add(rollMesh);
  const sheet = mesh(new THREE.PlaneGeometry(rollW, topSpoolY - botSpoolY), paperMat, { cast: false }); sheet.position.set(0, (topSpoolY + botSpoolY) / 2, spoolZ + 0.04); g.add(sheet);
  const hw = [cylG(0.028, 0.028, rollW + 0.04, 16).rotateZ(Math.PI / 2).translate(0, botSpoolY, spoolZ), boxG(rollW + 0.12, 0.025, 0.02, 0, 1.04, spoolZ + 0.05, 0.004)];
  for (const s of [-1, 1]) hw.push(cylG(0.045, 0.045, 0.008, 18).rotateZ(Math.PI / 2).translate(s * (rollW / 2 + 0.006), topSpoolY, spoolZ), cylG(0.034, 0.034, 0.008, 16).rotateZ(Math.PI / 2).translate(s * (rollW / 2 + 0.024), botSpoolY, spoolZ));
  // pedals
  for (const s of [-1, 0, 1]) hw.push(boxG(0.05, 0.012, 0.11, s * 0.1, 0.07, 0.17, 0.004));
  const tracker = mergeInto(hw, M.tarnishedBrass({ amount: 0.2 }));
  g.add(tracker);
  // pin block + strings under the lid (seen when it is open)
  const pc = makeCanvas(512, 128), pg = pc.getContext('2d');
  pg.fillStyle = '#5a3a1c'; pg.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 88; i++) { const x = 8 + i * 5.7; pg.fillStyle = '#c8c4b8'; pg.fillRect(x, 20, 3, 3); pg.fillRect(x + 2, 40, 3, 3); pg.strokeStyle = 'rgba(210,205,190,0.6)'; pg.beginPath(); pg.moveTo(x + 1, 24); pg.lineTo(x + 1, 128); pg.stroke(); }
  const pinBlock = mesh(new THREE.PlaneGeometry(W - 0.12, 0.2), new THREE.MeshStandardMaterial({ map: canvasTexture(pc), roughness: 0.6 }), { cast: false });
  pinBlock.rotation.x = -Math.PI / 2 + 0.25; pinBlock.position.set(0, H - 0.06, caseZ0 + 0.14); g.add(pinBlock);
  // keys
  const whites = [], blacks = [], map = []; // map[n] = [isBlack, index]
  const kw = 0.0235, x0 = -52 * kw / 2 + kw / 2;
  for (let i = 0; i < 52; i++) {
    whites.push({ p: [x0 + i * kw, keyY + 0.012, 0.25] });
    map.push([0, i]);
    if (BLACK_AFTER.has(i % 7) && i < 51) { blacks.push({ p: [x0 + (i + 0.5) * kw, keyY + 0.028, 0.218] }); map.push([1, blacks.length - 1]); }
  }
  const wk = instances(boxG(kw - 0.0012, 0.022, 0.15, 0, 0, 0, 0.002), M.porcelain('#ece2c8'), whites, { cast: false });
  const bk = instances(boxG(0.012, 0.014, 0.088, 0, 0, 0, 0.002), M.bakelite('#16100c'), blacks, { cast: false });
  wk.name = 'whiteKeys'; bk.name = 'blackKeys';
  g.add(wk, bk);
  // fallboard: hinged at the back of the keys; 1 = open (stowed upright), 0 = closed over the keys
  const fall = grp('fallboard'); fall.position.set(0, keyY + 0.045, 0.165);
  fall.add(mergeInto([boxG(W - 0.16, 0.02, 0.17, 0, 0, 0.085, 0.006)], wood));
  g.add(fall);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const depth = new Float32Array(88);
  const setKey = (n, d) => {
    const ent = map[n]; if (!ent) return;
    depth[n] = d;
    const [isB, i] = ent, it = (isB ? blacks : whites)[i], im = isB ? bk : wk;
    const a = d * 0.06;
    m4.compose(v3.set(it.p[0], it.p[1] - d * 0.008, it.p[2]), q.setFromEuler(e.set(a, 0, 0)), one);
    im.setMatrixAt(i, m4); im.instanceMatrix.needsUpdate = true;
  };
  let playing = false, acc = 0, rollV = 0;
  const r = rng(7);
  g.userData.update = (dt) => {
    if (!playing && rollV < 0.001) return;
    rollV = chase(rollV, playing ? 1 : 0, dt, 4);
    rollTex.offset.y -= dt * 0.12 * rollV;
    rollMesh.rotation.x -= dt * 2.5 * rollV;
    acc += dt;
    if (acc > 0.11) {
      acc = 0;
      for (let n = 0; n < 88; n++) if (depth[n] > 0) setKey(n, 0);
      if (playing) { const root = 30 + Math.floor(r() * 24); for (const k of [0, 4, 7]) if (r() < 0.75) setKey(root + k, 1); if (r() < 0.5) setKey(root - 12, 1); }
    }
  };
  g.userData.setPlaying = (on) => { playing = !!on; };
  g.userData.setKey = setKey;
  g.userData.setLid = (t) => { lid.rotation.x = -1.2 * t; };
  g.userData.setFront = (t) => { front.rotation.x = 1.45 * t; };
  g.userData.setFallboard = (t) => { fall.rotation.x = -1.45 * t; };
  g.userData.setLid(lidOpen); g.userData.setFront(frontOpen); g.userData.setFallboard(fallboardOpen);
  g.userData.lid = lid; g.userData.front = front; g.userData.fallboard = fall;
  g.userData.roll = rollMesh; g.userData.rollSheet = sheet; g.userData.rollTex = rollTex; g.userData.trackerBar = tracker;
  g.userData.whiteKeys = wk; g.userData.blackKeys = bk;
  g.userData.spoolBox = new THREE.Vector3(0, topSpoolY, spoolZ);
  g.userData.interior = new THREE.Vector3(0, H - 0.05, caseZ0 + 0.14);
  g.userData.lidTopY = H + 0.025;
  return g;
}

// =====================================================================================================
// CONDUCTOR'S STAND, MUSIC STANDS, BAND CHAIRS
// =====================================================================================================

/**
 * Conductor's stand: a low podium, a heavy sloped desk on a pedestal, a green-shaded lamp clipped to the desk, an open
 * score and a baton on the ledge. Origin: floor centre of the podium; the desk is at the podium's -Z end and faces +Z
 * (the conductor stands on the podium facing -Z, toward the band). userData: { setLit(0..1), baton, score
 * (group: two page planes), setScore(texL, texR), deskTop (Object3D on the desk surface) }. Cost: 7 draw calls.
 */
export function conductorStand({ lamp = true, baton = true, lit = 0 } = {}) {
  const g = grp('conductorStand');
  const wood = M.walnut({ tint: '#3a2416' });
  const parts = [boxG(0.9, 0.18, 0.75, 0, 0.09, 0, 0.012)]; // podium
  // ENGINE-FIX: the pedestal's top poked through the middle of the score (the pit lifted its desk 0.05 locally). The desk
  // now sits at 1.20 (as the pit had it) and the pedestal stops at 1.10, inside the board's thickness, behind the score.
  parts.push(boxG(0.09, 0.92, 0.09, 0, 0.18 + 0.46, -0.28, 0.01), boxG(0.5, 0.05, 0.12, 0, 0.205, -0.28, 0.01), boxG(0.12, 0.05, 0.16, 0, 0.205, -0.28, 0.01));
  g.add(mergeInto(parts, wood));
  const desk = grp('desk'); desk.position.set(0, 1.2, -0.28); desk.rotation.x = -0.45; g.add(desk);
  desk.add(mergeInto([boxG(0.62, 0.45, 0.025, 0, 0, 0, 0.006), boxG(0.62, 0.04, 0.05, 0, -0.225, 0.03, 0.006)], wood));
  // score: an open book
  const score = grp('score'); score.position.set(0, 0.0, 0.015); desk.add(score);
  const pageL = mesh(new THREE.PlaneGeometry(0.24, 0.32).translate(-0.12, 0, 0), new THREE.MeshStandardMaterial({ map: agedPaperTexture({ seed: 41, age: 0.4 }), roughness: 0.9 }), { cast: false });
  const pageR = mesh(new THREE.PlaneGeometry(0.24, 0.32).translate(0.12, 0, 0), new THREE.MeshStandardMaterial({ map: agedPaperTexture({ seed: 42, age: 0.4 }), roughness: 0.9 }), { cast: false });
  pageL.rotation.y = 0.12; pageR.rotation.y = -0.12; score.add(pageL, pageR);
  const deskTop = new THREE.Object3D(); deskTop.position.set(0, 0, 0.02); desk.add(deskTop);
  let bm = null;
  if (baton) { bm = mergeInto([cylG(0.0025, 0.0045, 0.36, 8).rotateZ(Math.PI / 2), latheG([[0.001, 0], [0.008, 0.005], [0.01, 0.04], [0.006, 0.06], [0.001, 0.062]], 10).rotateZ(Math.PI / 2).translate(0.17, 0, 0)], M.matte('#ece6d6', { roughness: 0.5 })); bm.position.set(0.05, -0.205, 0.05); desk.add(bm); }
  let setLit = () => {};
  if (lamp) {
    const L = grp('lamp'); L.position.set(0.24, 0.24, 0.0); desk.add(L);
    L.add(mergeInto([cylG(0.006, 0.006, 0.18, 8, 0, 0.09, 0), tubeG([[0, 0.18, 0], [0, 0.22, 0.04], [0, 0.22, 0.1]], 0.006, { radial: 6 }), boxG(0.03, 0.03, 0.02, 0, 0.0, 0.0, 0.004)], M.brass()));
    const shadeMat = new THREE.MeshPhysicalMaterial({ color: '#103a22', roughness: 0.2, clearcoat: 1, emissive: '#1e6a3a', emissiveIntensity: 0, side: THREE.DoubleSide });
    L.add(at(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 20, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), shadeMat), 0, 0.22, 0.12, -0.6, 0, 0));
    const bs = bulbSet([[0, 0.2, 0.12]], { r: 0.016, color: '#ffe0a8', intensity: 2.2, lit: 0, shape: 'round' }); L.add(bs);
    setLit = (v) => { bs.userData.setAll(v); shadeMat.emissiveIntensity = 0.22 * v; };
  }
  setLit(lit);
  g.userData.setLit = setLit;
  g.userData.baton = bm; g.userData.score = score; g.userData.deskTop = deskTop; g.userData.desk = desk;
  g.userData.setScore = (l, r) => { if (l) { pageL.material.map = l; pageL.material.needsUpdate = true; } if (r) { pageR.material.map = r; pageR.material.needsUpdate = true; } };
  return g;
}

let standGeo = null;
/** Folding iron music stand geometry (origin floor centre, desk faces +Z). */
export function musicStandGeometry() {
  if (standGeo) return standGeo;
  const p = [cylG(0.008, 0.008, 0.78, 8, 0, 0.62, 0), cylG(0.012, 0.012, 0.12, 8, 0, 0.3, 0)];
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + Math.PI / 2; p.push(tubeG([[0, 0.3, 0], [Math.cos(a) * 0.12, 0.12, Math.sin(a) * 0.12], [Math.cos(a) * 0.24, 0.0, Math.sin(a) * 0.24]], 0.006, { radial: 5, seg: 6 })); }
  const desk = [boxG(0.5, 0.012, 0.012, 0, 0.17, 0, 0.002), boxG(0.5, 0.012, 0.012, 0, -0.17, 0, 0.002), boxG(0.5, 0.012, 0.05, 0, -0.18, 0.02, 0.002)];
  for (let i = 0; i < 5; i++) desk.push(boxG(0.01, 0.34, 0.006, -0.24 + i * 0.12, 0, 0, 0.001));
  for (const d of desk) p.push(d.rotateX(-0.3).translate(0, 1.08, 0));
  standGeo = mergeG(p);
  return standGeo;
}
/** One music stand. 1 draw call. */
export function musicStand() { const g = grp('musicStand'); g.add(mesh(musicStandGeometry(), M.ironBlack())); return g; }

/**
 * The band: bentwood chairs with music stands, all instanced (3 draw calls for any number). positions: optional
 * [[x, z, ry], …] (chair seat centre; the player faces +Z rotated by ry); default two staggered rows of 7 along X.
 * userData: { chairs: [Vector3+ry], wood, cane, stands (InstancedMeshes) }.
 */
export function bandChairs({ count = 14, positions = null, stands = true, spacing = 0.85, seed = 9 } = {}) {
  const g = grp('bandChairs'), r = rng(seed);
  const P = positions || Array.from({ length: count }, (_, i) => { const row = i % 2, k = Math.floor(i / 2), n = Math.ceil(count / 2); return [(k - (n - 1) / 2) * spacing + row * spacing / 2, row * 0.9, 0]; });
  const chairs = P.map(([x, z, ry]) => ({ p: [x, 0, z], r: [0, (ry || 0) + (r() - 0.5) * 0.2, 0] }));
  const G = bentwoodGeometry();
  const wood = instances(G.wood, M.walnut({ tint: '#4a2c18' }), chairs), cane = instances(G.cane, caneMaterial(), chairs);
  g.add(wood, cane);
  let st = null;
  if (stands) {
    st = instances(musicStandGeometry(), M.ironBlack(), P.map(([x, z, ry]) => { const a = ry || 0; return { p: [x + Math.sin(a) * 0.55, 0, z + Math.cos(a) * 0.55], r: [0, a + Math.PI + (r() - 0.5) * 0.25, 0] }; }));
    g.add(st);
  }
  g.userData.chairs = P.map(([x, z, ry]) => Object.assign(new THREE.Vector3(x, 0.45, z), { ry: ry || 0 }));
  g.userData.wood = wood; g.userData.cane = cane; g.userData.stands = st;
  return g;
}

// =====================================================================================================
// DOUBLE BASS, PIT RAIL
// =====================================================================================================

/**
 * Double bass standing on its end pin (slightly tilted back), optionally under a dust sheet with the scroll peeking
 * out. Origin: floor centre; the front of the instrument faces +Z. userData: { bass (group), sheet (dust sheet group
 * or null), removeSheet() }. Cost: 3 draw calls (+1 sheet).
 */
export function doubleBass({ sheet = true, sheetColor = '#c9aca2' } = {}) {
  const g = grp('doubleBass');
  const bass = grp('bass'); g.add(bass);
  const half = [[0.0, 0.0], [0.2, 0.02], [0.31, 0.13], [0.33, 0.3], [0.29, 0.44], [0.21, 0.53], [0.2, 0.6], [0.24, 0.72], [0.25, 0.84], [0.19, 0.98], [0.08, 1.07], [0.0, 1.1]];
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.splineThru(half.slice(1).map(([x, y]) => new THREE.Vector2(x, y)));
  sh.splineThru(half.slice(0, -1).reverse().map(([x, y]) => new THREE.Vector2(-x, y)));
  const body = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 3, curveSegments: 10 }).translate(0, 0.1, -0.08);
  bass.add(mesh(body, M.mahogany({ tint: '#7a3a16', roughness: 0.35 })));
  const neck = [boxG(0.05, 0.62, 0.04, 0, 1.45, 0.06, 0.012), boxG(0.06, 0.16, 0.05, 0, 1.82, 0.05, 0.01), new THREE.TorusGeometry(0.035, 0.016, 8, 16, Math.PI * 1.6).rotateY(Math.PI / 2).translate(0, 1.93, 0.07),
    boxG(0.06, 0.9, 0.012, 0, 1.08, 0.115, 0.004), boxG(0.12, 0.08, 0.012, 0, 0.62, 0.12, 0.003), latheG([[0.001, 0], [0.05, 0.02], [0.04, 0.24], [0.001, 0.26]], 8).scale(1, 1, 0.25).translate(0, 0.24, 0.115), cylG(0.008, 0.008, 0.12, 6, 0, 0.06, 0)];
  for (let i = 0; i < 4; i++) neck.push(cylG(0.006, 0.006, 0.07, 6).rotateZ(Math.PI / 2).translate(0, 1.78 + i * 0.04, 0.05));
  bass.add(mergeInto(neck, M.matte('#1a1410', { roughness: 0.4 })));
  const strings = [];
  for (let i = 0; i < 4; i++) strings.push(cylG(0.0012, 0.0012, 1.4, 4).translate(-0.015 + i * 0.01, 1.12, 0.13));
  bass.add(mergeInto(strings, M.iron({ color: '#b8b4a8', roughness: 0.3 }), { cast: false }));
  bass.rotation.x = -0.08;
  let s = null;
  if (sheet) { s = dustSheet({ shape: 'tall', w: 0.78, d: 0.42, h: 1.78, color: sheetColor, seed: 3, folds: 1.2 }); g.add(s); }
  g.userData.bass = bass; g.userData.sheet = s;
  g.userData.removeSheet = () => { if (s) s.visible = false; };
  return g;
}

/**
 * The brass pit rail on stanchions, optionally with a short velvet curtain hung below it (the orchestra's modesty).
 * Origin: floor centre; runs along X; the audience is at +Z. userData: { curtain }. Cost: 1 draw call (+4 curtain).
 */
export function pitRail({ w = 8, h = 0.95, spacing = 1.6, curtain = true, color = M.palette.velvetRed } = {}) {
  const g = grp('pitRail');
  const n = Math.max(2, Math.round(w / spacing) + 1), parts = [cylG(0.022, 0.022, w, 16).rotateZ(Math.PI / 2).translate(0, h, 0), cylG(0.01, 0.01, w, 10).rotateZ(Math.PI / 2).translate(0, h - 0.3, 0.012)];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + w * i / (n - 1);
    parts.push(cylG(0.016, 0.016, h, 12, x, h / 2, 0), latheG([[0.001, 0], [0.06, 0], [0.055, 0.02], [0.02, 0.05], [0.001, 0.05]], 16).translate(x, 0, 0), new THREE.SphereGeometry(0.03, 14, 10).translate(x, h + 0.02, 0));
  }
  g.add(mergeInto(parts, M.tarnishedBrass({ amount: 0.35 })));
  let c = null;
  if (curtain) { c = drape({ w: w - 0.1, h: h - 0.32, color, anchor: 'centre', pleatW: 0.18, depth: 0.025, sway: 0, seed: 13, segY: 3, flare: 0.1 }); c.position.set(0, h - 0.3, 0.015); g.add(c); }
  g.userData.curtain = c;
  return g;
}

// =====================================================================================================
// STORM EFFECTS: THUNDER SHEET, WIND MACHINE, RAIN DRUM + GEARS, FLASH BOX
// =====================================================================================================

/** A sheet of tin with grime and a stencil, as a texture. */
function tinTexture(stencil, { w = 512, h = 1024, seed = 5 } = {}) {
  const c = makeCanvas(w, h), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = '#a8a8a2'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,250' : '40,38,34'},${0.04 + r() * 0.05})`; g.fillRect(0, r() * h, w, 2 + r() * 10); }
  grime(g, w, h, { seed, color: '#5a4a38', octaves: [[4, 0.25], [16, 0.15], [60, 0.08]] });
  for (let i = 0; i < 8; i++) { const x = r() * w, y = r() * h, gr = g.createRadialGradient(x, y, 2, x, y, 30 + r() * 50); gr.addColorStop(0, 'rgba(140,70,30,0.35)'); gr.addColorStop(1, 'rgba(140,70,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  if (stencil) {
    g.fillStyle = 'rgba(30,24,20,0.82)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = stencil.split('\n');
    lines.forEach((l, i) => { g.font = `${i === 0 ? 46 : 32}px ${FONTS.typed}`; const sz = Math.min(1, (w * 0.86) / g.measureText(l).width); g.save(); g.translate(w / 2, h * 0.42 + i * 56); g.scale(sz, 1); g.fillText(l, 0, 0); g.restore(); });
  }
  const t = canvasTexture(c);
  return t;
}

/**
 * Thunder sheet: a 1 × 2 m tin sheet clamped in a wooden batten, hung on two chains from a joist, a handle bolted to
 * the bottom. Origin: the hanging point (joist level). userData: { shake(strength 0..1) (it booms: the sheet ripples
 * and swings, decaying), sheet (mesh), swing (group), handlePos (Vector3, local) }. Cost: 4 draw calls.
 */
export function thunderSheet({ w = 1, h = 2, chain = 0.45, stencil = "PROPERTY OF THE EMPRESS\nUSED IN 'THE SCOTTISH PLAY', 1904" } = {}) {
  const g = grp('thunderSheet');
  const swing = grp('swing'); g.add(swing);
  const top = -chain - 0.05;
  const geo = new THREE.PlaneGeometry(w, h, 6, 18).translate(0, top - h / 2, 0);
  const p = geo.attributes.position, base = Float32Array.from(p.array);
  const sheetMat = new THREE.MeshStandardMaterial({ map: tinTexture(stencil), metalness: 0.65, roughness: 0.45, side: THREE.DoubleSide });
  const sheet = mesh(geo, sheetMat);
  swing.add(sheet);
  swing.add(mergeInto([boxG(w + 0.12, 0.08, 0.05, 0, top + 0.01, 0, 0.008), cylG(0.018, 0.018, 0.3, 10, w / 2 - 0.12, top - h + 0.08, 0.04).rotateZ(0), boxG(0.06, 0.06, 0.03, w / 2 - 0.12, top - h + 0.08, 0.018, 0.006)], M.dustyWood()));
  const hw = [];
  for (const s of [-1, 1]) hw.push(new THREE.TorusGeometry(0.02, 0.005, 6, 12).translate(s * (w / 2 - 0.08), top + 0.065, 0), cylG(0.008, 0.008, 0.07, 6).rotateX(Math.PI / 2).translate(s * 0.25, top + 0.01, 0), new THREE.TorusGeometry(0.02, 0.005, 6, 12).translate(s * (w / 2 - 0.08), 0.0, 0));
  for (let i = -3; i <= 3; i++) hw.push(cylG(0.008, 0.008, 0.07, 6).rotateX(Math.PI / 2).translate(i * w / 7, top + 0.01, 0));
  swing.add(mergeInto(hw, M.ironBlack()));
  // chains: links alternate 90°
  const links = [], L = 0.03;
  for (const s of [-1, 1]) for (let y = -0.02, k = 0; y > top + 0.08; y -= L * 0.8, k++) links.push({ p: [s * (w / 2 - 0.08), y, 0], r: [0, k % 2 ? Math.PI / 2 : 0, 0] });
  swing.add(instances(new THREE.TorusGeometry(0.011, 0.0028, 5, 10).scale(1, 1.5, 1), M.iron({ color: '#4a4640' }), links, { cast: true }));
  let energy = 0, time = 0, acc = 0;
  g.userData.update = (dt) => {
    if (energy < 0.001) return;
    time += dt; energy *= Math.exp(-dt * 0.9);
    swing.rotation.x = Math.sin(time * 3.2) * 0.05 * energy;
    swing.rotation.z = Math.sin(time * 2.3 + 1) * 0.02 * energy;
    acc += dt; if (acc < 1 / 40) return; acc = 0;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], k = Math.min(1, (top - y) / 0.4);
      p.setZ(i, energy * k * (0.05 * Math.sin(y * 6 + time * 37) + 0.03 * Math.sin(x * 5 - time * 23) * Math.sin(y * 3 + time * 11)));
    }
    p.needsUpdate = true; geo.computeVertexNormals();
    if (energy < 0.002) { for (let i = 0; i < p.count; i++) p.setZ(i, 0); p.needsUpdate = true; geo.computeVertexNormals(); swing.rotation.set(0, 0, 0); energy = 0; }
  };
  g.userData.shake = (s = 1) => { energy = Math.min(1.5, energy + s); };
  g.userData.sheet = sheet; g.userData.swing = swing;
  g.userData.handlePos = new THREE.Vector3(w / 2 - 0.12, top - h + 0.08, 0.06);
  return g;
}

/** Build a cloth strip that follows a path in the YZ plane (points [[y, z], …]) across X width w. */
function stripAlong(path, w, segX = 8) {
  const pos = [], uv = [], idx = [], row = segX + 1;
  let L = 0;
  path.forEach(([y, z], j) => {
    if (j) L += Math.hypot(y - path[j - 1][0], z - path[j - 1][1]);
    for (let i = 0; i <= segX; i++) { pos.push(-w / 2 + w * i / segX, y, z); uv.push(i / segX * 2, L * 2); }
  });
  for (let j = 0; j < path.length - 1; j++) for (let i = 0; i < segX; i++) { const a = j * row + i, b = a + 1, c = a + row, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

/**
 * Wind machine: an eight-slat drum on a wooden A-frame, canvas draped over it and weighted, an iron crank, a large
 * painted speed dial with a needle (six bands, chalked GALE) and a governor lever with a brass pawl beside it.
 * Origin: floor centre; the crank is at +X, the dial faces +Z. userData: { drum (rotation.x), crank (turns with the
 * drum), setSpeed(0..1) (drum spin, canvas ripple and needle follow), speed, needle, bands (WIND_BANDS), dialAngle(v),
 * governor (group; rotation.z), setGovernor(on), pawl, shaftEnd (Vector3: the -X shaft end for the gear train) }.
 * Cost: 9 draw calls.
 */
export function windMachine({ chalk = 'GALE' } = {}) {
  const g = grp('windMachine');
  const R = 0.3, L = 0.72, cy = 0.82, fw = L / 2 + 0.06;
  const wood = M.dustyWood({ tint: '#9a7a54' });
  // A-frames at both ends, stretchers, a top rail at the back for the canvas
  const f = [];
  for (const s of [-1, 1]) {
    const x = s * fw;
    f.push(boxG(0.05, 1.0, 0.06, x, 0.48, -0.2, 0.006).rotateX(0), boxG(0.05, 1.0, 0.06, x, 0.48, 0.2, 0.006));
    f.push(boxG(0.05, 0.06, 0.62, x, cy, 0, 0.006), boxG(0.06, 0.05, 0.75, x, 0.03, 0, 0.006));
  }
  f.push(boxG(fw * 2 + 0.05, 0.05, 0.05, 0, 0.15, -0.3, 0.006), boxG(fw * 2 + 0.05, 0.05, 0.05, 0, 0.15, 0.3, 0.006), boxG(fw * 2 + 0.05, 0.04, 0.04, 0, 0.55, -0.4, 0.005));
  f.push(boxG(0.05, 0.6, 0.05, -fw, 0.3, -0.4, 0.006), boxG(0.05, 0.6, 0.05, fw, 0.3, -0.4, 0.006));
  // dial post (on the -X end, rising above the frame) and the governor bracket
  f.push(boxG(0.06, 0.62, 0.06, -fw - 0.06, cy + 0.12, 0.26, 0.006));
  g.add(mergeInto(f, wood));
  // drum: two eight-sided wheels, eight slats, axle (+ crank) in one rotating group
  const drum = grp('drum'); drum.position.set(0, cy, 0); g.add(drum);
  const dw = [];
  for (const s of [-1, 1]) dw.push(cylG(R, R, 0.03, 8).rotateZ(Math.PI / 2).translate(s * (L / 2 - 0.015), 0, 0));
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) * TAU / 8; dw.push(boxG(L, 0.035, 0.07, 0, 0, 0, 0.004).rotateX(a).translate(0, Math.sin(a) * R * 0.93, Math.cos(a) * R * 0.93)); }
  dw.push(cylG(0.02, 0.02, 0.09, 8).rotateZ(Math.PI / 2).translate(fw + 0.21, 0.0, 0.2)); // crank handle (wood)
  drum.add(mergeInto(dw, M.dustyWood({ tint: '#b08a5c' })));
  drum.add(mergeInto([cylG(0.018, 0.018, fw * 2 + 0.2, 10).rotateZ(Math.PI / 2).translate(0.02, 0, 0), boxG(0.025, 0.04, 0.22, fw + 0.14, 0, 0.1, 0.006), cylG(0.01, 0.01, 0.06, 8).rotateZ(Math.PI / 2).translate(fw + 0.16, 0, 0.2)], M.ironBlack()));
  // canvas: tied to the back rail, over the drum, hanging down the front to a weighted batten
  const path = [[0.55, -0.4], [0.62, -0.36]];
  for (let k = 0; k <= 12; k++) { const a = Math.PI * 0.9 - k / 12 * Math.PI * 0.8; path.push([cy + Math.sin(a) * (R + 0.015), Math.cos(a) * (R + 0.015)]); }
  for (let y = cy + Math.sin(0.1 * Math.PI) * R - 0.06; y > 0.42; y -= 0.06) path.push([y, (R + 0.015) * Math.cos(0.1 * Math.PI) + 0.02]);
  const cgeo = stripAlong(path, L - 0.06, 10), cp = cgeo.attributes.position, cbase = Float32Array.from(cp.array);
  const cmat = M.paintedCanvas({ tint: '#c8b994', side: THREE.DoubleSide });
  g.add(mesh(cgeo, cmat));
  g.add(at(mesh(cylG(0.02, 0.02, L - 0.04, 8).rotateZ(Math.PI / 2), M.dustyWood()), 0, path[path.length - 1][0] - 0.01, path[path.length - 1][1] + 0.005));
  // dial
  const dial = grp('dial'); dial.position.set(-fw - 0.06, cy + 0.42, 0.3); g.add(dial);
  dial.add(mesh(new THREE.CircleGeometry(0.2, 48), new THREE.MeshStandardMaterial({ map: windDialTexture({ chalk }), roughness: 0.75 }), { cast: false }));
  dial.add(mergeInto([new THREE.TorusGeometry(0.2, 0.012, 8, 48), cylG(0.2, 0.2, 0.02, 32).rotateX(Math.PI / 2).translate(0, 0, -0.012)], M.iron({ color: '#3a3632' })));
  const needle = mergeInto([boxG(0.012, 0.17, 0.004, 0, 0.075, 0, 0.001), cylG(0.016, 0.016, 0.01, 12).rotateX(Math.PI / 2)], M.matte('#1a1410', { roughness: 0.5 }));
  needle.position.z = 0.012; dial.add(needle);
  // governor lever with a pawl, to the right of the dial
  const gov = grp('governor'); gov.position.set(-fw - 0.06 + 0.0, cy + 0.12, 0.33); g.add(gov);
  gov.add(mergeInto([boxG(0.022, 0.32, 0.016, 0, 0.16, 0, 0.004), cylG(0.018, 0.018, 0.04, 10).rotateX(Math.PI / 2)], M.ironBlack()));
  gov.add(at(mesh(cylG(0.017, 0.017, 0.1, 10), M.dustyWood({ tint: '#6a4a2a' })), 0, 0.36, 0));
  const pawl = mesh(mergeG([boxG(0.05, 0.02, 0.012, 0.025, 0, 0, 0.003)]), M.brass()); pawl.position.set(0.02, cy + 0.06 - (cy + 0.12) + 0.12, 0.02); gov.add(pawl);
  let speed = 0, gate = 0, ang = 0, acc = 0, time = 0;
  needle.rotation.z = windDialAngle(0);
  g.userData.update = (dt, t) => {
    time = t;
    needle.rotation.z = chase(needle.rotation.z, windDialAngle(speed), dt, 6);
    if (speed > 0.001) { ang -= dt * speed * 14; drum.rotation.x = ang; }
    acc += dt;
    if (acc > 1 / 30 && (speed > 0.01 || gate)) {
      acc = 0; gate = speed > 0.01 ? 1 : 0;
      for (let i = 0; i < cp.count; i++) { const y = cbase[i * 3 + 1], z = cbase[i * 3 + 2], front = z > R * 0.6 && y < cy ? (cy - y) / 0.4 : 0; cp.setZ(i, z + speed * front * (0.03 * Math.sin(time * 19 + y * 14) + 0.06 * speed)); }
      cp.needsUpdate = true; cgeo.computeVertexNormals();
    }
  };
  g.userData.setSpeed = (v) => { speed = THREE.MathUtils.clamp(v, 0, 1); g.userData.speed = speed; };
  g.userData.setGovernor = (on) => { gov.rotation.z = on ? -0.5 : 0; pawl.rotation.z = on ? -0.6 : 0; g.userData.governorOn = !!on; };
  g.userData.speed = 0; g.userData.drum = drum; g.userData.crank = drum; g.userData.needle = needle; g.userData.dial = dial;
  g.userData.bands = WIND_BANDS; g.userData.dialAngle = windDialAngle;
  g.userData.governor = gov; g.userData.pawl = pawl;
  g.userData.shaftEnd = new THREE.Vector3(-fw - 0.08, cy, 0);
  return g;
}

const stamps = new Map();
function stampTexture(text) {
  if (!stamps.has(text)) {
    const c = makeCanvas(192, 96), g = c.getContext('2d');
    g.fillStyle = 'rgba(30,20,10,0.85)'; g.font = `64px ${FONTS.typed}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 96, 50);
    stamps.set(text, canvasTexture(c));
  }
  return stamps.get(text);
}
/** Pitch radius of a spur gear: module·teeth/2. */
export const gearPitchRadius = (teeth, module = 0.008) => module * teeth / 2;
const gearGeos = new Map();
/**
 * A cast spur gear (axis along Z, centred on the origin): teeth, module (pitch radius = module·teeth/2), thickness,
 * a hub and lightening holes; stamped with its tooth count (e.g. "24T") unless stamp is false.
 * userData: { teeth, r (pitch radius), module }. Cost: 1–2 draw calls.
 */
export function gear({ teeth = 24, module = 0.008, thick = 0.018, color = null, stamp = true } = {}) {
  const key = `${teeth}:${module}:${thick}`;
  if (!gearGeos.has(key)) {
    const r = module * teeth / 2, ra = r + module, rr = r - 1.25 * module, pa = TAU / teeth, s = new THREE.Shape();
    for (let i = 0; i < teeth; i++) {
      const a = i * pa, P = (rad, an) => [Math.cos(an) * rad, Math.sin(an) * rad];
      const pts = [P(rr, a), P(ra, a + 0.14 * pa), P(ra, a + 0.36 * pa), P(rr, a + 0.5 * pa), P(rr, a + 0.75 * pa)];
      pts.forEach(([x, y], k) => (i === 0 && k === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
    }
    s.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, Math.max(0.008, r * 0.12), 0, TAU, true); s.holes.push(hole);
    if (r > 0.07) for (let i = 0; i < 5; i++) { const a = i * TAU / 5, h = new THREE.Path(); h.absarc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.17, 0, TAU, true); s.holes.push(h); }
    const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 10 }).translate(0, 0, -thick / 2);
    gearGeos.set(key, mergeG([geo, cylG(r * 0.22, r * 0.22, thick * 1.6, 16).rotateX(Math.PI / 2)]));
  }
  const g = grp(`gear${teeth}`);
  g.add(mesh(gearGeos.get(key), color ? M.iron({ color, roughness: 0.4 }) : M.tarnishedBrass({ amount: 0.3 })));
  if (stamp) {
    const sw = Math.max(0.026, module * teeth * 0.2);
    const p = mesh(new THREE.PlaneGeometry(sw, sw / 2), new THREE.MeshStandardMaterial({ map: stampTexture(`${teeth}T`), transparent: true, depthWrite: false, roughness: 0.6 }), { cast: false });
    p.position.set(0, -module * teeth * 0.3, thick / 2 + 0.0025); g.add(p);
  }
  g.userData.teeth = teeth; g.userData.r = module * teeth / 2; g.userData.module = module;
  return g;
}

/**
 * Rain drum: a hexagonal slatted drum (dried peas inside) on a trestle, with its gear train at +X: a driven 32T on
 * the drum axle, an empty stub axle under a stencilled gear guard (IDLER 24T) and a 20T drive gear on a shaft stub
 * (couple it to the wind machine's shaft). Gears turn about X. Origin: floor centre.
 * userData: { drum, gears: { drive, driven, idler }, stub (Vector3, local: where the idler's centre goes),
 * fitIdler(gear | null) (seats a gear() on the stub, or removes it), setSpeed(0..1) (the drive turns; the idler
 * turns if fitted; the drum and driven gear only if a 24T idler is fitted), turning }. Cost: 8 draw calls + gears.
 */
export function rainDrum({ module = 0.008, guard = 'IDLER 24T' } = {}) {
  const g = grp('rainDrum');
  const R = 0.26, L = 0.6, cy = 0.72, gx = L / 2 + 0.16;
  const wood = M.dustyWood({ tint: '#9a7a54' });
  const tr = [];
  for (const s of [-1, 1]) { const x = s * (L / 2 + 0.06); tr.push(boxG(0.05, cy + 0.02, 0.06, x, (cy + 0.02) / 2, 0, 0.006), boxG(0.06, 0.05, 0.6, x, 0.025, 0, 0.006), boxG(0.05, 0.05, 0.12, x, cy, 0, 0.006)); }
  tr.push(boxG(L + 0.17, 0.05, 0.05, 0, 0.2, 0, 0.006));
  // gear-train bracket (an iron plate on its own post at +X)
  tr.push(boxG(0.05, cy + 0.05, 0.06, gx + 0.06, (cy + 0.05) / 2, 0.24, 0.006), boxG(0.06, 0.05, 0.4, gx + 0.06, 0.025, 0.24, 0.006));
  g.add(mergeInto(tr, wood));
  const drum = grp('drum'); drum.position.set(0, cy, 0); g.add(drum);
  const d = [];
  for (const s of [-1, 1]) d.push(cylG(R, R, 0.035, 6).rotateZ(Math.PI / 2).translate(s * (L / 2 - 0.018), 0, 0));
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + TAU / 12; d.push(boxG(L - 0.02, 0.025, 0.2, 0, 0, 0, 0.004).rotateX(a + Math.PI / 2).translate(0, Math.sin(a) * R * 0.86, Math.cos(a) * R * 0.86)); }
  drum.add(mergeInto(d, M.dustyWood({ tint: '#b08a5c' })));
  drum.add(mergeInto([cylG(0.016, 0.016, L + 0.5, 10).rotateZ(Math.PI / 2).translate(0.13, 0, 0), new THREE.TorusGeometry(R * 0.9, 0.006, 4, 6).rotateY(Math.PI / 2).rotateX(TAU / 12).translate(-0.12, 0, 0), new THREE.TorusGeometry(R * 0.9, 0.006, 4, 6).rotateY(Math.PI / 2).rotateX(TAU / 12).translate(0.12, 0, 0)], M.ironBlack()));
  // gears: driven 32T on the drum axle at x = gx; idler stub at z = r32 + r24; drive 20T beyond it
  const r32 = gearPitchRadius(32, module), r24 = gearPitchRadius(24, module), r20 = gearPitchRadius(20, module);
  const zI = r32 + r24, zD = zI + r24 + r20;
  const mk = (T) => { const gg = gear({ teeth: T, module, stamp: true }); gg.rotation.y = Math.PI / 2; return gg; };
  const driven = mk(32); driven.position.set(gx, cy, 0); g.add(driven);
  const drive = mk(20); drive.position.set(gx, cy, zD); g.add(drive);
  const hw = [cylG(0.012, 0.012, 0.12, 8).rotateZ(Math.PI / 2).translate(gx + 0.02, cy, zI), cylG(0.018, 0.018, 0.2, 10).rotateZ(Math.PI / 2).translate(gx - 0.06, cy, zD), cylG(0.03, 0.03, 0.04, 12).rotateZ(Math.PI / 2).translate(gx - 0.17, cy, zD)];
  g.add(mergeInto(hw, M.iron({ color: '#5a5650', roughness: 0.4 })));
  // gear guard: a half-round sheet-iron hood over the stub, stencilled
  const gc = makeCanvas(512, 128), gg2 = gc.getContext('2d');
  gg2.fillStyle = '#3c4a3a'; gg2.fillRect(0, 0, 512, 128); grime(gg2, 512, 128, { seed: 4, color: '#2a2016', octaves: [[6, 0.3], [30, 0.15]] });
  gg2.fillStyle = 'rgba(232,224,200,0.9)'; gg2.font = `64px ${FONTS.typed}`; gg2.textAlign = 'center'; gg2.textBaseline = 'middle'; gg2.fillText(guard, 256, 66);
  const gtex = canvasTexture(gc);
  const hood = mesh(new THREE.CylinderGeometry(r24 + 0.035, r24 + 0.035, 0.06, 24, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide }));
  hood.position.set(gx + 0.01, cy, zI); g.add(hood);
  let idler = null, speed = 0;
  const stub = new THREE.Vector3(gx, cy, zI);
  g.userData.fitIdler = (gr) => { if (idler) g.remove(idler); idler = gr || null; if (idler) { idler.position.copy(stub); idler.rotation.set(0, Math.PI / 2, 0); g.add(idler); } };
  let a = 0;
  g.userData.update = (dt) => {
    if (speed < 0.001) return;
    a += dt * speed * 6;
    drive.rotation.x = a;
    if (idler) idler.rotation.x = -a * 20 / idler.userData.teeth;
    const meshed = idler && idler.userData.teeth === 24;
    g.userData.turning = !!meshed;
    if (meshed) { driven.rotation.x = a * 20 / 32; drum.rotation.x = -a * 20 / 32; }
  };
  g.userData.setSpeed = (v) => { speed = Math.max(0, v); };
  g.userData.drum = drum; g.userData.gears = { drive, driven, get idler() { return idler; } }; g.userData.stub = stub; g.userData.guard = hood;
  g.userData.turning = false;
  return g;
}

/**
 * Lightning flash box: a tin box with a bulb behind frosted glass and a knife switch. flash() fires a short
 * lightning flicker (blue-white glow + halo). Origin: base centre; the glass faces +Z.
 * userData: { flash(), setLit(0..1), glass }. Cost: 4 draw calls (+1 halo while lit).
 */
export function flashBox({ color = '#cfe0ff' } = {}) {
  const g = grp('flashBox');
  g.add(mergeInto([boxG(0.32, 0.2, 0.2, 0, 0.1, 0, 0.006), boxG(0.34, 0.012, 0.22, 0, 0.206, 0, 0.003), boxG(0.06, 0.02, 0.24, -0.12, 0.01, 0, 0.003), boxG(0.06, 0.02, 0.24, 0.12, 0.01, 0, 0.003)], M.iron({ color: '#6a6862', roughness: 0.5 })));
  const glassMat = new THREE.MeshStandardMaterial({ color: '#c8ccd0', emissive: new THREE.Color(color), emissiveIntensity: 0, roughness: 0.9 });
  const glass = mesh(new THREE.PlaneGeometry(0.24, 0.13), glassMat, { cast: false }); glass.position.set(0, 0.1, 0.101); g.add(glass);
  g.add(mergeInto([boxG(0.03, 0.05, 0.012, 0.19, 0.11, 0.0, 0.003), boxG(0.006, 0.07, 0.006, 0.2, 0.15, 0.0, 0.001).rotateZ(-0.6)], M.ironBlack()));
  g.add(mesh(tubeG([[0, 0.2, -0.1], [0, 0.35, -0.14], [0.1, 0.6, -0.16]], 0.006, { radial: 5 }), M.matte('#1a1410')));
  const hs = halo(color, 1.4, 0); hs.position.set(0, 0.12, 0.2); hs.visible = false; g.add(hs);
  let t0 = -1, base = 0, lvl = 0;
  const seq = [[0, 1], [0.05, 0.1], [0.11, 0.9], [0.16, 0.3], [0.22, 1], [0.45, 0]];
  const apply = (v) => { lvl = v; glassMat.emissiveIntensity = 3 * v; hs.visible = v > 0.01; hs.material.opacity = 0.8 * v; };
  let clock = 0;
  g.userData.update = (dt) => {
    clock += dt;
    if (t0 < 0) return;
    const e = clock - t0;
    if (e > 0.5) { t0 = -1; apply(base); return; }
    let v = 0; for (let i = 0; i < seq.length - 1; i++) if (e >= seq[i][0] && e < seq[i + 1][0]) { const k = (e - seq[i][0]) / (seq[i + 1][0] - seq[i][0]); v = seq[i][1] + (seq[i + 1][1] - seq[i][1]) * k * 0.4; }
    apply(Math.max(base, v));
  };
  g.userData.flash = () => { t0 = clock; };
  g.userData.setLit = (v) => { base = v; apply(v); };
  g.userData.glass = glass;
  return g;
}

/**
 * Bass drum on its spurs: lacquered shell, calfskin heads (the front one painted), wooden hoops, tension rods.
 * Origin: floor centre; the painted head faces +Z. userData: { frontHead, topPos (Vector3: the top of the shell, for
 * a mallet), beat() (the heads flex) }. Cost: 5 draw calls.
 */
export function bassDrum({ r = 0.36, depth = 0.38, label = 'EMPRESS\nORCHESTRA', shell = '#5a1418' } = {}) {
  const g = grp('bassDrum');
  const cy = r + 0.06;
  g.add(at(mesh(cylG(r, r, depth - 0.06, 40, 0, 0, 0, true).rotateX(Math.PI / 2), M.enamel(shell, { roughness: 0.3 })), 0, cy, 0));
  const hc = makeCanvas(512, 512), hg = hc.getContext('2d');
  hg.fillStyle = '#e8dcc0'; hg.fillRect(0, 0, 512, 512); grime(hg, 512, 512, { seed: 9, color: '#8a6a40', octaves: [[4, 0.25], [20, 0.12]] });
  hg.strokeStyle = '#8a1c1c'; hg.lineWidth = 10; hg.beginPath(); hg.arc(256, 256, 200, 0, TAU); hg.stroke();
  hg.fillStyle = '#7a1a18'; hg.textAlign = 'center'; hg.textBaseline = 'middle';
  label.split('\n').forEach((l, i, a) => { hg.font = `${i === 0 ? 74 : 40}px ${FONTS.display}`; hg.fillText(l, 256, 256 + (i - (a.length - 1) / 2) * 76); });
  const front = mesh(new THREE.CircleGeometry(r - 0.01, 40), new THREE.MeshStandardMaterial({ map: canvasTexture(hc), roughness: 0.8 }), { cast: false });
  front.position.set(0, cy, depth / 2 - 0.01); g.add(front);
  const back = mesh(new THREE.CircleGeometry(r - 0.01, 40).rotateY(Math.PI), M.paintedCanvas({ tint: '#e0d4b8' }), { cast: false }); back.position.set(0, cy, -depth / 2 + 0.01); g.add(back);
  g.add(mergeInto([new THREE.TorusGeometry(r, 0.025, 8, 40).scale(1, 1, 1.6).translate(0, cy, depth / 2 - 0.02), new THREE.TorusGeometry(r, 0.025, 8, 40).scale(1, 1, 1.6).translate(0, cy, -depth / 2 + 0.02)], M.oak({ tint: '#8a5a2a' })));
  const hw = [];
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10; hw.push(cylG(0.005, 0.005, depth + 0.02, 6).rotateX(Math.PI / 2).translate(Math.cos(a) * (r + 0.03), cy + Math.sin(a) * (r + 0.03), 0), boxG(0.02, 0.03, 0.02, Math.cos(a) * (r + 0.03), cy + Math.sin(a) * (r + 0.03), depth / 2 + 0.01, 0.004)); }
  for (const s of [-1, 1]) hw.push(tubeG([[s * 0.2, cy - 0.15, 0.1], [s * 0.32, 0.1, 0.2], [s * 0.36, 0.0, 0.28]], 0.008, { radial: 6 }));
  hw.push(boxG(0.1, 0.04, 0.08, 0, 0.03, 0, 0.006));
  g.add(mergeInto(hw, M.iron({ color: '#a8a49c', roughness: 0.35 })));
  let k = 0;
  g.userData.update = (dt) => { if (k <= 0) return; k = Math.max(0, k - dt * 4); front.scale.setScalar(1 + 0.01 * Math.sin(k * 40) * k); };
  g.userData.beat = () => { k = 1; };
  g.userData.frontHead = front; g.userData.topPos = new THREE.Vector3(0, cy + r + 0.005, 0);
  return g;
}

// =====================================================================================================
// GRAMOPHONE, WINCH
// =====================================================================================================

/**
 * Portable gramophone: a leatherette case with the lid open behind, a felt platter with a record (label text),
 * a nickel tone arm with a soundbox over a small brass horn, a crank socket on the right side and a speed lever on a
 * brass arc with 13 notches (SLOW … FAST). Origin: base centre; the front faces +Z.
 * userData: { platter (rotation.y), record, arm (pivot; rotation.y: 0 parked, ~0.5 on the record), setArm(t 0..1),
 * setSpinning(rpm), speedLever (pivot; rotation.y), setNotch(i 0..12), notches: 13, crankSocket (Vector3), setCrank(on),
 * crank, cardPos (Vector3: on the record, for a speed-tester card), setLabel(tex) }. Cost: 9 draw calls.
 */
export function gramophone({ label = 'Miss Lavinia Thrush\n1912 — 78', notch = 2, crank = false } = {}) {
  const g = grp('gramophone');
  const W = 0.4, H = 0.15, D = 0.4;
  g.add(mergeInto([boxG(W, H, D, 0, H / 2, 0, 0.012)], M.leather('#3a2418')));
  g.add(mesh(boxG(W - 0.03, 0.004, D - 0.03, 0, H + 0.002, 0, 0.001), M.walnut({ tint: '#5a3a20' })));
  const lid = grp('lid'); lid.position.set(0, H, -D / 2); lid.rotation.x = -1.75; g.add(lid);
  lid.add(mergeInto([boxG(W, 0.05, D, 0, 0.025, D / 2, 0.012)], M.leather('#3a2418')));
  lid.add(at(mesh(new THREE.PlaneGeometry(W - 0.04, D - 0.04).rotateX(Math.PI / 2), M.velvetRed({ color: '#6a1a22', repeat: [1, 1] })), 0, -0.001, D / 2));
  const platter = grp('platter'); platter.position.set(-0.04, H + 0.012, 0.01); g.add(platter);
  platter.add(mesh(cylG(0.15, 0.15, 0.012, 40, 0, -0.004, 0), M.baize('#2a4a30')));
  const rc = makeCanvas(512, 512), rg = rc.getContext('2d');
  rg.fillStyle = '#0c0a0a'; rg.fillRect(0, 0, 512, 512);
  for (let rr = 70; rr < 256; rr += 3) { rg.strokeStyle = `rgba(255,255,255,${0.03 + (rr % 9 === 0 ? 0.03 : 0)})`; rg.beginPath(); rg.arc(256, 256, rr, 0, TAU); rg.stroke(); }
  rg.fillStyle = '#8a1a1c'; rg.beginPath(); rg.arc(256, 256, 88, 0, TAU); rg.fill();
  rg.fillStyle = '#e8d8a8'; rg.textAlign = 'center'; rg.textBaseline = 'middle';
  label.split('\n').forEach((l, i, a) => { rg.font = `${i === 0 ? 20 : 22}px ${FONTS.fell}`; rg.fillText(l, 256, 246 + (i - (a.length - 1) / 2) * 30 + 10); });
  rg.font = `14px ${FONTS.fell}`; rg.fillText('— GRAMOPHONE CO. —', 256, 200);
  const recMat = new THREE.MeshStandardMaterial({ map: canvasTexture(rc), roughness: 0.3, metalness: 0.1 });
  const record = mesh(new THREE.CircleGeometry(0.128, 48).rotateX(-Math.PI / 2), recMat, { cast: false }); record.position.y = 0.0035; platter.add(record);
  platter.add(mesh(cylG(0.004, 0.004, 0.02, 8, 0, 0.01, 0), M.iron({ color: '#c8c6c0', roughness: 0.2 })));
  // horn (brass flare) at the back right, and the tone arm pivoting on its neck
  const brass = M.brass();
  const horn = latheG([[0.012, 0], [0.014, 0.04], [0.02, 0.08], [0.035, 0.12], [0.06, 0.15], [0.085, 0.165]], 28).rotateX(Math.PI / 2 - 0.45);
  const statics = [horn.translate(0.14, H + 0.02, -0.12), cylG(0.02, 0.024, 0.03, 16, 0.14, H + 0.015, -0.12)];
  // crank socket escutcheon (right side) and the speed arc (front right)
  statics.push(cylG(0.018, 0.018, 0.006, 16).rotateZ(Math.PI / 2).translate(W / 2 + 0.003, 0.08, 0.05));
  const arcR = 0.07, arcC = new THREE.Vector3(0.13, H + 0.004, 0.15);
  statics.push(new THREE.TorusGeometry(arcR, 0.004, 4, 24, 1.2).rotateX(-Math.PI / 2).rotateY(Math.PI / 2 - 0.6).translate(arcC.x, arcC.y, arcC.z));
  for (let i = 0; i < 13; i++) { const f = -0.6 + 1.2 * i / 12; statics.push(boxG(0.002, 0.003, 0.012, 0, 0, 0, 0.0005).rotateY(f).translate(-Math.sin(f) * (arcR + 0.008) + arcC.x, arcC.y, -Math.cos(f) * (arcR + 0.008) + arcC.z)); }
  g.add(mergeInto(statics, brass));
  const arm = grp('toneArm'); arm.position.set(0.14, H + 0.04, -0.12); g.add(arm);
  arm.add(mergeInto([tubeG([[0, 0, 0], [-0.03, 0.02, 0.06], [-0.08, 0.02, 0.15], [-0.1, 0.015, 0.19]], 0.008, { radial: 8 }), cylG(0.028, 0.028, 0.012, 20).rotateZ(Math.PI / 2).translate(-0.1, 0.0, 0.2), cylG(0.002, 0.001, 0.02, 4, -0.1, -0.025, 0.2)], M.iron({ color: '#c8c6c0', roughness: 0.25 })));
  const lever = grp('speedLever'); lever.position.copy(arcC); g.add(lever);
  lever.add(mergeInto([boxG(0.006, 0.006, arcR, 0, 0.004, -arcR / 2, 0.001), new THREE.SphereGeometry(0.008, 10, 8).translate(0, 0.008, -arcR - 0.004)], M.bakelite()));
  // the winding crank (hidden until fitted)
  const ck = grp('crank'); ck.position.set(W / 2 + 0.005, 0.08, 0.05); g.add(ck);
  ck.add(mergeInto([cylG(0.006, 0.006, 0.08, 8).rotateZ(Math.PI / 2).translate(0.04, 0, 0), boxG(0.01, 0.1, 0.012, 0.08, -0.04, 0, 0.003), cylG(0.01, 0.01, 0.04, 10).rotateZ(Math.PI / 2).translate(0.1, -0.085, 0)], M.iron({ color: '#b8b6b0', roughness: 0.3 })));
  ck.visible = !!crank;
  let rpm = 0;
  g.userData.update = (dt) => { if (rpm > 0) platter.rotation.y -= rpm / 60 * TAU * dt; };
  g.userData.setSpinning = (v) => { rpm = v; };
  g.userData.setArm = (t) => { arm.rotation.y = -0.55 * t; };
  g.userData.setNotch = (i) => { i = THREE.MathUtils.clamp(Math.round(i), 0, 12); g.userData.notch = i; lever.rotation.y = -0.6 + 1.2 * i / 12; };
  g.userData.setNotch(notch);
  g.userData.setCrank = (on) => { ck.visible = !!on; };
  g.userData.setLabel = (tex) => { recMat.map = tex; recMat.needsUpdate = true; };
  g.userData.platter = platter; g.userData.record = record; g.userData.arm = arm; g.userData.speedLever = lever; g.userData.notches = 13; g.userData.crank = ck; g.userData.lid = lid;
  g.userData.crankSocket = new THREE.Vector3(W / 2 + 0.006, 0.08, 0.05);
  g.userData.cardPos = new THREE.Vector3(-0.04, H + 0.02, 0.01);
  return g;
}

/**
 * Wall winch: cast-iron side frames on a back plate, a rope drum with hemp wound on it (the rope runs up), a gear
 * pair, and a removable crank handle on a square shaft; an enamel plate below. Origin: centre-back on the wall;
 * faces +Z. userData: { drum (rotation.x), handle (group; hide/remove it), setHandle(on), turn(rad), plate }.
 * Cost: 6 draw calls.
 */
export function winch({ plate = 'STAR TRAP', ropeUp = 1.2 } = {}) {
  const g = grp('winch');
  const iron = M.ironBlack();
  const parts = [boxG(0.42, 0.5, 0.02, 0, 0, 0.01, 0.004)];
  for (const s of [-1, 1]) parts.push(boxG(0.02, 0.3, 0.2, s * 0.16, 0.02, 0.11, 0.004));
  parts.push(cylG(0.012, 0.012, 0.42, 8).rotateZ(Math.PI / 2).translate(0, -0.06, 0.15));
  g.add(mergeInto(parts, iron));
  const drum = grp('drum'); drum.position.set(0, 0.06, 0.12); g.add(drum);
  drum.add(mesh(cylG(0.075, 0.075, 0.26, 20).rotateZ(Math.PI / 2), ropeMat()));
  drum.add(mergeInto([cylG(0.11, 0.11, 0.015, 20).rotateZ(Math.PI / 2).translate(-0.135, 0, 0), cylG(0.11, 0.11, 0.015, 20).rotateZ(Math.PI / 2).translate(0.135, 0, 0), cylG(0.015, 0.015, 0.5, 8).rotateZ(Math.PI / 2)], iron));
  g.add(mesh(tubeG([[0, 0.13, 0.12 + 0.07], [0, 0.4, 0.2], [0, ropeUp, 0.2]], 0.012, { radial: 6 }), ropeMat()));
  const gear1 = gear({ teeth: 40, module: 0.005, stamp: false, color: '#3a3632' }); gear1.rotation.y = Math.PI / 2; gear1.position.set(0.19, 0.06, 0.12); g.add(gear1);
  const handle = grp('handle'); handle.position.set(0.26, -0.06, 0.15); g.add(handle);
  handle.add(mergeInto([boxG(0.03, 0.03, 0.03, 0, 0, 0, 0.003), boxG(0.02, 0.2, 0.02, 0.02, -0.1, 0, 0.004), cylG(0.012, 0.012, 0.03, 8).rotateZ(Math.PI / 2).translate(0.045, -0.19, 0)], M.iron({ color: '#8a8680', roughness: 0.35 })));
  handle.add(at(mesh(cylG(0.016, 0.016, 0.1, 10).rotateZ(Math.PI / 2), M.dustyWood({ tint: '#6a4a2a' })), 0.1, -0.19, 0));
  const pl = textPlate(plate, 0.3, { style: 'enamel', pw: 512, ph: 128, bg: '#1a2a4a', fg: '#efe8d8' });
  pl.position.set(0, -0.2, 0.021); g.add(pl);
  g.userData.turn = (a) => { drum.rotation.x = a; gear1.rotation.x = a; handle.rotation.x = -a * 3; };
  g.userData.setHandle = (on) => { handle.visible = !!on; };
  g.userData.drum = drum; g.userData.handle = handle; g.userData.plate = pl;
  return g;
}

// Pit-only props (SET-pit): the roll rack and leader lectern, the pianola's tuning bay / PLAY lever / key and spool
// hooks, dust-sheeted instruments (harp, tuba + mouse, cello, drum kit + mallet, trombone), the steep pit stair, the
// arched stage-front wall, the line shaft from the wind machine to the rain drum, the spare-gear shelf, the ceiling
// star trap, falling dust, the drip, the rain drum's peas. Built with the PROPS helpers and palette.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import { TAU, mesh, noRay, grp, at, boxG, cylG, latheG, mergeG, mergeInto, tubeG, instances, chase, rng, textPlate } from '../../engine/props/theatre/common.js';
import { dustSheet, doubleBass, bassDrum, gear, pianolaRollTexture } from '../../engine/props/theatre.js';
import { agedPaperTexture, FONTS, grime } from '../../engine/props/theatre-textures.js';
import { makeCanvas, canvasTexture } from '../../engine/props/textures.js';

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** An invisible click target (same as ctx.hotspots.proxyBox). */
export function proxy(w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.userData.hitProxy = true;
  m.castShadow = m.receiveShadow = false;
  return m;
}

// =====================================================================================================
// ROLLS
// =====================================================================================================

/** The six rolls: guide-strip column of each of their first notes (C D E F G A B C′ = 0..7) and the audio tune. */
export const ROLLS = {
  101: { notes: [3, 2, 1, 0], tune: 'hymn' },
  102: { notes: [4, 2, 0], tune: 'lullaby' },
  103: { notes: [0, 2, 4, 7], tune: 'empressMarch' },
  104: { notes: [0, 4, 2, 7], tune: 'bishopsBicycle' },
  105: { notes: [2, 4, 7, 4], tune: 'tango' },
  106: { notes: [0, 2, 4, 2], tune: 'waltz' },
};
export const ROLL_NUMBERS = [101, 102, 103, 104, 105, 106];
export const ROLL_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C′'];

const leaderTex = new Map();
/** A roll's leader: the maker's printed guide strip of letters across the top, then its first notes punched. */
export function leaderTexture(num) {
  if (leaderTex.has(num)) return leaderTex.get(num);
  const w = 512, h = 352, c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#ebe1c6'; g.fillRect(0, 0, w, h);
  grime(g, w, h, { seed: num, color: '#9a8058', octaves: [[4, 0.14], [24, 0.06]] });
  const x0 = 34, cw = (w - 68) / 8;
  // printed guide strip
  g.fillStyle = '#7a2a1c'; g.font = `18px ${FONTS.fell}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(`No. ${num}`, x0, 20);
  g.textAlign = 'right'; g.fillText('PERFORATED MUSIC CO.', w - x0, 20);
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.strokeRect(x0, 36, w - 68, 50);
  g.textAlign = 'center'; g.fillStyle = '#2a1c10'; g.font = `38px ${FONTS.display}`;
  ROLL_LETTERS.forEach((L, i) => {
    g.fillText(L, x0 + (i + 0.5) * cw, 62);
    if (i) { g.beginPath(); g.moveTo(x0 + i * cw, 36); g.lineTo(x0 + i * cw, 86); g.stroke(); }
  });
  // column guides
  g.strokeStyle = 'rgba(120,80,40,0.35)'; g.lineWidth = 1.5; g.setLineDash([6, 8]);
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(x0 + i * cw, 92); g.lineTo(x0 + i * cw, h - 8); g.stroke(); }
  g.setLineDash([]);
  // punched slots, one per note, stepping down the paper
  const notes = ROLLS[num]?.notes || [];
  notes.forEach((n, k) => {
    const cx = x0 + (n + 0.5) * cw, cy = 122 + k * 58;
    g.fillStyle = '#120c08'; g.beginPath(); g.roundRect(cx - cw * 0.3, cy - 17, cw * 0.6, 34, 8); g.fill();
    g.strokeStyle = 'rgba(255,250,235,0.5)'; g.lineWidth = 1.5; g.stroke();
  });
  const t = canvasTexture(c);
  leaderTex.set(num, t);
  return t;
}

let rollLabelAtlas = null;
function rollLabels() {
  if (rollLabelAtlas) return rollLabelAtlas;
  const s = 128, c = makeCanvas(s * 6, s), g = c.getContext('2d'), r = rng(17);
  ROLL_NUMBERS.forEach((n, i) => {
    const x = i * s;
    g.fillStyle = ['#d8caa4', '#cfc09a', '#dccfae', '#d2c49c', '#d6c8a2', '#cbbd96'][i]; g.fillRect(x, 0, s, s);
    g.strokeStyle = 'rgba(80,50,20,0.5)'; g.lineWidth = 3; g.strokeRect(x + 8, 8, s - 16, s - 16);
    // faded title: illegible pencil-grey squiggles
    g.strokeStyle = 'rgba(90,70,50,0.28)'; g.lineWidth = 2;
    for (let k = 0; k < 3; k++) { g.beginPath(); let px = x + 18; g.moveTo(px, 26 + k * 10); while (px < x + s - 20) { px += 4 + r() * 6; g.lineTo(px, 26 + k * 10 + (r() - 0.5) * 5); } g.stroke(); }
    g.fillStyle = '#2a1a0e'; g.font = `44px ${FONTS.typed}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), x + s / 2, 84);
  });
  grime(g, s * 6, s, { seed: 5, color: '#6a4a24', octaves: [[6, 0.3], [30, 0.12]] });
  rollLabelAtlas = canvasTexture(c);
  return rollLabelAtlas;
}

/**
 * The roll rack: a small walnut cabinet of six pigeonholes (3 × 2) with a boxed roll in each, labels outward
 * (only the numbers legible), and on top a sloped lectern with a dark guide card, a cradle and a leader that unrolls.
 * Origin: floor centre; the box ends face +Z. userData: { boxes {num: group}, slide(num, t) (box out of its hole),
 * show(num|null) (roll in the cradle), setUnroll(t 0..1) (the leader hangs 20 cm over the card), lectern (group),
 * cardCentre (Vector3 local) }.
 */
export function rollRack() {
  const g = grp('rollRack');
  const cell = 0.118, cols = 3, rows = 2, W = cols * cell + 0.04, H = rows * cell + 0.04, D = 0.38, legH = 0.4;
  const y0 = legH, wood = M.walnut({ tint: '#4a2c18' });
  const p = [boxG(W, 0.02, D, 0, y0 + 0.01, 0), boxG(W + 0.02, 0.022, D + 0.02, 0, y0 + H - 0.011, 0), boxG(0.02, H, D, -W / 2 + 0.01, y0 + H / 2, 0), boxG(0.02, H, D, W / 2 - 0.01, y0 + H / 2, 0), boxG(W, H, 0.012, 0, y0 + H / 2, -D / 2 + 0.006)];
  for (let i = 1; i < cols; i++) p.push(boxG(0.012, H - 0.03, D - 0.02, -W / 2 + 0.02 + i * cell, y0 + H / 2, 0.005));
  p.push(boxG(W - 0.03, 0.012, D - 0.02, 0, y0 + 0.02 + cell, 0.005));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(boxG(0.035, legH, 0.035, sx * (W / 2 - 0.03), legH / 2, sz * (D / 2 - 0.03)));
  p.push(boxG(W - 0.04, 0.02, 0.025, 0, 0.1, D / 2 - 0.03), boxG(W - 0.04, 0.02, 0.025, 0, 0.1, -D / 2 + 0.03));
  g.add(mergeInto(p, wood));
  // boxes
  const card = M.matte('#7a5a3a', { roughness: 0.95 });
  const atlas = rollLabels();
  const boxes = {};
  ROLL_NUMBERS.forEach((num, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const b = grp(`roll${num}`);
    b.add(mesh(boxG(0.086, 0.086, 0.34, 0, 0, 0, 0.006), card));
    const lg = new THREE.PlaneGeometry(0.074, 0.074), uv = lg.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 6);
    const lbl = mesh(lg, new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.9 }), { cast: false });
    lbl.position.z = 0.1705; b.add(lbl);
    b.position.set(-W / 2 + 0.02 + (col + 0.5) * cell, y0 + 0.02 + (rows - 1 - row) * cell + cell / 2 + 0.004, D / 2 - 0.17 + 0.018 + (i % 2) * 0.006);
    b.rotation.z = (rng(num)() - 0.5) * 0.06;
    b.userData.home = b.position.clone();
    b.userData.keep = true;
    g.add(b); boxes[num] = b;
  });
  // lectern on the top: sloped board, dark guide card, a cradle for the roll, the leader
  const topY = y0 + H;
  const lec = grp('lectern'); lec.position.set(0, topY, -0.02); lec.rotation.x = -0.42; g.add(lec);
  lec.add(mergeInto([boxG(0.4, 0.34, 0.016, 0, 0.17, 0), boxG(0.4, 0.024, 0.04, 0, 0.012, 0.022), boxG(0.03, 0.2, 0.03, 0, 0.1, -0.03)], wood));
  const cardMat = new THREE.MeshStandardMaterial({ color: '#1d2622', roughness: 0.85 });
  lec.add(at(mesh(new THREE.PlaneGeometry(0.33, 0.27), cardMat, { cast: false }), 0, 0.19, 0.0085));
  lec.add(mergeInto([boxG(0.012, 0.05, 0.05, -0.175, 0.33, 0.03), boxG(0.012, 0.05, 0.05, 0.175, 0.33, 0.03)], M.tarnishedBrass({ amount: 0.4 })));
  const rollPaper = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.85 });
  const held = grp('heldRoll'); held.position.set(0, 0.335, 0.035); lec.add(held);
  held.add(mesh(cylG(0.032, 0.032, 0.29, 20).rotateZ(Math.PI / 2), rollPaper));
  held.add(mergeInto([cylG(0.042, 0.042, 0.008, 20).rotateZ(Math.PI / 2).translate(-0.149, 0, 0), cylG(0.042, 0.042, 0.008, 20).rotateZ(Math.PI / 2).translate(0.149, 0, 0)], M.walnut({ tint: '#3a2416' })));
  held.visible = false;
  const leaderMat = new THREE.MeshStandardMaterial({ map: leaderTexture(103), roughness: 0.85, side: THREE.DoubleSide });
  const leader = mesh(new THREE.PlaneGeometry(0.29, 0.2).translate(0, -0.1, 0), leaderMat, { cast: false });
  leader.position.set(0, 0.335 - 0.002, 0.0115); leader.visible = false; lec.add(leader);
  let unroll = 0, shown = null;
  const apply = () => {
    leader.visible = !!shown && unroll > 0.01;
    leader.scale.y = Math.max(0.001, unroll);
    const m = leaderMat.map; if (m) { m.repeat.set(1, Math.max(0.001, unroll)); m.offset.set(0, 1 - unroll); }
  };
  g.userData.show = (num) => {
    shown = num || null; held.visible = !!shown;
    if (shown) { leaderMat.map = leaderTexture(shown); leaderMat.needsUpdate = true; }
    apply();
  };
  g.userData.setUnroll = (t) => { unroll = clamp01(t); apply(); held.rotation.x = -unroll * 4; };
  g.userData.slide = (num, t) => { const b = boxes[num]; if (b) b.position.z = b.userData.home.z + 0.22 * t; };
  g.userData.boxes = boxes; g.userData.lectern = lec; g.userData.leader = leader; g.userData.heldRoll = held;
  g.userData.cardCentre = new THREE.Vector3(0, topY + Math.cos(0.42) * 0.19, -0.02 - Math.sin(0.42) * 0.19);
  g.userData.keep = true;
  return g;
}

// =====================================================================================================
// PIANOLA: tuning bay, PLAY lever, keys, spool box
// =====================================================================================================

const BLACK_AFTER = new Set([0, 2, 3, 5, 6]);
/** Key index tables of the PROPS pianola (n = chromatic 0..87 from A0; midi = 21 + n). */
const KEYMAP = (() => {
  const whiteN = [], blackN = [], blackX = [];
  let n = 0;
  for (let i = 0; i < 52; i++) {
    whiteN.push(n++);
    if (BLACK_AFTER.has(i % 7) && i < 51) { blackN.push(n++); blackX.push(i + 0.5); }
  }
  return { whiteN, blackN, blackX };
})();
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** 'A4' style name for pianola key n. */
export const keyName = (n) => { const m = 21 + n; return `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`; };

function boardTexture() {
  const w = 1024, h = 192, c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#4a2e16'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${i % 2 ? '20,10,4' : '120,80,40'},0.08)`; g.fillRect(0, (i * 37) % h, w, 2 + (i % 3)); }
  // felt strip and the agraffe line
  g.fillStyle = '#5a1e1a'; g.fillRect(0, 150, w, 10);
  const gap0 = w * (0.5 + 0.06 / 1.4) - 46, gap1 = gap0 + 92; // the bay's three real strings sit in this gap
  for (let i = 0; i < 176; i++) {
    const x = 8 + i * 5.75;
    if (x > gap0 && x < gap1) continue;
    g.fillStyle = '#b8b4aa'; g.beginPath(); g.arc(x, 18 + (i % 2) * 12, 3.2, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(200,196,186,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, 22 + (i % 2) * 12); g.lineTo(x + 1, h); g.stroke();
  }
  grime(g, w, h, { seed: 3, color: '#2a1a0c', octaves: [[6, 0.25], [30, 0.1]] });
  return canvasTexture(c);
}
function chalkTexture() {
  const c = makeCanvas(256, 64), g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.strokeStyle = 'rgba(245,242,230,0.85)'; g.fillStyle = 'rgba(245,242,230,0.85)'; g.lineWidth = 4; g.lineCap = 'round';
  g.font = `40px ${FONTS.hand}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  [42, 128, 214].forEach((x) => g.fillText('A', x, 34));
  return canvasTexture(c);
}
function cardTexture() {
  return agedPaperTexture({ w: 512, h: 300, tint: '#f1e8d2', seed: 77, age: 0.35, key: 'pozzi-card', draw: (g, w, h) => {
    g.fillStyle = '#1e1610'; g.textAlign = 'center';
    g.font = `46px ${FONTS.display}`; g.fillText('Sig. A. Pozzi', w / 2, h * 0.36);
    g.font = `28px ${FONTS.fell}`; g.fillText('Pianoforte & Pianola', w / 2, h * 0.55);
    g.font = `20px ${FONTS.fell}`; g.fillText('TUNED · REGULATED · ROLLS SUPPLIED', w / 2, h * 0.72);
    g.strokeStyle = 'rgba(60,50,40,0.6)'; g.lineWidth = 2; g.strokeRect(14, 14, w - 28, h - 28);
  } });
}

/**
 * Fits the PROPS pianola for the pit: removes the upper front panel (the spool box shows), adds the tuning bay
 * under the lid (pin board, three chalk-marked A strings with pins and paper riders, a tuning hammer and fork, both
 * stowed on the name-board ledge until the bay is in use), a brass PLAY lever, Pozzi's card, the key and spool-box
 * proxies and per-roll paper. Returns the handle object (see set.js / docs/notes/set-pit.md). Animation runs from
 * piano.userData.update (chained).
 */
export function fitPianola(piano) {
  const U = piano.userData;
  const H = 1.32, W = 1.52;
  U.front.visible = false;
  // hide the PROPS pin block (the bay brings its own)
  piano.children.forEach((o) => { if (o.isMesh && o.geometry?.type === 'PlaneGeometry' && Math.abs(o.position.y - (H - 0.06)) < 0.001) o.visible = false; });
  // the loose front panel leans against the case's treble end

  // ---- tuning bay: board plane sloping down-forward under the lid; bay +Y is the board normal ------------------
  const bay = grp('tuningBay'); bay.position.set(0, H - 0.065, -0.285); bay.rotation.x = 0.714; piano.add(bay);
  const board = mesh(new THREE.PlaneGeometry(W - 0.12, 0.26).rotateX(-Math.PI / 2).translate(0, 0, 0.12), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.7 }), { cast: false });
  bay.add(board);
  const SX = [0.01, 0.06, 0.11]; // string x in piano space (A4 sits near x 0.06)
  const steel = M.iron({ color: '#d8d6d0', roughness: 0.22 });
  const strings = SX.map((x) => { const s = mesh(cylG(0.0011, 0.0011, 0.235, 6).rotateX(Math.PI / 2).translate(0, 0, 0.1325), steel, { cast: false }); s.position.set(x, 0.006, 0); bay.add(s); return s; });
  const pinMat = M.iron({ color: '#a8a49a', roughness: 0.3 });
  const pins = SX.map((x) => { const pn = mesh(mergeG([cylG(0.0042, 0.0042, 0.022, 10, 0, 0.011, 0), cylG(0.0016, 0.0016, 0.006, 6).rotateZ(Math.PI / 2).translate(0, 0.016, 0)]), pinMat); pn.position.set(x, 0, 0.012); bay.add(pn); return pn; });
  // bridge pins and a felt-capped bridge
  bay.add(mergeInto([boxG(0.2, 0.008, 0.012, 0.06, 0.004, 0.25, 0.002)], M.walnut({ tint: '#2a1a0e' })));
  const chalk = mesh(new THREE.PlaneGeometry(0.15, 0.0375).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: chalkTexture(), transparent: true, depthWrite: false, opacity: 0.85 }), { cast: false });
  chalk.position.set(0.06, 0.0015, 0.045); bay.add(noRay(chalk));
  // chalk ticks on the board beside each string
  // paper riders: a 4 cm strip folded over the string (tent), legs spread ±X
  const paper = new THREE.MeshStandardMaterial({ color: '#f6f2e6', roughness: 0.8, side: THREE.DoubleSide });
  const riderGeo = mergeG([new THREE.PlaneGeometry(0.016, 0.04).rotateX(-Math.PI / 2).translate(0.008, 0, 0).rotateZ(-0.55), new THREE.PlaneGeometry(0.016, 0.04).rotateX(-Math.PI / 2).translate(-0.008, 0, 0).rotateZ(0.55)]);
  const riders = SX.map((x) => { const r = mesh(riderGeo, paper); r.position.set(x, 0.0072, 0.14); bay.add(r); return r; });
  // tuning hammer (lever): socket on the pin, an arm along +X, a wooden grip
  const hammer = grp('tuningHammer');
  hammer.add(mergeInto([cylG(0.0065, 0.0065, 0.04, 12, 0, 0.026, 0), tubeG([[0, 0.044, 0], [0.03, 0.05, 0], [0.09, 0.05, 0]], 0.0045, { radial: 8 })], M.iron({ color: '#6a6660', roughness: 0.35 })));
  hammer.add(at(mesh(cylG(0.011, 0.01, 0.075, 14).rotateZ(Math.PI / 2), M.walnut({ tint: '#6a3a1a' })), 0.125, 0.05, 0));
  const hammerProxy = proxy(0.16, 0.05, 0.04); hammerProxy.position.set(0.09, 0.05, 0); hammer.add(hammerProxy);
  // tuning fork
  const fork = grp('tuningFork');
  const forkGeo = mergeG([cylG(0.0035, 0.0035, 0.05, 8, 0, 0.025, 0), cylG(0.006, 0.006, 0.008, 10, 0, -0.002, 0)]);
  const forkMat = M.iron({ color: '#c8c6be', roughness: 0.2 });
  fork.add(mesh(forkGeo, forkMat));
  const tine = (s) => { const t = grp('tine'); t.position.set(s * 0.0055, 0.052, 0); t.add(mesh(boxG(0.0035, 0.085, 0.0045, 0, 0.0425, 0, 0.0008), forkMat)); fork.add(t); return t; };
  fork.add(mesh(new THREE.TorusGeometry(0.0055, 0.0018, 6, 10, Math.PI).rotateZ(Math.PI).translate(0, 0.052, 0), forkMat));
  const tines = [tine(-1), tine(1)];
  const forkProxy = proxy(0.03, 0.15, 0.03); forkProxy.position.y = 0.07; fork.add(forkProxy);
  // where they live: stowed on the name-board ledge, or out in the bay
  const stowHammer = () => { piano.add(hammer); hammer.position.set(-0.2, 0.857, 0.13); hammer.rotation.set(Math.PI / 2, 0, -0.25); };
  const stowFork = () => { piano.add(fork); fork.position.set(-0.32, 0.86, 0.125); fork.rotation.set(0, 0.1, -Math.PI / 2); };
  let hammerPin = 0, hammerTurn = 0;
  const bayHammer = () => { bay.add(hammer); hammer.position.set(SX[hammerPin], 0.001, 0.012); hammer.rotation.set(0, hammerTurn, 0); };
  const bayFork = () => { bay.add(fork); fork.position.set(0.24, 0.006, 0.11); fork.rotation.set(-Math.PI / 2, 0, 0.35); };
  let inBay = false;
  // proxies inside the bay
  const pinProxies = SX.map((x) => { const p = proxy(0.03, 0.04, 0.03); p.position.set(x, 0.015, 0.012); bay.add(p); return p; });
  const stringProxies = SX.map((x) => { const p = proxy(0.022, 0.012, 0.1); p.position.set(x, 0.006, 0.21); bay.add(p); return p; });
  const riderProxies = SX.map((x) => { const p = proxy(0.032, 0.02, 0.05); p.position.set(x, 0.008, 0.14); bay.add(p); return p; });

  // ---- PLAY lever on the bass cheek (Lavinia perches at the treble end), a PLAY plate -------------------------------------------------------------
  const lever = grp('playLever'); lever.position.set(-(W / 2 - 0.035), 0.81, 0.325); piano.add(lever);
  lever.add(mergeInto([boxG(0.012, 0.1, 0.012, 0, 0.05, 0, 0.003), new THREE.SphereGeometry(0.016, 14, 10).translate(0, 0.105, 0), cylG(0.012, 0.012, 0.03, 10).rotateZ(Math.PI / 2)], M.brass({ polished: true })));
  const plate = textPlate('PLAY', 0.05, { style: 'brass', pw: 256, ph: 96 }); plate.position.set(-(W / 2 - 0.035), 0.76, 0.3215); piano.add(plate);
  const playProxy = proxy(0.06, 0.16, 0.06); playProxy.position.set(0, 0.06, 0); lever.add(playProxy);
  let playT = 0;
  const setPlay = (t) => { playT = clamp01(t); lever.rotation.x = -0.75 * playT; };
  // ---- Pozzi's card leaning on the ledge -------------------------------------------------------------------------
  const cardM = mesh(new THREE.PlaneGeometry(0.09, 0.053), new THREE.MeshStandardMaterial({ map: cardTexture(), roughness: 0.9, side: THREE.DoubleSide }), { cast: false });
  // FIXED BY qa-pit: it sat on the name-board rail behind the upright fallboard (invisible, a ~4 px hit area from the
  // vantage); now propped on the back of the bass keys against the fallboard, turned a little toward the pit
  cardM.position.set(-0.55, 0.774, 0.196); cardM.rotation.set(-0.15, -0.5, 0.02); piano.add(cardM);
  const cardProxy = proxy(0.12, 0.075, 0.03); cardProxy.position.copy(cardM.position); cardProxy.rotation.copy(cardM.rotation); piano.add(cardProxy);
  // ---- keys -------------------------------------------------------------------------------------------------------
  const kw = 0.0235, x0 = -52 * kw / 2 + kw / 2;
  const keyProxy = proxy(52 * kw, 0.035, 0.16); keyProxy.position.set(0, 0.745, 0.25); piano.add(keyProxy);
  const _v = new THREE.Vector3();
  /** World point on the keyboard → key n (0..87), or -1. */
  const keyAt = (worldPoint) => {
    piano.worldToLocal(_v.copy(worldPoint));
    const fi = (_v.x - x0) / kw;
    if (_v.z < 0.262) { const b = KEYMAP.blackX.findIndex((bx) => Math.abs(bx - fi) < 0.3); if (b >= 0) return KEYMAP.blackN[b]; }
    const i = Math.round(fi);
    return i >= 0 && i < 52 ? KEYMAP.whiteN[i] : -1;
  };
  const taps = new Map(); // n → seconds left held down
  const tapKey = (n, hold = 0.22) => { if (n < 0) return; U.setKey(n, 1); taps.set(n, hold); };
  let follow = null, followDown = new Set(), rollV = 0;
  // ---- spool box: per-roll paper, empty when no roll ------------------------------------------------------------
  const spoolProxy = proxy(0.5, 0.36, 0.08); spoolProxy.position.set(0, 1.08, 0.06); piano.add(spoolProxy);
  const rollTex = {};
  let loaded = 103;
  const setRollLoaded = (num) => {
    loaded = num || null;
    U.roll.visible = U.rollSheet.visible = !!loaded;
    if (loaded) {
      if (!rollTex[loaded]) { const t = pianolaRollTexture({ seed: loaded }); t.repeat.set(1, 0.6); rollTex[loaded] = t; }
      U.roll.material.map = rollTex[loaded]; U.roll.material.needsUpdate = true;
    }
  };
  const rollMat = U.roll.material;

  // ---- riders shiver: f = 435·(2^(|c|/1200) − 1) Hz, amplitude grows with |c| -----------------------------------
  let cents = [40, -25, 15], shiver = false, clock = 0, pluckE = [0, 0, 0], forkE = 0;
  const baseUpdate = U.update;
  U.update = (dt, t) => {
    baseUpdate(dt, t);
    clock += dt;
    for (let i = 0; i < 3; i++) {
      const c = Math.abs(cents[i]);
      if (shiver && c > 0.01) {
        const f = 435 * (Math.pow(2, c / 1200) - 1), amp = 0.06 + 0.28 * Math.min(1, c / 40);
        riders[i].rotation.z = amp * Math.sin(TAU * f * clock + i * 1.7);
        riders[i].position.y = 0.0072 + 0.0012 * Math.abs(Math.sin(TAU * f * clock + i));
      } else { riders[i].rotation.z = chase(riders[i].rotation.z, 0, dt, 10); riders[i].position.y = 0.0072; }
      if (pluckE[i] > 0) { pluckE[i] = Math.max(0, pluckE[i] - dt * 0.5); const s = 1 + pluckE[i] * 1.6 * (0.5 + 0.5 * Math.sin(clock * 90)); strings[i].scale.set(s, s, 1); }
    }
    if (forkE > 0) { forkE = Math.max(0, forkE - dt); const a = 0.004 * Math.min(1, forkE) * Math.sin(clock * 140); tines[0].rotation.z = a; tines[1].rotation.z = -a; }
    for (const [n, left] of taps) { const l = left - dt; if (l <= 0) { taps.delete(n); U.setKey(n, 0); } else taps.set(n, l); }
    if (follow) {
      const tt = follow.time, ev = follow.score?.events || [];
      const down = new Set();
      for (const x of ev) { if (x.t > tt) break; if (x.m != null && tt < x.t + Math.min(x.d ?? 0.2, 0.4)) down.add(x.m - 21); }
      for (const n of followDown) if (!down.has(n)) U.setKey(n, 0);
      for (const n of down) if (n >= 0 && n < 88) U.setKey(n, 1);
      followDown = down;
      if (!follow.playing) { for (const n of followDown) U.setKey(n, 0); followDown.clear(); follow = null; }
    }
    const spin = follow ? 1 : 0;
    rollV = chase(rollV, spin, dt, 4);
    if (rollV > 0.001 && loaded && rollMat.map) { rollMat.map.offset.y -= dt * 0.12 * rollV; U.roll.rotation.x -= dt * 2.5 * rollV; }
  };

  const h = {
    bay, board, strings, pins, riders, hammer, fork, chalk, pinProxies, stringProxies, riderProxies, hammerProxy, forkProxy,
    playLever: lever, playProxy, card: cardM, cardProxy, keyProxy, spoolProxy,
    /** Detunes in cents for the three strings, e.g. [40, -25, 15]; riders shiver per string while shiver is on. */
    setCents(arr) { cents = arr.map((v) => +v || 0); },
    get cents() { return cents.slice(); },
    setShiver(on) { shiver = !!on; },
    /** Put the hammer on pin i (0..2). */
    setHammerPin(i) { hammerPin = Math.max(0, Math.min(2, i | 0)); if (inBay) bayHammer(); },
    /** Hammer rotation about the pin (rad; a 5-cent detent ≈ 0.12 rad looks right). */
    setHammerTurn(a) { hammerTurn = a; if (inBay) hammer.rotation.y = a; },
    get hammerPin() { return hammerPin; },
    /** The string vibrates visibly for ~2 s. */
    pluck(i) { pluckE[i] = 1; },
    /** The fork's tines blur for `sec` seconds (it hums). */
    ringFork(sec = 6) { forkE = sec; },
    /** Fork and hammer out in the bay (true) or stowed on the ledge (false). */
    setInBay(b) { inBay = !!b; if (inBay) { bayHammer(); bayFork(); } else { stowHammer(); stowFork(); } },
    get inBay() { return inBay; },
    setPlay, get play() { return playT; },
    keyAt, tapKey, keyName,
    /** Keys follow an audio MusicHandle (from ctx.audio.pianola(...)) until it ends; the roll turns meanwhile. */
    follow(handle) { follow = handle || null; },
    stopFollow() { for (const n of followDown) U.setKey(n, 0); followDown.clear(); follow = null; },
    /** Free-play: random chords and the roll turning (the PROPS setPlaying). */
    setPlaying: U.setPlaying,
    setRollLoaded, get rollLoaded() { return loaded; },
    setLid: U.setLid, setKey: U.setKey,
  };
  h.setInBay(false);
  setRollLoaded(null);
  return h;
}

// =====================================================================================================
// DUST SHEETS + INSTRUMENTS
// =====================================================================================================

/**
 * A dust sheet that slides off: wraps dustSheet(). userData.setOff(t, instant): 0 on, 1 off (it slides to the
 * side along `dir` (local, radians about Y) and settles as a flat heap on the floor). Animates itself.
 */
export function slidingSheet(opts = {}, { dir = 0, dist = 0.7 } = {}) {
  const g = grp('slidingSheet');
  const s = dustSheet(opts); g.add(s);
  const cloth = s.userData.cloth;
  cloth.material = cloth.material.clone(); // own material: the heap darkens a touch
  let t = 0, target = 0;
  const dx = Math.sin(dir) * dist, dz = Math.cos(dir) * dist;
  const apply = () => {
    const k = ease(t);
    s.position.set(dx * k, 0, dz * k);
    s.scale.set(1 + 0.35 * k, Math.max(0.06, 1 - 0.94 * k), 1 + 0.35 * k);
    s.rotation.set(Math.cos(dir) * Math.sin(Math.PI * t) * 0.35, 0.4 * k, -Math.sin(dir) * Math.sin(Math.PI * t) * 0.35);
  };
  g.userData.update = (dt) => { if (t === target) return; t = target > t ? Math.min(target, t + dt / 0.8) : Math.max(target, t - dt / 0.8); apply(); };
  g.userData.setOff = (v, instant) => { target = clamp01(+v); if (instant) { t = target; apply(); } };
  g.userData.isOff = () => target > 0.5;
  g.userData.cloth = cloth;
  return g;
}

function stringsTexture(n = 34) {
  const c = makeCanvas(512, 512), g = c.getContext('2d');
  g.clearRect(0, 0, 512, 512);
  for (let i = 0; i < n; i++) { const x = 10 + i * (492 / (n - 1)); g.strokeStyle = i % 7 === 2 ? 'rgba(170,40,30,1)' : i % 7 === 5 ? 'rgba(40,50,120,1)' : 'rgba(235,225,200,1)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  const t = canvasTexture(c); return t;
}
/**
 * Concert harp (pedal harp, ~1.75 m): plinth with pedals, a gilt fluted column, a carved neck, a sloping soundboard
 * and its strings (one alpha-tested plane). Origin: floor centre; the player sits at -Z. userData: { gliss() }.
 */
export function harp() {
  const g = grp('harp');
  const gilt = M.gilt({ pattern: 'plain' }), wood = M.walnut({ tint: '#7a4a24' });
  g.add(mergeInto([boxG(0.42, 0.12, 0.3, 0, 0.06, 0, 0.02)], wood));
  g.add(mergeInto([latheG([[0.03, 0], [0.045, 0.06], [0.03, 0.14], [0.034, 1.3], [0.055, 1.38], [0.06, 1.48], [0.03, 1.55], [0.001, 1.58]], 14).translate(0, 0.1, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(0.04)).translate(-0.15, 0, 0)], gilt));
  // neck: a curve from the column top to the soundboard top
  const neck = tubeG([[-0.2, 1.62, 0], [-0.05, 1.7, 0], [0.12, 1.6, 0], [0.24, 1.5, 0], [0.32, 1.42, 0]], 0.03, { radial: 8, seg: 24 });
  g.add(mesh(neck, wood));
  // soundboard: tapered box from the plinth (x 0.14) up to the neck end (x 0.33, y 1.42)
  const sb = new THREE.BoxGeometry(0.06, 1.38, 0.1, 1, 6, 1);
  const p = sb.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.69, k = y / 1.38; p.setZ(i, p.getZ(i) * (1.8 - 1.2 * k)); p.setX(i, p.getX(i) * (1.6 - 0.8 * k) + 0.14 + 0.19 * k); p.setY(i, y + 0.08); }
  sb.computeVertexNormals();
  g.add(mesh(sb, M.walnut({ tint: '#a87a44' })));
  // strings: a quad from the soundboard (bottom) to the neck (top)
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0.22, 0, 0.12, 0.22, 0, 0.3, 1.42, 0, -0.13, 1.6, 0], 3));
  sg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  sg.setIndex([0, 1, 2, 0, 2, 3]); sg.computeVertexNormals();
  const smat = new THREE.MeshStandardMaterial({ map: stringsTexture(), alphaTest: 0.5, transparent: false, side: THREE.DoubleSide, roughness: 0.4, emissive: '#000000' });
  const strings = mesh(sg, smat, { cast: false });
  g.add(strings);
  for (let i = 0; i < 4; i++) g.add(at(mesh(boxG(0.02, 0.01, 0.05, 0, 0, 0, 0.002), M.brass()), -0.15 + i * 0.1, 0.02, 0.17));
  let k = 0, clock = 0;
  g.userData.update = (dt) => { clock += dt; if (k <= 0) return; k = Math.max(0, k - dt * 0.6); strings.position.z = 0.004 * k * Math.sin(clock * 70); smat.emissive.setRGB(0.25 * k, 0.2 * k, 0.1 * k); };
  g.userData.gliss = () => { k = 1; };
  g.userData.keep = true;
  return g;
}

/** A field mouse: a grey head with ears, eyes and whiskers (it lives in the tuba). */
function mouse() {
  const g = grp('mouse');
  const fur = M.matte('#7a6e64', { roughness: 0.95 });
  g.add(mesh(new THREE.SphereGeometry(0.03, 14, 10).scale(1, 0.9, 1.3), fur));
  g.add(mergeInto([new THREE.SphereGeometry(0.016, 10, 8).scale(1, 1, 0.35).translate(-0.022, 0.027, -0.005), new THREE.SphereGeometry(0.016, 10, 8).scale(1, 1, 0.35).translate(0.022, 0.027, -0.005)], M.matte('#c89a94', { roughness: 0.8 })));
  g.add(mergeInto([new THREE.SphereGeometry(0.005, 8, 6).translate(-0.012, 0.01, 0.028), new THREE.SphereGeometry(0.005, 8, 6).translate(0.012, 0.01, 0.028), new THREE.SphereGeometry(0.006, 8, 6).translate(0, -0.004, 0.04)], M.matte('#0c0808', { roughness: 0.2 })));
  return g;
}
/**
 * Tuba on a low stool, bell up: lathe bell and body, coiled tubing, four valves. A mouse lives in the bell.
 * Origin: floor centre. userData: { peek() (the mouse looks out, considers you, goes back in), mouse }.
 */
export function tuba() {
  const g = grp('tuba');
  g.add(mergeInto([boxG(0.42, 0.04, 0.38, 0, 0.42, 0, 0.01), boxG(0.04, 0.42, 0.04, -0.17, 0.21, -0.15), boxG(0.04, 0.42, 0.04, 0.17, 0.21, -0.15), boxG(0.04, 0.42, 0.04, -0.17, 0.21, 0.15), boxG(0.04, 0.42, 0.04, 0.17, 0.21, 0.15)], M.dustyWood({ tint: '#6a4a2a' })));
  const brass = M.tarnishedBrass({ amount: 0.55 });
  const T = grp('body'); T.position.set(0, 0.44, 0); T.rotation.z = 0.12; g.add(T);
  const bell = latheG([[0.05, 0], [0.055, 0.25], [0.07, 0.5], [0.1, 0.62], [0.16, 0.7], [0.22, 0.74], [0.225, 0.755], [0.205, 0.75]], 28);
  const parts = [bell.translate(0.02, 0.05, 0), new THREE.TorusGeometry(0.15, 0.035, 10, 28).rotateY(Math.PI / 2).translate(-0.02, 0.28, 0), new THREE.TorusGeometry(0.11, 0.025, 8, 24).rotateY(Math.PI / 2).translate(-0.02, 0.32, 0), latheG([[0.001, 0], [0.11, 0.0], [0.12, 0.05], [0.07, 0.1], [0.05, 0.12], [0.001, 0.12]], 20).translate(0.02, -0.02, 0)];
  for (let i = 0; i < 4; i++) parts.push(cylG(0.016, 0.016, 0.14, 10, -0.17, 0.36, -0.06 + i * 0.04), cylG(0.012, 0.012, 0.03, 8, -0.17, 0.45, -0.06 + i * 0.04));
  parts.push(tubeG([[-0.17, 0.3, -0.07], [-0.24, 0.28, 0], [-0.3, 0.38, 0.02], [-0.28, 0.52, 0.04]], 0.009, { radial: 6 }));
  T.add(mergeInto(parts, brass));
  T.add(at(mesh(new THREE.CircleGeometry(0.2, 24).rotateX(-Math.PI / 2), M.matte('#0a0806')), 0.02, 0.79, 0));
  const ms = mouse(); ms.position.set(0.05, 0.74, 0.02); ms.rotation.y = 0.0; T.add(ms); ms.visible = false;
  let t = -1;
  g.userData.update = (dt) => {
    if (t < 0) return;
    t += dt;
    const k = t < 0.5 ? ease(t / 0.5) : t < 2.2 ? 1 : t < 2.6 ? 1 - ease((t - 2.2) / 0.4) : 0;
    ms.visible = k > 0.01;
    ms.position.y = 0.74 + 0.065 * k;
    ms.rotation.y = t > 0.6 && t < 2.2 ? Math.sin((t - 0.6) * 3) * 0.5 : 0;
    ms.rotation.x = -0.25 * k;
    if (t > 2.6) { t = -1; ms.visible = false; }
  };
  g.userData.peek = () => { t = 0; };
  g.userData.mouse = ms;
  g.userData.keep = true;
  return g;
}

/** The cello: the PROPS double bass at cello size, with Pozzi's bow tie on the scroll. */
export function cello() {
  const g = grp('cello');
  const b = doubleBass({ sheet: false });
  b.scale.setScalar(0.66); b.rotation.x = -0.12; g.add(b);
  b.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(b);
  const tie = grp('bowTie');
  const red = M.velvetRed({ color: '#8a1420' });
  tie.add(mergeInto([new THREE.ConeGeometry(0.035, 0.07, 4).rotateZ(Math.PI / 2).translate(-0.035, 0, 0).scale(1, 0.8, 0.35), new THREE.ConeGeometry(0.035, 0.07, 4).rotateZ(-Math.PI / 2).translate(0.035, 0, 0).scale(1, 0.8, 0.35), new THREE.SphereGeometry(0.014, 10, 8)], red));
  tie.position.set(0, box.max.y - 0.13, (box.max.z + box.min.z) / 2 + 0.03);
  g.add(tie);
  g.userData.bowTie = tie;
  g.userData.keep = true;
  return g;
}

/**
 * The padded thunder beater (`mallet`): a felt-wrapped head on an ash handle, ~0.42 m. Origin: its centre.
 */
export function mallet() {
  const g = grp('mallet');
  g.add(mesh(cylG(0.012, 0.014, 0.36, 10).rotateZ(Math.PI / 2).translate(0.07, 0, 0), M.oak({ tint: '#c8a070' })));
  g.add(at(mesh(new THREE.SphereGeometry(0.055, 18, 12).scale(1.1, 1, 1), M.matte('#d8cdb4', { roughness: 1 })), -0.14, 0, 0));
  g.add(at(mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 18).rotateY(Math.PI / 2), M.matte('#8a2a20')), -0.14, 0, 0));
  g.userData.keep = true;
  return g;
}

/**
 * Drum kit: the PROPS bass drum, a snare on a stand, a ride cymbal, a small tom. Origin: floor centre; the bass
 * drum's painted head faces +Z. userData: { bass (bassDrum), malletSeat (Vector3 local, on top of the bass drum),
 * snareTap() (snare and its stand jump), crash() }.
 */
export function drumKit() {
  const g = grp('drumKit');
  const bd = bassDrum(); g.add(bd);
  const chrome = M.iron({ color: '#b0aca4', roughness: 0.3 });
  const stand = (x, z, h) => [cylG(0.008, 0.008, h, 8, x, h / 2, z), ...[0, 1, 2].map((i) => { const a = i * TAU / 3; return tubeG([[x, 0.22, z], [x + Math.cos(a) * 0.14, 0.0, z + Math.sin(a) * 0.14]], 0.006, { radial: 5 }); })];
  g.add(mergeInto([...stand(0.55, 0.12, 0.55), ...stand(-0.62, -0.1, 0.95)], chrome));
  const snare = grp('snare'); snare.position.set(0.55, 0.6, 0.12); snare.rotation.x = 0.15; g.add(snare);
  snare.add(mesh(cylG(0.18, 0.18, 0.14, 28, 0, 0, 0, true), M.enamel('#5a1418', { roughness: 0.3 })));
  snare.add(mesh(cylG(0.18, 0.18, 0.005, 28, 0, 0.072, 0), M.paintedCanvas({ tint: '#e6dcc4' })));
  snare.add(mesh(new THREE.TorusGeometry(0.182, 0.01, 6, 28).rotateX(Math.PI / 2).translate(0, 0.07, 0), chrome));
  const cym = grp('cymbal'); cym.position.set(-0.62, 0.96, -0.1); cym.rotation.z = 0.2; g.add(cym);
  cym.add(mesh(latheG([[0.001, 0.025], [0.04, 0.02], [0.06, 0.008], [0.2, 0.0], [0.21, -0.004]], 32), M.brass({ color: '#c9a24a', roughness: 0.28 })));
  const tom = mesh(cylG(0.13, 0.13, 0.16, 24), M.enamel('#5a1418', { roughness: 0.3 })); tom.position.set(-0.05, 0.92, -0.05); tom.rotation.x = 0.35; g.add(tom);
  let k = 0, c = 0, clock = 0;
  g.userData.update = (dt) => {
    clock += dt;
    if (k > 0) { k = Math.max(0, k - dt * 5); snare.position.y = 0.6 + 0.01 * k; snare.rotation.z = 0.04 * k * Math.sin(clock * 50); }
    if (c > 0) { c = Math.max(0, c - dt * 0.8); cym.rotation.x = 0.1 * c * Math.sin(clock * 18); }
  };
  g.userData.snareTap = () => { k = 1; };
  g.userData.crash = () => { c = 1; };
  g.userData.bass = bd; g.userData.snare = snare; g.userData.cymbal = cym;
  g.userData.malletSeat = new THREE.Vector3(0, bd.userData.topPos.y + 0.012, 0.02);
  g.userData.keep = true;
  return g;
}

/** Trombone on a folding stand: slide, bell section, mouthpiece. Origin: floor centre; the bell faces +X. */
export function trombone() {
  const g = grp('trombone');
  g.add(mergeInto([tubeG([[0, 0.0, -0.18], [0, 0.55, 0], [0, 0.0, 0.18]], 0.008, { radial: 6 }), cylG(0.008, 0.008, 0.62, 8, 0, 0.62, 0), boxG(0.06, 0.03, 0.08, 0, 0.92, 0, 0.004), tubeG([[-0.15, 0, 0], [0, 0.4, 0], [0.15, 0, 0]], 0.007, { radial: 6 })], M.ironBlack()));
  const brass = M.brass({ color: '#c8a04a', roughness: 0.3 });
  const T = grp('horn'); T.position.set(0, 0.96, 0); g.add(T);
  const parts = [cylG(0.008, 0.008, 1.1, 8).rotateZ(Math.PI / 2).translate(-0.05, 0.0, 0.04), cylG(0.008, 0.008, 1.1, 8).rotateZ(Math.PI / 2).translate(-0.05, 0.0, -0.04), new THREE.TorusGeometry(0.04, 0.008, 8, 14, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(-0.6, 0, 0)];
  parts.push(cylG(0.009, 0.009, 0.62, 8).rotateZ(Math.PI / 2).translate(0.2, 0.08, 0.04), new THREE.TorusGeometry(0.045, 0.009, 8, 14, Math.PI).rotateZ(Math.PI / 2).translate(0.51, 0.04, 0.04));
  parts.push(latheG([[0.012, 0], [0.015, 0.25], [0.03, 0.42], [0.06, 0.5], [0.1, 0.54], [0.104, 0.55]], 24).rotateZ(Math.PI / 2).translate(0.47, 0.0, 0.04));
  parts.push(latheG([[0.004, 0], [0.012, 0.02], [0.006, 0.05]], 10).rotateZ(-Math.PI / 2).translate(-0.12, 0.08, 0.04));
  T.add(mergeInto(parts, brass));
  g.userData.keep = true;
  return g;
}

// =====================================================================================================
// ARCHITECTURE: arched wall, pit stair, ceiling trap
// =====================================================================================================

/**
 * A wall in the ZY plane (facing +X / -X) with a segmental arch cut through: z from z0 to z1, height h, thickness t
 * (centred on x = 0), arch from az0 to az1 springing at `spring`, crown at `crown`. Brick both faces, UVs in metres.
 */
export function archWall({ z0, z1, h, t = 0.36, az0, az1, spring, crown, material }) {
  const s = new THREE.Shape();
  s.moveTo(z0, 0); s.lineTo(z1, 0); s.lineTo(z1, h); s.lineTo(z0, h); s.closePath();
  const hole = new THREE.Path();
  const half = (az1 - az0) / 2, mid = (az0 + az1) / 2, rise = crown - spring;
  const R = (half * half + rise * rise) / (2 * rise), cy = crown - R, a0 = Math.asin(half / R);
  hole.moveTo(az0, 0.001); hole.lineTo(az1, 0.001); hole.lineTo(az1, spring);
  for (let i = 1; i < 24; i++) { const a = a0 - 2 * a0 * i / 24; hole.lineTo(mid + R * Math.sin(a), cy + R * Math.cos(a)); }
  hole.lineTo(az0, spring); hole.closePath();
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -t / 2).rotateY(-Math.PI / 2); // shape (u, v) → world (z, y); thickness along x
  return mesh(geo, material);
}

/**
 * A steep wooden pit stair (ship's ladder style) rising toward +Z: two stringers, `steps` treads, a handrail on -X.
 * Origin: floor at the foot centre. h: rise; run: horizontal length; w: width.
 */
export function pitStair({ h = 2.9, run = 2.1, w = 0.8, steps = 13 } = {}) {
  const g = grp('pitStair');
  const L = Math.hypot(h, run), ang = Math.atan2(h, run), wood = M.dustyWood({ tint: '#7a5a3a' });
  const p = [];
  for (const s of [-1, 1]) p.push(boxG(0.05, 0.22, L + 0.1, 0, 0, 0, 0.006).rotateX(-ang).translate(s * (w / 2 + 0.025), h / 2, run / 2));
  for (let i = 1; i <= steps; i++) { const f = i / (steps + 1); p.push(boxG(w, 0.035, 0.2, 0, f * h, f * run + 0.03, 0.004)); }
  // newel posts + handrail on -X
  p.push(boxG(0.06, 1.0, 0.06, -w / 2 - 0.06, 0.5, 0.02, 0.006));
  g.add(mergeInto(p, wood));
  g.add(mesh(tubeG([[-w / 2 - 0.06, 1.0, 0.02], [-w / 2 - 0.06, h + 0.9, run - 0.05]], 0.022, { radial: 8, seg: 4 }), M.tarnishedBrass({ amount: 0.6 })));
  return g;
}

/**
 * A star trap seen from below: a square opening in the boards, framed, with a leaf hinged on one edge that swings up
 * into the stage; a dim warm glow above it. Origin: centre of the opening at ceiling level (the leaf's underside).
 * userData: { setOpen(0..1), leaf, glow }.
 */
export function ceilingTrap({ w = 0.8, d = 0.8 } = {}) {
  const g = grp('ceilingTrap');
  g.add(mergeInto([boxG(w + 0.12, 0.08, 0.06, 0, -0.04, d / 2 + 0.03), boxG(w + 0.12, 0.08, 0.06, 0, -0.04, -d / 2 - 0.03), boxG(0.06, 0.08, d, -w / 2 - 0.03, -0.04, 0), boxG(0.06, 0.08, d, w / 2 + 0.03, -0.04, 0)], M.iron({ color: '#3a3632' })));
  const glow = mesh(new THREE.PlaneGeometry(w * 1.6, d * 1.6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#5a4630' }), { cast: false, receive: false });
  glow.position.y = 0.6; g.add(noRay(glow));
  const leaf = grp('leaf'); leaf.position.set(0, 0, -d / 2); g.add(leaf);
  leaf.add(mesh(boxG(w - 0.01, 0.05, d - 0.01, 0, 0.025, d / 2, 0.004), M.wood({ tint: '#5a4632', planks: 4, seed: 7, roughness: 0.85 })));
  leaf.add(mergeInto([boxG(w * 0.9, 0.006, 0.05, 0, -0.003, 0.15), boxG(w * 0.9, 0.006, 0.05, 0, -0.003, d - 0.15)], M.ironBlack()));
  g.userData.setOpen = (t) => { leaf.rotation.x = -1.4 * clamp01(t); };
  g.userData.leaf = leaf; g.userData.glow = glow;
  g.userData.keep = true;
  return g;
}

// =====================================================================================================
// MACHINERY: line shaft, gear shelf, peas, falling dust, drip
// =====================================================================================================

/**
 * Line shafting through world-space points [a, b, c, …]: an iron shaft per segment (each spins about its own axis,
 * with a key-flat collar so the turning shows), a bevel box at each bend, pillow blocks on short posts down to the
 * floor. userData: { setSpeed(rad/s), segments }.
 */
export function lineShaft(points, { r = 0.016, post = true } = {}) {
  const g = grp('lineShaft');
  const iron = M.iron({ color: '#4a4640', roughness: 0.45 }), black = M.ironBlack();
  const segs = [];
  const P = points.map((p) => new THREE.Vector3(...p));
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], len = a.distanceTo(b);
    const s = grp('seg'); s.position.copy(a).add(b).multiplyScalar(0.5);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    s.add(mesh(mergeG([cylG(r, r, len, 10), boxG(r * 3.2, 0.03, r * 3.2, 0, len * 0.25, 0, 0.002), boxG(r * 3.2, 0.03, r * 3.2, 0, -len * 0.25, 0, 0.002)]), iron));
    g.add(s); segs.push(s);
    if (post) for (const f of [0.25, 0.75]) {
      const q = a.clone().lerp(b, f);
      g.add(mesh(mergeG([boxG(0.08, 0.06, 0.08, q.x, q.y, q.z, 0.006), boxG(0.05, q.y - 0.03, 0.05, q.x, (q.y - 0.03) / 2, q.z, 0.004), boxG(0.14, 0.02, 0.14, q.x, 0.01, q.z, 0.004)]), black));
    }
  }
  for (let i = 1; i < P.length - 1; i++) { const q = P[i]; g.add(mesh(mergeG([boxG(0.13, 0.13, 0.13, q.x, q.y, q.z, 0.01), boxG(0.05, q.y - 0.065, 0.05, q.x, (q.y - 0.065) / 2, q.z, 0.004)]), black)); }
  let w = 0;
  g.userData.update = (dt) => { if (!w) return; for (const s of segs) s.rotateY(w * dt); };
  g.userData.setSpeed = (v) => { w = v; };
  g.userData.segments = segs;
  g.userData.keep = true;
  return g;
}

/**
 * The spare-gear shelf: a bracketed shelf on a short post with a slotted rail; three gears (16T, 24T, 32T) stand
 * in the slots, faces to +Z. Origin: floor centre of the post. userData: { gears {16, 24, 32}, home(T) (Vector3,
 * local), shelfY }.
 */
export function gearShelf({ module = 0.008 } = {}) {
  const g = grp('gearShelf');
  const sy = 0.86, wood = M.dustyWood({ tint: '#8a6a44' });
  g.add(mergeInto([boxG(0.07, sy, 0.07, 0, sy / 2, -0.12, 0.006), boxG(0.62, 0.03, 0.26, 0, sy + 0.015, 0, 0.004), boxG(0.62, 0.035, 0.02, 0, sy + 0.045, 0.06, 0.003), boxG(0.62, 0.035, 0.02, 0, sy + 0.045, -0.02, 0.003), boxG(0.3, 0.04, 0.3, 0, 0.02, -0.12, 0.004), tubeG([[0, sy - 0.25, -0.12], [0, sy - 0.02, 0.06]], 0.012, { radial: 5 })], wood));
  const label = textPlate('SPARES', 0.14, { style: 'card', pw: 384, ph: 96 }); label.position.set(0, sy + 0.015, 0.1315); g.add(label);
  const gears = {}, home = {};
  [[16, -0.2], [24, 0.0], [32, 0.21]].forEach(([T, x]) => {
    const gg = gear({ teeth: T, module, stamp: true });
    const r = module * T / 2 + module;
    gg.position.set(x, sy + 0.03 + r - 0.012, 0.02);
    gg.rotation.z = (T % 7) * 0.2;
    gg.userData.keep = true;
    g.add(gg); gears[T] = gg; home[T] = { position: gg.position.clone(), rotation: gg.rotation.clone(), parent: g };
  });
  g.userData.gears = gears; g.userData.home = home; g.userData.shelfY = sy;
  return g;
}

/**
 * Dried peas for the rain drum: an InstancedMesh living in the drum's (non-rotating) frame. setTumble(on): they ride
 * up the turning wall and cascade back down. Origin: the drum axis centre; axis along X.
 */
export function peas({ R = 0.22, L = 0.52, count = 70 } = {}) {
  const geo = new THREE.SphereGeometry(0.009, 6, 4), mat = M.matte('#7a8a3a', { roughness: 0.7 });
  const im = new THREE.InstancedMesh(geo, mat, count);
  im.castShadow = false; im.receiveShadow = false;
  const r = rng(29), seeds = Array.from({ length: count }, () => [r(), r(), r()]);
  const o = new THREE.Object3D();
  let on = false, k = 0, clock = 0;
  const place = () => {
    for (let i = 0; i < count; i++) {
      const [a, b, c] = seeds[i];
      const x = (a - 0.5) * L;
      let y, z;
      if (k < 0.01) { // at rest, a pile in the bottom
        const th = (b - 0.5) * 1.2; y = -Math.cos(th) * (R - 0.015) + c * 0.03; z = Math.sin(th) * (R - 0.015);
      } else {
        const ph = (clock * 0.55 + b) % 1;
        if (ph < 0.62) { const th = -0.6 + ph / 0.62 * 2.4; y = -Math.cos(th) * (R - 0.012); z = Math.sin(th) * (R - 0.012); }
        else { const f = (ph - 0.62) / 0.38, th0 = 1.8; const z0 = Math.sin(th0) * (R - 0.012), y0 = -Math.cos(th0) * (R - 0.012); z = z0 * (1 - f) + (c - 0.5) * 0.08 * f; y = y0 - (y0 + R - 0.02) * f * f; }
      }
      o.position.set(x, y, z); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  };
  place();
  im.userData.update = (dt) => { clock += dt; const tk = on ? 1 : 0; if (k === tk && !on) return; k = chase(k, tk, dt, 3); if (Math.abs(k - tk) < 0.002) k = tk; place(); };
  im.userData.setTumble = (b) => { on = !!b; };
  im.userData.keep = true;
  return noRay(im);
}

/**
 * Falling dust (normal blending, so it reads against the dark): sift(position, { spread, height, duration }).
 * One Points object reused. Add to the room group.
 */
export function dustFall({ count = 160, color = '#b8a88a', size = 0.02 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = makeCanvas(32, 32), cg = c.getContext('2d'), gr = cg.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cg.fillStyle = gr; cg.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({ color, size, transparent: true, depthWrite: false, opacity: 0, map: canvasTexture(c), sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 5;
  noRay(pts);
  let t = -1, dur = 2.5;
  pts.userData.sift = (p, { spread = 0.4, duration = 2.6 } = {}) => {
    dur = duration; t = 0; pts.visible = true;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = p[0] + (Math.random() - 0.5) * spread; pos[i * 3 + 1] = p[1] - Math.random() * 0.15; pos[i * 3 + 2] = p[2] + (Math.random() - 0.5) * spread;
      vel[i * 3] = (Math.random() - 0.5) * 0.06; vel[i * 3 + 1] = -(0.25 + Math.random() * 0.8); vel[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
      if (Math.random() < 0.3) vel[i * 3 + 1] *= 0.25; // the fine stuff hangs
    }
    geo.attributes.position.needsUpdate = true;
  };
  pts.userData.update = (dt) => {
    if (t < 0) return;
    t += dt;
    for (let i = 0; i < count; i++) { pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] = Math.max(0.01, pos[i * 3 + 1] + vel[i * 3 + 1] * dt); pos[i * 3 + 2] += vel[i * 3 + 2] * dt; }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = 0.75 * Math.min(1, t * 4) * (1 - clamp01((t - dur * 0.5) / (dur * 0.5)));
    if (t > dur) { t = -1; pts.visible = false; }
  };
  pts.userData.keep = true;
  return pts;
}

/**
 * A drip: a drop falls from `top` to the water surface at `bottom` every `every` seconds (jittered) and rings out.
 * Positions are local to wherever you add it. userData: { onDrip (callback), drip() }.
 */
export function drip({ top = [0, 2.6, 0], bottom = [0, 0.25, 0], every = 2.7 } = {}) {
  const g = grp('drip');
  const drop = mesh(new THREE.SphereGeometry(0.008, 8, 6).scale(1, 1.6, 1), new THREE.MeshStandardMaterial({ color: '#c8d4dc', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 }), { cast: false, receive: false });
  const ring = mesh(new THREE.RingGeometry(0.01, 0.016, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#d8e0e4', transparent: true, opacity: 0, depthWrite: false }), { cast: false, receive: false });
  ring.position.set(...bottom); ring.position.y += 0.002;
  g.add(noRay(drop), noRay(ring));
  let t = 0, next = every, rt = -1;
  const fallT = Math.sqrt(2 * (top[1] - bottom[1]) / 9.8);
  g.userData.update = (dt) => {
    t += dt;
    if (t > next) { t = 0; next = every * (0.8 + Math.random() * 0.4); }
    const f = t / fallT;
    if (f <= 1) { drop.visible = true; drop.position.set(top[0], top[1] - (top[1] - bottom[1]) * f * f, top[2]); }
    else { if (drop.visible) { drop.visible = false; rt = 0; g.userData.onDrip?.(); } }
    if (rt >= 0) { rt += dt; const k = rt / 1.1; ring.scale.setScalar(1 + k * 6); ring.material.opacity = 0.6 * (1 - k); if (k >= 1) { rt = -1; ring.material.opacity = 0; } }
  };
  g.userData.keep = true;
  return g;
}

// =====================================================================================================
// PAPER TEXTURES on the set (score pages, band plan, winch plate)
// =====================================================================================================

/** Two score pages for the conductor's desk: the Empress March with Pozzi's pencil letters under bar one. */
export function scoreTextures() {
  const stave = (g, w, y0, n = 5) => { g.strokeStyle = 'rgba(30,24,18,0.75)'; g.lineWidth = 1.6; for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(30, y0 + i * 9); g.lineTo(w - 30, y0 + i * 9); g.stroke(); } };
  const L = agedPaperTexture({ w: 384, h: 512, seed: 141, age: 0.45, key: 'pit-score-L', draw: (g, w, h) => {
    g.fillStyle = '#1e1610'; g.textAlign = 'center'; g.font = `30px ${FONTS.display}`; g.fillText('THE EMPRESS MARCH', w / 2, 60);
    g.font = `20px ${FONTS.fell}`; g.fillText('Overture — Pit Piano', w / 2, 90);
    for (let s = 0; s < 6; s++) stave(g, w, 130 + s * 62);
    // bar one: four rising notes, pencil letters under
    const ys = [130 + 36 + 4.5, 130 + 27, 130 + 18 - 4.5 + 4.5, 130 + 4.5];
    g.fillStyle = '#1a120c';
    [70, 120, 170, 220].forEach((x, i) => { g.beginPath(); g.ellipse(x, ys[i], 6, 4.5, -0.4, 0, TAU); g.fill(); g.fillRect(x + 5, ys[i] - 30, 1.6, 30); });
    g.fillStyle = 'rgba(70,70,80,0.85)'; g.font = `22px ${FONTS.hand}`;
    ['C', 'E', 'G', "C'"].forEach((l, i) => g.fillText(l, [70, 120, 170, 220][i], 196));
    g.font = `16px ${FONTS.hand}`; g.fillText('like going upstairs', 160, 222);
    g.fillStyle = 'rgba(30,24,18,0.7)';
    for (let s = 1; s < 6; s++) for (let k = 0; k < 9; k++) { const x = 50 + k * 34, y = 130 + s * 62 + ((k * 7 + s * 3) % 5) * 4.5; g.beginPath(); g.ellipse(x, y, 5, 4, -0.4, 0, TAU); g.fill(); }
  } });
  const R = agedPaperTexture({ w: 384, h: 512, seed: 142, age: 0.5, key: 'pit-score-R', draw: (g, w, h) => {
    for (let s = 0; s < 7; s++) stave(g, w, 60 + s * 62);
    g.fillStyle = 'rgba(30,24,18,0.7)';
    for (let s = 0; s < 7; s++) for (let k = 0; k < 9; k++) { const x = 50 + k * 34, y = 60 + s * 62 + ((k * 5 + s * 2) % 5) * 4.5; g.beginPath(); g.ellipse(x, y, 5, 4, -0.4, 0, TAU); g.fill(); }
  } });
  return [L, R];
}

/** The band plan as pinned on the stand: pencil circles 1–5 in a pit outline. */
export function bandPlanTexture() {
  return agedPaperTexture({ w: 384, h: 288, tint: '#f2ead4', seed: 151, age: 0.5, key: 'pit-bandplan', draw: (g, w, h) => {
    g.strokeStyle = 'rgba(70,70,80,0.85)'; g.fillStyle = 'rgba(70,70,80,0.85)'; g.lineWidth = 2.5;
    g.font = `22px ${FONTS.hand}`; g.textAlign = 'center';
    g.fillText('PIT — band', w / 2, 34);
    g.strokeRect(24, 60, w - 48, h - 100);
    g.font = `14px ${FONTS.hand}`; g.fillText('STAGE', w / 2, 56); g.fillText('STEPS', 50, h - 24); g.fillText('COND', w - 52, h - 24);
    for (let i = 0; i < 5; i++) { const x = 60 + i * 62, y = 140 + (i % 2) * 20; g.beginPath(); g.arc(x, y, 18, 0, TAU); g.stroke(); g.fillText(String(i + 1), x, y + 5); }
  } });
}

/** Multi-line enamel winch plate. */
export function winchPlate() {
  return textPlate('STAR TRAP\nHANDLE ALSO FITS FOYER CHANDELIER WINCH.\nRETURN IT. — H.P.', 0.38, { style: 'enamel', pw: 1024, ph: 360, bg: '#1a2a4a', fg: '#efe8d8' });
}

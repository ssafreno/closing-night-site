// The Stage: one-off props the shared catalogue does not have (SET-stage). Built from the catalogue's helpers and
// palette. Conventions as the catalogue: metres, origin on the floor, faces +Z unless noted.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import { mesh, noRay, grp, boxG, cylG, mergeG, mergeInto, tubeG, halo, TAU } from '../../engine/props/theatre/common.js';
import { makeCanvas, canvasTexture, rng } from '../../engine/props/textures.js';
import { FONTS, slateChalkTexture } from '../../engine/props/theatre-textures.js';

const LUMINOUS = '#b8ffd0'; // radium paint: a cold green-white

/** A canvas texture drawn by `draw(g, w, h)`. */
function canvasTex(w, h, draw, opts) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  draw(g, w, h);
  return canvasTexture(c, opts);
}

/**
 * Three floor dips (stage-floor power pockets) in a row along X: flush iron boxes with hinged lids (hinge at -Z, the
 * wall side), a bakelite two-pin socket inside, and luminous-paint numerals on each lid (12 cm tall) and on a brass
 * plate in front. Origin: centre of the middle box at floor level; the wall is at -Z.
 * userData: { dips: [{ group, lid (pivot: rotation.x, negative opens), socket (local Vector3, the plug seat),
 * numerals: [Mesh] }], setOpen(i, t), setGlow(k), spacing }.
 */
export function floorDips({ count = 3, spacing = 0.6, labels = ['1', '2', '3'] } = {}) {
  const g = grp('floorDips');
  const W = 0.34, D = 0.28;
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(LUMINOUS), transparent: true, toneMapped: false, depthWrite: false });
  const ironMat = M.iron({ color: '#2a2826', roughness: 0.6 });
  const frames = [], pits = [];
  g.userData.dips = [];
  labels.slice(0, count).forEach((label, i) => {
    const x = (i - (count - 1) / 2) * spacing;
    const d = grp(`dip${i + 1}`); d.position.x = x; g.add(d);
    // frame (flush) and the dark box below the floor
    frames.push(boxG(W + 0.05, 0.012, 0.025, x, 0.0, D / 2 + 0.012), boxG(W + 0.05, 0.012, 0.025, x, 0.0, -D / 2 - 0.012),
      boxG(0.025, 0.012, D, x - W / 2 - 0.012, 0.0, 0), boxG(0.025, 0.012, D, x + W / 2 + 0.012, 0.0, 0));
    pits.push(new THREE.BoxGeometry(W, 0.16, D).translate(x, -0.08, 0));
    // socket: a bakelite block with two brass-lined holes, on the box floor
    const sock = mesh(boxG(0.12, 0.05, 0.09, 0, -0.13, 0, 0.008), M.bakelite('#1a1410'));
    d.add(sock);
    d.add(mergeInto([cylG(0.007, 0.007, 0.004, 10, -0.02, -0.103, 0), cylG(0.007, 0.007, 0.004, 10, 0.02, -0.103, 0)], M.matte('#050404')));
    // the lid: pivot on the -Z edge
    const lid = grp('lid'); lid.position.set(0, 0.006, -D / 2); d.add(lid);
    lid.add(mesh(boxG(W - 0.006, 0.012, D - 0.006, 0, 0, D / 2, 0.003), ironMat));
    lid.add(mergeInto([boxG(W * 0.86, 0.003, 0.012, 0, 0.007, 0.04), boxG(W * 0.86, 0.003, 0.012, 0, 0.007, D - 0.04), cylG(0.012, 0.012, 0.03, 8, 0.12, 0, 0).rotateZ(Math.PI / 2)], M.iron({ color: '#3a3836' })));
    // luminous numeral on the lid (text top toward the hinge, so it reads upright from the stage and when raised)
    const numTex = canvasTex(128, 128, (cg, w, h) => {
      cg.clearRect(0, 0, w, h); cg.fillStyle = '#ffffff'; cg.font = `700 ${h * 0.9}px ${FONTS.display}`;
      cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.fillText(label, w / 2, h * 0.55);
    });
    const nm = glowMat.clone(); nm.map = numTex;
    const num = noRay(mesh(new THREE.PlaneGeometry(0.13, 0.13).rotateX(-Math.PI / 2), nm, { cast: false, receive: false }));
    num.position.set(0, 0.0075, D / 2); lid.add(num);
    // a second numeral on a plate in front of the dip (stays readable when the lid is up)
    const plate = mesh(boxG(0.12, 0.004, 0.09, 0, 0.002, D / 2 + 0.09, 0.002), M.brass());
    d.add(plate);
    const num2 = noRay(mesh(new THREE.PlaneGeometry(0.08, 0.08).rotateX(-Math.PI / 2), nm, { cast: false, receive: false }));
    num2.position.set(0, 0.0045, D / 2 + 0.09); d.add(num2);
    g.userData.dips.push({ group: d, lid, socket: new THREE.Vector3(x, -0.1, 0), numerals: [num, num2], mat: nm, label });
  });
  g.add(mergeInto(frames, M.iron({ color: '#4a4640', roughness: 0.5 })));
  // luminous paint round each frame (so the dips read as three faint green boxes from across the dark stage) and a
  // soft additive bloom on the floor round them
  const ringMat = glowMat.clone();
  const rings = [];
  labels.slice(0, count).forEach((_, i) => {
    const x = (i - (count - 1) / 2) * spacing, t = 0.014, y = 0.0065, hw = W / 2 + 0.032, hd = D / 2 + 0.032;
    rings.push(boxG(hw * 2, 0.001, t, x, y, hd), boxG(hw * 2, 0.001, t, x, y, -hd), boxG(t, 0.001, hd * 2, x - hw, y, 0), boxG(t, 0.001, hd * 2, x + hw, y, 0));
  });
  g.add(noRay(mesh(mergeG(rings), ringMat, { cast: false, receive: false })));
  const haloTex = canvasTex(64, 64, (cg, w, h) => {
    const gr = cg.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cg.fillStyle = gr; cg.fillRect(0, 0, w, h);
  });
  const haloMat = new THREE.MeshBasicMaterial({ map: haloTex, color: new THREE.Color(LUMINOUS), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const hm = noRay(mesh(new THREE.PlaneGeometry(spacing * (count - 1) + 0.9, 0.75).rotateX(-Math.PI / 2), haloMat, { cast: false, receive: false }));
  hm.position.y = 0.008; hm.renderOrder = 3; g.add(hm);
  g.add(mesh(mergeG(pits), new THREE.MeshStandardMaterial({ color: '#070606', roughness: 1, side: THREE.BackSide })));
  g.userData.setOpen = (i, t) => { const dp = g.userData.dips[i]; if (dp) dp.lid.rotation.x = -t * 1.85; };
  g.userData.setGlow = (k) => { for (const dp of g.userData.dips) dp.mat.color.set(LUMINOUS).multiplyScalar(0.25 + 1.6 * k); ringMat.color.set(LUMINOUS).multiplyScalar(0.15 + 0.9 * k); haloMat.opacity = 0.22 * k; hm.visible = k > 0.01; };
  g.userData.setGlow(1);
  g.userData.spacing = spacing;
  return g;
}

/**
 * One set of spike marks: four L-shaped corners of coloured cloth tape round a square of side `size` (the truck's
 * platform), flat on the floor. Origin: the set's centre. 1 draw call.
 */
export function spikeMarks({ color = '#3060c0', size = 1.5, arm = 0.26, tape = 0.05 } = {}) {
  const h = size / 2, geos = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    geos.push(boxG(arm, 0.003, tape, sx * (h - arm / 2), 0.0015, sz * (h - tape / 2), 0.001));
    geos.push(boxG(tape, 0.003, arm, sx * (h - tape / 2), 0.0015, sz * (h - arm / 2), 0.001));
  }
  // a small centre cross, as stage managers mark it
  geos.push(boxG(0.16, 0.003, 0.035, 0, 0.0015, 0, 0.001), boxG(0.035, 0.003, 0.16, 0, 0.0015, 0, 0.001));
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, emissive: color, emissiveIntensity: 0.22 });
  const m = mesh(mergeG(geos), mat, { cast: false, receive: true });
  m.name = 'spike';
  return m;
}

/** A word painted on the floor (white stage paint, scuffed). Lies flat, top of the text toward -Z. 1 draw call. */
export function floorWord(text, { w = 1.2, color = '#ece6d8', seed = 3 } = {}) {
  const pw = 1024, ph = 256, r = rng(seed);
  const tex = canvasTex(pw, ph, (g) => {
    g.clearRect(0, 0, pw, ph);
    g.fillStyle = color; g.font = `700 ${ph * 0.72}px ${FONTS.ui}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, pw / 2, ph * 0.54);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.6})`; g.fillRect(r() * pw, r() * ph, 2 + r() * 26, 1 + r() * 4); }
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.35, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = mesh(new THREE.PlaneGeometry(w, w * ph / pw).rotateX(-Math.PI / 2), mat, { cast: false, receive: true });
  m.position.y = 0.004;
  return m;
}

/**
 * The batten tag for line 7: a big canvas label stencilled in black on unbleached canvas, hung by two cords.
 * Origin: the top centre of the cords (tie it under the hem bar). Faces +Z. lines: text lines (each a line on the
 * tag). userData: { tag (Mesh), setLit(k) (an emissive lift so the stencil reads under the fly-rail lamp) }.
 */
export function battenTag({ lines = ['7 — GULL PT.', 'BACKCLOTH', '112 lb'], w = 2.4, h = 1.5, drop = 0.35 } = {}) {
  const g = grp('battenTag');
  const pw = 1024, ph = Math.round(pw * h / w), r = rng(7);
  const tex = canvasTex(pw, ph, (cg) => {
    cg.fillStyle = '#d8cfb4'; cg.fillRect(0, 0, pw, ph);
    for (let i = 0; i < 1400; i++) { cg.fillStyle = `rgba(${90 + r() * 40},${70 + r() * 30},${40 + r() * 20},${r() * 0.12})`; cg.fillRect(r() * pw, r() * ph, 1 + r() * 30, 1 + r() * 3); }
    cg.strokeStyle = 'rgba(60,40,20,0.5)'; cg.lineWidth = 10; cg.strokeRect(14, 14, pw - 28, ph - 28);
    cg.fillStyle = '#16120e'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
    const lh = (ph - 60) / lines.length;
    lines.forEach((t, i) => {
      let size = lh * 0.82; cg.font = `${size}px ${FONTS.display}`;
      while (cg.measureText(t).width > pw - 90 && size > 20) { size -= 4; cg.font = `${size}px ${FONTS.display}`; }
      cg.fillText(t, pw / 2, 30 + lh * (i + 0.55));
    });
    // stencil bridges and drips
    cg.globalCompositeOperation = 'destination-over';
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0 });
  const tag = mesh(new THREE.PlaneGeometry(w, h, 6, 3).translate(0, -h / 2 - drop, 0), mat, { cast: false, receive: false });
  // a slight belly in the canvas
  const p = tag.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / w + 0.5) * Math.PI) * 0.05);
  tag.geometry.computeVertexNormals();
  g.add(tag);
  g.add(mergeInto([cylG(0.006, 0.006, drop, 4, -w * 0.4, -drop / 2, 0), cylG(0.006, 0.006, drop, 4, w * 0.4, -drop / 2, 0),
    cylG(0.012, 0.012, w + 0.04, 6, 0, -drop, 0.0).rotateZ(Math.PI / 2)], M.matte('#8a7a5a')));
  g.userData.tag = tag;
  g.userData.setLit = (k) => { mat.emissiveIntensity = 0.12 * k; };
  return g;
}

/**
 * A small chalk slate for the line-7 running total. Origin: centre-back; faces +Z. ~0.36 × 0.26 m.
 * userData: { setTotal(lb) (redraws "<n> lb" in big chalk figures), face }.
 */
export function chalkSlate({ w = 0.36, h = 0.26 } = {}) {
  const g = grp('chalkSlate');
  g.add(mergeInto([boxG(w + 0.04, 0.02, 0.02, 0, h / 2 + 0.01, 0.01), boxG(w + 0.04, 0.02, 0.02, 0, -h / 2 - 0.01, 0.01),
    boxG(0.02, h, 0.02, -w / 2 - 0.01, 0, 0.01), boxG(0.02, h, 0.02, w / 2 + 0.01, 0, 0.01)], M.dustyWood({ tint: '#7a6248' })));
  const c = makeCanvas(512, 370), cg = c.getContext('2d');
  const tex = canvasTexture(c);
  const face = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), { cast: false });
  face.position.z = 0.012; g.add(face);
  const r = rng(5);
  const draw = (lb) => {
    cg.fillStyle = '#2c3236'; cg.fillRect(0, 0, 512, 370);
    for (let i = 0; i < 90; i++) { cg.fillStyle = `rgba(220,225,220,${r() * 0.06})`; cg.beginPath(); cg.ellipse(r() * 512, r() * 370, 20 + r() * 60, 6 + r() * 18, r() * 3, 0, TAU); cg.fill(); }
    cg.fillStyle = 'rgba(236,236,226,0.92)'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
    cg.font = `150px ${FONTS.hand}`; cg.fillText(`${lb} lb`, 256, 190);
    cg.font = `44px ${FONTS.hand}`; cg.fillStyle = 'rgba(236,236,226,0.6)'; cg.fillText('LINE 7', 256, 52);
    tex.needsUpdate = true;
  };
  draw(0);
  g.userData.setTotal = draw;
  g.userData.face = face;
  return g;
}

/** A brass bosun's whistle (call) on a lanyard, hung on a nail. Origin: the nail head on the wall; faces +Z. */
export function bosunWhistle() {
  const g = grp('bosunWhistle');
  g.add(mesh(cylG(0.004, 0.004, 0.05, 6, 0, 0, 0.025).rotateX(Math.PI / 2), M.iron()));
  const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([Math.sin(t * Math.PI) * 0.05, -t * 0.22, 0.04 + Math.sin(t * TAU) * 0.004]); }
  pts.push([0, -0.22, 0.04]);
  g.add(mesh(tubeG(pts, 0.0025, { radial: 4, seg: 30 }), M.matte('#e8dcc0')));
  const w = grp('whistle'); w.position.set(0.0, -0.27, 0.05); w.rotation.z = 0.5;
  w.add(mergeInto([
    cylG(0.006, 0.0075, 0.11, 10).rotateZ(Math.PI / 2),                                         // the gun (pipe)
    new THREE.SphereGeometry(0.018, 14, 10).translate(0.058, 0, 0),                                // the buoy
    tubeG([[-0.05, 0, 0], [-0.03, -0.03, 0], [0.02, -0.035, 0], [0.05, -0.02, 0]], 0.003, { radial: 5 }), // keel
  ], M.brass({ polished: true })));
  g.add(w);
  g.userData.whistle = w;
  return g;
}

/**
 * The ORCHESTRA hatch: an open floor trap with steps going down to the pit, a handrail on three sides and a hinged
 * leaf laid back. Origin: centre of the opening at floor level; w runs along X, d along Z; the steps descend toward -Z.
 * userData: { leaf, opening: { w, d } }.
 */
export function orchestraHatch({ w = 0.95, d = 1.5 } = {}) {
  const g = grp('orchestraHatch');
  const ironM = M.iron({ color: '#3a3836' });
  // edge frame + the dark well
  g.add(mergeInto([boxG(w + 0.06, 0.012, 0.03, 0, 0, d / 2 + 0.015), boxG(w + 0.06, 0.012, 0.03, 0, 0, -d / 2 - 0.015),
    boxG(0.03, 0.012, d, -w / 2 - 0.015, 0, 0), boxG(0.03, 0.012, d, w / 2 + 0.015, 0, 0)], ironM));
  g.add(mesh(new THREE.BoxGeometry(w, 2.4, d).translate(0, -1.2, 0), new THREE.MeshStandardMaterial({ color: '#060505', roughness: 1, side: THREE.BackSide }), { cast: false }));
  // steps down (along -Z from the +Z edge), timber treads on iron stringers
  const steps = [], str = [];
  for (let i = 0; i < 8; i++) steps.push(boxG(w - 0.08, 0.035, 0.22, 0, -0.19 - i * 0.19, d / 2 - 0.16 - i * 0.17, 0.004));
  for (const s of [-1, 1]) str.push(tubeG([[s * (w / 2 - 0.03), -0.05, d / 2 - 0.05], [s * (w / 2 - 0.03), -1.6, d / 2 - 1.45]], 0.02, { radial: 4, seg: 2 }));
  g.add(mergeInto(steps, M.dustyWood({ tint: '#5a4a38' })));
  g.add(mergeInto(str, ironM));
  // handrail round three sides (open at +Z, the top of the steps)
  const rail = [], hy = 0.95;
  const posts = [[-w / 2 - 0.08, d / 2 - 0.1], [-w / 2 - 0.08, -d / 2 - 0.08], [w / 2 + 0.08, -d / 2 - 0.08], [w / 2 + 0.08, d / 2 - 0.1]];
  for (const [x, z] of posts) rail.push(cylG(0.02, 0.022, hy, 8, x, hy / 2, z));
  rail.push(tubeG([[posts[0][0], hy, posts[0][1]], [posts[1][0], hy, posts[1][1]]], 0.022, { radial: 8, seg: 2, tension: 0 }));
  rail.push(tubeG([[posts[1][0], hy, posts[1][1]], [posts[2][0], hy, posts[2][1]]], 0.022, { radial: 8, seg: 2, tension: 0 }));
  rail.push(tubeG([[posts[2][0], hy, posts[2][1]], [posts[3][0], hy, posts[3][1]]], 0.022, { radial: 8, seg: 2, tension: 0 }));
  for (const [a, b] of [[0, 1], [1, 2], [2, 3]]) rail.push(tubeG([[posts[a][0], hy * 0.5, posts[a][1]], [posts[b][0], hy * 0.5, posts[b][1]]], 0.014, { radial: 6, seg: 2, tension: 0 }));
  g.add(mergeInto(rail, M.enamel('#c8a020', { roughness: 0.5 }))); // yellow safety rail, chipped
  // the leaf, laid back flat on the -Z side
  const leaf = mesh(boxG(w, 0.04, d * 0.6, 0, 0.02, -d / 2 - d * 0.3 - 0.06, 0.004), M.dustyWood({ tint: '#2a2622' }));
  g.add(leaf);
  // a dim glow from below (the pit's work light): an additive halo deep in the well
  const hs = halo('#ffc890', 1.4, 0.22); hs.position.set(0, -1.4, -0.2); g.add(hs);
  g.userData.leaf = leaf; g.userData.opening = { w, d }; g.userData.glow = hs;
  return g;
}

/** A coil of black stage cable lying on the floor. Origin: the coil centre. 1 draw call. */
export function cableCoil({ r = 0.22, turns = 4, seed = 4 } = {}) {
  const pts = [], rr = rng(seed);
  for (let i = 0; i <= turns * 40; i++) { const t = i / 40, a = t * TAU; const rad = r + (rr() - 0.5) * 0.02 + Math.sin(t * 1.3) * 0.015; pts.push([Math.cos(a) * rad, 0.012 + (i % 40 < 20 ? 0 : 0.01) + Math.floor(t) * 0.004, Math.sin(a) * rad]); }
  pts.push([r + 0.3, 0.01, 0.1], [r + 0.7, 0.01, 0.35]);
  return mesh(tubeG(pts, 0.009, { radial: 5, seg: turns * 60 }), M.bakelite('#14110f'));
}

/**
 * A slack stage cable on the floor from `a` to `b` (room coordinates; both on the floor), wandering a little, rising
 * at the ends to `aY` / `bY`. Returns a Mesh (1 draw call). Used for the ghost light's run to a dip.
 */
export function floorCable(a, b, { aY = 0.012, bY = 0.012, r = 0.008, seed = 2, wander = 0.25 } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), rr = rng(seed);
  const n = Math.max(6, Math.round(A.distanceTo(B) / 0.6));
  const side = new THREE.Vector3(B.z - A.z, 0, A.x - B.x).normalize();
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = A.clone().lerp(B, t);
    const k = Math.sin(t * Math.PI);
    p.addScaledVector(side, k * (Math.sin(t * 7 + seed) * 0.5 + (rr() - 0.5) * 0.6) * wander);
    p.y = i === 0 ? aY : i === n ? bY : 0.01;
    pts.push([p.x, p.y, p.z]);
  }
  return mesh(tubeG(pts, r, { radial: 5, seg: n * 8 }), M.bakelite('#14110f'), { cast: false });
}

/**
 * Lavinia's shimmer (the dark state): a faint lilac column of light with slow drifting glints. Origin: the floor
 * point. userData: { setLevel(0..1) (fades it), update }.
 */
export function shimmer({ h = 1.8, color = '#cdb8ff' } = {}) {
  const g = grp('shimmer');
  const c = makeCanvas(64, 256), cg = c.getContext('2d');
  // a soft vertical wisp: gaussian across, a long taper top and bottom (no hard edges anywhere)
  const img = cg.createImageData(64, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
    const u = (x - 31.5) / 32, v = y / 255;
    const across = Math.exp(-u * u * 7);
    const along = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (v - 0.04) / 0.92))), 1.6) * (0.55 + 0.45 * Math.exp(-((v - 0.45) ** 2) * 9));
    const a = across * along, i = (y * 64 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * a);
  }
  cg.putImageData(img, 0, 0);
  const tex = canvasTexture(c);
  const mats = [];
  const planes = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const p = noRay(mesh(new THREE.PlaneGeometry(0.75, h * 1.25).translate(0, h * 0.62, 0), m, { cast: false, receive: false }));
    p.rotation.y = i * Math.PI / 2; p.renderOrder = 4;
    g.add(p); mats.push(m); planes.push(p);
  }
  const hs = halo(color, 0.9, 0.45); hs.position.y = h * 0.7; g.add(hs);
  // glints: a few points that rise and fade
  const N = 26, pos = new Float32Array(N * 3), seeds = [], r = rng(13);
  for (let i = 0; i < N; i++) seeds.push([r() * TAU, 0.08 + r() * 0.22, r(), 0.15 + r() * 0.25]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ color, size: 0.035, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const pts = noRay(new THREE.Points(geo, pm)); pts.renderOrder = 5; g.add(pts);
  let level = 1, target = 1;
  g.userData.setLevel = (k, instant) => { target = k; if (instant) level = k; };
  g.userData.update = (dt, t) => {
    level += (target - level) * Math.min(1, dt * 2.5);
    g.visible = level > 0.01;
    if (!g.visible) return;
    const breathe = 0.75 + 0.25 * Math.sin(t * 1.3) + 0.1 * Math.sin(t * 3.1);
    mats.forEach((m, i) => { m.opacity = 0.26 * level * breathe; });
    planes.forEach((p, i) => { p.rotation.y = i * Math.PI / 2 + t * 0.15; p.scale.x = 1 + 0.15 * Math.sin(t * 0.9 + i); });
    hs.material.opacity = 0.4 * level * breathe;
    pm.opacity = 0.9 * level;
    for (let i = 0; i < N; i++) {
      const [a, rad, ph, sp] = seeds[i];
      const k = (t * sp + ph) % 1;
      pos[i * 3] = Math.cos(a + t * 0.4) * rad; pos[i * 3 + 1] = 0.2 + k * h * 1.1; pos[i * 3 + 2] = Math.sin(a + t * 0.4) * rad;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return g;
}

/**
 * Rain streaks crossing a light (finale storm): a tall additive plane with a scrolling streak texture.
 * Origin: bottom centre. userData: { setLevel(0..1) }.
 */
export function rainCurtain({ w = 10, h = 8, map = null, color = '#cfe0ff' } = {}) {
  const g = grp('rainCurtain');
  const tex = map.clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(w / 1.5, h / 2.5); tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const m = noRay(mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), mat, { cast: false, receive: false }));
  m.renderOrder = 6; g.add(m);
  let level = 0, target = 0;
  g.userData.setLevel = (k, instant) => { target = k; if (instant) level = k; };
  g.userData.update = (dt) => {
    level += (target - level) * Math.min(1, dt * 2);
    m.visible = level > 0.01;
    if (!m.visible) return;
    mat.opacity = 0.35 * level; tex.offset.y += dt * 2.2; tex.offset.x += dt * 0.15;
  };
  return g;
}

/** A painted enamel direction sign with an arrow ('DRESSING ROOMS →'). Use the catalogue's enamelSign for plain ones. */
export function arrowSign(text, { w = 0.9, h = 0.2, bg = '#e8dfc8', fg = '#1c1a18', arrow = 1 } = {}) {
  const pw = 1024, ph = Math.round(pw * h / w);
  const tex = canvasTex(pw, ph, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, pw, ph);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(10, 10, pw - 20, ph - 20);
    g.fillStyle = fg; g.font = `700 ${ph * 0.5}px ${FONTS.ui}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text + (arrow > 0 ? '  →' : arrow < 0 ? '' : ''), pw / 2 + (arrow < 0 ? ph * 0.3 : 0), ph * 0.55);
    if (arrow < 0) { g.font = `700 ${ph * 0.5}px ${FONTS.ui}`; g.textAlign = 'left'; g.fillText('←', 26, ph * 0.55); }
  });
  return mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.1 }), { cast: false });
}

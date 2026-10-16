// Fixtures and small things (PROPS): theatre doors, pigeonholes, call board, hutch window, coin meter, radiators and
// pipes, rain-on-glass panes, pendant lamps, festoons, the ledger, number wheels, keys, tags, tins, teacups, a sofa.
import { THREE, M, TAU, mesh, noRay, grp, at, boxG, cylG, latheG, mergeG, mergeInto, tubeG, catenary, textPlate, texPlane, bulbSet, halo, chase, instances, rng } from './common.js';
import { labelPlate, ledgerPageTexture, numberBandTexture, rainStreakTexture, dialTexture, FONTS, clothTexture, agedPaperTexture } from '../theatre-textures.js';
import { makeCanvas, canvasTexture } from '../textures.js';

// =====================================================================================================
// NUMBER WHEELS (shared component: ticket machine, jewel case, key press, safe register)
// =====================================================================================================

const wheelGeo = new Map();
/**
 * A row of number wheels (cylinders printed 0–9 round their rim) on a common axle along X. Each wheel turns about
 * X; the digit facing +Z is its value. Origin: centre of the axle. opts: count, digits (10), r (wheel radius), width,
 * gap, bg/fg (band colours), engraved (brass look), values (initial), face (ENGINE-FIX: radians above the front at which
 * the value is centred, for a close-up that looks down on the wheels; 0 = straight on).
 * userData: { wheels[i] (Mesh, rotation.x), values[], setValue(i, v, instant), step(i, ±1), animating(),
 * wheelX(i) }. Wheels ease to their targets in update(). Cost: 1 draw call per wheel (+1 axle).
 */
export function numberWheels({ count = 3, digits = 10, r = 0.03, width = 0.025, gap = 0.006, bg = '#c9a24a', fg = '#1a1208', engraved = true, values = null, axle = true, face = 0 } = {}) {
  const g = grp('numberWheels');
  const key = `${r}:${width}:${digits}`;
  if (!wheelGeo.has(key)) {
    const geo = new THREE.CylinderGeometry(r, r, width, digits * 4, 1, true).rotateZ(Math.PI / 2); // open: 1 draw per wheel
    wheelGeo.set(key, geo);
  }
  const tex = numberBandTexture({ digits, bg, fg, engraved });
  // CylinderGeometry: u runs round the rim; the band texture runs its digits along V, so rotate UVs on the side
  const band = tex.clone(); band.center.set(0.5, 0.5); band.rotation = -Math.PI / 2; band.needsUpdate = true; // -π/2 (not +π/2): +π/2 showed digit 9-v upside down at the front
  // ENGINE-FIX: the cells are centred half a cell off the front (θ = 0 showed the line between v and v+1, the digit
  // half a cell high); shift the band half a cell and let it wrap (clamped, the shift smeared a dark stripe across the 0).
  // Was patched locally in src/rooms/door/keypress.js.
  band.offset.y = 0.5 / digits; band.wrapS = band.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: band, metalness: engraved ? 0.6 : 0, roughness: engraved ? 0.35 : 0.6 });
  const capMat = engraved ? M.tarnishedBrass({ amount: 0.3 }) : M.matte(bg);
  const pitch = width + gap, x0 = -(count - 1) * pitch / 2;
  const vals = values ? values.slice() : new Array(count).fill(0), target = vals.map((v) => v), cur = vals.map((v) => v);
  g.userData.wheels = [];
  // angle for digit v: the band places digit i centred at the i-th cell from the bottom; after the UV rotation the
  // cells run round the rim. Facing +Z (θ = 0) shows cell 0 at rest; each digit is 2π/digits further.
  const angle = (v) => (v / digits) * TAU - face;
  for (let i = 0; i < count; i++) {
    const w = mesh(wheelGeo.get(key), mat);
    w.position.x = x0 + i * pitch;
    w.rotation.x = angle(vals[i]);
    g.add(w); g.userData.wheels.push(w);
  }
  // the wheel sides: static discs (they are round, so they need not turn with the wheels) + the axle, one mesh
  const sides = [];
  // ENGINE-FIX: inside the band's facets at any turn (at 0.999 r a disc rim poked through mid-facet as dark ticks whenever
  // a wheel stood between digits, e.g. with `face`)
  const rs = r * Math.cos(Math.PI / (digits * 4)) * 0.998;
  for (let i = 0; i < count; i++) for (const sd of [-1, 1]) sides.push(cylG(rs, rs, 0.0012, digits * 4).rotateZ(Math.PI / 2).translate(x0 + i * pitch + sd * (width / 2 - 0.0006), 0, 0));
  if (axle) sides.push(cylG(r * 0.15, r * 0.15, count * pitch + 0.02, 8).rotateZ(Math.PI / 2));
  g.add(mergeInto(sides, capMat));
  g.userData.values = vals;
  g.userData.wheelX = (i) => x0 + i * pitch;
  g.userData.setValue = (i, v, instant = false) => { v = ((v % digits) + digits) % digits; vals[i] = v; target[i] = cur[i] + ((v - cur[i]) % digits + digits) % digits; if (instant) { cur[i] = target[i]; g.userData.wheels[i].rotation.x = angle(cur[i]); } };
  g.userData.step = (i, d = 1) => { vals[i] = ((vals[i] + d) % digits + digits) % digits; target[i] += d; };
  g.userData.animating = () => target.some((t, i) => Math.abs(t - cur[i]) > 0.002);
  g.userData.update = (dt) => {
    for (let i = 0; i < count; i++) if (Math.abs(target[i] - cur[i]) > 0.001) { cur[i] = chase(cur[i], target[i], dt, 12); g.userData.wheels[i].rotation.x = angle(cur[i]); }
  };
  return g;
}

// =====================================================================================================
// DOORS
// =====================================================================================================

/**
 * A theatre door in its frame. style: 'panel' (four-panel painted), 'iron' (green iron-bound pass door, studs,
 * brass plates), 'padded' (buttoned leather auditorium door), 'maroon' (the stage door: maroon gloss, wired-glass
 * fanlight). window: 'porthole' | 'wired' | null. plates: e.g. ['PUSH'] brass finger plate text; color override.
 * double: a pair of leaves. Origin: floor centre of the doorway, on the wall plane; the leaf opens toward -Z
 * (push side at +Z). userData: { leaves[] (pivots: rotation.y), setOpen(0..1), handle, frameW, frameH, opening:
 * { w, h }, glass (or null) }. Cost: 4–8 draw calls.
 */
export function theatreDoor({ style = 'panel', w = 0.9, h = 2.1, double = false, window = null, plates = [], color = null, fanlight = false, frame = true } = {}) {
  const g = grp('theatreDoor');
  const leafW = double ? w / 2 : w, t = 0.05;
  const col = color || { panel: '#3a4a3a', iron: '#24402e', padded: '#5a1a1c', maroon: '#5a1a1c' }[style];
  const paint = style === 'padded' ? M.leather(col) : M.enamel(col, { roughness: 0.35 });
  if (frame) {
    const fr = [boxG(0.1, h + 0.1, 0.16, -w / 2 - 0.05, (h + 0.1) / 2, 0, 0.01), boxG(0.1, h + 0.1, 0.16, w / 2 + 0.05, (h + 0.1) / 2, 0, 0.01), boxG(w + 0.2, 0.1, 0.16, 0, h + 0.05, 0, 0.01)];
    if (fanlight) fr.push(boxG(w + 0.2, 0.08, 0.16, 0, h + 0.5, 0, 0.01), boxG(0.1, 0.45, 0.16, -w / 2 - 0.05, h + 0.3, 0, 0.01), boxG(0.1, 0.45, 0.16, w / 2 + 0.05, h + 0.3, 0, 0.01));
    g.add(mergeInto(fr, style === 'iron' || style === 'maroon' ? M.enamel('#2a2420', { roughness: 0.5 }) : M.wood({ tint: '#3a2416' })));
  }
  let glassMesh = null;
  if (fanlight) {
    glassMesh = mesh(new THREE.PlaneGeometry(w, 0.36), wiredGlass(), { cast: false }); glassMesh.position.set(0, h + 0.28, 0); g.add(glassMesh);
  }
  g.userData.leaves = [];
  const mkLeaf = (side) => {
    const L = grp('leaf'); L.position.set(side * w / 2, 0, 0);
    const dir = -side; // leaf extends from the hinge toward the centre
    const cx = dir * leafW / 2;
    const parts = [];
    // window hole handled as a separate inset mesh; the leaf is a slab with mouldings
    parts.push(boxG(leafW - 0.006, h - 0.01, t, cx, h / 2, 0, 0.006));
    if (style === 'panel' || style === 'maroon') {
      const ph = window ? [[0.3, 0.55]] : [[0.25, 0.75], [1.15, 0.8]];
      for (const [y0, hh] of ph) for (const sx of [-1, 1]) parts.push(boxG(leafW * 0.34, hh, 0.012, cx + sx * leafW * 0.21, y0 + hh / 2, t / 2 + 0.004, 0.012));
    }
    L.add(mergeInto(parts, paint));
    if (style === 'iron') {
      const iron = [];
      for (const y of [0.25, h / 2, h - 0.25]) iron.push(boxG(leafW - 0.04, 0.06, 0.012, cx, y, t / 2 + 0.006, 0.004));
      for (const y of [0.25, h / 2, h - 0.25]) for (let k = 0; k < 6; k++) iron.push(new THREE.SphereGeometry(0.009, 6, 4).translate(cx - leafW / 2 + 0.06 + k * (leafW - 0.12) / 5, y, t / 2 + 0.013));
      L.add(mergeInto(iron, M.ironBlack()));
    }
    if (style === 'padded') {
      const b = [];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) if ((i + j) % 2 === 0) b.push({ p: [cx - leafW * 0.36 + i * leafW * 0.24, 0.3 + j * (h - 0.6) / 6, t / 2 + 0.004] });
      L.add(instances(new THREE.SphereGeometry(0.012, 8, 6), M.brass(), b));
      L.add(mergeInto([boxG(leafW - 0.02, 0.02, 0.012, cx, 0.12, t / 2 + 0.004, 0.003), boxG(leafW - 0.02, 0.02, 0.012, cx, h - 0.12, t / 2 + 0.004, 0.003)], M.brass()));
    }
    if (window === 'porthole') {
      const pr = 0.14, py = h * 0.7;
      L.add(mesh(new THREE.TorusGeometry(pr, 0.02, 10, 32).translate(cx, py, t / 2 + 0.01), M.brass()));
      L.add(mesh(new THREE.TorusGeometry(pr, 0.02, 10, 32).translate(cx, py, -t / 2 - 0.01), M.brass()));
      const gm = mesh(new THREE.CircleGeometry(pr, 32).translate(cx, py, 0), M.glass({ color: '#c8d4d8', opacity: 0.35 }), { cast: false });
      L.add(gm); glassMesh = gm;
    } else if (window === 'wired') {
      const ww = leafW * 0.55, wh = 0.5, wy = h * 0.72;
      const gm = mesh(new THREE.PlaneGeometry(ww, wh).translate(cx, wy, t / 2 + 0.002), wiredGlass(), { cast: false });
      L.add(gm); glassMesh = gm;
      L.add(mergeInto([boxG(ww + 0.04, 0.02, 0.01, cx, wy + wh / 2 + 0.01, t / 2 + 0.006, 0.003), boxG(ww + 0.04, 0.02, 0.01, cx, wy - wh / 2 - 0.01, t / 2 + 0.006, 0.003), boxG(0.02, wh, 0.01, cx - ww / 2 - 0.01, wy, t / 2 + 0.006, 0.003), boxG(0.02, wh, 0.01, cx + ww / 2 + 0.01, wy, t / 2 + 0.006, 0.003)], paint));
    }
    // furniture: a knob or pull, a finger plate, a kick plate
    const brass = [];
    const hx = cx + dir * (leafW / 2 - 0.08);
    brass.push(latheG([[0, 0], [0.012, 0], [0.012, 0.03], [0.03, 0.045], [0.032, 0.065], [0, 0.07]], 16).rotateX(Math.PI / 2).translate(hx, 1.0, t / 2));
    brass.push(latheG([[0, 0], [0.012, 0], [0.012, 0.03], [0.03, 0.045], [0.032, 0.065], [0, 0.07]], 16).rotateX(-Math.PI / 2).translate(hx, 1.0, -t / 2));
    brass.push(boxG(0.04, 0.12, 0.004, hx, 1.0, t / 2 + 0.002, 0.002));
    if (style !== 'padded') brass.push(boxG(leafW - 0.06, 0.2, 0.003, cx, 0.12, t / 2 + 0.002, 0.002));
    L.add(mergeInto(brass, M.tarnishedBrass({ amount: 0.4 })));
    plates.forEach((txt, i) => { const p = textPlate(txt, 0.16, { style: 'brass', pw: 384, ph: 128 }); p.position.set(cx + dir * (leafW / 2 - 0.12) * 0.6, 1.25 + i * 0.07, t / 2 + 0.004); L.add(p); });
    L.userData.handlePos = new THREE.Vector3(hx, 1.0, t / 2 + 0.05);
    g.add(L); g.userData.leaves.push(L);
    return L;
  };
  mkLeaf(-1); if (double) mkLeaf(1);
  g.add(mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, -0.12), M.matte('#050404'), { cast: false })); // the dark beyond
  g.userData.setOpen = (tt) => { g.userData.leaves.forEach((L, i) => { L.rotation.y = (i === 0 ? -1 : 1) * 1.45 * tt; }); };
  g.userData.handle = g.userData.leaves[0].userData.handlePos;
  g.userData.frameW = w + 0.2; g.userData.frameH = h + 0.1; g.userData.opening = { w, h }; g.userData.glass = glassMesh;
  return g;
}

let wiredTex = null;
/** Georgian wired glass (a frosted pane with a square wire mesh). Shared material. */
export function wiredGlass() {
  if (!wiredTex) {
    const s = 256, c = makeCanvas(s, s), g = c.getContext('2d');
    g.fillStyle = 'rgba(200,210,205,0.55)'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(40,40,36,0.8)'; g.lineWidth = 2;
    for (let i = 0; i <= s; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
    const t = canvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
    wiredTex = new THREE.MeshPhysicalMaterial({ map: t, transparent: true, roughness: 0.55, clearcoat: 0.6, depthWrite: false, side: THREE.DoubleSide });
  }
  return wiredTex;
}

// =====================================================================================================
// PIGEONHOLES, CALL BOARD, HUTCH WINDOW, COIN METER
// =====================================================================================================

/**
 * Pigeonholes: a pine case of cols × rows open boxes with card name labels under each; optional letters in some.
 * labels: array (row-major from the top-left). Origin: centre-back; faces +Z.
 * userData: { slotPos(row, col) → Vector3 local (centre of the hole's mouth), cell: { w, h, d } }. Cost: 3–4 draw calls.
 */
export function pigeonholes({ cols = 4, rows = 3, cw = 0.24, ch = 0.18, d = 0.28, labels = [], letters = [], seed = 3 } = {}) {
  const g = grp('pigeonholes');
  const W = cols * cw, H = rows * ch, t = 0.015, r = rng(seed);
  const parts = [boxG(W + t, H + t, t, 0, 0, t / 2, 0.003)];
  for (let i = 0; i <= rows; i++) parts.push(boxG(W + t, t, d, 0, -H / 2 + i * ch, d / 2, 0.003));
  for (let j = 0; j <= cols; j++) parts.push(boxG(t, H + t, d, -W / 2 + j * cw, 0, d / 2, 0.003));
  parts.push(boxG(W + 0.06, 0.04, d + 0.03, 0, H / 2 + 0.03, d / 2, 0.006));
  g.add(mergeInto(parts, M.oak({ tint: '#8a6a44' })));
  if (labels.length) {
    const lw = 256, lh = 64, c = makeCanvas(lw * cols, lh * rows), cg = c.getContext('2d');
    const geos = [];
    labels.forEach((txt, k) => {
      const i = Math.floor(k / cols), j = k % cols;
      cg.drawImage(labelPlate(txt || '', { style: 'card', w: lw, h: lh, seed: seed + k }).image, j * lw, i * lh);
      const p = new THREE.PlaneGeometry(cw * 0.7, cw * 0.7 * lh / lw); const uv = p.attributes.uv;
      for (let q = 0; q < uv.count; q++) uv.setXY(q, (j + uv.getX(q)) / cols, 1 - (i + 1 - uv.getY(q)) / rows);
      geos.push(p.translate(-W / 2 + (j + 0.5) * cw, H / 2 - (i + 1) * ch + t / 2 + 0.002 - 0.022, d + 0.002));
    });
    g.add(mesh(mergeG(geos), new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.8 }), { cast: false }));
  }
  if (letters.length) {
    const list = letters.map(([i, j], k) => ({ p: [-W / 2 + (j + 0.5) * cw + (r() - 0.5) * 0.04, H / 2 - (i + 1) * ch + t / 2 + 0.06, d * 0.55], r: [-1.2 + r() * 0.3, (r() - 0.5) * 0.4, (r() - 0.5) * 0.2], s: [cw * 0.6, 0.12, 1], c: ['#efe6d0', '#e0d0b0', '#f4ecd8'][k % 3] }));
    g.add(instances(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), list));
  }
  g.userData.slotPos = (i, j) => new THREE.Vector3(-W / 2 + (j + 0.5) * cw, H / 2 - (i + 0.5) * ch, d);
  g.userData.cell = { w: cw, h: ch, d };
  return g;
}

/**
 * Call board: a green baize board in an oak frame with a header plate; pin papers with addPaper(tex, x, y, opts).
 * x, y in metres from the board centre; opts: { w, h, rot, pins (1|2|4), curl }. Origin: centre-back; faces +Z.
 * userData: { addPaper(tex, x, y, opts) → Mesh, papers[], face (Mesh) }. Cost: 3 draw calls + 1 per paper.
 */
export function callBoard({ w = 1.2, h = 0.9, title = 'CALL BOARD' } = {}) {
  const g = grp('callBoard');
  g.add(mergeInto([boxG(w + 0.1, 0.05, 0.04, 0, h / 2 + 0.025, 0.02, 0.01), boxG(w + 0.1, 0.05, 0.04, 0, -h / 2 - 0.025, 0.02, 0.01), boxG(0.05, h, 0.04, -w / 2 - 0.025, 0, 0.02, 0.01), boxG(0.05, h, 0.04, w / 2 + 0.025, 0, 0.02, 0.01), boxG(w + 0.14, 0.03, 0.08, 0, -h / 2 - 0.06, 0.04, 0.006)], M.oak({ tint: '#5a3a20' })));
  const face = mesh(new THREE.PlaneGeometry(w, h).translate(0, 0, 0.012), M.baize());
  g.add(face);
  if (title) { const p = textPlate(title, 0.36, { style: 'brass', pw: 512, ph: 96 }); p.position.set(0, h / 2 + 0.025, 0.042); g.add(p); }
  g.userData.papers = [];
  const pinMat = M.enamel('#b02a20', { roughness: 0.3 });
  const pinGeo = mergeG([new THREE.SphereGeometry(0.008, 8, 6).translate(0, 0, 0.008), cylG(0.0015, 0.0015, 0.01, 4).rotateX(Math.PI / 2)]);
  g.userData.addPaper = (tex, x, y, { w: pw = 0.21, h: ph = 0.297, rot = 0, pins = 1, curl = 0.02 } = {}) => {
    const geo = new THREE.PlaneGeometry(pw, ph, 4, 4), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const yy = p.getY(i) / (ph / 2), xx = p.getX(i) / (pw / 2); p.setZ(i, curl * Math.max(0, -yy) ** 2 * (0.6 + 0.4 * Math.abs(xx))); }
    geo.computeVertexNormals();
    const m = mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }), { cast: false });
    m.position.set(x, y, 0.014 + g.userData.papers.length * 0.0012); m.rotation.z = rot;
    const pp = pins === 4 ? [[-1, 1], [1, 1], [-1, -1], [1, -1]] : pins === 2 ? [[-1, 1], [1, 1]] : [[0, 1]];
    for (const [sx, sy] of pp) { const pin = new THREE.Mesh(pinGeo, pinMat); pin.position.set(sx * (pw / 2 - 0.015), sy * (ph / 2 - 0.015), 0.001); m.add(pin); }
    g.add(m); g.userData.papers.push(m);
    return m;
  };
  g.userData.face = face;
  return g;
}

/**
 * Doorkeeper's hutch window: a glazed sliding sash in a booth front with a ledge, a brass bell push and a card.
 * Origin: floor centre of the booth front; the visitor is at +Z. w/h: the booth front.
 * userData: { sash (slide along X: sash.position.x), setOpen(0..1), ledgeY, inside (Vector3), card }. ~6 draw calls.
 */
export function hutchWindow({ w = 1.4, h = 2.3, card = 'ENQUIRIES' } = {}) {
  const g = grp('hutchWindow');
  const ww = 0.7, wh = 0.55, wy = 1.1;
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
  const hole = new THREE.Path(); hole.moveTo(-ww / 2, wy); hole.lineTo(ww / 2, wy); hole.lineTo(ww / 2, wy + wh); hole.lineTo(-ww / 2, wy + wh); hole.closePath(); s.holes.push(hole);
  const front = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false });
  const paintMat = M.enamel('#3a4a3a', { roughness: 0.5 });
  g.add(mesh(front, paintMat));
  g.add(mergeInto([boxG(w * 0.8, 0.6, 0.02, 0, 0.45, 0.07, 0.01), boxG(ww + 0.12, 0.04, 0.25, 0, wy - 0.02, 0.1, 0.008), boxG(ww + 0.08, 0.05, 0.05, 0, wy + wh + 0.03, 0.07, 0.008), boxG(0.05, wh + 0.1, 0.05, -ww / 2 - 0.03, wy + wh / 2, 0.07, 0.008), boxG(0.05, wh + 0.1, 0.05, ww / 2 + 0.03, wy + wh / 2, 0.07, 0.008)], M.wood({ tint: '#4a3020' })));
  // two sashes in a track: the right one slides left over the fixed left one
  const sashMat = M.wood({ tint: '#4a3020' });
  const mkSash = (z) => {
    const S = grp('sash');
    S.add(mergeInto([boxG(ww / 2 + 0.02, 0.03, 0.02, 0, wh / 2 - 0.015, 0, 0.004), boxG(ww / 2 + 0.02, 0.03, 0.02, 0, -wh / 2 + 0.015, 0, 0.004), boxG(0.03, wh, 0.02, -ww / 4, 0, 0, 0.004), boxG(0.03, wh, 0.02, ww / 4, 0, 0, 0.004)], sashMat));
    S.add(mesh(new THREE.PlaneGeometry(ww / 2, wh - 0.04), M.glass({ color: '#d8e0dc', opacity: 0.22 }), { cast: false }));
    S.position.set(0, wy + wh / 2, z);
    return S;
  };
  const fixed = mkSash(0.025); fixed.position.x = -ww / 4; g.add(fixed);
  const sash = mkSash(0.045); sash.position.x = ww / 4; g.add(sash);
  sash.add(at(mesh(boxG(0.012, 0.06, 0.02, 0, 0, 0, 0.004), M.brass()), ww / 4 - 0.04, 0, 0.015));
  g.add(at(mesh(mergeG([cylG(0.03, 0.035, 0.015, 16).rotateX(Math.PI / 2), new THREE.SphereGeometry(0.012, 8, 6).translate(0, 0, 0.012)]), M.brass()), ww / 2 + 0.15, wy + 0.15, 0.07));
  const cardM = textPlate(card, 0.22, { style: 'card', pw: 384, ph: 128 }); cardM.position.set(0, wy + wh + 0.12, 0.065); g.add(cardM);
  g.userData.sash = sash;
  g.userData.setOpen = (t) => { sash.position.x = ww / 4 - (ww / 2 - 0.02) * t; };
  g.userData.ledgeY = wy + 0.0; g.userData.inside = new THREE.Vector3(0, wy + 0.2, -0.4); g.userData.card = cardM;
  return g;
}

/**
 * Shilling gas/electric coin meter: a cast-iron box with a coin slot, a window showing a credit dial, a two-spoke
 * turn handle and a padlocked cash box below. Origin: centre-back (wall); faces +Z.
 * userData: { handle (rotation.z), slotPos (Vector3), dial (needle Mesh: rotation.z), setCredit(0..1) }. ~7 draw calls.
 */
export function coinMeter({ label = '1/- IN THE SLOT' } = {}) {
  const g = grp('coinMeter');
  const w = 0.3, h = 0.42, d = 0.18;
  const iron = M.ironBlack();
  g.add(mergeInto([boxG(w, h, d, 0, 0, d / 2, 0.02), boxG(w + 0.03, 0.03, d + 0.02, 0, h / 2, d / 2, 0.01), boxG(w * 0.8, 0.12, 0.02, 0, -h / 2 + 0.08, d + 0.01, 0.01), latheG([[0, 0], [0.045, 0], [0.05, 0.03], [0, 0.03]], 16).rotateX(Math.PI / 2).translate(0, 0.02, d)], M.enamel('#2e3a32', { roughness: 0.5 })));
  // slot plate
  g.add(mergeInto([boxG(0.1, 0.05, 0.012, 0, h / 2 - 0.07, d + 0.006, 0.004)], M.brass()));
  g.add(at(mesh(new THREE.PlaneGeometry(0.03, 0.004), M.matte('#000')), 0, h / 2 - 0.07, d + 0.0125));
  // dial window
  const dial = mesh(new THREE.CircleGeometry(0.055, 32), new THREE.MeshStandardMaterial({ map: dialTexture({ numbers: 0, labels: ['0', '¼', '½', '¾', '1/-'], arc: [-120, 120], ticks: 20, style: 'enamel', size: 256 }), roughness: 0.5 }));
  dial.position.set(0, 0.06, d + 0.003); g.add(dial);
  g.add(mesh(new THREE.TorusGeometry(0.058, 0.008, 8, 28).translate(0, 0.06, d + 0.004), M.brass()));
  const needle = mesh(boxG(0.003, 0.045, 0.002, 0, 0.02, 0, 0.0005), M.matte('#a3201c'), { cast: false });
  needle.position.set(0, 0.06, d + 0.006); g.add(needle);
  const handle = grp('handle'); handle.position.set(0, 0.02 - 0.1, d + 0.035);
  handle.add(mergeInto([cylG(0.015, 0.015, 0.03, 10).rotateX(Math.PI / 2), boxG(0.18, 0.02, 0.015, 0, 0, 0.012, 0.005), new THREE.SphereGeometry(0.018, 10, 8).translate(-0.09, 0, 0.012), new THREE.SphereGeometry(0.018, 10, 8).translate(0.09, 0, 0.012)], M.tarnishedBrass({ amount: 0.4 })));
  g.add(handle);
  const plate = textPlate(label, 0.2, { style: 'enamel', bg: '#e8dfc8', fg: '#1a1208', pw: 512, ph: 96 });
  plate.position.set(0, -h / 2 + 0.08, d + 0.021); g.add(plate);
  g.add(mergeInto([new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI).translate(0.11, -h / 2 + 0.04, d + 0.03), boxG(0.035, 0.03, 0.012, 0.11, -h / 2 + 0.02, d + 0.03, 0.004)], M.brass({ color: '#a8843a' })));
  g.userData.handle = handle; g.userData.slotPos = new THREE.Vector3(0, h / 2 - 0.07, d + 0.02);
  g.userData.dial = needle;
  g.userData.setCredit = (k) => { needle.rotation.z = THREE.MathUtils.degToRad(120 - 240 * k); };
  g.userData.setCredit(0);
  return g;
}

// =====================================================================================================
// RADIATOR, PIPES, RAIN PANE
// =====================================================================================================

/**
 * Cast-iron column radiator: N sections (instanced), feet, valves, a pipe stub. Origin: floor centre; against a wall
 * at -Z, faces +Z. color: paint. userData: { w }. Cost: 3 draw calls.
 */
export function radiator({ sections = 12, h = 0.75, color = '#c8bca0' } = {}) {
  const g = grp('radiator');
  const pitch = 0.06, W = sections * pitch;
  const sec = mergeG([
    latheG([[0, 0], [0.022, 0], [0.026, 0.02], [0.022, 0.04], [0.022, h - 0.24], [0.026, h - 0.2], [0.022, h - 0.18], [0, h - 0.18]], 10).translate(0, 0.1, 0.03),
    latheG([[0, 0], [0.022, 0], [0.026, 0.02], [0.022, 0.04], [0.022, h - 0.24], [0.026, h - 0.2], [0.022, h - 0.18], [0, h - 0.18]], 10).translate(0, 0.1, -0.03),
    boxG(0.05, 0.05, 0.1, 0, 0.12, 0, 0.012), boxG(0.05, 0.05, 0.1, 0, h - 0.07, 0, 0.012),
  ]);
  const paint = M.enamel(color, { roughness: 0.55, metalness: 0.2 });
  const list = []; for (let i = 0; i < sections; i++) list.push({ p: [-W / 2 + (i + 0.5) * pitch, 0, 0.1] });
  g.add(instances(sec, paint, list));
  g.add(mergeInto([boxG(0.05, 0.1, 0.12, -W / 2 + 0.05, 0.05, 0.1, 0.01), boxG(0.05, 0.1, 0.12, W / 2 - 0.05, 0.05, 0.1, 0.01), cylG(0.018, 0.018, 0.08, 10).rotateZ(Math.PI / 2).translate(-W / 2 - 0.04, 0.13, 0.1), cylG(0.018, 0.018, 0.13, 10, -W / 2 - 0.08, 0.065, 0.1)], paint));
  g.add(mergeInto([latheG([[0, 0], [0.025, 0], [0.025, 0.04], [0.012, 0.05], [0.012, 0.09], [0, 0.09]], 12).translate(-W / 2 - 0.08, 0.13, 0.1), new THREE.TorusGeometry(0.03, 0.006, 6, 12).rotateX(Math.PI / 2).translate(-W / 2 - 0.08, 0.23, 0.1)], M.tarnishedBrass({ amount: 0.5 })));
  g.userData.w = W;
  return g;
}

/**
 * A run of painted iron pipe through points [[x,y,z],...] with elbows (sharp corners) and wall brackets every ~1 m.
 * Origin: the points' frame. opts: r, color, brackets (bool), wallDir ([x,y,z] toward the wall for brackets).
 * Cost: 2 draw calls.
 */
export function pipeRun(points = [[0, 0, 0], [0, 2, 0], [2, 2, 0]], { r = 0.025, color = '#4a4440', brackets = true, wallDir = [0, 0, -1] } = {}) {
  const g = grp('pipeRun');
  const pts = points.map((p) => new THREE.Vector3(...p));
  const geos = [], br = [];
  const wd = new THREE.Vector3(...wallDir).normalize();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5);
    const c = new THREE.CylinderGeometry(r, r, len, 12, 1, true);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    c.applyQuaternion(q).translate(mid.x, mid.y, mid.z); geos.push(c);
    if (brackets) for (let k = 0.5; k < len; k += 1.0) { const p = a.clone().lerp(b, k / len); br.push(new THREE.TorusGeometry(r + 0.006, 0.006, 6, 12).applyQuaternion(q).translate(p.x, p.y, p.z), boxG(0.03, 0.03, 0.05, p.x + wd.x * (r + 0.02), p.y + wd.y * (r + 0.02), p.z + wd.z * (r + 0.02), 0.004)); }
  }
  for (let i = 0; i < pts.length; i++) geos.push(new THREE.SphereGeometry(r * 1.25, 12, 8).translate(pts[i].x, pts[i].y, pts[i].z));
  g.add(mergeInto(geos, M.enamel(color, { roughness: 0.6, metalness: 0.3 })));
  if (br.length) g.add(mergeInto(br, M.ironBlack()));
  return g;
}

const rainMats = new Set();
/**
 * Rain-on-glass material (shared look; each call returns a UNIQUE animated material): a frosted dark pane with
 * scrolling streaks and beads. Drive it with mat.userData.update(dt) (rainPane does). opts: tint, opacity, speed.
 */
export function rainGlassMaterial({ tint = '#9aa8b4', opacity = 0.55, speed = 0.25, density = 1 } = {}) {
  const streak = rainStreakTexture({ density }).clone(); streak.wrapS = streak.wrapT = THREE.RepeatWrapping; streak.needsUpdate = true;
  const mat = new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.25, clearcoat: 1, transparent: true, opacity, alphaMap: null, map: streak, emissiveMap: streak, emissive: '#3a4450', emissiveIntensity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  let off = 0;
  mat.userData.update = (dt) => { off -= dt * speed; streak.offset.y = off; };
  rainMats.add(mat);
  return mat;
}

/**
 * A rain-streaked window pane in a sash frame, with a sill; optionally a painted night beyond (a brick wall or
 * street glow). Origin: centre of the glass; faces +Z (the room). bars: [cols, rows] of glazing bars.
 * beyond: 'brick' | 'street' | 'sky' | null. userData: { glass (Mesh), setRain(on) }. Cost: 3–4 draw calls.
 */
export function rainPane({ w = 0.9, h = 1.2, bars = [2, 2], beyond = 'sky', frame = true, speed = 0.25 } = {}) {
  const g = grp('rainPane');
  const mat = rainGlassMaterial({ speed });
  const glass = mesh(new THREE.PlaneGeometry(w, h), mat, { cast: false, receive: false });
  g.add(glass);
  if (frame) {
    const f = [boxG(w + 0.12, 0.06, 0.08, 0, h / 2 + 0.03, 0, 0.006), boxG(w + 0.12, 0.06, 0.08, 0, -h / 2 - 0.03, 0, 0.006), boxG(0.06, h, 0.08, -w / 2 - 0.03, 0, 0, 0.006), boxG(0.06, h, 0.08, w / 2 + 0.03, 0, 0, 0.006), boxG(w + 0.2, 0.04, 0.18, 0, -h / 2 - 0.08, 0.06, 0.008)];
    for (let i = 1; i < bars[0]; i++) f.push(boxG(0.025, h, 0.04, -w / 2 + w * i / bars[0], 0, 0, 0.003));
    for (let i = 1; i < bars[1]; i++) f.push(boxG(w, 0.025, 0.04, 0, -h / 2 + h * i / bars[1], 0, 0.003));
    g.add(mergeInto(f, M.enamel('#d8d0bc', { roughness: 0.6 })));
  }
  if (beyond) {
    const c = makeCanvas(256, 256), cg = c.getContext('2d');
    if (beyond === 'brick') { cg.fillStyle = '#1a1210'; cg.fillRect(0, 0, 256, 256); cg.fillStyle = '#2a1a14'; for (let y = 0; y < 256; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < 256; x += 32) cg.fillRect(x + 1, y + 1, 30, 14); }
    else { const gr = cg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#0a1020'); gr.addColorStop(1, beyond === 'street' ? '#3a2a18' : '#1a2438'); cg.fillStyle = gr; cg.fillRect(0, 0, 256, 256); if (beyond === 'street') { const rg = cg.createRadialGradient(180, 200, 4, 180, 200, 90); rg.addColorStop(0, 'rgba(255,200,120,0.7)'); rg.addColorStop(1, 'rgba(255,200,120,0)'); cg.fillStyle = rg; cg.fillRect(0, 0, 256, 256); } }
    const b = mesh(new THREE.PlaneGeometry(w * 1.6, h * 1.6), new THREE.MeshBasicMaterial({ map: canvasTexture(c) }), { cast: false, receive: false });
    b.position.z = -0.6; g.add(b);
  }
  let on = true;
  g.userData.update = (dt) => { if (on) mat.userData.update(dt); };
  g.userData.setRain = (b) => { on = b; mat.map = b ? mat.map : mat.map; mat.opacity = b ? 0.55 : 0.3; };
  g.userData.glass = glass;
  return g;
}

// =====================================================================================================
// LAMPS: pendant, festoon
// =====================================================================================================

/**
 * Pendant lamp on a flex: style 'enamel' (green enamel coolie shade, white inside), 'glass' (a frosted globe),
 * 'tin' (a conical tin shade). Origin: the ceiling rose; hangs `drop` m. userData: { setLit(0..1), bulbPos (local),
 * shade, swing (Group: rotate it for a sway) }. The prop makes no light. Cost: 4 draw calls.
 */
export function pendantLamp({ style = 'enamel', color = '#1f4a30', drop = 0.9, lit = 0 } = {}) {
  const g = grp('pendantLamp');
  g.add(mesh(latheG([[0, 0], [0.06, 0], [0.065, -0.02], [0.03, -0.04], [0, -0.04]], 20), M.porcelain('#e8e0d0')));
  const swing = grp('swing'); swing.position.y = -0.04; g.add(swing);
  swing.add(mesh(cylG(0.004, 0.004, drop, 6, 0, -drop / 2, 0), M.bakelite('#2a2018')));
  const y = -drop;
  swing.add(mesh(latheG([[0, y + 0.02], [0.018, y + 0.02], [0.02, y - 0.03], [0.016, y - 0.05], [0, y - 0.05]], 12), M.brass()));
  let shadeMat, inner = null, bulbY = y - 0.08;
  if (style === 'glass') {
    shadeMat = new THREE.MeshPhysicalMaterial({ color: '#f0ece0', roughness: 0.5, transmission: 0, transparent: true, opacity: 0.85, emissive: '#ffe0b0', emissiveIntensity: 0 });
    swing.add(mesh(new THREE.SphereGeometry(0.13, 24, 16).translate(0, y - 0.17, 0), shadeMat, { cast: false }));
    bulbY = y - 0.17;
  } else {
    shadeMat = style === 'enamel' ? M.enamel(color, { roughness: 0.3 }) : M.iron({ color: '#5a5650', roughness: 0.5 });
    const prof = style === 'enamel' ? [[0.02, y - 0.04], [0.06, y - 0.06], [0.2, y - 0.14], [0.22, y - 0.16], [0.215, y - 0.165]] : [[0.02, y - 0.04], [0.16, y - 0.2], [0.17, y - 0.21]];
    swing.add(mesh(latheG(prof, 28), shadeMat));
    inner = new THREE.MeshStandardMaterial({ color: '#f2eee4', side: THREE.BackSide, roughness: 0.5, emissive: '#fff0d0', emissiveIntensity: 0 });
    swing.add(mesh(latheG(prof.map(([x, yy]) => [x * 0.97, yy - 0.002]), 28), inner, { cast: false }));
  }
  const bulbs = bulbSet([[0, bulbY, 0]], { r: 0.03, shape: 'round', lit: 0, intensity: 2.4 });
  swing.add(bulbs);
  let level = 0, target = lit;
  const apply = () => { bulbs.userData.setAll(level); if (inner) inner.emissiveIntensity = level * 0.7; if (style === 'glass') shadeMat.emissiveIntensity = level * 1.2; };
  g.userData.update = (dt) => { if (Math.abs(level - target) > 0.001) { level = chase(level, target, dt, 7); apply(); } };
  g.userData.setLit = (t, instant) => { target = +t; if (instant) { level = target; apply(); } };
  level = lit; apply();
  g.userData.bulbPos = new THREE.Vector3(0, -0.04 + bulbY, 0); g.userData.swing = swing;
  return g;
}

/**
 * A festoon of bare bulbs on a sagging cable from a to b. count bulbs hang on short drops. Origin: the points' frame.
 * userData: { bulbs (bulbSet: setBulb/setAll), setLit(0..1), positions[] }. Cost: 3 draw calls.
 */
export function festoon(a = [-2, 2.5, 0], b = [2, 2.5, 0], { count = 10, sag = 0.3, color = '#ffd9a0', lit = 0, dead = [] } = {}) {
  const g = grp('festoon');
  const curve = catenary(a, b, sag, 40);
  g.add(mesh(tubeG(curve, 0.005, { radial: 5, seg: 80 }), M.bakelite('#1a1612'), { cast: false }));
  const pos = [], sockets = [];
  const crv = new THREE.CatmullRomCurve3(curve);
  for (let i = 0; i < count; i++) { const p = crv.getPoint((i + 0.5) / count); pos.push([p.x, p.y - 0.09, p.z]); sockets.push({ p: [p.x, p.y - 0.04, p.z] }); }
  g.add(instances(cylG(0.012, 0.014, 0.05, 8), M.bakelite('#1a1612'), sockets, { cast: false }));
  const bulbs = bulbSet(pos, { r: 0.022, shape: 'pear', color, lit: 0, intensity: 2.6 });
  for (let i = 0; i < count; i++) { const m4 = new THREE.Matrix4().makeTranslation(pos[i][0], pos[i][1] + 0.03, pos[i][2]); bulbs.setMatrixAt(i, m4); }
  bulbs.instanceMatrix.needsUpdate = true;
  g.add(bulbs);
  g.userData.bulbs = bulbs; g.userData.positions = pos.map((p) => new THREE.Vector3(...p));
  g.userData.setLit = (t) => { for (let i = 0; i < count; i++) bulbs.userData.setBulb(i, dead.includes(i) ? 0 : +t); };
  g.userData.setLit(lit);
  return g;
}

// =====================================================================================================
// LEDGER, KEYS, TAGS, TINS, TEACUPS, SOFA
// =====================================================================================================

/**
 * An open ledger / sign-in book: two page blocks with a slight curve, cloth-bound boards, a ribbon. left/right:
 * page textures (ledgerPageTexture({...})). Origin: centre of the spine on the table; the reader is at +Z.
 * userData: { left, right (page Meshes), setPages(leftTex, rightTex) }. Cost: 4 draw calls.
 */
export function ledger({ w = 0.6, d = 0.4, left = null, right = null, cover = '#3a1a14' } = {}) {
  const g = grp('ledger');
  const pw = w / 2 - 0.01, th = 0.025;
  g.add(mergeInto([boxG(pw + 0.015, 0.006, d + 0.02, -pw / 2 - 0.004, 0.003, 0, 0.002), boxG(pw + 0.015, 0.006, d + 0.02, pw / 2 + 0.004, 0.003, 0, 0.002), cylG(0.02, 0.02, d + 0.02, 12).rotateX(Math.PI / 2).translate(0, 0.004, 0).scale(1, 0.5, 1)], M.leather(cover)));
  const page = (side) => {
    const geo = new THREE.PlaneGeometry(pw, d, 12, 1).rotateX(-Math.PI / 2), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); const u = Math.abs(x) / pw + 0.5; p.setY(i, th * (0.6 + 0.4 * Math.sin(Math.min(1, (x + pw / 2) / pw) * Math.PI * 0.9)) + 0.006); }
    geo.translate(side * (pw / 2 + 0.004), 0, 0);
    geo.computeVertexNormals();
    return geo;
  };
  const lm = new THREE.MeshStandardMaterial({ map: left || ledgerPageTexture({}), roughness: 0.9 });
  const rm = new THREE.MeshStandardMaterial({ map: right || ledgerPageTexture({ title: '', seed: 18, rows: [] }), roughness: 0.9 });
  const L = mesh(page(-1), lm, { cast: false }), R = mesh(page(1), rm, { cast: false });
  g.add(L, R);
  // page-block edges
  g.add(mergeInto([boxG(pw, th, 0.004, -pw / 2 - 0.004, th / 2 + 0.006, d / 2, 0.001), boxG(pw, th, 0.004, pw / 2 + 0.004, th / 2 + 0.006, d / 2, 0.001), boxG(0.004, th, d, -pw - 0.004, th / 2 + 0.006, 0, 0.001), boxG(0.004, th, d, pw + 0.004, th / 2 + 0.006, 0, 0.001)], M.matte('#d8cba8')));
  g.add(at(mesh(new THREE.PlaneGeometry(0.012, 0.12).translate(0, -0.06, 0), M.matte('#7a1a1c'), { cast: false }), 0.01, th + 0.0075, d / 2, -Math.PI / 2 + 0.2, 0, 0));
  g.userData.left = L; g.userData.right = R;
  g.userData.setPages = (a, b) => { if (a) { lm.map = a; lm.needsUpdate = true; } if (b) { rm.map = b; rm.needsUpdate = true; } };
  return g;
}

/**
 * A key: style 'mortice' (a long iron/brass key with a bow and a bit) or 'yale' (a small flat cylinder key).
 * Origin: centre of the bow; the shank runs along +X. Cost: 1 draw call.
 */
export function key({ style = 'mortice', metal = 'brass', len = 0.09 } = {}) {
  const g = grp('key');
  const mat = metal === 'iron' ? M.iron({ color: '#4a4640' }) : M.tarnishedBrass({ amount: 0.35 });
  if (style === 'yale') {
    const s = new THREE.Shape(); s.moveTo(0, -0.012); s.lineTo(0.05, -0.006); for (let i = 0; i < 5; i++) { s.lineTo(0.05 + i * 0.006 + 0.003, -0.006 - (i % 2 ? 0.003 : 0.001)); } s.lineTo(0.08, -0.004); s.lineTo(0.08, 0.004); s.lineTo(0, 0.006); s.closePath();
    g.add(mesh(mergeG([new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: false }).translate(0, 0, -0.001), cylG(0.018, 0.018, 0.003, 20).rotateX(Math.PI / 2)]), mat));
    return g;
  }
  g.add(mesh(mergeG([new THREE.TorusGeometry(0.014, 0.004, 8, 20), cylG(0.0035, 0.0035, len, 8).rotateZ(Math.PI / 2).translate(len / 2 + 0.014, 0, 0), boxG(0.016, 0.018, 0.003, len + 0.005, -0.009, 0, 0.001), boxG(0.004, 0.005, 0.006, 0.026, 0, 0, 0.001)]), mat));
  return g;
}

/**
 * A buff card luggage tag on a loop of string, typed text. Origin: the string's top (hang it on a hook).
 * Cost: 2 draw calls.
 */
export function cardTag({ text = 'PASS DOOR', w = 0.07, seed = 1 } = {}) {
  const g = grp('cardTag');
  const h = w * 0.55;
  const s = new THREE.Shape(); s.moveTo(-w / 2 + 0.012, h / 2); s.lineTo(w / 2, h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(-w / 2 + 0.012, -h / 2); s.lineTo(-w / 2, -h / 2 + 0.01); s.lineTo(-w / 2, h / 2 - 0.01); s.closePath();
  const geo = new THREE.ShapeGeometry(s); const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  const card = mesh(geo, new THREE.MeshStandardMaterial({ map: labelPlate(text, { style: 'card', w: 256, h: 140, seed }), roughness: 0.9, side: THREE.DoubleSide }), { cast: false });
  card.rotation.z = Math.PI / 2; card.position.y = -0.04 - w / 2;
  g.add(card);
  g.add(mesh(tubeG([[0, 0, 0], [0.006, -0.02, 0.002], [0, -0.04, 0]], 0.0008, { radial: 3, seg: 8 }), M.matte('#c8b890'), { cast: false }));
  return g;
}

/**
 * A tea tin with a push-on lid and a paper label. Origin: base centre. userData: { lid }. Cost: 3 draw calls.
 */
export function tin({ label = 'TEA FUND', r = 0.055, h = 0.13, color = '#7a1a1c', seed = 3 } = {}) {
  const g = grp('tin');
  g.add(mesh(cylG(r, r, h, 28, 0, h / 2, 0), M.enamel(color, { roughness: 0.45, metalness: 0.4 })));
  const lid = grp('lid'); lid.position.y = h;
  lid.add(mesh(mergeG([cylG(r + 0.003, r + 0.003, 0.022, 28, 0, 0, 0), cylG(0.015, 0.015, 0.006, 12, 0, 0.013, 0)]), M.enamel(color, { roughness: 0.45, metalness: 0.4 })));
  g.add(lid);
  const lt = labelPlate(label, { style: 'card', w: 512, h: 160, seed });
  const lm = mesh(new THREE.CylinderGeometry(r + 0.001, r + 0.001, h * 0.55, 28, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: lt, roughness: 0.85 }), { cast: false });
  lm.position.y = h * 0.45; g.add(lm);
  g.userData.lid = lid;
  return g;
}

/**
 * A teacup on a saucer (bone china, gold rim, a sprig). tea: show tea in it. Origin: saucer base centre.
 * Cost: 2–3 draw calls.
 */
export function teacup({ tea = false, color = '#f4efe4', saucer = true } = {}) {
  const g = grp('teacup');
  const china = M.porcelain(color);
  const parts = [latheG([[0.02, 0.008], [0.03, 0.008], [0.045, 0.06], [0.047, 0.065], [0.044, 0.065], [0.042, 0.06], [0.028, 0.012], [0, 0.012]], 28)];
  parts.push(new THREE.TorusGeometry(0.016, 0.004, 6, 14, Math.PI * 1.3).rotateZ(-Math.PI * 0.65).translate(0.05, 0.038, 0));
  if (saucer) parts.push(latheG([[0, 0], [0.04, 0], [0.07, 0.008], [0.072, 0.012], [0.068, 0.012], [0.04, 0.005], [0, 0.006]], 32));
  g.add(mesh(mergeG(parts), china));
  g.add(mesh(new THREE.TorusGeometry(0.0455, 0.0012, 4, 32).rotateX(Math.PI / 2).translate(0, 0.0655, 0), M.gilt({ pattern: 'plain' }), { cast: false }));
  if (tea) g.add(at(mesh(new THREE.CircleGeometry(0.04, 24).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#5a3018', roughness: 0.1, clearcoat: 1 }), { cast: false }), 0, 0.05, 0));
  return g;
}

/**
 * A worn three-seat sofa: rolled arms, buttoned back, three seat cushions, turned feet; velvet or leather.
 * Origin: floor centre; faces +Z. userData: { seatY, cushions[] }. Cost: 4 draw calls.
 */
export function sofa({ w = 1.9, color = M.palette.velvetGreen2, material = null, seed = 2 } = {}) {
  const g = grp('sofa');
  const mat = material || M.wornVelvetGreen({ color });
  const d = 0.85, seatH = 0.42, r = rng(seed);
  const frame = [boxG(w, 0.22, d, 0, 0.23, 0, 0.04), boxG(w, 0.5, 0.18, 0, 0.6, -d / 2 + 0.09, 0.07)];
  for (const s of [-1, 1]) { frame.push(boxG(0.18, 0.36, d, s * (w / 2 - 0.09), 0.42, 0, 0.06), cylG(0.11, 0.11, d, 18).rotateX(Math.PI / 2).translate(s * (w / 2 - 0.08), 0.62, 0)); }
  g.add(mergeInto(frame, mat));
  const cush = []; const cw = (w - 0.36) / 3;
  for (let i = 0; i < 3; i++) cush.push({ p: [-w / 2 + 0.18 + cw * (i + 0.5), seatH, 0.05], r: [-0.02 + r() * 0.04, (r() - 0.5) * 0.05, (r() - 0.5) * 0.03], s: [1, 0.9 + r() * 0.15, 1] });
  const cg = (() => { const geo = new THREE.BoxGeometry(cw - 0.01, 0.14, d - 0.22, 6, 2, 6), p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (cw / 2), z = p.getZ(i) / ((d - 0.22) / 2), y = p.getY(i); if (y > 0) p.setY(i, y * (1 - 0.35 * Math.max(Math.abs(x), Math.abs(z)) ** 4) + 0.02 * (1 - x * x) * (1 - z * z)); } geo.computeVertexNormals(); return geo; })();
  g.add(instances(cg, mat, cush));
  const buttons = []; for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) buttons.push({ p: [-w / 2 + 0.3 + i * (w - 0.6) / 8 + (j ? (w - 0.6) / 16 : 0), 0.6 + j * 0.16, -d / 2 + 0.18] });
  g.add(instances(new THREE.SphereGeometry(0.012, 8, 6), mat, buttons, { cast: false }));
  const feet = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) feet.push(latheG([[0, 0], [0.02, 0], [0.03, 0.04], [0.025, 0.08], [0.035, 0.12], [0, 0.12]], 12).translate(sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08)));
  g.add(mergeInto(feet, M.walnut()));
  g.userData.seatY = seatH + 0.07;
  return g;
}

/**
 * A small round side table on a turned pedestal with three feet (lamp tables, the green room). Origin: floor centre.
 * userData: { topY }. Cost: 1 draw call.
 */
export function sideTable({ r = 0.28, h = 0.65, wood = null } = {}) {
  const g = grp('sideTable');
  const parts = [cylG(r, r, 0.025, 32, 0, h - 0.0125, 0), cylG(r * 0.96, r * 0.96, 0.03, 32, 0, h - 0.04, 0), latheG([[0, 0.12], [0.04, 0.12], [0.03, 0.2], [0.05, 0.3], [0.025, 0.45], [0.035, h - 0.05], [0, h - 0.05]], 14)];
  for (let i = 0; i < 3; i++) parts.push(tubeG([[0, 0.15, 0], [0.12, 0.08, 0], [0.22, 0.02, 0]], 0.018, { radial: 6, seg: 10 }).rotateY(i * TAU / 3));
  g.add(mergeInto(parts, wood || M.mahogany()));
  g.userData.topY = h;
  return g;
}

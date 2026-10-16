// Backstage props (PROPS): wardrobe, dressing room and green room. Garments and their rail, the dummy, wig head,
// hatbox, treadle sewing machine, the bulb mirror and dressing table, a bentwood chair, papers (telegram, letter),
// photo frame, lilies, perfume atomiser, the cloak, coats and the coat stand, clipboard, kettle and gas ring.
// Conventions as in stage.js: metres, +Y up, the front faces +Z; floor props have their origin at the base centre,
// wall props at the centre-back, hanging things at the hanging point.
import { THREE, M, TAU, mesh, noRay, grp, at, boxG, cylG, latheG, loftG, mergeG, mergeInto, tubeG, textPlate, bulbSet, halo, chase, instances, rng } from './common.js';
import { labelPlate, telegramTexture, agedPaperTexture, stripeTexture, clothTexture, sepiaPhotoTexture, FONTS } from '../theatre-textures.js';

// =====================================================================================================
// GARMENTS
// =====================================================================================================

/** Costume colours (instance tints over a white woven texture). */
export const COSTUME_COLORS = ['#7a1c22', '#24402e', '#2a3a6a', '#b8a070', '#5a2a4a', '#e2d6bc', '#1c1a1a', '#8a5a2a', '#4a6a7a', '#a04a2a', '#6a6a40', '#b8a8c8'];

const garmentGeos = new Map();
/**
 * One garment as a single geometry hanging from y = 0 (the rail / hook point), shoulders along X, front +Z.
 * type: 'gown' (fitted bodice, long skirt, ~1.5 m) | 'coat' (long, sleeves) | 'jacket' | 'cape' | 'blouse'.
 */
export function garmentGeometry(type = 'gown', seed = 1) {
  const key = `${type}:${seed}`;
  if (garmentGeos.has(key)) return garmentGeos.get(key);
  const S = (y, rx, rz, f = 0, z = 0, x = 0) => ({ y, rx, rz, f, z, x });
  const parts = [];
  const sleeves = (len, r = 0.05, puff = 1) => {
    for (const s of [-1, 1]) parts.push(loftG([S(-0.12, r * 1.05 * puff, r * puff, 0, 0, s * 0.19), S(-0.12 - len * 0.45, r * puff, r * 0.95 * puff, 0.004, 0.01, s * 0.205), S(-0.12 - len, r * 1.1, r, 0.008, 0.02, s * 0.215)], { seg: 10, seed: seed + s, capBottom: true }));
  };
  let body;
  if (type === 'gown') body = [S(-0.075, 0.055, 0.035), S(-0.12, 0.18, 0.07), S(-0.16, 0.19, 0.09), S(-0.3, 0.165, 0.1), S(-0.45, 0.125, 0.085), S(-0.55, 0.17, 0.11, 0.008), S(-0.85, 0.26, 0.17, 0.03), S(-1.2, 0.34, 0.23, 0.045), S(-1.48, 0.4, 0.27, 0.055)];
  else if (type === 'coat') { body = [S(-0.07, 0.065, 0.04), S(-0.12, 0.2, 0.07), S(-0.17, 0.21, 0.1), S(-0.4, 0.195, 0.11, 0.006), S(-0.7, 0.2, 0.11, 0.012), S(-1.15, 0.24, 0.13, 0.025)]; sleeves(0.6); }
  else if (type === 'jacket') { body = [S(-0.07, 0.065, 0.04), S(-0.12, 0.2, 0.07), S(-0.17, 0.21, 0.1), S(-0.42, 0.19, 0.105, 0.005), S(-0.72, 0.2, 0.11, 0.01)]; sleeves(0.58); }
  else if (type === 'cape') body = [S(-0.06, 0.06, 0.04), S(-0.1, 0.16, 0.1), S(-0.2, 0.27, 0.18, 0.01), S(-0.6, 0.32, 0.22, 0.03), S(-1.2, 0.39, 0.26, 0.05)];
  else { body = [S(-0.07, 0.06, 0.035), S(-0.12, 0.19, 0.07), S(-0.17, 0.2, 0.09), S(-0.35, 0.17, 0.1, 0.008), S(-0.6, 0.18, 0.1, 0.012)]; sleeves(0.52, 0.055, 1.25); }
  parts.unshift(loftG(body, { seg: 28, seed, capTop: true }));
  const geo = mergeG(parts);
  geo.computeBoundingSphere();
  garmentGeos.set(key, geo);
  return geo;
}
const garmentMats = new Map();
/** Garment cloth material: white woven texture (tint by instance colour), or a solid colour when color is given. */
export function garmentMaterial(color = '#ffffff') {
  if (!garmentMats.has(color)) garmentMats.set(color, new THREE.MeshStandardMaterial({ color, map: clothTexture({ tint: '#f4f0e8', seed: 72, weave: 2, stains: 1 }), roughness: 0.9, side: THREE.DoubleSide }));
  return garmentMats.get(color);
}
let hookGeo = null;
/** Wire hanger hook (curls over a rail running along local Z at the origin) + a short wooden shoulder bar. */
function hangerGeometry() {
  if (hookGeo) return hookGeo;
  hookGeo = mergeG([
    tubeG([[0, -0.085, 0], [0, -0.045, 0], [-0.017, -0.012, 0], [-0.019, 0.008, 0], [-0.006, 0.021, 0], [0.011, 0.019, 0], [0.019, 0.005, 0]], 0.0028, { radial: 5, seg: 24 }),
    tubeG([[-0.17, -0.125, 0], [-0.08, -0.098, 0], [0, -0.088, 0], [0.08, -0.098, 0], [0.17, -0.125, 0]], 0.01, { radial: 6, seg: 16 }),
  ]);
  return hookGeo;
}

/**
 * One garment on its hanger as a Mesh group (for wardrobes and single costumes). Origin: the rail point.
 * userData: { cloth }. 2 draw calls.
 */
export function garment({ type = 'gown', color = COSTUME_COLORS[0], seed = 1 } = {}) {
  const g = grp('garment');
  const cloth = mesh(garmentGeometry(type, seed), garmentMaterial(color));
  g.add(cloth, mesh(hangerGeometry(), M.dustyWood({ tint: '#a07850' }), { cast: false }));
  g.userData.cloth = cloth;
  return g;
}

/**
 * A costume rail of hanging garments: instanced by type (one draw call per type present), hangers instanced too.
 * wall: true → wall brackets, origin centre-back on the wall at floor level, rail at z = 0.42; false → a free-standing
 * rail on two castor feet, origin floor centre. types/colors: arrays cycled over `count`.
 * userData: { slots: [{ x, y, z, type, color, ry }], setVisible(i, bool), garments (Map type → InstancedMesh),
 * railY, railZ }. Cost: 2 + number of garment types (≈ 5–7).
 */
export function costumeRail({ w = 3, count = 12, h = 1.95, wall = true, types = null, colors = null, seed = 4 } = {}) {
  const g = grp('costumeRail'), r = rng(seed);
  const railZ = wall ? 0.42 : 0;
  const parts = [cylG(0.014, 0.014, w, 12).rotateZ(Math.PI / 2).translate(0, h, railZ)];
  if (wall) {
    const n = Math.max(2, Math.ceil(w / 1.4) + 1);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.1 + (w - 0.2) * i / (n - 1);
      parts.push(boxG(0.03, 0.03, railZ + 0.02, x, h + 0.03, railZ / 2, 0.004), boxG(0.07, 0.26, 0.012, x, h - 0.07, 0.006, 0.003),
        tubeG([[x, h - 0.19, 0.012], [x, h - 0.1, railZ * 0.35], [x, h + 0.02, railZ * 0.75]], 0.008, { radial: 6, seg: 10 }),
        cylG(0.018, 0.018, 0.04, 10).rotateX(Math.PI / 2).translate(x, h + 0.012, railZ));
    }
  } else {
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.02);
      parts.push(cylG(0.016, 0.016, h, 10, x, h / 2 + 0.06, 0), cylG(0.015, 0.015, 0.62, 8).rotateX(Math.PI / 2).translate(x, 0.07, 0));
      for (const z of [-0.28, 0.28]) parts.push(new THREE.SphereGeometry(0.035, 10, 8).translate(x, 0.035, z));
    }
  }
  g.add(mergeInto(parts, M.iron({ color: '#5e5a54', roughness: 0.45 })));
  const T = types || ['gown', 'coat', 'gown', 'cape', 'jacket', 'gown', 'blouse', 'coat'];
  const C = colors || COSTUME_COLORS;
  const slots = [], byType = new Map();
  const squash = wall ? Math.min(1, (railZ - 0.04) / 0.4) : 1; // skirts flatten against the wall
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + 0.18 + (w - 0.36) * (count === 1 ? 0.5 : i / (count - 1)) + (r() - 0.5) * 0.03;
    const type = T[i % T.length], color = C[i % C.length], ry = Math.PI / 2 + (r() - 0.5) * 0.24;
    const it = { p: [x, h, railZ], r: [0, ry, (r() - 0.5) * 0.03], s: [squash, 1, 0.5 + r() * 0.1], c: color };
    if (!byType.has(type)) byType.set(type, []);
    slots.push({ x, y: h, z: railZ, type, color, ry, index: byType.get(type).length, item: it });
    byType.get(type).push(it);
  }
  const garments = new Map();
  for (const [type, list] of byType) { const im = instances(garmentGeometry(type, 3), garmentMaterial(), list); im.name = `garments:${type}`; garments.set(type, im); g.add(im); }
  const hangers = instances(hangerGeometry(), M.dustyWood({ tint: '#a07850' }), slots.map((s) => ({ p: [s.x, h, railZ], r: [0, s.ry, 0] })), { cast: false });
  g.add(hangers);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  g.userData.setVisible = (i, on) => {
    const s = slots[i]; if (!s) return;
    const im = garments.get(s.type), k = on ? 1 : 0;
    m4.compose(v.set(...s.item.p), q.setFromEuler(e.set(...s.item.r)), sc.set(...s.item.s).multiplyScalar(k || 1e-4));
    im.setMatrixAt(s.index, m4); im.instanceMatrix.needsUpdate = true;
    m4.compose(v.set(s.x, h, railZ), q.setFromEuler(e.set(0, s.ry, 0)), sc.setScalar(k || 1e-4));
    hangers.setMatrixAt(i, m4); hangers.instanceMatrix.needsUpdate = true;
  };
  g.userData.slots = slots; g.userData.garments = garments; g.userData.railY = h; g.userData.railZ = railZ;
  return g;
}

// =====================================================================================================
// WARDROBE: DUMMY, WIG HEAD, HATBOX, SEWING MACHINE
// =====================================================================================================

/**
 * Dressmaker's dummy: a linen-covered female torso on a turned pole and three splayed feet. layers: costume pieces
 * pinned on it, outermost last: [{ kind: 'bodice'|'skirt'|'sash', color }]. Origin: floor centre; faces +Z; ~1.5 m.
 * userData: { layers[] (meshes), popLayer() (hides the outermost visible layer, returns it), torso }.
 * Cost: 2 + layers.
 */
export function dressmakersDummy({ layers = [], cover = '#d6c8a8', h = 1.5 } = {}) {
  const g = grp('dressmakersDummy');
  const k = h / 1.5;
  const S = (y, rx, rz, z = 0, f = 0) => ({ y: y * k, rx: rx * k, rz: rz * k, z: z * k, f: f * k });
  const torso = loftG([S(1.42, 0.035, 0.035), S(1.41, 0.05, 0.048), S(1.36, 0.06, 0.058), S(1.33, 0.15, 0.085), S(1.3, 0.18, 0.1), S(1.24, 0.17, 0.115, 0.012), S(1.16, 0.155, 0.112, 0.01), S(1.05, 0.12, 0.088), S(0.95, 0.15, 0.108), S(0.87, 0.18, 0.125, -0.004), S(0.8, 0.175, 0.12)], { seg: 40, capTop: true, capBottom: true });
  const tm = mesh(torso, M.paintedCanvas({ tint: cover }));
  g.add(tm);
  const wood = [
    latheG([[0.001, 0], [0.028, 0], [0.032, 0.012], [0.02, 0.03], [0.012, 0.045], [0.02, 0.06], [0.001, 0.07]], 16).translate(0, 1.415 * k, 0),
    cylG(0.016, 0.016, 0.66 * k, 12, 0, 0.47 * k, 0), cylG(0.028, 0.028, 0.05, 14, 0, 0.55 * k, 0), latheG([[0.001, 0], [0.05, 0], [0.04, 0.06], [0.02, 0.12], [0.001, 0.13]], 14).translate(0, 0.08, 0),
  ];
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3 + Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    wood.push(tubeG([[0, 0.16, 0], [c * 0.12, 0.1, s * 0.12], [c * 0.26, 0.035, s * 0.26], [c * 0.32, 0.02, s * 0.32]], 0.016, { radial: 8 }), new THREE.SphereGeometry(0.022, 10, 8).translate(c * 0.32, 0.02, s * 0.32));
  }
  g.add(mergeInto(wood, M.walnut()));
  const lay = [];
  layers.forEach((L, i) => {
    const o = 1 + 0.035 * (i + 1);
    let geo;
    if (L.kind === 'skirt') geo = loftG([S(1.06, 0.13 * o, 0.095 * o), S(0.95, 0.165 * o, 0.12 * o, 0, 0.006), S(0.8, 0.22 * o, 0.16 * o, 0, 0.015), S(0.55, 0.3 * o, 0.22 * o, 0, 0.03), S(0.3, 0.36 * o, 0.27 * o, 0, 0.04)], { seg: 40, seed: 7 + i });
    else if (L.kind === 'sash') geo = new THREE.TorusGeometry(0.128 * o * k, 0.022 * k, 8, 32).rotateX(Math.PI / 2).scale(1, 1, 0.74).translate(0, 1.05 * k, 0);
    else geo = loftG([S(1.335, 0.15 * o, 0.088 * o), S(1.3, 0.182 * o, 0.103 * o), S(1.24, 0.172 * o, 0.118 * o, 0.012), S(1.16, 0.157 * o, 0.115 * o, 0.01), S(1.05, 0.123 * o, 0.091 * o), S(0.98, 0.14 * o, 0.1 * o)], { seg: 40, seed: 3 + i });
    const m = mesh(geo, garmentMaterial(L.color || COSTUME_COLORS[i % COSTUME_COLORS.length]));
    m.name = `layer:${L.kind || 'bodice'}`;
    g.add(m); lay.push(m);
  });
  g.userData.layers = lay;
  g.userData.torso = tm;
  g.userData.popLayer = () => { const m = [...lay].reverse().find((x) => x.visible); if (m) m.visible = false; return m || null; };
  return g;
}

/**
 * Milliner's wig head: a papier-mâché head with a hint of a face on a turned stand, wearing a wig.
 * style: 'curls' | 'bob' | null (bald). Origin: base centre; faces +Z; ~0.5 m. userData: { wig, head }. 3 draw calls.
 */
export function wigHead({ wig = '#6a4426', style = 'curls', skin = '#b89c78', seed = 2 } = {}) {
  const g = grp('wigHead');
  const head = mergeG([
    new THREE.SphereGeometry(0.085, 28, 20).scale(0.86, 1.12, 0.96).translate(0, 0.4, 0),
    cylG(0.028, 0.04, 0.11, 18, 0, 0.29, 0.004),
    new THREE.SphereGeometry(0.01, 10, 8).scale(0.7, 1.5, 0.9).translate(0, 0.392, 0.079), // nose
  ]);
  const hm = mesh(head, M.matte(skin, { roughness: 0.85 })); // papier-mache block
  g.add(hm);
  // painted features: brows, closed eyes, a rosebud mouth
  const feat = [];
  for (const s of [-1, 1]) feat.push(new THREE.TorusGeometry(0.013, 0.0016, 4, 10, Math.PI * 0.8).rotateZ(Math.PI * 1.1).translate(s * 0.027, 0.418, 0.075), new THREE.TorusGeometry(0.014, 0.0012, 4, 10, Math.PI * 0.7).rotateZ(Math.PI * 0.15).translate(s * 0.027, 0.424, 0.073));
  feat.push(new THREE.SphereGeometry(0.008, 10, 6).scale(1.3, 0.55, 0.5).translate(0, 0.366, 0.078));
  g.add(mergeInto(feat, M.matte('#7a2a2a', { roughness: 0.6 }), { cast: false }));
  g.add(mergeInto([latheG([[0.001, 0], [0.075, 0], [0.078, 0.012], [0.05, 0.022], [0.016, 0.03], [0.013, 0.2], [0.03, 0.235], [0.001, 0.24]], 20)], M.walnut()));
  let wm = null;
  if (style) {
    const r = rng(seed), parts = [];
    if (style === 'bob') {
      parts.push(new THREE.SphereGeometry(0.094, 24, 14, 0, TAU, 0, Math.PI * 0.62).scale(0.9, 1.08, 1).translate(0, 0.41, -0.006));
    } else {
      parts.push(new THREE.SphereGeometry(0.09, 20, 12, 0, TAU, 0, Math.PI * 0.55).scale(0.9, 1.1, 1).translate(0, 0.41, -0.004));
      const curl = new THREE.IcosahedronGeometry(0.024, 1);
      for (let i = 0; i < 46; i++) {
        const th = r() * TAU, phi = 0.15 + r() * 1.25;
        const dir = new THREE.Vector3(Math.sin(phi) * Math.sin(th), Math.cos(phi), Math.sin(phi) * Math.cos(th));
        if (dir.z > 0.45 && dir.y < 0.55) continue; // keep the face clear
        const s = 0.7 + r() * 0.6;
        parts.push(curl.clone().scale(s, s, s).translate(dir.x * 0.084, 0.41 + dir.y * 0.098, dir.z * 0.088 - 0.004));
      }
    }
    wm = mergeInto(parts, M.matte(wig, { roughness: 0.8 }));
    g.add(wm);
  }
  g.userData.wig = wm; g.userData.head = hm;
  return g;
}

/**
 * Hatbox: a striped card drum with a lid, a cord handle and a written label. Origin: base centre; label faces +Z.
 * userData: { lid (group at the rim; lift it by position.y), h, r }. Cost: 4 draw calls (3 without a label).
 */
export function hatbox({ r = 0.2, h = 0.22, colors = ['#e8dcc0', '#2f5a3a'], stripes = 16, label = '', lid = true, seed = 81 } = {}) {
  const g = grp('hatbox');
  const side = new THREE.MeshStandardMaterial({ map: stripeTexture({ colors, count: stripes, dir: 'v', seed, age: 0.5 }), roughness: 0.85, side: THREE.DoubleSide });
  g.add(mesh(mergeG([cylG(r, r, h, 40, 0, h / 2, 0, true), new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2).translate(0, 0.004, 0)]), side));
  const L = grp('lid'); L.position.y = h;
  if (lid) {
    const lm = M.matte(colors[1] || '#2f5a3a', { roughness: 0.8 });
    L.add(mergeInto([cylG(r + 0.006, r + 0.006, 0.05, 40, 0, 0.0, 0, true), new THREE.CircleGeometry(r + 0.006, 40).rotateX(-Math.PI / 2).translate(0, 0.025, 0),
      tubeG([[-r * 0.45, 0.025, 0], [-r * 0.35, 0.09, 0], [0, 0.12, 0], [r * 0.35, 0.09, 0], [r * 0.45, 0.025, 0]], 0.005, { radial: 6 })], lm));
    g.add(L);
  }
  if (label) {
    const lw = Math.min(0.16, r * 0.9), lh = lw * 0.4;
    const geo = new THREE.CylinderGeometry(r + 0.002, r + 0.002, lh, 8, 1, true, -lw / (2 * r), lw / r);
    const lab = mesh(geo, new THREE.MeshStandardMaterial({ map: labelPlate(label, { style: 'card', w: 400, h: 160, font: FONTS.hand }), roughness: 0.85 }), { cast: false });
    lab.position.y = h * 0.5; g.add(lab);
  }
  g.userData.lid = L; g.userData.h = h; g.userData.r = r;
  return g;
}

/**
 * Treadle sewing machine: an oak top with side drawers on ornate cast-iron frames, a japanned machine head with a
 * handwheel and gilt lining, a flywheel, belt and treadle. Origin: floor centre; the sewer sits at +Z.
 * userData: { handwheel, flywheel, treadle, setRunning(speed 0..1) }. Cost: 9 draw calls.
 */
export function sewingMachine({ running = 0 } = {}) {
  const g = grp('sewingMachine');
  const topY = 0.76;
  // table top and drawers
  const wood = [boxG(0.92, 0.03, 0.46, 0, topY + 0.015, 0, 0.008)];
  for (const s of [-1, 1]) {
    wood.push(boxG(0.16, 0.2, 0.38, s * 0.3, topY - 0.1, 0, 0.006));
    for (let i = 0; i < 2; i++) wood.push(boxG(0.03, 0.022, 0.02, s * 0.3, topY - 0.05 - i * 0.1, 0.2, 0.006));
  }
  g.add(mergeInto(wood, M.oak({ tint: '#7a4e28' })));
  // cast-iron side frames: a splayed lattice in the YZ plane, with a stretcher and the pitman rod
  const fr = new THREE.Shape();
  fr.moveTo(-0.23, 0); fr.lineTo(-0.15, 0); fr.lineTo(-0.1, 0.06); fr.lineTo(0.1, 0.06); fr.lineTo(0.15, 0); fr.lineTo(0.23, 0);
  fr.lineTo(0.15, 0.12); fr.lineTo(0.17, topY - 0.21); fr.lineTo(0.2, topY - 0.2); fr.lineTo(-0.2, topY - 0.2); fr.lineTo(-0.17, topY - 0.21); fr.lineTo(-0.15, 0.12); fr.closePath();
  const hole = (x, y, rx, ry) => { const p = new THREE.Path(); p.absellipse(x, y, rx, ry, 0, TAU, false); fr.holes.push(p); };
  hole(0, 0.33, 0.1, 0.17); hole(0, 0.12, 0.06, 0.035); hole(-0.1, 0.48, 0.025, 0.04); hole(0.1, 0.48, 0.025, 0.04);
  const frameGeo = new THREE.ExtrudeGeometry(fr, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 12 }).rotateY(-Math.PI / 2);
  const iron = [];
  for (const s of [-1, 1]) iron.push(frameGeo.clone().translate(s * 0.38 + 0.011, 0, 0));
  iron.push(cylG(0.012, 0.012, 0.76, 8).rotateZ(Math.PI / 2).translate(0, 0.14, -0.12), cylG(0.008, 0.008, 0.78, 8).rotateZ(Math.PI / 2).translate(0, 0.09, 0));
  iron.push(tubeG([[0.3, 0.1, 0.06], [0.31, 0.3, 0.02]], 0.007, { radial: 6, seg: 4 })); // pitman
  iron.push(tubeG([[0.33, 0.49, 0.0], [0.33, 0.7, 0.0], [0.24, topY + 0.15, 0]], 0.004, { radial: 5, seg: 10 }), tubeG([[0.33, 0.15, 0.0], [0.33, 0.49, 0.0]], 0.004, { radial: 5, seg: 4 })); // belt
  g.add(mergeInto(iron, M.ironBlack()));
  // treadle (rocks about X) and flywheel
  const treadle = grp('treadle'); treadle.position.set(0, 0.09, 0.0);
  const tg = [boxG(0.6, 0.016, 0.3, 0, 0.01, 0.0, 0.004)];
  for (let i = -4; i <= 4; i++) tg.push(boxG(0.012, 0.02, 0.28, i * 0.06, 0.012, 0, 0.002));
  treadle.add(mergeInto(tg, M.ironBlack())); g.add(treadle);
  const fly = grp('flywheel'); fly.position.set(0.33, 0.32, 0);
  const fg = [new THREE.TorusGeometry(0.17, 0.012, 8, 40).rotateY(Math.PI / 2), cylG(0.025, 0.025, 0.05, 12).rotateZ(Math.PI / 2)];
  for (let i = 0; i < 6; i++) fg.push(boxG(0.012, 0.16, 0.014, 0, 0.085, 0, 0.002).rotateX(i * TAU / 6));
  fly.add(mergeInto(fg, M.iron({ color: '#4a4844', roughness: 0.5 }))); g.add(fly);
  // machine head: base plate and the arm (an extruded C profile), japanned black
  const headY = topY + 0.03;
  const arm = new THREE.Shape();
  arm.moveTo(0.17, 0); arm.lineTo(0.17, 0.19); arm.quadraticCurveTo(0.17, 0.25, 0.1, 0.25); arm.lineTo(-0.13, 0.245); arm.quadraticCurveTo(-0.17, 0.24, -0.17, 0.2);
  arm.lineTo(-0.17, 0.11); arm.lineTo(-0.125, 0.11); arm.lineTo(-0.125, 0.175); arm.lineTo(0.06, 0.18); arm.quadraticCurveTo(0.09, 0.17, 0.095, 0.13); arm.lineTo(0.1, 0); arm.closePath();
  const armGeo = new THREE.ExtrudeGeometry(arm, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 10 }).translate(0, 0.012, -0.035);
  g.add(at(mergeInto([armGeo, boxG(0.4, 0.02, 0.19, 0, 0.01, 0, 0.006)], M.japanned()), 0, headY, -0.04));
  // steel: handwheel, needle bar, presser foot, spool pin
  const steel = [cylG(0.065, 0.065, 0.025, 28).rotateZ(Math.PI / 2).translate(0.205, 0.17, 0), cylG(0.004, 0.004, 0.11, 6, -0.155, 0.08, 0), boxG(0.03, 0.006, 0.03, -0.155, 0.026, 0, 0.002), cylG(0.003, 0.003, 0.05, 6, 0.03, 0.28, 0)];
  const hw = mergeInto([steel[0], new THREE.TorusGeometry(0.05, 0.006, 6, 24).rotateY(Math.PI / 2).translate(0.22, 0.17, 0)], M.iron({ color: '#c8c6c0', roughness: 0.25 }));
  hw.geometry.translate(-0.205, -0.17, 0); hw.position.set(0.205, headY + 0.17, -0.04);
  g.add(hw);
  g.add(at(mergeInto(steel.slice(1), M.iron({ color: '#b8b6b0', roughness: 0.3 })), 0, headY, -0.04));
  g.add(at(mesh(cylG(0.012, 0.012, 0.022, 14), M.matte('#8a1c1c', { roughness: 0.9 })), 0.03, headY + 0.27, -0.04)); // spool of red thread
  // gilt lining decal on the arm front
  const dec = textPlate('THE GAZELLE', 0.16, { style: 'gilt', pw: 512, ph: 96, font: FONTS.display });
  dec.position.set(-0.02, headY + 0.215, -0.04 + 0.035 + 0.0125); g.add(dec);
  let speed = running, phase = 0;
  g.userData.update = (dt) => {
    if (speed <= 0.001) return;
    phase += dt * speed * 9;
    fly.rotation.x = phase; hw.rotation.x = phase * 2.6;
    treadle.rotation.x = Math.sin(phase) * 0.12;
  };
  g.userData.setRunning = (v) => { speed = Math.max(0, v); };
  g.userData.handwheel = hw; g.userData.flywheel = fly; g.userData.treadle = treadle;
  return g;
}

// =====================================================================================================
// DRESSING ROOM: BULB MIRROR, DRESSING TABLE, CHAIR
// =====================================================================================================

/**
 * The star's swing mirror: a mahogany frame ringed with 12 bulbs (one InstancedMesh), silvered glass, on two uprights
 * with a horizontal pivot and two brass wing-nuts; the stand swivels through click-stops. Origin: centre of the base
 * on the table top; faces +Z. tilt (rad): 0 upright, positive tips the glass face-down (1.4 ≈ 80°).
 * userData: { frame (tilt pivot; rotation.x), swivel (group; rotation.y), setTilt(a, instant), setSwivel(stopIndex,
 * instant), stops, stop, setBulb(i, on), setAll(level), bulbs, wingNuts[2], glass, tuck(i) (a Vector3 on the frame's
 * lower rail, frame-local, for tucking telegrams), pivotY }. Cost: 7 draw calls.
 */
export function bulbMirror({ w = 0.62, h = 0.8, bulbs = 12, tilt = 0, stops = [-0.7, -0.35, 0, 0.35, 0.7], stop = 2, lit = 0 } = {}) {
  const g = grp('bulbMirror');
  const wood = M.mahogany();
  const bw = 0.075, pivotY = h / 2 + 0.09, ux = w / 2 + 0.03;
  const sw = grp('swivel'); g.add(sw);
  sw.add(mergeInto([boxG(w + 0.2, 0.035, 0.24, 0, 0.0175, 0, 0.01), boxG(0.032, pivotY + 0.05, 0.05, -ux, (pivotY + 0.05) / 2, 0, 0.008), boxG(0.032, pivotY + 0.05, 0.05, ux, (pivotY + 0.05) / 2, 0, 0.008),
    new THREE.SphereGeometry(0.022, 12, 8).translate(-ux, pivotY + 0.06, 0), new THREE.SphereGeometry(0.022, 12, 8).translate(ux, pivotY + 0.06, 0)], wood));
  const frame = grp('frame'); frame.position.y = pivotY; sw.add(frame);
  frame.add(mergeInto([boxG(w, bw, 0.04, 0, h / 2 - bw / 2, 0, 0.01), boxG(w, bw, 0.04, 0, -h / 2 + bw / 2, 0, 0.01), boxG(bw, h - bw * 2 + 0.01, 0.04, -w / 2 + bw / 2, 0, 0, 0.01), boxG(bw, h - bw * 2 + 0.01, 0.04, w / 2 - bw / 2, 0, 0, 0.01),
    boxG(w - 0.02, h - 0.02, 0.012, 0, 0, -0.016, 0.003), cylG(0.008, 0.008, w + 0.07, 8).rotateZ(Math.PI / 2)], wood));
  const glass = mesh(new THREE.PlaneGeometry(w - bw * 2 + 0.012, h - bw * 2 + 0.012), new THREE.MeshStandardMaterial({ color: '#d8dcd8', metalness: 1, roughness: 0.14, emissive: '#1c1f22' }), { cast: false });
  glass.position.z = 0.006; frame.add(glass);
  // bulb positions: 3 along each side, top and bottom (for 12)
  const pos = [], per = Math.max(1, Math.round(bulbs / 4));
  for (let i = 0; i < per; i++) {
    const tx = -w / 2 + bw / 2 + (w - bw) * (i + 0.5) / per * 0.999, ty = -h / 2 + bw / 2 + (h - bw) * (i + 0.5) / per;
    pos.push([tx * 0.86, h / 2 - bw / 2, 0.035], [tx * 0.86, -h / 2 + bw / 2, 0.035], [-w / 2 + bw / 2, ty * 0.74, 0.035], [w / 2 - bw / 2, ty * 0.74, 0.035]);
  }
  pos.length = Math.min(pos.length, bulbs);
  const bs = bulbSet(pos, { r: 0.021, color: '#ffe2b0', intensity: 2.3, lit, shape: 'round' });
  frame.add(bs);
  frame.add(mergeInto(pos.map(([x, y]) => cylG(0.017, 0.02, 0.018, 12).rotateX(Math.PI / 2).translate(x, y, 0.024)), M.porcelain('#ece4d2')));
  const wingNuts = [-1, 1].map((s) => {
    const wn = mergeInto([cylG(0.016, 0.016, 0.022, 12).rotateZ(Math.PI / 2), boxG(0.006, 0.07, 0.022, 0, 0, 0, 0.003), new THREE.SphereGeometry(0.012, 8, 6).scale(0.5, 1, 1).translate(0, 0.034, 0), new THREE.SphereGeometry(0.012, 8, 6).scale(0.5, 1, 1).translate(0, -0.034, 0)], M.brass());
    wn.position.set(s * (ux + 0.027), pivotY, 0); wn.name = 'wingNut';
    sw.add(wn); return wn;
  });
  let tiltCur = tilt, tiltTgt = tilt, swCur = stops[stop] ?? 0, swTgt = swCur;
  const apply = () => { frame.rotation.x = tiltCur; sw.rotation.y = swCur; wingNuts.forEach((wn, i) => { wn.rotation.x = tiltCur * 3 + swCur * 4 * (i ? 1 : -1); }); };
  apply();
  g.userData.update = (dt) => {
    if (Math.abs(tiltCur - tiltTgt) > 1e-4 || Math.abs(swCur - swTgt) > 1e-4) { tiltCur = chase(tiltCur, tiltTgt, dt, 9); swCur = chase(swCur, swTgt, dt, 10); apply(); }
  };
  g.userData.setTilt = (a, instant = false) => { tiltTgt = a; if (instant) { tiltCur = a; apply(); } };
  g.userData.setSwivel = (i, instant = false) => { g.userData.stop = i = THREE.MathUtils.clamp(i, 0, stops.length - 1); swTgt = stops[i]; if (instant) { swCur = swTgt; apply(); } };
  g.userData.stops = stops; g.userData.stop = stop;
  g.userData.setBulb = (i, on) => bs.userData.setBulb(i, on);
  g.userData.setAll = (v) => bs.userData.setAll(v);
  g.userData.setLit = g.userData.setAll;
  g.userData.bulbs = bs; g.userData.wingNuts = wingNuts; g.userData.glass = glass; g.userData.frame = frame; g.userData.swivel = sw;
  g.userData.pivotY = pivotY;
  g.userData.tuck = (i = 0) => new THREE.Vector3(-w / 2 + bw + 0.06 + i * 0.09, -h / 2 + bw + 0.03, 0.012);
  return g;
}

/**
 * Dressing table: mahogany top on turned legs, a row of small drawers under the top with enamel plaques, and a
 * hidden fifth drawer flush in the apron below (no handle). Origin: floor centre; the sitter is at +Z.
 * userData: { drawers[] (groups; slide out along +Z by position.z), setDrawer(i, 0..1), secret (group),
 * setSecret(0..1), topY, depth }. Items go inside a drawer group at y = 0, z < 0. Cost: 3 + 2·drawers draw calls.
 */
export function dressingTable({ w = 1.3, h = 0.76, d = 0.55, plaques = ['GLOVE', 'PEARL', 'FEATHER', 'LILY'], secret = true } = {}) {
  const g = grp('dressingTable');
  const wood = M.mahogany();
  const topT = 0.035, rowH = 0.12, apronH = 0.075;
  const rowY = h - topT - rowH / 2, apronY = h - topT - rowH - apronH / 2;
  const n = plaques.length, gap = 0.02, dw = (w - 0.12 - (n - 1) * gap) / n;
  const car = [boxG(w, topT, d, 0, h - topT / 2, 0, 0.008), boxG(w - 0.06, rowH + apronH, 0.02, 0, h - topT - (rowH + apronH) / 2, -d / 2 + 0.04, 0.003)];
  for (const s of [-1, 1]) car.push(boxG(0.02, rowH + apronH, d - 0.06, s * (w / 2 - 0.04), h - topT - (rowH + apronH) / 2, 0, 0.003));
  for (let i = 0; i <= n; i++) { // stiles between the drawers (wider at the ends)
    const x = -w / 2 + 0.06 + i * (dw + gap) - gap / 2, end = i === 0 ? -1 : i === n ? 1 : 0;
    car.push(boxG(end ? 0.04 : gap, rowH, 0.02, x + end * 0.01, rowY, d / 2 - 0.04, 0.002));
  }
  car.push(boxG(w - 0.05, 0.012, d - 0.07, 0, h - topT - rowH - 0.006, 0, 0.002)); // runner board
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    car.push(latheG([[0.001, 0], [0.018, 0], [0.022, 0.03], [0.016, 0.1], [0.02, 0.25], [0.026, 0.4], [0.022, 0.5], [0.03, h - topT - rowH - apronH - 0.02], [0.03, h - topT], [0.001, h - topT]], 12).translate(sx * (w / 2 - 0.045), 0, sz * (d / 2 - 0.05)));
  }
  g.add(mergeInto(car, wood));
  const drawers = [];
  const tray = (ww, hh, dd) => [boxG(ww - 0.01, 0.008, dd, 0, -hh / 2 + 0.006, -dd / 2, 0.001), boxG(0.008, hh - 0.02, dd, -ww / 2 + 0.009, -0.006, -dd / 2, 0.001), boxG(0.008, hh - 0.02, dd, ww / 2 - 0.009, -0.006, -dd / 2, 0.001), boxG(ww - 0.01, hh - 0.02, 0.008, 0, -0.006, -dd + 0.004, 0.001)];
  plaques.forEach((label, i) => {
    const dr = grp(`drawer:${label}`);
    const z0 = d / 2 - 0.03;
    dr.position.set(-w / 2 + 0.06 + dw / 2 + i * (dw + gap), rowY, z0);
    dr.add(mergeInto([boxG(dw - 0.004, rowH - 0.012, 0.02, 0, 0, 0, 0.004), ...tray(dw - 0.01, rowH - 0.012, d - 0.12), new THREE.SphereGeometry(0.011, 10, 8).scale(1, 1, 0.8).translate(0, -0.022, 0.014)], wood));
    const pl = textPlate(label, Math.min(0.1, dw * 0.6), { style: 'enamel', pw: 320, ph: 96, bg: '#efe8d8', fg: '#1a2a4a' });
    pl.position.set(0, 0.018, 0.0105); dr.add(pl);
    dr.userData.z0 = z0;
    g.add(dr); drawers.push(dr);
  });
  const sec = grp('secretDrawer');
  if (secret) {
    sec.position.set(0, apronY, d / 2 - 0.03);
    const sw = w * 0.5;
    sec.add(mergeInto([boxG(sw, apronH - 0.006, 0.02, 0, 0, 0, 0.002), ...tray(sw - 0.02, apronH - 0.006, d - 0.14)], wood));
    // the apron either side of the secret front (so it reads as one board)
    g.add(mergeInto([boxG((w - 0.06 - sw) / 2, apronH, 0.02, -(sw + (w - 0.06 - sw) / 2) / 2 - 0.0, apronY, d / 2 - 0.03, 0.002), boxG((w - 0.06 - sw) / 2, apronH, 0.02, (sw + (w - 0.06 - sw) / 2) / 2, apronY, d / 2 - 0.03, 0.002)], wood));
    sec.userData.z0 = d / 2 - 0.03;
    g.add(sec);
  }
  const travel = d * 0.55;
  g.userData.drawers = drawers;
  g.userData.setDrawer = (i, t) => { const dr = drawers[i]; if (dr) dr.position.z = dr.userData.z0 + travel * t; };
  g.userData.secret = sec;
  g.userData.setSecret = (t) => { sec.position.z = sec.userData.z0 + travel * t; };
  g.userData.topY = h; g.userData.depth = d;
  return g;
}

const bentwoodCache = {};
/** Geometries for a bentwood café chair (Thonet No. 14 type): { wood, cane }, origin floor centre, faces +Z. */
export function bentwoodGeometry() {
  if (bentwoodCache.g) return bentwoodCache.g;
  const R = 0.014, wood = [];
  wood.push(new THREE.TorusGeometry(0.205, 0.016, 6, 28).rotateX(Math.PI / 2).translate(0, 0.45, 0));
  for (const s of [-1, 1]) wood.push(tubeG([[s * 0.15, 0.445, 0.13], [s * 0.165, 0.25, 0.165], [s * 0.18, 0.0, 0.2]], R, { radial: 6, seg: 6 }));
  wood.push(tubeG([[-0.17, 0, -0.23], [-0.145, 0.25, -0.17], [-0.14, 0.45, -0.15], [-0.15, 0.68, -0.2], [-0.12, 0.86, -0.225], [0, 0.9, -0.235], [0.12, 0.86, -0.225], [0.15, 0.68, -0.2], [0.14, 0.45, -0.15], [0.145, 0.25, -0.17], [0.17, 0, -0.23]], R, { radial: 6, seg: 44, tension: 0.4 }));
  const loop = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; loop.push([Math.sin(a) * 0.09, 0.62 + Math.cos(a) * 0.12, -0.19 - Math.cos(a) * 0.015]); }
  wood.push(tubeG(loop, 0.009, { radial: 5, seg: 24, closed: true }));
  wood.push(new THREE.TorusGeometry(0.163, 0.009, 5, 24).rotateX(Math.PI / 2).scale(1, 1, 1.08).translate(0, 0.22, 0));
  const cane = cylG(0.198, 0.198, 0.012, 24, 0, 0.452, 0);
  bentwoodCache.g = { wood: mergeG(wood), cane: mergeG([cane]) };
  return bentwoodCache.g;
}
function caneMaterial() { return M.paintedCanvas({ tint: '#c8a868' }); }
/** Bentwood café chair (Thonet No. 14 type). Origin: floor centre; faces +Z; seat 0.45 m. 2 draw calls. */
export function bentwoodChair({ tint = '#4a2c18' } = {}) {
  const g = grp('bentwoodChair'), G = bentwoodGeometry();
  g.add(mesh(G.wood, M.walnut({ tint })), mesh(G.cane, caneMaterial()));
  return g;
}
export { caneMaterial };

// =====================================================================================================
// PAPERS, PHOTO FRAME
// =====================================================================================================

/**
 * A sheet of paper with a slight curl (and an optional centre fold), standing in the XY plane facing +Z; lay it on
 * a surface with rotation.x = -π/2. Origin: centre. userData: { setTexture(tex) }. 1 draw call.
 */
export function paperSheet({ w = 0.21, h = 0.297, texture = null, curl = 0.012, fold = 0, seed = 1 } = {}) {
  const geo = new THREE.PlaneGeometry(w, h, 8, 10), p = geo.attributes.position, r = rng(seed), wob = r() * TAU;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2);
    p.setZ(i, curl * (x * x * 0.6 + Math.max(0, y) ** 2 * 0.5) + fold * (1 - Math.abs(y)) + 0.002 * Math.sin(x * 3 + y * 2 + wob));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: texture || agedPaperTexture({ seed }), roughness: 0.9, side: THREE.DoubleSide });
  const m = mesh(geo, mat, { cast: true, receive: true });
  m.name = 'paperSheet';
  m.userData.setTexture = (t) => { mat.map = t; mat.needsUpdate = true; };
  return m;
}
/** A Post Office telegram (buff form, pasted tape). opts go to telegramTexture (lines, to, office, time, age, burnt). */
export function telegram({ w = 0.2, ...opts } = {}) {
  const m = paperSheet({ w, h: w * 440 / 640, texture: telegramTexture(opts), curl: 0.008, seed: opts.seed || 11 });
  m.name = 'telegram';
  return m;
}
/** A handwritten letter: lines in a looping hand on aged paper; sign appears bottom right. */
export function letter({ lines = ['My dearest L.,', 'The notices are wonderful.', 'Break a leg tonight.'], sign = '— D.', w = 0.15, seed = 5, ink = '#2a1c3a', fold = 0.004 } = {}) {
  const tex = agedPaperTexture({ w: 512, h: 680, seed, age: 0.5, fold: fold ? 'quarters' : null, key: `letter:${lines.join('|')}:${sign}`, draw: (g, W, H) => {
    g.fillStyle = ink; g.font = `28px ${FONTS.hand}`; g.textBaseline = 'alphabetic';
    lines.forEach((l, i) => g.fillText(l, 44, 90 + i * 52));
    g.textAlign = 'right'; g.fillText(sign, W - 50, 90 + (lines.length + 1) * 52);
  } });
  const m = paperSheet({ w, h: w * 680 / 512, texture: tex, fold, seed });
  m.name = 'letter';
  return m;
}

/**
 * Photograph in a standing frame (strut at the back) or on the wall (stand: false). style: 'silver' | 'gilt' | 'oak'.
 * texture: any (default a sepia company photo). Origin: bottom centre (standing) or centre-back (wall). Faces +Z.
 * userData: { photo, setPhoto(tex) }. Cost: 3 draw calls.
 */
export function photoFrame({ w = 0.18, h = 0.23, texture = null, style = 'silver', stand = true, border = 0.018 } = {}) {
  const g = grp('photoFrame');
  const face = grp('face'); g.add(face);
  const mat = style === 'gilt' ? M.gilt({ pattern: 'moulding' }) : style === 'oak' ? M.oak() : M.iron({ color: '#c4c2bc', roughness: 0.3 });
  const oy = stand ? h / 2 : 0, oz = stand ? 0.01 : 0.007;
  const parts = [boxG(w, border, 0.014, 0, oy + h / 2 - border / 2, oz, 0.004), boxG(w, border, 0.014, 0, oy - h / 2 + border / 2, oz, 0.004), boxG(border, h - border * 2, 0.014, -w / 2 + border / 2, oy, oz, 0.004), boxG(border, h - border * 2, 0.014, w / 2 - border / 2, oy, oz, 0.004), boxG(w - 0.01, h - 0.01, 0.004, 0, oy, oz - 0.006, 0.001)];
  face.add(mergeInto(parts, mat));
  const photoMat = new THREE.MeshStandardMaterial({ map: texture || sepiaPhotoTexture({ subject: 'company' }), roughness: 0.5 });
  const pw = w - border * 2 + 0.004, ph = h - border * 2 + 0.004;
  face.add(at(mesh(new THREE.PlaneGeometry(pw, ph), photoMat, { cast: false }), 0, oy, oz - 0.002));
  face.add(at(mesh(new THREE.PlaneGeometry(pw, ph), M.glass({ opacity: 0.1 }), { cast: false }), 0, oy, oz + 0.004));
  if (stand) {
    face.rotation.x = -0.12; // leans back on its strut
    g.add(mesh(mergeG([boxG(0.028, h * 0.78, 0.004, 0, 0, 0, 0.001).rotateX(0.42).translate(0, h * 0.36, -0.07)]), mat));
  }
  g.userData.photo = face.children[1];
  g.userData.setPhoto = (t) => { photoMat.map = t; photoMat.needsUpdate = true; };
  return g;
}

// =====================================================================================================
// LILIES, PERFUME
// =====================================================================================================

const lilyGeos = {};
function lilyGeometry(dried) {
  const key = dried ? 'd' : 'f';
  if (lilyGeos[key]) return lilyGeos[key];
  const pos = [], idx = [], rows = 7, cols = 3;
  for (let k = 0; k < 6; k++) {
    const phi = k * TAU / 6 + (k % 2) * 0.12, ax = Math.cos(phi), az = Math.sin(phi), px = -az, pz = ax;
    const base = pos.length / 3, len = dried ? 0.07 : 0.09;
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1);
      const rad = 0.004 + (dried ? 0.03 : 0.055) * t ** 1.5, axial = len * t - (dried ? 0.03 : 0.022) * t ** 3;
      const wid = (dried ? 0.012 : 0.02) * Math.sin(Math.PI * (0.12 + 0.88 * t)) * (dried ? 0.8 + 0.2 * Math.sin(t * 9 + k) : 1);
      for (let i = 0; i < cols; i++) {
        const u = i - 1, lat = u * wid / 2, cup = Math.abs(u) * (dried ? 0.006 : 0.004);
        pos.push(ax * (rad - cup) + px * lat, axial + (dried ? -0.012 * t * t * (k % 3) : 0), az * (rad - cup) + pz * lat);
      }
    }
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) { const a = base + j * cols + i, b = a + 1, c = a + cols, d = c + 1; idx.push(a, b, c, b, d, c); }
  }
  const petals = new THREE.BufferGeometry();
  petals.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); petals.setIndex(idx); petals.computeVertexNormals();
  const stamens = [];
  for (let k = 0; k < 6; k++) { const a = k * TAU / 6; stamens.push(tubeG([[0, 0.01, 0], [Math.cos(a) * 0.012, 0.05, Math.sin(a) * 0.012], [Math.cos(a) * 0.02, 0.075, Math.sin(a) * 0.02]], 0.0012, { radial: 3, seg: 4 })); }
  lilyGeos[key] = mergeG([petals, ...stamens]);
  return lilyGeos[key];
}

/**
 * A vase of lilies (fresh white or dried, papery brown), flowers instanced. Origin: base centre; ~0.65 m tall.
 * userData: { flowers (InstancedMesh), setShimmer(0..1) (a soft lilac glow and slow pulse for the finale) }.
 * Cost: 3 draw calls (+1 halo while shimmering).
 */
export function lilyVase({ dried = true, stems = 5, vase = '#d8d2c0', seed = 6 } = {}) {
  const g = grp('lilyVase'), r = rng(seed);
  const vh = 0.3;
  g.add(mesh(latheG([[0.001, 0], [0.05, 0], [0.056, 0.01], [0.045, 0.03], [0.07, 0.12], [0.064, 0.2], [0.036, 0.26], [0.046, vh], [0.04, vh], [0.03, 0.26], [0.001, 0.25]], 32), M.porcelain(vase)));
  const stemParts = [], flowers = [];
  for (let i = 0; i < stems; i++) {
    const a = i / stems * TAU + r() * 0.5, lean = 0.08 + r() * 0.12, top = vh + 0.22 + r() * 0.16;
    const tip = new THREE.Vector3(Math.cos(a) * lean, top, Math.sin(a) * lean);
    stemParts.push(tubeG([[Math.cos(a) * 0.01, vh - 0.12, Math.sin(a) * 0.01], [Math.cos(a) * lean * 0.3, vh + 0.05, Math.sin(a) * lean * 0.3], [tip.x, tip.y, tip.z]], 0.0035, { radial: 5, seg: 10 }));
    // a leaf blade
    const lb = new THREE.PlaneGeometry(0.018, 0.13, 1, 4), lp = lb.attributes.position;
    for (let k = 0; k < lp.count; k++) { const y = lp.getY(k); lp.setX(k, lp.getX(k) * (1 - Math.abs(y) / 0.07)); lp.setZ(k, 0.02 * (y / 0.065) ** 2); }
    lb.translate(0, 0.065, 0).rotateZ(-0.5 - r() * 0.4).rotateY(-a + Math.PI / 2).translate(Math.cos(a) * lean * 0.4, vh + 0.06, Math.sin(a) * lean * 0.4);
    stemParts.push(lb);
    const droop = dried ? 0.9 + r() * 0.6 : 0.5 + r() * 0.4;
    // flower axis: outward and up, drooping
    const dir = new THREE.Vector3(Math.cos(a) * Math.sin(droop), Math.cos(droop), Math.sin(a) * Math.sin(droop));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), e = new THREE.Euler().setFromQuaternion(q);
    flowers.push({ p: [tip.x, tip.y, tip.z], r: [e.x, e.y, e.z], s: 0.9 + r() * 0.25, c: dried ? (r() < 0.5 ? '#b89a6a' : '#a88a5e') : '#f4efe4' });
  }
  const stemMat = M.matte(dried ? '#6a5a36' : '#3a5a2a', { roughness: 0.8, unique: true }); stemMat.side = THREE.DoubleSide;
  g.add(mergeInto(stemParts, stemMat));
  const fm = instances(lilyGeometry(dried), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, side: THREE.DoubleSide }), flowers);
  g.add(fm);
  const hs = halo('#e4d6ff', 0.9, 0); hs.position.y = vh + 0.3; hs.visible = false; g.add(hs);
  let sh = 0, shT = 0;
  g.userData.update = (dt, t) => {
    if (sh < 0.001 && shT === 0) return;
    sh = chase(sh, shT, dt, 2);
    hs.visible = sh > 0.005;
    hs.material.opacity = sh * (0.35 + 0.15 * Math.sin(t * 1.3));
    hs.scale.setScalar(0.8 + 0.1 * Math.sin(t * 0.9));
  };
  g.userData.setShimmer = (v) => { shT = v; };
  g.userData.flowers = fm;
  return g;
}

/**
 * Cut-glass perfume atomiser: faceted amber bottle with scent, a gilt collar, a silk-netted squeeze bulb with a
 * tassel. Origin: base centre; ~0.12 m. userData: { bulb, squeeze() (a puff: the bulb squashes, a faint mist) }.
 * Cost: 5 draw calls.
 */
export function perfumeBottle({ glass = '#e8c890', scent = '#c0782a', bulb = '#8a2438' } = {}) {
  const g = grp('perfumeBottle');
  const body = latheG([[0.001, 0], [0.03, 0], [0.034, 0.004], [0.036, 0.05], [0.03, 0.068], [0.012, 0.078], [0.01, 0.088], [0.001, 0.088]], 8).toNonIndexed();
  body.computeVertexNormals();
  g.add(mesh(body, M.glass({ color: glass, opacity: 0.38 }), { cast: false }));
  g.add(mesh(latheG([[0.001, 0.004], [0.028, 0.004], [0.031, 0.04], [0.001, 0.04]], 8), M.glass({ color: scent, opacity: 0.7 }), { cast: false }));
  g.add(mergeInto([cylG(0.012, 0.012, 0.012, 16, 0, 0.092, 0), cylG(0.004, 0.003, 0.03, 8).rotateZ(Math.PI / 2).translate(-0.018, 0.095, 0)], M.brass()));
  const silk = M.matte(bulb, { roughness: 0.65 });
  g.add(mergeInto([tubeG([[0.01, 0.094, 0], [0.04, 0.1, 0], [0.065, 0.085, 0], [0.075, 0.065, 0]], 0.0025, { radial: 5 }), latheG([[0.001, 0], [0.004, 0.002], [0.008, 0.02], [0.001, 0.024]], 8).rotateZ(Math.PI).translate(0.078, 0.022, 0)], silk));
  const bm = mesh(new THREE.SphereGeometry(0.018, 14, 10).scale(1, 1.25, 1), silk); bm.position.set(0.078, 0.046, 0); g.add(bm);
  const mist = halo('#fff4e0', 0.12, 0); mist.position.set(-0.04, 0.096, 0); mist.visible = false; g.add(mist);
  let puff = 0;
  g.userData.update = (dt) => {
    if (puff <= 0) return;
    puff = Math.max(0, puff - dt * 1.8);
    const k = Math.sin(Math.min(1, (1 - puff) * 3) * Math.PI);
    bm.scale.set(1 + 0.15 * k, 1 - 0.3 * k, 1 + 0.15 * k);
    mist.visible = puff > 0; mist.material.opacity = 0.4 * puff; mist.scale.setScalar(0.06 + 0.2 * (1 - puff)); mist.position.x = -0.04 - 0.06 * (1 - puff);
  };
  g.userData.squeeze = () => { puff = 1; };
  g.userData.bulb = bm;
  return g;
}

// =====================================================================================================
// CLOAK, COATS, COAT STAND
// =====================================================================================================

/**
 * A hooded cloak hanging from its neck loop (dove grey by default), open down the front, hood hanging behind.
 * Origin: the hanging point (hook or the finale's quick-release wire). Faces +Z.
 * userData: { cloth, setBillow(0..1) (wind in the lower half; the finale's Q35), sway }. Cost: 2 draw calls.
 */
export function cloak({ color = '#a9a7a0', h = 1.45, hood = true, sway = 0.3, seed = 5 } = {}) {
  const g = grp('cloak');
  const S = (y, rx, rz, f = 0, z = 0) => ({ y, rx, rz, f, z });
  const secs = [S(-0.04, 0.05, 0.045), S(-0.09, 0.14, 0.12), S(-0.16, 0.23, 0.17, 0.006), S(-0.4, 0.29, 0.2, 0.02), S(-0.9, 0.35, 0.24, 0.04), S(-h, 0.42, 0.29, 0.055)];
  const geo = loftG(secs, { seg: 56, seed, arc: [0.16, TAU - 0.16], folds: [7, 11, 17] });
  const mat = M.velvetRed({ color, wear: 0.15, repeat: [2, 2], unique: true }); mat.side = THREE.DoubleSide;
  const cloth = mesh(geo, mat);
  g.add(cloth);
  const extra = [new THREE.TorusGeometry(0.05, 0.007, 6, 20).rotateX(Math.PI / 2).scale(1, 1, 0.9).translate(0, -0.04, 0)];
  if (hood) extra.push(loftG([S(-0.07, 0.09, 0.04, 0, -0.1), S(-0.13, 0.14, 0.07, 0.004, -0.17), S(-0.26, 0.13, 0.07, 0.006, -0.21), S(-0.38, 0.07, 0.04, 0, -0.215), S(-0.42, 0.01, 0.01, 0, -0.205)], { seg: 24, seed: seed + 1 }));
  const hm = mergeInto(extra, mat); g.add(hm);
  const p = geo.attributes.position, base = Float32Array.from(p.array);
  let billow = 0, billowT = 0, time = 0, acc = 0;
  const layout = () => {
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2], k = Math.max(0, -y - 0.2) / h;
      const wv = billow * k * (0.12 * Math.sin(time * 3.1 + y * 5 + x * 3) + 0.06 * Math.sin(time * 5.3 + x * 9));
      p.setXYZ(i, x + billow * k * 0.08 * Math.sin(time * 2 + y * 2), y + billow * k * k * 0.15, z + wv + billow * k * 0.25);
    }
    p.needsUpdate = true; geo.computeVertexNormals();
  };
  g.userData.update = (dt, t) => {
    time = t;
    if (sway) cloth.rotation.z = hm.rotation.z = Math.sin(t * 0.7) * 0.012 * sway;
    if (billow > 0.001 || billowT > 0) { billow = chase(billow, billowT, dt, 2); acc += dt; if (acc > 1 / 30) { acc = 0; layout(); } }
  };
  g.userData.setBillow = (v) => { billowT = v; };
  g.userData.cloth = cloth;
  return g;
}

/**
 * A long overcoat hanging by its collar loop from a brass wall hook, with an optional flat cap on the hook.
 * Origin: centre-back of the hook plate (on the wall); hangs toward +Z of the wall. The right-hand pocket's
 * world position is userData.pocket (local Vector3). userData: { cloth, cap, pocket }. Cost: 3–4 draw calls.
 */
export function coat({ color = '#5a3e26', cap = true, capColor = '#4a4238', hook = true, seed = 3 } = {}) {
  const g = grp('coat');
  const S = (y, rx, rz, f = 0, z = 0, x = 0) => ({ y, rx, rz, f, z, x });
  const zc = 0.14;
  const parts = [loftG([S(-0.03, 0.03, 0.025, 0, 0.05), S(-0.09, 0.1, 0.07, 0, zc - 0.03), S(-0.2, 0.17, 0.1, 0.004, zc), S(-0.34, 0.2, 0.11, 0.008, zc), S(-0.7, 0.21, 0.12, 0.018, zc), S(-1.15, 0.24, 0.13, 0.03, zc)], { seg: 32, seed, capTop: true })];
  for (const s of [-1, 1]) parts.push(loftG([S(-0.2, 0.055, 0.055, 0, zc + 0.01, s * 0.17), S(-0.5, 0.05, 0.05, 0.004, zc + 0.03, s * 0.2), S(-0.82, 0.058, 0.055, 0.006, zc + 0.04, s * 0.21)], { seg: 10, seed: seed + s, capBottom: true }));
  parts.push(boxG(0.13, 0.04, 0.03, 0.11, -0.78, zc + 0.12, 0.008).rotateY(0.25)); // pocket flap (right)
  parts.push(boxG(0.13, 0.04, 0.03, -0.11, -0.78, zc + 0.12, 0.008).rotateY(-0.25));
  const mat = garmentMaterial(color);
  const cloth = mergeInto(parts, mat); g.add(cloth);
  if (hook) g.add(mergeInto([boxG(0.03, 0.08, 0.008, 0, 0.0, 0.004, 0.003), tubeG([[0, 0.0, 0.008], [0, 0.0, 0.05], [0, 0.03, 0.07]], 0.005, { radial: 6, seg: 8 }), tubeG([[0, 0.02, 0.008], [0, 0.05, 0.03], [0, 0.08, 0.035]], 0.004, { radial: 6, seg: 8 })], M.brass()));
  let cm = null;
  if (cap) {
    cm = mergeInto([new THREE.SphereGeometry(0.11, 20, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.33, 1.12), new THREE.CircleGeometry(0.075, 16, -Math.PI * 0.1, Math.PI * 1.2).rotateX(-Math.PI / 2).rotateY(Math.PI).scale(1, 1, 0.9).translate(0, 0.002, 0.095).rotateX(0.1)], garmentMaterial(capColor));
    cm.material = garmentMaterial(capColor);
    cm.position.set(0, 0.035, 0.07); cm.rotation.set(-1.35, 0, 0.15);
    g.add(cm);
  }
  g.userData.cloth = cloth; g.userData.cap = cm;
  g.userData.pocket = new THREE.Vector3(0.11, -0.78, zc + 0.14);
  return g;
}

/**
 * Bentwood coat stand: a turned pole on four S-curved feet with six curled hooks. Origin: floor centre; ~1.85 m.
 * coat: true or coat() options to hang a coat (with cap) on the front hook. userData: { hooks: [Vector3], coat }.
 * Cost: 1 draw call (+ the coat).
 */
export function coatStand({ coat: withCoat = null, tint = '#4a2c18' } = {}) {
  const g = grp('coatStand');
  const parts = [cylG(0.02, 0.026, 1.72, 12, 0, 0.9, 0), new THREE.SphereGeometry(0.035, 12, 10).translate(0, 1.79, 0), cylG(0.03, 0.03, 0.04, 12, 0, 1.68, 0)];
  const hooks = [];
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    parts.push(tubeG([[c * 0.02, 0.32, s * 0.02], [c * 0.12, 0.18, s * 0.12], [c * 0.24, 0.12, s * 0.24], [c * 0.3, 0.02, s * 0.3], [c * 0.34, 0.012, s * 0.34]], 0.014, { radial: 8 }));
  }
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6, c = Math.sin(a), s = Math.cos(a), y = i % 2 ? 1.58 : 1.66;
    parts.push(tubeG([[c * 0.02, y - 0.06, s * 0.02], [c * 0.1, y, s * 0.1], [c * 0.16, y + 0.06, s * 0.16], [c * 0.19, y + 0.03, s * 0.19], [c * 0.17, y, s * 0.17]], 0.009, { radial: 6, seg: 14 }));
    hooks.push(new THREE.Vector3(c * 0.12, y + 0.01, s * 0.12));
  }
  g.add(mergeInto(parts, M.walnut({ tint })));
  g.userData.hooks = hooks;
  if (withCoat) {
    const c = coat({ ...(withCoat === true ? {} : withCoat), hook: false });
    c.position.copy(hooks[0]).add(new THREE.Vector3(0, 0, -0.1));
    g.add(c); g.userData.coat = c;
  }
  return g;
}

// =====================================================================================================
// CLIPBOARD, KETTLE, GAS RING
// =====================================================================================================

/**
 * Clipboard: hardboard with a steel spring clip and a sheet. Faces +Z, origin centre-back (lean it or lay it flat
 * with rotation.x = -π/2). userData: { paper, setPaper(tex) }. Cost: 3 draw calls.
 */
export function clipboard({ w = 0.23, h = 0.32, texture = null } = {}) {
  const g = grp('clipboard');
  g.add(mesh(boxG(w, h, 0.004, 0, 0, 0.002, 0.003), M.matte('#7a5638', { roughness: 0.8 })));
  const paper = paperSheet({ w: w - 0.02, h: h - 0.04, texture, curl: 0.004, seed: 9 });
  paper.position.set(0, -0.012, 0.0075); g.add(paper);
  g.add(mergeInto([boxG(0.1, 0.035, 0.01, 0, h / 2 - 0.03, 0.009, 0.004), cylG(0.006, 0.006, 0.1, 10).rotateZ(Math.PI / 2).translate(0, h / 2 - 0.012, 0.014), cylG(0.003, 0.003, 0.012, 6, -0.04, h / 2 - 0.012, 0.009), cylG(0.003, 0.003, 0.012, 6, 0.04, h / 2 - 0.012, 0.009)], M.iron({ color: '#a8a6a0', roughness: 0.3 })));
  g.userData.paper = paper;
  g.userData.setPaper = (t) => paper.userData.setTexture(t);
  return g;
}

/**
 * 1930s dome kettle (chrome or cream enamel) with a bakelite handle and knob, a swan spout and, for 'electric', a
 * cord socket at the back. Origin: base centre; spout toward +Z. userData: { setSteam(0..1) (puffs from the spout),
 * spoutTip }. Cost: 2 draw calls (+ steam sprites while steaming).
 */
export function kettle({ style = 'chrome', electric = true } = {}) {
  const g = grp('kettle');
  const body = latheG([[0.001, 0], [0.085, 0], [0.095, 0.008], [0.1, 0.05], [0.095, 0.1], [0.08, 0.14], [0.05, 0.168], [0.032, 0.178], [0.03, 0.186], [0.001, 0.186]], 36);
  const spout = tubeG([[0, 0.035, 0.085], [0, 0.07, 0.13], [0, 0.12, 0.155], [0, 0.15, 0.175]], 0.013, { radial: 10, seg: 12 });
  const metal = style === 'chrome' ? M.iron({ color: '#d4d2cc', roughness: 0.18 }) : M.enamel('#e8dfc8', { roughness: 0.3 });
  const mp = [body, spout];
  if (electric) mp.push(cylG(0.022, 0.022, 0.03, 12).rotateX(Math.PI / 2).translate(0, 0.04, -0.105));
  g.add(mergeInto(mp, metal));
  g.add(mergeInto([tubeG([[0, 0.15, -0.065], [0, 0.23, -0.06], [0, 0.25, -0.0], [0, 0.23, 0.055], [0, 0.17, 0.065]], 0.009, { radial: 8, seg: 18 }), new THREE.SphereGeometry(0.014, 12, 8).scale(1, 0.8, 1).translate(0, 0.196, 0), cylG(0.01, 0.01, 0.01, 10, 0, 0.188, 0)], M.bakelite()));
  const tip = new THREE.Vector3(0, 0.16, 0.18);
  const puffs = [];
  for (let i = 0; i < 6; i++) { const s = halo('#f4f2ee', 0.06, 0); s.blending = THREE.NormalBlending; s.material.blending = THREE.NormalBlending; s.visible = false; g.add(s); puffs.push({ s, t: i / 6 }); }
  let steam = 0;
  g.userData.update = (dt) => {
    if (steam <= 0.001) return;
    for (const p of puffs) {
      p.t = (p.t + dt * 0.7) % 1;
      p.s.visible = true;
      p.s.position.set(Math.sin(p.t * 7) * 0.01, tip.y + p.t * 0.35, tip.z + p.t * 0.12);
      p.s.scale.setScalar(0.04 + p.t * 0.2);
      p.s.material.opacity = steam * 0.3 * Math.sin(p.t * Math.PI);
    }
  };
  g.userData.setSteam = (v) => { steam = v; if (v <= 0.001) puffs.forEach((p) => { p.s.visible = false; }); };
  g.userData.spoutTip = tip;
  return g;
}

/**
 * Cast-iron gas ring on a little stand with a brass tap and a rubber hose; a ring of blue flames when lit.
 * Origin: base centre. userData: { setLit(0..1), topY (put a kettle here) }. Cost: 2 draw calls (+1 lit).
 */
export function gasRing({ lit = 0, withKettle = false } = {}) {
  const g = grp('gasRing');
  const iron = [cylG(0.11, 0.12, 0.02, 24, 0, 0.01, 0), cylG(0.07, 0.07, 0.04, 20, 0, 0.04, 0), new THREE.TorusGeometry(0.055, 0.012, 8, 28).rotateX(Math.PI / 2).translate(0, 0.065, 0)];
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3; iron.push(boxG(0.1, 0.012, 0.012, Math.cos(a) * 0.07, 0.085, Math.sin(a) * 0.07, 0.002).rotateY(-a)); }
  g.add(mergeInto(iron, M.ironBlack()));
  g.add(mergeInto([cylG(0.008, 0.008, 0.06, 8).rotateZ(Math.PI / 2).translate(0.1, 0.04, 0), boxG(0.012, 0.03, 0.006, 0.12, 0.06, 0, 0.002)], M.brass()));
  g.add(mesh(tubeG([[0.13, 0.04, 0], [0.18, 0.03, 0.04], [0.22, 0.01, 0.12], [0.3, 0.01, 0.2]], 0.008, { radial: 6 }), M.matte('#8a3a2a', { roughness: 0.6 })));
  const flames = [];
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16; flames.push({ p: [Math.cos(a) * 0.055, 0.075, Math.sin(a) * 0.055], r: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3] }); }
  const fl = noRay(instances(new THREE.ConeGeometry(0.008, 0.03, 6).translate(0, 0.015, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#4a7aff').multiplyScalar(2), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), flames, { cast: false, receive: false }));
  g.add(fl);
  let level = lit;
  const apply = () => { fl.visible = level > 0.01; fl.scale.set(1, 0.4 + 0.6 * level, 1); };
  apply();
  g.userData.update = (dt, t) => { if (level > 0.01) fl.scale.y = (0.4 + 0.6 * level) * (0.9 + 0.1 * Math.sin(t * 23)); };
  g.userData.setLit = (v) => { level = +v; apply(); };
  g.userData.topY = 0.09;
  if (withKettle) { const k = kettle({ electric: false }); k.position.y = 0.09; g.add(k); g.userData.kettle = k; }
  return g;
}

// Front-of-house props (PROPS): proscenium, auditorium seats, the Royal Box, chandelier, columns, balustrades,
// poster frames, box office, ticket rack, safe, kiosk, clocks and signs. Conventions as in stage.js.
import { THREE, M, TAU, mesh, noRay, grp, at, boxG, cylG, latheG, mergeG, mergeInto, tubeG, textPlate, texPlane, bulbSet, halo, chase, instances, rng } from './common.js';
import { drape, border } from './cloth.js';
import { labelPlate, posterTexture, dialTexture, FONTS, giltTexture } from '../theatre-textures.js';
import { makeCanvas, canvasTexture } from '../textures.js';
import { numberWheels } from './fittings.js';

// =====================================================================================================
// PROSCENIUM
// =====================================================================================================

/**
 * The proscenium arch: a gilt plaster frame with pilasters, a segmental arch, a moulded edge, a cartouche with the
 * theatre's name and a dark red wall field around it. Origin: centre of the opening at stage-floor level, on the
 * curtain line; the audience is at +Z. opening: [w, h] of the hole (to the crown of the arch).
 * userData: { opening: { w, h, spring }, cartouche, depth }. Cost: 5 draw calls.
 */
export function proscenium({ w = 13, h = 9, opening = [9.4, 6.8], depth = 0.5, name = 'EMPRESS', wall = '#4a1416', rise = 0.9 } = {}) {
  const g = grp('proscenium');
  const [ow, oh] = opening, spring = oh - rise; // where the arch springs from the pilasters
  // arch curve: a segmental arc through (±ow/2, spring) and (0, oh)
  const R = ((ow / 2) ** 2 + rise ** 2) / (2 * rise), cy = oh - R, a0 = Math.asin((ow / 2) / R);
  const archPts = (inset = 0, n = 40) => { const pts = []; for (let i = 0; i <= n; i++) { const a = -a0 + 2 * a0 * i / n; pts.push([Math.sin(a) * (R + inset), cy + Math.cos(a) * (R + inset)]); } return pts; };
  const frameShape = (outW, outH, inset) => {
    const s = new THREE.Shape();
    s.moveTo(-outW / 2, 0); s.lineTo(outW / 2, 0); s.lineTo(outW / 2, outH); s.lineTo(-outW / 2, outH); s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-ow / 2 - inset, 0); hole.lineTo(-ow / 2 - inset, spring);
    for (const [x, y] of archPts(inset)) hole.lineTo(x, y);
    hole.lineTo(ow / 2 + inset, 0); hole.closePath();
    s.holes.push(hole);
    return s;
  };
  // the gilt frame (1.1 m band around the opening), proud of the wall
  const band = 1.05;
  const outer = new THREE.Shape();
  outer.moveTo(-ow / 2 - band, 0); outer.lineTo(-ow / 2 - band, spring);
  for (const [x, y] of archPts(band)) outer.lineTo(x, y);
  outer.lineTo(ow / 2 + band, 0); outer.closePath();
  const inner = new THREE.Path();
  inner.moveTo(-ow / 2, 0); inner.lineTo(-ow / 2, spring); for (const [x, y] of archPts(0)) inner.lineTo(x, y); inner.lineTo(ow / 2, 0); inner.closePath();
  outer.holes.push(inner);
  const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 40 });
  frameGeo.translate(0, 0, -depth / 2);
  const giltMat = M.gilt({ pattern: 'acanthus', repeat: null });
  const frameMat = giltMat.clone(); frameMat.map = giltMat.map.clone(); frameMat.map.wrapS = frameMat.map.wrapT = THREE.RepeatWrapping; frameMat.map.repeat.set(0.9, 0.9); frameMat.map.needsUpdate = true;
  g.add(mesh(frameGeo, frameMat));
  // the wall field around it
  const wallGeo = new THREE.ShapeGeometry(frameShape(w, h, band - 0.02), 40).translate(0, 0, -depth / 2 - 0.02);
  g.add(mesh(wallGeo, M.wornPlaster({ tint: wall, repeat: [0.25, 0.25] }) /* ShapeGeometry UVs are metres */));
  // mouldings: a fat bead at the opening edge and a thinner one at the outer edge
  const bead = (inset, r) => {
    const pts = [[-ow / 2 - inset, 0, 0], [-ow / 2 - inset, spring, 0], ...archPts(inset, 30).map(([x, y]) => [x, y, 0]), [ow / 2 + inset, spring, 0], [ow / 2 + inset, 0, 0]];
    return tubeG(pts, r, { radial: 10, seg: 160, tension: 0.1 }).translate(0, 0, depth / 2 + 0.04);
  };
  g.add(mergeInto([bead(0.12, 0.07), bead(band - 0.08, 0.045), bead(0.5, 0.025)], M.gilt({ pattern: 'moulding' })));
  // pilaster plinths (marble) and capitals (gilt blocks)
  const pl = [];
  for (const s of [-1, 1]) {
    const x = s * (ow / 2 + band / 2);
    pl.push(boxG(band + 0.16, 0.9, depth + 0.2, x, 0.45, 0, 0.02));
  }
  g.add(mergeInto(pl, M.agedMarble({ base: '#d8cbb4', repeat: [1, 1] })));
  const caps = [];
  for (const s of [-1, 1]) { const x = s * (ow / 2 + band / 2); caps.push(boxG(band + 0.2, 0.22, depth + 0.24, x, spring - 0.1, 0, 0.03), boxG(band + 0.06, 0.12, depth + 0.16, x, spring - 0.28, 0, 0.02)); }
  g.add(mergeInto(caps, M.gilt({ pattern: 'moulding' })));
  // cartouche: a shield with the name, scrolls either side
  const cart = grp('cartouche');
  const cs = new THREE.Shape();
  cs.moveTo(-0.9, 0.35); cs.bezierCurveTo(-0.9, 0.7, -0.5, 0.75, 0, 0.62); cs.bezierCurveTo(0.5, 0.75, 0.9, 0.7, 0.9, 0.35);
  cs.bezierCurveTo(0.95, 0, 0.7, -0.45, 0, -0.62); cs.bezierCurveTo(-0.7, -0.45, -0.95, 0, -0.9, 0.35);
  const cg = new THREE.ExtrudeGeometry(cs, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 20 });
  const scrolls = [cg];
  for (const s of [-1, 1]) scrolls.push(new THREE.TorusGeometry(0.22, 0.06, 8, 20, Math.PI * 1.4).rotateZ(s > 0 ? -0.6 : Math.PI - 0.8).translate(s * 1.05, -0.05, 0.05));
  cart.add(mergeInto(scrolls, M.gilt({ pattern: 'plain' })));
  const plate = textPlate(name, 1.2, { style: 'gilt', pw: 1024, ph: 256, font: FONTS.display });
  plate.position.set(0, 0.02, 0.18); cart.add(plate);
  cart.position.set(0, oh + band * 0.45, depth / 2 + 0.02);
  g.add(cart);
  g.userData.cartouche = cart;
  g.userData.opening = { w: ow, h: oh, spring };
  g.userData.depth = depth;
  return g;
}

// =====================================================================================================
// AUDITORIUM SEATS
// =====================================================================================================

const seatGeoCache = {};
function seatParts() {
  if (seatGeoCache.parts) return seatGeoCache.parts;
  const W = 0.5;
  // padded back (velvet): a pillowed box bent into a shallow curve; a cap roll on top
  const pad = (pw, ph, pd, bend) => {
    const geo = new THREE.BoxGeometry(pw, ph, pd, 10, 8, 1), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i); let z = p.getZ(i);
      if (z > 0) z = pd / 2 * (1 - 0.7 * Math.abs(x / (pw / 2)) ** 4) * (1 - 0.7 * Math.abs(y / (ph / 2)) ** 4);
      p.setZ(i, z + bend * x * x);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const padBack = mergeG([pad(W - 0.06, 0.5, 0.08, 0.5).translate(0, 0.68, -0.02), new THREE.CylinderGeometry(0.04, 0.04, W - 0.08, 12).rotateZ(Math.PI / 2).translate(0, 0.95, -0.03)]);
  const shell = mergeG([boxG(W - 0.04, 0.56, 0.035, 0, 0.67, -0.075, 0.01)]);
  // tip-up seat: pivot at its back edge; cushion + wooden underside
  const seat = pad(W - 0.08, 0.44, 0.07, 0).rotateX(-Math.PI / 2).translate(0, 0.0, 0.22);
  const seatUnder = mergeG([boxG(W - 0.07, 0.02, 0.42, 0, -0.045, 0.22, 0.006)]);
  // cast-iron end standard with a scroll arm (shared between neighbours: one per gap)
  const st = new THREE.Shape();
  st.moveTo(-0.22, 0); st.lineTo(0.18, 0); st.lineTo(0.12, 0.05); st.bezierCurveTo(0.05, 0.25, 0.1, 0.45, 0.24, 0.58);
  st.lineTo(0.26, 0.62); st.lineTo(0.0, 0.64); st.bezierCurveTo(-0.12, 0.62, -0.16, 0.8, -0.13, 0.98); st.lineTo(-0.17, 0.98);
  st.bezierCurveTo(-0.2, 0.7, -0.18, 0.3, -0.2, 0.05); st.closePath();
  const hole = new THREE.Path(); hole.absellipse(-0.02, 0.3, 0.07, 0.14, 0, TAU, false); st.holes.push(hole);
  const standard = new THREE.ExtrudeGeometry(st, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 8 }).rotateY(-Math.PI / 2).translate(0.015, 0, 0);
  const arm = boxG(0.06, 0.035, 0.36, 0, 0.64, 0.1, 0.012);
  seatGeoCache.parts = { padBack, shell, seat, seatUnder, standard, arm, W };
  return seatGeoCache.parts;
}

function seatMats(color) {
  return {
    velvet: M.velvetRed({ color, wear: 0.45, repeat: [1, 1] }),
    wood: M.mahogany({ tint: '#3a1a10' }),
    iron: M.ironBlack(),
  };
}

/**
 * One tip-up auditorium seat (for close-ups; use makeRows for the house). Origin: floor centre under the seat;
 * the sitter faces +Z. userData: { seat (pivot: rotation.x, 0 = down, -1.45 = tipped up), setTipped(t) }. 5 draw calls.
 */
export function theatreSeat({ color = M.palette.velvetRed, tipped = 1, ends = true } = {}) {
  const g = grp('theatreSeat');
  const P = seatParts(), m = seatMats(color);
  g.add(mesh(P.padBack, m.velvet), mesh(P.shell, m.wood));
  const seat = grp('seat'); seat.position.set(0, 0.44, -0.06);
  seat.add(mesh(P.seat, m.velvet), mesh(P.seatUnder, m.wood));
  g.add(seat);
  if (ends) {
    const parts = [];
    for (const s of [-1, 1]) { parts.push(P.standard.clone().translate(s * P.W / 2, 0, 0)); }
    g.add(mergeInto(parts, m.iron));
    g.add(mergeInto([-1, 1].map((s) => P.arm.clone().translate(s * P.W / 2, 0, 0)), m.wood));
  }
  g.userData.seat = seat;
  g.userData.setTipped = (t) => { seat.rotation.x = -1.45 * t; };
  g.userData.setTipped(tipped);
  return g;
}

/**
 * Rows of tip-up seats, all instanced (6 draw calls for the whole block, any size). The front row's sitters face +Z
 * (the stage); further rows step back along -Z and rise by `rake`. Origin: floor at the front row's centre.
 * opts: rows, perRow (seats per row, or an array per row), spacing (centre to centre), rowGap, rake (rise per row),
 * curve (radius of the row arc centred toward the stage; 0 = straight), aisles (seat indices after which to leave a
 * gap), gap (aisle width), tipped (fraction of seats tipped up), down (explicit [row, seat] pairs left down),
 * steps (draw riser platforms), color, seed.
 * userData: { seats: [{ row, i, position (Vector3, local), rotationY }], count, rowY(r), rowZ(r) }.
 */
export function makeRows({ rows = 6, perRow = 12, spacing = 0.52, rowGap = 0.92, rake = 0.15, curve = 14, aisles = [], gap = 1.1, tipped = 0.9, down = [], steps = true, color = M.palette.velvetRed, seed = 3 } = {}) {
  const g = grp('seatRows');
  const P = seatParts(), m = seatMats(color), r = rng(seed);
  const items = { back: [], shell: [], seat: [], under: [], std: [], arm: [] };
  const seats = [];
  const tmp = new THREE.Object3D(), seatPivot = new THREE.Object3D();
  const isDown = (ri, i) => down.some(([a, b]) => a === ri && b === i);
  const faded = new THREE.Color();
  for (let ri = 0; ri < rows; ri++) {
    const n = Array.isArray(perRow) ? perRow[ri] : perRow;
    const y = ri * rake, rad = curve ? curve + ri * rowGap : 0;
    // x positions along the row (arc length when curved) with aisle gaps, centred
    const xs = []; let x = 0;
    for (let i = 0; i < n; i++) { xs.push(x); x += spacing + (aisles.includes(i) ? gap : 0); }
    const span = xs[xs.length - 1];
    // concentric rows round a centre at (0, curve) toward the stage; straight rows step back along -Z
    const place = (lx) => {
      const cx = lx - span / 2;
      if (!rad) return { p: [cx, y, -ri * rowGap], ry: 0 };
      const a = cx / rad;
      return { p: [Math.sin(a) * rad, y, curve - Math.cos(a) * rad], ry: -a };
    };
    for (let i = 0; i < n; i++) {
      const { p, ry } = place(xs[i]);
      const tip = isDown(ri, i) ? 0 : (r() < tipped ? 1 : 0.15 + r() * 0.2);
      faded.set(color).lerp(new THREE.Color('#8a5a4a'), r() * 0.25 + (r() < 0.06 ? 0.3 : 0));
      const c = faded.getHex();
      items.back.push({ p, r: [0, ry, 0], c }); items.shell.push({ p, r: [0, ry, 0] });
      // seat transform = row transform · pivot (local (0, 0.44, -0.06), tipped about X)
      tmp.position.set(...p); tmp.rotation.set(0, ry, 0); tmp.updateMatrix();
      seatPivot.position.set(0, 0.44, -0.06); seatPivot.rotation.set(-1.45 * tip, 0, 0); seatPivot.updateMatrix();
      const mtx = tmp.matrix.clone().multiply(seatPivot.matrix);
      items.seat.push({ m: mtx, c }); items.under.push({ m: mtx });
      seats.push({ row: ri, i, position: new THREE.Vector3(...p), rotationY: ry, tipped: tip });
      // standards + arms: one at each seat's right, plus the left end of each block
      if (i === 0 || aisles.includes(i - 1)) { const L = place(xs[i] - spacing / 2); items.std.push({ p: L.p, r: [0, L.ry, 0] }); items.arm.push({ p: L.p, r: [0, L.ry, 0] }); }
      const R2 = place(xs[i] + spacing / 2);
      items.std.push({ p: R2.p, r: [0, R2.ry, 0] }); items.arm.push({ p: R2.p, r: [0, R2.ry, 0] });
    }
  }
  const mk = (geo, mat, list, cast = true) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const o = new THREE.Object3D();
    list.forEach((it, i) => {
      if (it.m) im.setMatrixAt(i, it.m);
      else { o.position.set(...it.p); o.rotation.set(...it.r); o.scale.set(1, 1, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
      if (it.c !== undefined) im.setColorAt(i, new THREE.Color(it.c));
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = cast; im.receiveShadow = true;
    return im;
  };
  g.add(mk(P.padBack, m.velvet, items.back), mk(P.shell, m.wood, items.shell), mk(P.seat, m.velvet, items.seat), mk(P.seatUnder, m.wood, items.under), mk(P.standard, m.iron, items.std), mk(P.arm, m.wood, items.arm));
  if (steps && rake > 0) {
    const risers = [];
    for (let ri = 1; ri < rows; ri++) {
      const n = Array.isArray(perRow) ? perRow[ri] : perRow, wRow = n * spacing + aisles.length * gap + 0.6;
      const zc = curve ? 0 : -ri * rowGap;
      if (!curve) risers.push(boxG(wRow, ri * rake, rowGap, 0, ri * rake / 2, zc - 0.05, 0.002));
      else {
        const rad = curve + ri * rowGap, a = (wRow / 2) / rad;
        const ring = new THREE.RingGeometry(rad - rowGap / 2, rad + rowGap / 2, 48, 1, Math.PI / 2 - a, 2 * a).rotateX(-Math.PI / 2).translate(0, ri * rake, curve);
        risers.push(ring);
      }
    }
    if (risers.length) g.add(mergeInto(risers, M.wood({ tint: '#2a1a12', planks: 6, seed: 4, roughness: 0.8 })));
  }
  g.userData.seats = seats; g.userData.count = seats.length;
  g.userData.rowY = (ri) => ri * rake; g.userData.rowZ = (ri) => -ri * rowGap;
  return g;
}

// =====================================================================================================
// ROYAL BOX, COLUMNS, BALUSTRADES
// =====================================================================================================

/**
 * A marble column with an Ionic or Doric capital, fluted shaft with entasis, and an Attic base.
 * Origin: base centre on the floor. gildCapital: gilt capital. Cost: 3 draw calls.
 */
export function marbleColumn({ h = 3.2, r = 0.2, order = 'ionic', fluted = true, gildCapital = true, base = '#e2dacb' } = {}) {
  const g = grp('marbleColumn');
  const baseH = r * 1.1, capH = order === 'ionic' ? r * 1.0 : r * 0.7, shaftH = h - baseH - capH;
  const plinth = mergeG([boxG(r * 2.8, r * 0.4, r * 2.8, 0, r * 0.2, 0, 0.01), latheG([[r * 1.3, r * 0.4], [r * 1.32, r * 0.5], [r * 1.25, r * 0.62], [r * 1.12, r * 0.66], [r * 1.18, r * 0.76], [r * 1.12, r * 0.88], [r * 1.05, r * 0.95], [r * 1.05, baseH], [0, baseH]], 32)]);
  // shaft: lathe with entasis, flutes by radial displacement
  const segH = 24, segA = fluted ? 96 : 32, flutes = 20;
  const shaft = new THREE.CylinderGeometry(1, 1, shaftH, segA, segH, true);
  const p = shaft.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (y + shaftH / 2) / shaftH;
    const a = Math.atan2(x, z);
    const ent = r * (1 - 0.14 * Math.max(0, t - 0.33) ** 1.4);
    const fl = fluted ? 1 - 0.06 * Math.max(0, Math.cos(a * flutes)) ** 0.6 * (t > 0.03 && t < 0.97 ? 1 : 0) : 1;
    p.setXYZ(i, Math.sin(a) * ent * fl, y + baseH + shaftH / 2, Math.cos(a) * ent * fl);
  }
  shaft.computeVertexNormals();
  const marble = M.agedMarble({ base, repeat: [1, 2] });
  g.add(mesh(mergeG([plinth, shaft]), marble));
  const top = baseH + shaftH, rt = r * 0.86;
  let cap;
  if (order === 'ionic') {
    const parts = [latheG([[0, top], [rt * 1.06, top], [rt * 1.1, top + 0.03], [rt * 1.25, top + capH * 0.45], [0, top + capH * 0.45]], 32), boxG(r * 2.3, capH * 0.18, r * 2.3, 0, top + capH * 0.9, 0, 0.01)];
    for (const s of [-1, 1]) {
      // volute: a spiral tube on each side, both faces
      const pts = []; for (let i = 0; i <= 40; i++) { const tt = i / 40, a = tt * TAU * 1.6, rr = r * 0.32 * (1 - tt * 0.8); pts.push([s * (r * 1.0 + Math.cos(a) * rr * s), top + capH * 0.48 + Math.sin(a) * rr, 0]); }
      parts.push(tubeG(pts, r * 0.07, { radial: 6, seg: 50 }).scale(1, 1, 1).translate(0, 0, r * 0.75), tubeG(pts, r * 0.07, { radial: 6, seg: 50 }).translate(0, 0, -r * 0.75));
      parts.push(cylG(r * 0.36, r * 0.36, r * 1.5, 16).rotateX(Math.PI / 2).translate(s * r * 1.0, top + capH * 0.5, 0));
    }
    parts.push(boxG(r * 2.0, capH * 0.22, r * 1.5, 0, top + capH * 0.62, 0, 0.01));
    cap = mergeG(parts);
  } else {
    cap = mergeG([latheG([[0, top], [rt, top], [rt * 1.05, top + 0.02], [r * 1.35, top + capH * 0.6], [0, top + capH * 0.6]], 32), boxG(r * 2.8, capH * 0.4, r * 2.8, 0, top + capH * 0.8, 0, 0.01)]);
  }
  g.add(mesh(cap, gildCapital ? M.gilt({ pattern: 'plain' }) : marble));
  g.userData.height = h;
  return g;
}

const balusterGeo = new Map();
function baluster(h) {
  const k = h.toFixed(3);
  if (!balusterGeo.has(k)) balusterGeo.set(k, latheG([[0.045, 0], [0.045, 0.05], [0.03, 0.07], [0.035, 0.12], [0.065, 0.3], [0.06, 0.38], [0.03, 0.47], [0.024, 0.52], [0.04, 0.56], [0.04, 0.6], [0.035, 0.62]].map(([x, y]) => [x * h / 0.62 * 0.9, y * h / 0.62]), 16));
  return balusterGeo.get(k);
}
/**
 * A balustrade: plinth, turned balusters (instanced) and a moulded handrail; end posts.
 * Origin: centre of the plinth's base; runs along X, faces +Z. material: 'marble' | 'wood' | 'gilt'.
 * userData: { railY, w }. Cost: 3 draw calls.
 */
export function balustrade({ w = 3, h = 0.95, spacing = 0.16, material = 'marble', posts = true } = {}) {
  const g = grp('balustrade');
  const mat = material === 'wood' ? M.mahogany() : material === 'gilt' ? M.gilt({ pattern: 'plain' }) : M.agedMarble({ repeat: [w / 2, 1] });
  const plinthH = 0.12, railH = 0.1, bh = h - plinthH - railH;
  const solid = [boxG(w, plinthH, 0.24, 0, plinthH / 2, 0, 0.01), boxG(w + 0.04, railH * 0.6, 0.26, 0, h - railH * 0.3, 0, 0.02), boxG(w, railH * 0.4, 0.2, 0, h - railH * 0.8, 0, 0.01)];
  if (posts) for (const s of [-1, 1]) solid.push(boxG(0.26, h + 0.06, 0.28, s * (w / 2 - 0.13), (h + 0.06) / 2, 0, 0.012), boxG(0.3, 0.05, 0.32, s * (w / 2 - 0.13), h + 0.08, 0, 0.012));
  g.add(mergeInto(solid, mat));
  const list = []; const inner = w - (posts ? 0.3 : 0.1) * 2;
  const n = Math.max(1, Math.floor(inner / spacing));
  for (let i = 0; i < n; i++) list.push({ p: [-inner / 2 + inner * (i + 0.5) / n, plinthH, 0] });
  g.add(instances(baluster(bh), mat, list));
  g.userData.railY = h; g.userData.w = w;
  return g;
}

/**
 * The Royal Box front: a bowed parapet with gilt mouldings and a crowned cartouche, a velvet-padded rail, side
 * columns, a fringed pelmet and two tied-back curtains, a dark interior with two gilt chairs. Origin: the box floor at
 * the centre of its front edge; looks out toward +Z. userData: { rail (Mesh), railY, seatPos: [Vector3, Vector3],
 * curtains: [l, r], interior }. Cost: ~12 draw calls.
 */
export function royalBox({ w = 2.6, h = 2.7, d = 1.6, color = M.palette.velvetRed, chairs = true, crown = true } = {}) {
  const g = grp('royalBox');
  const bow = 0.35, ph = 0.95;
  // parapet: a bowed shell (front face) + inner face + top
  const arc = (rad, n = 24) => { const pts = []; const a = Math.asin((w / 2) / rad); for (let i = 0; i <= n; i++) { const t = -a + 2 * a * i / n; pts.push([Math.sin(t) * rad, Math.cos(t) * rad - rad + bow]); } return pts; };
  const R = ((w / 2) ** 2 + bow ** 2) / (2 * bow);
  const s = new THREE.Shape(); const outer = arc(R), inner = arc(R - 0.12).reverse();
  s.moveTo(outer[0][0], outer[0][1]); for (const [x, z] of outer) s.lineTo(x, z); for (const [x, z] of inner) s.lineTo(x, z); s.closePath();
  const par = new THREE.ExtrudeGeometry(s, { depth: ph, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2);
  // rotateX(-π/2): shape y → -z. we want shape "z" (forward) → +Z: flip
  par.scale(1, 1, -1); par.computeVertexNormals();
  const panelMat = M.gilt({ pattern: 'panel' });
  const pm = panelMat.clone(); pm.map = panelMat.map.clone(); pm.map.wrapS = pm.map.wrapT = THREE.RepeatWrapping; pm.map.repeat.set(1.2, 1); pm.map.needsUpdate = true;
  g.add(mesh(par, pm));
  // mouldings along the bow: top roll, base roll
  const bowPts = (rad, y) => arc(rad, 30).map(([x, z]) => [x, y, -(-z)]);
  const mould = [tubeG(bowPts(R + 0.02, ph - 0.02), 0.04, { radial: 8, seg: 60 }), tubeG(bowPts(R + 0.02, 0.04), 0.05, { radial: 8, seg: 60 }), tubeG(bowPts(R + 0.03, ph * 0.5), 0.02, { radial: 6, seg: 60 })];
  g.add(mergeInto(mould, M.gilt({ pattern: 'moulding' })));
  // velvet padded rail
  const rail = mesh(tubeG(bowPts(R - 0.06, ph + 0.05), 0.08, { radial: 12, seg: 60 }).scale(1, 0.7, 1), M.velvetRed({ color, wear: 0.5 }));
  g.add(rail);
  // floor + back wall + side walls (dark)
  const dark = M.wornPlaster({ tint: '#3a1214', repeat: [1, 1] });
  g.add(mesh(mergeG([boxG(w + 0.2, 0.08, d, 0, -0.04, bow - d / 2 - 0.05, 0.004)]), M.wood({ tint: '#2a1810' })));
  g.add(mesh(mergeG([boxG(w + 0.3, h, 0.1, 0, h / 2, bow - d - 0.05, 0.004), boxG(0.1, h, d, -w / 2 - 0.1, h / 2, bow - d / 2, 0.004), boxG(0.1, h, d, w / 2 + 0.1, h / 2, bow - d / 2, 0.004)]), dark));
  // columns either side and a pelmet with fringe
  for (const sx of [-1, 1]) { const c = marbleColumn({ h: h, r: 0.1, order: 'ionic', fluted: false }); c.position.set(sx * (w / 2 + 0.05), 0, bow * 0.3); g.add(c); }
  const pel = border({ w: w + 0.3, h: 0.4, color, fringe: true, sway: 0 });
  pel.position.set(0, h, bow * 0.3 + 0.08); g.add(pel);
  const curtains = [];
  for (const sx of [-1, 1]) {
    const c = drape({ w: 0.9, h: h - 0.4, color, anchor: sx < 0 ? 'left' : 'right', fringe: false, sway: 0.2, seed: sx > 0 ? 5 : 9, segY: 8, pleatW: 0.2, depth: 0.04 });
    c.userData.setGather(0.7);
    c.position.set(sx * (w / 2 - 0.35), h - 0.4, bow * 0.3);
    g.add(c); curtains.push(c);
  }
  // crowned cartouche on the front
  if (crown) {
    const cc = grp('crest');
    cc.add(mesh(mergeG([latheG([[0, 0], [0.2, 0], [0.22, 0.02], [0.2, 0.05], [0, 0.06]], 24).rotateX(Math.PI / 2),
      ...Array.from({ length: 5 }, (_, i) => cylG(0.012, 0.018, 0.09, 6, -0.12 + i * 0.06, 0.22, 0.04)),
      latheG([[0, 0], [0.15, 0], [0.16, 0.06], [0.0, 0.08]], 16).translate(0, 0.12, 0.04)]), M.gilt({ pattern: 'plain' })));
    cc.position.set(0, ph * 0.45, bow + 0.08); g.add(cc);
  }
  const seatPos = [new THREE.Vector3(-0.5, 0, bow - 0.7), new THREE.Vector3(0.5, 0, bow - 0.7)];
  if (chairs) for (const p of seatPos) { const c = giltChair({ color }); c.position.copy(p); g.add(c); }
  g.userData.rail = rail; g.userData.railY = ph + 0.05; g.userData.seatPos = seatPos; g.userData.curtains = curtains;
  return g;
}

/** A gilt open-arm chair with a velvet seat and back pad (Royal Box, foyer). Origin: floor centre; faces +Z. 2 draw calls. */
export function giltChair({ color = M.palette.velvetRed } = {}) {
  const g = grp('giltChair');
  const legs = [];
  for (const [x, z] of [[-0.22, 0.2], [0.22, 0.2], [-0.21, -0.2], [0.21, -0.2]]) legs.push(latheG([[0.012, 0], [0.022, 0.05], [0.018, 0.2], [0.026, 0.3], [0.024, 0.42], [0, 0.42]], 10).translate(x, 0, z));
  for (const s of [-1, 1]) { legs.push(tubeG([[s * 0.21, 0.42, -0.2], [s * 0.21, 0.7, -0.22], [s * 0.18, 0.95, -0.24]], 0.02, { radial: 6, seg: 12 })); legs.push(tubeG([[s * 0.21, 0.42, 0.18], [s * 0.23, 0.62, 0.12], [s * 0.21, 0.66, -0.15]], 0.016, { radial: 6, seg: 12 })); }
  legs.push(tubeG([[-0.18, 0.95, -0.24], [0, 1.0, -0.25], [0.18, 0.95, -0.24]], 0.022, { radial: 6, seg: 12 }), boxG(0.5, 0.06, 0.46, 0, 0.44, 0, 0.012));
  g.add(mergeInto(legs, M.gilt({ pattern: 'plain' })));
  g.add(mergeInto([boxG(0.46, 0.07, 0.42, 0, 0.49, 0.0, 0.03), boxG(0.32, 0.4, 0.05, 0, 0.73, -0.225, 0.02)], M.velvetRed({ color })));
  return g;
}

// =====================================================================================================
// CHANDELIER
// =====================================================================================================

/**
 * The foyer chandelier: a brass frame of `tiers` rings with S-scroll arms carrying candle bulbs, swags and drops of
 * glass prisms (one InstancedMesh of octahedra), a crown, a bottom finial, a pull-chain and a lift chain.
 * Origin: the ceiling hook. chain: chain length (m) above the body. userData: { body (Group: lower it with
 * setDrop), setDrop(m) (lowers the body, lengthening the chain), setLit(0..1, instant), bulbs, prisms, bulbPos
 * (local Vector3 of the centre of the lights, in body space), radius, height }. The prop makes no light.
 * Cost: 7 draw calls (~1,200 prisms in one).
 */
export function chandelier({ tiers = 4, radius = 1.0, chain = 1.2, arms = 8, prismsPerSwag = 9, lit = 0, seed = 2 } = {}) {
  const g = grp('chandelier');
  const body = grp('chandelierBody'); g.add(body);
  const r = rng(seed);
  const H = 0.55 + tiers * 0.32;
  const frame = [cylG(0.025, 0.025, H, 12, 0, -H / 2, 0)];
  const bulbP = [], prism = [], drops = [];
  const tierR = (i) => radius * (i === 0 ? 1 : i === 1 ? 0.8 : i === 2 ? 0.58 : 0.38) * (tiers === 4 ? 1 : 1 - i * 0.18);
  for (let i = 0; i < tiers; i++) {
    const y = -H + 0.25 + i * 0.32, R = tierR(i), n = Math.max(5, Math.round(arms * (1 - i * 0.18)));
    frame.push(new THREE.TorusGeometry(R * 0.55, 0.012, 6, 48).rotateX(Math.PI / 2).translate(0, y - 0.04, 0));
    frame.push(latheG([[0, y - 0.1], [0.08, y - 0.08], [0.1, y - 0.04], [0.06, y], [0, y]], 16));
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + i * 0.3, c = Math.cos(a), s = Math.sin(a);
      // S-scroll arm from the stem to the bobeche
      frame.push(tubeG([[c * 0.06, y - 0.06, s * 0.06], [c * R * 0.4, y - 0.12, s * R * 0.4], [c * R * 0.75, y - 0.02, s * R * 0.75], [c * R * 0.95, y + 0.04, s * R * 0.95]], 0.011, { radial: 5, seg: 14 }));
      frame.push(latheG([[0, 0], [0.045, 0.005], [0.04, 0.02], [0.014, 0.03], [0.014, 0.07], [0, 0.07]], 10).translate(c * R, y + 0.03, s * R));
      bulbP.push([c * R, y + 0.1, s * R]);
      // a swag of prisms to the next arm, and a drop under the bobeche
      const a2 = (k + 1) / n * TAU + i * 0.3, c2 = Math.cos(a2), s2 = Math.sin(a2);
      for (let j = 1; j < prismsPerSwag; j++) {
        const t = j / prismsPerSwag, sag = Math.sin(t * Math.PI) * 0.12;
        const x = (c * (1 - t) + c2 * t) * R * 0.98, z = (s * (1 - t) + s2 * t) * R * 0.98;
        prism.push({ p: [x, y - sag, z], r: [r() * 0.4, r() * TAU, 0], s: 0.018 });
      }
      for (let j = 0; j < 3; j++) prism.push({ p: [c * R, y - 0.02 - j * 0.045, s * R], r: [0, r() * TAU, 0], s: j === 2 ? [0.025, 0.05, 0.025] : 0.016 });
      drops.push([c * R, y - 0.16, s * R]);
    }
    // inner curtain of prism strings round the stem
    for (let k = 0; k < n * 2; k++) {
      const a = k / (n * 2) * TAU, rr = R * 0.5;
      for (let j = 0; j < 5; j++) prism.push({ p: [Math.cos(a) * rr, y - 0.08 - j * 0.04, Math.sin(a) * rr], r: [0, r() * TAU, 0], s: 0.014 });
    }
  }
  // crown + finial
  frame.push(latheG([[0, 0], [0.06, 0], [0.18, -0.08], [0.22, -0.16], [0.2, -0.2], [0, -0.2]], 20));
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; frame.push(tubeG([[Math.cos(a) * 0.2, -0.16, Math.sin(a) * 0.2], [Math.cos(a) * 0.3, -0.02, Math.sin(a) * 0.3], [Math.cos(a) * 0.24, 0.06, Math.sin(a) * 0.24]], 0.008, { radial: 4, seg: 8 })); }
  frame.push(latheG([[0, -H - 0.25], [0.04, -H - 0.2], [0.08, -H - 0.1], [0.05, -H - 0.02], [0.03, -H], [0, -H]], 16));
  body.add(mergeInto(frame, M.tarnishedBrass({ amount: 0.45 })));
  // prisms: octahedra, glassy; lit by a unique material whose emissive follows setLit
  const prismMat = new THREE.MeshPhysicalMaterial({ color: '#e8f0f4', roughness: 0.04, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.8, emissive: '#ffd9a0', emissiveIntensity: 0, envMapIntensity: 2, flatShading: true });
  for (const d of drops) prism.push({ p: d, r: [0, r() * TAU, 0], s: [0.03, 0.07, 0.03] });
  const prisms = instances(new THREE.OctahedronGeometry(1, 0), prismMat, prism, { cast: false });
  body.add(prisms);
  const bulbs = bulbSet(bulbP, { r: 0.016, shape: 'candle', lit: 0, intensity: 2.6 });
  body.add(bulbs);
  // candle sleeves
  body.add(instances(cylG(0.014, 0.014, 0.07, 8, 0, 0.035, 0), M.porcelain('#efe7d4'), bulbP.map(([x, y, z]) => ({ p: [x, y - 0.075, z] })), { cast: false }));
  const hs = halo('#ffdcaa', radius * 3.2, 0.5); hs.position.y = -H * 0.55; body.add(hs);
  // chain (instanced links) + pull chain
  const link = new THREE.TorusGeometry(0.03, 0.008, 6, 10).scale(1, 1.5, 1);
  const maxLinks = 220, pitch = 0.075;
  const chainIM = new THREE.InstancedMesh(link, M.tarnishedBrass({ amount: 0.6 }), maxLinks);
  const o = new THREE.Object3D();
  for (let i = 0; i < maxLinks; i++) { o.position.set(0, -i * pitch - 0.04, 0); o.rotation.set(0, i % 2 ? Math.PI / 2 : 0, 0); o.updateMatrix(); chainIM.setMatrixAt(i, o.matrix); }
  chainIM.castShadow = true;
  g.add(chainIM);
  g.add(mergeInto([latheG([[0, 0], [0.16, 0], [0.16, -0.03], [0.08, -0.06], [0, -0.07]], 20), new THREE.TorusGeometry(0.03, 0.008, 6, 12).translate(0, -0.06, 0)], M.tarnishedBrass({ amount: 0.5 })));
  const pull = mergeInto([tubeG([[0.06, -H - 0.1, 0], [0.065, -H - 0.5, 0.01], [0.06, -H - 0.9, 0]], 0.004, { radial: 4, seg: 20 }), latheG([[0, 0], [0.02, 0.01], [0.022, 0.04], [0, 0.06]], 10).translate(0.06, -H - 0.96, 0)], M.brass());
  body.add(pull);
  let drop = 0;
  const setDrop = (m) => {
    drop = Math.max(0, m);
    body.position.y = -chain - drop;
    chainIM.count = Math.min(maxLinks, Math.ceil((chain + drop) / pitch));
  };
  setDrop(0);
  let level = 0, target = lit;
  const apply = () => { bulbs.userData.setAll(level); prismMat.emissiveIntensity = 0.35 * level; hs.material.opacity = 0.5 * level; hs.visible = level > 0.01; };
  g.userData.update = (dt) => { if (Math.abs(level - target) > 0.001) { level = chase(level, target, dt, 2.5); apply(); } };
  g.userData.setLit = (t, instant) => { target = +t; if (instant) { level = target; apply(); } };
  level = lit; apply();
  g.userData.body = body; g.userData.setDrop = setDrop; g.userData.bulbs = bulbs; g.userData.prisms = prisms; g.userData.pull = pull;
  g.userData.bulbPos = new THREE.Vector3(0, -H * 0.55, 0); g.userData.radius = radius; g.userData.height = H;
  return g;
}

// =====================================================================================================
// POSTERS, BOX OFFICE, TICKETS, SAFE, KIOSK
// =====================================================================================================

/**
 * A wall poster frame: a moulded gilt (or oak) frame with a glazed door hinged on its left, a small brass lock, and
 * the poster behind. Origin: centre-back (wall mounted); faces +Z.
 * texture: a poster (posterTexture({...})); door: true for a glazed hinged door.
 * userData: { door (pivot, rotation.y: 0 shut, -1.6 open), setOpen(0..1), poster (Mesh), setPoster(tex), inner: { w, h } }.
 * Cost: 4–5 draw calls.
 */
export function posterFrame({ w = 0.8, h = 1.15, texture = null, style = 'gilt', door = true, border = 0.07 } = {}) {
  const g = grp('posterFrame');
  const mat = style === 'gilt' ? M.gilt({ pattern: 'moulding' }) : style === 'black' ? M.enamel('#141210', { roughness: 0.4 }) : M.oak({ tint: '#5a3a20' });
  const fd = 0.05;
  const mould = (len, rot, x, y) => {
    // bevelled moulding profile extruded along its length
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(border, 0); s.lineTo(border, fd * 0.5); s.quadraticCurveTo(border * 0.7, fd * 1.1, border * 0.35, fd); s.lineTo(0, fd * 0.7); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 4 });
    geo.rotateY(Math.PI / 2).translate(-len / 2, 0, 0); // along X; profile in Y (width) / Z (depth): fix axes
    // after rotateY: shape x → -z ... remap: we want width inward (y), depth out (+z)
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i); p.setXYZ(i, X, -Z, Y); }
    geo.computeVertexNormals();
    geo.rotateZ(rot).translate(x, y, 0);
    return geo;
  };
  const W = w + border * 2, H = h + border * 2;
  // four mitred bars approximated by overlapping full-length bars (the ends tuck under each other)
  const bars = [mould(W, 0, 0, -H / 2), mould(W, Math.PI, 0, H / 2), mould(H, -Math.PI / 2, -W / 2, 0), mould(H, Math.PI / 2, W / 2, 0)];
  // bars are drawn from the outer edge inward: outer edge at y offset, width points toward the centre
  g.add(mergeInto(bars, mat));
  g.add(mesh(boxG(W - 0.01, H - 0.01, 0.012, 0, 0, 0.006, 0.002), M.wood({ tint: '#2a1a10' })));
  const posterMat = new THREE.MeshStandardMaterial({ map: texture || posterTexture({}), roughness: 0.85 });
  const poster = mesh(new THREE.PlaneGeometry(w + 0.01, h + 0.01), posterMat, { cast: false });
  poster.position.z = 0.014; g.add(poster);
  if (door) {
    const d = grp('door'); d.position.set(-W / 2 + border * 0.5, 0, fd + 0.004);
    const dw = W - border, dh = H - border;
    const df = [boxG(dw, 0.02, 0.012, dw / 2, dh / 2 - 0.01, 0, 0.003), boxG(dw, 0.02, 0.012, dw / 2, -dh / 2 + 0.01, 0, 0.003), boxG(0.02, dh, 0.012, 0.01, 0, 0, 0.003), boxG(0.02, dh, 0.012, dw - 0.01, 0, 0, 0.003)];
    d.add(mergeInto(df, style === 'gilt' ? M.gilt({ pattern: 'plain' }) : mat));
    const gl = mesh(new THREE.PlaneGeometry(dw - 0.03, dh - 0.03).translate(dw / 2, 0, 0.002), M.glass({ color: '#e0ecf0', opacity: 0.16 }), { cast: false });
    d.add(gl);
    d.add(at(mesh(mergeG([cylG(0.012, 0.012, 0.01, 12).rotateX(Math.PI / 2), boxG(0.004, 0.012, 0.002, 0, 0, 0.006, 0.001)]), M.brass()), dw - 0.03, 0, 0.008));
    g.add(d);
    g.userData.door = d;
    g.userData.setOpen = (t) => { d.rotation.y = -1.6 * t; };
  }
  g.userData.poster = poster;
  g.userData.setPoster = (tex) => { posterMat.map = tex; posterMat.needsUpdate = true; };
  g.userData.inner = { w, h };
  return g;
}

/**
 * Box-office window: a mahogany booth front with a round-headed glazed window behind a brass grille, a speaking
 * grille, a counter with a brass edge and a scooped money dip, and a gilt fascia. Origin: floor centre on the
 * customer side face; customer stands at +Z. userData: { glass, counterY, dipPos (Vector3), fascia, inside (Vector3:
 * a point behind the glass for the clerk) }. Cost: ~8 draw calls.
 */
export function boxOfficeWindow({ w = 1.8, h = 2.5, label = 'BOX OFFICE', openTo = null } = {}) {
  const g = grp('boxOffice');
  const ww = 0.8, wh = 0.7, wy = 1.15, counterY = 1.0;
  // panel with an arched window hole
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
  const hole = new THREE.Path(); hole.moveTo(-ww / 2, wy); hole.lineTo(ww / 2, wy); hole.lineTo(ww / 2, wy + wh - ww / 2); hole.absarc(0, wy + wh - ww / 2, ww / 2, 0, Math.PI, false); hole.lineTo(-ww / 2, wy); s.holes.push(hole);
  const panel = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 20 });
  const wood = M.mahogany();
  const parts = [panel];
  // raised panels below the counter
  for (const sx of [-1, 1]) parts.push(boxG(w * 0.38, 0.6, 0.03, sx * w * 0.22, 0.45, 0.095, 0.015));
  parts.push(boxG(w + 0.1, 0.06, 0.12, 0, 0.03, 0.04, 0.01)); // skirting
  parts.push(boxG(w + 0.14, 0.08, 0.16, 0, h + 0.04, 0.04, 0.015)); // cornice
  g.add(mergeInto(parts, wood));
  // counter (marble top, brass nosing) with a money dip
  const ct = mesh(boxG(w * 0.75, 0.04, 0.32, 0, counterY, 0.16, 0.01), M.agedMarble({ base: '#d8d0c0' }));
  g.add(ct);
  g.add(mergeInto([cylG(0.014, 0.014, w * 0.75, 10).rotateZ(Math.PI / 2).translate(0, counterY + 0.005, 0.32), boxG(0.06, 0.02, 0.04, -w * 0.375 + 0.04, counterY - 0.03, 0.28, 0.004), boxG(0.06, 0.02, 0.04, w * 0.375 - 0.04, counterY - 0.03, 0.28, 0.004)], M.brass()));
  const dip = mesh(new THREE.SphereGeometry(0.12, 20, 8, 0, TAU, Math.PI * 0.62, Math.PI * 0.38).scale(1.3, 0.35, 0.8).translate(0, counterY + 0.06, 0.06), M.brass({ color: '#a8843a', roughness: 0.25 }));
  dip.material = M.brass({ color: '#a8843a', roughness: 0.25 }); dip.material.side = THREE.FrontSide;
  g.add(dip);
  // glass and grille
  const glassGeo = new THREE.ShapeGeometry((() => { const q = new THREE.Shape(); q.moveTo(-ww / 2, wy); q.lineTo(ww / 2, wy); q.lineTo(ww / 2, wy + wh - ww / 2); q.absarc(0, wy + wh - ww / 2, ww / 2, 0, Math.PI, false); q.closePath(); return q; })(), 20).translate(0, 0, 0.04);
  const glass = mesh(glassGeo, M.glass({ color: '#d8e4e0', opacity: 0.2 }), { cast: false });
  g.add(glass);
  const bars = [];
  for (let i = 1; i < 9; i++) { const x = -ww / 2 + ww * i / 9; const top = wy + wh - ww / 2 + Math.sqrt(Math.max(0, (ww / 2) ** 2 - x * x)); bars.push(cylG(0.006, 0.006, top - wy, 6, x, wy + (top - wy) / 2, 0.1)); }
  bars.push(new THREE.TorusGeometry(ww / 2 - 0.01, 0.008, 6, 24, Math.PI).translate(0, wy + wh - ww / 2, 0.1), boxG(ww, 0.015, 0.015, 0, wy + 0.2, 0.1, 0.003), boxG(ww, 0.015, 0.015, 0, wy + 0.45, 0.1, 0.003));
  // speaking grille: a pierced brass disc set in the glass
  bars.push(new THREE.TorusGeometry(0.07, 0.008, 6, 24).translate(0, wy + 0.32, 0.06));
  g.add(mergeInto(bars, M.tarnishedBrass({ amount: 0.35 })));
  // the cash slot under the glass
  g.add(mesh(boxG(0.36, 0.04, 0.12, 0, counterY + 0.02, 0.0, 0.004), M.matte('#0a0806')));
  const fascia = textPlate(label, w * 0.8, { style: 'gilt', pw: 1024, ph: 160, font: FONTS.display });
  fascia.position.set(0, h - 0.2, 0.095); g.add(fascia);
  g.userData.glass = glass; g.userData.counterY = counterY + 0.02; g.userData.dipPos = new THREE.Vector3(0, counterY + 0.04, 0.06);
  g.userData.fascia = fascia; g.userData.inside = new THREE.Vector3(0, 1.3, -0.5);
  return g;
}

/**
 * Ticket rack: a wooden case of pigeonholes (rows lettered A..), each with a bundle of coloured card tickets
 * (instanced) or empty. fill: fraction filled. Origin: base centre (stands on a shelf); faces +Z.
 * userData: { slotPos(row, col) → Vector3 (local), rows, cols }. Cost: 4 draw calls.
 */
export function ticketRack({ rows = 6, cols = 8, cell = 0.07, fill = 0.75, seed = 5, colors = ['#e8d090', '#d89090', '#90b0d8', '#a8d0a0', '#e8e0d0', '#d0a8d8'] } = {}) {
  const g = grp('ticketRack');
  const W = cols * cell, H = rows * cell, D = 0.18, t = 0.008, r = rng(seed);
  const wood = [boxG(W + 0.03, 0.02, D, 0, 0.01, 0, 0.004), boxG(W + 0.03, 0.02, D, 0, H + 0.03, 0, 0.004), boxG(0.015, H + 0.04, D, -W / 2 - 0.008, H / 2 + 0.02, 0, 0.003), boxG(0.015, H + 0.04, D, W / 2 + 0.008, H / 2 + 0.02, 0, 0.003), boxG(W, H, 0.01, 0, H / 2 + 0.02, -D / 2 + 0.005, 0.002)];
  for (let i = 1; i < rows; i++) wood.push(boxG(W, t, D - 0.01, 0, 0.02 + i * cell, 0.005));
  for (let j = 1; j < cols; j++) wood.push(boxG(t, H, D - 0.01, -W / 2 + j * cell, H / 2 + 0.02, 0.005));
  g.add(mergeInto(wood, M.oak({ tint: '#6a4a2a' })));
  const list = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    if (r() > fill) continue;
    const n = 0.3 + r() * 0.7;
    list.push({ p: [-W / 2 + (j + 0.5) * cell, 0.02 + i * cell + 0.004 + cell * 0.32 * n, 0.02 + r() * 0.01], r: [-0.12, (r() - 0.5) * 0.1, (r() - 0.5) * 0.06], s: [cell * 0.8, cell * 0.64 * n, D * 0.7], c: colors[i % colors.length] });
  }
  g.add(instances(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), list));
  // row letters on a strip
  const c = makeCanvas(64, 64 * rows), cg = c.getContext('2d');
  cg.fillStyle = '#e8dfc8'; cg.fillRect(0, 0, 64, 64 * rows); cg.fillStyle = '#1a1208'; cg.font = `44px ${FONTS.fell}`; cg.textAlign = 'center'; cg.textBaseline = 'middle';
  for (let i = 0; i < rows; i++) cg.fillText(String.fromCharCode(65 + i), 32, 64 * (rows - i - 0.5));
  g.add(at(mesh(new THREE.PlaneGeometry(0.03, H), new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.8 })), -W / 2 - 0.03, H / 2 + 0.02, D / 2 - 0.02));
  g.userData.slotPos = (i, j) => new THREE.Vector3(-W / 2 + (j + 0.5) * cell, 0.02 + i * cell + cell / 2, 0.02);
  g.userData.rows = rows; g.userData.cols = cols;
  return g;
}

function safeDoorTexture({ color, maker }) {
  const w = 512, h = 640, c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  // gold coachlines
  g.strokeStyle = '#c9a24a'; g.lineWidth = 5; g.strokeRect(36, 36, w - 72, h - 72); g.lineWidth = 2; g.strokeRect(50, 50, w - 100, h - 100);
  for (const [x, y] of [[50, 50], [w - 50, 50], [50, h - 50], [w - 50, h - 50]]) { g.beginPath(); g.arc(x, y, 12, 0, TAU); g.stroke(); }
  g.fillStyle = '#c9a24a'; g.font = `italic 30px ${FONTS.fell}`; g.textAlign = 'center';
  g.fillText(maker[0], w / 2, 100); g.font = `20px ${FONTS.fell}`; g.fillText(maker[1], w / 2, 128);
  // wear around the handle and dial
  const gr = g.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.45, 160); gr.addColorStop(0, 'rgba(20,16,10,0.35)'); gr.addColorStop(1, 'rgba(20,16,10,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '10,8,6' : '120,120,90'},${Math.random() * 0.15})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 1 + Math.random() * 3); }
  return canvasTexture(c);
}

/**
 * A Victorian green iron safe on a plinth: hinged door (left hinge), a combination dial with 100 divisions, a
 * T-handle, a brass maker's plate, a keyhole escutcheon and a register window showing `wheels` number wheels.
 * Origin: floor centre; the door faces +Z.
 * userData: { door (pivot, rotation.y: 0 shut, -1.9 open), setOpen(0..1), dial (rotation.z; dialValue(v) sets it to
 * a number 0..99 under the index), handle (rotation.z), register (numberWheels group: setValue/step), interior
 * (Object3D on the floor of the safe) }. Cost: ~11 draw calls.
 */
export function safe({ w = 0.72, h = 1.05, d = 0.68, color = '#2f4a3a', maker = ['Hobbs & Pelham', 'FIRE-RESISTING  ·  LONDON'], wheels = 4 } = {}) {
  const g = grp('safe');
  const paint = M.enamel(color, { roughness: 0.4 });
  const plinth = 0.1, wall = 0.07;
  g.add(mergeInto([boxG(w + 0.04, plinth, d + 0.04, 0, plinth / 2, 0, 0.01)], M.ironBlack()));
  // carcass with the door opening
  const carc = [boxG(w, h, wall, 0, plinth + h / 2, -d / 2 + wall / 2, 0.02), boxG(wall, h, d, -w / 2 + wall / 2, plinth + h / 2, 0, 0.02), boxG(wall, h, d, w / 2 - wall / 2, plinth + h / 2, 0, 0.02), boxG(w, wall, d, 0, plinth + wall / 2, 0, 0.02), boxG(w, wall, d, 0, plinth + h - wall / 2, 0, 0.02)];
  g.add(mergeInto(carc, paint));
  const interior = grp('interior'); interior.position.set(0, plinth + wall, 0); g.add(interior);
  g.add(mesh(boxG(w - wall * 2 - 0.01, 0.015, d - wall - 0.04, 0, plinth + h * 0.55, wall / 2 - 0.02, 0.003), M.ironBlack()));
  // door
  const door = grp('door'); door.position.set(-w / 2 + 0.02, plinth + h / 2, d / 2);
  const dw = w - 0.04, dh = h - 0.04, dd = 0.1;
  const dMat = new THREE.MeshPhysicalMaterial({ map: safeDoorTexture({ color, maker }), roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const doorBox = mesh(boxG(dw, dh, dd, dw / 2, 0, -dd / 2 + 0.01, 0.015), [paint, paint, paint, paint, dMat, paint]);
  doorBox.geometry = new THREE.BoxGeometry(dw, dh, dd).translate(dw / 2, 0, -dd / 2 + 0.01);
  door.add(doorBox);
  // hinges (outside the left)
  door.add(mergeInto([cylG(0.025, 0.025, 0.14, 12, -0.01, dh * 0.33, 0.0), cylG(0.025, 0.025, 0.14, 12, -0.01, -dh * 0.33, 0.0)], M.ironBlack()));
  // dial with a ring, the index mark above
  const dial = grp('dial'); dial.position.set(dw / 2, dh * 0.08, 0.012);
  const dt = dialTexture({ numbers: 100, labelEvery: 10, ticks: 100, style: 'brass', size: 512 });
  dial.add(mesh(mergeG([cylG(0.085, 0.09, 0.03, 48).rotateX(Math.PI / 2).translate(0, 0, 0.015), cylG(0.03, 0.035, 0.03, 20).rotateX(Math.PI / 2).translate(0, 0, 0.04)]), M.tarnishedBrass({ amount: 0.3 })));
  dial.add(at(mesh(new THREE.CircleGeometry(0.084, 48), new THREE.MeshStandardMaterial({ map: dt, metalness: 0.7, roughness: 0.35 })), 0, 0, 0.0305));
  door.add(dial);
  door.add(mergeInto([new THREE.TorusGeometry(0.1, 0.008, 8, 40).translate(dw / 2, dh * 0.08, 0.012), boxG(0.008, 0.02, 0.006, dw / 2, dh * 0.08 + 0.112, 0.014, 0.001)], M.brass()));
  // handle: a T on a boss
  const handle = grp('handle'); handle.position.set(dw / 2, -dh * 0.18, 0.012);
  handle.add(mergeInto([cylG(0.03, 0.035, 0.04, 16).rotateX(Math.PI / 2).translate(0, 0, 0.02), boxG(0.2, 0.025, 0.025, 0, 0, 0.05, 0.008), new THREE.SphereGeometry(0.02, 10, 8).translate(-0.1, 0, 0.05), new THREE.SphereGeometry(0.02, 10, 8).translate(0.1, 0, 0.05)], M.tarnishedBrass({ amount: 0.35 })));
  door.add(handle);
  // keyhole escutcheon + maker plate
  door.add(mergeInto([cylG(0.025, 0.025, 0.006, 16).rotateX(Math.PI / 2).translate(dw / 2, -dh * 0.34, 0.013)], M.brass()));
  // register window with number wheels
  const reg = numberWheels({ count: wheels, r: 0.022, width: 0.02, gap: 0.004, bg: '#e8dfc8', fg: '#1a1208' });
  reg.position.set(dw / 2, dh * 0.3, -0.012); door.add(reg);
  const winW = wheels * 0.024 + 0.02;
  door.add(mergeInto([boxG(winW + 0.03, 0.012, 0.012, dw / 2, dh * 0.3 + 0.025, 0.012, 0.003), boxG(winW + 0.03, 0.012, 0.012, dw / 2, dh * 0.3 - 0.025, 0.012, 0.003), boxG(0.012, 0.06, 0.012, dw / 2 - winW / 2 - 0.01, dh * 0.3, 0.012, 0.003), boxG(0.012, 0.06, 0.012, dw / 2 + winW / 2 + 0.01, dh * 0.3, 0.012, 0.003)], M.brass()));
  // cut the window: a dark recess behind the wheels so the door face reads as having a slot
  door.add(at(mesh(new THREE.PlaneGeometry(winW, 0.038), M.matte('#0a0806')), dw / 2, dh * 0.3, 0.0115));
  g.add(door);
  g.userData.door = door; g.userData.setOpen = (t) => { door.rotation.y = -1.9 * t; };
  g.userData.dial = dial; g.userData.dialValue = (v) => { dial.rotation.z = (v / 100) * TAU; };
  g.userData.handle = handle; g.userData.register = reg; g.userData.interior = interior;
  return g;
}

/**
 * Confectionery kiosk: a mahogany counter with a glazed vitrine (jars and boxes inside), a canopy fascia and
 * a brass rail. Origin: floor centre of the customer side; faces +Z. userData: { topY, vitrine }. ~7 draw calls.
 */
export function kiosk({ w = 1.6, label = 'CONFECTIONERY  ·  CIGARETTES', seed = 3 } = {}) {
  const g = grp('kiosk');
  const h = 0.95, d = 0.6, r = rng(seed);
  g.add(mergeInto([boxG(w, h, d, 0, h / 2, 0, 0.015), boxG(w + 0.06, 0.04, d + 0.06, 0, h + 0.02, 0, 0.01), ...[-1, 0, 1].map((k) => boxG(w * 0.3, h * 0.6, 0.02, k * w * 0.32, h * 0.48, d / 2 + 0.01, 0.01)), boxG(w + 0.04, 0.08, d + 0.04, 0, 0.04, 0, 0.006)], M.mahogany()));
  // vitrine: glass box on the counter
  const vh = 0.35;
  g.add(mergeInto([boxG(w - 0.04, 0.02, d - 0.1, 0, h + vh + 0.05, 0, 0.004), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => boxG(0.02, vh, 0.02, sx * (w / 2 - 0.03), h + 0.04 + vh / 2, sz * (d / 2 - 0.06), 0.003))], M.brass()));
  const vit = mesh(new THREE.BoxGeometry(w - 0.06, vh, d - 0.12).translate(0, h + 0.04 + vh / 2, 0), M.glass({ color: '#e0eaea', opacity: 0.14 }), { cast: false });
  g.add(vit);
  const jars = [], boxes = [];
  for (let i = 0; i < 7; i++) jars.push({ p: [-w / 2 + 0.15 + i * (w - 0.3) / 6, h + 0.04, -0.08 + (i % 2) * 0.12], s: [1, 0.9 + r() * 0.3, 1], c: ['#c83a3a', '#e8c040', '#5aa04a', '#e88ab0', '#f0e8d0', '#7a4a2a', '#4a8ac8'][i] });
  for (let i = 0; i < 8; i++) boxes.push({ p: [-w / 2 + 0.12 + i * (w - 0.24) / 7, h + 0.06, 0.15], r: [0.3, (r() - 0.5) * 0.3, 0], c: ['#a3201c', '#1f3d2c', '#c9a24a', '#2a3a6a'][i % 4] });
  g.add(instances(latheG([[0, 0], [0.045, 0], [0.05, 0.02], [0.05, 0.13], [0.035, 0.15], [0.035, 0.17], [0, 0.17]], 14), new THREE.MeshPhysicalMaterial({ roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.85 }), jars));
  g.add(instances(new THREE.BoxGeometry(0.12, 0.04, 0.07), new THREE.MeshStandardMaterial({ roughness: 0.6 }), boxes));
  const fascia = textPlate(label, w, { style: 'gilt', pw: 1536, ph: 160 });
  fascia.position.set(0, h - 0.12, d / 2 + 0.025); g.add(fascia);
  g.userData.topY = h + 0.04; g.userData.vitrine = vit;
  return g;
}

// =====================================================================================================
// CLOCK, SIGNS
// =====================================================================================================

/**
 * Wall clock. style 'dial' (a round station dial in a mahogany case) or 'drop' (a drop-dial with a pendulum box).
 * time: [h, m]. Origin: centre-back; faces +Z. userData: { hour, minute (pivots: rotation.z), setTime(h, m) }.
 * Cost: 4–5 draw calls.
 */
export function wallClock({ style = 'dial', time = [10, 9], r = 0.2, label = '' } = {}) {
  const g = grp('wallClock');
  const wood = M.mahogany();
  // turned case: back on the wall (z 0), a recessed dial seat at z 0.06, the bezel lip at 0.075
  const body = [latheG([[0, 0], [r + 0.04, 0], [r + 0.05, 0.03], [r + 0.03, 0.07], [r + 0.005, 0.077], [r - 0.004, 0.06], [0, 0.06]], 48).rotateX(Math.PI / 2)];
  if (style === 'drop') body.push(boxG(r * 1.1, r * 1.5, 0.07, 0, -r - r * 0.6, 0.035, 0.012), latheG([[0, 0], [0.04, 0], [0.04, 0.01], [0, 0.02]], 16).rotateX(Math.PI / 2).translate(0, -r - r * 1.28, 0.075));
  g.add(mergeInto(body, wood));
  g.add(mesh(new THREE.TorusGeometry(r + 0.003, 0.01, 8, 48).translate(0, 0, 0.076), M.brass()));
  const face = mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ map: dialTexture({ numbers: ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'], ticks: 60, label, style: 'enamel', size: 512 }), roughness: 0.4 }));
  face.position.z = 0.0615; g.add(face);
  g.add(at(mesh(new THREE.CircleGeometry(r, 48), M.glass({ color: '#e8f0f0', opacity: 0.12 }), { cast: false }), 0, 0, 0.078));
  const handMat = M.matte('#141010', { roughness: 0.5 });
  const mk = (len, wid) => { const s = new THREE.Shape(); s.moveTo(-wid * 0.3, -len * 0.18); s.lineTo(wid * 0.3, -len * 0.18); s.lineTo(wid * 0.5, len * 0.55); s.lineTo(0, len); s.lineTo(-wid * 0.5, len * 0.55); s.closePath(); return new THREE.ShapeGeometry(s); };
  const hour = mesh(mk(r * 0.55, 0.03), handMat, { cast: false }); hour.position.z = 0.064;
  const minute = mesh(mk(r * 0.82, 0.02), handMat, { cast: false }); minute.position.z = 0.066;
  g.add(hour, minute);
  if (style === 'drop') {
    const win = mesh(new THREE.PlaneGeometry(r * 0.5, r * 0.5), M.glass({ color: '#d0d8d0', opacity: 0.3 }), { cast: false }); win.position.set(0, -r - r * 0.6, 0.071); g.add(win);
    g.add(at(mesh(cylG(0.035, 0.035, 0.005, 16).rotateX(Math.PI / 2), M.brass()), 0, -r - r * 0.7, 0.06));
  }
  g.userData.hour = hour; g.userData.minute = minute;
  g.userData.setTime = (hh, mm) => { minute.rotation.z = -(mm / 60) * TAU; hour.rotation.z = -(((hh % 12) + mm / 60) / 12) * TAU; };
  g.userData.setTime(...time);
  return g;
}

/**
 * EXIT sign: a green-painted steel box with a glass face lettered EXIT, lit from inside. Hangs from two chains if
 * hang > 0 (m), otherwise wall mounted (centre-back). Faces +Z. userData: { setLit(0..1, instant), face }.
 * Cost: 3–4 draw calls.
 */
export function exitSign({ text = 'EXIT', w = 0.5, lit = 1, hang = 0 } = {}) {
  const g = grp('exitSign');
  const h = w * 0.36, d = 0.12;
  g.add(mesh(boxG(w, h, d, 0, 0, d / 2, 0.012), M.enamel('#1f3d2c', { roughness: 0.35 })));
  const tex = labelPlate(text, { style: 'exit', w: 512, h: 184 });
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: '#ffffff' });
  const face = mesh(new THREE.PlaneGeometry(w - 0.03, h - 0.03), mat, { cast: false, receive: false });
  face.position.z = d + 0.001; g.add(face);
  const back = mesh(new THREE.PlaneGeometry(w - 0.03, h - 0.03).rotateY(Math.PI), mat, { cast: false, receive: false }); back.position.z = -0.001;
  if (hang) {
    g.add(back);
    const links = [];
    for (const s of [-1, 1]) for (let i = 0; i < Math.ceil(hang / 0.05); i++) links.push({ p: [s * w * 0.35, h / 2 + 0.03 + i * 0.05, d / 2], r: [0, i % 2 ? Math.PI / 2 : 0, 0] });
    g.add(instances(new THREE.TorusGeometry(0.012, 0.003, 4, 8).scale(1, 1.6, 1), M.iron(), links));
  }
  let level = 0, target = lit;
  const on = new THREE.Color(1.6, 1.6, 1.6), off = new THREE.Color(0.35, 0.38, 0.35);
  const apply = () => { mat.color.copy(off).lerp(on, level); };
  g.userData.update = (dt) => { if (Math.abs(level - target) > 0.001) { level = chase(level, target, dt, 6); apply(); } };
  g.userData.setLit = (t, instant) => { target = +t; if (instant) { level = target; apply(); } };
  level = lit; apply();
  g.userData.face = face;
  return g;
}

/**
 * Vitreous enamel sign with rounded corners, a border, chips and four screws (QUIET PLEASE, NO SMOKING...).
 * Origin: centre-back; faces +Z. Cost: 1 draw call.
 */
export function enamelSign({ text = 'QUIET PLEASE', w = 0.6, h = 0.18, bg = '#1f3d2c', fg = '#f0e8d6', seed = 2 } = {}) {
  const g = grp('enamelSign');
  const tex = labelPlate(text, { style: 'enamel', w: 1024, h: Math.round(1024 * h / w), bg, fg, seed, screws: true });
  const s = new THREE.Shape(), rr = Math.min(w, h) * 0.12;
  s.moveTo(-w / 2 + rr, -h / 2); s.lineTo(w / 2 - rr, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rr); s.lineTo(w / 2, h / 2 - rr); s.quadraticCurveTo(w / 2, h / 2, w / 2 - rr, h / 2); s.lineTo(-w / 2 + rr, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rr); s.lineTo(-w / 2, -h / 2 + rr); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rr, -h / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 6 });
  // planar UVs from x/y
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  g.add(mesh(geo, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2 })));
  return g;
}

// Cloth (PROPS): pleated drapes (house tabs, borders, legs, box curtains) and draped dust sheets.
import { THREE, M, TAU, mesh, noRay, grp, rng } from './common.js';
import { clothTexture, velvetTexture } from '../theatre-textures.js';
import { makeCanvas, canvasTexture } from '../textures.js';

let fringeTex = null;
function fringeTexture() {
  if (fringeTex) return fringeTex;
  const w = 256, h = 96, c = makeCanvas(w, h), g = c.getContext('2d'), r = rng(5);
  g.clearRect(0, 0, w, h);
  // braid band
  g.fillStyle = '#d8b050'; g.fillRect(0, 0, w, h * 0.28);
  g.strokeStyle = '#8a6420'; g.lineWidth = 2;
  for (let x = -20; x < w + 20; x += 10) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 12, h * 0.28); g.stroke(); }
  g.fillStyle = '#6a4818'; g.fillRect(0, h * 0.26, w, 2);
  // threads + tassel bunches
  for (let x = 0; x < w; x += 1.6) {
    const len = h * (0.6 + r() * 0.1) * (Math.sin(x / w * Math.PI * 8) > 0.6 ? 1.1 : 1);
    g.strokeStyle = r() < 0.5 ? '#e0bc5c' : '#a07a2a'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x, h * 0.28); g.lineTo(x + (r() - 0.5) * 2, h * 0.28 + len * 0.98); g.stroke();
  }
  fringeTex = canvasTexture(c, { repeat: [1, 1] });
  return fringeTex;
}

/**
 * A pleated hanging drape. Origin at the TOP centre; hangs down to y = -h; pleats in Z.
 * opts: w, h, color, material (overrides), pleatW (pleat spacing m), depth (pleat depth m), anchor 'left'|'right'|'centre'
 * (where it gathers to), fringe (gold bullion fringe at the hem), sway (0..1 idle breeze), seed, repeat ([u,v] nap repeat).
 * userData: { cloth (Mesh), fringe (Mesh|null), setGather(t 0..1), gather, update }
 * Cost: 1 draw call (+1 with fringe). Vertices recomputed only while swaying or gathering.
 */
export function drape({ w = 4, h = 6, color = M.palette.velvetRed, material = null, pleatW = 0.3, depth = 0.08, anchor = 'left', fringe = false, fringeH = 0.16, sway = 0.5, seed = 1, segY = 10, flare = 0.3, wear = 0.3 } = {}) {
  const g = grp('drape');
  const nx = Math.max(8, Math.ceil(w / pleatW * 6));
  const geo = new THREE.PlaneGeometry(w, h, nx, segY);
  geo.translate(0, -h / 2, 0);
  const mat = material || (() => {
    const m = M.velvetRed({ color, wear, repeat: [Math.max(1, w / 1.5), Math.max(1, h / 2)], unique: true });
    m.side = THREE.DoubleSide; return m;
  })();
  const cloth = mesh(geo, mat);
  g.add(cloth);
  const pos = geo.attributes.position, n = pos.count;
  const bx = new Float32Array(n), by = new Float32Array(n);
  for (let i = 0; i < n; i++) { bx[i] = pos.getX(i); by[i] = pos.getY(i); }
  const r = rng(seed), phase = []; for (let i = 0; i < 64; i++) phase.push((r() - 0.5) * 0.9);
  const s1 = r() * TAU, s2 = r() * TAU, s3 = r() * TAU; // irregular pleat spacing, a long swell, uneven pleat depth
  const xa = anchor === 'left' ? -w / 2 : anchor === 'right' ? w / 2 : 0;
  let fr = null, fpos = null;
  if (fringe) {
    const fgeo = new THREE.PlaneGeometry(w, fringeH, nx, 1);
    const fm = new THREE.MeshStandardMaterial({ map: fringeTexture(), color: '#ffffff', metalness: 0.55, roughness: 0.45, alphaTest: 0.35, side: THREE.DoubleSide });
    fr = mesh(fgeo, fm, { cast: true, receive: false });
    fpos = fgeo.attributes.position;
    g.add(fr);
  }
  let gather = 0, time = 0;
  const layout = () => {
    const k = 1 - 0.84 * gather, d0 = depth * (1 + 1.8 * gather);
    for (let i = 0; i < n; i++) {
      const x0 = bx[i], y0 = by[i], t01 = -y0 / h;
      const ph = (x0 / pleatW + 0.3 * Math.sin(x0 * 0.85 + s1)) * TAU + phase[Math.abs(Math.floor(x0 / pleatW)) % 64] * 0.5;
      const d = d0 * (1 + flare * t01) * (0.7 + 0.3 * Math.sin(x0 * 1.9 + s3));
      const swell = d0 * 1.4 * Math.sin(x0 * 0.75 + s2) * (0.4 + 0.6 * t01);
      const swayZ = sway ? Math.sin(time * 0.6 + x0 * 0.9 + t01 * 1.5) * 0.012 * sway * t01 : 0;
      pos.setXYZ(i, xa + (x0 - xa) * k, y0, d * (Math.sin(ph) + 0.22 * Math.sin(ph * 2 + 1.3)) + swell + swayZ);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    if (fr) {
      const row = nx + 1, base = n - row; // bottom row of the cloth
      for (let j = 0; j < row; j++) {
        const x = pos.getX(base + j), z = pos.getZ(base + j);
        fpos.setXYZ(j, x, -h + 0.02, z);
        fpos.setXYZ(row + j, x + Math.sin(time * 1.3 + j * 0.5) * 0.004 * sway, -h - fringeH + 0.02, z);
      }
      fpos.needsUpdate = true;
      fr.geometry.computeVertexNormals();
    }
  };
  layout();
  g.userData.cloth = cloth;
  g.userData.fringe = fr;
  g.userData.gather = 0;
  g.userData.setGather = (t) => { gather = THREE.MathUtils.clamp(t, 0, 1); g.userData.gather = gather; layout(); };
  if (sway) {
    let acc = 0;
    g.userData.update = (dt, t) => { time = t; acc += dt; if (acc > 1 / 30) { acc = 0; layout(); } };
  }
  return g;
}

/**
 * The house tabs (main curtain). Two velvet panels meeting at centre, gold fringe, a slight centre overlap.
 * Origin: centre of the curtain line on the stage floor (hem at y = 0 when IN); faces the audience (+Z).
 * mode 'fly': setOpen(t) raises the panels by t·(h + 0.4) (hide the top behind a border/proscenium).
 * mode 'draw': setOpen(t) gathers each panel to its side (a traveller).
 * userData: { panels: [left, right] (drape groups), setOpen(t), open, h, w }. Cost: 4 draw calls.
 */
export function houseTabs({ w = 9, h = 6.5, color = M.palette.velvetRed, mode = 'fly', fringe = true, sway = 0.5, pleatW = 0.42, depth = 0.055 } = {}) {
  const g = grp('houseTabs');
  const rig = grp('tabsRig');
  g.add(rig);
  const pw = w / 2 + 0.15;
  const left = drape({ w: pw, h, color, anchor: 'left', fringe, sway, pleatW, depth, seed: 3 });
  const right = drape({ w: pw, h, color, anchor: 'right', fringe, sway, pleatW, depth, seed: 7 });
  left.position.set(-w / 4 + 0.075, h + 0.02, 0.02);
  right.position.set(w / 4 - 0.075, h + 0.02, -0.02);
  rig.add(left, right);
  g.userData.panels = [left, right];
  g.userData.open = 0;
  g.userData.w = w; g.userData.h = h;
  g.userData.setOpen = (t) => {
    t = THREE.MathUtils.clamp(t, 0, 1);
    g.userData.open = t;
    if (mode === 'fly') rig.position.y = t * t * (3 - 2 * t) * (h + 0.4);
    else { left.userData.setGather(t); right.userData.setGather(t); }
  };
  return g;
}

/**
 * A border (short pleated valance across the top of the stage or a box). Origin: top centre. Faces +Z.
 * userData: { cloth }. Cost: 1–2 draw calls.
 */
export function border({ w = 9, h = 1.2, color = M.palette.velvetRed, fringe = true, sway = 0.2, pleatW = 0.26, depth = 0.06 } = {}) {
  const d = drape({ w, h, color, anchor: 'centre', fringe, sway, pleatW, depth, seed: 11, segY: 3, flare: 0.1 });
  d.name = 'border';
  return d;
}

/** Black velour masking leg. Origin: top centre (hang it from y = h). Cost: 1 draw call. */
export function leg({ w = 1.4, h = 6.5, color = '#121014', sway = 0.15 } = {}) {
  const d = drape({ w, h, color, anchor: 'centre', fringe: false, sway, pleatW: 0.35, depth: 0.06, seed: 21, segY: 4, wear: 0 });
  d.name = 'leg';
  return d;
}

// -----------------------------------------------------------------------------------------------------
// DUST SHEETS
// -----------------------------------------------------------------------------------------------------
const PROFILES = {
  // [radius factor, height fraction] from the top centre down to the hem; p = squareness of the footprint
  box: { p: 7, pts: [[0, 1], [0.8, 1], [0.95, 0.99], [1.0, 0.955], [1.02, 0.5], [1.05, 0.1], [1.14, 0.015], [1.2, 0]] },
  round: { p: 2, pts: [[0, 1], [0.8, 1], [0.96, 0.985], [1.0, 0.95], [1.02, 0.5], [1.06, 0.1], [1.16, 0.015], [1.22, 0]] },
  low: { p: 3, pts: [[0, 1], [0.6, 0.99], [0.9, 0.95], [1.0, 0.82], [1.04, 0.35], [1.1, 0.08], [1.2, 0]] },
  tall: { p: 2, pts: [[0, 1], [0.18, 0.995], [0.28, 0.96], [0.3, 0.84], [0.34, 0.7], [0.85, 0.6], [0.95, 0.52], [0.72, 0.42], [1.0, 0.26], [1.04, 0.08], [1.18, 0]] },
  cone: { p: 4, pts: [[0, 1], [0.18, 0.99], [0.3, 0.92], [0.55, 0.6], [0.85, 0.25], [1.0, 0.07], [1.12, 0]] },
  lump: { p: 2, pts: [[0, 1], [0.4, 0.98], [0.75, 0.86], [0.95, 0.66], [1.0, 0.45], [0.92, 0.25], [1.0, 0.07], [1.14, 0]] },
};

/**
 * A dust sheet draped over a silhouette (a cloth surface built around a radial profile, with folds and a pooled hem).
 * shape: 'box' | 'round' | 'low' | 'tall' (cello/bass) | 'cone' (harp) | 'lump' (tuba) or profile: { p, pts }.
 * w, d: footprint (m); h: height; color; folds (0..2); seed. Origin: base centre on the floor.
 * userData: { cloth }. Cost: 1 draw call (~1–2k triangles).
 */
export function dustSheet({ shape = 'box', profile = null, w = 1, d = 0.7, h = 0.9, color = '#cfc3a8', folds = 1, seed = 1, segA = 72, segS = 26 } = {}) {
  const P = profile || PROFILES[shape] || PROFILES.box;
  // resample the profile by arc length
  const pts = P.pts.map(([rr, y]) => [rr, y * h]);
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot((pts[i][0] - pts[i - 1][0]) * Math.max(w, d) / 2, pts[i][1] - pts[i - 1][1]));
  const total = lens[lens.length - 1];
  const sample = (s) => {
    const L = s * total; let i = 1;
    while (i < lens.length - 1 && lens[i] < L) i++;
    const t = (L - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
  };
  const r = rng(seed), rx = w / 2, rz = d / 2, p = P.p;
  const fphase = Array.from({ length: 8 }, () => r() * TAU), fcount = [3, 5, 7, 11].map((k) => k + Math.floor(r() * 2));
  const verts = [], uvs = [];
  for (let j = 0; j <= segS; j++) {
    const s = j / segS;
    const [rho, y] = sample(s);
    for (let i = 0; i <= segA; i++) {
      const th = (i / segA) * TAU;
      const c = Math.cos(th), sn = Math.sin(th);
      const sup = Math.pow(Math.pow(Math.abs(c) / rx, p) + Math.pow(Math.abs(sn) / rz, p), -1 / p);
      // folds grow toward the hem; a few big soft ones plus small creases
      const k = Math.pow(s, 1.4) * folds;
      let fold = 0;
      fold += Math.sin(th * fcount[0] + fphase[0]) * 0.03 + Math.sin(th * fcount[1] + fphase[1]) * 0.018 + Math.sin(th * fcount[2] + fphase[2] + s * 3) * 0.008 + Math.sin(th * fcount[3] + fphase[3]) * 0.005;
      const rad = rho * sup + fold * k * Math.max(0.6, Math.min(w, d) * 1.2);
      let yy = y;
      if (s > 0.9) yy += Math.max(0, Math.sin(th * 6 + fphase[4]) * 0.012 * (s - 0.9) * 10); // hem ripple
      if (s < 0.25) yy -= (0.25 - s) * 0.02 * (1 + Math.sin(th * 3 + fphase[5])); // the top sags a little
      verts.push(c * rad, Math.max(0.002, yy), sn * rad);
      uvs.push(i / segA * Math.max(1, (w + d)), 1 - s);
    }
  }
  const idx = [];
  const row = segA + 1;
  for (let j = 0; j < segS; j++) for (let i = 0; i < segA; i++) {
    const a = j * row + i, b = a + 1, c2 = a + row, d2 = c2 + 1;
    idx.push(a, b, c2, b, d2, c2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // weld the seam normals
  const nrm = geo.attributes.normal;
  for (let j = 0; j <= segS; j++) {
    const a = j * row, b = a + segA;
    const nx = nrm.getX(a) + nrm.getX(b), ny = nrm.getY(a) + nrm.getY(b), nz = nrm.getZ(a) + nrm.getZ(b), l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(a, nx / l, ny / l, nz / l); nrm.setXYZ(b, nx / l, ny / l, nz / l);
  }
  const mat = M.paintedCanvas({ tint: color, side: THREE.DoubleSide });
  const cloth = mesh(geo, mat);
  const g = grp('dustSheet');
  g.add(cloth);
  g.userData.cloth = cloth;
  return g;
}

export { PROFILES as dustSheetProfiles };

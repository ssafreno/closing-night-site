// Foyer & Box Office: room-specific props and canvas textures (SET-foyer). The shared catalogue (theatre.js) covers
// the chandelier, poster frames, box-office window, kiosk, clock, EXIT signs, doors; everything here is a one-off:
// the winch cabinet, the torn last-night bill, Crane's safe, the house board, the ticket machine, the cloakroom
// lost property, the street-door screen, the chain and padlock. Every builder faces +Z, origin as documented.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import { makeCanvas, canvasTexture, wrapText } from '../../engine/props/textures.js';
import { FONTS, labelPlate, agedPaperTexture, grime } from '../../engine/props/theatre-textures.js';
import { mesh, noRay, grp, at, boxG, cylG, latheG, mergeG, mergeInto, tubeG, instances, rng, TAU, glowGlass, halo } from '../../engine/props/theatre/common.js';
import { rainGlassMaterial, cardTag, key as keyProp } from '../../engine/props/theatre.js';

// =====================================================================================================
// TEXTURES
// =====================================================================================================

function veins(g, x0, y0, w, h, r, color, n = 5) {
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  for (let i = 0; i < n; i++) {
    let x = x0 + r() * w, y = y0 + r() * h, a = r() * TAU;
    g.strokeStyle = color; g.globalAlpha = 0.15 + r() * 0.35; g.lineWidth = 0.6 + r() * 1.8;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 40; s++) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * w * 0.05; y += Math.sin(a) * w * 0.05; g.lineTo(x, y); }
    g.stroke();
  }
  g.restore(); g.globalAlpha = 1;
}

/** Cream-and-black marble chequer, 4 x 4 squares per tile, worn and grimy. */
export function chequerTexture({ size = 1024, seed = 5 } = {}) {
  const c = makeCanvas(size, size), g = c.getContext('2d'), r = rng(seed), s = size / 4;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const dark = (i + j) % 2 === 1;
    const base = dark ? ['#1b1816', '#211d1a', '#171412'][Math.floor(r() * 3)] : ['#ddd2bb', '#e3d9c4', '#d6cab1'][Math.floor(r() * 3)];
    g.fillStyle = base; g.fillRect(i * s, j * s, s, s);
    const gr = g.createLinearGradient(i * s, j * s, i * s + s, j * s + s);
    gr.addColorStop(0, dark ? 'rgba(80,70,60,0.18)' : 'rgba(255,250,235,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.06)');
    g.fillStyle = gr; g.fillRect(i * s, j * s, s, s);
    veins(g, i * s, j * s, s, s, r, dark ? '#6a625a' : '#8a8076', dark ? 3 : 5);
  }
  grime(g, size, size, { seed: seed + 1, color: '#4a3c2c', octaves: [[3, 0.22], [10, 0.12], [40, 0.07]] });
  // grout lines
  g.fillStyle = 'rgba(40,32,24,0.55)';
  for (let i = 0; i <= 4; i++) { g.fillRect(i * s - 1.5, 0, 3, size); g.fillRect(0, i * s - 1.5, size, 3); }
  // chips and scuffs
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '20,16,12' : '230,220,200'},${0.1 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * size, r() * size, 2 + r() * 10, 1 + r() * 3, r() * 3, 0, TAU); g.fill(); }
  return canvasTexture(c, { repeat: [1, 1] });
}

/** Roughness map for the chequer: polished centres, dull worn paths. */
export function floorRoughTexture({ size = 256, seed = 9 } = {}) {
  const c = makeCanvas(size, size), g = c.getContext('2d');
  g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, size, size);
  grime(g, size, size, { seed, color: '#c8c8c8', octaves: [[4, 0.4], [16, 0.25]], mode: 'lighter' });
  return canvasTexture(c, { srgb: false });
}

// ---- the last-night bill (the TONIGHT frame) ----------------------------------------------------------
export const BILL = { w: 0.75, h: 1.0, px: [768, 1024] };

function drawBill(g, W, H) {
  const ink = '#1b120c', red = '#a3201c';
  g.textBaseline = 'alphabetic';
  g.strokeStyle = ink; g.lineWidth = 5; g.strokeRect(22, 22, W - 44, H - 44); g.lineWidth = 1.5; g.strokeRect(32, 32, W - 64, H - 64);
  // POLISH: every line is fitted inside the inner rule (LAST NIGHT, LAVINIA THRUSH and GULL POINT ran off the bill and
  // under the frame's gilt); a line that fits is drawn exactly as before
  const IN = 46;
  const C = (t, y, font, color = ink, align = 'center', x = W / 2) => {
    g.font = font; g.fillStyle = color; g.textAlign = align;
    const room = align === 'right' ? x - IN : align === 'left' ? W - IN - x : W - 2 * IN;
    g.fillText(t, x, y, room);
  };
  const fell = FONTS.fell, disp = FONTS.display;
  C('EMPRESS THEATRE  ·  PELHAM STREET', 82, `600 34px ${fell}`);
  g.fillStyle = red; g.fillRect(120, 98, W - 240, 4);
  // LAST | NIGHT: one word each side of the vertical tear
  C('LAST', 236, `150px ${disp}`, red, 'right', W / 2 - 18);
  C('NIGHT', 236, `150px ${disp}`, red, 'left', W / 2 + 14);
  C('SATURDAY 14th MARCH 1931  at 7.30', 296, `600 40px ${fell}`);
  // ---- second band
  C('Miss', 398, `italic 44px ${fell}`);
  C('LAVINIA', 500, `104px ${disp}`, ink, 'right', W / 2 - 14);
  C('THRUSH', 500, `104px ${disp}`, ink, 'left', W / 2 + 12);
  C('in', 552, `italic 40px ${fell}`);
  C('THE LAMP AT', 628, `66px ${disp}`, red, 'right', W / 2 - 14);
  C('GULL POINT', 628, `66px ${disp}`, red, 'left', W / 2 + 14);
  C('A Drama in Three Acts and a Storm', 672, `italic 34px ${fell}`);
  // ---- third band
  C('with Mr Bertram Volley · Mr Rupert Dane · Miss Ada Moss', 722, `30px ${fell}`);
  C('“Miss Thrush is in it.” — Pelham Gazette', 766, `italic 32px ${fell}`); // FIXED BY qa-foyer: curly quotes (Fell's " reads as ”)
  g.fillStyle = ink; g.fillRect(70, 786, W - 140, 2);
  C('PRICES', 838, `48px ${disp}`, red, 'right', W / 2 - 40);
  C('Gallery 6d   ·   Pit 1/-', 884, `600 34px ${fell}`, ink, 'right', W / 2 - 30);
  C('Stalls 3/6', 924, `600 34px ${fell}`, ink, 'right', W / 2 - 30);
  C('Dress Circle 5/-', 852, `600 34px ${fell}`, ink, 'left', W / 2 + 30);
  C('Boxes 10/6', 896, `600 34px ${fell}`, ink, 'left', W / 2 + 30);
  C('THE ROYAL BOX (Box A)', 976, `42px ${disp}`, red, 'right', W / 2 - 16);
  C('One Guinea', 976, `42px ${disp}`, red, 'left', W / 2 + 22);
}

/** The full last-night playbill (the mended state, and the source of the six pieces' UVs). */
export function lastNightTexture() {
  const [W, H] = BILL.px;
  return agedPaperTexture({ w: W, h: H, tint: '#eee0bc', seed: 31, age: 0.7, draw: (g) => drawBill(g, W, H), key: 'foyer-lastnight' });
}

/**
 * The six torn pieces: 2 columns x 3 rows with jagged shared edges (they fit exactly). Returns
 * [{ geo (centred on the piece), home: [x, y] (piece centre in poster metres, origin = poster centre), size: [w, h],
 *    col, row, words }]. UVs map into lastNightTexture(), so a piece shows its own part of the bill.
 */
export function billPieces({ seed = 14 } = {}) {
  const r = rng(seed), { w, h } = BILL, N = 30, Mh = 8;
  const J = (a) => (r() - 0.5) * 2 * a;
  // the vertical tear, top to bottom; vertices 10 and 20 are where the two horizontal tears meet it
  const P = Array.from({ length: N + 1 }, (_, i) => [J(0.011), h / 2 - h * i / N]);
  const ys = [h / 6, -h / 6], jIdx = [10, 20];
  const HL = [], HR = [];
  ys.forEach((y, k) => {
    const Jp = P[jIdx[k]];
    const L = [], R = [];
    for (let i = 0; i <= Mh; i++) { const t = i / Mh; L.push(i === Mh ? Jp : [-w / 2 + (Jp[0] + w / 2) * t, y + J(0.014)]); }
    for (let i = 0; i <= Mh; i++) { const t = i / Mh; R.push(i === 0 ? Jp : [Jp[0] + (w / 2 - Jp[0]) * t, y + J(0.014)]); }
    HL.push(L); HR.push(R);
  });
  const rev = (a) => a.slice().reverse();
  const seg = (i0, i1) => P.slice(i0, i1 + 1);
  const outlines = [
    [[-w / 2, h / 2], ...seg(0, jIdx[0]), ...rev(HL[0]).slice(1)],
    [...seg(0, 0), [w / 2, h / 2], ...rev(HR[0]), ...rev(seg(1, jIdx[0] - 1))],
    [...HL[0], ...seg(jIdx[0] + 1, jIdx[1]), ...rev(HL[1]).slice(1)],
    [...HR[0], ...rev(HR[1]), ...rev(seg(jIdx[0] + 1, jIdx[1] - 1))],
    [...HL[1], ...seg(jIdx[1] + 1, N), [-w / 2, -h / 2]],
    [...HR[1], [w / 2, -h / 2], ...rev(seg(jIdx[1] + 1, N))],
  ];
  const words = [['EMPRESS THEATRE', 'LAST'], ['PELHAM STREET', 'NIGHT'], ['Miss', 'LAVINIA', 'THE LAMP AT'], ['THRUSH', 'GULL POINT'], ['PRICES', 'THE ROYAL BOX (Box A)'], ['Dress Circle 5/-', 'One Guinea']];
  return outlines.map((pts, i) => {
    const clean = pts.filter((p, k, a) => k === 0 || Math.hypot(p[0] - a[k - 1][0], p[1] - a[k - 1][1]) > 1e-5);
    const geo = new THREE.ShapeGeometry(new THREE.Shape(clean.map(([x, y]) => new THREE.Vector2(x, y))));
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let k = 0; k < p.count; k++) uv.setXY(k, (p.getX(k) + w / 2) / w, (p.getY(k) + h / 2) / h);
    geo.computeBoundingBox();
    const bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
    geo.translate(-cx, -cy, 0);
    return { geo, home: [cx, cy], size: [bb.max.x - bb.min.x, bb.max.y - bb.min.y], col: i % 2, row: Math.floor(i / 2), words: words[i] };
  });
}

// ---- review posters & the Ordinary Cat ---------------------------------------------------------------
export function reviewTexture({ quote, paper, date, seed }) {
  const W = 512, H = 768;
  return agedPaperTexture({
    w: W, h: H, tint: '#e8dcbc', seed, age: 0.65, key: 'foyer-review-' + seed, fold: { v: 0, hz: 1 },
    draw: (g) => {
      const ink = '#1b120c', m = 34;
      g.textAlign = 'center'; g.fillStyle = ink;
      g.font = `600 30px ${FONTS.fell}`; g.fillText('THE EMPRESS · PELHAM', W / 2, 62);
      g.fillRect(m, 76, W - m * 2, 3); g.fillRect(m, 84, W - m * 2, 1);
      g.font = `italic 26px ${FONTS.fell}`; g.fillText('What the Press says of', W / 2, 128);
      g.font = `42px ${FONTS.display}`; g.fillStyle = '#a3201c'; g.fillText('MISS THRUSH', W / 2, 180);
      g.fillStyle = ink; g.fillRect(W * 0.3, 202, W * 0.4, 1.5);
      g.font = `italic 64px ${FONTS.fell}`;
      const end = wrapText(g, quote, W / 2, 330, W - m * 2.4, 76);
      g.font = `36px ${FONTS.display}`; g.fillText('— ' + paper, W / 2, end + 70);
      if (date) { g.font = `italic 28px ${FONTS.fell}`; g.fillText(date, W / 2, end + 112); }
      g.fillRect(m, H - 70, W - m * 2, 1.5);
      g.font = `24px ${FONTS.fell}`; g.fillText('NIGHTLY at 7.30 · MATINÉES SATURDAY', W / 2, H - 40);
    },
  });
}

export function ordinaryCatTexture() {
  const W = 600, H = 850;
  return agedPaperTexture({
    w: W, h: H, tint: '#f1e6c8', seed: 77, age: 0.35, key: 'foyer-ordinarycat',
    draw: (g) => {
      const ink = '#1d1a24', accent = '#2f5a8a', m = 36;
      g.textAlign = 'center'; g.strokeStyle = ink; g.lineWidth = 5; g.strokeRect(20, 20, W - 40, H - 40);
      g.fillStyle = accent; g.font = `600 30px ${FONTS.fell}`; g.fillText('NEXT SEASON', W / 2, 74);
      // the art: a grey cat sitting in a doorway of warm light
      const ax = m + 10, ay = 96, aw = W - m * 2 - 20, ah = 380;
      const gr = g.createLinearGradient(0, ay, 0, ay + ah); gr.addColorStop(0, '#2a2a40'); gr.addColorStop(1, '#4a4258'); g.fillStyle = gr; g.fillRect(ax, ay, aw, ah);
      g.fillStyle = '#e9c27a'; g.fillRect(ax + aw * 0.33, ay + ah * 0.18, aw * 0.34, ah * 0.82);
      const cx = W / 2, cy = ay + ah * 0.98;
      g.fillStyle = '#25232c';
      g.beginPath(); g.ellipse(cx, cy - 70, 62, 78, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(cx, cy - 170, 44, 40, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(cx - 40, cy - 190); g.lineTo(cx - 30, cy - 236); g.lineTo(cx - 10, cy - 200); g.fill();
      g.beginPath(); g.moveTo(cx + 40, cy - 190); g.lineTo(cx + 30, cy - 236); g.lineTo(cx + 10, cy - 200); g.fill();
      g.lineWidth = 16; g.lineCap = 'round'; g.strokeStyle = '#25232c'; g.beginPath(); g.moveTo(cx + 55, cy - 20); g.quadraticCurveTo(cx + 120, cy - 10, cx + 110, cy - 90); g.stroke();
      g.fillStyle = '#f0c040'; g.beginPath(); g.ellipse(cx - 16, cy - 174, 6, 8, 0, 0, TAU); g.ellipse(cx + 16, cy - 174, 6, 8, 0, 0, TAU); g.fill();
      g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(ax, ay, aw, ah);
      g.fillStyle = ink; g.font = `italic 32px ${FONTS.fell}`; g.fillText('The Empress presents', W / 2, 530);
      g.fillStyle = accent; g.font = `76px ${FONTS.display}`; g.fillText('AN ORDINARY', W / 2, 610); g.fillText('CAT', W / 2, 690);
      g.fillStyle = ink; g.font = `italic 36px ${FONTS.fell}`; g.fillText('a comedy in three rooms', W / 2, 740);
      g.font = `italic 30px ${FONTS.fell}`; g.fillText('"Don\'t mind me."', W / 2, 792);
    },
  });
}

// ---- box office paperwork ------------------------------------------------------------------------------
export function priceBoardTexture() {
  const W = 1024, H = 448, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(41);
  g.fillStyle = '#1a2a20'; g.fillRect(0, 0, W, H);
  grime(g, W, H, { seed: 41, color: '#0a0a08', octaves: [[4, 0.3], [18, 0.15]] });
  g.strokeStyle = '#c9a24a'; g.lineWidth = 6; g.strokeRect(14, 14, W - 28, H - 28); g.lineWidth = 2; g.strokeRect(26, 26, W - 52, H - 52);
  g.textBaseline = 'alphabetic'; g.fillStyle = '#e8d6a0';
  g.textAlign = 'center'; g.font = `44px ${FONTS.display}`; g.fillText('BOX OFFICE', W / 2, 82);
  g.font = `italic 26px ${FONTS.fell}`; g.fillText('— Prices including Tax —', W / 2, 116);
  const rows = [['Gallery', '6d'], ['Pit', '1/-'], ['Upper Circle', '2/6'], ['Stalls', '3/6'], ['Dress Circle', '5/-'], ['Boxes B, C, D', '10/6 per seat']];
  g.font = `600 34px ${FONTS.fell}`;
  rows.forEach(([a, b], i) => {
    const col = i < 3 ? 0 : 1, y = 170 + (i % 3) * 52, x0 = col ? W / 2 + 30 : 70, x1 = col ? W - 70 : W / 2 - 30;
    g.textAlign = 'left'; g.fillText(a, x0, y); g.textAlign = 'right'; g.fillText(b, x1, y);
    g.fillStyle = 'rgba(232,214,160,0.35)'; for (let x = x0 + g.measureText(a).width + 160; x < x1 - 120; x += 12) g.fillRect(x, y - 4, 3, 3); g.fillStyle = '#e8d6a0';
  });
  g.fillStyle = '#c9a24a'; g.fillRect(70, 334, W - 140, 2);
  g.textAlign = 'center'; g.fillStyle = '#f0c860'; g.font = `44px ${FONTS.display}`; g.fillText('ROYAL BOX (A)  £1 1s', W / 2, 384);
  g.fillStyle = '#e8d6a0'; g.font = `italic 26px ${FONTS.fell}`; g.fillText('Programmes 2d', W / 2, 420);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(20,16,10,${0.2 + r() * 0.3})`; g.fillRect(r() * W, r() * H, 1 + r() * 6, 1 + r() * 3); }
  return canvasTexture(c);
}

/** The framed seating plan (matches the `seatplan` paper: house left on the page's left, Box A crowned ROYAL). */
export function seatPlanTexture() {
  const W = 630, H = 576;
  return agedPaperTexture({
    w: W, h: H, tint: '#efe4c8', seed: 52, age: 0.55, key: 'foyer-seatplan',
    draw: (g) => {
      const k = 1.5, ink = '#3a2414';
      g.save(); g.scale(k, k);
      const T = (x, y, s, t, bold) => { g.font = `${bold ? '700 ' : ''}${s}px Georgia, serif`; g.textAlign = 'center'; g.fillStyle = ink; g.fillText(t, x, y); };
      g.fillStyle = 'rgba(122,28,42,0.85)'; g.fillRect(110, 16, 200, 40); g.fillStyle = '#f6ecd2'; g.font = '15px Georgia, serif'; g.textAlign = 'center'; g.fillText('S T A G E', 210, 42);
      g.strokeStyle = ink; g.lineWidth = 1.4; g.strokeRect(130, 62, 160, 26); T(210, 80, 11, 'PIT');
      'ABCDEFGHIJKLMNOP'.split('').forEach((rw, i) => {
        const y = 128 + i * 9; g.strokeStyle = '#8a6a4a'; g.setLineDash([3, 2]); g.beginPath(); g.moveTo(120, y); g.lineTo(300, y); g.stroke(); g.setLineDash([]);
        g.font = '7px Georgia, serif'; g.textAlign = 'right'; g.fillStyle = ink; g.fillText(rw, 112, y + 3);
      });
      T(210, 284, 11, 'STALLS');
      g.strokeStyle = ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(100, 296); g.quadraticCurveTo(210, 320, 320, 296); g.stroke(); T(210, 328, 11, 'DRESS CIRCLE');
      g.beginPath(); g.moveTo(86, 342); g.quadraticCurveTo(210, 366, 334, 342); g.stroke(); T(210, 374, 11, 'GALLERY');
      const box = (x, y, id, royal) => { if (royal) { g.fillStyle = '#e9c46a'; g.fillRect(x, y, 34, 40); } g.strokeStyle = ink; g.lineWidth = 1.6; g.strokeRect(x, y, 34, 40); T(x + 17, y + 26, 15, id, true); };
      box(56, 70, 'A', true); box(56, 140, 'B'); box(330, 70, 'C'); box(330, 140, 'D');
      g.fillStyle = '#b8862b'; g.beginPath(); g.moveTo(63, 66); g.lineTo(66, 56); g.lineTo(70, 62); g.lineTo(73, 53); g.lineTo(76, 62); g.lineTo(80, 56); g.lineTo(83, 66); g.closePath(); g.fill(); g.stroke();
      T(73, 124, 10, 'ROYAL', true);
      T(73, 210, 9, 'HOUSE LEFT'); T(347, 210, 9, 'HOUSE RIGHT');
      g.restore();
    },
  });
}

/**
 * A label band for a drum wheel (CylinderGeometry turned to an X axis): labels run round the rim (u), each one
 * written so it reads left-to-right when its cell faces +Z. Label i is centred at u = (i + 0.5) / n, so a wheel
 * shows label k with rotation.x = TAU * (k + 0.5) / n.
 */
export function wheelTexture(labels, { cell = 120, width = 200, bg = '#ece2c8', fg = '#1a1208', red = [], fill = 0.62 } = {}) {
  const n = labels.length, W = n * cell, H = width, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  grime(g, W, H, { seed: n, color: '#6a5030', octaves: [[6, 0.12], [30, 0.08]] });
  labels.forEach((l, i) => {
    g.fillStyle = i % 2 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'; g.fillRect(i * cell, 0, cell, H);
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(i * cell, 0, 2, H);
    g.save(); g.translate((i + 0.5) * cell, H / 2); g.rotate(Math.PI / 2);
    let s = cell * fill; g.font = `700 ${s}px ${FONTS.fell}`; // FIXED BY qa-foyer: fill (was a fixed 0.62)
    while (g.measureText(l).width > H * 0.88 && s > 10) { s -= 2; g.font = `700 ${s}px ${FONTS.fell}`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = red.includes(i) ? '#8a1a14' : fg; g.fillText(l, 0, 2);
    g.restore();
  });
  return canvasTexture(c);
}

/** The night street beyond the glass doors: wet setts, a sodium lamp, the shut shops opposite. */
export function streetTexture() {
  const W = 1024, H = 640, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(61);
  let gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#06070c'); gr.addColorStop(0.45, '#141018'); gr.addColorStop(0.62, '#2a1a0e'); gr.addColorStop(1, '#3a2410');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // shopfronts opposite: dark blocks with faint lettering, one lit window upstairs
  for (let i = 0; i < 5; i++) {
    const x = i * 220 - 30 + r() * 20, w = 200;
    g.fillStyle = '#0d0b0c'; g.fillRect(x, 120, w, 270);
    g.fillStyle = '#1a1410'; g.fillRect(x + 14, 250, w - 28, 120);
    g.fillStyle = 'rgba(200,170,110,0.25)'; g.font = `22px ${FONTS.display}`; g.textAlign = 'center';
    g.fillText(['PAWNBROKER', 'TEAS', 'HOSIER', 'J. LYONS', 'TOBACCO'][i], x + w / 2, 236);
    for (let k = 0; k < 2; k++) { g.fillStyle = i === 2 && k === 1 ? 'rgba(255,190,110,0.85)' : 'rgba(40,40,52,0.9)'; g.fillRect(x + 30 + k * 90, 150, 50, 60); }
  }
  // the lamp-post and its sodium glow
  const lx = W * 0.68, ly = 210;
  g.fillStyle = '#0a0806'; g.fillRect(lx - 5, ly, 10, H * 0.72 - ly);
  gr = g.createRadialGradient(lx, ly, 2, lx, ly, 260); gr.addColorStop(0, 'rgba(255,190,90,1)'); gr.addColorStop(0.08, 'rgba(255,160,60,0.75)'); gr.addColorStop(0.4, 'rgba(255,130,40,0.18)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // wet setts: reflections of the lamp in the road
  for (let y = H * 0.66; y < H; y += 7) {
    for (let x = (y / 7) % 2 ? 0 : 14; x < W; x += 28) { g.fillStyle = `rgba(${150 + r() * 60},${90 + r() * 40},40,${0.05 + r() * 0.08})`; g.fillRect(x, y, 24, 4); }
  }
  gr = g.createLinearGradient(lx - 40, 0, lx + 40, 0); gr.addColorStop(0, 'rgba(255,170,70,0)'); gr.addColorStop(0.5, 'rgba(255,170,70,0.45)'); gr.addColorStop(1, 'rgba(255,170,70,0)');
  g.fillStyle = gr; g.fillRect(lx - 40, H * 0.68, 80, H * 0.32);
  // kerb and pavement
  g.fillStyle = 'rgba(60,44,30,0.9)'; g.fillRect(0, H * 0.86, W, 10);
  // rain
  g.strokeStyle = 'rgba(200,190,170,0.18)'; g.lineWidth = 1;
  for (let i = 0; i < 500; i++) { const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 14 + r() * 10); g.stroke(); }
  return canvasTexture(c);
}

/** Crane's notice: capitals in ink on a card, drawing-pinned. */
export function noticeTexture() {
  const W = 512, H = 360;
  return agedPaperTexture({
    w: W, h: H, tint: '#f0e8d4', seed: 88, age: 0.5, key: 'foyer-notice',
    draw: (g) => {
      g.fillStyle = '#1a1420'; g.textAlign = 'center';
      g.font = `600 52px ${FONTS.typed}`; g.fillText('CLOSED', W / 2, 92);
      g.font = `36px ${FONTS.typed}`; g.fillText('BY ORDER OF', W / 2, 150); g.fillText('THE MANAGEMENT', W / 2, 196);
      g.fillStyle = '#20183a'; g.font = `44px ${FONTS.hand}`; g.fillText('— S. Crane', W / 2 + 40, 286);
      g.fillStyle = '#20183a'; g.fillRect(70, 216, W - 140, 3);
    },
  });
}

/** The printed ticket (card). fields: { area, letter, price, day, month } as display strings. */
export function drawTicket(g, W, H, f) {
  g.fillStyle = '#e8c890'; g.fillRect(0, 0, W, H);
  grime(g, W, H, { seed: 7, color: '#8a6a3a', octaves: [[4, 0.15], [20, 0.08]] });
  g.strokeStyle = '#5a2a14'; g.lineWidth = 4; g.strokeRect(10, 10, W - 20, H - 20);
  g.setLineDash([6, 6]); g.beginPath(); g.moveTo(W * 0.72, 12); g.lineTo(W * 0.72, H - 12); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#3a1a0c'; g.textAlign = 'center';
  g.font = `34px ${FONTS.display}`; g.fillText('THE EMPRESS', W * 0.36, 52);
  g.font = `600 30px ${FONTS.fell}`; g.fillText(`${f.area}  ·  ${f.letter}`, W * 0.36, 100);
  g.fillText(f.price, W * 0.36, 140);
  g.font = `26px ${FONTS.fell}`; g.fillText(`${f.day} ${f.month} 1931`, W * 0.36, 178);
  g.font = `600 24px ${FONTS.fell}`; g.fillText('ADMIT ONE', W * 0.86, 90); g.fillText(f.letter, W * 0.86, 140);
}

// =====================================================================================================
// 3D PROPS
// =====================================================================================================

/** Invisible click target (same as hotspots.proxyBox, usable without ctx). */
export function hitBox(w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.userData.hitProxy = true;
  return m;
}
const keep = (o) => { o.userData.keep = true; return o; };

/**
 * An iron chain as one InstancedMesh along a polyline (world-ish points in the parent's space). setTravel(m) slides
 * every link along the path (chain paying out or winding in) without changing the path. Returns the mesh.
 */
export function chainRun(points, { pitch = 0.05, r = 0.016, wire = 0.0045, material = null } = {}) {
  const pts = points.map((p) => new THREE.Vector3(...p));
  const lens = [0]; for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = lens[lens.length - 1], n = Math.floor(total / pitch);
  const geo = new THREE.TorusGeometry(r, wire, 3, 5).scale(1, 1.55, 1);
  const im = new THREE.InstancedMesh(geo, material || M.ironBlack(), n);
  im.castShadow = false; im.receiveShadow = false;
  const o = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion(), qt = new THREE.Quaternion();
  const place = (s) => {
    for (let i = 0; i < n; i++) {
      let d = ((i * pitch + s) % total + total) % total;
      let k = 1; while (k < lens.length - 1 && lens[k] < d) k++;
      const t = (d - lens[k - 1]) / Math.max(1e-6, lens[k] - lens[k - 1]);
      o.position.lerpVectors(pts[k - 1], pts[k], t);
      dir.subVectors(pts[k], pts[k - 1]).normalize();
      q.setFromUnitVectors(up, dir); qt.setFromAxisAngle(up, i % 2 ? Math.PI / 2 : 0);
      o.quaternion.copy(q).multiply(qt);
      o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  };
  place(0);
  im.userData.setTravel = (s) => place(s);
  im.userData.length = total;
  return keep(im);
}

/**
 * The chandelier winch cabinet: an iron box screwed to the wall, door standing open on a geared hand winch (big gear
 * on the chain drum, pinion on the crank shaft), a square drive for the missing handle, a ratchet pawl.
 * Origin: back centre, at the cabinet's vertical centre; faces +Z (the door hinges on its +X edge).
 * userData: { door (pivot), setDoor(t), handle (Group, hidden until fitted), setHandle(on), setTurn(angle) (crank
 *   angle; gear and drum follow at 12:44), drive (the square drive mesh), pawl, chainExit (Vector3 local: where the
 *   chain leaves the top), size: {w,h,d} }.
 */
export function winchCabinet() {
  const g = grp('winchCabinet');
  const w = 0.62, h = 0.92, d = 0.34, t = 0.012;
  const iron = M.enamel('#22302a', { roughness: 0.55 });
  const inner = M.matte('#141614', { roughness: 0.9 });
  g.add(mergeInto([boxG(w, h, t, 0, 0, t / 2), boxG(t, h, d, -w / 2 + t / 2, 0, d / 2), boxG(t, h, d, w / 2 - t / 2, 0, d / 2), boxG(w, t, d, 0, h / 2 - t / 2, d / 2), boxG(w, t, d, 0, -h / 2 + t / 2, d / 2)], iron));
  g.add(mesh(new THREE.PlaneGeometry(w - 0.03, h - 0.03).translate(0, 0, t + 0.001), inner, { cast: false }));
  // rivets round the front rim
  const riv = [];
  for (let i = 0; i < 9; i++) { const y = -h / 2 + 0.04 + i * (h - 0.08) / 8; riv.push({ p: [-w / 2 + 0.006, y, d - 0.01] }, { p: [w / 2 - 0.006, y, d - 0.01] }); }
  g.add(instances(new THREE.SphereGeometry(0.006, 6, 4), M.ironBlack(), riv, { cast: false }));
  // the door: hinged on the -X edge, swings round to lie almost flat beside the cabinet (its inside face, where a
  // label can go, then faces the room: door-local (w/2, y, -0.004), plane facing -Z)
  const door = keep(grp('winchDoor')); door.position.set(-w / 2, 0, d);
  door.add(mergeInto([boxG(w - 0.01, h - 0.01, 0.014, w / 2, 0, 0.007), boxG(w - 0.08, h - 0.08, 0.008, w / 2, 0, 0.018)], iron));
  door.add(mergeInto([cylG(0.008, 0.008, 0.06, 8, 0, h / 2 - 0.12, 0.004), cylG(0.008, 0.008, 0.06, 8, 0, -h / 2 + 0.12, 0.004), boxG(0.02, 0.09, 0.02, w - 0.05, 0, 0.03, 0.004)], M.ironBlack()));
  g.add(door);
  g.userData.door = door;
  g.userData.setDoor = (k) => { door.rotation.y = -3.0 * k; };
  g.userData.setDoor(1);
  // the gear train (axes along Z): pinion on the crank shaft (lower), gear + drum above
  const gx = 0.06, py = -0.24, gy = py + 0.045 + 0.155;
  const pinion = keep(grp('pinion')); pinion.position.set(gx, py, 0.2); g.add(pinion);
  const pg = new THREE.Group(); pinion.add(pg);
  pg.add(mesh(gearGeo(12, 0.0075, 0.024), M.iron({ color: '#3a3430', roughness: 0.4 })));
  const gearG = keep(grp('bigGear')); gearG.position.set(gx, gy, 0.2); g.add(gearG);
  gearG.add(mesh(gearGeo(44, 0.0075, 0.02), M.tarnishedBrass({ amount: 0.55 })));
  const drum = keep(grp('drum')); drum.position.set(gx, gy, 0.1); g.add(drum);
  const dg = [cylG(0.055, 0.055, 0.12, 20).rotateX(Math.PI / 2), cylG(0.09, 0.09, 0.012, 24, 0, -0.065, 0).rotateX(Math.PI / 2), cylG(0.09, 0.09, 0.012, 24, 0, 0.065, 0).rotateX(Math.PI / 2)];
  drum.add(mergeInto(dg, M.ironBlack()));
  // chain wound on the drum: rings of links
  const wound = [];
  for (let k = 0; k < 5; k++) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; wound.push({ p: [Math.cos(a) * 0.066, Math.sin(a) * 0.066, -0.045 + k * 0.022], r: [0, 0, a + (i % 2) * 0.0], s: [1, 1, 1] }); }
  drum.add(instances(new THREE.TorusGeometry(0.012, 0.0035, 3, 6).scale(1, 1.5, 1), M.ironBlack(), wound, { cast: false }));
  // shafts, bearings, frame plates
  g.add(mergeInto([
    cylG(0.012, 0.012, 0.24, 10).rotateX(Math.PI / 2).translate(gx, py, 0.12),
    cylG(0.014, 0.014, 0.24, 10).rotateX(Math.PI / 2).translate(gx, gy, 0.12),
    boxG(0.05, 0.62, 0.016, gx - 0.2, -0.04, 0.03, 0.004), boxG(0.05, 0.62, 0.016, gx + 0.2, -0.04, 0.03, 0.004),
    boxG(0.45, 0.04, 0.016, gx, gy, 0.03, 0.004), boxG(0.45, 0.04, 0.016, gx, py, 0.03, 0.004),
  ], M.ironBlack()));
  // the square drive: the end of the crank shaft, waiting for a handle
  const drive = keep(mesh(mergeG([boxG(0.026, 0.026, 0.05, 0, 0, 0.025, 0.002), cylG(0.024, 0.024, 0.016, 16, 0, 0, 0.0).rotateX(Math.PI / 2)]), M.brass({ roughness: 0.3 })));
  drive.position.set(gx, py, 0.24); g.add(drive);
  // the handle (crank): arm + wooden grip; pivots on the drive
  const handle = keep(grp('winchHandle')); handle.position.set(gx, py, 0.27); g.add(handle);
  handle.add(mesh(mergeG([boxG(0.03, 0.03, 0.03, 0, 0, 0, 0.004), boxG(0.026, 0.19, 0.012, 0, 0.095, 0.01, 0.004)]), M.ironBlack()));
  handle.add(mesh(latheG([[0, 0], [0.016, 0.004], [0.019, 0.04], [0.016, 0.09], [0, 0.095]], 12).rotateX(Math.PI / 2).translate(0, 0.18, 0.02), M.wood({ tint: '#5a3a22' })));
  handle.visible = false;
  // pawl on the gear rim
  const pawl = keep(mesh(boxG(0.06, 0.012, 0.012, 0.03, 0, 0, 0.003), M.ironBlack()));
  pawl.position.set(gx - 0.2, gy + 0.12, 0.215); pawl.rotation.z = -0.35; g.add(pawl);
  let turn = 0;
  g.userData.handle = handle; g.userData.drive = drive; g.userData.pawl = pawl; g.userData.drum = drum; g.userData.gear = gearG; g.userData.pinion = pinion;
  g.userData.setHandle = (on) => { handle.visible = !!on; };
  g.userData.setTurn = (a) => {
    turn = a;
    handle.rotation.z = a; pg.rotation.z = a;
    gearG.rotation.z = -a * 12 / 44; drum.rotation.z = -a * 12 / 44;
    pawl.rotation.z = -0.35 + Math.abs(Math.sin(a * 44 / 12 * 2)) * 0.08;
  };
  g.userData.getTurn = () => turn;
  g.userData.chainExit = new THREE.Vector3(gx + 0.07, h / 2, 0.1);
  g.userData.size = { w, h, d };
  return g;
}

const gearGeos = new Map();
function gearGeo(teeth, module, thick) {
  const key = `${teeth}:${module}:${thick}`;
  if (gearGeos.has(key)) return gearGeos.get(key);
  const r = module * teeth / 2, ra = r + module, rr = r - 1.25 * module, pa = TAU / teeth, s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = i * pa, P = (rad, an) => [Math.cos(an) * rad, Math.sin(an) * rad];
    const pts = [P(rr, a), P(ra, a + 0.14 * pa), P(ra, a + 0.36 * pa), P(rr, a + 0.5 * pa), P(rr, a + 0.75 * pa)];
    pts.forEach(([x, y], k) => (i === 0 && k === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  }
  s.closePath();
  if (r > 0.07) for (let i = 0; i < 6; i++) { const a = i * TAU / 6, hp = new THREE.Path(); hp.absarc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.17, 0, TAU, true); s.holes.push(hp); }
  const geo = mergeG([new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 6 }).translate(0, 0, -thick / 2), cylG(r * 0.22, r * 0.22, thick * 1.6, 16).rotateX(Math.PI / 2)]);
  gearGeos.set(key, geo);
  return geo;
}

// ---- Crane's safe ----------------------------------------------------------------------------------------
/** Dial face 0-99: ticks, numbers every ten, and three spots worn bright by fingers (3, 14, 31). */
export function safeDialTexture({ size = 1024, worn = [3, 14, 31] } = {}) {
  const c = makeCanvas(size, size), g = c.getContext('2d'), R = size / 2, r = rng(3);
  g.translate(R, R);
  let gr = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
  gr.addColorStop(0, '#2a2622'); gr.addColorStop(0.8, '#1a1714'); gr.addColorStop(1, '#0e0c0a');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
  // worn bright: polished brass showing through the black, an oval smear across the tick and the rim
  for (const n of worn) {
    const a = n / 100 * TAU - Math.PI / 2;
    g.save(); g.rotate(a + Math.PI / 2);
    gr = g.createRadialGradient(0, -R * 0.8, 2, 0, -R * 0.8, R * 0.13);
    gr.addColorStop(0, 'rgba(240,206,120,0.95)'); gr.addColorStop(0.5, 'rgba(214,170,80,0.7)'); gr.addColorStop(1, 'rgba(180,140,60,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, -R * 0.8, R * 0.075, R * 0.16, 0, 0, TAU); g.fill();
    g.restore();
  }
  for (let i = 0; i < 100; i++) {
    const a = i / 100 * TAU - Math.PI / 2, big = i % 10 === 0, mid = i % 5 === 0;
    const r0 = R * (big ? 0.82 : mid ? 0.86 : 0.89), r1 = R * 0.95;
    const bright = worn.includes(i);
    g.strokeStyle = bright ? '#fff0c0' : '#d8cdb4'; g.lineWidth = bright ? 7 : big ? 6 : mid ? 4 : 2.5;
    g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 100; i += 10) {
    const a = i / 100 * TAU - Math.PI / 2;
    g.save(); g.rotate(a + Math.PI / 2); g.fillStyle = '#e8dcc0'; g.font = `700 ${R * 0.13}px ${FONTS.fell}`; g.fillText(String(i), 0, -R * 0.69); g.restore();
  }
  for (const n of worn) { // the worn numbers' own small figures, plainly brighter
    const a = n / 100 * TAU - Math.PI / 2;
    g.save(); g.rotate(a + Math.PI / 2); g.fillStyle = '#ffe9a8'; g.font = `700 ${R * 0.085}px ${FONTS.fell}`; g.fillText(String(n), 0, -R * 0.72); g.restore();
  }
  g.strokeStyle = '#3a342c'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R * 0.55, 0, TAU); g.stroke();
  g.fillStyle = '#c9b88a'; g.font = `italic ${R * 0.07}px ${FONTS.fell}`; g.fillText('HOBBS & PELHAM', 0, R * 0.38);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.04})`; g.fillRect((r() - 0.5) * size, (r() - 0.5) * size, 2, 2); }
  return canvasTexture(c);
}

/** The enamel door of the safe: green, gold lining, the maker's transfer. */
function safeDoorTexture() {
  const W = 512, H = 680, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#2c4a38'; g.fillRect(0, 0, W, H);
  grime(g, W, H, { seed: 12, color: '#0e1a12', octaves: [[4, 0.3], [16, 0.18], [60, 0.08]] });
  g.strokeStyle = '#c9a24a'; g.lineWidth = 5; g.strokeRect(26, 26, W - 52, H - 52); g.lineWidth = 2; g.strokeRect(38, 38, W - 76, H - 76);
  for (const [x, y] of [[38, 38], [W - 38, 38], [38, H - 38], [W - 38, H - 38]]) { g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill(); }
  g.fillStyle = '#d8b860'; g.textAlign = 'center'; g.font = `italic 30px ${FONTS.fell}`; g.fillText('Hobbs & Pelham', W / 2, H - 70);
  g.font = `16px ${FONTS.fell}`; g.fillText('FIRE-RESISTING  ·  LONDON', W / 2, H - 46);
  return canvasTexture(c);
}

/**
 * Crane's safe: green iron, a dial 0-99 with a brass readout window above the index, a centre knob, a lever handle,
 * a three-cell register window, and the takings envelope and the key inside. Origin: floor centre; faces +Z.
 * userData: { door (pivot; rotation.y 0 shut, -1.9 open), setOpen(t), dial (Group: rotation.z), setDial(n),
 *   value, knob, rimL, rimR (hit proxies: step -1 / +1), readout (redraws on setDial), setTicks(n | [bool,bool,bool]),
 *   handle, setHandle(t) (0 rest, 1 down), envelope, keyTag, setContents({ envelope, key }), trumpet, setTrumpet(on),
 *   ripple() (the trumpet's bell shivers: a tumbler), dialCentre (Vector3 local) }.
 */
export function foyerSafe() {
  const g = grp('foyerSafe');
  const W = 0.74, H = 1.0, D = 0.66, y0 = 0.07;
  const green = M.enamel('#2c4a38', { roughness: 0.45 });
  const dark = M.matte('#0f0d0b', { roughness: 0.9 });
  // body: shell with a door opening (left 0.07, right 0.07, top 0.07, bottom 0.12)
  const fx = W / 2, top = y0 + H;
  const dw = W - 0.14, dh = H - 0.19, dyc = y0 + 0.12 + dh / 2;
  g.add(mergeInto([
    boxG(W, H, 0.05, 0, y0 + H / 2, -D / 2 + 0.025, 0.01), boxG(0.06, H, D, -fx + 0.03, y0 + H / 2, 0, 0.012), boxG(0.06, H, D, fx - 0.03, y0 + H / 2, 0, 0.012),
    boxG(W, 0.06, D, 0, top - 0.03, 0, 0.012), boxG(W, 0.12, D, 0, y0 + 0.06, 0, 0.012),
    boxG(0.07, H, 0.02, -fx + 0.035, y0 + H / 2, D / 2, 0.006), boxG(0.07, H, 0.02, fx - 0.035, y0 + H / 2, D / 2, 0.006), boxG(W, 0.07, 0.02, 0, top - 0.035, D / 2, 0.006), boxG(W, 0.12, 0.02, 0, y0 + 0.06, D / 2, 0.006),
    boxG(W + 0.03, 0.03, D + 0.03, 0, top + 0.015, 0, 0.01),
  ], green));
  // the strong-room inside
  g.add(mergeInto([boxG(dw - 0.02, 0.01, D - 0.12, 0, y0 + 0.125, 0.0, 0.002), boxG(dw - 0.02, 0.012, D - 0.14, 0, dyc + 0.06, -0.01, 0.002)], M.wood({ tint: '#4a3020' })));
  g.add(mesh(new THREE.BoxGeometry(dw - 0.01, dh - 0.01, D - 0.08).translate(0, dyc, -0.02), new THREE.MeshStandardMaterial({ color: '#16120e', roughness: 0.95, side: THREE.BackSide }), { cast: false }));
  // plinth and castors
  g.add(mergeInto([boxG(W - 0.04, 0.03, D - 0.04, 0, 0.055, 0, 0.004), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => cylG(0.03, 0.03, 0.025, 12, sx * (W / 2 - 0.07), 0.03, sz * (D / 2 - 0.07)).rotateZ(0))], M.ironBlack()));
  // maker's plate on the top rail
  const plate = mesh(new THREE.PlaneGeometry(0.26, 0.045), new THREE.MeshStandardMaterial({ map: labelPlate('S. CRANE  ·  PRIVATE', { style: 'brass', w: 512, h: 88 }), metalness: 0.7, roughness: 0.35 }), { cast: false });
  plate.position.set(0, top - 0.035, D / 2 + 0.011); g.add(plate);
  // ---- the door
  const door = keep(grp('safeDoor')); door.position.set(-dw / 2, dyc, D / 2 + 0.005); g.add(door);
  const doorMat = new THREE.MeshPhysicalMaterial({ map: safeDoorTexture(), roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const slab = mesh(boxG(dw - 0.006, dh - 0.006, 0.07, dw / 2, 0, 0.035, 0.01), green); door.add(slab);
  const face = mesh(new THREE.PlaneGeometry(dw - 0.03, dh - 0.03).translate(dw / 2, 0, 0.0705), doorMat, { cast: false }); door.add(face);
  door.add(mergeInto([cylG(0.018, 0.018, 0.12, 10, 0, dh / 2 - 0.12, 0.03), cylG(0.018, 0.018, 0.12, 10, 0, -dh / 2 + 0.12, 0.03)], M.ironBlack()));
  // door back: bolt work behind a plate
  door.add(mesh(boxG(dw - 0.08, dh - 0.08, 0.01, dw / 2, 0, -0.004, 0.004), M.iron({ color: '#4a4a44' })));
  const dx = dw * 0.44, dyD = 0.0, Rr = 0.105, fz = 0.072;
  // dial: knurled black ring + face, turns on rotation.z
  const dial = keep(grp('safeDial')); dial.position.set(dx, dyD, fz); door.add(dial);
  dial.add(mesh(cylG(Rr + 0.012, Rr + 0.016, 0.03, 60).rotateX(Math.PI / 2).translate(0, 0, 0.012), M.bakelite('#14110e')));
  const dface = mesh(new THREE.CircleGeometry(Rr, 64).translate(0, 0, 0.028), new THREE.MeshStandardMaterial({ map: safeDialTexture(), roughness: 0.38, metalness: 0.25 }), { cast: false });
  dial.add(dface);
  // knurling on the ring
  const kn = []; for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; kn.push({ p: [Math.cos(a) * (Rr + 0.016), Math.sin(a) * (Rr + 0.016), 0.012], r: [0, 0, a] }); }
  dial.add(instances(new THREE.BoxGeometry(0.006, 0.006, 0.028), M.bakelite('#1c1814'), kn, { cast: false }));
  const knob = keep(mesh(latheG([[0, 0], [0.034, 0], [0.036, 0.012], [0.03, 0.03], [0.018, 0.045], [0, 0.048]], 24).rotateX(Math.PI / 2).translate(0, 0, 0.026), M.brass({ roughness: 0.25 })));
  knob.position.set(dx, dyD, fz); door.add(knob);
  // index pointer at 12 o'clock and the readout window above it
  door.add(mesh(new THREE.ConeGeometry(0.011, 0.024, 3).rotateZ(Math.PI).translate(dx, dyD + Rr + 0.03, fz + 0.012), M.brass({ roughness: 0.25 })));
  const rc = makeCanvas(256, 160), rg = rc.getContext('2d'), rtex = canvasTexture(rc);
  const readout = mesh(new THREE.PlaneGeometry(0.1, 0.0625), new THREE.MeshBasicMaterial({ map: rtex, color: '#d8ccb0' }), { cast: false, receive: false });
  readout.position.set(dx, dyD + Rr + 0.105, fz + 0.006); door.add(readout);
  door.add(mergeInto([boxG(0.124, 0.012, 0.014, dx, dyD + Rr + 0.142, fz, 0.003), boxG(0.124, 0.012, 0.014, dx, dyD + Rr + 0.068, fz, 0.003), boxG(0.012, 0.086, 0.014, dx - 0.056, dyD + Rr + 0.105, fz, 0.003), boxG(0.012, 0.086, 0.014, dx + 0.056, dyD + Rr + 0.105, fz, 0.003)], M.brass({ roughness: 0.3 })));
  const drawReadout = (n) => {
    rg.fillStyle = '#f2e8cc'; rg.fillRect(0, 0, 256, 160);
    const gr = rg.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.2)'); rg.fillStyle = gr; rg.fillRect(0, 0, 256, 160);
    rg.fillStyle = '#1a1208'; rg.font = `700 128px ${FONTS.fell}`; rg.textAlign = 'center'; rg.textBaseline = 'middle';
    rg.fillText(String(n).padStart(2, '0'), 128, 88);
    rtex.needsUpdate = true;
  };
  // register window under the dial: three cells, a tick in each as numbers are registered
  const regY = dyD - Rr - 0.085;
  door.add(mergeInto([boxG(0.16, 0.012, 0.012, dx, regY + 0.03, fz, 0.003), boxG(0.16, 0.012, 0.012, dx, regY - 0.03, fz, 0.003), ...[-0.075, -0.025, 0.025, 0.075].map((x) => boxG(0.01, 0.07, 0.012, dx + x, regY, fz, 0.003))], M.brass({ roughness: 0.3 })));
  door.add(mesh(new THREE.PlaneGeometry(0.15, 0.05).translate(dx, regY, fz - 0.004), M.matte('#e8dcc0'), { cast: false }));
  const tickGeo = (() => { const s = new THREE.Shape(); s.moveTo(-0.012, 0.0); s.lineTo(-0.004, -0.012); s.lineTo(0.014, 0.014); s.lineTo(0.01, 0.017); s.lineTo(-0.004, -0.004); s.lineTo(-0.009, 0.004); s.closePath(); return new THREE.ShapeGeometry(s); })();
  const tickMat = new THREE.MeshBasicMaterial({ color: '#9a1a12' });
  const ticks = [-0.05, 0, 0.05].map((x) => { const m = noRay(mesh(tickGeo, tickMat, { cast: false, receive: false })); m.position.set(dx + x, regY, fz - 0.002); m.visible = false; door.add(m); return m; });
  // handle: a lever on a boss to the right of the dial
  const handle = keep(grp('safeHandle')); handle.position.set(dw * 0.83, dyD, fz); door.add(handle);
  handle.add(mesh(latheG([[0, 0], [0.03, 0], [0.03, 0.02], [0.02, 0.035], [0, 0.04]], 20).rotateX(Math.PI / 2), M.brass({ roughness: 0.3 })));
  handle.add(mesh(mergeG([cylG(0.009, 0.011, 0.095, 10).rotateZ(-Math.PI / 2).translate(0.05, 0, 0.035), new THREE.SphereGeometry(0.018, 14, 10).translate(0.1, 0, 0.035)]), M.brass({ roughness: 0.3 })));
  // contents: the takings envelope and the key on its tag
  const envTex = agedPaperTexture({ w: 320, h: 200, tint: '#d8c8a0', seed: 5, age: 0.6, key: 'foyer-envelope', draw: (eg) => { eg.fillStyle = '#2a1c14'; eg.textAlign = 'center'; eg.font = `600 34px ${FONTS.fell}`; eg.fillText('TAKINGS', 160, 92); eg.font = `italic 26px ${FONTS.fell}`; eg.fillText('w/e 14.3.31', 160, 132); eg.strokeStyle = 'rgba(60,40,20,0.5)'; eg.beginPath(); eg.moveTo(0, 0); eg.lineTo(160, 70); eg.lineTo(320, 0); eg.stroke(); } });
  const envelope = keep(mesh(new THREE.BoxGeometry(0.22, 0.004, 0.14), [M.matte('#c8b890'), M.matte('#c8b890'), new THREE.MeshStandardMaterial({ map: envTex, roughness: 0.9 }), M.matte('#b8a880'), M.matte('#c8b890'), M.matte('#c8b890')]));
  envelope.position.set(-0.04, y0 + 0.13 + 0.004, 0.02); envelope.rotation.y = 0.08; g.add(envelope);
  const keyTag = keep(grp('keyTag'));
  const k = keyProp({ style: 'mortice', metal: 'iron', len: 0.11 }); k.rotation.set(-Math.PI / 2, 0, 0.3); keyTag.add(k);
  const tag = cardTag({ text: 'AUDITORIUM\nDOORS', w: 0.075, seed: 4 }); tag.position.set(0.075, 0.003, 0.02); tag.rotation.set(-Math.PI / 2, 0, -0.2); keyTag.add(tag);
  keyTag.position.set(0.1, dyc + 0.066, 0.0); g.add(keyTag);
  // POLISH: the strong-room is dressed (it read as an empty box): two cash ledgers on the shelf, left of the key; a cash
  // tin and a banded bundle of ticket stubs at the back of the floor, behind the envelope. None of it takes a click.
  const shelfY = dyc + 0.066, floorY = y0 + 0.13;
  g.add(noRay(mergeInto([boxG(0.15, 0.03, 0.21, -0.18, shelfY + 0.015, -0.06, 0.004), boxG(0.14, 0.026, 0.2, 0, 0, 0, 0.004).rotateY(0.06).translate(-0.175, shelfY + 0.043, -0.07)], M.leather('#4a1c18', { roughness: 0.7 }))));
  g.add(noRay(mergeInto([boxG(0.146, 0.022, 0.205, -0.178, shelfY + 0.015, -0.055, 0.002), boxG(0.136, 0.018, 0.195, 0, 0, 0, 0.002).rotateY(0.06).translate(-0.171, shelfY + 0.043, -0.065)], M.matte('#d8cba8'))));
  g.add(noRay(mesh(boxG(0.2, 0.09, 0.14, 0.15, floorY + 0.045, -0.17, 0.008), M.enamel('#3a1a16', { roughness: 0.5 }))));
  g.add(noRay(mergeInto([boxG(0.07, 0.008, 0.014, 0.15, floorY + 0.094, -0.17, 0.003), boxG(0.03, 0.03, 0.004, 0.15, floorY + 0.06, -0.098, 0.002)], M.brass({ roughness: 0.35 }))));
  g.add(noRay(mesh(boxG(0.12, 0.06, 0.07, 0, 0, 0, 0.004).rotateY(-0.25).translate(-0.17, floorY + 0.03, -0.2), M.matte('#c9a86a', { roughness: 0.95 }))));
  g.add(noRay(mesh(boxG(0.124, 0.062, 0.012, 0, 0, 0, 0.002).rotateY(-0.25).translate(-0.17, floorY + 0.03, -0.2), M.matte('#7a2a20'))));
  // the ear trumpet pressed to the door (shown once the trumpet is used on the safe)
  const trumpet = keep(earTrumpet({ tag: false })); trumpet.scale.setScalar(1.15);
  trumpet.position.set(dw * 0.72, 0.16, fz + 0.075); trumpet.rotation.set(Math.PI / 2, 0.9, -0.5);
  trumpet.visible = false; door.add(trumpet);
  const bell = trumpet.userData.bell;
  // hit proxies: rim halves for fine steps
  const rimL = hitBox(0.1, 0.24, 0.05); rimL.position.set(dx - 0.075, dyD, fz + 0.03); door.add(rimL);
  const rimR = hitBox(0.1, 0.24, 0.05); rimR.position.set(dx + 0.075, dyD, fz + 0.03); door.add(rimR);
  let value = 0, rip = 0;
  g.userData = {
    ...g.userData, door, dial, knob, readout, handle, envelope, keyTag, trumpet, rimL, rimR, ticks,
    dialCentre: new THREE.Vector3(-dw / 2 + dx, dyc + dyD, D / 2 + fz),
    get value() { return value; },
    setDial(n) { value = ((Math.round(n) % 100) + 100) % 100; dial.rotation.z = (n / 100) * TAU; drawReadout(value); },
    setTicks(n) { ticks.forEach((m, i) => { m.visible = Array.isArray(n) ? !!n[i] : i < n; }); },
    setHandle(t) { handle.rotation.z = 1.1 - t * 1.6; },
    setOpen(t) { door.rotation.y = -1.9 * t; },
    setContents({ envelope: e = true, key: kk = true } = {}) { envelope.visible = e; keyTag.visible = kk; },
    setTrumpet(on) { trumpet.visible = !!on; },
    ripple() { rip = 1; },
    update(dt) { if (rip > 0) { rip = Math.max(0, rip - dt * 2.2); const s = 1 + Math.sin(rip * 40) * 0.06 * rip; bell.scale.set(s, 1, s); } },
  };
  g.userData.setDial(0); g.userData.setHandle(0); g.userData.setTicks(0);
  return g;
}

/** A brass ear trumpet: a flared bell, a curved tube, an earpiece; optional luggage tag. Lies along +X. userData.bell. */
export function earTrumpet({ tag = true } = {}) {
  const g = grp('earTrumpet');
  const brass = M.brass({ color: '#c8a050', roughness: 0.22 });
  const bell = grp('bell'); g.add(bell);
  const bp = [[0.01, 0.0], [0.014, 0.03], [0.02, 0.06], [0.032, 0.085], [0.05, 0.1], [0.068, 0.108], [0.072, 0.11], [0.066, 0.112], [0.046, 0.104], [0.028, 0.088]];
  const bg = latheG(bp, 28).rotateZ(Math.PI / 2).translate(0.11, 0, 0);
  const bm = mesh(bg, brass); bm.material = brass; bell.add(bm);
  bm.material.side = THREE.DoubleSide;
  g.add(mesh(tubeG([[0.0, 0, 0], [-0.06, 0.0, 0.01], [-0.11, 0.025, 0.03], [-0.13, 0.06, 0.03]], 0.008, { radial: 8, seg: 20 }), brass));
  g.add(mesh(latheG([[0, 0], [0.014, 0], [0.012, 0.012], [0.008, 0.02], [0.008, 0.026]], 12).translate(-0.13, 0.06, 0.03), brass));
  if (tag) {
    const t = cardTag({ text: 'LOST 14.3.31\nSTALLS ROW C\nUNCLAIMED', w: 0.08, seed: 9 }); t.position.set(0.02, -0.005, 0.05); t.rotation.set(-Math.PI / 2 + 0.05, 0, 0.5); g.add(t);
    g.add(mesh(tubeG([[0.0, 0.006, 0.008], [0.01, 0.004, 0.03], [0.02, 0.0, 0.046]], 0.0012, { radial: 4, seg: 8 }), M.matte('#d8c8a0')));
    g.userData.tag = t;
  }
  g.userData.bell = bell;
  return g;
}

// ---- the house board -----------------------------------------------------------------------------------
export const HOUSE_SWITCHES = ['STALLS', 'PIT', 'BOXES', 'CIRCLE', 'GALLERY'];

/**
 * The house-lights board: mahogany frame, black slate panel, five brass rotary switches (STALLS · PIT · BOXES ·
 * CIRCLE · GALLERY) each with a jewel above, a trip lever, conduit to the ceiling, and Sparks's card tucked in the
 * frame. Origin: back centre (wall mounted); faces +Z.
 * userData: { switches[i] (Group: the knob; hit target), jewels[i] (Mesh), setSwitch(i, on, instant), setAll(arr,
 *   instant), states (array), trip (Group: lever; hit target), setTrip(t) (0 up/home, 1 thrown), card (Mesh) }.
 */
export function houseBoard() {
  const g = grp('houseBoard');
  const W = 1.1, H = 0.86;
  g.add(mergeInto([boxG(W, H, 0.04, 0, 0, 0.02, 0.01), boxG(W + 0.06, 0.06, 0.07, 0, H / 2, 0.035, 0.012), boxG(W + 0.06, 0.05, 0.06, 0, -H / 2, 0.03, 0.01)], M.mahogany()));
  const slateTex = (() => { const c = makeCanvas(512, 400), sg = c.getContext('2d'); sg.fillStyle = '#1a1c1e'; sg.fillRect(0, 0, 512, 400); grime(sg, 512, 400, { seed: 4, color: '#3a3e40', octaves: [[5, 0.25], [30, 0.12]], mode: 'lighter' }); return canvasTexture(c); })();
  g.add(mesh(new THREE.PlaneGeometry(W - 0.1, H - 0.14).translate(0, -0.02, 0.041), new THREE.MeshStandardMaterial({ map: slateTex, roughness: 0.6 }), { cast: false }));
  const title = mesh(new THREE.PlaneGeometry(0.44, 0.07), new THREE.MeshStandardMaterial({ map: labelPlate('HOUSE LIGHTS', { style: 'brass', w: 640, h: 100 }), metalness: 0.7, roughness: 0.35 }), { cast: false });
  title.position.set(0, H / 2 - 0.1, 0.043); g.add(title);
  const xs = [-0.4, -0.22, -0.04, 0.14, 0.32], sy = -0.04;
  const switches = [], jewels = [], states = [0, 0, 0, 0, 0], cur = [0, 0, 0, 0, 0];
  const base = [], labels = [];
  xs.forEach((x, i) => {
    base.push(cylG(0.05, 0.054, 0.012, 28, x, sy, 0.047).rotateX(Math.PI / 2).translate(0, 0, 0));
    base.push(cylG(0.025, 0.025, 0.012, 16).rotateX(Math.PI / 2).translate(x, sy + 0.135, 0.047));
    const kn = keep(grp('switch' + i)); kn.position.set(x, sy, 0.055); g.add(kn);
    kn.add(mesh(mergeG([cylG(0.034, 0.038, 0.03, 24).rotateX(Math.PI / 2).translate(0, 0, 0.015), boxG(0.016, 0.085, 0.022, 0, 0.0, 0.032, 0.004)]), M.bakelite('#1a1310')));
    kn.add(mesh(boxG(0.006, 0.03, 0.004, 0, 0.03, 0.044, 0.001), M.porcelain('#efe6d2')));
    switches.push(kn);
    const jm = glowGlass(i % 2 ? '#ffb040' : '#ff5a30', { opacity: 1, intensity: 3, offColor: '#3a1810' });
    const jw = keep(mesh(new THREE.SphereGeometry(0.02, 16, 10, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(0, 0, 0.0), jm, { cast: false }));
    jw.position.set(x, sy + 0.135, 0.053); g.add(jw); jewels.push(jw);
    const lp = mesh(new THREE.PlaneGeometry(0.15, 0.04), new THREE.MeshStandardMaterial({ map: labelPlate(HOUSE_SWITCHES[i], { style: 'ivory', w: 320, h: 84 }), roughness: 0.6 }), { cast: false });
    lp.position.set(x, sy - 0.1, 0.043); g.add(lp); labels.push(lp);
  });
  // ON / OFF arrows engraved round each switch: a small plate pair
  g.add(mergeInto(base, M.brass({ roughness: 0.3 })));
  // the trip lever
  const tx = 0.47;
  g.add(mergeInto([boxG(0.07, 0.22, 0.02, tx, sy, 0.05, 0.006), cylG(0.012, 0.012, 0.06, 10).rotateZ(Math.PI / 2).translate(tx, sy + 0.04, 0.075)], M.ironBlack()));
  const trip = keep(grp('trip')); trip.position.set(tx, sy + 0.04, 0.075); g.add(trip);
  trip.add(mesh(mergeG([boxG(0.016, 0.16, 0.014, 0, 0.08, 0.0, 0.003)]), M.ironBlack()));
  trip.add(mesh(new THREE.SphereGeometry(0.022, 14, 10).translate(0, 0.165, 0), M.bakelite('#8a1410')));
  const tripPlate = mesh(new THREE.PlaneGeometry(0.1, 0.03), new THREE.MeshStandardMaterial({ map: labelPlate('TRIP', { style: 'brass', w: 256, h: 76 }), metalness: 0.7, roughness: 0.35 }), { cast: false });
  tripPlate.position.set(tx, sy - 0.1, 0.043); g.add(tripPlate);
  // Sparks's card, tucked into the frame at the bottom left
  const cardTex = agedPaperTexture({ w: 360, h: 230, tint: '#efe4c8', seed: 19, age: 0.5, key: 'foyer-wiringcard', draw: (cg) => {
    cg.fillStyle = '#2a2430'; cg.textAlign = 'left'; cg.font = `600 26px ${FONTS.typed}`; cg.fillText('HOUSE BOARD.', 22, 42);
    cg.font = `19px ${FONTS.typed}`;
    ['Mr Crane\'s "economy" wiring:', 'every switch ALSO throws', 'its neighbours. For a full house:', 'trip it, then STALLS and', 'CIRCLE only.'].forEach((l, i) => cg.fillText(l, 22, 76 + i * 26));
    cg.font = `22px ${FONTS.hand}`; cg.fillText('— Wm. Sparks', 170, 214);
  } });
  const card = keep(mesh(new THREE.PlaneGeometry(0.15, 0.096), new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.9, side: THREE.DoubleSide }), { cast: false }));
  card.position.set(-W / 2 + 0.06, -H / 2 + 0.07, 0.07); card.rotation.set(-0.12, 0.05, 0.18); g.add(card);
  // conduit up the wall
  g.add(mergeInto([cylG(0.016, 0.016, 1.6, 10, -0.3, H / 2 + 0.8, 0.02), cylG(0.016, 0.016, 1.6, 10, 0.3, H / 2 + 0.8, 0.02), cylG(0.022, 0.022, 0.04, 10, -0.3, H / 2 + 0.04, 0.02), cylG(0.022, 0.022, 0.04, 10, 0.3, H / 2 + 0.04, 0.02)], M.iron({ color: '#3a3a36' })));
  let trip0 = 0, tripT = 0;
  const apply = (i) => { switches[i].rotation.z = -cur[i] * Math.PI / 2; jewels[i].material.userData.setLevel(cur[i]); };
  g.userData = {
    ...g.userData, switches, jewels, trip, card, labels,
    states,
    setSwitch(i, on, instant) { states[i] = on ? 1 : 0; if (instant) { cur[i] = states[i]; apply(i); } },
    setAll(arr, instant) { arr.forEach((v, i) => g.userData.setSwitch(i, v, instant)); },
    setTrip(t, instant) { tripT = t; if (instant) { trip0 = t; trip.rotation.z = -1.2 * t; } },
    update(dt) {
      for (let i = 0; i < 5; i++) if (Math.abs(cur[i] - states[i]) > 0.002) { cur[i] += (states[i] - cur[i]) * Math.min(1, dt * 14); apply(i); }
      if (Math.abs(trip0 - tripT) > 0.002) { trip0 += (tripT - trip0) * Math.min(1, dt * 10); trip.rotation.z = -1.2 * trip0; }
    },
  };
  xs.forEach((_, i) => apply(i));
  return g;
}

// ---- the ticket machine ----------------------------------------------------------------------------------
export const TICKET_WHEELS = [
  { id: 'area', title: 'AREA', labels: ['GALLERY', 'PIT', 'STALLS', 'CIRCLE', 'BOX'], w: 0.074 },
  { id: 'letter', title: 'ROW', labels: 'ABCDEFGHIJKLMNOP'.split(''), w: 0.042 },
  { id: 'price', title: 'PRICE', labels: ['6d', '1/-', '2/6', '3/6', '5/-', '10/6', '£1 1s', 'COMP'], w: 0.066 },
  { id: 'day', title: 'DAY', labels: Array.from({ length: 31 }, (_, i) => String(i + 1)), w: 0.046, r: 0.1 }, // POLISH: r — a larger drum, taller day figures
  { id: 'month', title: 'MONTH', labels: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], w: 0.056 },
];

/**
 * The ticket-issuing machine: a japanned cast-iron body, five drum wheels behind a brass window (AREA, ROW letter,
 * PRICE, DAY, MONTH), 1931 cast into the case, a big side handle, a ticket slot. Origin: base centre; faces +Z.
 * userData: { wheels[i] (Mesh), setWheel(i, index, instant), values (indices), up[i] / down[i] (hit proxies over the
 *   upper / lower half of each wheel), handle (Group), setHandle(t) (0 rest, 1 pulled), ticket (Group, two halves:
 *   ticket.userData.left / right), setTicket(t) (0 inside, 1 out), setTicketFields(fields), tear(t) (0 whole, 1 torn
 *   apart), wheelX(i) }.
 */
export function ticketMachine({ values = [2, 2, 3, 12, 2] } = {}) {
  const g = grp('ticketMachine');
  const BW = 0.5, BH = 0.34, BD = 0.3, wy = 0.2, wr = 0.065;
  // a satin japan (the shared gloss one blooms into hot streaks under the booth lamp)
  const jap = M.japanned().clone(); jap.roughness = 0.45; jap.clearcoat = 0.6; jap.clearcoatRoughness = 0.38;
  // base, body, rounded hood, gold lining as a texture plate
  g.add(mergeInto([boxG(BW + 0.06, 0.05, BD + 0.06, 0, 0.025, 0, 0.012), boxG(BW, BH - 0.08, BD, 0, 0.05 + (BH - 0.08) / 2, 0, 0.016), cylG(BD / 2, BD / 2, BW, 32, 0, 0, 0).rotateZ(Math.PI / 2).scale(1, 0.55, 1).translate(0, BH - 0.03, 0)], jap));
  // the front plate: gold-lined, window cut-outs drawn, titles
  const fc = makeCanvas(1024, 520), fg = fc.getContext('2d');
  fg.fillStyle = '#100c0a'; fg.fillRect(0, 0, 1024, 520);
  fg.strokeStyle = '#c9a24a'; fg.lineWidth = 6; fg.strokeRect(18, 18, 988, 484); fg.lineWidth = 2; fg.strokeRect(30, 30, 964, 460);
  fg.fillStyle = '#d8b860'; fg.textAlign = 'center'; fg.font = `32px ${FONTS.display}`; fg.fillText('THE EMPRESS', 512, 392);
  fg.font = `italic 19px ${FONTS.fell}`; fg.fillText('Automatic Ticket-Issuing Machine  ·  Patent', 512, 420);
  const plate = mesh(new THREE.PlaneGeometry(BW - 0.02, (BW - 0.02) * 520 / 1024), new THREE.MeshStandardMaterial({ map: canvasTexture(fc), roughness: 0.35, metalness: 0.2 }), { cast: false });
  plate.position.set(0, 0.05 + (BW - 0.02) * 260 / 1024 + 0.005, BD / 2 + 0.001); g.add(plate);
  // wheels in a row
  const gap = 0.012; let tot = TICKET_WHEELS.reduce((s, w) => s + w.w, 0) + gap * 5 + 0.05;
  let x = -tot / 2;
  const wheels = [], up = [], down = [], xsC = [], vals = values.slice(), cur = values.slice();
  const titles = [];
  const brass = M.brass({ roughness: 0.3 });
  const frame = [];
  TICKET_WHEELS.forEach((def, i) => {
    const cx = x + def.w / 2; xsC.push(cx);
    // square texels: one cell is the arc a label occupies, at the same px/m as the wheel's width (legible day numbers)
    // FIXED BY qa-foyer: the 31 day numbers were ~8 px tall at 1280x800 (a cell is only 13 mm of arc); fill more of it
    const fill = def.labels.length > 20 ? 0.9 : 0.62;
    // POLISH: a wheel may carry its own radius (the 31-day drum: at the shared 65 mm a day was a 13 mm cell, ~14 px in
    // the close-up); its front stays where the others' is, so it reads in the same window, the rest sits in the case
    const r = def.r ?? wr;
    const PXM = 9000, tex = wheelTexture(def.labels, { cell: Math.round(TAU * r / def.labels.length * PXM), width: Math.round(def.w * PXM), fill });
    tex.wrapS = THREE.RepeatWrapping;
    const geo = new THREE.CylinderGeometry(r, r, def.w, Math.max(32, def.labels.length * 4), 1, false).rotateZ(Math.PI / 2);
    const wm = keep(mesh(geo, [new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }), M.brass({ roughness: 0.35 }), M.brass({ roughness: 0.35 })], { cast: false }));
    // POLISH: a larger drum stands a little less proud, so it shows through the plate over about the others' height
    const prot0 = wr * 0.45 - 0.001, visH = Math.sqrt(wr * wr - (wr - prot0) ** 2), protR = r - Math.sqrt(r * r - visH * visH), prot = protR + (prot0 - protR) * 0.3;
    wm.position.set(cx, wy, BD / 2 + 0.001 + prot - r); g.add(wm); wheels.push(wm);
    // FIXED BY qa-foyer: the proxies stand in front of the drum's bulge (front at BD/2 + 0.45 wr); at BD/2 + 0.01 the
    // drum swallowed every click on the middle of the wheel (the label you read) and most of the lower half. Thin and
    // tangent to the drum's front so the up/down split falls on the label you read, not below it (the close-up looks down)
    const hz = BD / 2 + wr * 0.45 + 0.003;
    const u = hitBox(def.w, wr * 0.95, 0.004); u.position.set(cx, wy + wr * 0.5, hz); g.add(u); up.push(u);
    const d = hitBox(def.w, wr * 0.95, 0.004); d.position.set(cx, wy - wr * 0.5, hz); g.add(d); down.push(d);
    const tp = mesh(new THREE.PlaneGeometry(def.w + 0.01, 0.022), new THREE.MeshBasicMaterial({ map: labelPlate(def.title, { style: 'gilt', w: 256, h: 64 }), color: '#bbbbbb' }), { cast: false });
    tp.position.set(cx, wy + wr + 0.03, BD / 2 + 0.004); g.add(tp); titles.push(tp);
    // window bezel round each wheel
    frame.push(boxG(def.w + 0.012, 0.008, 0.012, cx, wy + wr * 0.62, BD / 2 + 0.004, 0.002), boxG(def.w + 0.012, 0.008, 0.012, cx, wy - wr * 0.62, BD / 2 + 0.004, 0.002));
    x += def.w + gap;
  });
  // the cast year, after the month wheel
  const yx = x + 0.025;
  const year = mesh(new THREE.PlaneGeometry(0.05, 0.03), new THREE.MeshStandardMaterial({ map: labelPlate('1931', { style: 'brass', w: 200, h: 120 }), metalness: 0.7, roughness: 0.35 }), { cast: false });
  year.position.set(yx, wy, BD / 2 + 0.006); g.add(year);
  frame.push(boxG(tot + 0.02, 0.012, 0.016, 0, wy + wr * 0.7, BD / 2 + 0.002, 0.003), boxG(tot + 0.02, 0.012, 0.016, 0, wy - wr * 0.7, BD / 2 + 0.002, 0.003));
  g.add(mergeInto(frame, brass));
  // the slot and the ticket
  g.add(mesh(boxG(0.16, 0.012, 0.03, 0, 0.085, BD / 2 + 0.005, 0.003), M.brass({ roughness: 0.3 })));
  g.add(mesh(new THREE.PlaneGeometry(0.13, 0.006).translate(0, 0.085, BD / 2 + 0.021), M.matte('#050404'), { cast: false }));
  const tc = makeCanvas(512, 220), tg = tc.getContext('2d'), ttex = canvasTexture(tc);
  const tmat = new THREE.MeshStandardMaterial({ map: ttex, roughness: 0.85, side: THREE.DoubleSide });
  const ticket = keep(grp('ticket')); ticket.position.set(0, 0.085, BD / 2 - 0.02); g.add(ticket);
  const TW = 0.12, TH = TW * 220 / 512;
  const half = (side) => {
    const p = grp('half'); p.position.x = side * 0.0;
    const geo = new THREE.PlaneGeometry(TW / 2, TH);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5 + (side > 0 ? 0.5 : 0));
    const m = mesh(geo, tmat, { cast: false }); m.position.x = side * TW / 4; p.add(m);
    return p;
  };
  const L = half(-1), R = half(1); ticket.add(L, R);
  ticket.rotation.x = -Math.PI / 2 + 0.25;
  ticket.visible = false;
  ticket.userData.left = L; ticket.userData.right = R;
  // the side handle
  const handle = keep(grp('sideHandle')); handle.position.set(BW / 2 + 0.02, 0.2, -0.02); g.add(handle);
  g.add(mesh(cylG(0.04, 0.04, 0.03, 20).rotateZ(Math.PI / 2).translate(BW / 2 + 0.01, 0.2, -0.02), brass));
  handle.add(mesh(mergeG([cylG(0.012, 0.012, 0.26, 10).translate(0, 0.13, 0).rotateZ(0), new THREE.SphereGeometry(0.03, 16, 12).translate(0, 0.27, 0)]).translate(0.02, 0, 0), M.ironBlack()));
  handle.add(mesh(new THREE.SphereGeometry(0.031, 16, 12).translate(0.02, 0.27, 0), M.bakelite('#5a1410')));
  const handleHit = hitBox(0.08, 0.32, 0.1); handleHit.position.set(0.02, 0.15, 0); handle.add(handleHit);
  let tOut = 0, torn = 0;
  const angle = (i, k) => TAU * (k + 0.5) / TICKET_WHEELS[i].labels.length;
  g.userData = {
    ...g.userData, wheels, up, down, handle, handleHit, ticket, values: vals, wheelX: (i) => xsC[i],
    setWheel(i, k, instant) { const n = TICKET_WHEELS[i].labels.length; vals[i] = ((k % n) + n) % n; if (instant) { cur[i] = vals[i]; wheels[i].rotation.x = angle(i, cur[i]); } },
    setHandle(t) { handle.rotation.x = -t * 1.1; },
    setTicket(t) { tOut = t; ticket.visible = t > 0.001; ticket.position.z = BD / 2 - 0.02 + t * 0.09; },
    setTicketFields(f) { drawTicket(tg, 512, 220, f); ttex.needsUpdate = true; },
    tear(t) { torn = t; L.rotation.z = t * 0.5; R.rotation.z = -t * 0.5; L.position.x = -t * 0.02; R.position.x = t * 0.02; },
    update(dt) {
      for (let i = 0; i < 5; i++) {
        const n = TICKET_WHEELS[i].labels.length, target = vals[i];
        let d = target - cur[i]; if (d > n / 2) d -= n; if (d < -n / 2) d += n;
        if (Math.abs(d) > 0.002) { cur[i] += d * Math.min(1, dt * 12); cur[i] = ((cur[i] % n) + n) % n; wheels[i].rotation.x = angle(i, cur[i]); }
      }
    },
  };
  values.forEach((v, i) => g.userData.setWheel(i, v, true));
  g.userData.setTicketFields({ area: 'STALLS', letter: 'C', price: '3/6', day: '13', month: 'MAR' });
  return g;
}

// ---- cloakroom lost property -----------------------------------------------------------------------------
/** A brass-bound tub crammed with furled umbrellas (instanced: ~40). Origin: floor centre. */
export function umbrellaTub({ count = 40, r = 0.26, seed = 7 } = {}) {
  const g = grp('umbrellaTub'), rr = rng(seed);
  g.add(mesh(latheG([[0, 0], [r, 0], [r + 0.02, 0.05], [r + 0.03, 0.42], [r + 0.04, 0.45], [r - 0.01, 0.45], [r - 0.01, 0.05], [0, 0.05]], 28), M.wood({ tint: '#4a2c1a' })));
  g.add(mergeInto([new THREE.TorusGeometry(r + 0.03, 0.008, 6, 32).rotateX(Math.PI / 2).translate(0, 0.08, 0), new THREE.TorusGeometry(r + 0.035, 0.008, 6, 32).rotateX(Math.PI / 2).translate(0, 0.38, 0)], M.tarnishedBrass({ amount: 0.6 })));
  // furled umbrella: canopy spindle + crook handle, origin at the tip
  const canopy = latheG([[0, 0], [0.004, 0.01], [0.022, 0.25], [0.03, 0.55], [0.018, 0.68], [0.008, 0.7], [0.007, 0.78], [0, 0.78]], 6);
  const crook = new THREE.TorusGeometry(0.035, 0.008, 4, 6, Math.PI).rotateZ(0).translate(0.035, 0.8, 0);
  const geo = mergeG([canopy, cylG(0.007, 0.007, 0.05, 6, 0, 0.78, 0), crook]);
  const list = [];
  const cols = ['#141210', '#1a1714', '#101012', '#2a1c14', '#1e2a22', '#3a1414', '#141418', '#4a3a2a'];
  for (let i = 0; i < count; i++) {
    const a = rr() * TAU, d = Math.sqrt(rr()) * (r - 0.05);
    list.push({ p: [Math.cos(a) * d, 0.04, Math.sin(a) * d], r: [(rr() - 0.5) * 0.35 + Math.sin(a) * d * 0.9, rr() * TAU, (rr() - 0.5) * 0.35 - Math.cos(a) * d * 0.9], s: [1, 0.85 + rr() * 0.3, 1], c: cols[Math.floor(rr() * cols.length)] });
  }
  g.add(instances(geo, new THREE.MeshStandardMaterial({ roughness: 0.75 }), list));
  return g;
}

/** One long ivory evening glove, lying flat (origin at the cuff; the fingers point along +X). */
export function eveningGlove() {
  const g = grp('glove');
  const mat = new THREE.MeshStandardMaterial({ color: '#b8ab94', roughness: 0.85 });
  const parts = [];
  parts.push(new THREE.CapsuleGeometry(0.03, 0.3, 4, 10).rotateZ(Math.PI / 2).scale(1, 1, 0.35).translate(0.15, 0, 0));
  parts.push(new THREE.CapsuleGeometry(0.036, 0.05, 4, 10).rotateZ(Math.PI / 2).scale(1, 1, 0.32).translate(0.36, 0, 0));
  [[-0.024, 0.075], [-0.008, 0.088], [0.008, 0.084], [0.024, 0.07]].forEach(([dy, len]) => parts.push(new THREE.CapsuleGeometry(0.008, len, 3, 6).rotateZ(Math.PI / 2 + dy * 2).scale(1, 1, 0.6).translate(0.4 + len / 2, dy * 1.2, 0)));
  parts.push(new THREE.CapsuleGeometry(0.009, 0.05, 3, 6).rotateZ(Math.PI / 2 - 0.8).scale(1, 1, 0.6).translate(0.36, 0.045, 0));
  const m = mesh(mergeG(parts), mat); m.rotation.x = -Math.PI / 2; m.position.y = 0.011;
  g.add(m);
  return g;
}

// ---- the street-door screen --------------------------------------------------------------------------------
/**
 * The glazed street entrance: a pair of locked glass doors with brass push-bars, glass sidelights, a transom and a
 * sunburst fanlight; rain on every pane; the wet night street beyond (a painted backdrop, a sodium halo).
 * Origin: floor centre of the opening; faces +Z (the foyer). Opening 3.2 m wide, 2.6 m + a 1.6 m half-round fanlight.
 * userData: { glass (Mesh[]), rainMat, backdrop, lampHalo, bus (Group: a lit night bus that drives past), driveBus() ,
 *   leaves (the two door leaves) }.
 */
export function streetScreen({ w = 3.2, h = 2.6 } = {}) {
  const g = grp('streetScreen');
  const R = w / 2, mah = M.mahogany(), brass = M.tarnishedBrass({ amount: 0.45 });
  const rainMat = rainGlassMaterial({ tint: '#8a9aa8', opacity: 0.32, speed: 0.22, density: 1.2 });
  const frame = [], bars = [], glass = [];
  // jambs, transom, mullions
  frame.push(boxG(0.14, h, 0.2, -R + 0.07, h / 2, 0, 0.01), boxG(0.14, h, 0.2, R - 0.07, h / 2, 0, 0.01), boxG(w, 0.16, 0.22, 0, h + 0.02, 0, 0.012));
  for (const sx of [-1, 1]) frame.push(boxG(0.1, h, 0.18, sx * 1.0, h / 2, 0, 0.008));
  // sidelights: a panel below, glass above
  for (const sx of [-1, 1]) {
    const cx = sx * 1.3;
    frame.push(boxG(0.5, 0.9, 0.06, cx, 0.45, 0, 0.01), boxG(0.52, 0.06, 0.12, cx, 0.92, 0, 0.008));
    const gm = mesh(new THREE.PlaneGeometry(0.5, h - 0.98), rainMat, { cast: false, receive: false }); gm.position.set(cx, 0.95 + (h - 0.98) / 2, 0); glass.push(gm);
  }
  // the fanlight: half-round frame, radiating bars, glass
  const arch = new THREE.Shape(); arch.absarc(0, 0, R, 0, Math.PI, false); arch.lineTo(-R + 0.12, 0); arch.absarc(0, 0, R - 0.12, Math.PI, 0, true); arch.closePath();
  frame.push(new THREE.ExtrudeGeometry(arch, { depth: 0.2, bevelEnabled: false, curveSegments: 32 }).translate(0, h + 0.1, -0.1));
  for (let i = 1; i < 8; i++) { const a = i / 8 * Math.PI; bars.push(boxG(0.025, R - 0.32, 0.04, 0, 0, 0, 0.002).translate(0, (R - 0.32) / 2 + 0.2, 0).rotateZ(a - Math.PI / 2).translate(0, h + 0.1, 0)); }
  bars.push(new THREE.TorusGeometry(0.2, 0.02, 6, 16, Math.PI).translate(0, h + 0.1, 0));
  const fan = new THREE.Shape(); fan.absarc(0, 0, R - 0.12, 0, Math.PI, false); fan.closePath();
  const fg = mesh(new THREE.ShapeGeometry(fan, 24).translate(0, h + 0.1, 0), rainMat, { cast: false, receive: false }); glass.push(fg);
  g.add(mergeInto(frame, mah));
  g.add(mergeInto(bars, brass));
  // the two door leaves (locked): stiles, rails, kick plates, push-bars, glass
  const leaves = [];
  for (const sx of [-1, 1]) {
    const L = grp('leaf'); L.position.set(sx * 0.5, 0, 0.02);
    L.add(mesh(mergeG([boxG(0.1, h - 0.04, 0.06, -0.42, h / 2, 0, 0.008), boxG(0.1, h - 0.04, 0.06, 0.42, h / 2, 0, 0.008), boxG(0.94, 0.28, 0.06, 0, 0.16, 0, 0.008), boxG(0.94, 0.12, 0.06, 0, h - 0.08, 0, 0.008), boxG(0.94, 0.08, 0.06, 0, 1.1, 0, 0.008)]), mah));
    L.add(mesh(mergeG([boxG(0.8, 0.2, 0.004, 0, 0.14, 0.033, 0.002), cylG(0.016, 0.016, 0.76, 12).rotateZ(Math.PI / 2).translate(0, 1.1, 0.1), cylG(0.012, 0.012, 0.08, 8).rotateX(Math.PI / 2).translate(-0.34, 1.1, 0.06), cylG(0.012, 0.012, 0.08, 8).rotateX(Math.PI / 2).translate(0.34, 1.1, 0.06), boxG(0.1, 0.05, 0.004, -0.34, 1.1, 0.033, 0.002), boxG(0.1, 0.05, 0.004, 0.34, 1.1, 0.033, 0.002)]), M.brass({ roughness: 0.28 })));
    const top = mesh(new THREE.PlaneGeometry(0.74, h - 1.3), rainMat, { cast: false, receive: false }); top.position.set(0, 1.14 + (h - 1.3) / 2, 0); L.add(top); glass.push(top);
    const low = mesh(new THREE.PlaneGeometry(0.74, 0.76), rainMat, { cast: false, receive: false }); low.position.set(0, 0.3 + 0.38, 0); L.add(low); glass.push(low);
    g.add(L); leaves.push(L);
  }
  // a bolt across the meeting stiles, and a padlocked hasp
  g.add(mesh(mergeG([boxG(0.2, 0.04, 0.03, 0, 1.55, 0.06, 0.004), boxG(0.06, 0.08, 0.03, 0, 1.55, 0.07, 0.004)]), M.ironBlack()));
  // the night beyond: a short wet porch, then the painted street
  const porch = grp('porch'); g.add(porch);
  porch.add(mesh(new THREE.PlaneGeometry(w + 1.2, 3.2).rotateX(-Math.PI / 2).translate(0, 0.002, -1.6), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.15, metalness: 0.1 }), { cast: false }));
  for (const sx of [-1, 1]) porch.add(mesh(new THREE.PlaneGeometry(3.2, 4.4).rotateY(sx * -Math.PI / 2).translate(sx * (R + 0.6), 2.2, -1.6), M.matte('#14100c'), { cast: false }));
  const backdrop = mesh(new THREE.PlaneGeometry(10, 6.25), new THREE.MeshBasicMaterial({ map: streetTexture(), color: '#a89a8a' }), { cast: false, receive: false });
  backdrop.position.set(0.8, 2.6, -3.3); porch.add(backdrop);
  const lampHalo = halo('#ffae50', 1.6, 0.55); lampHalo.position.set(0.8 + 10 * 0.18, 2.6 + 6.25 * (0.5 - 210 / 640), -3.2); porch.add(lampHalo);
  // the night bus: a long dark shape with a row of lit windows, driven past on demand
  const bus = keep(grp('bus')); bus.position.set(-9, 0, -3.0); porch.add(bus);
  const bc = makeCanvas(512, 128), bg2 = bc.getContext('2d');
  bg2.fillStyle = '#2a0a08'; bg2.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 7; i++) { bg2.fillStyle = '#ffd890'; bg2.fillRect(14 + i * 70, 20, 52, 40); bg2.fillStyle = '#c89050'; bg2.fillRect(14 + i * 70, 70, 52, 34); }
  bg2.fillStyle = '#ffe0a0'; bg2.font = `bold 20px ${FONTS.ui}`; bg2.fillText('27  PELHAM  ·  NIGHT', 150, 122);
  const busMesh = mesh(new THREE.PlaneGeometry(4.2, 1.05).translate(0, 1.6, 0), new THREE.MeshBasicMaterial({ map: canvasTexture(bc), color: '#c8a888', transparent: true, opacity: 0.85, depthWrite: false }), { cast: false, receive: false });
  bus.add(busMesh); bus.visible = false;
  let busT = -1;
  g.userData = {
    ...g.userData, glass, rainMat, backdrop, lampHalo, bus, leaves,
    driveBus() { busT = 0; bus.visible = true; },
    update(dt) {
      rainMat.userData.update(dt);
      if (busT >= 0) { busT += dt / 5.5; bus.position.x = -9 + busT * 18; if (busT >= 1) { busT = -1; bus.visible = false; } }
    },
  };
  glass.forEach((m) => { noRay(m); if (!m.parent) g.add(m); });
  return g;
}

// ---- the auditorium doors' chain and padlock ------------------------------------------------------------
/**
 * A heavy chain looped through two door handles, closed with a brass padlock. Origin: the padlock (hanging);
 * the handles are at (±gap/2, +0.12, 0). userData: { hanging (Group), heap (Group: the chain fallen on the floor,
 *   origin at floor level, -1.0 below the lock), lock (the padlock: a hit target), setFallen(on) }.
 */
export function chainAndPadlock({ gap = 0.24 } = {}) {
  const g = grp('chainPadlock');
  const link = new THREE.TorusGeometry(0.022, 0.0065, 4, 7).scale(1, 1.55, 1);
  const iron = M.iron({ color: '#3a3632', roughness: 0.5 });
  const hanging = grp('hanging'); g.add(hanging);
  // the loop: an oval through both handles and down to the lock
  const pts = [];
  for (let i = 0; i < 26; i++) { const a = i / 26 * TAU; pts.push([Math.cos(a) * (gap / 2 + 0.05), 0.12 + Math.sin(a) * 0.06 - (Math.sin(a) < 0 ? 0.08 * -Math.sin(a) : 0), 0.03 + Math.sin(a * 2) * 0.01]); }
  const list = pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; const a = Math.atan2(q[1] - p[1], q[0] - p[0]); return { p, r: [i % 2 ? Math.PI / 2 : 0, 0, a - Math.PI / 2] }; });
  // a tail down to the lock
  for (let i = 0; i < 4; i++) list.push({ p: [0.0, 0.03 - i * 0.03, 0.04], r: [i % 2 ? 0 : Math.PI / 2, 0.3, 0] });
  hanging.add(instances(link, iron, list));
  const lock = keep(grp('padlock')); lock.position.set(0, -0.1, 0.045); hanging.add(lock);
  lock.add(mesh(boxG(0.075, 0.08, 0.028, 0, -0.03, 0, 0.012), M.brass({ color: '#b08a3a', roughness: 0.3 })));
  lock.add(mesh(new THREE.TorusGeometry(0.026, 0.006, 8, 16, Math.PI).translate(0, 0.008, 0), M.iron({ color: '#8a8a84', roughness: 0.3 })));
  lock.add(mesh(cylG(0.006, 0.006, 0.004, 10).rotateX(Math.PI / 2).translate(0, -0.035, 0.015), M.matte('#0a0806')));
  const heap = grp('heap'); heap.visible = false; g.add(heap);
  const hr = rng(3), hl = [];
  for (let i = 0; i < 40; i++) { const a = hr() * TAU, d = hr() * 0.16; hl.push({ p: [Math.cos(a) * d, -1.0 + 0.01 + hr() * 0.03, Math.sin(a) * d * 0.6 + 0.1], r: [hr() * TAU, hr() * TAU, hr() * TAU] }); }
  heap.add(instances(link, iron, hl));
  const lock2 = lock.clone(); lock2.position.set(0.14, -0.97, 0.18); lock2.rotation.set(Math.PI / 2, 0, 0.6); heap.add(lock2);
  g.userData = { ...g.userData, hanging, heap, lock, setFallen(on) { hanging.visible = !on; heap.visible = !!on; } };
  return g;
}

// ---- the newel post ----------------------------------------------------------------------------------------
/** The bottom newel: a turned mahogany post on a plinth with a brass urn and a frosted globe lamp. userData.setLit. */
export function newelPost({ h = 1.25 } = {}) {
  const g = grp('newelPost');
  g.add(mesh(latheG([[0, 0], [0.13, 0], [0.13, 0.12], [0.1, 0.16], [0.09, 0.3], [0.11, 0.36], [0.07, 0.5], [0.075, h * 0.75], [0.1, h * 0.8], [0.1, h * 0.86], [0.13, h * 0.9], [0.13, h * 0.94], [0, h * 0.94]], 20), M.mahogany()));
  g.add(mesh(latheG([[0, h * 0.94], [0.06, h * 0.94], [0.08, h * 0.98], [0.05, h * 1.02], [0.03, h * 1.06], [0.045, h * 1.1], [0, h * 1.1]], 18), M.brass({ roughness: 0.3 })));
  const gm = glowGlass('#ffd8a0', { opacity: 0.95, intensity: 2.6, offColor: '#d8d0c0', roughness: 0.4 });
  g.add(mesh(new THREE.SphereGeometry(0.12, 24, 16).translate(0, h * 1.1 + 0.11, 0), gm, { cast: false }));
  g.userData.setLit = (k) => gm.userData.setLevel(k);
  g.userData.globe = new THREE.Vector3(0, h * 1.1 + 0.11, 0);
  return g;
}

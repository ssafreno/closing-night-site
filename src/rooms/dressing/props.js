// Dressing Room No. 1: room-specific props (SET-dressing). The shared catalogue's dressingTable / bulbMirror /
// gramophone are plain and generic; Lavinia's room gets its own ivory-and-gilt set built from the same helpers.
// Every builder returns a Group whose origin and facing are documented above it, and whose moving parts are named
// in userData. Nothing here knows about ctx; set.js wires tweens and hotspots.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as T from '../../engine/props/theatre.js';
import { mesh, noRay, grp, at, boxG, cylG, latheG, loftG, tubeG, mergeG, mergeInto, chase, TAU, instances } from '../../engine/props/theatre/common.js';
import { makeCanvas, canvasTexture, rng } from '../../engine/props/textures.js';

const { FONTS } = T;

export const PAL = {
  rose: '#c2928a', roseDeep: '#9c6a64', roseInk: '#ead0c2', cream: '#e8dcc0', creamDark: '#cbb994',
  ivory: '#eee4ce', peach: '#d9a083', peachDeep: '#b97a62', buff: '#e2c98f', tin: '#3d6448', lily: '#d6c29a',
  lilac: '#c9b4e6', ink: '#2a1c14', gilt: '#c9a24a',
};

// ---- small canvas helpers ---------------------------------------------------------------------------------------
function cv(w, h) { const c = makeCanvas(w, h); return [c, c.getContext('2d')]; }
function tex(c, o = {}) { const t = canvasTexture(c, o); return t; }
function noiseSpeckle(g, w, h, seed, n, col, a0, a1, s0 = 1, s1 = 3) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) { g.fillStyle = col; g.globalAlpha = a0 + r() * (a1 - a0); const s = s0 + r() * (s1 - s0); g.fillRect(r() * w, r() * h, s, s); }
  g.globalAlpha = 1;
}
function softBlot(g, x, y, rad, col, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0));
  g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
/** A cheap smooth 2D noise (value noise on a hashed lattice). */
export function noise2(seed = 1) {
  const h = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = sm(xf), v = sm(yf);
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
  };
}

/** One faded lily sprig in the wallpaper's ink. */
function drawLilySprig(g, x, y, s, ink, line, flip = 1) {
  g.save(); g.translate(x, y); g.scale(flip * s, s);
  g.strokeStyle = line; g.lineWidth = 2.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 60); g.bezierCurveTo(-6, 30, 6, 0, 0, -20); g.stroke();
  g.fillStyle = ink;
  for (const [lx, ly, a] of [[-4, 38, -0.9], [4, 22, 0.8], [-2, 50, -0.4]]) { g.save(); g.translate(lx, ly); g.rotate(a); g.beginPath(); g.ellipse(10, 0, 14, 3.6, 0, 0, TAU); g.fill(); g.restore(); }
  // the trumpet: three swept petals and a throat
  g.save(); g.translate(0, -20); g.rotate(-0.35);
  for (const [a, l] of [[-0.75, 26], [0, 30], [0.75, 26]]) {
    g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-7, -l * 0.5, -2, -l); g.quadraticCurveTo(4, -l * 0.95, 6, -l * 0.8); g.quadraticCurveTo(5, -l * 0.4, 0, 0); g.fill();
    g.strokeStyle = line; g.lineWidth = 0.8; g.stroke(); g.restore();
  }
  g.fillStyle = line; for (let k = -1; k <= 1; k++) { g.beginPath(); g.arc(k * 4, -30, 1.4, 0, TAU); g.fill(); }
  g.restore();
  // a bud
  g.save(); g.translate(0, -2); g.rotate(0.9); g.fillStyle = ink; g.beginPath(); g.ellipse(14, 0, 11, 3.4, 0, 0, TAU); g.fill(); g.restore();
  g.restore();
}

let _wallTex = null;
/** Dusty rose lily wallpaper: a 0.52 m repeat tile (stripes, half-drop lily sprigs, a dotted trellis). */
export function wallpaperTex() {
  if (_wallTex) return _wallTex;
  const S = 512, [c, g] = cv(S, S), r = rng(612);
  g.fillStyle = PAL.rose; g.fillRect(0, 0, S, S);
  // satin stripes: a broad slightly paler band and a fine ribbon of dots
  for (let i = 0; i < 4; i++) {
    const x = i * S / 4;
    g.fillStyle = 'rgba(244,214,204,0.16)'; g.fillRect(x + 6, 0, S / 8, S);
    g.fillStyle = 'rgba(120,70,64,0.12)'; g.fillRect(x + S / 8 + 10, 0, 2, S); g.fillRect(x + 2, 0, 2, S);
    g.fillStyle = 'rgba(236,208,194,0.5)'; for (let y = 4; y < S; y += 16) { g.beginPath(); g.arc(x + S / 8 + 30, y, 1.6, 0, TAU); g.fill(); }
  }
  // sprigs: half-drop on a 2x2 lattice
  const pts = [[S * 0.25, S * 0.3, 1], [S * 0.75, S * 0.8, -1], [S * 0.75, S * -0.2, -1], [S * 0.25, S * 1.3, 1]];
  for (const [x, y, f] of pts) drawLilySprig(g, x, y, 1.45, 'rgba(238,212,198,0.78)', 'rgba(150,96,88,0.55)', f);
  // tiny four-dot rosettes between
  g.fillStyle = 'rgba(238,212,198,0.55)';
  for (const [x, y] of [[S * 0.75, S * 0.3], [S * 0.25, S * 0.8], [0, S * 0.55], [S, S * 0.55], [S * 0.5, S * 0.05], [S * 0.5, S * 1.05]]) for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + Math.cos(k * TAU / 4) * 5, y + Math.sin(k * TAU / 4) * 5, 2.2, 0, TAU); g.fill(); }
  // paper grain + very light foxing (large-scale grime is done in vertex colours)
  noiseSpeckle(g, S, S, 3, 2600, '#5a3028', 0.02, 0.07, 1, 2);
  noiseSpeckle(g, S, S, 4, 900, '#fff0e6', 0.02, 0.06, 1, 2);
  for (let i = 0; i < 5; i++) softBlot(g, r() * S, r() * S, 10 + r() * 30, 'rgba(140,96,60,A)', 0.05);
  _wallTex = tex(c, { repeat: [1, 1] });
  return _wallTex;
}

let _rugTex = null;
/** A faded rose-and-cream Aubusson-ish rug, worn pale along the path from the door to the table. */
export function rugTex() {
  if (_rugTex) return _rugTex;
  const W = 768, H = 1024, [c, g] = cv(W, H), r = rng(77);
  g.fillStyle = '#b5847a'; g.fillRect(0, 0, W, H);
  const B = 70;
  g.fillStyle = '#5e3a34'; g.fillRect(0, 0, W, H); g.fillStyle = '#c9a07e'; g.fillRect(B * 0.35, B * 0.35, W - B * 0.7, H - B * 0.7);
  g.fillStyle = '#6a403a'; g.fillRect(B * 0.55, B * 0.55, W - B * 1.1, H - B * 1.1);
  g.fillStyle = '#b8857a'; g.fillRect(B, B, W - B * 2, H - B * 2);
  // border garland
  for (let i = 0; i < 40; i++) {
    const t = i / 40, per = 2 * (W + H), d = t * per;
    let x, y; if (d < W) { x = d; y = B * 0.77; } else if (d < W + H) { x = W - B * 0.77; y = d - W; } else if (d < 2 * W + H) { x = W - (d - W - H); y = H - B * 0.77; } else { x = B * 0.77; y = H - (d - 2 * W - H); }
    g.fillStyle = i % 2 ? '#e2c6a4' : '#9a5a50'; g.beginPath(); g.ellipse(x, y, 9, 6, i, 0, TAU); g.fill();
  }
  // medallion and corner sprays
  const cx = W / 2, cy = H / 2;
  g.fillStyle = '#e4cfb0'; g.beginPath(); g.ellipse(cx, cy, 170, 230, 0, 0, TAU); g.fill();
  g.fillStyle = '#b8857a'; g.beginPath(); g.ellipse(cx, cy, 150, 208, 0, 0, TAU); g.fill();
  g.fillStyle = '#d9b49a'; g.beginPath(); g.ellipse(cx, cy, 70, 96, 0, 0, TAU); g.fill();
  for (let k = 0; k < 12; k++) { const a = k * TAU / 12; g.fillStyle = k % 2 ? '#a0605a' : '#7a8a6a'; g.beginPath(); g.ellipse(cx + Math.cos(a) * 112, cy + Math.sin(a) * 150, 22, 10, a, 0, TAU); g.fill(); }
  for (const [x, y] of [[B * 2.2, B * 2.2], [W - B * 2.2, B * 2.2], [B * 2.2, H - B * 2.2], [W - B * 2.2, H - B * 2.2]]) for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? '#e2c6a4' : '#98584e'; g.beginPath(); g.ellipse(x + Math.cos(k) * 30, y + Math.sin(k * 1.3) * 30, 18, 8, k, 0, TAU); g.fill(); }
  // wear: a pale worn path, fading, and nap speckle
  const gr = g.createLinearGradient(W * 0.35, H, W * 0.5, 0);
  gr.addColorStop(0, 'rgba(236,214,190,0.45)'); gr.addColorStop(0.6, 'rgba(236,214,190,0.18)'); gr.addColorStop(1, 'rgba(236,214,190,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(W * 0.45, H * 0.7, W * 0.22, H * 0.4, -0.15, 0, TAU); g.fill();
  noiseSpeckle(g, W, H, 9, 9000, '#2a1410', 0.03, 0.1, 1, 3);
  noiseSpeckle(g, W, H, 10, 5000, '#f4e2d0', 0.03, 0.08, 1, 2);
  for (let i = 0; i < 4; i++) softBlot(g, r() * W, r() * H, 40 + r() * 90, 'rgba(70,40,30,A)', 0.12);
  _rugTex = tex(c);
  return _rugTex;
}

/** An oval enamel plaque with a pictogram: 'glove' | 'pearl' | 'feather' | 'lily'. */
export function plaqueTex(kind) {
  const W = 256, H = 176, [c, g] = cv(W, H);
  g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, W, H);
  g.fillStyle = '#b08a3a'; g.beginPath(); g.ellipse(W / 2, H / 2, W / 2 - 2, H / 2 - 2, 0, 0, TAU); g.fill();
  g.fillStyle = '#f6efe0'; g.beginPath(); g.ellipse(W / 2, H / 2, W / 2 - 14, H / 2 - 14, 0, 0, TAU); g.fill();
  g.strokeStyle = '#7a5a8a'; g.lineWidth = 2; g.beginPath(); g.ellipse(W / 2, H / 2, W / 2 - 22, H / 2 - 22, 0, 0, TAU); g.stroke();
  g.save(); g.translate(W / 2, H / 2); g.fillStyle = '#3a2a4a'; g.strokeStyle = '#3a2a4a'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'glove') {
    g.beginPath(); g.moveTo(-14, 44); g.lineTo(-18, 2); g.lineTo(-30, -14); g.quadraticCurveTo(-34, -22, -26, -22); g.lineTo(-14, -8);
    for (const [fx, top] of [[-12, -46], [-2, -52], [8, -48], [17, -38]]) { g.lineTo(fx - 4, top + 6); g.quadraticCurveTo(fx, top - 4, fx + 4, top + 6); }
    g.lineTo(20, 4); g.lineTo(16, 44); g.closePath(); g.fill();
    g.strokeStyle = '#f6efe0'; g.lineWidth = 2; for (const x of [-6, 4]) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x, 34); g.stroke(); }
  } else if (kind === 'pearl') {
    for (let i = 0; i < 15; i++) { const a = Math.PI * (0.05 + 0.9 * i / 14); g.beginPath(); g.arc(Math.cos(a) * 46, Math.sin(a) * 30 - 20, 6.5, 0, TAU); g.fill(); }
    g.beginPath(); g.arc(0, 26, 10, 0, TAU); g.fill();
  } else if (kind === 'feather') {
    g.beginPath(); g.moveTo(-34, 40); g.quadraticCurveTo(0, 0, 30, -46); g.stroke();
    for (let i = 0; i < 12; i++) { const t = i / 11, x = -34 + 64 * t, y = 40 - 86 * t + 10 * Math.sin(t * 3); g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 18 + t * 6, y - 8); g.moveTo(x, y); g.lineTo(x + 14, y + 12 - t * 6); g.stroke(); }
  } else {
    g.beginPath(); g.moveTo(0, 46); g.quadraticCurveTo(-4, 16, 0, -4); g.stroke();
    for (const a of [-0.8, 0, 0.8]) { g.save(); g.translate(0, -4); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-12, -24, -3, -46); g.quadraticCurveTo(8, -40, 9, -30); g.quadraticCurveTo(6, -14, 0, 0); g.fill(); g.restore(); }
    g.save(); g.translate(-2, 26); g.rotate(-0.9); g.beginPath(); g.ellipse(14, 0, 16, 4.5, 0, 0, TAU); g.fill(); g.restore();
  }
  g.restore();
  return tex(c);
}

/** The apron of the dressing table: ivory with a painted gilt ribbon swag, continuous across the hidden drawer. */
export function swagTex(w = 1.44) {
  const W = 1536, H = 112, [c, g] = cv(W, H);
  g.fillStyle = PAL.ivory; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#b08a3a'; g.lineWidth = 3; g.strokeRect(6, 6, W - 12, H - 12);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x0 = 30 + (W - 60) * i / n, x1 = 30 + (W - 60) * (i + 1) / n;
    g.strokeStyle = '#a8803a'; g.lineWidth = 7; g.beginPath(); g.moveTo(x0, 26); g.quadraticCurveTo((x0 + x1) / 2, 104, x1, 26); g.stroke();
    g.strokeStyle = '#e8cf86'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x0, 24); g.quadraticCurveTo((x0 + x1) / 2, 98, x1, 24); g.stroke();
    g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(x0, 24, 7, 0, TAU); g.fill();
    for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6, x = x0 + (x1 - x0) * t, y = 26 + 4 * t * (1 - t) * 74; g.fillStyle = k % 2 ? '#c87a78' : '#8aa070'; g.beginPath(); g.ellipse(x, y + 4, 6, 3.5, t * 3, 0, TAU); g.fill(); }
  }
  g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(W - 30, 24, 7, 0, TAU); g.fill();
  noiseSpeckle(g, W, H, 31, 2500, '#6a5030', 0.03, 0.12, 1, 2);
  const t = tex(c); t.userData = { widthM: w };
  return t;
}

/** Ivory paint with fine craquelure, for the furniture. */
let _ivoryMat = null;
export function ivoryMat() {
  if (_ivoryMat) return _ivoryMat;
  const S = 512, [c, g] = cv(S, S), r = rng(55);
  g.fillStyle = PAL.ivory; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(120,96,60,0.12)'; g.lineWidth = 1;
  for (let i = 0; i < 160; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  noiseSpeckle(g, S, S, 56, 3000, '#8a6a40', 0.03, 0.1, 1, 2);
  for (let i = 0; i < 6; i++) softBlot(g, r() * S, r() * S, 30 + r() * 60, 'rgba(150,120,70,A)', 0.08);
  const t = tex(c, { repeat: [2, 2] });
  _ivoryMat = new THREE.MeshPhysicalMaterial({ map: t, color: '#ffffff', roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.45 });
  return _ivoryMat;
}
export const giltMat = () => M.gilt({ pattern: 'moulding' });
export const creamPaint = () => M.enamel('#e4d6b8', { roughness: 0.5, metalness: 0 });

// =================================================================================================================
// THE REFLECTION: one wide painted canvas of the room behind the vantage, as seen in the glass (left to right: the
// door with her dressing gown; Dot's card above the back of the chair; wallpaper, a sconce, a playbill; the corner;
// the empty chaise with its dried lily; a screen). Lettering is the right way round: it is what the glass shows.
// =================================================================================================================
export const REFLECTION = { w: 2560, h: 640, slice: 640, stops: [-2, -1, 0, 1, 2], step: 480 };
/** Texture offset.x for swivel stop k (−2..2): the glass shows canvas x ∈ [off·W, off·W + 640]. */
export const stopOffset = (k) => ((k + 2) * REFLECTION.step) / REFLECTION.w;
/** Dot's card in canvas pixels (unrotated bounding box). */
export const CARD_RECT = { x0: 690, x1: 930, y0: 64, y1: 352 };

export function reflectionTex() {
  const { w: W, h: H } = REFLECTION, [c, g] = cv(W, H), r = rng(404);
  const wall = wallpaperTex().image;
  const pat = g.createPattern(wall, 'repeat');
  // ---- the back (south) wall, flat on to the glass: x 0..1520 ----
  pat.setTransform(new DOMMatrix().scale(0.62));
  g.fillStyle = pat; g.fillRect(0, 0, 1520, 348);
  // dado: cream panels under a rail
  const dado = (x0, x1) => {
    g.fillStyle = '#d9caa8'; g.fillRect(x0, 348, x1 - x0, H - 348);
    g.fillStyle = '#efe4c8'; g.fillRect(x0, 342, x1 - x0, 16); g.fillStyle = '#b8a47e'; g.fillRect(x0, 358, x1 - x0, 4);
    for (let x = x0 + 30; x < x1 - 120; x += 250) { g.strokeStyle = '#efe4c8'; g.lineWidth = 6; g.strokeRect(x, 400, 200, 260); g.strokeStyle = '#a8946e'; g.lineWidth = 2; g.strokeRect(x + 5, 405, 190, 250); }
  };
  dado(0, 1520);
  // ---- the door (far left) ----
  g.fillStyle = '#e8dcc0'; g.fillRect(14, 0, 540, H);
  g.fillStyle = '#c8b690'; g.fillRect(14, 0, 8, H); g.fillRect(546, 0, 8, H);
  const dg = g.createLinearGradient(50, 0, 520, 0); dg.addColorStop(0, '#2e1c12'); dg.addColorStop(0.5, '#4a2e1c'); dg.addColorStop(1, '#2a180e');
  g.fillStyle = dg; g.fillRect(52, 0, 466, H);
  g.strokeStyle = '#24140c'; g.lineWidth = 8;
  for (const [x, y, w, h] of [[84, -40, 180, 300], [306, -40, 180, 300], [84, 330, 180, 340], [306, 330, 180, 340]]) { g.strokeRect(x, y, w, h); g.strokeStyle = 'rgba(255,220,170,0.08)'; g.lineWidth = 3; g.strokeRect(x + 6, y + 6, w - 12, h - 12); g.strokeStyle = '#24140c'; g.lineWidth = 8; }
  // brass knob + escutcheon
  g.fillStyle = '#6a4a1a'; g.fillRect(468, 268, 22, 70);
  const kg = g.createRadialGradient(474, 296, 2, 479, 302, 22); kg.addColorStop(0, '#fff0b8'); kg.addColorStop(0.4, '#c9a24a'); kg.addColorStop(1, '#5a3a10');
  g.fillStyle = kg; g.beginPath(); g.arc(479, 302, 20, 0, TAU); g.fill();
  // the dressing gown on its hook: lilac silk, a shawl collar, a hanging sash
  g.fillStyle = '#c9a24a'; g.fillRect(244, 14, 26, 14);
  const gown = g.createLinearGradient(140, 0, 380, 0);
  gown.addColorStop(0, '#6e5a86'); gown.addColorStop(0.3, '#b8a2d4'); gown.addColorStop(0.55, '#d6c6ec'); gown.addColorStop(0.8, '#a28cc0'); gown.addColorStop(1, '#5e4a76');
  g.fillStyle = gown; g.beginPath(); g.moveTo(232, 22); g.bezierCurveTo(170, 60, 150, 200, 136, 330); g.bezierCurveTo(124, 430, 132, 520, 150, 560);
  g.lineTo(372, 566); g.bezierCurveTo(386, 500, 380, 400, 368, 300); g.bezierCurveTo(358, 180, 330, 60, 282, 22); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(60,40,80,0.35)'; g.lineWidth = 3;
  for (let i = 0; i < 9; i++) { const x = 160 + i * 24 + r() * 8; g.beginPath(); g.moveTo(240 + (x - 250) * 0.15, 60); g.bezierCurveTo(x - 10, 260, x + 6, 420, x - 4 + r() * 8, 560); g.stroke(); }
  g.strokeStyle = 'rgba(255,240,255,0.35)'; g.lineWidth = 4; for (let i = 0; i < 5; i++) { const x = 190 + i * 40; g.beginPath(); g.moveTo(x, 120); g.bezierCurveTo(x + 6, 260, x - 6, 420, x + 4, 540); g.stroke(); }
  g.fillStyle = '#8e78ac'; g.beginPath(); g.moveTo(232, 22); g.bezierCurveTo(210, 120, 236, 230, 256, 300); g.lineTo(268, 300); g.bezierCurveTo(262, 220, 270, 110, 282, 22); g.fill();
  g.fillStyle = '#7a6498'; g.fillRect(150, 318, 222, 22); // sash
  g.beginPath(); g.moveTo(330, 330); g.bezierCurveTo(338, 420, 326, 480, 340, 560); g.lineTo(356, 560); g.bezierCurveTo(344, 470, 352, 410, 346, 330); g.fill();
  // ---- Dot's card, pinned on the wallpaper, slightly askew ----
  g.save(); g.translate((CARD_RECT.x0 + CARD_RECT.x1) / 2, (CARD_RECT.y0 + CARD_RECT.y1) / 2); g.rotate(-0.035);
  const cw = CARD_RECT.x1 - CARD_RECT.x0 - 8, ch = CARD_RECT.y1 - CARD_RECT.y0 - 8;
  g.fillStyle = 'rgba(40,20,10,0.35)'; g.fillRect(-cw / 2 + 7, -ch / 2 + 9, cw, ch);
  const cg = g.createLinearGradient(0, -ch / 2, 0, ch / 2); cg.addColorStop(0, '#fbf5e6'); cg.addColorStop(1, '#efe4c8');
  g.fillStyle = cg; g.fillRect(-cw / 2, -ch / 2, cw, ch);
  g.strokeStyle = 'rgba(160,60,60,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-cw / 2 + 22, -ch / 2); g.lineTo(-cw / 2 + 22, ch / 2); g.stroke();
  g.strokeStyle = 'rgba(80,110,160,0.25)'; g.lineWidth = 1; for (let y = -ch / 2 + 74; y < ch / 2; y += 34) { g.beginPath(); g.moveTo(-cw / 2, y + 6); g.lineTo(cw / 2, y + 6); g.stroke(); }
  g.fillStyle = '#2a2230'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `600 22px ${FONTS.fell}`; g.fillText("MISS T.'S", 4, -ch / 2 + 30);
  g.font = `30px ${FONTS.display}`; g.fillText('BEGINNERS', 4, -ch / 2 + 62);
  g.textAlign = 'left'; g.font = `bold 29px ${FONTS.fell}`;
  ['1. GLOVES', '2. PEARLS', '3. FEATHERS', '4. A LILY'].forEach((s, i) => { g.save(); g.translate(-cw / 2 + 30, -ch / 2 + 104 + i * 34); g.rotate((i % 2 ? 1 : -1) * 0.012); g.fillText(s, 0, 0); g.restore(); });
  g.textAlign = 'right'; g.font = `italic 22px ${FONTS.fell}`; g.fillText("don't vary it!  — Dot", cw / 2 - 12, ch / 2 - 14);
  g.restore();
  const pg = g.createRadialGradient(808, 72, 1, 810, 74, 9); pg.addColorStop(0, '#fff2c0'); pg.addColorStop(1, '#7a5a1a');
  g.fillStyle = pg; g.beginPath(); g.arc(810, 74, 8, 0, TAU); g.fill();
  // ---- the back of her chair (bentwood), just below the card ----
  const hoop = (lw, col) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(640, H + 10); g.bezierCurveTo(630, 470, 660, 392, 800, 388); g.bezierCurveTo(940, 392, 980, 470, 970, H + 10); g.stroke(); };
  hoop(26, '#24140c'); hoop(8, 'rgba(255,210,160,0.35)');
  g.strokeStyle = '#2a180e'; g.lineWidth = 16; g.beginPath(); g.moveTo(690, H + 10); g.bezierCurveTo(690, 520, 720, 470, 805, 466); g.bezierCurveTo(890, 470, 920, 520, 920, H + 10); g.stroke();
  // ---- a sconce and a framed playbill ----
  g.fillStyle = '#8a6a2a'; g.beginPath(); g.ellipse(1130, 170, 18, 34, 0, 0, TAU); g.fill();
  g.strokeStyle = '#a8842e'; g.lineWidth = 7; g.beginPath(); g.moveTo(1130, 180); g.bezierCurveTo(1170, 186, 1170, 140, 1150, 120); g.stroke();
  const sh = g.createLinearGradient(1120, 60, 1180, 120); sh.addColorStop(0, '#f6eee0'); sh.addColorStop(1, '#cbbfa8');
  g.fillStyle = sh; g.beginPath(); g.moveTo(1122, 56); g.quadraticCurveTo(1150, 132, 1178, 56); g.quadraticCurveTo(1150, 70, 1122, 56); g.fill();
  g.fillStyle = '#9a7a34'; g.fillRect(1236, 34, 196, 286);
  g.fillStyle = '#e4d4ae'; g.fillRect(1250, 48, 168, 258);
  // POLISH: an ordinary playbill on the wall reads back to front in the glass (only Dot's card is written reversed)
  g.save(); g.translate(1334 * 2, 0); g.scale(-1, 1);
  g.fillStyle = '#5a1418'; g.textAlign = 'center';
  g.font = `14px ${FONTS.fell}`; g.fillText('EMPRESS THEATRE', 1334, 76);
  g.font = `26px ${FONTS.display}`; g.fillText('THE LAMP', 1334, 120); g.fillText('AT GULL', 1334, 150); g.fillText('POINT', 1334, 180);
  g.fillStyle = '#2a1c14'; g.font = `italic 15px ${FONTS.fell}`; g.fillText('with', 1334, 212); g.font = `17px ${FONTS.fell}`; g.fillText('Miss LAVINIA THRUSH', 1334, 236);
  g.restore();
  g.fillStyle = '#a3201c'; g.fillRect(1262, 260, 144, 3);
  // the corner
  const cs = g.createLinearGradient(1480, 0, 1560, 0); cs.addColorStop(0, 'rgba(40,20,14,0)'); cs.addColorStop(0.5, 'rgba(40,20,14,0.45)'); cs.addColorStop(1, 'rgba(40,20,14,0.1)');
  // ---- the side (east) wall, receding: x 1520..2560 ----
  g.save(); g.beginPath(); g.rect(1520, 0, W - 1520, H); g.clip();
  g.setTransform(1.15, 0.11, 0, 1, 1520, -168); // a skewed wall: lines run down to the right
  g.fillStyle = pat; pat.setTransform(new DOMMatrix().scale(0.7)); g.fillRect(0, 0, 1000, 520);
  g.fillStyle = '#d4c4a0'; g.fillRect(0, 508, 1000, 400); g.fillStyle = '#efe4c8'; g.fillRect(0, 502, 1000, 16); g.fillStyle = '#b8a47e'; g.fillRect(0, 518, 1000, 4);
  // an oval framed print on that wall
  g.fillStyle = '#9a7a34'; g.beginPath(); g.ellipse(250, 330, 70, 92, 0, 0, TAU); g.fill();
  g.fillStyle = '#d8c8a8'; g.beginPath(); g.ellipse(250, 330, 56, 78, 0, 0, TAU); g.fill();
  g.fillStyle = '#6a5040'; g.beginPath(); g.ellipse(250, 320, 22, 28, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(206, 400); g.quadraticCurveTo(250, 330, 294, 400); g.fill();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.restore();
  g.fillStyle = cs; g.fillRect(1480, 0, 80, H);
  // a folding screen with a kimono thrown over it (far right, behind the chaise)
  for (let i = 0; i < 3; i++) { const x = 2290 + i * 92; g.fillStyle = i % 2 ? '#3a2a22' : '#4a362a'; g.fillRect(x, 60, 88, 420); g.fillStyle = 'rgba(200,170,120,0.25)'; g.fillRect(x + 8, 70, 72, 400); }
  const kg2 = g.createLinearGradient(2300, 0, 2560, 0); kg2.addColorStop(0, '#2a3a5a'); kg2.addColorStop(0.5, '#4a5a86'); kg2.addColorStop(1, '#22304a');
  g.fillStyle = kg2; g.beginPath(); g.moveTo(2330, 56); g.lineTo(2540, 70); g.bezierCurveTo(2530, 200, 2560, 330, 2548, 420); g.lineTo(2380, 410); g.bezierCurveTo(2400, 300, 2350, 160, 2330, 56); g.fill();
  g.fillStyle = 'rgba(240,200,120,0.6)'; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(2360 + r() * 170, 100 + r() * 290, 4 + r() * 6, 0, TAU); g.fill(); }
  // ---- the chaise: rolled arm, the empty seat, the dried lily, a fringe ----
  const ch1 = g.createLinearGradient(0, 380, 0, H); ch1.addColorStop(0, '#f0bea0'); ch1.addColorStop(0.5, '#d49a7c'); ch1.addColorStop(1, '#9a6450');
  g.fillStyle = ch1;
  g.beginPath(); g.moveTo(1680, H); g.lineTo(1690, 470); g.bezierCurveTo(1680, 380, 1800, 360, 1830, 420); g.lineTo(1850, 470);
  g.lineTo(W, 520); g.lineTo(W, H); g.closePath(); g.fill();
  // the scroll of the arm
  g.fillStyle = '#e8b294'; g.beginPath(); g.ellipse(1752, 418, 66, 50, -0.2, 0, TAU); g.fill();
  g.strokeStyle = '#a06a52'; g.lineWidth = 6; g.beginPath(); g.arc(1752, 420, 34, 0.4, 5.6); g.stroke(); g.beginPath(); g.arc(1756, 422, 14, 0.4, 5.6); g.stroke();
  g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(1756, 422, 6, 0, TAU); g.fill();
  // the seat's top edge (a piped welt) and the buttoned back beyond
  g.strokeStyle = '#f6cfb6'; g.lineWidth = 4; g.beginPath(); g.moveTo(1850, 472); g.lineTo(W, 522); g.stroke();
  g.fillStyle = '#c88a70'; g.beginPath(); g.moveTo(1840, 470); g.lineTo(1880, 300); g.bezierCurveTo(2000, 270, 2200, 330, W, 370); g.lineTo(W, 520); g.closePath(); g.fill();
  g.fillStyle = '#9a5e4a'; for (let i = 0; i < 16; i++) { const x = 1920 + (i % 8) * 80 + (i >= 8 ? 40 : 0), y = 330 + (i >= 8 ? 70 : 0) + (x - 1900) * 0.06; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,230,210,0.25)'; g.beginPath(); g.moveTo(1880, 300); g.bezierCurveTo(2000, 270, 2200, 330, W, 370); g.lineTo(W, 380); g.bezierCurveTo(2200, 342, 2000, 284, 1882, 312); g.fill();
  // the dried lily lying on the seat
  g.strokeStyle = '#6a5a36'; g.lineWidth = 4; g.beginPath(); g.moveTo(2040, 500); g.quadraticCurveTo(2160, 480, 2260, 506); g.stroke();
  g.fillStyle = PAL.lily; for (const a of [-0.5, 0, 0.5]) { g.save(); g.translate(2032, 498); g.rotate(Math.PI + a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(14, -8, 44, -2); g.quadraticCurveTo(16, 8, 0, 0); g.fill(); g.restore(); }
  // valance fringe along the bottom
  g.fillStyle = '#b07858'; g.fillRect(1690, 560, W - 1690, 80);
  g.strokeStyle = '#d8a860'; g.lineWidth = 3; for (let x = 1694; x < W; x += 7) { g.beginPath(); g.moveTo(x, 560); g.lineTo(x + 2, 612 + r() * 10); g.stroke(); }
  // ---- light: warm from above (the mirror's own bulbs light the room), dark edges, a silvered greenish cast ----
  const lg = g.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, 'rgba(255,214,160,0.18)'); lg.addColorStop(0.6, 'rgba(255,214,160,0.04)'); lg.addColorStop(1, 'rgba(30,16,8,0.35)');
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = '#e8ecdc'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  noiseSpeckle(g, W, H, 405, 9000, '#20180f', 0.02, 0.07, 1, 3);
  const t = tex(c);
  t.wrapS = THREE.ClampToEdgeWrapping; t.repeat.set(REFLECTION.slice / W, 1); t.offset.set(stopOffset(0), 0);
  return t;
}

/** Desilvering at the glass edges, foxing spots, a fine haze (a transparent overlay; it does not slide). */
export function foxingTex() {
  const S = 512, [c, g] = cv(S, S), r = rng(808);
  g.clearRect(0, 0, S, S);
  const v = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75);
  v.addColorStop(0, 'rgba(40,34,28,0)'); v.addColorStop(1, 'rgba(40,34,28,0.55)'); g.fillStyle = v; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const edge = r() < 0.75, x = edge ? (r() < 0.5 ? r() * 60 : S - r() * 60) : r() * S, y = edge && r() < 0.5 ? r() * S : (r() < 0.5 ? r() * 70 : S - r() * 70);
    softBlot(g, x, y, 3 + r() * 16, 'rgba(70,58,40,A)', 0.25 + r() * 0.35);
  }
  for (let i = 0; i < 26; i++) softBlot(g, r() * S, r() * S, 2 + r() * 5, 'rgba(90,70,40,A)', 0.3);
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 30; g.beginPath(); g.moveTo(-40, S * 0.9); g.lineTo(S * 0.9, -40); g.stroke();
  return tex(c);
}

// =================================================================================================================
// THE ASH: Crane's telegram burned whole. A black curled sheet (still plainly a Post Office form), the strip-tape
// print as its own layer, and a glint layer (a soft band with a row of twelve bulb highlights) that slides with the
// slope's angle.
// =================================================================================================================
function ashOutline(r, W, H) {
  const pts = [], n = 64;
  for (let i = 0; i < n; i++) {
    const t = i / n; let x, y;
    if (t < 0.25) { x = t * 4 * W; y = 0; } else if (t < 0.5) { x = W; y = (t - 0.25) * 4 * H; } else if (t < 0.75) { x = W - (t - 0.5) * 4 * W; y = H; } else { x = 0; y = H - (t - 0.75) * 4 * H; }
    const nx = x < 1 ? 1 : x > W - 1 ? -1 : 0, ny = y < 1 ? 1 : y > H - 1 ? -1 : 0, d = 6 + r() * 16 + (t > 0.3 && t < 0.45 ? 26 * r() : 0);
    pts.push([x + nx * d, y + ny * d]);
  }
  return pts;
}
export function ashTex() {
  const W = 512, H = 352, [c, g] = cv(W, H), r = rng(31);
  g.clearRect(0, 0, W, H);
  const pts = ashOutline(r, W, H);
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  g.fillStyle = '#100d0b'; g.fill();
  g.save(); g.clip();
  noiseSpeckle(g, W, H, 32, 5000, '#2a2622', 0.2, 0.6, 1, 4);
  noiseSpeckle(g, W, H, 33, 900, '#5a5650', 0.1, 0.4, 1, 3);
  // the ghost of the form: header, a rule, the box (a touch glossier charcoal)
  g.fillStyle = '#211d1a'; g.textAlign = 'center'; g.font = `${W * 0.028}px ${FONTS.fell}`; g.fillText('POST OFFICE', W / 2, H * 0.08);
  g.font = `${W * 0.07}px ${FONTS.display}`; g.fillText('TELEGRAM', W / 2, H * 0.19);
  g.fillRect(W * 0.05, H * 0.23, W * 0.9, 2);
  g.strokeStyle = '#1e1a17'; g.lineWidth = 2; g.strokeRect(W * 0.05, H * 0.32, W * 0.9, H * 0.6);
  // grey-white ash at the edges, a few cracks
  g.lineWidth = 10; g.strokeStyle = 'rgba(150,146,138,0.45)'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) { let x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  g.restore();
  return tex(c);
}
/** The print that stays on the ash, as glossy grey strip-tape on black (transparent elsewhere). */
export function ashPrintTex() {
  const W = 1024, H = 704, [c, g] = cv(W, H), r = rng(37);
  g.clearRect(0, 0, W, H);
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(200,196,186,0.7)'; g.font = `24px ${FONTS.typed}`; g.textAlign = 'left';
  g.fillText('PELHAM STATION  6.40 PM   14 MAR 31', W * 0.08, H * 0.29);
  const strips = [['TO MISS THRUSH EMPRESS THEATRE PELHAM ST', 30], ['CANNOT PAY COMPANY STOP', 52], ['CANCEL TONIGHT STOP', 52], ['TAKINGS GONE WITH ME STOP', 52], ['SORRY OLD GIRL STOP CRANE', 52]];
  strips.forEach(([s, size], i) => {
    const y = H * (0.39 + i * 0.118);
    g.font = `${size}px ${FONTS.typed}`;
    const tw = g.measureText(s).width + 36;
    g.save(); g.translate(W * 0.07 + (r() - 0.5) * 8, y); g.rotate((r() - 0.5) * 0.014);
    g.fillStyle = 'rgba(120,116,108,0.28)'; g.fillRect(0, -size * 0.72, tw, size * 1.44);
    g.fillStyle = '#e4e0d6'; g.fillText(s, 18, 2);
    g.restore();
  });
  return tex(c);
}
// ADDED BY puzzles-dressing: coarse soft noise (an alpha map) that eats the print into flecks off the legible angle
function ashFleckTex() {
  const W = 128, H = 88, [c, g] = cv(W, H), r = rng(41), img = g.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { const v = Math.floor(r() * 256); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}
/** A soft highlight band with a row of twelve bulb glints (additive). The band sits at v = 0.5. */
export function ashGlintTex() {
  const W = 512, H = 512, [c, g] = cv(W, H);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const band = g.createLinearGradient(0, H * 0.3, 0, H * 0.7);
  band.addColorStop(0, 'rgba(0,0,0,1)'); band.addColorStop(0.5, 'rgba(96,78,54,1)'); band.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = band; g.fillRect(0, H * 0.3, W, H * 0.4);
  for (let i = 0; i < 12; i++) {
    const x = W * (0.06 + 0.88 * i / 11), y = H * 0.5 + Math.sin(i * 1.7) * 3;
    const gr = g.createRadialGradient(x, y, 0, x, y, 20); gr.addColorStop(0, 'rgba(200,180,150,1)'); gr.addColorStop(0.3, 'rgba(150,120,90,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(x - 20, y - 20, 40, 40);
  }
  g.globalCompositeOperation = 'source-over';
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// =================================================================================================================
// THE RECORD AND THE SPEED TESTER
// =================================================================================================================
export function recordTex() {
  const S = 512, [c, g] = cv(S, S), C = S / 2;
  g.fillStyle = '#0c0a0a'; g.beginPath(); g.arc(C, C, C, 0, TAU); g.fill();
  for (let rr = C * 0.36; rr < C - 3; rr += 1.6) { g.strokeStyle = `rgba(${40 + (rr * 7) % 18},${36 + (rr * 5) % 14},${34},0.9)`; g.lineWidth = 0.8; g.beginPath(); g.arc(C, C, rr, 0, TAU); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = C * 0.5;
  g.beginPath(); g.arc(C, C, C * 0.68, -0.5, 0.1); g.stroke(); g.beginPath(); g.arc(C, C, C * 0.68, 2.6, 3.2); g.stroke();
  g.strokeStyle = '#222'; g.lineWidth = 6; g.beginPath(); g.arc(C, C, C - 3, 0, TAU); g.stroke();
  return tex(c);
}
export function recordLabelTex() {
  const S = 512, [c, g] = cv(S, S), C = S / 2;
  const lg = g.createRadialGradient(C, C * 0.8, 10, C, C, C); lg.addColorStop(0, '#8e2228'); lg.addColorStop(1, '#5a1014');
  g.fillStyle = lg; g.beginPath(); g.arc(C, C, C, 0, TAU); g.fill();
  g.strokeStyle = '#d8b860'; g.lineWidth = 4; g.beginPath(); g.arc(C, C, C - 12, 0, TAU); g.stroke();
  g.fillStyle = '#e8cc78'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  // "HIS MASTER'S VOICE" around the top
  g.font = `bold 30px ${FONTS.fell}`;
  const arcText = (s, rad, a0, a1) => { const n = s.length; for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (i + 0.5) / n; g.save(); g.translate(C + Math.cos(a) * rad, C + Math.sin(a) * rad); g.rotate(a + Math.PI / 2); g.fillText(s[i], 0, 0); g.restore(); } };
  arcText("HIS MASTER'S VOICE", C - 40, -Math.PI * 0.86, -Math.PI * 0.14);
  g.font = `34px ${FONTS.display}`; g.fillText('"BURN, OLD LAMP"', C, C - 52);
  g.font = `italic 24px ${FONTS.fell}`; g.fillText('from The Lamp at Gull Point', C, C - 18);
  g.font = `24px ${FONTS.fell}`; g.fillText('sung by', C, C + 66);
  g.font = `bold 30px ${FONTS.fell}`; g.fillText('Miss Lavinia Thrush', C, C + 98);
  g.font = `bold 34px ${FONTS.fell}`; g.fillText('1912  —  78', C, C + 140);
  g.fillStyle = '#d8d0c0'; g.beginPath(); g.arc(C, C + 22, 9, 0, TAU); g.fill();
  return tex(c);
}
/** The tester card's paper: an annulus with the instruction printed round the outside band. Planar UVs on r1. */
export function testerCardTex(r0, r1) {
  const S = 1024, [c, g] = cv(S, S), C = S / 2, k = C / r1;
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#f2ead6'; g.beginPath(); g.arc(C, C, C, 0, TAU); g.arc(C, C, r0 * k, 0, TAU, true); g.fill();
  g.strokeStyle = '#1a1612'; g.lineWidth = 3; g.beginPath(); g.arc(C, C, C - 4, 0, TAU); g.stroke(); g.beginPath(); g.arc(C, C, 0.106 / r1 * C, 0, TAU); g.stroke();
  g.fillStyle = '#1a1612'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold 30px ${FONTS.fell}`;
  const s = 'HMV SPEED TESTER  ·  when the ring for your speed STANDS STILL, the speed is right  ·  ';
  const rad = (0.1125 / r1) * C, n = s.length;
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + TAU * i / n; g.save(); g.translate(C + Math.cos(a) * rad, C + Math.sin(a) * rad); g.rotate(a + Math.PI / 2); g.fillText(s[i], 0, 0); g.restore(); }
  noiseSpeckle(g, S, S, 71, 1800, '#7a6a4a', 0.03, 0.1, 1, 3);
  g.globalCompositeOperation = 'destination-in'; g.beginPath(); g.arc(C, C, C, 0, TAU); g.arc(C, C, r0 * k, 0, TAU, true); g.fill(); g.globalCompositeOperation = 'source-over';
  return tex(c);
}
/** One strobe ring: `bars` black bars between ra and rb (planar UVs over rb), its number in a gap. */
export function strobeRingTex(ra, rb, bars, label, bold = false) {
  const S = 512, [c, g] = cv(S, S), C = S / 2, k = C / rb, a0 = ra * k;
  g.clearRect(0, 0, S, S);
  const gap = 0.36; // radians left clear for the number
  g.fillStyle = '#14100c';
  for (let i = 0; i < bars; i++) {
    const a = gap / 2 + (TAU - gap) * i / bars, w = (TAU - gap) / bars * (bold ? 0.55 : 0.45);
    g.beginPath(); g.arc(C, C, C - 1, a, a + w); g.arc(C, C, a0 + 1, a + w, a, true); g.closePath(); g.fill();
  }
  if (bold) { g.strokeStyle = '#14100c'; g.lineWidth = 4; g.beginPath(); g.arc(C, C, C - 3, 0, TAU); g.stroke(); g.beginPath(); g.arc(C, C, a0 + 2, 0, TAU); g.stroke(); }
  // the number, upright at angle 0 (+X): drawn tangentially
  g.save(); g.translate(C + (C + a0) / 2, C); g.rotate(Math.PI / 2);
  g.font = `${bold ? 'bold ' : ''}${Math.round((C - a0) * 0.95)}px ${FONTS.fell}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, 0, 2); g.restore();
  return tex(c);
}

// =================================================================================================================
// THE SWING MIRROR. Origin: the table top at the centre of its turntable base; faces +Z (the room).
// A low yoke on a turntable carries the frame on two pivots 0.2 m above the table, 0.15 m above the frame's bottom
// edge, so face-down it lies forward over the table like a lid. Twelve bulbs, three a side. Two brass wing-nuts on
// the yoke turn it (swivel, five stops). Telegrams tucked in the frame face the glass's way.
// userData: { swivel, tilt, frame, glass, foxing, sheen, bulbs, wingL, wingR, wingLProxy, wingRProxy, telegrams,
//   setTiltDeg(deg: 0 upright … −80 face-down), setSwivel(k: −2..2, fractional ok), setSheen(0..1), setBulbs(0..1),
//   glassCentre() (world Vector3), STEP (rad per stop), PIVOT, FRAME }
// =================================================================================================================
export const MIRROR = { glass: 0.62, border: 0.11, pivot: 0.2, centre: 0.27, step: 0.12 };

function maker() {
  return T.agedPaperTexture({ w: 512, h: 320, seed: 23, age: 0.7, key: 'dressing:maker', draw: (g, W, H) => {
    g.fillStyle = '#3a2a1c'; g.textAlign = 'center';
    g.font = `26px ${FONTS.fell}`; g.fillText('ROSSITER & SONS', W / 2, H * 0.24);
    g.font = `46px ${FONTS.display}`; g.fillText('MIRROR MAKERS', W / 2, H * 0.47);
    g.font = `italic 24px ${FONTS.fell}`; g.fillText('Bevelled plate · Silvered on the premises', W / 2, H * 0.64);
    g.font = `22px ${FONTS.fell}`; g.fillText('14 CHAPEL ROW, PELHAM  ·  No. 1906', W / 2, H * 0.8);
    g.strokeStyle = '#3a2a1c'; g.lineWidth = 3; g.strokeRect(14, 14, W - 28, H - 28);
  } });
}
function sheenTex() {
  const [c, g] = cv(256, 256);
  const gr = g.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, '#3e4246'); gr.addColorStop(0.3, '#8a9096'); gr.addColorStop(0.42, '#4a4e52'); gr.addColorStop(0.6, '#a8aeb2'); gr.addColorStop(0.7, '#505458'); gr.addColorStop(1, '#2a2c2e');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return tex(c);
}
function rectRing(ow, oh, iw, ih) {
  const s = new THREE.Shape(); s.moveTo(-ow / 2, -oh / 2); s.lineTo(ow / 2, -oh / 2); s.lineTo(ow / 2, oh / 2); s.lineTo(-ow / 2, oh / 2); s.closePath();
  const h = new THREE.Path(); h.moveTo(-iw / 2, -ih / 2); h.lineTo(-iw / 2, ih / 2); h.lineTo(iw / 2, ih / 2); h.lineTo(iw / 2, -ih / 2); h.closePath();
  s.holes.push(h); return s;
}
function wingNut() {
  const g = grp('wingNut');
  const b = M.brass();
  g.add(mergeInto([
    cylG(0.012, 0.014, 0.018, 16).rotateZ(Math.PI / 2),
    new THREE.SphereGeometry(0.016, 12, 8).scale(0.35, 1.4, 0.75).translate(0.004, 0.024, 0),
    new THREE.SphereGeometry(0.016, 12, 8).scale(0.35, 1.4, 0.75).translate(0.004, -0.024, 0),
  ], b));
  return g;
}

export function swingMirror({ reflection, telegrams = {} } = {}) {
  const { glass: GW, border: B, pivot: PIV, centre: CY, step: STEP } = MIRROR, FW = GW + 2 * B;
  const g = grp('swingMirror');
  g.userData.keep = true;
  const ivory = ivoryMat(), gilt = giltMat();
  // turntable base (static)
  g.add(mesh(latheG([[0, 0], [0.14, 0], [0.145, 0.008], [0.13, 0.016], [0.1, 0.02], [0.095, 0.03], [0, 0.03]], 40), ivory));
  g.add(mesh(new THREE.TorusGeometry(0.142, 0.004, 6, 48).rotateX(Math.PI / 2).translate(0, 0.008, 0), gilt));
  const swivel = grp('swivel'); swivel.position.y = 0.03; g.add(swivel);
  // the yoke: a bar on the turntable and two short turned uprights to the pivots
  const ux = FW / 2 + 0.05;
  const yoke = [boxG(FW + 0.12, 0.03, 0.06, 0, 0.015, 0, 0.01)];
  for (const s of [-1, 1]) {
    yoke.push(latheG([[0, 0], [0.026, 0], [0.026, 0.02], [0.016, 0.035], [0.02, 0.06], [0.013, 0.09], [0.015, PIV - 0.05], [0.022, PIV - 0.04], [0.022, PIV - 0.01], [0, PIV - 0.01]], 16).translate(s * ux, 0.02, 0));
  }
  swivel.add(mergeInto(yoke, ivory));
  const yokeGilt = [];
  for (const s of [-1, 1]) yokeGilt.push(new THREE.TorusGeometry(0.02, 0.004, 6, 16).rotateX(Math.PI / 2).translate(s * ux, 0.08, 0), new THREE.SphereGeometry(0.014, 12, 8).translate(s * ux, PIV + 0.005, 0), cylG(0.008, 0.008, ux - FW / 2 + 0.01, 10).rotateZ(Math.PI / 2).translate(s * (FW / 2 + (ux - FW / 2) / 2), PIV - 0.03, 0));
  swivel.add(mergeInto(yokeGilt, gilt));
  // wing-nuts on the outside of the uprights at pivot height
  const wingL = wingNut(), wingR = wingNut();
  at(wingL, -ux - 0.03, PIV - 0.03, 0); at(wingR, ux + 0.03, PIV - 0.03, 0, 0, Math.PI, 0);
  swivel.add(wingL, wingR);
  const proxy = () => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.07), new THREE.MeshBasicMaterial({ visible: false })); p.userData.hitProxy = true; return p; };
  const wingLProxy = proxy(), wingRProxy = proxy();
  wingLProxy.position.copy(wingL.position); wingRProxy.position.copy(wingR.position);
  swivel.add(wingLProxy, wingRProxy);

  // the tilting frame
  const tilt = grp('tilt'); tilt.position.y = PIV - 0.03; swivel.add(tilt);
  const frame = grp('frame'); frame.position.y = CY; tilt.add(frame);
  const extrude = (shape, depth, bevel = 0.004) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  frame.add(mesh(extrude(rectRing(FW, FW, GW, GW), 0.034, 0.006).translate(0, 0, -0.016), ivory));
  // crest: a shell cartouche
  const cs = new THREE.Shape();
  cs.moveTo(-0.2, 0); cs.bezierCurveTo(-0.17, 0.05, -0.1, 0.05, -0.08, 0.08); cs.bezierCurveTo(-0.06, 0.13, -0.02, 0.15, 0, 0.16);
  cs.bezierCurveTo(0.02, 0.15, 0.06, 0.13, 0.08, 0.08); cs.bezierCurveTo(0.1, 0.05, 0.17, 0.05, 0.2, 0); cs.closePath();
  const crestHole = new THREE.Path(); crestHole.absellipse(0, 0.075, 0.035, 0.045, 0, TAU, true); cs.holes.push(crestHole);
  const giltParts = [
    extrude(rectRing(GW + 0.034, GW + 0.034, GW, GW), 0.008, 0.003).translate(0, 0, 0.022),
    extrude(rectRing(FW + 0.004, FW + 0.004, FW - 0.026, FW - 0.026), 0.006, 0.003).translate(0, 0, 0.022),
    extrude(cs, 0.018, 0.004).translate(0, FW / 2 - 0.012, -0.006),
  ];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) giltParts.push(cylG(0.02, 0.024, 0.01, 18).rotateX(Math.PI / 2).translate(sx * (GW / 2 + B / 2), sy * (GW / 2 + B / 2), 0.028));
  // the pivot bosses on the frame's sides
  for (const s of [-1, 1]) giltParts.push(cylG(0.02, 0.02, 0.03, 16).rotateZ(Math.PI / 2).translate(s * (FW / 2 + 0.012), -CY, 0));
  const giltMesh = mesh(mergeG(giltParts), gilt); frame.add(giltMesh);
  // sockets and bulbs: top L→R (0–2), right T→B (3–5), bottom R→L (6–8), left B→T (9–11)
  const o = GW / 2 + B / 2 - 0.004, q = GW * 0.33, pos = [];
  for (const x of [-q, 0, q]) pos.push([x, o]);
  for (const y of [q, 0, -q]) pos.push([o, y]);
  for (const x of [q, 0, -q]) pos.push([x, -o]);
  for (const y of [-q, 0, q]) pos.push([-o, y]);
  frame.add(mergeInto(pos.map(([x, y]) => latheG([[0, 0], [0.016, 0], [0.016, 0.01], [0.012, 0.016], [0, 0.016]], 14).rotateX(Math.PI / 2).translate(x, y, 0.026)), M.porcelain('#efe8da'), { cast: false }));
  const bulbs = T.bulbSet(pos.map(([x, y]) => [x, y, 0.06]), { r: 0.021, intensity: 3.2, lit: 0, offColor: '#8a8070', seg: 14 });
  frame.add(bulbs);
  // the glass, its foxing, and the silvery sheen it shows while it moves
  const glassMat = new THREE.MeshBasicMaterial({ map: reflection, color: new THREE.Color(0.86, 0.85, 0.82) });
  const glass = mesh(new THREE.PlaneGeometry(GW, GW), glassMat, { cast: false, receive: false });
  glass.position.z = 0.012; frame.add(glass);
  const foxing = noRay(mesh(new THREE.PlaneGeometry(GW, GW), new THREE.MeshBasicMaterial({ map: foxingTex(), transparent: true, depthWrite: false }), { cast: false, receive: false }));
  foxing.position.z = 0.0125; foxing.renderOrder = 1; frame.add(foxing);
  const sheenMat = new THREE.MeshBasicMaterial({ map: sheenTex(), transparent: true, opacity: 1, depthWrite: false });
  const sheen = noRay(mesh(new THREE.PlaneGeometry(GW, GW), sheenMat, { cast: false, receive: false }));
  sheen.position.z = 0.013; sheen.renderOrder = 2; frame.add(sheen);
  // the back: a mahogany board and the maker's label
  const back = mesh(new THREE.PlaneGeometry(FW - 0.02, FW - 0.02).rotateY(Math.PI), M.mahogany()); back.position.z = -0.0225; frame.add(back);
  const label = mesh(new THREE.PlaneGeometry(0.2, 0.125).rotateY(Math.PI), new THREE.MeshStandardMaterial({ map: maker(), roughness: 0.9 }), { cast: false }); label.position.set(0, 0.08, -0.0235); frame.add(label);
  // telegrams tucked into the frame (their faces toward the room when it stands)
  const tg = {};
  const tk = GW / 0.58, place = [['ada', -0.255 * tk, 0.255 * tk, 0.31], ['rupert', 0.27 * tk, 0.215 * tk, -0.24], ['birthday', 0.245 * tk, -0.262 * tk, -0.16]];
  for (const [id, x, y, rz] of place) {
    if (!telegrams[id]) continue;
    const m = T.telegram({ w: 0.15, ...telegrams[id] });
    m.position.set(x, y, 0.034); m.rotation.z = rz; m.castShadow = false;
    frame.add(m); tg[id] = m;
  }

  const wp = new THREE.Vector3();
  Object.assign(g.userData, {
    swivel, tilt, frame, glass, foxing, sheen, bulbs, wingL, wingR, wingLProxy, wingRProxy, telegrams: tg, STEP, PIVOT: PIV, FRAME: FW,
    tiltDeg: -80, stop: 0,
    setTiltDeg(deg) { g.userData.tiltDeg = deg; tilt.rotation.x = -deg * Math.PI / 180; },
    setSwivel(k) { g.userData.stop = k; swivel.rotation.y = k * STEP; reflection.offset.x = stopOffset(k); },
    setSheen(v) { sheenMat.opacity = v; sheen.visible = v > 0.003; },
    setBulbs(level) { bulbs.userData.setAll(level); },
    glassCentre() { glass.getWorldPosition(wp); return wp.clone(); },
  });
  g.userData.setTiltDeg(-80); g.userData.setSwivel(0);
  return g;
}

// =================================================================================================================
// THE DRESSING TABLE. Origin: floor centre; front faces +Z. W 1.5, D 0.52, top 0.76. Four plaque drawers in a row
// under the top, a flush apron below (its centre third is the hidden fifth drawer: no knob, the swag runs across it),
// four cabriole legs. userData: { topY, drawers[4] (Group, slides +Z: setDrawer(i, 0..1)), secret (Group: setSecret(0..1)),
// contents: { gloves, pearls, feather, lily }, pikeNote (Mesh), winder (Group), drawerTravel, secretTravel, W, D }
// =================================================================================================================
export const TABLE = { w: 1.5, d: 0.52, h: 0.76, drawerTravel: 0.2, secretTravel: 0.24 };
const DRAWER_KINDS = ['glove', 'pearl', 'feather', 'lily'];

function gloveShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.018, -0.16); s.lineTo(-0.02, 0.0); s.lineTo(-0.034, 0.03); s.quadraticCurveTo(-0.04, 0.042, -0.03, 0.044); s.lineTo(-0.018, 0.03);
  for (const [fx, top] of [[-0.016, 0.085], [-0.004, 0.095], [0.008, 0.09], [0.019, 0.075]]) { s.lineTo(fx - 0.004, top - 0.005); s.quadraticCurveTo(fx, top + 0.004, fx + 0.004, top - 0.005); }
  s.lineTo(0.024, 0.01); s.lineTo(0.02, -0.16); s.closePath();
  return s;
}
function drawerContents(kind) {
  const g = grp(kind);
  if (kind === 'glove') {
    const geo = new THREE.ExtrudeGeometry(gloveShape(), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
    const mat = new THREE.MeshStandardMaterial({ color: '#f3ebdc', roughness: 0.75 });
    g.add(at(mesh(geo, mat), -0.05, 0.004, 0.0, -Math.PI / 2, 0, 0.25), at(mesh(geo, mat), 0.03, 0.012, 0.01, -Math.PI / 2, 0, -0.18));
  } else if (kind === 'pearl') {
    const list = [];
    for (let i = 0; i < 46; i++) { const a = i / 46 * TAU; list.push({ p: [Math.cos(a) * 0.09 + 0.01 * Math.sin(a * 3), 0.006, Math.sin(a) * 0.055], s: 1 }); }
    g.add(instances(new THREE.SphereGeometry(0.0055, 10, 8), new THREE.MeshPhysicalMaterial({ color: '#f4efe6', roughness: 0.2, clearcoat: 1, sheen: 1, sheenColor: new THREE.Color('#ffd8e8') }), list, { cast: false }));
    g.add(at(mesh(new THREE.SphereGeometry(0.009, 12, 10), M.gold()), 0.1, 0.008, 0));
  } else if (kind === 'feather') {
    const wisps = [];
    for (let i = 0; i < 14; i++) { const a = -0.7 + i * 0.1, l = 0.14 + (i % 3) * 0.02; wisps.push(tubeG([[0, 0.008, 0], [Math.sin(a) * l * 0.5, 0.02, -Math.cos(a) * l * 0.5], [Math.sin(a) * l, 0.012, -Math.cos(a) * l]], 0.0016, { radial: 4, seg: 8 })); }
    wisps.push(tubeG([[0, 0.008, 0.06], [0, 0.008, 0]], 0.003, { radial: 5, seg: 2 }));
    g.add(mergeInto(wisps, new THREE.MeshStandardMaterial({ color: '#f6f2ea', roughness: 0.9 })));
    g.add(at(mesh(new THREE.SphereGeometry(0.011, 10, 8).scale(1, 0.6, 1), M.gold()), 0, 0.01, 0.02));
  } else {
    const white = new THREE.MeshStandardMaterial({ color: '#f2ece0', roughness: 0.7, side: THREE.DoubleSide });
    const petals = [];
    for (let k = 0; k < 6; k++) petals.push(latheG([[0.002, 0], [0.008, 0.02], [0.02, 0.05], [0.03, 0.065]], 3).scale(1, 1, 0.5).rotateY(k * TAU / 6));
    const flower = mesh(mergeG(petals), white); flower.rotation.set(0, 0, -Math.PI / 2); flower.position.set(0.07, 0.03, 0);
    g.add(flower, mesh(mergeG([tubeG([[-0.12, 0.008, 0.01], [0, 0.012, 0], [0.07, 0.03, 0]], 0.003, { radial: 5 })]), M.matte('#5a6a3a')));
  }
  return g;
}
function pikeNoteTex() {
  return T.agedPaperTexture({ w: 384, h: 512, seed: 61, age: 0.6, key: 'dressing:pikenote-out', fold: { v: 1, hz: 0 }, draw: (g, W, H) => {
    g.fillStyle = '#4a4a50'; g.font = `bold 64px ${FONTS.fell}`; g.textAlign = 'center'; g.fillText('L.', W * 0.5, H * 0.45);
    g.font = `22px ${FONTS.fell}`; g.fillText('— H.P.', W * 0.62, H * 0.62);
  } });
}
/** The gramophone's winding handle: a Z-cranked steel rod with a turned wooden grip. Origin: the socket end; along +X. */
export function winderHandle() {
  const g = grp('winder');
  g.add(mergeInto([cylG(0.005, 0.005, 0.11, 10).rotateZ(Math.PI / 2).translate(0.055, 0, 0), cylG(0.005, 0.005, 0.07, 10).translate(0.11, 0.035, 0), cylG(0.005, 0.005, 0.03, 10).rotateZ(Math.PI / 2).translate(0.125, 0.07, 0)], M.iron({ color: '#7a7670', roughness: 0.3 })));
  g.add(mesh(latheG([[0, 0], [0.011, 0], [0.013, 0.02], [0.011, 0.045], [0, 0.045]], 12).rotateZ(-Math.PI / 2).translate(0.14, 0.07, 0), M.walnut()));
  return g;
}

export function dressingTable() {
  const { w: W, d: D, h: H } = TABLE;
  const g = grp('dressingTable');
  const ivory = ivoryMat(), gilt = giltMat();
  const topT = 0.035, bandTop = H - topT, bandBot = 0.595, apronBot = 0.49;
  // carcass: top, ends, back, rails, dividers
  const carc = [
    boxG(W + 0.04, topT, D + 0.04, 0, H - topT / 2, 0.0, 0.008),
    boxG(0.03, bandTop - apronBot, D, -W / 2 + 0.015, (bandTop + apronBot) / 2, 0, 0.003),
    boxG(0.03, bandTop - apronBot, D, W / 2 - 0.015, (bandTop + apronBot) / 2, 0, 0.003),
    boxG(W, bandTop - apronBot, 0.015, 0, (bandTop + apronBot) / 2, -D / 2 + 0.0075, 0.002),
    boxG(W, 0.012, D - 0.02, 0, bandBot - 0.004, 0, 0.002), // shelf between band and apron
    boxG(W, 0.01, D - 0.02, 0, apronBot + 0.005, -0.04, 0.002), // apron floor (behind the secret drawer)
  ];
  const dw = (W - 0.06 - 0.06) / 4;
  const dx = (i) => -W / 2 + 0.03 + dw / 2 + i * (dw + 0.02);
  for (let i = 0; i < 3; i++) carc.push(boxG(0.02, bandTop - bandBot, D - 0.02, dx(i) + dw / 2 + 0.01, (bandTop + bandBot) / 2, 0, 0.002));
  // apron sides (the left and right thirds of the apron, fixed) – the swag texture is drawn on a separate face
  const secW = 0.62;
  carc.push(boxG((W - secW) / 2 - 0.03, (bandBot - apronBot) - 0.012, 0.02, -(secW / 2 + ((W - secW) / 2 - 0.03) / 2), (apronBot + bandBot - 0.012) / 2, D / 2 - 0.01, 0.002));
  carc.push(boxG((W - secW) / 2 - 0.03, (bandBot - apronBot) - 0.012, 0.02, (secW / 2 + ((W - secW) / 2 - 0.03) / 2), (apronBot + bandBot - 0.012) / 2, D / 2 - 0.01, 0.002));
  // cabriole legs
  const legs = [], toes = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W / 2 - 0.03), z = sz * (D / 2 - 0.03), ox = sx * 0.7071, oz = sz * 0.7071;
    legs.push(tubeG([[x, apronBot + 0.02, z], [x + ox * 0.03, 0.4, z + oz * 0.03], [x - ox * 0.005, 0.2, z - oz * 0.005], [x - ox * 0.012, 0.07, z - oz * 0.012], [x + ox * 0.012, 0.025, z + oz * 0.012]], 0.021, { radial: 10, seg: 24 }));
    legs.push(boxG(0.05, 0.08, 0.05, x, apronBot - 0.02, z, 0.008));
    toes.push(new THREE.SphereGeometry(0.026, 12, 8).scale(1, 0.7, 1).translate(x + ox * 0.014, 0.018, z + oz * 0.014));
    toes.push(new THREE.SphereGeometry(0.018, 10, 8).scale(1.3, 1, 0.5).rotateY(Math.atan2(ox, oz)).translate(x + ox * 0.03, 0.4, z + oz * 0.03));
  }
  g.add(mergeInto([...carc, ...legs], ivory));
  // gilt: the top's edge bead, the band's moulding, toes and knee shells
  const gl = [boxG(W + 0.05, 0.008, D + 0.05, 0, H - topT / 2, 0, 0.003), boxG(W + 0.005, 0.008, 0.012, 0, bandBot - 0.004, D / 2 + 0.001, 0.003), boxG(W + 0.005, 0.006, 0.01, 0, apronBot + 0.002, D / 2 + 0.001, 0.002), ...toes];
  g.add(mergeInto(gl, gilt));
  // apron face: the painted swag, as two fixed side pieces (the drawer front carries the middle third)
  const swag = swagTex(W - 0.06);
  const apronH = bandBot - apronBot - 0.014, apronY = (bandBot + apronBot) / 2 - 0.004;
  const sideW = (W - 0.06 - secW) / 2;
  const sideTex = (u0, u1) => { const t = swag.clone(); t.needsUpdate = true; t.repeat.set(u1 - u0, 1); t.offset.set(u0, 0); return t; };
  const uL = sideW / (W - 0.06), uR = 1 - uL;
  g.add(at(mesh(new THREE.PlaneGeometry(sideW, apronH), new THREE.MeshStandardMaterial({ map: sideTex(0, uL), roughness: 0.55 }), { cast: false }), -W / 2 + 0.03 + sideW / 2, apronY, D / 2 + 0.0005));
  g.add(at(mesh(new THREE.PlaneGeometry(sideW, apronH), new THREE.MeshStandardMaterial({ map: sideTex(uR, 1), roughness: 0.55 }), { cast: false }), W / 2 - 0.03 - sideW / 2, apronY, D / 2 + 0.0005));

  // the four drawers
  const liner = M.matte('#d9b7ae', { roughness: 0.9 }), box = M.wood({ tint: '#c4a07a', seed: 41, roughness: 0.7 });
  const drawers = [], contents = {};
  const fh = bandTop - bandBot - 0.012, fy = (bandTop + bandBot) / 2 - 0.002, dd = D - 0.06;
  for (let i = 0; i < 4; i++) {
    const dr = grp('drawer' + i); dr.position.set(dx(i), fy, 0); g.add(dr);
    dr.add(mesh(mergeG([boxG(dw - 0.004, fh, 0.02, 0, 0, D / 2 - 0.01, 0.003)]), ivory));
    dr.add(mergeInto([boxG(dw - 0.02, 0.006, dd, 0, -fh / 2 + 0.008, D / 2 - 0.02 - dd / 2, 0.001), boxG(0.008, fh - 0.03, dd, -dw / 2 + 0.014, -0.01, D / 2 - 0.02 - dd / 2, 0.001), boxG(0.008, fh - 0.03, dd, dw / 2 - 0.014, -0.01, D / 2 - 0.02 - dd / 2, 0.001), boxG(dw - 0.02, fh - 0.03, 0.008, 0, -0.01, D / 2 - 0.02 - dd, 0.001)], box, { cast: false }));
    dr.add(at(mesh(new THREE.PlaneGeometry(dw - 0.036, dd - 0.01).rotateX(-Math.PI / 2), liner, { cast: false }), 0, -fh / 2 + 0.0115, D / 2 - 0.02 - dd / 2));
    dr.add(mergeInto([boxG(dw - 0.012, 0.005, 0.004, 0, fh / 2 - 0.009, D / 2 + 0.001, 0.001), boxG(dw - 0.012, 0.005, 0.004, 0, -fh / 2 + 0.009, D / 2 + 0.001, 0.001), boxG(0.005, fh - 0.018, 0.004, -dw / 2 + 0.008, 0, D / 2 + 0.001, 0.001), boxG(0.005, fh - 0.018, 0.004, dw / 2 - 0.008, 0, D / 2 + 0.001, 0.001),
      new THREE.SphereGeometry(0.009, 12, 8).translate(-0.105, -0.005, D / 2 + 0.006), new THREE.SphereGeometry(0.009, 12, 8).translate(0.105, -0.005, D / 2 + 0.006)], gilt, { cast: false }));
    const plaque = mesh(new THREE.PlaneGeometry(0.1, 0.069), new THREE.MeshStandardMaterial({ map: plaqueTex(DRAWER_KINDS[i]), transparent: true, alphaTest: 0.5, roughness: 0.25, metalness: 0.1 }), { cast: false });
    plaque.position.set(0, 0.002, D / 2 + 0.0025); dr.add(plaque);
    const cont = drawerContents(DRAWER_KINDS[i]); cont.position.set(0, -fh / 2 + 0.012, D / 2 - 0.02 - dd * 0.42); dr.add(cont);
    contents[DRAWER_KINDS[i] === 'glove' ? 'gloves' : DRAWER_KINDS[i] === 'pearl' ? 'pearls' : DRAWER_KINDS[i]] = cont;
    dr.userData = { closedZ: 0, plaque, kind: DRAWER_KINDS[i], front: dr.children[0] };
    drawers.push(dr);
  }
  // the hidden fifth drawer: flush front carrying the middle third of the swag; no knob
  const secret = grp('secretDrawer'); secret.position.set(0, apronY, 0); g.add(secret);
  secret.add(at(mesh(new THREE.PlaneGeometry(secW - 0.004, apronH), new THREE.MeshStandardMaterial({ map: sideTex(uL, uR), roughness: 0.55 }), { cast: false }), 0, 0, D / 2 + 0.0006));
  secret.add(mesh(mergeG([boxG(secW - 0.004, apronH, 0.018, 0, 0, D / 2 - 0.009, 0.001)]), ivory));
  const sd = 0.34;
  secret.add(mergeInto([boxG(secW - 0.03, 0.006, sd, 0, -apronH / 2 + 0.006, D / 2 - 0.018 - sd / 2, 0.001), boxG(0.008, apronH - 0.02, sd, -secW / 2 + 0.02, -0.004, D / 2 - 0.018 - sd / 2, 0.001), boxG(0.008, apronH - 0.02, sd, secW / 2 - 0.02, -0.004, D / 2 - 0.018 - sd / 2, 0.001), boxG(secW - 0.03, apronH - 0.02, 0.008, 0, -0.004, D / 2 - 0.018 - sd, 0.001)], box, { cast: false }));
  secret.add(at(mesh(new THREE.PlaneGeometry(secW - 0.05, sd - 0.01).rotateX(-Math.PI / 2), liner, { cast: false }), 0, -apronH / 2 + 0.0095, D / 2 - 0.018 - sd / 2));
  const note = T.paperSheet({ w: 0.1, h: 0.14, texture: pikeNoteTex(), curl: 0.006, fold: 0.006, seed: 61 });
  note.rotation.set(-Math.PI / 2, 0, 0.25); note.position.set(-0.1, -apronH / 2 + 0.014, D / 2 - 0.13); note.castShadow = false;
  secret.add(note);
  const winder = winderHandle(); winder.position.set(0.04, -apronH / 2 + 0.02, D / 2 - 0.16); winder.rotation.set(Math.PI / 2, 0, 0.3);
  winder.rotation.set(-Math.PI / 2, 0, 0.35); winder.position.set(0.03, -apronH / 2 + 0.016, D / 2 - 0.2);
  secret.add(winder);

  Object.assign(g.userData, {
    topY: H, W, D, drawers, secret, contents, pikeNote: note, winder, drawerTravel: TABLE.drawerTravel, secretTravel: TABLE.secretTravel,
    setDrawer(i, t) { drawers[i].position.z = t * TABLE.drawerTravel; drawers[i].userData.inner.visible = t > 0.01; },
    setSecret(t) { secret.position.z = t * TABLE.secretTravel; secret.userData.inner.visible = t > 0.01; },
    drawerX: dx,
  });
  // only the moving parts are kept out of the room's static merge; their insides are hidden while shut
  for (const dr of [...drawers, secret]) {
    dr.userData.keep = true;
    const inner = grp('inner'); const keepFront = dr === secret ? 2 : 1;
    dr.children.slice(keepFront).filter((c) => c !== dr.userData.plaque && !(dr !== secret && c === dr.children[3])).forEach((c) => inner.add(c));
    dr.add(inner); dr.userData.inner = inner; inner.visible = false;
  }
  return g;
}

// =================================================================================================================
// THE WRITING SLOPE AND THE ASH. Slope origin: base centre on the table; front +Z. The board is hinged at its front
// edge; setAngle(deg 0..60) lifts its back, moves the brass stay and drives the ash's print and glint.
// =================================================================================================================
export const SLOPE = { w: 0.42, d: 0.3, baseH: 0.045 };
// POLISH: the accept band was 35-45° while the print already read at ~46° (a click there said "Unreadable"). The band
// is now 32-48°, the print is whole across it, and outside it the flecks thin out faster (see ashSheet.apply), so what
// reads is what is accepted; the fade starts lower (18°) so there is a cue to keep tilting.
export const printFor = (deg) => (deg <= 18 || deg >= 60 ? 0 : deg < 32 ? (deg - 18) / 14 : deg <= 48 ? 1 : (60 - deg) / 12);
export const legibleAt = (deg) => deg >= 32 && deg <= 48;

function leatherTex() {
  const W = 512, H = 384, [c, g] = cv(W, H);
  g.fillStyle = '#7a4a2c'; g.fillRect(0, 0, W, H);
  noiseSpeckle(g, W, H, 81, 6000, '#3a2010', 0.05, 0.18, 1, 3);
  noiseSpeckle(g, W, H, 82, 2000, '#c08a5a', 0.04, 0.12, 1, 2);
  g.strokeStyle = '#d8b060'; g.lineWidth = 3; g.strokeRect(14, 14, W - 28, H - 28); g.lineWidth = 1.2; g.strokeRect(22, 22, W - 44, H - 44);
  for (let x = 30; x < W - 30; x += 12) { g.fillStyle = '#c8a050'; g.beginPath(); g.arc(x, 18, 1.6, 0, TAU); g.fill(); g.beginPath(); g.arc(x, H - 18, 1.6, 0, TAU); g.fill(); }
  softBlot(g, W * 0.72, H * 0.3, 26, 'rgba(20,14,30,A)', 0.4);
  g.fillStyle = 'rgba(255,230,190,0.07)'; g.fillRect(40, 40, W - 80, H * 0.25);
  return tex(c);
}

export function ashSheet() {
  const g = grp('ash');
  const W = 0.2, H = W * 352 / 512;
  const geo = new THREE.PlaneGeometry(W, H, 20, 14), p = geo.attributes.position, rr = rng(5);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (W / 2), y = p.getY(i) / (H / 2);
    p.setZ(i, 0.01 * (x * x * x * x) + 0.006 * Math.max(0, -y) ** 3 + 0.0018 * Math.sin(x * 7 + y * 5) + 0.0008 * rr());
  }
  geo.computeVertexNormals(); geo.rotateX(-Math.PI / 2);
  const sheet = mesh(geo, new THREE.MeshPhysicalMaterial({ map: ashTex(), alphaTest: 0.45, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25, side: THREE.DoubleSide }), { cast: true });
  const printMat = new THREE.MeshBasicMaterial({ map: ashPrintTex(), alphaMap: ashFleckTex(), alphaTest: 0.001, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, color: new THREE.Color(0.95, 0.93, 0.88) });
  const print = noRay(mesh(geo, printMat, { cast: false, receive: false })); print.renderOrder = 3;
  const glintTex = ashGlintTex(); glintTex.repeat.set(1, 0.6);
  const glintMat = new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const glint = noRay(mesh(geo, glintMat, { cast: false, receive: false })); glint.renderOrder = 4;
  g.add(sheet, print, glint);
  let lit = 1, deg = 0;
  const apply = () => {
    // CHANGED BY puzzles-dressing: off the 35-45° band the print is broken flecks (an alpha-tested noise map lets
    // through more of it as the angle nears the band) and dimmer; inside the band it comes up whole. It used to read
    // cleanly at 29°, where clicking it says "unreadable", so the click and the eye disagreed.
    const f = printFor(deg), whole = legibleAt(deg);
    printMat.opacity = (whole ? 1 : 0.25 + 0.35 * f) * (0.25 + 0.75 * lit); // POLISH: thinner outside the band
    printMat.alphaTest = whole ? 0.001 : Math.max(0.001, printMat.opacity * (1 - 0.4 * f));
    printMat.visible = printMat.opacity > 0.004;
    // the band slides from the bottom edge (flat) up and off the top (steep); brightest in the legible band
    const k = THREE.MathUtils.clamp(deg / 60, 0, 1);
    glintTex.offset.y = 0.65 - 0.672 * k; // band centre runs from below the sheet (flat) to its middle (40°) and off the top (60°)
    glintMat.opacity = lit * (0.25 + 0.4 * Math.max(0.2, printFor(deg)));
    glint.visible = glintMat.opacity > 0.004;
  };
  Object.assign(g.userData, {
    sheet, print, glint, W, H,
    setAngle(d) { deg = d; apply(); },
    setLit(v) { lit = v; apply(); },
    printFor, legible: () => legibleAt(deg),
  });
  apply();
  return g;
}
/** The same ash, curled up in the basket. */
export function ashCurl() {
  const W = 0.2, H = W * 352 / 512;
  const geo = new THREE.PlaneGeometry(W, H, 18, 12), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), a = x / 0.07;
    p.setXYZ(i, Math.sin(a) * 0.07 * (1 - 0.15 * Math.abs(y) / H), y * 0.9, (1 - Math.cos(a)) * 0.07 + 0.006 * Math.sin(y * 60));
  }
  geo.computeVertexNormals();
  const m = mesh(geo, new THREE.MeshStandardMaterial({ map: ashTex(), alphaTest: 0.45, roughness: 0.4, side: THREE.DoubleSide }));
  m.name = 'ashCurl';
  return m;
}

export function writingSlope() {
  const { w: W, d: D, baseH } = SLOPE;
  const g = grp('writingSlope');
  g.userData.keep = true;
  const wal = M.walnut(), brass = M.brass();
  g.add(mergeInto([boxG(W, baseH, D, 0, baseH / 2, 0, 0.006)], wal));
  const corners = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) corners.push(boxG(0.03, baseH + 0.002, 0.03, sx * (W / 2 - 0.013), baseH / 2, sz * (D / 2 - 0.013), 0.003));
  g.add(mergeInto(corners, brass));
  const board = grp('board'); board.position.set(0, baseH, D / 2); g.add(board);
  board.add(mesh(mergeG([boxG(W, 0.014, D, 0, 0.007, -D / 2, 0.004)]), wal));
  board.add(at(mesh(new THREE.PlaneGeometry(W - 0.03, D - 0.03).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: leatherTex(), roughness: 0.55 }), { cast: false }), 0, 0.0145, -D / 2));
  board.add(mesh(mergeG([boxG(W - 0.02, 0.012, 0.008, 0, 0.02, -0.006, 0.002), cylG(0.006, 0.006, W, 10).rotateZ(Math.PI / 2).translate(0, 0.0, 0.0)]), brass));
  const mount = grp('ashMount'); mount.position.set(0, 0.016, -D / 2 + 0.005); board.add(mount);
  // the brass stay: from the base to the board's underside
  const stay = mesh(cylG(0.004, 0.004, 1, 8), brass, { cast: false }); g.add(stay);
  const A = new THREE.Vector3(W / 2 - 0.05, baseH, D / 2 - 0.22), Bl = new THREE.Vector3(W / 2 - 0.05, 0, -0.17), Bw = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  let deg = 0;
  const setAngle = (d) => {
    deg = THREE.MathUtils.clamp(d, 0, 60);
    board.rotation.x = deg * Math.PI / 180;
    board.updateMatrix(); Bw.copy(Bl).applyMatrix4(board.matrix);
    dir.subVectors(Bw, A); const len = Math.max(0.01, dir.length());
    stay.scale.set(1, len, 1); stay.position.copy(A).addScaledVector(dir, 0.5); stay.quaternion.setFromUnitVectors(up, dir.normalize());
    stay.visible = deg > 3;
    g.userData.onAngle?.(deg);
  };
  Object.assign(g.userData, { board, mount, stay, setAngle, angle: () => deg, MAX: 60 });
  setAngle(0);
  return g;
}

// =================================================================================================================
// THE WASTE-PAPER BASKET: painted tole tin, gilt bands, a painted rose. Origin: floor centre.
// userData: { ashSpot (Object3D where the curled ash sits), rim (y) }
// =================================================================================================================
function toleTex() {
  const W = 512, H = 256, [c, g] = cv(W, H);
  g.fillStyle = '#c9ab92'; g.fillRect(0, 0, W, H); // painted tin, once cream, now tea and smoke
  noiseSpeckle(g, W, H, 91, 3000, '#5a3e2a', 0.05, 0.16, 1, 3);
  const dirt = g.createLinearGradient(0, 0, 0, H); dirt.addColorStop(0, 'rgba(70,48,30,0.25)'); dirt.addColorStop(0.5, 'rgba(70,48,30,0)'); dirt.addColorStop(1, 'rgba(50,32,20,0.4)');
  g.fillStyle = dirt; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c9a24a'; g.fillRect(0, H * 0.06, W, 6); g.fillRect(0, H * 0.9, W, 5); g.fillRect(0, H * 0.82, W, 2);
  for (const x of [W * 0.25, W * 0.75]) {
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8; g.fillStyle = k % 2 ? '#c06a6a' : '#e8a8a0'; g.beginPath(); g.ellipse(x + Math.cos(a) * 12, H * 0.48 + Math.sin(a) * 12, 13, 8, a, 0, TAU); g.fill(); }
    g.fillStyle = '#f0c8b8'; g.beginPath(); g.arc(x, H * 0.48, 8, 0, TAU); g.fill();
    g.fillStyle = '#6a8a4a'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * 34, H * 0.52, 16, 6, s * 0.4, 0, TAU); g.fill(); }
  }
  // scuffs through to bare tin
  g.fillStyle = 'rgba(90,86,80,0.45)'; const r = rng(92); for (let i = 0; i < 40; i++) g.fillRect(r() * W, H * (0.85 + r() * 0.15), 2 + r() * 10, 1 + r() * 2);
  return tex(c);
}
export function wasteBasket() {
  const g = grp('wasteBasket');
  g.userData.keep = true;
  const prof = [[0.001, 0.004], [0.11, 0.004], [0.112, 0.012], [0.14, 0.27], [0.146, 0.28], [0.141, 0.283], [0.135, 0.272], [0.107, 0.016], [0.001, 0.016]];
  const mat = new THREE.MeshStandardMaterial({ map: toleTex(), roughness: 0.45, metalness: 0.15 });
  g.add(mesh(latheG(prof, 40), mat));
  g.add(mesh(new THREE.TorusGeometry(0.144, 0.005, 6, 48).rotateX(Math.PI / 2).translate(0, 0.281, 0), M.gold()));
  const paper = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.95, flatShading: true });
  const balls = [];
  const r = rng(93);
  for (const [x, y, z, s] of [[-0.04, 0.07, 0.02, 0.055], [0.05, 0.08, -0.03, 0.05], [0.0, 0.13, 0.05, 0.045]]) {
    const b = new THREE.IcosahedronGeometry(s, 1), bp = b.attributes.position;
    for (let i = 0; i < bp.count; i++) { const k = 0.75 + r() * 0.4; bp.setXYZ(i, bp.getX(i) * k, bp.getY(i) * k, bp.getZ(i) * k); }
    b.computeVertexNormals(); balls.push(b.translate(x, y, z));
  }
  g.add(mergeInto(balls, paper));
  const ashSpot = grp('ashSpot'); ashSpot.position.set(0, 0.17, 0); ashSpot.rotation.set(0.5, 0.4, 0.15); g.add(ashSpot);
  g.userData.ashSpot = ashSpot; g.userData.rim = 0.28;
  return g;
}

// =================================================================================================================
// THE CHAISE LONGUE: faded peach velvet, a scrolled head (local −X), a low rolled foot, a buttoned back that sweeps
// down from the head, a bolster, a pleated valance to the floor with a bullion fringe, a shawl, one dried lily.
// Origin: floor centre; front faces +Z. userData: { seatY, perch (local Vector3 at the seat's front edge, head end),
// underProxy (Mesh), jewelSpot (local Vector3 on the floor at the valance), shawl, lily, valance }
// =================================================================================================================
export const CHAISE = { len: 1.84, depth: 0.66, seatY: 0.5 };
function tuftTex(color) {
  const S = 512, [c, g] = cv(S, S);
  const base = new THREE.Color(color);
  g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, S, S);
  noiseSpeckle(g, S, S, 101, 6000, '#ffffff', 0.02, 0.06, 1, 2);
  noiseSpeckle(g, S, S, 102, 6000, '#3a1a10', 0.03, 0.08, 1, 2);
  const step = S / 4;
  for (let i = -1; i <= 5; i++) for (let j = -1; j <= 5; j++) {
    const x = i * step + (j % 2 ? step / 2 : 0), y = j * step / 2 * 1.0;
    const gr = g.createRadialGradient(x, y, 2, x, y, step * 0.6); gr.addColorStop(0, 'rgba(60,24,14,0.4)'); gr.addColorStop(0.25, 'rgba(60,24,14,0.12)'); gr.addColorStop(0.7, 'rgba(255,230,210,0.08)'); gr.addColorStop(1, 'rgba(255,230,210,0)');
    g.fillStyle = gr; g.fillRect(x - step, y - step, step * 2, step * 2);
    g.strokeStyle = 'rgba(70,30,20,0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + step / 2, y + step / 2); g.moveTo(x, y); g.lineTo(x - step / 2, y + step / 2); g.stroke();
  }
  return tex(c, { repeat: [1, 1] });
}
function paisleyTex() {
  const S = 512, [c, g] = cv(S, S), r = rng(111);
  g.fillStyle = '#e6d6be'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) {
    const x = r() * S, y = r() * S, s = 18 + r() * 26, a = r() * TAU;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = ['#a8504a', '#4a6a6a', '#c88a4a', '#7a4a6a'][i % 4];
    g.beginPath(); g.moveTo(0, -s); g.bezierCurveTo(s * 0.9, -s * 0.6, s * 0.7, s * 0.8, 0, s * 0.6); g.bezierCurveTo(-s * 0.5, s * 0.4, -s * 0.4, -s * 0.2, 0, -s); g.fill();
    g.fillStyle = '#e6d6be'; g.beginPath(); g.ellipse(s * 0.15, s * 0.1, s * 0.25, s * 0.35, 0, 0, TAU); g.fill();
    g.fillStyle = '#a8504a'; g.beginPath(); g.arc(s * 0.15, s * 0.1, s * 0.1, 0, TAU); g.fill();
    g.restore();
  }
  g.fillStyle = '#8a3a34'; g.fillRect(0, 0, S, 16); g.fillRect(0, S - 16, S, 16);
  g.fillStyle = '#c9a24a'; g.fillRect(0, 18, S, 4); g.fillRect(0, S - 22, S, 4);
  noiseSpeckle(g, S, S, 112, 4000, '#3a2010', 0.03, 0.08, 1, 2);
  return tex(c, { repeat: [1.4, 1.4] });
}
function fringeTex(col = '#d8a868') {
  const W = 512, H = 64, [c, g] = cv(W, H), r = rng(121);
  g.clearRect(0, 0, W, H);
  g.fillStyle = col; g.fillRect(0, 0, W, 10);
  for (let x = 0; x < W; x += 3) { g.strokeStyle = r() < 0.5 ? col : '#b08048'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 8); g.lineTo(x + (r() - 0.5) * 2, H - 2 - r() * 10); g.stroke(); }
  return tex(c, { repeat: [8, 1] });
}
/** A strip of pleated cloth along a polyline (x,z points), from y0 to y1, pleats `period` m, depth `amp` m. */
function pleatStrip(path, y0, y1, period = 0.07, amp = 0.012) {
  const pos = [], uv = [], idx = []; let s = 0;
  const pts = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.ceil(L / (period / 6)));
    for (let k = 0; k < n; k++) { const t = k / n; pts.push([ax + (bx - ax) * t, az + (bz - az) * t, -(bz - az) / L, (bx - ax) / L, s + L * t]); }
    s += L;
  }
  const [lx, lz] = path[path.length - 1]; const [px, pz] = path[path.length - 2]; const L2 = Math.hypot(lx - px, lz - pz);
  pts.push([lx, lz, -(lz - pz) / L2, (lx - px) / L2, s]);
  pts.forEach(([x, z, nx, nz, d], i) => {
    const off = amp * Math.sin(d / period * TAU);
    for (const [y, v] of [[y1, 0], [y0, 1]]) { const flare = v ? 1.25 : 0.6; pos.push(x - nx * off * flare, y, z - nz * off * flare); uv.push(d / 0.5, v); }
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
/** A dried lily stem (parchment petals). Origin: the cut end; lies along +X. */
export function driedLily(color = PAL.lily) {
  const g = grp('driedLily');
  const petals = [];
  for (let k = 0; k < 6; k++) petals.push(latheG([[0.002, 0], [0.007, 0.018], [0.016, 0.042], [0.024, 0.058], [0.02, 0.064]], 3).scale(1, 1, 0.45).rotateY(k * TAU / 6 + 0.2));
  const fl = mesh(mergeG(petals), new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide }));
  fl.rotation.z = -Math.PI / 2 + 0.25; fl.position.set(0.24, 0.012, 0);
  g.add(fl, mesh(mergeG([tubeG([[0, 0.004, 0], [0.12, 0.008, 0.01], [0.24, 0.012, 0]], 0.0028, { radial: 5 }), new THREE.PlaneGeometry(0.02, 0.09).rotateX(-Math.PI / 2).rotateY(0.6).translate(0.1, 0.006, 0.02)]), M.matte('#6a5a36', { roughness: 0.9 })));
  return g;
}

export function chaise() {
  const { len: Lc, depth: Dc, seatY } = CHAISE;
  const g = grp('chaise');
  const vel = M.velvetRed({ color: PAL.peach, wear: 0.45, repeat: [2, 2] });
  const velDeep = M.velvetRed({ color: PAL.peachDeep, wear: 0.4, repeat: [3, 1] });
  const gilt = giltMat();
  const hx = -Lc / 2, fx = Lc / 2, fz = Dc / 2;
  // platform and cushion
  g.add(mesh(mergeG([boxG(Lc - 0.02, 0.1, Dc, 0, 0.38, 0, 0.02), boxG(Lc - 0.12, 0.075, Dc - 0.04, 0.02, seatY - 0.035, 0.01, 0.03)]), vel));
  // the scrolled head and the rolled foot, extruded across the depth
  const ext = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 14 });
  const head = new THREE.Shape();
  head.moveTo(hx + 0.12, 0.33); head.lineTo(hx + 0.12, 0.62); head.bezierCurveTo(hx + 0.1, 0.8, hx + 0.02, 0.9, hx - 0.06, 0.88);
  head.bezierCurveTo(hx - 0.14, 0.86, hx - 0.15, 0.76, hx - 0.08, 0.73); head.bezierCurveTo(hx - 0.04, 0.72, hx - 0.02, 0.62, hx + 0.0, 0.5); head.lineTo(hx + 0.0, 0.33); head.closePath();
  const foot = new THREE.Shape();
  foot.moveTo(fx - 0.1, 0.33); foot.lineTo(fx - 0.1, 0.52); foot.bezierCurveTo(fx - 0.1, 0.6, fx - 0.04, 0.64, fx + 0.02, 0.62);
  foot.bezierCurveTo(fx + 0.07, 0.6, fx + 0.07, 0.54, fx + 0.03, 0.52); foot.lineTo(fx, 0.33); foot.closePath();
  g.add(mesh(mergeG([ext(head, Dc - 0.03).translate(0, 0, -Dc / 2 + 0.015), ext(foot, Dc - 0.03).translate(0, 0, -Dc / 2 + 0.015)]), vel));
  // the back: high at the head, sweeping down to the seat a third of the way along
  const back = new THREE.Shape();
  back.moveTo(hx + 0.05, 0.42); back.lineTo(hx + 0.05, 0.92); back.bezierCurveTo(hx + 0.4, 0.95, hx + 0.7, 0.86, hx + 1.0, 0.7);
  back.bezierCurveTo(hx + 1.15, 0.62, hx + 1.22, 0.55, hx + 1.3, 0.47); back.lineTo(hx + 1.3, 0.42); back.closePath();
  const tuftMat = new THREE.MeshPhysicalMaterial({ map: tuftTex(PAL.peach), roughness: 0.9, sheen: 0.7, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffc8b0') });
  const bgeo = ext(back, 0.1);
  // planar UVs in metres on the front face so the tufting stays square
  const bp = bgeo.attributes.position, buv = bgeo.attributes.uv;
  for (let i = 0; i < bp.count; i++) buv.setXY(i, bp.getX(i) / 0.36, bp.getY(i) / 0.36);
  g.add(at(mesh(bgeo, tuftMat), 0, 0, -Dc / 2 - 0.02));
  const buttons = [];
  const topAt = (x) => { const t = (x - hx) / 1.3; return 0.92 - 0.45 * t * t; };
  for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) {
    const x = hx + 0.14 + i * 0.12 + (j % 2 ? 0.06 : 0), y = 0.56 + j * 0.09;
    if (x > hx + 1.22 || y > topAt(x) - 0.06) continue;
    buttons.push({ p: [x, y, -Dc / 2 + 0.095], s: 1 });
  }
  g.add(instances(new THREE.SphereGeometry(0.009, 8, 6).scale(1, 1, 0.6), velDeep, buttons, { cast: false }));
  // bolster with gilt end-buttons and tassels
  g.add(mesh(cylG(0.085, 0.085, Dc - 0.12, 24).rotateX(Math.PI / 2).translate(hx + 0.21, seatY + 0.08, 0.02), vel));
  g.add(mergeInto([cylG(0.03, 0.03, Dc - 0.1, 12).rotateX(Math.PI / 2).translate(hx + 0.21, seatY + 0.08, 0.02), new THREE.SphereGeometry(0.018, 10, 8).translate(hx + 0.21, seatY + 0.04, (Dc - 0.1) / 2 + 0.02), latheG([[0.001, 0], [0.012, 0.005], [0.014, 0.05], [0.001, 0.055]], 10).rotateX(Math.PI).translate(hx + 0.21, seatY + 0.03, (Dc - 0.1) / 2 + 0.02)], gilt));
  // valance: pleated, front and both ends, with a bullion fringe at the hem and gimp at the top
  const vpath = [[hx - 0.02, -Dc / 2 + 0.02], [hx - 0.02, fz + 0.02], [fx + 0.02, fz + 0.02], [fx + 0.02, -Dc / 2 + 0.02]];
  const valance = mesh(pleatStrip(vpath, 0.06, 0.34, 0.075, 0.011), (() => { const m = M.velvetRed({ color: PAL.peachDeep, wear: 0.5, repeat: [6, 1], unique: true }); m.side = THREE.DoubleSide; return m; })());
  g.add(valance);
  const fr = mesh(pleatStrip(vpath.map(([x, z]) => [x + (x < 0 ? -0.004 : 0.004) * 0, z]), 0.0, 0.09, 0.075, 0.013), new THREE.MeshStandardMaterial({ map: fringeTex(), alphaTest: 0.5, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide }), { cast: false });
  fr.scale.set(1.004, 1, 1.02); g.add(fr);
  g.add(mergeInto([tubeG([[hx - 0.02, 0.34, -Dc / 2 + 0.02], [hx - 0.02, 0.34, fz + 0.02], [fx + 0.02, 0.34, fz + 0.02], [fx + 0.02, 0.34, -Dc / 2 + 0.02]], 0.007, { radial: 6, seg: 60, tension: 0 })], gilt));
  // the shawl thrown over the head
  const sp = [[hx + 0.3, seatY + 0.005], [hx + 0.2, seatY + 0.16], [hx + 0.06, seatY + 0.34], [hx - 0.06, 0.9], [hx - 0.15, 0.78], [hx - 0.13, 0.55], [hx - 0.12, 0.32]];
  const curve = new THREE.CatmullRomCurve3(sp.map(([x, y]) => new THREE.Vector3(x, y, 0)));
  const nU = 40, nV = 14, sw = 0.5, z0 = -0.02;
  const spos = [], suv = [], sidx = [], rs = rng(131);
  for (let i = 0; i <= nU; i++) {
    const t = i / nU, c0 = curve.getPoint(t);
    for (let j = 0; j <= nV; j++) {
      const v = j / nV, z = z0 + (v - 0.5) * sw * (1 + 0.25 * t) + 0.04 * Math.sin(t * 9 + v * 3) * t;
      const lift = 0.012 * Math.sin(v * Math.PI * 3 + t * 8) * (0.4 + t);
      spos.push(c0.x - lift * 0.5 - (t > 0.75 ? 0.02 * Math.sin(v * 7) : 0), c0.y + lift + 0.016 + 0.004 * rs(), z);
      suv.push(v, t * 1.5);
      if (i && j) { const a = (i - 1) * (nV + 1) + j - 1, b = a + 1, c2 = a + nV + 1, d2 = c2 + 1; sidx.push(a, c2, b, b, c2, d2); }
    }
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.Float32BufferAttribute(spos, 3)); sgeo.setAttribute('uv', new THREE.Float32BufferAttribute(suv, 2)); sgeo.setIndex(sidx); sgeo.computeVertexNormals();
  const shawl = mesh(sgeo, new THREE.MeshStandardMaterial({ map: paisleyTex(), roughness: 0.9, side: THREE.DoubleSide }));
  g.add(shawl);
  // one dried lily on the seat, near the foot
  const lily = driedLily(); lily.position.set(fx - 0.62, seatY + 0.002, 0.1); lily.rotation.y = 0.5; g.add(lily);
  // under the valance (a proxy for the delight)
  const underProxy = new THREE.Mesh(new THREE.BoxGeometry(Lc * 0.8, 0.3, 0.06), new THREE.MeshBasicMaterial({ visible: false }));
  underProxy.position.set(0.1, 0.17, fz + 0.05); underProxy.userData.hitProxy = true; g.add(underProxy);
  Object.assign(g.userData, {
    seatY, valance, shawl, lily, underProxy,
    perch: new THREE.Vector3(hx + 0.62, seatY, fz - 0.12),
    jewelSpot: new THREE.Vector3(0.18, 0, fz + 0.05),
  });
  return g;
}

// =================================================================================================================
// THE JEWEL CASE: red leather, brass corners, a brass clasp with four number wheels and a press button.
// Origin: base centre; front +Z. userData: { lid (pivot: setLid 0..1), wheels (numberWheels group: setValue/step/values),
// button (Mesh), clasp, pearls, lily, lastPage (Mesh), setPage(bool), glint (Sprite), W, H, D }
// =================================================================================================================
export const JEWEL = { w: 0.25, h: 0.085, d: 0.165 };
export function jewelCase({ values = [1, 9, 0, 0] } = {}) {
  const { w: W, h: H, d: D } = JEWEL;
  const g = grp('jewelCase'); g.userData.keep = true;
  const red = M.leather('#8a1a22'), brass = M.brass({ unique: false });
  // an open-topped body (walls and a floor) so the silk tray shows when the lid lifts
  const t = 0.012;
  g.add(mesh(mergeG([boxG(W, 0.014, D, 0, 0.007, 0, 0.004), boxG(W, H, t, 0, H / 2, D / 2 - t / 2, 0.004), boxG(W, H, t, 0, H / 2, -D / 2 + t / 2, 0.004), boxG(t, H, D, -W / 2 + t / 2, H / 2, 0, 0.004), boxG(t, H, D, W / 2 - t / 2, H / 2, 0, 0.004)]), red));
  const br = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { br.push(boxG(0.024, 0.024, 0.024, sx * (W / 2 - 0.01), 0.011, sz * (D / 2 - 0.01), 0.004)); }
  // the brass rim round the mouth of the case (a ring, not a plate)
  br.push(boxG(W + 0.004, 0.006, 0.014, 0, H - 0.003, D / 2 - 0.005, 0.002), boxG(W + 0.004, 0.006, 0.014, 0, H - 0.003, -D / 2 + 0.005, 0.002), boxG(0.014, 0.006, D + 0.004, -W / 2 + 0.005, H - 0.003, 0, 0.002), boxG(0.014, 0.006, D + 0.004, W / 2 - 0.005, H - 0.003, 0, 0.002));
  for (const sx of [-1, 1]) br.push(cylG(0.006, 0.006, 0.04, 10).rotateZ(Math.PI / 2).translate(sx * 0.07, H, -D / 2 - 0.003));
  g.add(mergeInto(br, brass));
  // the clasp: plate, a window bezel round the wheels, the button
  const clasp = grp('clasp'); clasp.position.set(0, H - 0.026, D / 2); g.add(clasp);
  clasp.add(mesh(mergeG([boxG(0.13, 0.05, 0.006, 0, 0, 0.003, 0.003), boxG(0.075, 0.003, 0.012, -0.012, 0.0145, 0.008, 0.001), boxG(0.075, 0.003, 0.012, -0.012, -0.0145, 0.008, 0.001), boxG(0.003, 0.026, 0.012, -0.05, 0, 0.008, 0.001), boxG(0.003, 0.026, 0.012, 0.026, 0, 0.008, 0.001), boxG(0.04, 0.03, 0.01, 0, 0.03, -0.002, 0.003)]), brass));
  // ENGINE-FIX: numberWheels now centres the value on the front; the close-up looks down on the case at ~29°, so the value
  // is centred there (it used to read right here only because the shared band sat half a digit high)
  const wheels = T.numberWheels({ count: 4, r: 0.0105, width: 0.013, gap: 0.004, values, axle: true, face: 0.5 });
  wheels.position.set(-0.012, 0, 0.008); clasp.add(wheels);
  // CHANGED BY puzzles-dressing: a domed, satin button with a faint warm glow; polished and flat it mirrored the dark
  // under-chaise and read as a black hole at 1280×800
  const button = mesh(mergeG([cylG(0.009, 0.01, 0.008, 20).rotateX(Math.PI / 2), new THREE.SphereGeometry(0.0085, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.45).translate(0, 0, 0.004)]), new THREE.MeshStandardMaterial({ color: '#d8b25a', metalness: 0.75, roughness: 0.42, emissive: '#5a3c10', emissiveIntensity: 0.55 })); button.position.set(0.045, 0, 0.01); clasp.add(button);
  // the lid
  const lid = grp('lid'); lid.position.set(0, H, -D / 2); g.add(lid);
  const lidGeo = boxG(W, 0.032, D, 0, 0.016, D / 2, 0.01); const lp = lidGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) { if (lp.getY(i) > 0.02) { const x = lp.getX(i) / (W / 2), z = (lp.getZ(i) - D / 2) / (D / 2); lp.setY(i, lp.getY(i) + 0.008 * (1 - x * x) * (1 - z * z)); } }
  lidGeo.computeVertexNormals();
  lid.add(mesh(lidGeo, red));
  lid.add(mesh(mergeG([boxG(W + 0.004, 0.006, D + 0.004, 0, 0.003, D / 2, 0.002), boxG(0.05, 0.004, 0.03, 0, 0.042, D / 2, 0.002)]), brass));
  const silk = new THREE.MeshStandardMaterial({ color: '#efe2cc', roughness: 0.55, emissive: '#5a4838', emissiveIntensity: 0.7 }); // ivory silk: it holds what light there is under the chaise
  lid.add(at(mesh(new THREE.PlaneGeometry(W - 0.02, D - 0.02).rotateX(Math.PI / 2), silk, { cast: false }), 0, -0.001, D / 2));
  // inside: silk tray, pearls, a pressed lily, the folded last page
  const inner = grp('inner'); g.add(inner);
  inner.add(at(mesh(new THREE.PlaneGeometry(W - 0.016, D - 0.016).rotateX(-Math.PI / 2), silk, { cast: false }), 0, H - 0.022, 0));
  const pl = [];
  for (let i = 0; i < 38; i++) { const a = i / 38 * TAU; pl.push({ p: [-0.06 + Math.cos(a) * 0.045, H - 0.016, -0.02 + Math.sin(a) * 0.035 + 0.01 * Math.sin(a * 2)], s: 1 }); }
  const pearls = instances(new THREE.SphereGeometry(0.0052, 10, 8), new THREE.MeshPhysicalMaterial({ color: '#f6f0e8', roughness: 0.2, clearcoat: 1, sheen: 1, sheenColor: new THREE.Color('#ffd8e8'), emissive: '#5a4a44', emissiveIntensity: 0.5 }), pl, { cast: false });
  inner.add(pearls);
  const lily = driedLily('#e6d8b4'); lily.scale.setScalar(0.42); lily.position.set(0.0, H - 0.02, 0.045); lily.rotation.y = 0.3; inner.add(lily);
  const pageTex = T.agedPaperTexture({ w: 384, h: 512, seed: 97, age: 0.5, key: 'dressing:lastpage-out', fold: { v: 1, hz: 1 }, draw: (gg, Wp, Hp) => {
    gg.fillStyle = '#2a2420'; gg.font = `26px ${FONTS.typed}`; gg.fillText('p. 97', Wp * 0.7, Hp * 0.1);
    gg.font = `22px ${FONTS.typed}`; ['THE LAMP AT GULL POINT', 'ACT III  Sc. 2', '', 'GRACE: Father, the sea', 'is coming in!'].forEach((l, i) => gg.fillText(l, Wp * 0.1, Hp * (0.2 + i * 0.07)));
    gg.fillStyle = '#5a5a64'; gg.font = `20px ${FONTS.hand}`; gg.fillText('Q35', Wp * 0.78, Hp * 0.45);
    gg.fillStyle = '#3a2a5a'; gg.font = `18px ${FONTS.hand}`; gg.fillText('Revised 14.3.31 - L.T.', Wp * 0.3, Hp * 0.9);
  } });
  const lastPage = T.paperSheet({ w: 0.1, h: 0.13, texture: pageTex, curl: 0.004, fold: 0.004, seed: 97 });
  lastPage.rotation.set(-Math.PI / 2, 0, -0.12); lastPage.position.set(0.055, H - 0.014, -0.01); lastPage.castShadow = false;
  inner.add(lastPage);
  inner.visible = false;
  const glint = T.halo('#fff2d0', 0.12, 0); glint.position.set(0.02, H + 0.01, D / 2); glint.visible = false; g.add(glint);
  Object.assign(g.userData, {
    lid, wheels, button, clasp, pearls, lily, lastPage, inner, glint, W, H, D,
    setLid(t) { lid.rotation.x = -t * 1.85; inner.visible = t > 0.01; },
    setPage(b) { lastPage.visible = b; },
  });
  return g;
}

// =================================================================================================================
// THE GRAMOPHONE: a portable in black leatherette with brass corners, lid up, a small brass horn, a record on the
// platter with the speed tester card lying on it (four strobe rings that each drift by (rpm − ring rpm) × 4°/s and so
// stand still at their own speed), a tone arm, a speed lever on an engraved SLOW … FAST arc of 13 notches, and a crank
// socket on the right. Origin: base centre; front +Z.
// userData: { spin (Group: record, label, card; turns at a cosmetic speed while playing), rings [{ mesh, rpm }], arm
//   (pivot Group), setArm(0 parked..1 needle down), lever (pivot Group), leverProxy, setLever(notch, fractional ok),
//   notchAngle(i), notchFromAngle(a), NOTCHES (rpm per notch), rpm, setRpm(v), playing, setPlaying(b), winder
//   (Group), setWound(b), turnWinder(rad), socket (Vector3 local), deckY }
// =================================================================================================================
export const GRAM = { w: 0.38, d: 0.42, h: 0.14, notches: Array.from({ length: 13 }, (_, i) => 66 + i * 2), rings: [[90, 0.094, 0.104, 33], [80, 0.082, 0.092, 37], [78, 0.066, 0.08, 39], [70, 0.054, 0.064, 43]] };
function arcPlateTex() {
  const S = 512, [c, g] = cv(S, S), C = S / 2;
  g.clearRect(0, 0, S, S);
  const bg = g.createLinearGradient(0, 0, S, S); bg.addColorStop(0, '#d8b860'); bg.addColorStop(0.5, '#f0d890'); bg.addColorStop(1, '#a88838');
  g.fillStyle = bg; g.beginPath(); g.arc(C, C, C - 4, Math.PI / 2 - 0.75, Math.PI / 2 + 0.75); g.arc(C, C, C * 0.42, Math.PI / 2 + 0.75, Math.PI / 2 - 0.75, true); g.closePath(); g.fill();
  g.strokeStyle = '#3a2a10'; g.lineWidth = 3; g.stroke();
  for (let i = 0; i < 13; i++) {
    const a = Math.PI / 2 + 0.6 - 1.2 * i / 12;
    g.lineWidth = i === 6 ? 4 : 2.5;
    g.beginPath(); g.moveTo(C + Math.cos(a) * C * 0.72, C + Math.sin(a) * C * 0.72); g.lineTo(C + Math.cos(a) * C * 0.92, C + Math.sin(a) * C * 0.92); g.stroke();
  }
  g.fillStyle = '#3a2a10'; g.font = `bold 34px ${FONTS.fell}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [txt, a] of [['SLOW', Math.PI / 2 + 0.6], ['FAST', Math.PI / 2 - 0.6]]) { g.save(); g.translate(C + Math.cos(a) * C * 0.58, C + Math.sin(a) * C * 0.58); g.rotate(a - Math.PI / 2); g.fillText(txt, 0, 0); g.restore(); }
  return tex(c);
}
// POLISH: the needle tin's lid (a cream disc with a red ring and the maker's words)
function needleTinTex() {
  const S = 256, [c, g] = cv(S, S), C = S / 2;
  g.fillStyle = '#c8a050'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#efe0b8'; g.beginPath(); g.arc(C, C, C * 0.92, 0, TAU); g.fill();
  g.strokeStyle = '#8a1a1c'; g.lineWidth = 10; g.beginPath(); g.arc(C, C, C * 0.8, 0, TAU); g.stroke();
  g.fillStyle = '#8a1a1c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold 34px ${FONTS.fell}`; g.fillText('NEEDLES', C, C - 18);
  g.fillStyle = '#2a1c14'; g.font = `italic 24px ${FONTS.fell}`; g.fillText('Loud Tone', C, C + 22);
  g.font = `16px ${FONTS.fell}`; g.fillText('200', C, C + 52);
  return tex(c);
}
function lidLabelTex() {
  return T.agedPaperTexture({ w: 512, h: 320, seed: 141, age: 0.5, tint: '#e8d8b0', key: 'dressing:gramlid', draw: (g, W, H) => {
    g.fillStyle = '#5a1418'; g.textAlign = 'center';
    g.font = `22px ${FONTS.fell}`; g.fillText('THE GRAMOPHONE COMPANY LTD.', W / 2, H * 0.2);
    g.font = `52px ${FONTS.display}`; g.fillText("HIS MASTER'S VOICE", W / 2, H * 0.45);
    g.fillStyle = '#2a1c14'; g.font = `italic 24px ${FONTS.fell}`; g.fillText('Portable Model · Wind fully before playing', W / 2, H * 0.66);
    g.font = `20px ${FONTS.fell}`; g.fillText('Regulate the speed with the lever. Use the tester.', W / 2, H * 0.8);
    g.strokeStyle = '#5a1418'; g.lineWidth = 3; g.strokeRect(12, 12, W - 24, H - 24);
  } });
}
export function gramophone({ notch = 2 } = {}) {
  const { w: W, d: D, h: H } = GRAM;
  const g = grp('gramophone'); g.userData.keep = true;
  const leatherette = M.leather('#1e1816'), brass = M.brass(), nickel = M.iron({ color: '#c8c4bc', roughness: 0.25, metalness: 0.9 });
  g.add(mesh(mergeG([boxG(W, H, D, 0, H / 2, 0, 0.012)]), leatherette));
  const corners = [];
  for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) corners.push(new THREE.SphereGeometry(0.016, 10, 8).scale(1, 0.8, 1).translate(sx * (W / 2 - 0.006), sy * H + (sy ? -0.004 : 0.004), sz * (D / 2 - 0.006)));
  for (const sx of [-1, 1]) corners.push(boxG(0.03, 0.022, 0.012, sx * 0.12, H - 0.025, D / 2 + 0.004, 0.003));
  corners.push(boxG(W - 0.03, 0.006, D - 0.03, 0, H + 0.003, 0, 0.002));
  g.add(mergeInto(corners, brass));
  const deckY = H + 0.006;
  g.add(at(mesh(new THREE.PlaneGeometry(W - 0.04, D - 0.04).rotateX(-Math.PI / 2), M.baize('#3a2a24'), { cast: false }), 0, deckY + 0.0005, 0));
  // the lid, open against the back, with its label
  const lidG = grp('lid'); lidG.position.set(0, H, -D / 2); lidG.rotation.x = -1.78; g.add(lidG);
  lidG.add(mesh(mergeG([boxG(W, 0.04, D, 0, -0.02, D / 2, 0.012)]), leatherette));
  lidG.add(at(mesh(new THREE.PlaneGeometry(W - 0.05, D - 0.05).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: M.baize('#5a1a1c').map, color: '#5a1a1c', roughness: 1 }), { cast: false }), 0, -0.0405, D / 2));
  // FIXED BY qa-dressing: no half-turn about Y; with it the label read upside down from the front, lid open
  lidG.add(at(mesh(new THREE.PlaneGeometry(0.22, 0.1375).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: lidLabelTex(), roughness: 0.8 }), { cast: false }), 0, -0.041, D / 2 + 0.06, 0, 0, 0));
  // platter, record, label, tester card (one spinning group) and the strobe rings
  const pc = new THREE.Vector3(-0.035, deckY, 0.03);
  g.add(mesh(mergeG([cylG(0.135, 0.135, 0.012, 48, pc.x, deckY + 0.006, pc.z), cylG(0.005, 0.005, 0.03, 10, pc.x, deckY + 0.02, pc.z)]), nickel));
  const spin = grp('spin'); spin.position.set(pc.x, deckY + 0.0125, pc.z); g.add(spin);
  spin.add(mesh(new THREE.CircleGeometry(0.125, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: recordTex(), roughness: 0.28 }), { cast: false }));
  spin.add(at(mesh(new THREE.CircleGeometry(0.045, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: recordLabelTex(), roughness: 0.6 }), { cast: false }), 0, 0.0004, 0));
  const r0 = 0.046, r1 = 0.118;
  spin.add(at(mesh(new THREE.RingGeometry(r0, r1, 96, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: testerCardTex(r0, r1), alphaTest: 0.5, roughness: 0.85 }), { cast: false }), 0, 0.0008, 0));
  const rings = GRAM.rings.map(([rpm, ra, rb, bars]) => {
    const m = mesh(new THREE.RingGeometry(ra, rb, 96, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: strobeRingTex(ra, rb, bars, String(rpm), rpm === 78), alphaTest: 0.5, color: '#ffffff' }), { cast: false, receive: false });
    // RingGeometry UVs are planar over rb; the texture is drawn the same way
    m.position.set(pc.x, deckY + 0.0137, pc.z); m.rotation.y = rpm * 0.37; g.add(m);
    return { mesh: m, rpm };
  });
  // tone arm on a turret at the back right
  const tp = new THREE.Vector3(0.135, deckY, -0.13);
  g.add(mesh(mergeG([latheG([[0, 0], [0.028, 0], [0.028, 0.012], [0.016, 0.02], [0.014, 0.05], [0, 0.05]], 20).translate(tp.x, deckY, tp.z)]), nickel));
  const arm = grp('toneArm'); arm.position.set(tp.x, deckY + 0.045, tp.z); g.add(arm);
  const AL = 0.205;
  const armInner = grp('armLift'); arm.add(armInner);
  armInner.add(mesh(mergeG([tubeG([[0, 0, 0], [0, 0.004, AL * 0.5], [-0.012, 0.0, AL * 0.92]], 0.0075, { radial: 10, seg: 16 }), new THREE.SphereGeometry(0.014, 12, 10)]), nickel));
  const sb = grp('soundbox'); sb.position.set(-0.012, -0.006, AL); armInner.add(sb);
  sb.add(mesh(mergeG([cylG(0.026, 0.026, 0.014, 28).rotateZ(Math.PI / 2), cylG(0.0012, 0.0006, 0.022, 6, 0.0, -0.022, 0.0)]), nickel));
  sb.add(at(mesh(new THREE.CircleGeometry(0.022, 24).rotateY(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c8b080', roughness: 0.3, metalness: 0.3 }), { cast: false }), -0.0075, 0, 0));
  // the rest the arm parks on
  g.add(mesh(mergeG([cylG(0.004, 0.004, 0.035, 8, 0.16, deckY + 0.0175, 0.075), boxG(0.02, 0.008, 0.012, 0.16, deckY + 0.036, 0.075, 0.002)]), nickel));
  const parkA = Math.atan2(0.16 - tp.x, 0.075 - tp.z) + 0.02;
  // the playing angle: soundbox on the outer grooves (r ≈ 0.121 from the spindle)
  let playA = parkA;
  for (let a = parkA; a > parkA - 1.6; a -= 0.002) { const x = tp.x + Math.sin(a) * AL, z = tp.z + Math.cos(a) * AL; if (Math.hypot(x - pc.x, z - pc.z) <= 0.121) { playA = a; break; } }
  let armT = 0;
  const setArm = (t) => { armT = t; arm.rotation.y = parkA + (playA - parkA) * Math.min(1, t * 1.25); armInner.rotation.x = -(Math.sin(Math.PI * Math.min(1, t)) * 0.12) - (t < 0.8 ? 0.02 : 0); if (t >= 1) armInner.rotation.x = 0.01; };
  // a small brass horn rising from behind the turret
  const horn = [tubeG([[tp.x, deckY + 0.04, tp.z - 0.02], [tp.x + 0.01, deckY + 0.1, tp.z - 0.06], [tp.x - 0.02, deckY + 0.16, tp.z - 0.06]], 0.011, { radial: 10, seg: 20 })];
  const bell = latheG([[0.011, 0], [0.014, 0.03], [0.022, 0.06], [0.04, 0.09], [0.07, 0.11], [0.09, 0.115]], 32);
  bell.rotateX(Math.PI / 2 - 0.35).rotateY(-0.35).translate(tp.x - 0.03, deckY + 0.165, tp.z - 0.055);
  const hornMat = M.brass({ polished: true, unique: true }); hornMat.side = THREE.DoubleSide;
  g.add(mergeInto([...horn, bell], hornMat));
  // speed lever on its engraved arc (front right)
  const lp = new THREE.Vector3(0.13, deckY, 0.105);
  g.add(at(mesh(new THREE.CircleGeometry(0.06, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: arcPlateTex(), alphaTest: 0.5, roughness: 0.3, metalness: 0.7 }), { cast: false }), lp.x, deckY + 0.0012, lp.z));
  const lever = grp('lever'); lever.position.set(lp.x, deckY + 0.003, lp.z); g.add(lever);
  lever.add(mesh(mergeG([cylG(0.008, 0.008, 0.008, 14, 0, 0.004, 0), boxG(0.006, 0.004, 0.052, 0, 0.007, 0.026, 0.0015), new THREE.SphereGeometry(0.008, 12, 8).translate(0, 0.012, 0.052)]), M.brass({ polished: true })));
  const leverProxy = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.07), new THREE.MeshBasicMaterial({ visible: false }));
  leverProxy.position.set(lp.x, deckY + 0.015, lp.z + 0.035); leverProxy.userData.hitProxy = true; g.add(leverProxy);
  const notchAngle = (i) => -0.6 + 1.2 * i / 12;
  const notchFromAngle = (a) => THREE.MathUtils.clamp(Math.round((a + 0.6) / 1.2 * 12), 0, 12);
  // crank socket on the right side, and the winder that lives in it once wound
  // POLISH: the socket was a flush brass disc on the side face, invisible from the close-up (the needle tin on the deck
  // read as the socket instead). Now a polished boss stands well proud of the case with a dark square bore, so it
  // shows past the case's right edge and catches the lamp (36 mm proud); the winder seats on its end.
  const socket = new THREE.Vector3(W / 2 + 0.036, 0.085, 0.06);
  const bossX = W / 2;
  g.add(mesh(mergeG([
    cylG(0.03, 0.03, 0.004, 28).rotateZ(Math.PI / 2).translate(bossX + 0.002, socket.y, socket.z),    // escutcheon
    cylG(0.016, 0.021, 0.032, 24).rotateZ(Math.PI / 2).translate(bossX + 0.018, socket.y, socket.z),  // boss
    cylG(0.02, 0.02, 0.004, 24).rotateZ(Math.PI / 2).translate(bossX + 0.034, socket.y, socket.z),    // lip
  ]), M.brass({ polished: true })));
  g.add(mesh(boxG(0.002, 0.011, 0.011, socket.x + 0.0001, socket.y, socket.z, 0.0005), new THREE.MeshBasicMaterial({ color: '#0a0806' }), { cast: false }));
  const winderPivot = grp('winderPivot'); winderPivot.position.copy(socket); g.add(winderPivot);
  const winder = winderHandle(); winder.rotation.y = 0; winderPivot.add(winder); winder.visible = false;
  // a little catch and a needle tin on the deck for clutter
  // POLISH: the tin was a dark tarnished disc that read as a hole (the crank socket, to a player). Now a bright tin
  // with a printed lid, a rolled rim, standing a little proud; it has its own caption (dressing.gramophone.tin).
  const tinG = grp('needleTin'); tinG.position.set(-0.15, deckY, 0.165); g.add(tinG);
  tinG.add(mesh(mergeG([cylG(0.021, 0.021, 0.012, 24, 0, 0.006, 0), cylG(0.022, 0.022, 0.003, 24, 0, 0.0125, 0)]), M.brass({ polished: true })));
  tinG.add(at(mesh(new THREE.CircleGeometry(0.019, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: needleTinTex(), roughness: 0.5, metalness: 0.2 }), { cast: false }), 0, 0.0142, 0));
  const tinHit = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.05), new THREE.MeshBasicMaterial({ visible: false }));
  tinHit.position.set(0, 0.01, 0); tinHit.userData.hitProxy = true; tinG.add(tinHit);

  let playing = false, rpm = GRAM.notches[notch];
  const state = { notch };
  Object.assign(g.userData, {
    spin, rings, arm, setArm, lever, leverProxy, notchAngle, notchFromAngle, NOTCHES: GRAM.notches, winder, winderPivot, socket, deckY, platterCentre: pc,
    needleTin: tinG, needleTinHit: tinHit, // POLISH
    setRpm(v) { rpm = v; },
    setPlaying(b) { playing = b; },
    setLever(i) { state.notch = i; lever.rotation.y = notchAngle(i); rpm = 66 + 2 * i; },
    setWound(b) { winder.visible = b; },
    turnWinder(a) { winderPivot.rotation.x = a; },
    update(dt) {
      if (!playing) return;
      spin.rotation.y -= dt * 0.55; // cosmetic: the label and card turn slowly
      for (const r of rings) r.mesh.rotation.y -= (rpm - r.rpm) * (4 * Math.PI / 180) * dt; // positive drift = clockwise from above
    },
  });
  // live getters (Object.assign would copy their values once)
  Object.defineProperties(g.userData, {
    rpm: { get: () => rpm, enumerable: true }, playing: { get: () => playing, enumerable: true },
    armT: { get: () => armT, enumerable: true }, notch: { get: () => state.notch, enumerable: true },
  });
  g.userData.setLever(notch); setArm(0);
  return g;
}

// =================================================================================================================
// THE COSTUME WARDROBE: tall, ivory and gilt, double doors, a cornice with a cartouche; inside a rail of her gowns
// (they sway and sigh when the doors open), a shelf of hatboxes. Origin: floor centre; front +Z.
// userData: { doors [left, right] (pivots), setOpen(0..1), gowns [Group], inner (Group, hidden while shut), W, H, D, sigh() }
// =================================================================================================================
export const WARDROBE = { w: 1.12, h: 2.16, d: 0.58 };
export function wardrobe() {
  const { w: W, h: H, d: D } = WARDROBE;
  const g = grp('wardrobe');
  const ivory = ivoryMat().clone(), gilt = giltMat();
  ivory.color.set('#cdb8a2'); // aged paint: ivory gone tea-coloured and smoky
  const carc = [boxG(0.03, H - 0.12, D, -W / 2 + 0.015, (H - 0.12) / 2 + 0.1, 0, 0.004), boxG(0.03, H - 0.12, D, W / 2 - 0.015, (H - 0.12) / 2 + 0.1, 0, 0.004), boxG(W, 0.03, D, 0, H - 0.035, 0, 0.004), boxG(W, 0.02, D - 0.04, 0, 0.11, -0.02, 0.003), boxG(W, H - 0.12, 0.015, 0, (H - 0.12) / 2 + 0.1, -D / 2 + 0.0075, 0.002),
    boxG(W + 0.02, 0.1, D + 0.02, 0, 0.05, 0.0, 0.01), boxG(W + 0.1, 0.05, D + 0.07, 0, H - 0.005, 0.02, 0.012), boxG(W + 0.06, 0.04, D + 0.05, 0, H - 0.045, 0.01, 0.01)];
  g.add(mergeInto(carc, ivory));
  const cs = new THREE.Shape();
  cs.moveTo(-0.3, 0); cs.bezierCurveTo(-0.24, 0.06, -0.1, 0.04, -0.08, 0.1); cs.bezierCurveTo(-0.06, 0.17, -0.02, 0.19, 0, 0.2); cs.bezierCurveTo(0.02, 0.19, 0.06, 0.17, 0.08, 0.1); cs.bezierCurveTo(0.1, 0.04, 0.24, 0.06, 0.3, 0); cs.closePath();
  const gl = [new THREE.ExtrudeGeometry(cs, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }).translate(0, H + 0.02, D / 2 + 0.03), boxG(W + 0.105, 0.012, D + 0.075, 0, H + 0.02, 0.02, 0.004), boxG(W + 0.025, 0.01, D + 0.025, 0, 0.1, 0, 0.003)];
  g.add(mergeInto(gl, gilt));
  // doors
  const leafW = W / 2 - 0.02, leafH = H - 0.2, ly = 0.12 + leafH / 2;
  const doors = [];
  for (const s of [-1, 1]) {
    const pivot = grp(s < 0 ? 'doorL' : 'doorR'); pivot.position.set(s * (W / 2 - 0.02), ly, D / 2 + 0.01); g.add(pivot);
    pivot.userData.keep = true;
    const cx = -s * leafW / 2;
    pivot.add(mesh(mergeG([boxG(leafW - 0.004, leafH, 0.024, cx, 0, 0, 0.004)]), ivory));
    // the painted face of the leaf: recessed panels, crazing, handled grime by the pulls, scuffed toe
    pivot.add(at(mesh(new THREE.PlaneGeometry(leafW - 0.006, leafH - 0.002), new THREE.MeshStandardMaterial({ map: leafTex(s), roughness: 0.62 }), { cast: false }), cx, 0, 0.0122));
    const pm = [];
    for (const [py, ph] of [[0.42, 0.9], [-0.55, 0.62]]) {
      const pw = leafW - 0.12;
      pm.push(boxG(pw, 0.012, 0.008, cx, py + ph / 2, 0.014, 0.002), boxG(pw, 0.012, 0.008, cx, py - ph / 2, 0.014, 0.002), boxG(0.012, ph, 0.008, cx - pw / 2, py, 0.014, 0.002), boxG(0.012, ph, 0.008, cx + pw / 2, py, 0.014, 0.002));
    }
    pm.push(latheG([[0, 0], [0.012, 0], [0.014, 0.02], [0.008, 0.03], [0.004, 0.06], [0, 0.065]], 12).rotateX(Math.PI / 2).translate(cx - s * (leafW / 2 - 0.05) * -1 + s * 0, 0.02, 0.012));
    pivot.add(mergeInto(pm, gilt, { cast: false }));
    // a painted lily medallion in the upper panel
    pivot.add(at(mesh(new THREE.PlaneGeometry(0.24, 0.32), new THREE.MeshStandardMaterial({ map: medallionTex(s), transparent: true, alphaTest: 0.4, roughness: 0.6 }), { cast: false }), cx, 0.42, 0.0128));
    doors.push(pivot);
  }
  // the inside: a rail, her gowns, a shelf with hatboxes
  const inner = grp('inner'); g.add(inner); inner.userData.keep = true;
  inner.add(at(mesh(new THREE.PlaneGeometry(W - 0.04, H - 0.14), M.matte('#3a2a24', { roughness: 0.9 }), { cast: false }), 0, H / 2 + 0.03, -D / 2 + 0.017));
  inner.add(mesh(mergeG([cylG(0.012, 0.012, W - 0.05, 10).rotateZ(Math.PI / 2).translate(0, 1.72, 0), boxG(W - 0.05, 0.016, D - 0.06, 0, 1.82, -0.01, 0.003)]), M.brass()));
  const gowns = [];
  const cols = ['#d6a08c', '#b8a4d6', '#efe4cc', '#2f5a48', '#9a3a4a', '#c8b070'];
  cols.forEach((col, i) => {
    const gw = T.garment({ type: i === 3 ? 'cape' : 'gown', color: col, seed: 11 + i });
    gw.position.set(-W / 2 + 0.14 + i * 0.165, 1.72, 0); gw.rotation.y = Math.PI / 2 + (i % 2 ? 0.12 : -0.1); gw.scale.set(0.82, 0.92, 0.82);
    inner.add(gw); gowns.push(gw);
  });
  const hb1 = T.hatbox({ r: 0.15, h: 0.18, colors: ['#e8dcc0', '#9a3a4a'], seed: 82 }); hb1.position.set(-0.25, 1.83, -0.02);
  const hb2 = T.hatbox({ r: 0.13, h: 0.16, colors: ['#e8dcc0', '#2f5a48'], seed: 83 }); hb2.position.set(0.22, 1.83, -0.04);
  inner.add(hb1, hb2);
  inner.visible = false;
  let open = 0, swayAmp = 0;
  Object.assign(g.userData, {
    doors, gowns, inner, W, H, D,
    setOpen(t) { open = t; doors[0].rotation.y = -t * 1.75; doors[1].rotation.y = t * 1.75; inner.visible = t > 0.01; },
    sigh() { swayAmp = 1; },
    update(dt, t) {
      if (swayAmp < 0.001 || open < 0.01) return;
      swayAmp = Math.max(0, swayAmp - dt * 0.35);
      gowns.forEach((gw, i) => { gw.rotation.z = Math.sin(t * 2.2 + i * 0.9) * 0.05 * swayAmp; });
    },
  });
  return g;
}
function leafTex(side) {
  const Wp = 256, Hp = 900, [c, g] = cv(Wp, Hp), r = rng(side < 0 ? 301 : 302);
  g.fillStyle = '#cdb8a2'; g.fillRect(0, 0, Wp, Hp);
  // brush streaks of old paint
  for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,245,225,0.05)' : 'rgba(90,64,40,0.05)'; g.fillRect(r() * Wp, 0, 1 + r() * 3, Hp); }
  // recessed panels (matching the gilt moulding positions: upper centre 0.42 h0.9, lower -0.55 h0.62; leaf h ~1.96)
  const mpp = Hp / 1.96, cyp = (y) => Hp / 2 - y * mpp, pw = (Wp / (0.54)) * (0.54 - 0.12);
  for (const [py, ph] of [[0.42, 0.9], [-0.55, 0.62]]) {
    const x0 = (Wp - pw) / 2, y0 = cyp(py + ph / 2), hh = ph * mpp;
    g.fillStyle = 'rgba(70,46,30,0.16)'; g.fillRect(x0, y0, pw, hh);
    const sh = g.createLinearGradient(0, y0, 0, y0 + 26); sh.addColorStop(0, 'rgba(40,24,14,0.38)'); sh.addColorStop(1, 'rgba(40,24,14,0)');
    g.fillStyle = sh; g.fillRect(x0, y0, pw, 26);
    const sl = g.createLinearGradient(x0, 0, x0 + 16, 0); sl.addColorStop(0, 'rgba(40,24,14,0.3)'); sl.addColorStop(1, 'rgba(40,24,14,0)');
    g.fillStyle = sl; g.fillRect(x0, y0, 16, hh);
    g.fillStyle = 'rgba(255,240,215,0.25)'; g.fillRect(x0, y0 + hh - 3, pw, 3); g.fillRect(x0 + pw - 3, y0, 3, hh);
  }
  // crazing in the paint
  g.strokeStyle = 'rgba(80,56,36,0.22)'; g.lineWidth = 0.8;
  for (let i = 0; i < 70; i++) { let x = r() * Wp, y = r() * Hp; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 22; y += (r() - 0.5) * 22; g.lineTo(x, y); } g.stroke(); }
  // grime: handled edge by the pull (the meeting stiles), dust settling on rails, the scuffed toe
  const hx = side < 0 ? Wp : 0;
  const hg = g.createLinearGradient(hx, 0, Wp - hx, 0); hg.addColorStop(0, 'rgba(70,46,26,0.3)'); hg.addColorStop(0.3, 'rgba(70,46,26,0)');
  g.fillStyle = hg; g.fillRect(0, Hp * 0.3, Wp, Hp * 0.4);
  const tg = g.createLinearGradient(0, Hp, 0, Hp * 0.78); tg.addColorStop(0, 'rgba(50,32,20,0.5)'); tg.addColorStop(1, 'rgba(50,32,20,0)');
  g.fillStyle = tg; g.fillRect(0, Hp * 0.78, Wp, Hp * 0.22);
  const top = g.createLinearGradient(0, 0, 0, Hp * 0.12); top.addColorStop(0, 'rgba(60,40,24,0.35)'); top.addColorStop(1, 'rgba(60,40,24,0)');
  g.fillStyle = top; g.fillRect(0, 0, Wp, Hp * 0.12);
  for (let i = 0; i < 5; i++) softBlot(g, r() * Wp, Hp * 0.6 + r() * Hp * 0.35, 20 + r() * 40, 'rgba(80,52,30,A)', 0.12);
  noiseSpeckle(g, Wp, Hp, side < 0 ? 303 : 304, 2600, '#5a3a22', 0.04, 0.14, 1, 2);
  return tex(c);
}
function medallionTex(flip) {
  const S = 256, [c, g] = cv(S, Math.round(S * 4 / 3)), H = c.height;
  g.clearRect(0, 0, S, H);
  g.strokeStyle = '#b08a3a'; g.lineWidth = 4; g.beginPath(); g.ellipse(S / 2, H / 2, S / 2 - 6, H / 2 - 6, 0, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(214,180,170,0.55)'; g.beginPath(); g.ellipse(S / 2, H / 2, S / 2 - 10, H / 2 - 10, 0, 0, TAU); g.fill();
  drawLilySprig(g, S / 2, H / 2 + 20, 1.7, 'rgba(250,240,230,0.9)', 'rgba(120,80,60,0.7)', flip);
  return tex(c);
}

// =================================================================================================================
// SUNDRIES on the dressing table and about the room.
// =================================================================================================================
/** Greasepaint: four green tins (Leichner No. 5 and No. 9) and a tray of sticks. Origin: centre on the table. */
export function greasepaint() {
  const g = grp('greasepaint');
  const lidTex = (n) => { const [c, gg] = cv(256, 256); gg.fillStyle = PAL.tin; gg.beginPath(); gg.arc(128, 128, 126, 0, TAU); gg.fill(); gg.strokeStyle = '#c9a24a'; gg.lineWidth = 6; gg.beginPath(); gg.arc(128, 128, 112, 0, TAU); gg.stroke(); gg.fillStyle = '#efe0b0'; gg.textAlign = 'center'; gg.font = `bold 34px ${FONTS.fell}`; gg.fillText('LEICHNER', 128, 104); gg.font = `86px ${FONTS.display}`; gg.fillText(n, 128, 190); noiseSpeckle(gg, 256, 256, 7, 600, '#1a2a1a', 0.05, 0.2, 1, 3); return tex(c); };
  const side = new THREE.MeshStandardMaterial({ color: PAL.tin, roughness: 0.4, metalness: 0.5 });
  for (const [x, z, n] of [[-0.05, -0.03, '5'], [0.02, -0.04, '9'], [-0.02, 0.04, '5'], [0.06, 0.03, '9']]) {
    const t = grp('tin');
    t.add(mesh(cylG(0.03, 0.03, 0.022, 24, 0, 0.011, 0), side));
    t.add(at(mesh(new THREE.CircleGeometry(0.03, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: lidTex(n), roughness: 0.45, metalness: 0.3 }), { cast: false }), 0, 0.0225, 0));
    t.position.set(x, 0, z); t.rotation.y = x * 20; g.add(t);
  }
  // an open tray of greasepaint sticks
  const tray = grp('sticks'); tray.position.set(0.0, 0, 0.11); tray.rotation.y = 0.15; g.add(tray);
  tray.add(mesh(mergeG([boxG(0.15, 0.006, 0.07, 0, 0.003, 0, 0.002), boxG(0.15, 0.02, 0.004, 0, 0.01, 0.033, 0.001), boxG(0.15, 0.02, 0.004, 0, 0.01, -0.033, 0.001), boxG(0.004, 0.02, 0.07, 0.073, 0.01, 0, 0.001), boxG(0.004, 0.02, 0.07, -0.073, 0.01, 0, 0.001)]), M.tarnishedBrass({ amount: 0.6 })));
  const sticks = ['#e8b8a0', '#c87a68', '#f0d0b0', '#8a3a3a', '#d8a890', '#3a2a2a', '#c8c0e0'].map((c, i) => ({ p: [-0.06 + i * 0.019, 0.012, (i % 2 ? 0.004 : -0.004)], r: [Math.PI / 2, 0, 0.0], s: [1, 1 - (i % 3) * 0.15, 1], c }));
  tray.add(instances(cylG(0.0065, 0.0065, 0.06, 10), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), sticks, { cast: false }));
  return g;
}
/** A porcelain powder bowl with a swansdown puff. userData: { puff } */
export function powderBowl() {
  const g = grp('powderBowl');
  g.add(mesh(latheG([[0.001, 0], [0.035, 0], [0.04, 0.004], [0.055, 0.025], [0.06, 0.04], [0.057, 0.042], [0.05, 0.03], [0.001, 0.03]], 32), M.porcelain('#f2e4e0')));
  g.add(mesh(new THREE.TorusGeometry(0.058, 0.0025, 6, 32).rotateX(Math.PI / 2).translate(0, 0.04, 0), M.gold()));
  const puffTex = (() => { const [c, gg] = cv(128, 128); gg.fillStyle = '#f8e8e4'; gg.fillRect(0, 0, 128, 128); noiseSpeckle(gg, 128, 128, 5, 3000, '#ffffff', 0.2, 0.6, 1, 2); noiseSpeckle(gg, 128, 128, 6, 1200, '#d8b0b0', 0.1, 0.3, 1, 2); return tex(c); })();
  const puff = mesh(new THREE.SphereGeometry(0.048, 20, 12).scale(1, 0.42, 1), new THREE.MeshStandardMaterial({ map: puffTex, roughness: 1 }));
  puff.position.y = 0.046; g.add(puff);
  g.add(at(mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 16).rotateX(Math.PI / 2), M.matte('#d8a0a8')), 0, 0.066, 0));
  g.userData.puff = puff;
  return g;
}
/** Fan letters: a bundle of envelopes tied with lilac ribbon. */
export function fanLetters() {
  const g = grp('fanLetters');
  const envTex = (seed, hand) => T.agedPaperTexture({ w: 384, h: 256, seed, age: 0.55, tint: '#efe4cc', key: 'dressing:env' + seed, draw: (gg, W, H) => {
    gg.fillStyle = '#2a2440'; gg.font = `26px ${FONTS.hand}`; gg.fillText(hand, W * 0.22, H * 0.52); gg.font = `20px ${FONTS.hand}`; gg.fillText('Empress Theatre', W * 0.3, H * 0.7);
    gg.fillStyle = '#a03a3a'; gg.fillRect(W * 0.8, H * 0.1, 44, 52); gg.strokeStyle = '#2a2420'; gg.lineWidth = 2; for (let k = 0; k < 4; k++) { gg.beginPath(); gg.moveTo(W * 0.66, H * 0.16 + k * 8); gg.bezierCurveTo(W * 0.74, H * 0.12 + k * 8, W * 0.8, H * 0.2 + k * 8, W * 0.92, H * 0.16 + k * 8); gg.stroke(); }
  } });
  const hands = ['Miss L. Thrush', 'Miss Lavinia Thrush', 'Miss Thrush', 'Miss L. Thrush', 'To Grace'];
  for (let i = 0; i < 5; i++) {
    const m = mesh(new THREE.PlaneGeometry(0.15, 0.1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: envTex(150 + i, hands[i]), roughness: 0.9 }));
    m.position.set((i % 2 ? 0.006 : -0.004) * i, 0.003 + i * 0.0035, (i % 3) * 0.004); m.rotation.y = (i - 2) * 0.06; g.add(m);
    if (i < 4) { const e = mesh(boxG(0.148, 0.003, 0.098, 0, 0, 0, 0.0005), M.matte('#e8dcc4')); e.position.copy(m.position); e.position.y -= 0.0018; e.rotation.y = m.rotation.y; g.add(e); }
  }
  g.add(mesh(mergeG([boxG(0.012, 0.022, 0.104, 0.0, 0.011, 0.002, 0.001), boxG(0.156, 0.022, 0.012, 0.0, 0.011, 0.0, 0.001), tubeG([[0, 0.022, 0], [0.03, 0.026, 0.03], [0.05, 0.004, 0.06]], 0.003, { radial: 4 }), tubeG([[0, 0.022, 0], [-0.02, 0.026, 0.04], [-0.04, 0.004, 0.07]], 0.003, { radial: 4 })]), M.matte(PAL.lilac, { roughness: 0.5 })));
  return g;
}
/** Dr Footlights' tonic: a tall brown bottle with its label and a cork. */
export function tonicBottle() {
  const g = grp('tonic');
  g.add(mesh(latheG([[0.001, 0], [0.03, 0], [0.032, 0.006], [0.032, 0.13], [0.026, 0.15], [0.012, 0.165], [0.011, 0.19], [0.013, 0.195], [0.001, 0.195]], 24), new THREE.MeshPhysicalMaterial({ color: '#4a2410', roughness: 0.12, clearcoat: 1, transmission: 0, metalness: 0.0 })));
  g.add(mesh(cylG(0.0095, 0.0085, 0.022, 12, 0, 0.2, 0), M.matte('#b8905a')));
  const lab = T.agedPaperTexture({ w: 512, h: 384, seed: 171, age: 0.5, tint: '#ecdcb0', key: 'dressing:tonic', draw: (gg, W, H) => {
    gg.fillStyle = '#5a1418'; gg.textAlign = 'center';
    gg.font = `40px ${FONTS.fell}`; gg.fillText("DR FOOTLIGHTS'", W / 2, H * 0.22);
    gg.font = `86px ${FONTS.display}`; gg.fillText('TONIC', W / 2, H * 0.5);
    gg.fillStyle = '#2a1c14'; gg.font = `italic 30px ${FONTS.fell}`; gg.fillText('Cures All Ills', W / 2, H * 0.7); gg.fillText('for the Run of the Play', W / 2, H * 0.84);
    gg.strokeStyle = '#5a1418'; gg.lineWidth = 6; gg.strokeRect(10, 10, W - 20, H - 20);
  } });
  g.add(mesh(new THREE.CylinderGeometry(0.0325, 0.0325, 0.075, 24, 1, true, -1.2, 2.4).translate(0, 0.07, 0), new THREE.MeshStandardMaterial({ map: lab, roughness: 0.85 }), { cast: false }));
  return g;
}
/** A silver-backed hairbrush and a hand mirror lying face down. */
export function vanitySet() {
  const g = grp('vanitySet');
  const silver = M.iron({ color: '#d0ccc4', roughness: 0.22, metalness: 1 });
  g.add(mesh(mergeG([new THREE.SphereGeometry(0.05, 20, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.25, 0.68).translate(0, 0.012, 0), boxG(0.1, 0.012, 0.022, 0.1, 0.012, 0, 0.005)]), silver));
  g.add(mesh(mergeG([boxG(0.085, 0.012, 0.058, 0, 0.004, 0, 0.004)]), M.matte('#efe8d8')));
  const hm = mergeG([cylG(0.055, 0.055, 0.012, 28, 0, 0.006, 0).scale(1, 1, 1.25), boxG(0.1, 0.01, 0.022, 0, 0.006, 0.11, 0.004)]);
  g.add(at(mesh(hm, silver), 0.03, 0, 0.13, 0, 0.5, 0));
  return g;
}
/** A lace runner (transparent; draws once). */
export function laceRunner(w = 1.3, d = 0.3) {
  const W = 1024, H = 256, [c, g] = cv(W, H), r = rng(181);
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(248,240,226,0.82)';
  for (let x = 6; x < W; x += 12) for (let y = 30; y < H - 30; y += 12) { if ((Math.floor(x / 48) + Math.floor(y / 48)) % 2) { g.beginPath(); g.arc(x, y, 3.4, 0, TAU); g.fill(); } }
  g.fillStyle = 'rgba(248,240,226,0.9)'; g.fillRect(0, 22, W, 6); g.fillRect(0, H - 28, W, 6);
  for (let x = 0; x < W; x += 24) { g.beginPath(); g.arc(x + 12, 14, 11, Math.PI, 0); g.fill(); g.beginPath(); g.arc(x + 12, H - 14, 11, 0, Math.PI); g.fill(); }
  for (let i = 0; i < 6; i++) softBlot(g, r() * W, r() * H, 20 + r() * 30, 'rgba(160,120,70,A)', 0.2);
  const m = mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex(c), transparent: true, depthWrite: false, roughness: 0.95 }), { cast: false });
  m.renderOrder = 1; return noRay(m);
}
/** A small mahogany side table (rectangular, drop-leaf), with a lace doily. Origin: floor centre; front +Z. */
export function sideTableRect({ w = 0.74, d = 0.44, h = 0.68 } = {}) {
  const g = grp('sideTableRect');
  const wood = M.mahogany();
  const parts = [boxG(w, 0.025, d, 0, h - 0.0125, 0, 0.006), boxG(w - 0.08, 0.09, d - 0.08, 0, h - 0.07, 0, 0.004)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(latheG([[0, 0], [0.016, 0], [0.012, 0.05], [0.02, 0.1], [0.014, 0.3], [0.022, h - 0.14], [0.024, h - 0.12], [0, h - 0.12]], 10).translate(sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.05)));
  parts.push(boxG(w - 0.12, 0.012, 0.02, 0, 0.18, 0, 0.002));
  g.add(mergeInto(parts, wood));
  g.add(mesh(mergeG([new THREE.SphereGeometry(0.01, 8, 6).translate(0, h - 0.07, d / 2 - 0.04 + 0.006)]), M.brass(), { cast: false }));
  g.userData.topY = h;
  return g;
}
/** A turned jardinière stand. Origin: floor centre. userData.topY */
export function plantStand(h = 0.82) {
  const g = grp('plantStand');
  g.add(mesh(mergeG([latheG([[0, h - 0.02], [0.16, h - 0.02], [0.165, h], [0, h]], 32), latheG([[0, 0.06], [0.03, 0.06], [0.025, 0.2], [0.04, 0.32], [0.022, 0.5], [0.03, h - 0.06], [0.06, h - 0.02], [0, h - 0.02]], 16), ...[0, 1, 2].map((i) => tubeG([[0, 0.12, 0], [0.12, 0.06, 0], [0.2, 0.01, 0]], 0.016, { radial: 6, seg: 10 }).rotateY(i * TAU / 3))]), M.walnut()));
  g.userData.topY = h;
  return g;
}
/** The small card tucked in the lilies (front faces +Z). */
export function lilyCard() {
  const t = T.agedPaperTexture({ w: 256, h: 176, seed: 191, age: 0.55, tint: '#f2e8d4', key: 'dressing:lilycard', draw: (gg, W, H) => {
    gg.fillStyle = '#4a4a50'; gg.font = `bold 26px ${FONTS.fell}`; gg.textAlign = 'center'; gg.fillText('FOR CLOSING', W / 2, H * 0.42); gg.fillText('NIGHT.', W / 2, H * 0.62);
  } });
  const m = mesh(new THREE.PlaneGeometry(0.08, 0.055), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide }), { cast: false });
  return m;
}

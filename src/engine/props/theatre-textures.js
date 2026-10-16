// Theatre canvas textures (PROPS). Every generator returns a THREE.CanvasTexture (sRGB unless noted) and is cached
// by its options, so the same call twice shares one texture. Text defaults to IM Fell English (the engine loads the
// Google fonts before rooms build). Catalogue: docs/PROPS.md.
import * as THREE from 'three';
import { makeCanvas, canvasTexture, rng, wrapText } from './textures.js';

export const FONTS = {
  fell: '"IM Fell English", Georgia, serif',
  display: '"Abril Fatface", Didot, "Bodoni 72", Georgia, serif',
  typed: '"Special Elite", "Courier New", monospace',
  hand: '"CN Hand Caps", "Homemade Apple", "Segoe Script", cursive', // POLISH: legible capitals (ui.css @font-face)
  ui: 'Inter, system-ui, sans-serif',
};

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}
const K = (name, o) => name + ':' + JSON.stringify(o);

function shade(hex, amt) {
  const c = new THREE.Color(hex), hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amt, 0, 1));
  return '#' + c.getHexString();
}
function rgba(hex, a) { const c = new THREE.Color(hex); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; }

// ---- cheap noise: a small random canvas drawn scaled up (smooth blotches without per-pixel fbm at full size) ----
const noiseCanvases = new Map();
function noiseCanvas(seed = 1, n = 64) {
  const key = seed + ':' + n;
  if (noiseCanvases.has(key)) return noiseCanvases.get(key);
  const c = makeCanvas(n, n), g = c.getContext('2d'), r = rng(seed);
  const img = g.createImageData(n, n);
  for (let i = 0; i < n * n; i++) { const v = r() * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  noiseCanvases.set(key, c);
  return c;
}
/** Multiply/overlay blotchy noise over the whole canvas. octaves: list of [cells, alpha]. */
export function grime(g, w, h, { seed = 1, color = '#3a2a18', octaves = [[6, 0.18], [24, 0.1], [90, 0.06]], mode = 'multiply' } = {}) {
  g.save();
  g.imageSmoothingEnabled = true;
  octaves.forEach(([cells, a], i) => {
    const nc = noiseCanvas(seed + i * 17, Math.max(4, Math.round(cells)));
    // tint: draw noise into a temp, colourise
    const t = makeCanvas(nc.width, nc.height), tg = t.getContext('2d');
    tg.drawImage(nc, 0, 0);
    tg.globalCompositeOperation = 'multiply'; tg.fillStyle = color; tg.fillRect(0, 0, t.width, t.height);
    g.globalCompositeOperation = mode === 'screen' ? 'screen' : 'multiply';
    g.globalAlpha = a;
    g.drawImage(nc, 0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = a * 0.6;
    g.drawImage(t, 0, 0, w, h);
  });
  g.restore();
}
/** Speckle: n tiny dots (foxing, dust, paint flecks). */
function speckle(g, w, h, r, n, color, amax = 0.25, smax = 3) {
  for (let i = 0; i < n; i++) { g.fillStyle = rgba(color, r() * amax); const s = 0.6 + r() * smax; g.fillRect(r() * w, r() * h, s, s); }
}
function stain(g, x, y, rad, color = '#7a5020', a = 0.18) {
  const gr = g.createRadialGradient(x, y, rad * 0.55, x, y, rad);
  gr.addColorStop(0, rgba(color, a * 0.25)); gr.addColorStop(0.88, rgba(color, a)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
}
function vignette(g, w, h, color = '#5a3810', a = 0.35, inner = 0.45) {
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * inner, w / 2, h / 2, Math.hypot(w, h) * 0.55);
  gr.addColorStop(0, rgba(color, 0)); gr.addColorStop(1, rgba(color, a));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
function fitFont(g, text, maxW, size, family, weight = '') {
  let s = size;
  g.font = `${weight} ${s}px ${family}`;
  const tw = g.measureText(text).width;
  if (tw > maxW) { s = Math.floor(s * maxW / tw); g.font = `${weight} ${s}px ${family}`; }
  return s;
}
/** Paper fold creases (light + dark line pairs). */
function creases(g, w, h, r, { v = 1, hz = 1 } = {}) {
  for (let i = 0; i < v; i++) {
    const x = w * (i + 1) / (v + 1) + (r() - 0.5) * 6;
    g.fillStyle = 'rgba(80,50,20,0.16)'; g.fillRect(x, 0, 1.5, h);
    g.fillStyle = 'rgba(255,250,230,0.18)'; g.fillRect(x + 1.5, 0, 1.5, h);
  }
  for (let i = 0; i < hz; i++) {
    const y = h * (i + 1) / (hz + 1) + (r() - 0.5) * 6;
    g.fillStyle = 'rgba(80,50,20,0.16)'; g.fillRect(0, y, w, 1.5);
    g.fillStyle = 'rgba(255,250,230,0.18)'; g.fillRect(0, y + 1.5, w, 1.5);
  }
}
/** Torn/dog-eared corners: clears alpha in irregular nibbles (the canvas must allow alpha). */
function tearEdges(g, w, h, r, amount = 0.5) {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  const corners = [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]];
  for (const [cx, cy, sx, sy] of corners) {
    if (r() > amount) continue;
    const s = (0.04 + r() * 0.1) * Math.min(w, h);
    g.beginPath(); g.moveTo(cx, cy);
    let px = cx + sx * s * (1 + r()), py = cy;
    g.lineTo(px, py);
    for (let k = 0; k < 6; k++) { px -= sx * s * 0.25 * r(); py += sy * s * 0.25 * (0.5 + r()); g.lineTo(px, py); }
    g.lineTo(cx, cy + sy * s * (1 + r()));
    g.closePath(); g.fill();
  }
  // nibbles along the edges
  for (let i = 0; i < 40 * amount; i++) {
    const side = Math.floor(r() * 4), t = r();
    const x = side === 0 ? t * w : side === 1 ? w : side === 2 ? t * w : 0;
    const y = side === 0 ? 0 : side === 1 ? t * h : side === 2 ? h : t * h;
    g.beginPath(); g.arc(x, y, 1 + r() * 4, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// =====================================================================================================
// PAPER: posters, playbills, telegrams, prompt-book pages, ledgers, newspapers, photographs
// =====================================================================================================

/**
 * Aged paper ground (cream, foxed, vignetted). Draw on it yourself, or use the specific papers below.
 * Returns a texture; `draw(g, w, h, r)` paints on top before ageing grime is applied over everything.
 */
export function agedPaperTexture({ w = 512, h = 724, tint = '#efe3c2', seed = 3, age = 0.6, torn = 0, draw = null, key = null, fold = null } = {}) {
  const make = () => {
    const c = makeCanvas(w, h), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = tint; g.fillRect(0, 0, w, h);
    grime(g, w, h, { seed, color: '#b08850', octaves: [[5, 0.12 * age], [20, 0.08 * age], [80, 0.05 * age]] });
    if (draw) draw(g, w, h, r);
    // ageing over the print
    vignette(g, w, h, '#6a4418', 0.32 * age, 0.4);
    for (let i = 0; i < 3 + age * 5; i++) stain(g, r() * w, r() * h, 8 + r() * 50, '#8a5a22', 0.12 * age);
    speckle(g, w, h, r, 500 * age, '#6a4a20', 0.3, 2.5);
    if (fold) creases(g, w, h, r, fold);
    if (torn) tearEdges(g, w, h, r, torn);
    return canvasTexture(c);
  };
  if (draw && !key) return make();
  return cached(K('agedPaper', { w, h, tint, seed, age, torn, key, fold }), make);
}

/**
 * A theatre poster / bill. style:
 *  'playbill'  letterpress bill: cream, black and red, mixed type sizes, rules, stars (the TONIGHT bill)
 *  'bill'      plainer tall letterpress bill (two colours, big title)
 *  'review'    a framed press notice: newspaper-clipping column with a quote (lines) under a masthead (subtitle)
 *  'pictorial' lithograph: a painted panel (art: (g,x,y,w,h,r) => {}) above the title
 * title, subtitle, lines (array of strings; a line starting '*' is set in red display type, '~' in italic),
 * theatre (header), date (footer), accent (red), age 0..1, torn 0..1, seed, w/h px.
 */
export function posterTexture({ title = 'THE LAMP AT GULL POINT', subtitle = 'A Drama in Three Acts and a Storm', lines = [], style = 'playbill', theatre = 'EMPRESS THEATRE · PELHAM STREET', date = '', accent = '#a3201c', ink = '#1b120c', paper = '#eee0bc', age = 0.6, torn = 0, seed = 7, w = 512, h = 768, art = null } = {}) {
  const key = art ? null : K('poster', { title, subtitle, lines, style, theatre, date, accent, ink, paper, age, torn, seed, w, h });
  const draw = (g, W, H, r) => {
    const m = W * 0.06;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (style === 'review') {
      g.fillStyle = ink;
      fitFont(g, subtitle || 'THE PELHAM GAZETTE', W - m * 2, W * 0.09, FONTS.display);
      g.fillText(subtitle || 'THE PELHAM GAZETTE', W / 2, m + W * 0.09);
      g.fillRect(m, m + W * 0.12, W - m * 2, 3); g.fillRect(m, m + W * 0.135, W - m * 2, 1);
      g.font = `italic ${W * 0.045}px ${FONTS.fell}`;
      g.fillText(date || 'Monday, 2nd February, 1931', W / 2, m + W * 0.19);
      fitFont(g, title, W - m * 2, W * 0.1, FONTS.display);
      g.fillText(title, W / 2, H * 0.32);
      g.font = `${W * 0.052}px ${FONTS.fell}`; g.textAlign = 'left';
      let y = H * 0.4;
      for (const l of lines) {
        const it = l.startsWith('~');
        g.font = `${it ? 'italic ' : ''}${W * 0.05}px ${FONTS.fell}`;
        y = wrapText(g, it ? l.slice(1) : l, m * 1.4, y, W - m * 2.8, W * 0.065) + W * 0.02;
      }
      // column rules
      g.fillRect(m * 0.8, H * 0.37, 1, H * 0.55); g.fillRect(W - m * 0.8, H * 0.37, 1, H * 0.55);
      return;
    }
    // border rules (double), corner stars
    g.strokeStyle = ink; g.lineWidth = 4; g.strokeRect(m * 0.6, m * 0.6, W - m * 1.2, H - m * 1.2);
    g.lineWidth = 1.2; g.strokeRect(m * 0.85, m * 0.85, W - m * 1.7, H - m * 1.7);
    let y = m * 1.2;
    g.fillStyle = ink;
    g.font = `${W * 0.04}px ${FONTS.fell}`; g.fillText(theatre, W / 2, y + W * 0.04); y += W * 0.075;
    g.fillStyle = accent; g.fillRect(W * 0.2, y, W * 0.6, 3); y += W * 0.03;
    if (style === 'pictorial') {
      const ph = H * 0.42, pw = W - m * 2.4;
      g.save(); g.beginPath(); g.rect(m * 1.2, y, pw, ph); g.clip();
      if (art) art(g, m * 1.2, y, pw, ph, r);
      else { const gr = g.createLinearGradient(0, y, 0, y + ph); gr.addColorStop(0, '#1d2c4a'); gr.addColorStop(1, '#5a7a8a'); g.fillStyle = gr; g.fillRect(m * 1.2, y, pw, ph); }
      g.restore();
      g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(m * 1.2, y, pw, ph);
      y += ph + W * 0.03;
    }
    if (style === 'playbill') {
      g.fillStyle = ink; g.font = `italic ${W * 0.05}px ${FONTS.fell}`;
      g.fillText('for one night only', W / 2, y + W * 0.05); y += W * 0.08;
    }
    // title: split long titles over lines, biggest display type that fits
    g.fillStyle = style === 'bill' ? ink : accent;
    const words = title.split(' ');
    const tl = [];
    if (title.length > 14 && words.length > 2) {
      const mid = Math.ceil(words.length / 2);
      tl.push(words.slice(0, mid).join(' '), words.slice(mid).join(' '));
    } else tl.push(title);
    for (const t of tl) {
      const s = fitFont(g, t, W - m * 2.6, W * (style === 'pictorial' ? 0.1 : 0.14), FONTS.display);
      g.fillText(t, W / 2, y + s); y += s * 1.08;
    }
    y += W * 0.01;
    if (subtitle) {
      g.fillStyle = ink; g.font = `italic ${W * 0.048}px ${FONTS.fell}`;
      y = wrapText(g, subtitle, W / 2, y + W * 0.05, W - m * 3, W * 0.058);
    }
    g.fillStyle = ink; g.fillText('✦  ✦  ✦', W / 2, y + W * 0.03); y += W * 0.07;
    for (const l of lines) {
      if (l.startsWith('*')) {
        g.fillStyle = accent; const s = fitFont(g, l.slice(1), W - m * 2.6, W * 0.075, FONTS.display);
        g.fillText(l.slice(1), W / 2, y + s); y += s * 1.25;
      } else if (l.startsWith('~')) {
        g.fillStyle = ink; g.font = `italic ${W * 0.042}px ${FONTS.fell}`;
        y = wrapText(g, l.slice(1), W / 2, y + W * 0.045, W - m * 3, W * 0.05) + W * 0.005;
      } else if (l === '---') {
        g.fillStyle = ink; g.fillRect(W * 0.3, y + W * 0.015, W * 0.4, 1.5); y += W * 0.04;
      } else {
        g.fillStyle = ink; fitFont(g, l, W - m * 2.6, W * 0.05, FONTS.fell);
        g.fillText(l, W / 2, y + W * 0.05); y += W * 0.065;
      }
    }
    if (date) {
      g.fillStyle = ink; g.fillRect(m * 1.2, H - m * 2.3, W - m * 2.4, 1.5);
      g.font = `${W * 0.038}px ${FONTS.fell}`; g.fillText(date, W / 2, H - m * 1.45);
    }
    // registration slip: red slightly offset overprint feel
    g.globalAlpha = 0.05; g.fillStyle = accent; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  };
  const make = () => agedPaperTexture({ w, h, tint: paper, seed, age, torn, draw, key: key || undefined, fold: style === 'review' ? { v: 0, hz: 1 } : null });
  return key ? cached(key, make) : make();
}
/** A small playbill / programme card (portrait), shorthand for posterTexture({ style: 'playbill' }). */
export const playbillTexture = (o = {}) => posterTexture({ style: 'playbill', w: 384, h: 576, ...o });

/**
 * Post Office telegram form: buff paper, printed header and boxes, white strip-tape pasted with capitals.
 * lines: strings for the tape strips; to, from, office, time (handed-in).
 */
export function telegramTexture({ lines = ['REGRET CANNOT PAY COMPANY', 'CANCEL TONIGHT SORRY', 'CRANE'], to = 'PIKE EMPRESS THEATRE PELHAM', office = 'PELHAM ST STN', time = '6.40 PM', seed = 11, age = 0.5, w = 640, h = 440, burnt = 0 } = {}) {
  return cached(K('telegram', { lines, to, office, time, seed, age, w, h, burnt }), () => {
    const draw = (g, W, H, r) => {
      const ink = '#3a2a1c';
      g.fillStyle = ink; g.textAlign = 'center';
      g.font = `${W * 0.028}px ${FONTS.fell}`; g.fillText('POST OFFICE', W / 2, H * 0.08);
      g.font = `${W * 0.07}px ${FONTS.display}`; g.fillText('TELEGRAM', W / 2, H * 0.19);
      g.fillRect(W * 0.05, H * 0.23, W * 0.9, 2);
      g.textAlign = 'left'; g.font = `${W * 0.022}px ${FONTS.fell}`;
      g.fillText(`Office of Origin: ${office}`, W * 0.06, H * 0.29);
      g.fillText(`Handed in at ${time}`, W * 0.6, H * 0.29);
      g.strokeStyle = rgba(ink, 0.6); g.lineWidth = 1;
      g.strokeRect(W * 0.05, H * 0.32, W * 0.9, H * 0.6);
      g.fillText('TO', W * 0.07, H * 0.38);
      // pasted tape strips
      const strips = [to, ...lines];
      strips.forEach((s, i) => {
        const y = H * (0.36 + i * 0.105) + (i ? H * 0.04 : 0);
        g.font = `${W * 0.034}px ${FONTS.typed}`;
        const tw = g.measureText(s).width + W * 0.04;
        const x = W * (i ? 0.08 : 0.14) + (r() - 0.5) * 6;
        g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.012);
        g.fillStyle = '#f6f2e6'; g.fillRect(0, -H * 0.045, tw, H * 0.068);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, H * 0.023, tw, 2);
        g.fillStyle = '#1a1612'; g.fillText(s, W * 0.02, H * 0.008);
        g.restore();
      });
      g.font = `${W * 0.018}px ${FONTS.fell}`; g.fillStyle = ink;
      g.fillText('For free repetition of doubtful words telephone "TELEGRAMS ENQUIRY"', W * 0.06, H * 0.97);
      if (burnt) {
        // charred edge from the bottom-right
        const gr = g.createRadialGradient(W, H, W * 0.1, W, H, W * (0.3 + burnt * 0.7));
        gr.addColorStop(0, 'rgba(10,6,2,1)'); gr.addColorStop(0.55, 'rgba(30,14,4,0.95)'); gr.addColorStop(0.8, 'rgba(120,60,10,0.6)'); gr.addColorStop(1, 'rgba(120,60,10,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
    };
    return agedPaperTexture({ w, h, tint: '#e2c98f', seed, age, draw, key: 'tg' + seed + lines.join('|') + burnt, fold: { v: 1, hz: 1 } });
  });
}

/**
 * Prompt-book page: typed text on cream with pencil annotations.
 * heading (typed, underlined), lines (typed), pencil: [{ text, x (0..1), y (0..1), rot }], page (number, top right).
 */
export function promptPageTexture({ heading = 'ACT III  Sc.2  -  GULL POINT', lines = [], pencil = [], page = 97, seed = 13, w = 512, h = 700, age = 0.45 } = {}) {
  return cached(K('prompt', { heading, lines, pencil, page, seed, w, h, age }), () => {
    const draw = (g, W, H, r) => {
      g.fillStyle = '#26201a'; g.textAlign = 'right'; g.font = `${W * 0.03}px ${FONTS.typed}`;
      g.fillText(`p.${page}`, W * 0.92, H * 0.06);
      g.textAlign = 'left'; g.font = `${W * 0.036}px ${FONTS.typed}`;
      g.fillText(heading, W * 0.1, H * 0.12);
      g.fillRect(W * 0.1, H * 0.13, g.measureText(heading).width, 1.5);
      g.font = `${W * 0.03}px ${FONTS.typed}`;
      let y = H * 0.19;
      for (const l of lines) {
        g.globalAlpha = 0.82 + r() * 0.18; // uneven ribbon
        y = wrapText(g, l, W * 0.1, y, W * 0.8, W * 0.045);
      }
      g.globalAlpha = 1;
      // margin rule + binding holes
      g.fillStyle = 'rgba(160,40,40,0.35)'; g.fillRect(W * 0.07, 0, 1.5, H);
      for (const yy of [0.15, 0.5, 0.85]) { g.fillStyle = 'rgba(60,40,20,0.5)'; g.beginPath(); g.arc(W * 0.035, H * yy, W * 0.012, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(70,70,78,0.85)'; g.font = `${W * 0.03}px ${FONTS.hand}`;
      for (const p of pencil) {
        g.save(); g.translate(W * (p.x ?? 0.6), H * (p.y ?? 0.5)); g.rotate(p.rot ?? -0.04);
        wrapText(g, p.text, 0, 0, W * (p.w ?? 0.35), W * 0.05);
        g.restore();
      }
    };
    return agedPaperTexture({ w, h, tint: '#f1e8cf', seed, age, draw, key: 'pp' + page + seed + heading });
  });
}

/**
 * Ledger page (sign-in book): ruled columns, a printed heading, handwritten entries.
 * columns: header strings; rows: arrays of cell strings (handwritten); ruled: row count.
 */
export function ledgerPageTexture({ title = 'SIGN IN', columns = ['Name', 'In', 'Out'], widths = null, rows = [], ruled = 18, seed = 17, w = 512, h = 680, age = 0.5, hand = FONTS.hand, ink = '#2a2440' } = {}) {
  return cached(K('ledger', { title, columns, widths, rows, ruled, seed, w, h, age, ink }), () => {
    const draw = (g, W, H, r) => {
      const top = H * 0.13, rowH = (H * 0.84) / ruled;
      g.fillStyle = '#5a2a20'; g.textAlign = 'center'; g.font = `${W * 0.05}px ${FONTS.fell}`;
      g.fillText(title, W / 2, H * 0.07);
      const ws = widths || columns.map(() => 1 / columns.length);
      let x = W * 0.06; const xs = [];
      for (const f of ws) { xs.push(x); x += f * W * 0.88; }
      xs.push(W * 0.94);
      g.strokeStyle = 'rgba(70,90,150,0.45)'; g.lineWidth = 1;
      for (let i = 0; i <= ruled; i++) { g.beginPath(); g.moveTo(W * 0.06, top + i * rowH); g.lineTo(W * 0.94, top + i * rowH); g.stroke(); }
      g.strokeStyle = 'rgba(170,40,40,0.5)';
      for (const xx of xs) { g.beginPath(); g.moveTo(xx, top - rowH * 0.8); g.lineTo(xx, top + ruled * rowH); g.stroke(); }
      g.fillStyle = '#5a2a20'; g.font = `${W * 0.03}px ${FONTS.fell}`; g.textAlign = 'left';
      columns.forEach((c, i) => g.fillText(c, xs[i] + 4, top - rowH * 0.2));
      g.fillStyle = ink;
      rows.forEach((row, ri) => {
        row.forEach((cell, ci) => {
          if (!cell) return;
          g.font = `${Math.min(rowH * 0.5, W * 0.03)}px ${hand}`;
          g.save(); g.translate(xs[ci] + 6, top + (ri + 1) * rowH - rowH * 0.22); g.rotate((r() - 0.5) * 0.03);
          g.fillText(cell, 0, 0); g.restore();
        });
      });
    };
    return agedPaperTexture({ w, h, tint: '#efe6cc', seed, age, draw, key: 'ld' + seed + title });
  });
}

/** Newspaper front page (the Pelham Gazette): masthead, date line, headline, sub, fake columns. */
export function newspaperTexture({ masthead = 'THE PELHAM GAZETTE', date = 'SUNDAY, 15 MARCH 2026', headline = 'EMPRESS TRIUMPH', sub = '', price = 'ONE PENNY', seed = 23, w = 768, h = 1024, age = 0.2 } = {}) {
  return cached(K('news', { masthead, date, headline, sub, price, seed, w, h, age }), () => {
    const draw = (g, W, H, r) => {
      const m = W * 0.05; g.fillStyle = '#141210'; g.textAlign = 'center';
      fitFont(g, masthead, W - m * 2, W * 0.1, FONTS.display); g.fillText(masthead, W / 2, m + W * 0.09);
      g.fillRect(m, m + W * 0.115, W - m * 2, 4);
      g.font = `${W * 0.022}px ${FONTS.fell}`; g.textAlign = 'left'; g.fillText(date, m, m + W * 0.15);
      g.textAlign = 'right'; g.fillText(price, W - m, m + W * 0.15);
      g.fillRect(m, m + W * 0.163, W - m * 2, 1.5);
      g.textAlign = 'center';
      const hl = headline.split('\n');
      let y = m + W * 0.25;
      for (const l of hl) { const s = fitFont(g, l, W - m * 2, W * 0.095, FONTS.display); g.fillText(l, W / 2, y + s * 0.4); y += s * 1.05; }
      if (sub) { g.font = `italic ${W * 0.035}px ${FONTS.fell}`; y = wrapText(g, sub, W / 2, y + W * 0.03, W - m * 4, W * 0.045); }
      // columns of grey "text"
      const cols = 4, cw = (W - m * 2 - (cols - 1) * m * 0.5) / cols;
      for (let c = 0; c < cols; c++) {
        const x0 = m + c * (cw + m * 0.5);
        for (let yy = y + W * 0.04; yy < H - m; yy += W * 0.016) {
          if (r() < 0.05) { yy += W * 0.012; continue; }
          g.fillStyle = `rgba(20,18,16,${0.35 + r() * 0.2})`;
          g.fillRect(x0, yy, cw * (r() < 0.12 ? 0.4 + r() * 0.5 : 1), W * 0.007);
        }
        if (c) { g.fillStyle = 'rgba(20,18,16,0.6)'; g.fillRect(x0 - m * 0.25, y + W * 0.03, 1, H - y - m * 1.2); }
      }
    };
    return agedPaperTexture({ w, h, tint: '#ece6d6', seed, age, draw, key: 'np' + seed + headline });
  });
}

/**
 * Sepia photograph with a white border: subject 'company' (rows of figures), 'portrait' (one lady, big hair),
 * 'stage' (a set with a lighthouse), 'cat'. caption: written in the margin.
 */
export function sepiaPhotoTexture({ subject = 'company', caption = '', seed = 31, w = 512, h = 384, border = 0.05 } = {}) {
  return cached(K('sepia', { subject, caption, seed, w, h, border }), () => {
    const c = makeCanvas(w, h), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, h);
    const b = Math.min(w, h) * border, cap = caption ? h * 0.1 : 0;
    const x0 = b, y0 = b, pw = w - b * 2, ph = h - b * 2 - cap;
    const bg = g.createLinearGradient(0, y0, 0, y0 + ph);
    bg.addColorStop(0, '#8a6a48'); bg.addColorStop(0.6, '#5e4630'); bg.addColorStop(1, '#3a2a1c');
    g.fillStyle = bg; g.fillRect(x0, y0, pw, ph);
    g.save(); g.beginPath(); g.rect(x0, y0, pw, ph); g.clip();
    const fig = (x, y, s, dark = '#2a1c12', hat = false, gown = false) => {
      g.fillStyle = dark;
      g.beginPath(); g.ellipse(x, y - s * 0.62, s * 0.11, s * 0.13, 0, 0, Math.PI * 2); g.fill(); // head
      if (hat) { g.fillRect(x - s * 0.16, y - s * 0.76, s * 0.32, s * 0.04); g.fillRect(x - s * 0.09, y - s * 0.86, s * 0.18, s * 0.11); }
      g.beginPath();
      if (gown) { g.moveTo(x - s * 0.12, y - s * 0.5); g.lineTo(x + s * 0.12, y - s * 0.5); g.lineTo(x + s * 0.34, y + s * 0.4); g.lineTo(x - s * 0.34, y + s * 0.4); }
      else { g.moveTo(x - s * 0.2, y - s * 0.48); g.lineTo(x + s * 0.2, y - s * 0.48); g.lineTo(x + s * 0.17, y + s * 0.4); g.lineTo(x - s * 0.17, y + s * 0.4); }
      g.fill();
    };
    if (subject === 'company') {
      // backdrop + three rows of figures
      g.fillStyle = 'rgba(40,28,18,0.4)'; g.fillRect(x0, y0 + ph * 0.7, pw, ph * 0.3);
      for (let row = 0; row < 3; row++) {
        const n = 6 + row, s = ph * (0.36 + row * 0.06), y = y0 + ph * (0.5 + row * 0.16);
        for (let i = 0; i < n; i++) {
          const x = x0 + pw * ((i + 0.5) / n) + (r() - 0.5) * 6;
          const tone = ['#2a1c12', '#3a2818', '#4a3420', '#e0cfae'][Math.floor(r() * (row === 2 ? 4 : 3))];
          fig(x, y, s, tone, r() < 0.3, r() < 0.4);
        }
      }
    } else if (subject === 'portrait') {
      const cx = x0 + pw / 2, cy = y0 + ph * 0.55;
      const gr = g.createRadialGradient(cx, cy - ph * 0.1, 10, cx, cy, ph * 0.8);
      gr.addColorStop(0, '#a88a64'); gr.addColorStop(1, '#3a2a1c'); g.fillStyle = gr; g.fillRect(x0, y0, pw, ph);
      g.fillStyle = '#5a3a24'; g.beginPath(); g.ellipse(cx, cy - ph * 0.3, ph * 0.17, ph * 0.13, 0, 0, Math.PI * 2); g.fill(); // hair
      g.fillStyle = '#d8c09a'; g.beginPath(); g.ellipse(cx, cy - ph * 0.16, ph * 0.09, ph * 0.12, 0, 0, Math.PI * 2); g.fill(); // face
      g.fillStyle = '#efe2c4'; g.fillRect(cx - ph * 0.005, cy - ph * 0.55, ph * 0.01, ph * 0.18); // aigrette
      g.fillStyle = '#c8b090'; g.beginPath(); g.moveTo(cx - ph * 0.22, y0 + ph); g.quadraticCurveTo(cx, cy - ph * 0.1, cx + ph * 0.22, y0 + ph); g.fill(); // shoulders/gown
      g.fillStyle = '#efe2c4'; for (let i = 0; i < 14; i++) { const a = Math.PI * (0.15 + 0.7 * i / 13); g.beginPath(); g.arc(cx + Math.cos(a) * ph * 0.1, cy + Math.sin(a) * ph * 0.08 - ph * 0.02, 2.2, 0, Math.PI * 2); g.fill(); } // pearls
    } else if (subject === 'stage') {
      g.fillStyle = '#2a1c12'; g.fillRect(x0, y0 + ph * 0.75, pw, ph * 0.25);
      g.fillStyle = '#c8b08a'; const lx = x0 + pw * 0.62;
      g.beginPath(); g.moveTo(lx - pw * 0.06, y0 + ph * 0.78); g.lineTo(lx - pw * 0.035, y0 + ph * 0.2); g.lineTo(lx + pw * 0.035, y0 + ph * 0.2); g.lineTo(lx + pw * 0.06, y0 + ph * 0.78); g.fill();
      g.fillStyle = '#7a5a3a'; for (let k = 0; k < 3; k++) g.fillRect(lx - pw * 0.05, y0 + ph * (0.3 + k * 0.16), pw * 0.1, ph * 0.06);
      g.fillStyle = '#f2e6c8'; g.beginPath(); g.arc(lx, y0 + ph * 0.15, ph * 0.05, 0, Math.PI * 2); g.fill();
      fig(x0 + pw * 0.35, y0 + ph * 0.72, ph * 0.5, '#d8c4a0', false, true);
    } else if (subject === 'cat') {
      g.fillStyle = '#4a3a2a'; g.beginPath(); g.ellipse(x0 + pw / 2, y0 + ph * 0.7, pw * 0.2, ph * 0.18, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x0 + pw / 2, y0 + ph * 0.45, ph * 0.13, 0, Math.PI * 2); g.fill();
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x0 + pw / 2 + s * ph * 0.05, y0 + ph * 0.35); g.lineTo(x0 + pw / 2 + s * ph * 0.12, y0 + ph * 0.25); g.lineTo(x0 + pw / 2 + s * ph * 0.13, y0 + ph * 0.4); g.fill(); }
    }
    g.restore();
    // silver fade + grain + vignette inside the print
    g.save(); g.beginPath(); g.rect(x0, y0, pw, ph); g.clip();
    grime(g, w, h, { seed, color: '#704a20', octaves: [[8, 0.15], [120, 0.12]], mode: 'screen' });
    const vg = g.createRadialGradient(w / 2, y0 + ph / 2, ph * 0.3, w / 2, y0 + ph / 2, ph * 0.9);
    vg.addColorStop(0, 'rgba(30,18,8,0)'); vg.addColorStop(1, 'rgba(30,18,8,0.55)'); g.fillStyle = vg; g.fillRect(x0, y0, pw, ph);
    g.restore();
    if (caption) { g.fillStyle = '#3a2a3a'; g.textAlign = 'center'; g.font = `${h * 0.05}px ${FONTS.hand}`; g.fillText(caption, w / 2, h - b - cap * 0.25); }
    speckle(g, w, h, r, 300, '#6a4a20', 0.25, 2);
    return canvasTexture(c);
  });
}

// =====================================================================================================
// SURFACES: velvet, marble, gilt, brass tarnish, plaster, floorboards, brick, linoleum, wallpaper, canvas cloth
// =====================================================================================================

/** Velvet nap: vertical crushed-pile streaks and worn patches. Tile it (repeat) on curtains and seats. */
export function velvetTexture({ color = '#7a1820', seed = 5, size = 256, wear = 0.3 } = {}) {
  return cached(K('velvet', { color, seed, size, wear }), () => {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = color; g.fillRect(0, 0, size, size);
    for (let i = 0; i < 90; i++) {
      const x = r() * size, wd = 1 + r() * 4;
      g.fillStyle = r() < 0.5 ? rgba(shade(color, 0.06), 0.1 + r() * 0.15) : rgba(shade(color, -0.06), 0.1 + r() * 0.15);
      g.fillRect(x, 0, wd, size);
    }
    // crushed pile blotches
    grime(g, size, size, { seed, color: shade(color, -0.15), octaves: [[4, 0.25], [12, 0.15]] });
    // worn bald patches (lighter, pinker)
    for (let i = 0; i < wear * 6; i++) stain(g, r() * size, r() * size, 10 + r() * 30, shade(color, 0.15), 0.25 * wear);
    // fine speckle of the pile
    speckle(g, size, size, r, 1400, shade(color, 0.2), 0.2, 1.2);
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

/** Aged marble: soft cloudy ground with branching veins. */
export function marbleTexture({ base = '#e6dfd2', vein = '#8a8076', seed = 9, size = 512, veins = 9, dirt = 0.4 } = {}) {
  return cached(K('marble', { base, vein, seed, size, veins, dirt }), () => {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, size, size);
    grime(g, size, size, { seed, color: shade(base, -0.12), octaves: [[3, 0.3], [9, 0.2], [30, 0.08]] });
    const vein1 = (x, y, a, len, wd, alpha, depth) => {
      g.strokeStyle = rgba(vein, alpha); g.lineWidth = wd; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < len; s += 6) {
        a += (r() - 0.5) * 0.5; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y);
        if (depth < 2 && r() < 0.025) { g.stroke(); vein1(x, y, a + (r() - 0.5) * 1.6, len * 0.4, wd * 0.6, alpha * 0.8, depth + 1); g.strokeStyle = rgba(vein, alpha); g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); }
      }
      g.stroke();
    };
    for (let i = 0; i < veins; i++) {
      const a = 0.6 + (r() - 0.5) * 0.6;
      vein1(r() * size - size * 0.3, r() * size, a, size * (0.8 + r()), 0.8 + r() * 2.4, 0.25 + r() * 0.35, 0);
    }
    g.filter = 'blur(1.5px)'; g.globalAlpha = 0.5; g.drawImage(c, 0, 0); g.filter = 'none'; g.globalAlpha = 1;
    if (dirt) grime(g, size, size, { seed: seed + 3, color: '#6a5a40', octaves: [[5, 0.12 * dirt], [40, 0.06 * dirt]] });
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

/**
 * Gilt plasterwork: gold leaf with rubbed-through red bole on the high spots, grime in the recesses.
 * pattern: 'plain' | 'moulding' (horizontal bead-and-reel bands) | 'acanthus' (scrolls) | 'panel' (sunk panel border).
 * Use as `map` on a metal-ish material (see materials.gilt()).
 */
export function giltTexture({ pattern = 'acanthus', seed = 4, size = 512, base = '#c9a24a', bole = '#8a3a22', grimeAmt = 0.5 } = {}) {
  return cached(K('gilt', { pattern, seed, size, base, bole, grimeAmt }), () => {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = rng(seed);
    const gr = g.createLinearGradient(0, 0, size, size);
    gr.addColorStop(0, shade(base, 0.06)); gr.addColorStop(0.5, base); gr.addColorStop(1, shade(base, -0.05));
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    const hi = shade(base, 0.16), lo = shade(base, -0.22);
    const relief = (path) => { // fake raised relief: dark offset + highlight offset + base
      g.save(); g.translate(2, 3); g.strokeStyle = rgba(lo, 0.9); path(); g.restore();
      g.save(); g.translate(-1.5, -1.5); g.strokeStyle = rgba(hi, 0.9); path(); g.restore();
      g.strokeStyle = base; path();
    };
    g.lineCap = 'round';
    if (pattern === 'moulding' || pattern === 'panel') {
      const bands = pattern === 'panel' ? [0.08, 0.92] : [0.15, 0.5, 0.85];
      for (const v of bands) {
        const y = size * v;
        g.lineWidth = 7; relief(() => { g.beginPath(); g.moveTo(0, y); g.lineTo(size, y); g.stroke(); });
        // bead and reel
        g.lineWidth = 5;
        for (let x = 6; x < size; x += 24) relief(() => { g.beginPath(); g.ellipse(x, y + 12, 6, 4, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(x + 12, y + 9); g.lineTo(x + 12, y + 15); g.stroke(); });
      }
      if (pattern === 'panel') {
        g.lineWidth = 6;
        relief(() => { g.strokeRect(size * 0.12, size * 0.16, size * 0.76, size * 0.68); });
        g.lineWidth = 3;
        relief(() => { g.strokeRect(size * 0.15, size * 0.19, size * 0.7, size * 0.62); });
      }
    } else if (pattern === 'acanthus') {
      // running scroll: S-curves with curled leaves
      g.lineWidth = 6;
      for (let row = 0; row < 2; row++) {
        const cy = size * (0.25 + row * 0.5);
        relief(() => {
          g.beginPath();
          for (let x = -size * 0.1; x <= size * 1.1; x += 4) g.lineTo(x, cy + Math.sin(x / size * Math.PI * 4 + row) * size * 0.1);
          g.stroke();
        });
        for (let k = 0; k < 4; k++) {
          const x = size * (k + 0.25) / 4, y = cy + Math.sin((x / size) * Math.PI * 4 + row) * size * 0.1;
          const dir = k % 2 ? 1 : -1;
          g.lineWidth = 5;
          relief(() => { g.beginPath(); g.arc(x + 18, y + dir * 26, 22, 0, Math.PI * 1.6 * dir, dir < 0); g.stroke(); });
          g.lineWidth = 4;
          relief(() => { g.beginPath(); g.ellipse(x - 16, y - dir * 20, 18, 7, dir * 0.8, 0, Math.PI * 2); g.stroke(); });
          relief(() => { g.beginPath(); g.arc(x + 18 + 10, y + dir * 26, 6, 0, Math.PI * 2); g.stroke(); });
        }
      }
    }
    // rubbed-through bole on edges/high spots
    for (let i = 0; i < 40; i++) stain(g, r() * size, r() * size, 3 + r() * 12, bole, 0.35);
    // grime in recesses
    grime(g, size, size, { seed, color: '#3a2810', octaves: [[6, 0.22 * grimeAmt], [24, 0.15 * grimeAmt], [100, 0.1 * grimeAmt]] });
    speckle(g, size, size, r, 600, '#fff2c0', 0.2, 1.5);
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

/** Tarnished brass colour map (bright where handled, brown-green patina in patches). Use with metalness 1. */
export function brassTexture({ base = '#c9a24a', patina = '#5a5a30', amount = 0.5, seed = 6, size = 256 } = {}) {
  return cached(K('brassTex', { base, patina, amount, seed, size }), () => {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, size, size);
    for (let i = 0; i < 120; i++) { g.fillStyle = rgba(r() < 0.5 ? shade(base, 0.1) : shade(base, -0.1), 0.2); g.fillRect(0, r() * size, size, 1 + r() * 2); } // brushed
    grime(g, size, size, { seed, color: patina, octaves: [[4, 0.5 * amount], [14, 0.35 * amount], [50, 0.2 * amount]] });
    for (let i = 0; i < 18 * amount; i++) stain(g, r() * size, r() * size, 4 + r() * 18, '#3a4a30', 0.3 * amount);
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

/** Worn plaster: tinted, mottled, hairline cracks, water stains, optional dado (lower band in another paint). */
export function wornPlasterTexture({ tint = '#d8c9a0', seed = 21, size = 512, cracks = 3, stains = 3, dado = null, dadoH = 0.35, rail = '#3a2a1a' } = {}) {
  return cached(K('wplaster', { tint, seed, size, cracks, stains, dado, dadoH, rail }), () => {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = tint; g.fillRect(0, 0, size, size);
    grime(g, size, size, { seed, color: shade(tint, -0.2), octaves: [[4, 0.18], [16, 0.12], [64, 0.08]] });
    for (let i = 0; i < stains; i++) {
      const x = r() * size, y = r() * size * 0.6;
      const gr = g.createLinearGradient(x, y, x, y + size * 0.4);
      gr.addColorStop(0, rgba('#8a6a30', 0.0)); gr.addColorStop(0.3, rgba('#8a6a30', 0.15)); gr.addColorStop(1, rgba('#8a6a30', 0));
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y + size * 0.2, 20 + r() * 40, size * 0.2, 0, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(60,45,30,0.45)'; g.lineWidth = 1;
    for (let i = 0; i < cracks; i++) {
      let x = r() * size, y = r() * size; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 20; k++) { x += (r() - 0.5) * 18; y += 4 + r() * 10; g.lineTo(x, y); }
      g.stroke();
    }
    if (dado) {
      const y0 = size * (1 - dadoH);
      g.fillStyle = dado; g.fillRect(0, y0, size, size - y0);
      // gloss paint: chips showing the cream undercoat
      for (let i = 0; i < 30; i++) { g.fillStyle = rgba(tint, 0.6 + r() * 0.4); const s = 2 + r() * 6; g.beginPath(); g.ellipse(r() * size, y0 + r() * (size - y0), s, s * 0.6, r() * 3, 0, Math.PI * 2); g.fill(); }
      grime(g, size, size, { seed: seed + 5, color: '#1a120a', octaves: [[8, 0.12], [30, 0.08]] });
      g.fillStyle = rail; g.fillRect(0, y0 - 6, size, 10); g.fillStyle = 'rgba(255,240,200,0.15)'; g.fillRect(0, y0 - 6, size, 2);
      // scuffs at the bottom
      for (let i = 0; i < 25; i++) { g.fillStyle = 'rgba(20,14,8,0.25)'; g.fillRect(r() * size, size - 10 - r() * 40, 10 + r() * 40, 1 + r() * 2); }
    }
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

/**
 * Floorboards with scuffs: tint (stage black is '#2a2826'), planks (seams across V), scuffs (0..1),
 * paint (drops of scene paint), tape (bits of old spike tape colours array).
 */
export function scuffedFloorTexture({ tint = '#2c2a27', planks = 8, scuffs = 0.7, paint = 0.4, tape = ['#c8302a', '#e0c030', '#3060c0', '#e8e4d8'], seed = 33, size = 1024 } = {}) {
  return cached(K('sfloor', { tint, planks, scuffs, paint, tape, seed, size }), () => {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = rng(seed);
    const ph = size / planks;
    for (let p = 0; p < planks; p++) {
      g.fillStyle = shade(tint, (r() - 0.5) * 0.05); g.fillRect(0, p * ph, size, ph);
      // grain streaks along U
      for (let i = 0; i < 40; i++) { g.fillStyle = rgba(r() < 0.5 ? shade(tint, 0.05) : shade(tint, -0.05), 0.4); g.fillRect(0, p * ph + r() * ph, size, 1 + r() * 2); }
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, p * ph, size, 2);
      const jx = r() * size; g.fillRect(jx, p * ph, 2, ph);
      // nail heads at the joints
      g.fillStyle = 'rgba(120,120,120,0.5)';
      for (const xx of [jx - 8, jx + 8]) { g.fillRect(xx, p * ph + ph * 0.25, 3, 3); g.fillRect(xx, p * ph + ph * 0.7, 3, 3); }
    }
    // scuffs: grey arcs where scenery and feet have dragged
    g.lineCap = 'round';
    for (let i = 0; i < 160 * scuffs; i++) {
      g.strokeStyle = `rgba(150,145,135,${0.05 + r() * 0.12})`; g.lineWidth = 1 + r() * 5;
      const x = r() * size, y = r() * size, rad = 20 + r() * 160, a = r() * 6;
      g.beginPath(); g.arc(x, y, rad, a, a + 0.2 + r() * 0.8); g.stroke();
    }
    grime(g, size, size, { seed, color: '#8a8478', octaves: [[5, 0.12 * scuffs], [20, 0.08 * scuffs]], mode: 'screen' });
    for (let i = 0; i < 30 * paint; i++) { const col = ['#d8d0b8', '#3a5a8a', '#8a3a2a', '#c8a040', '#5a7a4a'][Math.floor(r() * 5)]; g.fillStyle = rgba(col, 0.5 + r() * 0.4); g.beginPath(); g.arc(r() * size, r() * size, 1 + r() * 4, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < tape.length * 2; i++) {
      g.save(); g.translate(r() * size, r() * size); g.rotate(Math.floor(r() * 4) * Math.PI / 2 + (r() - 0.5) * 0.05);
      g.fillStyle = rgba(tape[i % tape.length], 0.5 + r() * 0.3); g.fillRect(0, 0, 8 + r() * 30, 7); g.restore();
    }
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

/** Brick wall (stage back wall, the lightwell outside the dressing-room window). paint: null or a colour washed over. */
export function brickTexture({ tint = '#7a3a2a', mortar = '#4a4038', paint = null, paintAmt = 0.8, soot = 0.3, seed = 41, size = 512, rows = 12, cols = 4 } = {}) {
  return cached(K('brick', { tint, mortar, paint, paintAmt, soot, seed, size, rows, cols }), () => {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = mortar; g.fillRect(0, 0, size, size);
    const bh = size / rows, bw = size / cols;
    for (let row = 0; row < rows; row++) for (let col = -1; col <= cols; col++) {
      const x = (col + (row % 2) * 0.5) * bw, y = row * bh;
      g.fillStyle = shade(tint, (r() - 0.5) * 0.14);
      g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 2, y + bh - 5, bw - 4, 3);
    }
    grime(g, size, size, { seed, color: '#2a1a10', octaves: [[6, 0.2], [30, 0.12]] });
    if (paint) {
      g.globalAlpha = paintAmt; g.fillStyle = paint; g.fillRect(0, 0, size, size); g.globalAlpha = 1;
      // mortar lines still read through paint
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let row = 0; row <= rows; row++) g.fillRect(0, row * bh - 1, size, 3);
      for (let row = 0; row < rows; row++) for (let col = 0; col <= cols; col++) g.fillRect((col + (row % 2) * 0.5) * bw - 1, row * bh, 3, bh);
      for (let i = 0; i < 20; i++) stain(g, r() * size, r() * size, 6 + r() * 20, tint, 0.3); // flaking
    }
    if (soot) grime(g, size, size, { seed: seed + 9, color: '#000', octaves: [[3, 0.3 * soot]] });
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

/** Linoleum: flat brown with a faint marbling and an optional worn path (a lighter band along V at pathX). */
export function linoleumTexture({ tint = '#6a4630', seed = 51, size = 512, path = 0.5, tiles = 0 } = {}) {
  return cached(K('lino', { tint, seed, size, path, tiles }), () => {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = tint; g.fillRect(0, 0, size, size);
    grime(g, size, size, { seed, color: shade(tint, -0.15), octaves: [[8, 0.25], [40, 0.15]] });
    for (let i = 0; i < 300; i++) { g.fillStyle = rgba(shade(tint, 0.1), 0.15); g.fillRect(r() * size, r() * size, 6 + r() * 20, 1); }
    if (tiles) { g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; for (let i = 0; i <= tiles; i++) { g.beginPath(); g.moveTo(i * size / tiles, 0); g.lineTo(i * size / tiles, size); g.stroke(); g.beginPath(); g.moveTo(0, i * size / tiles); g.lineTo(size, i * size / tiles); g.stroke(); } }
    if (path != null) {
      const gr = g.createLinearGradient(size * (path - 0.25), 0, size * (path + 0.25), 0);
      gr.addColorStop(0, 'rgba(200,170,130,0)'); gr.addColorStop(0.5, 'rgba(200,170,130,0.22)'); gr.addColorStop(1, 'rgba(200,170,130,0)');
      g.fillStyle = gr; g.fillRect(0, 0, size, size);
    }
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

/** Wallpaper: motif 'lily' (faded lily sprigs on stripes), 'stripe', 'damask'. */
export function wallpaperTexture({ base = '#c99a94', ink = '#e8d0c0', motif = 'lily', seed = 61, size = 512, fade = 0.4 } = {}) {
  return cached(K('wallpaper', { base, ink, motif, seed, size, fade }), () => {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, size, size);
    for (let i = 0; i < 8; i++) { g.fillStyle = rgba(i % 2 ? shade(base, 0.04) : shade(base, -0.03), 1); g.fillRect(i * size / 8, 0, size / 16, size); }
    g.fillStyle = ink; g.strokeStyle = ink;
    if (motif === 'lily') {
      for (let k = 0; k < 4; k++) {
        const x = size * ((k % 2) * 0.5 + 0.25), y = size * (Math.floor(k / 2) * 0.5 + 0.25);
        g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + 70); g.quadraticCurveTo(x - 10, y + 20, x, y - 30); g.stroke();
        for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * 18, y + 40, 22, 6, s * 0.7, 0, Math.PI * 2); g.fill(); }
        for (let p = 0; p < 6; p++) { const a = -Math.PI / 2 + (p - 2.5) * 0.4; g.beginPath(); g.ellipse(x + Math.cos(a) * 18, y - 30 + Math.sin(a) * 18, 18, 5, a, 0, Math.PI * 2); g.fill(); }
      }
    } else if (motif === 'damask') {
      for (let k = 0; k < 4; k++) {
        const x = size * ((k % 2) * 0.5 + 0.25), y = size * (Math.floor(k / 2) * 0.5 + 0.25);
        g.beginPath(); g.ellipse(x, y, 30, 70, 0, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(x, y, 18, 50, 0, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over';
        g.fillStyle = base; g.beginPath(); g.ellipse(x, y, 18, 50, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = ink;
        g.beginPath(); g.ellipse(x, y, 8, 26, 0, 0, Math.PI * 2); g.fill();
      }
    }
    // fading: sun-bleach from top + grime
    const fg = g.createLinearGradient(0, 0, 0, size);
    fg.addColorStop(0, rgba('#f0e0c8', 0.25 * fade)); fg.addColorStop(1, rgba('#f0e0c8', 0));
    g.fillStyle = fg; g.fillRect(0, 0, size, size);
    grime(g, size, size, { seed, color: '#7a5a3a', octaves: [[4, 0.15 * fade + 0.05], [20, 0.08]] });
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

/** Woven cloth: unbleached canvas, dust sheets, flats' backs, costume fabrics (white = tint with material colour). */
export function clothTexture({ tint = '#d8cdb4', seed = 71, size = 256, weave = 2, stains = 2 } = {}) {
  return cached(K('cloth', { tint, seed, size, weave, stains }), () => {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = tint; g.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += weave) { g.fillStyle = rgba(shade(tint, -0.06), 0.35 + r() * 0.2); g.fillRect(0, y, size, 1); }
    for (let x = 0; x < size; x += weave) { g.fillStyle = rgba(shade(tint, 0.05), 0.25 + r() * 0.2); g.fillRect(x, 0, 1, size); }
    grime(g, size, size, { seed, color: shade(tint, -0.2), octaves: [[4, 0.15], [16, 0.08]] });
    for (let i = 0; i < stains; i++) stain(g, r() * size, r() * size, 8 + r() * 30, '#8a6a3a', 0.12);
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

/** Stripes for hatboxes, lighthouse bands, awnings. colors cycle; dir 'h' bands across V, 'v' along U. */
export function stripeTexture({ colors = ['#e8dcc0', '#a3201c'], count = 8, dir = 'v', seed = 81, size = 256, age = 0.4, spots = null } = {}) {
  return cached(K('stripe', { colors, count, dir, seed, size, age, spots }), () => {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = rng(seed);
    for (let i = 0; i < count; i++) {
      g.fillStyle = colors[i % colors.length];
      if (dir === 'v') g.fillRect(i * size / count, 0, size / count + 1, size);
      else g.fillRect(0, i * size / count, size, size / count + 1);
    }
    if (spots) { g.fillStyle = spots; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(r() * size, r() * size, 4 + r() * 3, 0, Math.PI * 2); g.fill(); } }
    if (age) { grime(g, size, size, { seed, color: '#6a4a20', octaves: [[4, 0.2 * age], [24, 0.12 * age]] }); speckle(g, size, size, r, 200 * age, '#4a3010', 0.3, 2); }
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

/** Hemp rope twist (tile along the rope: repeat [1, length/0.05]). */
export function ropeTexture({ tint = '#b49a6a', size = 64 } = {}) {
  return cached(K('rope', { tint, size }), () => {
    const c = makeCanvas(size, size), g = c.getContext('2d');
    g.fillStyle = tint; g.fillRect(0, 0, size, size);
    for (let i = -size; i < size * 2; i += size / 4) {
      g.strokeStyle = rgba(shade(tint, -0.22), 0.9); g.lineWidth = 3;
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + size, size); g.stroke();
      g.strokeStyle = rgba(shade(tint, 0.12), 0.7); g.lineWidth = 2;
      g.beginPath(); g.moveTo(i + 5, 0); g.lineTo(i + size + 5, size); g.stroke();
    }
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

// =====================================================================================================
// SIGNS, PLATES, DIALS, CHALK
// =====================================================================================================

/**
 * A label plate texture. style:
 *  'brass'   engraved brass plate (dark fill in the letters, screw holes)
 *  'enamel'  vitreous enamel sign (white on colour, rounded border, chips): bg/fg options
 *  'ivory'   ivory/bone label with black engraved text (dimmer channels, cue panel)
 *  'card'    buff card with typed text (rope-lock cards, tags)
 *  'exit'    green EXIT box face (white letters on green; give it an emissive material)
 *  'gilt'    gold letters on black (box office, kiosk fascia)
 * w,h px; font override; size px (auto-fit when omitted).
 */
export function labelPlate(text, { style = 'brass', w = 512, h = 128, bg = null, fg = null, font = null, size = null, seed = 91, screws = null } = {}) {
  return cached(K('plate', { text, style, w, h, bg, fg, font, size, seed, screws }), () => {
    const c = makeCanvas(w, h), g = c.getContext('2d'), r = rng(seed);
    const S = {
      brass: { bg: '#b8913e', fg: '#2a1c0c', font: FONTS.fell, screws: true },
      enamel: { bg: '#1d3a6a', fg: '#f2eee2', font: FONTS.ui, screws: true },
      ivory: { bg: '#e8dfc8', fg: '#1a1410', font: FONTS.fell, screws: true },
      card: { bg: '#e6d4a8', fg: '#2a2018', font: FONTS.typed, screws: false },
      exit: { bg: '#0e6a3a', fg: '#eafff0', font: FONTS.ui, screws: false },
      gilt: { bg: '#141010', fg: '#e0b850', font: FONTS.display, screws: false },
    }[style] || {};
    const B = bg || S.bg, F = fg || S.fg, FF = font || S.font, scr = screws ?? S.screws;
    g.fillStyle = B; g.fillRect(0, 0, w, h);
    if (style === 'brass') {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,240,200,0.35)'); gr.addColorStop(0.5, 'rgba(255,240,200,0)'); gr.addColorStop(1, 'rgba(60,40,10,0.35)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,230,180,0.08)'; g.fillRect(0, r() * h, w, 1); }
      grime(g, w, h, { seed, color: '#4a4020', octaves: [[4, 0.3], [16, 0.15]] });
      g.strokeStyle = 'rgba(60,40,10,0.6)'; g.lineWidth = 3; g.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16);
    } else if (style === 'enamel' || style === 'exit') {
      g.strokeStyle = F; g.lineWidth = h * 0.05; g.beginPath(); g.roundRect(h * 0.1, h * 0.1, w - h * 0.2, h - h * 0.2, h * 0.12); g.stroke();
      if (style === 'enamel') for (let i = 0; i < 6; i++) { g.fillStyle = '#2a2a2a'; const x = r() < 0.5 ? r() * w : (r() < 0.5 ? 4 : w - 10); g.beginPath(); g.arc(x, r() < 0.5 ? 4 + r() * 8 : h - 4 - r() * 8, 3 + r() * 6, 0, Math.PI * 2); g.fill(); }
    } else if (style === 'ivory') {
      grime(g, w, h, { seed, color: '#a08a60', octaves: [[4, 0.25], [20, 0.1]] });
      g.strokeStyle = 'rgba(30,20,10,0.6)'; g.lineWidth = 2; g.strokeRect(h * 0.1, h * 0.1, w - h * 0.2, h - h * 0.2);
    } else if (style === 'card') {
      grime(g, w, h, { seed, color: '#8a6a3a', octaves: [[4, 0.25], [20, 0.12]] });
      vignette(g, w, h, '#6a4a20', 0.3, 0.3);
    } else if (style === 'gilt') {
      g.strokeStyle = F; g.lineWidth = 3; g.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16);
    }
    if (scr) for (const x of [h * 0.22, w - h * 0.22]) {
      g.fillStyle = 'rgba(40,30,15,0.9)'; g.beginPath(); g.arc(x, h / 2, h * 0.07, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,240,200,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - h * 0.05, h / 2 - h * 0.02); g.lineTo(x + h * 0.05, h / 2 + h * 0.02); g.stroke();
    }
    const lines = String(text).split('\n');
    const maxW = w - (scr ? h * 0.7 : h * 0.3);
    let sz = size || Math.floor(h * (style === 'exit' ? 0.62 : 0.5) / lines.length);
    const weight = style === 'exit' || style === 'enamel' ? '700' : '';
    g.font = `${weight} ${sz}px ${FF}`;
    const widest = Math.max(...lines.map((l) => g.measureText(l).width));
    if (!size && widest > maxW) { sz = Math.floor(sz * maxW / widest); g.font = `${weight} ${sz}px ${FF}`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lh = sz * 1.1;
    lines.forEach((l, i) => {
      const y = h / 2 + (i - (lines.length - 1) / 2) * lh + sz * 0.04;
      if (style === 'brass') { g.fillStyle = 'rgba(255,240,200,0.5)'; g.fillText(l, w / 2 + 1.5, y + 1.5); }
      if (style === 'gilt') { g.fillStyle = '#6a4a10'; g.fillText(l, w / 2 + 2, y + 2); }
      g.fillStyle = F; g.fillText(l, w / 2, y);
    });
    return canvasTexture(c);
  });
}

/**
 * Round dial face: numbers around (array or count), ticks, centre label, style 'enamel' | 'brass' | 'iron'.
 * For a safe dial use numbers: 100 with labelEvery: 10; for a speed dial pass arc: [startDeg, endDeg] and labels.
 */
export function dialTexture({ numbers = 12, labels = null, labelEvery = 1, ticks = 60, arc = [0, 360], label = '', style = 'enamel', size = 512, seed = 95, redZone = null } = {}) {
  return cached(K('dial', { numbers, labels, labelEvery, ticks, arc, label, style, size, seed, redZone }), () => {
    const c = makeCanvas(size, size), g = c.getContext('2d'), R = size / 2;
    const bg = { enamel: '#efe8d6', brass: '#c9a24a', iron: '#2a2826' }[style], fg = style === 'iron' ? '#e8e0c8' : '#1a1410';
    g.fillStyle = bg; g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.fill();
    if (style === 'brass') grime(g, size, size, { seed, color: '#5a4a20', octaves: [[4, 0.3], [16, 0.12]] });
    const vg = g.createRadialGradient(R, R, R * 0.6, R, R, R); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,40,10,0.35)');
    g.fillStyle = vg; g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.fill();
    const a0 = (arc[0] - 90) * Math.PI / 180, a1 = (arc[1] - 90) * Math.PI / 180;
    const full = Math.abs(arc[1] - arc[0]) >= 360;
    if (redZone) { g.strokeStyle = 'rgba(170,30,20,0.85)'; g.lineWidth = R * 0.08; g.beginPath(); g.arc(R, R, R * 0.8, a0 + (a1 - a0) * redZone[0], a0 + (a1 - a0) * redZone[1]); g.stroke(); }
    g.strokeStyle = fg; g.fillStyle = fg;
    for (let i = 0; i <= ticks - (full ? 1 : 0); i++) {
      const a = a0 + (a1 - a0) * i / ticks, major = i % Math.max(1, Math.round(ticks / (Array.isArray(labels) ? labels.length - (full ? 0 : 1) : (typeof numbers === 'number' ? numbers : 12)))) === 0;
      g.lineWidth = major ? 3 : 1.4;
      g.beginPath(); g.moveTo(R + Math.cos(a) * R * (major ? 0.78 : 0.84), R + Math.sin(a) * R * (major ? 0.78 : 0.84)); g.lineTo(R + Math.cos(a) * R * 0.92, R + Math.sin(a) * R * 0.92); g.stroke();
    }
    const L = labels || Array.from({ length: typeof numbers === 'number' ? numbers : 12 }, (_, i) => String(full ? (i === 0 && numbers === 12 ? 12 : i) : i));
    const n = L.length;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${R * (n > 20 ? 0.1 : 0.16)}px ${FONTS.fell}`;
    for (let i = 0; i < n; i++) {
      if (i % labelEvery) continue;
      const a = a0 + (a1 - a0) * (full ? i / n : i / (n - 1));
      g.fillText(L[i], R + Math.cos(a) * R * 0.64, R + Math.sin(a) * R * 0.64);
    }
    if (label) { g.font = `italic ${R * 0.1}px ${FONTS.fell}`; g.fillText(label, R, R * 1.38); }
    g.strokeStyle = fg; g.lineWidth = 4; g.beginPath(); g.arc(R, R, R * 0.96, 0, Math.PI * 2); g.stroke();
    return canvasTexture(c);
  });
}

/**
 * Chalk on slate (dimmer board ticks, tally slates, call board notes): blue-grey slate with chalk lines.
 * lines: strings or { text, x, y (0..1), size (fraction of h), rot }; ticks: [{ x, y, len }] short chalk dashes.
 */
export function slateChalkTexture({ lines = [], ticks = [], w = 512, h = 512, seed = 99, tint = '#3a4046', size = 0.09 } = {}) {
  return cached(K('slate', { lines, ticks, w, h, seed, tint, size }), () => {
    const c = makeCanvas(w, h), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = tint; g.fillRect(0, 0, w, h);
    grime(g, w, h, { seed, color: '#9aa0a8', octaves: [[4, 0.12], [20, 0.1], [100, 0.08]], mode: 'screen' });
    // old ghost chalk smears
    g.globalAlpha = 0.05; g.strokeStyle = '#fff'; g.lineWidth = 30; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(r() * w, r() * h); g.quadraticCurveTo(r() * w, r() * h, r() * w, r() * h); g.stroke(); }
    g.globalAlpha = 1;
    const chalk = (draw) => { for (let p = 0; p < 4; p++) { g.globalAlpha = 0.25 + r() * 0.2; g.save(); g.translate((r() - 0.5) * 1.8, (r() - 0.5) * 1.8); draw(); g.restore(); } g.globalAlpha = 1; };
    g.fillStyle = '#f0f0e8'; g.strokeStyle = '#f0f0e8';
    lines.forEach((raw, i) => {
      const L = typeof raw === 'string' ? { text: raw } : raw;
      const sz = (L.size || size) * h;
      g.font = `${sz}px ${FONTS.hand}`; g.textAlign = L.align || 'left'; g.textBaseline = 'middle';
      const x = (L.x ?? 0.08) * w, y = (L.y ?? 0.12 + i * (size * 1.6)) * h;
      chalk(() => { g.translate(x, y); g.rotate(L.rot ?? (r() - 0.5) * 0.05); g.fillText(L.text, 0, 0); });
    });
    g.lineWidth = 4; g.lineCap = 'round';
    for (const t of ticks) chalk(() => { g.beginPath(); g.moveTo(t.x * w, t.y * h); g.lineTo((t.x + (t.len ?? 0.06)) * w, t.y * h + (r() - 0.5) * 3); g.stroke(); });
    return canvasTexture(c);
  });
}

// =====================================================================================================
// PAINTED SCENERY
// =====================================================================================================

function brushy(g, x, y, w, h, color, r, n = 40, len = 30, alpha = 0.18, width = 6) {
  g.strokeStyle = color; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.5 + r()); g.lineWidth = width * (0.5 + r());
    const px = x + r() * w, py = y + r() * h, a = (r() - 0.5) * 0.6;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len * (0.5 + r()), py + Math.sin(a) * len * 0.3 * (0.5 + r())); g.stroke();
  }
  g.globalAlpha = 1;
}

/**
 * Painted seascape backcloth in the scene-painter's style (big brush, distemper colour, stylised).
 * The Gull Point cloth defaults: night, a moon top-left, a cliff at right with surf, a distant brig.
 * opts: time 'night'|'dusk'|'day', moon [u,v] or null, cliff 'right'|'left'|null, brig bool, lighthouse (a distant
 *       painted light on the cliff) bool, stars bool, w/h px, seed. The sea region is v in [horizon, 1].
 */
export function seascapeTexture({ time = 'night', moon = [0.24, 0.2], cliff = 'right', brig = true, lighthouse = false, stars = true, horizon = 0.58, w = 2048, h = 1024, seed = 101 } = {}) {
  return cached(K('seascape', { time, moon, cliff, brig, lighthouse, stars, horizon, w, h, seed }), () => {
    const c = makeCanvas(w, h), g = c.getContext('2d'), r = rng(seed);
    const P = {
      night: { sky: ['#0b1430', '#1c2c58', '#3a5078'], sea: ['#1a3050', '#0c1628'], cliff: '#1a1a22', cliffHi: '#4a5068', surf: '#c8d8ee', cloud: '#2a3a60', cloudHi: '#8aa0c8' },
      dusk: { sky: ['#2a2050', '#a05a6a', '#f0a868'], sea: ['#5a4a6a', '#1a1a30'], cliff: '#2a1e28', cliffHi: '#7a5a5a', surf: '#f8e0c8', cloud: '#6a4a6a', cloudHi: '#f8c890' },
      day: { sky: ['#6a9ac8', '#a8c8e0', '#e0ecf0'], sea: ['#3a6a8a', '#1a3a5a'], cliff: '#5a5040', cliffHi: '#a89878', surf: '#ffffff', cloud: '#d8e0e8', cloudHi: '#ffffff' },
    }[time];
    const hy = h * horizon;
    const sky = g.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, P.sky[0]); sky.addColorStop(0.6, P.sky[1]); sky.addColorStop(1, P.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, w, hy);
    brushy(g, 0, 0, w, hy, P.sky[1], r, 260, 120, 0.08, 18);
    if (stars && time === 'night') for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(230,236,255,${0.3 + r() * 0.6})`; const s = 1 + r() * 2.5; g.fillRect(r() * w, r() * hy * 0.8, s, s); }
    if (moon) {
      const mx = moon[0] * w, my = moon[1] * h, mr = h * 0.065;
      const halo = g.createRadialGradient(mx, my, mr, mx, my, mr * 6);
      halo.addColorStop(0, 'rgba(220,230,255,0.45)'); halo.addColorStop(1, 'rgba(220,230,255,0)');
      g.fillStyle = halo; g.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
      g.fillStyle = time === 'night' ? '#f2f0dc' : '#fff4e0'; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(160,160,150,0.25)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(mx + (r() - 0.5) * mr, my + (r() - 0.5) * mr, mr * (0.1 + r() * 0.2), 0, Math.PI * 2); g.fill(); }
    }
    // clouds: stacked brushy ellipses lit from the moon side
    for (let k = 0; k < 7; k++) {
      const cx = r() * w, cy = hy * (0.15 + r() * 0.55), cw = w * (0.12 + r() * 0.15);
      for (let i = 0; i < 9; i++) {
        g.fillStyle = rgba(P.cloud, 0.55); g.beginPath();
        g.ellipse(cx + (r() - 0.5) * cw, cy + (r() - 0.5) * cw * 0.12, cw * (0.2 + r() * 0.2), cw * 0.07, 0, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = rgba(P.cloudHi, 0.25); g.beginPath(); g.ellipse(cx - cw * 0.1, cy - cw * 0.05, cw * 0.3, cw * 0.03, 0, 0, Math.PI * 2); g.fill();
    }
    // sea
    const sea = g.createLinearGradient(0, hy, 0, h);
    sea.addColorStop(0, P.sea[0]); sea.addColorStop(1, P.sea[1]);
    g.fillStyle = sea; g.fillRect(0, hy, w, h - hy);
    // wave strokes, longer and thicker toward the bottom (perspective)
    for (let i = 0; i < 520; i++) {
      const t = r(), y = hy + (h - hy) * t * t, len = 20 + t * 160, th = 1 + t * 7;
      const x = r() * w;
      g.strokeStyle = r() < 0.6 ? rgba(shade(P.sea[0], 0.12), 0.5) : rgba(shade(P.sea[1], -0.05), 0.6);
      g.lineWidth = th; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + len / 2, y - th * 1.5, x + len, y); g.stroke();
    }
    // moon path on the water
    if (moon) {
      const mx = moon[0] * w;
      for (let i = 0; i < 140; i++) {
        const t = r(), y = hy + (h - hy) * t, spread = w * (0.02 + t * 0.09);
        g.strokeStyle = `rgba(230,236,250,${0.25 + r() * 0.5})`; g.lineWidth = 1 + t * 4;
        const x = mx + (r() - 0.5) * spread * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 + t * 40, y); g.stroke();
      }
    }
    g.fillStyle = rgba(P.sky[2], 0.35); g.fillRect(0, hy - 2, w, 3); // horizon glint
    if (brig) {
      const bx = w * (cliff === 'left' ? 0.68 : 0.42), by = hy + 4, s = h * 0.09;
      g.fillStyle = '#0c0e16';
      g.beginPath(); g.moveTo(bx - s * 0.6, by - s * 0.12); g.lineTo(bx + s * 0.6, by - s * 0.12); g.lineTo(bx + s * 0.45, by); g.lineTo(bx - s * 0.5, by); g.closePath(); g.fill();
      for (const [ox, mh] of [[-0.22, 1], [0.18, 0.9]]) {
        g.fillRect(bx + ox * s - 1.5, by - s * 0.12 - s * mh, 3, s * mh);
        for (let k = 0; k < 3; k++) { const yy = by - s * 0.12 - s * mh * (0.25 + k * 0.27), ww = s * (0.34 - k * 0.07); g.fillStyle = 'rgba(210,214,226,0.75)'; g.fillRect(bx + ox * s - ww / 2, yy, ww, s * 0.2); g.fillStyle = '#0c0e16'; }
      }
      g.fillStyle = '#ffd890'; g.fillRect(bx - s * 0.3, by - s * 0.17, 3, 3);
    }
    if (cliff) {
      const left = cliff === 'left', x0 = left ? 0 : w;
      const pts = [];
      const cw = w * 0.36;
      for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([x0 + (left ? 1 : -1) * cw * t * (1 + (r() - 0.5) * 0.08), h * (0.22 + t * t * 0.55) + (r() - 0.5) * h * 0.03]); }
      g.fillStyle = P.cliff; g.beginPath(); g.moveTo(x0, h); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(pts[pts.length - 1][0], h); g.closePath(); g.fill();
      // rock facets lit by the moon
      for (let i = 0; i < 60; i++) {
        const t = r(), p = pts[Math.floor(t * (pts.length - 1))];
        const x = p[0] + (left ? -1 : 1) * r() * w * 0.05, y = p[1] + r() * (h - p[1]) * 0.8;
        g.fillStyle = rgba(P.cliffHi, 0.12 + r() * 0.2);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (left ? 1 : -1) * (20 + r() * 60), y + 10 + r() * 30); g.lineTo(x + (left ? 1 : -1) * (5 + r() * 20), y + 40 + r() * 50); g.closePath(); g.fill();
      }
      if (lighthouse) {
        const p = pts[2], lx = p[0] + (left ? 30 : -30), ly = p[1];
        g.fillStyle = '#d8d0c0'; g.fillRect(lx - 8, ly - 60, 16, 60);
        const lg = g.createRadialGradient(lx, ly - 66, 2, lx, ly - 66, 50); lg.addColorStop(0, 'rgba(255,230,150,0.9)'); lg.addColorStop(1, 'rgba(255,230,150,0)');
        g.fillStyle = lg; g.fillRect(lx - 50, ly - 116, 100, 100);
      }
      // surf at the cliff foot
      for (let i = 0; i < 120; i++) {
        const t = 0.6 + r() * 0.4, p = pts[Math.min(pts.length - 1, Math.floor(t * (pts.length - 1)))];
        const x = p[0] + (left ? 1 : -1) * r() * 80, y = Math.max(hy, p[1]) + r() * 40;
        g.fillStyle = rgba(P.surf, 0.3 + r() * 0.5); g.beginPath(); g.ellipse(x, y, 6 + r() * 26, 2 + r() * 6, 0, 0, Math.PI * 2); g.fill();
      }
    }
    // distemper texture: the canvas weave and a little uneven sizing
    grime(g, w, h, { seed, color: '#000', octaves: [[6, 0.1], [40, 0.05]] });
    g.globalAlpha = 0.05; for (let y = 0; y < h; y += 3) { g.fillStyle = y % 6 ? '#fff' : '#000'; g.fillRect(0, y, w, 1); } g.globalAlpha = 1;
    return canvasTexture(c);
  });
}

/**
 * Painted scenery for flats and cut-outs (alpha outside the shape). kind:
 *  'tavern'   panelled wall with a painted window, shelf and bottles (rectangular flat)
 *  'cottage'  whitewashed wall with a painted fireplace and a framed sampler
 *  'rocks'    groundrow of rocks (alpha cut-out top edge)
 *  'waves'    groundrow of stylised waves (alpha cut-out)
 *  'cloud'    a cloud cut-out
 */
export function sceneryTexture({ kind = 'tavern', w = 1024, h = 1024, seed = 111, time = 'night' } = {}) {
  return cached(K('scenery', { kind, w, h, seed, time }), () => {
    const c = makeCanvas(w, h), g = c.getContext('2d'), r = rng(seed);
    if (kind === 'tavern' || kind === 'cottage') {
      const wall = kind === 'tavern' ? '#6a4a30' : '#d8d0b8';
      g.fillStyle = wall; g.fillRect(0, 0, w, h);
      brushy(g, 0, 0, w, h, shade(wall, 0.08), r, 300, 80, 0.1, 14);
      if (kind === 'tavern') {
        for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(30,18,8,0.5)'; g.fillRect(i * w / 6, h * 0.55, 4, h * 0.45); }
        g.fillStyle = '#3a2614'; g.fillRect(0, h * 0.53, w, h * 0.03);
        // painted window with night outside
        g.fillStyle = '#1a2440'; g.fillRect(w * 0.15, h * 0.15, w * 0.3, h * 0.3);
        g.fillStyle = '#d8e0f0'; g.beginPath(); g.arc(w * 0.22, h * 0.22, h * 0.03, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#2a1a0c'; g.lineWidth = 12; g.strokeRect(w * 0.15, h * 0.15, w * 0.3, h * 0.3);
        g.lineWidth = 6; g.beginPath(); g.moveTo(w * 0.3, h * 0.15); g.lineTo(w * 0.3, h * 0.45); g.moveTo(w * 0.15, h * 0.3); g.lineTo(w * 0.45, h * 0.3); g.stroke();
        // shelf with bottles and a tankard
        g.fillStyle = '#2a1a0c'; g.fillRect(w * 0.55, h * 0.3, w * 0.35, h * 0.02);
        for (let i = 0; i < 6; i++) {
          const x = w * (0.57 + i * 0.055), bh = h * (0.08 + r() * 0.05);
          g.fillStyle = ['#2a5a3a', '#5a2a1a', '#3a3a5a', '#7a6a3a'][i % 4];
          g.fillRect(x, h * 0.3 - bh, w * 0.03, bh); g.fillRect(x + w * 0.01, h * 0.3 - bh - h * 0.03, w * 0.01, h * 0.03);
          g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + 3, h * 0.3 - bh + 6, 3, bh * 0.6);
        }
        // a painted ship's wheel
        g.strokeStyle = '#3a2410'; g.lineWidth = 10; g.beginPath(); g.arc(w * 0.72, h * 0.7, h * 0.09, 0, Math.PI * 2); g.stroke();
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(w * 0.72, h * 0.7); g.lineTo(w * 0.72 + Math.cos(a) * h * 0.13, h * 0.7 + Math.sin(a) * h * 0.13); g.stroke(); }
      } else {
        // fireplace with painted flames, a sampler, a lamp-black skirting
        g.fillStyle = '#7a7060'; g.fillRect(w * 0.3, h * 0.5, w * 0.4, h * 0.5);
        g.fillStyle = '#1a1410'; g.fillRect(w * 0.38, h * 0.62, w * 0.24, h * 0.38);
        g.fillStyle = '#e88a30'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(w * (0.43 + i * 0.035), h * 0.9, w * 0.02, h * 0.06, 0, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#4a3020'; g.fillRect(w * 0.26, h * 0.48, w * 0.48, h * 0.03);
        g.fillStyle = '#efe4c8'; g.fillRect(w * 0.08, h * 0.2, w * 0.14, h * 0.18); g.strokeStyle = '#4a3020'; g.lineWidth = 8; g.strokeRect(w * 0.08, h * 0.2, w * 0.14, h * 0.18);
        g.fillStyle = '#8a2a2a'; g.font = `${h * 0.03}px ${FONTS.fell}`; g.textAlign = 'center'; g.fillText('HOME', w * 0.15, h * 0.28); g.fillText('SWEET', w * 0.15, h * 0.32);
        g.fillStyle = '#1a1410'; g.fillRect(0, h * 0.94, w, h * 0.06);
      }
      grime(g, w, h, { seed, color: '#000', octaves: [[5, 0.15], [30, 0.06]] });
      // frame-shadow along the edges (paint stops short of the toggle rails)
      vignette(g, w, h, '#000', 0.4, 0.55);
      return canvasTexture(c);
    }
    // cut-outs: transparent background
    g.clearRect(0, 0, w, h);
    if (kind === 'rocks' || kind === 'waves') {
      const base = kind === 'rocks' ? '#3a3a44' : '#1e3a5a', hi = kind === 'rocks' ? '#6a6a80' : '#c8d8ee';
      g.fillStyle = base; g.beginPath(); g.moveTo(0, h);
      if (kind === 'rocks') { let x = 0; while (x < w) { const pw = 60 + r() * 160; g.lineTo(x + pw * 0.3, h * (0.25 + r() * 0.45)); g.lineTo(x + pw * 0.7, h * (0.2 + r() * 0.5)); x += pw; g.lineTo(x, h * (0.5 + r() * 0.3)); } }
      else { for (let x = 0; x <= w; x += w / 8) { g.quadraticCurveTo(x + w / 16, h * 0.05, x + w / 8, h * 0.45); g.quadraticCurveTo(x + w / 10, h * 0.3, x + w / 8, h * 0.45); } }
      g.lineTo(w, h); g.closePath(); g.fill();
      g.save(); g.globalCompositeOperation = 'source-atop';
      brushy(g, 0, 0, w, h, hi, r, 220, 70, 0.22, 12);
      if (kind === 'waves') { g.fillStyle = rgba(hi, 0.8); for (let x = 0; x <= w; x += w / 8) { g.beginPath(); g.ellipse(x + w / 12, h * 0.15, w * 0.03, h * 0.04, 0, 0, Math.PI * 2); g.fill(); } }
      g.restore();
    } else if (kind === 'cloud') {
      g.fillStyle = '#c8d0e0';
      for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(w * (0.2 + r() * 0.6), h * (0.4 + r() * 0.2), w * (0.12 + r() * 0.12), h * (0.12 + r() * 0.12), 0, 0, Math.PI * 2); g.fill(); }
      g.save(); g.globalCompositeOperation = 'source-atop'; brushy(g, 0, 0, w, h, '#f0f4ff', r, 120, 60, 0.2, 14); brushy(g, 0, h * 0.5, w, h * 0.5, '#7a8aa8', r, 120, 60, 0.25, 14); g.restore();
    }
    return canvasTexture(c);
  });
}

/** Rain streaks on glass (alpha texture; scroll its offset.y to animate). */
export function rainStreakTexture({ size = 256, seed = 121, density = 1 } = {}) {
  return cached(K('rain', { size, seed, density }), () => {
    const c = makeCanvas(size, size * 2), g = c.getContext('2d'), r = rng(seed);
    g.clearRect(0, 0, size, size * 2);
    for (let i = 0; i < 40 * density; i++) {
      const x = r() * size, y = r() * size * 2, len = 20 + r() * 90;
      const gr = g.createLinearGradient(x, y, x, y + len); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.6)');
      g.strokeStyle = gr; g.lineWidth = 0.8 + r() * 1.4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 4, y + len / 2, x + (r() - 0.5) * 3, y + len); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x, y + len, 1.6, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 200 * density; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.35})`; g.beginPath(); g.arc(r() * size, r() * size * 2, 0.6 + r() * 1.6, 0, Math.PI * 2); g.fill(); }
    const t = canvasTexture(c, { srgb: true, repeat: [1, 1] });
    return t;
  });
}

/** Number band for a combination wheel (0..digits-1 stacked along V, for a cylinder's side). */
export function numberBandTexture({ digits = 10, fg = '#1a1208', bg = '#c9a24a', font = FONTS.fell, w = 128, h = 1024, engraved = true } = {}) {
  return cached(K('numband', { digits, fg, bg, font, w, h, engraved }), () => {
    const c = makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const cell = h / digits;
    for (let i = 0; i < digits; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'; g.fillRect(0, i * cell, w, cell); }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${cell * 0.62}px ${font}`;
    for (let i = 0; i < digits; i++) {
      // V runs bottom → top on cylinders; digit i is centred at cell i from the bottom
      const y = h - (i + 0.5) * cell;
      if (engraved) { g.fillStyle = 'rgba(255,240,200,0.5)'; g.fillText(String(i), w / 2 + 1.5, y + 1.5); }
      g.fillStyle = fg; g.fillText(String(i), w / 2, y);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, h - (i + 1) * cell, w, 1.5);
    }
    return canvasTexture(c);
  });
}

export function clearTheatreTextureCache() { cache.clear(); }

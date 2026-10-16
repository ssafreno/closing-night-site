// Inventory icons. An item's icon is `items[id].drawIcon(ctx2d, size)` (drawn in a 100×100 frame, scaled to size).
// Without one, the engine draws a labelled pouch with the item's initial. `kit` builds common shapes with parameters,
// so src/content/items.js can say `drawIcon: kit.key({ color: '#c9a24a' })` instead of hand-drawing.
// Node-safe: nothing here touches the DOM until renderIcon() is called.

const INK = '#2b1a10';

function begin(c, size) {
  c.save(); c.scale(size / 100, size / 100);
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 3.4;
}
function end(c) { c.restore(); }
function shadow(c, cx = 50, cy = 90, rx = 30, ry = 5) {
  c.save(); c.fillStyle = 'rgba(40,20,10,0.18)'; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.restore();
}
function rrect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function fillStroke(c, fill) { c.fillStyle = fill; c.fill(); c.stroke(); }
function shine(c, x, y, w, h, a = 0.45) {
  c.save(); c.fillStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.ellipse(x, y, w, h, -0.3, 0, Math.PI * 2); c.fill(); c.restore();
}
function shade(hex, k) {
  const n = parseInt(hex.replace('#', ''), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Parametric icon builders: each returns a drawIcon(ctx2d, size) function. */
export const kit = {
  /** A key. { color, bow: 'ring'|'trefoil', teeth: n, label } */
  key({ color = '#c9a24a', bow = 'ring', teeth = 3, tag = null } = {}) {
    return (c, size) => {
      begin(c, size); shadow(c);
      c.save(); c.translate(50, 50); c.rotate(-0.6);
      if (bow === 'trefoil') {
        for (const [x, y] of [[-30, -8], [-30, 8], [-42, 0]]) { c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); fillStroke(c, color); }
      } else { c.beginPath(); c.arc(-30, 0, 14, 0, Math.PI * 2); fillStroke(c, color); c.beginPath(); c.arc(-30, 0, 6, 0, Math.PI * 2); fillStroke(c, '#f3e7ca'); }
      rrect(c, -17, -4, 52, 8, 3); fillStroke(c, color);
      for (let i = 0; i < teeth; i++) { rrect(c, 34 - i * 9, 3, 6, 10 - (i % 2) * 3, 1.5); fillStroke(c, color); }
      shine(c, -34, -6, 3, 5);
      c.restore();
      if (tag) { c.save(); c.translate(70, 26); c.rotate(0.3); rrect(c, -12, -8, 24, 16, 3); fillStroke(c, tag); c.restore(); }
      end(c);
    };
  },
  /** A sheet of paper or card, optionally folded / with ruled lines / a seal. { color, lines, seal, torn } */
  paper({ color = '#f0e3c4', lines = 5, seal = null, torn = false, ink = '#6a5040' } = {}) {
    return (c, size) => {
      begin(c, size); shadow(c);
      c.save(); c.translate(50, 48); c.rotate(-0.08);
      c.beginPath(); c.moveTo(-26, -36); c.lineTo(26, -36); c.lineTo(26, 36);
      if (torn) { for (let x = 26; x >= -26; x -= 6.5) c.lineTo(x, 36 - ((x / 6.5) % 2 ? 5 : 0)); } else c.lineTo(-26, 36);
      c.closePath(); fillStroke(c, color);
      c.strokeStyle = ink; c.lineWidth = 2;
      for (let i = 0; i < lines; i++) { c.beginPath(); c.moveTo(-18, -24 + i * 10); c.lineTo(18 - (i === lines - 1 ? 14 : 0), -24 + i * 10); c.stroke(); }
      if (seal) { c.strokeStyle = INK; c.lineWidth = 2.4; c.beginPath(); c.arc(14, 24, 8, 0, Math.PI * 2); fillStroke(c, seal); }
      c.restore(); end(c);
    };
  },
  /** A ticket stub. { color, text } */
  ticket({ color = '#e8c86a', text = 'ADMIT ONE' } = {}) {
    return (c, size) => {
      begin(c, size); shadow(c);
      c.save(); c.translate(50, 50); c.rotate(-0.25);
      c.beginPath(); c.moveTo(-38, -18); c.lineTo(38, -18); c.arc(38, 0, 6, -Math.PI / 2, Math.PI / 2, true); c.lineTo(38, 18); c.lineTo(-38, 18);
      c.arc(-38, 0, 6, Math.PI / 2, -Math.PI / 2, true); c.closePath(); fillStroke(c, color);
      c.setLineDash([3, 3]); c.lineWidth = 1.6; c.beginPath(); c.moveTo(18, -16); c.lineTo(18, 16); c.stroke(); c.setLineDash([]);
      c.fillStyle = INK; c.font = '700 10px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, -10, 0);
      c.restore(); end(c);
    };
  },
  /** A bottle or phial. { glass, contents, fill (0..1), cork, label } */
  bottle({ glass = 'rgba(190,220,210,0.35)', contents = '#7a2a3a', fill = 0.6, cork = '#9a6a3a', label = '#f1e3bf' } = {}) {
    return (c, size) => {
      begin(c, size); shadow(c, 50, 92, 22, 4);
      const top = 88 - 52 * fill;
      c.save(); c.beginPath(); c.moveTo(34, 50); c.quadraticCurveTo(34, 40, 44, 36); c.lineTo(44, 22); c.lineTo(56, 22); c.lineTo(56, 36);
      c.quadraticCurveTo(66, 40, 66, 50); c.lineTo(66, 84); c.quadraticCurveTo(66, 90, 60, 90); c.lineTo(40, 90); c.quadraticCurveTo(34, 90, 34, 84); c.closePath();
      c.clip(); c.fillStyle = contents; c.fillRect(30, top, 40, 60); c.restore();
      c.beginPath(); c.moveTo(34, 50); c.quadraticCurveTo(34, 40, 44, 36); c.lineTo(44, 22); c.lineTo(56, 22); c.lineTo(56, 36);
      c.quadraticCurveTo(66, 40, 66, 50); c.lineTo(66, 84); c.quadraticCurveTo(66, 90, 60, 90); c.lineTo(40, 90); c.quadraticCurveTo(34, 90, 34, 84); c.closePath();
      fillStroke(c, glass);
      rrect(c, 43, 12, 14, 12, 3); fillStroke(c, cork);
      if (label) { rrect(c, 38, 58, 24, 16, 2); fillStroke(c, label); }
      shine(c, 40, 50, 2.5, 8);
      end(c);
    };
  },
  /** A box, tin or case. { color, lid, band, latch } */
  box({ color = '#8a4a2a', lid = null, band = '#c9a24a', latch = true } = {}) {
    return (c, size) => {
      begin(c, size); shadow(c, 50, 88, 36, 5);
      rrect(c, 16, 40, 68, 44, 5); fillStroke(c, color);
      rrect(c, 13, 30, 74, 16, 5); fillStroke(c, lid || shade(color.startsWith('#') ? color : '#8a4a2a', 1.18));
      if (band) { c.fillStyle = band; c.fillRect(46, 30, 8, 54); c.strokeRect(46, 30, 8, 54); }
      if (latch) { rrect(c, 44, 42, 12, 10, 2); fillStroke(c, '#e7c878'); }
      end(c);
    };
  },
  /** A light bulb, or a lamp glass. { glass, glow, base } */
  bulb({ glass = '#fff4c8', glow = 'rgba(255,220,120,0.35)', base = '#b0a090' } = {}) {
    return (c, size) => {
      begin(c, size); shadow(c, 50, 92, 18, 4);
      if (glow) { c.save(); c.fillStyle = glow; c.beginPath(); c.arc(50, 38, 32, 0, Math.PI * 2); c.fill(); c.restore(); }
      c.beginPath(); c.arc(50, 38, 22, Math.PI * 0.8, Math.PI * 2.2); c.lineTo(58, 64); c.lineTo(42, 64); c.closePath(); fillStroke(c, glass);
      rrect(c, 41, 64, 18, 18, 2); fillStroke(c, base);
      c.lineWidth = 1.6; for (let y = 68; y < 82; y += 4) { c.beginPath(); c.moveTo(41, y); c.lineTo(59, y + 2); c.stroke(); }
      c.lineWidth = 2; c.beginPath(); c.moveTo(45, 62); c.lineTo(47, 40); c.lineTo(53, 40); c.lineTo(55, 62); c.stroke();
      shine(c, 42, 30, 4, 7);
      end(c);
    };
  },
  /** A roll (piano roll, scroll, fabric bolt). { color, edge, paper } */
  roll({ color = '#e8dcc0', edge = '#8a5a2b', marks = '#3a2a1a' } = {}) {
    return (c, size) => {
      begin(c, size); shadow(c);
      c.save(); c.translate(50, 52); c.rotate(-0.5);
      rrect(c, -34, -14, 68, 28, 4); fillStroke(c, color);
      c.fillStyle = marks; for (let i = 0; i < 9; i++) c.fillRect(-26 + i * 6, -8 + ((i * 7) % 12), 3, 4);
      for (const x of [-38, 38]) { c.beginPath(); c.ellipse(x, 0, 6, 16, 0, 0, Math.PI * 2); fillStroke(c, edge); }
      c.restore(); end(c);
    };
  },
  /** Folded cloth or a garment. { color, trim } */
  fabric({ color = '#7a1c2a', trim = '#c9a24a' } = {}) {
    return (c, size) => {
      begin(c, size); shadow(c, 50, 88, 34, 5);
      c.beginPath(); c.moveTo(18, 40); c.quadraticCurveTo(50, 28, 82, 40); c.lineTo(84, 80); c.quadraticCurveTo(50, 90, 16, 80); c.closePath(); fillStroke(c, color);
      c.strokeStyle = trim; c.lineWidth = 3; c.beginPath(); c.moveTo(18, 48); c.quadraticCurveTo(50, 38, 82, 48); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(40, 40); c.quadraticCurveTo(44, 64, 38, 84); c.moveTo(62, 38); c.quadraticCurveTo(58, 62, 64, 84); c.stroke();
      end(c);
    };
  },
  /** A coin, token or medal. { color, mark } */
  coin({ color = '#c9a24a', mark = '1' } = {}) {
    return (c, size) => {
      begin(c, size); shadow(c, 50, 86, 24, 4);
      c.beginPath(); c.arc(50, 50, 30, 0, Math.PI * 2); fillStroke(c, color);
      c.lineWidth = 1.8; c.beginPath(); c.arc(50, 50, 23, 0, Math.PI * 2); c.stroke();
      c.fillStyle = INK; c.font = '700 26px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(mark, 50, 52);
      shine(c, 38, 36, 5, 8, 0.4);
      end(c);
    };
  },
  /** A small hand tool: 'screwdriver' | 'spanner' | 'hammer' | 'scissors' | 'crank'. { kind, metal, handle } */
  tool({ kind = 'screwdriver', metal = '#a8adb2', handle = '#b8352b' } = {}) {
    return (c, size) => {
      begin(c, size); shadow(c);
      c.save(); c.translate(50, 50); c.rotate(-0.75);
      if (kind === 'spanner') {
        rrect(c, -30, -5, 56, 10, 4); fillStroke(c, metal);
        c.beginPath(); c.arc(32, 0, 13, 0.6, Math.PI * 2 - 0.6); c.lineTo(26, 0); c.closePath(); fillStroke(c, metal);
        c.beginPath(); c.arc(-34, 0, 10, 0, Math.PI * 2); fillStroke(c, metal); c.beginPath(); c.arc(-34, 0, 4, 0, Math.PI * 2); fillStroke(c, '#f3e7ca');
      } else if (kind === 'hammer') {
        rrect(c, -36, -4, 60, 8, 3); fillStroke(c, handle); rrect(c, 20, -16, 16, 32, 3); fillStroke(c, metal);
      } else if (kind === 'scissors') {
        for (const s of [1, -1]) { c.beginPath(); c.moveTo(0, 0); c.lineTo(38, s * 6); c.lineTo(36, s * 10); c.closePath(); fillStroke(c, metal); c.beginPath(); c.arc(-16, s * 12, 9, 0, Math.PI * 2); fillStroke(c, handle); c.beginPath(); c.arc(-16, s * 12, 4, 0, Math.PI * 2); fillStroke(c, '#f3e7ca'); }
      } else if (kind === 'crank') {
        rrect(c, -30, -4, 50, 8, 3); fillStroke(c, metal); rrect(c, 14, -4, 8, 30, 3); fillStroke(c, metal); rrect(c, 12, 22, 12, 16, 4); fillStroke(c, handle);
        rrect(c, -38, -8, 12, 16, 2); fillStroke(c, metal);
      } else {
        rrect(c, -38, -8, 34, 16, 6); fillStroke(c, handle); rrect(c, -4, -3, 36, 6, 2); fillStroke(c, metal);
        c.beginPath(); c.moveTo(32, -3); c.lineTo(40, 0); c.lineTo(32, 3); c.closePath(); fillStroke(c, metal);
      }
      c.restore(); end(c);
    };
  },
  /** A flower or a small bouquet. { color, stem } */
  flower({ color = '#f6f0e4', stem = '#4a7a3a', centre = '#e8c040' } = {}) {
    return (c, size) => {
      begin(c, size); shadow(c);
      c.lineWidth = 3; c.strokeStyle = stem; c.beginPath(); c.moveTo(50, 88); c.quadraticCurveTo(46, 66, 50, 46); c.stroke();
      c.strokeStyle = INK; c.lineWidth = 2.6;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.beginPath(); c.ellipse(50 + Math.cos(a) * 12, 36 + Math.sin(a) * 12, 10, 6, a, 0, Math.PI * 2); fillStroke(c, color); }
      c.beginPath(); c.arc(50, 36, 6, 0, Math.PI * 2); fillStroke(c, centre);
      end(c);
    };
  },
  /** A plain coloured gem / bead / button. { color, shape: 'round'|'cut' } */
  gem({ color = '#5a8ad8', shape = 'cut' } = {}) {
    return (c, size) => {
      begin(c, size); shadow(c, 50, 84, 22, 4);
      c.beginPath();
      if (shape === 'round') c.arc(50, 50, 24, 0, Math.PI * 2);
      else { c.moveTo(30, 40); c.lineTo(40, 28); c.lineTo(60, 28); c.lineTo(70, 40); c.lineTo(50, 76); c.closePath(); }
      fillStroke(c, color);
      if (shape !== 'round') { c.lineWidth = 1.6; c.beginPath(); c.moveTo(30, 40); c.lineTo(70, 40); c.moveTo(40, 28); c.lineTo(46, 40); c.lineTo(50, 76); c.lineTo(54, 40); c.lineTo(60, 28); c.stroke(); }
      shine(c, 42, 36, 4, 6, 0.55);
      end(c);
    };
  },
};

/** The fallback: a drawstring pouch with the item's initial, so an item with no icon still reads in the bar. */
function pouch(c, size, id, def) {
  begin(c, size); shadow(c);
  const letter = String(def?.name || id || '?').replace(/^(the|a|an)\s+/i, '').charAt(0).toUpperCase() || '?';
  c.beginPath(); c.moveTo(30, 40); c.quadraticCurveTo(18, 86, 50, 88); c.quadraticCurveTo(82, 86, 70, 40); c.closePath(); fillStroke(c, '#a07a4e');
  c.beginPath(); c.moveTo(30, 40); c.lineTo(36, 26); c.lineTo(64, 26); c.lineTo(70, 40); c.closePath(); fillStroke(c, '#b88c5a');
  c.lineWidth = 2.4; c.beginPath(); c.moveTo(30, 40); c.quadraticCurveTo(50, 46, 70, 40); c.stroke();
  c.fillStyle = '#f3e7ca'; c.font = '700 30px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(letter, 50, 66);
  end(c);
}

export function renderIcon(id, size, itemDef) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  try {
    if (itemDef?.drawIcon) itemDef.drawIcon(g, size);
    else pouch(g, size, id, itemDef);
  } catch (e) { console.error(`[icons] ${id}`, e); g.clearRect(0, 0, size, size); pouch(g, size, id, itemDef); }
  return c;
}

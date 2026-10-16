// Inventory items. WRITER owns names and examine lines; PROPS / SET agents may add drawIcon.
// Shape: items[id] = { name, examine?, drawIcon?: (ctx2d, size) => void }  (drawn in a 100×100 frame scaled to size)
// examine may live here or in the script as item.<id>.examine (DESIGN §12; the script key wins). Ids: manifest.items.
// Set `complete = true` once every manifest item is here: script-check then fails on missing ones.
// Use the icon kit for quick icons: kit.key / paper / ticket / bottle / box / bulb / roll / fabric / coin / tool /
// flower / gem (see src/engine/icons.js). An item without drawIcon gets a pouch with its initial.
// Examines are the narrator's: dry, second person, no '!'. The lamp's examine is the script key item.lamp.examine.
import { kit } from '../engine/icons.js';

export const complete = true;

// small hand-drawn icons the kit has no shape for
const INK = '#2b1a10';
const draw = (fn) => (c, size) => {
  c.save(); c.scale(size / 100, size / 100); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 3.4;
  c.fillStyle = 'rgba(40,20,10,0.18)'; c.beginPath(); c.ellipse(50, 90, 30, 5, 0, 0, Math.PI * 2); c.fill();
  fn(c); c.restore();
};
const fs = (c, fill) => { c.fillStyle = fill; c.fill(); c.stroke(); };
const clipboardIcon = draw((c) => {
  c.beginPath(); c.rect(24, 14, 52, 72); fs(c, '#8a5a32');
  c.beginPath(); c.rect(30, 24, 40, 56); fs(c, '#f4ecd8');
  c.lineWidth = 2; for (let y = 36; y < 76; y += 8) { c.beginPath(); c.moveTo(35, y); c.lineTo(65, y); c.stroke(); }
  c.lineWidth = 3.4; c.beginPath(); c.rect(38, 9, 24, 12); fs(c, '#b8b8b0');
});
const penIcon = draw((c) => {
  c.translate(50, 50); c.rotate(-0.8);
  c.beginPath(); c.rect(-34, -7, 50, 14); fs(c, '#1f2a4a');
  c.beginPath(); c.moveTo(16, -7); c.lineTo(34, 0); c.lineTo(16, 7); c.closePath(); fs(c, '#d9b44a');
  c.lineWidth = 2; c.beginPath(); c.moveTo(-20, -7); c.lineTo(-20, 7); c.stroke();
});
const trumpetIcon = draw((c) => {
  c.beginPath(); c.moveTo(18, 46); c.quadraticCurveTo(40, 44, 62, 30); c.lineTo(84, 18); c.lineTo(84, 70); c.lineTo(62, 58);
  c.quadraticCurveTo(40, 52, 18, 54); c.closePath(); fs(c, '#c9a24a');
  c.beginPath(); c.ellipse(84, 44, 6, 26, 0, 0, Math.PI * 2); fs(c, '#7a5a1a');
  c.beginPath(); c.arc(18, 50, 4, 0, Math.PI * 2); fs(c, '#c9a24a');
});

// POLISH: the three garments had one shared folded-cloth icon in three colours; each now has its own silhouette.
const bodiceIcon = draw((c) => { // a fitted bodice with cap sleeves and lilac lacing
  c.beginPath(); c.moveTo(34, 20); c.quadraticCurveTo(50, 28, 66, 20); c.lineTo(80, 30); c.lineTo(72, 42); c.lineTo(66, 38);
  c.quadraticCurveTo(62, 60, 68, 82); c.quadraticCurveTo(50, 88, 32, 82); c.quadraticCurveTo(38, 60, 34, 38); c.lineTo(28, 42); c.lineTo(20, 30); c.closePath(); fs(c, '#9a9aa2');
  c.strokeStyle = '#b49ad0'; c.lineWidth = 2.6;
  for (let y = 36; y < 80; y += 9) { c.beginPath(); c.moveTo(45, y); c.lineTo(55, y + 6); c.moveTo(55, y); c.lineTo(45, y + 6); c.stroke(); }
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(38, 44); c.quadraticCurveTo(36, 62, 38, 78); c.stroke();
});
const capeIcon = draw((c) => { // a hooded oilskin cape, flaring wide
  c.beginPath(); c.moveTo(50, 16); c.quadraticCurveTo(66, 16, 64, 34); c.quadraticCurveTo(80, 50, 88, 84); c.quadraticCurveTo(50, 92, 12, 84);
  c.quadraticCurveTo(20, 50, 36, 34); c.quadraticCurveTo(34, 16, 50, 16); c.closePath(); fs(c, '#3f7a6a');
  c.beginPath(); c.moveTo(42, 34); c.quadraticCurveTo(42, 22, 50, 22); c.quadraticCurveTo(58, 22, 58, 34); c.quadraticCurveTo(50, 38, 42, 34); c.closePath(); fs(c, '#21403a');
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(50, 38); c.lineTo(50, 88); c.moveTo(40, 44); c.quadraticCurveTo(30, 66, 28, 86); c.moveTo(60, 44); c.quadraticCurveTo(70, 66, 72, 86); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.ellipse(36, 58, 3, 10, 0.4, 0, Math.PI * 2); c.fill();
});
const skirtIcon = draw((c) => { // a long A-line skirt with a waistband and a stitched hem
  c.beginPath(); c.moveTo(36, 20); c.lineTo(64, 20); c.lineTo(84, 82); c.quadraticCurveTo(50, 90, 16, 82); c.closePath(); fs(c, '#5a6070');
  c.beginPath(); c.rect(34, 14, 32, 9); fs(c, '#4a4f5c');
  c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 2; c.beginPath(); c.moveTo(44, 24); c.lineTo(36, 84); c.moveTo(56, 24); c.lineTo(64, 84); c.stroke();
  c.strokeStyle = '#d8d6ce'; c.lineWidth = 2.2; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(20, 76); c.quadraticCurveTo(50, 83, 80, 76); c.stroke(); c.setLineDash([]);
});

export const items = {
  clipboard: {
    name: 'Clipboard',
    examine: 'Your Certificate of Vacancy, clipped and ready. It only wants a signature and a word in Remarks.',
    drawIcon: clipboardIcon,
  },
  pen: {
    name: 'Fountain pen',
    examine: 'Council issue, black ink. It has signed off nine theatres, two chapels and a lido.',
    drawIcon: penIcon,
  },
  key_hutch: {
    name: 'Hutch key',
    examine: "Alf's key to his own half-door. He kept it in his coat, which he kept on a hook, which is still there.",
    drawIcon: kit.key({ color: '#a8884a', teeth: 2 }),
  },
  shilling: {
    name: 'Shilling',
    examine: 'A 1929 shilling from the tea fund. The King looks tired.',
    drawIcon: kit.coin({ color: '#c8ccd0', mark: '1/-' }),
  },
  key_pass: {
    name: 'Pass door key',
    examine: 'A long iron key on a tag: PASS DOOR. It weighs about as much as a decision.',
    drawIcon: kit.key({ color: '#6a6a6a', bow: 'trefoil', teeth: 4 }),
  },
  fuse_r: {
    name: 'Red fuse',
    examine: 'A porcelain cartridge fuse with a red band. It spent ninety-odd years in a fire bucket, as instructed.',
    drawIcon: kit.roll({ color: '#efe8da', edge: '#b8352b', marks: '#b8352b' }),
  },
  fuse_y: {
    name: 'Yellow fuse',
    examine: 'A porcelain cartridge fuse with a yellow band. It was in a teacup. The tea had left.',
    drawIcon: kit.roll({ color: '#efe8da', edge: '#d8b030', marks: '#d8b030' }),
  },
  fuse_b: {
    name: 'Blue fuse',
    examine: 'A porcelain cartridge fuse with a blue band, tied to a cleat with a sailor\'s knot.',
    drawIcon: kit.roll({ color: '#efe8da', edge: '#2f5aa8', marks: '#2f5aa8' }),
  },
  bodice: {
    name: 'Grey silk bodice',
    examine: 'Grey silk, a lighthouse stamp, lilac thread, three notches. Molly would know it in the dark.',
    drawIcon: bodiceIcon, // POLISH
  },
  chalk: {
    name: "Tailor's chalk",
    examine: "A flat cake of tailor's chalk, worn to a blunt edge.",
    drawIcon: kit.gem({ color: '#f2efe6', shape: 'cut' }),
  },
  cape: {
    name: 'Oilskin cape',
    examine: 'Sea-green oilskin, stiff as a sail. It smells of linseed and somebody else\'s weather.',
    drawIcon: capeIcon, // POLISH
  },
  oilcan: {
    name: 'Oil can',
    examine: 'A brass oil can with a long spout. Molly oiled everything. Some of it twice.',
    drawIcon: kit.bottle({ glass: '#c9a24a', contents: '#8a6a1a', fill: 0.5, cork: '#6a6a6a', label: '#e8d8a8' }),
  },
  skirt: {
    name: 'Storm-grey skirt',
    examine: 'Storm-grey wool, the hem finally down. The machine sounded pleased about it.',
    drawIcon: skirtIcon, // POLISH
  },
  lamp: {
    name: 'Lighthouse lamp',
    // examine: script key item.lamp.examine (wardrobe.js)
    drawIcon: kit.bulb({ glass: '#f4f0e0', glow: 'rgba(255,230,150,0.45)', base: '#b8862b' }),
  },
  mallet: {
    name: 'Thunder beater',
    examine: 'A felt-headed beater, PERCUSSION burned into the handle. Small, for something that makes weather.',
    drawIcon: kit.tool({ kind: 'hammer', metal: '#8a6a4a', handle: '#5a3a1a' }),
  },
  winch_handle: {
    name: 'Winch handle',
    examine: 'A cranked iron handle with a square socket. Its plate says it lowers the foyer chandelier.',
    drawIcon: kit.tool({ kind: 'crank', metal: '#6a6a6a', handle: '#3a2a1a' }),
  },
  ear_trumpet: {
    name: 'Ear trumpet',
    examine: 'Brass, dented, tagged LOST 14.3.31 — STALLS ROW C — UNCLAIMED. Its owner presumably missed the announcement.',
    drawIcon: trumpetIcon,
  },
  key_chain: {
    name: 'Auditorium key',
    examine: 'A key on a tag: AUDITORIUM DOORS. Crane kept it in the safe, with the money he did not leave.',
    drawIcon: kit.key({ color: '#c9a24a', teeth: 3, tag: '#e8d8a8' }),
  },
  ticket: {
    name: 'Royal Box ticket',
    examine: 'ROYAL BOX · BOX A · ONE GUINEA · SAT 14 MAR 1931 · ADMIT ONE. Still warm from the machine.',
    drawIcon: kit.ticket({ color: '#e8c86a', text: 'BOX A' }),
  },
  winder: {
    name: 'Gramophone winder',
    examine: 'A small crank for a portable gramophone. Harold left it where only the right order of drawers would find it.',
    drawIcon: kit.tool({ kind: 'crank', metal: '#c9a24a', handle: '#2a1a10' }),
  },
  lastpage: {
    name: 'The last page',
    examine: 'Page 97 of the prompt book, folded small. Ten cue boxes in pencil down the margin.',
    drawIcon: kit.paper({ color: '#f0e3c4', lines: 6, torn: true }),
  },
};

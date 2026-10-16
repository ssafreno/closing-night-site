// Papers found on the stage (docs/rooms/stage.md, Documents). WRITER owns this file. Shape: see src/content/papers.js.
// The prompt book is 8 pages: pp.1-5 from stage.md, p.6 wardrobe.md, p.7 pit.md, p.8 the last page (dressing.md),
// torn out until the finale places it (state key `finale.pageplaced`, set by FINALE when Pike takes `lastpage`).
// html is pre-wrap: no stray newlines between tags.
import { LASTPAGE_TITLE, LASTPAGE_HTML } from './_lastpage.js';

const pencil = (t) => `<span class="cn-pencil">${t}</span>`;
// FIXED BY qa-stage: the typewriter face draws ¼ ½ ¾ as tiny unreadable glyphs at 1280x800; set them in a serif at a readable size.
const F = (t) => `<span style="font-family:Georgia,'Times New Roman',serif;font-size:1.3em;line-height:1">${t}</span>`;

// p.5: the ground plan. Audience at the bottom, so PROMPT (stage left) is bottom right and R.C. is left of centre.
// BLUE at R.C., RED at centre, YELLOW at L.C.; the octagon on BLUE with its door bar on the prompt-side (right) face.
// SET: the spike marks on the floor must match this drawing (or tell WRITER).
const marks = (cx, cy, col) => {
  const d = 30, a = 9;
  const L = (x, y, sx, sy) => `<path d="M${x + sx * a} ${y}H${x}V${y + sy * a}" stroke="${col}" stroke-width="3" fill="none"/>`;
  return L(cx - d, cy - d, 1, 1) + L(cx + d, cy - d, -1, 1) + L(cx - d, cy + d, 1, -1) + L(cx + d, cy + d, -1, -1);
};
const oct = (cx, cy, r) => {
  const p = [];
  for (let k = 0; k < 8; k++) { const t = (Math.PI / 8) + k * Math.PI / 4; p.push(`${(cx + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`); }
  return `<polygon points="${p.join(' ')}" fill="#e6dcc2" stroke="#3a3a3a" stroke-width="2"/>`;
};
const T = (x, y, s, t, extra = '') => `<text x="${x}" y="${y}" font-size="${s}" text-anchor="middle" fill="#3a3a3a" font-family="'Special Elite','Courier New',monospace"${extra}>${t}</text>`;
const GROUND_PLAN = '<svg viewBox="0 0 420 320" width="100%" style="max-width:460px;display:block;margin:0 auto" role="img" aria-label="Ground plan, Act III Scene 2">'
  + '<rect x="30" y="20" width="360" height="240" fill="none" stroke="#3a3a3a" stroke-width="2"/>'
  + '<line x1="34" y1="52" x2="386" y2="52" stroke="#3a3a3a" stroke-width="1.5" stroke-dasharray="7 5"/>'
  + T(210, 44, 11, 'GULL PT. CLOTH (line 7)')
  + marks(120, 140, '#2f5aa8') + marks(210, 140, '#b03a2e') + marks(300, 140, '#c9a227')
  + T(210, 190, 12, 'RED') + T(300, 190, 12, 'YELLOW')
  + oct(120, 140, 26)
  + '<line x1="144" y1="129" x2="144" y2="151" stroke="#7a1a12" stroke-width="6"/>'
  + T(120, 144, 10, 'LH')
  + T(120, 190, 12, 'BLUE', ' font-weight="700"') + T(120, 204, 11, 'R.C.')
  + '<path d="M150 150 C200 200 260 214 318 228" stroke="#3a3a3a" stroke-width="1.5" fill="none"/>'
  + '<path d="M318 228 l-12 -1 l6 -9 z" fill="#3a3a3a"/>'
  + '<rect x="192" y="214" width="36" height="24" fill="none" stroke="#3a3a3a" stroke-width="1.5"/>'
  + T(210, 230, 10, 'TRAP')
  + T(350, 250, 13, 'PROMPT', ' font-weight="700"') + T(66, 250, 13, 'O.P.')
  + T(210, 290, 13, 'AUDIENCE')
  + '</svg>';

export const papers = {
  promptbook: {
    title: 'Prompt Book',
    journalTitle: "Harold Pike's prompt book",
    journalTab: 'Prompt Book',
    style: 'typed',
    pages: [
      { // p.1
        title: 'The Lamp at Gull Point',
        html: 'A Drama in Three Acts and a Storm\nEmpress Theatre, Pelham Street\nPrompt copy — H. Pike, S.M.\n\n'
          + 'GRACE TREMAYNE, the keeper\'s daughter ... Miss Lavinia Thrush\n'
          + 'EZRA TREMAYNE, keeper of the Gull Point light ... Mr Bertram Volley\n'
          + 'CAPTAIN JACK PENHALLOW, of the brig <i>Merry Widow</i> ... Mr Rupert Dane\n'
          + 'WIDOW PENGELLY ... Miss Ada Moss\n'
          + 'Smugglers, fishermen, a dog (cut).\n\n'
          + pencil('Do not remove from prompt corner.'),
      },
      { // p.2
        title: 'Running Order of the Production',
        html: 'Act I — The Keeper\'s Cottage (red spike)\n'
          + 'Act II — The Wreckers\' Tavern (yellow spike)\n'
          + 'Act III Sc.1 — The Cliff (front cloth)\n'
          + 'Act III Sc.2 — Gull Point (Gull Pt cloth, line 7; lighthouse truck, blue spike)\n\n'
          + 'ABBREVIATIONS\n'
          + 'SB stand by · GO go · LX lighting · FLY fly rail · FX effects · SOUND pit · WARDROBE dresser · HOUSE front of house',
      },
      { // p.3
        title: 'Lighting Plot (Wm. Sparks)',
        html: 'Levels: Battens / Floats / Limes / Blues\n\n'
          + 'Q1  Act I preset: ' + F('¾') + ' / ' + F('½') + ' / ' + F('½') + ' / OUT\n'
          + 'Q12 Act II tavern: ' + F('½') + ' / ' + F('¾') + ' / ' + F('¼') + ' / OUT\n'
          + 'Q20 Act III Sc.1 cliff: ' + F('¼') + ' / ' + F('¼') + ' / OUT / ' + F('¾') + '\n\n'
          + '<b>Q34 Act III Sc.2 MOONLIGHT: ' + F('¼') + ' / OUT / ' + F('½') + ' / FULL</b>\n\n'
          + 'Q37 THE LAMP: lighthouse practical FULL, Limes FULL on Miss T.\n\n'
          + pencil('Floats OUT in 34 or she complains of her chins. — W.S.'),
      },
      { // p.4
        title: 'Fly Plot',
        html: 'Line · Piece · Weight · Cues\n\n'
          + '1 Tabs (house curtain) · balanced · Q33 OUT, Q39 IN\n'
          + '2 Border 1 · balanced · dead\n'
          + '3 LX bar 1 · balanced · dead\n'
          + '4 Cloth: Cottage · 98 lb · out after Act I\n'
          + '5 Border 2 · balanced · dead\n'
          + '6 Cloth: Tavern · 105 lb · out after Act II\n'
          + '<b>7 Cloth: GULL POINT · 112 lb · IN to white tape for III.2</b>\n'
          + '8 Cyc · balanced · dead\n\n'
          + pencil('7 unloaded 14.3 for the get-out. Reload before flying in. — H.P.'),
      },
      { // p.5
        title: 'Ground Plan, Act III Sc.2',
        html: GROUND_PLAN + '\n<b>LIGHTHOUSE truck on BLUE spike, R.C., door facing the PROMPT side, brake ON.</b>',
      },
      { // p.6 (wardrobe.md)
        title: 'Costume Plot (M. Bright)',
        html: 'Miss Thrush (Grace): Act I — lilac walking dress. Act II — blue velvet. Act III Sc.1 — dove-grey cloak over storm gown.\n\n'
          + '<b>Act III Sc.2 — STORM GOWN: grey silk bodice, storm-grey skirt, sea-green oilskin cape.\n'
          + 'Dress from the skin out: petticoat, skirt, bodice, cape.</b>\n\n'
          + 'Cloak on a quick-release for Q36.\n\n'
          + 'Miss Moss (Widow Pengelly): black bombazine; Act III grey silk bodice, green shawl.\n'
          + 'Mr Volley (Ezra): fisherman\'s jersey; oilskins Act III.\n'
          + 'Mr Dane (Jack): naval coat; Act III wet shirt (dampen at interval).\n\n'
          + pencil('Storm skirt hem DOWN again. At the machine. — M.B.'),
      },
      { // p.7 (pit.md)
        title: 'Music & Effects Plot',
        html: 'SOUND Q32 — OVERTURE: The Empress March. Pit pianola; roll from the rack ("the one that goes upstairs" — P.). Piano TUNED to the fork before the half.\n\n'
          + 'FX Q35 — STORM: wind machine at GALE, governor on. Rain drum runs off the wind shaft (idler: 24-tooth, spare on the shelf).\n\n'
          + 'FX Q38 — THUNDER: the sheet, one big one, with the lightning flash.\n\n'
          + pencil('Beater keeps walking off. Check the drums. — H.P.'),
      },
      { // p.8: torn out until the finale (dressing.md / DESIGN §4)
        title: LASTPAGE_TITLE,
        requires: 'finale.pageplaced',
        missing: {
          title: 'p. 97 — Act III Sc.2 (final)',
          html: 'Torn out at the stitching. A ragged stub of paper and nothing else.\n\n' + pencil('L. has it. Ask nicely. — H.P.'),
        },
        html: LASTPAGE_HTML,
      },
    ],
  },

  fusetag: {
    title: 'Mains',
    style: 'card',
    journalTitle: 'The luggage label on the mains box',
    body: 'Fuses drawn 14.3.31 on account of the gas being cut (I know, I know).\n\n'
      + 'Put somewhere safe:\n*FIRE BUCKET · PROPS TABLE · FLY RAIL.*',
    signature: '— Wm. Sparks, Elec.',
  },
};

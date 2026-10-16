// Papers found in the Foyer & Box Office (docs/rooms/foyer.md, Documents). WRITER owns this file.
// Shape: see src/content/papers.js. html is pre-wrap: no stray newlines between tags.

// the framed seating plan: stage at the top; boxes A and B on house left (the page's left, the audience facing up),
// C and D on house right; Box A nearest the stage, with a crown and ROYAL
const T = (x, y, s, t, extra = '') => `<text x="${x}" y="${y}" font-size="${s}" text-anchor="middle" fill="#3a2414" font-family="Georgia,serif"${extra}>${t}</text>`;
const box = (x, y, id, royal) => `<rect x="${x}" y="${y}" width="34" height="40" rx="4" fill="${royal ? '#e9c46a' : 'none'}" stroke="#3a2414" stroke-width="1.6"/>`
  + T(x + 17, y + 26, 15, id, ' font-weight="700"');
const CROWN = (x, y) => `<path d="M${x - 10} ${y}l3 -10l4 6l3 -9l3 9l4 -6l3 10z" fill="#b8862b" stroke="#3a2414" stroke-width="1"/>`;
const rows = 'ABCDEFGHIJKLMNOP'.split('').map((r, i) => {
  const y = 128 + i * 9;
  return `<line x1="120" y1="${y}" x2="300" y2="${y}" stroke="#8a6a4a" stroke-width="1" stroke-dasharray="3 2"/>`
    + `<text x="112" y="${y + 3}" font-size="7" text-anchor="end" fill="#3a2414" font-family="Georgia,serif">${r}</text>`;
}).join('');
const SEATPLAN = '<svg viewBox="0 0 420 384" width="100%" style="max-width:440px;display:block;margin:0 auto" role="img" aria-label="seating plan: stage at the top; Box A, the Royal Box, nearest the stage on house left">'
  + '<rect x="110" y="16" width="200" height="40" fill="#7a1c2a" opacity="0.85"/>' + T(210, 42, 15, 'STAGE', ' fill="#f6ecd2" letter-spacing="4"')
  + '<path d="M130 62h160v26h-160z" fill="none" stroke="#3a2414" stroke-width="1.4"/>' + T(210, 80, 11, 'PIT')
  + rows + T(210, 284, 11, 'STALLS')
  + '<path d="M100 296 Q210 320 320 296" fill="none" stroke="#3a2414" stroke-width="1.6"/>' + T(210, 328, 11, 'DRESS CIRCLE')
  + '<path d="M86 342 Q210 366 334 342" fill="none" stroke="#3a2414" stroke-width="1.6"/>' + T(210, 374, 11, 'GALLERY')
  + box(56, 70, 'A', true) + CROWN(73, 66) + T(73, 124, 10, 'ROYAL', ' font-weight="700"')
  + box(56, 140, 'B') + box(330, 70, 'C') + box(330, 140, 'D')
  + T(73, 210, 9, 'HOUSE LEFT') + T(347, 210, 9, 'HOUSE RIGHT')
  + '</svg>';

export const papers = {
  lastnight: {
    kicker: 'Empress Theatre · Pelham Street',
    title: 'Last Night',
    style: 'playbill',
    journalTitle: 'The last-night bill (mended)',
    body: 'SATURDAY 14th MARCH 1931 at 7.30\n\n'
      + 'Miss *LAVINIA THRUSH*\nin\n*THE LAMP AT GULL POINT*\nA Drama in Three Acts and a Storm\n\n'
      + 'with Mr Bertram Volley · Mr Rupert Dane · Miss Ada Moss\n\n'
      + '"Miss Thrush is in it." — *Pelham Gazette*\n\n'
      + 'PRICES: Gallery 6d · Pit 1/- · Stalls 3/6 · Dress Circle 5/- · Boxes 10/6\n'
      + '*THE ROYAL BOX (Box A) One Guinea*',
  },

  prices: {
    kicker: 'Box Office',
    title: 'Prices including Tax',
    style: 'programme',
    journalTitle: 'The price board',
    body: 'Gallery 6d\nPit 1/-\nUpper Circle 2/6\nStalls 3/6\nDress Circle 5/-\nBoxes B, C, D 10/6 per seat\n\n'
      + '*ROYAL BOX (A) £1 1s*\n\nProgrammes 2d',
  },

  seatplan: {
    title: 'Seating Plan',
    style: 'programme',
    journalTitle: 'The seating plan',
    html: SEATPLAN,
  },

  wiringcard: {
    title: 'House Board',
    style: 'card',
    journalTitle: "Sparks's card on the house board",
    body: 'Mr Crane\'s "economy" wiring:\nevery switch ALSO throws its neighbours.\n\nFor a full house:\n*trip it, then STALLS and CIRCLE only.*',
    signature: '— Wm. Sparks',
  },

  iou: {
    title: 'IOU',
    style: 'notepaper',
    journalTitle: 'A half-sheet in the takings envelope',
    body: 'IOU the takings, week ending 14 March 1931.',
    signature: '— S. Crane',
  },

  contract: {
    kicker: 'Empress Theatre, Pelham Street',
    title: 'Theatrical Engagement',
    style: 'legal',
    journalTitle: "Lavinia's contract",
    html: 'between Mr Silas Crane (the Management) and Miss Lavinia Thrush (the Artiste), for <i>The Lamp at Gull Point</i> and any extension of the run.\n\n'
      + "Artiste's particulars:\n"
      + 'born <span class="cn-hand">2nd April 1877</span>, <span class="cn-hand">Pelham</span>.\n'
      + 'Height: <span class="cn-hand">tall</span>. Salary: <span class="cn-hand">£12</span> per week, payable Saturdays.\n\n'
      + 'The Artiste shall have Dressing Room No. 1, lilies on closing nights, and top billing in letters no smaller than the Management\'s own.\n\n'
      + 'The Artiste shall not be required to appear with goats.',
  },

  ordinarycat: {
    kicker: 'Next Season',
    title: 'An Ordinary Cat',
    style: 'playbill',
    journalTitle: 'An Ordinary Cat (poster)',
    body: 'a comedy in three rooms\n\n"Don\'t mind me."',
  },
};

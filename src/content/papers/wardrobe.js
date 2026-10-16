// Papers found in Wardrobe (docs/rooms/wardrobe.md, Documents). WRITER owns this file. Shape: see src/content/papers.js.
// (The prompt book's p.6, the costume plot, lives in papers/stage.js with the rest of the book.)

// the props card's pencil drawing: a five-tier beehive lens on a brass base, biggest ring at the base
const tiers = [0, 1, 2, 3, 4].map((i) => {
  const w = 120 - i * 20, h = 18, y = 150 - i * (h + 3), x = 100 - w / 2;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="none" stroke="#5a5a5a" stroke-width="1.6"/>`
    + `<line x1="${x + 6}" y1="${y + h / 2}" x2="${x + w - 6}" y2="${y + h / 2}" stroke="#9a9a9a" stroke-width="1"/>`;
}).join('');
const BEEHIVE = '<svg viewBox="0 0 200 210" width="170" style="display:block;margin:6px auto" role="img" aria-label="a pencil drawing of a five-ring beehive lens, biggest ring at the base">'
  + '<ellipse cx="100" cy="52" rx="10" ry="8" fill="none" stroke="#5a5a5a" stroke-width="1.4"/>'
  + tiers
  + '<rect x="30" y="170" width="140" height="14" fill="none" stroke="#5a5a5a" stroke-width="2"/>'
  + '<line x1="22" y1="190" x2="178" y2="190" stroke="#5a5a5a" stroke-width="1.6"/>'
  + '</svg>';

export const papers = {
  marks: {
    title: "Molly's Marks",
    style: 'card',
    journalTitle: "Molly's marks (the wardrobe code)",
    body: '*SHOW* (stamp):\nlighthouse = GULL POINT\ncrown = THE PRETENDER\'S CROWN\nheart = SWEET NELL\n\n'
      + '*THREAD:*\nlilac = Miss THRUSH · green = Miss MOSS\nbrown = Mr VOLLEY · navy = Mr DANE\n\n'
      + '*NOTCHES* = the Act.\n\nTouch nothing without asking.',
    signature: '— M.B.',
  },

  orderpad: {
    title: 'Order pad',
    style: 'notepaper',
    journalTitle: "Molly's order pad (rubbed)",
    // FIXED BY qa-wardrobe: capitals in the handwriting face (Homemade Apple) are illegible at 1280x800 ("RED",
    // "BOTTOM" read as scribble), so Molly's emphasis is underlined lower case instead
    html: 'Thrush storm cape — oilskin, sea-green —\n<em>in the <u>red</u> hatbox, <u>bottom</u> of the pile</em> (sorry).\n\nStorm skirt hem at the machine.',
    signature: '— M.',
  },

  sewingnote: {
    title: 'The machine',
    style: 'notepaper',
    journalTitle: 'Note above the sewing machine',
    // FIXED BY qa-wardrobe: as orderpad, the all-capitals words were unreadable in the hand face
    html: '<em><u>Oil her first.</u></em>\n\nThen treadle in <u>waltz time</u>:\n<em><u>One</u> two three, <u>One</u> two three.</em>\n\nTreadle on the <u>one</u> or she jams.',
    signature: '— M.',
  },

  propcard: {
    kicker: 'Props — Gull Point',
    title: 'The Lamp (practical)',
    style: 'card',
    journalTitle: 'Props card: the lamp',
    html: BEEHIVE + 'Beehive lens: five rings,\n<b>BIGGEST AT THE BASE.</b>\n\nMind the glass. Bulb 60 w.',
    signature: '— M.B. (props)',
  },

  dummycard: {
    title: 'On the dummy',
    style: 'card',
    journalTitle: "Label on the dressmaker's dummy",
    body: '*DRESS FROM THE SKIN OUT.*',
    signature: '— M.',
  },
};

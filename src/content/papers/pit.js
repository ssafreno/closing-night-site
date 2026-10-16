// Papers found in the Pit (docs/rooms/pit.md, Documents). WRITER owns this file. Shape: see src/content/papers.js.
// (The prompt book's p.7, the music & effects plot, lives in papers/stage.js with the rest of the book.)

const F = "font-family=\"'CN Hand Caps','Homemade Apple',cursive\""; // POLISH: legible capitals (ui.css)

// the first bar of The Empress March: C (ledger line), E, G, C' rising, with Pozzi's pencil letters under them
const STAVE = (() => {
  const lines = [60, 70, 80, 90, 100].map((y) => `<line x1="30" y1="${y}" x2="380" y2="${y}" stroke="#2a2a2a" stroke-width="1.2"/>`).join('');
  const notes = [[150, 110, 'C'], [205, 100, 'E'], [260, 90, 'G'], [315, 75, 'C′']];
  const heads = notes.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="5" transform="rotate(-20 ${x} ${y})" fill="#1a1a1a"/>`
    + `<line x1="${x + 6.5}" y1="${y - 1}" x2="${x + 6.5}" y2="${y - 34}" stroke="#1a1a1a" stroke-width="1.6"/>`).join('');
  const ledger = '<line x1="138" y1="110" x2="162" y2="110" stroke="#2a2a2a" stroke-width="1.2"/>';
  const letters = notes.map(([x, , l]) => `<text x="${x}" y="142" font-size="15" fill="#6a6a6a" text-anchor="middle" ${F}>${l}</text>`).join('');
  return '<svg viewBox="0 0 400 160" width="100%" style="max-width:460px;display:block;margin:4px auto" role="img" aria-label="one stave: four rising notes, C, E, G, C">'
    + lines + '<line x1="30" y1="60" x2="30" y2="100" stroke="#2a2a2a" stroke-width="1.2"/>'
    + '<text x="40" y="78" font-size="18" font-weight="700" fill="#1a1a1a" font-family="serif">6</text>'
    + '<text x="40" y="98" font-size="18" font-weight="700" fill="#1a1a1a" font-family="serif">8</text>'
    + ledger + heads + letters
    + '<line x1="360" y1="60" x2="360" y2="100" stroke="#2a2a2a" stroke-width="1.2"/>'
    + '</svg>';
})();

// the band plan: five numbered circles from the steps end, conductor at the far end facing the stage
const BAND = (() => {
  const names = ['HARP', 'TUBA', 'CELLO', 'DRUMS & FX', 'TROMBONE'];
  const circles = names.map((n, i) => {
    const x = 80 + i * 60;
    return `<circle cx="${x}" cy="80" r="17" fill="none" stroke="#5a5a5a" stroke-width="1.6"/>`
      + `<text x="${x}" y="86" font-size="15" text-anchor="middle" fill="#4a4a4a" ${F}>${i + 1}</text>`
      + `<text x="${x}" y="${i % 2 ? 128 : 116}" font-size="9" text-anchor="middle" fill="#5a5a5a" font-family="serif">${n.replace('&', '&amp;')}</text>`;
  }).join('');
  return '<svg viewBox="0 0 420 150" width="100%" style="max-width:460px;display:block;margin:4px auto" role="img" aria-label="pit plan: 1 harp, 2 tuba, 3 cello, 4 drums and effects, 5 trombone, conductor at the far end">'
    + '<rect x="14" y="44" width="392" height="96" rx="20" fill="none" stroke="#5a5a5a" stroke-width="1.6"/>'
    + '<line x1="14" y1="30" x2="406" y2="30" stroke="#5a5a5a" stroke-width="2.4"/>'
    + `<text x="210" y="22" font-size="11" text-anchor="middle" fill="#5a5a5a" font-family="serif" letter-spacing="3">STAGE</text>`
    + '<path d="M22 60h14M22 70h14M22 80h14M22 90h14M22 100h14" stroke="#5a5a5a" stroke-width="1.4"/>'
    + `<text x="29" y="118" font-size="9" text-anchor="middle" fill="#5a5a5a" font-family="serif">STEPS</text>`
    + circles
    + '<rect x="372" y="70" width="16" height="20" fill="none" stroke="#5a5a5a" stroke-width="1.6"/>'
    + '<path d="M380 66 V48" stroke="#5a5a5a" stroke-width="1.4"/><path d="M380 44 l-4 7 h8 z" fill="#5a5a5a"/>'
    + `<text x="380" y="106" font-size="9" text-anchor="middle" fill="#5a5a5a" font-family="serif">COND.</text>`
    + '</svg>';
})();

export const papers = {
  tunercard: {
    title: 'Sig. A. Pozzi',
    kicker: 'Pianoforte & Pianola',
    style: 'card',
    journalTitle: "Pozzi's card (pencil on the back)",
    html: '<span class="cn-pencil" style="font-size:0.85em">A unison: tune each string to the fork.\n\n'
      + 'Turn till the beat stops and the paper sits still.\n\n'
      + 'Never past a quarter-turn.</span>',
  },

  score: {
    kicker: 'Overture — Pit piano',
    title: 'The Empress March',
    style: 'page',
    journalTitle: 'The Empress March (score)',
    html: STAVE + '<span class="cn-pencil" style="font-size:0.9em">C · E · G · C′ — like going upstairs</span>\n\n'
      + 'Pianola roll in the rack.',
  },

  bandplan: {
    title: "Pit — Sig. Pozzi's band",
    style: 'notepaper',
    journalTitle: 'The band plan',
    html: BAND + '1 HARP · 2 TUBA · 3 CELLO\n4 DRUMS &amp; EFFECTS (thunder beater lives here!)\n5 TROMBONE\n\n'
      + 'Conductor at the far end, facing the stage.',
  },
};

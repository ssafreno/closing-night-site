// Papers found in the door room (docs/rooms/door.md, Documents). WRITER owns this file. Shape: see src/content/papers.js.
// Clue lines are verbatim from the spec and set apart on their own line; html is written without stray newlines
// because the paper body is white-space: pre-wrap.

// a small paw print for the sign-in book's IN column
const PAW = '<svg width="26" height="24" viewBox="0 0 26 24" aria-label="a paw print" role="img" style="vertical-align:middle">'
  + '<g fill="#5a4636" opacity="0.8"><ellipse cx="13" cy="16" rx="6" ry="5"/><circle cx="5" cy="9" r="2.6"/>'
  + '<circle cx="10" cy="5" r="2.6"/><circle cx="16" cy="5" r="2.6"/><circle cx="21" cy="9" r="2.6"/></g></svg>';

const row = (name, inn, out = '') => `<tr><td>${name}</td><td>${inn}</td><td>${out}</td></tr>`;
const head = '<tr><th>NAME</th><th>IN</th><th>OUT</th></tr>';

export const papers = {
  certificate: {
    kicker: 'Borough of Pelham — Building Control',
    title: 'Certificate of Vacancy',
    style: 'certificate',
    journalTitle: 'Certificate of Vacancy (your clipboard)',
    body: 'Premises: The Empress Theatre, Pelham Street.\n\n'
      + 'I certify that I have inspected the above premises and that they are *VACANT*, unoccupied and fit for conversion.\n\n'
      + 'Date of inspection: 14 March 2026 (night).\n'
      + 'Inspector: ____________\n\n'
      + 'Remarks: ______________________________',
  },

  callboard: {
    kicker: 'Empress Theatre, Pelham Street',
    title: 'Calls',
    style: 'typed',
    journalTitle: 'The call board',
    body: 'SATURDAY 14th MARCH 1931 — *CLOSING NIGHT*\n\n'
      + 'Matinee: The Half 1.55 · Beginners 2.25 · Curtain 2.30\n\n'
      + 'Evening: *The Half 6.55* · Beginners 7.25 · Curtain 7.30\n\n'
      + 'All company to sign in BY THE HALF.\nNo whistling backstage. No guests in the wings.',
    signature: '— H. Pike, Stage Manager',
  },

  alfnote: {
    title: 'Key Press',
    style: 'notepaper',
    journalTitle: "Alf's note, on a torn envelope",
    html: '<span class="cn-pencil" style="font-size:1em">The combination is the Half.\n\n'
      + "SATURDAY'S Half, not the matinee.\n\n"
      + "Don't ask me again. — A.H.</span>",
  },

  signinbook: {
    title: 'Sign-in Book',
    style: 'ledger',
    journalTitle: 'The sign-in book',
    pages: [
      {
        title: 'Saturday 14th March 1931',
        html: '<table>' + head
          + row('Miss M. Bright (Wardrobe)', '4.00')
          + row('Wm. Sparks (Elec.)', '5.00')
          + row('Miss D. Fenn (Dresser)', '5.15')
          + row('<span class="cn-hand">Miss L. Thrush</span>', '5.30')
          + row('Mr B. Volley', '6.10')
          + row('Miss A. Moss', '6.15')
          + row('Mr R. Dane', '6.20')
          + row('Sig. Pozzi (Piano)', '6.30')
          + row('Mr H. Pike, S.M.', '3.00 <span class="cn-pencil">(called the Half 6.55)</span>')
          + row('', PAW)
          + '</table>',
      },
      {
        // the player's own line, once they sign (door.signed)
        title: 'Saturday 14th March 2026',
        requires: 'door.signed',
        // FIXED BY qa-door: `missing` must carry html, not body: Papers spreads it over the page, so a body here left the
        // page's own html (the signed line) showing before the player had signed
        missing: { title: 'Saturday 14th March 2026', html: 'A fresh page, ruled and empty.' },
        html: '<table>' + head
          + row('<span class="cn-hand">The Inspector (Borough of Pelham)</span>', '<span class="cn-hand">11.14</span>')
          + '</table>',
      },
    ],
  },
};

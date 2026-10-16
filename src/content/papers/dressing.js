// Papers found in Dressing Room No. 1 (docs/rooms/dressing.md, Documents). WRITER owns this file.
// Shape: see src/content/papers.js. `lastpage` shares its text with the prompt book's p.8 (papers/_lastpage.js).
import { LASTPAGE_TITLE, LASTPAGE_HTML } from './_lastpage.js';

// Pike's small pencil capitals (the same hand as the prompt-book annotations)
// (drawn in the typewriter face in pencil grey: the handwriting face's capitals are not legible at this size)
const pikeHand = (t) => `<span style="font-family:'Special Elite','Courier New',monospace;font-size:0.92em;letter-spacing:0.05em;color:#5a5a5a">${t}</span>`;

export const papers = {
  beginners: {
    title: "Miss T.'s Beginners",
    style: 'card',
    journalTitle: "Dot's card (read in the mirror)",
    body: "she will not go on otherwise, so DON'T VARY IT:\n\n*1. GLOVES\n2. PEARLS\n3. FEATHERS* (the aigrette)\n*4. A LILY* in the hand.\n\nThen the call.",
    signature: '— Dot',
  },

  birthday: {
    title: 'Post Office Telegram',
    style: 'telegram',
    journalTitle: 'A birthday telegram, 2 April 1930',
    body: 'Handed in BRIGHTON 9.02 AM · 2 APR 1930\nTO MISS L THRUSH EMPRESS THEATRE PELHAM ST\n\n'
      + 'MANY HAPPY RETURNS ON YOUR *FIFTY-THIRD* DARLING STOP\n\nSTILL THE YOUNGEST IN EVERY PROGRAMME STOP\n\nMOTHER',
  },

  crane: {
    title: 'Post Office Telegram',
    style: 'telegram',
    journalTitle: "Crane's telegram (read off the ash)",
    body: 'Handed in PELHAM STATION 6.40 PM · 14 MAR 31\nTO MISS THRUSH EMPRESS THEATRE PELHAM ST\n\n'
      + 'CANNOT PAY COMPANY STOP\nCANCEL TONIGHT STOP\nTAKINGS GONE WITH ME STOP\nSORRY OLD GIRL STOP\n\nCRANE',
  },

  pikenote: {
    title: 'L.',
    style: 'notepaper',
    journalTitle: "Harold's note, in the hidden drawer",
    html: pikeHand("FRONT OF HOUSE IS DARK. COMPANY'S GONE HOME. CRANE'S GONE WITH THE TAKINGS.\n\n"
      + "YOU'VE GOT MY LAST PAGE AND YOU'RE WELCOME TO IT.\n\n"
      + "I'LL STAND BY AS LONG AS YOU LIKE.\n\n— H."),
  },

  lilycard: {
    title: 'For Closing Night',
    style: 'card',
    journalTitle: 'The card in the lilies',
    html: pikeHand('FOR CLOSING NIGHT.\n\n— AN ADMIRER.'),
  },

  lastpage: {
    title: LASTPAGE_TITLE,
    style: 'typed',
    journalTitle: 'The last page (p. 97)',
    html: LASTPAGE_HTML,
  },
};

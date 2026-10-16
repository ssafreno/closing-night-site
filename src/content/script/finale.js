// Lines for the Finale, calling the show (docs/rooms/finale.md), the ending and the credits. WRITER owns this file.
// Room agents: ADD keys (marked // ADDED BY <agent>), never rewrite lines. Pike is the hint-giver here.
// The play's lines (finale.play.*) are verbatim from the last page: they are cue triggers, do not edit them.
import { L, O, P, N } from './speakers.js';

export const complete = true;

// the ten cues, in order, with the department each one presses (DESIGN §4; finale.md cue table)
const CUES = [
  ['q31', 'HOUSE'], ['q32', 'SOUND'], ['q33', 'FLY'], ['q34', 'LX'], ['q35', 'FX'],
  ['q36', 'WARDROBE'], ['q37', 'LX'], ['q38', 'FX'], ['q39', 'FLY'], ['q40', 'HOUSE'],
];

const REVIEWS = {
  triumph: {
    text: 'A triumph. The Empress lives.',
    reply: [L('A triumph. Did you hear that, Harold? In writing.'), L('Darling. Have it framed.')],
    headline: 'EMPRESS TRIUMPH: 95-YEAR RUN ENDS IN GLORY',
    standfirst: 'Closing night of The Lamp at Gull Point finally goes up at the Empress, Pelham Street. Critics: one inspector, one cat.',
  },
  long: {
    // the one place she says it: deliberate, and the last thing she says about it
    text: 'Unforgettable. A touch long.',
    reply: [L("Unforgettable. I'll take unforgettable."), L('Long? Darling, it ran ninety-five years.')],
    headline: "THRUSH 'UNFORGETTABLE', SAYS COUNCIL",
    standfirst: 'Borough inspector files remarks on a single performance at the Empress. Running time disputed.',
  },
  seen: {
    text: 'I have seen it.',
    reply: [L('Oh.'), L("*The Times* said that in 1909. I've waited all my life to hear it to my face.")],
    headline: 'COUNCIL INSPECTOR HAS SEEN IT',
    standfirst: 'Four words in the Remarks box of a Certificate of Vacancy. The Empress, Pelham Street, is not vacant.',
  },
};

const lines = {
  // ── entry (played on the stage, after THE SCRIPT) ──────────────────────────────────────────────────────────
  'pike.beginners': [P('Beginners, please.')],
  'loose.lamp.finale': [P("Lamp's not in the lighthouse. Not going up without it.")],
  'finale.lastpage': [P('Last page.'), N('He tucks it into the book, smooths it flat once, and pins the book open on the desk.')],

  // ── the finale room ────────────────────────────────────────────────────────────────────────────────────────
  'finale.enter': [
    N('The prompt corner. A green-shaded lamp, a book pinned open, six brass buttons.'),
    P('Your book. I stand by.'),
  ],
  'finale.enter.note': [P('Ten cues on the page. Wait for the line, then go.')],
  'finale.idle.1': [P('Book open. Light on. Standing by.')],
  'finale.idle.2': [P("Cat's in the box. That's a house.")],
  'finale.idle.3': [P('She changes the last speech nightly. Cue off the line.')],
  'finale.return': [P('Where were we. Next cue. Standing by.')],
  'finale.done': [N('The house is open.')],

  // ── before Q31 ─────────────────────────────────────────────────────────────────────────────────────────────
  'finale.breakaleg.pike': [P('Break a leg, Lavinia.')],
  'finale.breakaleg.lavinia': [L("Harold. You've never said that.")],
  'finale.breakaleg.pike2': [P('Never had the chance. Stand by Q31.')],
  'finale.places': [P('Places, please.')], // Q31's trigger

  // ── the cues ───────────────────────────────────────────────────────────────────────────────────────────────
  // standby calls name the number only; the department is the player's to read (hint level 3 names it)
  'finale.houseout': [P('House is out.')],
  'finale.cues.wait': [ // pool: 8 s without a press, then every 15 s
    [L('Darling? The cue?')],
    [L('Any time, darling. I can hold a pose for years.')],
    [L('The cue, darling. Gull Point is waiting. So am I.')],
  ],
  'finale.cues.early': [P('Wait for it.')],
  'finale.cues.wrong.1': [P("That's not the cue.")],
  'finale.cues.wrong.2': [P('Wrong button. Still live.')],
  'finale.cues.wrong.3': [P('No. Read the page.')],

  // ── the play: verbatim, Ezra in her comic gruff register ───────────────────────────────────────────────────
  'finale.play.grace1': [L('Father, the sea is coming in!')],
  'finale.play.ezra1': [L('The door is barred, girl. The oil is gone.')],
  'finale.play.grace2': [L('Then I shall light it myself.')],
  'finale.play.grace3': [L('Burn, old lamp. Burn for him.')],
  'finale.play.grace4': [L('...and the sea gave him back to me.')],
  'finale.play.ezra2': [L('Forgive me, Grace.')],
  'finale.play.grace5': [L('Gull Point will keep its light.')],

  // ── applause and the call ──────────────────────────────────────────────────────────────────────────────────
  'finale.applause': [O('Did you hear that? A full house.')], // behind the tabs
  'finale.call': [P('Tabs out for the call.')],

  // ── the review ─────────────────────────────────────────────────────────────────────────────────────────────
  'ending.review.ask': [L("Well, darling? You're the only one with a pen.")],
  'ending.review.read': [N('You read it aloud.')],

  // ── after Q40 ──────────────────────────────────────────────────────────────────────────────────────────────
  'ending.thanks': [L('Thank you, darling. Strike the set gently.')],
  'ending.pike': [P("That's the show.")],
  'ending.dawn': [N("The stage door is open. It's morning.")],
  'ending.notvacant': 'Not vacant.', // written in her hand under the review; text only, no dialogue box

  // ── credits (Pelham Gazette front page, then the roll) ─────────────────────────────────────────────────────
  'credits.masthead': 'THE PELHAM GAZETTE',
  'credits.dateline': 'Sunday 15 March 2026',
  'credits.time': 'Running time: {time}.', // {time} = elapsed play time, filled by the finale
  'credits.foot': 'The house is open.',

  // ── hints (Pike) ───────────────────────────────────────────────────────────────────────────────────────────
  'hint.cues.1': [P('Read the page.')],
  'hint.cues.2': [P('Number on the left. Department next to it. Go on the line.')],
  'hint.cues.3': [P('The tick is on the cue. Press the department it names when the line comes.')],
};

// per-review keys: the Remarks text (also the caption you read aloud), her reply, and the Gazette
for (const [id, r] of Object.entries(REVIEWS)) {
  lines[`ending.review.text.${id}`] = r.text;
  lines[`ending.review.${id}`] = r.reply;
  lines[`credits.headline.${id}`] = r.headline;
  lines[`credits.standfirst.${id}`] = r.standfirst;
}
// the same three as one choice value (option order = triumph, long, seen), for a finale that uses dialogue.choose
lines['ending.review.choice'] = {
  prompt: lines['ending.review.ask'],
  options: Object.values(REVIEWS).map((r) => ({ text: r.text, reply: r.reply })),
};

// per-cue standby calls and level-3 hints. Engine form: hint.cues.<qNN>.3 (room.hintVariant('cues') returns 'q35'
// while Q35 is standing by or live). The spec's spelling hint.cues.3.qNN is defined too, as an alias.
for (const [q, dept] of CUES) {
  const n = q.slice(1);
  lines[`finale.standby.${q}`] = [P(q === 'q40' ? 'Stand by Q40. Last one.' : `Stand by Q${n}.`)];
  const h = [P(`Q${n}. ${dept}. Go.`)];
  lines[`hint.cues.${q}.3`] = h;
  lines[`hint.cues.3.${q}`] = h; // ALIAS (spec spelling)
}

export { lines };

// ADDED BY finale: the event triggers shown as stage directions, the credits roll and the best-time line
Object.assign(lines, {
  'finale.trigger.q32': 'House black.', // ADDED BY finale
  'finale.trigger.q33': "The overture's last chord.", // ADDED BY finale
  'finale.trigger.q34': 'Tabs out.', // ADDED BY finale
  'finale.trigger.q40': 'The bow.', // ADDED BY finale
  'finale.trigger.climb': 'She climbs to the lamp room.', // ADDED BY finale
  'credits.best': 'Best time: {time}.', // ADDED BY finale
  'credits.roll.cast': [ // ADDED BY finale: one caption, a row per line: '# heading', '_ italic', 'ROLE | Name', '' = a gap
    '# The Lamp at Gull Point',
    '_ A melodrama in one act. Closing night.',
    '',
    'Grace Tremayne | Miss Lavinia Thrush',
    'Ezra Tremayne | Miss Lavinia Thrush',
    'Stage Manager | Mr Harold Pike',
    'In the Royal Box | Bartholomew',
    'In the prompt corner | You',
    '_ Smugglers, fishermen and a dog were cut.',
  ].join('\n'),
  'credits.roll.house': [ // ADDED BY finale: one caption, a row per line: '# heading', '_ italic', 'ROLE | Name', '' = a gap
    '# The Empress, Pelham Street',
    'Front of House | the chandelier, relit',
    'Wardrobe | a dove-grey cloak',
    'Lighting | the dimmer board, Q34',
    'Flys | four 28s and a sandbag',
  ].join('\n'),
  'credits.roll.crew': [ // ADDED BY finale: the rest of the Empress's credits, straight on from credits.roll.house
    'Effects | wind, rain, the flash box',
    'Music | the pit pianola, The Empress March',
    'Ghost light | left burning',
  ].join('\n'),
  'credits.roll.end': [ // ADDED BY finale: one caption, a row per line: '# heading', '_ italic', 'ROLE | Name', '' = a gap
    '# Closing Night',
    '_ Built in three.js. Every model, texture and sound made in code.',
    '',
    '_ The Empress is not vacant.',
  ].join('\n'),
});

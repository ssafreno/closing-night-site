// Lines for the Orchestra Pit & Under-stage (docs/rooms/pit.md). WRITER owns this file. Room agents: ADD keys
// (marked // ADDED BY <agent>), never rewrite lines. Pike is here, by the wind machine (no hints from him).
import { L, P, N } from './speakers.js';

export const complete = true;

const pikePit = [
  [P('Mind your head. Joists.')],
  [P('Effects are my department.')],
  [P('Thunder on the sheet. Lightning on the box.')],
  [P("Rain is peas. Don't tell her.")],
];

export const lines = {
  // ── arrival ────────────────────────────────────────────────────────────────────────────────────────────────
  'pit.enter': [
    L('The pit. Where the music lives, darling, and the damp.'),
    L('I need an overture and a storm. In that order, ideally.'),
  ],
  'pit.enter.note': [L("Music and a storm, darling. Pozzi's pianola for one, Harold's machines for the other.")],
  'pit.pike.hello': [P('Effects. Standing by.')],
  'pit.idle.1': [L('Pozzi conducted from the piano, the stand and occasionally the bar.')],
  'pit.idle.2': [L('Fourteen chairs, {name}. On a good night, nine musicians. On a bad night, Pozzi and a tambourine.')],
  'pit.idle.3': [L('Something down here drips. It has dripped since the Boer War.')],

  // ── tuning ─────────────────────────────────────────────────────────────────────────────────────────────────
  'pit.tuning.riders': [L("Pozzi swore by his little paper hats. When they sit still, the string's telling the truth.")],
  'pit.tuning.wrong.1': 'Twang. The pin slips back to where it started.',
  'pit.tuning.wrong.2': [L("Darling, that's not a note, that's a complaint.")],
  'pit.tuning.wrong.3': 'The string objects loudly and returns to its old opinion.',
  'pit.tuning.solved': [L('Listen to that. One note, three strings, no arguments. Pozzi would have kissed you on both cheeks.')],

  // ── pianoroll ──────────────────────────────────────────────────────────────────────────────────────────────
  'pit.pianoroll.sour': [L('Tune it first, darling, or it sounds like a Tuesday.')],
  'pit.pianoroll.bishop': [L('Not in front of the orchestra.')],
  'pit.pianoroll.wrong.1': [L("That's a perfectly good tune for some other play.")],
  'pit.pianoroll.wrong.2': 'The roll stops, thinks better of it, and ejects itself.',
  'pit.pianoroll.wrong.3': [L("Charming. Nobody's ever raised a curtain to that.")],
  'pit.pianoroll.solved': [L('Tum, ti-tum, ti-tum. Oh, I do love an overture. It means the waiting is nearly over.')],
  'pit.done.music': [L("That's MUSIC, darling. Tick it. Then the storm, and then I'll stop asking for things. I won't.")],

  // ── thunder ────────────────────────────────────────────────────────────────────────────────────────────────
  'pit.thunder.tink': 'Tink. The storm is unimpressed.',
  'pit.thunder.pike': [P('Percussion keeps the beater.')],
  'item.mallet.pickup': 'A padded beater: soft at one end and serious at the other.',
  'pit.thunder.wrong.1': 'Knuckles on tin. A small storm, a long way off.',
  'pit.thunder.wrong.2': [P('Not with your hand.')],
  'pit.thunder.solved': [L('I was doing a bit.')],

  // ── wind ───────────────────────────────────────────────────────────────────────────────────────────────────
  'pit.wind.seized': 'The crank squeals and refuses. It has been seized since the Depression.',
  'item.oilcan.used': "You empty Molly's oil can into Pike's wind machine. Departments merge.",
  'pit.wind.pike': [P('Gale. Then the governor.')],
  'pit.wind.governor': [P('Not at that speed.')],
  'pit.wind.kite': [L("Darling, I'm not a kite.")],
  'pit.wind.wrong.1': 'The governor clanks and drops back.',
  'pit.wind.wrong.2': 'The drum spins down and the canvas falls slack.',
  'pit.wind.wrong.3': [L('Was that the wind, or Mr Volley?')],
  'pit.wind.solved': [L("A proper gale. My hair hasn't moved like this since Brighton.")],

  // ── rain ───────────────────────────────────────────────────────────────────────────────────────────────────
  'pit.rain.stuck': "The rain drum won't turn. Under the guard, an empty axle.",
  'pit.rain.wrong.1': "The gear won't take. It goes back on the shelf.",
  'pit.rain.wrong.2': [P("Doesn't mesh.")],
  'pit.rain.wrong.3': [L('Engineering, darling. I leave it to men in waistcoats.')],
  'pit.rain.nowind': [P('Turns when the wind does.')],
  'pit.rain.solved': [
    N('Dried peas pour round the drum. It sounds exactly like rain, and very slightly like peas.'),
    L("Rain. I've been rained on by the best."),
  ],
  'pit.done.storm': [L("Wind, rain and thunder. That's STORM, darling. I feel positively shipwrecked.")],
  'pit.done': [L("Wind, rain and thunder. That's STORM, darling. I feel positively shipwrecked.")], // ALIAS of pit.done.storm (the room's last deliverable)
  'pike.go.foyer': [P("Front of house. Cue light's green. Not my department.")],

  // ── the winch handle (loose end) ───────────────────────────────────────────────────────────────────────────
  'item.winch_handle.pickup': 'The crank handle lifts off its shaft. On the plate: STAR TRAP. HANDLE ALSO FITS FOYER CHANDELIER WINCH. RETURN IT. — H.P.',
  'loose.winch_handle.pit': [P("Winch handle. Trap winch. Foyer'll want it.")],

  'pit.return': [L('The pit. Still damp, still in tune. Pozzi would be insufferable.')],

  // ── hints ──────────────────────────────────────────────────────────────────────────────────────────────────
  'hint.tuning.1': [L('Signor Pozzi said a piano out of tune is a piano telling lies.')],
  // FIXED BY qa-pit: the music desk went with the front panel; the card now leans on the bass keys
  'hint.tuning.2': [L("His card's on the keys, down the bass end. Watch the little paper riders on the strings.")],
  'hint.tuning.3': [L('Turn each pin until its paper rider stops shivering.')],
  'hint.pianoroll.1': [L('An overture should go up, darling. Like a curtain. Like a career.')],
  'hint.pianoroll.2': [L("The score on the conductor's stand has Pozzi's pencil letters under the first bar. Each roll's leader shows its first notes.")],
  'hint.pianoroll.3': [L('Roll 103: C, E, G, C. Load it and push PLAY.')],
  'hint.thunder.1': [L("Thunder's a percussion instrument, darling. Ask any tenor.")],
  'hint.thunder.2': [L("Pozzi's band plan on the conductor's stand says where the beater lives.")],
  'hint.thunder.3': [L('Under the fourth dust sheet, the drums. Take the beater to the thunder sheet.')],
  'hint.wind.1': [L("Wind's in the arm, darling, and the arm wants oil.")],
  'hint.wind.2': [L("Molly's oil can for the crank, then the speed Harold's plot asks for: it's chalked on the dial.")],
  'hint.wind.3': [L('Oil it, crank until the needle is in GALE, then pull the governor lever.')],
  'hint.rain.1': [L('Rain runs off the wind in this theatre, darling. Most things do.')],
  'hint.rain.2': [L("The gear guard is stencilled, and Harold's effects plot agrees.")],
  'hint.rain.3': [L('Fit the twenty-four-tooth gear on the empty axle.')],

  // ── delights ───────────────────────────────────────────────────────────────────────────────────────────────
  'pit.delight.harp': 'A glissando, all by itself. The harp has been waiting to do that for some time.',
  'pit.delight.tuba': 'A mouse looks out of the bell, considers you, and goes back in.',
  'pit.delight.cello': "A bow tie knotted round the cello's scroll. Pozzi's idea.",
  'pit.delight.drums': 'One snare tap, crisp as a cough in the stalls.',
  'pit.delight.trombone': "It's a trombone. You feel it looking at you.",
  'pit.delight.scottish': [
    N("Stencilled on the sheet: PROPERTY OF THE EMPRESS — USED IN 'THE SCOTTISH PLAY', 1904."),
    L("Don't. The last one who said it in here was the dog, and we had to recast the dog."),
  ],
  'pit.delight.thunderagain': [L('Still doing the bit.')],
  'pit.delight.baton': 'You tap the stand with the baton. Nobody plays. Nobody has for ninety-five years.',
  'pit.delight.chairs': 'Fourteen chairs. The orchestra was mostly Pozzi.',
  'pit.delight.stalls': 'Beyond the brass rail, the stalls rise into the dark, row after row of folded seats.',
  'pit.delight.keys.sour': [N('A note, sour as a landlady.'), L('Ow.')],
  'pit.delight.keys': [N('A note, clean and true.'), L('There. That one could sing for its supper.')],
  'pit.delight.flashbox': 'The flash box whites out the trap room for an instant, then sulks back to dark.',
  'pit.delight.trap': [
    N('The winch turns once. Overhead, the stage trap bangs open and shut, and dust sifts down.'),
    L("Was that the trap? Someone's coming up."),
  ],
  'pit.delight.pike.1': pikePit[0],
  'pit.delight.pike.2': pikePit[1],
  'pit.delight.pike.3': pikePit[2],
  'pit.delight.pike.4': pikePit[3],
  'pike.click.pit': pikePit, // ALIAS of pit.delight.pike.* (the engine's default click picks one)
  'pit.winch.nohandle': 'A winch with no handle. The trap stays shut.', // ADDED BY set-pit
  'pit.pianoroll.empty': 'The spool box is empty. The pianola waits for something to read.', // ADDED BY puzzles-pit
};

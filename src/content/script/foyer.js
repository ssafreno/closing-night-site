// Lines for the Foyer & Box Office (docs/rooms/foyer.md). WRITER owns this file. Room agents: ADD keys (marked
// // ADDED BY <agent>), never rewrite lines. Pike never comes front of house. Bartholomew speaks exactly once.
import { L, C, N } from './speakers.js';

export const complete = true;

const catHello = [C("Don't mind me.")];
const catLavinia = [L('That\'s Bartholomew. He came with the building. Possibly before it.')];
const catTail = "You say 'Bartholomew'. The tail moves. Nothing else does.";

export const lines = {
  // ── arrival ────────────────────────────────────────────────────────────────────────────────────────────────
  'foyer.enter': [
    L('Front of house, darling. Where the public lives.'),
    L('The show needs lights, doors and an audience from out here. One audience will do.'),
  ],
  'foyer.enter.note': [L('Lights, doors, and one ticket. The Royal Box. For Bartholomew.')],
  'foyer.boxoffice.dark': 'Too dark to read a price. Crane would approve.',
  'foyer.idle.1': [L('I used to sweep down those stairs on first nights, {name}. The public adored a sweep.')],
  'foyer.idle.2': [L('Crane counted the takings in that box office. Then he counted them again, in a cab.')],
  'foyer.idle.3': [L('The foyer smells of oranges and wet coats. It always did. It was lovely.')],

  // ── chandelier ─────────────────────────────────────────────────────────────────────────────────────────────
  'foyer.chandelier.label': 'An enamel label in the cabinet: CHANDELIER — LOWER FOR CLEANING — HANDLE KEPT ON THE STAR TRAP WINCH, UNDER STAGE.',
  'foyer.chandelier.bucket': [L('It comes down on a winch, darling. Like a bucket. A very expensive bucket.')],
  'foyer.chandelier.up': "It's as up as it goes.",
  'foyer.chandelier.wrong.1': 'The ratchet clicks. The chandelier stays exactly where it is.',
  'foyer.chandelier.wrong.2': [L('Gently, darling. It cost more than the cast.')],
  'loose.winch_handle': [L('Harold keeps the handle under the stage, on the trap winch. Harold keeps everything under the stage.')],
  'foyer.chandelier.solved': [
    N('The bulbs flicker and catch. You wind it back up; the narrator spares you the details.'),
    L('Oh, the gilt. I can see the gilt, darling, and the gilt can see me.'),
  ],

  // ── safe and doors ─────────────────────────────────────────────────────────────────────────────────────────
  'item.ear_trumpet.pickup': 'A brass ear trumpet with a luggage tag: LOST 14.3.31 — STALLS ROW C — UNCLAIMED.',
  'foyer.safe.dark': 'A green iron safe, black in the dark. The dial is a rumour.',
  'foyer.safe.date': [L('Crane set it the morning he left. He was sentimental about dates. Nobody else\'s.')],
  'foyer.safe.wrong.1': 'The register clears itself. The safe keeps its counsel.',
  'foyer.safe.wrong.2': [L('Crane never trusted anyone, darling. Least of all his safe.')],
  'foyer.safe.wrong.3': 'Nothing. The safe has kept its secrets since 1931 and sees no reason to stop.',
  'foyer.safe.open': [
    N('Inside: an envelope marked TAKINGS w/e 14.3.31. It holds no takings.'),
    L('The takings. He still owes me twelve pounds.'),
  ],
  'item.key_chain.pickup': 'A key on a tag: AUDITORIUM DOORS.',
  'foyer.doors.locked': 'Chained and padlocked. A notice: CLOSED BY ORDER OF THE MANAGEMENT — S. CRANE.',
  'foyer.safe.solved': [
    N('The chain slithers to the floor. The doors swing in on the dark auditorium, and far off, the moonlit cloth.'),
    L('Doors open. The public may now come in. Any minute.'),
  ],
  // ADDED BY qa-foyer: the doors opening after the house board is already up (the house is lit, not dark)
  'foyer.safe.solved.lit': [
    N('The chain slithers to the floor. The doors swing in on the lit house, every seat empty, and far off, the moonlit cloth.'),
    L('Doors open. The public may now come in. Any minute.'),
  ],
  'foyer.contract': [L("That's a misprint. They meant 1900. Typists.")],

  // ── poster ─────────────────────────────────────────────────────────────────────────────────────────────────
  'foyer.poster.top': [L('My name goes at the top, darling. Large. Larger.')],
  'foyer.poster.wrong.1': 'The scrap flutters back to the floor, unconvinced.',
  'foyer.poster.wrong.2': [L("That's not where that goes, darling. I'd know. I've stared at it.")],
  'foyer.poster.wrong.3': 'It slides back down to join the others.',
  'foyer.poster.solved': [L('Crane tore it down, of course. He couldn\'t bear my name being bigger than his debts.')],

  // ── house board ────────────────────────────────────────────────────────────────────────────────────────────
  'foyer.houseboard.wrong.1': 'The jewels blink on and off like a nervous audience.',
  'foyer.houseboard.wrong.2': [L('Crane wired it himself, darling. You can tell, can\'t you.')],
  'foyer.houseboard.wrong.3': 'Click, click, click. Somewhere in the dark, a light goes on and off in sympathy.',
  'foyer.houseboard.solved': [L('A house! An actual house. Empty, but an actual house.')],

  // ── ticketing ──────────────────────────────────────────────────────────────────────────────────────────────
  // a wrong ticket prints and tears itself in half; the first failing field (area, letter, price, date) decides
  'foyer.ticketing.notbox': [L("Not with the public, darling. Bartholomew doesn't sit with the public.")],
  'foyer.ticketing.notbox.gallery': [L("The gallery? For Bartholomew? He'd never forgive me.")], // optional: area GALLERY
  'foyer.ticketing.wrongbox': [L("Not that box, darling. He'd be next to the trombones.")],
  'foyer.ticketing.price': [L('At that price? For the Royal Box? Crane would have a fit.')],
  'foyer.ticketing.date': [L("That's not closing night, darling.")],
  'foyer.ticketing.wrong.1': [L("That's not his ticket, darling.")],
  'item.ticket.pickup': 'THE EMPRESS · ROYAL BOX · BOX A · ONE GUINEA · SAT 14 MAR 1931 · ADMIT ONE.',
  'item.ticket.wrong': 'That ticket is for a particular patron.',
  'foyer.ticketing.solved': [L('An audience. A discerning one.')],

  // ── Bartholomew ────────────────────────────────────────────────────────────────────────────────────────────
  'foyer.cat': catHello, // the cat's one line, first click only
  'foyer.cat.lavinia': catLavinia,
  'foyer.delight.cat': [...catHello, ...catLavinia], // ALIAS: foyer.cat then foyer.cat.lavinia
  'foyer.delight.cattail': catTail,
  'cat.click': catTail, // ALIAS of foyer.delight.cattail (the engine's default click)

  // ── deliverable ────────────────────────────────────────────────────────────────────────────────────────────
  'foyer.done': [L('Lights, doors, an audience.'), L('Now there\'s only my room.')],
  'foyer.return': [L('Front of house, lit. I never saw it lit from this side. I was always being looked at.')],

  // ── hints ──────────────────────────────────────────────────────────────────────────────────────────────────
  'hint.chandelier.1': [L("We can't have a house in the dark, darling. Well. We can. It's called a lecture.")],
  'hint.chandelier.2': [L('The chandelier lowers on the winch by the stairs; the label says where the handle lives.')],
  'hint.chandelier.3': [L('Fit the winch handle, crank the chandelier down, pull its chain.')],
  // variant (room.hintVariant('chandelier') === 'nohandle'): the player is not holding the winch handle
  'hint.chandelier.nohandle.1': [L("The chandelier comes down on a winch, darling, and the winch wants a handle you haven't got.")],
  'hint.chandelier.nohandle.2': [L('The label on the winch cabinet says where the handle lives: the star trap winch, under the stage.')],
  'hint.chandelier.nohandle.3': [L('Go down to the pit. The handle is on the trap winch, through the arch. Bring it back and fit it to this winch.')],
  'hint.safe.1': [L("Crane's safe. Crane had the soul of a ledger and the ears of one too.")],
  'hint.safe.2': [L('Some numbers on that dial have been touched more than others. And somebody lost an ear trumpet in the cloakroom.')],
  'hint.safe.3': [L('Fourteen, three, thirty-one: the night he ran. Then the key in the safe opens the doors.')],
  'hint.poster.1': [L('Somebody tore my name down, darling. In a temper. Crane had several.')],
  'hint.poster.2': [L('The pieces are on the floor under the empty frame by the doors.')],
  'hint.poster.3': [L('Put the torn bill back together in the frame: the title strip at the top, the prices at the bottom.')],
  'hint.houseboard.1': [L('Crane did the wiring himself to save a shilling. It shows.')],
  'hint.houseboard.2': [L('Sparks left a card on the board: every switch throws its neighbours.')],
  'hint.houseboard.3': [L('Trip it, then turn STALLS and CIRCLE. Only those two.')],
  'hint.ticketing.1': [L("Bartholomew deserves the best seat in the house, darling. There's only one best seat.")],
  'hint.ticketing.2': [L('The seating plan and the price board are in the box office; the poster has the date.')],
  'hint.ticketing.3': [L('Box, A, one guinea, fourteenth of March. Pull the handle, give it to the cat.')],

  // ── delights ───────────────────────────────────────────────────────────────────────────────────────────────
  'foyer.delight.crystals': 'The crystals chime against each other, a whole tier at a time.',
  'foyer.delight.review_times': [N('A review poster: "I have seen it." — The Times, 1909.'), L("One line, in *The Times*, and it was that one. I've never been so proud or so cross.")],
  'foyer.delight.review_stage': [N('A review poster: "Miss Thrush was audible." — The Stage.'), L('Audible. In the gallery. Without a sea breeze.')],
  'foyer.delight.review_punch': [N('A review poster: "Bring sandwiches." — Punch.'), L("Punch never stayed for the third act. It's the best act.")],
  'foyer.delight.ordinarycat': [L('A novelty act. A cat. As if.')],
  'foyer.delight.kiosk': 'Chocolates from 1931. The coffee creams have gone to their reward.',
  'foyer.delight.clock': [L("Half past seven. Curtain up. It's been half past seven for a while.")],
  'foyer.delight.street': 'Through the rain-streaked glass, a night bus goes by, full of people going home.',
  'foyer.delight.umbrellas': 'Forty umbrellas. Nobody ever comes back for an umbrella.',
  'foyer.delight.glove': [L('Mine. I wondered where that went.')],
  'foyer.delight.notice': [L('Crane wrote everything in capitals, darling. He thought it made him taller.')],
  'foyer.delight.stairs': [N('Lavinia glides up three steps and back down without touching any of them.'), L('A lady never has feet, darling.')],
  // ── puzzle captions ────────────────────────────────────────────────────────────────────────────────────────
  'foyer.chandelier.fitted': 'The handle slides onto the square drive as if it had never left.', // ADDED BY puzzles-foyer
  'foyer.chandelier.drive': 'A square brass drive. The handle in your pocket is exactly that shape.', // ADDED BY puzzles-foyer
  'foyer.chandelier.crank': 'A crank. It wants turning, not tapping.', // ADDED BY puzzles-foyer
  'foyer.poster.dark': 'Torn paper on the floor under an empty frame. Too dark to read a word of it.', // ADDED BY puzzles-foyer
  'foyer.safe.trumpet': 'You press the ear trumpet to the safe door. The safe, it turns out, has a great deal to say.', // ADDED BY puzzles-foyer
  'foyer.ticketing.onlyone': 'The handle goes down. The machine thinks about it and prints nothing. One patron, one ticket.', // ADDED BY puzzles-foyer
};

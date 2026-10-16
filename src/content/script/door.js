// Lines for the Stage Door & Green Room (docs/rooms/door.md). WRITER owns this file. Room agents: ADD keys (marked
// // ADDED BY <agent>), never rewrite lines. Lavinia is only a voice here: every line of hers is `lavinia_off` (O).
// Captions are bare strings; `door.delight.<name>` follows the room's Delights table.
import { O, N } from './speakers.js';

export const complete = true;

export const lines = {
  // ── arrival ────────────────────────────────────────────────────────────────────────────────────────────────
  'door.enter': [N('The stage door swings shut behind you and locks itself. Doors do that here, apparently.')],
  // unprompted, right after door.enter: names the room's goal
  'door.enter.voice': [
    O('Hello? Someone out there? I can hear a clipboard.'),
    O('Be a darling: find the lights, then come through the pass door. We are terribly behind.'),
  ],
  // first click on the lilac glow
  'door.enter.note': [O('Lights first, darling. Then the pass door. Then me.')],
  'door.idle.1': [O("Still there? You've gone quiet. I know the feeling.")],
  'door.idle.2': [O("I'd come out and help, {name}, but I'm resting.")],
  'door.idle.3': [O('Alf kept everything in that hutch. Biscuits, keys, grudges.')],

  // ── hutch ──────────────────────────────────────────────────────────────────────────────────────────────────
  'door.hutch.locked': 'Locked. An enamel plate: DOORKEEPER — A. HOBDAY — KEY KEPT ON THE DOORKEEPER.',
  'door.hutch.wrong.1': 'The half-door stays shut. Both halves agree.',
  'door.hutch.wrong.2': 'Nothing. Alf built this hutch to keep people out, and he was good at it.',
  'door.hutch.solved': [O("Alf's coat is still on the stand? Then he went home in his shirtsleeves. In March.")],
  'item.key_hutch.pickup': 'In the coat pocket: two humbugs fused into one, a tram ticket from 1931, and a small brass key. You take the key.',

  // ── meter ──────────────────────────────────────────────────────────────────────────────────────────────────
  // the meter's enamel plate, as a caption when the meter is clicked (route (a) for meter AND for the stage's ghostlight)
  'door.meter.plate': 'PELHAM CORPORATION ELECTRICITY — PREPAYMENT METER — INSERT ONE SHILLING, THEN TURN HANDLE FULLY CLOCKWISE. ALSO SUPPLIES: STAGE DIP 2.',
  'item.shilling.pickup': [N('The TEA FUND tin rattles. Inside, one shilling. The King looks tired.')],
  'door.meter.nocoin': 'The handle swings round with nothing to push against. The slot is empty.',
  'door.meter.wrong.1': 'Thunk. The handle springs back to where it started.',
  'door.meter.wrong.2': [O('Was that the lights? No. Never mind.')],
  'door.meter.wrong.3': 'The handle returns to the start, like a cat that has been put out.',
  'door.meter.solved': [
    N('The pendants flicker twice and decide to stay on. Above the pass door, a small red lamp lights.'),
    O("Oh, that's better. I could hear you squinting."),
  ],

  // ── key press ──────────────────────────────────────────────────────────────────────────────────────────────
  'door.keypress.dark': 'A glass-fronted cabinet, deep in shadow. Too dark to see what it wants.',
  'door.keypress.wrong.1': 'The wheels keep their numbers. The cabinet keeps its keys.',
  'door.keypress.wrong.2': [O('Alf changed that combination once. It took him a fortnight to recover.')],
  'door.keypress.wrong.3': 'Click. Nothing. The keys behind the glass look on.',
  'door.keypress.matinee': [O("That's the matinee, darling. Nobody important comes to the matinee.")],
  'door.keypress.solved': [N('The glass door swings open. Six hooks, six tags, one key worth having.')],
  'item.key_pass.pickup': 'A heavy iron key on a card tag: PASS DOOR.',
  // the other five tags, as captions when clicked
  'door.keypress.tag.wardrobe': 'WARDROBE. An empty hook. "With Miss Bright."',
  'door.keypress.tag.boxoffice': 'BOX OFFICE. An empty hook. "With Mr Crane." It would be.',
  'door.keypress.tag.flyfloor': 'FLY FLOOR. An empty hook, swinging slightly.',
  'door.keypress.tag.dressing': 'No.1 DRESSING. An empty hook. "Miss Thrush keeps her own."',
  'door.keypress.tag.cellar': 'CELLAR. A rusty key. There is no cellar. Alf was thorough.',

  // ── sign-in ────────────────────────────────────────────────────────────────────────────────────────────────
  'door.passdoor.locked': 'Locked. A brass plate: PASS DOOR — STAGE — KEEP SHUT. Below it, another: NOBODY PASSES TO THE STAGE WITHOUT SIGNING IN. — H. PIKE, S.M.',
  'door.signin.locked': [
    N('The key turns. The door does not. The plate at eye level: NOBODY PASSES TO THE STAGE WITHOUT SIGNING IN. — H. PIKE, S.M.'),
    O("Sign in, darling. Harold's particular."),
  ],
  'door.signin.wrong.1': 'The pass door does not move.',
  'door.signin.wrong.2': [O("Harold's door, darling. Harold's rules.")],
  'door.signin.signedfirst': [
    N('You sign in: The Inspector (Borough of Pelham), 11.14. The pass door stays locked.'),
    O('Signed in. How proper. Harold would weep, if he did that.'),
  ],
  'door.signin.solved': [N('On the far side, a latch lifts by itself. The pass door swings open on darkness, and the lilac light goes with it.')],
  'door.done': [O("Through you come, then. Mind the dark, it's mostly furniture.")],
  'door.return': [O('The green room. It still smells of tea and paraffin. I used to hide in there from the critics.')],
  // the sign-in book, first read
  'door.signinbook.read': [
    N('Nobody signed out.'),
    O('Well. It was a very good party.'),
    O('Anyway. Where were we.'),
  ],
  // other slips on the call board (captions)
  'door.callboard.aigrette': 'A slip: "LOST: one aigrette, white. — L.T." Underlined three times.',
  'door.callboard.band': 'A slip: "Band call Monday 10 sharp. — Pozzi." There was no Monday.',
  'door.callboard.glue': 'A slip: "WHO HAS MY GLUE. — Wardrobe." Nobody ever owned up.',

  // ── items ──────────────────────────────────────────────────────────────────────────────────────────────────
  'item.pen.wrong': "You're an inspector, not a vandal.",

  // ── hints (lavinia_off: the voice behind the pass door) ────────────────────────────────────────────────────
  'hint.hutch.1': [O('Alf kept everything about his person, darling. Mostly biscuits.')],
  'hint.hutch.2': [O("His coat's on the stand by the stage door.")],
  'hint.hutch.3': [O("The key's in Alf's coat pocket. Use it on the hutch door.")],
  'hint.meter.1': [O("It's black as a critic's heart in here. Electricity is coin-operated, I'm told.")],
  'hint.meter.2': [O('The meter by the pass door wants a shilling. Alf\'s tea fund always had one.')],
  'hint.meter.3': [O('Shilling from the TEA FUND tin into the meter, then turn the handle one full turn clockwise.')],
  'hint.keypress.1': [O('Alf never remembered a number in his life, {name}. He wrote it down, then wrote down where.')],
  'hint.keypress.2': [O('His note is on the key press. The times are on the call board.')],
  'hint.keypress.3': [O('Six, five, five. The Half on a Saturday night.')],
  'hint.signin.1': [O('Harold has rules, darling. Rule one is a brass plate.')],
  'hint.signin.2': [O('Read the plate on the pass door. The sign-in book is on the hutch ledge.')],
  'hint.signin.3': [O('Unlock the pass door with the key from the key press, then sign the book on the hutch ledge with your pen.')],

  // ── delights ───────────────────────────────────────────────────────────────────────────────────────────────
  'door.delight.kettle': [
    N('The kettle grumbles, rattles and whistles.'),
    O("Oh, is that tea? I'd kill for tea. Figuratively."),
  ],
  'door.delight.kettle_cold': 'A kettle, stone cold. It has been off for ninety-five years, roughly.',
  'door.delight.pigeon_thrush': 'THRUSH. Stuffed with fan mail. Some of it is from 1931, and some of it is from 1931 and in her handwriting.',
  'door.delight.pigeon_pike': 'PIKE. One envelope, typed, filed.',
  'door.delight.pigeon_crane': 'CRANE. A cobweb.',
  'door.delight.pigeon_cat': 'CAT. A mouse, beautifully presented, long past its best.',
  'door.delight.pigeon_other': [
    'A gas bill, unpaid. It had a point.',
    'One glove, left. The right glove has moved on.',
    'A programme from 1929, folded into a hat.',
    'A postcard from Margate: "Wish you were here. Are you?"',
    'A bus timetable, for buses that no longer exist.',
    'Empty. Somebody was very tidy, or very unpopular.',
    'A letter that begins "Dear Mr Volley, regarding the incident".',
    'A single biscuit, fossilised. Alf.',
  ],
  'door.delight.stagedoor': 'Locked from the inside, which is the side you are on.',
  'door.delight.wireless': 'Static, then three seconds of a dance band from somewhere in 1931, then static again.',
  'door.delight.sofa': 'The sofa sighs. You know how it feels.',
  'door.delight.photo_1': 'The company of 1929, all moustaches. Some of the moustaches are on the women; it was a pantomime.',
  'door.delight.photo_2': 'The company of 1931. Dead centre, an aigrette, and under it a face almost in focus.',
  'door.delight.photo_3': 'A cat, framed. The cat has been given the best frame.',
  'door.delight.dartboard': 'Thunk. Treble nothing.',
  'door.delight.quiet': 'It is quiet. Smugly so.',
  'door.delight.teatin': 'A slip inside the lid: "Owing: Mr Pike, 2d." Some debts outlive us.',
  'door.delight.exit': 'The sign is lying.',

  // ── set extras ─────────────────────────────────────────────────────────────────────────────────────────────
  // ADDED BY set-door: the hutch window, before the half-door is open
  'door.hutch.window': 'Through the glass: a desk, a tea tin, a wireless, and a cabinet of keys on the back wall. The window is painted shut. The paint has opinions.',
  // ADDED BY set-door: the call board before the lights
  'door.callboard.dark': 'Papers pinned to a board. Too dark to read a word of them.',
  // ADDED BY set-door: the wireless before the lights
  'door.delight.wireless_off': 'A wireless set in a walnut case. No electric, no wireless. Just a very handsome box.',

  // ── puzzle extras ──────────────────────────────────────────────────────────────────────────────────────────
  // ADDED BY puzzles-door: Alf's coat once the key is out of it
  'door.coat.empty': "Alf's overcoat. The humbugs can stay where they are.",
  // ADDED BY puzzles-door: the meter's coin slot clicked, empty / with the shilling in (or after)
  'door.meter.slot': 'A coin slot marked 1/-. It is empty, and it minds.',
  'door.meter.slot.full': 'The slot has had its shilling. It looks no happier.',
  // ADDED BY puzzles-door: the meter handle clicked (not dragged) with the coin in
  'door.meter.handle': 'It is a handle. It wants turning, not tapping: take hold and drag it round, clockwise.',
  // ADDED BY puzzles-door: the PASS DOOR tag once its key has gone
  'door.keypress.tag.passdoor': 'PASS DOOR. An empty hook. You have the key, and the hook knows it.',
  // ADDED BY puzzles-door: the pen on the sign-in book a second time
  'door.ledger.signed': 'You have signed in once. Twice would look keen.',
  // ADDED BY puzzles-door: Alf's note clicked before the lights are on
  'door.alfnote.dark': 'A torn envelope taped above the cabinet, pencil on it. In this light it could say anything.',

  // ── QA extras ─────────────────────────────────────────────────────────────────────────────────────────────────
  // ADDED BY qa-door: the brass bell on the hutch ledge
  'door.delight.bell': 'Ding. Alf will be back in five minutes. He has been back in five minutes since 1931.',
  // ADDED BY qa-door: the pencil on a string beside the sign-in book (points at the pen without saying "use it")
  'door.delight.pencil': 'A pencil on a string, for signing in. The lead snapped some time ago. Inspectors carry their own pens.',
  // ADDED BY qa-door: the round coin window on the meter, empty / with the shilling showing
  'door.meter.window': 'A little round window, empty. The slot beside it is marked 1/-.',
  'door.meter.window.full': 'Your shilling, behind glass. The King still looks tired.',
};

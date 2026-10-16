// Lines for the Stage, the hub (docs/rooms/stage.md). WRITER owns this file. Room agents: ADD keys (marked
// // ADDED BY <agent>), never rewrite lines. Before the ghost light Lavinia is a shimmer (`lavinia_off`, O); after it
// she is `lavinia` (L). Also here: Pike's hub lines (pike.go.*, pike.notyet.*) and hint.goto.* for every room.
import { L, O, P, N } from './speakers.js';

export const complete = true;

const pikeStage = [
  [P('Standing by.')],
  [P('Quiet in the wings.')],
  [P('Thirty-one years. Never late. Never been in her dressing room.')],
  [P('Places in ten. Was places in ten in 1931.')],
];

export const lines = {
  // ── arrival (dark) ─────────────────────────────────────────────────────────────────────────────────────────
  'stage.enter': [
    N('Black. Somewhere high up, rain on a roof. At centre stage, a bare bulb on a pole, unlit.'),
    O("That's Harold's little light, darling. Light it, and we can all see each other."),
  ],
  'stage.enter.note': [O('The little light at centre stage, darling. Light it. Then we can talk properly.')],

  // ── ghostlight ─────────────────────────────────────────────────────────────────────────────────────────────
  // the cable's luminous tag, as a caption when clicked
  'stage.ghostlight.tag': 'A tag in luminous paint: GHOST LIGHT — DIP 2 ONLY (G.R. METER). NEVER LET IT GO OUT. — H.P.',
  'stage.ghostlight.wrong.1': [O("Not that one, darling, that's mains. Mains is a whole other evening.")],
  'stage.ghostlight.wrong.2': 'A spark, a smell of hot dust, and darkness, unimpressed.',
  'stage.ghostlight.wrong.3': [O('Sparks. Lovely. Not the kind I meant.')],
  // the click-through sequence after the bulb lights (DESIGN §1), in this order:
  'stage.ghostlight.solved': [L("You're late. Everyone is late. Never mind, darling, you're here now. Places in ten.")],
  'stage.intro.1': [L('The house stays locked until the curtain comes down. House rules, darling. Literally.')],
  'stage.intro.2': [L("A clipboard. You must be the new assistant stage manager. They said they'd send someone.")],
  'stage.runningorder': [L('Take this down: light, set, costume, music, storm, the house, the script. Then curtain up.')],
  'stage.pike.intro': [P('Pike. Stage manager. You are late.')],
  'stage.pike.bicker.1': [
    L("Ignore Harold. He's been standing by since the Coronation."),
    P('Which one.'),
  ],
  'stage.promptbook': [P("Prompt book. Don't crease it. Last page is out. Not my department.")],

  'stage.idle.1': [L('Nine hundred seats out there, {name}, and every one of them is a critic.')],
  'stage.idle.2': [L("I'd do it myself, darling, but I'm resting.")],
  'stage.idle.3': [L('Harold never could light a leading lady. Hence the translucency.')],

  // ── mains ──────────────────────────────────────────────────────────────────────────────────────────────────
  'stage.mains.pike': [P('Sparks hid the fuses. Bucket, props table, rail.')],
  'item.fuse_r.pickup': 'A ceramic fuse with a red dot, half-buried in sand. Sparks had an idea of safe.',
  'item.fuse_y.pickup': 'A ceramic fuse with a yellow dot, in a teacup. Two sugars, by the look of it.',
  'item.fuse_b.pickup': 'A ceramic fuse with a blue dot, hung over a cleat like a hat on a peg.',
  'stage.mains.wrong.1': 'A fizz, a smell of 1931, and the handle springs back up.',
  'stage.mains.wrong.2': [L('Sparks would have called that a learning experience.')],
  'stage.mains.wrong.3': [P('Mains is off.')],
  'stage.mains.solved': [L('Work lights. I look like a cabbage. Everybody looks like a cabbage under work lights.')],

  // ── dimmer ─────────────────────────────────────────────────────────────────────────────────────────────────
  'stage.dimmer.ham': [L('Floats full? I look like a boiled ham.')],
  'stage.dimmer.wrong.1': [L("That's a look, darling. It isn't *the* look.")],
  'stage.dimmer.wrong.2': 'For two seconds the stage looks like somewhere else entirely. Then the work lights come back.',
  'stage.dimmer.wrong.3': [L('Lovely, if the play were set in a fishmonger\'s.')],
  'stage.dimmer.solved': [L("Moonlight. Now that's a light a woman can be thirty-one in.")],
  'stage.done.light': [L("That's LIGHT, darling. Tick it before Harold does.")],

  // ── flyrail ────────────────────────────────────────────────────────────────────────────────────────────────
  'stage.flyrail.running': [P('Line seven running. Stand clear.')],
  'stage.flyrail.heavy': [P('Heavy.')],
  'stage.flyrail.light': [P('Light.')],
  'stage.flyrail.locked': [P("Lock's on.")],
  'stage.flyrail.wrong.1': 'The line runs, clatters at the safety, and settles back where it was.',
  'stage.flyrail.wrong.2': [L('Every night someone does that, darling. Usually during my speech.')],
  'stage.flyrail.wrong.3': 'Rope, iron and gravity hold a short, loud meeting. Nothing is decided.',
  'stage.flyrail.solved': [L('Gull Point. I wept every night. Twice on Saturdays.')],

  // ── lighthouse ─────────────────────────────────────────────────────────────────────────────────────────────
  'stage.lighthouse.stencil': 'Stencilled on the base: LIGHTHOUSE — BLUE SPIKE — DOOR TO PROMPT SIDE.',
  'stage.lighthouse.pike': [P('Blue spike. Door to the prompt side.')],
  'stage.lighthouse.red': [P("That's the cottage.")],
  'stage.lighthouse.yellow': [P("That's the tavern.")],
  'stage.lighthouse.door': [L('The door faces the wings, darling, or how do I get in?')],
  'stage.lighthouse.wrong.1': [P('No mark there.')],
  'stage.lighthouse.wrong.2': 'The lighthouse stands on bare boards, guarding nothing.',
  'stage.lighthouse.wrong.3': [L('A lighthouse in the middle of nowhere, darling. Very modern.')],
  'stage.lighthouse.solved': [L('There she stands. Eleven feet of canvas and conviction.')],
  'stage.done.set': [L("Cloth in, lighthouse on its marks. That's SET, darling.")],
  // optional: when LIGHT and SET are both ticked, before pike.go.wardrobe
  'stage.done': [L('Light, and a set to stand in. Now I need something to wear.')],

  // ── the lamp (loose end) ───────────────────────────────────────────────────────────────────────────────────
  'loose.lamp': [L('The lamp, darling. It goes up in the lighthouse, not in your pocket.')],
  'loose.lamp.placed': [
    N('You climb the ladder. The lighthouse is eleven feet tall and mostly canvas.'),
    L("Perfect. Don't light it. It has a cue."),
  ],

  // ── Pike at the hub: cue lights ────────────────────────────────────────────────────────────────────────────
  'pike.go.wardrobe': [P("Wardrobe. Cue light's green.")],
  'pike.go.pit': [P("Orchestra. That's a go.")],
  // pike.go.foyer is in pit.js (he presses it from the pit)
  'pike.go.dressing': [P("Dressing rooms. That's a go. Never been in.")],
  'pike.notyet.wardrobe': [P('Not yet. Lines one and two.')],
  'pike.notyet.pit': [P('Not yet. Line three.')],
  'pike.notyet.foyer': [P('Not yet. Lines four and five.')],
  'pike.notyet.dressing': [P('Not yet. Line six.')],
  'pike.notyet.finale': [P('Not yet. Line seven.')], // ADDED BY set-stage (the covered cue-light panel before the Script)

  // ── returns to the hub ─────────────────────────────────────────────────────────────────────────────────────
  'stage.return': [L('The stage. Still here, darling. So am I.')],
  'stage.return.wardrobe': [L('Back on stage, and finally dressed for the weather.')],
  'stage.return.pit': [L('Listen. The storm is waiting under the boards. It sounds expensive.')],
  'stage.return.foyer': [L('There is a house out there now, darling. I can feel it looking.')],
  'stage.return.dressing': [L("The last page. Let's not keep Harold waiting. Again.")],

  // ── hints ──────────────────────────────────────────────────────────────────────────────────────────────────
  'hint.ghostlight.1': [O("It's a light, darling. It wants plugging in. Everything does.")],
  'hint.ghostlight.2': [O('The tag on its cable says which dip.')],
  'hint.ghostlight.3': [O('Plug it into dip two.')],
  'hint.mains.1': [L('Note, {name}: the fuses. The electrician hid them like Easter eggs, and he was a Methodist.')],
  'hint.mains.2': [L('His tag on the mains box says where: a bucket, the props table, the fly rail.')],
  'hint.mains.3': [L('Fire bucket by the pass door, teacup on the props table, cleat on the fly rail. Fit all three and throw the switch.')],
  'hint.dimmer.1': [L("Moonlight, darling. Not 'a moon', not 'some light'. Moonlight.")],
  'hint.dimmer.2': [L("Harold's lighting plot, page three, cue thirty-four. Sparks chalked it on the board as well.")],
  'hint.dimmer.3': [L('Battens a quarter, floats out, limes half, blues full. Then turn the master.')],
  'hint.flyrail.1': [L("A cloth that size doesn't fly on good intentions, darling. It wants iron.")],
  'hint.flyrail.2': [L("Harold's fly plot, page four, gives line seven's weight. So does the tag on the bar, if you look up.")],
  'hint.flyrail.3': [L('A hundred and twelve pounds on line seven: four twenty-eights will do. Lift the lock and give the rope one pull.')],
  'hint.lighthouse.1': [L('A lighthouse in the wrong place is a hazard to shipping, darling.')],
  'hint.lighthouse.2': [L("Harold's ground plan, page five, and the stencil on the truck.")],
  'hint.lighthouse.3': [L('Roll it onto the blue spike marks, turn it until the red door faces the prompt desk, and set the brake.')],

  // pointers to the frontier room (said wherever the player is when this room is next)
  'hint.goto.stage': [O("Through the pass door, darling. I'm on the other side.")],
  'hint.goto.wardrobe': [L("Wardrobe, darling, up the iron stair. Harold's given you a green light.")],
  'hint.goto.pit': [L("The orchestra pit, darling. Down the hatch. Pike's cue light is green.")],
  'hint.goto.foyer': [L('Front of house, darling: the little door in the proscenium wall. The public end.')],
  'hint.goto.dressing': [L("My dressing room, darling. The corridor upstage. I'll come with you. Probably.")],
  'hint.goto.finale': [L("The prompt desk, darling. Harold's waiting, and he's had the practice.")],

  // ── delights ───────────────────────────────────────────────────────────────────────────────────────────────
  'stage.delight.whistle': [
    N('You blow the bosun\'s whistle. Something lets go in the dark above, and a sandbag lands a yard away.'),
    P('No whistling.'),
  ],
  'stage.delight.trapdoor': 'A sign on the trapdoor: MIND THE GAP.',
  'stage.delight.trapdoor.flip': 'The sign has turned itself over: THE GAP MINDS YOU.',
  'stage.delight.house': [N('Nine hundred seats, all facing you.'), L('A quiet house tonight.')],
  'stage.delight.royalbox': 'The Royal Box. Empty since the King left at the interval in 1911.',
  'stage.delight.propstable': 'White tape outlines on the trestle: a sword, a lantern, a rubber fish, and a letter that says LETTER.',
  'stage.delight.bucket': 'Sand, a cigarette end from 1931, and a sense of occasion.',
  'stage.delight.flats': 'A tavern flat. Someone painted a ploughman\'s lunch on its table and never came back for it.',
  'stage.delight.ghostlit': [L("Never let it go out, darling. It's for the others.")],
  'stage.delight.pike.1': pikeStage[0],
  'stage.delight.pike.2': pikeStage[1],
  'stage.delight.pike.3': pikeStage[2],
  'stage.delight.pike.4': pikeStage[3],
  'pike.click.stage': pikeStage, // ALIAS of stage.delight.pike.* (the engine's default click picks one)
  'stage.delight.cloth': [L('The scene painter did that in a week, on gin. The moon is his wife. She never forgave the craters.')],
  // fly lines other than 7: the rope-lock card (line 1 is Pike's)
  'stage.delight.rope.tabs': 'Line 1: TABS. The house curtain. Pike\'s line. Don\'t.',
  'stage.delight.rope.border1': 'Line 2: BORDER 1. A strip of black velvet, dead in the air.',
  'stage.delight.rope.lxbar': 'Line 3: LX BAR 1. A row of lanterns, looking down at you.',
  'stage.delight.rope.cottage': "Line 4: CLOTH: COTTAGE. Act One's rose-covered lie.",
  'stage.delight.rope.border2': 'Line 5: BORDER 2. More velvet, more dark.',
  'stage.delight.rope.tavern': "Line 6: CLOTH: TAVERN. Act Two's smoky lie.",
  'stage.delight.rope.cyc': 'Line 8: CYC. A great pale sky, rolled up and waiting.',
  // ── PUZZLES-stage: small captions for the close-ups ──────────────────────────────────────────────────────────
  'stage.mains.slot': 'An empty carrier. It wants a fuse, and Sparks hid three.', // ADDED BY puzzles-stage
  'stage.dimmer.dead': 'Four brass levers and an iron wheel, all of them dead. Nothing back here has power.', // ADDED BY puzzles-stage
  'stage.dimmer.set': 'Q34 MOONLIGHT, set and gone. The levers stay where Sparks would have put them.', // ADDED BY puzzles-stage
  'stage.flyrail.full': 'The arbor is full. Any more iron and it would be a different theatre.', // ADDED BY puzzles-stage
  'stage.flyrail.tug': 'The line sways, and the cloth shivers somewhere above. It wants one long pull.', // ADDED BY puzzles-stage
  'stage.lighthouse.lamp': 'The brass lamp sits in the lantern room, unlit. It has a cue.', // ADDED BY puzzles-stage
};

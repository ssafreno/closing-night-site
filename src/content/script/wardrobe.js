// Lines for Wardrobe & Props Loft (docs/rooms/wardrobe.md). WRITER owns this file. Room agents: ADD keys (marked
// // ADDED BY <agent>), never rewrite lines. Pike never comes up here.
import { L, N } from './speakers.js';

export const complete = true;

const well = [L("Well? *Well?* Oh, darling! Nobody's said that to me in ninety... in ages.")];
const stormy = [L("Stormy. I'll take it. It's very nearly in the title.")];

export const lines = {
  // ── arrival ────────────────────────────────────────────────────────────────────────────────────────────────
  'wardrobe.enter': [
    L('Wardrobe. My favourite room, darling: every single thing in it is a lie.'),
    L('I need my storm gown, and the lamp for the lighthouse. Molly will have left them in pieces.'),
  ],
  'wardrobe.enter.note': [L('My storm gown and the lamp, {name}. Molly never left anything in one piece.')],
  'wardrobe.idle.1': [L('Molly ran this loft like a navy. A navy with pins.')],
  'wardrobe.idle.2': [L('Everything up here has been someone else. I find that restful.')],
  'wardrobe.idle.3': [L('Mind the hatboxes, darling. They have tempers.')],

  // ── rack ───────────────────────────────────────────────────────────────────────────────────────────────────
  'wardrobe.rack.first': [L('Molly marked everything. Lilac thread was always mine.')],
  'wardrobe.rack.velvet': [L('Act Two. The velvet. I wept in that.')],
  'wardrobe.rack.ada': [L("That's Ada's. She'll want it back. She wanted it back in 1931.")],
  'wardrobe.rack.pretender': [L('*The Pretender\'s Crown*. Nineteen thirty. We don\'t discuss it.')],
  // optional named lines for other garments (the room may use them in place of rack.wrong.n)
  'wardrobe.rack.walking': [L('Act One. I walked in that. Mostly towards the footlights.')],
  'wardrobe.rack.armour': [L('Tin armour. Mr Dane clanked through an entire sonnet in that.')],
  'wardrobe.rack.pierrot': [L("Pierrot. Don't ask. It was a charity matinee.")],
  'wardrobe.rack.wrong.1': [L('Not tonight, darling. Back on the rail.')],
  'wardrobe.rack.wrong.2': [L("That's *a* costume. I need *the* costume.")],
  'wardrobe.rack.wrong.3': 'It swings back onto the rail with a small, offended rattle.',
  'wardrobe.rack.solved': [L('Grey silk, lilac thread, Act Three. Molly, you angel.')],
  'item.bodice.pickup': 'A grey silk bodice, Act Three, lilac thread. It weighs almost nothing.',

  // ── rubbing ────────────────────────────────────────────────────────────────────────────────────────────────
  'item.chalk.pickup': "A stick of tailor's chalk, worn to a wedge.",
  'item.chalk.wrong': 'You draw a small X. Molly would have your hide.',
  'wardrobe.rubbing.wrong.1': 'A smudge of chalk, and nothing to show for it.',
  'wardrobe.rubbing.wrong.2': [L('Molly hid things with conviction, darling.')],
  // ADDED BY puzzles-wardrobe: the order pad clicked with no chalk to rub it; the red hatbox after the cape is out
  'wardrobe.pad.blank': 'The top sheet is blank. Pressed into it, very faintly, the ghost of somebody\'s handwriting.',
  'wardrobe.hatbox.empty': 'WET WEATHER. Empty now, apart from a smell of the seaside.',
  'wardrobe.rubbing.solved': [L('Molly always put the thing you wanted at the bottom. It built character.')],
  'item.cape.pickup': 'A sea-green oilskin cape. It smells of 1931 and the seaside.',

  // ── sewing ─────────────────────────────────────────────────────────────────────────────────────────────────
  'item.oilcan.pickup': 'A small oil can with a long spout. Scratched on the side: MOLLY\'S. DO NOT.',
  'wardrobe.sewing.seized': 'The treadle squeals and will not budge. The machine is sulking.',
  'wardrobe.sewing.waltz': [L('A waltz, darling. One-two-three. Molly sewed every hem in this building to a waltz.')],
  'wardrobe.sewing.nobeat': [L('Waltz time needs a waltz, darling. Start the little pyramid.')],
  'wardrobe.sewing.wrong.1': 'Snap. One stitch unpicks itself in disgust.',
  'wardrobe.sewing.wrong.2': [L('Off the beat, darling. Molly would have rapped your knuckles with a thimble.')],
  'wardrobe.sewing.wrong.3': 'The thread breaks. The metronome carries on without you.',
  'wardrobe.sewing.solved': [L('A hem. A real hem. Molly would weep, and then find something wrong with it.')],
  'item.skirt.pickup': 'The storm-grey skirt comes free of the machine, hem and all.',

  // ── lens ───────────────────────────────────────────────────────────────────────────────────────────────────
  'wardrobe.lens.cake': [L('Biggest at the bottom, like a wedding cake. I had four.')],
  'wardrobe.lens.wrong.1': 'The stack wobbles, thinks about it, and slides back into the tray.',
  'wardrobe.lens.wrong.2': [L("That's not a beehive, darling. That's a pile.")],
  'wardrobe.lens.wrong.3': 'Glass slides on glass, politely, back to the felt.',
  'wardrobe.lens.solved': [L('The lamp. Burn, old lamp. Not yet. Later. I\'ll do it properly later.')],
  'item.lamp.pickup': 'The lamp lifts free: five rings of glass on a brass base. Heavier than it looks, like most props.',
  'item.lamp.examine': 'The lighthouse lamp: a brass base and a glass beehive, five rings high. It belongs in the lighthouse on stage.',

  // ── dummy ──────────────────────────────────────────────────────────────────────────────────────────────────
  'wardrobe.dummy.wrong.1': [L("Underneath first, darling. I'm not a trifle.")],
  'wardrobe.dummy.wrong.2': 'It slides off the dummy and back into your arms.',
  'wardrobe.dummy.wrong.3': [L("Not like that, {name}. I've been dressed by experts.")],
  // a choice (flavour only): Lavinia comes out of the dummy in the storm gown
  'wardrobe.dummy.solved': {
    prompt: [L('Well? How do I look?')],
    options: [
      { text: 'You look well.', reply: well },
      { text: 'Very... stormy.', reply: stormy },
    ],
  },
  // ADDED BY puzzles-wardrobe: the dummy clicked after the gown is on
  'wardrobe.dummy.done': 'The storm gown, complete. The dummy wears it bravely.',
  'wardrobe.dummy.well': well, // ALIAS: the reply above
  'wardrobe.dummy.stormy': stormy, // ALIAS: the reply above

  // ── deliverable ────────────────────────────────────────────────────────────────────────────────────────────
  'wardrobe.done': [L("Costume, darling. Tick it. The pit next: Harold will have a green light for you.")],
  'wardrobe.return': [L('My gown, my lamp, my loft. I could live up here. Figure of speech.')],

  // ── hints ──────────────────────────────────────────────────────────────────────────────────────────────────
  'hint.rack.1': [L('Molly had a system, darling. Molly had a system for her systems.')],
  'hint.rack.2': [L("Her key card's on the end of the rack. Harold's costume plot, page six, says what I wear in the last scene.")],
  'hint.rack.3': [L('Lighthouse stamp, lilac thread, three notches: the grey silk bodice, third along.')],
  'hint.rubbing.1': [L('Molly wrote her notes so hard you could read them through the table.')],
  'hint.rubbing.2': [L("Rub the tailor's chalk over the order pad on the cutting table. Or read the hatbox labels.")],
  'hint.rubbing.3': [L("The cape's in the red hatbox, bottom of the pile. Click it.")],
  'hint.sewing.1': [L("Molly's machine has moods. It likes oil and it likes music.")],
  'hint.sewing.2': [L('Her note is pinned above the machine. Watch the little red flag on the metronome.')],
  'hint.sewing.3': [L('Oil it from the can on the shelf, start the metronome, and press the treadle each time the red flag pops up. Four times.')],
  'hint.lens.1': [L("It's a lighthouse lamp, darling. They're shaped like a beehive for a reason, and the reason is bees.")],
  'hint.lens.2': [L('The props card leaning on it has a drawing.')],
  'hint.lens.3': [L('Stack the rings biggest first, smallest on top.')],
  'hint.dummy.1': [L('A gown goes on in a particular order, darling. Ask anyone who has ever been late.')],
  'hint.dummy.2': [L("Molly's card on the dummy. Harold's costume plot agrees, for once.")],
  'hint.dummy.3': [L('Skirt, then bodice, then cape.')],

  // ── delights ───────────────────────────────────────────────────────────────────────────────────────────────
  // wigs: each click before the sixth turns one more head (wigs.turn, in turn); after the sixth, wigs
  'wardrobe.delight.wigs.turn': [
    'A wig head turns to look at you.',
    'Another wig head turns. Ringlets.',
    'A third head turns, slowly, under a powdered tower.',
    'Four of them now. One has a monocle painted on.',
    'Five. The sixth is thinking about it.',
  ],
  'wardrobe.delight.wigs': 'They all look at you. You look at the floor.',
  'wardrobe.delight.sigh': "A costume sighs. It's been a long run.",
  'wardrobe.delight.chicken': 'Squeak. A rubber chicken, the hardest-working actor in the building.',
  'wardrobe.delight.cake': "It's a cake. It's a lie. It's theatre.",
  'wardrobe.delight.skull': 'ALAS. Someone had a sense of humour and a label.',
  'wardrobe.delight.ham': [L("Don't. I've worked with him.")],
  'wardrobe.delight.crown': [L("*The Pretender's Crown*. We don't discuss it. We especially don't discuss the second act.")],
  'wardrobe.delight.crown.seen': 'A tin crown. It has the dents of a play nobody discusses.',
  'wardrobe.delight.skylight': [N('Rain drums on the skylight, steady and enthusiastic.'), L("Applause! Oh. It's the rain. I'll take it.")],
  'wardrobe.delight.tape': [L("My measurements are a matter between me and Molly. And Molly's retired.")],
  'wardrobe.delight.pincushion': 'One pin through its heart. Wardrobe is a hard life.',
  // non-red hatboxes, taken in turn (labels bottom to top: BONNETS, BOWLERS, PANTO, FEATHERS, TOP HATS, MISC.)
  'wardrobe.delight.hatbox': [
    'BONNETS. A bonnet, squashed flat by history.',
    "BOWLERS (NOT MR PIKE'S). A bowler. Not Pike's. He'd know.",
    'PANTO. A cow\'s head, looking embarrassed for both of you.',
    'FEATHERS. Many feathers. One very surprised bird.',
    'TOP HATS. A top hat with a rabbit-shaped dent.',
    'MISC. It is.',
  ],
  'wardrobe.delight.cloak': [L("That's for the last scene. On a quick-release. Harold insists.")],
};

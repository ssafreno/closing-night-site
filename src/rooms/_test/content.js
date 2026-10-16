// Test-room content, registered at runtime (dialogue.addScript / papers.add / inventory.define) so it never ships in
// src/content/ and script-check ignores it. It doubles as a worked example of every content shape.
import { kit } from '../../engine/icons.js';

const L = (text) => ({ who: 'lavinia', text });
const P = (text) => ({ who: 'pike', text });
const C = (text) => ({ who: 'cat', text });
const N = (text) => ({ who: 'narrator', text });

export const SCRIPT = {
  // DESIGN §12 keys: <room>.enter (first entry) · <room>.enter.note (first Lavinia click) · hint.<puzzle>.1-3 (with a
  // variant) · loose ends · hint.goto.<room> · <room>.idle.n · <room>.<puzzle>.wrong.n · item.<id>.examine / .pickup
  '_test.enter': [L('Darling. A rehearsal room. Everything here exists to be poked.'), L('Click me whenever you want a note from the director. I *am* the director.')],
  '_test2.enter': [L('The wing. Two doors, one of them sulking.')],
  '_test.enter.note': [L('This is the rehearsal room. Its deliverable is the *Set*. Look about first: drag to look.')],
  'hint.test_drawer.1': [L('Desks have drawers. Drawers have locks.')],
  'hint.test_drawer.2': [L('The jar on the shelf rattles. Jars should not rattle.')],
  'hint.test_drawer.3': [L('Take the key from the jar marked KEYS and use it on the desk drawer.')],
  'hint.test_dials.1': [L('The little box on the pedestal is very pleased with itself.')],
  'hint.test_dials.2': [L('There is a note on the side table. Notes are for reading.')],
  'hint.test_dials.read.2': [L('You have read the note. Moon, sun, star. It is practically a sonnet.')],
  'hint.test_dials.3': [L('Set the dials moon, sun, star, left to right, then press the knob.')],
  'hint.test_door.1': [L('That velvet door wants something. Everything in a theatre wants something.')],
  'hint.test_door.2': [L('It opens once the Running Order says *Set*.')],
  'hint.test_door.3': [L('Solve the box. Then the velvet door will open.')],
  'hint.goto._test': [L('The rehearsal room still has business for you. Back through the door.')],
  '_test.idle.1': [L('I have nothing further to add.')],
  '_test.idle.2': [L('You are doing beautifully. I say that to everyone.')],
  '_test2.idle.1': [L('It is a corridor, darling. Corridors are for passing through.')],
  '_test.nudge': [L('Darling. You have been standing very still. Shall I give you a note?'), L('Click me. I do not bite. I am not *that* sort of ghost.')],
  'loose._test2.key': [L('You left a key in a jar back there. Keys in jars are a poor habit.')],

  // wrong attempts: said on the 1st, 3rd, 6th … attempt, in turn (Room.wrong)
  '_test.test_dials.wrong.1': [L('No. The note, darling. The *note*.')],
  '_test.test_dials.wrong.2': [L('Close. In the way that the Thames is close to the sea.')],

  // items: examine text and the first-pickup line from the script
  'item.key_brass.examine': 'Warm from the jar. It smells of pennies.',
  'item.key_brass.pickup': 'You fish a small brass key out of the jar.',

  // non-companion clicks: <who>.click.<room> → <who>.click
  'pike.click._test': [P('Standing by.')],
  'pike.click': [P('Not my department.')],
  'cat.click': [C('Don\'t mind me.'), L('That\'s Bartholomew. He came with the building. Possibly before it.')],

  // every speaker in one scene
  '_test.scene': [
    N('A rehearsal. Of sorts.'),
    L('Mr. Pike. Places, if you please.'),
    P('Places is called at the half. It is not the half.'),
    L('It is *always* the half when I say so.'),
    C('Mrrp.'),
    P('Noted.'),
  ],
  '_test.choice': {
    prompt: [L('Sit in my chair, would you? Go on. I dare you.')],
    options: [
      { text: 'Sit down anyway.', reply: [L('Bold. Wrong, but bold.')] },
      { text: 'Apologise to the chair.', reply: [L('The chair accepts. I do not.')] },
    ],
  },

  // captions (strings and pools)
  '_test.books': ['"Unit Tests for the Arcane"', '"Raycasting: A Memoir"', '"So You Have Been Turned Into a Test Fixture"'],
  '_test.door.locked': [L('Locked, darling. It opens when the Set is ticked.')],
  '_test.drawer.locked': 'Locked. There will be a key somewhere. There always is.',
  '_test.drawer.open': [L('It sticks. You have to lift and pull. I never could.')],
  '_test.jar.empty': 'An empty jar. It looks relieved.',
  '_test.window': 'Rain, or the idea of rain.',
  '_test.lever': 'Clunk. Nothing happens. Deeply satisfying.',
  '_test.box.solved': [N('The dials click home. The lid lifts on its own.'), L('Oh, *bravo*.')],
  '_test.basket.give': 'You take a dozen things from the prop basket. The bar copes.',
  '_test.basket.take': 'You put them all back. The basket sighs.',
  '_test.mark': 'Lavinia drifts to her mark.',
};

export const PAPERS = {
  '_test.note': { title: 'A note', style: 'notepaper', journalTitle: 'A note on the side table', body: 'As the night goes:\nfirst the *moon*, then the *sun*, then the *star*.\n\nLeft to right. Do not make me write it twice.', signature: '— H.P.' },
  '_test.letter': { title: 'Engine Test Letter', style: 'letter', body: 'Dear Inspector,\n\nIf you are reading this, the drawer opened, the key was used, and the paper panel works.\n\nKindly do not touch the ghost.', signature: '— The Management' },
  // the noticeboard: one of each DESIGN §10 kind
  '_test.playbill': { kicker: 'The Empress · Pelham Street', title: 'The Lamp at Gull Point', style: 'playbill', body: 'A Drama in Three Acts and a Storm\n\n*Dame Lavinia Thrush* as Grace\n\nLAST NIGHT' },
  '_test.telegram': { title: 'Post Office Telegram', style: 'telegram', body: 'ARRIVE TUESDAY STOP BRING THE GOWN STOP DO NOT LET PIKE NEAR THE THUNDER SHEET STOP' },
  '_test.typed': { title: 'Memo: Fire Regulations', style: 'typed', html: 'All gas to be off by midnight.\nNo naked flames on the fly floor.\nThe ghost light is to remain lit AT ALL TIMES. <span class="cn-pencil">underlined twice. H.P.</span>' },
  '_test.notepaper': { title: 'Dear Lavinia', style: 'notepaper', body: 'Back by the half. Do not wait up.\nKeep the lamp lit.', signature: '— D.' },
  '_test.card': { title: 'Dame Lavinia Thrush', style: 'card', body: 'With compliments.\n*Do* come again.' },
  '_test.ledger': { title: 'Sign-in Book', style: 'ledger', html: '<table><tr><th>Name</th><th>In</th><th>Out</th></tr><tr><td>L. Thrush</td><td>6.40</td><td></td></tr><tr><td>H. Pike</td><td>5.15</td><td></td></tr><tr><td><span class="cn-hand">you?</span></td><td></td><td></td></tr></table>' },
  '_test.legal': { title: 'Articles of Agreement', style: 'legal', body: 'The Artiste shall appear at every performance of the run, the last included, and shall not be excused by reason of fog, influenza, or death.' },
  '_test.ticket': { title: 'Royal Box', style: 'ticket', body: 'BOX A · ONE GUINEA\n14 MARCH' },
  '_test.certificate': { kicker: 'Borough of Pelham · Licensing Committee', title: 'Certificate of Closure', style: 'certificate', body: 'The premises known as the Empress Theatre are hereby closed to the public.\n\nSigned on behalf of the Committee.' },
  '_test.clipping': { title: 'Empress Closes', style: 'clipping', journalTitle: 'A newspaper cutting', body: 'The Empress Theatre on Pelham Street closed its doors last night, one performance short of its run. The owner could not be reached for comment. Neither could the takings. Dame Lavinia Thrush is understood to be furious, and said so to a lamp-post for some time.' },
  // a paper with pages and its own journal tab (the shape of DESIGN's Prompt Book); page 3 is torn until the drawer opens
  '_test.promptbook': {
    title: 'Prompt Book', journalTitle: 'The Prompt Book', journalTab: 'Prompt Book', style: 'typed',
    pages: [
      { title: 'Act I', html: 'GRACE discovered at the lamp.\n<span class="cn-pencil">Q1 house to half</span>' },
      { title: 'Act II', body: 'The storm. Thunder sheet on the cue, not before.' },
      { title: 'Act III', body: 'GRACE: The lamp! Someone must light the lamp!\n(Thunder. She does.)', requires: 'solved:test_drawer', missing: { title: 'Act III', body: '(the page is torn out; only a stub is left)' } },
    ],
  },
};


/** The bar's stress test: twelve items with kit icons (and one deliberately without, for the fallback pouch). */
export const ITEMS = {
  key_brass: { name: 'Small brass key', drawIcon: kit.key({ color: '#c9a24a' }) }, // examine: item.key_brass.examine
  t_bulb: { name: 'Spare bulb', examine: 'A carbon-filament bulb, still hopeful.', drawIcon: kit.bulb() },
  t_ticket: { name: 'Ticket stub', examine: 'Royal Box. Seat A.', drawIcon: kit.ticket({ text: 'BOX A' }) },
  t_bottle: { name: 'Stage blood', examine: 'Mostly syrup. Partly regret.', drawIcon: kit.bottle({ contents: '#8a1a2a' }) },
  t_box: { name: 'Greasepaint tin', examine: 'No. 5 and No. 9, the classic blend.', drawIcon: kit.box({ color: '#3a5a7a', band: '#e8c86a' }) },
  t_roll: { name: 'Piano roll', examine: 'Perforated. Possibly rude.', drawIcon: kit.roll() },
  t_fabric: { name: 'Velvet swatch', examine: 'Crimson. It wants to be a curtain.', drawIcon: kit.fabric() },
  t_coin: { name: 'Shilling', examine: 'The price of the gallery, once.', drawIcon: kit.coin({ mark: '1s' }) },
  t_spanner: { name: 'Fly-floor spanner', examine: 'For the counterweights. Heavy, honest.', drawIcon: kit.tool({ kind: 'spanner' }) },
  t_flower: { name: 'A lily', examine: 'From a bouquet ninety-five years old. It has not noticed.', drawIcon: kit.flower() },
  t_gem: { name: 'Paste jewel', examine: 'Glass. Lavinia insists otherwise.', drawIcon: kit.gem({ color: '#5aa0d8' }) },
  t_page: { name: 'Torn page', examine: 'A corner of something important.', drawIcon: kit.paper({ torn: true, lines: 4 }) },
  t_mystery: { name: 'Mystery object', examine: 'No icon on purpose: the engine draws a pouch.' },
};
export const BASKET = Object.keys(ITEMS).filter((k) => k.startsWith('t_'));

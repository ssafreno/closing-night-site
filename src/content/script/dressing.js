// Lines for Dressing Room No. 1 (docs/rooms/dressing.md). WRITER owns this file. Room agents: ADD keys (marked
// // ADDED BY <agent>), never rewrite lines. Pike has never been in. Lavinia is reluctant here, then honest.
// Story beats are three keys each (a/b/c); the room plays them as one lines value with a click between.
import { L, N } from './speakers.js';

export const complete = true;

const lilies = [L('An admirer. I had dozens.'), L("...That's Harold's writing.")];

export const lines = {
  // ── arrival ────────────────────────────────────────────────────────────────────────────────────────────────
  'dressing.enter': [
    L("My room. I haven't been in since... fairly recently."),
    L("Don't touch the chaise, darling. It's resting."),
  ],
  'dressing.enter.note': [L("The last page is in here somewhere, darling. I'm almost sure.")],
  'dressing.idle.1': [L('Number One, {name}. They tried to give it to a soprano once. Once.')],
  'dressing.idle.2': [L('Dot did my hair at that table every night for eleven years. She hummed. Flat.')],
  'dressing.idle.3': [L("I'm not putting it off, darling. I'm letting you find it. It's different.")],

  // ── mirror ─────────────────────────────────────────────────────────────────────────────────────────────────
  'dressing.mirror.dot': [L('Dot pinned my beginners behind my chair, back to front, so I could read it in the glass.')],
  'dressing.mirror.noreflection': [N('The mirror shows the room, the chaise, the lilies. It does not show Lavinia.')],
  'dressing.mirror.lighting': [L("It's the lighting in here.")],
  'dressing.mirror.door': [L("That's the door, darling. Dot's card is behind my chair.")],
  'dressing.mirror.wrong.1': 'The mirror swings back face-down with a thunk.',
  'dressing.mirror.solved': [L('Dot. Eleven years, and she never once let me go on without the lily.')],
  'dressing.birthday': [L('A typing error. They charge by the word, so they make them up.')],

  // ── basket (the burnt telegram: warm, not angry) ───────────────────────────────────────────────────────────
  'dressing.basket.dark': [L("You'll want the good lights for that, darling. I always did.")],
  'dressing.basket.first': [L('I burned it, darling. Very dramatic. Dot said the print stays on the ash if you catch it in the light.')],
  'dressing.basket.lift': [N('You lift it out like a soufflé.')],
  'dressing.basket.wrong.1': 'Ash. Interesting ash. Unreadable ash.',
  'dressing.basket.wrong.2': 'The ash keeps its own counsel.',
  'dressing.basket.wrong.3': 'Black on black. Nothing to read yet.',
  'dressing.story.1a': [L("He called me 'old girl'. I've never forgiven the 'old'.")],
  'dressing.story.1b': [L('Harold read his to the company at the Half, gently, and they all went home.')],
  'dressing.story.1c': [L("I didn't. I had a show.")],
  'dressing.basket.solved': [N('The ash rests on the slope at its angle, every word still legible.')],

  // ── vanity ─────────────────────────────────────────────────────────────────────────────────────────────────
  'dressing.vanity.ritual': [L('Gloves, pearls, feathers, flowers, darling. In that order, or I dry.')],
  'dressing.vanity.wrong.1': 'Every drawer slams shut at once.',
  'dressing.vanity.wrong.2': [L("No, no. I'd have stood in the wings with my mouth open.")],
  'dressing.vanity.wrong.3': 'Thunk. The dressing table resets itself, primly.',
  'dressing.story.2a': [L('Harold never comes in here. Thirty-one years.')],
  'dressing.story.2b': [L("He's been standing by. All this time.")],
  'dressing.story.2c': [L('Well. Stage managers. No sense of an ending.')],
  'dressing.vanity.solved': [L('And he left the gramophone handle with it. Harold thinks of everything, eventually.')],

  // ── gramophone ─────────────────────────────────────────────────────────────────────────────────────────────
  'dressing.gramophone.unwound': "The platter won't turn. There's a crank socket in the side, and no crank in it.", // ADDED BY puzzles-dressing
  'dressing.gramophone.tin': 'A tin of gramophone needles. LOUD TONE, it says, as a warning.', // ADDED BY polish: the needle tin (it read as the crank socket)
  'dressing.gramophone.note': [L("I'll give you the note, darling. Make me agree with myself.")],
  'dressing.gramophone.low': [L('I never sounded like Mr Volley.')],
  'dressing.gramophone.high': [L('I never sounded like a bee.')],
  'dressing.gramophone.wrong.1': [L('Close, darling. Close is for horseshoes.')],
  'dressing.gramophone.wrong.2': [L('Nearly me. Nearly never got top billing.')],
  'dressing.gramophone.wrong.3': [L("Almost, darling. That's what understudies say.")],
  'dressing.story.3a': [L('I hid it, darling. The last page.')],
  'dressing.story.3b': [L("If there's no last page, there's no last night, and if there's no last night it isn't over.")],
  'dressing.story.3c': [L("It's in my jewel case, under the chaise. The combination is the year I was born, and the year is none of your business.")],
  'dressing.jewelcase.reveal': 'Something red glints under the fringe of the chaise.',
  'dressing.gramophone.solved': [L('There. Both of me, in tune. The younger one was showing off.')],

  // ── jewel case ─────────────────────────────────────────────────────────────────────────────────────────────
  'dressing.jewelcase.1900': [L('1900. Darling, how sweet. Wrong, but sweet.')],
  'dressing.jewelcase.date': [L("That's my birthday, darling. I said the year. Reluctantly, but I said it.")],
  'dressing.jewelcase.wrong.1': 'The clasp stays shut.',
  'dressing.jewelcase.wrong.2': [L('No. And I shan\'t say whether you were warm.')],
  'dressing.jewelcase.wrong.3': 'The clasp declines. It was made by a jeweller who had met actresses.',
  'dressing.jewelcase.solved': [L('Well. Places, then.')],

  // ── lilies ─────────────────────────────────────────────────────────────────────────────────────────────────
  'dressing.lilies': lilies,
  'dressing.delight.lilies': lilies, // ALIAS of dressing.lilies

  // ── deliverable ────────────────────────────────────────────────────────────────────────────────────────────
  'dressing.done': [
    L("Page ninety-seven. That's THE SCRIPT, darling. All of it, at last."),
    L("Take it to Harold. He'll pretend he hasn't been waiting."),
  ],
  'dressing.return': [L("My room, with the lights on. It's smaller than I remember. I was larger.")],
  'item.winder.pickup': 'A gramophone winding handle, kept in a drawer it had no business being in.',
  'item.lastpage.pickup': 'Page 97 of the prompt book, folded small. Pencil cue boxes run down the margin.',

  // ── hints ──────────────────────────────────────────────────────────────────────────────────────────────────
  'hint.mirror.1': [L('Dot always said I only listened to the mirror.')],
  'hint.mirror.2': [L('Stand the mirror up and turn it until you can see the wall behind my chair.')],
  'hint.mirror.3': [L("Tilt it upright, turn it one stop to the left, and read Dot's card in the glass.")],
  'hint.basket.1': [L('I burned something that night, darling. Not my finest exit, but a very good one.')],
  'hint.basket.2': [L("It's in the waste-paper basket. Catch the ash in the mirror lights, at an angle.")],
  'hint.basket.3': [L('Tilt the writing slope about two-thirds of the way up until the print shows, then click it.')],
  'hint.vanity.1': [L('I never went on without my little ritual. Nobody does. Ask a tenor about his scarf.')],
  'hint.vanity.2': [L("Dot's card in the mirror lists my beginners, in order. The drawers have pictures.")],
  'hint.vanity.3': [L('Gloves, pearls, feathers, lily. Open the drawers in that order.')],
  'hint.gramophone.1': [L("That's me on that record, darling. I'd know me anywhere, at the right speed.")],
  'hint.gramophone.2': [L("The label says the speed. The little striped card tells you when you've got it.")],
  'hint.gramophone.3': [L('Wind it, drop the needle, and slide the lever until the ring marked seventy-eight stands still.')],
  'hint.jewelcase.1': [L("The combination's a year, darling. Not the one I tell people.")],
  'hint.jewelcase.2': [L("Crane's contract in your journal has the year. So does Mother's telegram in the mirror frame, if you can subtract.")],
  'hint.jewelcase.3': [L('One, eight, seven, seven. Never repeat it.')],

  // ── delights ───────────────────────────────────────────────────────────────────────────────────────────────
  'dressing.delight.footlights': [L('Dr Footlights. Never missed a performance under his care. I had pneumonia for the whole of 1909.')],
  'dressing.delight.perfume': [L("Jicky. Don't tell Ada.")],
  'dressing.delight.fanletters': [N('"Dear Miss Thrush, I have now seen you eleven times..."'), L('Twelve. He came back.')],
  'dressing.delight.wardrobe': 'The gowns sigh on their hangers. Each one still smells faintly of a third act.',
  'dressing.delight.photo': [L('Me. Thirty-one.'), N('The photograph says 1912.')],
  'dressing.delight.window': 'The view from Dressing Room No. 1 is a wall. Stars always get the walls.',
  'dressing.delight.greasepaint': 'Leichner No. 5 and No. 9. The colours of a lie well told.',
  'dressing.delight.powder': [N('A soft cloud rises. Lavinia sneezes, politely, behind one hand.'), L('The powder, darling. Not the dust. I am never dusty.')],
  'dressing.delight.radiator': 'Stone cold. She told the management so, in writing, weekly.',
  'dressing.delight.telegrams': [ // caption pool, one per click (after mirror)
    'ENJOY YOUR LAST NIGHT STOP NOT TOO MUCH STOP ADA',
    'SEE YOU AT THE HALF STOP RUPERT',
  ],
  'dressing.delight.chaiseunder': 'Dust. And a shoe.',
};

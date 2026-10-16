// The content manifest: the single list of what the game contains, read by the engine (ctx.manifest) and by
// scripts/script-check.mjs. ENGINE wrote the shape; DESIGN / WRITER own the values (ids are canonical in docs/DESIGN.md).
//
//   characters    speaker ids the script may use (`who`)
//   rooms         in play order: { id, title, puzzleOrder: [puzzle ids in intended solve order], deliverables: [ids] }
//                 puzzleOrder here is what Hints uses unless the room class sets its own static puzzleOrder.
//   devRooms      engine test rooms (same shape; script-check skips their content)
//   runningOrder  the lines of the Running Order paper: { id, text, needs?: [deliverable ids] (default [id]),
//                 note?: small print }. A line ticks when every deliverable in `needs` is set (journal.deliver(id)).
//   items         every inventory item id (src/content/items.js gives each a name and icon; examine text there or
//                 in the script key item.<id>.examine)
//   papers        { room: [paper ids] }: src/content/papers/<room>.js must define each ('runningorder' is generated)
//
// Values from docs/DESIGN.md §5 and §12 (2026-10-15). DESIGN owns them: when the bible changes, change them here.
// Running Order note: DESIGN's flag `ro.<lineId>` is `deliverable.<lineId>` in code (journal.deliver / delivered).

export const manifest = {
  characters: ['lavinia', 'lavinia_off', 'pike', 'cat', 'narrator'],

  rooms: [
    { id: 'door', title: 'Stage Door', puzzleOrder: ['hutch', 'meter', 'keypress', 'signin'], deliverables: [] },
    { id: 'stage', title: 'The Stage', puzzleOrder: ['ghostlight', 'mains', 'dimmer', 'flyrail', 'lighthouse'], deliverables: ['ghost', 'light', 'set'] },
    { id: 'wardrobe', title: 'Wardrobe', puzzleOrder: ['rack', 'rubbing', 'sewing', 'lens', 'dummy'], deliverables: ['costume'] },
    { id: 'pit', title: 'The Pit', puzzleOrder: ['tuning', 'pianoroll', 'thunder', 'wind', 'rain'], deliverables: ['music', 'storm'] },
    { id: 'foyer', title: 'Front of House', puzzleOrder: ['chandelier', 'safe', 'poster', 'houseboard', 'ticketing'], deliverables: ['house'] },
    { id: 'dressing', title: 'Dressing Room No. 1', puzzleOrder: ['mirror', 'basket', 'vanity', 'gramophone', 'jewelcase'], deliverables: ['script'] },
    { id: 'finale', title: 'Places, Please', puzzleOrder: ['cues'], deliverables: [] },
  ],

  devRooms: [
    { id: '_test', title: 'Rehearsal Room', puzzleOrder: ['test_drawer', 'test_dials', 'test_door'], deliverables: ['ghost', 'light', 'set', 'music', 'storm'] },
    { id: '_test2', title: 'The Wing', puzzleOrder: [], deliverables: [] },
  ],

  // DESIGN §5: seven lines and a pre-ticked zeroth (the stage delivers 'ghost' as it writes the card)
  runningOrder: [
    { id: 'ghost', text: 'A light to see by' },
    { id: 'light', text: 'LIGHT', note: "moonlight, as in Harold's book" },
    { id: 'set', text: 'SET', note: 'the Gull Point cloth in, the lighthouse on its marks' },
    { id: 'costume', text: 'COSTUME', note: 'my storm gown, and the lamp' },
    { id: 'music', text: 'MUSIC', note: 'the overture' },
    { id: 'storm', text: 'STORM', note: 'wind, rain and thunder' },
    { id: 'house', text: 'THE HOUSE', note: 'lights, doors, and an audience' },
    { id: 'script', text: 'THE SCRIPT', note: 'the last page' },
  ],

  items: [
    'clipboard', 'pen', 'key_hutch', 'shilling', 'key_pass', 'fuse_r', 'fuse_y', 'fuse_b', 'bodice', 'chalk', 'cape',
    'oilcan', 'skirt', 'lamp', 'mallet', 'winch_handle', 'ear_trumpet', 'key_chain', 'ticket', 'winder', 'lastpage',
  ],

  // paper id → room (the journal groups by it; script-check checks each is defined in src/content/papers/<room>.js)
  papers: {
    door: ['certificate', 'callboard', 'signinbook', 'alfnote'],
    stage: ['runningorder', 'promptbook', 'fusetag'],
    wardrobe: ['marks', 'orderpad', 'sewingnote', 'propcard', 'dummycard'],
    pit: ['tunercard', 'score', 'bandplan'],
    foyer: ['lastnight', 'prices', 'seatplan', 'wiringcard', 'iou', 'contract', 'ordinarycat'],
    dressing: ['birthday', 'beginners', 'crane', 'pikenote', 'lilycard', 'lastpage'],
  },
};

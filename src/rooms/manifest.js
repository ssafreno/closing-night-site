// Which room modules exist. main.js imports only `ready` rooms (no 404 probing), so a SET agent flips its room's
// `ready` to true in the same commit that adds src/rooms/<id>/index.js. Dev rooms load when the URL asks for one,
// with ?dev, or when no real room is ready yet.
//
// A room module's default export (or any exported class with a static id) is the Room subclass.
export const ROOMS = [
  { id: 'door', module: './door/index.js', ready: true },
  { id: 'stage', module: './stage/index.js', ready: true },
  { id: 'wardrobe', module: './wardrobe/index.js', ready: true },
  { id: 'pit', module: './pit/index.js', ready: true },
  { id: 'foyer', module: './foyer/index.js', ready: true },
  { id: 'dressing', module: './dressing/index.js', ready: true },
  { id: 'finale', module: './finale/index.js', ready: true },
  { id: '_test', module: './_test/index.js', ready: true, dev: true },
  { id: '_test2', module: './_test/wing.js', ready: true, dev: true },
];

/** New games start here. */
export const START_ROOM = 'door';
/** The title screen pans across this room (falls back to the start room, then any ready room). */
export const TITLE_ROOM = 'stage';

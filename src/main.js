// Boot: import the ready rooms (src/rooms/manifest.js), init the engine, then the title or ?room=.
import { Game } from './engine/Game.js';
import { ROOMS, START_ROOM, TITLE_ROOM } from './rooms/manifest.js';
import { manifest } from './content/manifest.js';

const q = new URLSearchParams(location.search);
const wantRoom = q.get('room') || '';
const anyReal = ROOMS.some((r) => r.ready && !r.dev);
const wantDev = (q.has('dev') && q.get('dev') !== '0') || wantRoom.startsWith('_') || !anyReal;

async function loadRooms() {
  const list = ROOMS.filter((r) => r.ready && (!r.dev || wantDev));
  const base = new URL('./rooms/', import.meta.url);
  const results = await Promise.all(list.map(async (r) => {
    try {
      const mod = await import(new URL(r.module, base).href);
      const Cls = mod.default || Object.values(mod).find((v) => typeof v === 'function' && v.id);
      if (!Cls) console.error(`[main] ${r.module} exports no Room class`);
      else if (Cls.id !== r.id) console.error(`[main] ${r.module}: class id "${Cls.id}" does not match manifest id "${r.id}"`);
      return Cls || null;
    } catch (e) {
      console.error(`[main] failed to load room "${r.id}" (${r.module})`, e);
      return null;
    }
  }));
  return results.filter(Boolean);
}

// ENGINE-FIX: the inspector's kit (DESIGN §3): the clipboard holding the Certificate of Vacancy, and the pen. Handed out
// at New Game and on every fresh ?room= jump, so a dev jump past the door has it too. `kit.given` keeps the door's own
// first-build hand-out (src/rooms/door/index.js giveStartKit) from doing it again.
function startKit({ state, inventory, journal }) {
  for (const id of ['clipboard', 'pen']) if (!inventory.has(id)) inventory.add(id, { silent: true });
  journal.collect('certificate', { quiet: true });
  state.set('kit.given', true);
}

const rooms = await loadRooms();
const game = new Game({ rooms, startRoom: START_ROOM, titleRoom: TITLE_ROOM, manifest, startKit });
await game.init();
game.ctx.inventory.linkPaper('clipboard', 'certificate'); // ENGINE-FIX: clicking the clipboard reads the certificate
await game.boot();

// rack (CIPHER): Molly's Marks decode the Act III bodice tag (docs/rooms/wardrobe.md).
//   Costume rack (room) → its close-up (focus:rack); the first open says wardrobe.rack.first (once). Drag left/right
//   anywhere in the close-up (on a garment, a tag or the wall behind) to slide along the rail (rackSlide). Click a
//   garment: its tag swings up to the camera (stamp, thread, notches). Click the same garment (or its tag) again: take
//   it. Garment 3 (slot index 2: lighthouse / lilac / III) → bodice, wardrobe.rack.solved, solve. Any other: it lifts,
//   Lavinia names it (velvet / ada / pretender, and the writer's optional walking / armour / pierrot, each once), else
//   the wrong cadence (wardrobe.rack.wrong.n), and it swings back onto the rail.
import * as THREE from 'three';

export default function rack(ctx, room, h) {
  const { state, dialogue, audio, inventory, camera, hotspots } = ctx;
  const R = h.rack;
  const VIEW = 'focus:rack';
  const solved = () => state.isSolved('rack');
  const sfx = (n, gain = 0.5) => audio?.play(n, { gain });
  // Lavinia's named lines, by slot index (each said once; a second wrong take of the same garment uses the cadence)
  const NAMED = { 0: 'wardrobe.rack.walking', 1: 'wardrobe.rack.velvet', 3: 'wardrobe.rack.ada', 4: 'wardrobe.rack.pretender', 10: 'wardrobe.rack.armour', 11: 'wardrobe.rack.pierrot' };
  const U_OPEN = 0.18;
  let u = U_OPEN;      // the close-up's place along the rail (0 = the stair end, 1 = the far end)
  let busy = false;    // a take / wrong beat is running
  let drag = null;
  let rackOpens = 0;

  const view = () => R.viewAt(u);
  const restPresented = () => { const p = R.presented(); if (p != null) R.restTag(p); };

  // ---- the room view: open the close-up (the `sigh` delight lives here too) ------------------------------------------
  room.spot('rack', R.hitAll, 'Costume rack', R.object, {
    onClick: () => {
      rackOpens++;
      // the `sigh` delight: the rack in room view sighs on every third visit, and on every click once solved
      if (solved() || rackOpens % 3 === 0) {
        sfx('costumeSigh', 0.5); R.sigh(); dialogue.caption('wardrobe.delight.sigh');
        if (solved()) return;
      }
      sfx('rackSlide', 0.35);
      u = U_OPEN;
      room.focusOn(view(), VIEW, 'rack', {
        onExit: () => { drag = null; const p = R.presented(); if (p != null) R.restTag(p); },
        // POLISH: Esc / Back with a tag held up lowers the tag first; the next one leaves the rack
        onBack: () => { const p = R.presented(); if (p == null || busy) return false; sfx('fabricRustle', 0.25); R.restTag(p); return true; },
      });
      if (!state.get('wardrobe.rack.firstsaid')) {
        state.set('wardrobe.rack.firstsaid', true);
        room.later(0.8, () => dialogue.say('wardrobe.rack.first'));
      }
    },
  });

  // ---- sliding along the rail ----------------------------------------------------------------------------------------
  const W = () => window.innerWidth || 1280;
  const onDragStart = (info) => { drag = { x: info.x, u0: u, moved: false, lastSfx: 0 }; };
  const onDrag = (info) => {
    if (!drag || hotspots.scope !== VIEW) return;
    const dx = info.x - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      drag.moved = true;
      restPresented();
    }
    const now = performance.now();
    if (now - drag.lastSfx > 450) { drag.lastSfx = now; sfx('rackSlide', 0.3); }
    // grab-and-drag: the rail follows the pointer (screen right is further along the rail)
    u = THREE.MathUtils.clamp(drag.u0 - (dx / W()) * 0.95, 0, 1);
    camera.refocus({ ...view(), duration: 0.12 });
  };
  const onDragEnd = () => { drag = null; };
  const dragOpts = { onDragStart, onDrag, onDragEnd };

  // the wall behind the garments: a drag anywhere in the close-up slides (a plain click there does nothing)
  const back = hotspots.proxyBox(0.04, 2.3, 5.0);
  back.position.set(-3.22, 1.25, -1.3);
  room.group.add(back);
  room.spot('rack.rail', back, '', null, { scope: VIEW, highlight: false, ...dragOpts, onClick: () => {} });

  // ---- garments and their tags ------------------------------------------------------------------------------------------
  // puzzles-wardrobe: the SET's garment proxies were one size (1 m tall, 0.34 wide) while the gowns flare to 0.9 m at
  // the hem 0.35 m apart, so in the oblique close-up a short bodice's box overhung its long neighbour's skirt (clicking
  // the bombazine presented the satin bodice). The garments themselves are the click targets now (the real surface,
  // nearest first); the proxies are taken out of the ray.
  R.slots.forEach((s) => { s.hit.userData.noRaycast = true; });
  const name =(s) => s.def.name[0].toUpperCase() + s.def.name.slice(1);
  const click = (i) => {
    if (busy || solved() || drag?.moved) return;
    if (R.presented() !== i) { sfx('fabricRustle', 0.35); R.presentTag(i); return; }
    take(i);
  };
  R.slots.forEach((s) => {
    room.spot(`garment${s.i + 1}`, s.slot, () => (R.presented() === s.i ? `Take the ${s.def.name}` : name(s)), s.slot, {
      scope: VIEW, enabled: () => s.present && !solved(), ...dragOpts, onClick: () => click(s.i),
    });
    // the presented tag floats in front of everything: clicking it is clicking its garment again
    room.spot(`tag${s.i + 1}`, s.tag, () => `Take the ${s.def.name}`, s.tag, {
      scope: VIEW, enabled: () => s.present && !solved() && R.presented() === s.i, ...dragOpts, onClick: () => click(s.i),
    });
  });

  const take = async (i) => {
    busy = true;
    const s = R.slots[i];
    try {
      if (i === 2) {
        const from = s.slot.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.3, 0));
        sfx('fabricRustle', 0.7);
        await R.take(2);
        inventory.add('bodice', { from });
        state.solve('rack');
        await room.wait(0.35);
        camera.exitFocus();
        ctx.characters?.lavinia?.react?.('flourish');
        dialogue.say('wardrobe.rack.solved');
        return;
      }
      // wrong garment: it lifts off the rail, Lavinia names it, it swings back
      sfx('fabricRustle', 0.5);
      await R.restTag(i, true);
      await R.lift(i);
      const key = NAMED[i];
      if (key && dialogue.has(key) && !state.get(`wardrobe.rack.named.${i}`)) {
        state.set(`wardrobe.rack.named.${i}`, true);
        state.inc('wrong.rack');
        if (i === 4) state.set('wardrobe.pretender.said', true); // the crown delight then keeps to its caption
        ctx.characters?.lavinia?.react?.(i === 1 ? 'sigh' : i === 4 ? 'shake' : 'brow');
        dialogue.say(key);
      } else room.wrong('rack');
      await room.wait(0.7);
      await R.swingBack(i);
    } finally { busy = false; }
  };

  return {
    restore() {
      busy = false; drag = null; u = U_OPEN;
      const p = R.presented(); if (p != null) R.restTag(p, true);
    },
  };
}

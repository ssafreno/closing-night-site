// rubbing (TOOL): tailor's chalk on the order pad; the cape is in the red hatbox (docs/rooms/wardrobe.md).
//   Chalk (cutting table, glints) → inventory. The order pad (room) opens its close-up (focus:pad), with the chalk
//   selected or not; with chalk in the inventory, dragging across the sheet rubs (chalkRub) and the indented writing
//   shows white through the chalk. At 80% of the text area rubbed: the chalk is used up (wardrobe.chalk.used), the
//   note is legible and opens as the paper `orderpad` (wardrobe.orderpad.read). Without chalk the pad only says it is
//   blank but pressed. The red hatbox (WET WEATHER, bottom of the tower), clicked any time: the tower topples
//   (hatboxTopple, wardrobe.toppled), the red lid pops, the sea-green cape lifts out → cape, wardrobe.rubbing.solved,
//   solve. Unused chalk in hand then goes back on the cutting table, silently. Chalk on anything else in the room:
//   item.chalk.wrong (index.js).
import * as THREE from 'three';
import { burst } from '../../engine/props/particles.js';

export default function rubbing(ctx, room, h) {
  const { state, dialogue, audio, inventory, camera, hotspots, papers } = ctx;
  const VIEW = 'focus:pad';
  const P = h.pad, HB = h.hatboxes, C = h.chalk;
  const solved = () => state.isSolved('rubbing');
  const revealed = () => room._padRevealed();
  const sfx = (n, gain = 0.5) => audio?.play(n, { gain });
  const RUB_R = 0.06; // brush radius, as a fraction of the sheet's width
  let rub = null;
  let finishing = false;
  let opening = false;

  // ---- the chalk ---------------------------------------------------------------------------------------------------
  room.spot('chalk', C.hit, "Tailor's chalk", C.object, {
    enabled: () => C.object.visible,
    onClick: () => {
      const from = C.worldPos();
      C.setPresent(false);
      inventory.add('chalk', { from });
    },
  });

  // ---- the order pad -------------------------------------------------------------------------------------------------
  const openPad = () => {
    if (revealed()) { papers.show('orderpad'); return; }
    // POLISH: already in the close-up, a plain click with the chalk is a dab: say the rub wants a drag (integration-qa:
    // "using the chalk on the pad only opens the pad, and the rub needs a drag. Nothing says so")
    if (hotspots.scope === VIEW) {
      if (inventory.has('chalk') && dialogue.has('wardrobe.pad.dab')) dialogue.caption('wardrobe.pad.dab', { scope: VIEW });
      return;
    }
    room.focusOn(P.focus, VIEW, 'rubbing', { onExit: () => { rub = null; } });
    if (!inventory.has('chalk')) dialogue.caption('wardrobe.pad.blank', { scope: VIEW });
    else if (dialogue.has('wardrobe.pad.chalk')) dialogue.caption('wardrobe.pad.chalk', { scope: VIEW }); // POLISH
  };
  room.spot('pad', P.hit, 'Order pad', P.object, {
    scope: ['room', VIEW],
    onClick: openPad,
    useItem: { chalk: () => { inventory.deselect(); openPad(); } },
    onDragStart: (info) => {
      rub = null;
      if (hotspots.scope !== VIEW || revealed() || finishing || !inventory.has('chalk')) return;
      rub = { last: P.uvFromRay(info.ray), x: info.x, y: info.y, moved: false, sfxAt: 0 };
    },
    onDrag: (info) => {
      if (!rub) return;
      if (!rub.moved) { if (Math.hypot(info.x - rub.x, info.y - rub.y) < 4) return; rub.moved = true; }
      const uv = P.uvFromRay(info.ray);
      if (!uv) { rub.last = null; return; }
      if (rub.last) P.rubLine(rub.last.u, rub.last.v, uv.u, uv.v, RUB_R); else P.rubAt(uv.u, uv.v, RUB_R);
      rub.last = uv;
      const now = performance.now();
      if (now - rub.sfxAt > 320) { rub.sfxAt = now; sfx('chalkRub', 0.5); }
      if (P.coverage() >= 0.8) complete();
    },
    onDragEnd: () => { rub = null; },
  });

  const complete = async () => {
    if (finishing) return;
    finishing = true; rub = null;
    try {
      inventory.remove('chalk');
      state.set('wardrobe.chalk.used', true);
      state.set('wardrobe.orderpad.read', true);
      // the last strokes fill in: the whole note stands out white on grey
      await room.wait(0.25);
      P.setRevealed(true);
      sfx('chalkRub', 0.4);
      await room.wait(0.6);
      await papers.show('orderpad');
      if (hotspots.scope === VIEW) camera.exitFocus();
    } finally { finishing = false; }
  };

  // ---- the red hatbox ------------------------------------------------------------------------------------------------
  room.spot('hatbox.red', HB.red.hit, 'Red hatbox (WET WEATHER)', HB.red.object, {
    onClick: async () => {
      if (opening) return;
      if (solved() || inventory.has('cape')) { sfx('fabricRustle', 0.25); dialogue.caption('wardrobe.hatbox.empty'); return; }
      opening = true;
      try {
        if (!HB.toppled()) {
          sfx('hatboxTopple', 0.8);
          state.set('wardrobe.toppled', true);
          ctx.characters?.lavinia?.react?.('gasp');
          await HB.topple(); // the heap settles, then the red lid pops
          burst(ctx, room.group, HB.red.object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0)).toArray(), { count: 24, radius: 0.25 });
          await room.wait(0.35);
        }
        // the cape lifts out of the box and into your arms
        const cape = HB.cape, y0 = cape.position.y;
        sfx('fabricRustle', 0.6);
        await ctx.tween.run(0.45, (k) => { cape.position.y = y0 + 0.35 * k; }, { ease: 'outCubic' });
        const from = cape.getWorldPosition(new THREE.Vector3());
        HB.setCape(false); cape.position.y = y0;
        inventory.add('cape', { from });
        state.solve('rubbing');
        // spare chalk goes back on the cutting table, silently
        if (inventory.has('chalk')) { inventory.remove('chalk'); C.setPresent(true); }
        await room.wait(0.3);
        ctx.characters?.lavinia?.react?.('laugh');
        await dialogue.say('wardrobe.rubbing.solved');
      } finally { opening = false; }
    },
  });

  return {
    restore() { rub = null; finishing = false; opening = false; },
  };
}

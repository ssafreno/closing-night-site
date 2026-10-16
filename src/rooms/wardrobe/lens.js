// lens (STACK): five glass rings on the lamp's spindle, biggest at the base (docs/rooms/wardrobe.md).
//   Lamp prop (room) → its close-up (focus:lens): the brass base and spindle, five rings in the felt tray (22, 19,
//   16, 13, 10 cm, shuffled; 22 never first from the left). Click a ring in the tray: it lifts and hovers (a hovering
//   one goes back first); the first lift says wardrobe.lens.cake (once). Click the hovering ring again: back to the
//   tray. Click the spindle: the hovering ring drops onto the stack (lensClink, pitched by size). Click the top ring of
//   the stack: it lifts back off and hovers. A ring wider than the one beneath: it seats, the stack wobbles and every
//   ring slides back to the tray (lensSlide), the wrong cadence (wardrobe.lens.wrong.n). The fifth ring seated (which
//   can only be 22, 19, 16, 13, 10 from the bottom): success, the bulb lights and throws a ring of light on the wall,
//   the lamp lifts away → lamp, solve, wardrobe.lens.solved. Clicks queue: rapid clicks are taken in order, never lost.
export default function lens(ctx, room, h) {
  const { state, dialogue, audio, inventory, camera, hotspots } = ctx;
  const VIEW = 'focus:lens';
  const LN = h.lens;
  const solved = () => state.isSolved('lens');
  const sfx = (n, gain = 0.5, extra = {}) => audio?.play(n, { gain, ...extra });
  const clink = (r, gain = 0.6) => sfx('lensClink', gain, { size: Math.round(r.d * 100) });
  const hovering = () => LN.rings.find((r) => r.where === 'hover');
  let finishing = false;
  let chain = Promise.resolve();
  let epoch = 0; // bumped by restore(): queued clicks from before a restore are dropped
  /** Run `fn` after every earlier click has played out. */
  const queue = (fn) => {
    const e = epoch;
    chain = chain.then(() => (e === epoch && !finishing ? fn() : null)).catch((err) => console.error(err));
    return chain;
  };

  room.spot('lens', LN.hit, 'Lamp prop', LN.lamp, {
    enabled: () => LN.lamp.visible,
    onClick: () => room.focusOn(LN.focus, VIEW, 'lens'),
  });

  // ---- rings ---------------------------------------------------------------------------------------------------------
  LN.rings.forEach((r) => {
    room.spot(`ring${r.k}`, r.hit, 'Glass ring', r.object, {
      scope: VIEW,
      enabled: () => !solved() && r.object.visible,
      onClick: () => queue(async () => {
        if (r.where === 'stack') {
          if (LN.stack().at(-1) !== r.k) return; // only the top ring comes off
          const hv = hovering(); if (hv) await LN.returnRing(hv.k);
          clink(r, 0.35);
          await LN.popTop();
          return;
        }
        if (r.where === 'hover') { clink(r, 0.3); await LN.returnRing(r.k); return; }
        const hv = hovering();
        if (hv) await LN.returnRing(hv.k);
        clink(r, 0.35);
        if (!state.get('wardrobe.lens.cakesaid')) {
          state.set('wardrobe.lens.cakesaid', true);
          room.later(0.4, () => dialogue.say('wardrobe.lens.cake'));
        }
        await LN.liftRing(r.k);
      }),
    });
  });

  // ---- the spindle ---------------------------------------------------------------------------------------------------
  room.spot('spindle', LN.spindleHit, 'Lamp spindle', LN.lamp, {
    scope: VIEW,
    enabled: () => !solved(),
    onClick: () => queue(async () => {
      const hv = hovering();
      if (!hv) return;
      const below = LN.stack().at(-1);
      const wider = below != null && LN.sizes[hv.k] > LN.sizes[below];
      await LN.dropOnSpindle(hv.k);
      clink(hv, 0.7);
      if (wider) {
        await room.wait(0.12);
        sfx('lensSlide', 0.6);
        room.wrong('lens');
        await LN.wobbleAndReturn();
        return;
      }
      if (LN.stack().length === 5) await complete();
    }),
  });

  const complete = async () => {
    if (finishing) return;
    finishing = true;
    try {
      sfx('success', 0.6);
      await LN.setSolved(true); // the bulb glows, the glass throws its ring of light on the wall
      await room.wait(1.1);
      const from = LN.worldPos();
      await LN.takeLamp();
      inventory.add('lamp', { from });
      state.solve('lens');
      await room.wait(0.2);
      if (hotspots.scope === VIEW) camera.exitFocus();
      ctx.characters?.lavinia?.react?.('flourish');
      await dialogue.say('wardrobe.lens.solved');
      room.checkCostume();
    } finally { finishing = false; }
  };

  return {
    restore() { epoch++; chain = Promise.resolve(); finishing = false; },
  };
}

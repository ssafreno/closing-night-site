// dummy (PARTS): dress the dummy from the skin out: skirt, bodice, cape (docs/rooms/wardrobe.md).
//   Room click, no close-up. Use a garment on the dummy: the next one in skin-out order animates on (dummyDress; skirt
//   drops over the petticoat, bodice closes, cape settles), leaves the inventory and is saved in wardrobe.dummy (the
//   layers on, in order). Out of order: it slides off and stays in the inventory (fabricRustle), the wrong cadence
//   (wardrobe.dummy.wrong.n; the 1st is Lavinia's "Underneath first"). Each can go on as soon as the order allows. After
//   the cape: solve; Lavinia drifts into the dummy (ghostShimmer, the 1 s lilac flare), out again in the storm gown
//   (costume `storm` from now on, placed by every room's _placeCast from solved.dummy), the flavour choice
//   wardrobe.dummy.solved ("You look well." / "Very... stormy."), then COSTUME if the lamp is built (room.checkCostume).
//   A plain click shows Molly's label (dummycard); after the solve, a caption. The gown stays on the dummy.
const ORDER = ['skirt', 'bodice', 'cape'];

export default function dummy(ctx, room, h) {
  const { state, dialogue, audio, inventory } = ctx;
  const DM = h.dummy;
  const solved = () => state.isSolved('dummy');
  const on = () => state.get('wardrobe.dummy', []) || [];
  const sfx = (n, gain = 0.5) => audio?.play(n, { gain });
  let busy = false;

  const tryDress = async (kind) => {
    if (busy || solved()) return false; // keep it selected; nothing lost
    busy = true;
    inventory.deselect();
    try {
      if (kind !== ORDER[on().length]) {
        sfx('fabricRustle', 0.6);
        room.wrong('dummy');
        await DM.reject(kind);
        return;
      }
      inventory.remove(kind);
      state.set('wardrobe.dummy', [...on(), kind]);
      sfx('dummyDress', 0.7);
      await DM.dress(kind);
      if (kind === 'cape') await finish();
    } finally { busy = false; }
  };

  const finish = async () => {
    state.solve('dummy');
    const lav = ctx.characters?.lavinia;
    const dressed = h.perches.laviniaDressed;
    await room.wait(0.3);
    sfx('ghostShimmer', 0.7);
    if (lav?.moveTo) {
      // she drifts into the gown …
      await lav.moveTo([DM.object.position.x, 0, DM.object.position.z + 0.12], { duration: 1.1 });
      lav.react?.('fade');
      const flare = DM.flare();
      await room.wait(0.5);
      lav.setCostume?.('storm');
      await flare;
      // … and out again, wearing it
      lav.react?.('appear');
      await lav.moveTo(dressed.position, { duration: 0.9, rotationY: dressed.rotationY });
      lav.react?.('flourish');
    } else await DM.flare();
    await room.wait(0.2);
    await dialogue.choice('wardrobe.dummy.solved', {
      onPick: (i) => { lav?.react?.(i === 0 ? 'clap' : 'laugh'); },
    });
    await room.checkCostume();
  };

  const use = Object.fromEntries(ORDER.map((k) => [k, () => { tryDress(k); }]));
  room.spot('dummy', DM.object, "Dressmaker's dummy", DM.object, {
    onClick: () => {
      if (solved()) { dialogue.caption('wardrobe.dummy.done'); return; }
      ctx.papers.show('dummycard');
    },
    useItem: use,
  });

  return {
    restore() { busy = false; },
  };
}

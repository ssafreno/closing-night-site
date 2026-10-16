// hutch (KEY): the small brass key in Alf's coat pocket opens the doorkeeper's half-door (docs/rooms/door.md).
//   Coat (room) → its close-up; the glinting pocket (room or close-up) or the coat itself in close-up → key_hutch.
//   key_hutch on the half-door / its lock (room or close-up) → keyTurn, both leaves swing in, solve. The open hutch
//   close-up looks inside: tin, wireless, key press and Alf's note are clickable from there (their own files).
//   Locked half-door clicked: the plate caption (door.hutch.locked), then door.hutch.wrong.n in turn.
export default function hutch(ctx, room, h) {
  const { state, inventory, dialogue, audio } = ctx;
  const solved = () => state.isSolved('hutch');
  const keyInCoat = () => !inventory.has('key_hutch') && !solved();
  const VIEW = 'focus:hutch';
  const openView = () => room.focusOn(h.hutchDoor.focus, VIEW, 'hutch');

  // ---- the coat ------------------------------------------------------------------------------------------------
  const takeKey = () => {
    if (!keyInCoat()) return;
    h.coat.setGlint(false);
    h.coat.setKeyVisible(false);
    inventory.add('key_hutch', { from: h.coat.pocketKey }); // says item.key_hutch.pickup once
  };
  room.spot('coat', h.coat.hit, "Alf's overcoat", h.coat.object, {
    onClick: () => {
      if (keyInCoat()) room.focusOn(h.coat.focus, 'focus:coat', 'hutch');
      else dialogue.caption('door.coat.empty');
    },
  });
  // in the close-up the whole coat is generous: a click anywhere on it goes through the pockets
  room.spot('coat.body', h.coat.hit, "Alf's overcoat", h.coat.object, {
    scope: 'focus:coat',
    onClick: () => (keyInCoat() ? takeKey() : dialogue.caption('door.coat.empty')),
  });
  room.spot('coat.pocket', h.coat.pocket, 'Right-hand pocket', h.coat.pocketKey, {
    scope: ['room', 'focus:coat'], enabled: keyInCoat,
    onClick: takeKey,
  });

  // ---- the half-door ---------------------------------------------------------------------------------------------
  let busy = false;
  const unlock = async () => {
    if (solved() || busy) return;
    busy = true;
    inventory.remove('key_hutch');
    state.solve('hutch');
    openView();
    audio?.play('keyTurn', { gain: 0.8 });
    await room.wait(0.65);
    audio?.play('hutchDoor', { gain: 0.8 });
    h.hutchDoor.setOpen(1);
    await room.wait(0.9);
    busy = false;
    dialogue.say('door.hutch.solved');
  };
  let rattles = 0;
  const locked = () => {
    audio?.play('latch', { gain: 0.45 });
    // the plate first (it is the clue), then the wrong pool, the plate again every third rattle
    if (rattles++ % 3 === 0) dialogue.caption('door.hutch.locked');
    else dialogue.caption(dialogue.cycle('door.hutch.wrong'));
  };
  const useKey = { key_hutch: () => { unlock(); } };
  const notSolved = () => !solved() && !busy;
  room.spot('hutch', h.hutchDoor.hit, "Doorkeeper's hutch", h.hutchDoor.object, {
    enabled: () => !busy, onClick: openView, useItem: useKey,
  });
  room.spot('hutch.leaf', h.hutchDoor.hit, 'Half-door', h.hutchDoor.object, {
    scope: VIEW, enabled: notSolved, onClick: locked, useItem: useKey,
  });
  room.spot('hutch.lock', h.hutchDoor.lock, 'Lock', h.hutchDoor.object, {
    scope: ['room', VIEW], enabled: notSolved, useItem: useKey,
    onClick: () => (ctx.hotspots.scope === VIEW ? locked() : openView()),
  });
  room.spot('hutch.plate', h.hutchDoor.plateHit, 'Enamel plate', h.hutchDoor.plate, {
    scope: ['room', VIEW], enabled: notSolved, useItem: useKey,
    onClick: () => dialogue.caption('door.hutch.locked'),
  });

  return {
    restore() {
      const taken = !keyInCoat();
      h.coat.setGlint(!taken);
      h.coat.setKeyVisible(!taken);
      h.hutchDoor.setOpen(solved() ? 1 : 0, true);
    },
  };
}

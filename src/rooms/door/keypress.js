// keypress (COMBO): three brass number wheels on Alf's key press, 6-5-5 (the Half, Saturday evening), then TRY
// (docs/rooms/door.md). Clues: Alf's note above the press, the call board's calls, Pike's line in the sign-in book.
//   Before the lights (meter) the press, the note and the call board are too dark: door.keypress.dark / callboard.dark.
//   Key press (room or the open hutch close-up) → the wheels close-up. Upper half of a wheel +1, lower half −1
//   (comboWheel; tween-free steps, so rapid clicks never drop). TRY: 6-5-5 → cabinetOpen, the glass door swings, the
//   view steps back to the whole cabinet, solve. 1-5-5 → door.keypress.matinee. Else this.wrong('keypress'). Wheels
//   keep their numbers (saved as door.wheels).
//   Open: the PASS DOOR key (or its tag) → key_pass (flag door.keytaken). Other tags and the cellar key: captions.

const CODE = [6, 5, 5];
const MATINEE = [1, 5, 5];

export default function keypress(ctx, room, h) {
  const { state, inventory, dialogue, audio, papers, camera } = ctx;
  const solved = () => state.isSolved('keypress');
  const lit = room.lit;
  const K = h.keypress;
  const W = K.wheels.userData;
  const VIEW = 'focus:keypress';
  const keyTaken = () => !!state.get('door.keytaken') || inventory.has('key_pass') || !!state.get('door.unlocked') || state.isSolved('signin');

  const values = () => W.values.slice(0, 3);
  const same = (a, b) => a.every((v, i) => v === b[i]);

  // ---- the press -----------------------------------------------------------------------------------------------
  const openView = () => {
    if (!lit()) { dialogue.caption('door.keypress.dark'); return; }
    room.focusOn(solved() ? K.focus : K.focusWheels, VIEW, 'keypress');
  };
  room.spot('keypress', K.hit, 'Key press', K.object, {
    enabled: room.inHutch, scope: ['room', 'focus:hutch'], onClick: openView,
  });

  // wheels: upper half +1, lower half −1
  K.wheelHits.forEach((w, i) => {
    const wheel = W.wheels[i];
    const step = (d) => {
      W.step(i, d);
      audio?.play('comboWheel', { gain: 0.7 });
      state.set('door.wheels', values());
    };
    room.spot(`keypress.wheel${i + 1}.up`, w.up, `Wheel ${i + 1}: up`, wheel, { scope: VIEW, enabled: () => !solved(), onClick: () => step(1) });
    room.spot(`keypress.wheel${i + 1}.down`, w.down, `Wheel ${i + 1}: down`, wheel, { scope: VIEW, enabled: () => !solved(), onClick: () => step(-1) });
  });

  // TRY
  let opening = false;
  const tryCode = async () => {
    if (solved() || opening) return;
    K.pressTry();
    audio?.play('click', { gain: 0.6 });
    const v = values();
    if (same(v, CODE)) {
      opening = true;
      state.solve('keypress');
      await room.wait(0.25);
      audio?.play('cabinetOpen', { gain: 0.8 });
      if (camera.inFocus && ctx.hotspots.scope === VIEW) camera.refocus({ ...K.focus, duration: 0.7 });
      await room.wait(0.2);
      K.setOpen(1);
      await room.wait(0.8);
      opening = false;
      dialogue.say('door.keypress.solved');
      return;
    }
    if (same(v, MATINEE)) {
      audio?.play('error', { gain: 0.4 });
      state.inc('wrong.keypress');
      dialogue.say('door.keypress.matinee');
      return;
    }
    room.wrong('keypress');
  };
  room.spot('keypress.try', K.tryHit, 'TRY', K.tryButton, { scope: VIEW, enabled: () => !solved(), onClick: tryCode });

  // the hooks: the PASS DOOR key is the only one worth having
  const takeKey = () => {
    if (!solved() || keyTaken()) return;
    K.setKeyTaken(true);
    state.set('door.keytaken', true);
    inventory.add('key_pass', { from: K.passKey }); // item.key_pass.pickup, once
  };
  const passKeyThere = () => solved() && !keyTaken() && !opening;
  room.spot('keypress.passkey', K.passKey, 'Pass door key', K.passKey, { scope: VIEW, enabled: passKeyThere, onClick: takeKey });
  for (const hk of K.hooks) {
    const label = hk.id === 'passdoor' ? 'PASS DOOR' : 'A card tag';
    room.spot(`keypress.tag.${hk.id}`, hk.tag, label, hk.tag, {
      scope: VIEW, enabled: () => solved() && !opening,
      onClick: () => {
        if (hk.id === 'passdoor') { if (passKeyThere()) takeKey(); else dialogue.caption('door.keypress.tag.passdoor'); return; }
        dialogue.caption(`door.keypress.tag.${hk.id}`);
      },
    });
  }
  if (K.cellarKey) room.spot('keypress.cellarkey', K.cellarKey, 'A rusty key', K.cellarKey, { scope: VIEW, enabled: () => solved() && !opening, onClick: () => dialogue.caption('door.keypress.tag.cellar') });

  // ---- the clues -------------------------------------------------------------------------------------------------
  room.spot('alfnote', h.alfnote.hit, "Alf's note", h.alfnote.object, {
    enabled: room.inHutch, scope: ['room', 'focus:hutch', VIEW],
    onClick: () => (lit() ? papers.show('alfnote') : dialogue.caption('door.alfnote.dark')),
  });
  room.spot('callboard', h.callboard.object, 'Call board', null, {
    onClick: () => {
      if (!lit()) { dialogue.caption('door.callboard.dark'); return; }
      room.focusOn(h.callboard.focus, 'focus:callboard', 'keypress');
    },
  });
  room.spot('callboard.card', h.callboard.card, 'Calls', null, {
    scope: 'focus:callboard',
    onClick: () => (lit() ? papers.show('callboard') : dialogue.caption('door.callboard.dark')),
  });
  for (const [k, mesh] of Object.entries(h.callboard.slips)) {
    room.spot(`callboard.${k}`, mesh, 'A slip', null, { scope: 'focus:callboard', onClick: () => dialogue.caption(lit() ? `door.callboard.${k}` : 'door.callboard.dark') });
  }

  return {
    restore() {
      opening = false;
      const v = solved() ? CODE : (state.get('door.wheels') || [0, 0, 0]);
      v.forEach((n, i) => W.setValue(i, n, true));
      K.setOpen(solved() ? 1 : 0, true);
      K.setKeyTaken(keyTaken());
    },
  };
}

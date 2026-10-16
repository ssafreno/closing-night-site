// signin (RITUAL): Pike's rule. key_pass in the pass door's lock and the pen on the sign-in book, either order; when
// both are done the door opens by itself (docs/rooms/door.md).
//   Sign-in book (room) → its close-up; the book in close-up reads the `signinbook` paper (door.signinbook.read the
//   first time). `pen` on the book (room or close-up) → penScratch, the 2026 line appears (flag door.signed).
//   Pass door (room) → its close-up. key_pass on the lock / the door (room or close-up) → keyTurn, the key stays in the
//   lock (flag door.unlocked, key consumed). Locked lines: door.passdoor.locked before the key; door.signin.locked when
//   the key turns unsigned, then door.signin.wrong.n on later rattles. Signed first: door.signin.signedfirst.
//   Both: a latch lifts on the far side (unlock), passDoorSwing, the glow fades, door.signin.solved → door.done; the
//   pass door is now the exit to the stage (a short walk-in, then the fade).
export default function signin(ctx, room, h) {
  const { state, inventory, dialogue, audio, papers, camera } = ctx;
  const solved = () => state.isSolved('signin');
  const signed = () => !!state.get('door.signed') || solved();
  const unlocked = () => !!state.get('door.unlocked') || solved();
  const P = h.passDoor;
  const VIEW = 'focus:passdoor';
  const LEDGER = 'focus:ledger';

  // ---- the solve -------------------------------------------------------------------------------------------------
  let opening = false;
  const open = async () => {
    if (solved() || opening) return;
    opening = true;
    state.solve('signin');
    // turn to watch the door: out of any close-up, eyes on the pass door
    if (camera.inFocus) await camera.exitFocus({ all: true, duration: 0.8 });
    camera.lookAtPoint(P.door.getWorldPosition(P.door.position.clone()).setY(1.2));
    await room.wait(0.5);
    audio?.play('unlock', { gain: 0.7 });
    await room.wait(0.7);
    audio?.play('passDoorSwing', { gain: 0.9 });
    P.setOpen(1);
    h.glow.setLevel(0);
    await room.wait(1.2);
    opening = false;
    await dialogue.say('door.signin.solved');
    await dialogue.say('door.done');
  };

  // ---- the sign-in book ------------------------------------------------------------------------------------------
  const sign = () => {
    if (signed()) { dialogue.caption('door.ledger.signed'); return; }
    if (ctx.hotspots.scope !== LEDGER) room.focusOn(h.ledger.focus, LEDGER, 'signin');
    audio?.play('penScratch', { gain: 0.8 });
    state.set('door.signed', true);
    room.later(0.5, () => h.ledger.setSigned(true));
    if (unlocked()) room.later(0.9, open);
    else room.later(0.9, () => dialogue.say('door.signin.signedfirst'));
  };
  const usePen = { pen: () => { sign(); } };
  const read = async () => {
    await papers.show('signinbook', { page: signed() ? 1 : 0 });
    if (!state.get('door.signinbook.read')) { state.set('door.signinbook.read', true); dialogue.say('door.signinbook.read'); }
  };
  room.spot('ledger', h.ledger.hit, 'Sign-in book', h.ledger.object, {
    onClick: () => room.focusOn(h.ledger.focus, LEDGER, 'signin'),
    useItem: usePen,
  });
  room.spot('ledger.book', h.ledger.hit, 'Sign-in book', h.ledger.object, { scope: LEDGER, onClick: read, useItem: usePen });

  // ---- the pass door ---------------------------------------------------------------------------------------------
  const insertKey = () => {
    if (unlocked()) return;
    if (ctx.hotspots.scope !== VIEW) room.focusOn(P.focus, VIEW, 'signin');
    inventory.remove('key_pass');
    state.set('door.unlocked', true);
    audio?.play('keyTurn', { gain: 0.8 });
    P.setKey(true);
    if (signed()) room.later(0.6, open);
    else room.later(0.6, () => dialogue.say('door.signin.locked'));
  };
  const useKey = { key_pass: () => { insertKey(); } };
  const lockedLine = () => {
    if (!unlocked()) { dialogue.caption('door.passdoor.locked'); return; }
    // keyed but not signed: the latch holds; Pike's rule again in turn
    audio?.play('latch', { gain: 0.45 });
    room.wrong('signin', { fallback: 'door.signin.wrong.1' });
  };
  const notOpen = () => !solved();

  const door = room.addDoor({
    id: 'door.passdoor', object: h.doors.pass.object, to: 'stage',
    label: (isOpen) => (isOpen ? 'Through the pass door' : 'Pass door'),
    highlight: room.keep(h.doors.pass.leaf),
    isOpen: () => solved() && !opening,
    onLocked: () => {
      if (opening) return;
      if (ctx.hotspots.scope !== VIEW) room.focusOn(P.focus, VIEW, 'signin');
      lockedLine();
    },
    // a step into the dark doorway, then the fade
    onOpen: () => camera.focus({ position: [0.15, 1.6, -2.35], lookAt: [0.15, 1.35, -4.6], duration: 0.7, scope: 'focus:walk' }),
  });
  door.useItem = useKey;
  room.spot('passdoor.leaf', P.hit, 'Pass door', h.doors.pass.leaf, { scope: VIEW, enabled: notOpen, onClick: lockedLine, useItem: useKey });
  room.spot('passdoor.lock', P.lock, 'Lock', P.object, {
    scope: ['room', VIEW], enabled: notOpen, useItem: useKey,
    onClick: () => {
      if (ctx.hotspots.scope !== VIEW) { room.focusOn(P.focus, VIEW, 'signin'); if (!unlocked()) dialogue.caption('door.passdoor.locked', { scope: VIEW }); return; }
      lockedLine();
    },
  });
  room.spot('passdoor.plate', P.rulePlateHit, 'Brass plates', P.rulePlate, {
    scope: ['room', VIEW], enabled: notOpen, useItem: useKey,
    onClick: () => dialogue.caption('door.passdoor.locked'),
  });

  return {
    restore() {
      opening = false;
      P.setKey(unlocked());
      h.ledger.setSigned(signed());
      P.setOpen(solved() ? 1 : 0, true);
      h.glow.setLevel(solved() ? 0 : 1, true);
    },
  };
}

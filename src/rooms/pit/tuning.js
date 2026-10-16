// tuning (PITCH): Pozzi's A (docs/rooms/pit.md).
//   Pianola (room) → room._openTuning(): the lid lifts, the fork and hammer come out into the bay, Lavinia drifts off
//   the lid, the close-up focus:pit.tuning opens and the three paper riders shiver (always, while it is open: the rate
//   is the string's beat against A435, about 1.3 Hz at 5 cents and a blur at 40). The first time: pit.tuning.riders.
//   Pins (click, or press-and-drag): the hammer moves onto that pin. Hammer (or a pin): drag up or down; every 30 px of
//   vertical travel is one 5-cent detent (pinTurn): up = sharper (+5), down = flatter (−5). Each detent is saved
//   (pit.cents). Fork: hums A435 for 6 s (tuningFork). String or rider: plucks it against the fork (pianoString {cents}).
//   Past ±60 cents: a twang, that pin slips back to its starting detune, room.wrong('tuning') (pit.tuning.wrong.n).
//   All three at 0 (every rider still): the strings ring a clean unison with the fork, success, pit.tuning.solved,
//   solve('tuning'). Starting detunes +40, −25, +15.
export const START_CENTS = [40, -25, 15];
const STEP = 5, PX = 30, LIMIT = 60, TURN = 0.05; // cents per detent, px per detent, twang past this, hammer rad per detent
// the hammer's arm rests angled down and away from the pin row (toward the bridge, between the strings) so it never
// covers the other two pins, at 0.65 scale so its grip stays in the close-up
const BASE = -Math.PI / 4, SCALE = 0.65;

export default function tuning(ctx, room, h) {
  const { state, dialogue, audio, camera, hotspots } = ctx;
  const P = h.pianola;
  P.hammer.scale.setScalar(SCALE);
  const VIEW = 'focus:pit.tuning';
  const solved = () => state.isSolved('tuning');
  const sfx = (n, o = {}) => audio?.play(n, { gain: 0.6, ...o });
  const cents = () => (solved() ? [0, 0, 0] : (state.get('pit.cents') || START_CENTS).slice());
  let drag = null;   // { pin, applied (detents already applied this drag), dead (twanged) }
  let finishing = false;

  /** The hammer sits on pin i, turned by how far that pin has been moved from where it started. */
  const seatHammer = (i) => {
    P.setHammerPin(i);
    const c = cents()[i];
    P.setHammerTurn(BASE - TURN * (c - START_CENTS[i]) / STEP);
  };

  const open = () => {
    if (camera.inFocus && hotspots.scope === VIEW) return;
    P.setCents(cents());
    room._openTuning();
    P.setShiver(true);
    seatHammer(P.hammerPin);
    if (!solved() && !state.get('pit.tuning.riders.said')) {
      state.set('pit.tuning.riders.said', true);
      room.later(1.1, () => dialogue.say('pit.tuning.riders'));
    }
  };
  room._onTuningExit = () => { P.setShiver(false); drag = null; };

  // ---- one detent on pin i -----------------------------------------------------------------------------------------
  const detent = (i, dir) => {
    const c = cents();
    c[i] += dir * STEP;
    if (Math.abs(c[i]) > LIMIT) { twang(i); return false; }
    state.set('pit.cents', c);
    P.setCents(c);
    seatHammer(i);
    sfx('pinTurn', { gain: 0.5 });
    if (c.every((v) => v === 0)) complete();
    return true;
  };

  const twang = (i) => {
    const c = cents();
    c[i] = START_CENTS[i];
    state.set('pit.cents', c);
    P.setCents(c);
    seatHammer(i);
    P.pluck(i);
    sfx('pianoString', { cents: 90, gain: 0.8 });
    sfx('gearSlip', { gain: 0.35 });
    camera.shake?.(0.004, 0.2);
    room.wrong('tuning');
  };

  // ---- drag (on the hammer, or on a pin: the hammer jumps to it first) ------------------------------------------------
  const dragStart = (pin) => (info) => {
    if (solved() || finishing || ctx.inventory?.selected) return; // an item in hand: that press is an item use
    if (pin != null && pin !== P.hammerPin) { seatHammer(pin); sfx('click', { gain: 0.25 }); }
    drag = { pin: P.hammerPin, applied: 0, dead: false };
  };
  const dragMove = (info) => {
    if (!drag || drag.dead || solved() || finishing) return;
    const want = Math.trunc(-(info.totalDy || 0) / PX); // up = sharper
    while (drag.applied !== want && !drag.dead) {
      const dir = want > drag.applied ? 1 : -1;
      drag.applied += dir;
      if (!detent(drag.pin, dir)) drag.dead = true;
      if (solved() || finishing) break;
    }
  };
  const dragEnd = (info) => { if (info) dragMove(info); drag = null; };

  // ---- hotspots ----------------------------------------------------------------------------------------------------
  room.spot('tuning', P.group, 'Pianola', null, { onClick: open });
  room.spot('tuning.hammer', P.hammerProxy, 'Tuning hammer (drag up or down)', P.hammer, {
    scope: VIEW,
    onClick: () => {},
    onDragStart: dragStart(null), onDrag: dragMove, onDragEnd: dragEnd,
  });
  P.pinProxies.forEach((pp, i) => room.spot(`tuning.pin.${i}`, pp, `Tuning pin ${i + 1}`, P.pins[i], {
    scope: VIEW,
    onClick: () => { if (P.hammerPin !== i) { seatHammer(i); sfx('click', { gain: 0.25 }); } },
    onDragStart: dragStart(i), onDrag: dragMove, onDragEnd: dragEnd,
  }));
  const pluck = (i) => () => { P.pluck(i); sfx('pianoString', { cents: cents()[i], gain: 0.7 }); };
  P.stringProxies.forEach((sp, i) => room.spot(`tuning.string.${i}`, sp, `String ${i + 1}`, P.strings[i], { scope: VIEW, onClick: pluck(i) }));
  P.riderProxies.forEach((rp, i) => room.spot(`tuning.rider.${i}`, rp, 'Paper rider', P.riders[i], { scope: VIEW, onClick: pluck(i) }));
  room.spot('tuning.fork', P.forkProxy, 'Tuning fork', P.fork, { scope: VIEW, onClick: () => { P.ringFork(6); sfx('tuningFork', { gain: 0.7 }); } });

  // ---- success -----------------------------------------------------------------------------------------------------
  const complete = async () => {
    if (finishing || solved()) return;
    finishing = true;
    drag = null;
    state.set('pit.cents', [0, 0, 0]);
    state.solve('tuning');
    try {
      P.ringFork(6); sfx('tuningFork', { gain: 0.6 });
      for (let i = 0; i < 3; i++) { await room.wait(0.18); P.pluck(i); sfx('pianoString', { cents: 0, gain: 0.55 }); }
      await room.wait(0.5);
      sfx('success', { gain: 0.5 });
      ctx.characters?.lavinia?.react?.('clap');
      await dialogue.say('pit.tuning.solved');
    } finally { finishing = false; }
  };

  return {
    restore() {
      drag = null; finishing = false;
      P.setCents(cents());
      P.setShiver(false);
      P.setHammerPin(0); P.setHammerTurn(BASE);
    },
  };
}

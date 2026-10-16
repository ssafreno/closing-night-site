// houseboard (SWITCH): Crane's cross-wired house-lights board (docs/rooms/foyer.md).
//   House board (room or the booth overview; dark → foyer.boxoffice.dark) → its close-up. Five rotary switches STALLS ·
//   PIT · BOXES · CIRCLE · GALLERY: a click toggles that switch and its immediate neighbours (houseSwitch), the jewels
//   follow (flag foyer.switches). The trip lever throws all five off with a clunk. Sparks's card opens `wiringcard`.
//   All five on (from all off: STALLS + CIRCLE, or PIT + GALLERY) → houseLightsUp, the house glows (through the open
//   auditorium doors, or under them), the camera turns to the doors, foyer.houseboard.solved. Solve.
//   No fail state: every 6 presses without solving says foyer.houseboard.wrong.n (counted in foyer.hb.presses).

export default function houseboard(ctx, room, h) {
  const { state, dialogue, audio, camera, papers, hotspots } = ctx;
  const solved = () => state.isSolved('houseboard');
  const VIEW = 'focus:houseboard';
  const B = h.houseboard;
  const NAMES = ['Stalls', 'Pit', 'Boxes', 'Circle', 'Gallery'];
  let finishing = false;

  room.spot('houseboard', B.object, 'House board', B.object, { // the whole board: switches and lever stand proud of its hit box
    scope: ['room', 'focus:booth'],
    onClick: room.inBooth(() => room.focusOn(B.focus, VIEW, 'houseboard')),
  });

  const save = () => state.set('foyer.switches', B.states.slice());
  const press = (i) => {
    if (solved() || finishing) return;
    for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < 5) B.setSwitch(j, !B.states[j]);
    audio?.play('houseSwitch', { gain: 0.7 });
    save();
    if (B.states.every(Boolean)) { complete(); return; }
    const n = state.inc('foyer.hb.presses');
    if (n % 6 === 0) {
      state.inc('wrong.houseboard');
      dialogue.auto(dialogue.cycle('foyer.houseboard.wrong'));
    }
  };
  B.switches.forEach((sw, i) => room.spot(`houseboard.switch${i}`, sw, `${NAMES[i]} switch`, sw, {
    scope: VIEW, enabled: () => !solved() && !finishing,
    onClick: () => press(i),
  }));
  let tripping = false;
  // the lever is a thin stick: a proxy over it and its slot (on the board, so it does not swing with the lever)
  const tripHit = hotspots.proxyBox(0.08, 0.35, 0.06);
  tripHit.position.set(B.trip.position.x, B.trip.position.y + 0.025, B.trip.position.z);
  B.trip.parent.add(tripHit);
  room.spot('houseboard.trip', tripHit, 'Trip lever', B.trip, {
    scope: VIEW, enabled: () => !solved() && !finishing,
    onClick: () => {
      if (tripping) { B.setAll([0, 0, 0, 0, 0]); save(); return; }
      tripping = true;
      B.setTrip(1);
      audio?.play('knifeSwitch', { gain: 0.6 });
      audio?.play('latch', { gain: 0.5, pitch: 0.6 });
      B.setAll([0, 0, 0, 0, 0]);
      save();
      room.later(0.45, () => { B.setTrip(0); tripping = false; });
    },
  });
  room.spot('wiringcard', h.wiringcard.object, "Sparks's card", h.wiringcard.object, {
    scope: [VIEW],
    onClick: () => papers.show('wiringcard'),
  });

  const complete = async () => {
    if (finishing || solved()) return;
    finishing = true;
    try {
      state.solve('houseboard');
      state.set('foyer.hb.presses', 0);
      await room.wait(0.45);
      audio?.play('houseLightsUp', { gain: 0.9 });
      h.house.set(1);
      await room.wait(0.8);
      // turn to the auditorium doors: the house lit through them (or under them, if they are still chained)
      await camera.exitFocus({ all: true, duration: 0.6 });
      await camera.focus({ ...h.auditorium.focus, scope: 'focus:auddoors' });
      ctx.characters?.lavinia?.react?.('clap');
      await dialogue.say('foyer.houseboard.solved');
      room.checkHouse();
    } finally { finishing = false; }
  };

  return {
    restore() {
      finishing = false; tripping = false;
      const sw = solved() ? [1, 1, 1, 1, 1] : (state.get('foyer.switches') || [0, 0, 0, 0, 0]);
      B.setAll(sw, true); B.setTrip(0, true);
      h.house.set(solved() ? 1 : 0, true);
    },
  };
}

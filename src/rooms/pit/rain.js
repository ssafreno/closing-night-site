// rain (GEAR): the idler (docs/rooms/pit.md).
//   Rain drum (trap-room view): with the stub axle empty → pit.rain.stuck and its close-up (focus:pit.rain): the gear
//   train under the guard stencilled IDLER 24T, the empty stub axle and the spare-gear shelf (16T, 24T, 32T).
//   A gear (click; from the trap view it also opens the close-up): it lifts into the hand (one at a time; clicking the
//   held one puts it back). The stub axle (click) with a gear in hand: it slides on.
//     16T: spins free, touching neither neighbour (gearSlip), drops back to the shelf; room.wrong('rain').
//     32T: fouls both neighbours, clunks off (gearSlip, low) back to the shelf; room.wrong('rain').
//     24T: meshes (gearMesh), pit.idler = 24. With `wind` latched → completeRain(); before that it seats and nothing
//          turns: Pike's pit.rain.nowind, and completeRain() runs the moment the governor latches (wind.js).
//   The stub with nothing in hand: pit.rain.stuck.
//   completeRain(): the gale drives the drum, the peas cascade (rainBox loop), pit.rain.solved, solve('rain'), then
//   room.checkStorm().
export default function rain(ctx, room, h) {
  const { state, dialogue, audio, camera, hotspots } = ctx;
  const RN = h.rain;
  const TRAP = 'focus:pit.trap', VIEW = 'focus:pit.rain';
  const solved = () => state.isSolved('rain');
  const sfx = (n, o = {}) => audio?.play(n, { gain: 0.6, ...o });
  let held = null, busy = false;

  const open = () => (camera.inFocus && hotspots.scope === VIEW ? Promise.resolve() : camera.focus({ ...RN.focus, scope: VIEW, puzzle: 'rain', onExit: () => putBack() }));
  const putBack = () => { if (held) { RN.lift(held, false); held = null; } };

  room.spot('rain', RN.group, 'Rain drum', null, {
    scope: [TRAP, VIEW],
    onClick: () => {
      if (hotspots.scope !== VIEW) open();
      if (!RN.fitted && !solved()) dialogue.caption('pit.rain.stuck');
    },
  });

  for (const T of [16, 24, 32]) {
    room.spot(`rain.gear.${T}`, RN.gearProxies[T], `${T}-tooth gear`, RN.gears[T], {
      scope: [TRAP, VIEW],
      enabled: () => RN.fitted !== T,
      onClick: async () => {
        if (busy || solved()) return;
        if (hotspots.scope !== VIEW) await open();
        if (held === T) { putBack(); sfx('click', { gain: 0.25 }); return; }
        putBack();
        held = T;
        RN.lift(T, true);
        sfx('pickup', { gain: 0.3 });
      },
    });
  }

  room.spot('rain.stub', RN.stubProxy, () => (held ? `Empty axle (fit the ${held}-tooth gear)` : 'Empty axle'), null, {
    scope: VIEW,
    enabled: () => !RN.fitted,
    onClick: () => fit(),
  });

  const fit = async () => {
    if (busy || solved() || RN.fitted) return;
    if (!held) { dialogue.caption('pit.rain.stuck'); return; }
    const T = held;
    held = null;
    busy = true;
    try {
      RN.fit(T);
      if (T === 24) {
        sfx('gearMesh', { gain: 0.8 });
        state.set('pit.idler', 24);
        await room.wait(0.5);
        if (state.isSolved('wind')) await completeRain();
        else { ctx.characters?.pike?.react?.('nod'); await dialogue.say('pit.rain.nowind'); }
        return;
      }
      // the wrong size: 16T spins free, 32T fouls both neighbours; back to the shelf
      sfx('gearSlip', { gain: 0.7, pitch: T === 32 ? 0.7 : 1.15 });
      if (T === 32) camera.shake?.(0.004, 0.2);
      await room.wait(T === 16 ? 0.9 : 0.6);
      RN.home(T);
      room.wrong('rain');
    } finally { busy = false; }
  };

  /** The gale drives the rain drum: it turns, the peas cascade. */
  const completeRain = async () => {
    if (solved()) return;
    state.solve('rain');
    if (RN.fitted !== 24) RN.fit(24);
    h.storm.setWind(state.isSolved('wind') ? 0.531 : 0);
    RN.setRaining(true);
    room.loop('rainBox', { gain: 0.45, fade: 1.5 });
    room.later(5, () => room.loop('rainBox', { gain: 0.22, fade: 3 }));
    await room.wait(0.8);
    audio?.play('success', { gain: 0.4 });
    ctx.characters?.lavinia?.react?.('clap');
    await dialogue.say('pit.rain.solved');
    await room.checkStorm();
  };
  room.completeRain = completeRain;

  return {
    restore() { putBack(); held = null; busy = false; },
  };
}

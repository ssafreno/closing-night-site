// pianoroll (PATTERN): the one that goes upstairs (docs/rooms/pit.md).
//   Roll rack (room) → its close-up (focus:pit.rack). A roll box → it slides out and its roll goes up on the lectern;
//   the camera moves in (focus:pit.roll) and the leader unrolls over the guide card (rollUnspool): the maker's letter
//   strip C D E F G A B C′ with the roll's first three or four holes punched under it. Back: the roll goes back into the
//   rack. The roll on the lectern (click): you carry it to the pianola; the camera moves to the pianola (focus:pit.pianola,
//   Lavinia drifts off the lid) and it drops into the open spool box (rollLoad; pit.roll). A roll already in the spool
//   box goes back to the rack first. The spool box (in the pianola view, with no roll in hand): takes the loaded roll out
//   again. The PLAY lever (room or pianola view) throws, the roll turns and the keys play it (audio.pianola + follow):
//     - before `tuning`: any roll plays sour for 3 s and ejects to the rack (pit.pianoroll.sour);
//     - 104 (tuned): 3 s, eject, pit.pianoroll.bishop (counts as a wrong attempt);
//     - 101 102 105 106 (tuned): 3 s, eject, room.wrong('pianoroll') (pit.pianoroll.wrong.n);
//     - 103 (tuned): the 12 s Empress March with the keys moving; the dust jumps off the keyboard; Lavinia flourishes
//       and sings along (pit.pianoroll.solved); solve; then room.checkMusic() (pit.done.music, MUSIC). The roll stays.
//   With no roll loaded the lever clunks and springs back.

export default function pianoroll(ctx, room, h) {
  const { state, dialogue, audio, camera, hotspots } = ctx;
  const P = h.pianola, R = h.rolls;
  const RACK = 'focus:pit.rack', ROLL = 'focus:pit.roll', PIANO = 'focus:pit.pianola';
  const solved = () => state.isSolved('pianoroll');
  const sfx = (n, o = {}) => audio?.play(n, { gain: 0.6, ...o });
  let onLectern = null;  // the roll up on the lectern (its box is out of the rack)
  let carrying = false;  // moving it to the pianola (the lectern's onExit must not put it back)
  let playing = null;    // the MusicHandle while the pianola runs
  let busy = false;

  const loaded = () => P.rollLoaded;
  const toRack = (num) => { if (num) R.setInRack(num, true); };

  // ---- the rack and the lectern ---------------------------------------------------------------------------------------
  const openRack = () => (camera.inFocus && hotspots.scope === RACK ? Promise.resolve() : camera.focus({ ...R.focusRack, scope: RACK, puzzle: 'pianoroll' }));
  room.spot('pianoroll', R.group, 'Roll rack', null, { onClick: openRack });

  const view = async (num) => {
    if (busy || playing) return;
    if (onLectern === num) return;
    if (onLectern) toRack(onLectern);
    onLectern = num;
    R.slide(num, 1);
    room.later(0.35, () => { R.setInRack(num, false); R.slide(num, 0); });
    R.show(num); R.setUnroll(0);
    sfx('rollUnspool', { gain: 0.55 });
    ctx.tween.run(1.1, (k) => R.setUnroll(k), { ease: 'outCubic' });
    if (!(camera.inFocus && hotspots.scope === ROLL)) {
      await camera.focus({
        ...R.focus, scope: ROLL, puzzle: 'pianoroll',
        onExit: () => {
          if (carrying) return;
          // Back: the roll goes back into the rack
          if (onLectern) { toRack(onLectern); sfx('rollUnspool', { gain: 0.25 }); }
          onLectern = null; R.show(null); R.setUnroll(0);
        },
      });
    }
  };
  for (const num of R.NUMBERS) {
    room.spot(`roll.${num}`, R.boxes[num], `Roll ${num}`, null, {
      scope: [RACK, ROLL],
      enabled: () => R.boxes[num].visible,
      onClick: () => view(num),
    });
  }

  // the roll on the lectern: carry it to the pianola's spool box
  room.spot('roll.held', R.leader, () => (onLectern ? `Roll ${onLectern}: load it in the pianola` : ''), R.leader, {
    scope: ROLL,
    enabled: () => !!onLectern,
    onClick: () => carry(),
  });
  // (the cradle roll too, it is the obvious thing to pick up)
  const heldRoll = R.group.userData.heldRoll;
  if (heldRoll) room.spot('roll.cradle', heldRoll, () => (onLectern ? `Roll ${onLectern}: load it in the pianola` : ''), heldRoll, { scope: ROLL, enabled: () => !!onLectern, onClick: () => carry() });

  const openPiano = () => {
    if (camera.inFocus && hotspots.scope === PIANO) return Promise.resolve();
    room._liftLavinia(true);
    return camera.focus({ ...P.focus, scope: PIANO, puzzle: 'pianoroll', onExit: () => room._liftLavinia(false) });
  };

  const carry = async () => {
    if (!onLectern || busy) return;
    busy = true;
    const num = onLectern;
    try {
      carrying = true;
      await camera.exitFocus({ all: true, duration: 0.35 });
      carrying = false;
      onLectern = null; R.show(null); R.setUnroll(0);
      await openPiano();
      load(num);
    } finally { carrying = false; busy = false; }
  };

  const load = (num) => {
    const old = loaded();
    if (old && old !== num) toRack(old);
    P.setRollLoaded(num);
    R.setInRack(num, false);
    state.set('pit.roll', num);
    sfx('rollLoad', { gain: 0.7 });
  };
  const unload = () => {
    const num = loaded();
    if (!num) return;
    P.setRollLoaded(null);
    toRack(num);
    state.set('pit.roll', null);
    sfx('rollUnspool', { gain: 0.35 });
  };

  // the spool box: in the pianola view, takes a loaded (unplayed) roll back out; from the room it opens the view
  room.spot('pianola.spool', P.spoolProxy, () => (loaded() && !solved() ? `Spool box (roll ${loaded()})` : 'Spool box'), P.spoolBox || null, {
    scope: ['room', PIANO],
    onClick: () => {
      if (hotspots.scope !== PIANO) return openPiano();
      if (playing || busy || solved()) return;
      if (loaded()) unload(); else dialogue.caption('pit.pianoroll.empty');
    },
  });

  // ---- PLAY ------------------------------------------------------------------------------------------------------------
  const lever = (to, dur = 0.25) => { const from = P.play; return ctx.tween.run(dur, (k) => P.setPlay(from + (to - from) * k), { ease: 'outCubic' }); };
  room.spot('pianola.play', P.playProxy, 'PLAY lever', P.playLever, {
    scope: ['room', PIANO],
    onClick: async () => {
      if (hotspots.scope !== PIANO) { await openPiano(); }
      play();
    },
  });

  const play = async () => {
    if (busy || playing) return;
    const num = loaded();
    busy = true;
    try {
      await lever(1);
      sfx('click', { gain: 0.5 });
      if (!num) { await room.wait(0.15); await lever(0, 0.35); return; }
      if (solved()) { await performance(num, true); return; }
      const tuned = state.isSolved('tuning');
      const right = num === 103 && tuned;
      if (right) { await success(); return; }
      // a wrong roll (or any roll before tuning): 3 s, then it stops and ejects to the rack
      await performance(num, false, { sour: !tuned });
      unload();
      // POLISH: say that the roll was kicked out (it went back to the rack with no word). When room.wrong is silent
      // (attempts 2, 4, 5...) it is the only reply; before a spoken line it reads first (a line clears a caption), and
      // wrong.2 already says it.
      const n = (state.get('wrong.pianoroll') || 0) + 1;
      const spoken = !tuned || num === 104 || n === 1 || n % 3 === 0;
      const ejectLine = spoken && tuned && num !== 104 && dialogue.cycle('pit.pianoroll.wrong', { advance: false }) === 'pit.pianoroll.wrong.2';
      if (!ejectLine && dialogue.has('pit.pianoroll.eject')) {
        dialogue.caption('pit.pianoroll.eject');
        if (spoken) await room.wait(2.2);
      }
      if (!tuned) { audio?.play('error', { gain: 0.3 }); dialogue.say('pit.pianoroll.sour'); }
      else if (num === 104) { audio?.play('error', { gain: 0.3 }); state.inc('wrong.pianoroll'); dialogue.say('pit.pianoroll.bishop'); }
      else room.wrong('pianoroll');
    } finally { busy = false; if (!playing) lever(0, 0.4); }
  };

  /** The roll turns and the keys play it. full: the whole tune; else the 3 s wrong-roll cut. Resolves at the end. */
  const performance = async (num, full, { sour = false } = {}) => {
    const tune = R.ROLLS[num]?.tune || 'empressMarch';
    const handle = audio?.pianola ? audio.pianola(tune, { sour, gain: 0.85, ...(full ? {} : { duration: 3 }) }) : null;
    if (!handle) { await room.wait(full ? 12 : 3); return; }
    playing = handle;
    P.follow(handle);
    try { await handle.promise; } finally { P.stopFollow(); playing = null; lever(0, 0.4); }
  };

  const success = async () => {
    const lav = ctx.characters?.lavinia;
    room.later(0.5, () => P.dustPuff());
    state.solve('pianoroll');
    let sang = false;
    const sing = () => { if (sang) return; sang = true; lav?.react?.('flourish'); dialogue.say('pit.pianoroll.solved'); };
    const cancelSing = room.later(2.0, sing);
    await performance(103, true);
    if (!sang) { cancelSing(); sing(); } // a slow frame clock: her line still comes before MUSIC
    sfx('success', { gain: 0.45 });
    await room.wait(0.4);
    if (dialogue.isOpen) await waitDialogue();
    await room.checkMusic();
  };

  const waitDialogue = async () => { for (let i = 0; i < 300 && dialogue.isOpen; i++) await room.wait(0.1); };

  return {
    restore() {
      if (playing) { try { playing.stop(0.1); } catch (e) { /* */ } }
      P.stopFollow();
      playing = null; busy = false; carrying = false; onLectern = null;
      P.setPlay(0);
    },
    get playing() { return !!playing; },
  };
}

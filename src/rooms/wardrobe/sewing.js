// sewing (RHYTHM): oil the machine, start the metronome, treadle on the ONE four times (docs/rooms/wardrobe.md).
//   Machine (room) → its close-up (focus:sewing): treadle, needle over the hem's four chalk quarters, metronome with
//   its red spring flag, the oil can. Oil can (shelf, glints) → inventory (wardrobe.oilcan.taken); used on the machine
//   (room or close-up, or on the treadle) → oilSquirt, wardrobe.oiled; the can is kept (the pit needs it).
//   Treadle: not oiled → machineSqueal, the machine judders, wardrobe.sewing.seized. The first treadle after oiling:
//   wardrobe.sewing.waltz (never a penalty; a press in the window still stitches). Metronome stopped →
//   wardrobe.sewing.nobeat. Metronome (click to start / stop): 60 bpm in 3/4 from its own performance.now() clock; the
//   bell rings and the flag pops on each ONE. A press from 0.1 s before a ONE to 0.5 s after it (timed at the press, by
//   the metronome's clock, never by frames) stitches one quarter (treadle); only one stitch per ONE (more presses in
//   the same window are ignored). A press outside the window: threadSnap, the last quarter unpicks (never below 0),
//   the wrong cadence (wardrobe.sewing.wrong.n). Four quarters: the foot lifts, the skirt comes free → skirt,
//   wardrobe.sewing.solved, solve. Stitches are not saved (a reload restores 0; leaving and re-entering the close-up in the same
//   session keeps them). FIXED BY qa-wardrobe: the comment said re-entry starts at 0, which the code does not do.
import * as THREE from 'three';

export default function sewing(ctx, room, h) {
  const { state, dialogue, audio, inventory, camera, hotspots } = ctx;
  const VIEW = 'focus:sewing';
  const S = h.sewing, MT = h.metronome, OC = h.oilcan;
  const solved = () => state.isSolved('sewing');
  const oiled = () => !!state.get('wardrobe.oiled');
  const sfx = (n, gain = 0.5, extra = {}) => audio?.play(n, { gain, ...extra });
  const BEFORE = 0.1, AFTER = 0.5, BPB = 3;
  let usedBar = null;   // the bar whose ONE has already taken a stitch
  let finishing = false;

  // the metronome's tick (and the bell on the ONE), from its own clock
  MT.onBeat((i, isOne) => { if (MT.running()) audio?.play('metronome', { accent: isOne, gain: isOne ? 0.7 : 0.45 }); });

  const openMachine = () => room.focusOn(S.focus, VIEW, 'sewing', { onExit: () => { MT.stop(); } });

  // ---- oil -----------------------------------------------------------------------------------------------------------------
  const oil = () => {
    sfx('oilSquirt', 0.6);
    S.oilSquirt();
    if (oiled()) return;
    S.setOiled(true);
    state.set('wardrobe.oiled', true);
  };
  const oilUse = { oilcan: () => { oil(); } };

  room.spot('machine', S.hit, 'Sewing machine', S.machine, { onClick: openMachine, useItem: oilUse });
  // in the close-up the machine itself (head, bed, the skirt) takes the oil; the treadle has its own target below
  room.spot('machine.close', S.machine, 'Sewing machine', S.machine, {
    scope: VIEW,
    onClick: () => {
      if (!oiled()) { sfx('machineSqueal', 0.5); S.seize(); dialogue.caption('wardrobe.sewing.seized', { scope: VIEW }); return; }
      S.runNeedle(0.25);
    },
    useItem: oilUse,
  });

  room.spot('oilcan', OC.hit, 'Oil can', OC.object, {
    scope: ['room', VIEW], enabled: () => OC.object.visible,
    onClick: () => {
      const from = OC.worldPos();
      OC.setPresent(false);
      state.set('wardrobe.oilcan.taken', true);
      inventory.add('oilcan', { from });
    },
  });

  // ---- the metronome ---------------------------------------------------------------------------------------------------
  room.spot('metronome', MT.hit, () => (MT.running() ? 'Metronome (stop)' : 'Metronome'), MT.object, {
    scope: ['room', VIEW],
    onClick: () => {
      if (MT.running()) { MT.stop(); sfx('click', 0.3); return; }
      usedBar = null;
      MT.run(performance.now() + 150, { bpm: 60, beatsPerBar: BPB });
    },
  });

  /** The bar whose ONE the time `ms` is in the window of (0.1 s before … 0.5 s after), else null. */
  const windowBar = (ms) => {
    if (!MT.running() || !MT.inWindow(ms, BEFORE, AFTER)) return null;
    const b = MT.beatAt(ms);
    const bar = Math.floor(b.beat / BPB);
    return b.sinceOne <= AFTER ? bar : bar + 1; // just before a ONE belongs to the coming bar
  };

  // ---- the treadle -----------------------------------------------------------------------------------------------------
  const press = (info) => {
    // timed at the press (pointerdown), not the release, and never from frame callbacks
    // FIXED BY qa-wardrobe: the press's event timestamp (atEvent, same clock as performance.now()), not `at`, which is
    // performance.now() when the handler ran: under load handlers run late and an on-flag press was judged off the beat
    const ms = hotspots._lastPress?.atEvent ?? hotspots._lastPress?.at ?? info?.event?.timeStamp ?? performance.now();
    if (solved() || finishing) { sfx('treadle', 0.3); S.treadlePress(); return; }
    if (!oiled()) { sfx('machineSqueal', 0.6); S.seize(); dialogue.auto('wardrobe.sewing.seized'); return; }
    const bar = windowBar(ms);
    if (!state.get('wardrobe.sewing.waltzsaid')) {
      // the first free run of the oiled machine: Lavinia names the beat (no penalty)
      state.set('wardrobe.sewing.waltzsaid', true);
      if (bar != null && bar !== usedBar) { usedBar = bar; stitch(); } else { sfx('treadle', 0.4); S.treadlePress(); S.runNeedle(0.3); }
      ctx.characters?.lavinia?.react?.('gesture');
      dialogue.say('wardrobe.sewing.waltz');
      return;
    }
    if (!MT.running()) { sfx('treadle', 0.35); S.treadlePress(); dialogue.say('wardrobe.sewing.nobeat'); return; }
    if (bar != null && bar === usedBar) return; // one stitch per flag: further presses on the same ONE are ignored
    if (bar != null) { usedBar = bar; stitch(); return; }
    // off the beat: the thread snaps, the last quarter unpicks, the metronome carries on
    sfx('threadSnap', 0.6);
    S.treadlePress();
    S.unpick();
    room.wrong('sewing');
  };
  room.spot('treadle', S.treadleHit, 'Treadle', S.treadle, {
    scope: VIEW, // in the room the machine (and the skirt) cover it; the close-up is where it's worked
    onClick: press,
    useItem: oilUse,
  });

  const stitch = () => {
    sfx('treadle', 0.6);
    const job = S.stitch();
    if (S.stitches() >= 4) complete(job);
  };

  const complete = async (job) => {
    if (finishing) return;
    finishing = true;
    try {
      await job;
      MT.stop();
      await room.wait(0.2);
      sfx('fabricRustle', 0.6);
      const from = S.skirt.getWorldPosition(new THREE.Vector3());
      await S.releaseSkirt();
      inventory.add('skirt', { from });
      state.solve('sewing');
      await room.wait(0.3);
      if (hotspots.scope === VIEW) camera.exitFocus();
      ctx.characters?.lavinia?.react?.('clap');
      await dialogue.say('wardrobe.sewing.solved');
    } finally { finishing = false; }
  };

  return {
    restore() { usedBar = null; finishing = false; },
  };
}

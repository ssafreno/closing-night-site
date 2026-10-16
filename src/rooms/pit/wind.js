// wind (SPEED): a gale (docs/rooms/pit.md).
//   Wind machine (trap-room view) → its close-up (focus:pit.wind): the slatted drum under canvas, the iron crank, the
//   painted dial CALM · BREEZE · BLOW · GALE · STORM · DO NOT (GALE chalk-circled, a chalk arrow to the governor lever)
//   and the governor lever with its brass pawl, all in one frame.
//   Crank before oiling (click or drag, either view): crankSqueal, a judder, pit.wind.seized. `oilcan` used on the crank,
//   the drum or the dial (either view): oilSquirt, the can is consumed (item.oilcan.used), pit.oiled, an oil stain.
//   The first crank after oiling: Pike's pit.wind.pike ("Gale. Then the governor.").
//   Crank (oiled): press on it and drag round in circles. The pointer's angle round the crank hub (projected to the
//   screen) turns the crank and the drum; every full turn adds PUSH of speed (about one band per one and a half turns),
//   and the drum always coasts down by DECAY per second (about one band every 4 s). The needle chases the speed; the
//   windMachine loop follows it (pitch and level), the canvas ripples.
//   Needle into DO NOT: canvasFlap, the frame rattles, Lavinia pit.wind.kite, the drum spins down to rest (cranking is
//   ignored until it has). Overshooting into STORM is harmless: stop and the drum coasts back down through GALE.
//   Governor lever (click): needle in GALE → the pawl latches (governorLatch), the drum holds at the GALE centre by
//   itself (the whole storm train runs), the loop settles, Lavinia pit.wind.solved, solve('wind'), then the rain drum
//   completes if the 24T idler is already on (room.completeRain) and room.checkStorm(). Outside GALE: the lever clanks
//   up and drops back, Pike's pit.wind.governor; it counts as a wrong attempt (no extra line).
export const GALE = 0.531;
const PUSH = 0.12, DECAY = 0.045; // dial fraction per full crank turn; per second of coasting

export default function wind(ctx, room, h) {
  const { state, dialogue, audio, inventory, camera, hotspots } = ctx;
  const W = h.wind;
  const TRAP = 'focus:pit.trap', VIEW = 'focus:pit.wind';
  const solved = () => state.isSolved('wind');
  const oiled = () => !!state.get('pit.oiled') || solved();
  const sfx = (n, o = {}) => audio?.play(n, { gain: 0.6, ...o });
  const [G0, G1] = W.bandRange('GALE'), DONOT = W.bandRange('DO NOT')[0];
  let v = 0;              // drum speed (dial fraction)
  let crank = null;       // { last (screen angle), acc (crank angle) } while dragging
  let crankAng = 0;       // the crank's own angle (kept between drags)
  let spinDown = false, latching = false, loopAt = 0;

  const open = () => (camera.inFocus && hotspots.scope === VIEW ? Promise.resolve() : camera.focus({ ...W.focus, scope: VIEW, puzzle: 'wind' }));

  // ---- oil -------------------------------------------------------------------------------------------------------------
  const oil = () => {
    if (oiled()) return false;
    inventory.remove('oilcan');
    sfx('oilSquirt', { gain: 0.7 });
    W.setOiled(true);
    state.set('pit.oiled', true);
    dialogue.caption('item.oilcan.used');
    return true;
  };
  const oilUse = { oilcan: () => { oil(); } };

  let seizedAt = -9;
  const seized = () => {
    const now = performance.now() / 1000;
    if (now - seizedAt < 0.6) return; // a press and its click are one attempt
    seizedAt = now;
    sfx('crankSqueal', { gain: 0.7 });
    W.rattle(0.35);
    dialogue.caption('pit.wind.seized');
  };

  // ---- the crank drag --------------------------------------------------------------------------------------------------
  const hubScreen = () => {
    const p = W.crankHubWorld().clone().project(camera.camera);
    const r = hotspots.canvas?.getBoundingClientRect?.() || { left: 0, top: 0, width: innerWidth, height: innerHeight };
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  };
  const screenAngle = (info) => { const c = hubScreen(); return Math.atan2(info.y - c.y, info.x - c.x); };

  const firstTurn = () => {
    if (state.get('pit.wind.pikesaid')) return;
    state.set('pit.wind.pikesaid', true);
    ctx.characters?.pike?.react?.('point');
    dialogue.say('pit.wind.pike');
  };

  const crankStart = (info) => {
    if (solved() || latching) return;
    if (!oiled()) { seized(); return; }
    if (spinDown) return;
    firstTurn();
    crank = { last: screenAngle(info) };
  };
  const crankMove = (info) => {
    if (!crank || spinDown || solved()) return;
    // every pointer sample since the last frame (the browser coalesces moves; on a slow frame a brisk turn would
    // otherwise arrive as one big jump and be thrown away)
    const ev = info.event;
    const samples = ev?.getCoalescedEvents?.()?.length ? ev.getCoalescedEvents() : [info];
    for (const smp of samples) {
      const a = screenAngle({ x: smp.clientX ?? smp.x, y: smp.clientY ?? smp.y });
      let d = a - crank.last;
      if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
      crank.last = a;
      if (Math.abs(d) > 2.0) continue; // a jump (the pointer crossed the hub): ignore it
      crankAng += d;
      v = Math.min(1, v + Math.abs(d) / (2 * Math.PI) * PUSH);
      if (v >= DONOT) { W.setCrankAngle(-crankAng); doNot(); return; }
    }
    W.setCrankAngle(-crankAng);
  };
  const crankEnd = () => { if (crank) { crank = null; W.setCrankAngle(null); } };

  const crankClick = () => {
    if (solved()) return;
    if (!oiled()) { seized(); return; }
    if (hotspots.scope !== VIEW) { open(); return; }
    firstTurn();
  };

  // ---- DO NOT ----------------------------------------------------------------------------------------------------------
  const doNot = () => {
    if (spinDown) return;
    spinDown = true;
    crankEnd();
    sfx('canvasFlap', { gain: 0.8 });
    W.rattle(1.6);
    camera.shake?.(0.01, 0.6);
    state.inc('wrong.wind');
    ctx.characters?.lavinia?.react?.('gasp');
    dialogue.say('pit.wind.kite');
    const from = v;
    ctx.tween.run(3.2, (k) => { v = from * (1 - k); }, { ease: 'outQuad' }).then(() => { v = 0; spinDown = false; });
  };

  // ---- the governor ----------------------------------------------------------------------------------------------------
  const gov = W.governor, pawl = W.pawl;
  const clank = async () => {
    sfx('governorLatch', { gain: 0.5, pitch: 0.8 });
    await ctx.tween.run(0.12, (k) => { gov.rotation.z = -0.5 * k; pawl.rotation.z = -0.6 * k; }, { ease: 'outCubic' });
    await ctx.tween.run(0.35, (k) => { gov.rotation.z = -0.5 * (1 - k); pawl.rotation.z = -0.6 * (1 - k); }, { ease: 'outBounce' });
    W.setGovernor(false);
  };
  const governor = async () => {
    if (solved() || latching) return;
    if (hotspots.scope !== VIEW) { open(); return; }
    if (v >= G0 && v <= G1 && !spinDown) { latch(); return; }
    clank();
    audio?.play('error', { gain: 0.3 });
    state.inc('wrong.wind');
    ctx.characters?.pike?.react?.('shake');
    dialogue.say('pit.wind.governor');
  };

  const latch = async () => {
    latching = true;
    crankEnd();
    try {
      sfx('governorLatch', { gain: 0.8 });
      W.setGovernor(true);
      state.solve('wind');
      const from = v;
      await ctx.tween.run(0.8, (k) => { v = from + (GALE - from) * k; h.storm.setWind(v); }, { ease: 'inOutSine' });
      v = GALE;
      h.storm.setWind(GALE);
      room.loop('windMachine', { speed: W.audioSpeed(GALE), gain: 0.35, fade: 0.5 });
      room.loop('lowWind', { gain: 0.25, fade: 3 }); // the pit bed gains a low wind
      room.later(4, () => { if (state.isSolved('wind')) room.loop('windMachine', { speed: W.audioSpeed(GALE), gain: 0.2, fade: 3 }); });
      await room.wait(0.6);
      audio?.play('success', { gain: 0.4 });
      ctx.characters?.lavinia?.react?.('hairPat');
      await dialogue.say('pit.wind.solved');
      if (state.get('pit.idler') === 24 && !state.isSolved('rain')) await room.completeRain();
      await room.checkStorm();
    } finally { latching = false; }
  };

  // ---- per frame: the drum coasts, the needle and the loop follow -------------------------------------------------------
  room.animate((dt) => {
    if (solved() || latching) return;
    if (!spinDown && v > 0) v = Math.max(0, v - DECAY * dt);
    W.setSpeed(v);
    loopAt -= dt;
    if (loopAt <= 0) {
      loopAt = 0.12;
      if (v > 0.01) room.loop('windMachine', { speed: W.audioSpeed(v), gain: 0.25 + 0.4 * v, fade: 0.15 });
      else if (audio?.isLooping?.('windMachine')) room.stopLoop('windMachine', 0.8);
    }
  });

  // ---- hotspots --------------------------------------------------------------------------------------------------------
  room.spot('wind', W.drumProxy, 'Wind machine', null, {
    scope: [TRAP, VIEW],
    onClick: () => { if (hotspots.scope !== VIEW) open(); },
    useItem: oilUse,
  });
  room.spot('wind.crank', W.crankProxy, () => (oiled() && !solved() ? 'Crank (drag round in circles)' : 'Crank'), null, {
    scope: [TRAP, VIEW],
    onClick: crankClick,
    // a press with an item in hand is an item use (the click delivers it), never a crank
    onDragStart: (info) => { if (inventory.selected) return; if (hotspots.scope === VIEW) crankStart(info); else if (!oiled()) seized(); },
    onDrag: crankMove,
    onDragEnd: crankEnd,
    useItem: oilUse,
  });
  room.spot('wind.governor', W.governorProxy, 'Governor lever', W.governor, { scope: [TRAP, VIEW], onClick: governor, useItem: oilUse });
  room.spot('wind.dial', W.dialProxy, 'Speed dial', W.dial, {
    scope: [TRAP, VIEW],
    onClick: () => { if (hotspots.scope !== VIEW) open(); },
    useItem: oilUse,
  });

  return {
    restore() {
      crank = null; spinDown = false; latching = false;
      v = solved() ? GALE : 0;
      W.setCrankAngle(null);
    },
    get speed() { return v; },
  };
}

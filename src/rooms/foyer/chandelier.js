// chandelier (CRANK): the winch handle from the pit on the winch's square drive, crank the chandelier down, pull its
// chain (docs/rooms/foyer.md).
//   Winch cabinet (room) → its close-up (the crank framing: the label on the open door, the gear train, the drive).
//   No handle fitted: the first click says foyer.chandelier.bucket, and with no handle held loose.winch_handle.
//   `winch_handle` on the cabinet / drive / label → it fits (flag foyer.handlefitted, consumed).
//   Crank: drag round the drive. Anticlockwise lowers (ratchet click every 30°, chain rattle, prisms shiver);
//   clockwise raises it again; the pawl holds wherever you let go (flag foyer.drop, metres). Three full turns take it
//   from the ceiling to 1.8 m, where it stops with a clunk and the camera goes to it. Clockwise at the top:
//   foyer.chandelier.up (and foyer.chandelier.wrong.n on the 3rd and every 3rd).
//   Pull-chain (room or the chandelier close-up, only when fully down): the bulbs flicker and catch, the room floods
//   with light, the camera steps back and the chandelier winds itself back up over 3 s. Solve.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const TURNS = 3;              // full anticlockwise turns from the ceiling to the bottom
const FULL = TURNS * TAU;
const TOOTH = Math.PI / 6;    // a ratchet click every 30°
// the crank close-up: the drive and the gear train centred, the label on the door at the left edge
const CRANK_VIEW = { position: [-3.55, 1.44, -0.52], lookAt: [-4.8, 1.3, -0.8] };

export default function chandelier(ctx, room, h) {
  const { state, inventory, dialogue, audio, camera, tween, hotspots } = ctx;
  const solved = () => state.isSolved('chandelier');
  const fitted = () => solved() || !!state.get('foyer.handlefitted');
  const VIEW = 'focus:winch';
  const CH_VIEW = 'focus:chandelier';
  const max = h.chandelier.dropMax;

  let turn = 0;          // radians, anticlockwise (as seen from the front) positive; 0 = the chandelier at the top
  let lastA = null;      // last pointer angle about the drive (screen space, y down: clockwise = increasing)
  let teeth = 0, rattle = 0;
  let upPush = 0, upSaid = false, bottomed = false;
  let pulling = false;

  const setTurn = (a) => {
    turn = THREE.MathUtils.clamp(a, 0, FULL);
    h.winch.setTurn(turn);
    h.chandelier.setDrop(turn / FULL * max);
  };
  const down = () => h.chandelier.getDrop() > max - 0.05;

  const openView = () => room.focusOn(CRANK_VIEW, VIEW, 'chandelier');

  // ---- fitting the handle --------------------------------------------------------------------------------------
  const fit = () => {
    if (fitted()) return;
    inventory.remove('winch_handle');
    state.set('foyer.handlefitted', true);
    h.winch.setTurn(turn);
    h.winch.setHandle(true);
    audio?.play('latch', { gain: 0.6 });
    openView();
    dialogue.caption('foyer.chandelier.fitted');
  };
  const noHandle = async () => {
    if (!state.get('foyer.bucket.said')) {
      state.set('foyer.bucket.said', true);
      await dialogue.say('foyer.chandelier.bucket');
    }
    if (!fitted() && !inventory.has('winch_handle')) dialogue.say('loose.winch_handle');
  };

  room.spot('winch', h.winch.hit, 'Winch cabinet', h.winch.object, {
    onClick: () => {
      openView();
      if (!fitted()) noHandle();
    },
    useItem: { winch_handle: () => { fit(); } },
  });
  room.spot('winch.drive', h.winch.driveHit, 'Square drive', h.winch.drive, {
    scope: VIEW, enabled: () => !fitted(),
    onClick: () => (inventory.has('winch_handle') ? dialogue.caption('foyer.chandelier.drive') : noHandle()),
    useItem: { winch_handle: () => { fit(); } },
  });
  room.spot('winch.label', h.winch.labelHit, 'Enamel label', h.winch.label, {
    scope: ['room', VIEW],
    onClick: () => dialogue.caption('foyer.chandelier.label'),
    useItem: { winch_handle: () => { fit(); } },
  });

  // ---- the crank: drag round the drive ---------------------------------------------------------------------------
  // a flat proxy over the crank's whole circle, so the drag can start anywhere on the handle's sweep
  const crankHit = hotspots.proxyBox(0.46, 0.46, 0.03);
  // FIXED BY qa-foyer: in front of the handle's wooden grip (it reaches z 0.385), which otherwise swallowed a press on
  // the knob, the one place a player grabs a crank
  crankHit.position.set(0.06, -0.24, 0.40);
  h.winch.object.add(crankHit);
  const hubW = new THREE.Vector3();
  const hubScreen = () => {
    h.winch.drive.getWorldPosition(hubW);
    const v = hubW.project(camera.camera);
    const r = ctx.renderer?.domElement?.getBoundingClientRect?.() || { left: 0, top: 0, width: innerWidth, height: innerHeight };
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  };
  const angleAt = (info) => {
    const c = hubScreen();
    const dx = info.x - c.x, dy = info.y - c.y;
    if (Math.hypot(dx, dy) < 12) return null; // too near the drive to say which way
    return Math.atan2(dy, dx);
  };
  const upAttempt = () => {
    audio?.play('winch', { gain: 0.35, pitch: 1.2 });
    const n = state.inc('wrong.chandelier');
    if (n % 3 === 0 && dialogue.has('foyer.chandelier.wrong.1')) dialogue.auto(dialogue.cycle('foyer.chandelier.wrong'));
    else dialogue.caption('foyer.chandelier.up');
  };
  const reachBottom = () => {
    bottomed = true;
    audio?.play('latch', { gain: 0.9, pitch: 0.7 });
    audio?.play('sandbagThud', { gain: 0.25 });
    h.chandelier.tinkle(2.5);
    audio?.play('chandelierChime', { gain: 0.35 });
    camera.shake?.(0.004, 0.25);
  };
  const crank = {
    scope: VIEW, enabled: () => fitted() && !solved() && !pulling, highlight: room.keep(h.winch.handle),
    onDragStart: (info) => {
      if (inventory.selected) return;
      lastA = angleAt(info);
      teeth = Math.floor(turn / TOOTH + 1e-6); rattle = Math.floor(turn / (TAU / 3));
      upPush = 0; upSaid = false; bottomed = false;
    },
    onDrag: (info) => {
      if (inventory.selected || solved() || pulling) return;
      const a = angleAt(info);
      if (a == null) return;
      if (lastA == null) { lastA = a; return; }
      let d = a - lastA;
      d = Math.atan2(Math.sin(d), Math.cos(d));  // wrap to (-π, π]
      d = THREE.MathUtils.clamp(d, -0.7, 0.7);    // a pointer that jumps across the hub is not a turn
      lastA = a;
      const want = turn - d;                       // screen anticlockwise (d < 0) lowers
      if (want < 0) {                              // cranking clockwise with it already at the top
        upPush += -want;
        if (turn > 0) setTurn(0);
        if (upPush > 0.9 && !upSaid) { upSaid = true; upAttempt(); }
        return;
      }
      const was = turn;
      setTurn(want);
      if (turn !== was) {
        const t = Math.floor(turn / TOOTH + 1e-6);
        if (t !== teeth) { teeth = t; audio?.play('winch', { gain: 0.45 }); h.chandelier.tinkle(0.35); }
        const r = Math.floor(turn / (TAU / 3));
        if (r !== rattle) { rattle = r; audio?.play('chainRattle', { gain: 0.35 }); }
      }
      if (turn >= FULL - 1e-6 && was < FULL - 1e-6) reachBottom();
    },
    onDragEnd: () => {
      lastA = null;
      if (solved()) return;
      state.set('foyer.drop', +h.chandelier.getDrop().toFixed(3));
      if (bottomed || (down() && !state.get('foyer.down.seen'))) {
        bottomed = false;
        state.set('foyer.down.seen', true);
        room.later(0.35, () => { if (!solved() && down()) room.focusOn(h.chandelier.focus, CH_VIEW, 'chandelier'); });
      }
    },
    onClick: () => { if (!solved()) dialogue.caption('foyer.chandelier.crank'); },
  };
  room.spot('winch.crank', crankHit, 'Winch handle', null, crank);

  // ---- the pull-chain ------------------------------------------------------------------------------------------
  const pull = async () => {
    if (pulling || solved() || !down()) return;
    pulling = true;
    try {
      room.focusOn(h.chandelier.focus, CH_VIEW, 'chandelier');
      const p = h.chandelier.pull;
      const y0 = p.position.y;
      audio?.play('latch', { gain: 0.5, pitch: 1.3 });
      await tween.to(p.position, { y: y0 - 0.07 }, { duration: 0.16, ease: 'outQuad' });
      tween.to(p.position, { y: y0 }, { duration: 0.3, ease: 'outBack' });
      // solved from here on: a reload mid-choreography lands lit and wound up
      state.solve('chandelier');
      state.set('foyer.drop', 0);
      audio?.play('chandelierOn', { gain: 0.9 });
      for (const [k, s] of [[0.5, 0.09], [0.05, 0.12], [0.8, 0.07], [0.15, 0.16], [0.65, 0.1], [0.3, 0.12]]) {
        h.chandelier.setLit(k, true);
        await room.wait(s);
      }
      h.chandelier.setLit(1);
      h.lighting.set(1);
      audio?.play('chandelierChime', { gain: 0.8 });
      h.chandelier.tinkle(2);
      room.loop('chandelierTinkle', { gain: 0.5 });
      await room.wait(1.3);
      await camera.exitFocus({ all: true, duration: 1.0 });
      // it winds itself back up ("the narrator spares you the details")
      const said = dialogue.say('foyer.chandelier.solved');
      const from = turn;
      let tooth = Math.floor(from / TOOTH);
      await tween.run(3, (k) => {
        setTurn(from * (1 - k));
        const t = Math.floor(turn / TOOTH);
        if (t !== tooth) { tooth = t; if (t % 2 === 0) audio?.play('winch', { gain: 0.25 }); }
      }, { ease: 'inOutSine' });
      setTurn(0);
      h.lighting.refreshShadows();
      ctx.characters?.lavinia?.react?.('flourish');
      await said;
      room.checkHouse();
    } finally { pulling = false; }
  };
  room.spot('chandelier.pull', h.chandelier.pullHit, 'Pull-chain', h.chandelier.pull, {
    scope: ['room', CH_VIEW],
    enabled: () => !solved() && down(),
    onClick: () => { pull(); },
  });
  // the crystals: at rest, a look up into the dark frame; once lit, the chime delight
  room.spot('crystals', h.chandelier.crystalsHit, 'Chandelier', h.chandelier.object, {
    onClick: () => {
      if (!solved()) {
        room.focusOn(down() ? h.chandelier.focus : h.chandelier.focusUp, CH_VIEW, 'chandelier');
        // FIXED BY qa-foyer: the look up into the dark frame said nothing; Lavinia's bucket line (a spec'd clue route,
        // said once) points at the winch
        if (!down() && !state.get('foyer.bucket.said')) { state.set('foyer.bucket.said', true); dialogue.say('foyer.chandelier.bucket'); }
        return;
      }
      h.chandelier.tinkle(1.5); audio?.play('chandelierChime', { gain: 0.7 });
      dialogue.auto('foyer.delight.crystals');
    },
  });

  // ---- a work lamp (puzzles-foyer): the dark winch and the lowered chandelier read before the room is lit -------------
  const lamp = new THREE.PointLight('#ffb878', 0, 1.9, 1.6);
  lamp.name = 'puzzlesFoyerWorkLamp';
  room.group.add(lamp);
  const AT = { [VIEW]: new THREE.Vector3(-4.3, 1.66, -1.05), [CH_VIEW]: new THREE.Vector3(-0.45, 1.75, -0.95) };
  const LEVEL = { [VIEW]: 2.2, [CH_VIEW]: 3.2 };
  room.animate((dt) => {
    const sc = hotspots.scope;
    const want = !solved() && AT[sc] && (sc !== CH_VIEW || down()) ? LEVEL[sc] : 0;
    if (want && AT[sc]) lamp.position.copy(AT[sc]);
    lamp.intensity += (want - lamp.intensity) * Math.min(1, dt * 4);
    if (lamp.intensity < 0.01) lamp.intensity = 0;
  });

  return {
    restore() {
      const lit = solved();
      pulling = false;
      setTurn(lit ? 0 : (+(state.get('foyer.drop') || 0)) / max * FULL);
      h.winch.setHandle(fitted());
    },
  };
}

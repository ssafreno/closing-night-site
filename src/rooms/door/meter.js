// meter (CRANK): a shilling from the TEA FUND tin into the coin meter, then the two-spoke handle one full turn
// clockwise (docs/rooms/door.md).
//   Tin (room or the open hutch close-up) → its close-up, lid off, `shilling` to the inventory (one click).
//   Meter (room) → its close-up and the enamel plate caption. `shilling` on the slot (or on the meter) → coinDrop, the
//   coin shows behind the little window (flag door.coin).
//   Handle: drag it round its hub. With the coin it ratchets clockwise only (meterCrank every 30°, anticlockwise is
//   held by the pawl); released short of 360° it springs back to 0 with a thunk and this.wrong('meter'). At 360°:
//   credit 1/-, meterOn, the lights flicker on, the cue lamp goes red, solve. With no coin it spins freely both ways
//   and says door.meter.nocoin on release.
import * as THREE from 'three';

const TOOTH = Math.PI / 6;   // 30°
const TURN = Math.PI * 2;

export default function meter(ctx, room, h) {
  const { state, inventory, dialogue, audio, camera, tween } = ctx;
  const solved = () => state.isSolved('meter');
  const coinIn = () => !!state.get('door.coin');
  const VIEW = 'focus:meter';

  // ---- the TEA FUND tin ------------------------------------------------------------------------------------------
  const tinFull = () => !inventory.has('shilling') && !solved() && !coinIn();
  room.spot('tin', h.tin.hit, 'TEA FUND tin', h.tin.object, {
    enabled: room.inHutch, scope: ['room', 'focus:hutch'],
    onClick: async () => {
      if (!tinFull()) { // the delight: the tin, after
        h.tin.setOpen(1); audio?.play('cabinetOpen', { gain: 0.25 });
        dialogue.caption('door.delight.teatin');
        room.later(2.5, () => h.tin.setOpen(0));
        return;
      }
      room.focusOn({ ...h.tin.focus, onExit: () => h.tin.setOpen(0) }, 'focus:tin', 'meter');
      await room.wait(0.45);
      if (!tinFull()) return;
      h.tin.setOpen(1);
      audio?.play('cabinetOpen', { gain: 0.3 });
      await room.wait(0.35);
      h.tin.setEmpty(true);
      inventory.add('shilling', { from: h.tin.shilling }); // item.shilling.pickup, once
    },
  });

  // ---- the meter -------------------------------------------------------------------------------------------------
  const openView = () => {
    if (camera.inFocus && ctx.hotspots.scope === VIEW) return Promise.resolve();
    dialogue.caption('door.meter.plate', { scope: VIEW });
    return room.focusOn(h.meter.focus, VIEW, 'meter');
  };
  const insert = () => {
    if (solved() || coinIn()) return false;
    inventory.remove('shilling');
    state.set('door.coin', true);
    audio?.play('coinDrop', { gain: 0.8 });
    room.later(0.35, () => h.meter.setCoin(true));
    if (ctx.hotspots.scope !== VIEW) openView();
    return true;
  };
  room.spot('meter', h.meter.hit, 'Coin meter', h.meter.object, {
    onClick: () => { openView(); },
    useItem: { shilling: () => { insert(); } },
  });
  room.spot('meter.plate', h.meter.plateHit, 'Enamel plate', h.meter.object, {
    scope: VIEW, onClick: () => dialogue.caption('door.meter.plate'),
    useItem: { shilling: () => { insert(); } },
  });
  room.spot('meter.slot', h.meter.slot, 'Coin slot', h.meter.object, {
    scope: VIEW,
    onClick: () => dialogue.caption(solved() || coinIn() ? 'door.meter.slot.full' : 'door.meter.slot'),
    useItem: { shilling: () => { insert(); } },
  });

  // FIXED BY qa-door: the round coin window is the most coin-shaped thing on the meter (and the only part that shows in
  // the dark), so a shilling dropped on it said "That does nothing". It now takes the coin like the slot beside it.
  const winHit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), new THREE.MeshBasicMaterial({ visible: false }));
  winHit.userData.hitProxy = true; winHit.userData.keep = true;
  winHit.position.set(0.08, h.meter.slot.position.y, h.meter.slot.position.z);
  h.meter.object.add(winHit);
  room.spot('meter.window', winHit, 'Coin window', h.meter.object, {
    scope: VIEW,
    onClick: () => dialogue.caption(coinIn() ? 'door.meter.window.full' : solved() ? 'door.meter.slot.full' : 'door.meter.window'),
    useItem: { shilling: () => { insert(); } },
  });

  // ---- the handle (drag round the hub) --------------------------------------------------------------------------
  let turn = 0;            // radians, clockwise positive
  let lastA = null;        // last pointer angle about the hub (screen space, y down: clockwise = increasing)
  let moved = 0;           // total |angle| moved this drag
  let teeth = 0;
  let springing = null;    // the spring-back tween
  let done = false;
  const hubScreen = () => {
    const v = h.meter.hubWorld.clone().project(camera.camera);
    const r = ctx.renderer?.domElement?.getBoundingClientRect?.() || { left: 0, top: 0, width: innerWidth, height: innerHeight };
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  };
  const angleAt = (info) => {
    const c = hubScreen();
    const dx = info.x - c.x, dy = info.y - c.y;
    if (Math.hypot(dx, dy) < 10) return null; // too near the hub to say which way
    return Math.atan2(dy, dx);
  };
  const setTurn = (a) => { turn = a; h.meter.setTurn(a); };
  const complete = async () => {
    done = true;
    setTurn(0); // a full turn is home again
    state.solve('meter');
    state.set('door.coin', false);
    audio?.play('meterCrank', { gain: 0.8 });
    h.meter.setCredit(1);
    await room.wait(0.3);
    audio?.play('meterOn', { gain: 0.9 });
    h.meter.setCoin(false); // the shilling drops into the cash box
    await room.wait(0.5);
    camera.exitFocus({ all: true, duration: 0.9 }); // step back to watch the room come on
    await room.wait(0.35);
    h.lights.setLit(true, { flicker: true });
    h.cueBox.setState('red');
    await room.wait(1.1);
    dialogue.say('door.meter.solved');
  };
  room.spot('meter.handle', h.meter.handleHit, 'Handle', h.meter.handle, {
    scope: VIEW, enabled: () => !solved() && !done,
    onDragStart: (info) => {
      const job = springing; springing = null; job?.cancel?.(); // grabbed mid-spring: it stays where the hand caught it
      lastA = angleAt(info); moved = 0;
      teeth = Math.floor(turn / TOOTH + 1e-6);
    },
    onDrag: (info) => {
      if (done) return;
      const a = angleAt(info);
      if (a == null) return;
      if (lastA == null) { lastA = a; return; }
      let d = a - lastA;
      d = Math.atan2(Math.sin(d), Math.cos(d)); // wrap to (-π, π]
      d = THREE.MathUtils.clamp(d, -0.7, 0.7);   // a pointer that jumps across the hub is not a turn
      lastA = a;
      moved += Math.abs(d);
      if (!coinIn()) { setTurn(turn + d); return; } // spins freely, no ratchet
      if (d <= 0) return;                          // the pawl holds: no going back
      setTurn(Math.min(TURN, turn + d));
      const t = Math.floor(turn / TOOTH + 1e-6);
      if (t > teeth) { teeth = t; audio?.play('meterCrank', { gain: 0.6 }); }
      if (turn >= TURN - 1e-6) complete();
    },
    onDragEnd: () => {
      if (done || solved()) return;
      lastA = null;
      if (moved < 0.05) return; // a click: onClick says something
      if (!coinIn()) {
        dialogue.caption('door.meter.nocoin');
        const from = turn, to = Math.round(turn / TURN) * TURN;
        const job = springing = tween.run(0.6, (k) => setTurn(from + (to - from) * k), { ease: 'outCubic' });
        job.then(() => { if (springing === job) { springing = null; setTurn(0); } });
        return;
      }
      if (turn <= 1e-3) return; // only tried to go anticlockwise: the pawl said no
      const from = turn;
      const job = springing = tween.run(0.28, (k) => setTurn(from * (1 - k)), { ease: 'inQuad' });
      job.then(() => { if (springing !== job || done) return; springing = null; setTurn(0); audio?.play('drop', { gain: 0.9 }); });
      room.wrong('meter');
    },
    onClick: () => {
      if (!coinIn()) { dialogue.caption('door.meter.nocoin'); return; }
      dialogue.caption('door.meter.handle');
    },
  });

  return {
    restore() {
      done = solved();
      const job = springing; springing = null; job?.cancel?.();
      setTurn(0);
      h.tin.setEmpty(!tinFull());
      h.meter.setCoin(!solved() && coinIn());
      h.meter.setCredit(solved() ? 1 : 0, true);
      h.cueBox.setState(solved() ? 'red' : 'off', true);
    },
  };
}

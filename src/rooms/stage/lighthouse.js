// lighthouse (ALIGN): the truck onto the blue spike, its door to the prompt side, the brake on (docs/rooms/stage.md).
//   The lighthouse truck (room) → the top-down view from the fly gallery, framed like page 5 of the prompt book (the
//   audience at the bottom, PROMPT at the bottom right). Pike says stage.lighthouse.pike on the first look.
//   Drag the truck to roll it (truckRoll): released within 60 cm (POLISH: was 30) of a spike set's centre it snaps square onto it
//   (spikeSnap), elsewhere it stays where it was dropped. The brass turn handle: a quarter turn clockwise per click
//   (truckTurn). The brake pedal: click to set. Pose persists (stage.truck {x, z, r}).
//   Blue, door to the prompt side (r = TRUCK_DOOR_PROMPT), brake → the truck settles, a glint in the empty lantern room,
//   stage.lighthouse.solved, then the SET check. Brake set anywhere else → red: stage.lighthouse.red; yellow: .yellow;
//   blue with the door wrong: .door (Lavinia); elsewhere: Room.wrong('lighthouse'); the brake lets go after the line and
//   the truck stays where it is. Solve: `lighthouse`.
import * as THREE from 'three';
import { SPIKES, TRUCK_DOOR_PROMPT } from './set.js';

const BOUNDS = { x0: -7.4, x1: 7.4, z0: -3.4, z1: 3.1 }; // the truck's centre stays on the boards, downstage of line 7

export default function lighthouse(ctx, room, h) {
  const { state, dialogue, audio, camera, tween } = ctx;
  const lit = () => state.isSolved('ghostlight');
  const solved = () => state.isSolved('lighthouse');
  const T = h.truck;
  const VIEW = 'focus:truck';
  let busy = false;

  // the top-down view framed like page 5 of the prompt book (stage.md): the park at O.P., all three spike sets, the
  // curtain line along the bottom and, at the bottom right, the prompt desk and the word PROMPT on the floor (the side
  // the door must face). SET's frame stopped at x 5.8 and left the desk and the word out. High in the fly tower with a
  // long lens, so the tower leans little in perspective.
  T.focus = { position: new THREE.Vector3(0.2, 15, -0.5), lookAt: new THREE.Vector3(0.2, 0, -0.85), fov: 38 };

  const save = () => state.set('stage.truck', T.pose);

  // While the top-down view is open:
  // - clicks go through the cast on the boards (Lavinia by the ghost light stands right beside the red and yellow
  //   marks; they stay visible, and the hint button still reaches her) and through the truck's own room-click and deck
  //   proxies (the tall room box covers the whole deck, and walking up from it finds the truck body);
  // - the tower above the deck is drawn at 40% height and clicks go through it too. From straight above its height
  //   cannot be seen anyway, but its lean in perspective would hide whichever deck corner is away from the camera,
  //   and the brass turn handle and the brake pedal ride on the deck's corners (at some turns the handle sat under the
  //   lantern). The deck is the grab surface for rolling.
  // FIXED BY qa-stage: at 0.4 the tower still leaned well off its deck at the park (the click-through tower looked like
  // the thing to grab, and wasn't); at 0.2 the plan reads as a plan and the visible tower sits over the deck it rolls on.
  const SQUASH = 0.2, DECK = 0.2;
  const passed = new Map(), squashed = new Map();
  const skip = (o) => { if (o && !passed.has(o)) { passed.set(o, o.userData.noRaycast); o.userData.noRaycast = true; } };
  const low = new Set([T.object.userData.brake, T.object.userData.turnHandle, T.turnHit, T.brakeHit, T.deckHit, T.hit]);
  const upper = () => T.object.children.filter((c) => {
    if (low.has(c)) return false;
    if (c.isMesh && c.geometry) { c.geometry.boundingBox || c.geometry.computeBoundingBox(); return c.position.y + c.geometry.boundingBox.max.y > 0.45; }
    return c.position.y > 0.45; // the lamp mount, the placed lamp, the glint
  });
  // FIXED BY qa-stage: from 15 m up the brass handle read as a 15 px ring of 1 px wire and the brake as a red fleck, so a
  // blind player rolled the truck onto blue and never found how to turn it. In the top-down view both grow in plan (x, z),
  // and so do their hit boxes; they shrink back when the view closes.
  const GROW = [[T.object.userData.turnHandle, 2.6], [T.object.userData.brake, 1.8], [T.turnHit, 1.6], [T.brakeHit, 1.5]];
  const grown = new Map();
  const topDown = (on) => {
    if (on) {
      for (const [o, k] of GROW) if (o && !grown.has(o)) { grown.set(o, { x: o.scale.x, z: o.scale.z }); o.scale.x *= k; o.scale.z *= k; }
      for (const who of ['lavinia', 'pike', 'cat']) ctx.characters?.[who]?.group?.traverse?.(skip);
      skip(T.hit); skip(T.deckHit);
      for (const c of upper()) {
        c.traverse(skip);
        if (squashed.has(c)) continue;
        squashed.set(c, { sy: c.scale.y, py: c.position.y });
        c.scale.y *= SQUASH; c.position.y = DECK + (c.position.y - DECK) * SQUASH;
      }
    } else {
      for (const [o, was] of passed) { if (was === undefined) delete o.userData.noRaycast; else o.userData.noRaycast = was; }
      passed.clear();
      for (const [c, { sy, py }] of squashed) { c.scale.y = sy; c.position.y = py; }
      squashed.clear();
      for (const [o, { x, z }] of grown) { o.scale.x = x; o.scale.z = z; }
      grown.clear();
    }
  };
  const focusTruck = () => {
    h.flies.setVisible(false, { keepCloth: true });
    topDown(true);
    camera.focus({ ...T.focus, scope: VIEW, puzzle: 'lighthouse', onExit: () => { topDown(false); h.flies.setVisible(true); } });
  };

  room.spot('truck', T.hit, 'Lighthouse', T.object, {
    enabled: lit,
    useItem: { lamp: () => room.placeLamp() },
    onClick: () => {
      if (solved()) { dialogue.caption(state.get('stage.lampplaced') ? 'stage.lighthouse.lamp' : 'stage.lighthouse.stencil'); return; }
      focusTruck();
      if (!state.get('stage.lighthouse.pike.said')) {
        state.set('stage.lighthouse.pike.said', true);
        room.later(0.9, () => { ctx.characters?.pike?.react?.('point'); dialogue.say('stage.lighthouse.pike'); });
      }
    },
  });

  // ---- rolling: drag the truck across the floor -------------------------------------------------------------------
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2); // the platform's height
  const onFloor = (ray) => ray.intersectPlane(floor, new THREE.Vector3());
  let drag = null, rollJob = null;
  const stopRoll = () => { rollJob?.cancel?.(); rollJob = null; };
  const nearest = (x, z) => {
    let best = null;
    for (const [name, [sx, sz]] of Object.entries(SPIKES)) {
      const d = Math.hypot(x - sx, z - sz);
      if (!best || d < best.d) best = { name, d, x: sx, z: sz };
    }
    return best;
  };
  /** The spike set the truck is standing square on (centre within the snap radius), or null. */
  const onSpike = () => { const p = T.pose; const n = nearest(p.x, p.z); return n && n.d <= 0.02 ? n.name : null; };

  room.spot('truck.body', T.object, 'Lighthouse truck (drag to roll)', T.object, {
    scope: VIEW, enabled: () => !solved() && !busy,
    onDragStart: (info) => {
      if (T.brake) return;
      stopRoll();
      const p = info.ray ? onFloor(info.ray) : null;
      drag = { off: p ? { x: T.pose.x - p.x, z: T.pose.z - p.z } : { x: 0, z: 0 }, moved: false, sound: 0 };
    },
    onDrag: (info) => {
      if (!drag) return;
      if (Math.hypot(info.totalDx, info.totalDy) > 4) drag.moved = true;
      if (!drag.moved) return;
      const p = onFloor(info.ray);
      if (!p) return;
      const x = THREE.MathUtils.clamp(p.x + drag.off.x, BOUNDS.x0, BOUNDS.x1);
      const z = THREE.MathUtils.clamp(p.z + drag.off.z, BOUNDS.z0, BOUNDS.z1);
      const step = Math.hypot(x - T.pose.x, z - T.pose.z);
      T.setPose(x, z);
      drag.sound += step;
      if (drag.sound > 0.6) { drag.sound = 0; audio?.play('truckRoll', { gain: 0.45, dur: 0.5 }); }
    },
    onDragEnd: () => {
      const d = drag; drag = null;
      if (!d || !d.moved) return;
      const n = nearest(T.pose.x, T.pose.z);
      if (n && n.d <= h.spikes.radius) {
        // square onto the marks
        const from = T.pose;
        rollJob = tween.run(0.18, (k) => T.setPose(from.x + (n.x - from.x) * k, from.z + (n.z - from.z) * k), { ease: 'outQuad' });
        rollJob.then(() => { audio?.play('spikeSnap', { gain: 0.7 }); save(); });
      } else save();
    },
    // the handle swings round with the truck, so a quick run of clicks on it lands on the truck: still a turn
    onClick: (info) => { if (turnBusy(info)) turnOnce(info); else dialogue.caption('stage.lighthouse.stencil'); },
  });

  // ---- the turn handle: a quarter turn clockwise per click (rapid clicks queue whole turns) ----------------------
  const turn = { r: T.pose.r };
  let turnJob = null, lastTurn = -1e9;
  // (event timestamps, so a slow frame between two quick clicks doesn't split them)
  const at = (info) => info?.event?.timeStamp ?? performance.now();
  const turnBusy = (info) => !T.brake && at(info) - lastTurn < 700;
  const turnOnce = (info) => {
    if (T.brake) return;
    lastTurn = at(info);
    audio?.play('truckTurn', { gain: 0.6 });
    turnJob = tween.by(turn, { r: 1 }, { duration: 0.45, ease: 'inOutSine', onUpdate: () => T.setTurn(turn.r) });
    const job = turnJob;
    job.then(() => {
      if (turnJob !== job) return;
      turn.r = Math.round(turn.r);
      T.setPose(T.pose.x, T.pose.z, turn.r);
      turn.r = T.pose.r;
      save();
    });
  };
  room.spot('truck.turn', T.turnHit, 'Turn handle (a quarter turn)', T.object.userData.turnHandle, {
    scope: VIEW, enabled: () => !solved() && !busy,
    onClick: (info) => turnOnce(info),
  });

  // ---- the brake --------------------------------------------------------------------------------------------------
  room.spot('truck.brake', T.brakeHit, () => (T.brake ? 'Brake: ON' : 'Brake pedal'), T.object.userData.brake, {
    scope: VIEW, enabled: () => !solved() && !busy,
    onClick: () => setBrake(),
  });

  async function setBrake() {
    if (busy || solved()) return;
    busy = true;
    try {
      // let a running turn or snap land first
      if (turnJob) await turnJob;
      if (rollJob) await rollJob;
      T.setPose(T.pose.x, T.pose.z, Math.round(turn.r));
      turn.r = T.pose.r;
      save();
      audio?.play('latch', { gain: 0.6, pitch: 0.8 });
      T.setBrake(true);
      const spike = onSpike();
      if (spike === 'blue' && T.pose.r === TRUCK_DOOR_PROMPT) { await succeed(); return; }
      await room.wait(0.35);
      if (spike === 'red') { audio?.play('error', { gain: 0.3 }); ctx.characters?.pike?.react?.('shake'); await dialogue.say('stage.lighthouse.red'); }
      else if (spike === 'yellow') { audio?.play('error', { gain: 0.3 }); ctx.characters?.pike?.react?.('shake'); await dialogue.say('stage.lighthouse.yellow'); }
      else if (spike === 'blue') { audio?.play('error', { gain: 0.3 }); ctx.characters?.lavinia?.react?.('brow'); await dialogue.say('stage.lighthouse.door'); }
      else { room.wrong('lighthouse'); await room.wait(0.9); while (dialogue.isOpen) await room.wait(0.2); }
      state.inc(spike ? 'wrong.lighthouse.marks' : 'wrong.lighthouse.none');
      // the brake lets itself go; the truck stays where it is
      audio?.play('latch', { gain: 0.4, pitch: 1.2 });
      T.setBrake(false);
    } finally {
      busy = false;
    }
  }

  async function succeed() {
    state.solve('lighthouse');
    ctx.hotspots.lock();
    try {
      audio?.play('spikeSnap', { gain: 0.5, pitch: 0.8 });
      T.glint(true);
      await room.wait(0.8);
      room.retargetHub?.(); // FIXED BY integration-qa: SET in → back to the footlights, where the wardrobe stair shows
      await camera.exitFocus({ all: true });
      camera.lookAtPoint?.(new THREE.Vector3(T.pose.x, 2.0, T.pose.z));
      await room.wait(0.6);
      ctx.characters?.lavinia?.react?.('flourish');
      await dialogue.say('stage.lighthouse.solved');
      room.later(1.5, () => { if (!state.get('stage.lampplaced')) T.glint(false); });
      await room.checkSet();
    } finally {
      ctx.hotspots.unlock();
      room.restore();
    }
  }

  return {
    restore() {
      drag = null; stopRoll(); busy = false;
      if (!(camera.inFocus && ctx.hotspots.scope === VIEW)) topDown(false);
      turnJob?.cancel?.(); turnJob = null;
      const t = solved() ? { x: SPIKES.blue[0], z: SPIKES.blue[1], r: TRUCK_DOOR_PROMPT } : state.get('stage.truck', null) || T.park;
      T.setPose(t.x, t.z, t.r);
      turn.r = T.pose.r;
      T.setBrake(solved());
      T.setLampPlaced(!!state.get('stage.lampplaced'));
      T.glint(false);
    },
  };
}

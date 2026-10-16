// dimmer (LEVELS): Q34 MOONLIGHT on the dimmer board, then the MASTER (docs/rooms/stage.md).
//   Dimmer board (room) → its close-up (before `mains` the board is dead: stage.dimmer.dead). Four brass levers in
//   vertical slots, BATTENS FLOATS LIMES BLUES, five notches OUT ¼ ½ ¾ FULL: drag one up or down and it snaps to the
//   nearest notch (leverNotch per notch crossed); a click steps it one notch toward the click. Notches persist
//   (stage.lever.<name>). The iron MASTER wheel: drag it a half-turn clockwise (or click it) to GO.
//   Q34 = Battens ¼ · Floats OUT · Limes ½ · Blues FULL → dimmerGo, the stage fades from work light to moonlight over
//   3 s, stage.dimmer.solved, stage.done.light, LIGHT ticked (then the wardrobe cue light if SET is in).
//   Anything else → the stage shows that state for 2 s (from the levers), fades back to work light, the levers stay;
//   Floats ≥ ¾ → stage.dimmer.ham, else Room.wrong('dimmer'). Then back to the board. Solve: `dimmer`.
import * as THREE from 'three';

export const LEVERS = ['battens', 'floats', 'limes', 'blues'];
/** Q34 MOONLIGHT notches (0 OUT, 1 ¼, 2 ½, 3 ¾, 4 FULL). */
export const Q34 = { battens: 1, floats: 0, limes: 2, blues: 4 };
const NOTCHES = 4;

export default function dimmer(ctx, room, h) {
  const { state, dialogue, audio, camera, tween } = ctx;
  const live = () => state.isSolved('mains');
  const solved = () => state.isSolved('dimmer');
  const B = h.dimmer;
  const VIEW = 'focus:dimmer';
  const notch = (i) => state.get(`stage.lever.${LEVERS[i]}`, 0);
  const pos = [0, 0, 0, 0]; // fractional lever positions (0..1) as shown
  const jobs = [null, null, null, null];
  let busy = false;

  // the lever proxies a little deeper, so a knob standing proud of its slot (¾, FULL) is still grabbed by its lever
  B.leverHits.forEach((hit) => { hit.scale.z = 1.5; });
  B.masterHit.scale.z = 1.5;

  const focusBoard = () => camera.focus({ ...B.focus, scope: VIEW, puzzle: 'dimmer' });
  room.spot('dimmer', B.hit, 'Dimmer board', B.object, {
    enabled: () => state.isSolved('ghostlight'),
    onClick: () => {
      focusBoard();
      if (!live()) room.later(0.7, () => dialogue.caption('stage.dimmer.dead'));
      else if (solved()) room.later(0.7, () => dialogue.caption('stage.dimmer.set'));
    },
  });

  // ---- the levers ----------------------------------------------------------------------------------------------
  const show = (i, k) => { pos[i] = k; B.setLevel(i, k, true); };
  const animTo = (i, n, dur = 0.12) => {
    jobs[i]?.cancel?.();
    const from = pos[i], to = n / NOTCHES;
    jobs[i] = tween.run(dur, (k) => show(i, from + (to - from) * k), { ease: 'outQuad' });
  };
  const setNotch = (i, n) => {
    n = THREE.MathUtils.clamp(n, 0, NOTCHES);
    if (n !== notch(i)) audio?.play('leverNotch', { gain: 0.6, pitch: 0.9 + n * 0.05 });
    state.set(`stage.lever.${LEVERS[i]}`, n);
    animTo(i, n);
  };
  // the board's face plane in room coordinates (the levers ride in front of it): x = const, y gives the level
  const plane = new THREE.Plane();
  const faceX = () => { const p = new THREE.Vector3(); B.levers[0].getWorldPosition(p); return p.x; };
  const yAt = (ray) => {
    plane.set(new THREE.Vector3(1, 0, 0), -faceX());
    const p = ray.intersectPlane(plane, new THREE.Vector3());
    return p ? p.y : null;
  };
  const kOfY = (y) => THREE.MathUtils.clamp((y - B.slotY[0]) / (B.slotY[1] - B.slotY[0]), 0, 1);
  let drag = null;
  B.leverHits.forEach((hit, i) => room.spot(`dimmer.${LEVERS[i]}`, hit, () => `${LEVERS[i].toUpperCase()}: ${B.notches[notch(i)]}`, B.levers[i], {
    scope: VIEW, enabled: () => live() && !solved() && !busy,
    onDragStart: (info) => {
      jobs[i]?.cancel?.();
      const y = info.ray ? yAt(info.ray) : null;
      drag = { i, grab: y == null ? 0 : kOfY(y) - pos[i], last: notch(i), moved: false };
    },
    onDrag: (info) => {
      if (!drag || drag.i !== i) return;
      if (Math.abs(info.totalDy) > 4) drag.moved = true;
      if (!drag.moved) return;
      const y = yAt(info.ray);
      if (y == null) return;
      const k = THREE.MathUtils.clamp(kOfY(y) - drag.grab, 0, 1);
      show(i, k);
      const n = Math.round(k * NOTCHES);
      if (n !== drag.last) { drag.last = n; audio?.play('leverNotch', { gain: 0.35, pitch: 0.9 + n * 0.05 }); }
    },
    onDragEnd: () => {
      const d = drag; drag = null;
      if (!d || d.i !== i || !d.moved) return;
      const n = Math.round(pos[i] * NOTCHES);
      state.set(`stage.lever.${LEVERS[i]}`, n);
      animTo(i, n);
    },
    onClick: (info) => {
      // one notch toward where you clicked (above the handle: up)
      const handleY = B.slotY[0] + (B.slotY[1] - B.slotY[0]) * (notch(i) / NOTCHES);
      const y = info.point?.y ?? handleY;
      setNotch(i, notch(i) + (y > handleY + 0.02 ? 1 : y < handleY - 0.02 ? -1 : (notch(i) < NOTCHES ? 1 : -1)));
    },
  }));

  // ---- the MASTER wheel -------------------------------------------------------------------------------------------
  let a = 0, wheelJob = null, wdrag = null;
  const setA = (v) => { a = v; B.setMaster(v); };
  const animA = (to, dur, ease = 'inOutQuad') => {
    wheelJob?.cancel?.();
    const from = a;
    wheelJob = tween.run(dur, (k) => setA(from + (to - from) * k), { ease });
    return wheelJob;
  };
  const centre = () => {
    const p = new THREE.Vector3(); B.master.getWorldPosition(p);
    p.project(camera.camera);
    const r = ctx.renderer?.domElement?.getBoundingClientRect?.() || { left: 0, top: 0, width: innerWidth, height: innerHeight };
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  };
  room.spot('dimmer.master', B.masterHit, 'MASTER (turn to GO)', B.master, {
    scope: VIEW, enabled: () => live() && !solved() && !busy,
    onDragStart: (info) => {
      wheelJob?.cancel?.();
      const c = centre();
      wdrag = { c, ang: Math.atan2(info.y - c.y, info.x - c.x), moved: false };
    },
    onDrag: (info) => {
      if (!wdrag) return;
      if (Math.hypot(info.totalDx, info.totalDy) > 4) wdrag.moved = true;
      const ang = Math.atan2(info.y - wdrag.c.y, info.x - wdrag.c.x);
      let d = ang - wdrag.ang;
      if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      wdrag.ang = ang;
      setA(THREE.MathUtils.clamp(a + d, 0, Math.PI)); // clockwise on screen (y down) is +
      if (a >= Math.PI * 0.98) { wdrag = null; go(); }
    },
    onDragEnd: () => {
      const d = wdrag; wdrag = null;
      if (!d || !d.moved) return;
      if (a >= Math.PI * 0.8) go(); else animA(0, 0.4, 'outBack');
    },
    onClick: () => go(),
  });

  async function go() {
    if (busy || solved()) return;
    busy = true;
    let locked = false;
    try {
      await animA(Math.PI, 0.35 * (1 - a / Math.PI) + 0.08, 'inQuad');
      const lv = Object.fromEntries(LEVERS.map((n, i) => [n, notch(i)]));
      const right = LEVERS.every((n) => lv[n] === Q34[n]);
      ctx.hotspots.lock(); locked = true;
      if (right) state.solve('dimmer');
      await camera.exitFocus({ all: true, duration: 0.8 });
      if (right) {
        audio?.play('dimmerGo', { gain: 0.8 });
        h.lights.setState('moon', 3);
        await room.wait(3.2);
        ctx.characters?.lavinia?.react?.('flourish');
        await dialogue.say('stage.dimmer.solved');
        await dialogue.say('stage.done.light');
        await room.deliver('light');
        return;
      }
      // the wrong look, from the levers, for two seconds; then the work lights again
      audio?.play('dimmerGo', { gain: 0.45, pitch: 0.85 });
      h.lights.dimmer(Object.fromEntries(LEVERS.map((n) => [n, lv[n] / NOTCHES])), 0.8);
      await room.wait(2.8);
      h.lights.setState('work', 1);
      animA(0, 0.6);
      await room.wait(0.6);
      ctx.hotspots.unlock(); locked = false;
      if (lv.floats >= 3) {
        audio?.play('error', { gain: 0.4 });
        state.inc('wrong.dimmer');
        ctx.characters?.lavinia?.react?.('shake');
        dialogue.say('stage.dimmer.ham');
      } else room.wrong('dimmer');
      await room.wait(0.4);
      if (!camera.inFocus && room.isCurrent()) focusBoard();
    } finally {
      if (locked) ctx.hotspots.unlock();
      busy = false;
      if (solved()) room.restore();
    }
  }

  return {
    restore() {
      drag = null; wdrag = null; busy = false;
      jobs.forEach((j) => j?.cancel?.());
      wheelJob?.cancel?.();
      LEVERS.forEach((name, i) => show(i, (solved() ? Q34[name] : notch(i)) / NOTCHES));
      setA(0);
    },
  };
}

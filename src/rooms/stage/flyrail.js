// flyrail (WEIGHT): load line 7 to 112 lb, lift the lock, one pull and the Gull Point cloth glides in (stage.md).
//   Line 7's rope, card or slate (room) → the close-up at chest height: the empty arbor, the chalk slate with the running
//   total, two stacks of stamped iron (28 ×4, 14 ×6), the rope-lock lever (DOWN = locked). Click a weight on a stack:
//   that stack's top weight slides onto the arbor (weightClank), the slate updates; click a weight on the arbor: the top
//   one goes back to its stack. At most 8 aboard. Contents persist (stage.arbor, a list of lb). No balance indicator.
//   Lever UP (ropeLock): with exactly 112 lb the line is in balance and waits; one downward drag on the purchase line of
//   at least 1/6 of the screen height sends the cloth gliding in by itself over 3 s (ropeHaul) to its trim, where the
//   lever drops and locks itself. Solve: `flyrail`, stage.flyrail.solved, then the SET check.
//   Lever UP with anything else: the line runs at once (ropeRun): heavy → the cloth crashes in to the deck, light → the
//   arbor drops and the empty batten flies out; it clatters at the safety, Pike: stage.flyrail.running then .heavy /
//   .light; after 2 s the cloth goes back to where it was stored, the lever drops and locks, the weights stay
//   (Room.wrong('flyrail') counts it). Pulling the rope with the lock on: stage.flyrail.locked.
import * as THREE from 'three';
import { CLOTH } from './set.js';

const TARGET = 112;
const MAX = 8;
const TRAVEL = Math.min(CLOTH.out - CLOTH.trim, 4.6); // the arbor's rise when the cloth is in at trim
const LOCKED = 0.35, UNLOCKED = -0.95; // the lock lever's rotation.x

export default function flyrail(ctx, room, h) {
  const { state, dialogue, audio, camera, tween } = ctx;
  const lit = () => state.isSolved('ghostlight');
  const solved = () => state.isSolved('flyrail');
  const FR = h.flyrail, BC = h.backcloth;
  const lever = FR.lock.userData.lever;
  const VIEW = 'focus:flyrail';

  // where every weight is: on the arbor (bottom → top) or on its stack (bottom → top)
  let onArbor = [];
  const onStack = { 28: [], 14: [] };
  const lbOf = (w) => w.userData.lb;
  const total = () => onArbor.reduce((s, w) => s + lbOf(w), 0);
  let travel = 0;
  let armed = false; // the lock is up with 112 aboard: the line waits for its pull
  let busy = false;
  const jobs = new Map();

  const seatOf = (k) => { let below = 0; for (let j = 0; j < k; j++) below += FR.weightHeight[lbOf(onArbor[j])]; return FR.arborSeat(below).add(new THREE.Vector3(0, travel, 0)); };
  const stackOf = (lb, k) => FR.stackPos[lb].clone().add(new THREE.Vector3(0, k * FR.weightHeight[lb], 0));
  const homeOf = (w) => { const k = onArbor.indexOf(w); if (k >= 0) return seatOf(k); return stackOf(lbOf(w), onStack[lbOf(w)].indexOf(w)); };
  const placeAll = () => { for (const lb of [28, 14]) for (const w of FR.stacks[lb]) if (!jobs.has(w)) w.position.copy(homeOf(w)); };
  const save = () => { state.set('stage.arbor', onArbor.map(lbOf)); FR.setTotal(total()); };

  /** Slide one weight to where it now belongs, in a little arc. */
  function fly(w, origin) {
    jobs.get(w)?.cancel?.();
    w.userData.flyFrom = origin;
    const from = w.position.clone();
    const job = tween.run(0.42, (k) => {
      const to = homeOf(w);
      w.position.lerpVectors(from, to, k);
      w.position.y += Math.sin(k * Math.PI) * 0.16;
    }, { ease: 'inOutSine' });
    jobs.set(w, job);
    job.then(() => { if (jobs.get(w) !== job) return; jobs.delete(w); w.position.copy(homeOf(w)); audio?.play('weightClank', { gain: 0.6, pitch: lbOf(w) === 28 ? 0.9 : 1.15 }); });
  }

  // ---- the lock lever -------------------------------------------------------------------------------------------
  let leverJob = null;
  const leverTo = (to, dur = 0.25) => {
    leverJob?.cancel?.();
    const from = lever.rotation.x;
    leverJob = tween.run(dur, (k) => { lever.rotation.x = from + (to - from) * k; }, { ease: 'outQuad' });
    return leverJob;
  };
  const isLocked = () => !armed && !busy;
  function relock(sound = true) {
    if (!armed) return;
    armed = false;
    if (sound) audio?.play('ropeLock', { gain: 0.5 });
    leverTo(LOCKED);
  }

  // the close-up's working light: the rail lamp's spill on the arbor and the iron, up while you are at the rail
  const fill = new THREE.PointLight('#ffe2b8', 0, 4, 1.4);
  fill.position.copy(FR.focus.position).lerp(FR.focus.lookAt, 0.45).add(new THREE.Vector3(0.15, 0.95, 0.35));
  fill.userData.keep = true;
  room.group.add(fill);
  let fillJob = null;
  const fillTo = (k, dur = 0.6) => { fillJob?.cancel?.(); const f0 = fill.intensity; fillJob = tween.run(dur, (t) => { fill.intensity = f0 + (k - f0) * t; }); };

  const focusRail = () => { fillTo(7); camera.focus({ ...FR.focus, scope: VIEW, puzzle: 'flyrail', onExit: () => { fillTo(0, 0.4); relock(); } }); };
  room._focusRail = focusRail;

  // ---- the weights ------------------------------------------------------------------------------------------------
  for (const lb of [28, 14]) FR.stacks[lb].forEach((w, i) => room.spot(`weight${lb}.${i}`, w, () => (onArbor.includes(w) ? `${lb} lb, on the arbor` : `${lb} lb weight`), w, {
    scope: VIEW, enabled: () => !solved() && !busy,
    onClick: () => {
      relock();
      // a weight still sliding counts where it came from (rapid clicks on a stack keep loading from that stack)
      const fromArbor = jobs.has(w) ? w.userData.flyFrom === 'arbor' : onArbor.includes(w);
      if (fromArbor) {
        // the top weight on the arbor goes home to its stack
        if (!onArbor.length) return;
        const top = onArbor.pop();
        onStack[lbOf(top)].push(top);
        save(); fly(top, 'arbor');
        return;
      }
      const stack = onStack[lb];
      if (!stack.length) return;
      if (onArbor.length >= MAX) { audio?.play('error', { gain: 0.3 }); dialogue.caption('stage.flyrail.full'); return; }
      const top = stack.pop();
      onArbor.push(top);
      save(); fly(top, 'stack');
    },
  }));

  room.spot('flyrail.lock', FR.lock, () => (armed ? 'Rope lock: UP' : 'Rope lock: DOWN (locked)'), FR.lock, {
    scope: VIEW, enabled: () => !solved() && !busy,
    onClick: () => {
      if (armed) { relock(); return; }
      audio?.play('ropeLock', { gain: 0.6 });
      leverTo(UNLOCKED);
      const t = total();
      if (t === TARGET) { armed = true; return; }
      run(t > TARGET ? 'heavy' : 'light');
    },
  });

  // ---- the purchase line: one pull ----------------------------------------------------------------------------------
  let pull = null;
  room.spot('flyrail.purchase', FR.purchase, 'Purchase line (pull)', FR.set.arbor, {
    scope: VIEW, enabled: () => !solved() && !busy,
    onDragStart: () => { pull = { done: false, moved: false }; },
    onDrag: (info) => {
      if (!pull || pull.done) return;
      if (Math.abs(info.totalDy) > 4) pull.moved = true;
      if (armed && info.totalDy >= innerHeight / 6) { pull.done = true; flyIn(); }
    },
    onDragEnd: () => {
      const p = pull; pull = null;
      if (!p || p.done || !p.moved) return;
      if (!armed) { ctx.characters?.pike?.react?.('shake'); dialogue.say('stage.flyrail.locked'); return; }
      audio?.play('ropeHaul', { gain: 0.3 });
      dialogue.caption('stage.flyrail.tug');
    },
    onClick: () => {
      if (!armed) { ctx.characters?.pike?.react?.('shake'); dialogue.say('stage.flyrail.locked'); return; }
      audio?.play('ropeHaul', { gain: 0.3 });
      dialogue.caption('stage.flyrail.tug');
    },
  });

  /** The cloth and the arbor (with its iron) move together: hem height y, arbor rise r. */
  const setLine = (hem, rise) => {
    BC.setY(hem);
    travel = rise;
    FR.setArborY(FR.arborY0 + rise);
    for (const w of onArbor) if (!jobs.has(w)) w.position.copy(homeOf(w));
  };
  const clothView = () => camera.refocus({ ...BC.focus, duration: 0.7 });

  async function flyIn() {
    if (busy || solved()) return;
    busy = true; armed = false;
    let locked = true;
    ctx.hotspots.lock();
    try {
      for (const [w, j] of jobs) { j.cancel?.(); jobs.delete(w); w.position.copy(homeOf(w)); }
      state.solve('flyrail');
      audio?.play('ropeHaul', { gain: 0.7 });
      clothView();
      const hem0 = BC.y;
      let creak = 0;
      await tween.run(3, (k) => {
        setLine(hem0 + (CLOTH.trim - hem0) * k, TRAVEL * k);
        if (k > creak + 0.3) { creak = k; audio?.play('ropeHaul', { gain: 0.35, pitch: 0.9 + k * 0.2 }); }
      }, { ease: 'inOutSine' });
      audio?.play('ropeLock', { gain: 0.7 });
      leverTo(LOCKED, 0.2);
      await room.wait(0.6);
      ctx.characters?.lavinia?.react?.('sad');
      await dialogue.say('stage.flyrail.solved');
      room.retargetHub?.(); // FIXED BY integration-qa: SET in → back to the footlights, where the wardrobe stair shows
      await camera.exitFocus({ all: true });
      await room.checkSet();
    } finally {
      if (locked) ctx.hotspots.unlock();
      busy = false;
      room.restore();
    }
  }

  async function run(kind) {
    busy = true;
    let locked = true;
    ctx.hotspots.lock();
    try {
      clothView();
      await room.wait(0.35);
      audio?.play('ropeRun', { gain: 0.8 });
      const hem0 = BC.y;
      if (kind === 'heavy') {
        // the cloth crashes in to the deck; the arbor shoots up its track
        await tween.run(0.75, (k) => setLine(hem0 + (CLOTH.crash - hem0) * k, (TRAVEL + 0.05) * k), { ease: 'inQuad' });
      } else {
        // the arbor drops to its stop and the empty batten flies out
        await tween.run(0.6, (k) => setLine(hem0 + 2.2 * k, -Math.min(0.26, FR.arborY0 - 0.04) * k), { ease: 'inQuad' });
      }
      camera.shake?.(0.05, 0.4);
      audio?.play('sandbagThud', { gain: 0.5 });
      ctx.characters?.pike?.react?.('flinch');
      await dialogue.say('stage.flyrail.running');
      await dialogue.say(kind === 'heavy' ? 'stage.flyrail.heavy' : 'stage.flyrail.light');
      await room.wait(2);
      // back to where it was stored; the lever drops and locks; the weights stay
      const hem1 = BC.y, rise1 = travel;
      await tween.run(1.4, (k) => setLine(hem1 + (CLOTH.out - hem1) * k, rise1 * (1 - k)), { ease: 'inOutSine' });
      audio?.play('ropeLock', { gain: 0.6 });
      await leverTo(LOCKED, 0.2);
      ctx.hotspots.unlock(); locked = false;
      if (camera.inFocus) await camera.refocus({ ...FR.focus, duration: 0.6 });
      room.wrong('flyrail');
    } finally {
      if (locked) ctx.hotspots.unlock();
      busy = false;
      armed = false;
    }
  }

  return {
    restore() {
      for (const [, j] of jobs) j.cancel?.();
      jobs.clear();
      leverJob?.cancel?.(); leverJob = null;
      if (!camera.inFocus || camera.focusPuzzle !== 'flyrail') { fillJob?.cancel?.(); fill.intensity = 0; }
      busy = false; armed = false; pull = null;
      // arbor contents from the save (solved and no list: four 28s)
      let list = state.get('stage.arbor', null);
      if (!Array.isArray(list)) list = solved() ? [28, 28, 28, 28] : [];
      onArbor = []; onStack[28] = []; onStack[14] = [];
      const used = { 28: 0, 14: 0 };
      for (const lb of list) { const w = FR.stacks[lb]?.[used[lb]]; if (!w) continue; used[lb]++; onArbor.push(w); }
      for (const lb of [28, 14]) FR.stacks[lb].forEach((w, i) => { if (i >= used[lb]) onStack[lb].push(w); });
      if (onArbor.length > MAX) onArbor.length = MAX;
      travel = solved() ? TRAVEL : 0;
      FR.setArborY(FR.arborY0 + travel);
      BC.setTrim(solved() ? 1 : 0);
      lever.rotation.x = LOCKED;
      placeAll();
      FR.setTotal(total());
    },
  };
}

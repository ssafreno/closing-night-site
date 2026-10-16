// poster (TEAR): six torn pieces of the last-night bill back into the TONIGHT frame (docs/rooms/foyer.md).
//   TONIGHT frame (room) → its close-up (dark: foyer.poster.dark; the first lit look says foyer.poster.top).
//   Drag a piece: it lifts upright under the pointer and travels in front of the frame. Dropped with its centre
//   within 6 cm of its true place (h.poster.snap, measured on the frame plane under the pointer) it snaps home
//   (pieceSnap; flag foyer.pieces, the placed indices) and stays; anywhere else it slides back to the floor, and the
//   3rd and every 3rd miss says foyer.poster.wrong.n. All six: the glass door swings shut, the bill opens as the paper
//   `lastnight`, foyer.poster.solved. Solve.
import * as THREE from 'three';

export default function poster(ctx, room, h) {
  const { state, dialogue, audio, tween, inventory, papers } = ctx;
  const solved = () => state.isSolved('poster');
  const VIEW = 'focus:poster';
  const P = h.poster;
  // puzzles-foyer: the frame's lower third (the bill's bottom row: cast list, review, prices) sat behind the dado panelling
  // and rail (their faces stand 4-7 cm proud of the wall). Bring the frame, its plate, its hit box and the pieces' places
  // forward to clear the rail.
  {
    const DZ = 0.075;
    for (const o of [P.object, P.plate, P.hit]) if (o) o.position.z += DZ;
    P.pieces.forEach((p) => { p.home.z += DZ; });
    h.lighting.refreshShadows();
  }
  const placed = () => new Set(solved() ? [0, 1, 2, 3, 4, 5] : (state.get('foyer.pieces') || []));
  let finishing = false;

  room.spot('poster', P.hit, 'TONIGHT frame', P.object, {
    onClick: () => {
      if (solved()) { papers.show('lastnight'); return; }
      room.focusOn(P.focus, VIEW, 'poster');
      if (!room.lit()) { dialogue.caption('foyer.poster.dark'); return; }
      if (!state.get('foyer.poster.topsaid')) { state.set('foyer.poster.topsaid', true); room.later(0.8, () => dialogue.say('foyer.poster.top')); }
    },
  });

  // ---- dragging a piece ------------------------------------------------------------------------------------------
  const plane = new THREE.Plane();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.03);
  const hit = new THREE.Vector3(), tmp = new THREE.Vector3();
  const local = (v) => room.group.worldToLocal(v);
  const world = (v) => room.group.localToWorld(v);
  const homeW = (p) => world(p.home.clone());
  let drag = null; // { p, moved, framePt }
  const jobs = new Map(); // piece index → its running snap / slide tween
  const stop = (i) => { const j = jobs.get(i); jobs.delete(i); j?.cancel?.(); };

  /** Where the dragged piece goes for this pointer ray: on the frame plane, or (low down) just above the floor. */
  const placeAlong = (p, ray) => {
    const hw = homeW(p);
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1).transformDirection(room.group.matrixWorld), hw);
    const tFrame = ray.distanceToPlane(plane);
    const tFloor = ray.direction.y < 0 ? ray.distanceToPlane(floor) : Infinity;
    if (tFrame == null || !isFinite(tFrame)) return null;
    ray.at(tFrame, hit);
    const framePt = local(hit.clone());
    // in front of the frame by a few mm (a piece already home sits behind it), never under the floor
    let t = tFrame - 0.01;
    const minY = p.size[1] * 0.5 + 0.02;
    if (tFloor != null && isFinite(tFloor)) {
      ray.at(t, tmp);
      if (local(tmp.clone()).y < minY) {
        // walk back along the ray until the piece's centre is high enough to stand on the floor
        const o = local(ray.origin.clone()), d = ray.direction.clone().transformDirection(new THREE.Matrix4().copy(room.group.matrixWorld).invert());
        if (d.y < -1e-4) t = Math.min(t, (minY - o.y) / d.y);
      }
    }
    ray.at(t, tmp);
    return { pos: local(tmp.clone()), framePt };
  };

  const setCast = (m, on) => { m.castShadow = on; h.lighting.refreshShadows(); };

  P.pieces.forEach((p, i) => room.spot(`poster.piece${i}`, p.mesh, 'Torn piece', p.mesh, {
    scope: VIEW,
    enabled: () => !solved() && room.lit() && !placed().has(i) && !finishing,
    onDragStart: (info) => {
      if (inventory.selected) return;
      stop(i);
      drag = { p, moved: 0, framePt: null, x: info.x, y: info.y };
      setCast(p.mesh, false);
      audio?.play('pickup', { gain: 0.15 });
    },
    onDrag: (info) => {
      if (!drag || drag.p !== p) return;
      drag.moved = Math.max(drag.moved, Math.hypot(info.x - drag.x, info.y - drag.y));
      if (drag.moved < 4) return;
      const at = placeAlong(p, info.ray);
      if (!at) return;
      drag.framePt = at.framePt;
      p.mesh.position.copy(at.pos);
      p.mesh.rotation.set(0, 0, 0);
    },
    onDragEnd: () => {
      if (!drag || drag.p !== p) return;
      const d = drag; drag = null;
      if (d.moved < 4 || !d.framePt) { setCast(p.mesh, true); return; } // a click: it stays where it lies
      const err = Math.hypot(d.framePt.x - p.home.x, d.framePt.y - p.home.y);
      if (err <= P.snap) snapHome(p, i);
      else slideBack(p, i);
    },
    onClick: () => audio?.play('pieceSnap', { gain: 0.12 }),
  }));

  const snapHome = (p, i) => {
    const from = p.mesh.position.clone();
    const list = [...placed()]; if (!list.includes(i)) list.push(i);
    state.set('foyer.pieces', list);
    audio?.play('pieceSnap', { gain: 0.8 });
    const job = tween.run(0.14, (k) => { p.mesh.position.lerpVectors(from, p.home, k); }, { ease: 'outQuad' });
    jobs.set(i, job);
    job.then(() => {
      if (jobs.get(i) === job) jobs.delete(i);
      p.setPlaced(1);
      setCast(p.mesh, true);
      if (list.length >= 6) complete();
    });
  };
  const slideBack = (p, i) => {
    const from = p.mesh.position.clone(), r0 = p.mesh.rotation.clone();
    p.setPlaced(0);
    const to = p.mesh.position.clone(), r1 = p.mesh.rotation.clone();
    p.mesh.position.copy(from); p.mesh.rotation.copy(r0);
    audio?.play('drop', { gain: 0.35 });
    const job = tween.run(0.45, (k) => {
      p.mesh.position.lerpVectors(from, to, k);
      p.mesh.rotation.set(r0.x + (r1.x - r0.x) * k, 0, r0.z + (r1.z - r0.z) * k);
    }, { ease: 'inOutSine' });
    jobs.set(i, job);
    job.then(() => { if (jobs.get(i) !== job) return; jobs.delete(i); p.setPlaced(0); setCast(p.mesh, true); });
    const n = state.inc('wrong.poster');
    if (n % 3 === 0) dialogue.auto(dialogue.cycle('foyer.poster.wrong'));
  };

  const complete = async () => {
    if (finishing || solved()) return;
    finishing = true;
    try {
      state.solve('poster');
      await room.wait(0.35);
      audio?.play('hutchDoor', { gain: 0.35, pitch: 1.4 });
      await tween.run(0.9, (k) => P.setDoor(P.doorOpen * (1 - k)), { ease: 'inOutSine' }); // POLISH: was 0.82
      audio?.play('latch', { gain: 0.5, pitch: 1.3 });
      await room.wait(0.4);
      await papers.show('lastnight');
      ctx.characters?.lavinia?.react?.('brow');
      await dialogue.say('foyer.poster.solved');
      room.checkHouse();
    } finally { finishing = false; }
  };

  return {
    restore() {
      drag = null; finishing = false;
      const set = placed();
      P.pieces.forEach((p, i) => { stop(i); p.setPlaced(set.has(i) ? 1 : 0); p.mesh.castShadow = true; });
      P.setDoor(solved() ? 0 : P.doorOpen); // POLISH: was 0.82
    },
  };
}

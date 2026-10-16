// mains (HUNT): Sparks's three fuses, fitted, and the switch thrown (docs/rooms/stage.md).
//   Mains box (room) → its close-up; Pike says stage.mains.pike on the first look. The electrician's tag → paper fusetag.
//   The fuses: fire bucket (fuse_r), the teacup on the props table (fuse_y), the fly-rail cleat (fuse_b). Each hiding
//   place is a big hotspot with the fuse's glint; it opens a small close-up where a click on the fuse takes it
//   (item.fuse_<c>.pickup). Any fuse used on the box (a carrier, or the box from the room) seats in its own colour
//   (fuseSeat). The big side handle: drag it down (or click it) from OFF (up) to ON (down), a 90° arc. All three seated →
//   knifeSwitch, the bulkheads clunk on in pairs (workLights), the dimmer hum joins, stage.mains.solved. Fewer → a fizz,
//   the handle springs back up, Room.wrong('mains'). Solve: `mains`.
import * as THREE from 'three';
import { burst } from '../../engine/props/particles.js';
import { halo } from '../../engine/props/theatre/common.js';

const FUSES = ['r', 'y', 'b'];
const OFF = Math.PI / 4, ARC = Math.PI / 2; // handle angle about its pivot: 45° up-and-out (OFF) → 45° down-and-out (ON)

export default function mains(ctx, room, h) {
  const { state, dialogue, audio, inventory, papers, camera, tween } = ctx;
  const lit = () => state.isSolved('ghostlight');
  const solved = () => state.isSolved('mains');
  const M = h.mains;
  const VIEW = 'focus:mains';
  const fuseState = (c) => state.get(`stage.fuse_${c}`, 'hidden');
  const seatedAll = () => FUSES.every((c) => fuseState(c) === 'seated');
  const fuseHere = (c) => fuseState(c) === 'hidden' && !inventory.has(`fuse_${c}`) && !solved();
  let busy = false;

  // the close-up framed wide enough for the whole box and the handle's full arc (SET's was a little too tight)
  M.focus = { position: new THREE.Vector3(7.12, 1.62, 1.42), lookAt: new THREE.Vector3(8.3, 1.52, 1.42), fov: 50 };
  // the handle swings in the plane of the box's side, out from the wall: up-and-out (OFF) to down-and-out (ON)
  let hk = 0;
  M.setHandle = (t) => { hk = t; M.handle.rotation.x = OFF + t * ARC; };
  Object.defineProperty(M, 'handleT', { get: () => hk, configurable: true });

  // the ghost-light look is dark away from the pool: the two blue running lights over the props table and the cleat
  // (and the bucket by the pass door's spill) are the hunt's lamps. A touch brighter so each hiding place reads.
  {
    const spill = h.lights.channels.get('spill');
    for (const l of spill?.lights || []) if (l.light.isPointLight && l.base < 2 && l.light.distance < 3) { l.base *= 1.9; l.light.distance = 3.2; }
    h.lights.fade('spill', h.lights.level('spill'), 0);
    // and each hiding place's glint, bigger, with a soft breathing halo (a child, so it shows and hides with the glint)
    // (sized for their distance from the vantage: the bucket ~7 m, the cup ~9 m, the cleat ~13 m across the stage)
    const tints = [[h.bucket, '#ffc890', 0.32, 0.085], [h.propsTable, '#fff0b0', 0.4, 0.1], [h.cleat, '#b8ccff', 0.8, 0.17]];
    tints.forEach(([o, tint, size, dot], i) => {
      const u = o.glint.material?.uniforms;
      if (u?.uSize) u.uSize.value = Math.max(u.uSize.value, dot);
      const g = halo(tint, size, 0.34);
      g.userData.keep = true;
      g.userData.update = (dt, t) => { g.material.opacity = 0.34 * (0.65 + 0.35 * Math.sin(t * 2.1 + i * 2)); };
      o.glint.add(g);
    });
  }

  const focusMains = () => camera.focus({ ...M.focus, scope: VIEW, puzzle: 'mains' });
  const firstLook = () => {
    if (state.get('stage.mains.pike.said')) return;
    state.set('stage.mains.pike.said', true);
    room.later(0.8, () => { ctx.characters?.pike?.react?.('point'); dialogue.say('stage.mains.pike'); });
  };

  // ---- seating a fuse -------------------------------------------------------------------------------------------
  const seatJobs = [null, null, null];
  function seat(c) {
    const i = FUSES.indexOf(c);
    inventory.remove(`fuse_${c}`);
    state.set(`stage.fuse_${c}`, 'seated');
    M.setSeated(i, true);
    const f = M.seated[i];
    const z0 = M.object.userData.slots[i].z - 0.012;
    seatJobs[i]?.cancel?.();
    f.position.z = z0 + 0.07;
    seatJobs[i] = tween.run(0.25, (k) => { f.position.z = z0 + 0.07 * (1 - k); }, { ease: 'inQuad' });
    seatJobs[i].then(() => audio?.play('fuseSeat', { gain: 0.7 }));
  }
  const fuseUses = Object.fromEntries(FUSES.map((c) => [`fuse_${c}`, () => {
    if (solved()) return false;
    if (!camera.inFocus || camera.focusPuzzle !== 'mains' || ctx.hotspots.scope !== VIEW) focusMains();
    firstLook();
    seat(c);
  }]));

  room.spot('mains', M.hit, 'Mains switch-fuse', M.object, {
    enabled: lit,
    useItem: fuseUses,
    onClick: () => { focusMains(); firstLook(); },
  });
  room.spot('mains.tag', M.tagHit, "Electrician's tag", M.object, {
    scope: ['room', VIEW], enabled: lit,
    onClick: () => papers.show('fusetag'),
  });
  M.slotHits.forEach((hit, i) => room.spot(`mains.slot.${FUSES[i]}`, hit, `${['Red', 'Yellow', 'Blue'][i]} carrier`, M.object, {
    scope: VIEW, enabled: () => lit() && !solved() && fuseState(FUSES[i]) !== 'seated',
    useItem: fuseUses,
    onClick: () => dialogue.caption('stage.mains.slot'),
  }));

  // ---- the handle --------------------------------------------------------------------------------------------------
  let drag = null;
  let handleJob = null;
  const setT = (t) => { handleJob?.cancel?.(); handleJob = null; M.setHandle(THREE.MathUtils.clamp(t, 0, 1)); };
  const animT = (to, dur, ease = 'inOutQuad') => {
    handleJob?.cancel?.();
    const from = hk;
    const job = tween.run(dur, (k) => M.setHandle(from + (to - from) * k), { ease });
    handleJob = job;
    return job;
  };
  room.spot('mains.handle', M.handleHit, () => (solved() ? 'Handle: ON' : 'Handle: OFF (pull down)'), M.handle, {
    scope: VIEW, enabled: () => lit() && !solved() && !busy,
    onDragStart: () => { drag = { t0: hk, moved: false }; },
    onDrag: (info) => {
      if (!drag) return;
      if (Math.abs(info.totalDy) > 4) drag.moved = true;
      setT(drag.t0 + info.totalDy / 280);
    },
    onDragEnd: () => {
      const d = drag; drag = null;
      if (!d || !d.moved) return;
      if (hk > 0.7) throwSwitch(); else { animT(0, 0.25, 'outBack'); }
    },
    onClick: () => throwSwitch(),
  });

  async function throwSwitch() {
    if (busy || solved()) return;
    busy = true;
    let locked = false;
    try {
      await animT(1, 0.22 * (1 - hk) + 0.05, 'inQuad');
      audio?.play('knifeSwitch', { gain: 0.8 });
      if (!seatedAll()) {
        // an arc and a fizz at the empty carriers, and the handle springs back up
        const p = new THREE.Vector3(); M.object.localToWorld(p.copy(M.object.userData.slots[1]));
        burst(ctx, room.group, [p.x, p.y, p.z], { color: '#bcd8ff', color2: '#ffffff', count: 50, radius: 0.25, duration: 0.6, size: 0.018 });
        audio?.play('dipSpark', { gain: 0.5 });
        await room.wait(0.25);
        await animT(0, 0.35, 'outBack');
        room.wrong('mains');
        return;
      }
      state.solve('mains');
      ctx.hotspots.lock(); locked = true;
      await room.wait(0.45);
      await camera.exitFocus({ all: true, duration: 0.8 });
      // the bulkheads come on in pairs: prompt side, O.P., the back wall, each with its fill
      const work = h.lights.channels.get('work');
      for (let i = 0; i < 3; i++) {
        audio?.play('workLights', { gain: 0.6, pitch: 1 - i * 0.06 });
        h.bulkheads.setPair(i, true);
        const fill = work?.lights[i];
        if (fill) fill.light.intensity = fill.base;
        await room.wait(0.38);
      }
      h.lights.fade('work', 1, 0); // the channel catches up with the pairs (no flicker)
      h.lights.setState('work', 0.7);
      room.loop('dimmerHum', { gain: 0.12, fade: 1.5 });
      await room.wait(0.5);
      ctx.characters?.lavinia?.react?.('sigh');
      await dialogue.say('stage.mains.solved');
    } finally {
      if (locked) ctx.hotspots.unlock();
      busy = false;
      if (solved()) room.restore();
    }
  }

  // ---- the hiding places --------------------------------------------------------------------------------------------
  const places = [
    ['bucket', h.bucket, 'r', 'Fire bucket', 'stage.delight.bucket'],
    ['cup', { ...h.propsTable, hit: h.propsTable.cupHit, object: h.propsTable.cup }, 'y', 'Teacup', 'stage.delight.propstable'],
    ['cleat', h.cleat, 'b', 'Cleat', null],
  ];
  for (const [id, o, c, label, delight] of places) {
    const scope = id === 'cup' ? ['room', 'focus:propstable'] : 'room';
    room.spot(id, o.hit, label, o.object, {
      scope,
      enabled: () => lit() && (fuseHere(c) || !!delight),
      onClick: () => {
        if (!fuseHere(c)) { dialogue.caption(delight); return; } // the delight, after the fuse
        camera.focus({ ...o.focus, scope: `focus:${id}`, puzzle: 'mains' });
      },
    });
    room.spot(`fuse_${c}`, o.fuse, `Fuse (${{ r: 'red', y: 'yellow', b: 'blue' }[c]} dot)`, o.fuse, {
      scope: `focus:${id}`, enabled: () => fuseHere(c),
      onClick: () => {
        inventory.add(`fuse_${c}`, { from: o.fuse });
        state.set(`stage.fuse_${c}`, 'held');
        o.fuse.visible = false; o.glint.visible = false;
        room.later(1.2, () => { if (camera.inFocus && ctx.hotspots.scope === `focus:${id}`) camera.exitFocus({ all: true }); });
      },
    });
  }
  room.spot('propstable', h.propsTable.hit, 'Props table', h.propsTable.object, {
    enabled: lit,
    onClick: () => {
      if (fuseHere('y')) { camera.focus({ ...h.propsTable.tableFocus, scope: 'focus:propstable', puzzle: 'mains' }); return; }
      dialogue.caption('stage.delight.propstable');
    },
  });

  return {
    restore() {
      drag = null; busy = false;
      handleJob?.cancel?.(); handleJob = null;
      seatJobs.forEach((j, i) => { j?.cancel?.(); M.seated[i].position.z = M.object.userData.slots[i].z - 0.012; });
      const spots = { r: h.bucket, y: h.propsTable, b: h.cleat };
      FUSES.forEach((c, i) => {
        const st = fuseState(c);
        const seated = solved() || st === 'seated';
        const here = !seated && st === 'hidden' && !inventory.has(`fuse_${c}`);
        spots[c].fuse.visible = here;
        spots[c].glint.visible = here && lit();
        M.setSeated(i, seated);
      });
      M.setHandle(solved() ? 1 : 0);
    },
  };
}

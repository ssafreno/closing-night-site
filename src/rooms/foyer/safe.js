// safe (TOOL): Crane's safe, the ear trumpet, the auditorium doors (docs/rooms/foyer.md).
//   Ear trumpet (cloakroom lost property, room click) → `ear_trumpet` (flag foyer.trumpet.taken).
//   Safe (room or the booth overview; dark → foyer.safe.dark) → its close-up; the first lit look says foyer.safe.date.
//   Dial: drag it round (snaps to whole numbers, safeDial per number, the readout shows the number at the index);
//   the left / right halves of the rim are −1 / +1 clicks. Centre knob: registers the number at the index (a tick).
//   `ear_trumpet` on the safe (any part of it) → the trumpet is pressed to the door (flag foyer.trumpet.on): from then on
//   a right next number gives safeTumbler + the bell's ripple, a wrong one a dull thud and an empty register
//   (this.wrong). Without it every registration is the same soft click and only a wrong third number clears the register.
//   14, 3, 31 registered → drag the handle down (or click it) → the door swings open (flag foyer.safeopen): the envelope
//   opens itself (foyer.safe.open, then the papers iou and contract, then foyer.contract) and `key_chain` goes to the
//   inventory. `key_chain` on the auditorium doors or the padlock → chainFall, the doors swing in, the trumpet goes
//   back to lost property, solve (foyer.safe.solved).
import * as THREE from 'three';

const COMBO = [14, 3, 31];

export default function safe(ctx, room, h) {
  const { state, inventory, dialogue, audio, camera, tween, papers, hotspots } = ctx;
  const solved = () => state.isSolved('safe');
  const isOpen = () => !!state.get('foyer.safeopen') || solved();
  const trumpetOn = () => !!state.get('foyer.trumpet.on') && !solved();
  const VIEW = 'focus:safe';
  const S = h.safe;
  // the open-safe close-up, a little lower than the SET's focusInside so the envelope on the floor of the safe clears the
  // dialogue box (puzzles-foyer)
  const INSIDE = (() => {
    S.object.updateWorldMatrix(true, false);
    const w = (x, y, z) => room.group.worldToLocal(S.object.localToWorld(new THREE.Vector3(x, y, z))).toArray();
    return { position: w(0.1, 0.68, 0.95), lookAt: w(0, 0.33, 0.0) };
  })();
  // puzzles-foyer: the register card and its ticks sat a few mm behind the door's face (invisible); bring them forward
  S.door.traverse((o) => { if (o.isMesh && o.geometry?.type === 'PlaneGeometry' && o.geometry.parameters.width === 0.15) o.position.z += 0.005; });
  S.ticks.forEach((t) => { t.position.z += 0.0075; });

  let reg = [];           // numbers registered this go
  let unlocked = false;   // three right numbers: the handle will turn
  let busy = false;       // the door / contents choreography
  let acc = 0;            // the dial, in numbers (continuous while dragging)
  let lastA = null;
  let lastClickAt = 0;

  // ---- the ear trumpet in lost property -----------------------------------------------------------------------
  room.spot('trumpet', h.earTrumpet.hit, 'Ear trumpet', h.earTrumpet.object, {
    enabled: () => h.earTrumpet.object.visible && !solved(),
    onClick: () => {
      state.set('foyer.trumpet.taken', true);
      h.earTrumpet.setPresent(false);
      h.earTrumpet.glint.material.opacity = 0;
      inventory.add('ear_trumpet', { from: h.earTrumpet.object }); // item.ear_trumpet.pickup: the LOST 14.3.31 tag
    },
  });

  // ---- the safe close-up ---------------------------------------------------------------------------------------
  const openView = () => {
    const p = room.focusOn(isOpen() ? INSIDE : S.focus, VIEW, 'safe');
    if (!state.get('foyer.safe.datesaid') && !isOpen()) {
      state.set('foyer.safe.datesaid', true);
      room.later(0.8, () => dialogue.say('foyer.safe.date'));
    }
    return p;
  };
  const applyTrumpet = () => {
    if (!room.lit()) { dialogue.caption('foyer.safe.dark'); return false; }
    if (isOpen() || trumpetOn()) return false;
    inventory.remove('ear_trumpet');
    state.set('foyer.trumpet.on', true);
    S.setTrumpet(true);
    audio?.play('pickup', { gain: 0.4 });
    audio?.play('latch', { gain: 0.25, pitch: 1.5 });
    if (hotspots.scope !== VIEW) openView();
    dialogue.caption('foyer.safe.trumpet');
    return true;
  };
  const withTrumpet = { ear_trumpet: () => { applyTrumpet(); } };

  room.spot('safe', S.object, 'Safe', S.object, { // the whole safe: the dial and handle stand proud of its hit box
    scope: ['room', 'focus:booth'],
    onClick: () => (room.lit() ? openView() : dialogue.caption('foyer.safe.dark')),
    useItem: { ...withTrumpet },
  });

  // ---- the dial: drag round its centre; the rim halves step −1 / +1 ----------------------------------------------
  const centreW = new THREE.Vector3();
  const centreScreen = () => {
    S.dial.getWorldPosition(centreW);
    const v = centreW.project(camera.camera);
    const r = ctx.renderer?.domElement?.getBoundingClientRect?.() || { left: 0, top: 0, width: innerWidth, height: innerHeight };
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  };
  const angleAt = (info) => {
    const c = centreScreen();
    const dx = info.x - c.x, dy = info.y - c.y;
    if (Math.hypot(dx, dy) < 8) return null;
    return Math.atan2(dy, dx);
  };
  const tick = () => {
    const now = performance.now();
    if (now - lastClickAt < 35) return;
    lastClickAt = now;
    audio?.play('safeDial', { gain: 0.35 });
  };
  const show = (n) => {
    const was = S.value;
    S.setDial(n);
    if (S.value !== was) tick();
  };
  const step = (k) => { if (busy || isOpen()) return; acc = Math.round(acc) + k; show(acc); };
  const dialDrag = {
    onDragStart: (info) => { if (inventory.selected || busy || isOpen()) return; acc = Math.round(acc); lastA = angleAt(info); },
    onDrag: (info) => {
      if (inventory.selected || busy || isOpen()) return;
      const a = angleAt(info);
      if (a == null) return;
      if (lastA == null) { lastA = a; return; }
      let d = a - lastA;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      lastA = a;
      // the numbers run clockwise round the dial: turning it clockwise (d > 0 on screen) brings lower numbers to the index
      acc -= d / (Math.PI * 2) * 100;
      show(Math.round(acc));
    },
    onDragEnd: () => { lastA = null; acc = Math.round(acc); show(acc); },
  };
  room.spot('safe.dial', S.dial, 'Dial', S.dial, {
    scope: VIEW, enabled: () => !isOpen(), ...dialDrag, useItem: { ...withTrumpet },
    onClick: () => {},
  });
  room.spot('safe.rimL', S.rimL, 'Dial (−1)', S.dial, { scope: VIEW, enabled: () => !isOpen(), ...dialDrag, onClick: () => step(-1), useItem: { ...withTrumpet } });
  room.spot('safe.rimR', S.rimR, 'Dial (+1)', S.dial, { scope: VIEW, enabled: () => !isOpen(), ...dialDrag, onClick: () => step(+1), useItem: { ...withTrumpet } });

  // ---- the centre knob: register the number at the index ---------------------------------------------------------
  const clearRegister = (delay) => room.later(delay, () => { reg = []; if (!unlocked && !isOpen()) S.setTicks(0); });
  const register = () => {
    if (busy || isOpen()) return;
    if (unlocked) { audio?.play('safeDial', { gain: 0.3 }); return; }
    const v = S.value;
    reg.push(v);
    S.setTicks(reg.length);
    const right = reg.every((n, i) => n === COMBO[i]);
    if (trumpetOn()) {
      if (right) {
        audio?.play('safeTumbler', { gain: 0.9 });
        S.ripple();
        if (reg.length === 3) unlocked = true;
      } else {
        audio?.play('sandbagThud', { gain: 0.22, pitch: 0.7 });
        reg = [];
        clearRegister(0.35);
        room.wrong('safe');
      }
      return;
    }
    audio?.play('safeDial', { gain: 0.6, pitch: 0.8 });
    if (reg.length < 3) return;
    if (right) { unlocked = true; return; }
    reg = [];
    clearRegister(0.5);
    room.later(0.5, () => room.wrong('safe'));
  };
  room.spot('safe.knob', S.knob, 'Centre knob', S.knob, {
    scope: VIEW, enabled: () => !isOpen(), onClick: register, useItem: { ...withTrumpet },
  });

  // ---- the handle: drag down to open -----------------------------------------------------------------------------
  let hT = 0, hDrag = false, hMoved = 0; // hMoved: onDragEnd's totals arrive as 0 (the press is cleared first), so keep our own
  const setH = (t) => { hT = t; S.setHandle(t); };
  const rattle = () => {
    audio?.play('latch', { gain: 0.5 });
    tween.run(0.3, (k) => setH(Math.sin(k * Math.PI) * 0.18));
  };
  room.spot('safe.handle', S.handle, 'Handle', S.handle, {
    scope: VIEW, enabled: () => !isOpen() && !busy, useItem: { ...withTrumpet },
    onDragStart: () => { hDrag = !inventory.selected; hMoved = 0; },
    onDrag: (info) => {
      if (!hDrag || busy) return;
      hMoved = Math.max(hMoved, Math.hypot(info.totalDx, info.totalDy));
      const t = THREE.MathUtils.clamp(info.totalDy / 110, 0, 1);
      setH(unlocked ? t : Math.min(t, 0.18));
    },
    onDragEnd: () => {
      if (!hDrag || busy) return;
      hDrag = false;
      if (hMoved < 6) return; // a click: onClick
      if (unlocked && hT > 0.55) { openDoor(); return; }
      const from = hT;
      tween.run(0.25, (k) => setH(from * (1 - k)), { ease: 'outQuad' });
      if (!unlocked) audio?.play('latch', { gain: 0.5 });
    },
    onClick: () => { if (unlocked) openDoor(); else rattle(); },
  });

  // ---- a little light inside the open safe (puzzles-foyer): the booth is unlit, the safe's insides were near black --
  const lamp = new THREE.PointLight('#ffd2a0', 0, 1.2, 1.5);
  lamp.name = 'puzzlesFoyerSafeLamp';
  room.group.add(lamp);
  {
    const a = new THREE.Vector3(...INSIDE.position), b = new THREE.Vector3(...INSIDE.lookAt);
    lamp.position.lerpVectors(a, b, 0.4);
  }
  room.animate((dt) => {
    const want = hotspots.scope === VIEW && isOpen() ? 1.6 : 0;
    lamp.intensity += (want - lamp.intensity) * Math.min(1, dt * 4);
    if (lamp.intensity < 0.01) lamp.intensity = 0;
  });

  // ---- open: the door, the envelope, the key ---------------------------------------------------------------------
  async function openDoor() {
    if (busy || isOpen()) return;
    busy = true;
    try {
      unlocked = false;
      state.set('foyer.safeopen', true);
      const from = hT;
      await tween.run(0.25, (k) => setH(from + (1 - from) * k), { ease: 'inQuad' });
      audio?.play('safeOpen', { gain: 0.9 });
      await room.wait(0.35);
      S.setTicks(0);
      camera.refocus?.({ ...INSIDE, duration: 1.2 });
      await tween.run(1.3, (k) => S.setOpen(k), { ease: 'inOutSine' });
      await room.wait(0.2);
      await contents();
    } finally { busy = false; }
  }
  /** The takings envelope opens itself: the IOU, the contract, Lavinia on her birthday; then the key. */
  async function contents() {
    if (!state.get('foyer.envelope.taken')) {
      await dialogue.say('foyer.safe.open');
      state.set('foyer.envelope.taken', true);
      S.setContents({ envelope: false, key: S.keyTag.visible });
      audio?.play('page', { gain: 0.6 });
      await papers.show('iou');
      await papers.show('contract');
      ctx.characters?.lavinia?.react?.('hairPat');
      await dialogue.say('foyer.contract');
    }
    takeKey();
  }
  function takeKey() {
    if (state.get('foyer.key.taken') || solved()) return;
    state.set('foyer.key.taken', true);
    inventory.add('key_chain', { from: S.keyTag }); // item.key_chain.pickup
    S.setContents({ envelope: S.envelope.visible, key: false });
  }
  room.spot('safe.envelope', S.envelope, 'Envelope', S.envelope, {
    scope: VIEW, enabled: () => isOpen() && S.envelope.visible && !busy,
    onClick: async () => { busy = true; try { await contents(); } finally { busy = false; } },
  });
  room.spot('safe.key', S.keyTag, 'Key', S.keyTag, {
    scope: VIEW, enabled: () => isOpen() && S.keyTag.visible && !busy,
    onClick: () => takeKey(),
  });

  // ---- the auditorium doors: chain, padlock, notice ----------------------------------------------------------------
  const A = h.auditorium;
  // puzzles-foyer: the doorway's "dark beyond" plane must stay its own mesh (the SET hides it when the doors open); left
  // to mergeStatic it was baked into the static set and blacked out the lit house through the open doors
  for (const o of A.object.children) if (o.isMesh && o.geometry?.type === 'PlaneGeometry' && o.material?.color?.getHexString?.() === '050404') o.userData.keep = true;
  let unlocking = false;
  const unlock = async () => {
    if (unlocking || solved()) return;
    unlocking = true;
    try {
      inventory.remove('key_chain');
      state.solve('safe');
      if (hotspots.scope !== 'focus:auddoors') {
        if (camera.inFocus) await camera.exitFocus({ all: true, duration: 0.5 });
        await camera.focus({ ...A.focus, scope: 'focus:auddoors' });
      }
      audio?.play('keyTurn', { gain: 0.8 });
      await room.wait(0.5);
      audio?.play('chainFall', { gain: 0.9 });
      A.setFallen(true);
      await room.wait(0.6);
      audio?.play('doorsOpen', { gain: 0.9 });
      await tween.run(1.8, (k) => A.setOpen(k), { ease: 'inOutSine' });
      if (state.isSolved('houseboard')) h.house.set(1, true); // the glow now pours through, not under
      // the trumpet goes back to lost property
      h.earTrumpet.setPresent(true);
      S.setTrumpet(false);
      state.set('foyer.trumpet.on', false);
      ctx.characters?.lavinia?.react?.('gesture');
      // FIXED BY qa-foyer: "the dark auditorium" contradicted a house already lit by the house board
      const lit = state.isSolved('houseboard') && dialogue.has('foyer.safe.solved.lit');
      await dialogue.say(lit ? 'foyer.safe.solved.lit' : 'foyer.safe.solved');
      room.checkHouse();
    } finally { unlocking = false; }
  };
  const withKey = { key_chain: () => { unlock(); } };
  room.spot('auddoors', A.hit, 'Auditorium doors', null, {
    onClick: () => {
      if (solved()) { room.focusOn(A.focus, 'focus:auddoors'); return; }
      room.focusOn(A.focus, 'focus:auddoors', 'safe');
      dialogue.caption('foyer.doors.locked');
    },
    useItem: { ...withKey },
  });
  room.spot('padlock', A.lockHit, 'Padlock', A.lock, {
    scope: ['room', 'focus:auddoors'], enabled: () => !solved(),
    onClick: () => { room.focusOn(A.lockFocus, 'focus:padlock', 'safe'); dialogue.caption('foyer.doors.locked'); },
    useItem: { ...withKey },
  });
  room.spot('notice', A.noticeHit, 'Notice', A.notice, {
    scope: ['room', 'focus:auddoors'],
    onClick: () => dialogue.auto('foyer.delight.notice'),
    useItem: { ...withKey },
  });

  return {
    restore() {
      busy = false; unlocking = false; unlocked = false; reg = [];
      const open = isOpen();
      acc = S.value; S.setDial(acc);
      S.setOpen(open ? 1 : 0); setH(open ? 1 : 0); S.setTicks(0);
      S.setContents({
        envelope: !state.get('foyer.envelope.taken') && !solved(),
        key: !(inventory.has('key_chain') || state.get('foyer.key.taken') || solved()),
      });
      const home = solved() || !(inventory.has('ear_trumpet') || state.get('foyer.trumpet.taken'));
      h.earTrumpet.setPresent(home);
      S.setTrumpet(trumpetOn());
      A.setOpen(solved() ? 1 : 0);
      A.setFallen(solved());
    },
  };
}

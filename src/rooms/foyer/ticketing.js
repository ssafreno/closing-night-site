// ticketing (DEDUCE): one ticket for the Royal Box, for Bartholomew (docs/rooms/foyer.md).
//   Ticket machine (room or the booth overview; dark → foyer.boxoffice.dark) → its close-up. Five wheels AREA · ROW ·
//   PRICE · DAY · MONTH (year 1931 cast in): click the upper half of a wheel for the label above, the lower half for the
//   label below (comboWheel; flag foyer.machine, the indices). Start: STALLS / C / 3/6 / 13 MAR.
//   Side handle: drag it down (or click it) → ticketPrint, a card ticket slides out of the slot printed with the
//   settings. Wrong: Lavinia's line for the first failing field (area not BOX → foyer.ticketing.notbox, or
//   .notbox.gallery for GALLERY; BOX but not A → .wrongbox; price not £1 1s → .price; date not 14 MAR → .date), then it
//   tears itself in half and is gone; the wheels stay. Right (BOX / A / £1 1s / 14 MAR) → `ticket` to the inventory.
//   `ticket` on Bartholomew (index.js: the cat's useItem → room.giveTicket) → he wakes, stretches, takes it in his mouth,
//   purrs, pads out of the box office, across the foyer and up the grand staircase past Lavinia, gone at the top.
//   foyer.ticketing.solved. Solve.
import * as THREE from 'three';
import { TICKET_WHEELS } from './props.js';

const RIGHT = { area: 'BOX', letter: 'A', price: '£1 1s', day: '14', month: 'MAR' };

export default function ticketing(ctx, room, h) {
  const { state, dialogue, audio, camera, tween, inventory } = ctx;
  const solved = () => state.isSolved('ticketing');
  const VIEW = 'focus:machine';
  const Mc = h.machine;
  let printing = false;
  // the close-up, stepped back from the SET's so the side handle is in frame with the wheels (puzzles-foyer)
  const VIEWPOSE = (() => {
    const p = Mc.focus.position, l = Mc.focus.lookAt;
    const off = [0, 0.05, -0.035]; // up a little and toward the handle side
    return { position: p.map((v, i) => l[i] + (v - l[i]) * 1.12 + off[i]), lookAt: l.map((v, i) => v + off[i]) };
  })();

  room.spot('machine', Mc.object, 'Ticket machine', Mc.object, { // the whole machine: wheels and handle stand proud of its hit box
    scope: ['room', 'focus:booth'],
    onClick: room.inBooth(() => room.focusOn(VIEWPOSE, VIEW, 'ticketing')),
  });

  // ---- the wheels ----------------------------------------------------------------------------------------------
  const save = () => state.set('foyer.machine', Mc.values.slice());
  const turn = (i, k) => {
    if (printing) return;
    Mc.setWheel(i, Mc.values[i] + k);
    audio?.play('comboWheel', { gain: 0.45 });
    save();
  };
  Mc.wheels.forEach((w, i) => {
    const t = TICKET_WHEELS[i].title;
    const label = `${t[0]}${t.slice(1).toLowerCase()} wheel`;
    // the labels run upward on the drum (D above C, APR above MAR): the upper half brings the label above
    room.spot(`machine.up${i}`, Mc.up[i], label, w, { scope: VIEW, onClick: () => turn(i, +1) });
    room.spot(`machine.down${i}`, Mc.down[i], label, w, { scope: VIEW, onClick: () => turn(i, -1) });
  });

  // ---- the side handle: pull → print -----------------------------------------------------------------------------
  const fields = () => {
    const f = {};
    TICKET_WHEELS.forEach((def, i) => { f[def.id] = def.labels[Mc.values[i]]; });
    return f;
  };
  /** The script key for the first field that is wrong, or null for the right ticket. */
  const verdict = (f) => {
    if (f.area !== RIGHT.area) return f.area === 'GALLERY' && dialogue.has('foyer.ticketing.notbox.gallery') ? 'foyer.ticketing.notbox.gallery' : 'foyer.ticketing.notbox';
    if (f.letter !== RIGHT.letter) return 'foyer.ticketing.wrongbox';
    if (f.price !== RIGHT.price) return 'foyer.ticketing.price';
    if (f.day !== RIGHT.day || f.month !== RIGHT.month) return 'foyer.ticketing.date';
    return null;
  };
  let hT = 0, hDrag = false, hMoved = 0; // hMoved: onDragEnd's totals arrive as 0 (the press is cleared first), so keep our own
  const setH = (t) => { hT = t; Mc.setHandle(t); };
  const print = async () => {
    if (printing) return;
    printing = true;
    try {
      if (hT < 0.99) { const from = hT; await tween.run(0.22 * (1 - from) + 0.05, (k) => setH(from + (1 - from) * k), { ease: 'inQuad' }); }
      audio?.play('ratchet', { gain: 0.4 });
      if (inventory.has('ticket') || solved()) { // one ticket per patron
        tween.run(0.35, (k) => setH(1 - k), { ease: 'outQuad' });
        dialogue.caption('foyer.ticketing.onlyone');
        return;
      }
      const f = fields();
      Mc.setTicketFields(f);
      Mc.tear(0);
      audio?.play('ticketPrint', { gain: 0.9 });
      tween.run(0.35, (k) => setH(1 - k), { ease: 'outQuad' });
      await tween.run(0.8, (k) => Mc.setTicket(k), { ease: 'outCubic' });
      await room.wait(1.0); // a moment to read it before anyone reads it aloud
      const wrong = verdict(f);
      if (wrong) {
        state.inc('wrong.ticketing');
        await dialogue.say(wrong);
        audio?.play('page', { gain: 0.7, pitch: 1.4 });
        await tween.run(0.45, (k) => Mc.tear(k), { ease: 'outQuad' });
        await room.wait(0.25);
        Mc.setTicket(0); Mc.tear(0);
        return;
      }
      state.set('foyer.ticket.printed', true);
      inventory.add('ticket', { from: Mc.ticket }); // item.ticket.pickup: the ticket's own words
      Mc.setTicket(0);
    } finally { printing = false; }
  };
  room.spot('machine.handle', Mc.handleHit, 'Side handle', Mc.handle, {
    scope: VIEW,
    onDragStart: () => { hDrag = !inventory.selected && !printing; hMoved = 0; },
    onDrag: (info) => {
      if (!hDrag || printing) return;
      hMoved = Math.max(hMoved, Math.hypot(info.totalDx, info.totalDy));
      setH(THREE.MathUtils.clamp(info.totalDy / 100, 0, 1));
    },
    onDragEnd: () => {
      if (!hDrag) return;
      hDrag = false;
      if (hMoved < 6) return; // a click: onClick
      if (hT > 0.6) { print(); return; }
      const from = hT;
      tween.run(0.25, (k) => setH(from * (1 - k)), { ease: 'outQuad' });
    },
    onClick: () => { print(); },
  });

  // ---- Bartholomew takes his ticket ------------------------------------------------------------------------------
  room.giveTicket = async () => {
    if (room._catBusy || solved() || !inventory.has('ticket')) return;
    const cat = ctx.characters?.cat;
    room._catBusy = true;
    let follow = null;
    try {
      inventory.remove('ticket');
      state.solve('ticketing'); // from here on a reload has him gone to the Royal Box
      await room.focusOn(h.booth.focus, 'focus:booth');
      const eye = new THREE.Vector3(); camera.camera.getWorldPosition(eye);
      cat?.lookAt?.(eye);
      await cat?.react?.('wake');
      await cat?.react?.('stretch');
      cat?.react?.('perk');
      await room.wait(0.6); // he sniffs it
      // he takes it, delicately
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.032), new THREE.MeshStandardMaterial({ color: '#e8c890', roughness: 0.85, side: THREE.DoubleSide }));
      card.name = 'catTicket';
      if (cat?.head) { card.position.set(0.0, -0.05, 0.075); card.rotation.set(-1.2, 0.5, 0.1); cat.head.add(card); }
      audio?.play('pickup', { gain: 0.2 });
      audio?.play('catPurr', { gain: 0.8 });
      cat?.react?.('slowBlink');
      await room.wait(1.2);
      cat?.lookAt?.(null);
      // he leaves: back to the room to watch him go, the view following him
      await camera.exitFocus({ all: true, duration: 0.9 });
      const w = new THREE.Vector3();
      follow = room.animate(() => { if (!cat?.group?.parent || camera.inFocus) return; cat.group.getWorldPosition(w); w.y += 0.3; camera.lookAtPoint(w); });
      // one leg of the walk; the next starts as he arrives instead of after he has sat down
      const leg = (to, duration) => new Promise((resolve) => {
        const p = cat.moveTo(to, { duration });
        const job = cat._walk;
        let stop = () => {};
        const done = () => { stop(); resolve(); };
        if (job) stop = room.animate(() => { if (cat._walk !== job || job.stage === 2 || !cat.group.parent) done(); });
        p.then(done);
      });
      const path = h.perches.catPath;
      let said = null;
      for (let k = 0; k < path.length && cat?.moveTo; k++) {
        if (!cat.group.parent) break; // the player left mid-walk: enter() has already sent him to his box
        const from = cat.group.position, to = path[k];
        const dist = Math.hypot(to[0] - from.x, to[1] - from.y, to[2] - from.z);
        if (k === 5) { ctx.characters?.lavinia?.react?.('bow'); said = dialogue.say('foyer.ticketing.solved'); }
        await leg(to, k === 0 ? 0.7 : Math.max(0.5, dist / 1.6));
      }
      card.removeFromParent(); card.geometry.dispose(); card.material.dispose();
      cat?.remove?.();
      follow?.(); follow = null;
      camera.resetLook();
      await (said || dialogue.say('foyer.ticketing.solved'));
      room.checkHouse();
    } finally {
      follow?.();
      room._catBusy = false;
    }
  };

  return {
    restore() {
      printing = false; hDrag = false;
      const mv = state.get('foyer.machine');
      if (Array.isArray(mv)) mv.forEach((v, i) => Mc.setWheel(i, v, true));
      setH(0); Mc.setTicket(0); Mc.tear(0);
    },
  };
}

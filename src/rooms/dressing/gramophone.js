// gramophone (STROBE): her own voice. Use the winder on the gramophone (it winds itself three turns), click the tone arm
// to drop the needle, drag the speed lever along its arc until the tester's 78 ring stands still; held 1 s with the
// needle down → she sings along with her 1912 self, story beat 3, the jewel case glints under the chaise.
// docs/rooms/dressing.md › gramophone.
// State: `dressing.gramophone.wound`, `dressing.gramophone.notch` (0..12; 6 = 78 rpm), `dressing.gramophone.note.seen`,
// `solved.gramophone`. The needle always restores up.
import * as THREE from 'three';
import { scope, beat, react, sing, rayAtY } from './util.js';

const SCOPE = scope('gramophone');
const TRUE_NOTCH = 6; // 78 rpm
const SOLVE_HOLD = 1.0, WRONG_HOLD = 2.0;
// "Burn, Old Lamp": the first phrase, as she sings it live (true pitch: F major)
const PHRASE = [[72, 2], [69, 1], [77, 3], [74, 1], [77, 1], [74, 1], [72, 3], [67, 1], [70, 1], [76, 1], [77, 2], [69, 1], [72, 1], [76, 1], [79, 1], [77, 3]];

export default function gramophone(ctx, room, h) {
  const { hotspots, state, dialogue, audio, camera, inventory } = ctx;
  const G = h.gramophone;
  const keep = (o) => { if (o) o.userData.keep = true; return o; };
  const solved = () => state.isSolved('gramophone');
  const wound = () => !!state.get('dressing.gramophone.wound') || solved();
  const open = () => camera.focus({ ...G.focus, scope: SCOPE, puzzle: 'gramophone' });

  let winding = false, finishing = false;
  let needleDown = false; // arm on the record and the platter turning
  let settled = 0, fired = false; // seconds on the current notch with the needle down; its line said

  // ---- winding -----------------------------------------------------------------------------------------------------
  const wind = async () => {
    if (wound() || winding) return;
    winding = true;
    inventory.remove('winder');
    state.set('dressing.gramophone.wound', true);
    if (!camera.inFocus) open();
    audio?.play('gramophoneWind', { gain: 0.8 });
    await G.wind(3);
    winding = false;
  };
  const useWinder = { winder: () => { wind(); return true; } };
  const unwound = () => dialogue.caption('dressing.gramophone.unwound', { scope: SCOPE });

  hotspots.add({
    id: 'dressing.gramophone', object: G.hit, label: 'Gramophone', highlight: keep(G.object),
    onClick: open, useItem: useWinder,
  });
  hotspots.add({
    id: 'dressing.gramophone.socket', object: G.socket.hit, label: () => (wound() ? 'Winding handle' : 'Crank socket'), highlight: keep(G.object), scope: SCOPE,
    useItem: useWinder,
    onClick: () => { if (!wound()) unwound(); },
  });
  hotspots.add({
    id: 'dressing.gramophone.platter', object: G.platter.hit, label: 'Record', highlight: keep(G.spin), scope: SCOPE,
    useItem: useWinder,
    onClick: () => { if (!wound()) unwound(); else if (!needleDown) armClick(); },
  });

  // ---- the needle --------------------------------------------------------------------------------------------------
  const playSpeed = () => G.NOTCHES[G.notch];
  const startRecord = () => room.loop('record', { speed: playSpeed(), gain: 0.9 });
  const hum = () => { // her live note: the tonic, held, which the record has to agree with
    if (!solved()) sing(audio, [[65, 3.2]], { q: 0.5, gain: 0.3, vibrato: 18 });
  };
  async function armClick() {
    if (finishing || solved()) return;
    if (!wound()) { unwound(); return; }
    if (winding) return;
    if (!needleDown) {
      needleDown = true; settled = 0; fired = false;
      audio?.play('needleDrop', { gain: 0.8 });
      const drop = G.dropNeedle();
      await drop;
      if (!needleDown) return; // lifted again meanwhile
      G.setPlaying(true);
      startRecord();
      if (!state.get('dressing.gramophone.note.seen')) {
        state.set('dressing.gramophone.note.seen', true);
        react(ctx, 'gesture');
        dialogue.say('dressing.gramophone.note');
      }
      room.later(1.2, hum);
    } else {
      needleDown = false;
      G.setPlaying(false);
      room.stopLoop('record', 0.3);
      audio?.play('needleDrop', { gain: 0.3, pitch: 1.3 });
      G.liftNeedle();
    }
  }
  hotspots.add({
    id: 'dressing.gramophone.arm', object: G.arm.hit, label: () => (needleDown ? 'Lift the needle' : 'Tone arm'), highlight: keep(G.arm.object), scope: SCOPE,
    enabled: () => !solved() && !finishing,
    onClick: armClick, useItem: useWinder,
  });

  // ---- the speed lever ---------------------------------------------------------------------------------------------
  const deckY = (() => { const v = new THREE.Vector3(0, G.object.userData.deckY ?? 0.146, 0); G.object.updateMatrixWorld(true); return G.object.localToWorld(v).y; })();
  const tmp = new THREE.Vector3();
  const setNotch = (n) => {
    n = Math.max(0, Math.min(12, n));
    if (n === G.notch) return;
    const dir = Math.sign(n - G.notch);
    // one click per notch passed
    for (let k = G.notch + dir, i = 0; k !== n + dir; k += dir, i++) audio?.play('leverNotch', { gain: 0.35, pitch: 1.3, delay: i * 0.03 });
    G.setNotch(n);
    settled = 0; fired = false;
    if (needleDown && G.playing) startRecord();
  };
  const leverAt = (info) => {
    const p = info.point || rayAtY(info.ray, deckY, tmp);
    if (p) setNotch(G.notchAt(p));
  };
  // The arc is short on screen (a notch every few pixels if the knob followed the pointer exactly), so the drag is
  // geared: sideways travel, one notch per PX_PER_NOTCH, right = FAST. The knob lags the pointer, the clicks don't.
  const PX_PER_NOTCH = 12;
  let leverDrag = false, leverFrom = 0;
  hotspots.add({
    id: 'dressing.gramophone.lever', object: G.lever.hit, label: 'Speed lever (SLOW … FAST)', highlight: keep(G.lever.object), scope: SCOPE,
    enabled: () => !solved() && !finishing,
    onDragStart: () => { leverDrag = true; leverFrom = G.notch; },
    onDrag: (info) => { if (leverDrag) setNotch(leverFrom + Math.round(info.totalDx / PX_PER_NOTCH)); },
    onDragEnd: () => { leverDrag = false; state.set('dressing.gramophone.notch', G.notch); if (needleDown) room.later(0.5, hum); },
    onClick: (info) => { leverAt(info); state.set('dressing.gramophone.notch', G.notch); },
    useItem: useWinder,
  });

  // ---- listening: held at 78 → solved; settled elsewhere → her verdict --------------------------------------------
  room.animate((dt) => {
    if (!needleDown || !G.playing || finishing || solved() || leverDrag) return;
    settled += dt;
    if (G.notch === TRUE_NOTCH) { if (settled >= SOLVE_HOLD) success(); return; }
    if (fired || settled < WRONG_HOLD || dialogue.busy) return;
    fired = true;
    const rpm = G.NOTCHES[G.notch];
    if (rpm < 78) { react(ctx, 'shake'); dialogue.say('dressing.gramophone.low'); } else if (rpm === 80) { room.wrong('gramophone'); } else { react(ctx, 'shake'); dialogue.say('dressing.gramophone.high'); }
  });

  async function success() {
    finishing = true;
    state.solve('gramophone');
    state.set('dressing.gramophone.notch', TRUE_NOTCH);
    // the record and her live voice lock into unison: she sings along with her 1912 self
    // (the needle jumps back to the top of the side, so the two of her start the phrase together)
    room.stopLoop('record', 0.06);
    audio?.play('needleDrop', { gain: 0.2, pitch: 1.4 });
    room.loop('record', { speed: 78, gain: 1 });
    ctx.companion?.lookAt?.(null);
    react(ctx, 'flourish');
    ctx.companion?.talk?.(true);
    const dur = sing(audio, PHRASE.slice(0, 11), { q: 0.5, gain: 0.5, delay: 0.07 }) || 0;
    await ctx.tween.delay(Math.max(8, dur));
    ctx.companion?.talk?.(false);
    room.loop('record', { speed: 78, gain: 0.45 }); // the bed under what she says
    react(ctx, 'bow');
    await dialogue.say('dressing.gramophone.solved');
    await beat(ctx, [
      ['dressing.story.3a', 'sigh'],
      ['dressing.story.3b', 'sad'],
      ['dressing.story.3c', 'brow'],
    ]);
    // the needle comes up; back in the room, something red glints under the chaise
    needleDown = false;
    room.stopLoop('record', 1.5);
    G.liftNeedle().then(() => G.setPlaying(false));
    h.jewelcase.setVisible(true);
    h.jewelcase.setGlint(1);
    if (camera.inFocus) await camera.exitFocus({ all: true });
    // the vantage turns, gently, toward the chaise: the case is off the default view
    try { const p = new THREE.Vector3(); h.jewelcase.object.getWorldPosition(p); camera.lookAtPoint?.(p); } catch (e) { /* stay put */ }
    audio?.play('chime', { gain: 0.4 });
    dialogue.caption('dressing.jewelcase.reveal');
    finishing = false;
  }

  return {
    restore() {
      winding = false; finishing = false; needleDown = false; settled = 0; fired = false; leverDrag = false;
      G.setWound(wound());
      G.setNotch(solved() ? TRUE_NOTCH : (state.get('dressing.gramophone.notch') ?? 2));
      G.setArm(0); G.setPlaying(false);
    },
    stop() { needleDown = false; G.setPlaying(false); G.setArm(0); },
  };
}

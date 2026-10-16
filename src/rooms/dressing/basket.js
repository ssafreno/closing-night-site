// basket (LIGHT): Crane's telegram, burned whole. After the mirror is lit, the basket gives up its ash onto the writing
// slope; drag the slope up into the 32-48° band (POLISH: was 35-45) (the print is legible there under the mirror bulbs) and click the
// sheet → `crane`, story beat 1. docs/rooms/dressing.md › basket.
// State: `dressing.ashout`, `dressing.slope` (degrees), `dressing.basket.first.seen`, `solved.basket`.
import { scope, beat } from './util.js';

const SCOPE = scope('slope');
const DEG_PER_PX = 0.22; // the full 0-60° in ~270 px

export default function basket(ctx, room, h) {
  const { hotspots, state, dialogue, papers, audio, camera } = ctx;
  const S = h.slope, B = h.basket;
  const keep = (o) => { if (o) o.userData.keep = true; return o; };
  const solved = () => state.isSolved('basket');
  const toSlope = () => camera.focus({ ...S.focus, scope: SCOPE, puzzle: 'basket' });

  // ---- the basket ------------------------------------------------------------------------------------------------
  let lifting = false;
  hotspots.add({
    id: 'dressing.basket', object: B.hit, label: 'Waste-paper basket', highlight: keep(B.object),
    onClick: async () => {
      if (!state.isSolved('mirror')) { // no light to read ash by yet: look in, and she says so
        camera.focus({ ...B.focus, scope: scope('basket'), puzzle: 'basket' });
        dialogue.say('dressing.basket.dark');
        return;
      }
      if (state.get('dressing.ashout') || solved()) { toSlope(); return; }
      if (lifting) return;
      lifting = true;
      toSlope();
      let ready = Promise.resolve();
      if (!state.get('dressing.basket.first.seen')) { state.set('dressing.basket.first.seen', true); ready = dialogue.say('dressing.basket.first'); }
      ready.then(() => {
        dialogue.say('dressing.basket.lift');
        audio?.play('ashRustle', { gain: 0.6 });
        state.set('dressing.ashout', true);
        S.liftAsh().then(() => { lifting = false; });
      });
    },
  });

  // ---- the slope: drag it up and down ----------------------------------------------------------------------------
  let drag = null, lastRustle = -1, lastAngle = 0;
  const setAngle = (deg) => {
    deg = Math.max(0, Math.min(S.MAX, deg));
    S.setAngle(deg);
    const now = performance.now();
    if (Math.abs(deg - lastAngle) > 0.5 && now - lastRustle > 260) { lastRustle = now; audio?.play('ashRustle', { gain: 0.3 }); }
    lastAngle = deg;
  };
  const dragSpec = {
    onDragStart: () => { if (solved()) return; drag = { from: S.angle(), moved: false }; lastAngle = S.angle(); },
    onDrag: (info) => {
      if (!drag) return;
      if (Math.hypot(info.totalDx, info.totalDy) > 6) drag.moved = true;
      setAngle(drag.from - info.totalDy * DEG_PER_PX); // up the screen props it up
    },
    onDragEnd: () => { if (!drag) return; drag = null; state.set('dressing.slope', Math.round(S.angle() * 10) / 10); },
  };

  hotspots.add({ id: 'dressing.slope', object: S.hit, label: 'Writing slope', highlight: keep(S.object), onClick: toSlope });
  hotspots.add({
    id: 'dressing.slope.board', object: S.board, label: () => (solved() ? 'Writing slope' : 'Writing slope (drag to tilt)'),
    highlight: keep(S.board), scope: SCOPE, ...dragSpec,
    onClick: () => {},
  });

  // ---- the ash sheet ---------------------------------------------------------------------------------------------
  const read = async () => {
    if (solved()) { await papers.show('crane'); return; }
    state.solve('basket');
    state.set('dressing.slope', 40);
    // the sheet rests at its legible angle from now on
    const a0 = S.angle();
    ctx.tween.run(0.4, (k) => S.setAngle(a0 + (40 - a0) * k), { ease: 'inOutCubic' });
    await papers.show('crane');
    // she answers the telegram first; the narrator closes the beat
    beat(ctx, [
      ['dressing.story.1a', 'brow'],
      ['dressing.story.1b', 'sad'],
      ['dressing.story.1c', 'chest'],
    ]);
    dialogue.say('dressing.basket.solved');
  };
  // in the room, the sheet on the slope is a way into the close-up
  hotspots.add({
    id: 'dressing.slope.ash', object: S.ash.hit, label: 'Burnt telegram', highlight: keep(S.ash.object),
    enabled: () => S.ash.object.visible, onClick: toSlope,
  });
  hotspots.add({
    id: 'dressing.slope.ash.read', object: S.ash.hit, label: () => (S.ash.legible() || solved() ? 'Burnt telegram' : 'Burnt telegram (drag to tilt)'),
    highlight: keep(S.ash.object), scope: SCOPE, enabled: () => S.ash.object.visible && !lifting, ...dragSpec,
    onClick: () => {
      if (S.ash.legible() || solved()) { read(); return; }
      room.wrong('basket', { caption: true });
    },
  });

  return {
    restore() {
      const out = solved() || !!state.get('dressing.ashout');
      S.setAsh(out);
      S.ash.object.position.y = 0; S.ash.object.rotation.z = 0; S.ash.object.scale.setScalar(1);
      S.setAngle(solved() ? 40 : (state.get('dressing.slope') ?? 0));
      lastAngle = S.angle(); drag = null; lifting = false;
    },
  };
}

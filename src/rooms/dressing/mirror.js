// mirror (MIRROR): Dot's card. Tilt the swing mirror upright (drag up past -40°), turn it one stop left with the left
// wing-nut, and click Dot's card in the glass → `beginners`. docs/rooms/dressing.md › mirror.
// State: `dressing.mirror` = { upright, stop }, `dressing.mirror.dot.seen`, `dressing.mirror.up.seen`,
// `dressing.mirror.door.seen`, `solved.mirror`.
import { scope, react } from './util.js';

const SCOPE = scope('mirror');
const DEG_PER_PX = 0.42; // a ~190 px drag lifts it from face-down to upright

export default function mirror(ctx, room, h) {
  const { hotspots, state, dialogue, papers, audio, camera } = ctx;
  const M = h.mirror;
  const keep = (o) => { if (o) o.userData.keep = true; return o; };
  const save = () => state.set('dressing.mirror', { upright: M.isUpright(), stop: M.stop() });

  const open = () => {
    camera.focus({ ...M.focus, scope: SCOPE, puzzle: 'mirror' });
    if (!state.get('dressing.mirror.dot.seen')) { state.set('dressing.mirror.dot.seen', true); dialogue.say('dressing.mirror.dot'); }
  };

  // ---- standing it up -------------------------------------------------------------------------------------------
  let busy = false, drag = null;
  const standUp = async () => {
    busy = true;
    audio?.play('mirrorPivot', { gain: 0.8 });
    const up = M.stand();
    room.later(0.3, () => audio?.play('mirrorBulbs', { gain: 0.7 }));
    await up;
    busy = false;
    save();
    if (!state.get('dressing.mirror.up.seen')) {
      state.set('dressing.mirror.up.seen', true);
      await dialogue.say('dressing.mirror.noreflection');
      react(ctx, 'hairPat');
      dialogue.say('dressing.mirror.lighting');
    }
  };
  const fallBack = async (said = true) => {
    busy = true;
    await M.fall();
    audio?.play('mirrorPivot', { gain: 0.5, pitch: 0.8 });
    busy = false;
    save();
    if (said) dialogue.caption('dressing.mirror.wrong.1', { scope: SCOPE });
  };

  hotspots.add({
    // on the whole mirror (the face-down back covers the frame proxy); its wing-nuts, card and telegrams are more specific
    id: 'dressing.mirror', object: M.object, label: 'Mirror', highlight: keep(M.object),
    onClick: open,
  });
  // in the close-up, the face-down mirror is a drag handle (the upright glass belongs to the card and the telegrams)
  hotspots.add({
    id: 'dressing.mirror.tilt', object: M.object, label: 'Mirror (drag it up)', highlight: keep(M.frame), scope: SCOPE,
    enabled: () => !M.isUpright() && !busy,
    onDragStart: () => { drag = { from: M.tilt(), moved: false }; },
    onDrag: (info) => {
      if (!drag || busy) return;
      if (Math.hypot(info.totalDx, info.totalDy) > 6) drag.moved = true;
      M.setTilt(drag.from - info.totalDy * DEG_PER_PX); // up the screen = up off the table
    },
    onDragEnd: () => {
      if (!drag || busy) { drag = null; return; }
      const moved = drag.moved; drag = null;
      if (!moved) return; // a plain click: onClick
      if (M.tilt() > M.SNAP) standUp(); else fallBack(true);
    },
    // a click on the face-down mirror: it lifts a hand's breadth and settles (it wants dragging)
    onClick: async () => {
      if (busy || M.isUpright()) return;
      busy = true;
      audio?.play('mirrorPivot', { gain: 0.35, pitch: 1.2 });
      for (let k = 0; k <= 1; k += 0.1) { M.setTilt(-80 + 14 * Math.sin(Math.PI * k)); await ctx.tween.delay(0.03); }
      M.setTilt(-80);
      busy = false;
    },
  });

  // ---- turning it --------------------------------------------------------------------------------------------------
  const turn = (dir) => {
    if (!M.isUpright()) return;
    const next = Math.max(-2, Math.min(2, M.stop() + dir));
    if (next === M.stop()) { audio?.play('mirrorPivot', { gain: 0.25, pitch: 1.4 }); return; } // on its stop already
    audio?.play('mirrorPivot', { gain: 0.6, pitch: 1.1 });
    M.turn(dir); // M.stop() is the new stop at once, so rapid clicks add up
    save();
    if (next === -2 && !state.isSolved('mirror') && !state.get('dressing.mirror.door.seen')) {
      state.set('dressing.mirror.door.seen', true);
      room.later(0.45, () => dialogue.say('dressing.mirror.door'));
    }
  };
  hotspots.add({ id: 'dressing.mirror.wingL', object: M.wingL, label: 'Left wing-nut', highlight: keep(M.wingLNut), scope: SCOPE, enabled: () => M.isUpright(), onClick: () => turn(-1) });
  hotspots.add({ id: 'dressing.mirror.wingR', object: M.wingR, label: 'Right wing-nut', highlight: keep(M.wingRNut), scope: SCOPE, enabled: () => M.isUpright(), onClick: () => turn(+1) });

  // ---- Dot's card, read in the glass ---------------------------------------------------------------------------
  hotspots.add({
    id: 'dressing.mirror.card', object: M.cardHit, label: "Dot's card", highlight: keep(M.glass), scope: SCOPE,
    enabled: () => M.cardVisible(),
    onClick: async () => {
      const first = !state.isSolved('mirror');
      if (first) state.solve('mirror');
      await papers.show('beginners');
      if (first) { react(ctx, 'glove'); dialogue.say('dressing.mirror.solved'); }
    },
  });

  return {
    restore() {
      const m = state.get('dressing.mirror', null) || {};
      const solved = state.isSolved('mirror');
      const up = solved || !!m.upright;
      M.setStop(solved ? -1 : (m.stop ?? 0), { instant: true });
      if (up) M.stand({ instant: true }); else M.setTilt(-80);
      busy = false; drag = null;
    },
  };
}

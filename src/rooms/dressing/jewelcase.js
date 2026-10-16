// jewelcase (COMBO): the year is none of your business. Four number wheels (start 1-9-0-0), click the upper or lower
// half of a wheel to roll it, press the clasp button to try. 1877 → the lid lifts on the music box; the last page
// flies to the inventory and opens; "Well. Places, then."; dressing.done; THE SCRIPT ticks.
// docs/rooms/dressing.md › jewelcase.
// State: `dressing.wheels` ([4]), `solved.jewelcase` (set as the page is taken, so solved ⇔ `lastpage` held/used).
import { scope, react } from './util.js';

const SCOPE = scope('jewelcase');
const CODE = [1, 8, 7, 7];

export default function jewelcase(ctx, room, h) {
  const { hotspots, state, dialogue, papers, audio, camera, inventory, journal } = ctx;
  const J = h.jewelcase;
  const keep = (o) => { if (o) o.userData.keep = true; return o; };
  const solved = () => state.isSolved('jewelcase');
  let opening = false;

  hotspots.add({
    // FIXED BY qa-dressing: on the whole case; the lid's top sat at the proxy's depth and a click on it did nothing
    id: 'dressing.jewelcase', object: J.object, label: 'Jewel case', highlight: keep(J.object),
    enabled: () => J.object.visible,
    onClick: () => {
      J.setGlint(0); state.set('dressing.jewel.seen', true);
      if (solved()) camera.focus({ ...J.focusOpen, scope: SCOPE, puzzle: 'jewelcase' });
      else camera.focus({ ...J.focus, scope: SCOPE, puzzle: 'jewelcase' });
    },
  });

  const save = () => state.set('dressing.wheels', J.values());
  J.wheelHits.forEach((w, i) => {
    const roll = (d) => () => {
      if (solved() || opening) return;
      audio?.play('jewelWheel', { gain: 0.9 });
      J.step(i, d);
      save();
    };
    // the digit above the window rolls down into it (up = +1), the one below rolls up (down = -1)
    hotspots.add({ id: `dressing.jewel.wheel${i}.up`, object: w.up, label: 'Wheel (roll down)', highlight: false, scope: SCOPE, enabled: () => !solved(), onClick: roll(+1) });
    hotspots.add({ id: `dressing.jewel.wheel${i}.down`, object: w.down, label: 'Wheel (roll up)', highlight: false, scope: SCOPE, enabled: () => !solved(), onClick: roll(-1) });
  });

  const takePage = async () => {
    if (solved()) return;
    state.solve('jewelcase');
    inventory.add('lastpage', { from: J.page.object, line: false });
    J.page.setVisible(false);
    await papers.show('lastpage');
    react(ctx, 'sigh');
    await dialogue.say('dressing.jewelcase.solved');
    react(ctx, 'flourish');
    const done = dialogue.say('dressing.done');
    journal.deliver('script');
    await done;
  };

  hotspots.add({
    id: 'dressing.jewel.button', object: J.button.hit, label: 'Clasp button', highlight: keep(J.button.object), scope: SCOPE,
    enabled: () => !solved() && !opening,
    onClick: async () => {
      J.pressButton();
      const v = J.values(), s = v.join('');
      if (s === CODE.join('')) {
        opening = true;
        room.stopLoop('record', 0.8);
        audio?.play('latch', { gain: 0.7 });
        await ctx.tween.delay(0.25);
        audio?.play('musicBox', { gain: 0.8 });
        J.open();
        await camera.refocus({ ...J.focusOpen, duration: 1.0 });
        await ctx.tween.delay(0.6); // spare pearls, a pressed lily, the folded last page
        opening = false;
        await takePage();
        return;
      }
      // a wrong year: the buzz, the wheels stay where they are
      if (s === '1900') { audio?.play('error', { gain: 0.4 }); react(ctx, 'laugh'); dialogue.say('dressing.jewelcase.1900'); return; }
      if (s === '0204' || s === '0402') { audio?.play('error', { gain: 0.4 }); react(ctx, 'brow'); dialogue.say('dressing.jewelcase.date'); return; }
      room.wrong('jewelcase'); // its own buzz, and wrong.n on the 1st, 3rd, 6th …
    },
  });

  hotspots.add({
    id: 'dressing.jewel.page', object: J.page.hit, label: 'The last page', highlight: keep(J.page.object), scope: SCOPE,
    enabled: () => J.page.object.visible && J.object.userData.inner.visible && !opening,
    onClick: takePage,
  });

  return {
    restore() {
      opening = false;
      J.setVisible(state.isSolved('gramophone'));
      // it glints under the valance until it has been looked at
      J.setGlint(state.isSolved('gramophone') && !solved() && !state.get('dressing.jewel.seen') ? 1 : 0);
      const wheels = state.get('dressing.wheels', null);
      J.setValues(solved() ? CODE : (Array.isArray(wheels) && wheels.length === 4 ? wheels : [1, 9, 0, 0]));
      J.setLid(solved() ? 1 : 0);
      J.page.setVisible(!(solved() || inventory.has('lastpage')));
    },
  };
}

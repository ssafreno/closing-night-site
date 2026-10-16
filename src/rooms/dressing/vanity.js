// vanity (SEQDOC): her beginners. Open the four drawers in Dot's order (glove, pearl, feather, lily); out of order every
// open drawer slams shut. All four → the hidden fifth drawer springs from the apron: Pike's note (opens), story beat 2,
// the winder. docs/rooms/dressing.md › vanity.
// State: `dressing.vanity.ritual.seen`, `dressing.note.taken`, `dressing.winder.taken`, `solved.vanity`. A partial
// sequence is not saved (the drawers always restore shut).
import { scope, beat, react } from './util.js';

const SCOPE = scope('drawers');
const ORDER = ['glove', 'pearl', 'feather', 'lily'];

export default function vanity(ctx, room, h) {
  const { hotspots, state, dialogue, papers, audio, camera, inventory } = ctx;
  const DR = h.drawers, SEC = DR.secret;
  const keep = (o) => { if (o) o.userData.keep = true; return o; };
  const solved = () => state.isSolved('vanity');
  const secretOut = () => SEC.object.position.z > 0.05;

  hotspots.add({
    id: 'dressing.drawers', object: DR.hit, label: 'Drawers', highlight: keep(DR.object),
    onClick: () => camera.focus({ ...DR.focus, scope: SCOPE, puzzle: 'vanity' }),
  });

  let step = 0; // how many of the ritual are open, in order
  let springing = false;

  const takeWinder = () => {
    if (state.get('dressing.winder.taken')) return;
    state.set('dressing.winder.taken', true);
    inventory.add('winder', { from: SEC.winder.object });
    SEC.winder.setVisible(false);
  };
  const readNote = async () => {
    state.set('dressing.note.taken', true);
    SEC.note.setVisible(false);
    await papers.show('pikenote');
  };

  const success = async () => {
    springing = true;
    state.solve('vanity');
    await ctx.tween.delay(0.35);
    audio?.play('secretDrawer', { gain: 0.8 });
    react(ctx, 'gasp');
    await SEC.open();
    await ctx.tween.delay(0.7); // the folded note and the handle, in the drawer
    springing = false;
    await readNote();
    await beat(ctx, [
      ['dressing.story.2a', 'sad'],
      ['dressing.story.2b', 'sigh'],
      ['dressing.story.2c', 'shrug'],
    ]);
    await dialogue.say('dressing.vanity.solved');
    takeWinder();
  };

  DR.items.forEach((d, i) => {
    hotspots.add({
      // FIXED BY qa-dressing: on the whole drawer, not just its front box (a click on the enamel plaque or a knob, the
      // obvious places to click, hit those sibling meshes first and did nothing)
      id: `dressing.drawer.${d.kind}`, object: d.object, label: `Drawer (${d.kind})`, highlight: keep(d.object), scope: SCOPE,
      onClick: () => {
        if (springing) return;
        if (!state.get('dressing.vanity.ritual.seen')) { state.set('dressing.vanity.ritual.seen', true); dialogue.say('dressing.vanity.ritual'); }
        if (solved()) { // afterwards they are only drawers
          audio?.play('drawerSlide', { gain: 0.5 });
          if (d.isOpen()) d.close(); else d.open();
          return;
        }
        if (ORDER[step] === d.kind) {
          audio?.play('drawerSlide', { gain: 0.6 });
          d.open();
          step++;
          if (step === ORDER.length) success();
          return;
        }
        if (d.isOpen()) return; // already out, in order: leave it
        // out of order: every open drawer slams back (at once, so a quick next click is never undone by a late slam)
        step = 0;
        audio?.play('drawerThunk', { gain: 0.8 });
        DR.slamAll();
        d.setOpen(0.08); d.close(true); // the wrong one jolts in its runners
        room.wrong('vanity');
      },
    });
  });

  hotspots.add({
    id: 'dressing.secret.note', object: SEC.note.hit, label: "Harold's note", highlight: keep(SEC.note.object), scope: ['room', SCOPE],
    enabled: () => SEC.note.object.visible && secretOut() && !springing,
    onClick: () => readNote(),
  });
  hotspots.add({
    id: 'dressing.secret.winder', object: SEC.winder.hit, label: 'Winding handle', highlight: keep(SEC.winder.object), scope: ['room', SCOPE],
    enabled: () => SEC.winder.object.visible && secretOut() && !springing,
    onClick: () => takeWinder(),
  });

  return {
    restore() {
      step = 0; springing = false;
      DR.shutAll();
      SEC.setOpen(solved() ? 1 : 0);
      SEC.note.setVisible(!state.get('dressing.note.taken'));
      SEC.winder.setVisible(!(state.get('dressing.winder.taken') || inventory.has('winder') || state.get('dressing.gramophone.wound') || state.isSolved('gramophone')));
    },
  };
}

// thunder (HUNT): the beater (docs/rooms/pit.md).
//   Dust sheets (index.js delights) slide off on click and stay off (pit.sheets); sheet 4 hides the drum kit with the
//   padded beater lying on the bass drum (it glints once the sheet is off). The beater (click) → inventory `mallet`
//   (pit.mallet.taken; item.mallet.pickup).
//   Thunder sheet (trap-room view or its close-up, focus:pit.thunder), clicked with no beater: a "tink" and a barely
//   there shake. The first time: the narrator's pit.thunder.tink, then Pike's pit.thunder.pike. After that each one is a
//   room.wrong('thunder') (pit.thunder.wrong.n on the 1st, 3rd … of those).
//   `mallet` used on the thunder sheet (either view): the camera moves to the sheet, a long roll (thunderSheet 'roll'),
//   the sheet swings and the flash box fires, the camera shakes; Lavinia shrieks, then pit.thunder.solved ("I was doing
//   a bit."); the beater hangs on its hook by the sheet (consumed); solve('thunder'); room.checkStorm().
//   After the solve the sheet is the `thunderagain` delight.
import * as THREE from 'three';
import { glint } from '../wardrobe/props.js';

export default function thunder(ctx, room, h) {
  const { state, dialogue, audio, inventory, camera, hotspots } = ctx;
  const T = h.thunder, MAL = h.mallet;
  const TRAP = 'focus:pit.trap', VIEW = 'focus:pit.thunder';
  const solved = () => state.isSolved('thunder');
  let busy = false;

  // the beater glints on the bass drum once its sheet is off (2 triangles)
  const gl = glint({ size: 0.09, phase: 0.7 });
  gl.position.set(0, 0.03, 0);
  MAL.group.add(gl);
  const syncGlint = () => gl.userData.setOn(MAL.place === 'drum' && h.sheets[3].isOff());
  room.animate(() => syncGlint());

  // ---- the beater ------------------------------------------------------------------------------------------------------
  room.spot('mallet', MAL.proxy, 'Padded beater', MAL.group, {
    enabled: () => MAL.place === 'drum' && h.sheets[3].isOff(),
    onClick: () => {
      const from = MAL.group.getWorldPosition(new THREE.Vector3());
      MAL.setPlace('gone');
      state.set('pit.mallet.taken', true);
      audio?.play('snareTap', { gain: 0.2 });
      inventory.add('mallet', { from });
    },
  });

  // ---- the sheet -------------------------------------------------------------------------------------------------------
  const openSheet = () => (camera.inFocus && hotspots.scope === VIEW ? Promise.resolve() : camera.focus({ ...T.focus, scope: VIEW, puzzle: 'thunder' }));

  const tink = () => {
    T.tink();
    audio?.thunderSheet ? audio.thunderSheet('tink', { gain: 0.7 }) : audio?.play('thunderSheet', { kind: 'tink' });
    const n = state.inc('pit.thunder.tinks');
    if (n === 1) {
      dialogue.caption('pit.thunder.tink');
      room.later(1.4, () => { ctx.characters?.pike?.react?.('point'); dialogue.say('pit.thunder.pike'); });
    } else room.wrong('thunder');
  };

  const strike = async () => {
    if (busy || solved()) return;
    busy = true;
    try {
      inventory.deselect?.();
      await openSheet();
      inventory.remove('mallet');
      state.solve('thunder');
      // the beater swings in, the long roll, the flash
      T.boom();
      audio?.thunderSheet ? audio.thunderSheet('roll', { gain: 1 }) : audio?.play('thunderSheet', { kind: 'roll' });
      camera.shake?.(0.02, 1.2);
      room.later(0.9, () => h.flash.lightning());
      await room.wait(0.6);
      ctx.characters?.lavinia?.react?.('shriek');
      await room.wait(1.6);
      MAL.setPlace('hook');
      audio?.play('success', { gain: 0.4 });
      await dialogue.say('pit.thunder.solved');
      await room.checkStorm();
    } finally { busy = false; }
  };

  room.spot('thunder', T.proxy, 'Thunder sheet', T.sheet, {
    scope: [TRAP, VIEW],
    onClick: async () => {
      if (solved()) { room._thunderAgain(); return; }
      if (hotspots.scope !== VIEW) await openSheet();
      tink();
    },
    useItem: { mallet: () => { strike(); } },
  });

  return {
    restore() { busy = false; syncGlint(); },
  };
}

// ENGINE test room 2: the wing. Exists so _test has somewhere to go: two doors back, a different arrival vantage, a
// looseEnd line (the key left in the jar), and the companion following the player between rooms.
import * as THREE from 'three';
import { Room } from '../../engine/Room.js';
import * as F from '../../engine/props/furniture.js';
import * as Lt from '../../engine/props/lights.js';
import { makeTextPlane } from '../../engine/props/text.js';
import { registerTestContent } from './index.js';

export default class TestWing extends Room {
  static id = '_test2';
  static title = 'The Wing';
  static vantage = { position: [0, 1.6, 1.8], lookAt: [0, 1.3, -1], yawLimit: 70, pitchLimit: 25 };
  static puzzleOrder = [];
  static nudgeSeconds = null; // nothing to be stuck on here

  async build() {
    const { ctx } = this;
    registerTestContent(ctx);
    const G = this.group;
    this.background = new THREE.Color('#07090c');
    this.exposure = 0.95;
    G.add(F.roomShell({ w: 4, d: 4.5, h: 3.4, wainscot: 0.8, beams: 2 }));
    G.add(Lt.ambientRig({ hemi: 0.4, ambientIntensity: 0.3 }));
    const lamp = Lt.flickerLight({ color: '#9fc0ff', intensity: 3, distance: 6 });
    lamp.position.set(0, 2.8, 0);
    G.add(lamp);
    const sign = makeTextPlane('THE WING', { width: 0.9, font: '64px "Abril Fatface", Georgia, serif', color: '#f0e3c4', bg: '#3a1a1e' });
    sign.position.set(0, 2.4, -2.23);
    G.add(sign);
    const back = F.door({ frame: 'wood' });
    back.position.set(-0.8, 0, -2.23);
    G.add(back);
    this.addDoor({ id: 'wing.back', object: back, to: '_test', label: 'Back to the rehearsal room' });
    const stuck = F.door({ frame: 'stone' });
    stuck.position.set(0.9, 0, -2.23);
    G.add(stuck);
    this.addDoor({ id: 'wing.stuck', object: stuck, to: '_nowhere', label: 'A door to a room nobody has built' });
  }

  looseEnd() {
    const { state, inventory } = this.ctx;
    const left = !state.get('_test.key.taken') && !inventory.has('key_brass') && !state.isSolved('test_drawer');
    return left ? 'loose._test2.key' : null;
  }

  vantageFor(from) {
    return from === '_test' ? this.constructor.vantage : { ...this.constructor.vantage, position: [0.6, 1.6, 1.4] };
  }

  enter() {
    const { characters, state, dialogue } = this.ctx;
    characters.lavinia.placeAt(this.group, { position: [1.2, 0, -0.6], rotationY: -0.6 });
    if (!state.get('_test2.enter.seen')) { state.set('_test2.enter.seen', true); this.later(0.6, () => dialogue.say('_test2.enter')); }
  }
}

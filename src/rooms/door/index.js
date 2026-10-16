// The Stage Door & Green Room (docs/rooms/door.md): the game's first room. SET-door built the set (set.js, props.js),
// the delights and the doors; PUZZLES-door wired the four puzzles, one file each (hutch → meter → keypress → signin).
// See docs/notes/set-door.md and docs/notes/puzzles-door.md.
import * as THREE from 'three';
import { Room } from '../../engine/Room.js';
import { mergeStatic } from '../../engine/props/util.js';
import { buildSet, VANTAGE } from './set.js';
import hutch from './hutch.js';
import meter from './meter.js';
import keypress from './keypress.js';
import signin from './signin.js';

export default class DoorRoom extends Room {
  static id = 'door';
  static title = 'Stage Door';
  static vantage = { ...VANTAGE, yawLimit: 70, pitchLimit: 25 };
  static puzzleOrder = []; // from src/content/manifest.js: hutch, meter, keypress, signin
  static nudgeSeconds = 90;
  static glintSeconds = 150;

  async build() {
    const { ctx } = this;
    const { hotspots, state, dialogue, papers, inventory, audio } = ctx;
    const S = (k, f) => state.get(k, f);
    const solved = (p) => state.isSolved(p);

    // ---- look -----------------------------------------------------------------------------------------------
    this.background = new THREE.Color('#070505');
    this.fog = null;
    this.envIntensity = 0.28;
    this.exposure = 1.08;
    this.bloom = { strength: 0.42, threshold: 0.82, radius: 0.5 };
    this.cssVignette = 0.35;

    const h = buildSet(ctx, this.group);
    this.h = h;

    // keep(): an object that glows on hover must stay its own mesh (mergeStatic would swallow it)
    const keep = (o) => { if (o) o.userData.keep = true; return o; };
    /** A hotspot on a proxy box (or any object) that highlights `glow`. */
    const spot = (id, object, label, glow, opts = {}) => hotspots.add({ id: `door.${id}`, object, label, highlight: glow ? keep(glow) : true, ...opts });
    const lit = () => solved('meter');
    const inHutch = () => solved('hutch');

    // =====================================================================================================
    // PUZZLES (one file each: hutch → meter → keypress → signin). Each registers its hotspots and returns { restore }.
    // =====================================================================================================
    this.spot = spot;
    this.keep = keep;
    this.lit = lit;
    this.inHutch = inHutch;
    this.giveStartKit();
    this.puzzles = [hutch, meter, keypress, signin].map((fn) => fn(ctx, this, h));

    // the stage door: locked all game (a delight)
    this.addDoor({
      id: 'door.stagedoor', object: h.stageDoor.hit, to: 'street', highlight: keep(h.stageDoor.leaf),
      label: 'Stage door', isOpen: () => false,
      onLocked: () => { audio?.play('latch', { gain: 0.5 }); dialogue.caption('door.delight.stagedoor'); },
    });

    // =====================================================================================================
    // DELIGHTS and small things
    // =====================================================================================================
    // the lilac glow: the first click is Lavinia's note, after that she gives hints
    spot('glow', h.glow.hit, 'Light under the door', h.glow.strip, {
      enabled: () => !solved('signin'),
      onClick: () => {
        if (!S('door.note.heard')) { state.set('door.note.heard', true); dialogue.say('door.enter.note'); return; }
        ctx.hints.ask();
      },
    });
    spot('window', h.hutchWindow.hit, 'Hutch window', h.hutchWindow.object, {
      label: () => (inHutch() ? "Doorkeeper's hutch" : 'Hutch window'),
      // once the half-door is open the window is the way back into the hutch close-up
      onClick: () => (inHutch() ? this.focusOn(h.hutchDoor.focus, 'focus:hutch', 'meter') : dialogue.caption('door.hutch.window')),
    });
    spot('kettle', h.kettle.hit, 'Kettle', h.kettle.object, {
      onClick: () => {
        if (!lit()) { dialogue.caption('door.delight.kettle_cold'); return; }
        if (h.kettle.boiling()) return;
        h.kettle.boil(8);
        audio?.play('kettleBoil', { gain: 0.6 });
        this.later(8, () => { audio?.play('kettleWhistle', { gain: 0.5 }); dialogue.say('door.delight.kettle'); });
      },
    });
    const PIGEON = { THRUSH: 'pigeon_thrush', PIKE: 'pigeon_pike', CRANE: 'pigeon_crane', CAT: 'pigeon_cat' };
    for (const s of h.pigeonholes.slots) {
      spot(`pigeon.${s.name.toLowerCase()}`, s.hit, `${s.name[0]}${s.name.slice(1).toLowerCase()}'s pigeonhole`, h.pigeonholes.object, {
        onClick: () => { audio?.play('pickup', { gain: 0.15 }); dialogue.caption(PIGEON[s.name] ? `door.delight.${PIGEON[s.name]}` : dialogue.cycle('door.delight.pigeon_other')); },
      });
    }
    spot('wireless', h.wireless.hit, 'Wireless', h.wireless.object, {
      enabled: inHutch, scope: ['room', 'focus:hutch'],
      onClick: () => {
        if (!lit()) { dialogue.caption('door.delight.wireless_off'); return; }
        h.wireless.setOn(1); audio?.play('wireless', { gain: 0.6 });
        dialogue.caption('door.delight.wireless');
        this.later(5, () => h.wireless.setOn(0));
      },
    });
    spot('sofa', h.sofa.hit, 'Sofa', h.sofa.object, { onClick: () => { audio?.play('sofaSpring', { gain: 0.6 }); dialogue.caption('door.delight.sofa'); } });
    h.photos.forEach((p, i) => spot(`photo_${i + 1}`, p.hit, 'Photograph', p.object, { onClick: () => dialogue.caption(`door.delight.photo_${i + 1}`) }));
    spot('dartboard', h.dartboard.hit, 'Dartboard', h.dartboard.object, {
      onClick: async () => { await h.dartboard.throw(); audio?.play('sandbagThud', { gain: 0.35 }); dialogue.caption('door.delight.dartboard'); },
    });
    spot('quiet', h.quiet.hit, 'QUIET PLEASE', h.quiet.object, { onClick: () => dialogue.caption('door.delight.quiet') });
    spot('exit', h.exit.hit, 'EXIT', h.exit.object, { onClick: () => dialogue.caption('door.delight.exit') });
    // FIXED BY qa-door: the ledge bell (it shines like a glint) and Pike's pencil on a string were silent props
    const LEDGE = ['room', 'focus:ledger', 'focus:hutch'];
    spot('bell', h.ledgeBell.hit, 'Bell', h.ledgeBell.object, {
      scope: LEDGE, onClick: () => { audio?.play('chime', { gain: 0.35 }); dialogue.caption('door.delight.bell'); },
    });
    spot('pencil', h.ledgePencil.hit, 'Pencil on a string', h.ledgePencil.object, { scope: LEDGE, onClick: () => dialogue.caption('door.delight.pencil') });

    // the pen is for the sign-in book only: anywhere else in this room it is "an inspector, not a vandal"
    for (const hs of hotspots._map.values()) {
      if (!hs.id.startsWith('door.') || hs.useItem?.pen || hs.acceptsAnyItem) continue;
      hs.useItem = { ...(hs.useItem || {}), pen: () => { dialogue.caption('item.pen.wrong'); return false; } };
    }

    // =====================================================================================================
    // STATE RESTORE (a reload lands here mid-room)
    // =====================================================================================================
    this.restore();
    // re-apply whenever the save changes underneath (PUZZLES may call this too after its own solves)
    state.on?.('reset', () => this.restore());

    // merge the static set (hotspot objects and keep()-flagged movers are left alone)
    mergeStatic(this.group, [], { hotspots });
  }

  /** Visual state from ctx.state (instant). Safe to call any time. Each puzzle restores its own pieces. */
  restore() {
    const { state } = this.ctx;
    const h = this.h;
    h.lights.setLit(state.isSolved('meter'), { instant: true });
    h.wireless.setOn(0);
    for (const p of this.puzzles || []) p.restore();
  }

  /** The inspector's kit: the clipboard (the certificate) and the pen. Given once per save, on the first build here. */
  giveStartKit() {
    const { state, inventory, journal } = this.ctx;
    if (state.get('kit.given')) return;
    state.set('kit.given', true);
    for (const id of ['clipboard', 'pen']) if (!inventory.has(id)) inventory.add(id, { silent: true });
    journal.collect('certificate', { quiet: true });
  }

  /** Open a close-up unless it is already the open one (a click inside a close-up never nests the same view). */
  focusOn(view, scope, puzzle) {
    const { camera, hotspots } = this.ctx;
    if (camera.inFocus && hotspots.scope === scope) return Promise.resolve();
    return camera.focus({ ...view, scope, puzzle });
  }

  /** A pause in a choreography (game time; resolves even if the player leaves). */
  wait(s) { return this.ctx.tween.delay(s); }

  enter({ from } = {}) {
    const { state, dialogue, audio } = this.ctx;
    this.restore();
    if (!state.get('door.enter.seen')) {
      state.set('door.enter.seen', true);
      audio?.play('doorSlam', { gain: 0.7 });
      this.later(0.6, () => dialogue.say('door.enter').then(() => dialogue.say('door.enter.voice')));
    } else if (from && state.isSolved('signin') && !state.get('door.return.seen')) {
      state.set('door.return.seen', true);
      this.later(0.8, () => dialogue.say('door.return'));
    }
  }

  /** Title backdrop: the dark room, rain, the glow breathing. No dialogue. */
  enterTitle() {
    this.restore();
  }

  prereqMet(p) {
    const s = (x) => this.ctx.state.isSolved(x);
    if (p === 'meter') return s('hutch');
    if (p === 'keypress') return s('meter');
    if (p === 'signin') return s('keypress');
    return true;
  }

  /** Stuck: pulse the object the current puzzle wants (the coat's glint, the glow, ...). */
  glint(p) {
    const { inventory } = this.ctx;
    const h = this.h;
    const held = { hutch: 'key_hutch', meter: 'shilling', signin: 'key_pass' }[p];
    if (held && inventory.has(held)) { inventory.flash(held); return; }
    if (p === 'hutch') h.coat.setGlint(true);
    if (p === 'signin') { h.glow.setLevel(1.6); this.later(1.2, () => h.glow.setLevel(1)); }
  }

  onNudge() {
    this.ctx.dialogue.say(this.ctx.dialogue.cycle('door.idle'));
    return true;
  }
}

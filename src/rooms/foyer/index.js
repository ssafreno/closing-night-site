// The Foyer & Box Office (docs/rooms/foyer.md). SET-foyer built the set (set.js, props.js), the delights, the doors
// and the lighting rig; PUZZLES-foyer wired the five puzzles, one file each (chandelier → safe → poster → houseboard →
// ticketing). See docs/notes/set-foyer.md and docs/notes/puzzles-foyer.md.
import * as THREE from 'three';
import { Room } from '../../engine/Room.js';
import { mergeStatic } from '../../engine/props/util.js';
import { buildSet, VANTAGE } from './set.js';
import chandelier from './chandelier.js';
import safe from './safe.js';
import poster from './poster.js';
import houseboard from './houseboard.js';
import ticketing from './ticketing.js';

const HOUSE = ['chandelier', 'safe', 'poster', 'houseboard', 'ticketing'];

export default class FoyerRoom extends Room {
  static id = 'foyer';
  static title = 'Front of House';
  static vantage = { ...VANTAGE, yawLimit: 75, pitchLimit: 32 };
  static puzzleOrder = []; // from src/content/manifest.js: chandelier, safe, poster, houseboard, ticketing
  static nudgeSeconds = 90;
  static glintSeconds = 150;

  async build() {
    const { ctx } = this;
    const { hotspots, state, dialogue, papers, inventory, audio } = ctx;
    const solved = (p) => state.isSolved(p);
    const lit = () => solved('chandelier');

    // ---- look ---------------------------------------------------------------------------------------------
    this.background = new THREE.Color('#050404');
    this.fog = new THREE.FogExp2('#0c0806', 0.012);
    this.envIntensity = 0.35;
    this.exposure = 1.32;
    this.bloom = { strength: 0.5, threshold: 0.8, radius: 0.55 };
    this.cssVignette = 0.4;

    const h = buildSet(ctx, this.group);
    this.h = h;

    const keep = (o) => { if (o) o.userData.keep = true; return o; };
    /** A hotspot on a proxy box (or any object) that highlights `glow`. */
    const spot = (id, object, label, glow, opts = {}) => hotspots.add({ id: `foyer.${id}`, object, label, highlight: glow ? keep(glow) : true, ...opts });
    const focus = (f, scope, puzzle = null, extra = {}) => ctx.camera.focus({ ...f, scope, puzzle, ...extra });
    /** Inside the box office nothing reads until the chandelier is lit. */
    const inBooth = (fn) => () => { if (!lit()) { dialogue.caption('foyer.boxoffice.dark'); return; } fn(); };

    // =====================================================================================================
    // PUZZLES (one file each: chandelier → safe → poster → houseboard → ticketing). Each registers its hotspots,
    // its close-ups and its choreography, and returns { restore }.
    // =====================================================================================================
    this.spot = spot;
    this.keep = keep;
    this.lit = lit;
    this.inBooth = inBooth;
    this.puzzles = [chandelier, safe, poster, houseboard, ticketing].map((fn) => fn(ctx, this, h));

    // ---- the box office: overview, window, papers on the walls ------------------------------------------------
    spot('seatplan', h.seatplan.hit, 'Seating plan', h.seatplan.object, {
      scope: ['room', 'focus:booth'],
      onClick: inBooth(() => papers.show('seatplan')),
    });
    spot('priceboard', h.priceBoard.hit, 'Price board', h.priceBoard.object, {
      scope: ['room', 'focus:booth', 'focus:boothwindow'],
      onClick: inBooth(() => papers.show('prices')),
    });
    spot('boothwindow', h.booth.hit, 'Box office', h.booth.window, {
      onClick: () => (lit() ? focus(h.booth.focus, 'focus:booth') : focus(h.booth.windowFocus, 'focus:boothwindow')),
    });
    spot('boothdoor', h.doors.booth.hit, 'Box office door', h.doors.booth.object, {
      onClick: () => (lit() ? focus(h.booth.focus, 'focus:booth') : dialogue.caption('foyer.boxoffice.dark')),
    });

    // =====================================================================================================
    // DOORS
    // =====================================================================================================
    keep(h.doors.pass.leaf);
    this.addDoor({
      id: 'foyer.passdoor', object: h.doors.pass.hit, to: 'stage', highlight: h.doors.pass.leaf,
      label: 'Pass door (to the stage)', isOpen: () => true,
      onOpen: () => ctx.tween?.to(h.doors.pass.leaf.rotation, { y: -1.1 }, { duration: 0.5, ease: 'inOutSine' }),
    });

    // =====================================================================================================
    // DELIGHTS
    // =====================================================================================================
    h.reviews.forEach((r) => spot(r.id, r.hit, 'Review', r.object, {
      onClick: () => { focus(r.focus, `focus:${r.id}`); dialogue.auto(`foyer.delight.${r.id}`); },
    }));
    spot('ordinarycat', h.ordinaryCat.hit, 'Poster', h.ordinaryCat.object, {
      onClick: async () => { await papers.show('ordinarycat'); dialogue.auto('foyer.delight.ordinarycat'); },
    });
    spot('kiosk', h.kiosk.hit, 'Kiosk', h.kiosk.object, { onClick: () => dialogue.auto('foyer.delight.kiosk') });
    spot('clock', h.clock.hit, 'Clock', h.clock.object, { onClick: () => dialogue.auto('foyer.delight.clock') });
    spot('street', h.street.hit, 'Street doors', null, {
      onClick: () => { h.street.driveBus(); audio?.play('latch', { gain: 0.4 }); dialogue.auto('foyer.delight.street'); },
    });
    spot('umbrellas', h.umbrellas.hit, 'Umbrellas', h.umbrellas.object, { onClick: () => dialogue.auto('foyer.delight.umbrellas') });
    spot('glove', h.glove.hit, 'Glove', h.glove.object, { onClick: () => dialogue.auto('foyer.delight.glove') });
    let gliding = false;
    const glide = async () => {
      if (gliding || !ctx.companion?.moveTo) { dialogue.say('foyer.delight.stairs'); return; }
      gliding = true;
      const home = h.perches.lavinia, up = h.stairs.lavinia.up;
      try {
        const said = dialogue.say('foyer.delight.stairs');
        await ctx.companion.moveTo(up, { duration: 1.6, rotationY: -Math.PI / 2, pose: 'hover' });
        await ctx.companion.moveTo(home.position, { duration: 1.6, rotationY: home.rotationY, pose: 'stand' });
        await said;
      } finally { gliding = false; }
    };
    spot('stairs', h.stairs.hit, 'Grand staircase', null, { onClick: glide });
    spot('circle', h.stairs.circleHit, 'To the dress circle', null, { onClick: glide });

    // the Royal Box ticket is for one particular patron: anywhere else in this room it says so
    for (const hs of hotspots._map.values()) {
      if (!hs.id.startsWith('foyer.') || hs.useItem?.ticket || hs.acceptsAnyItem) continue;
      hs.useItem = { ...(hs.useItem || {}), ticket: () => { dialogue.caption('item.ticket.wrong'); return false; } };
    }

    // =====================================================================================================
    // STATE RESTORE (a reload lands here mid-room)
    // =====================================================================================================
    this.restore();
    state.on?.('reset', () => this.restore());
    // Lavinia follows the player with her eyes
    const ptr = new THREE.Vector3();
    this.animate(() => { ctx.camera.camera.getWorldPosition(ptr); ctx.companion?.lookAt?.(ptr); });

    // merge the static set (hotspot objects and keep()-flagged movers are left alone)
    mergeStatic(this.group, [], { hotspots });
  }

  /** Visual state from ctx.state (instant). Safe to call any time. Each puzzle restores its own pieces. */
  restore() {
    const { state } = this.ctx;
    const h = this.h;
    const lit = state.isSolved('chandelier');
    h.lighting.set(lit ? 1 : 0, true);
    h.chandelier.setLit(lit ? 1 : 0, true);
    for (const p of this.puzzles || []) p.restore();
  }

  /** Open a close-up unless it is already the open one (a click inside a close-up never nests the same view). */
  focusOn(view, scope, puzzle = null) {
    const { camera, hotspots } = this.ctx;
    if (camera.inFocus && hotspots.scope === scope) return Promise.resolve();
    return camera.focus({ ...view, scope, puzzle });
  }

  /** A pause in a choreography (game time; resolves even if the player leaves). */
  wait(s) { return this.ctx.tween.delay(s); }

  /**
   * THE HOUSE: whichever puzzle finishes last ticks the Running Order (DESIGN §5). Idempotent. `quiet` (restores):
   * the tick without the line.
   */
  async checkHouse({ quiet = false } = {}) {
    const { state, journal, dialogue } = this.ctx;
    if (!HOUSE.every((p) => state.isSolved(p))) return false;
    if (journal.delivered('house')) return true;
    if (quiet) { journal.deliver('house', { quiet: true }); return true; }
    if (this._delivering) return true;
    this._delivering = true;
    try {
      journal.deliver('house');
      this.ctx.characters?.lavinia?.react?.('sigh');
      await dialogue.say('foyer.done');
    } finally { this._delivering = false; }
    return true;
  }

  _placeCast() {
    const { characters, state } = this.ctx;
    const p = this.h.perches;
    characters.lavinia.placeAt(this.group, { position: p.lavinia.position, rotationY: p.lavinia.rotationY, pose: p.lavinia.pose });
    if (!state.isSolved('ticketing')) {
      characters.cat.setVisible?.(true);
      characters.cat.placeAt(this.group, {
        position: p.cat.position, rotationY: p.cat.rotationY, pose: 'sleep', label: 'Bartholomew',
        scope: ['room', 'focus:booth', 'focus:boothwindow', 'focus:machine'],
        hotspot: {
          onClick: () => {
            const { dialogue } = this.ctx;
            if (this._catBusy) return;
            if (!state.get('foyer.catspoke')) { state.set('foyer.catspoke', true); characters.cat.react?.('tail'); dialogue.say('foyer.delight.cat'); return; }
            characters.cat.react?.('tail');
            dialogue.auto('foyer.delight.cattail');
          },
          useItem: { ticket: () => { this.giveTicket?.(); } },
        },
      });
    } else characters.cat.remove?.();
  }

  enter({ from } = {}) {
    const { ctx } = this;
    const { state, dialogue, audio, journal } = ctx;
    this.restore();
    this._placeCast();
    audio?.setRoomAmbience?.('foyer');
    if (state.isSolved('chandelier')) this.loop('chandelierTinkle', { gain: 0.5 });
    // a jump or an old save with every puzzle done still gets its tick
    if (!this._delivering) this.checkHouse({ quiet: true });
    if (!state.get('foyer.enter.seen')) {
      state.set('foyer.enter.seen', true);
      // the deliverable is named on entry (foyer.enter); the first Lavinia click gives foyer.enter.note (Hints)
      this.later(0.8, () => dialogue.say('foyer.enter'));
    } else if (from && journal.delivered('house') && !state.get('foyer.return.seen')) {
      state.set('foyer.return.seen', true);
      this.later(0.8, () => dialogue.say('foyer.return'));
    }
  }

  enterTitle() {
    this.restore();
    this._placeCast();
  }

  update(dt, t) {
    const h = this.h;
    if (!h) return;
    h.update(dt, t);
    // exposure and bloom follow the light level
    const e = h.lighting.exposure();
    if (Math.abs(e - (this._exp ?? -1)) > 0.002) {
      this._exp = e;
      this.ctx.renderer?.setExposure?.(e);
      if (!this.ctx.flags?.nobloom) this.ctx.renderer?.setBloom?.(h.lighting.bloom(), { threshold: 0.8, radius: 0.55 });
    }
  }

  prereqMet(p) {
    if (p === 'chandelier') return true; // the handle is a tracked loose end: hintVariant 'nohandle' points to the pit
    return this.ctx.state.isSolved('chandelier');
  }

  /** The winch handle is still in the pit (or nobody has it): the chandelier's hints point there. */
  _handleMissing() {
    const { state, inventory } = this.ctx;
    return !state.isSolved('chandelier') && !state.get('foyer.handlefitted') && !inventory.has('winch_handle');
  }

  hintVariant(p) {
    return p === 'chandelier' && this._handleMissing() ? 'nohandle' : null;
  }

  looseEnd() {
    return this._handleMissing() ? 'loose.winch_handle' : null;
  }

  /** Stuck: pulse the object the current puzzle wants. */
  glint(p) {
    const { inventory, state } = this.ctx;
    const h = this.h;
    const held = { chandelier: 'winch_handle', safe: inventory.has('key_chain') ? 'key_chain' : 'ear_trumpet', ticketing: 'ticket' }[p];
    if (held && inventory.has(held)) { inventory.flash(held); return; }
    if (p === 'chandelier') h.chandelier.tinkle(1);
    if (p === 'safe' && h.earTrumpet.object.visible && !state.get('foyer.trumpet.taken')) {
      h.earTrumpet.glint.material.opacity = 0.9; this.later(1.2, () => { h.earTrumpet.glint.material.opacity = 0; });
    }
  }

  /** The one idle nudge: a loose end outranks idle chatter (DESIGN §7). */
  onNudge() {
    const { dialogue } = this.ctx;
    dialogue.say(this._handleMissing() ? 'loose.winch_handle' : dialogue.cycle('foyer.idle'));
    return true;
  }
}

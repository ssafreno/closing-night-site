// Wardrobe & Props Loft (docs/rooms/wardrobe.md). SET-wardrobe built the set (set.js, props.js), the delights, the
// stair door and the state restore; PUZZLES-wardrobe wired the five puzzles, one file each (rack.js → rubbing.js →
// sewing.js → lens.js → dummy.js; each header is the exact mechanism), and the room hooks here: prereqMet, looseEnd
// (the lamp), glint, onNudge, the entry beats and checkCostume (COSTUME from whichever of dummy / lens is last).
// docs/notes/puzzles-wardrobe.md is the summary; docs/notes/set-wardrobe.md lists every handle.
import * as THREE from 'three';
import { Room } from '../../engine/Room.js';
import { mergeStatic } from '../../engine/props/util.js';
import { burst } from '../../engine/props/particles.js';
import { buildSet, VANTAGE } from './set.js';
import rack from './rack.js';
import rubbing from './rubbing.js';
import sewing from './sewing.js';
import lens from './lens.js';
import dummy from './dummy.js';

export default class WardrobeRoom extends Room {
  static id = 'wardrobe';
  static title = 'Wardrobe';
  static vantage = { ...VANTAGE, yawLimit: 75, pitchLimit: 28 };
  static puzzleOrder = ['rack', 'rubbing', 'sewing', 'lens', 'dummy'];
  static nudgeSeconds = 90;
  static glintSeconds = 150;

  async build() {
    const { ctx } = this;
    const { hotspots, state, dialogue, papers, audio } = ctx;
    const solved = (p) => state.isSolved(p);

    // ---- look -------------------------------------------------------------------------------------------------
    this.background = new THREE.Color('#0b0806');
    this.fog = new THREE.FogExp2('#1c130c', 0.042);
    this.envIntensity = 0.3;
    this.exposure = 1.12;
    this.bloom = { strength: 0.42, threshold: 0.84, radius: 0.5 };
    this.cssVignette = 0.3;

    const h = buildSet(ctx, this.group);
    this.h = h;

    const keep = (o) => { if (o) o.userData.keep = true; return o; };
    /** A hotspot on a proxy box (or any object) that glows `glow` on hover. */
    const spot = (id, object, label, glow, opts = {}) => hotspots.add({ id: `wardrobe.${id}`, object, label, highlight: glow ? keep(glow) : true, ...opts });
    const sfx = (name, gain = 0.6) => audio?.play(name, { gain });
    const lines = (key) => ctx.script?.[key];

    // =========================================================================================================
    // PUZZLES (one file each: rack → rubbing → sewing → lens → dummy). Each registers its hotspots, close-ups and
    // choreography, and returns { restore }.
    // =========================================================================================================
    this.spot = spot;
    this.keep = keep;
    this.sfx = sfx;
    this.puzzles = [rack, rubbing, sewing, lens, dummy].map((fn) => fn(ctx, this, h));

    // the papers on the walls and props (free to read)
    spot('marks', h.rack.marks.hit, "Molly's Marks", h.rack.marks.object, { scope: ['room', 'focus:rack'], onClick: () => papers.show('marks') });
    spot('sewingnote', h.sewing.note.hit, "Molly's note", h.sewing.note.object, { scope: ['room', 'focus:sewing'], onClick: () => papers.show('sewingnote') });
    spot('propcard', h.lens.propcard.object, 'Props card', h.lens.propcard.object, { scope: ['room', 'focus:lens'], onClick: () => papers.show('propcard') });
    spot('dummycard', h.dummy.label.object, 'Luggage label', h.dummy.label.object, { onClick: () => papers.show('dummycard') });
    const HB = h.hatboxes;
    HB.boxes.slice(1).forEach((b, k) => {
      spot(`hatbox.${k + 1}`, b.hit, `Hatbox: ${b.def.label}`, b.object, {
        onClick: () => {
          const L = b.lid, y0 = L.position.y;
          sfx('fabricRustle', 0.25);
          ctx.tween.run(0.5, (t) => { L.position.y = y0 + Math.sin(t * Math.PI) * 0.06; }, { ease: 'outQuad' });
          dialogue.caption(lines('wardrobe.delight.hatbox')?.[k] ?? 'wardrobe.delight.hatbox');
        },
      });
    });

    // =========================================================================================================
    // DOOR: down the spiral stair to the stage
    // =========================================================================================================
    keep(h.stair.stair);
    this.addDoor({ id: 'wardrobe.stair', object: h.doors.stair.object, to: 'stage', label: 'Down to the stage', highlight: h.stair.stair, isOpen: () => true });

    // =========================================================================================================
    // DELIGHTS
    // =========================================================================================================
    spot('wigs', h.wigs.hit, 'Wig heads', h.wigs.object, {
      onClick: async () => {
        const n = h.wigs.turnedCount();
        if (n >= 6) { dialogue.caption('wardrobe.delight.wigs'); return; }
        sfx('wigTurn', 0.5);
        state.set('wardrobe.wigs', n + 1);
        const turn = h.wigs.turn(n);
        if (n < 5) dialogue.caption(lines('wardrobe.delight.wigs.turn')?.[n] ?? 'wardrobe.delight.wigs');
        else { await turn; dialogue.caption('wardrobe.delight.wigs'); }
      },
    });
    spot('chicken', h.chicken.hit, 'Rubber chicken', h.chicken.object, { onClick: () => { sfx('squeak', 0.6); h.chicken.squeak(); dialogue.caption('wardrobe.delight.chicken'); } });
    spot('cake', h.cake.hit, 'Cardboard cake', h.cake.object, { onClick: () => { h.cake.bounce(); dialogue.caption('wardrobe.delight.cake'); } });
    spot('skull', h.skull.hit, 'Skull', h.skull.object, { onClick: () => { h.skull.nod(); dialogue.caption('wardrobe.delight.skull'); } });
    spot('ham', h.ham.object, 'Wooden ham', h.ham.object, { onClick: () => { h.ham.wobble(); dialogue.say('wardrobe.delight.ham'); } });
    spot('crown', h.crown.hit, 'Tin crown', h.crown.object, {
      onClick: () => {
        h.crown.spin();
        if (state.get('wardrobe.pretender.said')) { dialogue.caption('wardrobe.delight.crown.seen'); return; }
        state.set('wardrobe.pretender.said', true);
        dialogue.say('wardrobe.delight.crown');
      },
    });
    spot('skylight', h.skylight.hit, 'Skylight', null, { highlight: false, onClick: () => dialogue.say('wardrobe.delight.skylight') });
    spot('tape', h.tape.hit, 'Tape measure', h.tape.object, { onClick: () => dialogue.say('wardrobe.delight.tape') });
    spot('pincushion', h.pincushion.hit, 'Pincushion', h.pincushion.object, { onClick: () => dialogue.caption('wardrobe.delight.pincushion') });
    spot('cloak', h.cloak.hit, 'Grey cloak', h.cloak.object, {
      onClick: () => {
        const c = h.cloak.cloak, r0 = c.rotation.z;
        sfx('fabricRustle', 0.3);
        ctx.tween.run(1.2, (t) => { c.rotation.z = r0 + Math.sin(t * Math.PI * 3) * 0.05 * (1 - t); }, { ease: 'linear' });
        dialogue.say('wardrobe.delight.cloak');
      },
    });

    // tailor's chalk belongs on the order pad: anywhere else in this room it draws a small X (the item stays selected)
    for (const hs of hotspots._map.values()) {
      if (!hs.id.startsWith('wardrobe.') || hs.id === 'wardrobe.pad' || hs.useItem?.chalk) continue;
      hs.useItem = { ...(hs.useItem || {}), chalk: () => { dialogue.caption('item.chalk.wrong'); return false; } };
    }

    // Lavinia watches the player
    const ptr = new THREE.Vector3();
    this.animate(() => { if (ctx.companion?.isIn && !ctx.companion.isIn(this)) return; ctx.camera.camera.getWorldPosition(ptr); ctx.companion?.lookAt?.(ptr); });

    this.restore();
    state.on?.('reset', () => this.restore());

    // merge the static set (hotspot objects and keep()-flagged movers are left alone)
    mergeStatic(this.group, [], { hotspots });
  }

  _padRevealed() {
    const { state, journal } = this.ctx;
    return !!state.get('wardrobe.orderpad.read') || !!journal?.has?.('orderpad');
  }

  /** Every visual from ctx.state (instant). Safe to call any time. */
  restore() {
    const { state, inventory } = this.ctx;
    const h = this.h;
    const solved = (p) => state.isSolved(p);
    const has = (i) => !!inventory?.has?.(i);
    // rack: garment 3 gone once taken
    h.rack.slots.forEach((s) => h.rack.setPresent(s.i, !(s.i === 2 && (solved('rack') || has('bodice')))));
    // wigs that have turned stay turned
    h.wigs.setTurned(Math.min(6, state.get('wardrobe.wigs', 0) | 0));
    // chalk and pad
    h.chalk.setPresent(!has('chalk') && !state.get('wardrobe.chalk.used'));
    h.pad.setRevealed(this._padRevealed());
    // hatboxes: the heap after the topple; the cape until taken
    h.hatboxes.setToppled(!!state.get('wardrobe.toppled') || solved('rubbing')); // the cape only ever comes out of the heap
    h.hatboxes.setCape(!(solved('rubbing') || has('cape')));
    // sewing: oil persists, stitches do not, the skirt stays until solved, the metronome starts stopped
    h.sewing.setOiled(!!state.get('wardrobe.oiled'));
    h.sewing.setStitches(solved('sewing') ? 4 : 0);
    h.sewing.setSkirtPresent(!(solved('sewing') || has('skirt')));
    h.sewing.setPresserFoot(false);
    h.metronome.stop(); h.metronome.setFlag(0);
    h.oilcan.setPresent(!has('oilcan') && !state.get('wardrobe.oilcan.taken'));
    // lens: rings in the tray, or the lamp taken
    if (solved('lens') || has('lamp')) { h.lens.setStack(h.lens.correct); h.lens.setSolved(false, true); h.lens.setTaken(true); }
    else { h.lens.setTaken(false); h.lens.setStack([]); h.lens.setSolved(false, true); }
    // dummy: layers on, individually; the whole gown after the solve
    const on = solved('dummy') ? ['skirt', 'bodice', 'cape'] : (state.get('wardrobe.dummy', []) || []);
    for (const k of ['skirt', 'bodice', 'cape']) h.dummy.setDressed(k, on.includes(k));
    for (const p of this.puzzles || []) p.restore?.();
    // FIXED BY integration-qa: restore() also runs at build (the engine prebuilds neighbours) and on state reset, so
    // placing Lavinia here pulled her out of whatever room she was in (Continue into the pit: she vanished). Only the
    // current room places her (enter() and enterTitle() run after currentRoom is set).
    if (this.ctx.game?.currentRoom === this) this._placeCast();
  }

  _placeCast() {
    const { characters, state } = this.ctx;
    const lav = characters?.lavinia || this.ctx.companion;
    if (!lav?.placeAt) return;
    const p = state.isSolved('dummy') ? this.h.perches.laviniaDressed : this.h.perches.lavinia;
    lav.placeAt(this.group, { ...p, costume: state.isSolved('dummy') ? 'storm' : 'evening' });
  }

  /** Open a close-up unless it is already the open one (a click inside a close-up never nests the same view). */
  focusOn(view, scope, puzzle = null, extra = {}) {
    const { camera, hotspots } = this.ctx;
    if (camera.inFocus && hotspots.scope === scope) return Promise.resolve();
    return camera.focus({ ...view, scope, puzzle, ...extra });
  }

  /** A pause in a choreography (game time; resolves even if the player leaves). */
  wait(s) { return this.ctx.tween.delay(s); }

  /**
   * COSTUME: the storm gown on (dummy) and the lamp built (lens). Whichever finishes last ticks the Running Order.
   * The stage turns the ORCHESTRA cue light green itself (exit.pit.green + pike.go.pit on the next stage entry), so
   * nothing here sets exit.pit.green. `quiet` (restores): the tick without the line.
   */
  async checkCostume({ quiet = false } = {}) {
    const { state, journal, dialogue, characters } = this.ctx;
    if (!state.isSolved('dummy') || !state.isSolved('lens')) return false;
    if (journal.delivered('costume')) return true;
    if (quiet) { journal.deliver('costume', { quiet: true }); return true; }
    if (this._delivering) return true;
    this._delivering = true;
    try {
      journal.deliver('costume');
      characters?.lavinia?.react?.('flourish');
      await dialogue.say('wardrobe.done');
    } finally { this._delivering = false; }
    return true;
  }

  enter({ from } = {}) {
    const { state, dialogue, audio } = this.ctx;
    this.restore();
    audio?.setRoomAmbience?.('wardrobe');
    // a jump or an old save with both halves done still gets its tick
    if (!this._delivering) this.checkCostume({ quiet: true });
    if (!state.get('wardrobe.enter.seen')) {
      state.set('wardrobe.enter.seen', true);
      // the deliverable is named on entry (wardrobe.enter); the first Lavinia click gives wardrobe.enter.note (Hints)
      this.later(0.9, () => dialogue.say('wardrobe.enter'));
    } else if (from && state.isSolved('dummy') && state.isSolved('lens') && !state.get('wardrobe.return.seen')) {
      state.set('wardrobe.return.seen', true);
      this.later(0.8, () => dialogue.say('wardrobe.return'));
    }
  }

  enterTitle() { this.restore(); }

  exit() {
    const { state, inventory } = this.ctx;
    this.h?.metronome?.stop();
    // spare chalk never leaves the loft once the cape is found: it goes back on the cutting table, silently
    if (state.isSolved('rubbing') && inventory.has('chalk')) { inventory.remove('chalk'); this.h.chalk.setPresent(true); }
  }

  /** The next layer the dummy needs (skin out), or null when the gown is on. */
  nextLayer() {
    const { state } = this.ctx;
    if (state.isSolved('dummy')) return null;
    return ['skirt', 'bodice', 'cape'][(state.get('wardrobe.dummy', []) || []).length] || null;
  }

  prereqMet(p) {
    // the dummy is workable once the next garment in skin-out order is in hand
    if (p === 'dummy') { const n = this.nextLayer(); return !!n && this.ctx.inventory.has(n); }
    return true;
  }

  /** The lamp is a tracked loose end (DESIGN §5): it goes up in the stage lighthouse. */
  looseEnd() {
    const { state, inventory } = this.ctx;
    return inventory.has('lamp') && !state.get('stage.lampplaced') ? 'loose.lamp' : null;
  }

  /** Stuck: make the wanted object catch the eye (a held item flashes in the bar instead). */
  glint(p) {
    const h = this.h, ctx = this.ctx, { inventory, state } = ctx;
    const at = (o, dy = 0) => o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, dy, 0)).toArray();
    if (p === 'rack') { h.rack.nudge(2, 1.2); burst(ctx, this.group, at(h.rack.slots[2].tag), { count: 30, radius: 0.2 }); }
    if (p === 'rubbing') {
      if (inventory.has('chalk') && !this._padRevealed()) { inventory.flash('chalk'); burst(ctx, this.group, at(h.pad.object, 0.05), { count: 24, radius: 0.15 }); return; }
      if (h.chalk.object.visible && !this._padRevealed()) h.chalk.setGlint(true);
      burst(ctx, this.group, at(this._padRevealed() ? h.hatboxes.red.object : h.pad.object, this._padRevealed() ? 0.3 : 0.05), { count: 24, radius: 0.15 });
    }
    if (p === 'sewing') {
      if (inventory.has('oilcan') && !state.get('wardrobe.oiled')) inventory.flash('oilcan');
      if (h.oilcan.object.visible) h.oilcan.setGlint(true);
      burst(ctx, this.group, at(h.metronome.object, 0.3), { count: 24, radius: 0.18 });
    }
    if (p === 'lens' && h.lens.lamp.visible) burst(ctx, this.group, at(h.lens.lamp, 0.25), { count: 30, radius: 0.22 });
    if (p === 'dummy') { const n = this.nextLayer(); if (n && inventory.has(n)) inventory.flash(n); burst(ctx, this.group, at(h.dummy.object, 1.2), { count: 30, radius: 0.3, color: '#e8d0ff' }); }
  }

  /** The one idle nudge: a loose end outranks idle chatter (DESIGN §7). */
  onNudge() {
    const { dialogue } = this.ctx;
    dialogue.say(this.looseEnd() || dialogue.cycle('wardrobe.idle'));
    return true;
  }
}

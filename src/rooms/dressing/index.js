// Dressing Room No. 1 (docs/rooms/dressing.md): Lavinia's own room, the story room. SET-dressing built the set
// (set.js, props.js), the delights, the exit and the state restore. PUZZLES-dressing wired the five puzzles, one file
// each (mirror.js → basket.js → vanity.js → gramophone.js → jewelcase.js); see docs/notes/puzzles-dressing.md.
// See docs/notes/set-dressing.md for every handle and hook.
import * as THREE from 'three';
import { Room } from '../../engine/Room.js';
import { mergeStatic } from '../../engine/props/util.js';
import { buildSet, VANTAGE } from './set.js';
import { lines as SCRIPT } from '../../content/script/dressing.js';
import mirror from './mirror.js';
import basket from './basket.js';
import vanity from './vanity.js';
import gramophone from './gramophone.js';
import jewelcase from './jewelcase.js';

export default class DressingRoom extends Room {
  static id = 'dressing';
  static title = 'Dressing Room No. 1';
  static vantage = { ...VANTAGE, yawLimit: 70, pitchLimit: 25 };
  static puzzleOrder = ['mirror', 'basket', 'vanity', 'gramophone', 'jewelcase'];
  static nudgeSeconds = 90;
  static glintSeconds = 150;

  get backLabel() { return 'To the stage'; }
  onBack() { this.openDoor('dressing.door'); return true; }

  async build() {
    const { ctx } = this;
    const { hotspots, state, dialogue, papers, audio, camera } = ctx;
    const solved = (p) => state.isSolved(p);

    // ---- look -----------------------------------------------------------------------------------------------
    this.background = new THREE.Color('#0a0607');
    this.fog = null;
    this.envIntensity = 0.3;
    this.exposure = 1.12;
    this.bloom = { strength: 0.38, threshold: 0.86, radius: 0.45 };
    this.cssVignette = 0.4;

    const h = buildSet(ctx, this.group);
    this.h = h;

    const keep = (o) => { if (o) o.userData.keep = true; return o; };
    /** A hotspot (usually on a proxy box) that glows `glow` on hover. */
    const spot = (id, object, label, glow, opts = {}) => hotspots.add({ id: `dressing.${id}`, object, label, highlight: glow ? keep(glow) : true, ...opts });
    const focus = (f, scope, puzzle) => camera.focus({ ...f, scope, puzzle });

    // =====================================================================================================
    // PUZZLES (one file each: mirror → basket → vanity → gramophone → jewelcase) // PUZZLES-dressing
    // =====================================================================================================
    this.puzzles = {
      mirror: mirror(ctx, this, h),
      basket: basket(ctx, this, h),
      vanity: vanity(ctx, this, h),
      gramophone: gramophone(ctx, this, h),
      jewelcase: jewelcase(ctx, this, h),
    };

    // =====================================================================================================
    // DELIGHTS
    // =====================================================================================================
    spot('tonic', h.tonic.hit, "Dr Footlights' Tonic", h.tonic.object, { onClick: () => dialogue.auto('dressing.delight.footlights') });
    spot('perfume', h.perfume.hit, 'Perfume atomiser', h.perfume.object, {
      onClick: () => { h.perfume.squeeze(); audio?.play('perfume', { gain: 0.4 }); dialogue.auto('dressing.delight.perfume'); },
    });
    spot('fanletters', h.fanletters.hit, 'Fan letters', h.fanletters.object, {
      onClick: () => { audio?.play('page', { gain: 0.3 }); dialogue.auto('dressing.delight.fanletters'); },
    });
    spot('greasepaint', h.greasepaint.hit, 'Greasepaint', h.greasepaint.object, { onClick: () => dialogue.auto('dressing.delight.greasepaint') });
    spot('powder', h.powder.hit, 'Powder puff', h.powder.object, {
      onClick: async () => {
        h.powder.puff();
        this.later(0.5, () => ctx.companion?.react?.('gasp'));
        dialogue.auto('dressing.delight.powder');
      },
    });
    spot('wardrobe', h.wardrobe.hit, 'Costume wardrobe', h.wardrobe.object, {
      onClick: () => {
        if (h.wardrobe.isOpen()) { audio?.play('fabricRustle', { gain: 0.4 }); h.wardrobe.close(); return; }
        audio?.play('costumeSigh', { gain: 0.6 }); h.wardrobe.open();
        dialogue.auto('dressing.delight.wardrobe');
      },
    });
    spot('photo', h.photo.hit, 'Photograph', h.photo.object, { onClick: () => dialogue.auto('dressing.delight.photo') });
    spot('window', h.window.hit, 'Window', h.window.pane, { onClick: () => dialogue.auto('dressing.delight.window') });
    spot('radiator', h.radiator.hit, 'Radiator', h.radiator.object, { onClick: () => dialogue.auto('dressing.delight.radiator') });
    const lilyClick = async () => {
      audio?.play('lilyShimmer', { gain: 0.5 });
      h.lilies.setShimmer(1);
      await papers.show('lilycard');
      h.lilies.setShimmer(0);
      if (!state.get('dressing.lilies.seen')) { state.set('dressing.lilies.seen', true); dialogue.say('dressing.lilies'); }
    };
    spot('lilies', h.lilies.hit, 'Dried lilies', h.lilies.object, { onClick: lilyClick });
    spot('lilies.card', h.lilies.card.hit, 'A card in the lilies', h.lilies.object, { onClick: lilyClick });
    // telegrams in the mirror frame: they face the room once the mirror stands
    const tgPool = SCRIPT['dressing.delight.telegrams'] || [];
    const tgUp = () => h.mirror.isUpright();
    spot('telegram.ada', h.mirror.telegrams.ada.hit, 'Telegram', h.mirror.telegrams.ada.object, { scope: ['room', 'focus:dressing.mirror'], enabled: tgUp, onClick: () => dialogue.caption(tgPool[0] ?? 'dressing.delight.telegrams') });
    spot('telegram.rupert', h.mirror.telegrams.rupert.hit, 'Telegram', h.mirror.telegrams.rupert.object, { scope: ['room', 'focus:dressing.mirror'], enabled: tgUp, onClick: () => dialogue.caption(tgPool[1] ?? 'dressing.delight.telegrams') });
    spot('telegram.birthday', h.mirror.telegrams.birthday.hit, 'Telegram, 2 APR 1930', h.mirror.telegrams.birthday.object, {
      scope: ['room', 'focus:dressing.mirror'], enabled: tgUp,
      onClick: async () => {
        await papers.show('birthday');
        if (!state.get('dressing.birthday.seen')) { state.set('dressing.birthday.seen', true); dialogue.say('dressing.birthday'); }
      },
    });
    spot('chaiseunder', h.chaiseunder.hit, 'Under the chaise', h.chaiseunder.valance, {
      enabled: () => !solved('gramophone'),
      onClick: () => dialogue.auto('dressing.delight.chaiseunder'),
    });

    // =====================================================================================================
    // DOOR (behind the vantage; the enamel DOOR sign on the west wall is its hotspot)
    // =====================================================================================================
    this.addDoor({ id: 'dressing.door', object: h.doors.stage.object, to: 'stage', label: 'Door to the stage', highlight: h.doors.stage.blade, isOpen: () => true });

    // =====================================================================================================
    // STATE RESTORE
    // =====================================================================================================
    this.restore();
    state.on?.('reset', () => this.restore());
    mergeStatic(this.group, [], { hotspots });
  }

  /** Every visual from ctx.state (instant). Safe to call any time. */
  restore() {
    if (!this.h) return;
    for (const p of Object.values(this.puzzles || {})) p.restore?.();
    this.h.wardrobe.setOpen(0);
  }

  enter({ from } = {}) {
    const { ctx } = this;
    const { state, dialogue, audio, journal } = ctx;
    this.restore();
    const p = this.h.perches.lavinia;
    ctx.companion?.placeAt(this.group, { position: p.position, rotationY: p.rotationY, pose: p.pose });
    ctx.companion?.setGlowLight?.(0.7);
    audio?.setRoomAmbience?.('dressing');
    if (state.isSolved('jewelcase')) journal?.deliver?.('script', { quiet: true });
    if (!state.get('dressing.enter.seen')) {
      // she hesitates at her own door, then names what the room owes the show // PUZZLES-dressing
      state.set('dressing.enter.seen', true);
      this.later(0.8, () => {
        ctx.companion?.react?.('sigh');
        dialogue.say('dressing.enter');
        dialogue.say('dressing.enter.note');
      });
    } else if (from && state.isSolved('jewelcase') && !state.get('dressing.return.seen')) {
      state.set('dressing.return.seen', true);
      this.later(0.8, () => dialogue.say('dressing.return'));
    }
  }

  /** Title backdrop: the room as it stands, no dialogue. */
  enterTitle() { this.restore(); }

  prereqMet(p) {
    const s = (x) => this.ctx.state.isSolved(x);
    if (p === 'basket') return s('mirror');
    if (p === 'gramophone') return s('vanity');
    if (p === 'jewelcase') return s('gramophone');
    return true;
  }

  /** Nothing left here but the lamp still in a pocket: say so before pointing at the finale. */
  looseEnd() {
    const { state, inventory } = this.ctx;
    if (state.isSolved('jewelcase') && !state.get('stage.lampplaced') && inventory.has('lamp')) return 'loose.lamp';
    return null;
  }

  /** Stuck: a soft pulse on what the current puzzle wants. */
  glint(p) {
    const h = this.h;
    if (p === 'jewelcase') { h.jewelcase.setGlint(1.4); this.later(1.5, () => h.jewelcase.setGlint(1)); }
    if (p === 'gramophone') { const s = h.gramophone.object.userData.spin; s.rotation.y += 0.4; this.later(0.4, () => { s.rotation.y -= 0.4; }); }
    if (p === 'mirror' || p === 'basket') { h.lamp.halo.material.opacity = 0.7; this.later(1.2, () => { h.lamp.halo.material.opacity = 0.35; }); }
  }

  onNudge() {
    this.ctx.dialogue.say(this.ctx.dialogue.cycle('dressing.idle'));
    return true;
  }

  update(dt, t) {
    super.update?.(dt, t);
    // the rose lamp breathes very slightly (an old filament), the window light shivers with the rain
    const h = this.h; if (!h) return;
    h.ambient.lampLight.intensity = 2.4 * (1 + 0.025 * Math.sin(t * 1.7) + 0.015 * Math.sin(t * 4.3));
    h.ambient.winKey.userData.light.intensity = 9 * (1 + 0.06 * Math.sin(t * 0.9) * Math.sin(t * 2.3));
  }
}

// The Finale: calling the show (docs/rooms/finale.md). The stage set again (buildSet from ../stage/set.js, built into
// this room's own group: one geometry source), dressed solved and seen from the prompt desk. The capstone `cues`: ten
// GO buttons in page order, each firing a system the player restored; then the curtain call, the review, Q40, the
// fades, the dawn, "Not vacant." and the credits. Notes: docs/notes/finale.md.
//
// Flow (all of it driven by one async sequence per visit; `_run` invalidates a sequence when the room is left):
//   enter → restore(n = finale.cue) → [first visit: finale.enter, break a leg] / [resume: finale.return]
//   → cue(n) … cue(9), with the curtain call between Q39 and Q40 → ending → credits.
// The play's lines, Pike's calls and every remark made while a cue is live go through StageLine overlays that never
// take a click, so the GO buttons stay live while a line is up. Lines outside the cues use the normal dialogue box.
import * as THREE from 'three';
import { Room } from '../../engine/Room.js';
import { mergeStatic } from '../../engine/props/util.js';
import { burst } from '../../engine/props/particles.js';
import { store } from '../../engine/storage.js';
import { buildSet, LOOKS, FINALE_VANTAGE, GHOST_POS, GHOST_WING } from '../stage/set.js';
import { solvedSet, buildPage, buildGoHits, buildLily, buildDawn, DEPTS } from './dress.js';
import { StageLine, reviewPaper, clipboardShot, creditsRoll, fmtTime } from './ui.js';

/**
 * The vantage: FINALE_VANTAGE (7.55, 1.6, 2.2) stepped back 0.15 m, 0.4 m to house side and up to 1.82 m, turned 23°
 * right of the house and pitched down 17°, so the panel, the page, the lighthouse, Lavinia and Pike share the first
 * frame (the original put the panel at eye level and the desk lamp over her). Tuned by screenshot at 1280×800.
 */
export const VANTAGE = { ...FINALE_VANTAGE, position: [7.7, 1.82, 2.6], lookAt: [-1.1, -1.1, -1.14] };
/** Pike: at your right shoulder, clear of the desk lamp (the set's perch pikeFinale is behind the camera from here). */
export const PIKE_SPOT = { position: [6.55, 0, 0.7], rotationY: 0.65 };

/** The ten cues: department (DEPTS index) and how the trigger arrives. */
export const CUES = [
  { q: 'q31', dept: 0, trigger: 'line', key: 'finale.places', who: 'pike' },
  { q: 'q32', dept: 1, trigger: 'dir', key: 'finale.trigger.q32' },
  { q: 'q33', dept: 2, trigger: 'dir', key: 'finale.trigger.q33' },
  { q: 'q34', dept: 3, trigger: 'dir', key: 'finale.trigger.q34' },
  { q: 'q35', dept: 4, trigger: 'line', key: 'finale.play.grace1', who: 'lavinia', label: 'Grace' },
  { q: 'q36', dept: 5, trigger: 'line', key: 'finale.play.grace2', who: 'lavinia', label: 'Grace' },
  { q: 'q37', dept: 3, trigger: 'line', key: 'finale.play.grace3', who: 'lavinia', label: 'Grace' },
  { q: 'q38', dept: 4, trigger: 'line', key: 'finale.play.grace4', who: 'lavinia', label: 'Grace' },
  { q: 'q39', dept: 2, trigger: 'line', key: 'finale.play.grace5', who: 'lavinia', label: 'Grace' },
  { q: 'q40', dept: 0, trigger: 'dir', key: 'finale.trigger.q40' },
];
const REVIEWS = ['triumph', 'long', 'seen'];
// camera framings (lookAtPoint, clamped to the vantage's yaw/pitch limits)
const LOOK_VANTAGE = new THREE.Vector3(...VANTAGE.lookAt);
const LOOK_LAMPROOM = new THREE.Vector3(-1.1, 0.6, -1.14); // Q36–Q39: pitched up 9°, her in the lantern clear of the surtitles
const LOOK_BOW = new THREE.Vector3(-5.2, 1.6, 1.4); // the call: Lavinia in the lime at right, the Royal Box at left
const LOOK_Q40 = new THREE.Vector3(-1.75, -0.26, 0.07); // Q40: the panel, her, and the Royal Box top left
/** Ezra: her comic gruff register (a lower, flatter blip). */
const EZRA = { pitch: 0.9, vibrato: 0.012, every: 2 };
const BEST_KEY = 'closing-night.best';
const ABORT = Symbol('finale-abort');

export default class FinaleRoom extends Room {
  static id = 'finale';
  static title = 'Places, Please';
  static vantage = VANTAGE;
  static puzzleOrder = ['cues'];
  static nudgeSeconds = null; // the live-cue wait lines do this job
  static glintSeconds = 0;

  async build() {
    const { ctx } = this;
    const { hotspots, papers } = ctx;
    this.background = new THREE.Color('#030304');
    this.fog = new THREE.FogExp2('#050608', 0.012);
    this.bloom = { strength: 0.5, threshold: 0.8, radius: 0.55 };
    this.cssVignette = 0.45;

    const h = buildSet(ctx, this.group);
    this.h = h;
    solvedSet(h);
    h.tabs.setOpen(0);

    const desk = h.promptDesk.object;
    this.panel = h.promptDesk.panel;
    // (ENGINE-FIX: the cue-light panel body's mirror patch is gone; T.cueLightPanel now slopes the right way.)
    this.page = buildPage(desk);
    this.goHits = buildGoHits(this.panel);
    desk.updateMatrixWorld(true);
    this.lily = buildLily(this.group, desk.userData.slope.localToWorld(new THREE.Vector3(0.18, 0.06, 0.02)).sub(this.group.position));
    this.dawn = buildDawn(this.group);

    // the six GO buttons
    this.goHits.forEach((hit, i) => {
      const btn = this.panel.userData.buttons[i];
      btn.userData.keep = true;
      hotspots.add({
        id: `finale.go.${DEPTS[i].toLowerCase()}`, object: hit, label: `GO: ${DEPTS[i]}`, highlight: btn,
        enabled: () => this._phase === 'cues',
        onClick: () => this.press(i),
      });
    });
    // the last page: read it full size
    hotspots.add({
      id: 'finale.page', object: this.page.hit, label: 'The last page', highlight: this.page.object,
      enabled: () => this._phase === 'cues',
      onClick: () => papers.show('lastpage', { collect: false }),
    });

    this.line = new StageLine(ctx);
    this.aside = new StageLine(ctx);
    this.aside.el.style.top = 'calc(max(14px, env(safe-area-inset-top)) + 150px)';
    this.aside.el.style.fontSize = 'clamp(16px, 2.3vh, 20px)';

    this._run = 0;
    this._phase = 'idle';
    this._live = -1;
    this._current = -1;
    this._hurry = new Set();
    this._onKey = (e) => this._key(e);
    this.restore(ctx.state.get('finale.cue', 0));
    mergeStatic(this.group, [], { hotspots });
  }

  // =====================================================================================================================
  // RESTORE: the scene as it stands after `n` cues (instant)
  // =====================================================================================================================
  restore(n) {
    const { ctx } = this;
    const h = this.h, S = (k, f) => ctx.state.get(k, f);
    const called = !!S('finale.called');
    // lights
    let look = { ...LOOKS.preshow };
    if (n >= 1) look = { ...look, house: 0 };
    if (n >= 3) look = { ...look, houseGlow: 0.5 };
    if (n >= 4) look = { ...LOOKS.moon };
    if (n >= 7) look = { ...LOOKS.lamp };
    if (n >= 10) look = this._creditsLook();
    h.lights.apply(look, 0);
    h.lights.state = 'finale';
    this._applyRigLook(true);
    // tabs: in until Q33, out until Q39, in after Q39 until the call
    h.tabs.setOpen(n >= 3 && (n < 9 || called) ? 1 : 0);
    // storm Q35–Q38
    const storm = n >= 5 && n < 9;
    h.storm.setRain(storm ? 1 : 0, true);
    h.storm.setSea(storm ? 1 : 0);
    h.truck.setBeam(n >= 7 && n < 10, 0.6);
    // the ghost light: in the wing for the show, centre stage again for the credits
    const gp = n >= 10 ? GHOST_POS : GHOST_WING;
    h.ghostLight.moveTo(gp[0], gp[2]);
    h.ghostLight.cable.showTo(1);
    // the panel and the page
    this._greens = new Set(CUES.slice(0, Math.min(n, 10)).map((c) => c.dept));
    if (n >= 10) this._greens.clear();
    this._restJewels();
    this.page.set(Math.min(n, 10), -1);
    this.lily.set(0);
    this.dawn.show(false);
  }

  _creditsLook() {
    return { ambient: 0.05, ghost: 1, houseGlow: 0.7, blues: 0.12, env: 0.045, exposure: 1.22 };
  }

  _placeCast(n) {
    const { ctx } = this;
    const h = this.h;
    const lav = ctx.characters?.lavinia, pike = ctx.characters?.pike, cat = ctx.characters?.cat;
    if (n >= 10) { lav?.remove?.(); pike?.remove?.(); }
    else {
      const up = n >= 6 && n < 9;
      lav?.placeAt?.(this.group, {
        ...(up ? h.perches.laviniaLantern : h.perches.laviniaFinale),
        costume: n >= 6 ? 'storm' : 'cloaked',
        hotspot: { onClick: () => this._castClick('lavinia') },
      });
      lav?.setGlowLight?.(n >= 4 ? 0.9 : 0.3);
      pike?.placeAt?.(this.group, { ...this.pikeSpot(), hotspot: { onClick: () => this._castClick('pike') } });
    }
    cat?.placeAt?.(this.group, { ...h.perches.cat, pose: n >= 3 ? 'sit' : 'loaf' });
    cat?.lookAt?.(n >= 3 ? [-1.4, 1.2, -2.4] : null);
  }

  /** Where Pike stands: at your right shoulder, beside the desk. */
  pikeSpot() { return PIKE_SPOT; }

  _castClick(who) {
    const { ctx } = this;
    if (this._phase !== 'cues') return;
    if (who === 'pike') ctx.characters?.pike?.react?.('nod');
    ctx.hints.ask();
  }

  // =====================================================================================================================
  // ENTER / EXIT
  // =====================================================================================================================
  enter() {
    const { ctx } = this;
    const { state, inventory, audio } = ctx;
    const run = ++this._run;
    if (inventory.has('lastpage')) inventory.remove('lastpage');
    state.set('finale.pageplaced', true);
    inventory.setVisible(false);
    window.addEventListener('keydown', this._onKey, true);
    if (state.isSolved('cues')) {
      ctx.game?.stopTimer?.(); // Continue after the end: straight to the credits, the clock stays stopped
      this.restore(10);
      this._placeCast(10);
      audio?.setRoomAmbience?.(null);
      this._go(run, () => this._credits(run, { fresh: false }));
      return;
    }
    const n = THREE.MathUtils.clamp(state.get('finale.cue', 0) | 0, 0, 9);
    this.restore(n);
    this._placeCast(n);
    if (n >= 1) audio?.setRoomAmbience?.(null);
    if (n >= 5 && n < 9) this._stormLoops(true, 0.5);
    if (n >= 6 && n < 9) this.later(0.2, () => ctx.camera.lookAtPoint(LOOK_LAMPROOM));
    this._phase = 'cues';
    this._go(run, () => this._show(run, n));
  }

  exit() {
    this._run++;
    this._phase = 'idle';
    this._live = -1;
    this._cinematic(false);
    this.line?.cut(); this.aside?.cut();
    this._ov?.stop?.(0.3); this._ov = null;
    this.ctx.audio?.overture?.stop?.(0.6);
    window.removeEventListener('keydown', this._onKey, true);
    this.ctx.camera.autoPan = null;
  }

  /** Run a sequence; an ABORT (the room was left) ends it quietly. */
  _go(run, fn) {
    this.later(0.5, async () => {
      try { await fn(); } catch (e) { if (e !== ABORT) console.error('[finale]', e); }
    });
  }

  // =====================================================================================================================
  // WAITS (game time; Esc hurries them) and LINES
  // =====================================================================================================================
  _guard(run) { if (run !== this._run || this.ctx.game?.currentRoom !== this) throw ABORT; }
  wait(s) {
    return new Promise((resolve) => {
      let done = false;
      const fin = () => { if (done) return; done = true; this._hurry.delete(fin); cancel(); resolve(); };
      const cancel = this.later(s, fin);
      this._hurry.add(fin);
    });
  }
  /** Esc: finish the line on screen, or end the current pause. Never skips a live cue or a choice. */
  hurry() {
    if (this.line.skip() || this.aside.skip()) return true;
    if (this._ui?.skip) { this._ui.skip(); return true; }
    const fins = [...this._hurry];
    fins.forEach((f) => f());
    return fins.length > 0;
  }
  onBack() { return this.hurry() || true; }
  _key(e) {
    if (e.key !== 'Escape' || !this._cine) return;
    const c = this.ctx;
    if (c.dialogue.isOpen || c.papers.isOpen || c.journal.isOpen || c.hud._confirmClose) return;
    this.hurry();
  }
  /** Cinematic: no hotspots, no free look (Esc still hurries; lines still click on). */
  _cinematic(on) {
    const c = this.ctx;
    this._cine = !!on;
    c.hotspots.enabled = !on;
    c.camera.enabled = !on;
  }

  /** A line from the script on the stage line: `label` over it (GRACE, EZRA, MR PIKE); resolves when it has gone. */
  _line(key, { who, label, voice, hold, aside = false } = {}) {
    const l = this.ctx.dialogue.resolve(key)[0];
    if (!l) return Promise.resolve();
    who = who || l.who;
    const sp = this.ctx.dialogue.speaker?.(who) || {};
    const tag = label ?? (who === 'narrator' ? '' : sp.name || who);
    return (aside ? this.aside : this.line).say({ who, label: tag, text: this.ctx.dialogue._fill?.(l.text) ?? l.text, voice, hold });
  }
  _dir(key, hold = 1.6) {
    const t = this.ctx.script?.[key];
    return this.line.direction(typeof t === 'string' ? t : String(key), hold);
  }
  _say(run, key) { this._guard(run); return this.ctx.dialogue.say(key).then(() => this._guard(run)); }

  // =====================================================================================================================
  // THE SHOW
  // =====================================================================================================================
  async _show(run, n) {
    const { ctx } = this;
    const { state } = ctx;
    let skipStandby = false;
    if (n === 0 && !state.get('finale.enter.seen')) {
      state.set('finale.enter.seen', true);
      await this._say(run, 'finale.enter');
      await this.wait(0.6); this._guard(run);
      ctx.characters?.pike?.react?.('tip');
      await this._say(run, 'finale.breakaleg.pike');
      ctx.characters?.lavinia?.react?.('gasp');
      await this._say(run, 'finale.breakaleg.lavinia');
      await this._say(run, 'finale.breakaleg.pike2'); // "... Stand by Q31."
      this._standbyJewels();
      ctx.audio?.play('cueStandby', { gain: 0.4 });
      skipStandby = true;
    } else {
      await this._say(run, 'finale.return');
    }
    for (let i = n; i < 10; i++) {
      if (i === 9) await this._call(run);
      await this._cue(run, i, { standby: !(i === n && skipStandby) });
    }
    await this._ending(run);
  }

  /** Standby: every red on (the panel never gives the department away); the greens of cues already gone stay lit. */
  _standbyJewels() { for (let i = 0; i < 6; i++) this.panel.userData.setJewel(i, this._greens.has(i) ? 'both' : 'red'); }
  _restJewels() { for (let i = 0; i < 6; i++) this.panel.userData.setJewel(i, this._greens.has(i) ? 'green' : 'off'); }

  /** One cue: standby → trigger → live (wait for the right GO) → fire. */
  async _cue(run, i, { standby = true } = {}) {
    const { ctx } = this;
    const c = CUES[i];
    this._current = i;
    this.page.set(i, i);
    // hints: each new cue starts at level 2 at most, so a player who has asked before gets "Q35. FX. Go." next
    const lv = ctx.state.get('hint.cues.level', 0);
    if (lv > 2) ctx.state.set('hint.cues.level', 2);
    if (standby) {
      await this.wait(i === 0 ? 0.4 : 1.0); this._guard(run);
      this._standbyJewels();
      ctx.audio?.play('cueStandby', { gain: 0.4 });
      ctx.characters?.pike?.react?.('check');
      await this._line(`finale.standby.${c.q}`, { who: 'pike' }); this._guard(run);
    }
    // the trigger
    this._standing = i;
    await this._pre(run, i); this._guard(run);
    let shown;
    // the trigger stays up until the GO, so a player who looked away can still read what they are cueing off
    if (c.trigger === 'line') shown = this._line(c.key, { who: c.who, label: c.label, hold: Infinity });
    else shown = this._dir(c.key, Infinity);
    // live from the trigger on
    this._standing = -1;
    const pressed = new Promise((resolve) => { this._goResolve = resolve; });
    this._live = i;
    this._liveT = 0; this._nagAt = 8;
    ctx.game?.kick?.();
    await pressed; this._guard(run);
    void shown;
    this._live = -1;
    ctx.state.set('finale.cue', i + 1);
    this.page.set(i + 1, -1);
    ctx.hints.progress?.();
    await this._fire(run, i);
  }

  /** What must happen before a cue's trigger can arrive (the overture for Q33, the tabs for Q34, the climb for Q37). */
  async _pre(run, i) {
    const h = this.h;
    if (i === 1) { await this.wait(1.0); return; } // house black, a second after Q31
    if (i === 2) { // the overture's last chord (a resumed save plays it again)
      if (!this._chord) this._startOverture();
      await this._chord; this._chord = null; return;
    }
    if (i === 3) { // tabs out (when they reach the top)
      if (this._tabsOut) { await this._tabsOut; this._tabsOut = null; }
      await this.wait(0.3); return;
    }
    if (i >= 4 && i <= 8) { await this.wait(1.1); return; }
    if (i === 9) { // the bow
      this.ctx.characters?.lavinia?.react?.('bow');
      await this.wait(0.9);
    }
    void h;
  }

  _startOverture() {
    const { ctx } = this;
    let res;
    this._chord = new Promise((r) => { res = r; });
    this.h.lights.fade('floats', 0.14, 2); // the tab edge glows faintly with pit light
    let fired = false;
    const chord = () => { if (fired) return; fired = true; res(); };
    // the pit pianola: The Empress March, the 12 s roll the player loaded, heard from below
    this._ov = ctx.audio?.pianola?.('empressMarch', { gain: 0.95, onLastChord: chord, onEnd: () => { chord(); this.h.lights.fade('floats', 0, 2); } }) || null;
    this.later(this._ov ? 11.5 : 9.7, chord); // backstop (and the silent build)
  }

  /** A press on GO button i (a real click on the panel). */
  press(i) {
    const { ctx } = this;
    if (this._phase !== 'cues') return;
    this.panel.userData.press(i);
    const live = this._live;
    if (live < 0) {
      ctx.audio?.play('click', { gain: 0.3 });
      if (!this.aside.busy) this._line('finale.cues.early', { who: 'pike', aside: true, hold: 1.2 });
      return;
    }
    const c = CUES[live];
    if (i === c.dept) {
      ctx.audio?.play('cueGo', { gain: 0.7 });
      this._greens.add(i);
      this._restJewels();
      ctx.characters?.pike?.react?.('tick');
      this.aside.cut();
      this.line.release();
      const r = this._goResolve; this._goResolve = null; r?.();
      return;
    }
    // wrong: a buzz, Pike's line, the cue stays live
    ctx.audio?.play('error', { gain: 0.4 });
    ctx.state.inc('wrong.cues');
    this._nagAt = this._liveT + 8;
    const k = ctx.dialogue.cycle('finale.cues.wrong');
    if (k) this._line(k, { who: 'pike', aside: true, hold: 1.6 });
  }

  /** Each cue's effect: the system the player restored, firing. */
  async _fire(run, i) {
    const { ctx } = this;
    const { audio, tween, characters } = ctx;
    const h = this.h, L = h.lights;
    const lav = characters?.lavinia;
    switch (i) {
      case 0: { // Q31 HOUSE: the warm glow past the tabs dies
        audio?.play('houseSwitch', { gain: 0.6 });
        L.fade('house', 0, 2.2);
        audio?.setRoomAmbience?.(null);
        await this.wait(2.4); this._guard(run);
        await this._line('finale.houseout', { who: 'pike' });
        break;
      }
      case 1: { // Q32 SOUND: the overture, from the pit
        this._startOverture();
        await this.wait(1.6);
        break;
      }
      case 2: { // Q33 FLY: the tabs fly out; the dark house; two amber eyes in the Royal Box
        audio?.play('curtainSwish', { gain: 0.8 });
        const o = { t: h.tabs.open };
        this._tabsOut = tween.to(o, { t: 1 }, { duration: 4.5, ease: 'inOutCubic', onUpdate: () => h.tabs.setOpen(o.t) });
        L.fade('houseGlow', 0.5, 3);
        L.fade('floats', 0, 3);
        characters?.cat?.setPose?.('sit', 1.2);
        characters?.cat?.lookAt?.([-1.4, 1.2, -2.4]);
        await this.wait(1.2);
        break;
      }
      case 3: { // Q34 LX: moonlight; Lavinia, cloaked, discovered at the lighthouse door
        audio?.play('dimmerGo', { gain: 0.6 });
        L.apply(LOOKS.moon, 3);
        tween.run(3, (k) => lav?.setGlowLight?.(0.3 + 0.6 * k));
        lav?.react?.('perk');
        await this.wait(3);
        break;
      }
      case 4: { // Q35 FX: wind and rain from below; streaks across the light; the painted sea shimmers
        this._stormLoops(true, 2);
        h.storm.setRain(1);
        h.storm.setSea(1);
        lav?.react?.('drift');
        await this.wait(2.2); this._guard(run);
        await this._line('finale.play.ezra1', { who: 'lavinia', label: 'Ezra', voice: EZRA });
        break;
      }
      case 5: { // Q36 WARDROBE: the cloak whips away into the flies; the storm gown
        lav?.react?.('uncloak');
        audio?.play('ghostShimmer', { gain: 0.6 });
        await this.wait(1.6); this._guard(run);
        this._dir('finale.trigger.climb', 2.4);
        ctx.camera.lookAtPoint(LOOK_LAMPROOM); // tilt up with her: the lamp room clears the surtitles
        await lav?.moveTo?.(h.perches.laviniaLantern.position, { duration: 2.8, rotationY: h.perches.laviniaLantern.rotationY });
        this._guard(run);
        break;
      }
      case 6: { // Q37 LX: the lamp blazes; the beam sweeps the empty house; limes full on her
        audio?.play('lampBlaze', { gain: 0.8 });
        L.apply({ ...LOOKS.lamp }, 1.6);
        h.truck.setBeam(true, 0.6);
        lav?.react?.('flourish');
        await this.wait(2.6);
        break;
      }
      case 7: { // Q38 FX: thunder; the flash box whites the stage
        audio?.play('thunderCrack', { gain: 0.9 });
        h.storm.flash();
        ctx.camera.shake?.(0.05, 0.6);
        lav?.react?.('flinch');
        await this.wait(1.8); this._guard(run);
        await this._line('finale.play.ezra2', { who: 'lavinia', label: 'Ezra', voice: EZRA });
        break;
      }
      case 8: { // Q39 FLY: the tabs fall; silence
        audio?.play('curtainSwish', { gain: 0.8, pitch: 0.9 });
        const o = { t: h.tabs.open };
        await tween.to(o, { t: 0 }, { duration: 2.4, ease: 'inQuad', onUpdate: () => h.tabs.setOpen(o.t) });
        this._guard(run);
        this._stormLoops(false, 1.2);
        h.storm.setRain(0); h.storm.setSea(0);
        break;
      }
      case 9: break; // Q40: the ending takes it from here
    }
  }

  _stormLoops(on, fade = 1.5) {
    if (on) {
      this.loop('windMachine', { speed: 0.65, gain: 0.55, fade });
      this.loop('rainBox', { gain: 0.5, fade });
      this.loop('storm', { gain: 0.45, fade });
    } else {
      for (const n of ['windMachine', 'rainBox', 'storm']) this.stopLoop(n, fade);
    }
  }

  // =====================================================================================================================
  // THE CURTAIN CALL (between Q39 and Q40): applause, Pike takes the call, the review
  // =====================================================================================================================
  async _call(run) {
    const { ctx } = this;
    const { state, audio, tween, characters, dialogue } = ctx;
    const h = this.h;
    const lav = characters?.lavinia, pike = characters?.pike, cat = characters?.cat;
    this._phase = 'call';
    this._cinematic(true);
    this.page.set(9, -1);
    this._restJewels();
    if (!state.get('finale.called')) {
      // silence; two soft pats beyond the tabs; the imagined house
      await this.wait(1.8); this._guard(run);
      audio?.play('catApplause', { gain: 0.9 });
      // she leaves the lamp room the way a ghost does: gone from the lantern, there again on her mark in the lime
      lav?.react?.('fade');
      await this.wait(1.4); this._guard(run);
      const mark = h.perches.laviniaFinale;
      if (lav?.group) { lav.group.position.set(...mark.position); lav.group.rotation.y = mark.rotationY; }
      lav?.react?.('appear');
      ctx.camera.lookAtPoint(LOOK_VANTAGE);
      await this.wait(1.4); this._guard(run);
      await this._say(run, 'finale.applause');
      // the call: Pike takes line 1 himself
      await this._say(run, 'finale.call');
      pike?.react?.('press');
      await this.wait(0.35); this._guard(run);
      this.panel.userData.press(2);
      this.panel.userData.setJewel(2, 'green');
      audio?.play('cueGo', { gain: 0.6 });
      audio?.play('curtainSwish', { gain: 0.8 });
      const o = { t: h.tabs.open };
      tween.to(o, { t: 1 }, { duration: 3.6, ease: 'inOutCubic', onUpdate: () => h.tabs.setOpen(o.t) });
      // frame the bow: her in the lime, the Royal Box at the left
      ctx.camera.lookAtPoint(LOOK_BOW);
      await this.wait(2.4); this._guard(run);
      cat?.react?.('pat'); audio?.play('catPat', { gain: 0.7 });
      this.later(0.5, () => audio?.play('catPat', { gain: 0.6 }));
      lav?.react?.('bow');
      const feet = new THREE.Vector3(...h.perches.laviniaFinale.position).add(new THREE.Vector3(0, 0.05, 0));
      burst(ctx, this.group, feet.toArray(), { color: '#ffffff', color2: '#e6f0ff', count: 70, radius: 0.55, duration: 2.4, size: 0.03 });
      audio?.play('lilyShimmer', { gain: 0.45 });
      await this.wait(2.6); this._guard(run);
      state.set('finale.called', true);
    } else {
      ctx.camera.lookAtPoint(LOOK_BOW);
    }
    // the review
    let id = state.get('review', null);
    if (!REVIEWS.includes(id)) {
      await this._say(run, 'ending.review.ask');
      const def = ctx.papers.def('certificate');
      const options = REVIEWS.map((r) => ({ id: r, text: ctx.script[`ending.review.text.${r}`] }));
      const ui = reviewPaper(ctx, { def, options });
      this._ui = ui;
      ctx.audio?.play('page', { gain: 0.5 });
      const pick = await ui.promise; this._guard(run);
      id = pick.id;
      state.set('review', id);
      await this.wait(0.6); this._guard(run);
      await this._say(run, 'ending.review.read');
      ui.close(); this._ui = null;
      lav?.react?.(id === 'seen' ? 'gasp' : id === 'long' ? 'laugh' : 'flourish');
      await this._say(run, `ending.review.${id}`);
    }
    // back to the panel for Q40, the Royal Box still in the top left
    ctx.camera.lookAtPoint(LOOK_Q40);
    this._cinematic(false);
    this._phase = 'cues';
  }

  // =====================================================================================================================
  // THE ENDING (after Q40): thanks, the fades, the empty stage, the dawn, "Not vacant.", the credits
  // =====================================================================================================================
  async _ending(run) {
    const { ctx } = this;
    const { state, audio, characters, tween } = ctx;
    const h = this.h;
    const lav = characters?.lavinia, pike = characters?.pike, cat = characters?.cat;
    this._phase = 'ending';
    state.solve('cues');
    ctx.game.stopTimer();
    this._cinematic(true);
    ctx.hud.setVisible(false);
    ctx.journal.setVisible?.(false);
    // Q40: the house blazes gold for the first time since 1931
    audio?.play('houseLightsUp', { gain: 0.8 });
    h.lights.apply(LOOKS.houseup, 2.5);
    ctx.camera.lookAtPoint(new THREE.Vector3(-4.6, 1.8, 1.0));
    await this.wait(2.8); this._guard(run);
    lav?.react?.('chest');
    await this._say(run, 'ending.thanks');
    pike?.react?.('tick');
    await this._say(run, 'ending.pike');
    // Pike fades; then she does, and leaves a lily shimmer on the prompt desk
    pike?.react?.('fade');
    await this.wait(1.8); this._guard(run);
    lav?.react?.('fade');
    audio?.play('ghostShimmer', { gain: 0.4, pitch: 0.8 });
    await this.wait(1.4); this._guard(run);
    this.lily.set(1);
    audio?.play('lilyShimmer', { gain: 0.6 });
    ctx.camera.lookAtPoint(this.lily.object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-0.9, 0.35, -0.2)));
    // the empty stage; the applause of one cat
    await this.wait(3.0); this._guard(run);
    ctx.camera.lookAtPoint(new THREE.Vector3(-5.2, 2.2, 1.6)); // the empty stage, the Royal Box at left
    await this.wait(1.4); this._guard(run);
    cat?.react?.('pat'); audio?.play('catPat', { gain: 0.8 });
    await this.wait(0.55); this._guard(run);
    audio?.play('catPat', { gain: 0.7 });
    await this.wait(2.6); this._guard(run);

    // dawn: the stage door from inside the Green Room
    await ctx.transitions.fadeOut(1.6); this._guard(run);
    lav?.remove?.(); pike?.remove?.();
    this._lookOverride = { env: 0.25, exposure: 0.9 };
    ctx.scene.environmentIntensity = 0.25; ctx.renderer.setExposure(0.9);
    ctx.renderer.setBloom(0.22, { threshold: 0.95, radius: 0.4 }); // a grey morning, not a glare
    h.lights.apply({ ...LOOKS.houseup, flash: 0 }, 0);
    this.dawn.show(true);
    this.dawn.setOpen(0);
    ctx.camera.setVantage(this.dawn.vantage);
    await this.wait(0.4); this._guard(run);
    await ctx.transitions.fadeIn(1.6); this._guard(run);
    audio?.play('doorOpen', { gain: 0.6 });
    tween.run(3.2, (k) => this.dawn.setOpen(k), { ease: 'inOutCubic' });
    this.later(0.8, () => audio?.play('dawnBirds', { gain: 0.8 }));
    await this.wait(3.4); this._guard(run);
    await this._say(run, 'ending.dawn');
    await this.wait(1.2); this._guard(run);

    // the clipboard: Remarks, your review, and in her hand: Not vacant.
    await ctx.transitions.fadeOut(1.0); this._guard(run);
    const def = ctx.papers.def('certificate');
    const id = state.get('review', 'triumph');
    const clip = clipboardShot(ctx, { def, review: ctx.script[`ending.review.text.${id}`], words: String(ctx.script['ending.notvacant'] || 'Not vacant.') });
    this._ui = clip;
    this.dawn.show(false);
    await ctx.transitions.fadeIn(0.6); this._guard(run);
    await clip.promise; this._guard(run);
    this._ui = null;
    await ctx.transitions.fadeOut(1.2); this._guard(run);
    clip.close();
    await this._credits(run, { fresh: true });
  }

  /** Credits over the empty stage, the ghost light back centre stage. fresh: straight on from the dawn (under a fade). */
  async _credits(run, { fresh }) {
    const { ctx } = this;
    const { state, audio } = ctx;
    this._phase = 'credits';
    this._cinematic(true);
    ctx.hud.setVisible(false);
    ctx.inventory.setVisible(false);
    ctx.journal.setVisible?.(false);
    this._lookOverride = null;
    ctx.renderer.setBloom(this.bloom.strength, this.bloom);
    this.stopLoop('windMachine'); this.stopLoop('rainBox'); this.stopLoop('storm');
    this.restore(10);
    this._placeCast(10);
    this.h.tabs.setOpen(1);
    ctx.camera.setVantage(VANTAGE);
    ctx.camera.autoPan = { speed: 0.05, amp: 0.45 };
    if (fresh) { await this.wait(0.3); this._guard(run); await ctx.transitions.fadeIn(1.6); this._guard(run); }
    const id = state.get('review', 'triumph');
    const S = (k) => ctx.script?.[k];
    const secs = state.elapsed;
    let best = Number(store.get(BEST_KEY)) || 0;
    // FIXED BY integration-qa: floor, as fmtTime does: Math.round stored 3983 for a 3982.6 s run, so the credits said
    // 1:06:22 and the title's best said 1:06:23
    if (secs >= 1 && (!best || secs < best)) { store.set(BEST_KEY, String(Math.floor(secs))); }
    const bestLine = best && best < secs && S('credits.best') ? String(S('credits.best')).replace('{time}', fmtTime(best)) : '';
    const texts = {
      masthead: S('credits.masthead'), dateline: S('credits.dateline'),
      headline: S(`credits.headline.${id}`), standfirst: S(`credits.standfirst.${id}`),
      roll: ['cast', '', 'house', 'crew', '', 'end'].flatMap((k) => (k ? String(S(`credits.roll.${k}`) || '').split('\n') : [''])),
      time: String(S('credits.time') || 'Running time: {time}.').replace('{time}', fmtTime(secs)),
      best: bestLine,
      foot: S('credits.foot'),
    };
    audio?.overture?.play?.({ gain: 0.85 });
    const ui = creditsRoll(ctx, texts, { onAgain: () => this.playAgain() });
    this._ui = ui;
    this._creditsUi = ui;
    await ui.promise; this._guard(run);
    this._ui = null;
  }

  /** Back to the title (a reload keeps only the harmless flags; the slot stays with the tab). */
  playAgain() {
    const { ctx } = this;
    ctx.state.save();
    const q = new URLSearchParams(location.search);
    const keep = new URLSearchParams();
    for (const k of ['dev', 'mute', 'nobloom', 'lowq', 'slot']) if (q.has(k)) keep.set(k, q.get(k));
    const s = keep.toString();
    location.href = location.pathname + (s ? `?${s}` : '');
  }

  // =====================================================================================================================
  // PER FRAME
  // =====================================================================================================================
  update(dt) {
    if (!this.h) return;
    this.h.lights.update(dt);
    this._applyRigLook();
    // a live cue with no press: Lavinia holds in tableau and asks (8 s, then every 15 s)
    if (this._live >= 0) {
      const c = this.ctx;
      const quiet = !c.dialogue.isOpen && !c.papers.isOpen && !c.journal.isOpen;
      if (quiet) this._liveT += dt;
      if (quiet && this._liveT >= this._nagAt && !this.aside.busy) {
        this._nagAt = this._liveT + 15;
        const k = c.dialogue.cycle('finale.cues.wait');
        if (k) this._line(k, { who: 'lavinia', aside: true, hold: 2.4 });
      }
    }
  }

  _applyRigLook(force = false) {
    const rig = this.h.lights;
    const env = this._lookOverride?.env ?? rig.env, ex = this._lookOverride?.exposure ?? rig.exposure;
    this.envIntensity = env; this.exposure = ex;
    if (this.ctx.game?.currentRoom !== this) return;
    if (force || env !== this._env) { this.ctx.scene.environmentIntensity = env; this._env = env; }
    if (force || ex !== this._ex) { this.ctx.renderer.setExposure(ex); this._ex = ex; }
  }

  // =====================================================================================================================
  // HINTS
  // =====================================================================================================================
  /** hint.cues.<qNN>.3 names the department of the cue standing by or live. */
  hintVariant(p) {
    if (p !== 'cues' || this._current < 0) return null;
    return CUES[this._current].q;
  }
  prereqMet() { return this._phase === 'cues'; }
}

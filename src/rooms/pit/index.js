// The Orchestra Pit & Under-stage (docs/rooms/pit.md). SET-pit built the set (set.js, props.js), the delights, the
// stairs door, the winch-handle loose end and the state restore. PUZZLES-pit wired the five puzzles, one file each
// (tuning.js → pianoroll.js → thunder.js → wind.js → rain.js; each header is the exact mechanism), and the room hooks
// here: checkMusic / checkStorm (MUSIC from pianoroll; STORM from whichever of thunder, wind, rain completes last; with
// both, Pike's pike.go.foyer and exit.foyer.green), prereqMet, looseEnd (the winch handle), glint, onNudge.
// Hooks, framings and what must not be merged: docs/notes/set-pit.md; the puzzles: docs/notes/puzzles-pit.md.
import * as THREE from 'three';
import { Room } from '../../engine/Room.js';
import { mergeStatic } from '../../engine/props/util.js';
import { burst } from '../../engine/props/particles.js';
import { buildSet } from './set.js';
import { glint as glintSprite } from '../wardrobe/props.js';
import tuning, { START_CENTS } from './tuning.js';
import pianoroll from './pianoroll.js';
import thunder from './thunder.js';
import wind, { GALE } from './wind.js';
import rain from './rain.js';

export default class PitRoom extends Room {
  static id = 'pit';
  static title = 'The Pit';
  static vantage = { position: [-0.85, 1.6, 6.25], lookAt: [0.55, 1.05, -2.2], yawLimit: 80, pitchLimit: 25, fov: 60 };
  static puzzleOrder = ['tuning', 'pianoroll', 'thunder', 'wind', 'rain'];
  static nudgeSeconds = 90;
  static glintSeconds = 180;

  get backLabel() { return 'Up to the stage'; }
  onBack() { this.openDoor('pit.steps'); return true; }

  async build() {
    const { ctx } = this;
    const { hotspots, state, dialogue, papers, inventory, audio, journal } = ctx;
    const solved = (p) => state.isSolved(p);

    // ---- look -----------------------------------------------------------------------------------------------
    this.background = new THREE.Color('#060404');
    this.fog = new THREE.FogExp2('#0c0806', 0.045);
    this.envIntensity = 0.3;
    this.exposure = 1.1;
    this.bloom = { strength: 0.38, threshold: 0.84, radius: 0.5 };

    const h = buildSet(ctx, this.group);
    this.h = h;
    const keep = (o) => { if (o) o.userData.keep = true; return o; };
    /** A hotspot (usually on a proxy box) that highlights `glow`. */
    const spot = (id, object, label, glow, opts = {}) => hotspots.add({ id: `pit.${id}`, object, label, highlight: glow ? keep(glow) : true, ...opts });
    const focus = (f, scope, extra = {}) => ctx.camera.focus({ ...f, scope, ...extra });

    // ---- door: the steps up to the stage (with the winch-handle loose end) ----------------------------------------
    this.addDoor({
      id: 'pit.steps', object: h.doors.stairs.object, to: 'stage', label: 'Steps up to the stage', highlight: keep(h.doors.stairs.stair),
      onOpen: async () => {
        if (journal.delivered('storm') && !this._handleTaken() && !state.get('pit.loose.said')) {
          state.set('pit.loose.said', true);
          await dialogue.say('loose.winch_handle.pit');
        }
      },
    });

    // the trap room through the arch: a sub-view where the storm machines live (Back returns to the pit)
    hotspots.add({ id: 'pit.trapRoom', object: h.trapRoom.proxy, label: 'The trap room', highlight: false, onClick: () => focus(h.trapRoom.focus, 'focus:pit.trap') });

    // ==========================================================================================================
    // PUZZLES (one file each: tuning → pianoroll → thunder → wind → rain). Each registers its hotspots, close-ups and
    // choreography, and returns { restore }.
    // ==========================================================================================================
    const P = h.pianola;
    this.spot = spot;
    this.puzzles = [tuning, pianoroll, thunder, wind, rain].map((fn) => fn(ctx, this, h));
    hotspots.add({ id: 'pit.tunercard', object: P.cardProxy, label: "Pozzi's card", highlight: keep(P.card), scope: ['room', 'focus:pit.pianola'], onClick: () => papers.show('tunercard') });

    // the winch handle glints on its shaft until taken (2 triangles)
    this._handleGlint = glintSprite({ size: 0.08, phase: 2.4 });
    this._handleGlint.position.set(0.04, -0.12, 0.03);
    h.winch.handle.add(this._handleGlint);

    // ---- documents ------------------------------------------------------------------------------------------
    // FIXED BY qa-pit: desk-only, so a click on the far-off desk opens its close-up (score, band plan and baton
    // together) instead of jumping straight to the score paper and leaving the band plan undiscovered
    spot('score', h.conductor.scoreProxy, 'Score', h.conductor.score, { scope: 'focus:pit.desk', onClick: () => papers.show('score') });
    spot('bandplan', h.conductor.bandplanProxy, 'Band plan', h.conductor.bandplan, { scope: 'focus:pit.desk', onClick: () => papers.show('bandplan') });

    // ==========================================================================================================
    // DELIGHTS
    // ==========================================================================================================
    // the five dust sheets (sliding them off is never wrong) and what is under them
    h.sheets.forEach((s, i) => {
      spot(`sheet.${s.n}`, s.group, s.label || 'Dust sheet', null, { // POLISH: per-sheet label
        enabled: () => !s.isOff(),
        onClick: () => {
          s.setOff(1); audio.play('dustSheet', { gain: 0.7 });
          const arr = this._sheets(); arr[i] = 1; state.set('pit.sheets', arr);
        },
      });
    });
    const inst = h.instruments;
    const under = (n) => () => h.sheets[n - 1].isOff();
    spot('harp', inst.harp, 'Harp', null, { enabled: under(1), onClick: () => { inst.harp.userData.gliss(); audio.play('harpGliss'); dialogue.caption('pit.delight.harp'); } });
    spot('tuba', inst.tuba, 'Tuba', null, { enabled: under(2), onClick: () => { inst.tuba.userData.peek(); dialogue.caption('pit.delight.tuba'); } });
    spot('cello', inst.cello, 'Cello', null, { enabled: under(3), onClick: () => dialogue.caption('pit.delight.cello') });
    spot('drums', inst.drums, 'Drum kit', null, {
      enabled: () => under(4)() && h.mallet.place !== 'drum',
      onClick: () => { h.drums.snareTap(); audio.play('snareTap'); dialogue.caption('pit.delight.drums'); },
    });
    spot('trombone', inst.trombone, 'Trombone', null, { enabled: under(5), onClick: () => dialogue.caption('pit.delight.trombone') });
    // the stencil on the thunder sheet
    spot('scottish', h.thunder.stencilProxy, 'Stencil', null, {
      scope: ['focus:pit.trap', 'focus:pit.thunder'],
      enabled: () => !solved('thunder') && inventory.selected !== 'mallet',
      onClick: () => dialogue.auto('pit.delight.scottish'),
    });
    // FIXED BY qa-pit: desk close-up only (see the score / band plan note)
    spot('baton', h.conductor.batonProxy, 'Baton', h.conductor.baton, { scope: 'focus:pit.desk', onClick: () => { h.conductor.tapBaton(); audio.play('batonTap'); dialogue.caption('pit.delight.baton'); } });
    hotspots.add({ id: 'pit.desk', object: h.conductor.group.userData.desk, label: "Conductor's stand", highlight: true, onClick: () => focus(h.conductor.focus, 'focus:pit.desk') });
    spot('chairs', h.chairs.group, 'Chairs and stands', null, { onClick: () => dialogue.caption('pit.delight.chairs') });
    spot('stalls', h.stalls, 'The stalls', null, { onClick: () => dialogue.caption('pit.delight.stalls') });
    // the keys: sour before tuning, clean after
    let keyLineAt = -99;
    spot('keys', P.keyProxy, 'Keys', null, {
      scope: ['room', 'focus:pit.pianola'],
      onClick: (info) => {
        const n = info?.point ? P.keyAt(info.point) : 39;
        const clean = solved('tuning');
        P.tapKey(n, 0.35);
        audio.play('pianoKey', { note: P.keyName(n), sour: !clean });
        const now = performance.now() / 1000;
        if (now - keyLineAt > 12) { keyLineAt = now; dialogue.auto(clean ? 'pit.delight.keys' : 'pit.delight.keys.sour'); if (!clean) this.ctx.characters?.lavinia?.react?.('flinch'); }
      },
    });
    spot('flashbox', h.flash.group, 'Flash box', h.flash.glass, {
      scope: 'focus:pit.trap',
      enabled: () => journal.delivered('storm'),
      onClick: () => { h.flash.lightning(); audio.thunderSheet?.('crack', { gain: 0.25 }); dialogue.caption('pit.delight.flashbox'); },
    });
    // the trap winch: turns once, the trap bangs, the handle comes off (loose end for the Foyer)
    // from the trap view the winch opens its close-up (the enamel plate reads there); in the close-up it turns
    spot('trap', h.winch.proxy, 'Trap winch', h.winch.group, {
      scope: ['focus:pit.trap', 'focus:pit.winch'],
      onClick: () => {
        if (this.ctx.hotspots.scope !== 'focus:pit.winch') return focus(h.winch.focus, 'focus:pit.winch');
        return this._handleTaken() ? dialogue.caption('pit.winch.nohandle') : this._turnWinch();
      },
    });
    spot('winch.handle', h.winch.handleProxy, 'Winch handle', h.winch.handle, { scope: ['focus:pit.trap', 'focus:pit.winch'], enabled: () => !this._handleTaken(), onClick: () => this._turnWinch() });

    this._restore();
    state.on?.('reset', () => this._restore());
    mergeStatic(this.group, [], { hotspots });
  }

  // ---- state ---------------------------------------------------------------------------------------------------
  _sheets() { const s = this.ctx.state.get('pit.sheets'); return Array.isArray(s) ? [...s] : [0, 0, 0, 0, 0]; }
  _handleTaken() { const { state, inventory } = this.ctx; return !!state.get('pit.handleTaken') || inventory.has('winch_handle'); }

  /** Visual state from ctx.state (instant). */
  _restore() {
    const { state, inventory, journal } = this.ctx;
    const h = this.h, P = h.pianola;
    const solved = (p) => state.isSolved(p);
    // tuning
    const cents = solved('tuning') ? [0, 0, 0] : (state.get('pit.cents') || START_CENTS);
    P.setCents(cents);
    P.setInBay(false); P.setLid(0); this._lidOpen = false; this._lidT = 0; this._lavAside = false;
    // rolls
    for (const n of h.rolls.NUMBERS) h.rolls.setInRack(n, true);
    if (solved('pianoroll')) { P.setRollLoaded(103); h.rolls.setInRack(103, false); } else P.setRollLoaded(state.get('pit.roll') || null);
    h.rolls.show(null);
    // sheets + the beater
    const sh = this._sheets();
    if (solved('thunder')) sh[3] = 1;
    h.sheets.forEach((s, i) => s.setOff(sh[i] ? 1 : 0, true));
    const taken = inventory.has('mallet') || !!state.get('pit.mallet.taken');
    h.mallet.setPlace(solved('thunder') ? 'hook' : taken ? 'gone' : 'drum');
    // wind + rain
    h.wind.setOiled(!!state.get('pit.oiled') || solved('wind'));
    h.wind.setGovernor(solved('wind'));
    h.wind.setCrankAngle(null);
    const idler = solved('rain') ? 24 : state.get('pit.idler');
    if (idler) h.rain.fit(idler); else h.rain.unfit();
    h.storm.setWind(solved('wind') ? GALE : 0);
    h.rain.setRaining(solved('rain'));
    // winch handle
    h.winch.setHandle?.(!this._handleTaken());
    this._handleGlint?.userData.setOn(!this._handleTaken());
    h.winch.turn?.(0);
    h.trap.setOpen(0);
    // the puzzles' own transient state (a held gear, a roll on the lectern, the drum's speed …)
    for (const p of this.puzzles || []) p?.restore?.();
    // deliverables already earned (quiet)
    if (solved('pianoroll')) journal.deliver('music', { quiet: true });
    if (solved('thunder') && solved('wind') && solved('rain')) journal.deliver('storm', { quiet: true });
    if (journal.delivered('music') && journal.delivered('storm') && !state.get('exit.foyer.green')) state.set('exit.foyer.green', true);
  }

  // ---- deliverables -----------------------------------------------------------------------------------------------
  /** MUSIC: ticks when `pianoroll` is solved (with its line), then the foyer check. */
  async checkMusic() {
    const { state, journal, dialogue } = this.ctx;
    if (!state.isSolved('pianoroll') || journal.delivered('music')) return;
    journal.deliver('music');
    await dialogue.say('pit.done.music');
    await this._checkFoyer();
  }

  /** STORM: ticks from whichever of thunder, wind and rain completes last. */
  async checkStorm() {
    const { state, journal, dialogue, characters } = this.ctx;
    if (!['thunder', 'wind', 'rain'].every((p) => state.isSolved(p)) || journal.delivered('storm')) return;
    if (this._stormBusy) return;
    this._stormBusy = true;
    try {
      journal.deliver('storm');
      characters?.lavinia?.react?.('flourish');
      await dialogue.say('pit.done.storm');
      await this._checkFoyer();
    } finally { this._stormBusy = false; }
  }

  /** Both lines ticked: Pike presses his pocket cue switch here; the FRONT OF HOUSE cue light on the stage goes green. */
  async _checkFoyer() {
    const { state, journal, dialogue, characters, audio } = this.ctx;
    if (!journal.delivered('music') || !journal.delivered('storm') || state.get('exit.foyer.green')) return;
    state.set('exit.foyer.green', true);
    characters?.pike?.react?.('press');
    audio?.play('cueLightGreen', { gain: 0.4 });
    await dialogue.say('pike.go.foyer');
  }

  /** A pause in a choreography (game time; resolves even if the player leaves). */
  wait(s) { return this.ctx.tween.delay(s); }

  /** Lavinia drifts off the pianola lid (true) while a pianola close-up is open, and back onto it (false). */
  _liftLavinia(aside) {
    const h = this.h, lav = this.ctx.characters?.lavinia;
    if (this._lavAside === !!aside) return;
    this._lavAside = !!aside;
    if (!lav) return;
    const p = aside ? h.perches.laviniaTuning : h.perches.lavinia;
    lav.moveTo?.(p.position, { rotationY: p.rotationY, pose: aside ? 'hover' : 'perch', duration: 0.9 });
  }

  _placeCast() {
    const { characters, state } = this.ctx;
    const h = this.h;
    const lav = characters?.lavinia;
    if (lav) {
      const p = this._lavAside ? h.perches.laviniaTuning : h.perches.lavinia;
      lav.placeAt(this.group, { ...p, costume: state.isSolved('dummy') ? 'storm' : 'evening' });
    }
    characters?.pike?.placeAt(this.group, { ...h.perches.pike, scope: ['room', 'focus:pit.trap', 'focus:pit.wind', 'focus:pit.rain', 'focus:pit.winch'], hotspot: { onClick: () => { this.ctx.dialogue.auto(this.ctx.dialogue.cycle('pit.delight.pike')); characters.pike.react?.('nod'); } } });
  }

  // ---- delights / stubs with motion -----------------------------------------------------------------------------
  _openTuning() {
    const { ctx } = this;
    const h = this.h, P = h.pianola;
    this._lidOpen = true;
    this._lid(1); P.setInBay(true);
    this._liftLavinia(true);
    ctx.camera.focus({
      ...h.tuning.focus, scope: 'focus:pit.tuning', puzzle: 'tuning',
      onExit: () => {
        this._lidOpen = false;
        P.setInBay(false); this._lid(0);
        this._onTuningExit?.();
        this._liftLavinia(false);
      },
    });
  }

  /** The pianola lid swings open (1) or shut (0). */
  _lid(to) {
    const P = this.h.pianola, from = this._lidT ?? 0;
    this._lidT = to;
    this.ctx.tween.run(0.55, (k) => P.setLid(from + (to - from) * k), { ease: 'inOutSine' });
    this.ctx.audio.play('dustSheet', { gain: 0.15 });
  }

  _thunderAgain() {
    const { ctx } = this;
    this.h.thunder.crack();
    ctx.audio.thunderSheet?.('crack');
    ctx.characters?.lavinia?.react?.('shriek');
    ctx.dialogue.auto('pit.delight.thunderagain');
  }

  async _turnWinch() {
    const { ctx } = this;
    const h = this.h;
    if (this._winching) return;
    this._winching = true;
    try {
      ctx.audio.play('trapWinch');
      await h.winch.turnOnce(1.3);
      ctx.audio.play('trapdoorBang', { gain: 0.8 });
      await h.trap.bang();
      ctx.dialogue.auto('pit.delight.trap');
      if (!this._handleTaken()) {
        ctx.state.set('pit.handleTaken', true);
        h.winch.setHandle(false);
        ctx.inventory.add('winch_handle');
      }
    } finally { this._winching = false; }
  }

  // ---- lifecycle --------------------------------------------------------------------------------------------------
  enter({ from } = {}) {
    const { ctx } = this;
    const { state, dialogue, journal } = ctx;
    this._restore();
    this._placeCast();
    ctx.audio.setRoomAmbience?.('pit');
    const solved = (p) => state.isSolved(p);
    if (solved('wind')) { this.loop('windMachine', { speed: this.h.wind.audioSpeed(GALE), gain: 0.18, fade: 2 }); this.loop('lowWind', { gain: 0.25, fade: 2 }); }
    if (solved('rain')) this.loop('rainBox', { gain: 0.2, fade: 2 });
    this._ltnAt = 6 + Math.random() * 8;
    if (!state.get('pit.enter.seen')) {
      state.set('pit.enter.seen', true);
      this.later(0.7, () => dialogue.say('pit.enter').then(() => dialogue.say('pit.pike.hello')));
    } else if (journal.delivered('music') && journal.delivered('storm') && !state.get('pit.return.seen')) {
      state.set('pit.return.seen', true);
      this.later(0.8, () => dialogue.say('pit.return'));
    }
    ctx.characters?.lavinia?.lookAt?.(new THREE.Vector3(...this.constructor.vantage.position));
  }

  enterTitle() { this._restore(); this._placeCast(); }

  update(dt) {
    const h = this.h;
    if (!h) return;
    h.update(dt);
    // Pike stands behind the stage-front wall: he can only be seen from the trap-room views, so he is not drawn
    // from the pit (saves ~45k triangles at the vantage)
    const pike = this.ctx.characters?.pike;
    const inTrap = /^focus:pit\.(trap|wind|rain|thunder|crank|winch)/.test(this.ctx.hotspots.scope || '');
    if (pike?.group) pike.group.visible = inTrap;
    // the trap-room bulb's shadow map only re-renders while the camera is in the trap room; from the pit it is
    // a frozen glimpse through the arch (saves its caster pass, ~35k triangles, at the vantage)
    const sh = h.lights.keyT?.shadow;
    if (sh && sh.autoUpdate !== inTrap) { sh.autoUpdate = inTrap; sh.needsUpdate = true; }
    // after STORM: an occasional cold flash from the box
    if (this.ctx.journal.delivered('storm')) {
      this._ltnAt -= dt;
      if (this._ltnAt <= 0) { this._ltnAt = 17 + Math.random() * 8; h.flash.lightning(); }
    }
  }

  prereqMet(p) {
    const { state, inventory } = this.ctx;
    const s = (x) => state.isSolved(x);
    if (p === 'pianoroll') return s('tuning');                                    // soft: a roll loads but cannot solve
    if (p === 'wind') return !!state.get('pit.oiled') || inventory.has('oilcan');  // the oil can from the wardrobe
    if (p === 'rain') return !(state.get('pit.idler') === 24 && !s('wind'));       // seated: it waits for the wind
    return true;
  }

  /** The winch handle is a tracked loose end (DESIGN §5): STORM ticked and the handle still on the winch. */
  looseEnd() {
    return this.ctx.journal.delivered('storm') && !this._handleTaken() ? 'loose.winch_handle.pit' : null;
  }

  /** Stuck: make the wanted object catch the eye (a held item flashes in the bar instead). */
  glint(p) {
    const { ctx } = this;
    const h = this.h, { inventory, state } = ctx;
    const at = (o, dy = 0) => o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, dy, 0)).toArray();
    const puff = (o, dy, r = 0.2) => burst(ctx, this.group, at(o, dy), { count: 26, radius: r });
    if (p === 'tuning') puff(h.pianola.spoolProxy, 0.35, 0.3);
    if (p === 'pianoroll') puff(h.rolls.group, 0.75, 0.25);
    if (p === 'thunder') {
      if (inventory.has('mallet')) { inventory.flash('mallet'); puff(h.thunder.proxy, 0, 0.4); }
      else if (!h.sheets[3].isOff()) puff(h.sheets[3].group, 1.1, 0.35);
      else if (h.mallet.place === 'drum') { h.drums.crash?.(); puff(h.mallet.group, 0.05, 0.15); }
    }
    if (p === 'wind') {
      if (inventory.has('oilcan') && !state.get('pit.oiled')) inventory.flash('oilcan');
      puff(h.wind.dialProxy, 0.1, 0.25);
    }
    if (p === 'rain' && !h.rain.fitted) { h.rain.lift(24, true); this.later(1.2, () => { if (h.rain.fitted !== 24) h.rain.lift(24, false); }); }
  }

  /** The one idle nudge: a loose end outranks idle chatter (DESIGN §7). */
  onNudge() {
    const { dialogue } = this.ctx;
    dialogue.say(this.looseEnd() || dialogue.cycle('pit.idle'));
    return true;
  }
}

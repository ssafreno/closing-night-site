// The Stage (docs/rooms/stage.md): the hub. SET-stage built the set (set.js, props.js), the delights, the doors, the
// hub's cue-light logic, the lamp loose end and the state restore; PUZZLES-stage wired the five puzzles, one file each
// (ghostlight → mains → dimmer → flyrail, lighthouse), the deliverables (ghost, light, set), the exits and the hand-off
// to the finale (finaleReady() / goToFinale(): the prompt desk). See docs/notes/set-stage.md and
// docs/notes/puzzles-stage.md.
import * as THREE from 'three';
import { Room } from '../../engine/Room.js';
import { mergeStatic } from '../../engine/props/util.js';
import { buildSet, lookFor, VANTAGE, ARRIVALS } from './set.js';
import ghostlight from './ghostlight.js';
import mains from './mains.js';
import dimmer from './dimmer.js';
import flyrail from './flyrail.js';
import lighthouse from './lighthouse.js';

/** Which deliverables turn each exit's cue light green (DESIGN §5). The pass door is always open. */
const EXIT_NEEDS = { wardrobe: ['light', 'set'], pit: ['costume'], foyer: ['music', 'storm'], dressing: ['house'] };
/** Where each other room's delivering puzzle lives (for stage.return.<room>). */
const ROOM_DELIVERS = { wardrobe: ['costume'], pit: ['music', 'storm'], foyer: ['house'], dressing: ['script'] };

export default class StageRoom extends Room {
  static id = 'stage';
  static title = 'The Stage';
  static vantage = VANTAGE;
  static puzzleOrder = []; // from src/content/manifest.js: ghostlight, mains, dimmer, flyrail, lighthouse
  static nudgeSeconds = 90;
  static glintSeconds = 150;

  async build() {
    const { ctx } = this;
    const { hotspots, state, dialogue, papers, inventory, audio, journal } = ctx;
    const S = (k, f) => state.get(k, f);
    const solved = (p) => state.isSolved(p);
    const lit = () => solved('ghostlight');

    // ---- look (env and exposure follow the lighting rig; update() keeps them in step) -------------------------
    this.background = new THREE.Color('#030304');
    this.fog = new THREE.FogExp2('#050608', 0.012);
    this.bloom = { strength: 0.5, threshold: 0.8, radius: 0.55 };
    this.cssVignette = 0.45;

    const h = buildSet(ctx, this.group);
    this.h = h;

    const keep = (o) => { if (o) o.userData.keep = true; return o; };
    const spot = (...a) => this.spot(...a);

    // =====================================================================================================
    // PUZZLES (one file each; each returns { restore() })
    // =====================================================================================================
    this.puzzles = { ghostlight, mains, dimmer, flyrail, lighthouse };
    for (const [id, fn] of Object.entries(this.puzzles)) this.puzzles[id] = fn(ctx, this, h);

    // line 7's slate and the eight rope locks: 7 is the puzzle, the others are delights (the card's piece)
    spot('slate', h.flyrail.slate, 'Slate', h.flyrail.slate, { enabled: lit, onClick: () => this.focusRail() });
    h.ropes.forEach((rope) => spot(`rope.${rope.n}`, rope.hit, `Line ${rope.n}`, rope.lock, {
      enabled: lit,
      onClick: () => {
        if (rope.n === 7) { this.focusRail(); return; }
        audio?.play('ropeLock', { gain: 0.25 });
        dialogue.caption(`stage.delight.rope.${rope.key}`);
      },
    }));

    // =====================================================================================================
    // DOORS (cue lights: red = not yet, green = go; isOpen reads the exit.<room>.green flags)
    // =====================================================================================================
    const notYet = (room) => () => {
      if (lit() && dialogue.has(`pike.notyet.${room}`)) dialogue.say(`pike.notyet.${room}`);
      else dialogue.caption('caption.door.locked');
    };
    this.addDoor({
      id: 'stage.door.door', object: h.doors.door.object, to: 'door', highlight: keep(h.doors.door.leaf),
      label: 'Pass door (Green Room)', isOpen: () => true,
    });
    const exitDoors = [
      ['wardrobe', 'Iron stair: WARDROBE', h.doors.wardrobe.stair],
      ['pit', 'Hatch: ORCHESTRA', h.doors.pit.hatch],
      ['foyer', 'FRONT OF HOUSE', h.doors.foyer.leaf],
      ['dressing', 'DRESSING ROOMS', h.doors.dressing.leaf],
    ];
    for (const [room, label, glow] of exitDoors) {
      this.addDoor({
        id: `stage.door.${room}`, object: h.doors[room].object, to: room, label, highlight: glow ? keep(glow) : true,
        isOpen: () => !!S(`exit.${room}.green`),
        onLocked: notYet(room),
      });
    }
    // the prompt desk: the hand-off to the finale (every Running Order line ticked and the lamp in the lighthouse).
    // Pike takes the last page, tucks it into the book, and the tabs wipe us into the finale scene.
    this.addDoor({
      id: 'stage.desk', object: h.promptDesk.hit, to: 'finale', highlight: h.promptDesk.object,
      label: (open) => (open ? 'Prompt desk: places, please' : 'Prompt desk'),
      enabled: lit, transition: 'curtain', fade: 1.2,
      isOpen: () => this.finaleReady(),
      onLocked: () => {
        if (journal.delivered('script')) { dialogue.say('loose.lamp.finale'); return; }
        papers.show('promptbook');
      },
      onOpen: async () => {
        const pike = ctx.characters?.pike;
        pike?.react?.('nod');
        await dialogue.say('finale.lastpage');
        inventory.remove('lastpage');
        state.set('stage.finale.called', true);
      },
    });
    spot('cuepanel', h.promptDesk.panelHit, 'Cue-light panel', h.promptDesk.panel, {
      enabled: () => lit() && !journal.delivered('script'),
      onClick: () => dialogue.say('pike.notyet.finale'),
    });

    // =====================================================================================================
    // DELIGHTS
    // =====================================================================================================
    // the shimmer: the first click is Lavinia's note, then she gives hints (the dark state's hint hotspot)
    spot('shimmer', h.shimmer.hit, 'A shimmer in the air', null, {
      enabled: () => !lit(),
      onClick: () => {
        if (!S('stage.note.heard')) { state.set('stage.note.heard', true); dialogue.say('stage.enter.note'); return; }
        ctx.hints.ask();
      },
    });
    // the bosun's whistle: a sandbag lets go in the flies and lands a yard from you
    spot('whistle', h.whistle.hit, "Bosun's whistle", h.whistle.object, {
      enabled: lit,
      onClick: () => this.whistle(),
    });
    // the trapdoor sign: MIND THE GAP, then it has turned itself over
    spot('trapdoor.sign', h.trapdoor.signHit, 'Trapdoor sign', h.trapdoor.sign, {
      enabled: lit,
      onClick: async () => {
        if (!S('stage.trapdoor.read')) { state.set('stage.trapdoor.read', true); dialogue.caption('stage.delight.trapdoor'); return; }
        if (!S('stage.trapdoor.flipped')) {
          state.set('stage.trapdoor.flipped', true);
          audio?.play('click', { gain: 0.3 });
          await h.trapdoor.flipSign(ctx.tween, 1);
        }
        dialogue.caption('stage.delight.trapdoor.flip');
      },
    });
    spot('house', h.house.hit, 'The house', null, {
      enabled: () => lit() && h.tabs.open > 0.5,
      onClick: () => dialogue.say('stage.delight.house'),
    });
    spot('royalbox', h.royalBox.hit, 'Royal Box', h.royalBox.object, {
      enabled: () => lit() && h.tabs.open > 0.5,
      onClick: () => dialogue.caption('stage.delight.royalbox'),
    });
    spot('flats', h.flats.hit, 'Tavern flats', h.flats.object, { enabled: lit, onClick: () => dialogue.caption('stage.delight.flats') });
    spot('cloth', h.backcloth.object, 'Gull Point', null, {
      enabled: () => solved('flyrail'),
      onClick: () => dialogue.say('stage.delight.cloth'),
    });
    spot('trapdoor', h.trapdoor.hit, 'Trapdoor', h.trapdoor.leaf, {
      enabled: lit,
      onClick: () => dialogue.caption(S('stage.trapdoor.flipped') ? 'stage.delight.trapdoor.flip' : 'stage.delight.trapdoor'),
    });

    // =====================================================================================================
    // STATE RESTORE
    // =====================================================================================================
    this.restore();
    state.on?.('reset', () => this.restore());
    mergeStatic(this.group, [], { hotspots });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Helpers the puzzle modules use (room.spot, room.wait, ...)
  /** A hotspot `stage.<id>` on a proxy (or any object) that highlights `glow`. */
  spot(id, object, label, glow, opts = {}) {
    if (glow) glow.userData.keep = true;
    return this.ctx.hotspots.add({ id: `stage.${id}`, object, label, highlight: glow || true, ...opts });
  }
  /** Game-time pause (cancelled if the room is left). */
  wait(s) { return new Promise((r) => this.later(s, r)); }
  /** Resolves once fn() is true (polled every 0.1 s of game time). */
  until(fn) {
    return new Promise((r) => { const poll = () => { if (fn()) r(); else this.later(0.1, poll); }; poll(); });
  }
  isCurrent() { return this.ctx.game?.currentRoom === this; }
  /** Line 7's close-up (set by flyrail.js). */
  focusRail() { this._focusRail?.(); }

  /** Pike at the prompt desk, with his click (the chatter cycle). */
  placePike() {
    const { ctx } = this;
    const pike = ctx.characters?.pike;
    pike?.placeAt?.(this.group, {
      ...this.h.perches.pike,
      hotspot: { onClick: () => { pike.react?.('nod'); ctx.dialogue.say(ctx.dialogue.cycle('stage.delight.pike')); } },
    });
  }

  /** Tick a Running Order line from the stage, then any exits it turns green (Pike presses them). */
  async deliver(id) {
    const { state, dialogue, journal } = this.ctx;
    journal.deliver(id);
    if (journal.delivered('light') && journal.delivered('set') && !state.get('stage.done.said')) {
      state.set('stage.done.said', true);
      if (dialogue.has('stage.done')) await dialogue.say('stage.done');
    }
    for (const room of this.syncExits()) {
      if (room === 'foyer') { this.h.cueLights.foyer.userData.setState('green'); this.ctx.audio?.play('cueLightGreen', { gain: 0.5 }); }
      else await this.pikeGo(room);
    }
  }

  /** SET: both the cloth (flyrail) and the lighthouse → stage.done.set and the tick. */
  async checkSet() {
    const { state, dialogue, journal } = this.ctx;
    if (!state.isSolved('flyrail') || !state.isSolved('lighthouse') || journal.delivered('set')) return;
    await dialogue.say('stage.done.set');
    await this.deliver('set');
  }

  /** The finale hand-off: every Running Order line ticked and the lamp placed in the lighthouse. */
  finaleReady() {
    const { state, journal, manifest } = this.ctx;
    const lines = manifest?.runningOrder?.map((l) => l.id) || ['ghost', 'light', 'set', 'costume', 'music', 'storm', 'house', 'script'];
    return lines.every((id) => journal.delivered(id)) && !!state.get('stage.lampplaced');
  }
  /** Go to the finale through the prompt desk (Pike takes the last page, the tab-wipe). Resolves true if it went. */
  goToFinale() { return this.openDoor('stage.desk'); }

  // ---------------------------------------------------------------------------------------------------------------
  /** Visual state from ctx.state (instant). Safe to call any time; PUZZLES may call it after a solve. */
  restore() {
    const { state, inventory, journal } = this.ctx;
    const h = this.h;
    const S = (k, f) => state.get(k, f);
    const solved = (p) => state.isSolved(p);
    const lit = solved('ghostlight');

    // lights: the look for the save (dark, ghost, work, moon)
    h.lights.setState(lookFor(state));
    this._applyRigLook(true);

    // the ghost light, the plug, the dips, the shimmer
    h.shimmer.setLevel(lit ? 0 : 1, true);
    h.dips.setGlow(1);
    h.ghostLight.moveTo(h.ghostLight.home.x, h.ghostLight.home.z);

    // each puzzle's own pieces (fuses and handle, levers and wheel, line 7 and its iron, the truck)
    for (const p of Object.values(this.puzzles || {})) p.restore();

    // the trapdoor sign, the tabs open, the sandbag gone, the desk panel covered until the finale
    h.trapdoor.setFlipped(S('stage.trapdoor.flipped') ? 1 : 0);
    h.tabs.setOpen(1);
    h.sandbag.reset();
    h.promptDesk.setPanelCovered(true);

    // the cue lights
    for (const room of Object.keys(EXIT_NEEDS)) h.cueLights[room].userData.setState(S(`exit.${room}.green`) ? 'green' : 'red', true);
    h.cueLights.door.userData.setState('off', true);

    // quiet re-ticks (a reload mid-sequence must not lose the journal)
    if (lit) { journal.pin('runningorder', { quiet: true }); journal.deliver('ghost', { quiet: true }); }
    if (solved('dimmer')) journal.deliver('light', { quiet: true });
    if (solved('flyrail') && solved('lighthouse')) journal.deliver('set', { quiet: true });
  }

  /** Each exit whose Running Order lines are ticked gets its flag; returns the rooms that just turned green. */
  syncExits() {
    const { state, journal } = this.ctx;
    const fresh = [];
    for (const [room, needs] of Object.entries(EXIT_NEEDS)) {
      if (state.get(`exit.${room}.green`)) continue;
      if (!needs.every((d) => journal.delivered(d))) continue;
      state.set(`exit.${room}.green`, true);
      fresh.push(room);
    }
    return fresh;
  }

  /** Pike turns a cue light green: he presses, a soft ding, the lamp swaps, his line. */
  async pikeGo(room) {
    const { ctx } = this;
    const pike = ctx.characters?.pike;
    pike?.react?.('press');
    ctx.audio?.play('cueLightGreen', { gain: 0.5 });
    this.h.cueLights[room]?.userData.setState('green');
    if (ctx.dialogue.has(`pike.go.${room}`)) await ctx.dialogue.say(`pike.go.${room}`);
  }

  _placeCast() {
    const { ctx } = this;
    const h = this.h;
    const lit = ctx.state.isSolved('ghostlight');
    const lav = ctx.characters?.lavinia, pike = ctx.characters?.pike;
    if (lit) {
      lav?.placeAt?.(this.group, { ...h.perches.lavinia });
      this.placePike();
    } else {
      lav?.remove?.();
      pike?.remove?.();
    }
  }

  /** The bosun's whistle: a sandbag lets go in the flies and lands about a yard in front of you. */
  async whistle() {
    const { ctx } = this;
    if (this._whistling) return;
    this._whistling = true;
    try {
      const h = this.h;
      h.sandbag.reset();
      ctx.audio?.play('bosunWhistle', { gain: 0.6 });
      const cam = ctx.camera.camera;
      const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd); fwd.y = 0;
      if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
      fwd.normalize();
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const p = cam.position.clone().addScaledVector(fwd, 1.5).addScaledVector(side, 0.45);
      p.x = THREE.MathUtils.clamp(p.x, -7.8, 7.8); p.z = THREE.MathUtils.clamp(p.z, -6.0, 5.0);
      // not into the orchestra hatch or the trap
      if (Math.abs(p.x + 5.8) < 0.8 && Math.abs(p.z - 2.6) < 1.1) p.x = -4.6;
      if (Math.abs(p.x) < 0.8 && Math.abs(p.z - 0.6) < 0.7) p.z = 1.5;
      await new Promise((r) => this.later(0.35, r));
      await h.sandbag.drop(p.x, p.z, ctx.tween);
      ctx.audio?.play('sandbagThud', { gain: 0.9 });
      ctx.camera.shake?.(0.045, 0.4);
      await ctx.dialogue.say('stage.delight.whistle');
    } finally { this._whistling = false; }
  }

  /** The lamp loose end: used on the lighthouse after Wardrobe. Room click, no focus view. */
  placeLamp() {
    const { ctx } = this;
    if (!ctx.state.isSolved('lighthouse')) { ctx.dialogue.say('loose.lamp'); return; }
    ctx.inventory.remove('lamp');
    ctx.state.set('stage.lampplaced', true);
    ctx.audio?.play('drop', { gain: 0.4 });
    this.h.truck.setLampPlaced(true);
    this.h.truck.glint(true);
    this.later(2.5, () => this.h.truck.glint(false));
    ctx.dialogue.say('loose.lamp.placed');
  }

  // ---------------------------------------------------------------------------------------------------------------
  enter({ from } = {}) {
    const { ctx } = this;
    const { state, dialogue, journal, inventory } = ctx;
    this.restore();
    this._placeCast();
    ctx.audio?.setRoomAmbience?.('stage');
    if (state.isSolved('mains')) this.loop('dimmerHum', { gain: 0.12, fade: 1.5 });

    // the beats on entry, in order: the first-visit line, newly green exits, a return line, the finale call, the lamp
    const beats = [];
    if (!state.get('stage.enter.seen')) {
      state.set('stage.enter.seen', true);
      if (!state.isSolved('ghostlight')) beats.push(() => dialogue.say('stage.enter'));
    }
    if (state.isSolved('ghostlight')) {
      // exits that turned green while we were elsewhere: Pike presses them now (the foyer's line is his, in the pit)
      for (const room of this.syncExits()) {
        this.h.cueLights[room]?.userData.setState('red', true);
        if (room === 'foyer') beats.push(() => { this.h.cueLights.foyer.userData.setState('green'); ctx.audio?.play('cueLightGreen', { gain: 0.5 }); });
        else beats.push(() => this.pikeGo(room));
      }
      if (from && ROOM_DELIVERS[from]?.every((d) => journal.delivered(d)) && !state.get(`stage.return.${from}.seen`)) {
        state.set(`stage.return.${from}.seen`, true);
        beats.push(() => dialogue.say(`stage.return.${from}`));
      }
      if (journal.delivered('script') && !state.get('stage.beginners.said')) {
        state.set('stage.beginners.said', true);
        beats.push(async () => {
          await dialogue.say(state.get('stage.lampplaced') ? 'pike.beginners' : 'loose.lamp.finale');
          if (this.finaleReady()) {
            this.glint('desk');
            // FIXED BY integration-qa: arriving from the dressing room (the usual way in with the last page) the desk is
            // ~76° off to the left, out of frame; turn the view to it so the glint is seen
            const desk = ctx.hotspots.get?.('stage.desk')?.object;
            if (desk) ctx.camera.lookAtPoint?.(desk.getWorldPosition(new THREE.Vector3()));
          }
        });
      } else if (inventory.has('lamp') && !state.get('stage.lampplaced')) {
        beats.push(() => dialogue.say('loose.lamp'));
      }
    }
    if (beats.length) this.later(0.8, async () => { for (const b of beats) { try { await b(); } catch (e) { console.error(e); } } });
  }

  /** Title backdrop: the stage with only the ghost light, no characters, no dialogue. */
  enterTitle() {
    const h = this.h;
    this.restore();
    this._placeCast();
    if (!this.ctx.state.isSolved('ghostlight')) {
      h.lights.setState('ghost');
      h.shimmer.setLevel(0.6, true);
      h.ghostLight.setPlugHome(false); h.ghostLight.cable.showTo(1);
      this._applyRigLook(true);
    }
    this.ctx.characters?.lavinia?.remove?.();
    this.ctx.characters?.pike?.remove?.();
  }

  exit() {
    this.h.sandbag.reset();
  }

  /** A hub: arrive facing into the stage from whichever door you came through. */
  vantageFor(from) {
    if (from === 'dressing' && this.ctx.state.isSolved('flyrail')) return ARRIVALS.dressingClothIn;
    if ((from === 'door' || from == null) && this._setIn() && !this.ctx.game?._titleMode) return ARRIVALS.setIn; // FIXED BY integration-qa
    return ARRIVALS[from] || VANTAGE;
  }

  // FIXED BY integration-qa: SET (cloth in, truck on blue) hides the wardrobe stair from the door arrival and VANTAGE.
  // Called by the flyrail and lighthouse solves just before their exitFocus, so the camera tweens back to ARRIVALS.setIn.
  _setIn() { const s = this.ctx.state; return s.isSolved('flyrail') && s.isSolved('lighthouse'); }
  retargetHub() {
    const cam = this.ctx.camera;
    const p = cam?.vantage?.position;
    if (!p || !this._setIn()) return;
    const near = (a) => p.distanceTo(new THREE.Vector3(...a)) < 0.05;
    if (!near(ARRIVALS.door.position) && !near(VANTAGE.position)) return;
    const v = ARRIVALS.setIn, pos = new THREE.Vector3(...v.position);
    const d = new THREE.Vector3(...v.lookAt).sub(pos).normalize();
    const DEG = Math.PI / 180;
    cam.vantage = { position: pos, yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(d.y), yawLimit: v.yawLimit * DEG, pitchLimit: v.pitchLimit * DEG, fov: v.fov };
    cam.yaw = cam.targetYaw = 0; cam.pitch = cam.targetPitch = 0;
  }

  _applyRigLook(force = false) {
    const rig = this.h.lights;
    const env = rig.env, ex = rig.exposure;
    this.envIntensity = env; this.exposure = ex;
    if (this.ctx.game?.currentRoom !== this) return;
    if (force || env !== this._env) { this.ctx.scene.environmentIntensity = env; this._env = env; }
    if (force || ex !== this._ex) { this.ctx.renderer.setExposure(ex); this._ex = ex; }
  }

  update(dt) {
    if (!this.h) return;
    this.h.lights.update(dt);
    this._applyRigLook();
  }

  prereqMet(p) {
    const s = (x) => this.ctx.state.isSolved(x);
    if (p === 'mains') return s('ghostlight');
    if (p === 'dimmer') return s('mains');
    if (p === 'flyrail' || p === 'lighthouse') return s('mains');
    return true;
  }

  looseEnd() {
    const { state, inventory } = this.ctx;
    if (inventory.has('lamp') && !state.get('stage.lampplaced')) return 'loose.lamp';
    return null;
  }

  /** Stuck: pulse the current puzzle's object. */
  glint(p) {
    const h = this.h;
    if (p === 'ghostlight') { h.dips.setGlow(2.2); this.later(1.2, () => h.dips.setGlow(1)); }
    if (p === 'mains') for (const o of [h.bucket, h.propsTable, h.cleat]) if (o.fuse.visible) o.glint.visible = true;
    if (p === 'flyrail') { h.battenTag.setLit(1.8); this.later(1.2, () => h.battenTag.setLit(this.h.lights.level('flyLamp'))); }
    if (p === 'lighthouse') { h.truck.glint(true); this.later(1.5, () => h.truck.glint(false)); }
    if (p === 'desk') { h.promptDesk.setLamp(1.8); this.later(1.2, () => h.promptDesk.setLamp(1)); }
  }

  onNudge() {
    this.ctx.dialogue.say(this.ctx.dialogue.cycle('stage.idle'));
    return true;
  }
}

import * as THREE from 'three';

/**
 * Base class for rooms. Extend it, set the statics, implement build/enter/exit/update.
 * Conventions: metres, +Y up, the room group's origin is the floor centre, eye height 1.6.
 * The full contract is docs/ENGINE_API.md §2.
 */
export class Room {
  static id = 'room';
  static title = '';
  static vantage = { position: [0, 1.6, 2.6], lookAt: [0, 1.4, 0], yawLimit: 70, pitchLimit: 25, fov: 60 };
  /** Puzzle ids in intended solve order (hints). Left empty, Game fills it from src/content/manifest.js. */
  static puzzleOrder = [];
  /** Seconds without progress before the one-time idle nudge (per room per save). null/0 = never. */
  static nudgeSeconds = 90;
  /** Seconds without progress before Hints calls this.glint(puzzleId) (then every 10 s until progress). 0 = never. */
  static glintSeconds = 180;

  constructor(ctx) {
    this.ctx = ctx;
    this.group = new THREE.Group();
    this.group.name = this.constructor.id;
    this.built = false;
    // Scene look, applied by Game on enter / title. Set these in build().
    this.background = new THREE.Color(0x0b0806);
    this.fog = null;                 // e.g. new THREE.FogExp2(0x1a1008, 0.04)
    this.envIntensity = 0.35;        // scene.environmentIntensity (reflections on brass etc.)
    this.exposure = 1.0;             // renderer tone mapping exposure
    this.bloom = null;               // null = engine default, or { strength, threshold, radius }
    this._updaters = new Set();
    this._loops = new Set();         // audio loops started with this.loop(): stopped on exit
    this._timers = new Set();        // this.later() jobs: cancelled on exit
    this.doors = new Map();          // id → door spec (addDoor)
  }

  get id() { return this.constructor.id; }
  get title() { return this.constructor.title || this.constructor.id; }

  /** Called once, lazily, before the first enter (or title). Build geometry, lights, hotspots; restore visuals from ctx.state. */
  async build() {}

  /** Called on each entry. Place characters, start loops, play the intro once. `from` = previous room id or null. */
  enter({ from } = {}) {}

  /** Title-screen background mode: no dialogue, no hotspots. Default: nothing. Override to place characters etc. */
  enterTitle() {}

  /** Called on leaving. Loops started with this.loop() and this.later() timers are stopped for you after this. */
  exit() {}

  /** Per-frame while current. */
  update(dt, t) {}

  /** Hints: is this puzzle currently attemptable? */
  prereqMet(puzzleId) { return true; }

  /** Hints: a script key for a one-time remark about something left behind in an earlier room, or null. */
  looseEnd() { return null; }

  /** Hints: a suffix so Hints says `hint.<id>.<suffix>.<n>` when that key exists, or null. */
  hintVariant(puzzleId) { return null; }

  /**
   * Hints: the player has been stuck for glintSeconds; pulse the current puzzle's object once (a glint, a glow). Called
   * every 10 s until progress. Leave undefined for no glint. (Not defined here so Hints can tell.)
   */
  // glint(puzzleId) {}

  /**
   * The vantage to use when arriving from room `from` (null = fresh load / title). Default: the static vantage.
   * A hub room with several doors can return a different { position, lookAt, ... } per arrival.
   */
  vantageFor(from) { return this.constructor.vantage; }

  // ---- helpers ---------------------------------------------------------------------------------------------

  /**
   * Register something animated: an Object3D with `userData.update(dt, t)` or a function (dt, t) => {}.
   * Objects built by the props library that carry userData.update and are inside this.group at the end of
   * build() are registered automatically. Returns an unregister function.
   */
  animate(objOrFn) {
    const fn = typeof objOrFn === 'function' ? objOrFn : objOrFn?.userData?.update;
    if (!fn) return () => {};
    this._updaters.add(fn);
    return () => this._updaters.delete(fn);
  }

  /** Start an audio loop that belongs to this room: it is stopped automatically when the player leaves. */
  loop(name, opts) {
    this._loops.add(name);
    this.ctx.audio?.loop?.(name, opts);
  }
  /** Stop a loop started with this.loop(). */
  stopLoop(name, fade) {
    this._loops.delete(name);
    this.ctx.audio?.stopLoop?.(name, fade);
  }

  /**
   * Run `fn` after `seconds` of game time, unless the player has left the room by then (cancelled on exit).
   * Returns a cancel function.
   */
  later(seconds, fn) {
    const job = this.ctx.tween.delay(seconds);
    let live = true;
    const cancel = () => { if (!live) return; live = false; this._timers.delete(cancel); job.cancel(); };
    this._timers.add(cancel);
    job.then(() => { if (!live) return; live = false; this._timers.delete(cancel); try { fn(); } catch (e) { console.error(e); } });
    return cancel;
  }

  /**
   * A wrong attempt at a puzzle (DESIGN §7): error sound, the count `wrong.<puzzleId>` goes up, and on the 1st, 3rd and
   * every 3rd attempt after that a line from `<room>.<puzzleId>.wrong.1..n` (taken in turn; dialogue.cycle), else
   * `fallback` (a key or text). Strings show as captions, line-arrays are spoken. Returns the new count. Reset the
   * puzzle's pieces yourself. `always`: speak on every attempt.
   */
  wrong(puzzleId, { fallback = null, caption = false, always = false } = {}) {
    const { ctx } = this;
    ctx.audio?.play('error', { gain: 0.4 });
    const n = ctx.state.inc(`wrong.${puzzleId}`);
    if (!always && n !== 1 && n % 3 !== 0) return n;
    const what = ctx.dialogue.cycle(`${this.id}.${puzzleId}.wrong`) || fallback;
    if (what) {
      if (caption) ctx.dialogue.caption(what);
      else ctx.dialogue.auto(what);
    }
    return n;
  }

  /**
   * A door (or any exit) to another room, with the common pattern built in:
   *   locked → `onLocked()` (a function, a script key / text, or the default line), open → optional `onOpen()`
   *   animation (awaited), then `game.goToRoom(to)`.
   * @param {{ id: string, object: THREE.Object3D, to: string, label?: string|Function, isOpen?: () => boolean,
   *   onLocked?: Function|string, onOpen?: Function, scope?: string|string[], enabled?: () => boolean,
   *   lockedLabel?: string|Function, fade?: number, transition?: 'fade'|'curtain' }} spec
   * @returns the hotspot record. `this.doors.get(id)` keeps the spec; `this.openDoor(id)` runs it from code.
   */
  addDoor(spec) {
    const { ctx } = this;
    const { id, object, to } = spec;
    if (!id || !object || !to) throw new Error('addDoor needs { id, object, to }');
    const isOpen = spec.isOpen || (() => true);
    const targetTitle = () => ctx.game.registry.get(to)?.title || to;
    const label = () => {
      const open = safe(isOpen);
      const l = open ? spec.label : (spec.lockedLabel ?? spec.label);
      if (typeof l === 'function') return l(open);
      return l || `To ${targetTitle()}`;
    };
    const door = { ...spec, isOpen, label };
    this.doors.set(id, door);
    return ctx.hotspots.add({
      id, object, label, scope: spec.scope || 'room', enabled: spec.enabled,
      highlight: spec.highlight ?? true,
      onClick: () => this.openDoor(id),
    });
  }

  /** Try a door registered with addDoor (as if clicked). Resolves true if the room changed. */
  async openDoor(id) {
    const { ctx } = this;
    const d = this.doors.get(id);
    if (!d) return false;
    if (!safe(d.isOpen)) {
      ctx.audio?.play('error', { gain: 0.25 });
      const l = d.onLocked;
      if (typeof l === 'function') { try { await l(); } catch (e) { console.error(e); } }
      else if (typeof l === 'string') ctx.dialogue.auto(l);
      else ctx.dialogue.auto(ctx.dialogue.has('caption.door.locked') ? 'caption.door.locked' : 'It will not open.');
      return false;
    }
    if (!ctx.game.registry.has(d.to)) {
      console.warn(`[door] ${id}: room "${d.to}" is not registered yet`);
      ctx.dialogue.caption(ctx.dialogue.has('caption.door.unbuilt') ? 'caption.door.unbuilt' : 'Not built yet.');
      return false;
    }
    ctx.hotspots.lock();
    try {
      ctx.audio?.play('doorOpen', { gain: 0.6 });
      if (d.onOpen) { try { await d.onOpen(); } catch (e) { console.error(e); } }
    } finally { ctx.hotspots.unlock(); }
    await ctx.game.goToRoom(d.to, { duration: d.fade ?? 0.6, transition: d.transition || 'fade' });
    return true;
  }

  /** Engine internal: collect props' userData.update after build. */
  _collectUpdaters() {
    this.group.traverse((o) => { if (typeof o.userData?.update === 'function') this._updaters.add(o.userData.update); });
  }

  /** Engine internal: after exit(), stop what the room started through the helpers. */
  _afterExit() {
    for (const name of this._loops) this.ctx.audio?.stopLoop?.(name);
    this._loops.clear();
    for (const cancel of [...this._timers]) cancel();
  }

  /** Engine internal: per-frame. */
  _tick(dt, t) {
    for (const fn of this._updaters) {
      try { fn(dt, t); } catch (e) { console.error(e); this._updaters.delete(fn); }
    }
    this.update(dt, t);
  }
}

function safe(fn) { try { return !!fn(); } catch (e) { console.error(e); return false; } }

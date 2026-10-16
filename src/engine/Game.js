import * as THREE from 'three';
import { Renderer } from './Renderer.js';
import { CameraRig } from './CameraRig.js';
import { Interaction } from './Interaction.js';
import { State } from './State.js';
import { Inventory } from './Inventory.js';
import { Dialogue } from './Dialogue.js';
import { Papers } from './Papers.js';
import { HUD } from './HUD.js';
import { Title } from './Title.js';
import { Transitions } from './Transitions.js';
import { Tween } from './Tween.js';
import { Hints } from './Hints.js';
import { AudioEngine } from './Audio.js';
import { Journal } from './Journal.js';
import { makeCharacters } from './CompanionStub.js';
import { CHARACTERS } from './characters/index.js';
import { store, SLOT } from './storage.js';

async function loadContent(path, names) {
  try {
    const mod = await import(path);
    for (const n of names) if (mod[n]) return mod[n];
    if (mod.default) return mod.default;
    console.warn(`[content] ${path} has no export named ${names.join('/')}`);
  } catch (e) {
    console.warn(`[content] could not load ${path}:`, e.message);
  }
  return {};
}

function parseFlags() {
  const q = new URLSearchParams(location.search);
  const list = (k) => (q.get(k) || '').split(',').map((s) => s.trim()).filter(Boolean);
  const flags = {};
  for (const kv of list('flags')) {
    const [k, v = 'true'] = kv.split('=');
    flags[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
  }
  return {
    room: q.get('room'),
    dev: q.has('dev') && q.get('dev') !== '0',
    bloom: !q.has('nobloom'),
    lowq: q.has('lowq'),
    keep: q.has('keep'),
    mute: q.has('mute'),
    noprebuild: q.has('noprebuild'), // ENGINE-FIX: rooms build only on entry (for measuring cold transitions)
    solve: list('solve'),
    items: list('items'),
    papers: list('papers'),
    deliver: list('deliver'),
    flags,
  };
}

/** Builds a tiny warm "room" and PMREMs it so metals (brass, iron, glass) have something to reflect. */
function makeEnvironment(renderer) {
  const s = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), new THREE.MeshBasicMaterial({ color: 0x2a1c14, side: THREE.BackSide }));
  box.position.y = 2;
  s.add(box);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ color: 0x1a110b }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.99;
  s.add(floor);
  const panel = (color, intensity, w, h, pos, rotY = 0, rotX = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.rotation.set(rotX, rotY, 0);
    s.add(m);
  };
  panel(0xffb066, 6, 2.2, 1.4, [-4.9, 1.6, 0.5], Math.PI / 2);   // warm fire-ish
  panel(0xffd9a0, 3.5, 1.4, 1.4, [0, 4.9, 0], 0, Math.PI / 2);   // ceiling glow
  panel(0x9fb8ff, 3, 1.2, 2.2, [4.9, 2, -1.5], -Math.PI / 2);    // cool window
  panel(0xffc890, 2, 3, 1, [0, 1.5, -4.9]);                     // back warm
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(s, 0.04).texture;
  pmrem.dispose();
  return tex;
}

export class Game {
  /**
   * @param {{ rooms: Array<typeof import('./Room.js').Room>, startRoom?: string, titleRoom?: string,
   *   manifest?: object, startKit?: (ctx) => void }} opts
   *   manifest: src/content/manifest.js (rooms, puzzleOrder, running order, items, papers, characters).
   *   startKit: called on a new game (and on a fresh ?room= jump) to hand out starting items / journal pins.
   */
  constructor({ rooms = [], startRoom = 'door', titleRoom = null, manifest = {}, startKit = null } = {}) {
    this.flags = parseFlags();
    this.dev = this.flags.dev;
    this.startRoom = startRoom;
    this.titleRoom = titleRoom;
    this.manifest = manifest;
    this._startKitFn = startKit;
    this.registry = new Map();
    for (const R of rooms) this.register(R);
    this.instances = new Map();
    this.currentRoom = null;
    this.timerRunning = false;
    this._titleMode = false;
    this._transitioning = false;
    this.time = 0;
    // ENGINE-FIX: idle pre-build of the next room (see _maybePrebuild)
    this._enteredAt = 0;
    this._lastInputAt = 0;
    this._prebuilding = null;
    this._buildGen = 0;
    this.prebuilt = {}; // id -> { build, compile } ms, for testing
  }

  register(RoomClass) {
    if (!RoomClass || !RoomClass.id) { console.warn('[game] room class without static id', RoomClass); return; }
    // puzzle order: the room's own static wins; else the content manifest's
    if (!RoomClass.puzzleOrder?.length || !Object.prototype.hasOwnProperty.call(RoomClass, 'puzzleOrder')) {
      const m = (this.manifest.rooms || []).concat(this.manifest.devRooms || []).find((r) => r.id === RoomClass.id);
      if (m?.puzzleOrder?.length) RoomClass.puzzleOrder = [...m.puzzleOrder];
    }
    if (!RoomClass.title) {
      const m = (this.manifest.rooms || []).find((r) => r.id === RoomClass.id);
      if (m?.title) RoomClass.title = m.title;
    }
    this.registry.set(RoomClass.id, RoomClass);
  }

  get roomIds() { return [...this.registry.keys()]; }
  get elapsed() { return this.ctx.state.elapsed; }

  async init() {
    const loading = document.createElement('div');
    loading.className = 'cn-loading';
    loading.textContent = 'Front of house is opening…';
    document.body.appendChild(loading);
    this._loading = loading;

    // fonts first: canvas textures bake text at build time
    if (document.fonts) {
      const faces = ['32px "Abril Fatface"', '32px "IM Fell English"', 'italic 32px "IM Fell English"', '32px "Special Elite"', '32px "Homemade Apple"', '32px "CN Hand Caps"', '500 16px "Inter"', '600 16px "Inter"']; // POLISH: + CN Hand Caps
      // POLISH: load() tests a space by default, which the capitals-only face's unicode-range excludes; give it capitals
      await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f, f.includes('Caps') ? 'AZ' : undefined).catch(() => null))), new Promise((r) => setTimeout(r, 2500))]);
    }

    const [script, papers, items] = await Promise.all([
      loadContent('../content/script.js', ['script', 'SCRIPT']),
      loadContent('../content/papers.js', ['papers', 'PAPERS']),
      loadContent('../content/items.js', ['items', 'ITEMS']),
    ]);

    const canvas = document.getElementById('game-canvas');
    const ui = document.getElementById('ui');
    this._vignetteEl = document.createElement('div');
    this._vignetteEl.className = 'cn-vignette';
    canvas.after(this._vignetteEl);
    const renderer = new Renderer(canvas, { bloom: this.flags.bloom, lowQuality: this.flags.lowq });
    renderer.three.info.autoReset = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0806);
    scene.environment = makeEnvironment(renderer.three);
    scene.environmentIntensity = 0.35;

    const ctx = {
      game: this, scene, renderer, ui, THREE,
      script, papers, items, manifest: this.manifest,
      tween: new Tween(),
      state: new State(),
    };
    this.ctx = ctx;
    ctx.audio = new AudioEngine();
    if (store.get('closing-night.muted') === '1' || this.flags.mute) ctx.audio.setMuted(true);
    this.slot = SLOT;
    if (SLOT) console.log(`[game] save slot "${SLOT}"`);
    ctx.transitions = new Transitions(ctx);
    ctx.transitions.cover();
    ctx.hud = new HUD(ctx);
    ctx.camera = new CameraRig(ctx);
    ctx.hotspots = new Interaction(ctx, canvas);
    ctx.inventory = new Inventory(ctx);
    ctx.dialogue = new Dialogue(ctx);
    ctx.paperDefs = papers;            // raw content from content/papers.js
    ctx.papers = new Papers(ctx);      // the Papers UI (contract name)
    ctx.journal = new Journal(ctx);
    ctx.hints = new Hints(ctx);
    ctx.title = new Title(ctx);
    ctx.characters = makeCharacters(ctx, CHARACTERS);
    ctx.companion = ctx.characters.lavinia;
    ctx.hud.syncMute();
    if (this.dev) ctx.hud.enableFps();

    renderer.setScene(scene, ctx.camera.camera);
    this.scene = scene;
    this.renderer = renderer;

    window.addEventListener('keydown', (e) => this._onKey(e));
    // ENGINE-FIX: the pre-build waits for a still pointer, so its hitch never lands under a drag or a click
    const touched = () => { this._lastInputAt = performance.now(); };
    for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, touched, { capture: true, passive: true });

    this._clock = new THREE.Clock();
    renderer.three.setAnimationLoop(() => this._frame());
    // When the browser throttles requestAnimationFrame (an embedded pane, a busy machine) tweens crawl and a dial
    // clicked twice seems to ignore the second click. If no frame has run for a while, drive one from a timer.
    this._lastFrameAt = performance.now();
    this._watchdog = setInterval(() => {
      if (!document.hidden && performance.now() - this._lastFrameAt > 120) this._frame();
    }, 50);
    window.closingNight = this; // debugging handle
    this.debug = this._debugHelpers();
    return this;
  }

  /**
   * Esc closes the topmost thing: confirm → paper → journal → item inspect → (a choice must be answered) → the line on
   * screen, or a narrator caption → the close-up → the selected item → room.onBack().
   */
  _onKey(e) {
    const c = this.ctx;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && c.papers.isOpen) { c.papers.turnPage(e.key === 'ArrowLeft' ? -1 : 1); return; }
    if (e.key !== 'Escape') return;
    if (c.hud._confirmClose) { c.hud._confirmClose(); return; }
    if (c.papers.isOpen) { c.papers.hide(); return; }
    if (c.journal.isOpen) { c.journal.close(); return; }
    if (c.inventory.inspecting) { c.inventory.closeInspect(); return; }
    // a choice must be answered: Esc leaves it be
    if (c.dialogue.choosing) return;
    // ENGINE-FIX: a line or caption on screen closes on its own first; the next Esc leaves the close-up (it used to
    // do both)
    if (c.dialogue.isOpen && c.dialogue.dismiss()) return;
    if (c.dialogue.captionShowing) { c.dialogue.hideCaption(); return; }
    if (c.camera.inFocus && !this._transitioning && !c.hotspots.locked) { if (!this._focusBack()) c.camera.exitFocus(); return; } // POLISH: onBack first
    if (c.inventory.selected) { c.inventory.deselect(); return; }
    this._roomBack();
  }

  /**
   * HUD Back (and Esc with nothing else to close): leave the close-up; with no close-up open, ask the room first
   * (`room.onBack()`: return true when it handled it, e.g. the landing walking down, the cellar turning from the stair).
   */
  back() {
    const c = this.ctx;
    if (c.papers.isOpen) { c.papers.hide(); return; }
    if (c.journal.isOpen) { c.journal.close(); return; }
    if (c.camera.inFocus) { if (!this._focusBack()) c.camera.exitFocus(); return; } // POLISH: onBack first
    this._roomBack();
  }
  /** POLISH: the open close-up's own Back (focus({ onBack })), true when it handled the press. */
  _focusBack() {
    const pose = this.ctx.camera.focusPose;
    try { return !!pose?.onBack?.(); } catch (err) { console.error(err); return false; }
  }
  _roomBack() {
    const c = this.ctx;
    if (this._transitioning || c.hotspots.locked || this._titleMode) return false;
    try { return !!this.currentRoom?.onBack?.(); } catch (err) { console.error(err); return false; }
  }

  /**
   * Start according to URL flags: ?room= jumps straight in (fresh state unless &keep), else the title.
   * Dev jump flags (applied after the fresh state): &solve=a,b &items=x,y &papers=p,q (collected into the journal)
   * &deliver=light,set (running-order deliverables) &flags=k=v,k2.
   */
  async boot() {
    const f = this.flags;
    if (f.room) {
      const { state, inventory, journal } = this.ctx;
      if (!f.keep || !state.load()) { state.reset(); this._startKit(); }
      for (const id of f.solve) state.solve(id);
      for (const [k, v] of Object.entries(f.flags)) state.set(k, v);
      for (const id of f.items) inventory.add(id, { silent: true });
      for (const id of f.deliver) journal.deliver(id, { quiet: true });
      if (!this.registry.has(f.room)) console.warn(`[game] ?room=${f.room} is not registered. Registered: ${this.roomIds.join(', ')}`);
      this._hideLoading();
      await this.goToRoom(this.registry.has(f.room) ? f.room : this._fallbackRoom(), { fade: false });
      // after the room is built: a room may register its own papers (the test rooms do)
      for (const id of f.papers) journal.collect(id, { quiet: true });
      return;
    }
    this.ctx.state.load();
    await this.showTitle();
  }

  /** A new game's starting kit (main.js passes `startKit`; by default nothing). */
  _startKit() {
    try { this._startKitFn?.(this.ctx); } catch (e) { console.error('[game] startKit failed', e); }
  }

  _fallbackRoom() {
    if (this.registry.has(this.startRoom)) return this.startRoom;
    const first = this.roomIds.find((id) => !id.startsWith('_')) || this.roomIds[0];
    if (first !== this.startRoom) console.info(`[game] startRoom "${this.startRoom}" is not built yet; starting in "${first}"`);
    return first;
  }

  _hideLoading() {
    if (!this._loading) return;
    const l = this._loading;
    l.classList.add('cn-hidden');
    setTimeout(() => l.remove(), 700);
    this._loading = null;
  }

  async _ensureBuilt(id) {
    if (this.instances.has(id)) {
      const room = this.instances.get(id);
      if (!room.built && room._building) await room._building; // ENGINE-FIX: a pre-build in flight finishes first
      return room;
    }
    const Cls = this.registry.get(id);
    const room = new Cls(this.ctx);
    this.instances.set(id, room);
    room._building = (async () => {
      try {
        await room.build();
      } catch (e) {
        console.error(`[game] ${id}.build() failed`, e);
        this.ctx.hud.toast(`Room "${id}" failed to build — see console`);
      }
      room._collectUpdaters();
      room.built = true;
    })();
    await room._building;
    room._building = null;
    return room;
  }

  /**
   * ENGINE-FIX: pre-build the next room while the player is idle, so walking into it skips the build and most of the
   * shader compile (door → stage cold took seconds; QA saw ~15 s on a slow GPU). The next room is the first unbuilt one
   * in play order, never a dev room or the finale (it is staged from the whole run, and entered once). One room ahead
   * at most: the next waits until the player has visited the last one built. It runs once the current room has
   * settled (2.5 s in) and the pointer and keys have been still for 1.2 s, with no line typing, no camera move and no
   * press: the build is one synchronous chunk and would otherwise hitch a drag. Rooms are kept built after a visit
   * anyway, so this only brings forward memory the run would use.
   */
  _maybePrebuild() {
    if (this._prebuilding || this._titleMode || this._transitioning || !this.currentRoom || this.flags.noprebuild) return;
    const now = performance.now(), c = this.ctx;
    if (now - this._enteredAt < 2500 || now - this._lastInputAt < 1200) return;
    // a line still typing would stutter; one finished and waiting to be read is as idle as the room
    if ((c.dialogue.isOpen && !c.dialogue._line?.done) || c.camera.mode === 'tween' || c.hotspots._press) return;
    const order = (this.manifest.rooms || []).map((r) => r.id);
    const last = order[order.length - 1];
    // bounded: one room ahead at most; nothing more until the player has been in the one already waiting
    if (order.some((r) => this.instances.has(r) && this.instances.get(r) !== this.currentRoom && !c.state.get(`visits.${r}`))) return;
    const id = order.find((r) => r !== last && !r.startsWith('_') && this.registry.has(r) && !this.instances.has(r));
    if (!id) return;
    this._prebuilding = id;
    const gen = this._buildGen;
    const run = () => this._prebuild(id, gen)
      .catch((e) => console.error(`[game] pre-build of ${id} failed`, e))
      .finally(() => { this._prebuilding = null; this._lastInputAt = performance.now(); }); // and space the next one out
    if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 1000 }); else setTimeout(run, 0);
  }

  async _prebuild(id, gen) {
    if (gen !== this._buildGen || this.instances.has(id) || this._titleMode) return;
    const t0 = performance.now();
    const room = await this._ensureBuilt(id);
    const t1 = performance.now();
    if (gen !== this._buildGen || room === this.currentRoom || room.group.parent) { this.prebuilt[id] = { build: Math.round(t1 - t0) }; return; }
    // compile its shaders as they will be drawn there: its own lights (the current room's hidden for the moment) and
    // its fog, against the shared scene. compile() is synchronous; only the wait for the GPU is async.
    const { scene } = this.ctx, three = this.ctx.renderer.three, cur = this.currentRoom?.group;
    const fog = scene.fog, wasVisible = cur?.visible;
    let ready = null;
    try {
      if (cur) cur.visible = false;
      scene.fog = room.fog ?? null;
      ready = three.compileAsync(room.group, this.ctx.camera.camera, scene);
    } catch (e) { /* not fatal: the entry compile still runs */ } finally {
      scene.fog = fog;
      if (cur) cur.visible = wasVisible;
    }
    // upload its textures now too (the first frame in the room otherwise does it behind the cover)
    const seen = new Set();
    room.group.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'bumpMap']) {
        const t = m[k];
        if (t && !seen.has(t) && t.isTexture && !t.isRenderTargetTexture && t.image) { seen.add(t); try { three.initTexture(t); } catch (e) { /* skip */ } }
      }
    });
    try { await ready; } catch (e) { /* not fatal */ }
    this.prebuilt[id] = { build: Math.round(t1 - t0), compile: Math.round(performance.now() - t1), textures: seen.size };
  }

  /** Drop every built room so the next visit rebuilds it from current state (used after a reset). */
  _discardInstances() {
    this._buildGen++; // ENGINE-FIX: a pre-build in flight belongs to the old run
    // The current (title backdrop) room stays on screen; goToRoom removes its group as `prev`.
    for (const room of this.instances.values()) if (room !== this.currentRoom) this.ctx.scene.remove(room.group);
    this.instances.clear();
  }

  _applyLook(room) {
    const { scene, renderer } = this.ctx;
    scene.background = room.background ?? new THREE.Color(0x0b0806);
    scene.fog = room.fog ?? null;
    scene.environmentIntensity = room.envIntensity ?? 0.35;
    renderer.setExposure(room.exposure ?? 1);
    // polish: soft screen-space corner darkening (a CSS layer, no extra draw call). Rooms that glue their own
    // vignette to the camera (room1: `this.vignette`) or set `cssVignette = false` opt out; a number sets strength.
    const v = room.cssVignette ?? (room.vignette ? false : 1);
    this._vignetteEl.style.opacity = v === false ? '0' : String(v);
    if (room.bloom) renderer.setBloom(room.bloom.strength ?? renderer.baseBloom.strength, room.bloom);
    else renderer.resetBloom();
  }

  async _precompile(room) {
    try { await this.ctx.renderer.three.compileAsync(this.ctx.scene, this.ctx.camera.camera); } catch (e) { /* not fatal */ }
  }

  /**
   * ENGINE-FIX: the soft overture under the title (AUDIO built it; nothing started it). Browsers keep audio off until
   * the first gesture, so it starts (again) on the first press or key that is not a button, loops while the title
   * is up, and fades as the player chooses. Returns the stop function.
   */
  _titleMusic() {
    const ov = this.ctx.audio?.overture;
    if (!ov?.play) return () => {};
    let on = true;
    const play = () => {
      if (!on) return;
      ov.play({ soft: true }).then((ended) => { if (ended && on) play(); }, () => {});
    };
    const onGesture = (e) => {
      // a press on New Game/Continue (or the confirm) starts the game: music begun then would only blip
      if (!on || ov.handle?.live || e.target?.closest?.('button')) return;
      Promise.resolve(this.ctx.audio.resume?.()).then(() => { if (on && !ov.handle?.live) play(); }, () => {});
    };
    for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, onGesture, { capture: true });
    play();
    return () => {
      on = false;
      for (const ev of ['pointerdown', 'keydown']) window.removeEventListener(ev, onGesture, { capture: true });
      ov.stop(0.8);
    };
  }

  /** Show the title screen over a slowly panning room, then start/continue. */
  async showTitle() {
    const ctx = this.ctx;
    const bgId = [this.titleRoom, this.startRoom].find((id) => id && this.registry.has(id))
      || this.roomIds.find((id) => !id.startsWith('_')) || this.roomIds[0];
    ctx.hud.setVisible(false);
    ctx.inventory.setVisible(false);
    ctx.hotspots.enabled = false;
    ctx.camera.enabled = false;
    this._titleMode = true;
    if (bgId) {
      const room = await this._ensureBuilt(bgId);
      this._applyLook(room);
      ctx.scene.add(room.group);
      this.currentRoom = room;
      ctx.camera.setVantage(room.vantageFor(null) || room.constructor.vantage);
      ctx.camera.autoPan = { speed: 0.06, amp: 0.8 };
      try { room.enterTitle(); } catch (e) { console.error(e); }
      await this._precompile(room);
    }
    this._hideLoading();
    ctx.transitions.fadeIn(1.4);
    ctx.journal.setVisible(false);
    const stopMusic = this._titleMusic(); // ENGINE-FIX
    const act = await ctx.title.show({ canContinue: ctx.state.hasSave() });
    stopMusic();
    ctx.audio.resume?.();
    if (act === 'new') {
      ctx.state.reset();
      ctx.inventory.render();
      this._discardInstances(); // the title backdrop was built from the old save; rebuild from fresh state
    }
    let target = act === 'continue' && this.registry.has(ctx.state.room) ? ctx.state.room : this._fallbackRoom();
    if (act === 'new') {
      ctx.state.data.started = true;
      this._startKit();
    }
    await ctx.transitions.fadeOut(0.8);
    ctx.title.hide();
    ctx.camera.autoPan = null;
    ctx.camera.enabled = true;
    ctx.hotspots.enabled = true;
    await this.goToRoom(target, { fade: false });
  }

  /**
   * Fade to black, swap rooms, fade in. Builds the room lazily on first visit. The room left is removed from the
   * scene (kept built, not disposed, so going back is instant and its state is as left); its this.loop() audio and
   * this.later() timers stop. Arrival: room.vantageFor(from) picks the camera, then room.enter({ from }).
   * @param {string} id
   * `transition: 'curtain'`: the red velvet tabs close and part instead of the fade (the finale).
   * @param {{ fade?: boolean, duration?: number, transition?: 'fade'|'curtain' }} [opts]
   */
  async goToRoom(id, { fade = true, duration = 0.6, transition = 'fade' } = {}) {
    const ctx = this.ctx;
    if (!this.registry.has(id)) { console.error(`[game] goToRoom: unknown room "${id}"`); return; }
    if (this._transitioning) return;
    this._transitioning = true;
    ctx.hotspots.lock();
    try {
      const curtain = transition === 'curtain' && !!this.currentRoom;
      if (curtain) await ctx.transitions.curtainClose(Math.max(0.8, duration * 1.8));
      else if (fade && this.currentRoom) await ctx.transitions.fadeOut(duration);
      else if (ctx.transitions.opacity < 1) ctx.transitions.cover();
      const prev = this.currentRoom;
      const from = this._titleMode ? null : prev?.id ?? null;
      ctx.camera.resetFocus();
      ctx.dialogue.hideCaption();
      ctx.papers.hide();
      ctx.journal.close();
      if (ctx.inventory.inspecting) ctx.inventory.closeInspect();
      if (prev) {
        if (!this._titleMode) {
          try { prev.exit(); } catch (e) { console.error(e); }
          try { prev._afterExit(); } catch (e) { console.error(e); }
        }
        ctx.scene.remove(prev.group);
      }
      this._titleMode = false;
      const room = await this._ensureBuilt(id);
      this._applyLook(room);
      ctx.scene.add(room.group);
      this.currentRoom = room;
      let vantage = room.constructor.vantage;
      try { vantage = room.vantageFor(from) || vantage; } catch (e) { console.error(e); }
      ctx.camera.setVantage(vantage);
      ctx.hotspots.resetForRoom();
      ctx.hints.resetForRoom();
      ctx.state.room = id;
      ctx.state.data.started = true;
      ctx.state.inc(`visits.${id}`);
      ctx.state.save();
      ctx.audio.setRoomAmbience?.(id);
      ctx.hud.setVisible(true);
      ctx.inventory.setVisible(true);
      ctx.journal.setVisible(true);
      // FIXED BY integration-qa: a finished run (Continue after the curtain goes straight to the credits) ticked during
      // the precompile before the finale stopped the clock again, so each Continue added ~0.3 s to the running time
      this.timerRunning = !ctx.state.isSolved('cues');
      await this._precompile(room);
      try {
        const r = room.enter({ from });
        if (r && r.catch) r.catch((e) => console.error(`[game] ${id}.enter() failed`, e));
      } catch (e) { console.error(`[game] ${id}.enter() failed`, e); }
      // draw one frame behind the cover so the first-draw stall (texture upload, late shader variants) happens before
      // the reveal, not during it (it made the curtain snap open instead of parting)
      try { this._frame(); } catch (e) { console.error(e); }
      await new Promise((r) => setTimeout(r, 30));
      if (curtain) await ctx.transitions.curtainOpen(Math.max(0.8, duration * 1.8));
      else await ctx.transitions.fadeIn(duration);
    } finally {
      ctx.hotspots.unlock();
      this._transitioning = false;
      this._enteredAt = performance.now(); // ENGINE-FIX
    }
  }

  /** Stop/start the elapsed timer (e.g. the ending stops it). */
  stopTimer() { this.timerRunning = false; this.ctx.state.save(); }
  startTimer() { this.timerRunning = true; }

  /** Wipe the save and reload the page. */
  restart() {
    this.ctx.state.reset();
    this.ctx.state.persist = false; // don't let beforeunload re-save the old run
    location.reload();
  }

  /** Run one frame soon (after a click), so what the click changed is drawn even if rAF is throttled. */
  kick() {
    if (this._kickPending) return;
    this._kickPending = true;
    setTimeout(() => { this._kickPending = false; if (performance.now() - this._lastFrameAt > 20) this._frame(); }, 0);
  }

  _frame() {
    const ctx = this.ctx;
    this._lastFrameAt = performance.now();
    const dt = Math.min(0.1, this._clock.getDelta());
    this.time += dt;
    const t = this.time;
    const info = ctx.renderer.three.info.render;
    this.lastFrameInfo = { calls: info.calls, triangles: info.triangles };
    ctx.renderer.three.info.reset();
    ctx.tween.update(dt);
    if (this.currentRoom) {
      this.currentRoom._tick(dt, t);
      for (const ch of Object.values(ctx.characters)) {
        if (ch.isIn(this.currentRoom)) { try { ch.update(dt, t); } catch (e) { console.error(e); } }
      }
    }
    ctx.camera.update(dt, t);
    ctx.hotspots.update(dt, t);
    ctx.dialogue.update(dt);
    ctx.hints.update(dt);
    if (this.timerRunning && !this._titleMode && !document.hidden) ctx.state.tick(dt);
    ctx.hud.update(dt);
    ctx.renderer.render(dt);
    this._maybePrebuild(); // ENGINE-FIX
  }

  /**
   * Testing handles (closingNight.debug): find and click hotspots the way a player would.
   *   where(id)          → { x, y } client pixels where a click reaches the hotspot (null off screen; { blocked: true }
   *                        when something covers it or it is inactive in this scope)
   *   look(id, { snap })  → turn the room view toward the hotspot (room view only; snap (default true) jumps there)
   *   click(id)          → dispatch a real pointerdown/up at where(id) (through Interaction: occlusion, scope, locks)
   *   hotspots()         → ids of the hotspots a click can reach now (active in this scope, in the current room)
   *   state()            → a copy of the save data
   */
  _debugHelpers() {
    const game = this;
    const v = new THREE.Vector3();
    const box = new THREE.Box3();
    return {
      where(id) {
        // the centre of the hotspot's bounds if a pick there finds this hotspot, else the first of a spread of points
        // inside the bounds that does (a drawer under a desk top, a dial behind a rim); null if none is on screen
        const hs = game.ctx.hotspots;
        const h = hs.get(id);
        if (!h) return null;
        const cam = game.ctx.camera.camera;
        cam.updateMatrixWorld();
        box.setFromObject(h.object, true);
        const pts = [];
        if (box.isEmpty()) pts.push(h.object.getWorldPosition(new THREE.Vector3()));
        else {
          const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
          pts.push(c);
          for (const k of [0.3, 0.42]) for (const sx of [-1, 0, 1]) for (const sy of [-1, 0, 1]) for (const sz of [-1, 0, 1]) {
            if (sx || sy || sz) pts.push(c.clone().add(new THREE.Vector3(sx * size.x * k, sy * size.y * k, sz * size.z * k)));
          }
        }
        const r = game.ctx.renderer.three.domElement.getBoundingClientRect();
        let first = null;
        for (const p of pts) {
          v.copy(p).project(cam);
          if (v.z > 1 || Math.abs(v.x) > 0.98 || Math.abs(v.y) > 0.98) continue;
          const at = { x: Math.round(r.left + (v.x + 1) / 2 * r.width), y: Math.round(r.top + (1 - v.y) / 2 * r.height) };
          first ??= at;
          if (hs.pick(new THREE.Vector2(v.x, v.y))?.hotspot === h) return at;
        }
        return first ? { ...first, blocked: true } : null;
      },
      look(id, { snap = true } = {}) {
        const h = game.ctx.hotspots.get(id);
        const cam = game.ctx.camera;
        if (!h || cam.inFocus) return false;
        box.setFromObject(h.object, true);
        if (box.isEmpty()) h.object.getWorldPosition(v); else box.getCenter(v);
        cam.lookAtPoint(v.clone());
        if (snap) { cam.yaw = cam.targetYaw; cam.pitch = cam.targetPitch; cam._applyVantage(); }
        return true;
      },
      click(id) {
        const p = this.where(id);
        if (!p) { console.warn(`[debug] hotspot "${id}" is not on screen`); return false; }
        if (p.blocked) console.warn(`[debug] hotspot "${id}" is covered or inactive at every point tried; clicking its centre anyway`);
        const canvas = game.ctx.renderer.three.domElement;
        const opts = { clientX: p.x, clientY: p.y, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', bubbles: true };
        canvas.dispatchEvent(new PointerEvent('pointermove', opts));
        canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
        canvas.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 }));
        return true;
      },
      hotspots() {
        // active in this scope AND standing in the current room (rooms left behind keep their hotspots registered;
        // pick() only ever raycasts the current room, so those can never be clicked)
        const hs = game.ctx.hotspots;
        const root = game.currentRoom?.group;
        const inRoom = (o) => { while (o) { if (o === root) return true; o = o.parent; } return false; };
        return [...hs._map.values()].filter((h) => hs._isActive(h) && inRoom(h.object)).map((h) => h.id);
      },
      state() { return JSON.parse(JSON.stringify(game.ctx.state.data)); },
    };
  }
}

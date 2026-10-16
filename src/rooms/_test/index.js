// ENGINE test room: exercises every engine API. Reach it with ?room=_test&dev=1 (add &keep to keep the save across
// reloads, &slot=<name> for your own save). Its content lives in ./content.js and is registered in build().
//
// What is where (hotspot ids, for closingNight.debug.click(id)):
//   north   bookshelf (caption pool), window (toggle rain), noticeboard (focus: nine paper kinds), portrait (nested focus)
//   west    velvet door → _test2, locked until deliverable 'set' (addDoor + isOpen + onLocked)
//           plain door → _test2 (always open; arrival vantage differs via vantageFor)
//   centre  pedestal box (focus: three dials, knob = check, wrong() line, drag lever) → solves test_dials, delivers 'set'
//   east    desk drawer (locked; use key_brass from the KEYS jar) → test_drawer; letter inside
//           lightswitch → delivers 'light'; gramophone → 'music', thunder sheet → 'storm' (one line needing two)
//   south   armchair (choice), side table note (paper with hintVariant), prompt book (all-speaker scene, then a
//           paged paper with its own journal tab; page 3 needs the drawer open),
//           prop basket (adds / removes 12 items), chalk mark on the floor (Lavinia moveTo)
//   characters  lavinia (companion: hints), pike (pike.click._test), cat (cat.click)
import * as THREE from 'three';
import { Room } from '../../engine/Room.js';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import * as P from '../../engine/props/particles.js';
import * as Lt from '../../engine/props/lights.js';
import { makeTextPlane, makeCanvasPlane } from '../../engine/props/text.js';
import { mergeStatic } from '../../engine/props/util.js';
import { SCRIPT, PAPERS, ITEMS, BASKET } from './content.js';

const SYMBOLS = ['moon', 'sun', 'star', 'eye'];
const SOLUTION = [0, 1, 2]; // moon, sun, star

function drawSymbol(g, kind, x, y, s) {
  g.save(); g.translate(x, y);
  g.fillStyle = '#f3dc9a'; g.strokeStyle = '#2b1a10'; g.lineWidth = s * 0.08;
  g.beginPath();
  if (kind === 'moon') { g.arc(0, 0, s * 0.4, 0.4, Math.PI * 2 - 0.4); g.arc(s * 0.18, 0, s * 0.3, Math.PI * 2 - 0.9, 0.9, true); }
  else if (kind === 'sun') { for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? s * 0.25 : s * 0.42; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } }
  else if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? s * 0.17 : s * 0.42; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } }
  else { g.ellipse(0, 0, s * 0.42, s * 0.22, 0, 0, Math.PI * 2); }
  g.closePath(); g.fill(); g.stroke();
  if (kind === 'eye') { g.fillStyle = '#2b1a10'; g.beginPath(); g.arc(0, 0, s * 0.1, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

/** Register the test content once (both test rooms call it). */
export function registerTestContent(ctx) {
  ctx.dialogue.addScript(SCRIPT);
  ctx.papers.add(PAPERS);
  ctx.inventory.define(ITEMS);
}

export default class TestRoom extends Room {
  static id = '_test';
  static title = 'Rehearsal Room';
  static vantage = { position: [0, 1.6, 2.5], lookAt: [0, 1.25, -1], yawLimit: 80, pitchLimit: 25 };
  static puzzleOrder = ['test_drawer', 'test_dials', 'test_door'];
  static nudgeSeconds = 45; // short, so the idle nudge is testable

  async build() {
    const { ctx } = this;
    const { hotspots, state, dialogue, papers, journal, inventory } = ctx;
    registerTestContent(ctx);
    const G = this.group;

    this.background = new THREE.Color('#0b0806');
    this.fog = new THREE.FogExp2('#140d08', 0.03);
    this.envIntensity = 0.4;

    // ---- shell & lighting -------------------------------------------------------------------
    G.add(F.roomShell({ w: 6.4, d: 6, h: 3.6, wainscot: 0.9, beams: 3 }));
    G.add(Lt.ambientRig({ hemi: 0.45, ambientIntensity: 0.25 }));
    G.add(Lt.keyLight({ color: '#9fb8ff', intensity: 5, position: [0.6, 3.2, -4.5], target: [0.4, 0, 0.6], angle: 0.45 }));
    const fire = Lt.flickerLight({ color: '#ffb070', intensity: 3, distance: 8, castShadow: true });
    fire.position.set(0, 3.0, 0.4);
    G.add(fire);
    this.fire = fire;
    const rug = F.rug({ w: 2.2, d: 2.8 }); rug.position.set(0, 0, -0.2); G.add(rug);

    // ---- north wall ---------------------------------------------------------------------------
    const shelf = F.bookshelf({ w: 1.4, h: 2.3, seed: 4 });
    shelf.position.set(-2.2, 0, -2.78);
    G.add(shelf);
    hotspots.add({ id: 'bookshelf', object: shelf, label: 'Bookshelf', onClick: () => dialogue.caption('_test.books') });

    const win = F.windowFrame({ w: 0.9, h: 1.5, rain: 0.8, shaftTarget: [0.3, -0.95, 2.6] });
    win.position.set(-0.6, 1.05, -2.98);
    G.add(win);
    G.add(P.dustMotes({ box: [1.4, 1.8, 2.4], center: [-0.4, 1.0, -1.7], count: 200 }));
    let rain = true;
    hotspots.add({ id: 'window', object: win.userData.glass, label: 'Window', onClick: () => { rain = !rain; win.userData.setRain(rain ? 0.8 : 0); dialogue.caption('_test.window'); } });

    // noticeboard: a focus view with nine papers pinned (DESIGN's paper kinds, all collected into the journal)
    const board = new THREE.Group();
    board.position.set(0.95, 1.55, -2.97);
    G.add(board);
    const cork = F.rbox(1.3, 0.85, 0.03, new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.95 }), 0.01);
    board.add(cork);
    const pinned = [['_test.playbill', '#efd9a8'], ['_test.telegram', '#efe6c8'], ['_test.typed', '#f4efe0'],
      ['_test.notepaper', '#f6ecd6'], ['_test.card', '#faf3e3'], ['_test.ledger', '#e8dcbc'],
      ['_test.legal', '#efe8d4'], ['_test.ticket', '#e8c890'], ['_test.certificate', '#f2eedc']]
      .map(([id, col], i) => [id, col, -0.42 + (i % 3) * 0.42, 0.26 - Math.floor(i / 3) * 0.26]);
    pinned.forEach(([id, col, x, y], i) => {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.22), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }));
      sheet.position.set(x, y, 0.017 + i * 0.0005); sheet.rotation.z = (i % 2 ? 1 : -1) * 0.05;
      board.add(sheet);
      hotspots.add({ id: `pin.${id}`, object: sheet, label: papers.def(id)?.journalTitle || papers.def(id)?.title || id, scope: 'focus:board', onClick: () => papers.show(id) });
    });
    hotspots.add({
      id: 'noticeboard', object: board, label: 'Noticeboard',
      onClick: () => ctx.camera.focus({ position: [0.95, 1.55, -1.85], lookAt: [0.95, 1.55, -3], scope: 'focus:board' }),
    });

    const frame = F.pictureFrame({
      w: 0.5, h: 0.66, style: 'gilt',
      draw: (g, w, h) => {
        const gr = g.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h / 2, w);
        gr.addColorStop(0, '#5a4666'); gr.addColorStop(1, '#1a120c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = '#c9a0d8'; g.beginPath(); g.ellipse(w / 2, h * 0.8, w * 0.34, h * 0.24, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#f2e2d8'; g.beginPath(); g.ellipse(w / 2, h * 0.42, w * 0.18, h * 0.17, 0, 0, Math.PI * 2); g.fill();
      },
    });
    frame.position.set(2.3, 1.75, -2.99);
    G.add(frame);
    hotspots.add({ id: 'portrait', object: frame, label: 'Portrait', onClick: () => ctx.camera.focus({ position: [2.3, 1.75, -2.2], lookAt: [2.3, 1.75, -3], scope: 'focus:portrait' }) });
    // a nested close-up inside the portrait close-up
    hotspots.add({
      id: 'portrait.face', object: frame.userData.canvas, label: 'Her face', scope: 'focus:portrait',
      onClick: () => ctx.camera.focus({ position: [2.3, 1.82, -2.7], lookAt: [2.3, 1.82, -3], scope: 'focus:portrait.face' }),
    });
    hotspots.add({ id: 'portrait.face.close', object: frame.userData.canvas, label: 'Her face', scope: 'focus:portrait.face', onClick: () => dialogue.caption('Nested close-up. Back steps out one level.') });

    // ---- west wall: two exits to the wing -------------------------------------------------------
    const velvet = F.door({ frame: 'stone' });
    velvet.position.set(-3.18, 0, -1.3); velvet.rotation.y = Math.PI / 2;
    G.add(velvet);
    this.velvet = velvet;
    this.addDoor({
      id: 'door.velvet', object: velvet, to: '_test2',
      label: (open) => (open ? 'Velvet door' : 'Velvet door (locked)'),
      isOpen: () => journal.delivered('set'),
      onLocked: '_test.door.locked',
      onOpen: () => ctx.tween.to(velvet.userData.leaf.rotation, { y: -1.2 }, { duration: 0.6, ease: 'inOutSine' }),
    });
    const plain = F.door({ frame: 'wood' });
    plain.position.set(-3.18, 0, 1.2); plain.rotation.y = Math.PI / 2;
    G.add(plain);
    this.addDoor({ id: 'door.plain', object: plain, to: '_test2', label: 'Plain door (to the wing)' });

    // ---- centre: pedestal + puzzle box --------------------------------------------------------
    const ped = F.pedestal({ h: 0.95, r: 0.17 });
    ped.position.set(0.3, 0, -0.7);
    G.add(ped);
    const plaque = makeTextPlane('PROPERTY OF H. PIKE', { width: 0.2, font: '48px "Abril Fatface", Georgia, serif', color: '#3a2410', bg: '#c9a24a' });
    plaque.position.set(0.3, 0.6, -0.7 + 0.115); plaque.rotation.x = -0.05;
    G.add(plaque);
    this._buildBox();

    // ---- east: desk, drawer, jars, switch, gramophone, thunder sheet -------------------------------
    const desk = F.desk({ w: 1.5 });
    desk.position.set(2.8, 0, 0.1); desk.rotation.y = -Math.PI / 2;
    G.add(desk);
    const drawer = desk.userData.drawer;
    const letter = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.26), M.parchment());
    letter.rotation.x = -Math.PI / 2; letter.position.y = 0.002;
    desk.userData.drawerInterior.add(letter);
    const openDrawer = (animate) => {
      const z = drawer.userData.closedZ ?? (drawer.userData.closedZ = drawer.position.z);
      if (animate) return ctx.tween.to(drawer.position, { z: z + 0.32 }, { duration: 0.7, ease: 'outCubic' });
      drawer.position.z = z + 0.32;
    };
    hotspots.add({
      id: 'drawer', object: drawer, label: 'Desk drawer',
      enabled: () => !state.isSolved('test_drawer'),
      onClick: () => dialogue.auto('_test.drawer.locked'),
      useItem: {
        key_brass: () => {
          inventory.remove('key_brass');
          ctx.audio.play('unlock');
          openDrawer(true);
          state.solve('test_drawer');
          dialogue.say('_test.drawer.open');
        },
      },
    });
    hotspots.add({ id: 'letter', object: letter, label: 'Letter', enabled: () => state.isSolved('test_drawer'), onClick: () => papers.show('_test.letter') });
    if (state.isSolved('test_drawer')) openDrawer(false);

    const wshelf = F.wallShelf({ w: 1.3 });
    wshelf.position.set(3.19, 1.65, 0.1); wshelf.rotation.y = -Math.PI / 2;
    G.add(wshelf);
    const jarDefs = [['KEYS', '#c9a24a', 0.4], ['Greasepaint', '#c86a5a', 0.2], ['Applause\n(bottled)', '#8aa0c8', 0.6]];
    const jars = jarDefs.map(([t, col, glow], i) => {
      const j = F.jar({ label: t, contents: col, glow, lid: i === 1 ? 'cloth' : i === 2 ? 'brass' : 'cork' });
      j.position.set(-0.4 + i * 0.4, 0, 0.12);
      wshelf.add(j);
      return j;
    });
    const keyJar = jars[0];
    const keyTaken = () => state.get('_test.key.taken') || state.isSolved('test_drawer') || inventory.has('key_brass');
    if (keyTaken()) keyJar.userData.setContents('#c9a24a', 0.1, 0.15);
    hotspots.add({
      id: 'keyjar', object: keyJar, label: 'Jar labelled KEYS',
      onClick: () => {
        if (keyTaken()) { dialogue.caption('_test.jar.empty'); return; }
        state.set('_test.key.taken', true);
        keyJar.userData.setContents('#c9a24a', 0.1, 0.15);
        inventory.add('key_brass', { from: keyJar }); // says item.key_brass.pickup the first time
      },
    });
    jars.slice(1).forEach((j, i) => hotspots.add({ id: `jar${i + 1}`, object: j, label: 'A jar', onClick: () => { ctx.audio.glassNote?.(i * 4); dialogue.caption(i ? 'Applause, bottled. For emergencies.' : 'No. 5 and No. 9.'); } }));

    // deliverables
    const sw = F.rbox(0.12, 0.2, 0.04, M.brass(), 0.01);
    sw.position.set(3.18, 1.3, -1.4); sw.rotation.y = -Math.PI / 2;
    G.add(sw);
    hotspots.add({ id: 'lightswitch', object: sw, label: () => (journal.delivered('light') ? 'Light switch (on)' : 'Light switch'), onClick: () => this._lights(true) });
    if (journal.delivered('light')) this._lights(false);

    const gram = new THREE.Group();
    gram.add(F.rbox(0.36, 0.16, 0.36, M.mahogany(), 0.01));
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 24, 1, true), M.brass({ polished: true }));
    horn.position.set(0, 0.32, -0.05); horn.rotation.x = -0.9;
    gram.add(horn);
    gram.position.set(2.75, 0.78, -0.45); gram.children[0].position.y = 0.08;
    G.add(gram);
    hotspots.add({ id: 'gramophone', object: gram, label: 'Gramophone', onClick: () => { ctx.audio.play('chime'); journal.deliver('music'); } });

    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.3), M.iron());
    sheet.position.set(2.4, 1.3, -2.9);
    G.add(sheet);
    hotspots.add({
      id: 'thundersheet', object: sheet, label: 'Thunder sheet',
      onClick: () => {
        ctx.camera.shake(0.03); ctx.audio.play('whump');
        ctx.companion.react('shriek');
        journal.deliver('storm');
      },
    });

    // ---- south / sides: armchair, side table, note, prompt book, basket, mark ----------------------
    const chair = F.armchair();
    chair.position.set(-2.0, 0, 0.9); chair.rotation.y = 0.7;
    G.add(chair);
    hotspots.add({ id: 'armchair', object: chair, label: 'Armchair', onClick: () => dialogue.choice('_test.choice') });

    const side = F.table({ w: 0.55, d: 0.55, h: 0.62 });
    side.position.set(-2.3, 0, -0.6);
    G.add(side);
    const cndl = F.candle({ holder: 'stick' });
    cndl.position.set(-2.42, 0.62, -0.7);
    G.add(cndl);
    hotspots.add({ id: 'candle', object: cndl, label: 'Candle', onClick: () => { cndl.userData.setLit(!cndl.userData.lit); ctx.audio.play('candleLight'); } });
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), M.parchment());
    note.rotation.set(-Math.PI / 2, 0, 0.3); note.position.set(-2.2, 0.625, -0.52);
    G.add(note);
    hotspots.add({ id: 'note', object: note, label: 'A note', onClick: () => papers.show('_test.note') });

    const book = F.book({ w: 0.045, h: 0.22, d: 0.16, color: '#5a1c22' });
    book.rotation.z = Math.PI / 2; book.position.set(-2.15, 0.62, -0.78);
    G.add(book);
    hotspots.add({
      id: 'promptbook', object: book, label: 'Prompt book (a scene)',
      onClick: async () => {
        if (!journal.has('_test.promptbook')) { await dialogue.say('_test.scene'); journal.pin('_test.promptbook'); return; }
        papers.show('_test.promptbook', { collect: false });
      },
    });

    const chalk = makeTextPlane('PROPS', { width: 0.3, font: '40px "Abril Fatface", Georgia, serif', color: '#3a2410', bg: '#d8b98a' });
    const basket = new THREE.Group();
    const bb = F.lathe([[0, 0], [0.24, 0.02], [0.28, 0.3], [0.29, 0.32], [0.26, 0.32], [0.22, 0.04], [0, 0.03]], M.oak(), 20);
    basket.add(bb);
    chalk.position.set(0, 0.2, 0.28); basket.add(chalk);
    basket.position.set(-1.0, 0, 1.3);
    G.add(basket);
    hotspots.add({
      id: 'basket', object: basket, label: () => (BASKET.every((id) => inventory.has(id)) ? 'Prop basket (put things back)' : 'Prop basket (take a dozen things)'),
      onClick: () => {
        if (BASKET.every((id) => inventory.has(id))) { BASKET.forEach((id) => inventory.remove(id)); dialogue.caption('_test.basket.take'); }
        else { BASKET.forEach((id, i) => ctx.tween.delay(i * 0.06).then(() => inventory.add(id, { from: basket }))); dialogue.caption('_test.basket.give'); }
      },
    });

    const mark = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.17, 24), new THREE.MeshBasicMaterial({ color: '#f0e3c4' }));
    mark.rotation.x = -Math.PI / 2; mark.position.set(0.9, 0.01, 0.9);
    G.add(mark);
    hotspots.add({
      id: 'mark', object: mark, label: 'A chalk mark (send Lavinia)',
      onClick: async () => {
        dialogue.caption('_test.mark');
        const lv = ctx.companion;
        const there = lv.group.position.distanceTo(new THREE.Vector3(0.9, 0, 0.9)) < 0.2;
        await lv.moveTo(there ? [-1.2, 0, -1.4] : [0.9, 0, 0.9], { duration: 1.6 });
        lv.react('bow');
      },
    });
    const ptr = new THREE.Vector3();
    this.animate(() => { ctx.camera.camera.getWorldPosition(ptr); ctx.companion.lookAt(ptr); });

    // last: merge the static set into one mesh per material (hotspot objects are left alone)
    mergeStatic(G, [], { hotspots });
  }

  _lights(animate) {
    const { ctx } = this;
    const f = this.fire;
    f.userData.baseIntensity = 7;
    if (!animate) { f.userData.setLit?.(true, 0.01); return; }
    ctx.audio.play('click');
    f.userData.setLit?.(true, 0.4);
    ctx.journal.deliver('light');
  }

  _buildBox() {
    const { ctx } = this;
    const { hotspots, state, dialogue } = ctx;
    const box = new THREE.Group();
    box.position.set(0.3, 0.95, -0.7);
    this.group.add(box);
    const bw = 0.34, bh = 0.18, bd = 0.24;
    const body = F.rbox(bw, bh, bd, M.mahogany(), 0.012); body.position.y = bh / 2; box.add(body);
    const lidPivot = new THREE.Group(); lidPivot.position.set(0, bh, -bd / 2); box.add(lidPivot);
    const lid = F.rbox(bw + 0.01, 0.04, bd + 0.01, M.mahogany(), 0.012); lid.position.set(0, 0.02, bd / 2); lidPivot.add(lid);
    const glow = new THREE.PointLight('#ffd27a', 0, 1.2, 2); glow.position.set(0, bh - 0.02, 0); box.add(glow);
    const sparkle = P.sparkles({ box: [0.25, 0.2, 0.18], center: [0, bh + 0.06, 0], count: 30 });
    sparkle.visible = false; box.add(sparkle);
    this.box = { lidPivot, glow, sparkle };

    hotspots.add({
      id: 'box', object: box, label: 'Puzzle box',
      onClick: () => ctx.camera.focus({ position: [0.3, 1.42, -0.18], lookAt: [0.3, 1.04, -0.7], scope: 'focus:box', puzzle: 'test_dials', onExit: () => dialogue.hideCaption() }),
    });
    const dialTex = makeCanvasPlane(0.1, 0.1, (g, w, h) => {
      g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill();
      g.fillStyle = '#2b1a10'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.44, 0, 7); g.fill();
      SYMBOLS.forEach((s, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 2; drawSymbol(g, s, w / 2 + Math.cos(a) * w * 0.28, h / 2 + Math.sin(a) * h * 0.28, w * 0.26); });
    }, { px: 256 }).material.map;
    this.dials = [];
    const vals = state.get('_test.box.dials', [3, 3, 3]);
    for (let i = 0; i < 3; i++) {
      const dial = new THREE.Group();
      dial.position.set(-0.1 + i * 0.1, bh / 2, bd / 2 + 0.004);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.044, 0.014, 32), M.brass());
      rim.rotation.x = Math.PI / 2; dial.add(rim);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.04, 32), new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.5, metalness: 0.3 }));
      face.position.z = 0.0075; dial.add(face);
      box.add(dial);
      dial.userData.value = vals[i];
      dial.rotation.z = (vals[i] * Math.PI) / 2;
      this.dials.push(dial);
      hotspots.add({
        id: `dial${i}`, object: dial, label: 'Dial', scope: 'focus:box',
        enabled: () => !state.isSolved('test_dials'),
        onClick: () => {
          dial.userData.value = (dial.userData.value + 1) % 4;
          ctx.audio.play('ratchet');
          ctx.tween.by(dial.rotation, { z: Math.PI / 2 }, { duration: 0.25, ease: 'outBack' });
          state.set('_test.box.dials', this.dials.map((d) => d.userData.value));
        },
      });
      const ptr = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.016, 3), M.brass({ polished: true }));
      ptr.rotation.z = Math.PI; ptr.position.set(-0.1 + i * 0.1, bh / 2 + 0.054, bd / 2 + 0.008);
      box.add(ptr);
    }
    // the knob: check the combination (a wrong try: this.wrong → _test.test_dials.wrong.n)
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), M.velvet({ color: '#7a1c22' }));
    knob.position.set(0, 0.03, bd / 2 + 0.012);
    box.add(knob);
    hotspots.add({
      id: 'knob', object: knob, label: 'Knob (try it)', scope: 'focus:box',
      enabled: () => !state.isSolved('test_dials'),
      onClick: () => {
        const ok = this.dials.every((d, i) => d.userData.value === SOLUTION[i]);
        if (!ok) { this.wrong('test_dials'); return; }
        state.solve('test_dials');
        this._showBoxSolved(true);
      },
    });
    // a drag lever (onDrag)
    const leverPivot = new THREE.Group(); leverPivot.position.set(bw / 2 + 0.01, bh * 0.6, 0.02); box.add(leverPivot);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 10), M.brass()); arm.position.y = 0.05; leverPivot.add(arm);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), M.velvet({ color: '#7a1c22' })); ball.position.y = 0.1; leverPivot.add(ball);
    leverPivot.rotation.x = -0.5;
    let fired = false;
    hotspots.add({
      id: 'lever', object: leverPivot, label: 'Lever (drag)', scope: 'focus:box',
      onDragStart: () => { fired = false; },
      onDrag: ({ dy }) => {
        leverPivot.rotation.x = THREE.MathUtils.clamp(leverPivot.rotation.x + dy * 0.01, -0.5, 1.1);
        if (leverPivot.rotation.x > 1.0 && !fired) { fired = true; ctx.audio.play('unlock', { gain: 0.5 }); dialogue.caption('_test.lever', { scope: 'focus:box' }); ctx.camera.shake(0.01); }
      },
      onDragEnd: () => ctx.tween.to(leverPivot.rotation, { x: -0.5 }, { duration: 0.5, ease: 'outBack' }),
      onClick: () => dialogue.caption('Drag it. Levers are for dragging.'),
    });
    if (state.isSolved('test_dials')) { this._showBoxSolved(false); ctx.journal.deliver('set', { quiet: true }); } // a dev &solve= jump (or an old save) still gets its tick
  }

  async _showBoxSolved(animate) {
    const { ctx } = this;
    const { lidPivot, glow, sparkle } = this.box;
    sparkle.visible = true;
    if (!animate) { lidPivot.rotation.x = -1.9; glow.intensity = 1.2; return; }
    ctx.hotspots.lock();
    try {
      await ctx.tween.delay(0.3);
      ctx.audio.play('success');
      P.burst(ctx, this.group, [0.3, 1.2, -0.7], { count: 90 });
      ctx.tween.to(glow, { intensity: 1.2 }, { duration: 1 });
      await ctx.tween.to(lidPivot.rotation, { x: -1.9 }, { duration: 1.1, ease: 'outBack' });
    } finally { ctx.hotspots.unlock(); }
    await ctx.dialogue.say('_test.box.solved');
    await ctx.camera.exitFocus();
    ctx.journal.deliver('set');
    ctx.camera.lookAtPoint([-3.1, 1.4, -1.3]);
  }

  prereqMet(id) {
    if (id === 'test_door') return this.ctx.state.isSolved('test_dials');
    return true;
  }

  hintVariant(id) {
    if (id === 'test_dials' && this.ctx.journal.has('_test.note')) return 'read';
    return null;
  }

  vantageFor(from) {
    // arriving back from the wing: face the west doors
    if (from === '_test2') return { ...this.constructor.vantage, position: [-1.2, 1.6, 0.2], lookAt: [-3, 1.4, 0] };
    return this.constructor.vantage;
  }

  _placeCast() {
    const { characters } = this.ctx;
    characters.lavinia.placeAt(this.group, { position: [-1.2, 0, -1.4], rotationY: 0.5 });
    characters.pike.placeAt(this.group, { position: [1.9, 0, -2.0], rotationY: -0.4 });
    characters.cat.placeAt(this.group, { position: [-2.3, 0.62, -0.95], rotationY: 1.2 });
  }

  enter({ from } = {}) {
    const { ctx } = this;
    this._placeCast();
    this.loop('rain', { gain: 0.3 });
    // the Running Order is handed over with its zeroth line pre-ticked (DESIGN §5)
    const first = !ctx.state.get('_test.enter.seen');
    ctx.journal.pin('runningorder', { quiet: !first });
    ctx.journal.deliver('ghost', { quiet: true });
    if (first) {
      ctx.state.set('_test.enter.seen', true);
      this.later(0.8, () => ctx.dialogue.say('_test.enter'));
    }
  }

  enterTitle() { this._placeCast(); }
}

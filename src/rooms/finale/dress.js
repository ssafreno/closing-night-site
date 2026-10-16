// The finale's dressing on top of the stage set (buildSet from ../stage/set.js, built again into the finale's own group):
// every stage puzzle shown solved, the tabs in, the ghost light standing in the wing; the last page pinned on the desk
// slope with Pike's pencil tick; a hit box on each GO button; the lily shimmer; and the dawn vignette (the stage door
// from inside the Green Room, built far off in the same group and shown only for the dawn shot).
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as T from '../../engine/props/theatre.js';
import * as P from '../../engine/props/particles.js';
import { makeCanvasPlane } from '../../engine/props/text.js';
import { SPIKES, TRUCK_DOOR_PROMPT, GHOST_WING, CLOTH } from '../stage/set.js';
import { Q34 } from '../stage/dimmer.js';
import { LASTPAGE_HTML } from '../../content/papers/_lastpage.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const keep = (o) => { if (o) o.userData.keep = true; return o; };
function proxy(w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.userData.hitProxy = true; m.userData.keep = true; return m;
}
const FONTS = T.FONTS;
export const DEPTS = ['HOUSE', 'SOUND', 'FLY', 'LX', 'FX', 'WARDROBE'];
/** The arbor's rise with the cloth in at trim (the same as flyrail.js). */
const TRAVEL = Math.min(CLOTH.out - CLOTH.trim, 4.6);
/** Where the dawn vignette stands (far off stage right, outside the theatre's walls, hidden until the dawn). */
export const DAWN_AT = v3(46, 0, -30);

/** Every stage puzzle shown solved (the visuals the stage's own restore() would give a finished save). */
export function solvedSet(h) {
  // ghost light: lit, moved by Pike to the wing, plugged into DIP 2
  h.shimmer.setLevel(0, true);
  h.dips.setGlow(1);
  h.dips.setAllOpen?.(0); h.dips.setOpen(1, 1);
  h.ghostLight.moveTo(GHOST_WING[0], GHOST_WING[2]);
  h.ghostLight.setPlugHome(false);
  h.ghostLight.cable.showTo(1);
  // mains: three fuses seated, the handle down; nothing left lying about
  for (let i = 0; i < 3; i++) h.mains.setSeated(i, true);
  h.mains.setHandle(1);
  for (const o of [h.bucket, h.propsTable, h.cleat]) { if (o?.fuse) o.fuse.visible = false; if (o?.glint) o.glint.visible = false; }
  // dimmer at the Q34 marks
  ['battens', 'floats', 'limes', 'blues'].forEach((n, i) => h.dimmer.setLevel(i, Q34[n] / 4, true));
  // flyrail: four 28s on the arbor, the arbor up, the Gull Point cloth in at trim
  const FR = h.flyrail;
  const w28 = FR.stacks?.[28] || [];
  w28.forEach((w, k) => {
    if (k < 4) w.position.copy(FR.arborSeat(k * FR.weightHeight[28]).add(v3(0, TRAVEL, 0)));
    else w.position.copy(FR.stackPos[28].clone().add(v3(0, (k - 4) * FR.weightHeight[28], 0)));
  });
  FR.setArborY(FR.arborY0 + TRAVEL);
  FR.setTotal(112);
  FR.setLocked?.(true);
  h.backcloth.setTrim(1);
  // the lighthouse on the blue spike, door to the prompt corner, brake on, Wardrobe's lamp in its lantern room
  h.truck.setPose(SPIKES.blue[0], SPIKES.blue[1], TRUCK_DOOR_PROMPT);
  h.truck.setBrake(true);
  h.truck.setLampPlaced(true);
  h.truck.glint(false);
  h.truck.setBeam(false);
  // the desk: the cue-light panel uncovered; the exits' cue lights all green (the Running Order is done)
  h.promptDesk.setPanelCovered(false);
  for (const [room, cl] of Object.entries(h.cueLights || {})) cl.userData.setState(room === 'door' ? 'off' : 'green', true);
  h.trapdoor.setFlipped(0);
  h.sandbag?.reset?.();
}

// =====================================================================================================================
// THE LAST PAGE (pinned on the desk slope): the cue rows, a pencil tick per called cue, an arrow at the current one
// =====================================================================================================================
/** The page's rows: { text, cue (0..9 or -1), kind: 'type' | 'stage' | 'pencil' | 'hand' | 'gap' }. */
function pageRows() {
  const rows = [];
  const strip = (s) => s.replace(/<[^>]+>/g, '');
  for (const raw of LASTPAGE_HTML.split('\n')) {
    if (!raw.trim()) { rows.push({ kind: 'gap' }); continue; }
    const boxes = [...raw.matchAll(/>(Q\d\d [A-Z]+)</g)].map((m) => m[1]);
    if (/cn-pencil/.test(raw)) { rows.push({ kind: 'pencil', text: strip(raw) }); continue; }
    if (/cn-hand/.test(raw)) { rows.push({ kind: 'hand', text: strip(raw) }); continue; }
    if (/^<i>/.test(raw)) { rows.push({ kind: 'stage', text: strip(raw) }); continue; }
    const text = strip(raw);
    if (boxes.length) {
      const q = boxes[0];
      const cue = Number(q.slice(1, 3)) - 31;
      const at = text.indexOf(q);
      const before = text.slice(0, at).replace(/\s*▸\s*$/, '').trim();
      const after = text.slice(at + q.length).trim();
      if (before) { rows.push({ kind: 'type', text: before }); rows.push({ kind: 'type', text: '', box: q, after, cue, indent: true }); }
      else rows.push({ kind: 'type', text: '', box: q, after, cue });
      continue;
    }
    rows.push({ kind: 'type', text });
  }
  return rows;
}

export function buildPage(desk) {
  const rows = pageRows();
  const W = 0.4, H = 0.47;
  let st = { done: 0, current: -1 };
  const draw = (g, w, h) => {
    g.fillStyle = '#efe6cf'; g.fillRect(0, 0, w, h);
    // foxing and a fold
    const gr = g.createRadialGradient(w * 0.5, h * 0.45, w * 0.2, w * 0.5, h * 0.5, w * 0.85);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(120,80,30,0.28)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(90,60,30,0.08)'; g.fillRect(0, h * 0.52, w, 2);
    g.fillStyle = '#3a3026'; g.font = `600 ${w * 0.024}px ${FONTS.ui}`; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.fillText('97', w - w * 0.06, h * 0.045);
    const x0 = w * 0.09, lh = h * 0.0318, fs = w * 0.027;
    let y = h * 0.075;
    g.textAlign = 'left';
    for (const r of rows) {
      if (r.kind === 'gap') { y += lh * 0.55; continue; }
      if (r.kind === 'pencil' || r.kind === 'hand') {
        g.fillStyle = r.kind === 'pencil' ? '#6a6a6a' : '#2b2a4a';
        g.font = `${fs * (r.kind === 'pencil' ? 0.85 : 0.9)}px ${FONTS.hand}`;
        // wrap
        const words = r.text.split(' '); let line = '';
        for (const wd of words) {
          const t = line ? `${line} ${wd}` : wd;
          if (g.measureText(t).width > w * 0.82 && line) { g.fillText(line, x0, y + lh * 0.8); y += lh * 1.15; line = wd; } else line = t;
        }
        if (line) { g.fillText(line, x0, y + lh * 0.8); y += lh * 1.25; }
        continue;
      }
      g.font = `${r.kind === 'stage' ? 'italic ' : ''}${fs}px ${FONTS.typed}`;
      g.fillStyle = '#1e1a16';
      let x = x0 + (r.indent ? w * 0.06 : 0);
      if (r.text) { g.fillText(r.text, x, y + lh * 0.75); }
      if (r.box) {
        x += r.indent ? 0 : 0;
        const label = r.box;
        g.font = `700 ${fs}px ${FONTS.typed}`;
        const bw = g.measureText(label).width + fs * 0.7;
        const done = r.cue < st.done, cur = r.cue === st.current;
        if (cur) { g.fillStyle = 'rgba(255,214,90,0.45)'; g.fillRect(x - fs * 0.25, y - lh * 0.05, bw + fs * 0.5, lh * 1.0); }
        g.strokeStyle = '#4a4a4a'; g.lineWidth = Math.max(1.5, w * 0.0022);
        g.strokeRect(x, y + lh * 0.08, bw, lh * 0.86);
        g.fillStyle = '#3a3a3a'; g.fillText(label, x + fs * 0.35, y + lh * 0.75);
        g.font = `${fs}px ${FONTS.typed}`; g.fillStyle = '#1e1a16';
        if (r.after) g.fillText(` ${r.after}`, x + bw + fs * 0.2, y + lh * 0.75);
        // Pike's pencil: a tick in the margin for each cue called, an arrow at the one standing by
        g.fillStyle = '#55524c'; g.strokeStyle = '#55524c';
        if (done) {
          g.lineWidth = w * 0.004; g.lineCap = 'round';
          const mx = w * 0.035, my = y + lh * 0.5;
          g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + w * 0.012, my + lh * 0.32); g.lineTo(mx + w * 0.034, my - lh * 0.42); g.stroke();
        } else if (cur) {
          g.lineWidth = w * 0.004; g.lineCap = 'round';
          const mx = w * 0.022, my = y + lh * 0.5;
          g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + w * 0.048, my); g.moveTo(mx + w * 0.03, my - lh * 0.25); g.lineTo(mx + w * 0.048, my); g.lineTo(mx + w * 0.03, my + lh * 0.25); g.stroke();
        }
      }
      y += lh;
    }
  };
  const page = keep(makeCanvasPlane(W, H, draw, { px: 900 }));
  page.material.roughness = 0.9;
  page.name = 'lastPage';
  // on the slope, left of the stopwatch, a little skew (pinned by a drawing pin at the top)
  page.position.set(-0.13, 0.0, 0.003);
  page.rotation.z = 0.025;
  desk.userData.slope.add(page);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 12).rotateX(Math.PI / 2), M.brass());
  pin.position.set(0, H / 2 - 0.02, 0.003); page.add(pin);
  const hit = proxy(W, H, 0.03); hit.position.set(0, 0, 0.01); page.add(hit);
  let pending = false;
  const redraw = () => { page.userData.redraw(); pending = false; };
  document.fonts?.ready?.then(() => redraw());
  return {
    object: page, hit,
    /** Show `done` cues ticked and the arrow at `current` (-1 = none). */
    set(done, current = -1) {
      if (st.done === done && st.current === current) return;
      st = { done, current };
      if (!pending) { pending = true; requestAnimationFrame(redraw); setTimeout(() => { if (pending) redraw(); }, 120); }
    },
  };
}

// =====================================================================================================================
// THE GO BUTTONS: a generous hit box on each of the panel's six plungers (on the panel's slope, so they ride with it)
// =====================================================================================================================
export function buildGoHits(panel) {
  const ud = panel.userData;
  return ud.buttons.map((b, i) => {
    const hit = proxy(0.13, 0.15, 0.09);
    hit.position.copy(b.position).add(v3(0, 0.02, 0.03));
    hit.name = `go.${DEPTS[i]}`;
    ud.slope.add(hit);
    return hit;
  });
}

// =====================================================================================================================
// THE LILY: a white shimmer left on the prompt desk when she fades (and two petals of light)
// =====================================================================================================================
export function buildLily(group, at) {
  const g = keep(new THREE.Group()); g.name = 'lily';
  g.position.copy(at);
  const sp = P.sparkles({ box: [0.25, 0.3, 0.25], center: [0, 0.12, 0], count: 26, size: 0.035, color: '#ffffff', color2: '#e8f0ff' });
  g.add(sp);
  const glow = T.halo('#f4f8ff', 0.16, 0.0);
  glow.position.set(0, 0.06, 0); g.add(glow);
  const light = new THREE.PointLight('#e8eeff', 0, 2.2, 1.6); light.position.set(0, 0.25, 0); g.add(light);
  g.visible = false;
  group.add(g);
  let k = 0, target = 0;
  g.userData.update = (dt) => {
    if (Math.abs(k - target) < 0.002) return;
    k += (target - k) * Math.min(1, dt * 1.6);
    g.visible = k > 0.01;
    light.intensity = 0.9 * k;
    if (glow.material) glow.material.opacity = 0.55 * k;
  };
  return { object: g, set: (v) => { target = v; } };
}

// =====================================================================================================================
// DAWN: the stage door from inside the Green Room, swinging open on a grey morning (rain stopped, birds)
// =====================================================================================================================
export function buildDawn(group) {
  const G = keep(new THREE.Group()); G.name = 'dawn';
  G.position.copy(DAWN_AT);
  group.add(G);
  // the Green Room's corner: bottle-green gloss dado, nicotine distemper above, brown lino
  const W = 5.4, D = 4.2, H = 3.3;
  const wallTex = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#c9b78a'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(110,90,50,${Math.random() * 0.08})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 30, 1 + Math.random() * 4); }
    const dado = 512 - (1.1 / H) * 512;
    g.fillStyle = '#1f3a2a'; g.fillRect(0, dado, 512, 512 - dado);
    g.fillStyle = '#3a2416'; g.fillRect(0, dado - 8, 512, 9);
    const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, 'rgba(60,40,20,0.45)'); gr.addColorStop(1, 'rgba(60,40,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 160);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8 });
  const doorW = 1.0, doorH = 2.1, doorX = -0.4;
  // back wall with the door opening (and the fanlight), a side wall, the floor, a low ceiling
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0); s.lineTo(doorX - doorW / 2, 0); s.lineTo(doorX - doorW / 2, doorH + 0.55); s.lineTo(doorX + doorW / 2, doorH + 0.55); s.lineTo(doorX + doorW / 2, 0);
  s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.closePath();
  const back = new THREE.Mesh(new THREE.ShapeGeometry(s), wallMat);
  back.position.z = -D / 2; G.add(back);
  // ShapeGeometry UVs are metres: scale the texture to the wall
  wallTex.repeat.set(1 / W, 1 / H); wallTex.offset.set(0.5, 0); wallTex.wrapS = THREE.RepeatWrapping;
  const sideMat = new THREE.MeshStandardMaterial({ map: wallTex.clone(), roughness: 0.8 });
  sideMat.map.repeat.set(1, 1); sideMat.map.offset.set(0, 0); sideMat.map.needsUpdate = true;
  const side = new THREE.Mesh(new THREE.PlaneGeometry(D, H), sideMat); side.rotation.y = Math.PI / 2; side.position.set(-W / 2, H / 2, 0); G.add(side);
  const side2 = new THREE.Mesh(new THREE.PlaneGeometry(D, H), sideMat); side2.rotation.y = -Math.PI / 2; side2.position.set(W / 2, H / 2, 0); G.add(side2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.matte('#3a2a20', { roughness: 0.6 })); floor.rotation.x = -Math.PI / 2; G.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.matte('#9a8a6a')); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; G.add(ceil);
  // the stage door (the shared prop: maroon, fanlight), opening inward toward us
  const door = T.theatreDoor({ style: 'maroon', w: doorW, h: doorH, fanlight: true });
  door.position.set(doorX, 0, -D / 2 + 0.02); G.add(door);
  door.traverse((o) => { if (o.isMesh && o.geometry?.type === 'PlaneGeometry' && o.material?.color && o.material.color.getHex() === 0x050404) o.visible = false; });
  // outside: a grey dawn over a wet alley (brick opposite, a lamp post gone out, a puddle with the sky in it)
  const sky = document.createElement('canvas'); sky.width = 512; sky.height = 640;
  {
    const g = sky.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 640);
    gr.addColorStop(0, '#9aa4ae'); gr.addColorStop(0.45, '#c4c6c2'); gr.addColorStop(0.62, '#e2d8c4'); gr.addColorStop(1, '#8a8a86');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 640);
    // the brick wall across the alley, its top edge against the sky
    g.fillStyle = '#5a4a44'; g.fillRect(0, 300, 512, 340);
    for (let y = 300; y < 640; y += 14) for (let x = (y / 14) % 2 ? 0 : -18; x < 512; x += 36) { const k = Math.random() * 14; g.fillStyle = `rgba(${Math.round(76 + k)},${Math.round(62 + k * 0.6)},${Math.round(58 + k * 0.4)},0.9)`; g.fillRect(x + 1, y + 1, 34, 12); }
    g.fillStyle = 'rgba(200,205,210,0.35)'; g.fillRect(0, 296, 512, 6);
    // wet cobbles in the foreground with the sky in them
    const cg = g.createLinearGradient(0, 520, 0, 640); cg.addColorStop(0, '#6a6c6e'); cg.addColorStop(1, '#3a3c3e');
    g.fillStyle = cg; g.fillRect(0, 520, 512, 120);
    g.fillStyle = 'rgba(200,205,212,0.35)'; g.beginPath(); g.ellipse(300, 590, 120, 16, 0, 0, Math.PI * 2); g.fill();
    // the lamp post
    g.fillStyle = '#26282a'; g.fillRect(96, 150, 9, 380); g.fillRect(80, 140, 40, 12); g.fillRect(86, 110, 28, 32);
  }
  const skyTex = new THREE.CanvasTexture(sky); skyTex.colorSpace = THREE.SRGBColorSpace;
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 5.5), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: true, color: new THREE.Color(0.62, 0.64, 0.68) }));
  outside.position.set(doorX + 0.2, 2.1, -D / 2 - 1.6); G.add(outside);
  // the light: cool grey coming in through the door, a dim warm bulb inside (the night's last)
  // POLISH: the spot sat 1.2 m outside at door height, so the open leaf's inner face caught a hot disc a hand's breadth
  // across; set further out and up (a sky, not a lamp), narrower, it rakes the leaf evenly and pools on the lino.
  const day = new THREE.SpotLight('#cfd8e4', 0, 12, 0.5, 1.0, 1.2);
  day.position.set(doorX + 0.25, 3.4, -D / 2 - 3.0); day.target.position.set(doorX + 0.5, 0, 0.5); G.add(day, day.target);
  const fill = new THREE.HemisphereLight('#b8c4d4', '#2a2420', 0); G.add(fill);
  const bulb = new THREE.PointLight('#ffc890', 0.8, 5, 1.6); bulb.position.set(1.4, 2.8, 0.2); G.add(bulb);
  // a few things of the Green Room: the coat stand (a hat on it), a fire bucket, a bentwood chair
  const stand = new THREE.Group(); stand.position.set(-1.7, 0, -D / 2 + 0.35); G.add(stand);
  stand.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.8, 10).translate(0, 0.9, 0), M.wood({ tint: '#3a2416' })));
  for (let i = 0; i < 4; i++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.45, 6), M.wood({ tint: '#3a2416' })); leg.position.set(Math.cos(i * 1.57) * 0.18, 0.1, Math.sin(i * 1.57) * 0.18); leg.rotation.set(Math.sin(i * 1.57) * 1.0, 0, -Math.cos(i * 1.57) * 1.0); stand.add(leg); }
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1), M.matte('#1c1a18')); hat.position.set(0.05, 1.78, 0); stand.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.012, 20), M.matte('#1c1a18')); brim.position.set(0.05, 1.78, 0); stand.add(brim);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.3, 16, 1, true).translate(0, 0.15, 0), M.enamel('#b8231c')); bucket.position.set(0.55, 0, -D / 2 + 0.25); G.add(bucket);
  const word = T.textPlate ? T.textPlate('FIRE', 0.18, { style: 'ivory', pw: 256, ph: 96 }) : null;
  if (word) { word.position.set(0.55, 0.16, -D / 2 + 0.41); G.add(word); }
  G.visible = false;
  let open = 0;
  return {
    object: G, door,
    vantage: { position: DAWN_AT.clone().add(v3(1.3, 1.55, 1.6)).toArray(), lookAt: DAWN_AT.clone().add(v3(doorX, 1.25, -D / 2)).toArray(), fov: 55, yawLimit: 8, pitchLimit: 5 },
    show(b) { G.visible = !!b; },
    /** 0 = shut and dim, 1 = wide open on the morning. */
    setOpen(t) {
      open = t;
      door.userData.setOpen(t);
      day.intensity = 22 * t; // POLISH: 16 → 22 for the spot set further out
      fill.intensity = 0.2 + 0.55 * t;
    },
    get open() { return open; },
  };
}

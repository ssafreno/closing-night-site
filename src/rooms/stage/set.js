// The Stage (SET-stage). buildSet(ctx, group) builds the hub set into `group` and returns `handles`: every object the
// five puzzles touch, every delight, the doors, the perches and the lighting rig. It registers NO hotspots, so the
// finale can reuse it standalone (index.js registers them). See docs/notes/set-stage.md for the handle list.
//
// Coordinates (metres, room group = world): the audience is at +Z. Stage left (the prompt side) is +X, stage right
// is -X. The curtain line is z = 4.0, the back wall z = -6.5, the side walls x = ±8.5, the fly tower 17 m high.
// The apron runs to z = 5.4, the orchestra pit to 7.4, then the stalls (floor y = -1.1). House left is -X.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as T from '../../engine/props/theatre.js';
import * as P from '../../engine/props/particles.js';
import { mesh, noRay, grp, boxG, cylG, mergeG, mergeInto, tubeG, halo, TAU } from '../../engine/props/theatre/common.js';
import { makeCanvas, canvasTexture, rng } from '../../engine/props/textures.js';
import * as S from './props.js';

export const STAGE = { x0: -8.5, x1: 8.5, zBack: -6.5, zCurtain: 4.0, zApron: 5.4, zPit: 7.4, flyH: 17, gallery: 7.5, house: 9.5 };
export const OPENING = { w: 9.4, h: 6.8, rise: 0.9 };
/** The main vantage: downstage left, just onstage of the prompt corner, looking across to upstage right. */
export const VANTAGE = { position: [5.4, 1.6, 3.2], lookAt: [0.1, 0.9, -5.3], fov: 62, yawLimit: 85, pitchLimit: 34 };
/** Arrival vantages per door (vantageFor). foyer, null (fresh load / title) and anything else use VANTAGE. */
export const ARRIVALS = {
  door: { position: [7.0, 1.6, -1.4], lookAt: [-3, 1.0, -2.2], fov: 62, yawLimit: 85, pitchLimit: 34 },
  wardrobe: { position: [-6.8, 1.6, -2.0], lookAt: [3.0, 1.0, 3.5], fov: 62, yawLimit: 85, pitchLimit: 34 },
  pit: { position: [-5.0, 1.6, 1.4], lookAt: [3, 1.0, -1.6], fov: 62, yawLimit: 85, pitchLimit: 34 },
  dressing: { position: [6.4, 1.6, -5.0], lookAt: [-1, 1.0, 0.2], fov: 62, yawLimit: 85, pitchLimit: 34 },
  // once Gull Point is flown in (flyrail) its black back hides the stage from upstage: arrive downstage of line 7
  dressingClothIn: { position: [6.7, 1.6, -3.5], lookAt: [-3, 1.1, -0.6], fov: 62, yawLimit: 85, pitchLimit: 34 },
  // FIXED BY integration-qa: once SET is in, Gull Point hides the iron stair from the door arrival and the truck on blue
  // hides it from VANTAGE (0/63 and 7/63 sampled clicks reach it). From the footlights every exit, the desk and the
  // dimmer are in reach (stair 35/63, the rest 50-63/63). Used for the door arrival, Continue, and the SET solve.
  setIn: { position: [1.8, 1.6, 3.5], lookAt: [0.55, 1.1, -5.4], fov: 62, yawLimit: 85, pitchLimit: 34 },
};
/** The finale vantage: standing at the prompt desk. */
export const FINALE_VANTAGE = { position: [7.55, 1.6, 2.2], lookAt: [-2.4, 1.4, -2.6], fov: 60, yawLimit: 50, pitchLimit: 20 };
/** Spike-mark centres [x, z]. BLUE at R.C. (stage right of centre, -X), RED centre, YELLOW L.C. */
export const SPIKES = { blue: [-2.4, -2.6], red: [0, -2.6], yellow: [2.4, -2.6] };
/** The truck's parked pose (SR wing, beside the tavern flats). r = quarter turns clockwise seen from above. */
export const TRUCK_PARK = { x: -6.0, z: -2.9, r: 0 };
/** r for "door to the prompt side" (+X): the door starts at +Z; one clockwise quarter turn from above takes +Z to -X. */
export const TRUCK_DOOR_PROMPT = 3;
export const GHOST_POS = [0, 0, -1.2];
export const GHOST_WING = [6.0, 0, -0.35];
export const DESK_POS = [7.0, 0, 2.2];
export const DIPS_POS = [5.0, 0, -6.2];
/** The eight fly lines: z of the flown piece, the rope-lock card, the delight key. Line 1 is the most downstage. */
export const FLY_LINES = [
  { n: 1, z: 3.7, card: '1 — TABS', key: 'tabs' },
  { n: 2, z: 3.2, card: '2 — BORDER 1', key: 'border1' },
  { n: 3, z: 2.6, card: '3 — LX BAR 1', key: 'lxbar' },
  { n: 4, z: 1.6, card: '4 — CLOTH: COTTAGE', key: 'cottage' },
  { n: 5, z: 0.2, card: '5 — BORDER 2', key: 'border2' },
  { n: 6, z: -1.4, card: '6 — CLOTH: TAVERN', key: 'tavern' },
  { n: 7, z: -4.2, card: '7 — GULL PT. CLOTH', key: 'gullpoint' },
  { n: 8, z: -5.8, card: '8 — CYC', key: 'cyc' },
];
/** Line 7's cloth: hem height when flown OUT (stored) and IN (at trim, the white tape on the spike). */
export const CLOTH = { w: 11.2, h: 7.6, out: 7.0, trim: 0.04, crash: -0.0, light: 12.5 };

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const F = (p, l, fov) => ({ position: v3(...p), lookAt: v3(...l), ...(fov ? { fov } : {}) });
/** Position (and yaw) an object; returns it. */
function at(o, x, y, z, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; return o; }
/** Never merged by mergeStatic (it moves, glows, hides or is a hover highlight). */
function keep(o) { if (o) o.userData.keep = true; return o; }
/** An invisible hit box (Interaction picks it; mergeStatic skips it). */
function proxy(w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.userData.hitProxy = true; m.userData.keep = true; return m;
}
/** A canvas texture drawn by fn(g, w, h). */
function canvasTex(w, h, fn, opts) { const c = makeCanvas(w, h); fn(c.getContext('2d'), w, h); return canvasTexture(c, opts); }
/** A cached texture cloned with a repeat (UVs in metres → `perM` tiles per metre). */
function tiled(tex, perM) { const t = tex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(perM, perM); t.needsUpdate = true; return t; }
/**
 * A wall outline in its own (u, y) plane with door notches cut up from the floor (each [uCentre, w, h]) and an optional
 * arch notch ({ w, spring, crown }) and interior holes ([uCentre, yCentre, w, h]). ShapeGeometry UVs are the (u, y) metres.
 */
function wallGeo(u0, u1, h, { doors = [], arch = null, holes = [] } = {}) {
  const s = new THREE.Shape();
  s.moveTo(u0, 0);
  const notches = doors.map(([c, w, hh]) => ({ a: c - w / 2, b: c + w / 2, pts: [[c - w / 2, hh], [c + w / 2, hh]] }));
  if (arch) {
    const { w, spring, crown } = arch, rise = crown - spring, R = ((w / 2) ** 2 + rise ** 2) / (2 * rise), cy = crown - R, a0 = Math.asin((w / 2) / R);
    const pts = [[-w / 2, spring]];
    for (let i = 0; i <= 32; i++) { const a = -a0 + 2 * a0 * i / 32; pts.push([Math.sin(a) * R, cy + Math.cos(a) * R]); }
    pts.push([w / 2, spring]);
    notches.push({ a: -w / 2, b: w / 2, pts });
  }
  notches.sort((p, q) => p.a - q.a);
  for (const n of notches) { s.lineTo(n.a, 0); for (const [x, y] of n.pts) s.lineTo(x, y); s.lineTo(n.b, 0); }
  s.lineTo(u1, 0); s.lineTo(u1, h); s.lineTo(u0, h); s.closePath();
  for (const [c, y, w, hh] of holes) { const p = new THREE.Path(); p.moveTo(c - w / 2, y - hh / 2); p.lineTo(c + w / 2, y - hh / 2); p.lineTo(c + w / 2, y + hh / 2); p.lineTo(c - w / 2, y + hh / 2); p.closePath(); s.holes.push(p); }
  return new THREE.ShapeGeometry(s, 32);
}

// =====================================================================================================================
// LIGHTING RIG: named channels, each a set of lights (intensity = base × level) plus hooks (bulbs, glows, beams).
// The light count never changes (no shader recompiles): a dark channel is intensity 0, and a shadow light at 0 stops
// re-rendering its shadow map. apply(levels, dur) fades every channel to a target over `dur` seconds.
// =====================================================================================================================
/** Channel levels per named state. env / exposure are the scene's environment intensity and tone-mapping exposure. */
export const LOOKS = {
  // fresh: pitch black but the green-room spill, the shimmer, the dips, the EXIT signs
  dark: { ambient: 0.05, shim: 1, spill: 1, env: 0.035, exposure: 1.25 },
  // ghost light lit: one warm pool, Pike's desk lamp
  ghost: { ambient: 0.05, ghost: 1, spill: 1, desk: 1, houseGlow: 0.7, env: 0.04, exposure: 1.2 },
  // mains: the bulkhead work lights, flat and cool; the fly-rail lamp
  work: { ambient: 0.32, ghost: 1, spill: 0.8, desk: 1, work: 1, flyLamp: 1, houseGlow: 1, env: 0.16, exposure: 1.0 },
  // Q34 MOONLIGHT (Battens ¼ · Floats OUT · Limes ½ · Blues FULL): the stage's resting look after `dimmer`
  moon: { ambient: 0.08, ghost: 0.75, spill: 0.6, desk: 1, flyLamp: 1, houseGlow: 1, battens: 0.25, floats: 0, limes: 0.5, blues: 1, env: 0.06, exposure: 1.15 },
  // finale pre-show: tabs in, blue-black, the desk lamp, the ghost light in the wing, the house glowing past the tabs
  preshow: { ambient: 0.04, ghost: 0.7, desk: 1, house: 1, blues: 0.12, env: 0.04, exposure: 1.2 },
  // finale Q37: the lamp blazes, limes full on her
  lamp: { ambient: 0.06, ghost: 0.6, desk: 1, houseGlow: 1, battens: 0.25, limes: 1, blues: 1, lamp: 1, env: 0.06, exposure: 1.1 },
  // finale Q40: house lights up over the moonlit stage
  houseup: { ambient: 0.12, ghost: 0.6, desk: 1, battens: 0.4, limes: 0.8, blues: 0.8, lamp: 1, house: 1, env: 0.12, exposure: 1.05 },
};
/** The state a save restores to (see the spec's state-restore notes). */
export function lookFor(state) {
  if (!state.isSolved('ghostlight')) return 'dark';
  if (!state.isSolved('mains')) return 'ghost';
  if (!state.isSolved('dimmer')) return 'work';
  return 'moon';
}

function makeRig() {
  const channels = new Map();
  const ch = (name) => { if (!channels.has(name)) channels.set(name, { level: 0, from: 0, to: 0, t: 0, dur: 0, lights: [], fns: [] }); return channels.get(name); };
  const set = (c, k) => {
    c.level = k;
    for (const { light, base } of c.lights) {
      light.intensity = base * k;
      if (light.castShadow) { const on = k > 0.003; if (on && !light.shadow.autoUpdate) light.shadow.needsUpdate = true; light.shadow.autoUpdate = on; }
    }
    for (const f of c.fns) f(k);
  };
  const look = { env: 0.04, exposure: 1.2, from: [0.04, 1.2], to: [0.04, 1.2], t: 0, dur: 0 };
  let flashT = 0;
  const rig = {
    channels,
    state: 'dark',
    /** Add a light to a channel; its current intensity is the level-1 value. */
    add(name, light, base = light.intensity) { ch(name).lights.push({ light, base }); light.intensity = 0; if (light.castShadow) light.shadow.autoUpdate = false; return light; },
    /** Add a hook fn(level) to a channel (bulbs, glows, beams). */
    hook(name, fn) { ch(name).fns.push(fn); fn(ch(name).level); },
    level(name) { return channels.get(name)?.level ?? 0; },
    /** Fade every channel to `levels` (missing channels go to 0) over dur seconds; env / exposure too if given. */
    apply(levels, dur = 0) {
      for (const [name, c] of channels) {
        if (name === 'flash') continue;
        const k = levels[name] ?? 0;
        if (dur <= 0) { c.dur = 0; c.to = k; set(c, k); } else { c.from = c.level; c.to = k; c.t = 0; c.dur = dur; }
      }
      if (levels.env != null || levels.exposure != null) {
        const to = [levels.env ?? look.env, levels.exposure ?? look.exposure];
        if (dur <= 0) { look.env = to[0]; look.exposure = to[1]; look.dur = 0; } else { look.from = [look.env, look.exposure]; look.to = to; look.t = 0; look.dur = dur; }
      }
    },
    /** One named look from LOOKS. */
    setState(name, dur = 0) { if (!LOOKS[name]) return; rig.state = name; rig.apply(LOOKS[name], dur); },
    /** Fade one channel only. */
    fade(name, k, dur = 0) { const c = channels.get(name); if (!c) return; if (dur <= 0) { c.dur = 0; c.to = k; set(c, k); } else { c.from = c.level; c.to = k; c.t = 0; c.dur = dur; } },
    /**
     * The dimmer board's four channels from lever fractions (0..1 each), on top of the current non-dimmer channels:
     * work lights off. Used for the moonlight state and for the 2-second preview of a wrong setting.
     */
    dimmer({ battens = 0, floats = 0, limes = 0, blues = 0 }, dur = 1) {
      const cur = Object.fromEntries([...channels].map(([n, c]) => [n, c.to]));
      rig.apply({ ...cur, work: 0, ambient: 0.08, battens, floats, limes, blues, env: 0.06 + 0.12 * Math.max(battens, floats), exposure: 1.1 }, dur);
    },
    /** The thunder flash: a white-out for ~0.15 s. */
    flash(dur = 0.15) { flashT = dur; },
    get env() { return look.env; },
    get exposure() { return look.exposure; },
    update(dt) {
      for (const [name, c] of channels) {
        if (name === 'flash') continue;
        if (c.dur > 0) { c.t += dt; const u = Math.min(1, c.t / c.dur), e = u * u * (3 - 2 * u); set(c, c.from + (c.to - c.from) * e); if (u >= 1) c.dur = 0; }
      }
      if (look.dur > 0) { look.t += dt; const u = Math.min(1, look.t / look.dur), e = u * u * (3 - 2 * u); look.env = look.from[0] + (look.to[0] - look.from[0]) * e; look.exposure = look.from[1] + (look.to[1] - look.from[1]) * e; if (u >= 1) look.dur = 0; }
      const fl = channels.get('flash');
      if (fl) { const k = flashT > 0 ? 1 : Math.max(0, fl.level - dt * 6); flashT = Math.max(0, flashT - dt); if (k !== fl.level) set(fl, k); }
    },
  };
  return rig;
}

// =====================================================================================================================
// BUILD
// =====================================================================================================================
/**
 * Build the stage into `group`. Returns the handles (see docs/notes/set-stage.md). Visuals start in the fresh (dark)
 * state; the room's restore() moves them to the save's state through the handles.
 */
export function buildSet(ctx, group) {
  const G = group;
  const H = { perches: {}, doors: {}, cueLights: {} };
  const rig = makeRig();
  H.lights = rig;
  const r = rng(7);

  // ---------------------------------------------------------------------------------------------------------------
  // SURFACES
  // ---------------------------------------------------------------------------------------------------------------
  const floorTex = T.scuffedFloorTexture({ tint: '#2a2825', planks: 8, scuffs: 0.85, paint: 0.5, tape: ['#e8e4d8', '#9a948a'], seed: 33, size: 1024 });
  const floorMat = new THREE.MeshStandardMaterial({ map: tiled(floorTex, 1 / 1.25), roughness: 0.82, metalness: 0 });
  const blackBrick = new THREE.MeshStandardMaterial({ map: tiled(T.brickTexture({ tint: '#3a2a24', mortar: '#2a2622', paint: '#141312', paintAmt: 0.85, soot: 0.5, seed: 41 }), 1 / 0.9), roughness: 0.95 });
  const sideBrick = new THREE.MeshStandardMaterial({ map: tiled(T.brickTexture({ tint: '#5e3a2c', mortar: '#3e3630', paint: '#1c1a19', paintAmt: 0.45, soot: 0.55, seed: 43 }), 1 / 0.9), roughness: 0.95 });
  const sootPlaster = new THREE.MeshStandardMaterial({ color: '#2a2624', roughness: 1 });
  const blackVelour = M.matte('#0c0b0c', { roughness: 1 });
  const timber = M.dustyWood();
  const darkTimber = M.dustyWood({ tint: '#3a3028' });
  const ironB = M.ironBlack();
  const houseWall = new THREE.MeshStandardMaterial({ map: tiled(T.wornPlasterTexture({ tint: '#5a1c1e', seed: 25, cracks: 2, stains: 4 }), 1 / 3), roughness: 0.92 });
  const houseDark = M.matte('#120808');

  // stage floor: one shape with holes for the orchestra hatch, the trap and the three dips (shape y = -z)
  {
    const s = new THREE.Shape();
    s.moveTo(STAGE.x0, -STAGE.zBack); s.lineTo(STAGE.x1, -STAGE.zBack); s.lineTo(STAGE.x1, -3.93);
    s.lineTo(5.5, -3.93); s.lineTo(5.5, -STAGE.zApron); s.lineTo(-5.5, -STAGE.zApron); s.lineTo(-5.5, -3.93);
    s.lineTo(STAGE.x0, -3.93); s.closePath();
    const hole = (cx, cz, w, d) => { const p = new THREE.Path(); p.moveTo(cx - w / 2, -cz + d / 2); p.lineTo(cx + w / 2, -cz + d / 2); p.lineTo(cx + w / 2, -cz - d / 2); p.lineTo(cx - w / 2, -cz - d / 2); p.closePath(); s.holes.push(p); };
    hole(-5.8, 2.6, 0.95, 1.5);          // orchestra hatch
    hole(0, 0.6, 1.2, 0.9);              // trapdoor
    for (let i = -1; i <= 1; i++) hole(DIPS_POS[0] + i * 0.6, DIPS_POS[2], 0.34, 0.28); // dips
    const geo = new THREE.ShapeGeometry(s, 8).rotateX(-Math.PI / 2);
    const floor = mesh(geo, floorMat, { cast: false });
    floor.name = 'stageFloor';
    G.add(floor);
    // the apron's front edge (a nosing) and the dark face down into the pit
    G.add(mergeInto([boxG(11.04, 0.05, 0.06, 0, -0.02, STAGE.zApron + 0.02, 0.01)], darkTimber));
    G.add(mesh(boxG(11, 1.3, 0.05, 0, -0.65, STAGE.zApron + 0.03, 0.002).translate(0, 0, 0), M.matte('#1a1412')));
  }

  // walls: back wall (black-painted brick), SR wall, SL wall (doors to the foyer and the green room), proscenium return
  {
    const H17 = STAGE.flyH;
    const back = mesh(wallGeo(STAGE.x0, STAGE.x1, H17, { doors: [[7.4, 1.1, 2.25]] }), blackBrick, { cast: false });
    back.position.z = STAGE.zBack; G.add(back);
    const sr = mesh(wallGeo(-3.93, -STAGE.zBack, H17), sideBrick, { cast: false });
    sr.rotation.y = Math.PI / 2; sr.position.x = STAGE.x0; G.add(sr);
    const sl = mesh(wallGeo(STAGE.zBack, 3.93, H17, { doors: [[-1.6, 1.1, 2.25], [3.35, 1.1, 2.25]] }), sideBrick, { cast: false });
    sl.rotation.y = -Math.PI / 2; sl.position.x = STAGE.x1; G.add(sl);
    const ret = mesh(wallGeo(STAGE.x0, STAGE.x1, H17, { arch: { w: OPENING.w, spring: OPENING.h - OPENING.rise, crown: OPENING.h } }), sootPlaster, { cast: false });
    ret.rotation.y = Math.PI; ret.position.z = 3.93; G.add(ret);
    // a painted dado band of black on the side walls (where hands and flats have rubbed), and skirting
    G.add(mergeInto([
      boxG(0.02, 1.2, 10.4, STAGE.x0 + 0.01, 0.6, -1.3, 0.002), boxG(0.02, 1.2, 4.4, STAGE.x1 - 0.01, 0.6, -4.3, 0.002), boxG(0.02, 1.2, 3.6, STAGE.x1 - 0.01, 0.6, 0.85, 0.002),
      boxG(17, 0.14, 0.03, 0, 0.07, STAGE.zBack + 0.015, 0.002),
    ], M.matte('#121110', { roughness: 0.7 }), { cast: false }));
    // the grid: a slatted iron deck high in the dark, with the head blocks over the SR wall
    const grid = [];
    for (let x = -8.2; x <= 8.2; x += 0.45) grid.push(boxG(0.06, 0.12, 10.4, x, H17 - 0.4, -1.3, 0));
    for (let z = -6.2; z <= 3.6; z += 2.4) grid.push(boxG(17, 0.3, 0.12, 0, H17 - 0.6, z, 0));
    G.add(mergeInto(grid, ironB, { cast: false }));
    G.add(mesh(new THREE.PlaneGeometry(17, 10.6).rotateX(Math.PI / 2).translate(0, H17, -1.3), M.matte('#050505'), { cast: false }));
    // fly galleries on both walls at 7.5 m: deck, rail, a few sandbags and coils
    for (const s of [-1, 1]) {
      const x = s * (STAGE.x1 - 0.6);
      const gal = [boxG(1.2, 0.08, 10.2, x, STAGE.gallery, -1.35, 0.01), boxG(0.06, 0.06, 10.2, x - s * 0.58, STAGE.gallery + 1.0, -1.35, 0.004), boxG(0.05, 0.05, 10.2, x - s * 0.58, STAGE.gallery + 0.5, -1.35, 0.004)];
      for (let z = -6.3; z <= 3.7; z += 1.25) gal.push(boxG(0.06, 1.0, 0.06, x - s * 0.58, STAGE.gallery + 0.5, z, 0), boxG(0.08, 0.6, 0.08, x - s * 0.1, STAGE.gallery - 0.3, z, 0));
      G.add(mergeInto(gal, ironB));
      G.add(mesh(boxG(1.18, 0.05, 10.1, x, STAGE.gallery + 0.065, -1.35, 0.004), darkTimber));
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // PROSCENIUM, TABS, FOOTLIGHTS, HOUSE
  // ---------------------------------------------------------------------------------------------------------------
  {
    const pro = T.proscenium({ w: 19, h: 12.4, opening: [OPENING.w, OPENING.h], depth: 0.5, name: 'EMPRESS', rise: OPENING.rise });
    pro.position.z = 4.27; G.add(pro);
    // the plinth under the proscenium either side of the apron, the apron's side faces
    G.add(mergeInto([
      boxG(4.0, 1.1, 0.4, -7.5, -0.55, 4.2, 0.01), boxG(4.0, 1.1, 0.4, 7.5, -0.55, 4.2, 0.01),
      boxG(0.06, 1.1, 1.4, -5.5, -0.55, 4.7, 0.004), boxG(0.06, 1.1, 1.4, 5.5, -0.55, 4.7, 0.004),
    ], M.walnut({ tint: '#2a1810' })));
  }
  const tabs = keep(T.houseTabs({ w: 10.6, h: 7.4, mode: 'fly', fringe: true, sway: 0.25 }));
  tabs.position.z = 3.7; G.add(tabs);
  H.tabs = { object: tabs, setOpen: (t) => tabs.userData.setOpen(t), get open() { return tabs.userData.open; } };
  tabs.userData.setOpen(1);

  const foots = keep(T.footlights({ w: 9.2, count: 22, lit: 0 }));
  foots.position.set(0, 0, 5.12); G.add(foots);
  rig.hook('floats', (k) => foots.userData.setLit(k));

  // the house: stalls floor, pit, side walls, the circle front, the Royal Box (house left = -X), EXIT signs
  const house = grp('house'); G.add(house);
  {
    const fl = -1.1, back = 19;
    house.add(mesh(mergeG([boxG(4.0, 0.1, 3.1, -7.5, fl - 0.05, 5.85, 0.002), boxG(4.0, 0.1, 3.1, 7.5, fl - 0.05, 5.85, 0.002), boxG(19, 0.1, back - 7.4, 0, fl - 0.05, (7.4 + back) / 2, 0.002)]), M.matte('#1a0e0c', { roughness: 0.95 }), { cast: false }));
    // the pit: a dark well below the apron (the pit room proper is elsewhere)
    house.add(mesh(mergeG([boxG(11, 0.1, 2.0, 0, -2.45, 6.4, 0.002), boxG(0.1, 1.3, 2.0, -5.5, -1.75, 6.4, 0.002), boxG(0.1, 1.3, 2.0, 5.5, -1.75, 6.4, 0.002), boxG(11, 1.3, 0.1, 0, -1.75, 7.42, 0.002)]), M.matte('#0a0808'), { cast: false }));
    const prail = T.pitRail({ w: 11, h: 0.95, curtain: true });
    prail.position.set(0, fl, 7.45); house.add(prail);
    // side walls with a hole for the Royal Box (house left) and its pair (house right)
    for (const s of [-1, 1]) {
      // u runs along the wall: u = -z on the house-left wall (faces +X), u = z on the house-right wall (faces -X)
      const geo = s < 0 ? wallGeo(-back, -4.27, 13.1, { holes: [[-6.6, 4.85, 2.85, 2.75]] }) : wallGeo(4.27, back, 13.1, { holes: [[6.6, 4.85, 2.65, 2.65]] });
      const w = mesh(geo, houseWall, { cast: false });
      w.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      w.position.set(s * STAGE.house, fl, 0);
      house.add(w);
    }
    house.add(mesh(new THREE.PlaneGeometry(19, back - 4.27).rotateX(Math.PI / 2).translate(0, 12, (back + 4.27) / 2), M.matte('#1a0c0a'), { cast: false }));
    house.add(mesh(new THREE.PlaneGeometry(19, 13.1).rotateY(Math.PI).translate(0, fl + 6.55, back), houseDark, { cast: false }));
    // the dress circle front: a gilt-panelled parapet across the house at 3 m, the dark under it
    const circ = [boxG(19, 1.1, 0.25, 0, 3.0, 13.5, 0.02), boxG(19, 0.12, 0.4, 0, 3.6, 13.45, 0.02)];
    house.add(mergeInto(circ, M.gilt({ pattern: 'panel', repeat: [6, 1] })));
    house.add(mesh(boxG(19, 0.25, 5.4, 0, 2.4, 16.3, 0.01), M.matte('#140a08'), { cast: false }));
    // stalls: the front row real (instanced, ~25k triangles), then cheap plain-box seat backs to the circle
    const rows = T.makeRows({ rows: 1, perRow: [14], spacing: 0.54, rowGap: 0.95, rake: 0.16, curve: 18, aisles: [], tipped: 0.85, seed: 5 });
    rows.rotation.y = Math.PI; rows.position.set(0, fl, 8.5); house.add(rows);
    const backs = [];
    for (let ri = 0; ri < 14; ri++) for (let i = 0; i < 18; i++) {
      const x = (i - 8.5) * 0.54, z = 8.5 + (1 + ri) * 0.95, y = fl + (1 + ri) * 0.16;
      backs.push(boxG(0.48, 0.55, 0.08, x, y + 0.75, z + 0.2, 0), boxG(0.48, 0.08, 0.42, x, y + 0.45, z, 0));
    }
    house.add(mergeInto(backs, M.velvetRed({ color: '#4a1012', wear: 0.6 }), { cast: false }));
    // EXIT signs over the house doors and the side exits
    for (const [x, y, z, ry] of [[-5.5, 2.4, back - 0.06, Math.PI], [5.5, 2.4, back - 0.06, Math.PI], [-9.44, 1.6, 11.5, Math.PI / 2], [9.44, 1.6, 11.5, -Math.PI / 2]]) {
      const e = T.exitSign({ w: 0.5, lit: 1 }); at(e, x, y, z, ry); house.add(e);
    }
    // house-wall sconces (the house channel): small gilt brackets with tulip shades
    const sconceGlass = T.glowGlass('#ffcf8a', { opacity: 1, intensity: 3, offColor: '#3a2a20' });
    const sc = [], scG = [];
    for (const s of [-1, 1]) for (const z of [10.5, 13.0, 15.5]) {
      const x = s * (STAGE.house - 0.12);
      sc.push(boxG(0.06, 0.2, 0.06, x, 2.3, z, 0.01), cylG(0.01, 0.01, 0.2, 6, x - s * 0.1, 2.45, z).rotateZ(s * Math.PI / 2));
      scG.push(cylG(0.07, 0.04, 0.12, 12, x - s * 0.2, 2.55, z));
    }
    house.add(mergeInto(sc, M.gilt({ pattern: 'plain' })));
    house.add(keep(mesh(mergeG(scG), sconceGlass, { cast: false })));
    rig.hook('house', (k) => sconceGlass.userData.setLevel(k));
  }
  // the Royal Box, house left, nearest the stage; a plainer box opposite
  const royal = keep(T.royalBox({ w: 2.6, h: 2.7, d: 1.6 }));
  at(royal, -9.35, 2.4, 6.6, Math.PI / 2); G.add(royal);
  {
    const opp = T.royalBox({ w: 2.4, h: 2.6, d: 1.4, crown: false, chairs: false });
    at(opp, 9.35, 2.4, 6.6, -Math.PI / 2); G.add(opp);
  }
  // hit boxes for the house (the stalls and the circle beyond the pit) and the Royal Box
  const houseHit = proxy(18.6, 5.0, 9.5); houseHit.position.set(0, 0.6, 12.6); G.add(houseHit);
  const royalHit = proxy(1.7, 2.8, 2.7); royalHit.position.set(-9.15, 2.4 + 1.3, 6.6); G.add(royalHit);
  // the house's own dim glow (the safety lights): just enough to find the Royal Box and the front rows in the dark
  {
    const hg = new THREE.PointLight('#ffcf9a', 4, 11, 1.4); hg.position.set(-4.5, 3.8, 9.0); G.add(hg);
    rig.add('houseGlow', hg);
  }
  H.house = { object: house, hit: houseHit, focus: F([4.2, 1.6, 2.8], [-4, 1.2, 12]) };
  royal.updateMatrix();
  const royalPt = (x, y, z) => v3(x, y, z).applyMatrix4(royal.matrix);
  H.royalBox = { object: royal, hit: royalHit, seatPos: royal.userData.seatPos.map((p) => p.clone().applyMatrix4(royal.matrix)), focus: F([2.0, 2.2, 3.2], [-9.2, 3.2, 6.6], 45) };
  H.perches.cat = { position: royalPt(0.35, royal.userData.railY + 0.055, 0.27).toArray(), rotationY: Math.PI / 2 + 0.25, pose: 'loaf' };

  // ---------------------------------------------------------------------------------------------------------------
  // THE FLIES: borders, LX bar, the cottage and tavern cloths, the Gull Point backcloth on line 7, the cyc
  // ---------------------------------------------------------------------------------------------------------------
  const flies = grp('flies'); G.add(keep(flies));
  const flown = [];
  const liftLines = [];
  {
    const zOf = (n) => FLY_LINES[n - 1].z;
    // borders (black velour): line 2 and line 5
    for (const n of [2, 5]) {
      const b = T.border({ w: 11.5, h: 1.7, color: '#121014', fringe: false, sway: 0 });
      b.position.set(0, 8.9, zOf(n)); flies.add(b); flown.push(b);
      liftLines.push([-4.5, 8.9, zOf(n)], [4.5, 8.9, zOf(n)]);
    }
    // LX bar 1: a barrel with six Fresnels and a cable loom
    const lx = grp('lxBar'); lx.position.set(0, 7.6, zOf(3)); flies.add(lx); flown.push(lx);
    lx.add(mesh(cylG(0.025, 0.025, 10.5, 10).rotateZ(Math.PI / 2), ironB));
    lx.add(mesh(tubeG([[-5.2, -0.02, 0.05], [-2, -0.12, 0.06], [1, -0.1, 0.05], [4, -0.14, 0.06], [5.3, 0, 0.05]], 0.02, { radial: 5, seg: 30 }), M.bakelite('#14110f'), { cast: false }));
    const lanterns = [];
    for (let i = 0; i < 6; i++) {
      const f = T.fresnel({ beam: false, lit: 0 });
      f.position.set(-3.75 + i * 1.5, -0.03, 0); f.rotation.y = Math.PI + (i - 2.5) * 0.08; // hang under the bar, aim upstage
      if (f.userData.tilt) f.userData.tilt.rotation.x = 0.8 + (i % 2) * 0.12;
      lx.add(f); lanterns.push(f);
    }
    liftLines.push([-4.5, 7.6, zOf(3)], [4.5, 7.6, zOf(3)]);
    rig.hook('battens', (k) => lanterns.forEach((f) => f.userData.setLit(Math.min(1, k * 2.5))));
    // the cottage (line 4) and tavern (line 6) cloths, flown out, and the cyc (line 8)
    const cl = (tex, n, hem, opts = {}) => {
      const c = T.backcloth({ w: 10.6, h: 7.4, texture: tex, ripple: 0.006, ...opts });
      c.position.set(0, hem, zOf(n)); flies.add(c); flown.push(c);
      liftLines.push([-4.5, hem + 7.4, zOf(n)], [4.5, hem + 7.4, zOf(n)]);
      return c;
    };
    cl(T.sceneryTexture({ kind: 'cottage' }), 4, 8.2);
    cl(T.sceneryTexture({ kind: 'tavern' }), 6, 7.85);
    cl(null, 8, 8.6, { cyc: true, color: '#7a8ea8' });
    // lift lines up to the grid (static); line 7's travel with its cloth
    G.add(mergeInto(liftLines.map(([x, y, z]) => cylG(0.008, 0.008, STAGE.flyH - y, 4, x, (STAGE.flyH + y) / 2, z)), T.ropeMat ? T.ropeMat('#7a6a4a') : timber, { cast: false }));
  }
  // line 7: the Gull Point backcloth, its batten tag (hung from the bottom bar), its lift lines
  const line7 = keep(grp('line7'));
  G.add(line7);
  const cloth = T.backcloth({ w: CLOTH.w, h: CLOTH.h, texture: T.seascapeTexture({ time: 'night', cliff: 'right', brig: true, lighthouse: false }), ripple: 0.012, horizon: 0.42 });
  cloth.position.set(0, 0, 0); line7.add(cloth);
  line7.add(mergeInto([-4.6, 4.6].map((x) => cylG(0.009, 0.009, 9, 4, x, CLOTH.h + 4.5, 0)), T.ropeMat('#8a7a58'), { cast: false }));
  const tag = S.battenTag({ lines: ['7 — GULL PT.', 'BACKCLOTH', '112 lb'], w: 2.4, h: 1.5, drop: 0.12 });
  tag.position.set(-2.0, -0.02, 0.06); tag.rotation.x = 0.1; line7.add(tag);
  line7.position.set(0, CLOTH.out, FLY_LINES[6].z);
  {
    let hem = CLOTH.out;
    const setHem = (y) => { hem = y; line7.position.y = y; tag.visible = y > 2.2; };
    H.backcloth = {
      object: cloth, group: line7, tag,
      /** Hem height in metres (CLOTH.out = flown out, CLOTH.trim = in at the white tape; 0 = on the deck). */
      setY: setHem,
      get y() { return hem; },
      /** 0 = out (stored), 1 = in at trim. */
      setTrim: (t) => setHem(CLOTH.out + (CLOTH.trim - CLOTH.out) * t),
      setShimmer: (k) => cloth.userData.setShimmer(k),
      setRipple: (a) => cloth.userData.setRipple(a),
      focus: F([-1.0, 1.6, 1.8], [-0.6, 3.2, -4.2], 60),
    };
    H.battenTag = { object: tag, setLit: (k) => tag.userData.setLit(k), worldPos: v3(-2.0, CLOTH.out - 0.8, FLY_LINES[6].z) };
    rig.hook('flyLamp', (k) => tag.userData.setLit(k));
  }
  flown.push(line7);
  H.flies = {
    object: flies,
    /** Hide the flown pieces (borders, LX bar, cloths) for the top-down truck view; line 7 too unless keepCloth. */
    setVisible(b, { keepCloth = false } = {}) { flies.visible = b; line7.visible = b || keepCloth; },
  };

  // ---------------------------------------------------------------------------------------------------------------
  // STAGE RIGHT: the fly rail, weights, slate, whistle, sandbags, tavern flats, the wardrobe stair, the orchestra hatch
  // ---------------------------------------------------------------------------------------------------------------
  const rail = T.flyRail({ sets: 8, spacing: 0.34, railH: 1.0, trackH: 5.2, cards: FLY_LINES.map((l) => l.card), arborY: [3.2, 0.5, 2.4, 0.4, 3.0, 0.45, 0.3, 0.6] });
  at(rail, -8.05, 0, 0.4, Math.PI / 2); G.add(rail);
  rail.updateMatrix();
  const railPt = (lx, ly, lz) => v3(lx, ly, lz).applyMatrix4(rail.matrix);
  const sets = rail.userData.sets;
  sets.forEach((s, i) => { keep(s.arbor); keep(s.lock); });
  // line 7's parts in room coordinates
  const s7 = sets[6];
  const line7Z = railPt(s7.x, 0, 0).z;
  // a hit box per line (rope + lock + card), for the rope delights and for line 7's close-up
  H.ropes = FLY_LINES.map((l, i) => {
    const p = railPt(sets[i].x, 1.15, 0.0);
    const hit = proxy(0.3, 2.1, 0.32); hit.position.set(p.x + 0.02, 1.15, p.z); hit.rotation.y = Math.PI / 2; G.add(hit);
    return { n: l.n, key: l.key, card: l.card, hit, lock: sets[i].lock, arbor: sets[i].arbor };
  });
  // the slate for line 7's running total, on a post beside the line
  const slate = keep(S.chalkSlate());
  {
    const p = railPt(s7.x + 0.17, 1.34, 0.06);
    at(slate, p.x + 0.02, p.y, p.z, Math.PI / 2); slate.rotation.order = 'YXZ'; slate.rotation.x = -0.12;
    G.add(slate);
    G.add(mesh(boxG(0.04, 1.3, 0.04, p.x - 0.03, 0.65, p.z + 0.0, 0.004), timber));
    slate.userData.setTotal(0);
  }
  // the two weight stacks (stamped 28 ×4 and 14 ×6) on a low bench in front of line 7, each weight its own mesh
  const bench = grp('weightBench'); G.add(bench);
  const benchX = -7.25, benchZ = line7Z - 0.05, benchY = 0.42;
  bench.add(mergeInto([boxG(0.5, 0.05, 1.0, benchX, benchY - 0.025, benchZ, 0.006), ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => boxG(0.05, benchY - 0.05, 0.05, benchX + a * 0.2, (benchY - 0.05) / 2, benchZ + b * 0.44, 0.004))], darkTimber));
  const stacks = { 28: [], 14: [] };
  const stackPos = { 28: v3(benchX, benchY, benchZ + 0.24), 14: v3(benchX, benchY, benchZ - 0.24) };
  const wGeo = { 28: T.weightGeometry(28), 14: T.weightGeometry(14) };
  const wMat = M.iron({ color: '#3a3836', roughness: 0.7 });
  const wH = { 28: 0.068, 14: 0.034 };
  for (const [lb, n] of [[28, 4], [14, 6]]) for (let i = 0; i < n; i++) {
    const w = keep(mesh(wGeo[lb], wMat));
    w.position.copy(stackPos[lb]).add(v3(0, i * wH[lb], 0)); w.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.08;
    w.name = `weight${lb}_${i}`; w.userData.lb = lb;
    G.add(w); stacks[lb].push(w);
  }
  {
    // where weights sit on line 7's arbor (room coords): the arbor's base top plus the stack height
    const arb = s7.arbor;
    const base = railPt(s7.x, arb.position.y + arb.userData.baseTop, -0.24);
    H.flyrail = {
      line: 7, rail, set: s7, arbor: arb, lock: s7.lock, slate,
      stacks, stackPos, weightHeight: wH,
      /** Room-coordinate seat of the k-th weight given the weights already below (heights in metres). */
      arborSeat: (heightBelow) => base.clone().add(v3(0, heightBelow, 0)),
      arborBase: base,
      /** Lift or lower the arbor along its track (local y, metres; the cloth's travel is opposite). */
      setArborY: (y) => { arb.position.y = y; },
      arborY0: arb.position.y,
      setLocked: (b) => s7.lock.userData.setLocked(b),
      setTotal: (lb) => slate.userData.setTotal(lb),
      /** The purchase line's hit box (drag it down to fly the cloth in). */
      purchase: null,
      focus: F([-6.2, 1.5, line7Z + 0.2], [-7.9, 0.85, line7Z], 55),
      tag: H.battenTag,
      cloth: H.backcloth,
    };
    // the purchase line hit: the two ropes in front of line 7 between waist and head height
    const ph = proxy(0.12, 1.4, 0.16);
    const pp = railPt(s7.x, 1.6, -0.06); ph.position.copy(pp); G.add(ph);
    // FIXED BY qa-stage: the ropes below the lock bar (where a hand reaches for them in the close-up) were dead; a child
    // proxy carries the same hotspot down to just above the floor cleat (the lock's own proxy is nearer and still wins).
    { const low = proxy(0.12, 0.5, 0.26); low.position.set(0.1, -1.0, 0); ph.add(low); }
    H.flyrail.purchase = ph;
    s7.lock.userData.setLocked(true);
  }
  // fuse_b hooked over a cleat at the downstage end of the rail
  const fuseB = keep(T.fuse({ color: '#3060c0' }));
  {
    const c = T.cleat({ len: 0.22 });
    const p = railPt(-1.52, 1.25, 0.02);
    at(c, p.x + 0.04, p.y, p.z, Math.PI / 2); c.rotation.z = Math.PI / 2; G.add(c);
    G.add(mesh(boxG(0.06, 1.4, 0.06, p.x - 0.01, 0.7, p.z, 0.004), ironB));
    at(fuseB, p.x + 0.09, p.y + 0.07, p.z, Math.PI / 2); fuseB.rotation.x = 0.3; G.add(fuseB);
    const hit = proxy(0.45, 0.5, 0.45); hit.position.set(p.x + 0.12, p.y, p.z); G.add(hit);
    const sp = P.sparkles({ box: [0.14, 0.12, 0.14], center: [fuseB.position.x, fuseB.position.y, fuseB.position.z], count: 8, size: 0.035, color: '#cfe0ff', color2: '#ffffff' });
    G.add(sp);
    // a blue running light clipped to the rail end, so the cleat and its fuse read in the dark
    {
      const shade = mesh(cylG(0.03, 0.065, 0.1, 12, p.x + 0.12, 2.25, p.z), M.matte('#1a1a1c'), { cast: false });
      const glow = keep(halo('#8fa8ff', 0.2, 0.6)); glow.position.set(p.x + 0.12, 2.18, p.z);
      G.add(shade, glow);
      const rl = new THREE.PointLight('#a8b8ff', 0.9, 2.4, 1.5); rl.position.set(p.x + 0.3, 2.05, p.z); G.add(rl);
      rig.add('spill', rl);
      rig.hook('spill', (k) => { glow.visible = k > 0.01; });
    }
    H.cleat = { object: c, hit, fuse: fuseB, glint: sp, focus: F([p.x + 0.85, 1.55, p.z + 0.35], [p.x + 0.05, 1.28, p.z], 45) };
  }
  // the bosun's whistle on a nail; iron weights and sandbags heaped near the rail; a sandbag waiting in the flies
  const whistle = keep(S.bosunWhistle());
  at(whistle, -8.47, 1.72, 2.25, Math.PI / 2); G.add(whistle);
  const whistleHit = proxy(0.3, 0.35, 0.3); whistleHit.position.set(-8.35, 1.62, 2.25); G.add(whistleHit);
  H.whistle = { object: whistle, hit: whistleHit, focus: F([-7.4, 1.65, 2.45], [-8.45, 1.62, 2.25], 45) };
  {
    const pile = [];
    for (let i = 0; i < 9; i++) { const g = T.weightGeometry(i % 3 ? 14 : 28).clone(); g.rotateY(r() * 0.6).translate(-7.6 + (i % 3) * 0.32 + (r() - 0.5) * 0.06, Math.floor(i / 3) * 0.05, 2.55 + (r() - 0.5) * 0.1); pile.push(g); }
    G.add(mergeInto(pile, wMat));
    for (let i = 0; i < 4; i++) { const sb = T.sandbag({ size: 0.32, seed: 3 + i }); at(sb, -7.2 + (i % 2) * 0.32, Math.floor(i / 2) * 0.16, 1.95 + (i % 2) * 0.12, r() * TAU); G.add(sb); }
  }
  const dropBag = keep(T.sandbag({ size: 0.34, seed: 11 }));
  dropBag.visible = false; G.add(dropBag);
  H.sandbag = {
    object: dropBag,
    /**
     * Drop the sandbag from the flies to land at (x, z): a 0.55 s fall, a thump and a settle. Returns a Promise that
     * resolves on impact (play `sandbagThud` and shake then). It lies where it fell until reset().
     */
    drop(x, z, tween) {
      dropBag.visible = true; dropBag.position.set(x, 9, z); dropBag.rotation.set(0.3, r() * TAU, 0.2);
      return new Promise((res) => {
        const o = { y: 9 };
        tween.to(o, { y: 0 }, { duration: 0.55, ease: 'inQuad', onUpdate: () => { dropBag.position.y = o.y; }, onComplete: () => { dropBag.rotation.set(0, dropBag.rotation.y, 0); res(); } });
      });
    },
    reset() { dropBag.visible = false; },
  };
  // the tavern flats, half-struck, leaning on the SR wall
  const flats = keep(grp('tavernFlats')); G.add(flats);
  {
    const tex = T.sceneryTexture({ kind: 'tavern' });
    [[-2.55, 0.12], [-3.35, 0.1], [-4.1, 0.14]].forEach(([z, lean], i) => {
      const f = T.paintedFlat({ w: 1.3, h: 4.6, texture: tex, brace: false, lean });
      at(f, STAGE.x0 + 0.62 + i * 0.05, 0, z, Math.PI / 2); flats.add(f);
    });
    const hit = proxy(0.6, 3.6, 2.4); hit.position.set(STAGE.x0 + 0.4, 1.8, -3.3); G.add(hit);
    H.flats = { object: flats, hit, focus: F([-5.6, 1.7, -2.4], [-8.2, 1.9, -3.4], 55) };
  }
  // the WARDROBE spiral stair (USR), a landing and doorway high on the SR wall, a cue box on the newel
  const stair = T.spiralStair({ h: 6.4, r: 0.85, steps: 30, turns: 1.55, start: 0.3, rail: true });
  at(stair, -7.3, 0, -5.3); G.add(stair);
  {
    G.add(mergeInto([boxG(1.4, 0.08, 1.8, -7.8, 6.42, -5.3, 0.01), boxG(0.05, 1.0, 1.8, -7.12, 6.95, -5.3, 0.004)], ironB));
    const dw = mesh(new THREE.PlaneGeometry(0.9, 2.05).translate(0, 1.025, 0), M.matte('#030303'), { cast: false });
    at(dw, STAGE.x0 + 0.02, 6.46, -5.3, Math.PI / 2); G.add(dw);
    G.add(mergeInto([boxG(0.06, 2.15, 0.08, STAGE.x0 + 0.04, 6.46 + 1.075, -5.3 - 0.49, 0.004), boxG(0.06, 2.15, 0.08, STAGE.x0 + 0.04, 6.46 + 1.075, -5.3 + 0.49, 0.004), boxG(0.06, 0.08, 1.06, STAGE.x0 + 0.04, 6.46 + 2.1, -5.3, 0.004)], darkTimber));
    const sign = S.arrowSign('WARDROBE', { w: 0.9, h: 0.2, arrow: 0 }); at(sign, STAGE.x0 + 0.03, 6.46 + 2.32, -5.3, Math.PI / 2); G.add(sign);
    const sign2 = S.arrowSign('WARDROBE', { w: 0.8, h: 0.18, arrow: 0 }); at(sign2, -7.3 + 0.07, 1.95, -5.3 + 0.07, Math.PI / 4); G.add(sign2);
  }
  const cueStair = keep(T.cueLightBox({ label: null, state: 'red' }));
  at(cueStair, -7.3 + 0.06, 2.3, -5.3 + 0.06, Math.PI / 4); G.add(cueStair);
  const stairHit = proxy(1.9, 3.0, 1.9); stairHit.position.set(-7.3, 1.5, -5.3); G.add(stairHit);
  H.doors.wardrobe = { object: stairHit, stair, cue: cueStair, to: 'wardrobe' };
  H.cueLights.wardrobe = cueStair;
  // the ORCHESTRA hatch (DSR): steps down toward the pit, a yellow rail, a cue box on a post
  const hatch = S.orchestraHatch({ w: 0.95, d: 1.5 });
  at(hatch, -5.8, 0, 2.6, Math.PI); G.add(hatch);
  const cuePit = keep(T.cueLightBox({ label: null, state: 'red' }));
  {
    G.add(mesh(mergeG([boxG(0.06, 1.8, 0.06, -5.2, 0.9, 1.75, 0.004), boxG(0.3, 0.04, 0.3, -5.2, 0.02, 1.75, 0.004)]), ironB));
    at(cuePit, -5.2, 1.85, 1.79, 0.5); G.add(cuePit);
    const sign = S.arrowSign('ORCHESTRA', { w: 0.62, h: 0.15, arrow: 0 }); at(sign, -5.2, 1.6, 1.79, 0.5); G.add(sign);
  }
  const hatchHit = proxy(1.2, 1.1, 1.7); hatchHit.position.set(-5.8, 0.5, 2.6); G.add(hatchHit);
  H.doors.pit = { object: hatchHit, hatch, cue: cuePit, to: 'pit' };
  H.cueLights.pit = cuePit;
  // the fly-rail working lamp: a caged lamp on a bracket aimed up at line 7's tag (lit from `mains` onward)
  const flyLamp = keep(T.bulkheadLight({ lit: 0 }));
  at(flyLamp, STAGE.x0 + 0.05, 4.4, -1.0, Math.PI / 2); flyLamp.rotation.order = 'YXZ'; flyLamp.rotation.x = -0.55; G.add(flyLamp);
  rig.hook('flyLamp', (k) => flyLamp.userData.setLit(k));
  {
    const s = new THREE.SpotLight('#ffe6c4', 32, 16, 0.32, 0.5, 1.2);
    s.position.set(STAGE.x0 + 0.35, 4.5, -1.0); s.target.position.set(-2.0, 6.0, FLY_LINES[6].z);
    G.add(s, s.target); rig.add('flyLamp', s);
    const p = new THREE.PointLight('#ffe2b8', 3.5, 6, 1.6); p.position.set(-7.6, 3.6, 0.0); G.add(p); rig.add('flyLamp', p);
  }

  /** Room coordinates of a local point on any object in the set. */
  const roomPt = (obj, local) => { G.updateWorldMatrix(true, false); obj.updateWorldMatrix(true, false); return G.worldToLocal(obj.localToWorld(local.clone())); };

  // ---------------------------------------------------------------------------------------------------------------
  // STAGE LEFT (the prompt side): the FOH pass door, the prompt desk, mains, dimmer board, green-room pass door,
  // fire bucket, the floor dips, the props table, the DRESSING ROOMS corridor door
  // ---------------------------------------------------------------------------------------------------------------
  /** A wall door (theatreDoor) with a hit box over the doorway, a cue box above and optional sign. */
  const wallDoor = ({ x, z, ry, style, plates = [], color = null, window = null, open = 0, beyond = true, sign = null, signW = 0.9, cue = 'red' }) => {
    const d = keep(T.theatreDoor({ style, w: 0.9, h: 2.1, plates, color, window }));
    at(d, x, 0, z, ry); G.add(d);
    if (!beyond) { const dark = d.children.find((c) => c.isMesh && c.geometry.type === 'PlaneGeometry'); if (dark) dark.visible = false; }
    d.userData.setOpen(open);
    d.updateMatrix();
    const P_ = (lx, ly, lz) => v3(lx, ly, lz).applyMatrix4(d.matrix);
    const hit = proxy(1.0, 2.15, 0.3); hit.position.copy(P_(0, 1.07, 0.1)); hit.rotation.y = ry; G.add(hit);
    const box = keep(T.cueLightBox({ state: cue }));
    box.position.copy(P_(sign ? -0.32 : 0, 2.42, 0.01)); box.rotation.y = ry; G.add(box);
    let signMesh = null;
    if (sign) { signMesh = S.arrowSign(sign, { w: signW, h: 0.16, arrow: 0 }); signMesh.position.copy(P_(0.2, 2.42, 0.012)); signMesh.rotation.y = ry; G.add(signMesh); }
    return { object: hit, door: d, leaf: d.userData.leaves[0], cue: box, sign: signMesh, setOpen: (t) => d.userData.setOpen(t) };
  };
  // FRONT OF HOUSE pass door (→ foyer), at the downstage end of the SL wall
  H.doors.foyer = { ...wallDoor({ x: STAGE.x1, z: 3.35, ry: -Math.PI / 2, style: 'iron', plates: ['FRONT OF HOUSE'], sign: 'F.O.H.', signW: 0.4 }), to: 'foyer' };
  H.cueLights.foyer = H.doors.foyer.cue;
  // the green-room pass door (→ door), open, warm spill from a lit vestibule, an EXIT sign, an unlit cue box
  H.doors.door = { ...wallDoor({ x: STAGE.x1, z: -1.6, ry: -Math.PI / 2, style: 'iron', plates: ['PASS DOOR'], open: 0.82, beyond: false, cue: 'off' }), to: 'door' };
  H.cueLights.door = H.doors.door.cue;
  {
    const ex = T.exitSign({ w: 0.46, lit: 1 }); at(ex, STAGE.x1 - 0.02, 2.72, -1.6, -Math.PI / 2); G.add(ex);
    const exLight = new THREE.PointLight('#46ff8a', 0.6, 3, 2); exLight.position.set(STAGE.x1 - 0.4, 2.6, -1.6); G.add(exLight);
    // the vestibule: a little green-room passage, lit
    const vx0 = STAGE.x1, vx1 = STAGE.x1 + 2.0, vz0 = -2.7, vz1 = -0.5, vh = 2.8;
    const vMat = new THREE.MeshStandardMaterial({ map: tiled(T.wornPlasterTexture({ tint: '#7a8a5e', seed: 31, dado: '#3a4a2a', dadoH: 0.4 }), 1 / 2.8), roughness: 0.9 });
    const vg = [];
    vg.push(new THREE.PlaneGeometry(vx1 - vx0, vh).translate(0, vh / 2, 0).rotateY(-Math.PI / 2).translate(vx1, 0, (vz0 + vz1) / 2));
    vg.push(new THREE.PlaneGeometry(vx1 - vx0, vh).translate(0, vh / 2, 0).translate((vx0 + vx1) / 2, 0, vz0));
    vg.push(new THREE.PlaneGeometry(vx1 - vx0, vh).translate(0, vh / 2, 0).rotateY(Math.PI).translate((vx0 + vx1) / 2, 0, vz1));
    G.add(mesh(mergeG(vg), vMat, { cast: false }));
    G.add(mesh(new THREE.PlaneGeometry(vx1 - vx0, vz1 - vz0).rotateX(-Math.PI / 2).translate((vx0 + vx1) / 2, 0.001, (vz0 + vz1) / 2), M.linoleum ? M.linoleum({ tint: '#5a3a2a' }) : darkTimber, { cast: false }));
    G.add(mesh(new THREE.PlaneGeometry(vx1 - vx0, vz1 - vz0).rotateX(Math.PI / 2).translate((vx0 + vx1) / 2, vh, (vz0 + vz1) / 2), M.matte('#3a3428'), { cast: false }));
    // a coat on a hook, a framed notice
    const ct = T.coat({ color: '#4a3a2e', cap: false, hook: true, seed: 6 }); at(ct, vx1 - 0.03, 1.75, -2.1, -Math.PI / 2); G.add(ct);
    const bulb = halo('#ffd09a', 0.7, 0.75); bulb.position.set(vx0 + 1.1, vh - 0.25, -1.6); G.add(bulb);
    G.add(mesh(cylG(0.03, 0.05, 0.06, 10, vx0 + 1.1, vh - 0.18, -1.6), M.bakelite('#16120f'), { cast: false }));
    const spill = new THREE.SpotLight('#ffb470', 40, 11, 0.5, 0.75, 1.4);
    spill.position.set(vx0 + 1.6, 2.25, -1.6); spill.target.position.set(5.6, 0, -1.25); G.add(spill, spill.target);
    rig.add('spill', spill);
    const vl = new THREE.PointLight('#ffc890', 4, 3.6, 1.8); vl.position.set(vx0 + 1.1, vh - 0.4, -1.6); G.add(vl);
    rig.add('spill', vl);
    rig.hook('spill', (k) => { bulb.material.opacity = 0.75 * k; bulb.visible = k > 0.01; });
  }
  // the prompt corner: desk (lamp, stopwatch, the cue-light panel under a dust cloth), the PROMPT floor word
  const desk = keep(T.promptDesk({ panel: true, lit: 0 }));
  at(desk, DESK_POS[0], 0, DESK_POS[2], Math.PI / 2); G.add(desk);
  desk.userData.panel?.userData.setCovered(true);
  {
    const L = desk.userData.lamp;
    const bp = roomPt(L, L.userData.bulbPos);
    // the point sits well above the bulb: right at the bulb it blew the dust sheet underneath out to white
    const dl = new THREE.PointLight('#ffd9a0', 1.4, 4.5, 1.6); dl.position.copy(bp).add(v3(-0.15, 0.35, 0)); G.add(dl);
    rig.add('desk', dl);
    rig.hook('desk', (k) => L.userData.setLit(k * 0.5));
    const word = S.floorWord('PROMPT', { w: 1.1 });
    word.position.set(6.15, 0.003, 3.05); G.add(word);
    const deskHit = proxy(0.75, 1.45, 1.05); deskHit.position.set(DESK_POS[0], 0.72, DESK_POS[2]); G.add(deskHit);
    const panel = desk.userData.panel;
    const panelHit = proxy(0.4, 0.3, 0.95); panelHit.position.copy(roomPt(desk.userData.panelMount, v3(0, 0.12, 0.05))); G.add(panelHit);
    H.promptDesk = {
      object: desk, hit: deskHit, lamp: L, panel, panelHit, stopwatch: desk.userData.stopwatch, slope: desk.userData.slope,
      setLamp: (k) => rig.fade('desk', k, 0.4),
      setPanelCovered: (b) => panel?.userData.setCovered(b),
      focus: F([7.9, 1.75, 2.2], [7.0, 1.05, 2.2], 50),
      vantage: FINALE_VANTAGE,
    };
  }
  H.perches.pike = { position: [7.68, 0, 2.2], rotationY: -Math.PI / 2, pose: 'stand' };
  H.perches.pikeFinale = { position: [7.85, 0, 1.4], rotationY: -Math.PI / 2 - 0.35, pose: 'stand' };
  // the mains switch-fuse on the wall behind the desk: three empty carriers R Y B, the big side handle, Sparks's tag
  const mains = keep(T.switchFuse({ tagText: 'MAINS' }));
  at(mains, STAGE.x1, 1.55, 1.3, -Math.PI / 2); G.add(mains);
  {
    const fuseCols = ['#c8302a', '#e0b830', '#3060c0'];
    const seated = mains.userData.slots.map((sp, i) => {
      const f = T.fuse({ color: fuseCols[i] }); f.position.copy(sp).add(v3(0, 0, -0.012)); f.rotation.x = Math.PI / 2; f.visible = false; mains.add(f); return f;
    });
    const slotHits = mains.userData.slots.map((sp) => { const h = proxy(0.09, 0.15, 0.06); h.position.copy(sp); mains.add(h); return h; });
    const handle = mains.userData.handle;
    const handleHit = proxy(0.16, 0.42, 0.16); handleHit.position.set(0.06, 0.16, 0); handle.add(handleHit);
    const tagHit = proxy(0.16, 0.12, 0.08); tagHit.position.copy(mains.userData.tag.position); mains.add(tagHit);
    const boxHit = proxy(0.62, 0.7, 0.3); boxHit.position.set(0.05, 0, 0.12); mains.add(boxHit);
    let hk = 0;
    H.mains = {
      object: mains, hit: boxHit, handle, handleHit, slotHits, tagHit, seated, colors: ['r', 'y', 'b'],
      /** Slot i ('r','y','b' = 0,1,2) shows its fuse seated. */
      setSeated: (i, b) => { seated[i].visible = !!b; },
      /** Handle 0 = OFF (up) … 1 = ON (down, a 90° arc). */
      setHandle: (t) => { hk = t; handle.rotation.x = -t * Math.PI / 2; },
      get handleT() { return hk; },
      /** The handle pivot in room coordinates (for drag maths). */
      pivot: roomPt(mains, handle.position),
      focus: F([7.72, 1.55, 1.42], [8.3, 1.5, 1.42], 50),
    };
  }
  // the dimmer board: four lever handles in slots (BATTENS FLOATS LIMES BLUES), notches OUT ¼ ½ ¾ FULL, MASTER wheel,
  // Sparks's chalk ticks at the Q34 levels
  const dimmer = keep(T.dimmerBoard({ chalk: [{ channel: 0, notch: 1, text: '34' }, { channel: 1, notch: 0, text: '34' }, { channel: 2, notch: 2, text: '34' }, { channel: 3, notch: 4, text: '34' }] }));
  at(dimmer, STAGE.x1 - 0.18, 0, 0.35, -Math.PI / 2); G.add(dimmer);
  {
    const ud = dimmer.userData;
    const leverHits = ud.levers.map((lv) => { const h = proxy(0.12, ud.slotY1 - ud.slotY0 + 0.14, 0.24); h.position.set(lv.position.x, (ud.slotY0 + ud.slotY1) / 2, 0.24); dimmer.add(h); return h; });
    const masterHit = proxy(0.32, 0.32, 0.14); masterHit.position.copy(ud.master.position).add(v3(0, 0, 0.04)); dimmer.add(masterHit);
    const boxHit = proxy(1.45, 1.1, 0.4); boxHit.position.set(0, 1.25, 0.05); dimmer.add(boxHit);
    H.dimmer = {
      object: dimmer, hit: boxHit, levers: ud.levers, leverHits, master: ud.master, masterHit,
      channels: ['battens', 'floats', 'limes', 'blues'], notches: ud.notches,
      /** Lever i to notch n (0 OUT … 4 FULL), or a fraction with frac = true. */
      setLevel: (i, v, frac = false) => ud.setLevel(i, v, frac),
      levels: ud.levels,
      /** Room-coordinate y of the slot's bottom (OUT) and top (FULL). */
      slotY: [ud.slotY0, ud.slotY1],
      /** MASTER wheel turn in radians (clockwise positive; a half-turn = GO). */
      setMaster: (a) => { ud.master.rotation.z = -a; },
      focus: F([6.8, 1.45, 0.35], [8.17, 1.3, 0.35], 50),
    };
  }
  // six caged bulkhead work lights (the mains comes on in pairs) and their three cool fills
  const bulkheads = [];
  for (const [x, y, z, ry] of [[STAGE.x1 - 0.05, 3.3, 0.6, -Math.PI / 2], [STAGE.x1 - 0.05, 3.3, -4.0, -Math.PI / 2], [STAGE.x0 + 0.05, 3.3, 3.0, Math.PI / 2], [STAGE.x0 + 0.05, 3.3, -1.75, Math.PI / 2], [-3.2, 3.3, STAGE.zBack + 0.05, 0], [3.2, 3.3, STAGE.zBack + 0.05, 0]]) {
    const b = keep(T.bulkheadLight({ lit: 0 })); at(b, x, y, z, ry); G.add(b); bulkheads.push(b);
  }
  const workLights = [[7.2, 4.6, -1.6], [-7.2, 4.6, 0.8], [0, 4.6, -5.6]].map(([x, y, z]) => { const l = new THREE.PointLight('#dfe8ff', 26, 18, 1.25); l.position.set(x, y, z); G.add(l); return rig.add('work', l); });
  rig.hook('work', (k) => bulkheads.forEach((b) => b.userData.setLit(k)));
  H.bulkheads = {
    lights: bulkheads,
    /** Pair i (0 SL, 1 SR, 2 back) on or off at once (the mains "clunk on in pairs"); the rig's work channel does the fill. */
    setPair: (i, on) => { bulkheads[i * 2].userData.setLit(on ? 1 : 0, true); bulkheads[i * 2 + 1].userData.setLit(on ? 1 : 0, true); },
  };
  // the fire bucket (under the green-room door) with fuse_r half-buried in the sand
  const bucket = keep(T.fireBucket({ hook: false }));
  at(bucket, 8.22, 0, -0.78, -0.9); G.add(bucket);
  const fuseR = keep(T.fuse({ color: '#c8302a' }));
  {
    const fy = (bucket.userData.fill?.position.y ?? 0.24) + 0.01;
    fuseR.position.set(8.22 + 0.02, fy + 0.02, -0.78 + 0.02); fuseR.rotation.set(0.9, 0.4, 0.5); G.add(fuseR);
    const hit = proxy(0.48, 0.5, 0.48); hit.position.set(8.22, 0.25, -0.78); G.add(hit);
    const sp = P.sparkles({ box: [0.16, 0.1, 0.16], center: [fuseR.position.x, fuseR.position.y + 0.04, fuseR.position.z], count: 8, size: 0.035, color: '#ffe0c0', color2: '#ffffff' });
    G.add(sp);
    H.bucket = { object: bucket, hit, fuse: fuseR, glint: sp, focus: F([7.7, 0.8, -0.55], [8.22, 0.22, -0.78], 42) };
  }
  // the props table (USL wing) with tape outlines and the teacup holding fuse_y
  const propsTable = keep(T.propsTable({
    w: 1.8, d: 0.7, h: 0.82,
    outlines: [
      { shape: 'rect', x: -0.55, z: -0.05, w: 0.62, d: 0.1, label: 'SWORD' },
      { shape: 'circle', x: 0.05, z: -0.08, w: 0.2, label: 'LANTERN' },
      { shape: 'rect', x: 0.5, z: -0.06, w: 0.36, d: 0.13, label: 'FISH' },
      { shape: 'rect', x: -0.35, z: 0.18, w: 0.26, d: 0.18, label: 'LETTER' },
      { shape: 'circle', x: 0.45, z: 0.2, w: 0.15, label: 'CUP' },
    ],
  }));
  at(propsTable, STAGE.x1 - 0.5, 0, -4.6, -Math.PI / 2); G.add(propsTable);
  propsTable.updateMatrix();
  const cup = keep(T.teacup({ tea: false }));
  const fuseY = keep(T.fuse({ color: '#e0b830' }));
  {
    const topY = propsTable.userData.topY;
    const cp = v3(0.45, topY, 0.2).applyMatrix4(propsTable.matrix);
    at(cup, cp.x, cp.y, cp.z, 0.6); G.add(cup);
    fuseY.position.set(cp.x, cp.y + 0.045, cp.z); fuseY.rotation.set(0.5, 0.3, 0.35); G.add(fuseY);
    const cupHit = proxy(0.42, 0.4, 0.42); cupHit.position.set(cp.x, cp.y + 0.1, cp.z); G.add(cupHit);
    const tableHit = proxy(0.8, 0.95, 1.9); tableHit.position.set(STAGE.x1 - 0.5, 0.45, -4.6); G.add(tableHit);
    const sp = P.sparkles({ box: [0.12, 0.1, 0.12], center: [cp.x, cp.y + 0.08, cp.z], count: 8, size: 0.035, color: '#fff2c0', color2: '#ffffff' });
    G.add(sp);
    // a blue-gelled clip lamp over the props table (a backstage running light): the cup and its fuse read in the dark
    {
      const lp = v3(cp.x + 0.05, topY + 0.75, cp.z - 0.3);
      const shade = mesh(cylG(0.035, 0.075, 0.11, 12, lp.x, lp.y, lp.z), M.matte('#1a1a1c'), { cast: false });
      const arm = mesh(mergeG([cylG(0.008, 0.008, 0.82, 6, lp.x + 0.32, topY + 0.41, lp.z), boxG(0.32, 0.014, 0.014, lp.x + 0.16, lp.y + 0.06, lp.z, 0)]), M.matte('#1a1a1c'), { cast: false });
      const glow = keep(halo('#8fa8ff', 0.22, 0.6)); glow.position.set(lp.x, lp.y - 0.07, lp.z);
      G.add(shade, arm, glow);
      const rl = new THREE.PointLight('#a8b8ff', 1.1, 2.6, 1.5); rl.position.set(lp.x, lp.y - 0.12, lp.z); G.add(rl);
      rig.add('spill', rl);
      rig.hook('spill', (k) => { glow.visible = k > 0.01; });
    }
    H.propsTable = { object: propsTable, hit: tableHit, cup, cupHit, fuse: fuseY, glint: sp, focus: F([cp.x - 0.55, cp.y + 0.55, cp.z + 0.15], [cp.x, cp.y + 0.03, cp.z], 42), tableFocus: F([6.6, 1.7, -4.4], [8.0, 0.8, -4.6], 55) };
  }
  // a few lived-in things in the wing: a crate, a skip, a broom against the wall
  {
    const cr = T.crate({ w: 0.7, h: 0.55, d: 0.5, seed: 3 }); at(cr, 7.85, 0, -2.95, -Math.PI / 2 + 0.1); G.add(cr);
    const cr2 = T.crate({ w: 0.6, h: 0.45, d: 0.45, seed: 8 }); at(cr2, 7.9, 0.55, -2.92, -Math.PI / 2 - 0.15); G.add(cr2);
    const sk = T.skip({ label: 'PROPS', w: 0.9, h: 0.5, d: 0.55 }); at(sk, -3.9, 0, -6.0, 0.05); G.add(sk);
    G.add(mergeInto([cylG(0.012, 0.012, 1.35, 6, 0, 0.675, 0).rotateZ(0.12).translate(-1.6, 0, -6.4), boxG(0.32, 0.06, 0.05, -1.52, 0.04, -6.4, 0.01)], timber));
  }
  // the DRESSING ROOMS corridor door, USL on the back wall
  H.doors.dressing = { ...wallDoor({ x: 7.4, z: STAGE.zBack, ry: 0, style: 'panel', plates: [], sign: 'DRESSING ROOMS', signW: 1.0 }), to: 'dressing' };
  H.cueLights.dressing = H.doors.dressing.cue;
  // the three floor dips at the foot of the wall, the cable coil beside them
  const dips = keep(S.floorDips({ count: 3, spacing: 0.6 }));
  dips.position.set(...DIPS_POS); G.add(dips);
  {
    const coil = S.cableCoil({ r: 0.2, turns: 4, seed: 9 }); coil.position.set(6.1, 0, -5.95); coil.rotation.y = 2.4; G.add(coil);
    const socketsRoom = dips.userData.dips.map((d) => d.socket.clone().add(dips.position));
    const hits = dips.userData.dips.map((d, i) => { const h = proxy(0.4, 0.2, 0.42); h.position.copy(socketsRoom[i]).setY(0.05); G.add(h); return h; });
    // a seated plug (shown in the socket of the dip the ghost light is plugged into)
    const plug = keep(grp('seatedPlug'));
    plug.add(mesh(boxG(0.05, 0.035, 0.06, 0, 0.02, 0, 0.008), M.bakelite('#16120f')));
    plug.visible = false; G.add(plug);
    let lit = 1;
    H.dips = {
      object: dips, dips: dips.userData.dips, hits, sockets: socketsRoom,
      setOpen: (i, t) => dips.userData.setOpen(i, t),
      setAllOpen: (t) => { for (let i = 0; i < 3; i++) dips.userData.setOpen(i, t); },
      setGlow: (k) => { lit = k; dips.userData.setGlow(k); },
      /** Show the plug seated in dip i (0..2), or none (null). */
      setPlug: (i) => { if (i == null) { plug.visible = false; return; } plug.visible = true; plug.position.copy(socketsRoom[i]).add(v3(0, 0.03, 0)); },
      focus: F([DIPS_POS[0], 0.95, DIPS_POS[2] + 1.15], [DIPS_POS[0], 0.0, DIPS_POS[2] + 0.02], 50),
    };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // CENTRE: the ghost light (its lights ride with it), Lavinia's shimmer, the trapdoor, the spike marks, the truck
  // ---------------------------------------------------------------------------------------------------------------
  const ghostGroup = keep(grp('ghostLightRig'));
  ghostGroup.position.set(...GHOST_POS); G.add(ghostGroup);
  const ghost = T.ghostLight({ h: 1.88, lit: 0, tagText: 'GHOST LIGHT' });
  ghostGroup.add(ghost);
  {
    const bp = ghost.userData.bulbPos;
    const pt = new THREE.PointLight('#ffb46b', 7, 13, 1.45); pt.position.copy(bp); ghostGroup.add(pt);
    rig.add('ghost', pt);
    const sp = new THREE.SpotLight('#ffb870', 34, 10, 1.22, 0.85, 1.5);
    sp.position.copy(bp).add(v3(0, 0.05, 0)); sp.target.position.set(0, 0, 0);
    sp.castShadow = true; sp.shadow.mapSize.set(2048, 2048); sp.shadow.bias = -0.0008; sp.shadow.normalBias = 0.025; sp.shadow.radius = 3;
    sp.shadow.camera.near = 0.25; sp.shadow.camera.far = 10;
    ghostGroup.add(sp, sp.target);
    rig.add('ghost', sp);
    rig.hook('ghost', (k) => ghost.userData.setLit(Math.min(1, k * 1.15), true));
    // the luminous cable tag (DIP 2 ONLY), readable in the dark at the ghost light's foot
    const tagTex = canvasTex(256, 160, (g, w, h) => {
      g.fillStyle = '#6a5034'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 1);
      g.strokeStyle = '#4a3420'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
      g.beginPath(); g.arc(28, h / 2, 10, 0, TAU); g.fillStyle = '#2a1e12'; g.fill();
      g.fillStyle = '#d8ffe4'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 34px ${T.FONTS.display}`; g.fillText('GHOST LIGHT', w / 2 + 14, h * 0.32);
      g.font = `700 44px ${T.FONTS.display}`; g.fillText('DIP 2 ONLY', w / 2 + 14, h * 0.68);
    });
    const tagMat = new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.9, emissive: '#ffffff', emissiveMap: tagTex, emissiveIntensity: 0.35 });
    const lt = keep(mesh(new THREE.PlaneGeometry(0.17, 0.106).rotateX(-Math.PI / 2), tagMat, { cast: false }));
    const ot = ghost.userData.tag; ot.visible = false;
    lt.position.copy(ot.position).add(v3(0.0, 0.004, 0.0)); lt.rotation.y = 0.85; ghost.add(lt); // reads upright from the vantage side
    // hit boxes: the whole light, the plug (generous), the tag
    // FIXED BY integration-qa: 0.75 m square hid line 7 and the slate behind it from the door arrival (the hub's first view)
    const hit = proxy(0.45, 2.05, 0.45); hit.position.set(0, 1.02, 0); ghostGroup.add(hit);
    const plugHit = proxy(0.36, 0.2, 0.36); plugHit.position.copy(ghost.userData.plug.position).add(v3(-0.05, 0.05, -0.05)); ghostGroup.add(plugHit);
    const tagHit = proxy(0.26, 0.12, 0.2); tagHit.position.copy(lt.position).add(v3(0, 0.04, 0)); ghostGroup.add(tagHit);
    // the cable run to a dip (built when shown, from wherever the ghost light stands)
    let run = null;
    const cable = {
      /** Draw the slack cable from the ghost light's foot to dip i (0..2). */
      showTo(i) {
        cable.hide();
        const from = roomPt(ghost, v3(0.2, 0, 0.2)), to = H.dips.sockets[i];
        run = keep(S.floorCable([from.x, 0, from.z], [to.x, 0, to.z + 0.02], { aY: 0.012, bY: -0.06, seed: 3 + i, wander: 0.35 }));
        G.add(run);
        H.dips.setPlug(i);
      },
      hide() { if (run) { G.remove(run); run.geometry.dispose(); run = null; } H.dips.setPlug(null); },
    };
    H.ghostLight = {
      object: ghost, group: ghostGroup, hit, plug: ghost.userData.plug, plugHit, tag: lt, tagHit, cable,
      bulbPos: roomPt(ghost, bp),
      /** 0..1 over `dur` s: the bulb, the warm pool (point + shadow spot), the dust in the pool. */
      setLit: (k, dur = 0) => rig.fade('ghost', k, dur),
      /** The plug lying at the foot (home) or gone (held by the player / seated in a dip). */
      setPlugHome: (b) => { ghost.userData.plug.visible = !!b; },
      /** Move the whole ghost light (finale: Pike stands it in the wing). */
      moveTo: (x, z) => { ghostGroup.position.set(x, 0, z); },
      home: v3(...GHOST_POS), wing: v3(...GHOST_WING),
      focus: F([1.25, 1.05, 0.05], [0.36, 0.04, -0.72], 50),
    };
  }
  // dust in the ghost light's pool
  const motes = P.dustMotes({ box: [5.5, 2.6, 5.5], center: [GHOST_POS[0], 1.3, GHOST_POS[2]], count: 280, color: '#ffdcb0', size: 0.02, opacity: 0.5 });
  G.add(motes);
  rig.hook('ghost', (k) => { motes.visible = k > 0.05; });
  // Lavinia's shimmer (the dark state) and her perches
  const shimmerPos = [0.8, 0, -1.55];
  const shim = keep(S.shimmer({ h: 1.8 }));
  shim.position.set(...shimmerPos); G.add(shim);
  {
    const l = new THREE.PointLight('#c8b0ff', 3.2, 5, 1.8); l.position.set(shimmerPos[0], 1.1, shimmerPos[2]); G.add(l);
    rig.add('shim', l);
    const hit = proxy(0.7, 1.9, 0.7); hit.position.set(shimmerPos[0], 0.95, shimmerPos[2]); G.add(hit);
    H.shimmer = { object: shim, hit, setLevel: (k, instant) => shim.userData.setLevel(k, instant), light: l };
  }
  H.perches.lavinia = { position: shimmerPos.slice(), rotationY: 0.77, pose: 'stand' };
  // the trapdoor downstage of the ghost light, with its flip sign (MIND THE GAP / THE GAP MINDS YOU)
  const trap = T.trapdoor({ w: 1.2, d: 0.9, sign: true, signText: 'MIND\nTHE GAP' });
  trap.position.set(0, 0, 0.6); G.add(trap);
  {
    const sg = keep(trap.userData.sign), card = trap.userData.signCard;
    sg.rotation.y = 1.0;
    const back = card.children[1];
    const np = T.textPlate('THE GAP\nMINDS YOU', 0.3, { style: 'enamel', bg: '#1f3d2c', fg: '#e8dfc8', pw: 512, ph: 384 });
    back.material = np.material;
    keep(trap.userData.leaf);
    const hit = proxy(0.45, 0.75, 0.3); hit.position.set(0, 0.36, 0); sg.add(hit);
    const trapHit = proxy(1.25, 0.08, 0.95); trapHit.position.set(0, 0.03, 0.6); G.add(trapHit);
    let flipped = 0;
    H.trapdoor = {
      object: trap, sign: sg, signHit: hit, hit: trapHit, leaf: trap.userData.leaf,
      setOpen: (t) => trap.userData.setOpen(t),
      /** Sign face: 0 = MIND THE GAP, 1 = flipped (THE GAP MINDS YOU). Animate with flipSign(tween). */
      setFlipped: (t) => { flipped = t; card.rotation.y = t * Math.PI; },
      flipSign(tween, to = flipped > 0.5 ? 0 : 1) { const o = { t: flipped }; return new Promise((res) => tween.to(o, { t: to }, { duration: 0.7, ease: 'inOutCubic', onUpdate: () => H.trapdoor.setFlipped(o.t), onComplete: res })); },
      get flipped() { return flipped > 0.5; },
      focus: F([1.75, 1.1, 2.2], [0.95, 0.45, 1.25], 45),
    };
  }
  // spike marks: BLUE R.C., RED centre, YELLOW L.C. (all downstage of the backcloth line)
  H.spikes = { centers: SPIKES, radius: 0.3 };
  for (const [name, col] of [['blue', '#2f62e0'], ['red', '#d0302a'], ['yellow', '#e6c22a']]) {
    const m = S.spikeMarks({ color: col, size: 1.5, arm: 0.28, tape: 0.055 });
    m.position.set(SPIKES[name][0], 0.002, SPIKES[name][1]); G.add(m);
    H.spikes[name] = { object: m, center: SPIKES[name] };
  }
  // the lighthouse truck, parked in the SR wing; its door shown from above as a bold red bar
  const truck = keep(T.lighthouseTruck({ h: 3.4, beam: true }));
  G.add(truck);
  {
    const gy = 0.2 + (3.4 - 0.2 - 0.95);
    const red = M.enamel('#c41e16', { roughness: 0.45 });
    truck.add(mesh(mergeG([boxG(0.62, 0.025, 0.12, 0, gy + 0.095, 0.57, 0.004), boxG(1.3, 0.012, 0.08, 0, 0.206, 0.7, 0.003)]), red, { cast: false }));
    const lamp = T.beehiveLamp({ lit: 0 });
    lamp.position.set(0, 0.0, 0); lamp.visible = false;
    truck.userData.lampMount.add(lamp);
    const ll = new THREE.PointLight('#ffd890', 9, 11, 1.4); ll.position.copy(truck.userData.lampPos); truck.add(ll);
    rig.add('lamp', ll);
    rig.hook('lamp', (k) => { truck.userData.setLamp(k, true); lamp.userData.setLit(k, true); });
    const glint = P.sparkles({ box: [0.5, 0.45, 0.5], center: [0, truck.userData.lampPos.y, 0], count: 14, size: 0.06, color: '#fff2c0', color2: '#ffffff' });
    glint.visible = false; truck.add(glint);
    const hit = proxy(1.6, 3.5, 1.6); hit.position.set(0, 1.75, 0); truck.add(hit);
    const turnHit = proxy(0.26, 0.5, 0.26); turnHit.position.copy(truck.userData.turnHandle.position).add(v3(0, 0.25, 0)); truck.add(turnHit);
    const brakeHit = proxy(0.22, 0.14, 0.26); brakeHit.position.copy(truck.userData.brake.position).add(v3(0, 0.02, 0.08)); truck.add(brakeHit);
    // a top-only hit (the platform deck seen from above) for dragging in the top-down view
    const deckHit = proxy(1.55, 0.3, 1.55); deckHit.position.set(0, 0.25, 0); truck.add(deckHit);
    const pose = { x: TRUCK_PARK.x, z: TRUCK_PARK.z, r: TRUCK_PARK.r };
    const apply = () => { truck.position.set(pose.x, 0, pose.z); truck.rotation.y = -pose.r * Math.PI / 2; };
    apply();
    let placed = false, brake = false;
    H.truck = {
      object: truck, hit, turnHit, brakeHit, deckHit, lamp, glintFx: glint,
      /** Position on the floor (x, z) and quarter turns r clockwise from above (0 = door downstage, 3 = door to prompt). */
      setPose: (x, z, r = pose.r) => { pose.x = x; pose.z = z; pose.r = ((r % 4) + 4) % 4; apply(); },
      get pose() { return { ...pose }; },
      /** Fractional yaw for an animated quarter turn: r may be non-integer while turning. */
      setTurn: (rf) => { truck.rotation.y = -rf * Math.PI / 2; },
      setBrake: (b) => { brake = !!b; truck.userData.setBrake(brake); },
      get brake() { return brake; },
      /** The brass lamp with its glass beehive in the lantern room (Wardrobe's lamp, placed after `lighthouse`). */
      setLampPlaced: (b) => { placed = !!b; lamp.visible = placed; },
      get lampPlaced() { return placed; },
      /** The lamp's glow: the lamp channel of the rig (the beehive, the lantern core, the PointLight). */
      setLampLit: (k, dur = 0) => rig.fade('lamp', k, dur),
      setBeam: (on, speed) => truck.userData.setBeam(on, speed),
      /** A glint in the empty lantern room (the solve), or on the placed lamp. */
      glint: (on = true) => { glint.visible = !!on; },
      park: { ...TRUCK_PARK },
      /** The top-down view from the fly gallery, framed like the prompt book's page-5 ground plan. */
      focus: F([-1.7, 7.8, 0.2], [-1.7, 0, -0.5], 62),
      clickFocus: F([-3.6, 2.4, 0.8], [-6.0, 1.4, -2.9], 55),
    };
  }
  // the lantern room and the door: Lavinia's finale marks
  H.perches.laviniaFinale = { position: [SPIKES.blue[0] + 1.05, 0, SPIKES.blue[1] + 0.15], rotationY: 1.09, pose: 'stand', costume: 'cloaked' };
  H.perches.laviniaLantern = { position: [SPIKES.blue[0], 2.53, SPIKES.blue[1]], rotationY: 1.09, pose: 'stand' };
  H.perches.ghostWing = { position: GHOST_WING.slice() };
  H.perches.finaleVantage = FINALE_VANTAGE;

  // ---------------------------------------------------------------------------------------------------------------
  // SHOW LIGHTING: battens, floats, limes (with a visible beam), blues, the house, the thunder flash, the ambient
  // ---------------------------------------------------------------------------------------------------------------
  {
    const hemi = new THREE.HemisphereLight('#8a9cc0', '#1c1612', 1.6); G.add(hemi); rig.add('ambient', hemi);
    const bat = new THREE.SpotLight('#ffd6a0', 60, 18, 1.0, 1.0, 1.2); bat.position.set(0, 8.4, 1.2); bat.target.position.set(0, 0, -2.4); G.add(bat, bat.target); rig.add('battens', bat);
    const fl = new THREE.PointLight('#ffc890', 14, 9, 1.4); fl.position.set(0, 0.3, 4.9); G.add(fl); rig.add('floats', fl);
    const limeFrom = v3(-4.6, 8.6, 14.2), limeTo = v3(-1.45, 0, -2.45);
    const lime = new THREE.SpotLight('#f4f6ff', 380, 26, 0.13, 0.45, 1.25);
    lime.position.copy(limeFrom); lime.target.position.copy(limeTo);
    lime.castShadow = true; lime.shadow.mapSize.set(1024, 1024); lime.shadow.bias = -0.0012; lime.shadow.normalBias = 0.03; lime.shadow.camera.near = 8; lime.shadow.camera.far = 24;
    G.add(lime, lime.target); rig.add('limes', lime);
    const len = limeFrom.distanceTo(limeTo);
    const beam = T.beamCone(len, len * Math.tan(0.13) * 1.05, '#e8eeff', 0);
    beam.position.copy(limeFrom); beam.quaternion.setFromUnitVectors(v3(0, -1, 0), limeTo.clone().sub(limeFrom).normalize());
    G.add(beam);
    rig.hook('limes', (k) => { beam.userData.setOpacity(0.07 * k); beam.visible = k > 0.01; });
    const limeDust = P.dustMotes({ box: [2.4, 3.2, 2.4], center: [limeTo.x + 0.3, 1.6, limeTo.z + 0.4], count: 140, color: '#dfe6ff', size: 0.018, opacity: 0.55 });
    G.add(limeDust); rig.hook('limes', (k) => { limeDust.visible = k > 0.1; });
    const blue = new THREE.SpotLight('#2f52ff', 140, 26, 0.85, 0.9, 1.05); blue.position.set(2.0, 11, 3.4); blue.target.position.set(-0.6, 0, -3.2); G.add(blue, blue.target); rig.add('blues', blue);
    const hl = new THREE.PointLight('#ffc070', 60, 24, 1.15); hl.position.set(0, 8.5, 12); G.add(hl); rig.add('house', hl);
    const flash = new THREE.PointLight('#e8f0ff', 900, 40, 1); flash.position.set(0, 10, 5); G.add(flash); rig.add('flash', flash);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // STORM (finale): rain streaks across the light, the flash, the cloth's sea shimmer and billow
  // ---------------------------------------------------------------------------------------------------------------
  {
    const rain = S.rainCurtain({ w: 11, h: 8, map: T.rainStreakTexture({ density: 1.2 }) });
    rain.position.set(0, 0, -1.9); G.add(rain);
    const rain2 = S.rainCurtain({ w: 11, h: 8, map: T.rainStreakTexture({ density: 0.8, seed: 7 }) });
    rain2.position.set(0, 0, 1.4); G.add(rain2);
    H.storm = {
      rain: [rain, rain2],
      setRain: (k, instant) => { rain.userData.setLevel(k, instant); rain2.userData.setLevel(k * 0.7, instant); },
      flash: () => rig.flash(0.15),
      setSea: (k) => { cloth.userData.setShimmer(k); cloth.userData.setRipple(0.012 + 0.05 * k); },
    };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // a few hanging things, the scatter of a working stage
  // ---------------------------------------------------------------------------------------------------------------
  {
    const bits = [];
    // tape scraps and old spike marks, gaffer on the floor (white and grey only: the colours belong to the spikes)
    for (let i = 0; i < 14; i++) { const x = (r() - 0.5) * 12, z = -5 + r() * 8.5; if (Math.hypot(x - SPIKES.blue[0], z - SPIKES.blue[1]) < 1.3 || Math.abs(z + 2.6) < 1.0) continue; bits.push(boxG(0.12 + r() * 0.12, 0.002, 0.04, x, 0.002, z, 0.001).rotateY(r() * TAU)); }
    G.add(mergeInto(bits, M.matte('#b8b2a4', { roughness: 0.6 }), { cast: false }));
    // ropes hanging down the SR wall from the grid (spare lines, tied off)
    const rp = [];
    for (let i = 0; i < 5; i++) { const z = -5.6 + i * 0.3; rp.push(tubeG([[STAGE.x0 + 0.25, STAGE.flyH - 0.5, z], [STAGE.x0 + 0.3 + r() * 0.1, 7, z + 0.1], [STAGE.x0 + 0.28, 1.4, z + 0.05]], 0.011, { radial: 5, seg: 12 })); }
    G.add(mergeInto(rp, T.ropeMat('#8a7a58'), { cast: false }));
  }

  // fresh-state visuals
  // shadow casters: only what stands in the ghost light's pool or the lime (the shadow passes are the triangle budget)
  const casters = [ghostGroup, truck, trap, flats];
  G.traverse((o) => {
    if (!o.isMesh || !o.castShadow) return;
    let n = o, ok = false;
    while (n && n !== G) { if (casters.includes(n)) { ok = true; break; } n = n.parent; }
    o.castShadow = ok;
  });
  rig.setState('dark');
  H.shimmer.setLevel(1, true);
  H.dips.setGlow(1);
  return H;
}

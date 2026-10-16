// The Orchestra Pit & Under-stage (SET-pit). buildSet(ctx, group) builds the whole room and returns `handles`: every
// puzzle object and delight with its animation hooks and its focus framing, proxies for small things, perches, doors.
// Coordinates: the pit runs along Z (x −1.7…1.7, z −8…6.8; the stalls are at −X, the stage front wall at x 1.7 with the
// arch into the trap room at +X). The vantage is at the stair foot near z 5.4 looking along −Z. Notes:
// docs/notes/set-pit.md.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as Lt from '../../engine/props/lights.js';
import * as P from '../../engine/props/particles.js';
import * as T from '../../engine/props/theatre.js';
import { mesh, noRay, grp, at, boxG, cylG, mergeG, mergeInto, tubeG, instances, halo, chase } from '../../engine/props/theatre/common.js';
import { brickTexture, scuffedFloorTexture } from '../../engine/props/theatre-textures.js';
import * as X from './props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tile = (tex, rx, ry) => { const t = tex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true; return t; };
const arr = (v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
/** A focus framing from an object's local space: { position, lookAt } in room (world) coordinates. */
function frame(obj, pos, look, extra = {}) {
  obj.updateMatrixWorld(true);
  return { position: arr(obj.localToWorld(V(...pos))), lookAt: arr(obj.localToWorld(V(...look))), ...extra };
}

/** Dial-band → audio windMachine speed: piecewise-linear between the band centres (docs/notes/audio.md bands). */
const BAND_AUDIO = [[0, 0.06], [0.0625, 0.1], [0.198, 0.3], [0.354, 0.45], [0.531, 0.65], [0.719, 0.8], [0.906, 1], [1, 1]];
export function windAudioSpeed(v) {
  v = Math.max(0, Math.min(1, v));
  for (let i = 1; i < BAND_AUDIO.length; i++) { const [a, fa] = BAND_AUDIO[i - 1], [b, fb] = BAND_AUDIO[i]; if (v <= b) return fa + (fb - fa) * (v - a) / (b - a || 1); }
  return 1;
}

export function buildSet(ctx, group) {
  const G = group;
  const H = { perches: {}, doors: {}, lights: {} };

  // =====================================================================================================
  // ARCHITECTURE
  // =====================================================================================================
  const brickTex = brickTexture({ tint: '#6e3426', mortar: '#3e342c', soot: 0.55, seed: 44 });
  const brick = new THREE.MeshStandardMaterial({ map: tile(brickTex, 1 / 0.9, 1 / 0.9), roughness: 0.92 });
  const brickDark = new THREE.MeshStandardMaterial({ map: tile(brickTexture({ tint: '#4e2a22', mortar: '#2e2620', soot: 0.7, seed: 45 }), 1 / 0.9, 1 / 0.9), roughness: 0.95 });
  const floorTex = scuffedFloorTexture({ tint: '#2e2822', planks: 8, scuffs: 0.6, paint: 0.15, tape: [], seed: 61 });
  const pitFloor = mesh(new THREE.PlaneGeometry(14.8, 3.4).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ map: tile(floorTex, 6, 2.8), roughness: 0.85 }), { cast: false });
  pitFloor.position.set(0, 0, -0.6); G.add(pitFloor);
  // left: the pit wall (painted black boards) with a coping, the brass rail and its curtain on top
  const wallBoards = M.wood({ tint: '#221a14', planks: 5, seed: 23, roughness: 0.8, repeat: [6, 1] });
  G.add(at(mesh(boxG(0.2, 0.8, 14.8, 0, 0.4, 0, 0.004), wallBoards), -1.8, 0, -0.6));
  G.add(at(mesh(boxG(0.34, 0.05, 14.8, 0, 0.025, 0, 0.01), M.walnut({ tint: '#2a1a10' })), -1.83, 0.8, -0.6));
  const rail = T.pitRail({ w: 14.6, h: 0.95, spacing: 1.62, curtain: true, color: '#5a1a1e' });
  rail.rotation.y = Math.PI / 2; rail.position.set(-1.78, 0.825, -0.6); G.add(rail);
  // the stalls beyond: dark carpet, five raked rows, a dress-circle front far off, an EXIT sign
  G.add(at(mesh(new THREE.PlaneGeometry(14, 20).rotateX(-Math.PI / 2), M.matte('#1e1012', { roughness: 0.95 }), { cast: false }), -8.9, 0.8, -0.6));
  const stalls = T.makeRows({ rows: 2, perRow: 7, spacing: 0.53, rowGap: 0.95, rake: 0.16, curve: 0, aisles: [3], gap: 1.0, tipped: 0.85, seed: 7 });
  stalls.rotation.y = Math.PI / 2; stalls.position.set(-2.55, 0.8, 1.6); G.add(stalls); H.stalls = stalls;
  const circle = grp('dressCircle');
  circle.add(mesh(boxG(0.25, 0.9, 18, 0, 0, 0, 0.02), M.wornPlaster({ tint: '#7a6a58' })));
  circle.add(mesh(boxG(0.3, 0.12, 18.2, 0.03, 0.42, 0, 0.01), M.gilt()));
  circle.add(mesh(boxG(0.3, 0.08, 18.2, 0.03, -0.44, 0, 0.01), M.gilt()));
  circle.position.set(-10.2, 3.9, -0.6); G.add(circle);
  const exit = T.exitSign({ lit: 0.55 }); exit.rotation.y = Math.PI / 2; exit.position.set(-9.9, 2.6, -6.5); G.add(exit);
  // right: the stage-front wall with the low arch into the trap room
  const archZ0 = -3.8, archZ1 = 1.9, wallX = 1.88;
  const wall = X.archWall({ z0: -8.0, z1: 6.8, h: 2.97, t: 0.36, az0: archZ0, az1: archZ1, spring: 1.78, crown: 2.32, material: brick });
  wall.position.x = wallX; G.add(wall);
  // a brick soffit inside the arch (so the reveal reads) and a painted iron lintel strap
  G.add(at(mesh(boxG(0.38, 0.06, archZ1 - archZ0 + 0.1, 0, 0, 0, 0.004), M.ironBlack()), wallX, 2.36, (archZ0 + archZ1) / 2));
  // end walls of the pit (only as wide as the pit; above the stalls side it is open to the dark house)
  G.add(at(mesh(new THREE.PlaneGeometry(3.6, 2.97), brickDark), 0, 1.485, 6.8));
  G.children[G.children.length - 1].rotation.y = Math.PI;
  G.add(at(mesh(new THREE.PlaneGeometry(3.6, 2.97), brickDark), 0, 1.485, -8.0));
  // the apron underside over the right two-thirds of the pit: boards, joists, a black fascia; the stair hatch
  const ceilBoards = M.wood({ tint: '#3a2c20', planks: 8, seed: 31, roughness: 0.85, repeat: [3, 1] });
  const apronX0 = -0.55, hatchZ0 = 4.7;
  const ceil1 = mesh(new THREE.PlaneGeometry(1.7 - apronX0, hatchZ0 + 8.0).rotateX(Math.PI / 2), ceilBoards, { cast: false });
  ceil1.position.set((apronX0 + 1.7) / 2, 2.97, (hatchZ0 - 8.0) / 2); G.add(ceil1);
  const ceil2 = mesh(new THREE.PlaneGeometry(0.85 - apronX0, 6.8 - hatchZ0).rotateX(Math.PI / 2), ceilBoards, { cast: false });
  ceil2.position.set((apronX0 + 0.85) / 2, 2.97, (hatchZ0 + 6.8) / 2); G.add(ceil2);
  const joists = [];
  for (let z = -7.7; z < 6.8; z += 0.62) { const x1 = z > hatchZ0 && z < 6.8 ? 0.85 : 1.7; joists.push(boxG(x1 - apronX0, 0.2, 0.075, (apronX0 + x1) / 2, 2.86, z, 0.004)); }
  joists.push(boxG(0.1, 0.2, 2.2, 0.85, 2.86, (hatchZ0 + 6.8) / 2, 0.004)); // hatch trimmer
  G.add(mergeInto(joists, M.dustyWood({ tint: '#6a5038' })));
  G.add(at(mesh(boxG(0.06, 0.45, 14.8, 0, 0, 0, 0.004), M.matte('#0e0c0a', { roughness: 0.7 })), apronX0 - 0.03, 2.8, -0.6));
  // light spilling down the hatch from the stage
  const spill = mesh(new THREE.PlaneGeometry(1.2, 2.4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#6a5034' }), { cast: false, receive: false });
  spill.position.set(1.28, 3.5, 5.75); G.add(noRay(spill));
  // the steep stair up to the stage
  const stair = X.pitStair({ h: 2.97, run: 1.95, w: 0.74, steps: 13 });
  stair.position.set(1.28, 0, 4.78); G.add(stair);
  // POLISH: a slab along the flight (treads, stringers and the rail) instead of its bounding box, which took in the
  // brick wall above the stair
  const stairAng = Math.atan2(2.97, 1.95);
  const stairProxy = X.proxy(0.95, 1.0, Math.hypot(2.97, 1.95) + 0.2); stairProxy.rotation.x = -stairAng;
  stairProxy.position.set(1.24, 1.485 + 0.3 * Math.cos(stairAng), 4.78 + 0.975 - 0.3 * Math.sin(stairAng)); G.add(stairProxy);
  H.doors.stairs = { object: stairProxy, stair, hatch: ceil2, highlight: stair };
  // pipes along the far wall and the apron edge: a little plumbing to drip
  G.add(mergeInto([cylG(0.03, 0.03, 14.6, 10).rotateX(Math.PI / 2).translate(1.6, 2.62, -0.6), cylG(0.02, 0.02, 3.3, 8).rotateZ(Math.PI / 2).translate(0, 2.4, -7.9), cylG(0.02, 0.02, 2.4, 8, -1.55, 1.2, -7.92)], M.iron({ color: '#3a3a36', roughness: 0.6 })));

  // trap room: x 2.06…5.6, z −4.6…2.4, boards overhead at 2.97 with joists along X
  const TX0 = wallX + 0.18, TX1 = 5.6, TZ0 = -4.6, TZ1 = 2.4;
  const trapFloor = mesh(new THREE.PlaneGeometry(TX1 - TX0, TZ1 - TZ0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tile(scuffedFloorTexture({ tint: '#2a2622', planks: 6, scuffs: 0.9, paint: 0.3, tape: ['#e8e4d8'], seed: 62 }), 3, 6), roughness: 0.9 }), { cast: false });
  trapFloor.position.set((TX0 + TX1) / 2, 0.002, (TZ0 + TZ1) / 2); G.add(trapFloor);
  G.add(at(mesh(new THREE.PlaneGeometry(TZ1 - TZ0, 2.97), brickDark), TX1, 1.485, (TZ0 + TZ1) / 2, 0, -Math.PI / 2, 0));
  G.add(at(mesh(new THREE.PlaneGeometry(TX1 - TX0, 2.97), brickDark), (TX0 + TX1) / 2, 1.485, TZ0, 0, 0, 0));
  G.add(at(mesh(new THREE.PlaneGeometry(TX1 - TX0, 2.97), brickDark), (TX0 + TX1) / 2, 1.485, TZ1, 0, Math.PI, 0));
  // the trap opening in the boards at (3.0, −3.7), 0.8 square
  const trapC = V(3.05, 2.97, -3.75), tw = 0.8;
  const ceilRects = [[TX0, TX1, trapC.z + tw / 2, TZ1], [TX0, TX1, TZ0, trapC.z - tw / 2], [TX0, trapC.x - tw / 2, trapC.z - tw / 2, trapC.z + tw / 2], [trapC.x + tw / 2, TX1, trapC.z - tw / 2, trapC.z + tw / 2]];
  const stageBoards = M.wood({ tint: '#3a2e22', planks: 8, seed: 33, roughness: 0.85 });
  ceilRects.forEach(([x0, x1, z0, z1]) => G.add(at(mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2), stageBoards, { cast: false }), (x0 + x1) / 2, 2.97, (z0 + z1) / 2)));
  const tj = [];
  for (let z = TZ0 + 0.3; z < TZ1; z += 0.58) if (Math.abs(z - trapC.z) > tw / 2 + 0.05) tj.push(boxG(TX1 - TX0, 0.24, 0.08, (TX0 + TX1) / 2, 2.85, z, 0.004));
  tj.push(boxG(0.22, 0.32, TZ1 - TZ0, 5.25, 2.81, (TZ0 + TZ1) / 2, 0.006)); // a heavy beam along Z
  tj.push(boxG(0.14, 2.65, 0.14, 5.25, 1.325, -3.7, 0.008)); // a prop post under the beam
  G.add(mergeInto(tj, M.dustyWood({ tint: '#6a5038' })));

  // =====================================================================================================
  // LIGHTING
  // =====================================================================================================
  G.add(Lt.ambientRig({ sky: '#c8b8a0', ground: '#1a1210', hemi: 0.22, ambient: '#2a2220', ambientIntensity: 0.18 }));
  // bulkhead A, beside the arch near end: the pit's key light (shadow light 1)
  const bulkA = T.bulkheadLight({ lit: 1, color: '#f4e8cc' }); bulkA.rotation.y = -Math.PI / 2; bulkA.position.set(1.69, 2.38, 2.45); G.add(bulkA);
  const keyA = Lt.keyLight({ color: '#ffe6c0', intensity: 9, position: [1.45, 2.36, 2.45], target: [-0.5, 0.0, -1.6], angle: 0.85, penumbra: 0.75, distance: 13, decay: 1.4, mapSize: 1024 });
  G.add(keyA); H.lights.keyA = keyA.userData.light;
  // bulkhead B, far end of the pit (no shadow)
  const bulkB = T.bulkheadLight({ lit: 1, color: '#f4e8cc' }); bulkB.rotation.y = -Math.PI / 2; bulkB.position.set(1.69, 2.3, -5.6); G.add(bulkB);
  const ptB = new THREE.PointLight('#ffdcae', 4.5, 8, 1.6); ptB.position.set(1.45, 2.25, -5.6); G.add(ptB); H.lights.bulkB = ptB;
  // near fill (the hatch spill) and a cool low bounce off the stalls
  const ptHatch = new THREE.PointLight('#ffcf98', 2.2, 5.5, 1.6); ptHatch.position.set(1.2, 2.75, 5.9); G.add(ptHatch);
  const ptStalls = new THREE.PointLight('#8a9ac8', 1.4, 9, 1.6); ptStalls.position.set(-4.5, 2.6, 0.5); G.add(ptStalls);
  // trap room: a bare bulb on a flex (shadow light 2)
  const bulbPos = V(3.7, 2.45, -0.85);
  G.add(mesh(cylG(0.004, 0.004, 2.97 - bulbPos.y - 0.04, 5, bulbPos.x, (2.97 + bulbPos.y) / 2 + 0.02, bulbPos.z), M.matte('#1a1410')));
  G.add(at(mesh(cylG(0.018, 0.018, 0.05, 10), M.bakelite()), bulbPos.x, bulbPos.y + 0.05, bulbPos.z));
  const bulb = T.bulbSet([[0, 0, 0]], { r: 0.03, shape: 'pear', color: '#ffd8a0', intensity: 2.6, lit: 1 }); bulb.position.copy(bulbPos).add(V(0, 0.03, 0)); G.add(bulb);
  const bh = halo('#ffd8a0', 0.6, 0.45); bh.position.copy(bulbPos); G.add(bh);
  const keyT = Lt.keyLight({ color: '#ffd6a0', intensity: 7.5, position: [bulbPos.x, bulbPos.y - 0.05, bulbPos.z], target: [3.7, 0, -1.5], angle: 0.95, penumbra: 0.8, distance: 10, decay: 1.4, mapSize: 1024 });
  G.add(keyT); H.lights.keyT = keyT.userData.light;
  // the lightning light (cold, off until a flash)
  const ltn = new THREE.PointLight('#cfe0ff', 0, 11, 1.4); ltn.position.set(4.2, 1.5, 0.3); G.add(ltn); H.lights.lightning = ltn;

  // dust in the beams
  G.add(P.dustMotes({ box: [3, 2.2, 5], center: [0.2, 1.4, 1.2], count: 260, color: '#ffe6c0', size: 0.016, opacity: 0.4 }));
  G.add(P.dustMotes({ box: [2.4, 2.2, 3], center: [3.7, 1.3, -1.2], count: 140, color: '#ffe0b0', size: 0.016, opacity: 0.35 }));
  G.add(Lt.lightShaft({ from: [1.5, 2.36, 2.45], to: [0.2, 0.0, 0.6], radiusTop: 0.08, radiusBottom: 1.1, color: '#ffe2b8', opacity: 0.06, square: false }));
  G.add(Lt.lightShaft({ from: [bulbPos.x, bulbPos.y, bulbPos.z], to: [3.6, 0, -1.4], radiusTop: 0.06, radiusBottom: 1.0, color: '#ffd8a0', opacity: 0.07, square: false }));

  // =====================================================================================================
  // THE PIANOLA (+ tuning bay, PLAY lever, keys, spool box) and the ROLL RACK
  // =====================================================================================================
  const piano = T.playerPiano({ lidOpen: 0, frontOpen: 0, fallboardOpen: 1 });
  piano.position.set(1.0, 0, 3.35); piano.rotation.y = -1.05; piano.userData.keep = true; G.add(piano);
  const pf = X.fitPianola(piano);
  H.pianola = Object.assign(pf, {
    group: piano,
    /** Puff of dust off the keys (the solve moment). */
    dustPuff: () => { piano.updateMatrixWorld(true); P.burst(ctx, G, arr(piano.localToWorld(V(0, 0.8, 0.28))), { color: '#d8c8a8', color2: '#8a7a64', count: 70, radius: 0.5, duration: 1.6, size: 0.02 }); },
  });
  H.pianola.focus = frame(piano, [-0.05, 1.18, 1.3], [-0.05, 0.98, 0.05]);
  H.pianola.focusSpool = frame(piano, [0, 1.15, 0.72], [0, 1.06, 0.0]);
  H.tuning = Object.assign(Object.create(pf), { focus: frame(pf.bay, [0.06, 0.33, 0.02], [0.06, 0.0, 0.1], { fov: 50 }) });

  const rack = X.rollRack();
  rack.position.set(0.3, 0, 2.3); rack.rotation.y = -0.38; G.add(rack);
  H.rolls = {
    group: rack, boxes: rack.userData.boxes, lectern: rack.userData.lectern, leader: rack.userData.leader,
    show: rack.userData.show, setUnroll: rack.userData.setUnroll, slide: rack.userData.slide,
    /** A roll's box hidden (it is in the spool box) or back in its hole. */
    setInRack: (num, b) => { const bx = rack.userData.boxes[num]; if (bx) bx.visible = !!b; },
    ROLLS: X.ROLLS, NUMBERS: X.ROLL_NUMBERS,
    focus: frame(rack.userData.lectern, [0, 0.2, 0.47], [0, 0.19, 0]),
    focusRack: frame(rack, [0, 0.62, 0.95], [0, 0.48, 0]),
  };

  // =====================================================================================================
  // THE BAND: dust-sheeted instruments 1–5, chairs and stands, the conductor's stand
  // =====================================================================================================
  // POLISH: each sheet's label names the shape under it (all five were 'Dust sheet')
  const sheetDefs = [
    { name: 'harp', label: 'Tall dust sheet', z: 1.35, x: 0.62, ry: 0.3, sheet: { shape: 'cone', w: 0.8, d: 0.6, h: 1.88, color: '#c9a29a', seed: 11, segA: 40, segS: 16 }, make: X.harp },
    { name: 'tuba', label: 'Lumpy dust sheet', z: -0.25, x: 0.6, ry: -0.4, sheet: { shape: 'lump', w: 0.82, d: 0.74, h: 1.3, color: '#bf938c', seed: 12, segA: 34, segS: 14 }, make: X.tuba },
    { name: 'cello', label: 'Narrow dust sheet', z: -1.75, x: 0.62, ry: 0.5, sheet: { shape: 'tall', w: 0.58, d: 0.5, h: 1.34, color: '#c79e96', seed: 13, segA: 28, segS: 12 }, make: X.cello },
    { name: 'drums', label: 'Wide dust sheet', z: -3.35, x: 0.55, ry: -0.5, sheet: { shape: 'low', w: 1.5, d: 1.05, h: 1.08, color: '#b88a84', seed: 14, segA: 28, segS: 12 }, make: X.drumKit },
    { name: 'trombone', label: 'Long dust sheet', z: -5.05, x: 0.6, ry: 0.15, sheet: { shape: 'box', w: 1.3, d: 0.36, h: 1.1, color: '#c49a92', seed: 15, segA: 28, segS: 12 }, make: X.trombone },
  ];
  H.sheets = []; H.instruments = {};
  sheetDefs.forEach((d, i) => {
    const inst = d.make(); inst.position.set(d.x, 0, d.z); inst.rotation.y = d.ry; G.add(inst);
    const sh = X.slidingSheet(d.sheet, { dir: Math.PI / 2 - d.ry + (i % 2 ? 0.25 : -0.2), dist: 0.62 });
    sh.position.set(d.x, 0, d.z); sh.rotation.y = d.ry; sh.userData.keep = true; G.add(sh);
    // the instrument is hidden while sheeted (saves draws, and nothing pokes through the cloth)
    const setOff0 = sh.userData.setOff;
    // a sheet that is off lies as a low heap: it stops casting (saves its shadow pass with the instrument showing)
    sh.userData.setOff = (v, instant) => { inst.visible = v > 0; sh.traverse((o) => { if (!o.isMesh) return; o.userData.cast0 ??= o.castShadow; o.castShadow = o.userData.cast0 && v < 1; }); setOff0(v, instant); };
    inst.visible = false;
    const entry = { n: i + 1, name: d.name, label: d.label, group: sh, instrument: inst, setOff: sh.userData.setOff, isOff: sh.userData.isOff, focus: frame(inst, [0, 1.3, 1.6], [0, 0.7, 0]) };
    H.sheets.push(entry); H.instruments[d.name] = inst;
  });
  // the drum kit's beater, on the bass drum until taken; it hangs on a hook by the thunder sheet after `thunder`
  const kit = H.instruments.drums;
  const mal = X.mallet(); G.add(mal);
  const malProxy = X.proxy(0.68, 0.34, 0.36); mal.add(malProxy); malProxy.position.x = 0.0; // POLISH: was 0.46×0.14×0.14 (~34×11 px at the vantage); the drum hotspot is off while the beater lies here
  H.mallet = { group: mal, proxy: malProxy };
  H.drums = { group: kit, snareTap: kit.userData.snareTap, crash: kit.userData.crash, beat: kit.userData.bass.userData.beat, focus: frame(kit, [0.2, 1.45, 1.25], [0, 0.75, 0]) };

  // chairs and stands: two staggered columns facing the conductor, half-turned to the stage
  const chairPos = [];
  for (let i = 0; i < 7; i++) chairPos.push([-1.22, 2.55 - i * 1.32, Math.PI - 0.32]);
  for (let i = 0; i < 7; i++) chairPos.push([-0.5, 1.9 - i * 1.32, Math.PI - 0.22]);
  const chairs = T.bandChairs({ positions: chairPos, stands: true, seed: 5 });
  G.add(chairs); H.chairs = { group: chairs };

  const cond = T.conductorStand({ lamp: true, baton: true, lit: 1 });
  cond.position.set(0.05, 0, -6.95); cond.rotation.y = -1.22; cond.userData.keep = true; G.add(cond);
  // (ENGINE-FIX: qa-pit's desk lift moved into T.conductorStand.)
  const [sL, sR] = X.scoreTextures(); cond.userData.setScore(sL, sR);
  // POLISH: the lamp's light sat 25 cm off the right page, which blew the page (and the baton) out in the desk close-up
  // and left the left page dim. Set higher and further out it lights the open score evenly, a little less hot.
  const lampPt = new THREE.PointLight('#e8f0b0', 1.25, 3.2, 1.8); cond.userData.desk.add(lampPt); lampPt.position.set(0.1, 0.44, 0.46);
  const plan = mesh(new THREE.PlaneGeometry(0.17, 0.1275), new THREE.MeshStandardMaterial({ map: X.bandPlanTexture(), roughness: 0.9, side: THREE.DoubleSide }), { cast: false });
  // FIXED BY qa-pit: it was pinned low on the pedestal's side, out of the desk close-up and hidden behind the band from
  // the vantage (unreachable); now tucked under the score's corner, jutting off the desk's right edge, in the close-up
  plan.position.set(0.37, -0.075, 0.017); plan.rotation.set(0, 0, -0.1); cond.userData.desk.add(plan);
  G.add(at(mesh(cylG(0.004, 0.004, 0.01, 6).rotateZ(Math.PI / 2), M.brass()), 0, 0, 0)); // (pin, placed below)
  const pin = G.children[G.children.length - 1]; cond.userData.desk.add(pin); pin.position.set(0.3, -0.02, 0.02); pin.rotation.set(0, Math.PI / 2, 0);
  const batonProxy = X.proxy(0.42, 0.06, 0.08); cond.userData.desk.add(batonProxy); batonProxy.position.set(0.05, -0.205, 0.05);
  const scoreProxy = X.proxy(0.52, 0.34, 0.03); cond.userData.desk.add(scoreProxy); scoreProxy.position.set(0, 0, 0.03);
  const planProxy = X.proxy(0.19, 0.145, 0.03); cond.userData.desk.add(planProxy); planProxy.position.copy(plan.position); planProxy.rotation.copy(plan.rotation);
  H.conductor = {
    group: cond, setLit: cond.userData.setLit, baton: cond.userData.baton, batonProxy, score: cond.userData.score, scoreProxy, bandplan: plan, bandplanProxy: planProxy, lamp: lampPt,
    /** The baton lifts and taps the desk twice. */
    tapBaton: () => {
      const b = cond.userData.baton; if (!b) return;
      const y0 = -0.205, z0 = 0.05;
      ctx.tween.run(0.7, (k) => { const s = Math.sin(k * Math.PI * 2); b.position.set(0.05, y0 + Math.max(0, s) * 0.03, z0 + Math.max(0, s) * 0.02); b.rotation.z = Math.max(0, s) * 0.25; });
    },
    focus: frame(cond.userData.desk, [0, 0.05, 0.75], [0, 0, 0]),
    focusPlan: frame(cond, [0.5, 0.86, -0.25], [0.05, 0.82, -0.28]),
  };

  // drip into a galvanised bucket under the apron edge
  const bucket = T.bucket({ style: 'galvanised', fill: 'water' }); bucket.position.set(-0.22, 0, 3.15); G.add(bucket);
  const dr = X.drip({ top: [-0.22, 2.74, 3.15], bottom: [-0.22, 0.25, 3.15], every: 2.8 }); G.add(dr);
  H.drip = dr;

  // =====================================================================================================
  // TRAP ROOM: thunder sheet + flash box, wind machine, rain drum + gear train + shelf, winch + trap
  // =====================================================================================================
  // thunder sheet from a joist, a timber post beside it with the beater's hook
  const thunder = T.thunderSheet({ chain: 0.3 });
  thunder.position.set(4.95, 2.73, -0.28); thunder.rotation.y = -1.08; thunder.userData.keep = true; G.add(thunder);
  const tpost = mergeInto([boxG(0.1, 2.73, 0.1, 0.78, -2.73 / 2, -0.05, 0.006)], M.dustyWood({ tint: '#7a5a3a' })); thunder.add(tpost);
  const hookPos = V(0.72, -1.25, -0.05);
  thunder.add(mesh(tubeG([[0.78, hookPos.y + 0.03, -0.05], [0.7, hookPos.y + 0.03, -0.05], [0.68, hookPos.y - 0.02, -0.05], [0.7, hookPos.y - 0.04, -0.05]], 0.005, { radial: 5 }), M.ironBlack()));
  const stencilProxy = X.proxy(0.9, 0.16, 0.04); thunder.add(stencilProxy); stencilProxy.position.set(0, -0.35 - 0.05 - 2 * 0.42 - 0.03, 0.03);
  // a warm bounce off the bulb's cone onto the sheet's face so the stencil reads (no shadow)
  const thunderFill = new THREE.PointLight('#ffcf98', 2.2, 2.8, 1.6); thunder.add(thunderFill); thunderFill.position.set(0.25, -0.9, 1.1);
  const sheetProxy = X.proxy(1.05, 2.05, 0.08); thunder.add(sheetProxy); sheetProxy.position.set(0, -0.35 - 0.05 - 1.0, 0);
  H.thunder = {
    group: thunder, sheet: thunder.userData.sheet, proxy: sheetProxy, stencilProxy,
    shake: thunder.userData.shake,
    /** The big one: a long roll (the sheet ripples and swings) + the flash box. */
    boom: () => { thunder.userData.shake(1.2); H.flash?.lightning(); },
    /** A crack: a short hard shake. */
    crack: () => { thunder.userData.shake(0.6); },
    /** Without the beater: a tin "tink". */
    tink: () => { thunder.userData.shake(0.06); },
    hook: hookPos,
    focus: frame(thunder, [0.05, -1.2, 1.85], [0.05, -1.3, 0], { fov: 55 }),
  };
  // where the mallet lives: on the bass drum / on the hook / gone (in the inventory)
  H.mallet.setPlace = (where) => {
    if (where === 'hook') { thunder.add(mal); mal.position.set(0.7, hookPos.y - 0.21, -0.03); mal.rotation.set(0, 0, Math.PI / 2 + 0.05); mal.visible = true; }
    else if (where === 'drum') { kit.add(mal); const s = kit.userData.malletSeat; mal.position.set(s.x - 0.02, s.y + 0.045, s.z + 0.02); mal.rotation.set(0, 0.5, 0.0); mal.visible = true; }
    else { mal.visible = false; }
    H.mallet.place = where;
  };
  H.mallet.setPlace('drum');

  // flash box on a crate by the sheet
  const crate = T.crate({ w: 0.6, h: 0.45, d: 0.42, stencil: 'FX\nLIGHTNING', seed: 3 }); crate.position.set(4.5, 0, 0.8); crate.rotation.y = -1.25; G.add(crate);
  const flash = T.flashBox(); flash.position.set(4.5, 0.45, 0.82); flash.rotation.y = -1.34; flash.userData.keep = true; G.add(flash);
  let ltnT = -1;
  const seq = [[0, 1], [0.06, 0.15], [0.12, 0.9], [0.18, 0.3], [0.26, 1], [0.55, 0]];
  H.flash = {
    group: flash, glass: flash.userData.glass, setLit: flash.userData.setLit,
    /** The flash box fires and the trap room whites out for half a second. */
    lightning: () => { flash.userData.flash(); ltnT = 0; },
    flash: () => { flash.userData.flash(); ltnT = 0; },
    update: (dt) => {
      if (ltnT < 0) return; ltnT += dt;
      let v = 0; for (let i = 0; i < seq.length - 1; i++) if (ltnT >= seq[i][0] && ltnT < seq[i + 1][0]) v = seq[i][1];
      ltn.intensity = 26 * v;
      if (ltnT > 0.6) { ltnT = -1; ltn.intensity = 0; }
    },
  };

  // wind machine, angled so its dial faces the arch; θ = −0.57
  const wind = T.windMachine({ chalk: 'GALE' });
  wind.position.set(4.3, 0, -1.95); wind.rotation.y = -0.64; wind.userData.keep = true; G.add(wind);
  const W = wind.userData;
  // FIXED BY integration-qa: the lever stood straight up in front of the dial, so its black arm and handle covered the
  // needle exactly when it was in GALE (straight up) and a player pulled it blind ("Not at that speed."). Dropped
  // 0.26 m down its post: the handle now ends at the dial's unpainted bottom edge and GALE reads clear.
  W.governor.position.y -= 0.26;
  // the chalk arrow from GALE runs off the dial's right edge to the governor lever: a chalk streak on the post
  const chalkMat = new THREE.MeshBasicMaterial({ color: '#e8e4d8', transparent: true, opacity: 0.7, depthWrite: false });
  const arrow = mesh(new THREE.PlaneGeometry(0.018, 0.2), chalkMat, { cast: false, receive: false });
  arrow.position.set(-0.36 + 0.02, 0.82 + 0.25, 0.302); arrow.rotation.z = 0.15; wind.add(noRay(arrow));
  // drum angle we own (so the crank can follow a drag): wraps the PROPS update
  let wAng = 0, wManual = null, wJit = 0;
  const wBase = W.update;
  const drumWorld = V();
  W.update = (dt, t) => {
    wBase(dt, t);
    if (wManual != null) { wAng = wManual; } else if (W.speed > 0.001) wAng -= dt * W.speed * 14;
    W.drum.rotation.x = wAng;
    if (wJit > 0) { wJit = Math.max(0, wJit - dt); wind.position.x = 4.3 + (Math.random() - 0.5) * 0.012 * wJit; wind.position.z = -1.95 + (Math.random() - 0.5) * 0.012 * wJit; }
  };
  const oil = mesh(new THREE.CircleGeometry(0.09, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0e0a06', roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.75, depthWrite: false }), { cast: false });
  oil.position.set(0.42, 0.004, 0.08); oil.visible = false; wind.add(noRay(oil));
  const crankHubLocal = V(0.42 + 0.21 - 0.05, 0.82, 0.0); // the crank arm swings round the axle at the +X end
  const crankProxy = X.proxy(0.16, 0.56, 0.56); crankProxy.position.copy(crankHubLocal).add(V(0.05, 0, 0)); wind.add(crankProxy);
  const govProxy = X.proxy(0.08, 0.42, 0.08); W.governor.add(govProxy); govProxy.position.set(0, 0.2, 0);
  const dialProxy = X.proxy(0.44, 0.44, 0.04); W.dial.add(dialProxy);
  const drumProxy = X.proxy(0.76, 0.66, 0.66); drumProxy.position.set(0, 0.82, 0); wind.add(drumProxy);
  const _pl = new THREE.Plane(), _hit = V(), _ax = V(), _hub = V(), _u = V(), _w = V();
  H.wind = {
    group: wind, drum: W.drum, needle: W.needle, governor: W.governor, pawl: W.pawl, dial: W.dial, bands: T.WIND_BANDS,
    crankProxy, governorProxy: govProxy, dialProxy, drumProxy,
    /** Drum speed 0..1 (= dial fraction; the needle chases it; the canvas ripples). */
    setSpeed: (v) => W.setSpeed(v),
    get speed() { return W.speed; },
    setGovernor: (b) => W.setGovernor(b),
    get governorOn() { return !!W.governorOn; },
    /** The drum (and crank) at an absolute angle, e.g. following a drag; null hands it back to the speed. */
    setCrankAngle: (a) => { wManual = a; },
    get crankAngle() { return wAng; },
    /** The crank hub in world space (project it to screen for a circular-drag mapping). */
    crankHubWorld: () => { wind.updateMatrixWorld(true); return wind.localToWorld(_hub.copy(crankHubLocal)); },
    /** Angle of a pointer ray on the crank's plane round the axle (rad), or null if it misses. */
    crankAngleFromRay: (ray) => {
      wind.updateMatrixWorld(true);
      wind.localToWorld(_hub.copy(crankHubLocal));
      _ax.set(1, 0, 0).transformDirection(wind.matrixWorld);
      _pl.setFromNormalAndCoplanarPoint(_ax, _hub);
      if (!ray.intersectPlane(_pl, _hit)) return null;
      _w.copy(_hit).sub(_hub);
      _u.set(0, 1, 0); const yv = _w.dot(_u); _u.set(0, 0, 1).transformDirection(wind.matrixWorld); const zv = _w.dot(_u);
      return Math.atan2(zv, yv);
    },
    setOiled: (b) => { oil.visible = !!b; },
    /** Rattle (DO NOT): the frame shakes for `sec`. */
    rattle: (sec = 1.2) => { wJit = sec; },
    band: (v) => T.WIND_BANDS.find((b) => v >= b.from && v <= b.to)?.name || 'CALM',
    bandRange: (name) => { const b = T.WIND_BANDS.find((x) => x.name === name); return b ? [b.from, b.to] : null; },
    audioSpeed: windAudioSpeed,
    focus: frame(wind, [0.25, 1.32, 1.5], [-0.05, 0.98, 0.1]),
    focusCrank: frame(wind, [1.45, 1.1, 0.75], [0.55, 0.85, 0.05]),
  };

  // rain drum, gear faces toward the arch; on a low plinth so its drive shaft meets the wind line at 0.82
  const rain = T.rainDrum({ guard: 'IDLER 24T' });
  rain.position.set(3.05, 0.1, -2.25); rain.rotation.y = -1.94; rain.userData.keep = true; G.add(rain);
  G.add(at(mesh(boxG(0.9, 0.1, 0.8, 0, 0.05, 0, 0.01), M.dustyWood({ tint: '#5a4632' })), 3.05, 0, -2.25, 0, -1.94, 0));
  const R = rain.userData;
  // a flat stencil plate on the guard (the hood's own stencil faces the drum)
  const gp = T.textPlate('IDLER 24T', 0.2, { style: 'enamel', pw: 512, ph: 128, bg: '#3c4a3a', fg: '#e8e0c8' });
  gp.position.set(0.46 + 0.075, 0.72 + 0.155, 0.224); gp.rotation.y = Math.PI / 2; gp.rotation.z = 0; rain.add(gp);
  const pz = X.peas(); pz.position.set(0, 0.72, 0); rain.add(pz);
  // line shaft: rain coupling → bevel box past the drum → along the wind axis to the wind shaft end
  rain.updateMatrixWorld(true); wind.updateMatrixWorld(true);
  const C = rain.localToWorld(V(0.29, 0.72, 0.4));
  const xr = V(1, 0, 0).transformDirection(rain.matrixWorld);
  const D = C.clone().addScaledVector(xr, -1.0);
  const W0 = wind.localToWorld(V(-0.5, 0.82, 0));
  const shaft = X.lineShaft([arr(C), arr(D), arr(W0)]); G.add(shaft);
  const stub = rain.localToWorld(R.stub.clone());
  const stubProxy = X.proxy(0.1, 0.12, 0.12); rain.add(stubProxy); stubProxy.position.copy(R.stub).add(V(0.03, 0, 0));
  const shelf = X.gearShelf(); shelf.position.set(2.45, 0, -2.75); shelf.rotation.y = -0.2; G.add(shelf);
  const gearProxies = {};
  for (const Tn of [16, 24, 32]) { const g = shelf.userData.gears[Tn], r = g.userData.r + 0.012; const p = X.proxy(r * 2, r * 2, 0.05); g.add(p); gearProxies[Tn] = p; }
  let fitted = null, rainSpeed = 0;
  const homeGear = (Tn) => { const g = shelf.userData.gears[Tn], h = shelf.userData.home[Tn]; shelf.add(g); g.position.copy(h.position); g.rotation.copy(h.rotation); };
  H.rain = {
    group: rain, drum: R.drum, gears: shelf.userData.gears, shelf, guard: R.guard, guardPlate: gp, stub, stubProxy, gearProxies, shaft, peas: pz,
    /** Lift gear T off the shelf "into the hand" (raised and tilted toward the camera), or back (false). */
    lift: (Tn, b = true) => { if (fitted === Tn) return; const g = shelf.userData.gears[Tn], h = shelf.userData.home[Tn]; homeGear(Tn); if (b) { g.position.y = h.position.y + 0.09; g.position.z += 0.08; g.rotation.x = -0.25; } },
    /** Seat gear T on the stub axle (16T sits loose, 32T fouls both neighbours visibly; only 24T meshes). */
    fit: (Tn) => { if (fitted) homeGear(fitted); const g = shelf.userData.gears[Tn]; R.fitIdler(g); fitted = Tn; },
    unfit: () => { if (fitted) { R.fitIdler(null); homeGear(fitted); fitted = null; } },
    home: (Tn) => { if (fitted === Tn) { R.fitIdler(null); fitted = null; } homeGear(Tn); },
    get fitted() { return fitted; },
    /** Drive speed from the wind shaft (wind dial units 0..1). The drum turns only with 24T fitted. */
    setSpeed: (v) => { rainSpeed = v; R.setSpeed(v * 14 / 6); },
    get turning() { return !!R.turning; },
    /** Peas tumble (the visual for the rainBox loop). */
    setRaining: (b) => pz.userData.setTumble(b),
    focus: frame(rain, [0.46 + 1.0, 1.05, -0.05], [0.46, 0.66, -0.12]),
  };
  /** One storm speed for the whole train: the wind drum, the line shaft, the rain drive. */
  H.storm = {
    setWind: (v) => { W.setSpeed(v); shaft.userData.setSpeed(v * 14); H.rain.setSpeed(v); },
  };

  // winch on the far wall, left of the rain drum as seen from the arch (clear of the wind dial and Pike), rope up
  // over a pulley to the star trap
  const WX = 2.8, WY = 1.5;
  const winch = T.winch({ plate: 'STAR TRAP', ropeUp: 2.73 - WY - 0.06 });
  winch.position.set(WX, WY, TZ0 + 0.0); winch.userData.keep = true; G.add(winch);
  winch.userData.plate.visible = false;
  // a caged bulkhead above the winch so it reads from the arch and its plate reads in the close-up (no shadow)
  const bulkW = T.bulkheadLight({ lit: 1, color: '#f4e8cc' }); bulkW.position.set(WX + 0.45, 2.3, TZ0 + 0.02); G.add(bulkW);
  const ptW = new THREE.PointLight('#ffd8a8', 2.6, 3.4, 1.6); ptW.position.set(WX + 0.35, 2.12, TZ0 + 0.35); G.add(ptW); H.lights.winch = ptW;
  const plate = X.winchPlate(); plate.position.set(0, -0.42, 0.012); winch.add(plate);
  const pul = T.pulleyBlock({ r: 0.07 }); pul.position.set(WX, 2.73, TZ0 + 0.2); G.add(pul);
  G.add(T.ropeLine([WX, 2.67, TZ0 + 0.2], [WX, 2.62, TZ0 + 0.2], { sag: 0 }));
  G.add(T.ropeLine([WX + 0.03, 2.68, TZ0 + 0.27], [trapC.x - tw / 2 + 0.05, 2.9, trapC.z - 0.1], { sag: 0.06 }));
  const trap = X.ceilingTrap({ w: tw - 0.02, d: tw - 0.02 }); trap.position.copy(trapC); G.add(trap);
  const trapLight = new THREE.PointLight('#ffd6a0', 0, 4, 1.6); trapLight.position.set(trapC.x, 2.6, trapC.z); G.add(trapLight);
  const dust = X.dustFall(); G.add(dust);
  const handleProxy = X.proxy(0.16, 0.26, 0.12); winch.userData.handle.add(handleProxy); handleProxy.position.set(0.05, -0.1, 0);
  const winchProxy = X.proxy(0.46, 0.56, 0.3); winch.add(winchProxy); winchProxy.position.set(0, 0, 0.14);
  H.winch = {
    group: winch, handle: winch.userData.handle, handleProxy, proxy: winchProxy, plate,
    setHandle: winch.userData.setHandle, turn: winch.userData.turn,
    /** One full turn of the drum (with the handle) over `sec`. Resolves when done. */
    turnOnce: (sec = 1.3) => ctx.tween.run(sec, (k) => winch.userData.turn(k * Math.PI * 2), { ease: 'inOutSine' }),
    focus: frame(winch, [0.1, -0.16, 0.8], [0.02, -0.2, 0]),
  };
  H.trap = {
    group: trap, setOpen: trap.userData.setOpen,
    /** The stage trap bangs open and shut; dust sifts down through the gap. */
    bang: async () => {
      await ctx.tween.run(0.25, (k) => { trap.userData.setOpen(k * 0.85); trapLight.intensity = 3 * k; }, { ease: 'outCubic' });
      await ctx.tween.run(0.18, (k) => { trap.userData.setOpen(0.85 * (1 - k)); trapLight.intensity = 3 * (1 - k); }, { ease: 'inCubic' });
      dust.userData.sift([trapC.x, trapC.y - 0.05, trapC.z], { spread: 0.8, duration: 3 });
      ctx.camera.shake?.(0.012, 0.3);
    },
    sift: (p, o) => dust.userData.sift(p, o),
  };

  // the trap room as a sub-view: click the arch, the camera steps into it (every machine in one 40-degree cone)
  const archProxy = X.proxy(0.4, 2.25, archZ1 - archZ0 - 0.1); archProxy.position.set(wallX, 1.12, (archZ0 + archZ1) / 2); G.add(archProxy);
  H.trapRoom = { proxy: archProxy, focus: { position: [1.6, 1.62, 1.5], lookAt: [4.3, 0.95, -1.45], fov: 60 } };

  // =====================================================================================================
  // PERCHES
  // =====================================================================================================
  piano.updateMatrixWorld(true);
  const perch = piano.localToWorld(V(0.5, 1.345, -0.07));
  H.perches.lavinia = { position: arr(perch), rotationY: -0.9, pose: 'perch' };
  // while the lid is up for the tuning: she drifts to stand by the treble end
  const stand = piano.localToWorld(V(1.05, 0, 0.45));
  H.perches.laviniaTuning = { position: arr(stand), rotationY: -1.5, pose: 'hover' };
  // Pike stands back by the far wall behind the wind machine: in the trap view, never in the foreground of a close-up
  H.perches.pike = { position: [5.3, 0, -2.6], rotationY: -0.73, pose: 'stand' };

  // =====================================================================================================
  // HELPERS for index.js
  // =====================================================================================================
  // shadows: only the big shapes cast (each caster is drawn again in every shadow map it falls in)
  // (the instruments under the sheets, fallen sheets and the far conductor stand do not cast: triangle budget)
  const casters = new Set([piano, thunder, wind, rain, ...H.sheets.map((s) => s.group)]);
  const castsShadow = (o) => { for (let p = o; p && p !== G; p = p.parent) if (casters.has(p)) return true; return false; };
  G.traverse((o) => { if (o.isMesh && o.castShadow && !castsShadow(o)) o.castShadow = false; });
  // small parts of the casters that are too fine to matter in a 1024 map
  [...pf.strings, ...pf.pins, ...(pf.riders || []), pf.fork, pf.hammer].forEach((o) => o?.traverse?.((m) => { m.castShadow = false; }));

  H.update = (dt) => { H.flash.update(dt); };
  H.keepAnimated = [piano, rack, wind, rain, thunder, flash, winch, trap, mal, shelf, cond, shaft, kit, ...H.sheets.map((s) => s.group), ...Object.values(H.instruments)];
  return H;
}

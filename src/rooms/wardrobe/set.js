// Wardrobe & Props Loft (`wardrobe`): the set. buildSet(ctx, group) builds the loft under the roof (raw pine floor,
// whitewashed knee walls and slopes, dark rafters, a rain-streaked skylight), every object in docs/rooms/wardrobe.md's
// Layout and the lighting rig, and returns `handles` (see docs/notes/set-wardrobe.md for every hook).
// World frame: the room group sits at the origin. x ∈ [-3.3, 3.3] (left wall = -X), z ∈ [-4.3, 4.3] (the back wall of
// props shelves = -Z; the spiral stair and the vantage are at +Z). Knee walls 2.7 m, ridge 4.6 m along x = 0.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as T from '../../engine/props/theatre.js';
import { ambientRig, keyLight, lightShaft } from '../../engine/props/lights.js';
import { dustMotes } from '../../engine/props/particles.js';
import { mesh, noRay, grp, at, boxG, cylG, latheG, mergeG, mergeInto, tubeG, halo, chase, TAU } from '../../engine/props/theatre/common.js';
import { FONTS, grime, brickTexture, labelPlate } from '../../engine/props/theatre-textures.js';
import { makeCanvas, canvasTexture, rng } from '../../engine/props/textures.js';
import * as P from './props.js';

export const VANTAGE = { position: [0.5, 1.6, 3.8], lookAt: [-0.75, 1.12, -2.4], fov: 60 };
const W = 3.3, ZB = -4.3, ZF = 4.3, KNEE = 2.7, RIDGE = 4.6;
const SL = Math.hypot(W, RIDGE - KNEE), COS = W / SL, SIN = (RIDGE - KNEE) / SL;
/** Height of the underside of the roof at x. */
export const roofY = (x) => KNEE + (RIDGE - KNEE) * (1 - Math.abs(x) / W);
/** A point on a roof slope: side ±1, s metres up the slope from the eaves, at z. */
const slopeP = (side, s, z) => new THREE.Vector3(side * (W - s * COS), KNEE + s * SIN, z);

export const STAIR = { x: 2.3, z: 3.25, r: 0.97 };
export const SKY = { s0: 0.9, s1: 2.3, z0: -2.65, z1: -1.25 }; // skylight hole in the east slope
const V = (a) => new THREE.Vector3(...a);
const keep = (o) => { o.userData.keep = true; return o; };
const deg = Math.PI / 180;

export function buildSet(ctx, group) {
  const G = group;
  const H = {};
  const proxy = (w, h, d, parent, x = 0, y = 0, z = 0) => { const m = ctx.hotspots.proxyBox(w, h, d); m.position.set(x, y, z); (parent || G).add(m); return m; };
  const tw = (dur, fn, ease = 'inOutCubic') => ctx.tween.run(dur, fn, { ease });
  const updaters = [];
  const driver = new THREE.Object3D(); driver.name = 'wardrobeDriver';
  driver.userData.update = (dt, t) => { for (const f of updaters) f(dt, t); };
  G.add(driver);
  const camPos = () => ctx.camera.camera.getWorldPosition(new THREE.Vector3());

  // ===================================================================================================================
  // SHELL: floor, knee walls, slopes, gables, rafters
  // ===================================================================================================================
  const floorShape = new THREE.Shape();
  floorShape.moveTo(-W, -ZF); floorShape.lineTo(W, -ZF); floorShape.lineTo(W, ZF); floorShape.lineTo(-W, ZF); floorShape.closePath();
  const fh = new THREE.Path(); fh.absarc(STAIR.x, -STAIR.z, STAIR.r, 0, TAU, true); floorShape.holes.push(fh);
  const floorGeo = new THREE.ShapeGeometry(floorShape, 32).rotateX(-Math.PI / 2);
  { const uv = floorGeo.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v, u); } } // planks run along Z
  const floor = mesh(floorGeo, M.wood({ tint: '#d0ac7a', planks: 6, seed: 12, roughness: 0.8, repeat: [1.05, 1.05] }), { cast: false });
  floor.name = 'floor'; G.add(floor);
  // floor grime: dust in the corners and under the eaves, a worn path from the stair to the table, scraps of chalk
  {
    const Wc = 1024, Hc = 1334, c = makeCanvas(Wc, Hc), g = c.getContext('2d'), r = rng(8);
    const px = (x) => (x + W) / (2 * W) * Wc, pz = (z) => (z - ZB) / (ZF - ZB) * Hc;
    const edge = g.createLinearGradient(0, 0, Wc, 0);
    edge.addColorStop(0, 'rgba(40,28,16,0.55)'); edge.addColorStop(0.12, 'rgba(40,28,16,0)'); edge.addColorStop(0.88, 'rgba(40,28,16,0)'); edge.addColorStop(1, 'rgba(40,28,16,0.55)');
    g.fillStyle = edge; g.fillRect(0, 0, Wc, Hc);
    const back = g.createLinearGradient(0, 0, 0, Hc); back.addColorStop(0, 'rgba(40,28,16,0.45)'); back.addColorStop(0.08, 'rgba(40,28,16,0)'); g.fillStyle = back; g.fillRect(0, 0, Wc, Hc);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(50,34,18,${0.03 + r() * 0.06})`; g.beginPath(); g.ellipse(r() * Wc, r() * Hc, 10 + r() * 60, 6 + r() * 40, r() * 3, 0, TAU); g.fill(); }
    // the worn path: paler, polished
    g.strokeStyle = 'rgba(255,236,200,0.08)'; g.lineWidth = 120; g.lineCap = 'round';
    g.beginPath(); g.moveTo(px(1.6), pz(3.4)); g.bezierCurveTo(px(0.6), pz(1.6), px(0.2), pz(0.4), px(0.1), pz(-1.8)); g.stroke();
    // threads, pins, chalk dust, fabric snippets
    for (let i = 0; i < 90; i++) { g.strokeStyle = ['rgba(180,40,50,0.5)', 'rgba(200,190,170,0.5)', 'rgba(60,80,150,0.45)', 'rgba(190,160,60,0.5)'][i % 4]; g.lineWidth = 1.5; g.beginPath(); const x = px(-1.4 + r() * 2.2), y = pz(-1.6 + r() * 2.6); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30, x + (r() - 0.5) * 50, y + (r() - 0.5) * 50); g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(220,226,236,0.22)'; g.beginPath(); g.arc(px(-1.1 + r() * 1.2), pz(-1.2 + r() * 1.8), 2 + r() * 8, 0, TAU); g.fill(); }
    const decal = noRay(new THREE.Mesh(new THREE.PlaneGeometry(2 * W, ZF - ZB).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: canvasTexture(c), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })));
    decal.position.y = 0.002; decal.renderOrder = 1; decal.receiveShadow = true; G.add(decal);
  }

  const plaster = M.wornPlaster({ tint: '#e4ddcc', seed: 23, repeat: [0.4, 0.4] });
  // knee walls (whitewashed plaster, a scuffed skirting)
  for (const side of [-1, 1]) {
    const kw = mesh(new THREE.PlaneGeometry(ZF - ZB, KNEE).translate(0, KNEE / 2, 0), plaster, { cast: false });
    { const uv = kw.geometry.attributes.uv, p = kw.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getY(i)); }
    kw.rotation.y = side * -Math.PI / 2; kw.position.x = side * W; G.add(kw);
  }
  // roof slopes: west plain, east with the skylight hole. Built in slope coordinates (u = z, v = s) then mapped.
  const slopeGeo = (side, holes = []) => {
    const s = new THREE.Shape(); s.moveTo(ZB, 0); s.lineTo(ZF, 0); s.lineTo(ZF, SL); s.lineTo(ZB, SL); s.closePath();
    for (const [z0, z1, s0, s1] of holes) { const h = new THREE.Path(); h.moveTo(z0, s0); h.lineTo(z0, s1); h.lineTo(z1, s1); h.lineTo(z1, s0); h.closePath(); s.holes.push(h); }
    const geo = new THREE.ShapeGeometry(s), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getX(i), v = p.getY(i); const q = slopeP(side, v, z); p.setXYZ(i, q.x, q.y, q.z); }
    if (side < 0) { const idx = geo.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 1]; idx[i + 1] = t; } }
    geo.computeVertexNormals();
    return geo;
  };
  const slopePlaster = M.wornPlaster({ tint: '#cdc3ad', seed: 29, repeat: [0.35, 0.35] }); // a shade under the walls: smoke and age
  G.add(mesh(slopeGeo(-1), slopePlaster, { cast: false }));
  G.add(mesh(slopeGeo(1, [[SKY.z0, SKY.z1, SKY.s0, SKY.s1]]), slopePlaster, { cast: false }));
  // gables: whitewashed brick, sooty at the top
  const brickTex = brickTexture({ tint: '#9a6a52', paint: '#e2dccd', paintAmt: 0.82, soot: 0.25, seed: 44 }).clone();
  brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping; brickTex.repeat.set(1.1, 1.1); brickTex.needsUpdate = true;
  const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.95 });
  const gable = new THREE.Shape(); gable.moveTo(-W, 0); gable.lineTo(W, 0); gable.lineTo(W, KNEE); gable.lineTo(0, RIDGE); gable.lineTo(-W, KNEE); gable.closePath();
  G.add(at(mesh(new THREE.ShapeGeometry(gable), brickMat, { cast: false }), 0, 0, ZB + 0.001));
  G.add(at(mesh(new THREE.ShapeGeometry(gable), brickMat, { cast: false }), 0, 0, ZF - 0.001, 0, Math.PI, 0));

  // dark timbers: rafters, ridge beam, purlins, collar ties, wall plates, skylight trimmers (one merged mesh)
  {
    const beams = [], beamMat = M.wood({ tint: '#3e2c1e', planks: 0, seed: 27, roughness: 0.8 });
    const along = (side, s0, s1, z, w = 0.09, d = 0.13) => {
      const a = slopeP(side, s0, z), b = slopeP(side, s1, z), mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
      const n = new THREE.Vector3(-side * SIN, -COS, 0).multiplyScalar(d / 2 - 0.005); // push the beam inside the plaster
      const geo = new THREE.BoxGeometry(d, len, w).rotateZ(side * (Math.PI / 2 - Math.atan2(SIN, COS))).translate(mid.x + n.x, mid.y + n.y, mid.z);
      beams.push(geo);
    };
    for (let z = ZB + 0.3; z <= ZF - 0.2; z += 0.6) {
      along(-1, 0, SL - 0.05, z);
      if (z > SKY.z0 - 0.05 && z < SKY.z1 + 0.05) { along(1, 0, SKY.s0, z); along(1, SKY.s1, SL - 0.05, z); }
      else along(1, 0, SL - 0.05, z);
    }
    for (const z of [SKY.z0 - 0.05, SKY.z1 + 0.05]) along(1, SKY.s0 - 0.1, SKY.s1 + 0.1, z, 0.1, 0.14); // trimmers
    beams.push(boxG(0.16, 0.22, ZF - ZB, 0, RIDGE - 0.1, 0, 0.01)); // ridge beam
    for (const side of [-1, 1]) {
      for (const s of [1.25, 2.55]) {
        const p = slopeP(side, s, 0), n = new THREE.Vector3(-side * SIN, -COS, 0);
        beams.push(new THREE.BoxGeometry(0.16, 0.12, ZF - ZB).rotateZ(side * (Math.PI / 2 - Math.atan2(SIN, COS))).translate(p.x + n.x * 0.19, p.y + n.y * 0.19, 0));
      }
      beams.push(boxG(0.12, 0.12, ZF - ZB, side * (W - 0.06), KNEE + 0.02, 0, 0.01)); // wall plate
      beams.push(boxG(0.03, 0.14, ZF - ZB, side * (W - 0.015), 0.07, 0, 0.004)); // skirting
    }
    const cy = 3.85, cx = W * (1 - (cy - KNEE) / (RIDGE - KNEE));
    for (let z = ZB + 0.3; z <= ZF - 0.2; z += 1.2) beams.push(boxG(2 * cx, 0.14, 0.08, 0, cy, z + 0.1, 0.008));
    // a king post and a brace or two on the back gable
    beams.push(boxG(0.12, RIDGE - cy, 0.1, 0, (RIDGE + cy) / 2, ZB + 0.06, 0.008));
    const bm = mergeInto(beams, beamMat, { cast: false }); bm.name = 'timbers'; G.add(bm);
  }

  // ===================================================================================================================
  // SKYLIGHT: rain on the glass, a sodium glow beyond, a shaft of orange light and dust, a drip into a bucket
  // ===================================================================================================================
  {
    const sky = grp('skylight'); G.add(sky);
    const c00 = slopeP(1, SKY.s0, SKY.z0), c10 = slopeP(1, SKY.s0, SKY.z1), c01 = slopeP(1, SKY.s1, SKY.z0), c11 = slopeP(1, SKY.s1, SKY.z1);
    const out = new THREE.Vector3(SIN, COS, 0).multiplyScalar(0.07); // glass sits in the outer face of the roof
    const glassGeo = new THREE.BufferGeometry();
    const pts = [c00, c10, c01, c11].map((p) => p.clone().add(out));
    glassGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));
    glassGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    glassGeo.setIndex([0, 2, 1, 1, 2, 3]); glassGeo.computeVertexNormals();
    const rainMat = P.rainSkylightMaterial(); rainMat.side = THREE.DoubleSide;
    const glass = new THREE.Mesh(glassGeo, rainMat); glass.name = 'skylightGlass';
    glass.userData.update = rainMat.userData.update; sky.add(glass);
    // the reveal (the roof's thickness) and the frame with glazing bars
    const fr = [], rev = [];
    const mid = (a, b) => a.clone().add(b).multiplyScalar(0.5);
    const sideBox = (a, b, w, d, off) => { const len = a.distanceTo(b), m = mid(a, b).add(new THREE.Vector3(SIN, COS, 0).multiplyScalar(off)); const geo = new THREE.BoxGeometry(w, len, d); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); geo.applyQuaternion(q).translate(m.x, m.y, m.z); return geo; };
    // lining boards across the roof's depth
    for (const [a, b] of [[c00, c10], [c01, c11]]) rev.push(sideBox(a, b, 0.02, 0.09, 0.035));
    for (const [a, b] of [[c00, c01], [c10, c11]]) rev.push(sideBox(a, b, 0.09, 0.02, 0.035));
    G.add(mergeInto(rev, M.wornPlaster({ tint: '#d8d0bc', seed: 24 }), { cast: false }));
    for (const [a, b] of [[c00, c10], [c01, c11], [c00, c01], [c10, c11]]) fr.push(sideBox(a, b, 0.05, 0.05, 0.06));
    fr.push(sideBox(mid(c00, c10), mid(c01, c11), 0.03, 0.035, 0.06), sideBox(mid(c00, c01), mid(c10, c11), 0.03, 0.035, 0.06));
    G.add(mergeInto(fr, M.iron({ color: '#3a3430', roughness: 0.6 }), { cast: false }));
    // sodium shaft and dust in it
    const sc = mid(mid(c00, c11), mid(c10, c01));
    const shaft = lightShaft({ from: [sc.x, sc.y - 0.1, sc.z], to: [sc.x - 1.15, 0.05, sc.z - 0.2], radiusTop: 0.62, radiusBottom: 1.0, color: '#ffa860', opacity: 0.075, square: true });
    G.add(shaft);
    const motes = dustMotes({ box: [1.4, 2.6, 1.3], center: [sc.x - 0.65, 1.6, sc.z - 0.1], count: 160, color: '#ffd0a0', size: 0.014, opacity: 0.45 });
    G.add(motes);
    const sodium = new THREE.SpotLight('#ff9a48', 5, 7, 0.55, 0.8, 1.4);
    sodium.position.set(sc.x + 0.5, sc.y + 0.9, sc.z); sodium.target.position.set(sc.x - 1.0, 0, sc.z - 0.2); G.add(sodium, sodium.target);
    // the drip: a bucket under the low edge of the skylight; a drop falls every couple of seconds
    const dripTop = slopeP(1, SKY.s0 + 0.02, (SKY.z0 + SKY.z1) / 2 + 0.25); dripTop.y -= 0.05; dripTop.x -= 0.06;
    const bucket = grp('bucket'); bucket.position.set(dripTop.x, 0, dripTop.z); G.add(bucket);
    bucket.add(mergeInto([latheG([[0.001, 0.005], [0.12, 0.005], [0.125, 0.012], [0.15, 0.27], [0.158, 0.275], [0.152, 0.28], [0.145, 0.275], [0.119, 0.02], [0.001, 0.02]], 28), tubeG([[-0.15, 0.27, 0], [-0.1, 0.38, 0.04], [0, 0.42, 0.06], [0.1, 0.38, 0.04], [0.15, 0.27, 0]], 0.004, { radial: 5 })], M.iron({ color: '#8a8a84', roughness: 0.45 })));
    const water = mesh(new THREE.CircleGeometry(0.142, 28).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#2a2a28', roughness: 0.05, clearcoat: 1 }), { cast: false });
    water.position.y = 0.2; bucket.add(water);
    const ripple = noRay(new THREE.Mesh(new THREE.RingGeometry(0.02, 0.026, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd0a0', transparent: true, opacity: 0, depthWrite: false })));
    ripple.position.y = 0.202; bucket.add(ripple);
    const drop = noRay(new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6).scale(1, 1.6, 1), new THREE.MeshBasicMaterial({ color: '#ffd8b0', transparent: true, opacity: 0.8 })));
    drop.renderOrder = 3; G.add(drop);
    let dt0 = 0;
    updaters.push((dt) => {
      dt0 += dt; const period = 2.3, k = dt0 % period, fall = Math.sqrt(2 * (dripTop.y - 0.2) / 9.8);
      if (k < 0.5) { drop.visible = true; drop.position.set(dripTop.x, dripTop.y - 0.004 * k * 30, dripTop.z); drop.scale.setScalar(0.4 + k * 1.2); }
      else if (k < 0.5 + fall) { const f = k - 0.5; drop.position.set(dripTop.x, dripTop.y - 0.06 - 4.9 * f * f, dripTop.z); drop.scale.setScalar(1); }
      else { drop.visible = false; const r = k - 0.5 - fall; ripple.material.opacity = Math.max(0, 0.6 - r * 0.9); ripple.scale.setScalar(1 + r * 6); }
    });
    const hit = proxy(1.6, 0.25, 1.5, G, sc.x, sc.y - 0.12, sc.z); hit.rotation.z = -Math.atan2(SIN, COS);
    H.skylight = { object: sky, glass, hit, shaft, sodium, bucket, frame: fr };
  }

  // ===================================================================================================================
  // STAIR WELL: the top of the iron spiral stair, a rail round the hole, the warm void of the stage below
  // ===================================================================================================================
  {
    const well = grp('stairWell'); G.add(well);
    const stair = T.spiralStair({ h: 3.2, r: 0.85, steps: 16, turns: 0.95, start: -2.95 });
    stair.position.set(STAIR.x, -3.2, STAIR.z); well.add(stair);
    const trim = new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.85, side: THREE.DoubleSide });
    well.add(at(mesh(cylG(STAIR.r, STAIR.r, 0.34, 40, 0, -0.17, 0, true), trim, { cast: false }), STAIR.x, 0, STAIR.z));
    well.add(at(mesh(new THREE.RingGeometry(STAIR.r - 0.01, STAIR.r + 0.05, 40).rotateX(-Math.PI / 2), M.wood({ tint: '#5a4028', planks: 0, seed: 5 }), { cast: false }), STAIR.x, 0.004, STAIR.z));
    // the rail: posts and a top rail round the hole, open toward the room
    const phc = Math.atan2(VANTAGE.position[2] - STAIR.z, VANTAGE.position[0] - STAIR.x), R = STAIR.r + 0.02;
    const railPts = [], posts = [];
    for (let i = 0; i <= 40; i++) { const ph = phc + 0.62 + (TAU - 1.24) * i / 40; railPts.push([STAIR.x + Math.cos(ph) * R, 0.95, STAIR.z + Math.sin(ph) * R]); if (i % 5 === 0) posts.push(cylG(0.012, 0.012, 0.95, 6, STAIR.x + Math.cos(ph) * R, 0.475, STAIR.z + Math.sin(ph) * R)); }
    well.add(mergeInto([tubeG(railPts, 0.02, { radial: 8, seg: 80 }), ...posts], M.ironBlack(), { cast: false }));
    // the void below: warm stage light far down
    const vc = makeCanvas(256, 256), vg = vc.getContext('2d'), gr = vg.createRadialGradient(150, 110, 10, 128, 128, 128);
    gr.addColorStop(0, '#6a4020'); gr.addColorStop(0.5, '#22140a'); gr.addColorStop(1, '#040302'); vg.fillStyle = gr; vg.fillRect(0, 0, 256, 256);
    well.add(noRay(at(mesh(new THREE.CircleGeometry(STAIR.r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: canvasTexture(vc) }), { cast: false }), STAIR.x, -2.6, STAIR.z)));
    const up = new THREE.PointLight('#ffb070', 1.4, 3.2, 2); up.position.set(STAIR.x, -0.8, STAIR.z); well.add(up);
    const hit = proxy(1.7, 1.0, 1.7, G, STAIR.x, 0.4, STAIR.z);
    H.stair = { object: well, stair, hit };
    H.doors = { stair: { object: hit, frame: well, highlight: stair, to: 'stage' } };
  }

  // ===================================================================================================================
  // THE COSTUME RACK (left wall): 12 garments on hangers, each with a card tag on a string
  // ===================================================================================================================
  const RACK = { x: -2.9, y: 1.95, z0: 0.85, z1: -3.45 };
  {
    const rack = keep(grp('rack')); G.add(rack);
    // rail, wall brackets, end posts with feet
    const iron = [tubeG([[RACK.x, RACK.y, RACK.z0 + 0.04], [RACK.x, RACK.y, RACK.z1 - 0.04]], 0.016, { radial: 10, seg: 2 })];
    for (const z of [RACK.z0 - 0.15, -1.3, RACK.z1 + 0.15]) iron.push(tubeG([[-W, RACK.y + 0.02, z], [RACK.x - 0.02, RACK.y + 0.02, z], [RACK.x, RACK.y + 0.005, z]], 0.012, { radial: 6 }), tubeG([[-W, RACK.y - 0.32, z], [-3.08, RACK.y - 0.06, z], [RACK.x - 0.06, RACK.y + 0.01, z]], 0.009, { radial: 6 }));
    for (const z of [RACK.z0, RACK.z1]) {
      iron.push(cylG(0.016, 0.016, RACK.y, 10, RACK.x, RACK.y / 2, z), new THREE.SphereGeometry(0.024, 10, 8).translate(RACK.x, RACK.y + 0.02, z));
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) iron.push(tubeG([[RACK.x, 0.12, z], [RACK.x + Math.cos(a) * 0.12, 0.03, z + Math.sin(a) * 0.12], [RACK.x + Math.cos(a) * 0.16, 0.012, z + Math.sin(a) * 0.16]], 0.011, { radial: 6 }));
    }
    G.add(mergeInto(iron, M.ironBlack()));
    // Molly's Marks key card, pinned to the near end post (a small drawn copy of the paper)
    const marks = mesh(new THREE.PlaneGeometry(0.1, 0.14), new THREE.MeshStandardMaterial({ map: P.marksCardTexture(), roughness: 0.85, emissive: '#ffffff', emissiveIntensity: 0.06, emissiveMap: null }), { cast: false });
    const marksG = keep(grp('marksCard')); marksG.position.set(RACK.x + 0.03, 1.42, RACK.z0 + 0.02); marksG.rotation.y = 0.75; marksG.add(marks);
    marksG.add(mergeInto([cylG(0.004, 0.004, 0.006, 8).rotateX(Math.PI / 2).translate(0, 0.06, 0.004)], M.brass(), { cast: false }));
    G.add(marksG);
    const marksHit = proxy(0.16, 0.2, 0.16, G, RACK.x + 0.04, 1.42, RACK.z0 + 0.04);

    const TAGS = [
      { name: 'lilac walking dress', type: 'gown', color: '#b49ccc', sym: 'lighthouse', thread: 'lilac', notches: 1 },
      { name: 'blue velvet gown', type: 'gown', color: '#1d4f7a', sym: 'lighthouse', thread: 'lilac', notches: 2 },
      { name: 'grey silk bodice', type: 'blouse', color: '#8d949c', sym: 'lighthouse', thread: 'lilac', notches: 3 },
      { name: 'grey silk bodice', type: 'blouse', color: '#8a9098', sym: 'lighthouse', thread: 'green', notches: 3 },
      { name: 'grey satin bodice', type: 'blouse', color: '#a2a4aa', sym: 'crown', thread: 'lilac', notches: 3 },
      { name: 'black bombazine', type: 'gown', color: '#26222a', sym: 'lighthouse', thread: 'green', notches: 1 },
      { name: "fisherman's jersey", type: 'jacket', color: '#d6ccb0', sym: 'lighthouse', thread: 'brown', notches: 1 },
      { name: 'naval coat', type: 'coat', color: '#1c2440', sym: 'lighthouse', thread: 'navy', notches: 1 },
      { name: "dame's frock", type: 'gown', color: '#a01e2c', sym: 'heart', thread: 'brown', notches: 2 },
      { name: "orange-seller's dress", type: 'gown', color: '#cc8a2a', sym: 'heart', thread: 'lilac', notches: 1 },
      { name: 'tin armour', type: 'jacket', color: '#9c9c94', sym: 'crown', thread: 'navy', notches: 2 },
      { name: 'Pierrot suit', type: 'blouse', color: '#ece6d8', sym: 'heart', thread: 'navy', notches: 3 },
    ];
    const atlas = P.tagAtlas(TAGS);
    const threadMats = Object.fromEntries(Object.entries(P.THREAD_COLORS).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })]));
    const threadGeo = P.tagThreadGeometry();
    const hookGeo = tubeG([[0, -0.085, 0], [0, -0.045, 0], [-0.017, -0.012, 0], [-0.019, 0.008, 0], [-0.006, 0.021, 0], [0.011, 0.019, 0], [0.019, 0.005, 0]], 0.0028, { radial: 5, seg: 24 }).translate(0, -0.005, 0);
    const barGeo = tubeG([[0, -0.125, -0.17], [0, -0.098, -0.08], [0, -0.088, 0], [0, -0.098, 0.08], [0, -0.125, 0.17]], 0.011, { radial: 6, seg: 16 }).rotateY(Math.PI / 2);
    const hookMat = M.iron({ color: '#8a8680', roughness: 0.4 }), barMat = M.wood({ tint: '#7a5232', seed: 9, roughness: 0.5 });
    const backMat = new THREE.MeshStandardMaterial({ color: '#d6c49a', roughness: 0.9, side: THREE.BackSide });
    const stringMat = new THREE.MeshStandardMaterial({ color: '#cfc2a0', roughness: 0.9 });
    const armourMat = new THREE.MeshStandardMaterial({ color: '#a4a49c', metalness: 0.75, roughness: 0.42, side: THREE.DoubleSide, map: T.garmentMaterial('#ffffff').map });
    const slots = [];
    const RY = Math.PI / 2 - 0.55, TAG_REST_Y = Math.PI / 2 - 0.25;
    TAGS.forEach((t, i) => {
      const z = 0.62 - i * 0.35;
      const slot = keep(grp(`slot${i + 1}`)); slot.position.set(RACK.x, RACK.y, z); rack.add(slot);
      const swing = grp('swing'); slot.add(swing);
      swing.add(mesh(hookGeo, hookMat, { cast: false }));
      const pivot = grp('pivot'); pivot.rotation.y = RY + (rng(i + 3)() - 0.5) * 0.2; swing.add(pivot);
      pivot.add(mesh(barGeo, barMat));
      const clothMat = t.type === 'jacket' && t.sym === 'crown' ? armourMat : T.garmentMaterial(t.color);
      const cloth = mesh(T.garmentGeometry(t.type, 11 + i), clothMat); cloth.scale.set(1, 1, 0.62); cloth.name = 'garment'; pivot.add(cloth);
      // trims: brass buttons on the naval coat, pompoms and a ruff on the Pierrot, a lace collar on the lilac dress
      if (t.type === 'coat') pivot.add(mergeInto([...Array(10)].map((_, k) => new THREE.SphereGeometry(0.011, 8, 6).translate((k % 2 ? 0.05 : -0.05), -0.22 - Math.floor(k / 2) * 0.09, 0.071)), M.brass({ polished: true }), { cast: false }));
      if (t.sym === 'heart' && t.thread === 'navy') pivot.add(mergeInto([...[0, 1, 2].map((k) => new THREE.SphereGeometry(0.026, 10, 8).translate(0, -0.22 - k * 0.13, 0.066)), new THREE.TorusGeometry(0.085, 0.03, 8, 20).rotateX(Math.PI / 2).scale(1.3, 1, 0.8).translate(0, -0.1, 0)], M.matte('#1a1a1e', { roughness: 0.7 })));
      if (i === 0) pivot.add(mergeInto([new THREE.TorusGeometry(0.068, 0.012, 6, 24).rotateX(Math.PI / 2).scale(1.2, 1, 0.7).translate(0, -0.11, 0.01)], M.matte('#f0ebe0', { roughness: 0.9 }), { cast: false }));
      // the tag: pivot at its eyelet; at rest it hangs hole-up on a string from the hanger's neck, facing the room
      const tag = grp(`tag${i + 1}`);
      const rest = { p: new THREE.Vector3(-0.1, -0.2, 0.09).applyAxisAngle(new THREE.Vector3(0, 1, 0), RY).add(new THREE.Vector3(0.02, 0, 0)), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, TAG_REST_Y, -Math.PI / 2 + 0.12)) };
      tag.position.copy(rest.p); tag.quaternion.copy(rest.q);
      const geo = P.tagCardGeometry(t.notches, atlas.rect(i));
      const cardMat = new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.85, emissive: '#ffffff', emissiveMap: atlas.texture, emissiveIntensity: 0.05 });
      const card = mesh(geo, cardMat, { cast: false }); card.position.x = -(-P.TAG_W / 2 + 0.012); card.name = 'tagCard';
      const back = mesh(geo, backMat, { cast: false }); back.position.set(card.position.x, 0, -0.0006);
      const thread = mesh(threadGeo, threadMats[t.thread], { cast: false }); thread.position.x = card.position.x;
      tag.add(card, back, thread); swing.add(tag);
      const string = mesh(tubeG([[0, -0.088, 0], [rest.p.x * 0.5, (rest.p.y - 0.088) * 0.5 - 0.02, rest.p.z * 0.5], [rest.p.x, rest.p.y, rest.p.z]], 0.0012, { radial: 4, seg: 10 }), stringMat, { cast: false });
      swing.add(string);
      const hit = proxy(0.34, 1.0, 0.3, slot, 0.08, t.type === 'gown' ? -0.62 : -0.42, 0);
      hit.rotation.y = 0.25;
      slots.push({ i, def: t, slot, swing, pivot, cloth, tag, card, cardMat, string, hit, rest, home: slot.position.clone(), present: true, swingV: 0, swingA: 0 });
    });
    // garment swing physics: a damped pendulum about the rail
    updaters.push((dt) => {
      for (const s of slots) {
        if (Math.abs(s.swingA) < 1e-4 && Math.abs(s.swingV) < 1e-4) continue;
        s.swingV += (-28 * s.swingA - 2.2 * s.swingV) * Math.min(dt, 0.05);
        s.swingA += s.swingV * Math.min(dt, 0.05);
        s.swing.rotation.z = s.swingA;
      }
    });
    const kick = (s, v) => { s.swingV += v; };
    let presented = null;
    const camWorld = () => { const c = ctx.camera.camera; return { p: c.getWorldPosition(new THREE.Vector3()), q: c.getWorldQuaternion(new THREE.Quaternion()), c }; };
    /** Where the tag pivot must sit (G-local) for the card to fill `frac` of the screen width, facing the camera. */
    const presentPose = (frac = 0.46) => {
      const { p, q, c } = camWorld();
      const fov = c.fov * deg, aspect = c.aspect || 1.6;
      const d = P.TAG_W / (frac * 2 * Math.tan(fov / 2) * aspect);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q), right = new THREE.Vector3(1, 0, 0).applyQuaternion(q), upv = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const centre = p.clone().add(fwd.multiplyScalar(d)).add(upv.multiplyScalar(-0.004));
      const pivotW = centre.sub(right.multiplyScalar(-(-P.TAG_W / 2 + 0.012)));
      G.updateMatrixWorld(true);
      const gq = G.getWorldQuaternion(new THREE.Quaternion()).invert();
      return { p: G.worldToLocal(pivotW), q: gq.multiply(q) };
    };
    const restTag = async (i, instant = false) => {
      const s = slots[i]; if (!s) return;
      if (presented === i) presented = null;
      if (s.tag.parent === s.swing) { s.tag.position.copy(s.rest.p); s.tag.quaternion.copy(s.rest.q); s.string.visible = true; return; }
      const p0 = s.tag.position.clone(), q0 = s.tag.quaternion.clone();
      const toLocal = () => { s.swing.updateMatrixWorld(true); const pw = s.swing.localToWorld(s.rest.p.clone()); const qw = s.swing.getWorldQuaternion(new THREE.Quaternion()).multiply(s.rest.q); const gq = G.getWorldQuaternion(new THREE.Quaternion()).invert(); return { p: G.worldToLocal(pw), q: gq.multiply(qw) }; };
      if (!instant) await tw(0.45, (k) => { const tgt = toLocal(); s.tag.position.lerpVectors(p0, tgt.p, k); s.tag.quaternion.slerpQuaternions(q0, tgt.q, k); }, 'inOutCubic');
      s.swing.add(s.tag); s.tag.position.copy(s.rest.p); s.tag.quaternion.copy(s.rest.q);
      s.string.visible = s.present; s.cardMat.emissiveIntensity = 0.05;
      kick(s, 0.4);
    };
    const presentTag = async (i, { frac = 0.46 } = {}) => {
      const s = slots[i]; if (!s || !s.present) return;
      if (presented === i) return;
      if (presented != null) restTag(presented);
      presented = i;
      s.string.visible = false;
      G.attach(s.tag);
      const p0 = s.tag.position.clone(), q0 = s.tag.quaternion.clone();
      kick(s, -0.6);
      await tw(0.55, (k) => {
        const tgt = presentPose(frac);
        s.tag.position.lerpVectors(p0, tgt.p, k).add(new THREE.Vector3(0, Math.sin(k * Math.PI) * 0.05, 0));
        s.tag.quaternion.slerpQuaternions(q0, tgt.q, k);
        s.cardMat.emissiveIntensity = 0.05 + 0.3 * k;
      }, 'outCubic');
    };
    const lift = (i) => { const s = slots[i]; const from = s.slot.position.clone(); return tw(0.4, (k) => { s.slot.position.set(from.x + 0.28 * k, from.y + 0.14 * Math.sin(k * Math.PI / 2), from.z); }, 'outCubic'); };
    const swingBack = async (i) => { const s = slots[i]; const from = s.slot.position.clone(); await tw(0.45, (k) => { s.slot.position.lerpVectors(from, s.home, k); }, 'inOutCubic'); kick(s, 1.6); };
    const setPresent = (i, b) => {
      const s = slots[i]; s.present = !!b;
      if (!b && presented === i) { presented = null; }
      if (!b) { s.swing.add(s.tag); s.tag.position.copy(s.rest.p); s.tag.quaternion.copy(s.rest.q); }
      s.slot.visible = !!b; s.slot.position.copy(s.home); s.slot.scale.setScalar(1);
      s.hit.visible = true; // proxies are invisible anyway; keep them raycastable only when present
      s.hit.userData.disabled = !b;
    };
    const take = async (i) => {
      const s = slots[i];
      if (presented === i) await restTag(i, true);
      await lift(i);
      const from = s.slot.position.clone();
      await tw(0.35, (k) => { s.slot.position.set(from.x + 0.4 * k, from.y + 0.1 * k, from.z); s.slot.scale.setScalar(1 - 0.85 * k); }, 'inCubic');
      setPresent(i, false);
    };
    const sigh = () => { slots.forEach((s, k) => { if (s.present) this_later(0.08 * k, () => kick(s, 0.35 + 0.15 * Math.sin(k))); }); };
    const pending = [];
    const this_later = (sec, fn) => { pending.push({ t: sec, fn }); };
    updaters.push((dt) => { for (let k = pending.length - 1; k >= 0; k--) { pending[k].t -= dt; if (pending[k].t <= 0) { const f = pending[k].fn; pending.splice(k, 1); f(); } } });
    const focusAt = (zc) => ({ position: [-1.2, 1.5, zc + 0.5], lookAt: [RACK.x, 1.3, zc - 0.2] });
    const U0 = 0.25, U1 = -2.9;
    const viewAt = (u) => focusAt(U0 + (U1 - U0) * THREE.MathUtils.clamp(u, 0, 1));
    const uOf = (i) => THREE.MathUtils.clamp((0.62 - i * 0.35 - U0) / (U1 - U0), 0, 1);
    H.rack = {
      object: rack, slots, tags: TAGS, marks: { object: marksG, hit: marksHit },
      presentTag, restTag, presented: () => presented, lift, swingBack, take, setPresent, nudge: (i, v = 0.8) => kick(slots[i], v), sigh,
      viewAt, uOf, focus: viewAt(0.18), hitAll: proxy(0.6, 1.6, 4.3, G, RACK.x + 0.05, 1.2, (RACK.z0 + RACK.z1) / 2),
    };
  }

  // ===================================================================================================================
  // WIG HEADS: six on a high shelf above the rack; each turns to look at you
  // ===================================================================================================================
  {
    const wigs = keep(grp('wigs')); G.add(wigs);
    const shelfY = 2.18;
    const shelf = [boxG(0.34, 0.03, 3.5, -W + 0.17, shelfY, -1.05, 0.004), boxG(0.02, 0.05, 3.5, -W + 0.335, shelfY + 0.02, -1.05, 0.003)];
    for (const z of [0.55, -1.05, -2.65]) shelf.push(boxG(0.03, 0.22, 0.03, -W + 0.015, shelfY - 0.12, z, 0.003), tubeG([[-W, shelfY - 0.2, z], [-W + 0.26, shelfY - 0.02, z]], 0.012, { radial: 5 }));
    G.add(mergeInto(shelf, M.dustyWood()));
    const defs = [
      { wig: '#2a1a12', style: 'curls', yaw: Math.PI + 0.4 },
      { wig: '#d8b04a', style: 'bob', yaw: 0.15, ringlets: true },
      { wig: '#ece6dc', style: 'curls', yaw: Math.PI * 1.5 - 0.3, tower: true },
      { wig: '#1e1612', style: 'bob', yaw: 2.2, monocle: true },
      { wig: '#8a3a1c', style: 'bob', yaw: -0.25 },
      { wig: '#8c8a86', style: 'curls', yaw: Math.PI * 0.85 },
    ];
    const zs = [0.42, -0.18, -0.78, -1.38, -1.98, -2.58];
    const heads = defs.map((d, i) => {
      const hd = T.wigHead({ wig: d.wig, style: d.style, skin: ['#c8ae8a', '#bfa47e', '#cdb594', '#b89c78', '#c4a882', '#bba07c'][i], seed: 4 + i });
      P.lightenWigHead(hd, { style: d.style, seed: 4 + i });
      hd.scale.setScalar(0.86);
      const wm = hd.userData.wig;
      if (d.ringlets && wm) hd.add(mesh(P.ringletsG({ y0: 0.42, n: 9, len: 0.17, seed: 7 }), wm.material));
      if (d.tower && wm) hd.add(mesh(P.towerG({ y0: 0.47 }), wm.material));
      if (d.monocle) hd.add(mergeInto([new THREE.TorusGeometry(0.016, 0.0022, 6, 20).translate(0.027, 0.418, 0.081), tubeG([[0.043, 0.414, 0.08], [0.06, 0.38, 0.06], [0.07, 0.33, 0.04]], 0.0008, { radial: 3 })], M.brass({ polished: true }), { cast: false }));
      hd.position.set(-W + 0.16, shelfY + 0.015, zs[i]);
      hd.rotation.y = d.yaw;
      wigs.add(hd);
      return { object: hd, yaw0: d.yaw, turned: false };
    });
    const faceYaw = (hd) => { const v = V(VANTAGE.position); return Math.atan2(v.x - hd.position.x, v.z - hd.position.z); };
    const turn = (i, instant = false) => {
      const h = heads[i]; if (!h) return Promise.resolve();
      h.turned = true;
      const a0 = h.object.rotation.y; let a1 = faceYaw(h.object);
      while (a1 - a0 > Math.PI) a1 -= TAU; while (a1 - a0 < -Math.PI) a1 += TAU;
      if (instant) { h.object.rotation.y = a1; return Promise.resolve(); }
      return tw(1.1, (k) => { h.object.rotation.y = a0 + (a1 - a0) * k; }, 'outBack');
    };
    const setTurned = (n) => heads.forEach((h, i) => { if (i < n) turn(i, true); else { h.turned = false; h.object.rotation.y = h.yaw0; } });
    const hit = proxy(0.36, 0.55, 3.4, G, -W + 0.17, shelfY + 0.27, -1.08);
    H.wigs = { object: wigs, heads, hit, turn, setTurned, turnedCount: () => heads.filter((h) => h.turned).length };
  }

  // ===================================================================================================================
  // THE CUTTING TABLE (centre): chalk, the order pad, shears, pincushion, tape measure, clutter; the shadow lamp above
  // ===================================================================================================================
  const TABLE = { x: -0.5, z: -0.35, top: 0.9 };
  {
    const table = P.cuttingTable({ l: 2.0, w: 0.9, h: TABLE.top }); table.position.set(TABLE.x, 0, TABLE.z); G.add(table);
    const Y = TABLE.top;
    // clutter: a crimson bolt, folded cloth, tissue patterns, spools, a sad iron, a button tin, bolts on the pot board
    const crimson = [P.boltG(0.62, 0.07, 0.2).translate(-0.5, Y, -1.22), P.boltG(0.7, 0.08, 0.22).rotateY(0.1).translate(-0.45, 0.21, -0.6)];
    G.add(mergeInto(crimson, M.matte('#8a1424', { roughness: 0.75 })));
    G.add(mergeInto([boxG(0.26, 0.03, 0.2, -0.2, Y + 0.015, -1.0, 0.008), boxG(0.24, 0.025, 0.19, -0.2, Y + 0.075, -0.99, 0.008).rotateY(0.08), P.boltG(0.66, 0.07, 0.2).rotateY(-0.05).translate(-0.5, 0.21, -0.1)], M.matte('#b49ccc', { roughness: 0.8 })));
    G.add(mergeInto([boxG(0.25, 0.03, 0.19, -0.21, Y + 0.045, -1.01, 0.008).rotateY(-0.06), boxG(0.22, 0.03, 0.18, -0.19, Y + 0.105, -0.98, 0.008).rotateY(0.12), P.boltG(0.6, 0.07, 0.2).rotateY(0.04).translate(-0.48, 0.28, 0.45)], M.matte('#c99a2c', { roughness: 0.8 })));
    const tissue = [];
    for (let k = 0; k < 4; k++) tissue.push(new THREE.PlaneGeometry(0.42, 0.3).rotateX(-Math.PI / 2).rotateY(0.3 * k - 0.4).translate(-0.48 + k * 0.03, Y + 0.0015 + k * 0.0008, -0.42 + k * 0.05));
    const tissueTex = (() => { const c = makeCanvas(512, 384), g = c.getContext('2d'); g.fillStyle = '#ece0c4'; g.fillRect(0, 0, 512, 384); grime(g, 512, 384, { seed: 3, color: '#a08860', octaves: [[4, 0.12]] }); g.strokeStyle = 'rgba(40,40,60,0.6)'; g.lineWidth = 2; g.setLineDash([10, 6]); g.beginPath(); g.moveTo(60, 40); g.bezierCurveTo(200, 20, 300, 120, 460, 80); g.lineTo(440, 340); g.bezierCurveTo(300, 360, 160, 300, 60, 350); g.closePath(); g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(40,40,60,0.7)'; g.font = `28px ${FONTS.hand}`; g.fillText('BACK — cut 2', 150, 200); g.fillText('Thrush III.2', 160, 240); return canvasTexture(c); })();
    G.add(mergeInto(tissue, new THREE.MeshStandardMaterial({ map: tissueTex, roughness: 0.95, side: THREE.DoubleSide }), { cast: false }));
    const spoolCols = ['#2a3a8a', '#c8a020', '#1e6a3a', '#e8e4d8', '#8a1c1c'];
    spoolCols.forEach((c, k) => {
      const x = -0.12 - (k % 3) * 0.05, z = 0.05 - Math.floor(k / 3) * 0.06;
      G.add(mergeInto([cylG(0.016, 0.016, 0.03, 12, x, Y + 0.02, z)], M.matte(c, { roughness: 0.7 })));
      G.add(mergeInto([cylG(0.021, 0.021, 0.005, 12, x, Y + 0.0025, z), cylG(0.021, 0.021, 0.005, 12, x, Y + 0.0375, z)], M.wood({ tint: '#c8a070', seed: 3 })));
    });
    // sad iron on its trivet, and a tin of buttons
    G.add(mergeInto([latheG([[0, 0], [0.05, 0], [0.05, 0.004], [0, 0.004]], 3).scale(1.6, 1, 1).translate(-0.86, Y, 0.48), boxG(0.13, 0.05, 0.08, -0.86, Y + 0.03, 0.48, 0.02).scale(1, 1, 1), tubeG([[-0.91, Y + 0.055, 0.48], [-0.89, Y + 0.1, 0.48], [-0.83, Y + 0.1, 0.48], [-0.81, Y + 0.055, 0.48]], 0.008, { radial: 6 })], M.ironBlack()));
    G.add(mergeInto([cylG(0.05, 0.05, 0.035, 20, -0.13, Y + 0.0175, -0.2)], M.enamel('#2a4a6a', { roughness: 0.4 })));
    { const r = rng(5), b = []; for (let k = 0; k < 18; k++) b.push(cylG(0.008, 0.008, 0.004, 8, -0.13 + (r() - 0.5) * 0.07, Y + 0.036 + r() * 0.004, -0.2 + (r() - 0.5) * 0.07)); G.add(mergeInto(b, M.porcelain('#ece2cc'), { cast: false })); }
    // shears (static)
    G.add(at(P.shears({ open: 0.3 }), -0.78, Y + 0.001, -0.18, 0, 2.4, 0));
    // tailor's chalk (takeable; glints)
    const chalk = keep(P.chalkStick()); chalk.position.set(-0.3, Y + 0.002, 0.4); chalk.rotation.y = 0.5; G.add(chalk);
    const chalkGlint = P.glint({ size: 0.07, phase: 1.3 }); chalkGlint.position.set(0.01, 0.02, 0); chalk.add(chalkGlint);
    const chalkHit = proxy(0.1, 0.06, 0.1, chalk, 0, 0.02, 0);
    H.chalk = { object: chalk, hit: chalkHit, glint: chalkGlint, setPresent: (b) => { chalk.visible = !!b; chalkGlint.userData.setOn(!!b); }, setGlint: (b) => chalkGlint.userData.setOn(!!b), worldPos: () => chalk.getWorldPosition(new THREE.Vector3()) };
    // the order pad
    const pad = keep(P.orderPad()); pad.position.set(-0.6, Y, 0.2); pad.rotation.y = 0.05; G.add(pad);
    const padHit = proxy(0.17, 0.04, 0.23, pad, 0, 0.012, 0);
    const pp = pad.position;
    H.pad = { object: pad, hit: padHit, sheet: pad.userData.sheet, rubAt: pad.userData.rubAt, rubLine: pad.userData.rubLine, coverage: pad.userData.coverage, setRevealed: pad.userData.setRevealed, reset: pad.userData.reset, uvFromRay: pad.userData.uvFromRay, textRect: pad.userData.textRect,
      focus: { position: [pp.x, pp.y + 0.4, pp.z + 0.2], lookAt: [pp.x, pp.y, pp.z - 0.01] } };
    // tomato pincushion with its hatpin (delight)
    const pin = keep(P.pincushion()); pin.position.set(-0.24, Y, -0.6); pin.rotation.y = 0.6; G.add(pin);
    H.pincushion = { object: pin, hit: proxy(0.12, 0.1, 0.12, pin, 0, 0.04, 0) };
    // coiled tape measure, tail lying out and over the -X edge (delight)
    const tape = keep(P.tapeMeasure({ tail: [[0.06, 0.0], [0.22, 0.02], [0.395, 0.026]], drape: 0.16 })); tape.position.set(-0.6, Y + 0.001, -0.88); tape.rotation.y = Math.PI; G.add(tape);
    H.tape = { object: tape, hit: proxy(0.12, 0.05, 0.12, tape, 0, 0.02, 0) };
    // the tin lamp over the table: the room's one shadow-casting light
    const lamp = T.pendantLamp({ style: 'tin', drop: 2.2, lit: 1 });
    lamp.position.set(TABLE.x, roofY(TABLE.x), TABLE.z); G.add(lamp);
    lamp.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    const bulbW = lamp.userData.bulbPos.clone().add(lamp.position);
    const key = keyLight({ color: '#ffe2b8', intensity: 6.5, position: [bulbW.x, bulbW.y - 0.06, bulbW.z], target: [TABLE.x, 0, TABLE.z - 0.05], angle: 0.92, penumbra: 0.55, distance: 7, decay: 1.5, castShadow: true, mapSize: 1024 });
    key.userData.light.shadow.camera.near = 0.1;
    G.add(key);
    const shadeHalo = halo('#ffd8a0', 0.9, 0.22); shadeHalo.position.copy(bulbW).add(new THREE.Vector3(0, -0.12, 0)); G.add(shadeHalo);
    H.table = { object: table, lamp, key: key.userData.light, top: TABLE.top };
  }

  // ===================================================================================================================
  // THE DRESSMAKER'S DUMMY (centre back): petticoat on; storm skirt, bodice and cape dress on in stages
  // ===================================================================================================================
  const DUMMY = { x: 0.2, z: -2.45 };
  {
    const dummy = keep(T.dressmakersDummy({ layers: [{ kind: 'skirt', color: '#efe9dc' }, { kind: 'skirt', color: '#7c8590' }, { kind: 'bodice', color: '#8d949c' }] }));
    dummy.position.set(DUMMY.x, 0, DUMMY.z); dummy.rotation.y = Math.atan2(VANTAGE.position[0] - DUMMY.x, VANTAGE.position[2] - DUMMY.z) * 0.6;
    G.add(dummy);
    const [petticoat, skirt, bodice] = dummy.userData.layers;
    // the storm skirt and bodice get a richer silk
    skirt.material = new THREE.MeshStandardMaterial({ color: '#7c8590', roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, map: T.garmentMaterial('#ffffff').map });
    bodice.material = new THREE.MeshStandardMaterial({ color: '#8d949c', roughness: 0.45, metalness: 0.08, side: THREE.DoubleSide, map: T.garmentMaterial('#ffffff').map });
    const cape = mesh(P.dummyCapeGeometry(), P.oilskin()); cape.name = 'layer:cape'; dummy.add(cape);
    // buttons down the bodice front, a sash of the cape's green at the collar
    const bodiceTrim = mergeInto([...Array(6)].map((_, k) => new THREE.SphereGeometry(0.008, 8, 6).translate(0, 1.29 - k * 0.055, 0.118 + (k > 2 ? -0.012 : 0) + 0.012)), M.porcelain('#e8e4dc'), { cast: false });
    bodice.add(bodiceTrim);
    // the luggage label at the neck: DRESS FROM THE SKIN OUT. — M.
    const lc = makeCanvas(512, 280), lg = lc.getContext('2d');
    lg.fillStyle = '#e4d2a4'; lg.fillRect(0, 0, 512, 280); grime(lg, 512, 280, { seed: 9, color: '#8a6a3a', octaves: [[4, 0.22], [18, 0.12]] });
    lg.fillStyle = '#c4a96e'; lg.beginPath(); lg.arc(52, 140, 34, 0, TAU); lg.fill(); lg.fillStyle = '#3a2a18'; lg.beginPath(); lg.arc(52, 140, 12, 0, TAU); lg.fill();
    lg.fillStyle = '#2a1e30'; lg.font = `46px ${FONTS.hand}`; lg.textAlign = 'center'; lg.textBaseline = 'middle';
    lg.fillText('DRESS FROM', 290, 82); lg.fillText('THE SKIN OUT.', 290, 146); lg.font = `40px ${FONTS.hand}`; lg.fillText('— M.', 380, 214);
    const labelShape = new THREE.Shape(); labelShape.moveTo(-0.05, -0.018); labelShape.lineTo(-0.036, -0.0275); labelShape.lineTo(0.05, -0.0275); labelShape.lineTo(0.05, 0.0275); labelShape.lineTo(-0.036, 0.0275); labelShape.lineTo(-0.05, 0.018); labelShape.closePath();
    const lgeo = new THREE.ShapeGeometry(labelShape); { const p = lgeo.attributes.position, uv = lgeo.attributes.uv; for (let k = 0; k < p.count; k++) uv.setXY(k, (p.getX(k) + 0.05) / 0.1, (p.getY(k) + 0.0275) / 0.055); }
    const label = grp('dummyLabel'); label.position.set(0.0, 1.395, 0.06); dummy.add(label);
    const labelCard = mesh(lgeo, new THREE.MeshStandardMaterial({ map: canvasTexture(lc), roughness: 0.85, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: null, emissiveIntensity: 0 }), { cast: false });
    labelCard.position.set(0.012, -0.13, 0.11); labelCard.rotation.set(-0.18, 0, 0.12); label.add(labelCard);
    label.add(mesh(tubeG([[-0.035, 0.0, 0.0], [-0.04, -0.06, 0.07], [-0.038, -0.126, 0.106]], 0.0012, { radial: 4 }), M.matte('#cfc2a0'), { cast: false }), mesh(tubeG([[0.035, 0.0, 0.0], [0.03, -0.06, 0.07], [-0.032, -0.128, 0.108]], 0.0012, { radial: 4 }), M.matte('#cfc2a0'), { cast: false }));
    const labelHit = proxy(0.13, 0.09, 0.06, label, 0.01, -0.13, 0.12);
    // lilac flare (Lavinia steps through the gown)
    const flareHalo = halo('#c9a0ff', 1.8, 0); flareHalo.position.set(0, 1.0, 0.1); dummy.add(flareHalo);
    const flareLight = new THREE.PointLight('#d6b4ff', 0, 3, 2); flareLight.position.set(0, 1.1, 0.4); dummy.add(flareLight);
    const parts = { skirt, bodice, cape };
    const SK = 1.035; // the storm skirt shares the petticoat's lathe: sit it a hair outside so they don't z-fight
    const rest = (o) => { const b = o === parts.skirt ? SK : 1; o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(b, 1, b); };
    const setDressed = (kind, b) => { const o = parts[kind]; if (!o) return; rest(o); o.visible = !!b; if (kind === 'skirt') petticoat.visible = !b; }; // the petticoat pokes through the skirt's pleats: hide it under
    const dress = (kind) => {
      const o = parts[kind]; if (!o) return Promise.resolve();
      rest(o); o.visible = true;
      if (kind === 'skirt') return tw(0.8, (k) => { if (k > 0.85) petticoat.visible = false; o.position.y = 0.42 * (1 - k); const s = SK * (1 + 0.18 * (1 - k)); o.scale.set(s, 1, s); }, 'outBounce');
      if (kind === 'bodice') return tw(0.7, (k) => { o.scale.set(1 + 0.4 * (1 - k), 1 + 0.03 * (1 - k), 1 + 0.25 * (1 - k)); o.position.y = 0.04 * (1 - k); }, 'outBack');
      return tw(1.0, (k) => { o.position.y = 0.38 * (1 - k); o.rotation.y = 0.6 * (1 - k); const s = 1 + 0.12 * (1 - k); o.scale.set(s, 1, s); }, 'outCubic');
    };
    const reject = async (kind) => {
      const o = parts[kind]; if (!o) return;
      rest(o); o.visible = true; o.position.y = 0.06; if (kind === 'skirt') petticoat.visible = true;
      await tw(0.25, (k) => { o.position.y = 0.06 * (1 - k); }, 'outQuad');
      await tw(0.65, (k) => { o.position.set(0.3 * k, -0.35 * k * k, 0.12 * k); o.rotation.z = -0.5 * k; }, 'inCubic');
      o.visible = false; rest(o);
    };
    const flare = () => tw(1.1, (k) => { const f = Math.sin(k * Math.PI); flareHalo.material.opacity = 0.7 * f; flareHalo.visible = f > 0.01; flareLight.intensity = 6 * f; }, 'linear');
    const setFull = (b) => { for (const k of Object.keys(parts)) setDressed(k, b); };
    setFull(false);
    petticoat.visible = true;
    H.dummy = {
      object: dummy, layers: { petticoat, ...parts }, label: { object: label, card: labelCard, hit: labelHit },
      dress, reject, setDressed, setFull, flare, hit: proxy(0.62, 1.5, 0.55, G, DUMMY.x, 0.78, DUMMY.z),
      focus: { position: [DUMMY.x - 0.35, 1.42, DUMMY.z + 1.9], lookAt: [DUMMY.x + 0.3, 1.0, DUMMY.z] },
    };
    H.perches = {
      lavinia: { position: [DUMMY.x + 0.72, 0, DUMMY.z + 0.22], rotationY: -0.12, pose: 'stand' },
      laviniaDressed: { position: [DUMMY.x + 0.48, 0, DUMMY.z + 0.62], rotationY: -0.1, pose: 'stand' },
    };
  }

  // ===================================================================================================================
  // THE PROPS SHELVES (back wall): three bays of fake everything, the five named fakes, the lamp prop and its rings
  // ===================================================================================================================
  const SHELF_Z = -4.07;
  const BAYS = [{ x: -1.75, w: 1.4 }, { x: -0.1, w: 1.75 }, { x: 1.65, w: 1.6 }];
  let shelfY = [];
  {
    for (const b of BAYS) { const bay = P.shelfBay({ w: b.w, h: 3.0, d: 0.42, shelves: 6 }); bay.position.set(b.x, 0, SHELF_Z); G.add(bay); shelfY = bay.userData.shelfY; }
    const front = SHELF_Z + 0.21;
    // reserved spans (named fakes, the lens shelf) and the clutter around them
    const reserved = { '0:2': [[-2.38, -1.38]], '2:1': [[1.05, 1.45]], '2:2': [[0.85, 2.45]], '1:3': [[-0.95, -0.12]] };
    const spots = [];
    BAYS.forEach((b, bi) => shelfY.forEach((y, si) => {
      const x0 = b.x - b.w / 2 + 0.07, x1 = b.x + b.w / 2 - 0.07;
      const res = (reserved[`${bi}:${si}`] || []).slice().sort((a, c) => a[0] - c[0]);
      let cur = x0;
      const kinds = si === 5 ? ['books', 'box', 'scrolls', 'mask'] : si === 0 ? ['box', 'boots', 'books', 'urn', 'lantern', 'box'] : null;
      for (const [a, c] of res) { if (a - cur > 0.15) spots.push({ x: (cur + a) / 2, w: a - cur, y, z: SHELF_Z + 0.02, kinds }); cur = Math.max(cur, c); }
      if (x1 - cur > 0.15) spots.push({ x: (cur + x1) / 2, w: x1 - cur, y, z: SHELF_Z + 0.02, kinds });
    }));
    G.add(P.shelfClutter(spots, { seed: 17 }));
    // swords and spears leaning against the end of bay A, a painted shield on the floor
    G.add(mergeInto([boxG(0.03, 1.3, 0.006, -2.56, 0.65, -3.95, 0.001).rotateZ(0.0), boxG(0.03, 1.2, 0.006, 0, 0, 0, 0.001).rotateZ(0.12).translate(-2.6, 0.62, -3.85), cylG(0.012, 0.012, 1.9, 6).rotateZ(0.08).translate(-2.62, 0.95, -3.78)], M.iron({ color: '#a8a8a2', roughness: 0.35 })));
    // shelf-edge labels
    const labels = [
      ['FOWL & GAME', 0, 2, 0.15], ['HAMS (WOODEN)', 0, 2, -0.4], ['BOOTS', 0, 0], ['URNS, VASES, ETC.', 0, 3], ['MASKS', 0, 4],
      ['SKULLS — ALAS', 1, 3, -0.68], ['REGALIA (TIN)', 1, 3, -0.22], ['LANTERNS', 1, 2], ['BOOKS (EMPTY)', 1, 1], ['FRUIT (WAX)', 1, 4], ['TRUNK SPARES', 1, 0],
      ['CAKES', 2, 1], ['THE LAMP — MIND!', 2, 2], ['GLOBES', 2, 3], ['TRUMPETS (NO)', 2, 4], ['SUNDRIES', 2, 0],
    ].map(([text, bi, si, dx = 0]) => ({ text, pos: [BAYS[bi].x + dx - (dx ? 0 : 0.25), shelfY[si] - 0.002, front + 0.005], w: 0.17 }));
    G.add(P.labelStrip(labels, { seed: 5 }));

    const fake = (name, obj, pos, rotY, box, label) => {
      keep(obj); obj.position.set(...pos); obj.rotation.y = rotY; G.add(obj);
      const hit = proxy(...box, obj, 0, box[1] / 2, 0);
      H[name] = { object: obj, hit, label };
      return H[name];
    };
    fake('chicken', P.rubberChicken(), [-1.6, shelfY[2], SHELF_Z + 0.01], 0.15, [0.22, 0.2, 0.42]);
    { const c = H.chicken; c.squeak = () => { const o = c.object; return tw(0.5, (k) => { const s = 1 - 0.18 * Math.sin(k * Math.PI); o.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6); }, 'outQuad'); }; }
    fake('ham', P.woodenHam(), [-2.12, shelfY[2], SHELF_Z + 0.03], 0.25, [0.34, 0.16, 0.2]);
    { const h = H.ham; h.wobble = () => { const o = h.object; return tw(0.7, (k) => { o.rotation.x = Math.sin(k * Math.PI * 4) * 0.12 * (1 - k); }, 'linear'); }; }
    fake('cake', P.cardboardCake(), [1.25, shelfY[1], SHELF_Z + 0.03], 0.3, [0.3, 0.3, 0.3]);
    { const c = H.cake; c.bounce = () => { const o = c.object, y0 = shelfY[1]; return tw(0.5, (k) => { o.position.y = y0 + Math.sin(k * Math.PI) * 0.05; }, 'outQuad'); }; }
    fake('skull', P.skull(), [-0.75, shelfY[3], SHELF_Z + 0.04], 0.35, [0.18, 0.2, 0.2]);
    {
      const alas = T.textPlate('ALAS', 0.075, { style: 'card', pw: 256, ph: 128, font: FONTS.hand });
      alas.position.set(0.05, 0.03, 0.09); alas.rotation.set(-0.1, 0.25, -0.2); H.skull.object.add(alas);
      H.skull.object.add(mesh(tubeG([[0.02, 0.06, 0.07], [0.04, 0.05, 0.085], [0.05, 0.05, 0.088]], 0.0008, { radial: 3 }), M.matte('#cfc2a0'), { cast: false }));
      const s = H.skull; s.nod = () => { const o = s.object; return tw(0.9, (k) => { o.rotation.x = -Math.sin(k * Math.PI * 2) * 0.12 * (1 - k); }, 'linear'); };
    }
    fake('crown', P.tinCrown(), [-0.3, shelfY[3], SHELF_Z + 0.04], 0.2, [0.22, 0.14, 0.22]);
    { const c = H.crown; c.spin = () => { const o = c.object, r0 = o.rotation.y; return tw(0.8, (k) => { o.rotation.y = r0 + k * TAU; o.position.y = shelfY[3] + Math.sin(k * Math.PI) * 0.04; }, 'inOutQuad'); }; }
    // a costume trunk spilling out, lower left of the back wall; a wicker skip by the right
    G.add(at(P.costumeTrunk({ w: 0.85, d: 0.48, h: 0.46, color: '#3e2a1c' }), -1.55, 0, -3.4, 0, 0.18, 0));
    {
      const skip = grp('skip'); skip.position.set(1.15, 0, 0.7); skip.rotation.y = -0.3; G.add(skip);
      const wick = new THREE.MeshStandardMaterial({ map: T.garmentMaterial('#ffffff').map, color: '#a8865a', roughness: 0.9 });
      skip.add(mesh(boxG(0.8, 0.55, 0.5, 0, 0.275, 0, 0.03), wick));
      skip.add(at(mesh(P.capeBundle().geometry.clone().scale(2.1, 1.3, 1.6), M.matte('#2a5a8a', { roughness: 0.85 })), 0, 0.5, 0));
      skip.add(at(mesh(P.capeBundle().geometry.clone().scale(1.5, 1.6, 1.2), M.matte('#d0b040', { roughness: 0.85 })), 0.18, 0.52, 0.05, 0, 0.7, 0));
    }
  }

  // ---- the lens: lamp prop body, five glass rings in a felt tray, the props card ------------------------------------
  {
    const Y = shelfY[2];
    const lamp = keep(T.beehiveLamp({ rings: [], lit: 0 })); lamp.position.set(1.12, Y, SHELF_Z + 0.02); G.add(lamp);
    const tray = P.feltTray({ w: 1.06, d: 0.27 }); tray.position.set(1.86, Y, SHELF_Z + 0.02); G.add(tray);
    const SIZES = [0.16, 0.10, 0.22, 0.13, 0.19], XS = [1.43, 1.635, 1.85, 2.07, 2.27];
    const rings = SIZES.map((d, k) => {
      const rg = keep(T.lensRing({ d })); rg.name = `lensRing${k}`;
      const home = new THREE.Vector3(XS[k], Y + 0.011, SHELF_Z + 0.02 + (k % 2 ? 0.02 : -0.02));
      rg.position.copy(home); G.add(rg);
      const hit = proxy(d + 0.02, 0.07, d + 0.02, rg, 0, 0.03, 0);
      return { k, d, object: rg, home, hit, where: 'tray' };
    });
    const spindleHit = proxy(0.26, 0.42, 0.26, lamp, 0, 0.2, 0);
    const ringLight = P.ringOfLight({ r1: 0.48 }); ringLight.position.set(lamp.position.x + 0.03, Y + 0.24, SHELF_Z - 0.192); G.add(ringLight);
    const glowL = new THREE.PointLight('#ffd890', 0, 2.6, 2); glowL.position.set(lamp.position.x, Y + 0.18, SHELF_Z + 0.25); G.add(glowL);
    // the props card, leaning against the back behind the lamp
    const pc = makeCanvas(360, 512), pg = pc.getContext('2d');
    pg.fillStyle = '#e8dcbc'; pg.fillRect(0, 0, 360, 512); grime(pg, 360, 512, { seed: 15, color: '#8a6a3a', octaves: [[4, 0.2], [18, 0.1]] });
    pg.fillStyle = '#2a2018'; pg.textAlign = 'center'; pg.font = `bold 34px ${FONTS.typed}`; pg.fillText('PROPS', 180, 48); pg.font = `22px ${FONTS.typed}`; pg.fillText('GULL POINT — THE LAMP', 180, 82);
    pg.strokeStyle = '#3a3030'; pg.lineWidth = 2.5; // pencil beehive
    for (let k = 0; k < 5; k++) { const w = 120 - k * 20, y = 360 - k * 38; pg.beginPath(); pg.ellipse(180, y, w, 10, 0, 0, TAU); pg.stroke(); pg.beginPath(); pg.moveTo(180 - w, y); pg.lineTo(180 - w + 6, y - 34); pg.moveTo(180 + w, y); pg.lineTo(180 + w - 6, y - 34); pg.stroke(); }
    pg.fillStyle = '#5a4a30'; pg.fillRect(70, 372, 220, 26); pg.font = `24px ${FONTS.hand}`; pg.fillStyle = '#2a2018'; pg.fillText('BIGGEST AT THE BASE', 180, 440); pg.font = `20px ${FONTS.hand}`; pg.fillText('Mind the glass. — M.B.', 180, 478);
    const propcard = keep(grp('propcard')); propcard.position.set(0.8, Y + 0.002, SHELF_Z - 0.1); propcard.rotation.set(-0.2, 0.25, 0); G.add(propcard);
    propcard.add(at(mesh(new THREE.PlaneGeometry(0.13, 0.185), new THREE.MeshStandardMaterial({ map: canvasTexture(pc), roughness: 0.85 }), { cast: false }), 0, 0.0925, 0));
    const propcardHit = proxy(0.15, 0.2, 0.06, propcard, 0, 0.1, 0.02);
    // hooks
    const lampTop = () => lamp.localToWorld(new THREE.Vector3(0, lamp.userData.spindleTop + 0.05, 0));
    const toG = (v) => G.worldToLocal(v.clone());
    const stack = () => lamp.userData.rings.map((rg) => rings.find((r) => r.object === rg).k);
    const liftRing = (k) => { const r = rings[k]; if (r.where !== 'tray') return Promise.resolve(); r.where = 'hover'; const p0 = r.object.position.clone(), p1 = r.home.clone().add(new THREE.Vector3(0, 0.13, 0.06)); return tw(0.3, (t) => r.object.position.lerpVectors(p0, p1, t), 'outCubic'); };
    const returnRing = (k) => { const r = rings[k]; r.where = 'tray'; const p0 = r.object.position.clone(); r.object.rotation.set(0, 0, 0); return tw(0.35, (t) => { r.object.position.lerpVectors(p0, r.home, t); r.object.position.y += Math.sin(t * Math.PI) * 0.05; }, 'inOutCubic'); };
    const dropOnSpindle = async (k) => {
      const r = rings[k]; if (r.where === 'stack') return stack().length;
      const n = lamp.userData.rings.length;
      const p0 = r.object.position.clone(), top = toG(lampTop()), seat = toG(lamp.localToWorld(new THREE.Vector3(0, lamp.userData.ringY(n), 0)));
      await tw(0.4, (t) => { r.object.position.lerpVectors(p0, top, t); r.object.position.y += Math.sin(t * Math.PI) * 0.06; }, 'inOutCubic');
      await tw(0.28, (t) => { r.object.position.lerpVectors(top, seat, t); }, 'inQuad');
      lamp.userData.addRing(r.object); r.where = 'stack';
      return lamp.userData.rings.length;
    };
    const popTop = async () => {
      const rg = lamp.userData.rings[lamp.userData.rings.length - 1]; if (!rg) return null;
      const r = rings.find((x) => x.object === rg);
      const wp = rg.getWorldPosition(new THREE.Vector3());
      lamp.userData.popRing(); G.add(rg); rg.position.copy(toG(wp));
      const p0 = rg.position.clone(), top = toG(lampTop());
      await tw(0.3, (t) => rg.position.lerpVectors(p0, top, t), 'outCubic');
      r.where = 'hover';
      const hov = r.home.clone().add(new THREE.Vector3(0, 0.13, 0.06));
      await tw(0.35, (t) => rg.position.lerpVectors(top, hov, t), 'inOutCubic');
      return r.k;
    };
    const wobbleAndReturn = async () => {
      await tw(0.6, (t) => { lamp.rotation.z = Math.sin(t * Math.PI * 5) * 0.09 * (1 - t); lamp.rotation.x = Math.sin(t * Math.PI * 4 + 1) * 0.05 * (1 - t); }, 'linear');
      lamp.rotation.set(0, 0, 0);
      const all = [];
      while (lamp.userData.rings.length) {
        const rg = lamp.userData.rings[lamp.userData.rings.length - 1], r = rings.find((x) => x.object === rg);
        const wp = rg.getWorldPosition(new THREE.Vector3()); lamp.userData.popRing(); G.add(rg); rg.position.copy(toG(wp));
        rg.rotation.z = (Math.random() - 0.5) * 0.6;
        all.push(ctx.tween.delay(all.length * 0.09).then(() => returnRing(r.k)));
      }
      for (const r of rings) if (r.where === 'hover') all.push(returnRing(r.k));
      await Promise.all(all);
    };
    let solvedLevel = 0;
    const setSolved = (b, instant = false) => {
      lamp.userData.setLit(b ? 1 : 0, instant);
      const to = b ? 1 : 0;
      if (instant) { solvedLevel = to; ringLight.userData.setLevel(to * 0.85); glowL.intensity = to * 2.2; return Promise.resolve(); }
      const from = solvedLevel; solvedLevel = to;
      return tw(1.4, (t) => { const v = from + (to - from) * t; ringLight.userData.setLevel(v * 0.85); glowL.intensity = v * 2.2; }, 'inOutSine');
    };
    const setStack = (ks) => {
      while (lamp.userData.rings.length) { const rg = lamp.userData.rings[lamp.userData.rings.length - 1]; lamp.userData.popRing(); G.add(rg); }
      for (const r of rings) { r.object.position.copy(r.home); r.object.rotation.set(0, 0, 0); r.where = 'tray'; }
      for (const k of ks) { lamp.userData.addRing(rings[k].object); rings[k].where = 'stack'; }
    };
    const setTaken = (b) => { lamp.visible = !b; if (b) { ringLight.userData.setLevel(0); glowL.intensity = 0; } for (const r of rings) if (r.where === 'stack') r.object.visible = !b; };
    const takeLamp = async () => {
      const p0 = lamp.position.clone(), cam = toG(camPos()), s0 = lamp.scale.x;
      const p1 = p0.clone().lerp(cam, 0.55);
      await tw(0.9, (t) => { lamp.position.lerpVectors(p0, p1, t); lamp.position.y += Math.sin(t * Math.PI) * 0.12; lamp.scale.setScalar(s0 * (1 - 0.7 * t)); lamp.rotation.y = t * 1.5; }, 'inOutCubic');
      setTaken(true); lamp.position.copy(p0); lamp.scale.setScalar(s0); lamp.rotation.set(0, 0, 0);
      await setSolved(false);
    };
    H.lens = {
      object: lamp, lamp, tray, rings, spindleHit, ringLight, light: glowL, propcard: { object: propcard, hit: propcardHit },
      sizes: SIZES, correct: [2, 4, 0, 3, 1], stack, liftRing, dropOnSpindle, popTop, returnRing, wobbleAndReturn, setSolved, setStack, setTaken, takeLamp,
      worldPos: () => lamp.getWorldPosition(new THREE.Vector3()),
      hit: proxy(1.4, 0.42, 0.42, G, 1.76, Y + 0.2, SHELF_Z + 0.02), // stops short of the props card on the left
      focus: { position: [1.62, Y + 0.45, SHELF_Z + 1.1], lookAt: [1.6, Y + 0.08, SHELF_Z] },
    };
  }

  // ===================================================================================================================
  // SEWING (right wall): treadle machine under a green lamp, the storm skirt under the needle, metronome, oil can, note
  // ===================================================================================================================
  const MACH = { x: 3.0, z: -0.9 };
  {
    const mach = keep(T.sewingMachine({ running: 0 })); mach.position.set(MACH.x, 0, MACH.z); mach.rotation.y = -Math.PI / 2; G.add(mach);
    const headY = 0.79;
    // replace the merged steel (needle bar, foot, spool pin) with moving parts
    const steelMesh = mach.children.find((o) => o.isMesh && o.material?.color && o.material.color.getHexString() === 'b8b6b0');
    if (steelMesh) steelMesh.visible = false;
    const steel = M.iron({ color: '#c4c2bc', roughness: 0.28 });
    const needleBar = grp('needleBar'); needleBar.position.set(-0.155, headY, -0.04); mach.add(needleBar);
    needleBar.add(mergeInto([cylG(0.004, 0.004, 0.11, 6, 0, 0.08, 0), cylG(0.0012, 0.0006, 0.035, 5, 0, 0.012, 0), boxG(0.012, 0.012, 0.012, 0, 0.09, 0, 0.002)], steel, { cast: false }));
    const foot = grp('presserFoot'); foot.position.set(-0.165, headY, -0.04); mach.add(foot);
    foot.add(mergeInto([cylG(0.003, 0.003, 0.09, 6, 0, 0.075, 0), boxG(0.03, 0.005, 0.026, 0, 0.028, 0, 0.002)], steel, { cast: false }));
    mach.add(at(mesh(cylG(0.003, 0.003, 0.05, 6, 0, 0.025, 0), steel, { cast: false }), 0.03, headY + 0.25, -0.04));
    // thread from the spool down to the needle
    mach.add(mesh(tubeG([[0.03, headY + 0.27, -0.04], [-0.05, headY + 0.27, -0.035], [-0.13, headY + 0.2, -0.03], [-0.155, headY + 0.12, -0.035], [-0.155, headY + 0.03, -0.04]], 0.0007, { radial: 3, seg: 20 }), M.matte('#7a8290'), { cast: false }));
    const skirt = P.machineSkirt(); mach.add(skirt);
    let footUp = 0, needleRun = 0, needleT = 0, footK = 0;
    updaters.push((dt) => {
      if (needleRun > 0) { needleRun = Math.max(0, needleRun - dt); needleT += dt * 26; needleBar.position.y = headY + Math.sin(needleT) * 0.012 - 0.006; }
      else needleBar.position.y = chase(needleBar.position.y, headY, dt, 10);
      footK = chase(footK, footUp, dt, 8); foot.position.y = headY + footK * 0.018;
    });
    const machHooks = mach.userData;
    const runNeedle = (sec = 0.6) => { needleRun = sec; };
    const treadlePress = () => {
      const tr = machHooks.treadle, fly = machHooks.flywheel, hw = machHooks.handwheel, f0 = fly.rotation.x, h0 = hw.rotation.x;
      return tw(0.65, (k) => { tr.rotation.x = Math.sin(k * Math.PI) * -0.16; fly.rotation.x = f0 + k * 3.4; hw.rotation.x = h0 + k * 8.8; }, 'outQuad');
    };
    const seize = () => { const o = mach, x0 = MACH.x, tr = machHooks.treadle; return tw(0.5, (k) => { o.position.x = x0 + Math.sin(k * 60) * 0.004 * (1 - k); tr.rotation.x = Math.sin(k * Math.PI) * -0.04; }, 'linear'); };
    let stitches = 0;
    const setStitches = (n) => { stitches = Math.max(0, Math.min(4, n)); skirt.userData.setStitches(stitches); };
    const stitch = async () => { runNeedle(0.65); const p = treadlePress(); setStitches(stitches + 1); await p; return stitches; };
    const unpick = () => { setStitches(stitches - 1); return stitches; };
    const setSkirtPresent = (b) => { skirt.visible = !!b; };
    const releaseSkirt = async () => {
      footUp = 1; await tw(0.3, () => {}, 'linear');
      const p0 = skirt.position.clone();
      await tw(0.7, (k) => { skirt.position.set(p0.x, p0.y + 0.18 * Math.sin(k * Math.PI / 2), p0.z + 0.3 * k); skirt.scale.setScalar(1 - 0.6 * k); }, 'inOutCubic');
      skirt.visible = false; skirt.position.copy(p0); skirt.scale.setScalar(1); footUp = 0;
    };
    // oil: a fresh sheen on the machine's head
    const oilSheen = noRay(mesh(new THREE.PlaneGeometry(0.22, 0.04), new THREE.MeshBasicMaterial({ color: '#fff4d0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
    oilSheen.position.set(0.0, headY + 0.24, -0.04 + 0.05); mach.add(oilSheen);
    const setOiled = (b) => { machHooks.oiled = !!b; oilSheen.material.opacity = b ? 0.12 : 0; };
    const oilSquirt = () => tw(0.8, (k) => { oilSheen.material.opacity = 0.12 + 0.3 * Math.sin(k * Math.PI); }, 'linear');
    // the green lamp over the machine (+ its warm light)
    const gl = T.pendantLamp({ style: 'enamel', color: '#1f5a36', drop: 0.82, lit: 1 });
    gl.position.set(2.72, roofY(2.72), MACH.z + 0.05); G.add(gl);
    gl.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    const gbulb = gl.userData.bulbPos.clone().add(gl.position);
    const sewLight = new THREE.PointLight('#ffe4b0', 3.0, 3.4, 1.8); sewLight.position.copy(gbulb).add(new THREE.Vector3(0, -0.1, 0)); G.add(sewLight);
    const gh = halo('#ffe0a0', 0.6, 0.25); gh.position.copy(gbulb).add(new THREE.Vector3(0, -0.12, 0)); G.add(gh);
    // the wall shelf beside the machine: metronome and oil can
    const SH = { x: W - 0.13, y: 0.85, z0: -0.4, z1: 0.12 };
    G.add(mergeInto([boxG(0.24, 0.025, SH.z1 - SH.z0, SH.x, SH.y - 0.0125, (SH.z0 + SH.z1) / 2, 0.004), ...[SH.z0 + 0.05, SH.z1 - 0.05].map((z) => tubeG([[W, SH.y - 0.18, z], [W - 0.02, SH.y - 0.05, z], [W - 0.2, SH.y - 0.03, z]], 0.008, { radial: 5 }))], M.dustyWood()));
    const met = keep(P.metronome()); met.position.set(SH.x - 0.02, SH.y, -0.2); met.rotation.y = -Math.PI / 2 + 0.35; G.add(met);
    const metHit = proxy(0.17, 0.32, 0.17, met, 0, 0.16, 0);
    const oil = keep(P.oilCan()); oil.position.set(SH.x - 0.02, SH.y, 0.03); oil.rotation.y = Math.PI * 0.85; G.add(oil);
    const oilGlint = P.glint({ size: 0.08, phase: 2.1 }); oilGlint.position.set(0.0, 0.08, 0); oil.add(oilGlint);
    const oilHit = proxy(0.2, 0.15, 0.14, oil, 0.02, 0.06, 0);
    // Molly's sewing note pinned above the machine
    const nc = makeCanvas(400, 520), ng = nc.getContext('2d');
    ng.fillStyle = '#efe6cc'; ng.fillRect(0, 0, 400, 520); grime(ng, 400, 520, { seed: 33, color: '#8a6a3a', octaves: [[4, 0.18], [20, 0.1]] });
    ng.fillStyle = '#2a1e30'; ng.font = `bold 40px ${FONTS.hand}`; ng.textAlign = 'left';
    ['OIL HER FIRST.', 'Then treadle in', 'WALTZ TIME:', 'ONE two three,', 'ONE two three.', 'Treadle on the', 'ONE or she jams.', '            — M.'].forEach((t, i) => { ng.font = `${i === 0 || i === 2 ? 'bold ' : ''}36px ${FONTS.hand}`; ng.fillText(t, 30, 60 + i * 58); });
    const note = keep(grp('sewingNote')); note.position.set(W - 0.005, 1.3, MACH.z - 0.05); note.rotation.set(0, -Math.PI / 2, 0.04); G.add(note);
    note.add(mesh(new THREE.PlaneGeometry(0.15, 0.195), new THREE.MeshStandardMaterial({ map: canvasTexture(nc), roughness: 0.9 }), { cast: false }));
    note.add(mergeInto([new THREE.SphereGeometry(0.006, 8, 6).translate(0, 0.088, 0.004)], M.enamel('#b8201a'), { cast: false }));
    const noteHit = proxy(0.17, 0.21, 0.04, note, 0, 0, 0.01);
    // a chair for the sewer (a bentwood with a cushion)
    {
      const ch = grp('sewChair'); ch.position.set(MACH.x - 0.72, 0, MACH.z - 0.72); ch.rotation.y = Math.PI / 2 + 0.95; // pushed back from the machine, out of the close-up G.add(ch);
      const bw = M.wood({ tint: '#4a2e1c', seed: 5, roughness: 0.5 }), legs = [];
      for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) legs.push(cylG(0.014, 0.012, 0.45, 8, x * 1.05, 0.225, z * 1.05));
      legs.push(new THREE.TorusGeometry(0.2, 0.016, 8, 30).rotateX(Math.PI / 2).translate(0, 0.46, 0), new THREE.TorusGeometry(0.15, 0.01, 6, 24).rotateX(Math.PI / 2).translate(0, 0.16, 0));
      legs.push(tubeG([[-0.17, 0.46, -0.17], [-0.18, 0.75, -0.2], [-0.1, 0.92, -0.22], [0.1, 0.92, -0.22], [0.18, 0.75, -0.2], [0.17, 0.46, -0.17]], 0.014, { radial: 6, seg: 30 }));
      ch.add(mergeInto(legs, bw));
      ch.add(mesh(cylG(0.2, 0.2, 0.03, 24, 0, 0.485, 0), M.matte('#6a2a3a', { roughness: 0.9 })));
    }
    const fpos = [MACH.x - 1.3, 1.15, MACH.z + 0.55], flook = [MACH.x, 0.52, MACH.z + 0.3];
    H.sewing = {
      object: mach, machine: mach, skirt, needleBar, foot, treadle: machHooks.treadle,
      hit: proxy(0.6, 1.0, 1.0, G, MACH.x, 0.5, MACH.z), treadleHit: proxy(0.36, 0.12, 0.66, G, MACH.x, 0.1, MACH.z),
      note: { object: note, hit: noteHit },
      setStitches, stitch, unpick, stitches: () => stitches, releaseSkirt, setSkirtPresent, setOiled, oilSquirt, seize, treadlePress, runNeedle,
      setPresserFoot: (up) => { footUp = up ? 1 : 0; },
      focus: { position: fpos, lookAt: flook },
    };
    H.metronome = {
      object: met, hit: metHit, run: met.userData.run, stop: met.userData.stop, running: () => met.userData.running,
      beatAt: met.userData.beatAt, inWindow: met.userData.inWindow, onBeat: met.userData.onBeat, ring: met.userData.ring, setFlag: met.userData.setFlag, flag: met.userData.flag,
    };
    H.oilcan = { object: oil, hit: oilHit, glint: oilGlint, setPresent: (b) => { oil.visible = !!b; oilGlint.userData.setOn(!!b); }, setGlint: (b) => oilGlint.userData.setOn(!!b), worldPos: () => oil.getWorldPosition(new THREE.Vector3()) };
  }

  // ===================================================================================================================
  // THE HATBOX TOWER (right-back corner): seven boxes, the red one at the bottom; topples into a heap
  // ===================================================================================================================
  {
    const tower = keep(grp('hatboxes')); tower.position.set(2.78, 0, -3.3); G.add(tower);
    const defs = [
      { r: 0.27, h: 0.3, colors: ['#b8201a', '#7a1410'], stripes: 1, label: 'WET WEATHER', name: 'red' },
      { r: 0.24, h: 0.24, colors: ['#ece2c8', '#3a6a40'], stripes: 18, label: 'BONNETS' },
      { r: 0.23, h: 0.22, colors: ['#1a1a1c', '#ece8dc'], stripes: 14, label: "BOWLERS (NOT MR PIKE'S)" },
      { r: 0.22, h: 0.24, colors: ['#e8c030', '#c02a20'], stripes: 1, label: 'PANTO', spots: true },
      { r: 0.2, h: 0.2, colors: ['#e8a0b4', '#b04a6a'], stripes: 10, label: 'FEATHERS' },
      { r: 0.19, h: 0.25, colors: ['#1c2a5a', '#d8c890'], stripes: 12, label: 'TOP HATS' },
      { r: 0.16, h: 0.17, colors: ['#8a5a32', '#e8d8b4'], stripes: 1, label: 'MISC.', spots: true },
    ];
    const faceYaw = Math.atan2(VANTAGE.position[0] - tower.position.x, VANTAGE.position[2] - tower.position.z);
    let y = 0; const r = rng(23);
    const boxes = defs.map((d, i) => {
      const hb = T.hatbox({ r: d.r, h: d.h, colors: d.colors, stripes: d.stripes, label: d.label, seed: 90 + i });
      if (d.spots) { const side = hb.children[0]; const c = makeCanvas(256, 256), g = c.getContext('2d'); g.fillStyle = d.colors[0]; g.fillRect(0, 0, 256, 256); grime(g, 256, 256, { seed: i, color: '#5a3a1a', octaves: [[4, 0.2]] }); g.fillStyle = d.colors[1]; for (let k = 0; k < 40; k++) { g.beginPath(); g.arc((k * 53) % 256, ((k * 97) % 256), 9, 0, TAU); g.fill(); } side.material = new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.85, side: THREE.DoubleSide }); }
      const lean = (r() - 0.5) * 0.06, off = [(r() - 0.5) * 0.05, (r() - 0.5) * 0.05];
      hb.position.set(off[0], y, off[1]); hb.rotation.set(lean * 0.6, faceYaw + (r() - 0.5) * 0.3, lean);
      y += d.h + 0.026;
      tower.add(hb);
      const hit = proxy(d.r * 2 + 0.02, d.h + 0.05, d.r * 2 + 0.02, hb, 0, d.h / 2 + 0.02, 0);
      return { i, def: d, object: hb, lid: hb.userData.lid, hit, rest: { p: hb.position.clone(), r: hb.rotation.clone() } };
    });
    // the cape, folded inside the red box
    const capeIn = P.capeBundle(); capeIn.scale.set(1.15, 1.1, 1.15); capeIn.position.y = 0.06; boxes[0].object.add(capeIn);
    // heap poses (tower-local): where each box lands after the topple
    const heap = [
      { p: [0.0, 0, 0.02], r: [0.0, faceYaw + 0.1, -0.05] },
      { p: [-0.55, 0.24, 0.35], r: [Math.PI / 2, 0.9, 0] },
      { p: [-0.1, 0.23, 0.62], r: [Math.PI / 2, -0.4, 0] },
      { p: [-0.75, 0.0, -0.15], r: [0.12, 0.4, 0.05] },
      { p: [-0.5, 0.2, 0.9], r: [Math.PI / 2 - 0.2, 1.8, 0] },
      { p: [-0.98, 0.19, 0.42], r: [Math.PI / 2, 2.6, 0] },
      { p: [-0.42, 0.24, -0.02], r: [0.3, 0.2, 0.25] },
    ];
    const lidRest = boxes.map((b) => ({ p: b.lid.position.clone(), r: b.lid.rotation.clone() }));
    let toppled = false;
    const setToppled = (b) => {
      toppled = !!b;
      boxes.forEach((bx, i) => {
        if (b) { bx.object.position.set(...heap[i].p); bx.object.rotation.set(...heap[i].r); } else { bx.object.position.copy(bx.rest.p); bx.object.rotation.copy(bx.rest.r); }
        bx.lid.position.copy(lidRest[i].p); bx.lid.rotation.copy(lidRest[i].r);
      });
      if (b) { // the red lid lies off to the side; the other lids stay on
        const L = boxes[0].lid; L.position.set(0.33, -0.28, 0.12); L.rotation.set(-1.35, 0, 0.3);
      }
    };
    const topple = async () => {
      if (toppled) return; toppled = true;
      const jobs = [];
      for (let i = boxes.length - 1; i >= 1; i--) {
        const bx = boxes[i], p0 = bx.object.position.clone(), r0 = bx.object.rotation.clone(), p1 = new THREE.Vector3(...heap[i].p), r1 = new THREE.Euler(...heap[i].r);
        const delay = (boxes.length - 1 - i) * 0.07;
        jobs.push(ctx.tween.delay(delay).then(() => tw(0.75 + i * 0.04, (k) => {
          bx.object.position.lerpVectors(p0, p1, k); bx.object.position.y += Math.sin(Math.min(1, k * 1.15) * Math.PI) * (0.18 + i * 0.03);
          bx.object.rotation.set(r0.x + (r1.x - r0.x) * k, r0.y + (r1.y - r0.y) * k, r0.z + (r1.z - r0.z) * k);
        }, 'outBounce')));
      }
      // the red box rocks, then its lid pops
      const red = boxes[0], rr0 = red.object.rotation.clone();
      jobs.push(tw(0.9, (k) => { red.object.rotation.z = rr0.z + Math.sin(k * Math.PI * 3) * 0.12 * (1 - k) - 0.05 * k; }, 'linear'));
      await Promise.all(jobs);
      await openRed();
    };
    const openRed = () => { const L = boxes[0].lid, p0 = L.position.clone(), r0 = L.rotation.clone(); return tw(0.6, (k) => { L.position.set(p0.x + 0.33 * k, p0.y + Math.sin(k * Math.PI) * 0.22 - 0.28 * k * k, p0.z + 0.12 * k); L.rotation.set(r0.x - 1.35 * k, r0.y, r0.z + 0.3 * k); }, 'linear'); };
    const setCape = (b) => { capeIn.visible = !!b; };
    H.hatboxes = { object: tower, boxes, red: boxes[0], cape: capeIn, topple, setToppled, toppled: () => toppled, openRed, setCape, labels: defs.map((d) => d.label) };
  }

  // ===================================================================================================================
  // THE CLOAK by the stair (the finale cloak), on a brass hook
  // ===================================================================================================================
  {
    const ck = keep(grp('cloakHook')); ck.position.set(W - 0.05, 2.08, 2.0); G.add(ck);
    ck.add(mergeInto([tubeG([[0.05, -0.02, 0], [-0.04, -0.01, 0], [-0.07, 0.03, 0]], 0.008, { radial: 6 }), cylG(0.025, 0.025, 0.01, 12).rotateZ(Math.PI / 2).translate(0.045, 0, 0)], M.brass()));
    const cl = T.cloak({ color: '#a9a7a0', h: 1.45 }); cl.rotation.y = -Math.PI / 2; cl.position.set(-0.08, 0.02, 0); ck.add(cl);
    H.cloak = { object: ck, cloak: cl, hit: proxy(0.35, 1.4, 0.7, G, W - 0.2, 1.4, 2.0) };
  }

  // ===================================================================================================================
  // LIGHTING: festoon along the ridge, fills, the ambient rig; set dressing that's pure static
  // ===================================================================================================================
  {
    const fpivot = grp('festoonPivot'); fpivot.position.set(0, RIDGE - 0.16, 0); G.add(fpivot);
    const fest = T.festoon([0, 0, 3.9], [0, 0, -3.9], { count: 14, sag: 0.5, lit: 1, dead: [9] });
    fpivot.add(fest);
    updaters.push((dt, t) => { fpivot.rotation.z = Math.sin(t * 0.7) * 0.035 + Math.sin(t * 1.9) * 0.01; });
    for (const z of [1.6, -2.1]) { const l = new THREE.PointLight('#ffc884', 3.2, 7.5, 1.5); l.position.set(0, 3.9, z); G.add(l); }
    const rackFill = new THREE.PointLight('#ffd6a8', 2.6, 5, 1.7); rackFill.position.set(-1.7, 2.4, -1.0); G.add(rackFill);
    const shelfFill = new THREE.PointLight('#ffd2a0', 2.2, 4.8, 1.7); shelfFill.position.set(0.1, 2.5, -2.9); G.add(shelfFill);
    G.add(ambientRig({ sky: '#ffe2c0', ground: '#6e5034', hemi: 0.62, ambient: '#3c2c24', ambientIntensity: 0.32 }));
    G.add(dustMotes({ box: [5.5, 3, 7], center: [0, 1.8, -0.6], count: 200, color: '#ffe0b0', size: 0.012, opacity: 0.32 }));
    H.festoon = { object: fest, pivot: fpivot };
  }

  return H;
}

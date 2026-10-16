// Stage props (PROPS): backcloths and flats, fly hardware, lighting kit, the prompt corner, the lighthouse truck.
// Every factory returns a THREE.Group; origin, facing and handles are documented per factory and in docs/PROPS.md.
import { THREE, M, TAU, mesh, noRay, grp, at, boxG, cylG, latheG, mergeG, mergeInto, catenary, tubeG, ropeMat, ropeLine, textPlate, texPlane, bulbSet, halo, beamCone, glowGlass, chase, instances, roundedBoxGeometry, rng } from './common.js';
import { dustSheet } from './cloth.js';
import { labelPlate, slateChalkTexture, stripeTexture, scuffedFloorTexture, FONTS, clothTexture } from '../theatre-textures.js';
import { makeCanvas, canvasTexture } from '../textures.js';

const iron = () => M.ironBlack();
const shiny = () => M.tarnishedBrass({ amount: 0.35 });

// =====================================================================================================
// SCENERY: backcloth / cyclorama, painted flats
// =====================================================================================================
const shimmerFrag = /* glsl */`
  uniform float uTime; uniform float uAmt; uniform float uHorizon; varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
  void main(){
    if (vUv.y > 1.0 - uHorizon) discard;
    float depth = 1.0 - vUv.y / (1.0 - uHorizon);           // 0 at horizon, 1 at the hem
    vec2 p = vec2(vUv.x * 140.0, vUv.y * 60.0 * (1.5 - depth));
    float n = noise(p + vec2(uTime * 0.8, uTime * 0.15)) * noise(p * 1.7 - vec2(uTime * 0.5, 0.0));
    float glint = smoothstep(0.55, 0.9, n) * pow(n, 4.0) * 2.2;  // sparse, small sparkles
    gl_FragColor = vec4(vec3(0.75, 0.85, 1.0) * glint * uAmt * (0.25 + 0.75 * depth), 1.0);
  }`;

/**
 * A backcloth or cyclorama on its battens. Origin: bottom centre of the cloth (the hem at y = 0 when flown IN);
 * faces +Z (the audience). texture: a painted canvas (e.g. seascapeTexture()); cyc: true for a plain sky cloth.
 * ripple: idle billow amplitude (m). horizon: fraction of the height (from the bottom) below which the sea shimmers.
 * userData: { cloth (Mesh), setTexture(tex), setShimmer(0..1), setRipple(a), topBatten, lines }
 * Cost: 3–4 draw calls (+1 while shimmering).
 */
export function backcloth({ w = 10, h = 6, texture = null, cyc = false, ripple = 0.025, horizon = 0.42, lines = 1.5, color = '#9ab0d0' } = {}) {
  const g = grp('backcloth');
  const geo = new THREE.PlaneGeometry(w, h, 40, 20).translate(0, h / 2, 0);
  const mat = new THREE.MeshStandardMaterial({ map: texture, color: texture ? '#ffffff' : color, roughness: 0.95, side: THREE.DoubleSide });
  if (cyc && !texture) {
    const c = makeCanvas(8, 256), cg = c.getContext('2d'), gr = cg.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#1a2a50'); gr.addColorStop(1, '#6a8ab8'); cg.fillStyle = gr; cg.fillRect(0, 0, 8, 256);
    mat.map = canvasTexture(c); mat.color.set('#ffffff');
  }
  const cloth = mesh(geo, mat, { cast: false, receive: true });
  g.add(cloth);
  const shimMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0 }, uHorizon: { value: 1 - horizon } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: shimmerFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, depthFunc: THREE.LessEqualDepth,
  });
  const shim = noRay(new THREE.Mesh(geo, shimMat));
  shim.visible = false; shim.renderOrder = 3;
  g.add(shim);
  // battens: an iron pipe at the head (with ties), a pipe in the canvas pocket at the hem, lift lines up into the flies
  const top = mesh(cylG(0.024, 0.024, w + 0.5, 10).rotateZ(Math.PI / 2).translate(0, h + 0.03, 0), iron());
  const hem = mesh(cylG(0.035, 0.035, w, 10).rotateZ(Math.PI / 2).translate(0, 0.03, 0.005), M.paintedCanvas({ tint: '#b8ac90' }));
  const ties = []; for (let x = -w / 2 + 0.15; x <= w / 2; x += 0.3) ties.push(boxG(0.012, 0.09, 0.05, x, h + 0.01, 0, 0.002));
  const tieM = mergeInto(ties, M.matte('#d8ccb0'));
  const lineGeos = []; for (const x of [-w * 0.4, -w * 0.13, w * 0.13, w * 0.4]) lineGeos.push(cylG(0.004, 0.004, lines, 4, x, h + 0.03 + lines / 2, 0));
  const lm = mergeInto(lineGeos, M.iron({ color: '#5a5a58' }), { cast: false });
  g.add(top, hem, tieM, lm);
  const pos = geo.attributes.position, n = pos.count, bx = new Float32Array(n), by = new Float32Array(n);
  for (let i = 0; i < n; i++) { bx[i] = pos.getX(i); by[i] = pos.getY(i); }
  let amp = ripple, shimmer = 0, shimTarget = 0, acc = 0;
  g.userData.update = (dt, t) => {
    shimmer = chase(shimmer, shimTarget, dt, 2);
    shim.visible = shimmer > 0.01;
    shimMat.uniforms.uTime.value = t; shimMat.uniforms.uAmt.value = shimmer;
    acc += dt; if (acc < 1 / 30 || !amp) return; acc = 0;
    for (let i = 0; i < n; i++) {
      const k = 1 - by[i] / h; // free hem moves most
      pos.setZ(i, amp * k * (Math.sin(t * 0.5 + bx[i] * 0.7) + 0.4 * Math.sin(t * 1.1 - bx[i] * 1.9 + by[i])));
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
  };
  g.userData.cloth = cloth;
  g.userData.topBatten = top;
  g.userData.setTexture = (tex) => { mat.map = tex; mat.color.set('#ffffff'); mat.needsUpdate = true; };
  g.userData.setShimmer = (v) => { shimTarget = v; };
  g.userData.setRipple = (a) => { amp = a; };
  return g;
}

/**
 * A painted flat or cut-out. Origin: bottom centre on the floor, painted face +Z.
 * texture: painted canvas (sceneryTexture({ kind }) or your own). cutout: true uses the texture's alpha as the
 * silhouette (no frame). frame/brace: the timber frame and a stage brace + weight on the back (rectangular flats).
 * userData: { face (Mesh), setTexture(tex) }. Cost: 2–4 draw calls.
 */
export function paintedFlat({ w = 1.2, h = 3.2, texture = null, cutout = false, frame = true, brace = true, lean = 0 } = {}) {
  const g = grp('paintedFlat');
  const rig = grp('flatRig'); g.add(rig);
  const t = 0.025;
  const faceMat = new THREE.MeshStandardMaterial({ map: texture, color: texture ? '#ffffff' : '#c8bca0', roughness: 0.95, alphaTest: cutout ? 0.5 : 0, transparent: false });
  const face = mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, t / 2 + 0.001), faceMat);
  rig.add(face);
  const backMat = cutout
    ? new THREE.MeshStandardMaterial({ map: texture, color: '#4a4236', roughness: 1, alphaTest: 0.5 })
    : M.paintedCanvas({ tint: '#cdbf9e' });
  const back = mesh(new THREE.PlaneGeometry(w, h).rotateY(Math.PI).translate(0, h / 2, -t / 2), backMat);
  rig.add(back);
  if (!cutout && frame) {
    const fw = 0.07, geos = [
      boxG(fw, h, t, -w / 2 + fw / 2, h / 2, 0), boxG(fw, h, t, w / 2 - fw / 2, h / 2, 0),
      boxG(w - fw * 2, fw, t, 0, fw / 2, 0), boxG(w - fw * 2, fw, t, 0, h - fw / 2, 0),
      boxG(w - fw * 2, fw * 0.9, t, 0, h * 0.5, -0.004), // toggle rail
    ];
    for (const [x, y] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) geos.push(boxG(0.12, 0.12, 0.006, x * (w / 2 - 0.08), y ? h - 0.08 : 0.08, -t / 2 - 0.003)); // corner blocks
    rig.add(mergeInto(geos, M.dustyWood()));
    // a thin edge band so the flat's thickness reads
    const edge = mesh(boxG(w, h, t * 0.8, 0, h / 2, 0, 0.002), M.paintedCanvas({ tint: '#b8aa88' }));
    edge.scale.set(1.0, 1.0, 0.98); rig.add(edge);
  }
  if (brace) {
    const bl = h * 0.62, a = Math.atan2(h * 0.55, 0.9);
    const br = mesh(boxG(0.035, bl, 0.025, 0, 0, 0), M.dustyWood());
    br.position.set(w * 0.2, h * 0.28, -0.45); br.rotation.x = -(Math.PI / 2 - a);
    const foot = mesh(boxG(0.05, 0.03, 0.4, w * 0.2, 0.015, -0.75), M.dustyWood());
    const weight = mesh(boxG(0.22, 0.09, 0.12, w * 0.2, 0.06, -0.85, 0.01), iron());
    g.add(br, foot, weight);
  }
  rig.rotation.x = -lean;
  g.userData.face = face;
  g.userData.setTexture = (tex) => { faceMat.map = tex; faceMat.color.set('#ffffff'); faceMat.needsUpdate = true; if (cutout) { backMat.map = tex; backMat.needsUpdate = true; } };
  return g;
}

// =====================================================================================================
// FLY HARDWARE: cleat, pulley block, sandbag, iron weights, arbor, rope lock, the fly rail
// =====================================================================================================

/** Cast-iron rope cleat (two horns). Origin: centre of its back plate, horns along X, facing +Z. ~0.2 m. 1 draw call. */
export function cleat({ len = 0.2 } = {}) {
  const g = grp('cleat');
  const geos = [boxG(len * 0.35, 0.05, 0.012, 0, 0, 0.006, 0.004), boxG(len * 0.2, 0.03, 0.04, 0, 0, 0.03, 0.006)];
  for (const s of [-1, 1]) {
    const horn = new THREE.CylinderGeometry(0.008, 0.014, len * 0.45, 10).rotateZ(Math.PI / 2).translate(s * len * 0.25, 0, 0.05);
    geos.push(horn, new THREE.SphereGeometry(0.009, 10, 8).translate(s * len * 0.48, 0, 0.05));
  }
  g.add(mergeInto(geos, iron()));
  return g;
}

/**
 * Pulley block: iron cheeks, a grooved sheave, an axle, a shackle and a hook. Origin: the shackle top (hang it).
 * userData: { sheave (spin about Z) }. ~0.3 m tall. 2 draw calls.
 */
export function pulleyBlock({ r = 0.08, hook = true } = {}) {
  const g = grp('pulleyBlock');
  const cy = -0.11 - r;
  const cheeks = [];
  // teardrop cheek plates: round under the sheave, tapering up to the strap
  const R = r * 1.18, cheek = new THREE.Shape();
  cheek.absarc(0, cy, R, Math.PI / 2 + 0.55, Math.PI / 2 - 0.55 + TAU, false);
  cheek.lineTo(0.024, -0.05); cheek.lineTo(-0.024, -0.05); cheek.closePath();
  const cheekGeo = () => new THREE.ExtrudeGeometry(cheek, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 20 });
  for (const s of [-1, 1]) cheeks.push(cheekGeo().translate(0, 0, s * 0.022 - 0.0035));
  for (const s of [-1, 1]) cheeks.push(cylG(0.016, 0.016, 0.008, 6).rotateX(Math.PI / 2).translate(0, cy, s * 0.03)); // axle nuts
  cheeks.push(boxG(0.02, 0.11, 0.05, 0, -0.06, 0, 0.004)); // strap
  cheeks.push(new THREE.TorusGeometry(0.035, 0.008, 8, 16, Math.PI).rotateZ(0).translate(0, -0.005, 0)); // shackle
  cheeks.push(cylG(0.01, 0.01, 0.06, 8).rotateX(Math.PI / 2).translate(0, cy, 0)); // axle
  if (hook) {
    const hookPts = [[0, cy - r * 1.2, 0], [0, cy - r * 1.2 - 0.05, 0], [0.02, cy - r * 1.2 - 0.09, 0], [0.045, cy - r * 1.2 - 0.07, 0], [0.045, cy - r * 1.2 - 0.045, 0]];
    cheeks.push(tubeG(hookPts, 0.009, { radial: 8 }));
  }
  g.add(mergeInto(cheeks, M.iron({ color: '#6a6660', roughness: 0.5 })));
  const sheave = mesh(latheG([[0.01, -0.016], [r, -0.016], [r * 0.82, 0], [r, 0.016], [0.01, 0.016]], 24).rotateX(Math.PI / 2), M.iron({ color: '#7a6a56', roughness: 0.55 }));
  sheave.position.y = cy;
  g.add(sheave);
  g.userData.sheave = sheave;
  return g;
}

/**
 * Canvas sandbag with a tied neck, a rope loop and a snap hook. Origin: base centre on the floor. ~0.36 m tall.
 * 2 draw calls.
 */
export function sandbag({ size = 0.3, tint = '#b4a27e', seed = 1 } = {}) {
  const g = grp('sandbag');
  const geo = new THREE.SphereGeometry(1, 20, 16), p = geo.attributes.position, r = rng(seed);
  const lump = Array.from({ length: 6 }, () => [r() * TAU, r() * TAU, 0.04 + r() * 0.05]);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    let k = 1;
    for (const [a0, b0, amp] of lump) k += Math.sin(a * 3 + a0) * Math.sin(y * 4 + b0) * amp;
    if (y > 0.35) k *= 1 - (y - 0.35) * 1.15; // neck pinch
    if (y < -0.45) y = -0.45 - (y + 0.45) * 0.15; // flat bottom
    p.setXYZ(i, x * k * size * 0.55, (y + 0.48) * size * 0.62, z * k * size * 0.45);
  }
  geo.computeVertexNormals();
  g.add(mesh(geo, M.paintedCanvas({ tint })));
  const neckY = size * 0.62 * 1.42;
  const rope = [new THREE.TorusGeometry(0.03 * size / 0.3, 0.008, 6, 14).rotateX(Math.PI / 2).translate(0, neckY - 0.01, 0),
    new THREE.TorusGeometry(0.045, 0.007, 6, 16).translate(0, neckY + 0.04, 0)];
  g.add(mergeInto(rope, ropeMat()));
  const hook = mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 12, Math.PI * 1.6).translate(0, neckY + 0.1, 0), M.iron());
  g.add(hook);
  return g;
}

const weightGeos = new Map();
/** Slotted iron counterweight geometry (cached). lb: 14 | 28 (thickness 0.035 / 0.07 m), 0.3 × 0.11 m. */
export function weightGeometry(lb = 28) {
  if (weightGeos.has(lb)) return weightGeos.get(lb);
  const W = 0.3, D = 0.11, H = lb >= 28 ? 0.068 : 0.034;
  const s = new THREE.Shape();
  s.moveTo(-W / 2, -D / 2); s.lineTo(W / 2, -D / 2); s.lineTo(W / 2, D / 2); s.lineTo(0.03, D / 2); s.lineTo(0.03, 0); s.lineTo(-0.03, 0); s.lineTo(-0.03, D / 2); s.lineTo(-W / 2, D / 2); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: H - 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 });
  geo.rotateX(-Math.PI / 2).translate(0, 0.003, 0); // slot toward -Z (the track side), stamped face toward +Z
  geo.computeVertexNormals();
  weightGeos.set(lb, geo);
  return geo;
}
/**
 * One stamped iron weight (14 or 28 lb). Origin: bottom centre. userData: { lb, height }. 2 draw calls.
 * For stacks use weightGeometry(lb) in an InstancedMesh.
 */
export function ironWeight({ lb = 28 } = {}) {
  const g = grp('ironWeight');
  const geo = weightGeometry(lb), H = lb >= 28 ? 0.068 : 0.034;
  g.add(mesh(geo, M.iron({ color: '#2a2826', roughness: 0.75 })));
  const stamp = textPlate(String(lb), 0.08, { style: 'card', bg: '#2a2826', fg: '#8a8680', pw: 256, ph: 96, font: FONTS.display });
  stamp.scale.y = Math.min(1, (H * 0.8) / (0.08 * 96 / 256));
  stamp.position.set(0, H / 2, -0.11 / 2 - 0.0015); stamp.rotation.y = Math.PI;
  // stamp on the +Z face (slot side is -Z after the rotate): put it on +Z
  stamp.position.z = 0.11 / 2 + 0.0035; stamp.rotation.y = 0;
  g.add(stamp);
  g.userData.lb = lb; g.userData.height = H;
  return g;
}

/**
 * Counterweight arbor: an iron cage that rides a T-track (guide shoes at -Z). Origin: bottom centre of the base
 * plate. userData: { stackY(n28, n14) → y for the next weight, baseTop, height, slotW }. 1 draw call.
 */
export function counterweightArbor({ h = 1.4 } = {}) {
  const g = grp('arbor');
  const geos = [
    boxG(0.34, 0.04, 0.13, 0, 0.02, 0, 0.004), boxG(0.34, 0.03, 0.13, 0, h - 0.015, 0, 0.004),
    boxG(0.32, 0.012, 0.12, 0, h * 0.55, 0, 0.002), // spreader plate
  ];
  for (const s of [-1, 1]) geos.push(cylG(0.011, 0.011, h, 8, s * 0.14, h / 2, 0.02));
  for (const y of [0.06, h - 0.06]) geos.push(boxG(0.08, 0.05, 0.05, 0, y, -0.085, 0.004)); // guide shoes
  for (const s of [-1, 1]) geos.push(new THREE.TorusGeometry(0.018, 0.005, 6, 12).translate(s * 0.05, h + 0.02, 0)); // wire terminations
  g.add(mergeInto(geos, iron()));
  g.userData.baseTop = 0.04; g.userData.height = h; g.userData.slotW = 0.3;
  g.userData.stackY = (n28 = 0, n14 = 0) => 0.04 + n28 * 0.068 + n14 * 0.034;
  return g;
}

/**
 * Rope lock: an iron bracket with a lever (ring handle) that clamps the purchase line. Origin: back of the bracket,
 * on the locking rail top, facing +Z. userData: { lever (pivot: rotation.x; 0 = DOWN/locked, -1.2 = UP), setLocked(b) }.
 * 2 draw calls.
 */
export function ropeLock() {
  const g = grp('ropeLock');
  g.add(mergeInto([boxG(0.1, 0.12, 0.06, 0, 0.06, 0.03, 0.006), cylG(0.028, 0.028, 0.14, 12, 0, 0.07, 0.07, true)], iron()));
  const lever = grp('lockLever');
  lever.position.set(0, 0.1, 0.07);
  lever.add(mergeInto([
    boxG(0.025, 0.025, 0.24, 0, 0, 0.12, 0.004),
    new THREE.TorusGeometry(0.04, 0.009, 8, 18).rotateY(Math.PI / 2).translate(0, 0, 0.27),
  ], M.iron({ color: '#3a3836' })));
  lever.rotation.x = 0.35; // hangs down a little = locked
  g.add(lever);
  g.userData.lever = lever;
  g.userData.setLocked = (b) => { lever.rotation.x = b ? 0.35 : -0.95; };
  return g;
}

/**
 * The fly rail: a row of counterweight sets. Locking rail with rope locks and number cards, vertical T-tracks,
 * arbors, purchase lines (two strands per set) and floor tension blocks. Origin: floor at the rail's centre;
 * the operator stands at +Z, tracks/arbors behind at -Z.
 * opts: sets, spacing, railH, trackH, cards (array of strings, default '1'..'n'), arborY (array or number).
 * userData: { sets: [{ x, arbor, lock, cardPos }], railY, trackH }. Cost: 4 + 2·sets draw calls.
 */
export function flyRail({ sets = 8, spacing = 0.34, railH = 1.0, trackH = 5, cards = null, arborY = 0.3 } = {}) {
  const g = grp('flyRail');
  const L = sets * spacing + 0.3, x0 = -(sets - 1) * spacing / 2;
  const ironGeos = [boxG(L, 0.08, 0.1, 0, railH, 0, 0.006), boxG(L, 0.03, 0.12, 0, railH + 0.055, 0.01, 0.004)];
  for (let px = -L / 2 + 0.1; px <= L / 2; px += 1.2) ironGeos.push(boxG(0.06, railH, 0.06, px, railH / 2, -0.02, 0.006));
  const ropeGeos = [];
  const labels = cards || Array.from({ length: sets }, (_, i) => String(i + 1));
  // a card atlas: one texture, one merged mesh
  const cw = 256, ch = 160, atlas = makeCanvas(cw * sets, ch), ag = atlas.getContext('2d');
  labels.forEach((t, i) => ag.drawImage(labelPlate(t, { style: 'card', w: cw, h: ch, seed: 91 + i }).image, i * cw, 0));
  const cardGeos = [];
  g.userData.sets = [];
  for (let i = 0; i < sets; i++) {
    const x = x0 + i * spacing;
    for (const s of [-1, 1]) ironGeos.push(boxG(0.012, trackH, 0.06, x + s * 0.12, trackH / 2, -0.32, 0.002), boxG(0.06, trackH, 0.008, x + s * 0.12, trackH / 2, -0.35, 0.002));
    ironGeos.push(cylG(0.05, 0.05, 0.03, 16, x, 0.12, -0.12).rotateX(0)); // tension block
    ironGeos.push(boxG(0.03, 0.12, 0.08, x, 0.06, -0.12, 0.003));
    // purchase lines: up from the tension block to the head, in front of the arbor
    for (const s of [-1, 1]) ropeGeos.push(cylG(0.011, 0.011, trackH - 0.12, 6, x + s * 0.03, 0.12 + (trackH - 0.12) / 2, -0.12 + (s > 0 ? 0.13 : 0.05)));
    const arbor = counterweightArbor({ h: 1.4 });
    arbor.position.set(x, Array.isArray(arborY) ? arborY[i] : arborY, -0.24);
    g.add(arbor);
    const lock = ropeLock();
    lock.position.set(x, railH + 0.07, 0.02);
    g.add(lock);
    const card = new THREE.PlaneGeometry(0.11, 0.07);
    const uv = card.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / sets);
    card.translate(x, railH - 0.005, 0.0525);
    cardGeos.push(card);
    g.userData.sets.push({ x, arbor, lock, cardPos: new THREE.Vector3(x, railH - 0.005, 0.053) });
  }
  g.add(mergeInto(ironGeos, iron()));
  g.add(mergeInto(ropeGeos, ropeMat(), { cast: false }));
  const cardMesh = mesh(mergeG(cardGeos), new THREE.MeshStandardMaterial({ map: canvasTexture(atlas), roughness: 0.8 }));
  g.add(cardMesh);
  g.userData.cards = cardMesh;
  g.userData.railY = railH; g.userData.trackH = trackH;
  return g;
}

// =====================================================================================================
// LIGHTING KIT: ghost light, Fresnel, footlights, bulkhead work light
// =====================================================================================================

function setLitGroup(g, { bulbMat, haloS, onColor, offColor, extra }) {
  let level = 0, target = 0;
  const on = new THREE.Color(onColor), off = new THREE.Color(offColor);
  const apply = () => {
    bulbMat.color.copy(off).lerp(on, level);
    if (haloS) { haloS.material.opacity = haloS.userData.baseOpacity * level; haloS.visible = level > 0.01; }
    extra?.(level);
  };
  g.userData.setLit = (t, instant = false) => { target = t === true ? 1 : t === false ? 0 : t; if (instant) { level = target; apply(); } };
  g.userData.level = () => level;
  const prev = g.userData.update;
  g.userData.update = (dt, time) => { prev?.(dt, time); if (Math.abs(level - target) > 0.001) { level = chase(level, target, dt, 4); apply(); } };
  apply();
}

/**
 * The ghost light: an iron pole on a three-legged base, a bare pear bulb in a wire cage, the cable coiled at its
 * foot with a plug and a card tag. Origin: centre of the base on the floor. ~1.9 m.
 * userData: { bulb, bulbPos (local Vector3), plug, tag, coil, setLit(0..1, instant), level() }.
 * The prop makes no light: the room adds its PointLight at bulbPos. Cost: 6 draw calls.
 */
export function ghostLight({ h = 1.88, lit = 0, tagText = 'GHOST LIGHT', seed = 1 } = {}) {
  const g = grp('ghostLight');
  const hub = 0.34, foot = 0.36, geos = [];
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3 + 0.3, fx = Math.cos(a) * foot, fz = Math.sin(a) * foot;
    geos.push(tubeG([[0, hub, 0], [fx * 0.5, hub * 0.55, fz * 0.5], [fx, 0.03, fz]], 0.012, { radial: 8, seg: 10 }));
    geos.push(new THREE.SphereGeometry(0.022, 10, 8).scale(1, 0.6, 1).translate(fx, 0.015, fz));
  }
  geos.push(cylG(0.035, 0.04, 0.08, 12, 0, hub, 0));                 // hub casting
  geos.push(cylG(0.016, 0.016, h - 0.2 - hub, 10, 0, hub + (h - 0.2 - hub) / 2, 0)); // pole
  geos.push(cylG(0.026, 0.026, 0.05, 10, 0, h * 0.55, 0), cylG(0.004, 0.004, 0.08, 6, 0.04, h * 0.55, 0).rotateZ(Math.PI / 2)); // clamp + T-screw
  const top = h - 0.2;
  // cage: 6 bowed wires, rings, a carrying loop
  const cageR = 0.075, cy0 = top + 0.02, cy1 = top + 0.2;
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6, c = Math.cos(a), s = Math.sin(a);
    geos.push(tubeG([[c * 0.03, cy0, s * 0.03], [c * cageR, cy0 + 0.05, s * cageR], [c * cageR * 1.05, (cy0 + cy1) / 2, s * cageR * 1.05], [c * cageR * 0.8, cy1 - 0.02, s * cageR * 0.8], [c * 0.012, cy1 + 0.01, s * 0.012]], 0.0025, { radial: 4, seg: 14 }));
  }
  geos.push(new THREE.TorusGeometry(cageR * 1.03, 0.003, 4, 24).rotateX(Math.PI / 2).translate(0, (cy0 + cy1) / 2, 0));
  geos.push(new THREE.TorusGeometry(0.06, 0.004, 4, 16, Math.PI).translate(0, cy1 + 0.01, 0));
  g.add(mergeInto(geos, iron()));
  // bakelite socket + cable down the pole + coil + plug
  const rub = M.bakelite('#16120f');
  const cableGeos = [latheG([[0, top - 0.06], [0.03, top - 0.06], [0.032, top - 0.02], [0.022, top + 0.03], [0.012, top + 0.04], [0, top + 0.04]], 16)];
  const run = [[0.03, top - 0.05, 0.0], [0.03, top - 0.3, 0.012], [0.026, h * 0.55 + 0.04, 0.02], [0.03, hub + 0.2, 0.02], [0.05, hub - 0.05, 0.05], [0.12, 0.05, 0.14], [0.2, 0.012, 0.2]];
  cableGeos.push(tubeG(run, 0.006, { radial: 6, seg: 40 }));
  const coil = [], r0 = rng(seed);
  for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * TAU * 3.2, rr = 0.16 + t * 0.07 + (r0() - 0.5) * 0.004; coil.push([0.36 + Math.cos(a) * rr, 0.008 + (i % 40 < 20 ? 0.002 : 0.009), 0.3 + Math.sin(a) * rr]); }
  cableGeos.push(tubeG([[0.2, 0.012, 0.2], ...coil.slice(2)], 0.006, { radial: 5, seg: 260 }));
  const cable = mesh(mergeG(cableGeos), rub);
  g.add(cable);
  const end = coil[coil.length - 1];
  const plug = grp('plug');
  plug.add(mesh(boxG(0.05, 0.03, 0.06, 0, 0.015, 0, 0.008), rub));
  plug.add(mergeInto([cylG(0.004, 0.004, 0.025, 6, -0.012, 0.012, 0.04).rotateX(0), cylG(0.004, 0.004, 0.025, 6, 0.012, 0.012, 0.04)].map((geo) => geo.rotateX(Math.PI / 2).translate(0, 0.006, 0.04)), M.brass()));
  plug.position.set(end[0] + 0.03, 0, end[2] + 0.04); plug.rotation.y = 0.8;
  g.add(plug);
  const tag = textPlate(tagText, 0.1, { style: 'card', pw: 256, ph: 160 });
  tag.rotation.x = -Math.PI / 2 + 0.25; tag.position.set(end[0] - 0.08, 0.012, end[2] + 0.1); tag.rotation.z = 0.4;
  g.add(tag);
  // bulb: a pear with a visible filament glow
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#4a4236', toneMapped: false, transparent: true, opacity: 0.95 });
  const bulb = noRay(mesh(latheG([[0, 0], [0.012, 0], [0.014, 0.02], [0.034, 0.06], [0.038, 0.09], [0.026, 0.125], [0, 0.135]], 20), bulbMat, { cast: false, receive: false }));
  bulb.position.y = top + 0.035;
  g.add(bulb);
  const hs = halo('#ffcf8a', 0.9, 0.55); hs.position.y = top + 0.11; g.add(hs);
  setLitGroup(g, { bulbMat, haloS: hs, onColor: new THREE.Color('#ffd49a').multiplyScalar(3.2), offColor: '#4a4236' });
  g.userData.setLit(lit, true);
  g.userData.bulb = bulb; g.userData.bulbPos = new THREE.Vector3(0, top + 0.1, 0);
  g.userData.plug = plug; g.userData.tag = tag; g.userData.coil = cable;
  return g;
}

/**
 * Fresnel spot lantern on a yoke with barn doors, a colour frame and a hook clamp. Points along +Z (tilt the
 * `tilt` group). Origin: the hook clamp top (hang it from a bar). color: gel colour. beam: show a soft additive cone.
 * userData: { tilt (rotation.x), lens, beam, setLit(0..1), setColor(c) }. Cost: 6 draw calls (+1 beam).
 */
export function fresnel({ color = '#fff1d6', beam = true, beamLength = 5, beamRadius = 1.1, lit = 0 } = {}) {
  const g = grp('fresnel');
  const blk = M.enamel('#141414', { roughness: 0.5 });
  g.add(mergeInto([boxG(0.06, 0.05, 0.05, 0, -0.025, 0, 0.006), cylG(0.008, 0.008, 0.06, 8, 0, -0.07, 0)], iron()));
  const yoke = grp('yoke'); yoke.position.y = -0.1; g.add(yoke);
  yoke.add(mergeInto([boxG(0.32, 0.025, 0.04, 0, 0, 0, 0.004), boxG(0.025, 0.2, 0.04, -0.15, -0.1, 0, 0.004), boxG(0.025, 0.2, 0.04, 0.15, -0.1, 0, 0.004)], iron()));
  const tilt = grp('tilt'); tilt.position.y = -0.19; yoke.add(tilt);
  tilt.rotation.x = 0.35;
  // body: a drum with cooling chimney and vents
  const body = [cylG(0.12, 0.12, 0.3, 24).rotateX(Math.PI / 2), cylG(0.13, 0.13, 0.02, 24, 0, 0, 0).rotateX(Math.PI / 2).translate(0, 0, 0.15), cylG(0.11, 0.11, 0.04, 24).rotateX(Math.PI / 2).translate(0, 0, -0.17)];
  body.push(boxG(0.14, 0.05, 0.16, 0, 0.13, -0.02, 0.01), boxG(0.16, 0.012, 0.18, 0, 0.16, -0.02, 0.004));
  for (let i = 0; i < 5; i++) body.push(boxG(0.18, 0.006, 0.02, 0, 0.117, -0.1 + i * 0.045));
  body.push(cylG(0.018, 0.018, 0.33, 10).rotateZ(Math.PI / 2)); // tilt knobs axle
  // colour frame runners and barn doors
  body.push(boxG(0.29, 0.29, 0.012, 0, 0, 0.175, 0.004));
  tilt.add(mergeInto(body, blk));
  const doors = [];
  for (let k = 0; k < 4; k++) {
    const d = boxG(0.26, 0.003, 0.13, 0, 0, 0.065, 0.001);
    if (k < 2) d.rotateX(k ? 0.5 : -0.5); // top door tips up, bottom tips down
    else { d.rotateZ(Math.PI / 2); d.rotateY(k === 2 ? -0.5 : 0.5); } // side doors splay outward
    d.translate(k === 2 ? -0.14 : k === 3 ? 0.14 : 0, k === 0 ? 0.14 : k === 1 ? -0.14 : 0, 0.18);
    doors.push(d);
  }
  tilt.add(mergeInto(doors, blk));
  tilt.add(mergeInto([cylG(0.03, 0.03, 0.03, 12, -0.18, 0, 0).rotateZ(Math.PI / 2), cylG(0.03, 0.03, 0.03, 12, 0.18, 0, 0).rotateZ(Math.PI / 2)], M.bakelite()));
  // stepped fresnel lens
  const steps = []; for (let i = 0; i <= 5; i++) { const rr = 0.105 * (1 - i / 6); steps.push([rr, 0.004 * i], [rr * 0.98, 0.004 * i + 0.006]); }
  steps.push([0, 0.032]);
  const lensMat = glowGlass(color, { opacity: 0.85, intensity: 2.6, offColor: '#3a3a40', roughness: 0.1 });
  const lens = mesh(latheG([[0, 0], ...steps], 32).rotateX(Math.PI / 2).translate(0, 0, 0.152), lensMat, { cast: false });
  tilt.add(lens);
  let cone = null;
  if (beam) { cone = beamCone(beamLength, beamRadius, color, 0.0); cone.rotation.x = -Math.PI / 2; cone.position.z = 0.17; tilt.add(cone); }
  let level = 0, target = lit;
  const apply = () => { lensMat.userData.setLevel(level); cone?.userData.setOpacity(level * 0.12); if (cone) cone.visible = level > 0.01; };
  g.userData.update = (dt) => { if (Math.abs(level - target) > 0.001) { level = chase(level, target, dt, 4); apply(); } };
  g.userData.setLit = (t, instant) => { target = +t; if (instant) { level = target; apply(); } };
  g.userData.setColor = (c) => { lensMat.emissive.set(c); cone?.material.uniforms.uColor.value.set(c); };
  level = lit; apply();
  g.userData.tilt = tilt; g.userData.yoke = yoke; g.userData.lens = lens; g.userData.beam = cone;
  return g;
}

/**
 * Footlights ('floats'): a hooded iron trough along the stage edge with a row of bulbs. Origin: centre of the
 * trough on the floor; the hood is on the +Z (audience) side, light thrown upstage (-Z) and up.
 * userData: { bulbs (bulbSet: setBulb/setAll), setLit(0..1), setColor(c) }. Cost: 3 draw calls.
 */
export function footlights({ w = 6, count = 16, color = '#ffd9a0', lit = 0 } = {}) {
  const g = grp('footlights');
  const s = new THREE.Shape();
  s.moveTo(-0.1, 0); s.lineTo(0.1, 0); s.lineTo(0.12, 0.13); s.lineTo(0.06, 0.15); s.lineTo(0.07, 0.03); s.lineTo(-0.08, 0.03); s.lineTo(-0.1, 0.06); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-w / 2, 0, 0);
  // the extrude's shape x maps to -Z after rotateY(+90): flip so the hood is at +Z
  geo.scale(1, 1, -1);
  g.add(mesh(geo, M.enamel('#1a1a18', { roughness: 0.6 })));
  // the polished reflector picks up the lamps' colour when they are on (emissive, so it reads without a light)
  const refl = M.brass({ color: '#b8b0a0', roughness: 0.3, unique: true });
  refl.emissive = new THREE.Color(color); refl.emissiveIntensity = 0;
  g.add(mesh(new THREE.PlaneGeometry(w, 0.12).rotateX(-0.9).translate(0, 0.08, 0.06), refl));
  const pos = []; for (let i = 0; i < count; i++) pos.push([-w / 2 + w * (i + 0.5) / count, 0.07, 0.0]);
  const bulbs = bulbSet(pos, { r: 0.028, color, intensity: 2.2, lit, shape: 'round' });
  g.add(bulbs);
  g.userData.bulbs = bulbs;
  g.userData.setLit = (t) => { bulbs.userData.setAll(+t); refl.emissiveIntensity = 0.55 * +t; };
  g.userData.setColor = (c) => { bulbs.userData.setColor(c); refl.emissive.set(c); };
  if (lit) g.userData.setLit(lit);
  return g;
}

/**
 * Caged bulkhead work light (wall mounted): an oval cast base, a glass dome and a three-bar cage. Faces +Z;
 * origin at the back plate centre. userData: { setLit(0..1), glass }. Cost: 3 draw calls.
 */
export function bulkheadLight({ color = '#f4f0e0', lit = 0 } = {}) {
  const g = grp('bulkhead');
  const base = latheG([[0, 0], [0.11, 0], [0.12, 0.02], [0.1, 0.05], [0, 0.05]], 28).rotateX(Math.PI / 2);
  base.scale(1.25, 1, 1);
  const geos = [base];
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * 0.55;
    geos.push(tubeG([[Math.cos(a) * 0.1 * 1.25, Math.sin(a) * 0.1, 0.05], [Math.cos(a) * 0.04, Math.sin(a) * 0.035, 0.13], [-Math.cos(a) * 0.04, -Math.sin(a) * 0.035, 0.13], [-Math.cos(a) * 0.1 * 1.25, -Math.sin(a) * 0.1, 0.05]].map(([x, y, z], k) => [k < 2 ? x : x, y, z]), 0.005, { radial: 5, seg: 16 }));
  }
  geos.push(new THREE.TorusGeometry(0.095, 0.006, 6, 24).scale(1.25, 1, 1).translate(0, 0, 0.055));
  g.add(mergeInto(geos, M.iron({ color: '#2e2c2a' })));
  const glassMat = glowGlass(color, { opacity: 0.85, intensity: 2.2, offColor: '#8a8a80', roughness: 0.25 });
  const dome = mesh(new THREE.SphereGeometry(0.085, 24, 12, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1.25, 1, 0.9).translate(0, 0, 0.05), glassMat, { cast: false });
  g.add(dome);
  const hs = halo(color, 0.5, 0.35); hs.position.z = 0.12; g.add(hs);
  let level = 0, target = lit;
  const apply = () => { glassMat.userData.setLevel(level); hs.material.opacity = 0.35 * level; hs.visible = level > 0.01; };
  g.userData.update = (dt) => { if (Math.abs(level - target) > 0.001) { level = chase(level, target, dt, 8); apply(); } };
  g.userData.setLit = (t, instant) => { target = +t; if (instant) { level = target; apply(); } };
  level = lit; apply();
  g.userData.glass = dome;
  return g;
}

// =====================================================================================================
// THE PROMPT CORNER: dimmer board, cue-light box, cue-light panel, prompt desk, switch-fuse
// =====================================================================================================

/**
 * Slate dimmer board: an iron cabinet with a slate face, N brass lever handles in vertical slots (engraved notch
 * labels), and an iron MASTER handwheel at the right. Optional chalk ticks: chalk = [{ channel, notch, text }].
 * Origin: bottom centre of the cabinet on the floor; faces +Z. Size ~1.3 × 1.9 m.
 * userData: { levers[i] (move .position.y), setLevel(i, notchIndex | 0..1 with frac=true), slotY0, slotY1, master
 * (rotate .rotation.z), channels, notches }. Cost: 5 + N draw calls.
 */
export function dimmerBoard({ channels = ['BATTENS', 'FLOATS', 'LIMES', 'BLUES'], notches = ['OUT', '¼', '½', '¾', 'FULL'], master = true, chalk = [], legs = 0.75 } = {}) {
  const g = grp('dimmerBoard');
  const n = channels.length, W = 0.24 * n + (master ? 0.42 : 0.12), H = 1.0, y0 = legs, cz = 0.16;
  // cabinet + legs
  const cab = [boxG(W + 0.06, H + 0.06, 0.32, 0, y0 + H / 2, 0, 0.01)];
  for (const s of [-1, 1]) cab.push(boxG(0.06, y0, 0.06, s * (W / 2 - 0.02), y0 / 2, 0.08), boxG(0.06, y0, 0.06, s * (W / 2 - 0.02), y0 / 2, -0.1));
  for (let i = 0; i < 6; i++) cab.push(boxG(W * 0.8, 0.012, 0.01, 0, y0 + 0.15 + i * 0.13, -0.165)); // rear vents
  g.add(mergeInto(cab, iron()));
  // slate face with engraved slots and labels (+ chalk)
  const pw = 1024, ph = Math.round(1024 * H / W), c = makeCanvas(pw, ph), cg = c.getContext('2d');
  cg.drawImage(slateChalkTexture({ w: 512, h: 512, seed: 7 }).image, 0, 0, pw, ph);
  const slotX = (i) => (0.06 + 0.24 * (i + 0.5)) / W * pw, sTop = 0.2 * ph, sBot = 0.82 * ph;
  cg.textAlign = 'center'; cg.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const x = slotX(i);
    cg.fillStyle = '#0a0a0c'; cg.fillRect(x - 10, sTop, 20, sBot - sTop);
    cg.fillStyle = '#e8dfc8'; cg.fillRect(x - 0.09 / W * pw, 0.06 * ph, 0.18 / W * pw, 0.08 * ph);
    cg.fillStyle = '#1a1410'; cg.font = `${0.04 * ph}px ${FONTS.fell}`; cg.fillText(channels[i], x, 0.1 * ph, 0.17 / W * pw); // ENGINE-FIX: fit the plate (BATTENS overran it)
    notches.forEach((t, k) => {
      const y = sBot - (sBot - sTop) * k / (notches.length - 1);
      cg.fillStyle = 'rgba(230,226,210,0.85)'; cg.fillRect(x + 16, y - 1.5, 26, 3); cg.fillRect(x - 42, y - 1.5, 26, 3);
      cg.font = `${0.03 * ph}px ${FONTS.fell}`; cg.fillText(t, x + 72, y);
    });
  }
  if (master) { cg.fillStyle = '#e8dfc8'; cg.font = `${0.04 * ph}px ${FONTS.fell}`; cg.fillText('MASTER', (W - 0.2) / W * pw, 0.1 * ph); cg.font = `${0.03 * ph}px ${FONTS.fell}`; cg.fillText('GO  ↻', (W - 0.2) / W * pw, 0.78 * ph); }
  for (const ck of chalk) {
    const x = slotX(ck.channel), y = sBot - (sBot - sTop) * ck.notch / (notches.length - 1);
    // ENGINE-FIX: the mark and its number stay inside this channel's column (left of the slot, the number above the left
    // tick); at x - 80 the number sat on the previous column's notch labels.
    cg.save(); cg.globalAlpha = 0.55; cg.strokeStyle = '#f4f4ec'; cg.fillStyle = '#f4f4ec'; cg.lineWidth = 3;
    cg.beginPath(); cg.moveTo(x - 48, y + 4); cg.lineTo(x - 14, y - 3); cg.stroke();
    cg.font = `${0.032 * ph}px ${FONTS.hand}`; cg.fillText(ck.text || '34', x - 31, y - 0.036 * ph, 0.05 / W * pw); cg.restore();
  }
  const face = mesh(new THREE.PlaneGeometry(W, H).translate(0, y0 + H / 2, cz + 0.001), new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.75 }));
  g.add(face);
  g.add(mergeInto([boxG(W + 0.08, 0.04, 0.05, 0, y0 + H + 0.02, cz, 0.006), boxG(W + 0.08, 0.04, 0.05, 0, y0 - 0.02, cz, 0.006), boxG(0.04, H, 0.05, -W / 2 - 0.02, y0 + H / 2, cz, 0.006), boxG(0.04, H, 0.05, W / 2 + 0.02, y0 + H / 2, cz, 0.006)], iron()));
  // levers
  const slotY0 = y0 + H * 0.18, slotY1 = y0 + H * 0.8;
  const leverGeo = mergeG([boxG(0.05, 0.07, 0.03, 0, 0, 0.015, 0.006), cylG(0.011, 0.011, 0.16, 10).rotateX(Math.PI / 2).translate(0, 0, 0.1), new THREE.SphereGeometry(0.03, 14, 10).translate(0, 0, 0.19)]);
  g.userData.levers = [];
  const levels = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const lv = mesh(leverGeo, M.tarnishedBrass({ amount: 0.3 }));
    lv.position.set(-W / 2 + 0.06 + 0.24 * (i + 0.5), slotY0, cz);
    g.add(lv); g.userData.levers.push(lv);
  }
  g.userData.setLevel = (i, v, frac = false) => {
    const k = frac ? v : v / (notches.length - 1);
    levels[i] = k; g.userData.levers[i].position.y = slotY0 + (slotY1 - slotY0) * k;
  };
  g.userData.levels = levels;
  if (master) {
    const wheel = grp('master');
    const wg = [new THREE.TorusGeometry(0.13, 0.014, 10, 36), cylG(0.03, 0.03, 0.05, 16).rotateX(Math.PI / 2)];
    for (let k = 0; k < 4; k++) wg.push(boxG(0.25, 0.016, 0.016, 0, 0, 0).rotateZ(k * Math.PI / 4));
    wg.push(cylG(0.012, 0.012, 0.08, 8).rotateX(Math.PI / 2).translate(0.12, 0, 0.05), new THREE.SphereGeometry(0.02, 10, 8).translate(0.12, 0, 0.09));
    wheel.add(mergeInto(wg, iron()));
    wheel.position.set(W / 2 - 0.2, y0 + H * 0.5, cz + 0.05);
    g.add(wheel);
    g.userData.master = wheel;
  }
  g.userData.slotY0 = slotY0; g.userData.slotY1 = slotY1;
  g.userData.channels = channels; g.userData.notches = notches;
  return g;
}

/**
 * Cue-light box (red standby + green go jewels in brass bezels), with an optional label plate under it.
 * Origin: centre-back (mount on a wall above a door); faces +Z. 0.24 × 0.13 m.
 * userData: { setState('off'|'red'|'green'|'both'), red, green }. Cost: 4–5 draw calls.
 */
export function cueLightBox({ label = null, state = 'off' } = {}) {
  const g = grp('cueLightBox');
  g.add(mesh(boxG(0.24, 0.13, 0.08, 0, 0, 0.04, 0.01), M.enamel('#141414', { roughness: 0.45 })));
  const jewel = new THREE.SphereGeometry(0.03, 8, 5, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2);
  const mats = {};
  for (const [k, col, x] of [['red', '#ff3a22', -0.055], ['green', '#3aff6a', 0.055]]) {
    mats[k] = glowGlass(col, { opacity: 1, intensity: 3, offColor: k === 'red' ? '#3a0c08' : '#0a3010', roughness: 0.15 });
    const j = mesh(jewel, mats[k], { cast: false }); j.position.set(x, 0, 0.085); g.add(j);
    g.userData[k] = j;
  }
  g.add(mergeInto([new THREE.TorusGeometry(0.032, 0.006, 8, 20).translate(-0.055, 0, 0.085), new THREE.TorusGeometry(0.032, 0.006, 8, 20).translate(0.055, 0, 0.085)], M.brass()));
  if (label) { const p = textPlate(label, 0.24, { style: 'brass', pw: 512, ph: 96 }); p.position.set(0, -0.1, 0.005); g.add(p); }
  const target = { red: 0, green: 0 }, level = { red: 0, green: 0 };
  g.userData.setState = (s, instant) => {
    target.red = s === 'red' || s === 'both' ? 1 : 0; target.green = s === 'green' || s === 'both' ? 1 : 0;
    if (instant) { for (const k of ['red', 'green']) { level[k] = target[k]; mats[k].userData.setLevel(level[k]); } }
  };
  g.userData.update = (dt) => { for (const k of ['red', 'green']) if (Math.abs(level[k] - target[k]) > 0.002) { level[k] = chase(level[k], target[k], dt, 10); mats[k].userData.setLevel(level[k]); } };
  g.userData.setState(state, true);
  return g;
}

/**
 * The cue-light panel: a mahogany console with N heavy brass GO buttons, ivory-engraved plates and a red + green
 * jewel above each. Origin: bottom centre of the console's base; faces +Z (the operator). ~0.9 × 0.3 m.
 * userData: { buttons[i] (plungers; press(i) animates one), setJewel(i, 'off'|'red'|'green'|'both'), red, green
 * (bulbSets), cover (dust sheet or null), setCovered(b), slope (Object3D on the sloped face) }. Cost: 7 draw calls.
 */
export function cueLightPanel({ labels = ['HOUSE', 'SOUND', 'FLY', 'LX', 'FX', 'WARDROBE'], covered = false } = {}) {
  const g = grp('cueLightPanel');
  const n = labels.length, W = 0.15 * n + 0.08, D = 0.3, h0 = 0.06, h1 = 0.16;
  // ENGINE-FIX: the profile's tall edge goes to the back. After rotateY(π/2) shape x = +D/2 lands at z = -D/2, so the
  // old profile (h1 at -D/2) put the tall edge toward the operator and buried the plungers (the finale mirrored its copy).
  const s = new THREE.Shape(); s.moveTo(-D / 2, 0); s.lineTo(D / 2, 0); s.lineTo(D / 2, h1); s.lineTo(-D / 2, h0); s.closePath();
  const body = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 }).rotateY(Math.PI / 2).translate(-W / 2, 0, 0);
  g.add(mesh(body, M.mahogany()));
  const ang = Math.atan2(h1 - h0, D);
  const slope = grp('slope');
  slope.position.set(0, (h0 + h1) / 2 + 0.007, 0); slope.rotation.x = -Math.PI / 2 + ang;
  g.add(slope);
  // plates (one atlas texture) + bezels + plungers
  const cw = 256, ch = 96, atlas = makeCanvas(cw * n, ch), ag = atlas.getContext('2d');
  labels.forEach((t, i) => ag.drawImage(labelPlate(t, { style: 'ivory', w: cw, h: ch, seed: 40 + i }).image, i * cw, 0));
  const plates = [], bezels = [], redP = [], greenP = [];
  g.userData.buttons = [];
  const plungerGeo = mergeG([cylG(0.03, 0.032, 0.03, 24, 0, 0.015, 0), new THREE.SphereGeometry(0.03, 20, 8, 0, TAU, 0, Math.PI / 2).scale(1, 0.35, 1).translate(0, 0.03, 0)]);
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.04 + 0.15 * (i + 0.5);
    const p = new THREE.PlaneGeometry(0.12, 0.045); const uv = p.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / n);
    plates.push(p.translate(x, -0.09, 0.001));
    bezels.push(new THREE.TorusGeometry(0.04, 0.008, 10, 28).translate(x, -0.02, 0.004), cylG(0.042, 0.042, 0.004, 24).rotateX(Math.PI / 2).translate(x, -0.02, 0.002));
    bezels.push(new THREE.TorusGeometry(0.016, 0.004, 6, 16).translate(x - 0.03, 0.075, 0.004), new THREE.TorusGeometry(0.016, 0.004, 6, 16).translate(x + 0.03, 0.075, 0.004));
    redP.push([x - 0.03, 0.075, 0.008]); greenP.push([x + 0.03, 0.075, 0.008]);
    const pl = mesh(plungerGeo, M.brass({ polished: true }));
    pl.rotation.x = Math.PI / 2; pl.position.set(x, -0.02, 0.004);
    slope.add(pl); g.userData.buttons.push(pl);
  }
  slope.add(mesh(mergeG(plates), new THREE.MeshStandardMaterial({ map: canvasTexture(atlas), roughness: 0.6 })));
  slope.add(mergeInto(bezels, M.tarnishedBrass({ amount: 0.3 })));
  const red = bulbSet(redP, { r: 0.014, color: '#ff3020', intensity: 3, offColor: '#3a0806', lit: 0, seg: 6 });
  const green = bulbSet(greenP, { r: 0.014, color: '#40ff70', intensity: 3, offColor: '#06300e', lit: 0, seg: 6 });
  slope.add(red, green);
  g.userData.red = red; g.userData.green = green;
  g.userData.setJewel = (i, st) => { red.userData.setBulb(i, st === 'red' || st === 'both' ? 1 : 0); green.userData.setBulb(i, st === 'green' || st === 'both' ? 1 : 0); };
  const press = new Array(n).fill(0);
  g.userData.press = (i) => { press[i] = 1; };
  g.userData.update = (dt) => {
    for (let i = 0; i < n; i++) if (press[i] > 0) { press[i] = Math.max(0, press[i] - dt * 3); g.userData.buttons[i].position.z = 0.004 - 0.018 * Math.sin(press[i] * Math.PI); }
  };
  const cover = dustSheet({ shape: 'box', w: W + 0.06, d: D + 0.06, h: h1 + 0.06, color: '#c8bca4', folds: 0.6, seed: 4, segA: 56, segS: 16 });
  cover.visible = covered;
  g.add(cover);
  g.userData.cover = cover;
  g.userData.setCovered = (b) => { cover.visible = b; };
  g.userData.slope = slope;
  return g;
}

/**
 * Stopwatch (Pike's): nickel case, white dial, crown and bow. Origin: centre of the back; dial faces +Z. ~6 cm.
 * userData: { hand (rotate .rotation.z) }. 3 draw calls.
 */
export function stopwatch() {
  const g = grp('stopwatch');
  g.add(mergeInto([cylG(0.028, 0.028, 0.012, 32).rotateX(Math.PI / 2).translate(0, 0, 0.006), cylG(0.005, 0.005, 0.01, 10, 0, 0.033, 0.006), new THREE.TorusGeometry(0.009, 0.0022, 6, 16).translate(0, 0.044, 0.006)], M.brass({ color: '#c8c4bc', roughness: 0.25 })));
  const dc = makeCanvas(128, 128), dg = dc.getContext('2d');
  dg.fillStyle = '#f2ede0'; dg.beginPath(); dg.arc(64, 64, 64, 0, TAU); dg.fill();
  dg.strokeStyle = '#1a1410';
  for (let i = 0; i < 60; i++) { const a = i / 60 * TAU; dg.lineWidth = i % 5 ? 1 : 2.5; dg.beginPath(); dg.moveTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56); dg.lineTo(64 + Math.cos(a) * (i % 5 ? 52 : 47), 64 + Math.sin(a) * (i % 5 ? 52 : 47)); dg.stroke(); }
  dg.fillStyle = '#1a1410'; dg.font = `16px ${FONTS.fell}`; dg.textAlign = 'center'; dg.fillText('60', 64, 30);
  g.add(at(mesh(new THREE.CircleGeometry(0.025, 32), new THREE.MeshStandardMaterial({ map: canvasTexture(dc), roughness: 0.3 })), 0, 0, 0.0125));
  const hand = mesh(boxG(0.0015, 0.022, 0.001, 0, 0.009, 0), M.matte('#1a1410'));
  hand.position.z = 0.0135; g.add(hand);
  g.userData.hand = hand;
  return g;
}

/**
 * Small table/desk lamp, three styles: 'green' (a banker's lamp with a green glass shade), 'brass' (a hinged brass
 * desk lamp with a cone shade), 'rose' (a turned lamp with a fringed rose silk shade). Origin: base centre.
 * userData: { setLit(0..1), bulbPos (local Vector3) }. The prop makes no light. Cost: 3–4 draw calls.
 */
export function tableLamp({ style = 'green', lit = 0 } = {}) {
  const g = grp('tableLamp');
  const glow = style === 'rose' ? '#ffb090' : style === 'green' ? '#ffe2a8' : '#ffd9a0';
  let shadeMat, bulbPos;
  if (style === 'green') {
    g.add(mergeInto([latheG([[0, 0], [0.09, 0], [0.09, 0.012], [0.05, 0.03], [0.012, 0.04], [0.012, 0.3], [0, 0.3]], 24), boxG(0.03, 0.015, 0.03, 0, 0.3, 0), cylG(0.004, 0.004, 0.25, 6, 0, 0.32, 0).rotateZ(Math.PI / 2)], M.brass()));
    shadeMat = new THREE.MeshPhysicalMaterial({ color: '#103a22', roughness: 0.15, clearcoat: 1, emissive: '#1e6a3a', emissiveIntensity: 0, side: THREE.DoubleSide });
    const shadeGeo = mergeG([
      new THREE.CylinderGeometry(0.06, 0.06, 0.26, 24, 1, true, -Math.PI / 2, Math.PI),
      new THREE.CircleGeometry(0.06, 12, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).translate(0, 0.13, 0),
      new THREE.CircleGeometry(0.06, 12, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, -0.13, 0),
    ]).rotateZ(Math.PI / 2).scale(1, 1, 1.15).translate(0, 0.34, 0);
    const shade = mesh(shadeGeo, shadeMat);
    g.add(shade);
    g.add(mesh(new THREE.CylinderGeometry(0.0605, 0.0605, 0.262, 24, 1, true, -Math.PI / 2 + Math.PI, Math.PI).rotateZ(Math.PI / 2).scale(1, 1, 1.15).translate(0, 0.34, 0), new THREE.MeshStandardMaterial({ color: '#f0e8d0', roughness: 0.5, side: THREE.BackSide })));
    bulbPos = new THREE.Vector3(0, 0.32, 0);
  } else if (style === 'brass') {
    g.add(mergeInto([latheG([[0, 0], [0.08, 0], [0.08, 0.015], [0.03, 0.03], [0, 0.03]], 24), cylG(0.008, 0.008, 0.28, 8, 0, 0.16, 0).rotateZ(0.25), cylG(0.007, 0.007, 0.22, 8, 0, 0, 0).rotateZ(-1.1).translate(0.1, 0.33, 0)], M.tarnishedBrass({ amount: 0.4 })));
    shadeMat = M.tarnishedBrass({ amount: 0.4, unique: true }); shadeMat.side = THREE.DoubleSide;
    const sh = mesh(latheG([[0.075, 0], [0.06, 0.04], [0.03, 0.09], [0.012, 0.1]], 24, true), shadeMat);
    sh.position.set(0.2, 0.36, 0); sh.rotation.z = 0.6; g.add(sh);
    bulbPos = new THREE.Vector3(0.2, 0.34, 0);
  } else {
    g.add(mesh(latheG([[0, 0], [0.08, 0], [0.08, 0.02], [0.04, 0.04], [0.035, 0.1], [0.06, 0.16], [0.04, 0.24], [0.015, 0.27], [0.01, 0.34], [0, 0.34]], 24), M.porcelain('#e8d8c8')));
    shadeMat = new THREE.MeshStandardMaterial({ color: '#c87a78', roughness: 0.9, emissive: '#ff9a80', emissiveIntensity: 0, side: THREE.DoubleSide, map: clothTexture({ tint: '#ffffff', seed: 3 }) });
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.18, 32, 1, true).translate(0, 0.38, 0), shadeMat));
    const fr = []; for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; fr.push(boxG(0.006, 0.04, 0.003, Math.cos(a) * 0.172, 0.27, Math.sin(a) * 0.172, 0.001).rotateY(0)); }
    g.add(mergeInto(fr, M.matte('#d8a060')));
    bulbPos = new THREE.Vector3(0, 0.36, 0);
  }
  const bulbs = bulbSet([[bulbPos.x, bulbPos.y - 0.02, bulbPos.z]], { r: 0.022, color: glow, intensity: 2.2, lit: 0 });
  g.add(bulbs);
  let level = 0, target = lit;
  const apply = () => { bulbs.userData.setAll(level); if (shadeMat.emissiveIntensity !== undefined && style !== 'brass') shadeMat.emissiveIntensity = level * (style === 'green' ? 0.22 : 0.9); };
  g.userData.update = (dt) => { if (Math.abs(level - target) > 0.001) { level = chase(level, target, dt, 6); apply(); } };
  g.userData.setLit = (t, instant) => { target = +t; if (instant) { level = target; apply(); } };
  level = lit; apply();
  g.userData.bulbPos = bulbPos;
  return g;
}

/**
 * The prompt desk: a tall sloped desk on four legs with a book ledge, a shelf, a green-shaded lamp on a gooseneck
 * and Pike's stopwatch. Origin: base centre on the floor; the operator stands at +Z.
 * userData: { slope (Object3D on the writing slope, +Z = its normal: pin pages there), lamp (tableLamp-like with
 * setLit), stopwatch, panelMount (Object3D on the top board for the cue-light panel), topY }. Cost: ~8 draw calls.
 */
export function promptDesk({ w = 0.9, h = 1.15, d = 0.6, lamp = true, lit = 0, withStopwatch = true, panel = false } = {}) {
  const g = grp('promptDesk');
  const wood = M.walnut({ tint: '#4a3020' });
  const legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) legs.push(boxG(0.05, h - 0.1, 0.05, sx * (w / 2 - 0.04), (h - 0.1) / 2, sz * (d / 2 - 0.04), 0.006));
  for (const sx of [-1, 1]) legs.push(boxG(0.03, 0.04, d - 0.1, sx * (w / 2 - 0.04), 0.15, 0, 0.004));
  legs.push(boxG(w - 0.1, 0.03, d - 0.1, 0, 0.35, 0, 0.004)); // shelf
  // carcass with sloped lid: front low (+Z), back high
  const s = new THREE.Shape(); const f = 0.1, b = 0.24;
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(d / 2, f); s.lineTo(-d / 2, b); s.closePath();
  const carc = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }).rotateY(Math.PI / 2).translate(-w / 2, h - 0.12, 0);
  legs.push(carc);
  legs.push(boxG(w + 0.02, 0.03, 0.025, 0, h - 0.12 + f + 0.02, d / 2 + 0.01, 0.004)); // book ledge
  legs.push(boxG(w + 0.04, 0.025, 0.12, 0, h - 0.12 + b + 0.012, -d / 2 + 0.04, 0.004)); // top board
  g.add(mergeInto(legs, wood));
  const ang = Math.atan2(b - f, d);
  const slope = grp('slope'); slope.position.set(0, h - 0.12 + (f + b) / 2 + 0.009, 0); slope.rotation.x = -Math.PI / 2 + ang;
  g.add(slope);
  // a worn leather writing panel on the slope
  const leatherPanel = mesh(new THREE.PlaneGeometry(w - 0.12, d * 0.8), M.leather('#2a3a2a'));
  leatherPanel.position.z = 0.0005; slope.add(leatherPanel);
  const topY = h - 0.12 + b + 0.025;
  const panelMount = grp('panelMount'); panelMount.position.set(0, topY, -d / 2 + 0.04); g.add(panelMount);
  if (lamp) {
    const L = grp('promptLamp');
    L.add(mergeInto([cylG(0.03, 0.035, 0.03, 16, 0, 0.015, 0), tubeG([[0, 0.03, 0], [0, 0.18, 0.02], [0.04, 0.3, 0.12], [0.06, 0.32, 0.24]], 0.007, { radial: 6, seg: 20 })], M.brass({ color: '#8a6a30' })));
    const shadeMat = M.enamel('#1f4a30', { unique: true }); shadeMat.side = THREE.DoubleSide;
    const sh = mesh(latheG([[0.1, 0], [0.085, 0.03], [0.05, 0.07], [0.02, 0.09], [0.012, 0.1]], 24), shadeMat);
    sh.position.set(0.06, 0.24, 0.26); sh.rotation.x = 0.7;
    const inner = mesh(latheG([[0.098, 0.002], [0.083, 0.03], [0.048, 0.068]], 24), new THREE.MeshStandardMaterial({ color: '#f0ece0', side: THREE.BackSide, roughness: 0.6, emissive: '#fff0d0', emissiveIntensity: 0 }));
    sh.add(inner); L.add(sh);
    const bulbs = bulbSet([[0.06, 0.22, 0.28]], { r: 0.02, lit: 0 }); L.add(bulbs);
    let level = 0, target = lit;
    const apply = () => { bulbs.userData.setAll(level); inner.material.emissiveIntensity = level * 0.8; };
    L.userData.update = (dt) => { if (Math.abs(level - target) > 0.001) { level = chase(level, target, dt, 6); apply(); } };
    L.userData.setLit = (t, instant) => { target = +t; if (instant) { level = target; apply(); } };
    level = lit; apply();
    L.userData.bulbPos = new THREE.Vector3(0.06, 0.22, 0.28);
    L.position.set(w / 2 - 0.1, topY, -d / 2 + 0.05); L.rotation.y = 0.25;
    g.add(L); g.userData.lamp = L;
  }
  if (withStopwatch) {
    const sw = stopwatch(); sw.position.set(w / 2 - 0.12, 0.05, 0.001); sw.rotation.z = 0.2;
    slope.add(sw); g.userData.stopwatch = sw;
  }
  if (panel) { const p = cueLightPanel(); panelMount.add(p); g.userData.panel = p; }
  g.userData.slope = slope; g.userData.panelMount = panelMount; g.userData.topY = topY;
  return g;
}

/** A ceramic fuse carrier with brass blades, a coloured dot and coloured end bands (POLISH). Origin: centre. ~8 cm. 4 draw calls. */
export function fuse({ color = '#c8302a' } = {}) {
  const g = grp('fuse');
  g.add(mesh(boxG(0.04, 0.085, 0.035, 0, 0, 0, 0.008), M.porcelain('#efe9dc')));
  g.add(mergeInto([boxG(0.012, 0.025, 0.003, 0, 0.05, 0), boxG(0.012, 0.025, 0.003, 0, -0.05, 0)], M.brass()));
  g.add(at(mesh(new THREE.CircleGeometry(0.009, 16), M.enamel(color)), 0, 0, 0.0181));
  // POLISH: a coloured band round each end, so a fuse seated end-on in its carrier still shows its colour
  g.add(mergeInto([boxG(0.043, 0.01, 0.038, 0, 0.034, 0, 0.004), boxG(0.043, 0.01, 0.038, 0, -0.034, 0, 0.004)], M.enamel(color)));
  return g;
}

/**
 * Mains switch-fuse: a black iron box with labelled fuse carrier slots (R Y B) on its face and a big side handle.
 * Origin: centre-back (wall mounted); faces +Z. ~0.42 × 0.55 m.
 * userData: { handle (pivot: rotation.x; 0 = OFF/up, -π/2 = ON/down), setOn(b), slots[i] (Vector3, local), tag }.
 * Cost: 6 draw calls.
 */
export function switchFuse({ slots = [['R', '#c8302a'], ['Y', '#e0b830'], ['B', '#3060c0']], tagText = null } = {}) {
  const g = grp('switchFuse');
  const W = 0.42, H = 0.55, D = 0.2;
  g.add(mesh(boxG(W, H, D, 0, 0, D / 2, 0.02), M.enamel('#161514', { roughness: 0.55 })));
  g.add(mergeInto([boxG(W - 0.06, H - 0.06, 0.012, 0, 0, D + 0.006, 0.006), boxG(0.05, 0.12, 0.04, W / 2 + 0.02, 0.05, D * 0.55, 0.006)], M.iron({ color: '#2a2826' })));
  const plate = textPlate('MAINS', 0.18, { style: 'brass', pw: 512, ph: 128 }); plate.position.set(0, H / 2 - 0.06, D + 0.013); g.add(plate);
  const sp = [], cups = [];
  slots.forEach(([lbl, col], i) => {
    const x = (i - (slots.length - 1) / 2) * 0.11, y = -0.04;
    cups.push(boxG(0.06, 0.12, 0.02, x, y, D + 0.016, 0.006));
    const lab = textPlate(lbl, 0.05, { style: 'enamel', bg: col, fg: '#f4f0e6', pw: 128, ph: 96 }); lab.position.set(x, y - 0.1, D + 0.013); g.add(lab);
    sp.push(new THREE.Vector3(x, y, D + 0.04));
  });
  g.add(mergeInto(cups, M.porcelain('#2a2826')));
  const handle = grp('handle');
  handle.position.set(W / 2 + 0.05, 0.05, D * 0.55);
  handle.add(mergeInto([boxG(0.03, 0.03, 0.03), boxG(0.025, 0.3, 0.025, 0.02, 0.15, 0, 0.004)], M.iron({ color: '#3a3836' })));
  handle.add(at(mesh(cylG(0.022, 0.022, 0.12, 14).rotateZ(Math.PI / 2), M.bakelite('#3a1a12')), 0.07, 0.3, 0));
  g.add(handle);
  if (tagText) {
    const tag = textPlate(tagText, 0.12, { style: 'card', pw: 384, ph: 256 });
    tag.position.set(W / 2 + 0.12, -0.05, D * 0.55); tag.rotation.y = 0.3; g.add(tag); g.userData.tag = tag;
  }
  g.userData.handle = handle; g.userData.slots = sp;
  g.userData.setOn = (b) => { handle.rotation.x = b ? -Math.PI / 2 : 0; };
  return g;
}

// =====================================================================================================
// STAGE FLOOR & WINGS: trapdoor, crate, skip, props table, props shelf, buckets, spiral stair
// =====================================================================================================

/**
 * Stage trapdoor: a flush leaf in an iron-edged frame, hinged on its -Z edge, with a recessed ring pull and straps.
 * Origin: centre of the opening at floor level (y = 0 is the stage surface). sign: add the TRAP flip sign.
 * userData: { leaf (pivot: rotation.x, negative opens upward), setOpen(0..1), sign, signCard (pivot: rotation.x) }.
 * Cost: 4 draw calls (+2 sign).
 */
export function trapdoor({ w = 1.2, d = 0.9, sign = true, floorTexture = null, signText = 'TRAP\nKEEP CLEAR' } = {}) {
  const g = grp('trapdoor');
  g.add(mergeInto([boxG(w + 0.04, 0.01, 0.025, 0, -0.004, d / 2 + 0.012), boxG(w + 0.04, 0.01, 0.025, 0, -0.004, -d / 2 - 0.012), boxG(0.025, 0.01, d, -w / 2 - 0.012, -0.004, 0), boxG(0.025, 0.01, d, w / 2 + 0.012, -0.004, 0)], M.iron({ color: '#3a3836' })));
  g.add(mesh(new THREE.BoxGeometry(w, 0.6, d).translate(0, -0.31, 0), new THREE.MeshStandardMaterial({ color: '#050404', side: THREE.BackSide })));
  const leaf = grp('leaf'); leaf.position.set(0, 0, -d / 2); g.add(leaf);
  const tex = floorTexture || scuffedFloorTexture({ planks: 6, size: 512, seed: 9 });
  leaf.add(mesh(boxG(w - 0.01, 0.04, d - 0.01, 0, -0.02, d / 2, 0.003), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })));
  leaf.add(mergeInto([boxG(w * 0.9, 0.004, 0.05, 0, 0.001, 0.12), boxG(w * 0.9, 0.004, 0.05, 0, 0.001, d - 0.12), cylG(0.015, 0.015, 0.1, 10, -w * 0.3, 0, 0.0).rotateZ(Math.PI / 2), cylG(0.015, 0.015, 0.1, 10, w * 0.3, 0, 0).rotateZ(Math.PI / 2)], M.iron({ color: '#2a2826' })));
  leaf.add(mesh(new THREE.TorusGeometry(0.035, 0.005, 8, 20).rotateX(Math.PI / 2).translate(0, 0.002, d - 0.08), M.brass()));
  g.userData.leaf = leaf;
  g.userData.setOpen = (t) => { leaf.rotation.x = -t * 1.75; };
  if (sign) {
    const sg = grp('trapSign');
    const legs = []; for (const s of [-1, 1]) legs.push(boxG(0.03, 0.62, 0.02, s * 0.14, 0.3, 0.08).rotateX(0), boxG(0.03, 0.62, 0.02, s * 0.14, 0.3, -0.08));
    const fr = mergeInto(legs.map((geo, i) => geo.rotateX(i % 2 ? 0.25 : -0.25)), M.dustyWood()); sg.add(fr);
    const card = grp('signCard'); card.position.set(0, 0.58, 0.03);
    const face = textPlate(signText, 0.3, { style: 'enamel', bg: '#e8dfc8', fg: '#a3201c', pw: 512, ph: 384 });
    face.position.y = -0.13; face.rotation.x = -0.25; card.add(face);
    const backFace = textPlate('CLEAR', 0.3, { style: 'enamel', bg: '#1f3d2c', fg: '#e8dfc8', pw: 512, ph: 384 });
    backFace.rotation.y = Math.PI; backFace.position.set(0, -0.13, -0.004); backFace.rotation.x = 0.25; card.add(backFace);
    sg.add(card);
    sg.position.set(w / 2 + 0.35, 0, d / 2 + 0.2);
    g.add(sg); g.userData.sign = sg; g.userData.signCard = card;
  }
  return g;
}

let wickerTex = null;
function wickerTexture() {
  if (wickerTex) return wickerTex;
  const s = 256, c = makeCanvas(s, s), g = c.getContext('2d');
  g.fillStyle = '#6a5030'; g.fillRect(0, 0, s, s);
  const cell = 16;
  for (let y = 0; y < s; y += cell) for (let x = 0; x < s; x += cell) {
    const over = ((x + y) / cell) % 2 === 0;
    const gr = over ? g.createLinearGradient(x, y, x + cell, y) : g.createLinearGradient(x, y, x, y + cell);
    gr.addColorStop(0, '#8a6a3a'); gr.addColorStop(0.5, '#c8a468'); gr.addColorStop(1, '#8a6a3a');
    g.fillStyle = gr; g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
  }
  wickerTex = canvasTexture(c, { repeat: [1, 1] });
  return wickerTex;
}

/**
 * Slatted wooden crate with corner posts and a stencil. Origin: base centre. userData: { lid }. 2–3 draw calls.
 */
export function crate({ w = 0.7, h = 0.55, d = 0.5, stencil = 'EMPRESS THEATRE\nTHIS WAY UP', lid = true, seed = 1 } = {}) {
  const g = grp('crate');
  const geos = [], r = rng(seed), slats = 4, sh = (h - 0.04) / slats;
  for (let i = 0; i < slats; i++) {
    const y = 0.02 + sh * (i + 0.5);
    geos.push(boxG(w, sh - 0.02, 0.02, 0, y, d / 2 - 0.01), boxG(w, sh - 0.02, 0.02, 0, y, -d / 2 + 0.01), boxG(0.02, sh - 0.02, d - 0.04, -w / 2 + 0.01, y, 0), boxG(0.02, sh - 0.02, d - 0.04, w / 2 - 0.01, y, 0));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) geos.push(boxG(0.045, h, 0.045, sx * (w / 2 - 0.0), h / 2, sz * (d / 2 - 0.0), 0.004));
  geos.push(boxG(w - 0.02, 0.02, d - 0.02, 0, 0.01, 0));
  g.add(mergeInto(geos, M.dustyWood({ tint: '#a48c6a' })));
  if (lid) {
    const L = grp('lid'); L.position.set(0, h, -d / 2);
    const lg = []; for (let i = 0; i < 5; i++) lg.push(boxG(w + 0.02, 0.02, d / 5 - 0.012, 0, 0.01, d / 10 + i * d / 5 + (r() - 0.5) * 0.004));
    L.add(mergeInto(lg, M.dustyWood({ tint: '#a48c6a' })));
    g.add(L); g.userData.lid = L;
  }
  if (stencil) {
    const c = makeCanvas(512, 256), cg = c.getContext('2d');
    const lines = stencil.split('\n');
    cg.fillStyle = 'rgba(20,16,12,0.85)'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
    // auto-fit: the widest line fills ~92% of the plate, capped by the line count
    cg.font = `64px ${FONTS.typed}`;
    const widest = Math.max(...lines.map((l) => cg.measureText(l).width));
    const px = Math.min(64 * (512 * 0.92) / widest, 220 / lines.length);
    cg.font = `${px}px ${FONTS.typed}`;
    lines.forEach((l, i, a) => cg.fillText(l, 256, 128 + (i - (a.length - 1) / 2) * px * 1.15));
    const st = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, w * 0.4), new THREE.MeshStandardMaterial({ map: canvasTexture(c), transparent: true, roughness: 0.9, depthWrite: false }));
    st.position.set(0, h * 0.5, d / 2 + 0.002); g.add(st);
  }
  return g;
}

/**
 * Wicker costume skip (hamper) with a hinged lid, leather straps, rope handles and a painted label.
 * Origin: base centre. userData: { lid (pivot at the back edge: rotation.x negative opens) }. 5 draw calls.
 */
export function skip({ w = 0.9, h = 0.5, d = 0.55, label = 'WARDROBE' } = {}) {
  const g = grp('skip');
  const wm = new THREE.MeshStandardMaterial({ map: wickerTexture(), roughness: 0.9, bumpMap: wickerTexture(), bumpScale: 1.5 });
  g.add(mesh(boxG(w, h, d, 0, h / 2, 0, 0.03), wm));
  const L = grp('lid'); L.position.set(0, h, -d / 2);
  L.add(mesh(boxG(w + 0.02, 0.06, d + 0.02, 0, 0.03, d / 2, 0.025), wm));
  g.add(L);
  const lea = M.leather('#4a2a16');
  g.add(mergeInto([-0.3, 0.3].flatMap((f) => [boxG(0.05, h + 0.005, 0.006, f * w, h / 2, d / 2 + 0.003), boxG(0.05, 0.006, d + 0.01, f * w, 0.003, 0)]), lea));
  L.add(mergeInto([-0.3, 0.3].map((f) => boxG(0.05, 0.006, d + 0.03, f * w, 0.063, d / 2)), lea));
  g.add(mergeInto([-0.3, 0.3].map((f) => boxG(0.06, 0.05, 0.008, f * w, h - 0.06, d / 2 + 0.008, 0.003)), M.brass()));
  g.add(mergeInto([-1, 1].map((s) => new THREE.TorusGeometry(0.05, 0.01, 6, 14, Math.PI).rotateY(Math.PI / 2).translate(s * (w / 2 + 0.01), h * 0.7, 0)), ropeMat()));
  if (label) { const p = textPlate(label, 0.24, { style: 'card', pw: 512, ph: 160 }); p.position.set(0, h * 0.45, d / 2 + 0.012); g.add(p); }
  g.userData.lid = L;
  return g;
}

/**
 * Props table: a trestle table with white-tape outlines (and pencilled labels) of where each prop lives.
 * outlines: [{ shape: 'rect'|'circle', x, z (m from the top centre), w, d, label }]. Origin: base centre.
 * userData: { topY, top (Mesh) }. 3 draw calls.
 */
export function propsTable({ w = 1.8, d = 0.7, h = 0.82, outlines = [{ shape: 'circle', x: -0.55, z: 0, w: 0.16, label: 'CUP' }, { shape: 'rect', x: -0.15, z: 0.05, w: 0.3, d: 0.22, label: 'LETTER' }, { shape: 'rect', x: 0.35, z: -0.05, w: 0.2, d: 0.35, label: 'LAMP' }, { shape: 'circle', x: 0.7, z: 0.1, w: 0.12, label: 'PIPE' }] } = {}) {
  const g = grp('propsTable');
  const legs = [];
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - 0.2);
    legs.push(boxG(0.05, h - 0.04, 0.05, x, (h - 0.04) / 2, 0, 0.005).rotateX(0));
    for (const t of [-1, 1]) legs.push(boxG(0.045, (h - 0.04) * 1.04, 0.045, 0, 0, 0, 0.004).rotateX(t * 0.32).translate(x, (h - 0.04) / 2, 0));
    legs.push(boxG(0.05, 0.05, d * 0.85, x, h - 0.065, 0, 0.004));
  }
  legs.push(boxG(w - 0.4, 0.04, 0.03, 0, 0.25, 0, 0.004));
  g.add(mergeInto(legs, M.dustyWood()));
  const pw = 1024, ph = Math.round(1024 * d / w), c = makeCanvas(pw, ph), cg = c.getContext('2d');
  cg.drawImage(scuffedFloorTexture({ tint: '#5a4a38', planks: 3, scuffs: 0.3, paint: 0.2, tape: [], size: 512, seed: 2 }).image, 0, 0, pw, ph);
  cg.strokeStyle = 'rgba(240,238,228,0.92)'; cg.lineWidth = 10; cg.fillStyle = 'rgba(70,70,78,0.9)';
  cg.font = `${ph * 0.07}px ${FONTS.hand}`; cg.textAlign = 'center';
  for (const o of outlines) {
    const x = (o.x / w + 0.5) * pw, y = (o.z / d + 0.5) * ph;
    if (o.shape === 'circle') { cg.beginPath(); cg.arc(x, y, o.w / 2 / w * pw, 0, TAU); cg.stroke(); }
    else cg.strokeRect(x - o.w / 2 / w * pw, y - o.d / 2 / d * ph, o.w / w * pw, o.d / d * ph);
    if (o.label) cg.fillText(o.label, x, y + ((o.d || o.w) / 2 / d * ph) + ph * 0.09);
  }
  const top = mesh(boxG(w, 0.035, d, 0, h - 0.0175, 0, 0.004), [M.dustyWood(), M.dustyWood(), new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.85 }), M.dustyWood(), M.dustyWood(), M.dustyWood()]);
  top.geometry = new THREE.BoxGeometry(w, 0.035, d).translate(0, h - 0.0175, 0);
  g.add(top);
  g.userData.top = top; g.userData.topY = h;
  return g;
}

/**
 * Open timber props shelving: uprights, shelves with a lip, a plank back, card labels on the shelf edges.
 * labels: one string per shelf (bottom → top) or null. Origin: base centre; faces +Z.
 * userData: { shelfY[] (top surface heights), w, d }. 2–3 draw calls.
 */
export function propsShelf({ w = 1.8, h = 2.3, d = 0.45, shelves = 5, labels = null, back = true } = {}) {
  const g = grp('propsShelf');
  const geos = [];
  for (const s of [-1, 0.33, -0.33, 1].slice(0, w > 1.2 ? 4 : 2)) for (const z of [-1, 1]) geos.push(boxG(0.05, h, 0.05, s * (w / 2 - 0.025), h / 2, z * (d / 2 - 0.025), 0.004));
  const ys = [];
  for (let i = 0; i < shelves; i++) {
    const y = 0.12 + i * (h - 0.2) / (shelves - 1);
    geos.push(boxG(w, 0.03, d, 0, y, 0, 0.004), boxG(w, 0.05, 0.02, 0, y + 0.015, d / 2 - 0.01, 0.003));
    ys.push(y + 0.015);
  }
  g.add(mergeInto(geos, M.dustyWood()));
  if (back) g.add(mesh(boxG(w - 0.02, h - 0.05, 0.012, 0, h / 2, -d / 2 + 0.006, 0.002), M.wood({ tint: '#5a4a38', planks: 0, seed: 4, roughness: 0.9 })));
  if (labels) {
    labels.forEach((t, i) => { if (!t) return; const p = textPlate(t, 0.2, { style: 'card', pw: 384, ph: 128, seed: 3 + i }); p.position.set(-w / 2 + 0.25, ys[i] + 0.005, d / 2 + 0.002); g.add(p); });
  }
  g.userData.shelfY = ys; g.userData.w = w; g.userData.d = d;
  return g;
}

/**
 * Bucket: style 'fire' (red, FIRE in white, sand) or 'galvanised' (zinc, water or empty). On a wall hook if hook.
 * Origin: base centre on the floor. userData: { fill (sand/water Mesh), bail }. 3–4 draw calls.
 */
export function bucket({ style = 'fire', fill = style === 'fire' ? 'sand' : 'water', hook = false } = {}) {
  const g = grp('bucket');
  const prof = [[0, 0.004], [0.1, 0], [0.105, 0.005], [0.14, 0.27], [0.15, 0.275], [0.146, 0.28], [0.134, 0.275], [0.096, 0.012], [0, 0.012]];
  const bm = style === 'fire' ? M.enamel('#a8201a', { roughness: 0.4 }) : M.iron({ color: '#9a9c98', roughness: 0.45 });
  g.add(mesh(latheG(prof, 32), bm));
  if (style === 'fire') {
    const c = makeCanvas(512, 128), cg = c.getContext('2d');
    cg.fillStyle = '#f4efe2'; cg.font = `bold 92px ${FONTS.ui}`; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.fillText('FIRE', 256, 68);
    const lbl = new THREE.Mesh(new THREE.CylinderGeometry(0.1305, 0.1265, 0.08, 32, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: canvasTexture(c), transparent: true, depthWrite: false, roughness: 0.4 }));
    lbl.position.y = 0.17; g.add(lbl);
  }
  if (fill) {
    const fm = fill === 'sand' ? new THREE.MeshStandardMaterial({ color: '#b8a074', roughness: 1, bumpMap: clothTexture({ tint: '#808080', seed: 9 }), bumpScale: 2 })
      : new THREE.MeshPhysicalMaterial({ color: '#2a3430', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 });
    const f = mesh(new THREE.CircleGeometry(fill === 'sand' ? 0.132 : 0.125, 32).rotateX(-Math.PI / 2), fm, { cast: false });
    f.position.y = fill === 'sand' ? 0.24 : 0.18; g.add(f); g.userData.fill = f;
  }
  const bail = mesh(new THREE.TorusGeometry(0.15, 0.004, 6, 24, Math.PI).translate(0, 0.28, 0).rotateY(0.4), M.iron({ color: '#5a5a58' }));
  g.add(bail); g.userData.bail = bail;
  if (hook) g.add(mergeInto([boxG(0.05, 0.08, 0.01, 0, 0.42, -0.15), tubeG([[0, 0.4, -0.15], [0, 0.4, -0.12], [0, 0.35, -0.1]], 0.006)], iron()));
  return g;
}
/** A red sand fire bucket (see bucket). */
export const fireBucket = (o = {}) => bucket({ style: 'fire', ...o });

/**
 * Iron spiral stair: a central column, cast-iron treads (instanced), a baluster per tread and a helical handrail.
 * Origin: column foot on the floor; the first tread starts at angle `start` (radians from +X, counter-clockwise
 * seen from above) and climbs `turns`. userData: { topY, treadAngle(i), treads (InstancedMesh) }. 4 draw calls.
 */
export function spiralStair({ h = 3.2, r = 0.85, steps = 16, turns = 0.95, start = 0, rail = true } = {}) {
  const g = grp('spiralStair');
  const rise = h / (steps + 1), sweep = turns * TAU / steps;
  g.add(mesh(cylG(0.06, 0.06, h + 1.0, 16, 0, (h + 1.0) / 2, 0), iron()));
  const s = new THREE.Shape();
  s.moveTo(0.05, 0); s.absarc(0, 0, r, 0, sweep * 1.08, false); s.lineTo(Math.cos(sweep * 1.08) * 0.05, Math.sin(sweep * 1.08) * 0.05); s.closePath();
  const tread = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 6 }).rotateX(-Math.PI / 2);
  const list = [], bal = [];
  for (let i = 0; i < steps; i++) {
    const a = start + i * sweep, y = rise * (i + 1);
    list.push({ p: [0, y, 0], r: [0, a, 0] });
    const ba = a + sweep * 0.5;
    bal.push({ p: [Math.cos(ba) * (r - 0.04), y + 0.45, -Math.sin(ba) * (r - 0.04)] });
  }
  // rotateX(-π/2) maps shape Y to -Z, so angle a in shape space lands at -a around Y; rotate by +a to match
  g.add(instances(tread, iron(), list));
  if (rail) {
    g.add(instances(cylG(0.009, 0.009, 0.9, 6), iron(), bal));
    const pts = []; for (let i = 0; i <= steps * 4; i++) { const t = i / 4, a = start + t * sweep + sweep * 0.5; pts.push([Math.cos(a) * (r - 0.04), rise * (t + 1) + 0.9, -Math.sin(a) * (r - 0.04)]); }
    g.add(mesh(tubeG(pts, 0.022, { radial: 8, seg: steps * 8 }), M.wood({ tint: '#3a2416', roughness: 0.4 })));
  }
  g.userData.topY = rise * (steps + 1);
  g.userData.treadAngle = (i) => start + i * sweep;
  return g;
}

// =====================================================================================================
// THE LIGHTHOUSE TRUCK and the beehive lamp
// =====================================================================================================

function lighthouseSkin({ bands = 5, door = true } = {}) {
  const w = 1024, h = 1024, c = makeCanvas(w, h), g = c.getContext('2d');
  g.drawImage(stripeTexture({ colors: ['#ece4d2', '#a82a22'], count: bands * 2 - 1, dir: 'h', seed: 3, age: 0.5, size: 256 }).image, 0, 0, w, h);
  // painted brushwork + seams between the eight faces (the canvas is stretched on a frame)
  g.globalAlpha = 0.12; for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() < 0.5 ? '#fff' : '#000'; g.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 3); } g.globalAlpha = 1;
  for (let k = 0; k <= 8; k++) { g.fillStyle = 'rgba(30,20,10,0.35)'; g.fillRect(k * w / 8 - 2, 0, 4, h); }
  const face = w / 8;
  if (door) {
    // the painted door on face 0 (u in [0, 1/8]), arched, planked, iron studs
    const dx = face * 0.2, dw = face * 0.6, dy = h * 0.62, dh = h * 0.36;
    g.fillStyle = '#3a2416'; g.beginPath(); g.moveTo(dx, h - 4); g.lineTo(dx, dy + dw / 2); g.arc(dx + dw / 2, dy + dw / 2, dw / 2, Math.PI, 0); g.lineTo(dx + dw, h - 4); g.fill();
    g.strokeStyle = '#1a100a'; g.lineWidth = 4; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(dx + dw * i / 4, dy + 10); g.lineTo(dx + dw * i / 4, h); g.stroke(); }
    g.fillStyle = '#8a8a88'; for (const y of [dy + dh * 0.35, dy + dh * 0.75]) g.fillRect(dx + 4, y, dw - 8, 8);
    g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(dx + dw * 0.8, dy + dh * 0.55, 6, 0, TAU); g.fill();
  }
  // small windows on alternate faces
  for (const [k, v] of [[3, 0.35], [5, 0.5], [1, 0.2], [6, 0.15]]) {
    const x = k * face + face * 0.35;
    g.fillStyle = '#1a2030'; g.fillRect(x, h * v, face * 0.3, h * 0.07);
    g.strokeStyle = '#efe8d8'; g.lineWidth = 6; g.strokeRect(x, h * v, face * 0.3, h * 0.07);
  }
  return canvasTexture(c);
}

/**
 * The lighthouse truck (the play's set piece): a squat octagonal canvas lighthouse (red and white bands, a painted
 * door on the +Z face) on a wheeled timber platform with castors, a brass turn handle, a brake pedal and a stencil;
 * a gallery deck and rail, a glazed lantern room with a practical lamp housing, a ladder up the back.
 * Origin: platform centre on the floor; the door faces +Z. ~3.4 m tall, platform 1.5 m square.
 * userData: { lampMount (Object3D in the lantern: put beehiveLamp() there), setLamp(0..1), setBeam(on, speed),
 * brake (pivot, rotation.x), setBrake(b), turnHandle, door (the door frame mesh, +Z), lampPos (Vector3 local),
 * stencil }. The prop makes no light. Cost: ~12 draw calls.
 */
export function lighthouseTruck({ h = 3.4, stencil = 'LIGHTHOUSE — BLUE SPIKE — DOOR TO PROMPT SIDE', beam = true } = {}) {
  const g = grp('lighthouseTruck');
  const ph = 0.2, towerH = h - ph - 0.95, rB = 0.66, rT = 0.46;
  // platform
  g.add(mesh(boxG(1.5, 0.12, 1.5, 0, ph - 0.06, 0, 0.01), M.dustyWood({ tint: '#6a5a46' })));
  g.add(mergeInto([boxG(1.52, 0.06, 0.04, 0, ph - 0.09, 0.75), boxG(1.52, 0.06, 0.04, 0, ph - 0.09, -0.75), boxG(0.04, 0.06, 1.5, 0.75, ph - 0.09, 0), boxG(0.04, 0.06, 1.5, -0.75, ph - 0.09, 0)], M.dustyWood({ tint: '#4a3a2a' })));
  const cast = [];
  for (const [x, z] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62], [0, -0.62], [0, 0.62]]) {
    cast.push(boxG(0.08, 0.012, 0.08, x, 0.075, z), cylG(0.006, 0.006, 0.04, 6, x, 0.055, z), boxG(0.05, 0.03, 0.012, x, 0.04, z + 0.02), boxG(0.05, 0.03, 0.012, x, 0.04, z - 0.02));
    cast.push(cylG(0.035, 0.035, 0.025, 14).rotateX(Math.PI / 2).translate(x, 0.035, z));
  }
  g.add(mergeInto(cast, iron()));
  const st = textPlate(stencil, 1.3, { style: 'card', bg: '#6a5a46', fg: '#e8e0d0', pw: 1536, ph: 96, font: FONTS.typed });
  st.position.set(0, ph - 0.07, 0.773); g.add(st);
  // brake pedal (front right) and brass turn handle (front left)
  const brake = grp('brake'); brake.position.set(0.55, ph - 0.05, 0.78);
  brake.add(mergeInto([boxG(0.03, 0.03, 0.12, 0, 0, 0.06), boxG(0.1, 0.015, 0.06, 0, 0.01, 0.12, 0.004)], M.enamel('#a8201a')));
  brake.rotation.x = -0.35; g.add(brake);
  const turn = grp('turnHandle'); turn.position.set(-0.55, ph, 0.68);
  turn.add(mergeInto([cylG(0.012, 0.012, 0.35, 10, 0, 0.175, 0), new THREE.TorusGeometry(0.06, 0.012, 8, 20).translate(0, 0.38, 0), new THREE.SphereGeometry(0.02, 10, 8).translate(0, 0.35, 0)], M.brass({ polished: true })));
  g.add(turn);
  // tower: an 8-sided frustum, face 0 centred on +Z
  const tower = mesh(new THREE.CylinderGeometry(rT, rB, towerH, 8, 1, true).rotateY(-Math.PI / 8).translate(0, ph + towerH / 2, 0), new THREE.MeshStandardMaterial({ map: lighthouseSkin(), roughness: 0.9 }));
  g.add(tower);
  // frame battens at each corner + a proud door frame on face 0
  const bat = [];
  for (let k = 0; k < 8; k++) {
    const a = k * TAU / 8 - Math.PI / 8 + Math.PI / 8; // corners at multiples of π/4 offset by the face rotation
    const ax = Math.sin(a - Math.PI / 8), az = Math.cos(a - Math.PI / 8);
    bat.push(tubeG([[ax * (rB + 0.008), ph, az * (rB + 0.008)], [ax * (rT + 0.008), ph + towerH, az * (rT + 0.008)]], 0.012, { radial: 4, seg: 2 }));
  }
  g.add(mergeInto(bat, M.dustyWood({ tint: '#d8d0bc' })));
  const apo = Math.cos(Math.PI / 8);
  const doorH = towerH * 0.36, doorZ = (rB - (rB - rT) * (doorH / 2) / towerH) * apo;
  const door = mesh(mergeG([boxG(0.04, doorH, 0.03, -0.17, doorH / 2, 0), boxG(0.04, doorH, 0.03, 0.17, doorH / 2, 0), boxG(0.38, 0.05, 0.03, 0, doorH, 0)]), M.dustyWood({ tint: '#3a2416' }));
  door.position.set(0, ph, doorZ + 0.01); door.rotation.x = Math.atan2(rB - rT, towerH);
  g.add(door);
  // gallery deck + rail
  const gy = ph + towerH;
  g.add(mesh(cylG(0.68, 0.6, 0.08, 8, 0, gy + 0.04, 0).rotateY(Math.PI / 8), M.paintedCanvas({ tint: '#3a3a3a' })));
  const rail = [new THREE.TorusGeometry(0.66, 0.012, 6, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8).translate(0, gy + 0.5, 0), new THREE.TorusGeometry(0.66, 0.008, 6, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8).translate(0, gy + 0.28, 0)];
  for (let k = 0; k < 24; k++) { const a = k * TAU / 24, rr = 0.64; rail.push(cylG(0.007, 0.007, 0.44, 5, Math.sin(a) * rr, gy + 0.3, Math.cos(a) * rr)); }
  g.add(mergeInto(rail, iron()));
  // lantern room
  const ly = gy + 0.08, lh = 0.55, lr = 0.36;
  g.add(mesh(cylG(lr + 0.02, lr + 0.04, 0.16, 8, 0, ly + 0.08, 0).rotateY(Math.PI / 8), M.paintedCanvas({ tint: '#e8e0cc' })));
  const glassMat = M.glass({ color: '#d8e8f0', opacity: 0.2 });
  g.add(mesh(new THREE.CylinderGeometry(lr, lr, lh, 8, 1, true).rotateY(Math.PI / 8).translate(0, ly + 0.16 + lh / 2, 0), glassMat, { cast: false }));
  const mull = [];
  for (let k = 0; k < 8; k++) { const a = k * TAU / 8; mull.push(boxG(0.025, lh, 0.025, Math.sin(a) * lr, ly + 0.16 + lh / 2, Math.cos(a) * lr)); }
  mull.push(cylG(lr + 0.02, lr + 0.02, 0.03, 8, 0, ly + 0.16 + lh, 0).rotateY(Math.PI / 8));
  g.add(mergeInto(mull, iron()));
  const roofY = ly + 0.16 + lh + 0.015;
  g.add(mergeInto([cylG(0.04, lr + 0.08, 0.28, 8, 0, roofY + 0.14, 0).rotateY(Math.PI / 8), new THREE.SphereGeometry(0.06, 14, 10).translate(0, roofY + 0.32, 0), cylG(0.008, 0.012, 0.22, 6, 0, roofY + 0.45, 0)], M.enamel('#5a1a14', { roughness: 0.5 })));
  // ladder up the back
  const lad = [];
  for (const s of [-1, 1]) lad.push(tubeG([[s * 0.17, 0.2, -(rB + 0.12)], [s * 0.17, gy + 0.4, -(rT + 0.12)]], 0.015, { radial: 5, seg: 2 }));
  for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9, z = -(rB + 0.12 + (rT - rB) * t); lad.push(cylG(0.01, 0.01, 0.34, 6, 0, 0.2 + (gy + 0.2) * t, z).rotateZ(0).rotateX(0)); }
  g.add(mergeInto(lad.map((geo, i) => (i >= 2 ? geo.rotateZ(Math.PI / 2).translate(0, 0, 0) : geo)), M.dustyWood()));
  // lamp housing: a brass gimbal ring on a pedestal, the mount, an inner glow and halo, and an optional beam
  const mountY = ly + 0.2;
  g.add(mergeInto([cylG(0.05, 0.08, 0.06, 16, 0, ly + 0.17, 0), new THREE.TorusGeometry(0.16, 0.01, 8, 28).rotateX(Math.PI / 2).translate(0, mountY + 0.14, 0)], M.tarnishedBrass({ amount: 0.4 })));
  const lampMount = grp('lampMount'); lampMount.position.set(0, mountY, 0); g.add(lampMount);
  const coreMat = new THREE.MeshBasicMaterial({ color: '#000000', toneMapped: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const core = noRay(mesh(new THREE.SphereGeometry(0.1, 16, 12).translate(0, 0.16, 0), coreMat, { cast: false, receive: false }));
  lampMount.add(core);
  const hs = halo('#ffd890', 1.6, 0.7); hs.position.y = 0.16; lampMount.add(hs);
  const beams = grp('beams'); beams.position.y = 0.16; lampMount.add(beams);
  if (beam) for (const s of [1, -1]) { const b = beamCone(12, 1.6, '#fff0c8', 0); b.rotation.z = s * Math.PI / 2; beams.add(b); }
  let lamp = 0, lampT = 0, beamOn = false, spin = 0.6, beamK = 0;
  const apply = () => {
    coreMat.color.setRGB(1.6 * lamp, 1.3 * lamp, 0.8 * lamp); core.visible = lamp > 0.01;
    hs.material.opacity = 0.7 * lamp; hs.visible = lamp > 0.01;
    for (const c of lampMount.children) if (c.userData?.setLit && c !== core) c.userData.setLit(lamp, true);
  };
  g.userData.update = (dt) => {
    if (Math.abs(lamp - lampT) > 0.001) { lamp = chase(lamp, lampT, dt, 3); apply(); }
    beamK = chase(beamK, beamOn ? lamp : 0, dt, 3);
    beams.visible = beamK > 0.01;
    beams.children.forEach((b) => b.userData.setOpacity(0.1 * beamK));
    beams.rotation.y += dt * spin;
  };
  g.userData.setLamp = (t, instant) => { lampT = +t; if (instant) { lamp = lampT; apply(); } };
  g.userData.setBeam = (on, speed = 0.6) => { beamOn = !!on; spin = speed; };
  apply();
  g.userData.lampMount = lampMount; g.userData.lampPos = new THREE.Vector3(0, mountY + 0.16, 0);
  g.userData.brake = brake; g.userData.setBrake = (b) => { brake.rotation.x = b ? 0.15 : -0.35; };
  g.userData.turnHandle = turn; g.userData.door = door; g.userData.stencil = st; g.userData.tower = tower;
  return g;
}

const ringGeoCache = new Map();
/** Glass lens-ring geometry: outer diameter d (m), band height 0.045, prism ridges, a brass spider to a hub. */
export function lensRingGeometry(d = 0.22) {
  const key = d.toFixed(3);
  if (ringGeoCache.has(key)) return ringGeoCache.get(key);
  const R = d / 2, hh = 0.045, pts = [[R * 0.86, 0]];
  for (let i = 0; i <= 4; i++) { const y = hh * i / 4; pts.push([R * (0.97 - 0.06 * i / 4), y + 0.002], [R * (1.0 - 0.06 * i / 4), y + hh / 8]); }
  pts.push([R * 0.92, hh], [R * 0.84, hh], [R * 0.8, hh * 0.5], [R * 0.86, 0]);
  const geo = latheG(pts, 40);
  ringGeoCache.set(key, geo);
  return geo;
}
let lensMatShared = null;
function lensMaterial() {
  if (!lensMatShared) lensMatShared = new THREE.MeshPhysicalMaterial({ color: '#dff2f0', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.42, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false, emissive: '#fff0c8', emissiveIntensity: 0 });
  return lensMatShared;
}
/**
 * One loose glass lens ring (for the felt tray). d = outer diameter. Origin: bottom centre. userData: { d }.
 * 2 draw calls (glass + brass spider).
 */
export function lensRing({ d = 0.22 } = {}) {
  const g = grp('lensRing');
  const glass = mesh(lensRingGeometry(d), lensMaterial(), { cast: false }); glass.name = 'lensGlass';
  g.add(glass); g.userData.glass = glass;
  const sp = [new THREE.TorusGeometry(0.012, 0.003, 6, 12).rotateX(Math.PI / 2).translate(0, 0.02, 0)];
  for (let k = 0; k < 3; k++) sp.push(boxG(d * 0.43 - 0.012, 0.004, 0.006, (d * 0.43) / 2 + 0.006, 0.02, 0, 0.001).rotateY(k * TAU / 3));
  g.add(mergeInto(sp, M.brass()));
  g.userData.d = d;
  return g;
}

/**
 * The lighthouse lamp prop: a brass base and spindle, a bulb, and up to five glass lens rings stacked into a
 * beehive (biggest at the base). rings: array of diameters to show stacked (bottom → top), [] for the bare body.
 * Origin: base centre. ~0.36 m tall. userData: { rings[] (groups), ringY(i) (local y for the i-th ring),
 * spindleTop, setLit(0..1, instant), addRing(group) / popRing() helpers }. Cost: 3 + 2·rings draw calls.
 */
export function beehiveLamp({ rings = [0.22, 0.19, 0.16, 0.13, 0.1], lit = 0 } = {}) {
  const g = grp('beehiveLamp');
  const baseTop = 0.06;
  g.add(mergeInto([latheG([[0, 0], [0.13, 0], [0.135, 0.008], [0.12, 0.02], [0.06, 0.04], [0.05, baseTop], [0, baseTop]], 32), cylG(0.008, 0.008, 0.32, 10, 0, baseTop + 0.16, 0), new THREE.SphereGeometry(0.014, 10, 8).translate(0, baseTop + 0.32, 0)], M.tarnishedBrass({ amount: 0.25 })));
  const bulbs = bulbSet([[0, baseTop + 0.09, 0]], { r: 0.03, color: '#ffd890', intensity: 3, lit: 0, shape: 'round' });
  g.add(bulbs);
  g.add(mesh(cylG(0.016, 0.02, 0.03, 12, 0, baseTop + 0.05, 0), M.porcelain('#ece4d4')));
  const ringH = 0.045;
  const ringY = (i) => baseTop + 0.005 + i * ringH;
  g.userData.rings = [];
  // rings seated in the lamp share this lamp's own glass (it glows with the bulb); loose rings use the shared one
  const litGlass = lensMaterial().clone();
  g.userData.addRing = (rg) => { rg.position.set(0, ringY(g.userData.rings.length), 0); g.add(rg); g.userData.rings.push(rg); if (rg.userData.glass) rg.userData.glass.material = litGlass; return rg; };
  g.userData.popRing = () => { const rg = g.userData.rings.pop(); if (rg) { g.remove(rg); if (rg.userData.glass) rg.userData.glass.material = lensMaterial(); } return rg; };
  for (const d of rings) g.userData.addRing(lensRing({ d }));
  const hs = halo('#ffe0a0', 0.7, 0.6); hs.position.y = baseTop + 0.1; g.add(hs);
  let level = 0, target = lit;
  const apply = () => { bulbs.userData.setAll(level); hs.material.opacity = 0.6 * level; hs.visible = level > 0.01; litGlass.emissiveIntensity = level * 0.45; };
  g.userData.update = (dt) => { if (Math.abs(level - target) > 0.001) { level = chase(level, target, dt, 5); apply(); } };
  g.userData.setLit = (t, instant) => { target = +t; if (instant) { level = target; apply(); } };
  level = lit; apply();
  g.userData.ringY = ringY; g.userData.spindleTop = baseTop + 0.32; g.userData.ringH = ringH;
  return g;
}

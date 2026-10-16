// Mr. Pike, the stage manager: a smaller, cooler, fainter ghost than Lavinia. Bowler, collarless shirt with the
// sleeves rolled and armbands, a brown waistcoat with a watch chain, a pencil behind his ear, a prompt book under his
// left arm, a stopwatch he checks. Feet visible: he stands (or sits), he does not drift.
//
// Conventions: group origin = the floor under his feet (stand) or the TOP of the seat (sit); +Z forward; metres.
// 1.65 m to the top of his head, about 1.73 m to the crown of the bowler. See docs/notes/characters.md.
import * as THREE from 'three';
import { Character } from '../CompanionStub.js';
import {
  TAU, PI, clamp, lerp, smooth, easeInOut, damp, env, rand, rng, canvasTex,
  ghostUniforms, ghostMaterials, ghostMesh, paint, remapUV, place, capsuleAB, ellipsoid, merge, lathe,
  displacedSphere, tubeAlong, buildHand, makeHaze, makePuffs,
  T, mirrorT, copyT, lerpT, newT, ArmRig,
} from './ghost.js';

export const PIKE_HEIGHT = 1.65;
const WAIST = 1.0;
const HIP = 0.9;
const THIGH = 0.42, SHIN = 0.41;
const SHOULDER = new THREE.Vector3(0.178, 0.37, -0.012);
const UPPER = 0.29, FORE = 0.255;

const COL = {
  skin: '#d9c2a2', hair: '#5a4630', shirt: '#ece2cc', waistcoat: '#7a5638', trousers: '#4e463e', boot: '#3a2e24',
  band: '#2e2a26', hat: '#3a3028', hatBand: '#1e1a16', brass: '#cdb06a', moustache: '#4e3a28', book: '#6a2e22',
  pages: '#efe4c8', pencil: '#b89040', lead: '#2a2420', watchFace: '#f4ecd8', eye: '#2a2018',
};
const LOOK = {
  glow: '#93a4b8', core: '#dccfb4', rim: '#b8c6d8', opacity: 0.66, maxLum: 0.56, rimAmt: 0.34, glowAmt: 0.09, bright: 0.95,
  tint: 0.36, mist: [-2, -1.9],
};

const TORSO = [[0.158, 0.79], [0.164, 0.86], [0.156, 0.94], [0.158, 1.02], [0.164, 1.1], [0.168, 1.2], [0.166, 1.29], [0.156, 1.35], [0.128, 1.395], [0.088, 1.428], [0.058, 1.45]];
const torsoSX = (y) => lerp(1.12, 1.3, smooth((y - 1.05) / 0.25)) * (1 - 0.3 * smooth((y - 1.37) / 0.08));
const torsoSZ = 0.82;
const belly = (y) => 0.024 * Math.exp(-Math.pow((y - 1.04) / 0.09, 2));

function resample(prof, n) {
  const curve = new THREE.SplineCurve(prof.map(([r, y]) => new THREE.Vector2(r, y)));
  const dense = curve.getPoints(n * 8);
  const y0 = prof[0][1], y1 = prof[prof.length - 1][1];
  const out = [];
  for (let i = 0; i <= n; i++) {
    const y = lerp(y0, y1, i / n);
    let best = dense[0];
    for (const p of dense) if (Math.abs(p.y - y) < Math.abs(best.y - y)) best = p;
    out.push([best.x, y]);
  }
  return out;
}

/** torso: trousers below the waistband, the waistcoat (V opening, buttons, a watch chain) over a collarless shirt */
function torsoTexture() {
  return canvasTex(512, 512, (g, W, H) => {
    const y0 = TORSO[0][1], y1 = TORSO[TORSO.length - 1][1];
    const Y = (y) => (1 - (y - y0) / (y1 - y0)) * H;
    g.fillStyle = COL.shirt; g.fillRect(0, 0, W, H);
    // waistcoat: covers the torso from the waistband to the shoulders, a V at the front (u 0 / 1), armholes at the sides
    g.fillStyle = COL.waistcoat;
    g.beginPath();
    const vTop = 1.33, vBot = 1.17;
    const front = (u) => Math.min(u, 1 - u); // 0 at the front centre
    for (let x = 0; x <= W; x += 2) {
      const u = x / W, f = front(u);
      // V: the opening narrows from 0.075 (u) at vTop to 0 at vBot
      let top = 1.42;
      const side = Math.abs(u - 0.25) < 0.07 || Math.abs(u - 0.75) < 0.07; // armholes
      if (side) top = 1.3 - 0.06 * Math.cos(((Math.abs(u - (u < 0.5 ? 0.25 : 0.75))) / 0.07) * PI / 2);
      if (f < 0.06) top = Math.min(top, lerp(vBot, vTop, f / 0.06));
      const yy = Y(top);
      x ? g.lineTo(x, yy) : g.moveTo(x, yy);
    }
    g.lineTo(W, Y(0.955)); g.lineTo(0, Y(0.955)); g.closePath(); g.fill();
    // waistcoat points at the front bottom
    for (const e of [0, 1]) for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo((e + s * 0.002) * W, Y(0.955)); g.lineTo((e + s * 0.07) * W, Y(0.955)); g.lineTo((e + s * 0.01) * W, Y(0.92)); g.closePath(); g.fill();
    }
    // a satin back (slightly greyer)
    g.fillStyle = 'rgba(120,110,100,0.35)'; g.fillRect(0.33 * W, Y(1.4), 0.34 * W, Y(0.955) - Y(1.4));
    // buttons
    g.fillStyle = COL.brass;
    for (const e of [0, 1]) for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(e * W + (e ? -4 : 4), Y(lerp(0.97, 1.13, i / 4)), 3.2, 0, TAU); g.fill(); }
    // edge stitching and pockets
    g.strokeStyle = 'rgba(40,24,12,0.5)'; g.lineWidth = 2;
    for (const u of [0.07, 0.93]) { g.strokeRect(u * W - 14, Y(1.06), 28, 6); }
    // watch chain: from the button to the left pocket (u ≈ 0.07)
    g.strokeStyle = COL.brass; g.lineWidth = 2;
    g.beginPath(); g.moveTo(4, Y(1.05)); g.quadraticCurveTo(0.04 * W, Y(1.0), 0.07 * W, Y(1.055)); g.stroke();
    // trousers and the waistband
    g.fillStyle = COL.trousers; g.fillRect(0, Y(0.955), W, H - Y(0.955));
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, Y(0.97), W, 4);
    // braces under the waistcoat would not show; shirt creases above
    g.strokeStyle = 'rgba(120,100,70,0.25)'; g.lineWidth = 2;
    for (let i = 0; i < 18; i++) { const x = Math.random() * W; g.beginPath(); g.moveTo(x, Y(1.42)); g.lineTo(x + 6, Y(1.32)); g.stroke(); }
  }, { repeatU: true });
}

function headTexture() {
  return canvasTex(512, 256, (g, W, H) => {
    const X = (u) => u * W, Y = (v) => (1 - v) * H;
    g.fillStyle = COL.skin; g.fillRect(0, 0, W, H);
    const soft = (u, v, rx, ry, color, a) => {
      g.save(); g.translate(X(u), Y(v)); g.scale(rx * W, ry * H);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
    };
    soft(0.25, 0.32, 0.09, 0.12, '#8a6a50', 0.35); // jaw shadow / stubble
    soft(0.19, 0.55, 0.03, 0.04, '#7a5a44', 0.35); // deep-set eyes
    soft(0.31, 0.55, 0.03, 0.04, '#7a5a44', 0.35);
    soft(0.17, 0.44, 0.04, 0.06, '#c88a70', 0.3); // ruddy cheeks
    soft(0.33, 0.44, 0.04, 0.06, '#c88a70', 0.3);
    // short hair at the sides and back, under the hat
    g.globalAlpha = 1; g.fillStyle = COL.hair;
    g.beginPath(); g.moveTo(0, 0);
    for (let x = 0; x <= W; x += 4) {
      const u = x / W, d = Math.min(Math.abs(u - 0.25), Math.abs(u - 1.25));
      const v = d < 0.09 ? 0.86 : lerp(0.66, 0.42, smooth((d - 0.09) / 0.3));
      g.lineTo(x, Y(v));
    }
    g.lineTo(W, 0); g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(0, H - 6, W, 6);
  }, { repeatU: true });
}

// ---- arm targets (torso frame, origin at the waist, +X = his left) --------------------------------------------
const P_BACK = [0, 0, -1];
const R_REST = T([-0.235, -0.12, 0.04], [0.05, -1, 0.15], [1, 0, 0.15], [-0.3, 0, -1], 0.4);
// left arm clamps the prompt book to his side, the hand under its front end
const L_BOOK = T([0.232, 0.045, 0.2], [-0.12, -0.08, 1], [-0.25, 1, 0], [1, -0.2, -0.6], 0.38);
const A = {
  check: T([-0.07, 0.2, 0.29], [0.6, 0.05, 0.8], [0, 1, 0.3], [-0.6, -1, -0.2], 0.42),
  point: T([-0.36, 0.36, 0.42], [-0.45, 0.25, 0.85], [0.6, 0, 0.2], [-1, -0.6, -0.2], 0.7),
  press: T([-0.1, 0.22, 0.46], [0, 0.15, 1], [0, 0, 1], [-1, -0.8, 0], 0.75),
  ear: T([-0.12, 0.56, 0.0], [0.2, 0.9, -0.3], [1, 0, 0.3], [-1, 0.4, 0.2], 0.6),
  mouth: T([-0.04, 0.48, 0.18], [0.5, 0.8, 0.1], [0.2, 0, -1], [-1, -0.7, 0], 0.65),
  tick: T([0.05, 0.12, 0.3], [0.9, 0.0, 0.4], [0, -1, 0], [-1, -0.6, -0.2], 0.6),
  hat: T([-0.08, 0.62, 0.12], [0.3, 0.4, 0.85], [0, -0.6, 0.6], [-1, 0.2, 0.2], 0.55),
  fend: T([-0.12, 0.3, 0.26], [0.05, 1, 0.3], [0, 0, 1], [-1, -0.5, -0.2], 0.1),
  chest: T([-0.04, 0.24, 0.2], [0.5, 0.7, 0.2], [0, 0, -1], [-1, -0.6, -0.2], 0.35),
};
const AL = { fend: mirrorT(A.fend) };
const DUR = { check: 3.2, nod: 0.8, point: 2.2, flinch: 1.1, press: 1.4, tick: 2.4, lick: 2.4, tip: 1.8, shake: 1.0, sigh: 2.2, bow: 1.8, fade: 3.0, appear: 1.8, perk: 1.2, think: 2.4 };
const ALIAS = { stopwatch: 'check', watch: 'check', cue: 'press', button: 'press', hat: 'tip', fadeOut: 'fade', fadeIn: 'appear', gasp: 'flinch', drift: 'nod' };

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _r = newT(), _l = newT();

export class Pike extends Character {
  constructor(ctx, { companion = false } = {}) {
    super(ctx, 'pike', { companion });
    this.group.renderOrder = 2;
    this.U = ghostUniforms(LOOK);
    this.body = new THREE.Object3D();
    this.group.add(this.body);
    this._buildLegs();
    this._buildTorso();
    this._buildHead();
    this._buildArms();
    this._buildProps();
    this.haze = makeHaze('#8a9ab0', 1.1, 2.0);
    this.haze.position.set(0, 1.0, -0.05);
    this.body.add(this.haze);
    this.motes = makePuffs(14, 0.025);
    this.body.add(this.motes);
    this._motes = Array.from({ length: 14 }, () => this._newMote(true));
    this._moteBurst = 0;

    this._fx = [];
    this._sit = 0; this._sitTarget = 0; this._poseResolve = null;
    this._presence = 1; this._presenceTarget = 1;
    this._hover = 0;
    this._headYaw = 0; this._headPitch = 0; this._bodyYaw = 0;
    this._idleYaw = 0; this._idlePitch = 0; this._idleTimer = rand(2, 5);
    this._blinkTimer = rand(1.5, 4); this._blinkT = null;
    this._checkTimer = rand(5, 9);
    this._walk = null; this._walkPhase = 0; this._walkAmt = 0;
    this._t = 0;
    this.update(0, 0);
  }

  _mats(map, partGlow = 0) { return ghostMaterials(this.U, { map, partGlow }); }

  _buildLegs() {
    this.legs = {};
    for (const [key, side] of [['L', 1], ['R', -1]]) {
      const thigh = ghostMesh(paint(capsuleAB([0, 0, 0], [0, THIGH, 0], 0.078, 0.058, { radial: 14 }), COL.trousers), this._mats(null));
      const shin = ghostMesh(merge([
        paint(capsuleAB([0, 0, 0], [0, SHIN, 0], 0.057, 0.05, { radial: 14 }), COL.trousers),
        paint(place(new THREE.CylinderGeometry(0.055, 0.062, 0.06, 14, 1, true), { p: [0, SHIN - 0.035, 0] }), COL.trousers),
      ]), this._mats(null));
      // a boot built toe-forward (+Z), sole down; then turned into the "hand" frame ArmRig uses (+Y toes, +Z sole)
      const boot = merge([
        paint(ellipsoid(0.048, 0.045, 0.115, [0, -0.03, 0.055], { ws: 16, hs: 10 }), COL.boot),
        paint(ellipsoid(0.044, 0.05, 0.05, [0, -0.01, -0.005], { ws: 14, hs: 10 }), COL.boot),
        paint(place(new THREE.BoxGeometry(0.075, 0.018, 0.24), { p: [0, -0.066, 0.05] }), '#241c16'),
      ]);
      boot.rotateX(-PI / 2);
      const bootM = ghostMesh(boot, this._mats(null));
      this.body.add(thigh, shin, bootM);
      const hip = new THREE.Vector3(side * 0.094, HIP, -0.005);
      this.legs[key] = new ArmRig({ side, shoulder: hip, a: THIGH, b: SHIN, upper: thigh, fore: shin, hand: bootM, setCurl: () => {} });
    }
  }

  _buildTorso() {
    const torso = lathe(resample(TORSO, 24), 48, (v, th) => {
      const y = v.y, front = Math.max(0, Math.cos(th));
      v.x *= torsoSX(y);
      v.z = v.z * torsoSZ + belly(y) * front;
    });
    paint(torso, '#ffffff');
    // collarless shirt band
    const band = paint(place(new THREE.TorusGeometry(0.058, 0.009, 6, 28), { p: [0, 1.452, 0.004], r: [PI / 2 + 0.1, 0, 0] }), COL.shirt);
    remapUV(band, 0.5, 0.99);
    const collarStud = paint(ellipsoid(0.006, 0.006, 0.004, [0, 1.445, 0.064]), COL.brass);
    remapUV(collarStud, 0.5, 0.99);
    // shoulders (the shirt over the deltoids), bridging the torso and the arms
    const caps = [1, -1].map((sd) => { const c = paint(ellipsoid(0.062, 0.052, 0.06, [sd * 0.158, 1.372, -0.01], { ws: 16, hs: 10 }), COL.shirt); remapUV(c, 0.5, 0.99); return c; });
    const geo = merge([torso, band, collarStud, ...caps]);
    geo.translate(0, -WAIST, 0);
    this.chest = new THREE.Object3D();
    this.chest.position.set(0, WAIST, 0);
    this.body.add(this.chest);
    this.chest.add(ghostMesh(geo, this._mats(torsoTexture())));
    this.neck = new THREE.Object3D();
    this.neck.position.set(0, 0.44, 0.006);
    this.chest.add(this.neck);
    this.neck.add(ghostMesh(paint(capsuleAB([0, -0.02, 0], [0, 0.085, 0.01], 0.052, 0.048, { radial: 14 }), COL.skin), this._mats(null)));
  }

  _buildHead() {
    const head = new THREE.Object3D();
    head.position.set(0, 0.07, 0.012);
    head.rotation.order = 'YXZ';
    this.neck.add(head);
    this.head = head;
    const C = [0, 0.07, 0];
    const at = (x, y, z) => [C[0] + x, C[1] + y, C[2] + z];
    const parts = [];
    const skull = displacedSphere(36, 24, (v) => {
      let x = v.x, y = v.y, z = v.z;
      if (y < 0) { x *= 1 + 0.1 * y; }
      if (z > 0.7) z = 0.7 + (z - 0.7) * 0.8;
      v.set(x * 0.086 + C[0], y * 0.105 + C[1], z * 0.096 + C[2]);
    });
    paint(skull, '#ffffff');
    parts.push(skull);
    const solid = (geo, hex) => { paint(geo, hex); remapUV(geo, 0.5, 0.004); parts.push(geo); return geo; };
    // a good stage-manager's nose, ears, brows, the moustache
    solid(ellipsoid(0.011, 0.024, 0.014, at(0, -0.01, 0.088), { r: [-0.3, 0, 0], ws: 14, hs: 10 }), COL.skin);
    solid(ellipsoid(0.014, 0.012, 0.012, at(0, -0.03, 0.096), { ws: 14, hs: 10 }), '#d2b090');
    for (const s of [1, -1]) {
      solid(ellipsoid(0.013, 0.027, 0.017, at(s * 0.084, -0.005, -0.004), { r: [0, s * 0.3, 0], ws: 12, hs: 10 }), COL.skin);
      solid(tubeAlong([at(s * 0.012, 0.03, 0.092), at(s * 0.032, 0.036, 0.089), at(s * 0.052, 0.03, 0.078)], 0.006, { segs: 8, radial: 6, taper: 0.5 }), COL.moustache);
    }
    // the moustache: two tapered sweeps from under the nose
    for (const s of [1, -1]) {
      solid(tubeAlong([at(0, -0.042, 0.1), at(s * 0.02, -0.046, 0.097), at(s * 0.038, -0.054, 0.086), at(s * 0.048, -0.064, 0.074)], 0.0085, { segs: 12, radial: 7, taper: 0.85 }), COL.moustache);
    }
    // bowler: a domed crown, a band, a brim curled up at the sides
    const crown = displacedSphere(28, 16, (v) => {
      const y = Math.max(v.y, -0.2);
      const s = 1 - 0.06 * smooth(-y / 0.2);
      v.set(v.x * 0.093 * s, y * 0.105, v.z * 0.104 * s);
    });
    place(crown, { p: at(0, 0.066, -0.006), r: [-0.08, 0, 0] });
    solid(crown, COL.hat);
    solid(place(new THREE.TorusGeometry(0.09, 0.008, 6, 32), { p: at(0, 0.05, -0.006), r: [PI / 2 - 0.08, 0, 0], s: [0.98, 1.1, 1] }), COL.hatBand);
    const brim = lathe([[0.085, 0], [0.11, -0.002], [0.124, 0.003], [0.13, 0.012]], 40, (v, th) => {
      const side = Math.abs(Math.sin(th));
      v.y += 0.02 * side * side * smooth((Math.hypot(v.x, v.z) - 0.09) / 0.04);
      v.x *= 0.95; v.z *= 1.06;
    });
    place(brim, { p: at(0, 0.044, -0.006), r: [-0.08, 0, 0] });
    solid(brim, COL.hat);
    const headGeo = merge(parts);
    head.add(ghostMesh(headGeo, this._mats(headTexture())));
    // pencil behind his right ear (-X)
    const pencil = merge([
      paint(place(new THREE.CylinderGeometry(0.0045, 0.0045, 0.13, 6), {}), COL.pencil),
      paint(place(new THREE.ConeGeometry(0.0045, 0.018, 6), { p: [0, -0.074, 0], r: [PI, 0, 0] }), '#d8c0a0'),
    ]);
    this.pencil = ghostMesh(pencil, this._mats(null));
    this.pencil.position.set(...at(-0.088, 0.03, 0.0));
    this.pencil.rotation.set(0.9, 0, 0.2);
    head.add(this.pencil);
    this._pencilHome = { p: this.pencil.position.clone(), r: this.pencil.rotation.clone() };
    // eyes (small and dark) with lids, so he blinks
    this.eyes = [];
    for (const s of [1, -1]) {
      const unit = new THREE.Object3D();
      unit.position.set(...at(s * 0.03, 0.008, 0.08));
      unit.scale.set(0.011, 0.009, 0.008);
      head.add(unit);
      unit.add(ghostMesh(merge([paint(new THREE.SphereGeometry(1, 14, 10), '#efe6d4'), paint(ellipsoid(0.6, 0.65, 0.3, [0, 0, 0.82]), COL.eye)]), this._mats(null)));
      const lid = ghostMesh(paint(new THREE.SphereGeometry(1.12, 14, 6, 0, TAU, 0, PI / 2), COL.skin), this._mats(null));
      unit.add(lid);
      this.eyes.push(lid);
    }
  }

  _buildArms() {
    this.arms = {};
    for (const [key, side] of [['L', 1], ['R', -1]]) {
      // shirt sleeve, an armband above the elbow, the sleeve rolled to just below the elbow
      const upper = ghostMesh(merge([
        paint(capsuleAB([0, -0.01, 0], [0, UPPER, 0], 0.045, 0.04, { radial: 14 }), COL.shirt),
        paint(place(new THREE.TorusGeometry(0.043, 0.007, 6, 18), { p: [0, UPPER * 0.42, 0], r: [PI / 2, 0, 0] }), COL.band),
      ]), this._mats(null));
      const fore = ghostMesh(merge([
        paint(place(new THREE.TorusGeometry(0.037, 0.011, 8, 18), { p: [0, 0.035, 0], r: [PI / 2, 0, 0] }), COL.shirt),
        paint(capsuleAB([0, 0, 0], [0, FORE, 0], 0.038, 0.027, { radial: 14 }), COL.skin),
      ]), this._mats(null));
      const hand = buildHand(side, COL.skin, { scale: 1.08 });
      const handM = ghostMesh(hand.geo, this._mats(null));
      this.chest.add(upper, fore, handM);
      const shoulder = SHOULDER.clone(); shoulder.x *= side;
      this.arms[key] = new ArmRig({ side, shoulder, a: UPPER, b: FORE, upper, fore, hand: handM, setCurl: hand.setCurl });
    }
  }

  _buildProps() {
    // the prompt book: two boards, a spine, a page block (edges showing)
    const W = 0.036, Hh = 0.17, L = 0.24;
    const book = merge([
      paint(place(new THREE.BoxGeometry(0.005, Hh + 0.006, L + 0.006), { p: [W / 2, 0, 0] }), COL.book),
      paint(place(new THREE.BoxGeometry(0.005, Hh + 0.006, L + 0.006), { p: [-W / 2, 0, 0] }), COL.book),
      paint(place(new THREE.BoxGeometry(W + 0.005, Hh + 0.006, 0.008), { p: [0, 0, -L / 2] }), COL.book),
      paint(place(new THREE.BoxGeometry(W - 0.004, Hh - 0.004, L - 0.006), { p: [0, 0, 0.002] }), COL.pages),
      // ribbon markers hanging from the top
      paint(place(new THREE.BoxGeometry(0.002, 0.05, 0.006), { p: [0.004, -Hh / 2 - 0.02, 0.06] }), '#8a2020'),
    ]);
    this.book = ghostMesh(book, this._mats(null));
    this.book.position.set(0.232, 0.14, 0.07);
    this.book.rotation.set(0.06, -0.22, 0.08);
    this.chest.add(this.book);
    // stopwatch: lives in the right hand while he checks it
    const watch = merge([
      paint(place(new THREE.CylinderGeometry(0.026, 0.026, 0.012, 24), { r: [PI / 2, 0, 0] }), COL.brass),
      paint(place(new THREE.CylinderGeometry(0.022, 0.022, 0.002, 24), { p: [0, 0, 0.0065], r: [PI / 2, 0, 0] }), COL.watchFace),
      paint(place(new THREE.BoxGeometry(0.0015, 0.016, 0.001), { p: [0.003, 0.006, 0.0078], r: [0, 0, -0.4] }), '#202020'),
      paint(place(new THREE.CylinderGeometry(0.004, 0.004, 0.008, 8), { p: [0, 0.03, 0] }), COL.brass),
      paint(place(new THREE.TorusGeometry(0.006, 0.0015, 4, 10), { p: [0, 0.037, 0] }), COL.brass),
    ]);
    this.watch = ghostMesh(watch, this._mats(null, 0.08));
    this.watch.position.set(0, 0.05, 0.022);
    this.watch.rotation.set(0, 0, 0);
    this.arms.R.hand.add(this.watch);
    this.watch.visible = false;
  }

  _newMote(initial = false, burst = false) {
    const a = Math.random() * TAU, r = burst ? 0.1 + Math.random() * 0.3 : 0.2 + Math.random() * 0.3;
    return { x: Math.sin(a) * r, z: Math.cos(a) * r, y: burst ? 0.3 + Math.random() * 1.3 : initial ? Math.random() * 1.7 : 0.1, vy: burst ? 0.2 + Math.random() * 0.3 : 0.04 + Math.random() * 0.05, life: 0, max: burst ? 1.2 + Math.random() * 1.4 : 4 + Math.random() * 4, ph: Math.random() * TAU, burst };
  }

  // ---------------------------------------------------------------- API

  placeAt(parentGroup, opts = {}) {
    const { pose = null, ...rest } = opts;
    if (this._walk) { const w = this._walk; this._walk = null; w.resolve(); }
    super.placeAt(parentGroup, { ...rest, pose: null });
    if (pose) this.setPose(pose, 0);
    this._presence = this._presenceTarget = 1;
    return this;
  }

  /** 'stand' | 'sit' (position = the top of the seat; his feet hang about 0.45 m below it). */
  setPose(name, duration = 0.8) {
    const p = name === 'sit' || name === 'seated' || name === 'perch' ? 'sit' : 'stand';
    this.pose = p;
    this._sitTarget = p === 'sit' ? 1 : 0;
    if (this._poseResolve) { const r = this._poseResolve; this._poseResolve = null; r(); }
    if (duration <= 0) { this._sit = this._sitTarget; return Promise.resolve(); }
    this._sitSpeed = 1 / duration;
    return new Promise((res) => { this._poseResolve = res; });
  }

  setPresence(k) { this._presence = this._presenceTarget = clamp(k, 0, 1); }

  /**
   * Reactions (→ Promise): check (the stopwatch), nod, point, flinch, press (a cue-light button), tick (the book),
   * lick (the pencil), tip (the bowler), shake, sigh, bow, perk, think, fade, appear. Unknown names: a small nod.
   */
  react(name) {
    const kind = ALIAS[name] || name;
    const known = kind in DUR;
    const dur = DUR[kind] ?? 0.8;
    if (kind === 'fade') { this._presenceTarget = 0; this._moteBurst = 1; }
    if (kind === 'appear') { this._presenceTarget = 1; if (this._presence > 0.98) this._presence = 0; this._moteBurst = 1; }
    const fx = { kind: known ? kind : 'nod', t: 0, dur, resolve: null };
    const p = new Promise((res) => { fx.resolve = res; });
    for (const e of this._fx) if (e.kind === fx.kind) e.t = e.dur;
    this._fx.push(fx);
    setTimeout(() => { if (!fx.done) { fx.done = true; fx.resolve(); } }, (dur + 1.5) * 1000);
    return p;
  }

  /** Walk to a point in the parent group's space (about 0.9 m/s), turning to face it; optional final rotationY. */
  moveTo(target, { duration, rotationY = null } = {}) {
    if (this._walk) { const w = this._walk; this._walk = null; w.resolve(); }
    if (this._move) { const m = this._move; this._move = null; m.resolve(); }
    const from = this.group.position.clone();
    const to = new THREE.Vector3(target[0], target[1], target[2]);
    const dist = from.distanceTo(to);
    const yaw0 = this.group.rotation.y;
    let yaw1 = Math.hypot(to.x - from.x, to.z - from.z) > 0.05 ? Math.atan2(to.x - from.x, to.z - from.z) : yaw0;
    while (yaw1 - yaw0 > PI) yaw1 -= TAU;
    while (yaw1 - yaw0 < -PI) yaw1 += TAU;
    let yaw2 = rotationY ?? yaw1;
    while (yaw2 - yaw1 > PI) yaw2 -= TAU;
    while (yaw2 - yaw1 < -PI) yaw2 += TAU;
    if (this.pose === 'sit') this.setPose('stand', 0.5);
    return new Promise((resolve) => {
      this._walk = { from, to, yaw0, yaw1, yaw2, t: 0, dur: Math.max(0.5, duration ?? dist / 0.9 + 0.3), dist, resolve };
    });
  }

  talk(on) { this.talking = !!on; }

  // ---------------------------------------------------------------- per frame

  update(dt, t) {
    dt = Math.min(Math.max(dt || 0, 0), 1 / 20);
    this._t = t ?? this._t + dt;
    t = this._t;
    this.U.uTime.value = t;

    // pose
    const sp = this._sitSpeed || 1.2;
    this._sit = this._sitTarget > this._sit ? Math.min(1, this._sit + dt * sp) : Math.max(0, this._sit - dt * sp);
    if (this._poseResolve && this._sit === this._sitTarget) { const r = this._poseResolve; this._poseResolve = null; r(); }
    const sit = easeInOut(this._sit);

    // timers
    if (dt > 0) {
      if ((this._blinkTimer -= dt) <= 0) { this._blinkT = 0; this._blinkTimer = rand(2.5, 6); }
      if ((this._idleTimer -= dt) <= 0) { this._idleYaw = Math.random() < 0.4 ? 0 : rand(-0.35, 0.35); this._idlePitch = rand(-0.08, 0.1); this._idleTimer = rand(3, 7); }
      if ((this._checkTimer -= dt) <= 0) {
        if (!this._fx.length && !this._walk && this._presence > 0.5 && !this.talking) {
          const r = Math.random();
          this.react(r < 0.7 ? 'check' : r < 0.85 ? 'lick' : 'tick');
        }
        this._checkTimer = rand(7, 10);
      }
    }
    let blink = 0;
    if (this._blinkT != null) { this._blinkT += dt; blink = env(this._blinkT, 0.05, 0.03, 0.1); if (this._blinkT > 0.25) this._blinkT = null; }

    // arms at rest
    const R = copyT(_r, R_REST), L = copyT(_l, L_BOOK);
    if (sit > 0) { const lap = T([-0.12, -0.06, 0.28], [0.3, -0.1, 1], [0, -1, 0], [-0.8, -0.2, -1], 0.4); lerpT(R, lap, sit); }

    // reactions
    let headPitch = 0, headYaw = 0, headRoll = 0, torsoPitch = 0, recoil = 0, lift = 0, close = 0, watch = false, pencilInHand = 0, mouth = 0;
    for (let i = this._fx.length - 1; i >= 0; i--) {
      const e = this._fx[i]; e.t += dt; const u = e.t, k = u / e.dur;
      switch (e.kind) {
        case 'check': {
          const w = env(u, 0.6, 1.9, 0.7);
          watch = u > 0.25 && u < e.dur - 0.3;
          const c = copyT(newT(), A.check);
          if (u > 1.4 && u < 1.65) c.C = 0.85; // the thumb clicks
          lerpT(R, c, w); headPitch += 0.42 * w; headYaw -= 0.12 * w;
          break;
        }
        case 'nod': headPitch += 0.26 * Math.sin(PI * clamp(k, 0, 1)); break;
        case 'shake': headYaw += 0.22 * Math.sin(k * TAU * 2) * (1 - k); break;
        case 'perk': { const w = env(u, 0.15, 0.6, 0.4); headPitch -= 0.12 * w; lift += 0.015 * w; break; }
        case 'think': { const w = env(u, 0.4, 1.4, 0.6); lerpT(R, A.chest, w); headRoll += 0.1 * w; headPitch -= 0.1 * w; headYaw += 0.2 * w; break; }
        case 'point': {
          const w = env(u, 0.35, 1.3, 0.55);
          const c = copyT(newT(), A.point);
          if (this._look) { /* aim toward the look target, in torso space */ }
          lerpT(R, c, w); headYaw -= 0.25 * w;
          break;
        }
        case 'press': {
          const w = env(u, 0.4, 0.6, 0.4);
          const c = copyT(newT(), A.press); c.W.z += 0.04 * Math.max(0, Math.sin((u - 0.4) * 9)) * (u > 0.4 && u < 0.75 ? 1 : 0);
          lerpT(R, c, w); torsoPitch += 0.06 * w;
          break;
        }
        case 'flinch': {
          const w = env(u, 0.06, 0.3, 0.7);
          recoil = Math.max(recoil, 0.08 * w); torsoPitch -= 0.12 * w; close = Math.max(close, env(u, 0.04, 0.08, 0.15));
          lerpT(R, A.fend, w);
          break;
        }
        case 'tick': {
          // pencil from behind the ear, a tick in the book, back again
          const toEar = env(u, 0.35, 0.2, 0.35) * (u < 0.9 ? 1 : 0);
          const toBook = env(u - 0.7, 0.35, 0.8, 0.4);
          const back = env(u - 1.9, 0.2, 0.15, 0.2);
          lerpT(R, A.ear, Math.max(toEar, back));
          const c = copyT(newT(), A.tick); c.W.x += 0.02 * Math.sin(u * 14) * (u > 1.05 && u < 1.6 ? 1 : 0);
          lerpT(R, c, toBook);
          pencilInHand = u > 0.5 && u < 2.0 ? 1 : 0;
          headPitch += 0.35 * toBook; headYaw += 0.3 * toBook;
          break;
        }
        case 'lick': {
          const toEar = env(u, 0.35, 0.2, 0.35) * (u < 0.9 ? 1 : 0);
          const toMouth = env(u - 0.7, 0.35, 0.6, 0.35);
          const back = env(u - 1.9, 0.2, 0.15, 0.2);
          lerpT(R, A.ear, Math.max(toEar, back));
          lerpT(R, A.mouth, toMouth);
          pencilInHand = u > 0.5 && u < 2.0 ? 1 : 0;
          mouth = Math.max(mouth, 0.5 * toMouth); headPitch -= 0.06 * toMouth;
          break;
        }
        case 'tip': { const w = env(u, 0.45, 0.6, 0.6); lerpT(R, A.hat, w); headPitch += 0.18 * env(u - 0.3, 0.3, 0.5, 0.4); break; }
        case 'sigh': { const w = env(u, 0.6, 0.8, 0.8); headPitch += 0.18 * w; lift -= 0.012 * w; close = Math.max(close, 0.4 * w); break; }
        case 'bow': { const w = env(u, 0.45, 0.7, 0.6); torsoPitch += 0.4 * w; headPitch += 0.15 * w; lerpT(R, A.chest, 0.6 * w); break; }
        case 'fade': case 'appear': { const w = env(u, 0.3, e.dur - 0.6, 0.3); headPitch -= 0.06 * w; break; }
        default: break;
      }
      if (u >= e.dur) { this._fx.splice(i, 1); if (!e.done) { e.done = true; e.resolve(); } }
    }

    // presence
    const pSpeed = this._presenceTarget < this._presence ? 1 / 2.6 : 1 / 1.5;
    this._presence = this._presenceTarget > this._presence ? Math.min(this._presenceTarget, this._presence + dt * pSpeed) : Math.max(this._presenceTarget, this._presence - dt * pSpeed);
    const pres = smooth(this._presence);
    const presVis = pres * this._focusAside(dt); // POLISH: steps aside in close-ups (CompanionStub); the light keeps pres

    // walking (moveTo)
    const w = this._walk;
    let walking = 0;
    if (w && dt > 0) {
      w.t += dt;
      const k = clamp(w.t / w.dur, 0, 1);
      const e = k < 0.15 ? (k / 0.15) * (k / 0.15) * 0.075 / 1 : k > 0.85 ? 1 - Math.pow((1 - k) / 0.15, 2) * 0.075 : 0.075 + (k - 0.15) / 0.7 * 0.85;
      this.group.position.lerpVectors(w.from, w.to, e);
      this.group.rotation.y = k < 0.85 ? lerp(w.yaw0, w.yaw1, smooth(k / 0.12)) : lerp(w.yaw1, w.yaw2, smooth((k - 0.85) / 0.15));
      walking = w.dist > 0.05 ? smooth(Math.min(k, 1 - k) / 0.1) : 0;
      this._walkPhase += dt * TAU * 1.7 * (walking > 0 ? 1 : 0);
      if (k >= 1) { this.group.position.copy(w.to); this._walk = null; w.resolve(); }
    }
    this._walkAmt = damp(this._walkAmt, walking, 10, dt);
    const wa = this._walkAmt, ph = this._walkPhase;

    // body: breath, sitting drop, walking bob
    const breath = Math.sin(t * TAU / 4.6);
    this.body.position.set(0, -0.82 * sit + lift + 0.012 * wa * Math.abs(Math.cos(ph)), -recoil);

    // legs
    for (const [key, s] of [['L', 1], ['R', -1]]) {
      const leg = this.legs[key];
      const phase = ph + (s > 0 ? 0 : PI);
      const stand = T([s * 0.1, 0.075, 0.012], [s * 0.08, 0, 1], [0, -1, 0], [0, 0, 1], 0);
      // walk: the foot swings forward and lifts during its swing half
      const swing = Math.sin(phase);
      stand.W.z += 0.2 * wa * swing;
      stand.W.y += 0.07 * wa * Math.max(0, Math.cos(phase));
      const seat = T([s * 0.11, HIP - 0.43, 0.42], [s * 0.05, 0, 1], [0, -1, 0], [0, 0.4, 1], 0);
      lerpT(stand, seat, sit);
      leg.apply(stand, dt, 0);
    }

    // look
    let wantYaw = this._idleYaw, wantPitch = this._idlePitch;
    if (this._look && this.group.parent) {
      this.group.updateWorldMatrix(true, false);
      _v.copy(this._look); this.group.worldToLocal(_v);
      const dx = _v.x, dy = _v.y - (1.55 - 0.82 * sit), dz = _v.z;
      wantYaw = Math.atan2(dx, dz); wantPitch = -Math.atan2(dy, Math.hypot(dx, dz));
      if (Math.abs(wantYaw) > 2.6) { wantYaw = 0; wantPitch = 0; }
    }
    const bodyWant = Math.sign(wantYaw) * clamp(Math.abs(wantYaw) - 0.7, 0, 1.0);
    this._bodyYaw = damp(this._bodyYaw, w ? 0 : bodyWant, 1.0, dt);
    this.body.rotation.y = this._bodyYaw;
    this._headYaw = damp(this._headYaw, clamp(wantYaw - this._bodyYaw, -0.8, 0.8), 3, dt);
    this._headPitch = damp(this._headPitch, clamp(wantPitch, -0.35, 0.45), 3, dt);

    this.chest.rotation.set(torsoPitch + 0.006 * breath + 0.04 * wa, this._headYaw * 0.15 + 0.06 * wa * Math.sin(ph), 0);
    const talkNod = this.talking ? 0.03 * Math.sin(t * 4.3) * Math.sin(t * 1.1) : 0;
    this.neck.rotation.set((this._headPitch + headPitch) * 0.35, (this._headYaw + headYaw) * 0.3, headRoll * 0.3);
    this.head.rotation.set((this._headPitch + headPitch) * 0.65 + talkNod, (this._headYaw + headYaw) * 0.55, headRoll * 0.7);

    // arms (walking: a little swing)
    if (wa > 0) { R.W.z += 0.07 * wa * Math.sin(ph + PI); }
    this.arms.R.shoulder.y = SHOULDER.y + 0.003 * breath;
    this.arms.L.shoulder.y = SHOULDER.y + 0.003 * breath;
    this.arms.R.apply(R, dt, 12);
    this.arms.L.apply(L, dt, 12);
    this.watch.visible = watch;

    // pencil: behind the ear, or in his right hand
    if (pencilInHand) {
      if (this.pencil.parent !== this.arms.R.hand) { this.arms.R.hand.add(this.pencil); this.pencil.position.set(0.0, 0.07, 0.02); this.pencil.rotation.set(0.3, 0, 0.9); }
    } else if (this.pencil.parent !== this.head) {
      this.head.add(this.pencil); this.pencil.position.copy(this._pencilHome.p); this.pencil.rotation.copy(this._pencilHome.r);
    }

    // face
    const talkOpen = this.talking ? 0.5 + 0.5 * Math.sin(t * 15) : 0;
    const shut = Math.max(blink, close * 0.8);
    for (const lid of this.eyes) lid.rotation.x = lerp(1.45, -0.55, 1 - shut);
    void mouth; void talkOpen;

    // uniforms and effects
    this._hover = damp(this._hover, this.ctx.hotspots?.hovered?.id === this.who ? 1 : 0, 8, dt);
    this.U.uHover.value = this._hover;
    this.U.uPresence.value = presVis; // POLISH
    this.group.updateWorldMatrix(true, false);
    this.U.uCharInv.value.copy(this.group.matrixWorld).invert();
    this.haze.material.opacity = 0.09 * presVis * (1 + 0.4 * this._hover); // POLISH: presVis
    const op = this.motes.userData.pos, oc = this.motes.userData.col;
    if (this._moteBurst) { for (let i = 0; i < this._motes.length; i++) this._motes[i] = this._newMote(false, true); this._moteBurst = 0; }
    for (let i = 0; i < this._motes.length; i++) {
      const m = this._motes[i];
      m.life += dt; m.y += m.vy * dt;
      if (m.life > m.max) { this._motes[i] = this._newMote(); continue; }
      op[i * 3] = m.x; op[i * 3 + 1] = m.y; op[i * 3 + 2] = m.z;
      const f = Math.sin(PI * clamp(m.life / m.max, 0, 1)) * (m.burst ? 0.8 : i < 5 ? 0.35 * presVis : 0) * (0.6 + 0.4 * Math.sin(t * 5 + m.ph));
      oc[i * 3] = f * 0.8; oc[i * 3 + 1] = f * 0.85; oc[i * 3 + 2] = f * 0.95;
    }
    this.motes.userData.commit();
  }
}

export const PIKE_REACTIONS = Object.keys(DUR);

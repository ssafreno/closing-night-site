// Dame Lavinia Thrush: the companion. Tall, translucent, lit from within (gold and lilac), an enormous Edwardian gown
// whose hem dissolves into mist, long white gloves, an aigrette, a strand of pearls she worries.
//
// Conventions: group origin = the floor point under her (stand / hover) or the TOP of the surface she sits on (perch);
// +Z forward; units metres. She is 1.85 m to the top of the aigrette standing. See docs/notes/characters.md.
import * as THREE from 'three';
import { Character } from '../CompanionStub.js';
import {
  TAU, PI, clamp, lerp, smooth, easeInOut, damp, env, rand, rng, canvasTex,
  ghostUniforms, ghostMaterials, ghostMesh, paint, remapUV, place, capsuleAB, ellipsoid, merge, lathe, latheOpen,
  displacedSphere, tubeAlong, buildHand, makeHaze, makePuffs, noRaycast,
  T, mirrorT, copyT, lerpT, newT, ArmRig,
} from './ghost.js';

export const LAVINIA_HEIGHT = 1.85;
/** Waist height above the group origin per pose (the skirt hangs from here). */
export const LAVINIA_POSES = { stand: 0, hover: 0.28, perch: -0.85 };

const WAIST = 1.05;            // root-space waist height when standing
const SHOULDER = new THREE.Vector3(0.172, 0.352, -0.008); // torso space (origin at the waist), left (+X)
const UPPER = 0.29, FORE = 0.255;

const COLORS = {
  skin: '#f2dcd6', glove: '#f6f2ec', hair: '#a5502e', hairDark: '#6e2e1a', gold: '#dcb860', pearl: '#f7f1f6',
  lip: '#c4566a', mouth: '#4a1a2a', eyeWhite: '#f2eef4', iris: '#5a4474', pupil: '#160c1a', brow: '#62301e',
  feather: '#fbf8ff', jewel: '#b58ae0',
};
const COSTUMES = {
  evening: { gown: '#a898bc', gownDark: '#7e6e94', trim: '#e2c06a', lace: '#f3ecdf', sleeve: '#a898bc' },
  storm: { gown: '#7c8590', gownDark: '#59616c', trim: '#c4c8cc', lace: '#d8dade', sleeve: '#7c8590', cape: '#4f8a7a' },
  cloaked: { gown: '#7c8590', gownDark: '#59616c', trim: '#c4c8cc', lace: '#d8dade', sleeve: '#7c8590', cape: '#4f8a7a', cloak: '#9a9590' },
};

const LOOK = {
  glow: '#b48cf0', core: '#ffd68a', rim: '#d9c2ff', opacity: 0.7, maxLum: 0.7, rimAmt: 0.5, glowAmt: 0.2, bright: 1.05, tint: 0.24,
  mist: [0.02, 0.34],
};

// ---- the shapes (shared by the geometry and the pearls, which must lie on the bodice) -------------------------

const SKIRT = [[0.6, 0.02], [0.555, 0.1], [0.47, 0.24], [0.38, 0.42], [0.31, 0.6], [0.262, 0.76], [0.226, 0.88], [0.185, 0.97], [0.148, 1.03], [0.13, 1.075]];
const OVERSKIRT = [[0.415, 0.4], [0.345, 0.55], [0.292, 0.7], [0.255, 0.82], [0.22, 0.92], [0.18, 0.99], [0.152, 1.04], [0.138, 1.08]];
const TORSO = [[0.124, 1.04], [0.132, 1.1], [0.148, 1.16], [0.16, 1.21], [0.164, 1.25], [0.158, 1.29], [0.146, 1.33], [0.13, 1.365], [0.106, 1.393], [0.08, 1.415], [0.06, 1.432], [0.05, 1.445]];

/** sample a [r, y] profile at height y (linear) */
function profileR(prof, y) {
  if (y <= prof[0][1]) return prof[0][0];
  for (let i = 1; i < prof.length; i++) {
    if (y <= prof[i][1]) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return lerp(r0, r1, (y - y0) / (y1 - y0)); }
  }
  return prof[prof.length - 1][0];
}
/** resample a profile evenly in y with Catmull-Rom smoothing (so uv.v is linear in height) */
function resample(prof, n) {
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
  const curve = new THREE.SplineCurve(pts);
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
// torso cross-section: x scale and front pouch by height (root space)
const torsoSX = (y) => lerp(1.2, 1.66, smooth((y - 1.28) / 0.1)) * (1 - 0.36 * smooth((y - 1.385) / 0.06));
const torsoSZ = 0.8;
const torsoPouch = (y) => 0.032 * Math.exp(-Math.pow((y - 1.235) / 0.075, 2));
const torsoLean = (y) => 0.022 * clamp((y - 1.05) / 0.35, 0, 1);
/** front surface z of the torso at (x, y) (root space) */
function torsoFrontZ(x, y) {
  const r = profileR(TORSO, y), sx = torsoSX(y);
  const q = clamp(x / (r * sx), -0.999, 0.999);
  const front = Math.sqrt(1 - q * q);
  return r * torsoSZ * front + torsoPouch(y) * front + torsoLean(y);
}
/** how far the lace bertha stands off the bodice (k: 0 at its hem, 1 at its top) */
const berthaOff = (k) => 0.008 + 0.018 * (1 - k);
const foldFn = (th) => 0.7 * Math.sin(th * 9 + 0.6 * Math.sin(th * 4)) + 0.3 * Math.sin(th * 5 + 1);

// ---- textures ---------------------------------------------------------------------------------------------------

function skirtTexture(c) {
  return canvasTex(512, 512, (g, W, H) => {
    const r = rng(31);
    g.fillStyle = c.gown; g.fillRect(0, 0, W, H);
    // folds: shade columns with the same fold function the geometry uses, deeper toward the hem
    for (let x = 0; x < W; x++) {
      const th = (x / W) * TAU;
      const f = foldFn(th);
      const gr = g.createLinearGradient(0, 0, 0, H);
      const dark = `rgba(40,28,60,${0.2 * Math.max(0, -f)})`;
      const lite = `rgba(255,248,255,${0.16 * Math.max(0, f)})`;
      gr.addColorStop(0, f < 0 ? 'rgba(40,28,60,0.02)' : 'rgba(255,248,255,0.02)');
      gr.addColorStop(1, f < 0 ? dark : lite);
      g.fillStyle = gr; g.fillRect(x, 0, 1, H);
    }
    // silk sheen: soft diagonal lights
    g.globalAlpha = 0.06;
    for (let i = 0; i < 40; i++) { g.fillStyle = '#ffffff'; g.fillRect(r() * W, 0, 2 + r() * 5, H); }
    g.globalAlpha = 1;
    // hem embroidery band (v 0.015..0.07: canvas bottom)
    const yb = (v) => (1 - v) * H;
    g.strokeStyle = c.trim; g.lineWidth = 3;
    g.beginPath();
    for (let x = 0; x <= W; x += 2) { const y = yb(0.045 + 0.012 * Math.sin((x / W) * TAU * 14)); x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, yb(0.075)); g.lineTo(W, yb(0.075)); g.stroke();
    g.fillStyle = c.trim;
    for (let x = 0; x < W; x += 9) { g.beginPath(); g.arc(x, yb(0.022), 2.2, 0, TAU); g.fill(); }
    // scattered beads on the lower third
    for (let i = 0; i < 260; i++) {
      const v = 0.08 + Math.pow(r(), 1.8) * 0.4;
      g.globalAlpha = 0.5 * (1 - v);
      g.beginPath(); g.arc(r() * W, yb(v), 1.4, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  }, { repeatU: true });
}

/** torso atlas: rows 0..512 the bodice/skin (v 0.2..1 = y 1.04..1.445), rows 512..640 the bertha lace (v 0..0.2) */
function torsoTexture(c) {
  return canvasTex(512, 640, (g, W) => {
    const H = 512;
    const y0 = TORSO[0][1], y1 = TORSO[TORSO.length - 1][1];
    const Y = (y) => (1 - (y - y0) / (y1 - y0)) * H;
    g.fillStyle = c.gown; g.fillRect(0, 0, W, H);
    // neckline: off the shoulder, a soft sweetheart at the front (u 0/1), lower at the back
    const neckY = (u) => {
      const th = u * TAU;
      const front = Math.max(0, Math.cos(th)), back = Math.max(0, -Math.cos(th));
      return 1.36 - 0.03 * front + 0.012 * Math.abs(Math.sin(th * 2)) * front - 0.014 * back;
    };
    g.fillStyle = COLORS.skin;
    g.beginPath(); g.moveTo(0, 0);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, Y(neckY(x / W)));
    g.lineTo(W, 0); g.closePath(); g.fill();
    // soft shading under the neckline on the skin
    g.strokeStyle = 'rgba(200,150,170,0.25)'; g.lineWidth = 10;
    g.beginPath(); for (let x = 0; x <= W; x += 4) { const y = Y(neckY(x / W)) - 6; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    // collarbones and a soft shadow between them
    g.strokeStyle = 'rgba(170,120,140,0.22)'; g.lineWidth = 5;
    for (const e of [0, 1]) for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo((e + s * 0.025) * W, Y(1.425)); g.quadraticCurveTo((e + s * 0.07) * W, Y(1.41), (e + s * 0.13) * W, Y(1.415)); g.stroke();
    }
    for (const e of [0, 1]) {
      const gr = g.createRadialGradient(e * W, Y(1.35), 0, e * W, Y(1.35), 40);
      gr.addColorStop(0, 'rgba(170,120,140,0.3)'); gr.addColorStop(1, 'rgba(170,120,140,0)');
      g.fillStyle = gr; g.fillRect(e * W - 40, Y(1.38), 80, Y(1.33) - Y(1.38));
    }
    // seams
    g.strokeStyle = c.gownDark; g.globalAlpha = 0.35; g.lineWidth = 2;
    for (const u of [0.13, 0.37, 0.63, 0.87]) { g.beginPath(); g.moveTo(u * W, Y(1.04)); g.lineTo(u * W, Y(neckY(u) - 0.01)); g.stroke(); }
    g.globalAlpha = 1;
    // beading: a V of gold dots converging at the front waist, drawn at both wrap edges
    g.fillStyle = c.trim;
    for (const edge of [0, 1]) {
      for (let row = 0; row < 5; row++) {
        const uTop = 0.035 + row * 0.022;
        for (let k = 0; k <= 1; k += 0.035) {
          for (const s of [-1, 1]) {
            const u = edge + s * lerp(uTop, 0.004 + row * 0.004, k);
            const y = lerp(neckY(0) - 0.02 - row * 0.012, 1.05, k);
            g.beginPath(); g.arc(u * W, Y(y), 2.3 - row * 0.25, 0, TAU); g.fill();
          }
        }
      }
    }
    // neckline gold band and waist band
    g.strokeStyle = c.trim; g.lineWidth = 4;
    g.beginPath(); for (let x = 0; x <= W; x += 4) { const y = Y(neckY(x / W)) + 4; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.fillStyle = c.trim; g.fillRect(0, Y(1.065), W, Y(1.04) - Y(1.065));
    // lace band (rows 512..640): ivory, scalloped, with holes (alpha)
    g.clearRect(0, H, W, 128);
    g.fillStyle = c.lace; g.fillRect(0, H, W, 128);
    g.globalCompositeOperation = 'destination-out';
    const r = rng(5);
    for (let x = 4; x < W; x += 10) for (let y = H + 8; y < H + 112; y += 10) {
      g.beginPath(); g.arc(x + ((y / 10) % 2) * 5, y, 1.6 + r() * 1.0, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = c.lace; g.lineWidth = 3;
    for (let x = 0; x < W; x += 32) { g.beginPath(); g.arc(x + 16, H + 64, 13, 0, TAU); g.stroke(); }
    g.fillStyle = c.trim; g.fillRect(0, H, W, 4);
  }, { repeatU: true });
}

/** head: three's sphere UVs (u .25 = front, v 1 = top). Skin, auburn hair over the crown, rouge, a little lilac shadow. */
function headTexture() {
  return canvasTex(512, 256, (g, W, H) => {
    const X = (u) => u * W, Y = (v) => (1 - v) * H;
    g.fillStyle = COLORS.skin; g.fillRect(0, 0, W, H);
    const soft = (u, v, rx, ry, color, a) => {
      g.save(); g.translate(X(u), Y(v)); g.scale(rx * W, ry * H);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
    };
    // rouge and eyeshadow
    soft(0.17, 0.43, 0.045, 0.09, '#f08898', 0.55);
    soft(0.33, 0.43, 0.045, 0.09, '#f08898', 0.55);
    soft(0.19, 0.555, 0.03, 0.05, '#9a70c8', 0.5);
    soft(0.31, 0.555, 0.03, 0.05, '#9a70c8', 0.5);
    soft(0.25, 0.4, 0.02, 0.05, '#c9a0a0', 0.25); // under the nose
    // hair over the crown, just under the pompadour shell's hairline (so its edge never shows skin)
    g.globalAlpha = 1;
    g.fillStyle = COLORS.hair;
    const hairV = (u) => {
      const az = (u - 0.25) * TAU, f = Math.cos(az);
      const h = f > 0 ? lerp(0.08, 0.42, f * f) : lerp(0.08, -0.42, f * f);
      return 0.5 + Math.asin(h) / PI - 0.03;
    };
    g.beginPath(); g.moveTo(0, 0);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, Y(hairV(x / W)));
    g.lineTo(W, 0); g.closePath(); g.fill();
    // strands (only in the top rows, which the shell samples)
    g.strokeStyle = COLORS.hairDark; g.globalAlpha = 0.3; g.lineWidth = 1.5;
    const r = rng(17);
    for (let i = 0; i < 220; i++) { const x = r() * W, y = r() * Y(0.76); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y + 6, x + 2, y + 14); g.stroke(); }
    g.strokeStyle = '#d27a4a'; g.globalAlpha = 0.25;
    for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * Y(0.76); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 4, y + 6, x, y + 12); g.stroke(); }
    g.globalAlpha = 1;
    // white patch at the very bottom (under the chin): other merged parts sample it
    g.fillStyle = '#ffffff'; g.fillRect(0, H - 6, W, 6);
  }, { repeatU: true });
}

// ---- the gestures (torso frame: origin at the waist, +Z forward, left = +X) -------------------------------------

const P_DOWN_R = [-0.55, -0.35, -1];
const REST = {
  folded: { R: T([-0.05, 0.035, 0.19], [0.9, -0.42, 0.12], [0.05, 0.3, -1], P_DOWN_R, 0.38), L: T([0.06, 0.005, 0.178], [-0.85, -0.52, 0.1], [0, 0.35, -1], [0.55, -0.35, -1], 0.45) },
  side: { R: T([-0.228, -0.16, 0.06], [0.06, -1, 0.18], [1, 0, 0.1], [-0.6, 0, -1], 0.32), L: T([0.228, -0.16, 0.06], [-0.06, -1, 0.18], [-1, 0, 0.1], [0.6, 0, -1], 0.32) },
  lap: { R: T([-0.07, -0.09, 0.27], [0.75, -0.25, 0.55], [0, -1, 0.1], [-0.7, -0.2, -1], 0.4), L: T([0.075, -0.1, 0.25], [-0.7, -0.25, 0.6], [0, -1, 0.1], [0.7, -0.2, -1], 0.4) },
};
const G = {
  brow: T([-0.03, 0.62, 0.15], [0.75, 0.55, 0.0], [0, 0.15, 1], [-1, 0.4, -0.2], 0.22),
  flourishA: T([-0.36, 0.4, 0.3], [-0.45, 0.65, 0.6], [0.1, 1, 0.2], [-1, -0.5, -0.3], 0.08),
  flourishB: T([-0.47, 0.18, 0.27], [-1, -0.05, 0.45], [0, 0.65, 0.6], [-1, -0.6, -0.3], 0.18),
  pearls: T([-0.025, 0.14, 0.215], [0.35, 0.78, 0.2], [0.2, 0, -1], [-1, -0.6, -0.2], 0.68),
  present: T([-0.42, 0.12, 0.34], [-0.55, 0.05, 0.85], [0, 1, 0.1], [-1, -0.6, -0.2], 0.15),
  clap: T([-0.04, 0.24, 0.27], [0.1, 0.7, 0.7], [1, 0, 0], [-1, -0.5, -0.4], 0.12),
  shriek: T([-0.17, 0.62, 0.16], [-0.1, 1, 0.12], [0, 0, 1], [-1, -0.4, -0.2], 0.04),
  curtsey: T([-0.34, -0.2, 0.13], [-0.8, -0.5, 0.2], [0, -1, 0.2], [-1, 0.1, -0.3], 0.62),
  chest: T([-0.02, 0.25, 0.205], [0.3, 0.82, 0.2], [0, 0, -1], [-1, -0.6, -0.2], 0.3),
  mouth: T([-0.015, 0.435, 0.18], [0.15, 1, 0.22], [0, 0, -1], [-1, -0.6, -0.1], 0.35),
  fend: T([-0.08, 0.26, 0.23], [0, 1, 0.3], [0, 0, 1], [-1, -0.5, -0.2], 0.08),
  hair: T([-0.13, 0.63, -0.02], [0.4, 0.6, -0.45], [0.7, 0, 0.2], [-1, 0.7, 0.3], 0.3),
  gloveR: T([-0.07, 0.12, 0.22], [0.3, 0.3, 0.9], [0, 1, 0], [-1, -0.6, -0.2], 0.2),
  gloveL: T([0.0, 0.14, 0.27], [-0.6, 0.2, 0.6], [0, -1, 0], [1, -0.6, -0.2], 0.62),
  point: T([-0.3, 0.32, 0.42], [-0.4, 0.3, 0.9], [0.8, 0, 0], [-1, -0.5, -0.2], 0.55),
};
const GM = {}; // mirrored (left-arm) versions
for (const [k, v] of Object.entries(G)) GM[k] = mirrorT(v);

const DUR = {
  perk: 1.4, flinch: 1.1, drift: 2.4, bow: 2.8, flourish: 1.7, sigh: 2.4, nod: 0.7, shake: 1.0, laugh: 1.8, gasp: 1.5,
  shriek: 1.4, gesture: 1.8, brow: 2.6, clap: 1.8, sad: 3.0, pearls: 3.6, hairPat: 2.4, glove: 2.4, fade: 3.0,
  appear: 1.8, uncloak: 1.8, point: 2.0, think: 2.6, chest: 1.6,
};
const ALIAS = { curtsey: 'bow', swoon: 'brow', worry: 'pearls', wave: 'flourish', present: 'gesture', cry: 'sad', shrug: 'sigh', fadeOut: 'fade', fadeIn: 'appear' };

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _arm = { R: newT(), L: newT() };

export class Lavinia extends Character {
  constructor(ctx, { companion = true, light = true } = {}) {
    super(ctx, 'lavinia', { companion });
    this.group.renderOrder = 2; // draw after the room's own transparent things (see ghost.js)
    this.U = ghostUniforms(LOOK);
    this.costume = 'evening';
    this._tex = {};
    this.root = new THREE.Object3D();
    this.group.add(this.root);

    this._buildSkirt();
    this._buildTorso();
    this._buildHead();
    this._buildArms();
    this._buildPearls();
    this._buildCostumeExtras();
    this._buildFx(light);
    this._buildHitProxy(); // ENGINE-FIX

    // animation state
    this._fx = [];
    this._pose = { stand: 1, hover: 0, perch: 0 };
    this._poseTo = 'stand';
    this._poseResolve = null;
    this._poseSpeed = 1.4;
    this._presence = 1; this._presenceTarget = 1;
    this._hover = 0;
    this._talkAmt = 0;
    this._headYaw = 0; this._headPitch = 0; this._headRoll = 0; this._bodyYaw = 0;
    this._eyeYaw = 0; this._eyePitch = 0;
    this._idleYaw = 0; this._idlePitch = 0; this._idleTimer = rand(2, 5);
    this._blinkTimer = rand(1.5, 4); this._blink = 0;
    this._gestureTimer = rand(5, 9);
    this._talkGestureTimer = 2;
    this._restSide = 0; this._restSideTarget = 0;
    this._sway = { x: 0, z: 0, vx: 0, vz: 0, tw: 0, vtw: 0 };
    this._lastWorld = new THREE.Vector3(); this._hasLast = false;
    this._lastYaw = 0;
    this._drift = null;
    this._plume = { a: 0, v: 0, b: 0, vb: 0 };
    this._t = 0;
    this._pose_y = 0;
    this.update(0, 0);
  }

  // ---------------------------------------------------------------- construction

  _mats(map, partGlow = 0) { return ghostMaterials(this.U, { map, partGlow }); }

  _buildSkirt() {
    const tex = skirtTexture(COSTUMES.evening);
    this._tex.skirt = { evening: tex };
    const mats = this._mats(tex);
    const SEG = 48; // ENGINE-FIX tris: was 72, rows 30 + 22 (the folds and scallops still read; the silhouette is the same)
    const deformBase = (v, th, k, isOver) => {
      const y = v.y;
      const below = clamp((WAIST + 0.02 - y) / (WAIST - 0.02), 0, 1);
      let s = 1 + 0.034 * Math.pow(below, 1.2) * foldFn(th);
      const back = Math.max(0, -Math.cos(th));
      s *= 1 + 0.32 * back * back * Math.pow(clamp(1 - y / 0.62, 0, 1), 2); // the train
      s *= 1 - 0.07 * Math.max(0, Math.cos(th)) * smooth((0.95 - y) / 0.4); // flatter front
      v.x *= s; v.z *= s;
      v.z -= 0.03 * smooth((WAIST - y) / 0.22); // hips back (the S-bend)
      if (isOver && k < 0.16) v.y += 0.045 * (1 - Math.abs(Math.sin(th * 7))) * (1 - k / 0.16); // scallops
    };
    const under = lathe(resample(SKIRT, 18), SEG, (v, th, k) => deformBase(v, th, k, false));
    const over = lathe(resample(OVERSKIRT, 13), SEG, (v, th, k) => deformBase(v, th, k, true));
    // the overskirt sits a whisker outside the underskirt everywhere
    { const p = over.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * 1.02, p.getY(i), p.getZ(i) * 1.02); over.computeVertexNormals(); }
    paint(under, '#e8e4ee'); paint(over, '#ffffff');
    const geo = merge([under, over]);
    this.skirt = this._deformable(geo, mats);
    this.root.add(this.skirt.mesh);
  }

  /** a CPU-deformed ghost mesh: keeps base positions and per-vertex (theta, k, r) */
  _deformable(geo, mats) {
    const pos = geo.attributes.position;
    pos.setUsage(THREE.DynamicDrawUsage);
    geo.attributes.normal.setUsage(THREE.DynamicDrawUsage);
    const n = pos.count;
    const base = new Float32Array(pos.array);
    const th = new Float32Array(n), kk = new Float32Array(n), rr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      th[i] = Math.atan2(x, z); rr[i] = Math.hypot(x, z);
      kk[i] = clamp((WAIST + 0.02 - y) / (WAIST - 0.02), 0, 1);
    }
    geo.computeBoundingSphere();
    geo.boundingSphere.radius += 0.6;
    const mesh = ghostMesh(geo, mats);
    mesh.frustumCulled = false;
    mesh.userData.twin.frustumCulled = false;
    return { mesh, geo, base, th, kk, rr, frame: 0 };
  }

  _buildTorso() {
    const prof = resample(TORSO, 20); // ENGINE-FIX tris: was 26 rows x 56
    const torso = lathe(prof, 40, (v, th) => {
      const y = v.y;
      const front = Math.max(0, Math.cos(th));
      v.x *= torsoSX(y);
      v.z = v.z * torsoSZ + torsoPouch(y) * front + torsoLean(y);
    });
    paint(torso, '#ffffff');
    remapUV(torso, 0, 0.2, 1, 1);
    // bertha: a lace frill falling from the neckline over the shoulders
    const bertha = lathe([[1, 1.285], [1, 1.31], [1, 1.335], [1, 1.36], [1, 1.382]], 56, (v, th, k) => {
      const front = Math.max(0, Math.cos(th));
      const y = v.y - (0.012 + 0.03 * k) * front;
      const R = profileR(TORSO, y) + berthaOff(k);
      v.set(Math.sin(th) * R * torsoSX(y), y, Math.cos(th) * R * torsoSZ + torsoPouch(y) * front + torsoLean(y));
      if (k < 0.3) v.y += 0.008 * Math.sin(th * 22) * (1 - k / 0.3);
    });
    paint(bertha, '#ffffff');
    remapUV(bertha, 0, 0, 3, 0.2);
    // sash at the waist
    const sash = new THREE.TorusGeometry(0.128, 0.012, 6, 32); // ENGINE-FIX tris: was 8 x 48
    place(sash, { p: [0, 1.058, 0.004], r: [PI / 2, 0, 0], s: [1.2, 0.8, 1] });
    paint(sash, '#ffffff'); remapUV(sash, 0.5, 0.205);
    // a lily-shaped brooch at the bust (gold)
    const brooch = ellipsoid(0.014, 0.018, 0.008, [0, 1.3, torsoFrontZ(0, 1.3) + 0.004], { ws: 10, hs: 8 }); // ENGINE-FIX tris
    paint(brooch, COLORS.gold); remapUV(brooch, 0.5, 0.97);
    const geo = merge([torso, bertha, sash, brooch]);
    // into torso space (origin at the waist)
    geo.translate(0, -WAIST, 0);
    const tex = torsoTexture(COSTUMES.evening);
    this._tex.torso = { evening: tex };
    this.chest = new THREE.Object3D();
    this.chest.position.set(0, WAIST, 0);
    this.root.add(this.chest);
    this.torsoMesh = ghostMesh(geo, this._mats(tex));
    this.chest.add(this.torsoMesh);
    // neck (moves a little with the head)
    this.neck = new THREE.Object3D();
    this.neck.position.set(0, 0.39, 0.012);
    this.chest.add(this.neck);
    const neckGeo = paint(capsuleAB([0, -0.03, -0.006], [0, 0.1, 0.012], 0.05, 0.045, { radial: 12, cap: 3 }), COLORS.skin); // ENGINE-FIX tris
    this.neck.add(ghostMesh(neckGeo, this._mats(null)));
  }

  _buildHead() {
    const head = new THREE.Object3D();
    head.position.set(0, 0.072, 0.016);
    head.rotation.order = 'YXZ';
    this.neck.add(head);
    this.head = head;
    const C = [0, 0.078, 0]; // head centre in head-pivot space
    const at = (x, y, z) => [C[0] + x, C[1] + y, C[2] + z];
    const parts = [];
    // skull / face: an oval, narrower at the jaw, a soft chin
    // ENGINE-FIX tris: head spheres were 40 x 28 / 40 x 24 and the small parts 12 x 10 or finer
    const skull = displacedSphere(28, 20, (v) => {
      let x = v.x, y = v.y, z = v.z;
      if (y < 0) { x *= 1 + 0.2 * y; z *= 1 + 0.05 * y; }
      if (y < -0.55) z += 0.06 * (-0.55 - y) * Math.max(0, v.z);
      if (z > 0.7) z = 0.7 + (z - 0.7) * 0.75;
      v.set(x * 0.088 + C[0], y * 0.114 + C[1], z * 0.1 + C[2]);
    });
    paint(skull, '#ffffff');
    parts.push(skull);
    const solid = (geo, hex) => { paint(geo, hex); remapUV(geo, 0.5, 0.004); parts.push(geo); return geo; };
    // nose
    solid(ellipsoid(0.0075, 0.02, 0.009, at(0, -0.01, 0.089), { r: [-0.32, 0, 0], ws: 12, hs: 8 }), COLORS.skin);
    solid(ellipsoid(0.0092, 0.0078, 0.0082, at(0, -0.027, 0.0955), { ws: 12, hs: 8 }), COLORS.skin);
    // mouth interior (seen when the lips part)
    solid(ellipsoid(0.016, 0.006, 0.006, at(0, -0.05, 0.089), { ws: 8, hs: 6 }), COLORS.mouth);
    // ears + pearl drops
    for (const s of [1, -1]) {
      solid(ellipsoid(0.011, 0.024, 0.016, at(s * 0.086, -0.006, -0.004), { r: [0, s * 0.3, 0], ws: 10, hs: 8 }), COLORS.skin);
      solid(ellipsoid(0.0035, 0.0035, 0.0035, at(s * 0.09, -0.028, 0.002), { ws: 6, hs: 4 }), COLORS.gold);
      solid(ellipsoid(0.0075, 0.0095, 0.0075, at(s * 0.091, -0.042, 0.002), { ws: 10, hs: 7 }), COLORS.pearl);
    }
    // hair: a Gibson-girl pompadour, a soft shell over the skull that swells at the front and sides and tucks in
    // under the hairline (hidden inside the head); a bun on top; curls at the temples and the nape
    const hairline = (az) => { const f = Math.cos(az); return f > 0 ? lerp(0.08, 0.42, f * f) : lerp(0.08, -0.42, f * f); };
    const shell = displacedSphere(28, 16, (v) => {
      const az = Math.atan2(v.x, v.z), d = v.y - hairline(az);
      const front = Math.max(0, Math.cos(az)), side = Math.abs(Math.sin(az));
      const on = smooth(d / 0.22);
      const puff = d < 0 ? -0.04 : on * (0.1 + 0.32 * front * front * smooth((0.85 - v.y) / 0.5) + 0.14 * side + 0.06 * smooth(v.y));
      let x = v.x, y = v.y, z = v.z;
      if (y < 0) { x *= 1 + 0.2 * y; z *= 1 + 0.05 * y; }
      if (z > 0.7) z = 0.7 + (z - 0.7) * 0.75;
      v.set(x * 0.088 * (1 + puff) + C[0], y * 0.114 * (1 + puff * 0.7) + C[1] + 0.006 * on, z * 0.1 * (1 + puff) + C[2] - 0.006 * on * front);
    });
    paint(shell, '#ffffff');
    { const uv = shell.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, lerp(0.74, 0.99, uv.getY(i))); }
    parts.push(shell);
    solid(ellipsoid(0.056, 0.042, 0.054, at(0, 0.13, -0.03), { ws: 18, hs: 11 }), COLORS.hair);
    solid(ellipsoid(0.03, 0.024, 0.03, at(0, 0.168, -0.034), { ws: 12, hs: 8, r: [0.2, 0, 0.3] }), COLORS.hairDark);
    for (const s of [1, -1]) {
      solid(ellipsoid(0.012, 0.018, 0.013, at(s * 0.083, 0.03, 0.03), { ws: 9, hs: 7 }), COLORS.hair);
      solid(ellipsoid(0.014, 0.019, 0.014, at(s * 0.07, -0.04, -0.048), { ws: 9, hs: 7 }), COLORS.hair);
    }
    solid(ellipsoid(0.03, 0.03, 0.025, at(0, -0.05, -0.075), { ws: 10, hs: 8 }), COLORS.hair);
    // the aigrette's band (gold) around the bun, and its jewel at the left front
    const band = new THREE.TorusGeometry(0.06, 0.0045, 5, 32);
    place(band, { p: at(0, 0.122, -0.02), r: [PI / 2 - 0.3, 0, 0.1] });
    solid(band, COLORS.gold);
    const J = at(0.046, 0.138, 0.03);
    solid(ellipsoid(0.013, 0.016, 0.009, J, { ws: 12, hs: 8, r: [-0.3, 0.5, 0] }), COLORS.gold);
    solid(ellipsoid(0.0075, 0.0095, 0.006, [J[0] + 0.004, J[1], J[2] + 0.006], { ws: 8, hs: 6, r: [-0.3, 0.5, 0] }), COLORS.jewel);
    const headGeo = merge(parts);
    this._tex.head = headTexture();
    head.add(ghostMesh(headGeo, this._mats(this._tex.head)));

    // the aigrette plume: a spray of thin egret feathers, springing from the jewel
    const plume = new THREE.Object3D();
    plume.position.set(J[0], J[1] + 0.008, J[2] - 0.004);
    plume.rotation.set(-0.12, 0.3, -0.32);
    head.add(plume);
    const feathers = [];
    const r = rng(23);
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) * 0.11 + (r() - 0.5) * 0.05;
      const L = 0.11 + r() * 0.07 - Math.abs(i - 4) * 0.008;
      const pts = [];
      for (let k = 0; k <= 4; k++) {
        const u = k / 4;
        pts.push([Math.sin(a) * L * u + 0.012 * u * u, L * u, -0.035 * u * u + Math.cos(a * 3) * 0.004 * u]);
      }
      feathers.push(paint(tubeAlong(pts, 0.0032, { segs: 6, radial: 4, taper: 0.7 }), COLORS.feather)); // ENGINE-FIX tris: 10 x 5, wisps 6 x 4
      // wisps along the shaft
      for (let w = 0; w < 4; w++) {
        const u = 0.45 + w * 0.13;
        const p0 = [Math.sin(a) * L * u, L * u, -0.035 * u * u];
        const side = w % 2 ? 1 : -1;
        feathers.push(paint(tubeAlong([p0, [p0[0] + side * 0.018, p0[1] + 0.02, p0[2] - 0.006], [p0[0] + side * 0.026, p0[1] + 0.045, p0[2] - 0.012]], 0.0016, { segs: 3, radial: 3, taper: 0.8 }), COLORS.feather));
      }
    }
    plume.add(ghostMesh(merge(feathers), this._mats(null, 0.12)));
    this.plume = plume;
    this._plumeRest = plume.rotation.clone();

    // eyes: a gaze mesh (white, iris, pupil, glint) and an upper lid with lashes, per side
    this.eyes = [];
    for (const s of [1, -1]) {
      const socket = new THREE.Object3D();
      socket.position.set(...at(s * 0.0315, 0.009, 0.08));
      socket.rotation.order = 'YXZ';
      socket.rotation.set(-0.06, s * 0.28, 0);
      socket.scale.set(1.12, 0.84, 0.72);
      head.add(socket);
      const unit = new THREE.Object3D(); unit.scale.setScalar(0.0136); socket.add(unit);
      const gaze = new THREE.Object3D(); unit.add(gaze);
      // ENGINE-FIX tris: eyeball 20 x 14, iris 16 x 10, pupil 12 x 8, glint 8 x 6, lid 20 x 7, lash 4 x 18
      const ball = paint(new THREE.SphereGeometry(1, 12, 8), COLORS.eyeWhite);
      const iris = paint(ellipsoid(0.56, 0.56, 0.24, [0, 0, 0.86], { ws: 14, hs: 8 }), COLORS.iris);
      const pupil = paint(ellipsoid(0.27, 0.27, 0.12, [0, 0, 0.99], { ws: 10, hs: 6 }), COLORS.pupil);
      const glint = paint(ellipsoid(0.13, 0.13, 0.05, [0.24, 0.28, 1.0], { ws: 6, hs: 4 }), '#ffffff');
      gaze.add(ghostMesh(merge([ball, iris, pupil, glint]), this._mats(null)));
      const lidG = paint(new THREE.SphereGeometry(1.1, 16, 6, 0, TAU, 0, PI / 2), COLORS.skin);
      const lash = new THREE.TorusGeometry(1.11, 0.085, 3, 14, PI);
      lash.rotateX(PI / 2);
      paint(lash, '#3a1a24');
      const lid = ghostMesh(merge([lidG, lash]), this._mats(null));
      unit.add(lid);
      this.eyes.push({ side: s, gaze, lid });
    }
    // brows
    this.brows = [];
    for (const s of [1, -1]) {
      const piv = new THREE.Object3D();
      piv.position.set(...at(s * 0.032, 0.036, 0.094));
      head.add(piv);
      const g = paint(tubeAlong([[-s * 0.02, -0.004, 0.003], [0, 0.004, 0], [s * 0.022, -0.003, -0.012]], 0.0024, { segs: 10, radial: 5, taper: 0.55 }), COLORS.brow);
      piv.add(ghostMesh(g, this._mats(null)));
      this.brows.push({ side: s, piv });
    }
    // lips
    this.lipU = ghostMesh(paint(ellipsoid(0.0175, 0.0052, 0.0075, [0, 0, 0], { ws: 12, hs: 6 }), COLORS.lip), this._mats(null));
    this.lipU.position.set(...at(0, -0.0445, 0.0915));
    this.lipL = ghostMesh(paint(ellipsoid(0.0155, 0.0062, 0.0078, [0, 0, 0], { ws: 12, hs: 6 }), COLORS.lip), this._mats(null));
    this.lipL.position.set(...at(0, -0.0545, 0.0895));
    head.add(this.lipU, this.lipL);
    this._lipLy = this.lipL.position.y; this._lipUy = this.lipU.position.y;
  }

  _buildArms() {
    this.arms = {};
    for (const [key, side] of [['L', 1], ['R', -1]]) {
      // upper arm (skin) with a puff sleeve at the shoulder and the glove's top above the elbow
      // ENGINE-FIX tris: sleeve 18 x 12, arm capsules radial 14
      const sleeve = paint(ellipsoid(0.054, 0.062, 0.052, [0, 0.03, 0], { ws: 12, hs: 8 }), COSTUMES.evening.sleeve);
      const sleeveCount = sleeve.attributes.position.count;
      const upperGeo = merge([
        sleeve,
        paint(capsuleAB([0, 0, 0], [0, UPPER, 0], 0.036, 0.03, { radial: 10, cap: 3 }), COLORS.skin),
        paint(capsuleAB([0, UPPER - 0.07, 0], [0, UPPER, 0], 0.0322, 0.0312, { radial: 10, cap: 2 }), COLORS.glove),
        paint(place(new THREE.TorusGeometry(0.0322, 0.0035, 4, 12), { p: [0, UPPER - 0.07, 0], r: [PI / 2, 0, 0] }), COLORS.glove),
      ]);
      const upper = ghostMesh(upperGeo, this._mats(null));
      upper.userData.sleeveCount = sleeveCount;
      const foreGeo = paint(capsuleAB([0, 0, 0], [0, FORE, 0], 0.0305, 0.0215, { radial: 10, cap: 3 }), COLORS.glove);
      const fore = ghostMesh(foreGeo, this._mats(null));
      const hand = buildHand(side, COLORS.glove, { scale: 0.96 });
      const handMesh = ghostMesh(hand.geo, this._mats(null));
      this.chest.add(upper, fore, handMesh);
      const shoulder = SHOULDER.clone(); shoulder.x *= side;
      this.arms[key] = new ArmRig({ side, shoulder, a: UPPER, b: FORE, upper, fore, hand: handMesh, setCurl: hand.setCurl });
    }
  }

  _buildPearls() {
    const N = 56;
    const geo = paint(new THREE.SphereGeometry(0.006, 6, 5), COLORS.pearl); // ENGINE-FIX tris: was 10 x 8 (x 56 pearls)
    this.pearls = ghostMesh(geo, this._mats(null, 0.14), { instanced: N });
    this.pearls.frustumCulled = false;
    this.pearls.userData.twin.frustumCulled = false;
    this.pearls.count = N;
    this.chest.add(this.pearls);
    this._pearlN = N;
    // rest control points, torso space, lying on the bodice
    // over the bertha where it covers the bodice (front: y 1.273 .. 1.34)
    const lace = (y) => (y > 1.27 && y < 1.345 ? berthaOff(clamp((y - 1.273) / 0.067, 0, 1)) + 0.004 : 0);
    const on = (x, y, lift = 0.008) => new THREE.Vector3(x, y - WAIST, torsoFrontZ(x, y) + lift + lace(y));
    this._pearlRest = [
      new THREE.Vector3(0.047, 1.452 - WAIST, -0.004),
      new THREE.Vector3(0.062, 1.425 - WAIST, 0.042),
      on(0.068, 1.37), on(0.06, 1.31, 0.009), on(0.03, 1.235, 0.012), on(0, 1.215, 0.013),
    ];
    // mirror to build the full U
    const half = this._pearlRest;
    this._pearlCtrl = [...half, ...half.slice(0, -1).reverse().map((p) => new THREE.Vector3(-p.x, p.y, p.z))];
    this._pearlWork = this._pearlCtrl.map((p) => p.clone());
    this._pearlCurve = new THREE.CatmullRomCurve3(this._pearlWork, false, 'centripetal');
    this._pearlM = new THREE.Matrix4();
  }

  _buildCostumeExtras() {
    // storm cape (sea-green oilskin, hood down), open at the front, on the torso
    const cape = latheOpen([[0.42, 0.68], [0.33, 0.85], [0.27, 1.05], [0.235, 1.22], [0.215, 1.33], [0.15, 1.415], [0.075, 1.45]], 48, 0.9, (v, th, k) => {
      v.x *= 1.2; v.z *= 1.0;
      v.z -= 0.012;
      const s = 1 + 0.035 * (1 - k) * Math.sin(th * 7);
      v.x *= s; v.z *= s;
    });
    paint(cape, '#ffffff');
    // the hood, fallen back: a soft roll across the shoulders behind the neck
    const hood = paint(new THREE.TorusGeometry(0.1, 0.03, 8, 24, PI), '#ffffff');
    place(hood, { p: [0, 1.4, -0.06], r: [PI / 2 + 0.5, 0, PI], s: [1.15, 1, 1] });
    const capeGeo = merge([cape, hood]);
    capeGeo.translate(0, -WAIST, 0);
    this.cape = ghostMesh(capeGeo, this._mats(null));
    this.cape.visible = false;
    this.chest.add(this.cape);
    // finale cloak (dove grey, floor length, nearly closed), deformed with the skirt
    const cloakG = latheOpen(resample([[0.66, 0.03], [0.58, 0.2], [0.47, 0.45], [0.37, 0.75], [0.3, 1.0], [0.27, 1.2], [0.24, 1.33], [0.15, 1.425], [0.08, 1.46]], 16), 42, 0.22, (v, th, k) => { // ENGINE-FIX tris: was 34 rows x 64
      v.x *= 1 + 0.1 * smooth((v.y - 1.0) / 0.35); v.z *= 1.04;
      const s = 1 + 0.045 * (1 - k) * foldFn(th + 0.4);
      v.x *= s; v.z *= s;
      v.z -= 0.012;
    });
    paint(cloakG, '#ffffff');
    this.cloak = this._deformable(cloakG, this._mats(null));
    this.cloak.mesh.visible = false;
    this.root.add(this.cloak.mesh);
    this._cloakFly = 0;
  }

  _buildFx(withLight) {
    this.haze = makeHaze('#b49ae6', 1.7, 2.5);
    this.haze.position.set(0, 1.05, -0.05);
    this.root.add(this.haze);
    this.mist = makePuffs(22, 0.55);
    this.root.add(this.mist);
    this._mistSeed = Array.from({ length: 22 }, (_, i) => ({ a: (i / 22) * TAU + Math.random() * 0.3, r: 0.38 + Math.random() * 0.22, y: Math.random() * 0.22, s: 0.15 + Math.random() * 0.2, ph: Math.random() * TAU }));
    this.motes = makePuffs(40, 0.03);
    this.root.add(this.motes);
    this._motes = Array.from({ length: 40 }, () => this._newMote(true));
    this._moteBurst = 0;
    if (withLight) {
      this.light = new THREE.PointLight('#e8ccff', 0.9, 3.2, 2);
      this.light.position.set(0, 1.25, 0.35);
      this.light.castShadow = false;
      this.root.add(this.light);
      this._lightBase = 0.9;
    }
  }

  // ENGINE-FIX: full-body click target. The gown, torso and arms are shader-displaced, so the raycast mostly found
  // her head; an invisible lathe of her silhouette from hem to crown (child of root, so it follows pose, bob and drift)
  // makes the whole figure clickable, even through a rail just in front of her (qa-foyer: the balcony balusters hid
  // the gown). Hidden material + noHighlight: the hover glow stays on the real meshes.
  _buildHitProxy() {
    // her silhouette, hem to crown (radius, height): wide skirt, waist, shoulders, neck, head; arms sit inside it
    const profile = [[0, 0], [0.4, 0], [0.36, 0.3], [0.27, 0.7], [0.19, 1.0], [0.18, 1.1], [0.22, 1.35], [0.2, 1.45],
      [0.09, 1.52], [0.12, 1.62], [0.12, 1.76], [0.06, 1.86], [0, 1.87]].map(([r, y]) => new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(profile, 12);
    this.hitProxy = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
    this.hitProxy.name = 'lavinia.hitProxy';
    this.hitProxy.userData.hitProxy = true;
    this.hitProxy.userData.noHighlight = true;
    this.group.userData.reachThrough = 0.9; // a rail or desk just in front of her doesn't hide her (Interaction.pick)
    this.root.add(this.hitProxy);
  }

  _newMote(initial = false, burst = false) {
    const a = Math.random() * TAU, r = burst ? 0.1 + Math.random() * 0.45 : 0.25 + Math.random() * 0.4;
    return { x: Math.sin(a) * r, z: Math.cos(a) * r, y: burst ? 0.3 + Math.random() * 1.4 : initial ? Math.random() * 1.9 : 0.1, vy: burst ? 0.25 + Math.random() * 0.4 : 0.05 + Math.random() * 0.06, life: 0, max: burst ? 1.2 + Math.random() * 1.6 : 4 + Math.random() * 4, ph: Math.random() * TAU, burst };
  }

  // ---------------------------------------------------------------- public API

  placeAt(parentGroup, { position = [0, 0, 0], rotationY = 0, pose = null, hotspot = null, label = null, scope = null, costume = null } = {}) {
    if (this._drift) { const d = this._drift; this._drift = null; d.resolve(); }
    super.placeAt(parentGroup, { position, rotationY, pose: null, hotspot, label, scope });
    if (pose) this.setPose(pose, 0);
    // ENGINE-FIX: the costume follows the story unless the room says otherwise: storm once the dummy is dressed
    // (deliverable.costume), the evening gown before; a reload into any room now matches.
    if (!costume) {
      const st = this.ctx.state;
      costume = st && (st.isSolved?.('dummy') || st.get?.('deliverable.costume')) ? 'storm' : 'evening';
    }
    this.setCostume(costume);
    this._hasLast = false;
    this._presence = this._presenceTarget = 1;
    this._bodyYaw = 0;
    return this;
  }

  /** 'stand' | 'perch' (sitting on a rail or box: position = the top of it) | 'hover'. Aliases: sit → perch, float → hover. */
  setPose(name, duration = 0.9) {
    const map = { sit: 'perch', seated: 'perch', float: 'hover', floating: 'hover', standing: 'stand', idle: 'stand' };
    const p = map[name] || name;
    if (!(p in LAVINIA_POSES)) return Promise.resolve();
    this.pose = p;
    if (this._poseResolve) { const r = this._poseResolve; this._poseResolve = null; r(); }
    this._poseTo = p;
    if (duration <= 0) {
      for (const k of Object.keys(this._pose)) this._pose[k] = k === p ? 1 : 0;
      return Promise.resolve();
    }
    this._poseSpeed = 1 / duration;
    return new Promise((res) => { this._poseResolve = res; });
  }

  setCostume(name) {
    if (!COSTUMES[name]) return;
    this.costume = name;
    const c = COSTUMES[name];
    const key = name === 'cloaked' ? 'storm' : name;
    this._tex.skirt[key] ||= skirtTexture(c);
    this._tex.torso[key] ||= torsoTexture(c);
    this.skirt.mesh.material.uniforms.uMap.value = this._tex.skirt[key];
    this.torsoMesh.material.uniforms.uMap.value = this._tex.torso[key];
    // sleeves
    const col = new THREE.Color(c.sleeve);
    for (const arm of Object.values(this.arms)) {
      const g = arm.upper.geometry, n = arm.upper.userData.sleeveCount, a = g.attributes.color;
      for (let i = 0; i < n; i++) a.setXYZ(i, col.r, col.g, col.b);
      a.needsUpdate = true;
    }
    this.cape.visible = !!c.cape && !c.cloak;
    if (c.cape) this._recolor(this.cape.geometry, c.cape);
    this.cloak.mesh.visible = !!c.cloak;
    this._cloakFly = 0;
    if (c.cloak) { this._recolor(this.cloak.geo, c.cloak); this.cloak.mesh.position.set(0, 0, 0); this.cloak.mesh.rotation.set(0, 0, 0); this.cloak.mesh.scale.setScalar(1); }
  }

  _recolor(geo, hex) {
    const c = new THREE.Color(hex), a = geo.attributes.color;
    for (let i = 0; i < a.count; i++) a.setXYZ(i, c.r, c.g, c.b);
    a.needsUpdate = true;
  }

  /** 0 = gone (a faint shimmer at most), 1 = fully present. `fade` / `appear` reactions animate it. */
  setPresence(k) { this._presence = this._presenceTarget = clamp(k, 0, 1); }
  get presence() { return this._presence; }

  lookAt(point) {
    if (!point) { this._look = null; return; }
    this._look = Array.isArray(point) ? new THREE.Vector3(point[0], point[1], point[2]) : point.clone();
  }

  /**
   * Reactions (→ Promise): perk flinch drift bow flourish sigh nod shake laugh gasp shriek gesture brow clap sad
   * pearls hairPat glove point think fade appear uncloak (+ aliases curtsey swoon worry wave present cry shrug).
   * Unknown names do a small generic beat.
   */
  react(name) {
    const kind = ALIAS[name] || name;
    const dur = DUR[kind] ?? 0.8;
    if (kind === 'fade') { this._presenceTarget = 0; this._moteBurst = 1; }
    if (kind === 'appear') { this._presenceTarget = 1; if (this._presence > 0.98) this._presence = 0; this._moteBurst = 1; }
    if (kind === 'uncloak') { if (this.costume !== 'cloaked') return Promise.resolve(); this._cloakFly = 0.0001; }
    if (kind === 'drift') this._driftSide = Math.random() < 0.5 ? -1 : 1;
    const fx = { kind: DUR[kind] ? kind : 'beat', t: 0, dur, resolve: null };
    const p = new Promise((res) => { fx.resolve = res; });
    // drop an older gesture of the same kind
    for (const e of this._fx) if (e.kind === fx.kind) { e.t = e.dur; }
    this._fx.push(fx);
    // safety: resolve even if she is not being updated (not in the current room)
    setTimeout(() => { if (!fx.done) { fx.done = true; fx.resolve(); } }, (dur + 1.5) * 1000);
    return p;
  }

  /**
   * Drift to a point in the parent group's space along a gentle arc, then settle. Options: duration (default by
   * distance, about 1.2 s for 1.5 m), rotationY (final facing; default: the direction travelled), pose (on arrival).
   */
  moveTo(target, { duration, rotationY = null, pose = null } = {}) {
    if (this._drift) { const d = this._drift; this._drift = null; d.resolve(); }
    if (this._move) { const m = this._move; this._move = null; m.resolve(); }
    const from = this.group.position.clone();
    const to = new THREE.Vector3(target[0], target[1], target[2]);
    const dist = from.distanceTo(to);
    const dx = to.x - from.x, dz = to.z - from.z;
    const yaw0 = this.group.rotation.y;
    let yaw1 = Math.hypot(dx, dz) > 0.05 ? Math.atan2(dx, dz) : yaw0;
    while (yaw1 - yaw0 > PI) yaw1 -= TAU;
    while (yaw1 - yaw0 < -PI) yaw1 += TAU;
    let yaw2 = rotationY ?? yaw1;
    while (yaw2 - yaw1 > PI) yaw2 -= TAU;
    while (yaw2 - yaw1 < -PI) yaw2 += TAU;
    const side = new THREE.Vector3(dz, 0, -dx).normalize().multiplyScalar(Math.min(0.25, dist * 0.12) * (Math.random() < 0.5 ? 1 : -1));
    const mid = from.clone().lerp(to, 0.5).add(side);
    mid.y += Math.min(0.14, 0.04 + dist * 0.05);
    const dir = to.clone().sub(from).setY(0);
    if (dir.lengthSq() > 1e-6) dir.normalize();
    return new Promise((resolve) => {
      this._drift = {
        from, mid, to, yaw0, yaw1, yaw2, dir, t: 0, settle: 0, pose,
        dur: Math.max(0.6, duration ?? 0.7 + dist * 0.35), resolve,
      };
      if (pose && pose !== this.pose) this.setPose(pose, Math.max(0.6, duration ?? 0.9));
    });
  }

  talk(on) { this.talking = !!on; }

  // ---------------------------------------------------------------- per frame

  update(dt, t) {
    dt = Math.min(Math.max(dt || 0, 0), 1 / 20);
    this._t = t ?? this._t + dt;
    t = this._t;
    const U = this.U;
    U.uTime.value = t;

    // ---- pose blend
    for (const k of Object.keys(this._pose)) {
      const want = k === this._poseTo ? 1 : 0;
      this._pose[k] = want > this._pose[k] ? Math.min(1, this._pose[k] + dt * this._poseSpeed) : Math.max(0, this._pose[k] - dt * this._poseSpeed);
    }
    if (this._poseResolve && this._pose[this._poseTo] >= 1) { const r = this._poseResolve; this._poseResolve = null; r(); }
    const pw = { stand: easeInOut(this._pose.stand), hover: easeInOut(this._pose.hover), perch: easeInOut(this._pose.perch) };
    const pSum = pw.stand + pw.hover + pw.perch || 1;
    const perchW = pw.perch / pSum, hoverW = pw.hover / pSum;
    const poseY = (LAVINIA_POSES.hover * pw.hover + LAVINIA_POSES.perch * pw.perch) / pSum;

    // ---- idle timers
    if (dt > 0) {
      if ((this._blinkTimer -= dt) <= 0) { this._blinkT = 0; this._blinkTimer = rand(2.2, 6) * (Math.random() < 0.15 ? 0.15 : 1); }
      if ((this._idleTimer -= dt) <= 0) {
        if (Math.random() < 0.35) { this._idleYaw = 0; this._idlePitch = 0; }
        else { this._idleYaw = rand(-0.4, 0.4); this._idlePitch = rand(-0.12, 0.1); }
        this._idleTimer = rand(3, 7);
      }
      const busy = this._fx.some((e) => e.kind !== 'beat');
      if (!this.talking && (this._gestureTimer -= dt) <= 0) {
        if (!busy && this._presence > 0.5 && !this._drift) {
          const r = Math.random();
          if (r < 0.34) this.react('pearls');
          else if (r < 0.5) this.react('hairPat');
          else if (r < 0.64) this.react('glove');
          else if (r < 0.74) this.react('flourish');
          else if (r < 0.79) this.react('brow');
          else this._restSideTarget = this._restSideTarget > 0.5 ? 0 : 1;
        }
        this._gestureTimer = rand(6, 12);
      }
      if (this.talking && (this._talkGestureTimer -= dt) <= 0) {
        if (!busy && Math.random() < 0.45) this.react(['gesture', 'flourish', 'chest'][Math.floor(Math.random() * 2.4)] || 'gesture');
        this._talkGestureTimer = rand(2.5, 5);
      }
    }
    this._restSide = damp(this._restSide, this._restSideTarget, 1.5, dt);
    if (this._blinkT != null) { this._blinkT += dt; this._blink = env(this._blinkT, 0.06, 0.04, 0.12); if (this._blinkT > 0.3) this._blinkT = null; } else this._blink = 0;

    // ---- arms: rest
    const AR = copyT(_arm.R, REST.folded.R), AL = copyT(_arm.L, REST.folded.L);
    lerpT(AR, REST.side.R, this._restSide); lerpT(AL, REST.side.L, this._restSide);
    lerpT(AR, REST.lap.R, perchW); lerpT(AL, REST.lap.L, perchW);

    // ---- reactions → channels
    let lift = 0, recoil = 0, torsoPitch = 0, headPitch = 0, headRoll = 0, headYaw = 0, browUp = 0, browSad = 0;
    let wide = 0, close = 0, mouth = 0, shake = 0, compress = 0, pearlPull = 0, dX = 0, dY = 0, dYaw = 0, shoulders = 0;
    const fx = this._fx;
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i]; e.t += dt; const u = e.t, k = u / e.dur;
      switch (e.kind) {
        case 'perk': {
          const w = env(u, 0.18, 0.8, 0.4);
          lift = Math.max(lift, 0.05 * w); headPitch -= 0.12 * w; browUp = Math.max(browUp, w); wide = Math.max(wide, w);
          lerpT(AR, G.chest, 0.35 * w);
          break;
        }
        case 'flinch': {
          const w = env(u, 0.06, 0.3, 0.7);
          recoil = Math.max(recoil, 0.12 * w); lift = Math.max(lift, 0.05 * w); torsoPitch -= 0.14 * w; close = Math.max(close, env(u, 0.04, 0.08, 0.15));
          browUp = Math.max(browUp, w); wide = Math.max(wide, w * 0.6);
          lerpT(AR, G.fend, w); lerpT(AL, GM.fend, w);
          break;
        }
        case 'drift': {
          const s = Math.sin(PI * clamp(k, 0, 1));
          dX += this._driftSide * 0.32 * s * s; dY += 0.07 * s; dYaw += this._driftSide * 0.35 * s;
          const w = env(u, 0.5, 1.0, 0.8);
          lerpT(this._driftSide > 0 ? AL : AR, this._driftSide > 0 ? GM.flourishB : G.flourishB, 0.55 * w);
          headRoll += 0.08 * w * this._driftSide;
          break;
        }
        case 'bow': {
          const w = env(u, 0.7, 1.0, 1.0);
          lift -= 0.24 * w; torsoPitch += 0.42 * w; headPitch += 0.3 * w; compress = Math.max(compress, w); close = Math.max(close, 0.5 * w);
          lerpT(AR, G.curtsey, w); lerpT(AL, GM.curtsey, w);
          break;
        }
        case 'flourish': {
          const w = env(u, 0.3, 0.9, 0.5);
          const A = copyT(newT(), G.flourishA); lerpT(A, G.flourishB, smooth((u - 0.3) / 0.7));
          A.C = 0.1 + 0.25 * Math.max(0, Math.sin(u * 9));
          lerpT(AR, A, w); headRoll -= 0.06 * w; headYaw -= 0.15 * w; browUp = Math.max(browUp, 0.5 * w);
          break;
        }
        case 'sigh': {
          const w = env(u, 0.6, 0.8, 1.0);
          shoulders = Math.max(shoulders, w); headPitch += 0.16 * w; lift -= 0.03 * w; close = Math.max(close, 0.45 * w);
          lift += 0.03 * env(u, 0.4, 0.2, 0.5);
          break;
        }
        case 'nod': headPitch += 0.24 * Math.sin(PI * clamp(k, 0, 1)) * (k < 1 ? 1 : 0); break;
        case 'shake': headYaw += 0.22 * Math.sin(k * TAU * 2) * (1 - k); break;
        case 'think': {
          const w = env(u, 0.4, 1.6, 0.6);
          lerpT(AR, G.chest, w * 0.6); headRoll += 0.1 * w; headYaw += 0.2 * w; headPitch -= 0.1 * w; browUp = Math.max(browUp, 0.3 * w);
          break;
        }
        case 'laugh': {
          const w = env(u, 0.15, 1.2, 0.45);
          headPitch -= 0.18 * w; mouth = Math.max(mouth, 0.7 * w * (0.6 + 0.4 * Math.sin(u * 22))); lift += 0.015 * w * Math.abs(Math.sin(u * 11));
          lerpT(AR, G.chest, w); close = Math.max(close, 0.55 * w);
          break;
        }
        case 'gasp': {
          const w = env(u, 0.12, 0.9, 0.5);
          lift = Math.max(lift, 0.06 * w); mouth = Math.max(mouth, 0.55 * w); wide = Math.max(wide, w); browUp = Math.max(browUp, w);
          lerpT(AR, G.mouth, w);
          break;
        }
        case 'shriek': {
          const w = env(u, 0.08, 0.7, 0.6);
          lift = Math.max(lift, 0.2 * w); mouth = Math.max(mouth, w); wide = Math.max(wide, w); browUp = Math.max(browUp, w);
          lerpT(AR, G.shriek, w); lerpT(AL, GM.shriek, w);
          break;
        }
        case 'gesture': {
          const w = env(u, 0.4, 0.9, 0.5);
          lerpT(AR, G.present, w); headYaw -= 0.12 * w; browUp = Math.max(browUp, 0.4 * w);
          break;
        }
        case 'chest': {
          const w = env(u, 0.35, 0.6, 0.5);
          lerpT(AR, G.chest, w * 0.8);
          break;
        }
        case 'point': {
          const w = env(u, 0.35, 1.1, 0.5);
          lerpT(AR, G.point, w);
          break;
        }
        case 'brow': {
          const w = env(u, 0.5, 1.4, 0.7);
          lerpT(AR, G.brow, w); headPitch -= 0.26 * w; headRoll += 0.1 * w; close = Math.max(close, 0.8 * w); torsoPitch -= 0.06 * w;
          browSad = Math.max(browSad, 0.5 * w);
          break;
        }
        case 'clap': {
          const w = env(u, 0.25, 1.15, 0.4);
          const c = copyT(newT(), G.clap); const cl = copyT(newT(), GM.clap);
          const sep = 0.035 * (0.5 + 0.5 * Math.cos(u * TAU * 3.6));
          c.W.x -= sep; cl.W.x += sep;
          lerpT(AR, c, w); lerpT(AL, cl, w); browUp = Math.max(browUp, 0.6 * w); mouth = Math.max(mouth, 0.25 * w);
          break;
        }
        case 'sad': {
          const w = env(u, 0.7, 1.3, 1.0);
          headPitch += 0.38 * w; browSad = Math.max(browSad, w); close = Math.max(close, 0.6 * w); shoulders = Math.max(shoulders, 0.7 * w);
          lerpT(AR, G.chest, 0.6 * w);
          break;
        }
        case 'pearls': {
          const w = env(u, 0.6, 2.2, 0.8);
          const c = copyT(newT(), G.pearls);
          c.W.x += 0.012 * Math.sin(u * 5.3); c.W.y += 0.01 * Math.sin(u * 3.7 + 1); c.C = 0.6 + 0.15 * Math.sin(u * 8);
          lerpT(AR, c, w); pearlPull = Math.max(pearlPull, w); headPitch += 0.1 * w; browSad = Math.max(browSad, 0.35 * w);
          break;
        }
        case 'hairPat': {
          const w = env(u, 0.6, 1.1, 0.7);
          const c = copyT(newT(), G.hair); c.W.y += 0.012 * Math.max(0, Math.sin(u * 12));
          lerpT(AR, c, w); headRoll -= 0.08 * w; headYaw += 0.12 * w; close = Math.max(close, 0.3 * w);
          break;
        }
        case 'glove': {
          const w = env(u, 0.6, 1.1, 0.7);
          const l = copyT(newT(), G.gloveL); l.W.z -= 0.025 * smooth((u - 0.6) / 0.9);
          lerpT(AR, G.gloveR, w); lerpT(AL, l, w); headPitch += 0.2 * w;
          break;
        }
        case 'fade': case 'appear': {
          const w = env(u, 0.3, e.dur - 0.6, 0.3);
          lerpT(AR, G.chest, 0.5 * w); headPitch -= 0.1 * w; close = Math.max(close, 0.5 * w);
          break;
        }
        case 'uncloak': {
          const w = env(u, 0.15, 0.9, 0.6);
          lerpT(AR, G.flourishA, w); lerpT(AL, GM.flourishA, w); lift = Math.max(lift, 0.06 * w); headPitch -= 0.15 * w;
          break;
        }
        default: { const w = env(u, 0.1, 0.3, 0.3); lift = Math.max(lift, 0.03 * w); browUp = Math.max(browUp, 0.4 * w); }
      }
      if (u >= e.dur) { fx.splice(i, 1); if (!e.done) { e.done = true; e.resolve(); } }
    }

    // ---- presence (fade / appear)
    const pSpeed = this._presenceTarget < this._presence ? 1 / 2.6 : 1 / 1.5;
    this._presence = this._presenceTarget > this._presence ? Math.min(this._presenceTarget, this._presence + dt * pSpeed) : Math.max(this._presenceTarget, this._presence - dt * pSpeed);
    const pres = smooth(this._presence);

    // ---- drift (moveTo)
    let leanFwd = 0;
    const d = this._drift;
    if (d && dt > 0) {
      const g = this.group;
      if (d.t < d.dur) {
        d.t += dt;
        const k = clamp(d.t / d.dur, 0, 1), e = easeInOut(k);
        const a = d.from, b = d.mid, c = d.to, ie = 1 - e;
        g.position.set(ie * ie * a.x + 2 * ie * e * b.x + e * e * c.x, ie * ie * a.y + 2 * ie * e * b.y + e * e * c.y, ie * ie * a.z + 2 * ie * e * b.z + e * e * c.z);
        g.rotation.y = k < 0.6 ? lerp(d.yaw0, d.yaw1, easeInOut(k / 0.35)) : lerp(d.yaw1, d.yaw2, easeInOut((k - 0.6) / 0.4));
        leanFwd = Math.sin(PI * k) * 0.12;
      } else {
        d.settle += dt;
        const s = d.settle;
        g.position.copy(d.to).addScaledVector(d.dir, 0.05 * Math.exp(-4.5 * s) * Math.sin(8.5 * s));
        g.position.y += 0.025 * Math.exp(-4 * s) * Math.sin(7 * s);
        g.rotation.y = d.yaw2;
        if (s > 0.85) { g.position.copy(d.to); this._drift = null; d.resolve(); }
      }
    }

    // ---- root: bob, lift, recoil, drift reaction
    const bob = 0.03 * Math.sin(t * TAU * 0.4) * (1 - perchW * 0.7);
    const root = this.root;
    root.position.set(dX, poseY + bob + lift + dY, -recoil);
    this._pose_y = poseY;

    // ---- look-at: head first, then the body turns when the point is far round
    let wantYaw = this._idleYaw, wantPitch = this._idlePitch;
    if (this._look && this.group.parent) {
      this.group.updateWorldMatrix(true, false);
      _v.copy(this._look);
      this.group.worldToLocal(_v);
      const hy = 1.6 + poseY;
      const dx = _v.x, dy = _v.y - hy, dz = _v.z;
      wantYaw = Math.atan2(dx, dz);
      wantPitch = -Math.atan2(dy, Math.hypot(dx, dz));
      if (Math.abs(wantYaw) > 2.7) { wantYaw = 0; wantPitch = 0; }
    }
    const bodyWant = Math.sign(wantYaw) * clamp(Math.abs(wantYaw) - 0.55, 0, 1.3);
    this._bodyYaw = damp(this._bodyYaw, d ? 0 : bodyWant, 1.1, dt);
    root.rotation.y = this._bodyYaw + dYaw;
    const hYaw = clamp(wantYaw - this._bodyYaw, -0.85, 0.85);
    const hPitch = clamp(wantPitch, -0.4, 0.5);
    this._headYaw = damp(this._headYaw, hYaw, 2.6, dt);
    this._headPitch = damp(this._headPitch, hPitch, 2.6, dt);
    this._headRoll = damp(this._headRoll, headRoll + (this.talking ? 0.04 * Math.sin(t * 1.7) : 0), 3, dt);
    this._eyeYaw = damp(this._eyeYaw, clamp(wantYaw - this._bodyYaw - this._headYaw, -0.35, 0.35), 14, dt);
    this._eyePitch = damp(this._eyePitch, clamp(wantPitch - this._headPitch, -0.25, 0.25), 14, dt);

    // ---- torso / neck / head
    const breath = Math.sin(t * TAU / 4.2);
    this.chest.rotation.set(torsoPitch + leanFwd - 0.04 * perchW + 0.008 * breath, this._headYaw * 0.18, -this._headRoll * 0.2);
    this.chest.position.y = WAIST - 0.012 * shoulders;
    const talkNod = this.talking ? 0.035 * Math.sin(t * 5.1) * Math.sin(t * 1.3) : 0;
    this.neck.rotation.set((this._headPitch + headPitch) * 0.35, (this._headYaw + headYaw) * 0.32, this._headRoll * 0.3);
    this.head.rotation.set((this._headPitch + headPitch) * 0.65 + talkNod, (this._headYaw + headYaw) * 0.5, this._headRoll * 0.7);
    this.neck.position.y = 0.39 - 0.015 * shoulders;

    // ---- arms
    for (const side of ['R', 'L']) {
      const tgt = side === 'R' ? AR : AL;
      if (shoulders > 0) tgt.W.y -= 0.02 * shoulders;
      this.arms[side].shoulder.y = SHOULDER.y - 0.015 * shoulders + 0.003 * breath;
      this.arms[side].apply(tgt, dt, 14);
    }

    // ---- face: blink, lids, eyes, brows, mouth
    const openU = clamp(1 - Math.max(this._blink, close * 0.8), 0, 1);
    for (const e of this.eyes) {
      e.lid.rotation.x = lerp(1.45, -0.82 - 0.3 * wide, openU);
      e.gaze.rotation.set(this._eyePitch * 1.1, this._eyeYaw * 1.2, 0);
    }
    for (const b of this.brows) {
      b.piv.position.y = this.head.position.y * 0 + 0.078 + 0.036 + 0.006 * browUp - 0.003 * close;
      b.piv.rotation.z = b.side * (0.16 * browSad - 0.05 * browUp);
    }
    this._talkAmt = damp(this._talkAmt, this.talking ? 1 : 0, 12, dt);
    const talkOpen = this._talkAmt * (0.5 + 0.5 * Math.sin(t * 17)) * (0.6 + 0.4 * Math.sin(t * 5.3));
    const m = Math.max(mouth, talkOpen * 0.75);
    this.lipL.position.y = this._lipLy - 0.0075 * m;
    this.lipU.position.y = this._lipUy + 0.0012 * m;
    this.lipL.scale.set(1 - 0.12 * m, 1, 1);

    // ---- plume: a spring driven by head motion
    {
      const pl = this._plume;
      const drive = (this.head.rotation.y - (this._lastHeadYaw ?? this.head.rotation.y)) / Math.max(dt, 1e-3);
      this._lastHeadYaw = this.head.rotation.y;
      pl.v += (-60 * pl.a - 5 * pl.v - drive * 2.2) * dt; pl.a += pl.v * dt;
      pl.vb += (-50 * pl.b - 4 * pl.vb) * dt + (Math.sin(t * 1.1) * 0.15 - lift * 2) * dt; pl.b += pl.vb * dt;
      this.plume.rotation.set(this._plumeRest.x + pl.b * 0.5 + 0.03 * Math.sin(t * 1.7), this._plumeRest.y, this._plumeRest.z + pl.a * 0.25 + 0.025 * Math.sin(t * 1.3 + 1));
    }

    // ---- pearls (after the arms: the right hand may be holding them)
    this._updatePearls(pearlPull);

    // ---- skirt sway: a lagging pendulum driven by her motion through the room
    {
      const s = this._sway;
      this.group.updateWorldMatrix(true, false);
      _v.setFromMatrixPosition(this.group.matrixWorld);
      let vx = 0, vz = 0;
      if (this._hasLast && dt > 0) {
        _v2.copy(_v).sub(this._lastWorld).divideScalar(dt);
        const yaw = this.group.rotation.y + this.root.rotation.y;
        const c = Math.cos(yaw), sn = Math.sin(yaw);
        vx = _v2.x * c - _v2.z * sn; vz = _v2.x * sn + _v2.z * c;
      }
      this._lastWorld.copy(_v); this._hasLast = true;
      const tx = clamp(-vx * 0.09, -0.14, 0.14) + 0.012 * Math.sin(t * 0.83) - dX * 0.1;
      const tz = clamp(-vz * 0.09, -0.14, 0.14) + 0.009 * Math.sin(t * 0.61 + 1) + recoil * 0.4;
      s.vx += (40 * (tx - s.x) - 5 * s.vx) * dt; s.x += s.vx * dt;
      s.vz += (40 * (tz - s.z) - 5 * s.vz) * dt; s.z += s.vz * dt;
      const yawNow = this.group.rotation.y + this.root.rotation.y;
      let dyaw = yawNow - this._lastYaw; this._lastYaw = yawNow;
      if (dyaw > PI) dyaw -= TAU; if (dyaw < -PI) dyaw += TAU;
      s.vtw += (30 * (-clamp(dyaw / Math.max(dt, 1e-3), -3, 3) * 0.05 - s.tw) - 4 * s.vtw) * dt; s.tw += s.vtw * dt;
      this._deform(this.skirt, t, perchW, compress, s);
      if (this.cloak.mesh.visible) this._deform(this.cloak, t, perchW, compress, s);
    }

    // ---- cloak flying off (uncloak)
    if (this._cloakFly > 0 && this.cloak.mesh.visible) {
      this._cloakFly += dt;
      const k = this._cloakFly / 1.6;
      if (!this.cape.visible) { this._recolor(this.cape.geometry, COSTUMES.storm.cape); this.cape.visible = true; }
      this.cloak.mesh.scale.setScalar(1 + 0.4 * k);
      this.cloak.mesh.position.set(0.1 * k, 3.2 * Math.pow(k, 1.6), -0.3 * k);
      this.cloak.mesh.rotation.set(-0.5 * k, 0.8 * k, 0.2 * k);
      if (k >= 1) this.setCostume('storm');
    }

    // ---- uniforms, effects, light
    this._hover = damp(this._hover, this.ctx.hotspots?.hovered?.id === this.who ? 1 : 0, 8, dt);
    U.uHover.value = this._hover;
    U.uPresence.value = pres;
    U.uMistY0.value = lerp(lerp(LOOK.mist[0], 0.3, hoverW), -0.5, perchW);
    U.uMistY1.value = lerp(lerp(LOOK.mist[1], 0.62, hoverW), -0.15, perchW);
    this.group.updateWorldMatrix(true, false);
    U.uCharInv.value.copy(this.group.matrixWorld).invert();
    this._updateFx(dt, t, pres, poseY, perchW);
  }

  _deform(D, t, perchW, compress, s) {
    const pos = D.geo.attributes.position.array, base = D.base, th = D.th, kk = D.kk, n = th.length;
    const t1 = t * 1.3, t2 = t * 0.9;
    for (let i = 0; i < n; i++) {
      const k = kk[i], k2 = k * k, a = th[i];
      let x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      // ripple + twist
      const rip = 1 + Math.pow(k, 1.5) * (0.022 * Math.sin(3 * a + t1) + 0.012 * Math.sin(5 * a - t2 + 1));
      x *= rip; z *= rip;
      if (s.tw) { const tw = s.tw * k2, c = Math.cos(tw), sn = Math.sin(tw); const nx = x * c + z * sn; z = -x * sn + z * c; x = nx; }
      // curtsey: the skirt settles and spreads
      if (compress > 0) {
        y = WAIST + 0.02 - (WAIST + 0.02 - y) * (1 - 0.2 * compress);
        const sp = 1 + 0.13 * compress * k; x *= sp; z *= sp;
      }
      // perch: shorter, with a lap pushed forward
      if (perchW > 0) {
        const f = Math.pow(Math.max(0, Math.cos(a)), 1.5);
        const yP = WAIST + 0.02 - (WAIST + 0.02 - y) * 0.64;
        const lap = smooth(k / 0.3);
        const sh = 1 - 0.1 * k;
        const xP = x * sh, zP = z * sh + f * 0.34 * lap * (1 - 0.3 * k) + 0.06 * k;
        const yP2 = yP + f * 0.09 * Math.exp(-Math.pow((k - 0.32) / 0.14, 2));
        x = lerp(x, xP, perchW); y = lerp(y, yP2, perchW); z = lerp(z, zP, perchW);
      }
      // pendulum sway
      x += k2 * s.x; z += k2 * s.z;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    }
    D.geo.attributes.position.needsUpdate = true;
    D.frame++;
    D.geo.computeVertexNormals();
    D.geo.attributes.normal.needsUpdate = true;
  }

  _updatePearls(pull) {
    const ctrl = this._pearlCtrl, work = this._pearlWork, n = ctrl.length, mid = (n - 1) / 2;
    for (let i = 0; i < n; i++) work[i].copy(ctrl[i]);
    if (pull > 0.001) {
      // grip point: just past the right palm, in torso space
      const h = this.arms.R.hand;
      _v.set(0, 0.075, 0.018).applyQuaternion(h.quaternion).add(h.position);
      for (let i = 0; i < n; i++) {
        const w = Math.exp(-Math.pow((i - mid) / 1.6, 2)) * pull;
        work[i].lerp(_v, w);
      }
    }
    // a slow breath and a little swing
    const sw = 0.004 * Math.sin(this._t * 1.2);
    for (let i = 2; i < n - 2; i++) work[i].x += sw * Math.exp(-Math.pow((i - mid) / 2.5, 2));
    const curve = this._pearlCurve;
    curve.updateArcLengths?.();
    const N = this._pearlN;
    for (let i = 0; i < N; i++) {
      curve.getPointAt(i / (N - 1), _v3);
      this._pearlM.makeTranslation(_v3.x, _v3.y, _v3.z);
      this.pearls.setMatrixAt(i, this._pearlM);
    }
    this.pearls.instanceMatrix.needsUpdate = true;
  }

  _updateFx(dt, t, pres, poseY, perchW) {
    // haze: breathes, follows the root
    this.haze.material.opacity = 0.17 * pres * (0.85 + 0.15 * Math.sin(t * 0.9)) * (1 + this._hover * 0.4);
    this.haze.position.y = 1.05 - perchW * 0.35;
    // mist at the hem (character space y ≈ the mist band; root space subtracts poseY)
    const mp = this.mist.userData.pos, mc = this.mist.userData.col;
    const hemY = lerp(0.05, -0.38, perchW) - poseY;
    const mcol = [0.62, 0.52, 0.86];
    for (let i = 0; i < this._mistSeed.length; i++) {
      const s = this._mistSeed[i];
      const a = s.a + t * s.s * 0.4;
      const r = s.r * (1 - 0.2 * perchW) + 0.03 * Math.sin(t * 0.7 + s.ph);
      mp[i * 3] = Math.sin(a) * r; mp[i * 3 + 1] = hemY + s.y + 0.04 * Math.sin(t * 0.5 + s.ph); mp[i * 3 + 2] = Math.cos(a) * r + 0.07 * perchW;
      const w = 0.05 * pres * (0.6 + 0.4 * Math.sin(t * 0.8 + s.ph));
      mc[i * 3] = mcol[0] * w; mc[i * 3 + 1] = mcol[1] * w; mc[i * 3 + 2] = mcol[2] * w;
    }
    this.mist.userData.commit();
    // motes: a few slow ones; a burst (the lily-white shimmer) when she fades or appears
    const op = this.motes.userData.pos, oc = this.motes.userData.col;
    const burst = this._moteBurst > 0;
    if (burst) { for (let i = 0; i < this._motes.length; i++) this._motes[i] = this._newMote(false, true); this._moteBurst = 0; }
    const visibleIdle = 10;
    for (let i = 0; i < this._motes.length; i++) {
      const m = this._motes[i];
      m.life += dt; m.y += m.vy * dt;
      m.x += Math.sin(t * 0.7 + m.ph) * 0.02 * dt; m.z += Math.cos(t * 0.6 + m.ph) * 0.02 * dt;
      if (m.life > m.max) { this._motes[i] = this._newMote(false, false); continue; }
      op[i * 3] = m.x; op[i * 3 + 1] = m.y - poseY * 0 + (perchW ? -0.3 * perchW : 0); op[i * 3 + 2] = m.z;
      const f = Math.sin(PI * clamp(m.life / m.max, 0, 1));
      const tw = 0.6 + 0.4 * Math.sin(t * 6 + m.ph * 3);
      const on = m.burst ? 1 : i < visibleIdle ? 0.55 * pres : 0;
      const w = f * tw * on * 0.85;
      oc[i * 3] = w; oc[i * 3 + 1] = w * 0.95; oc[i * 3 + 2] = w * 0.9;
    }
    this.motes.userData.commit();
    if (this.light) this.light.intensity = this._lightBase * pres * (0.92 + 0.08 * Math.sin(t * 1.1)) * (1 + 0.25 * this._hover);
    this.light && (this.light.position.y = 1.25 - perchW * 0.3);
  }

  /** Change the soft glow light's strength (0 = off). The light is `lavinia.light` (a PointLight, no shadows). */
  setGlowLight(intensity) { this._lightBase = intensity; if (this.light) this.light.visible = intensity > 0; }
}

export const LAVINIA_REACTIONS = Object.keys(DUR);
export const LAVINIA_COSTUMES = Object.keys(COSTUMES);

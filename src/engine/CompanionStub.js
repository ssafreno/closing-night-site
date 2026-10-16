// Characters: the shared interface and the placeholder stubs.
//
// Every character (ctx.characters.lavinia / .pike / .cat; ctx.companion is Lavinia) is an object with:
//   group                                  THREE.Group; origin at the feet, facing +Z
//   placeAt(parentGroup, { position, rotationY, pose, hotspot, label, scope })   parent it into a room group
//   lookAt([x,y,z] | Vector3 | null)       turn head/body toward a WORLD point (null: look ahead)
//   react(name) → Promise                  a short reaction; unknown names do a generic beat and resolve
//   moveTo([x,y,z], { duration }) → Promise   glide/walk to a point in the PARENT group's coordinates
//   setPose(name)                          'stand' | 'sit' | 'float' | ... (stubs remember it only)
//   talk(on)                               Dialogue calls this while the character's line types
//   update(dt, t)                          Game calls it every frame while the character is in the current room
//   setVisible(b), isIn(room) → bool, remove(), dispose()
//
// The real models live in src/engine/characters/ (CHARACTERS agent) and are registered in
// src/engine/characters/index.js as CHARACTERS = { lavinia: (ctx) => character, ... }. Anything missing there falls
// back to the stub below, so rooms can be built before the models exist. Extend `Character` to inherit the
// placement / hotspot / moveTo / lookAt plumbing.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

/** Base class: placement, hotspot, glide, look-at, reactions bookkeeping. Subclasses build `this.body` and animate. */
export class Character {
  /**
   * @param {object} ctx
   * @param {string} who   'lavinia' | 'pike' | 'cat'
   * @param {{ companion?: boolean }} [opts]  companion: clicking asks Hints for a director's note
   */
  constructor(ctx, who, { companion = false } = {}) {
    this.ctx = ctx;
    this.who = who;
    this.companion = companion;
    this.group = new THREE.Group();
    this.group.name = `character:${who}`;
    this.pose = 'stand';
    this.talking = false;
    this._look = null;         // world point or null
    this._yawOffset = 0;       // current body/head yaw relative to the group (look-at)
    this._move = null;
    this._hotspotExtra = null;
    this._scope = 'any';
  }

  get name() { return this.ctx.dialogue?.speaker?.(this.who)?.name || this.who; }

  placeAt(parentGroup, { position = [0, 0, 0], rotationY = 0, pose = null, hotspot = null, label = null, scope = null } = {}) {
    if (parentGroup && this.group.parent !== parentGroup) parentGroup.add(this.group);
    this.group.position.set(position[0], position[1], position[2]);
    this.group.rotation.y = rotationY;
    if (this._move) { const m = this._move; this._move = null; m.resolve(); }
    if (pose) this.setPose(pose);
    if (hotspot) this._hotspotExtra = hotspot;
    if (label) this._label = label;
    if (scope) this._scope = scope;
    this.setVisible(true);
    this._registerHotspot();
    return this;
  }

  /** The default click: Lavinia (the companion) gives a director's note; anyone else says `<who>.click.<room>` →
   *  `<who>.click`, or a caption. A room overrides it with placeAt(..., { hotspot: { onClick } }). */
  onClick() {
    const ctx = this.ctx;
    if (this.companion) { ctx.hints?.ask?.(); return; }
    const rid = ctx.game?.currentRoom?.id;
    const keys = [`${this.who}.click.${rid}`, `${this.who}.click`];
    const key = keys.find((k) => ctx.dialogue?.has?.(k));
    if (key) ctx.dialogue.auto(key);
    else ctx.dialogue?.caption?.(`${this.name} has nothing to say just now.`);
    this.react('nod');
  }

  _hitObject() { return this.group; }

  _registerHotspot() {
    const hs = this.ctx.hotspots;
    if (!hs?.add) return;
    hs.add({
      id: this.who, object: this._hitObject(), label: this._label || this.name, scope: this._scope,
      enabled: () => this.group.visible && !!this.group.parent,
      onClick: () => this.onClick(),
      ...(this._hotspotExtra || {}),
    });
  }

  lookAt(point) {
    if (!point) { this._look = null; return; }
    this._look = Array.isArray(point) ? new THREE.Vector3(point[0], point[1], point[2]) : point.clone();
  }

  setPose(name) { this.pose = name; }

  react(name) {
    return new Promise((resolve) => { this._reaction = { name, t: 0, dur: 0.6, resolve }; });
  }

  moveTo(target, { duration } = {}) {
    if (this._move) { const m = this._move; this._move = null; m.resolve(); }
    const from = this.group.position.clone();
    const to = new THREE.Vector3(target[0], target[1], target[2]);
    const dist = from.distanceTo(to);
    const dx = to.x - from.x, dz = to.z - from.z;
    const yaw0 = this.group.rotation.y;
    let yaw1 = Math.hypot(dx, dz) > 1e-3 ? Math.atan2(dx, dz) : yaw0;
    while (yaw1 - yaw0 > Math.PI) yaw1 -= TAU;
    while (yaw1 - yaw0 < -Math.PI) yaw1 += TAU;
    return new Promise((resolve) => {
      this._move = { from, to, yaw0, yaw1, t: 0, dur: Math.max(0.2, duration ?? Math.max(0.8, dist / 0.9)), resolve };
    });
  }

  talk(on) { this.talking = !!on; }
  setVisible(b) { this.group.visible = !!b; }

  /** True when this character stands in `room` (its group is inside room.group). */
  isIn(room) {
    const root = room?.group;
    let o = this.group.parent;
    while (o) { if (o === root) return true; o = o.parent; }
    return false;
  }

  remove() { this.group.parent?.remove(this.group); }

  dispose() {
    this.remove();
    this.ctx.hotspots?.remove?.(this.who);
    this.group.traverse((o) => { o.geometry?.dispose?.(); });
  }

  update(dt, t) {
    const m = this._move;
    if (m) {
      m.t += dt;
      const k = Math.min(1, m.t / m.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.group.position.lerpVectors(m.from, m.to, e);
      this.group.rotation.y = m.yaw0 + (m.yaw1 - m.yaw0) * Math.min(1, k * 3);
      if (k >= 1) { this._move = null; m.resolve(); }
    }
    // look-at: yaw offset toward the world point (clamped), eased
    let want = 0;
    if (this._look && this.group.parent) {
      this.group.updateWorldMatrix(true, false);
      _v.copy(this._look);
      this.group.worldToLocal(_v);
      want = Math.max(-1.2, Math.min(1.2, Math.atan2(_v.x, _v.z)));
    }
    this._yawOffset += (want - this._yawOffset) * Math.min(1, dt * 4);
    const r = this._reaction;
    if (r) {
      r.t += dt;
      if (r.t >= r.dur) { this._reaction = null; r.resolve(); }
    }
  }
}

// ---- stubs -------------------------------------------------------------------------------------------------

const LOOKS = {
  lavinia: { color: 0xd8c4ff, glow: 0x6a48a8, height: 1.62, radius: 0.2, opacity: 0.38, float: 0.18, hat: 'plume' },
  pike: { color: 0x8fa0b0, glow: 0x223040, height: 1.74, radius: 0.22, opacity: 0.85, float: 0, hat: 'bowler' },
  cat: { color: 0x9a948c, glow: 0x201810, height: 0.3, radius: 0.12, opacity: 0.95, float: 0, hat: 'ears', lying: true },
};

/**
 * Placeholder character: a translucent capsule with a hat (Lavinia glows and drifts; Pike is solid and still; the cat
 * is a small grey lozenge with ears). Two eye dots show where it is looking; it bobs while talking.
 */
export class CharacterStub extends Character {
  constructor(ctx, who, opts) {
    super(ctx, who, opts);
    const L = LOOKS[who] || LOOKS.pike;
    this.look = L;
    this.body = new THREE.Group();
    this.group.add(this.body);
    const mat = new THREE.MeshStandardMaterial({
      color: L.color, emissive: L.glow, emissiveIntensity: who === 'lavinia' ? 0.55 : 0.15,
      transparent: L.opacity < 1, opacity: L.opacity, roughness: 0.6, depthWrite: L.opacity >= 0.9,
    });
    const dark = new THREE.MeshStandardMaterial({ color: who === 'lavinia' ? 0x3a2050 : 0x1a1612, roughness: 0.7 });
    const len = Math.max(0.01, L.height - L.radius * 2);
    const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(L.radius, len, 6, 16), mat);
    if (L.lying) {
      capsule.rotation.x = Math.PI / 2;
      capsule.scale.set(1, 1.0, 1);
      capsule.position.y = L.radius;
      // a lying cat: the capsule runs along Z; head at +Z
      const head = new THREE.Mesh(new THREE.SphereGeometry(L.radius * 0.95, 16, 12), mat);
      head.position.set(0, L.radius * 1.6, len / 2 + L.radius * 0.6);
      this.body.add(capsule, head);
      for (const s of [1, -1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(L.radius * 0.35, L.radius * 0.7, 4), mat);
        ear.position.set(s * L.radius * 0.5, L.radius * 2.4, len / 2 + L.radius * 0.6);
        this.body.add(ear);
      }
      this.head = head;
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.35, 6), mat);
      tail.rotation.x = Math.PI / 2.4; tail.position.set(0, L.radius * 1.2, -len / 2 - L.radius - 0.12);
      this.tail = tail; this.body.add(tail);
    } else {
      capsule.position.y = L.height / 2;
      this.body.add(capsule);
      this.head = new THREE.Group();
      this.head.position.y = L.height - L.radius;
      this.body.add(this.head);
      if (L.hat === 'bowler') {
        const crown = new THREE.Mesh(new THREE.SphereGeometry(L.radius * 0.95, 16, 10, 0, TAU, 0, Math.PI / 2), dark);
        crown.position.y = L.radius * 0.75;
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(L.radius * 1.35, L.radius * 1.35, 0.02, 24), dark);
        brim.position.y = L.radius * 0.75;
        this.head.add(crown, brim);
      } else {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(L.radius * 1.9, L.radius * 1.9, 0.015, 28), dark);
        brim.position.y = L.radius * 0.85; brim.rotation.z = 0.12;
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(L.radius * 0.8, L.radius * 0.95, L.radius * 0.6, 20), dark);
        crown.position.y = L.radius * 1.15; crown.rotation.z = 0.12;
        const plume = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.34, 8), new THREE.MeshStandardMaterial({ color: 0xf4ecff, emissive: 0xb08ae0, emissiveIntensity: 0.6 }));
        plume.position.set(-L.radius * 0.7, L.radius * 1.6, -0.02); plume.rotation.z = 0.6;
        this.head.add(brim, crown, plume);
      }
    }
    // eyes: two dots on the front of the head, so the look direction reads
    const eyeMat = new THREE.MeshBasicMaterial({ color: who === 'lavinia' ? 0xfff6e0 : 0x111111 });
    for (const s of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(L.radius * 0.12, 8, 6), eyeMat);
      if (L.lying) eye.position.set(s * L.radius * 0.35, L.radius * 1.75, len / 2 + L.radius * 1.45);
      else eye.position.set(s * L.radius * 0.35, 0.02, L.radius * 0.92);
      (L.lying ? this.body : this.head).add(eye);
    }
    // a generous invisible click target
    const hitH = Math.max(L.height, 0.35);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(L.radius * 2.6, hitH, L.lying ? len + L.radius * 3 : L.radius * 2.6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = hitH / 2;
    hit.userData.hitProxy = true;
    this.group.add(hit);
    this._hit = hit;
    this._phase = Math.random() * TAU;
  }

  _hitObject() { return this.group; }

  react(name) {
    const durs = { flourish: 1.0, gasp: 0.6, shriek: 0.8, sigh: 1.2, laugh: 1.0, bow: 1.2, nod: 0.5, shake: 0.7, point: 0.8, drift: 1.8 };
    return new Promise((resolve) => { this._reaction = { name, t: 0, dur: durs[name] || 0.6, resolve }; });
  }

  update(dt, t) {
    super.update(dt, t);
    const L = this.look;
    const b = this.body;
    // idle: Lavinia drifts; the others breathe
    const bob = L.float ? L.float + Math.sin(t * 1.3 + this._phase) * 0.05 : 0;
    let y = bob, rx = 0, rz = 0, sy = 1 + Math.sin(t * 1.8 + this._phase) * 0.012;
    if (this.talking) y += Math.abs(Math.sin(t * 9)) * 0.025;
    const r = this._reaction;
    if (r) {
      const k = Math.min(1, r.t / r.dur), s = Math.sin(k * Math.PI);
      if (r.name === 'bow' || r.name === 'nod' || r.name === 'sigh') rx = s * (r.name === 'bow' ? 0.5 : 0.18);
      else if (r.name === 'shake' || r.name === 'laugh') rz = Math.sin(k * TAU * 3) * 0.08 * (1 - k);
      else if (r.name === 'shriek' || r.name === 'gasp') { y += s * 0.12; sy *= 1 + s * 0.08; }
      else if (r.name === 'flourish') b.rotation.y = this._yawOffset + s * TAU * 0.25;
      else if (r.name === 'drift') { b.position.x = Math.sin(k * TAU) * 0.12; y += s * 0.06; }
      else y += s * 0.05;
    }
    b.position.y = y;
    if (!r || r.name !== 'drift') b.position.x = 0;
    b.rotation.x = L.lying ? 0 : rx;
    b.rotation.z = rz;
    if (!r || r.name !== 'flourish') b.rotation.y = this._yawOffset;
    b.scale.y = sy;
    if (this.tail) this.tail.rotation.z = Math.sin(t * 2 + this._phase) * 0.4;
  }
}

/** Build the character set: real ones from the registry where present, stubs for the rest. */
export function makeCharacters(ctx, registry = {}) {
  const out = {};
  for (const who of ['lavinia', 'pike', 'cat']) {
    const companion = who === 'lavinia';
    let c = null;
    const make = registry[who];
    if (typeof make === 'function') {
      try { c = make(ctx, { companion }); } catch (e) { console.error(`[characters] ${who} failed to build; using the stub`, e); }
    }
    out[who] = c || new CharacterStub(ctx, who, { companion });
    out[who].isStub = !c;
  }
  return out;
}

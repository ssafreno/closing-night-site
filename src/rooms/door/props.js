// Room-specific props for the Stage Door & Green Room (SET-door). The shared catalogue (docs/PROPS.md) skipped these
// one-off puzzle objects: the doorkeeper's hutch front (sliding window, ledge, Dutch half-door), the key press, the
// shilling meter, the wireless, the dartboard and the sink. Built from the catalogue's helpers and palette.
// Every factory returns a THREE.Group whose live parts sit on userData (the set wraps them into handles).
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as T from '../../engine/props/theatre.js';
import { makeCanvas, canvasTexture, rng } from '../../engine/props/textures.js';
import { mergeG } from '../../engine/props/theatre.js';

export const TAU = Math.PI * 2;
const FONTS = T.FONTS;

// ---- small helpers -------------------------------------------------------------------------------------------
export function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m;
}
export function boxG(w, h, d, x = 0, y = 0, z = 0) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }
export function cylG(rt, rb, h, seg = 16, x = 0, y = 0, z = 0) { return new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y, z); }
export function latheG(pts, seg = 24) { return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(Math.max(1e-4, x), y)), seg); }
export function merged(geos, mat, opts) { return mesh(mergeG(geos), mat, opts); }
export function noRay(o) { o.raycast = () => {}; o.userData.noRaycast = true; return o; }
export function grp(name) { const g = new THREE.Group(); g.name = name; return g; }
/** A hit proxy (invisible box); obj.visible stays true so Interaction can pick it. */
export function proxy(w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.userData.hitProxy = true; m.userData.keep = true; return m;
}
/** A canvas texture of w×h px drawn by fn(g, w, h). */
export function canvasTex(w, h, fn, opts) { const c = makeCanvas(w, h); fn(c.getContext('2d'), w, h); return canvasTexture(c, opts); }
const chase = (cur, target, dt, rate = 6) => cur + (target - cur) * Math.min(1, dt * rate);

/** A panel with raised mouldings: returns geometries (a slab plus four rails) for mergeG. */
function panelGeos(w, h, x, y, z, t = 0.02, rail = 0.035) {
  return [
    boxG(w, h, t, x, y, z),
    boxG(w, rail, t * 0.8, x, y + h / 2 - rail / 2, z + t * 0.6), boxG(w, rail, t * 0.8, x, y - h / 2 + rail / 2, z + t * 0.6),
    boxG(rail, h - rail * 2, t * 0.8, x - w / 2 + rail / 2, y, z + t * 0.6), boxG(rail, h - rail * 2, t * 0.8, x + w / 2 - rail / 2, y, z + t * 0.6),
  ];
}

// =====================================================================================================
// HUTCH FRONT: the doorkeeper's booth (varnished wood), a stuck sliding window painted ENQUIRIES over a wide
// ledge, and a Dutch half-door (upper and lower leaves locked together) with a brass lock and an enamel plate.
// Origin: floor centre of the front; the room is at +Z; local +X runs toward the half-door. Height 2.35.
// userData: { door (pivot Group: rotation.y, both leaves), setDoorOpen(0..1), lock (Mesh), plate (Mesh),
//   ledgeY, ledgeZ, ledgeX, sash, glass[], W, H, doorX, doorW }
// =====================================================================================================
export function hutchFront({ W = 1.77, H = 2.35 } = {}) {
  const g = grp('hutchFront');
  const varnish = M.wood({ tint: '#5a3418', seed: 41, roughness: 0.42 });
  const dark = M.wood({ tint: '#3a2010', seed: 42, roughness: 0.5 });
  const x0 = -W / 2, x1 = W / 2;
  const winX0 = x0 + 0.07, winX1 = 0.12, doorX0 = 0.19, doorX1 = x1 - 0.07;
  const sillY = 1.0, winY0 = 1.06, winY1 = 1.86, doorH = 1.98;
  const geos = [];
  // posts and rails
  geos.push(boxG(0.08, H, 0.1, x0 + 0.04, H / 2, 0), boxG(0.08, H, 0.1, x1 - 0.04, H / 2, 0), boxG(0.07, H, 0.1, (winX1 + doorX0) / 2, H / 2, 0));
  geos.push(boxG(W, 0.1, 0.1, 0, H - 0.05, 0)); // head rail
  geos.push(boxG(winX1 - winX0, 0.06, 0.09, (winX0 + winX1) / 2, winY1 + 0.03, 0)); // window head
  geos.push(boxG(doorX1 - doorX0, 0.06, 0.09, (doorX0 + doorX1) / 2, doorH + 0.03, 0)); // door head
  // lower panelling under the window
  geos.push(...panelGeos(winX1 - winX0, sillY - 0.12, (winX0 + winX1) / 2, (sillY + 0.12) / 2, 0));
  geos.push(boxG(winX1 - winX0 + 0.02, 0.12, 0.08, (winX0 + winX1) / 2, 0.06, 0)); // kick board
  // fascia above the window and door (y from the heads to the head rail)
  geos.push(boxG(W - 0.16, H - 0.1 - (winY1 + 0.06), 0.03, 0, (H - 0.1 + winY1 + 0.06) / 2, -0.01));
  // cornice
  const cor = [boxG(W + 0.12, 0.05, 0.2, 0, H + 0.025, 0.04), boxG(W + 0.06, 0.04, 0.16, 0, H - 0.01, 0.03)];
  g.add(merged(geos, varnish));
  g.add(merged(cor, dark));
  // sill inside the window and the wide ledge in front
  const ledgeW = winX1 - winX0 + 0.08, ledgeD = 0.3, ledgeX = (winX0 + winX1) / 2;
  const ledge = [boxG(ledgeW, 0.045, ledgeD + 0.1, ledgeX, sillY + 0.0225, ledgeD / 2 - 0.05)];
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.22, 0); sh.quadraticCurveTo(0.05, -0.04, 0, -0.2); sh.closePath();
    ledge.push(new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(ledgeX + s * (ledgeW / 2 - 0.08) + 0.0175, sillY, 0.0));
  }
  g.add(merged(ledge, varnish));
  // the sliding window: two sashes in a track; painted ENQUIRIES (gilt, on the glass of the right sash)
  const ww = winX1 - winX0, wh = winY1 - winY0;
  const sashMat = dark;
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#c8d4cc', roughness: 0.12, transparent: true, opacity: 0.16, clearcoat: 1, depthWrite: false });
  const enq = canvasTex(1024, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.font = `700 ${h * 0.42}px ${FONTS.display}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(40,20,5,0.85)'; c.fillText('ENQUIRIES', w / 2 + 6, h * 0.52 + 6);
    const gr = c.createLinearGradient(0, h * 0.25, 0, h * 0.75); gr.addColorStop(0, '#f8dc8a'); gr.addColorStop(0.5, '#c9a24a'); gr.addColorStop(1, '#8a6420');
    c.fillStyle = gr; c.fillText('ENQUIRIES', w / 2, h * 0.52);
    // flaking
    const r = rng(7); c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 90; i++) { c.beginPath(); c.arc(r() * w, h * 0.3 + r() * h * 0.45, 1 + r() * 4, 0, TAU); c.fill(); }
  });
  const glass = [];
  const mkSash = (z, x, withText) => {
    const S = grp('sash');
    const sw = ww / 2 + 0.03;
    S.add(merged([boxG(sw, 0.035, 0.025, 0, wh / 2 - 0.0175, 0), boxG(sw, 0.035, 0.025, 0, -wh / 2 + 0.0175, 0), boxG(0.035, wh, 0.025, -sw / 2 + 0.0175, 0, 0), boxG(0.035, wh, 0.025, sw / 2 - 0.0175, 0, 0)], sashMat));
    const gl = noRay(mesh(new THREE.PlaneGeometry(sw - 0.05, wh - 0.05), glassMat, { cast: false, receive: false }));
    gl.renderOrder = 2; S.add(gl); glass.push(gl);
    if (withText) {
      const t = noRay(mesh(new THREE.PlaneGeometry(sw - 0.08, (sw - 0.08) * 0.25), new THREE.MeshStandardMaterial({ map: enq, transparent: true, roughness: 0.35, metalness: 0.5, depthWrite: false }), { cast: false }));
      t.position.set(0, wh * 0.18, 0.004); t.renderOrder = 3; S.add(t);
    }
    S.position.set(x, winY0 + wh / 2, z);
    return S;
  };
  g.add(mkSash(-0.012, winX0 + ww / 4, false));
  const sash = mkSash(0.014, winX1 - ww / 4, true); g.add(sash);
  // a speaking grille and a brass bell push on the post
  g.add(merged([cylG(0.03, 0.034, 0.014, 16).rotateX(Math.PI / 2).translate((winX1 + doorX0) / 2, 1.22, 0.055), new THREE.SphereGeometry(0.011, 8, 6).translate((winX1 + doorX0) / 2, 1.22, 0.064)], M.tarnishedBrass({ amount: 0.5 })));
  // the Dutch door: hinged at the far (x1) side, swings inward (to -Z). Both leaves move together (locked).
  const doorW = doorX1 - doorX0;
  const door = grp('halfDoor'); door.position.set(doorX1, 0, -0.01);
  const leafMat = varnish;
  const lower = [], upper = [];
  lower.push(...panelGeos(doorW - 0.01, 0.98, -doorW / 2, 0.5, 0, 0.035, 0.045));
  upper.push(...panelGeos(doorW - 0.01, doorH - 1.02, -doorW / 2, 1.0 + (doorH - 1.02) / 2 + 0.01, 0, 0.035, 0.045));
  // a little shelf on top of the lower leaf (a Dutch door's counter)
  lower.push(boxG(doorW + 0.02, 0.03, 0.12, -doorW / 2, 1.0, 0.03));
  door.add(merged(lower, leafMat), merged(upper, leafMat));
  // brass: the lock box, a bolt across the two leaves, hinges
  const brassM = M.tarnishedBrass({ amount: 0.35 });
  const lockX = -doorW + 0.09;
  const lock = mesh(mergeG([boxG(0.08, 0.11, 0.025, lockX, 0.86, 0.03), cylG(0.016, 0.016, 0.02, 14).rotateX(Math.PI / 2).translate(lockX, 0.89, 0.045)]), brassM);
  lock.name = 'hutchLock'; door.add(lock);
  const keyhole = mesh(mergeG([cylG(0.0045, 0.0045, 0.004, 10).rotateX(Math.PI / 2).translate(lockX, 0.85, 0.044), boxG(0.004, 0.012, 0.004, lockX, 0.843, 0.044)]), M.matte('#0a0806'), { cast: false });
  door.add(keyhole);
  door.add(merged([boxG(0.18, 0.025, 0.012, lockX + 0.06, 1.035, 0.045), cylG(0.009, 0.009, 0.05, 8).translate(lockX + 0.03, 1.035, 0.055).rotateZ(0)], M.ironBlack()));
  door.add(merged([boxG(0.03, 0.12, 0.012, -0.015, 0.25, 0.025), boxG(0.03, 0.12, 0.012, -0.015, 0.75, 0.025), boxG(0.03, 0.12, 0.012, -0.015, 1.3, 0.025), boxG(0.03, 0.12, 0.012, -0.015, 1.8, 0.025)], brassM));
  // the enamel plate on the upper leaf
  const plateTex = canvasTex(768, 300, (c, w, h) => {
    c.fillStyle = '#e8dfc8'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#1f3d2c'; c.lineWidth = 10; c.beginPath(); c.roundRect(14, 14, w - 28, h - 28, 18); c.stroke();
    c.fillStyle = '#1f3d2c'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 70px ${FONTS.ui}`; c.fillText('DOORKEEPER', w / 2, 82);
    c.font = `700 58px ${FONTS.ui}`; c.fillText('A. HOBDAY', w / 2, 160);
    c.font = `600 34px ${FONTS.ui}`; c.fillText('KEY KEPT ON THE DOORKEEPER', w / 2, 230);
    const r = rng(12); c.fillStyle = '#2a2a2a';
    for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(r() < 0.5 ? 10 + r() * 20 : w - 10 - r() * 20, r() * h, 3 + r() * 6, 0, TAU); c.fill(); }
    for (const [x, y] of [[34, h / 2], [w - 34, h / 2]]) { c.fillStyle = '#5a5040'; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill(); }
  });
  const plate = mesh(new THREE.PlaneGeometry(0.36, 0.14), new THREE.MeshPhysicalMaterial({ map: plateTex, roughness: 0.25, clearcoat: 0.8 }), { cast: false });
  plate.position.set(-doorW / 2, 1.5, 0.042); plate.name = 'hutchPlate'; door.add(plate);
  g.add(door);
  // the doorway's dark interior back face when open is the booth inside; nothing else to add here
  let open = 0, target = 0;
  const apply = () => { door.rotation.y = -2.2 * open; }; // negative: the free edge (at -X) swings to -Z (inward), folding back against the side wall clear of the key press
  g.userData.update = (dt) => { if (Math.abs(open - target) > 0.0005) { open = chase(open, target, dt, 3.2); apply(); } };
  g.userData.setDoorOpen = (t, instant = false) => { target = t; if (instant) { open = t; apply(); } };
  Object.assign(g.userData, { door, lock, plate, sash, glass, ledgeY: sillY + 0.045, ledgeZ: ledgeD / 2 - 0.02, ledgeX, W, H, doorX: (doorX0 + doorX1) / 2, doorW, lockPos: new THREE.Vector3(doorX1 + lockX, 0.86, 0.04) });
  return g;
}

// =====================================================================================================
// KEY PRESS: a glass-fronted key cabinet with six hooks (card tags; the PASS DOOR key and a rusty CELLAR key) and
// a three-wheel brass combination lock with a TRY push-button in the bottom rail. Origin: centre-back (wall); faces
// +Z. ~0.46 × 0.66 × 0.12. userData: { wheels (numberWheels group: step/setValue/values), wheelHits[i] {up, down},
// tryButton (Mesh), pressTry(), glassDoor (pivot), setOpen(0..1), hooks[i] {pos, tag, key}, passKey, cellarKey }
// =====================================================================================================
export const KEY_TAGS = [
  { id: 'passdoor', text: 'PASS DOOR', key: 'iron' },
  { id: 'wardrobe', text: 'WARDROBE', note: 'with Miss Bright' },
  { id: 'boxoffice', text: 'BOX OFFICE', note: 'with Mr Crane' },
  { id: 'flyfloor', text: 'FLY FLOOR' },
  { id: 'dressing', text: 'No.1 DRESSING', note: 'Miss Thrush keeps her own' },
  { id: 'cellar', text: 'CELLAR', key: 'rusty' },
];

export function keyPress() {
  const g = grp('keyPress');
  const W = 0.46, H = 0.66, D = 0.12;
  const wood = M.mahogany();
  const yTop = H / 2, yBot = -H / 2;
  const doorY0 = -0.09, doorY1 = yTop - 0.04; // the glazed door covers the key area
  const geos = [boxG(W, H, 0.015, 0, 0, 0.0075)]; // back
  geos.push(boxG(0.03, H, D, -W / 2 + 0.015, 0, D / 2), boxG(0.03, H, D, W / 2 - 0.015, 0, D / 2)); // sides
  geos.push(boxG(W, 0.04, D, 0, yTop - 0.02, D / 2), boxG(W, 0.03, D, 0, doorY0 - 0.015, D / 2)); // top, shelf under the keys
  geos.push(boxG(W + 0.03, 0.035, D + 0.025, 0, yTop + 0.0175, D / 2 + 0.005)); // cornice
  // bottom rail (the lock panel) is a solid front under the door
  geos.push(boxG(W, doorY0 - 0.03 - yBot, D, 0, (doorY0 - 0.03 + yBot) / 2, D / 2));
  g.add(merged(geos, wood));
  // inside: a baize back for the key area
  g.add(mesh(new THREE.PlaneGeometry(W - 0.06, doorY1 - doorY0).translate(0, (doorY0 + doorY1) / 2, 0.0155), M.baize('#24402e'), { cast: false }));
  // brass escutcheon plate on the lock panel, with a slot window for the wheels and a TRY button
  const brassM = M.tarnishedBrass({ amount: 0.25 });
  const panelZ = D;
  const escTex = canvasTex(512, 384, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d8b45c'); gr.addColorStop(1, '#8a6a2a');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    T.grime(c, w, h, { seed: 5, color: '#4a4020', octaves: [[4, 0.3], [16, 0.15]] });
    c.strokeStyle = 'rgba(60,40,10,0.7)'; c.lineWidth = 6; c.strokeRect(12, 12, w - 24, h - 24);
    c.fillStyle = '#100a04'; c.fillRect(w * 0.18, h * 0.14, w * 0.64, h * 0.38); // the wheel slot (behind: wheels)
    c.fillStyle = '#2a1c0c'; c.textAlign = 'center'; c.font = `700 40px ${FONTS.fell}`;
    c.fillText('▲', w * 0.29, h * 0.1 + 14); c.fillText('▲', w * 0.5, h * 0.1 + 14); c.fillText('▲', w * 0.71, h * 0.1 + 14);
    c.font = `30px ${FONTS.fell}`; c.fillText('CHUBB & SON · PATENT', w / 2, h * 0.9);
    for (const [x, y] of [[30, 30], [w - 30, 30], [30, h - 30], [w - 30, h - 30]]) { c.fillStyle = '#4a3a18'; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill(); }
  });
  const escH = 0.2, escW = 0.26, escY = (doorY0 - 0.03 + yBot) / 2;
  const esc = mesh(new THREE.PlaneGeometry(escW, escH), new THREE.MeshStandardMaterial({ map: escTex, metalness: 0.75, roughness: 0.38 }), { cast: false });
  esc.position.set(0, escY, panelZ + 0.002); g.add(esc);
  // the slot is a hole: put a dark recess behind the plate, and the wheels in it so their faces sit flush
  const slotY = escY + escH * (0.5 - 0.14 - 0.19); // centre of the slot (canvas y 0.14..0.52)
  const wheels = T.numberWheels({ count: 3, r: 0.026, width: 0.03, gap: 0.016, bg: '#e8dcc0', fg: '#1a1208', engraved: false, values: [0, 0, 0] });
  wheels.position.set(0, slotY, panelZ - 0.022);
  // the wheels must stand proud of the plate: push the plate's slot area out of the way by placing wheels in front
  wheels.position.z = panelZ - 0.012;
  g.add(wheels);
  // cut the slot visually: a frame around the wheels (the plate texture's dark rectangle sits behind them)
  const wheelHits = [];
  for (let i = 0; i < 3; i++) {
    const x = wheels.userData.wheelX(i);
    const up = proxy(0.034, 0.03, 0.03); up.position.set(x, slotY + 0.016, panelZ + 0.01); up.name = `wheelUp${i}`;
    const dn = proxy(0.034, 0.03, 0.03); dn.position.set(x, slotY - 0.016, panelZ + 0.01); dn.name = `wheelDown${i}`;
    g.add(up, dn); wheelHits.push({ up, down: dn, x });
  }
  // TRY button: a domed brass push in a bezel, a tiny ivory label
  const btnY = escY - escH * 0.22;
  const bezel = mesh(new THREE.TorusGeometry(0.018, 0.004, 8, 20).translate(0, btnY, panelZ + 0.004), brassM, { cast: false });
  g.add(bezel);
  const tryButton = mesh(mergeG([cylG(0.014, 0.014, 0.012, 18).rotateX(Math.PI / 2).translate(0, 0, 0.006), new THREE.SphereGeometry(0.014, 16, 8, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.5).translate(0, 0, 0.012)]), M.brass({ polished: true }));
  tryButton.position.set(0, btnY, panelZ + 0.002); tryButton.name = 'tryButton';
  g.add(tryButton);
  const tryLab = T.textPlate('TRY', 0.05, { style: 'ivory', pw: 192, ph: 80 }); tryLab.position.set(0.05, btnY, panelZ + 0.003); g.add(tryLab);
  const tryHit = proxy(0.06, 0.045, 0.03); tryHit.position.set(0.012, btnY, panelZ + 0.01); g.add(tryHit);
  // hooks, tags and keys: two rows of three
  const hooks = [];
  const hookG = mergeG([cylG(0.004, 0.004, 0.035, 8).rotateX(Math.PI / 2).translate(0, 0, 0.0175), new THREE.SphereGeometry(0.006, 8, 6).translate(0, 0.002, 0.035)]);
  const hookList = [];
  KEY_TAGS.forEach((k, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const pos = new THREE.Vector3(-0.13 + col * 0.13, doorY1 - 0.055 - row * 0.19, 0.016);
    hookList.push(pos);
    const tag = T.cardTag({ text: k.note ? `${k.text}\n${k.note}` : k.text, w: 0.075, seed: 20 + i });
    tag.position.copy(pos).add(new THREE.Vector3(0, -0.005, 0.03)); tag.rotation.z = (i % 2 ? 1 : -1) * 0.06;
    g.add(tag);
    let key = null;
    if (k.key) {
      key = T.key({ style: 'mortice', metal: 'iron', len: k.key === 'iron' ? 0.085 : 0.075 });
      if (k.key === 'rusty') key.traverse((o) => { if (o.isMesh) o.material = M.iron({ color: '#7a4a2a', roughness: 0.85 }); });
      // hang the key by its bow from the hook, shank down
      key.rotation.set(0, 0, -Math.PI / 2 + (i % 2 ? 0.08 : -0.06)); key.position.copy(pos).add(new THREE.Vector3(0.004, -0.014, 0.036));
      key.name = `key_${k.id}`;
      g.add(key);
    }
    hooks.push({ id: k.id, pos, tag, key });
  });
  g.add(mesh(mergeG(hookList.map((p) => hookG.clone().translate(p.x, p.y, p.z))), brassM, { cast: false }));
  // glazed door: hinged on the left edge, swings outward (+Z) to the left
  const glassDoor = grp('keyPressDoor'); glassDoor.position.set(-W / 2 + 0.03, 0, D + 0.003);
  const dW = W - 0.06, dH = doorY1 - doorY0;
  glassDoor.add(merged([boxG(dW, 0.03, 0.02, dW / 2, doorY1 - 0.015, 0), boxG(dW, 0.03, 0.02, dW / 2, doorY0 + 0.015, 0), boxG(0.03, dH, 0.02, 0.015, (doorY0 + doorY1) / 2, 0), boxG(0.03, dH, 0.02, dW - 0.015, (doorY0 + doorY1) / 2, 0)], wood));
  const dGlass = noRay(mesh(new THREE.PlaneGeometry(dW - 0.05, dH - 0.05).translate(dW / 2, (doorY0 + doorY1) / 2, 0), new THREE.MeshPhysicalMaterial({ color: '#d8e4dc', roughness: 0.08, transparent: true, opacity: 0.14, clearcoat: 1, depthWrite: false }), { cast: false, receive: false }));
  dGlass.renderOrder = 2; glassDoor.add(dGlass);
  glassDoor.add(mesh(cylG(0.006, 0.006, 0.02, 10).rotateX(Math.PI / 2).translate(dW - 0.03, (doorY0 + doorY1) / 2, 0.016), brassM));
  g.add(glassDoor);
  let open = 0, target = 0, press = 0;
  const apply = () => { glassDoor.rotation.y = -1.9 * open; };
  g.userData.update = (dt) => {
    if (Math.abs(open - target) > 0.0005) { open = chase(open, target, dt, 3.5); apply(); }
    if (press > 0) { press = Math.max(0, press - dt * 5); tryButton.position.z = panelZ + 0.002 - 0.007 * Math.sin(press * Math.PI); }
  };
  Object.assign(g.userData, {
    wheels, wheelHits, tryButton, tryHit, glassDoor, hooks, W, H, D,
    passKey: hooks[0].key, cellarKey: hooks[5].key,
    setOpen: (t, instant = false) => { target = t; if (instant) { open = t; apply(); } },
    pressTry: () => { press = 1; },
  });
  return g;
}

// =====================================================================================================
// SHILLING METER: black cast-iron box on the wall, an enamel instruction plate, a coin slot, a little round coin
// window, a credit window that reads 0/- or 1/- (a flip card), and a big two-spoke brass handle on a ratchet.
// Origin: centre-back on the wall; faces +Z. userData: { handle (pivot: rotation.z; clockwise = negative),
// setTurn(rad clockwise), hub (local Vector3), slot (Mesh), slotHit, coin (Mesh), setCoin(b), setCredit(0|1, instant),
// flip (Mesh), plate }
// =====================================================================================================
export function shillingMeter() {
  const g = grp('shillingMeter');
  const W = 0.4, H = 0.62, D = 0.2;
  const iron = M.enamel('#17191a', { roughness: 0.55, metalness: 0.35 });
  const body = [boxG(W, H, D, 0, 0, D / 2), boxG(W + 0.04, 0.035, D + 0.03, 0, H / 2 + 0.0175, D / 2), boxG(W + 0.04, 0.035, D + 0.03, 0, -H / 2 - 0.0175, D / 2)];
  // cast ribs on the sides
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) body.push(boxG(0.012, H * 0.8, 0.012, s * (W / 2 + 0.004), 0, 0.04 + i * 0.045));
  // conduit boss on top
  body.push(cylG(0.03, 0.035, 0.05, 14, -0.1, H / 2 + 0.05, 0.08));
  g.add(merged(body, iron));
  const brassM = M.tarnishedBrass({ amount: 0.3 });
  const fz = D;
  // enamel plate (exact inscription)
  const plateTex = canvasTex(1024, 520, (c, w, h) => {
    c.fillStyle = '#ece4cc'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#1d3a6a'; c.lineWidth = 12; c.beginPath(); c.roundRect(16, 16, w - 32, h - 32, 26); c.stroke();
    c.fillStyle = '#1d3a6a'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 52px ${FONTS.ui}`; c.fillText('PELHAM CORPORATION ELECTRICITY', w / 2, 82);
    c.fillRect(120, 122, w - 240, 4);
    c.font = `700 46px ${FONTS.ui}`; c.fillText('PREPAYMENT METER', w / 2, 168);
    c.fillStyle = '#1a1208';
    c.font = `600 40px ${FONTS.ui}`; c.fillText('INSERT ONE SHILLING, THEN TURN', w / 2, 248); c.fillText('HANDLE FULLY CLOCKWISE.', w / 2, 300);
    c.fillStyle = '#a3201c'; c.font = `700 40px ${FONTS.ui}`; c.fillText('ALSO SUPPLIES: STAGE DIP 2.', w / 2, 384);
    const r = rng(31); c.fillStyle = '#222';
    for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(r() < 0.5 ? 8 + r() * 26 : w - 8 - r() * 26, r() * h, 3 + r() * 8, 0, TAU); c.fill(); }
    for (const [x, y] of [[42, 42], [w - 42, 42], [42, h - 42], [w - 42, h - 42]]) { c.fillStyle = '#4a4a4a'; c.beginPath(); c.arc(x, y, 10, 0, TAU); c.fill(); }
    T.grime(c, w, h, { seed: 32, color: '#5a4a30', octaves: [[4, 0.18], [16, 0.08]] });
  });
  const plate = mesh(new THREE.PlaneGeometry(0.34, 0.173), new THREE.MeshPhysicalMaterial({ map: plateTex, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 }), { cast: false });
  plate.position.set(0, 0.19, fz + 0.002); plate.name = 'meterPlate'; g.add(plate);
  // coin slot plate (left) and coin window (right)
  const slotY = 0.03;
  const slotPlate = mesh(mergeG([boxG(0.1, 0.06, 0.012, -0.08, slotY, fz + 0.006)]), brassM); g.add(slotPlate);
  const slotHole = mesh(new THREE.PlaneGeometry(0.034, 0.005), M.matte('#020202'), { cast: false });
  slotHole.position.set(-0.08, slotY + 0.006, fz + 0.0125); g.add(slotHole);
  const oneShil = T.textPlate('1/-', 0.04, { style: 'brass', pw: 160, ph: 80, screws: false }); oneShil.position.set(-0.08, slotY - 0.016, fz + 0.0125); g.add(oneShil);
  const slotHit = proxy(0.12, 0.08, 0.04); slotHit.position.set(-0.08, slotY, fz + 0.02); g.add(slotHit);
  // coin window: a brass ring, a dark cavity and the coin (hidden until inserted), glass over it
  g.add(mesh(new THREE.TorusGeometry(0.026, 0.006, 8, 24).translate(0.08, slotY, fz + 0.006), brassM, { cast: false }));
  g.add(mesh(new THREE.CircleGeometry(0.026, 24).translate(0.08, slotY, fz + 0.001), M.matte('#060504'), { cast: false }));
  const coinTex = canvasTex(256, 256, (c, w, h) => {
    const gr = c.createRadialGradient(w * 0.4, h * 0.4, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, '#f0ecdf'); gr.addColorStop(1, '#8a877c');
    c.fillStyle = gr; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(60,60,50,0.6)'; c.lineWidth = 6; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 12, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(70,68,60,0.75)'; c.beginPath(); c.ellipse(w * 0.52, h * 0.5, w * 0.2, h * 0.27, 0, 0, TAU); c.fill(); // a tired king
    c.font = `22px ${FONTS.fell}`; c.textAlign = 'center'; c.fillText('ONE SHILLING', w / 2, h * 0.9);
  });
  const coin = mesh(new THREE.CylinderGeometry(0.0118, 0.0118, 0.002, 24).rotateX(Math.PI / 2), [new THREE.MeshStandardMaterial({ color: '#a8a498', metalness: 0.9, roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: coinTex, metalness: 0.7, roughness: 0.35 }), new THREE.MeshStandardMaterial({ map: coinTex, metalness: 0.7, roughness: 0.35 })], { cast: false });
  coin.scale.setScalar(1.7); coin.position.set(0.08, slotY - 0.003, fz + 0.004); coin.rotation.z = 0.3; coin.visible = false; coin.name = 'meterCoin';
  g.add(coin);
  const cGlass = noRay(mesh(new THREE.CircleGeometry(0.026, 24).translate(0.08, slotY, fz + 0.008), new THREE.MeshPhysicalMaterial({ color: '#e0e8e0', roughness: 0.05, transparent: true, opacity: 0.18, clearcoat: 1, depthWrite: false }), { cast: false, receive: false }));
  g.add(cGlass);
  // credit window: a bezel and a flip card reading 0/- or 1/-
  const creditY = -0.07;
  g.add(merged([boxG(0.14, 0.012, 0.012, 0, creditY + 0.04, fz + 0.006), boxG(0.14, 0.012, 0.012, 0, creditY - 0.04, fz + 0.006), boxG(0.012, 0.068, 0.012, -0.064, creditY, fz + 0.006), boxG(0.012, 0.068, 0.012, 0.064, creditY, fz + 0.006)], brassM));
  const creditLab = T.textPlate('CREDIT', 0.07, { style: 'brass', pw: 256, ph: 64, screws: false }); creditLab.position.set(0, creditY + 0.06, fz + 0.002); g.add(creditLab);
  const cardTex = (txt) => canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#f2ecdc'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, h / 2 - 1, w, 2);
    c.fillStyle = '#141010'; c.font = `700 92px ${FONTS.fell}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 4);
  });
  const cards = [cardTex('0/-'), cardTex('1/-')];
  const flipMat = new THREE.MeshStandardMaterial({ map: cards[0], roughness: 0.6 });
  const flip = mesh(new THREE.PlaneGeometry(0.116, 0.068), flipMat, { cast: false });
  flip.position.set(0, creditY, fz + 0.001); flip.name = 'meterCredit'; g.add(flip);
  // handle: a hub, a ratchet wheel and two spokes with turned knobs
  const hubY = -0.2;
  const ratchet = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ratchet.push(boxG(0.014, 0.012, 0.01, Math.cos(a) * 0.05, hubY + Math.sin(a) * 0.05, fz + 0.005).rotateZ(0)); }
  const rg = new THREE.CylinderGeometry(0.048, 0.048, 0.012, 24).rotateX(Math.PI / 2).translate(0, hubY, fz + 0.006);
  g.add(merged([rg, ...ratchet.map((geo, i) => { const a = i / 12 * TAU; return new THREE.BoxGeometry(0.016, 0.012, 0.01).rotateZ(a + 0.4).translate(Math.cos(a) * 0.051, hubY + Math.sin(a) * 0.051, fz + 0.006); })], M.ironBlack()));
  const pawl = mesh(boxG(0.05, 0.01, 0.008, 0, 0, 0), brassM); pawl.position.set(0.06, hubY + 0.055, fz + 0.014); pawl.rotation.z = -0.5; g.add(pawl);
  const handle = grp('meterHandle'); handle.position.set(0, hubY, fz + 0.02);
  const spoke = 0.13;
  handle.add(merged([cylG(0.024, 0.026, 0.03, 18).rotateX(Math.PI / 2), boxG(spoke * 2, 0.022, 0.016, 0, 0, 0.012),
    latheG([[0, 0], [0.012, 0], [0.016, 0.02], [0.013, 0.05], [0.017, 0.07], [0, 0.075]], 14).rotateX(Math.PI / 2).translate(spoke, 0, 0.02),
    latheG([[0, 0], [0.012, 0], [0.016, 0.02], [0.013, 0.05], [0.017, 0.07], [0, 0.075]], 14).rotateX(Math.PI / 2).translate(-spoke, 0, 0.02),
    new THREE.SphereGeometry(0.016, 12, 8).translate(0, 0, 0.022)], M.brass({ polished: true })));
  g.add(handle);
  // cash box below with a padlock
  g.add(merged([boxG(0.2, 0.012, 0.01, 0, -H / 2 + 0.05, fz + 0.005), new THREE.TorusGeometry(0.014, 0.004, 6, 12, Math.PI).translate(0.12, -H / 2 + 0.06, fz + 0.02), boxG(0.03, 0.028, 0.012, 0.12, -H / 2 + 0.04, fz + 0.02)], brassM));
  const lab = T.textPlate('CASH BOX', 0.08, { style: 'brass', pw: 256, ph: 64, screws: false }); lab.position.set(-0.05, -H / 2 + 0.05, fz + 0.011); g.add(lab);
  let turn = 0, flipT = -1, credit = 0, nextCredit = 0;
  g.userData.update = (dt) => {
    if (flipT >= 0) {
      flipT += dt * 3.2;
      if (flipT >= 0.5 && credit !== nextCredit) { credit = nextCredit; flipMat.map = cards[credit]; flipMat.needsUpdate = true; }
      flip.scale.y = Math.abs(Math.cos(Math.min(1, flipT) * Math.PI));
      if (flipT >= 1) { flipT = -1; flip.scale.y = 1; }
    }
  };
  Object.assign(g.userData, {
    handle, plate, coin, flip, slot: slotPlate, slotHit, hub: new THREE.Vector3(0, hubY, fz + 0.02), spoke, W, H, D,
    setTurn: (a) => { turn = a; handle.rotation.z = -a; },
    getTurn: () => turn,
    setCoin: (b) => { coin.visible = !!b; },
    setCredit: (n, instant = false) => { nextCredit = n ? 1 : 0; if (instant) { credit = nextCredit; flipMat.map = cards[credit]; flipMat.needsUpdate = true; flipT = -1; flip.scale.y = 1; } else if (credit !== nextCredit) flipT = 0; },
  });
  return g;
}

// =====================================================================================================
// WIRELESS: a 1930s cathedral set in walnut, sunburst fret over gold cloth, a lit amber dial window, two knobs.
// Origin: base centre; faces +Z. userData: { setOn(0..1), dial (Mesh), knobs[] }
// =====================================================================================================
export function wireless() {
  const g = grp('wireless');
  const w = 0.34, h = 0.36, d = 0.2;
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h * 0.55); s.absarc(0, h * 0.55, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0);
  const body = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 20 }).translate(0, 0, -d / 2);
  const wal = M.walnut({ tint: '#5a321a' });
  g.add(mesh(body, wal));
  // front face: fret + cloth + dial window, one canvas
  const front = canvasTex(512, 600, (c, W, H) => {
    c.fillStyle = '#3a2010'; c.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.5, R = W * 0.36;
    // gold cloth
    c.fillStyle = '#8a6a3a'; c.beginPath(); c.moveTo(cx - R, cy + R * 0.2); c.lineTo(cx - R, cy - R * 0.2); c.arc(cx, cy - R * 0.2, R, Math.PI, 0); c.lineTo(cx + R, cy + R * 0.2); c.closePath(); c.fill();
    for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${i % 2 ? '255,220,150' : '60,40,20'},0.1)`; c.fillRect(cx - R + (i * 7) % (2 * R), cy - R * 1.2 + ((i * 13) % (R * 1.4)), 2, 2); }
    // sunburst fret
    c.strokeStyle = '#3a2010'; c.lineWidth = 12;
    for (let i = 0; i <= 8; i++) { const a = Math.PI + i / 8 * Math.PI; c.beginPath(); c.moveTo(cx, cy + R * 0.15); c.lineTo(cx + Math.cos(a) * R * 1.1, cy - R * 0.2 + Math.sin(a) * R * 1.1); c.stroke(); }
    c.lineWidth = 14; c.beginPath(); c.arc(cx, cy - R * 0.2, R * 0.55, Math.PI, 0); c.stroke();
    c.strokeStyle = '#c9a24a'; c.lineWidth = 4; c.beginPath(); c.moveTo(cx - R, cy + R * 0.2); c.lineTo(cx - R, cy - R * 0.2); c.arc(cx, cy - R * 0.2, R, Math.PI, 0); c.lineTo(cx + R, cy + R * 0.2); c.stroke();
    // dial window slot (lit separately)
    c.fillStyle = '#120a04'; c.fillRect(cx - 70, H * 0.8 - 26, 140, 52);
  });
  const face = mesh(new THREE.PlaneGeometry(w - 0.02, h - 0.02), new THREE.MeshStandardMaterial({ map: front, roughness: 0.7 }), { cast: false });
  face.position.set(0, h / 2, d / 2 + 0.0085); g.add(face);
  const dialTex = canvasTex(256, 96, (c, W, H) => {
    c.fillStyle = '#f0d8a0'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#3a2410'; c.font = `22px ${FONTS.fell}`; c.textAlign = 'center';
    ['LONDON', 'DAVENTRY', 'PARIS', 'HILVERSUM'].forEach((t, i) => c.fillText(t, 30 + i * 66, 34));
    for (let i = 0; i < 40; i++) c.fillRect(8 + i * 6, 50, 2, i % 5 ? 8 : 16);
    c.fillStyle = '#a3201c'; c.fillRect(150, 40, 3, 50);
  });
  const dialMat = new THREE.MeshStandardMaterial({ map: dialTex, emissive: '#ffb050', emissiveMap: dialTex, emissiveIntensity: 0, roughness: 0.4 });
  const dial = mesh(new THREE.PlaneGeometry(0.075, 0.028), dialMat, { cast: false });
  dial.position.set(0, h / 2 + (0.5 - 0.8) * (h - 0.02), d / 2 + 0.009); g.add(dial);
  const knobs = [];
  for (const x of [-0.11, 0.11]) { const k = mesh(latheG([[0, 0], [0.022, 0], [0.024, 0.012], [0.02, 0.025], [0, 0.026]], 16).rotateX(Math.PI / 2), M.bakelite('#2a1a10')); k.position.set(x, 0.055, d / 2 + 0.006); g.add(k); knobs.push(k); }
  let on = 0, target = 0;
  g.userData.update = (dt, t) => { if (Math.abs(on - target) > 0.001 || target > 0) { on = chase(on, target, dt, 4); dialMat.emissiveIntensity = on * (1.6 + 0.15 * Math.sin(t * 9)); } };
  g.userData.setOn = (v) => { target = v; };
  Object.assign(g.userData, { dial, knobs, face });
  return g;
}

// =====================================================================================================
// DARTBOARD: a bristle board (canvas) in a black ring, two darts stuck in it; throw() flies a third dart in.
// Origin: centre-back (wall); faces +Z. userData: { board, throw() → Promise, darts[] }
// =====================================================================================================
function dartGeo() {
  return mergeG([
    cylG(0.0012, 0.0012, 0.03, 6, 0, 0.015, 0), // point
    latheG([[0, 0.03], [0.004, 0.032], [0.0055, 0.045], [0.0045, 0.075], [0.002, 0.08]], 10), // barrel
    cylG(0.002, 0.002, 0.04, 6, 0, 0.1, 0), // shaft
  ]).rotateX(Math.PI / 2); // point toward -Z... rotateX(+90°) maps +Y to +Z: flip so the point is at -Z
}
export function dartboard() {
  const g = grp('dartboard');
  const R = 0.225;
  const tex = canvasTex(1024, 1024, (c, W, H) => {
    const cx = W / 2, cy = H / 2, s = W / 2 / 0.25;
    c.fillStyle = '#141210'; c.beginPath(); c.arc(cx, cy, W / 2, 0, TAU); c.fill();
    const nums = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
    const ring = (r0, r1, colA, colB) => { for (let i = 0; i < 20; i++) { const a0 = (i - 5.5) / 20 * TAU, a1 = a0 + TAU / 20; c.fillStyle = i % 2 ? colB : colA; c.beginPath(); c.arc(cx, cy, r1 * s, a0, a1); c.arc(cx, cy, r0 * s, a1, a0, true); c.closePath(); c.fill(); } };
    ring(0.016, 0.099, '#1a1612', '#e2d6b4');
    ring(0.099, 0.107, '#a3201c', '#2a6a3a');
    ring(0.107, 0.162, '#1a1612', '#e2d6b4');
    ring(0.162, 0.17, '#a3201c', '#2a6a3a');
    c.fillStyle = '#2a6a3a'; c.beginPath(); c.arc(cx, cy, 0.016 * s, 0, TAU); c.fill();
    c.fillStyle = '#a3201c'; c.beginPath(); c.arc(cx, cy, 0.0064 * s, 0, TAU); c.fill();
    c.strokeStyle = '#b8b0a0'; c.lineWidth = 2.5;
    for (const r of [0.016, 0.099, 0.107, 0.162, 0.17]) { c.beginPath(); c.arc(cx, cy, r * s, 0, TAU); c.stroke(); }
    for (let i = 0; i < 20; i++) { const a = (i - 5.5) / 20 * TAU; c.beginPath(); c.moveTo(cx + Math.cos(a) * 0.016 * s, cy + Math.sin(a) * 0.016 * s); c.lineTo(cx + Math.cos(a) * 0.17 * s, cy + Math.sin(a) * 0.17 * s); c.stroke(); }
    c.fillStyle = '#e8e0cc'; c.font = `700 ${0.026 * s}px ${FONTS.ui}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    nums.forEach((n, i) => { const a = (i - 5) / 20 * TAU; c.fillText(String(n), cx + Math.cos(a) * 0.195 * s, cy + Math.sin(a) * 0.195 * s); });
    T.grime(c, W, H, { seed: 71, color: '#3a2a18', octaves: [[6, 0.2], [30, 0.12]] });
    // holes
    const r = rng(73); c.fillStyle = 'rgba(0,0,0,0.45)';
    for (let i = 0; i < 260; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * 0.17 * s; c.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2, 2); }
  });
  const board = mesh(new THREE.CylinderGeometry(R, R, 0.04, 48).rotateX(Math.PI / 2).translate(0, 0, 0.02), [M.matte('#1a1612'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), M.matte('#1a1612')]);
  board.name = 'dartboardFace';
  g.add(board);
  g.add(mesh(new THREE.TorusGeometry(R, 0.012, 8, 48).translate(0, 0, 0.035), M.ironBlack(), { cast: false }));
  // a backing board (cork square, scarred)
  g.add(mesh(boxG(0.6, 0.6, 0.02, 0, 0, 0.0), M.wood({ tint: '#4a3624', seed: 77 })));
  const dGeo = dartGeo();
  const flightGeo = mergeG([new THREE.PlaneGeometry(0.03, 0.03).translate(0, 0, 0).rotateY(Math.PI / 2).translate(0, 0, 0.13), new THREE.PlaneGeometry(0.03, 0.03).translate(0, 0, 0).rotateY(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0, 0.13)]);
  const brass = M.brass({ polished: true });
  const flights = [new THREE.MeshStandardMaterial({ color: '#a3201c', side: THREE.DoubleSide, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: '#1f3d6a', side: THREE.DoubleSide, roughness: 0.6 })];
  const mkDart = (i) => { const d = grp('dart'); d.add(mesh(dGeo, brass, { cast: false }), mesh(flightGeo, flights[i % 2], { cast: false })); return d; };
  const darts = [];
  const stuck = [[0.06, 0.09, 0.15, -0.1], [-0.11, -0.04, -0.1, 0.12]];
  stuck.forEach(([x, y, rx, ry], i) => { const d = mkDart(i); d.position.set(x, y, 0.04 - 0.012); d.rotation.set(rx, ry, 0); g.add(d); darts.push(d); });
  // the thrown dart
  const thrown = mkDart(0); thrown.visible = false; g.add(thrown);
  const R0 = rng(5);
  let fly = null;
  g.userData.update = (dt) => {
    if (!fly) return;
    fly.t += dt / fly.dur;
    const k = Math.min(1, fly.t);
    thrown.position.lerpVectors(fly.from, fly.to, k);
    thrown.position.y += Math.sin(k * Math.PI) * 0.08;
    if (k >= 1) { const done = fly.resolve; fly = null; thrown.rotation.x += 0; done(); }
  };
  g.userData.throw = () => new Promise((resolve) => {
    const a = R0() * TAU, rr = 0.03 + R0() * 0.15;
    const to = new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0.028);
    thrown.visible = true;
    thrown.rotation.set((R0() - 0.5) * 0.2, (R0() - 0.5) * 0.25, 0);
    fly = { t: 0, dur: 0.22, from: new THREE.Vector3(to.x - 0.2, to.y - 0.15, 1.8), to, resolve };
  });
  Object.assign(g.userData, { board, darts, thrown, R });
  return g;
}

// =====================================================================================================
// SINK with a wall shelf: a Belfast sink on iron brackets, brass bib taps, waste pipe; a shelf above for the kettle.
// Origin: centre-back on the wall at floor level; faces +Z. userData: { shelfY, shelfZ, sinkTopY }
// =====================================================================================================
export function sinkUnit({ sinkW = 0.56, sinkD = 0.4, top = 0.86, shelfY = 1.36 } = {}) {
  const g = grp('sinkUnit');
  const china = M.porcelain('#e9e2d0');
  const sh = 0.24, wall = 0.03;
  const outer = [boxG(sinkW, sh, wall, 0, top - sh / 2, sinkD), boxG(sinkW, sh, wall, 0, top - sh / 2, wall / 2 + 0.02), boxG(wall, sh, sinkD, -sinkW / 2 + wall / 2, top - sh / 2, sinkD / 2 + 0.01), boxG(wall, sh, sinkD, sinkW / 2 - wall / 2, top - sh / 2, sinkD / 2 + 0.01), boxG(sinkW, 0.04, sinkD, 0, top - sh + 0.02, sinkD / 2 + 0.01)];
  g.add(merged(outer, china));
  // inside stain + water dribble
  const stain = mesh(new THREE.PlaneGeometry(sinkW - wall * 2, sinkD - wall * 2).rotateX(-Math.PI / 2).translate(0, top - sh + 0.041, sinkD / 2 + 0.01), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#d8d0b8'; c.fillRect(0, 0, w, h); const gr = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.5); gr.addColorStop(0, '#6a4a24'); gr.addColorStop(0.15, '#9a7a4a'); gr.addColorStop(1, 'rgba(160,140,100,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2018'; c.beginPath(); c.arc(w / 2, h / 2, 10, 0, TAU); c.fill(); }), roughness: 0.3 }), { cast: false });
  g.add(stain);
  // brackets
  const br = [];
  for (const s of [-1, 1]) br.push(boxG(0.03, 0.03, sinkD, s * (sinkW / 2 - 0.08), top - sh - 0.015, sinkD / 2), new THREE.BoxGeometry(0.025, 0.4, 0.025).rotateX(-0.75).translate(s * (sinkW / 2 - 0.08), top - sh - 0.16, sinkD / 2 - 0.08));
  g.add(merged(br, M.ironBlack()));
  // taps from the wall
  const brassM = M.tarnishedBrass({ amount: 0.6 });
  const taps = [];
  for (const s of [-1, 1]) {
    taps.push(cylG(0.012, 0.012, 0.12, 10).rotateX(Math.PI / 2).translate(s * 0.1, top + 0.18, 0.06));
    taps.push(cylG(0.012, 0.009, 0.08, 10, s * 0.1, top + 0.14, 0.12));
    taps.push(boxG(0.06, 0.012, 0.012, s * 0.1, top + 0.21, 0.1));
  }
  g.add(merged(taps, brassM));
  g.add(T.pipeRun([[0.1, top + 0.18, 0.02], [0.1, 2.4, 0.02]], { r: 0.012, color: '#6a6458', brackets: true }));
  g.add(T.pipeRun([[0, top - sh, sinkD / 2], [0, 0.25, sinkD / 2], [0, 0.25, 0.04], [0, 0.0, 0.04]], { r: 0.022, color: '#3a3836', brackets: false }));
  // splashback tiles (white glazed, crazed)
  const tiles = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#cfc8b4'; c.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { c.fillStyle = `rgb(${226 - r() * 18},${222 - r() * 18},${206 - r() * 18})`; c.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); }
    T.grime(c, w, h, { seed: 11, color: '#5a4a30', octaves: [[4, 0.2], [20, 0.12]] });
  });
  g.add(mesh(new THREE.PlaneGeometry(sinkW + 0.16, 0.36).translate(0, top + 0.18, 0.002), new THREE.MeshPhysicalMaterial({ map: tiles, roughness: 0.25, clearcoat: 0.6 }), { cast: false }));
  // the shelf
  const shelf = [boxG(sinkW + 0.3, 0.03, 0.26, 0, shelfY, 0.13)];
  for (const s of [-1, 1]) { const sh2 = new THREE.Shape(); sh2.moveTo(0, 0); sh2.lineTo(0.2, 0); sh2.quadraticCurveTo(0.04, -0.03, 0, -0.18); sh2.closePath(); shelf.push(new THREE.ExtrudeGeometry(sh2, { depth: 0.025, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(s * (sinkW / 2 + 0.05) + 0.0125, shelfY - 0.015, 0)); }
  g.add(merged(shelf, M.wood({ tint: '#5a3418', seed: 44, roughness: 0.5 })));
  Object.assign(g.userData, { shelfY: shelfY + 0.015, shelfZ: 0.13, sinkTopY: top });
  return g;
}

// =====================================================================================================
// FIRE ALARM BELL: a red gong bell with a striker box; the room's one red accent. Origin: centre-back; faces +Z.
// =====================================================================================================
export function fireBell() {
  const g = grp('fireBell');
  const red = M.enamel('#a8201a', { roughness: 0.28, metalness: 0.3 });
  g.add(mesh(latheG([[0.001, 0], [0.11, 0], [0.115, 0.01], [0.105, 0.04], [0.06, 0.07], [0.02, 0.075], [0.001, 0.075]], 32).rotateX(Math.PI / 2).translate(0, 0, 0.03), red));
  g.add(merged([boxG(0.07, 0.09, 0.05, 0, -0.16, 0.025), cylG(0.006, 0.006, 0.08, 8, 0, -0.08, 0.06)], red));
  g.add(mesh(new THREE.SphereGeometry(0.014, 10, 8).translate(0, -0.03, 0.065), M.brass()));
  const lab = T.textPlate('FIRE', 0.06, { style: 'ivory', pw: 192, ph: 80 }); lab.position.set(0, -0.16, 0.051); g.add(lab);
  return g;
}

// =====================================================================================================
// LOW TABLE (green-room coffee table with a cigarette burn) and a BROWN-BETTY TEAPOT.
// =====================================================================================================
export function lowTable({ w = 0.9, d = 0.5, h = 0.42 } = {}) {
  const g = grp('lowTable');
  const wood = M.wood({ tint: '#4a2a14', seed: 46, roughness: 0.45 });
  const parts = [boxG(w, 0.03, d, 0, h - 0.015, 0), boxG(w - 0.08, 0.06, d - 0.08, 0, h - 0.06, 0)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(latheG([[0, 0], [0.018, 0], [0.024, 0.06], [0.016, 0.2], [0.022, 0.3], [0.02, h - 0.06], [0, h - 0.06]], 10).translate(sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05)));
  g.add(merged(parts, wood));
  // rings and a burn on the top
  const ring = mesh(new THREE.PlaneGeometry(w - 0.02, d - 0.02).rotateX(-Math.PI / 2).translate(0, h + 0.0005, 0), new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.6, map: canvasTex(512, 288, (c, W, H) => {
    c.clearRect(0, 0, W, H); c.strokeStyle = 'rgba(30,18,8,0.35)'; c.lineWidth = 4;
    for (const [x, y, r] of [[120, 90, 34], [150, 110, 34], [380, 200, 30]]) { c.beginPath(); c.arc(x, y, r, 0.3, TAU - 0.4); c.stroke(); }
    c.fillStyle = 'rgba(10,6,2,0.7)'; c.beginPath(); c.ellipse(300, 60, 18, 6, 0.3, 0, TAU); c.fill();
  }) }), { cast: false });
  g.add(noRay(ring));
  g.userData.topY = h;
  return g;
}
export function teapot() {
  const g = grp('teapot');
  const brown = M.porcelain('#5a2a14');
  g.add(merged([latheG([[0.001, 0], [0.06, 0], [0.085, 0.04], [0.09, 0.075], [0.075, 0.12], [0.04, 0.135], [0.001, 0.135]], 24),
    latheG([[0.001, 0.13], [0.04, 0.13], [0.035, 0.145], [0.012, 0.15], [0.01, 0.165], [0.001, 0.165]], 16),
    new THREE.TorusGeometry(0.04, 0.009, 8, 16, Math.PI * 1.2).rotateZ(-Math.PI * 0.6).translate(-0.09, 0.075, 0),
    new THREE.CylinderGeometry(0.008, 0.016, 0.1, 10).rotateZ(-0.9).translate(0.11, 0.08, 0)], brown));
  return g;
}

// =====================================================================================================
// CALENDAR (MARCH 1931, the 14th ringed) and a NEWSPAPER pile.
// =====================================================================================================
export function calendar() {
  const tex = canvasTex(384, 512, (c, w, h) => {
    c.fillStyle = '#efe4c8'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#a3201c'; c.fillRect(0, 0, w, 120);
    c.fillStyle = '#f4ecd8'; c.font = `40px ${FONTS.display}`; c.textAlign = 'center'; c.fillText('PELHAM', w / 2, 52); c.font = `22px ${FONTS.fell}`; c.fillText('COAL & COKE CO.', w / 2, 88);
    c.fillStyle = '#1a1208'; c.font = `44px ${FONTS.display}`; c.fillText('MARCH 1931', w / 2, 175);
    c.font = `22px ${FONTS.fell}`;
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    days.forEach((d, i) => c.fillText(d, 40 + i * 50, 215));
    for (let d = 1; d <= 31; d++) { const idx = d - 1; const col = idx % 7, row = Math.floor(idx / 7); c.fillStyle = col === 0 ? '#a3201c' : '#1a1208'; c.fillText(String(d), 40 + col * 50, 255 + row * 46); }
    // the 14th (a Saturday: col 6, row 1) ringed in pencil
    c.strokeStyle = 'rgba(40,40,60,0.85)'; c.lineWidth = 3; c.beginPath(); c.ellipse(40 + 6 * 50, 255 + 46 - 8, 24, 18, 0.2, 0, TAU); c.stroke();
    T.grime(c, w, h, { seed: 83, color: '#6a4a20', octaves: [[4, 0.25], [20, 0.12]] });
  });
  const m = mesh(new THREE.PlaneGeometry(0.21, 0.28), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), { cast: false });
  m.name = 'calendar';
  return m;
}
export function paperPile(n = 6, seed = 3) {
  const g = grp('paperPile'); const r = rng(seed);
  const geos = [];
  let y = 0;
  for (let i = 0; i < n; i++) { const t = 0.012 + r() * 0.01; geos.push(new THREE.BoxGeometry(0.38, t, 0.29).rotateY((r() - 0.5) * 0.4).translate((r() - 0.5) * 0.04, y + t / 2, (r() - 0.5) * 0.04)); y += t; }
  g.add(merged(geos, M.matte('#cfc2a0', { roughness: 0.95 })));
  const top = mesh(new THREE.PlaneGeometry(0.38, 0.29).rotateX(-Math.PI / 2).rotateY(0.1).translate(0, y + 0.001, 0), new THREE.MeshStandardMaterial({ map: T.newspaperTexture({ headline: 'EMPRESS CLOSES', date: 'SATURDAY, 14 MARCH 1931', price: 'ONE PENNY', seed: 5 }), roughness: 0.95 }), { cast: false });
  g.add(top);
  return g;
}

// =====================================================================================================
// TAPE: a strip of yellowed sellotape (decal). A torn ENVELOPE note (Alf's note) with tape at the top.
// =====================================================================================================
export function alfNote() {
  const tex = canvasTex(512, 340, (c, w, h) => {
    c.fillStyle = '#e9dcb8'; c.beginPath(); c.moveTo(0, 8); for (let x = 0; x <= w; x += 16) c.lineTo(x, 4 + Math.sin(x * 0.7) * 5); c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(120,100,70,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, h * 0.45); c.lineTo(w * 0.5, h * 0.75); c.lineTo(w, h * 0.45); c.stroke();
    c.fillStyle = 'rgba(70,70,80,0.85)'; c.font = `34px ${FONTS.hand}`;
    c.fillText('KEY PRESS.', 30, 70);
    c.font = `26px ${FONTS.hand}`;
    c.fillText('The combination is the Half.', 30, 130);
    c.fillText("SATURDAY'S Half,", 30, 180); c.fillText('not the matinee.', 30, 222);
    c.font = `22px ${FONTS.hand}`; c.fillText("Don't ask me again. — A.H.", 30, 290);
    // tape
    c.fillStyle = 'rgba(230,200,120,0.55)'; c.fillRect(w * 0.38, 0, 110, 30);
    T.grime(c, w, h, { seed: 91, color: '#7a5a30', octaves: [[4, 0.2], [16, 0.1]] });
  });
  const m = mesh(new THREE.PlaneGeometry(0.19, 0.126), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.2, roughness: 0.9, side: THREE.DoubleSide }), { cast: false });
  m.name = 'alfNote';
  return m;
}

/** A soft additive floor/wall glow decal (a radial gradient in `color`). Never raycast. */
export function glowDecal(w, h, color = '#cdb8ff', opacity = 0.6, { shape = 'oval' } = {}) {
  const tex = canvasTex(256, 256, (c, W, H) => {
    if (shape === 'fan') {
      const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.beginPath(); c.moveTo(W * 0.12, 0); c.lineTo(W * 0.88, 0); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
      const g2 = c.getImageData(0, 0, W, H); // soften the sides
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const e = Math.min(x, W - x) / (W * 0.25); g2.data[(y * W + x) * 4 + 3] *= Math.min(1, e); }
      c.putImageData(g2, 0, 0);
    } else {
      const gr = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, W, H);
    }
  }, { srgb: false });
  const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const m = noRay(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat));
  m.renderOrder = 4;
  m.userData.setOpacity = (o) => { mat.opacity = o; };
  return m;
}

/** A glint sprite (a four-point star) for the coat pocket; userData.setLevel(0..1). */
export function glintSprite(color = '#ffe2a8', size = 0.08) {
  const tex = canvasTex(128, 128, (c, W, H) => {
    const gr = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2 + 3, H / 2); c.lineTo(W / 2, H); c.lineTo(W / 2 - 3, H / 2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W / 2, H / 2 + 3); c.lineTo(W, H / 2); c.lineTo(W / 2, H / 2 - 3); c.closePath(); c.fill();
  }, { srgb: false });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.scale.setScalar(size); s.renderOrder = 8;
  noRay(s);
  s.userData.setLevel = (k) => { s.material.opacity = k; s.visible = k > 0.01; };
  return s;
}

/** Wall with rectangular holes: a ShapeGeometry in the XY plane (x along the wall, y up), UVs in metres. */
export function wallGeo(len, h, holes = []) {
  const s = new THREE.Shape(); s.moveTo(-len / 2, 0); s.lineTo(len / 2, 0); s.lineTo(len / 2, h); s.lineTo(-len / 2, h); s.closePath();
  for (const [cx, y0, w, hh] of holes) { const p = new THREE.Path(); p.moveTo(cx - w / 2, y0); p.lineTo(cx - w / 2, y0 + hh); p.lineTo(cx + w / 2, y0 + hh); p.lineTo(cx + w / 2, y0); p.closePath(); s.holes.push(p); }
  return new THREE.ShapeGeometry(s);
}

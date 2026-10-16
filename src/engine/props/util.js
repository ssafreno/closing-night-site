// Props utilities (ENGINE core). PROPS-agent builders live beside this file; rooms import from here too.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Merge a room's static meshes into one draw call per material (a big draw-call saving on a cluttered set).
 * Call at the END of build(), after hotspots are registered. Skipped, and left as they are: anything under an object in
 * `exclude` or flagged `userData.keep`, transparent / shader / invisible materials, hit proxies, meshes with renderOrder
 * or userData.noRaycast, and anything animated (userData.update). Hotspot objects must be excluded (or flagged keep):
 * merging moves their meshes into a new mesh, so hover highlight and picking would no longer find them.
 * Pass `{ hotspots: ctx.hotspots }` and every registered hotspot object is excluded for you.
 * @param {THREE.Object3D} root
 * @param {THREE.Object3D[]} [exclude]
 * @param {{ hotspots?: object }} [opts]
 */
export function mergeStatic(root, exclude = [], { hotspots = null } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const ex = new Set(exclude);
  const hot = hotspots?._byObject;
  const skip = (o) => { for (let p = o; p && p !== root; p = p.parent) if (ex.has(p) || p.userData.keep || hot?.has(p.uuid)) return true; return false; };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.visible || skip(o)) return;
    const m = o.material;
    if (Array.isArray(m) || m.transparent || m.isShaderMaterial || m.visible === false || o.userData.hitProxy || o.renderOrder || o.userData.noRaycast) return;
    if (typeof o.userData.update === 'function') return;
    const key = `${m.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${o.geometry.attributes.color ? 'c' : ''}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.clearGroups();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mm = new THREE.Mesh(merged, list[0].material);
    mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow;
    mm.name = 'merged';
    for (const o of list) o.parent.remove(o);
    root.add(mm);
  }
  return root;
}

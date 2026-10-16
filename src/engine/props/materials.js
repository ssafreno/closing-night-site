// Shared palette + material factories. Every factory returns a SHARED cached material for identical
// options (cheap, consistent). Pass { unique: true } to get your own copy you can mutate/animate.
// Hover highlighting never mutates materials (Interaction swaps in a temporary clone), so sharing is safe.
import * as THREE from 'three';
import { woodTexture, stoneTexture, plasterTexture, fabricTexture, parchmentTexture, noiseTexture, chalkboardTexture } from './textures.js';
import { velvetTexture, marbleTexture, giltTexture, brassTexture, clothTexture, wornPlasterTexture, linoleumTexture } from './theatre-textures.js'; // ADDED BY props

export const palette = {
  oak: '#9b6a3c',
  oakLight: '#b8854f',
  walnut: '#4b2f1e',
  walnutDark: '#2e1c12',
  mahogany: '#6a2c1c',
  brass: '#c9a24a',
  brassDark: '#8f6c26',
  copper: '#b46a3c',
  iron: '#3a3836',
  ironTarnish: '#4a4640',
  parchment: '#e9d7ad',
  velvet: '#7a1c22',
  velvetGreen: '#1f4a36',
  velvetBlue: '#1f2f5a',
  teal: '#2f8f8a',
  tealDeep: '#16504e',
  stone: '#8a8378',
  stoneDark: '#5a554d',
  plaster: '#b9a585',
  chalk: '#26302b',
  wax: '#efe4c8',
  gold: '#e1b84f',
  ink: '#1b1410',
  moon: '#bcd0ff',
  candle: '#ffb066',
  fire: '#ff8a3a',
};

const cache = new Map();
function make(key, opts, build) {
  if (opts?.unique) return build();
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}
function k(name, o) { return name + ':' + JSON.stringify(o || {}); }
function rep(tex, repeat) {
  if (!repeat) return tex;
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.needsUpdate = true;
  return t;
}

/**
 * Generic textured wood. opts: { tint, planks, seed, repeat:[u,v], roughness, unique }
 */
export function wood(opts = {}) {
  const { tint = palette.oak, planks = 0, seed = 3, repeat, roughness = 0.62 } = opts;
  return make(k('wood', { tint, planks, seed, repeat, roughness }), opts, () => new THREE.MeshStandardMaterial({
    map: rep(woodTexture({ tint, planks, seed }), repeat),
    roughness,
    roughnessMap: rep(noiseTexture({ scale: 24, seed: 2, contrast: 0.5, bias: 0.9 }), repeat),
    metalness: 0,
  }));
}
export const oak = (o = {}) => wood({ tint: palette.oak, ...o });
export const walnut = (o = {}) => wood({ tint: palette.walnut, seed: 6, roughness: 0.55, ...o });
export const mahogany = (o = {}) => wood({ tint: palette.mahogany, seed: 8, roughness: 0.5, ...o });
/** Floorboards: wood with plank seams. repeat e.g. [2, 3] for a 6 m floor. */
export const floorboards = (o = {}) => wood({ tint: '#7a5232', planks: 6, seed: 12, roughness: 0.7, ...o });

export function brass(opts = {}) {
  const { color = palette.brass, roughness = 0.32, polished = false } = opts;
  return make(k('brass', { color, roughness, polished }), opts, () => new THREE.MeshStandardMaterial({
    color, metalness: 1, roughness: polished ? 0.18 : roughness,
    roughnessMap: noiseTexture({ scale: 10, seed: 31, contrast: 0.6, bias: 0.85 }),
  }));
}
export const gold = (o = {}) => brass({ color: palette.gold, roughness: 0.25, ...o });
export const copper = (o = {}) => brass({ color: palette.copper, roughness: 0.38, ...o });

export function iron(opts = {}) {
  const { color = palette.ironTarnish, roughness = 0.62 } = opts;
  return make(k('iron', { color, roughness }), opts, () => new THREE.MeshStandardMaterial({
    color, metalness: 0.85, roughness,
    roughnessMap: noiseTexture({ scale: 14, seed: 41, contrast: 1.0, bias: 0.85 }),
  }));
}

export function stone(opts = {}) {
  const { tint = palette.stone, rows = 4, cols = 3, repeat, roughness = 0.9, seed = 13 } = opts;
  return make(k('stone', { tint, rows, cols, repeat, roughness, seed }), opts, () => new THREE.MeshStandardMaterial({
    map: rep(stoneTexture({ tint, rows, cols, seed }), repeat), roughness, metalness: 0,
  }));
}
/** Smooth carved stone (pedestals, sills) — no block pattern. */
export function smoothStone(opts = {}) {
  const { color = '#9a9286', roughness = 0.8 } = opts;
  return make(k('smoothStone', { color, roughness }), opts, () => new THREE.MeshStandardMaterial({
    color, roughness, roughnessMap: noiseTexture({ scale: 6, seed: 51, bias: 0.9, contrast: 0.5 }), bumpMap: noiseTexture({ scale: 20, seed: 52 }), bumpScale: 0.6,
  }));
}

export function plaster(opts = {}) {
  const { tint = palette.plaster, repeat, roughness = 0.95 } = opts;
  return make(k('plaster', { tint, repeat, roughness }), opts, () => new THREE.MeshStandardMaterial({
    map: rep(plasterTexture({ tint }), repeat), roughness,
  }));
}

export function velvet(opts = {}) {
  const { color = palette.velvet, pattern = 'weave', repeat } = opts;
  return make(k('velvet', { color, pattern, repeat }), opts, () => new THREE.MeshPhysicalMaterial({
    map: rep(fabricTexture({ tint: color, pattern }), repeat),
    roughness: 0.85, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffd6c0'), 0.5),
  }));
}

export function parchment(opts = {}) {
  const { tint = palette.parchment } = opts;
  return make(k('parchment', { tint }), opts, () => new THREE.MeshStandardMaterial({
    map: parchmentTexture({ tint }), roughness: 0.9, side: THREE.DoubleSide,
  }));
}

/** Transparent glass. color tints it; opacity ~0.25. */
export function glass(opts = {}) {
  const { color = '#cfe8ea', opacity = 0.22, roughness = 0.06 } = opts;
  return make(k('glass', { color, opacity, roughness }), opts, () => new THREE.MeshPhysicalMaterial({
    color, metalness: 0, roughness, transparent: true, opacity, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0.05, specularIntensity: 1, envMapIntensity: 1.6, side: THREE.DoubleSide,
  }));
}
export const tealGlass = (o = {}) => glass({ color: palette.teal, opacity: 0.45, ...o });

/** Self-lit liquid/contents (potions, vials). glow 0..2. */
export function glowing(opts = {}) {
  const { color = palette.teal, glow = 0.8, roughness = 0.3, opacity = 1 } = opts;
  return make(k('glowing', { color, glow, roughness, opacity }), opts, () => new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: glow, roughness, transparent: opacity < 1, opacity,
  }));
}

/** Chalkboard surface with chalk text (see textures.chalkboardTexture for line options). */
export function chalkboard(opts = {}) {
  return make(k('chalkboard', opts), opts, () => new THREE.MeshStandardMaterial({
    map: chalkboardTexture(opts), roughness: 0.95,
  }));
}

export function wax(opts = {}) {
  const { color = palette.wax } = opts;
  return make(k('wax', { color }), opts, () => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.55, transmission: 0, sheen: 0.3, emissive: '#ffb066', emissiveIntensity: 0.06,
  }));
}

/** Flat matte colour (for small bits: string, cloth, paint). */
export function matte(color = '#777', opts = {}) {
  const { roughness = 0.85, metalness = 0 } = opts;
  return make(k('matte', { color, roughness, metalness }), opts, () => new THREE.MeshStandardMaterial({ color, roughness, metalness }));
}

/** Unlit additive glow (flames, runes, shafts). */
export function additive(color = '#ffb066', opts = {}) {
  const { opacity = 1 } = opts;
  return make(k('additive', { color, opacity }), opts, () => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
}

/** Glowing rune/sigil material from a canvas texture (alpha from the texture). */
export function emissiveDecal(map, opts = {}) {
  const { color = '#bfe0ff', intensity = 2.5 } = opts;
  return new THREE.MeshBasicMaterial({
    map, color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
}


// =====================================================================================================
// ADDED BY props: the theatre palette (Closing Night). Same contract as above: every factory returns a SHARED
// cached instance for identical options. Rooms must NEVER mutate a shared instance (colour, opacity, emissive,
// map offset); pass { unique: true } for a copy you can animate. Props that animate (bulbs, jewels, glows) already
// make their own unique materials. Catalogue and swatches: docs/PROPS.md, dev/props.html.
// =====================================================================================================
Object.assign(palette, {
  velvetRed: '#7a161c',      // oxblood house tabs, seats
  velvetGreen2: '#24402e',   // worn green (green-room sofa, baize-ish)
  gilt: '#c9a24a',
  brassTarnish: '#a8843a',
  marble: '#e2dacb',
  canvas: '#d8cdb4',         // unbleached scenic canvas
  dustyWood: '#9a8670',
  ironBlack: '#1d1c1b',
  bottleGreen: '#1f3d2c',    // dado paint, cue lamps' housing, enamel shades
  nicotine: '#d8c79a',       // upper walls
  maroon: '#5a1a1c',         // stage door
  ivory: '#e8dfc8',
  baize: '#2f5a3a',
  ghostLilac: '#cdb8ff',
  ghostGold: '#ffd9a0',
  bulbWarm: '#ffd9a0',
  lino: '#6a4630',
});

/** Oxblood velvet (house tabs, seats, box rails). opts: color, repeat, wear, unique */
export function velvetRed(opts = {}) {
  const { color = palette.velvetRed, repeat, wear = 0.3 } = opts;
  return make(k('velvetRed', { color, repeat, wear }), opts, () => new THREE.MeshPhysicalMaterial({
    map: rep(velvetTexture({ color, wear }), repeat), roughness: 0.92,
    sheen: 0.75, sheenRoughness: 0.5, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ff7a70'), 0.35),
  }));
}
/** Worn green velvet (sofa, chaise in another colour via color). */
export const wornVelvetGreen = (o = {}) => velvetRed({ color: palette.velvetGreen2, wear: 0.6, ...o });

/** Gilt plasterwork (proscenium, royal box, poster frames). pattern: 'plain'|'moulding'|'acanthus'|'panel'. */
export function gilt(opts = {}) {
  const { pattern = 'plain', repeat, roughness = 0.42 } = opts;
  return make(k('gilt', { pattern, repeat, roughness }), opts, () => new THREE.MeshStandardMaterial({
    map: rep(giltTexture({ pattern }), repeat), metalness: 0.8, roughness,
    roughnessMap: rep(noiseTexture({ scale: 18, seed: 61, contrast: 0.8, bias: 0.85 }), repeat),
  }));
}

/** Tarnished brass (handles, rails, plates, lamp bodies). amount 0..1 of patina. */
export function tarnishedBrass(opts = {}) {
  const { amount = 0.5, repeat, roughness = 0.4 } = opts;
  return make(k('tarnishedBrass', { amount, repeat, roughness }), opts, () => new THREE.MeshStandardMaterial({
    map: rep(brassTexture({ amount }), repeat), metalness: 1, roughness,
    roughnessMap: noiseTexture({ scale: 10, seed: 31, contrast: 0.6, bias: 0.85 }),
  }));
}

/** Aged marble (columns, foyer floor squares, balustrades). */
export function agedMarble(opts = {}) {
  const { base = palette.marble, vein = '#8a8076', repeat, roughness = 0.35, seed = 9 } = opts;
  return make(k('agedMarble', { base, vein, repeat, roughness, seed }), opts, () => new THREE.MeshPhysicalMaterial({
    map: rep(marbleTexture({ base, vein, seed }), repeat), roughness, clearcoat: 0.3, clearcoatRoughness: 0.4,
  }));
}

/** Painted / unbleached scenic canvas (flats' backs, dust sheets, the lighthouse skin when no map is given). */
export function paintedCanvas(opts = {}) {
  const { tint = palette.canvas, repeat, side = THREE.FrontSide } = opts;
  return make(k('paintedCanvas', { tint, repeat, side }), opts, () => new THREE.MeshStandardMaterial({
    map: rep(clothTexture({ tint }), repeat), roughness: 0.95, side,
  }));
}

/** Dusty wood: a greyed, matte wood for backstage timber (crates, trestles, flats' frames). */
export const dustyWood = (o = {}) => wood({ tint: palette.dustyWood, seed: 19, roughness: 0.88, ...o });

/** Black iron (stage hardware, cast-iron frames). */
export const ironBlack = (o = {}) => iron({ color: palette.ironBlack, roughness: 0.55, ...o });

/** Gloss enamel paint (shades, signs' boxes, fire buckets, painted iron). */
export function enamel(color = palette.bottleGreen, opts = {}) {
  const { roughness = 0.3, metalness = 0.1 } = opts;
  return make(k('enamel', { color, roughness, metalness }), opts, () => new THREE.MeshPhysicalMaterial({
    color, roughness, metalness, clearcoat: 0.6, clearcoatRoughness: 0.25,
    roughnessMap: noiseTexture({ scale: 12, seed: 33, contrast: 0.6, bias: 0.9 }),
  }));
}

/** Lit bulb glass: unlit, tone-mapping off so it blooms. intensity multiplies colour. SHARED: never animate it. */
export function bulbGlass(opts = {}) {
  const { color = palette.bulbWarm, intensity = 2.2 } = opts;
  return make(k('bulbGlass', { color, intensity }), opts, () => new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false,
  }));
}
/** Unlit bulb glass (a dead bulb). */
export function bulbOff(opts = {}) {
  const { color = '#cfc6b0' } = opts;
  return make(k('bulbOff', { color }), opts, () => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.15, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1, depthWrite: false,
  }));
}

/** Ghost glow: additive, soft, depth-write off (Lavinia's haze, lily shimmer, lamp halos). */
export function ghostGlow(opts = {}) {
  const { color = palette.ghostLilac, opacity = 0.5 } = opts;
  return make(k('ghostGlow', { color, opacity }), opts, () => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  }));
}

/** Worn plaster wall; dado: a colour for a gloss-painted lower band (dadoH = fraction of the texture height). */
export function wornPlaster(opts = {}) {
  const { tint = palette.nicotine, dado = null, dadoH = 0.35, repeat, seed = 21 } = opts;
  return make(k('wornPlaster', { tint, dado, dadoH, repeat, seed }), opts, () => new THREE.MeshStandardMaterial({
    map: rep(wornPlasterTexture({ tint, dado, dadoH, seed }), repeat), roughness: 0.92,
  }));
}

/** Linoleum floor with a worn path. */
export function linoleum(opts = {}) {
  const { tint = palette.lino, repeat, path = 0.5 } = opts;
  return make(k('linoleum', { tint, repeat, path }), opts, () => new THREE.MeshStandardMaterial({
    map: rep(linoleumTexture({ tint, path }), repeat), roughness: 0.55,
  }));
}

/** Leather (seat pads, jewel case, padded doors, straps). */
export function leather(color = '#5a2a18', opts = {}) {
  return make(k('leather', { color }), opts, () => new THREE.MeshStandardMaterial({
    color, roughness: 0.6, bumpMap: noiseTexture({ scale: 60, seed: 77, contrast: 1.2 }), bumpScale: 0.5,
  }));
}

/** Porcelain / ceramic (teacups, fuses, insulators, bulb sockets). */
export function porcelain(color = '#f2ede2', opts = {}) {
  return make(k('porcelain', { color }), opts, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 }));
}

/** Rubber / bakelite / cable (black, slightly glossy). */
export function bakelite(color = '#15110e', opts = {}) {
  return make(k('bakelite', { color }), opts, () => new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0 }));
}

/** Felt / baize (call board, tray linings, card tables). */
export function baize(color = palette.baize, opts = {}) {
  return make(k('baize', { color }), opts, () => new THREE.MeshStandardMaterial({ map: fabricTexture({ tint: color, seed: 14 }), roughness: 1 }));
}

/** Japanned black with a gold sheen (sewing machine head, cash boxes). */
export function japanned(opts = {}) {
  return make(k('japanned', {}), opts, () => new THREE.MeshPhysicalMaterial({ color: '#0d0b0a', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
}

export function clearMaterialCache() { cache.clear(); }

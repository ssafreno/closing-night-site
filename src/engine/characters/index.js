// Character registry (CHARACTERS agent). The engine calls CHARACTERS[who](ctx, { companion }) for lavinia, pike and
// cat (src/engine/Game.js → makeCharacters); a factory that throws falls back to the placeholder stub. Each factory
// also registers the dialogue portraits (once per ctx). See docs/notes/characters.md.
import { Lavinia } from './Lavinia.js';
import { Pike } from './Pike.js';
import { Cat } from './Cat.js';
import { registerPortraits } from './portraits.js';

const make = (Cls) => (ctx, opts = {}) => {
  try { registerPortraits(ctx); } catch (e) { console.error('[characters] portraits', e); }
  return new Cls(ctx, opts);
};

export const CHARACTERS = {
  lavinia: make(Lavinia),
  pike: make(Pike),
  cat: make(Cat),
};

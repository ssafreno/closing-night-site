// Every player-facing line, merged from src/content/script/*.js: one module per room plus common.js (title, HUD,
// toasts, journal, shared captions). WRITER owns the modules; ENGINE owns this merger.
//
// Shapes (docs/ENGINE_API.md, Dialogue):
//   caption   'text'  or  ['text', 'text']            a narrator caption (a pool picks one)
//   lines     [{ who, text }, …]                        spoken lines in order; who ∈ manifest.characters
//   pool      [lines, lines, …]                         one picked at random
//   choice    { prompt: lines, options: [{ text, reply: lines }, { text, reply: lines }] }
// Each module exports `lines` (the keys) and `complete` (true once WRITER has finished it: script-check then turns
// missing-key warnings into failures for that room).
import * as common from './script/common.js';
import * as door from './script/door.js';
import * as stage from './script/stage.js';
import * as wardrobe from './script/wardrobe.js';
import * as pit from './script/pit.js';
import * as foyer from './script/foyer.js';
import * as dressing from './script/dressing.js';
import * as finale from './script/finale.js';

export const MODULES = { common, door, stage, wardrobe, pit, foyer, dressing, finale };

export const script = {};
for (const [name, mod] of Object.entries(MODULES)) {
  for (const [k, v] of Object.entries(mod.lines || {})) {
    if (k in script) console.warn(`[script] ${name} redefines "${k}"`);
    script[k] = v;
  }
}

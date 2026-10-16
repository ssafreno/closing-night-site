// Page 97 of the prompt book, shared by the `lastpage` paper (dressing) and the prompt book's page 8 (stage).
// Not a papers module (src/content/papers.js does not merge it). WRITER owns this file.
// Canonical text: docs/rooms/dressing.md (`lastpage`) and DESIGN §4. The cue boxes are the capstone's document:
// keep every number, department and trigger exactly as written.

const box = (t) => `<span style="display:inline-block;border:1.5px solid #6a6a6a;border-radius:2px;padding:0 5px;color:#4a4a4a;font-weight:700">${t}</span>`;
const pencil = (t) => `<span class="cn-pencil" style="font-size:0.9em">${t}</span>`;
const hand = (t) => `<span class="cn-hand">${t}</span>`;

export const LASTPAGE_TITLE = 'The Lamp at Gull Point — p. 97';

export const LASTPAGE_HTML = [
  'ACT III Sc. 2 (final)',
  '',
  `${box('Q31 HOUSE')} — to black — ON "Places, please."`,
  `${box('Q32 SOUND')} — overture — ON house black`,
  `${box('Q33 FLY')} — tabs OUT — ON the overture's last chord`,
  `${box('Q34 LX')} — moonlight — ON tabs out`,
  '',
  `GRACE: Father, the sea is coming in!  ▸ ${box('Q35 FX')} — storm (wind, rain)`,
  'EZRA: The door is barred, girl. The oil is gone.',
  `GRACE: Then I shall light it myself.  ▸ ${box('Q36 WARDROBE')} — cloak release`,
  '<i>(She climbs to the lamp room.)</i>',
  `GRACE: Burn, old lamp. Burn for him.  ▸ ${box('Q37 LX')} — the lamp`,
  '<i>(The ship turns. Surf. JACK is carried in.)</i>',
  `GRACE: ...and the sea gave him back to me.  ▸ ${box('Q38 FX')} — thunder and lightning`,
  'EZRA: Forgive me, Grace.',
  `GRACE: Gull Point will keep its light.  ▸ ${box('Q39 FLY')} — tabs IN`,
  '',
  `${box('Q40 HOUSE')} — house UP — ON the bow.`,
  '',
  pencil('Her last speech changes nightly. Cue off the last line regardless. — H.P.'),
  hand('Revised 14.3.31 — L.T.'),
].join('\n');

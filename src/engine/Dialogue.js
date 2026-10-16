// Dialogue box (typewriter + blips + queue), narrator captions, choices (two or three options), the speaker registry,
// and cycle(): numbered / pooled script keys taken in turn (idle chatter, wrong-attempt lines, item.any.wrong).
// A line may carry `tag: 'Note:'` (Hints adds it to hint lines): a small italic label before the text, not typed out.
// Choices stand in a column ABOVE the box (out of the band where players click to advance) and ignore clicks for
// CHOICE_GRACE_MS after they appear, so a click meant for the line before never picks one.
const CHOICE_GRACE_MS = 300;

// ---- placeholder portraits ---------------------------------------------------------------------------------
// SVG strings may use class="cn-mouth" (opens while a line types) and class="cn-eyelid" (blinks). The CHARACTERS
// agent replaces these with dialogue.registerSpeaker(who, { portrait }) (an SVG string or a canvas draw function).
const LAVINIA_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="lvbg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#6a4a7e"/><stop offset="1" stop-color="#1c1224"/></radialGradient>
    <radialGradient id="lvglow" cx="50%" cy="45%" r="50%"><stop offset="0" stop-color="#fff2d0" stop-opacity=".55"/><stop offset="1" stop-color="#e8c8ff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100" height="100" fill="url(#lvbg)"/>
  <circle cx="50" cy="46" r="40" fill="url(#lvglow)"/>
  <g stroke="#2a1830" stroke-width="2" stroke-linejoin="round">
    <path d="M14 104 Q18 70 50 70 Q82 70 86 104 Z" fill="#c9a0d8"/>
    <path d="M34 74 Q50 84 66 74" fill="none" stroke="#f3ead8" stroke-width="3.2"/>
    <path d="M30 40 Q28 16 50 15 Q72 16 70 40 Q72 30 60 26 Q50 32 40 26 Q28 30 30 40 Z" fill="#7a4a3a"/>
    <path d="M35 42 Q35 26 50 26 Q65 26 65 42 Q65 62 50 66 Q35 62 35 42 Z" fill="#f2e2d8"/>
  </g>
  <path d="M60 18 Q72 2 80 4 Q70 10 66 20" fill="#f6f0ff" stroke="#2a1830" stroke-width="1.4"/>
  <circle cx="61" cy="20" r="3" fill="#e8c860" stroke="#2a1830" stroke-width="1.2"/>
  <g fill="#2a1830"><ellipse cx="43" cy="43" rx="2.2" ry="2.8"/><ellipse cx="57" cy="43" rx="2.2" ry="2.8"/></g>
  <g class="cn-eyelid" fill="#f2e2d8"><rect x="38" y="37" width="10" height="7" rx="3"/><rect x="52" y="37" width="10" height="7" rx="3"/></g>
  <path d="M38 37 Q43 33 47 36 M53 36 Q57 33 62 37" fill="none" stroke="#3a2030" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M38 39 L36 37 M62 39 L64 37" stroke="#3a2030" stroke-width="1.2"/>
  <path d="M49 47 L50 52 L52 47" fill="none" stroke="#b08a8a" stroke-width="1.2"/>
  <path class="cn-mouth" style="transform-origin:50px 57px" d="M45 57 Q50 60 55 57 Q50 58 45 57 Z" fill="#b0344a" stroke="#6a1a2a" stroke-width="1.2"/>
  <circle cx="40" cy="52" r="3" fill="#f0a0a8" opacity=".45"/><circle cx="60" cy="52" r="3" fill="#f0a0a8" opacity=".45"/>
</svg>`;
const PIKE_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="pkbg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#4a5a6a"/><stop offset="1" stop-color="#141a20"/></radialGradient></defs>
  <rect width="100" height="100" fill="url(#pkbg)"/>
  <g stroke="#141018" stroke-width="2" stroke-linejoin="round">
    <path d="M18 104 Q22 72 50 70 Q78 72 82 104 Z" fill="#e8e2d4"/>
    <path d="M30 78 L42 72 L50 90 L58 72 L70 78 L72 104 L28 104 Z" fill="#5a4a3a"/>
    <path d="M36 42 Q36 28 50 28 Q64 28 64 42 Q64 62 50 66 Q36 62 36 42 Z" fill="#dcc8b0"/>
    <ellipse cx="50" cy="29" rx="24" ry="4.5" fill="#22201e"/>
    <path d="M37 29 Q36 12 50 12 Q64 12 63 29 Z" fill="#2c2a28"/>
    <path d="M37 25 L63 25" stroke="#6a5a4a" stroke-width="2.4"/>
  </g>
  <g fill="#141018"><ellipse cx="44" cy="43" rx="2" ry="2.2"/><ellipse cx="56" cy="43" rx="2" ry="2.2"/></g>
  <g class="cn-eyelid" fill="#dcc8b0"><rect x="39" y="38" width="10" height="6" rx="3"/><rect x="51" y="38" width="10" height="6" rx="3"/></g>
  <path d="M39 38 L48 39 M52 39 L61 38" fill="none" stroke="#4a3a2a" stroke-width="2" stroke-linecap="round"/>
  <path d="M42 54 Q50 51 58 54 Q50 57 42 54 Z" fill="#6a5a4a" stroke="#3a2a1a" stroke-width="1"/>
  <path class="cn-mouth" style="transform-origin:50px 58px" d="M46 58 L54 58" fill="none" stroke="#4a2a2a" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="74" cy="92" r="6" fill="#c9a24a" stroke="#141018" stroke-width="1.4"/><path d="M74 92 L74 88" stroke="#141018" stroke-width="1.2"/>
</svg>`;
const CAT_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="ctbg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#6a2a2a"/><stop offset="1" stop-color="#1a0c0c"/></radialGradient></defs>
  <rect width="100" height="100" fill="url(#ctbg)"/>
  <g stroke="#1a1414" stroke-width="2" stroke-linejoin="round">
    <path d="M22 104 Q24 70 50 68 Q76 70 78 104 Z" fill="#8d8f93"/>
    <path d="M40 76 Q50 70 60 76 L56 96 L44 96 Z" fill="#f2f0ea"/>
    <path d="M26 56 L28 22 L42 34 Q50 32 58 34 L72 22 L74 56 Q74 72 50 74 Q26 72 26 56 Z" fill="#9a9ca1"/>
    <path d="M70 24 L66 30 L72 30 Z" fill="#6a2a2a"/>
  </g>
  <path d="M36 40 L40 46 M50 36 L50 44 M64 40 L60 46" stroke="#5a5c60" stroke-width="2.4" stroke-linecap="round"/>
  <g fill="#e8b040" stroke="#1a1414" stroke-width="1.2"><ellipse cx="41" cy="52" rx="4.5" ry="4"/><ellipse cx="59" cy="52" rx="4.5" ry="4"/></g>
  <g fill="#1a1414"><ellipse cx="41" cy="52" rx="1.2" ry="3.4"/><ellipse cx="59" cy="52" rx="1.2" ry="3.4"/></g>
  <g class="cn-eyelid" fill="#9a9ca1"><rect x="35" y="47" width="12" height="9" rx="4"/><rect x="53" y="47" width="12" height="9" rx="4"/></g>
  <path d="M47 60 L53 60 L50 63 Z" fill="#d88a8a" stroke="#1a1414" stroke-width="1"/>
  <path class="cn-mouth" style="transform-origin:50px 65px" d="M45 65 Q50 68 50 63 Q50 68 55 65" fill="none" stroke="#1a1414" stroke-width="1.4"/>
</svg>`;

const LAVINIA_OFF_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="lobg" cx="50%" cy="80%" r="70%"><stop offset="0" stop-color="#5a3a6a"/><stop offset="1" stop-color="#0c0810"/></radialGradient></defs>
  <rect width="100" height="100" fill="url(#lobg)"/>
  <path d="M14 104 Q18 70 50 70 Q82 70 86 104 Z M30 40 Q28 16 50 15 Q72 16 70 40 Q66 62 50 66 Q34 62 30 40 Z" fill="#120a16"/>
  <path d="M60 18 Q72 2 80 4 Q70 10 66 20" fill="#120a16"/>
  <rect x="0" y="92" width="100" height="8" fill="#c9a0d8" opacity=".35"/>
</svg>`;

/** Built-in speakers. `blip` is passed to audio.blip(who, blip) per letter; `false` = silent. */
const DEFAULT_SPEAKERS = {
  lavinia: { name: 'Lavinia', portrait: LAVINIA_SVG, blip: { pitch: 1.35, vibrato: 0.06, every: 2 }, style: { accent: '#7a3e8a' } },
  lavinia_off: { name: 'A voice, off', portrait: LAVINIA_OFF_SVG, blip: { pitch: 1.3, vibrato: 0.05, every: 2, muffled: true }, style: { accent: '#5a3e6a', className: 'cn-off' } },
  pike: { name: 'Mr. Pike', portrait: PIKE_SVG, blip: { pitch: 0.62, vibrato: 0, every: 3, short: true }, style: { accent: '#3a4a5a' } },
  cat: { name: 'Bartholomew', portrait: CAT_SVG, blip: { pitch: 0.9, vibrato: 0.02, every: 3 }, style: { accent: '#6a2a2a' } },
  narrator: { name: '', portrait: null, blip: false, style: null },
};

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// POLISH: straight double quotes in the script render as a pair of closing quotes in IM Fell ("I have seen it." read
// as ”I have seen it.”); curl them: an opening quote after a start, space, bracket, dash or emphasis mark.
export function smartQuotes(s) {
  return String(s).replace(/(^|[\s(\[—–*])"/g, '$1\u201C').replace(/"/g, '\u201D');
}

/** Parse *emphasis* into tokens [{ch, em}]. */
function tokenize(text) {
  text = smartQuotes(text); // POLISH
  const out = [];
  let em = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '*') { em = !em; continue; }
    out.push({ ch, em });
  }
  return out;
}
function tokensToHtml(tokens, n) {
  let html = '', em = false;
  for (let i = 0; i < n; i++) {
    const t = tokens[i];
    if (t.em !== em) { html += t.em ? '<em>' : '</em>'; em = t.em; }
    html += escapeHtml(t.ch);
  }
  if (em) html += '</em>';
  return html;
}

export class Dialogue {
  constructor(ctx) {
    this.ctx = ctx;
    this.cps = 42;            // characters per second
    this.isOpen = false;      // true while a blocking line/choice is on screen
    this._queue = Promise.resolve();
    this._pending = 0;
    this._line = null;        // { tokens, shown, done, resolve }
    this.closedAt = -1e9;     // performance.now() when the box last closed or a choice was taken (Interaction's grace)
    this.openedAt = -1e9;     // performance.now() when the box last opened
    this.advancedAt = -1e9;   // performance.now() when a line was last dismissed
    this.speakers = new Map();
    for (const [who, sp] of Object.entries(DEFAULT_SPEAKERS)) this.registerSpeaker(who, sp);
    /** Template values for `{name}` in lines: a string or a function returning one. See `_fill`. */
    this.vars = {};

    // its own layer on body: above the fade (a line can be said over black); see ui.css
    const layer = document.createElement('div');
    layer.className = 'cn-dialogue-layer';
    document.body.appendChild(layer);
    this.layer = layer;

    const el = document.createElement('div');
    el.className = 'cn-dialog cn-hidden';
    el.innerHTML = `
      <div class="cn-portrait"></div>
      <div class="cn-dialog-body">
        <div class="cn-speaker"></div>
        <div class="cn-text"></div>
        <div class="cn-choices"></div>
      </div>
      <div class="cn-next"></div>`;
    layer.appendChild(el);
    this.el = el;
    this.portraitEl = el.querySelector('.cn-portrait');
    this.speakerEl = el.querySelector('.cn-speaker');
    this.textEl = el.querySelector('.cn-text');
    this.choicesEl = el.querySelector('.cn-choices');
    el.addEventListener('click', (e) => { if (!e.target.closest('.cn-choice')) this.advance(); });

    this.captionEl = document.createElement('div');
    this.captionEl.className = 'cn-caption cn-hidden';
    layer.appendChild(this.captionEl);
    this._captionTimer = null;
    // a click ON a caption dismisses it and goes no further (players click captions away; it must not hit the scene
    // under it). The press never reaches the canvas, so Interaction never sees it. Clicks elsewhere are untouched.
    const swallow = (e) => { e.stopPropagation(); };
    this.captionEl.addEventListener('pointerdown', (e) => { swallow(e); if (e.button === 0) this.hideCaption(); });
    this.captionEl.addEventListener('click', swallow);

    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.advance(); }
    });
  }

  // ---- speakers ---------------------------------------------------------------
  /**
   * Register (or update) a speaker. Fields merge into any existing entry.
   * @param {string} who  the `who` value used in script lines
   * @param {{ name?: string, portrait?: string|((g: CanvasRenderingContext2D, size: number) => void)|null,
   *   blip?: false|{ pitch?: number, vibrato?: number, every?: number, short?: boolean, [k: string]: any },
   *   style?: { accent?: string, className?: string }|null }} def
   *   portrait: an SVG string (classes cn-mouth / cn-eyelid animate) or a canvas draw function (redrawn per line).
   *   blip: options passed to `audio.blip(who, opts)` (pitch is jittered per letter); `every` = one blip per N letters.
   *   style.accent: the speaker-name colour and box edge; style.className: an extra class on the dialogue box.
   */
  registerSpeaker(who, def = {}) {
    const prev = this.speakers.get(who) || { name: who, portrait: null, blip: { pitch: 1, every: 2 }, style: null };
    this.speakers.set(who, { ...prev, ...def });
    if (this._portraitWho === who) this._portraitWho = null;
  }
  speaker(who) { return this.speakers.get(who) || { name: who, portrait: null, blip: { pitch: 1, every: 2 }, style: null }; }

  // ---- content resolution ---------------------------------------------------
  /** Merge extra keys into the script (existing keys are NOT overwritten unless overwrite=true). */
  addScript(entries, { overwrite = false } = {}) {
    const s = this.ctx.script;
    for (const [k, v] of Object.entries(entries)) if (overwrite || !(k in s)) s[k] = v;
  }

  has(key) { return !!this.ctx.script && typeof key === 'string' && key in this.ctx.script; }

  /**
   * The next of a set of lines taken in turn (the counter `cycle.<base>` is saved): numbered keys `<base>.1`, `<base>.2`
   * ... when they exist, else `<base>` itself when it is a pool (an array of strings or of line-arrays), in order.
   * Returns something say() / auto() / caption() accept, or null when there is nothing under that base.
   * @param {string} base  e.g. 'stage.idle', 'door.meter.wrong', 'item.any.wrong'
   * @param {{ advance?: boolean }} [opts]  advance (default true): move the counter on
   */
  cycle(base, { advance = true } = {}) {
    const s = this.ctx.script || {};
    const st = this.ctx.state;
    const keys = [];
    for (let n = 1; n <= 20 && `${base}.${n}` in s; n++) keys.push(`${base}.${n}`);
    let pool = null;
    if (!keys.length) {
      const v = s[base];
      if (Array.isArray(v) && v.length && (typeof v[0] === 'string' || Array.isArray(v[0]))) pool = v;
      else return base in s ? base : null;
    }
    const len = keys.length || pool.length;
    const i = st ? st.get(`cycle.${base}`, 0) : 0;
    if (advance) st?.set(`cycle.${base}`, i + 1);
    if (keys.length) return keys[i % len];
    const pick = pool[i % len];
    return pick; // a string → a caption / narrator line; a line-array → spoken
  }

  /**
   * Normalise a key or raw content into an array of {who, text}.
   * - string key → script lookup; unknown dotted key → warning, nothing; any other string → a narrator line
   * - script string → narrator line; array of strings → random one; array of line-arrays → random one
   */
  resolve(keyOrLines) {
    let v = keyOrLines;
    if (typeof v === 'string') {
      if (this.ctx.script && v in this.ctx.script) v = this.ctx.script[v];
      else if (/^[\w.-]+$/.test(v) && v.includes('.')) {
        console.warn(`[dialogue] missing script key "${v}"`);
        return [];
      }
    }
    if (v == null) return [];
    if (typeof v === 'string') return [{ who: 'narrator', text: v }];
    if (Array.isArray(v)) {
      if (v.length === 0) return [];
      if (typeof v[0] === 'string') return [{ who: 'narrator', text: v[Math.floor(Math.random() * v.length)] }];
      if (Array.isArray(v[0])) return this.resolve(v[Math.floor(Math.random() * v.length)]);
      return v.map((l) => (typeof l === 'string' ? { who: 'narrator', text: l } : l));
    }
    if (typeof v === 'object' && v.text) return [v];
    return [];
  }

  // ---- public API -------------------------------------------------------------
  /** Say a script key (or raw lines). Calls serialize. Resolves after the last line is dismissed. */
  say(keyOrLines) {
    const lines = this.resolve(keyOrLines);
    return this._enqueue(() => this._playLines(lines));
  }

  sayLines(lines) { return this.say(lines); }

  /**
   * The right channel for a key: a narrator caption for a string / pool of strings (or plain text), a spoken line
   * for anything with speakers. Returns a promise either way (a caption's resolves at once).
   */
  auto(keyOrText) {
    const v = this.has(keyOrText) ? this.ctx.script[keyOrText] : keyOrText;
    const isCaption = typeof v === 'string' || (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string'));
    if (isCaption) { this.caption(keyOrText); return Promise.resolve(); }
    return this.say(keyOrText);
  }

  /**
   * Two-option choice. Resolves with the chosen index (0/1) after the reply is played. `onPick(idx)` runs the moment an
   * option is taken, before the reply (do the state change there so the HUD moves with the click, not after the reply).
   */
  choice(keyOrDef, { onPick } = {}) {
    const def = typeof keyOrDef === 'string' ? this.ctx.script?.[keyOrDef] : keyOrDef;
    if (!def) { console.warn(`[dialogue] missing choice "${keyOrDef}"`); return Promise.resolve(-1); }
    return this._enqueue(async () => {
      const prompt = this.resolve(def.prompt || []);
      for (let i = 0; i < prompt.length - 1; i++) await this._showLine(prompt[i]);
      const last = prompt[prompt.length - 1] || { who: 'narrator', text: '' };
      const idx = await this._showLine(last, def.options || []);
      if (onPick) { try { await onPick(idx); } catch (e) { console.error(e); } }
      const reply = this.resolve(def.options?.[idx]?.reply || []);
      await this._playLines(reply, true);
      return idx;
    });
  }

  /** Narrator caption: non-blocking, auto-dismisses. Accepts a script key or text. */
  caption(keyOrText, { duration, scope, top = false } = {}) {
    // `top`: sit under the HUD instead of above the inventory (a close-up whose working parts are low in the frame)
    // `scope`: only show if the hotspot scope is still this one (a caption that arrives after the player has left the
    // close-up is dropped). Captions shown in a close-up are hidden when the scope changes (Interaction calls _scopeChanged).
    const cur = this.ctx.hotspots?.scope;
    if (scope && cur !== scope) return;
    let text = keyOrText;
    if (typeof keyOrText === 'string' && this.ctx.script && keyOrText in this.ctx.script) {
      const lines = this.resolve(keyOrText);
      text = lines.map((l) => l.text).join(' ');
    } else if (Array.isArray(keyOrText)) {
      text = keyOrText[Math.floor(Math.random() * keyOrText.length)];
    }
    if (!text) return;
    text = this._fill(text);
    this._captionScope = cur ?? null;
    const el = this.captionEl;
    el.innerHTML = tokensToHtml(tokenize(text), tokenize(text).length);
    el.classList.toggle('cn-caption-top', !!top);
    el.classList.remove('cn-hidden');
    clearTimeout(this._captionTimer);
    const ms = (duration ?? Math.max(2.5, text.split(/\s+/).length * 0.32 + 1)) * 1000;
    clearTimeout(this._captionClear);
    this._captionTimer = setTimeout(() => this._hideCaptionEl(), ms);
  }

  hideCaption() { clearTimeout(this._captionTimer); this._hideCaptionEl(); }
  /** A narrator caption is on screen (Esc hides it before leaving a close-up). */ // ENGINE-FIX
  get captionShowing() { return !this.captionEl.classList.contains('cn-hidden'); }
  /** Hide the caption and, once it has faded, take its text out of the DOM (no stale line for a reader to find). */
  _hideCaptionEl() {
    const el = this.captionEl;
    el.classList.add('cn-hidden');
    clearTimeout(this._captionClear);
    this._captionClear = setTimeout(() => { if (el.classList.contains('cn-hidden')) el.textContent = ''; }, 400);
  }
  /** Interaction calls this when the hotspot scope changes: a caption that belonged to a close-up goes with it. */
  _scopeChanged(next) {
    if (this._captionScope && this._captionScope !== 'room' && this._captionScope !== next) this.hideCaption();
  }

  /** Complete the current typewriter line, or advance if already complete. */
  advance() {
    const l = this._line;
    if (!l || l.choices) return;
    if (!l.done) { l.shown = l.tokens.length; this._renderLine(); return; }
    this.advancedAt = performance.now();
    this._line = null;
    this._talk(l.who, false);
    l.resolve(0);
  }
  /** Esc: close the line on screen at once (typing or not). A choice is never dismissed. Returns true if a line closed. */
  dismiss() {
    const l = this._line;
    if (!l || l.choices) return false;
    if (!l.done) { l.shown = l.tokens.length; this._renderLine(); }
    this.advance();
    return true;
  }
  /** A choice is on screen (its buttons are, or will be once the prompt has typed). */
  get choosing() { return !!this._line?.choices; }
  skip() { this.advance(); }

  /** Is anything queued or showing? */
  get busy() { return this._pending > 0; }

  // ---- internals -------------------------------------------------------------
  /**
   * Fill `{name}` placeholders: `dialogue.vars[name]` (string, or function returning one) first, else the script key
   * `var.<name>`: a string as is, or a pool of strings taken in turn (the counter `var.<name>.i` is saved, so the
   * sequence carries across reloads, e.g. Lavinia's rotating wrong names for the player). Unknown names stay as typed.
   */
  _fill(text) {
    if (!text || text.indexOf('{') < 0) return text;
    return text.replace(/\{(\w+)\}/g, (m, k) => {
      const v = this.vars[k];
      if (typeof v === 'function') { try { return String(v()); } catch (e) { console.error(e); return m; } }
      if (v != null) return String(v);
      const s = this.ctx.script?.[`var.${k}`];
      if (typeof s === 'string') return s;
      if (Array.isArray(s) && s.length && typeof s[0] === 'string') {
        const st = this.ctx.state;
        const i = st ? st.get(`var.${k}.i`, 0) : 0;
        st?.set(`var.${k}.i`, i + 1);
        return s[i % s.length];
      }
      return m;
    });
  }

  _enqueue(fn) {
    this._pending++;
    const p = this._queue.then(fn).catch((e) => { console.error(e); }).finally(() => {
      this._pending--;
      if (this._pending === 0) this._close();
    });
    this._queue = p;
    return p;
  }

  async _playLines(lines, keepOpen = false) {
    for (const l of lines) await this._showLine(l);
  }

  _close() {
    if (this.isOpen) {
      this.closedAt = performance.now();
      // where the box stood: Interaction keeps it blocking the scene under it for a moment (no click-through)
      const r = this.el.getBoundingClientRect();
      this.lastRect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
    this.isOpen = false;
    this.el.classList.add('cn-hidden');
    this.portraitEl.classList.remove('cn-talk');
    // once it has faded, the box keeps no stale text in the DOM (cleared when the fade really ends, not on a timer: a
    // throttled tab can stall the transition, and clearing early showed an empty parchment box for a beat)
    clearTimeout(this._clearTimer);
    const el = this.el;
    const clear = () => {
      el.removeEventListener('transitionend', onEnd);
      clearTimeout(this._clearTimer);
      if (this.isOpen) return;
      this.textEl.textContent = ''; this.speakerEl.textContent = ''; this.choicesEl.innerHTML = '';
    };
    const onEnd = (e) => { if (e.target === el && e.propertyName === 'opacity') clear(); };
    el.removeEventListener('transitionend', this._onFadeEnd || (() => {}));
    this._onFadeEnd = onEnd;
    el.addEventListener('transitionend', onEnd);
    this._clearTimer = setTimeout(clear, 1500);
  }

  _renderPortrait(who, sp) {
    const p = sp.portrait;
    this.portraitEl.style.display = p ? '' : 'none';
    if (!p || this._portraitWho === who) return;
    this._portraitWho = who;
    if (typeof p === 'function') {
      const size = 156;
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      try { p(cv.getContext('2d'), size); } catch (e) { console.error(`[dialogue] portrait ${who}`, e); }
      this.portraitEl.innerHTML = '';
      this.portraitEl.appendChild(cv);
    } else this.portraitEl.innerHTML = String(p);
  }

  /** Tell the speaking character (ctx.characters[who]) that it is talking, if it cares. */
  _talk(who, on) {
    try { this.ctx.characters?.[who]?.talk?.(on); } catch (e) { console.error(e); }
  }

  _showLine(line, choices = null) {
    const who = line.who || 'narrator';
    const sp = this.speaker(who);
    if (!this.isOpen) this.openedAt = performance.now();
    this.isOpen = true;
    this.hideCaption();
    const el = this.el;
    el.classList.remove('cn-hidden', 'cn-done');
    el.classList.toggle('cn-narrator', who === 'narrator');
    if (this._styleClass) { el.classList.remove(this._styleClass); this._styleClass = null; }
    if (sp.style?.className) { el.classList.add(sp.style.className); this._styleClass = sp.style.className; }
    el.style.setProperty('--cn-accent', sp.style?.accent || '');
    el.dataset.who = who;
    this._renderPortrait(who, sp);
    this.speakerEl.textContent = sp.name || '';
    this.speakerEl.style.display = sp.name ? '' : 'none';
    this.choicesEl.innerHTML = '';
    const tokens = tokenize(this._fill(String(line.text ?? '')));
    if (this._lastWho && this._lastWho !== who) this._talk(this._lastWho, false);
    this._lastWho = who;
    this._talk(who, true);
    return new Promise((resolve) => {
      // a line usually starts from a tween's promise, between frames: its first letter goes up now, not on the next
      // frame, and the typewriter runs on the wall clock (update), so a slow frame catches up instead of crawling
      this._line = { who, tag: line.tag || null, tokens, shown: Math.min(1, tokens.length), acc: 0, done: false, resolve, sp, choices, blipAcc: 0, startedAt: performance.now() };
      this._renderLine();
      this.ctx.game?.kick?.();
    });
  }

  _renderLine() {
    const l = this._line;
    if (!l) return;
    this.textEl.innerHTML = (l.tag ? `<span class="cn-line-tag">${escapeHtml(String(l.tag))}</span> ` : '') + tokensToHtml(l.tokens, l.shown);
    if (l.shown >= l.tokens.length && !l.done) {
      l.done = true;
      this.el.classList.add('cn-done');
      this.portraitEl.classList.remove('cn-talk');
      if (l.choices && l.choices.length) {
        this.el.classList.remove('cn-done');
        const shownAt = performance.now();
        this.choicesEl.classList.add('cn-choices-wait');
        setTimeout(() => this.choicesEl.classList.remove('cn-choices-wait'), CHOICE_GRACE_MS);
        l.choices.forEach((opt, i) => {
          const b = document.createElement('button');
          b.className = 'cn-choice';
          b.type = 'button';
          b.textContent = this._fill(opt.text);
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._line !== l || performance.now() - shownAt < CHOICE_GRACE_MS) return; // a click meant for the line before
            this.ctx.audio?.play('click');
            this.closedAt = performance.now();
            this._line = null;
            this._talk(l.who, false);
            this.choicesEl.innerHTML = '';
            l.resolve(i);
          });
          this.choicesEl.appendChild(b);
        });
      }
    }
  }

  /** Called by Game every frame. */
  update(dt) {
    const l = this._line;
    if (!l || l.done) return;
    const before = l.shown;
    // wall-clock typing: where the line should be by now (one letter shows at once), whatever the frame rate did
    const due = 1 + Math.floor(((performance.now() - (l.startedAt ?? performance.now())) / 1000) * this.cps);
    const add = due - l.shown;
    if (add > 0) {
      l.shown = Math.min(l.tokens.length, due);
      const blip = l.sp.blip;
      if (blip) {
        this.portraitEl.classList.add('cn-talk');
        const every = Math.max(1, blip.every || 2);
        // after a slow frame, blip only the last few letters (not a burst of every letter missed)
        for (let i = Math.max(before, l.shown - 4); i < l.shown; i++) {
          const ch = l.tokens[i].ch;
          if (/[\s.,!?…—-]/.test(ch)) continue;
          if (++l.blipAcc % every === 0) {
            const jitter = 1 + (Math.random() - 0.5) * 0.12;
            this.ctx.audio?.blip?.(l.who, { ...blip, pitch: (blip.pitch ?? 1) * jitter, index: l.blipAcc });
          }
        }
      }
      this._renderLine();
    }
  }
}

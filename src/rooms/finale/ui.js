// The finale's DOM layers (docs/rooms/finale.md): the stage line (surtitles: the play's lines and Pike's calls, typed
// with blips but never blocking a click, so the GO buttons stay live while a line is up), the review on the clipboard,
// the "Not vacant." close-up, and the credits (the Pelham Gazette front page, the roll, the end card).
// Everything here is skippable: each piece has skip() (Esc hurries it) and settles its promise exactly once.
import { fmtTime } from '../../engine/HUD.js';

const CSS = `
.fn-line { position: fixed; left: 50%; top: calc(max(14px, env(safe-area-inset-top)) + 58px); transform: translateX(-50%);
  z-index: 84; pointer-events: none !important; width: min(760px, calc(100vw - 48px)); text-align: center;
  font: 500 clamp(20px, 3.1vh, 27px)/1.35 var(--serif); color: #f3e6c6; text-shadow: 0 2px 10px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.9);
  opacity: 0; transition: opacity 0.3s ease; }
.fn-line.fn-on { opacity: 1; }
.fn-line .fn-who { display: block; font: 600 11px var(--sans); letter-spacing: 0.32em; text-transform: uppercase; color: #d8b870; margin-bottom: 4px; }
.fn-line.fn-pike .fn-who { color: #b8c4d0; }
.fn-line.fn-pike { font-size: clamp(18px, 2.7vh, 23px); color: #e4e8ec; }
.fn-line.fn-dir { font-style: italic; color: #d8cdb4; font-size: clamp(17px, 2.5vh, 21px); }
.fn-line.fn-dir .fn-text::before { content: '( '; } .fn-line.fn-dir .fn-text::after { content: ' )'; }
.fn-line .fn-rest { opacity: 0; }
.fn-review-back { position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-start; justify-content: center; padding-top: 5vh;
  background: radial-gradient(ellipse at center, rgba(10,6,3,0.35), rgba(5,3,2,0.7)); animation: cn-fade-in 0.5s ease-out; }
.fn-review-back.fn-out { animation: cn-fade-out 0.5s ease-in forwards; pointer-events: none; }
.fn-review-back .cn-paper { max-height: none; overflow: visible; width: min(600px, 92vw); padding: 40px 50px 30px; }
.fn-review-back .cn-paper-body { white-space: pre-wrap; }
.fn-remarks { display: block; margin-top: 6px; min-height: 2.3em; border-bottom: 1px solid rgba(34,50,74,0.55); position: relative; }
.fn-remarks .fn-hand { font-family: var(--hand); font-size: 1.05em; line-height: 2.1; color: #1f2a5a; white-space: pre-wrap; }
.fn-remarks .fn-hand.fn-lav { color: #4a2a6a; font-size: 1.12em; }
.fn-remarks.fn-pick { outline: 2px dashed rgba(122,28,42,0.0); }
.fn-opts { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.fn-opts .cn-choice { width: 100%; font-size: clamp(15px, 2.2vh, 18px); }
.fn-opts.fn-gone { opacity: 0; transition: opacity 0.4s; pointer-events: none; }
.fn-clip { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center;
  background: #0b0806; animation: cn-fade-in 0.8s ease-out; cursor: pointer; }
.fn-clip.fn-out { animation: cn-fade-out 0.8s ease-in forwards; pointer-events: none; }
.fn-clip .cn-paper { animation: fn-clip-in 1.4s cubic-bezier(.2,.8,.3,1) both; max-height: none; overflow: visible; }
@keyframes fn-clip-in { from { transform: scale(0.82) rotate(-2deg); opacity: 0; } to { transform: scale(1) rotate(0.3deg); opacity: 1; } }
.fn-clip .fn-nv { display: block; font-family: var(--hand); color: #4a2a6a; font-size: 1.7em; line-height: 1.6; margin: 4px 0 0 1.5em; transform: rotate(-3deg); min-height: 1.6em; }
.fn-credits { position: fixed; inset: 0; z-index: 80; overflow: hidden; pointer-events: auto;
  background: radial-gradient(ellipse at 50% 60%, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.8) 100%); }
.fn-gazette { position: absolute; left: 50%; top: 50%; width: min(620px, 90vw); padding: 26px 34px 30px; color: #1a1712;
  background: linear-gradient(180deg, #ece6d4, #ddd4bc); box-shadow: 0 20px 60px rgba(0,0,0,0.7), inset 0 0 50px rgba(120,100,60,0.25);
  transform: translate(-50%, 140vh) rotate(-1.2deg); transition: transform 1.6s cubic-bezier(.2,.85,.25,1); }
.fn-gazette.fn-up { transform: translate(-50%, -50%) rotate(-1.2deg); }
.fn-gazette.fn-away { transform: translate(-50%, -160vh) rotate(-2deg); transition-duration: 1.4s; transition-timing-function: cubic-bezier(.6,0,.8,.4); }
.fn-gazette .fn-mast { text-align: center; font: 400 clamp(30px, 5.2vh, 44px)/1 var(--display); letter-spacing: 0.04em; border-bottom: 3px double #1a1712; padding-bottom: 8px; }
.fn-gazette .fn-date { display: flex; justify-content: space-between; font: 600 11px var(--sans); letter-spacing: 0.16em; text-transform: uppercase; border-bottom: 1px solid #1a1712; padding: 5px 0; margin-bottom: 14px; }
.fn-gazette .fn-head { font: 800 clamp(26px, 4.6vh, 40px)/1.02 Georgia, 'Times New Roman', serif; text-transform: uppercase; letter-spacing: -0.01em; text-align: center; margin: 4px 0 12px; }
.fn-gazette .fn-stand { font: italic 500 clamp(15px, 2.3vh, 19px)/1.4 Georgia, 'Times New Roman', serif; text-align: center; border-bottom: 1px solid #1a1712; padding-bottom: 12px; margin-bottom: 12px; }
.fn-gazette .fn-cols { columns: 3; column-gap: 16px; column-rule: 1px solid rgba(26,23,18,0.4); }
.fn-gazette .fn-cols i { display: block; height: 7px; margin: 0 0 7px; background: rgba(26,23,18,0.22); border-radius: 1px; }
.fn-roll { position: absolute; left: 0; right: 0; top: 0; text-align: center; color: #efe2c2; text-shadow: 0 2px 8px rgba(0,0,0,0.95);
  font: 500 clamp(17px, 2.6vh, 22px)/1.5 var(--serif); will-change: transform; padding: 0 24px; }
.fn-roll .fn-h { font: 400 clamp(26px, 4.4vh, 38px)/1.15 var(--display); letter-spacing: 0.05em; color: #f2d58e; margin: 0.4em 0 0.2em; }
.fn-roll .fn-sub { font-style: italic; color: #d8c8a4; }
.fn-roll .fn-row { display: flex; justify-content: center; gap: 0.6em; flex-wrap: wrap; }
.fn-roll .fn-role { font: 600 0.62em var(--sans); letter-spacing: 0.22em; text-transform: uppercase; color: #c9a86a; align-self: center; }
.fn-roll .fn-gap { height: 1.4em; }
.fn-end { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); text-align: center; color: #f2e6c8;
  text-shadow: 0 2px 10px rgba(0,0,0,0.95); opacity: 0; transition: opacity 1.4s ease; pointer-events: none; width: min(640px, 92vw); }
.fn-end.fn-on { opacity: 1; pointer-events: auto; }
.fn-end .fn-time { font: 500 clamp(18px, 2.8vh, 24px) var(--serif); color: #e8dcbc; }
.fn-end .fn-best { font: 600 11px var(--sans); letter-spacing: 0.2em; text-transform: uppercase; color: #c9a86a; margin-top: 6px; min-height: 1em; }
.fn-end .fn-foot { font: 400 clamp(34px, 6vh, 54px)/1.1 var(--display); color: #f2d58e; margin: 18px 0 26px; letter-spacing: 0.03em; }
.fn-end .fn-again { font: 600 15px var(--sans); letter-spacing: 0.14em; text-transform: uppercase; padding: 12px 26px; border-radius: 4px; cursor: pointer;
  color: var(--parch); background: linear-gradient(180deg, var(--velvet-hi), var(--velvet)); border: 1px solid var(--brass); box-shadow: 0 6px 18px rgba(0,0,0,0.5); }
.fn-end .fn-again:hover { filter: brightness(1.15); }
.fn-skip { position: absolute; right: 18px; bottom: max(16px, env(safe-area-inset-bottom)); font: 600 12px var(--sans); letter-spacing: 0.14em; text-transform: uppercase;
  color: rgba(240,227,196,0.75); background: rgba(20,12,8,0.55); border: 1px solid rgba(201,162,74,0.5); border-radius: 4px; padding: 8px 14px; cursor: pointer; }
.fn-skip:hover { color: #fff; border-color: var(--brass); }
`;

let styled = false;
export function installStyles() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.dataset.room = 'finale';
  s.textContent = CSS;
  document.head.appendChild(s);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** *italic* → <i>, the rest escaped. */
const fmt = (s) => esc(s).replace(/\*([^*]+)\*/g, '<i>$1</i>');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A settle-once promise with an early-out. */
function gate() {
  let resolve; let done = false;
  const p = new Promise((r) => { resolve = r; });
  return { promise: p, open: (v) => { if (done) return; done = true; resolve(v); }, get done() { return done; } };
}

// =====================================================================================================================
// THE STAGE LINE: one line at a time, typed (wall clock) with the speaker's blips, held, then faded. Never blocks input.
// =====================================================================================================================
export class StageLine {
  constructor(ctx) {
    this.ctx = ctx;
    installStyles();
    this.el = document.createElement('div');
    this.el.className = 'fn-line';
    this.el.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.el);
    this._cur = null;
    this._raf = 0;
  }

  /**
   * Show a line. who: a speaker id for the blips (lavinia, pike, narrator), label: the caption over it (GRACE, EZRA,
   * MR PIKE; none for a direction), dir: a stage direction (italic, in brackets, silent), voice: blip overrides
   * (Ezra's lower register), hold: seconds on screen after typing (default by length; Infinity = until release() or
   * the next line: a live cue's trigger stays up until the GO). Resolves when it has gone (or at once when replaced).
   */
  say({ who = 'narrator', label = '', text = '', dir = false, voice = null, hold = null, cps = 30 } = {}) {
    this.cut();
    const ctx = this.ctx;
    const g = gate();
    const sp = ctx.dialogue?.speaker?.(who) || {};
    const blip = dir ? null : (sp.blip ? { ...sp.blip, ...(voice || {}) } : null);
    const chars = [...String(text)];
    const holdS = hold ?? Math.max(1.6, String(text).split(/\s+/).length * 0.3 + 0.9);
    this.el.className = `fn-line fn-on${who === 'pike' ? ' fn-pike' : ''}${dir ? ' fn-dir' : ''}`;
    this.el.innerHTML = `${label ? `<span class="fn-who">${esc(label)}</span>` : ''}<span class="fn-text"><span class="fn-shown"></span><span class="fn-rest"></span></span>`;
    const shown = this.el.querySelector('.fn-shown'), rest = this.el.querySelector('.fn-rest');
    rest.textContent = String(text).replace(/\*/g, '');
    const plain = chars.filter((c) => c !== '*');
    const cur = { g, n: 0, t0: performance.now(), plain, holdS, typedAt: 0, blip, who, blipAcc: 0, shown, rest, text, dir };
    this._cur = cur;
    this._talk(who, !dir);
    const step = () => {
      if (this._cur !== cur) return;
      const now = performance.now();
      if (cur.n < plain.length) {
        const due = Math.min(plain.length, 1 + Math.floor(((now - cur.t0) / 1000) * cps));
        if (due > cur.n) {
          if (blip) {
            for (let i = Math.max(cur.n, due - 3); i < due; i++) {
              if (/[\s.,!?…—-]/.test(plain[i])) continue;
              if (++cur.blipAcc % Math.max(1, blip.every || 2) === 0) {
                const jitter = 1 + (Math.random() - 0.5) * 0.12;
                ctx.audio?.blip?.(who, { ...blip, pitch: (blip.pitch ?? 1) * jitter, index: cur.blipAcc });
              }
            }
          }
          cur.n = due;
          shown.innerHTML = fmt(plain.slice(0, due).join('')).replace(/<i>([^<]*)$/, '<i>$1</i>');
          rest.textContent = plain.slice(due).join('');
          if (cur.n >= plain.length) { cur.typedAt = now; this._talk(who, false); shown.innerHTML = fmt(text); rest.textContent = ''; }
        }
      } else if (Number.isFinite(holdS) && now - cur.typedAt > holdS * 1000) {
        this._fade(cur);
        return;
      }
      this._raf = requestAnimationFrame(step);
    };
    // the game may be throttled (hidden tab): a timer backs the rAF so a line always ends
    if (Number.isFinite(holdS)) cur.safety = setTimeout(() => { if (this._cur === cur) this._fade(cur); }, (plain.length / cps + holdS + 2) * 1000);
    else cur.safety = setTimeout(() => { if (this._cur === cur && cur.n < plain.length) this.skip(); }, (plain.length / cps + 2) * 1000);
    this._raf = requestAnimationFrame(step);
    return g.promise;
  }

  /** A stage direction (italic, silent). */
  direction(text, hold = 1.4) { return this.say({ text, dir: true, hold }); }

  /** Finish typing now, or end the hold now. A held line (hold Infinity) only finishes typing: it stays up. */
  skip() {
    const cur = this._cur;
    if (!cur) return false;
    const held = !Number.isFinite(cur.holdS);
    if (cur.n < cur.plain.length) { cur.n = cur.plain.length; cur.shown.innerHTML = fmt(cur.text); cur.rest.textContent = ''; cur.typedAt = performance.now(); if (!held) cur.holdS = Math.min(cur.holdS, 0.7); this._talk(cur.who, false); return true; }
    if (held) return false;
    this._fade(cur);
    return true;
  }

  /** Fade the current line now (a held trigger, once its cue has gone). */
  release() { if (this._cur) this._fade(this._cur); }

  get busy() { return !!this._cur; }

  /** Take the line down at once. */
  cut() {
    const cur = this._cur;
    if (!cur) return;
    this._cur = null;
    cancelAnimationFrame(this._raf);
    clearTimeout(cur.safety);
    this._talk(cur.who, false);
    this.el.classList.remove('fn-on');
    cur.g.open();
  }

  _fade(cur) {
    if (this._cur !== cur) return;
    this._cur = null;
    cancelAnimationFrame(this._raf);
    clearTimeout(cur.safety);
    this._talk(cur.who, false);
    this.el.classList.remove('fn-on');
    setTimeout(() => cur.g.open(), 280);
  }

  _talk(who, on) { try { this.ctx.characters?.[who]?.talk?.(on); } catch (e) { console.error(e); } }

  dispose() { this.cut(); this.el.remove(); }
}

// =====================================================================================================================
// THE REVIEW: the certificate from your clipboard, opened at Remarks, three options; the pick writes itself in.
// =====================================================================================================================
/**
 * Show the certificate with the three options. Resolves { id, text } once the pick has written itself into the
 * Remarks box. The paper stays up (call .close() on the returned controller). options: [{ id, text }].
 */
export function reviewPaper(ctx, { def, options, written = null }) {
  installStyles();
  const back = document.createElement('div');
  back.className = 'fn-review-back';
  const body = String(def?.body || '').split('\n').filter((l) => !/^Remarks:/.test(l)).join('\n').trimEnd();
  back.innerHTML = `
    <div class="cn-paper cn-certificate">
      ${def?.kicker ? `<div class="cn-paper-kicker">${fmt(def.kicker)}</div>` : ''}
      <h2>${fmt(def?.title || 'Certificate of Vacancy')}</h2>
      <div class="cn-paper-body">${fmt(body)}\n\nRemarks:<span class="fn-remarks"><span class="fn-hand"></span></span></div>
      <div class="fn-opts"></div>
    </div>`;
  ctx.ui.appendChild(back);
  const hand = back.querySelector('.fn-hand');
  const opts = back.querySelector('.fn-opts');
  const g = gate();
  let picked = false;
  // the paper covers the canvas, so a line said over it ("You read it aloud.") advances on a click on the paper
  back.addEventListener('click', () => { if (picked && ctx.dialogue?.isOpen) ctx.dialogue.advance(); });
  const write = async (text) => {
    // one nib stroke every few letters, a letter every ~55 ms (Esc: all at once)
    const chars = [...text];
    for (let i = 0; i <= chars.length; i++) {
      if (ctrl.hurried) { hand.textContent = text; break; }
      hand.textContent = chars.slice(0, i).join('');
      if (i % 7 === 0 && i < chars.length) ctx.audio?.play('penScratch', { gain: 0.35 });
      await sleep(55);
    }
  };
  const ctrl = {
    promise: g.promise,
    hurried: false,
    skip() { ctrl.hurried = true; },
    close() {
      if (!back.isConnected) return;
      back.classList.add('fn-out');
      setTimeout(() => back.remove(), 520);
    },
  };
  if (written) {
    hand.textContent = written;
    opts.remove();
    g.open(null);
    return ctrl;
  }
  options.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cn-choice';
    b.textContent = o.text;
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (picked) return;
      picked = true;
      ctx.audio?.play('click');
      opts.classList.add('fn-gone');
      await write(o.text);
      g.open({ id: o.id, text: o.text });
    });
    opts.appendChild(b);
  });
  return ctrl;
}

// =====================================================================================================================
// THE CLIPBOARD SHOT: the certificate close-up, your review in Remarks, and under it, in her hand, "Not vacant."
// =====================================================================================================================
export function clipboardShot(ctx, { def, review, words, hold = 4.5 }) {
  installStyles();
  const el = document.createElement('div');
  el.className = 'fn-clip';
  const body = String(def?.body || '').split('\n').filter((l) => !/^Remarks:/.test(l)).join('\n').trimEnd();
  el.innerHTML = `
    <div class="cn-paper cn-certificate">
      ${def?.kicker ? `<div class="cn-paper-kicker">${fmt(def.kicker)}</div>` : ''}
      <h2>${fmt(def?.title || 'Certificate of Vacancy')}</h2>
      <div class="cn-paper-body">${fmt(body)}\n\nRemarks:<span class="fn-remarks"><span class="fn-hand">${esc(review || '')}</span></span><span class="fn-nv"></span></div>
    </div>`;
  document.body.appendChild(el);
  const nv = el.querySelector('.fn-nv');
  const g = gate();
  let hurry = false;
  el.addEventListener('click', () => { hurry = true; });
  (async () => {
    await sleep(1700);
    const chars = [...words];
    for (let i = 1; i <= chars.length; i++) {
      if (hurry) { nv.textContent = words; break; }
      nv.textContent = chars.slice(0, i).join('');
      if (i === 1 || i === 5) ctx.audio?.play('penScratch', { gain: 0.3, pitch: 1.15 });
      await sleep(170);
    }
    ctx.audio?.play('lilyShimmer', { gain: 0.35 });
    const t0 = performance.now();
    hurry = false;
    while (!hurry && performance.now() - t0 < hold * 1000) await sleep(80);
    g.open();
  })();
  return {
    promise: g.promise,
    skip() { hurry = true; },
    close() { el.classList.add('fn-out'); return sleep(820).then(() => el.remove()); },
  };
}

// =====================================================================================================================
// THE CREDITS: the Gazette front page slides up, then the roll over the empty stage, then the end card.
// =====================================================================================================================
/**
 * texts: { masthead, dateline, headline, standfirst, roll: string[], time, foot, best }. Roll lines: '# Heading',
 * '_ an italic line', 'ROLE | Name', '' (a gap), anything else plain. onAgain: the Play again button.
 * Returns { promise (resolves at the end card), skip() }.
 */
export function creditsRoll(ctx, texts, { onAgain, rollSeconds = 30 } = {}) {
  installStyles();
  const root = document.createElement('div');
  root.className = 'fn-credits';
  const rollHtml = (texts.roll || []).map((l) => {
    if (!l) return '<div class="fn-gap"></div>';
    if (l.startsWith('# ')) return `<div class="fn-h">${fmt(l.slice(2))}</div>`;
    if (l.startsWith('_ ')) return `<div class="fn-sub">${fmt(l.slice(2))}</div>`;
    if (l.includes(' | ')) { const [r, n] = l.split(' | '); return `<div class="fn-row"><span class="fn-role">${fmt(r)}</span><span>${fmt(n)}</span></div>`; }
    return `<div>${fmt(l)}</div>`;
  }).join('');
  const bars = Array.from({ length: 27 }, (_, i) => `<i style="width:${62 + ((i * 37) % 38)}%"></i>`).join('');
  root.innerHTML = `
    <div class="fn-gazette">
      <div class="fn-mast">${fmt(texts.masthead || '')}</div>
      <div class="fn-date"><span>${fmt(texts.dateline || '')}</span><span>One Penny</span></div>
      <div class="fn-head">${fmt(texts.headline || '')}</div>
      <div class="fn-stand">${fmt(texts.standfirst || '')}</div>
      <div class="fn-cols">${bars}</div>
    </div>
    <div class="fn-roll">${rollHtml}</div>
    <div class="fn-end">
      <div class="fn-time">${fmt(texts.time || '')}</div>
      <div class="fn-best">${fmt(texts.best || '')}</div>
      <div class="fn-foot">${fmt(texts.foot || '')}</div>
      <button type="button" class="fn-again">Play again</button>
    </div>
    <button type="button" class="fn-skip">Skip</button>`;
  document.body.appendChild(root);
  const gaz = root.querySelector('.fn-gazette'), roll = root.querySelector('.fn-roll'), end = root.querySelector('.fn-end');
  const skipBtn = root.querySelector('.fn-skip');
  const g = gate();
  let phase = 'gazette', skipReq = false, raf = 0;
  root.querySelector('.fn-again').addEventListener('click', (e) => { e.stopPropagation(); ctx.audio?.play('click'); onAgain?.(); });
  const showEnd = () => {
    if (phase === 'end') return;
    phase = 'end';
    cancelAnimationFrame(raf);
    gaz.classList.add('fn-away');
    roll.style.opacity = '0'; roll.style.transition = 'opacity 0.8s';
    skipBtn.remove();
    end.classList.add('fn-on');
    g.open();
  };
  const skip = () => { if (phase === 'gazette') skipReq = true; else showEnd(); };
  skipBtn.addEventListener('click', (e) => { e.stopPropagation(); showEnd(); });
  root.addEventListener('click', () => { if (phase === 'gazette') skipReq = true; });
  (async () => {
    roll.style.transform = `translateY(${window.innerHeight + 20}px)`;
    await sleep(60);
    gaz.classList.add('fn-up');
    ctx.audio?.play('page', { gain: 0.5 });
    const t0 = performance.now();
    while (!skipReq && phase === 'gazette' && performance.now() - t0 < 7500) await sleep(80);
    if (phase !== 'gazette') return;
    phase = 'roll';
    gaz.classList.add('fn-away');
    await sleep(700);
    if (phase !== 'roll') return;
    const H = window.innerHeight, h = roll.scrollHeight;
    const dist = H + h + 40;
    const r0 = performance.now();
    const tick = () => {
      if (phase !== 'roll') return;
      const k = (performance.now() - r0) / (rollSeconds * 1000);
      roll.style.transform = `translateY(${H + 20 - dist * Math.min(1, k)}px)`;
      if (k >= 1) { showEnd(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // a throttled tab still reaches the end card
    setTimeout(() => { if (phase === 'roll') showEnd(); }, rollSeconds * 1000 + 3000);
  })();
  return { promise: g.promise, skip, get phase() { return phase; }, el: root, dispose() { cancelAnimationFrame(raf); root.remove(); } };
}

export { fmtTime };

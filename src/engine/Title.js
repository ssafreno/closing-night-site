// Title screen overlay. The 3D background (a slowly panning room) is managed by Game.showTitle().
// Text comes from the script when present: `title.kicker`, `title.name` (HTML allowed: <em>), `title.sub`, `title.foot`.
import { SLOT, store } from './storage.js';
import { fmtTime } from './HUD.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class Title {
  constructor(ctx) {
    this.ctx = ctx;
    this.el = null;
  }

  _s(key, fallback) { const v = this.ctx.script?.[key]; return typeof v === 'string' ? v : fallback; }

  /** Show the overlay. Resolves with 'new' | 'continue'. */
  show({ canContinue = false } = {}) {
    const el = document.createElement('div');
    el.className = 'cn-title';
    const st = this.ctx.state;
    const progress = canContinue && st.elapsed > 0 ? `Your run · ${fmtTime(st.elapsed)} played · ` : '';
    // FIXED BY integration-qa: after Play again the title said only "Your run · 1:06:22 played", the same as a run half
    // done; a finished run now names its best time (the finale's store key, slot-namespaced like the save)
    const best = st.isSolved?.('cues') ? Number(store.get('closing-night.best')) || 0 : 0;
    const bestFoot = best ? `Curtain down · best ${fmtTime(best)} · ` : '';
    el.innerHTML = `
      <div class="cn-title-kicker">${esc(this._s('title.kicker', 'The Empress · Pelham Street'))}</div>
      <h1>${this._s('title.name', 'Closing <em>Night</em>')}</h1>
      <div class="cn-title-sub">${esc(this._s('title.sub', 'An escape room. Six rooms. One last performance.'))}</div>
      <div class="cn-title-buttons">
        <button class="cn-title-btn" data-act="${canContinue ? 'continue' : 'new'}" type="button">${canContinue ? 'Continue' : 'New Game'}</button>
        ${canContinue ? '<button class="cn-title-btn cn-secondary" data-act="new" type="button">New Game</button>' : ''}
      </div>
      <div class="cn-title-foot">${bestFoot || progress}${esc(this._s('title.foot', 'Drag to look · Click to interact'))}${SLOT ? ` · save slot ${esc(SLOT)}` : ''}</div>`;
    this.ctx.ui.appendChild(el);
    this.el = el;
    const resume = () => this.ctx.audio?.resume?.();
    el.addEventListener('pointerdown', resume, { once: true });
    return new Promise((resolve) => {
      // a press and release on a button is enough (pointerup or click, whichever comes first, once): a click made while
      // the title is still fading in, or one the browser turns into no click (the button moving under the cursor as it
      // rises), still starts the game
      let busy = false;
      let chosen = false;
      const choose = async (b) => {
        if (chosen) return;
        resume();
        const act = b.dataset.act;
        if (act === 'new' && canContinue) {
          const ok = await this.ctx.hud.confirm({ title: 'New game?', text: 'This will forget your current progress.', ok: 'Start fresh', cancel: 'Never mind' });
          if (!ok) return;
        }
        chosen = true;
        this.ctx.audio?.play('click');
        resolve(act);
      };
      const act = async (e) => {
        const b = e.target.closest?.('[data-act]');
        if (!b || busy || (e.type === 'pointerup' && e.button !== 0)) return;
        busy = true;
        try { await choose(b); } finally { busy = false; }
      };
      el.addEventListener('pointerup', act);
      el.addEventListener('click', act);
    });
  }

  hide() {
    const el = this.el;
    if (!el) return;
    el.classList.add('cn-hidden');
    setTimeout(() => el.remove(), 1000);
    this.el = null;
  }
}

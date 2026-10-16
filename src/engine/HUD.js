// HUD: top-right menu (mute / fullscreen / restart), the play timer (hidden with ?timer=0), Back button for focus views,
// toasts, dev fps. The journal button is Journal.js. Toggles body.cn-focus while a close-up is open (compact inventory).
import { store } from './storage.js';

const ICON = {
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" fill-opacity=".2"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" fill-opacity=".2"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  unfull: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
};

function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export class HUD {
  constructor(ctx) {
    this.ctx = ctx;
    const ui = ctx.ui;

    this.menu = document.createElement('div');
    this.menu.className = 'cn-menu';
    this.muteBtn = this._btn(ICON.sound, 'Mute', () => this.toggleMute());
    this.fullBtn = this._btn(ICON.full, 'Fullscreen', () => this.toggleFullscreen());
    this.restartBtn = this._btn(ICON.restart, 'Restart', () => this.confirmRestart());
    this.menu.append(this.muteBtn, this.fullBtn, this.restartBtn);
    ui.appendChild(this.menu);

    this.timer = document.createElement('div');
    this.timer.className = 'cn-timer';
    this.timer.textContent = '0:00';
    // ENGINE-FIX: DESIGN §10 puts a small elapsed timer in the HUD menu for everyone. It was dev/?timer only, so after a
    // non-dev Continue the clock seemed to vanish (qa-pit). `?timer=0` hides it (recording, screenshots).
    this.showTimer = new URLSearchParams(location.search).get('timer') !== '0';
    ui.appendChild(this.timer);

    this.back = document.createElement('button');
    this.back.className = 'cn-back cn-hidden';
    this.back.type = 'button';
    this.back.innerHTML = `${ICON.back}<span>Back</span><kbd>Esc</kbd>`;
    // a line that is up when Back is clicked (one that started under the pointer, below) closes with it, as Esc does
    this.back.addEventListener('click', () => {
      const d = this.ctx.dialogue;
      if (d?.choosing) return;
      if (!d?.isOpen) { this.ctx.game.back(); return; }
      d.dismiss();
      // the room's onBack waits for the line to finish settling (dialogue.busy); a further line in the queue keeps it
      setTimeout(() => { if (!d.isOpen) this.ctx.game.back(); }, 30);
    });
    ui.appendChild(this.back);

    this.toastEl = document.createElement('div');
    this.toastEl.className = 'cn-toast cn-hidden';
    ui.appendChild(this.toastEl);

    this.fpsEl = null;
    this._fps = { frames: 0, t: 0 };
    this._lastTimerText = '';

    document.addEventListener('fullscreenchange', () => {
      this.fullBtn.innerHTML = document.fullscreenElement ? ICON.unfull : ICON.full;
    });
    this.setVisible(false);
  }

  _btn(svg, title, fn) {
    const b = document.createElement('button');
    b.className = 'cn-iconbtn';
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = svg;
    b.addEventListener('click', (e) => { e.stopPropagation(); this.ctx.audio?.play('click', { gain: 0.5 }); fn(); });
    return b;
  }

  setVisible(b) {
    this.visible = b;
    this.menu.classList.toggle('cn-hud-hidden', !b);
    this.timer.classList.toggle('cn-hud-hidden', !b || !this.showTimer);
    if (!b) this.showBack(false);
  }

  /**
   * The Back button. `showBack(true)` (a close-up, or a room that wants it) shows "Back". With no close-up open, a room
   * that defines `backLabel` (a string, or a function returning one or null) and `onBack()` keeps it on screen with that
   * label, so a wing room always shows its way out ("The hall"). Re-checked every frame (`update`).
   */
  showBack(b) { this._backWanted = !!b; this._renderBack(); }
  _roomBackLabel() {
    const game = this.ctx.game, room = game?.currentRoom;
    if (!this.visible || !room || game._titleMode || game._transitioning || this.ctx.camera?.inFocus) return null;
    if (typeof room.onBack !== 'function' || room.backLabel == null) return null;
    const d = this.ctx.dialogue;
    if (d?.isOpen || this.ctx.papers?.isOpen) {
      // not while a line or choice is up. Except a line that starts while the pointer is already on the
      // button: hiding it then turns the player's click into "next line" (a late line once ate a Back);
      // the button stays for that line, and its click closes the line and goes back
      const hovered = this._backShown && this.back.matches(':hover');
      if (!d?.isOpen || d.choosing || this.ctx.papers?.isOpen || !(this._backHeld || hovered)) { this._backHeld = false; return null; }
      this._backHeld = true;
    } else this._backHeld = false;
    let label = room.backLabel;
    if (typeof label === 'function') { try { label = label.call(room); } catch (e) { console.error(e); label = null; } }
    return label ? String(label) : null;
  }
  _renderBack() {
    const roomLabel = this._backWanted ? null : this._roomBackLabel();
    const show = this._backWanted || !!roomLabel;
    const text = roomLabel || 'Back';
    if (show !== this._backShown) { this.back.classList.toggle('cn-hidden', !show); this._backShown = show; }
    if (text !== this._backText) { this.back.querySelector('span').textContent = text; this._backText = text; }
  }
  toggleMute() {
    const a = this.ctx.audio;
    a.setMuted(!a.muted);
    store.set('closing-night.muted', a.muted ? '1' : '0');
    this.syncMute();
  }
  syncMute() { this.muteBtn.innerHTML = this.ctx.audio?.muted ? ICON.muted : ICON.sound; }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => this.toast('Fullscreen unavailable'));
  }

  /** Parchment confirm dialog. Resolves true/false. */
  confirm({ title = 'Are you sure?', text = '', ok = 'Yes', cancel = 'Cancel' } = {}) {
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'cn-modal-backdrop';
      back.innerHTML = `<div class="cn-confirm"><h3></h3><p></p><div class="cn-row">
        <button class="cn-btn cn-ghost" data-v="0" type="button"></button><button class="cn-btn" data-v="1" type="button"></button></div></div>`;
      back.querySelector('h3').textContent = title;
      back.querySelector('p').textContent = text;
      back.querySelector('[data-v="0"]').textContent = cancel;
      back.querySelector('[data-v="1"]').textContent = ok;
      const done = (v) => { back.classList.add('cn-closing'); setTimeout(() => back.remove(), 200); this._confirmClose = null; resolve(v); };
      this._confirmClose = () => done(false);
      back.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (b) done(b.dataset.v === '1');
        else if (e.target === back) done(false);
      });
      this.ctx.ui.appendChild(back);
    });
  }

  async confirmRestart() {
    const ok = await this.confirm({ title: 'Start over?', text: 'Back to the stage door. Every room resets and the journal empties.', ok: 'Restart', cancel: 'Keep playing' });
    if (ok) this.ctx.game.restart();
  }

  /** @param {{ variant?: string }} [opts]  variant 'nudge' = quieter serif styling (onboarding hint) */
  toast(text, ms = 2200, { variant } = {}) {
    this.toastEl.textContent = text;
    this.toastEl.classList.toggle('cn-nudge', variant === 'nudge');
    this.toastEl.classList.remove('cn-hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.add('cn-hidden'), ms);
  }

  enableFps() {
    if (this.fpsEl) return;
    this.fpsEl = document.createElement('div');
    this.fpsEl.className = 'cn-fps';
    this.fpsEl.textContent = '-- fps';
    this.ctx.ui.appendChild(this.fpsEl);
  }

  update(dt) {
    this._renderBack();
    const focus = !!this.ctx.camera?.inFocus;
    if (focus !== this._focusClass) { document.body.classList.toggle('cn-focus', focus); this._focusClass = focus; }
    const txt = fmtTime(this.ctx.state.elapsed);
    if (txt !== this._lastTimerText) { this.timer.textContent = txt; this._lastTimerText = txt; }
    if (this.fpsEl) {
      const f = this._fps;
      f.frames++; f.t += dt;
      if (f.t >= 0.5) {
        const info = this.ctx.game.lastFrameInfo || { calls: 0, triangles: 0 };
        this.fpsEl.textContent = `${Math.round(f.frames / f.t)} fps · ${info.calls} calls · ${(info.triangles / 1000).toFixed(0)}k tris`;
        f.frames = 0; f.t = 0;
      }
    }
  }
}

export { fmtTime };

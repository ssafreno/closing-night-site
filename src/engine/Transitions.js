// Full-screen fade overlay helpers. All return Promises.
//   await transitions.fadeOut()          // to black (0.6 s)
//   await transitions.fadeIn()           // from whatever colour is showing
//   await transitions.whiteOut(1.2)      // to white (ending flash)
//   await transitions.flash('#bfe3ff', 0.35)  // quick flash in & out (zaps)
//   await transitions.curtainClose(1.1)   // the red velvet tabs sweep in from both sides (DESIGN §10: into the finale)
//   await transitions.curtainOpen(1.1)    // and part again. game.goToRoom(id, { transition: 'curtain' }) does both.

export class Transitions {
  constructor(ctx) {
    this.ctx = ctx;
    this.el = document.createElement('div');
    this.el.className = 'cn-fade';
    document.body.appendChild(this.el);
    this._anim = null;
    this.opacity = 0;
    this.curtain = 0; // 1 while the tabs are closed
    this.curtainEl = document.createElement('div');
    this.curtainEl.className = 'cn-curtain';
    this.curtainEl.innerHTML = '<div class="cn-curtain-l"></div><div class="cn-curtain-r"></div>';
    document.body.appendChild(this.curtainEl);
  }

  _sweep(closed, duration) {
    const [l, r] = this.curtainEl.children;
    const from = this.curtain ? 0 : 101, to = closed ? 0 : 101;
    this.curtain = closed ? 1 : 0;
    this.curtainEl.classList.add('cn-on');
    const opts = { duration: duration * 1000, easing: closed ? 'cubic-bezier(.5,0,.3,1)' : 'cubic-bezier(.6,0,.4,1)', fill: 'forwards' };
    const a = l.animate([{ transform: `translateX(-${from}%)` }, { transform: `translateX(-${to}%)` }], opts);
    r.animate([{ transform: `translateX(${from}%)` }, { transform: `translateX(${to}%)` }], opts);
    return new Promise((res) => {
      let done = false;
      const settle = () => { if (done) return; done = true; clearTimeout(timer); if (!closed) this.curtainEl.classList.remove('cn-on'); res(); };
      a.onfinish = settle; a.oncancel = settle;
      const timer = setTimeout(settle, duration * 1000 + 500);
    });
  }

  curtainClose(duration = 1.1) { this.ctx.audio?.play('curtainSwish', { gain: 0.7 }); return this._sweep(true, duration); }
  curtainOpen(duration = 1.1) { this.ctx.audio?.play('curtainSwish', { gain: 0.5, pitch: 0.9 }); return this._sweep(false, duration); }

  _to(opacity, duration, color) {
    if (color) this.el.style.background = color;
    const from = parseFloat(getComputedStyle(this.el).opacity) || 0;
    this._anim?.cancel();
    this.el.style.opacity = String(from);
    const a = this.el.animate([{ opacity: from }, { opacity }], { duration: duration * 1000, easing: 'ease-in-out', fill: 'forwards' });
    this._anim = a;
    this.opacity = opacity;
    return new Promise((res) => {
      // a hidden tab may never deliver `finish`; the timer settles the fade so room transitions cannot hang on it
      let done = false;
      const settle = (finished) => {
        if (done) return;
        done = true; clearTimeout(timer);
        if (finished) this.el.style.opacity = String(opacity);
        res();
      };
      a.onfinish = () => settle(true);
      a.oncancel = () => settle(false);
      const timer = setTimeout(() => { if (done) return; try { a.finish(); } catch (e) { /* ignore */ } settle(true); }, duration * 1000 + 500);
    });
  }

  fadeOut(duration = 0.6, color = '#000') { return this._to(1, duration, color); }
  fadeIn(duration = 0.6) { return this._to(0, duration); }
  whiteOut(duration = 1.2) { return this._to(1, duration, '#fffaf0'); }
  /** Cover instantly with `color`, then fade it away (e.g. the ending fades in from the ritual's white). ADDED BY ending agent. */
  fadeFrom(color = '#fffaf0', duration = 1.2) { this.cover(color); return this._to(0, duration); }

  /** Set fully covered instantly (e.g. before first room loads). */
  cover(color = '#000') { this._anim?.cancel(); this.el.style.background = color; this.el.style.opacity = '1'; this.opacity = 1; }

  async flash(color = '#ffffff', duration = 0.35, peak = 0.85) {
    await this._to(peak, duration * 0.3, color);
    await this._to(0, duration * 0.7);
  }
}

// The journal (ctx.journal), per docs/DESIGN.md §8: every paper the player has read, reopenable, in tabs:
//   Running Order (once the `runningorder` paper is in the journal) · Papers (grouped by room, in order of reading) ·
//   one tab per paper whose def has `journalTab` (the Prompt Book: its pages, each opening full size).
// Plus the Running Order card pinned small beside the HUD journal button (click it to collapse / expand), hidden in
// close-ups and on the title.
//
//   journal.collect(id)        add a paper id (Papers.show does this for you). Saved in state.journal.
//   journal.pin(id)            add without reading (the game hands the player the Running Order). Saved in state.pinned.
//   journal.deliver(id)        tick a Running Order line: state 'deliverable.<id>' = true, journalTick, toast, pulse.
//   journal.delivered(id)      true once ticked.
//   journal.open({ tab }) / close() / toggle(), journal.isOpen      (J opens it; Esc / Back / the ✕ close it)
//
// The Running Order's lines come from src/content/manifest.js `runningOrder`: [{ id, text, needs?: [deliverable ids],
// note? }]. A line is ticked when every id in `needs` (default [id]) has `deliverable.<id>` set; with some but not all
// it shows how many. The first unticked line is the current one (underlined). The paper id 'runningorder' is
// generated here (Papers.def('runningorder')).
import { RUNNING_ORDER_ID } from './Papers.js';

const BOOK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5C5.5 4 8.5 4 12 6c3.5-2 6.5-2 9-.5v13c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5z" fill="currentColor" fill-opacity=".15"/><path d="M12 6v13.5"/></svg>';
const STYLE_MARK = {
  playbill: '❧', ledger: '▤', typed: '¶', telegram: '✦', notepaper: '✉', card: '◆', legal: '§', ticket: '◈', certificate: '✠',
  letter: '✉', diary: '✎', page: '❦', chalk: '▭', programme: '❧', clipping: '✂', running: '✓',
};

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
function fmt(s) { return esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>'); }

export class Journal {
  constructor(ctx) {
    this.ctx = ctx;
    this.isOpen = false;
    this._el = null;
    this.visible = false;
    this.tab = null;

    this.button = document.createElement('button');
    this.button.className = 'cn-journal-btn cn-hud-hidden';
    this.button.type = 'button';
    this.button.title = 'Journal (J)';
    this.button.setAttribute('aria-label', 'Journal');
    this.button.innerHTML = `${BOOK_SVG}<span class="cn-journal-label">Journal</span><span class="cn-journal-count"></span>`;
    this.button.addEventListener('click', (e) => { e.stopPropagation(); this.ctx.audio?.play('click', { gain: 0.5 }); this.toggle(); });
    ctx.ui.appendChild(this.button);

    // the Running Order card pinned beside the button
    this.mini = document.createElement('button');
    this.mini.type = 'button';
    this.mini.className = 'cn-ro-mini cn-hud-hidden';
    this.mini.setAttribute('aria-label', 'Running Order (click to collapse)');
    this.mini.addEventListener('click', (e) => {
      e.stopPropagation();
      ctx.audio?.play('click', { gain: 0.4 });
      this._setCollapsed(!this._collapsed());
    });
    ctx.ui.appendChild(this.mini);

    ctx.state.on('journal', () => { this._renderButton(); if (this.isOpen) this._render(); });
    ctx.state.on('change', (k) => {
      if (typeof k === 'string' && k.startsWith('deliverable.')) {
        ctx.papers?.refresh?.();
        this._renderMini();
        if (this.isOpen) this._render();
      }
    });
    ctx.state.on('reset', () => { this.close(); this._renderButton(); });
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'j' && e.key !== 'J') return;
      if (e.metaKey || e.ctrlKey || e.altKey || !this.visible) return;
      if (ctx.dialogue?.isOpen || ctx.papers?.isOpen || ctx.game?._titleMode) return;
      this.toggle();
    });
  }

  // ---- data ----------------------------------------------------------------------------------------------
  get ids() { return this.ctx.state.journal; }
  get pinnedIds() { return this.ctx.state.pinned; }
  /** Every id in the journal, pinned first, then in the order read. */
  get entries() { return [...new Set([...this.pinnedIds, ...this.ids])]; }
  has(id) { return this.ids.includes(id) || this.pinnedIds.includes(id); }

  /** Add a read paper. Returns true if it was new. `quiet`: no toast (Papers.show passes it: the paper is on screen). */
  collect(id, { quiet = false } = {}) {
    if (!id || this.ids.includes(id)) return false;
    if (id !== RUNNING_ORDER_ID && !this.ctx.papers?.has(id)) { console.warn(`[journal] no paper "${id}"`); return false; }
    this.ctx.state.journal = [...this.ids, id];
    this.ctx.state.set(`read.${id}`, true);
    this._pulse();
    if (!quiet) this.ctx.hud?.toast(this._text('toast.journal.added', 'Added to your journal'), 2200);
    return true;
  }

  /** Put a paper in the journal without reading it (the Running Order). Returns true if it was new. */
  pin(id, { quiet = false } = {}) {
    if (!id || this.pinnedIds.includes(id)) return false;
    this.ctx.state.pinned = [...this.pinnedIds, id];
    this._pulse();
    if (!quiet) this.ctx.hud?.toast(this._text('toast.journal.pinned', 'Added to your journal'), 2200);
    return true;
  }

  unpin(id) { this.ctx.state.pinned = this.pinnedIds.filter((x) => x !== id); }

  /** Remove a paper from the journal (rare: a page that is handed over for good). */
  forget(id) { this.ctx.state.journal = this.ids.filter((x) => x !== id); this.unpin(id); }

  // ---- deliverables / running order --------------------------------------------------------------------
  delivered(id) { return !!this.ctx.state.get(`deliverable.${id}`); }

  /**
   * Tick a deliverable. Plays journalTick, pulses the journal button and the pinned card, and toasts the line it
   * completes. Returns false if it was already ticked. `quiet`: just the state (restores, pre-ticked lines).
   */
  deliver(id, { quiet = false } = {}) {
    if (this.delivered(id)) return false;
    this.ctx.state.set(`deliverable.${id}`, true);
    this.ctx.state.save();
    if (quiet) return true;
    this.ctx.audio?.play('journalTick', { gain: 0.7 });
    this._pulse(true);
    this.mini.classList.remove('cn-pulse-big'); void this.mini.offsetWidth; this.mini.classList.add('cn-pulse-big');
    const line = this.runningOrder().find((l) => l.needs.includes(id));
    if (line) {
      const tpl = this.ctx.script?.['toast.running.tick'];
      const text = typeof tpl === 'string' ? tpl.replace('{line}', line.text) : `Running Order: ${line.text}${line.done ? ' ✓' : ''}`;
      this.ctx.hud?.toast(text, 3200, { variant: 'nudge' });
    }
    return true;
  }

  /** The running order with progress: [{ id, text, note, needs, have, done, current }] */
  runningOrder() {
    const lines = this.ctx.manifest?.runningOrder || [];
    let cur = false;
    return lines.map((l) => {
      const needs = l.needs?.length ? l.needs : [l.id];
      const have = needs.filter((d) => this.delivered(d)).length;
      const done = have === needs.length;
      const current = !done && !cur;
      if (current) cur = true;
      return { id: l.id, text: l.text, note: l.note || '', needs, have, done, current };
    });
  }

  _roRows(lines) {
    return lines.map((l, i) => `
      <li class="cn-ro-line${l.done ? ' cn-ro-done' : ''}${l.current ? ' cn-ro-current' : ''}">
        <span class="cn-ro-n">${l.n ?? i}.</span>
        <span class="cn-ro-text">${fmt(l.text)}${l.note ? `<span class="cn-ro-note">${fmt(l.note)}</span>` : ''}</span>
        <span class="cn-ro-mark">${l.done ? '✓' : l.have ? `${l.have}/${l.needs.length}` : ''}</span>
      </li>`).join('');
  }

  /** The 'runningorder' paper def, generated from current state. Lines are numbered from `paper.running.start` (0). */
  runningPaper() {
    const s = this.ctx.script || {};
    const str = (k, d) => (typeof s[k] === 'string' ? s[k] : d);
    const title = str('paper.running.title', 'The Running Order');
    const kicker = str('paper.running.kicker', '');
    const foot = str('paper.running.foot', '');
    const start = typeof s['paper.running.start'] === 'number' ? s['paper.running.start'] : 0;
    const lines = this.runningOrder().map((l, i) => ({ ...l, n: i + start }));
    return {
      title, kicker, style: 'running', journalTitle: title,
      html: `<ol class="cn-ro">${this._roRows(lines) || '<li class="cn-ro-line"><span class="cn-ro-text">(nothing yet)</span></li>'}</ol>${foot ? `<div class="cn-ro-foot">${fmt(foot)}</div>` : ''}`,
    };
  }

  // ---- UI -------------------------------------------------------------------------------------------------
  /** HUD visibility (Game hides it on the title). */
  setVisible(b) { this.visible = b; this._renderButton(); }

  _renderButton() {
    const n = this.entries.length;
    // ENGINE-FIX: the button shows with the HUD (DESIGN §10: journal icon top-left), even while the journal is empty.
    // It used to wait for a first paper (dev showed it always), so a save without papers lost it after Continue.
    const show = this.visible;
    this.button.classList.toggle('cn-hud-hidden', !show);
    this.button.querySelector('.cn-journal-count').textContent = n ? String(n) : '';
    this._renderMini();
  }

  _collapsed() { return !!this.ctx.state.get('ui.ro.collapsed'); }
  _setCollapsed(b) { this.ctx.state.set('ui.ro.collapsed', b); this._renderMini(); }

  /** The pinned card: shown with the HUD once the Running Order is in the journal. */
  _renderMini() {
    const show = this.visible && this.has(RUNNING_ORDER_ID);
    this.mini.classList.toggle('cn-hud-hidden', !show);
    if (!show) return;
    const lines = this.runningOrder();
    const collapsed = this._collapsed();
    this.mini.classList.toggle('cn-ro-collapsed', collapsed);
    const done = lines.filter((l) => l.done).length;
    const cur = lines.find((l) => l.current);
    const title = typeof this.ctx.script?.['paper.running.mini'] === 'string' ? this.ctx.script['paper.running.mini'] : 'Running Order';
    this.mini.innerHTML = collapsed
      ? `<span class="cn-ro-mini-head">${esc(title)}</span><span class="cn-ro-mini-count">${done}/${lines.length}</span>${cur ? `<span class="cn-ro-mini-cur">${fmt(cur.text)}</span>` : ''}`
      : `<span class="cn-ro-mini-head">${esc(title)}<span class="cn-ro-mini-count">${done}/${lines.length}</span></span><ol>${lines.map((l) => `<li class="${l.done ? 'cn-ro-done' : ''}${l.current ? ' cn-ro-current' : ''}"><span>${fmt(l.text)}</span><b>${l.done ? '✓' : l.have ? `${l.have}/${l.needs.length}` : ''}</b></li>`).join('')}</ol>`;
  }

  _pulse(big = false) {
    this._renderButton();
    this.button.classList.remove('cn-pulse', 'cn-pulse-big');
    void this.button.offsetWidth;
    this.button.classList.add(big ? 'cn-pulse-big' : 'cn-pulse');
  }

  _text(key, fallback) { const v = this.ctx.script?.[key]; return typeof v === 'string' ? v : fallback; }

  toggle() { if (this.isOpen) this.close(); else this.open(); }

  /** The tabs on offer now: [{ id, label }]. 'running' (if pinned/read), 'papers', then one per journalTab paper. */
  tabs() {
    const out = [];
    const entries = this.entries;
    if (entries.includes(RUNNING_ORDER_ID)) out.push({ id: 'running', label: this._text('journal.tab.running', 'Running Order') });
    out.push({ id: 'papers', label: this._text('journal.tab.papers', 'Papers') });
    for (const id of entries) {
      const def = this.ctx.papers?.def(id);
      if (def?.journalTab) out.push({ id: `paper:${id}`, label: def.journalTab, paper: id });
    }
    return out;
  }

  /** Open the journal, optionally on a tab: 'running' | 'papers' | 'paper:<id>'. */
  open({ tab } = {}) {
    if (this.isOpen) { if (tab) { this.tab = tab; this._render(); } return; }
    const ctx = this.ctx;
    ctx.dialogue?.hideCaption?.();
    ctx.audio?.play('page', { gain: 0.6 });
    this.isOpen = true;
    if (tab) this.tab = tab;
    const back = document.createElement('div');
    back.className = 'cn-modal-backdrop cn-journal-backdrop';
    back.innerHTML = `
      <div class="cn-journal">
        <button class="cn-close" type="button" aria-label="Close">✕</button>
        <h2>${esc(this._text('journal.title', 'Journal'))}</h2>
        <div class="cn-journal-tabs" role="tablist"></div>
        <div class="cn-journal-body"></div>
      </div>`;
    this._el = back;
    this._render();
    back.querySelector('.cn-close').addEventListener('click', () => this.close());
    back.addEventListener('click', (e) => { if (e.target === back) this.close(); });
    ctx.ui.appendChild(back);
  }

  close() {
    if (!this.isOpen) return;
    const el = this._el;
    this.isOpen = false;
    this._el = null;
    if (el) { el.classList.add('cn-closing'); setTimeout(() => el.remove(), 200); }
  }

  _render() {
    const root = this._el;
    if (!root) return;
    const tabs = this.tabs();
    if (!tabs.some((t) => t.id === this.tab)) this.tab = tabs[0].id;
    const tabsEl = root.querySelector('.cn-journal-tabs');
    tabsEl.innerHTML = tabs.map((t) => `<button type="button" role="tab" class="cn-journal-tab${t.id === this.tab ? ' cn-on' : ''}" aria-selected="${t.id === this.tab}" data-tab="${esc(t.id)}">${esc(t.label)}</button>`).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.tab === b.dataset.tab) return;
      this.ctx.audio?.play('page', { gain: 0.4, pitch: 1.15 });
      this.tab = b.dataset.tab;
      this._render();
    }));
    const body = root.querySelector('.cn-journal-body');
    const t = tabs.find((x) => x.id === this.tab);
    if (t.id === 'running') body.innerHTML = this._renderRunning();
    else if (t.paper) body.innerHTML = this._renderPages(t.paper);
    else body.innerHTML = this._renderPapers();
    body.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      this.ctx.papers.show(b.dataset.id, { collect: false, page: +(b.dataset.page || 0) });
    }));
  }

  _renderRunning() {
    const def = this.runningPaper();
    return `<button class="cn-journal-running" type="button" data-id="${RUNNING_ORDER_ID}">${def.kicker ? `<div class="cn-paper-kicker">${fmt(def.kicker)}</div>` : ''}<h3>${fmt(def.title)}</h3>${def.html}</button>`;
  }

  _renderPapers() {
    const ctx = this.ctx;
    const roomOrder = (ctx.manifest?.rooms || []).map((r) => r.id);
    const titles = Object.fromEntries((ctx.manifest?.rooms || []).map((r) => [r.id, r.title]));
    const groups = new Map();
    for (const id of this.entries) {
      if (id === RUNNING_ORDER_ID) continue;
      const def = ctx.papers.def(id);
      if (!def || def.journalTab) continue;
      const room = def.room || '';
      if (!groups.has(room)) groups.set(room, []);
      groups.get(room).push({ id, def });
    }
    const keys = [...groups.keys()].sort((a, b) => (roomOrder.indexOf(a) + 1 || 999) - (roomOrder.indexOf(b) + 1 || 999));
    const parts = keys.map((room) => {
      const list = groups.get(room).map(({ id, def }) => `
        <li><button type="button" class="cn-journal-entry" data-id="${esc(id)}">
          <span class="cn-journal-mark">${STYLE_MARK[def.style] || '✉'}</span>
          <span class="cn-journal-title">${fmt(def.journalTitle || def.title || id)}</span>
        </button></li>`).join('');
      return `<section class="cn-journal-group">${room ? `<h4>${esc(titles[room] || room)}</h4>` : ''}<ul>${list}</ul></section>`;
    });
    return parts.length ? parts.join('') : `<div class="cn-journal-empty">${esc(this._text('journal.empty', 'Nothing yet. Read something.'))}</div>`;
  }

  /** A journalTab paper (the Prompt Book): one row per page, each opening the paper at that page. */
  _renderPages(id) {
    const def = this.ctx.papers.def(id);
    const pages = this.ctx.papers.pagesOf(def);
    const rows = pages.map((pg, i) => {
      const first = String(pg.title || (pg.body || '').split('\n').find((x) => x.trim()) || (pg.html ? '' : '')).slice(0, 80);
      return `<li><button type="button" class="cn-journal-entry${pg._missing ? ' cn-journal-missing' : ''}" data-id="${esc(id)}" data-page="${i}">
        <span class="cn-journal-mark">${i + 1}</span><span class="cn-journal-title">${fmt(first || `Page ${i + 1}`)}</span></button></li>`;
    }).join('');
    return `<section class="cn-journal-group"><h4>${fmt(def.journalTitle || def.title || id)}</h4><ul>${rows}</ul></section>`;
  }
}

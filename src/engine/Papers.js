// Full-screen readable documents (ctx.papers). Content from src/content/papers.js (ctx.paperDefs):
//   papers[id] = { title, body: 'text with \n and *emphasis*' | html, style, kicker?, signature?, room?,
//                  journal?: false, journalTitle?, journalTab?: 'Prompt Book', pages?: [page, ...] }
//   page       = { title?, body | html, signature?, requires?, missing?: { title?, body | html } }
//                a page whose `requires` is not met shows `missing` instead (the prompt book's torn page 8 until
//                `lastpage` is placed). requires: 'solved:<puzzle>' | 'item:<id>' | 'deliverable:<id>' | a state key. A paper with pages shows one at a time with ‹ › (and the arrow keys).
// Every paper shown is collected into the journal (ctx.journal) unless the def says `journal: false` or show() is
// called with { collect: false }. One id is generated at runtime: 'runningorder' (Journal.runningPaper()).
// In `html`, class="cn-hand" is handwriting and class="cn-pencil" a pencil annotation (DESIGN §10 fonts).

export const PAPER_STYLES = [
  // DESIGN §10 kinds
  'playbill', 'ledger', 'typed', 'telegram', 'notepaper', 'card', 'legal', 'ticket', 'certificate',
  // engine extras
  'letter', 'diary', 'page', 'chalk', 'programme', 'clipping', 'running',
];
export const RUNNING_ORDER_ID = 'runningorder';

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
function fmt(s) {
  // POLISH: curly double quotes (see Dialogue.smartQuotes); applied before escaping so no &quot; is left to curl
  s = String(s).replace(/(^|[\s(\[—–*])"/g, '$1\u201C').replace(/"/g, '\u201D');
  return esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

export class Papers {
  constructor(ctx) {
    this.ctx = ctx;
    this.isOpen = false;
    this._close = null;
    this.currentId = null;
  }

  /** Add/override paper definitions at runtime (rooms/test content). Existing keys are kept unless overwrite. */
  add(entries, { overwrite = false } = {}) {
    const p = this.ctx.paperDefs;
    for (const [k, v] of Object.entries(entries)) if (overwrite || !(k in p)) p[k] = v;
  }

  /** The definition for an id (generated ones included), or null. */
  def(id) {
    if (id === RUNNING_ORDER_ID) return this.ctx.journal?.runningPaper() || null;
    return this.ctx.paperDefs?.[id] || null;
  }
  has(id) { return !!this.def(id); }

  /** Is a page's `requires` met? 'solved:<puzzle>' | 'item:<id>' | 'deliverable:<id>' | any state key (truthy). */
  met(req) {
    const { state, inventory, journal } = this.ctx;
    const [kind, id] = String(req).split(/:(.*)/s);
    if (id !== undefined) {
      if (kind === 'solved') return state.isSolved(id);
      if (kind === 'item') return !!inventory?.has(id);
      if (kind === 'deliverable') return !!journal?.delivered(id);
    }
    return !!state.get(req);
  }

  /** The pages of a def as shown now (requires/missing applied); a def without pages is one page. */
  pagesOf(def) {
    if (!def) return [];
    const list = Array.isArray(def.pages) && def.pages.length ? def.pages : [def];
    return list.map((pg) => {
      // ENGINE-FIX: the missing text replaces the page's text whichever form either is in (a `missing.body` used to
      // lose to the page's own `html`)
      if (pg.requires && !this.met(pg.requires)) return { ...pg, body: '', html: '', ...(pg.missing || {}), _missing: true };
      return pg;
    });
  }

  /**
   * Show a paper by id (or a { title, body|html, style } object). Resolves when closed.
   * @param {string|object} idOrDef
   * @param {{ collect?: boolean, page?: number }} [opts]  collect (default true): add the id to the journal;
   *   page: which page to open at (papers with pages)
   */
  show(idOrDef, { collect = true, page = 0 } = {}) {
    const id = typeof idOrDef === 'string' ? idOrDef : null;
    const def = id ? this.def(id) : idOrDef;
    if (!def) { console.warn(`[papers] missing paper "${idOrDef}"`); return Promise.resolve(); }
    if (this.isOpen) this.hide();
    if (id && collect && def.journal !== false) this.ctx.journal?.collect(id, { quiet: true });
    this.currentId = id;
    this.ctx.audio?.play('page');
    this.ctx.dialogue?.hideCaption?.(); // a lingering caption drew over the bottom of the paper
    this.isOpen = true;
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'cn-modal-backdrop cn-paper-backdrop';
      const style = PAPER_STYLES.includes(def.style) ? def.style : 'notepaper';
      const paper = document.createElement('div');
      paper.className = `cn-paper cn-${style}`;
      back.appendChild(paper);
      const pages = this.pagesOf(def);
      let at = Math.max(0, Math.min(pages.length - 1, page | 0));
      const render = () => {
        const pg = pages[at];
        const title = pg.title ?? (at === 0 || !Array.isArray(def.pages) ? def.title : '');
        const multi = pages.length > 1;
        paper.classList.toggle('cn-paper-missing', !!pg._missing);
        paper.innerHTML = `
          <button class="cn-close" type="button" aria-label="Close">✕</button>
          ${def.kicker && at === 0 ? `<div class="cn-paper-kicker">${fmt(def.kicker)}</div>` : ''}
          ${title ? `<h2>${fmt(title)}</h2>` : ''}
          <div class="cn-paper-body">${pg.html ? pg.html : fmt(pg.body || '')}</div>
          ${(pg.signature ?? (multi ? '' : def.signature)) ? `<div class="cn-paper-sig">${fmt(pg.signature ?? def.signature)}</div>` : ''}
          ${multi ? `<div class="cn-paper-nav"><button type="button" class="cn-pg-prev" aria-label="Previous page"${at === 0 ? ' disabled' : ''}>‹</button><span class="cn-pg-n">${at + 1} / ${pages.length}</span><button type="button" class="cn-pg-next" aria-label="Next page"${at === pages.length - 1 ? ' disabled' : ''}>›</button></div>` : ''}`;
        this._body = paper.querySelector('.cn-paper-body');
        paper.querySelector('.cn-close').addEventListener('click', close);
        paper.querySelector('.cn-pg-prev')?.addEventListener('click', (e) => { e.stopPropagation(); turn(-1); });
        paper.querySelector('.cn-pg-next')?.addEventListener('click', (e) => { e.stopPropagation(); turn(1); });
      };
      const turn = (d) => {
        const n = at + d;
        if (n < 0 || n >= pages.length) return false;
        at = n;
        this.page = at;
        this.ctx.audio?.play('page', { gain: 0.45, pitch: 1.1 });
        render();
        return true;
      };
      this._turn = turn;
      this.page = at;
      const close = () => {
        if (!back.isConnected || back.classList.contains('cn-closing')) return;
        back.classList.add('cn-closing');
        setTimeout(() => back.remove(), 200);
        this.isOpen = false;
        this._close = null;
        this._turn = null;
        this._body = null;
        this.currentId = null;
        this.ctx.audio?.play('page', { gain: 0.5, pitch: 0.85 });
        resolve();
      };
      this._close = close;
      render();
      this.ctx.ui.appendChild(back);
      back.addEventListener('click', (e) => { if (e.target === back) close(); });
    });
  }

  /** Turn the open paper's page by d (±1). Game binds the arrow keys to it. Returns true if the page changed. */
  turnPage(d) { return this._turn ? this._turn(d) : false; }

  hide() { this._close?.(); }

  /** Journal calls this when a deliverable changes: an open Running Order redraws in place. */
  refresh() {
    if (!this.isOpen || this.currentId !== RUNNING_ORDER_ID || !this._body) return;
    const def = this.def(RUNNING_ORDER_ID);
    if (def?.html) this._body.innerHTML = def.html;
  }
}

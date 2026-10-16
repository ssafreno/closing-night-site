// Director's notes: the hint logic (ctx.hints), per docs/DESIGN.md §7. Lavinia's hotspot calls hints.ask(); a room
// with another hint-giver (the door's `lavinia_off` glow, Pike in the finale) calls ctx.hints.ask() from its own hotspot.
// The lines carry their own `who`, so whoever the writer gave the key to speaks it.
//
// hints.ask():
//  1. Early in a visit (< earlySeconds in the room AND fewer than two other hotspot clicks) and `<room>.enter.note`
//     exists → say it (the room-intro note that names the deliverable).
//  2. Current puzzle (see currentPuzzle) → `hint.<id>.<n>`, n = 1, 2, 3 by state `hint.<id>.level`; after level 3 it
//     alternates the idle chatter (`<room>.idle.*`) and level 3. room.hintVariant(id) may return a suffix:
//     `hint.<id>.<suffix>.<n>` is used when that key exists.
//  3. No current puzzle: room.looseEnd() → a script key (something left behind) → say it.
//  4. Else the frontier: the first room in manifest order (not this one) with an unsolved puzzle → `hint.goto.<room>`.
//  5. Else idle chatter: dialogue.cycle(`<room>.idle`) (keys `<room>.idle.1..n`, in turn) → `idle` → a caption.
// Hint lines (`<room>.enter.note`, `hint.*`, loose ends, `hint.goto.*`) are shown with the small italic tag "Note:".
//
// Idle (never while dialogue, a paper, the journal or a camera tween is up; only with a current puzzle left):
//  - after room.constructor.nudgeSeconds (default 90) with no progress (a solve, an item, a deliverable or a hint
//    asked): ONCE per room per save, room.onNudge() if it returns true; else, when the companion is standing in this
//    room, she drifts (react('drift')) and says `<room>.nudge` or the next `<room>.idle.*` line; else a toast
//    (`toast.nudge.<room>` → `toast.nudge`).
//  - after room.constructor.glintSeconds (default 180) with no progress: room.glint(puzzleId) every 10 s until
//    progress (rooms pulse the current puzzle's object; no-op if the room has no glint()).

const NOTE_TAG = 'Note:';

export class Hints {
  constructor(ctx) {
    this.ctx = ctx;
    this.roomTime = 0;
    this.earlySeconds = 20;
    this.idleTime = 0;          // seconds in this room since the last progress
    this._glintAt = 0;
    this._asking = false;
    const progress = () => { this.idleTime = 0; this._glintAt = 0; };
    this.progress = progress;
    ctx.state.on('solve', progress);
    ctx.state.on('inventory', progress);
    ctx.state.on('change', (k) => { if (typeof k === 'string' && k.startsWith('deliverable.')) progress(); });
  }

  /** Game calls on room enter. */
  resetForRoom() { this.roomTime = 0; this.idleTime = 0; this._glintAt = 0; }

  update(dt) {
    this.roomTime += dt;
    this._updateIdle(dt);
  }

  _updateIdle(dt) {
    const { game, state, dialogue, papers, journal, camera } = this.ctx;
    const room = game.currentRoom;
    if (!room || game._titleMode || game._transitioning || document.hidden) return;
    if (dialogue.isOpen || dialogue.busy || papers?.isOpen || journal?.isOpen || camera.mode === 'tween') return;
    this.idleTime += dt;
    const C = room.constructor;
    const nudgeAt = C.nudgeSeconds ?? 90;
    const glintAt = C.glintSeconds ?? 180;
    if (nudgeAt && this.idleTime >= nudgeAt && !state.get(`nudge.${room.id}.shown`) && this.currentPuzzle(room)) {
      this.nudge();
      return;
    }
    if (glintAt && this.idleTime >= glintAt && typeof room.glint === 'function' && this.idleTime >= this._glintAt) {
      this._glintAt = this.idleTime + 10;
      const pid = this.currentPuzzle(room);
      if (pid) { try { room.glint(pid); } catch (e) { console.error(e); } }
    }
  }

  /** Fire the room's idle nudge now (marks it shown). Exposed for testing: closingNight.ctx.hints.nudge(). */
  nudge() {
    const { game, state, dialogue, hud } = this.ctx;
    const room = game.currentRoom;
    if (!room) return;
    state.set(`nudge.${room.id}.shown`, true);
    try { if (room.onNudge?.() === true) return; } catch (e) { console.error(e); }
    const comp = this.ctx.companion;
    const line = this._has(`${room.id}.nudge`) ? `${room.id}.nudge` : dialogue.cycle(`${room.id}.idle`);
    if (line && comp?.isIn?.(room)) {
      try { comp.react?.('drift'); } catch (e) { console.error(e); }
      dialogue.say(line);
      return;
    }
    const t = this.ctx.script?.[`toast.nudge.${room.id}`] ?? this.ctx.script?.['toast.nudge'];
    hud.toast(typeof t === 'string' ? t : 'Stuck? Click Lavinia for a note.', 6000, { variant: 'nudge' });
  }

  noteClick() { /* Interaction.clickCount is the source of truth */ }

  /**
   * The puzzle to hint: the close-up's puzzle (camera.focus({ puzzle })) if it is still open to work on, else the first
   * in the room's puzzleOrder that is unsolved and room.prereqMet(id) allows.
   */
  currentPuzzle(room = this.ctx.game.currentRoom) {
    if (!room) return null;
    const order = room.constructor.puzzleOrder || [];
    const can = (id) => {
      if (this.ctx.state.isSolved(id)) return false;
      try { return room.prereqMet ? room.prereqMet(id) !== false : true; } catch (e) { console.error(e); return false; }
    };
    const focused = this.ctx.camera?.focusPuzzle;
    if (focused && order.includes(focused) && can(focused)) return focused;
    for (const id of order) if (can(id)) return id;
    return null;
  }

  /**
   * The frontier: the first room in manifest order (other than `except`) that still has an unsolved puzzle, or null.
   * In a dev room (id starting with '_') the dev rooms are the order.
   */
  nextRoom(except = this.ctx.game.currentRoom?.id) {
    const m = this.ctx.manifest || {};
    const rooms = (String(except || '').startsWith('_') ? m.devRooms : m.rooms) || [];
    for (const r of rooms) {
      if (r.id === except) continue;
      if ((r.puzzleOrder || []).some((p) => !this.ctx.state.isSolved(p))) return r.id;
    }
    return null;
  }

  _has(key) { return !!this.ctx.script && key in this.ctx.script; }

  /** A script key's lines with the "Note:" tag on the first one (hint lines). */
  _noted(key) {
    const lines = this.ctx.dialogue.resolve(key);
    if (!lines.length) return lines;
    return lines.map((l, i) => (i === 0 ? { ...l, tag: l.tag ?? NOTE_TAG } : l));
  }

  async ask() {
    if (this._asking || this.ctx.dialogue.busy) return;
    this._asking = true;
    try {
      const { state, dialogue, game } = this.ctx;
      const room = game.currentRoom;
      if (!room) return;
      const rid = room.constructor.id;
      this.idleTime = 0;
      this._glintAt = 0;
      try { room.onHintAsked?.(); } catch (e) { console.error(e); }
      state.set('hints.asked', true);
      state.inc(`hints.asked.${rid}`);

      // 1. the room-intro note, early in a visit (the hint click itself is one of the clicks)
      const early = this.roomTime < this.earlySeconds && (this.ctx.hotspots.clickCount || 0) < 3;
      if (early && this._has(`${rid}.enter.note`)) { await dialogue.say(this._noted(`${rid}.enter.note`)); return; }

      // 2. the current puzzle
      const pid = this.currentPuzzle(room);
      if (pid) {
        const level = state.get(`hint.${pid}.level`, 0);
        let variant = null;
        try { variant = room.hintVariant?.(pid) || null; } catch (e) { console.error(e); }
        const pick = (n) => {
          const vk = variant ? `hint.${pid}.${variant}.${n}` : null;
          return vk && this._has(vk) ? vk : `hint.${pid}.${n}`;
        };
        state.set(`hint.${pid}.level`, level + 1);
        const idle = level >= 3 && level % 2 === 1 ? dialogue.cycle(`${rid}.idle`) : null;
        if (idle) { await dialogue.say(idle); return; }
        const key = pick(Math.min(3, level + 1));
        if (this._has(key)) { await dialogue.say(this._noted(key)); return; }
      } else {
        // 3. a loose end, 4. the frontier
        let loose = null;
        try { loose = room.looseEnd?.() || null; } catch (e) { console.error(e); }
        if (loose && this._has(loose)) { await dialogue.say(this._noted(loose)); return; }
        const next = this.nextRoom(rid);
        if (next && this._has(`hint.goto.${next}`)) { await dialogue.say(this._noted(`hint.goto.${next}`)); return; }
      }

      // 5. idle chatter
      const idle = dialogue.cycle(`${rid}.idle`) || (this._has('idle') ? dialogue.cycle('idle') : null);
      if (idle) await dialogue.say(idle);
      else dialogue.caption('No notes, darling.');
    } finally {
      this._asking = false;
    }
  }
}

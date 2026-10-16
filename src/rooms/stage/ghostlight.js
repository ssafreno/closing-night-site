// ghostlight (PLUG): plug the ghost light into DIP 2 (docs/rooms/stage.md).
//   Ghost light (room) → the close-up of its foot: the plug and the luminous cable tag (caption: DIP 2 ONLY).
//   Click the plug (room or close-up) → it is held (a plug rides the cursor) and the camera drops to the three floor
//   dips, whose lids swing open. Click a dip's socket: dip 2 seats the plug (plugIn) and the light comes up; dip 1 or 3
//   sparks (dipSpark), nothing lights, the plug stays held, Room.wrong('ghostlight'). Back / Esc while holding puts the
//   plug back at the ghost light's foot. Success: bulbWarm, the pool spreads over 1.5 s, the shimmer becomes Lavinia
//   (ghostShimmer), then the seven-line click-through: the Running Order (journal pinned, line 0 ticked, the journal
//   opens on it), Pike at the prompt desk, the prompt book. Solve: `ghostlight` (flag solved.ghostlight, ro.ghost).
import { burst } from '../../engine/props/particles.js';

/** A plug drawn for the cursor (data URL), so the held plug rides the pointer. */
function plugCursor() {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d');
  g.translate(24, 24); g.rotate(-0.6);
  g.fillStyle = '#c9a24a'; g.fillRect(-9, -20, 4, 9); g.fillRect(5, -20, 4, 9); // pins
  g.fillStyle = '#1a1612'; g.strokeStyle = '#e8dcc0'; g.lineWidth = 2;
  g.beginPath(); g.roundRect(-12, -12, 24, 20, 4); g.fill(); g.stroke();
  g.strokeStyle = '#1a1612'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(0, 18, 10, 16, 14, 22); g.stroke();
  return c.toDataURL();
}

export default function ghostlight(ctx, room, h) {
  const { state, dialogue, audio, journal, papers, camera } = ctx;
  const lit = () => state.isSolved('ghostlight');
  const G = h.ghostLight, D = h.dips;
  let holding = false;
  let busy = false;
  let cursorUrl = null;
  const canvas = () => document.getElementById('game-canvas');
  const setCursor = (on) => {
    const c = canvas(); if (!c) return;
    if (on) { cursorUrl ||= plugCursor(); c.style.cursor = `url(${cursorUrl}) 24 24, pointer`; } else c.style.cursor = '';
  };

  // the lids: all open while the plug is held; only dip 2 stays open once lit
  const lids = { t: [0, 0, 0] };
  const lidJobs = [null, null, null];
  function animLid(i, to, dur) {
    lidJobs[i]?.cancel?.();
    const from = lids.t[i];
    lidJobs[i] = ctx.tween.run(dur, (k) => { lids.t[i] = from + (to - from) * k; D.setOpen(i, lids.t[i]); }, { ease: 'outQuad' });
    return lidJobs[i];
  }

  const focusGhost = () => camera.focus({ ...G.focus, scope: 'focus:ghostlight', puzzle: 'ghostlight' });
  const focusDips = () => camera.focus({ ...D.focus, scope: 'focus:dips', puzzle: 'ghostlight', onExit: () => { if (holding) drop(); } });

  function pickUp() {
    if (holding || busy || lit()) return;
    holding = true;
    G.setPlugHome(false);
    audio?.play('pickup', { gain: 0.4 });
    setCursor(true);
    focusDips();
    room.later(0.35, () => { if (holding) { audio?.play('latch', { gain: 0.25 }); for (let i = 0; i < 3; i++) animLid(i, 1, 0.45); } });
  }
  /** Back / Esc while holding: the plug goes back to the ghost light's foot. */
  function drop() {
    holding = false;
    setCursor(false);
    if (lit()) return;
    G.setPlugHome(true);
    audio?.play('drop', { gain: 0.3 });
    for (let i = 0; i < 3; i++) animLid(i, 0, 0.3);
  }

  room.spot('ghostlight', G.hit, 'Ghost light', G.object, {
    onClick: () => {
      if (lit()) { dialogue.say('stage.delight.ghostlit'); return; } // the delight, after
      focusGhost();
    },
  });
  room.spot('ghostlight.plug', G.plugHit, 'Plug', G.plug, {
    scope: ['room', 'focus:ghostlight'], enabled: () => !lit() && !holding,
    onClick: () => pickUp(),
  });
  room.spot('ghostlight.tag', G.tagHit, 'Cable tag', G.tag, {
    scope: ['room', 'focus:ghostlight'], enabled: () => !lit(),
    onClick: () => dialogue.caption('stage.ghostlight.tag'),
  });
  room.spot('dips', D.object, 'Floor dips', null, {
    enabled: () => !lit(),
    onClick: () => camera.focus({ ...D.focus, scope: 'focus:dips', puzzle: 'ghostlight' }),
  });
  D.hits.forEach((hit, i) => room.spot(`dip.${i + 1}`, hit, () => (holding ? `Dip ${i + 1}: plug in` : `Dip ${i + 1}`), D.object, {
    scope: 'focus:dips', enabled: () => !lit() && !busy,
    onClick: () => {
      if (holding) { seat(i); return; }
      // no plug in hand: lift the lid for a look, it drops again
      audio?.play('latch', { gain: 0.25 });
      animLid(i, 1, 0.3);
      room.later(1.4, () => { if (!lit() && !holding) animLid(i, 0, 0.3); });
    },
  }));

  function seat(i) {
    if (i !== 1) {
      // dips 1 and 3 are mains: a spark, nothing lights, the plug stays in your hand
      audio?.play('plugIn', { gain: 0.35 });
      room.later(0.12, () => {
        audio?.play('dipSpark', { gain: 0.7 });
        const p = D.sockets[i];
        burst(ctx, room.group, [p.x, p.y + 0.04, p.z], { color: '#bfe0ff', color2: '#ffffff', count: 60, radius: 0.35, duration: 0.7, size: 0.02 });
        D.setGlow(0.2); room.later(0.35, () => { if (!lit()) D.setGlow(1); });
        room.wrong('ghostlight');
      });
      return;
    }
    succeed();
  }

  async function succeed() {
    if (busy || lit()) return;
    busy = true;
    holding = false;
    setCursor(false);
    let locked = true;
    ctx.hotspots.lock();
    try {
      audio?.play('plugIn', { gain: 0.6 });
      G.cable.showTo(1);
      animLid(0, 0, 0.3); animLid(2, 0, 0.3); animLid(1, 1, 0.1);
      state.solve('ghostlight');
      await room.wait(0.5);
      await camera.exitFocus({ all: true, duration: 0.9 });
      // the bulb: a ping and a hum, up to full over 1.5 s, the warm pool spreading
      audio?.play('bulbWarm', { gain: 0.7 });
      h.lights.setState('ghost', 1.5);
      await room.wait(1.0);
      // the shimmer becomes Lavinia, standing where it hung
      audio?.play('ghostShimmer', { gain: 0.6 });
      h.shimmer.setLevel(0);
      const lav = ctx.characters?.lavinia;
      lav?.placeAt?.(room.group, { ...h.perches.lavinia });
      lav?.setPresence?.(0);
      lav?.react?.('appear');
      await room.wait(1.4);
      lav?.react?.('flourish');
      await dialogue.say('stage.ghostlight.solved');
      await dialogue.say('stage.intro.1');
      await dialogue.say('stage.intro.2');
      await dialogue.say('stage.runningorder');
      // your pen writes it down: the Running Order, line 0 ticked, the journal open on it
      audio?.play('penScratch', { gain: 0.5 });
      journal.pin('runningorder');
      journal.deliver('ghost');
      await room.wait(0.6);
      journal.open({ tab: 'running' });
      await room.until(() => !journal.isOpen);
      // Pike at the prompt desk
      const pike = ctx.characters?.pike;
      room.placePike();
      pike?.setPresence?.(0);
      pike?.react?.('appear');
      await room.wait(1.0);
      await dialogue.say('stage.pike.intro');
      lav?.react?.('sigh');
      await dialogue.say('stage.pike.bicker.1');
      await dialogue.say('stage.promptbook');
      await papers.show('promptbook');
    } finally {
      if (locked) ctx.hotspots.unlock();
      busy = false;
      room.restore();
    }
  }

  return {
    restore() {
      if (!busy) { holding = false; setCursor(false); }
      if (lit()) { lids.t = [0, 1, 0]; } else { lids.t = [0, 0, 0]; }
      lidJobs.forEach((j) => j?.cancel?.());
      lids.t.forEach((t, i) => D.setOpen(i, t));
      if (lit()) { G.setPlugHome(false); G.cable.showTo(1); }
      else { G.setPlugHome(!holding); G.cable.hide(); }
    },
    get holding() { return holding; },
  };
}


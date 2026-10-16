// Dressing Room No. 1: small helpers shared by the puzzle files (PUZZLES-dressing).
import * as THREE from 'three';

/** Scope name for a close-up in this room. */
export const scope = (name) => `focus:dressing.${name}`;

/** Lavinia's reaction, never throwing. */
export function react(ctx, name) {
  try { return ctx.companion?.react?.(name) || Promise.resolve(); } catch (e) { console.error(e); return Promise.resolve(); }
}

/**
 * A story beat: each key queued at once (the box stays open, a click between lines), with Lavinia's reaction fired as
 * each line comes up. `steps` = [[key, reaction?], ...]. Resolves after the last line.
 */
export function beat(ctx, steps) {
  const { dialogue } = ctx;
  let prev = Promise.resolve();
  let last = prev;
  for (const [key, reaction] of steps) {
    const startsWhen = prev; // a line comes up when the one before it is dismissed
    last = dialogue.say(key);
    if (reaction) startsWhen.then(() => react(ctx, reaction));
    prev = last;
  }
  return last;
}

/**
 * Lavinia's live voice: a few sung notes through the record's vowel formants, unaccompanied (no horn, no crackle).
 * AUDIO has no public "sing" call, so this uses the engine's own note voice (`_sing`, `_voice`) behind a guard; with
 * no audio context (muted, headless) it is a silent no-op. `notes` = [[midi | null, beats], ...] at `q` s per beat.
 */
export function sing(audio, notes, { q = 0.5, gain = 0.55, vibrato = 24, delay = 0.02 } = {}) {
  const a = audio;
  if (!a?.ctx || typeof a._sing !== 'function' || typeof a._voice !== 'function' || a.muted) return 0;
  try {
    const ac = a.ctx, t0 = ac.currentTime + delay;
    const total = notes.reduce((s, [, b]) => s + b, 0) * q;
    const out = a._voice(gain, 0.35, total + 1);
    const vin = ac.createGain();
    for (const [f, Q, amp] of [[800, 4, 1], [1250, 5, 0.6], [2800, 6, 0.25]]) {
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = Q;
      const g = ac.createGain(); g.gain.value = amp; vin.connect(bp); bp.connect(g); g.connect(out);
    }
    const vibO = ac.createOscillator(), vib = ac.createGain(); vibO.frequency.value = 5.8; vib.gain.value = vibrato;
    vibO.connect(vib); vibO.start(t0); vibO.stop(t0 + total + 0.8);
    let t = t0;
    for (const [m, b] of notes) {
      if (m != null) a._sing(vin, t, 440 * 2 ** ((m - 69) / 12), b * q * 0.96, 0.8, { vib });
      t += b * q;
    }
    setTimeout(() => { try { vin.disconnect(); } catch (e) { /* gone */ } }, (total + 1.5) * 1000);
    return total;
  } catch (e) { console.warn('[dressing] sing', e); return 0; }
}

/** The world point where `ray` meets the horizontal plane at world height y (or null). */
export function rayAtY(ray, y, out = new THREE.Vector3()) {
  if (!ray) return null;
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
  return ray.intersectPlane(plane, out);
}

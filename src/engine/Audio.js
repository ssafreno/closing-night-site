// AudioEngine: fully procedural Web Audio for Closing Night (AUDIO owns this file).
// No audio files: every sound is oscillators, generated noise and click buffers, filters and envelopes.
// The name list, parameters and how to test are in docs/notes/audio.md; the bench is dev/audio.html.
//
// Signal graph:
//   one-shots, blips, music ─▶ sfxBus ─┐
//   loops and room beds ─────▶ ambBus ─┼─▶ master (mute) ─▶ glue comp ─▶ limiter ─▶ soft clip ─▶ meter ─▶ out
//   (reverb sends) ──────────▶ reverb ─┘
//
// The AudioContext is created on the first user gesture (a capture listener installed here, plus Game's resume()).
// Before that: play/blip are silent no-ops; loop/setRoomAmbience/setMuted are remembered and applied on resume;
// overture.play()/pianola() still keep time (progress, cues and onEnd fire on the wall clock) so nothing that waits
// on the music can hang. Nothing throws. Unknown names warn once and do nothing.
//
// CPU: no per-frame work at all (a 60 ms interval schedules loop events and music ahead). Shared buses and filters
// are built once (speaker voices, the music bus, the record's horn and formants); rain patter, peas, record crackle
// and applause are pre-rendered click buffers rather than hundreds of nodes; one-shots are capped (MAX_VOICES) and
// rapid repeats of tick-like sounds are rate-limited (`gap`). loop() is idempotent.

const LOOP_FADE = 1.0;
const ROOM_FADE = 1.5;
const EPS = 0.0001;
const MAX_VOICES = 64;
const MUSIC_AHEAD = 1.2;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'C4' → 60, 'Bb5' → 82, 'F#3' → 54; numbers pass through. null if unreadable. */
export function midi(n) {
  if (typeof n === 'number') return n;
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(String(n).trim());
  if (!m) return null;
  return 12 * (+m[3] + 1) + NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

// Per-room ambience beds: loop name → gain. DESIGN §9. Conditional layers (dimmerHum after mains, the pit's low
// wind, the chandelier tinkle) are room loops: `this.loop('dimmerHum')` from the room, so they stop on exit.
export const ROOM_BEDS = {
  door: { rainGlass: 1, kettleTick: 1, wirelessStatic: 0.7 },
  stage: { bigRoom: 1 },
  wardrobe: { rainSkylight: 1, loftCreaks: 1 },
  pit: { pitDust: 1 },
  foyer: { foyerStreet: 1 },
  dressing: { dressingRoom: 1 },
  finale: { houseMurmur: 1 },
  title: { bigRoom: 0.8 },
  _test: { bigRoom: 0.7, dimmerHum: 0.5 }, // the test room adds its own rain (this.loop('rain'))
  _test2: { bigRoom: 1, loftCreaks: 1 },
};

// Speech blips. `ref` is the pitch Dialogue sends for the speaker by default, so f = base × (pitch / ref):
// Dialogue's per-letter jitter and a deliberately lower pitch (Lavinia doing Ezra) still move it. `follow` < 1
// flattens the jitter (Pike).
const VOICES = {
  lavinia: { ref: 1.35, f: 520, follow: 1, len: 0.078, type: 'triangle', peak: 0.085, vib: true, glide: 0.035, bus: 'lavinia' },
  lavinia_off: { ref: 1.3, f: 520, follow: 1, len: 0.078, type: 'triangle', peak: 0.085, vib: true, glide: 0.035, bus: 'lavinia', muffled: true },
  pike: { ref: 0.62, f: 150, follow: 0.25, len: 0.036, type: 'square', peak: 0.05, vib: false, glide: 0, bus: 'pike', short: true },
  cat: { ref: 0.9, cat: true },
  narrator: { silent: true },
  neutral: { ref: 1, f: 380, follow: 1, len: 0.045, type: 'triangle', peak: 0.07, vib: false, glide: 0.02, bus: 'neutral' },
};

export class AudioEngine {
  /**
   * @param {{ context?: BaseAudioContext, measure?: boolean }} [opts] `context`: render into this context (an
   *   OfflineAudioContext for the bench's measurements). `measure`: 4-channel output, raw master on 0-1 and the
   *   limited output on 2-3.
   */
  constructor({ context = null, measure = false } = {}) {
    this.ctx = null;
    this.muted = false;
    this._extCtx = context;
    this._measure = measure;
    this._offline = !!(context && typeof OfflineAudioContext !== 'undefined' && context instanceof OfflineAudioContext);
    this._warned = new Set();
    this._loops = new Map();   // name -> live instance
    this._wanted = new Map();  // name -> opts (desired loop state, kept before resume)
    this._room = null;
    this._roomLoops = new Set();
    this._seqs = new Set();    // music in flight
    this._last = new Map();    // rate limits
    this._active = 0;
    this._sched = null;
    this._bufs = {};
    this.overture = new Overture(this);
    if (context) this._build();
    else this._installGestureResume();
  }

  // ───────────────────────────────────────────────────────── lifecycle

  async resume() {
    if (!this.ctx && !this._build()) return;
    try { if (this.ctx.state !== 'running') await this.ctx.resume(); } catch (e) { /* ignore */ }
    for (const [name, o] of this._wanted) {
      if (!this._loops.has(name)) this._startLoop(name, o, LOOP_FADE);
    }
    if (this._room) this._applyRoom(ROOM_FADE);
  }

  get ready() { return !!this.ctx; }

  _installGestureResume() {
    if (typeof window === 'undefined') return;
    const h = () => { if (!this.ctx || this.ctx.state !== 'running') this.resume(); };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, h, { capture: true, passive: true });
  }

  _build() {
    let ctx = this._extCtx;
    if (!ctx) {
      const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return false; }
    }
    this.ctx = ctx;

    this._master = ctx.createGain();
    this._master.gain.value = this.muted ? 0 : 1;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20; glue.knee.value = 12; glue.ratio.value = 2.5;
    glue.attack.value = 0.01; glue.release.value = 0.25;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20;
    lim.attack.value = 0.001; lim.release.value = 0.12;
    const clip = ctx.createWaveShaper();
    const n = 2048, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = 0.98 * Math.tanh(x * 1.1) / Math.tanh(1.1); }
    clip.curve = curve;
    const trim = ctx.createGain(); trim.gain.value = 0.9;
    this._meter = ctx.createAnalyser();
    this._meter.fftSize = 2048;
    this._meterBuf = new Float32Array(this._meter.fftSize);
    this._master.connect(glue); glue.connect(lim); lim.connect(trim); trim.connect(clip); clip.connect(this._meter);
    if (this._measure) {
      const merge = ctx.createChannelMerger(4), sRaw = ctx.createChannelSplitter(2), sOut = ctx.createChannelSplitter(2);
      this._master.connect(sRaw); this._meter.connect(sOut);
      sRaw.connect(merge, 0, 0); sRaw.connect(merge, 1, 1); sOut.connect(merge, 0, 2); sOut.connect(merge, 1, 3);
      merge.connect(ctx.destination);
    } else {
      this._meter.connect(ctx.destination);
    }

    this._sfx = ctx.createGain(); this._sfx.gain.value = 1; this._sfx.connect(this._master);
    this._amb = ctx.createGain(); this._amb.gain.value = 0.7; this._amb.connect(this._master);

    this._revIn = ctx.createGain(); this._revIn.gain.value = 1;
    const conv = ctx.createConvolver();
    conv.buffer = this._makeImpulse(2.6, 2.4);
    const revTone = ctx.createBiquadFilter(); revTone.type = 'lowpass'; revTone.frequency.value = 5000;
    this._revOut = ctx.createGain(); this._revOut.gain.value = 0.42;
    this._revIn.connect(conv); conv.connect(revTone); revTone.connect(this._revOut); this._revOut.connect(this._master);

    this._buildVoices();
    this._ensureSched();
    return true;
  }

  _ensureSched() {
    if (this._sched || this._offline) return;
    this._sched = setInterval(() => this._schedule(), 60);
  }

  _buildVoices() {
    const ctx = this.ctx, bus = ctx.createGain();
    bus.gain.value = 1; bus.connect(this._sfx);
    // Lavinia: a warm formant bump, gentle top
    const lavLp = ctx.createBiquadFilter(); lavLp.type = 'lowpass'; lavLp.frequency.value = 3400; lavLp.Q.value = 0.7;
    const lavPk = ctx.createBiquadFilter(); lavPk.type = 'peaking'; lavPk.frequency.value = 1150; lavPk.gain.value = 5; lavPk.Q.value = 1.2;
    lavPk.connect(lavLp); lavLp.connect(bus);
    // "A voice, off": the same voice through a door
    const muf = ctx.createBiquadFilter(); muf.type = 'lowpass'; muf.frequency.value = 620; muf.Q.value = 0.9;
    const mufG = ctx.createGain(); mufG.gain.value = 1.1;
    const mufS = ctx.createGain(); mufS.gain.value = 0.35;
    muf.connect(mufG); mufG.connect(bus); mufG.connect(mufS); mufS.connect(this._revIn);
    // Pike: low, boxy
    const pike = ctx.createBiquadFilter(); pike.type = 'lowpass'; pike.frequency.value = 950; pike.Q.value = 0.8; pike.connect(bus);
    const neutral = ctx.createBiquadFilter(); neutral.type = 'lowpass'; neutral.frequency.value = 2600; neutral.Q.value = 0.7; neutral.connect(bus);
    // Lavinia's 6 Hz vibrato, one persistent LFO shared by every blip
    const vib = ctx.createOscillator(), vibG = ctx.createGain();
    vib.frequency.value = 6; vibG.gain.value = 32; vib.connect(vibG); vib.start();
    this._bv = { lavinia: lavPk, muffled: muf, pike, neutral, vib: vibG };
  }

  _makeNoise(kind, seconds) {
    const ctx = this.ctx, len = (ctx.sampleRate * seconds) | 0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    if (kind === 'white') {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (kind === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    const fade = Math.min(2048, len >> 3);
    for (let i = 0; i < fade; i++) { const a = i / fade; d[i] = d[i] * a + d[len - fade + i] * (1 - a); }
    return buf;
  }

  /** A buffer of random decaying clicks: rain patter, dried peas, record crackle, a full house clapping. */
  _makeClicks(seconds, perSec, lenMs, ampPow, extra = 0) {
    const ctx = this.ctx, sr = ctx.sampleRate, len = (sr * seconds) | 0;
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const L = Math.max(4, (sr * lenMs / 1000) | 0), dec = L / 4.5;
    const count = (perSec * seconds) | 0;
    const env = new Float32Array(L);
    for (let i = 0; i < L; i++) env[i] = Math.exp(-i / dec);
    for (let k = 0; k < count; k++) {
      const at = (Math.random() * (len - L)) | 0, amp = Math.pow(Math.random(), ampPow);
      for (let i = 0; i < L; i++) d[at + i] += amp * (Math.random() * 2 - 1) * env[i];
    }
    for (let k = 0; k < extra; k++) { // a few big pops
      const at = (Math.random() * (len - L * 3)) | 0;
      for (let i = 0; i < L * 3; i++) d[at + i] += 0.9 * (Math.random() * 2 - 1) * Math.exp(-i / (dec * 2));
    }
    let peak = 0;
    for (let i = 0; i < len; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
    if (peak > 0) for (let i = 0; i < len; i++) d[i] /= peak;
    return buf;
  }

  _buf(kind) {
    if (this._bufs[kind]) return this._bufs[kind];
    let b;
    switch (kind) {
      case 'pink': b = this._makeNoise('pink', 4); break;
      case 'brown': b = this._makeNoise('brown', 4); break;
      case 'patter': b = this._makeClicks(2.3, 260, 2, 2.5); break;
      case 'peas': b = this._makeClicks(1.7, 650, 3, 1.4); break;
      case 'crackle': b = this._makeClicks(3.1, 16, 1.2, 3, 3); break;
      case 'applause': b = this._makeClicks(3.4, 420, 16, 1.1); break;
      default: b = this._makeNoise('white', 2.5);
    }
    this._bufs[kind] = b;
    return b;
  }

  _makeImpulse(seconds, decay) {
    const ctx = this.ctx, len = (ctx.sampleRate * seconds) | 0;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45;
        const pre = Math.min(1, i / (ctx.sampleRate * 0.015));
        d[i] = lp * Math.pow(1 - t, decay) * pre * 0.6;
      }
    }
    return buf;
  }

  // ───────────────────────────────────────────────────────── building blocks

  _now() { return this.ctx.currentTime + 0.012; }

  /** Output gain node for one sound; auto-disconnects after `life` seconds. */
  _voice(gain, send, life) {
    const ctx = this.ctx, g = ctx.createGain();
    g.gain.value = gain;
    g.connect(this._sfx);
    let s = null;
    if (send > 0) { s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(this._revIn); }
    if (!this._offline) {
      this._active++;
      setTimeout(() => { this._active--; try { g.disconnect(); s && s.disconnect(); } catch (e) {} }, (life + 0.6) * 1000);
    }
    return g;
  }

  _env(param, t, a, peak, d, hold = 0) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(EPS, t);
    param.linearRampToValueAtTime(Math.max(EPS * 2, peak), t + a);
    if (hold > 0) param.setValueAtTime(Math.max(EPS * 2, peak), t + a + hold);
    param.exponentialRampToValueAtTime(EPS, t + a + hold + d);
    param.setValueAtTime(0, t + a + hold + d + 0.001);
  }

  /** Enveloped oscillator. vib: [rateHz, cents, decays?]. Returns {osc, g}, or null for a partial above Nyquist. */
  _tone(dest, { type = 'sine', f, f2, glide, t, a = 0.005, peak = 0.2, d = 0.2, hold = 0, detune = 0, vib }) {
    const ctx = this.ctx, top = ctx.sampleRate * 0.45;
    if (f >= top) return null; // an inaudible partial above Nyquist: skip it
    const o = ctx.createOscillator(), g = ctx.createGain();
    const end = t + a + hold + d;
    o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(clamp(f2, 1, top), t + (glide ?? (a + hold + d)));
    if (vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = vib[0]; lg.gain.setValueAtTime(vib[1], t);
      if (vib[2]) lg.gain.linearRampToValueAtTime(0, end);
      l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(end + 0.05);
    }
    this._env(g.gain, t, a, peak, d, hold);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(end + 0.05);
    return { osc: o, g };
  }

  /** Enveloped filtered noise. rough: [lo, hi, smooth, n] amplitude flutter; fcurve: same for the filter. */
  _noise(dest, { kind = 'white', type = 'bandpass', f = 1000, f2, glide, Q = 1, t, a = 0.005, peak = 0.2, d = 0.2, hold = 0, rate = 1, rough, fcurve }) {
    const ctx = this.ctx, src = ctx.createBufferSource();
    src.buffer = this._buf(kind); src.loop = true; src.playbackRate.value = rate;
    const total = a + hold + d;
    const filt = ctx.createBiquadFilter(); filt.type = type; filt.Q.value = Q;
    filt.frequency.setValueAtTime(f, t);
    if (f2) filt.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + (glide ?? total));
    else if (fcurve) filt.frequency.setValueCurveAtTime(this._roughCurve(fcurve[3] || 32, fcurve[0], fcurve[1], fcurve[2] ?? 0.5), t + 0.002, Math.max(0.02, total - 0.002));
    const g = ctx.createGain(); this._env(g.gain, t, a, peak, d, hold);
    let last = filt;
    if (rough) {
      const m = ctx.createGain(); m.gain.value = 0;
      m.gain.setValueCurveAtTime(this._roughCurve(rough[3] || 32, rough[0], rough[1], rough[2] ?? 0.4), t, Math.max(0.02, total));
      filt.connect(m); last = m;
    }
    src.connect(filt); last.connect(g); g.connect(dest);
    src.start(t, Math.random() * Math.max(0, src.buffer.duration - 0.5)); src.stop(t + total + 0.05);
    return { src, filt, g };
  }

  /** Inharmonic bell. */
  _bell(dest, f, t, peak, d, ratios = [1, 2.76, 5.4, 8.93], amps = [1, 0.45, 0.22, 0.1]) {
    for (let i = 0; i < ratios.length; i++) {
      this._tone(dest, { f: f * ratios[i], t, a: 0.003, peak: peak * amps[i], d: d / (1 + i * 0.9) });
    }
  }

  /**
   * One piano note: two slightly detuned strings and an octave partial, a hammer-quick attack, a ring that is
   * longer in the bass, and a damper at `dur`. o: { detune (cents), chorus (cents between strings), sour, ring,
   * pitchBus (an AudioNode summed into every string's detune: the record's speed and wow) }.
   */
  _piano(dest, t, f, dur, vel = 0.7, o = {}) {
    const ctx = this.ctx;
    const g = ctx.createGain(), g2 = ctx.createGain();
    const s1 = ctx.createOscillator(), s2 = ctx.createOscillator(), s3 = ctx.createOscillator();
    s1.type = 'triangle'; s2.type = 'triangle'; s3.type = 'sine';
    s1.frequency.value = f; s2.frequency.value = f; s3.frequency.value = f * 2;
    let det = o.detune || 0, chorus = o.chorus ?? 4;
    if (o.sour) { det += rand(18, 38) * (Math.random() < 0.5 ? -1 : 1); chorus = 22; }
    s1.detune.value = det - chorus; s2.detune.value = det + chorus; s3.detune.value = det + 3;
    const hi = clamp((f - 200) / 1600, 0, 1);
    const peak = 0.11 * vel * (1 - hi * 0.35);
    const ring = o.ring ?? Math.max(0.35, 2.6 - Math.log2(Math.max(f, 30) / 65) * 0.45);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.setTargetAtTime(0, t + 0.005, ring / 4.5);
    const off = t + Math.max(0.06, dur);
    g.gain.setTargetAtTime(0, off, 0.05);
    g2.gain.value = 0.45 * (1 - hi * 0.6);
    s1.connect(g); s2.connect(g); s3.connect(g2); g2.connect(g); g.connect(dest);
    const stopAt = Math.max(t + 0.1, Math.min(off + 0.35, t + ring * 1.3 + 0.1));
    for (const s of [s1, s2, s3]) { s.start(t); s.stop(stopAt); }
    if (o.pitchBus) {
      const pb = o.pitchBus;
      for (const s of [s1, s2, s3]) pb.connect(s.detune);
      s1.onended = () => { try { for (const s of [s1, s2, s3]) pb.disconnect(s.detune); } catch (e) {} };
    }
  }

  /** A sung note (the 1912 record): a sawtooth into a shared formant chain, with vibrato and the record's pitch. */
  _sing(dest, t, f, dur, vel, o = {}) {
    const ctx = this.ctx, s = ctx.createOscillator(), g = ctx.createGain();
    s.type = 'sawtooth'; s.frequency.value = f;
    if (o.vib) o.vib.connect(s.detune);
    if (o.pitchBus) o.pitchBus.connect(s.detune);
    const peak = 0.1 * vel;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.07);
    g.gain.setTargetAtTime(peak * 0.75, t + 0.07, 0.3);
    g.gain.setTargetAtTime(0, t + Math.max(0.1, dur - 0.03), 0.06);
    s.connect(g); g.connect(dest);
    s.start(t); s.stop(t + dur + 0.4);
    s.onended = () => { try { o.vib && o.vib.disconnect(s.detune); o.pitchBus && o.pitchBus.disconnect(s.detune); } catch (e) {} };
  }

  _roughCurve(n, lo, hi, smooth = 0.6) {
    const c = new Float32Array(Math.max(2, n)); let v = (lo + hi) / 2;
    for (let i = 0; i < c.length; i++) { v = v * smooth + rand(lo, hi) * (1 - smooth); c[i] = v; }
    return c;
  }

  _warnOnce(kind, name, msg) {
    const key = kind + ':' + name;
    if (this._warned.has(key)) return;
    this._warned.add(key);
    console.warn(msg || `[audio] unknown ${kind} "${name}"`);
  }

  // ───────────────────────────────────────────────────────── public: one-shots

  /**
   * One-shot by name. opts: { gain = 1, pitch = 1, delay = 0 } plus per-sound parameters (cents, n, size, kind,
   * accent, dur, note, notes, tune...). Never throws. Unknown names warn once; a loop name tells you to use loop().
   */
  play(name, opts = {}) {
    const def = SFX[name];
    if (!def) {
      if (LOOPS[name]) this._warnOnce('loop-as-sound', name, `[audio] "${name}" is a loop: use loop()/room.loop(), not play()`);
      else this._warnOnce('sound', name);
      return;
    }
    if (def.special) { try { return def.special(this, opts); } catch (e) { this._warnOnce('error', name, `[audio] ${name}: ${e && e.message}`); return; } }
    if (!this.ctx) return;
    if (this._active >= MAX_VOICES && !def.prio) return;
    const now = this.ctx.currentTime;
    if (def.gap && !this._offline) {
      const l = this._last.get(name);
      if (l != null && now - l < def.gap) return;
      this._last.set(name, now);
    }
    try {
      const gain = opts.gain ?? 1, pitch = opts.pitch ?? 1;
      const life = typeof def.life === 'function' ? def.life(opts) : (def.life || 2);
      const out = this._voice(gain, def.send || 0, life + (opts.delay || 0));
      def.fn(this, this._now() + (opts.delay || 0), pitch, out, opts);
    } catch (e) {
      this._warnOnce('error', name, `[audio] ${name}: ${e && e.message}`);
    }
  }

  // named helpers for the parameterised sounds (each is also play(name, { ... }))
  pianoString(cents = 0, o = {}) { this.play('pianoString', { ...o, cents }); }
  lensClink(n = 3, o = {}) { this.play('lensClink', { ...o, n }); }
  thunderSheet(kind = 'roll', o = {}) { this.play('thunderSheet', { ...o, kind }); }
  metronome(accent = false, o = {}) { this.play('metronome', { ...o, accent }); }
  piano(note = 'C4', o = {}) { this.play('pianoNote', { ...o, note }); }
  pianoChord(notes = ['C4', 'E4', 'G4'], o = {}) { this.play('pianoChord', { ...o, notes }); }
  /** Start or update the wind machine (speed 0 = rest … ~0.6 GALE … 1 = DO NOT). Rooms: this.loop('windMachine', { speed }). */
  windMachine(speed) { this.loop('windMachine', { speed }); }
  /** Start or update the gramophone record at `speed` rpm (78 is true; or a ratio < 5). Rooms: this.loop('record', { speed }). */
  record(speed = 78) { this.loop('record', { speed }); }

  /** Glassy pluck. 0 = C5. (Kept from the engine lineage; the test room's jars use it.) */
  glassNote(semitoneOffset = 0) {
    if (!this.ctx) return;
    try {
      const f = 523.25 * Math.pow(2, (semitoneOffset || 0) / 12);
      const t = this._now(), out = this._voice(1, 0.4, 2.5);
      glass(this, out, t, f, 0.12, 1.6);
    } catch (e) { this._warnOnce('error', 'glassNote'); }
  }

  /**
   * Speech blip, called by Dialogue per letter: blip(who, { pitch, vibrato, every, short, muffled, index, gain }).
   * Lavinia high with a 6 Hz vibrato and longer blips; lavinia_off the same through a door; Pike low, flat, short;
   * the cat one soft "mrrp" at the start of a line; narrator silent. The old blip(pitch, { who }) form still works.
   */
  blip(whoOrPitch = 1, opts = {}) {
    if (!this.ctx || !this._bv) return;
    const who = typeof whoOrPitch === 'string' ? whoOrPitch : (opts.who || 'neutral');
    const v = VOICES[who] || VOICES.neutral;
    if (v.silent || opts.silent) return;
    const ctx = this.ctx, now = opts.when ?? ctx.currentTime;
    if (opts.when == null) {
      const key = 'blip:' + who, l = this._last.get(key);
      if (l != null && now - l < 0.022) return;
      this._last.set(key, now);
    }
    if (v.cat) {
      if (opts.index != null && opts.index > Math.max(1, opts.every || 3)) return;
      const l = this._last.get('catMrrp');
      if (opts.when == null && l != null && now - l < 1.0) return;
      this._last.set('catMrrp', now);
      this.play('catMrrp', { gain: (opts.gain ?? 1) * 0.8, delay: opts.when != null ? opts.when - ctx.currentTime : 0 });
      return;
    }
    try {
      const pitchIn = typeof whoOrPitch === 'number' ? whoOrPitch : (opts.pitch ?? v.ref);
      const f = v.f * (1 + (pitchIn / v.ref - 1) * v.follow);
      const len = (opts.short ?? v.short) ? v.len * (v.short ? 1 : 0.75) : v.len;
      const muffled = opts.muffled ?? v.muffled;
      const t = now + 0.005;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = v.type;
      o.frequency.setValueAtTime(f * (1 - v.glide), t);
      o.frequency.linearRampToValueAtTime(f * (1 + v.glide), t + len);
      if (v.vib && (opts.vibrato ?? 1) > 0) {
        const vib = this._bv.vib;
        vib.connect(o.detune);
        o.onended = () => { try { vib.disconnect(o.detune); } catch (e) {} };
      }
      const peak = v.peak * (opts.gain ?? 1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.006);
      g.gain.setValueAtTime(peak * 0.85, t + len * 0.6);
      g.gain.linearRampToValueAtTime(0, t + len);
      o.connect(g); g.connect(muffled ? this._bv.muffled : this._bv[v.bus]);
      o.start(t); o.stop(t + len + 0.02);
    } catch (e) { this._warnOnce('error', 'blip'); }
  }

  // ───────────────────────────────────────────────────────── public: loops

  /**
   * Start a loop, or update a running one (idempotent: same name = same instance). opts: { gain = 1, fade } plus the
   * loop's parameters (windMachine { speed }, record { speed }). Remembered before the context exists.
   */
  loop(name, opts = {}) {
    const def = LOOPS[name];
    if (!def) {
      if (SFX[name]) this._warnOnce('sound-as-loop', name, `[audio] "${name}" is a one-shot: use play(), not loop()`);
      else this._warnOnce('loop', name);
      return;
    }
    const { fade, ...rest } = opts;
    const o = { ...(this._wanted.get(name) || {}), ...rest };
    if (o.gain == null) o.gain = 1;
    this._wanted.set(name, o);
    if (!this.ctx) return;
    const inst = this._loops.get(name);
    if (inst && !inst.stopping) {
      if (rest.gain != null) this._rampLoop(inst, o.gain, fade ?? 0.5);
      if (def.set) { try { def.set(this, inst, o); } catch (e) { this._warnOnce('error', 'set ' + name); } }
      return;
    }
    this._startLoop(name, o, fade ?? LOOP_FADE);
  }

  stopLoop(name, fade = LOOP_FADE) {
    this._wanted.delete(name);
    this._roomLoops.delete(name);
    const inst = this._loops.get(name);
    if (!inst) return;
    this._loops.delete(name);
    this._killLoop(inst, fade);
  }

  stopAllLoops(fade = LOOP_FADE) {
    for (const name of [...this._loops.keys()]) this.stopLoop(name, fade);
    this._wanted.clear();
    this._roomLoops.clear();
    this._room = null;
  }

  setLoopGain(name, gain, fade = 0.5) {
    if (this._wanted.has(name)) this._wanted.get(name).gain = gain;
    const inst = this._loops.get(name);
    if (inst) this._rampLoop(inst, gain, fade);
  }

  /** Update a running loop's parameters without starting it. */
  setLoopParams(name, params = {}) { if (this.isLooping(name)) this.loop(name, params); }

  isLooping(name) { return this._wanted.has(name); }
  get activeLoops() { return [...this._wanted.keys()]; }

  _startLoop(name, o, fade) {
    const def = LOOPS[name], ctx = this.ctx;
    try {
      const out = ctx.createGain();
      out.gain.setValueAtTime(EPS, ctx.currentTime);
      out.connect(this._amb);
      let send = null;
      if (def.send) { send = ctx.createGain(); send.gain.value = def.send; out.connect(send); send.connect(this._revIn); }
      const inst = { name, out, send, gain: o.gain, sources: [], tickers: [], tick: null, stopping: false, level: def.level ?? 1, ahead: def.ahead ?? 1.1 };
      def.build(this, inst, o);
      if (inst.tick) inst.tickers.push({ fn: inst.tick, next: ctx.currentTime + (def.first ?? 0.05) });
      if (def.set) def.set(this, inst, o);
      this._loops.set(name, inst);
      this._rampLoop(inst, o.gain, fade);
    } catch (e) {
      this._warnOnce('error', 'loop ' + name, `[audio] loop ${name}: ${e && e.message}`);
    }
  }

  _rampLoop(inst, gain, fade) {
    const p = inst.out.gain, t = this.ctx.currentTime;
    inst.gain = gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(Math.max(EPS, p.value), t);
    p.linearRampToValueAtTime(Math.max(EPS, gain * inst.level), t + Math.max(0.02, fade));
  }

  _killLoop(inst, fade) {
    inst.stopping = true;
    const t = this.ctx.currentTime, p = inst.out.gain;
    fade = Math.max(0.03, fade);
    p.cancelScheduledValues(t);
    p.setValueAtTime(Math.max(EPS, p.value), t);
    p.exponentialRampToValueAtTime(EPS, t + fade);
    p.setValueAtTime(0, t + fade + 0.01);
    for (const s of inst.sources) { try { s.stop(t + fade + 0.05); } catch (e) {} }
    if (!this._offline) setTimeout(() => { try { inst.out.disconnect(); inst.send && inst.send.disconnect(); } catch (e) {} }, (fade + 1.5) * 1000);
  }

  /** Pump scheduled events. `untilAbs` (offline rendering) schedules everything up to that context time. */
  _schedule(untilAbs) {
    for (const h of this._seqs) this._pumpMusic(h, untilAbs);
    if (!this.ctx || (!this._offline && this.ctx.state !== 'running')) return;
    const now = this.ctx.currentTime;
    for (const inst of this._loops.values()) {
      if (inst.stopping) continue;
      const until = untilAbs ?? now + inst.ahead;
      for (const tk of inst.tickers) {
        if (tk.dead) continue;
        if (tk.next < now) tk.next = now + 0.02;
        let guard = 0;
        const max = untilAbs != null ? 200000 : 256;
        while (tk.next < until && guard++ < max) {
          try { tk.next = tk.fn(tk.next); } catch (e) { tk.dead = true; this._warnOnce('error', 'tick ' + inst.name, `[audio] loop ${inst.name}: ${e && e.message}`); break; }
        }
      }
    }
  }

  // ───────────────────────────────────────────────────────── public: room ambience

  /** Crossfade to the room's bed (DESIGN §9). A room without a bed is quiet (no warning). */
  setRoomAmbience(roomId) {
    this._room = roomId && ROOM_BEDS[roomId] ? roomId : null;
    this._applyRoom(ROOM_FADE);
  }

  _applyRoom(fade) {
    const bed = this._room ? ROOM_BEDS[this._room] : {};
    for (const name of [...this._roomLoops]) {
      if (!(name in bed)) this.stopLoop(name, fade);
    }
    for (const name in bed) {
      this.loop(name, { gain: bed[name], fade });
      this._roomLoops.add(name);
    }
  }

  // ───────────────────────────────────────────────────────── public: music

  /**
   * Play a pianola roll: 'empressMarch' (the 12 s overture cut, ends on its last chord) or a decoy: 'hymn',
   * 'lullaby', 'bishopsBicycle', 'tango', 'waltz'. o: { duration (cut it short: a wrong roll is 3 s), sour (before
   * tuning), gain, onEnd, onLastChord, onCue }. Returns a MusicHandle { stop(fade), progress, time, duration,
   * playing, done (Promise) }.
   */
  pianola(tune = 'empressMarch', o = {}) {
    const score = SCORES[tune];
    if (!score || tune === 'overture' || tune === 'burnOldLamp') {
      this._warnOnce('tune', tune);
      return this._startMusic(SCORES.silence, o);
    }
    return this._startMusic(score, { send: 0.18, lp: 4200, ...o });
  }

  _startMusic(score, opts = {}) {
    const ctx = this.ctx;
    const live = !!ctx && (this._offline || ctx.state === 'running');
    const h = new MusicHandle(this, score, opts, live);
    if (live) {
      const bus = ctx.createGain(); bus.gain.value = opts.gain ?? 1;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = opts.lp ?? 5200; lp.Q.value = 0.5;
      const s = ctx.createGain(); s.gain.value = opts.send ?? 0.22;
      lp.connect(bus); bus.connect(this._sfx); bus.connect(s); s.connect(this._revIn);
      h.in = lp; h.bus = bus; h.sendNode = s;
    }
    this._seqs.add(h);
    this._ensureSched();
    if (!this._offline) this._pumpMusic(h);
    return h;
  }

  _pumpMusic(h, untilAbs) {
    if (h.done) { this._seqs.delete(h); return; }
    const t = h.clock() - h.start;
    if (h.live && !h.stopped) {
      const until = untilAbs ?? (h.clock() + MUSIC_AHEAD);
      const ev = h.score.events;
      while (h.idx < ev.length && h.start + ev[h.idx].t < until) {
        const x = ev[h.idx++];
        if (x.t >= h.cut) { h.idx = ev.length; break; }
        try { this._playEvent(h, x, Math.max(h.start + x.t, this.ctx.currentTime + 0.004)); } catch (e) { this._warnOnce('error', 'music', `[audio] music: ${e && e.message}`); }
      }
    }
    if (this._offline) return;
    for (const k in h.score.cues) {
      if (!h.fired[k] && t >= h.score.cues[k] && h.score.cues[k] < h.cut) {
        h.fired[k] = true;
        try { h.opts.onCue?.(k); if (k === 'lastChord') h.opts.onLastChord?.(); } catch (e) { console.error(e); }
      }
    }
    if (t >= h.cut) this._endMusic(h, h.cut < h.score.dur ? 0.1 : 0.3, false);
  }

  _playEvent(h, x, time) {
    if (x.voice === 'fx') { x.fn(this, h.in, time); return; }
    const f = mtof(x.m);
    if (x.voice === 'box') { this._bell(h.in, f, time, 0.05 * x.v, 1.2, [1, 3.9, 9.3], [1, 0.12, 0.04]); return; }
    const det = h.opts.detune ? rand(-1, 1) * h.opts.detune : 0;
    this._piano(h.in, time, f, x.d, x.v, { detune: det, sour: h.opts.sour, ring: x.ring });
  }

  _endMusic(h, fade, stopped) {
    if (h.done) return;
    h.endedAt = Math.max(0, Math.min(h.cut, h.clock() - h.start));
    h.done = true; h.stopped = stopped;
    this._seqs.delete(h);
    if (h.bus && this.ctx) {
      const p = h.bus.gain, t = this.ctx.currentTime;
      p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(0, t + Math.max(0.02, fade));
      const bus = h.bus, s = h.sendNode;
      if (!this._offline) setTimeout(() => { try { bus.disconnect(); s.disconnect(); } catch (e) {} }, (fade + 3) * 1000);
    }
    try { if (!stopped) h.opts.onEnd?.(); } catch (e) { console.error(e); }
    h._resolve(!stopped);
  }

  // ───────────────────────────────────────────────────────── public: mute & metering

  setMuted(b) {
    this.muted = !!b;
    if (!this.ctx) return;
    const p = this._master.gain, t = this.ctx.currentTime;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.setTargetAtTime(this.muted ? 0 : 1, t, 0.08);
  }

  /** Peak absolute sample level at the output over the last ~45 ms (post-limiter). */
  getPeak() {
    if (!this.ctx) return 0;
    this._meter.getFloatTimeDomainData(this._meterBuf);
    let m = 0; const b = this._meterBuf;
    for (let i = 0; i < b.length; i++) { const v = b[i] < 0 ? -b[i] : b[i]; if (v > m) m = v; }
    return m;
  }

  dispose() {
    clearInterval(this._sched); this._sched = null;
    if (this.ctx && !this._offline) { try { this.ctx.close(); } catch (e) {} }
    this.ctx = null; this._loops.clear(); this._seqs.clear();
  }
}

// ═════════════════════════════════════════════════════════════ MUSIC HANDLES

class MusicHandle {
  constructor(engine, score, opts, live) {
    this._e = engine; this.score = score; this.opts = opts; this.live = live;
    const ctx = engine.ctx;
    this.clock = live ? () => ctx.currentTime : () => performance.now() / 1000;
    this.start = this.clock() + 0.06;
    this.cut = Math.min(score.dur, opts.duration ?? Infinity);
    this.idx = 0; this.fired = {}; this.done = false; this.stopped = false; this.endedAt = 0;
    this.done$ = new Promise((r) => { this._resolve = r; });
  }
  /** Resolves true at the natural end, false if stopped. */
  get promise() { return this.done$; }
  then(a, b) { return this.done$.then(a, b); }
  get duration() { return this.cut; }
  get playing() { return !this.done; }
  get time() { return this.done ? this.endedAt : clamp(this.clock() - this.start, 0, this.cut); }
  get progress() { return this.done && !this.stopped ? 1 : this.time / this.cut; }
  cueTime(name) { return this.score.cues[name]; }
  stop(fade = 0.4) { this._e._endMusic(this, fade, true); }
}

/**
 * audio.overture: The Empress March as a music-hall overture. play({ short, soft, gain, detune, onLastChord, onCue,
 * onEnd }) → Promise (true at the natural end). Full (~28.5 s): the march, a waltz middle, a storm, the march again
 * and the last chord (cue 'lastChord' at ~25.9 s; also 'waltz', 'storm', 'reprise'). short: the 12 s pianola cut
 * (last chord at 9.72 s). soft: the title-screen version (quiet, detuned, muffled). Read progress (0..1), time,
 * duration, playing, lastChordAt.
 */
class Overture {
  constructor(e) { this._e = e; this._h = null; }
  play(opts = {}) {
    this.stop(0.05);
    const soft = !!opts.soft;
    const score = opts.short ? SCORES.empressMarch : SCORES.overture;
    this._h = this._e._startMusic(score, {
      ...opts,
      gain: opts.gain ?? (soft ? 0.38 : 1),
      detune: opts.detune ?? (soft ? 16 : 3),
      lp: opts.lp ?? (soft ? 1900 : 5200),
      send: opts.send ?? (soft ? 0.4 : 0.22),
    });
    return this._h.promise;
  }
  stop(fade = 0.5) { if (this._h && !this._h.done) this._h.stop(fade); }
  get handle() { return this._h; }
  get playing() { return !!this._h && !this._h.done; }
  get time() { return this._h ? this._h.time : 0; }
  get progress() { return this._h ? this._h.progress : 0; }
  get duration() { return this._h ? this._h.duration : SCORES.overture.dur; }
  get lastChordAt() { return (this._h ? this._h.score : SCORES.overture).cues.lastChord; }
}

// ═════════════════════════════════════════════════════════════ SOUND HELPERS

const T = (e, out, o) => e._tone(out, o);
const N = (e, out, o) => e._noise(out, o);
function filt(e, type, f, Q = 0.7) { const b = e.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; return b; }
function gainNode(e, v) { const g = e.ctx.createGain(); g.gain.value = v; return g; }

function tick(e, out, t, p, peak) {
  N(e, out, { type: 'bandpass', f: 3200 * p, Q: 7, t, a: 0.001, peak, d: 0.018 });
  T(e, out, { type: 'triangle', f: 1400 * p, t, a: 0.001, peak: peak * 0.4, d: 0.025 });
  T(e, out, { f: 300 * p, t, a: 0.001, peak: peak * 0.4, d: 0.04 });
}
function creak(e, out, t, dur, f0, formant, peak) {
  const ctx = e.ctx, o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueCurveAtTime(e._roughCurve(40, f0 * 0.75, f0 * 1.35, 0.7), t, dur);
  bp.type = 'bandpass'; bp.frequency.value = formant; bp.Q.value = 5;
  e._env(g.gain, t, 0.08, peak, 0.2, Math.max(0, dur - 0.28));
  o.connect(bp); bp.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.1);
}
function thud(e, out, t, f, peak, d = 0.18, nf = 500) {
  T(e, out, { f, f2: f * 0.55, t, a: 0.003, peak, d });
  N(e, out, { kind: 'brown', type: 'lowpass', f: nf, t, a: 0.002, peak: peak * 0.8, d: d * 0.6 });
}
function clack(e, out, t, f, peak, d = 0.025, Q = 5) {
  N(e, out, { type: 'bandpass', f, Q, t, a: 0.001, peak, d });
  T(e, out, { type: 'triangle', f: f * 0.5, t, a: 0.001, peak: peak * 0.35, d: d * 1.5 });
}
function knock(e, out, t, f, peak) {
  N(e, out, { kind: 'pink', type: 'bandpass', f, Q: 6, t, a: 0.001, peak, d: 0.09 });
  T(e, out, { type: 'triangle', f, t, a: 0.001, peak: peak * 0.5, d: 0.07 });
}
function rattle(e, out, t, n, span, fLo, fHi, peak, Q = 6, d = 0.02) {
  for (let i = 0; i < n; i++) clack(e, out, t + span * (i / n) + rand(0, span / n * 0.6), rand(fLo, fHi), peak * rand(0.5, 1), d, Q);
}
function whoosh(e, out, t, dur, f1, f2, peak, kind = 'pink', Q = 1.2) {
  N(e, out, { kind, type: 'bandpass', f: f1, f2, glide: dur * 0.6, Q, t, a: dur * 0.45, peak, d: dur * 0.55 });
}
function rustle(e, out, t, dur, peak, fLo = 1500, fHi = 5000, density = 30) {
  const n = Math.max(3, (dur * density) | 0);
  for (let i = 0; i < n; i++) N(e, out, { type: 'bandpass', f: rand(fLo, fHi), Q: 1.4, t: t + rand(0, dur), a: 0.004, peak: peak * rand(0.4, 1), d: rand(0.02, 0.07) });
}
function crackle(e, out, t, dur, peak, f = 3500) {
  N(e, out, { type: 'highpass', f, Q: 0.7, t, a: 0.003, peak, hold: dur * 0.7, d: dur * 0.3, rough: [0, 1, 0.05, Math.max(16, (dur * 200) | 0)] });
}
function scratch(e, out, t, dur, peak, p = 1) {
  N(e, out, { type: 'bandpass', f: 3800 * p, Q: 2.5, t, a: 0.01, peak, hold: dur * 0.6, d: dur * 0.4, rough: [0.15, 1, 0.2, Math.max(8, (dur * 120) | 0)] });
}
function metal(e, out, t, f, peak, d) {
  e._bell(out, f, t, peak, d, [1, 1.47, 2.09, 2.56, 3.21], [1, 0.6, 0.45, 0.3, 0.2]);
  N(e, out, { type: 'bandpass', f: Math.min(9000, f * 3), Q: 2, t, a: 0.001, peak: peak * 0.5, d: 0.02 });
}
function link(e, out, t, f, peak) {
  e._bell(out, f, t, peak, 0.09, [1, 1.52], [1, 0.5]);
  N(e, out, { type: 'bandpass', f: f * 1.7, Q: 4, t, a: 0.001, peak: peak * 0.6, d: 0.012 });
}
function glass(e, out, t, f, peak, d) {
  T(e, out, { f, t, a: 0.002, peak, d });
  T(e, out, { f: f * 2.32, t, a: 0.002, peak: peak * 0.35, d: d * 0.45 });
  T(e, out, { f: f * 4.25, t, a: 0.002, peak: peak * 0.15, d: d * 0.22 });
  N(e, out, { type: 'highpass', f: 6000, t, a: 0.001, peak: peak * 0.15, d: 0.01 });
}
function hum(e, out, t, f, a, hold, d, peak, lpF = 400) {
  const lp = filt(e, 'lowpass', lpF, 0.8); lp.connect(out);
  T(e, lp, { type: 'sawtooth', f, t, a, hold, d, peak });
}
function clap(e, out, t, p, peak) {
  N(e, out, { type: 'bandpass', f: rand(1000, 1800) * p, Q: 1.1, t, a: 0.001, peak, d: rand(0.04, 0.07) });
  N(e, out, { kind: 'pink', type: 'lowpass', f: 600, t, a: 0.001, peak: peak * 0.4, d: 0.03 });
}
function applauseSwell(e, out, t, dur, amp, p = 1) {
  const ctx = e.ctx, src = ctx.createBufferSource();
  src.buffer = e._buf('applause'); src.loop = true; src.playbackRate.value = p;
  const bp = filt(e, 'bandpass', 1500 * p, 0.55), lp = filt(e, 'lowpass', 5200, 0.7), g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.75 * amp, t + 1.2);
  g.gain.setTargetAtTime(0.6 * amp, t + 1.2, 0.8);
  g.gain.setTargetAtTime(0, t + Math.max(1.4, dur - 1.6), 0.5);
  src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(out);
  src.start(t, Math.random() * 2); src.stop(t + dur + 0.3);
  for (let i = 0; i < 10; i++) clap(e, out, t + rand(0.2, dur * 0.6), p, rand(0.04, 0.09) * amp);
}
function electricBell(e, out, t, dur, p) {
  const ctx = e.ctx, am = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), env = ctx.createGain();
  am.gain.value = 0.5; lfo.type = 'square'; lfo.frequency.value = 24; lg.gain.value = 0.5;
  lfo.connect(lg); lg.connect(am.gain);
  e._env(env.gain, t, 0.005, 0.15, 0.7, dur);
  [1, 2.76, 5.4].forEach((r, i) => {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.frequency.value = 1350 * r * p; og.gain.value = [1, 0.4, 0.15][i];
    o.connect(og); og.connect(am); o.start(t); o.stop(t + dur + 0.8);
  });
  N(e, am, { type: 'bandpass', f: 3500, Q: 1.5, t, a: 0.005, peak: 0.25, hold: dur, d: 0.05 });
  am.connect(env); env.connect(out);
  lfo.start(t); lfo.stop(t + dur);
}
function danceBand(e, dest, t0) {
  const beat = 0.42, eighth = beat / 2;
  const bass = ['F2', 'C3', 'F2', 'C3', 'C3', 'G2', 'F2'];
  bass.forEach((n, i) => T(e, dest, { type: 'triangle', f: mtof(midi(n)), t: t0 + i * beat, a: 0.005, peak: 0.16, d: 0.3 }));
  [1, 3, 5].forEach((i) => {
    const ch = i < 4 ? [65, 69, 72] : [64, 67, 70];
    ch.forEach((m) => T(e, dest, { type: 'square', f: mtof(m), t: t0 + i * beat, a: 0.005, peak: 0.018, d: 0.12 }));
  });
  for (let i = 0; i < 7; i++) N(e, dest, { type: 'bandpass', f: 3500, Q: 0.8, t: t0 + i * beat, a: 0.01, peak: 0.04, d: 0.12 });
  let t = t0;
  for (const tok of 'C5:1 D5:1 F5:2 A5:2 G5:1 F5:1 D5:2 C5:2 F5:2'.split(' ')) {
    const [n, u] = tok.split(':'), d = +u * eighth;
    T(e, dest, { type: 'square', f: mtof(midi(n)), t, a: 0.02, peak: 0.035, hold: d * 0.6, d: d * 0.3, vib: [5.5, 15] });
    t += d;
  }
}

// ═════════════════════════════════════════════════════════════ ONE-SHOTS
// fn(engine, t, pitch, out, opts). `send` = reverb send, `life` = seconds until cleanup (or fn(opts)), `gap` =
// minimum seconds between repeats (tick-like sounds), `prio` = plays even at the voice cap. `special(engine, opts)`
// replaces the whole call (music).

const SFX = {
  // ── UI ─────────────────────────────────────────────
  click: { life: 0.3, fn(e, t, p, out) {
    T(e, out, { type: 'triangle', f: 1050 * p, f2: 620 * p, glide: 0.04, t, a: 0.002, peak: 0.22, d: 0.05 });
    N(e, out, { type: 'bandpass', f: 2800 * p, Q: 4, t, a: 0.001, peak: 0.09, d: 0.018 });
  } },
  hover: { life: 0.2, gap: 0.04, fn(e, t, p, out) {
    T(e, out, { f: 1900 * p, f2: 2100 * p, t, a: 0.008, peak: 0.05, d: 0.04 });
  } },
  pickup: { life: 0.5, fn(e, t, p, out) {
    N(e, out, { type: 'bandpass', f: 900, f2: 2600, Q: 1.2, t, a: 0.03, peak: 0.06, d: 0.12 });
    T(e, out, { type: 'triangle', f: 659 * p, t: t + 0.02, a: 0.004, peak: 0.13, d: 0.12 });
    T(e, out, { type: 'triangle', f: 880 * p, t: t + 0.09, a: 0.004, peak: 0.13, d: 0.2 });
  } },
  drop: { life: 0.5, fn(e, t, p, out) {
    T(e, out, { f: 190 * p, f2: 85 * p, t, a: 0.003, peak: 0.3, d: 0.16 });
    N(e, out, { kind: 'pink', type: 'lowpass', f: 700, Q: 0.7, t, a: 0.002, peak: 0.18, d: 0.08 });
  } },
  select: { life: 0.5, fn(e, t, p, out) {
    T(e, out, { f: 784 * p, t, a: 0.004, peak: 0.12, d: 0.15 });
    T(e, out, { f: 1175 * p, t: t + 0.05, a: 0.004, peak: 0.1, d: 0.2 });
  } },
  error: { life: 0.6, fn(e, t, p, out) {
    const lp = filt(e, 'lowpass', 650, 0.8); lp.connect(out);
    for (let i = 0; i < 2; i++) {
      const tt = t + i * 0.13;
      T(e, lp, { type: 'square', f: 138 * p, t: tt, a: 0.01, peak: 0.08, hold: 0.05, d: 0.05 });
      T(e, lp, { type: 'square', f: 141 * p, t: tt, a: 0.01, peak: 0.06, hold: 0.05, d: 0.05 });
    }
  } },
  success: { send: 0.45, life: 2.6, fn(e, t, p, out) {
    e._bell(out, 784 * p, t, 0.11, 1.4, [1, 2.0, 3.01, 4.1], [1, 0.3, 0.1, 0.04]);
    e._bell(out, 1046.5 * p, t + 0.14, 0.12, 1.9, [1, 2.0, 3.01, 4.1], [1, 0.3, 0.1, 0.04]);
  } },
  unlock: { send: 0.4, life: 2.8, fn(e, t, p, out) {
    T(e, out, { f: 110 * p, f2: 48 * p, t, a: 0.003, peak: 0.38, d: 0.28 });
    N(e, out, { kind: 'brown', type: 'lowpass', f: 500, t, a: 0.002, peak: 0.35, d: 0.12 });
    N(e, out, { type: 'bandpass', f: 1600, Q: 5, t, a: 0.001, peak: 0.12, d: 0.03 });
    N(e, out, { type: 'bandpass', f: 1200, Q: 5, t: t + 0.07, a: 0.001, peak: 0.09, d: 0.03 });
    [2093, 2637, 3136, 3951, 4186].forEach((f, i) => T(e, out, { f: f * p, t: t + 0.12 + i * 0.05, a: 0.02, peak: 0.035, d: 0.9 }));
  } },
  page: { life: 0.5, fn(e, t, p, out) {
    N(e, out, { type: 'bandpass', f: 1800 * p, f2: 4200 * p, Q: 1.4, t, a: 0.04, peak: 0.2, d: 0.16, rough: [0.25, 1, 0.3, 24] });
  } },
  journalTick: { send: 0.3, life: 1.6, fn(e, t, p, out) {
    scratch(e, out, t, 0.16, 0.09, p);
    e._bell(out, 1760 * p, t + 0.17, 0.06, 1.1, [1, 2.76, 5.4], [1, 0.3, 0.1]);
  } },
  cueLightGreen: { send: 0.35, life: 1.6, fn(e, t, p, out) {
    clack(e, out, t, 3000 * p, 0.04, 0.01, 5);
    e._bell(out, 1568 * p, t + 0.01, 0.07, 1.3, [1, 2.76, 5.4], [1, 0.25, 0.08]);
  } },
  chime: { send: 0.55, life: 3, fn(e, t, p, out) {
    e._bell(out, 1318.5 * p, t, 0.13, 2.2);
    e._bell(out, 1975.5 * p, t + 0.11, 0.07, 1.8);
  } },
  curtainSwish: { send: 0.3, life: 1.8, fn(e, t, p, out) {
    N(e, out, { kind: 'pink', type: 'bandpass', f: 220 * p, f2: 900 * p, glide: 0.6, Q: 0.9, t, a: 0.35, peak: 0.35, hold: 0.15, d: 0.75 });
    N(e, out, { type: 'bandpass', f: 2400 * p, Q: 1, t: t + 0.05, a: 0.3, peak: 0.035, hold: 0.2, d: 0.6, rough: [0.3, 1, 0.3, 40] });
    thud(e, out, t + 1.05, 70 * p, 0.08, 0.2, 300);
  } },
  doorOpen: { life: 2, fn(e, t, p, out) {
    creak(e, out, t, 1.2, 110 * p, 900 * p, 0.17);
    N(e, out, { kind: 'pink', type: 'lowpass', f: 300, f2: 900, t: t + 0.2, a: 0.4, peak: 0.12, d: 0.8 });
  } },

  // ── Door (stage door and green room) ──────────────
  doorSlam: { send: 0.5, life: 2.5, prio: true, fn(e, t, p, out) {
    thud(e, out, t, 75 * p, 0.7, 0.45, 900);
    N(e, out, { type: 'bandpass', f: 1400 * p, Q: 1.2, t, a: 0.001, peak: 0.25, d: 0.06 });
    rattle(e, out, t + 0.05, 7, 0.35, 900, 2600, 0.07, 5);
    T(e, out, { f: 48 * p, t, a: 0.004, peak: 0.35, d: 0.6 });
  } },
  keyTurn: { life: 0.6, fn(e, t, p, out) {
    N(e, out, { type: 'bandpass', f: 3600 * p, Q: 10, t, a: 0.001, peak: 0.16, d: 0.03 });
    T(e, out, { f: 2300 * p, t, a: 0.001, peak: 0.04, d: 0.06 });
    N(e, out, { type: 'bandpass', f: 2400 * p, Q: 8, t: t + 0.13, a: 0.001, peak: 0.2, d: 0.04 });
    T(e, out, { f: 1500 * p, t: t + 0.13, a: 0.001, peak: 0.05, d: 0.08 });
    T(e, out, { f: 220 * p, f2: 150 * p, t: t + 0.13, a: 0.002, peak: 0.1, d: 0.05 });
  } },
  latch: { life: 0.5, fn(e, t, p, out) {
    clack(e, out, t, 2600 * p, 0.16);
    clack(e, out, t + 0.09, 1700 * p, 0.2);
    T(e, out, { f: 320 * p, f2: 180 * p, t: t + 0.09, a: 0.002, peak: 0.08, d: 0.06 });
  } },
  hutchDoor: { life: 1.8, fn(e, t, p, out) {
    clack(e, out, t, 1900 * p, 0.1);
    creak(e, out, t + 0.05, 1.0, 130 * p, 1000 * p, 0.12);
    knock(e, out, t + 1.1, 180 * p, 0.18);
  } },
  coinDrop: { send: 0.25, life: 1.5, fn(e, t, p, out) {
    e._bell(out, 3100 * p, t, 0.07, 0.35, [1, 1.6, 2.3], [1, 0.5, 0.3]);
    rattle(e, out, t + 0.06, 5, 0.32, 2800, 5200, 0.05, 8, 0.015);
    e._bell(out, 2400 * p, t + 0.42, 0.06, 0.5, [1, 1.6, 2.3], [1, 0.5, 0.3]);
    thud(e, out, t + 0.42, 240 * p, 0.06, 0.06, 1200);
  } },
  meterCrank: { life: 0.4, gap: 0.03, fn(e, t, p, out) {
    clack(e, out, t, 2300 * p * rand(0.95, 1.05), 0.22, 0.02, 7);
    T(e, out, { type: 'triangle', f: 420 * p, f2: 300 * p, t, a: 0.001, peak: 0.05, d: 0.04 });
  } },
  meterOn: { send: 0.2, life: 2.6, fn(e, t, p, out) {
    thud(e, out, t, 110 * p, 0.3, 0.14, 700);
    clack(e, out, t, 1500 * p, 0.18, 0.03, 4);
    hum(e, out, t + 0.05, 50 * p, 0.6, 0.5, 1.2, 0.14, 380);
    hum(e, out, t + 0.05, 100 * p, 0.6, 0.5, 1.2, 0.06, 600);
  } },
  comboWheel: { life: 0.3, gap: 0.025, fn(e, t, p, out) {
    clack(e, out, t, 3400 * p * rand(0.97, 1.03), 0.18, 0.015, 9);
    T(e, out, { f: 1700 * p, t, a: 0.001, peak: 0.04, d: 0.03 });
  } },
  cabinetOpen: { send: 0.2, life: 1.4, fn(e, t, p, out) {
    clack(e, out, t, 2200 * p, 0.08);
    creak(e, out, t + 0.03, 0.55, 240 * p, 1500 * p, 0.07);
    glass(e, out, t + 0.12, 2900 * p, 0.03, 0.4);
    glass(e, out, t + 0.2, 3500 * p, 0.02, 0.3);
  } },
  penScratch: { life: 1.6, fn(e, t, p, out) {
    let tt = t;
    for (let i = 0; i < 4; i++) { const d = rand(0.12, 0.26); scratch(e, out, tt, d, 0.07, p * rand(0.9, 1.15)); tt += d + rand(0.03, 0.08); }
  } },
  passDoorSwing: { send: 0.3, life: 3.2, fn(e, t, p, out) {
    clack(e, out, t, 1500 * p, 0.08);
    creak(e, out, t + 0.05, 2.1, 70 * p, 700 * p, 0.14);
    N(e, out, { kind: 'pink', type: 'lowpass', f: 250, f2: 700, t: t + 0.4, a: 0.8, peak: 0.08, d: 1.2 });
  } },
  kettleBoil: { life: (o) => (o.dur ?? 8) + 0.6, fn(e, t, p, out, o) {
    const dur = o.dur ?? 8;
    N(e, out, { kind: 'brown', type: 'lowpass', f: 200, f2: 900, glide: dur, Q: 0.8, t, a: dur * 0.9, peak: 0.22, d: 0.4 });
    N(e, out, { type: 'bandpass', f: 1200, f2: 3200, glide: dur, Q: 1.2, t, a: dur * 0.95, peak: 0.035, d: 0.3, rough: [0.3, 1, 0.3, 80] });
    let tt = t + 0.6;
    while (tt < t + dur) {
      const k = (tt - t) / dur, f = rand(250, 700) * (1 + k * 0.6) * p;
      T(e, out, { f, f2: f * rand(1.5, 2.2), glide: 0.04, t: tt, a: 0.003, peak: 0.03 + 0.05 * k, d: 0.04 });
      tt += rand(0.35, 0.8) * (1 - k * 0.85) + 0.02;
    }
  } },
  kettleWhistle: { send: 0.15, life: (o) => (o.dur ?? 3) + 0.6, fn(e, t, p, out, o) {
    const dur = Math.max(1, o.dur ?? 3);
    T(e, out, { f: 1500 * p, f2: 2350 * p, glide: 0.9, t, a: 0.5, peak: 0.09, hold: dur - 0.9, d: 0.4, vib: [7, 25] });
    T(e, out, { f: 3000 * p, f2: 4700 * p, glide: 0.9, t, a: 0.5, peak: 0.018, hold: dur - 0.9, d: 0.4 });
    N(e, out, { type: 'bandpass', f: 2400 * p, Q: 3, t, a: 0.4, peak: 0.04, hold: dur - 0.8, d: 0.4 });
  } },
  kettle: { send: 0.1, life: 12.5, fn(e, t, p, out) {
    SFX.kettleBoil.fn(e, t, p, out, { dur: 8 });
    SFX.kettleWhistle.fn(e, t + 7.6, p, out, { dur: 3.5 });
  } },
  wireless: { send: 0.1, life: 5, fn(e, t, p, out) {
    const hp = filt(e, 'highpass', 450, 0.7), lp = filt(e, 'lowpass', 2600, 0.7);
    hp.connect(lp); lp.connect(out);
    N(e, out, { type: 'bandpass', f: 2200, Q: 0.5, t, a: 0.05, peak: 0.09, hold: 0.7, d: 0.25, rough: [0.2, 1, 0.2, 40] });
    T(e, out, { f: 2600, f2: 700, glide: 0.8, t: t + 0.1, a: 0.1, peak: 0.025, hold: 0.5, d: 0.2 });
    N(e, out, { type: 'bandpass', f: 2200, Q: 0.5, t: t + 0.9, a: 0.1, peak: 0.018, hold: 3, d: 0.4, rough: [0.4, 1, 0.3, 50] });
    danceBand(e, hp, t + 0.95);
  } },
  sofaSpring: { life: 1.4, fn(e, t, p, out) {
    T(e, out, { type: 'triangle', f: 190 * p, f2: 150 * p, t, a: 0.004, peak: 0.12, d: 0.9, vib: [28, 180, true] });
    T(e, out, { f: 380 * p, t, a: 0.004, peak: 0.03, d: 0.4, vib: [28, 180, true] });
    creak(e, out, t, 0.5, 160 * p, 900 * p, 0.05);
    N(e, out, { kind: 'pink', type: 'lowpass', f: 400, t, a: 0.05, peak: 0.1, d: 0.4 });
  } },

  // ── Stage ──────────────────────────────────────────
  dipSpark: { send: 0.15, life: 0.8, fn(e, t, p, out) {
    crackle(e, out, t, 0.28, 0.22, 3000 * p);
    T(e, out, { type: 'sawtooth', f: 900 * p, f2: 120 * p, glide: 0.15, t, a: 0.002, peak: 0.08, d: 0.15 });
    clack(e, out, t, 4200 * p, 0.15, 0.01, 3);
  } },
  plugIn: { life: 0.6, fn(e, t, p, out) {
    N(e, out, { type: 'bandpass', f: 900 * p, Q: 1.5, t, a: 0.02, peak: 0.06, d: 0.06 });
    clack(e, out, t + 0.07, 1300 * p, 0.2, 0.03, 3);
    thud(e, out, t + 0.07, 160 * p, 0.14, 0.08, 700);
  } },
  bulbWarm: { send: 0.35, life: 2.4, fn(e, t, p, out) {
    glass(e, out, t, 3300 * p, 0.05, 0.6);
    T(e, out, { f: 6600 * p, t, a: 0.001, peak: 0.012, d: 0.15 });
    hum(e, out, t + 0.05, 100 * p, 0.5, 0.6, 0.9, 0.05, 300);
    N(e, out, { type: 'bandpass', f: 180 * p, Q: 2, t: t + 0.05, a: 0.6, peak: 0.03, hold: 0.5, d: 0.8 });
  } },
  filamentPing: { send: 0.35, life: 1, fn(e, t, p, out) {
    glass(e, out, t, 3300 * p, 0.05, 0.6);
    T(e, out, { f: 6600 * p, t, a: 0.001, peak: 0.012, d: 0.15 });
  } },
  ghostShimmer: { send: 0.65, life: 3, fn(e, t, p, out) {
    [1046.5, 1318.5, 1568, 1975.5, 2349, 2637, 3136].forEach((f, i) => glass(e, out, t + i * 0.065, f * p, 0.045 * (1 - i * 0.06), 1.3));
    N(e, out, { type: 'highpass', f: 3000, f2: 7000, glide: 0.8, Q: 0.6, t, a: 0.4, peak: 0.035, d: 0.9 });
  } },
  fuseSeat: { life: 0.6, fn(e, t, p, out) {
    N(e, out, { type: 'bandpass', f: 420 * p, Q: 4, t, a: 0.001, peak: 0.4, d: 0.07 });
    T(e, out, { f: 560 * p, f2: 420 * p, t, a: 0.001, peak: 0.1, d: 0.06 });
    clack(e, out, t + 0.005, 2700 * p, 0.12, 0.015, 6);
  } },
  knifeSwitch: { send: 0.25, life: 1.4, fn(e, t, p, out) {
    clack(e, out, t, 1700 * p, 0.32, 0.04, 3);
    thud(e, out, t, 130 * p, 0.25, 0.1, 900);
    crackle(e, out, t + 0.02, 0.3, 0.15, 2500 * p);
    T(e, out, { type: 'sawtooth', f: 100 * p, t: t + 0.03, a: 0.01, peak: 0.05, hold: 0.2, d: 0.3 });
  } },
  workLights: { send: 0.4, life: 2.6, fn(e, t, p, out) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.45;
      thud(e, out, tt, (95 - i * 8) * p, 0.32, 0.18, 800);
      clack(e, out, tt, 1200 * p, 0.18, 0.04, 3);
      hum(e, out, tt + 0.02, 100 * p, 0.05, 0.2, 0.4, 0.03, 300);
    }
  } },
  leverNotch: { life: 0.3, gap: 0.03, fn(e, t, p, out) {
    clack(e, out, t, 1900 * p, 0.22, 0.02, 6);
    T(e, out, { f: 700 * p, f2: 500 * p, t, a: 0.001, peak: 0.08, d: 0.04 });
  } },
  dimmerGo: { send: 0.4, life: 4, fn(e, t, p, out) {
    hum(e, out, t, 100 * p, 2.2, 0.3, 1.2, 0.07, 1600);
    const lp = filt(e, 'lowpass', 2200, 0.7); lp.connect(out);
    [130.8, 196, 261.6, 329.6, 392].forEach((f, i) => T(e, lp, { type: 'triangle', f: f * p, t: t + i * 0.15, a: 2.2, peak: 0.05, hold: 0.3, d: 1.2 }));
    N(e, out, { kind: 'pink', type: 'bandpass', f: 300, f2: 2500, glide: 2.4, Q: 0.8, t, a: 2.3, peak: 0.06, d: 0.9 });
  } },
  weightClank: { send: 0.3, life: 1.6, fn(e, t, p, out) {
    metal(e, out, t, 310 * p, 0.18, 1.0);
    thud(e, out, t, 120 * p, 0.2, 0.1, 800);
    metal(e, out, t + 0.11, 420 * p, 0.07, 0.6);
  } },
  ropeLock: { life: 0.6, fn(e, t, p, out) {
    knock(e, out, t, 520 * p, 0.22);
    clack(e, out, t + 0.04, 2400 * p, 0.16, 0.02, 6);
    thud(e, out, t + 0.04, 180 * p, 0.1, 0.06);
  } },
  ropeHaul: { send: 0.25, life: 1.0, gap: 0.08, fn(e, t, p, out) {
    creak(e, out, t, 0.5, rand(180, 240) * p, 1300 * p, 0.09);
    N(e, out, { kind: 'pink', type: 'bandpass', f: 700 * p, Q: 1.2, t, a: 0.1, peak: 0.06, hold: 0.15, d: 0.2 });
    T(e, out, { f: 1900 * p, f2: 2300 * p, t: t + 0.15, a: 0.05, peak: 0.012, d: 0.2 });
  } },
  ropeRun: { send: 0.35, life: 2.4, fn(e, t, p, out) {
    N(e, out, { kind: 'pink', type: 'bandpass', f: 500 * p, f2: 2600 * p, glide: 0.8, Q: 1.6, t, a: 0.15, peak: 0.22, hold: 0.6, d: 0.25 });
    T(e, out, { type: 'sawtooth', f: 60 * p, f2: 240 * p, glide: 0.8, t, a: 0.1, peak: 0.04, hold: 0.6, d: 0.2 });
    rattle(e, out, t + 1.0, 10, 0.5, 500, 2200, 0.16, 3, 0.04);
    thud(e, out, t + 1.0, 85 * p, 0.4, 0.3, 900);
  } },
  sandbagThud: { send: 0.35, life: 1.5, fn(e, t, p, out) {
    thud(e, out, t, 62 * p, 0.6, 0.35, 600);
    N(e, out, { type: 'lowpass', f: 3500, f2: 900, Q: 0.6, t, a: 0.002, peak: 0.12, d: 0.35 });
    N(e, out, { type: 'highpass', f: 2500, t: t + 0.05, a: 0.05, peak: 0.025, d: 0.5 });
  } },
  bosunWhistle: { send: 0.3, life: 1.8, fn(e, t, p, out) {
    T(e, out, { f: 1750 * p, f2: 2650 * p, glide: 0.35, t, a: 0.06, peak: 0.12, hold: 0.55, d: 0.15, vib: [16, 60] });
    T(e, out, { f: 2650 * p, f2: 1900 * p, glide: 0.4, t: t + 0.85, a: 0.02, peak: 0.1, hold: 0.2, d: 0.25 });
    N(e, out, { type: 'bandpass', f: 2400 * p, Q: 2, t, a: 0.05, peak: 0.03, hold: 1.0, d: 0.2 });
  } },
  truckRoll: { send: 0.25, life: (o) => (o.dur ?? 1.6) + 0.5, fn(e, t, p, out, o) {
    const dur = Math.max(0.8, o.dur ?? 1.6);
    N(e, out, { kind: 'brown', type: 'lowpass', f: 220 * p, Q: 1, t, a: 0.25, peak: 0.35, hold: dur - 0.6, d: 0.35, rough: [0.5, 1, 0.6, 40] });
    N(e, out, { type: 'bandpass', f: 900 * p, Q: 4, t, a: 0.2, peak: 0.025, hold: dur - 0.6, d: 0.3, rough: [0, 1, 0.4, 30] });
    for (let i = 0; i < 3; i++) T(e, out, { f: rand(1800, 2600) * p, f2: rand(1500, 2800) * p, t: t + rand(0.2, dur - 0.3), a: 0.03, peak: 0.012, d: 0.15 });
  } },
  truckTurn: { life: 1.2, fn(e, t, p, out) {
    creak(e, out, t, 0.6, 420 * p, 2200 * p, 0.05);
    N(e, out, { kind: 'brown', type: 'lowpass', f: 200, Q: 1, t, a: 0.1, peak: 0.25, hold: 0.4, d: 0.2 });
    clack(e, out, t + 0.7, 900 * p, 0.1, 0.03, 3);
  } },
  spikeSnap: { life: 0.5, fn(e, t, p, out) {
    clack(e, out, t, 2900 * p, 0.2, 0.012, 4);
    thud(e, out, t, 140 * p, 0.16, 0.08, 900);
    e._bell(out, 1400 * p, t, 0.02, 0.2, [1, 2.4], [1, 0.4]);
  } },
  trapdoorBang: { send: 0.45, life: 2, fn(e, t, p, out) {
    for (const [dt, a] of [[0, 1], [0.65, 0.8]]) {
      thud(e, out, t + dt, 78 * p, 0.55 * a, 0.3, 700);
      knock(e, out, t + dt, 210 * p, 0.22 * a);
      rattle(e, out, t + dt + 0.03, 4, 0.15, 600, 1800, 0.05 * a, 4);
    }
    N(e, out, { type: 'highpass', f: 3000, t: t + 0.7, a: 0.2, peak: 0.02, d: 0.8 });
  } },

  // ── Wardrobe ───────────────────────────────────────
  rackSlide: { life: 1.1, fn(e, t, p, out) {
    N(e, out, { type: 'bandpass', f: 2600 * p, Q: 3, t, a: 0.05, peak: 0.04, hold: 0.45, d: 0.15, rough: [0.2, 1, 0.3, 30] });
    for (let i = 0; i < 9; i++) e._bell(out, rand(2200, 3600) * p, t + i * rand(0.05, 0.09), rand(0.02, 0.04), 0.18, [1, 2.7], [1, 0.4]);
    rustle(e, out, t, 0.6, 0.025, 700, 2400, 18);
  } },
  fabricRustle: { life: 1.1, fn(e, t, p, out, o) {
    const dur = o.dur ?? 0.7;
    N(e, out, { kind: 'pink', type: 'bandpass', f: 1300 * p, Q: 0.7, t, a: 0.1, peak: 0.08, hold: dur * 0.5, d: dur * 0.4, rough: [0.2, 1, 0.35, 30] });
    rustle(e, out, t, dur, 0.035, 900, 3200, 22);
  } },
  squeak: { life: 0.8, fn(e, t, p, out) {
    const ctx = e.ctx, o = ctx.createOscillator(), bp = filt(e, 'bandpass', 1600 * p, 3), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(700 * p, t);
    o.frequency.exponentialRampToValueAtTime(1350 * p, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(980 * p, t + 0.32);
    o.frequency.exponentialRampToValueAtTime(1500 * p, t + 0.48);
    e._env(g.gain, t, 0.02, 0.22, 0.12, 0.38);
    o.connect(bp); bp.connect(g); g.connect(out); o.start(t); o.stop(t + 0.6);
    N(e, out, { type: 'bandpass', f: 2500, Q: 2, t, a: 0.02, peak: 0.03, hold: 0.35, d: 0.1 });
  } },
  costumeSigh: { send: 0.35, life: 1.8, fn(e, t, p, out) {
    N(e, out, { kind: 'pink', type: 'bandpass', f: 1100 * p, f2: 380 * p, glide: 1.2, Q: 1.6, t, a: 0.35, peak: 0.2, d: 0.95 });
    N(e, out, { type: 'bandpass', f: 2600 * p, f2: 1200 * p, glide: 1.2, Q: 3, t, a: 0.3, peak: 0.03, d: 0.9 });
  } },
  wigTurn: { life: 0.8, fn(e, t, p, out) {
    creak(e, out, t, 0.45, 300 * p, 1700 * p, 0.05);
    clack(e, out, t + 0.47, 2200 * p, 0.05, 0.02, 6);
  } },
  chalkRub: { life: 1.3, fn(e, t, p, out) {
    for (let i = 0; i < 5; i++) N(e, out, { type: 'bandpass', f: rand(2600, 3800) * p, Q: 2.5, t: t + i * 0.2, a: 0.02, peak: 0.09, hold: 0.1, d: 0.06, rough: [0.2, 1, 0.1, 24] });
  } },
  hatboxTopple: { send: 0.3, life: 2.6, fn(e, t, p, out) {
    let tt = t;
    for (let i = 0; i < 7; i++) {
      const f = rand(150, 260) * p;
      knock(e, out, tt, f, rand(0.14, 0.24));
      thud(e, out, tt, f * 0.5, 0.12, 0.1, 500);
      N(e, out, { kind: 'pink', type: 'bandpass', f: 800, Q: 1.5, t: tt, a: 0.002, peak: 0.05, d: 0.05 });
      tt += rand(0.09, 0.3);
    }
  } },
  oilSquirt: { life: 0.9, fn(e, t, p, out) {
    for (const dt of [0, 0.28]) {
      e._bell(out, 1800 * p, t + dt, 0.035, 0.12, [1, 1.9], [1, 0.4]);
      N(e, out, { type: 'bandpass', f: 1500 * p, f2: 700 * p, Q: 2, t: t + dt + 0.01, a: 0.01, peak: 0.12, d: 0.12 });
      T(e, out, { f: 600 * p, f2: 300 * p, t: t + dt + 0.02, a: 0.005, peak: 0.04, d: 0.06 });
    }
  } },
  machineSqueal: { life: 1.2, fn(e, t, p, out) {
    creak(e, out, t, 0.8, 480 * p, 1500 * p, 0.14);
    creak(e, out, t, 0.8, 720 * p, 2600 * p, 0.05);
    clack(e, out, t + 0.82, 1100 * p, 0.12, 0.03, 3);
  } },
  metronome: { send: 0.15, life: 1.2, fn(e, t, p, out, o) {
    knock(e, out, t, 1250 * p, 0.32);
    clack(e, out, t, 3200 * p, 0.12, 0.01, 8);
    if (o.accent) e._bell(out, 2093 * p, t + 0.005, 0.09, 0.9, [1, 2.76, 5.4], [1, 0.35, 0.12]);
  } },
  treadle: { life: 0.7, fn(e, t, p, out) {
    thud(e, out, t, 110 * p, 0.16, 0.08, 600);
    for (let i = 0; i < 6; i++) {
      clack(e, out, t + 0.02 + i * 0.06, (1800 + rand(-200, 200)) * p, 0.07, 0.012, 6);
      T(e, out, { type: 'triangle', f: 330 * p, t: t + 0.02 + i * 0.06, a: 0.002, peak: 0.025, d: 0.03 });
    }
  } },
  threadSnap: { life: 0.6, fn(e, t, p, out) {
    T(e, out, { type: 'triangle', f: 1300 * p, f2: 2300 * p, glide: 0.05, t, a: 0.002, peak: 0.09, d: 0.12 });
    clack(e, out, t, 5200 * p, 0.1, 0.008, 3);
  } },
  lensClink: { send: 0.35, life: 2, fn(e, t, p, out, o) {
    const size = o.size ?? [22, 19, 16, 13, 10][clamp(Math.round(o.n ?? 3), 1, 5) - 1];
    glass(e, out, t, 1800 * (22 / size) * p, 0.08, 1.0);
    clack(e, out, t, 5000, 0.03, 0.006, 4);
  } },
  lensSlide: { send: 0.3, life: 1.6, fn(e, t, p, out) {
    N(e, out, { type: 'bandpass', f: 3200 * p, f2: 1600 * p, Q: 6, t, a: 0.05, peak: 0.03, hold: 0.4, d: 0.2 });
    [10, 13, 16, 19, 22].forEach((s, i) => glass(e, out, t + 0.12 + i * 0.11, 1800 * (22 / s) * p * 0.98, 0.04, 0.5));
  } },
  dummyDress: { send: 0.3, life: 1.8, fn(e, t, p, out) {
    SFX.fabricRustle.fn(e, t, p, out, { dur: 0.8 });
    SFX.costumeSigh.fn(e, t + 0.45, p * 1.1, out);
  } },

  // ── Pit and trap room ─────────────────────────────
  tuningFork: { send: 0.25, life: 6.8, fn(e, t, p, out) {
    T(e, out, { f: 435 * p, t, a: 0.004, peak: 0.12, d: 6 });
    T(e, out, { f: 435 * 6.27 * p, t, a: 0.001, peak: 0.02, d: 0.12 });
    clack(e, out, t, 2800, 0.04, 0.01, 4);
  } },
  pianoString: { send: 0.25, life: 3.6, fn(e, t, p, out, o) {
    const f = 435 * Math.pow(2, (o.cents ?? 0) / 1200) * p;
    e._piano(out, t, f, 3.0, 0.9, { chorus: 0.5, ring: 3.2 });
    T(e, out, { f: 435 * p, t, a: 0.01, peak: 0.05, d: 3.0 });
  } },
  pinTurn: { life: 0.4, gap: 0.03, fn(e, t, p, out) {
    creak(e, out, t, 0.14, 520 * p, 2400 * p, 0.06);
    clack(e, out, t + 0.12, 2600 * p, 0.06, 0.012, 7);
  } },
  rollUnspool: { life: 1.2, fn(e, t, p, out) {
    N(e, out, { type: 'bandpass', f: 2400 * p, Q: 1.2, t, a: 0.08, peak: 0.06, hold: 0.5, d: 0.2, rough: [0.3, 1, 0.3, 30] });
    rattle(e, out, t, 8, 0.7, 1500, 2600, 0.03, 8, 0.01);
  } },
  rollLoad: { life: 0.7, fn(e, t, p, out) {
    knock(e, out, t, 420 * p, 0.18);
    thud(e, out, t, 150 * p, 0.12, 0.08);
    clack(e, out, t + 0.18, 2200 * p, 0.12, 0.02, 6);
  } },
  pianola: { special(e, o) { return e.pianola(o.tune || 'empressMarch', o); } },
  overture: { special(e, o) { return e.overture.play(o); } },
  dustSheet: { life: 1.6, fn(e, t, p, out) {
    whoosh(e, out, t, 0.55, 300 * p, 1800 * p, 0.28);
    rustle(e, out, t, 0.5, 0.03, 800, 2600, 20);
    N(e, out, { type: 'highpass', f: 4000, t: t + 0.4, a: 0.3, peak: 0.02, d: 0.8 });
  } },
  thunderSheet: { send: 0.45, life: (o) => ({ tink: 0.8, crack: 3.4 }[o.kind] ?? 5), fn(e, t, p, out, o) {
    const kind = o.kind || 'roll';
    if (kind === 'tink') { metal(e, out, t, 880 * p, 0.07, 0.5); return; }
    const dur = kind === 'roll' ? 4.2 : 2.8;
    [55, 83, 131, 197, 311].forEach((f, i) => T(e, out, { f: f * p, t, a: 0.01, peak: 0.14 / (1 + i * 0.5), d: dur * (1 - i * 0.12), vib: [rand(4, 7), 40, true] }));
    N(e, out, { kind: 'brown', type: 'lowpass', f: 500 * p, Q: 0.8, t, a: 0.005, peak: 0.5, hold: kind === 'roll' ? 2.2 : 0.1, d: dur - 0.5, rough: kind === 'roll' ? [0.15, 1, 0.55, 60] : undefined });
    N(e, out, { type: 'bandpass', f: 1300 * p, Q: 0.9, t, a: 0.002, peak: kind === 'crack' ? 0.35 : 0.15, d: kind === 'crack' ? 0.5 : 0.3 });
    if (kind === 'roll') for (let i = 1; i < 6; i++) N(e, out, { kind: 'pink', type: 'lowpass', f: 900 * p, t: t + i * rand(0.3, 0.55), a: 0.01, peak: rand(0.12, 0.25), d: 0.4 });
  } },
  crankSqueal: { life: 1.2, fn(e, t, p, out) {
    creak(e, out, t, 0.7, 380 * p, 1900 * p, 0.13);
    metal(e, out, t + 0.7, 240 * p, 0.08, 0.4);
  } },
  canvasFlap: { life: 1.9, fn(e, t, p, out) {
    let tt = t;
    for (let i = 0; i < 16; i++) { N(e, out, { kind: 'pink', type: 'bandpass', f: rand(300, 900) * p, Q: 1, t: tt, a: 0.003, peak: rand(0.15, 0.3), d: rand(0.03, 0.07) }); tt += rand(0.05, 0.11); }
    N(e, out, { kind: 'pink', type: 'bandpass', f: 500, Q: 0.8, t, a: 0.1, peak: 0.12, hold: 1.0, d: 0.3 });
  } },
  governorLatch: { life: 0.6, fn(e, t, p, out) {
    clack(e, out, t, 2100 * p, 0.22, 0.03, 5);
    metal(e, out, t, 520 * p, 0.06, 0.3);
    clack(e, out, t + 0.08, 2900 * p, 0.1, 0.015, 8);
  } },
  gearMesh: { life: 1, fn(e, t, p, out) {
    for (let i = 0; i < 10; i++) clack(e, out, t + i * 0.045, (1500 + i * 40) * p, 0.07, 0.012, 8);
    thud(e, out, t + 0.45, 150 * p, 0.12, 0.08);
    metal(e, out, t + 0.45, 640 * p, 0.05, 0.25);
  } },
  gearSlip: { life: 1.4, fn(e, t, p, out) {
    let tt = t, gap = 0.03;
    for (let i = 0; i < 12; i++) { clack(e, out, tt, 2600 * p, 0.05 * (1 - i / 14), 0.01, 9); tt += gap; gap *= 1.18; }
    metal(e, out, tt, 900 * p, 0.06, 0.3);
    clack(e, out, tt + 0.12, 1900 * p, 0.07, 0.02, 5);
  } },
  trapWinch: { send: 0.25, life: 1.8, fn(e, t, p, out) {
    for (let i = 0; i < 14; i++) clack(e, out, t + i * 0.075, (1900 + (i % 2) * 300) * p, 0.11, 0.015, 7);
    creak(e, out, t, 1.05, 140 * p, 800 * p, 0.07);
    thud(e, out, t + 1.1, 120 * p, 0.14, 0.1);
  } },
  harpGliss: { send: 0.5, life: 2.6, fn(e, t, p, out) {
    [55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84].forEach((m, i) => {
      const f = mtof(m) * p;
      T(e, out, { type: 'triangle', f, t: t + i * 0.045, a: 0.003, peak: 0.05, d: 1.4 });
      T(e, out, { f: f * 2, t: t + i * 0.045, a: 0.003, peak: 0.012, d: 0.5 });
    });
  } },
  snareTap: { send: 0.25, life: 0.6, fn(e, t, p, out) {
    N(e, out, { type: 'bandpass', f: 3200 * p, Q: 0.8, t, a: 0.001, peak: 0.25, d: 0.16 });
    T(e, out, { type: 'triangle', f: 190 * p, f2: 160 * p, t, a: 0.001, peak: 0.15, d: 0.08 });
  } },
  batonTap: { life: 0.5, fn(e, t, p, out) { for (const dt of [0, 0.16]) knock(e, out, t + dt, 1500 * p, 0.08); } },
  pianoKey: { send: 0.25, life: 3, fn(e, t, p, out, o) {
    e._piano(out, t, mtof(midi(o.note ?? 'C4') ?? 60) * p, 1.6, 0.8, { sour: o.sour, ring: 2.5 });
  } },
  pianoNote: { send: 0.25, life: (o) => (o.dur ?? 1.5) + 1, fn(e, t, p, out, o) {
    e._piano(out, t, mtof(midi(o.note ?? 'C4') ?? 60) * p, o.dur ?? 1.5, o.vel ?? 0.8, { sour: o.sour, detune: o.detune });
  } },
  pianoChord: { send: 0.25, life: (o) => (o.dur ?? 2) + 1, fn(e, t, p, out, o) {
    (o.notes ?? ['C4', 'E4', 'G4']).forEach((n, i) => {
      const m = midi(n);
      if (m != null) e._piano(out, t + i * (o.roll ?? 0.012), mtof(m) * p, o.dur ?? 2, o.vel ?? 0.7, { sour: o.sour, detune: o.detune });
    });
  } },

  // ── Foyer ──────────────────────────────────────────
  winch: { life: 0.6, gap: 0.05, fn(e, t, p, out) {
    for (let i = 0; i < 5; i++) clack(e, out, t + i * 0.07, (1600 + i * 50) * p, 0.12, 0.015, 7);
    creak(e, out, t, 0.38, 160 * p, 900 * p, 0.04);
  } },
  chainRattle: { life: 1.0, fn(e, t, p, out) {
    for (let i = 0; i < 14; i++) link(e, out, t + rand(0, 0.6), rand(1800, 3600) * p, rand(0.02, 0.045));
  } },
  chandelierChime: { send: 0.6, life: 3.2, fn(e, t, p, out) {
    for (let i = 0; i < 14; i++) glass(e, out, t + rand(0, 0.9) + i * 0.03, rand(2600, 6200) * p, rand(0.02, 0.045), rand(0.8, 1.6));
  } },
  chandelierOn: { send: 0.5, life: 4.2, fn(e, t, p, out) {
    clack(e, out, t, 1300 * p, 0.2, 0.03, 3);
    thud(e, out, t, 100 * p, 0.2, 0.1, 600);
    for (let i = 0; i < 8; i++) glass(e, out, t + 0.1 + i * 0.06, rand(3000, 5200) * p, 0.025, 0.5);
    hum(e, out, t + 0.05, 100 * p, 0.8, 0.6, 1.2, 0.05, 500);
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => T(e, out, { f: f * p, t: t + 0.2 + i * 0.05, a: 0.8, peak: 0.035, hold: 0.4, d: 1.4 }));
    SFX.chandelierChime.fn(e, t + 0.6, p, out);
  } },
  safeDial: { life: 0.3, gap: 0.02, fn(e, t, p, out) {
    clack(e, out, t, 3000 * p * rand(0.97, 1.03), 0.16, 0.012, 7);
    T(e, out, { f: 1500 * p, t, a: 0.001, peak: 0.03, d: 0.03 });
  } },
  safeTumbler: { send: 0.2, life: 0.9, fn(e, t, p, out) {
    clack(e, out, t, 1100 * p, 0.35, 0.05, 3);
    T(e, out, { f: 680 * p, t, a: 0.001, peak: 0.12, d: 0.35 });
    T(e, out, { f: 1020 * p, t, a: 0.001, peak: 0.05, d: 0.2 });
    N(e, out, { type: 'bandpass', f: 900, Q: 8, t, a: 0.002, peak: 0.08, d: 0.3 });
  } },
  safeOpen: { send: 0.35, life: 2.6, fn(e, t, p, out) {
    clack(e, out, t, 1200 * p, 0.22, 0.04, 3);
    metal(e, out, t, 260 * p, 0.1, 0.6);
    for (let i = 0; i < 3; i++) clack(e, out, t + 0.25 + i * 0.09, 1700 * p, 0.12, 0.03, 5);
    creak(e, out, t + 0.6, 1.3, 90 * p, 600 * p, 0.12);
    thud(e, out, t + 1.9, 90 * p, 0.2, 0.2);
  } },
  chainFall: { send: 0.3, life: 1.8, fn(e, t, p, out) {
    for (let i = 0; i < 18; i++) link(e, out, t + i * 0.035 + rand(0, 0.02), rand(1500, 3400) * p, 0.04);
    thud(e, out, t + 0.7, 110 * p, 0.22, 0.15, 900);
    for (let i = 0; i < 6; i++) link(e, out, t + 0.7 + rand(0, 0.3), rand(1200, 2600) * p, 0.035);
  } },
  doorsOpen: { send: 0.45, life: 3.4, fn(e, t, p, out) {
    clack(e, out, t, 1500 * p, 0.2, 0.03, 3);
    metal(e, out, t, 300 * p, 0.06, 0.4);
    creak(e, out, t + 0.15, 1.8, 85 * p, 700 * p, 0.12);
    creak(e, out, t + 0.35, 1.6, 105 * p, 900 * p, 0.08);
    N(e, out, { kind: 'pink', type: 'lowpass', f: 400, f2: 1600, t: t + 0.4, a: 1.2, peak: 0.1, d: 1.4 });
  } },
  houseSwitch: { life: 0.6, fn(e, t, p, out) {
    clack(e, out, t, 900 * p, 0.28, 0.05, 2.5);
    thud(e, out, t, 160 * p, 0.15, 0.08);
    clack(e, out, t + 0.05, 2200 * p, 0.1, 0.02, 6);
  } },
  houseLightsUp: { send: 0.5, life: 4.5, fn(e, t, p, out) {
    hum(e, out, t, 100 * p, 2.6, 0.3, 1.4, 0.04, 700);
    const lp = filt(e, 'lowpass', 2400, 0.7); lp.connect(out);
    [130.8, 196, 261.6, 329.6, 392, 523.3].forEach((f, i) => {
      for (const det of [-6, 6]) T(e, lp, { type: 'triangle', f: f * p, t: t + i * 0.1, a: 2.4, peak: 0.035 / (1 + i * 0.2), hold: 0.4, d: 1.5, detune: det });
    });
    N(e, out, { kind: 'pink', type: 'bandpass', f: 500, f2: 2500, glide: 2.6, Q: 0.7, t, a: 2.6, peak: 0.04, d: 1.2 });
  } },
  ticketPrint: { send: 0.25, life: 1.6, fn(e, t, p, out) {
    for (let i = 0; i < 7; i++) clack(e, out, t + i * 0.055, rand(1400, 2400) * p, 0.12, 0.02, 4);
    thud(e, out, t + 0.42, 140 * p, 0.18, 0.08);
    clack(e, out, t + 0.42, 1100 * p, 0.2, 0.03, 3);
    e._bell(out, 2350 * p, t + 0.55, 0.08, 1.0, [1, 2.76, 5.4], [1, 0.3, 0.1]);
  } },
  pieceSnap: { life: 0.4, fn(e, t, p, out) {
    clack(e, out, t, 2400 * p, 0.3, 0.015, 4);
    knock(e, out, t, 700 * p, 0.18);
  } },
  catPurr: { life: 1.6, fn(e, t, p, out) {
    const ctx = e.ctx;
    const n = N(e, out, { kind: 'brown', type: 'lowpass', f: 320 * p, Q: 1.5, t, a: 0.15, peak: 0.5, hold: 0.85, d: 0.25 });
    n.g.gain.cancelScheduledValues(t);
    n.g.gain.setValueCurveAtTime(new Float32Array([0, 0.3, 0.5, 0.45, 0.2, 0.3, 0.42, 0.38, 0.15, 0.03, 0]), t, 1.25);
    const am = ctx.createGain(); am.gain.value = 0.5;
    const l = ctx.createOscillator(), depth = ctx.createGain();
    l.type = 'triangle'; l.frequency.value = 25 * p; depth.gain.value = 0.5;
    l.connect(depth); depth.connect(am.gain);
    n.g.disconnect(); n.g.connect(am); am.connect(out);
    T(e, am, { type: 'triangle', f: 50 * p, t, a: 0.15, peak: 0.12, hold: 0.85, d: 0.25 });
    l.start(t); l.stop(t + 1.3);
  } },
  catPat: { life: 0.4, fn(e, t, p, out) {
    N(e, out, { kind: 'pink', type: 'lowpass', f: 420 * p, t, a: 0.004, peak: 0.35, d: 0.07 });
    T(e, out, { f: 140 * p, f2: 90 * p, t, a: 0.003, peak: 0.14, d: 0.06 });
  } },
  catMrrp: { send: 0.08, life: 0.9, fn(e, t, p, out) {
    // a soft low "mrrp": a rolled start, then a small upward chirp through a vowel formant
    const ctx = e.ctx, o = ctx.createOscillator(), g = ctx.createGain(), roll = ctx.createGain();
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    const f = 330 * p;
    o.frequency.setValueAtTime(f * 0.85, t);
    o.frequency.linearRampToValueAtTime(f * 0.95, t + 0.1);
    o.frequency.exponentialRampToValueAtTime(f * 1.4, t + 0.24);
    o.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.36);
    f1.type = 'bandpass'; f1.Q.value = 3;
    f1.frequency.setValueAtTime(600, t); f1.frequency.linearRampToValueAtTime(1100, t + 0.24); f1.frequency.linearRampToValueAtTime(800, t + 0.36);
    f2.type = 'bandpass'; f2.Q.value = 5; f2.frequency.setValueAtTime(2100, t);
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    const l = ctx.createOscillator(), depth = ctx.createGain();
    l.frequency.value = 26; depth.gain.setValueAtTime(0.5, t); depth.gain.linearRampToValueAtTime(0, t + 0.12);
    roll.gain.value = 0.5; l.connect(depth); depth.connect(roll.gain);
    e._env(g.gain, t, 0.03, 0.26, 0.2, 0.15);
    o.connect(roll); roll.connect(f1); roll.connect(f2);
    const mix = ctx.createGain(); mix.gain.value = 1;
    f1.connect(mix); const f2g = ctx.createGain(); f2g.gain.value = 0.3; f2.connect(f2g); f2g.connect(mix);
    mix.connect(lp); lp.connect(g); g.connect(out);
    o.start(t); l.start(t); o.stop(t + 0.45); l.stop(t + 0.45);
  } },

  // ── Dressing room ─────────────────────────────────
  mirrorPivot: { life: 0.8, fn(e, t, p, out) {
    thud(e, out, t, 180 * p, 0.16, 0.08, 800);
    creak(e, out, t + 0.05, 0.3, 340 * p, 1800 * p, 0.04);
    clack(e, out, t + 0.38, 2600 * p, 0.1, 0.015, 7);
  } },
  mirrorBulbs: { send: 0.4, life: 2.4, fn(e, t, p, out) {
    for (let i = 0; i < 10; i++) {
      const tt = t + i * 0.09;
      T(e, out, { f: (2600 + i * 120) * p, t: tt, a: 0.001, peak: 0.035, d: 0.25 });
      clack(e, out, tt, 4500 * p, 0.02, 0.006, 5);
    }
    hum(e, out, t + 0.1, 100 * p, 0.6, 0.4, 0.9, 0.03, 400);
  } },
  ashRustle: { life: 1.2, fn(e, t, p, out) {
    for (let i = 0; i < 24; i++) N(e, out, { type: 'bandpass', f: rand(2500, 7000) * p, Q: 1.8, t: t + rand(0, 0.8), a: 0.002, peak: rand(0.02, 0.07), d: rand(0.01, 0.03) });
    N(e, out, { type: 'highpass', f: 2000, t, a: 0.1, peak: 0.02, hold: 0.4, d: 0.3 });
  } },
  drawerSlide: { life: 0.9, fn(e, t, p, out) {
    N(e, out, { kind: 'pink', type: 'lowpass', f: 700 * p, Q: 1, t, a: 0.04, peak: 0.2, hold: 0.22, d: 0.08, rough: [0.35, 1, 0.3, 20] });
    T(e, out, { f: 160 * p, f2: 100 * p, t: t + 0.36, a: 0.003, peak: 0.18, d: 0.08 });
    N(e, out, { type: 'bandpass', f: 1500, Q: 3, t: t + 0.36, a: 0.001, peak: 0.06, d: 0.03 });
  } },
  drawerThunk: { send: 0.25, life: 0.8, fn(e, t, p, out) {
    N(e, out, { kind: 'pink', type: 'lowpass', f: 600 * p, Q: 1, t, a: 0.03, peak: 0.12, hold: 0.12, d: 0.05 });
    thud(e, out, t + 0.2, 120 * p, 0.3, 0.14, 700);
    knock(e, out, t + 0.2, 320 * p, 0.15);
  } },
  secretDrawer: { send: 0.3, life: 1.4, fn(e, t, p, out) {
    clack(e, out, t, 2200 * p, 0.15, 0.02, 5);
    T(e, out, { type: 'triangle', f: 260 * p, f2: 220 * p, t, a: 0.002, peak: 0.12, d: 0.6, vib: [30, 250, true] });
    N(e, out, { kind: 'pink', type: 'bandpass', f: 900 * p, Q: 1, t: t + 0.05, a: 0.02, peak: 0.14, hold: 0.12, d: 0.05 });
    thud(e, out, t + 0.24, 140 * p, 0.25, 0.12, 800);
  } },
  gramophoneWind: { life: 2.8, fn(e, t, p, out) {
    let tt = t;
    for (let turn = 0; turn < 3; turn++) {
      for (let i = 0; i < 8; i++) { clack(e, out, tt, (1700 + turn * 150 + i * 20) * p, 0.07, 0.012, 8); tt += 0.075; }
      tt += 0.12;
    }
    N(e, out, { type: 'bandpass', f: 900 * p, f2: 1500 * p, glide: 2.2, Q: 3, t, a: 0.2, peak: 0.02, hold: 1.6, d: 0.3 });
  } },
  needleDrop: { life: 1.2, fn(e, t, p, out) {
    thud(e, out, t, 90 * p, 0.14, 0.08, 400);
    clack(e, out, t, 1800 * p, 0.05, 0.01, 3);
    N(e, out, { type: 'highpass', f: 1500, Q: 0.7, t: t + 0.05, a: 0.05, peak: 0.03, hold: 0.6, d: 0.3, rough: [0, 1, 0.1, 60] });
  } },
  jewelWheel: { life: 0.4, gap: 0.02, fn(e, t, p, out) {
    clack(e, out, t, 3600 * p, 0.16, 0.01, 9);
    e._bell(out, 4200 * p, t, 0.02, 0.12, [1, 2.4], [1, 0.3]);
  } },
  musicBox: { send: 0.45, life: 4.5, fn(e, t, p, out) {
    let tt = t;
    for (const tok of 'C6:2 A5:1 F6:3 D6:1 F6:1 D6:1 C6:3 A5:1 C6:1 G5:1 F5:3'.split(' ')) {
      const [n, u] = tok.split(':');
      e._bell(out, mtof(midi(n) + 12) * p, tt, 0.045, 1.2, [1, 3.9, 9.3], [1, 0.12, 0.04]);
      tt += +u * 0.16;
    }
  } },
  lilyShimmer: { send: 0.65, life: 3.5, fn(e, t, p, out) {
    [1318.5, 1760, 2217.5, 2637, 2960, 3520].forEach((f, i) => T(e, out, { f: f * p, t: t + i * 0.11 + rand(0, 0.04), a: 0.25, peak: 0.03, hold: 0.2, d: 1.6 }));
    N(e, out, { type: 'highpass', f: 4000, Q: 0.6, t, a: 0.6, peak: 0.025, hold: 0.3, d: 1.2 });
  } },

  // ── Finale ─────────────────────────────────────────
  cueStandby: { life: 0.7, fn(e, t, p, out) {
    const lp = filt(e, 'lowpass', 900, 0.8); lp.connect(out);
    T(e, lp, { type: 'square', f: 120 * p, t, a: 0.01, peak: 0.07, hold: 0.35, d: 0.08 });
    T(e, lp, { type: 'square', f: 121.5 * p, t, a: 0.01, peak: 0.05, hold: 0.35, d: 0.08 });
  } },
  cueGo: { send: 0.3, life: 1.6, fn(e, t, p, out) {
    clack(e, out, t, 1100 * p, 0.25, 0.04, 3);
    thud(e, out, t, 150 * p, 0.15, 0.07);
    e._bell(out, 1975.5 * p, t + 0.03, 0.07, 1.1, [1, 2.76, 5.4], [1, 0.3, 0.1]);
  } },
  thunderCrack: { send: 0.5, life: 4.5, prio: true, fn(e, t, p, out) {
    N(e, out, { type: 'highpass', f: 1800 * p, Q: 0.5, t, a: 0.001, peak: 0.45, d: 0.12 });
    N(e, out, { kind: 'pink', type: 'lowpass', f: 4000 * p, f2: 400, glide: 0.4, Q: 0.5, t, a: 0.002, peak: 0.5, d: 0.5 });
    N(e, out, { kind: 'brown', type: 'lowpass', f: 350 * p, f2: 90, glide: 3, Q: 0.7, t: t + 0.06, a: 0.08, peak: 0.85, hold: 0.6, d: 2.9, rough: [0.25, 1, 0.6, 70] });
    T(e, out, { f: 46 * p, f2: 32 * p, t, a: 0.02, peak: 0.35, d: 2.2 });
  } },
  lampBlaze: { send: 0.55, life: 5, prio: true, fn(e, t, p, out) {
    N(e, out, { kind: 'brown', type: 'lowpass', f: 200, f2: 2400, glide: 0.9, Q: 0.8, t, a: 0.5, peak: 0.4, d: 1.4 });
    const lp = filt(e, 'lowpass', 2400, 0.7); lp.connect(out);
    [130.8, 196, 261.6, 329.6, 392, 523.3, 659.3].forEach((f, i) => {
      for (const det of [-7, 7]) T(e, lp, { type: 'sawtooth', f: f * p, t: t + 0.1 + i * 0.04, a: 1.0, peak: 0.025 / (1 + i * 0.15), hold: 0.6, d: 2.2, detune: det });
    });
    e._bell(out, 2093 * p, t + 1.0, 0.07, 2.4);
    SFX.ghostShimmer.fn(e, t + 0.9, p, out);
  } },
  catApplause: { send: 0.55, life: 8.5, fn(e, t, p, out) {
    SFX.catPat.fn(e, t, p, out);
    SFX.catPat.fn(e, t + 0.38, p * 1.05, out);
    applauseSwell(e, out, t + 1.3, 6, 0.75, p);
  } },
  applauseOne: { send: 0.35, life: 3.5, fn(e, t, p, out, o) {
    const n = o.claps ?? 9;
    let tt = t;
    for (let i = 0; i < n; i++) { clap(e, out, tt, p, 0.3 * (1 - i / (n * 2))); tt += 0.23 + rand(-0.02, 0.03) + i * 0.006; }
  } },
  applauseFull: { send: 0.4, life: (o) => (o.dur ?? 6) + 1, fn(e, t, p, out, o) { applauseSwell(e, out, t, o.dur ?? 6, 1, p); } },
  houseBell: { send: 0.35, life: (o) => (o.dur ?? 2) + 1.2, fn(e, t, p, out, o) { electricBell(e, out, t, o.dur ?? 2, p); } },
  dawnBirds: { send: 0.45, life: 7, fn(e, t, p, out) {
    let tt = t + 0.2;
    for (let k = 0; k < 7; k++) {
      const base = rand(2400, 4200), n = 2 + ((Math.random() * 5) | 0);
      for (let i = 0; i < n; i++) {
        const f = base * rand(0.9, 1.15) * p;
        T(e, out, { f, f2: f * rand(1.2, 1.6), glide: 0.05, t: tt, a: 0.005, peak: rand(0.02, 0.045), d: 0.06 });
        tt += rand(0.07, 0.12);
      }
      tt += rand(0.3, 0.75);
    }
    T(e, out, { f: 1900 * p, f2: 2500 * p, glide: 0.3, t: t + 1.5, a: 0.04, peak: 0.035, hold: 0.2, d: 0.2, vib: [22, 80] });
    T(e, out, { f: 2200 * p, f2: 1700 * p, glide: 0.3, t: t + 3.6, a: 0.04, peak: 0.03, hold: 0.15, d: 0.25, vib: [20, 70] });
  } },

  // ── Kept from the engine lineage (the test room uses them) ──
  swoosh: { life: 0.7, fn(e, t, p, out) {
    const n = N(e, out, { kind: 'pink', type: 'bandpass', f: 400 * p, Q: 1.6, t, a: 0.15, peak: 0.45, d: 0.22 });
    n.filt.frequency.exponentialRampToValueAtTime(2400 * p, t + 0.16);
    n.filt.frequency.exponentialRampToValueAtTime(600 * p, t + 0.37);
  } },
  whump: { send: 0.35, life: 1.8, fn(e, t, p, out) {
    T(e, out, { f: 130 * p, f2: 32 * p, glide: 0.5, t, a: 0.006, peak: 0.85, d: 0.7 });
    N(e, out, { kind: 'brown', type: 'lowpass', f: 1400, f2: 90, glide: 0.8, t, a: 0.005, peak: 0.75, d: 0.9 });
    N(e, out, { type: 'bandpass', f: 1800, f2: 400, Q: 0.8, t, a: 0.004, peak: 0.18, d: 0.25 });
  } },
  ratchet: { life: 0.6, fn(e, t, p, out) {
    for (let i = 0; i < 6; i++) {
      const tt = t + i * 0.038, f = (2100 + i * 60) * p;
      N(e, out, { type: 'bandpass', f, Q: 6, t: tt, a: 0.001, peak: 0.13, d: 0.02 });
      T(e, out, { type: 'triangle', f: f * 0.45, t: tt, a: 0.001, peak: 0.05, d: 0.018 });
    }
    T(e, out, { f: 200 * p, f2: 120 * p, t: t + 0.23, a: 0.002, peak: 0.12, d: 0.06 });
  } },
  candleLight: { send: 0.1, life: 0.8, fn(e, t, p, out) {
    N(e, out, { type: 'bandpass', f: 3200 * p, f2: 1800 * p, Q: 2, t, a: 0.004, peak: 0.12, d: 0.08 });
    N(e, out, { type: 'lowpass', f: 400, f2: 1300, Q: 0.7, t: t + 0.05, a: 0.06, peak: 0.12, d: 0.35 });
    T(e, out, { f: 160 * p, f2: 110 * p, t: t + 0.05, a: 0.04, peak: 0.06, d: 0.2 });
  } },
};

// ═════════════════════════════════════════════════════════════ LOOPS
// build(engine, inst, opts): connect continuous sources into inst.out (push them on inst.sources so they stop) and
// optionally set inst.tick(time) → nextTime, or push more { fn, next } on inst.tickers, for scheduled events.
// set(engine, inst, opts) applies parameters (called after build and on every loop() while running).
// inst.level is the loop's loudness at gain 1; `ahead` is the scheduling lookahead (default 1.1 s); `first` delays
// inst.tick's first event (sparse loops, so it isn't lost under the fade-in).

function noiseSrc(e, inst, kind, rate = 1) {
  const s = e.ctx.createBufferSource();
  s.buffer = e._buf(kind); s.loop = true; s.playbackRate.value = rate;
  s.start(e.ctx.currentTime, Math.random() * Math.max(0, s.buffer.duration - 0.2));
  inst.sources.push(s);
  return s;
}
function lfo(e, inst, freq, depth, target, type = 'sine') {
  const o = e.ctx.createOscillator(), g = e.ctx.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = depth;
  o.connect(g); g.connect(target);
  o.start(e.ctx.currentTime); inst.sources.push(o);
  return o;
}
function osc(e, inst, f, amp, dest, type = 'sine') {
  const o = e.ctx.createOscillator(), g = e.ctx.createGain();
  o.type = type; o.frequency.value = f; g.gain.value = amp;
  o.connect(g); g.connect(dest); o.start(e.ctx.currentTime); inst.sources.push(o);
  return o;
}
/** chain(a, b, c...) connects in series; returns the last. */
function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }
function every(inst, e, fn, first = 0.3) { inst.tickers.push({ fn, next: e.ctx.currentTime + first }); }

/** Steps through a score in real time at `rate()` (the record's speed), calling play(event, when, rate). */
function scoreTicker(score, play, { rate = () => 1, gap = 0, start = 0 } = {}) {
  const ev = score.events;
  let pos = -start, idx = 0;
  return (t) => {
    const r = Math.max(0.3, rate()), step = 0.05, span = step * r;
    while (idx < ev.length && ev[idx].t < pos + span) {
      const x = ev[idx++];
      if (x.t >= pos - 0.001) play(x, t + Math.max(0, (x.t - pos) / r), r);
    }
    pos += span;
    if (pos >= score.dur + gap) { pos = 0; idx = 0; }
    return t + step;
  };
}

/** Rain on glass: a soft body plus a pre-rendered patter buffer. */
function rainLayer(e, inst, { body = 0.16, lp = 1500, hp = 200, patter = 0.22, patterF = 3600, patterRate = 1 } = {}) {
  const g = gainNode(e, body);
  lfo(e, inst, 0.05, body * 0.3, g.gain); lfo(e, inst, 0.13, body * 0.15, g.gain);
  chain(noiseSrc(e, inst, 'pink'), filt(e, 'highpass', hp), filt(e, 'lowpass', lp, 0.5), g, inst.out);
  chain(noiseSrc(e, inst, 'patter', patterRate), filt(e, 'bandpass', patterF, 0.7), gainNode(e, patter), inst.out);
}

const LOOPS = {
  // ── room beds ──────────────────────────────────────
  rainGlass: { build(e, inst) { // rain on the stage door and its wired glass
    rainLayer(e, inst, { body: 0.17, lp: 1500, patter: 0.3, patterF: 3400 });
    inst.tick = (t) => {
      const f = rand(1100, 1900);
      T(e, inst.out, { f, f2: f * 1.3, glide: 0.03, t, a: 0.002, peak: rand(0.012, 0.03), d: 0.05 });
      return t + rand(0.6, 2.4);
    };
  } },
  kettleTick: { send: 0.2, first: 0.9, build(e, inst) { // the green-room kettle and pipes ticking as they cool
    inst.tick = (t) => {
      const f = rand(3800, 5200), n = Math.random() < 0.3 ? 2 : 1;
      for (let i = 0; i < n; i++) clack(e, inst.out, t + i * rand(0.12, 0.25), f * rand(0.95, 1.05), rand(0.03, 0.05), 0.012, 9);
      return t + rand(3, 9);
    };
  } },
  wirelessStatic: { build(e, inst) { // the wireless, faintly alive
    const g = gainNode(e, 0.012); lfo(e, inst, 0.09, 0.006, g.gain);
    chain(noiseSrc(e, inst, 'white'), filt(e, 'bandpass', 1800, 0.5), g, inst.out);
    chain(noiseSrc(e, inst, 'crackle', 0.8), filt(e, 'highpass', 1200), gainNode(e, 0.05), inst.out);
    const w = gainNode(e, 0.0025); w.connect(inst.out);
    const o = osc(e, inst, 1150, 1, w); lfo(e, inst, 0.2, 20, o.frequency);
  } },
  bigRoom: { send: 0.35, build(e, inst) { // the empty stage: air, the fly tower, rain far up on the roof
    const air = gainNode(e, 0.3); lfo(e, inst, 0.04, 0.08, air.gain);
    chain(noiseSrc(e, inst, 'brown'), filt(e, 'lowpass', 140), air, inst.out);
    const room = gainNode(e, 0.05); lfo(e, inst, 0.06, 0.02, room.gain);
    chain(noiseSrc(e, inst, 'pink'), filt(e, 'lowpass', 500), room, inst.out);
    chain(noiseSrc(e, inst, 'pink'), filt(e, 'bandpass', 700, 0.5), gainNode(e, 0.04), inst.out);
    chain(noiseSrc(e, inst, 'patter', 0.6), filt(e, 'lowpass', 1400), gainNode(e, 0.1), inst.out);
    inst.tick = (t) => { creak(e, inst.out, t, rand(0.6, 1.4), rand(70, 120), rand(400, 700), rand(0.015, 0.03)); return t + rand(8, 20); };
  } },
  dimmerHum: { build(e, inst) { // the dimmer board, live after mains: 50 Hz and its buzz
    const lp = filt(e, 'lowpass', 420, 0.6), g = gainNode(e, 1);
    chain(lp, g, inst.out);
    osc(e, inst, 50, 0.07, lp); osc(e, inst, 100, 0.06, lp); osc(e, inst, 150, 0.022, lp); osc(e, inst, 100.4, 0.02, lp, 'sawtooth');
    const buzz = gainNode(e, 0.006); chain(buzz, filt(e, 'bandpass', 1200, 2), inst.out);
    osc(e, inst, 100, 1, buzz, 'square');
    lfo(e, inst, 0.11, 0.12, g.gain);
  } },
  rainSkylight: { build(e, inst) { // rain drumming on the wardrobe skylight overhead
    rainLayer(e, inst, { body: 0.13, lp: 3000, hp: 400, patter: 0.42, patterF: 4200, patterRate: 1.15 });
    inst.tick = (t) => { glass(e, inst.out, t, rand(2000, 3000), rand(0.008, 0.016), 0.3); return t + rand(1.5, 3.2); };
  } },
  loftCreaks: { send: 0.4, first: 0.9, build(e, inst) { // the roof timbers settling
    inst.tick = (t) => { creak(e, inst.out, t, rand(0.4, 1.1), rand(90, 180), rand(500, 1100), rand(0.025, 0.045)); return t + rand(5, 14); };
  } },
  pitDust: { send: 0.4, build(e, inst) { // a drip into a bucket, dust, the piano's strings humming in sympathy
    chain(noiseSrc(e, inst, 'pink'), filt(e, 'lowpass', 350), gainNode(e, 0.06), inst.out);
    const strings = gainNode(e, 1); chain(strings, inst.out);
    lfo(e, inst, 0.07, 0.4, strings.gain);
    osc(e, inst, 217.5, 0.006, strings); osc(e, inst, 435, 0.004, strings); osc(e, inst, 652.5, 0.0018, strings); osc(e, inst, 326.3, 0.002, strings, 'triangle');
    inst.tick = (t) => {
      const f = rand(850, 1050);
      T(e, inst.out, { f, f2: f * 1.5, glide: 0.025, t, a: 0.002, peak: 0.045, d: 0.08 });
      T(e, inst.out, { f: 280, f2: 200, t, a: 0.003, peak: 0.02, d: 0.06 });
      return t + rand(1.9, 2.6);
    };
  } },
  lowWind: { build(e, inst) { // the pit after the wind machine is latched: a low steady gale through the trap room
    for (const [f, depth, rate, amp] of [[260, 120, 0.06, 0.2], [620, 260, 0.037, 0.07]]) {
      const bp = filt(e, 'bandpass', f, 1.1), g = gainNode(e, amp);
      lfo(e, inst, rate, depth, bp.frequency); lfo(e, inst, rate * 0.8, amp * 0.5, g.gain);
      chain(noiseSrc(e, inst, 'pink'), bp, g, inst.out);
    }
  } },
  foyerStreet: { send: 0.3, build(e, inst) { // rain beyond the glass doors, a far clock, the odd car on the wet street
    rainLayer(e, inst, { body: 0.13, lp: 800, patter: 0.12, patterF: 2000, patterRate: 0.8 });
    const far = filt(e, 'lowpass', 1500); chain(far, inst.out);
    let tock = false, car = rand(8, 20);
    inst.tick = (t) => {
      tick(e, far, t, tock ? 0.82 : 1, 0.018); tock = !tock;
      if ((car -= 1) <= 0) { whoosh(e, inst.out, t, 3, 250, 900, 0.035); car = rand(15, 35); }
      return t + 1.0;
    };
  } },
  chandelierTinkle: { send: 0.6, first: 0.7, build(e, inst) { // the lit chandelier's crystals, stirring
    inst.tick = (t) => {
      const n = 1 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) glass(e, inst.out, t + i * rand(0.05, 0.15), rand(3000, 6000), rand(0.012, 0.022), 0.8);
      return t + rand(1.5, 5);
    };
  } },
  dressingRoom: { send: 0.3, build(e, inst) { // the radiator ticking, rain on the small window, the overture very far off
    rainLayer(e, inst, { body: 0.06, lp: 1100, patter: 0.1, patterF: 2500, patterRate: 0.9 });
    every(inst, e, (t) => {
      const n = Math.random() < 0.35 ? 1 + ((Math.random() * 3) | 0) : 1;
      for (let i = 0; i < n; i++) metal(e, inst.out, t + i * rand(0.15, 0.4), rand(900, 1500), rand(0.012, 0.02), 0.2);
      return t + rand(2, 7);
    }, 1.2);
    const far = filt(e, 'lowpass', 450, 0.7), fg = gainNode(e, 0.35);
    chain(far, fg, inst.out);
    every(inst, e, scoreTicker(SCORES.empressMarch, (x, when) => {
      if (x.voice !== 'fx') e._piano(far, when, mtof(x.m), x.d, x.v * 0.6, { detune: rand(-12, 12) });
    }, { gap: 26, start: 7 }), 0.05);
  } },
  houseMurmur: { send: 0.4, build(e, inst) { // a full house settling before the curtain (the finale, until Q31)
    const lp = filt(e, 'lowpass', 2600, 0.6); chain(lp, inst.out);
    const voices = [[420, 1.2], [880, 1.5], [1700, 2]].map(([f, q]) => {
      const g = gainNode(e, 0.08); chain(noiseSrc(e, inst, 'pink'), filt(e, 'bandpass', f, q), g, lp); return g;
    });
    chain(noiseSrc(e, inst, 'brown'), filt(e, 'lowpass', 300), gainNode(e, 0.06), inst.out);
    inst.tick = (t) => { for (const g of voices) g.gain.setTargetAtTime(rand(0.04, 0.16), t, 0.12); return t + rand(0.15, 0.3); };
    every(inst, e, (t) => {
      if (Math.random() < 0.5) { for (const dt of [0, 0.22]) N(e, inst.out, { kind: 'pink', type: 'bandpass', f: rand(500, 800), Q: 1.5, t: t + dt, a: 0.01, peak: 0.05, d: 0.12 }); }
      else creak(e, inst.out, t, 0.3, rand(200, 300), 1200, 0.015);
      return t + rand(3, 8);
    }, 2);
  } },

  // ── effects and music loops ───────────────────────
  storm: { send: 0.3, build(e, inst) { // the finale's storm: wind, rain and a rumble, distant thunder now and then
    for (const [f, depth, rate, amp] of [[380, 200, 0.07, 0.2], [900, 400, 0.05, 0.07]]) {
      const bp = filt(e, 'bandpass', f, 1.1), g = gainNode(e, amp);
      lfo(e, inst, rate, depth, bp.frequency); lfo(e, inst, rate * 0.8, amp * 0.6, g.gain);
      chain(noiseSrc(e, inst, 'pink'), bp, g, inst.out);
    }
    rainLayer(e, inst, { body: 0.12, lp: 3000, hp: 300, patter: 0.3, patterF: 3800, patterRate: 1.2 });
    const rum = gainNode(e, 0.18); lfo(e, inst, 0.09, 0.08, rum.gain);
    chain(noiseSrc(e, inst, 'brown'), filt(e, 'lowpass', 90), rum, inst.out);
    inst.tick = (t) => {
      N(e, inst.out, { kind: 'brown', type: 'lowpass', f: 260, f2: 80, glide: 3, Q: 0.7, t, a: 0.15, peak: rand(0.2, 0.35), hold: 0.4, d: 2.6, rough: [0.2, 1, 0.55, 40] });
      whoosh(e, inst.out, t + rand(1, 3), 2.2, 300, 1100, 0.08);
      return t + rand(7, 16);
    };
  } },
  windMachine: { build(e, inst) { // the 8-slat drum under canvas: speed 0..1 (GALE ≈ 0.55-0.7, DO NOT = 1)
    const ctx = e.ctx;
    const master = gainNode(e, 0); master.connect(inst.out);
    const am = gainNode(e, 0.7); am.connect(master);
    const slat = ctx.createOscillator(), slatG = gainNode(e, 0.3);
    slat.frequency.value = 2; slat.connect(slatG); slatG.connect(am.gain); slat.start(); inst.sources.push(slat);
    const bp1 = filt(e, 'bandpass', 300, 1.2), bp2 = filt(e, 'bandpass', 1200, 3), g2 = gainNode(e, 0.25);
    chain(noiseSrc(e, inst, 'pink'), bp1, am);
    chain(noiseSrc(e, inst, 'white'), bp2, g2, am);
    const rum = gainNode(e, 0); chain(noiseSrc(e, inst, 'brown'), filt(e, 'lowpass', 150), rum, inst.out);
    Object.assign(inst, { master, slat, bp1, bp2, rum });
  }, set(e, inst, o) {
    const s = clamp(o.speed ?? 0, 0, 1), t = e.ctx.currentTime, k = 0.12;
    inst.master.gain.setTargetAtTime(0.6 * Math.pow(s, 1.2), t, k);
    inst.bp1.frequency.setTargetAtTime(220 + 1100 * s, t, k);
    inst.bp2.frequency.setTargetAtTime(900 + 2600 * s, t, k);
    inst.slat.frequency.setTargetAtTime(8 * (0.2 + 3 * s), t, k);
    inst.rum.gain.setTargetAtTime(0.14 * s, t, k);
  } },
  rainBox: { build(e, inst) { // the rain drum: dried peas tumbling round a slatted drum
    const g = gainNode(e, 0.45); lfo(e, inst, 1.1, 0.18, g.gain);
    chain(noiseSrc(e, inst, 'peas'), filt(e, 'bandpass', 2800, 0.6), g, inst.out);
    chain(noiseSrc(e, inst, 'pink'), filt(e, 'highpass', 1500), gainNode(e, 0.04), inst.out);
    chain(noiseSrc(e, inst, 'brown'), filt(e, 'lowpass', 120), gainNode(e, 0.06), inst.out);
  } },
  record: { ahead: 0.3, send: 0.15, build(e, inst) { // the 1912 record: "Burn, Old Lamp", sung by Miss Lavinia Thrush
    const ctx = e.ctx;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1500; pk.gain.value = 6; pk.Q.value = 0.9;
    const horn = filt(e, 'highpass', 320, 0.7);
    chain(horn, pk, filt(e, 'lowpass', 3000, 0.7), inst.out);
    const vin = gainNode(e, 1);
    [[800, 4, 1], [1250, 5, 0.6], [2800, 6, 0.25]].forEach(([f, q, a]) => chain(vin, filt(e, 'bandpass', f, q), gainNode(e, a), horn));
    const pb = ctx.createConstantSource(); pb.offset.value = 0; pb.start(); inst.sources.push(pb);
    const wow = ctx.createOscillator(), wg = gainNode(e, 10); wow.frequency.value = 1.3; chain(wow, wg, pb.offset); wow.start(); inst.sources.push(wow);
    const vibO = ctx.createOscillator(), vib = gainNode(e, 28); vibO.frequency.value = 5.6; vibO.connect(vib); vibO.start(); inst.sources.push(vibO);
    chain(noiseSrc(e, inst, 'crackle', 1), filt(e, 'highpass', 1200), gainNode(e, 0.12), inst.out);
    chain(noiseSrc(e, inst, 'white'), filt(e, 'bandpass', 5000, 0.5), gainNode(e, 0.008), inst.out);
    Object.assign(inst, { pb, wow, speed: 78 });
    inst.tick = scoreTicker(SCORES.burnOldLamp, (x, when, r) => {
      const d = x.d / r;
      if (x.voice === 'sing') e._sing(vin, when, mtof(x.m), d, x.v, { vib, pitchBus: pb });
      else e._piano(horn, when, mtof(x.m), d, x.v * 0.8, { pitchBus: pb, chorus: 6 });
    }, { rate: () => inst.speed / 78, gap: 1.5 });
  }, set(e, inst, o) {
    let s = o.speed ?? 78;
    if (s < 5) s *= 78;
    s = clamp(s, 40, 120); inst.speed = s;
    const t = e.ctx.currentTime;
    inst.pb.offset.setTargetAtTime(1200 * Math.log2(s / 78), t, 0.08);
    inst.wow.frequency.setTargetAtTime(s / 60, t, 0.1);
  } },

  // ── kept names (the test room and older calls) ────
  rain: { build(e, inst) { LOOPS.rainGlass.build(e, inst); } },
  hum: { build(e, inst) { LOOPS.dimmerHum.build(e, inst); } },
  wind: { build(e, inst) { LOOPS.lowWind.build(e, inst); } },
};

// ═════════════════════════════════════════════════════════════ SCORES
// An event: { t (s), m (MIDI), d (s), v (0..1), voice: 'piano' | 'sing' | 'box' | 'fx' (fn(e, dest, time)) }.

const CH = { // [bass on the ONE, bass on the second beat, the chord]
  C: [48, 43, [55, 60, 64]], F: [41, 48, [57, 60, 65]], G: [43, 50, [55, 59, 62]], G7: [43, 50, [53, 59, 62]],
  C7: [48, 43, [52, 55, 58]], Am: [45, 40, [57, 60, 64]], Dm: [50, 45, [57, 62, 65]], E7: [40, 47, [56, 59, 62]],
  Gd: [44, 50, [53, 56, 59, 62]], Bb: [46, 41, [58, 62, 65]], Fw: [41, 48, [60, 65, 69]], C7w: [48, 43, [58, 64, 67]],
};

function mel(ev, t0, unit, str, v = 0.7, voice = 'piano', legato = 0.92) {
  let t = t0;
  for (const tok of str.trim().split(/\s+/)) {
    if (tok === '|') continue;
    const [n, u = '1'] = tok.split(':'), d = parseFloat(u) * unit;
    if (n !== 'r') for (const p of n.split('+')) { const m = midi(p); if (m != null) ev.push({ t, m, d: d * legato, v, voice }); }
    t += d;
  }
  return t;
}
function march(ev, t0, unit, chords, v) { // 6/8 oom-pah: bass 1, chord 3, bass 4, chord 6
  chords.forEach((c, i) => {
    const [b1, b2, tri] = CH[c], t = t0 + i * 6 * unit;
    ev.push({ t, m: b1, d: unit * 1.8, v: v * 1.1 }, { t, m: b1 - 12, d: unit * 1.8, v: v * 0.6 });
    tri.forEach((m) => ev.push({ t: t + 2 * unit, m, d: unit * 0.8, v: v * 0.55 }));
    ev.push({ t: t + 3 * unit, m: b2, d: unit * 1.8, v });
    tri.forEach((m) => ev.push({ t: t + 5 * unit, m, d: unit * 0.8, v: v * 0.55 }));
  });
}
function waltz(ev, t0, q, chords, v) { // 3/4: bass, chord, chord
  chords.forEach((c, i) => {
    const [b1, , tri] = CH[c], t = t0 + i * 3 * q;
    ev.push({ t, m: b1, d: q * 0.95, v: v * 1.1 });
    for (const k of [1, 2]) tri.forEach((m) => ev.push({ t: t + k * q, m, d: q * 0.7, v: v * 0.55 }));
  });
}
function two(ev, t0, u, chords, v) { // 2/4 at 4 units a bar: bass, chord, bass, chord
  chords.forEach((c, i) => {
    const [b1, b2, tri] = CH[c], t = t0 + i * 4 * u;
    ev.push({ t, m: b1, d: u * 0.9, v }, { t: t + 2 * u, m: b2, d: u * 0.9, v });
    for (const k of [1, 3]) tri.forEach((m) => ev.push({ t: t + k * u, m, d: u * 0.6, v: v * 0.5 }));
  });
}
function block(ev, t0, len, chords, v) {
  chords.forEach((c, i) => {
    const [b1, , tri] = CH[c], t = t0 + i * len;
    ev.push({ t, m: b1 - 12, d: len * 0.95, v });
    tri.forEach((m) => ev.push({ t, m, d: len * 0.95, v: v * 0.6 }));
  });
}
function habanera(ev, t0, u, chords, v) { // 8 units a bar: bass 3+1+2+2, chord on 4
  chords.forEach((c, i) => {
    const [b1, b2, tri] = CH[c], t = t0 + i * 8 * u;
    ev.push({ t, m: b1, d: u * 2.7, v }, { t: t + 3 * u, m: b2, d: u * 0.9, v: v * 0.8 }, { t: t + 4 * u, m: b1, d: u * 1.8, v: v * 0.9 }, { t: t + 6 * u, m: b2, d: u * 1.8, v: v * 0.8 });
    tri.forEach((m) => ev.push({ t: t + 4 * u, m, d: u * 1.5, v: v * 0.5 }));
  });
}
function tremolo(ev, t0, s16, chords, v) { // the storm: a rumbling bass tremolo and chord stabs, 12 sixteenths a bar
  chords.forEach((c, i) => {
    const [b1, , tri] = CH[c], t = t0 + i * 12 * s16, lo = b1 > 45 ? b1 - 24 : b1 - 12;
    for (let k = 0; k < 12; k++) ev.push({ t: t + k * s16, m: k % 2 ? lo + 12 : lo, d: s16 * 0.9, v: v * (0.7 + 0.3 * (k / 12)) });
    for (const k of [0, 6]) tri.forEach((m) => ev.push({ t: t + k * s16, m, d: s16 * 2.5, v: v * 0.8 }));
  });
}
function finalChord(ev, t, v) {
  ev.push({ t, m: 36, d: 2.4, v, ring: 4 }, { t, m: 48, d: 2.4, v, ring: 4 });
  [55, 60, 64, 67, 72, 76, 84].forEach((m, i) => ev.push({ t: t + i * 0.018, m, d: 2.4, v: v * 0.8, ring: 3.2 }));
}
function stormFx(dur) {
  return (e, dest, t) => {
    whoosh(e, dest, t, dur, 250, 900, 0.09);
    N(e, dest, { kind: 'brown', type: 'lowpass', f: 140, t, a: 1.2, peak: 0.22, hold: Math.max(0.1, dur - 2.4), d: 1.2, rough: [0.3, 1, 0.6, 40] });
    N(e, dest, { kind: 'brown', type: 'lowpass', f: 300, f2: 90, glide: 2.5, t: t + dur * 0.45, a: 0.05, peak: 0.28, d: 2.4, rough: [0.2, 1, 0.5, 40] });
  };
}
function score(ev, dur, cues = {}) { ev.sort((a, b) => a.t - b.t); return { events: ev, dur, cues }; }

function buildScores() {
  const S = {};
  const E = 0.18, Q = 0.36; // 6/8 eighth (dotted quarter ≈ 111 bpm); waltz quarter: both make a 1.08 s bar
  const A_MEL = 'C5:2 E5:1 G5:2 C6:1 | B5:2 A5:1 G5:3 | A5:2 F5:1 A5:2 C6:1 | G5:3 E5:2 C5:1 | D5:2 E5:1 F5:2 G5:1 | A5:2 G5:1 E5:2 C5:1 | D5:2 G5:1 F5:2 D5:1';
  const A_CH = ['C', 'C', 'F', 'C', 'G7', 'C', 'G7'];
  { // The Empress March, the 12 s pianola cut (pit, finale Q32): theme, a cadence, the last chord at 9.72 s
    const ev = [];
    mel(ev, 0, E, A_MEL + ' | E5:2 G5:1 C6:2 E6:1 | D6:2 B5:1 G5:2 F5:1', 0.75);
    march(ev, 0, E, [...A_CH, 'C', 'G7'], 0.42);
    const lc = 9 * 6 * E;
    finalChord(ev, lc, 0.85);
    S.empressMarch = score(ev, lc + 2.3, { lastChord: lc });
  }
  { // The full overture: march, waltz middle, storm, reprise, last chord
    const ev = [];
    let t = 0;
    mel(ev, t, E, A_MEL + ' | C5:2 E5:1 G5:2 Bb5:1', 0.75);
    march(ev, t, E, [...A_CH, 'C7'], 0.42);
    t += 8 * 6 * E;
    const waltzAt = t;
    mel(ev, t, Q, 'A5:2 C6:1 | F6:3 | E6:1 D6:1 C6:1 | G5:3 | G5:2 Bb5:1 | E6:3 | D6:1 C6:1 A5:1 | F5:2 r:1', 0.55);
    waltz(ev, t, Q, ['Fw', 'Fw', 'C7w', 'C7w', 'C7w', 'C7w', 'Fw', 'Fw'], 0.32);
    t += 8 * 3 * Q;
    const stormAt = t;
    mel(ev, t, E, 'A4+A5:2 C5+C6:1 E5+E6:2 A5+A6:1 | F5:2 E5:1 D5:3 | B4:1 D5:1 F5:1 G#5:1 B5:1 D6:1 | E6:1 D6:1 B5:1 G#5:1 E5:1 D5:1 | G4:1 B4:1 D5:1 F5:1 G5:1 B5:1', 0.72);
    tremolo(ev, t, E / 2, ['Am', 'Dm', 'Gd', 'E7', 'G7'], 0.4);
    ev.push({ t, voice: 'fx', fn: stormFx(5 * 6 * E) });
    t += 5 * 6 * E;
    const repriseAt = t;
    mel(ev, t, E, 'C5+C6:2 E5+E6:1 G5+G6:2 C6+C7:1 | B4+B5:2 A4+A5:1 G4+G5:3 | D5+D6:2 B4+B5:1 G4+G5:2 F4+F5:1', 0.85);
    march(ev, t, E, ['C', 'C', 'G7'], 0.52);
    t += 3 * 6 * E;
    finalChord(ev, t, 0.95);
    S.overture = score(ev, t + 2.6, { waltz: waltzAt, storm: stormAt, reprise: repriseAt, lastChord: t });
  }
  { const ev = []; const u = 0.45; // 101: a hymn, goes downstairs
    mel(ev, 0, u, 'F5:2 E5:2 D5:2 C5:2 | D5:2 E5:2 F5:2 E5:2 | D5:2 C5:2 B4:2 C5:2', 0.6);
    block(ev, 0, 2 * u, ['F', 'C', 'G', 'C', 'G', 'C', 'F', 'C', 'G', 'C', 'G', 'C'], 0.38);
    S.hymn = score(ev, 24 * u + 1.2); }
  { const ev = []; const q = 0.4; // 102: a lullaby
    mel(ev, 0, q, 'G5:2 E5:1 | C5:3 | G5:2 E5:1 | C5:3 | D5:2 E5:1 | F5:2 D5:1 | E5:2 D5:1 | C5:3', 0.5);
    waltz(ev, 0, q, ['C', 'C', 'C', 'C', 'G7', 'G7', 'G7', 'C'], 0.24);
    S.lullaby = score(ev, 24 * q + 1.5); }
  { const ev = []; const u = 0.14; // 104: The Bishop's Bicycle (not in front of the orchestra)
    mel(ev, 0, u, 'C5:2 G5:2 E5:2 C6:2 | B5:1 Bb5:1 A5:1 Ab5:1 G5:4 | C5:2 G5:2 E5:2 C6:2 | D6:1 C6:1 B5:1 A5:1 G5:2 r:2 | A5:1 B5:1 C6:2 G5:2 E5:2 | F5:1 E5:1 D5:1 G5:1 C5:2 r:2', 0.75);
    two(ev, 0, u, ['C', 'C', 'G7', 'C', 'C', 'C', 'G7', 'C', 'F', 'C', 'G7', 'C'], 0.4);
    S.bishopsBicycle = score(ev, 48 * u + 1.2); }
  { const ev = []; const u = 0.15; // 105: a tango
    const line = 'E5:3 G5:1 C6:2 G5:2 | F5:3 E5:1 D5:4 | E5:3 G5:1 C6:2 G5:2 | B5:1 A5:1 G#5:1 A5:1 E5:4';
    mel(ev, 0, u, line + ' | ' + line, 0.65);
    habanera(ev, 0, u, ['C', 'Dm', 'C', 'E7', 'C', 'Dm', 'C', 'E7'], 0.42);
    S.tango = score(ev, 64 * u + 1.2); }
  { const ev = []; const q = 0.34; // 106: a waltz
    mel(ev, 0, q, 'C5:1 E5:1 G5:1 | E5:3 | D5:1 F5:1 A5:1 | F5:3 | E5:1 G5:1 C6:1 | B5:2 G5:1 | A5:1 G5:1 F5:1 | E5:3', 0.6);
    waltz(ev, 0, q, ['C', 'C', 'Dm', 'Dm', 'C', 'G7', 'G7', 'C'], 0.3);
    S.waltz = score(ev, 24 * q + 1.4); }
  { const ev = []; const q = 0.5; // the record: "Burn, Old Lamp" (1912), a slow ballad in F at 78 rpm
    mel(ev, 0, q, 'C5:2 A4:1 | F5:3 | D5:1 F5:1 D5:1 | C5:3 | G4:1 Bb4:1 E5:1 | F5:2 A4:1 | C5:1 E5:1 G5:1 | F5:3', 0.8, 'sing', 0.97);
    waltz(ev, 0, q, ['Fw', 'Fw', 'Bb', 'Fw', 'C7w', 'Fw', 'C7w', 'Fw'], 0.22);
    S.burnOldLamp = score(ev, 24 * q); }
  S.silence = score([], 0.05);
  return S;
}
const SCORES = buildScores();

// ═════════════════════════════════════════════════════════════ EXPORTS (bench, docs, checks)

export const SOUND_NAMES = Object.keys(SFX);
export const LOOP_NAMES = Object.keys(LOOPS);
export const TUNE_NAMES = ['empressMarch', 'hymn', 'lullaby', 'bishopsBicycle', 'tango', 'waltz'];
export const ROOM_NAMES = Object.keys(ROOM_BEDS);
export const SPEAKERS = ['lavinia', 'lavinia_off', 'pike', 'cat', 'narrator'];
export const SOUND_GROUPS = {
  UI: ['click', 'hover', 'pickup', 'drop', 'select', 'error', 'success', 'unlock', 'page', 'journalTick', 'cueLightGreen', 'chime', 'curtainSwish', 'doorOpen'],
  Door: ['doorSlam', 'keyTurn', 'latch', 'hutchDoor', 'coinDrop', 'meterCrank', 'meterOn', 'comboWheel', 'cabinetOpen', 'penScratch', 'passDoorSwing', 'kettleBoil', 'kettleWhistle', 'kettle', 'wireless', 'sofaSpring'],
  Stage: ['dipSpark', 'plugIn', 'bulbWarm', 'filamentPing', 'ghostShimmer', 'fuseSeat', 'knifeSwitch', 'workLights', 'leverNotch', 'dimmerGo', 'weightClank', 'ropeLock', 'ropeHaul', 'ropeRun', 'sandbagThud', 'bosunWhistle', 'truckRoll', 'truckTurn', 'spikeSnap', 'trapdoorBang'],
  Wardrobe: ['rackSlide', 'fabricRustle', 'squeak', 'costumeSigh', 'wigTurn', 'chalkRub', 'hatboxTopple', 'oilSquirt', 'machineSqueal', 'metronome', 'treadle', 'threadSnap', 'lensClink', 'lensSlide', 'dummyDress'],
  Pit: ['tuningFork', 'pianoString', 'pinTurn', 'rollUnspool', 'rollLoad', 'dustSheet', 'thunderSheet', 'crankSqueal', 'canvasFlap', 'governorLatch', 'gearMesh', 'gearSlip', 'trapWinch', 'harpGliss', 'snareTap', 'batonTap', 'pianoKey', 'pianoNote', 'pianoChord'],
  Foyer: ['winch', 'chainRattle', 'chandelierChime', 'chandelierOn', 'safeDial', 'safeTumbler', 'safeOpen', 'chainFall', 'doorsOpen', 'houseSwitch', 'houseLightsUp', 'ticketPrint', 'pieceSnap', 'catPurr', 'catPat', 'catMrrp'],
  Dressing: ['mirrorPivot', 'mirrorBulbs', 'ashRustle', 'drawerSlide', 'drawerThunk', 'secretDrawer', 'gramophoneWind', 'needleDrop', 'jewelWheel', 'musicBox', 'lilyShimmer'],
  Finale: ['cueStandby', 'cueGo', 'thunderCrack', 'lampBlaze', 'catApplause', 'applauseOne', 'applauseFull', 'houseBell', 'dawnBirds'],
  Kept: ['swoosh', 'whump', 'ratchet', 'candleLight'],
};
export const LOOP_GROUPS = {
  Beds: ['rainGlass', 'kettleTick', 'wirelessStatic', 'bigRoom', 'rainSkylight', 'loftCreaks', 'pitDust', 'foyerStreet', 'dressingRoom', 'houseMurmur'],
  Layers: ['dimmerHum', 'lowWind', 'chandelierTinkle', 'rainBox', 'storm'],
  Variable: ['windMachine', 'record'],
  Kept: ['rain', 'hum', 'wind'],
};

/**
 * Render one thing offline and measure it: { rawPeak (the master bus before the compressor/limiter: > 1 would clip
 * without them), peak and rms (the real output) }. spec: { kind: 'sfx'|'loop'|'room'|'blip'|'music', name, opts,
 * seconds }. The bench's "offline sweep" calls this for every name.
 */
export async function measureOffline({ kind = 'sfx', name, opts = {}, seconds = 3, sampleRate = 44100 }) {
  const ctx = new OfflineAudioContext(4, Math.ceil(sampleRate * seconds), sampleRate);
  const e = new AudioEngine({ context: ctx, measure: true });
  if (kind === 'sfx') e.play(name, opts);
  else if (kind === 'loop') e.loop(name, { ...opts, fade: 0.05 });
  else if (kind === 'room') e.setRoomAmbience(name);
  else if (kind === 'blip') { for (let i = 0; i < 24; i++) e.blip(name, { ...opts, index: i + 1, when: 0.05 + i * 0.07, pitch: (VOICES[name]?.ref ?? 1) * (1 + (Math.random() - 0.5) * 0.12) }); }
  else if (kind === 'music') { if (name === 'overture') e.overture.play(opts); else e.pianola(name, opts); }
  e._schedule(seconds);
  const buf = await ctx.startRendering();
  let rawPeak = 0, peak = 0, sum = 0;
  const ch = [0, 1, 2, 3].map((c) => buf.getChannelData(c));
  for (let i = 0; i < buf.length; i++) {
    const r = Math.max(Math.abs(ch[0][i]), Math.abs(ch[1][i])), o = Math.max(Math.abs(ch[2][i]), Math.abs(ch[3][i]));
    if (r > rawPeak) rawPeak = r;
    if (o > peak) peak = o;
    sum += ch[2][i] * ch[2][i];
  }
  return { rawPeak, peak, rms: Math.sqrt(sum / buf.length) };
}

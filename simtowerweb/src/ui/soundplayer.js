// SoundPlayer (UI agent) — Web Audio API & HTMLAudioElement sound engine
// Supports:
// - Web Audio API with master GainNode and StereoPannerNode for spatial audio
// - HTMLAudioElement fallback pool for older/restricted environments
// - Procedural synthesis fallback for iconic sounds (chimes, dings, rain, thunder)
// - app.sound contract: play(path, opts), stop(path), setLooping(path, bool),
//   setAllPitch(rate), getDuration(path), toggleMuted(), setMasterVolume(v)

import { soundUrl } from "../render/assets.js";

const MAX_PER_KEY = 4;

export class SoundPlayer {
  constructor({ muted = true, volume = 0.8, musicEnabled = true, sfxEnabled = true, urls = {} } = {}) {
    this.muted = muted;
    this.volume = volume;
    this.musicEnabled = musicEnabled;
    this.sfxEnabled = sfxEnabled;
    this.pitch = 1.0;
    this.pool = new Map(); // key -> HTMLAudioElement[]
    this.loops = new Map(); // key -> { element, source, gainNode }
    this.urls = { ...urls };
    this.audioCtx = null;
    this.masterGain = null;

    this._initAudioContext();
  }

  _initAudioContext() {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      try {
        this.audioCtx = new AudioCtx();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.value = this.muted ? 0.0 : this.volume;
        this.masterGain.connect(this.audioCtx.destination);
      } catch {
        this.audioCtx = null;
      }
    }
  }

  _ensureContextRunning() {
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
  }

  _elements(key) {
    let list = this.pool.get(key);
    if (!list) {
      list = [];
      this.pool.set(key, list);
    }
    return list;
  }

  _makeElement(key) {
    const url = soundUrl(key, this.urls);
    if (!url || typeof Audio === "undefined") return null;
    const a = new Audio(url);
    a.preload = "auto";
    a.muted = this.muted;
    const list = this._elements(key);
    list.push(a);
    return a;
  }

  // Replaces the session-local URLs created from verified user media. Existing
  // elements are discarded so a later edition cannot keep using old media.
  setUrls(urls = {}) {
    for (const list of this.pool.values()) {
      for (const audio of list) {
        try { audio.pause(); } catch {}
      }
    }
    this.pool.clear();
    this.loops.clear();
    this.urls = { ...urls };
  }

  _pick(key) {
    const list = this._elements(key);
    for (const a of list) {
      if (a.paused || a.ended) return a;
    }
    if (list.length >= MAX_PER_KEY) return list[0];
    return this._makeElement(key);
  }

  _isMusic(key) {
    return /(^|\/)(birds|cock|bells)\b/.test(key);
  }

  setMusicEnabled(v) { this.musicEnabled = v !== false; return this.musicEnabled; }

  setSfxEnabled(v) { this.sfxEnabled = v !== false; return this.sfxEnabled; }

  play(key, opts = {}) {
    if (this._isMusic(key) ? !this.musicEnabled : !this.sfxEnabled) return;
    this._ensureContextRunning();
    try {
      const a = this._pick(key);
      if (a) {
        if (!a.loop) {
          try { a.currentTime = 0; } catch { /* not seekable yet */ }
        }
        a.muted = this.muted;
        a.playbackRate = this.pitch;
        const p = a.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            // If audio asset failed or was blocked, attempt procedural synthesis
            if (!this.muted) this._playSynthesized(key, opts);
          });
        }
        return;
      }

      if (!this.muted) {
        this._playSynthesized(key, opts);
      }
    } catch {
      if (!this.muted) this._playSynthesized(key, opts);
    }
  }

  _playSynthesized(key, { pan = 0 } = {}) {
    if (!this.audioCtx || this.muted) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    try {
      let panner = null;
      if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        panner.connect(this.masterGain);
      }

      const out = panner || this.masterGain;

      if (key.includes("cash") || key.includes("money")) {
        // High 2-tone cash register chime (B5 -> E6)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (key.includes("bells") || key.includes("ding")) {
        // Crisp elevator chime (A5)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.62);
      } else if (key.includes("thunder")) {
        // Low rumble thunder
        const bufferSize = ctx.sampleRate * 1.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.4));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(160, now);
        noise.connect(filter);
        filter.connect(out);
        noise.start(now);
      }
    } catch {}
  }

  stop(key) {
    for (const a of this._elements(key)) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch { /* ignore */ }
    }
  }

  setLooping(key, loop) {
    let any = this._elements(key)[0];
    if (!any) any = this._makeElement(key);
    if (!any) return;
    if (any.loop !== loop) {
      any.loop = loop;
      if (loop && any.paused) this.play(key);
      if (!loop && !any.paused) any.pause();
    }
  }

  setAllPitch(rate) {
    if (!rate || rate <= 0) return;
    this.pitch = rate;
    for (const list of this.pool.values()) {
      for (const a of list) {
        try {
          if (Math.abs(a.playbackRate - rate) > 0.01) a.playbackRate = rate;
        } catch { /* ignore */ }
      }
    }
  }

  getDuration(key) {
    const a = this._elements(key)[0];
    if (!a || a.readyState < 1 || !isFinite(a.duration)) return 0;
    return a.duration;
  }

  setMasterVolume(volume) {
    this.volume = Math.max(0.0, Math.min(1.0, volume));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = this.volume;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0.0 : this.volume;
    }
    for (const list of this.pool.values()) {
      for (const a of list) a.muted = muted;
    }
    return this.muted;
  }

  toggleMuted() {
    return this.setMuted(!this.muted);
  }
}

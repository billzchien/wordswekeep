/* Words We Keep — the background music (the home page and its menu; md/checks/music tunes it).
   One looping track per category, "all" for All words, listed in music.json beside the files
   (an R2 bucket: media.wordswekeep.org; locally assets/music/r2/, never committed).
   Web Audio, not <audio loop>: a decoded buffer loops on the sample, so there is no gap at the
   loop point, and every start, stop and change is a gain ramp — nothing ever starts or stops
   suddenly. The files are AAC from ffmpeg's encoder: each has 1024 samples of priming that a
   browser either drops (the file's edit list) or keeps; music.json gives each track's exact
   length, so the loop is cut to it either way (bounds()). */
(() => {
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const SRC = LOCAL ? '/assets/music/r2/' : 'https://media.wordswekeep.org/';
  const RATE = 44100;      // the files' sample rate; the context runs at it, so nothing is resampled
  const PRIMING = 1024;    // AAC encoder delay, for a browser that keeps it
  const FADE_S = 4;        // every fade in and out (Bill, 2026-10-12)
  let VOLUME = 0.2;        // the music's level, 0–1 (Bill, 2026-10-12, with md/checks/music)

  let ctx = null, master = null, list = null, voice = null, lastFile = {};
  const buffers = new Map();

  const context = () => {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    try { ctx = new AC({ sampleRate: RATE }); } catch { ctx = new AC(); }
    master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
    return ctx;
  };

  const manifest = () => list || (list = fetch(SRC + 'music.json').then((r) => r.json()));

  // A category's track; with several, a different one from last time.
  const pick = async (key) => {
    const all = await manifest();
    const tracks = all[key] || all.all;
    let t = tracks[Math.floor(Math.random() * tracks.length)];
    if (tracks.length > 1 && t.file === lastFile[key]) t = tracks[(tracks.indexOf(t) + 1) % tracks.length];
    lastFile[key] = t.file;
    return t;
  };

  const decode = (file) => {
    if (!buffers.has(file)) {
      const p = fetch(SRC + file).then((r) => r.arrayBuffer())
        .then((data) => new Promise((ok, no) => context().decodeAudioData(data, ok, no)));
      p.catch(() => buffers.delete(file));
      buffers.set(file, p);
    }
    return buffers.get(file);
  };

  // Where the loop is inside the decoded buffer, in seconds. Each file carries `lead` samples of
  // the loop's end before it and as many of its start after it (so the encoder saw the seam as
  // continuous, and nothing clicks there); the loop is the `samples` in between.
  const bounds = (buf, track) => {
    const k = buf.sampleRate / RATE, lead = track.lead || 0;
    const n = track.samples * k, whole = (track.samples + 2 * lead) * k;
    const skip = buf.length >= whole + PRIMING * k - 2 ? PRIMING * k : 0;
    const start = Math.round(skip + lead * k);
    return { start: start / buf.sampleRate, end: (start + Math.round(n)) / buf.sampleRate };
  };

  // A gain glides from where it is to `to` over `s` seconds: a sine in, a cosine out, so two
  // tracks crossing keep the same loudness between them.
  const ramp = (v, to, s = FADE_S) => {
    const now = context().currentTime;
    const from = v.level(now);
    const steps = 64, curve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const k = to > from ? Math.sin(t * Math.PI / 2) : 1 - Math.cos(t * Math.PI / 2);
      curve[i] = from + (to - from) * k;
    }
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(from, now);
    if (s > 0 && from !== to) v.gain.gain.setValueCurveAtTime(curve, now, s);
    else v.gain.gain.setValueAtTime(to, now);
    v.from = from; v.to = to; v.t0 = now; v.t1 = now + s;
  };

  // A playing track: buffer → its own gain → master.
  const start = (buf, track, key) => {
    const c = context();
    const b = bounds(buf, track);
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true; src.loopStart = b.start; src.loopEnd = b.end;
    const gain = c.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(master);
    src.start(0, b.start);
    const v = { key, track, src, gain, from: 0, to: 0, t0: 0, t1: 0, on: false,
      level(now) { // where the gain is now (the curve is ours, so it is worked out, not read)
        if (now >= this.t1) return this.to;
        const t = (now - this.t0) / (this.t1 - this.t0);
        const k = this.to > this.from ? Math.sin(t * Math.PI / 2) : 1 - Math.cos(t * Math.PI / 2);
        return this.from + (this.to - this.from) * k;
      } };
    return v;
  };

  const retire = (v) => {
    if (!v) return;
    ramp(v, 0);
    setTimeout(() => { try { v.src.stop(); } catch {} v.src.disconnect(); v.gain.disconnect(); }, FADE_S * 1000 + 100);
  };

  let want = null;        // { key, on } — the last thing asked for; anything older is dropped
  let suspendTimer = 0;

  // Play `key`'s music (fading in), or cross over to it from what is playing.
  const play = async (key) => {
    const ask = want = { key, on: true };
    const c = context();
    session('playback');
    clearTimeout(suspendTimer);
    if (c.state !== 'running') c.resume().catch(() => {});
    if (voice && voice.key === key) { if (!voice.on) { voice.on = true; ramp(voice, 1); } emit(); return; }
    const track = await pick(key);
    const buf = await decode(track.file).catch(() => null);
    if (want !== ask || !buf) return;
    retire(voice);
    voice = start(buf, track, key);
    voice.on = true;
    ramp(voice, 1);
    emit();
  };

  // Fade out; once silent, the context is suspended (no work, no battery) and keeps its place.
  const stop = () => {
    want = { key: voice && voice.key, on: false };
    if (!voice || !voice.on) return;
    voice.on = false;
    ramp(voice, 0);
    session('auto'); // at once: the page's other players are not held to it while the music fades
    emit();
    clearTimeout(suspendTimer);
    suspendTimer = setTimeout(() => { if (!voice || !voice.on) ctx.suspend().catch(() => {}); }, FADE_S * 1000 + 100);
  };

  // The browser lets sound start only after a click, tap or key (autoplay rules): true once it may.
  const unlocked = () => !!ctx && ctx.state === 'running';

  // Safari (iPhone): while the music plays the page's sound is 'playback' — it plays with the
  // silent switch on, as a video does (Bill keeps the switch on; 'ambient', tried first, was
  // muted by it), and, like a video, it pauses another app's sound. The type is the whole page's,
  // the Spotify, Apple Music and YouTube players in notes included, so as the music starts to fade
  // out it goes back to 'auto'.
  const session = (type) => { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch {} };

  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f(api.state()));

  const api = {
    play, stop,
    prefetch: async (key) => { const t = await pick(key); lastFile[key] = undefined; decode(t.file).catch(() => {}); },
    unlock: () => { const c = context(); if (c.state !== 'running') return c.resume().catch(() => {}); return Promise.resolve(); },
    unlocked,
    setVolume: (v) => { VOLUME = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    volume: () => VOLUME,
    state: () => ({ playing: !!(voice && voice.on), key: voice && voice.key, name: voice && voice.track.name }),
    trackName: async (key) => { const all = await manifest(); return (all[key] || all.all)[0].name; },
    on: (f) => listeners.add(f),
    // for md/checks/music
    _debug: () => ({ ctx, voice, buffers, bounds, decode, manifest, SRC }),
  };
  window.Music = api;
})();

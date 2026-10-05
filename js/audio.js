'use strict';
/* ECHOFALL — procedural audio: SFX synthesis, convolution reverb, composed adaptive score.
   Design hook: every Perfect Guard rings the next note of the antagonist's leitmotif —
   the same melody the score is built on. */
(function (G) {
  const U = G.U;
  let ctx = null, master, comp, sfxBus, musicBus, revIn, revOut, noiseBuf, tone_lp;
  const vol = { master: 0.8, music: 0.6, sfx: 0.85 };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function makeImpulse(seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < rate * 0.01 ? i / (rate * 0.01) : 1);
    }
    return buf;
  }

  const A = G.Audio = {
    ready: false,
    init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.006; comp.release.value = 0.25;
      // gentle top-end roll-off keeps synthesized noise from sounding brittle
      tone_lp = ctx.createBiquadFilter(); tone_lp.type = 'lowpass'; tone_lp.frequency.value = 11000; tone_lp.Q.value = 0.5;
      master.connect(tone_lp); tone_lp.connect(comp); comp.connect(ctx.destination);
      this.meter = ctx.createAnalyser(); this.meter.fftSize = 2048; comp.connect(this.meter);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.connect(master);
      revIn = ctx.createConvolver(); revIn.buffer = makeImpulse(3.4, 2.4);
      revOut = ctx.createGain(); revOut.gain.value = 0.5;
      revIn.connect(revOut); revOut.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      // pinkish noise (softer than white)
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < nd.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; nd[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      this.ready = true;
      this.applyVolumes();
      Music.setup();
      Amb.setup();
      if (ctx.state === 'suspended') ctx.resume();
    },
    setVolumes(m, mu, s) { vol.master = m; vol.music = mu; vol.sfx = s; this.applyVolumes(); },
    applyVolumes() {
      if (!ctx) return;
      master.gain.value = vol.master;
      musicBus.gain.value = vol.music * 1.75;
      sfxBus.gain.value = vol.sfx * 0.8;
    },
    get t() { return ctx ? ctx.currentTime : 0; },
    // output loudness (RMS, dBFS) — used by the settings screen and for diagnostics
    level() {
      if (!this.meter) return -Infinity;
      const b = new Float32Array(this.meter.fftSize); this.meter.getFloatTimeDomainData(b);
      let s = 0; for (const v of b) s += v * v;
      return 20 * Math.log10(Math.sqrt(s / b.length) + 1e-9);
    },
    get state() { return ctx ? ctx.state : 'none'; },
  };

  /* ---------- primitive voices ---------- */
  function out(node, wet = 0.15, dest) {
    node.connect(dest || sfxBus);
    if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(revIn); }
  }
  function env(g, t, a, peak, d, sus = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d);
  }
  function tone(type, freq, t, a, peak, d, opts = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(opts.to, 1), t + (opts.toT || a + d));
    if (opts.detune) o.detune.value = opts.detune;
    env(g, t, a, peak, d);
    o.connect(g);
    let last = g;
    if (opts.filter) { const f = ctx.createBiquadFilter(); f.type = opts.filter; f.frequency.value = opts.ff || 1000; f.Q.value = opts.q || 0.7; g.connect(f); last = f; }
    out(last, opts.wet ?? 0.15, opts.dest);
    o.start(t); o.stop(t + a + d + 0.05);
    return o;
  }
  function noise(t, a, peak, d, type = 'bandpass', f0 = 1000, f1 = null, q = 1, wet = 0.12, dest) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    const g = ctx.createGain(); env(g, t, a, peak, d);
    s.connect(f); f.connect(g); out(g, wet, dest);
    s.start(t, Math.random()); s.stop(t + a + d + 0.05);
  }
  // struck metal / glass: inharmonic partials, the brighter ones die first
  function bell(freq, t, peak = 0.2, dur = 1.6, wet = 0.5, bright = 1, dest) {
    const ratios = [1, 2.0, 2.76, 4.07];
    const amps = [1, 0.3, 0.32 * bright, 0.12 * bright];
    ratios.forEach((r, i) => tone('sine', freq * r, t, 0.003, peak * amps[i], dur / (1 + i * 0.8), { wet, dest }));
  }

  /* ---------- SFX library ---------- */
  const theme = [74, 77, 81, 79, 77, 76, 74, 72, 74, 69, 70, 72, 74, 81];
  let themeIdx = 0;
  const S = G.SFX = {
    play(name, ...args) { if (!ctx || !A.ready) return; try { this[name] && this[name](ctx.currentTime, ...args); } catch (e) { /* noop */ } },
    // blade cutting air: a fast filtered-noise swish that falls in pitch
    slash(t, pitch = 1, heavy = false) {
      noise(t, 0.02, heavy ? 0.55 : 0.38, heavy ? 0.26 : 0.17, 'bandpass', 2600 * pitch, 520, 0.9, 0.12);
      noise(t + 0.01, 0.03, heavy ? 0.25 : 0.12, 0.12, 'lowpass', 900, 300, 0.7, 0.05);
      tone('sine', 1320 * pitch, t, 0.004, 0.012, 0.18, { to: 1180 * pitch, wet: 0.35 });
    },
    // impact: low body thump + short crunch
    hit(t, power = 1) {
      tone('sine', 120, t, 0.003, 0.5 * power, 0.18, { to: 45, wet: 0.04 });
      noise(t, 0.002, 0.42 * power, 0.07, 'lowpass', 2600, 700, 0.7, 0.06);
      noise(t + 0.004, 0.002, 0.16 * power, 0.05, 'bandpass', 3200, 1800, 1.2, 0.08);
    },
    flesh(t) { noise(t, 0.004, 0.16, 0.1, 'lowpass', 1200, 300, 0.7, 0.03); },
    // something to find nearby: two soft bell partials, rising
    discover(t) { bell(mtof(86), t, 0.05, 1.6, 0, 0.5); bell(mtof(93), t + 0.12, 0.045, 1.8, 0, 0.5); },
    // heavy-blow body: a sub thump under the crack so big hits land in the chest
    impact(t) { tone('sine', 78, t, 0.003, 0.5, 0.22, { to: 34, wet: 0.08 }); noise(t, 0.002, 0.2, 0.12, 'lowpass', 700, 120, 0.7, 0.05); },
    crystal(t, n = 5) {
      for (let i = 0; i < n; i++) {
        const f = 1300 + Math.random() * 2300, d = Math.random() * 0.1;
        tone('sine', f, t + d, 0.002, 0.035, 0.3 + Math.random() * 0.4, { wet: 0.55 });
      }
      noise(t, 0.003, 0.18, 0.22, 'highpass', 2600, 4200, 0.6, 0.3);
    },
    parry(t, perfect) {
      if (perfect) {
        const m = theme[themeIdx++ % theme.length];
        bell(mtof(m), t, 0.2, 2.4, 0.65, 0.9);
        bell(mtof(m - 12), t, 0.12, 1.8, 0.55, 0.4);
        noise(t, 0.001, 0.32, 0.05, 'bandpass', 3500, 2400, 1.4, 0.35);
        tone('sine', 90, t, 0.002, 0.4, 0.28, { to: 45, wet: 0.1 });
      } else {
        bell(440 + Math.random() * 30, t, 0.1, 0.45, 0.25, 0.4);
        noise(t, 0.001, 0.26, 0.07, 'bandpass', 1800, 900, 1.1, 0.12);
        tone('sine', 140, t, 0.002, 0.2, 0.1, { to: 70, wet: 0.02 });
      }
    },
    resetTheme() { themeIdx = 0; },
    dodge(t) { noise(t, 0.05, 0.2, 0.2, 'bandpass', 500, 1600, 0.8, 0.08); },
    perfectDodge(t) {
      noise(t, 0.22, 0.16, 0.3, 'bandpass', 300, 2400, 1.0, 0.6);
      tone('sine', 60, t, 0.01, 0.45, 0.7, { to: 32, wet: 0.2 });
      bell(mtof(81), t + 0.05, 0.07, 1.6, 0.8, 0.4);
    },
    jump(t) { noise(t, 0.012, 0.09, 0.1, 'bandpass', 700, 1300, 0.8, 0.04); },
    land(t, k = 1) { tone('sine', 95, t, 0.003, 0.22 * k, 0.11, { to: 48, wet: 0.02 }); noise(t, 0.002, 0.1 * k, 0.09, 'lowpass', 800, 200, 0.7, 0.02); },
    step(t) { noise(t, 0.002, 0.04, 0.05, 'lowpass', 900 + Math.random() * 300, 300, 0.6, 0.0); },
    hurt(t) {
      tone('triangle', 180, t, 0.005, 0.18, 0.22, { to: 80, filter: 'lowpass', ff: 900 });
      this.hit(t, 0.8);
    },
    // attack tells: white = bright glint, red = low warning swell
    tellWhite(t) { tone('sine', mtof(93), t, 0.003, 0.05, 0.4, { wet: 0.7 }); tone('sine', mtof(100), t + 0.02, 0.003, 0.025, 0.3, { wet: 0.7 }); },
    tellRed(t) {
      tone('sawtooth', 62, t, 0.08, 0.18, 0.45, { to: 98, filter: 'lowpass', ff: 520, wet: 0.35 });
      tone('sine', 124, t, 0.08, 0.14, 0.45, { to: 196, wet: 0.3 });
    },
    whoosh(t, k = 1) { noise(t, 0.07, 0.15 * k, 0.24, 'bandpass', 380, 1500, 0.8, 0.1); },
    enemyDie(t) { this.crystal(t, 6); tone('sine', 65, t, 0.005, 0.3, 0.45, { to: 32, wet: 0.2 }); },
    orb(t) { tone('sine', 520, t, 0.02, 0.07, 0.35, { to: 780, wet: 0.45 }); },
    shriek(t) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 680; lfo.frequency.value = 26; lg.gain.value = 90;
      lfo.connect(lg); lg.connect(o.frequency);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 2;
      env(g, t, 0.06, 0.05, 0.45); o.connect(f); f.connect(g); out(g, 0.45);
      o.start(t); lfo.start(t); o.stop(t + 0.55); lfo.stop(t + 0.55);
    },
    skill1(t) { this.whoosh(t, 1.5); this.slash(t + 0.05, 0.8, true); bell(mtof(86), t + 0.08, 0.05, 1.2, 0.7, 0.4); },
    skill2(t) {
      tone('sine', 48, t, 0.005, 0.7, 0.9, { to: 28, wet: 0.2 });
      [62, 65, 69, 74].forEach((m, i) => bell(mtof(m), t + i * 0.035, 0.07, 2.2, 0.8, 0.5));
      noise(t, 0.005, 0.35, 0.45, 'lowpass', 1800, 180, 0.7, 0.3);
    },
    execute(t) {
      tone('sine', 55, t, 0.005, 0.8, 1.1, { to: 26, wet: 0.3 });
      noise(t, 0.35, 0.2, 0.05, 'bandpass', 500, 3000, 0.7, 0.5);
      bell(mtof(62), t, 0.13, 2.6, 0.85, 0.7); bell(mtof(69), t + 0.02, 0.09, 2.6, 0.85, 0.7);
    },
    heal(t) { [74, 78, 81, 86].forEach((m, i) => tone('sine', mtof(m), t + i * 0.08, 0.01, 0.06, 0.9, { wet: 0.7 })); },
    pickup(t) { tone('sine', mtof(84 + Math.floor(Math.random() * 3) * 2), t, 0.003, 0.03, 0.22, { wet: 0.5 }); },
    pylon(t) {
      [50, 57, 62, 65, 69, 74].forEach((m, i) => tone('triangle', mtof(m), t + i * 0.12, 0.3, 0.045, 2.4, { wet: 0.8 }));
      bell(mtof(86), t + 0.8, 0.05, 3, 0.9, 0.4);
    },
    ui(t) { tone('sine', 880, t, 0.002, 0.025, 0.06, { wet: 0.1 }); },
    uiOk(t) { tone('sine', 988, t, 0.002, 0.04, 0.1, { wet: 0.3 }); tone('sine', 1319, t + 0.06, 0.002, 0.035, 0.18, { wet: 0.4 }); },
    uiBack(t) { tone('sine', 740, t, 0.002, 0.035, 0.12, { to: 520, wet: 0.2 }); },
    roar(t) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'triangle'; o.frequency.setValueAtTime(98, t); o.frequency.exponentialRampToValueAtTime(52, t + 1.6);
      o2.frequency.setValueAtTime(147, t); o2.frequency.exponentialRampToValueAtTime(70, t + 1.6);
      lfo.frequency.value = 9; lg.gain.value = 6; lfo.connect(lg); lg.connect(o.frequency);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      env(g, t, 0.2, 0.3, 1.6); o.connect(f); o2.connect(f); f.connect(g); out(g, 0.6);
      [o, o2, lfo].forEach((n) => { n.start(t); n.stop(t + 1.9); });
      noise(t, 0.25, 0.18, 1.3, 'bandpass', 500, 180, 0.8, 0.5);
      [74, 77, 81].forEach((m) => choirVoice(mtof(m), t + 0.2, 1.6, 0.035, sfxBus));
    },
    quake(t) { tone('sine', 42, t, 0.01, 0.6, 0.7, { to: 26, wet: 0.2 }); noise(t, 0.01, 0.28, 0.55, 'lowpass', 500, 90, 0.7, 0.3); },
    pillar(t) { this.crystal(t, 3); tone('sine', 85, t, 0.01, 0.2, 0.3, { to: 42, wet: 0.1 }); },
    death(t) {
      [62, 61, 57, 50].forEach((m, i) => pianoVoice(mtof(m), t + i * 0.45, 0.16, sfxBus, 2.4));
      tone('sine', 45, t, 0.02, 0.35, 2, { to: 30, wet: 0.4 });
    },
    door(t) { tone('sine', 55, t, 0.1, 0.22, 0.8, { to: 45, wet: 0.4 }); noise(t, 0.05, 0.12, 0.6, 'lowpass', 400, 120, 0.7, 0.3); this.crystal(t, 2); },
    note(t) { tone('sine', mtof(81), t, 0.01, 0.05, 1.1, { wet: 0.8 }); tone('sine', mtof(88), t + 0.12, 0.01, 0.035, 1.1, { wet: 0.8 }); },
    musicbox(t) {
      [74, 77, 81, 79, 77, 76, 74].forEach((m, i) => bell(mtof(m + 12), t + i * 0.34, 0.05, 1.0, 0.6, 0.3));
    },
    /* --- foley --- */
    // footsteps: heel + scuff, tuned to the surface underfoot
    stepOn(t, surface = 'concrete', weight = 1) {
      const v = 0.75 + Math.random() * 0.5;
      if (surface === 'metal') {
        tone('sine', 380 + Math.random() * 60, t, 0.001, 0.05 * v * weight, 0.12, { wet: 0.25 });
        tone('sine', 1150 + Math.random() * 200, t, 0.001, 0.02 * v * weight, 0.1, { wet: 0.25 });
        noise(t, 0.001, 0.07 * v * weight, 0.04, 'bandpass', 2400, 1600, 1.2, 0.05);
      } else {
        tone('sine', 85 + Math.random() * 20, t, 0.002, 0.09 * v * weight, 0.06, { to: 55, wet: 0.02 });
        noise(t, 0.002, 0.07 * v * weight, 0.05, 'bandpass', 1400 + Math.random() * 900, 700, 0.9, 0.03);
        noise(t + 0.03, 0.01, 0.03 * v * weight, 0.06, 'highpass', 3500, 5000, 0.7, 0.02); // grit
      }
    },
    cloth(t, k = 1) { noise(t, 0.03, 0.06 * k, 0.12, 'bandpass', 1800, 900, 0.6, 0.04); },
    armor(t) { tone('sine', 2100 + Math.random() * 400, t, 0.001, 0.012, 0.12, { wet: 0.3 }); noise(t, 0.002, 0.04, 0.04, 'bandpass', 4200, 3000, 2, 0.05); },
    bump(t) { tone('sine', 70, t, 0.002, 0.18, 0.12, { to: 45 }); noise(t, 0.002, 0.06, 0.08, 'lowpass', 600, 200, 0.7, 0.03); },
    // blade resonance while charging: rises with charge level
    chargeHum(t, k) { tone('sine', 220 + 330 * k, t, 0.02, 0.025 + 0.02 * k, 0.12, { wet: 0.4 }); tone('sine', (220 + 330 * k) * 2.01, t, 0.02, 0.012, 0.12, { wet: 0.4 }); },
    /* --- creatures --- */
    growl(t, pitch = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(85 * pitch, t); o.frequency.linearRampToValueAtTime(70 * pitch, t + 0.5);
      lfo.frequency.value = 18 + Math.random() * 8; lg.gain.value = 14 * pitch; lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'bandpass'; f.frequency.value = 520 * pitch; f.Q.value = 1.6;
      env(g, t, 0.06, 0.09, 0.45); o.connect(f); f.connect(g); out(g, 0.35);
      o.start(t); lfo.start(t); o.stop(t + 0.6); lfo.stop(t + 0.6);
      noise(t, 0.05, 0.05, 0.4, 'bandpass', 900 * pitch, 500 * pitch, 1.4, 0.2);
    },
    skitter(t) { for (let i = 0; i < 5; i++) noise(t + i * 0.035 + Math.random() * 0.01, 0.001, 0.05, 0.02, 'bandpass', 3000 + Math.random() * 1500, 2500, 3, 0.04); },
    hiss(t) { noise(t, 0.08, 0.1, 0.5, 'highpass', 3200, 5200, 0.7, 0.3); tone('sine', 1650, t, 0.05, 0.015, 0.45, { to: 1500, wet: 0.5 }); },
    heavyStep(t) { tone('sine', 60, t, 0.003, 0.22, 0.18, { to: 38, wet: 0.08 }); noise(t, 0.002, 0.08, 0.1, 'lowpass', 500, 150, 0.7, 0.05); tone('sine', 900, t + 0.01, 0.001, 0.012, 0.15, { wet: 0.3 }); },
    bossVoice(t, k = 1) {
      // whispered choir stab: the conductor speaks in chords
      [74, 77, 81, 86].forEach((m, i) => choirVoice(mtof(m - (k > 1 ? 1 : 0)), t + i * 0.02, 0.9, 0.035, sfxBus));
      noise(t, 0.2, 0.06, 0.8, 'bandpass', 2400, 1200, 2, 0.6);
    },
    /* --- stingers --- */
    stingBattle(t) {
      drum('timpani', t, 0.6, sfxBus); drum('timpani', t + 0.18, 0.45, sfxBus);
      [50, 53, 57].forEach((m) => stringVoice(mtof(m), t, 0.9, 0.05, sfxBus, 2200));
      tone('sawtooth', mtof(38), t, 0.02, 0.08, 0.9, { filter: 'lowpass', ff: 400, wet: 0.3 });
    },
    stingVictory(t) {
      [62, 66, 69, 74].forEach((m, i) => pianoVoice(mtof(m), t + i * 0.09, 0.12, sfxBus, 2.6));
      [50, 57, 62].forEach((m) => stringVoice(mtof(m), t + 0.2, 1.8, 0.04, sfxBus, 1600));
    },
    heartbeat(t, k = 1) { tone('sine', 55, t, 0.005, 0.32 * k, 0.12, { to: 40 }); tone('sine', 52, t + 0.2, 0.005, 0.22 * k, 0.12, { to: 38 }); },
    pageOpen(t) { noise(t, 0.04, 0.05, 0.18, 'bandpass', 900, 2600, 0.7, 0.2); },
  };

  /* ---------- environmental ambience: per-zone beds + scattered one-shots ---------- */
  const Amb = G.Ambience = {
    zone: null, nodes: null, nextEvt: 0, timer: null,
    setup() {
      const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(sfxBus);
      const rev = ctx.createGain(); rev.gain.value = 0.4; bus.connect(rev); rev.connect(revIn);
      // continuous wind: two band-limited noise loops with slow gusts
      const mkWind = (f0, q, lfoRate) => {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = f0; f.Q.value = q;
        const g = ctx.createGain(); g.gain.value = 0;
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = lfoRate; lg.gain.value = f0 * 0.45; lfo.connect(lg); lg.connect(f.frequency);
        s.connect(f); f.connect(g); g.connect(bus); s.start(); lfo.start();
        return g;
      };
      const drone = ctx.createGain(); drone.gain.value = 0; drone.connect(bus);
      [36.7, 37.1, 55.2].forEach((fq) => { const o = ctx.createOscillator(); o.frequency.value = fq; const g = ctx.createGain(); g.gain.value = 0.25; o.connect(g); g.connect(drone); o.start(); });
      this.nodes = { bus, windLow: mkWind(320, 0.6, 0.07), windHigh: mkWind(1400, 1.1, 0.13), drone };
      this.timer = setInterval(() => this.tick(), 200);
    },
    set(zone) {
      if (!ctx || !this.nodes) return;
      if (zone === this.zone) return; this.zone = zone;
      const n = this.nodes, now = ctx.currentTime;
      const zd = this.ZONES[zone], P = zd ? zd.bed : [0, 0, 0, 0];
      n.bus.gain.setTargetAtTime(zone === 'off' ? 0 : 1, now, 1.2);
      n.windLow.gain.setTargetAtTime(P[0], now, 1.5); n.windHigh.gain.setTargetAtTime(P[1], now, 1.5); n.drone.gain.setTargetAtTime(P[3] * 0.12, now, 2);
      this.evtRate = P[2];
    },
    // bed = [low wind, high wind, (unused), drone]; evt(t, kit) plays one random one-shot
    ZONES: {
      city: { bed: [0.55, 0.18, 0.06, 0] }, roof: { bed: [0.8, 0.45, 0.12, 0] }, cathedral: { bed: [0.35, 0.08, 0.04, 0.5] },
      quiet: { bed: [0.25, 0.05, 0.02, 0] }, off: { bed: [0, 0, 0, 0] },
    },
    define(name, def) { this.ZONES[name] = def; },
    tick() {
      if (!ctx || !this.zone || this.zone === 'off') return;
      if (ctx.currentTime < this.nextEvt) return;
      const zd = this.ZONES[this.zone];
      this.nextEvt = ctx.currentTime + (zd && zd.gap ? zd.gap[0] + Math.random() * zd.gap[1] : 2.5 + Math.random() * 6);
      const t = ctx.currentTime + 0.05, z = this.zone;
      if (zd && zd.evt) { try { zd.evt(t, G.AudioKit); } catch (e) { /* noop */ } return; }
      if (z === 'cathedral') {
        if (Math.random() < 0.5) bell(mtof(38 + 12), t, 0.06, 5, 0.9, 0.6); // distant toll
        else S.crystal(t, 2);
      } else {
        const r = Math.random();
        if (r < 0.35) { tone('sine', 140 + Math.random() * 60, t, 0.3, 0.025, 1.4, { to: 110, wet: 0.7 }); } // metal creak
        else if (r < 0.6) { for (let i = 0; i < 6; i++) noise(t + i * 0.07 + Math.random() * 0.05, 0.002, 0.03, 0.06, 'lowpass', 1800, 500, 0.7, 0.5); } // debris trickle
        else if (r < 0.8) S.crystal(t, 2); // crystal settling
        else bell(mtof(74 + [0, 3, 7][Math.floor(Math.random() * 3)]), t, 0.012, 2.4, 1, 0.3); // the Belfry bell, very far away
      }
    },
  };

  /* ---------- instruments (shared by score + a few SFX) ---------- */
  // felt piano: harmonic partials with a fast hammer attack and long decay
  function pianoVoice(f, t, vel, dest, len = 2.2) {
    const parts = [[1, 1], [2, 0.42], [3, 0.16], [4, 0.07]];
    for (const [r, a] of parts) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * r; o.detune.value = (Math.random() - 0.5) * 4;
      const d = len / (1 + (r - 1) * 0.9) * (f < 300 ? 1.4 : 1);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * a, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + 0.05);
    }
  }
  // bowed string section: detuned saws, slow bow attack, darkened by a lowpass
  function stringVoice(f, t, dur, vel, dest, bright = 1500) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = bright; lp.Q.value = 0.4;
    const a = Math.min(0.6, dur * 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + a); g.gain.setValueAtTime(vel, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
    for (const dt of [-9, 0, 8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(lp); o.start(t); o.stop(t + dur + 0.5); }
    lp.connect(g); g.connect(dest);
  }
  // wordless choir: sawtooth through two vowel formants
  function choirVoice(f, t, dur, vel, dest) {
    const g = ctx.createGain(), o = ctx.createOscillator(), o2 = ctx.createOscillator();
    o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f; o2.detune.value = 11;
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
    f1.type = 'bandpass'; f1.frequency.value = 650; f1.Q.value = 6; f2.type = 'bandpass'; f2.frequency.value = 1080; f2.Q.value = 7;
    o.connect(f1); o.connect(f2); o2.connect(f1); o2.connect(f2); f1.connect(g); f2.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + Math.min(0.8, dur * 0.4)); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
    g.connect(dest); o.start(t); o2.start(t); o.stop(t + dur + 0.7); o2.stop(t + dur + 0.7);
  }
  function bassVoice(f, t, dur, vel, dest) {
    const g = ctx.createGain(), o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter();
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 2; lp.type = 'lowpass'; lp.frequency.value = 600;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.35; o2.connect(g2); g2.connect(lp); o.connect(lp); lp.connect(g); g.connect(dest);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function brassVoice(f, t, dur, vel, dest) {
    const g = ctx.createGain(), o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f; o2.detune.value = 7;
    lp.type = 'lowpass'; lp.Q.value = 1.2; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2200, t + 0.08); lp.frequency.linearRampToValueAtTime(1200, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.05); g.gain.setValueAtTime(vel * 0.8, t + dur * 0.85); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.15);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest); o.start(t); o2.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
  }
  function drum(kind, t, vel, dest) {
    if (kind === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
      g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.34);
    } else if (kind === 'snare') {
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.setValueAtTime(vel * 0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random()); n.stop(t + 0.22);
      const o = ctx.createOscillator(), g2 = ctx.createGain(); o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(130, t + 0.1);
      g2.gain.setValueAtTime(vel * 0.45, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g2); g2.connect(dest); o.start(t); o.stop(t + 0.14);
    } else if (kind === 'tom') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.25);
      g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.42);
    } else if (kind === 'timpani') {
      // big orchestral drum: pitched body + skin noise, long ring
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(92, t); o.frequency.exponentialRampToValueAtTime(73, t + 0.4); o2.frequency.value = 73 * 1.5;
      g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(g);
      o.connect(g); g.connect(dest); o.start(t); o2.start(t); o.stop(t + 1.45); o2.stop(t + 1.45);
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const gn = ctx.createGain(); gn.gain.setValueAtTime(vel * 0.5, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      n.connect(f); f.connect(gn); gn.connect(dest); n.start(t, Math.random()); n.stop(t + 0.16);
    } else if (kind === 'swell') {
      // reverse-cymbal swell leading into the next section
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(7000, t + 1.2);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
      n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + 1.4);
    } else if (kind === 'crash') {
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4500;
      const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
      n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random()); n.stop(t + 1.85);
    } else {
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
      const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random()); n.stop(t + 0.06);
    }
  }

  /* ---------- the score ----------
     Leitmotif (D minor), 8 bars — the antagonist's song, also played by Perfect Guards and Mira's music box. */
  const CH = {
    Dm: [38, 62, 65, 69], C: [36, 60, 64, 67], F: [41, 60, 65, 69], Bb: [34, 62, 65, 70], A: [33, 61, 64, 69], Gm: [43, 62, 67, 70], Eb: [39, 63, 67, 70],
  };
  const THEME = [
    [0, 74, 4], [4, 77, 4], [8, 81, 8],
    [16, 79, 4], [20, 77, 4], [24, 76, 8],
    [32, 74, 4], [36, 72, 4], [40, 74, 4], [44, 69, 4],
    [48, 70, 8], [56, 72, 4], [60, 74, 4],
    [64, 74, 4], [68, 77, 4], [72, 81, 6], [78, 82, 2],
    [80, 81, 4], [84, 79, 4], [88, 77, 8],
    [96, 76, 4], [100, 77, 4], [104, 79, 4], [108, 73, 4],
    [112, 74, 16],
  ];
  const THEME_CHORDS = ['Dm', 'C', 'F', 'Bb', 'Dm', 'F', 'A', 'Dm'];
  // cello counter-melody: moves against the theme (long notes where the theme moves, motion where it rests)
  const COUNTER = [
    [0, 57, 8], [8, 53, 8], [16, 55, 8], [24, 52, 8], [32, 53, 12], [44, 57, 4], [48, 58, 8], [56, 57, 8],
    [64, 57, 8], [72, 60, 8], [80, 60, 8], [88, 57, 8], [96, 61, 8], [104, 64, 8], [112, 62, 16],
  ];
  // duel ostinato for the knight (bowed 16ths, D phrygian colour)
  const DUEL_CHORDS = ['Dm', 'Eb', 'Dm', 'C', 'Bb', 'Eb', 'Gm', 'A'];
  const TRACKS = {
    title: { bpm: 66, chords: THEME_CHORDS, melody: THEME, mel: 'piano', melEvery: 1, pad: 'strings', arp: 'none', choir: 0.5, bass: 0, drums: 0 },
    explore: { bpm: 84, chords: THEME_CHORDS, melody: THEME, mel: 'piano', melEvery: 2, pad: 'strings', arp: 'harp', choir: 0, bass: 0.5, drums: 0 },
    cathedral: { bpm: 70, chords: ['Dm', 'Gm', 'Bb', 'A', 'Dm', 'Eb', 'Gm', 'A'], melody: THEME, mel: 'bell', melEvery: 2, pad: 'strings', arp: 'none', choir: 1, bass: 0, drums: 0 },
    boss: { bpm: 138, chords: ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A'], melody: THEME.map(([s, m, l]) => [s, m - 12, l]), mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 0.8, bass: 1, drums: 1, boss: true },
    boss2: { bpm: 150, chords: ['Dm', 'Eb', 'Dm', 'Eb', 'Gm', 'A', 'Bb', 'A'], melody: THEME.map(([s, m, l]) => [s, m - 12, l]), mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 1, bass: 1, drums: 1, boss: true, toms: true },
    ending: { bpm: 58, chords: THEME_CHORDS, melody: THEME, mel: 'piano', melEvery: 1, pad: 'strings', arp: 'harp', choir: 0.4, bass: 0, drums: 0, counter: true },
    duel: { bpm: 124, chords: DUEL_CHORDS, melody: THEME.map(([s, m, l]) => [s, m - 12, l]), mel: 'brass', melEvery: 2, pad: 'strings', arp: 'ostinato', choir: 0.3, bass: 1, drums: 1, boss: true, timpani: true, counter: true },
    rest: { bpm: 60, chords: THEME_CHORDS, melody: THEME.map(([s, m, l]) => [s, m + 12, l]), mel: 'musicbox', melEvery: 1, pad: 'strings', arp: 'none', choir: 0.2, bass: 0, drums: 0 },
  };
  TRACKS.explore.counter = true; TRACKS.cathedral.counter = true; TRACKS.boss.timpani = true; TRACKS.boss2.timpani = true;

  const Music = G.Music = {
    track: null, def: null, step: 0, nextT: 0, timer: null, intensity: 0, targetIntensity: 0,
    layers: {}, TRACKS, CH, THEME, COUNTER,
    // def: { bpm, chords:[names], melody:[[step16, midi, len16]], mel:'piano'|'bell'|'brass'|'musicbox'|'strings'|'choir', melEvery,
    //        pad:'strings', arp:'none'|'harp'|'ostinato', choir:0..1, bass:0..1, drums:0..1, boss?, timpani?, toms?, counter?, counterLine? }
    define(name, def) { TRACKS[name] = def; },
    setup() {
      const mk = (wet) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(musicBus); const s = ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(revIn); return g; };
      this.layers = { pad: mk(0.45), mel: mk(0.5), arp: mk(0.4), bass: mk(0.08), drums: mk(0.12), choir: mk(0.6) };
      if (this._pending) { const p = this._pending; this._pending = null; this.play(p); }
    },
    play(name) {
      if (!ctx) { this._pending = name; return; }
      if (this.track === name) return;
      this.track = name;
      const def = TRACKS[name];
      const now = ctx.currentTime;
      for (const k in this.layers) this.layers[k].gain.setTargetAtTime(0, now, 0.5);
      if (!def) { this.def = null; return; }
      setTimeout(() => {
        if (this.track !== name) return;
        this.def = def; this.step = 0; this.nextT = ctx.currentTime + 0.1;
        this.refreshGains();
      }, 1000);
      if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
    },
    stop() { this.play(null); },
    setIntensity(v) { this.targetIntensity = v; },
    refreshGains() {
      const d = this.def; if (!d) return; const now = ctx.currentTime;
      const I = d.boss ? 1 : this.intensity;
      const L = this.layers;
      L.pad.gain.setTargetAtTime(0.9, now, 1.2);
      L.mel.gain.setTargetAtTime(1.0, now, 1);
      L.arp.gain.setTargetAtTime(d.arp === 'none' ? 0 : 0.85, now, 1);
      L.choir.gain.setTargetAtTime(d.choir || 0, now, 1.5);
      L.bass.gain.setTargetAtTime(Math.max(d.bass, I) * 0.9, now, 0.8);
      L.drums.gain.setTargetAtTime(Math.max(d.drums, I) * 0.75, now, 0.8);
    },
    tick() {
      if (!this.def || !ctx) return;
      if (Math.abs(this.intensity - this.targetIntensity) > 0.01) { this.intensity = U.approach(this.intensity, this.targetIntensity, 0.02); this.refreshGains(); }
      const spb = 60 / this.def.bpm / 4; // one 16th
      while (this.nextT < ctx.currentTime + 0.15) {
        this.schedule(this.step, this.nextT, spb);
        this.nextT += spb; this.step++;
      }
    },
    schedule(step, t, spb) {
      const d = this.def, L = this.layers;
      const nb = d.chords.length, loop = nb * 16;
      const bar = Math.floor(step / 16) % nb, s = step % 16, cycle = Math.floor(step / loop), ls = step % loop;
      const ch = CH[d.chords[bar]];
      const I = d.boss ? 1 : this.intensity;
      const barDur = spb * 16;
      // pad: sustained chord each bar
      if (s === 0) {
        for (let i = 1; i < ch.length; i++) stringVoice(mtof(ch[i] - 12), t, barDur * 0.98, 0.05, L.pad, d.boss ? 1900 : 1400);
        bassVoice(mtof(ch[0]), t, barDur * 0.95, 0.26, L.pad);
        if (d.choir) for (let i = 1; i < ch.length; i++) choirVoice(mtof(ch[i]), t, barDur * 0.95, 0.05, L.choir);
      }
      // melody (every `melEvery` loops so exploration breathes)
      if (cycle % d.melEvery === d.melEvery - 1 || d.melEvery === 1) {
        for (const [st, m, len] of d.melody) {
          if (st !== ls) continue;
          if (d.mel === 'piano') pianoVoice(mtof(m), t, 0.2, L.mel, 2.6);
          else if (d.mel === 'bell') bell(mtof(m), t, 0.14, 2.4, 0, 0.5, L.mel);
          else if (d.mel === 'brass') brassVoice(mtof(m), t, len * spb * 0.95, 0.1, L.mel);
          else if (d.mel === 'musicbox') bell(mtof(m), t, 0.09, 1.6, 0, 0.35, L.mel);
          else if (d.mel === 'strings') stringVoice(mtof(m), t, len * spb * 0.95, 0.07, L.mel, 1800);
          else if (d.mel === 'choir') choirVoice(mtof(m), t, len * spb * 0.95, 0.08, L.mel);
        }
      }
      // cello counter-melody on alternate loops (the theme and its answer)
      if (d.counter && (cycle % 2 === 1 || d.boss)) {
        for (const [st, m, len] of (d.counterLine || COUNTER)) if (st === ls) stringVoice(mtof(m - (d.boss ? 12 : 0)), t, len * spb * 0.95, 0.06, L.mel, 1100);
      }
      // section punctuation: swell into each loop, crash on the downbeat (combat only)
      if ((d.boss || I > 0.5) && ls === loop - 8) drum('swell', t, 0.18, L.drums);
      if ((d.boss || I > 0.5) && ls === 0 && step > 0) drum('crash', t, 0.16, L.drums);
      if (d.timpani && (I > 0.02 || d.drums)) {
        if (s === 0 && bar % 2 === 0) drum('timpani', t, 0.55, L.drums);
        if (bar % 4 === 3 && (s === 12 || s === 14)) drum('timpani', t, 0.4, L.drums);
      }
      // arpeggio / ostinato
      if (d.arp === 'harp' && s % 2 === 0) {
        const seq = [1, 2, 3, 2, 1, 3, 2, 3], n = ch[seq[(s / 2) % 8]] + (s >= 8 ? 12 : 0);
        pianoVoice(mtof(n), t, 0.08, L.arp, 1.3);
      } else if (d.arp === 'ostinato') {
        const seq = [1, 3, 2, 3], n = ch[seq[s % 4]] - 12 + (s % 8 >= 4 ? 12 : 0);
        stringVoice(mtof(n), t, spb * 0.8, 0.045, L.arp, 2600);
      }
      // rhythm section (fades in with combat intensity)
      if (I > 0.02 || d.drums) {
        if (s % 2 === 0) bassVoice(mtof(ch[0] + (s % 8 === 6 ? 12 : 0)), t, spb * 1.7, 0.14, L.bass);
        if (s === 0 || s === 8 || (s === 10 && bar % 2) || (d.boss && (s === 3 || s === 11))) drum('kick', t, 0.75, L.drums);
        if (s === 4 || s === 12) drum('snare', t, 0.5, L.drums);
        if (s % 2 === 1 || d.boss) drum('hat', t, s % 4 === 2 ? 0.12 : 0.06, L.drums);
        if (d.toms && s >= 12 && bar % 4 === 3) drum('tom', t, 0.5, L.drums);
      }
    },
  };

  /* instruments + buses for chapter-defined sounds (docs/CHAPTER_API.md) — usable once audio has started */
  G.AudioKit = {
    get ctx() { return ctx; }, get sfxBus() { return sfxBus; }, get musicBus() { return musicBus; }, get revIn() { return revIn; }, get noiseBuf() { return noiseBuf; },
    mtof, tone, noise, bell, pianoVoice, stringVoice, choirVoice, bassVoice, brassVoice, drum,
  };
})(window.G);

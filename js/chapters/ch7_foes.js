'use strict';
/* ECHOFALL — Chapter VII 休止之所 THE REST — foes   (docs/STORY.md §3-VII · docs/CHAPTER_API.md §4–5)
   c7_mirror 回聲殘像 ECHO SELF · c7_restmark 休止符 REST MARK · c7_choir 無聲詩班 VOICELESS CHOIR ·
   c7_fermata 延長記號 FERMATA · c7_elite 葛雷夫的回憶 GRAVES, REMEMBERED
   (+ their SFX, codex entries, bark c7_eliteP2, and the elite's relic c7_oath 斷弦之誓).

   The look: notation come alive — ink that catches a gilt rim, ivory paper with cool shadows and gilt bounce light,
   and red only where something is being erased.

   World mechanics — every one reversible, self-removing, and inert while these foes are absent:
     · 擦除 ERASE  a Rest Mark crosses out a one-way platform (≥0.95 s red warning), then lifts that entry out of
                   G.LEVEL.oneways for 3 s. It always comes back: on its timer, on any world reset / respawn, and before
                   any chapter (re)load (the cached ground art is painted from that array).
     · 時間泡 HOLD inside a Fermata's dome the player's vx is damped to 55 % for the length of her own physics step and
                   handed back afterwards (wrapper on the player instance's update; gone when no dome is left).
     · 靜默 MUTE   while a Voiceless Choir lives nearby, player.gainRes() gains nothing (instance wrapper; gone as soon as
                   no choir is alive).
   Telegraphs: white = guard/parry, red = dodge; every blow lands ≥0.45 s after its tell (≥0.6 s for the big ones). */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK, RED = K.CRIM, D = G.DATA, AN = Rig.ANIM, DIM = Rig.DIM;
  const LC = Rig.limbChain, LB = Rig.limb, lp = K.lerpP;
  const DEBUG_HB = typeof location !== 'undefined' && /[?#&]hb=1(?:&|$)/.test(location.href);

  /* ================================ palette ================================ */
  const GOLD = '#f2c766', GOLDL = '#fff1c4', GOLDD = '#a8772f', PAPER = '#f1ebdd', REDL = '#ff8aa6';
  // bespoke cel ramps on hexes nobody else uses: ink whose lit edge is gilt; paper whose shadow is cool, whose bounce is gold
  function defRamp(hex, hi, lit, dark, bounce) { Object.assign(Rig.ramp(hex), { hi, lit, dark, bounce }); return hex; }
  const INK1 = defRamp('#17131c', '#e6b55c', '#2a2330', '#0e0b12', '#3e301d');
  const INK2 = defRamp('#100d14', '#b88c46', '#1d1823', '#09070c', '#30251a');
  const INK3 = defRamp('#221c27', '#f4cf78', '#3a3241', '#141017', '#4c3b25');
  const PAP1 = defRamp('#ebe4d5', '#fffdf5', '#ebe4d5', '#9b91a1', '#dcb768');
  const PAP2 = defRamp('#cfc6b6', '#f7f0e2', '#cfc6b6', '#827889', '#caa458');
  const GILT = defRamp('#d9ad55', '#fff1c2', '#e7be67', '#8b602b', '#ffd98a');
  const IVOR = defRamp('#f3eee3', '#ffffff', '#f3eee3', '#a49bb0', '#e6c374');
  const IVOS = defRamp('#c4baa8', '#efe6d4', '#c4baa8', '#7b7286', '#c29d55');

  /* ================================ helpers ================================ */
  const poly = (ctx, p, close = true) => { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); if (close) ctx.closePath(); };
  const polyP = (ctx, p, close = true) => { ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y); if (close) ctx.closePath(); };
  function smoothP(ctx, p) {
    const n = p.length; ctx.beginPath(); ctx.moveTo((p[n - 1].x + p[0].x) / 2, (p[n - 1].y + p[0].y) / 2);
    for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    ctx.closePath();
  }
  const ink = (ctx, w = 1.3) => { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); };
  // hard-stop cel paint across an axis, lit from the (mirrored) sun side
  const cel = (ctx, cx, cy, nx, ny, w, hex) => { const L = Rig.lightDir(ctx); return Rig.celGrad(ctx, cx, cy, nx, ny, w, nx * L.x + ny * L.y >= 0 ? 1 : -1, Rig.ramp(hex)); };
  const lighter = (ctx, fn) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; fn(); ctx.restore(); };
  const glow = (ctx, x, y, r, col, a) => { if (a > 0.01) lighter(ctx, () => K.glow(ctx, x, y, r, col, Math.min(1, a))); };
  const low = () => !!(G.Quality && G.Quality.low);
  const hash = (i, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
  const seedOf = () => (Math.random() * 9973) | 0;
  const dirv = (a, l) => ({ x: Math.sin(a) * l, y: Math.cos(a) * l });          // Rig convention: angle from straight down
  const addP = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const alive = (e) => !!e && !e.dead && !!G.game && G.game.enemies.indexOf(e) >= 0;
  const torsoQ = (J, len = DIM.TORSO) => {
    const tA = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x), ux = Math.cos(tA), uy = Math.sin(tA), nx = -uy, ny = ux;
    return { Q: (s, f) => ({ x: J.hip.x + ux * s * len + nx * f, y: J.hip.y + uy * s * len + ny * f }), nx, ny, ang: tA };
  };
  const restPts = (a, spec) => Array.from({ length: spec[0] }, (_, i) => ({ x: a.x - Math.sin(spec[4]) * spec[1] * i, y: a.y - Math.cos(spec[4]) * spec[1] * i }));
  const EASE = { lin: (t) => t, io: U.easeInOutSine, out: U.easeOutCubic, snap: (t) => 1 - Math.pow(1 - t, 4), in: U.easeInCubic };
  function lerpO(a, b, t) { const o = {}; for (const k in a) o[k] = a[k] + ((b[k] ?? a[k]) - a[k]) * t; return o; }
  // keyframes over plain numeric "poses": [[t, pose, ease], ...]
  function sampK(keys, t, def) {
    const R = (p) => Object.assign({}, def, typeof p === 'function' ? p(0) : p);
    if (t <= keys[0][0]) return R(keys[0][1]);
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i];
      return lerpO(R(a[1]), R(b[1]), EASE[b[2] || 'io']((t - a[0]) / (b[0] - a[0] || 1)));
    }
    return R(keys[keys.length - 1][1]);
  }
  function blendTo(e, key, target, dt, k) {
    if (!e[key]) e[key] = target;
    else if (dt > 0) e[key] = lerpO(e[key], target, 1 - Math.exp(-k * dt));
    return e[key];
  }
  const solidAt = (x, y) => { for (const s of G.Phys.allSolids()) if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return true; return false; };
  const floorAt = (x, y, def) => { const f = G.Phys.groundBelow(x, y); return f < 1e8 ? f : def; };
  function clampArena(e, x, pad = 60) {
    const ar = G.game.arena, L = G.LEVEL;
    if (ar && e.enc === ar.id) x = U.clamp(x, ar.x0 + pad, ar.x1 - pad);
    return U.clamp(x, L.bounds[0] + pad, L.bounds[1] - pad);
  }
  // fliers keep their encounter height; one spawned on the floor lifts itself to its own
  function hoverInit(e, h) {
    if (e._hv) return; e._hv = true;
    if (e.y0 == null) e.y0 = e.y;
    const fl = G.Phys.groundBelow(e.x, e.y0 - 10);
    if (fl < 1e8 && fl - e.y0 < 60) e.y0 = fl - h;
  }
  function star4(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x + s * 0.4, y - s * 0.4); ctx.lineTo(x + s * 1.6, y); ctx.lineTo(x + s * 0.4, y + s * 0.4);
    ctx.lineTo(x, y + s * 1.6); ctx.lineTo(x - s * 0.4, y + s * 0.4); ctx.lineTo(x - s * 1.6, y); ctx.lineTo(x - s * 0.4, y - s * 0.4); ctx.closePath(); ctx.fill();
  }
  // dazed: three gilt stars circling (world or local coords)
  function dizzy(ctx, x, y, t, r = 14) {
    lighter(ctx, () => { ctx.fillStyle = GOLDL; for (let i = 0; i < 3; i++) { const a = t * 4 + i * TAU / 3; star4(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.32, 2.4); } });
  }

  /* ======================= world mechanics: reversible, self-removing ======================= */
  // Wraps obj[name]; make(prev, st) returns the wrapper, which must pass straight through to prev once st.on is false.
  // unwrap() restores the original — or, if someone else has wrapped on top of us since, leaves an inert pass-through.
  function wrapMethod(obj, name, make) {
    const own = Object.prototype.hasOwnProperty.call(obj, name), prev = obj[name], st = { on: true };
    const w = make(prev, st);
    obj[name] = w;
    return () => { st.on = false; if (obj[name] === w) { if (own) obj[name] = prev; else delete obj[name]; } };
  }

  const SLOW = 0.55;
  const World = {
    erased: [], bubbles: [], slow: 1, pl: null, unP: null, unReset: null, unLoad: null, busy: false,
    need() { return this.erased.length > 0 || this.bubbles.length > 0 || this.slow < 0.999 || !!Mute.un; },
    ensure() {
      const g = G.game, P = g && g.player;
      if (P && (this.pl !== P || !this.unP)) {
        if (this.unP) this.unP();
        this.pl = P;
        this.unP = wrapMethod(P, 'update', (prev, st) => function (dt) {
          if (!st.on || World.busy) return prev.call(this, dt);
          World.busy = true;
          try { return World.step(this, prev, dt); } finally { World.busy = false; }
        });
      }
      // a death / respawn or a chapter (re)load puts every erased platform back first
      if (!this.unReset && g) this.unReset = wrapMethod(g, 'resetWorld', (prev, st) => function (...a) { if (st.on) World.restoreAll(); return prev.apply(this, a); });
      if (!this.unLoad && G.Chapters) this.unLoad = wrapMethod(G.Chapters, 'load', (prev, st) => function (...a) { if (st.on) World.restoreAll(); return prev.apply(this, a); });
    },
    release() {
      if (this.unP) { this.unP(); this.unP = null; this.pl = null; }
      if (this.unReset) { this.unReset(); this.unReset = null; }
      if (this.unLoad) { this.unLoad(); this.unLoad = null; }
    },
    inBubble(P, b) { return b.end == null && G.game.time >= b.t0 + b.form * 0.7 && Math.hypot(P.x - b.x, P.y - 46 - b.y) < b.r; },
    step(P, prev, dt) {
      const g = G.game, now = g.time;
      // domes end on their timer or with their Fermata, then collapse for 0.45 s
      for (let i = this.bubbles.length - 1; i >= 0; i--) {
        const b = this.bubbles[i];
        if (b.end == null && (now >= b.until || !alive(b.owner))) b.end = now;
        if (b.end != null && now - b.end > 0.45) { this.bubbles.splice(i, 1); continue; }
        if (g.hazards.indexOf(b.haz) < 0) g.hazards.push(b.haz);
      }
      let want = 1;
      for (const b of this.bubbles) if (this.inBubble(P, b)) want = SLOW;
      this.slow = want < this.slow ? Math.max(want, this.slow - dt * 4.5) : Math.min(want, this.slow + dt * 3);
      const k = this.slow;
      if (k < 0.999) {
        // held time: her vx is damped only for her own physics step, and the original handed back afterwards
        const PH = G.Phys, mv = PH.move, kd = 0.5 + 0.5 * k;
        const tmp = function (b, d, o) {
          if (b !== P) return mv.call(this, b, d, o);
          const vx = b.vx; b.vx = vx * (P.state === 'dodge' || P.state === 'skill1' ? kd : k);
          mv.call(this, b, d, o);
          if (b.vx !== 0) b.vx = vx;               // a wall stop keeps its zero
        };
        PH.move = tmp;
        try { prev.call(P, dt); } finally { if (PH.move === tmp) PH.move = mv; }
      } else prev.call(P, dt);
      // erased platforms come back on time; their painted void survives hazard wipes
      for (let i = this.erased.length - 1; i >= 0; i--) {
        const r = this.erased[i];
        if (!r.back && now >= r.until) this.restore(r);
        if (r.back && now - r.backT > 0.5) { this.erased.splice(i, 1); continue; }
        if (g.hazards.indexOf(r.haz) < 0) g.hazards.push(r.haz);
      }
      Mute.check();
      if (!this.need()) this.release();
    },
    erase(p, dur) {
      const arr = G.LEVEL.oneways, idx = arr ? arr.indexOf(p) : -1;
      if (idx < 0 || this.erased.some((r) => r.p === p)) return false;
      arr.splice(idx, 1);
      const now = G.game.time, r = { p, arr, idx, t0: now, until: now + dur, back: false, backT: 0, seed: seedOf() };
      r.haz = { t: 0, rec: r, update(h, dt, g) { if ((r.back && g.time - r.backT > 0.5) || World.erased.indexOf(r) < 0) h.done = true; }, draw: drawErased };
      G.game.hazards.push(r.haz);
      this.erased.push(r); this.ensure();
      return true;
    },
    restore(r) {
      if (r.back) return;
      r.back = true; r.backT = G.game.time;
      if (r.arr.indexOf(r.p) < 0) r.arr.splice(Math.min(r.idx, r.arr.length), 0, r.p);
      G.SFX.play('c7_reink');
    },
    restoreAll() {
      for (const r of this.erased) if (r.arr.indexOf(r.p) < 0) r.arr.splice(Math.min(r.idx, r.arr.length), 0, r.p);
      this.erased.length = 0; this.bubbles.length = 0; this.slow = 1;
      this.release();
    },
    isErased(p) { return this.erased.some((r) => r.p === p && !r.back); },
    bubble(owner, x, y, r, dur) {
      const now = G.game.time;
      for (const b of this.bubbles) if (b.owner === owner && b.end == null) b.end = now;     // one dome per Fermata
      const b = { owner, x, y, r, t0: now, form: 0.45, until: now + 0.45 + dur, end: null, seed: seedOf() };
      b.haz = { t: 0, b, update(h, dt, g) { if ((b.end != null && g.time - b.end > 0.45) || World.bubbles.indexOf(b) < 0) h.done = true; }, draw: drawBubble };
      G.game.hazards.push(b.haz);
      this.bubbles.push(b); this.ensure();
      return b;
    },
  };

  // 靜默: while a Voiceless Choir lives near her, resonance gains are swallowed
  const Mute = {
    un: null, pl: null, fxT: -9, told: false,
    near() {
      const g = G.game, P = g && g.player; if (!P) return false;
      for (const e of g.enemies) if (e.type === 'c7_choir' && !e.dead && e.state !== 'spawn' && Math.abs(e.x - P.x) < 1400 && Math.abs(e.y - P.y) < 900) return true;
      return false;
    },
    ensure() {
      const P = G.game && G.game.player; if (!P || (this.un && this.pl === P)) return;
      if (this.un) this.un();
      this.pl = P;
      World.ensure();
      this.un = wrapMethod(P, 'gainRes', (prev, st) => function (v) {
        if (st.on && v > 0) {
          if (Mute.near()) { Mute.blocked(this); return; }
          Mute.release();
        }
        return prev.call(this, v);
      });
    },
    release() { if (this.un) { this.un(); this.un = null; this.pl = null; this.told = false; } },
    check() { if (this.un && !this.near()) this.release(); },
    blocked(P) {
      const g = G.game;
      if (g.realTime - this.fxT > 0.9) { this.fxT = g.realTime; G.FX.text(P.x, P.y - 150, '— 靜 默 —', '#f2dca0', 15, 0.8); G.SFX.play('c7_mute'); }
      if (!this.told) { this.told = true; g.toast('無聲詩班封住了妳的共鳴', 'warn'); }
    },
  };

  // the Echo listens: every attack Rinne starts, and when (sampled once a frame while a Chapter VII foe is on the field)
  const ATK_STATES = { light: 1, air: 1, heavy: 1, skill1: 1, skill2: 1, counter: 1 };
  const Rec = {
    log: [], last: null, lastSt: 0, lastCi: -1, stamp: -1,
    sample() {
      const g = G.game, P = g && g.player; if (!P || this.stamp === g.time) return;
      this.stamp = g.time;
      const s = P.state;
      if (ATK_STATES[s] && (s !== this.last || P.st < this.lastSt - 1e-6 || (s === 'light' && P.ci !== this.lastCi)))
        this.log.push({ k: s === 'light' ? 'l' + P.ci : s, t: g.time });
      this.last = s; this.lastSt = P.st; this.lastCi = P.ci;
      while (this.log.length && (this.log.length > 12 || g.time - this.log[0].t > 9)) this.log.shift();
    },
    count(win) { const now = G.game.time; let n = 0; for (const r of this.log) if (now - r.t < win) n++; return n; },
    // the last phrase she played: attacks no more than ~1 s apart, up to five
    phrase() {
      const L = this.log, now = G.game.time;
      if (!L.length || now - L[L.length - 1].t > 6) return null;
      let i = L.length - 1;
      while (i > 0 && L[i].t - L[i - 1].t < 0.95 && L.length - i < 5) i--;
      return L.slice(i);
    },
  };

  /* ================================ SFX ================================ */
  const AK = () => G.AudioKit;
  Object.assign(G.SFX, {
    // the echo: a breath drawn backwards, two voices a hair apart (you, and not quite you)
    c7_echoVoice(t) { const A = AK(); A.noise(t, 0.28, 0.07, 0.04, 'bandpass', 600, 2600, 1.4, 0.6); A.tone('sine', 196, t + 0.22, 0.04, 0.035, 0.5, { to: 185, wet: 0.7 }); A.tone('sine', 198.5, t + 0.24, 0.04, 0.03, 0.5, { to: 207, wet: 0.7 }); },
    c7_inkDash(t) { const A = AK(); A.noise(t, 0.01, 0.2, 0.22, 'lowpass', 1800, 300, 0.8, 0.2); A.tone('sine', 90, t, 0.005, 0.18, 0.25, { to: 50 }); },
    c7_splat(t, k = 1) { const A = AK(); A.noise(t, 0.003, 0.22 * k, 0.18, 'lowpass', 1400, 200, 0.7, 0.2); for (let i = 0; i < 3; i++) A.tone('sine', 700 + i * 260, t + 0.04 + i * 0.05, 0.002, 0.02 * k, 0.07, { to: 300, wet: 0.3 }); },
    // the rest mark: a dry staccato tick and a two-note shrug
    c7_restVoice(t) { const A = AK(); A.tone('triangle', A.mtof(88), t, 0.002, 0.035, 0.09, { wet: 0.5 }); A.tone('triangle', A.mtof(83), t + 0.11, 0.002, 0.03, 0.12, { wet: 0.5 }); A.noise(t, 0.02, 0.03, 0.15, 'highpass', 4000, null, 0.7, 0.4); },
    c7_noteFire(t) { const A = AK(), m = [79, 83, 86, 88][Math.floor(Math.random() * 4)]; A.bell(A.mtof(m), t, 0.05, 1.0, 0.6, 0.7); A.tone('sine', A.mtof(m), t, 0.004, 0.05, 0.5, { wet: 0.6 }); },
    // erasing: the rub of an eraser, a pen drawn backwards
    c7_erase(t) { const A = AK(); for (let i = 0; i < 7; i++) A.noise(t + i * 0.12, 0.02, 0.07, 0.08, 'bandpass', 1400 + (i % 2) * 900, 900, 2.5, 0.1); A.tone('sawtooth', 300, t, 0.6, 0.02, 0.4, { to: 120, filter: 'lowpass', ff: 900, wet: 0.3 }); },
    c7_eraseTear(t) { const A = AK(); A.noise(t, 0.003, 0.26, 0.32, 'highpass', 2600, 900, 0.8, 0.25); A.noise(t + 0.02, 0.002, 0.12, 0.14, 'bandpass', 700, 300, 1.2, 0.2); A.tone('sine', 140, t, 0.003, 0.15, 0.3, { to: 60 }); },
    c7_reink(t) { const A = AK(); A.noise(t, 0.05, 0.05, 0.3, 'bandpass', 3200, 5200, 3, 0.3); A.bell(A.mtof(81), t + 0.18, 0.035, 1.0, 0.7, 0.5); },
    // the choir: a choir you can barely hear — and then the breath they don't let out
    c7_choirVoice(t) { const A = AK(); A.choirVoice(A.mtof(64), t, 0.9, 0.012, A.sfxBus); A.choirVoice(A.mtof(71), t + 0.05, 0.9, 0.01, A.sfxBus); A.noise(t, 0.3, 0.05, 0.6, 'bandpass', 900, 500, 0.8, 0.6); },
    c7_hymn(t) { const A = AK(); A.tone('sine', 220, t, 0.05, 0.08, 1.2, { to: 196, wet: 0.7 }); [76, 79, 83].forEach((m, i) => A.bell(A.mtof(m), t + i * 0.03, 0.02, 1.6, 0.85, 0.3)); A.noise(t, 0.08, 0.06, 0.9, 'lowpass', 600, 200, 0.7, 0.6); },
    c7_mute(t) { const A = AK(); A.tone('triangle', 330, t, 0.002, 0.04, 0.12, { to: 160, filter: 'lowpass', ff: 600, wet: 0.2 }); A.noise(t, 0.002, 0.05, 0.08, 'lowpass', 500, 200, 0.7, 0.1); },
    // the fermata: an organ pedal that will not let go
    c7_fermataVoice(t) { const A = AK(); A.tone('sawtooth', 55, t, 0.25, 0.07, 1.6, { to: 52, filter: 'lowpass', ff: 260, wet: 0.5 }); A.tone('sine', 110, t, 0.3, 0.05, 1.4, { wet: 0.6 }); A.bell(A.mtof(57), t + 0.1, 0.05, 2.4, 0.8, 0.4); },
    c7_step(t) { const A = AK(); A.tone('sine', 62, t, 0.004, 0.2, 0.25, { to: 38 }); A.noise(t, 0.003, 0.07, 0.12, 'lowpass', 500, 120, 0.7, 0.1); },
    c7_bubble(t) { const A = AK(); A.tone('sine', 1320, t, 0.02, 0.04, 1.4, { to: 260, wet: 0.8 }); A.tone('sine', 1326, t, 0.02, 0.03, 1.4, { to: 266, wet: 0.8 }); A.noise(t, 0.4, 0.05, 0.4, 'bandpass', 3000, 600, 2, 0.6); },
    c7_topple(t) { const A = AK(); A.tone('sine', 48, t, 0.004, 0.55, 0.8, { to: 26, wet: 0.25 }); A.noise(t, 0.004, 0.35, 0.6, 'lowpass', 1200, 90, 0.7, 0.3); A.bell(A.mtof(45), t, 0.06, 2.4, 0.7, 0.3); },
    c7_creak(t) { const A = AK(); A.tone('sawtooth', 70, t, 0.3, 0.05, 0.5, { to: 96, filter: 'bandpass', ff: 420, q: 6, wet: 0.3 }); },
    c7_swing(t) { const A = AK(); A.noise(t, 0.14, 0.12, 0.3, 'bandpass', 380, 1500, 1.2, 0.2); },
    // Graves: a calm breath, a low hum — and the ring of a blade that has been put back together
    c7_gravesVoice(t) { const A = AK(); A.noise(t, 0.15, 0.04, 0.4, 'bandpass', 700, 420, 0.9, 0.5); A.tone('sine', A.mtof(50), t + 0.05, 0.1, 0.03, 0.9, { wet: 0.7 }); A.bell(A.mtof(74), t + 0.12, 0.025, 1.4, 0.8, 0.4); },
    c7_ring(t) { const A = AK(); A.bell(A.mtof(98), t, 0.08, 1.4, 0.6, 1.3); A.bell(A.mtof(91), t + 0.01, 0.05, 1.1, 0.6, 1.1); A.noise(t, 0.001, 0.12, 0.06, 'highpass', 5000, null, 0.7, 0.2); },
    c7_waltz(t, n = 0) { const A = AK(); A.tone('triangle', A.mtof([62, 66, 69, 74][n % 4]), t, 0.004, 0.045, 0.45, { wet: 0.6 }); A.tone('sine', A.mtof([50, 54, 57, 62][n % 4]), t, 0.01, 0.03, 0.6, { wet: 0.5 }); },
    c7_crescentWave(t) { const A = AK(); A.noise(t, 0.02, 0.16, 0.4, 'bandpass', 2200, 700, 1.1, 0.4); A.bell(A.mtof(86), t, 0.03, 0.9, 0.6, 0.9); },
  });

  /* ================================ shared drawing ================================ */
  // a cloth panel in ink along a chain: cel-painted, inked, gilt hem
  function inkCloth(ctx, pts, w0, w1, hex, hem) {
    const n = pts.length; if (n < 2) return;
    const mid = pts[n >> 1];
    Rig.ribbon(ctx, pts, w0, w1, cel(ctx, mid.x, mid.y, 1, 0, Math.max(w0, w1) + 2, hex));
    ink(ctx, 1.05);
    if (hem) {
      // gilt piping down the trailing edge, and a wet gloss along the fold
      const edge = (k, a0) => { ctx.beginPath(); for (let i = a0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = U.lerp(w0, w1, i / (n - 1)) * k; const x = pts[i].x + dy / d * w, y = pts[i].y - dx / d * w; i === a0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } };
      edge(0.78, 1); ctx.strokeStyle = hem; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.stroke();
      edge(-0.3, 1); ctx.strokeStyle = 'rgba(255,250,240,0.16)'; ctx.lineWidth = 1.4; ctx.stroke();
    }
  }
  // death: the ink washes off — a ragged line runs down the figure, what is left sags, drops fall and pool on the floor
  const washY = (e, x, k, top, bot) => U.lerp(top - 14, bot + 6, U.easeInCubic(k) * 0.9 + k * 0.1)
    + (Math.sin(x * 0.17 + e.seed) * 0.5 + 0.5) * (5 + 26 * k) + (hash(Math.floor(x / 7), e.seed) - 0.5) * 5;
  function washBegin(ctx, e) {
    const k = U.clamp(e.st / 0.5, 0, 1), s = e.T.scale || 1, bot = e.y + 4, top = e.y - e.T.h * s - 34, hw = Math.max(e.T.w * 1.7, 140) * s;
    ctx.beginPath(); ctx.moveTo(e.x - hw, bot + 260);
    for (let x = -hw; x <= hw; x += 8) ctx.lineTo(e.x + x, washY(e, x, k, top, bot));
    ctx.lineTo(e.x + hw, bot + 260); ctx.closePath(); ctx.clip();
    ctx.translate(e.x, bot); ctx.scale(1 + k * 0.08, 1 - k * 0.2); ctx.translate(-e.x, -bot);
    return { k, top, bot, s };
  }
  function washEnd(ctx, e, W, ghost) {
    const { k, top, bot, s } = W, fl = floorAt(e.x, e.y - 8, bot);
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const t0 = 0.03 + hash(i + 7, e.seed) * 0.28; if (e.st < t0) continue;
      const x = e.x + (hash(i, e.seed) - 0.5) * e.T.w * 1.5 * s, ft = e.st - t0;
      const y0 = washY(e, x - e.x, U.clamp(t0 / 0.5, 0, 1), top, bot) + 6, y = y0 + 0.5 * 2600 * ft * ft;
      ctx.fillStyle = 'rgba(11,7,16,0.92)';
      if (y >= fl - 2) { ctx.beginPath(); ctx.ellipse(x, fl - 1, 2.5 + ft * 16, 1.5, 0, 0, TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.ellipse(x, y, 2, 2.6 + Math.min(7, ft * 28), 0, 0, TAU); ctx.fill(); }
    }
    const pw = (16 + 44 * k) * s;
    ctx.fillStyle = `rgba(10,7,14,${0.85 * (1 - k * 0.3)})`; ctx.beginPath(); ctx.ellipse(e.x, fl - 0.5, pw, 3.5 + 2 * k, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = U.rgba(GOLD, 0.45 * (1 - k)); ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    if (!ghost && G.game.dtVis > 0 && Math.random() < 0.7) G.FX.ember(e.x, U.lerp(top, bot, k) + 10, 1, GOLD, { w: e.T.w * s, h: 10, up: 60, sp: 40 });
  }
  // spawn: it climbs out of a pool of ink with a gilt ripple
  function spawnPool(ctx, e) {
    const k = U.clamp(e.st / (e.T.spawnT || 0.7), 0, 1), s = e.T.scale || 1, fl = floorAt(e.x, e.y - 8, e.y);
    const w = (e.T.w * 0.8 + 28) * s * (k < 0.8 ? U.easeOutCubic(k / 0.8) : 1 - (k - 0.8) / 0.2 * 0.6);
    ctx.save();
    ctx.fillStyle = 'rgba(10,7,14,0.9)'; ctx.beginPath(); ctx.ellipse(e.x, fl - 0.5, w, 4.5, 0, 0, TAU); ctx.fill();
    lighter(ctx, () => { ctx.strokeStyle = U.rgba(GOLD, 0.7 * (1 - k)); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(e.x, fl - 0.5, w * (0.6 + k * 0.6), 4 + 3 * k, 0, 0, TAU); ctx.stroke(); });
    ctx.restore();
  }
  function drawBoxes(ctx, e) {
    ctx.save(); ctx.lineWidth = 2;
    if (e.state === 'atk' && e.atk && e.atk.hits) for (const h of e.atk.hits) {
      const on = e.st >= h.t0 && e.st <= h.t1; if (e.st < h.t0 - 0.4 || e.st > h.t1 + 0.1) continue;
      const b = e.boxW(h.box); ctx.strokeStyle = on ? (h.red ? '#ff2a5f' : '#ffffff') : 'rgba(255,255,0,0.6)'; ctx.setLineDash(on ? [] : [5, 4]); ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(0,255,160,0.7)'; const b = e.box; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.restore();
  }
  // registers a type: per-frame housekeeping, the ink-pool spawn, the wash-away death, ?hb=1 hit boxes
  function reg(id, T) {
    const raw = T.draw;
    T.draw = function (ctx, e, ghost) {
      if (!ghost && G.game.dtVis > 0) { Rec.sample(); if (T.tick) T.tick(e, G.game.dtVis); }
      if (!ghost && e.state === 'spawn') spawnPool(ctx, e);
      ctx.save();
      if (e.state === 'die' && !e._splat && !ghost) { e._splat = true; G.SFX.play('c7_splat', e.T.elite ? 1.4 : 1); }
      const W = e.state === 'die' ? washBegin(ctx, e) : null;
      raw(ctx, e, ghost);
      ctx.restore();
      if (W) washEnd(ctx, e, W, ghost);
      if (DEBUG_HB && !ghost) drawBoxes(ctx, e);
    };
    TYPES[id] = T;
    return T;
  }

  /* =========================================================================================
     c7_mirror 回聲殘像 ECHO SELF — Rinne, written again in ink. It listens to your blade and plays it back:
     echo  (white × your own last combo, slowed to a fair tempo — a red lunge to close if you used a heavy or a dash)
     lunge (red — your dash, in ink)
     ========================================================================================= */
  const ECHO_HIT = {
    l0: { k: AN.light[0].keys, dmg: 16, box: { x: 0, y: -140, w: 118, h: 140 }, pitch: 1.0, step: 240 },
    l1: { k: AN.light[1].keys, dmg: 16, box: { x: 0, y: -160, w: 112, h: 160 }, pitch: 1.1, step: 240 },
    l2: { k: AN.light[2].keys, dmg: 18, box: { x: -10, y: -140, w: 128, h: 140 }, pitch: 0.92, step: 280 },
  };
  const ECHO_KIND = { l0: 'l0', l1: 'l1', l2: 'l2', l3: 'red', counter: 'l2', air: 'l1', heavy: 'red', skill1: 'red', skill2: 'red' };
  // a playable attack from a list of strikes; gap = her own spacing between blows (stretched, never under 0.54 s)
  function buildEcho(kinds, gap) {
    const keys = [[0, Rig.full(AN.idle(0))]], tells = [], hits = [], moves = [], ev = [];
    let S = 0, lastKey = 0;
    kinds.forEach((kd, i) => {
      const red = kd === 'red';
      if (i === 0) S = red ? 0.82 : 0.62;
      else S += red ? 0.98 : kinds[i - 1] === 'red' ? 0.66 : U.clamp((gap || 0.42) * 1.35, 0.54, 0.86);
      if (red) {
        keys.push([S - 0.72, Rig.full(AN.charge(0, 0.15)), 'io'], [S - 0.12, Rig.full(AN.charge(0, 1)), 'io'], [S, Rig.full(AN.skill1.keys[2][1]), 'snap'], [S + 0.3, Rig.full(AN.skill1.keys[3][1]), 'out']);
        tells.push({ t: S - 0.72, c: 'red' });
        moves.push({ t0: S - 0.1, t1: S + 0.12, v: 860 });
        hits.push({ t0: S - 0.08, t1: S + 0.14, box: { x: -10, y: -118, w: 150, h: 100 }, dmg: 28, red: true, kb: 380 });
        ev.push({ t: S - 0.1, fn: () => { G.SFX.play('slash', 0.6, true); G.SFX.play('c7_inkDash'); } });
        lastKey = S + 0.3;
      } else {
        const h = ECHO_HIT[kd] || ECHO_HIT.l0, wind = Math.min(0.34, S - 0.09 - lastKey - 0.03);
        keys.push([S - 0.09 - wind, Rig.full(h.k[0][1]), 'io'], [S - 0.09, Rig.full(h.k[1][1]), 'io'], [S, Rig.full(h.k[2][1]), 'snap'], [S + 0.2, Rig.full(h.k[3][1]), 'out']);
        tells.push({ t: S - 0.57, c: 'white' });
        moves.push({ t0: S - 0.11, t1: S - 0.02, v: h.step });
        hits.push({ t0: S - 0.07, t1: S + 0.05, box: h.box, dmg: h.dmg, kb: 240, pbal: 26 });
        ev.push({ t: S - 0.07, fn: () => G.SFX.play('slash', h.pitch * 0.9) });
        lastKey = S + 0.2;
      }
    });
    const end = S + (kinds[kinds.length - 1] === 'red' ? 0.78 : 0.64);
    keys.push([end - 0.04, Rig.full(AN.idle(0)), 'io']);
    hits[hits.length - 1].last = true;
    return { dur: end, cd: 1.0, anim: { keys }, tells, hits, moves, ev, kinds, onStart: echoStart };
  }
  function echoStart(e) {
    // it "hears" first: a gilt ripple runs from her to it
    const P = G.game.player; if (!P) return;
    G.FX.beam(P.x, P.y - 70, e.x, e.y - 70, GOLD, 0.22, 2.5); G.FX.ring(e.x, e.y - 70, 6, 46, 0.3, GOLD, 2);
  }
  function echoPlan(e) {
    const ph = Rec.phrase();
    let kinds = ['l0', 'l1', 'red'], gap = 0.42;
    if (ph && ph.length) {
      const all = ph.map((r) => ECHO_KIND[r.k] || 'l0');
      if (ph.length > 1) gap = (ph[ph.length - 1].t - ph[0].t) / (ph.length - 1);
      const red = all.includes('red');
      kinds = all.filter((k) => k !== 'red').slice(-3);
      if (kinds.length === 1) kinds.push(kinds[0] === 'l0' ? 'l1' : 'l0');
      if (!kinds.length) kinds = ['l0', 'l1'];
      if (red || e.echoN % 3 === 2) kinds.push('red');          // the echo's full stop is always the lunge
    }
    e.echoN++;
    return buildEcho(kinds, gap);
  }
  function echoPose(e, dt) {
    const st = e.state, a = st === 'atk' ? e.atk : null;
    let p;
    if (a && a.anim) p = Rig.sample(a.anim, e.st);
    else if (st === 'hurt' || st === 'recoil') p = Rig.full(AN.hurt);
    else if (st === 'broken' || st === 'executed') p = Rig.full(Object.assign({}, AN.kneel, { torso: 0.62 + Math.sin(e.t * 2.3) * 0.05, head: 0.8 + Math.sin(e.t * 1.6) * 0.08, sw: 0.18, aF: 0.6, eF: 0.5 }));
    else if (st === 'spawn') p = Rig.full(AN.kneel);
    else if (!e.onGround) p = Rig.lerpPose(Rig.full(AN.rise), Rig.full(AN.fall), U.clamp((e.vy + 400) / 800, 0, 1));
    else if (Math.abs(e.vx) > 40) {
      const sp = Math.abs(e.vx), k = U.clamp(sp / 390, 0.4, 1), back = Math.sign(e.vx) !== e.facing;
      if (dt > 0) e.runP += (back ? -1 : 1) * sp * dt * PI / (2 * (back ? 13 : AN.gaitStride(k)));
      p = Rig.full(back ? AN.walk(e.runP) : AN.run(e.runP, k));
    } else p = Rig.full(AN.idle(e.t + e.seed));
    if (e.hitK > 0 && st !== 'die') p = Rig.lerpPose(p, Rig.full(AN.hurt), Math.min(0.85, e.hitK));
    if (!e.pose) e.pose = p;
    else if (dt > 0) e.pose = Rig.lerpPose(e.pose, p, 1 - Math.exp(-(e.hitK > 0 ? 40 : a ? 34 : 16) * dt));
    return e.pose;
  }
  // Rinne's head, re-inked: the same profile, no features — one red ember where her eye would be
  const facePath = (ctx) => {
    ctx.beginPath(); ctx.moveTo(-0.6, -9.3); ctx.bezierCurveTo(3.8, -9.6, 7.2, -7.2, 7.7, -3.6); ctx.lineTo(7.9, -2.4); ctx.lineTo(7.6, -1.7);
    ctx.lineTo(10.3, 1.6); ctx.lineTo(8.7, 2.3); ctx.lineTo(9.0, 3.3); ctx.lineTo(8.4, 3.9); ctx.lineTo(8.8, 4.8); ctx.lineTo(8.0, 5.6); ctx.lineTo(8.3, 6.9);
    ctx.lineTo(6.6, 8.5); ctx.lineTo(0.8, 7.9); ctx.lineTo(-1.6, 4.4); ctx.lineTo(-1.6, -6); ctx.closePath();
  };
  const crownPath = (ctx) => {
    ctx.beginPath(); ctx.moveTo(-11.4, -2.6); ctx.bezierCurveTo(-11.8, -9.8, -5.5, -12.6, 0.8, -12.1); ctx.bezierCurveTo(5.8, -11.7, 9.0, -9.2, 9.4, -5.6);
    ctx.lineTo(7.0, -7.0); ctx.lineTo(4.6, -6.0); ctx.lineTo(2.6, -7.2); ctx.lineTo(1.0, -4.0); ctx.lineTo(-0.4, 1.2); ctx.lineTo(-4.6, -1.6); ctx.closePath();
  };
  function echoHead(ctx, hc, ha, e, ghost) {
    ctx.save(); ctx.translate(hc.x, hc.y); ctx.rotate(ha); ctx.scale(1.08, 1.08);
    ctx.beginPath(); ctx.moveTo(-0.5, -10.4); ctx.bezierCurveTo(-6.5, -11.2, -11.6, -7.5, -11.4, -2.6); ctx.bezierCurveTo(-11.3, 1.8, -10.2, 4.6, -8.6, 6.2); ctx.lineTo(-3.2, 6.6); ctx.lineTo(-1.2, -1); ctx.closePath();
    ctx.fillStyle = '#0c0910'; ctx.fill(); ink(ctx, 1.2);
    facePath(ctx); ctx.fillStyle = cel(ctx, 4, 0, 1, 0, 8, INK3); ctx.fill(); ink(ctx, 1.3);
    crownPath(ctx); ctx.fillStyle = cel(ctx, -1, -7, 0.35, -0.94, 9, INK1); ctx.fill(); ink(ctx, 1.4);
    ctx.strokeStyle = 'rgba(242,199,102,0.42)'; ctx.lineWidth = 0.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(6.5, -8.6); ctx.quadraticCurveTo(-1, -10, -8.5, -6.2); ctx.moveTo(3.2, -6.8); ctx.quadraticCurveTo(-3, -7.6, -9.2, -3.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,252,244,0.5)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-5.5, -10.6); ctx.quadraticCurveTo(0, -12, 4.5, -10.8); ctx.stroke();
    const lock = (pts) => { poly(ctx, pts); ctx.fillStyle = '#1a1520'; ctx.fill(); ink(ctx, 1.0); };
    lock([[3.6, -11.2], [8.9, -8.2], [9.1, -4.3], [7.0, -7.0]]); lock([[2.2, -10.6], [6.4, -6.0], [6.2, -2.4], [4.6, -6.0]]); lock([[0.2, -6.2], [2.8, 1.8], [1.6, 10.6], [-0.4, 1.0]]);
    // the eye: one red ember (the only red it owns)
    if (!ghost) glow(ctx, 6.9, -1.2, 5.5, RED, 0.9);
    ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.moveTo(5.0, -1.0); ctx.quadraticCurveTo(6.4, -2.3, 7.9, -1.5); ctx.lineTo(8.8, -2.0); ctx.lineTo(7.7, -0.7); ctx.quadraticCurveTo(6.4, -1.2, 5.3, -0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe9ee'; ctx.beginPath(); ctx.arc(7.0, -1.25, 0.32, 0, TAU); ctx.fill();
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(-1.1, 4.4, 0.75, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-9.6, -5.6, 1.6, 2.6, -0.5, 0, TAU); ctx.fill(); ink(ctx, 0.8);
    ctx.restore();
  }
  // its sword: black glass with a gilt (or, on the lunge, red) edge
  function echoBlade(ctx, J, red) {
    const b = J.hdF, t = J.tip, pm = J.pommel;
    const dx = t.x - b.x, dy = t.y - b.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    LB(ctx, pm, b, 1.6, 1.8, INK2, { noHatch: true });
    LB(ctx, { x: b.x + nx * 4.5, y: b.y + ny * 4.5 }, { x: b.x - nx * 4.5, y: b.y - ny * 4.5 }, 1.3, 1.3, GILT, { noHatch: true });
    const s = { x: b.x + dx / L * 3, y: b.y + dy / L * 3 };
    ctx.beginPath(); ctx.moveTo(s.x + nx * 2.2, s.y + ny * 2.2); ctx.lineTo(t.x - dx / L * 8 + nx * 1.7, t.y - dy / L * 8 + ny * 1.7); ctx.lineTo(t.x, t.y); ctx.lineTo(s.x - nx * 1.4, s.y - ny * 1.4); ctx.closePath();
    ctx.fillStyle = '#0d0a12'; ctx.fill(); ink(ctx, 0.9);
    lighter(ctx, () => {
      const c = red ? RED : GOLD;
      ctx.strokeStyle = U.rgba(c, 0.95); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(s.x - nx * 1.1, s.y - ny * 1.1); ctx.lineTo(t.x, t.y); ctx.stroke();
      if (red) { ctx.strokeStyle = U.rgba(c, 0.35); ctx.lineWidth = 6; ctx.stroke(); }
    });
  }
  function echoBody(ctx, e, J, red, ghost) {
    const { Q, nx, ny } = torsoQ(J), f = e.facing, sk = e._sink || 0;
    const toL = (q) => ({ x: (q.x - e.x) * f, y: q.y - e.y - sk });
    const anc = Rig.clothAnchors(J);
    const cloth = (k) => (e[k] && e[k].inited ? e[k].p.map(toL) : restPts(anc[k], Rig.CLOTH[k]));
    inkCloth(ctx, cloth('scarf'), 2.7, 1.5, INK1, GOLD);
    if (e.hair.inited) {
      const hp = e.hair.p.map(toL);
      Rig.ribbon(ctx, hp, 5.4, 0.8, '#120e17', 2.8); ink(ctx, 1.3);
      lighter(ctx, () => Rig.ribbon(ctx, hp.map((q) => ({ x: q.x + 0.8, y: q.y - 1.2 })), 1.5, 0.2, 'rgba(242,199,102,0.5)', 0.8));
    }
    // back arm, back leg, back coat tail
    LC(ctx, [J.shB, J.elB, J.hdB], [3.9, 3.0, 2.3], INK2);
    LC(ctx, [J.hip, lp(J.hip, J.kneeB, 0.45), J.kneeB, lp(J.kneeB, J.ankB, 0.35), J.ankB], [7.2, 6.3, 4.3, 4.3, 2.7], INK2);
    LB(ctx, J.ankB, J.toeB, 3.1, 2.0, INK2);
    const coatB = cloth('coatB');
    inkCloth(ctx, coatB, 6.4, 11.5, INK2, GOLD);
    // torso: vest under an open long coat — one ink mass with gilt seams
    const mid = Q(0.5, 0);
    smoothP(ctx, [Q(-0.05, -9.4), Q(0.22, -7.0), Q(0.5, -5.8), Q(0.9, -7.6), Q(1.06, -4), Q(1.08, 3.5), Q(0.88, 8.6), Q(0.72, 9.2), Q(0.54, 5.8), Q(0.32, 5.6), Q(0.06, 8.6), Q(-0.1, 6.4)]);
    ctx.fillStyle = cel(ctx, mid.x, mid.y, nx, ny, 10, INK2); ctx.fill(); ink(ctx, 1.4);
    smoothP(ctx, [Q(-0.08, -10.6), Q(0.3, -8.4), Q(0.62, -7.6), Q(0.95, -8.8), Q(1.1, -5.5), Q(1.12, -1.0), Q(1.0, 2.8), Q(0.7, 3.6), Q(0.4, 2.2), Q(0.12, 2.6), Q(-0.06, 2.0)]);
    const cm = Q(0.5, -4); ctx.fillStyle = cel(ctx, cm.x, cm.y, nx, ny, 9, INK1); ctx.fill(); ink(ctx, 1.4);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.9; polyP(ctx, [Q(1.0, 2.9), Q(0.7, 3.7), Q(0.4, 2.3), Q(0.12, 2.7), Q(-0.06, 2.1)], false); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,240,0.22)'; ctx.lineWidth = 1.3; polyP(ctx, [Q(0.92, -6.6), Q(0.62, -6.2), Q(0.32, -7.2)], false); ctx.stroke();
    LB(ctx, Q(0.96, -6.6), Q(1.2, -5.0), 2.6, 2.3, INK1, { noHatch: true });
    LB(ctx, Q(0.08, -10.2), Q(0.08, 8.4), 2.3, 2.3, INK2, { noHatch: true });
    const bk = Q(0.08, 6.2); ctx.fillStyle = GOLD; ctx.beginPath(); ctx.ellipse(bk.x, bk.y, 2.0, 2.4, 0, 0, TAU); ctx.fill(); ink(ctx, 0.8);
    // front leg + boot, front coat flap
    LC(ctx, [J.hip, lp(J.hip, J.kneeF, 0.45), J.kneeF, lp(J.kneeF, J.ankF, 0.35), J.ankF], [7.8, 6.8, 4.6, 4.6, 2.9], INK1, { spec: 0.18 });
    LB(ctx, lp(J.kneeF, J.ankF, 0.28), J.ankF, 4.8, 3.2, INK2, { spec: 0.2 });
    LB(ctx, J.ankF, J.toeF, 3.5, 2.2, INK2);
    inkCloth(ctx, cloth('coatF'), 3.0, 5.6, INK1, GOLD);
    // neck, scarf wrap, head
    LB(ctx, J.chest, lp(J.chest, J.head, 0.55), 3.1, 2.9, INK3, { noHatch: true });
    LB(ctx, Q(1.0, -4.6), Q(1.1, 4.2), 3.1, 2.9, INK1, { noHatch: true });
    echoHead(ctx, J.head, J.ha, e, ghost);
    echoBlade(ctx, J, red);
    // front arm: sleeve, gilt-rimmed shoulder, bracer, fist
    LC(ctx, [J.sh, lp(J.sh, J.elF, 0.5), J.elF, J.hdF], [4.2, 4.0, 3.1, 2.4], INK3, { spec: 0.22 });
    ctx.beginPath(); ctx.ellipse(J.sh.x - 0.6, J.sh.y + 0.6, 4.8, 4.0, -0.3, 0, TAU); ctx.fillStyle = cel(ctx, J.sh.x, J.sh.y, 0.6, -0.8, 4.8, INK1); ctx.fill(); ink(ctx, 1.1);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(J.sh.x - 0.6, J.sh.y + 0.6, 3.6, 0.2, 1.6); ctx.stroke();
    LB(ctx, lp(J.elF, J.hdF, 0.36), lp(J.elF, J.hdF, 0.9), 3.4, 2.8, INK2, { spec: 0.3 });
    ctx.beginPath(); ctx.arc(J.hdF.x, J.hdF.y, 2.7, 0, TAU); ctx.fillStyle = '#0e0b12'; ctx.fill(); ink(ctx, 0.9);
    // it is still wet: drops run off the coat tail
    const tail = coatB[coatB.length - 1];
    if (tail) {
      ctx.fillStyle = '#0e0b12';
      for (let i = 0; i < 2; i++) { const ph = (e.t * 0.8 + i * 0.5 + e.seed * 0.01) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(tail.x + i * 3 - 1, tail.y + 3 + ph * ph * 34, 1.3, 2 + ph * 2, 0, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  function drawInkTrail(ctx, e, red) {
    const tr = e.trail, now = G.game.time; if (tr.length < 3) return;
    ctx.save();
    for (let pass = 0; pass < 2; pass++) {
      if (pass) ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i < tr.length; i++) {
        const a = tr[i - 1], b = tr[i], ka = 1 - (now - a.t) / 0.16, kb = 1 - (now - b.t) / 0.16;
        if (kb <= 0) continue;
        const ia = pass ? 0.74 : 0.08 + (1 - Math.max(0, ka)) * 0.5, ib = pass ? 0.74 : 0.08 + (1 - kb) * 0.5;
        ctx.fillStyle = pass ? U.rgba(red ? RED : GOLD, kb * 0.6) : `rgba(12,8,17,${kb * 0.82})`;
        ctx.beginPath();
        ctx.moveTo(a.bx + (a.tx - a.bx) * ia, a.by + (a.ty - a.by) * ia); ctx.lineTo(a.tx, a.ty); ctx.lineTo(b.tx, b.ty); ctx.lineTo(b.bx + (b.tx - b.bx) * ib, b.by + (b.ty - b.by) * ib);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }
  const MI = reg('c7_mirror', {
    name: '回聲殘像', en: 'ECHO SELF', w: 28, h: 112, hp: 120, bal: 70, col: GOLD, shards: 60, kbMul: 1.0, spawnT: 0.9,
    portrait: [2.6, 0.9],
    init(e) {
      e.seed = seedOf(); e.hair = new Rig.Chain(11, 7, 0.055, 0.9);
      for (const k of ['coatB', 'coatF', 'scarf']) { const c = Rig.CLOTH[k]; e[k] = new Rig.Chain(c[0], c[1], c[2], c[3]); }
      e.trail = []; e.echoN = 0; e.runP = 0;
    },
    voice: () => G.SFX.play('c7_echoVoice'),
    weapon: (e) => e.wpt || { x: e.x + e.facing * 70, y: e.y - 90 },
    think(e, dt) {
      Rec.sample(); e.faceP();
      const P = e.P, d = e.distP(), dy = Math.abs(P.y - e.y);
      let vx;
      if (d > 270) vx = e.facing * 230;
      else if (d < 95) vx = -e.facing * 160;
      else vx = -U.clamp(P.vx, -260, 260) * 0.85 + e.facing * (d - 165) * 1.3;    // a reflection: you step in, it steps in
      e.vx = U.approach(e.vx, U.clamp(vx, -260, 260) * e.speedMul, 1500 * dt);
      if (e.cd > 0 || dy > 150 || !e.onGround) return;
      if (d < 215) e.startAtk(echoPlan(e));
      else if (d < 430 && Math.random() < 0.55) e.startAtk(MI.lunge);
      else e.cd = 0.25;
    },
    atkUpdate(e, dt) {
      Rec.sample();
      // gilt afterimages while it lunges
      if (Math.abs(e.vx) > 520 && (e.ghT = (e.ghT || 0) - dt) <= 0 && e.pose) {
        e.ghT = 0.035; G.FX.ghost({ x: e.x, y: e.y, facing: e.facing, pose: Object.assign({}, e.pose) }, GOLD, 0.28, 0.3);
      }
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, f = e.facing, a = e.state === 'atk' ? e.atk : null;
      const p = echoPose(e, dt), J = Rig.compute(p);
      const sink = K.emerge(ctx, e) * 118; e._sink = sink;
      const W = (q) => ({ x: e.x + f * q.x, y: e.y + sink + q.y });
      if (dt > 0) {
        const c = Math.cos(J.ha), s = Math.sin(J.ha);
        const hp = W({ x: J.head.x + (-9.6 * c + 5.6 * s), y: J.head.y + (-9.6 * s - 5.6 * c) });
        const wind = -e.vx * 9 + Math.sin(e.t * 1.7 + e.seed) * 280;
        e.hair.update(hp.x, hp.y, f, dt, wind, 2.62);
        const an = Rig.clothAnchors(J), CL = Rig.CLOTH, floor = e.onGround ? e.y - 0.5 : 1e9;
        for (const [k, wk] of [['coatB', 0.45], ['coatF', 0.35], ['scarf', 1.25]]) {
          const q = W(an[k]); e[k].update(q.x, q.y, f, dt, wind * wk, CL[k][4]);
          for (const pt of e[k].p) if (pt.y > floor) pt.y = floor;
        }
      }
      const tipW = W(J.tip), baseW = W(lp(J.hdF, J.tip, 0.3));
      if (!ghost) e.wpt = tipW;
      const red = !!(a && a.hits && a.hits.some((h) => h.red && e.st > h.t0 - 0.75 && e.st < h.t1 + 0.12));
      if (dt > 0) {
        const now = G.game.time;
        if (a && a.hits && a.hits.some((h) => e.st > h.t0 - 0.12 && e.st < h.t1 + 0.1)) e.trail.push({ bx: baseW.x, by: baseW.y, tx: tipW.x, ty: tipW.y, t: now });
        while (e.trail.length && (now - e.trail[0].t > 0.16 || e.trail.length > 16)) e.trail.shift();
      }
      if (!ghost) {
        // the pool of ink it stands in, and a pale backlight so the ink reads against the dark score
        const fl = floorAt(e.x, e.y - 4, e.y);
        if (fl - e.y < 60) { ctx.fillStyle = 'rgba(10,7,14,0.6)'; ctx.beginPath(); ctx.ellipse(e.x - f * 4, fl - 0.5, 30 + Math.sin(e.t * 2) * 2, 3.6, 0, 0, TAU); ctx.fill(); }
        glow(ctx, e.x + f * J.chest.x, e.y + sink + J.chest.y + 20, 76, '#fff0d0', e.state === 'broken' ? 0.1 : 0.17);     // kept on low quality: it is how the ink reads at all
      }
      ctx.save(); ctx.translate(e.x, e.y + sink); ctx.scale(f, 1);
      echoBody(ctx, e, J, red, ghost);
      ctx.restore();
      drawInkTrail(ctx, e, red);
      if (e.tellT > 0) glow(ctx, tipW.x, tipW.y, 30, e.tellCol === 'red' ? RED : '#ffffff', e.tellT * 1.4);
      if (e.state === 'broken') dizzy(ctx, e.x + f * J.head.x, e.y + sink + J.head.y - 18, e.t);
    },
  });
  MI.echo = buildEcho(['l0', 'l1', 'red'], 0.42);       // the default phrase (also what #gallery &pose=echo:t shows)
  MI.lunge = buildEcho(['red']);

  /* =========================================================================================
     c7_restmark 休止符 REST MARK — a quarter rest (𝄽) or an eighth rest (𝄾) torn off its staff, still carrying
     five lines of it. It wants every bar to be silent.
     note  (white — a homing eighth note; a perfect guard sends it home)
     erase (red — crosses out the one-way platform nearest you, ~1 s, then that platform is gone for 3 s)
     dive  (red — with nothing to erase it becomes a brush stroke and strikes through you)
     ========================================================================================= */
  let RM_N = 0;
  const rmHeadL = (e) => (e.kind === 'e' ? { x: -10, y: -98 } : { x: -2, y: -90 });
  const rmHead = (e) => { const h = rmHeadL(e); return { x: e.x + e.facing * h.x, y: e.y + (e._sink || 0) + h.y }; };
  // the platform a Rest Mark would cross out: the one under/near her, within its reach; never one already taken
  function eraseTarget(e) {
    const P = G.game.player, L = G.LEVEL; if (!P || !L.oneways || !L.oneways.length) return null;
    if (World.erased.filter((r) => !r.back).length >= 2) return null;
    const taken = new Set(G.game.enemies.filter((o) => o !== e && o.eraseP && o.state === 'atk').map((o) => o.eraseP));
    let best = null, bd = 1e9;
    for (const p of L.oneways) {
      if (!p || p.noErase || p.c7noErase || !(p.w > 0) || p.w > 720 || taken.has(p) || World.isErased(p)) continue;
      const cx = U.clamp(P.x, p.x, p.x + p.w), dx = Math.abs(cx - P.x), dy = p.y - P.y;
      if (dx > 340 || dy < -380 || dy > 240) continue;
      if (Math.abs(p.x + p.w / 2 - e.x) > 900 || Math.abs(p.y - e.y) > 700) continue;
      const score = dx + Math.abs(dy) * 0.6 - (dx < 1 && Math.abs(dy) < 3 ? 500 : 0);       // under her feet first
      if (score < bd) { bd = score; best = p; }
    }
    return best;
  }
  function doErase(e) {
    const p = e.eraseP; e.eraseP = null;
    if (!p || G.LEVEL.oneways.indexOf(p) < 0) return;
    if (!World.erase(p, 3.0)) return;
    G.SFX.play('c7_eraseTear'); G.game.shake(0.18);
    for (let x = p.x + 10; x < p.x + p.w; x += 30) { G.FX.shards(x, p.y + 4, 2, PAPER, 260); G.FX.dust(x, p.y + 8, 2, { w: 20, speed: 60, size: 9, col: 'rgba(12,8,16,' }); }
    G.FX.ring(p.x + p.w / 2, p.y + 6, 10, p.w * 0.6 + 30, 0.4, RED, 3, { flat: 0.2 });
  }
  // the warning: red strokes cross the doomed platform out one by one; it flickers faster as the eraser closes in
  function drawEraseWarn(ctx, e, p, k) {
    const t = G.game.time, x0 = p.x, y = p.y, n = Math.max(4, Math.round(p.w / 24)), m = Math.min(n, Math.floor(k * n * 1.05) + 1);
    lighter(ctx, () => {
      const fl = 0.5 + 0.5 * Math.sin(t * (16 + 34 * k));
      ctx.strokeStyle = U.rgba(RED, (0.25 + 0.5 * k) * (0.55 + 0.45 * fl)); ctx.lineWidth = 2;
      ctx.strokeRect(x0 - 3, y - 6, p.w + 6, 26);
      ctx.strokeStyle = U.rgba(RED, 0.9); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < m; i++) { const x = x0 + (i + 0.5) / n * p.w, j = (hash(i, e.seed) - 0.5) * 6; ctx.moveTo(x - 9 + j, y + 17); ctx.lineTo(x + 9 + j, y - 6); }
      ctx.stroke();
      const h = rmHead(e), tx = U.clamp(e.x, x0, x0 + p.w);
      ctx.strokeStyle = U.rgba(RED, 0.45 * k); ctx.lineWidth = 1.2; ctx.setLineDash([3, 5]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(tx, y); ctx.stroke();
    });
  }
  // the erased platform: a rubbed-out void with a torn edge over its painted art, a dotted gilt ghost of where it
  // will return, and a gilt fuse burning down from both ends; then a quill re-inks it from left to right
  function drawErased(ctx, h, g) {
    const r = h.rec, p = r.p, now = g.time;
    const x0 = p.x - 5, x1 = p.x + p.w + 5, y0 = p.y - 9, y1 = p.y + (p.c7h || 26);
    const rev = r.back ? U.clamp((now - r.backT) / 0.45, 0, 1) : 0; if (rev >= 1) return;
    const xr = U.lerp(x0, x1, U.easeInOutSine(rev)), pop = U.clamp((now - r.t0) / 0.16, 0, 1);
    const left = r.back ? 0 : U.clamp((r.until - now) / Math.max(0.1, r.until - r.t0), 0, 1);
    ctx.save();
    ctx.beginPath(); ctx.rect(xr, y0 - 40, x1 - xr + 6, y1 - y0 + 80); ctx.clip();
    ctx.beginPath(); ctx.moveTo(x0, y0);
    for (let x = x0; x <= x1; x += 9) ctx.lineTo(x, y0 + (hash(Math.round(x), r.seed) - 0.5) * 5);
    for (let y = y0; y <= y1; y += 7) ctx.lineTo(x1 + (hash(Math.round(y), r.seed + 1) - 0.5) * 6, y);
    for (let x = x1; x >= x0; x -= 9) ctx.lineTo(x, y1 + (hash(Math.round(x), r.seed + 2) - 0.5) * 7);
    for (let y = y1; y >= y0; y -= 7) ctx.lineTo(x0 + (hash(Math.round(y), r.seed + 3) - 0.5) * 6, y);
    ctx.closePath(); ctx.fillStyle = `rgba(9,6,13,${0.8 * pop})`; ctx.fill();
    ctx.strokeStyle = 'rgba(240,232,214,0.13)'; ctx.lineWidth = 2.2; ctx.beginPath();
    for (let x = x0 + 6; x < x1 - 4; x += 11) { ctx.moveTo(x, y1 - 3); ctx.lineTo(x + 9, y0 + 3); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(240,232,214,0.5)'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]); ctx.lineDashOffset = now * 10;
    ctx.strokeRect(p.x + 0.5, p.y - 2, p.w - 1, (p.c7h || 26) - 4); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(240,232,214,0.55)';
    for (let i = 0; i < p.w / 18; i++) { const cx = p.x + hash(i, r.seed) * p.w, cy = p.y + 4 + hash(i + 50, r.seed) * 16 + ((now - r.t0) * 14 * (0.5 + hash(i + 9, r.seed))) % 22; ctx.fillRect(cx, cy, 1.6, 1.6); }
    lighter(ctx, () => {
      ctx.strokeStyle = U.rgba(GOLD, 0.45); ctx.lineWidth = 1.4; ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y); ctx.stroke(); ctx.setLineDash([]);
      const cx = p.x + p.w / 2, hw = p.w / 2 * left;
      if (hw > 0.5) { ctx.strokeStyle = U.rgba(GOLD, 0.95); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(cx - hw, p.y); ctx.lineTo(cx + hw, p.y); ctx.stroke(); }
      if (!r.back && left < 0.22 && Math.sin(now * 30) > 0) { ctx.strokeStyle = U.rgba(GOLDL, 0.7); ctx.lineWidth = 1.5; ctx.strokeRect(p.x, p.y - 2, p.w, 5); }
    });
    ctx.restore();
    if (r.back) lighter(ctx, () => { K.glow(ctx, xr, p.y + 4, 26, GOLD, 0.9 * (1 - rev)); ctx.fillStyle = GOLDL; star4(ctx, xr, p.y + 2, 3.2); });
  }
  function fireNote(e) {
    const o = rmHead(e), P = G.game.player; if (!P) return;
    const a = Math.atan2(P.y - 58 - o.y, P.x - o.x), sp = 280;
    G.game.hazards.push({ t: 0, life: 4.2, x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, owner: e, dmg: 16, r: 11, passed: false, seed: seedOf(), update: noteUpdate, draw: noteDraw });
    G.SFX.play('c7_noteFire'); G.FX.ring(o.x, o.y, 4, 30, 0.28, '#ffffff', 2.5);
  }
  function noteUpdate(h, dt, g) {
    const P = g.player;
    if (h.t < 2.4 && P && !h.passed) {            // a gentle homing turn for the first 2.4 s, then straight on
      const want = Math.atan2(P.y - 58 - h.y, P.x - h.x), cur = Math.atan2(h.vy, h.vx);
      let d = want - cur; while (d > PI) d -= TAU; while (d < -PI) d += TAU;
      const na = cur + U.clamp(d, -1.9 * dt, 1.9 * dt), sp = Math.hypot(h.vx, h.vy);
      h.vx = Math.cos(na) * sp; h.vy = Math.sin(na) * sp;
    }
    h.x += h.vx * dt; h.y += h.vy * dt;
    if (solidAt(h.x, h.y)) { h.done = true; G.FX.spark(h.x, h.y, 8, { col: '#ffffff', speed: 300 }); return; }
    if (!P || h.passed) return;
    const hb = P.hurtbox;
    if (h.x + h.r > hb.x && h.x - h.r < hb.x + hb.w && h.y + h.r > hb.y && h.y - h.r < hb.y + hb.h) {
      const res = P.receiveHit(h.owner, { dmg: h.dmg, kb: 170, projectile: true, hx: h.x, hy: h.y, waveFrom: h.x });
      if (res === 'parried') {
        g.projectiles.push({ x: h.x, y: h.y, vx: -h.vx * 1.5, vy: -h.vy * 0.4 - 80, r: 11, owner: h.owner, friendly: true, dmg: h.dmg, life: 3, t: 0, col: '#ffffff' });
        G.FX.ring(h.x, h.y, 6, 60, 0.3, '#7ff4ff', 4); h.done = true;
      } else if (res === 'dodged' || res === 'ignored') h.passed = true;
      else { h.done = true; G.FX.spark(h.x, h.y, 10, { col: '#ffffff', speed: 360 }); }
    }
  }
  function noteDraw(ctx, h) {
    const a = Math.min(1, h.t * 6) * (h.t > h.life - 0.3 ? Math.max(0, (h.life - h.t) / 0.3) : 1);
    ctx.globalAlpha *= a;
    glow(ctx, h.x, h.y, 26, '#fff4dc', 0.5);
    lighter(ctx, () => { ctx.fillStyle = U.rgba(GOLD, 0.6); for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(h.x - h.vx * 0.03 * i, h.y - h.vy * 0.03 * i, 2.4 - i * 0.55, 0, TAU); ctx.fill(); } });
    ctx.translate(h.x, h.y); ctx.rotate(Math.sin(h.t * 7 + h.seed) * 0.3);
    ctx.beginPath(); ctx.ellipse(-2.5, 4, 6.2, 4.4, -0.45, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, 1.3);
    ctx.beginPath(); ctx.moveTo(3.2, 2.5); ctx.lineTo(3.2, -15); ctx.quadraticCurveTo(5, -9, 11, -6); ctx.quadraticCurveTo(7, -9.5, 5, -13);
    ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // five lines of torn staff it carries with it (fading at both ends)
  function staffBits(ctx, e, red) {
    const t = e.t, x0 = -54, x1 = 54, c = red ? '255,70,110' : '246,238,220';
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.24, `rgba(${c},0.62)`); g.addColorStop(0.76, `rgba(${c},0.62)`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.save(); ctx.strokeStyle = g; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i < 5; i++) { const y = -112 + i * 12 + Math.sin(t * 1.4 + i * 0.7) * 1.4, dx = Math.sin(t * 0.9 + i) * 4; ctx.moveTo(x0 + dx, y); ctx.lineTo(x1 + dx, y); }
    ctx.stroke(); ctx.restore();
  }
  // broad-nib calligraphy: a slanted nib swept along a polyline gives an engraved glyph its crisp thick/thin strokes
  const NIB = { x: 0.6 * 9.6, y: 0.8 * 9.6 };
  function nibPath(ctx, P, ox = 0, oy = 0) {
    ctx.beginPath();
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      ctx.moveTo(a.x - NIB.x + ox, a.y - NIB.y + oy); ctx.lineTo(a.x + NIB.x + ox, a.y + NIB.y + oy); ctx.lineTo(b.x + NIB.x + ox, b.y + NIB.y + oy); ctx.lineTo(b.x - NIB.x + ox, b.y - NIB.y + oy); ctx.closePath();
    }
  }
  const spine = (ctx, P, ox = 0, oy = 0) => { ctx.beginPath(); P.forEach((q, i) => (i ? ctx.lineTo(q.x + ox, q.y + oy) : ctx.moveTo(q.x + ox, q.y + oy))); };
  // ink outline all round, a gilt rim where the light falls, then the wet black body on top
  function nibGlyph(ctx, P, lit, body) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    nibPath(ctx, P); ctx.fillStyle = INK; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.stroke();
    spine(ctx, P); ctx.lineWidth = 4.6; ctx.stroke();
    nibPath(ctx, P, lit * 1.4, -1.4); ctx.fillStyle = GOLD; ctx.fill();
    spine(ctx, P, lit * 1.4, -1.4); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
    nibPath(ctx, P); ctx.fillStyle = body; ctx.fill();
    spine(ctx, P); ctx.strokeStyle = body; ctx.lineWidth = 2; ctx.stroke();
  }
  function nibBall(ctx, c, r, lit, body) {
    ctx.beginPath(); ctx.arc(c.x, c.y, r + 2.2, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.arc(c.x + lit * 1.7, c.y - 1.7, r, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fillStyle = body; ctx.fill();
  }
  const RQ = [[-11, -126], [3, -108], [-12, -82], [5, -60], [-3, -49], [-10, -38], [-11, -29], [-7, -20], [0, -15], [7, -13]];
  // the glyph (local: facing +x, bottom at y = 0) + the dry tail it trails; returns where its eye sits
  function restGlyph(ctx, e, flex, stretch, tail, red) {
    const t = e.t, wob = (i) => Math.sin(t * 3.2 + i * 1.9 + e.seed) * 1.5 * flex;
    const lit = Rig.lightDir(ctx).x >= 0 ? 1 : -1, body = red ? '#2a0d17' : '#17131c';
    if (tail && tail.length > 2) {
      Rig.ribbon(ctx, tail, 3.4, 0.4, '#120e17', 1.2); ink(ctx, 1);
      lighter(ctx, () => Rig.ribbon(ctx, tail.map((q) => ({ x: q.x + 0.8, y: q.y - 0.6 })), 1.1, 0.1, 'rgba(242,199,102,0.55)'));
    }
    let eye;
    if (e.kind === 'q') {
      const P = RQ.map(([x, y], i) => ({ x: x + wob(i), y: y * stretch }));
      nibGlyph(ctx, P, lit, body);
      // dry-brush grain and the engraver's hairline down the heavy stroke
      ctx.strokeStyle = 'rgba(255,246,226,0.1)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (const o of [-3, 3]) { ctx.moveTo(P[1].x + o, P[1].y + 2); ctx.lineTo(P[2].x + o, P[2].y - 2); ctx.moveTo(P[4].x + o * 0.6, P[4].y); ctx.lineTo(P[6].x + o * 0.6, P[6].y); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,246,226,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P[1].x + 3.5 * lit, P[1].y + 3); ctx.lineTo(P[2].x + 6 * lit, P[2].y - 3); ctx.stroke();
      eye = lp(P[1], P[2], 0.55);
    } else {
      const B = { x: -10 + wob(0), y: -98 * stretch }, F = [B, { x: -2 + wob(1), y: -92 * stretch }, { x: 6 + wob(2), y: -94 * stretch }, { x: 13 + wob(3), y: -101 * stretch }];
      nibGlyph(ctx, F.slice(1), lit, body);
      LB(ctx, F[3], { x: -3 + wob(4), y: -13 * stretch }, 3.6, 2.4, INK1);
      nibBall(ctx, B, 11.5, lit, body);
      eye = B;
    }
    return eye;
  }
  function restEye(ctx, c, r, e, P, wide) {
    ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * 0.82 * wide, 0, 0, TAU); ctx.fillStyle = '#f6f0e2'; ctx.fill(); ink(ctx, 1.3);
    let lx = 0, ly = 0;
    if (P) { const dx = (P.x - e.x) * e.facing, dy = P.y - 60 - (e.y + c.y), d = Math.hypot(dx, dy) || 1; lx = dx / d * r * 0.3; ly = dy / d * r * 0.22; }
    ctx.save(); ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * 0.82 * wide, 0, 0, TAU); ctx.clip();
    ctx.beginPath(); ctx.arc(c.x + lx, c.y + ly, r * 0.58, 0, TAU); ctx.fillStyle = cel(ctx, c.x + lx, c.y + ly, 0.6, -0.8, r * 0.58, GILT); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x + lx, c.y + ly, r * 0.2, r * 0.32, 0, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(c.x + lx - r * 0.22, c.y + ly - r * 0.2, r * 0.14, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(40,24,52,0.3)'; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 0.55);
    ctx.restore();
  }
  const RM = reg('c7_restmark', {
    name: '休止符', en: 'REST MARK', w: 46, h: 124, hp: 68, bal: 40, col: '#f6e7c1', shards: 42, kbMul: 1.3, spawnT: 0.75, fly: true, hover: true,
    portrait: [2.3, 0.8],
    init(e) { e.seed = seedOf(); e.kind = (RM_N++ % 2) ? 'e' : 'q'; e.eraseCd = 1.5 + Math.random() * 2; e.tail = new Rig.Chain(6, 8, 0.07, 0.9); },
    voice: () => G.SFX.play('c7_restVoice'),
    weapon: (e) => e.wpt || rmHead(e),
    think(e, dt) {
      hoverInit(e, 150);
      e.faceP(); e.eraseCd -= dt; e.eraseP = null;
      const P = e.P, d = e.distP();
      // drift: a spot beside her, above head height, bobbing like a note on a line
      const side = Math.sign(e.x - P.x) || -e.facing;
      const tx = clampArena(e, P.x + side * 250);
      e.vx = U.approach(e.vx, U.clamp((tx - e.x) * 1.6, -170, 170) * e.speedMul, 520 * dt);
      const fl = floorAt(e.x, e.y - 10, e.y0 + 150);
      const ty = U.clamp(P.y - 120, fl - 300, fl - 100) + Math.sin(e.t * 2.2 + e.seed) * 8;
      e.vy = U.clamp((ty - e.y) * 2.4, -220, 220);
      if (e.cd > 0) return;
      const tgt = e.eraseCd <= 0 ? eraseTarget(e) : null;
      if (tgt && Math.random() < 0.75) { e.eraseP = tgt; e.eraseCd = 6.5; e.startAtk(RM.erase); }
      else if (d < 720) e.startAtk(d < 320 && Math.random() < 0.45 ? RM.dive : RM.note);
      else e.cd = 0.3;
    },
    note: { dur: 1.3, cd: 1.6, track: false, tells: [{ t: 0.24, c: 'white' }], ev: [{ t: 0.74, fn: fireNote }] },
    erase: {
      dur: 1.95, cd: 1.5, track: false, tells: [{ t: 0.12, c: 'red' }],
      ev: [{ t: 0.12, fn: () => G.SFX.play('c7_erase') }, { t: 1.08, fn: doErase }],
    },
    dive: {
      dur: 1.75, cd: 1.7, track: false, tells: [{ t: 0.2, c: 'red' }],
      onStart: (e) => { e.diveT = null; },
      hits: [{ t0: 0.84, t1: 1.08, box: { x: -30, y: -128, w: 76, h: 124 }, dmg: 24, red: true, kb: 320, last: true }],
    },
    atkUpdate(e, dt) {
      const a = e.atk, P = e.P;
      if (a === RM.dive) {
        if (e.st < 0.78) { e.vx = U.approach(e.vx, -e.facing * 70, 600 * dt); e.vy = U.approach(e.vy, -90, 600 * dt); }
        else if (!e.diveT) {
          const fl = floorAt(P.x, P.y - 20, P.y);
          e.diveT = { x: P.x, y: Math.min(P.y - 8, fl - 4) };
          e.facing = e.diveT.x < e.x ? -1 : 1;
          const dx = e.diveT.x + e.facing * 40 - e.x, dy = e.diveT.y - e.y, T = 0.28;
          e.diveV = { x: U.clamp(dx / T, -1150, 1150), y: U.clamp(dy / T, -900, 900) };
          G.SFX.play('whoosh', 1.3); G.SFX.play('c7_inkDash');
        } else if (e.st < 1.1) { e.vx = e.diveV.x; e.vy = e.diveV.y; }
        else { e.vx = U.approach(e.vx, 0, 1800 * dt); e.vy = U.approach(e.vy, -140, 1200 * dt); }
      } else {
        e.vx = U.approach(e.vx, 0, 500 * dt);
        e.vy = U.approach(e.vy, a === RM.erase && e.st < 1.1 ? -26 : 0, 400 * dt);
      }
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, a = e.state === 'atk' ? e.atk : null, P = G.game.player;
      const sink = K.emerge(ctx, e) * 36; e._sink = sink;
      if (!ghost && a === RM.erase && e.eraseP && e.st > 0.1 && e.st < 1.1) drawEraseWarn(ctx, e, e.eraseP, U.clamp((e.st - 0.1) / 0.98, 0, 1));
      let tilt = Math.sin(e.t * 1.3 + e.seed) * 0.07, flex = 1, stretch = 1, hot = 0, red = false, wide = 1;
      if (a === RM.note) { const k = U.clamp(e.st / 0.74, 0, 1); stretch = 1 + Math.sin(k * PI) * 0.1 - (e.st > 0.74 && e.st < 0.9 ? 0.14 : 0); tilt -= 0.28 * Math.sin(k * PI * 0.5); hot = k; wide = 1 + 0.3 * k; }
      else if (a === RM.erase) { const k = U.clamp(e.st / 1.05, 0, 1); flex = 1 + k * 2.6; tilt = 0.3 * Math.sin(e.t * 9) * k; red = e.st < 1.25; hot = k; wide = 1.3; }
      else if (a === RM.dive) {
        if (e.st < 0.8) { const k = U.clamp(e.st / 0.6, 0, 1); tilt = -0.5 * k; stretch = 1 - 0.14 * k; }
        else if (e.st < 1.12) { tilt = 1.1; stretch = 1.28; }
        red = e.st > 0.1 && e.st < 1.12; hot = 1;
      } else if (e.state === 'hurt' || e.state === 'recoil') { tilt = -0.5; flex = 2.2; }
      else if (e.state === 'broken' || e.state === 'executed') { tilt = 0.9 + Math.sin(e.t * 2) * 0.15; flex = 0.4; stretch = 0.92; wide = 0.35; }
      if (e.hitK > 0) tilt -= e.hitK * 0.6;
      const z = blendTo(e, 'pz', { tilt, flex, stretch, hot, wide }, dt, e.hitK > 0 ? 30 : 12);
      if (!ghost) e.wpt = rmHead(e);
      // a red streak where it struck through
      if (!ghost && a === RM.dive && e.st > 0.8 && e.st < 1.3 && e.diveT) {
        const k = U.clamp((e.st - 0.8) / 0.5, 0, 1);
        lighter(ctx, () => { ctx.strokeStyle = U.rgba(RED, 0.6 * (1 - k)); ctx.lineWidth = 10 * (1 - k) + 1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(e.x - e.vx * 0.06, e.y - 50 - e.vy * 0.06); ctx.lineTo(e.x, e.y - 50); ctx.stroke(); });
      }
      // its dry tail streams off the bottom of the stroke (world chain)
      const tc = Math.cos(z.tilt), ts = Math.sin(z.tilt), bot = e.kind === 'q' ? { x: 3, y: -7 } : { x: -3, y: -12 };
      const bl = { x: bot.x * tc - (bot.y + 62) * ts, y: bot.x * ts + (bot.y + 62) * tc - 62 };
      if (dt > 0) e.tail.update(e.x + e.facing * bl.x, e.y + sink + bl.y, e.facing, dt, -e.vx * 7 + Math.sin(e.t * 2.3 + e.seed) * 260, 2.5);
      const tail = e.tail.inited ? e.tail.p.map((q) => { const lx = (q.x - e.x) * e.facing, ly = q.y - e.y - sink + 62; return { x: lx * tc + ly * ts, y: -lx * ts + ly * tc - 62 }; }) : null;
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing, 1);
      ctx.translate(0, -62); ctx.rotate(z.tilt); ctx.translate(0, 62);
      if (!ghost && !low()) glow(ctx, 0, -66, 84, red ? RED : '#fff2d8', red ? 0.2 + 0.2 * z.hot : 0.14);
      staffBits(ctx, e, red);
      const c = restGlyph(ctx, e, z.flex, z.stretch, tail, red);
      if (!ghost && z.hot > 0.05) glow(ctx, c.x, c.y, 28, red ? RED : GOLD, 0.6 * z.hot);
      restEye(ctx, c, e.kind === 'e' ? 7.2 : 5.6, e, P, z.wide);
      // gilt motes orbiting the stroke
      if (!ghost) lighter(ctx, () => { ctx.fillStyle = U.rgba(red ? REDL : GOLDL, 0.85); for (let i = 0; i < 3; i++) { const an = e.t * 1.6 + i * TAU / 3 + e.seed; ctx.beginPath(); ctx.arc(Math.cos(an) * 34, -66 + Math.sin(an) * 44, 1.5, 0, TAU); ctx.fill(); } });
      if (e.tellT > 0) glow(ctx, c.x, c.y, 34, e.tellCol === 'red' ? RED : '#ffffff', e.tellT * 1.4);
      if (e.state === 'broken') dizzy(ctx, 0, -136, e.t, 14);
    },
  });

  /* =========================================================================================
     c7_choir 無聲詩班 VOICELESS CHOIR — singers whose eyes are sewn shut with gilt thread. They come two or three at
     a time and close a ring around you; they open their mouths and nothing comes out. While any of them lives near
     you, your resonance cannot grow.
     hymn  (white — a slow ring of silence expanding from the singer; guard it, or perfect-guard it back at them)
     shove (white — up close, a weak slap of its score)
     ========================================================================================= */
  let CH_UID = 0, CHOIR_NEXT = 0;
  const choirs = () => G.game.enemies.filter((o) => o.type === 'c7_choir' && !o.dead);
  function choirSlot(e) {
    const P = G.game.player, all = choirs().sort((a, b) => a.uid - b.uid), n = all.length, i = Math.max(0, all.indexOf(e));
    const side = Math.sign(e.x - P.x) || 1;
    let dx, hy;
    if (n <= 1) { dx = side * 300; hy = 42; }
    else if (n === 2) { dx = i === 0 ? -300 : 300; hy = i === 0 ? 36 : 64; }
    else { const k = i % 3; dx = k === 0 ? -320 : k === 1 ? 320 : side * 130; hy = k === 2 ? 236 : 38 + (i >= 3 ? 80 : 0); }
    return { x: P.x + dx, hy };
  }
  const chMouthL = (z) => chRig(z).mouth;
  const chMouth = (e) => { const z = e.cz || CHDEF, m = chMouthL(z); return { x: e.x + e.facing * m.x, y: e.y + (e._sink || 0) + m.y }; };
  function hymnWave(e) {
    const o = chMouth(e);
    G.game.hazards.push({ t: 0, life: 3.5, x: o.x, y: o.y, r: 14, sp: 165, owner: e, hit: false, seed: e.seed, floor: floorAt(o.x, o.y, o.y + 160), update: waveUpdate, draw: waveDraw });
    G.SFX.play('c7_hymn'); G.FX.ring(o.x, o.y, 6, 40, 0.35, '#ffffff', 2);
  }
  function waveUpdate(h, dt, g) {
    h.r += h.sp * dt;
    const P = g.player; if (h.hit || !P) return;
    const px = P.x, py = P.y - 56, d = Math.hypot(px - h.x, py - h.y);
    if (Math.abs(d - h.r) < 20) {
      const res = P.receiveHit(h.owner, { dmg: 17, kb: 220, hx: px, hy: py, waveFrom: h.x });
      if (res === 'hit' || res === 'blocked' || res === 'parried') h.hit = true;
      if (res === 'parried' && h.owner && !h.owner.dead) {
        // a perfect guard turns the silence around: it flies home as a note of her own
        g.projectiles.push({ x: px, y: py, vx: Math.sign(h.owner.x - px || 1) * 520, vy: -70, r: 10, owner: h.owner, friendly: true, dmg: 0, life: 2.6, t: 0, col: '#ffffff' });
        const o = h.owner; o.bal = Math.min(o.maxBal, o.bal + 26); o.showBar = 3; if (o.bal >= o.maxBal && o.state !== 'broken') o.breakBalance();
      }
    }
  }
  function waveDraw(ctx, h) {
    const k = h.t / h.life, a = (1 - k) * Math.min(1, h.t * 5);
    ctx.beginPath(); ctx.rect(h.x - h.r - 40, h.y - h.r - 40, h.r * 2 + 80, h.floor - (h.y - h.r - 40)); ctx.clip();      // never under the floor
    lighter(ctx, () => {
      ctx.lineCap = 'round';
      for (let j = 0; j < 3; j++) { const rr = h.r - j * 7; if (rr <= 2) continue; ctx.strokeStyle = U.rgba(j === 1 ? GOLDL : '#ffffff', a * (j === 0 ? 0.85 : 0.38)); ctx.lineWidth = j === 0 ? 2.6 : 1.2; ctx.beginPath(); ctx.arc(h.x, h.y, rr, 0, TAU); ctx.stroke(); }
      ctx.strokeStyle = U.rgba('#ffffff', a * 0.14); ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(h.x, h.y, Math.max(1, h.r - 4), 0, TAU); ctx.stroke();
    });
    // tiny notes riding the ring — a song nobody can hear
    ctx.fillStyle = U.rgba('#ffffff', a * 0.9);
    for (let i = 0; i < 8; i++) {
      const an = hash(i, h.seed) * TAU + h.t * 0.25, x = h.x + Math.cos(an) * h.r, y = h.y + Math.sin(an) * h.r;
      ctx.beginPath(); ctx.ellipse(x, y, 2.6, 1.9, -0.45, 0, TAU); ctx.fill(); ctx.fillRect(x + 1.6, y - 8, 1, 8);
    }
  }
  const CHDEF = { bow: 0, sing: 0, arms: 0.5, slump: 0, whip: 0, breath: 0 };
  const CHP = {
    idle: (t) => ({ bow: 0.05 + Math.sin(t * 0.9) * 0.03, sing: 0.06 + Math.sin(t * 1.3) * 0.04, arms: 0.5 + Math.sin(t * 1.1) * 0.05, slump: 0, whip: 0, breath: 0 }),
    hurt: { bow: -0.4, sing: 0.5, arms: 0.15, slump: 0.25, whip: 0, breath: 0 },
    broken: (t) => ({ bow: 0.55 + Math.sin(t * 2) * 0.05, sing: 0.0, arms: 0.0, slump: 1, whip: 0, breath: 0 }),
  };
  // breath mark (’) — the comma that tells a singer to breathe
  function breathMark(ctx, x, y, s, a) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, TAU); ctx.moveTo(2.6, 1.6); ctx.quadraticCurveTo(3, 7, -2.5, 10); ctx.quadraticCurveTo(0.8, 6, 0.4, 2.9);
    ctx.fillStyle = U.rgba(GOLD, a); ctx.fill(); ctx.strokeStyle = U.rgba('#0b0612', a * 0.9); ctx.lineWidth = 1 / s; ctx.stroke();
    ctx.restore();
  }
  // the choir's few moving parts, from its pose (local: facing +x, hem bottom at y = 0)
  function chRig(z) {
    const sl = z.slump, lean = z.bow;
    const head = { x: 7 + lean * 9, y: -142 + sl * 20 + Math.abs(lean) * 3 };
    const book = { x: 26 + z.arms * 3 - sl * 10, y: -104 + (1 - z.arms) * 14 + sl * 30 };
    return { head, book, mouth: { x: head.x + 7, y: head.y + 7.5 }, veil: { x: head.x - 11, y: head.y - 4 }, scroll: { x: book.x - 1, y: book.y + 7 }, shF: { x: 11 + lean * 4, y: -124 + sl * 18 } };
  }
  function curveThrough(ctx, p) { for (let i = 1; i < p.length - 1; i++) { const m = lp(p[i], p[i + 1], 0.5); ctx.quadraticCurveTo(p[i].x, p[i].y, m.x, m.y); } ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y); }
  function choirBody(ctx, e, z, ghost) {
    const t = e.t, R = chRig(z), sl = z.slump, sk = e._sink || 0, toL = (q) => ({ x: (q.x - e.x) * e.facing, y: q.y - e.y - sk });
    const fl = (y) => Math.sin(t * 2.1 + y * 0.05 + e.seed) * 1.7 * (0.25 + y / -140 * -1 + 1) * 0.5;
    // the veil's long tail falls behind everything
    if (e.veil.inited) { const vp = e.veil.p.map(toL); vp[0] = { x: R.veil.x, y: R.veil.y }; K.tattered(ctx, vp, 7, 13, INK1, '#2d2433', e.seed % 5); }
    // the robe: a long bell of paper, its hem soaking up ink
    const top = -124 + sl * 18;
    const back = [{ x: -12, y: top }, { x: -13 + fl(-100), y: -98 }, { x: -15 + fl(-72), y: -72 }, { x: -22 + fl(-42), y: -42 }, { x: -36 + fl(-6), y: -7 }];
    const front = [{ x: 37 + fl(-6), y: -7 }, { x: 25 + fl(-38), y: -38 }, { x: 18 + fl(-68), y: -68 }, { x: 16 + fl(-96), y: -96 }, { x: 13, y: top - 2 }];
    const robe = () => {
      ctx.beginPath(); ctx.moveTo(back[0].x, back[0].y); curveThrough(ctx, back);
      for (let i = 1; i < 10; i++) { const u = i / 10, x = U.lerp(back[4].x, front[0].x, u), dip = (i % 2 ? 11 : 1) + Math.sin(t * 2.4 + i * 1.7 + e.seed) * 2.5; ctx.lineTo(x, -6 + dip); }
      ctx.lineTo(front[0].x, front[0].y); curveThrough(ctx, front); ctx.closePath();
    };
    robe(); ctx.fillStyle = cel(ctx, 0, -60, 1, 0, 34, PAP1); ctx.fill();
    ctx.save(); robe(); ctx.clip();
    const hg = ctx.createLinearGradient(0, -50, 0, 8); hg.addColorStop(0, 'rgba(14,10,20,0)'); hg.addColorStop(0.55, 'rgba(14,10,20,0.55)'); hg.addColorStop(1, 'rgba(14,10,20,0.97)');
    ctx.fillStyle = hg; ctx.fillRect(-40, -52, 80, 64);
    // folds, and a gilt band above the soaked hem
    ctx.strokeStyle = 'rgba(11,6,18,0.45)'; ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.beginPath();
    for (const [x0, x1] of [[-6, -17], [3, 4], [10, 22]]) { ctx.moveTo(x0, top + 14); ctx.bezierCurveTo(x0 + 4 + fl(-90) * 2, -86, x1 - 5 + fl(-50) * 2, -48, x1 + fl(-14), -10); }
    ctx.stroke();
    ctx.strokeStyle = U.rgba(GOLD, 0.9); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-30, -50 + fl(-50)); ctx.quadraticCurveTo(0, -42, 30, -52 + fl(-50)); ctx.stroke();
    ctx.strokeStyle = U.rgba(GOLD, 0.45); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-30, -46 + fl(-46)); ctx.quadraticCurveTo(0, -38, 30, -48 + fl(-46)); ctx.stroke();
    ctx.restore();
    robe(); ink(ctx, 1.6);
    // drips off the hem
    ctx.fillStyle = '#0e0b12';
    for (let i = 0; i < 3; i++) { const ph = (t * 0.7 + i * 0.37 + e.seed * 0.013) % 1, x = -20 + i * 18; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(x, 6 + ph * ph * 30, 1.5, 2.3 + ph * 2, 0, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    // gilt stole over the shoulder, embroidered with rests
    const sEnd = { x: 13 + fl(-62), y: -62 };
    LB(ctx, { x: 8, y: top + 7 }, sEnd, 2.6, 3.2, GILT, { noHatch: true });
    ctx.strokeStyle = U.rgba(GOLD, 0.95); ctx.lineWidth = 0.8; ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(sEnd.x + i * 1.3, sEnd.y + 2); ctx.lineTo(sEnd.x + i * 1.5 + fl(-50), sEnd.y + 8); } ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath();
    for (const yy of [-104, -88, -72]) { const xx = 9.5 + (yy - top) * 0.04; ctx.moveTo(xx - 1, yy - 3); ctx.lineTo(xx + 1, yy - 1); ctx.lineTo(xx - 1, yy + 1); ctx.lineTo(xx + 1, yy + 3); }
    ctx.stroke();
    // the score unrolling from its book (or whipped out like a lash)
    let sc;
    if (Math.abs(z.whip) > 0.06) {
      const w = z.whip, n = 8; sc = [];
      for (let i = 0; i < n; i++) { const u = i / (n - 1); sc.push({ x: R.scroll.x + u * (w > 0 ? 76 * w : -26 * -w) + Math.sin(u * PI) * 10 * w, y: R.scroll.y + u * (w > 0 ? 6 : 52) - Math.sin(u * PI) * 24 * Math.abs(w) }); }
    } else if (e.scroll.inited) { sc = e.scroll.p.map(toL); sc[0] = { x: R.scroll.x, y: R.scroll.y }; }
    if (sc && sc.length > 1) {
      Rig.ribbon(ctx, sc, 3.6, 2.4, cel(ctx, sc[2].x, sc[2].y, 1, 0, 5, PAP2)); ink(ctx, 1.1);
      ctx.strokeStyle = 'rgba(11,6,18,0.45)'; ctx.lineWidth = 0.45; ctx.beginPath();
      for (const off of [-1.2, 1.2]) sc.forEach((q, i) => { if (i === 0) ctx.moveTo(q.x + off, q.y); else ctx.lineTo(q.x + off, q.y); });
      ctx.stroke();
      ctx.fillStyle = INK; for (const i of [2, 4]) { const q = sc[i]; if (q) { ctx.beginPath(); ctx.ellipse(q.x + 0.6, q.y, 1.2, 0.85, -0.4, 0, TAU); ctx.fill(); } }
      const tip = sc[sc.length - 1]; ctx.strokeStyle = U.rgba(GOLD, 0.9); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(tip.x - 2.2, tip.y - 1); ctx.lineTo(tip.x + 2.2, tip.y + 1); ctx.stroke();
    }
    // the sleeve: a bell of paper from shoulder to wrist, its drape hanging under the forearm
    const sh = R.shF, bk = R.book, el = { x: (sh.x + bk.x) / 2 - 3, y: (sh.y + bk.y) / 2 + 13 };
    ctx.beginPath(); ctx.moveTo(sh.x - 6, sh.y + 2);
    ctx.quadraticCurveTo(el.x - 9, el.y + 4, el.x - 3 + fl(-86) * 2, el.y + 26);
    ctx.lineTo(el.x + 5, el.y + 15); ctx.quadraticCurveTo(bk.x - 6, bk.y + 15, bk.x - 1, bk.y + 6);
    ctx.lineTo(bk.x - 5, bk.y - 2); ctx.quadraticCurveTo(el.x + 1, el.y - 7, sh.x + 5, sh.y - 1); ctx.closePath();
    ctx.fillStyle = cel(ctx, el.x, el.y, 0.6, -0.8, 14, PAP2); ctx.fill(); ink(ctx, 1.3);
    ctx.strokeStyle = U.rgba(GOLD, 0.8); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(el.x - 3 + fl(-86) * 2, el.y + 24); ctx.lineTo(el.x + 5, el.y + 14); ctx.stroke();
    // the open hymnal (its pages are blank but for the staves) and the hand under its spine
    ctx.save(); ctx.translate(bk.x, bk.y); ctx.rotate(-0.22 + z.arms * 0.18 - sl * 0.9);
    poly(ctx, [[-1, 2], [-12, -3], [-11, -15], [0, -10]]); ctx.fillStyle = cel(ctx, -6, -6, 0.6, -0.8, 8, PAP1); ctx.fill(); ink(ctx, 1.1);
    poly(ctx, [[1, 2], [12, -2], [13, -14], [0, -10]]); ctx.fillStyle = cel(ctx, 6, -6, 0.6, -0.8, 8, PAP1); ctx.fill(); ink(ctx, 1.1);
    ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.45; ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.moveTo(-10, -12 + i * 2.6); ctx.lineTo(-1.5, -8 + i * 2.6); ctx.moveTo(1.5, -8 + i * 2.6); ctx.lineTo(11.5, -11.5 + i * 2.6); }
    ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-11, -15); ctx.lineTo(0, -10); ctx.lineTo(13, -14); ctx.stroke();
    ctx.strokeStyle = '#3b2a1c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(0, 3); ctx.lineTo(12, -1); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 4.5, 3.2, 2.2, 0, 0, TAU); ctx.fillStyle = cel(ctx, 0, 4.5, 0.6, -0.8, 3, PAP1); ctx.fill(); ink(ctx, 0.9);
    ctx.restore();
    // head: a porcelain profile in the veil — eye sewn shut with gilt, a mouth open on nothing
    const hd = R.head;
    LB(ctx, { x: hd.x - 4, y: hd.y + 8 }, { x: sh.x - 3, y: sh.y + 2 }, 3.2, 4, PAP2, { noHatch: true });
    ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(z.bow * 0.55);
    const face = () => { ctx.beginPath(); ctx.moveTo(-3, -11); ctx.quadraticCurveTo(6, -13, 8.5, -5); ctx.lineTo(10.6, -1.5); ctx.lineTo(8.6, 0); ctx.quadraticCurveTo(10, 5, 8, 9); ctx.quadraticCurveTo(3, 13, -3, 10); ctx.closePath(); };
    face(); ctx.fillStyle = cel(ctx, 3, 0, 1, 0, 9, PAP1); ctx.fill(); ink(ctx, 1.3);
    ctx.strokeStyle = 'rgba(155,140,160,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(1, -4); ctx.quadraticCurveTo(-1, 3, 2.5, 8); ctx.stroke();
    // the stitched eye
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(2.4, -3.6); ctx.quadraticCurveTo(5, -2.2, 7.6, -3.4); ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.9; ctx.beginPath(); for (const sx of [3.3, 5, 6.7]) { ctx.moveTo(sx - 0.8, -5); ctx.lineTo(sx + 0.8, -1.8); } ctx.stroke();
    // the open mouth
    const mo = 1.2 + z.sing * 3.8;
    ctx.beginPath(); ctx.ellipse(7, 6.6 + z.sing * 0.8, 2 + z.sing * 0.8, mo, 0.15, 0, TAU); ctx.fillStyle = '#0b0710'; ctx.fill(); ink(ctx, 0.9);
    if (!ghost && z.sing > 0.3) glow(ctx, 7.5, 6.8, 9 + z.sing * 9, GOLD, 0.5 * z.sing);
    // the veil cap: black ink over the crown and the back of the head, gilt at its edge
    const veil = () => { ctx.beginPath(); ctx.moveTo(9.5, -9.5); ctx.quadraticCurveTo(7, -17, -2, -17); ctx.quadraticCurveTo(-13, -16, -14, -5); ctx.quadraticCurveTo(-15, 7, -9, 15); ctx.lineTo(-3.5, 11); ctx.quadraticCurveTo(-5, 1, -3, -7); ctx.quadraticCurveTo(3, -11, 9.5, -9.5); ctx.closePath(); };
    veil(); ctx.fillStyle = cel(ctx, -4, -6, 0.6, -0.8, 13, INK1); ctx.fill(); ink(ctx, 1.4);
    ctx.strokeStyle = U.rgba(GOLD, 0.9); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(9, -10); ctx.quadraticCurveTo(3, -11.5, -2.6, -7.4); ctx.quadraticCurveTo(-4.4, 1, -3.2, 10.5); ctx.stroke();
    ctx.restore();
    // the breath mark over its head: it inhales... and keeps the breath
    breathMark(ctx, hd.x + 2 + z.bow * 6, hd.y - 32 - z.breath * 7, 1 + z.breath * 0.35, 0.65 + 0.35 * z.breath);
    // notes leave the open mouth and crumble to dust before they can sound
    if (!ghost && sl < 0.5) {
      const m = R.mouth;
      for (let i = 0; i < 2; i++) {
        const ph = (t * 0.55 + i * 0.5 + e.seed * 0.017) % 1, x = m.x + 5 + ph * 22, y = m.y - 2 - ph * 30 + Math.sin(ph * 9 + i) * 2, a = Math.sin(ph * PI) * (0.55 + z.sing * 0.4);
        if (ph < 0.62) {
          ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3 + ph * 0.4); ctx.globalAlpha *= a;
          ctx.beginPath(); ctx.ellipse(0, 0, 2.7, 1.9, -0.45, 0, TAU); ctx.fillStyle = '#f6efe0'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
          ctx.fillStyle = '#f6efe0'; ctx.fillRect(1.6, -9, 1.1, 9); ctx.strokeRect(1.6, -9, 1.1, 9);
          ctx.restore();
        } else {
          ctx.fillStyle = U.rgba('#f6efe0', a);
          for (let k = 0; k < 5; k++) { const dd = (ph - 0.62) * 30; ctx.fillRect(x + Math.cos(k * 1.3 + i) * dd, y - 4 + Math.sin(k * 2.1) * dd * 0.6 + dd * 0.4, 1.3, 1.3); }
        }
      }
    }
  }
  // the silence it sings: a dotted gilt thread to her, and a muted rest over her head
  function drawSilence(ctx, e) {
    const P = G.game.player; if (!P || !Mute.un || e.state === 'broken' || e.state === 'die' || e.state === 'spawn') return;
    const m = chMouth(e), hx = P.x, hy = P.y - 100, now = G.game.time;
    lighter(ctx, () => {
      ctx.strokeStyle = U.rgba(GOLD, 0.3); ctx.lineWidth = 1.2; ctx.setLineDash([2, 7]); ctx.lineDashOffset = now * 22;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.quadraticCurveTo((m.x + hx) / 2, Math.min(m.y, hy) - 50, hx, hy); ctx.stroke();
    });
    let lead = null; for (const o of G.game.enemies) if (o.type === 'c7_choir' && !o.dead && (!lead || o.uid < lead.uid)) lead = o;
    if (lead !== e) return;          // one muted rest over her head, drawn by the eldest singer
    const y = P.y - 156 + Math.sin(now * 2.4) * 2.5, a = 0.55 + 0.25 * Math.sin(now * 4);
    ctx.save(); ctx.translate(hx, y); ctx.globalAlpha *= a;
    ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const z = [[-2, -9], [2, -5], [-3, -1], [3, 3], [-1, 6], [-3, 9]];
    poly(ctx, z, false); ctx.stroke(); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,200,0.9)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-8, 9); ctx.lineTo(8, -9); ctx.stroke();
    ctx.restore();
  }
  const CHO = reg('c7_choir', {
    name: '無聲詩班', en: 'VOICELESS CHOIR', w: 46, h: 176, hp: 78, bal: 38, col: '#fff3d9', shards: 46, kbMul: 0.9, spawnT: 1.0, fly: true, hover: true,
    portrait: [2.0, 0.86],
    init(e) { e.seed = seedOf(); e.uid = ++CH_UID; e.scroll = new Rig.Chain(7, 8.5, 0.05, 0.92); e.veil = new Rig.Chain(6, 12, 0.09, 0.88); },
    voice: () => G.SFX.play('c7_choirVoice'),
    weapon: (e) => e.wpt || chMouth(e),
    tick() { Mute.check(); },
    think(e, dt) {
      hoverInit(e, 40);
      Mute.ensure();
      e.faceP();
      const P = e.P, d = e.distP(), s = choirSlot(e);
      let tx = clampArena(e, s.x);
      if (d < 150) tx = e.x + (Math.sign(e.x - P.x) || 1) * 200;          // up close it is weak — it drifts away first
      e.vx = U.approach(e.vx, U.clamp((tx - e.x) * 1.2, -115, 115) * e.speedMul, 260 * dt);
      const fl = floorAt(e.x, e.y - 10, e.y0 + 40), ty = fl - s.hy + Math.sin(e.t * 1.6 + e.seed) * 6;
      e.vy = U.clamp((ty - e.y) * 2, -160, 160);
      if (e.cd > 0) return;
      if (d < 105 && Math.abs(P.y - e.y) < 170) e.startAtk(CHO.shove);
      else if (d < 780 && G.game.time >= CHOIR_NEXT) { CHOIR_NEXT = G.game.time + 1.15; e.startAtk(CHO.hymn); }   // they take turns
      else e.cd = 0.25;
    },
    hymn: {
      dur: 1.9, cd: 2.2, track: false, tells: [{ t: 0.3, c: 'white' }], ev: [{ t: 0.95, fn: hymnWave }],
      keys: [[0, 'idle'], [0.3, { bow: 0.14, sing: 0.1, arms: 0.4, breath: 1 }], [0.9, { bow: -0.24, sing: 1, arms: 0.95, breath: 1 }, 'io'], [1.15, { bow: -0.28, sing: 1, arms: 1, breath: 0.2 }], [1.9, 'idle', 'io']],
    },
    shove: {
      dur: 1.2, cd: 1.3, track: false, tells: [{ t: 0.12, c: 'white' }],
      keys: [[0, 'idle'], [0.5, { bow: 0.2, whip: -1, arms: 0.3 }, 'io'], [0.66, { bow: -0.12, whip: 1, arms: 0.75 }, 'snap'], [0.8, { bow: -0.1, whip: 0.9, arms: 0.7 }], [1.2, 'idle', 'io']],
      moves: [{ t0: 0.55, t1: 0.66, v: 140 }],
      hits: [{ t0: 0.62, t1: 0.74, box: { x: -4, y: -150, w: 102, h: 128 }, dmg: 16, kb: 260, last: true, pbal: 40 }],
      ev: [{ t: 0.6, fn: () => G.SFX.play('whoosh', 1.4) }],
    },
    atkUpdate(e, dt) { e.vx = U.approach(e.vx, 0, 400 * dt); e.vy = U.approach(e.vy, 0, 400 * dt); },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, a = e.state === 'atk' ? e.atk : null;
      let target;
      if (a && a.keys) target = sampK(a.keys.map((k) => [k[0], k[1] === 'idle' ? CHP.idle(e.t) : k[1], k[2]]), e.st, CHDEF);
      else if (e.state === 'hurt' || e.state === 'recoil') target = Object.assign({}, CHDEF, CHP.hurt);
      else if (e.state === 'broken' || e.state === 'executed') target = Object.assign({}, CHDEF, CHP.broken(e.t));
      else target = Object.assign({}, CHDEF, CHP.idle(e.t + e.seed));
      if (e.hitK > 0) target = lerpO(target, Object.assign({}, CHDEF, CHP.hurt), Math.min(1, e.hitK * 1.1));
      const z = blendTo(e, 'cz', target, dt, e.hitK > 0 ? 34 : a ? 22 : 10);
      const sink = K.emerge(ctx, e) * 60; e._sink = sink;
      const W = (q) => ({ x: e.x + e.facing * q.x, y: e.y + sink + q.y });
      if (dt > 0) {
        const R = chRig(z), bk = W(R.scroll), vh = W(R.veil);
        e.scroll.update(bk.x, bk.y, e.facing, dt, -e.vx * 6 + Math.sin(e.t * 1.9 + e.seed) * 420 + Math.sin(e.t * 3.7) * 160, 2.9);
        e.veil.update(vh.x, vh.y, e.facing, dt, -e.vx * 5 + Math.sin(e.t * 1.5 + e.seed) * 220, 2.72);
      }
      if (!ghost) { e.wpt = chMouth(e); drawSilence(ctx, e); }
      if (!ghost && !low()) glow(ctx, e.x, e.y + sink - 92, 92, '#fff3dc', 0.12 + z.sing * 0.12);
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing, 1);
      choirBody(ctx, e, z, ghost);
      const m = chMouthL(z);
      if (e.tellT > 0) glow(ctx, m.x, m.y, 30, e.tellCol === 'red' ? RED : '#ffffff', e.tellT * 1.4);
      if (e.state === 'broken') dizzy(ctx, chRig(z).head.x, chRig(z).head.y - 26, e.t, 13);
    },
  });

  /* =========================================================================================
     c7_fermata 延長記號 FERMATA — the "hold this note" sign, grown into a walking arch with the dot for an eye.
     hold     (a gilt dome falls over you: inside it, your feet move at half speed)
     pendulum (white — the eye swings on a thread of ink under and in front of the arch)
     topple   (red — the whole arch rears and falls forward like a gate; long reach. Then it has to get up again.)
     ========================================================================================= */
  const FEDEF = { rb: 0, rf: 0, H: 172, lb: 0, lf: 0, sb: 0, sf: 0, eyeA: 0, eyeL: 76, open: 1, glow: 0, sq: 0 };
  const FEP = {
    idle: (t) => ({ H: 172 + Math.sin(t * 1.2) * 2.5, eyeL: 76 + Math.sin(t * 1.7) * 3, eyeA: Math.sin(t * 0.8) * 0.05 }),
    hurt: { rb: -0.09, sq: 0.07, open: 0.45, eyeA: -0.2 },
    broken: (t) => ({ H: 138, sb: -14, sf: 14, eyeL: 112 + Math.sin(t * 2) * 3, eyeA: Math.sin(t * 1.3) * 0.25, open: 0.4, sq: 0.04 }),
  };
  const fermataApexU = (z) => ({ x: 0, y: -z.H * (1 - z.sq) + 14 });
  const fermataEyeL = (z) => addP(fermataApexU(z), dirv(z.eyeA, z.eyeL));
  // local → world for a point of the (possibly rearing / toppling) arch
  function feXform(e, z, q) {
    let x = q.x, y = q.y;
    const bx = -66 + z.sb, by = -z.lb; { const c = Math.cos(z.rb), s = Math.sin(z.rb), dx = x - bx, dy = y - by; x = bx + dx * c - dy * s; y = by + dx * s + dy * c; }
    const fx0 = 66 + z.sf, fy0 = -z.lf, c0 = Math.cos(z.rb), s0 = Math.sin(z.rb);
    const fx = bx + (fx0 - bx) * c0 - (fy0 - by) * s0, fy = by + (fx0 - bx) * s0 + (fy0 - by) * c0;
    { const c = Math.cos(z.rf), s = Math.sin(z.rf), dx = x - fx, dy = y - fy; x = fx + dx * c - dy * s; y = fy + dx * s + dy * c; }
    return { x: e.x + (e.feOx || 0) + e.facing * x, y: e.y + (e._sink || 0) + y };
  }
  function castBubble(e) {
    const P = G.game.player; if (!P) return;
    World.bubble(e, P.x, floorAt(P.x, P.y - 20, P.y), 178, 4.2);
    G.SFX.play('c7_bubble');
  }
  // the dome: a held breath of gilt light, a clock face of ticks turning far too slowly, a fermata over the top
  function drawBubble(ctx, h, g) {
    const b = h.b, now = g.time, form = U.clamp((now - b.t0) / b.form, 0, 1), end = b.end != null ? U.clamp((now - b.end) / 0.45, 0, 1) : 0;
    const R = b.r * (form < 1 ? U.easeOutBack(form) : 1) * (1 - end * 0.25), a = (1 - end) * (0.35 + 0.65 * form);
    if (R < 2 || a < 0.01) return;
    const P = g.player;
    ctx.save();
    ctx.beginPath(); ctx.rect(b.x - R - 30, b.y - R - 60, R * 2 + 60, R + 61); ctx.clip();
    lighter(ctx, () => {
      const gr = ctx.createRadialGradient(b.x, b.y, R * 0.2, b.x, b.y, R);
      gr.addColorStop(0, U.rgba(GOLD, 0.03 * a)); gr.addColorStop(0.82, U.rgba(GOLD, 0.09 * a)); gr.addColorStop(1, U.rgba(GOLDL, 0.2 * a));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, b.y, R, PI, TAU); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = U.rgba(GOLDL, 0.85 * a); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, R, PI, TAU); ctx.stroke();
      ctx.strokeStyle = U.rgba(GOLD, 0.35 * a); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, b.y, R - 7, PI, TAU); ctx.stroke();
      const rot = now * 0.35 + b.seed;
      ctx.strokeStyle = U.rgba(GOLD, 0.6 * a); ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < 36; i++) { const an = PI + ((i / 36) * PI + rot) % PI, big = i % 6 === 0, r0 = R - 12 - (big ? 8 : 3); ctx.moveTo(b.x + Math.cos(an) * r0, b.y + Math.sin(an) * r0); ctx.lineTo(b.x + Math.cos(an) * (R - 12), b.y + Math.sin(an) * (R - 12)); }
      ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = U.rgba(GOLDL, 0.7 * a);
      for (let i = 0; i < 10; i++) { const ph = hash(i, b.seed), an = PI + ph * PI, rr = R * (0.25 + 0.6 * hash(i + 3, b.seed)); ctx.beginPath(); ctx.arc(b.x + Math.cos(an + now * 0.04) * rr, b.y + Math.sin(an + now * 0.04) * rr * 0.9, 1.3, 0, TAU); ctx.fill(); }
      if (P && World.inBubble(P, b)) for (let j = 0; j < 2; j++) { const k = ((now * 0.6 + j * 0.5) % 1); ctx.strokeStyle = U.rgba(GOLDL, 0.5 * (1 - k) * a); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(P.x, P.y - 56, 20 + k * 34, 30 + k * 40, 0, 0, TAU); ctx.stroke(); }
    });
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= a;
    ctx.strokeStyle = U.rgba(GOLD, 0.8); ctx.lineWidth = 1.4; ctx.setLineDash([4, 6]); ctx.lineDashOffset = now * 8;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, R, R * 0.09, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const fy = b.y - R - 22 + Math.sin(now * 1.5) * 3;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(b.x, fy + 14, 20, PI * 1.08, PI * 1.92); ctx.strokeStyle = INK; ctx.lineWidth = 6.5; ctx.stroke(); ctx.strokeStyle = GOLD; ctx.lineWidth = 3.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x, fy + 9, 3.6, 0, TAU); ctx.fillStyle = GOLD; ctx.fill(); ink(ctx, 1.4);
    ctx.restore();
  }
  // the dot: a ball of ink with a gilt rim that opens like an eyelid — inside, a gilt iris that is a clock face
  function fermataEye(ctx, c, R, z, e, ghost) {
    const P = G.game.player;
    if (!ghost && z.glow > 0.05) glow(ctx, c.x, c.y, R * 2.6, GOLD, 0.55 * z.glow);
    ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.fillStyle = cel(ctx, c.x, c.y, 0.6, -0.8, R, INK1); ctx.fill(); ink(ctx, 2.1);
    const open = U.clamp(z.open, 0, 1.45), w = R * 0.86, h = R * 0.6 * Math.min(1, open) * (1 + Math.max(0, open - 1) * 0.55);
    if (h < 0.9) { ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(c.x - w, c.y + 1); ctx.quadraticCurveTo(c.x, c.y + 4, c.x + w, c.y + 1); ctx.stroke(); return; }
    const lens = () => { ctx.beginPath(); ctx.moveTo(c.x - w, c.y); ctx.quadraticCurveTo(c.x, c.y - h * 2, c.x + w, c.y); ctx.quadraticCurveTo(c.x, c.y + h * 2, c.x - w, c.y); ctx.closePath(); };
    ctx.save(); lens(); ctx.fillStyle = cel(ctx, c.x, c.y, 0.6, -0.8, w, PAP1); ctx.fill(); ctx.clip();
    let lx = 0, ly = 0;
    if (P && e.state !== 'broken') { const wc = feXform(e, z, c), dx = (P.x - wc.x) * e.facing, dy = P.y - 60 - wc.y, d = Math.hypot(dx, dy) || 1; lx = dx / d; ly = dy / d; }
    const ir = R * 0.47, ix = c.x + lx * R * 0.3, iy = c.y + ly * R * 0.16;
    ctx.beginPath(); ctx.arc(ix, iy, ir, 0, TAU); ctx.fillStyle = cel(ctx, ix, iy, 0.6, -0.8, ir, GILT); ctx.fill(); ink(ctx, 1.1);
    const rot = e.t * (0.5 + z.glow * 4);
    ctx.strokeStyle = 'rgba(70,44,14,0.85)'; ctx.lineWidth = 0.9; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const an = rot + i * TAU / 12, r0 = ir * (i % 3 === 0 ? 0.58 : 0.72); ctx.moveTo(ix + Math.cos(an) * r0, iy + Math.sin(an) * r0); ctx.lineTo(ix + Math.cos(an) * ir * 0.9, iy + Math.sin(an) * ir * 0.9); }
    ctx.stroke();
    if (e.state === 'broken') {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k < 18; k++) { const an = e.t * 6 + k * 0.6, rr = k * 0.36; if (!k) ctx.moveTo(ix, iy); ctx.lineTo(ix + Math.cos(an) * rr, iy + Math.sin(an) * rr); }
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(ix, iy, ir * (0.3 - z.glow * 0.08), ir * (0.46 - z.glow * 0.1), 0, 0, TAU); ctx.fillStyle = INK; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ix - ir * 0.32, iy - ir * 0.34, ir * 0.14, 0, TAU); ctx.fill();
    }
    // the lid's shadow on the eyeball
    ctx.fillStyle = 'rgba(40,24,52,0.35)'; ctx.beginPath(); ctx.ellipse(c.x, c.y - h * 1.15, w * 1.1, h * 0.75, 0, 0, TAU); ctx.fill();
    ctx.restore();
    lens(); ink(ctx, 1.7);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(c.x - w * 0.92, c.y - 1.5); ctx.quadraticCurveTo(c.x, c.y - h * 2 - 1.5, c.x + w * 0.92, c.y - 1.5); ctx.stroke();
  }
  // one calligraphic stroke: ink body, a gilt rim on the lit outer edge, a cool shadow inside the curve, gilt bounce
  function archStroke(ctx, pts, ws) {
    const n = pts.length, Lp = [], Rp = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const nx = dy / d, ny = -dx / d;                    // outward (the arch's outside) for a back-foot → front-foot centreline
      Lp.push({ x: pts[i].x + nx * ws[i], y: pts[i].y + ny * ws[i] }); Rp.push({ x: pts[i].x - nx * ws[i], y: pts[i].y - ny * ws[i] });
    }
    const path = () => {
      ctx.beginPath(); ctx.moveTo(Lp[0].x, Lp[0].y);
      for (let i = 1; i < n - 1; i++) { const m = lp(Lp[i], Lp[i + 1], 0.5); ctx.quadraticCurveTo(Lp[i].x, Lp[i].y, i === n - 2 ? Lp[n - 1].x : m.x, i === n - 2 ? Lp[n - 1].y : m.y); }
      ctx.lineTo(Rp[n - 1].x, Rp[n - 1].y);
      for (let i = n - 2; i > 0; i--) { const m = lp(Rp[i], Rp[i - 1], 0.5); ctx.quadraticCurveTo(Rp[i].x, Rp[i].y, i === 1 ? Rp[0].x : m.x, i === 1 ? Rp[0].y : m.y); }
      ctx.closePath();
    };
    const line = (P, a0, a1) => { ctx.beginPath(); for (let i = a0; i <= a1; i++) i === a0 ? ctx.moveTo(P[i].x, P[i].y) : ctx.lineTo(P[i].x, P[i].y); };
    const Ld = Rig.lightDir(ctx), lit = Ld.x >= 0 ? 1 : -1;
    path(); ctx.fillStyle = '#17131c'; ctx.fill();
    ctx.save(); path(); ctx.clip();
    // the cool, deep shadow inside the curve
    line(Rp, 0, n - 1); ctx.strokeStyle = '#07050a'; ctx.lineWidth = 11; ctx.stroke();
    // gilt rim on the lit side of the outer edge (fading over the crown), gilt bounce inside on the far side
    const gr = ctx.createLinearGradient(-70 * lit, 0, 70 * lit, 0);
    gr.addColorStop(0, 'rgba(242,199,102,0.12)'); gr.addColorStop(0.45, 'rgba(242,199,102,0.75)'); gr.addColorStop(1, 'rgba(255,233,170,1)');
    line(Lp, 0, n - 1); ctx.strokeStyle = gr; ctx.lineWidth = 6; ctx.stroke();
    const gb = ctx.createLinearGradient(70 * lit, 0, -70 * lit, 0);
    gb.addColorStop(0, 'rgba(201,150,70,0)'); gb.addColorStop(1, 'rgba(201,150,70,0.5)');
    line(Rp, 0, n - 1); ctx.strokeStyle = gb; ctx.lineWidth = 2.6; ctx.stroke();
    // the engraver's hairline along the stroke
    ctx.strokeStyle = 'rgba(255,248,232,0.5)'; ctx.lineWidth = 1.1; ctx.beginPath();
    for (let i = 2; i <= n - 3; i++) { const q = lp(pts[i], Lp[i], 0.42); i === 2 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); }
    ctx.stroke();
    ctx.restore();
    path(); ink(ctx, 2.2);
    return { Lp, Rp };
  }
  function fermataBody(ctx, e, z, ghost) {
    const n = 15, pts = [], ws = [], H = z.H * (1 - z.sq), HW = 70 * (1 + z.sq * 0.6);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), th = PI * (1 - u), wb = Math.pow(1 - u, 2.2), wf = Math.pow(u, 2.2);
      pts.push({ x: Math.cos(th) * HW + wb * z.sb + wf * z.sf, y: -Math.pow(Math.sin(th), 0.68) * H - wb * z.lb - wf * z.lf });
      ws.push(8.5 + 13 * Math.pow(Math.sin(PI * u), 1.2));
    }
    ctx.save();
    const bx = -66 + z.sb, by = -z.lb;
    ctx.translate(bx, by); ctx.rotate(z.rb); ctx.translate(-bx, -by);
    const fx = 66 + z.sf, fy = -z.lf;
    ctx.translate(fx, fy); ctx.rotate(z.rf); ctx.translate(-fx, -fy);
    const { Lp, Rp } = archStroke(ctx, pts, ws);
    // gilt ferrules binding the stroke
    for (const i of [3, 7, 11]) {
      const a = pts[i - 1], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ux = dx / d * 3.4, uy = dy / d * 3.4;
      const o = { x: Lp[i].x + (Lp[i].x - pts[i].x) * 0.18, y: Lp[i].y + (Lp[i].y - pts[i].y) * 0.18 }, r = { x: Rp[i].x + (Rp[i].x - pts[i].x) * 0.18, y: Rp[i].y + (Rp[i].y - pts[i].y) * 0.18 };
      polyP(ctx, [{ x: o.x - ux, y: o.y - uy }, { x: o.x + ux, y: o.y + uy }, { x: r.x + ux, y: r.y + uy }, { x: r.x - ux, y: r.y - uy }]);
      ctx.fillStyle = cel(ctx, pts[i].x, pts[i].y, dx / d, dy / d, 4, GILT); ctx.fill(); ink(ctx, 1.2);
    }
    // feet: column bases where the pen touched the paper
    for (const i of [0, n - 1]) {
      const q = pts[i], w = ws[i] + 3;
      poly(ctx, [[q.x - w - 9, q.y + 1], [q.x + w + 9, q.y + 1], [q.x + w + 4, q.y - 7], [q.x + w, q.y - 11], [q.x - w, q.y - 11], [q.x - w - 4, q.y - 7]]);
      ctx.fillStyle = cel(ctx, q.x, q.y - 5, 0.3, -1, 8, INK1); ctx.fill(); ink(ctx, 1.6);
      ctx.strokeStyle = U.rgba(GOLD, 0.85); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(q.x - w - 3, q.y - 8); ctx.lineTo(q.x + w + 3, q.y - 8); ctx.stroke();
    }
    // ink runs off the crown
    ctx.fillStyle = '#0e0b12';
    for (let i = 0; i < 2; i++) { const ph = (e.t * 0.55 + i * 0.5 + e.seed * 0.01) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(-8 + i * 15, -H + 16 + ph * ph * 60, 1.8, 2.6 + ph * 3, 0, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    // the dot hangs under the crown (on a thread of ink when it swings)
    const au = fermataApexU(z), c = fermataEyeL(z);
    if (Math.abs(z.eyeL - 76) > 6 || Math.abs(z.eyeA) > 0.15) {
      ctx.beginPath(); ctx.moveTo(au.x, au.y); ctx.lineTo(c.x, c.y); ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.stroke(); ctx.strokeStyle = 'rgba(255,240,210,0.7)'; ctx.lineWidth = 1; ctx.stroke();
    }
    fermataEye(ctx, c, 26, z, e, ghost);
    if (e.tellT > 0) glow(ctx, c.x, c.y, 44, e.tellCol === 'red' ? RED : '#ffffff', e.tellT * 1.5);
    ctx.restore();
  }
  function feImpact(e) {
    const z = e.fz || FEDEF, tip = feXform(e, Object.assign({}, z, { rf: 1.86, rb: 0 }), { x: 0, y: -z.H });
    const fl = floorAt(tip.x, tip.y - 40, e.y);
    G.game.shake(0.75); G.SFX.play('c7_topple'); G.SFX.play('quake');
    G.FX.ring(tip.x, fl, 10, 210, 0.55, GOLD, 6, { flat: 0.16 }); G.FX.ring(tip.x, fl, 6, 120, 0.4, RED, 4, { flat: 0.2 });
    G.FX.dust(tip.x, fl, 22, { w: 140, speed: 300, size: 15, col: 'rgba(14,10,20,' }); G.FX.shards(tip.x, fl - 4, 14, PAPER, 520);
  }
  // after the topple the arch lies forward: move its body (hurt box) out to where it fell, and walk it back as it rises
  function feShift(e, want) {
    const ar = G.game.arena, L = G.LEVEL;
    let nx = e.feBaseX + e.facing * want;
    if (ar && e.enc === ar.id) nx = U.clamp(nx, ar.x0 + 30, ar.x1 - 30);
    nx = U.clamp(nx, L.bounds[0] + 30, L.bounds[1] - 30);
    const box = { x: nx - e.w / 2, y: e.y - e.h, w: e.w, h: e.h - 4 };
    for (const s of G.Phys.allSolids()) if (U.rectsOverlap(box, s)) return;
    e.x = nx; e.feOx = e.feBaseX - e.x;
  }
  const FE = reg('c7_fermata', {
    name: '延長記號', en: 'FERMATA', w: 120, h: 196, hp: 200, bal: 120, col: GOLD, shards: 80, kbMul: 0.3, poise: true, spawnT: 1.2,
    portrait: [1.5, 0.9],
    init(e) { e.seed = seedOf(); e.gaitP = 0; e.blinkT = 2 + Math.random() * 2; e.holdCd = 0.6; e.feOx = 0; },
    voice: () => G.SFX.play('c7_fermataVoice'),
    weapon: (e) => e.wpt || { x: e.x, y: e.y - 90 },
    think(e, dt) {
      e.faceP(); e.holdCd -= dt;
      const P = e.P, d = e.distP(), dy = Math.abs(P.y - e.y);
      e.vx = U.approach(e.vx, (d > 170 ? e.facing * 62 : d < 90 ? -e.facing * 40 : 0) * e.speedMul, 300 * dt);
      if (e.cd > 0) return;
      const mine = World.bubbles.some((b) => b.owner === e && b.end == null);
      const ahead = floorAt(e.x + e.facing * 200, e.y - 40, 1e9);
      const canTopple = Math.abs(ahead - e.y) < 24 && dy < 160;
      if (!mine && e.holdCd <= 0 && d < 640 && (d > 260 || Math.random() < 0.4)) { e.holdCd = 7; e.startAtk(FE.hold); }
      else if (d < 165 && dy < 160 && (Math.random() < 0.55 || !canTopple)) e.startAtk(FE.pendulum);
      else if (d < 290 && canTopple) e.startAtk(FE.topple);
      else e.cd = 0.3;
    },
    hold: {
      dur: 1.7, cd: 0.6, track: false, ev: [{ t: 0.55, fn: castBubble }],
      keys: [[0, 'idle'], [0.4, { H: 180, open: 1.4, glow: 1, eyeL: 70 }, 'io'], [0.8, { H: 178, open: 1.4, glow: 1, eyeL: 70 }], [1.7, 'idle', 'io']],
    },
    pendulum: {
      dur: 2.0, cd: 1.3, track: false, tells: [{ t: 0.3, c: 'white' }],
      keys: [[0, 'idle'], [0.3, { rb: -0.04, eyeL: 82, eyeA: -0.2, open: 1.15 }], [0.85, { rb: -0.1, eyeL: 100, eyeA: -0.7, open: 1.2 }, 'io'], [1.0, { rb: 0.06, eyeL: 133, eyeA: 0.0 }, 'in'],
        [1.12, { rb: 0.1, eyeL: 148, eyeA: 1.05 }, 'out'], [1.45, { rb: 0.02, eyeL: 100, eyeA: 0.3 }, 'io'], [2.0, 'idle', 'io']],
      hits: [{ t0: 0.9, t1: 1.12, box: { x: -40, y: -132, w: 192, h: 118 }, dmg: 22, kb: 300, last: true, pbal: 60 }],
      ev: [{ t: 0.86, fn: () => G.SFX.play('c7_swing') }],
    },
    topple: {
      dur: 2.75, cd: 1.6, track: false, tells: [{ t: 0.3, c: 'red' }],
      keys: [[0, 'idle'], [0.3, { rb: 0.05, H: 170 }], [0.95, { rb: -0.4, H: 182, glow: 0.6, open: 1.3 }, 'io'], [1.1, { rb: 0, rf: 1.86, H: 172, sq: 0.08, open: 0.8 }, 'in'],
        [1.24, { rf: 1.86, sq: 0, open: 0.7 }], [1.8, { rf: 1.84, open: 0.55 }], [2.65, 'idle', 'io']],
      hits: [{ t0: 1.06, t1: 1.24, box: { x: 30, y: -160, w: 240, h: 160 }, dmg: 34, red: true, kb: 480, last: true }],
      onStart: (e) => { e.feBaseX = e.x; e.feOx = 0; },
      ev: [{ t: 0.32, fn: () => G.SFX.play('c7_creak') }, { t: 1.08, fn: feImpact }, { t: 1.26, fn: (e) => feShift(e, 150) }],
    },
    atkUpdate(e, dt) {
      const a = e.atk;
      e.vx = U.approach(e.vx, 0, 900 * dt);
      if (a === FE.topple && e.feBaseX != null && e.st > 1.26) {
        // rising: the body walks back under the arch as it stands up again
        const k = U.clamp((e.st - 1.8) / 0.85, 0, 1);
        if (e.st > 1.8) feShift(e, 150 * (1 - U.easeInOutSine(k)));
        e.vy = Math.min(e.vy, 0);
      }
    },
    tick(e) {
      // a topple that was cut short (stagger, break, death) puts its body back under the arch
      if (e.feOx && !(e.state === 'atk' && e.atk === FE.topple)) { if (e.feBaseX != null) { e.x = e.feBaseX; } e.feOx = 0; e.feBaseX = null; }
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, a = e.state === 'atk' ? e.atk : null;
      if (dt > 0) { e.blinkT -= dt; if (e.blinkT < -0.14) e.blinkT = 2.2 + Math.random() * 2.6; }
      let target;
      if (a && a.keys) target = sampK(a.keys.map((k) => [k[0], k[1] === 'idle' ? FEP.idle(e.t) : k[1], k[2]]), e.st, FEDEF);
      else if (e.state === 'hurt' || e.state === 'recoil') target = Object.assign({}, FEDEF, FEP.hurt);
      else if (e.state === 'broken' || e.state === 'executed') target = Object.assign({}, FEDEF, FEP.broken(e.t));
      else {
        target = Object.assign({}, FEDEF, FEP.idle(e.t + e.seed));
        if (Math.abs(e.vx) > 8 && e.onGround) {
          const prev = Math.sin(e.gaitP);
          if (dt > 0) e.gaitP += Math.abs(e.vx) * dt * 0.06;
          const s = Math.sin(e.gaitP), dir = Math.sign(e.vx) * e.facing;
          if (dt > 0 && Math.sign(prev) !== Math.sign(s) && Math.abs(e.x - e.P.x) < 900) { G.SFX.play('c7_step'); G.FX.dust(e.x + e.facing * (s > 0 ? 66 : -66), e.y, 3, { w: 20, speed: 60, size: 8, col: 'rgba(14,10,20,' }); }
          Object.assign(target, { lb: Math.max(0, s) * 11, lf: Math.max(0, -s) * 11, sb: Math.cos(e.gaitP) * 8 * dir, sf: -Math.cos(e.gaitP) * 8 * dir, rb: s * 0.035 });
        }
      }
      if (e.blinkT < 0 && !(a && a.keys)) target.open = 0;
      if (e.hitK > 0) target = lerpO(target, Object.assign({}, target, FEP.hurt), Math.min(1, e.hitK * 1.1));
      const z = blendTo(e, 'fz', target, dt, e.hitK > 0 ? 30 : a ? 26 : 9);
      if (a === FE.topple && e.st > 0.95 && e.st < 1.3) Object.assign(z, target);       // the fall is not smoothed: it drops
      const sink = K.emerge(ctx, e) * 200; e._sink = sink;
      if (!ghost) e.wpt = feXform(e, z, fermataEyeL(z));
      const ox = e.feOx || 0;
      if (!ghost) {
        const fl = floorAt(e.x + ox, e.y - 6, e.y);
        ctx.fillStyle = 'rgba(10,7,14,0.5)'; ctx.beginPath(); ctx.ellipse(e.x + ox, fl - 0.5, 92, 5, 0, 0, TAU); ctx.fill();
        if (!low()) glow(ctx, e.x + ox, e.y + sink - 100, 140, '#fff0d6', 0.12);
      }
      ctx.translate(e.x + ox, e.y + sink); ctx.scale(e.facing, 1);
      fermataBody(ctx, e, z, ghost);
      if (e.state === 'broken') dizzy(ctx, 0, -z.H - 14, e.t, 18);
    },
  });

  /* =========================================================================================
     c7_elite 葛雷夫的回憶 GRAVES, REMEMBERED — the Unstrung Knight as the Rest remembers him: at peace, armour white
     and gilt, his sword whole again. He is not here to stop you. He wants to see if you can finish the song.
     salute       (no blow: he greets you — a free opening)
     三步圓舞 waltz  (white × 3 on a ONE-two-three; the third is a turning sweep)   P2: a fourth step, a red thrust
     靜候 stance    (no blow: sword raised before his face. Strike it from the front and he reads you — and answers
                   at once with a red riposte. Wait, and he lowers the blade with a bow: that is your opening.)
     斷弦突刺 thrust (red — a long lunge from mid range)
     P2 劍氣 crescent (white — a gilt sword-wave along the floor; a perfect guard sends it back)
     ========================================================================================= */
  const gnd = (p) => Rig.full(Rig.groundify(p));
  const GRP = {
    idle: (t) => ({ ry: 3 + Math.sin(t * 1.6) * 1.2, torso: 0.07 + Math.sin(t * 1.6) * 0.012, head: 0.03, tF: 0.34, kF: -0.42, tB: -0.3, kB: -0.24, aF: 0.62, eF: 0.8, aB: -0.25, eB: 0.55, sw: 1.12 + Math.sin(t * 1.6) * 0.02 }),
    salute: { ry: 1, torso: -0.04, head: -0.08, tF: 0.16, kF: -0.12, tB: -0.14, kB: -0.1, aF: 0.95, eF: 2.1, aB: -0.2, eB: 0.3, sw: PI },
    bow: { ry: 9, torso: 0.62, head: 0.35, tF: 0.42, kF: -0.6, tB: -0.55, kB: -0.4, aF: 0.35, eF: 0.25, aB: 1.2, eB: 1.9, sw: 0.45 },
    w1a: { tF: 0.5, kF: -0.6, tB: -0.45, kB: -0.25, ry: 6, torso: -0.06, head: -0.05, aF: 2.65, eF: 0.45, aB: -0.55, eB: 0.4, sw: 3.7 },
    w1b: { tF: 0.88, kF: -0.95, tB: -0.6, kB: -0.2, ry: 12, torso: 0.5, head: 0.05, aF: 1.3, eF: 0.05, aB: -0.95, eB: 0.3, sw: 1.12 },
    w2a: { tF: 0.75, kF: -0.9, tB: -0.55, kB: -0.25, ry: 11, torso: 0.48, head: 0.0, aF: 0.25, eF: 0.35, aB: -0.6, eB: 0.5, sw: -0.85 },
    w2b: { tF: 0.42, kF: -0.4, tB: -0.45, kB: -0.15, ry: -1, torso: -0.12, head: -0.12, aF: 2.75, eF: 0.12, aB: -1.0, eB: 0.3, sw: 2.95 },
    w3a: { tF: 0.55, kF: -0.7, tB: -0.4, kB: -0.3, ry: 8, torso: 0.2, head: 0.1, aF: -0.6, eF: 0.5, aB: 0.6, eB: 0.5, sw: -1.4 },
    w3b: { tF: 0.95, kF: -1.05, tB: -0.65, kB: -0.25, ry: 14, torso: 0.45, head: -0.05, aF: 1.6, eF: 0.0, aB: -1.25, eB: 0.3, sw: 1.62 },
    stance: { ry: 9, torso: -0.05, head: 0.02, tF: 0.5, kF: -0.66, tB: -0.5, kB: -0.25, aF: 1.25, eF: 1.55, aB: 1.0, eB: 1.25, sw: 2.98, hold: 1 },
    thrA: { tF: 0.7, kF: -1.15, tB: -0.8, kB: -0.4, ry: 18, torso: 0.22, head: -0.08, aF: -1.15, eF: 1.95, aB: 1.2, eB: 0.5, sw: 1.57 },
    thrB: { tF: 1.12, kF: -0.6, tB: -1.05, kB: -0.15, ry: 17, torso: 0.78, head: -0.22, aF: 1.57, eF: 0.0, aB: -1.35, eB: 0.2, sw: 1.57 },
    crA: { tF: 0.55, kF: -0.7, tB: -0.5, kB: -0.3, ry: 9, torso: 0.0, head: -0.05, aF: 2.9, eF: 0.3, aB: -0.4, eB: 0.4, sw: 4.1 },
    rise: { ry: 4, torso: -0.12, head: -0.35, tF: 0.3, kF: -0.3, tB: -0.3, kB: -0.2, aF: 2.95, eF: 0.1, aB: 2.7, eB: 0.2, sw: 3.14 },
    hurt: { ry: 8, torso: -0.42, head: 0.6, tF: 0.18, kF: -0.6, tB: -0.6, kB: -0.4, aF: -0.3, eF: 1.1, aB: -1.0, eB: 0.8, sw: 0.25 },
    kneel: { ry: 26, torso: 0.45, head: 0.5, tF: 1.3, kF: -1.3, tB: 0.0, kB: -1.57, aF: 0.95, eF: 0.25, aB: 0.55, eB: 0.9, sw: 0.02 },
  };
  const GI = (t = 0) => gnd(GRP.idle(t));
  for (const k of ['salute', 'bow', 'w1a', 'w1b', 'w2a', 'w2b', 'w3a', 'w3b', 'stance', 'thrA', 'thrB', 'crA', 'rise', 'hurt']) GRP[k] = gnd(GRP[k]);
  GRP.kneel = Rig.full(GRP.kneel);
  const gravesHit = (t0, t1, box, dmg, o = {}) => Object.assign({ t0, t1, box, dmg, kb: 280 }, o);
  const CUT = { x: -10, y: -205, w: 175, h: 195 }, SWEEP = { x: -60, y: -178, w: 236, h: 168 }, POINT = { x: 0, y: -158, w: 190, h: 58 };
  function waltzDef(four) {
    const keys = [[0, GI()], [0.46, GRP.w1a, 'io'], [0.62, GRP.w1b, 'snap'], [0.9, GRP.w2a, 'io'], [1.14, GRP.w2b, 'snap'], [1.36, GRP.w3a, 'io'], [1.66, GRP.w3b, 'snap'], [2.0, GRP.w3b]];
    const tells = [{ t: 0.08, c: 'white' }, { t: 0.6, c: 'white' }, { t: 1.1, c: 'white' }];
    const hits = [gravesHit(0.58, 0.68, CUT, 22), gravesHit(1.1, 1.2, CUT, 22), gravesHit(1.62, 1.76, SWEEP, 26, four ? {} : { last: true, pbal: 70 })];
    const moves = [{ t0: 0.42, t1: 0.6, v: 250 }, { t0: 0.92, t1: 1.1, v: 230 }, { t0: 1.4, t1: 1.62, v: 300 }];
    const ev = [0.58, 1.1, 1.62].map((t, i) => ({ t, fn: () => { G.SFX.play('slash', [0.62, 0.7, 0.55][i], i === 2); G.SFX.play('c7_waltz', i); } }));
    if (four) {
      keys.push([2.18, GRP.thrA, 'io'], [2.4, GRP.thrB, 'snap'], [2.72, GRP.thrB], [3.2, GRP.bow, 'io'], [3.3, GI(), 'io']);
      tells.push({ t: 1.74, c: 'red' });
      hits.push(gravesHit(2.36, 2.52, POINT, 30, { red: true, kb: 420, last: true }));
      moves.push({ t0: 2.32, t1: 2.5, v: 760 });
      ev.push({ t: 2.36, fn: () => { G.SFX.play('slash', 0.5, true); G.SFX.play('c7_waltz', 3); } });
    } else keys.push([2.5, GRP.bow, 'io'], [2.72, GI(), 'io']);
    return { dur: four ? 3.3 : 2.72, cd: 2.2, anim: { keys }, tells, hits, moves, ev, twirl: [1.28, 1.44] };
  }
  function stanceDef(len) {
    const end = 0.25 + len;
    return {
      dur: end + 0.62, cd: 0.9, track: false, guardFrom: 0.18, guardTo: end, stance: true,
      anim: { keys: [[0, GI()], [0.25, GRP.stance, 'io'], [end, GRP.stance], [end + 0.3, GRP.bow, 'io'], [end + 0.62, GI(), 'io']] },
      ev: [{ t: 0.2, fn: (e) => { G.SFX.play('c7_ring'); G.FX.ring(e.x, e.y - 1, 10, 90, 0.5, GOLD, 3, { flat: 0.18 }); } }],
    };
  }
  function gravesWave(e) {
    const x = e.x + e.facing * 74, y = e.y - 66;
    G.game.hazards.push({ t: 0, life: 1.9, x, y, vx: e.facing * 430, owner: e, dir: e.facing, update: gwUpdate, draw: gwDraw });
    G.SFX.play('c7_crescentWave'); G.FX.flash(x, y, 70, 0.2, GOLD);
  }
  function gwUpdate(h, dt, g) {
    h.x += h.vx * dt;
    if (solidAt(h.x, h.y)) { h.done = true; G.FX.spark(h.x, h.y, 10, { col: GOLDL, speed: 380 }); return; }
    const P = g.player; if (!P || h.passed) return;
    const hb = P.hurtbox;
    if (h.x + 16 > hb.x && h.x - 16 < hb.x + hb.w && h.y + 62 > hb.y && h.y - 62 < hb.y + hb.h) {
      const res = P.receiveHit(h.owner, { dmg: 20, kb: 260, hx: h.x, hy: P.y - 60, waveFrom: h.x });
      if (res === 'parried' && h.owner && !h.owner.dead) {
        g.projectiles.push({ x: h.x, y: h.y, vx: -h.vx * 1.4, vy: -40, r: 12, owner: h.owner, friendly: true, dmg: 0, life: 2.5, t: 0, col: GOLDL });
        h.done = true;
      } else if (res === 'dodged' || res === 'ignored') h.passed = true;
      else { h.done = true; G.FX.spark(h.x, h.y, 12, { col: GOLDL, speed: 420 }); }
    }
  }
  function gwDraw(ctx, h) {
    const a = Math.min(1, h.t * 8) * (h.t > h.life - 0.3 ? Math.max(0, (h.life - h.t) / 0.3) : 1), d = h.dir;
    ctx.translate(h.x, h.y); ctx.scale(d, 1); ctx.globalAlpha *= a;
    lighter(ctx, () => {
      ctx.fillStyle = U.rgba(GOLD, 0.22); ctx.beginPath(); ctx.ellipse(-30, 0, 46, 60, 0, -PI / 2, PI / 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -62); ctx.quadraticCurveTo(30, 0, 0, 62); ctx.quadraticCurveTo(12, 0, 0, -62); ctx.fillStyle = U.rgba(GOLDL, 0.95); ctx.fill();
      ctx.strokeStyle = U.rgba('#ffffff', 0.9); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(2, -50); ctx.quadraticCurveTo(22, 0, 2, 50); ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(0, -62); ctx.quadraticCurveTo(30, 0, 0, 62); ctx.strokeStyle = 'rgba(11,6,18,0.7)'; ctx.lineWidth = 1.4; ctx.stroke();
  }
  function gravesPose(e, dt) {
    const st = e.state, a = st === 'atk' ? e.atk : null;
    let p;
    if (a && a.anim) p = Rig.sample(a.anim, e.st);
    else if (st === 'hurt' || st === 'recoil') p = GRP.hurt;
    else if (st === 'broken' || st === 'executed') p = Rig.full(Object.assign({}, GRP.kneel, { torso: 0.45 + Math.sin(e.t * 2.2) * 0.04, head: 0.55 + Math.sin(e.t * 1.4) * 0.06 }));
    else if (st === 'spawn') p = GRP.kneel;
    else if (Math.abs(e.vx) > 30 && e.onGround) {
      if (dt > 0) e.gaitP += e.vx * e.facing * dt * PI / 30;
      const w = AN.walk(e.gaitP);
      p = Rig.full(Object.assign({}, GRP.idle(e.t), { ik: 1, fFx: w.fFx * 1.15 + 4, fFy: w.fFy * 1.2, fBx: w.fBx * 1.15 - 4, fBy: w.fBy * 1.2, ry: w.ry + 2 }));
    } else p = GI(e.t);
    if (e.hitK > 0 && st !== 'die') p = Rig.lerpPose(p, Rig.full(Object.assign({}, p, { torso: p.torso - 0.3, head: p.head + 0.4, ry: p.ry + 3 })), Math.min(1, e.hitK * 1.2));
    if (!e.pose) e.pose = p;
    else if (dt > 0) e.pose = Rig.lerpPose(e.pose, p, 1 - Math.exp(-(e.hitK > 0 ? 40 : a ? 28 : 12) * dt));
    return e.pose;
  }
  // a knee or elbow cop: a cel disc with a gilt boss and a little fan wing
  function cop(ctx, p, r, hex, ang) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
    poly(ctx, [[0, -r * 0.4], [r * 1.9, -r * 1.2], [r * 1.6, r * 0.5], [0, r * 0.5]]); ctx.fillStyle = cel(ctx, r, 0, 0.6, -0.8, r * 1.4, hex); ctx.fill(); ink(ctx, 1);
    ctx.restore();
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fillStyle = cel(ctx, p.x, p.y, 0.6, -0.8, r, hex); ctx.fill(); ink(ctx, 1.1);
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.45, 0, TAU); ctx.fillStyle = cel(ctx, p.x, p.y, 0.6, -0.8, r * 0.45, GILT); ctx.fill(); ink(ctx, 0.7);
  }
  // a plate along a limb with a gilt cuff at its lower end
  function plate(ctx, a, b, w1, w2, hex, cuff = true) {
    LB(ctx, a, b, w1, w2, hex, { spec: 0.4, noHatch: true });
    if (!cuff) return;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, c = lp(a, b, 0.84), w = U.lerp(w1, w2, 0.84) * 0.92;
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.x + nx * w, c.y + ny * w); ctx.lineTo(c.x - nx * w, c.y - ny * w); ctx.stroke();
  }
  function sabaton(ctx, an, to, hex) {
    const dx = to.x - an.x, dy = to.y - an.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    const P = (a, b) => ({ x: an.x + ux * a + nx * b, y: an.y + uy * a + ny * b });
    polyP(ctx, [P(-4, -4.6), P(4, -5), P(d + 5, -1.2), P(d + 6.5, 1.6), P(d - 2, 3.4), P(-3, 3.6)]);
    ctx.fillStyle = cel(ctx, an.x + ux * d * 0.5, an.y + uy * d * 0.5, nx, ny, 5, hex); ctx.fill(); ink(ctx, 1.1);
    ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.7; ctx.beginPath();
    for (const k of [0.35, 0.6, 0.82]) { const a = P(d * k, -4.4 + k * 3), b = P(d * k - 1, 3.2); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    ctx.stroke();
  }
  function armouredLeg(ctx, hip, kn, an, to, hex, near) {
    LC(ctx, [hip, lp(hip, kn, 0.5), kn, lp(kn, an, 0.5), an], [6.4, 5.8, 4.5, 4.1, 3.1], '#3b3546');          // the mail beneath
    plate(ctx, lp(hip, kn, 0.1), lp(hip, kn, 0.88), near ? 8 : 7.2, near ? 6.2 : 5.6, hex);                       // cuisse
    plate(ctx, lp(kn, an, 0.14), lp(kn, an, 0.95), near ? 5.9 : 5.3, near ? 4.4 : 4, hex);                        // greave
    sabaton(ctx, an, to, hex);
    const dx = an.x - kn.x, dy = an.y - kn.y;
    cop(ctx, kn, near ? 4.6 : 4, hex, Math.atan2(dy, dx) + PI * 0.92);                                            // poleyn
  }
  function armouredArm(ctx, sh, el, hd, hex, sw) {
    LC(ctx, [sh, el, hd], [4.2, 3.6, 3.0], '#3b3546');
    plate(ctx, lp(sh, el, 0.18), lp(sh, el, 0.86), 5.2, 4.5, hex);                                               // rerebrace
    plate(ctx, lp(el, hd, 0.16), lp(el, hd, 0.86), 4.7, 3.9, hex);                                               // vambrace
    cop(ctx, el, 3.7, hex, Math.atan2(el.y - sh.y, el.x - sh.x) + PI * 0.6);                                     // couter
    // gauntlet closed round the grip
    const g = dirv(sw, 1);
    ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(-Math.atan2(g.x, g.y) + PI / 2);
    poly(ctx, [[-4.2, -3.8], [3.6, -4.4], [5.4, -1], [4.2, 3.8], [-3.6, 4.2], [-5.2, 0]]); ctx.fillStyle = cel(ctx, 0, 0, 0.6, -0.8, 5, hex); ctx.fill(); ink(ctx, 1);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(2.6, -4.2); ctx.lineTo(3.4, 4); ctx.stroke();
    ctx.restore();
  }
  function gravesHelm(ctx, J, P2, ghost) {
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    // an armet: rounded skull, a beaked visor, a bevor at the chin
    const helm = () => { ctx.beginPath(); ctx.moveTo(-9, 10); ctx.quadraticCurveTo(-13.5, 0, -10, -9); ctx.quadraticCurveTo(-4, -16, 4, -14.5); ctx.quadraticCurveTo(10, -12, 11, -6); ctx.lineTo(16, -0.5); ctx.lineTo(11, 3.5); ctx.lineTo(10.5, 8.5); ctx.quadraticCurveTo(4, 13, -9, 10); ctx.closePath(); };
    helm(); ctx.fillStyle = cel(ctx, 1, -2, 0.6, -0.8, 14, IVOR); ctx.fill(); ink(ctx, 1.5);
    ctx.save(); helm(); ctx.clip();
    // visor plate shadow and the bevor seam
    ctx.fillStyle = 'rgba(80,70,104,0.35)'; poly(ctx, [[2, -7], [16, -0.5], [11, 3.5], [10.5, 9], [3, 10]]); ctx.fill();
    ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-8, 4); ctx.quadraticCurveTo(2, 2.5, 11, 3.5); ctx.moveTo(-1, -14); ctx.quadraticCurveTo(-3, -4, -8, 4); ctx.stroke();
    ctx.restore();
    // gilt crest ridge and brow band
    ctx.strokeStyle = INK; ctx.lineWidth = 3.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-10, -9); ctx.quadraticCurveTo(-3, -18, 7, -13.2); ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = GILT; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-11.5, -3); ctx.quadraticCurveTo(0, -8.5, 11.5, -5.5); ctx.stroke();
    // the visor slit: a calm line of gold light — his eyes are closed
    ctx.fillStyle = '#231c29'; poly(ctx, [[3.5, -3.6], [13.6, -1.4], [13, 0.4], [3.5, -1.6]]); ctx.fill();
    if (!ghost) glow(ctx, 9, -1.5, P2 ? 14 : 10, GOLD, P2 ? 0.85 : 0.6);
    ctx.fillStyle = P2 ? '#fff4cf' : GOLD; poly(ctx, [[5, -2.9], [12.8, -1.1], [12.6, -0.4], [5, -2]]); ctx.fill();
    ctx.fillStyle = 'rgba(11,6,18,0.6)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(6.5 + i * 1.8, 4 + i * 0.2, 0.55, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function gravesSword(ctx, J, tip, hot) {
    const b = J.hdF, dx = tip.x - b.x, dy = tip.y - b.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const pm = { x: b.x - ux * 15, y: b.y - uy * 15 };
    LB(ctx, pm, b, 1.8, 2.0, INK2, { noHatch: true });
    ctx.strokeStyle = U.rgba(GOLD, 0.8); ctx.lineWidth = 0.7; ctx.beginPath(); for (let k = 0.2; k < 0.95; k += 0.22) { const q = lp(pm, b, k); ctx.moveTo(q.x + nx * 1.8, q.y + ny * 1.8); ctx.lineTo(q.x - nx * 1.8 + ux * 2, q.y - ny * 1.8 + uy * 2); } ctx.stroke();
    ctx.beginPath(); ctx.arc(pm.x - ux * 2.5, pm.y - uy * 2.5, 3.2, 0, TAU); ctx.fillStyle = cel(ctx, pm.x, pm.y, 0.6, -0.8, 3.2, GILT); ctx.fill(); ink(ctx, 1.0);
    // crossguard with curled quillons
    const g0 = { x: b.x + ux * 2, y: b.y + uy * 2 };
    ctx.beginPath(); ctx.moveTo(g0.x + nx * 10 - ux * 4, g0.y + ny * 10 - uy * 4); ctx.quadraticCurveTo(g0.x + nx * 5, g0.y + ny * 5, g0.x, g0.y); ctx.quadraticCurveTo(g0.x - nx * 5, g0.y - ny * 5, g0.x - nx * 10 - ux * 4, g0.y - ny * 10 - uy * 4);
    ctx.strokeStyle = INK; ctx.lineWidth = 4.6; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = GILT; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.beginPath(); ctx.arc(g0.x, g0.y, 2.4, 0, TAU); ctx.fillStyle = GOLD; ctx.fill(); ink(ctx, 0.8);
    // the blade, whole again
    const s0 = { x: b.x + ux * 4, y: b.y + uy * 4 };
    ctx.beginPath(); ctx.moveTo(s0.x + nx * 3.4, s0.y + ny * 3.4); ctx.lineTo(tip.x - ux * 13 + nx * 2.6, tip.y - uy * 13 + ny * 2.6); ctx.lineTo(tip.x, tip.y); ctx.lineTo(tip.x - ux * 13 - nx * 2.6, tip.y - uy * 13 - ny * 2.6); ctx.lineTo(s0.x - nx * 3.4, s0.y - ny * 3.4); ctx.closePath();
    const gr = ctx.createLinearGradient(s0.x + nx * 3.4, s0.y + ny * 3.4, s0.x - nx * 3.4, s0.y - ny * 3.4);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#ece7dc'); gr.addColorStop(0.5, '#bab2a9'); gr.addColorStop(1, '#8e8698');
    ctx.fillStyle = gr; ctx.fill(); ink(ctx, 1.2);
    // its three strings, restored in memory
    lighter(ctx, () => {
      ctx.strokeStyle = U.rgba(GOLD, 0.75 + 0.25 * hot); ctx.lineWidth = 0.7;
      ctx.beginPath(); for (const k of [-1.3, 0, 1.3]) { ctx.moveTo(s0.x + nx * k + ux * 3, s0.y + ny * k + uy * 3); ctx.lineTo(tip.x - ux * 16 + nx * k * 0.6, tip.y - uy * 16 + ny * k * 0.6); } ctx.stroke();
      if (hot > 0.05) { ctx.strokeStyle = U.rgba(GOLDL, 0.35 * hot); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(tip.x, tip.y); ctx.stroke(); }
    });
  }
  function gravesBody(ctx, e, p, J, tip, P2, ghost, a) {
    const { Q, nx, ny } = torsoQ(J), s = GR.scale, f = e.drawF, sk = e._sink || 0;
    const toL = (q) => ({ x: (q.x - e.x) * f / s, y: (q.y - e.y - sk) / s });
    // cape (ivory, a gilt lining showing) and the plume
    if (e.cape.inited) { const cp = e.cape.p.map(toL); cp[0] = { x: J.sh.x - 5, y: J.sh.y + 2 }; K.tattered(ctx, cp, 7, 18, '#efe9dc', 'rgba(214,170,84,0.75)', e.seed % 5); }
    if (e.plume.inited) {
      const pl = e.plume.p.map(toL);
      Rig.ribbon(ctx, pl, 4.2, 0.8, '#fbf7ee', 1.8); ink(ctx, 1.0);
      lighter(ctx, () => Rig.ribbon(ctx, pl.slice(1).map((q) => ({ x: q.x + 0.6, y: q.y - 0.9 })), 1.4, 0.2, U.rgba(GOLD, P2 ? 0.95 : 0.65)));
    }
    // the far arm and leg
    armouredArm(ctx, J.shB, J.elB, J.hdB, IVOS, p.sw);
    armouredLeg(ctx, J.hip, J.kneeB, J.ankB, J.toeB, IVOS, false);
    // surcoat panel between the legs: white cloth, gilt hem, the broken-string emblem
    const sw = Math.sin(e.t * 2.1) * 2 - e.vx * e.facing * 0.01, hp = J.hip;
    polyP(ctx, [Q(0.02, -7), Q(0.02, 9), { x: hp.x + 11 + sw, y: hp.y + 34 }, { x: hp.x + 2 + sw * 1.2, y: hp.y + 30 }, { x: hp.x - 6 + sw * 1.3, y: hp.y + 38 }]);
    ctx.fillStyle = cel(ctx, hp.x, hp.y + 16, 1, 0, 11, '#efe9dc'); ctx.fill(); ink(ctx, 1.2);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(hp.x + 11 + sw, hp.y + 33); ctx.lineTo(hp.x + 2 + sw * 1.2, hp.y + 29); ctx.lineTo(hp.x - 6 + sw * 1.3, hp.y + 37); ctx.stroke();
    // cuirass: a deep chest, gilt edges, a sculpted line and his three strings
    const tp = [Q(-0.02, -9.5), Q(0.35, -10.6), Q(0.8, -13.2), Q(1.08, -8), Q(1.14, 2), Q(1.02, 10.6), Q(0.72, 13.6), Q(0.42, 11), Q(0.1, 9.6)];
    smoothP(ctx, tp); const tm = Q(0.55, 1); ctx.fillStyle = cel(ctx, tm.x, tm.y, nx, ny, 14, IVOR); ctx.fill(); ink(ctx, 1.5);
    ctx.save(); smoothP(ctx, tp); ctx.clip();
    ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.9; ctx.beginPath(); const c0 = Q(0.95, -6), c1 = Q(0.7, 4), c2 = Q(0.5, 12); ctx.moveTo(c0.x, c0.y); ctx.quadraticCurveTo(c1.x, c1.y, c2.x, c2.y); ctx.stroke();
    ctx.strokeStyle = U.rgba(GOLD, 0.95); ctx.lineWidth = 1.6; ctx.beginPath(); const n0 = Q(1.13, -9), n1 = Q(1.04, 3), n2 = Q(1.0, 11); ctx.moveTo(n0.x, n0.y); ctx.quadraticCurveTo(n1.x, n1.y, n2.x, n2.y); ctx.stroke();
    ctx.restore();
    lighter(ctx, () => { ctx.strokeStyle = U.rgba(GOLD, 0.85); ctx.lineWidth = 0.75; ctx.beginPath(); for (const k of [-2.4, 0, 2.4]) { const u = Q(0.98, k - 2), v = Q(0.28, k + 7); ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y); } ctx.stroke(); });
    const em = Q(0.68, 7.5); ctx.beginPath(); ctx.arc(em.x, em.y, 2.8, 0, TAU); ctx.fillStyle = cel(ctx, em.x, em.y, 0.6, -0.8, 3, GILT); ctx.fill(); ink(ctx, 0.9);
    // gorget, belt, and three faulds over the hips
    LB(ctx, Q(1.06, -7), Q(1.13, 6), 3.6, 3.4, IVOR, { noHatch: true });
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.beginPath(); const g1 = Q(1.0, -7), g2 = Q(1.06, 6.5); ctx.moveTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y); ctx.stroke();
    for (let k = 0; k < 3; k++) {
      const sA = -0.02 - k * 0.12, a0 = Q(sA, -10.5 - k * 0.8), a1 = Q(sA, 11 + k * 1.1);
      LB(ctx, a0, a1, 3.3, 3.3, IVOR, { noHatch: true });
      ctx.strokeStyle = U.rgba(GOLD, 0.9); ctx.lineWidth = 0.9; ctx.beginPath(); const b0 = Q(sA - 0.075, -10.5 - k * 0.8), b1 = Q(sA - 0.075, 11 + k * 1.1); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
    }
    LB(ctx, Q(0.12, -10.2), Q(0.12, 10.2), 2.4, 2.4, GILT, { noHatch: true });
    // the near leg, and a tasset hanging over its thigh
    armouredLeg(ctx, J.hip, J.kneeF, J.ankF, J.toeF, IVOR, true);
    plate(ctx, lp(J.hip, J.kneeF, -0.08), lp(J.hip, J.kneeF, 0.42), 8.4, 7.4, IVOR);
    // head, sword, sword arm, pauldron
    gravesHelm(ctx, J, P2, ghost);
    const hot = Math.max(e.tellT || 0, a && a.stance && e.st > a.guardFrom && e.st < a.guardTo ? 0.6 : 0, e.parryFx || 0);
    gravesSword(ctx, J, tip, hot);
    armouredArm(ctx, J.sh, J.elF, J.hdF, IVOR, p.sw);
    for (const [r0, k] of [[9, 0], [7.2, 1], [5.6, 2]]) {
      const cx = J.sh.x - 1 + k * 0.6, cy = J.sh.y + 1 + k * 4.2;
      ctx.beginPath(); ctx.ellipse(cx, cy, r0, r0 * 0.72, -0.32, PI * 0.95, PI * 2.05); ctx.closePath();
      ctx.fillStyle = cel(ctx, cx, cy, 0.6, -0.8, r0, IVOR); ctx.fill(); ink(ctx, 1.2);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, r0 - 1.6, (r0 - 1.6) * 0.72, -0.32, PI * 1.05, PI * 1.95); ctx.stroke();
    }
  }
  const GR = reg('c7_elite', {
    name: '掘墓人的殘影', en: 'THE GRAVEDIGGER, REMEMBERED', w: 46, h: 172, hp: 820, bal: 240, col: '#ffe6a6', shards: 440, elite: true, scale: 1.3, spawnT: 1.0,
    defeatDialog: 'c7_eliteDefeat', defeatRelic: 'c7_oath', music: 'c7_elite',
    portrait: [1.75, 0.94],
    init(e) { e.seed = seedOf(); e.cape = new Rig.Chain(9, 9, 0.05, 0.9); e.plume = new Rig.Chain(7, 6.5, 0.06, 0.9); e.facing = -1; e.lastMoves = []; e.gaitP = 0; e.drawF = -1; e.parryFx = 0; },
    voice: () => G.SFX.play('c7_gravesVoice'),
    weapon: (e) => e.wpt || { x: e.x + e.facing * 90, y: e.y - 150 },
    // 靜候: frontal blows during the stance are read and answered (blows from behind are not)
    guard(e, h) {
      const a = e.state === 'atk' ? e.atk : null;
      if (!a || a.guardTo == null || e.st < (a.guardFrom || 0) || e.st > a.guardTo) return false;
      const P = G.game.player;
      if ((P.x - e.x) * e.facing < -6) return false;
      e.parryFx = 1;
      const w = e.wpt || { x: e.x, y: e.y - 150 };
      G.SFX.play('c7_ring'); G.FX.ring(w.x, w.y, 6, 80, 0.32, GOLD, 4); G.FX.star(w.x, w.y, GOLDL, 70, 0.3);
      if (a !== GR.riposte) { e.faceP(); e.startAtk(GR.riposte); }
      return true;
    },
    think(e, dt) {
      Rec.sample(); e.faceP();
      const P = e.P, d = e.distP(), T = GR;
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) { e.phase = 2; e.speedMul = 1.06; G.game.bark('c7_eliteP2'); e.startAtk(T.ascend); return; }
      if (!e.greeted) { e.greeted = true; e.startAtk(T.salute); return; }
      let vx = 0;
      if (d > 235) vx = e.facing * 150; else if (d < 115) vx = -e.facing * 110;
      e.vx = U.approach(e.vx, vx * e.speedMul, 900 * dt);
      if (e.cd > 0 || !e.onGround) return;
      const P2 = e.phase === 2, mash = Math.min(3, Rec.count(2.0)), last = e.lastMoves[e.lastMoves.length - 1];
      let pool;
      if (d < 240) pool = [['waltz', 2.4], ['stance', 0.6 + mash * 0.55], ['retreat', 1.7], ['thrust', 0.3]];
      else if (d < 470) pool = [['thrust', 2.2], ['crescent', P2 ? 2.2 : 0], ['stance', 0.3 + mash * 0.3], ['walk', 1.4]];
      else pool = [['crescent', P2 ? 2.5 : 0], ['walk', 2]];
      const stanceReady = G.game.time - (e.stanceAt ?? -99) > (P2 ? 5 : 6);          // a test he sets now and then, not a wall
      const wt = (q) => (q[0] === 'stance' && !stanceReady ? 0 : q[0] === last ? q[1] * 0.3 : q[1]);
      let r = Math.random() * pool.reduce((s, q) => s + wt(q), 0), pick = 'walk';
      for (const q of pool) if ((r -= wt(q)) <= 0) { pick = q[0]; break; }
      if (pick === 'walk') { e.cd = 0.3; return; }
      if (pick === 'stance') e.stanceAt = G.game.time;
      e.lastMoves.push(pick); if (e.lastMoves.length > 4) e.lastMoves.shift();
      e.startAtk({ waltz: P2 ? T.waltz4 : T.waltz, stance: P2 ? T.stance2 : T.stance, thrust: T.thrust, crescent: T.crescent, retreat: T.retreat }[pick]);
    },
    salute: {
      dur: 1.7, cd: 0.4, track: false,
      anim: { keys: [[0, GI()], [0.5, GRP.salute, 'io'], [1.15, GRP.salute], [1.7, GI(), 'io']] },
      ev: [{ t: 0.5, fn: (e) => { G.SFX.play('c7_ring'); const w = e.wpt; if (w) G.FX.star(w.x, w.y, GOLDL, 90, 0.4); } }],
    },
    waltz: waltzDef(false),
    waltz4: waltzDef(true),
    stance: stanceDef(1.35),
    stance2: stanceDef(1.0),
    riposte: {
      dur: 1.36, cd: 1.8, guardFrom: 0, guardTo: 0.34, tells: [{ t: 0.02, c: 'red' }],
      anim: { keys: [[0, GRP.stance], [0.34, GRP.thrA, 'io'], [0.64, GRP.thrB, 'snap'], [0.96, GRP.thrB], [1.36, GI(), 'io']] },
      moves: [{ t0: 0.61, t1: 0.76, v: 640 }],
      hits: [gravesHit(0.64, 0.8, POINT, 30, { red: true, kb: 420, last: true })],
      ev: [{ t: 0.62, fn: () => G.SFX.play('slash', 0.55, true) }],
    },
    thrust: {
      dur: 1.95, cd: 2.0, track: false, tells: [{ t: 0.28, c: 'red' }],
      anim: { keys: [[0, GI()], [0.3, GRP.thrA, 'io'], [0.95, GRP.thrA], [1.0, GRP.thrB, 'snap'], [1.36, GRP.thrB], [1.95, GI(), 'io']] },
      moves: [{ t0: 0.96, t1: 1.2, v: 1000 }],
      hits: [gravesHit(0.98, 1.2, POINT, 32, { red: true, kb: 440, last: true })],
      ev: [{ t: 0.97, fn: () => { G.SFX.play('slash', 0.45, true); G.SFX.play('whoosh', 0.8); } }],
    },
    crescent: {
      dur: 1.75, cd: 1.8, track: false, tells: [{ t: 0.25, c: 'white' }],
      anim: { keys: [[0, GI()], [0.5, GRP.crA, 'io'], [0.78, GRP.w3b, 'snap'], [1.2, GRP.w3b], [1.75, GI(), 'io']] },
      ev: [{ t: 0.78, fn: gravesWave }],
    },
    retreat: {
      dur: 0.95, cd: 0.25, track: false,
      anim: { keys: [[0, GI()], [0.3, GRP.bow, 'io'], [0.6, GRP.bow], [0.95, GI(), 'io']] },
      moves: [{ t0: 0.12, t1: 0.5, v: -420 }],
      ev: [{ t: 0.1, fn: (e) => { G.SFX.play('whoosh', 0.7); G.FX.dust(e.x, e.y, 6, { w: 30, speed: 90, size: 9, col: 'rgba(240,226,190,' }); } }],
    },
    ascend: {
      dur: 1.5, cd: 0.6, track: false,
      anim: { keys: [[0, GRP.hurt], [0.55, GRP.rise, 'io'], [1.05, GRP.rise], [1.5, GI(), 'io']] },
      ev: [{ t: 0.55, fn: (e) => {
        const w = e.wpt || { x: e.x, y: e.y - 220 };
        G.FX.ring(e.cx, e.cy, 20, 320, 0.8, GOLD, 7); G.FX.flash(w.x, w.y, 220, 0.5, GOLDL); G.FX.star(w.x, w.y, GOLDL, 150, 0.6);
        G.SFX.play('c7_ring'); G.SFX.play('c7_gravesVoice'); G.game.shake(0.6); G.game.slowmo(0.5, 0.4);
      } }],
    },
    atkUpdate(e, dt) { if (e.atk && e.atk.stance) e.vx = U.approach(e.vx, 0, 1600 * dt); },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, a = e.state === 'atk' ? e.atk : null, s = GR.scale, P2 = e.phase === 2;
      const p = gravesPose(e, dt), J = Rig.compute(p), tip = addP(J.hdF, dirv(p.sw, 98));
      const twirl = !!(a && a.twirl && e.st > a.twirl[0] && e.st < a.twirl[1]);
      const f = e.facing * (twirl ? -1 : 1); e.drawF = f;
      const sink = K.emerge(ctx, e) * 170; e._sink = sink;
      const W = (q) => ({ x: e.x + f * q.x * s, y: e.y + sink + q.y * s });
      if (!ghost) e.wpt = W(tip);
      if (dt > 0) {
        e.parryFx = Math.max(0, e.parryFx - dt * 3);
        const sh = W({ x: J.sh.x - 5, y: J.sh.y + 2 });
        e.cape.update(sh.x, sh.y, f, dt, -e.vx * 4 + Math.sin(e.t * 1.9 + e.seed) * 240 + (twirl ? -f * 1400 : 0) + (P2 ? Math.sin(e.t * 4.1) * 140 : 0), 2.66);
        const ca = Math.cos(J.ha), sa = Math.sin(J.ha), pt = W({ x: J.head.x + (-7 * ca + 13 * sa), y: J.head.y + (-7 * sa - 13 * ca) });
        e.plume.update(pt.x, pt.y, f, dt, -e.vx * 6 + Math.sin(e.t * 2.6) * 320, 2.2);
      }
      if (!ghost) {
        const fl = floorAt(e.x, e.y - 6, e.y);
        ctx.fillStyle = 'rgba(10,7,14,0.45)'; ctx.beginPath(); ctx.ellipse(e.x, fl - 0.5, 34 * s, 4, 0, 0, TAU); ctx.fill();
        if (!low()) { glow(ctx, e.x, e.y + sink - 92 * s, 120 * s, '#fff2d2', P2 ? 0.24 : 0.17); glow(ctx, e.x, fl - 6, 46 * s, GOLD, 0.25); }
        // 靜候: a gilt circle at his feet while he reads you
        if (a && a.stance && e.st > a.guardFrom && e.st < a.guardTo) {
          const k = U.clamp((e.st - a.guardFrom) / 0.2, 0, 1) * (1 - U.clamp((e.st - a.guardTo + 0.15) / 0.15, 0, 1));
          lighter(ctx, () => {
            ctx.strokeStyle = U.rgba(GOLD, 0.7 * k); ctx.lineWidth = 2; ctx.setLineDash([10, 6]); ctx.lineDashOffset = -e.t * 30;
            ctx.beginPath(); ctx.ellipse(e.x, fl - 1, 70 * s, 9, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
            K.glow(ctx, e.x + f * 18 * s, e.y - 150 * s, 50, GOLDL, 0.25 * k);
          });
        }
      }
      ctx.save(); ctx.translate(e.x, e.y + sink); ctx.scale(f * s, s);
      gravesBody(ctx, e, p, J, tip, P2, ghost, a);
      if (e.tellT > 0) glow(ctx, tip.x, tip.y, 26, e.tellCol === 'red' ? RED : '#ffffff', e.tellT * 1.4);
      ctx.restore();
      if (e.state === 'broken') dizzy(ctx, e.x + f * J.head.x * s, e.y + sink + J.head.y * s - 24, e.t, 16);
      if (!ghost && dt > 0 && Math.random() < (P2 ? 0.55 : 0.25)) G.FX.ember(e.x, e.y - 70 * s, 1, GOLD, { w: 40 * s, h: 120 * s, up: 70, sp: 30, life: 0.8 });
    },
  });

  /* ================================ data: codex, relic, barks ================================ */
  const pushOnce = (arr, en) => { if (!arr.some((q) => q.id === en.id)) arr.push(en); };
  D.barks.c7_eliteP2 = { who: 'graves', text: '……很好。第二支舞。' };
  // the chapter's world file owns these; they are only a safety net (its register() overwrites them)
  if (!D.dialog.c7_eliteIntro) D.dialog.c7_eliteIntro = [{ who: 'graves', text: '王的女兒。……在這裡，我還沒拿起鏟子。' }, { who: 'graves', text: '來吧。讓我用劍，把這支舞跳完。' }];
  if (!D.dialog.c7_eliteDefeat) D.dialog.c7_eliteDefeat = [{ who: 'graves', text: '……好劍。這誓言，換妳帶著走。' }, { who: 'graves', text: '往下走。別讓那扇門關著。' }];
  D.relics.c7_oath = D.relics.c7_oath || { name: '騎士之誓', desc: '生命高於 70% 時，劍擊傷害 +15%' };
  // 斷弦之誓: while she stands above 70 % HP her blade hits 15 % harder. Implemented as a thin per-instance wrap of
  // doHits that raises dmgMul only for the duration of the call; inert (and self-removing) once the relic is unequipped.
  const oathOn = (P) => !!(G.game && G.game.save && (G.game.save.equipped || []).includes('c7_oath')) && P.hp > P.maxHp * 0.7;
  G.Relics.c7_oath = G.Relics.c7_oath || {
    apply(P) {
      if (P._c7oath) return;
      P._c7oath = wrapMethod(P, 'doHits', (prev, st) => function (box, h) {
        if (st.on && !(G.game.save.equipped || []).includes('c7_oath')) { const un = this._c7oath; this._c7oath = null; if (un) un(); return prev.call(this, box, h); }
        if (!st.on || !oathOn(this)) return prev.call(this, box, h);
        const m = this.dmgMul; this.dmgMul = m * 1.15;
        try { return prev.call(this, box, h); } finally { this.dmgMul = m; }
      });
    },
  };
  pushOnce(D.codex.items, {
    id: 'c7_oath', name: '騎士之誓', en: "THE KNIGHT'S OATH", unlock: 'relic_c7_oath', relic: true,
    body: ['掘墓人放下劍、拿起鏟子之前，以騎士之名發的誓：替王送完最後一程。', '王沒有死，誓言也就一直沒有完成。他把它交給了一個要走到門後面的人。', '遺物效果：生命高於 70% 時，劍擊傷害 +15%。'],
  });
  const HB = D.codex.hushborn;
  pushOnce(HB, {
    id: 'c7_mirror', name: '回聲殘像', en: 'ECHO SELF', portrait: 'c7_mirror', unlock: 'seen_c7_mirror', tag: '寂裔｜中階・殘響',
    body: [
      '遺忘之庭會記住每一個走過的人——包括你。它用墨水把你剛才揮出的每一劍重描一遍，再原封不動地還給你。在你忘記之前。',
      '攻擊模式：模仿你最近的一段連擊（白光，節奏比你慢半拍，正好用來練完美閃避）／你打出連段末擊或用過共鳴技之後，它會以紅光突刺收尾（必須閃避）。',
      '弱點：它只會模仿。看準架勢，繞到背後，它就只剩最基本的兩段斬。',
    ],
  });
  pushOnce(HB, {
    id: 'c7_restmark', name: '休止符', en: 'REST MARK', portrait: 'c7_restmark', unlock: 'seen_c7_restmark', tag: '寂裔｜低階・符號',
    body: [
      '從譜上剝落的四分與八分休止符，身上還帶著一小段五線譜。它們經過的地方，字就會被擦掉——亡者就是這樣忘記的。',
      '攻擊模式：白色音符（會追蹤，彈不回去，看準時機閃開）／紅色「擦除」——紅色劃痕一筆一筆劃過你附近的平台，約一秒後那段平台會被抹去三秒／沒有平台可擦時，會化成一道紅色筆劃穿過你（閃避）。',
      '弱點：劃到一半時打斷它，平台就不會消失。',
    ],
  });
  pushOnce(HB, {
    id: 'c7_choir', name: '無聲詩班', en: 'VOICELESS CHOIR', portrait: 'c7_choir', unlock: 'seen_c7_choir', tag: '寂裔｜低階・支援',
    body: [
      '眼睛被金線縫起來的唱詩者，總是兩三個一起，圍成一圈。牠們張著嘴，卻沒有聲音——生前唱過的每一首歌，都已經忘了。',
      '特性：只要詩班還有一個活著，你的共鳴就無法累積。',
      '攻擊模式：緩慢擴散的白色聲環（時機寬鬆；完美閃避可以穿過它）／貼近時用樂譜甩打（白光）。',
      '弱點：近身後幾乎毫無抵抗力。先打散圓圈裡離你最近的那一個。',
    ],
  });
  pushOnce(HB, {
    id: 'c7_fermata', name: '延長記號', en: 'FERMATA', portrait: 'c7_fermata', unlock: 'seen_c7_fermata', tag: '寂裔｜高階・巨像',
    body: [
      '譜上的延長記號，意思是「在這裡，停久一點」。它把這句話當成了命令——想把每一個快要忘記的人，留在最後一刻。',
      '攻擊模式：時間泡（金色穹頂罩住你，待在裡面時腳步只剩一半）／眼球擺盪（白光，掃過拱門下方與前方）／整座拱門向前傾倒（紅光，範圍很長，閃避）。',
      '弱點：倒下之後，它得花很久才能重新站起來——那顆眼睛就落在你腳邊。',
    ],
  });
  pushOnce(HB, {
    id: 'c7_elite', name: '掘墓人的殘影', en: 'THE GRAVEDIGGER, REMEMBERED', portrait: 'c7_elite', unlock: 'seen_c7_elite', tag: '菁英｜溫陀王城的掘墓人（殘影）',
    body: [
      '王城的掘墓人葛雷夫，掉進遺忘之庭的殘影。這裡的他還沒拿起鏟子：鎧甲潔白，劍也還是完整的——像他還是王的騎士時那樣。',
      '他不是來阻止你的。他只是想知道，你能不能把那扇門打開。',
      '攻擊模式：三步圓舞（三連白光，第三步旋身橫掃）／靜候（劍立於面前——此時從正面出手會被看穿，並立刻以紅光反刺回應）／斷弦突刺（中距離紅光突進）。',
      '第二階段：圓舞多出第四步的紅光突刺；會揮出必須閃開的金色劍氣。',
      '弱點：看見他立劍時——等。靜候結束時他會收劍行禮，那是最大的破綻。從背後出手不會被看穿。',
    ],
  });
})(window.G);

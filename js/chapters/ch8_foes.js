'use strict';
/* ECHOFALL — Chapter VIII 最後的樂章 THE LAST MOVEMENT — foes   (docs/STORY.md §3-VIII · docs/CHAPTER_API.md §4–5)
   c8_hushling 噤聲童影 HUSHLING · c8_conductor 指揮殘影 CONDUCTOR WRAITH · c8_cadence 終止騎士 CADENCE KNIGHT ·
   c8_coda 尾聲蛇 CODA SERPENT · c8_elite 第一降臨隊 THE FIRST DESCENT (lead: the standard-bearer) with its two companions
   c8_elite_shield 鼓盾手 THE DRUMSHIELD and c8_elite_bell 鳴鐘者 THE BELL-RINGER
   (+ their SFX, codex entries, barks, hint c8_cling, and the elite's relic c8_banner 第一降臨隊的軍旗).

   The look: the Rest's last defenders, cut from the pale stage itself — paper-white with cool lilac shadow and a gilt
   bounce, black lacquer and ink with gilt rims, and one crimson: Maestrina's. Everything here pops up like a stage
   cut-out when it arrives and, when it falls, blanches to paper-white and flakes away into silence.

   Mechanics — every one reversible, self-removing, and inert while these foes are absent:
     · 屏息 CLING   a Hushling that catches Rinne holds on (invulnerable while it clings): it drains her stamina (never
                    below 1, so a dodge is always possible), drags her step, and lets go when she dodges (or after 3.6 s).
                    Front-side clingers are painted over her through a thin wrapper on the player instance's draw that
                    removes itself as soon as nobody clings.
     · 節拍 TEMPO   while a Conductor Wraith lives, foes within ~640 px have their attack cooldown run 1.7× faster
                    (attack timelines themselves are never sped up — every tell keeps its full lead). A shared hazard
                    ticker draws the beat; it ends itself with the last conductor and clears its marks.
     · 旗 BANNER    the standard-bearer (c8_elite) cannot fall while a companion stands: at 0 HP it kneels behind its
                    planted banner, untouchable, and collapses — triggering the elite defeat flow — with the last of them.
   Telegraphs: white = guard/parry, red = dodge; every blow lands ≥0.45 s after its tell (≥0.6 s for the big ones).
   Placement: see the report / the notes beside each type. */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK, RED = K.CRIM, D = G.DATA, DIM = Rig.DIM, AN = Rig.ANIM;
  const LC = Rig.limbChain, LB = Rig.limb, lp = K.lerpP;
  const DEBUG_HB = typeof location !== 'undefined' && /[?#&]hb=1(?:&|$)/.test(location.href);

  /* ================================ palette ================================ */
  const GOLD = '#f2c766', GOLDL = '#fff1c4', GOLDD = '#a8772f', SIL = '#fffaf0', CRIMSON = '#c81d43', CRIML = '#ff8aa0';
  // bespoke cel ramps on hexes nobody else uses (Rig.ramp is a shared cache): paper whose shadow is cool lilac and whose
  // bounce is gold; lacquer whose lit edge is gilt; gilt; Maestrina's crimson
  function defRamp(hex, hi, lit, dark, bounce) { Object.assign(Rig.ramp(hex), { hi, lit, dark, bounce }); return hex; }
  const PAP = defRamp('#f5f0e6', '#ffffff', '#f5f0e6', '#c3bad0', '#e8cf8e');
  const PAPS = defRamp('#d9d1c3', '#f3ecdf', '#dcd4c6', '#a399b3', '#cdac66');
  const HAIR = defRamp('#e9dfcb', '#fbf5e8', '#e9dfcb', '#9d93a6', '#d7b46a');
  const LAC = defRamp('#13101a', '#d9a94f', '#272130', '#0b090f', '#3c2f1e');
  const LAC2 = defRamp('#1f1a27', '#e8bf6a', '#332c3d', '#120f17', '#4a3a24');
  const LAC3 = defRamp('#2a2334', '#f2cf80', '#40384a', '#19151e', '#564429');
  const GLT = defRamp('#d6aa52', '#fff0c0', '#e4bb64', '#89602c', '#ffd88a');
  const CRM = defRamp('#b8173a', '#ff8c9c', '#cf2747', '#5e0a24', '#ff9e7a');
  const IVO = defRamp('#eee6d5', '#ffffff', '#eee6d5', '#9d94a8', '#dcbd72');

  /* ================================ helpers ================================ */
  const poly = (ctx, p, close = true) => { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); if (close) ctx.closePath(); };
  const polyP = (ctx, p, close = true) => { ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y); if (close) ctx.closePath(); };
  function smoothP(ctx, p) {
    const n = p.length; ctx.beginPath(); ctx.moveTo((p[n - 1].x + p[0].x) / 2, (p[n - 1].y + p[0].y) / 2);
    for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    ctx.closePath();
  }
  function curveThrough(ctx, p) { ctx.moveTo(p[0].x, p[0].y); for (let i = 1; i < p.length - 1; i++) { const m = lp(p[i], p[i + 1], 0.5); ctx.quadraticCurveTo(p[i].x, p[i].y, m.x, m.y); } ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y); }
  const ink = (ctx, w = 1.3) => { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); };
  const line = (ctx, a, b, col, w) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); };
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
  const EASE = { lin: (t) => t, io: U.easeInOutSine, out: U.easeOutCubic, snap: (t) => 1 - Math.pow(1 - t, 4), in: U.easeInCubic, back: U.easeOutBack };
  function lerpO(a, b, t) { const o = {}; for (const k in a) o[k] = a[k] + ((b[k] ?? a[k]) - a[k]) * t; return o; }
  // keyframes over plain numeric "poses": [[t, pose, ease], ...]
  function sampK(keys, t, def) {
    const R = (p) => Object.assign({}, def, p);
    if (t <= keys[0][0]) return R(keys[0][1]);
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i];
      return lerpO(R(a[1]), R(b[1]), EASE[b[2] || 'io']((t - a[0]) / (b[0] - a[0] || 1)));
    }
    return R(keys[keys.length - 1][1]);
  }
  function blendTo(e, key, target, dt, k) {
    if (!e[key]) e[key] = Object.assign({}, target);
    else if (dt > 0) e[key] = lerpO(e[key], target, 1 - Math.exp(-k * dt));
    return e[key];
  }
  const torsoQ = (J, len = DIM.TORSO) => {
    const tA = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x), ux = Math.cos(tA), uy = Math.sin(tA), nx = -uy, ny = ux;
    return { Q: (s, f) => ({ x: J.hip.x + ux * s * len + nx * f, y: J.hip.y + uy * s * len + ny * f }), nx, ny, ang: tA };
  };
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
  // dazed: three paper stars circling with a gilt core
  function dizzy(ctx, x, y, t, r = 14) {
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * TAU / 3, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.32;
      ctx.fillStyle = INK; star4(ctx, px, py, 3.2); ctx.fillStyle = Math.sin(a) > 0 ? '#ffffff' : GOLDL; star4(ctx, px, py, 2.2);
    }
  }
  // a quarter note glyph (♩) at x,y (head centre), size s
  function noteGlyph(ctx, x, y, s, fill, stroke = INK) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 3.6, -0.45, 0, TAU); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.4 / s; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4.2, -1.4); ctx.lineTo(4.2, -15); ctx.strokeStyle = stroke; ctx.lineWidth = 2.6 / s; ctx.lineCap = 'round'; ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = 1.1 / s; ctx.stroke();
    ctx.restore();
  }
  // the musical breath mark — a comma — the Hushlings' held breath
  function breathMark(ctx, x, y, s, fill) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.moveTo(3.1, 1.2); ctx.quadraticCurveTo(3.2, 6.5, -2.6, 9.6); ctx.quadraticCurveTo(1.2, 5.6, 0.4, 3.2);
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.1 / s; ctx.stroke();
    ctx.restore();
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

  /* ---- 屏息 CLING: the Hushlings that hold on to Rinne ---- */
  // slots on her body, in her facing frame (+x = where she looks); front ones are painted over her
  const SLOTS = [
    { x: -21, y: -64, front: false, hug: 'waist' }, { x: 18, y: -22, front: true, hug: 'leg' }, { x: -17, y: -94, front: false, hug: 'back' },
    { x: -18, y: -22, front: false, hug: 'leg' }, { x: 21, y: -66, front: true, hug: 'waist' },
  ];
  const Cling = {
    un: null, pl: null,
    list() { const g = G.game; return g && g.enemies ? g.enemies.filter((q) => q.cling && !q.dead) : []; },
    freeSlot() { const used = this.list().map((q) => q.cling.slot); for (let i = 0; i < SLOTS.length; i++) if (!used.includes(i)) return i; return -1; },
    ensure() {
      const P = G.game && G.game.player; if (!P || (this.un && this.pl === P)) return;
      if (this.un) this.un();
      this.pl = P;
      this.un = wrapMethod(P, 'draw', (prev, st) => function (...a) {
        const r = prev.apply(this, a);
        if (!st.on) return r;
        const cl = Cling.list();
        if (!cl.length) { Cling.release(); return r; }
        const ctx = a[0];
        for (const q of cl) if (q.cling.front) { q._front = true; try { q.draw(ctx); } finally { q._front = false; } }
        return r;
      });
    },
    release() { if (this.un) { this.un(); this.un = null; this.pl = null; } },
    // the enemy pass skips front clingers while the player pass is there to paint them
    hidden(e) { return !!(e.cling && e.cling.front && this.un && this.pl === G.game.player && !e._front); },
  };

  /* ---- 節拍 TEMPO: a living Conductor Wraith keeps time for every foe near it ---- */
  const BEAT = 0.6, TEMPO_R = 640, TEMPO_CD = 0.7;
  const Tempo = {
    h: null,
    conductors() { return G.game.enemies.filter((q) => q.type === 'c8_conductor' && !q.dead && q.state !== 'spawn' && q.state !== 'broken' && q.state !== 'executed'); },
    ensure() {
      const g = G.game; if (!g) return;
      if (this.h && g.hazards.indexOf(this.h) >= 0) return;
      this.h = { t: 0, c8tempo: true, beat: -1, update: tempoUpdate, draw: tempoDraw };
      g.hazards.push(this.h);
    },
    clear(g) { for (const q of g.enemies) if (q._c8cond) q._c8cond = null; },
  };
  function tempoUpdate(h, dt, g) {
    const cs = Tempo.conductors();
    if (!cs.length) { Tempo.clear(g); h.done = true; if (Tempo.h === h) Tempo.h = null; return; }
    const beat = Math.floor(g.time / BEAT), newBeat = beat !== h.beat; h.beat = beat;
    for (const q of g.enemies) {
      if (q.dead || q.boss || q.type === 'c8_conductor' || q.state === 'spawn') { q._c8cond = null; continue; }
      let best = null, bd = 1e9;
      for (const c of cs) { const d = Math.abs(q.x - c.x); if (d < TEMPO_R && Math.abs(q.y - c.y) < 560 && d < bd) { best = c; bd = d; } }
      if (q._c8cond !== best) { q._c8cond = best; q._c8in = g.time; }
      if (!best) continue;
      // conducted foes come in faster: only the wait between attacks shrinks, never an attack's own wind-up
      if (q.state === 'idle' && q.cd > 0) q.cd -= dt * TEMPO_CD;
      if (newBeat) { q._c8beat = g.time; q._c8bn = beat; }
    }
    if (newBeat) for (const c of cs) { c._c8beat = g.time; c._c8bn = beat; }
    if (newBeat && beat % 4 === 0 && cs.some((c) => Math.abs(c.x - g.player.x) < 900)) G.SFX.play('c8_tick', 1);
  }
  // under every conducted foe a crimson beat ring thumps; a gilt thread runs to the baton; a note pops on the beat
  function tempoDraw(ctx, h, g) {
    for (const q of g.enemies) {
      const c = q._c8cond; if (!c || q.dead || c.dead) continue;
      const since = g.time - (q._c8beat ?? -9), k = Math.max(0, 1 - since / 0.42), down = (q._c8bn ?? 1) % 4 === 0;
      const fade = U.clamp((g.time - (q._c8in ?? 0)) / 0.4, 0, 1), fl = floorAt(q.x, q.y - 6, q.y);
      const rx = Math.max(26, q.w * 0.75) * (1 + 0.28 * k * (down ? 1.5 : 1));
      ctx.save(); ctx.globalAlpha = fade;
      lighter(ctx, () => {
        ctx.strokeStyle = U.rgba(CRIMSON, 0.35 + 0.55 * k); ctx.lineWidth = 1.4 + 2 * k;
        ctx.beginPath(); ctx.ellipse(q.x, fl - 1, rx, rx * 0.16, 0, 0, TAU); ctx.stroke();
        // four metronome ticks round the ring; the one for this beat is lit
        for (let i = 0; i < 4; i++) {
          const a = -PI / 2 + i * PI / 2, on = ((q._c8bn ?? 0) % 4) === i;
          const x = q.x + Math.cos(a) * rx, y = fl - 1 + Math.sin(a) * rx * 0.16;
          ctx.fillStyle = on ? U.rgba(GOLDL, 0.5 + 0.5 * k) : U.rgba(CRIMSON, 0.5);
          ctx.beginPath(); ctx.arc(x, y, on ? 2.4 : 1.4, 0, TAU); ctx.fill();
        }
        if (!low() && c.tipW) {
          // the gilt tempo thread: dotted, with a bead of light travelling down it on the beat
          const a = c.tipW, b = { x: q.x, y: q.y - q.h * 0.62 }, L = Math.hypot(b.x - a.x, b.y - a.y);
          if (L > 30 && L < 900) {
            ctx.setLineDash([2, 7]); ctx.lineDashOffset = -g.time * 30;
            ctx.strokeStyle = U.rgba(GOLD, 0.16 + 0.3 * k); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, Math.max(a.y, b.y) + 40, b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
            const u = U.clamp(since / 0.3, 0, 1), m = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + 40 };
            if (u < 1) { const x = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * m.x + u * u * b.x, y = (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * m.y + u * u * b.y; K.glow(ctx, x, y, 9, GOLDL, 0.8 * (1 - u)); }
          }
        }
      });
      // a quarter note pops above it on the beat
      if (k > 0.02) { ctx.globalAlpha = fade * k; noteGlyph(ctx, q.x + (q.facing || 1) * -6, q.y - q.h - 18 - (1 - k) * 14, 0.62 + 0.25 * k, down ? GOLDL : '#ffffff'); }
      ctx.restore();
    }
  }

  /* ================================ SFX ================================ */
  const AK = () => G.AudioKit;
  Object.assign(G.SFX, {
    // hushlings: a held breath, paper skittering, the little gasp before they jump at you
    c8_hushVoice(t) { const A = AK(); A.noise(t, 0.16, 0.05, 0.12, 'bandpass', 900, 2600, 2.2, 0.5); A.tone('sine', A.mtof(91 + (Math.random() * 3 | 0)), t + 0.05, 0.03, 0.012, 0.25, { wet: 0.8 }); },
    c8_skitter(t, k = 1) { const A = AK(); for (let i = 0; i < 5; i++) A.noise(t + i * 0.035, 0.002, 0.06 * k, 0.03, 'highpass', 3800 + i * 300, null, 0.8, 0.1); },
    c8_gasp(t) { const A = AK(); A.noise(t, 0.22, 0.09, 0.05, 'bandpass', 700, 3200, 2.5, 0.4); A.tone('sine', A.mtof(86), t + 0.2, 0.01, 0.02, 0.2, { to: A.mtof(91), wet: 0.7 }); },
    c8_cling(t) { const A = AK(); A.noise(t, 0.004, 0.18, 0.16, 'bandpass', 2400, 900, 1.2, 0.2); A.noise(t + 0.03, 0.01, 0.1, 0.25, 'highpass', 5000, 2500, 0.7, 0.3); A.tone('sine', 140, t, 0.004, 0.12, 0.16, { to: 80 }); },
    c8_drain(t) { const A = AK(); A.noise(t, 0.25, 0.035, 0.3, 'bandpass', 2600, 700, 3, 0.6); },
    c8_shake(t) { const A = AK(); A.noise(t, 0.004, 0.22, 0.24, 'highpass', 2200, 6000, 0.7, 0.25); A.noise(t + 0.05, 0.004, 0.14, 0.2, 'bandpass', 1600, 600, 1.4, 0.2); A.tone('sine', A.mtof(84), t + 0.04, 0.005, 0.03, 0.35, { to: A.mtof(72), wet: 0.6 }); },
    // the conductor: two dry taps of a baton on a stand, and a breath of strings
    c8_condVoice(t) { const A = AK(); A.noise(t, 0.001, 0.12, 0.02, 'bandpass', 3200, null, 4, 0.2); A.noise(t + 0.12, 0.001, 0.12, 0.02, 'bandpass', 3200, null, 4, 0.2); A.stringVoice(A.mtof(62), t + 0.2, 0.7, 0.05, A.sfxBus, 1100); A.stringVoice(A.mtof(69), t + 0.22, 0.7, 0.04, A.sfxBus, 1100); },
    c8_tick(t) { const A = AK(); A.noise(t, 0.001, 0.05, 0.015, 'bandpass', 2600, null, 5, 0.3); A.tone('sine', A.mtof(98), t, 0.002, 0.012, 0.08, { wet: 0.6 }); },
    c8_baton(t, k = 1) { const A = AK(); A.noise(t, 0.03, 0.16 * k, 0.12, 'bandpass', 1800, 5200, 1.1, 0.2); A.bell(A.mtof(88 + (Math.random() * 4 | 0) * 2), t + 0.05, 0.03 * k, 0.6, 0.6, 1); },
    c8_bladeRise(t) { const A = AK(); A.tone('sawtooth', 220, t, 0.5, 0.025, 0.4, { to: 880, filter: 'bandpass', ff: 1800, q: 4, wet: 0.6 }); A.bell(A.mtof(81), t, 0.03, 1.2, 0.8, 0.5); },
    c8_downbeat(t) { const A = AK(); A.drum('timpani', t, 1.0, A.sfxBus); A.tone('sine', 55, t, 0.004, 0.5, 0.9, { to: 34 }); A.noise(t, 0.002, 0.4, 0.5, 'lowpass', 2400, 200, 0.7, 0.4); A.bell(A.mtof(50), t, 0.08, 2.2, 0.8, 0.5); },
    // the cadence knight: plate and a low brass chord; IV – V – I on its three blows
    c8_knightVoice(t) { const A = AK(); A.noise(t, 0.08, 0.06, 0.3, 'bandpass', 500, 300, 2, 0.3); A.brassVoice(A.mtof(43), t + 0.05, 0.7, 0.07, A.sfxBus); A.brassVoice(A.mtof(50), t + 0.05, 0.7, 0.05, A.sfxBus); },
    c8_cadence(t, n = 0) {
      const A = AK(), ch = [[53, 57, 60, 65], [55, 59, 62, 67], [48, 55, 60, 64]][n] || [48, 55, 60, 64];
      ch.forEach((m, i) => A.brassVoice(A.mtof(m), t + i * 0.012, n === 2 ? 1.6 : 0.7, n === 2 ? 0.06 : 0.04, A.sfxBus));
      if (n === 2) { A.drum('timpani', t, 1, A.sfxBus); A.tone('sine', 48, t, 0.003, 0.5, 0.7, { to: 30 }); }
    },
    c8_plate(t) { const A = AK(); A.tone('sine', 62, t, 0.004, 0.18, 0.25, { to: 40 }); A.noise(t, 0.002, 0.06, 0.08, 'bandpass', 2600, 1800, 3, 0.1); },
    c8_wall(t) { const A = AK(); A.tone('sine', 90, t, 0.004, 0.32, 0.3, { to: 50 }); A.bell(A.mtof(57), t, 0.06, 1.2, 0.5, 0.6); A.noise(t, 0.002, 0.16, 0.15, 'lowpass', 1600, 300, 0.7, 0.1); },
    c8_clang(t) { const A = AK(); A.bell(A.mtof(93), t, 0.06, 0.6, 0.4, 1.3); A.noise(t, 0.001, 0.2, 0.06, 'highpass', 4000, null, 0.7, 0.2); },
    c8_shatter(t) { const A = AK(); A.noise(t, 0.002, 0.3, 0.4, 'highpass', 3000, 1200, 0.7, 0.3); [96, 91, 88, 84].forEach((m, i) => A.bell(A.mtof(m), t + i * 0.03, 0.04, 0.6, 0.6, 1.2)); A.tone('sine', 70, t, 0.003, 0.3, 0.3, { to: 40 }); },
    // the coda serpent: a dry hiss, a gilt glissando; ink that splashes like water
    c8_codaVoice(t) { const A = AK(); A.noise(t, 0.05, 0.08, 0.5, 'highpass', 3000, 7000, 0.7, 0.3); [79, 83, 86, 91].forEach((m, i) => A.bell(A.mtof(m), t + 0.1 + i * 0.05, 0.02, 0.9, 0.7, 0.6)); },
    c8_burrow(t) { const A = AK(); A.noise(t, 0.01, 0.22, 0.45, 'lowpass', 900, 150, 0.8, 0.3); A.tone('sine', 70, t, 0.02, 0.18, 0.5, { to: 38 }); },
    c8_rumble(t) { const A = AK(); A.noise(t, 0.1, 0.06, 0.4, 'lowpass', 260, 120, 0.8, 0.2); },
    c8_erupt(t) { const A = AK(); A.noise(t, 0.004, 0.35, 0.5, 'lowpass', 2600, 300, 0.7, 0.3); A.tone('sine', 52, t, 0.004, 0.45, 0.6, { to: 30 }); [62, 69, 74, 81].forEach((m, i) => A.bell(A.mtof(m), t + i * 0.025, 0.04, 1.4, 0.8, 0.6)); },
    c8_note(t, n = 0) { const A = AK(), sc = [74, 77, 81, 79, 77, 76, 74, 72, 74, 69]; const m = sc[n % sc.length] + 12; A.bell(A.mtof(m), t, 0.035, 0.9, 0.6, 0.6); A.tone('sine', A.mtof(m), t, 0.004, 0.03, 0.4, { wet: 0.6 }); },
    c8_tail(t) { const A = AK(); A.noise(t, 0.12, 0.18, 0.2, 'bandpass', 300, 1400, 1.0, 0.15); },
    // the First Descent: masks that muffle a war-cry, a war drum, a bell
    c8_squadVoice(t, p = 1) { const A = AK(); A.noise(t, 0.12, 0.07, 0.35, 'bandpass', 420 * p, 260 * p, 1.6, 0.4); A.tone('sawtooth', 98 * p, t, 0.1, 0.03, 0.5, { to: 87 * p, filter: 'lowpass', ff: 500, wet: 0.4 }); },
    c8_drum(t, k = 1) { const A = AK(); A.drum('kick', t, 0.9 * k, A.sfxBus); A.drum('tom', t + 0.01, 0.6 * k, A.sfxBus); A.tone('sine', 58, t, 0.004, 0.35 * k, 0.5, { to: 40 }); },
    c8_chime(t) { const A = AK(); [81, 85, 88, 93].forEach((m, i) => A.bell(A.mtof(m), t + i * 0.06, 0.05, 2.2, 0.8, 0.8)); A.choirVoice(A.mtof(69), t + 0.1, 1.2, 0.02, A.sfxBus); },
    c8_empower(t) { const A = AK(); A.bell(A.mtof(86), t, 0.06, 1.4, 0.7, 1); A.bell(A.mtof(87), t + 0.01, 0.05, 1.4, 0.7, 1); A.tone('sawtooth', A.mtof(62), t, 0.05, 0.03, 0.6, { filter: 'lowpass', ff: 900, wet: 0.5 }); },
    c8_heal(t) { const A = AK(); [76, 81, 85, 88].forEach((m, i) => A.tone('sine', A.mtof(m), t + i * 0.07, 0.02, 0.025, 0.7, { wet: 0.8 })); },
    c8_flag(t) { const A = AK(); A.noise(t, 0.03, 0.12, 0.3, 'bandpass', 700, 1600, 0.9, 0.2); A.tone('sine', 80, t + 0.05, 0.003, 0.3, 0.3, { to: 45 }); },
    // death: a breath let out, then nothing but a high clean tone fading
    c8_silence(t, k = 1) { const A = AK(); A.noise(t, 0.02, 0.1 * k, 0.5, 'bandpass', 2400, 600, 1.2, 0.6); A.tone('sine', A.mtof(100), t + 0.05, 0.05, 0.02 * k, 1.2, { wet: 0.9 }); A.tone('sine', 120, t, 0.004, 0.12 * k, 0.25, { to: 60 }); },
  });

  /* ================================ shared drawing: the stage cut-out ================================ */
  // the foe is rendered once into an offscreen buffer at its on-screen scale, washed toward paper-white there, and
  // (dying) cut away in flakes from the top; costs one buffer draw while spawning / dying only
  const OFF = { cv: null, cx: null };
  function offscreen(w, h) {
    if (!OFF.cv) { OFF.cv = document.createElement('canvas'); OFF.cx = OFF.cv.getContext('2d'); }
    if (OFF.cv.width < w || OFF.cv.height < h) { OFF.cv.width = Math.max(OFF.cv.width, w); OFF.cv.height = Math.max(OFF.cv.height, h); }
    return OFF;
  }
  function boundsOf(e) {
    const s = e.T.scale || 1, bw = (Math.max(e.T.w, 50) * 1.3 + (e.T.reachPad || 90)) * s;
    return { x0: e.x - bw, x1: e.x + bw, y0: e.y - (e.T.h * s + (e.T.topPad || 70)), y1: e.y + 30 };
  }
  function blanched(ctx, e, raw, white, cut) {
    const m = ctx.getTransform(), b = boundsOf(e);
    const cs = [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].map(([x, y]) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }));
    const dx0 = Math.floor(Math.min(...cs.map((q) => q.x))), dy0 = Math.floor(Math.min(...cs.map((q) => q.y)));
    const W = Math.ceil(Math.max(...cs.map((q) => q.x))) - dx0, H = Math.ceil(Math.max(...cs.map((q) => q.y))) - dy0;
    if (!(W > 0 && H > 0) || W > 2400 || H > 2400 || typeof document === 'undefined') return false;
    const O = offscreen(W, H), oc = O.cx;
    oc.setTransform(1, 0, 0, 1, 0, 0); oc.globalCompositeOperation = 'source-over'; oc.globalAlpha = 1; oc.clearRect(0, 0, W, H);
    oc.save(); oc.setTransform(m.a, m.b, m.c, m.d, m.e - dx0, m.f - dy0);
    try { raw(oc, e, false); } finally { oc.restore(); }
    oc.setTransform(1, 0, 0, 1, 0, 0);
    if (white > 0.005) { oc.globalCompositeOperation = 'source-atop'; oc.fillStyle = `rgba(255,251,242,${Math.min(1, white)})`; oc.fillRect(0, 0, W, H); }
    if (cut > 0) {
      // a ragged tear line sinks down the figure; above it everything is gone, just below it flakes come loose
      oc.globalCompositeOperation = 'destination-out'; oc.fillStyle = '#000';
      const yl = U.lerp(-8, H + 8, cut), sc = Math.abs(m.a) || 1;
      oc.beginPath(); oc.moveTo(0, 0); oc.lineTo(W, 0);
      for (let x = W; x >= -8; x -= 8 * sc) oc.lineTo(x, yl + (hash(Math.floor(x / (8 * sc)), e.seed || 1) - 0.5) * 16 * sc + Math.sin(x * 0.05 / sc) * 6 * sc);
      oc.closePath(); oc.fill();
      for (let i = 0; i < 46; i++) {
        const fx = hash(i, (e.seed || 1) + 3) * W, fy = yl + hash(i, (e.seed || 1) + 9) * 46 * sc, r = (1.5 + hash(i, 5) * 3.5) * sc;
        oc.save(); oc.translate(fx, fy); oc.rotate(hash(i, 11) * 3); oc.fillRect(-r, -r * 0.6, r * 2, r * 1.2); oc.restore();
      }
    }
    oc.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(O.cv, 0, 0, W, H, dx0, dy0, W, H); ctx.restore();
    return true;
  }
  // spawn: it pops up out of the stage floor like a cut-out in a pop-up book, white first, then inked
  function spawnDraw(ctx, e, raw) {
    const p = U.clamp(e.st / (e.T.spawnT || 0.7), 0, 1), s = e.T.scale || 1;
    const fl = e.fly ? e.y : floorAt(e.x, e.y - 8, e.y), w = (e.T.w * 0.9 + 26) * s;
    // the slot in the floor it rises through: a paper card with an ink edge and a gilt seam
    ctx.save();
    const sw = w * (p < 0.15 ? U.easeOutCubic(p / 0.15) : 1 - U.clamp((p - 0.7) / 0.3, 0, 1) * 0.7);
    ctx.fillStyle = 'rgba(255,251,242,0.85)'; ctx.beginPath(); ctx.ellipse(e.x, fl - 1, sw, 4, 0, 0, TAU); ctx.fill(); ink(ctx, 1);
    lighter(ctx, () => { ctx.strokeStyle = U.rgba(GOLD, 0.8 * (1 - p)); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(e.x, fl - 1, sw * (0.7 + 0.6 * p), 3 + 5 * p, 0, 0, TAU); ctx.stroke(); });
    ctx.restore();
    const sy = Math.max(0.02, U.easeOutBack(U.clamp(p * 1.15, 0, 1))), pivot = e.fly ? e.y - e.T.h * s * 0.5 : e.y;
    ctx.save();
    ctx.translate(e.x, pivot); ctx.scale(1 + (1 - sy) * 0.15, sy); ctx.translate(-e.x, -pivot);
    const white = 1 - U.clamp((p - 0.25) / 0.6, 0, 1);
    if (low() || !blanched(ctx, e, raw, white, 0)) { ctx.globalAlpha *= U.clamp(p * 2, 0, 1); raw(ctx, e, false); }
    ctx.restore();
  }
  // death: it blanches to paper-white, a tear runs down it and the flakes drift up into silence
  function dieDraw(ctx, e, raw) {
    const g = G.game, k = U.clamp(e.st / 0.5, 0, 1), s = e.T.scale || 1;
    if (!e._silent) {
      e._silent = true;
      G.SFX.play('c8_silence', e.T.elite ? 1.4 : 1);
      G.FX.ring(e.x, e.y - e.T.h * s * 0.5, 8, (e.T.elite ? 200 : 120) * s, 0.7, '#ffffff', 2, {});
      G.FX.flash(e.x, e.y - e.T.h * s * 0.5, 90 * s, 0.3, '#fffaf0');
    }
    const white = U.clamp(e.st / 0.14, 0, 1), cut = U.clamp((e.st - 0.1) / 0.38, 0, 1);
    ctx.save();
    if (low() || !blanched(ctx, e, raw, white, cut)) {
      ctx.globalAlpha *= 1 - cut;
      const b = boundsOf(e); ctx.beginPath(); ctx.rect(b.x0, U.lerp(b.y0, b.y1, cut), b.x1 - b.x0, b.y1 - b.y0 + 40); ctx.clip();
      raw(ctx, e, false);
    }
    ctx.restore();
    if (g.dtVis > 0 && cut > 0 && cut < 1) {
      const b = boundsOf(e), y = U.lerp(b.y0 + 30, e.y, cut);
      G.FX.ember(e.x, y, low() ? 1 : 3, '#ffffff', { w: e.T.w * 1.4 * s, h: 8, up: 90, sp: 50, life: 0.9 });
      if (Math.random() < 0.5) G.FX.ember(e.x, y, 1, GOLDL, { w: e.T.w * s, h: 8, up: 60, sp: 30, life: 0.7 });
    }
    // a soft paper-white bloom where it stood, fading with it
    glow(ctx, e.x, e.y - e.T.h * s * 0.45, (e.T.h * 0.6 + 30) * s, SIL, 0.35 * (1 - k));
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
  // registers a type: per-frame housekeeping, the pop-up spawn, the white-silence death, ?hb=1 hit boxes
  function reg(id, T) {
    const raw = T.draw;
    T.col = T.col || SIL;
    T.draw = function (ctx, e, ghost) {
      const g = G.game;
      if (!ghost && g.dtVis > 0 && T.tick) T.tick(e, g.dtVis);
      if (Cling.hidden(e)) return;
      if (e.state === 'die') { if (!ghost) dieDraw(ctx, e, raw); return; }
      if (e.state === 'spawn' && !ghost) { spawnDraw(ctx, e, raw); return; }
      ctx.save(); raw(ctx, e, ghost); ctx.restore();
      if (DEBUG_HB && !ghost) drawBoxes(ctx, e);
    };
    TYPES[id] = T;
    return T;
  }
  // a red copy of an attack (the bell's gift): same reach, every tell red and every blow unblockable — and the wind-up
  // held HOLD s longer after the tell, so a red blow always gets at least 0.6 s of warning
  function redOf(def) {
    if (def.red) return def.red;
    const HOLD = 0.12, sh = (t) => (t > 0.001 ? t + HOLD : t);
    const r = Object.assign({}, def, { isRed: true, dur: def.dur + HOLD });
    r.tells = (def.tells || []).map((t) => Object.assign({}, t, { c: 'red' }));
    r.hits = (def.hits || []).map((h) => Object.assign({}, h, { red: true, t0: h.t0 + HOLD, t1: h.t1 + HOLD }));
    r.moves = (def.moves || []).map((m) => Object.assign({}, m, { t0: m.t0 + HOLD, t1: m.t1 + HOLD }));
    r.ev = (def.ev || []).map((v) => Object.assign({}, v, { t: sh(v.t) }));
    if (def.anim) r.anim = Object.assign({}, def.anim, { keys: def.anim.keys.map((k, i) => (i ? [k[0] + HOLD, k[1], k[2]] : k)) });
    def.red = r; r.white = def;
    return r;
  }

  /* =========================================================================================
     c8_hushling 噤聲童影 HUSHLING — Mira's frightened memories of other children: paper-doll shapes cut from the
     stage, featureless, both hands pressed over their mouths. They are holding their breath. They come in swarms of
     3–5, always looking at you, darting between places round you in frozen little bursts.
     lunge  (white — a low skittering dive; parry it and the child is dazed)
     cling  (white — a hop with arms flung open; if it catches you it holds on: invulnerable while it clings, it drains
             your stamina and drags your step — DODGE to shake every clinger off, flinging them dazed to the floor)
     At most two of a swarm wind up at once, never closer than 0.32 s apart.
     ========================================================================================= */
  const swarm = () => G.game.enemies.filter((q) => q.type === 'c8_hushling' && !q.dead);
  let HUSH_LAST = -9;
  const HZ0 = { lean: 0.06, crouch: 0.12, free: 0, hFx: 10, hFy: 6, hBx: -8, hBy: 8, head: 0.08, str: 1, legA: 0, hop: 0, puff: 1, sit: 0 };
  const HZ = {
    idle: (t, s) => ({ lean: 0.05 + Math.sin(t * 2.4 + s) * 0.035, crouch: 0.14 + Math.sin(t * 4.6 + s) * 0.04, head: 0.1 + Math.sin(t * 1.7 + s) * 0.07 }),
    run: () => ({ lean: 0.3, crouch: 0.22, legA: 1, head: -0.05 }),
    hurt: { lean: -0.62, crouch: 0.25, free: 1, hFx: -6, hFy: -17, hBx: -12, hBy: -11, head: -0.45, puff: 0 },
    broken: (t) => ({ lean: 0.42 + Math.sin(t * 2) * 0.05, crouch: 1, sit: 1, free: 0.35, hFx: 12, hFy: 12, hBx: 8, hBy: 14, head: 0.55 + Math.sin(t * 1.4) * 0.08, puff: 0.3 }),
    hold: { lean: 0.16, crouch: 0.35, free: 1, hFx: 17, hFy: -3, hBx: 15, hBy: 0, head: 0.42, hop: 0.75, puff: 1 },
  };
  const LUNGE_K = [
    [0, {}], [0.12, { lean: -0.2, crouch: 0.55, free: 0.6, hFx: -10, hFy: 2, hBx: -12, hBy: 4, head: 0.22 }, 'out'],
    [0.55, { lean: -0.05, crouch: 0.85, free: 1, hFx: -16, hFy: 6, hBx: -18, hBy: 3, head: 0.3 }],
    [0.62, { lean: 1.25, crouch: 0, free: 1, hFx: 23, hFy: 0, hBx: 20, hBy: 4, head: -0.35, str: 1.18, puff: 0, legA: 0, hop: 0.5 }, 'snap'],
    [0.76, { lean: 1.1, crouch: 0, free: 1, hFx: 22, hFy: 2, hBx: 19, hBy: 5, head: -0.3, str: 1.1, puff: 0, hop: 0.3 }],
    [0.9, { lean: 0.35, crouch: 0.6, free: 0.5, hFx: 6, hFy: 10, hBx: 2, hBy: 10, head: 0.2, puff: 0.2 }],
    [1.05, { puff: 1 }],
  ];
  const CLING_K = [
    [0, {}], [0.14, { lean: -0.12, crouch: 0.6, free: 1, hFx: 5, hFy: -20, hBx: -5, hBy: -21, head: -0.3, puff: 0.6 }, 'out'],
    [0.55, { lean: -0.06, crouch: 0.9, free: 1, hFx: 9, hFy: -25, hBx: -2, hBy: -26, head: -0.42, puff: 0.6 }],
    [0.64, { lean: 0.45, crouch: 0, free: 1, hFx: 19, hFy: -14, hBx: 14, hBy: -17, head: -0.1, hop: 1, puff: 0.6 }, 'snap'],
    [0.98, { lean: 0.3, crouch: 0.2, free: 1, hFx: 18, hFy: -8, hBx: 13, hBy: -11, head: 0.05, hop: 0.6 }],
    [1.14, { lean: 0.15, crouch: 0.55, free: 0.4, hFx: 8, hFy: 8, hBx: 4, hBy: 8, hop: 0 }],
    [1.3, {}],
  ];
  function hop(e) {
    const P = e.P; e.faceP();
    e.hopV = e.facing * U.clamp((Math.abs(P.x - e.x) - 2) / 0.3, 120, 640); e.vy = -420;
    G.SFX.play('c8_skitter', 1.1);
  }
  function grab(e) {
    const P = e.P, g = G.game;
    const res = P.receiveHit(e, { dmg: 5, kb: 30, hx: e.x, hy: e.y - 30 * e.sc });
    if (res === 'hit') {
      const slot = Cling.freeSlot();
      if (slot < 0 || P.hp <= 0) return;                  // nowhere left to hold on: it only bumped her
      e.cling = { slot, t0: g.time, front: SLOTS[slot].front, hug: SLOTS[slot].hug, drainT: 0.2 };
      e.invuln = true; e.fly = true; e.vx = 0; e.vy = 0;
      e.atk = HU.hold; e.setState('atk'); e.hitsDone = {}; e.tellsDone = {}; e.evDone = {};
      Cling.ensure();
      G.SFX.play('c8_cling'); g.shake(0.15);
      g.hint('c8_cling');
      if (g.time - (Cling.toldT || -9) > 6) { Cling.toldT = g.time; G.FX.text(P.x, P.y - 150, '— 屏 息 —', '#fff4d8', 15, 0.9); }
    } else if (res === 'parried') e.onParried({ dmg: 5, pbal: 40, last: true });
    else if (res === 'blocked') {
      e.atk = null; e.setState('hurt'); e.hurtDur = 0.45; e.vx = -e.facing * 220; e.vy = -200;
      G.FX.ember(e.x, e.y - 30, 4, '#ffffff', { w: 16, h: 20, up: 80, sp: 90, life: 0.4 });
    }
  }
  // the clinger lets go — shaken off by a dodge (dazed, flung behind her) or dropping off by itself
  function letGo(e, how) {
    const P = e.P, shake = how === 'shake';
    e.cling = null; e.invuln = false; e.fly = false; e.atk = null;
    e.setState('hurt'); e.hurtDur = shake ? 0.95 : 0.35;
    const dir = shake ? -(P.dodgeDir || P.facing) : (Math.sign(e.x - P.x) || -P.facing);
    e.vx = dir * (shake ? 300 + Math.random() * 140 : 180); e.vy = shake ? -330 - Math.random() * 80 : -200;
    e.facing = -dir;
    e.clingCd = shake ? 3.2 : 1.6; e.cd = Math.max(e.cd, 0.9);
    if (shake) {
      G.SFX.play('c8_shake');
      G.FX.ember(e.x, e.y - 30, 7, '#ffffff', { w: 26, h: 30, up: 120, sp: 160, life: 0.6 });
      G.FX.ring(e.x, e.y - 30, 4, 44, 0.3, '#ffffff', 2);
    }
    if (!Cling.list().length) Cling.release();
  }
  function holdUpdate(e, dt) {
    const P = e.P, c = e.cling, g = G.game;
    if (!c) { e.atk = null; e.setState('idle'); return; }
    if (P.state === 'dodge' || P.state === 'skill1') { letGo(e, 'shake'); return; }
    if (P.state === 'dead' || P.state === 'execute' || P.state === 'rest' || P.state === 'cine' || P.hp <= 0 || g.time - c.t0 > 3.6) { letGo(e, 'drop'); return; }
    const S = SLOTS[c.slot];
    e.facing = S.front ? -P.facing : P.facing;
    e.x = P.x + P.facing * S.x; e.y = P.y + (S.hug === 'leg' ? -6 : S.hug === 'waist' ? -36 : -62) + Math.sin(e.t * 9 + e.seed) * 1.2;
    e.vx = 0; e.vy = 0;
    // it drinks her breath: her stamina drains (never below 1 — she can always dodge) and her step drags
    if (P.sta > 1) P.sta = Math.max(1, P.sta - 20 * dt);
    P.staDelay = Math.max(P.staDelay || 0, 0.3);
    if (Math.abs(P.vx) > 1) P.x -= P.vx * dt * 0.13;
    c.drainT -= dt; if (c.drainT <= 0) { c.drainT = 0.55; G.SFX.play('c8_drain'); }
  }

  // a paper mitten, oriented along the forearm
  function mitten(ctx, hd, ang, hex, r) {
    ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.8); ctx.quadraticCurveTo(r * 0.4, -r * 1.25, r * 1.25, -r * 0.45); ctx.quadraticCurveTo(r * 1.6, r * 0.35, r * 0.9, r * 0.9);
    ctx.quadraticCurveTo(0, r * 1.25, -r * 0.9, r * 0.75); ctx.closePath();
    ctx.fillStyle = cel(ctx, 0, 0, 0.6, -0.8, r * 1.3, hex); ctx.fill(); ink(ctx, 1.15);
    ctx.strokeStyle = 'rgba(11,6,18,0.45)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(r * 0.35, -r * 0.7); ctx.lineTo(r * 0.75, r * 0.15); ctx.moveTo(r * 0.85, -r * 0.45); ctx.lineTo(r * 1.15, r * 0.3); ctx.stroke();
    ctx.restore();
  }
  // paper-doll child, facing +x, feet at 0, ~58 tall at scale 1
  function hushBody(ctx, e, z, ghost) {
    const s = e.sc, t = e.t;
    ctx.translate(e.x, e.y); ctx.scale(e.facing * s, s);
    ctx.translate(z.puff * Math.sin(t * 47 + e.seed) * 0.35, 0);                    // the tremble of a held breath
    if (z.str !== 1) ctx.scale(z.str, 1 / Math.sqrt(z.str));
    const L = z.lean, ux = Math.sin(L), uy = -Math.cos(L), nx = -uy, ny = ux;
    const hip = { x: -z.sit * 2, y: -17 + z.crouch * 7 + z.sit * 9 - z.hop * 5 };
    const sh = { x: hip.x + ux * 15, y: hip.y + uy * 15 };
    const B = (a, b) => ({ x: sh.x + a * nx - b * ux, y: sh.y + a * ny - b * uy });       // a: toward front, b: down the body
    const HA = L + z.head, hc = { x: sh.x + Math.sin(HA) * 12, y: sh.y - Math.cos(HA) * 12 };
    const Hd = (a, b) => ({ x: hc.x + a * Math.cos(HA) - b * Math.sin(HA), y: hc.y + a * Math.sin(HA) + b * Math.cos(HA) });
    // feet: scissoring strides, a wide crouch, tucked when airborne, out in front when sitting dazed
    const ph = e.gait;
    let fF = { x: 3 + Math.sin(ph) * 7 * z.legA + z.crouch * 3, y: -Math.max(0, Math.cos(ph)) * 4 * z.legA };
    let fB = { x: -3 - Math.sin(ph) * 7 * z.legA - z.crouch * 4, y: -Math.max(0, -Math.cos(ph)) * 4 * z.legA };
    if (z.hop > 0) { fF = lp(fF, { x: hip.x + 5, y: hip.y + 10 }, z.hop); fB = lp(fB, { x: hip.x - 6, y: hip.y + 8 }, z.hop); }
    if (z.sit > 0) { fF = lp(fF, { x: 12, y: -1.5 }, z.sit); fB = lp(fB, { x: 7, y: -1 }, z.sit); }
    const leg = (side, foot, hex) => {
      const h0 = { x: hip.x + side * 2.6 * nx, y: hip.y + side * 2.6 * ny }, m = lp(h0, foot, 0.5), kn = { x: m.x + 2 + z.crouch * 3, y: m.y };
      LC(ctx, [h0, kn, foot], [3.4, 3.0, 2.6], hex);
      ctx.beginPath(); ctx.ellipse(foot.x + 2.2, foot.y - 1.6, 4.4, 2.7, 0, 0, TAU); ctx.fillStyle = cel(ctx, foot.x + 2, foot.y - 2, 0.6, -0.8, 4, hex === PAP ? HAIR : PAPS); ctx.fill(); ink(ctx, 1.2);
    };
    const shF = B(4.2, 2.2), shB = B(-3.6, 2.4);
    // hands at rest are pressed over where a mouth would be — the far one under the near one
    const faceF = Hd(9.6, 4.8), faceB = Hd(8.4, 7.4);
    const Fr = (a, b) => ({ x: sh.x + a * Math.cos(L) - b * Math.sin(L), y: sh.y + a * Math.sin(L) + b * Math.cos(L) });
    const hdF = lp(faceF, Fr(z.hFx, z.hFy), z.free), hdB = lp(faceB, Fr(z.hBx, z.hBy), z.free);
    const atFace = z.free < 0.5;
    const elbow = (s0, hd, k) => {
      const m = lp(s0, hd, 0.5), dx = hd.x - s0.x, dy = hd.y - s0.y, d = Math.hypot(dx, dy) || 1, bend = (Math.max(0, 17 - d) * 0.6 + 1.5) * k;
      return { x: m.x - (dy / d) * bend, y: m.y + (dx / d) * bend };
    };
    const armL = (s0, hd, hex, k) => { const el = elbow(s0, hd, k); LC(ctx, [s0, el, hd], [3.0, 2.6, 2.3], hex); return Math.atan2(hd.y - el.y, hd.x - el.x); };
    // the far side first: leg, arm
    leg(-1, fB, PAPS);
    const angB = armL(shB, hdB, PAPS, 0.85);
    if (!atFace) mitten(ctx, hdB, angB, PAPS, 3.4);
    leg(1, fF, PAP);
    // the smock: an A-line cut with pinking-shear teeth along the hem, a fold down its middle
    const fl = 1.5 + z.legA * 1.5 + z.hop * 2.5 + Math.sin(t * 6 + e.seed) * 0.6;
    const hem = []; const n = 7;
    for (let i = 0; i <= n; i++) { const a = U.lerp(12 + fl, -12 - fl, i / n); hem.push(B(a, 18.5 - (i % 2) * 2.6 + Math.sin(t * 8 + i) * 0.4 * z.legA)); }
    const smock = [B(-3.6, -0.6), B(3.6, -0.6), B(7.8, 3.4), ...hem, B(-7.8, 3.4)];
    polyP(ctx, smock);
    const mid = B(0, 9); ctx.fillStyle = cel(ctx, mid.x, mid.y, nx, ny, 13, PAP); ctx.fill(); ink(ctx, 1.8);
    ctx.save(); polyP(ctx, smock); ctx.clip();
    line(ctx, B(0.4, 1), B(1.2, 18), 'rgba(120,104,150,0.3)', 0.9);                    // the fold
    line(ctx, B(-12, 15.2), B(12, 15.2), 'rgba(120,104,150,0.16)', 0.8);
    ctx.restore();
    for (const sd of [1, -1]) { const c = B(sd * 2.4, 1.2); ctx.beginPath(); ctx.ellipse(c.x, c.y, 3.4, 2.2, L, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, 0.9); }
    // the head: featureless, cheeks puffed with the breath it will not let out
    const pf = z.puff;
    const hp = [Hd(-1, -12), Hd(7.6, -8.6), Hd(10.6, -1.2), Hd(10.8 + pf * 1.4, 4.8), Hd(5.4, 10.8), Hd(-2.6, 11.2), Hd(-9.4, 6.2), Hd(-11.4, -1.6), Hd(-8.2, -9.2)];
    smoothP(ctx, hp); ctx.fillStyle = cel(ctx, hc.x, hc.y, Math.cos(HA), Math.sin(HA), 12, PAP); ctx.fill(); ink(ctx, 2);
    ctx.save(); smoothP(ctx, hp); ctx.clip();
    // where a face would be: only a soft lilac hollow at the eyes, a gilt warmth on the puffed cheek
    const ey = Hd(5.8, -1.2); ctx.fillStyle = 'rgba(150,132,180,0.2)'; ctx.beginPath(); ctx.ellipse(ey.x, ey.y, 4.4, 2, HA, 0, TAU); ctx.fill();
    if (pf > 0.1) { const ck = Hd(5.6, 4.2); ctx.fillStyle = U.rgba(GOLD, 0.25 * pf); ctx.beginPath(); ctx.ellipse(ck.x, ck.y, 3.6, 2.6, HA, 0, TAU); ctx.fill(); }
    ctx.restore();
    // cut-paper hair: a rounded bob with a blunt fringe (or a beret), one of four cuts
    const hv = e.var;
    if (hv !== 2) {
      const bob = [Hd(7.4, -4.4), Hd(8.2, -8.8), Hd(2.6, -13.4), Hd(-5.6, -13.2), Hd(-11.6, -7.4), Hd(-13, 1.2), Hd(-11.8, 8.2), Hd(-7.4, 8.6), Hd(-6.6, 2.6), Hd(-2.4, -3.2)];
      ctx.beginPath(); ctx.moveTo(bob[0].x, bob[0].y);
      for (let i = 1; i < 8; i++) { const m = lp(bob[i], bob[i + 1], 0.5); ctx.quadraticCurveTo(bob[i].x, bob[i].y, m.x, m.y); }
      ctx.lineTo(bob[8].x, bob[8].y); ctx.lineTo(bob[9].x, bob[9].y); ctx.closePath();
      ctx.fillStyle = cel(ctx, hc.x, hc.y - 4, Math.cos(HA), Math.sin(HA), 12, HAIR); ctx.fill(); ink(ctx, 1.5);
      ctx.strokeStyle = 'rgba(120,100,130,0.4)'; ctx.lineWidth = 0.8; ctx.beginPath();
      for (const k of [0.3, 0.55, 0.8]) { const a = Hd(U.lerp(4, -10, k), -12 + k * 2), b = Hd(U.lerp(-1, -9, k), 2 + k * 4); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      ctx.stroke();
    }
    if (hv === 1) for (const q of [Hd(-11.4, -9.8), Hd(-14, -2.4)]) { ctx.beginPath(); ctx.ellipse(q.x, q.y, 3.8, 2.9, HA - 0.6, 0, TAU); ctx.fillStyle = cel(ctx, q.x, q.y, 0.6, -0.8, 3.8, HAIR); ctx.fill(); ink(ctx, 1.1); }
    if (hv === 2) {
      // a paper beret over a short crop
      const crop = [Hd(7, -5.6), Hd(4, -11), Hd(-6, -11.4), Hd(-11.6, -4), Hd(-10.6, 4), Hd(-6.6, 3.4), Hd(-2.6, -4.4)];
      smoothP(ctx, crop); ctx.fillStyle = cel(ctx, hc.x, hc.y, 0.6, -0.8, 10, HAIR); ctx.fill(); ink(ctx, 1.3);
      const bt = Hd(-1.5, -12.2);
      ctx.beginPath(); ctx.ellipse(bt.x, bt.y, 10.4, 3.8, HA - 0.16, 0, TAU); ctx.fillStyle = cel(ctx, bt.x, bt.y, 0.6, -0.8, 9, PAPS); ctx.fill(); ink(ctx, 1.4);
      const st = Hd(-1.2, -16.4); ctx.beginPath(); ctx.arc(st.x, st.y, 1.5, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    }
    if (hv === 3) {
      const bw = Hd(-9, -10);
      ctx.save(); ctx.translate(bw.x, bw.y); ctx.rotate(HA - 0.4);
      for (const sd of [1, -1]) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sd * 5, -6.4, sd * 7.8, -3.2); ctx.quadraticCurveTo(sd * 8.6, 2.6, 0, 0.6); ctx.closePath();
        ctx.fillStyle = cel(ctx, sd * 3, 0, 0.6, -0.8, 5, PAP); ctx.fill(); ink(ctx, 1.1);
      }
      ctx.beginPath(); ctx.arc(0, 0.2, 1.9, 0, TAU); ctx.fillStyle = GOLD; ctx.fill(); ink(ctx, 0.8);
      ctx.restore();
    }
    // the near arm last; at rest both mittens are clamped over its mouth
    const angF = armL(shF, hdF, PAP, 1);
    if (atFace) mitten(ctx, hdB, angB, PAPS, 3.6);
    mitten(ctx, hdF, angF, PAP, atFace ? 4.1 : 3.6);
    // the held breath: a gilt breath mark above the head (spent the instant it lunges, then slowly drawn again)
    const bm = Hd(-1, -23 - Math.sin(t * 2.2 + e.seed) * 1.6), ba = U.clamp(pf, 0, 1);
    if (ba > 0.05) {
      if (!ghost) glow(ctx, bm.x, bm.y, 13 + 6 * (e.cling ? 1 : 0), GOLD, (0.45 + (e.cling ? 0.4 : 0)) * ba);
      ctx.save(); ctx.globalAlpha *= ba; breathMark(ctx, bm.x, bm.y, 0.82 + 0.18 * ba, e.cling ? GOLDL : GOLD); ctx.restore();
    }
    return { hc, hdF, Hd };
  }

  const HU = reg('c8_hushling', {
    name: '噤聲童影', en: 'HUSHLING', w: 30, h: 58, hp: 70, bal: 34, col: '#fbf7ee', shards: 42, kbMul: 1.35, spawnT: 0.6,
    reachPad: 50, topPad: 40, portrait: [4.4, 0.86],
    init(e) {
      e.seed = seedOf(); e.sc = 0.98 + hash(e.seed, 1) * 0.13; e.var = e.seed % 4; e.gait = 0; e.cling = null; e.hopV = 0;
      e.clingCd = 0.8 + Math.random() * 1.2; e.cd = 0.5 + Math.random() * 1.3; e.slotT = 0;
    },
    voice: (e) => G.SFX.play(e.atk === HU.cling ? 'c8_gasp' : 'c8_hushVoice'),
    weapon: (e) => ({ x: e.x + e.facing * 12 * e.sc, y: e.y - 44 * e.sc }),
    think(e, dt) {
      const g = G.game, P = e.P, dx = P.x - e.x, d = Math.abs(dx);
      e.clingCd -= dt;
      const mates = swarm(), idx = Math.max(0, mates.indexOf(e));
      // each takes a place round her — alternate sides, staggered depths — and flits to a new one now and then
      if ((e.slotT -= dt) <= 0) {
        e.slotT = 1.3 + Math.random() * 1.7;
        e.side = (idx % 2 ? -1 : 1) * (Math.random() < 0.25 ? -1 : 1);
        e.want = 62 + ((idx + (Math.random() * 2 | 0)) % 3) * 44;
      }
      const tx = clampArena(e, P.x - e.side * e.want), ddx = tx - e.x;
      // it moves in darts: a quick burst, a frozen stop
      const burst = Math.pow(Math.max(0, Math.sin(e.t * 7.5 + e.seed)), 0.6);
      let v = Math.abs(ddx) > 12 ? Math.sign(ddx) * Math.min(330, 40 + Math.abs(ddx) * 3) * (0.25 + 0.75 * burst) : 0;
      for (const o of mates) if (o !== e && !o.cling && Math.abs(o.x - e.x) < 22) v += Math.sign(e.x - o.x || e.seed % 2 - 0.5) * 90;
      e.vx = U.approach(e.vx, v * e.speedMul, 2600 * dt);
      e.facing = dx < 0 ? -1 : 1;                        // they never look away from her
      if (e.cd > 0 || P.state === 'dead' || P.hp <= 0) return;
      const busy = mates.filter((o) => o.state === 'atk' && o.atk && !o.atk.hold).length;
      if (busy >= 2 || g.time - HUSH_LAST < 0.32) return;
      if (e.clingCd <= 0 && Cling.list().length < 3 && d > 60 && d < 230 && Math.random() < (d > 150 ? 0.9 : 0.4)) { HUSH_LAST = g.time; e.startAtk(HU.cling); return; }
      if (d < 150) { HUSH_LAST = g.time; e.startAtk(HU.lunge); }
    },
    lunge: {
      dur: 1.05, cd: 1.5, tells: [{ t: 0.1, c: 'white' }],
      moves: [{ t0: 0.58, t1: 0.72, v: 560 }],
      hits: [{ t0: 0.6, t1: 0.74, box: { x: -6, y: -46, w: 50, h: 42 }, dmg: 17, kb: 200, last: true, pbal: 40 }],
      ev: [{ t: 0.57, fn: () => G.SFX.play('c8_skitter', 1.4) }],
    },
    cling: {
      dur: 1.3, cd: 1.6, track: false, tells: [{ t: 0.1, c: 'white' }],
      onStart(e) { e.grabTried = false; e.hopV = 0; },
      ev: [{ t: 0.58, fn: hop }],
    },
    hold: { dur: 99, cd: 1.1, track: false, hold: true },
    atkUpdate(e, dt) {
      const a = e.atk;
      if (a === HU.hold) { holdUpdate(e, dt); return; }
      if (a === HU.cling) {
        if (e.st >= 0.58 && e.st < 0.9) e.vx = e.hopV;
        if (!e.grabTried && e.st >= 0.6 && e.st <= 0.98) {
          const s = e.sc, bx = { x: e.x - 15 * s, y: e.y - 54 * s, w: 30 * s, h: 50 * s };
          if (U.rectsOverlap(bx, e.P.hurtbox)) { e.grabTried = true; grab(e); }
        }
      }
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, a = e.state === 'atk' ? e.atk : null, st = e.st;
      if (dt > 0 && Math.abs(e.vx) > 20 && e.onGround) e.gait += Math.abs(e.vx) * dt * 0.1;
      let tgt;
      if (a === HU.lunge) tgt = sampK(LUNGE_K, st, HZ0);
      else if (a === HU.cling) tgt = sampK(CLING_K, st, HZ0);
      else if (a === HU.hold) tgt = Object.assign({}, HZ0, HZ.hold, { head: 0.42 + Math.sin(e.t * 9) * 0.05 });
      else if (e.state === 'hurt' || e.state === 'recoil') tgt = Object.assign({}, HZ0, HZ.hurt);
      else if (e.state === 'broken' || e.state === 'executed') tgt = Object.assign({}, HZ0, HZ.broken(e.t));
      else if (Math.abs(e.vx) > 40) tgt = Object.assign({}, HZ0, HZ.run(), { legA: U.clamp(Math.abs(e.vx) / 220, 0.4, 1) });
      else tgt = Object.assign({}, HZ0, HZ.idle(e.t, e.seed));
      const z = Object.assign({}, blendTo(e, 'pz', tgt, dt, a ? 30 : 14));
      if (e.hitK > 0) { z.lean -= e.hitK * 0.7; z.head -= e.hitK * 0.5; z.free = Math.max(z.free, e.hitK); z.hFy -= e.hitK * 10; }
      // the white skitter: speed lines behind the dive
      if (a === HU.lunge && st > 0.56 && st < 0.82) {
        const k = 1 - Math.abs(st - 0.66) / 0.16;
        ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.facing, 1);
        ctx.strokeStyle = U.rgba('#ffffff', 0.75 * k); ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) { const y = -14 - i * 9, x0 = -12 - hash(i, e.seed) * 10; ctx.lineWidth = 2.4 - i * 0.4; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 - 26 - i * 6, y + 1); ctx.stroke(); }
        ctx.restore();
      }
      // a soft ink shadow grounds the little paper figure on a pale stage
      if (!e.cling && !ghost) { const fl = floorAt(e.x, e.y - 6, e.y), k = U.clamp(1 - (fl - e.y) / 120, 0, 1); if (k > 0) { ctx.save(); ctx.fillStyle = 'rgba(20,12,28,' + (0.3 * k).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(e.x, fl - 0.5, 15 * e.sc * k, 3.2, 0, 0, TAU); ctx.fill(); ctx.restore(); } }
      const H = hushBody(ctx, e, z, ghost);
      if (e.tellT > 0) glow(ctx, H.hdF.x, H.hdF.y, 18, e.tellCol === 'red' ? RED : '#ffffff', e.tellT * 1.5);
      if (e.state === 'broken') dizzy(ctx, H.hc.x, H.hc.y - 20, e.t, 12);
      // clinging, it drinks her breath: gilt motes pulled out of her into its hands
      if (!ghost && dt > 0 && e.cling && Math.random() < 0.3) {
        const P = e.P; G.FX.ember(U.lerp(P.x, e.x, 0.4), P.y - 70, 1, GOLDL, { w: 16, h: 30, up: 20, sp: 30, life: 0.45 });
      }
    },
  });

  /* =========================================================================================
     c8_conductor 指揮殘影 CONDUCTOR WRAITH — an echo of Maestrina's baton: a tailcoat with nobody in it, white gloves,
     and her crimson baton. While it lives it keeps time for every foe near it (節拍: their attacks come sooner; a
     crimson beat ring thumps under each one, a gilt thread runs back to the baton).
     tempo     (white × 3 — it swoops in and conducts three slashes on the beat; the third is the widest)
     downbeat  (red — it rises and lifts the baton; a crimson line marks where a giant blade will fall, follows you
               for 0.5 s, holds still for 0.36 s, then the blade drops: step or dodge off the line)
     Kill it first: the tempo dies with it.
     ========================================================================================= */
  const CZ0 = { hx: 20, hy: 10, ba: 2.0, bx: -6, by: 18, lean: 0.06, fl: 0, sq: 0, lift: 0 };
  // a 4/4 beat pattern for the baton hand (relative to its shoulder): down, in, out, up
  const BEAT_PTS = [{ x: 22, y: 16 }, { x: 4, y: 10 }, { x: 36, y: 6 }, { x: 22, y: -14 }];
  function conductHand(ph) {
    const i = Math.floor(ph) % 4, f = ph - Math.floor(ph), a = BEAT_PTS[i], b = BEAT_PTS[(i + 1) % 4];
    const k = U.easeInOutSine(f), bounce = Math.sin(f * PI) * 5;
    return { x: U.lerp(a.x, b.x, k), y: U.lerp(a.y, b.y, k) - bounce, flick: Math.max(0, 1 - f * 5) };
  }
  const TEMPO_K = [
    [0, {}], [0.16, { hx: -4, hy: -28, ba: 3.6, bx: -16, by: -6, lean: -0.22, fl: 0.4 }, 'out'],
    [0.56, { hx: -8, hy: -32, ba: 3.9, bx: -18, by: -10, lean: -0.3, fl: 0.6 }],
    [0.66, { hx: 34, hy: 18, ba: 1.25, bx: -10, by: 4, lean: 0.32, fl: 1 }, 'snap'],
    [1.04, { hx: 30, hy: 24, ba: 0.9, bx: -12, by: 0, lean: 0.25, fl: 0.6 }],
    [1.16, { hx: 26, hy: -30, ba: 3.0, bx: -6, by: 10, lean: -0.18, fl: 1 }, 'snap'],
    [1.5, { hx: -10, hy: -14, ba: 4.3, bx: 6, by: 14, lean: -0.3, fl: 0.7 }],
    [1.68, { hx: 38, hy: 2, ba: 1.6, bx: -18, by: -2, lean: 0.4, fl: 1.3, sq: 0.1 }, 'snap'],
    [1.95, { hx: 30, hy: 10, ba: 1.5, bx: -14, by: 6, lean: 0.2, fl: 0.6 }],
    [2.35, {}],
  ];
  const DOWN_K = [
    [0, {}], [0.3, { hx: 8, hy: -40, ba: PI, bx: -14, by: -26, lean: -0.3, fl: 0.4, lift: 1 }, 'out'],
    [0.92, { hx: 6, hy: -44, ba: PI + 0.12, bx: -16, by: -30, lean: -0.36, fl: 0.6, lift: 1 }],
    [1.0, { hx: 30, hy: 22, ba: 0.55, bx: -8, by: 10, lean: 0.4, fl: 1.2, lift: 0.4, sq: 0.12 }, 'snap'],
    [1.5, { hx: 26, hy: 18, ba: 0.6, bx: -8, by: 14, lean: 0.25, fl: 0.4 }],
    [2.0, {}],
  ];
  // slash arcs (local, around the front shoulder): [start angle, end angle] — angles from straight down, + toward the front
  const SLASH = [{ t: 0.6, a0: 3.5, a1: 1.0 }, { t: 1.1, a0: 0.75, a1: 2.75 }, { t: 1.62, a0: 4.3, a1: 1.45, wide: 1 }];
  const CW_SH = { x: 13, y: -95 };
  function drawSlashes(ctx, e, st) {
    for (const s of SLASH) {
      const k = (st - s.t) / 0.3; if (k < 0 || k > 1) continue;
      const R = s.wide ? 112 : 104, a0 = s.a0, a1 = s.a1, n = 14, fade = 1 - k;
      const head = U.lerp(a0, a1, Math.min(1, k * 3)), tail = U.lerp(a0, a1, Math.max(0, k * 1.6 - 0.25));
      const P = (a, r) => ({ x: CW_SH.x + Math.sin(a) * r, y: CW_SH.y + Math.cos(a) * r });
      const outer = [], inner = [];
      for (let i = 0; i <= n; i++) { const a = U.lerp(tail, head, i / n), w = Math.sin((i / n) * PI) * 20 * (s.wide ? 1.2 : 1); outer.push(P(a, R)); inner.push(P(a, R - w)); }
      lighter(ctx, () => {
        polyP(ctx, outer.concat(inner.reverse())); ctx.fillStyle = U.rgba('#ffffff', 0.8 * fade); ctx.fill();
        ctx.strokeStyle = U.rgba(GOLDL, 0.6 * fade); ctx.lineWidth = 1.2; ctx.beginPath(); outer.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
      });
    }
  }
  // the falling blade: a giant baton-sword of light dropped straight down on the marked line
  function dropBlade(e) {
    const P = e.P, x = P.x;
    G.game.hazards.push({ t: 0, life: 1.9, x, owner: e, lockT: 0.5, dropT: 0.86, hit: false, fl: floorAt(x, P.y - 10, P.y), seed: seedOf(), update: bladeUpdate, draw: bladeDraw });
    G.SFX.play('c8_bladeRise');
  }
  function bladeUpdate(h, dt, g) {
    const P = g.player;
    if (h.t < h.lockT && P) { h.x = U.approach(h.x, P.x, 620 * dt); h.fl = floorAt(h.x, Math.min(P.y, h.fl) - 10, h.fl); }
    if (h.t >= h.dropT && !h.landed) {
      h.landed = true; g.shake(0.55); G.SFX.play('c8_downbeat');
      G.FX.ring(h.x, h.fl - 2, 10, 150, 0.5, CRIMSON, 4, { flat: 0.16 }); G.FX.ring(h.x, h.fl - 2, 6, 90, 0.35, '#ffffff', 3, { flat: 0.16 });
      G.FX.shards(h.x, h.fl - 4, 12, '#ffffff', 420); G.FX.flash(h.x, h.fl - 120, 160, 0.25, '#fff4f0');
    }
    if (!h.hit && P && h.t >= h.dropT && h.t <= h.dropT + 0.14) {
      const box = { x: h.x - 24, y: h.fl - 300, w: 48, h: 300 };
      if (U.rectsOverlap(box, P.hurtbox)) { h.hit = true; P.receiveHit(h.owner, { dmg: 34, unblockable: true, kb: 300, hx: h.x, hy: P.y - 60 }); }
    }
  }
  function bladeDraw(ctx, h, g) {
    const x = h.x, fl = h.fl, t = h.t;
    if (t < h.dropT) {
      const k = t / h.dropT, locked = t >= h.lockT, pulse = 0.5 + 0.5 * Math.sin(t * (locked ? 40 : 18));
      lighter(ctx, () => {
        const top = fl - 760, a = (locked ? 0.55 : 0.28) + 0.3 * pulse;
        const gr = ctx.createLinearGradient(x, top, x, fl); gr.addColorStop(0, U.rgba(CRIMSON, 0)); gr.addColorStop(0.5, U.rgba(CRIMSON, a * 0.6)); gr.addColorStop(1, U.rgba(RED, a));
        ctx.fillStyle = gr; ctx.fillRect(x - (locked ? 2.2 : 1.2), top, locked ? 4.4 : 2.4, fl - top);
        K.glow(ctx, x, fl, 40 + 30 * k, RED, 0.25 + 0.4 * k * pulse);
        ctx.strokeStyle = U.rgba(RED, 0.5 + 0.4 * pulse); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, fl - 1, 26 + 8 * (1 - k), 5, 0, 0, TAU); ctx.stroke();
      });
      // the blade waits high above, trembling, a faint ghost of itself
      ctx.save(); ctx.globalAlpha = 0.25 + 0.35 * k; drawBigBlade(ctx, x + Math.sin(t * 50) * 1.5 * k, fl - 560 - 40 * (1 - k), 0); ctx.restore();
      return;
    }
    const k = U.clamp((t - h.dropT) / 0.07, 0, 1), y = U.lerp(fl - 560, fl + 18, U.easeInCubic(k));
    const fade = t > 1.45 ? 1 - (t - 1.45) / 0.45 : 1;
    if (k < 1) lighter(ctx, () => { ctx.fillStyle = U.rgba('#ffffff', 0.55); ctx.fillRect(x - 14, y - 600, 28, 560); });
    // floor cracks round the embedded point
    if (k >= 1) {
      ctx.save(); ctx.globalAlpha = fade; ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const sd = i % 2 ? 1 : -1, L = 18 + hash(i, h.seed) * 34; ctx.moveTo(x + sd * 6, fl - 1); ctx.lineTo(x + sd * (L * 0.5), fl - 1 - hash(i + 3, h.seed) * 3); ctx.lineTo(x + sd * L, fl + 1); }
      ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = fade;
    ctx.beginPath(); ctx.rect(x - 60, y - 620, 120, fl - (y - 620)); ctx.clip();      // the tip is buried in the floor
    drawBigBlade(ctx, x, y - 300, t > 1.3 ? (t - 1.3) / 0.6 : 0);
    ctx.restore();
    if (k >= 1 && t < h.dropT + 0.25) glow(ctx, x, fl - 10, 90, '#fff4f0', 0.6 * (1 - (t - h.dropT) / 0.25));
  }
  // a baton grown into a sword: white lacquer blade with a crimson edge, a gilt guard, a cork-white grip (300 tall)
  function drawBigBlade(ctx, x, y, crack) {
    ctx.save(); ctx.translate(x, y);
    poly(ctx, [[-13, 0], [13, 0], [8, 270], [0, 318], [-8, 270]]);
    const gr = ctx.createLinearGradient(-13, 0, 13, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.48, '#f3eee4'); gr.addColorStop(0.48, '#c9bfd2'); gr.addColorStop(1, '#a89eb6');
    ctx.fillStyle = gr; ctx.fill(); ink(ctx, 2.4);
    ctx.strokeStyle = CRIMSON; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-11, 4); ctx.lineTo(-7, 268); ctx.lineTo(0, 312); ctx.stroke();
    line(ctx, { x: 0, y: 6 }, { x: 0, y: 300 }, 'rgba(120,104,150,0.4)', 1);
    // gilt guard and grip
    poly(ctx, [[-30, -4], [30, -4], [24, 6], [-24, 6]]); ctx.fillStyle = cel(ctx, 0, 0, 0.6, -0.8, 30, GLT); ctx.fill(); ink(ctx, 1.8);
    ctx.beginPath(); ctx.ellipse(0, -30, 7, 26, 0, 0, TAU); ctx.fillStyle = cel(ctx, 0, -30, 1, 0, 7, IVO); ctx.fill(); ink(ctx, 1.8);
    ctx.beginPath(); ctx.arc(0, -60, 7, 0, TAU); ctx.fillStyle = cel(ctx, 0, -60, 0.6, -0.8, 7, CRM); ctx.fill(); ink(ctx, 1.6);
    if (crack > 0) { ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i < 5; i++) { const yy = 40 + i * 50; ctx.moveTo(-10, yy); ctx.lineTo(4 - i, yy + 14 * crack); ctx.lineTo(-2, yy + 30 * crack); } ctx.stroke(); }
    ctx.restore();
  }
  function condBody(ctx, e, z, ghost) {
    const t = e.t, sk = z.sq;
    ctx.translate(e.x, e.y); ctx.scale(e.facing, 1);
    ctx.translate(0, -60); ctx.rotate(z.lean * 0.35); ctx.scale(1 + sk, 1 - sk); ctx.translate(0, 60);
    // the wake: five faint staff lines streaming back from where its legs should be
    if (!ghost && !low()) {
      ctx.save(); ctx.strokeStyle = 'rgba(40,30,52,0.28)'; ctx.lineWidth = 0.9;
      for (let i = 0; i < 5; i++) { const y0 = -54 + i * 5; ctx.beginPath(); ctx.moveTo(-2, y0); ctx.bezierCurveTo(-30, y0 + 6 + Math.sin(t * 2 + i) * 4, -60, y0 - 4 + Math.sin(t * 2.4 + i) * 6, -96, y0 + 8 + Math.sin(t * 1.7 + i) * 8); ctx.stroke(); }
      ctx.restore();
    }
    // tails (world-space cloth, mapped back to local)
    const toL = (q) => ({ x: (q.x - e.x) * e.facing, y: q.y - e.y });
    const tails = [e.tailA, e.tailB].map((c) => c.inited ? c.p.map(toL) : null);
    const roots = [{ x: -5, y: -61 }, { x: -11, y: -60 }];
    tails.forEach((tp, i) => {
      if (!tp) return;
      tp[0] = roots[i];
      Rig.ribbon(ctx, tp, 5.4, 2.6, cel(ctx, tp[2].x, tp[2].y, 1, 0, 7, i ? LAC : LAC2)); ink(ctx, 1.3);
      // the swallow-tail notch at the end
      const a = tp[tp.length - 2], b = tp[tp.length - 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      ctx.fillStyle = i ? '#13101a' : '#1f1a27'; ctx.beginPath(); ctx.moveTo(b.x - dy / d * 3.2, b.y + dx / d * 3.2); ctx.lineTo(b.x + dx / d * 6 - dy / d * 2, b.y + dy / d * 6 + dx / d * 2); ctx.lineTo(b.x + dx / d * 2, b.y + dy / d * 2); ctx.lineTo(b.x + dx / d * 6 + dy / d * 2, b.y + dy / d * 6 - dx / d * 2); ctx.lineTo(b.x + dy / d * 3.2, b.y - dx / d * 3.2); ctx.closePath(); ctx.fill(); ink(ctx, 1);
      lighter(ctx, () => { ctx.strokeStyle = U.rgba(GOLD, 0.55); ctx.lineWidth = 0.8; ctx.beginPath(); curveThrough(ctx, tp.slice(1).map((q) => ({ x: q.x + 2.2, y: q.y }))); ctx.stroke(); });
    });
    // the back sleeve and glove
    const shB = { x: -10, y: -96 }, shF = { x: 13, y: -95 };
    const handB = { x: shB.x + z.bx, y: shB.y + 26 + z.by };
    sleeve(ctx, shB, handB, LAC, false, t, 0);
    // the coat: shoulders, a cut-away front, satin lapels, gilt piping — and nobody inside
    const body = [{ x: -4, y: -105 }, { x: -12, y: -99 }, { x: -15, y: -84 }, { x: -14, y: -62 }, { x: -6, y: -58 }, { x: 4, y: -63 }, { x: 13, y: -66 }, { x: 17, y: -82 }, { x: 15, y: -97 }, { x: 7, y: -105 }];
    polyP(ctx, body); ctx.fillStyle = cel(ctx, 1, -82, 1, 0, 17, LAC2); ctx.fill(); ink(ctx, 1.8);
    ctx.save(); polyP(ctx, body); ctx.clip();
    // lapels in satin, catching a cool sheen; a gilt piping down the front
    // the coat hangs open at the front — and there is nothing in it: a dark V with a crimson coal deep inside
    poly(ctx, [[0.5, -104], [8, -104.5], [11.4, -87], [9.4, -71], [4.6, -83]]); ctx.fillStyle = '#08060b'; ctx.fill();
    if (!ghost) glow(ctx, 6.5, -86, 12, CRIMSON, 0.55 + 0.2 * Math.sin(t * 3.1));
    poly(ctx, [[8, -104.5], [12.6, -104], [15.4, -88], [10.4, -71.5], [11.4, -87]]); ctx.fillStyle = '#3c3548'; ctx.fill(); ink(ctx, 1);
    lighter(ctx, () => { ctx.strokeStyle = 'rgba(230,220,255,0.28)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(11, -102); ctx.lineTo(13.6, -89); ctx.stroke(); });
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(10.4, -71.5); ctx.lineTo(13, -66); ctx.moveTo(-14, -63); ctx.lineTo(-6, -58.5); ctx.lineTo(4, -63); ctx.stroke();
    ctx.restore();
    // the hollow: where the neck goes in, only dark — and, deep in it, a crimson coal
    ctx.beginPath(); ctx.ellipse(1.5, -104, 6.8, 2.8, -0.08, 0, TAU); ctx.fillStyle = '#07050a'; ctx.fill(); ink(ctx, 1.2);
    if (!ghost) glow(ctx, 1.5, -100, 16, CRIMSON, 0.4 + 0.15 * Math.sin(t * 3));
    // wing collar and a white bow tie floating where a throat would be
    poly(ctx, [[-3.4, -105.5], [0.5, -103], [-2, -100.5]]); ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, 0.9);
    poly(ctx, [[6.4, -105.5], [2.6, -103], [5.2, -100.5]]); ctx.fill(); ink(ctx, 0.9);
    const bob = Math.sin(t * 2.6) * 0.8;
    poly(ctx, [[1.6, -100.2 + bob], [-4, -103 + bob], [-4.2, -97.6 + bob]]); ctx.fillStyle = cel(ctx, -1, -100, 0.6, -0.8, 4, PAP); ctx.fill(); ink(ctx, 1);
    poly(ctx, [[1.6, -100.2 + bob], [7, -103.4 + bob], [7.2, -97.4 + bob]]); ctx.fill(); ink(ctx, 1);
    ctx.beginPath(); ctx.arc(1.6, -100.3 + bob, 1.5, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, 0.8);
    // gilt buttons and a white pocket square
    for (const y of [-79, -71]) { ctx.beginPath(); ctx.arc(14.4, y, 1.3, 0, TAU); ctx.fillStyle = GOLD; ctx.fill(); ink(ctx, 0.6); }
    poly(ctx, [[-6, -88], [-3.4, -92], [-1.4, -88.6], [0.4, -91.6], [1.2, -87.6]]); ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, 0.8);
    // the baton arm
    const hand = { x: shF.x + z.hx, y: shF.y + 26 + z.hy - z.lift * 10 };
    const tip = sleeve(ctx, shF, hand, LAC2, true, t, z.ba, e);
    return { tip, hand };
  }
  // a coat sleeve to a white glove; with ba (baton angle, from straight down) it also draws the crimson baton
  function sleeve(ctx, sh, hd, hex, front, t, ba, e) {
    const m = lp(sh, hd, 0.5), dx = hd.x - sh.x, dy = hd.y - sh.y, d = Math.hypot(dx, dy) || 1;
    const bend = Math.max(0, 40 - d) * 0.5 + 2, el = { x: m.x - dy / d * bend * 0.4 + 3, y: m.y + Math.abs(dx / d) * bend * 0.6 };
    LC(ctx, [sh, el, hd], [6.2, 5.2, 4.6], hex);
    // a starched cuff and a gilt band
    const cu = lp(el, hd, 0.86), ux = (hd.x - el.x), uy = (hd.y - el.y), ud = Math.hypot(ux, uy) || 1, nx = -uy / ud, ny = ux / ud;
    ctx.beginPath(); ctx.moveTo(cu.x + nx * 5, cu.y + ny * 5); ctx.lineTo(cu.x - nx * 5, cu.y - ny * 5); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.4; ctx.stroke();
    const g0 = lp(el, hd, 1.08);
    let tip = null;
    if (front) {
      // the baton: crimson lacquer, a white cork grip, a point that holds a spark
      const v = dirv(ba, 1), b0 = { x: g0.x - v.x * 5, y: g0.y - v.y * 5 }; tip = { x: g0.x + v.x * 46, y: g0.y + v.y * 46 };
      ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(tip.x, tip.y); ctx.strokeStyle = INK; ctx.lineWidth = 4.4; ctx.lineCap = 'round'; ctx.stroke();
      ctx.strokeStyle = CRIMSON; ctx.lineWidth = 2.4; ctx.stroke();
      lighter(ctx, () => { ctx.strokeStyle = 'rgba(255,170,190,0.55)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(b0.x + v.y * 0.8, b0.y - v.x * 0.8); ctx.lineTo(tip.x, tip.y); ctx.stroke(); });
      const gp = { x: g0.x - v.x * 2, y: g0.y - v.y * 2 };
      ctx.beginPath(); ctx.ellipse(gp.x, gp.y, 3.2, 6.4, -Math.atan2(v.x, v.y), 0, TAU); ctx.fillStyle = cel(ctx, gp.x, gp.y, 0.6, -0.8, 4, IVO); ctx.fill(); ink(ctx, 1);
    }
    // the glove: a white kid glove with three knuckles
    ctx.save(); ctx.translate(g0.x, g0.y); ctx.rotate(Math.atan2(uy, ux));
    ctx.beginPath(); ctx.moveTo(-3, -4); ctx.quadraticCurveTo(3, -5.6, 6.6, -3.2); ctx.quadraticCurveTo(8.6, 0, 6.4, 3.4); ctx.quadraticCurveTo(1, 5.4, -3, 4); ctx.closePath();
    ctx.fillStyle = cel(ctx, 2, 0, 0.6, -0.8, 6, PAP); ctx.fill(); ink(ctx, 1.2);
    ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(2.5, -3.6); ctx.lineTo(3, 3.4); ctx.moveTo(5, -2.8); ctx.lineTo(5.4, 2.8); ctx.stroke();
    ctx.restore();
    return tip;
  }

  const CW = reg('c8_conductor', {
    name: '指揮殘影', en: 'CONDUCTOR WRAITH', w: 40, h: 112, hp: 150, bal: 70, col: '#fff3ea', shards: 70, kbMul: 0.6, spawnT: 0.8,
    fly: true, hover: true, reachPad: 120, topPad: 40, portrait: [2.6, 0.84],
    init(e) {
      e.seed = seedOf(); e.tailA = new Rig.Chain(5, 9, 0.16, 0.86); e.tailB = new Rig.Chain(5, 9.5, 0.14, 0.86);
      e.cd = 1.2 + Math.random() * 0.8;
    },
    voice: (e) => G.SFX.play('c8_condVoice'),
    weapon: (e) => e.tipW || { x: e.x + e.facing * 40, y: e.y - 80 },
    think(e, dt) {
      hoverInit(e, 200); Tempo.ensure();
      const P = e.P, d = e.distP(); e.faceP();
      const side = Math.sign(e.x - P.x) || 1, tx = clampArena(e, P.x + side * 250);
      e.vx = U.approach(e.vx, U.clamp((tx - e.x) * 1.6, -210, 210) * e.speedMul, 520 * dt);
      const fl = floorAt(e.x, e.y + 40, e.y0 + 200), base = Math.min(e.y0, fl - 150);
      const ty = Math.max(fl - 340, Math.min(base, P.y - 150)) + Math.sin(e.t * 1.7 + e.seed) * 10;
      e.vy = U.clamp((ty - e.y) * 2.4, -240, 240);
      if (e.cd > 0 || P.hp <= 0) return;
      if (d < 470 && Math.abs(P.y - e.y) < 420 && Math.random() < 0.62) e.startAtk(CW.tempo);
      else if (d < 900) e.startAtk(CW.downbeat);
      else e.cd = 0.4;
    },
    tempo: {
      dur: 2.35, cd: 1.7, track: false,
      tells: [{ t: 0.12, c: 'white' }, { t: 0.62, c: 'white' }, { t: 1.12, c: 'white' }],
      hits: [
        { t0: 0.62, t1: 0.74, box: { x: -10, y: -112, w: 130, h: 108 }, dmg: 22, kb: 220 },
        { t0: 1.12, t1: 1.24, box: { x: -10, y: -126, w: 126, h: 118 }, dmg: 22, kb: 220 },
        { t0: 1.62, t1: 1.76, box: { x: -30, y: -112, w: 152, h: 108 }, dmg: 26, kb: 300, last: true, pbal: 60 },
      ],
      ev: [0.6, 1.1, 1.6].map((t, i) => ({ t, fn: () => G.SFX.play('c8_baton', 1 + i * 0.2) })),
    },
    downbeat: {
      dur: 2.0, cd: 2.0, track: false, tells: [{ t: 0.12, c: 'red' }],
      ev: [{ t: 0.12, fn: dropBlade }],
    },
    atkUpdate(e, dt) {
      const P = e.P, a = e.atk, st = e.st, fl = floorAt(e.x, e.y + 40, e.y + 300);
      if (a === CW.tempo) {
        if (st < 1.8) {
          const ax = clampArena(e, P.x - e.facing * 86, 40), ay = Math.min(P.y - 2, fl - 4), k = st < 0.55 ? 5.5 : 3;
          e.vx = U.clamp((ax - e.x) * k, -720, 720); e.vy = U.clamp((ay - e.y) * k, -720, 720);
        } else { e.vx = U.approach(e.vx, -e.facing * 90, 600 * dt); e.vy = U.approach(e.vy, -150, 600 * dt); }
      } else if (a === CW.downbeat) {
        const ty = Math.max(fl - 330, Math.min(e.y0, P.y - 230));
        e.vx = U.approach(e.vx, 0, 500 * dt); e.vy = st < 1.0 ? U.clamp((ty - e.y) * 3, -260, 260) : U.approach(e.vy, 0, 400 * dt);
      }
    },
    tick(e, dt) {
      // the tails stream from its back waist (world space)
      const lean = e.pz ? e.pz.lean : 0, fl = e.pz ? e.pz.fl : 0;
      [e.tailA, e.tailB].forEach((c, i) => {
        const rx = e.x + e.facing * (i ? -11 : -5), ry = e.y - 60;
        if (!c.inited) c.reset(rx, ry);
        c.update(rx, ry, e.facing, dt, -e.vx * 5 + Math.sin(e.t * 2.3 + i) * 240 - e.facing * fl * 700, 2.15 + lean * 0.3 + i * 0.16 + Math.sin(e.t * 1.6 + i) * 0.08);
      });
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, a = e.state === 'atk' ? e.atk : null, st = e.st;
      let tgt;
      if (a === CW.tempo) tgt = sampK(TEMPO_K, st, CZ0);
      else if (a === CW.downbeat) tgt = sampK(DOWN_K, st, CZ0);
      else if (e.state === 'hurt' || e.state === 'recoil') tgt = Object.assign({}, CZ0, { hx: -6, hy: -24, ba: 3.4, bx: -20, by: -18, lean: -0.5, fl: 0.8, sq: 0.08 });
      else if (e.state === 'broken' || e.state === 'executed') tgt = Object.assign({}, CZ0, { hx: 8, hy: 30, ba: 0.25, bx: 0, by: 30, lean: 0.55 + Math.sin(e.t * 1.8) * 0.06, sq: -0.06 });
      else {
        // idle: it conducts — a 4/4 pattern, in time with the beat it is giving everyone else
        const ph = (G.game.time / BEAT) % 4, ch = conductHand(ph);
        tgt = Object.assign({}, CZ0, { hx: ch.x, hy: ch.y, ba: 2.2 - ch.flick * 0.5 + Math.sin(ph * PI) * 0.2, bx: -8 + Math.sin(ph * PI * 0.5) * 6, by: 14 - Math.cos(ph * PI * 0.5) * 6, lean: 0.06 + ch.flick * 0.06 });
      }
      const z = Object.assign({}, blendTo(e, 'pz', tgt, dt, a ? 32 : 16));
      if (e.hitK > 0) { z.lean -= e.hitK * 0.6; z.sq += e.hitK * 0.08; }
      const bob = Math.sin(e.t * 2 + e.seed) * 2.5, m0 = ctx.getTransform();
      ctx.translate(0, bob);
      if (a === CW.tempo) { ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.facing, 1); drawSlashes(ctx, e, st); ctx.restore(); }
      const R = condBody(ctx, e, z, ghost);
      // remember the baton tip in world space (tells and the tempo threads come from it)
      if (!ghost) { try { const w = m0.inverse().transformPoint(ctx.getTransform().transformPoint(new DOMPoint(R.tip.x, R.tip.y))); e.tipW = { x: w.x, y: w.y }; } catch (err) { e.tipW = null; } }
      const hot = Math.max(e.tellT, a === CW.downbeat && st < 1.0 ? 0.5 : 0, e._c8beat != null && G.game.time - e._c8beat < 0.15 ? 0.6 : 0);
      if (hot > 0) glow(ctx, R.tip.x, R.tip.y, 22, e.tellCol === 'red' || a === CW.downbeat ? RED : CRIML, hot * 1.3);
      if (e.state === 'broken') dizzy(ctx, 2, -122, e.t, 14);
    },
  });

  /* =========================================================================================
     c8_cadence 終止騎士 CADENCE KNIGHT — a knight in black lacquer plate engraved with ivory staves; its great-helm
     wears the final double barline for a crest, its pavise is the end of a score. It closes every phrase.
     cadence  (IV – V – I: white cut, white rising cut, then the red RESOLUTION — an overhead blow into the floor;
              the sword stays stuck there a moment: punish it)
     wall     (it raises the pavise and advances behind it: blows from the front are turned aside. A perfect parry of
              the shield bash it ends with breaks its stance outright; or roll behind it — two blows in the back
              throw it off balance. It turns slowly while walled.)
     Poise: light blows do not interrupt its swings.
     ========================================================================================= */
  const CKS = 1.32;
  const ck = (p) => Rig.full(Rig.groundify(p));
  const CKP = {
    idle: (t) => ({ ry: 4 + Math.sin(t * 1.4) * 1, torso: 0.12 + Math.sin(t * 1.4) * 0.012, head: 0.04, tF: 0.4, kF: -0.48, tB: -0.32, kB: -0.24, aF: 0.32, eF: 0.62, aB: 0.7, eB: 1.0, sw: 0.75 }),
    wall: { ry: 12, torso: 0.3, head: 0.12, tF: 0.72, kF: -0.95, tB: -0.55, kB: -0.36, aF: -0.45, eF: 1.25, aB: 1.45, eB: 0.45, sw: 2.3 },
    bashA: { ry: 10, torso: 0.12, head: 0.08, tF: 0.6, kF: -0.8, tB: -0.5, kB: -0.3, aF: -0.5, eF: 1.2, aB: 0.95, eB: 1.35, sw: 2.3 },
    bashB: { ry: 12, torso: 0.48, head: 0.1, tF: 0.95, kF: -0.95, tB: -0.66, kB: -0.2, aF: -0.6, eF: 1.0, aB: 1.75, eB: 0.05, sw: 2.2 },
    c1a: { ry: 6, torso: -0.12, head: -0.05, tF: 0.5, kF: -0.62, tB: -0.42, kB: -0.3, aF: 2.55, eF: 0.75, aB: 0.9, eB: 1.1, sw: 4.35 },
    c1b: { ry: 13, torso: 0.48, head: 0.06, tF: 0.92, kF: -0.95, tB: -0.62, kB: -0.2, aF: 1.55, eF: 0.04, aB: 0.6, eB: 0.9, sw: 1.6 },
    c2a: { ry: 15, torso: 0.4, head: 0.1, tF: 0.85, kF: -1.0, tB: -0.6, kB: -0.3, aF: 0.15, eF: 0.4, aB: 0.85, eB: 1.0, sw: 0.3 },
    c2b: { ry: 2, torso: -0.06, head: -0.12, tF: 0.55, kF: -0.5, tB: -0.4, kB: -0.15, aF: 2.6, eF: 0.15, aB: 0.6, eB: 1.0, sw: 2.95 },
    c3a: { ry: 0, torso: -0.28, head: -0.25, tF: 0.38, kF: -0.4, tB: -0.36, kB: -0.2, aF: 3.05, eF: 0.45, aB: 1.6, eB: 0.5, sw: 3.75 },
    c3b: { ry: 24, torso: 0.78, head: 0.25, tF: 1.12, kF: -1.3, tB: -0.62, kB: -0.62, aF: 1.05, eF: 0.12, aB: 1.2, eB: 0.6, sw: 0.72 },
    hurt: { ry: 6, torso: -0.36, head: 0.4, tF: 0.3, kF: -0.5, tB: -0.5, kB: -0.3, aF: -0.2, eF: 0.9, aB: 0.35, eB: 1.2, sw: 0.4 },
    kneel: { ry: 30, torso: 0.5, head: 0.5, tF: 1.35, kF: -1.35, tB: 0.05, kB: -1.6, aF: 0.62, eF: 0.32, aB: 0.3, eB: 0.5, sw: 1.2 },
  };
  for (const k of ['wall', 'bashA', 'bashB', 'c1a', 'c1b', 'c2a', 'c2b', 'c3a', 'c3b', 'hurt']) CKP[k] = ck(CKP[k]);
  CKP.kneel = Rig.full(CKP.kneel);
  const CKI = (t = 0) => ck(CKP.idle(t));
  const BLADE = 88;
  function ckPose(e, dt) {
    const st = e.state, a = st === 'atk' ? e.atk : null;
    let p;
    if (a && a.anim) p = Rig.sample(a.anim, e.st);
    else if (st === 'hurt' || st === 'recoil') p = CKP.hurt;
    else if (st === 'broken' || st === 'executed') p = Rig.full(Object.assign({}, CKP.kneel, { torso: 0.5 + Math.sin(e.t * 2) * 0.04, head: 0.5 + Math.sin(e.t * 1.3) * 0.06 }));
    else if (Math.abs(e.vx) > 20 && e.onGround) {
      if (dt > 0) e.gaitP += e.vx * e.facing * dt * PI / 34;
      const w = AN.walk(e.gaitP);
      p = Rig.full(Object.assign({}, CKP.idle(e.t), { ik: 1, fFx: w.fFx + 4, fFy: w.fFy * 0.8, fBx: w.fBx - 4, fBy: w.fBy * 0.8, ry: w.ry + 5, torso: 0.18 }));
    } else p = CKI(e.t);
    if (e.hitK > 0 && st !== 'die') p = Rig.lerpPose(p, Rig.full(Object.assign({}, p, { torso: p.torso - 0.22, head: p.head + 0.3, ry: p.ry + 2 })), Math.min(1, e.hitK));
    if (!e.pose) e.pose = p;
    else if (dt > 0) e.pose = Rig.lerpPose(e.pose, p, 1 - Math.exp(-(e.hitK > 0 ? 36 : a ? 26 : 12) * dt));
    return e.pose;
  }
  // engraved staves: five fine ivory lines across a plate, a few note heads riding them
  function staves(ctx, a, b, w, gap, notes, seed) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
    ctx.strokeStyle = 'rgba(236,228,212,0.62)'; ctx.lineWidth = 0.55; ctx.beginPath();
    for (let i = -2; i <= 2; i++) { const o = i * gap; ctx.moveTo(a.x + nx * o, a.y + ny * o); ctx.lineTo(b.x + nx * o, b.y + ny * o); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(240,232,216,0.85)';
    for (let i = 0; i < notes; i++) {
      const k = 0.15 + 0.7 * hash(i, seed), o = (Math.floor(hash(i + 7, seed) * 5) - 2) * gap + gap * 0.5;
      ctx.beginPath(); ctx.ellipse(a.x + dx * k + nx * o, a.y + dy * k + ny * o, gap * 0.62, gap * 0.45, Math.atan2(dy, dx) - 0.4, 0, TAU); ctx.fill();
    }
  }
  function lacPlate(ctx, a, b, w1, w2, hex, engr, seed) {
    LB(ctx, a, b, w1, w2, hex, { spec: 0.45, noHatch: true });
    if (engr) { staves(ctx, lp(a, b, 0.2), lp(b, a, 0.12), Math.min(w1, w2), Math.min(w1, w2) * 0.24, 1, seed); }
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, c = lp(a, b, 0.86), w = U.lerp(w1, w2, 0.86) * 0.95;
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.x + nx * w, c.y + ny * w); ctx.lineTo(c.x - nx * w, c.y - ny * w); ctx.stroke();
  }
  function ckLeg(ctx, J, kn, an, to, hex, near, seed) {
    LC(ctx, [J.hip, lp(J.hip, kn, 0.5), kn, lp(kn, an, 0.5), an], [6.6, 6, 4.8, 4.4, 3.4], '#2a2431');
    lacPlate(ctx, lp(J.hip, kn, 0.08), lp(J.hip, kn, 0.9), near ? 8.6 : 7.8, near ? 6.8 : 6.2, hex, near, seed);
    lacPlate(ctx, lp(kn, an, 0.12), lp(kn, an, 0.96), near ? 6.6 : 6, near ? 5 : 4.6, hex, near, seed + 3);
    // sabaton: a blunt lacquered shoe with a gilt toe cap
    const dx = to.x - an.x, dy = to.y - an.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    const P = (u, v) => ({ x: an.x + ux * u + nx * v, y: an.y + uy * u + ny * v });
    polyP(ctx, [P(-5, -5.4), P(5, -5.8), P(d + 6, -1.6), P(d + 7, 2), P(d - 3, 4), P(-4, 4.2)]);
    ctx.fillStyle = cel(ctx, an.x + ux * d * 0.5, an.y + uy * d * 0.5, nx, ny, 6, hex); ctx.fill(); ink(ctx, 1.2);
    const tc = P(d + 3, 0); ctx.beginPath(); ctx.arc(tc.x, tc.y, 2.6, 0, TAU); ctx.fillStyle = GOLD; ctx.fill(); ink(ctx, 0.8);
    // poleyn: a disc with a fan
    ctx.beginPath(); ctx.arc(kn.x, kn.y, near ? 5.4 : 4.8, 0, TAU); ctx.fillStyle = cel(ctx, kn.x, kn.y, 0.6, -0.8, 5, LAC3); ctx.fill(); ink(ctx, 1.2);
    ctx.beginPath(); ctx.arc(kn.x, kn.y, 2.1, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();
  }
  function ckArm(ctx, sh, el, hd, hex, near, seed) {
    LC(ctx, [sh, el, hd], [4.6, 4, 3.4], '#2a2431');
    lacPlate(ctx, lp(sh, el, 0.15), lp(sh, el, 0.88), 5.8, 5, hex, false, seed);
    lacPlate(ctx, lp(el, hd, 0.14), lp(el, hd, 0.88), 5.4, 4.4, hex, false, seed + 1);
    ctx.beginPath(); ctx.arc(el.x, el.y, 4.4, 0, TAU); ctx.fillStyle = cel(ctx, el.x, el.y, 0.6, -0.8, 4.4, LAC3); ctx.fill(); ink(ctx, 1.1);
    ctx.beginPath(); ctx.arc(hd.x, hd.y, 4.6, 0, TAU); ctx.fillStyle = cel(ctx, hd.x, hd.y, 0.6, -0.8, 4.6, hex); ctx.fill(); ink(ctx, 1.1);
  }
  // the pavise: a tall arched shield, ivory, the end of a score painted on it — staves and a final double barline
  function pavise(ctx, c, ang, k, hot) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(ang);
    const W = 25, Ht = 58;
    const path = () => { ctx.beginPath(); ctx.moveTo(-W, -Ht + 16); ctx.quadraticCurveTo(-W, -Ht, 0, -Ht - 6); ctx.quadraticCurveTo(W, -Ht, W, -Ht + 16); ctx.lineTo(W - 2, Ht - 8); ctx.lineTo(0, Ht + 6); ctx.lineTo(-W + 2, Ht - 8); ctx.closePath(); };
    path(); ctx.fillStyle = cel(ctx, 0, 0, 1, 0, W, IVO); ctx.fill(); ink(ctx, 2.2);
    ctx.save(); path(); ctx.clip();
    ctx.strokeStyle = 'rgba(11,6,18,0.7)'; ctx.lineWidth = 0.9; ctx.beginPath();
    for (let i = 0; i < 5; i++) { const y = -20 + i * 7; ctx.moveTo(-W, y); ctx.lineTo(W, y); }
    ctx.stroke();
    // the final barline: a thin bar and a thick one, the end of every piece
    ctx.fillStyle = INK; ctx.fillRect(4, -Ht, 3, Ht * 2 + 10); ctx.fillRect(10, -Ht, 9, Ht * 2 + 10);
    ctx.fillStyle = 'rgba(11,6,18,0.85)'; ctx.beginPath(); ctx.arc(-4, -13.5, 2.6, 0, TAU); ctx.arc(-4, -6.5, 2.6, 0, TAU); ctx.fill();
    // a gilt border inside the rim
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2.2; ctx.translate(0, 0); ctx.scale(0.86, 0.9); path(); ctx.stroke();
    ctx.restore();
    if (hot > 0.01) lighter(ctx, () => { path(); ctx.strokeStyle = U.rgba(GOLDL, 0.9 * hot); ctx.lineWidth = 3 + 3 * hot; ctx.stroke(); K.glow(ctx, 0, 0, 60, GOLDL, 0.35 * hot); });
    ctx.restore();
  }
  function ckHelm(ctx, J, ghost, hot) {
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    // a great-helm: flat crown, straight cheeks, a breath-plate, and one vertical slit of gold light
    const helm = () => { ctx.beginPath(); ctx.moveTo(-10.5, 11); ctx.lineTo(-11.5, -9); ctx.quadraticCurveTo(-10, -13.5, -3, -13.8); ctx.lineTo(8, -13.2); ctx.quadraticCurveTo(12.5, -12, 12.4, -6); ctx.lineTo(13.4, 6); ctx.quadraticCurveTo(12, 11.5, 5, 12.4); ctx.closePath(); };
    helm(); ctx.fillStyle = cel(ctx, 0, -1, 0.6, -0.8, 13, LAC2); ctx.fill(); ink(ctx, 1.6);
    ctx.save(); helm(); ctx.clip();
    ctx.strokeStyle = 'rgba(236,228,212,0.5)'; ctx.lineWidth = 0.5; ctx.beginPath(); for (let i = 0; i < 5; i++) { const y = 3 + i * 1.6; ctx.moveTo(-12, y); ctx.lineTo(13, y + 0.6); } ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-11.2, -6.5); ctx.lineTo(12.6, -5.8); ctx.stroke();
    // the visor slit
    ctx.fillStyle = '#0a070d'; poly(ctx, [[7.4, -4.6], [10.4, -4.4], [10.8, 4.2], [7.8, 4.2]]); ctx.fill();
    if (!ghost) glow(ctx, 9.2, 0, 12 + 6 * hot, GOLD, 0.55 + 0.4 * hot);
    ctx.fillStyle = hot > 0.3 ? '#fff4cf' : GOLD; poly(ctx, [[8.4, -3.2], [9.6, -3.1], [9.9, 3.2], [8.7, 3.2]]); ctx.fill();
    ctx.fillStyle = 'rgba(236,228,212,0.7)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(4 + i * 2.6, 8.2, 0.6, 0, TAU); ctx.fill(); }
    // the crest: a final double barline standing up out of the crown, a thin fin and a thick one
    poly(ctx, [[-6.5, -13.6], [-5.4, -33], [-3.2, -33.4], [-3.6, -13.8]]); ctx.fillStyle = cel(ctx, -4.5, -24, 1, 0, 3, LAC3); ctx.fill(); ink(ctx, 1.2);
    poly(ctx, [[-1.6, -13.8], [0.4, -38], [7.6, -36.4], [5.4, -13.4]]); ctx.fillStyle = cel(ctx, 2.8, -26, 1, 0, 5, LAC); ctx.fill(); ink(ctx, 1.4);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0.6, -36); ctx.lineTo(7, -34.6); ctx.stroke();
    ctx.restore();
  }
  function ckSword(ctx, J, sw, hot, red) {
    const b = J.hdF, v = dirv(sw, 1), nx = -v.y, ny = v.x, tip = { x: b.x + v.x * BLADE, y: b.y + v.y * BLADE };
    const pm = { x: b.x - v.x * 15, y: b.y - v.y * 15 };
    LB(ctx, pm, b, 2, 2.2, LAC, { noHatch: true });
    ctx.beginPath(); ctx.arc(pm.x - v.x * 2.5, pm.y - v.y * 2.5, 3.4, 0, TAU); ctx.fillStyle = cel(ctx, pm.x, pm.y, 0.6, -0.8, 3.4, GLT); ctx.fill(); ink(ctx, 1);
    // the crossguard is a fermata: an arc over a dot
    const g0 = { x: b.x + v.x * 3, y: b.y + v.y * 3 };
    ctx.beginPath(); ctx.moveTo(g0.x + nx * 11 - v.x * 5, g0.y + ny * 11 - v.y * 5); ctx.quadraticCurveTo(g0.x + v.x * 9, g0.y + v.y * 9, g0.x - nx * 11 - v.x * 5, g0.y - ny * 11 - v.y * 5);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = GOLD; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.beginPath(); ctx.arc(g0.x - v.x * 1.5, g0.y - v.y * 1.5, 2.2, 0, TAU); ctx.fillStyle = GOLDL; ctx.fill(); ink(ctx, 0.8);
    const s0 = { x: b.x + v.x * 6, y: b.y + v.y * 6 };
    ctx.beginPath(); ctx.moveTo(s0.x + nx * 3.8, s0.y + ny * 3.8); ctx.lineTo(tip.x - v.x * 14 + nx * 3, tip.y - v.y * 14 + ny * 3); ctx.lineTo(tip.x, tip.y); ctx.lineTo(tip.x - v.x * 14 - nx * 3, tip.y - v.y * 14 - ny * 3); ctx.lineTo(s0.x - nx * 3.8, s0.y - ny * 3.8); ctx.closePath();
    const gr = ctx.createLinearGradient(s0.x + nx * 3.8, s0.y + ny * 3.8, s0.x - nx * 3.8, s0.y - ny * 3.8);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#e8e2d6'); gr.addColorStop(0.5, '#a39cb0'); gr.addColorStop(1, '#7c748c');
    ctx.fillStyle = gr; ctx.fill(); ink(ctx, 1.3);
    line(ctx, { x: s0.x + v.x * 4, y: s0.y + v.y * 4 }, { x: tip.x - v.x * 18, y: tip.y - v.y * 18 }, 'rgba(11,6,18,0.45)', 0.8);
    if (hot > 0.02) lighter(ctx, () => { ctx.strokeStyle = U.rgba(red ? RED : '#ffffff', 0.55 * hot); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(tip.x, tip.y); ctx.stroke(); });
    return tip;
  }
  function ckBody(ctx, e, p, J, ghost) {
    const { Q, nx, ny } = torsoQ(J), a = e.state === 'atk' ? e.atk : null, sd = e.seed;
    const walled = a === CK.wall ? U.clamp(Math.min(e.st / 0.22, (3.0 - e.st) / 0.3), 0, 1) : 0;
    const shC = (() => { const v = { x: J.hdB.x - J.elB.x, y: J.hdB.y - J.elB.y }, d = Math.hypot(v.x, v.y) || 1; return { x: J.hdB.x + v.x / d * 4, y: J.hdB.y + v.y / d * 4 - 8 }; })();
    const shAng = U.lerp(0.25, 0.04, walled) + (e.state === 'broken' ? 1.2 : 0);
    const shHot = Math.max(e.wallFx || 0, a === CK.wall && e.st > 2.1 && e.st < 2.75 ? 0.5 : 0);
    // the far side: shield at rest, far arm, far leg
    if (walled < 0.5) pavise(ctx, shC, shAng, walled, shHot);
    ckArm(ctx, J.shB, J.elB, J.hdB, LAC, false, sd);
    ckLeg(ctx, J, J.kneeB, J.ankB, J.toeB, LAC, false, sd + 10);
    // the tabard: an ivory panel scored with black staves, a gilt hem; it swings with the stride
    const sw = Math.sin(e.t * 2) * 2 - e.vx * e.facing * 0.012, hp = J.hip;
    const tab = [Q(0.05, -6), Q(0.05, 8.5), { x: hp.x + 12 + sw, y: hp.y + 36 }, { x: hp.x - 4 + sw * 1.3, y: hp.y + 37 }];
    polyP(ctx, tab); ctx.fillStyle = cel(ctx, hp.x + 3, hp.y + 18, 1, 0, 9, IVO); ctx.fill(); ink(ctx, 1.3);
    ctx.save(); polyP(ctx, tab); ctx.clip(); ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 0.7; ctx.beginPath(); for (let i = 0; i < 5; i++) { const y = hp.y + 14 + i * 3.2; ctx.moveTo(hp.x - 10, y); ctx.lineTo(hp.x + 16, y + 1); } ctx.stroke(); ctx.restore();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(hp.x + 12 + sw, hp.y + 35.5); ctx.lineTo(hp.x - 4 + sw * 1.3, hp.y + 36.5); ctx.stroke();
    // cuirass: deep chest in black lacquer; ivory staves engraved across it, a gilt clef over the heart
    const tp = [Q(-0.04, -10.5), Q(0.35, -12), Q(0.82, -14.6), Q(1.1, -9), Q(1.16, 2), Q(1.04, 12), Q(0.72, 15.4), Q(0.4, 12.4), Q(0.08, 10.6)];
    smoothP(ctx, tp); const tm = Q(0.55, 1); ctx.fillStyle = cel(ctx, tm.x, tm.y, nx, ny, 15, LAC2); ctx.fill(); ink(ctx, 1.7);
    ctx.save(); smoothP(ctx, tp); ctx.clip();
    staves(ctx, Q(0.3, -16), Q(0.86, 16), 4, 2.1, 3, sd + 20);
    ctx.restore();
    const cl = Q(0.74, 5.5);
    ctx.save(); ctx.translate(cl.x, cl.y); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0.5, 7); ctx.quadraticCurveTo(-1, 2, 1.4, -2); ctx.quadraticCurveTo(4, -7, 0.6, -8.5); ctx.quadraticCurveTo(-3, -6, 0.6, 1.6); ctx.quadraticCurveTo(3.6, 5, 0, 5.4); ctx.quadraticCurveTo(-2.6, 4, -1, 2); ctx.stroke(); ctx.restore();
    // faulds and a gilt belt
    for (let k = 0; k < 3; k++) { const sA = -0.03 - k * 0.12; LB(ctx, Q(sA, -11.5 - k), Q(sA, 12 + k * 1.2), 3.6, 3.6, LAC3, { noHatch: true }); }
    LB(ctx, Q(0.1, -11), Q(0.1, 11), 2.5, 2.5, GLT, { noHatch: true });
    // near leg
    ckLeg(ctx, J, J.kneeF, J.ankF, J.toeF, LAC2, true, sd + 30);
    // helm, sword, sword arm, a stacked pauldron
    const hot = Math.max(e.tellT || 0, a === CK.cadence && e.st > 1.36 && e.st < 2.14 ? 0.6 : 0);
    ckHelm(ctx, J, ghost, hot);
    const red = (e.tellCol === 'red' && e.tellT > 0) || (a === CK.cadence && e.st > 1.36 && e.st < 2.14);
    const tip = ckSword(ctx, J, p.sw, hot, red);
    ckArm(ctx, J.sh, J.elF, J.hdF, LAC2, true, sd + 40);
    for (const [r0, k] of [[10, 0], [8, 1], [6.2, 2]]) {
      const cx = J.sh.x - 1 + k * 0.5, cy = J.sh.y + k * 4.4;
      ctx.beginPath(); ctx.ellipse(cx, cy, r0, r0 * 0.74, -0.3, PI * 0.95, PI * 2.05); ctx.closePath();
      ctx.fillStyle = cel(ctx, cx, cy, 0.6, -0.8, r0, LAC2); ctx.fill(); ink(ctx, 1.3);
      ctx.strokeStyle = U.rgba('#ece4d4', 0.5); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.ellipse(cx, cy, r0 - 2.4, (r0 - 2.4) * 0.74, -0.3, PI * 1.08, PI * 1.92); ctx.stroke();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, r0 - 1, (r0 - 1) * 0.74, -0.3, PI * 1.02, PI * 1.98); ctx.stroke();
    }
    // the shield raised in front: the wall
    if (walled >= 0.5) pavise(ctx, shC, shAng, walled, shHot);
    return tip;
  }

  const CK = reg('c8_cadence', {
    name: '終止騎士', en: 'CADENCE KNIGHT', w: 52, h: 160, hp: 210, bal: 130, col: '#f3ecdc', shards: 88, kbMul: 0.35, poise: true, spawnT: 1.0,
    scale: CKS, reachPad: 120, topPad: 60, portrait: [1.95, 0.92],
    init(e) { e.seed = seedOf(); e.gaitP = 0; e.turnT = 0; e.wallFx = 0; e.deflects = 0; e.flank = 0; e.cd = 0.8 + Math.random() * 0.6; },
    voice: (e) => G.SFX.play('c8_knightVoice'),
    weapon: (e) => e.tipW || { x: e.x + e.facing * 90, y: e.y - 120 },
    think(e, dt) {
      const P = e.P, dx = P.x - e.x, d = Math.abs(dx);
      // a heavy turn: it only comes round once you have been behind it a moment
      if (Math.sign(dx) !== e.facing && d > 20) { e.turnT += dt; if (e.turnT > 0.32) { e.facing = -e.facing; e.turnT = 0; G.SFX.play('c8_plate'); } } else e.turnT = 0;
      const tv = d > 150 && Math.sign(dx) === e.facing ? e.facing * 80 : d < 70 ? -e.facing * 50 : 0;
      e.vx = U.approach(e.vx, tv * e.speedMul, 500 * dt);
      if (e.cd > 0 || P.hp <= 0 || Math.sign(dx) !== e.facing) return;
      if (d < 215) e.startAtk(Math.random() < 0.62 ? CK.cadence : CK.wall);
      else if (d < 560 && Math.random() < 0.55) e.startAtk(CK.wall);
      else e.cd = 0.5;
    },
    cadence: {
      dur: 2.95, cd: 2.0, trackWin: 0.5,
      anim: { keys: [[0, CKI()], [0.4, CKP.c1a, 'out'], [0.56, CKP.c1a], [0.66, CKP.c1b, 'snap'], [0.82, CKP.c1b], [1.0, CKP.c2a, 'io'], [1.1, CKP.c2a], [1.22, CKP.c2b, 'snap'], [1.38, CKP.c2b], [1.78, CKP.c3a, 'io'], [1.94, CKP.c3a], [2.04, CKP.c3b, 'snap'], [2.56, CKP.c3b], [2.95, CKI(), 'io']] },
      tells: [{ t: 0.1, c: 'white' }, { t: 0.64, c: 'white' }, { t: 1.36, c: 'red' }],
      hits: [
        { t0: 0.62, t1: 0.74, box: { x: -10, y: -152, w: 180, h: 124 }, dmg: 24, kb: 240 },
        { t0: 1.11, t1: 1.2, box: { x: 0, y: -206, w: 152, h: 190 }, dmg: 24, kb: 240 },
        { t0: 2.0, t1: 2.14, box: { x: 40, y: -206, w: 136, h: 206 }, dmg: 34, red: true, kb: 380, last: true, pbal: 80 },
      ],
      moves: [{ t0: 0.5, t1: 0.62, v: 170 }, { t0: 1.02, t1: 1.11, v: 140 }, { t0: 1.88, t1: 2.0, v: 230 }],
      ev: [
        { t: 0.6, fn: () => { G.SFX.play('slash', 0.55); G.SFX.play('c8_cadence', 0); } },
        { t: 1.1, fn: () => { G.SFX.play('slash', 0.6); G.SFX.play('c8_cadence', 1); } },
        { t: 2.02, fn: (e) => {
          G.SFX.play('c8_cadence', 2); G.game.shake(0.55);
          const x = e.x + e.facing * 128 * CKS * 0.9;
          G.FX.ring(x, e.y - 2, 10, 120, 0.45, '#ffffff', 4, { flat: 0.16 }); G.FX.dust(x, e.y, 12, { w: 50, speed: 260 }); G.FX.shards(x, e.y - 4, 8, '#f3ecdc', 380);
        } },
      ],
    },
    wall: {
      dur: 3.3, cd: 1.3, track: false, guardFrom: 0.22, guardTo: 2.72,
      anim: { keys: [[0, CKI()], [0.22, CKP.wall, 'out'], [2.22, CKP.wall], [2.52, CKP.bashA, 'io'], [2.74, CKP.bashB, 'snap'], [3.0, CKP.bashB], [3.3, CKI(), 'io']] },
      tells: [{ t: 2.24, c: 'white' }],
      hits: [{ t0: 2.72, t1: 2.86, box: { x: 0, y: -156, w: 98, h: 146 }, dmg: 22, kb: 320, last: true, pbal: 999 }],
      onStart(e) { e.deflects = 0; e.flank = 0; },
      ev: [{ t: 0.2, fn: () => G.SFX.play('c8_wall') }, { t: 2.72, fn: () => G.SFX.play('c8_drum', 0.7) }],
    },
    atkUpdate(e, dt) {
      const a = e.atk, P = e.P;
      if (a === CK.wall) {
        const dx = P.x - e.x;
        // behind the pavise it shuffles forward; it turns, slowly, if you get round it
        if (e.st > 0.3 && e.st < 2.2) {
          if (Math.sign(dx) !== e.facing) { e.turnT += dt; if (e.turnT > 0.55) { e.facing = -e.facing; e.turnT = 0; G.SFX.play('c8_plate'); } } else e.turnT = 0;
          e.vx = Math.abs(dx) > 75 && Math.sign(dx) === e.facing ? e.facing * 58 * e.speedMul : 0;
        }
      }
      e.wallFx = Math.max(0, (e.wallFx || 0) - dt * 3);
    },
    guard(e, h) {
      const a = e.atk;
      if (e.state !== 'atk' || a !== CK.wall || e.st < a.guardFrom || e.st > a.guardTo) return false;
      const P = G.game.player; if ((P.x - e.x) * e.facing < -4) return false;           // from behind: no wall there
      e.wallFx = 1; e.deflects++;
      if (e.deflects >= 4 && e.st < 2.0) e.st = 2.0;                                     // fed up: it bashes back early
      G.SFX.play('c8_clang');
      return true;
    },
    onHit(e, h) {
      const a = e.atk;
      if (e.state === 'atk' && a === CK.wall && e.st < a.guardTo) {
        // struck from behind while walled: twice, and the stance breaks (an opening — it will not swing for a while)
        if (++e.flank >= 2) {
          e.atk = null; e.setState('hurt'); e.hurtDur = 0.6; e.cd = Math.max(e.cd, 1.4);
          G.SFX.play('c8_clang'); G.FX.ring(e.x, e.y - 90, 8, 80, 0.35, GOLDL, 3);
        }
      }
    },
    tick(e, dt) { e.wallFx = Math.max(0, (e.wallFx || 0) - dt * 3); },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, p = ckPose(e, dt), J = Rig.compute(p), f = e.facing, s = CKS;
      // the resolution leaves its sword in the floor for a moment: a gilt crack ring where it bit
      const a = e.state === 'atk' ? e.atk : null;
      if (a === CK.cadence && e.st > 2.02 && e.st < 2.6) {
        const k = (e.st - 2.02) / 0.58, x = e.x + f * 128 * s * 0.9;
        lighter(ctx, () => { ctx.strokeStyle = U.rgba(GOLD, 0.7 * (1 - k)); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, e.y - 1, 30 + 40 * k, 5 + 3 * k, 0, 0, TAU); ctx.stroke(); });
      }
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(f * s, s);
      const tip = ckBody(ctx, e, p, J, ghost);
      if (!ghost) e.tipW = { x: e.x + f * tip.x * s, y: e.y + tip.y * s };
      if (e.tellT > 0) glow(ctx, tip.x, tip.y, 26, e.tellCol === 'red' ? RED : '#ffffff', e.tellT * 1.4);
      ctx.restore();
      if (e.state === 'broken') dizzy(ctx, e.x + f * J.head.x * s, e.y + J.head.y * s - 40, e.t, 16);
    },
  });

  /* =========================================================================================
     c8_coda 尾聲蛇 CODA SERPENT — a serpent of ink and gilt whose coiled body IS the coda sign: it rises from the
     floor, loops once, climbs straight up through its own ring, and spreads two gilt fins across it — ⊕, "go to the
     end". It swims through the stage floor like water.
     burrow + erupt (red — it dives; a gilt fin cuts through the floor toward you; a coda sigil is drawn on the floor
                    where it will come up — it follows you for 0.45 s, then holds — and it bursts up there, coiling)
     sweep          (white — its tail whips round in front of it at knee height; a perfect guard staggers it)
     spiral         (white — it rears and sings a spiral of notes; a perfect guard sends a note back)
     Untouchable while under the floor. Each eruption leaves it surfaced and slow for a moment.
     ========================================================================================= */
  const CZ = { rise: 1, spin: 0, rear: 0, tail: 0, coil: 1, open: 0, lean: 0, sway: 0 };
  // its spine in local coordinates (+x = the way it faces, floor at y = 0); part A: tail → rise → one loop of the
  // ring; part B: up through the ring's middle → neck → head
  function codaSpine(e, z) {
    const t = e.t, C = { x: 0, y: -84 }, rx = 33 * z.coil, ry = 38 * z.coil;
    const piv = { x: -6, y: -6 };
    // the tail: lying behind on the floor at rest; on the sweep it whips round in front at knee height
    const phi = PI * (1 - z.tail), Lt = 142;
    const tip = { x: piv.x + Math.cos(phi) * Lt, y: -5 - Math.sin(phi) * 18 * Math.min(1, z.tail * 3) };
    const lag = z.tail > 0.02 && z.tail < 0.98 ? 1 : 0;
    const ctl = { x: (piv.x + tip.x) / 2 - Math.sin(phi) * 30 * lag, y: Math.min(piv.y, tip.y) - 10 - 24 * lag };
    const A = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, w = Math.sin(u * PI * 2.2 + t * 3) * 2.5 * (1 - u) * (1 - z.tail);
      A.push({ x: (1 - u) * (1 - u) * tip.x + 2 * (1 - u) * u * ctl.x + u * u * piv.x, y: (1 - u) * (1 - u) * tip.y + 2 * (1 - u) * u * ctl.y + u * u * piv.y + w });
    }
    const nT = A.length;
    // rise from the floor into the bottom of the ring
    const b0 = { x: C.x - 5, y: C.y + ry };
    for (let i = 1; i <= 5; i++) { const u = i / 6; A.push({ x: U.lerp(piv.x, b0.x, u) + Math.sin(u * PI) * 6, y: U.lerp(piv.y, b0.y, U.easeOutCubic(u)) }); }
    // one loop: bottom → front → top → back → bottom
    const nR = 30;
    for (let i = 0; i <= nR; i++) {
      const th = PI / 2 - (i / nR) * TAU + 0.12, wob = Math.sin(th * 3 + t * 2.2 + z.spin) * 1.2;
      A.push({ x: C.x + Math.cos(th) * (rx + wob), y: C.y + Math.sin(th) * (ry + wob) });
    }
    // up through its own ring, the neck, the head (rearing back when it sings)
    const B = [], top = { x: C.x + 2, y: C.y - ry - 6 };
    const head = { x: 10 - z.rear * 16 + Math.sin(t * 1.6) * 2 * (1 - z.rear) + z.sway, y: C.y - ry - 36 + z.rear * 4 };
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      if (u < 0.6) { const k = u / 0.6; B.push({ x: U.lerp(C.x + 4, top.x, k) + Math.sin(k * PI) * 2.5, y: U.lerp(C.y + ry - 4, top.y, k) }); }
      else { const k = (u - 0.6) / 0.4; B.push({ x: U.lerp(top.x, head.x, U.easeInCubic(k)) + Math.sin(k * PI) * (4 - z.rear * 10), y: U.lerp(top.y, head.y, k) }); }
    }
    return { A, B, nT, C, rx, ry, head, tip };
  }
  // a variable-width ink body along a spine: wf(i) half width; cel-lit, gilt-banded, ivory-bellied
  function snakeBody(ctx, pts, wf, z, bands0) {
    const n = pts.length, Lp = [], Rp = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = wf(i);
      Lp.push({ x: pts[i].x - dy / d * w, y: pts[i].y + dx / d * w }); Rp.push({ x: pts[i].x + dy / d * w, y: pts[i].y - dx / d * w });
    }
    const path = () => { ctx.beginPath(); ctx.moveTo(Lp[0].x, Lp[0].y); for (let i = 1; i < n; i++) ctx.lineTo(Lp[i].x, Lp[i].y); for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rp[i].x, Rp[i].y); ctx.closePath(); };
    const Ld = Rig.lightDir(ctx); path(); ctx.fillStyle = cel(ctx, 0, -84, Ld.x, Ld.y, 46, LAC2); ctx.fill(); ink(ctx, 1.8);
    // ivory belly scutes along the inner edge
    ctx.strokeStyle = 'rgba(239,231,214,0.75)'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 1; i < n; i++) { const p = lp(pts[i], Rp[i], 0.55), q = lp(pts[i - 1], Rp[i - 1], 0.55); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); }
    ctx.stroke();
    // gilt bands, travelling along the body as it turns
    const sh = ((z.spin % 1) + 1) % 1;
    for (let i = 1; i < n - 1; i++) {
      if ((i + Math.floor(sh * 4) + bands0) % 4) continue;
      const w = wf(i); if (w < 2.5) continue;
      ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(Lp[i].x, Lp[i].y); ctx.lineTo(Rp[i].x, Rp[i].y); ctx.stroke();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.7; ctx.stroke();
    }
    return { Lp, Rp };
  }
  // a gilt fin: a fan of rays with a thin membrane (the coda's crossbar)
  function codaFin(ctx, root, dir, len, t, k) {
    const rays = 5;
    ctx.save(); ctx.translate(root.x, root.y); ctx.scale(dir, 1);
    const pts = []; for (let i = 0; i < rays; i++) { const a = -0.42 + i * 0.21 + Math.sin(t * 5 + i * 0.7) * 0.05 * k, l = len * (1 - Math.abs(i - 2) * 0.12); pts.push({ x: Math.cos(a) * l, y: Math.sin(a) * l * 0.55 }); }
    ctx.beginPath(); ctx.moveTo(0, -3); pts.forEach((p, i) => { if (i) { const m = lp(pts[i - 1], p, 0.5); ctx.quadraticCurveTo(m.x * 0.85 + 4, m.y * 0.85, p.x, p.y); } else ctx.lineTo(p.x, p.y); }); ctx.lineTo(0, 3); ctx.closePath();
    ctx.fillStyle = U.rgba('#e9c56c', 0.55); ctx.fill(); ink(ctx, 1.3);
    ctx.strokeStyle = GOLDD; ctx.lineWidth = 1.1; ctx.beginPath(); for (const p of pts) { ctx.moveTo(0, 0); ctx.lineTo(p.x, p.y); } ctx.stroke();
    lighter(ctx, () => { ctx.strokeStyle = U.rgba(GOLDL, 0.6); ctx.lineWidth = 0.8; ctx.beginPath(); for (const p of pts) { ctx.moveTo(2, 0); ctx.lineTo(p.x * 0.9, p.y * 0.9); } ctx.stroke(); });
    ctx.restore();
  }
  function codaHead(ctx, S, z, e, ghost) {
    const B = S.B, h = S.head, nk = B[B.length - 3];
    const ang = Math.atan2(h.y - nk.y, h.x - nk.x) * 0.25 - z.rear * 0.55 + 0.05;
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(ang);
    const op = z.open * 0.5;
    // lower jaw
    ctx.save(); ctx.rotate(op);
    poly(ctx, [[-6, 2], [16, 3], [22, 5.5], [8, 8], [-5, 7]]); ctx.fillStyle = cel(ctx, 6, 5, 0.6, -0.8, 9, LAC3); ctx.fill(); ink(ctx, 1.3);
    ctx.restore();
    if (op > 0.05) { if (!ghost) glow(ctx, 12, 3 + op * 6, 16, GOLDL, 0.9 * z.open); ctx.fillStyle = '#fff3cf'; poly(ctx, [[-2, 2], [18, 2.5 + op * 3], [10, 3 + op * 10]]); ctx.fill(); }
    // skull: a gilt-masked wedge
    const sk = () => { ctx.beginPath(); ctx.moveTo(-9, 6); ctx.quadraticCurveTo(-11, -6, -1, -9.5); ctx.quadraticCurveTo(12, -11, 24, -2.5); ctx.quadraticCurveTo(25.5, 1.5, 21, 3); ctx.lineTo(-4, 4); ctx.closePath(); };
    sk(); ctx.fillStyle = cel(ctx, 6, -3, 0.6, -0.8, 13, LAC2); ctx.fill(); ink(ctx, 1.6);
    ctx.save(); sk(); ctx.clip();
    poly(ctx, [[2, -12], [26, -4], [26, 4], [6, -1]]); ctx.fillStyle = cel(ctx, 14, -4, 0.6, -0.8, 10, GLT); ctx.fill(); ink(ctx, 1);
    ctx.restore();
    // eye: a white slit that burns gold
    if (!ghost) glow(ctx, 7, -3.5, 12, GOLD, 0.7);
    ctx.fillStyle = '#ffffff'; poly(ctx, [[3.6, -4.6], [11, -4.2], [8.4, -2]]); ctx.fill(); ink(ctx, 0.9);
    ctx.fillStyle = INK; ctx.fillRect(7.2, -4.4, 1.1, 2.2);
    // the crest: a small gilt coda sign on its crown
    ctx.translate(-3, -13); ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(0, 0, 4.2, 0, TAU); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
  }
  // the coda sign on the floor where it will come up (warning) — drawn flat, in red light
  function floorSigil(ctx, x, fl, k, hot) {
    // the danger zone itself: a red column as wide and as tall as the coil that will come up through it
    lighter(ctx, () => {
      const gr = ctx.createLinearGradient(x, fl - 200, x, fl);
      gr.addColorStop(0, U.rgba(RED, 0)); gr.addColorStop(1, U.rgba(RED, 0.16 + 0.26 * hot * k));
      ctx.fillStyle = gr; ctx.fillRect(x - 52, fl - 200, 104, 200);
      ctx.strokeStyle = U.rgba(RED, 0.35 + 0.4 * hot); ctx.lineWidth = 2;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * 52, fl); ctx.lineTo(x + sd * 52, fl - 60 - 90 * k); ctx.stroke(); }
    });
    // ink cracks spreading out from where it will break through
    ctx.save(); ctx.strokeStyle = U.rgba('#0b0612', 0.75); ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const sd = i % 2 ? 1 : -1, L = (14 + i * 7) * Math.min(1, k * 1.6); ctx.moveTo(x + sd * 4, fl - 1); ctx.lineTo(x + sd * L * 0.55, fl - 1 - (i % 3) * 1.4); ctx.lineTo(x + sd * L, fl + 0.5); }
    ctx.stroke(); ctx.restore();
    // the coda sign, drawn flat on the floor
    ctx.save(); ctx.translate(x, fl - 1); ctx.scale(1, 0.22);
    const r = 40 + 10 * (1 - k);
    lighter(ctx, () => {
      ctx.strokeStyle = U.rgba(RED, 0.5 + 0.5 * hot); ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.moveTo(0, -r - 26); ctx.lineTo(0, r + 26); ctx.moveTo(-r - 26, 0); ctx.lineTo(r + 26, 0); ctx.stroke();
      ctx.strokeStyle = U.rgba(GOLDL, 0.6 * hot); ctx.lineWidth = 2.5; ctx.stroke();
      K.glow(ctx, 0, 0, r * 1.9, RED, 0.3 + 0.4 * hot);
    });
    ctx.restore();
  }
  // under the floor: a gilt fin slicing through the boards, ink welling up in its wake
  function drawUnder(ctx, e, ghost) {
    const fl = floorAt(e.x, e.y - 8, e.y), t = e.t, f = Math.sign(e.vx) || e.facing;
    ctx.save();
    ctx.fillStyle = 'rgba(10,7,14,0.85)'; ctx.beginPath(); ctx.ellipse(e.x - f * 10, fl - 0.5, 34, 3.4, 0, 0, TAU); ctx.fill();
    for (let i = 1; i <= 3; i++) { const k = ((t * 2 + i / 3) % 1); ctx.strokeStyle = `rgba(10,7,14,${0.5 * (1 - k)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(e.x - f * (20 + k * 50), fl - 0.5, 10 + 26 * k, 2 + 2 * k, 0, 0, TAU); ctx.stroke(); }
    ctx.translate(e.x, fl); ctx.scale(f, 1);
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.quadraticCurveTo(-6, -10, 6, -26 - Math.sin(t * 9) * 2); ctx.quadraticCurveTo(8, -12, 16, 0); ctx.closePath();
    ctx.fillStyle = cel(ctx, 0, -10, 0.6, -0.8, 14, GLT); ctx.fill(); ink(ctx, 1.5);
    ctx.strokeStyle = GOLDD; ctx.lineWidth = 0.9; ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(-8 + i * 7, 0); ctx.lineTo(2 + i * 3, -18 + i * 5); } ctx.stroke();
    ctx.restore();
    if (!ghost && G.game.dtVis > 0 && Math.random() < 0.4) G.FX.ember(e.x, fl - 4, 1, '#1a1220', { w: 20, h: 4, up: 70, sp: 60, life: 0.4 });
  }

  // under the floor it can only swim where there is floor at its own level (it never crosses a pit or a step)
  const swimOK = (e, x) => Math.abs(floorAt(x, e.y - 30, 1e9) - e.y) < 20;
  const pathOK = (e, x1) => { const d = Math.sign(x1 - e.x) || 1; for (let x = e.x; d * (x1 - x) > 0; x += d * 30) if (!swimOK(e, x)) return false; return swimOK(e, x1); };
  function swimTo(e, tx, sp) {
    const dx = tx - e.x, d = Math.sign(dx);
    if (Math.abs(dx) < 6 || !swimOK(e, e.x + d * 40)) return 0;
    return U.clamp(dx * 6, -sp, sp);
  }
  const CS = reg('c8_coda', {
    name: '尾聲蛇', en: 'CODA SERPENT', w: 64, h: 150, hp: 180, bal: 90, col: '#f2d48a', shards: 80, kbMul: 0.3, poise: true, spawnT: 0.9,
    reachPad: 130, topPad: 60, portrait: [2.0, 0.9],
    init(e) { e.seed = seedOf(); e.mode = 'up'; e.downT = 0; e.upAtks = 0; e.tx = e.x; e.cd = 0.8 + Math.random() * 0.6; },
    voice: (e) => G.SFX.play('c8_codaVoice'),
    weapon: (e) => e.mode === 'down' ? { x: e.tx ?? e.x, y: floorAt(e.tx ?? e.x, e.y - 8, e.y) - 30 } : (e.headW || { x: e.x + e.facing * 10, y: e.y - 150 }),
    think(e, dt) {
      const P = e.P, d = e.distP();
      if (e.mode === 'down') {
        e.invuln = true; e.downT += dt;
        const dx = P.x - e.x; e.facing = dx < 0 ? -1 : 1;
        e.vx = U.approach(e.vx, Math.abs(dx) > 40 ? Math.sign(swimTo(e, P.x, 300)) * 300 * e.speedMul : 0, 1400 * dt);
        if ((Math.abs(dx) < 70 || e.downT > 1.5) && P.hp > 0) e.startAtk(CS.erupt);
        return;
      }
      e.invuln = false;
      e.faceP(); e.vx = U.approach(e.vx, 0, 900 * dt);
      if (e.cd > 0 || P.hp <= 0) return;
      if (d > 430 || (e.upAtks >= 2 && Math.random() < 0.6) || Math.abs(P.y - e.y) > 220) { e.startAtk(CS.burrow); return; }
      e.upAtks++;
      if (d < 175) e.startAtk(CS.sweep);
      else e.startAtk(CS.spiral);
    },
    burrow: {
      dur: 0.85, cd: 0.05, track: false,
      ev: [{ t: 0.12, fn: () => G.SFX.play('c8_burrow') }, { t: 0.4, fn: (e) => { e.invuln = true; } }, { t: 0.6, fn: (e) => { e.mode = 'down'; e.downT = 0; e.upAtks = 0; } }],
    },
    erupt: {
      dur: 1.65, cd: 1.5, track: false,
      tells: [{ t: 0.1, c: 'red', face: false }],
      hits: [{ t0: 1.0, t1: 1.18, box: { x: -52, y: -196, w: 104, h: 196 }, dmg: 32, red: true, kb: 360, last: true }],
      onStart(e) { e.tx = pathOK(e, e.P.x) ? e.P.x : e.x; e.mode = 'down'; e.invuln = true; G.SFX.play('c8_rumble'); },
      ev: [
        { t: 0.45, fn: (e) => { e.locked = true; } },
        { t: 1.0, fn: (e) => {
          e.mode = 'up'; e.invuln = false; e.locked = false; e.x = e.tx;
          const fl = floorAt(e.x, e.y - 8, e.y); G.SFX.play('c8_erupt'); G.game.shake(0.6);
          G.FX.ring(e.x, fl - 2, 10, 140, 0.5, GOLD, 4, { flat: 0.18 }); G.FX.shards(e.x, fl - 6, 16, '#1a1220', 520); G.FX.shards(e.x, fl - 6, 8, GOLD, 420);
        } },
      ],
    },
    sweep: {
      dur: 1.3, cd: 1.3, track: false, tells: [{ t: 0.15, c: 'white' }],
      moves: [{ t0: 0.62, t1: 0.74, v: 160 }],
      hits: [{ t0: 0.68, t1: 0.82, box: { x: -20, y: -50, w: 168, h: 48 }, dmg: 24, kb: 260, last: true, pbal: 55 }],
      ev: [{ t: 0.64, fn: () => G.SFX.play('c8_tail') }],
    },
    spiral: {
      dur: 2.0, cd: 1.8, track: false, tells: [{ t: 0.12, c: 'white' }],
      ev: Array.from({ length: 7 }, (_, i) => ({ t: 0.62 + i * 0.1, fn: (e) => spiralNote(e, i) })),
    },
    atkUpdate(e, dt) {
      const a = e.atk, P = e.P;
      if (a === CS.erupt) {
        if (e.st < 0.45) { const tx = clampArena(e, P.x, 50); if (pathOK(e, tx)) e.tx = tx; }
        if (e.st < 1.0) { e.vx = swimTo(e, e.tx, 620); if (!e.vx && e.st > 0.45 && Math.abs(e.tx - e.x) > 6) e.tx = e.x; }
        else e.vx = 0;
      }
    },
    tick(e, dt) { e.spin = (e.spin || 0) + dt * (e.atk === CS.spiral && e.state === 'atk' ? 2.4 : 0.35); },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, a = e.state === 'atk' ? e.atk : null, st = e.st, fl = floorAt(e.x, e.y - 8, e.y);
      if (a === CS.erupt && st < 1.06) {
        const hot = 0.5 + 0.5 * Math.sin(st * (e.locked ? 36 : 16));
        if (!ghost && st > 0.08) floorSigil(ctx, e.tx, floorAt(e.tx, e.y - 8, e.y), U.clamp(st / 1.0, 0, 1), hot);
      }
      const under = e.mode === 'down' && e.state !== 'die' && !(a === CS.erupt && st >= 1.0);
      if (under) { if (e.state !== 'spawn') drawUnder(ctx, e, ghost); return; }
      let tgt = Object.assign({}, CZ, { coil: 1 + Math.sin(e.t * 2.1) * 0.03, sway: Math.sin(e.t * 1.3) * 3 });
      if (a === CS.burrow) { const k = U.clamp((st - 0.12) / 0.6, 0, 1); tgt.rise = 1 - U.easeInCubic(k); tgt.rear = -0.4 * k; }
      else if (a === CS.erupt) { const k = U.clamp((st - 1.0) / 0.14, 0, 1); tgt.rise = U.easeOutBack(k); tgt.coil = 0.8 + 0.2 * k; tgt.open = st < 1.3 ? 1 : 0; }
      else if (a === CS.sweep) {
        if (st < 0.62) { const k = U.clamp(st / 0.5, 0, 1); tgt.tail = -0.12 * k; tgt.lean = -0.08 * k; tgt.rear = 0.25 * k; }
        else { const k = U.clamp((st - 0.62) / 0.16, 0, 1); tgt.tail = U.easeOutCubic(k) * (st < 1.0 ? 1 : 1 - U.clamp((st - 1.0) / 0.3, 0, 1)); tgt.lean = 0.12; }
      } else if (a === CS.spiral) { const k = U.clamp(st / 0.55, 0, 1); tgt.rear = U.easeOutCubic(k) * (st < 1.5 ? 1 : 1 - (st - 1.5) / 0.5); tgt.open = st > 0.55 && st < 1.45 ? 1 : 0.2 * k; }
      else if (e.state === 'hurt' || e.state === 'recoil') { tgt.rear = 0.6; tgt.coil = 0.92; tgt.open = 0.5; }
      else if (e.state === 'broken' || e.state === 'executed') { tgt.rear = -0.6; tgt.coil = 0.86; tgt.open = 0.3; tgt.lean = 0.3; }
      const z = Object.assign({}, blendTo(e, 'pz', tgt, dt, a ? 24 : 10));
      if (a === CS.erupt || a === CS.burrow) { z.rise = tgt.rise; }
      if (e.state === 'spawn' || e.state === 'die') z.rise = 1;
      if (e.hitK > 0) { z.rear += e.hitK * 0.5; z.coil -= e.hitK * 0.05; }
      z.spin = e.spin || 0;
      const S = codaSpine(e, z);
      const sink = (1 - Math.min(1, z.rise)) * 200;
      // a pool of ink where its body leaves the floor
      ctx.save(); ctx.fillStyle = 'rgba(10,7,14,0.88)'; ctx.beginPath(); ctx.ellipse(e.x - e.facing * 4, fl - 0.5, 26 + (1 - Math.min(1, z.rise)) * 20, 3.6, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save();
      if (sink > 0.5) { ctx.beginPath(); ctx.rect(e.x - 400, fl - 1200, 800, 1200); ctx.clip(); }
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing, 1);
      ctx.translate(0, -60); ctx.rotate(z.lean + (1 - Math.min(1, z.rise)) * 0.8); ctx.translate(0, 60);
      const wA = (i) => { if (i < S.nT) { const u = i / (S.nT - 1); return 1.4 + 8.2 * u * u; } return Math.min(12.5, 9.6 + (i - S.nT) * 0.5); };
      const tailFront = z.tail > 0.5;
      // the part of the tail and coil behind; fins across the ring; then the climb through the middle and the head
      if (!tailFront) snakeBody(ctx, S.A, wA, z, 0);
      else snakeBody(ctx, S.A.slice(S.nT - 1), (i) => wA(i + S.nT - 1), z, 1);
      const fk = 1 + (a === CS.spiral ? 1 : 0);
      codaFin(ctx, { x: S.C.x - S.rx + 2, y: S.C.y }, -1, 34 + 6 * fk, e.t, fk);
      codaFin(ctx, { x: S.C.x + S.rx - 2, y: S.C.y }, 1, 34 + 6 * fk, e.t + 0.5, fk);
      snakeBody(ctx, S.B, (i) => 11 - i * 0.22, z, 2);
      if (tailFront) {
        snakeBody(ctx, S.A.slice(0, S.nT), (i) => wA(i), z, 0);
        if (a === CS.sweep && st > 0.64 && st < 0.9) lighter(ctx, () => { const k = (st - 0.64) / 0.26; ctx.strokeStyle = U.rgba('#ffffff', 0.7 * (1 - k)); ctx.lineWidth = 10 * (1 - k) + 2; ctx.beginPath(); ctx.ellipse(-6, -14, 146, 24, 0, PI * 0.95, PI * 0.95 + PI * 0.85 * Math.min(1, k * 2.5), true); ctx.stroke(); });
      }
      // the tail's tip carries a little gilt rattle: the coda's two dots
      { const tp = S.tip; ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(tp.x, tp.y, 2.6, 0, TAU); ctx.fill(); ink(ctx, 0.8); }
      codaHead(ctx, S, z, e, ghost);
      if (!ghost) e.headW = { x: e.x + e.facing * (S.head.x + 14), y: e.y + sink + S.head.y };
      if (e.tellT > 0) glow(ctx, S.head.x + 12, S.head.y, 30, e.tellCol === 'red' ? RED : '#ffffff', e.tellT * 1.4);
      if (!ghost && !low()) glow(ctx, S.C.x, S.C.y, 40, GOLD, 0.12 + (a === CS.spiral ? 0.25 : 0));
      ctx.restore();
      if (e.state === 'broken') dizzy(ctx, e.x + e.facing * S.head.x, e.y + S.head.y - 24, e.t, 16);
      // ink drips off it as it rises
      if (!ghost && dt > 0 && z.rise < 0.99 && z.rise > 0.05 && Math.random() < 0.6) G.FX.ember(e.x, fl - 30, 1, '#1a1220', { w: 40, h: 30, up: -40, sp: 80, life: 0.5 });
    },
  });
  // the spiral: notes thrown out in a turning fan, each curling as it flies (white — a perfect guard sends one back)
  function spiralNote(e, i) {
    const g = G.game, P = g.player, H = e.headW || { x: e.x + e.facing * 20, y: e.y - 150 };
    if (!P) return;
    const base = Math.atan2(P.y - 60 - H.y, P.x - H.x), a = base + (i - 3) * 0.2 * (e.seed % 2 ? 1 : -1), sp = 225;
    g.hazards.push({ t: 0, life: 3.4, x: H.x, y: H.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, w: (i % 2 ? 1 : -1) * 0.55, owner: e, dmg: 18, r: 10, passed: false, n: i, seed: seedOf(), update: noteUpdate, draw: noteDraw });
    G.SFX.play('c8_note', i); G.FX.ring(H.x, H.y, 4, 26, 0.25, GOLDL, 2);
  }
  function noteUpdate(h, dt, g) {
    const P = g.player, c = Math.cos(h.w * dt), s = Math.sin(h.w * dt), vx = h.vx * c - h.vy * s; h.vy = h.vx * s + h.vy * c; h.vx = vx;
    h.x += h.vx * dt; h.y += h.vy * dt;
    if (solidAt(h.x, h.y)) { h.done = true; G.FX.spark(h.x, h.y, 8, { col: GOLDL, speed: 300 }); return; }
    if (!P || h.passed) return;
    const hb = P.hurtbox;
    if (h.x + h.r > hb.x && h.x - h.r < hb.x + hb.w && h.y + h.r > hb.y && h.y - h.r < hb.y + hb.h) {
      const res = P.receiveHit(h.owner, { dmg: h.dmg, kb: 170, projectile: true, hx: h.x, hy: h.y, waveFrom: h.x });
      if (res === 'parried') {
        g.projectiles.push({ x: h.x, y: h.y, vx: -h.vx * 1.5, vy: -h.vy * 0.4 - 80, r: 11, owner: h.owner, friendly: true, dmg: h.dmg, life: 3, t: 0, col: GOLDL });
        G.FX.ring(h.x, h.y, 6, 60, 0.3, '#7ff4ff', 4); h.done = true;
      } else if (res === 'dodged' || res === 'ignored') h.passed = true;
      else { h.done = true; G.FX.spark(h.x, h.y, 10, { col: GOLDL, speed: 360 }); }
    }
  }
  function noteDraw(ctx, h) {
    const a = Math.min(1, h.t * 6) * (h.t > h.life - 0.3 ? Math.max(0, (h.life - h.t) / 0.3) : 1);
    ctx.globalAlpha *= a;
    glow(ctx, h.x, h.y, 24, GOLD, 0.45);
    lighter(ctx, () => { ctx.fillStyle = U.rgba(GOLDL, 0.6); for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(h.x - h.vx * 0.03 * i, h.y - h.vy * 0.03 * i, 2.3 - i * 0.5, 0, TAU); ctx.fill(); } });
    ctx.translate(h.x, h.y); ctx.rotate(Math.sin(h.t * 6 + h.seed) * 0.35);
    // an eighth note in gilt and ink
    ctx.beginPath(); ctx.ellipse(-2.5, 4, 6, 4.3, -0.45, 0, TAU); ctx.fillStyle = GOLDL; ctx.fill(); ink(ctx, 1.3);
    ctx.beginPath(); ctx.moveTo(3.1, 2.5); ctx.lineTo(3.1, -15); ctx.quadraticCurveTo(5, -9, 11, -6); ctx.quadraticCurveTo(7, -9.5, 5, -13);
    ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = GOLDL; ctx.lineWidth = 1.5; ctx.stroke();
  }

  /* =========================================================================================
     c8_elite 第一降臨隊 THE FIRST DESCENT — Maestrina's own squad, twenty years in the Rest: hollow now, porcelain
     masks over nothing, black coats with a hole of white silence where a heart was. Three still march together:
       c8_elite        旗手 the standard-bearer (lead, the type the encounter spawns): a lancer with the squad's banner
       c8_elite_shield 鼓盾手 the drumshield: a war drum worn as a shield, a felt mallet
       c8_elite_bell   鳴鐘者 the bell-ringer: a crook-staff with a hanging bell
     The banner cannot fall while one of them stands: at 0 HP the standard-bearer kneels behind it, untouchable, and
     falls with the last of them — then the elite defeat flow runs. The elite bar shows the whole squad's strength.
     Synergies: the drumshield braces (its drum turns blows, and covers whoever stands behind it) while the lancer
     charges straight through; the bell's chime heals and hastens the others and makes one ally's next attack RED.
     lancer  thrust (white, long) · sweep (white, wide) · charge (red — straight across the floor; jump or dodge it)
     drum    bash (white) · boom (red — a ring of sound rolls along the floor: jump or dodge) · brace (guard + cover)
     bell    chime (heal / haste / empower — strike the bell-ringer to interrupt it) · peal (white ring along the floor;
             a perfect guard sends it back) · toll (white, a close swing of the bell)
     ========================================================================================= */
  const squadOf = (e) => { const L = e.type === 'c8_elite' ? e : e.lead; return L ? [L].concat(L.squad || []) : [e]; };
  const standing = (q) => alive(q) && !q.kneel;
  const baseOf = (a) => a && (a.white || a);
  // start an attack; carrying the bell's last note, a white attack comes out red instead (support moves and attacks
  // that are red anyway leave the note for the next one)
  function go(e, def) {
    if (e.c8red && !def.support && (def.tells || []).some((t) => t.c !== 'red')) { e.c8red = false; def = redOf(def); }
    e.startAtk(def);
  }
  function squadTick(e, dt) { if (e.hasteT > 0) { e.hasteT -= dt; if (e.state === 'idle' && e.cd > 0) e.cd -= dt * 0.6; } }
  // a braced drumshield standing between an ally and Rinne covers that ally
  function coverOf(e) {
    const P = G.game.player; if (!P) return null;
    for (const q of squadOf(e)) {
      if (q === e || !alive(q) || q.type !== 'c8_elite_shield' || q.state !== 'atk' || baseOf(q.atk) !== SH.brace || q.st < 0.18 || q.st > SH.brace.guardTo) continue;
      if (Math.abs(q.x - e.x) < 160 && Math.sign(q.x - e.x) === Math.sign(P.x - e.x) && Math.abs(P.x - e.x) > Math.abs(q.x - e.x) - 10) return q;
    }
    return null;
  }
  function coverGuard(e) {
    const q = coverOf(e); if (!q) return false;
    q.coverFx = 1; e.coverFx = 1; e.coverBy = q; G.SFX.play('c8_drum', 0.45);
    return true;
  }

  /* ---- the squad keeper: the shared elite bar, the cover arcs, and the standard-bearer's last fall ---- */
  const Squad = {
    h: null,
    ensure() { const g = G.game; if (this.h && g.hazards.indexOf(this.h) >= 0) return; this.h = { t: 0, c8squad: true, update: squadUpdate, draw: squadDraw }; g.hazards.push(this.h); },
  };
  function squadBar(L) {
    if (L._bar) return L._bar;
    const all = () => [L].concat(L.squad || []);
    L._sqMax = all().reduce((s, q) => s + q.maxHp, 0) || 1;
    L._bar = {
      elite: true, T: L.T, lead: L,
      get hp() { let s = 0; for (const q of all()) if (!q.dead && !q.kneel) s += Math.max(0, q.hp); return s; },
      get maxHp() { return L._sqMax; }, get bal() { return L.bal; }, get maxBal() { return L.maxBal; },
      get state() { return L.state; }, get x() { return L.x; }, get y() { return L.y; }, get h() { return L.h; }, get dead() { return L.dead && !L.kneel; },
    };
    return L._bar;
  }
  function squadUpdate(h, dt, g) {
    // (a kneeling bearer is out of play — flagged dead/untargetable so blows, aim assist and Echoes go to the
    // two still standing — but it is still here, waiting for them)
    const leads = g.enemies.filter((q) => q.type === 'c8_elite' && (!q.dead || q.kneel));
    if (!leads.length) { h.done = true; if (Squad.h === h) Squad.h = null; return; }
    for (const L of leads) {
      if (g.bossRef === L && (L.squad || []).length) { g.bossRef = squadBar(L); G.UI.hudCache && (G.UI.hudCache.bhp = null); }
      // the other two fell first: alone, the banner falters — the bearer keeps at most half its strength (the trio is
      // one fight, not a long duel tacked on after it)
      if (!L.kneel && !L.alone && (L.squad || []).length && !L.squad.some(standing)) {
        L.alone = true; L.hp = Math.min(L.hp, Math.round(L.maxHp * 0.5)); L.flash = 1;
        G.SFX.play('c8_flag'); G.FX.ring(L.x, L.y - 70, 10, 140, 0.5, GOLDL, 3);
        G.game.bark('c8_eliteAlone', true);
      }
      // the last of them fell: the banner comes down, and its bearer with it
      if (L.kneel && !(L.squad || []).some(standing)) {
        L.kneel = false; L.invuln = false; L.untargetable = false; L.dead = false; L.hp = 0;
        G.SFX.play('c8_flag'); G.FX.ring(L.x, L.y - 60, 10, 160, 0.6, '#ffffff', 3);
        L.die();
      }
    }
  }
  function squadDraw(ctx, h, g) {
    for (const q of g.enemies) {
      if (!q.coverBy || !(q.coverFx > 0.02) || q.dead) continue;
      const s = q.coverBy; if (s.dead) continue;
      const k = q.coverFx, a = { x: s.x, y: s.y - 70 }, b = { x: q.x, y: q.y - 80 };
      lighter(ctx, () => {
        ctx.strokeStyle = U.rgba(GOLDL, 0.7 * k); ctx.lineWidth = 2 + 3 * k;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 60, b.x, b.y); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(q.x, q.y - 70, 40, 70, 0, 0, TAU); ctx.strokeStyle = U.rgba(GOLD, 0.35 * k); ctx.stroke();
      });
    }
  }

  /* ---- shared hollow-soldier painting (Rig skeleton; local units, +x = facing) ---- */
  const gs = (p) => Rig.full(Rig.groundify(p));
  function soldierPose(e, dt, PS) {
    const st = e.state, a = st === 'atk' ? e.atk : null;
    let p;
    if (e.kneel || st === 'broken' || st === 'executed') p = Rig.full(Object.assign({}, PS.kneel, { torso: PS.kneel.torso + Math.sin(e.t * 2) * 0.04, head: PS.kneel.head + Math.sin(e.t * 1.3) * 0.05 }));
    else if (a && a.anim) p = Rig.sample(a.anim, e.st);
    else if (st === 'hurt' || st === 'recoil') p = PS.hurt;
    else if (Math.abs(e.vx) > 30 && e.onGround) {
      if (dt > 0) e.gaitP += e.vx * e.facing * dt * PI / 32;
      const w = AN.walk(e.gaitP);
      p = Rig.full(Object.assign({}, PS.idle(e.t), { ik: 1, fFx: w.fFx + 3, fFy: w.fFy, fBx: w.fBx - 3, fBy: w.fBy, ry: w.ry + 3 }));
    } else p = gs(PS.idle(e.t));
    if (e.hitK > 0 && st !== 'die') p = Rig.lerpPose(p, Rig.full(Object.assign({}, p, { torso: p.torso - 0.28, head: p.head + 0.35, ry: p.ry + 3 })), Math.min(1, e.hitK * 1.2));
    if (!e.pose) e.pose = p;
    else if (dt > 0) e.pose = Rig.lerpPose(e.pose, p, 1 - Math.exp(-(e.hitK > 0 ? 38 : a ? 26 : 12) * dt));
    return e.pose;
  }
  // porcelain mask in profile: a brow, a ridge of a nose, empty eyes with a pinprick of white far inside
  function mask(ctx, J, ghost, tilt = 0) {
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha + tilt);
    const m = () => { ctx.beginPath(); ctx.moveTo(-3, -10.5); ctx.quadraticCurveTo(6, -11.5, 8.6, -5); ctx.lineTo(11, 0.6); ctx.lineTo(8.6, 2.2); ctx.quadraticCurveTo(9.4, 7.6, 4.4, 10.6); ctx.quadraticCurveTo(-1.6, 11.6, -4, 8); ctx.closePath(); };
    m(); ctx.fillStyle = cel(ctx, 3, 0, 0.6, -0.8, 11, IVO); ctx.fill(); ink(ctx, 1.4);
    ctx.fillStyle = '#07050a'; ctx.beginPath(); ctx.moveTo(2.6, -3.4); ctx.quadraticCurveTo(6, -5.4, 8.4, -2.6); ctx.quadraticCurveTo(5.6, -0.6, 2.6, -3.4); ctx.fill();
    if (!ghost) glow(ctx, 5.4, -3, 6, '#ffffff', 0.6);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(5.6, -2.9, 0.75, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(6, 3); ctx.lineTo(3.6, 5.5); ctx.lineTo(4.2, 8.4); ctx.moveTo(-2, -8); ctx.lineTo(0.6, -4.6); ctx.stroke();
    ctx.restore();
  }
  function boot(ctx, an, to, hex) {
    const dx = to.x - an.x, dy = to.y - an.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    const P = (u, v) => ({ x: an.x + ux * u + nx * v, y: an.y + uy * u + ny * v });
    polyP(ctx, [P(-5, -5), P(4, -5.4), P(d + 5, -1.4), P(d + 6, 2), P(-3, 4)]);
    ctx.fillStyle = cel(ctx, an.x + ux * d * 0.5, an.y + uy * d * 0.5, nx, ny, 5, hex); ctx.fill(); ink(ctx, 1.1);
  }
  // coat, legs, arms, the hollow — the far-side item and near-side item come from the caller
  function hollowSoldier(ctx, e, p, J, o, ghost) {
    const { Q, nx, ny } = torsoQ(J), s = o.s, f = e.facing, b = o.broad || 1;
    const toL = (q) => ({ x: (q.x - e.x) * f / s, y: (q.y - e.y) / s });
    if (e.coatB && e.coatB.inited) { const cp = e.coatB.p.map(toL); cp[0] = { x: J.hip.x - 5, y: J.hip.y - 2 }; K.tattered(ctx, cp, 8 * b, 13 * b, '#191520', 'rgba(214,170,84,0.45)', e.seed % 5); }
    if (o.farItem && !o.itemFront) o.farItem();
    LC(ctx, [J.shB, J.elB, J.hdB], [4.6 * b, 4 * b, 3.4], LAC);
    ctx.beginPath(); ctx.arc(J.hdB.x, J.hdB.y, 3.8, 0, TAU); ctx.fillStyle = cel(ctx, J.hdB.x, J.hdB.y, 0.6, -0.8, 4, '#2a2334'); ctx.fill(); ink(ctx, 1);
    LC(ctx, [J.hip, J.kneeB, J.ankB], [6.4 * b, 5.2 * b, 4], '#221d2a'); boot(ctx, J.ankB, J.toeB, LAC);
    // the front skirt of the long coat, ragged at the hem
    if (!o.robe && e.coatF && e.coatF.inited) { const cp = e.coatF.p.map(toL); cp[0] = { x: J.hip.x + 4, y: J.hip.y - 2 }; K.tattered(ctx, cp, 7 * b, 11 * b, '#221c29', 'rgba(214,170,84,0.55)', (e.seed + 2) % 5); }
    LC(ctx, [J.hip, J.kneeF, J.ankF], [6.8 * b, 5.6 * b, 4.2], '#2a2432'); boot(ctx, J.ankF, J.toeF, LAC2);
    if (o.robe) {
      // a long robe to the ankles, flared, its hem cut ragged and edged in gilt
      const ay = Math.max(J.ankF.y, J.ankB.y) - 3, x0 = Math.min(J.ankB.x, J.ankF.x) - 13, x1 = Math.max(J.ankB.x, J.ankF.x) + 11, sw = Math.sin(e.t * 1.8 + e.seed) * 2 - e.vx * f * 0.015;
      const hem = []; for (let i = 0; i <= 8; i++) { const k = i / 8; hem.push({ x: U.lerp(x1, x0, k) + sw * (1 + k), y: ay + (i % 2 ? 3.5 : 0) + Math.sin(k * 7 + e.t * 2) * 1.2 }); }
      const robe = [Q(0.04, -10.5 * b), Q(0.04, 10.5 * b), ...hem];
      polyP(ctx, robe); ctx.fillStyle = cel(ctx, J.hip.x, (J.hip.y + ay) / 2, 1, 0, 16, LAC2); ctx.fill(); ink(ctx, 1.5);
      ctx.save(); polyP(ctx, robe); ctx.clip();
      line(ctx, Q(0.04, 2), { x: (x0 + x1) / 2 + sw * 1.5 + 2, y: ay + 4 }, 'rgba(236,228,212,0.35)', 1);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6; ctx.beginPath(); hem.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y - 3) : ctx.moveTo(q.x, q.y - 3))); ctx.stroke();
      ctx.restore();
    }
    // the coat's body: a deep black chest, gilt piping, a belt; a crimson band on the arm — her colour
    const tp = [Q(-0.06, -10 * b), Q(0.35, -11 * b), Q(0.82, -12.5 * b), Q(1.08, -8 * b), Q(1.14, 2), Q(1.02, 10 * b), Q(0.74, 13 * b), Q(0.4, 11 * b), Q(0.06, 10 * b)];
    smoothP(ctx, tp); const tm = Q(0.55, 1); ctx.fillStyle = cel(ctx, tm.x, tm.y, nx, ny, 14 * b, LAC2); ctx.fill(); ink(ctx, 1.6);
    ctx.save(); smoothP(ctx, tp); ctx.clip();
    line(ctx, Q(1.06, 3), Q(0.05, 7 * b), U.rgba(GOLD, 0.95), 1.4);
    // the hollow: a ragged hole torn through the chest, and white silence where the heart was
    const hc = Q(0.68, -2.5 * b), hr = 7 * b, ang = (i) => i / 11 * TAU;
    const hole = () => { ctx.beginPath(); for (let i = 0; i < 11; i++) { const r = hr * (0.62 + hash(i, e.seed) * 0.55); const x = hc.x + Math.cos(ang(i)) * r * 0.85, y = hc.y + Math.sin(ang(i)) * r * 1.15; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); };
    hole(); ctx.fillStyle = '#fffdf6'; ctx.fill();
    ctx.restore();
    hole(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    hole(); ctx.strokeStyle = U.rgba(GOLD, 0.8); ctx.lineWidth = 0.7; ctx.stroke();
    if (!ghost) {
      glow(ctx, hc.x, hc.y, 20 * b, '#fffaf0', 0.6 + 0.15 * Math.sin(e.t * 2.4));
      if (G.game.dtVis > 0 && Math.random() < 0.08) { const s0 = o.s, wx = e.x + f * hc.x * s0, wy = e.y + hc.y * s0; G.FX.ember(wx, wy, 1, '#ffffff', { w: 8, h: 8, up: 40, sp: 20, life: 0.8 }); }
    }
    LB(ctx, Q(0.1, -10.5 * b), Q(0.1, 10.5 * b), 2.6, 2.6, GLT, { noHatch: true });
    if (o.chest) o.chest(Q);
    o.head();
    if (o.nearItemBeforeArm) o.nearItemBeforeArm();
    LC(ctx, [J.sh, J.elF, J.hdF], [5 * b, 4.3 * b, 3.6], LAC2);
    const cb = lp(J.sh, J.elF, 0.55), ca = Math.atan2(J.elF.y - J.sh.y, J.elF.x - J.sh.x);
    ctx.save(); ctx.translate(cb.x, cb.y); ctx.rotate(ca); ctx.fillStyle = cel(ctx, 0, 0, 0.6, -0.8, 5, CRM); ctx.fillRect(-3, -5.6 * b, 6, 11.2 * b); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(-3, -5.6 * b, 6, 11.2 * b); ctx.restore();
    // epaulette with a gilt fringe
    ctx.beginPath(); ctx.ellipse(J.sh.x, J.sh.y + 1, 8 * b, 5, -0.25, PI, TAU); ctx.closePath(); ctx.fillStyle = cel(ctx, J.sh.x, J.sh.y, 0.6, -0.8, 8, LAC3); ctx.fill(); ink(ctx, 1.2);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.beginPath(); for (let i = -3; i <= 3; i++) { ctx.moveTo(J.sh.x + i * 2.2 * b, J.sh.y + 1); ctx.lineTo(J.sh.x + i * 2.3 * b, J.sh.y + 4.5); } ctx.stroke();
    ctx.beginPath(); ctx.arc(J.hdF.x, J.hdF.y, 4, 0, TAU); ctx.fillStyle = cel(ctx, J.hdF.x, J.hdF.y, 0.6, -0.8, 4, '#2a2334'); ctx.fill(); ink(ctx, 1);
    if (o.farItem && o.itemFront) o.farItem();
    if (o.nearItem) o.nearItem();
  }
  // world-space cloth: coat panels from the hips, plus whatever the type hangs on itself
  function coatTick(e, dt, s) {
    const f = e.facing, hx = e.x + f * ((e.pose ? e.pose.rx : 0) - 4) * s, hy = e.y - (DIM.HIP - (e.pose ? e.pose.ry : 0)) * s;
    if (!e.coatB.inited) e.coatB.reset(hx, hy);
    if (!e.coatF.inited) e.coatF.reset(hx, hy);
    e.coatB.update(hx - f * 5 * s, hy, f, dt, -e.vx * 6 + Math.sin(e.t * 1.7 + e.seed) * 120, 2.85);
    e.coatF.update(hx + f * 4 * s, hy, f, dt, -e.vx * 5 + Math.sin(e.t * 2.1 + e.seed) * 100, 2.95);
  }
  function empowerFx(ctx, e, pt) {
    if (!e.c8red) return;
    const k = 0.6 + 0.4 * Math.sin(e.t * 9);
    glow(ctx, pt.x, pt.y, 26, CRIMSON, 0.7 * k);
    lighter(ctx, () => { ctx.fillStyle = U.rgba(CRIML, 0.9); for (let i = 0; i < 3; i++) { const a = e.t * 3 + i * TAU / 3; ctx.beginPath(); ctx.arc(pt.x + Math.cos(a) * 14, pt.y + Math.sin(a) * 6, 1.6, 0, TAU); ctx.fill(); } });
  }

  /* ---------------- the standard-bearer (lead) ---------------- */
  const LNS = 1.22, LANCE_F = 132, LANCE_B = 46;
  const LNP = {
    idle: (t) => ({ ry: 3 + Math.sin(t * 1.5) * 1, torso: 0.06 + Math.sin(t * 1.5) * 0.012, head: 0.02, tF: 0.32, kF: -0.4, tB: -0.3, kB: -0.22, aF: 0.55, eF: 1.25, aB: -0.2, eB: 0.6, sw: PI - 0.08 }),
    thrA: { ry: 10, torso: -0.04, head: -0.04, tF: 0.6, kF: -0.8, tB: -0.6, kB: -0.3, aF: -0.35, eF: 1.75, aB: 0.8, eB: 1.5, sw: 1.52, hold: 1 },
    thrB: { ry: 18, torso: 0.55, head: -0.12, tF: 1.1, kF: -0.7, tB: -1.0, kB: -0.15, aF: 1.4, eF: 0.06, aB: 1.2, eB: 0.4, sw: 1.57, hold: 1 },
    swA: { ry: 6, torso: -0.22, head: -0.1, tF: 0.5, kF: -0.6, tB: -0.45, kB: -0.3, aF: 2.6, eF: 0.5, aB: 2.2, eB: 0.6, sw: 3.9, hold: 1 },
    swB: { ry: 14, torso: 0.45, head: 0.05, tF: 0.95, kF: -0.95, tB: -0.6, kB: -0.25, aF: 1.25, eF: 0.1, aB: 1.0, eB: 0.4, sw: 1.15, hold: 1 },
    chA: { ry: 20, torso: 0.62, head: -0.25, tF: 0.95, kF: -1.2, tB: -0.7, kB: -0.5, aF: 0.75, eF: 1.0, aB: 0.9, eB: 1.0, sw: 1.5, hold: 1 },
    chR: { ry: 14, torso: 0.7, head: -0.3, tF: 1.25, kF: -0.7, tB: -1.1, kB: -0.9, aF: 0.9, eF: 0.8, aB: 1.0, eB: 0.9, sw: 1.55, hold: 1 },
    hurt: { ry: 8, torso: -0.4, head: 0.5, tF: 0.2, kF: -0.6, tB: -0.6, kB: -0.4, aF: 0.2, eF: 1.4, aB: -0.8, eB: 0.8, sw: 2.6 },
    kneel: { ry: 30, torso: 0.36, head: 0.55, tF: 1.35, kF: -1.35, tB: 0.05, kB: -1.6, aF: 2.0, eF: 0.9, aB: 0.6, eB: 1.0, sw: PI - 0.02 },
  };
  for (const k of ['thrA', 'thrB', 'swA', 'swB', 'chA', 'chR', 'hurt']) LNP[k] = gs(LNP[k]);
  LNP.kneel = Rig.full(LNP.kneel);
  const LNI = () => gs(LNP.idle(0));
  function lanceTip(J, sw) { const v = dirv(sw, 1); return { x: J.hdF.x + v.x * LANCE_F, y: J.hdF.y + v.y * LANCE_F }; }
  function drawLance(ctx, e, J, sw, hot, red, ghost) {
    const v = dirv(sw, 1), nx = -v.y, ny = v.x, h = J.hdF, butt = { x: h.x - v.x * LANCE_B, y: h.y - v.y * LANCE_B }, tip = lanceTip(J, sw);
    const neck = { x: tip.x - v.x * 30, y: tip.y - v.y * 30 };
    // banner first (a gonfalon hanging from the crossbar under the head, behind the shaft)
    const cb = { x: neck.x - v.x * 6, y: neck.y - v.y * 6 }, an = { x: cb.x + nx * 7, y: cb.y + ny * 7 };
    if (e.flag && e.flag.inited) {
      const fp = e.flag.p.map((q) => ({ x: (q.x - e.x) * e.facing / LNS, y: (q.y - e.y) / LNS }));
      fp[0] = an;
      const n = fp.length, L = [], R = [];
      for (let i = 0; i < n; i++) { const a = fp[Math.max(0, i - 1)], b = fp[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = 11.5 - i * 0.25; L.push({ x: fp[i].x - dy / d * w, y: fp[i].y + dx / d * w }); R.push({ x: fp[i].x + dy / d * w, y: fp[i].y - dx / d * w }); }
      const back = lp(fp[n - 1], fp[n - 2], 0.9);
      const path = () => { ctx.beginPath(); ctx.moveTo(L[0].x, L[0].y); for (let i = 1; i < n; i++) ctx.lineTo(L[i].x, L[i].y); ctx.lineTo(back.x, back.y); for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y); ctx.closePath(); };
      path(); ctx.fillStyle = cel(ctx, fp[n >> 1].x, fp[n >> 1].y, 1, 0, 12, IVO); ctx.fill(); ink(ctx, 1.4);
      ctx.save(); path(); ctx.clip();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < n; i++) { const q = lp(L[i], fp[i], 0.16); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
      for (let i = 0; i < n; i++) { const q = lp(R[i], fp[i], 0.16); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
      ctx.stroke();
      ctx.restore();
      // the sigil: a crimson crown over five lines — hers
      const m = fp[3], ang = Math.atan2(fp[4].y - fp[2].y, fp[4].x - fp[2].x) - PI / 2;
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(ang);
      ctx.strokeStyle = 'rgba(11,6,18,0.65)'; ctx.lineWidth = 0.7; ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(-7, 3.5 + i * 1.7); ctx.lineTo(7, 3.5 + i * 1.7); } ctx.stroke();
      poly(ctx, [[-6.4, 1.8], [-7, -5.4], [-3, -1.8], [0, -7], [3, -1.8], [7, -5.4], [6.4, 1.8]]); ctx.fillStyle = cel(ctx, 0, -2, 0.6, -0.8, 7, CRM); ctx.fill(); ink(ctx, 1);
      ctx.fillStyle = GOLDL; for (const x of [-7, 0, 7]) { ctx.beginPath(); ctx.arc(x, x ? -5.6 : -7.2, 1.1, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    LB(ctx, butt, neck, 2.4, 2.1, LAC, { noHatch: true });
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.1; ctx.beginPath(); for (const k of [0.12, 0.5, 0.86]) { const q = lp(butt, neck, k); ctx.moveTo(q.x + nx * 2.8, q.y + ny * 2.8); ctx.lineTo(q.x - nx * 2.8, q.y - ny * 2.8); } ctx.stroke();
    // the crossbar the banner hangs from, and the gilt collar
    line(ctx, { x: cb.x + nx * 20, y: cb.y + ny * 20 }, { x: cb.x - nx * 5, y: cb.y - ny * 5 }, INK, 3.8); line(ctx, { x: cb.x + nx * 20, y: cb.y + ny * 20 }, { x: cb.x - nx * 5, y: cb.y - ny * 5 }, GOLD, 2);
    for (const k of [-5, 20]) { ctx.beginPath(); ctx.arc(cb.x + nx * k, cb.y + ny * k, 2, 0, TAU); ctx.fillStyle = GOLD; ctx.fill(); ink(ctx, 0.8); }
    ctx.beginPath(); ctx.ellipse(neck.x, neck.y, 4.4, 3, Math.atan2(v.y, v.x), 0, TAU); ctx.fillStyle = cel(ctx, neck.x, neck.y, 0.6, -0.8, 4, GLT); ctx.fill(); ink(ctx, 1);
    // a long leaf blade
    ctx.beginPath(); ctx.moveTo(neck.x + nx * 2.4, neck.y + ny * 2.4); ctx.quadraticCurveTo(neck.x + v.x * 12 + nx * 7.5, neck.y + v.y * 12 + ny * 7.5, tip.x, tip.y); ctx.quadraticCurveTo(neck.x + v.x * 12 - nx * 7.5, neck.y + v.y * 12 - ny * 7.5, neck.x - nx * 2.4, neck.y - ny * 2.4); ctx.closePath();
    const gr = ctx.createLinearGradient(neck.x + nx * 7, neck.y + ny * 7, neck.x - nx * 7, neck.y - ny * 7); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#e6dfd2'); gr.addColorStop(0.5, '#a49cb2'); gr.addColorStop(1, '#7e768e');
    ctx.fillStyle = gr; ctx.fill(); ink(ctx, 1.3);
    if (hot > 0.02) lighter(ctx, () => { ctx.strokeStyle = U.rgba(red ? RED : '#ffffff', 0.6 * hot); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(neck.x, neck.y); ctx.lineTo(tip.x, tip.y); ctx.stroke(); });
    return { tip, cb: an };
  }
  function lancerHead(ctx, J, e, ghost) {
    mask(ctx, J, ghost);
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    // a sallet: rounded bowl with a long tail over the nape, a gilt comb with an ivory plume
    const hm = () => { ctx.beginPath(); ctx.moveTo(9.4, -3); ctx.quadraticCurveTo(9, -13, 0, -14.4); ctx.quadraticCurveTo(-11, -13.6, -12.4, -3); ctx.quadraticCurveTo(-15, 4, -21, 7.4); ctx.lineTo(-11, 6.8); ctx.quadraticCurveTo(-6, -5.6, 2, -5.2); ctx.lineTo(9.4, -3); ctx.closePath(); };
    hm(); ctx.fillStyle = cel(ctx, -2, -7, 0.6, -0.8, 13, LAC2); ctx.fill(); ink(ctx, 1.5);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(8.4, -4.4); ctx.quadraticCurveTo(-3, -6.8, -12, 4.4); ctx.stroke();
    line(ctx, { x: 4, y: -13.6 }, { x: -9, y: -12.6 }, INK, 4); line(ctx, { x: 4, y: -13.6 }, { x: -9, y: -12.6 }, GOLD, 2);
    ctx.restore();
    if (e.plume && e.plume.inited) {
      const pl = e.plume.p.map((q) => ({ x: (q.x - e.x) * e.facing / LNS, y: (q.y - e.y) / LNS }));
      Rig.ribbon(ctx, pl, 4.6, 0.8, '#f6f0e4', 1.6); ink(ctx, 1);
    }
  }
  function plumeRoot(e, J) { const a = J.ha, r = { x: J.head.x + Math.cos(a) * -2 - Math.sin(a) * -14, y: J.head.y + Math.sin(a) * -2 + Math.cos(a) * -14 }; return { x: e.x + e.facing * r.x * LNS, y: e.y + r.y * LNS }; }

  const LN = reg('c8_elite', {
    name: '三判官', en: 'THE THREE JUDGES', w: 40, h: 150, hp: 420, bal: 240, col: '#fffaf0', shards: 420, elite: true, scale: LNS, spawnT: 1.1,
    reachPad: 200, topPad: 80, portrait: [1.9, 0.9], defeatDialog: 'c8_eliteDefeat', defeatRelic: 'c8_banner', music: 'c8_elite', kbMul: 0.5,
    init(e) {
      e.seed = seedOf(); e.gaitP = 0; e.chargeCd = 2.5; e.kneel = false; e.squad = [];
      e.coatB = new Rig.Chain(5, 9, 0.1, 0.86); e.coatF = new Rig.Chain(4, 8.5, 0.12, 0.86);
      e.flag = new Rig.Chain(8, 7.5, 0.05, 0.9); e.plume = new Rig.Chain(5, 5.5, 0.06, 0.88);
      e.cd = 1.4;
      // the squad marches in together: the drum a step ahead of the banner, the bell a step behind
      const g = G.game;
      if (e.enc && g && g.enemies) {
        const ar = g.arena && g.arena.id === e.enc ? g.arena : null, fx = (x) => ar ? U.clamp(x, ar.x0 + 70, ar.x1 - 70) : x;
        const dir = g.player && g.player.x > e.x ? 1 : -1;
        const mk = (type, x) => { const xx = fx(x), q = new G.Enemy(type, xx, floorAt(xx, e.y - 120, e.y), { enc: e.enc }); q.lead = e; q.facing = dir; g.enemies.push(q); if (g.save && g.save.flags) g.save.flags['seen_' + type] = true; return q; };
        e.squad = [mk('c8_elite_shield', e.x + dir * 125), mk('c8_elite_bell', e.x - dir * 165)];
      }
    },
    voice: (e) => G.SFX.play('c8_squadVoice', 1),
    weapon: (e) => e.tipW || { x: e.x + e.facing * 160, y: e.y - 100 },
    think(e, dt) {
      Squad.ensure(); squadTick(e, dt);
      if (e.kneel) { e.vx = 0; e.faceP(); return; }
      const P = e.P, d = e.distP(); e.faceP();
      const alone = !(e.squad || []).some(standing);
      const want = 195, tv = d > want + 40 ? e.facing * 150 : d < want - 70 ? -e.facing * 110 : 0;
      e.vx = U.approach(e.vx, tv * e.speedMul * (alone ? 1.15 : 1), 900 * dt);
      e.chargeCd -= dt;
      if (e.cd > 0 || P.hp <= 0) return;
      if (d > 270 && d < 640 && e.chargeCd <= 0) { e.chargeCd = 6 + Math.random() * 2.5; go(e, LN.charge); return; }
      if (d < 175 && Math.random() < 0.45) go(e, LN.sweep);
      else if (d < 245) go(e, LN.thrust);
      else e.cd = 0.25;
    },
    thrust: {
      dur: 1.35, cd: 1.5, trackWin: 0.5,
      anim: { keys: [[0, LNI()], [0.42, LNP.thrA, 'out'], [0.6, LNP.thrA], [0.7, LNP.thrB, 'snap'], [0.95, LNP.thrB], [1.35, LNI(), 'io']] },
      tells: [{ t: 0.15, c: 'white' }],
      hits: [{ t0: 0.66, t1: 0.8, box: { x: 10, y: -132, w: 205, h: 56 }, dmg: 26, kb: 280, last: true, pbal: 60 }],
      moves: [{ t0: 0.6, t1: 0.72, v: 360 }],
      ev: [{ t: 0.64, fn: () => G.SFX.play('slash', 0.5) }],
    },
    sweep: {
      dur: 1.5, cd: 1.6,
      anim: { keys: [[0, LNI()], [0.45, LNP.swA, 'out'], [0.62, LNP.swA], [0.74, LNP.swB, 'snap'], [1.05, LNP.swB], [1.5, LNI(), 'io']] },
      tells: [{ t: 0.15, c: 'white' }],
      hits: [{ t0: 0.68, t1: 0.82, box: { x: -30, y: -190, w: 215, h: 168 }, dmg: 24, kb: 260, last: true, pbal: 55 }],
      moves: [{ t0: 0.62, t1: 0.72, v: 200 }],
      ev: [{ t: 0.66, fn: () => { G.SFX.play('slash', 0.45, true); G.SFX.play('c8_flag'); } }],
    },
    charge: {
      dur: 1.95, cd: 1.6, track: false,
      anim: { keys: [[0, LNI()], [0.35, LNP.chA, 'out'], [0.76, LNP.chA], [0.84, LNP.chR, 'snap'], [1.4, LNP.chR], [1.95, LNI(), 'io']] },
      tells: [{ t: 0.1, c: 'red' }],
      moves: [{ t0: 0.8, t1: 1.38, v: 780 }],
      hits: [{ t0: 0.82, t1: 1.38, box: { x: -10, y: -124, w: 178, h: 84 }, dmg: 34, red: true, kb: 420, last: true }],
      onStart(e) {
        // the drum plants itself and braces; the banner goes through it
        const sh = (e.squad || []).find((q) => q.type === 'c8_elite_shield' && standing(q));
        if (sh && sh.state !== 'atk' && sh.state !== 'broken' && sh.state !== 'hurt') { sh.faceP(); sh.startAtk(SH.brace); }
      },
      ev: [{ t: 0.8, fn: (e) => { G.SFX.play('whoosh', 1.5); G.SFX.play('c8_squadVoice', 1.2); const sh = (e.squad || []).find((q) => standing(q) && q.type === 'c8_elite_shield' && baseOf(q.atk) === SH.brace); if (sh) { G.SFX.play('c8_drum', 1); sh.coverFx = 1; } } }],
    },
    atkUpdate(e, dt) {
      if (baseOf(e.atk) === LN.charge && e.st > 0.82 && e.st < 1.38 && G.game.dtVis > 0 && Math.random() < 0.6) G.FX.dust(e.x, e.y, 2, { w: 20, speed: 200 });
    },
    guard(e, h) { return !e.kneel && coverGuard(e); },
    onHit(e, h) {
      if (e.hp <= 0 && (e.squad || []).some(standing)) {
        // the banner will not fall while one of them stands: it kneels behind it, untouchable — and out of play
        // (dead + untargetable: blows, aim assist, Echo chains and the encounter's target list all pass it by
        // and go to the two still standing; squadUpdate brings it down with the last of them)
        e.hp = 1; e.kneel = true; e.invuln = true; e.untargetable = true; e.dead = true;
        e.bal = 0; e.atk = null; e.setState('idle'); e.vx = 0; e.c8red = false; e.coverBy = null; e.coverFx = 0;
        G.SFX.play('c8_flag'); G.game.shake(0.4); G.FX.ring(e.x, e.y - 4, 10, 120, 0.5, GOLDL, 3, { flat: 0.2 });
        G.game.bark('c8_eliteKneel', true);
      }
    },
    tick(e, dt) {
      coatTick(e, dt, LNS);
      if (e.flagW) { if (!e.flag.inited) e.flag.reset(e.flagW.x, e.flagW.y); e.flag.update(e.flagW.x, e.flagW.y, e.facing, dt, -e.vx * 7 + Math.sin(e.t * 2.6 + e.seed) * 380 - e.facing * 120, 2.95); }
      if (e.plumeW) { if (!e.plume.inited) e.plume.reset(e.plumeW.x, e.plumeW.y); e.plume.update(e.plumeW.x, e.plumeW.y, e.facing, dt, -e.vx * 5 + Math.sin(e.t * 2.2) * 150, 2.25); }
      e.coverFx = Math.max(0, (e.coverFx || 0) - dt * 2.5);
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, p = soldierPose(e, dt, LNP), J = Rig.compute(p), f = e.facing, s = LNS, a = baseOf(e.state === 'atk' ? e.atk : null);
      if (e.kneel) {
        // kneeling behind the planted banner: a pale light round it — it waits for the others
        glow(ctx, e.x, e.y - 70, 90, '#fffaf0', 0.3 + 0.1 * Math.sin(e.t * 2));
      }
      const red = !!(e.atk && e.atk.isRed) || a === LN.charge;
      const hot = Math.max(e.tellT || 0, a === LN.charge && e.st < 1.4 ? 0.5 : 0);
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(f * s, s);
      let L = null;
      hollowSoldier(ctx, e, p, J, {
        s, broad: 1,
        head: () => lancerHead(ctx, J, e, ghost),
        nearItemBeforeArm: () => { L = drawLance(ctx, e, J, p.sw, hot, red, ghost); },
      }, ghost);
      if (!ghost) {
        e.tipW = { x: e.x + f * L.tip.x * s, y: e.y + L.tip.y * s };
        e.flagW = { x: e.x + f * L.cb.x * s, y: e.y + L.cb.y * s };
        e.plumeW = plumeRoot(e, J);
      }
      empowerFx(ctx, e, L.tip);
      if (e.tellT > 0) glow(ctx, L.tip.x, L.tip.y, 28, e.tellCol === 'red' ? RED : '#ffffff', e.tellT * 1.4);
      ctx.restore();
      if (e.state === 'broken') dizzy(ctx, e.x + f * J.head.x * s, e.y + J.head.y * s - 34, e.t, 16);
    },
  });

  /* ---------------- the drumshield ---------------- */
  const SHS = 1.2;
  const SHP = {
    idle: (t) => ({ ry: 6 + Math.sin(t * 1.3) * 1, torso: 0.16 + Math.sin(t * 1.3) * 0.015, head: 0.02, tF: 0.45, kF: -0.55, tB: -0.38, kB: -0.25, aF: 0.2, eF: 0.9, aB: 0.95, eB: 1.0, sw: 0.5 }),
    brace: { ry: 16, torso: 0.38, head: 0.12, tF: 0.85, kF: -1.1, tB: -0.7, kB: -0.45, aF: -0.2, eF: 1.4, aB: 1.4, eB: 0.5, sw: 2.6 },
    bashA: { ry: 8, torso: 0.05, head: 0.0, tF: 0.55, kF: -0.7, tB: -0.5, kB: -0.3, aF: -0.3, eF: 1.0, aB: 0.85, eB: 1.45, sw: 2.4 },
    bashB: { ry: 12, torso: 0.5, head: 0.1, tF: 1.0, kF: -0.95, tB: -0.7, kB: -0.2, aF: -0.5, eF: 0.9, aB: 1.75, eB: 0.08, sw: 2.2 },
    boomA: { ry: 10, torso: -0.12, head: -0.15, tF: 0.6, kF: -0.8, tB: -0.5, kB: -0.3, aF: 3.0, eF: 0.4, aB: 1.3, eB: 0.7, sw: 3.5 },
    boomB: { ry: 18, torso: 0.45, head: 0.15, tF: 0.9, kF: -1.1, tB: -0.6, kB: -0.45, aF: 1.4, eF: 0.4, aB: 1.3, eB: 0.6, sw: 1.75 },
    hurt: { ry: 8, torso: -0.35, head: 0.45, tF: 0.25, kF: -0.6, tB: -0.6, kB: -0.4, aF: -0.4, eF: 1.0, aB: 0.4, eB: 1.2, sw: 0.4 },
    kneel: { ry: 30, torso: 0.48, head: 0.5, tF: 1.35, kF: -1.35, tB: 0.05, kB: -1.6, aF: 0.4, eF: 0.4, aB: 0.6, eB: 0.6, sw: 0.2 },
  };
  for (const k of ['brace', 'bashA', 'bashB', 'boomA', 'boomB', 'hurt']) SHP[k] = gs(SHP[k]);
  SHP.kneel = Rig.full(SHP.kneel);
  const SHI = () => gs(SHP.idle(0));
  // the war drum, worn as a shield: seen from the side — its ivory head faces the enemy, gilt cords zig-zag its shell
  function drum(ctx, c, ang, hot) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(ang);
    const R = 31, D = 22;
    ctx.beginPath(); ctx.ellipse(-D, 0, 7, R, 0, 0, TAU); ctx.fillStyle = '#120e17'; ctx.fill(); ink(ctx, 1.4);
    ctx.beginPath(); ctx.moveTo(-D, -R); ctx.lineTo(0, -R); ctx.lineTo(0, R); ctx.lineTo(-D, R); ctx.closePath(); ctx.fillStyle = cel(ctx, -D / 2, 0, 0, -1, R, LAC2); ctx.fill(); ink(ctx, 1.6);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.3; ctx.beginPath(); for (let i = 0; i <= 6; i++) { const y = -R + 4 + i * (2 * R - 8) / 6; ctx.lineTo(i % 2 ? -D + 3 : -3, y); } ctx.stroke();
    for (const x of [-D + 1.5, -1.5]) { ctx.fillStyle = CRIMSON; ctx.fillRect(x - 1.5, -R, 3, 2 * R); }
    ctx.beginPath(); ctx.ellipse(0, 0, 8.5, R + 1, 0, 0, TAU); ctx.fillStyle = cel(ctx, 0, 0, 1, 0, 9, IVO); ctx.fill(); ink(ctx, 1.8);
    ctx.beginPath(); ctx.ellipse(0.6, 0, 5.4, R - 5, 0, 0, TAU); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(1, 0, 2.2, 8, 0, 0, TAU); ctx.fillStyle = 'rgba(11,6,18,0.25)'; ctx.fill();
    if (hot > 0.02) lighter(ctx, () => { ctx.beginPath(); ctx.ellipse(0, 0, 9 + 4 * hot, R + 3, 0, 0, TAU); ctx.strokeStyle = U.rgba(GOLDL, 0.85 * hot); ctx.lineWidth = 3; ctx.stroke(); K.glow(ctx, 6, 0, 50, GOLDL, 0.3 * hot); });
    ctx.restore();
  }
  function mallet(ctx, J, sw, hot, red) {
    const v = dirv(sw, 1), h = J.hdF, end = { x: h.x + v.x * 34, y: h.y + v.y * 34 }, butt = { x: h.x - v.x * 6, y: h.y - v.y * 6 };
    LB(ctx, butt, end, 2.1, 1.8, LAC3, { noHatch: true });
    ctx.beginPath(); ctx.arc(end.x + v.x * 4, end.y + v.y * 4, 7, 0, TAU); ctx.fillStyle = cel(ctx, end.x, end.y, 0.6, -0.8, 7, IVO); ctx.fill(); ink(ctx, 1.4);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(end.x + v.x * 4, end.y + v.y * 4, 4.6, 0, TAU); ctx.stroke();
    if (hot > 0.02) glow(ctx, end.x + v.x * 4, end.y + v.y * 4, 20, red ? RED : '#ffffff', hot);
    return { x: end.x + v.x * 4, y: end.y + v.y * 4 };
  }
  function kettleHat(ctx, J, ghost) {
    mask(ctx, J, ghost);
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    ctx.beginPath(); ctx.moveTo(-10, -4); ctx.quadraticCurveTo(-10, -15, 0, -15.5); ctx.quadraticCurveTo(10, -15, 10, -4); ctx.closePath(); ctx.fillStyle = cel(ctx, 0, -9, 0.6, -0.8, 11, LAC2); ctx.fill(); ink(ctx, 1.5);
    ctx.beginPath(); ctx.ellipse(0, -4, 17, 3.6, -0.05, 0, TAU); ctx.fillStyle = cel(ctx, 0, -4, 0.6, -0.8, 17, LAC3); ctx.fill(); ink(ctx, 1.5);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, -4.4, 15, 2.6, -0.05, PI, TAU); ctx.stroke();
    ctx.restore();
  }
  function boomWave(e) {
    const x = e.x + e.facing * 60 * SHS, fl = floorAt(x, e.y - 8, e.y);
    G.game.hazards.push({ t: 0, life: 1.6, x, fl, vx: e.facing * 380, owner: e, hit: false, dmg: 28, update: boomUpdate, draw: boomDraw });
    G.SFX.play('c8_drum', 1.3); G.game.shake(0.45);
    G.FX.ring(x, fl - 30, 10, 90, 0.35, CRIMSON, 4);
  }
  function boomUpdate(h, dt, g) {
    h.x += h.vx * dt;
    if (solidAt(h.x, h.fl - 20)) { h.done = true; return; }
    const P = g.player; if (!P || h.hit) return;
    const box = { x: h.x - 18, y: h.fl - 48, w: 36, h: 48 };
    if (U.rectsOverlap(box, P.hurtbox)) { h.hit = true; P.receiveHit(h.owner, { dmg: h.dmg, unblockable: true, kb: 300, hx: h.x, hy: P.y - 30, waveFrom: h.x - Math.sign(h.vx) * 40 }); }
  }
  function boomDraw(ctx, h) {
    const a = Math.min(1, h.t * 8) * (h.t > h.life - 0.3 ? Math.max(0, (h.life - h.t) / 0.3) : 1), d = Math.sign(h.vx);
    ctx.globalAlpha *= a;
    lighter(ctx, () => {
      for (let i = 0; i < 3; i++) {
        const x = h.x - d * i * 14, r = 44 - i * 9;
        ctx.strokeStyle = U.rgba(i ? CRIMSON : RED, 0.85 - i * 0.22); ctx.lineWidth = 4 - i;
        ctx.beginPath(); ctx.ellipse(x, h.fl - 1, 10 + i * 3, r, 0, -PI / 2, PI / 2, d < 0); ctx.stroke();
      }
      K.glow(ctx, h.x, h.fl - 20, 50, RED, 0.35);
    });
    ctx.fillStyle = 'rgba(11,6,18,0.5)'; ctx.beginPath(); ctx.ellipse(h.x, h.fl - 1, 22, 3, 0, 0, TAU); ctx.fill();
  }

  const SH = reg('c8_elite_shield', {
    name: '執鼓判官', en: 'THE JUDGE OF THE DRUM', w: 46, h: 146, hp: 300, bal: 150, col: '#fffaf0', shards: 60, scale: SHS, spawnT: 1.1, kbMul: 0.35,
    reachPad: 120, topPad: 70, portrait: [2.0, 0.9],
    init(e) {
      e.seed = seedOf(); e.gaitP = 0; e.braceCd = 2.5; e.cd = 1.2 + Math.random() * 0.5;
      e.coatB = new Rig.Chain(4, 9, 0.12, 0.86); e.coatF = new Rig.Chain(4, 8, 0.14, 0.86);
    },
    voice: (e) => G.SFX.play('c8_squadVoice', 0.8),
    weapon: (e) => e.tipW || { x: e.x + e.facing * 60, y: e.y - 100 },
    think(e, dt) {
      squadTick(e, dt);
      const P = e.P, d = e.distP(); e.faceP();
      const sq = squadOf(e), bell = sq.find((q) => q.type === 'c8_elite_bell' && standing(q)), lead = e.lead && standing(e.lead) ? e.lead : null;
      const ward = bell || lead;
      // it keeps itself between Rinne and whoever it guards — the bell-ringer first
      let tx = ward ? ward.x + (Math.sign(P.x - ward.x) || 1) * 100 : P.x - e.facing * 110;
      tx = clampArena(e, tx);
      const dx = tx - e.x;
      e.vx = U.approach(e.vx, Math.abs(dx) > 14 ? Math.sign(dx) * 135 * e.speedMul : 0, 800 * dt);
      e.braceCd -= dt;
      if (e.cd > 0 || P.hp <= 0) return;
      if (ward && e.braceCd <= 0 && Math.abs(P.x - ward.x) < 240) { e.braceCd = 5.5; go(e, SH.brace); return; }
      if (d < 135) go(e, SH.bash);
      else if (d < 340 && Math.random() < 0.55) go(e, SH.boom);
      else e.cd = 0.3;
    },
    brace: {
      dur: 2.3, cd: 0.7, track: false, support: true, guardTo: 2.1,
      anim: { keys: [[0, SHI()], [0.18, SHP.brace, 'out'], [2.1, SHP.brace], [2.3, SHI(), 'io']] },
      ev: [{ t: 0.16, fn: (e) => { G.SFX.play('c8_drum', 0.6); G.FX.dust(e.x + e.facing * 40, e.y, 6, { w: 30, speed: 150 }); } }],
    },
    bash: {
      dur: 1.2, cd: 1.3,
      anim: { keys: [[0, SHI()], [0.4, SHP.bashA, 'out'], [0.56, SHP.bashA], [0.66, SHP.bashB, 'snap'], [0.9, SHP.bashB], [1.2, SHI(), 'io']] },
      tells: [{ t: 0.12, c: 'white' }],
      hits: [{ t0: 0.62, t1: 0.74, box: { x: 0, y: -146, w: 108, h: 136 }, dmg: 22, kb: 340, last: true, pbal: 60 }],
      moves: [{ t0: 0.56, t1: 0.68, v: 300 }],
      ev: [{ t: 0.64, fn: () => G.SFX.play('c8_drum', 0.8) }],
    },
    boom: {
      dur: 1.55, cd: 2.2, track: false,
      anim: { keys: [[0, SHI()], [0.5, SHP.boomA, 'out'], [0.7, SHP.boomA], [0.78, SHP.boomB, 'snap'], [1.1, SHP.boomB], [1.55, SHI(), 'io']] },
      tells: [{ t: 0.12, c: 'red' }],
      ev: [{ t: 0.76, fn: boomWave }],
    },
    guard(e, h) {
      if (e.state === 'atk' && baseOf(e.atk) === SH.brace && e.st > 0.15 && e.st < SH.brace.guardTo && (G.game.player.x - e.x) * e.facing > -4) { e.coverFx = 1; G.SFX.play('c8_drum', 0.5); return true; }
      return coverGuard(e);
    },
    tick(e, dt) { coatTick(e, dt, SHS); e.coverFx = Math.max(0, (e.coverFx || 0) - dt * 2.5); },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, p = soldierPose(e, dt, SHP), J = Rig.compute(p), f = e.facing, s = SHS, a = baseOf(e.state === 'atk' ? e.atk : null);
      const braced = a === SH.brace || a === SH.bash || a === SH.boom;
      const hot = Math.max(e.tellT || 0, 0), red = !!(e.atk && e.atk.isRed) || a === SH.boom;
      const dv = { x: J.hdB.x - J.elB.x, y: J.hdB.y - J.elB.y }, dd = Math.hypot(dv.x, dv.y) || 1, dc = { x: J.hdB.x + dv.x / dd * 8, y: J.hdB.y + dv.y / dd * 8 };
      const dAng = (braced ? 0 : 0.18) + (e.state === 'broken' || e.kneel ? 1.1 : 0);
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(f * s, s);
      let M = null;
      hollowSoldier(ctx, e, p, J, {
        s, broad: 1.22, itemFront: braced,
        farItem: () => drum(ctx, dc, dAng, Math.max(e.coverFx || 0, a === SH.brace ? 0.35 : 0)),
        chest: (Q) => { const a0 = Q(1.0, -9), a1 = Q(0.2, 11); line(ctx, a0, a1, INK, 6.4); line(ctx, a0, a1, CRIMSON, 4.2); },
        head: () => kettleHat(ctx, J, ghost),
        nearItemBeforeArm: () => { M = mallet(ctx, J, p.sw, hot, red); },
      }, ghost);
      if (!ghost) e.tipW = { x: e.x + f * (braced ? dc.x + 10 : M.x) * s, y: e.y + (braced ? dc.y : M.y) * s };
      empowerFx(ctx, e, M);
      ctx.restore();
      if (e.state === 'broken') dizzy(ctx, e.x + f * J.head.x * s, e.y + J.head.y * s - 30, e.t, 16);
    },
  });

  /* ---------------- the bell-ringer ---------------- */
  const BLS = 1.16;
  const BLP = {
    idle: (t) => ({ ry: 2 + Math.sin(t * 1.6) * 1, torso: 0.02 + Math.sin(t * 1.6) * 0.012, head: 0.12, tF: 0.25, kF: -0.3, tB: -0.25, kB: -0.2, aF: 0.6, eF: 1.25, aB: 0.3, eB: 1.1, sw: PI - 0.1 }),
    chA: { ry: 0, torso: -0.2, head: -0.35, tF: 0.2, kF: -0.2, tB: -0.2, kB: -0.1, aF: 2.8, eF: 0.3, aB: 2.4, eB: 0.5, sw: PI + 0.15, hold: 1 },
    chB: { ry: 4, torso: 0.05, head: -0.1, tF: 0.3, kF: -0.35, tB: -0.3, kB: -0.2, aF: 2.6, eF: 0.4, aB: 2.2, eB: 0.6, sw: PI - 0.25, hold: 1 },
    plA: { ry: 6, torso: -0.1, head: 0.0, tF: 0.4, kF: -0.5, tB: -0.4, kB: -0.25, aF: 1.6, eF: 1.4, aB: 0.8, eB: 1.2, sw: 3.7 },
    plB: { ry: 9, torso: 0.3, head: 0.05, tF: 0.7, kF: -0.8, tB: -0.5, kB: -0.25, aF: 1.45, eF: 0.2, aB: 0.4, eB: 1.0, sw: 2.2 },
    tlA: { ry: 6, torso: -0.15, head: -0.05, tF: 0.45, kF: -0.6, tB: -0.4, kB: -0.3, aF: 2.4, eF: 0.6, aB: 1.6, eB: 0.8, sw: 4.1, hold: 1 },
    tlB: { ry: 12, torso: 0.4, head: 0.1, tF: 0.85, kF: -0.9, tB: -0.55, kB: -0.25, aF: 1.2, eF: 0.15, aB: 0.9, eB: 0.5, sw: 1.35, hold: 1 },
    hurt: { ry: 6, torso: -0.4, head: 0.45, tF: 0.2, kF: -0.5, tB: -0.5, kB: -0.35, aF: 0.4, eF: 1.3, aB: -0.5, eB: 0.9, sw: 2.6 },
    kneel: { ry: 30, torso: 0.45, head: 0.6, tF: 1.35, kF: -1.35, tB: 0.05, kB: -1.6, aF: 1.2, eF: 0.8, aB: 0.6, eB: 0.8, sw: 2.6 },
  };
  for (const k of ['chA', 'chB', 'plA', 'plB', 'tlA', 'tlB', 'hurt']) BLP[k] = gs(BLP[k]);
  BLP.kneel = Rig.full(BLP.kneel);
  const BLI = () => gs(BLP.idle(0));
  // the crook-staff and its bell (the bell swings on its hook)
  function bellStaff(ctx, e, J, sw, ring, hot, red) {
    const v = dirv(sw, 1), nx = -v.y, ny = v.x, h = J.hdF, butt = { x: h.x - v.x * 34, y: h.y - v.y * 34 }, top = { x: h.x + v.x * 92, y: h.y + v.y * 92 };
    LB(ctx, butt, top, 2.2, 1.9, LAC, { noHatch: true });
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.beginPath(); for (const k of [0.1, 0.55, 0.9]) { const q = lp(butt, top, k); ctx.moveTo(q.x + nx * 2.6, q.y + ny * 2.6); ctx.lineTo(q.x - nx * 2.6, q.y - ny * 2.6); } ctx.stroke();
    // the crook curls forward over the bell
    const c1 = { x: top.x + v.x * 10 + nx * 4, y: top.y + v.y * 10 + ny * 4 }, hook = { x: top.x + v.x * 4 + nx * 15, y: top.y + v.y * 4 + ny * 15 };
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.bezierCurveTo(top.x + v.x * 16, top.y + v.y * 16, c1.x + nx * 14, c1.y + ny * 14, hook.x, hook.y);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = GLT; ctx.lineWidth = 2.6; ctx.stroke();
    // the bell hangs straight down from the hook in world terms (it swings)
    const swing = (e.bellA || 0), bl = 10, bp = { x: hook.x + Math.sin(swing) * bl, y: hook.y + Math.cos(swing) * bl };
    line(ctx, hook, bp, INK, 1.4);
    ctx.save(); ctx.translate(bp.x, bp.y); ctx.rotate(-swing);
    ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.quadraticCurveTo(-5, 7, -10, 15); ctx.lineTo(10, 15); ctx.quadraticCurveTo(5, 7, 3.5, 0); ctx.closePath();
    ctx.fillStyle = cel(ctx, 0, 7, 0.6, -0.8, 10, GLT); ctx.fill(); ink(ctx, 1.4);
    ctx.beginPath(); ctx.ellipse(0, 15, 10, 2.6, 0, 0, TAU); ctx.fillStyle = '#5e4320'; ctx.fill(); ink(ctx, 1);
    ctx.beginPath(); ctx.arc(Math.sin(e.t * 13) * 2 * ring, 17.5, 2.2, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    if (ring > 0.02) lighter(ctx, () => { for (let i = 0; i < 3; i++) { const r = 14 + i * 8 + ring * 6; ctx.strokeStyle = U.rgba(GOLDL, (0.6 - i * 0.18) * ring); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 9, r, -PI * 0.9, -PI * 0.1); ctx.stroke(); } });
    if (hot > 0.02) glow(ctx, 0, 9, 24, red ? RED : '#ffffff', hot);
    ctx.restore();
    return { x: bp.x, y: bp.y + 9 };
  }
  function hood(ctx, J, ghost, e) {
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    // the back of the deep hood (behind the mask)
    ctx.beginPath(); ctx.moveTo(10, -9); ctx.quadraticCurveTo(4, -19, -6, -17); ctx.quadraticCurveTo(-17, -12, -16, 4); ctx.quadraticCurveTo(-15, 14, -6, 18); ctx.lineTo(6, 14); ctx.closePath();
    ctx.fillStyle = cel(ctx, -4, -2, 0.6, -0.8, 16, LAC2); ctx.fill(); ink(ctx, 1.5);
    ctx.restore();
    mask(ctx, J, ghost, -0.05);
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    // the hood's lip over the brow, and a sheer veil hanging from it
    ctx.beginPath(); ctx.moveTo(11, -8.6); ctx.quadraticCurveTo(5, -15.6, -4, -13.4); ctx.quadraticCurveTo(2, -10, 11, -8.6); ctx.fillStyle = LAC3; ctx.fill(); ink(ctx, 1.2);
    ctx.fillStyle = 'rgba(245,240,230,0.28)'; ctx.beginPath(); ctx.moveTo(11, -8); ctx.quadraticCurveTo(13 + Math.sin(e.t * 2) * 1, 4, 10, 12); ctx.lineTo(5, 12); ctx.quadraticCurveTo(8, 2, 6, -9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = U.rgba(GOLD, 0.6); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(11, -8); ctx.quadraticCurveTo(13, 4, 10, 12); ctx.stroke();
    ctx.restore();
  }
  function chimeNow(e) {
    const g = G.game; G.SFX.play('c8_chime'); g.shake(0.18);
    for (let i = 0; i < 3; i++) G.FX.ring(e.x, e.y - 120, 10 + i * 10, 320 + i * 120, 0.7 + i * 0.15, i ? GOLD : GOLDL, 3 - i * 0.6);
    const allies = squadOf(e).filter((q) => q !== e && standing(q) && Math.abs(q.x - e.x) < 760);
    for (const q of allies) {
      const heal = Math.max(0, Math.min(q.maxHp - q.hp, Math.round(q.maxHp * 0.1 + 12)));
      if (heal > 0) { q.hp += heal; G.FX.text(q.x, q.y - q.h * (q.T.scale || 1) - 16, '+' + heal, '#ffe9a8', 16, 0.9); }
      q.hasteT = 4; q.cd = Math.min(q.cd, 0.45);
      G.FX.ring(q.x, q.y - 70, 6, 70, 0.45, GOLDL, 3); G.FX.ember(q.x, q.y - 70, 6, GOLDL, { w: 40, h: 90, up: 80, sp: 40, life: 0.8 });
    }
    G.SFX.play('c8_heal');
    // the bell's last note goes to the banner if it stands: that ally's next attack is RED
    const pick = allies.find((q) => q.type === 'c8_elite') || allies[0];
    if (pick) { pick.c8red = true; G.SFX.play('c8_empower'); G.FX.ring(pick.x, pick.y - 80, 6, 60, 0.4, CRIMSON, 4); }
  }
  function peal(e) {
    const x = e.x + e.facing * 46 * BLS, fl = floorAt(x, e.y - 8, e.y);
    G.game.hazards.push({ t: 0, life: 2.6, x, fl, vx: e.facing * 300, owner: e, dmg: 18, passed: false, update: pealUpdate, draw: pealDraw });
    G.SFX.play('c8_note', 2); G.SFX.play('c8_note', 4);
  }
  function pealUpdate(h, dt, g) {
    h.x += h.vx * dt;
    if (solidAt(h.x, h.fl - 40)) { h.done = true; return; }
    const P = g.player; if (!P || h.passed) return;
    const box = { x: h.x - 14, y: h.fl - 96, w: 28, h: 96 };
    if (U.rectsOverlap(box, P.hurtbox)) {
      const res = P.receiveHit(h.owner, { dmg: h.dmg, kb: 220, hx: h.x, hy: P.y - 60, waveFrom: h.x - Math.sign(h.vx) * 30 });
      if (res === 'parried') { g.projectiles.push({ x: h.x, y: h.fl - 60, vx: -h.vx * 1.5, vy: -40, r: 12, owner: h.owner, friendly: true, dmg: h.dmg, life: 2.5, t: 0, col: GOLDL }); h.done = true; }
      else if (res === 'dodged' || res === 'ignored') h.passed = true;
      else h.done = true;
    }
  }
  function pealDraw(ctx, h) {
    const a = Math.min(1, h.t * 8) * (h.t > h.life - 0.3 ? Math.max(0, (h.life - h.t) / 0.3) : 1), d = Math.sign(h.vx);
    ctx.globalAlpha *= a;
    lighter(ctx, () => {
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = U.rgba(i ? GOLD : '#ffffff', 0.85 - i * 0.25); ctx.lineWidth = 3 - i * 0.7; ctx.beginPath(); ctx.ellipse(h.x - d * i * 12, h.fl - 48, 9 + i * 2, 46 - i * 6, 0, -PI / 2, PI / 2, d < 0); ctx.stroke(); }
      K.glow(ctx, h.x, h.fl - 48, 46, GOLDL, 0.3);
    });
  }

  const BL = reg('c8_elite_bell', {
    name: '執鐘判官', en: 'THE JUDGE OF THE BELL', w: 36, h: 140, hp: 230, bal: 110, col: '#fffaf0', shards: 60, scale: BLS, spawnT: 1.1, kbMul: 0.8,
    reachPad: 110, topPad: 90, portrait: [2.0, 0.9],
    init(e) {
      e.seed = seedOf(); e.gaitP = 0; e.chimeCd = 3; e.bellA = 0; e.bellV = 0; e.cd = 1.6 + Math.random() * 0.5;
      e.coatB = new Rig.Chain(6, 9, 0.1, 0.86); e.coatF = new Rig.Chain(5, 9, 0.12, 0.86);
    },
    voice: (e) => G.SFX.play('c8_squadVoice', 1.4),
    weapon: (e) => e.tipW || { x: e.x + e.facing * 30, y: e.y - 150 },
    think(e, dt) {
      squadTick(e, dt);
      const P = e.P, d = e.distP(); e.faceP();
      // well back, behind the drum
      const away = Math.sign(e.x - P.x) || 1, tx = clampArena(e, P.x + away * 380), dx = tx - e.x;
      e.vx = U.approach(e.vx, Math.abs(dx) > 20 ? Math.sign(dx) * 150 * e.speedMul : 0, 700 * dt);
      e.chimeCd -= dt;
      if (e.cd > 0 || P.hp <= 0) return;
      const allies = squadOf(e).filter((q) => q !== e && standing(q));
      if (allies.length && e.chimeCd <= 0 && (allies.some((q) => q.hp < q.maxHp * 0.85) || Math.random() < 0.4)) { e.chimeCd = 7 + Math.random() * 2; go(e, BL.chime); return; }
      if (d < 140) go(e, BL.toll);
      else if (d < 720) go(e, BL.peal);
      else e.cd = 0.4;
    },
    chime: {
      dur: 1.7, cd: 1.0, track: false, support: true,
      anim: { keys: [[0, BLI()], [0.3, BLP.chA, 'out'], [0.92, BLP.chA], [1.0, BLP.chB, 'snap'], [1.4, BLP.chB], [1.7, BLI(), 'io']] },
      ev: [{ t: 0.12, fn: (e) => { G.SFX.play('c8_note', 0); G.FX.ring(e.x, e.y - 160, 4, 40, 0.5, GOLD, 2); } }, { t: 1.0, fn: chimeNow }],
    },
    peal: {
      dur: 1.3, cd: 1.6, track: false,
      anim: { keys: [[0, BLI()], [0.4, BLP.plA, 'out'], [0.62, BLP.plA], [0.7, BLP.plB, 'snap'], [1.0, BLP.plB], [1.3, BLI(), 'io']] },
      tells: [{ t: 0.15, c: 'white' }],
      ev: [{ t: 0.68, fn: peal }],
    },
    toll: {
      dur: 1.25, cd: 1.4,
      anim: { keys: [[0, BLI()], [0.42, BLP.tlA, 'out'], [0.56, BLP.tlA], [0.66, BLP.tlB, 'snap'], [0.92, BLP.tlB], [1.25, BLI(), 'io']] },
      tells: [{ t: 0.12, c: 'white' }],
      hits: [{ t0: 0.62, t1: 0.76, box: { x: -10, y: -170, w: 150, h: 150 }, dmg: 20, kb: 240, last: true, pbal: 50 }],
      moves: [{ t0: 0.56, t1: 0.66, v: 200 }],
      ev: [{ t: 0.64, fn: () => { G.SFX.play('c8_note', 5); G.SFX.play('whoosh', 0.8); } }],
    },
    guard(e, h) { return coverGuard(e); },
    tick(e, dt) {
      coatTick(e, dt, BLS);
      // the bell swings on its hook like a pendulum, kicked by the staff's motion
      const a = baseOf(e.state === 'atk' ? e.atk : null), kick = a === BL.chime && e.st > 0.3 && e.st < 1.4 ? Math.sin(e.st * 26) * 60 : 0;
      e.bellV += (-e.bellA * 40 - e.bellV * 3 + kick - e.vx * e.facing * 0.04) * dt; e.bellA = U.clamp(e.bellA + e.bellV * dt, -1, 1);
      e.coverFx = Math.max(0, (e.coverFx || 0) - dt * 2.5);
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, p = soldierPose(e, dt, BLP), J = Rig.compute(p), f = e.facing, s = BLS, a = baseOf(e.state === 'atk' ? e.atk : null);
      const ring = a === BL.chime ? U.clamp((e.st - 0.25) / 0.2, 0, 1) * (e.st < 1.5 ? 1 : 0) : a === BL.peal && e.st > 0.6 && e.st < 1.0 ? 1 : 0;
      const red = !!(e.atk && e.atk.isRed);
      // the chime's gathering light
      if (a === BL.chime && e.st < 1.05) glow(ctx, e.x, e.y - 150 * s, 40 + 60 * e.st, GOLDL, 0.25 + 0.4 * e.st);
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(f * s, s);
      let B = null;
      hollowSoldier(ctx, e, p, J, {
        s, broad: 0.92, robe: true,
        head: () => hood(ctx, J, ghost, e),
        nearItemBeforeArm: () => { B = bellStaff(ctx, e, J, p.sw, ring, Math.max(e.tellT || 0, 0), red); },
      }, ghost);
      if (!ghost) e.tipW = { x: e.x + f * B.x * s, y: e.y + B.y * s };
      empowerFx(ctx, e, B);
      ctx.restore();
      if (e.state === 'broken') dizzy(ctx, e.x + f * J.head.x * s, e.y + J.head.y * s - 34, e.t, 14);
    },
  });

  /* ================================ data: codex, relic, barks, hint ================================ */
  const pushOnce = (arr, en) => { if (arr && !arr.some((q) => q.id === en.id)) arr.push(en); };
  D.barks = D.barks || {}; D.hints = D.hints || {}; D.dialog = D.dialog || {}; D.relics = D.relics || {};
  D.barks.c8_eliteKneel = { who: 'ode', text: '……他跪在旗下。旗，不肯倒。' };
  D.barks.c8_eliteAlone = { who: 'ode', text: '只剩執旗的那一位了。……他的旗在發抖。' };
  D.hints.c8_cling = '噤聲童影抱住你時會吸走耐力、拖慢腳步——按 {dodge} 閃避，把牠們全部甩下來。';
  // the chapter's world file owns these; they are only a safety net (its register() overwrites them)
  if (!D.dialog.c8_eliteIntro) D.dialog.c8_eliteIntro = [
    { who: 'ode', text: '……三道目光。是判官。' },
    { who: 'rinne', text: '（妳握緊了刀。）' },
    { who: 'ode', text: '面具底下，已經沒有人了。只剩下判決。' },
  ];
  if (!D.dialog.c8_eliteDefeat) D.dialog.c8_eliteDefeat = [
    { who: 'rinne', text: '（三道目光，同時垂了下去。）' },
    { who: 'ode', text: '……旗留下了。' },
  ];
  D.relics.c8_banner = D.relics.c8_banner || { name: '判官之旗', desc: '最大生命 +25、最大耐力 +15' };
  G.Relics.c8_banner = G.Relics.c8_banner || { apply(P) { P.maxHp += 25; P.maxSta += 15; } };
  pushOnce(D.codex.items, {
    id: 'c8_banner', name: '判官之旗', en: "THE JUDGES' BANNER", unlock: 'relic_c8_banner', relic: true,
    body: ['三判官的判旗。象牙色的布上繡著緋紅的冠冕——冥后的顏色。', '十八年來，它每天升起，卻沒有一次宣過判決。最後一次，判的是一個沒有名字的女孩。如今，終於可以放下了。', '遺物效果：最大生命 +25、最大耐力 +15。'],
  });
  const HB = D.codex.hushborn;
  pushOnce(HB, {
    id: 'c8_hushling', name: '噤聲童影', en: 'HUSHLING', portrait: 'c8_hushling', unlock: 'seen_c8_hushling', tag: '寂裔｜低階・群體',
    body: [
      '冥后宮殿裡，那些沒能出生的孩子。十八年來沒有死亡，也就沒有新生；他們被剪成紙娃娃的模樣，沒有臉，雙手死死摀著嘴。誰先出聲，誰就會被找到。',
      '攻擊模式：白色低身撲撞（可格擋；完美格擋會讓它暈眩）／張開雙臂跳上來抱住你（白光）。抱住時打不到它，它會吸走你的耐力、拖慢你的腳步。',
      '弱點：閃避一次，就能把身上所有童影甩下來，被甩下的會跌坐片刻。牠們一次最多只有兩隻同時出手——數清楚再動。',
    ],
  });
  pushOnce(HB, {
    id: 'c8_conductor', name: '指揮殘影', en: 'CONDUCTOR WRAITH', portrait: 'c8_conductor', unlock: 'seen_c8_conductor', tag: '寂裔｜中階・支援',
    body: [
      '替冥后宮殿打拍子的司儀留下的回音：一件沒有人穿的燕尾服、一雙白手套，和一支緋紅的指揮棒。十八年來，它只打過一種拍子——等待。',
      '特性：只要它還在，附近的寂裔都會跟著它的拍子——腳下浮現緋紅節拍環，出手的間隔明顯縮短。',
      '攻擊模式：俯衝三連揮（白光，踩著拍子，第三下最寬）／高舉指揮棒的「下拍」（紅光）：一道緋紅直線標出巨刃的落點，先追著你，再停住，接著巨刃筆直落下——離開那條線。',
      '弱點：先打它。它一倒，整首曲子就散了拍。',
    ],
  });
  pushOnce(HB, {
    id: 'c8_cadence', name: '終止騎士', en: 'CADENCE KNIGHT', portrait: 'c8_cadence', unlock: 'seen_c8_cadence', tag: '寂裔｜高階・重甲',
    body: [
      '黑漆鎧甲上刻滿象牙色的五線譜，頭盔頂著終止線，大盾上畫著一生的最後一小節。它負責替每一個走進宮殿的人收尾。門關了十八年，它一直站著。',
      '攻擊模式：三段終止式——白、白，然後是紅色的「解決」：高舉長劍劈進地面（閃避），劍會卡在地上片刻。／盾牆：舉起大盾緩步逼近，正面的攻擊全被彈開；盾牆結束時以盾猛撞（白光）。',
      '弱點：完美格擋那一記盾撞，能直接擊潰它的架勢；或繞到背後連砍兩下，打亂盾牆。它轉身很慢。輕擊打不斷它的劍勢。',
    ],
  });
  pushOnce(HB, {
    id: 'c8_coda', name: '尾聲蛇', en: 'CODA SERPENT', portrait: 'c8_coda', unlock: 'seen_c8_coda', tag: '寂裔｜高階・潛行',
    body: [
      '墨與金鑄成的蛇。牠盤起來的身體就是「尾聲」記號：從地面升起、繞成一圈、再筆直穿過自己的環，兩片金鰭橫越其上——「跳到結尾」。牠在宮殿的地板底下游動，像在乾涸的冥河裡找水。',
      '攻擊模式：潛入地板後，一片金鰭劃開地面朝你游來，你腳下會浮現紅色的尾聲記號——先跟著你、再停住，然後牠從那裡破土而出（紅光，閃避）。／尾巴橫掃（白光，膝蓋高度，也能跳過）／仰首吟唱，吐出螺旋音符（白光，完美格擋可彈回）。',
      '弱點：在地底時無法攻擊。破土之後牠會停頓片刻——那就是出手的時機。',
    ],
  });
  pushOnce(HB, {
    id: 'c8_elite', name: '三判官・執旗判官', en: 'THE THREE JUDGES — THE BANNER', portrait: 'c8_elite', unlock: 'seen_c8_elite', tag: '菁英｜三判官（冥后宮殿）',
    body: [
      '坐在第七道門後的三位判官。面具底下什麼也沒有，眼睛是「死亡之眼」：被看一眼的人，就會死。門關了十八年，他們一個人也沒有判過，卻仍然三人一列，踩著同一個步伐。',
      '執旗判官：扛著判旗的長槍兵。長槍突刺（白光，很長）／旗槍橫掃（白光）／衝鋒（紅光，筆直衝過地面——跳過或閃避）。衝鋒時，執鼓判官會在前方架起鼓盾，執旗判官從他身旁直衝而過。',
      '特性：只要還有同伴站著，旗就不會倒——執旗判官倒下時會跪在旗下，什麼都碰不到他，直到最後一名同伴倒下，他才會跟著倒下；反過來，若兩名同伴先倒下，落單的執旗判官會失去一半的氣力。上方的血條是三人共有的。',
      '弱點：先擊倒執鐘判官，她會治療並加快其他人。',
    ],
  });
  pushOnce(HB, {
    id: 'c8_elite_shield', name: '執鼓判官', en: 'THE JUDGE OF THE DRUM', portrait: 'c8_elite_shield', unlock: 'seen_c8_elite_shield', tag: '三判官・執鼓',
    body: [
      '三判官之一。他把判鼓綁在手臂上當盾，拿毛氈鼓槌當武器。判決落下之前，要先擊鼓三聲——十八年來，他一聲也沒有擊過。',
      '攻擊模式：鼓盾猛撞（白光）／重擊鼓面，一圈聲波沿著地面滾來（紅光，跳過或閃避）／架鼓：架起鼓盾時正面攻擊無效，站在他身後的隊友也一起受到掩護。',
      '弱點：他總是擋在執鐘判官前面。繞過去，或等他把鼓放下。',
    ],
  });
  pushOnce(HB, {
    id: 'c8_elite_bell', name: '執鐘判官', en: 'THE JUDGE OF THE BELL', portrait: 'c8_elite_bell', unlock: 'seen_c8_elite_bell', tag: '三判官・執鐘',
    body: [
      '三判官之一，兜帽下是瓷面具與一層薄紗。她的鐘聲曾經替每一個走進門的亡者報名；現在，它只替空蕩的門口報時。',
      '攻擊模式：鳴鐘——高舉鐘杖搖響，治療並加快同伴，還會讓其中一人（通常是執旗判官）的下一擊變成紅光。／鐘聲環（白光，沿地面推進；完美格擋可彈回）／貼身時揮動鐘杖（白光）。',
      '弱點：搖鐘需要一點時間——在鐘響之前打中她，就能打斷。',
    ],
  });
})(window.G);

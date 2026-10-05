'use strict';
/* ECHOFALL — Chapter V「倒懸之塔」foes: Driftwatch 浮游哨, Voidling 虛空寂裔, Mender 縫補者, Breacher 壓艙者,
   and the elite Vela, the Navigator 領航員・薇拉 (the spire's navigator). See docs/STORY.md §3-V and docs/CHAPTER_API.md §4–5.
   Everything here is drawn procedurally: inked contours, hard cel tones, one glowing accent per foe. */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK, D = G.DATA;
  const DEBUG = typeof location !== 'undefined' && /[?&]hb=1\b/.test(location.search);
  const RED = '#ff2a5f', REDL = '#ff8aa6';
  const AURORA = '#6dffb5', VOID = '#a98bff', AMBER = '#ffb347', MAG = '#4fa8ff', ROSE = '#ff9ad5';

  /* ============================== drawing helpers ============================== */
  const dirv = (a, l) => ({ x: Math.sin(a) * l, y: Math.cos(a) * l });         // Rig convention: angle from straight down
  const addP = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  function poly(ctx, p) { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); }
  function polyP(ctx, p) { ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y); ctx.closePath(); }
  // smooth closed outline through the midpoints of a control polygon
  function blobP(ctx, p) {
    const n = p.length; ctx.beginPath();
    ctx.moveTo((p[n - 1].x + p[0].x) / 2, (p[n - 1].y + p[0].y) / 2);
    for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    ctx.closePath();
  }
  function ink(ctx, w = 1.3) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  // hard cel fill lit from the (mirrored) sun direction
  function cel(ctx, cx, cy, r, hex) { const L = Rig.lightDir(ctx); ctx.fillStyle = Rig.celGrad(ctx, cx, cy, L.x, L.y, r, 1, Rig.ramp(hex)); ctx.fill(); }
  function celN(ctx, cx, cy, nx, ny, r, hex) { const L = Rig.lightDir(ctx); ctx.fillStyle = Rig.celGrad(ctx, cx, cy, nx, ny, r, nx * L.x + ny * L.y >= 0 ? 1 : -1, Rig.ramp(hex)); ctx.fill(); }
  function glow(ctx, x, y, r, col, a) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, r, col, a); ctx.restore(); }
  function hatch(ctx, x0, y0, x1, y1, n, len) {
    ctx.strokeStyle = 'rgba(14,4,22,0.5)'; ctx.lineWidth = 0.6; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; ctx.moveTo(x, y); ctx.lineTo(x - len * 0.6, y + len); }
    ctx.stroke();
  }
  const solidAt = (x, y) => { for (const s of G.Phys.allSolids()) if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return true; return false; };

  /* pose sampling for the custom skeletons (any numeric keys) */
  const EASE = { lin: (t) => t, io: U.easeInOutSine, out: U.easeOutCubic, snap: (t) => 1 - Math.pow(1 - t, 4), in: U.easeInCubic };
  function lerpO(a, b, t) { const o = {}; for (const k in a) o[k] = a[k] + ((b[k] ?? a[k]) - a[k]) * t; return o; }
  function sampK(keys, t, lib, def) {
    const R = (p) => Object.assign({}, def, typeof p === 'string' ? (typeof lib[p] === 'function' ? lib[p](0) : lib[p]) : p);
    if (t <= keys[0][0]) return R(keys[0][1]);
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i];
      return lerpO(R(a[1]), R(b[1]), EASE[b[2] || 'io']((t - a[0]) / (b[0] - a[0] || 1)));
    }
    return R(keys[keys.length - 1][1]);
  }
  function blendTo(e, key, target, dt, k) {
    if (!e[key]) { e[key] = target; return; }
    if (dt > 0) e[key] = lerpO(e[key], target, 1 - Math.exp(-k * dt));
  }

  /* beams: aim lines that lock, flash, then fire an instant unblockable ray */
  function beamEnd(O, A, maxLen) {
    let dx = A.x - O.x, dy = A.y - O.y; const L0 = Math.hypot(dx, dy) || 1; dx /= L0; dy /= L0;
    let len = maxLen;
    for (let s = 30; s < maxLen; s += 22) if (solidAt(O.x + dx * s, O.y + dy * s)) { len = s; break; }
    const ar = G.game.arena;
    if (ar) { if (dx < -1e-3) len = Math.min(len, (ar.x0 - O.x) / dx); if (dx > 1e-3) len = Math.min(len, (ar.x1 - O.x) / dx); }
    len = Math.max(20, len);
    return { x: O.x + dx * len, y: O.y + dy * len, dx, dy, len };
  }
  function segHits(O, E, r, pad) {
    const L = Math.hypot(E.x - O.x, E.y - O.y), n = Math.max(2, Math.ceil(L / 9));
    for (let i = 0; i <= n; i++) {
      const x = O.x + (E.x - O.x) * i / n, y = O.y + (E.y - O.y) * i / n;
      if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return true;
    }
    return false;
  }
  function fireRail(e, O, o) {
    const A = e.aim; if (!A) return;
    const B = beamEnd(O, A, o.len || 1500);
    A.fired = true; A.ft = e.st; A.end = B;
    G.FX.beam(O.x, O.y, B.x, B.y, o.col || RED, 0.45, o.w || 16);
    G.FX.beam(O.x, O.y, B.x, B.y, '#ffffff', 0.2, (o.w || 16) * 0.45);
    G.FX.flash(O.x, O.y, 70, 0.16, '#ffffff'); G.FX.flash(B.x, B.y, 90, 0.22, o.col || RED);
    G.FX.spark(B.x, B.y, 16, { col: '#ffd0dc', speed: 620 });
    if (Math.abs(G.Phys.groundBelow(B.x, B.y - 30) - B.y) < 30) G.FX.dust(B.x, B.y, 10, { w: 30, speed: 220, size: 12 });
    G.SFX.play(o.sfx || 'c5_laser'); G.game.shake(o.shake || 0.25);
    const P = e.P;
    if (segHits(O, B, P.hurtbox, o.pad || 7)) P.receiveHit(e, { dmg: o.dmg, unblockable: true, kb: o.kb || 320, hx: P.x, hy: P.y - 60 });
  }
  // the aim line: thin and pale while it tracks, then a hard strobing line when it locks (= dodge now)
  function drawSight(ctx, O, E, k, locked, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const a = locked ? (Math.sin(t * 62) > 0 ? 1 : 0.5) : 0.22 + k * 0.5;
    ctx.strokeStyle = U.rgba(RED, a * 0.45); ctx.lineWidth = locked ? 8 : 2 + k * 3;
    ctx.beginPath(); ctx.moveTo(O.x, O.y); ctx.lineTo(E.x, E.y); ctx.stroke();
    ctx.strokeStyle = U.rgba(locked ? '#ffffff' : REDL, a); ctx.lineWidth = locked ? 2.2 : 1;
    ctx.beginPath(); ctx.moveTo(O.x, O.y); ctx.lineTo(E.x, E.y); ctx.stroke();
    // reticle where it bites
    ctx.translate(E.x, E.y); ctx.rotate(t * 3); const r = locked ? 9 : 13 - k * 4;
    ctx.strokeStyle = U.rgba(locked ? '#ffffff' : REDL, 0.8); ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) { ctx.rotate(PI / 2); ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r + 6, 0); ctx.stroke(); }
    ctx.restore();
  }

  /* shared lifecycle: death dissolves into drifting slices; ?hb=1 draws the live hitboxes */
  function dissolve(ctx, e, ghost) {
    const k = U.clamp(e.st / 0.5, 0, 1), T = e.T, s = T.scale || 1;
    const H = T.h * s * 1.3 + 70, W = Math.max(T.w * 2.8, 170) * s, top = e.y - H + 26, n = 18, bh = H / n;
    ctx.globalAlpha *= 1 - k * 0.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const r = ((i * 7919 + (e.seed || 3) * 104729) % 997) / 997;
      const vis = 1 - U.clamp((k - r * 0.65) / 0.35, 0, 1);
      if (vis <= 0) continue;
      ctx.rect(e.x - W / 2 + (r - 0.5) * 2 * k * 30, top + i * bh + bh * (1 - vis) * 0.5, W, bh * vis);
    }
    ctx.clip();
    ctx.translate((((e.seed || 3) % 2) ? 1 : -1) * k * 6, -k * 16);
    if (!ghost && Math.random() < 0.8) G.FX.ember(e.x, e.y - H * 0.5 * Math.random() - 10, 2, T.col, { w: T.w * s, h: 30, up: 160 });
  }
  function drawDebug(ctx, e) {
    ctx.save(); ctx.lineWidth = 2;
    if (e.state === 'atk' && e.atk && e.atk.hits) for (const h of e.atk.hits) {
      const on = e.st >= h.t0 && e.st <= h.t1, near = e.st >= h.t0 - 0.35 && e.st <= h.t1 + 0.1;
      if (!near) continue;
      const b = e.boxW(h.box); ctx.strokeStyle = on ? (h.red ? '#ff2a5f' : '#ffffff') : 'rgba(255,255,0,0.6)'; ctx.setLineDash(on ? [] : [5, 4]); ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(0,255,160,0.7)'; const b = e.box; ctx.strokeRect(b.x, b.y, b.w, b.h);
    if (e.dbgBox) { const d = e.dbgBox; ctx.strokeStyle = '#ff2a5f'; ctx.setLineDash([3, 3]); ctx.strokeRect(d.x, d.y, d.w, d.h); }
    ctx.restore();
  }
  function reg(id, T) {
    const raw = T.draw;
    T.draw = function (ctx, e, ghost) {
      ctx.save();
      if (e.state === 'die') dissolve(ctx, e, ghost);
      raw(ctx, e, ghost);
      ctx.restore();
      if (DEBUG && !ghost) drawDebug(ctx, e);
    };
    TYPES[id] = T;
    return T;
  }
  const seedOf = () => (Math.random() * 9973) | 0;
  // fliers keep their encounter height; a hover type spawned with no height lifts itself off the floor
  function hoverInit(e, h) {
    if (e._hv) return; e._hv = true;
    if (e.y0 == null) e.y0 = e.y;
    const fl = G.Phys.groundBelow(e.x, e.y0 - 10);
    if (fl < 1e8 && fl - e.y0 < 70) e.y0 = fl - h;
  }
  const hoverTo = (e, extra, k = 3) => { e.vy = (e.y0 + extra + Math.sin(e.t * 2.1 + e.seed) * 7 - e.y) * k; };
  const inArenaOK = (e, x) => {
    const ar = G.game.arena, L = G.LEVEL;
    if (ar && e.enc === ar.id && (x < ar.x0 + 40 || x > ar.x1 - 40)) return false;
    return x > L.bounds[0] + 40 && x < L.bounds[1] - 40;
  };
  // move the player by dx, refusing to push them into geometry
  function nudgeP(P, dx) {
    const ox = P.x; P.x += dx;
    const box = { x: P.x - P.w / 2, y: P.y - P.h + 4, w: P.w, h: P.h - 8 };
    for (const s of G.Phys.allSolids()) if (U.rectsOverlap(box, s)) { P.x = ox; return false; }
    return true;
  }

  /* ============================== SFX ============================== */
  const S = G.SFX;
  const A_ = () => G.AudioKit;
  S.c5_dwChirp = (t) => { const A = A_(); A.tone('square', 1700, t, 0.002, 0.02, 0.05, { to: 2600, wet: 0.25 }); A.tone('square', 2500, t + 0.075, 0.002, 0.016, 0.06, { to: 1400, wet: 0.25 }); A.tone('sine', 3400, t + 0.15, 0.002, 0.02, 0.12, { wet: 0.5 }); };
  S.c5_charge = (t, len = 1) => { const A = A_(); A.tone('sawtooth', 180, t, len * 0.95, 0.03, 0.06, { to: 1500, filter: 'lowpass', ff: 2400, wet: 0.3 }); A.tone('sine', 360, t, len * 0.95, 0.035, 0.05, { to: 2200, wet: 0.4 }); };
  S.c5_lock = (t) => { const A = A_(); for (let i = 0; i < 3; i++) A.tone('square', 2350, t + i * 0.06, 0.001, 0.03, 0.035, { wet: 0.1 }); };
  S.c5_laser = (t) => { const A = A_(); A.tone('sawtooth', 2100, t, 0.002, 0.09, 0.42, { to: 160, filter: 'lowpass', ff: 3800, wet: 0.35 }); A.noise(t, 0.002, 0.22, 0.32, 'highpass', 2600, 700, 0.8, 0.3); A.tone('sine', 90, t, 0.003, 0.3, 0.3, { to: 40, wet: 0.1 }); };
  S.c5_pulseCharge = (t) => { const A = A_(); A.tone('triangle', 220, t, 0.55, 0.05, 0.05, { to: 880, wet: 0.4 }); A.noise(t, 0.5, 0.05, 0.1, 'bandpass', 600, 3000, 2, 0.2); };
  S.c5_pulse = (t) => { const A = A_(); A.tone('sine', 150, t, 0.002, 0.4, 0.35, { to: 50, wet: 0.2 }); A.noise(t, 0.002, 0.2, 0.25, 'bandpass', 1800, 400, 0.9, 0.3); A.bell(1320, t, 0.04, 0.6, 0.5, 1.2); };
  S.c5_blink = (t) => { const A = A_(); A.noise(t, 0.34, 0.12, 0.08, 'bandpass', 260, 4200, 3, 0.4); A.tone('sine', 1300, t, 0.3, 0.04, 0.1, { to: 140, wet: 0.6 }); A.tone('sine', 1311, t + 0.42, 0.01, 0.05, 0.4, { to: 2600, wet: 0.7 }); };
  S.c5_voidHiss = (t) => { const A = A_(); A.noise(t, 0.12, 0.08, 0.35, 'highpass', 5200, 2400, 0.7, 0.5); A.tone('sine', 523, t, 0.1, 0.02, 0.4, { to: 503, wet: 0.7 }); A.tone('sine', 530, t, 0.1, 0.02, 0.4, { to: 560, wet: 0.7 }); };
  S.c5_servo = (t) => { const A = A_(); for (let i = 0; i < 3; i++) A.tone('square', 420 + i * 120, t + i * 0.055, 0.004, 0.018, 0.04, { to: 700 + i * 150, filter: 'lowpass', ff: 2000, wet: 0.1 }); };
  S.c5_weld = (t) => { const A = A_(); for (let i = 0; i < 6; i++) A.noise(t + i * 0.022 + Math.random() * 0.01, 0.001, 0.07, 0.03, 'highpass', 3500, 6000, 1, 0.08); A.tone('sawtooth', 95, t, 0.004, 0.05, 0.18, { filter: 'lowpass', ff: 600 }); };
  S.c5_tether = (t) => { const A = A_(); A.bell(A.mtof(79), t, 0.05, 1.1, 0.6, 0.6); A.tone('sine', A.mtof(86), t + 0.08, 0.02, 0.03, 0.8, { wet: 0.7 }); };
  S.c5_spit = (t) => { const A = A_(); A.noise(t, 0.003, 0.14, 0.14, 'bandpass', 2400, 900, 1.5, 0.1); A.tone('sine', 700, t, 0.003, 0.05, 0.12, { to: 300 }); };
  S.c5_clank = (t) => { const A = A_(); A.tone('sine', 58, t, 0.002, 0.3, 0.2, { to: 36, wet: 0.08 }); A.tone('square', 1250, t + 0.005, 0.001, 0.02, 0.12, { to: 1150, filter: 'bandpass', ff: 1400, wet: 0.3 }); A.noise(t, 0.002, 0.09, 0.08, 'lowpass', 700, 150, 0.7, 0.05); };
  S.c5_magHum = (t) => { const A = A_(); A.tone('sawtooth', 55, t, 0.5, 0.06, 0.4, { to: 62, filter: 'lowpass', ff: 420, wet: 0.2 }); A.tone('sine', 110, t, 0.6, 0.05, 0.3, { to: 220, wet: 0.3 }); };
  S.c5_clamp = (t) => { const A = A_(); A.tone('square', 900, t, 0.002, 0.05, 0.05, { to: 400, filter: 'lowpass', ff: 2500 }); A.tone('sine', 70, t, 0.002, 0.25, 0.25, { to: 40 }); A.noise(t, 0.002, 0.12, 0.12, 'bandpass', 1500, 500, 1, 0.1); };
  S.c5_vent = (t) => { const A = A_(); A.noise(t, 0.04, 0.16, 0.9, 'highpass', 1800, 900, 0.6, 0.3); A.tone('sine', 300, t, 0.02, 0.02, 0.6, { to: 120, wet: 0.4 }); };
  S.c5_brVoice = (t) => { const A = A_(); A.tone('sawtooth', 62, t, 0.08, 0.1, 0.5, { to: 48, filter: 'lowpass', ff: 380, wet: 0.2 }); A.noise(t, 0.05, 0.08, 0.4, 'bandpass', 400, 200, 1.4, 0.2); };
  S.c5_shot = (t) => { const A = A_(); A.noise(t, 0.001, 0.32, 0.12, 'lowpass', 3200, 300, 0.7, 0.22); A.tone('sine', 140, t, 0.001, 0.32, 0.14, { to: 45 }); A.noise(t, 0.001, 0.12, 0.05, 'highpass', 5000, null, 0.7, 0.4); };
  S.c5_rail = (t) => { const A = A_(); S.c5_laser(t); A.tone('sine', 55, t, 0.002, 0.5, 0.7, { to: 28, wet: 0.3 }); A.noise(t + 0.05, 0.01, 0.12, 1.1, 'lowpass', 1400, 200, 0.6, 0.6); };
  S.c5_mineBeep = (t) => { const A = A_(); A.tone('square', 1900, t, 0.001, 0.025, 0.06, { wet: 0.2 }); };
  S.c5_boom = (t) => { const A = A_(); A.tone('sine', 70, t, 0.003, 0.55, 0.6, { to: 30, wet: 0.2 }); A.noise(t, 0.003, 0.35, 0.6, 'lowpass', 2400, 120, 0.7, 0.35); A.bell(1660, t, 0.03, 0.5, 0.4, 1.3); };
  S.c5_velaVoice = (t) => { const A = A_(); A.noise(t, 0.12, 0.05, 0.4, 'bandpass', 900, 600, 1.2, 0.4); A.tone('square', 1500, t + 0.25, 0.001, 0.02, 0.03, { wet: 0.1 }); A.tone('square', 1100, t + 0.3, 0.001, 0.02, 0.03, { wet: 0.1 }); };
  S.c5_breath = (t) => { const A = A_(); A.noise(t, 0.2, 0.06, 0.6, 'bandpass', 700, 380, 0.9, 0.5); };
  S.c5_grapple = (t) => { const A = A_(); A.tone('square', 600, t, 0.002, 0.04, 0.06, { to: 1200 }); A.noise(t, 0.01, 0.1, 0.35, 'bandpass', 1500, 4000, 2, 0.2); };
  S.c5_shatter = (t) => { const A = A_(); S.crystal(t, 6); A.noise(t, 0.002, 0.18, 0.4, 'highpass', 3000, 1200, 0.8, 0.5); };

  /* =====================================================================================
     DRIFTWATCH 浮游哨 — an enamel orbital sentry: lens eye, a broken halo of three plates.
     red: aim line → lock flash → beam · white: shock pulse when you get close
     ===================================================================================== */
  const dwEye = (e) => ({ x: e.x + e.facing * 13, y: e.y - 37 });
  function dwRing(ctx, ang, RX, RY, front, accent, tilt) {
    ctx.save(); ctx.rotate(tilt); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const a0 = ang + i * TAU / 3;
      let run = [];
      const flush = () => {
        if (run.length > 1) {
          ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); for (const q of run) ctx.lineTo(q[0], q[1]);
          ctx.strokeStyle = INK; ctx.lineWidth = 7.4; ctx.stroke();
          ctx.strokeStyle = front ? '#e9edf5' : '#8a8db5'; ctx.lineWidth = 4.4; ctx.stroke();
          if (front) { ctx.strokeStyle = '#9da2c8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1] + 1.3); for (const q of run) ctx.lineTo(q[0], q[1] + 1.3); ctx.stroke(); }
        }
        run = [];
      };
      for (let k = 0; k <= 10; k++) { const th = a0 + 1.45 * k / 10; if ((Math.sin(th) > 0) !== front) { flush(); continue; } run.push([Math.cos(th) * RX, Math.sin(th) * RY]); }
      flush();
      const th = a0 + 0.72;
      if ((Math.sin(th) > 0) === front) {
        const x = Math.cos(th) * RX, y = Math.sin(th) * RY;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 7, accent, front ? 0.8 : 0.35);
        ctx.fillStyle = front ? '#ffffff' : U.rgba(accent, 0.7); ctx.fillRect(x - 1.1, y - 1.1, 2.2, 2.2); ctx.restore();
      }
    }
    ctx.restore();
  }
  const DW = reg('c5_driftwatch', {
    name: '浮游哨', en: 'DRIFTWATCH', w: 56, h: 66, hp: 75, bal: 55, col: AURORA, shards: 36, fly: true, hover: true, spawnT: 0.8, kbMul: 0.7,
    portrait: [3.3, 0.62],
    init(e) { e.seed = seedOf(); e.tail = new Rig.Chain(7, 6, 0.05, 0.9); e.ringA = Math.random() * TAU; e.aim = null; e.dip = 0; },
    voice: () => G.SFX.play('c5_dwChirp'),
    weapon: (e) => dwEye(e),
    think(e, dt) {
      hoverInit(e, 175);
      e.faceP();
      const P = e.P, d = e.distP();
      const tx = d < 250 ? -e.facing * 170 : d > 520 ? e.facing * 150 : Math.sin(e.t * 0.8 + e.seed) * 50;
      e.vx = U.approach(e.vx, tx * e.speedMul, 420 * dt);
      hoverTo(e, 0);
      if (e.cd <= 0) {
        const vgap = (P.y - 60) - (e.y - 38);
        if (d < 190 && vgap > -120 && vgap < 300) { e.dip = U.clamp(vgap - 40, 0, 190); e.startAtk(DW.pulse); }
        else if (d < 880) e.startAtk(DW.laser);
      }
    },
    laser: {
      dur: 2.1, cd: 2.3, tells: [{ t: 0.3, c: 'red' }],
      ev: [
        { t: 0.01, fn: (e) => { const P = e.P; e.aim = { x: P.x, y: P.y - 58, lock: false, fired: false }; G.SFX.play('c5_charge', 1.0); } },
        { t: 0.97, fn: (e) => { if (e.aim) e.aim.lock = true; G.SFX.play('c5_lock'); } },
        { t: 1.3, fn: (e) => fireRail(e, dwEye(e), { dmg: 24, col: '#ff3d6a', w: 15, len: 1400 }) },
      ],
    },
    pulse: {
      dur: 1.45, cd: 1.6, tells: [{ t: 0.22, c: 'white' }],
      // the box is the ring's full radius (150) around the core, drawn in sync below
      hits: [{ t0: 0.78, t1: 0.92, box: { x: -150, y: -188, w: 300, h: 300 }, dmg: 16, kb: 320, last: true, pbal: 42 }],
      ev: [
        { t: 0.04, fn: () => G.SFX.play('c5_pulseCharge') },
        { t: 0.78, fn: (e) => { const x = e.x, y = e.y - 38; G.FX.ring(x, y, 120, 175, 0.3, '#ffffff', 5); G.FX.ring(x, y, 60, 150, 0.4, AURORA, 3); G.FX.flash(x, y, 130, 0.16, '#e9fff4'); G.FX.spark(x, y, 14, { col: '#d9fff0', speed: 700 }); G.SFX.play('c5_pulse'); G.game.shake(0.22); } },
      ],
    },
    atkUpdate(e, dt) {
      hoverInit(e, 175);
      const a = e.atk;
      if (a === DW.laser) {
        e.vx = U.approach(e.vx, 0, 500 * dt); hoverTo(e, 0);
        if (e.aim && !e.aim.lock) { const P = e.P, sp = 430 * dt; e.aim.x = U.approach(e.aim.x, P.x, sp); e.aim.y = U.approach(e.aim.y, P.y - 58, sp); }
        if (e.aim && !e.aim.fired) { e.facing = e.aim.x < e.x ? -1 : 1; e.aim.end = beamEnd(dwEye(e), e.aim, 1400); }
      } else if (a === DW.pulse) {
        hoverTo(e, e.st < 1.0 ? e.dip * U.easeOutCubic(U.clamp(e.st / 0.6, 0, 1)) : 0, 5);
        e.vx = U.approach(e.vx, U.clamp(e.dxP() * 2, -120, 120) * (e.st < 0.7 ? 1 : 0), 600 * dt);
      }
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, a = e.state === 'atk' ? e.atk : null;
      const sp = K.emerge(ctx, e);
      const broken = e.state === 'broken', hurt = e.state === 'hurt' || e.state === 'recoil';
      const chg = a === DW.laser ? U.clamp(e.st / 0.97, 0, 1) : 0;
      const laserHot = a === DW.laser && e.st < 1.55;
      const locked = a === DW.laser && e.aim && e.aim.lock && !e.aim.fired;
      const pk = a === DW.pulse ? U.clamp(e.st / 0.78, 0, 1) * (e.st < 0.95 ? 1 : 0) : 0;
      const pr = a === DW.pulse && e.st >= 0.78 && e.st < 1.0 ? U.clamp((e.st - 0.78) / 0.12, 0, 1) : -1;
      const accent = laserHot ? '#ff3d6a' : pk > 0 ? '#ffffff' : AURORA;
      if (dt > 0) e.ringA += dt * ((broken ? 0.25 : 1.3) + chg * 7 + pk * 10);
      // trailing antenna cable (world space)
      if (dt > 0) e.tail.update(e.x - e.facing * 7, e.y - 20, e.facing, dt, -e.vx * 3 + Math.sin(e.t * 1.7) * 90, PI - 0.25);
      if (e.tail.inited && sp < 0.6) {
        Rig.ribbon(ctx, e.tail.p, 1.9, 0.8, '#262340'); ink(ctx, 0.9);
        const q = e.tail.p[e.tail.p.length - 1], on = Math.sin(e.t * 5 + e.seed) > 0.2;
        ctx.fillStyle = '#d7dbe9'; ctx.beginPath(); ctx.arc(q.x, q.y, 2.6, 0, TAU); ctx.fill(); ink(ctx, 1);
        if (on) glow(ctx, q.x, q.y, 9, accent, 0.7);
      }
      if (a === DW.laser && e.aim && !e.aim.fired && e.aim.end && e.st > 0.15) drawSight(ctx, dwEye(e), e.aim.end, chg, locked, e.t);
      ctx.translate(e.x, e.y - 38); ctx.scale(e.facing, 1);
      if (sp > 0) { ctx.globalAlpha *= 1 - sp; ctx.scale(1 - sp * 0.4, 1 + sp * 0.5); }
      const tilt = U.clamp(e.vx * e.facing / 520, -1, 1) * 0.22 - e.hitK * 0.5 + (hurt ? -0.28 : 0) + (broken ? 0.55 + Math.sin(e.t * 2.6) * 0.12 : 0) - chg * 0.12 + pk * 0.1;
      ctx.rotate(tilt);
      const jit = broken && Math.sin(e.t * 31) > 0.6 ? 1 : 0;
      // thruster plumes
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const x of [-8, 5]) {
        const L = (broken ? 5 : 12) + Math.sin(e.t * 47 + x) * 4 + pk * 10;
        ctx.fillStyle = U.rgba(AURORA, 0.5); ctx.beginPath(); ctx.moveTo(x - 3.6, 15); ctx.lineTo(x, 15 + L); ctx.lineTo(x + 3.6, 15); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.moveTo(x - 1.5, 15); ctx.lineTo(x, 15 + L * 0.55); ctx.lineTo(x + 1.5, 15); ctx.fill();
      }
      ctx.restore();
      // dorsal + ventral fins
      poly(ctx, [[-12, -12], [-42, -36], [-50, -31], [-26, 1]]); celN(ctx, -32, -18, 0.6, -0.8, 14, '#b9bdd8'); ink(ctx, 1.5);
      ctx.strokeStyle = U.rgba(accent, 0.85); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-22, -10); ctx.lineTo(-43, -31); ctx.stroke();
      poly(ctx, [[-9, 10], [-30, 29], [-23, 32], [-3, 15]]); celN(ctx, -16, 20, 0.6, -0.8, 10, '#8e92b8'); ink(ctx, 1.3);
      const RX = 34 + pk * 9 + (broken ? 2 : 0), RY = 10 + pk * 2, rt = -0.32 + (broken ? 0.35 : 0);
      dwRing(ctx, e.ringA, RX, RY, false, accent, rt);
      // shell
      const shell = () => { ctx.beginPath(); ctx.moveTo(18, -2); ctx.bezierCurveTo(18, -17, 4, -22, -8, -19); ctx.bezierCurveTo(-19, -16, -27, -7, -29, 1); ctx.bezierCurveTo(-25, 10, -12, 18, 0, 18); ctx.bezierCurveTo(11, 18, 18, 10, 18, -2); ctx.closePath(); };
      shell(); cel(ctx, -2, -1, 20, '#e4e8f1'); ink(ctx, 1.7);
      ctx.save(); shell(); ctx.clip();
      ctx.fillStyle = '#7b7fae'; ctx.beginPath(); ctx.moveTo(-30, 6); ctx.quadraticCurveTo(-6, 9, 20, 4); ctx.lineTo(20, 20); ctx.lineTo(-30, 20); ctx.closePath(); ctx.fill(); // underbelly shadow
      ctx.strokeStyle = U.rgba(accent, 0.95); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-28, 3); ctx.quadraticCurveTo(-8, 7, 18, 3); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-9, -19); ctx.quadraticCurveTo(-16, 0, -8, 17); ctx.stroke();
      ctx.fillStyle = INK; for (const [x, y] of [[-12.5, -11], [-14, -3], [-13, 5]]) { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, TAU); ctx.fill(); }
      hatch(ctx, -24, 9, -6, 14, 5, 3);
      // brow cowl over the lens
      poly(ctx, [[-5, -19], [11, -17], [22, -7], [19, -3], [7, -9], [-6, -11]]); celN(ctx, 8, -12, 0.3, -0.95, 9, '#cfd3e6'); ink(ctx, 1.3);
      // faceplate + lens
      ctx.beginPath(); ctx.ellipse(9.5, 2.5, 9.5, 10.5, 0, 0, TAU); ctx.fillStyle = '#10131f'; ctx.fill(); ink(ctx, 1.5);
      const ir = 6.4 - chg * 2.4 + (locked ? Math.sin(e.t * 50) * 0.7 : 0);
      const ia = broken ? (Math.sin(e.t * 23) > 0 ? 1 : 0.25) : 1;
      glow(ctx, 11, 2.5, 15 + chg * 16 + pk * 12, accent, (0.5 + chg * 0.45) * ia);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = U.rgba(accent, ia); ctx.lineWidth = 2.1; ctx.beginPath(); ctx.arc(11, 2.5, ir, 0, TAU); ctx.stroke();
      ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(11, 2.5, ir + 2.2, -0.6 + e.t * 2, 1.2 + e.t * 2); ctx.stroke();
      ctx.fillStyle = U.rgba('#ffffff', ia); ctx.beginPath(); ctx.ellipse(12 + jit, 2.5, 1.4, Math.max(1.4, ir * 0.72), 0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.moveTo(4, -4); ctx.quadraticCurveTo(7, -7, 11, -6.5); ctx.lineTo(10, -5); ctx.quadraticCurveTo(7, -5.5, 5, -3); ctx.closePath(); ctx.fill();
      // chin vents
      ctx.strokeStyle = INK; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(1 + i * 4, 13.5); ctx.lineTo(3 + i * 4, 16.5); ctx.stroke(); }
      // antenna mast
      ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-7, -18); ctx.lineTo(-11, -30); ctx.lineTo(-17, -36); ctx.stroke();
      ctx.strokeStyle = '#c9cde0'; ctx.lineWidth = 1.1; ctx.stroke();
      if (Math.sin(e.t * 4 + e.seed) > 0) glow(ctx, -17, -36, 8, accent, 0.8);
      dwRing(ctx, e.ringA, RX, RY, true, accent, rt);
      // near winglet
      poly(ctx, [[-4, 3], [-27, 13], [-31, 19], [-3, 11]]); celN(ctx, -14, 11, 0.5, -0.85, 8, '#d3d7e8'); ink(ctx, 1.3);
      // pulse wind-up: the halo opens, arcs crawl over the shell
      if (pk > 0) {
        glow(ctx, 0, 0, 30 + pk * 30, '#e9fff4', 0.25 + pk * 0.45);
        if (!ghost) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba('#e9fff4', 0.8); ctx.lineWidth = 1.2;
          for (let i = 0; i < 3; i++) {
            const a0 = Math.random() * TAU, r0 = 18, r1 = 30 + pk * 22; ctx.beginPath(); ctx.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
            for (let k = 1; k <= 4; k++) { const rr = r0 + (r1 - r0) * k / 4, aa = a0 + (Math.random() - 0.5) * 0.5; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      if (pr >= 0) {
        const r = 22 + 128 * U.easeOutCubic(pr);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.rgba('#ffffff', 0.9 * (1 - pr * 0.4)); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = U.rgba(AURORA, 0.55); ctx.lineWidth = 16; ctx.stroke();
        ctx.restore();
      }
      if (broken && !ghost && Math.random() < 0.12) G.FX.spark(e.x, e.y - 38, 3, { col: '#d9fff0', speed: 300 });
    },
  });

  /* =====================================================================================
     VOIDLING 真空寂裔 — what came back of a Descent V spacewalker: a cracked helmet full of stars,
     mantis blades, a void tail. shimmer → blink behind you → red backstab → white slash
     ===================================================================================== */
  const VDEF = { hy: -50, lean: 0.55, neck: 0.55, aF: 0.75, eF: -1.95, bF: 2.75, aB: 0.5, eB: -1.7, bB: 2.6, fF: 20, fB: -18, lF: 0, lB: 0 };
  const VDP = {
    idle: (t) => ({ hy: -50 + Math.sin(t * 2.2) * 1.6, lean: 0.55 + Math.sin(t * 1.1) * 0.05, neck: 0.55 + Math.sin(t * 0.7) * 0.12, aF: 0.75 + Math.sin(t * 2.2) * 0.05, eF: -1.95, bF: 2.75, aB: 0.5, eB: -1.7, bB: 2.6, fF: 20, fB: -18 }),
    walk: (p, t) => ({ hy: -46 + Math.abs(Math.sin(p)) * -3, lean: 0.75, neck: 0.45 + Math.sin(t * 0.7) * 0.08, aF: 0.95 + Math.sin(p) * 0.15, eF: -2.0, bF: 2.85, aB: 0.6 - Math.sin(p) * 0.15, eB: -1.8, bB: 2.7, fF: 22 + Math.cos(p) * 17, lF: Math.max(0, Math.sin(p)) * 10, fB: -14 + Math.cos(p + PI) * 17, lB: Math.max(0, Math.sin(p + PI)) * 10 }),
    rakeW: { hy: -46, lean: 0.22, neck: 0.3, aF: 2.75, eF: 0.45, bF: 0.6, aB: -0.4, eB: -1.3, bB: 2.3, fF: 26, fB: -24 },
    rakeS: { hy: -40, lean: 0.88, neck: 0.65, aF: 1.18, eF: -0.12, bF: -0.25, aB: 1.5, eB: -1.5, bB: 1.7, fF: 36, fB: -26 },
    rakeW2: { hy: -44, lean: 0.45, neck: 0.4, aF: 0.6, eF: -1.6, bF: 2.4, aB: 2.7, eB: 0.45, bB: 0.6, fF: 30, fB: -24 },
    rakeS2: { hy: -40, lean: 0.88, neck: 0.65, aF: 1.5, eF: -1.7, bF: 2.6, aB: 1.18, eB: -0.12, bB: -0.25, fF: 38, fB: -24 },
    shimmer: { hy: -42, lean: 0.25, neck: 0.95, aF: 0.15, eF: -2.5, bF: 2.9, aB: 0.0, eB: -2.3, bB: 2.8, fF: 16, fB: -14 },
    stabW: { hy: -38, lean: 0.25, neck: 0.4, aF: -0.55, eF: 2.12, bF: 0.0, aB: 0.9, eB: -1.9, bB: 2.6, fF: 30, fB: -30 },
    stabS: { hy: -46, lean: 0.98, neck: 0.75, aF: 1.52, eF: 0.06, bF: 0.0, aB: 0.2, eB: -0.8, bB: 2.0, fF: 46, fB: -34 },
    hurt: { hy: -54, lean: -0.15, neck: -0.35, aF: -0.2, eF: -1.1, bF: 2.2, aB: -0.4, eB: -0.9, bB: 2.0, fF: 16, fB: -22 },
    broken: (t) => ({ hy: -28 + Math.sin(t * 2.5) * 1.5, lean: 1.3, neck: 1.05, aF: 0.1, eF: -0.4, bF: 1.1, aB: -0.25, eB: -0.3, bB: 1.0, fF: 26, fB: -22 }),
  };
  function vdJ(p) {
    const hip = { x: 0, y: p.hy };
    const chest = { x: hip.x + Math.sin(p.lean) * 44, y: hip.y - Math.cos(p.lean) * 44 };
    const na = p.lean + p.neck;
    const head = { x: chest.x + Math.sin(na) * 18, y: chest.y - Math.cos(na) * 18 };
    const sh = { x: chest.x - Math.sin(p.lean) * 5, y: chest.y + Math.cos(p.lean) * 5 };
    const arm = (a, el, bl) => { const elb = addP(sh, dirv(a, 22)), wr = addP(elb, dirv(a + el, 21)), ba = a + el + bl; return { elb, wr, ba, tip: addP(wr, dirv(ba, 46)) }; };
    const leg = (fx, lift, k) => {
      const foot = { x: fx, y: -lift }, hock = { x: fx - 13, y: -lift - 17 };
      const knee = { x: (hip.x + hock.x) / 2 + 15 + k, y: (hip.y + hock.y) / 2 + 2 };
      return [hip, knee, hock, foot];
    };
    return { hip, chest, head, na, sh, F: arm(p.aF, p.eF, p.bF), B: arm(p.aB, p.eB, p.bB), LF: leg(p.fF, p.lF, 0), LB: leg(p.fB, p.lB, -3) };
  }
  function vdBlade(ctx, wr, ba, len, hot) {
    const u = { x: Math.sin(ba), y: Math.cos(ba) }, n = { x: Math.cos(ba), y: -Math.sin(ba) };
    const tip = { x: wr.x + u.x * len, y: wr.y + u.y * len };
    const P = (s, f) => ({ x: wr.x + u.x * s + n.x * f, y: wr.y + u.y * s + n.y * f });
    const o1 = P(len * 0.45, 15), i1 = P(len * 0.55, 5), b0 = P(-3, 4), b1 = P(-2, -3);
    ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.quadraticCurveTo(o1.x, o1.y, tip.x, tip.y); ctx.quadraticCurveTo(i1.x, i1.y, b1.x, b1.y); ctx.closePath();
    const g = ctx.createLinearGradient(wr.x, wr.y, tip.x, tip.y);
    g.addColorStop(0, '#1d1438'); g.addColorStop(0.55, '#5d43b0'); g.addColorStop(1, '#f1e8ff');
    ctx.fillStyle = g; ctx.fill(); ink(ctx, 1.4);
    // inner (cutting) edge burns
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(hot || VOID, 0.85); ctx.lineWidth = 1.3;
    ctx.beginPath(); const m = P(len * 0.25, 3.5); ctx.moveTo(m.x, m.y); ctx.quadraticCurveTo(i1.x, i1.y, tip.x, tip.y); ctx.stroke(); ctx.restore();
    // serration notches on the spine
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath();
    for (const s of [0.3, 0.45, 0.6]) { const p = P(len * s, 11.5 - Math.abs(s - 0.45) * 12), q = P(len * s + 4, 7); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); }
    ctx.stroke();
    return tip;
  }
  function vdBody(ctx, e, J, p, ghost) {
    const a = e.state === 'atk' ? e.atk : null;
    // void tail streaming from the hips
    if (e.tail.inited) {
      const pts = e.tail.p.map((q) => ({ x: (q.x - e.x) * e.facing, y: q.y - e.y - (e._sink || 0) }));
      K.tattered(ctx, pts, 5, 11, '#2b2056', '#110b24', e.seed % 7);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; Rig.ribbon(ctx, pts.slice(2), 1.2, 0.3, U.rgba(VOID, 0.35)); ctx.restore();
    }
    const LEG = '#2a2148', LEGB = '#181230';
    // back leg + arm
    Rig.limbChain(ctx, J.LB, [6.2, 4.6, 3, 2], LEGB);
    const toe = (L, c) => { const f = L[3]; poly(ctx, [[f.x - 2, f.y - 2], [f.x + 9, f.y], [f.x - 1, f.y + 1.5]]); ctx.fillStyle = c; ctx.fill(); ink(ctx, 1); };
    toe(J.LB, '#0e0a1c');
    Rig.limbChain(ctx, [J.sh, J.B.elb, J.B.wr], [3.6, 3, 2.4], LEGB);
    const tipB = vdBlade(ctx, J.B.wr, J.B.ba, 44, null);
    // torso: a hunched void spindle with crystal spines
    const tA = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x), ux = Math.cos(tA), uy = Math.sin(tA), nx = -uy, ny = ux;
    const Q = (s, f) => ({ x: J.hip.x + ux * s * 44 + nx * f, y: J.hip.y + uy * s * 44 + ny * f });
    // spines first (behind the back)
    for (const [s, l, w] of [[0.35, 11, 3], [0.55, 15, 3.6], [0.75, 13, 3.2], [0.92, 9, 2.6]]) {
      const b = Q(s, -8), tip = Q(s - 0.08, -8 - l);
      ctx.beginPath(); ctx.moveTo(b.x - ux * w * 2, b.y - uy * w * 2); ctx.lineTo(tip.x, tip.y); ctx.lineTo(b.x + ux * w * 2, b.y + uy * w * 2); ctx.closePath();
      ctx.fillStyle = '#7b5fd0'; ctx.fill(); ink(ctx, 1.1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba('#d9c8ff', 0.7); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(tip.x, tip.y); ctx.stroke(); ctx.restore();
    }
    const tp = [Q(-0.12, -6), Q(0.3, -10), Q(0.7, -11), Q(1.05, -7), Q(1.12, 3), Q(0.85, 10), Q(0.45, 8), Q(0.02, 6)];
    blobP(ctx, tp); celN(ctx, Q(0.5, 0).x, Q(0.5, 0).y, nx, ny, 12, '#231a44'); ink(ctx, 1.5);
    // starfield inside the body
    ctx.save(); blobP(ctx, tp); ctx.clip();
    const ng = ctx.createRadialGradient(Q(0.55, -2).x, Q(0.55, -2).y, 0, Q(0.55, -2).x, Q(0.55, -2).y, 18);
    ng.addColorStop(0, 'rgba(120,80,220,0.55)'); ng.addColorStop(1, 'rgba(30,16,60,0)'); ctx.fillStyle = ng; ctx.fillRect(Q(0.55, 0).x - 20, Q(0.55, 0).y - 20, 40, 40);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 9; i++) {
      const r1 = ((e.seed * 31 + i * 97) % 89) / 89, r2 = ((e.seed * 17 + i * 53) % 61) / 61, tw = 0.45 + 0.55 * Math.sin(e.t * 3 + i * 1.7);
      const q = Q(0.05 + r1 * 1.0, (r2 - 0.5) * 16); ctx.globalAlpha = tw; ctx.fillRect(q.x - 0.7, q.y - 0.7, i % 3 ? 1.4 : 2.2, i % 3 ? 1.4 : 2.2);
    }
    ctx.restore(); ctx.globalAlpha = 1;
    // torn spacesuit plate over the chest
    const pl = [Q(0.42, 2), Q(0.62, 0.5), Q(0.78, 2.5), Q(0.98, 1), Q(1.04, 7), Q(0.82, 10.5), Q(0.6, 8), Q(0.5, 10), Q(0.4, 7)];
    polyP(ctx, pl); celN(ctx, Q(0.75, 6).x, Q(0.75, 6).y, nx, ny, 7, '#dfe1ee'); ink(ctx, 1.1);
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 0.7; ctx.beginPath(); const c1 = Q(0.7, 3), c2 = Q(0.76, 6.5), c3 = Q(0.68, 9); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(c3.x, c3.y); ctx.stroke();
    // Descent V chevron, faded
    const v0 = Q(0.86, 5.5); ctx.strokeStyle = '#d4627e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(v0.x - 2.2, v0.y - 2); ctx.lineTo(v0.x, v0.y + 1.6); ctx.lineTo(v0.x + 2.2, v0.y - 2); ctx.stroke();
    // tattered suit strips at the waist
    for (const [f, len] of [[-4, 12], [2, 16], [7, 10]]) {
      const b = Q(0.02, f), sw = Math.sin(e.t * 3 + f) * 3 - e.vx * e.facing * 0.01;
      poly(ctx, [[b.x - 2.5, b.y], [b.x + 2.5, b.y], [b.x + 1 + sw, b.y + len], [b.x - 1 + sw, b.y + len - 3]]); ctx.fillStyle = '#b9bbd0'; ctx.fill(); ink(ctx, 0.9);
    }
    // front leg
    Rig.limbChain(ctx, J.LF, [6.8, 5, 3.3, 2.2], LEG, { spec: 0.15 });
    toe(J.LF, '#151026');
    // neck + head (cracked helmet full of stars)
    Rig.limb(ctx, Q(1.02, 1), J.head, 3.4, 2.8, '#221a40');
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate((J.na - 0.85) * 0.7);
    ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(-12, -16); ctx.lineTo(-17, -15); ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.stroke(); ctx.strokeStyle = '#b8bccf'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 11.5, 0, TAU); cel(ctx, 0, 0, 11.5, '#d3d6e6'); ink(ctx, 1.6);
    ctx.beginPath(); ctx.ellipse(-3, 10, 7.5, 3, -0.2, 0, TAU); ctx.fillStyle = '#4b4b62'; ctx.fill(); ink(ctx, 1);
    const visor = () => { ctx.beginPath(); ctx.moveTo(-1, -9); ctx.lineTo(4, -7.5); ctx.lineTo(6, -10); ctx.lineTo(9.5, -5); ctx.lineTo(12.5, -3); ctx.quadraticCurveTo(13.5, 4, 9, 8.5); ctx.lineTo(3, 9); ctx.quadraticCurveTo(-2, 2, -1, -9); ctx.closePath(); };
    visor(); ctx.fillStyle = '#07040f'; ctx.fill();
    ctx.save(); visor(); ctx.clip();
    ctx.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(e.t * 2 + i)); ctx.fillRect(1 + ((i * 37 + e.seed) % 10), -6 + ((i * 23 + e.seed) % 13), 1.1, 1.1); }
    ctx.restore(); ctx.globalAlpha = 1;
    visor(); ink(ctx, 1.2);
    // shattered glass rim
    ctx.fillStyle = 'rgba(190,235,255,0.75)'; poly(ctx, [[9.5, -5], [12.5, -3], [11, -1]]); ctx.fill(); poly(ctx, [[4, -7.5], [6, -10], [6.5, -7]]); ctx.fill();
    // one violet eye in the dark
    const eh = a && a.vp && e.st < 0.45 && a === VDT.blink ? 1.6 : 1;
    glow(ctx, 6.5, 0.5, 11 * eh, e.tellT > 0 && e.tellCol === 'red' ? RED : VOID, 0.75);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#f0e6ff'; ctx.beginPath(); ctx.ellipse(6.5, 0.5, 2.6, 1.1, -0.15, 0, TAU); ctx.fill(); ctx.restore();
    ctx.restore();
    // front arm + blade
    Rig.limbChain(ctx, [J.sh, J.F.elb, J.F.wr], [4, 3.3, 2.6], LEG);
    const hot = e.tellT > 0 ? (e.tellCol === 'red' ? RED : '#ffffff') : null;
    const tipF = vdBlade(ctx, J.F.wr, J.F.ba, 48, hot);
    e.vTip = (a === VDT.rake && e.st > 0.9) ? tipB : tipF;
    if (e.tellT > 0) glow(ctx, e.vTip.x, e.vTip.y, 26, e.tellCol === 'red' ? RED : '#ffffff', e.tellT);
  }
  function vdBlinkDest(e) {
    const P = e.P;
    const tryX = (s) => {
      const x = P.x + s * 108;
      if (!inArenaOK(e, x)) return null;
      const gy = G.Phys.groundBelow(x, P.y - 60);
      if (gy > P.y + 260 || gy < P.y - 60) return null;
      if (solidAt(x, gy - 60) || solidAt(x, gy - 110)) return null;
      return { x, y: gy };
    };
    return tryX(-P.facing) || tryX(P.facing) || { x: e.x, y: e.y };
  }
  const VDT = reg('c5_voidling', {
    name: '虛空寂裔', en: 'VOIDLING', w: 40, h: 118, hp: 92, bal: 60, col: VOID, shards: 44, kbMul: 1.1, spawnT: 0.8,
    portrait: [2.5, 0.9],
    init(e) { e.seed = seedOf(); e.tail = new Rig.Chain(6, 9, 0.06, 0.88); e.gait = 0; e.vp = null; },
    voice: () => G.SFX.play('c5_voidHiss'),
    weapon: (e) => e.vTip ? { x: e.x + e.facing * e.vTip.x, y: e.y + e.vTip.y } : { x: e.x + e.facing * 70, y: e.y - 80 },
    think(e, dt) {
      e.invuln = false; e.vanished = false;
      e.faceP();
      const d = e.distP();
      if (d > 300) e.vx = U.approach(e.vx, e.facing * 205 * e.speedMul, 1100 * dt);
      else if (d < 95) e.vx = U.approach(e.vx, -e.facing * 140, 1100 * dt);
      else e.vx = U.approach(e.vx, e.facing * 70 * Math.sin(e.t * 1.3 + e.seed), 900 * dt);
      if (e.cd <= 0 && Math.abs(e.P.y - e.y) < 200) {
        if (d < 170) e.startAtk(Math.random() < 0.62 ? VDT.rake : VDT.blink);
        else if (d < 580) e.startAtk(VDT.blink);
      }
    },
    rake: {
      dur: 1.75, cd: 1.3,
      tells: [{ t: 0.2, c: 'white' }, { t: 0.78, c: 'white' }],
      vp: [[0, 'idle'], [0.55, 'rakeW', 'io'], [0.66, 'rakeS', 'snap'], [0.95, 'rakeW2', 'io'], [1.24, 'rakeW2'], [1.32, 'rakeS2', 'snap'], [1.75, 'idle', 'io']],
      moves: [{ t0: 0.6, t1: 0.7, v: 240 }, { t0: 1.24, t1: 1.34, v: 240 }],
      hits: [{ t0: 0.66, t1: 0.76, box: { x: -10, y: -132, w: 120, h: 128 }, dmg: 15 }, { t0: 1.3, t1: 1.4, box: { x: -10, y: -132, w: 120, h: 128 }, dmg: 17, last: true, pbal: 40 }],
      ev: [{ t: 0.64, fn: () => G.SFX.play('slash', 1.05) }, { t: 1.28, fn: () => G.SFX.play('slash', 0.95) }],
    },
    blink: {
      dur: 2.75, cd: 2.0, trackWin: 0.5,
      tells: [{ t: 0.6, c: 'red' }, { t: 1.6, c: 'white' }],
      vp: [[0, 'idle'], [0.35, 'shimmer'], [0.62, 'stabW', 'snap'], [1.15, 'stabW'], [1.23, 'stabS', 'snap'], [1.5, 'stabS'], [1.78, 'rakeW', 'io'], [2.08, 'rakeW'], [2.14, 'rakeS', 'snap'], [2.75, 'idle', 'io']],
      moves: [{ t0: 1.2, t1: 1.32, v: 520 }, { t0: 2.08, t1: 2.16, v: 260 }],
      hits: [
        { t0: 1.22, t1: 1.36, box: { x: 0, y: -100, w: 128, h: 52 }, dmg: 26, red: true, kb: 360 },
        { t0: 2.1, t1: 2.22, box: { x: -10, y: -132, w: 120, h: 128 }, dmg: 18, kb: 260, last: true, pbal: 46 },
      ],
      ev: [
        { t: 0.02, fn: () => G.SFX.play('c5_blink') },
        { t: 0.42, fn: (e) => {
          const from = { x: e.x, y: e.y }, to = vdBlinkDest(e);
          e.blinkFrom = from; e.x = to.x; e.y = to.y; e.vx = 0; e.vy = 0; e.invuln = true; e.vanished = true;
          G.FX.ring(from.x, from.y - 60, 8, 70, 0.35, VOID, 3); G.FX.shards(from.x, from.y - 60, 8, VOID, 260);
        } },
        { t: 0.6, fn: (e) => { e.invuln = false; e.vanished = false; e.faceP(); G.FX.ring(e.x, e.y - 60, 60, 6, 0.25, '#e6dcff', 3); G.FX.flash(e.x, e.y - 60, 60, 0.15, VOID); } },
        { t: 1.22, fn: () => G.SFX.play('slash', 0.75, true) },
        { t: 2.1, fn: () => G.SFX.play('slash', 0.9) },
      ],
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, a = e.state === 'atk' ? e.atk : null;
      let target;
      if (a && a.vp) target = sampK(a.vp, e.st, VDP, VDEF);
      else if (e.state === 'hurt' || e.state === 'recoil') target = Object.assign({}, VDEF, VDP.hurt);
      else if (e.state === 'broken') target = Object.assign({}, VDEF, VDP.broken(e.t));
      else if (Math.abs(e.vx) > 25 && e.onGround) { if (dt > 0) e.gait += Math.abs(e.vx) * dt * 0.062; target = Object.assign({}, VDEF, VDP.walk(e.gait, e.t)); }
      else target = Object.assign({}, VDEF, VDP.idle(e.t));
      if (e.hitK > 0) target = lerpO(target, Object.assign({}, VDEF, VDP.hurt), Math.min(1, e.hitK * 1.1));
      blendTo(e, 'vp', target, dt, e.hitK > 0 ? 40 : a ? 26 : 12);
      const p = e.vp, J = vdJ(p);
      // visibility around the blink: shimmer out, a rift, shimmer in
      let vis = 1, shim = 0;
      if (a === VDT.blink) {
        const st = e.st;
        if (st < 0.42) { shim = st / 0.42; vis = 1 - shim * 0.8; }
        else if (st < 0.6) vis = 0;
        else if (st < 0.82) { shim = 1 - (st - 0.6) / 0.22; vis = 1 - shim * 0.6; }
      }
      const sink = K.emerge(ctx, e) * 120; e._sink = sink;
      const hipW = { x: e.x - e.facing * 8, y: e.y + J.hip.y + 4 + sink };
      if (dt > 0) e.tail.update(hipW.x, hipW.y, e.facing, dt, -e.vx * 4 + Math.sin(e.t * 1.9 + e.seed) * 260, 2.15);
      if (a === VDT.blink && e.st >= 0.3 && e.st < 0.7) {
        // the rift opens where it will step out (already moved at 0.42)
        const k = U.clamp((e.st - 0.3) / 0.3, 0, 1) * (e.st > 0.6 ? 1 - (e.st - 0.6) / 0.1 : 1);
        const rx = e.st >= 0.42 ? e.x : vdBlinkPeek(e), ry = e.y - 62;
        if (rx != null && e.st >= 0.42) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, rx, ry, 70 * k + 10, VOID, 0.55 * k);
          ctx.fillStyle = U.rgba('#efe6ff', 0.9 * k); ctx.beginPath(); ctx.ellipse(rx, ry, 2 + 7 * k, 58 * k + 4, 0, 0, TAU); ctx.fill();
          ctx.restore();
          ctx.fillStyle = U.rgba('#07040f', 0.95 * k); ctx.beginPath(); ctx.ellipse(rx, ry, 1 + 4 * k, 50 * k + 2, 0, 0, TAU); ctx.fill();
        }
      }
      if (vis <= 0.01) return;
      ctx.globalAlpha *= vis;
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing, 1);
      if (shim > 0.02) {
        // sliced, smeared silhouette (a handful of clipped passes)
        for (let i = 0; i < 5; i++) {
          ctx.save(); ctx.beginPath(); ctx.rect(-140, -150 + i * 34, 280, 34); ctx.clip();
          ctx.translate((i % 2 ? 1 : -1) * shim * (10 + 8 * Math.sin(e.t * 37 + i * 2)), 0);
          if (i === 2) ctx.globalAlpha *= 0.85;
          vdBody(ctx, e, J, p, ghost);
          ctx.restore();
        }
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, 20, -70, 70, VOID, 0.35 * shim); ctx.restore();
      } else vdBody(ctx, e, J, p, ghost);
      if (e.state === 'broken' && !ghost && Math.random() < 0.1) G.FX.ember(e.x, e.y - 50, 2, VOID, { w: 40, h: 30, up: 80 });
    },
  });
  // during the shimmer we don't know the destination yet; nothing to show
  function vdBlinkPeek() { return null; }

  /* =====================================================================================
     MENDER 修補者 — a spidery maintenance drone still running its repair protocol.
     tethers to the most damaged ally and pumps it back up (hit it to snap the cable);
     alone it is a coward: weld-jab (white), slag spit (white projectile)
     ===================================================================================== */
  const MDEF = { a1: 1.9, e1: -0.95, tilt: 0, raise: 0, reel: 0 };
  const MDP = {
    idle: (t) => ({ a1: 1.9 + Math.sin(t * 3) * 0.06, e1: -0.95 + Math.sin(t * 2.3) * 0.1, tilt: Math.sin(t * 1.7) * 0.03, raise: 0 }),
    cock: { a1: 2.75, e1: -2.3, tilt: -0.14, raise: 2 },
    jab: { a1: 1.6, e1: 0.0, tilt: 0.12, raise: -2 },
    spitW: { a1: 2.55, e1: 0.15, tilt: -0.2, raise: 3 },
    spitS: { a1: 2.2, e1: 0.25, tilt: -0.05, raise: 1 },
    mend: { a1: 1.4, e1: -1.0, tilt: -0.1, raise: 4, reel: 1 },
    hurt: { a1: 2.4, e1: -1.8, tilt: -0.35, raise: -2 },
    broken: { a1: 1.0, e1: 0.4, tilt: 0.3, raise: -9 },
  };
  function mdAllies(e) {
    return G.game.enemies.filter((o) => o !== e && !o.dead && !o.boss && o.state !== 'spawn' && o.type !== 'c5_mender' && Math.abs(o.x - e.x) < 760 && Math.abs(o.y - e.y) < 400);
  }
  const mdReelW = (e) => ({ x: e.x - e.facing * 13, y: e.y - 48 });
  const MD = reg('c5_mender', {
    name: '縫補者', en: 'MENDER', w: 50, h: 50, hp: 62, bal: 40, col: AMBER, shards: 32, kbMul: 1.3, spawnT: 0.6,
    portrait: [3.8, 0.84],
    init(e) { e.seed = seedOf(); e.gait = 0; e.reelA = 0; e.mendT = null; e.mendOn = false; e.mp = null; },
    voice: () => G.SFX.play('c5_servo'),
    weapon: (e) => e.mTip ? { x: e.x + e.facing * e.mTip.x, y: e.y + e.mTip.y } : { x: e.x + e.facing * 40, y: e.y - 28 },
    think(e, dt) {
      e.mendOn = false;
      const allies = mdAllies(e), P = e.P, d = e.distP();
      e.faceP();
      if (allies.length) {
        // shelter behind the ally nearest to it, on the far side from the player
        const near = allies.reduce((b, o) => (Math.abs(o.x - e.x) < Math.abs(b.x - e.x) ? o : b));
        const side = Math.sign(near.x - P.x) || 1, dx = near.x + side * 135 - e.x;
        e.vx = U.approach(e.vx, Math.abs(dx) > 30 ? Math.sign(dx) * 175 * e.speedMul : 0, 900 * dt);
        const hurtAlly = allies.filter((o) => o.hp < o.maxHp - 2 && Math.abs(o.x - e.x) < 640).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0];
        if (e.cd <= 0) {
          if (d < 100) e.startAtk(MD.jab);
          else if (hurtAlly) { e.mendT = hurtAlly; e.startAtk(MD.mend); }
          else if (d < 520) e.startAtk(MD.spit);
        }
      } else {
        // alone: skitter out of reach and harass
        const want = 330;
        e.vx = U.approach(e.vx, d < want - 60 ? -e.facing * 190 * e.speedMul : d > want + 90 ? e.facing * 140 : 0, 900 * dt);
        if (e.cd <= 0) { if (d < 105) e.startAtk(MD.jab); else if (d < 560) e.startAtk(MD.spit); }
      }
    },
    jab: {
      dur: 1.15, cd: 1.2, tells: [{ t: 0.2, c: 'white' }],
      mk: [[0, 'idle'], [0.55, 'cock', 'io'], [0.66, 'jab', 'snap'], [0.85, 'jab'], [1.15, 'idle', 'io']],
      moves: [{ t0: 0.62, t1: 0.72, v: 300 }],
      hits: [{ t0: 0.66, t1: 0.78, box: { x: 0, y: -48, w: 74, h: 40 }, dmg: 14, kb: 200, last: true, pbal: 30 }],
      ev: [{ t: 0.64, fn: (e) => { G.SFX.play('c5_weld'); } }],
    },
    spit: {
      dur: 1.35, cd: 2.0, track: false, tells: [{ t: 0.3, c: 'white' }],
      mk: [[0, 'idle'], [0.6, 'spitW', 'io'], [0.82, 'spitW'], [0.86, 'spitS', 'snap'], [1.35, 'idle', 'io']],
      ev: [{ t: 0.82, fn: (e) => {
        const tip = MD.weapon(e), P = e.P, ang = Math.atan2(P.y - 62 - tip.y, P.x - tip.x), sp = 380;
        G.game.projectiles.push({ x: tip.x, y: tip.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 9, owner: e, friendly: false, dmg: 14, life: 3.2, t: 0, col: AMBER });
        G.FX.flash(tip.x, tip.y, 40, 0.12, '#ffe2a8'); G.FX.spark(tip.x, tip.y, 6, { col: '#ffd27a', speed: 300, dir: ang, spread: 0.8 }); G.SFX.play('c5_spit');
      } }],
    },
    mend: {
      dur: 3.4, cd: 1.4, track: false,
      mk: [[0, 'idle'], [0.35, 'mend', 'io'], [3.0, 'mend'], [3.4, 'idle', 'io']],
      ev: [{ t: 0.35, fn: (e) => { if (!e.mendT || e.mendT.dead) { e.st = Math.max(e.st, 3.2); return; } e.mendOn = true; G.SFX.play('c5_tether'); G.FX.ring(mdReelW(e).x, mdReelW(e).y, 4, 30, 0.3, AMBER, 2); } }],
    },
    atkUpdate(e, dt) {
      if (e.atk !== MD.mend) return;
      e.vx = U.approach(e.vx, 0, 1200 * dt);
      const o = e.mendT;
      if (!e.mendOn) return;
      if (!o || o.dead || Math.abs(o.x - e.x) > 780 || e.st > 3.05) { e.mendOn = false; if (e.st < 3.0) e.st = 3.0; return; }
      o.hp = Math.min(o.maxHp, o.hp + 16 * dt); o.showBar = Math.max(o.showBar, 0.8);
      if (Math.random() < dt * 9) G.FX.ember(o.x, o.y - o.h * 0.5, 1, '#ffe2a8', { w: o.w, h: o.h * 0.6, up: 90 });
      e.chimeT = (e.chimeT || 0) - dt; if (e.chimeT <= 0) { e.chimeT = 0.7; G.SFX.play('c5_tether'); }
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, a = e.state === 'atk' ? e.atk : null;
      let target;
      if (a && a.mk) target = sampK(a.mk, e.st, MDP, MDEF);
      else if (e.state === 'hurt' || e.state === 'recoil') target = Object.assign({}, MDEF, MDP.hurt);
      else if (e.state === 'broken') target = Object.assign({}, MDEF, MDP.broken);
      else target = Object.assign({}, MDEF, MDP.idle(e.t));
      if (e.hitK > 0) target = lerpO(target, Object.assign({}, MDEF, MDP.hurt), Math.min(1, e.hitK));
      blendTo(e, 'mp', target, dt, a ? 24 : 12);
      const p = e.mp, broken = e.state === 'broken';
      const moving = Math.abs(e.vx) > 20 && e.onGround;
      if (dt > 0) { e.gait += (moving ? Math.abs(e.vx) * 0.09 : 0.6) * dt; e.reelA += dt * (p.reel > 0.5 ? 14 : 0.5); }
      // healing tether (world space)
      if (a === MD.mend && e.mendOn && e.mendT && !e.mendT.dead) {
        const R = mdReelW(e), o = e.mendT, T2 = { x: o.x, y: o.y - o.h * 0.55 };
        const mx = (R.x + T2.x) / 2, my = Math.max(R.y, T2.y) + 26 + Math.sin(e.t * 3) * 4;
        ctx.save(); ctx.lineCap = 'round';
        ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(R.x, R.y); ctx.quadraticCurveTo(mx, my, T2.x, T2.y); ctx.stroke();
        ctx.strokeStyle = '#c6884a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.rgba(AMBER, 0.35); ctx.lineWidth = 7; ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const u = (e.t * 1.4 + i / 4) % 1, x = (1 - u) * (1 - u) * R.x + 2 * (1 - u) * u * mx + u * u * T2.x, y = (1 - u) * (1 - u) * R.y + 2 * (1 - u) * u * my + u * u * T2.y;
          K.glow(ctx, x, y, 9, '#ffe2a8', 0.9); ctx.fillStyle = '#fff4d8'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
        // a clamp ring on the patient, and little crosses rising off it
        ctx.strokeStyle = U.rgba('#ffe2a8', 0.8); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(T2.x, T2.y, 14 + Math.sin(e.t * 8) * 2, 6, 0, 0, TAU); ctx.stroke();
        for (let i = 0; i < 3; i++) { const u = (e.t * 0.7 + i / 3) % 1, x = T2.x + Math.sin(i * 2.4 + e.t) * 18, y = T2.y - 10 - u * 50; ctx.globalAlpha = 1 - u; ctx.fillStyle = '#ffe9b8'; ctx.fillRect(x - 3.5, y - 1, 7, 2); ctx.fillRect(x - 1, y - 3.5, 2, 7); }
        ctx.restore();
      }
      const sink = K.emerge(ctx, e) * 50;
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing, 1);
      const bob = (moving ? Math.abs(Math.sin(e.gait * 2)) * -2 : Math.sin(e.t * 2.6) * 1.2) + p.raise * -1;
      // legs: three pairs, alternating tripods
      const leg = (i, far) => {
        const hx = -13 + i * 13, hy = -20 + bob;
        const ph = e.gait * 2 + (i % 2 ? PI : 0) + (far ? PI : 0);
        const lift = moving ? Math.max(0, Math.sin(ph)) * 7 : 0, sw = moving ? Math.cos(ph) * 7 : 0;
        const fx = (broken ? 1.4 : 1) * (i - 1) * 25 + (far ? -5 : 3) + sw, fy = broken ? 0 : -lift;
        const kx = (hx + fx) / 2 + (fx - hx) * 0.35 + (far ? -2 : 0), ky = Math.min(hy, fy) - 17 + (broken ? 10 : 0);
        Rig.limbChain(ctx, [{ x: hx, y: hy }, { x: kx, y: ky }, { x: fx, y: fy }], [2.8, 2.2, 1.2], far ? '#25233a' : '#3d3c55');
        if (!far) { ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(kx, ky, 1.3, 0, TAU); ctx.fill(); }
      };
      for (let i = 0; i < 3; i++) leg(i, true);
      ctx.save(); ctx.translate(0, bob); ctx.rotate(p.tilt + (broken ? 0.2 : 0));
      // back claw
      Rig.limbChain(ctx, [{ x: 6, y: -18 }, { x: 14, y: -12 }, { x: 22, y: -13 }], [2.2, 1.8, 1.4], '#2c2a40');
      // cable reel on the back
      const R0 = { x: -13, y: -46 };
      ctx.beginPath(); ctx.arc(R0.x, R0.y, 9, 0, TAU); ctx.fillStyle = '#3a3346'; ctx.fill(); ink(ctx, 1.4);
      ctx.strokeStyle = '#b07a43'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(R0.x, R0.y, 6.2, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 0.6; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(R0.x, R0.y, 4.8 + k * 0.9, k, k + 2); ctx.stroke(); }
      ctx.save(); ctx.translate(R0.x, R0.y); ctx.rotate(e.reelA); ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4.4, 0); ctx.stroke(); }
      ctx.fillStyle = '#e9e3d6'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, TAU); ctx.fill(); ink(ctx, 0.8); ctx.restore();
      // shell
      const shell = () => { ctx.beginPath(); ctx.moveTo(-25, -19); ctx.bezierCurveTo(-28, -40, -9, -52, 5, -50); ctx.bezierCurveTo(20, -48, 27, -36, 26, -24); ctx.lineTo(22, -17); ctx.lineTo(-21, -15); ctx.closePath(); };
      shell(); cel(ctx, 0, -34, 18, '#ece5d6'); ink(ctx, 1.7);
      ctx.save(); shell(); ctx.clip();
      ctx.fillStyle = '#ff9a3c'; ctx.fillRect(-30, -25, 60, 8);
      ctx.fillStyle = '#17121c'; for (let x = -30; x < 30; x += 7) { ctx.beginPath(); ctx.moveTo(x, -17); ctx.lineTo(x + 4, -25); ctx.lineTo(x + 7, -25); ctx.lineTo(x + 3, -17); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = 'rgba(42,14,60,0.35)'; ctx.fillRect(-30, -20, 60, 6);
      ctx.restore();
      ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-4, -50); ctx.quadraticCurveTo(-10, -38, -8, -25); ctx.stroke();
      ctx.fillStyle = INK; for (const [x, y] of [[-15, -38], [-19, -30], [6, -44]]) { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, TAU); ctx.fill(); }
      // visor + lamp-eyes
      poly(ctx, [[8, -37], [24, -33], [25.5, -26], [10, -25]]); ctx.fillStyle = '#15121c'; ctx.fill(); ink(ctx, 1.2);
      const fear = a === MD.jab || a === MD.spit ? 1 : 0;
      for (const [x, y, r] of [[18, -31.5, 2], [22, -29.2, 1.6], [14, -28.2, 1.4]]) {
        glow(ctx, x, y, 7 + fear * 3, AMBER, broken ? (Math.sin(e.t * 19 + x) > 0 ? 0.8 : 0.2) : 0.8);
        ctx.fillStyle = '#fff1c8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
      // weld arm
      const sh = { x: 15, y: -24 }, el = addP(sh, dirv(p.a1, 22)), wr = addP(el, dirv(p.a1 + p.e1, 22)), tip = addP(wr, dirv(p.a1 + p.e1, 14));
      Rig.limbChain(ctx, [sh, el, wr], [3.4, 2.9, 2.6], '#4a4860', { spec: 0.2 });
      Rig.limb(ctx, wr, tip, 3, 1.8, '#8c8a9e');
      ctx.fillStyle = '#c98a3a'; ctx.beginPath(); ctx.arc(wr.x, wr.y, 2.4, 0, TAU); ctx.fill(); ink(ctx, 0.9);
      e.mTip = { x: tip.x * 1 + 0, y: tip.y + bob };
      // the torch: a blue-white welding flame (bigger when it means it)
      const hotK = a === MD.jab ? (e.st > 0.5 && e.st < 0.9 ? 1 : 0.5) : a === MD.spit ? U.clamp(e.st / 0.8, 0, 1) : 0.25;
      const fl = 5 + hotK * 9 + Math.sin(e.t * 53) * 1.5, ang = Math.atan2(tip.y - wr.y, tip.x - wr.x);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(tip.x, tip.y); ctx.rotate(ang);
      K.glow(ctx, 0, 0, 10 + hotK * 16, a === MD.spit ? AMBER : '#9fd8ff', 0.6);
      ctx.fillStyle = 'rgba(160,215,255,0.8)'; ctx.beginPath(); ctx.moveTo(0, -2.6); ctx.lineTo(fl, 0); ctx.lineTo(0, 2.6); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, -1.2); ctx.lineTo(fl * 0.55, 0); ctx.lineTo(0, 1.2); ctx.fill();
      if (a === MD.spit && e.st < 0.85) { const r = 2 + hotK * 6; K.glow(ctx, 2, 0, r * 3, AMBER, 0.8); ctx.fillStyle = '#fff1c8'; ctx.beginPath(); ctx.arc(2, 0, r, 0, TAU); ctx.fill(); }
      ctx.restore();
      if (!ghost && hotK >= 1 && Math.random() < 0.5) G.FX.spark(e.x + e.facing * tip.x, e.y + tip.y + bob, 2, { col: '#ffe2a8', speed: 260 });
      if (e.tellT > 0) glow(ctx, tip.x, tip.y, 22, '#ffffff', e.tellT);
      ctx.restore();
      for (let i = 0; i < 3; i++) leg(i, false);
    },
  });

  /* =====================================================================================
     BREACHER 破門者 — a boarding hardsuit welded to its mag-boots; the one thing on the Spire
     that never floats. red: magnet pull → white haymaker · white: stomp + floor shockwaves
     ===================================================================================== */
  const BDEF = { hy: -66, lean: 0.06, head: 0, aF: 0.35, eF: 0.55, aB: -0.12, eB: 0.45, fFx: 16, fFy: 0, fBx: -18, fBy: 0, mag: 0 };
  const BDP = {
    idle: (t) => ({ hy: -66 + Math.sin(t * 1.6) * 1.3, lean: 0.06 + Math.sin(t * 1.6) * 0.015, aF: 0.35 + Math.sin(t * 1.6) * 0.03, eF: 0.55, aB: -0.12, eB: 0.45 }),
    walk: (p) => ({ hy: -66 - Math.abs(Math.sin(p)) * 2.5, lean: 0.13, aF: 0.35 - Math.cos(p) * 0.2, eF: 0.6, aB: -0.1 + Math.cos(p) * 0.2, eB: 0.5, fFx: 16 + Math.cos(p) * 15, fFy: -Math.max(0, Math.sin(p)) * 13, fBx: -16 - Math.cos(p) * 15, fBy: -Math.max(0, -Math.sin(p)) * 13 }),
    stompUp: { hy: -63, lean: -0.13, aF: 1.55, eF: -0.55, aB: -1.05, eB: 0.6, fFx: 28, fFy: -42, fBx: -16, fBy: 0, head: -0.2 },
    stompDown: { hy: -52, lean: 0.28, aF: 0.45, eF: 0.4, aB: 0.25, eB: 0.4, fFx: 34, fFy: 0, fBx: -22, fBy: 0, head: 0.2 },
    pullAim: { hy: -60, lean: -0.06, aF: 1.52, eF: 0.04, aB: -0.45, eB: 0.6, fFx: 28, fBx: -30, mag: 1 },
    pullReel: { hy: -60, lean: -0.16, aF: 0.85, eF: -1.5, aB: -0.6, eB: 0.8, fFx: 26, fBx: -32, mag: 1 },
    hayW: { hy: -62, lean: -0.14, aF: -0.55, eF: -1.4, aB: 0.85, eB: 0.4, fFx: 24, fBx: -30, mag: 0.5 },
    hayS: { hy: -56, lean: 0.36, aF: 1.55, eF: 0.0, aB: -0.65, eB: 0.7, fFx: 38, fBx: -24, head: 0.1 },
    vent: { hy: -52, lean: 0.42, aF: 0.2, eF: 0.3, aB: 0.1, eB: 0.3, fFx: 20, fBx: -22, head: 0.45 },
    hurt: { hy: -64, lean: -0.24, aF: -0.2, eF: 0.9, aB: -0.6, eB: 0.6, head: -0.3 },
    broken: (t) => ({ hy: -46 + Math.sin(t * 2) * 1.2, lean: 0.62, head: 0.55, aF: 0.05, eF: 0.2, aB: 0.05, eB: 0.2, fFx: 22, fBx: -26 }),
  };
  function brJ(p) {
    const hip = { x: 0, y: p.hy };
    const legJ = (fx, fy) => { const ank = { x: fx, y: fy - 12 }, s = Rig.solve2(hip, ank, 30, 31, 1), knee = addP(hip, dirv(s.a, 30)); return { knee, ank: addP(knee, dirv(s.a + s.b, 31)), foot: { x: fx, y: fy } }; };
    const u = { x: Math.sin(p.lean), y: -Math.cos(p.lean) }, n = { x: Math.cos(p.lean), y: Math.sin(p.lean) };
    const Q = (s, f) => ({ x: hip.x + u.x * s * 44 + n.x * f, y: hip.y + u.y * s * 44 + n.y * f });
    const sF = Q(1.08, 16), sB = Q(1.1, -8);
    const elF = addP(sF, dirv(p.aF, 24)), hdF = addP(elF, dirv(p.aF + p.eF, 26));
    const elB = addP(sB, dirv(p.aB, 24)), hdB = addP(elB, dirv(p.aB + p.eB, 24));
    return { hip, Q, u, n, sF, sB, elF, hdF, elB, hdB, LF: legJ(p.fFx, p.fFy), LB: legJ(p.fBx, p.fBy) };
  }
  function brBoot(ctx, L, col, clamp, t) {
    const a = L.ank, f = L.foot;
    poly(ctx, [[a.x - 13, f.y - 14], [a.x + 6, f.y - 16], [a.x + 21, f.y - 7], [a.x + 22, f.y], [a.x - 15, f.y]]); cel(ctx, a.x, f.y - 8, 12, col); ink(ctx, 1.5);
    ctx.fillStyle = '#2a2c3a'; ctx.fillRect(a.x - 15, f.y - 3.5, 37, 3.5); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(a.x - 15, f.y - 3.5, 37, 3.5);
    if (clamp > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(MAG, 0.55 + 0.35 * Math.sin(t * 7)); ctx.fillRect(a.x - 12, f.y - 2.2, 31, 1.6); K.glow(ctx, a.x + 3, f.y, 22, MAG, 0.35 * clamp); ctx.restore(); }
    ctx.fillStyle = '#e5c23a'; poly(ctx, [[a.x + 6, f.y - 16], [a.x + 11, f.y - 13], [a.x + 4, f.y - 10]]); ctx.fill();
  }
  function brArm(ctx, s, el, hd, front, p, e) {
    Rig.limb(ctx, s, el, front ? 9 : 8, 8, front ? '#c9cfdd' : '#8f95ab');
    // gauntlet: a fat steel forearm with copper coils
    const dx = hd.x - el.x, dy = hd.y - el.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    Rig.limb(ctx, el, hd, 9.5, 12.5, front ? '#6f7891' : '#4c5268', { spec: front ? 0.3 : 0 });
    ctx.strokeStyle = '#c98a3a'; ctx.lineWidth = 2.4;
    for (const k of [0.3, 0.55]) { const c = { x: el.x + dx * k, y: el.y + dy * k }, w = 10 + k * 2.6; ctx.beginPath(); ctx.moveTo(c.x + nx * w, c.y + ny * w); ctx.lineTo(c.x - nx * w, c.y - ny * w); ctx.stroke(); }
    if (front) {
      // horseshoe magnet on the fist — prongs forward
      const b = { x: hd.x + ux * 3, y: hd.y + uy * 3 };
      const prong = (sgn) => { const o = { x: b.x + nx * sgn * 7, y: b.y + ny * sgn * 7 }, tip = { x: o.x + ux * 13, y: o.y + uy * 13 }; Rig.limb(ctx, o, tip, 3.6, 3.6, '#c23a4a', { noHatch: true }); const ti = { x: o.x + ux * 10, y: o.y + uy * 10 }; Rig.limb(ctx, ti, tip, 3.6, 3.6, '#e8eaf2', { noHatch: true }); return tip; };
      ctx.beginPath(); ctx.arc(b.x, b.y, 7.8, Math.atan2(ny, nx), Math.atan2(ny, nx) + PI, false); ctx.strokeStyle = INK; ctx.lineWidth = 9.6; ctx.stroke(); ctx.strokeStyle = '#c23a4a'; ctx.lineWidth = 6.4; ctx.stroke();
      const t1 = prong(1), t2 = prong(-1);
      const m = (t1 && t2) ? { x: (t1.x + t2.x) / 2, y: (t1.y + t2.y) / 2 } : b;
      e.bFist = m;
      if (p.mag > 0.02) {
        const red = e.tellT > 0 && e.tellCol === 'red';
        glow(ctx, m.x, m.y, 18 + p.mag * 22, red ? RED : MAG, 0.35 + p.mag * 0.5);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(red ? '#ffc2d0' : '#bfe2ff', 0.8); ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) { const r = 6 + ((e.t * 40 + i * 7) % 20); ctx.globalAlpha = 1 - r / 26; ctx.beginPath(); ctx.arc(m.x, m.y, r, Math.atan2(uy, ux) - 0.8, Math.atan2(uy, ux) + 0.8); ctx.stroke(); }
        ctx.restore();
      }
    } else {
      ctx.beginPath(); ctx.arc(hd.x + ux * 4, hd.y + uy * 4, 8.5, 0, TAU); cel(ctx, hd.x, hd.y, 8, '#4c5268'); ink(ctx, 1.3);
    }
  }
  function brWave(e, x, y, dir) {
    G.game.hazards.push({
      t: 0, life: 1.0, x, y, dir, owner: e, hit: false,
      update(h, dt, g) {
        h.x += h.dir * 560 * dt;
        if (solidAt(h.x + h.dir * 12, h.y - 12) || G.Phys.groundBelow(h.x, h.y - 20) > h.y + 8) { h.done = true; return; }
        const P = g.player;
        if (!h.hit && Math.abs(P.x - h.x) < 24 && P.y > h.y - 38 && P.y <= h.y + 6) {
          h.hit = true;
          const r = P.receiveHit(h.owner, { dmg: 16, kb: 260, hx: h.x, hy: h.y - 24, waveFrom: h.x - h.dir * 30 });
          const o = h.owner;
          if (r === 'parried' && o && !o.dead) { o.bal = Math.min(o.maxBal, o.bal + 28); o.balT = 0; o.showBar = 3; if (o.bal >= o.maxBal && o.state !== 'broken') o.breakBalance(); }
        }
        if (Math.random() < dt * 30) G.FX.spark(h.x, h.y - 4, 1, { col: '#bfe2ff', speed: 260, dir: -PI / 2 - h.dir * 0.4, spread: 0.8 });
        if (Math.random() < dt * 14) G.FX.dust(h.x, h.y, 1, { w: 10, speed: 60, size: 8, col: 'rgba(170,190,230,' });
      },
      draw(ctx, h) {
        const k = h.t / h.life, al = 1 - k * k, d = h.dir;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, h.x, h.y - 12, 46, MAG, 0.45 * al);
        ctx.fillStyle = U.rgba('#9fd0ff', 0.75 * al);
        ctx.beginPath(); ctx.moveTo(h.x - d * 34, h.y); ctx.quadraticCurveTo(h.x - d * 8, h.y - 44, h.x + d * 10, h.y - 34); ctx.quadraticCurveTo(h.x + d * 3, h.y - 14, h.x + d * 18, h.y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = U.rgba('#ffffff', 0.9 * al);
        ctx.beginPath(); ctx.moveTo(h.x - d * 20, h.y); ctx.quadraticCurveTo(h.x - d * 4, h.y - 30, h.x + d * 8, h.y - 28); ctx.quadraticCurveTo(h.x + d * 2, h.y - 12, h.x + d * 10, h.y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = U.rgba('#bfe2ff', 0.6 * al); ctx.lineWidth = 1.5;
        for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(h.x - d * (28 + i * 14), h.y); ctx.quadraticCurveTo(h.x - d * (16 + i * 14), h.y - 26 + i * 6, h.x - d * (6 + i * 14), h.y - 18 + i * 5); ctx.stroke(); }
      },
    });
  }
  function brVent(e) {
    e.atk = BR.vent; e.setState('atk'); e.hitsDone = {}; e.tellsDone = {}; e.evDone = {}; e.pullOn = false;
  }
  const BR = reg('c5_breacher', {
    name: '壓艙者', en: 'THE BALLAST', w: 64, h: 150, hp: 165, bal: 110, col: MAG, shards: 60, poise: true, kbMul: 0.45, spawnT: 1.0,
    portrait: [1.9, 0.92],
    init(e) { e.seed = seedOf(); e.gait = 0; e.bp = null; e.pulled = false; e.pullOn = false; },
    voice: () => G.SFX.play('c5_brVoice'),
    weapon: (e) => e.bFist ? { x: e.x + e.facing * e.bFist.x, y: e.y + e.bFist.y } : { x: e.x + e.facing * 60, y: e.y - 95 },
    think(e, dt) {
      e.pullOn = false;
      e.faceP();
      const d = e.distP();
      e.vx = U.approach(e.vx, d > 140 ? e.facing * 86 * e.speedMul : d < 60 ? -e.facing * 60 : 0, 700 * dt);
      if (e.cd <= 0 && Math.abs(e.P.y - e.y) < 140) {
        if (d < 165) e.startAtk(BR.stomp);
        else if (d < 460) e.startAtk(Math.random() < 0.65 ? BR.pull : BR.stomp);
      }
    },
    stomp: {
      dur: 1.75, cd: 1.6, tells: [{ t: 0.2, c: 'white' }],
      bk: [[0, 'idle'], [0.68, 'stompUp', 'io'], [0.8, 'stompUp'], [0.86, 'stompDown', 'snap'], [1.3, 'stompDown'], [1.75, 'idle', 'io']],
      hits: [{ t0: 0.85, t1: 0.96, box: { x: -40, y: -62, w: 150, h: 64 }, dmg: 20, kb: 300, last: true, pbal: 44 }],
      ev: [{ t: 0.85, fn: (e) => {
        const fx = e.x + e.facing * 34;
        G.game.shake(0.55); G.SFX.play('quake'); G.SFX.play('c5_clank');
        G.FX.ring(fx, e.y, 10, 150, 0.45, MAG, 5, { flat: 0.18 }); G.FX.dust(fx, e.y, 22, { w: 90, speed: 300, size: 15, col: 'rgba(170,190,230,' });
        G.FX.spark(fx, e.y - 4, 16, { col: '#bfe2ff', speed: 520, dir: -PI / 2, spread: 2.4 });
        brWave(e, fx + 30, e.y, 1); brWave(e, fx - 30, e.y, -1);
      } }],
    },
    pull: {
      dur: 2.45, cd: 1.7, track: false,
      tells: [{ t: 0.18, c: 'red' }, { t: 1.25, c: 'white' }],
      bk: [[0, 'idle'], [0.7, 'pullAim', 'io'], [1.02, 'pullAim'], [1.3, 'pullReel', 'io'], [1.6, 'hayW', 'io'], [1.72, 'hayS', 'snap'], [2.05, 'hayS'], [2.45, 'idle', 'io']],
      moves: [{ t0: 1.66, t1: 1.76, v: 220 }],
      hits: [{ t0: 1.72, t1: 1.84, box: { x: 0, y: -140, w: 98, h: 96 }, dmg: 26, kb: 340, last: true, pbal: 60 }],
      ev: [{ t: 0.05, fn: () => G.SFX.play('c5_magHum') }, { t: 0.8, fn: (e) => { e.pullOn = true; e.pulled = false; G.SFX.play('c5_pulse'); } }, { t: 1.7, fn: () => G.SFX.play('whoosh', 0.7) }],
    },
    vent: {
      dur: 1.25, cd: 1.0, track: false,
      bk: [[0, 'pullAim'], [0.3, 'vent', 'io'], [0.95, 'vent'], [1.25, 'idle', 'io']],
      ev: [{ t: 0.05, fn: () => G.SFX.play('c5_vent') }],
    },
    atkUpdate(e, dt) {
      const a = e.atk, P = e.P;
      e.dbgBox = null;
      if (a === BR.pull) {
        e.vx = U.approach(e.vx, 0, 2000 * dt);
        if (e.st >= 0.8 && e.st < 1.02 && e.pullOn && !e.pulled) {
          const box = e.boxW({ x: 24, y: -140, w: 450, h: 130 }); e.dbgBox = box;
          if (U.rectsOverlap(box, P.hurtbox)) {
            const r = P.receiveHit(e, { dmg: 14, unblockable: true, kb: 30, hx: P.x, hy: P.y - 60 });
            if (r === 'hit') { e.pulled = true; G.SFX.play('c5_clamp'); G.FX.ring(P.x, P.y - 60, 30, 6, 0.25, MAG, 3); }
          }
        }
        if (e.st >= 1.02 && !e.pulled) { brVent(e); return; }
        if (e.pulled && e.st < 1.66 && P.state !== 'dodge' && P.state !== 'dead') {
          const tx = e.x + e.facing * 74, dx = tx - P.x;
          if (Math.abs(dx) > 4) { nudgeP(P, Math.sign(dx) * Math.min(Math.abs(dx), 760 * dt)); P.vx = 0; }
        }
      } else if (a === BR.vent) {
        if (Math.random() < dt * 22) { const b = e.bPack || { x: -34, y: -120 }; G.FX.dust(e.x + e.facing * b.x, e.y + b.y, 1, { w: 8, speed: 120, size: 13, dir: -PI / 2 - e.facing * 0.5, spread: 0.6, col: 'rgba(225,232,245,' }); }
      }
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, a = e.state === 'atk' ? e.atk : null;
      let target;
      const moving = Math.abs(e.vx) > 20 && e.onGround && !a;
      if (a && a.bk) target = sampK(a.bk, e.st, BDP, BDEF);
      else if (e.state === 'hurt' || e.state === 'recoil') target = Object.assign({}, BDEF, BDP.hurt);
      else if (e.state === 'broken') target = Object.assign({}, BDEF, BDP.broken(e.t));
      else if (moving) {
        const prev = Math.floor(e.gait / PI);
        if (dt > 0) e.gait += Math.abs(e.vx) * dt * 0.045;
        if (Math.floor(e.gait / PI) !== prev && Math.abs(e.x - e.P.x) < 900) { G.SFX.play('c5_clank'); G.FX.dust(e.x, e.y, 3, { w: 40, speed: 60, size: 9 }); }
        target = Object.assign({}, BDEF, BDP.walk(e.gait));
      } else target = Object.assign({}, BDEF, BDP.idle(e.t));
      if (e.hitK > 0) target = lerpO(target, Object.assign({}, BDEF, BDP.hurt), Math.min(1, e.hitK * 0.7));
      blendTo(e, 'bp', target, dt, a ? 22 : 10);
      const p = e.bp, J = brJ(p), Q = J.Q;
      const pulling = a === BR.pull && e.pullOn && e.st >= 0.8 && e.st < 1.66;
      // magnetic field (world space): crimson while it can still catch you, blue once it has you
      if (pulling && e.bFist) {
        const F = { x: e.x + e.facing * e.bFist.x, y: e.y + e.bFist.y };
        const P = e.P, reach = e.pulled ? Math.abs(P.x - F.x) : 470 * U.clamp((e.st - 0.78) / 0.12, 0, 1);
        const col = e.pulled ? MAG : RED;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(F.x, 0, F.x + e.facing * reach, 0);
        g.addColorStop(0, U.rgba(col, 0.5)); g.addColorStop(1, U.rgba(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(F.x, F.y - 8); ctx.lineTo(F.x + e.facing * reach, F.y - 55); ctx.lineTo(F.x + e.facing * reach, F.y + 50); ctx.lineTo(F.x, F.y + 8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = U.rgba(e.pulled ? '#bfe2ff' : '#ffc2d0', 0.8); ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const u = 1 - ((e.t * 2.2 + i / 6) % 1), x = F.x + e.facing * reach * u, hh = 8 + 46 * u;
          ctx.globalAlpha = 0.25 + 0.75 * (1 - u); ctx.beginPath(); ctx.moveTo(x + e.facing * 6, F.y - hh); ctx.quadraticCurveTo(x - e.facing * 10, F.y, x + e.facing * 6, F.y + hh); ctx.stroke();
        }
        ctx.restore();
      }
      const sink = K.emerge(ctx, e) * 160;
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing, 1);
      const clamp = e.state === 'broken' ? 0 : 1;
      const SUIT = '#d3d8e4', STEEL = '#7d8598';
      // back leg + boot
      Rig.limbChain(ctx, [J.hip, J.LB.knee, J.LB.ank], [10, 9, 8], '#7a8096');
      brBoot(ctx, J.LB, '#5c6277', clamp, e.t);
      // backpack (tank + coil + exhaust)
      const bp0 = Q(0.18, -24), bp1 = Q(1.28, -24), back = { x: -J.n.x * 20, y: -J.n.y * 20 };
      const tank = [bp0, bp1, addP(bp1, back), addP(bp0, back)];
      blobP(ctx, [bp0, lerpP(bp0, bp1, 0.5), bp1, addP(bp1, { x: back.x * 0.9, y: back.y * 0.9 - 4 }), addP(lerpP(bp0, bp1, 0.5), { x: back.x * 1.15, y: back.y * 1.15 }), addP(bp0, back)]);
      celN(ctx, (bp0.x + bp1.x) / 2 + back.x / 2, (bp0.y + bp1.y) / 2 + back.y / 2, -J.n.x, -J.n.y, 14, '#5d6479'); ink(ctx, 1.6);
      void tank;
      const coil = Q(0.7, -36);
      ctx.beginPath(); ctx.ellipse(coil.x, coil.y, 5, 12, p.lean, 0, TAU); ctx.fillStyle = '#20232f'; ctx.fill(); ink(ctx, 1.2);
      glow(ctx, coil.x, coil.y, 16, MAG, 0.4 + p.mag * 0.4);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba('#bfe2ff', 0.8); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(coil.x, coil.y, 3, 9, p.lean, 0, TAU); ctx.stroke(); ctx.restore();
      const ex = Q(1.36, -34);
      Rig.limb(ctx, Q(1.18, -34), ex, 3.4, 3.8, '#3c4154', { noHatch: true });
      e.bPack = { x: ex.x, y: ex.y - 4 };
      // hose from the pack to the gauntlet
      ctx.beginPath(); const h0 = Q(0.45, -30); ctx.moveTo(h0.x, h0.y); ctx.bezierCurveTo(h0.x + 6, h0.y + 40, J.elF.x - 10, J.elF.y + 30, J.elF.x, J.elF.y + 4);
      ctx.strokeStyle = INK; ctx.lineWidth = 6.4; ctx.stroke(); ctx.strokeStyle = '#2f3343'; ctx.lineWidth = 3.8; ctx.stroke();
      // back arm
      brArm(ctx, J.sB, J.elB, J.hdB, false, p, e);
      // barrel torso
      const tp = [Q(-0.12, -18), Q(0.45, -29), Q(1.0, -29), Q(1.34, -18), Q(1.42, 2), Q(1.3, 22), Q(0.9, 30), Q(0.42, 28), Q(-0.05, 20), Q(-0.2, 0)];
      blobP(ctx, tp); celN(ctx, Q(0.6, 0).x, Q(0.6, 0).y, J.n.x, J.n.y, 30, SUIT); ink(ctx, 2);
      ctx.save(); blobP(ctx, tp); ctx.clip();
      // hazard band around the belly
      const b0 = Q(0.18, -40), b1 = Q(0.18, 40), b2 = Q(0.38, 40), b3 = Q(0.38, -40);
      polyP(ctx, [b0, b1, b2, b3]); ctx.fillStyle = '#e5c23a'; ctx.fill();
      ctx.fillStyle = '#17121c';
      for (let k = -40; k < 40; k += 9) { polyP(ctx, [Q(0.18, k), Q(0.18, k + 4), Q(0.38, k + 9), Q(0.38, k + 5)]); ctx.fill(); }
      ctx.fillStyle = 'rgba(42,14,60,0.28)'; polyP(ctx, [Q(-0.3, -40), Q(-0.3, -10), Q(1.5, -10), Q(1.5, -40)]); ctx.fill();
      ctx.restore();
      polyP(ctx, [Q(0.18, -30), Q(0.18, 31), Q(0.38, 31), Q(0.38, -30)]); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      // chest plate + reactor vent
      const cp = [Q(0.55, 2), Q(1.12, 4), Q(1.2, 22), Q(0.95, 27), Q(0.6, 24)];
      blobP(ctx, cp); celN(ctx, Q(0.85, 16).x, Q(0.85, 16).y, J.n.x, J.n.y, 12, STEEL); ink(ctx, 1.4);
      const core = Q(0.82, 16), ventOn = a === BR.vent ? 0.3 : 1;
      glow(ctx, core.x, core.y, 20, MAG, 0.55 * ventOn + p.mag * 0.3);
      ctx.beginPath(); ctx.arc(core.x, core.y, 6.5, 0, TAU); ctx.fillStyle = '#10131f'; ctx.fill(); ink(ctx, 1.2);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba('#bfe2ff', 0.9 * ventOn); ctx.lineWidth = 1.2;
      for (const k of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(core.x - 4, core.y + k); ctx.lineTo(core.x + 4, core.y + k); ctx.stroke(); } ctx.restore();
      ctx.fillStyle = INK; for (const q of [Q(0.62, 5), Q(1.08, 6), Q(1.12, 20), Q(0.66, 22)]) { ctx.beginPath(); ctx.arc(q.x, q.y, 1.1, 0, TAU); ctx.fill(); }
      hatch(ctx, Q(0.1, -22).x, Q(0.1, -22).y, Q(1.0, -26).x, Q(1.0, -26).y, 7, 5);
      // helmet sunk between the shoulders
      const H = Q(1.42, 9), ha = p.lean * 0.6 + p.head;
      ctx.save(); ctx.translate(H.x, H.y); ctx.rotate(ha);
      ctx.beginPath(); ctx.arc(0, 0, 15, PI * 0.95, PI * 2.12); ctx.closePath(); cel(ctx, 0, -4, 15, '#e3e7ef'); ink(ctx, 1.7);
      ctx.beginPath(); ctx.moveTo(-2, -7); ctx.quadraticCurveTo(9, -9, 14.6, -3); ctx.lineTo(14.2, 2); ctx.quadraticCurveTo(7, 0, -1, 1); ctx.closePath(); ctx.fillStyle = '#0f1220'; ctx.fill(); ink(ctx, 1.2);
      const vr = e.tellT > 0 && e.tellCol === 'red';
      glow(ctx, 8, -3, 16, vr ? RED : MAG, e.state === 'broken' ? 0.2 : 0.7);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = vr ? '#ffd0dc' : '#d6ecff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(1, -2.5); ctx.quadraticCurveTo(8, -4.5, 13.5, -1.5); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(0, 0, 10, PI * 1.15, PI * 1.5); ctx.stroke();
      ctx.restore();
      // collar ring
      const c0 = Q(1.3, -16), c1 = Q(1.3, 22);
      Rig.limb(ctx, c0, c1, 4.6, 4.6, '#9aa1b6', { noHatch: true });
      // front leg + boot (thigh plate)
      Rig.limbChain(ctx, [J.hip, J.LF.knee, J.LF.ank], [11, 9.5, 8.5], '#b9bfcf', { spec: 0.2 });
      ctx.beginPath(); ctx.ellipse(J.LF.knee.x + 3, J.LF.knee.y, 7, 6, 0, 0, TAU); cel(ctx, J.LF.knee.x, J.LF.knee.y, 7, STEEL); ink(ctx, 1.3);
      brBoot(ctx, J.LF, '#6a7086', clamp, e.t);
      // pauldron + front arm + magnet
      brArm(ctx, J.sF, J.elF, J.hdF, true, p, e);
      const pd = J.sF;
      ctx.beginPath(); ctx.ellipse(pd.x - 1, pd.y - 2, 16, 12, p.lean - 0.25, 0, TAU); cel(ctx, pd.x, pd.y - 3, 15, '#dfe3ec'); ink(ctx, 1.6);
      ctx.save(); ctx.beginPath(); ctx.ellipse(pd.x - 1, pd.y - 2, 16, 12, p.lean - 0.25, 0, TAU); ctx.clip();
      ctx.fillStyle = '#e5c23a'; ctx.fillRect(pd.x - 18, pd.y + 3, 36, 5); ctx.fillStyle = '#17121c'; for (let k = -18; k < 18; k += 7) { poly(ctx, [[pd.x + k, pd.y + 8], [pd.x + k + 3, pd.y + 3], [pd.x + k + 6, pd.y + 3], [pd.x + k + 3, pd.y + 8]]); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = INK; for (const [ox, oy] of [[-8, -6], [6, -8]]) { ctx.beginPath(); ctx.arc(pd.x + ox, pd.y + oy, 1.1, 0, TAU); ctx.fill(); }
      if (e.tellT > 0 && e.bFist) glow(ctx, e.bFist.x, e.bFist.y, 30, e.tellCol === 'red' ? RED : '#ffffff', e.tellT);
      if (e.state === 'broken' && !ghost && Math.random() < 0.15) G.FX.dust(e.x - e.facing * 30, e.y - 120, 1, { w: 8, speed: 80, size: 12, col: 'rgba(225,232,245,' });
    },
  });

  /* =====================================================================================
     ELITE — VELA, THE LONGSHOT 長射手・薇拉 (Descent V sniper)
     longshot (red line) · triple volley (white) · held-breath delayed shot (white, feint) ·
     gravity mine (red ring) · stock + bayonet (white, white) · grapple escape · P2: crossfire (3 × red)
     ===================================================================================== */
  const VEDEF = Object.assign({}, Rig.DEF, { ra: -1.0, qx: 10, qy: 24, fg: 1, bg: 1, aim: 0, bay: 0, sw: 1.1 });
  const VEP = {
    idle: (t) => ({ ry: Math.sin(t * 1.8) * 1.2, torso: 0.04, head: 0.04, tF: 0.26, kF: -0.3, tB: -0.24, kB: -0.16, ra: -1.0 + Math.sin(t * 1.8) * 0.03, qx: 10, qy: 24 }),
    aim: { ry: 1, torso: -0.06, head: 0.26, tF: 0.44, kF: -0.32, tB: -0.42, kB: -0.08, ra: 0, qx: 3, qy: 3, aim: 1 },
    kick: { ry: 1, torso: -0.2, head: 0.12, tF: 0.44, kF: -0.32, tB: -0.42, kB: -0.08, ra: -0.5, qx: -5, qy: 1, aim: 0.7 },
    kneel: { ry: 22, torso: 0.12, head: 0.28, tF: 1.25, kF: -1.5, tB: 0.12, kB: -1.55, ra: 0, qx: 3, qy: 3, aim: 1 },
    recoil: { ry: 22, torso: -0.24, head: 0.0, tF: 1.25, kF: -1.5, tB: 0.12, kB: -1.55, ra: -0.7, qx: -7, qy: 2, aim: 0.5 },
    exhale: { ry: 3, torso: 0.1, head: 0.0, tF: 0.44, kF: -0.32, tB: -0.42, kB: -0.08, ra: 0.45, qx: 7, qy: 11, aim: 0.5 },
    buttW: { ry: 2, torso: -0.24, head: 0.1, tF: 0.45, kF: -0.4, tB: -0.5, kB: -0.1, ra: PI - 0.9, qx: -10, qy: 14 },
    buttS: { ry: 6, torso: 0.34, head: 0.15, tF: 0.88, kF: -0.7, tB: -0.62, kB: -0.1, ra: PI + 0.4, qx: 20, qy: -2 },
    thrustW: { ry: 4, torso: -0.06, head: 0.15, tF: 0.4, kF: -0.5, tB: -0.6, kB: -0.15, ra: 0.02, qx: -14, qy: 6, bay: 1 },
    thrust: { ry: 10, torso: 0.48, head: 0.12, tF: 1.0, kF: -0.75, tB: -0.8, kB: -0.05, ra: 0.0, qx: 18, qy: 6, bay: 1 },
    crouch: { ry: 14, torso: 0.3, head: 0.1, tF: 0.8, kF: -1.2, tB: -0.2, kB: -1.0, ra: -0.6, qx: 8, qy: 18 },
    air: { ry: -4, torso: -0.3, head: -0.1, tF: 1.0, kF: -1.6, tB: 0.5, kB: -1.7, ra: -0.9, qx: 8, qy: 16 },
    throwW: { ry: 4, torso: -0.25, head: -0.05, tF: 0.4, kF: -0.4, tB: -0.4, kB: -0.1, ra: -1.2, qx: 14, qy: 18, bg: 0, aB: -2.6, eB: -0.6 },
    throwS: { ry: 6, torso: 0.3, head: 0.1, tF: 0.7, kF: -0.6, tB: -0.6, kB: -0.1, ra: -1.0, qx: 14, qy: 18, bg: 0, aB: 1.9, eB: 0.2 },
    zipAim: { ry: 2, torso: -0.12, head: -0.35, tF: 0.4, kF: -0.4, tB: -0.4, kB: -0.1, ra: -0.8, qx: 6, qy: 22, fg: 0, aF: 2.6, eF: 0.15 },
    zipFly: { ry: -10, torso: -0.2, head: -0.3, tF: 1.1, kF: -1.6, tB: 0.5, kB: -1.9, ra: -1.0, qx: 8, qy: 20, fg: 0, aF: 2.9, eF: 0.05 },
    shift: { ry: 4, torso: -0.36, head: -0.5, tF: 0.5, kF: -0.4, tB: -0.5, kB: -0.1, ra: 1.15, qx: 18, qy: 34, bg: 0, aB: -1.5, eB: 0.4 },
    hurt: { ry: 4, torso: -0.4, head: 0.55, tF: 0.15, kF: -0.6, tB: -0.55, kB: -0.4, ra: -1.4, qx: 6, qy: 20 },
    broken: (t) => ({ ry: 26, torso: 0.75 + Math.sin(t * 2.4) * 0.04, head: 0.6, tF: 1.3, kF: -1.35, tB: 0.0, kB: -1.57, ra: 1.25, qx: 20, qy: 30, bg: 0, aB: 0.2, eB: 0.3 }),
  };
  // rifle model in rifle space: u along the barrel (muzzle +), v perpendicular (down +)
  const RIF = { stock: -28, grip: [5, 6], fore: [33, 4.5], muzzle: 106 };
  function veRig(e, p) {
    const J = Rig.compute(p);
    const ra = p.ra * (1 - p.aim) + (e.aimAng || 0) * p.aim;
    const anc = { x: J.sh.x + p.qx, y: J.sh.y + p.qy };
    const c = Math.cos(ra), s = Math.sin(ra);
    const rp = (u, v) => ({ x: anc.x + c * u - s * v, y: anc.y + s * u + c * v });
    const ik = (sh, t) => {
      const s1 = Rig.solve2(sh, t, 22, 20, 1), s2 = Rig.solve2(sh, t, 22, 20, -1), sl = s1.ky > s2.ky ? s1 : s2;
      const el = addP(sh, dirv(sl.a, 22)); return { el, hd: addP(el, dirv(sl.a + sl.b, 20)) };
    };
    const AF = ik(J.sh, lerpP(J.hdF, rp(RIF.fore[0], RIF.fore[1]), p.fg));
    const AB = ik(J.shB, lerpP(J.hdB, rp(RIF.grip[0], RIF.grip[1]), p.bg));
    return { J, ra, anc, rp, AF, AB, muz: rp(RIF.muzzle, -0.5), stockTip: rp(RIF.stock, 3), bayTip: rp(84 + 34 * p.bay, 3.5) };
  }
  function veRifle(ctx, R, p, e, hot) {
    ctx.save(); ctx.translate(R.anc.x, R.anc.y); ctx.rotate(R.ra);
    const P2 = e.phase === 2;
    // bayonet folds out from under the barrel
    if (p.bay > 0.05) { poly(ctx, [[80, 1.5], [80 + 34 * p.bay, 3.5], [80, 7]]); ctx.fillStyle = '#e8ecf6'; ctx.fill(); ink(ctx, 1); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(ROSE, 0.7); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(80, 6); ctx.lineTo(80 + 34 * p.bay, 3.6); ctx.stroke(); ctx.restore(); }
    // stock
    poly(ctx, [[-28, -3], [-6, -4.5], [-3, 5], [-10, 6.5], [-21, 9], [-28, 9]]); celN(ctx, -15, 2, 0, -1, 7, '#3a3348'); ink(ctx, 1.3);
    ctx.fillStyle = '#17121c'; ctx.fillRect(-29.5, -3, 3, 12);
    // grip
    poly(ctx, [[0, 4], [6, 4], [4.5, 14], [-1.5, 13]]); ctx.fillStyle = '#2b2a3a'; ctx.fill(); ink(ctx, 1.1);
    // barrel shroud + barrel + brake
    poly(ctx, [[28, -4], [66, -3.5], [66, 3], [28, 3.5]]); celN(ctx, 47, 0, 0, -1, 4, '#4a4f66'); ink(ctx, 1.2);
    ctx.fillStyle = INK; for (let x = 34; x < 62; x += 6) ctx.fillRect(x, -1.5, 3, 1.6);
    poly(ctx, [[66, -2], [98, -1.6], [98, 1.4], [66, 1.8]]); ctx.fillStyle = '#5a5f78'; ctx.fill(); ink(ctx, 1);
    poly(ctx, [[96, -3.6], [106, -3.2], [106, 2.8], [96, 3.2]]); ctx.fillStyle = '#2b2a3a'; ctx.fill(); ink(ctx, 1.1);
    // receiver (white enamel) + power cell
    poly(ctx, [[-6, -6], [29, -6], [32, 3.5], [-4, 5.5]]); celN(ctx, 12, 0, 0, -1, 6, '#e6e8f0'); ink(ctx, 1.3);
    ctx.fillStyle = '#17121c'; ctx.fillRect(10, -3.4, 12, 4.2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(ROSE, P2 ? 1 : 0.8); ctx.fillRect(11, -2.6, 10 * (0.5 + 0.5 * (hot || 0.4)), 2.6); K.glow(ctx, 16, -1.3, P2 ? 14 : 9, ROSE, 0.6); ctx.restore();
    ctx.strokeStyle = '#d4627e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(1, 1.5); ctx.lineTo(4, -2); ctx.stroke();
    // scope
    poly(ctx, [[3, -13.5], [31, -12.5], [31, -7.5], [3, -7.5]]); celN(ctx, 17, -10, 0, -1, 4, '#33364a'); ink(ctx, 1.2);
    poly(ctx, [[0, -14.5], [5, -14.5], [5, -6.5], [0, -6.5]]); ctx.fillStyle = '#22202e'; ctx.fill(); ink(ctx, 1);
    ctx.fillStyle = '#5a5f78'; ctx.fillRect(11, -7.5, 3, 2); ctx.fillRect(22, -7.5, 3, 2);
    glow(ctx, 31.5, -10, 9 + (hot || 0) * 12, ROSE, 0.6 + (hot || 0) * 0.4);
    ctx.fillStyle = '#ffd6ec'; ctx.beginPath(); ctx.ellipse(31.5, -10, 1.3, 2.4, 0, 0, TAU); ctx.fill();
    // P2: the coils along the shroud burn
    if (P2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(ROSE, 0.75 + 0.25 * Math.sin(e.t * 9)); ctx.lineWidth = 1.2; for (let x = 36; x < 64; x += 6) { ctx.beginPath(); ctx.moveTo(x, -4); ctx.lineTo(x + 1.5, 3.5); ctx.stroke(); } ctx.restore(); }
    ctx.restore();
  }
  function veHead(ctx, J, e, P2) {
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    if (!P2) {
      // hood with a comm antenna
      ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(-15, -21); ctx.lineTo(-19, -20); ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.stroke(); ctx.strokeStyle = '#c9cde0'; ctx.lineWidth = 1; ctx.stroke();
      glow(ctx, -19, -20, 6, ROSE, Math.sin(e.t * 3) > 0 ? 0.7 : 0.2);
    } else {
      // hood torn away: cropped silver hair and crystal growing out of the skull
      for (const [x, y, a, l] of [[-9, -6, -1.9, 15], [-6, -11, -2.4, 18], [-1, -12, -2.9, 12]]) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + PI / 2);
        poly(ctx, [[-3, 0], [0, -l], [3, 0]]); ctx.fillStyle = '#ff6fb8'; ctx.fill(); ink(ctx, 1);
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,220,240,0.8)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -l); ctx.stroke();
        ctx.restore();
      }
      glow(ctx, -6, -9, 22, ROSE, 0.45);
    }
    // head mass / hood
    const hood = () => { ctx.beginPath(); ctx.moveTo(10, -6); ctx.quadraticCurveTo(7, -14, -1, -14.5); ctx.quadraticCurveTo(-11, -14, -13.5, -4); ctx.quadraticCurveTo(-14, 6, -9, 12); ctx.lineTo(-2, 13); ctx.lineTo(3, 9); ctx.lineTo(2, -4); ctx.closePath(); };
    const hair = () => { ctx.beginPath(); ctx.moveTo(9.5, -5); ctx.lineTo(7, -8); ctx.lineTo(8, -10.5); ctx.quadraticCurveTo(2, -13.5, -4, -12.5); ctx.quadraticCurveTo(-11, -10, -10.5, -2); ctx.lineTo(-8.5, 5); ctx.lineTo(-3, 6); ctx.lineTo(1, -3); ctx.closePath(); };
    if (!P2) { hood(); cel(ctx, -2, -2, 13, '#d9dce8'); ink(ctx, 1.4); }
    // face (half-masked)
    const face = () => { ctx.beginPath(); ctx.moveTo(1.5, -9); ctx.quadraticCurveTo(7, -9.5, 8.6, -4); ctx.lineTo(10, 0.5); ctx.lineTo(8.6, 1.4); ctx.lineTo(9, 5.5); ctx.lineTo(6.5, 8.6); ctx.lineTo(1.4, 8.4); ctx.lineTo(-0.5, 3); ctx.closePath(); };
    face(); ctx.fillStyle = '#efcab4'; ctx.fill();
    ctx.save(); face(); ctx.clip(); ctx.fillStyle = '#b87f7c'; ctx.beginPath(); ctx.moveTo(-1, -9); ctx.lineTo(3.5, -6); ctx.quadraticCurveTo(4.5, 0, 3, 9); ctx.lineTo(-1, 9); ctx.closePath(); ctx.fill(); ctx.restore();
    face(); ink(ctx, 1.1);
    // respirator
    ctx.beginPath(); ctx.moveTo(2.5, 0.5); ctx.lineTo(10.4, 0.6); ctx.lineTo(10.8, 5.2); ctx.lineTo(7.5, 9.2); ctx.lineTo(1.6, 8.8); ctx.closePath(); cel(ctx, 6, 4, 6, '#2c2b3c'); ink(ctx, 1.1);
    ctx.beginPath(); ctx.arc(9.6, 5.2, 3, 0, TAU); ctx.fillStyle = '#596079'; ctx.fill(); ink(ctx, 1);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(8, 5.2); ctx.lineTo(11.2, 5.2); ctx.moveTo(9.6, 3.6); ctx.lineTo(9.6, 6.8); ctx.stroke();
    if (P2) { hair(); cel(ctx, -2, -6, 11, '#e6e8f2'); ink(ctx, 1.3); ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(6, -9); ctx.quadraticCurveTo(-1, -10, -7, -6); ctx.stroke(); }
    // scope-monocle over the right eye
    poly(ctx, [[4, -6.2], [12.5, -5.6], [12.5, -1.6], [4, -1.4]]); ctx.fillStyle = '#2f3244'; ctx.fill(); ink(ctx, 1);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(-10, -2.5); ctx.stroke();
    const eyeHot = e.tellT > 0 ? 1 : 0;
    glow(ctx, 13, -3.6, 9 + eyeHot * 10 + (P2 ? 6 : 0), e.tellT > 0 && e.tellCol === 'red' ? RED : ROSE, 0.85);
    ctx.fillStyle = '#ffe2f2'; ctx.beginPath(); ctx.ellipse(13, -3.6, 1.1, 1.9, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function veMine(e) {
    const W = e.wpt || { x: e.x, y: e.y - 120 }, P = e.P;
    const tx = U.clamp(P.x + P.vx * 0.3, (G.game.arena ? G.game.arena.x0 + 40 : -1e9), (G.game.arena ? G.game.arena.x1 - 40 : 1e9));
    const ty = G.Phys.groundBelow(tx, P.y - 40);
    const fl = 0.55;
    G.game.hazards.push({
      t: 0, life: fl + 0.95 + 0.4, x: W.x, y: W.y, x0: W.x, y0: W.y, tx, ty: ty > 1e8 ? P.y : ty, owner: e, boomed: false, beepT: 0,
      update(h, dt, g) {
        if (h.t < fl) { const k = h.t / fl; h.x = U.lerp(h.x0, h.tx, k); h.y = U.lerp(h.y0, h.ty - 6, k) - Math.sin(k * PI) * 130; return; }
        h.x = h.tx; h.y = h.ty - 6;
        if (!h.landed) { h.landed = true; G.FX.dust(h.x, h.ty, 6, { w: 20, speed: 120, size: 8 }); G.SFX.play('c5_clamp'); }
        h.beepT -= dt; const warn = h.t - fl;
        if (h.beepT <= 0 && warn < 0.85) { h.beepT = 0.28 - warn * 0.22; G.SFX.play('c5_mineBeep'); }
        if (!h.boomed && warn >= 0.85) {
          h.boomed = true; g.shake(0.45); G.SFX.play('c5_boom');
          G.FX.ring(h.x, h.ty - 10, 10, 130, 0.4, RED, 6); G.FX.ring(h.x, h.ty, 20, 140, 0.45, '#ffd0dc', 3, { flat: 0.2 });
          G.FX.flash(h.x, h.ty - 30, 160, 0.25, '#ff8aa6'); G.FX.spark(h.x, h.ty - 10, 26, { col: '#ffd0dc', speed: 760 }); G.FX.dust(h.x, h.ty, 16, { w: 80, speed: 260, size: 16 });
          const P = g.player, d = Math.hypot(P.x - h.x, (P.y - 50) - (h.ty - 30));
          if (d < 125) P.receiveHit(h.owner, { dmg: 26, unblockable: true, kb: 380, hx: h.x, hy: h.ty - 40 });
        }
        if (h.boomed && warn > 1.0) h.done = true;
      },
      draw(ctx, h) {
        const warn = h.t - fl;
        if (warn > 0 && !h.boomed) {
          const k = U.clamp(warn / 0.85, 0, 1);
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = U.rgba(RED, 0.35 + 0.5 * k); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(h.x, h.ty, 125, 18, 0, 0, TAU); ctx.stroke();
          ctx.fillStyle = U.rgba(RED, 0.12 + 0.18 * k); ctx.beginPath(); ctx.ellipse(h.x, h.ty, 125 * k, 18 * k, 0, 0, TAU); ctx.fill();
          K.glow(ctx, h.x, h.y, 26, RED, 0.5 + 0.5 * (Math.sin(h.t * (16 + k * 30)) > 0 ? 1 : 0));
          ctx.restore();
        }
        if (h.boomed) return;
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.t < fl ? h.t * 14 : 0);
        ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-6, -5); ctx.lineTo(6, -5); ctx.lineTo(8, 4); ctx.closePath(); ctx.fillStyle = '#d9dce8'; ctx.fill(); ink(ctx, 1.4);
        ctx.fillStyle = '#2b2a3a'; ctx.fillRect(-8, 2, 16, 3); ctx.fillStyle = Math.sin(h.t * 30) > 0 ? '#ffffff' : RED; ctx.beginPath(); ctx.arc(0, -5, 2, 0, TAU); ctx.fill();
        ctx.restore();
      },
    });
  }
  function veAimStart(e) { const P = e.P; e.aim = { x: P.x, y: P.y - 58, lock: false, fired: false }; G.SFX.play('c5_charge', 1.1); }
  function veLock(e) { if (e.aim) { e.aim.lock = true; G.SFX.play('c5_lock'); G.FX.star(e.muz ? e.muz.x : e.x, e.muz ? e.muz.y : e.y - 120, '#ffffff', 40, 0.2); } }
  function veRail(e, dmg) {
    fireRail(e, e.muz || { x: e.x + e.facing * 100, y: e.y - 118 }, { dmg, col: '#ff3d6a', w: 20, len: 1700, sfx: 'c5_rail', shake: 0.4, kb: 360 });
    e.vx = -e.facing * 170;
  }
  function veShot(e, speed, dmg, big) {
    const O = e.muz || { x: e.x + e.facing * 100, y: e.y - 118 }, P = e.P;
    const ang = Math.atan2(P.y - 60 - O.y, P.x - O.x);
    G.game.projectiles.push({ x: O.x, y: O.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: big ? 10 : 8, owner: e, friendly: false, dmg, life: 3, t: 0, col: ROSE });
    G.FX.flash(O.x, O.y, 46, 0.1, '#ffffff'); G.FX.spark(O.x, O.y, 6, { col: '#ffd6ec', speed: 420, dir: ang, spread: 0.6 });
    G.SFX.play('c5_shot'); e.vx = -e.facing * 60;
  }
  function veZip(e) {
    const ar = G.game.arena && e.enc === G.game.arena.id ? G.game.arena : null, P = e.P;
    let tx = ar ? (P.x > (ar.x0 + ar.x1) / 2 ? ar.x0 + 110 : ar.x1 - 110) : e.x - e.facing * 420;
    if (!ar && !inArenaOK(e, tx)) tx = e.x + e.facing * 420;
    const g = 2400 * (G.LEVEL.gravity || 1), T = 0.85;
    e.zip = { tx, ax: (e.x + tx) / 2, ay: e.y - 470, vx: (tx - e.x) / T };
    e.vy = -g * T / 2; e.vx = e.zip.vx; e.facing = Math.sign(P.x - tx) || e.facing;
    G.SFX.play('c5_grapple'); G.FX.spark(e.x, e.y - 120, 8, { col: '#ffd6ec', speed: 300 });
  }
  const VE = reg('c5_elite', {
    name: '領航員・薇拉', en: 'VELA, THE NAVIGATOR', w: 44, h: 152, hp: 700, bal: 220, col: ROSE, shards: 420, elite: true, scale: 1.22, spawnT: 1.0,
    defeatDialog: 'c5_eliteDefeat', defeatRelic: 'c5_scope', music: 'c5_elite',
    portrait: [1.85, 0.93],
    init(e) { e.seed = seedOf(); e.cape = new Rig.Chain(8, 9.5, 0.05, 0.9); e.facing = -1; e.aimAng = 0; e.lastMoves = []; e.vpose = null; e.gaitP = 0; },
    voice: () => G.SFX.play('c5_velaVoice'),
    weapon: (e) => e.wpt || { x: e.x + e.facing * 60, y: e.y - 115 },
    think(e, dt) {
      e.faceP();
      const P = e.P, d = e.distP();
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
        e.phase = 2; e.speedMul = 1.15; G.game.bark('c5_eliteP2');
        G.FX.ring(e.cx, e.cy, 20, 300, 0.7, ROSE, 6); G.SFX.play('c5_shatter');
        e.startAtk(VE.shift); return;
      }
      const ar = G.game.arena && e.enc === G.game.arena.id ? G.game.arena : null;
      const back = -e.facing, room = ar ? (back < 0 ? e.x - ar.x0 : ar.x1 - e.x) : 999;
      let vx = 0;
      if (d < 300 && room > 100) vx = back * 230; else if (d > 700) vx = e.facing * 160;
      e.vx = U.approach(e.vx, vx * e.speedMul, 1100 * dt);
      if (e.cd > 0 || !e.onGround) return;
      const cornered = room < 150;
      let pool;
      if (d < 210) pool = [['stock', 3], ['zip', cornered ? 4 : 1], ['mine', 1.2]];
      else if (d < 430) pool = [['mine', 2], ['volley', 2.5], ['breath', 2], ['longshot', 1.4], ['zip', cornered ? 2 : 0], ['stock', d < 270 ? 1 : 0]];
      else pool = [['longshot', 3], ['volley', 2.5], ['breath', 2], ['mine', 0.8]];
      if (e.phase === 2) pool.push(['cross', d > 260 ? 3 : 1.2]);
      const last = e.lastMoves[e.lastMoves.length - 1];
      const w = (q) => (q[0] === last ? q[1] * 0.25 : q[1]);
      let r = Math.random() * pool.reduce((s, q) => s + w(q), 0), pick = pool[0][0];
      for (const q of pool) if ((r -= w(q)) <= 0) { pick = q[0]; break; }
      e.lastMoves.push(pick); if (e.lastMoves.length > 4) e.lastMoves.shift();
      const M = { stock: VE.stock, zip: VE.zip, mine: VE.mine, volley: e.phase === 2 ? VE.volley5 : VE.volley, breath: VE.breath, longshot: VE.longshot, cross: VE.cross };
      e.startAtk(M[pick]);
    },
    longshot: {
      dur: 2.45, cd: 1.0, track: false, tells: [{ t: 0.45, c: 'red' }],
      vp: [[0, 'idle'], [0.35, 'kneel', 'io'], [1.55, 'kneel'], [1.6, 'recoil', 'snap'], [2.0, 'recoil'], [2.45, 'idle', 'io']],
      ev: [{ t: 0.02, fn: veAimStart }, { t: 1.22, fn: veLock }, { t: 1.55, fn: (e) => veRail(e, 30) }],
    },
    volley: {
      dur: 2.05, cd: 1.0, track: false,
      tells: [{ t: 0.2, c: 'white' }, { t: 0.55, c: 'white' }, { t: 0.9, c: 'white' }],
      vp: [[0, 'idle'], [0.25, 'aim', 'io'], [0.66, 'aim'], [0.7, 'kick', 'snap'], [0.84, 'aim', 'io'], [1.01, 'aim'], [1.05, 'kick', 'snap'], [1.19, 'aim', 'io'], [1.36, 'aim'], [1.4, 'kick', 'snap'], [1.6, 'aim', 'io'], [2.05, 'idle', 'io']],
      ev: [{ t: 0.02, fn: veAimStart }].concat([0.68, 1.03, 1.38].map((t) => ({ t, fn: (e) => veShot(e, 820, 16) }))),
    },
    volley5: {
      dur: 2.4, cd: 1.0, track: false,
      tells: [0.15, 0.42, 0.69, 0.96, 1.23].map((t) => ({ t, c: 'white' })),
      vp: [[0, 'idle'], [0.2, 'aim', 'io']].concat(...[0.62, 0.89, 1.16, 1.43, 1.7].map((t) => [[t - 0.02, 'aim'], [t + 0.02, 'kick', 'snap'], [t + 0.12, 'aim', 'io']])).concat([[2.4, 'idle', 'io']]),
      ev: [{ t: 0.02, fn: veAimStart }].concat([0.62, 0.89, 1.16, 1.43, 1.7].map((t) => ({ t, fn: (e) => veShot(e, 880, 15) }))),
    },
    breath: {
      dur: 2.4, cd: 1.1, track: false,
      tells: [{ t: 0.3, c: 'white' }, { t: 1.2, c: 'white' }],
      vp: [[0, 'idle'], [0.3, 'aim', 'io'], [0.75, 'aim'], [1.0, 'exhale', 'io'], [1.2, 'aim', 'snap'], [1.68, 'aim'], [1.72, 'kick', 'snap'], [1.95, 'aim', 'io'], [2.4, 'idle', 'io']],
      ev: [
        { t: 0.02, fn: veAimStart },
        { t: 0.72, fn: (e) => { if (e.muz) G.FX.star(e.muz.x, e.muz.y, '#ffd6ec', 30, 0.18); } },  // the scope glints... and she doesn't fire
        { t: 0.86, fn: (e) => { G.SFX.play('c5_breath'); const H = e.headW || { x: e.x, y: e.y - 140 }; G.FX.dust(H.x + e.facing * 10, H.y + 6, 5, { w: 6, speed: 50, size: 8, dir: e.facing > 0 ? 0 : PI, spread: 0.6, col: 'rgba(230,236,250,' }); } },
        { t: 1.7, fn: (e) => veShot(e, 1300, 22, true) },
      ],
    },
    stock: {
      dur: 2.4, cd: 0.9,
      tells: [{ t: 0.12, c: 'white' }, { t: 0.82, c: 'white' }],
      vp: [[0, 'idle'], [0.5, 'buttW', 'io'], [0.6, 'buttS', 'snap'], [0.85, 'buttS'], [1.18, 'thrustW', 'io'], [1.3, 'thrust', 'snap'], [1.6, 'thrust'], [1.75, 'air', 'io'], [2.15, 'air'], [2.4, 'idle', 'io']],
      moves: [{ t0: 0.55, t1: 0.62, v: 300 }, { t0: 1.28, t1: 1.38, v: 420 }],
      hits: [
        { t0: 0.6, t1: 0.7, box: { x: 0, y: -168, w: 92, h: 100 }, dmg: 18, kb: 260 },
        { t0: 1.32, t1: 1.42, box: { x: 40, y: -126, w: 150, h: 40 }, dmg: 22, kb: 320, last: true, pbal: 55 },
      ],
      ev: [{ t: 0.58, fn: () => G.SFX.play('whoosh', 1.1) }, { t: 1.3, fn: () => G.SFX.play('slash', 0.7, true) },
        { t: 1.7, fn: (e) => { e.vy = -620; e.vx = -e.facing * 380; e.hopping = true; G.SFX.play('whoosh', 0.8); } }],
    },
    mine: {
      dur: 1.7, cd: 1.0, track: false, tells: [{ t: 0.42, c: 'red' }],
      vp: [[0, 'idle'], [0.2, 'crouch', 'io'], [0.3, 'air', 'snap'], [0.45, 'throwW', 'io'], [0.6, 'throwS', 'snap'], [1.0, 'throwS'], [1.7, 'idle', 'io']],
      ev: [{ t: 0.24, fn: (e) => { e.vy = -520; e.vx = -e.facing * 300; e.hopping = true; } }, { t: 0.6, fn: veMine }],
    },
    zip: {
      dur: 1.75, cd: 0.5, track: false,
      vp: [[0, 'idle'], [0.25, 'zipAim', 'io'], [0.42, 'zipFly', 'snap'], [1.3, 'zipFly'], [1.75, 'idle', 'io']],
      ev: [{ t: 0.32, fn: veZip }],
    },
    cross: {
      dur: 3.3, cd: 1.3, track: false,
      tells: [{ t: 0.35, c: 'red' }, { t: 1.3, c: 'red' }, { t: 2.02, c: 'red' }],
      vp: [[0, 'idle'], [0.3, 'aim', 'io'], [1.18, 'aim'], [1.22, 'kick', 'snap'], [1.34, 'aim', 'io'], [1.9, 'aim'], [1.94, 'kick', 'snap'], [2.06, 'aim', 'io'], [2.62, 'aim'], [2.66, 'kick', 'snap'], [2.84, 'aim', 'io'], [3.3, 'idle', 'io']],
      ev: [{ t: 0.02, fn: veAimStart }, { t: 0.88, fn: veLock }, { t: 1.2, fn: (e) => veRail(e, 22) }, { t: 1.26, fn: (e) => { if (e.aim) { e.aim.lock = false; e.aim.fired = false; } } },
        { t: 1.6, fn: veLock }, { t: 1.92, fn: (e) => veRail(e, 22) }, { t: 1.98, fn: (e) => { if (e.aim) { e.aim.lock = false; e.aim.fired = false; } } },
        { t: 2.32, fn: veLock }, { t: 2.64, fn: (e) => veRail(e, 22) }],
    },
    shift: {
      dur: 1.3, cd: 0.4, track: false,
      vp: [[0, 'hurt'], [0.4, 'shift', 'io'], [1.0, 'shift'], [1.3, 'idle', 'io']],
      ev: [{ t: 0.4, fn: (e) => {
        e.hoodOff = true; const H = e.headW || { x: e.x, y: e.y - 150 };
        G.FX.shards(H.x, H.y, 14, '#e8eaf2', 380); G.FX.shards(H.x, H.y, 10, ROSE, 420); G.FX.flash(H.x, H.y, 120, 0.3, ROSE); G.FX.ring(H.x, H.y, 10, 160, 0.5, '#ffffff', 4);
        G.SFX.play('c5_shatter'); G.game.shake(0.5);
      } }],
    },
    atkUpdate(e, dt) {
      const a = e.atk, P = e.P;
      if (e.hopping) { if (e.onGround && e.vy >= 0 && e.st > 0.1) { e.hopping = false; e.vx = 0; G.FX.dust(e.x, e.y, 6, { w: 30, speed: 140, size: 10 }); } }
      else if (a === VE.zip) {
        if (e.zip && e.st > 0.32) { e.vx = e.zip.vx; if (e.onGround && e.st > 0.6) { e.vx = 0; e.zip = null; G.FX.dust(e.x, e.y, 10, { w: 40, speed: 200, size: 12 }); G.SFX.play('land'); } }
      } else if (!(a.moves && a.moves.some((m) => e.st >= m.t0 && e.st <= m.t1))) e.vx = U.approach(e.vx, 0, 900 * dt);
      if (e.aim) {
        if (!e.aim.lock) { const sp = (a === VE.cross ? 760 : 470) * dt; e.aim.x = U.approach(e.aim.x, P.x, sp); e.aim.y = U.approach(e.aim.y, P.y - 58, sp); }
        if (a && (a === VE.longshot || a === VE.cross || a === VE.volley || a === VE.volley5 || a === VE.breath)) {
          e.facing = e.aim.x < e.x ? -1 : 1;
          const A = e.anchorW || { x: e.x + e.facing * 20, y: e.y - 120 };
          const want = U.clamp(Math.atan2(e.aim.y - A.y, (e.aim.x - A.x) * e.facing), -1.2, 1.0);
          e.aimAng = U.lerp(e.aimAng || 0, want, 1 - Math.exp(-18 * dt));
          if (!e.aim.fired && e.muz) e.aim.end = beamEnd(e.muz, e.aim, 1700);
        }
      }
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, a = e.state === 'atk' ? e.atk : null, s = VE.scale, P2 = e.phase === 2 || e.hoodOff;
      let target;
      if (a && a.vp) target = sampK(a.vp, e.st, VEP, VEDEF);
      else if (e.state === 'hurt' || e.state === 'recoil') target = Object.assign({}, VEDEF, VEP.hurt);
      else if (e.state === 'broken') target = Object.assign({}, VEDEF, VEP.broken(e.t));
      else if (!e.onGround && e.state !== 'spawn') target = Object.assign({}, VEDEF, VEP.air);
      else if (Math.abs(e.vx) > 30) {
        if (dt > 0) e.gaitP += e.vx * e.facing * dt * PI / 30;
        const w = Rig.ANIM.walk(e.gaitP);
        target = Object.assign({}, VEDEF, VEP.idle(e.t), { ik: 1, fFx: w.fFx * 1.1 + 3, fFy: w.fFy * 1.2, fBx: w.fBx * 1.1 - 3, fBy: w.fBy * 1.2, ry: w.ry + 1, torso: 0.1 });
      } else target = Object.assign({}, VEDEF, VEP.idle(e.t));
      if (e.onGround && !target.ik && e.state !== 'broken' && !(a && (a === VE.stock && e.st > 1.65))) target = Object.assign({}, target, Rig.groundify(target));
      if (e.hitK > 0) target = lerpO(target, Object.assign({}, target, { torso: -0.35, head: 0.5 }), Math.min(1, e.hitK * 1.2));
      blendTo(e, 'vpose', target, dt, e.hitK > 0 ? 40 : a ? 26 : 12);
      const p = e.vpose, R = veRig(e, p), J = R.J;
      const W = (q) => ({ x: e.x + e.facing * q.x * s, y: e.y + q.y * s });
      if (!ghost) {
        e.muz = W(R.muz); e.anchorW = W(R.anc); e.headW = W(J.head);
        e.wpt = a === VE.stock ? W(e.st < 0.9 ? R.stockTip : R.bayTip) : a === VE.mine ? W(R.AB.hd) : e.muz;
      }
      const sight = a && e.aim && !e.aim.fired && e.aim.end && (a === VE.longshot || a === VE.cross) && e.st > 0.3;
      if (sight) {
        const k = a === VE.longshot ? U.clamp((e.st - 0.3) / 0.92, 0, 1) : 0.8;
        drawSight(ctx, e.muz, e.aim.end, k, e.aim.lock, e.t);
      } else if (a && e.aim && (a === VE.volley || a === VE.volley5 || a === VE.breath) && e.muz && e.st > 0.25) {
        // a faint laser dot line for the white shots
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(ROSE, 0.22); ctx.lineWidth = 1; ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.moveTo(e.muz.x, e.muz.y); ctx.lineTo(e.aim.x, e.aim.y); ctx.stroke(); ctx.restore();
      }
      // grapple line
      if (a === VE.zip && e.zip && e.st > 0.3 && e.st < 1.2) {
        const hd = W(R.AF.hd);
        ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(hd.x, hd.y); ctx.lineTo(e.zip.ax, e.zip.ay); ctx.stroke();
        ctx.strokeStyle = '#ffd6ec'; ctx.lineWidth = 1.1; ctx.stroke(); ctx.restore();
        glow(ctx, e.zip.ax, e.zip.ay, 14, ROSE, 0.8);
      }
      // cape (world chain → local)
      if (dt > 0) e.cape.update(e.x - e.facing * (6 - J.sh.x) * s, e.y + (J.sh.y + 3) * s, e.facing, dt, -e.vx * 4 + Math.sin(e.t * 2.1) * 320 + (P2 ? Math.sin(e.t * 5) * 200 : 0), 2.62);
      const sink = K.emerge(ctx, e) * 170;
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing * s, s);
      if (e.cape.inited) {
        const cp = e.cape.p.map((q) => ({ x: (q.x - e.x) * e.facing / s, y: (q.y - e.y - sink) / s }));
        K.tattered(ctx, cp, 6, P2 ? 11 : 14, P2 ? '#a9a2c8' : '#cfd3df', '#3b3552', e.seed % 5);
        if (P2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; Rig.ribbon(ctx, cp.slice(3), 1.4, 0.4, U.rgba(ROSE, 0.45)); ctx.restore(); }
      }
      const COAT = '#dfe2ea', COATS = '#a9adc4', SUIT = '#2a2b40', BOOT = '#25232f';
      // back leg + boot
      Rig.limbChain(ctx, [J.hip, lerpP(J.hip, J.kneeB, 0.5), J.kneeB, lerpP(J.kneeB, J.ankB, 0.45), J.ankB], [5.6, 5, 3.9, 3.6, 3], '#1f2032');
      Rig.limb(ctx, J.ankB, J.toeB, 3.2, 2, BOOT);
      // back arm (trigger hand)
      Rig.limbChain(ctx, [J.shB, R.AB.el, R.AB.hd], [3.6, 3, 2.4], COATS);
      ctx.beginPath(); ctx.arc(R.AB.hd.x, R.AB.hd.y, 2.6, 0, TAU); ctx.fillStyle = '#2a2838'; ctx.fill(); ink(ctx, 0.9);
      // coat: back skirt
      const tA = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x), ux = Math.cos(tA), uy = Math.sin(tA), nx = -uy, ny = ux;
      const Q = (a2, f) => ({ x: J.hip.x + ux * a2 * 36 + nx * f, y: J.hip.y + uy * a2 * 36 + ny * f });
      const sway = Math.sin(e.t * 2.2) * 3 - e.vx * e.facing * 0.012, sway2 = Math.cos(e.t * 1.7) * 2.5;
      polyP(ctx, [Q(0.15, -9), Q(0.1, 8), { x: J.hip.x + 14 + sway2, y: J.hip.y + 40 }, { x: J.hip.x + 2 + sway, y: J.hip.y + 46 }, { x: J.hip.x - 12 + sway * 1.4, y: J.hip.y + 44 }, { x: J.hip.x - 19 + sway * 1.6, y: J.hip.y + 36 }]);
      celN(ctx, J.hip.x, J.hip.y + 20, 1, 0, 16, COATS); ink(ctx, 1.2);
      ctx.strokeStyle = U.rgba(ROSE, 0.85); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(J.hip.x - 19 + sway * 1.6, J.hip.y + 35); ctx.lineTo(J.hip.x - 12 + sway * 1.4, J.hip.y + 43); ctx.lineTo(J.hip.x + 2 + sway, J.hip.y + 45); ctx.stroke();
      // torso (long coat, high collar, harness)
      const tp = [Q(-0.06, -9), Q(0.4, -9), Q(0.85, -11), Q(1.1, -6), Q(1.12, 6), Q(0.85, 10), Q(0.45, 8.5), Q(0.05, 9)];
      blobP(ctx, tp); celN(ctx, Q(0.5, 0).x, Q(0.5, 0).y, nx, ny, 12, COAT); ink(ctx, 1.4);
      ctx.save(); blobP(ctx, tp); ctx.clip();
      ctx.strokeStyle = '#6a4632'; ctx.lineWidth = 2.6; ctx.beginPath(); const h1 = Q(1.05, -8), h2 = Q(0.2, 10); ctx.moveTo(h1.x, h1.y); ctx.lineTo(h2.x, h2.y); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.fillStyle = '#4d3427'; const bl0 = Q(0.08, -10), bl1 = Q(0.08, 11), bl2 = Q(0.2, 11), bl3 = Q(0.2, -10); polyP(ctx, [bl0, bl1, bl2, bl3]); ctx.fill(); ink(ctx, 0.8);
      ctx.restore();
      for (const k of [0.45, 0.6, 0.75]) { const c = lerpP(h1, h2, 1 - k); ctx.fillStyle = '#17121c'; ctx.fillRect(c.x - 2, c.y - 3, 4, 6); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(ROSE, 0.9); ctx.fillRect(c.x - 1, c.y - 2, 2, 4); ctx.restore(); }
      // high collar
      polyP(ctx, [Q(0.98, -8), Q(1.22, -9), Q(1.3, 1), Q(1.08, 7)]); celN(ctx, Q(1.1, 0).x, Q(1.1, 0).y, nx, ny, 7, COAT); ink(ctx, 1.1);
      // front leg (shin guard) + boot
      Rig.limbChain(ctx, [J.hip, lerpP(J.hip, J.kneeF, 0.5), J.kneeF, lerpP(J.kneeF, J.ankF, 0.45), J.ankF], [6.2, 5.5, 4.2, 4, 3.1], SUIT, { spec: 0.2 });
      Rig.limb(ctx, lerpP(J.kneeF, J.ankF, 0.15), lerpP(J.kneeF, J.ankF, 0.85), 4.6, 3.6, '#e2e5ee', { spec: 0.3 });
      Rig.limb(ctx, J.ankF, J.toeF, 3.4, 2.1, BOOT);
      // coat: front flap over the thigh
      polyP(ctx, [Q(0.12, 2), Q(0.1, 10), { x: J.hip.x + 17 + sway2, y: J.hip.y + 34 }, { x: J.hip.x + 8 + sway, y: J.hip.y + 38 }]);
      celN(ctx, J.hip.x + 10, J.hip.y + 18, 1, 0, 10, COAT); ink(ctx, 1.1);
      // shoulder crystal (grows in phase 2)
      const cr = Q(1.1, -7), cs = P2 ? 1.7 : 1;
      for (const [ang, l] of [[-2.4, 10], [-1.9, 13], [-1.4, 8]]) {
        ctx.save(); ctx.translate(cr.x, cr.y); ctx.rotate(ang + PI / 2 + tA + PI / 2);
        poly(ctx, [[-2.2, 0], [0, -l * cs], [2.2, 0]]); ctx.fillStyle = '#ff6fb8'; ctx.fill(); ink(ctx, 0.9);
        ctx.restore();
      }
      glow(ctx, cr.x, cr.y - 6, 14 * cs, ROSE, 0.5);
      // head
      veHead(ctx, J, e, P2);
      if (P2) { const nk = Q(1.15, -2); ctx.beginPath(); ctx.ellipse(nk.x - 3, nk.y + 1, 9, 5, tA, 0, TAU); cel(ctx, nk.x, nk.y, 8, COATS); ink(ctx, 1.1); }
      // rifle + front arm
      const hot = a && e.aim && !e.aim.fired ? (e.aim.lock ? 1 : 0.5) : e.tellT;
      veRifle(ctx, R, p, e, hot);
      Rig.limbChain(ctx, [J.sh, R.AF.el, R.AF.hd], [4, 3.4, 2.8], COAT, { spec: 0.25 });
      ctx.beginPath(); ctx.arc(R.AF.hd.x, R.AF.hd.y, 2.8, 0, TAU); ctx.fillStyle = '#2a2838'; ctx.fill(); ink(ctx, 0.9);
      ctx.strokeStyle = '#d4627e'; ctx.lineWidth = 1.2; const bd = lerpP(J.sh, R.AF.el, 0.5); ctx.beginPath(); ctx.moveTo(bd.x - 2.5, bd.y - 1.5); ctx.lineTo(bd.x, bd.y + 1.5); ctx.lineTo(bd.x + 2.5, bd.y - 1.5); ctx.stroke();
      if (e.tellT > 0) { const tw = a === VE.stock ? (e.st < 0.9 ? R.stockTip : R.bayTip) : R.muz; glow(ctx, tw.x, tw.y, 26, e.tellCol === 'red' ? RED : '#ffffff', e.tellT); }
      if (e.state === 'broken' && !ghost && Math.random() < 0.08) G.FX.ember(e.x, e.y - 90, 2, ROSE, { w: 30, h: 30, up: 80 });
    },
  });

  /* ============================== data: codex, relic, barks ============================== */
  if (!D.speakers.c5_vela) D.speakers.c5_vela = { name: '薇拉', en: 'VELA', color: ROSE };
  D.barks.c5_eliteP2 = { who: 'c5_vela', text: '……風停了。這一發，不會再偏。' };
  D.relics.c5_scope = D.relics.c5_scope || { name: '薇拉的觀星鏡', desc: '共鳴獲取 +25%' };
  G.Relics.c5_scope = G.Relics.c5_scope || { apply(P) { P.resMul *= 1.25; } };
  const pushOnce = (arr, en) => { if (!arr.some((q) => q.id === en.id)) arr.push(en); };
  pushOnce(D.codex.items, {
    id: 'c5_scope', name: '薇拉的觀星鏡', en: "VELA'S STAR-SCOPE", unlock: 'relic_c5_scope', relic: true,
    body: ['領航員薇拉的單眼觀星鏡，邊緣結著一圈粉色的晶霜。從前她用它讀倒懸的星，替亡者找路；後來，只用它瞄準。', '她最後一發，打偏了。', '遺物效果：共鳴獲取 +25%。'],
  });
  const HB = D.codex.hushborn;
  pushOnce(HB, {
    id: 'c5_driftwatch', name: '浮游哨', en: 'DRIFTWATCH', portrait: 'c5_driftwatch', unlock: 'seen_c5_driftwatch', tag: '寂裔｜中階・飛行哨兵',
    body: [
      '倒懸之塔的守望之眼。從前，它繞著塔漂浮，用一道光替失了重量的亡者指路。門關上之後，再沒有人需要指路——於是凡是會動的，都成了它的目標。',
      '攻擊模式：紅色瞄準線會追著你移動，光環加速、瞄準線「閃爍鎖定」之後才擊發，無法格擋——看見閃爍就閃避／貼近時的白色震波脈衝，可格擋或完美格擋。',
      '弱點：鎖定之後它無法再修正方向——看準閃爍翻滾穿過那道光，或乾脆衝到它腳下。',
    ],
  });
  pushOnce(HB, {
    id: 'c5_voidling', name: '虛空寂裔', en: 'VOIDLING', portrait: 'c5_voidling', unlock: 'seen_c5_voidling', tag: '寂裔｜中階・刺客',
    body: [
      '放了手的亡者往天上墜，墜進塔尖那片什麼都沒有的地方。偶爾，有東西從那裡回來——只剩一副空殼，碎裂的頭顱裡是一整片星空。',
      '攻擊模式：身形閃爍、消失，從你背後的裂隙走出——紅光背刺（必須閃避），接著一記白光斜斬／近身時的雙刃連斬（白光）。',
      '弱點：閃爍的前半秒可以打斷它。聽見那陣倒抽氣般的聲音時——回頭。',
    ],
  });
  pushOnce(HB, {
    id: 'c5_mender', name: '縫補者', en: 'MENDER', portrait: 'c5_mender', unlock: 'seen_c5_mender', tag: '寂裔｜低階・支援',
    body: [
      '沿著塔的支架爬行的多足縫匠，從前用絲線縫補塔身的裂縫。在它眼裡，寂裔只是「需要縫補的東西」。它用背上的絲線，把力氣縫進它們體內——一如當年縫補這座塔。',
      '攻擊模式：絲線治療（持續回復同伴生命）／鋼針突刺（白光）／熔蠟彈（白色投射物，完美格擋可彈回）。',
      '弱點：任何一擊都會扯斷絲線。它單獨存在時幾乎沒有威脅——所以，先處理它。',
    ],
  });
  pushOnce(HB, {
    id: 'c5_breacher', name: '壓艙者', en: 'THE BALLAST', portrait: 'c5_breacher', unlock: 'seen_c5_breacher', tag: '寂裔｜高階・重裝',
    body: [
      '不肯交出重量的亡者。他把鉛灌進自己的靴子，把腳釘進甲板——在這座沒有重量的塔上，他是唯一能「站穩」的東西，所以從不需要走得很快。',
      '攻擊模式：沉重牽引（紅光，無法格擋；被拉過去之後會接一記白光重拳）／踏地震波（白光，沿地面向兩側擴散——跳過它，或正面完美格擋來削減它的平衡）。',
      '弱點：牽引落空時，他得喘一口氣，背上的鉛罐會冒出白霧——那是很長的破綻。',
    ],
  });
  pushOnce(HB, {
    id: 'c5_elite', name: '領航員・薇拉', en: 'VELA, THE NAVIGATOR', portrait: 'c5_elite', unlock: 'seen_c5_elite', tag: '菁英｜倒懸之塔・領航員',
    body: [
      '倒懸之塔的領航員。據說她能在塔頂的強風裡，看清三里外一盞燈的燈芯。寂沒有奪走她的準度，只奪走了她瞄準的理由。',
      '攻擊模式：紅色瞄準線的長射（鎖定閃光後擊發）／白光三連射（可彈回）／屏息射擊——第一次瞄準是假的，等第二道白光／重力陷阱（紅圈，離開範圍）／槍托＋刺刀連擊（白光）。',
      '第二階段：兜帽碎裂、晶簇綻開之後，她會連續三次鎖定射擊，三連射也會變成五連射。',
      '弱點：她不擅長近戰。被逼到牆邊時會用鉤索飛越你的頭頂——落地的那一瞬間，就是機會。',
    ],
  });
})(window.G);

'use strict';
/* ECHOFALL — Chapter IV 沉沒的歌劇院 THE DROWNED OPERA — Hushborn roster.
   c4_marionette 提線舞者 · c4_chorister 假面合唱 · c4_pitwyrm 樂池鰻 · c4_usher 帶位員 · c4_elite 首席小提琴・瓦倫丁
   (+ their SFX, codex entries, the elite's relic c4_rosin). Telegraphs: white = guard/parry, red = dodge. */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK, CRIM = K.CRIM;
  const LC = Rig.limbChain, LB = Rig.limb, lp = K.lerpP;
  const DEBUG_HB = /[#&]hb=1/.test(location.hash);   // tools/test.html …&hb=1 draws attack boxes

  /* =========================== shared helpers =========================== */
  const poly = (ctx, pts, close = true) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); if (close) ctx.closePath(); };
  const smooth = (ctx, pts) => {
    ctx.beginPath(); const n = pts.length; const m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2]; ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    ctx.closePath();
  };
  const ink = (ctx, w = 1.2) => { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); };
  // hard-stop cel fill across an axis, lit on the sun side (mirrors with the facing flip)
  const cel = (ctx, cx, cy, nx, ny, w, hex) => { const Ld = Rig.lightDir(ctx); return Rig.celGrad(ctx, cx, cy, nx, ny, w, nx * Ld.x + ny * Ld.y >= 0 ? 1 : -1, Rig.ramp(hex)); };
  const lighter = (ctx, fn) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; fn(); ctx.restore(); };
  const tellGlow = (ctx, e, x, y, r = 26) => { if (e.tellT > 0) lighter(ctx, () => K.glow(ctx, x, y, r, e.tellCol === 'red' ? CRIM : '#ffffff', e.tellT)); };
  const live = (ghost) => !ghost && G.game.dtVis > 0;
  // torso frame along hip→chest (s: 0..1 up the torso, f: + toward the facing side)
  const torsoQ = (J) => {
    const tA = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x), ux = Math.cos(tA), uy = Math.sin(tA), nx = -uy, ny = ux;
    return { Q: (s, f) => ({ x: J.hip.x + ux * s * 36 + nx * f, y: J.hip.y + uy * s * 36 + ny * f }), nx, ny, ux, uy, ang: tA };
  };
  // death: the body burns away from the top down along a ragged edge, embers rising from the seam (local coords)
  function dissolve(ctx, e, top, bottom, s, ghost) {
    if (e.state !== 'die') return 0;
    const k = U.clamp(e.st / 0.5, 0, 1), edge = U.lerp(top - 6, bottom + 4, U.easeInOutSine(k));
    ctx.beginPath(); ctx.moveTo(-260, bottom + 80); ctx.lineTo(-260, edge);
    for (let x = -260; x <= 260; x += 12) ctx.lineTo(x, edge + Math.sin(x * 0.37 + e.st * 30) * 4 + ((x * 13) % 7));
    ctx.lineTo(260, bottom + 80); ctx.closePath(); ctx.clip();
    if (live(ghost)) G.FX.ember(e.x, e.y + edge * s, 3, e.T.col, { w: e.w * 1.6, h: 6, up: 200, sp: 60 });
    return k;
  }
  // generic rig posing with per-foe pose sets: { idle(t,e), move(e,dt), hurt, snap, broken(t), air?(e) }
  function rigPose(e, dt, S) {
    let target; const st = e.state;
    if (st === 'atk' && e.atk && e.atk.poses) target = Rig.sample(e.atk.poses, e.st);
    else if (st === 'hurt' || st === 'recoil' || st === 'die') { const w = Math.sin(Math.min(1, e.st / (e.hurtDur || 0.36)) * PI); target = { ...S.hurt, rx: (S.hurt.rx || 0) - 6 * w }; }
    else if (st === 'broken') target = S.broken(e.t, e);
    else if (!e.onGround && S.air) target = S.air(e);
    else if (Math.abs(e.vx) > 30 && e.onGround && st !== 'spawn') target = S.move(e, dt);
    else target = S.idle(e.t, e);
    if (S.ground && e.onGround && st !== 'broken' && !target.ik) target = Rig.groundify(target);
    const hk = e.hitK;
    if (hk > 0) target = Rig.lerpPose(Rig.full(target), Rig.full({ ...Rig.full(target), ...S.snap }), Math.min(1, hk * 1.2));
    K.blendPose(e, target, dt, hk > 0 ? 45 : st === 'atk' ? 30 : 14);
  }
  // walking gait (feet planted, IK knees) for the rig foes
  const gaitFoot = (q, S, lift) => { q = ((q % TAU) + TAU) % TAU; return q < PI ? { x: S * Math.cos(q), y: 0 } : { x: S * Math.cos(q), y: -lift * Math.sin(q - PI) }; };
  function stepGait(e, dt, stride, snd) {
    const prev = Math.floor((e.gaitP || 0) / PI);
    e.gaitP = (e.gaitP || 0) + Math.abs(e.vx) * dt * PI / (2 * stride);
    if (snd && Math.floor(e.gaitP / PI) !== prev && Math.abs(e.x - e.P.x) < 800) G.SFX.play(snd);
    return e.gaitP;
  }
  // debug: attack boxes (white = pending, red = live)
  function drawBoxes(ctx, e) {
    if (!DEBUG_HB || !e.atk || !e.atk.hits) return;
    ctx.save(); ctx.lineWidth = 2;
    for (const h of e.atk.hits) { const b = e.boxW(h.box), on = e.st >= h.t0 && e.st <= h.t1; ctx.strokeStyle = on ? '#ff2050' : 'rgba(255,255,255,0.6)'; ctx.setLineDash(on ? [] : [6, 4]); ctx.strokeRect(b.x, b.y, b.w, b.h); }
    ctx.restore();
  }
  const pick = (pool, last) => {
    const w = pool.map((p) => (p[0] === last ? p[1] * 0.3 : p[1])), tot = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot; for (let i = 0; i < pool.length; i++) if ((r -= w[i]) <= 0) return pool[i][0];
    return pool[0][0];
  };

  /* =========================== SFX =========================== */
  const A = () => G.AudioKit;
  Object.assign(G.SFX, {
    // wooden clack + a broken music-box phrase
    c4_puppet(t) {
      const a = A(); a.noise(t, 0.001, 0.12, 0.03, 'bandpass', 2600, 1800, 3, 0.05); a.noise(t + 0.07, 0.001, 0.09, 0.03, 'bandpass', 2100, 1500, 3, 0.05);
      [91, 88, 84].forEach((m, i) => a.bell(a.mtof(m), t + 0.05 + i * 0.11, 0.035, 0.9, 0.6, 1.3));
    },
    c4_string(t) { const a = A(); a.tone('sine', 1560, t, 0.002, 0.03, 0.25, { to: 1490, wet: 0.4 }); a.noise(t, 0.002, 0.05, 0.08, 'highpass', 5000, 7000, 1, 0.2); },
    // a wordless two-voice choir 'aah'
    c4_choir(t, hi = 0) { const a = A(); a.choirVoice(a.mtof(69 + hi), t, 0.6, 0.035, a.sfxBus); a.choirVoice(a.mtof(76 + hi), t + 0.04, 0.6, 0.028, a.sfxBus); },
    c4_ward(t) { const a = A(); [81, 85, 88, 93].forEach((m, i) => a.bell(a.mtof(m), t + i * 0.06, 0.03, 1.4, 0.8, 0.8)); a.choirVoice(a.mtof(81), t, 0.9, 0.03, a.sfxBus); },
    c4_note(t) { const a = A(); a.tone('triangle', a.mtof(84 + Math.floor(Math.random() * 4) * 2), t, 0.004, 0.05, 0.3, { wet: 0.5 }); },
    // eel: a wet gurgle and a hiss
    c4_eel(t) { const a = A(); a.noise(t, 0.02, 0.16, 0.35, 'lowpass', 700, 180, 4, 0.2); a.tone('sine', 150, t, 0.02, 0.1, 0.4, { to: 70, wet: 0.2 }); a.noise(t + 0.1, 0.05, 0.06, 0.3, 'highpass', 3500, 5000, 0.7, 0.2); },
    c4_splash(t, k = 1) { const a = A(); a.noise(t, 0.004, 0.32 * k, 0.45, 'lowpass', 2400, 260, 0.6, 0.25); for (let i = 0; i < 5; i++) a.tone('sine', 500 + Math.random() * 900, t + 0.05 + i * 0.05, 0.002, 0.02 * k, 0.06, { to: 1400, wet: 0.3 }); },
    // lantern: creaking brass and a breathing violet flame
    c4_lantern(t) { const a = A(); a.tone('square', 330, t, 0.01, 0.025, 0.2, { to: 290, filter: 'bandpass', ff: 1400, q: 4, wet: 0.2 }); a.tone('sawtooth', 62, t, 0.08, 0.06, 0.6, { to: 55, filter: 'lowpass', ff: 300, wet: 0.3 }); },
    c4_fire(t) { const a = A(); a.noise(t, 0.01, 0.22, 0.5, 'bandpass', 900, 400, 0.8, 0.2); for (let i = 0; i < 4; i++) a.noise(t + 0.05 + i * 0.07, 0.001, 0.06, 0.02, 'highpass', 3000, 4000, 1, 0.05); },
    // violin: a bowed sawtooth through a body formant (pitch multiplier p)
    c4_violin(t, p = 1, len = 0.5) { const a = A(); a.tone('sawtooth', 587 * p, t, 0.03, 0.045, len, { to: 598 * p, filter: 'bandpass', ff: 2300, q: 1.4, wet: 0.35 }); a.tone('sawtooth', 590 * p, t, 0.04, 0.03, len, { detune: 9, filter: 'bandpass', ff: 1100, q: 1.2, wet: 0.35 }); },
    c4_pluck(t) { const a = A(); a.tone('triangle', 784, t, 0.002, 0.14, 0.28, { to: 776, wet: 0.4 }); a.tone('sine', 1568, t, 0.002, 0.04, 0.15, { wet: 0.4 }); },
    c4_slice(t) { const a = A(); a.noise(t, 0.01, 0.3, 0.14, 'bandpass', 4200, 1800, 1.6, 0.1); a.tone('sawtooth', 1175, t, 0.005, 0.03, 0.12, { to: 1760, filter: 'bandpass', ff: 3000, q: 2, wet: 0.3 }); },
  });

  /* ---- Chorister's Ward: a sung shield over an ally that soaks blows until it breaks (or its singer dies). ----
     Implemented as a thin wrap of Enemy.takeHit / breakBalance (engine-safe: no ward → original behaviour). */
  if (!G.Enemy.prototype._c4ward) {
    const P0 = G.Enemy.prototype, take = P0.takeHit, brk = P0.breakBalance;
    P0._c4ward = true;
    P0.takeHit = function (h) {
      const w = this.c4Ward;
      if (w) {
        if (w.src.dead || w.hp <= 0 || G.game.time > w.until) this.c4Ward = null;
        else if (!this.dead && this.state !== 'spawn' && this.state !== 'executed' && !this.invuln) {
          w.hp -= h.dmg; w.flash = 1;
          const hx = h.hx ?? this.cx, hy = h.hy ?? this.cy;
          G.FX.spark(hx, hy, 10, { col: '#ffe9a8', speed: 520 }); G.SFX.play('parry', false); G.game.hitstop(0.05);
          if (w.hp <= 0) {
            this.c4Ward = null; G.FX.ring(this.cx, this.cy, 20, 110, 0.4, '#ffd36b', 5); G.FX.shards(this.cx, this.cy, 10, '#ffd36b', 420);
            G.SFX.play('crystal', 4); G.FX.text(this.cx, this.y - this.h - 30, '護盾破碎', '#ffe9a8', 16, 0.9);
          }
          return false;
        }
      }
      return take.call(this, h);
    };
    P0.breakBalance = function () { this.c4Ward = null; return brk.call(this); };
  }

  /* =========================================================================================
     c4_marionette 提線舞者 — a porcelain prima ballerina still dancing for a puppeteer nobody can see.
     Hangs from glinting strings; jerky bourrée glides; pirouette ×3 (white) then a curtsy; grand-jeté stab (red).
     ========================================================================================= */
  const MAR = { s: 1.12, col: '#ffb38a', porc: '#efe4d6', velvet: '#8f1a35', tutu: ['#5c1129', '#a8264a', '#e8738c'], joint: '#4a2a22', hair: '#3a1424', gold: '#e8b45a' };
  const twitch = (t) => Math.pow(Math.max(0, Math.sin(t * 1.7 + Math.sin(t * 0.6) * 2)), 14);
  const MP = {
    idle: (t) => { const br = Math.sin(t * 2.2), tw = twitch(t); return { ik: 1, fFx: 7, fFy: -8, fBx: -3, fBy: -8, rx: Math.sin(t * 0.9) * 1.5, ry: -9 + br * 0.8 + tw * 3, torso: 0.04 + br * 0.02 - tw * 0.12, head: -0.12 + tw * 0.4, aF: 0.55 + br * 0.05 + tw * 0.5, eF: 1.25, aB: -0.35 - tw * 0.4, eB: 1.1 }; },
    move: (e) => { const p = e.t * 15; return { ik: 1, fFx: 6 + Math.sin(p) * 5, fFy: -8 - Math.max(0, Math.sin(p)) * 4, fBx: -4 - Math.sin(p) * 5, fBy: -8 - Math.max(0, -Math.sin(p)) * 4, rx: 2, ry: -9 + Math.abs(Math.sin(p)) * 1.2, torso: -0.06, head: -0.14, aF: 1.45, eF: 0.25, aB: -1.35, eB: 0.3 }; },
    air: () => ({ ry: -6, torso: 0.1, head: -0.2, tF: 0.9, kF: -1.6, tB: -0.4, kB: -0.8, aF: 2.2, eF: 0.4, aB: -2.0, eB: 0.4 }),
    hurt: { ik: 1, fFx: 4, fFy: -6, fBx: -10, fBy: -6, ry: -4, torso: -0.42, head: -0.6, aF: 2.3, eF: 0.6, aB: 2.7, eB: 0.5 },
    snap: { torso: -0.45, head: -0.75, aF: 2.0, aB: 2.4 },
    broken: (t) => ({ rx: Math.sin(t * 1.3) * 3, ry: 18, torso: 0.95 + Math.sin(t * 1.3) * 0.06, head: 1.0, tF: 0.35, kF: -1.1, tB: 0.05, kB: -0.9, aF: 0.05 + Math.sin(t * 1.3) * 0.05, eF: 0.15, aB: -0.05, eB: 0.1 }),
    plie: { ik: 1, fFx: 15, fFy: -2, fBx: -12, fBy: -2, ry: 7, torso: 0.12, head: -0.1, aF: 0.9, eF: 1.5, aB: -0.5, eB: 1.4 },
    passe: { ry: -10, torso: 0.0, head: -0.06, tF: 1.25, kF: -2.5, tB: 0.0, kB: 0.0, aF: 1.62, eF: 0.04, aB: -1.62, eB: 0.04 },
    curtsy: { ik: 1, fFx: 10, fFy: -2, fBx: -18, fBy: -2, ry: 12, torso: 0.62, head: 0.35, aF: 0.4, eF: 0.3, aB: -1.5, eB: 0.2 },
    windJ: { ik: 1, fFx: 16, fFy: -2, fBx: -17, fBy: -2, ry: 13, torso: 0.45, head: -0.25, aF: -0.7, eF: 0.4, aB: -1.1, eB: 0.3 },
    jete: { ry: -6, torso: 0.28, head: -0.15, tF: 1.55, kF: 0.0, tB: -1.45, kB: 0.0, aF: 1.7, eF: 0.0, aB: -2.4, eB: 0.2 },
    jeteDn: { ry: -6, torso: 0.4, head: -0.05, tF: 1.35, kF: -0.2, tB: -1.3, kB: -0.1, aF: 1.15, eF: 0.0, aB: -2.2, eB: 0.2 },
    land: { ik: 1, fFx: 30, fFy: -2, fBx: -26, fBy: -2, ry: 20, torso: 0.72, head: 0.2, aF: 0.95, eF: 0.0, aB: -2.0, eB: 0.3 },
  };
  const PIR = [0.62, 1.15, 1.68];   // pirouette hit times (a waltz: one-two-three)
  TYPES.c4_marionette = {
    name: '提線舞者', en: 'MARIONETTE', w: 34, h: 122, hp: 85, bal: 55, col: MAR.col, shards: 34, kbMul: 1.2, spawnT: 0.9,
    portrait: [2.1, 0.93],
    init(e) { e.jerkT = 0; e.jerkD = 0.5; e.jerkV = 0; e.spinX = 1; e.barSway = 0; },
    voice: () => G.SFX.play('c4_puppet'),
    weapon: (e) => { const J = e.J, s = MAR.s; return J && J.nF ? { x: e.x + e.facing * J.nF.x * s * (e.spinX || 1), y: e.y + J.nF.y * s } : { x: e.x + e.facing * 60, y: e.y - 100 }; },
    think(e, dt) {
      const T = TYPES.c4_marionette;
      e.faceP(); const d = e.distP();
      // string-jerked gait: short gliding bursts with dead pauses, the occasional backward yank
      e.jerkT -= dt;
      if (e.jerkT <= 0) {
        e.jerkD = e.jerkT = U.rand(0.32, 0.7);
        e.jerkV = d > 140 ? U.rand(240, 340) : d < 70 ? -220 : 0;
        if (Math.random() < 0.2) e.jerkV = -e.jerkV * 0.6;
        if (Math.random() < 0.25) G.SFX.play('c4_string');
      }
      const ph = 1 - e.jerkT / e.jerkD;
      e.vx = e.facing * e.jerkV * e.speedMul * Math.pow(Math.sin(ph * PI), 0.7);
      if (e.cd > 0) return;
      if (d < 160) e.startAtk(T.pirouette);
      else if (d > 190 && d < 420 && Math.random() < 0.6) e.startAtk(T.arabesque);
      else if (d < 200) e.startAtk(T.pirouette);
    },
    // three whirling needle turns (white ×3), each ending face-on, then a curtsy you can punish
    pirouette: {
      dur: 2.45, cd: 1.5, trackWin: 0.4, trackSpeed: 300,
      tells: PIR.map((h) => ({ t: h - 0.52, c: 'white' })),
      poses: { dur: 2.45, keys: [[0, MP.idle(0)], [0.3, MP.plie], [0.5, MP.passe, 'snap'], [1.85, MP.passe], [2.05, MP.curtsy, 'io'], [2.3, MP.curtsy], [2.45, MP.idle(0), 'io']] },
      moves: PIR.map((h) => ({ t0: h - 0.1, t1: h + 0.02, v: 210 })),
      hits: PIR.map((h, i) => ({ t0: h - 0.04, t1: h + 0.1, box: { x: -106, y: -140, w: 212, h: 76 }, dmg: i === 2 ? 14 : 11, kb: i === 2 ? 300 : 200, last: i === 2, pbal: i === 2 ? 40 : 22 })),
      ev: PIR.map((h) => ({ t: h - 0.08, fn: () => { G.SFX.play('whoosh', 1.2); G.SFX.play('c4_string'); } })),
    },
    // grand jeté: a deep plié, a soaring split leap, the front needle driven down where you stand (red)
    arabesque: {
      dur: 1.7, cd: 1.6, track: false,
      tells: [{ t: 0.04, c: 'red' }],
      poses: { dur: 1.7, keys: [[0, MP.idle(0)], [0.5, MP.windJ], [0.62, MP.jete, 'snap'], [0.85, MP.jete], [1.08, MP.jeteDn, 'io'], [1.16, MP.land, 'snap'], [1.5, MP.land], [1.7, MP.idle(0), 'io']] },
      hits: [{ t0: 0.66, t1: 1.16, box: { x: -10, y: -128, w: 158, h: 128 }, dmg: 20, red: true, kb: 380, last: true }],
      ev: [{ t: 0.6, fn: (e) => {
        e.faceP(); const P = e.P, T = 2 * 640 / (2400 * (G.LEVEL.gravity || 1));
        e.vy = -640; e.leapVx = U.clamp((P.x - e.facing * 50 - e.x) / T, -760, 760); e.landed = false;
        G.SFX.play('whoosh', 1.4); G.FX.dust(e.x, e.y, 10, { w: 30, speed: 160, size: 9 });
      } }],
    },
    atkUpdate(e) {
      const T = TYPES.c4_marionette;
      if (e.atk === T.arabesque) {
        if (e.st > 0.6 && e.st < 1.3 && !e.landed) { e.vx = e.leapVx; if (e.st > 0.75 && e.onGround) { e.landed = true; e.vx = 0; G.SFX.play('land', 1.2); G.FX.dust(e.x, e.y, 16, { w: 50, speed: 220, size: 11 }); G.FX.ring(e.x, e.y, 8, 90, 0.35, MAR.col, 3, { flat: 0.2 }); } }
        if (e.landed) e.vx = 0;
      }
    },
    draw(ctx, e, ghost) {
      const dt = G.game.dtVis, s = MAR.s, T = TYPES.c4_marionette;
      rigPose(e, dt, MP);
      const J = Rig.compute(e.pose); e.J = J;
      const t = e.t, broken = e.state === 'broken';
      // spin: a paper-turn around the vertical axis while a pirouette whirls
      let spin = 1;
      if (e.state === 'atk' && e.atk === T.pirouette) for (const h of PIR) { const u = (e.st - (h - 0.13)) / 0.27; if (u > 0 && u < 1) spin = Math.cos(u * TAU); }
      spin = Math.sign(spin || 1) * Math.max(0.16, Math.abs(spin)); e.spinX = spin;
      e.barSway = U.damp(e.barSway || 0, -e.vx * 0.05, 4, dt);
      const drop = -K.emerge(ctx, e) * 300;     // lowered onto the stage on her strings
      ctx.save();
      ctx.translate(e.x, e.y + drop); ctx.scale(e.facing * s, s);
      dissolve(ctx, e, -150, 4, s, ghost);
      const dieK = e.state === 'die' ? e.st / 0.5 : 0;
      // ---- the puppeteer's cross-bar, far above
      const bx = J.head.x + e.barSway + Math.sin(t * 0.8) * 4, by = broken ? -250 : -318 - Math.sin(t * 2.2) * 3;
      const sag = broken ? 26 : dieK > 0 ? 40 : 0;
      const bar = { c: [bx, by], l: [bx - 30, by + 2], r: [bx + 30, by - 2], kl: [bx - 15, by + 10], kr: [bx + 15, by + 10] };
      const strings = [[bar.c, J.head, 0], [bar.r, J.hdF, 1], [bar.l, J.hdB, 1], [bar.kr, J.kneeF, 2], [bar.kl, J.kneeB, 2]];
      if (!ghost) {
        ctx.save(); ctx.lineCap = 'round';
        for (const [a, b, i] of strings) {
          const mx = (a[0] + b.x) / 2 + sag * 0.4, my = (a[1] + b.y) / 2 + sag;
          ctx.strokeStyle = `rgba(255,232,196,${0.5 * (1 - dieK)})`; ctx.lineWidth = i === 0 ? 0.9 : 0.7;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
        }
        // a glint racing down one string at a time
        const gi = Math.floor(t * 0.7) % 5, gu = (t * 0.7) % 1, [ga, gb] = strings[gi];
        lighter(ctx, () => K.glow(ctx, U.lerp(ga[0], gb.x, gu), U.lerp(ga[1], gb.y, gu), 6, '#ffe2b8', 0.7 * (1 - dieK)));
        // cross-bar: dark walnut with gilt caps, strings vanishing up into the flies
        ctx.globalAlpha = 1 - dieK;
        const up = ctx.createLinearGradient(0, by - 120, 0, by);
        up.addColorStop(0, 'rgba(255,232,196,0)'); up.addColorStop(1, 'rgba(255,232,196,0.35)');
        ctx.strokeStyle = up; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(bar.l[0] + 6, by); ctx.lineTo(bar.l[0] + 10, by - 120); ctx.moveTo(bar.r[0] - 6, by); ctx.lineTo(bar.r[0] - 10, by - 120); ctx.stroke();
        ctx.save(); ctx.translate(bx, by); ctx.rotate(broken ? 0.35 : Math.sin(t * 1.1) * 0.06 - e.barSway * 0.004);
        LB(ctx, { x: -32, y: 0 }, { x: 32, y: 0 }, 2.6, 2.6, '#3a241a', { noHatch: true });
        LB(ctx, { x: 0, y: -8 }, { x: 0, y: 12 }, 2.2, 2.2, '#3a241a', { noHatch: true });
        LB(ctx, { x: -16, y: 10 }, { x: 16, y: 10 }, 1.6, 1.6, '#3a241a', { noHatch: true });
        ctx.fillStyle = MAR.gold; for (const x of [-33, 33]) { ctx.beginPath(); ctx.arc(x, 0, 3, 0, TAU); ctx.fill(); ink(ctx, 0.8); }
        ctx.restore(); ctx.restore();
      }
      ctx.scale(spin, 1);
      const shade = (hex) => (spin < 0 ? U.mixHex(hex, '#2a0e3c', 0.25) : hex);
      // ---- needles (forearm extensions)
      const needle = (el, hd, back) => {
        const dx = hd.x - el.x, dy = hd.y - el.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, L = 50;
        const tip = { x: hd.x + ux * L, y: hd.y + uy * L };
        ctx.beginPath(); ctx.moveTo(hd.x - uy * 1.8, hd.y + ux * 1.8); ctx.lineTo(tip.x, tip.y); ctx.lineTo(hd.x + uy * 1.8, hd.y - ux * 1.8); ctx.closePath();
        ctx.fillStyle = back ? '#9aa0b4' : '#e6e9f2'; ctx.fill(); ink(ctx, 0.9);
        // needle eye threaded with gold
        ctx.strokeStyle = MAR.gold; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(hd.x + ux * 5, hd.y + uy * 5, 1.2, 2.6, Math.atan2(uy, ux) + PI / 2, 0, TAU); ctx.stroke();
        if (!back) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(hd.x + ux * 9 - uy * 0.6, hd.y + uy * 9 + ux * 0.6); ctx.lineTo(tip.x - ux * 6, tip.y - uy * 6); ctx.stroke(); }
        return tip;
      };
      const joint = (p, r = 2.6) => { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fillStyle = MAR.joint; ctx.fill(); ink(ctx, 0.8); ctx.fillStyle = 'rgba(255,220,190,0.55)'; ctx.beginPath(); ctx.arc(p.x + 0.8, p.y - 0.9, r * 0.35, 0, TAU); ctx.fill(); };
      const porc = shade(MAR.porc);
      // back arm + needle
      LC(ctx, [J.shB, J.elB, J.hdB], [3.2, 2.6, 1.9], U.mixHex(porc, '#6a5a70', 0.35));
      J.nB = needle(J.elB, J.hdB, true); joint(J.elB, 2.2);
      // back leg (pointe)
      const legW = [5.2, 4.4, 2.9, 2.5, 1.7];
      const leg = (knee, ank, col) => {
        LC(ctx, [J.hip, lp(J.hip, knee, 0.5), knee, lp(knee, ank, 0.5), ank], legW, col);
        // pointe shoe: satin, ribbons crossing the ankle
        const dx = ank.x - knee.x, dy = ank.y - knee.y, l = Math.hypot(dx, dy) || 1, toe = { x: ank.x + dx / l * 9, y: ank.y + dy / l * 9 };
        LB(ctx, ank, toe, 2.3, 1.5, shade('#f2a8b4'), { noHatch: true });
        ctx.strokeStyle = '#c45a74'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(ank.x - 2.4, ank.y - 3); ctx.lineTo(ank.x + 2.4, ank.y + 1); ctx.moveTo(ank.x + 2.4, ank.y - 3); ctx.lineTo(ank.x - 2.4, ank.y + 1); ctx.stroke();
        joint(knee, 2.4);
      };
      leg(J.kneeB, J.ankB, U.mixHex(porc, '#6a5a70', 0.3));
      // tutu — three tiers of torn tulle around the hips (flat disc seen side-on)
      const { Q, nx, ny, ang } = torsoQ(J);
      const tutu = (r, ry, col, n, off, back) => {
        ctx.save(); ctx.translate(J.hip.x, J.hip.y + 1); ctx.rotate(ang + PI / 2);
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = (back ? PI : 0) + (i / n) * PI, jag = (i % 2 ? 1 : 0.78) * (1 + Math.sin(i * 2.7 + off + t * 2) * 0.05);
          const x = Math.cos(a) * r * jag, y = Math.sin(a) * ry * jag * (back ? -1 : 1);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fillStyle = shade(col); ctx.fill(); ink(ctx, 1);
        ctx.restore();
      };
      tutu(40, 11, MAR.tutu[0], 22, 0, true);
      // bodice: porcelain chest above a crimson velvet corset with gilt boning
      const bod = [Q(-0.06, -6.5), Q(0.35, -5), Q(0.75, -7.5), Q(0.92, -6.5), Q(0.92, 7.5), Q(0.62, 7.5), Q(0.3, 5.5), Q(-0.06, 6.5)];
      ctx.beginPath(); ctx.moveTo(Q(0.8, -6).x, Q(0.8, -6).y); ctx.lineTo(Q(1.12, -4.5).x, Q(1.12, -4.5).y); ctx.lineTo(Q(1.12, 5).x, Q(1.12, 5).y); ctx.lineTo(Q(0.8, 8).x, Q(0.8, 8).y); ctx.closePath();
      ctx.fillStyle = porc; ctx.fill(); ink(ctx, 1);
      ctx.beginPath(); bod.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
      ctx.fillStyle = cel(ctx, Q(0.45, 0).x, Q(0.45, 0).y, nx, ny, 8, shade(MAR.velvet)); ctx.fill(); ink(ctx, 1.2);
      ctx.strokeStyle = MAR.gold; ctx.lineWidth = 0.7;
      for (const f of [-3, 0.5, 4]) { const a = Q(0.05, f), b = Q(0.86, f * 1.2); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      // the Hush heart: a rose-gold crystal set into the corset
      const hc = Q(0.6, 4.5);
      if (!ghost) lighter(ctx, () => K.glow(ctx, hc.x, hc.y, 14 + Math.sin(t * 3) * 2, MAR.col, 0.55));
      ctx.fillStyle = '#ffd9c4'; ctx.beginPath(); ctx.moveTo(hc.x, hc.y - 4.5); ctx.lineTo(hc.x + 2.6, hc.y); ctx.lineTo(hc.x, hc.y + 4); ctx.lineTo(hc.x - 2.6, hc.y); ctx.closePath(); ctx.fill(); ink(ctx, 0.7);
      // brass wind-up key in the back, still turning
      const kp = Q(0.62, -8), kr = Math.cos(t * (broken ? 0.8 : 3.2));
      ctx.save(); ctx.translate(kp.x, kp.y); ctx.rotate(ang + PI);
      LB(ctx, { x: 0, y: 0 }, { x: 9, y: 0 }, 1.3, 1.3, '#c89a4a', { noHatch: true });
      ctx.scale(1, kr || 0.05);
      ctx.beginPath(); ctx.ellipse(13, -4, 4.2, 3.6, 0, 0, TAU); ctx.ellipse(13, 4, 4.2, 3.6, 0, 0, TAU); ctx.fillStyle = kr > 0 ? '#e8b45a' : '#a8742e'; ctx.fill(); ink(ctx, 0.8);
      ctx.restore();
      tutu(41, 12, MAR.tutu[1], 24, 1.3, false);
      ctx.globalAlpha *= 0.75; tutu(36, 9, '#f4b8c4', 22, 3.7, false); ctx.globalAlpha /= 0.75;
      tutu(30, 7, MAR.tutu[2], 18, 2.1, false);
      // lace hem glints
      ctx.save(); ctx.translate(J.hip.x, J.hip.y + 1); ctx.rotate(ang + PI / 2); ctx.strokeStyle = 'rgba(255,224,230,0.8)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.ellipse(0, 0, 30, 7, 0, 0.1, PI - 0.1); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, 0, 37, 10, 0, 0.3, PI - 0.3); ctx.stroke(); ctx.restore();
      // front leg
      leg(J.kneeF, J.ankF, porc);
      // neck + head: porcelain mask-face with painted closed eye, a crack, one rose-gold tear
      const nk = Q(1.12, 0.5);
      LB(ctx, nk, J.head, 1.9, 1.7, porc, { noHatch: true });
      ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha); ctx.scale(1.25, 1.25);
      // hair bun + tiara behind
      ctx.fillStyle = MAR.hair; ctx.beginPath(); ctx.ellipse(-3.5, -3, 8.6, 9.6, 0, 0, TAU); ctx.fill(); ink(ctx, 1);
      ctx.beginPath(); ctx.arc(-8, -9.5, 5, 0, TAU); ctx.fill(); ink(ctx, 1);
      ctx.strokeStyle = 'rgba(255,190,200,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(-8, -9.5, 3.2, -2.4, -0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1, -9); ctx.quadraticCurveTo(-6, -11, -10, -6); ctx.stroke();
      // face
      const face = () => { ctx.beginPath(); ctx.moveTo(-1, -8.5); ctx.quadraticCurveTo(6, -9, 7.2, -2.5); ctx.lineTo(8.6, 0.4); ctx.lineTo(7.1, 1.2); ctx.quadraticCurveTo(7.3, 5.5, 3.5, 7.8); ctx.quadraticCurveTo(-0.5, 8.6, -1.6, 4); ctx.closePath(); };
      face(); ctx.fillStyle = porc; ctx.fill();
      ctx.save(); face(); ctx.clip(); ctx.fillStyle = U.mixHex(porc, '#7a4a6a', 0.35); ctx.beginPath(); ctx.moveTo(-2, -9); ctx.quadraticCurveTo(2.5, -1, 1.5, 9); ctx.lineTo(-3, 9); ctx.closePath(); ctx.fill(); ctx.restore();
      face(); ink(ctx, 1);
      ctx.fillStyle = 'rgba(232,96,120,0.45)'; ctx.beginPath(); ctx.arc(4.4, 2.4, 1.9, 0, TAU); ctx.fill();   // rouge
      ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(4.6, -1.8, 2.3, 0.15, PI - 0.4); ctx.stroke();   // closed, painted eye
      ctx.lineWidth = 0.5; for (let i = 0; i < 4; i++) { const a = 0.35 + i * 0.5; ctx.beginPath(); ctx.moveTo(4.6 + Math.cos(a) * 2.3, -1.8 + Math.sin(a) * 2.3); ctx.lineTo(4.6 + Math.cos(a) * 3.8, -1.8 + Math.sin(a) * 3.8); ctx.stroke(); }
      ctx.fillStyle = '#b02a4a'; ctx.beginPath(); ctx.ellipse(6.4, 4.6, 1.1, 0.7, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#6a5a5a'; ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(2, -8.4); ctx.lineTo(3.4, -4.6); ctx.lineTo(2.4, -2.8); ctx.lineTo(3.6, 0.5); ctx.stroke();   // crack
      if (!ghost) lighter(ctx, () => { K.glow(ctx, 4.8, 1.8, 7, MAR.col, 0.75); ctx.fillStyle = '#ffe8da'; ctx.beginPath(); ctx.ellipse(4.6, 1.3 + (t * 0.6 % 1) * 2, 0.8, 1.3, 0, 0, TAU); ctx.fill(); });
      // gilt tiara
      ctx.fillStyle = MAR.gold; ctx.beginPath(); ctx.moveTo(-6, -7.6); for (let i = 0; i <= 4; i++) { const x = -5 + i * 2.6; ctx.lineTo(x, -9.2 - (i % 2 ? 3.6 : 1.4)); ctx.lineTo(x + 1.3, -8.6); } ctx.lineTo(5, -7.8); ctx.closePath(); ctx.fill(); ink(ctx, 0.6);
      ctx.restore();
      // front arm + needle
      LC(ctx, [J.sh, J.elF, J.hdF], [3.4, 2.8, 2.1], porc);
      joint(J.sh, 3); joint(J.elF, 2.3);
      J.nF = needle(J.elF, J.hdF, false);
      if (e.tellT > 0) tellGlow(ctx, e, J.nF.x, J.nF.y, 24);
      ctx.restore();
      // whirl: the needles' circle, drawn flat while she spins
      if (!ghost && e.state === 'atk' && e.atk === T.pirouette) {
        for (const h of PIR) {
          const u = (e.st - (h - 0.1)) / 0.24;
          if (u > 0 && u < 1) {
            ctx.save(); ctx.translate(e.x, e.y + J.sh.y * s); ctx.scale(e.facing, 1);
            lighter(ctx, () => {
              ctx.strokeStyle = `rgba(255,214,190,${0.75 * (1 - u)})`; ctx.lineWidth = 7 * (1 - u) + 1;
              ctx.beginPath(); ctx.ellipse(0, 0, 94, 16, 0, -PI * 0.15 + u * 2, PI * 0.95 + u * 2); ctx.stroke();
              ctx.strokeStyle = `rgba(255,179,138,${0.5 * (1 - u)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 96, 18, 0, PI * 0.9 + u * 2, PI * 1.8 + u * 2); ctx.stroke();
            });
            ctx.restore();
          }
        }
      }
      drawBoxes(ctx, e);
    },
  };

  /* =========================================================================================
     c4_chorister 假面合唱 — a choir-ghost in a velvet cassock and lace surplice, a split comedy/tragedy mask,
     a halo of gilt staff lines. Support: sings a WARD onto allies (kill it or interrupt the song);
     note volley (white projectiles, parry reflects); close-range fortissimo burst (white).
     ========================================================================================= */
  const CHO = { s: 1.15, col: '#ffd36b', robe: '#7a1430', lace: '#efe6d8', gold: '#d9a441', hood: '#2a0f1e' };
  // a sung note: a gilt eighth-note glyph that flies straight; perfect guard sends it home to its singer
  function spawnNote(e, x, y, ang, sp) {
    G.game.hazards.push({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, owner: e, friendly: false, t: 0, life: 3.4, r: 10, rot: Math.random() * 0.6,
      update(h, dt, g) {
        h.x += h.vx * dt; h.y += h.vy * dt; h.rot += dt * 3;
        for (const s of G.Phys.allSolids()) if (h.x > s.x && h.x < s.x + s.w && h.y > s.y && h.y < s.y + s.h) h.done = true;
        if (h.done) { G.FX.spark(h.x, h.y, 8, { col: '#ffe9a8', speed: 300 }); return; }
        if (!h.friendly) {
          const hb = g.player.hurtbox;
          if (!h.passed && h.x + h.r > hb.x && h.x - h.r < hb.x + hb.w && h.y + h.r > hb.y && h.y - h.r < hb.y + hb.h) {
            const res = g.player.receiveHit(h, { dmg: 13, kb: 160, projectile: true, hx: h.x, hy: h.y });
            if (res === 'parried') { h.friendly = true; h.vx = -h.vx * 1.4; h.vy = -h.vy * 0.4 - 60; h.life = h.t + 2.5; G.FX.ring(h.x, h.y, 6, 60, 0.3, '#7ff4ff', 4); }
            else if (res === 'dodged') h.passed = true;
            else if (res !== 'ignored') { h.done = true; G.FX.spark(h.x, h.y, 10, { col: '#ffe9a8', speed: 360 }); }
          }
        } else {
          const o = h.owner;
          if (o && !o.dead) { const a = Math.atan2(o.cy - h.y, o.cx - h.x), sp2 = Math.hypot(h.vx, h.vy); h.vx = U.lerp(h.vx, Math.cos(a) * sp2, 0.12); h.vy = U.lerp(h.vy, Math.sin(a) * sp2, 0.12); }
          for (const en of g.enemies) {
            if (en.dead) continue; const b = en.box;
            if (h.x > b.x - h.r && h.x < b.x + b.w + h.r && h.y > b.y - h.r && h.y < b.y + b.h + h.r) {
              en.takeHit({ dmg: 26 * g.player.dmgMul, bal: 40, hx: h.x, hy: h.y, big: true }); h.done = true; g.hitstop(0.08); g.shake(0.4); G.SFX.play('hit', 1.2); break;
            }
          }
        }
        if (Math.random() < 0.5) G.FX.ember(h.x, h.y, 1, h.friendly ? '#7ff4ff' : CHO.col, { w: 6, h: 6, up: 20, sp: 20, life: 0.3 });
      },
      draw(ctx, h) {
        const col = h.friendly ? '#7ff4ff' : CHO.col, fill = h.friendly ? '#dffcff' : '#fff2c4';
        ctx.translate(h.x, h.y); ctx.rotate(Math.sin(h.rot) * 0.3);
        lighter(ctx, () => K.glow(ctx, 0, 0, 30, col, 0.5));
        // ♪ : filled head, stem, flag — inked
        ctx.beginPath(); ctx.moveTo(2.6, 3.5); ctx.lineTo(2.6, -14); ctx.quadraticCurveTo(10, -10, 9, -2); ink(ctx, 4.2);
        ctx.strokeStyle = fill; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-2, 5, 6.5, 4.6, -0.45, 0, TAU); ctx.fillStyle = fill; ctx.fill(); ink(ctx, 1.6);
        lighter(ctx, () => { ctx.strokeStyle = U.rgba(col, 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 13 + Math.sin(h.t * 18) * 1.5, 0, TAU); ctx.stroke(); });
      },
    });
  }
  TYPES.c4_chorister = {
    name: '假面合唱', en: 'MASKED CHORISTER', w: 48, h: 150, hp: 70, bal: 45, col: CHO.col, shards: 32, kbMul: 0.9, spawnT: 0.9,
    portrait: [2.0, 0.9],
    init(e) { e.wardCd = 2; e.sing = 0; },
    voice: (e) => G.SFX.play('c4_choir', e.atk === TYPES.c4_chorister.forte ? 5 : 0),
    weapon: (e) => ({ x: e.x + e.facing * 8 * CHO.s, y: e.y - 128 * CHO.s }),
    think(e, dt) {
      const T = TYPES.c4_chorister;
      e.faceP(); const d = e.distP(); e.wardCd -= dt;
      // keeps to its choir stall: drifts back when crowded, glides in when the target strays
      const want = d < 230 ? -1 : d > 430 ? 1 : 0;
      e.vx = U.approach(e.vx, e.facing * want * 120 * e.speedMul, 500 * dt);
      if (e.cd > 0) return;
      const allies = G.game.enemies.filter((o) => o !== e && !o.dead && o.state !== 'spawn' && !o.c4Ward && o.type !== 'c4_chorister' && Math.abs(o.x - e.x) < 600);
      if (d < 150) e.startAtk(T.forte);
      else if (allies.length && e.wardCd <= 0 && Math.random() < 0.7) { e.wardCd = 7; e.startAtk(T.ward); }
      else if (d < 680) e.startAtk(T.volley);
    },
    // three notes in a fan (white ×3)
    volley: {
      dur: 1.6, cd: 2.0, track: false, tells: [{ t: 0.26, c: 'white' }],
      ev: [0.78, 0.95, 1.12].map((t, i) => ({ t, fn: (e) => {
        const m = TYPES.c4_chorister.weapon(e), P = e.P, a = Math.atan2(P.y - 64 - m.y, P.x - m.x) + (i - 1) * 0.16;
        spawnNote(e, m.x + e.facing * 6, m.y + 6, a, 340); G.SFX.play('c4_note'); G.FX.ring(m.x, m.y, 4, 30, 0.25, CHO.col, 2);
      } })),
    },
    // fortissimo: it swells, then a burst of sound all around (white)
    forte: {
      dur: 1.3, cd: 1.6, trackWin: 0.3,
      tells: [{ t: 0.24, c: 'white' }],
      hits: [{ t0: 0.74, t1: 0.88, box: { x: -86, y: -170, w: 216, h: 170 }, dmg: 15, kb: 380, last: true, pbal: 34 }],
      ev: [{ t: 0.74, fn: (e) => { G.game.shake(0.25); G.SFX.play('c4_choir', 7); G.SFX.play('impact'); } }],
    },
    // the ward-song (no harm in itself; interrupt it!)
    ward: {
      dur: 1.9, cd: 1.4, track: false,
      ev: [
        { t: 0.05, fn: (e) => { const m = TYPES.c4_chorister.weapon(e); G.FX.star(m.x, m.y, CHO.col, 56, 0.45); G.SFX.play('c4_ward'); } },
        { t: 1.35, fn: (e) => {
          for (const o of G.game.enemies) if (o !== e && !o.dead && o.state !== 'spawn' && o.type !== 'c4_chorister' && Math.abs(o.x - e.x) < 600) {
            o.c4Ward = { src: e, hp: 34, max: 34, flash: 0.6, until: G.game.time + 10 };
            G.FX.ring(o.cx, o.cy, 10, Math.max(o.h, 90) * 0.6, 0.5, CHO.col, 4); G.FX.ember(o.cx, o.cy, 12, CHO.col, { w: o.w, h: o.h });
          }
          G.SFX.play('c4_ward');
        } },
      ],
    },
    draw(ctx, e, ghost) {
      const T = TYPES.c4_chorister, s = CHO.s, t = e.t, dt = G.game.dtVis;
      const atk = e.state === 'atk' ? e.atk : null, st = e.st, broken = e.state === 'broken';
      // song intensity drives the mouth, the halo, the book
      let sing = 0.15 + Math.max(0, Math.sin(t * 2.4)) * 0.15, lean = 0, swell = 0, raise = 0;
      if (atk === T.volley) { sing = st < 0.75 ? U.clamp(st / 0.6, 0, 1) : 0.7 + 0.3 * Math.abs(Math.sin(st * 18)); lean = st < 0.72 ? -0.12 * U.clamp(st / 0.6, 0, 1) : 0.06; }
      if (atk === T.forte) { swell = st < 0.74 ? U.easeInCubic(U.clamp(st / 0.7, 0, 1)) : Math.max(0, 1 - (st - 0.74) / 0.3); sing = st < 0.74 ? swell : 1; lean = st < 0.74 ? -0.16 * swell : 0.14 * swell; }
      if (atk === T.ward) { raise = U.clamp(st / 0.5, 0, 1) * (st > 1.6 ? Math.max(0, 1 - (st - 1.6) / 0.3) : 1); sing = 0.6 + 0.4 * Math.abs(Math.sin(st * 7)); lean = -0.1 * raise; }
      if (e.state === 'hurt' || e.state === 'recoil') { lean = -0.3 * Math.sin(Math.min(1, st / (e.hurtDur || 0.36)) * PI); sing = 0; }
      lean -= e.hitK * 0.3;
      e.sing = U.damp(e.sing || 0, sing, 14, dt);
      const fy = broken ? 2 : -12 + Math.sin(t * 1.8) * 3;
      // --- wards on allies + the golden tether back to the singer (stage only, never in the hit-flash pass)
      if (!ghost) for (const o of G.game.enemies) {
        const w = o.c4Ward; if (!w || w.src !== e) continue;
        if (o.dead || G.game.time > w.until) { o.c4Ward = null; continue; }
        w.flash = Math.max(0, w.flash - dt * 3);
        const rx = Math.max(o.w * 0.6 + 24, 46), ry = Math.max(o.h * 0.56 + 10, 50), cx = o.x, cy = o.y - o.h * 0.5, k = w.hp / w.max;
        lighter(ctx, () => {
          ctx.strokeStyle = U.rgba(CHO.col, 0.18 + 0.5 * w.flash); ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = U.rgba('#fff2c4', 0.55 + 0.4 * w.flash); ctx.lineWidth = 1.6;
          ctx.setLineDash([10 * k + 2, 7]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          for (let i = 0; i < 3; i++) { const a = t * 1.6 + i * TAU / 3; K.glow(ctx, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry * 0.9, 9, CHO.col, 0.7); }
          // tether: a thin gold staff line from its mask
          const m = T.weapon(e), mx = (m.x + cx) / 2, my = Math.min(m.y, cy) - 60;
          ctx.strokeStyle = U.rgba(CHO.col, 0.3); ctx.lineWidth = 1.2; ctx.setLineDash([3, 6]); ctx.lineDashOffset = t * 40;
          ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.quadraticCurveTo(mx, my, cx, cy - ry * 0.6); ctx.stroke(); ctx.setLineDash([]);
        });
      }
      ctx.save();
      const sink = K.emerge(ctx, e);
      ctx.translate(e.x, e.y + sink * 40); ctx.scale(e.facing * s, s);
      if (sink > 0) ctx.globalAlpha *= 1 - sink;
      dissolve(ctx, e, -160, 4, s, ghost);
      // soft dark mist pooling under the floating hem
      if (!ghost) { ctx.fillStyle = 'rgba(20,6,16,0.35)'; ctx.beginPath(); ctx.ellipse(0, -1, 38, 6, 0, 0, TAU); ctx.fill(); }
      ctx.translate(0, fy);
      ctx.rotate(lean + (broken ? 0.35 : 0));
      const sw = Math.sin(t * 1.6) * 4, sw2 = Math.sin(t * 2.3 + 1) * 3;
      ctx.scale(1 + swell * 0.05, 1 + swell * 0.06);
      // gilt staff-line halo behind the head (its silhouette tell: a music staff)
      const hx = 3, hy = -124;
      ctx.save(); ctx.translate(hx - 4, hy - 2);
      for (let i = 0; i < 5; i++) { const r = 22 + i * 3.4; ctx.strokeStyle = U.mixHex(CHO.gold, '#5a3a20', i * 0.1); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.92, -0.25, PI + 0.1, TAU - 0.1); ctx.stroke(); }
      const spin = t * (0.4 + e.sing * 1.6);
      ctx.fillStyle = CHO.gold;
      for (let i = 0; i < 4; i++) { const a = PI + 0.5 + i * 0.62 + Math.sin(spin + i) * 0.08, r = 24 + (i % 3) * 3.4; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r * 0.92, 2.6, 1.9, -0.4, 0, TAU); ctx.fill(); ink(ctx, 0.6); }
      ctx.restore();
      // velvet hood draped behind the mask
      ctx.beginPath(); ctx.moveTo(10, -138); ctx.quadraticCurveTo(-4, -146, -16, -134); ctx.quadraticCurveTo(-24, -112, -20, -96); ctx.lineTo(8, -98); ctx.closePath();
      ctx.fillStyle = cel(ctx, -6, -120, 1, 0, 14, CHO.hood); ctx.fill(); ink(ctx, 1.2);
      // cassock: a tall velvet bell, its hem drifting like smoke
      const robe = () => {
        ctx.beginPath(); ctx.moveTo(-13, -100); ctx.lineTo(13, -100);
        ctx.bezierCurveTo(22, -70, 28 + sw, -30, 34 + sw, 0);
        for (let i = 0; i <= 8; i++) { const x = 34 + sw - i * (66 + sw2 - sw) / 8; ctx.lineTo(x, (i % 2 ? 10 : 2) + Math.sin(t * 3 + i * 1.7) * 3); }
        ctx.bezierCurveTo(-28 + sw2, -30, -22, -70, -13, -100); ctx.closePath();
      };
      robe(); ctx.fillStyle = cel(ctx, 0, -50, 1, 0, 34, CHO.robe); ctx.fill(); ink(ctx, 1.4);
      // velvet folds + a gilt orphrey band down the front
      ctx.save(); robe(); ctx.clip();
      ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 1;
      for (const f of [-14, -4, 18]) { ctx.beginPath(); ctx.moveTo(f * 0.3, -60); ctx.quadraticCurveTo(f * 0.8 + sw * 0.5, -30, f + sw, 8); ctx.stroke(); }
      ctx.fillStyle = CHO.gold; ctx.beginPath(); ctx.moveTo(4, -96); ctx.lineTo(10, -96); ctx.lineTo(16 + sw, 12); ctx.lineTo(7 + sw, 12); ctx.closePath(); ctx.fill(); ink(ctx, 0.8);
      ctx.fillStyle = '#7a1430'; for (let i = 0; i < 5; i++) { const y = -40 + i * 10, x = 8.5 + (y + 96) / 106 * (3 + sw); ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x + 2, y); ctx.lineTo(x, y + 3); ctx.lineTo(x - 2, y); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      // lace surplice over it
      const sur = () => {
        ctx.beginPath(); ctx.moveTo(-15, -100); ctx.lineTo(15, -100); ctx.quadraticCurveTo(25, -78, 28 + sw * 0.5, -50);
        for (let i = 0; i < 10; i++) { const x = 28 + sw * 0.5 - i * 5.6; ctx.quadraticCurveTo(x - 2.8, -42 + (i % 2) * 2, x - 5.6, -50); }
        ctx.quadraticCurveTo(-22, -78, -15, -100); ctx.closePath();
      };
      sur(); ctx.fillStyle = cel(ctx, 0, -76, 1, 0, 26, CHO.lace); ctx.fill(); ink(ctx, 1.2);
      ctx.fillStyle = 'rgba(80,40,60,0.45)'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(28 + sw * 0.5 - i * 5.6 - 2.8, -53, 1.1, 0, TAU); ctx.fill(); }
      // bell sleeve + gloved hands holding the hymnal
      const bk = { x: 22 + raise * 4, y: -74 - raise * 26 + Math.sin(t * 2) * 1.5 };
      ctx.beginPath(); ctx.moveTo(4, -96); ctx.quadraticCurveTo(18, -92, bk.x - 2, bk.y + 2); ctx.lineTo(bk.x - 10, bk.y + 14); ctx.quadraticCurveTo(0, -70, -4, -88); ctx.closePath();
      ctx.fillStyle = cel(ctx, 10, -84, 0.7, -0.7, 12, CHO.lace); ctx.fill(); ink(ctx, 1.1);
      // hymnal: crimson leather, gilt edges, a page lifting in the draught
      ctx.save(); ctx.translate(bk.x, bk.y); ctx.rotate(-0.25 - raise * 0.3);
      ctx.fillStyle = '#5a0f22'; poly(ctx, [[-12, 2], [0, 6], [12, 2], [12, 5], [0, 9], [-12, 5]]); ctx.fill(); ink(ctx, 1);
      ctx.fillStyle = '#f2e8d4'; poly(ctx, [[-11, -6], [0, -1], [11, -6], [11, 3], [0, 7], [-11, 3]]); ctx.fill(); ink(ctx, 1);
      ctx.strokeStyle = 'rgba(60,30,40,0.6)'; ctx.lineWidth = 0.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-9, -3 + i * 2.4); ctx.lineTo(-2, 0 + i * 2.4); ctx.moveTo(2, 0 + i * 2.4); ctx.lineTo(9, -3 + i * 2.4); ctx.stroke(); }
      const pg = Math.sin(t * (1.5 + e.sing * 5)) * 0.5 + 0.5;
      ctx.fillStyle = '#fff8e6'; ctx.beginPath(); ctx.moveTo(0, -1); ctx.quadraticCurveTo(5, -10 - pg * 6, 10 - pg * 14, -6 - pg * 8); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill(); ink(ctx, 0.8);
      ctx.fillStyle = '#f4efe6'; ctx.beginPath(); ctx.ellipse(-12, 3, 3.4, 2.6, 0, 0, TAU); ctx.fill(); ink(ctx, 0.8); ctx.beginPath(); ctx.ellipse(12, 3, 3.4, 2.6, 0, 0, TAU); ctx.fill(); ink(ctx, 0.8);
      if (!ghost && e.sing > 0.4) lighter(ctx, () => K.glow(ctx, 0, -4, 18 + raise * 14, CHO.col, (e.sing - 0.4) * 0.8));
      ctx.restore();
      // millstone ruff: pleated lace disc at the throat
      ctx.save(); ctx.translate(2, -104);
      ctx.beginPath(); for (let i = 0; i <= 28; i++) { const a = (i / 28) * TAU, r = i % 2 ? 1 : 0.86; ctx.lineTo(Math.cos(a) * 25 * r, Math.sin(a) * 9 * r); } ctx.closePath();
      ctx.fillStyle = '#f6f0e4'; ctx.fill(); ink(ctx, 1.2);
      ctx.strokeStyle = 'rgba(90,60,80,0.55)'; ctx.lineWidth = 0.6;
      for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 3); ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 8); ctx.stroke(); }
      ctx.fillStyle = 'rgba(42,14,60,0.35)'; ctx.beginPath(); ctx.ellipse(0, 3, 24, 5, 0, 0, PI); ctx.fill();
      ctx.restore();
      // the mask: porcelain tragedy on the far side, gilt comedy on the near side
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(-lean * 0.6 + Math.sin(t * 1.1) * 0.05 + (broken ? 0.5 : 0));
      const maskP = () => { ctx.beginPath(); ctx.moveTo(0, -16); ctx.bezierCurveTo(12, -16, 15, -4, 13, 5); ctx.bezierCurveTo(11, 14, 4, 18, 0, 18); ctx.bezierCurveTo(-4, 18, -11, 14, -12, 5); ctx.bezierCurveTo(-14, -4, -11, -16, 0, -16); ctx.closePath(); };
      maskP(); ctx.fillStyle = '#f3ede2'; ctx.fill();
      ctx.save(); maskP(); ctx.clip();
      ctx.fillStyle = CHO.gold; ctx.beginPath(); ctx.moveTo(1, -17); ctx.lineTo(3, -8); ctx.lineTo(0, -2); ctx.lineTo(3, 5); ctx.lineTo(1, 19); ctx.lineTo(16, 19); ctx.lineTo(16, -17); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,190,0.7)'; ctx.beginPath(); ctx.ellipse(9, -9, 3, 5, 0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(70,30,80,0.3)'; ctx.beginPath(); ctx.ellipse(-9, 4, 5, 12, 0, 0, TAU); ctx.fill();
      ctx.restore();
      maskP(); ink(ctx, 1.4);
      // eyes: comedy crescent (near), tragedy droop (far)
      ctx.fillStyle = '#120812';
      ctx.beginPath(); ctx.moveTo(4, -4); ctx.quadraticCurveTo(7.5, -9, 11, -4); ctx.quadraticCurveTo(7.5, -6, 4, -4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-9, -7); ctx.quadraticCurveTo(-5.5, -2.5, -2, -6); ctx.quadraticCurveTo(-5.5, -1, -9, -7); ctx.fill();
      ctx.strokeStyle = '#7a5a6a'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-6, -1); ctx.quadraticCurveTo(-7, 4, -6, 7); ctx.stroke();   // painted tear
      // singing mouth
      const mo = 1.5 + e.sing * 4.5;
      ctx.fillStyle = '#120812'; ctx.beginPath(); ctx.ellipse(1.5, 9, 3 + e.sing * 1.5, mo, 0, 0, TAU); ctx.fill(); ink(ctx, 0.8);
      if (!ghost) lighter(ctx, () => { K.glow(ctx, 7.5, -5, 8, CHO.col, 0.6); K.glow(ctx, -5.5, -4.5, 6, CHO.col, 0.45); K.glow(ctx, 1.5, 9, 8 + e.sing * 16, CHO.col, 0.35 + e.sing * 0.5); });
      ctx.restore();
      // song ribbons: staff lines unspooling while it sings
      if (!ghost && e.sing > 0.45) lighter(ctx, () => {
        ctx.strokeStyle = U.rgba(CHO.col, (e.sing - 0.45) * 0.8); ctx.lineWidth = 0.9;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let x = 0; x <= 60; x += 6) { const y = hy + 10 + i * 3.5 + Math.sin(x * 0.12 - t * 8 + i) * (4 + x * 0.12); x ? ctx.lineTo(10 + x, y - x * 0.25) : ctx.moveTo(10, y); } ctx.stroke(); }
      });
      if (e.tellT > 0) tellGlow(ctx, e, hx + 2, hy + 6, 30);
      ctx.restore();
      // fortissimo: the burst drawn to its true reach
      if (!ghost && atk === T.forte && st > 0.72 && st < 0.95) {
        const u = (st - 0.72) / 0.23, cx = e.x + e.facing * 22, cy = e.y - 85;
        lighter(ctx, () => {
          ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - u)})`; ctx.lineWidth = 10 * (1 - u) + 2;
          ctx.beginPath(); ctx.ellipse(cx, cy, 30 + u * 100, 25 + u * 62, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = U.rgba(CHO.col, 0.6 * (1 - u)); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, 20 + u * 86, 18 + u * 54, 0, 0, TAU); ctx.stroke();
        });
      }
      // ward-song: gilt notes rising off the page
      if (live(ghost) && atk === T.ward && Math.random() < 0.5) G.FX.ember(e.x + e.facing * 26 * s, e.y - 100 * s, 2, CHO.col, { w: 30, h: 10, up: 160 });
      drawBoxes(ctx, e);
    },
  };

  /* =========================================================================================
     c4_pitwyrm 樂池鰻 — a blind-black eel of the flooded orchestra pit, a lace fan of gilt ribs on its skull,
     photophores along its flank. It carries its own pool of black water: submerged it is untouchable,
     a fin hunting under your feet → bursts up (red). Surfaced: lunge-bite (white), spit (white, parry reflects).
     ========================================================================================= */
  const WY = { s: 1.15, col: '#5ef2d6', skin: '#2b2140', belly: '#5d8f94', fan: '#3b1640', gold: '#d9a441' };
  const bez = (p0, p1, p2, p3, u) => { const v = 1 - u; return { x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x, y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y }; };
  TYPES.c4_pitwyrm = {
    name: '樂池鰻', en: 'PIT WYRM', w: 46, h: 150, hp: 100, bal: 60, col: WY.col, shards: 40, kbMul: 0.08, spawnT: 0.9,
    portrait: [1.9, 0.86],
    init(e) { e.sub = false; e.homeX = e.x; e.upT = 0; e.huntT = 0; e.upK = 1; e.jaw = 0.1; e.fanK = 0.6; e.hd = null; },
    voice: () => G.SFX.play('c4_eel'),
    weapon: (e) => (e.sub || (e.state === 'atk' && e.atk === TYPES.c4_pitwyrm.burst && e.st < 0.8)) ? { x: e.x, y: e.y - 24 } : e.hd ? { x: e.x + e.facing * e.hd.x * WY.s, y: e.y + e.hd.y * WY.s } : { x: e.x + e.facing * 40, y: e.y - 130 },
    think(e, dt) {
      const T = TYPES.c4_pitwyrm, P = e.P;
      if (e.sub) {
        // a fin cutting the black water toward your feet (leashed to its home pool)
        e.invuln = true; e.h = 18; e.huntT += dt;
        const tx = U.clamp(P.x, e.homeX - 560, e.homeX + 560), dx = tx - e.x;
        if (Math.abs(dx) > 4) e.facing = Math.sign(dx);
        e.vx = U.approach(e.vx, Math.abs(dx) > 16 ? Math.sign(dx) * 300 * e.speedMul : 0, 1500 * dt);
        if (live() && Math.random() < 0.3) G.FX.dust(e.x - e.facing * 20, e.y - 2, 1, { w: 20, speed: 60, size: 6, col: 'rgba(150,240,230,' });
        if (e.cd <= 0 && ((Math.abs(P.x - e.x) < 36 && Math.abs(P.y - e.y) < 70) || e.huntT > 2.8)) { e.vx = 0; e.startAtk(T.burst); }
        return;
      }
      e.invuln = false; e.h = 150; e.upT += dt;
      e.faceP(); e.vx = U.approach(e.vx, 0, 1200 * dt);
      if (e.cd > 0) return;
      const d = e.distP();
      if (e.upT > 4.2 || d > 640) e.startAtk(T.dive);
      else if (d < 190) e.startAtk(T.lunge);
      else if (d < 620 && Math.random() < 0.75) e.startAtk(T.spit);
      else e.startAtk(T.dive);
    },
    // erupts from under you (red) — the boil and the red star mark the spot
    burst: {
      dur: 1.55, cd: 0.9, track: false,
      tells: [{ t: 0.12, c: 'red', face: false }],
      hits: [{ t0: 0.78, t1: 0.98, box: { x: -56, y: -200, w: 112, h: 200 }, dmg: 22, red: true, kb: 380, last: true }],
      ev: [{ t: 0.78, fn: (e) => {
        e.sub = false; e.invuln = false; e.h = 150; e.upT = 0; e.huntT = 0;
        G.SFX.play('c4_splash', 1.2); G.SFX.play('c4_eel'); G.game.shake(0.35);
        G.FX.dust(e.x, e.y - 4, 22, { w: 70, speed: 380, size: 10, col: 'rgba(120,230,225,' }); G.FX.shards(e.x, e.y - 10, 10, WY.col, 520);
        G.FX.ring(e.x, e.y, 10, 110, 0.4, WY.col, 4, { flat: 0.2 });
      } }],
    },
    // coils back, then strikes forward out of the pool (white)
    lunge: {
      dur: 1.25, cd: 1.0, track: false,
      tells: [{ t: 0.2, c: 'white' }],
      hits: [{ t0: 0.68, t1: 0.84, box: { x: 4, y: -180, w: 180, h: 96 }, dmg: 16, kb: 280, last: true, pbal: 32 }],
      ev: [{ t: 0.66, fn: () => G.SFX.play('whoosh', 1.1) }],
    },
    // a glob of pit-water (white, parry reflects)
    spit: {
      dur: 1.3, cd: 1.1, track: false,
      tells: [{ t: 0.3, c: 'white' }],
      ev: [{ t: 0.82, fn: (e) => {
        const m = TYPES.c4_pitwyrm.weapon(e), P = e.P, a = Math.atan2(P.y - 60 - m.y, P.x - m.x);
        G.game.projectiles.push({ x: m.x, y: m.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: 10, owner: e, friendly: false, dmg: 14, life: 3, t: 0, col: WY.col });
        G.SFX.play('c4_splash', 0.4); G.FX.ring(m.x, m.y, 4, 34, 0.3, WY.col, 3);
      } }],
    },
    // sinks back into the black water
    dive: {
      dur: 0.8, cd: 0.5, track: false,
      ev: [{ t: 0.5, fn: (e) => { e.sub = true; e.invuln = true; e.h = 18; e.huntT = 0; G.SFX.play('c4_splash', 0.8); G.FX.dust(e.x, e.y - 4, 12, { w: 50, speed: 240, size: 8, col: 'rgba(120,230,225,' }); } }],
    },
    atkUpdate(e) {
      if (e.atk === TYPES.c4_pitwyrm.burst && e.st < 0.78 && live() && Math.random() < 0.6) G.FX.ember(e.x, e.y - 4, 1, WY.col, { w: 60, h: 4, up: 90, life: 0.4 });
    },
    draw(ctx, e, ghost) {
      const T = TYPES.c4_pitwyrm, s = WY.s, t = e.t, dt = G.game.dtVis;
      const atk = e.state === 'atk' ? e.atk : null, st = e.st, broken = e.state === 'broken';
      // how far out of the water, where the head wants to be, the jaw, the fan
      let up = e.sub ? 0 : 1, H = { x: 30 + Math.sin(t * 1.6) * 6, y: -128 + Math.sin(t * 2.1) * 5 }, jaw = 0.12 + Math.max(0, Math.sin(t * 1.3)) * 0.12, fan = 0.55;
      if (atk === T.burst) { const u = U.clamp((st - 0.74) / 0.16, 0, 1); up = st < 0.74 ? 0 : U.easeOutBack(u); H = { x: 10, y: -168 }; jaw = st < 1.0 ? 1 : 0.5; fan = 1; if (st > 1.0) { const v = U.clamp((st - 1.0) / 0.5, 0, 1); H = { x: U.lerp(10, 30, v), y: U.lerp(-168, -128, v) }; } }
      else if (atk === T.lunge) {
        if (st < 0.62) { const u = U.easeOutCubic(U.clamp(st / 0.5, 0, 1)); H = { x: U.lerp(30, -22, u), y: U.lerp(-128, -152, u) }; jaw = 0.3 + u * 0.5; fan = 0.6 + u * 0.4; }
        else if (st < 0.9) { const u = U.clamp((st - 0.62) / 0.07, 0, 1); H = { x: U.lerp(-22, 126, u), y: U.lerp(-152, -112, u) }; jaw = st < 0.8 ? 1 : 0.1; fan = 1; }
        else { const u = U.easeInOutSine(U.clamp((st - 0.9) / 0.35, 0, 1)); H = { x: U.lerp(126, 30, u), y: U.lerp(-112, -128, u) }; jaw = 0.2; }
      } else if (atk === T.spit) {
        const u = U.clamp(st / 0.75, 0, 1);
        if (st < 0.82) { H = { x: U.lerp(30, -10, u), y: U.lerp(-128, -150, u) }; jaw = 0.2 + u * 0.4; fan = 0.6 + u * 0.4; }
        else { const v = U.clamp((st - 0.82) / 0.3, 0, 1); H = { x: U.lerp(46, 30, v), y: U.lerp(-136, -128, v) }; jaw = 1 - v * 0.8; fan = 1; }
      } else if (atk === T.dive) { const u = U.easeInCubic(U.clamp((st - 0.2) / 0.4, 0, 1)); up = 1 - u; H = { x: U.lerp(30, 60, u), y: -128 }; fan = 0.3; jaw = 0.1; }
      if (e.state === 'hurt' || e.state === 'recoil') { const w = Math.sin(Math.min(1, st / (e.hurtDur || 0.36)) * PI); H = { x: H.x - 26 * w, y: H.y + 8 * w }; jaw = 0.7; fan = 1; }
      if (broken) { H = { x: 74, y: -20 + Math.sin(t * 2) * 2 }; jaw = 0.35; fan = 0.2; }
      if (e.state === 'spawn') up = 1 - K.emerge(ctx, e);
      if (e.state === 'die') up *= 1 - U.clamp(st / 0.5, 0, 1) * 0.7;
      H.x -= e.hitK * 18; H.y += e.hitK * 6;
      e.upK = (atk === T.burst || e.state === 'spawn' || !dt) ? up : U.damp(e.upK ?? up, up, 30, dt);
      e.jaw = U.damp(e.jaw ?? jaw, jaw, 18, dt); e.fanK = U.damp(e.fanK ?? fan, fan, 10, dt);
      const uk = Math.max(0, e.upK);
      const Hh = { x: H.x * Math.min(1, uk * 1.2), y: 14 + (H.y - 14) * uk };
      e.hd = { x: Hh.x + 22, y: Hh.y + 2 };
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.facing * s, s);
      const sub = e.sub && atk !== T.burst;
      const poolR = sub ? 42 : 64;
      // ---- the pool: black water with a moon-sheen, rippling
      if (!ghost) {
        ctx.fillStyle = '#05101a'; ctx.beginPath(); ctx.ellipse(0, 0, poolR, 9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(30,90,110,0.55)'; ctx.beginPath(); ctx.ellipse(-6, -1.5, poolR * 0.7, 4.5, 0, 0, TAU); ctx.fill();
        lighter(ctx, () => {
          ctx.strokeStyle = 'rgba(170,250,255,0.35)'; ctx.lineWidth = 1.2;
          for (let i = 0; i < 2; i++) { const k = (t * 0.7 + i * 0.5) % 1; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(0, 0, 14 + k * poolR, 2 + k * 7, 0, 0, TAU); ctx.stroke(); }
          ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(200,250,255,0.35)'; ctx.fillRect(-poolR * 0.5, -1.5, poolR * 0.45, 1.2);
          K.glow(ctx, 0, -2, poolR * 0.9, WY.col, sub ? 0.28 : 0.16);
        });
        // the boil before a burst
        if (atk === T.burst && st < 0.8) {
          const k = U.clamp(st / 0.7, 0, 1);
          lighter(ctx, () => { K.glow(ctx, 0, -4, 50 + k * 30, WY.col, 0.3 + k * 0.4); ctx.strokeStyle = U.rgba('#ffffff', 0.3 + 0.5 * k); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -1, 30 + k * 20, 4 + k * 3, 0, 0, TAU); ctx.stroke(); });
          ctx.fillStyle = 'rgba(190,250,250,0.8)';
          for (let i = 0; i < 7; i++) { const bx = Math.sin(i * 7.3 + t * 9) * 34 * k, by = -((t * 3 + i * 0.37) % 1) * 22 * k; ctx.beginPath(); ctx.arc(bx, by, 1.5 + (i % 3), 0, TAU); ctx.fill(); }
        }
      }
      // ---- submerged: only a fin and a wake
      if (sub && !broken) {
        const wob = Math.sin(t * 9) * 3;
        ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(-18, -14, -4 + wob, -28); ctx.quadraticCurveTo(4, -14, 10, 0); ctx.closePath();
        ctx.fillStyle = cel(ctx, -6, -12, 1, -0.3, 12, WY.skin); ctx.fill(); ink(ctx, 1.3);
        ctx.strokeStyle = WY.gold; ctx.lineWidth = 0.9; for (const k of [0.35, 0.65]) { ctx.beginPath(); ctx.moveTo(-26 + 36 * k, 0); ctx.lineTo(-8 + wob * k, -24 * (1 - Math.abs(k - 0.5))); ctx.stroke(); }
        if (!ghost) lighter(ctx, () => { ctx.fillStyle = U.rgba(WY.col, 0.9); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-18 + i * 9, -4 - i * 3, 1.3, 0, TAU); ctx.fill(); } });
        ctx.strokeStyle = 'rgba(190,250,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-30, -1); ctx.quadraticCurveTo(-50, -4, -70, -1); ctx.moveTo(-28, 1); ctx.quadraticCurveTo(-46, 3, -62, 2); ctx.stroke();
        ctx.restore(); drawBoxes(ctx, e); return;
      }
      // ---- the body: a bezier spine out of the water, clipped at the surface
      dissolve(ctx, e, -180, 6, s, ghost);
      const P0 = { x: -6, y: 18 }, P1 = { x: -26 + Math.sin(t * 1.4) * 6, y: -52 * uk }, P2 = { x: Hh.x - 40, y: Hh.y + 16 }, P3 = Hh;
      const N = 10, pts = [], ws = [];
      for (let i = 0; i < N; i++) { const u = i / (N - 1); pts.push(bez(P0, P1, P2, P3, u)); ws.push(U.lerp(17, 10, u)); }
      const nrm = (i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; return { x: -dy / d, y: dx / d }; };
      ctx.save(); ctx.beginPath(); ctx.rect(-260, -400, 520, 401.5); ctx.clip();
      // ragged dorsal frill down the spine (behind the body)
      ctx.beginPath();
      for (let i = 1; i < N - 1; i++) { const n = nrm(i), w = ws[i] + 7 + Math.sin(t * 6 + i) * 2; const q = { x: pts[i].x - n.x * w, y: pts[i].y - n.y * w }; i === 1 ? ctx.moveTo(pts[i].x, pts[i].y) : 0; ctx.lineTo(q.x, q.y); ctx.lineTo(pts[i].x - n.x * ws[i] * 0.6 + (pts[i + 1].x - pts[i].x) * 0.5, pts[i].y - n.y * ws[i] * 0.6 + (pts[i + 1].y - pts[i].y) * 0.5); }
      ctx.lineTo(pts[N - 1].x, pts[N - 1].y); ctx.closePath(); ctx.fillStyle = WY.fan; ctx.fill(); ink(ctx, 1);
      LC(ctx, pts, ws, WY.skin);
      // pale belly stripe, photophores along the flank
      ctx.strokeStyle = U.mixHex(WY.belly, '#1a2a40', 0.2); ctx.lineWidth = 3.4; ctx.lineCap = 'round';
      ctx.beginPath(); for (let i = 0; i < N; i++) { const n = nrm(i), w = ws[i] * 0.62; const q = { x: pts[i].x + n.x * w, y: pts[i].y + n.y * w }; i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); } ctx.stroke();
      if (!ghost) lighter(ctx, () => {
        ctx.fillStyle = U.rgba(WY.col, 0.95);
        for (let i = 1; i < N - 1; i++) { const n = nrm(i), pulse = 1.3 + 0.8 * Math.max(0, Math.sin(t * 5 - i * 0.8)); ctx.beginPath(); ctx.arc(pts[i].x - n.x * ws[i] * 0.15, pts[i].y - n.y * ws[i] * 0.15, pulse, 0, TAU); ctx.fill(); }
      });
      // ---- the head: needle-toothed jaw, a blind lantern eye, the opera-fan crest
      const a2 = pts[N - 2], ha = U.clamp(Math.atan2(Hh.y - a2.y, Hh.x - a2.x), -1.2, 0.9);
      ctx.save(); ctx.translate(Hh.x, Hh.y); ctx.rotate(ha * 0.75);
      const fk = e.fanK;
      ctx.save(); ctx.translate(-8, -7);
      const r0 = -PI * 0.98, r1 = U.lerp(-PI * 0.78, -PI * 0.36, fk), nr = 7;
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (let i = 0; i <= nr; i++) { const a = U.lerp(r0, r1, i / nr), L = 32 + (i % 2) * 4; ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); if (i < nr) { const am = U.lerp(r0, r1, (i + 0.5) / nr); ctx.lineTo(Math.cos(am) * 24, Math.sin(am) * 24); } }
      ctx.closePath(); ctx.fillStyle = WY.fan; ctx.fill(); ink(ctx, 1.1);
      ctx.strokeStyle = 'rgba(255,190,220,0.25)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(0, 0, 14, r0, r1); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 9, r0, r1); ctx.stroke();
      ctx.strokeStyle = WY.gold; ctx.lineWidth = 1.3; for (let i = 0; i <= nr; i++) { const a = U.lerp(r0, r1, i / nr), L = 32 + (i % 2) * 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); ctx.stroke(); }
      ctx.fillStyle = WY.gold; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill(); ink(ctx, 0.7);
      ctx.restore();
      // lower jaw (hinged)
      ctx.save(); ctx.translate(-6, 3); ctx.rotate(e.jaw * 0.75);
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(18, 2, 31, 1); ctx.lineTo(29, 4); ctx.quadraticCurveTo(14, 9, -4, 7); ctx.closePath();
      ctx.fillStyle = cel(ctx, 12, 3, 0, 1, 6, U.mixHex(WY.skin, WY.belly, 0.35)); ctx.fill(); ink(ctx, 1.1);
      ctx.fillStyle = '#f4f0e6'; for (let x = 6; x <= 27; x += 4) { ctx.beginPath(); ctx.moveTo(x, 0.5); ctx.lineTo(x + 1.4, -4.5); ctx.lineTo(x + 2.6, 0.8); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = U.rgba('#bff8f0', 0.7); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(2, 7); ctx.quadraticCurveTo(0, 18, 4 + Math.sin(t * 3) * 3, 26); ctx.moveTo(6, 7); ctx.quadraticCurveTo(7, 15, 11 + Math.sin(t * 3 + 1) * 3, 21); ctx.stroke();   // barbels like slack strings
      ctx.restore();
      if (!ghost && e.jaw > 0.3) lighter(ctx, () => K.glow(ctx, 12, 5, 14, WY.col, (e.jaw - 0.3) * 0.7));
      // skull + upper jaw
      ctx.beginPath(); ctx.moveTo(-15, -9); ctx.quadraticCurveTo(-4, -16, 10, -12); ctx.quadraticCurveTo(26, -8, 36, -1); ctx.lineTo(33, 2); ctx.quadraticCurveTo(14, 3, -6, 4); ctx.quadraticCurveTo(-16, 3, -15, -9); ctx.closePath();
      ctx.fillStyle = cel(ctx, 8, -5, 0.3, -1, 9, WY.skin); ctx.fill(); ink(ctx, 1.3);
      ctx.fillStyle = '#f4f0e6'; for (let x = 4; x <= 31; x += 4) { ctx.beginPath(); ctx.moveTo(x, 2.4); ctx.lineTo(x + 1.3, 7.5); ctx.lineTo(x + 2.6, 2.4); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 0.8; for (const x of [-11, -8, -5]) { ctx.beginPath(); ctx.arc(x, -2, 5, -0.9, 0.9); ctx.stroke(); }   // gills
      // blind lantern eye
      ctx.fillStyle = '#0a1418'; ctx.beginPath(); ctx.ellipse(7, -6, 4.4, 3.6, 0, 0, TAU); ctx.fill(); ink(ctx, 0.8);
      if (!ghost) lighter(ctx, () => { K.glow(ctx, 7, -6, 14, WY.col, 0.85); ctx.fillStyle = '#e8fffb'; ctx.beginPath(); ctx.ellipse(7.4, -6, 1.1, 2.6, 0, 0, TAU); ctx.fill(); });
      if (e.tellT > 0) tellGlow(ctx, e, 26, 0, 30);
      ctx.restore();
      ctx.restore();
      // ---- water lip in front of the body: foam ring where it breaks the surface
      if (!ghost) {
        const bx = bez(P0, P1, P2, P3, 0.12).x;
        ctx.strokeStyle = 'rgba(200,250,255,0.7)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(bx, 0, 21, 4, 0, 0.1, PI - 0.1); ctx.stroke();
        ctx.strokeStyle = 'rgba(11,6,18,0.9)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, 0, poolR, 9, 0, 0.05, PI - 0.05); ctx.stroke();
        lighter(ctx, () => { ctx.fillStyle = 'rgba(210,255,250,0.6)'; for (let i = 0; i < 4; i++) { const a = t * 2 + i * 1.7; ctx.beginPath(); ctx.arc(bx + Math.cos(a) * 18, -1 + Math.sin(a) * 2, 1.2, 0, TAU); ctx.fill(); } });
      }
      ctx.restore();
      drawBoxes(ctx, e);
    },
  };

  /* =========================================================================================
     c4_usher 帶位員 — an impossibly tall, stooped usher in a swallow-tail coat; under the top hat, nothing but two
     violet sparks. A brass crook carries a lantern of Hush-fire. Lantern sweep (white), overhead lantern smash
     (white, leaves a small fire), lantern hurl on its chain (red burst + a burning floor patch).
     ========================================================================================= */
  const USH = { s: 1.3, col: '#c77dff', coat: '#1d1a28', vest: '#7d1830', shirt: '#ece4d6', glove: '#f2eee6', brass: '#c9a04a', trouser: '#1b1822' };
  // an ornate brass lantern; origin = the ring it hangs from
  function drawLantern(ctx, rot, flick, ghost, col = USH.col) {
    ctx.save(); ctx.rotate(rot);
    if (!ghost) lighter(ctx, () => K.glow(ctx, 0, 19, 44, col, 0.45 + flick * 0.15));
    ctx.strokeStyle = USH.brass; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.stroke();
    ctx.fillStyle = cel(ctx, 0, 5, 1, 0, 8, USH.brass); poly(ctx, [[-3.5, 2.5], [3.5, 2.5], [8, 8], [-8, 8]]); ctx.fill(); ink(ctx, 1);
    // glass + flame
    ctx.fillStyle = 'rgba(70,30,110,0.75)'; ctx.fillRect(-7, 8, 14, 18);
    if (!ghost) lighter(ctx, () => {
      const h = 11 + flick * 3;
      ctx.fillStyle = U.rgba(col, 0.9); ctx.beginPath(); ctx.moveTo(0, 24); ctx.quadraticCurveTo(-5.5, 19, 0, 24 - h); ctx.quadraticCurveTo(5.5, 19, 0, 24); ctx.fill();
      ctx.fillStyle = '#fbe8ff'; ctx.beginPath(); ctx.moveTo(0, 24); ctx.quadraticCurveTo(-2.4, 21, 0, 24 - h * 0.55); ctx.quadraticCurveTo(2.4, 21, 0, 24); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(255,240,255,0.55)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(-5, 18); ctx.stroke();
    ctx.strokeStyle = USH.brass; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.rect(-7, 8, 14, 18); ctx.moveTo(0, 8); ctx.lineTo(0, 26); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.strokeRect(-7.8, 7.6, 15.6, 18.8);
    ctx.fillStyle = cel(ctx, 0, 28, 1, 0, 9, USH.brass); poly(ctx, [[-9, 26], [9, 26], [6, 31], [-6, 31]]); ctx.fill(); ink(ctx, 1);
    ctx.fillStyle = USH.brass; poly(ctx, [[-2, 31], [2, 31], [0, 37]]); ctx.fill(); ink(ctx, 0.7);
    ctx.restore();
  }
  // Hush-fire left on the floor: burns whoever stands in it (unblockable ticks)
  function firePatch(owner, x, y, w, life) {
    G.game.hazards.push({
      x, y, w, life, owner, t: 0, tick: 0, seed: Math.random() * 10,
      update(h, dt, g) {
        const P = g.player; h.tick -= dt;
        if (h.t > 0.15 && h.t < h.life - 0.25 && h.tick <= 0 && Math.abs(P.x - h.x) < h.w / 2 + 6 && Math.abs(P.y - h.y) < 26) {
          const r = P.receiveHit(h, { dmg: 7, unblockable: true, kb: 140, hx: P.x, hy: P.y - 24 });
          h.tick = r === 'hit' ? 0.6 : 0.12;
        }
        if (Math.random() < 0.35) G.FX.ember(h.x, h.y - 8, 1, USH.col, { w: h.w, h: 6, up: 110, life: 0.5 });
      },
      draw(ctx, h) {
        const a = Math.min(1, h.t / 0.15) * Math.min(1, (h.life - h.t) / 0.4), n = Math.max(4, Math.round(h.w / 16));
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(30,8,40,0.55)'; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.w / 2 + 6, 5, 0, 0, TAU); ctx.fill();
        lighter(ctx, () => {
          K.glow(ctx, h.x, h.y - 8, h.w * 0.7, USH.col, 0.35);
          for (let i = 0; i < n; i++) {
            const fx = h.x - h.w / 2 + (i + 0.5) * h.w / n, ht = (14 + 14 * Math.abs(Math.sin(h.t * 7 + i * 1.9 + h.seed))) * (i % 2 ? 0.8 : 1.1);
            ctx.fillStyle = U.rgba(USH.col, 0.75); ctx.beginPath(); ctx.moveTo(fx - 7, h.y); ctx.quadraticCurveTo(fx - 6, h.y - ht * 0.5, fx + Math.sin(h.t * 9 + i) * 3, h.y - ht); ctx.quadraticCurveTo(fx + 6, h.y - ht * 0.5, fx + 7, h.y); ctx.fill();
            ctx.fillStyle = 'rgba(250,225,255,0.8)'; ctx.beginPath(); ctx.moveTo(fx - 3, h.y); ctx.quadraticCurveTo(fx - 2, h.y - ht * 0.3, fx, h.y - ht * 0.55); ctx.quadraticCurveTo(fx + 2, h.y - ht * 0.3, fx + 3, h.y); ctx.fill();
          }
        });
        ctx.strokeStyle = U.rgba('#f0c8ff', 0.6); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.w / 2 + 4, 4, 0, 0, TAU); ctx.stroke();
      },
    });
  }
  // the thrown lantern: arcs on its chain, bursts where it lands (red), then reels back to the crook
  function hurlLantern(e) {
    const P = e.P, g = 2300, T = 0.62, hk = e.hookW || { x: e.x + e.facing * 90, y: e.y - 200 };
    let dx = (P.x + P.vx * 0.3) - e.x; dx = e.facing * U.clamp(dx * e.facing, 120, 540);
    const tx = e.x + dx, ty = G.Phys.groundBelow(tx, P.y - 200) - 12;
    const h = {
      x: hk.x, y: hk.y, vx: (tx - hk.x) / T, vy: (ty - hk.y - 0.5 * g * T * T) / T, owner: e, t: 0, life: 4, mode: 'fly', rot: 0,
      update(h, dt, gm) {
        const o = h.owner;
        if (o.dead) { o.lanternOut = false; h.done = true; return; }
        if (h.mode === 'fly') {
          h.vy += g * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += dt * 8 * Math.sign(h.vx || 1);
          const hb = gm.player.hurtbox, floor = G.Phys.groundBelow(h.x, h.y - 40);
          const touch = h.x + 12 > hb.x && h.x - 12 < hb.x + hb.w && h.y + 30 > hb.y && h.y < hb.y + hb.h;
          if (touch || h.y >= floor - 12) {
            h.y = Math.min(h.y, floor - 12); h.mode = 'reel'; h.x0 = h.x; h.y0 = h.y; h.rt = 0;
            gm.shake(0.45); G.SFX.play('c4_fire'); G.SFX.play('impact'); G.SFX.play('crystal', 3);
            G.FX.ring(h.x, floor, 10, 96, 0.4, USH.col, 6, { flat: 0.3 }); G.FX.flash(h.x, h.y, 120, 0.3, USH.col); G.FX.shards(h.x, h.y, 10, USH.col, 480);
            const P = gm.player;
            if (Math.abs(P.x - h.x) < 84 && P.y - floor > -60 && P.y - floor < 40) P.receiveHit(o, { dmg: 20, unblockable: true, kb: 320, hx: h.x, hy: P.y - 50 });
            firePatch(o, h.x, floor, 150, 3.2);
          }
        } else {
          h.rt += dt; const k = U.easeInCubic(Math.min(1, h.rt / 0.45)), to = o.hookW || { x: o.x, y: o.y - 200 };
          h.x = U.lerp(h.x0, to.x, k); h.y = U.lerp(h.y0, to.y, k) - Math.sin(k * PI) * 50; h.rot *= 0.9;
          if (k >= 1) { o.lanternOut = false; o.lanternH = null; h.done = true; }
        }
      },
      draw(ctx, h) {
        const o = h.owner, hk2 = o.hookW;
        if (hk2) { // the chain back to the crook
          ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 2.2; ctx.setLineDash([3, 2]);
          ctx.beginPath(); ctx.moveTo(hk2.x, hk2.y); ctx.quadraticCurveTo((hk2.x + h.x) / 2, Math.max(hk2.y, h.y) + 30, h.x, h.y); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.translate(h.x, h.y); ctx.scale(USH.s, USH.s); drawLantern(ctx, h.rot, Math.sin(h.t * 30) * 0.5 + 0.5, false);
      },
    };
    e.lanternOut = true; e.lanternH = h; G.game.hazards.push(h);
    G.SFX.play('whoosh', 1.3); G.SFX.play('c4_lantern');
  }
  const UPZ = {
    idle: (t) => { const br = Math.sin(t * 1.6); return { ry: 4 + br * 0.8, torso: 0.32 + br * 0.015, head: 0.2 + Math.sin(t * 0.7) * 0.05, tF: 0.16, kF: -0.2, tB: -0.2, kB: -0.15, aF: 0.35, eF: 1.25 + br * 0.03, aB: -0.4, eB: 1.9, sw: 3.05 + br * 0.02 }; },
    move: (e, dt) => {
      const p = stepGait(e, dt, 18, 'heavyStep'), f = gaitFoot(p, 18, 9), b = gaitFoot(p + PI, 18, 9);
      return { ik: 1, fFx: f.x + 3, fFy: f.y, fBx: b.x + 3, fBy: b.y, rx: 2, ry: 3 + 2 * -Math.cos(2 * p), torso: 0.36, head: 0.16, aF: 0.35, eF: 1.25, aB: -0.4 + 0.15 * Math.cos(p), eB: 1.9, sw: 3.05 + Math.sin(p) * 0.05 };
    },
    hurt: { ry: 6, torso: -0.05, head: -0.35, tF: 0.1, kF: -0.3, tB: -0.4, kB: -0.3, aF: 0.7, eF: 1.0, aB: -0.9, eB: 0.6, sw: 2.6 },
    snap: { torso: 0.0, head: -0.45 },
    broken: (t) => ({ ry: 32, torso: 0.72 + Math.sin(t * 1.5) * 0.04, head: 0.6, tF: 1.35, kF: -1.6, tB: -0.1, kB: -1.5, aF: 0.95, eF: 0.75, aB: -0.2, eB: 0.4, sw: 3.14 }),
    windS: { ry: 8, torso: 0.12, head: 0.1, tF: 0.4, kF: -0.5, tB: -0.45, kB: -0.25, aF: -1.0, eF: 0.5, aB: -0.2, eB: 1.2, sw: 3.95 },
    strS: { ry: 10, torso: 0.55, head: 0.25, tF: 0.75, kF: -0.8, tB: -0.6, kB: -0.15, aF: 1.5, eF: 0.0, aB: -0.6, eB: 0.6, sw: 1.75 },
    folS: { ry: 10, torso: 0.6, head: 0.25, tF: 0.75, kF: -0.8, tB: -0.6, kB: -0.15, aF: 1.1, eF: 0.0, aB: -0.6, eB: 0.6, sw: 0.95 },
    windSl: { ry: 2, torso: -0.12, head: -0.25, tF: 0.3, kF: -0.3, tB: -0.3, kB: -0.2, aF: 2.95, eF: 0.15, aB: 2.5, eB: 0.4, sw: 3.3, hold: 1 },
    strSl: { ry: 18, torso: 0.8, head: 0.3, tF: 0.9, kF: -1.1, tB: -0.6, kB: -0.4, aF: 1.25, eF: 0.0, aB: 1.1, eB: 0.2, sw: 1.25, hold: 1 },
    windH: { ry: 8, torso: 0.02, head: 0.0, tF: 0.4, kF: -0.5, tB: -0.5, kB: -0.25, aF: -1.25, eF: 0.4, aB: 0.4, eB: 0.8, sw: 4.15 },
    throwH: { ry: 10, torso: 0.6, head: 0.15, tF: 0.8, kF: -0.85, tB: -0.6, kB: -0.15, aF: 2.05, eF: 0.0, aB: -0.7, eB: 0.6, sw: 2.05 },
  };
  TYPES.c4_usher = {
    name: '帶位員', en: 'USHER', w: 40, h: 190, hp: 140, bal: 90, col: USH.col, shards: 46, poise: true, kbMul: 0.55, spawnT: 1.0, scale: USH.s,
    portrait: [1.45, 0.94],
    init(e) { e.tailA = new Rig.Chain(6, 9, 0.09, 0.86); e.tailB = new Rig.Chain(6, 8.5, 0.09, 0.86); e.lAng = 0; e.lVel = 0; e.lanternOut = false; e.hurlCd = 1.2; },
    voice: () => G.SFX.play('c4_lantern'),
    weapon: (e) => e.lantW || { x: e.x + e.facing * 60, y: e.y - 160 },
    think(e, dt) {
      const T = TYPES.c4_usher;
      e.faceP(); const d = e.distP(); e.hurlCd -= dt;
      // an unhurried stalk to just inside crook reach
      const want = d > 175 ? 1 : d < 105 ? -1 : 0;
      e.vx = U.approach(e.vx, e.facing * want * 95 * e.speedMul, 600 * dt);
      if (e.cd > 0) return;
      if (d < 205) e.startAtk(Math.random() < 0.6 ? T.swing : T.slam);
      else if (d < 560 && e.hurlCd <= 0 && !e.lanternOut) { e.hurlCd = 4.5; e.startAtk(T.hurl); }
    },
    // the lantern swept through a wide arc (white)
    swing: {
      dur: 1.55, cd: 1.3, tells: [{ t: 0.26, c: 'white' }],
      poses: { dur: 1.55, keys: [[0, UPZ.idle(0)], [0.6, UPZ.windS], [0.8, UPZ.strS, 'snap'], [1.0, UPZ.folS, 'out'], [1.55, UPZ.idle(0), 'io']] },
      moves: [{ t0: 0.72, t1: 0.82, v: 160 }],
      hits: [{ t0: 0.76, t1: 0.92, box: { x: 0, y: -200, w: 190, h: 165 }, dmg: 18, kb: 320, last: true, pbal: 40 }],
      ev: [{ t: 0.74, fn: () => { G.SFX.play('whoosh', 0.8); G.SFX.play('c4_lantern'); } }],
    },
    // both hands up, the lantern brought down on your head (white) — it splashes a little fire
    slam: {
      dur: 1.75, cd: 1.5, tells: [{ t: 0.4, c: 'white' }],
      poses: { dur: 1.75, keys: [[0, UPZ.idle(0)], [0.7, UPZ.windSl], [0.96, UPZ.strSl, 'snap'], [1.35, UPZ.strSl], [1.75, UPZ.idle(0), 'io']] },
      hits: [{ t0: 0.94, t1: 1.08, box: { x: 30, y: -130, w: 158, h: 130 }, dmg: 20, kb: 300, last: true, pbal: 46 }],
      ev: [{ t: 0.98, fn: (e) => {
        const x = e.x + e.facing * 160, y = G.Phys.groundBelow(x, e.y - 60);
        G.game.shake(0.45); G.SFX.play('impact'); G.SFX.play('c4_fire');
        G.FX.ring(x, y, 8, 70, 0.35, USH.col, 4, { flat: 0.25 }); G.FX.dust(x, y, 12, { w: 40, speed: 200, size: 9 });
        if (y < 1e8) firePatch(e, x, y, 70, 1.6);
      } }],
    },
    // the lantern flung on its chain (red where it lands)
    hurl: {
      dur: 2.0, cd: 1.4, track: false, tells: [{ t: 0.3, c: 'red' }],
      poses: { dur: 2.0, keys: [[0, UPZ.idle(0)], [0.72, UPZ.windH], [0.84, UPZ.throwH, 'snap'], [1.5, UPZ.throwH], [2.0, UPZ.idle(0), 'io']] },
      ev: [{ t: 0.84, fn: (e) => hurlLantern(e) }],
    },
    onHit(e) { if (Math.random() < 0.4) G.SFX.play('c4_lantern'); },
    draw(ctx, e, ghost) {
      const dt = G.game.dtVis, s = USH.s, t = e.t;
      rigPose(e, dt, Object.assign({ ground: true }, UPZ));
      const J = Rig.compute(e.pose); e.J = J;
      const { Q, nx, ny } = torsoQ(J);
      // pole geometry (local): a brass crook gripped mid-shaft, the hook curling forward at the top
      const u = { x: Math.sin(J.sw), y: Math.cos(J.sw) }, hd = J.hdF;
      const bot = { x: hd.x - u.x * 50, y: hd.y - u.y * 50 }, top = { x: hd.x + u.x * 68, y: hd.y + u.y * 68 };
      const pr = { x: u.y, y: -u.x };   // perpendicular (forward side when the pole points up)
      const hook = { x: top.x + u.x * 6 + pr.x * 9, y: top.y + u.y * 6 + pr.y * 9 }, hang = { x: top.x + pr.x * 13, y: top.y + pr.y * 13 };
      const toW = (p) => ({ x: e.x + e.facing * p.x * s, y: e.y + p.y * s });
      e.hookW = toW(hang);
      // lantern pendulum, driven by the crook's motion
      if (dt > 0) {
        const hw = e.hookW;
        if (e.prevHook) {
          const vx = (hw.x - e.prevHook.x) / dt;
          const ax = e.prevHV != null ? (vx - e.prevHV) / dt : 0; e.prevHV = vx;
          const acc = -16 * Math.sin(e.lAng) - 2.6 * e.lVel - U.clamp(ax * e.facing, -9000, 9000) * 0.0011;
          e.lVel += acc * dt; e.lAng = U.clamp(e.lAng + e.lVel * dt, -1.3, 1.3);
        }
        e.prevHook = { x: hw.x, y: hw.y };
      }
      const flick = 0.5 + 0.5 * Math.sin(t * 13) * Math.sin(t * 7.3);
      // coat tails (world chains)
      const anc = toW(Q(0.05, -7));
      e.tailA.update(anc.x, anc.y, e.facing, dt, -e.vx * 3 + Math.sin(t * 1.3) * 120, 2.95);
      e.tailB.update(anc.x + e.facing * 3, anc.y + 2, e.facing, dt, -e.vx * 3 + Math.sin(t * 1.3 + 0.6) * 120, 3.05);
      ctx.save();
      const sink = K.emerge(ctx, e) * 200;
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing * s, s);
      dissolve(ctx, e, -150, 4, s, ghost);
      const L = (c) => c.p.map((q) => ({ x: (q.x - e.x) * e.facing / s, y: (q.y - e.y - sink) / s }));
      for (const [c, w0, w1] of [[e.tailB, 4, 3.2], [e.tailA, 4.6, 3.6]]) {
        if (!c.inited) continue;
        const pts = L(c);
        Rig.ribbon(ctx, pts, w0, w1, U.mixHex(USH.coat, '#000000', 0.2)); ink(ctx, 1.1);
        Rig.ribbon(ctx, pts.map((q) => ({ x: q.x + 1.2, y: q.y })), w0 * 0.35, w1 * 0.3, '#3a1030');
      }
      // back arm (folded at the small of the back) + glove
      LC(ctx, [J.shB, J.elB, J.hdB], [3.4, 3.0, 2.4], U.mixHex(USH.coat, '#000000', 0.25));
      LB(ctx, J.hdB, lp(J.elB, J.hdB, 1.12), 2.6, 2.2, U.mixHex(USH.glove, '#6a6a80', 0.35), { noHatch: true });
      // back leg
      const legW = [4.6, 4.0, 3.1, 2.9, 2.2];
      const leg = (knee, ank, toe, col) => {
        LC(ctx, [J.hip, lp(J.hip, knee, 0.5), knee, lp(knee, ank, 0.5), ank], legW, col);
        LB(ctx, lp(knee, ank, 0.82), ank, 3.2, 3.0, U.mixHex('#ddd6c8', col, 0.25), { noHatch: true });   // spats
        LB(ctx, ank, { x: toe.x + 3, y: toe.y + 0.5 }, 3.2, 2.2, '#0f0d14', { spec: 0.6, noHatch: true });   // patent shoe
      };
      leg(J.kneeB, J.ankB, J.toeB, U.mixHex(USH.trouser, '#000000', 0.2));
      // the crook's lower shaft (behind the body)
      LB(ctx, bot, hd, 1.6, 1.8, USH.brass, { noHatch: true });
      // torso: swallow-tail coat, crimson waistcoat, white shirtfront, bow tie, watch chain
      const coat = [Q(-0.08, -8), Q(0.45, -7), Q(0.95, -9.5), Q(1.14, -5), Q(1.12, 6), Q(0.7, 7.5), Q(0.15, 8.5), Q(-0.08, 7)];
      ctx.beginPath(); coat.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
      ctx.fillStyle = cel(ctx, Q(0.5, 0).x, Q(0.5, 0).y, nx, ny, 10, USH.coat); ctx.fill(); ink(ctx, 1.3);
      const vest = [Q(0.0, 2), Q(0.88, 2.5), Q(0.88, 7), Q(0.45, 7.8), Q(0.0, 8)];
      ctx.beginPath(); vest.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
      ctx.fillStyle = cel(ctx, Q(0.45, 5).x, Q(0.45, 5).y, nx, ny, 4, USH.vest); ctx.fill(); ink(ctx, 0.9);
      ctx.fillStyle = USH.shirt; poly(ctx, [[Q(0.78, 3).x, Q(0.78, 3).y], [Q(1.12, 3).x, Q(1.12, 3).y], [Q(1.12, 6.5).x, Q(1.12, 6.5).y], [Q(0.88, 6.8).x, Q(0.88, 6.8).y]]); ctx.fill(); ink(ctx, 0.8);
      ctx.fillStyle = USH.brass; for (const a of [0.2, 0.42, 0.64]) { const p = Q(a, 6.2); ctx.beginPath(); ctx.arc(p.x, p.y, 1.1, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = USH.brass; ctx.lineWidth = 0.6; { const a = Q(0.35, 6), b = Q(0.3, 2.5); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2 - nx * 2, (a.y + b.y) / 2 + 3, b.x, b.y); ctx.stroke(); }
      // satin lapel
      ctx.strokeStyle = 'rgba(160,140,200,0.55)'; ctx.lineWidth = 1; { const a = Q(1.08, 2.4), b = Q(0.62, 2.2); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      // front leg
      leg(J.kneeF, J.ankF, J.toeF, USH.trouser);
      // neck, wing collar, bow tie
      const nk = Q(1.12, 1.5);
      LB(ctx, nk, lp(nk, J.head, 0.6), 2.4, 2.2, '#0b0810', { noHatch: true });
      { const c = Q(1.1, 4.5); ctx.fillStyle = '#f4efe6'; poly(ctx, [[c.x - 3, c.y + 2], [c.x + 4, c.y - 3], [c.x + 5, c.y + 1]]); ctx.fill(); ink(ctx, 0.7);
        ctx.fillStyle = '#120c18'; poly(ctx, [[c.x - 1, c.y + 3.5], [c.x + 4, c.y + 1], [c.x + 4, c.y + 6], [c.x + 1.5, c.y + 3.6], [c.x - 1, c.y + 6.5]]); ctx.fill(); }
      // head: a void under the hat; two violet sparks and a thin crescent of a smile
      ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
      ctx.fillStyle = '#07050a'; ctx.beginPath(); ctx.ellipse(1, 1, 7.5, 9.5, 0.1, 0, TAU); ctx.fill(); ink(ctx, 1);
      if (!ghost) lighter(ctx, () => {
        const blink = (Math.sin(t * 0.9) > 0.97) ? 0.2 : 1;
        K.glow(ctx, 5, -1.5, 9, USH.col, 0.8);
        ctx.fillStyle = '#f6e2ff'; ctx.beginPath(); ctx.ellipse(3.2, -1.6, 1.5, 0.9 * blink, 0, 0, TAU); ctx.ellipse(7.2, -1.2, 1.2, 0.8 * blink, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = U.rgba(USH.col, 0.7); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(4, 1.5, 4, 0.35, 1.5); ctx.stroke();
      });
      // top hat: tall crown, violet band, a ticket stub tucked in it
      ctx.translate(0, -7); ctx.rotate(-0.12);
      const crown = [[-8, 0], [-7.2, -24], [9.2, -24.5], [8.4, 0]];
      ctx.fillStyle = cel(ctx, 0, -12, 1, 0, 9, '#17131f'); poly(ctx, crown); ctx.fill(); ink(ctx, 1.2);
      ctx.fillStyle = '#4a1e6a'; poly(ctx, [[-8, -1], [-7.8, -5], [8.6, -5], [8.4, -1]]); ctx.fill(); ink(ctx, 0.7);
      ctx.fillStyle = '#efe0c4'; ctx.save(); ctx.translate(-5, -8); ctx.rotate(-0.25); ctx.fillRect(-2, -5, 5, 8); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.strokeRect(-2, -5, 5, 8);
      ctx.strokeStyle = '#a02040'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-1, -3); ctx.lineTo(2, -3); ctx.moveTo(-1, -1); ctx.lineTo(2, -1); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = 'rgba(200,190,230,0.4)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(5.5, -22); ctx.lineTo(5.2, -7); ctx.stroke();
      ctx.fillStyle = '#120e18'; ctx.beginPath(); ctx.ellipse(0.5, 0, 14, 3.2, 0, 0, TAU); ctx.fill(); ink(ctx, 1);
      ctx.restore();
      // the crook: brass shaft and hook
      LB(ctx, hd, top, 1.8, 1.6, USH.brass, { noHatch: true, spec: 0.5 });
      ctx.strokeStyle = INK; ctx.lineWidth = 4.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.quadraticCurveTo(hook.x + u.x * 4, hook.y + u.y * 4, hang.x, hang.y); ctx.stroke();
      ctx.strokeStyle = USH.brass; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.fillStyle = USH.brass; ctx.beginPath(); ctx.arc(bot.x, bot.y, 2.4, 0, TAU); ctx.fill(); ink(ctx, 0.8);
      // the lantern on its short chain
      if (!e.lanternOut) {
        const la = e.lAng + (e.state === 'broken' ? 0.2 : 0);
        ctx.strokeStyle = '#3a2c20'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 1.5]);
        const lr = { x: hang.x + Math.sin(-la) * 10 * e.facing * 0 + Math.sin(la) * 10, y: hang.y + Math.cos(la) * 10 };
        ctx.beginPath(); ctx.moveTo(hang.x, hang.y); ctx.lineTo(lr.x, lr.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.save(); ctx.translate(lr.x, lr.y); drawLantern(ctx, -la, flick, ghost); ctx.restore();
        e.lantW = toW({ x: lr.x - Math.sin(la) * 18, y: lr.y + 18 });
      } else e.lantW = e.lanternH ? { x: e.lanternH.x, y: e.lanternH.y } : e.hookW;
      // front arm, white glove fist on the shaft
      LC(ctx, [J.sh, J.elF, J.hdF], [3.6, 3.1, 2.6], USH.coat);
      LB(ctx, { x: hd.x - u.x * 3, y: hd.y - u.y * 3 }, { x: hd.x + u.x * 3, y: hd.y + u.y * 3 }, 3.2, 3.0, USH.glove, { noHatch: true });
      ctx.restore();
      if (e.tellT > 0 && e.lantW) tellGlow(ctx, e, e.lantW.x, e.lantW.y, 34);
      drawBoxes(ctx, e);
    },
  };

  /* =========================================================================================
     c4_elite 首席小提琴・瓦倫丁 VALENTIN, THE CONCERTMASTER — Descent IV's first violin. A duelist in a white
     concert coat and crimson half-cape, a porcelain half-mask, a violin in one hand and a bow honed into a rapier.
     Spiccato thrusts (W W W) · Pizzicato feint (pluck… pause… lunge, W) · Martelé dash (RED) · Tremolo sound-blade
     (W, ranged) · Glissando sweeps (W W) · P2 (≤50%): the mask cracks, crimson strings unfurl from his back,
     Cadenza (W W … R) and double tremolo.
     ========================================================================================= */
  const VAL = { s: 1.3, col: '#ff4766', coat: '#e9e2d6', coatB: '#b9b0a6', cape: '#9a1630', trouser: '#1c1626', boot: '#141018', gold: '#e2b04f', hair: '#e4e1ec', wood: '#a3401f', BL: 88 };
  const VP = {
    idle: (t) => { const br = Math.sin(t * 2); return { ry: 7 + br * 0.8, torso: 0.08 + br * 0.01, head: -0.05, tF: 0.5, kF: -0.6, tB: -0.55, kB: -0.15, aF: 1.25 + Math.sin(t * 2.3) * 0.04, eF: 0.25, aB: -0.3, eB: 0.25, sw: 1.42 + Math.sin(t * 2.3) * 0.07 }; },
    move: (e, dt) => {
      const p = stepGait(e, dt, 16, 'step'), f = gaitFoot(p, 12, 7), b = gaitFoot(p + PI, 12, 7);
      return { ik: 1, fFx: f.x + 18, fFy: f.y, fBx: b.x - 14, fBy: b.y, rx: 0, ry: 7 + 1.5 * -Math.cos(2 * p), torso: 0.12, head: -0.08, aF: 1.25, eF: 0.25, aB: -0.3, eB: 0.25, sw: 1.42 };
    },
    hurt: { ry: 6, torso: -0.35, head: 0.4, tF: 0.3, kF: -0.4, tB: -0.6, kB: -0.3, aF: 0.6, eF: 0.9, aB: -1.0, eB: 1.0, sw: 2.2 },
    snap: { torso: -0.4, head: 0.5, aF: 0.9 },
    broken: (t) => ({ ry: 30, torso: 0.9 + Math.sin(t * 2) * 0.04, head: 0.5, tF: 1.25, kF: -1.5, tB: -0.05, kB: -1.6, aF: 0.45, eF: 0.25, aB: -0.3, eB: 0.6, sw: 0.25 }),
    thW: { ry: 8, torso: -0.05, head: -0.05, tF: 0.4, kF: -0.55, tB: -0.6, kB: -0.15, aF: 0.75, eF: 1.5, aB: -0.6, eB: 0.4, sw: 1.52 },
    thH: { ry: 16, torso: 0.38, head: -0.25, tF: 1.05, kF: -0.95, tB: -1.0, kB: -0.05, aF: 1.55, eF: 0.0, aB: -1.2, eB: 0.3, sw: 1.55 },
    fake: { ry: 12, torso: 0.2, head: -0.15, tF: 0.75, kF: -0.8, tB: -0.8, kB: -0.1, aF: 1.4, eF: 0.25, aB: -0.9, eB: 0.3, sw: 1.75 },
    slU: { ry: 6, torso: -0.1, head: -0.1, tF: 0.45, kF: -0.55, tB: -0.5, kB: -0.2, aF: 2.8, eF: 0.4, aB: -0.6, eB: 0.5, sw: 3.7 },
    slD: { ry: 14, torso: 0.55, head: 0.0, tF: 0.9, kF: -0.95, tB: -0.65, kB: -0.15, aF: 1.1, eF: 0.0, aB: -0.9, eB: 0.4, sw: 0.95 },
    lowC: { ry: 20, torso: 0.6, head: -0.2, tF: 0.9, kF: -1.3, tB: -0.7, kB: -0.6, aF: 0.35, eF: 0.1, aB: -1.0, eB: 0.4, sw: 0.55 },
    upC: { ry: -4, torso: -0.2, head: -0.3, tF: 0.6, kF: -0.3, tB: -0.4, kB: -0.1, aF: 2.95, eF: 0.1, aB: -0.8, eB: 0.4, sw: 3.35 },
    marW: { ry: 22, torso: 0.45, head: -0.3, tF: 0.8, kF: -1.35, tB: -0.75, kB: -0.6, aF: -0.2, eF: 1.7, aB: -1.4, eB: 0.5, sw: 1.55 },
    marH: { ry: 22, torso: 0.55, head: -0.35, tF: 1.25, kF: -0.8, tB: -1.2, kB: 0.0, aF: 1.6, eF: 0.0, aB: -1.6, eB: 0.3, sw: 1.6 },
    play: (k = 0) => ({ ry: 6, torso: 0.0, head: 0.45, tF: 0.35, kF: -0.4, tB: -0.4, kB: -0.15, aF: 0.62 + Math.sin(k) * 0.22, eF: 1.35 - Math.sin(k) * 0.25, aB: 1.3, eB: 0.55, sw: 1.85 }),
  };
  const thrust = (t, dmg, last) => ({ t0: t, t1: t + 0.13, box: { x: 0, y: -132, w: 186, h: 56 }, dmg, kb: last ? 300 : 200, last, pbal: last ? 50 : 26 });
  const VA = {
    spiccato: {
      dur: 2.2, cd: 0.9, tells: [0.15, 0.63, 1.11].map((t) => ({ t, c: 'white' })),
      poses: { dur: 2.2, keys: [[0, VP.idle(0)], [0.45, VP.thW], [0.6, VP.thH, 'snap'], [0.85, VP.thW], [1.08, VP.thH, 'snap'], [1.33, VP.thW], [1.56, VP.thH, 'snap'], [2.2, VP.idle(0), 'io']] },
      moves: [{ t0: 0.54, t1: 0.62, v: 300 }, { t0: 1.02, t1: 1.1, v: 280 }, { t0: 1.5, t1: 1.6, v: 380 }],
      hits: [thrust(0.6, 14, false), thrust(1.08, 14, false), thrust(1.56, 18, true)],
      ev: [0.58, 1.06, 1.54].map((t, i) => ({ t, fn: () => { G.SFX.play('c4_slice'); G.SFX.play('c4_violin', 1 + i * 0.12, 0.12); } })),
    },
    feint: {
      dur: 2.3, cd: 1.0, tells: [{ t: 1.05, c: 'white' }],
      poses: { dur: 2.3, keys: [[0, VP.idle(0)], [0.4, VP.thW], [0.5, VP.fake, 'snap'], [0.66, VP.thW, 'io'], [1.45, { ...VP.thW, aF: 0.6, eF: 1.75, ry: 10 }], [1.56, VP.thH, 'snap'], [2.3, VP.idle(0), 'io']] },
      moves: [{ t0: 1.5, t1: 1.66, v: 650 }],
      hits: [{ ...thrust(1.55, 24, true), pbal: 72 }],
      ev: [
        { t: 0.5, fn: (e) => { G.SFX.play('c4_pluck'); const w = TYPES.c4_elite.weapon(e); G.FX.spark(w.x, w.y, 6, { col: VAL.gold, speed: 220 }); } },
        { t: 1.53, fn: () => { G.SFX.play('c4_slice'); G.SFX.play('c4_violin', 1.5, 0.2); } },
      ],
    },
    martele: {
      dur: 1.95, cd: 1.1, track: false, tells: [{ t: 0.2, c: 'red' }],
      poses: { dur: 1.95, keys: [[0, VP.idle(0)], [0.7, VP.marW], [0.84, VP.marH, 'snap'], [1.35, VP.marH], [1.95, VP.idle(0), 'io']] },
      moves: [{ t0: 0.8, t1: 1.04, v: 1100 }],
      hits: [{ t0: 0.82, t1: 1.08, box: { x: -20, y: -140, w: 210, h: 70 }, dmg: 30, red: true, kb: 460, last: true }],
      ev: [{ t: 0.8, fn: (e) => { G.SFX.play('slash', 0.6, true); G.SFX.play('c4_violin', 0.75, 0.35); G.FX.dust(e.x, e.y, 14, { w: 30, speed: 260, size: 10 }); } }],
    },
    tremolo: (n) => ({
      dur: 1.75 + (n - 1) * 0.4, cd: 1.0, track: false, tells: [{ t: 0.3, c: 'white' }], play: [0.15, 1.35 + (n - 1) * 0.4],
      poses: { dur: 1.75 + (n - 1) * 0.4, keys: [[0, VP.idle(0)], [0.3, VP.play(0)], [1.3 + (n - 1) * 0.4, VP.play(0)], [1.75 + (n - 1) * 0.4, VP.idle(0), 'io']] },
      ev: Array.from({ length: n }, (_, i) => ({ t: 0.85 + i * 0.4, fn: (e) => soundBlade(e) })),
    }),
    sweep: {
      dur: 2.05, cd: 1.0, tells: [{ t: 0.15, c: 'white' }, { t: 0.76, c: 'white' }],
      poses: { dur: 2.05, keys: [[0, VP.idle(0)], [0.45, VP.slU], [0.64, VP.slD, 'snap'], [0.98, VP.slU, 'io'], [1.24, VP.slD, 'snap'], [2.05, VP.idle(0), 'io']] },
      moves: [{ t0: 0.08, t1: 0.3, v: -240 }, { t0: 0.55, t1: 0.66, v: 420 }, { t0: 1.15, t1: 1.26, v: 360 }],
      hits: [
        { t0: 0.6, t1: 0.72, box: { x: -10, y: -200, w: 178, h: 200 }, dmg: 16, kb: 240, pbal: 30 },
        { t0: 1.21, t1: 1.33, box: { x: -10, y: -200, w: 178, h: 200 }, dmg: 18, kb: 300, last: true, pbal: 46 },
      ],
      ev: [{ t: 0.6, fn: () => G.SFX.play('c4_slice') }, { t: 1.21, fn: () => G.SFX.play('c4_slice') }],
    },
    cadenza: {
      dur: 3.35, cd: 1.1, tells: [{ t: 0.76, c: 'white' }, { t: 1.27, c: 'white' }, { t: 2.0, c: 'red' }], play: [0.05, 0.6],
      poses: { dur: 3.35, keys: [[0, VP.idle(0)], [0.2, VP.play(0)], [0.6, VP.play(3)], [1.1, VP.thW], [1.24, VP.thH, 'snap'], [1.6, VP.thW], [1.74, VP.thH, 'snap'], [2.1, VP.lowC, 'io'], [2.5, VP.lowC], [2.62, VP.upC, 'snap'], [3.35, VP.idle(0), 'io']] },
      moves: [{ t0: 1.18, t1: 1.26, v: 360 }, { t0: 1.68, t1: 1.76, v: 360 }, { t0: 2.55, t1: 2.66, v: 520 }],
      hits: [thrust(1.24, 15, false), thrust(1.74, 15, false), { t0: 2.6, t1: 2.76, box: { x: -10, y: -220, w: 180, h: 220 }, dmg: 28, red: true, kb: 420, last: true }],
      ev: [{ t: 0.1, fn: () => G.SFX.play('c4_violin', 1.25, 0.5) }, { t: 1.22, fn: () => G.SFX.play('c4_slice') }, { t: 1.72, fn: () => G.SFX.play('c4_slice') }, { t: 2.6, fn: () => { G.SFX.play('slash', 0.55, true); G.SFX.play('c4_violin', 2, 0.25); } }],
    },
    retune: {
      dur: 1.9, cd: 0.6, track: false, play: [0.15, 1.5],
      poses: { dur: 1.9, keys: [[0, VP.hurt], [0.35, VP.play(0)], [1.45, VP.play(6)], [1.9, VP.idle(0), 'io']] },
      ev: [
        { t: 0.3, fn: () => G.SFX.play('c4_violin', 0.5, 1.2) },
        { t: 1.0, fn: (e) => {
          e.p2 = true; G.game.shake(0.9); G.SFX.play('roar'); G.SFX.play('c4_violin', 1, 0.9);
          G.FX.ring(e.cx, e.cy, 20, 380, 0.8, VAL.col, 7); G.FX.flash(e.cx, e.cy, 300, 0.5, VAL.col); G.FX.shards(e.x, e.y - 150, 16, '#f3ede2', 500);
        } },
      ],
    },
  };
  const VA2 = {};   // phase-2 cuts: same moves, shorter breaths
  for (const k of ['spiccato', 'feint', 'martele', 'sweep']) VA2[k] = Object.assign({}, VA[k], { cd: VA[k].cd * 0.65 });
  VA.trem1 = VA.tremolo(1); VA.trem2 = Object.assign(VA.tremolo(2), { cd: 0.8 });
  // tremolo: a crescent of sound skating along the floor (white; a perfect guard shatters it and staggers him)
  function soundBlade(e) {
    const x0 = e.x + e.facing * 70, y = G.Phys.groundBelow(x0, e.y - 40);
    G.SFX.play('c4_violin', 1.6, 0.3); G.SFX.play('whoosh', 1.2);
    G.FX.ring(x0, y - 60, 10, 70, 0.3, VAL.col, 4);
    G.game.hazards.push({
      x: x0, y: y < 1e8 ? y : e.y, dir: e.facing, owner: e, t: 0, life: 1.7, sp: 560,
      update(h, dt, g) {
        h.x += h.dir * h.sp * dt;
        const fl = G.Phys.groundBelow(h.x, h.y - 40); if (fl > h.y + 30 || fl < h.y - 30) { h.done = true; G.FX.spark(h.x, h.y - 40, 10, { col: '#ffd0da', speed: 300 }); return; }
        if (Math.random() < 0.5) G.FX.ember(h.x, h.y - 30, 1, VAL.col, { w: 20, h: 50, up: 40, life: 0.3 });
        const hb = g.player.hurtbox;
        if (!h.passed && h.x + 16 > hb.x && h.x - 16 < hb.x + hb.w && h.y - 100 < hb.y + hb.h && h.y > hb.y) {
          const r = g.player.receiveHit(h, { dmg: 16, kb: 260, hx: h.x, hy: h.y - 50 });
          if (r === 'parried') {
            const o = h.owner; h.done = true; G.FX.ring(h.x, h.y - 50, 8, 90, 0.35, '#7ff4ff', 5);
            if (o && !o.dead) { o.bal = Math.min(o.maxBal, o.bal + 30); o.balT = 0; o.showBar = 3; if (o.bal >= o.maxBal && o.state !== 'broken') o.breakBalance(); }
          } else if (r === 'dodged') h.passed = true;
          else if (r !== 'ignored') h.done = true;
        }
      },
      draw(ctx, h) {
        const a = Math.min(1, h.t / 0.1) * Math.min(1, (h.life - h.t) / 0.25);
        ctx.translate(h.x, h.y); ctx.scale(h.dir, 1); ctx.globalAlpha = a;
        const crescent = (w, H) => { ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(w + 16, -H * 0.5, -6, -H); ctx.quadraticCurveTo(w, -H * 0.5, -6, 0); ctx.closePath(); };
        lighter(ctx, () => {
          K.glow(ctx, 6, -52, 70, VAL.col, 0.4);
          crescent(18, 104); ctx.fillStyle = U.rgba(VAL.col, 0.65); ctx.fill();
          crescent(9, 92); ctx.fillStyle = 'rgba(255,240,244,0.9)'; ctx.fill();
          ctx.strokeStyle = 'rgba(255,220,230,0.6)'; ctx.lineWidth = 0.8;
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-40 - i * 10, -24 - i * 18); ctx.lineTo(-4, -24 - i * 18 + Math.sin(h.t * 40 + i) * 2); ctx.stroke(); }
        });
        crescent(18, 104); ink(ctx, 1.4);
      },
    });
  }
  TYPES.c4_elite = {
    name: '首席・瓦倫丁', en: 'VALENTIN, THE PRINCIPAL', w: 44, h: 172, hp: 640, bal: 210, col: VAL.col, elite: true, shards: 260, scale: VAL.s, spawnT: 1.1,
    defeatDialog: 'c4_eliteDefeat', defeatRelic: 'c4_rosin', music: 'c4_elite', portrait: [1.5, 0.93],
    init(e) { e.facing = -1; e.cape = new Rig.Chain(7, 8.5, 0.07, 0.88); e.hair = new Rig.Chain(9, 6.5, 0.05, 0.9); e.strs = [0, 1, 2, 3].map(() => new Rig.Chain(8, 13, 0.04, 0.9)); e.last = null; e.p2 = false; e.p2K = 0; e.foot = 0; },
    voice: (e) => G.SFX.play('c4_violin', e.p2 ? 0.8 : 1.1, 0.28),
    weapon: (e) => { const J = e.J; return J && J.bt ? { x: e.x + e.facing * J.bt.x * VAL.s, y: e.y + J.bt.y * VAL.s } : { x: e.x + e.facing * 120, y: e.y - 110 }; },
    think(e, dt) {
      e.faceP(); const d = e.distP();
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
        e.phase = 2; e.speedMul = 1.18; e.cd = 0; G.game.bark('c4_eliteP2'); e.startAtk(VA.retune); return;
      }
      // fencing footwork: an in-out bounce at the edge of his reach
      e.foot += dt;
      const want = d > 230 ? 1 : d < 120 ? -1 : Math.sin(e.foot * 2.6) * 0.6;
      e.vx = U.approach(e.vx, e.facing * want * 210 * e.speedMul, 1400 * dt);
      if (e.cd > 0) return;
      const p2 = e.phase === 2, M = p2 ? VA2 : VA;
      let pool;
      if (d < 210) pool = [['spiccato', 3], ['feint', 2.5], ['sweep', 2.2]].concat(p2 ? [['cadenza', 3]] : []);
      else if (d < 420) pool = [['martele', 3], ['feint', d < 260 ? 1.5 : 0.01], [p2 ? 'trem2' : 'trem1', 1.4]];
      else pool = [[p2 ? 'trem2' : 'trem1', 3], ['martele', d < 440 ? 1 : 0.01]];
      const k = pick(pool, e.last); e.last = k;
      e.startAtk(M[k] || VA[k]);
    },
    atkUpdate(e) {
      if (e.atk === VA.retune) { e.vx = 0; e.invuln = e.st > 0.2 && e.st < 1.1; }
      else e.invuln = false;
    },
    draw(ctx, e, ghost) {
      const dt = G.game.dtVis, s = VAL.s, t = e.t;
      rigPose(e, dt, Object.assign({ ground: true }, VP));
      // sawing the bow while playing
      const playing = e.state === 'atk' && e.atk && e.atk.play && e.st > e.atk.play[0] && e.st < e.atk.play[1];
      e.playK = U.damp(e.playK || 0, playing ? 1 : 0, 12, dt);
      const pose = Object.assign({}, e.pose);
      if (e.playK > 0.05) { const k = Math.sin(t * 22) * 0.18 * e.playK; pose.aF += k; pose.eF -= k * 1.2; }
      const J = Rig.compute(pose); e.J = J;
      e.p2K = U.damp(e.p2K || 0, e.p2 ? 1 : 0, 3, dt);
      const { Q, nx, ny } = torsoQ(J);
      const toW = (p) => ({ x: e.x + e.facing * p.x * s, y: e.y + p.y * s });
      // cloth: half-cape off the back shoulder, the silver ponytail, P2's crimson strings
      const ca = toW(Q(1.0, -4)), ha = toW({ x: J.head.x - Math.sin(J.ha) * 2 - Math.cos(J.ha) * 7, y: J.head.y - 4 });
      e.cape.update(ca.x, ca.y, e.facing, dt, -e.vx * 4 + Math.sin(t * 1.7) * 260, 2.75);
      e.hair.update(ha.x, ha.y, e.facing, dt, -e.vx * 4 + Math.sin(t * 2.1) * 300, 2.55);
      const sa = toW(Q(0.85, -6));
      if (e.p2K > 0.02) e.strs.forEach((c, i) => c.update(sa.x, sa.y, e.facing, dt, -e.vx * 3 + Math.sin(t * 1.3 + i) * 700, 3.6 - i * 0.35 + Math.sin(t * 0.9 + i) * 0.15));
      ctx.save();
      const sink = K.emerge(ctx, e) * 220;
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing * s, s);
      dissolve(ctx, e, -150, 4, s, ghost);
      const L = (c) => c.p.map((q) => ({ x: (q.x - e.x) * e.facing / s, y: (q.y - e.y - sink) / s }));
      // P2: four crimson resonance strings fanning from his back
      if (e.p2K > 0.02 && !ghost) {
        lighter(ctx, () => {
          e.strs.forEach((c, i) => {
            if (!c.inited) return; const p = L(c);
            ctx.strokeStyle = U.rgba(VAL.col, 0.35 * e.p2K); ctx.lineWidth = 4; ctx.beginPath(); p.forEach((q, j) => (j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
            ctx.strokeStyle = U.rgba('#ffe0e6', 0.85 * e.p2K); ctx.lineWidth = 0.9 + (i === 3 ? 0.4 : 0); ctx.stroke();
            const tip = p[p.length - 1]; K.glow(ctx, tip.x, tip.y, 8, VAL.col, 0.7 * e.p2K);
          });
        });
      }
      // ponytail (behind)
      if (e.hair.inited) { const hp = L(e.hair); Rig.ribbon(ctx, hp, 3.6, 0.6, '#8a87a8', 1.6); ink(ctx, 1); Rig.ribbon(ctx, hp.map((q) => ({ x: q.x + 0.6, y: q.y - 0.8 })), 2.2, 0.3, VAL.hair, 1); }
      // half-cape (behind)
      if (e.cape.inited) K.tattered(ctx, L(e.cape), 6, 13, VAL.cape, '#2a0a14', 2);
      // the violin: held low by the neck in the back hand, or tucked under the chin while he plays
      const violin = () => {
        let a, b; // a = tail (chin end), b = scroll end
        if (e.playK > 0.5) { a = Q(1.16, 4); b = J.hdB; }
        else { const f = { x: J.hdB.x - J.elB.x, y: J.hdB.y - J.elB.y }, l = Math.hypot(f.x, f.y) || 1; b = { x: J.hdB.x - f.x / l * 4, y: J.hdB.y - f.y / l * 4 }; a = { x: J.hdB.x + f.x / l * 34, y: J.hdB.y + f.y / l * 34 }; }
        const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang); const sc = Math.min(1.15, l / 34); ctx.scale(sc, 1);
        // body (hourglass), fingerboard, scroll, f-holes, strings
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(0, -7, 7, -8.5, 9, -6); ctx.quadraticCurveTo(11, -3.4, 13, -5.6); ctx.bezierCurveTo(16, -8, 22, -6.5, 22, 0);
        ctx.bezierCurveTo(22, 6.5, 16, 8, 13, 5.6); ctx.quadraticCurveTo(11, 3.4, 9, 6); ctx.bezierCurveTo(7, 8.5, 0, 7, 0, 0); ctx.closePath();
        ctx.fillStyle = cel(ctx, 11, 0, 0, -1, 7, VAL.wood); ctx.fill(); ink(ctx, 1.1);
        ctx.strokeStyle = '#2a0e08'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(9, -3.5); ctx.quadraticCurveTo(11, -2.5, 13, -3.5); ctx.moveTo(9, 3.5); ctx.quadraticCurveTo(11, 2.5, 13, 3.5); ctx.stroke();
        LB(ctx, { x: 6, y: 0 }, { x: 33, y: 0 }, 1.4, 1.1, '#141018', { noHatch: true });
        ctx.fillStyle = VAL.wood; ctx.beginPath(); ctx.arc(34.5, 0, 2.2, 0, TAU); ctx.fill(); ink(ctx, 0.7);
        ctx.strokeStyle = 'rgba(255,240,220,0.75)'; ctx.lineWidth = 0.35; for (const o of [-0.9, -0.3, 0.3, 0.9]) { ctx.beginPath(); ctx.moveTo(3, o); ctx.lineTo(33, o * 0.6); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,220,180,0.35)'; ctx.beginPath(); ctx.ellipse(16, -3, 3.5, 1.2, 0, 0, TAU); ctx.fill();
        ctx.restore();
      };
      // back arm (+ violin) and back leg
      LC(ctx, [J.shB, J.elB, J.hdB], [3.0, 2.6, 2.1], VAL.coatB);
      if (e.playK <= 0.5) violin();
      const legW = [5.4, 4.8, 3.6, 3.4, 2.5];
      const leg = (knee, ank, toe, col, bootC) => {
        LC(ctx, [J.hip, lp(J.hip, knee, 0.5), knee, lp(knee, ank, 0.5), ank], legW, col);
        LC(ctx, [lp(knee, ank, 0.1), lp(knee, ank, 0.6), ank], [4.1, 3.6, 3.0], bootC, { spec: 0.4 });   // tall boot
        LB(ctx, ank, { x: toe.x + 2, y: toe.y + 0.5 }, 3.0, 2.0, bootC, { noHatch: true });
        ctx.fillStyle = VAL.gold; const c = lp(knee, ank, 0.1); ctx.beginPath(); ctx.arc(c.x, c.y, 1.2, 0, TAU); ctx.fill();
      };
      leg(J.kneeB, J.ankB, J.toeB, U.mixHex(VAL.trouser, '#000000', 0.25), '#0c0910');
      // the coat: white concert tunic, gold frogging, long split skirts
      const skirt = [Q(0.15, -8), Q(-0.55, -12 - Math.sin(t * 2) * 1.5), Q(-0.62, -2), Q(-0.4, 3), Q(-0.6, 9), Q(-0.5, 12), Q(0.1, 8)];
      ctx.beginPath(); skirt.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
      ctx.fillStyle = cel(ctx, Q(-0.2, 0).x, Q(-0.2, 0).y, nx, ny, 11, VAL.coatB); ctx.fill(); ink(ctx, 1.2);
      const coat = [Q(-0.06, -8), Q(0.5, -7), Q(0.98, -9.5), Q(1.14, -4.5), Q(1.12, 6.5), Q(0.72, 8), Q(0.2, 8), Q(-0.06, 7)];
      ctx.beginPath(); coat.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
      ctx.fillStyle = cel(ctx, Q(0.5, 0).x, Q(0.5, 0).y, nx, ny, 10, VAL.coat); ctx.fill(); ink(ctx, 1.3);
      // crimson sash + gold frogging
      ctx.strokeStyle = VAL.cape; ctx.lineWidth = 3; { const a = Q(1.0, -7), b = Q(0.25, 7.5); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      ctx.strokeStyle = VAL.gold; ctx.lineWidth = 0.9;
      for (const a of [0.42, 0.58, 0.74, 0.9]) { const p = Q(a, 3), q = Q(a, 7.5); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.fillStyle = VAL.gold; ctx.beginPath(); ctx.arc(p.x, p.y, 0.9, 0, TAU); ctx.fill(); }
      // epaulette + aiguillette
      { const ep = Q(1.06, -1); ctx.fillStyle = cel(ctx, ep.x, ep.y, 0, -1, 5, VAL.gold); ctx.beginPath(); ctx.ellipse(ep.x, ep.y, 7, 3.4, Math.atan2(ny, nx) + PI / 2, 0, TAU); ctx.fill(); ink(ctx, 0.9);
        ctx.strokeStyle = VAL.gold; ctx.lineWidth = 0.8; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(ep.x - 5 + i * 3, ep.y + 2); ctx.lineTo(ep.x - 5 + i * 3, ep.y + 6); ctx.stroke(); }
        const a1 = Q(1.0, 3), a2 = Q(0.6, 6.5); ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.quadraticCurveTo(a2.x - nx * 3, a2.y + 4, a2.x, a2.y); ctx.stroke(); }
      // the Hush heart: a crimson rosin-stone pinned at the cravat
      const gem = Q(1.08, 5.5);
      // front leg
      leg(J.kneeF, J.ankF, J.toeF, VAL.trouser, VAL.boot);
      // neck + cravat
      LB(ctx, Q(1.1, 1), lp(Q(1.1, 1), J.head, 0.55), 2.6, 2.4, '#e8d8cc', { noHatch: true });
      ctx.fillStyle = '#f6f0e6'; ctx.beginPath(); ctx.moveTo(gem.x - 3, gem.y - 4); ctx.quadraticCurveTo(gem.x + 5, gem.y - 2, gem.x + 2, gem.y + 7); ctx.quadraticCurveTo(gem.x - 2, gem.y + 3, gem.x - 3, gem.y - 4); ctx.fill(); ink(ctx, 0.8);
      if (!ghost) lighter(ctx, () => K.glow(ctx, gem.x, gem.y, 12, VAL.col, 0.6));
      ctx.fillStyle = '#ff8aa0'; ctx.beginPath(); ctx.moveTo(gem.x, gem.y - 2.4); ctx.lineTo(gem.x + 1.8, gem.y); ctx.lineTo(gem.x, gem.y + 2.4); ctx.lineTo(gem.x - 1.8, gem.y); ctx.closePath(); ctx.fill(); ink(ctx, 0.6);
      // head: pale profile, porcelain half-mask with gilt filigree, swept silver hair
      ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha); ctx.scale(1.08, 1.08);
      const face = () => { ctx.beginPath(); ctx.moveTo(-1, -9); ctx.bezierCurveTo(4, -9.5, 7.4, -7, 7.8, -3); ctx.lineTo(9.8, 1.2); ctx.lineTo(8.2, 1.9); ctx.lineTo(8.6, 3.6); ctx.lineTo(7.9, 4.6); ctx.lineTo(8.1, 6.4); ctx.lineTo(6.2, 8.4); ctx.lineTo(0.8, 8); ctx.lineTo(-1.8, 4); ctx.closePath(); };
      face(); ctx.fillStyle = '#ead8cc'; ctx.fill();
      ctx.save(); face(); ctx.clip(); ctx.fillStyle = '#b48a90'; ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(3, -4); ctx.quadraticCurveTo(4.4, 2, 3, 6); ctx.lineTo(7.4, 6.6); ctx.lineTo(7, 9.5); ctx.lineTo(-2, 9.5); ctx.closePath(); ctx.fill(); ctx.restore();
      face(); ink(ctx, 1.1);
      ctx.strokeStyle = '#8a3a48'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(8.3, 3.9); ctx.lineTo(6.9, 4.1); ctx.stroke();
      // half-mask (upper face); in P2 a shard has broken away and the eye burns through
      const mask = () => { ctx.beginPath(); ctx.moveTo(-1.5, -9.6); ctx.bezierCurveTo(4.5, -10.4, 8.4, -7.6, 8.6, -3.4); ctx.lineTo(10.4, 0.2); ctx.lineTo(7.6, 0.6); ctx.quadraticCurveTo(4, 1.6, 0.2, 0); ctx.closePath(); };
      mask(); ctx.fillStyle = '#f6f2ea'; ctx.fill();
      ctx.save(); mask(); ctx.clip(); ctx.fillStyle = '#c9c0c8'; ctx.fillRect(-3, -1.5, 14, 4); ctx.restore();
      mask(); ink(ctx, 1);
      ctx.strokeStyle = VAL.gold; ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(1, -7.6); ctx.bezierCurveTo(3, -9, 5, -6, 3.5, -4.6); ctx.moveTo(2, -2); ctx.quadraticCurveTo(0.5, -4.5, 2.2, -6); ctx.stroke();
      if (e.p2K > 0.05) { ctx.fillStyle = '#ead8cc'; ctx.globalAlpha *= e.p2K; poly(ctx, [[5.2, -9], [8.6, -5], [8.2, -1.4], [6, -3.2], [6.6, -6]]); ctx.fill(); ink(ctx, 0.8); ctx.globalAlpha /= e.p2K;
        ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(5.2, -9); ctx.lineTo(3.6, -5); ctx.lineTo(4.8, -2); ctx.stroke(); }
      ctx.fillStyle = '#120812'; ctx.beginPath(); ctx.ellipse(6.4, -3.2, 1.8, 1.0, -0.1, 0, TAU); ctx.fill();
      if (!ghost) lighter(ctx, () => { K.glow(ctx, 6.5, -3.2, 7 + e.p2K * 7, VAL.col, 0.8); ctx.fillStyle = '#ffd8e0'; ctx.beginPath(); ctx.arc(6.6, -3.2, 0.7, 0, TAU); ctx.fill(); });
      // hair: swept-back silver crown with a forelock
      ctx.beginPath(); ctx.moveTo(-1.5, -10.4); ctx.bezierCurveTo(-7, -11.6, -11.5, -7, -11, -1.5); ctx.bezierCurveTo(-10.6, 2, -9, 4.5, -7.5, 6); ctx.lineTo(-3, 5.5); ctx.lineTo(-1.5, -1); ctx.lineTo(1.5, -6); ctx.lineTo(4, -8.4); ctx.lineTo(7.8, -6.2);
      ctx.bezierCurveTo(6.6, -10.4, 2.6, -12, -1.5, -10.4); ctx.closePath();
      ctx.fillStyle = cel(ctx, -3, -5, 0, -1, 8, VAL.hair); ctx.fill(); ink(ctx, 1);
      ctx.strokeStyle = 'rgba(80,70,110,0.6)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(5, -9); ctx.quadraticCurveTo(-2, -10, -8, -5); ctx.moveTo(2, -7); ctx.quadraticCurveTo(-4, -7.5, -9, -2); ctx.stroke();
      ctx.fillStyle = VAL.hair; poly(ctx, [[3.6, -10.2], [9.4, -6.8], [10.2, -1.8], [7.4, -5.6]]); ctx.fill(); ink(ctx, 0.7);   // forelock
      ctx.fillStyle = VAL.cape; ctx.beginPath(); ctx.ellipse(-8.6, -3, 1.6, 2.4, 0.3, 0, TAU); ctx.fill(); ink(ctx, 0.5);   // ribbon at the tie
      ctx.restore();
      if (e.playK > 0.5) violin();
      // bow-blade: gold frog, a honed steel stick with its pale horsehair ribbon strung to the tip
      const fa = J.sw, ux = Math.sin(fa), uy = Math.cos(fa), px = uy, py = -ux, hdp = J.hdF;
      const tip = { x: hdp.x + ux * VAL.BL, y: hdp.y + uy * VAL.BL }; J.bt = tip;
      const frog = { x: hdp.x + ux * 4, y: hdp.y + uy * 4 };
      // the hair ribbon (on the inside of the stick)
      ctx.strokeStyle = '#f1ead8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(frog.x + px * 3.2, frog.y + py * 3.2); ctx.lineTo(tip.x + px * 1.2 - ux * 3, tip.y + py * 1.2 - uy * 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hdp.x - ux * 6, hdp.y - uy * 6); ctx.lineTo(hdp.x - ux * 6 + px * 1.5, hdp.y - uy * 6 + py * 1.5); ink(ctx, 2);
      ctx.beginPath(); ctx.moveTo(hdp.x - ux * 7 - px * 1.6, hdp.y - uy * 7 - py * 1.6); ctx.lineTo(tip.x - px * 0.4, tip.y - py * 0.4); ctx.lineTo(tip.x + px * 1.8 + ux * 2, tip.y + py * 1.8 + uy * 2); ctx.lineTo(hdp.x - ux * 7 + px * 1.4, hdp.y - uy * 7 + py * 1.4); ctx.closePath();
      ctx.fillStyle = '#dfe3ec'; ctx.fill(); ink(ctx, 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(hdp.x + ux * 8 - px * 0.6, hdp.y + uy * 8 - py * 0.6); ctx.lineTo(tip.x - ux * 8, tip.y - uy * 8); ctx.stroke();
      LB(ctx, { x: hdp.x - ux * 7, y: hdp.y - uy * 7 }, { x: hdp.x + ux * 5, y: hdp.y + uy * 5 }, 2.2, 2.0, '#2a1a12', { noHatch: true });   // ebony frog
      ctx.fillStyle = VAL.gold; ctx.beginPath(); ctx.arc(hdp.x - ux * 8, hdp.y - uy * 8, 1.8, 0, TAU); ctx.fill(); ink(ctx, 0.6);
      if (!ghost && (e.p2K > 0.05 || e.tellT > 0)) lighter(ctx, () => { ctx.strokeStyle = U.rgba(VAL.col, 0.25 + 0.4 * e.p2K); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hdp.x, hdp.y); ctx.lineTo(tip.x, tip.y); ctx.stroke(); });
      // front arm (white sleeve, crimson cuff, gloved fist)
      LC(ctx, [J.sh, J.elF, J.hdF], [3.6, 3.1, 2.6], VAL.coat);
      LB(ctx, lp(J.elF, J.hdF, 0.72), lp(J.elF, J.hdF, 0.9), 3.0, 2.9, VAL.cape, { noHatch: true });
      LB(ctx, { x: hdp.x - ux * 2.5, y: hdp.y - uy * 2.5 }, { x: hdp.x + ux * 2.5, y: hdp.y + uy * 2.5 }, 2.9, 2.7, '#2a2230', { noHatch: true });
      if (e.tellT > 0) tellGlow(ctx, e, tip.x, tip.y, 30);
      ctx.restore();
      // the blade's arc while it cuts (drawn to its true reach)
      if (!ghost && e.state === 'atk' && e.atk && e.atk.hits) for (const h of e.atk.hits) {
        if (e.st < h.t0 || e.st > h.t1 + 0.08) continue;
        const u2 = (e.st - h.t0) / (h.t1 + 0.08 - h.t0), b = e.boxW(h.box), red = h.red;
        lighter(ctx, () => {
          ctx.strokeStyle = red ? `rgba(255,60,90,${0.75 * (1 - u2)})` : `rgba(255,236,240,${0.7 * (1 - u2)})`; ctx.lineWidth = 6 * (1 - u2) + 1.5;
          if (h.box.h < 90) { const y = b.y + b.h / 2; ctx.beginPath(); ctx.moveTo(e.x + e.facing * 30, y + 4); ctx.lineTo(e.facing > 0 ? b.x + b.w : b.x, y); ctx.stroke(); }
          else { const cx = e.x, cy = e.y - 90, r = h.box.w - 10; ctx.beginPath(); ctx.arc(cx, cy, r, e.facing > 0 ? -1.3 : PI + 1.3, e.facing > 0 ? 0.9 : PI - 0.9, e.facing < 0); ctx.stroke(); }
        });
      }
      drawBoxes(ctx, e);
    },
  };
  // the elite's moves live on the type too (gallery / &pose=<attack>:<t> testing, lint)
  Object.assign(TYPES.c4_elite, { spiccato: VA.spiccato, feint: VA.feint, martele: VA.martele, trem1: VA.trem1, trem2: VA.trem2, sweep: VA.sweep, cadenza: VA.cadenza, retune: VA.retune });

  /* =========================== relic: 松香 ROSIN (Valentin) =========================== */
  // +12% attack speed: wraps the engine's attack-speed multiplier while the relic is equipped
  G.Relics.c4_rosin = { apply() { } };
  if (!G.Boons._c4rosin) {
    const base = G.Boons.atkSpeed.bind(G.Boons);
    G.Boons._c4rosin = true;
    G.Boons.atkSpeed = function () { const g = G.game, eq = g && g.save && g.save.equipped; return base() * (eq && eq.includes('c4_rosin') ? 1.12 : 1); };
  }

  /* =========================== data: codex, relic, barks =========================== */
  const D = G.DATA;
  D.relics.c4_rosin = D.relics.c4_rosin || { name: '松香', desc: '攻擊速度 +12%' };
  D.speakers.c4_valentin = D.speakers.c4_valentin || { name: '瓦倫丁', en: 'VALENTIN', color: '#ff7a8f' };
  D.barks.c4_eliteP2 = D.barks.c4_eliteP2 || { who: 'c4_valentin', text: '……弦，調好了。第二樂章。請別離席。' };
  const addCodex = (k, e) => { D.codex[k] = D.codex[k] || []; if (!D.codex[k].some((q) => q.id === e.id)) D.codex[k].push(e); };
  addCodex('items', { id: 'c4_rosin', name: '松香', en: 'ROSIN', unlock: 'relic_c4_rosin', relic: true, body: ['瓦倫丁琴盒裡最後一塊松香，琥珀色，摸起來還有點溫度。他說過：弓毛沒有松香，就只是一束安靜的馬尾。', '遺物效果：攻擊速度 +12%。'] });
  [
    { id: 'c4_marionette', name: '提線舞者', en: 'MARIONETTE', tag: '寂裔｜低階・人偶', body: [
      '劇院芭蕾舞團的瓷偶首席。原本只是舞台布景的一部分，門關上之後，它開始自己跳舞——操縱它的十字架懸在半空，線的另一端，在舞台深處。',
      '攻擊模式：三連迴旋（白・白・白），轉完會行一個屈膝禮；大跳躍刺擊（紅），落點就在你腳下。',
      '弱點：屈膝禮與落地後的僵直。斷弦時，它會像真正的木偶一樣垂下來。'] },
    { id: 'c4_chorister', name: '假面合唱', en: 'MASKED CHORISTER', tag: '寂裔｜支援・合唱團', body: [
      '戴著悲喜雙面具的合唱團員。它的聲音早已交給了露塞特，卻留下了唱歌的習慣——它唱出的每一個音符，都會變成護住同伴的金色樂譜。',
      '攻擊模式：音符齊射（白，可完美格擋反彈）；近身的強音爆發（白）；為同伴詠唱護盾——金線會把護盾和它連在一起。',
      '弱點：詠唱時打斷它，或者先擊倒它，所有護盾都會一起碎掉。'] },
    { id: 'c4_pitwyrm', name: '樂池鰻', en: 'PIT WYRM', tag: '寂裔｜中階・水棲', body: [
      '在淹沒的樂池裡長大的盲鰻，頭上張著一把蕾絲摺扇般的鰭冠。它把一灘黑水當成自己的身體，在水面下時，刀刃碰不到它。',
      '攻擊模式：潛行到你腳下後破水而出（紅，看到水面沸騰就閃開）；探身咬擊（白）；噴吐黑水（白，可反彈）。',
      '弱點：只有離開水面時才能被擊中。它浮上來後不會馬上潛回去——那就是你的時間。'] },
    { id: 'c4_usher', name: '帶位員', en: 'USHER', tag: '寂裔｜中階・人型', body: [
      '燕尾服、高禮帽、一盞裝著紫色寂火的提燈。帽簷下什麼都沒有，只有兩點光。它仍在替早已散場的觀眾帶位。',
      '攻擊模式：提燈橫掃（白）；雙手高舉的提燈砸擊（白，會留下小片火焰）；甩出鎖鏈提燈（紅，落地爆開並燃起一片寂火）。',
      '弱點：動作緩慢，甩出提燈後要一段時間才收得回來。不要站在火裡。'] },
    { id: 'c4_elite', name: '首席・瓦倫丁', en: 'VALENTIN, THE PRINCIPAL', tag: '寂裔｜菁英・第三道門', body: [
      '潮音大劇院的首席男高音。聲音交出去之後，他拿起樂池裡的小提琴，把琴弓磨成細劍，把最後一場演出的節拍，刻進了自己的劍術裡。',
      '攻擊模式：跳弓三刺（白×3）；撥弦假動作——先撥一聲，停頓之後才真正突刺（白）；頓弓衝刺（紅）；顫音音刃（白，完美格擋可震碎並削減架勢）；滑音雙斬（白×2）。',
      '第二樂章：面具碎裂，背後展開四根深紅的共鳴弦，加入華彩樂段（白・白……紅）。',
      '弱點：撥弦後別急著格擋，等白光。頓弓衝刺之後的收勢很長。'] },
  ].forEach((c) => addCodex('hushborn', Object.assign({ portrait: c.id, unlock: 'seen_' + c.id }, c)));
})(window.G);

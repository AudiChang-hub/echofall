'use strict';
/* ECHOFALL — Chapter I foes (the royal city of Wendo): 鐘鴉 Bell-Crow (c1_bellcrow) and 負柱者 Pillar-Bearer (c1_pillar).
   Murmur / Sentinel / Shrieker / Graves / Maestrina live in js/enemies.js. */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK, glow = K.glow;

  /* ---------------- shared ink helpers ---------------- */
  const sideOf = (ctx, nx, ny) => { const L = Rig.lightDir(ctx); return nx * L.x + ny * L.y >= 0 ? 1 : -1; };
  const cel = (ctx, hex, cx, cy, nx, ny, w) => Rig.celGrad(ctx, cx, cy, nx, ny, w, sideOf(ctx, nx, ny), Rig.ramp(hex));
  const inkIt = (ctx, w = 1.2) => { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.stroke(); };
  const poly = (ctx, pts) => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); };
  // closed curve through points (quadratic midpoints) — organic silhouettes instead of polygons
  const blob = (ctx, pts) => {
    const n = pts.length, m = (i) => ({ x: (pts[i % n].x + pts[(i + 1) % n].x) / 2, y: (pts[i % n].y + pts[(i + 1) % n].y) / 2 });
    ctx.beginPath(); const s = m(n - 1); ctx.moveTo(s.x, s.y);
    for (let i = 0; i < n; i++) { const q = m(i); ctx.quadraticCurveTo(pts[i].x, pts[i].y, q.x, q.y); }
    ctx.closePath();
  };
  // faceted crystal shard growing from (x,y) along angle ang (0 = straight up, + = toward +x)
  function shard(ctx, x, y, len, wid, ang, lit, dark) {
    const ux = Math.sin(ang), uy = -Math.cos(ang), px = -uy, py = ux;
    const P = (a, b) => ({ x: x + ux * a * len + px * b * wid, y: y + uy * a * len + py * b * wid });
    const out = [P(0, -1), P(0.6, -0.9), P(1, 0), P(0.62, 0.85), P(0, 1)];
    ctx.fillStyle = dark; poly(ctx, out); ctx.fill();
    ctx.fillStyle = lit; poly(ctx, [P(0, -1), P(0.6, -0.9), P(1, 0), P(0.1, 0.05)]); ctx.fill();
    poly(ctx, out); inkIt(ctx, 0.85);
  }
  // tapered feather blade from (x,y) toward screen angle ang
  function feather(ctx, x, y, ang, len, wid, col, edge, notch) {
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    const P = (a, b) => ({ x: x + ux * len * a + nx * wid * b, y: y + uy * len * a + ny * wid * b });
    const a0 = P(0, 0.45), c1 = P(0.55, 1.05), tip = P(1, 0), n1 = P(0.86, -0.15), n2 = P(0.9, -0.55), c2 = P(0.5, -0.95), b0 = P(0, -0.45);
    ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.quadraticCurveTo(c1.x, c1.y, tip.x, tip.y);
    if (notch) { ctx.lineTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); }
    ctx.quadraticCurveTo(c2.x, c2.y, b0.x, b0.y); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); inkIt(ctx, 0.8);
    if (edge) { const r0 = P(0.12, 0.2), r1 = P(0.82, 0.25); ctx.strokeStyle = edge; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(r0.x, r0.y); ctx.lineTo(r1.x, r1.y); ctx.stroke(); }
  }
  const EZ = { lin: (t) => t, io: U.easeInOutSine, out: U.easeOutCubic, snap: (t) => 1 - Math.pow(1 - t, 4), in: U.easeInCubic };
  function sampleKeys(keys, t) {
    if (t <= keys[0][0]) return Object.assign({}, keys[0][1]);
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i], k = EZ[b[2] || 'io']((t - a[0]) / (b[0] - a[0] || 1)), o = {};
        for (const q in b[1]) o[q] = a[1][q] + (b[1][q] - a[1][q]) * k;
        return o;
      }
    }
    return Object.assign({}, keys[keys.length - 1][1]);
  }
  // two-bone IK in plain screen angles; bend = ±1 picks the elbow side
  function ik(o, t, a, b, bend) {
    const dx = t.x - o.x, dy = t.y - o.y, d0 = Math.hypot(dx, dy) || 1, d = U.clamp(d0, Math.abs(a - b) + 1, a + b - 0.5);
    const ang = Math.atan2(dy, dx), al = Math.acos(U.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), ea = ang + bend * al;
    return { el: { x: o.x + Math.cos(ea) * a, y: o.y + Math.sin(ea) * a }, end: { x: o.x + dx / d0 * d, y: o.y + dy / d0 * d } };
  }
  // dizzy sparks orbiting a dazed foe's head
  function dazed(ctx, x, y, t, col) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col;
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * TAU / 3, px = x + Math.cos(a) * 14, py = y + Math.sin(a) * 4.5;
      ctx.beginPath(); ctx.moveTo(px, py - 3.2); ctx.lineTo(px + 1, py - 1); ctx.lineTo(px + 3.2, py); ctx.lineTo(px + 1, py + 1); ctx.lineTo(px, py + 3.2); ctx.lineTo(px - 1, py + 1); ctx.lineTo(px - 3.2, py); ctx.lineTo(px - 1, py - 1); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  const near = (e, r = 900) => Math.abs(e.x - G.game.player.x) < r;

  /* ---------------- SFX ---------------- */
  Object.assign(G.SFX, {
    // a crow's caw through a cracked bell: rasp + two clashing partials
    c1_caw(t) {
      const A = G.AudioKit;
      A.noise(t, 0.01, 0.12, 0.22, 'bandpass', 1500, 820, 2.2, 0.15);
      A.tone('sawtooth', 640, t, 0.008, 0.035, 0.2, { to: 410, filter: 'bandpass', ff: 1300, q: 2, wet: 0.2 });
      A.bell(A.mtof(78), t + 0.02, 0.03, 0.9, 0.5, 1.2); A.bell(A.mtof(79), t + 0.03, 0.022, 0.7, 0.5, 1.2);
    },
    c1_dive(t) { const A = G.AudioKit; A.noise(t, 0.04, 0.16, 0.3, 'bandpass', 600, 2200, 1.2, 0.08); A.bell(A.mtof(71), t + 0.05, 0.035, 1.2, 0.5, 0.8); },
    c1_flap(t) { G.AudioKit.noise(t, 0.012, 0.05, 0.09, 'lowpass', 900, 300, 0.8, 0.02); },
    c1_bellThud(t) {
      const A = G.AudioKit;
      A.tone('sine', 90, t, 0.003, 0.4, 0.3, { to: 42, wet: 0.1 }); A.noise(t, 0.002, 0.18, 0.2, 'lowpass', 900, 160, 0.7, 0.08);
      A.bell(A.mtof(66), t, 0.07, 1.8, 0.6, 1.4); A.bell(A.mtof(67), t + 0.01, 0.05, 1.4, 0.6, 1.4);
    },
    c1_groan(t) {
      const A = G.AudioKit;
      A.tone('sawtooth', 74, t, 0.08, 0.07, 0.7, { to: 52, filter: 'lowpass', ff: 420, q: 3, wet: 0.25 });
      A.tone('sine', 55, t, 0.06, 0.18, 0.6, { to: 44, wet: 0.15 }); A.noise(t, 0.1, 0.06, 0.55, 'bandpass', 300, 180, 1.5, 0.2);
    },
    c1_stoneStep(t) { const A = G.AudioKit; A.tone('sine', 52, t, 0.003, 0.3, 0.2, { to: 34, wet: 0.05 }); A.noise(t, 0.002, 0.1, 0.12, 'lowpass', 420, 120, 0.7, 0.04); },
    c1_scrape(t) { G.AudioKit.noise(t, 0.05, 0.12, 0.45, 'bandpass', 900, 380, 1.4, 0.1); },
    c1_slam(t) {
      const A = G.AudioKit;
      A.tone('sine', 48, t, 0.004, 0.75, 0.75, { to: 24, wet: 0.25 }); A.noise(t, 0.003, 0.4, 0.6, 'lowpass', 1400, 80, 0.7, 0.3);
      A.noise(t + 0.02, 0.002, 0.14, 0.25, 'bandpass', 2600, 900, 1.2, 0.1); G.SFX.crystal(t + 0.04, 4);
    },
    c1_swing(t) { G.AudioKit.noise(t, 0.09, 0.2, 0.3, 'bandpass', 260, 900, 0.9, 0.08); },
  });

  /* =========================== 鐘鴉 BELL-CROW =========================== */
  const CROW = { amber: '#ffc65a', ember: '#ff9b3d', bronze: '#a26a36', patina: '#4f9a88', bone: '#ebe2d0', feath: '#2b2338', featherB: '#18121f', interior: '#1b0d12' };
  const crowWorld = (e, lx, ly) => {
    // local (facing-space, pre-pitch) point → world, matching the transforms in draw()
    const c = Math.cos(e.pitch || 0), s = Math.sin(e.pitch || 0), ox = lx, oy = ly + 24;
    return { x: e.x + e.facing * (ox * c - oy * s), y: e.y + (e.drawOff || 0) + (ox * s + oy * c) - 24 };
  };
  TYPES.c1_bellcrow = {
    name: '鐘鴉', en: 'BELL-CROW', w: 52, h: 46, hp: 40, bal: 34, col: CROW.amber, shards: 20,
    fly: true, hover: true, spawnT: 0.7, kbMul: 1.25, portrait: [3.6, 0.62],
    voice: () => G.SFX.play('c1_caw'),
    weapon: (e) => e.beak || { x: e.x + e.facing * 40, y: e.y - 30 },
    init(e) {
      e.flapP = Math.random() * TAU; e.clA = 0; e.clV = 0; e.pitch = 0; e.wTh = 0.6; e.wSp = 1; e.ruff = 0;
      // parried or broken in the air, it drops out of the sky (grounded, executable) and takes off again later
      const baseParried = e.onParried, baseBreak = e.breakBalance;
      e.onParried = function (h) { baseParried.call(this, h); if (!this.dead && this.state !== 'atk') { this.fly = false; this.grounded = 0; } };
      e.breakBalance = function () { baseBreak.call(this); this.fly = false; this.grounded = 0; };
    },
    think(e, dt) {
      const P = e.P, T = TYPES.c1_bellcrow;
      e.faceP();
      if (!e.fly) {
        // knocked down: flounders on the ground, then beats back into the air
        e.vx = U.approach(e.vx, 0, 900 * dt); e.grounded = (e.grounded || 0) + dt;
        if (e.grounded > 1.1 && e.onGround) { e.fly = true; e.vy = -330; G.SFX.play('c1_flap'); G.FX.dust(e.x, e.y, 8, { w: 40, speed: 160, size: 10 }); }
        return;
      }
      // it cruises just inside sword reach (Rinne's ground slashes top out around 140-160): above that it read as invulnerable
      if (e.hov == null) e.hov = 100 + Math.random() * 14;
      const dx = P.x - e.x, d = Math.abs(dx);
      // keep a wary distance on its own side of the player, bobbing on slow wingbeats
      const sideS = e.x < P.x ? -1 : 1, want = d > 700 ? e.x : P.x + sideS * 240;
      e.vx = U.approach(e.vx, U.clamp((want - e.x) * 2, -230, 230) * e.speedMul, 520 * dt);
      const gy = G.Phys.groundBelow(e.x, e.y - 4), base = gy < 1e8 ? gy : e.homeY + e.hov;
      const ty = Math.min(base, P.y + 40) - e.hov + Math.sin(e.t * 2.2) * 10;
      e.vy = U.approach(e.vy, U.clamp((ty - e.y) * 2.6, -240, 260), 900 * dt);
      if (e.cd <= 0 && d < 430 && Math.abs(P.y - e.y) < 460) {
        // the first crow you meet (e1 — before the dodge lesson) only ever dives with a white, parryable tell
        const drop = e.enc !== 'e1' && (d < 120 || (d < 260 && Math.random() < 0.3));
        e.startAtk(drop ? T.plummet : T.swoop);
      }
    },
    // white: a diving peck along a straight line through where you stood
    swoop: {
      dur: 1.8, cd: 1.5, track: false,
      tells: [{ t: 0.16, c: 'white' }],
      hits: [{ t0: 0.66, t1: 1.12, box: { x: -16, y: -46, w: 62, h: 46 }, dmg: 12, kb: 200, last: true, pbal: 40 }],
      onStart: (e) => { e.dvx = 0; e.dvy = 0; e.diveT = 0.35; },
      ev: [
        { t: 0.62, fn: (e) => {
          const P = e.P, dx = P.x - e.x, dy = (P.y - 4) - e.y, d = Math.hypot(dx, dy) || 1, sp = U.clamp(d / 0.34, 560, 1050);
          e.dvx = dx / d * sp; e.dvy = dy / d * sp; e.diveT = Math.min(0.5, d / sp);
          if (Math.abs(dx) > 8) e.facing = Math.sign(dx);
          G.SFX.play('c1_dive');
        } },
      ],
    },
    // red: climbs over you, rings, and drops beak-first like a falling bell — then sticks in the ground
    plummet: {
      dur: 2.65, cd: 1.7, track: false,
      tells: [{ t: 0.2, c: 'red', face: false }],
      hits: [{ t0: 0.86, t1: 1.4, box: { x: -30, y: -58, w: 60, h: 62 }, dmg: 18, red: true, kb: 300, last: true }],
      onStart: (e) => { e.landed = false; e.freed = false; e.landT = 0; },
      ev: [{ t: 0.66, fn: () => G.SFX.play('c1_bellThud') }, { t: 0.82, fn: () => G.SFX.play('whoosh', 1.1) }],
    },
    atkUpdate(e, dt) {
      const T = TYPES.c1_bellcrow, a = e.atk, st = e.st, P = e.P;
      if (a === T.swoop) {
        if (st < 0.62) { e.vx = U.approach(e.vx, -e.facing * 120, 900 * dt); e.vy = U.approach(e.vy, -130, 900 * dt); }
        else if (st < 0.62 + e.diveT) { e.vx = e.dvx; e.vy = e.dvy; }
        else if (st < 1.15) { e.vx = U.approach(e.vx, Math.sign(e.dvx || e.facing) * 240, 1600 * dt); e.vy = U.approach(e.vy, -190, 3000 * dt); }
        else { e.vx = U.approach(e.vx, 0, 500 * dt); e.vy = U.approach(e.vy, -30, 600 * dt); }
      } else if (a === T.plummet) {
        const gy = G.Phys.groundBelow(e.x, e.y - 4);
        if (st < 0.7) {
          e.vx = U.approach(e.vx, U.clamp((P.x - e.x) * 5, -470, 470), 2600 * dt);
          const ty = Math.min(gy < 1e8 ? gy : P.y, P.y) - 250; e.vy = U.clamp((ty - e.y) * 5, -440, 440);
        } else if (st < 0.82) { e.vx = U.approach(e.vx, 0, 4000 * dt); e.vy = U.approach(e.vy, -20, 4000 * dt); }
        else if (!e.landed) {
          e.vx = 0; e.vy = 1700;
          if (e.onGround) {
            e.landed = true; e.landT = st; e.vy = 0;
            G.game.shake(0.32); G.SFX.play('c1_bellThud'); G.SFX.play('impact');
            G.FX.dust(e.x, e.y, 16, { w: 70, speed: 260, size: 12 });
            G.FX.ring(e.x, e.y, 6, 110, 0.4, CROW.amber, 4, { flat: 0.2 }); G.FX.shards(e.x, e.y - 6, 8, CROW.amber, 380);
          }
        } else {
          e.vx = 0;
          if (st > e.landT + 0.08) e.hitsDone[0] = true;   // only the fall itself hurts, not the stuck bird
          if (st > 2.1 && !e.freed) { e.freed = true; e.vy = -420; G.SFX.play('c1_flap'); G.FX.dust(e.x, e.y, 10, { w: 30, speed: 200, size: 9 }); }
          e.vy = e.freed ? U.approach(e.vy, -140, 900 * dt) : 0;
        }
      }
    },
    draw(ctx, e, ghost) {
      const dt = G.game.dtVis, T = TYPES.c1_bellcrow, st = e.st, a = e.state === 'atk' ? e.atk : null;
      const dying = e.state === 'die' ? U.clamp(st / 0.5, 0, 1) : 0;
      const downed = (e.state === 'broken' || e.state === 'executed' || (!e.fly && e.state !== 'die'));
      const emergeK = K.emerge(ctx, e);
      // ---- wing/body targets per state ----
      let th, sp, pitch, rate = 9, beak = 0.12;
      const flapTh = (amp, base) => base + amp * Math.sin(e.flapP);
      if (a === T.swoop) {
        if (st < 0.62) { const k = U.clamp(st / 0.45, 0, 1); th = U.lerp(0.6, 1.45, k); sp = U.lerp(1, 1.3, k); pitch = -0.35 * k; beak = 0.2 + 0.6 * k; rate = 3; }
        else if (st < 0.62 + e.diveT + 0.04) { th = 0.12; sp = 0.3; pitch = U.clamp(Math.atan2(e.dvy, Math.abs(e.dvx) + 1), -0.9, 1.0); beak = 0.9; rate = 0; }
        else { th = flapTh(0.85, 0.6); sp = 1.1; pitch = -0.25; rate = 15; beak = 0.3; }
      } else if (a === T.plummet) {
        if (st < 0.7) { th = flapTh(0.9, 0.7); sp = 1.15; pitch = 0.1; rate = 16; beak = 0.4; }
        else if (st < 0.82) { th = 1.4; sp = 1.35; pitch = 0.45; rate = 0; beak = 0.8; }
        else if (!e.landed) { th = 1.55; sp = 0.15; pitch = 1.45; rate = 0; beak = 0.1; }
        else if (!e.freed) { th = flapTh(0.7, 0.2); sp = 1.2; pitch = 1.3 + Math.sin(e.t * 30) * 0.06; rate = 20; beak = 0; }
        else { th = flapTh(0.9, 0.6); sp = 1.1; pitch = 0.2; rate = 16; }
      } else if (downed) { th = -0.55 + Math.sin(e.t * 7) * 0.12; sp = 1.15; pitch = -0.3; rate = 0; beak = 0.5; }
      else if (e.state === 'hurt' || e.state === 'recoil') { th = 1.2; sp = 1.3; pitch = -0.5; rate = 0; beak = 0.7; }
      else { th = flapTh(0.8, 0.55); sp = 0.95 + 0.15 * Math.cos(e.flapP); pitch = U.clamp(e.vx * e.facing * 0.0011, -0.25, 0.25) + Math.sin(e.flapP) * 0.04; }
      if (dying) { th = U.lerp(th, -0.4, dying); rate = 0; }
      if (dt > 0) {
        const pf = e.flapP; e.flapP += rate * dt;
        if (rate > 0 && Math.floor(pf / TAU) !== Math.floor(e.flapP / TAU) && near(e, 700)) G.SFX.play('c1_flap');
        const kk = 1 - Math.exp(-20 * dt);
        e.wTh += (th - e.wTh) * kk; e.wSp += (sp - e.wSp) * kk; e.pitch += (pitch - e.pitch) * (1 - Math.exp(-14 * dt));
        // the clapper hangs toward the ground and swings with every change of speed
        const target = -e.pitch - e.vx * e.facing * 0.0012;
        e.clV += ((target - e.clA) * 70 - e.clV * 4) * dt; e.clA += e.clV * dt;
      }
      // ---- ground shadow / red landing mark (world space) ----
      const gy = G.Phys.groundBelow(e.x, e.y - 4);
      if (gy < 1e8 && !dying) {
        const hgt = gy - e.y, k = U.clamp(1 - hgt / 420, 0.15, 1);
        ctx.fillStyle = `rgba(10,4,14,${0.28 * k})`; ctx.beginPath(); ctx.ellipse(e.x, gy - 1, 26 * k + 6, 4.5 * k + 1, 0, 0, TAU); ctx.fill();
        if (a === T.plummet && st > 0.15 && !e.landed) {
          const pulse = 0.55 + 0.45 * Math.sin(e.t * 22), r = 34 - U.clamp(st / 0.82, 0, 1) * 8;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = U.rgba(K.CRIM, 0.5 + 0.4 * pulse); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(e.x, gy - 1, r, r * 0.2, 0, 0, TAU); ctx.stroke();
          ctx.fillStyle = U.rgba(K.CRIM, 0.18 + 0.12 * pulse); ctx.beginPath(); ctx.ellipse(e.x, gy - 1, r * 0.7, r * 0.14, 0, 0, TAU); ctx.fill();
          ctx.restore();
        }
      }
      // ---- body ----
      const off = -emergeK * 70 + dying * dying * 26 + (downed ? 0 : Math.sin(e.flapP + 0.6) * 1.6);
      e.drawOff = off;
      ctx.save();
      ctx.globalAlpha *= (1 - emergeK) * (1 - dying * dying);
      ctx.translate(e.x, e.y + off); ctx.scale(e.facing, 1);
      const wob = Math.max(e.hitK, e.state === 'hurt' ? 1 - Math.min(1, st / (e.hurtDur || 0.36)) : 0);
      ctx.translate(0, -24); ctx.rotate(e.pitch + Math.sin(e.t * 46) * 0.12 * wob); ctx.translate(0, 24);
      const S = { x: -3, y: -44 };
      this.wing(ctx, { x: S.x + 5, y: S.y - 2 }, e.wTh + 0.2, e.wSp * 0.9, false, dying);
      // tail fan
      for (let i = 0; i < 5; i++) {
        const ang = PI - 0.32 + i * 0.13 + Math.sin(e.t * 3 + i) * 0.04 - e.pitch * 0.3 + (downed ? 0.35 : 0);
        feather(ctx, -8, -39, ang, 24 + (i === 2 ? 6 : i % 2 ? 3 : 0) + dying * 6, 5, i % 2 ? CROW.feath : CROW.featherB, 'rgba(255,214,170,0.22)', i === 1 || i === 4);
      }
      // near wing sits behind the bell so the bronze body always reads
      this.wing(ctx, S, e.wTh, e.wSp, true, dying);
      // the bell body (crown up, mouth down) with its clapper
      ctx.save(); ctx.translate(0, -41);
      const bellPath = () => { ctx.beginPath(); ctx.moveTo(-8, 1); ctx.quadraticCurveTo(-11, 10, -11.5, 16); ctx.quadraticCurveTo(-13, 24, -18, 28.5); ctx.lineTo(18, 28.5); ctx.quadraticCurveTo(13, 24, 11.5, 16); ctx.quadraticCurveTo(11, 10, 8, 1); ctx.quadraticCurveTo(0, -3.5, -8, 1); ctx.closePath(); };
      // clapper (behind the lip)
      ctx.save(); ctx.translate(0, 18); ctx.rotate(e.clA);
      ctx.strokeStyle = '#3a2618'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 15); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 17, 3.4, 4, 0, 0, TAU); ctx.fillStyle = cel(ctx, '#6b4426', 0, 17, 1, 0, 4); ctx.fill(); inkIt(ctx, 0.9);
      ctx.restore();
      bellPath(); ctx.fillStyle = cel(ctx, CROW.bronze, 0, 14, 1, 0, 18); ctx.fill();
      ctx.save(); bellPath(); ctx.clip();
      // verdigris weathering + rings
      ctx.fillStyle = 'rgba(79,154,136,0.55)';
      ctx.beginPath(); ctx.moveTo(-14, 17); ctx.quadraticCurveTo(-8, 15, -5, 21); ctx.quadraticCurveTo(-9, 25, -16, 26); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.ellipse(6, 6, 2.6, 1.6, -0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(10, 25, 4, 2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(40,18,10,0.7)'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(-11, 7); ctx.quadraticCurveTo(0, 9.5, 11, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-15, 23.5); ctx.quadraticCurveTo(0, 26.5, 15, 23.5); ctx.stroke();
      ctx.restore();
      inkIt(ctx, 1.3);
      // mouth of the bell (dark, seen from slightly below)
      ctx.beginPath(); ctx.ellipse(0, 28.5, 17.5, 2.6, 0, 0, PI); ctx.fillStyle = CROW.interior; ctx.fill(); inkIt(ctx, 1.1);
      // Hush crack with amber light leaking, crystals forcing through
      const crackHot = 0.55 + 0.25 * Math.sin(e.t * 5) + (e.tellT > 0 ? 0.4 : 0) + dying;
      ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(-1, 8); ctx.lineTo(-4.5, 13); ctx.lineTo(0, 19); ctx.lineTo(-2, 27);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(CROW.amber, Math.min(1, crackHot)); ctx.lineWidth = 0.9; ctx.stroke();
      glow(ctx, -1, 13, 16 + crackHot * 6, CROW.ember, 0.28 * crackHot); ctx.restore();
      shard(ctx, -3.5, 10, 9, 2.6, -1.05, '#ffe6a8', '#d98a2c');
      shard(ctx, 0.5, 18, 7, 2.2, 0.95, '#ffe6a8', '#d98a2c');
      // canopy loop where the spine joins the crown
      ctx.beginPath(); ctx.arc(0, -3, 3, PI, TAU); ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.stroke(); ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
      // ruff + skull head + crystal beak
      ctx.fillStyle = CROW.feath;
      ctx.beginPath(); ctx.moveTo(-9, -36); ctx.lineTo(-5, -48); ctx.lineTo(-1, -42); ctx.lineTo(3, -51); ctx.lineTo(7, -44); ctx.lineTo(12, -50); ctx.lineTo(14, -42); ctx.lineTo(19, -44); ctx.lineTo(16, -35); ctx.lineTo(8, -33); ctx.closePath(); ctx.fill(); inkIt(ctx, 1);
      ctx.save(); ctx.translate(20, -42); ctx.rotate(-0.1 + (downed ? 0.5 : 0));
      const open = U.clamp(beak, 0, 1) * 0.38;
      // lower mandible
      ctx.save(); ctx.translate(5, 2); ctx.rotate(open);
      ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(19, 2.5); ctx.lineTo(0, 3.5); ctx.closePath(); ctx.fillStyle = '#5a3a20'; ctx.fill(); inkIt(ctx, 0.9);
      ctx.restore();
      // skull
      ctx.beginPath(); ctx.moveTo(-6, 2); ctx.quadraticCurveTo(-7, -7, 1, -7.5); ctx.quadraticCurveTo(7, -7.5, 9, -2); ctx.lineTo(8, 4); ctx.quadraticCurveTo(2, 7, -4, 5); ctx.closePath();
      ctx.fillStyle = cel(ctx, CROW.bone, 1, -1, 0.3, -1, 8); ctx.fill(); inkIt(ctx, 1.1);
      // upper mandible: dark horn turning into an amber crystal tip
      ctx.save(); ctx.translate(5, 0.5); ctx.rotate(-open * 0.35);
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(12, -4, 24, 2.2); ctx.lineTo(0, 2.5); ctx.closePath(); ctx.fillStyle = '#2a1c22'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(13, -2.2); ctx.quadraticCurveTo(19, -1, 24, 2.2); ctx.lineTo(13, 2.4); ctx.closePath(); ctx.fillStyle = '#f2b04a'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(12, -4, 24, 2.2); ctx.lineTo(0, 2.5); ctx.closePath(); inkIt(ctx, 1);
      ctx.restore();
      // socket + ember eye
      ctx.fillStyle = '#140a10'; ctx.beginPath(); ctx.ellipse(2, -2.5, 3.2, 2.6, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const eyeK = e.state === 'die' ? 1 - dying : downed ? 0.35 : 1;
      glow(ctx, 2.5, -2.5, 11 + (e.tellT > 0 ? 8 : 0), CROW.amber, 0.55 * eyeK);
      ctx.fillStyle = U.rgba('#fff2c8', eyeK); ctx.beginPath(); ctx.arc(2.8, -2.6, 1.3, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(120,96,80,0.8)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(-1, -3); ctx.lineTo(-3.5, 0); ctx.stroke();
      ctx.restore();
      if (e.tellT > 0) {
        const b = { x: 46, y: -36 };
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, b.x, b.y, 26, e.tellCol === 'red' ? K.CRIM : '#ffffff', e.tellT); ctx.restore();
      }
      if (downed && e.state !== 'die') dazed(ctx, 22, -60, e.t, '#ffe6a8');
      ctx.restore();
      e.beak = crowWorld(e, 44 * Math.cos(-0.1) - 1, -40);
      // death: loose feathers drifting off
      if (dying > 0) {
        ctx.save(); ctx.globalAlpha *= 1 - dying;
        for (let i = 0; i < 6; i++) {
          const a0 = i * 1.7 + 0.4, r = 10 + dying * (30 + i * 7);
          feather(ctx, e.x + Math.cos(a0) * r, e.y - 30 + Math.sin(a0) * r * 0.6 + dying * 18, a0 + dying * 3, 13, 3.2, CROW.feath, null, false);
        }
        ctx.restore();
      }
    },
    // ragged wing: covert arm + secondaries + fanned primaries (some tipped with Hush crystal)
    wing(ctx, S, th, spread, isNear, dying) {
      const d = { x: -Math.cos(th), y: -Math.sin(th) }, W = { x: S.x + d.x * 16, y: S.y + d.y * 16 };
      const col = isNear ? CROW.feath : CROW.featherB, edge = isNear ? 'rgba(255,214,170,0.5)' : 'rgba(210,180,200,0.18)';
      for (let i = 0; i < 5; i++) {
        const k = i / 4, bx = S.x + d.x * 16 * k, by = S.y + d.y * 16 * k;
        feather(ctx, bx, by, th + PI - 1.2 - k * 0.22, 19 + k * 7, 6.2, col, edge, i % 2 === 1);
      }
      for (let j = 0; j < 6; j++) {
        const ang = th + PI + (j - 2.2) * 0.19 * spread - 0.12, len = [27, 33, 38, 39, 35, 28][j] * (1 - dying * 0.3);
        feather(ctx, W.x, W.y, ang, len, 6.4, col, edge, j % 2 === 0);
        if (isNear && (j === 2 || j === 4)) {
          const tx = W.x + Math.cos(ang) * len * 0.82, ty = W.y + Math.sin(ang) * len * 0.82;
          shard(ctx, tx, ty, 8, 2, ang + PI / 2, '#ffe6a8', '#d98a2c');
        }
      }
      Rig.limb(ctx, S, W, 4.6, 3.2, isNear ? '#3a3046' : '#221b2b', { noHatch: true });
    },
  };

  /* =========================== 負柱者 PILLAR-BEARER =========================== */
  const PBC = { skin: '#7e7489', skinB: '#4c4459', leather: '#6e4632', hood: '#4a3c50', mask: '#5a5463', marble: '#d6ccbd', cap: '#e7ddcb', acc: '#a98bff', accHi: '#e9dcff' };
  // gf/gb slide the two grips along the column (0 = the default grips derived from g)
  const PDEF = { lean: 0.42, drop: 0, a: -0.14, hx: -8, hy: -30, g: 0, hd: 0, gf: 0, gb: 0 };
  const pfull = (p) => Object.assign({}, PDEF, p);
  const PB = {
    // at rest the column lies diagonally across its body — lower end in its fists, the carved capital raised behind its
    // head — a bearer, not a gunner; every attack starts by heaving it off that shoulder
    idle: (t) => pfull({ lean: 0.42 + Math.sin(t * 1.7) * 0.025, drop: Math.sin(t * 1.7) * 1.6, a: -2.48 + Math.sin(t * 1.7 + 0.6) * 0.03, hx: 14.6, hy: 36, g: 0.55, gf: -47, gb: -21.6 }),
    lift: pfull({ lean: 0.2, drop: 6, a: -2.05, hx: 6, hy: -26, g: 0.9, hd: -0.25 }),
    high: pfull({ lean: -0.14, drop: -2, a: -2.3, hx: 0, hy: -42, g: 1, hd: -0.4 }),
    impact: pfull({ lean: 0.8, drop: 16, a: 0.4, hx: 2, hy: 17, g: 1, hd: 0.15 }),
    stuck: pfull({ lean: 0.86, drop: 19, a: 0.42, hx: 1, hy: 19, g: 1, hd: 0.3 }),
    crouch: pfull({ lean: 0.95, drop: 18, a: -0.3, hx: -18, hy: -16, g: -0.4, hd: -0.3 }),
    rush: pfull({ lean: 1.02, drop: 13, a: -0.22, hx: -16, hy: -16, g: -0.4, hd: -0.35 }),
    skid: pfull({ lean: 0.6, drop: 12, a: -0.18, hx: -4, hy: -20, g: 0.1, hd: 0 }),
    wind: pfull({ lean: 0.04, drop: 8, a: -2.95, hx: -22, hy: -14, g: 0.85, hd: -0.15 }),
    strike: pfull({ lean: 0.6, drop: 10, a: 0.02, hx: 14, hy: -2, g: 0.85, hd: 0.15 }),
    follow: pfull({ lean: 0.66, drop: 11, a: 0.38, hx: 16, hy: 8, g: 0.85, hd: 0.2 }),
    hurt: pfull({ lean: 0.1, drop: 4, a: -2.75, hx: 10, hy: 30, g: 0.55, hd: -0.45, gf: -40, gb: -20 }),
    broken: (t) => pfull({ lean: 0.98 + Math.sin(t * 2.4) * 0.04, drop: 31, a: 0.58, hx: 8, hy: 16, g: 0.45, hd: 0.55 + Math.sin(t * 2.4) * 0.08 }),
  };
  function pillarSkel(p, gaitP, moving) {
    const hip = { x: 0, y: -56 + p.drop }, Lt = 50, s = Math.sin(p.lean), c = Math.cos(p.lean);
    const u = { x: s, y: -c }, n = { x: c, y: s };
    const Q = (a, f) => ({ x: hip.x + u.x * a * Lt + n.x * f, y: hip.y + u.y * a * Lt + n.y * f });
    const chest = Q(1, 0), H = { x: chest.x + p.hx, y: chest.y + p.hy };
    const dir = { x: Math.cos(p.a), y: Math.sin(p.a) }, down = { x: -dir.y, y: dir.x };
    const Lb = 72 - 50 * p.g, Lf = 73 + 50 * p.g;
    const back = { x: H.x - dir.x * Lb, y: H.y - dir.y * Lb }, tip = { x: H.x + dir.x * Lf, y: H.y + dir.y * Lf };
    const kF = U.lerp(30, 6, p.g) + p.gf, kB = U.lerp(36, 28, p.g) + p.gb;
    const gF = { x: H.x + dir.x * kF + down.x * 10, y: H.y + dir.y * kF + down.y * 10 };
    const gB = { x: H.x - dir.x * kB + down.x * 10, y: H.y - dir.y * kB + down.y * 10 };
    const sF = Q(0.9, 13), sB = Q(0.94, -7);
    const armF = ik(sF, gF, 33, 31, gF.x >= sF.x ? 1 : -1), armB = ik(sB, gB, 33, 31, gB.x >= sB.x ? 1 : -1);
    // feet: heavy plodding gait when walking, planted otherwise
    const st = moving ? 13 : 0, lift = moving ? 9 : 0;
    const fF = { x: 15 + Math.cos(gaitP) * st, y: -Math.max(0, Math.sin(gaitP)) * lift }, fB = { x: -13 + Math.cos(gaitP + PI) * st, y: -Math.max(0, Math.sin(gaitP + PI)) * lift };
    const hF = Q(0.02, 7), hB = Q(0.02, -7);
    const legF = ik(hF, { x: fF.x, y: fF.y - 7 }, 29, 28, -1), legB = ik(hB, { x: fB.x, y: fB.y - 7 }, 29, 28, -1);
    return { hip, u, n, Q, chest, H, dir, down, back, tip, sF, sB, armF, armB, legF, legB, fF, fB, hF, hB, head: Q(0.96, 30) };
  }
  TYPES.c1_pillar = {
    name: '負柱者', en: 'PILLAR-BEARER', w: 66, h: 128, hp: 125, bal: 95, col: PBC.acc, shards: 36,
    poise: true, kbMul: 0.35, spawnT: 1.0, portrait: [1.9, 0.9],
    voice: () => G.SFX.play('c1_groan'),
    weapon: (e) => e.tipW || { x: e.x + e.facing * 90, y: e.y - 130 },
    init(e) { e.gp = 0; e.pp = null; e.dust = 0; },
    think(e, dt) {
      const T = TYPES.c1_pillar; e.faceP();
      const d = e.distP(), want = 125;
      if (d > want + 30) e.vx = U.approach(e.vx, e.facing * 92 * e.speedMul, 500 * dt);
      else if (d < 70) e.vx = U.approach(e.vx, -e.facing * 60, 500 * dt);
      else e.vx = U.approach(e.vx, 0, 600 * dt);
      if (e.cd > 0 || Math.abs(e.P.y - e.y) > 150) return;
      if (d < 150) e.startAtk(Math.random() < 0.55 ? T.sweep : T.slam);
      else if (d < 200) e.startAtk(T.slam);
      else if (d > 230 && d < 400) e.startAtk(T.charge);
    },
    // red: lifts the column overhead and brings it down — it stays stuck in the ground for a moment
    slam: {
      dur: 2.55, cd: 1.5, trackSpeed: 170,
      tells: [{ t: 0.3, c: 'red' }],
      hits: [{ t0: 0.97, t1: 1.09, box: { x: 28, y: -84, w: 126, h: 88 }, dmg: 24, red: true, kb: 380, last: true }],
      poses: [[0, null], [0.42, PB.lift, 'io'], [0.86, PB.high, 'out'], [0.97, PB.impact, 'in'], [1.9, PB.stuck, 'lin'], [2.55, null, 'io']],
      ev: [
        { t: 0.42, fn: () => G.SFX.play('c1_scrape') },
        { t: 0.97, fn: (e) => {
          const tip = e.tipW || { x: e.x + e.facing * 140, y: e.y };
          G.game.shake(0.6); G.SFX.play('c1_slam');
          G.FX.dust(tip.x, e.y, 26, { w: 110, speed: 320, size: 16 });
          G.FX.ring(tip.x, e.y, 10, 150, 0.5, PBC.acc, 5, { flat: 0.2 }); G.FX.shards(tip.x, e.y - 8, 12, PBC.acc, 520);
          G.game.hazards.push({ t: 0, life: 1.8, x: tip.x - e.facing * 20, y: e.y, f: e.facing, update() { }, draw: drawCracks });
        } },
        { t: 1.95, fn: () => G.SFX.play('c1_scrape') },
      ],
    },
    // white: shoulder-first rush with the column braced across its back
    charge: {
      dur: 1.85, cd: 1.7, track: false,
      tells: [{ t: 0.18, c: 'white' }],
      moves: [{ t0: 0.7, t1: 1.12, v: 720 }],
      hits: [{ t0: 0.7, t1: 1.14, box: { x: 0, y: -125, w: 74, h: 115 }, dmg: 17, kb: 340, last: true, pbal: 70 }],
      poses: [[0, null], [0.55, PB.crouch, 'io'], [0.7, PB.rush, 'snap'], [1.14, PB.rush, 'lin'], [1.4, PB.skid, 'out'], [1.85, null, 'io']],
      ev: [{ t: 0.66, fn: () => { G.SFX.play('c1_groan'); G.SFX.play('c1_scrape'); } }],
    },
    // white: a quick backhand sweep of the column when you crowd it
    sweep: {
      dur: 1.45, cd: 1.2, trackSpeed: 170,
      tells: [{ t: 0.12, c: 'white' }],
      moves: [{ t0: 0.6, t1: 0.68, v: 160 }],
      hits: [{ t0: 0.64, t1: 0.77, box: { x: -10, y: -150, w: 170, h: 122 }, dmg: 15, kb: 260, last: true, pbal: 45 }],
      poses: [[0, null], [0.5, PB.wind, 'io'], [0.66, PB.strike, 'snap'], [0.95, PB.follow, 'out'], [1.45, null, 'io']],
      ev: [{ t: 0.62, fn: () => G.SFX.play('c1_swing') }],
    },
    atkUpdate(e, dt) {
      const T = TYPES.c1_pillar;
      if (e.atk === T.charge) {
        if (e.st > 0.7 && e.st < 1.14) {
          e.dust -= dt; if (e.dust <= 0) { e.dust = 0.06; G.FX.dust(e.x - e.facing * 20, e.y, 3, { w: 20, speed: 120, size: 9 }); }
          if (e.hitsDone[0]) e.vx *= Math.exp(-14 * dt);   // the rush stops dead on impact
          if (G.game.arena && e.enc === G.game.arena.id && (e.x <= G.game.arena.x0 + 31 || e.x >= G.game.arena.x1 - 31)) e.vx = 0;
        } else if (e.st >= 1.14) e.vx = U.approach(e.vx, 0, 1700 * dt);
      }
    },
    draw(ctx, e, ghost) {
      const dt = G.game.dtVis, st = e.st, T = TYPES.c1_pillar;
      // ---- pose ----
      // walking — and the heavy shuffle when the engine steps it into range during a wind-up (no skating)
      const stepping = e.state === 'atk' && e.atk !== T.charge && Math.abs(e.vx) > 25 && e.onGround;
      const moving = (Math.abs(e.vx) > 25 && e.onGround && e.state !== 'atk' && e.state !== 'broken' && e.state !== 'die') || stepping;
      let target;
      if (e.state === 'atk' && e.atk && e.atk.poses) {
        const ks = e.atk.poses.map((k) => [k[0], k[1] || PB.idle(e.t), k[2]]);
        target = sampleKeys(ks, st);
      } else if (e.state === 'hurt' || e.state === 'recoil') { const w = Math.sin(Math.min(1, st / (e.hurtDur || 0.4)) * PI); target = sampleKeys([[0, PB.idle(e.t)], [1, PB.hurt]], w); }
      else if (e.state === 'broken' || e.state === 'executed' || e.state === 'die') target = PB.broken(e.t);   // dying: it folds under the column
      else target = PB.idle(e.t);
      if (e.hitK > 0) { target = Object.assign({}, target); target.lean -= 0.22 * e.hitK; target.hd -= 0.3 * e.hitK; target.a -= 0.1 * e.hitK; }
      if (moving) target.drop += Math.abs(Math.sin(e.gp)) * 3.5 - 1.5;
      if (!e.pp) e.pp = Object.assign({}, target);
      const kk = 1 - Math.exp(-(e.state === 'atk' ? 32 : e.hitK > 0 ? 40 : e.state === 'die' ? 18 : 12) * dt);
      for (const q in PDEF) e.pp[q] += (target[q] - e.pp[q]) * kk;
      if (dt > 0) {
        if (moving) {
          const prev = Math.floor(e.gp / PI); e.gp += Math.abs(e.vx) * dt * PI / 34;
          if (Math.floor(e.gp / PI) !== prev && near(e, 750)) { G.SFX.play('c1_stoneStep'); if (!ghost) G.FX.dust(e.x + e.facing * (Math.floor(e.gp / PI) % 2 ? 14 : -12), e.y, 3, { w: 16, speed: 70, size: 8 }); }
        } else if (e.state !== 'atk' || e.atk !== T.charge) e.gp = U.approach(e.gp, Math.round(e.gp / PI) * PI, dt * 4);
        if (e.state === 'atk' && e.atk === T.charge && st > 0.7 && st < 1.14) e.gp += dt * 15;
      }
      const charging = e.state === 'atk' && e.atk === T.charge && st > 0.68 && st < 1.2;
      const J = pillarSkel(e.pp, e.gp, moving || charging);
      const dying = e.state === 'die' ? U.clamp(st / 0.5, 0, 1) : 0;
      const sink = K.emerge(ctx, e) * 130 + dying * dying * 16;
      e.tipW = { x: e.x + e.facing * J.tip.x, y: e.y + sink + J.tip.y };
      if (dying > 0.36 && !e.thud && !ghost && dt > 0) {   // the column hits the ground as it falls
        e.thud = true; const tx = e.x + e.facing * 70;
        G.game.shake(0.22); G.SFX.play('c1_stoneStep'); G.SFX.play('impact');
        G.FX.dust(tx, e.y, 14, { w: 90, speed: 230, size: 13 }); G.FX.shards(tx, e.y - 8, 9, PBC.marble, 380);
      }
      ctx.save();
      ctx.globalAlpha *= 1 - dying * dying;
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing, 1);
      const LC = Rig.limbChain;
      // ---- back limbs (shadow side) ----
      LC(ctx, [J.hB, J.legB.el, J.legB.end], [9, 8, 6], PBC.skinB);
      this.foot(ctx, J.legB.end, PBC.skinB);
      LC(ctx, [J.sB, J.armB.el, J.armB.end], [9.5, 8.5, 7.5], PBC.skinB);
      this.fist(ctx, J.armB.end, '#3e3748');
      // ---- torso: hunched mass with a stony spine ----
      const Q = J.Q;
      const tp = [Q(-0.06, 14), Q(0.0, -15), Q(0.42, -26), Q(0.84, -30), Q(1.12, -18), Q(1.24, 0), Q(1.12, 16), Q(0.86, 26), Q(0.48, 23)];
      blob(ctx, tp); const mc = Q(0.6, 0);
      ctx.fillStyle = cel(ctx, PBC.skin, mc.x, mc.y, J.n.x, J.n.y, 30); ctx.fill(); inkIt(ctx, 1.7);
      ctx.save(); blob(ctx, tp); ctx.clip();
      // stone plates breaking through the back
      const plate = (i) => { const a = 0.25 + i * 0.22, b = Q(a, -27 - (i === 2 ? 3 : 0)), b2 = Q(a + 0.12, -24), tipP = Q(a + 0.04, -36 - i % 2 * 3); ctx.moveTo(b.x, b.y); ctx.lineTo(tipP.x, tipP.y); ctx.lineTo(b2.x, b2.y); ctx.closePath(); };
      ctx.beginPath(); plate(0); plate(2); ctx.fillStyle = '#a39aa8'; ctx.fill();
      ctx.beginPath(); plate(1); plate(3); ctx.fillStyle = '#8d8494'; ctx.fill();
      ctx.beginPath(); for (let i = 0; i < 4; i++) plate(i); inkIt(ctx, 0.9);
      // musculature
      ctx.strokeStyle = 'rgba(14,6,22,0.55)'; ctx.lineWidth = 1;
      let p0 = Q(0.95, 6), p1 = Q(0.78, 18), p2 = Q(0.7, 25); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
      for (const a of [0.42, 0.56]) { p0 = Q(a, 14); p1 = Q(a + 0.02, 22); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); }
      p0 = Q(0.3, -12); p1 = Q(0.6, -18); p2 = Q(0.95, -14); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y); ctx.stroke();
      // violet Hush veins glowing under the skin
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(PBC.acc, 0.55 + 0.2 * Math.sin(e.t * 3)); ctx.lineWidth = 1.1;
      p0 = Q(1.0, -20); p1 = Q(0.8, -12); p2 = Q(0.62, -18); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      p0 = Q(0.48, -10); ctx.lineTo(p0.x, p0.y); ctx.moveTo(p1.x, p1.y); p0 = Q(0.7, -4); ctx.lineTo(p0.x, p0.y); ctx.stroke(); ctx.restore();
      ctx.restore();
      // bandolier with brass buckles
      const s0 = Q(0.46, 20), s1 = Q(1.08, -12), s2 = Q(1.0, -18), s3 = Q(0.4, 14);
      poly(ctx, [s0, s1, s2, s3]); ctx.fillStyle = '#4a2e22'; ctx.fill(); inkIt(ctx, 0.9);
      ctx.beginPath(); for (const k of [0.3, 0.62]) { const b = { x: U.lerp(s3.x, s2.x, k), y: U.lerp(s3.y, s2.y, k) }; ctx.rect(b.x - 2.2, b.y - 2.2, 4.4, 4.4); }
      ctx.fillStyle = '#c9a25a'; ctx.fill(); inkIt(ctx, 0.7);
      // crystal cluster erupting from the hump
      const hc = Q(0.98, -24), ca = -0.5 + e.pp.lean;
      shard(ctx, hc.x - 3, hc.y + 2, 14, 3.4, ca - 0.6, PBC.accHi, '#6b4fc2');
      shard(ctx, hc.x + 2, hc.y, 19, 4.2, ca - 0.15, PBC.accHi, '#6b4fc2');
      shard(ctx, hc.x + 7, hc.y + 3, 11, 3, ca + 0.35, PBC.accHi, '#6b4fc2');
      // ---- front leg ----
      LC(ctx, [J.hF, J.legF.el, J.legF.end], [10, 9, 6.6], PBC.skin, { spec: 0.2 });
      Rig.limb(ctx, { x: J.legF.el.x * 0.7 + J.legF.end.x * 0.3, y: J.legF.el.y * 0.7 + J.legF.end.y * 0.3 }, { x: J.legF.el.x * 0.15 + J.legF.end.x * 0.85, y: J.legF.el.y * 0.15 + J.legF.end.y * 0.85 }, 8.2, 7, '#5d4a3e', { noHatch: true });
      this.foot(ctx, J.legF.end, PBC.skin);
      // mason's leather apron hanging from a rope belt, in front of the thighs
      const hp = J.hip, ap = [Q(0.36, 6), Q(0.4, 24), { x: hp.x + 30, y: hp.y + 30 }, { x: hp.x + 24, y: hp.y + 27 }, { x: hp.x + 19, y: hp.y + 37 }, { x: hp.x + 12, y: hp.y + 30 }, { x: hp.x + 6, y: hp.y + 35 }, { x: hp.x + 2, y: hp.y + 22 }];
      poly(ctx, ap); const apc = { x: hp.x + 16, y: hp.y + 16 };
      ctx.fillStyle = cel(ctx, PBC.leather, apc.x, apc.y, 1, 0, 16); ctx.fill(); inkIt(ctx, 1.2);
      ctx.strokeStyle = 'rgba(14,6,22,0.5)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(hp.x + 12, hp.y + 6); ctx.lineTo(hp.x + 12, hp.y + 29); ctx.moveTo(hp.x + 22, hp.y + 4); ctx.lineTo(hp.x + 24, hp.y + 26); ctx.stroke();
      // rope belt
      const b0 = Q(0.3, -24), b1 = Q(0.36, 26);
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
      ctx.strokeStyle = '#a58a5c'; ctx.lineWidth = 3; ctx.stroke(); ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgba(60,36,20,0.8)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); for (let k = 0.08; k < 1; k += 0.14) { const c = { x: U.lerp(b0.x, b1.x, k), y: U.lerp(b0.y, b1.y, k) }; ctx.moveTo(c.x - 1, c.y - 1.5); ctx.lineTo(c.x + 1.2, c.y + 1.5); } ctx.stroke();
      // ---- head: heavy hood + a pale carved-stone mask (cracked), one violet eye ----
      ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(e.pp.lean * 0.45 + e.pp.hd);
      ctx.beginPath(); ctx.moveTo(-15, -2); ctx.quadraticCurveTo(-11, -19, 3, -18); ctx.quadraticCurveTo(15, -16, 17, -5); ctx.lineTo(15, 11); ctx.quadraticCurveTo(2, 17, -11, 10); ctx.closePath();
      ctx.fillStyle = cel(ctx, PBC.hood, 0, -2, 1, 0, 16); ctx.fill(); inkIt(ctx, 1.4);
      ctx.fillStyle = '#17101c'; ctx.beginPath(); ctx.ellipse(6, 0, 10, 12.5, 0.1, 0, TAU); ctx.fill();
      // mask: broad brow, deep sockets, a stitched seam for a mouth
      const mk = () => { ctx.beginPath(); ctx.moveTo(1, -11); ctx.quadraticCurveTo(10, -14, 17, -9); ctx.lineTo(18, -4); ctx.lineTo(16, 2); ctx.quadraticCurveTo(17, 8, 13, 12); ctx.quadraticCurveTo(6, 14, 3, 9); ctx.quadraticCurveTo(0, 0, 1, -11); ctx.closePath(); };
      mk(); ctx.fillStyle = cel(ctx, '#d4c8b6', 9, 0, 1, -0.4, 9); ctx.fill(); inkIt(ctx, 1.2);
      ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(9, -6.5); ctx.lineTo(9.5, -2.5); ctx.lineTo(5, -2); ctx.closePath();
      ctx.moveTo(12, -6.8); ctx.lineTo(17, -6); ctx.lineTo(16.5, -2.5); ctx.lineTo(12.5, -2.6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a3040'; ctx.lineWidth = 0.95; ctx.beginPath(); ctx.moveTo(5, 6.5); ctx.lineTo(15, 5.5);
      for (const x of [7, 10, 13]) { ctx.moveTo(x, 4.5); ctx.lineTo(x + 0.3, 8); } ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(9, -13); ctx.lineTo(10.5, -8); ctx.lineTo(9, -4); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const eyeK = e.state === 'broken' ? 0.35 + 0.3 * Math.sin(e.t * 9) : 1 - dying;
      glow(ctx, 14.5, -4.3, 9 + (e.tellT > 0 ? 9 : 0), PBC.acc, 0.6 * eyeK);
      ctx.fillStyle = U.rgba(PBC.accHi, eyeK); ctx.beginPath(); ctx.ellipse(14.6, -4.4, 1.9, 1.3, 0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.restore();
      // ---- the column ----
      this.column(ctx, J.back, J.tip, 13.5, e);
      // ---- front arm over the column ----
      LC(ctx, [J.sF, J.armF.el, J.armF.end], [11, 9.5, 8], PBC.skin, { spec: 0.25 });
      Rig.limb(ctx, { x: J.armF.el.x * 0.55 + J.armF.end.x * 0.45, y: J.armF.el.y * 0.55 + J.armF.end.y * 0.45 }, { x: J.armF.el.x * 0.12 + J.armF.end.x * 0.88, y: J.armF.el.y * 0.12 + J.armF.end.y * 0.88 }, 9.6, 8.6, '#5d4a3e', { noHatch: true });
      this.fist(ctx, J.armF.end, '#6a6077');
      // shoulder boss of stone
      ctx.beginPath(); ctx.ellipse(J.sF.x, J.sF.y - 1, 12, 9, e.pp.lean - 0.4, 0, TAU); ctx.fillStyle = cel(ctx, '#9a90a3', J.sF.x, J.sF.y, 0.5, -0.8, 11); ctx.fill(); inkIt(ctx, 1.2);
      ctx.strokeStyle = 'rgba(14,6,22,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(J.sF.x - 6, J.sF.y - 5); ctx.lineTo(J.sF.x - 1, J.sF.y); ctx.lineTo(J.sF.x - 4, J.sF.y + 5); ctx.stroke();
      if (e.tellT > 0) { const c = { x: J.tip.x, y: J.tip.y }; ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, c.x, c.y, 34, e.tellCol === 'red' ? K.CRIM : '#ffffff', e.tellT); ctx.restore(); }
      if ((e.state === 'broken' || e.state === 'executed')) dazed(ctx, J.head.x, J.head.y - 22, e.t, PBC.accHi);
      if (dying > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(PBC.accHi, 1 - dying); ctx.lineWidth = 1.4;
        const c0 = Q(0.6, 0); ctx.beginPath(); ctx.moveTo(c0.x - 10, c0.y - 30); ctx.lineTo(c0.x + 3, c0.y - 8); ctx.lineTo(c0.x - 4, c0.y + 6); ctx.lineTo(c0.x + 8, c0.y + 24); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
    },
    foot(ctx, a, col) {
      ctx.beginPath(); ctx.moveTo(a.x - 9, a.y + 7); ctx.quadraticCurveTo(a.x - 9, a.y - 3, a.x - 1, a.y - 4); ctx.quadraticCurveTo(a.x + 9, a.y - 2, a.x + 14, a.y + 4); ctx.lineTo(a.x + 15, a.y + 7.5); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); inkIt(ctx, 1.1);
      ctx.strokeStyle = 'rgba(14,6,22,0.6)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); for (const k of [5, 9.5]) { ctx.moveTo(a.x + k, a.y + 1); ctx.lineTo(a.x + k + 0.8, a.y + 7); } ctx.stroke();
    },
    fist(ctx, a, col) {
      ctx.beginPath(); ctx.ellipse(a.x, a.y, 8.5, 7.5, 0, 0, TAU); ctx.fillStyle = col; ctx.fill(); inkIt(ctx, 1.1);
      ctx.strokeStyle = 'rgba(14,6,22,0.6)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); for (const k of [-3, 0.5, 4]) { ctx.moveTo(a.x + k + 2.6 * Math.cos(PI * 1.05), a.y - 2 + 2.6 * Math.sin(PI * 1.05)); ctx.arc(a.x + k, a.y - 2, 2.6, PI * 1.05, PI * 1.9); } ctx.stroke();
    },
    // broken cathedral column: fluted shaft, a carved capital at the business end, rebar and a Hush crystal growing out of it
    column(ctx, back, tip, r, e) {
      const dx = tip.x - back.x, dy = tip.y - back.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
      const P = (a, f) => ({ x: back.x + ux * a + nx * f, y: back.y + uy * a + ny * f });
      const capL = 24, sE = L - capL, mid = P(L * 0.5, 0);
      // rebar from the snapped end
      ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      let a0 = P(4, -5), a1 = P(-12, -9), a2 = P(-17, -2); ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.quadraticCurveTo(a1.x, a1.y, a2.x, a2.y);
      a0 = P(4, 5); a1 = P(-9, 7); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();
      ctx.strokeStyle = '#8a5a3e'; ctx.lineWidth = 1.1; ctx.stroke(); ctx.lineCap = 'butt';
      // shaft
      const shaft = [P(6, -r), P(sE, -r), P(sE, r), P(5, r), P(-2, r * 0.55), P(5, r * 0.15), P(-4, -r * 0.3), P(3, -r * 0.7)];
      poly(ctx, shaft); ctx.fillStyle = cel(ctx, PBC.marble, mid.x, mid.y, nx, ny, r); ctx.fill(); inkIt(ctx, 1.5);
      ctx.strokeStyle = 'rgba(70,50,80,0.42)'; ctx.lineWidth = 1;
      ctx.beginPath(); for (const f of [-0.55, 0, 0.55]) { const q0 = P(10, f * r), q1 = P(sE - 3, f * r); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); } ctx.stroke();
      // the column's own crack, lit violet from inside
      const c0 = P(L * 0.3, -r), c1 = P(L * 0.36, -2), c2 = P(L * 0.31, 4), c3 = P(L * 0.38, r);
      ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(c3.x, c3.y); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(PBC.acc, 0.85); ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore();
      // iron chains binding it to the bearer
      ctx.beginPath();
      for (const k of [0.46, 0.58]) { const c0 = P(L * k - 2, -r - 1), c1 = P(L * k + 2, r + 1); ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y); }
      ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.stroke(); ctx.strokeStyle = '#6e6878'; ctx.lineWidth = 1.6; ctx.stroke();
      // capital: carved block with volutes — the business end
      const cap = [P(sE - 2, -r - 2), P(sE + 4, -r - 2), P(sE + 7, -r - 8), P(L, -r - 8), P(L, r + 8), P(sE + 7, r + 8), P(sE + 4, r + 2), P(sE - 2, r + 2)];
      poly(ctx, cap); const cc = P(sE + capL * 0.55, 0);
      ctx.fillStyle = cel(ctx, PBC.cap, cc.x, cc.y, nx, ny, r + 8); ctx.fill(); inkIt(ctx, 1.5);
      ctx.strokeStyle = 'rgba(70,50,80,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const s of [-1, 1]) { const v = P(sE + 11, s * (r + 2)); ctx.moveTo(v.x + 4, v.y); ctx.arc(v.x, v.y, 4, 0, TAU * 0.8); ctx.moveTo(v.x + 1.8, v.y); ctx.arc(v.x, v.y, 1.8, 0, TAU * 0.8); }
      let q0 = P(sE + 17, -r - 7), q1 = P(sE + 17, r + 7); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
      // acanthus chips
      q0 = P(L - 1, -4); q1 = P(L + 3, 2); ctx.fillStyle = PBC.cap; ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); q0 = P(L - 1, 6); ctx.lineTo(q0.x, q0.y); ctx.closePath(); ctx.fill(); inkIt(ctx, 0.8);
      // Hush crystal cluster grown through the shaft (on its upper face)
      const up = ny > 0 ? -1 : 1, base = P(L * 0.22, up * r * 0.9), ang = Math.atan2(nx * up, -ny * up);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, base.x, base.y, 26 + (e.tellT > 0 ? 10 : 0), PBC.acc, 0.38); ctx.restore();
      shard(ctx, base.x - ux * 5, base.y - uy * 5, 13, 3.4, ang - 0.45, PBC.accHi, '#6b4fc2');
      shard(ctx, base.x, base.y, 20, 4.4, ang, PBC.accHi, '#6b4fc2');
      shard(ctx, base.x + ux * 6, base.y + uy * 6, 11, 3, ang + 0.5, PBC.accHi, '#6b4fc2');
    },
  };
  // ground cracks left by the slam (cosmetic hazard)
  function drawCracks(ctx, h) {
    const k = 1 - U.clamp((h.t - 1.1) / 0.7, 0, 1);
    ctx.globalAlpha = k;
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
    const rng = U.mulberry32(Math.floor(h.x) * 7 + 3);
    const lines = [];
    for (let i = 0; i < 5; i++) {
      const pts = [{ x: h.x, y: h.y }]; let x = h.x, y = h.y; const dir = (i - 2) * 0.55 + (rng() - 0.5) * 0.3;
      for (let j = 0; j < 4; j++) { x += Math.cos(dir) * (12 + rng() * 14) * (i % 2 ? 1 : -1) * (i < 2 ? -1 : 1); y += (rng() - 0.3) * 2.2; pts.push({ x, y }); }
      lines.push(pts);
    }
    for (const pts of lines) { ctx.beginPath(); pts.forEach((p, j) => j ? ctx.lineTo(p.x, p.y + 1) : ctx.moveTo(p.x, p.y + 1)); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(PBC.acc, 0.7 * k); ctx.lineWidth = 0.9;
    for (const pts of lines) { ctx.beginPath(); pts.forEach((p, j) => j ? ctx.lineTo(p.x, p.y + 1) : ctx.moveTo(p.x, p.y + 1)); ctx.stroke(); }
    glow(ctx, h.x, h.y, 50, PBC.acc, 0.25 * k);
  }

  /* ---------------- codex ---------------- */
  const HB = G.DATA.codex.hushborn;
  const add = (c) => { if (!HB.some((q) => q.id === c.id)) HB.splice(Math.max(0, HB.findIndex((q) => q.id === 'graves_b')), 0, c); };
  add({
    id: 'c1_bellcrow', name: '鐘鴉', en: 'BELL-CROW', portrait: 'c1_bellcrow', unlock: 'seen_c1_bellcrow',
    tag: '寂裔｜低階・飛行',
    body: [
      '王城的鐘樓曾經養著上千隻烏鴉，報喪是牠們的老差事。十八年來，牠們報了無數次喪，沒有一次是真的。寂把牠們掏空，只剩翅膀底下一口生鏽的小銅鐘，每次振翅，都走一次音。',
      '攻擊模式：俯衝啄擊（白光，可格擋；完美格擋會把牠打落地面）／垂直墜擊（紅光，地面會出現紅色落點，必須閃避）。',
      '弱點：墜擊之後，鳥喙會卡在地上好一陣子。',
    ],
  });
  add({
    id: 'c1_pillar', name: '負柱者', en: 'PILLAR-BEARER', portrait: 'c1_pillar', unlock: 'seen_c1_pillar',
    tag: '寂裔｜中階・重裝',
    body: [
      '十八年前，石匠們奉命為國王的陵寢立柱。國王沒有死，陵寢也就一直蓋不完。他們後來死了，進不了門，仍扛著那根石柱在城裡走，找那座等不到主人的陵。',
      '攻擊模式：肩撞衝鋒（白光，可格擋）／石柱橫掃（白光）／高舉石柱砸地（紅光，無法格擋，必須閃避）。',
      '弱點：攻擊時具有霸體，輕攻擊打不斷。但砸地之後石柱會卡在地面——那是反擊的時機。',
    ],
  });
  // the base crawler and singer (js/enemies.js) learned a second move in this foe pass — keep their codex lines in step
  const patch = (id, i, line) => { const c = HB.find((q) => q.id === id); if (c && c.body && c.body[i] != null) c.body[i] = line; };
  patch('murmur', 1, '攻擊模式：蓄力後撲咬（白光，可格擋）／貼得太近時，會昂首張開鐮顎猛然一夾（白光，出手較快）。');
  patch('shrieker', 1, '技巧：在聲波彈命中前精準格擋，可以將它原路彈回。中距離時它偶爾會唱出「三連音」——三發聲波彈一拍接一拍，抓準節奏就能全數彈回。');
})(window.G);

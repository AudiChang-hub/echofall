'use strict';
/* ECHOFALL — Chapter V boss: 錨長・伊德里斯 IDRIS, THE ANCHOR-WARDEN (the inverted spire)
   An old sky-captain fused to the anchor of his lost cargo lift. He fights like a ship in a storm: heavy, rhythmic, all weight.
   Phase 1 "BALLAST"   pendulum double swing (white·white) · leaping keel smash (red) → deck shockwaves (jump) ·
                       harpoon cast along a red aim line (dodge) that reels him into a white shoulder charge (parry!) ·
                       a rain of phantom anchors on red floor marks (arena hazard).
   Phase 2 "UNMOORED"  the coat tears open on a crystal heart, hair and coat float upward, a severed tether chain trails into the
                       sky and debris orbits him. GRAVITY FLIP: a loud arena-wide warning, then a timed G.LEVEL.gravity inversion —
                       Rinne floats while he stays mag-locked to the deck and harpoons her in the air (red lines) · anchor wheel
                       (red buzz-saw, keep away) ending in a stuck slam · four-beat chain lash (white ×4, made for parrying) ·
                       pendulum combo with a delayed red keel finisher · a patterned anchor rain.
   Every combo ends with the anchor bitten into the deck: that is the opening. */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK;
  const S = 1.85;                       // drawing scale (rig units → world)
  const AUR = '#7dffc0', AURW = '#dcfff0', VIO = '#b48cff', CRIM = '#ff2a5f', REDL = '#ff6a88';
  const COL = {
    coat: '#2b3666', coatD: '#1b2245', panel: '#34427c', lining: '#1e6d77', brass: '#d8a74e', brassD: '#7d5a24', enamel: '#ece6d7',
    trouser: '#23253b', boot: '#3d4253', glove: '#40465a', skin: '#d4a993', skinD: '#8f6272', hair: '#e3e6ef', hairD: '#8a8fad',
    iron: '#4b5264', ironL: '#7d879b', ironD: '#272b37', rim: '#dbe6f5', cavity: '#0b0e1c',
  };
  const CH_L = 20, SH_L = 60;           // chain from fist to ring, ring to crown (rig units)
  const CEIL = 230;                      // during the gravity flip Rinne floats up to this height above the deck
  const lerpP = K.lerpP;
  const LQ = () => !!(G.Quality && G.Quality.low);

  /* ================================ data ================================ */
  const D = G.DATA;
  D.speakers.c5_idris = D.speakers.c5_idris || { name: '伊德里斯', en: 'IDRIS', color: '#8fffd0' };
  D.barks.c5_bossP2 = { who: 'c5_idris', text: '鬆錨。……讓妳也知道，往天上墜是什麼。' };
  D.hints.c5_bossHarpoon = '紅色瞄準線＝無法格擋的魚叉：看準時機 {dodge}，或離開那條線。接著他會順著鎖鏈衝過來——那一下是白光，可以完美格擋 {guard}。';
  D.hints.c5_bossFlip = '重力反轉：浮空時無法格擋——左右移動、用 {dodge} 躲開紅線魚叉。落地之後，就是反擊的時機。';
  D.hints.c5_bossWheel = '錨輪是紅光：別硬擋，拉開距離。錨砸進甲板之後他會卡住片刻——趁那時反擊。';
  D.codex.hushborn = D.codex.hushborn || [];
  if (!D.codex.hushborn.some((c) => c.id === 'c5_boss')) D.codex.hushborn.push({
    id: 'c5_boss', name: '錨長・伊德里斯', en: 'IDRIS, THE ANCHOR-WARDEN', portrait: 'c5_boss', unlock: 'seen_c5_boss',
    tag: '頭目｜失聲者・倒懸之塔的錨長',
    body: [
      '倒懸之塔的錨長。門關上之後，放了手的亡者一個接一個往天上墜。他打下一根又一根錨，最後把錨鏈纏在自己身上，不讓這座塔也墜進虛無。',
      '寂沒有拉走他。它只是連同那條鏈子，把他一起凍在了原地。',
      '第一階段「壓艙」：錨擺雙擊（白・白）、躍起重砸（紅，甲板衝擊波要跳過）、紅線魚叉——躲開之後，他會順著鎖鏈衝撞過來，那一下是白光，完美格擋能大幅削減架勢。還會召來一陣幽靈錨雨。',
      '第二階段「斷錨」：大衣崩裂、晶心外露，他讓整座平台的重力反轉。浮空時無法格擋，只能移動與閃避。錨輪是紅光，保持距離；四連鎖鏈抽擊是白光，跟上節奏全部格擋。',
      '弱點：每一套連段最後，錨都會咬進甲板——他得花一點時間把它拔出來。',
    ],
  });

  /* ================================ sound ================================ */
  const AK = () => G.AudioKit;
  Object.assign(G.SFX, {
    // links rattling over each other
    c5_chain(t, k = 1) {
      const A = AK();
      for (let i = 0; i < 6; i++) {
        const tt = t + i * 0.032 + Math.random() * 0.012;
        A.noise(tt, 0.001, 0.11 * k, 0.045, 'bandpass', 3400 + Math.random() * 2200, 2400, 5, 0.14);
        A.tone('square', 1700 + Math.random() * 1100, tt, 0.001, 0.008 * k, 0.035, { wet: 0.2, filter: 'highpass', ff: 1400 });
      }
    },
    // iron on iron: an untuned ship's-bell clang
    c5_clang(t, k = 1) {
      const A = AK();
      A.bell(183 + Math.random() * 12, t, 0.11 * k, 1.5, 0.5, 1.3); A.bell(297, t, 0.06 * k, 1.1, 0.5, 1.5);
      A.noise(t, 0.001, 0.28 * k, 0.07, 'bandpass', 2600, 1300, 1.4, 0.2);
    },
    // the anchor biting into the deck
    c5_anchor(t, k = 1) {
      const A = AK();
      A.tone('sine', 64, t, 0.003, 0.8 * k, 0.65, { to: 27, wet: 0.2 });
      A.noise(t, 0.002, 0.5 * k, 0.38, 'lowpass', 1500, 110, 0.7, 0.25);
      A.bell(92, t, 0.14 * k, 2.0, 0.6, 0.8);
      G.SFX.c5_chain(t + 0.05, 0.6 * k);
    },
    c5_whoosh(t, k = 1) { const A = AK(); A.noise(t, 0.09, 0.2 * k, 0.32, 'bandpass', 260, 1200, 0.9, 0.12); A.tone('sine', 90, t, 0.06, 0.12 * k, 0.3, { to: 55 }); },
    c5_harpoon(t) {
      const A = AK();
      A.noise(t, 0.01, 0.3, 0.32, 'bandpass', 1800, 600, 1.0, 0.15);
      for (let i = 0; i < 10; i++) A.noise(t + i * 0.024, 0.001, 0.07, 0.03, 'bandpass', 4200, 3000, 6, 0.1);
    },
    // magnetic boots locking onto the deck
    c5_mag(t) { const A = AK(); A.tone('sine', 55, t, 0.04, 0.4, 0.9, { to: 60, wet: 0.2 }); A.tone('square', 110, t, 0.04, 0.03, 0.8, { filter: 'lowpass', ff: 400 }); A.bell(659, t, 0.03, 1.2, 0.7, 0.4); },
    // gravity-flip alarm: a two-tone ship klaxon
    c5_klaxon(t) {
      const A = AK();
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.5;
        A.tone('sawtooth', 523, tt, 0.02, 0.06, 0.23, { to: 392, filter: 'lowpass', ff: 1900, wet: 0.3 });
        A.tone('sawtooth', 392, tt + 0.25, 0.02, 0.06, 0.23, { to: 523, filter: 'lowpass', ff: 1900, wet: 0.3 });
      }
    },
    c5_flip(t) {
      const A = AK();
      A.noise(t, 0.45, 0.24, 0.7, 'bandpass', 180, 3400, 1.2, 0.5);
      A.tone('sine', 38, t, 0.05, 0.55, 1.5, { to: 150, wet: 0.4 });
      A.bell(A.mtof(86), t + 0.2, 0.06, 2.8, 0.9, 0.6); A.bell(A.mtof(93), t + 0.32, 0.05, 2.8, 0.9, 0.6);
    },
    c5_restore(t) { const A = AK(); A.noise(t, 0.04, 0.26, 0.5, 'bandpass', 3200, 160, 1.0, 0.4); A.tone('sine', 150, t, 0.02, 0.5, 0.75, { to: 34, wet: 0.2 }); },
    // the captain's voice: a low growl through a rebreather
    c5_voice(t, phase = 1) {
      const A = AK();
      A.tone('sawtooth', phase === 2 ? 84 : 71, t, 0.06, 0.15, 0.72, { to: 52, filter: 'lowpass', ff: 620, q: 4, wet: 0.35 });
      A.noise(t + 0.04, 0.08, 0.09, 0.5, 'bandpass', 1100, 600, 2.2, 0.3);
    },
    // phase 2: the mooring snaps
    c5_unmoor(t) {
      const A = AK();
      G.SFX.c5_clang(t, 1.2); G.SFX.c5_chain(t + 0.08, 1.2);
      A.tone('sine', 44, t, 0.01, 0.7, 1.8, { to: 22, wet: 0.3 });
      [62, 69, 74, 81].forEach((m, i) => A.bell(A.mtof(m), t + 0.25 + i * 0.09, 0.06, 2.6, 0.9, 0.5));
    },
  });
  const sfx = (n, ...a) => G.SFX.play(n, ...a);

  /* ================================ poses ================================ */
  // angles in radians from straight down, + toward facing (see Rig.compute); sw = anchor direction from the fist
  const LEG = { tF: 0.4, kF: -0.52, tB: -0.4, kB: -0.24 };
  const IP = {
    idle: (t) => { const br = Math.sin(t * 1.5); return { ...LEG, ry: 8 + br * 1.3, torso: 0.18 + br * 0.02, head: -0.06 + Math.sin(t * 0.6) * 0.04, aF: 0.55 + br * 0.03, eF: 0.42, aB: -0.32 - br * 0.03, eB: 0.75, sw: 0.9 }; },
    hurt: { ...LEG, ry: 10, torso: -0.3, head: 0.45, aF: 0.15, eF: 0.7, aB: -1.0, eB: 0.7, sw: 0.5 },
    broken: (t) => ({ ry: 27, torso: 0.78 + Math.sin(t * 2.2) * 0.04, head: 0.62, tF: 1.3, kF: -1.3, tB: 0.0, kB: -1.57, aF: 0.12, eF: 0.15, aB: 0.4, eB: 0.5, sw: 0.5 }),
    roar: (t) => ({ tF: 0.55, kF: -0.7, tB: -0.55, kB: -0.25, ry: 12, torso: -0.32, head: -0.55 + Math.sin(t * 30) * 0.02, aF: 2.2, eF: 0.6, aB: -2.1, eB: 0.5, sw: 1.4 }),
    descend: (t) => ({ ry: -4, torso: 0.05, head: 0.25, tF: 0.25, kF: -0.35, tB: -0.15, kB: -0.6, aF: 1.25 + Math.sin(t * 2) * 0.05, eF: 0.35, aB: -1.2, eB: 0.4, sw: 0.1 }),
    land: { ry: 30, torso: 0.7, head: -0.2, tF: 1.25, kF: -1.4, tB: -0.5, kB: -1.0, aF: 0.4, eF: 0.1, aB: 0.7, eB: 0.3, sw: 0.9 },
  };
  // pendulum: back-swing → through the bottom → up in front; then over the top into a chop
  const PW1 = { tF: 0.35, kF: -0.6, tB: -0.55, kB: -0.3, ry: 12, torso: -0.22, head: 0.15, aF: -1.25, eF: 0.35, aB: 0.85, eB: 0.7, sw: -2.05 };
  const PS1 = { tF: 0.95, kF: -1.05, tB: -0.72, kB: -0.25, ry: 17, torso: 0.62, head: -0.15, aF: 1.4, eF: 0.0, aB: -0.9, eB: 0.5, sw: 1.62 };
  const PF1 = { tF: 0.85, kF: -0.95, tB: -0.65, kB: -0.25, ry: 14, torso: 0.45, head: -0.25, aF: 2.35, eF: 0.25, aB: -0.7, eB: 0.6, sw: 2.75 };
  const PW2 = { tF: 0.55, kF: -0.7, tB: -0.5, kB: -0.3, ry: 7, torso: -0.28, head: -0.3, aF: 2.95, eF: 0.35, aB: 2.7, eB: 0.5, sw: 3.85, hold: 1 };
  const PS2 = { tF: 1.0, kF: -1.25, tB: -0.78, kB: -0.3, ry: 22, torso: 0.85, head: -0.05, aF: 1.15, eF: 0.0, aB: 0.2, eB: 0.4, sw: 0.75, hold: 1 };
  const PR2 = { ...PS2, ry: 20, torso: 0.74, head: 0.12 };
  // keel smash
  const K1 = { tF: 0.3, kF: -0.7, tB: -0.45, kB: -0.5, ry: 16, torso: -0.32, head: -0.3, aF: 2.95, eF: 0.25, aB: 2.7, eB: 0.4, sw: 4.0, hold: 1 };
  const KA = { tF: 1.05, kF: -1.6, tB: 0.45, kB: -1.4, ry: -4, torso: -0.18, head: -0.25, aF: 3.05, eF: 0.15, aB: 2.8, eB: 0.3, sw: 3.6, hold: 1 };
  const KS = { tF: 1.3, kF: -1.55, tB: -0.55, kB: -1.05, ry: 30, torso: 1.0, head: 0.15, aF: 1.0, eF: 0.0, aB: 0.6, eB: 0.3, sw: 0.55, hold: 1 };
  const KR = { ...KS, ry: 27, torso: 0.9, head: 0.0 };
  // harpoon
  const HS = { ...LEG, ry: 10, torso: -0.05, head: -0.25, aF: 2.75, eF: 0.35, aB: -0.6, eB: 0.9, sw: 3.0 };
  const HT = { tF: 0.9, kF: -0.9, tB: -0.7, kB: -0.25, ry: 14, torso: 0.55, head: -0.1, aF: 1.6, eF: 0.0, aB: -1.2, eB: 0.5, sw: 1.6 };
  const HRW = { tF: 0.3, kF: -0.6, tB: -0.6, kB: -0.4, ry: 14, torso: -0.3, head: 0.1, aF: 1.3, eF: 0.6, aB: 1.1, eB: 0.9, sw: 1.5 };
  const HR = { tF: 1.15, kF: -0.95, tB: -0.95, kB: -0.25, ry: 18, torso: 0.95, head: -0.35, aF: 0.9, eF: 0.7, aB: -1.3, eB: 0.4, sw: 1.4 };
  // rain
  const RW = { tF: 0.7, kF: -1.1, tB: -0.5, kB: -0.6, ry: 22, torso: 0.45, head: -0.2, aF: -0.6, eF: 0.4, aB: 0.5, eB: 0.6, sw: -1.0 };
  const RH = { tF: 0.35, kF: -0.4, tB: -0.4, kB: -0.2, ry: 4, torso: -0.2, head: -0.55, aF: 3.05, eF: 0.05, aB: -1.4, eB: 0.6, sw: 3.14 };
  const RC = { ...LEG, ry: 16, torso: 0.4, head: 0.0, aF: 1.2, eF: 0.4, aB: -0.6, eB: 0.6, sw: 0.9 };
  // gravity flip: one knee down, fist on the deck, mag-boots flare
  const FP = { ry: 28, torso: 0.7, head: -0.35, tF: 1.25, kF: -1.35, tB: -0.1, kB: -1.5, aF: 0.35, eF: 0.15, aB: 0.6, eB: 0.3, sw: 0.9 };
  // wheel
  const WP = { tF: 0.6, kF: -0.75, tB: -0.6, kB: -0.3, ry: 14, torso: 0.2, head: -0.15, aF: 1.35, eF: 0.25, aB: -0.9, eB: 0.8, sw: 0.9 };
  const WS = { tF: 0.95, kF: -1.15, tB: -0.75, kB: -0.3, ry: 20, torso: 0.8, head: 0.0, aF: 1.1, eF: 0.0, aB: -1.0, eB: 0.5, sw: 0.7 };
  // lash
  const L1W = { tF: 0.45, kF: -0.6, tB: -0.55, kB: -0.3, ry: 12, torso: -0.1, head: 0.1, aF: -0.95, eF: 0.4, aB: 0.7, eB: 0.6, sw: -1.7 };
  const L1S = { tF: 0.9, kF: -1.0, tB: -0.7, kB: -0.25, ry: 16, torso: 0.55, head: -0.1, aF: 1.45, eF: 0.0, aB: -0.9, eB: 0.5, sw: 1.7 };
  const L2W = { tF: 0.7, kF: -0.8, tB: -0.6, kB: -0.25, ry: 10, torso: 0.1, head: -0.3, aF: 2.6, eF: 0.3, aB: -0.6, eB: 0.6, sw: 3.0 };
  const L2S = { tF: 0.95, kF: -1.1, tB: -0.72, kB: -0.25, ry: 18, torso: 0.7, head: 0.0, aF: 1.2, eF: 0.0, aB: -0.9, eB: 0.5, sw: 0.95 };

  /* ================================ helpers ================================ */
  const arenaOf = (e) => { const a = G.game.arena; return a ? { x0: a.x0, x1: a.x1 } : { x0: e.x - 700, x1: e.x + 700 }; };
  const floorY = (e) => (e.onGround ? e.y : Math.min(e.y, G.Phys.groundBelow(e.x, e.y - 60)));
  const toW = (e, p) => ({ x: e.x + e.facing * p.x * S, y: e.y + (e.offY || 0) + p.y * S });
  const gripW = (e) => e.gripW || { x: e.x + e.facing * 70, y: e.y - 190 };
  const crownW = (e) => e.crownW || { x: e.x + e.facing * 230, y: e.y - 10 };
  // anchor geometry in rig units from the fist; if any part (crown, flukes, stock) would sink below the deck the anchor
  // tips toward horizontal until it rests on it (binary search on the angle)
  const ANCHOR_PTS = [[SH_L + 7, 0], [SH_L - 16, 35.5], [SH_L - 34, 33], [SH_L - 16, -35.5], [SH_L - 34, -33], [9.8, 24.6], [9.8, -24.6], [-9, 0]];
  function lowY(g, a) {
    const ux = Math.sin(a), uy = Math.cos(a), ry = g.y + uy * CH_L;
    let m = -1e9; for (const [x, y] of ANCHOR_PTS) { const v = ry + x * uy + y * ux; if (v > m) m = v; }
    return m;
  }
  function anchorGeo(J, sw, noClamp) {
    const g = J.hdF, Ln = CH_L + SH_L;
    let a = sw, grounded = false;
    if (!noClamp && lowY(g, a) > -1.5) {
      const s = Math.sin(a) >= 0 ? 1 : -1, lim = s * PI / 2;
      if (lowY(g, lim) <= -1.5) {
        let lo = a, hi = lim;
        for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (lowY(g, m) > -1.5) lo = m; else hi = m; }
        a = hi;
      } else a = lim;
      grounded = true;
    }
    const ux = Math.sin(a), uy = Math.cos(a);
    return { grip: g, ux, uy, ang: Math.atan2(uy, ux), grounded, ring: { x: g.x + ux * CH_L, y: g.y + uy * CH_L }, crown: { x: g.x + ux * Ln, y: g.y + uy * Ln }, head: { x: g.x + ux * (Ln - 14), y: g.y + uy * (Ln - 14) } };
  }
  // Liang–Barsky: does segment a→b pass within r of rect R?
  function segHits(ax, ay, bx, by, r, R) {
    const x0 = R.x - r, y0 = R.y - r, x1 = R.x + R.w + r, y1 = R.y + R.h + r, dx = bx - ax, dy = by - ay;
    let t0 = 0, t1 = 1;
    const p = [-dx, dx, -dy, dy], q = [ax - x0, x1 - ax, ay - y0, y1 - ay];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }
  function smoothClosed(ctx, pts) {
    ctx.beginPath(); const n = pts.length;
    const m0 = lerpP(pts[n - 1], pts[0], 0.5); ctx.moveTo(m0.x, m0.y);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], m = lerpP(a, b, 0.5); ctx.quadraticCurveTo(a.x, a.y, m.x, m.y); }
    ctx.closePath();
  }
  function poly(ctx, pts, close = true) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); if (close) ctx.closePath(); }
  function ink(ctx, w = 1.1) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  function cel(ctx, c, nx, ny, w, hex) { const Ld = Rig.lightDir(ctx); return Rig.celGrad(ctx, c.x, c.y, nx, ny, w, nx * Ld.x + ny * Ld.y >= 0 ? 1 : -1, Rig.ramp(hex)); }
  function glow(ctx, x, y, r, col, a) { if (a <= 0.01) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, r, col, a); ctx.restore(); }

  /* --------- iron: chain links + admiralty anchor (drawn in the current frame, rig units) --------- */
  function drawChain(ctx, a, b, sag, link, w, look) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + sag;
    const len = Math.hypot(b.x - a.x, b.y - a.y) + Math.abs(sag) * 0.5;
    const n = Math.max(2, Math.min(64, Math.round(len / link)));
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push({ x: u * u * a.x + 2 * u * t * mx + t * t * b.x, y: u * u * a.y + 2 * u * t * my + t * t * b.y }); }
    const ovals = new Path2D(), bars = new Path2D();
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[i + 1], cx = (p.x + q.x) / 2, cy = (p.y + q.y) / 2, an = Math.atan2(q.y - p.y, q.x - p.x), l = Math.hypot(q.x - p.x, q.y - p.y) * 0.62;
      if (i % 2 === 0) { ovals.moveTo(cx + Math.cos(an) * l, cy + Math.sin(an) * l); ovals.ellipse(cx, cy, l, w, an, 0, TAU); }
      else { bars.moveTo(cx - Math.cos(an) * l, cy - Math.sin(an) * l); bars.lineTo(cx + Math.cos(an) * l, cy + Math.sin(an) * l); }
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = w * 1.05 + 1.1; ctx.stroke(ovals); ctx.lineWidth = w * 1.3 + 1.1; ctx.stroke(bars);
    ctx.strokeStyle = look.chainCol || COL.ironL; ctx.lineWidth = w * 0.55; ctx.stroke(ovals);
    ctx.strokeStyle = look.chainCol2 || COL.iron; ctx.lineWidth = w * 0.75; ctx.stroke(bars);
    if (look.chainGlow > 0.02) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(look.glowCol || AUR, 0.55 * look.chainGlow); ctx.lineWidth = w * 0.35; ctx.stroke(ovals); ctx.restore();
    }
    return pts;
  }
  // ring at (0,0) after translate/rotate; +x runs ring → crown
  function drawAnchor(ctx, ring, ang, look) {
    const SH = SH_L, ghost = look.ghost, p2 = look.p2 || 0;
    ctx.save(); ctx.translate(ring.x, ring.y); ctx.rotate(ang);
    const fill = ghost ? look.ghost : COL.iron, fillL = ghost ? look.ghost : COL.ironL, inkC = ghost ? look.ghostInk : INK;
    const inkS = (w) => { ctx.strokeStyle = inkC; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.stroke(); };
    // arms: inked thick curves sweeping back from the crown
    const arm = (s) => { ctx.beginPath(); ctx.moveTo(SH + 1, 0); ctx.quadraticCurveTo(SH + 4, s * 21, SH - 19, s * 28); };
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) { arm(s); ctx.strokeStyle = inkC; ctx.lineWidth = 8.6; ctx.stroke(); }
    for (const s of [-1, 1]) { arm(s); ctx.strokeStyle = s < 0 ? fillL : fill; ctx.lineWidth = 5.4; ctx.stroke(); }
    if (!ghost) { ctx.strokeStyle = U.rgba(COL.rim, 0.75); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(SH + 3, -2); ctx.quadraticCurveTo(SH + 5, -20, SH - 17, -27); ctx.stroke(); }
    // flukes: broad spade palms pointing back at the ring
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(SH - 9, s * 22.5); ctx.lineTo(SH - 16, s * 35.5); ctx.lineTo(SH - 34, s * 33); ctx.lineTo(SH - 23, s * 25.5); ctx.closePath();
      ctx.fillStyle = s < 0 ? fillL : fill; ctx.fill(); inkS(1.4);
      if (!ghost) { ctx.fillStyle = COL.ironD; ctx.beginPath(); ctx.moveTo(SH - 16, s * 35.5); ctx.lineTo(SH - 34, s * 33); ctx.lineTo(SH - 21, s * 30); ctx.closePath(); ctx.fill(); }
    }
    // shank
    ctx.beginPath(); ctx.moveTo(2, -2.8); ctx.lineTo(SH, -4.4); ctx.lineTo(SH + 7, 0); ctx.lineTo(SH, 4.4); ctx.lineTo(2, 2.8); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (!ghost) { ctx.fillStyle = COL.ironD; ctx.beginPath(); ctx.moveTo(2, 0.6); ctx.lineTo(SH, 1.2); ctx.lineTo(SH + 6, 0.4); ctx.lineTo(SH, 4.4); ctx.lineTo(2, 2.8); ctx.closePath(); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(2, -2.8); ctx.lineTo(SH, -4.4); ctx.lineTo(SH + 7, 0); ctx.lineTo(SH, 4.4); ctx.lineTo(2, 2.8); ctx.closePath(); inkS(1.4);
    if (!ghost) {
      // enamel bands, brass collar, rim light
      for (const bx of [20, 38]) { ctx.fillStyle = COL.enamel; ctx.beginPath(); ctx.moveTo(bx, -3.4); ctx.lineTo(bx + 3.2, -3.5); ctx.lineTo(bx + 3.2, 3.5); ctx.lineTo(bx, 3.4); ctx.closePath(); ctx.fill(); inkS(0.7); }
      ctx.fillStyle = COL.brass; ctx.fillRect(3, -3.4, 3, 6.8); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.strokeRect(3, -3.4, 3, 6.8);
      ctx.strokeStyle = U.rgba(COL.rim, 0.8); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(7, -2.6); ctx.lineTo(SH - 2, -3.7); ctx.stroke();
    }
    // stock (cross-bar) with ball ends
    ctx.beginPath(); ctx.moveTo(8.5, -20); ctx.lineTo(11, -20); ctx.lineTo(11, 20); ctx.lineTo(8.5, 20); ctx.closePath(); ctx.fillStyle = ghost ? fill : COL.ironD; ctx.fill(); inkS(1.2);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(9.8, s * 21.5, 3.1, 0, TAU); ctx.fillStyle = fillL; ctx.fill(); inkS(1.1); }
    // ring
    ctx.beginPath(); ctx.arc(-4.6, 0, 4.4, 0, TAU); ctx.strokeStyle = inkC; ctx.lineWidth = 3.6; ctx.stroke(); ctx.strokeStyle = fillL; ctx.lineWidth = 1.7; ctx.stroke();
    // hush crystal growing from the crown (bigger once unmoored)
    if (!ghost) {
      const n = 2 + Math.round(p2 * 3);
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * 0.55, l = 7 + p2 * 9 + (i % 2) * 3, bx = SH + 2, by = (i - (n - 1) / 2) * 5;
        ctx.beginPath(); ctx.moveTo(bx - Math.sin(a) * 2.6, by - 2.4); ctx.lineTo(bx + Math.cos(a) * l, by + Math.sin(a) * l); ctx.lineTo(bx + Math.sin(a) * 2.6, by + 2.4); ctx.closePath();
        ctx.fillStyle = i % 2 ? AUR : '#4fe0b0'; ctx.fill(); inkS(0.8);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * l * 0.8, by + Math.sin(a) * l * 0.8); ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ================================ hazards ================================ */
  // ---- deck shockwave (red: jump it or dodge through) ----
  function shockwave(e, x, dir) {
    const y = floorY(e);
    G.game.hazards.push({
      kind: 'c5_shock', owner: e, x, y, dir, t: 0, life: 1.9, hit: false,
      update(h, dt, g) {
        h.x += h.dir * 640 * dt;
        const ar = arenaOf(h.owner);
        if (h.x < ar.x0 + 12 || h.x > ar.x1 - 12) { h.done = true; G.FX.dust(h.x, h.y, 6, { w: 20, speed: 160 }); return; }
        if (Math.random() < (LQ() ? 0.25 : 0.6)) G.FX.dust(h.x - h.dir * 20, h.y, 1, { w: 16, speed: 70, size: 9, col: 'rgba(170,190,220,' });
        const P = g.player;
        if (!h.hit && U.rectsOverlap({ x: h.x - 24, y: h.y - 52, w: 48, h: 52 }, P.hurtbox)) {
          h.hit = true; P.receiveHit(h.owner, { dmg: 15, unblockable: true, kb: 260, hx: h.x, hy: h.y - 30, waveFrom: h.x - h.dir * 60 });
        }
      },
      draw(ctx, h) {
        const f = Math.min(1, h.t * 6) * (1 - Math.max(0, (h.t - h.life + 0.3) / 0.3)), d = h.dir, x = h.x, y = h.y;
        ctx.globalAlpha = f;
        // trailing scorch on the deck
        const tg = ctx.createLinearGradient(x - d * 160, 0, x, 0); tg.addColorStop(0, 'rgba(255,42,95,0)'); tg.addColorStop(1, 'rgba(255,42,95,0.35)');
        ctx.fillStyle = tg; ctx.fillRect(Math.min(x, x - d * 160), y - 4, 160, 5);
        // inked crest curling forward
        ctx.beginPath(); ctx.moveTo(x - d * 70, y); ctx.quadraticCurveTo(x - d * 30, y - 10, x - d * 8, y - 46); ctx.quadraticCurveTo(x + d * 6, y - 56, x + d * 16, y - 40);
        ctx.quadraticCurveTo(x + d * 8, y - 38, x + d * 6, y - 30); ctx.quadraticCurveTo(x + d * 18, y - 14, x + d * 26, y); ctx.closePath();
        ctx.fillStyle = '#3a1022'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - d * 50, y - 2); ctx.quadraticCurveTo(x - d * 22, y - 10, x - d * 6, y - 40); ctx.quadraticCurveTo(x + d * 4, y - 47, x + d * 11, y - 39);
        ctx.quadraticCurveTo(x + d * 2, y - 30, x + d * 10, y - 4); ctx.closePath(); ctx.fillStyle = CRIM; ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,220,230,0.9)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - d * 40, y - 3); ctx.quadraticCurveTo(x - d * 14, y - 14, x - d * 3, y - 40); ctx.stroke();
        K.glow(ctx, x - d * 6, y - 22, 46, CRIM, 0.45);
        ctx.restore();
        // iron debris tossed on the crest
        ctx.fillStyle = COL.ironD; ctx.strokeStyle = INK; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const a = h.t * 9 + i * 2.1, px = x - d * (10 + i * 14), py = y - 48 - i * 7 - Math.abs(Math.sin(h.t * 7 + i)) * 10;
          ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-4, -3); ctx.lineTo(5, -2); ctx.lineTo(3, 4); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        ctx.globalAlpha = 1;
      },
    });
  }

  // ---- harpoon cast: red aim line → locks → the anchor flies along it ----
  function castHarpoon(e, opt) {
    if (e.harp && !e.harp.done) e.harp.done = true;
    const h = { kind: 'c5_harpoon', owner: e, t: 0, aim: opt.aim, lock: opt.lock, air: !!opt.air, dmg: opt.dmg || 18, phase: 'aim', hit: false,
      ox: 0, oy: 0, dx: 1, dy: 0, len: 200, ex: 0, ey: 0, hx: 0, hy: 0, flown: 0, hold: 0, update: harpUpdate, draw: harpDraw };
    harpTarget(h); e.harp = h; G.game.hazards.push(h);
    if (!e.harpHinted) { e.harpHinted = true; G.game.hint('c5_bossHarpoon'); }
    return h;
  }
  function harpTarget(h) {
    const P = G.game.player, e = h.owner, o = gripW(e), ar = arenaOf(e), fy = floorY(e);
    const tx = P.x + P.vx * 0.16, ty = h.air ? P.y - 58 : P.y - 8;
    let dx = tx - o.x, dy = ty - o.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    let len = h.air ? 1100 : d + 70;
    if (dy > 0.02) len = Math.min(len, (fy - 6 - o.y) / dy);            // bites into the deck just past the target
    if (dx > 0.001) len = Math.min(len, (ar.x1 - 24 - o.x) / dx); else if (dx < -0.001) len = Math.min(len, (ar.x0 + 24 - o.x) / dx);
    if (dy < -0.001) len = Math.min(len, (fy - 640 - o.y) / dy);
    len = U.clamp(len, 90, 1100);
    h.ox = o.x; h.oy = o.y; h.dx = dx; h.dy = dy; h.len = len; h.ex = o.x + dx * len; h.ey = o.y + dy * len;
  }
  function harpUpdate(h, dt, g) {
    const e = h.owner, P = g.player, alive = !e.dead && e.state === 'atk';
    if (h.t > 9) { h.done = true; }
    if (h.phase === 'aim') {
      if (!alive) { h.done = true; if (e.harp === h) e.harp = null; return; }
      if (h.t < h.aim) harpTarget(h);
      else if (!h.locked) { h.locked = true; sfx('c5_chain', 0.7); G.FX.ring(h.ex, h.ey, 6, 46, 0.3, CRIM, 3); }
      if (h.t >= h.aim + h.lock) { h.phase = 'fly'; h.hx = h.ox; h.hy = h.oy; h.flown = 0; sfx('c5_harpoon'); G.game.shake(0.15); }
      return;
    }
    if (h.phase === 'fly') {
      const px = h.hx, py = h.hy;
      h.flown = Math.min(h.len, h.flown + 2500 * dt);
      h.hx = h.ox + h.dx * h.flown; h.hy = h.oy + h.dy * h.flown;
      if (!h.hit && P.state !== 'dead') {
        const hb = P.hurtbox;
        if (segHits(px, py, h.hx, h.hy, 30, hb) || segHits(h.ox, h.oy, h.hx, h.hy, 7, hb)) {
          h.hit = true; P.receiveHit(e, { dmg: h.dmg, unblockable: true, kb: 320, hx: h.hx, hy: h.hy });
        }
      }
      if (h.flown >= h.len) {
        const deck = !h.air && h.ey > floorY(e) - 40;
        h.phase = deck ? 'embed' : 'hang'; h.hold = 0;
        if (deck) {
          sfx('c5_anchor', 0.7); g.shake(0.35);
          G.FX.dust(h.hx, floorY(e), 14, { w: 50, speed: 260, size: 13, col: 'rgba(170,190,220,' }); G.FX.shards(h.hx, h.hy - 6, 8, AUR, 380);
          G.FX.spark(h.hx, h.hy - 8, 12, { col: '#ffe2b0', speed: 520 });
        } else sfx('c5_clang', 0.6);
      }
      return;
    }
    if (h.phase === 'embed' || h.phase === 'hang') {
      h.hold += dt;
      if (!alive || h.release || h.hold > (h.phase === 'hang' ? 0.3 : 2.4)) { h.phase = 'ret'; h.rt = 0; h.rx = h.hx; h.ry = h.hy; sfx('c5_chain', 0.8); }
      return;
    }
    if (h.phase === 'ret') {
      h.rt += dt; const o = gripW(e), k = U.easeInCubic(Math.min(1, h.rt / 0.26));
      h.hx = U.lerp(h.rx, o.x, k); h.hy = U.lerp(h.ry, o.y, k);
      if (k >= 1) { h.done = true; if (e.harp === h) e.harp = null; sfx('c5_clang', 0.45); }
    }
  }
  function harpDraw(ctx, h) {
    if (h.phase === 'aim') {
      const k = Math.min(1, h.t / Math.max(0.01, h.aim)), locked = h.t >= h.aim, pulse = 0.5 + 0.5 * Math.sin(h.t * 30);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      if (!locked) {
        ctx.setLineDash([16, 12]); ctx.lineDashOffset = -h.t * 90;
        ctx.strokeStyle = U.rgba(CRIM, 0.25 + 0.45 * k); ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(h.ox, h.oy); ctx.lineTo(h.ex, h.ey); ctx.stroke(); ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = U.rgba(CRIM, 0.22 + 0.15 * pulse); ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(h.ox, h.oy); ctx.lineTo(h.ex, h.ey); ctx.stroke();
        ctx.strokeStyle = U.rgba('#ffd0dc', 0.85); ctx.lineWidth = 2.6; ctx.stroke();
      }
      // reticle where the anchor will bite
      const r = locked ? 24 : 34 - k * 10;
      ctx.strokeStyle = U.rgba(locked ? '#ffd0dc' : CRIM, 0.5 + 0.5 * k); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.ex, h.ey, r, 0, TAU); ctx.stroke();
      for (let i = 0; i < 4; i++) { const a = i * PI / 2 + h.t * 2; ctx.beginPath(); ctx.moveTo(h.ex + Math.cos(a) * (r + 4), h.ey + Math.sin(a) * (r + 4)); ctx.lineTo(h.ex + Math.cos(a) * (r + 13), h.ey + Math.sin(a) * (r + 13)); ctx.stroke(); }
      K.glow(ctx, h.ex, h.ey, 40, CRIM, 0.25 + 0.3 * k);
      ctx.restore();
    } else if (h.phase === 'fly') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = U.rgba(CRIM, 0.45); ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(h.hx - h.dx * 120, h.hy - h.dy * 120); ctx.lineTo(h.hx, h.hy); ctx.stroke();
      ctx.restore();
    } else if (h.phase === 'embed') {
      // cracks in the deck plates
      ctx.strokeStyle = 'rgba(11,6,18,0.75)'; ctx.lineWidth = 1.6; const y = h.hy + 6;
      for (const [a, l] of [[-0.25, 38], [0.15, 30], [-2.9, 34], [3.0, 26]]) { ctx.beginPath(); ctx.moveTo(h.hx, y); ctx.lineTo(h.hx + Math.cos(a) * l, y + Math.sin(a) * 4 - 1); ctx.stroke(); }
    }
  }

  // ---- phantom anchor drop (red floor mark → falls from the sky) ----
  function spawnDrop(e, x) {
    const ar = arenaOf(e); x = U.clamp(x, ar.x0 + 50, ar.x1 - 50);
    const y = G.Phys.groundBelow(x, floorY(e) - 60) < 1e8 ? G.Phys.groundBelow(x, floorY(e) - 60) : floorY(e);
    G.game.hazards.push({
      kind: 'c5_drop', owner: e, x, y, t: 0, warn: 0.85, fall: 0.16, life: 1.65, hit: false, landed: false,
      update(h, dt, g) {
        const ti = h.warn + h.fall;
        if (h.t >= ti && !h.landed) {
          h.landed = true; g.shake(0.3); sfx('c5_anchor', 0.55);
          G.FX.dust(h.x, h.y, LQ() ? 8 : 16, { w: 70, speed: 280, size: 14, col: 'rgba(170,190,220,' });
          G.FX.ring(h.x, h.y, 10, 120, 0.4, AUR, 5, { flat: 0.2 }); G.FX.shards(h.x, h.y - 6, 8, AUR, 420);
        }
        if (h.landed && !h.hit && h.t < ti + 0.1) {
          if (U.rectsOverlap({ x: h.x - 46, y: h.y - 236, w: 92, h: 236 }, g.player.hurtbox)) { h.hit = true; g.player.receiveHit(h.owner, { dmg: 20, unblockable: true, kb: 320, hx: h.x, hy: h.y - 80 }); }
        }
      },
      draw(ctx, h) {
        const ti = h.warn + h.fall, x = h.x, y = h.y;
        const top = (G.game.cam ? G.game.cam.y : y) - 700;
        if (h.t < ti) {
          const k = Math.min(1, h.t / h.warn);
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          // light column from the sky + floor mark
          const cg = ctx.createLinearGradient(0, top, 0, y);
          cg.addColorStop(0, 'rgba(255,42,95,0)'); cg.addColorStop(1, U.rgba(CRIM, 0.12 + 0.22 * k));
          ctx.fillStyle = cg; ctx.fillRect(x - 46, top, 92, y - top);
          ctx.strokeStyle = U.rgba(CRIM, 0.5 + 0.5 * k); ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.ellipse(x, y, 58 - 12 * k, (58 - 12 * k) * 0.22, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = U.rgba('#ffd0dc', 0.3 + 0.6 * k); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(x, y, 26 * k + 8, (26 * k + 8) * 0.22, 0, 0, TAU); ctx.stroke();
          ctx.restore();
          // the anchor itself, falling once the mark is set
          const fk = h.t < h.warn ? 0 : (h.t - h.warn) / h.fall, ay = U.lerp(y - 760, y - (SH_L + 6) * S * 0.92, fk * fk);
          if (h.t > h.warn * 0.55) {
            ctx.save(); ctx.globalAlpha = Math.min(1, (h.t - h.warn * 0.55) * 4);
            if (fk > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(AURW, 0.5); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, ay - 180); ctx.lineTo(x, ay); ctx.stroke(); ctx.restore(); }
            ctx.translate(x, fk > 0 ? ay : y - 760 + Math.sin(h.t * 6) * 6); ctx.scale(S * 0.92, S * 0.92);
            drawAnchor(ctx, { x: 0, y: 0 }, PI / 2, { ghost: 'rgba(150,255,210,0.55)', ghostInk: 'rgba(255,60,110,0.95)' });
            ctx.restore();
          }
        } else {
          const k = (h.t - ti) / (h.life - ti);
          ctx.save(); ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = 'rgba(11,6,18,0.7)'; ctx.lineWidth = 1.6;
          for (const [a, l] of [[-0.2, 44], [0.1, 36], [-2.95, 40], [3.05, 30]]) { ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + Math.cos(a) * l, y + 1 + Math.sin(a) * 3); ctx.stroke(); }
          ctx.translate(x, y - (SH_L + 6) * S * 0.92 + k * 30); ctx.scale(S * 0.92, S * 0.92);
          drawAnchor(ctx, { x: 0, y: 0 }, PI / 2, { ghost: U.rgba('#96ffd2', 0.55 * (1 - k)), ghostInk: U.rgba(CRIM, 0.9 * (1 - k)) });
          ctx.restore();
          if (k < 0.3) glow(ctx, x, y - 40, 90, AUR, 0.4 * (1 - k / 0.3));
        }
      },
    });
  }

  // ---- gravity flip: arena-wide warning → timed inversion of G.LEVEL.gravity → restore ----
  const FLIP = { active: false, base: 1, val: 0 };
  function restoreGravity() {
    if (!FLIP.active) return;
    if (G.LEVEL.gravity === FLIP.val) G.LEVEL.gravity = FLIP.base;   // a chapter change already reset it otherwise
    FLIP.active = false;
  }
  // safety net: whatever clears the hazard list (boss death, respawn, chapter change) also gives gravity back
  const _updH = G.updateHazards;
  G.updateHazards = function (dt) {
    _updH.call(this, dt);
    if (FLIP.active && !G.game.hazards.some((h) => h.kind === 'c5_grav')) restoreGravity();
  };
  function startGravityFlip(e) {
    if (G.game.hazards.some((h) => h.kind === 'c5_grav')) return;
    const g = G.game, ar = arenaOf(e), fy = floorY(e);
    sfx('c5_klaxon'); sfx('c5_mag');
    // the klaxon drowns out any line still on screen (the P2 bark sits exactly where the warning banner goes)
    if (G.UI && G.UI.barkT > 0.05) G.UI.barkT = 0.05;
    if (!e.flipHinted) { e.flipHinted = true; g.hint('c5_bossFlip'); }
    g.hazards.push({
      kind: 'c5_grav', owner: e, t: 0, warn: 1.6, inv: 3.7, life: 1.6 + 3.7 + 0.9, x0: ar.x0, x1: ar.x1, fy, on: false, off: false,
      update(h, dt, gm) {
        const P = gm.player;
        if (!h.on && h.t >= h.warn) {
          h.on = true; FLIP.base = FLIP.active ? FLIP.base : G.LEVEL.gravity; FLIP.val = -0.24; FLIP.active = true; G.LEVEL.gravity = FLIP.val;
          sfx('c5_flip'); gm.shake(0.6); G.FX.flash(P.x, P.y - 60, 300, 0.4, VIO);
          if (P.onGround) P.vy = -260;
        }
        if (h.on && !h.off && h.t >= h.warn + h.inv) {
          h.off = true; restoreGravity(); sfx('c5_restore'); gm.shake(0.4);
        }
        if (h.on && !h.off) {
          // Rinne drifts up to a soft ceiling; everything mag-locked (the captain, any ground foe) stays on the deck
          if (P.vy < -240) P.vy = -240;
          const ceil = h.fy - CEIL;
          if (P.y < ceil) { P.y = ceil; if (P.vy < 0) P.vy = 0; }
          for (const o of gm.enemies) if (!o.fly && !o.dead) o.vy = Math.max(o.vy, 320);
          if (Math.random() < (LQ() ? 0.3 : 0.8)) G.FX.ember(U.rand(h.x0 + 20, h.x1 - 20), h.fy - 4, 1, Math.random() < 0.5 ? AUR : VIO, { w: 10, h: 4, up: 160, life: 1.4 });
        }
      },
      draw(ctx, h) {
        const warn = h.t < h.warn, inv = h.on && !h.off, ending = inv && h.t > h.warn + h.inv - 0.9;
        const pulse = 0.5 + 0.5 * Math.sin(h.t * 16);
        const k = warn ? h.t / h.warn : inv ? 1 : Math.max(0, 1 - (h.t - h.warn - h.inv) / 0.9);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        // chevrons across the deck: rising before/while inverted, falling as it ends
        const up = !ending && !h.off;
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let x = h.x0 + 70; x < h.x1 - 40; x += 140) {
          for (let j = 0; j < 3; j++) {
            const ph = ((h.t * 0.9 + j / 3 + x * 0.0013) % 1);
            const yy = up ? h.fy - 20 - ph * 260 : h.fy - 280 + ph * 260, a = Math.sin(ph * PI) * 0.55 * k;
            ctx.strokeStyle = U.rgba(ending || h.off ? AUR : VIO, a);
            const s = up ? -1 : 1;
            ctx.beginPath(); ctx.moveTo(x - 18, yy - s * 8); ctx.lineTo(x, yy + s * 6); ctx.lineTo(x + 18, yy - s * 8); ctx.stroke();
          }
        }
        // floor glow while the field builds
        const fg = ctx.createLinearGradient(0, h.fy - 120, 0, h.fy);
        fg.addColorStop(0, 'rgba(180,140,255,0)'); fg.addColorStop(1, U.rgba(VIO, (warn ? 0.18 + 0.2 * pulse : 0.12) * k));
        ctx.fillStyle = fg; ctx.fillRect(h.x0, h.fy - 120, h.x1 - h.x0, 120);
        // the soft ceiling Rinne floats against
        if (inv || (h.off && k > 0)) {
          const cy = h.fy - CEIL - 120;
          ctx.strokeStyle = U.rgba(AUR, 0.5 * k); ctx.lineWidth = 2;
          ctx.beginPath();
          for (let x = h.x0; x <= h.x1; x += 24) { const yy = cy + Math.sin(x * 0.02 + h.t * 3) * 5; x === h.x0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
          ctx.stroke();
          ctx.strokeStyle = U.rgba(AURW, 0.18 * k); ctx.lineWidth = 9; ctx.stroke();
        }
        ctx.restore();
        // banner (screen space)
        const g = G.game, W = g.W, H = g.H;
        if (!W) return;
        const bk = warn ? Math.min(1, h.t / 0.2) : ending ? 1 : inv ? Math.max(0, 1 - (h.t - h.warn) / 0.6) : 0;
        if (bk <= 0.01) return;
        // phones: a little bigger and below the HUD's resonance pips (the canvas is upscaled there)
        const touch = document.documentElement.classList.contains('touch');
        const s = Math.min(W, H * 1.6) / 900 * (touch ? 1.2 : 1), by = H * (touch ? 0.25 : 0.2);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = bk;
        const bh = 50 * s;
        ctx.fillStyle = 'rgba(8,6,16,0.78)'; ctx.fillRect(0, by - bh / 2, W, bh);
        ctx.fillStyle = U.rgba(ending ? AUR : CRIM, 0.55 + 0.45 * (warn ? pulse : 1)); ctx.fillRect(0, by - bh / 2, W, 3 * s); ctx.fillRect(0, by + bh / 2 - 3 * s, W, 3 * s);
        // hazard stripes at both ends
        ctx.save(); ctx.beginPath(); ctx.rect(0, by - bh / 2 + 3 * s, W, bh - 6 * s); ctx.clip();
        ctx.fillStyle = U.rgba(ending ? AUR : CRIM, 0.35);
        for (let i = -2; i < 7; i++) { const x0 = i * 26 * s - ((h.t * 60 * s) % (26 * s)); ctx.beginPath(); ctx.moveTo(x0, by + bh / 2); ctx.lineTo(x0 + 13 * s, by + bh / 2); ctx.lineTo(x0 + 13 * s + bh, by - bh / 2); ctx.lineTo(x0 + bh, by - bh / 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(W - x0, by + bh / 2); ctx.lineTo(W - x0 - 13 * s, by + bh / 2); ctx.lineTo(W - x0 - 13 * s - bh, by - bh / 2); ctx.lineTo(W - x0 - bh, by - bh / 2); ctx.fill(); }
        ctx.restore();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        const main = ending ? '重力恢復' : '重力反轉', sub = ending ? 'GRAVITY RETURNING' : 'GRAVITY FLIP';
        ctx.font = `900 ${Math.round(24 * s)}px "Noto Serif TC", serif`;
        ctx.lineWidth = 6 * s; ctx.strokeStyle = '#0b0612'; ctx.strokeText(main, W / 2, by - 6 * s);
        ctx.fillStyle = ending ? AURW : '#ffe3ea'; ctx.fillText(main, W / 2, by - 6 * s);
        ctx.font = `700 ${Math.round(11 * s)}px Rajdhani, sans-serif`; ctx.fillStyle = ending ? AUR : REDL;
        ctx.fillText(`▲   ${sub}   ▲`, W / 2, by + 15 * s);
        ctx.restore();
      },
    });
  }

  /* ================================ shared attack events ================================ */
  function slam(e, power = 1, waves = false) {
    const c = crownW(e), fy = floorY(e);
    G.game.shake(0.45 + 0.35 * power); G.game.hitstop(0.03 * power);
    sfx('c5_anchor', power);
    G.FX.dust(c.x, fy, LQ() ? 10 : 22, { w: 90, speed: 320 * power, size: 16, col: 'rgba(170,190,220,' });
    G.FX.ring(c.x, fy, 10, 150 + 90 * power, 0.45, e.phase === 2 ? VIO : AUR, 6, { flat: 0.18 });
    G.FX.shards(c.x, fy - 6, 10, AUR, 520); G.FX.spark(c.x, fy - 10, 14, { col: '#ffe2b0', speed: 620, dir: -PI / 2, spread: 2.2 });
    if (waves) { shockwave(e, c.x + 26, 1); shockwave(e, c.x - 26, -1); }
  }
  const scrape = (e) => { const c = crownW(e); G.FX.spark(c.x, floorY(e) - 6, 10, { col: '#ffd9a0', speed: 520, dir: e.facing > 0 ? -0.5 : PI + 0.5, spread: 0.9 }); sfx('c5_chain', 0.5); };
  const ev = (t, fn) => ({ t, fn });

  /* ================================ attacks ================================ */
  // P1 · 錨擺雙擊 PENDULUM: rising swing through the deck, then over the top into a chop (white · white)
  const pend = {
    name: 'pend', dur: 2.75, cd: 1.25,
    tells: [{ t: 0.18, c: 'white' }, { t: 1.26, c: 'white' }],
    poses: { dur: 2.75, keys: [[0, IP.idle(0)], [0.5, PW1], [0.62, { ...PW1, sw: -2.25, torso: -0.28 }], [0.78, PS1, 'snap'], [1.06, PF1, 'out'], [1.56, PW2, 'io'], [1.8, PS2, 'snap'], [2.2, PR2], [2.75, IP.idle(0), 'io']] },
    moves: [{ t0: 0.64, t1: 0.78, v: 240 }, { t0: 1.66, t1: 1.8, v: 220 }],
    hits: [
      { t0: 0.7, t1: 0.84, box: { x: 0, y: -200, w: 268, h: 200 }, dmg: 17, kb: 260, pbal: 40 },
      { t0: 1.74, t1: 1.86, box: { x: 20, y: -300, w: 235, h: 300 }, dmg: 19, kb: 300, last: true, pbal: 70 },
    ],
    ev: [ev(0.62, () => sfx('c5_whoosh', 0.9)), ev(0.72, scrape), ev(1.6, () => sfx('c5_whoosh', 1.1)), ev(1.8, (e) => slam(e, 0.6))],
  };
  // P2 · 錨擺三連 PENDULUM + delayed red keel finisher (white · white · ……RED)
  const pend3 = {
    name: 'pend3', dur: 3.95, cd: 1.2,
    tells: [{ t: 0.12, c: 'white' }, { t: 0.98, c: 'white' }, { t: 1.95, c: 'red' }],
    poses: { dur: 3.95, keys: [[0, IP.idle(0)], [0.44, PW1], [0.54, { ...PW1, sw: -2.25, torso: -0.28 }], [0.68, PS1, 'snap'], [0.92, PF1, 'out'], [1.3, PW2, 'io'], [1.52, PS2, 'snap'], [1.85, PR2], [2.3, K1, 'io'], [2.58, { ...K1, sw: 4.15, torso: -0.38 }], [2.74, KS, 'snap'], [3.4, KR], [3.95, IP.idle(0), 'io']] },
    moves: [{ t0: 0.54, t1: 0.68, v: 250 }, { t0: 1.4, t1: 1.52, v: 230 }, { t0: 2.6, t1: 2.72, v: 200 }],
    hits: [
      { t0: 0.6, t1: 0.74, box: { x: 0, y: -200, w: 268, h: 200 }, dmg: 17, kb: 260, pbal: 40 },
      { t0: 1.46, t1: 1.58, box: { x: 20, y: -300, w: 235, h: 300 }, dmg: 19, kb: 300, pbal: 60 },
      { t0: 2.7, t1: 2.84, box: { x: -30, y: -300, w: 285, h: 300 }, dmg: 26, red: true, kb: 420, last: true },
    ],
    ev: [ev(0.54, () => sfx('c5_whoosh', 0.9)), ev(0.62, scrape), ev(1.36, () => sfx('c5_whoosh', 1.1)), ev(1.52, (e) => slam(e, 0.55)),
      ev(2.3, () => sfx('c5_chain', 0.9)), ev(2.74, (e) => slam(e, 1.1, true))],
  };
  // 沉錨重擊 KEEL SMASH: a low-gravity leap, the anchor brought down two-handed; shockwaves run along the deck (red)
  const keel = {
    name: 'keel', dur: 2.85, cd: 1.35, track: false, air: [0.62, 1.12],
    tells: [{ t: 0.2, c: 'red' }],
    poses: { dur: 2.85, keys: [[0, IP.idle(0)], [0.5, K1], [0.72, KA, 'out'], [1.02, { ...KA, sw: 3.9, torso: -0.25 }], [1.14, KS, 'snap'], [2.3, KR], [2.85, IP.idle(0), 'io']] },
    hits: [{ t0: 1.1, t1: 1.24, box: { x: -30, y: -300, w: 290, h: 300 }, dmg: 26, red: true, kb: 420, last: true }],
    ev: [
      ev(0.62, (e) => { e.faceP(); const d = Math.abs(e.P.x - e.x); e.hopVx = e.facing * U.clamp(d - 175, 0, 340) / 0.5; sfx('c5_whoosh', 1.3); sfx('c5_mag'); G.FX.dust(e.x, floorY(e), 10, { w: 60, speed: 200 }); }),
      ev(1.13, (e) => { e.hopVx = 0; slam(e, 1.2, true); }),
      ev(2.3, () => sfx('c5_chain', 0.8)),
    ],
    upd(e) { if (e.st >= 0.62 && e.st < 1.12) e.vx = e.hopVx || 0; },
  };
  // 錨鏈魚叉 HARPOON: overhead spin → red aim line → throw (dodge) → he reels himself in: white shoulder charge (parry!)
  const harpoon = {
    name: 'harpoon', dur: 3.3, cd: 1.15, track: false, spin: [[0.3, 0.98]],
    tells: [{ t: 0.15, c: 'red' }, { t: 1.48, c: 'white', face: false }],
    poses: { dur: 3.3, keys: [[0, IP.idle(0)], [0.32, HS], [0.94, HS], [1.02, HT, 'snap'], [1.45, HT], [1.72, HRW, 'io'], [1.95, HR, 'snap'], [2.42, HR], [3.3, IP.idle(0), 'io']] },
    hits: [{ t0: 1.95, t1: 2.32, box: { x: -20, y: -240, w: 112, h: 240 }, dmg: 20, kb: 380, last: true, pbal: 130 }],
    ev: [
      ev(0.15, (e) => castHarpoon(e, { aim: 0.55, lock: 0.3, dmg: 18 })),
      ev(0.3, () => sfx('c5_chain', 0.8)), ev(0.6, () => sfx('c5_chain', 0.8)),
      ev(1.47, (e) => { const h = e.harp; if (h && h.phase !== 'aim') e.facing = h.hx > e.x ? 1 : -1; }),
      ev(1.95, (e) => { const h = e.harp; e.reelTo = h && h.phase === 'embed' ? h.hx - e.facing * 70 : null; sfx('c5_whoosh', 1.4); sfx('c5_chain', 1); }),
    ],
    upd(e) {
      const h = e.harp;
      if (e.st >= 1.95 && e.st < 2.32) {
        if (e.reelTo != null && (e.reelTo - e.x) * e.facing > 6) { e.vx = e.facing * Math.min(1500, Math.abs(e.reelTo - e.x) / Math.max(0.06, 2.32 - e.st)); if (Math.random() < 0.6) G.FX.dust(e.x, floorY(e), 1, { w: 30, speed: 120 }); }
        else { e.vx = e.facing * 260; if (h && h.phase === 'embed') h.release = true; }
      } else if (e.st >= 2.32 && h && (h.phase === 'embed' || h.phase === 'hang')) h.release = true;
    },
  };
  // 落錨雨 ANCHOR RAIN: the anchor is heaved into the sky; phantom anchors fall on red marks (P1: tracking)
  const rainEv = (pattern) => {
    const out = [ev(0.75, (e) => { sfx('c5_harpoon'); sfx('c5_voice', e.phase); G.game.shake(0.3); G.FX.ring(gripW(e).x, gripW(e).y, 10, 90, 0.4, AUR, 4); }), ev(3.4, (e) => { sfx('c5_clang', 0.9); G.FX.spark(gripW(e).x, gripW(e).y, 10, { col: AURW, speed: 400 }); })];
    if (pattern) {
      const slot = (e, i) => { const ar = arenaOf(e), n = 8, gap = (ar.x1 - ar.x0 - 160) / (n - 1); return ar.x0 + 80 + i * gap; };
      out.push(ev(1.0, (e) => { for (let i = 0; i < 8; i += 2) spawnDrop(e, slot(e, i)); }));
      out.push(ev(1.7, (e) => { for (let i = 1; i < 8; i += 2) spawnDrop(e, slot(e, i)); }));
      for (const t of [2.5, 2.85, 3.2]) out.push(ev(t, (e) => spawnDrop(e, e.P.x + e.P.vx * 0.3)));
    } else for (let i = 0; i < 5; i++) out.push(ev(1.0 + i * 0.42, (e) => spawnDrop(e, e.P.x + e.P.vx * 0.32)));
    return out;
  };
  const rainPoses = (dur) => ({ dur, keys: [[0, IP.idle(0)], [0.5, RW], [0.75, RH, 'snap'], [3.3, RH], [3.55, RC, 'snap'], [dur, IP.idle(0), 'io']] });
  const rain = { name: 'rain', dur: 4.1, cd: 1.0, track: false, sky: [0.75, 3.45], tells: [{ t: 0.25, c: 'red' }], poses: rainPoses(4.1), ev: rainEv(false) };
  const rain2 = { name: 'rain2', dur: 4.3, cd: 1.0, track: false, sky: [0.75, 3.45], tells: [{ t: 0.25, c: 'red' }], poses: rainPoses(4.3), ev: rainEv(true) };
  // 斷錨失重 GRAVITY FLIP (P2 signature): mag-lock, the arena's gravity inverts, two air harpoons, then it comes back
  const flip = {
    name: 'flip', dur: 7.3, cd: 1.1, track: false, spin: [[2.35, 3.03], [3.9, 4.58]], mag: [0.3, 5.7],
    tells: [{ t: 2.3, c: 'red' }, { t: 3.86, c: 'red' }],
    poses: { dur: 7.3, keys: [[0, IP.idle(0)], [0.55, FP, 'out'], [2.05, FP], [2.38, HS, 'io'], [2.98, HS], [3.06, HT, 'snap'], [3.5, { ...HS, ry: 12 }, 'io'], [4.53, HS], [4.61, HT, 'snap'], [5.5, HT], [6.0, IP.land, 'io'], [7.3, IP.idle(0), 'io']] },
    ev: [
      ev(0.25, (e) => { startGravityFlip(e); G.FX.ring(e.x, floorY(e), 10, 200, 0.6, VIO, 6, { flat: 0.2 }); }),
      ev(0.55, (e) => { sfx('c5_anchor', 0.6); G.FX.dust(e.x, floorY(e), 14, { w: 80, speed: 220 }); }),
      ev(2.35, (e) => castHarpoon(e, { aim: 0.42, lock: 0.28, air: true, dmg: 18 })),
      ev(3.9, (e) => castHarpoon(e, { aim: 0.42, lock: 0.28, air: true, dmg: 18 })),
      ev(6.0, (e) => { sfx('c5_voice', 2); }),
    ],
  };
  // 渦流錨輪 MAELSTROM WHEEL (P2): the anchor becomes a red buzz-saw wheel in front of him; it ends bitten into the deck
  const WHEEL_END = 3.42;
  function wheelA(st) {
    if (st < 0.5) return null;
    const t0 = 0.5, t1 = 1.1, w0 = 3, w1 = 11.5;
    const tt = Math.min(st, WHEEL_END) - t0, rmp = Math.min(tt, t1 - t0);
    const a = 0.9 + w0 * rmp + (w1 - w0) * rmp * rmp / (2 * (t1 - t0)) + Math.max(0, tt - (t1 - t0)) * w1;
    if (st <= WHEEL_END) return a;
    let target = a + (((0.7 - a) % TAU) + TAU) % TAU; if (target - a < 1.4) target += TAU;
    const k = U.clamp((st - WHEEL_END) / 0.16, 0, 1);
    return a + (target - a) * (1 - Math.pow(1 - k, 3));
  }
  const wheel = {
    name: 'wheel', dur: 4.35, cd: 1.3, track: false, wheel: true,
    tells: [{ t: 0.08, c: 'red' }],
    poses: { dur: 4.35, keys: [[0, IP.idle(0)], [0.5, WP, 'io'], [WHEEL_END, WP], [WHEEL_END + 0.16, WS, 'snap'], [3.95, WS], [4.35, IP.idle(0), 'io']] },
    hits: [{ t0: WHEEL_END + 0.06, t1: WHEEL_END + 0.2, box: { x: 10, y: -300, w: 262, h: 300 }, dmg: 24, red: true, kb: 420, last: true }],
    ev: [ev(0.5, () => sfx('c5_chain', 1)), ev(WHEEL_END + 0.15, (e) => slam(e, 1))].concat([0.9, 1.45, 2.0, 2.55, 3.1].map((t) => ev(t, () => sfx('c5_whirl')))),
    upd(e, dt) {
      const P = e.P, d = Math.abs(P.x - e.x), ar = arenaOf(e);
      if (e.st >= 0.5 && e.st < WHEEL_END) {
        // trudge forward, but never pin her against the wall
        const room = e.facing > 0 ? ar.x1 - P.x : P.x - ar.x0;
        e.vx = U.approach(e.vx, d > 210 && room > 170 ? e.facing * 150 * e.speedMul : 0, 900 * dt);
        if (!e.wheelHinted) { e.wheelHinted = true; G.game.hint('c5_bossWheel'); }
      }
      if (e.st >= 0.7 && e.st < WHEEL_END && e.headW) {
        e.wheelCd = Math.max(0, (e.wheelCd || 0) - dt);
        const prev = e.headPrev || e.headW, hb = P.hurtbox;
        if (e.wheelCd <= 0 && segHits(prev.x, prev.y, e.headW.x, e.headW.y, 44, hb)) {
          e.wheelCd = 0.45;
          P.receiveHit(e, { dmg: 16, unblockable: true, kb: 320, hx: e.headW.x, hy: e.headW.y });
        }
        if (Math.random() < 0.5 && e.headW.y > floorY(e) - 40) G.FX.spark(e.headW.x, floorY(e) - 4, 3, { col: '#ffd9a0', speed: 480, dir: -PI / 2 - e.facing * 0.8, spread: 0.8 });
      }
    },
  };
  // 鎖鏈四連 FOUR-BEAT LASH (P2): quick flicks on a steady beat — parry every one (white ×4, the last heavy)
  const lash = {
    name: 'lash', dur: 3.05, cd: 1.1,
    tells: [{ t: 0.12, c: 'white' }, { t: 0.57, c: 'white' }, { t: 1.02, c: 'white' }, { t: 1.6, c: 'white' }],
    poses: { dur: 3.05, keys: [[0, IP.idle(0)], [0.45, L1W], [0.64, L1S, 'snap'], [0.88, L2W, 'io'], [1.09, L2S, 'snap'], [1.33, L1W, 'io'], [1.54, L1S, 'snap'], [1.92, PW2, 'io'], [2.14, PS2, 'snap'], [2.5, PR2], [3.05, IP.idle(0), 'io']] },
    moves: [{ t0: 0.52, t1: 0.64, v: 200 }, { t0: 0.98, t1: 1.09, v: 180 }, { t0: 1.43, t1: 1.54, v: 180 }, { t0: 2.02, t1: 2.14, v: 200 }],
    hits: [
      { t0: 0.6, t1: 0.72, box: { x: 0, y: -210, w: 272, h: 210 }, dmg: 13, kb: 200, pbal: 42 },
      { t0: 1.05, t1: 1.17, box: { x: 20, y: -280, w: 248, h: 280 }, dmg: 13, kb: 200, pbal: 42 },
      { t0: 1.5, t1: 1.62, box: { x: 0, y: -210, w: 272, h: 210 }, dmg: 13, kb: 200, pbal: 42 },
      { t0: 2.1, t1: 2.22, box: { x: 20, y: -300, w: 235, h: 300 }, dmg: 20, kb: 320, last: true, pbal: 110 },
    ],
    ev: [ev(0.56, () => sfx('c5_whoosh', 0.7)), ev(1.0, () => sfx('c5_whoosh', 0.7)), ev(1.46, () => sfx('c5_whoosh', 0.7)), ev(2.14, (e) => slam(e, 0.6))],
  };
  const MOVES = { pend, pend3, keel, harpoon, rain, rain2, flip, wheel, lash };
  const inWin = (st, w) => w && st >= w[0] && st < w[1];
  const inAny = (st, ws) => ws && ws.some((w) => st >= w[0] && st < w[1]);

  /* ================================ the type ================================ */
  TYPES.c5_boss = Object.assign({
    name: '錨長・伊德里斯', en: 'IDRIS, THE ANCHOR-WARDEN', w: 92, h: 240, hp: 2300, bal: 330, col: AUR, boss: true, shards: 760,
    kbMul: 0.5, spawnT: 2.5, poise: true, scale: S, portrait: [1.12, 0.86],
    defeatDialog: 'c5_bossDefeat', phase2Bark: 'c5_bossP2', phase2Music: 'c5_boss2',
    init(e) {
      e.facing = -1; e.offY = 0;
      e.coatB = new Rig.Chain(8, 11, 0.07, 0.88); e.coatF = new Rig.Chain(6, 10, 0.08, 0.88);
      e.hair = [new Rig.Chain(8, 8, 0.05, 0.9), new Rig.Chain(7, 8, 0.05, 0.9), new Rig.Chain(6, 7.5, 0.05, 0.9)];
      e.beard = [new Rig.Chain(6, 7, 0.06, 0.9), new Rig.Chain(5, 6.5, 0.06, 0.9)];
      e.sky = new Rig.Chain(13, 17, 0.12, 0.9);
      e.trail = []; e.lastMoves = []; e.rainAt = e.t + 9; e.flipAt = 0; e.p2At = -99; e.harp = null;
    },
    voice: (e) => sfx('c5_voice', e.phase),
    weapon: (e) => crownW(e),
    think(e, dt) {
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) { G.game.bossPhase2(e); return; }
      if (e.phase === 2 && e.t - e.p2At < 1.9) { e.vx = U.approach(e.vx, 0, 1200 * dt); return; }   // the transformation
      e.faceP();
      const d = e.distP(), p2 = e.phase === 2, sp = (p2 ? 150 : 118) * e.speedMul;
      if (d > 250) e.vx = U.approach(e.vx, e.facing * sp, 700 * dt);
      else if (d < 115) e.vx = U.approach(e.vx, -e.facing * 90, 700 * dt);
      else e.vx = U.approach(e.vx, 0, 700 * dt);
      if (e.cd > 0) return;
      if (p2 && e.t >= e.flipAt) { e.flipAt = e.t + 21; e.lastMoves.push('flip'); e.startAtk(flip); return; }
      // melee is only chosen when the swing can actually reach (reach ≈ 260 + a short lunge)
      const pool = !p2
        ? [['pend', d < 300 ? 4 : 0], ['keel', d < 500 ? 2.2 : 0.4], ['harpoon', d > 270 ? 3.6 : 0.6], ['rain', e.t >= e.rainAt ? (d > 300 ? 2.6 : 1.3) : 0]]
        : [['pend3', d < 300 ? 3 : 0], ['lash', d < 290 ? 3 : 0], ['keel', d < 500 ? 1.4 : 0.3], ['harpoon', d > 270 ? 3 : 0.5], ['wheel', d < 560 ? 2.2 : 0.5], ['rain2', e.t >= e.rainAt ? 2.2 : 0]];
      const last = e.lastMoves[e.lastMoves.length - 1];
      const wgt = (p) => (p[0] === last ? p[1] * 0.2 : p[1]);
      const tot = pool.reduce((s, p) => s + wgt(p), 0);
      if (tot <= 0) return;
      let r = Math.random() * tot, pick = pool[0][0];
      for (const p of pool) { if ((r -= wgt(p)) <= 0) { pick = p[0]; break; } }
      if (pick === 'rain' || pick === 'rain2') e.rainAt = e.t + (p2 ? 14 : 12);
      e.lastMoves.push(pick); if (e.lastMoves.length > 6) e.lastMoves.shift();
      e.startAtk(MOVES[pick]);
    },
    atkUpdate(e, dt) { if (e.atk && e.atk.upd) e.atk.upd(e, dt); },
    onPhase2(e, game) {
      e.p2At = e.t; e.flipAt = e.t + 2.1; e.cd = 2.1; e.rainAt = e.t + 9;
      if (e.harp) { e.harp.done = true; e.harp = null; }
      sfx('c5_unmoor');
      G.FX.shards(e.x, e.y - 130, 30, COL.coat, 620); G.FX.shards(e.x, e.y - 130, 20, AUR, 560);
      G.FX.ring(e.x, e.y - 130, 20, 360, 0.9, VIO, 7); G.FX.ember(e.x, e.y - 120, 30, AUR, { w: 120, h: 200, up: 260 });
      game.shake(1);
    },
    draw(ctx, e, ghost) { drawIdris(ctx, e, !!ghost); },
  }, MOVES);

  /* ================================ rendering ================================ */
  function targetPose(e) {
    const st = e.state, a = e.atk;
    let p, ground = true;
    if (st === 'spawn') {
      if (e.st < 1.5) { p = Rig.full(IP.descend(e.t)); ground = false; }
      else p = Rig.lerpPose(Rig.full(IP.land), Rig.full(IP.roar(e.t)), U.clamp((e.st - 1.62) / 0.5, 0, 1));
    } else if (st === 'atk' && a && a.poses) { p = Rig.sample(a.poses, e.st); if (inWin(e.st, a.air)) ground = false; }
    else if (st === 'broken') p = Rig.full(IP.broken(e.t));
    else if (st === 'hurt' || st === 'recoil' || st === 'executed' || st === 'die') { const w = st === 'recoil' ? Math.sin(Math.min(1, e.st / 0.6) * PI) : 1; p = Rig.lerpPose(Rig.full(IP.idle(e.t)), Rig.full(IP.hurt), w); }
    else if (e.phase === 2 && e.t - e.p2At < 1.9) p = Rig.full(IP.roar(e.t));
    else if (Math.abs(e.vx) > 25 && e.onGround) {
      const prev = Math.floor((e.gaitP || 0) / PI);
      e.gaitP = (e.gaitP || 0) + Math.abs(e.vx) * (G.game.dtVis || 0) * PI / (2 * 17);
      if (Math.floor(e.gaitP / PI) !== prev && G.game.dtVis > 0) { G.SFX.play('heavyStep'); G.FX.dust(e.x, e.y, 3, { w: 40, speed: 70, size: 10 }); }
      const w = Rig.ANIM.walk(e.gaitP);
      p = Rig.full({ ...IP.idle(e.t), ik: 1, fFx: w.fFx * 1.25 + 6, fFy: w.fFy * 1.5, fBx: w.fBx * 1.25 - 6, fBy: w.fBy * 1.5, ry: w.ry + 8, torso: 0.26 });
    } else p = Rig.full(IP.idle(e.t));
    if (ground && !p.ik) p = Rig.groundify(p);
    const hk = e.hitK;
    if (hk > 0) p = Rig.lerpPose(Rig.full(p), Rig.full({ ...Rig.full(p), torso: p.torso - 0.22, head: p.head + 0.35, ry: p.ry + 3 }), Math.min(1, hk));
    return p;
  }

  // where the anchor is and how it should be drawn this frame
  function anchorState(e, J, pose) {
    const a = e.state === 'atk' ? e.atk : null, st = e.st;
    const h = e.harp;
    if (h && !h.done && h.phase !== 'aim') return { mode: 'out', h };
    if (a && inWin(st, a.sky)) return { mode: 'sky' };
    if (a && inAny(st, a.spin)) {
      // lasso spin over his head: the anchor orbits a flat ellipse, foreshortened as it swings toward / away from us
      const th = st * 13, vx = Math.cos(th), vy = Math.sin(th) * 0.32;
      const c = { x: J.hdF.x, y: J.hdF.y - 4 };
      const ring = { x: c.x + vx * 16, y: c.y + vy * 16 };
      const at = (k) => ({ x: ring.x + vx * k, y: ring.y + vy * k });
      return { mode: 'hand', spin: true, depth: Math.sin(th), v: { x: vx, y: vy }, geo: { grip: J.hdF, ux: vx, uy: vy, ang: Math.atan2(vy, vx), ring, crown: at(SH_L), head: at(SH_L - 14) } };
    }
    return { mode: 'hand', geo: anchorGeo(J, pose.sw, a && a.wheel && st > 0.5 && st < WHEEL_END) };
  }

  function updCloth(e, J, dt, look) {
    if (dt <= 0) return;
    const f = e.facing, wind = -e.vx * 3 + Math.sin(e.t * 1.2) * 260 + Math.sin(e.t * 3.1) * 90;
    const grav = G.LEVEL.gravity ?? 1, flip = grav < 0 ? 1 : 0;
    const B = 900 * U.clamp(1 - grav, 0, 1.3) * 0.75 + look.p2 * 700 + flip * 900;    // buoyancy: the unmoored float
    const lift = (c, k) => { if (!c.inited) return; for (let i = 1; i < c.n; i++) c.p[i].y -= B * k * dt * dt * (0.4 + 0.6 * i / c.n); };
    const tq = torsoFrame(J);
    const W = (p) => toW(e, p);
    let a = W(tq.Q(-0.05, -13)); e.coatB.update(a.x, a.y, f, dt, wind, 2.72 - look.p2 * 0.5); lift(e.coatB, 0.8);
    a = W(tq.Q(-0.12, 12)); e.coatF.update(a.x, a.y, f, dt, wind * 0.6, PI - 0.05); lift(e.coatF, 0.6);
    const hp = (px, py) => { const c = Math.cos(J.ha), s = Math.sin(J.ha); return W({ x: J.head.x + c * px - s * py, y: J.head.y + s * px + c * py }); };
    const hr = [[-8, -6], [-9.5, -1.5], [-8, 3]];
    e.hair.forEach((c, i) => { const q = hp(hr[i][0], hr[i][1]); c.update(q.x, q.y, f, dt, wind * 1.3, U.lerp(1.95 + i * 0.2, 0.75 + i * 0.25, look.p2)); lift(c, 1.1); });
    const br = [[7.0, 10.6], [3.6, 10.8]];
    e.beard.forEach((c, i) => { const q = hp(br[i][0], br[i][1]); c.update(q.x, q.y, f, dt, wind, U.lerp(PI - 0.35 - i * 0.2, 1.6 - i * 0.3, look.p2)); lift(c, 0.9); });
    if (look.p2 > 0) { const q = W(tq.Q(0.95, -11)); e.sky.update(q.x, q.y, f, dt, wind * 1.5 + Math.sin(e.t * 0.7) * 400, 0.35); lift(e.sky, 2.6); }
  }
  function torsoFrame(J) {
    const tA = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x), ux = Math.cos(tA), uy = Math.sin(tA), nx = -uy, ny = ux;
    return { nx, ny, Q: (s, f) => ({ x: J.hip.x + ux * s * 36 + nx * f, y: J.hip.y + uy * s * 36 + ny * f }) };
  }

  function drawIdris(ctx, e, ghost) {
    const dt = ghost ? 0 : (G.game.dtVis || 0);
    const st = e.state, a = st === 'atk' ? e.atk : null;
    // --- pose ---
    K.blendPose(e, targetPose(e), dt, st === 'atk' ? 30 : e.hitK > 0 ? 40 : 12);
    const pose = { ...e.pose };
    const wa = a && a.wheel ? wheelA(e.st) : null;
    if (wa != null) pose.sw = wa;
    const J = Rig.compute(pose); e.J = J;
    // --- staging offsets: spawn descent, keel leap, death drift ---
    let offY = 0, alpha = 1;
    if (st === 'spawn') {
      const k = U.clamp(e.st / 1.5, 0, 1); offY = -470 * (1 - k * k);
      if (!ghost && k >= 1 && !e.landed) {
        e.landed = true; G.game.shake(0.9); sfx('c5_anchor', 1.3); sfx('c5_mag');
        G.FX.dust(e.x, e.y, 30, { w: 160, speed: 380, size: 20, col: 'rgba(170,190,220,' }); G.FX.ring(e.x, e.y, 20, 320, 0.7, AUR, 7, { flat: 0.18 });
      }
      if (k < 1) alpha = Math.min(1, e.st * 2.5);
    } else if (a && inWin(e.st, a.air)) offY = -Math.sin(PI * (e.st - a.air[0]) / (a.air[1] - a.air[0])) * 130;
    if (st === 'die') { const k = U.clamp(e.st / 0.5, 0, 1); offY = -k * 90; alpha = 1 - k; restoreGravity(); }
    e.offY = offY;
    const p2 = e.phase === 2 ? U.clamp((e.t - e.p2At) / 1.2, 0, 1) : 0;
    const flipOn = (G.LEVEL.gravity ?? 1) < 0;
    const mag = Math.max(a && inWin(e.st, a.mag) ? 1 : 0, flipOn ? 1 : 0, st === 'spawn' && e.st > 1.3 ? 1 : 0);
    const look = { p2, mag, chainGlow: p2, red: a && (a === keel || a === wheel || a === rain || a === rain2 || a === flip) };
    updCloth(e, J, dt, look);
    const an = anchorState(e, J, pose);
    if (an.geo) {
      // cache world positions for tells, hits and hazards
      e.gripW = toW(e, an.geo.grip); e.crownW = toW(e, an.geo.crown);
      e.headPrev = e.headW; e.headW = toW(e, an.geo.head);
    } else if (an.mode === 'out') { e.gripW = toW(e, J.hdF); e.crownW = { x: an.h.hx, y: an.h.hy }; e.headPrev = e.headW = null; }
    else { e.gripW = toW(e, J.hdF); e.crownW = { x: e.gripW.x, y: e.gripW.y - 300 }; e.headPrev = e.headW = null; }

    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    // phase-2 halo of debris: back half
    if (p2 > 0) drawDebris(ctx, e, J, p2, false);
    ctx.translate(e.x, e.y + offY); ctx.scale(e.facing * S, S);
    const toL = (q) => ({ x: (q.x - e.x) * e.facing / S, y: (q.y - e.y - offY) / S });
    const tq = torsoFrame(J), Q = tq.Q;

    // cold back-light that lifts his silhouette off the sky (aurora; violet once unmoored)
    glow(ctx, J.chest.x - 8, J.chest.y + 10, 105 + p2 * 30, p2 > 0 ? VIO : AUR, 0.1 + p2 * 0.08);
    // ---------- behind the body ----------
    if (p2 > 0 && e.sky.inited) {
      const pts = e.sky.p.map(toL);
      ctx.save(); ctx.globalAlpha *= p2;
      for (let i = 0; i < pts.length - 1; i++) drawChain(ctx, pts[i], pts[i + 1], 0, 6, 1.6, { chainGlow: 0.6 * (1 - i / pts.length) });
      const tip = pts[pts.length - 1];
      glow(ctx, tip.x, tip.y, 14, AUR, 0.35);
      ctx.restore();
    }
    // hair (silver, floats more and more)
    e.hair.forEach((c, i) => { if (!c.inited) return; const p = c.p.map(toL); Rig.ribbon(ctx, p, 3.2 - i * 0.5, 0.4, COL.hairD, 0.6); ink(ctx, 0.9); Rig.ribbon(ctx, p.map((q) => ({ x: q.x + 0.5, y: q.y - 0.7 })), 2.0 - i * 0.3, 0.2, COL.hair); });
    // back coat tail
    if (e.coatB.inited) K.tattered(ctx, e.coatB.p.map(toL), 11, 18, COL.coatD, COL.lining, 4);
    // back arm: sleeve + gauntlet
    Rig.limbChain(ctx, [J.shB, lerpP(J.shB, J.elB, 0.5), J.elB, lerpP(J.elB, J.hdB, 0.75)], [6.4, 6.0, 5.2, 4.6], COL.coatD);
    Rig.limb(ctx, lerpP(J.elB, J.hdB, 0.45), lerpP(J.elB, J.hdB, 0.78), 5.6, 5.2, '#141a36', { noHatch: true });
    Rig.limb(ctx, lerpP(J.elB, J.hdB, 0.8), lerpP(J.elB, J.hdB, 1.12), 4.6, 4.2, COL.ironD, { noHatch: true });
    // back leg: trouser + mag-boot
    drawLeg(ctx, J, false, mag, e);
    // anchor behind the body (back-swings, spin far side)
    const behind = an.mode === 'hand' && (an.spin ? an.depth < 0 : an.geo.ux < -0.35 && an.geo.uy < 0.6);
    if (behind) drawHeldAnchor(ctx, e, an, look, dt);

    // ---------- torso ----------
    drawTorso(ctx, J, tq, p2, e);
    // front leg
    drawLeg(ctx, J, true, mag, e);
    // front coat flap
    if (e.coatF.inited) K.tattered(ctx, e.coatF.p.map(toL), 6.5, 9.5, COL.coat, COL.lining, 7);
    // collar + head + beard
    Rig.limb(ctx, Q(1.0, -10), Q(1.24, -4.5), 4.2, 3.6, COL.coat, { noHatch: true });
    drawHead(ctx, J, e, p2, look, ghost);
    e.beard.forEach((c, i) => { if (!c.inited) return; const p = c.p.map(toL); Rig.ribbon(ctx, p, 3.6 - i, 0.5, COL.hairD, 1.0); ink(ctx, 1); Rig.ribbon(ctx, p.map((q) => ({ x: q.x + 0.6, y: q.y - 0.6 })), 2.3 - i * 0.6, 0.25, COL.hair, 0.5); });

    // ---------- anchor & front arm ----------
    if (!behind) {
      if (an.mode === 'out') drawThrownAnchor(ctx, e, J, an.h, toL, look);
      else if (an.mode === 'sky') drawSkyChain(ctx, e, J, look);
      else drawHeldAnchor(ctx, e, an, look, dt);
    }
    drawFrontArm(ctx, J, e);
    drawEpaulette(ctx, J, tq, e, p2);
    // tell glow at the anchor
    if (e.tellT > 0 && an.geo) { const c = an.geo.crown; glow(ctx, c.x, c.y, 34, e.tellCol === 'red' ? CRIM : '#ffffff', e.tellT * 1.3); }
    ctx.restore();
    if (p2 > 0) drawDebris(ctx, e, J, p2, true);
    if (st === 'broken' && !ghost) drawDazed(ctx, e, J);
  }

  function drawHeldAnchor(ctx, e, an, look, dt) {
    const gq = an.geo;
    // motion smear (white / red by the attack's colour) from the last few crown positions
    if (dt > 0) { e.trail.push({ x: gq.crown.x, y: gq.crown.y, t: e.t }); }
    while (e.trail.length && (e.t - e.trail[0].t > 0.12 || e.trail.length > 10)) e.trail.shift();
    const a = e.state === 'atk' ? e.atk : null;
    const near = a && (a.hits || []).some((h) => e.st >= h.t0 - 0.1 && e.st <= h.t1 + 0.06);
    if (near && e.trail.length > 2 && !LQ()) {
      const tr = e.trail, sp = Math.hypot(tr[tr.length - 1].x - tr[0].x, tr[tr.length - 1].y - tr[0].y);
      if (sp > 30) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const col = look.red ? CRIM : '#ffffff';
        ctx.strokeStyle = U.rgba(col, 0.18); ctx.lineWidth = 26; ctx.beginPath(); tr.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
        ctx.strokeStyle = U.rgba(col, 0.55); ctx.lineWidth = 6; ctx.stroke();
        ctx.restore();
      }
    }
    if (a && a.wheel && e.st > 0.6 && e.st < WHEEL_END) {
      // the danger disc of the wheel
      const r = CH_L + SH_L + 4;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = U.rgba(CRIM, 0.22 + 0.1 * Math.sin(e.t * 20)); ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(gq.grip.x, gq.grip.y, r - 10, 0, TAU); ctx.stroke();
      ctx.strokeStyle = U.rgba('#ffd0dc', 0.35); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(gq.grip.x, gq.grip.y, r, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    const sag = an.spin ? 0 : gq.grounded ? 4 : 1.5;
    drawChain(ctx, gq.grip, gq.ring, sag, 4.2, 1.5, look);
    if (an.spin) {
      const sc = 0.9 + 0.12 * an.depth;
      ctx.save(); ctx.transform(an.v.x * sc, an.v.y * sc, 0, 0.92 * sc, gq.ring.x, gq.ring.y);
      drawAnchor(ctx, { x: 0, y: 0 }, 0, look); ctx.restore();
    } else drawAnchor(ctx, gq.ring, gq.ang, look);
    if (look.p2 > 0) glow(ctx, gq.crown.x, gq.crown.y, 24, AUR, 0.3 * look.p2);
    if (an.spin && !LQ()) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(AURW, 0.22); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(gq.grip.x, gq.grip.y - 4, CH_L + SH_L - 4, (CH_L + SH_L) * 0.3, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  function drawThrownAnchor(ctx, e, J, h, toL, look) {
    const head = toL({ x: h.hx, y: h.hy });
    let ux = h.dx * e.facing, uy = h.dy; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
    const crown = head, ring = { x: crown.x - ux * SH_L, y: crown.y - uy * SH_L };
    const taut = h.phase === 'embed' || h.phase === 'hang';
    drawChain(ctx, J.hdF, ring, taut ? 0 : 6, 5, 1.5, look);
    drawAnchor(ctx, ring, Math.atan2(uy, ux), look);
    if (h.phase === 'fly') glow(ctx, crown.x, crown.y, 30, CRIM, 0.5);
  }
  function drawSkyChain(ctx, e, J, look) {
    const g = J.hdF, sway = Math.sin(e.t * 3) * 14;
    drawChain(ctx, g, { x: g.x + sway, y: g.y - 520 }, 0, 6.5, 1.6, { ...look, chainGlow: 0.8 });
    glow(ctx, g.x, g.y - 30, 30, AUR, 0.35);
  }

  function drawLeg(ctx, J, front, mag, e) {
    const hip = J.hip, knee = front ? J.kneeF : J.kneeB, ank = front ? J.ankF : J.ankB, toe = front ? J.toeF : J.toeB;
    const tr = front ? COL.trouser : '#181a2c', bt = front ? COL.boot : '#2a2e3c';
    Rig.limbChain(ctx, [hip, lerpP(hip, knee, 0.5), knee, lerpP(knee, ank, 0.35)], [9.4, 8.6, 6.8, 6.4], tr, { spec: front ? 0.2 : 0 });
    // heavy mag-boot: shaft, brass cuff, armoured foot, glowing sole
    const top = lerpP(knee, ank, 0.28);
    Rig.limb(ctx, top, ank, 7.4, 6.6, bt, { spec: front ? 0.35 : 0 });
    const c0 = lerpP(knee, ank, 0.2), c1 = lerpP(knee, ank, 0.33);
    Rig.limb(ctx, c0, c1, 8.0, 7.8, front ? '#2a2f3e' : '#1d212c', { noHatch: true });
    { const dx = c1.x - c0.x, dy = c1.y - c0.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, m = lerpP(c0, c1, 0.85);
      ctx.strokeStyle = front ? COL.brass : COL.brassD; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(m.x + nx * 7.6, m.y + ny * 7.6); ctx.lineTo(m.x - nx * 7.6, m.y - ny * 7.6); ctx.stroke();
      for (const k of [-4, 0, 4]) { const r = { x: lerpP(c0, c1, 0.4).x + nx * k, y: lerpP(c0, c1, 0.4).y + ny * k }; ctx.fillStyle = front ? COL.brass : COL.brassD; ctx.beginPath(); ctx.arc(r.x, r.y, 0.9, 0, TAU); ctx.fill(); } }
    const fx = toe.x - ank.x, fy = toe.y - ank.y, fl = Math.hypot(fx, fy) || 1, ux = fx / fl, uy = fy / fl;
    const heel = { x: ank.x - ux * 6, y: ank.y - uy * 6 + 2 }, tip = { x: ank.x + ux * 18, y: ank.y + uy * 18 };
    ctx.beginPath(); ctx.moveTo(heel.x - uy * 0, heel.y - 6); ctx.lineTo(ank.x + ux * 4 - uy * 7, ank.y + uy * 4 + ux * -7 - 1);
    ctx.quadraticCurveTo(tip.x - uy * 6, tip.y - 6, tip.x + ux * 3, tip.y + 1); ctx.lineTo(tip.x, tip.y + 4); ctx.lineTo(heel.x, heel.y + 4); ctx.closePath();
    ctx.fillStyle = bt; ctx.fill(); ink(ctx, 1.2);
    ctx.fillStyle = front ? COL.brass : COL.brassD; ctx.beginPath(); ctx.moveTo(tip.x - ux * 7 - 3, tip.y - 4); ctx.quadraticCurveTo(tip.x - 1, tip.y - 5, tip.x + ux * 3, tip.y + 1); ctx.lineTo(tip.x - ux * 6, tip.y + 1); ctx.closePath(); ctx.fill(); ink(ctx, 0.8);
    // sole plate
    ctx.fillStyle = COL.ironD; ctx.fillRect(Math.min(heel.x, tip.x) - 1, Math.max(heel.y, tip.y) + 2, Math.abs(tip.x - heel.x) + 4, 3.2);
    const gk = 0.35 + 0.65 * mag + (front ? 0 : -0.15);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = U.rgba(AUR, 0.5 + 0.5 * gk); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(heel.x + 1, Math.max(heel.y, tip.y) + 3.6); ctx.lineTo(tip.x + 1, Math.max(heel.y, tip.y) + 3.6); ctx.stroke();
    if (mag > 0 && !LQ()) { ctx.strokeStyle = U.rgba(AUR, 0.25 * mag); ctx.lineWidth = 7; ctx.stroke(); K.glow(ctx, (heel.x + tip.x) / 2, Math.max(heel.y, tip.y) + 3, 30, AUR, 0.35 * mag * (0.7 + 0.3 * Math.sin(e.t * 18))); }
    ctx.restore();
  }

  function drawTorso(ctx, J, tq, p2, e) {
    const Q = tq.Q, nx = tq.nx, ny = tq.ny;
    // greatcoat body: barrel chest, broad back
    const body = [Q(-0.3, -15), Q(0.25, -16.8), Q(0.66, -18), Q(0.98, -16), Q(1.15, -8.5), Q(1.2, 1), Q(1.12, 9.5), Q(0.88, 17.2), Q(0.5, 18), Q(0.14, 16), Q(-0.3, 14.5)];
    smoothClosed(ctx, body); ctx.fillStyle = cel(ctx, Q(0.5, 0), nx, ny, 18, COL.coat); ctx.fill(); ink(ctx, 1.4);
    // back seam + fold lines
    ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.8;
    poly(ctx, [Q(0.9, -12), Q(0.45, -11.5), Q(0.0, -12.5)], false); ctx.stroke();
    poly(ctx, [Q(0.75, -4), Q(0.35, -6), Q(-0.1, -5)], false); ctx.stroke();
    // double-breasted front panel
    const panel = [Q(1.06, 3.5), Q(1.0, 16), Q(0.52, 17.4), Q(0.04, 15.4), Q(0.06, 5.8), Q(0.56, 4.6)];
    poly(ctx, panel); ctx.fillStyle = COL.panel; ctx.fill(); ink(ctx, 1);
    // lapels (teal lining) with brass piping
    const lap = [Q(1.08, 3.0), Q(1.1, 12), Q(0.8, 16.4), Q(0.66, 8.8)];
    poly(ctx, lap); ctx.fillStyle = COL.lining; ctx.fill(); ink(ctx, 0.9);
    ctx.strokeStyle = COL.brass; ctx.lineWidth = 0.8; poly(ctx, [Q(1.1, 12), Q(0.8, 16.4), Q(0.52, 17.3)], false); ctx.stroke();
    // cravat
    poly(ctx, [Q(1.12, 6), Q(1.16, 11.5), Q(0.9, 10)]); ctx.fillStyle = COL.enamel; ctx.fill(); ink(ctx, 0.7);
    if (p2 > 0) {
      // the coat bursts on a crystal heart: a hollow of night with hush crystal ribs
      const tear = [Q(0.98, 6.5), Q(0.84, 12.5), Q(0.7, 9.5), Q(0.56, 15.5), Q(0.38, 10.5), Q(0.22, 13.5), Q(0.26, 6.5), Q(0.5, 3.5), Q(0.74, 5.5)];
      ctx.save(); ctx.globalAlpha *= p2;
      poly(ctx, tear); ctx.fillStyle = COL.cavity; ctx.fill(); ink(ctx, 1.1);
      ctx.save(); poly(ctx, tear); ctx.clip();
      const hc = Q(0.6, 9.5);
      glow(ctx, hc.x, hc.y, 18, AUR, 0.7 + 0.2 * Math.sin(e.t * 5));
      for (let i = 0; i < 5; i++) {
        const b = Q(0.3 + i * 0.13, 6 + (i % 2) * 2), l = 6 + (i % 3) * 2, an = -0.6 + i * 0.3;
        ctx.beginPath(); ctx.moveTo(b.x - 1.6, b.y); ctx.lineTo(b.x + Math.cos(an) * l, b.y + Math.sin(an) * l - 2); ctx.lineTo(b.x + 1.6, b.y + 0.5); ctx.closePath();
        ctx.fillStyle = i % 2 ? AUR : VIO; ctx.fill(); ink(ctx, 0.6);
      }
      ctx.restore();
      ctx.fillStyle = AURW; ctx.beginPath(); const c0 = Q(0.6, 9.5); ctx.moveTo(c0.x, c0.y - 4); ctx.lineTo(c0.x + 2.4, c0.y); ctx.lineTo(c0.x, c0.y + 4); ctx.lineTo(c0.x - 2.4, c0.y); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // brass buttons (two columns)
    for (const s of [0.3, 0.52, 0.74]) for (const f of [8.5, 14.2]) {
      if (p2 > 0.5 && f === 8.5 && s > 0.25 && s < 0.9) continue;
      const b = Q(s, f); ctx.beginPath(); ctx.arc(b.x, b.y, 1.25, 0, TAU); ctx.fillStyle = COL.brass; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.fillStyle = '#fff3c8'; ctx.fillRect(b.x + 0.2, b.y - 0.8, 0.5, 0.5);
    }
    // wide belt + ship's-wheel buckle
    Rig.limb(ctx, Q(0.03, -16.2), Q(0.03, 16.4), 2.9, 2.9, '#4a3226', { noHatch: true });
    const bk = Q(0.03, 11.5);
    ctx.beginPath(); ctx.arc(bk.x, bk.y, 3.6, 0, TAU); ctx.fillStyle = COL.brass; ctx.fill(); ink(ctx, 0.8);
    ctx.strokeStyle = COL.brassD; ctx.lineWidth = 0.6;
    for (let i = 0; i < 4; i++) { const an = i * PI / 4 + 0.3; ctx.beginPath(); ctx.moveTo(bk.x + Math.cos(an) * 4.6, bk.y + Math.sin(an) * 4.6); ctx.lineTo(bk.x - Math.cos(an) * 4.6, bk.y - Math.sin(an) * 4.6); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(bk.x, bk.y, 1.2, 0, TAU); ctx.fillStyle = AUR; ctx.fill();
    // chain bandolier across the chest (he lashed his crew to it)
    const b0 = Q(1.05, -13), b1 = Q(0.12, 13);
    drawChain(ctx, b0, b1, 2, 3.4, 1.15, { chainGlow: p2 * 0.6 });
  }

  function drawHead(ctx, J, e, p2, look, ghost) {
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha); ctx.scale(1.08, 1.08);
    // hair mass at the back of the skull
    ctx.beginPath(); ctx.moveTo(-1.5, -9.5); ctx.bezierCurveTo(-9, -10.5, -12.8, -5, -12.2, 1.5); ctx.bezierCurveTo(-11.8, 6, -8.5, 9.5, -4.5, 9); ctx.lineTo(0, 3); ctx.closePath();
    ctx.fillStyle = COL.hairD; ctx.fill(); ink(ctx, 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-3, -8.6); ctx.quadraticCurveTo(-9.5, -7.5, -10.8, -1); ctx.stroke();
    // weathered face in profile: heavy brow, big hooked nose
    const face = () => {
      ctx.beginPath(); ctx.moveTo(-2.5, -8.2); ctx.bezierCurveTo(2.5, -9.3, 7.2, -8.4, 8.9, -5.2);
      ctx.lineTo(10.7, -3.6); ctx.lineTo(9.1, -2.0); ctx.lineTo(9.7, -0.6); ctx.quadraticCurveTo(12.6, 2.0, 12.4, 3.4); ctx.lineTo(10.2, 3.6); ctx.lineTo(9.6, 4.4);
      ctx.lineTo(9.8, 9.2); ctx.lineTo(2.5, 10.6); ctx.lineTo(-2.8, 6.5); ctx.closePath();
    };
    face(); ctx.fillStyle = COL.skin; ctx.fill();
    ctx.save(); face(); ctx.clip();
    ctx.fillStyle = COL.skinD; ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(1.8, -8); ctx.quadraticCurveTo(3.2, 0, 1.8, 10.8); ctx.lineTo(-3, 10.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(120,60,80,0.45)'; ctx.beginPath(); ctx.ellipse(7.4, -1.6, 3.6, 2.6, 0.2, 0, TAU); ctx.fill();     // eye hollow
    ctx.fillStyle = 'rgba(255,236,214,0.85)'; ctx.beginPath(); ctx.moveTo(10.3, -0.2); ctx.quadraticCurveTo(12.1, 1.6, 12.0, 2.9); ctx.lineTo(11.3, 2.6); ctx.closePath(); ctx.fill();   // nose light
    ctx.strokeStyle = 'rgba(60,20,50,0.65)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(4.6, 0.6); ctx.quadraticCurveTo(6.8, 1.4, 8.0, 3.4); ctx.moveTo(3.2, -6.6); ctx.lineTo(6.4, -6.9); ctx.stroke();   // cheek cut, forehead line
    ctx.restore();
    face(); ink(ctx, 1.05);
    // hush crystals breaking out of the cheekbone (aurora), one violet
    for (const [x, y, l, an, c] of [[0.6, -1.5, 6.5, -2.55, AUR], [0.9, 1.6, 4.6, -3.0, '#4fe0b0'], [1.4, -4.2, 3.8, -2.05, VIO]]) {
      ctx.beginPath(); ctx.moveTo(x - Math.sin(an) * 1.4, y + Math.cos(an) * 1.4); ctx.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); ctx.lineTo(x + Math.sin(an) * 1.4, y - Math.cos(an) * 1.4); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ink(ctx, 0.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an) * l * 0.75, y + Math.sin(an) * l * 0.75); ctx.stroke();
    }
    ctx.strokeStyle = U.rgba('#2f9f80', 0.9); ctx.lineWidth = 0.45; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(1.2, -1.2); ctx.lineTo(3.6, -1.9); ctx.lineTo(4.6, -0.7); ctx.moveTo(1.4, 1.2); ctx.lineTo(3.4, 1.9); ctx.stroke();
    // deep socket + aurora eye under the brim
    ctx.fillStyle = '#1a0f22'; ctx.beginPath(); ctx.ellipse(7.5, -1.9, 2.3, 1.5, 0.15, 0, TAU); ctx.fill();
    const eg = 0.75 + 0.25 * Math.sin(e.t * 7) + p2 * 0.4;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = U.rgba(AURW, 0.95); ctx.beginPath(); ctx.ellipse(8.0, -1.9, 1.6, 0.65, 0.12, 0, TAU); ctx.fill();
    if (!LQ() || p2 > 0) K.glow(ctx, 8.0, -1.9, 8 + p2 * 6, AUR, 0.6 * eg);
    if (p2 > 0) { ctx.strokeStyle = U.rgba(AUR, 0.5 * p2); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(8.6, -2.2); ctx.quadraticCurveTo(4, -4 - Math.sin(e.t * 9), -2 - 3 * p2, -6 + Math.sin(e.t * 7) * 1.5); ctx.stroke(); }
    ctx.restore();
    // bushy white brow
    ctx.fillStyle = COL.hair; ctx.beginPath(); ctx.moveTo(4.0, -4.7); ctx.lineTo(11.3, -4.4); ctx.lineTo(10.4, -3.0); ctx.lineTo(6.5, -3.1); ctx.lineTo(4.2, -3.5); ctx.closePath(); ctx.fill(); ink(ctx, 0.5);
    // brass rebreather over mouth and jaw, filter can, hose into the collar
    const mask = () => { ctx.beginPath(); ctx.moveTo(4.8, 4.0); ctx.lineTo(10.4, 4.4); ctx.quadraticCurveTo(12.0, 7.4, 9.8, 10.2); ctx.lineTo(4.2, 10.6); ctx.quadraticCurveTo(3.0, 7.2, 4.8, 4.0); ctx.closePath(); };
    mask(); ctx.fillStyle = COL.brass; ctx.fill();
    ctx.save(); mask(); ctx.clip(); ctx.fillStyle = COL.brassD; ctx.fillRect(2, 8.0, 12, 5); ctx.restore();
    mask(); ink(ctx, 0.9);
    ctx.strokeStyle = 'rgba(11,6,18,0.7)'; ctx.lineWidth = 0.55;
    for (const y of [6.6, 7.9, 9.1]) { ctx.beginPath(); ctx.moveTo(8.6, y); ctx.lineTo(11.2, y + 0.2); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(5.4, 9.4, 2.7, 0, TAU); ctx.fillStyle = COL.ironD; ctx.fill(); ink(ctx, 0.8);
    ctx.strokeStyle = COL.brass; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(5.4, 9.4, 1.8, 0, TAU); ctx.stroke();
    ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(4.0, 11.0); ctx.quadraticCurveTo(-0.5, 15.4, -6, 13.8); ctx.stroke();
    ctx.strokeStyle = '#3c4152'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 0.5;
    for (let i = 1; i < 5; i++) { const t = i / 5, x = U.lerp(4.0, -6, t), y = U.lerp(11, 13.8, t) + Math.sin(t * PI) * 3; ctx.beginPath(); ctx.moveTo(x - 0.6, y - 0.9); ctx.lineTo(x + 0.6, y + 0.9); ctx.stroke(); }
    // the captain's sweeping white mustache, over the mask
    const mus = () => { ctx.beginPath(); ctx.moveTo(10.0, 3.4); ctx.quadraticCurveTo(12.6, 4.0, 13.4, 6.6); ctx.quadraticCurveTo(12.2, 5.6, 10.6, 5.7); ctx.quadraticCurveTo(8.0, 6.0, 5.6, 6.6); ctx.quadraticCurveTo(3.4, 6.6, 2.6, 4.8); ctx.quadraticCurveTo(5.6, 5.0, 7.0, 3.8); ctx.closePath(); };
    mus(); ctx.fillStyle = COL.hair; ctx.fill(); ink(ctx, 0.75);
    ctx.save(); mus(); ctx.clip(); ctx.fillStyle = COL.hairD; ctx.fillRect(2, 5.6, 12, 3); ctx.restore();
    ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(10.5, 4.2); ctx.quadraticCurveTo(8, 4.9, 4.6, 5.3); ctx.stroke();
    // captain's peaked cap: navy band, white enamel crown, black visor, brass anchor badge
    ctx.beginPath(); ctx.moveTo(-10.2, -7.8); ctx.lineTo(9.6, -7.0); ctx.lineTo(9.9, -10.8); ctx.lineTo(-9.6, -11.8); ctx.closePath(); ctx.fillStyle = COL.coatD; ctx.fill(); ink(ctx, 0.9);
    ctx.strokeStyle = COL.brass; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-10, -8.6); ctx.lineTo(9.6, -7.8); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0.4, -12.9, 12.6, 3.9, -0.04, 0, TAU);
    ctx.fillStyle = cel(ctx, { x: 0.4, y: -12.9 }, 0, -1, 4.5, COL.enamel); ctx.fill(); ink(ctx, 1);
    ctx.fillStyle = 'rgba(42,14,60,0.35)'; ctx.beginPath(); ctx.ellipse(0.4, -11.6, 11.8, 2.2, -0.04, 0, PI); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5.2, -7.6); ctx.quadraticCurveTo(12.5, -8.0, 15.8, -5.4); ctx.lineTo(12.2, -5.0); ctx.quadraticCurveTo(8, -6.2, 4.8, -6.4); ctx.closePath();
    ctx.fillStyle = '#141826'; ctx.fill(); ink(ctx, 0.9);
    ctx.strokeStyle = 'rgba(220,235,255,0.75)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(6.5, -7.4); ctx.quadraticCurveTo(12, -7.6, 14.6, -5.8); ctx.stroke();
    if (p2 > 0.3) { ctx.strokeStyle = U.rgba(AURW, p2); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(9, -7.6); ctx.lineTo(10.5, -6.4); ctx.lineTo(10, -5.6); ctx.stroke(); }
    // badge: tiny brass anchor in a laurel ring
    ctx.beginPath(); ctx.arc(6.8, -9.4, 1.9, 0, TAU); ctx.fillStyle = COL.brass; ctx.fill(); ink(ctx, 0.5);
    ctx.strokeStyle = COL.brassD; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(6.8, -10.6); ctx.lineTo(6.8, -8.2); ctx.moveTo(5.8, -8.9); ctx.quadraticCurveTo(6.8, -7.9, 7.8, -8.9); ctx.stroke();
    // phase 2: hush crystals split the crown of the cap
    if (p2 > 0) {
      ctx.save(); ctx.globalAlpha *= p2;
      for (const [x, l, an] of [[-4, 7, -0.35], [-0.5, 10, -0.1], [3, 6, 0.25]]) {
        ctx.beginPath(); ctx.moveTo(x - 1.6, -14.5); ctx.lineTo(x + Math.sin(an) * l, -14.5 - Math.cos(an) * l); ctx.lineTo(x + 1.6, -14.2); ctx.closePath();
        ctx.fillStyle = x > 0 ? VIO : AUR; ctx.fill(); ink(ctx, 0.6);
      }
      ctx.restore();
      glow(ctx, -0.5, -18, 14, AUR, 0.35 * p2);
    }
    ctx.restore();
  }

  function drawFrontArm(ctx, J, e) {
    Rig.limbChain(ctx, [J.sh, lerpP(J.sh, J.elF, 0.5), J.elF, lerpP(J.elF, J.hdF, 0.7)], [7.6, 7.0, 6.0, 5.4], COL.coat, { spec: 0.25 });
    // turned-back cuff with brass rings
    const c0 = lerpP(J.elF, J.hdF, 0.42), c1 = lerpP(J.elF, J.hdF, 0.76);
    Rig.limb(ctx, c0, c1, 6.5, 6.1, COL.coatD, { noHatch: true });
    const dx = c1.x - c0.x, dy = c1.y - c0.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    ctx.strokeStyle = COL.brass; ctx.lineWidth = 1;
    for (const k of [0.25, 0.6]) { const p = lerpP(c0, c1, k); ctx.beginPath(); ctx.moveTo(p.x + nx * 6, p.y + ny * 6); ctx.lineTo(p.x - nx * 6, p.y - ny * 6); ctx.stroke(); }
    // chain coiled round the forearm
    ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    const coil = (k) => { const p = lerpP(J.elF, J.hdF, k); ctx.beginPath(); ctx.moveTo(p.x + nx * 5.6, p.y + ny * 5.6); ctx.lineTo(p.x - nx * 5.6 + dx / l * 3, p.y - ny * 5.6 + dy / l * 3); };
    for (const k of [0.18, 0.3]) { coil(k); ctx.strokeStyle = INK; ctx.lineWidth = 2.8; ctx.stroke(); ctx.strokeStyle = COL.ironL; ctx.lineWidth = 1.3; ctx.stroke(); }
    // iron gauntlet fist
    const f0 = lerpP(J.elF, J.hdF, 0.8), f1 = { x: J.hdF.x + dx / l * 3, y: J.hdF.y + dy / l * 3 };
    Rig.limb(ctx, f0, f1, 5.2, 5.0, COL.glove, { spec: 0.4, noHatch: true });
    ctx.strokeStyle = 'rgba(11,6,18,0.7)'; ctx.lineWidth = 0.6;
    for (const k of [-1.6, 0, 1.6]) { const p = { x: f1.x + nx * k, y: f1.y + ny * k }; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, -0.3, 1.1); ctx.stroke(); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(AUR, 0.8); ctx.beginPath(); ctx.arc(f0.x + nx * 2, f0.y + ny * 2, 0.9, 0, TAU); ctx.fill(); ctx.restore();
  }

  function drawEpaulette(ctx, J, tq, e, p2) {
    const sh = J.sh, an = Math.atan2(tq.ny, tq.nx);
    // fringe: brass cords that sway (and float once unmoored)
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const u = (i - 3) / 3, bx = sh.x + Math.cos(an) * u * 8.5, by = sh.y + Math.sin(an) * u * 8.5 + 3.5;
      const sway = Math.sin(e.t * 3.2 + i) * 1.4 - e.vx * 0.004, lift = p2 * 9;
      const ex = bx + sway - e.facing * 0, ey = by + 8 - Math.abs(u) * 1.5 - lift;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + sway * 0.5, by + 4 - lift * 0.4, ex, ey);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke(); ctx.strokeStyle = i % 2 ? COL.brass : '#f0c97a'; ctx.lineWidth = 1.1; ctx.stroke();
    }
    ctx.beginPath(); ctx.ellipse(sh.x, sh.y + 0.5, 10, 5, an, 0, TAU);
    ctx.fillStyle = cel(ctx, sh, 0.5, -0.86, 9, COL.brass); ctx.fill(); ink(ctx, 1.1);
    ctx.beginPath(); ctx.ellipse(sh.x, sh.y + 0.5, 6.4, 2.8, an, 0, TAU); ctx.fillStyle = COL.coatD; ctx.fill(); ink(ctx, 0.6);
    ctx.fillStyle = '#fff3c8'; ctx.beginPath(); ctx.arc(sh.x + 1.5, sh.y - 2.4, 0.9, 0, TAU); ctx.fill();
  }

  // phase-2 orbit of torn chain links, bolts and plating (half behind, half in front)
  function drawDebris(ctx, e, J, p2, front) {
    const n = LQ() ? 5 : 8, cx = e.x + e.facing * (J.chest.x + 2) * S, cy = e.y + (e.offY || 0) + (J.chest.y + 8) * S;
    for (let i = 0; i < n; i++) {
      const th = e.t * 0.85 + i * TAU / n, dep = Math.sin(th);
      if ((dep >= 0) !== front) continue;
      const rx = (120 + (i % 3) * 22) * p2, x = cx + Math.cos(th) * rx, y = cy + dep * 24 * p2 + Math.sin(e.t * 1.7 + i) * 10 - (i % 2) * 30;
      const sc = (0.85 + 0.25 * dep) * S * 0.8, rot = e.t * (1 + i * 0.3) + i;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.globalAlpha *= p2 * (front ? 1 : 0.75);
      const k = i % 4;
      if (k === 0) { ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, 0, 0, TAU); ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.stroke(); ctx.strokeStyle = COL.ironL; ctx.lineWidth = 1.2; ctx.stroke(); }
      else if (k === 1) { ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(6, -2); ctx.lineTo(4, 4); ctx.lineTo(-4, 3); ctx.closePath(); ctx.fillStyle = COL.iron; ctx.fill(); ink(ctx, 0.9); ctx.fillStyle = COL.enamel; ctx.fillRect(-2, -1.5, 3, 1.2); }
      else if (k === 2) { ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(2.2, 0); ctx.lineTo(0, 6); ctx.lineTo(-2.2, 0); ctx.closePath(); ctx.fillStyle = AUR; ctx.fill(); ink(ctx, 0.7); }
      else { ctx.fillStyle = COL.brass; ctx.fillRect(-1.2, -4, 2.4, 8); ctx.fillRect(-2.6, -4.5, 5.2, 2); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.strokeRect(-1.2, -4, 2.4, 8); }
      ctx.restore();
      if (k === 2 && front) glow(ctx, x, y, 12, AUR, 0.35 * p2);
    }
  }

  function drawDazed(ctx, e, J) {
    const hx = e.x + e.facing * J.head.x * S, hy = e.y + J.head.y * S - 34;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a = e.t * 3 + i * TAU / 4, x = hx + Math.cos(a) * 30, y = hy + Math.sin(a) * 8;
      ctx.fillStyle = U.rgba('#ffd27a', 0.85); ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 1.6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 1.6, y); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y + 1.6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y - 1.6); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
})(window.G);

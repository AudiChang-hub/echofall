'use strict';
/* ECHOFALL — Chapter VI 渡魂船 THE SOUL FERRY — foes.
   渡船守衛 FERRY WARDEN · 沉睡的亡者 THE HUSHED · 調律者 THE TUNER · 寂翼 HUSH SERAPH · elite 船衛・洛克 ROOK, THE LAST SENTRY.
   Every foe is painted procedurally in the inked cel style (Rig helpers). See docs/CHAPTER_API.md §4–5 and docs/STORY.md §3 (VI). */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK, LB = Rig.limb, LC = Rig.limbChain, glow = K.glow, lerpP = K.lerpP;
  const CRIM = '#ff2a55', CYAN = '#6ff0ff', FROST = '#a9e4ff', AMBER = '#ffc861', ROSE = '#ff4f8b', TEAL = '#7dffcf';
  const DBG = typeof location !== 'undefined' && /c6hb/.test(location.href);   // dev aid: ?c6hb draws hit boxes
  const vdt = () => (G.game && G.game.dtVis) || 0;
  const D = G.DATA;

  /* =========================== shared painting helpers =========================== */
  function pth(ctx, a, close = true) { ctx.beginPath(); ctx.moveTo(a[0][0], a[0][1]); for (let i = 1; i < a.length; i++) ctx.lineTo(a[i][0], a[i][1]); if (close) ctx.closePath(); }
  // smooth closed curve through the midpoints of a polygon (soft but still shaped)
  function blob(ctx, a) {
    const n = a.length; ctx.beginPath(); ctx.moveTo((a[n - 1][0] + a[0][0]) / 2, (a[n - 1][1] + a[0][1]) / 2);
    for (let i = 0; i < n; i++) { const p = a[i], q = a[(i + 1) % n]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    ctx.closePath();
  }
  // hard cel fill lit from the world's key light (works in flipped contexts)
  function lit(ctx, cx, cy, w, hex) { const L = Rig.lightDir(ctx); return Rig.celGrad(ctx, cx, cy, L.x, L.y, w, 1, Rig.ramp(hex)); }
  function inkS(ctx, w = 1.1) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  function fillInk(ctx, style, w = 1.1) { ctx.fillStyle = style; ctx.fill(); inkS(ctx, w); }
  function lighter(ctx, fn) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; fn(); ctx.restore(); }
  function seg(ctx, x1, y1, x2, y2, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function spike(ctx, x, y, ang, len, w, col, edge) {
    // a crystal shard: two-tone facet + ink
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    pth(ctx, [[x + nx * w, y + ny * w], [x + dx * len, y + dy * len], [x - nx * w, y - ny * w]]); fillInk(ctx, col, 0.9);
    pth(ctx, [[x, y], [x + dx * len, y + dy * len], [x - nx * w, y - ny * w]]); ctx.fillStyle = edge; ctx.fill();
  }
  function crystalCluster(ctx, x, y, base, s, glowA, col, light, t) {
    // crimson Hush growth: 3–4 shards fanned around `base` angle, a glow behind
    if (glowA > 0) lighter(ctx, () => glow(ctx, x, y, 16 * s, col, glowA));
    const fan = [[-0.55, 0.7], [0.0, 1.0], [0.5, 0.62], [0.95, 0.42]];
    for (const [a, l] of fan) spike(ctx, x, y, base + a, 13 * s * l * (1 + 0.04 * Math.sin(t * 3 + a * 5)), 2.6 * s * (0.6 + l * 0.4), col, light);
  }
  const dieK = (e) => (e.state === 'die' ? U.clamp(e.st / 0.5, 0, 1) : 0);
  // death: the body comes apart in thinning horizontal bands (the Ark's stasis scanlines) and drifts upward as embers
  function dissolve(ctx, e, top, bot, ghost) {
    const k = dieK(e); if (k <= 0) return;
    ctx.globalAlpha *= Math.pow(1 - k, 0.7);
    ctx.beginPath();
    for (let y = top; y < bot; y += 6) {
      const h = 6 * (1 - k) * (0.5 + 0.5 * Math.abs(Math.sin(y * 0.37)));
      ctx.rect(-400 + Math.sin(y * 0.9) * k * 18, y - k * 10, 800, Math.max(0.15, h));
    }
    ctx.clip();
    if (!ghost && vdt() > 0 && Math.random() < 0.8) G.FX.ember(e.x, e.y - e.h * Math.random(), 2, e.T.col, { w: e.w, h: 12, up: 110 });
  }
  function tellGlow(ctx, x, y, e, r = 24) { if (e.tellT > 0) lighter(ctx, () => glow(ctx, x, y, r, e.tellCol === 'red' ? CRIM : '#ffffff', Math.min(1, e.tellT * 1.7))); }
  const toW = (e, p, s) => ({ x: e.x + e.facing * p.x * s, y: e.y + p.y * s });
  function hitFlash(ctx, e, fn) { K.flashOver(ctx, e, () => { ctx.fillStyle = '#fff'; fn(); }); }
  function dbg(ctx, e) {
    if (!DBG) return;
    ctx.save(); ctx.lineWidth = 2; ctx.setLineDash([]);
    const b = e.box; ctx.strokeStyle = 'rgba(80,170,255,0.9)'; ctx.strokeRect(b.x, b.y, b.w, b.h);
    if (e.atk && e.atk.hits) e.atk.hits.forEach((h) => {
      const w = e.boxW(h.box), act = e.st >= h.t0 && e.st <= h.t1;
      ctx.strokeStyle = act ? (h.red ? '#ff2040' : '#ffffff') : 'rgba(255,230,0,0.6)'; ctx.setLineDash(act ? [] : [6, 4]); ctx.strokeRect(w.x, w.y, w.w, w.h);
    });
    ctx.restore();
  }
  // humanoid pose resolver shared by the rig-based foes (Warden, the Hushed, Rook)
  function hPose(e, PS, dt, opt = {}) {
    let target = opt.override ? opt.override(e) : null;
    const st = e.state;
    if (target) { /* custom */ }
    else if (st === 'atk' && e.atk && e.atk.poses) target = Rig.sample(e.atk.poses, e.st);
    else if (st === 'hurt' || st === 'recoil') { const w = Math.sin(Math.min(1, e.st / (e.hurtDur || 0.36)) * PI); target = { ...PS.hurt, rx: (PS.hurt.rx || 0) - 6 * w, ry: (PS.hurt.ry || 0) + 3 * w }; }
    else if (st === 'broken') target = PS.broken(e.t);
    else if (st === 'die') target = PS.hurt;
    else if (opt.walk && Math.abs(e.vx) > 25 && e.onGround) {
      const prev = Math.floor((e.gaitP || 0) / PI);
      e.gaitP = (e.gaitP || 0) + Math.abs(e.vx) * dt * PI / (2 * (opt.stride || 15));
      if (opt.step && Math.floor(e.gaitP / PI) !== prev && Math.abs(e.x - e.P.x) < 700) opt.step(e);
      const w = Rig.ANIM.walk(e.gaitP), base = PS.idle(e.t, e);
      target = { ...base, ik: 1, fFx: w.fFx * (opt.gaitX || 1.1) + 4, fFy: w.fFy * 1.3, fBx: w.fBx * (opt.gaitX || 1.1) - 4, fBy: w.fBy * 1.3, ry: (base.ry || 0) + w.ry * 0.5 };
    } else target = PS.idle(e.t, e);
    if (e.onGround && st !== 'broken' && !target.ik) target = Rig.groundify(target);
    const hk = e.hitK;
    if (hk > 0) target = Rig.lerpPose(Rig.full(target), Rig.full({ ...Rig.full(target), ...PS.hitSnap }), Math.min(1, hk * 1.2));
    K.blendPose(e, target, dt, hk > 0 ? 45 : st === 'atk' ? 30 : 12);
    return Rig.compute(e.pose);
  }
  // torso frame helper: s along hip→chest, f sideways (+ = facing side)
  function torsoF(J) {
    const tA = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x), ux = Math.cos(tA), uy = Math.sin(tA), nx = -uy, ny = ux;
    return (s, f) => [J.hip.x + ux * s * 36 + nx * f, J.hip.y + uy * s * 36 + ny * f];
  }
  const P2 = (q) => ({ x: q[0], y: q[1] });
  const fwdAng = (a, b) => Math.atan2(b.x - a.x, b.y - a.y);   // rig angle (0 = down, + toward facing)

  // shield users (Warden, Rook): a frontal guard while standing; heavy blows knock it aside; three blocks → a counter
  const hinted = {};
  function barkOnce(id, delay = 0) { if (hinted[id]) return; hinted[id] = true; setTimeout(() => { if (G.game && G.game.state === 'play') G.game.bark(id); }, delay); }
  function shieldGuard(e, h, opt) {
    if (e.state !== 'idle' || (e.guardT || 0) > 0) return false;
    const P = G.game.player;
    if ((P.x - e.x) * e.facing <= 8) return false;             // flanked: the shield only covers the front
    const sp = opt.at(e);
    if (h.big) {                                                  // heavy / charged / crit blows bash the shield aside
      e.guardT = opt.knockT; e.shieldKnock = 1;
      G.SFX.play('c6_clang', 0.6); G.FX.spark(sp.x, sp.y, 16, { col: '#ffe2b0', speed: 700 }); G.game.shake(0.3);
      return false;
    }
    e.blocks = (e.blocks || 0) + 1; e.shieldJolt = 1;
    G.SFX.play('c6_clang', 1); G.FX.ring(sp.x, sp.y, 6, 46, 0.22, opt.col, 3);
    barkOnce('c6_shieldHint', 300);
    if (e.blocks >= opt.blocks) { e.blocks = 0; e.faceP(); e.startAtk(opt.counter); }
    return true;
  }
  const guardDown = (extra) => (e) => { e.guardT = Math.max(e.guardT || 0, e.atk.dur + extra); e.blocks = 0; };

  /* =========================== SFX (voices) =========================== */
  const A_ = () => G.AudioKit;
  Object.assign(G.SFX, {
    c6_clang(t, k = 1) { const A = A_(); A.bell(300 * k, t, 0.1, 0.5, 0.25, 1.3); A.noise(t, 0.001, 0.22, 0.08, 'bandpass', 2900, 1800, 1.3, 0.1); A.tone('sine', 120, t, 0.002, 0.2, 0.12, { to: 60 }); },
    c6_wardenVoice(t) {   // helmet radio squelch over a hollow grunt: 「請保持安靜」
      const A = A_();
      A.noise(t, 0.004, 0.1, 0.18, 'bandpass', 1900, 1100, 5, 0.05);
      A.tone('square', 880, t + 0.02, 0.004, 0.02, 0.06, { to: 640, filter: 'bandpass', ff: 1500 });
      A.tone('square', 640, t + 0.11, 0.004, 0.018, 0.07, { to: 980, filter: 'bandpass', ff: 1500 });
      A.tone('sawtooth', 104, t, 0.04, 0.07, 0.3, { to: 78, filter: 'lowpass', ff: 520, wet: 0.2 });
    },
    c6_crack(t, k = 1) { const A = A_(); for (let i = 0; i < 4; i++) A.noise(t + i * 0.035 * Math.random(), 0.001, 0.12 * k, 0.05, 'highpass', 3000 + i * 900, null, 0.8, 0.2); A.bell(1320 + Math.random() * 200, t, 0.03 * k, 0.6, 0.6, 1.4); },
    c6_hushedVoice(t) {   // a held breath let go — breathy, wrong, too close
      const A = A_();
      A.noise(t, 0.18, 0.07, 0.5, 'bandpass', 620, 380, 2.5, 0.4);
      A.tone('sine', 196, t, 0.12, 0.03, 0.5, { to: 174, wet: 0.6 });
      this.c6_crack(t + 0.1, 0.6);
    },
    c6_tune(t) {          // A440 against 444: a slow beating that never resolves
      const A = A_();
      A.tone('sine', 440, t, 0.01, 0.05, 1.1, { wet: 0.5 }); A.tone('sine', 444, t, 0.01, 0.05, 1.1, { wet: 0.5 });
      A.noise(t, 0.001, 0.14, 0.04, 'bandpass', 2200, 1500, 2, 0.05);
    },
    c6_ping(t) { const A = A_(); A.bell(A.mtof(81), t, 0.06, 0.7, 0.45, 1.1); A.tone('sine', 880, t, 0.005, 0.04, 0.25, { to: 1320, wet: 0.3 }); },
    c6_beam(t) {
      const A = A_();
      A.tone('sawtooth', 70, t, 0.05, 0.12, 1.0, { to: 150, filter: 'lowpass', ff: 900, wet: 0.2 });
      A.noise(t, 0.05, 0.12, 0.95, 'highpass', 4200, 6000, 0.7, 0.2);
      A.tone('sine', 1760, t, 0.02, 0.02, 0.9, { to: 1500, wet: 0.5 });
    },
    c6_steam(t) { const A = A_(); A.noise(t, 0.04, 0.12, 0.7, 'highpass', 2600, 1200, 0.6, 0.3); A.tone('sine', 220, t, 0.01, 0.03, 0.25, { to: 110 }); },
    c6_seraphVoice(t) {   // a chime-choir with no breath behind it
      const A = A_();
      [76, 79, 83].forEach((m, i) => A.tone('sine', A.mtof(m), t + i * 0.03, 0.15, 0.03, 0.7, { wet: 0.85 }));
      A.noise(t, 0.12, 0.05, 0.5, 'highpass', 6500, 8000, 0.6, 0.6);
    },
    c6_feather(t) { const A = A_(); A.tone('sine', 1900, t, 0.003, 0.03, 0.18, { to: 900, wet: 0.3 }); A.noise(t, 0.01, 0.06, 0.12, 'bandpass', 3000, 1500, 1, 0.1); },
    c6_rookVoice(t, p = 1) { const A = A_(); A.tone('sawtooth', 96 * p, t, 0.05, 0.11, 0.42, { to: 80 * p, filter: 'lowpass', ff: 480, wet: 0.3 }); A.noise(t, 0.02, 0.06, 0.2, 'bandpass', 380, 260, 1.5, 0.2); G.SFX.armor(t + 0.05); },
    c6_lamp(t) { const A = A_(); A.bell(A.mtof(88), t, 0.07, 1.2, 0.6, 0.8); A.tone('sine', 330, t, 0.25, 0.04, 0.5, { to: 990, wet: 0.5 }); },
  });

  /* =====================================================================================
     渡船守衛 FERRY WARDEN — riot-armoured ferry guard; riot shield + stun baton
     ===================================================================================== */
  const WS = 1.2;
  const WP = {
    idle: (t, e) => {
      const br = Math.sin(t * 1.9), up = e && e.guardT > 0 ? 0 : 1;
      return { ry: 5 + br * 1.1, rx: Math.sin(t * 0.6) * 1, torso: 0.2 + br * 0.015, head: -0.08, tF: 0.38, kF: -0.45, tB: -0.32, kB: -0.25,
        aF: 0.25 + br * 0.03, eF: 1.55, sw: 2.75, aB: U.lerp(0.35, 1.12, up), eB: U.lerp(0.2, 0.5, up) };
    },
    raise: { tF: 0.45, kF: -0.5, tB: -0.42, kB: -0.2, ry: 4, torso: -0.05, head: -0.1, aF: 2.65, eF: 0.55, sw: 3.75, aB: 1.15, eB: 0.5 },
    strike1: { tF: 0.85, kF: -0.95, tB: -0.6, kB: -0.15, ry: 11, torso: 0.5, head: 0.1, aF: 1.3, eF: 0.1, sw: 1.0, aB: 0.9, eB: 0.6 },
    back: { tF: 0.7, kF: -0.85, tB: -0.55, kB: -0.2, ry: 10, torso: 0.4, head: 0.1, aF: 0.35, eF: 0.3, sw: -0.4, aB: 1.0, eB: 0.5 },
    strike2: { tF: 0.75, kF: -0.8, tB: -0.6, kB: -0.15, ry: 8, torso: 0.32, head: -0.05, aF: 1.95, eF: 0.0, sw: 2.25, aB: 1.0, eB: 0.5 },
    thrA: { tF: 0.5, kF: -0.6, tB: -0.45, kB: -0.3, ry: 8, torso: 0.1, head: 0.0, aF: -0.2, eF: 1.9, sw: 1.57, aB: 1.15, eB: 0.5 },
    thrB: { tF: 0.95, kF: -0.95, tB: -0.75, kB: -0.1, ry: 13, torso: 0.55, head: -0.1, aF: 1.5, eF: 0.0, sw: 1.57, aB: 0.8, eB: 0.7 },
    brace: { tF: 0.7, kF: -1.15, tB: -0.5, kB: -0.55, ry: 15, torso: 0.5, head: 0.15, aF: 0.4, eF: 1.5, sw: 3.0, aB: 1.4, eB: 0.2 },
    bash: { tF: 1.0, kF: -0.8, tB: -0.9, kB: -0.1, ry: 12, torso: 0.7, head: 0.05, aF: 0.3, eF: 1.3, sw: 2.6, aB: 1.62, eB: 0.0 },
    tired: { tF: 0.6, kF: -0.9, tB: -0.5, kB: -0.4, ry: 14, torso: 0.75, head: 0.4, aF: 0.1, eF: 0.4, sw: 0.6, aB: 0.3, eB: 0.2 },
    hurt: { ry: 8, torso: -0.35, head: 0.5, tF: 0.15, kF: -0.6, tB: -0.55, kB: -0.45, aF: -0.5, eF: 1.1, sw: 2.2, aB: 0.6, eB: 1.0 },
    hitSnap: { torso: -0.4, head: 0.6, aF: -0.3, eF: 1.2, aB: 0.6, eB: 0.9, ry: 6 },
    broken: (t) => ({ ry: 27, torso: 0.9 + Math.sin(t * 2.6) * 0.05, head: 0.7, tF: 1.3, kF: -1.35, tB: 0.0, kB: -1.57, aF: 0.15, eF: 0.2, sw: 0.4, aB: 0.25, eB: 0.2 }),
  };
  const wardenShield = (e) => { const J = e.J; if (!J || !J.shc) return { x: e.x + e.facing * 50, y: e.y - 90 }; return toW(e, J.shc, WS); };
  TYPES.c6_warden = {
    name: '渡船守衛', en: 'FERRY WARDEN', w: 44, h: 146, hp: 150, bal: 110, col: CYAN, shards: 58, poise: true, scale: WS, spawnT: 0.9, kbMul: 0.8,
    portrait: [2.1, 0.92],
    init(e) { e.guardT = 0; e.blocks = 0; e.antenna = new Rig.Chain(4, 7, 0.22, 0.8); },
    voice: () => G.SFX.play('c6_wardenVoice'),
    weapon: (e) => {
      if (e.atk === TYPES.c6_warden.bash || e.atk === TYPES.c6_warden.shove) return wardenShield(e);
      const J = e.J; return J ? toW(e, J.btip, WS) : { x: e.x + e.facing * 60, y: e.y - 120 };
    },
    think(e, dt) {
      const T = TYPES.c6_warden;
      e.guardT = Math.max(0, e.guardT - dt);
      e.faceP(); const d = e.distP();
      const want = 98;
      if (d > want + 30) e.vx = U.approach(e.vx, e.facing * 120 * e.speedMul, 800 * dt);
      else if (d < want - 40) e.vx = U.approach(e.vx, -e.facing * 80, 800 * dt);
      else e.vx = U.approach(e.vx, 0, 800 * dt);
      if (e.cd <= 0) {
        if (e.roll == null) e.roll = Math.random();
        if (d < 150) { e.startAtk(e.roll < 0.62 ? T.baton3 : T.bash); e.roll = null; }
        else if (d < 270 && e.roll < 0.45) { e.startAtk(T.bash); e.roll = null; }
      }
    },
    atkUpdate(e, dt) { e.guardT = Math.max(0, e.guardT - dt); },
    guard(e, h) { return shieldGuard(e, h, { at: wardenShield, knockT: 1.3, blocks: 3, counter: TYPES.c6_warden.shove, col: CYAN }); },
    // three baton blows: overhead, rising backhand, straight jab (all white)
    baton3: {
      dur: 2.15, cd: 1.4, onStart: guardDown(0.7),
      tells: [{ t: 0.15, c: 'white' }, { t: 0.62, c: 'white' }, { t: 1.08, c: 'white' }],
      poses: { dur: 2.15, keys: [[0, WP.idle(0)], [0.45, WP.raise], [0.62, WP.strike1, 'snap'], [0.9, WP.back, 'io'], [1.08, WP.strike2, 'snap'], [1.35, WP.thrA, 'io'], [1.56, WP.thrB, 'snap'], [2.15, WP.idle(0), 'io']] },
      moves: [{ t0: 0.5, t1: 0.62, v: 240 }, { t0: 0.98, t1: 1.08, v: 200 }, { t0: 1.46, t1: 1.58, v: 300 }],
      hits: [
        { t0: 0.6, t1: 0.7, box: { x: 0, y: -178, w: 116, h: 165 }, dmg: 16, kb: 220 },
        { t0: 1.07, t1: 1.17, box: { x: 0, y: -186, w: 108, h: 170 }, dmg: 16, kb: 220 },
        { t0: 1.54, t1: 1.66, box: { x: 0, y: -112, w: 124, h: 46 }, dmg: 19, kb: 300, last: true, pbal: 46 },
      ],
      ev: [{ t: 0.6, fn: () => G.SFX.play('whoosh', 0.9) }, { t: 1.07, fn: () => G.SFX.play('whoosh', 0.8) }, { t: 1.54, fn: () => G.SFX.play('slash', 0.7) }],
    },
    // crouch behind the shield, then a full-body charge (red — dodge through it)
    bash: {
      dur: 2.0, cd: 1.5, track: false, onStart: guardDown(0.8),
      tells: [{ t: 0.28, c: 'red' }],
      poses: { dur: 2.0, keys: [[0, WP.idle(0)], [0.55, WP.brace], [0.85, WP.brace], [0.95, WP.bash, 'snap'], [1.25, WP.bash], [1.5, WP.tired, 'io'], [2.0, WP.idle(0), 'io']] },
      moves: [{ t0: 0.88, t1: 1.2, v: 640 }],
      hits: [{ t0: 0.9, t1: 1.2, box: { x: 0, y: -166, w: 92, h: 160 }, dmg: 28, red: true, kb: 440, last: true }],
      ev: [{ t: 0.88, fn: (e) => { G.SFX.play('whoosh', 1.2); G.FX.dust(e.x, e.y, 10, { w: 30, speed: 220, size: 12, dir: e.facing > 0 ? PI : 0, spread: 0.8 }); } }],
    },
    // counter after three blocked hits: a short shield shove (white)
    shove: {
      dur: 1.2, cd: 1.0, onStart: guardDown(0.5),
      tells: [{ t: 0.08, c: 'white' }],
      poses: { dur: 1.2, keys: [[0, WP.brace], [0.42, WP.brace], [0.56, WP.bash, 'snap'], [0.8, WP.bash], [1.2, WP.idle(0), 'io']] },
      moves: [{ t0: 0.5, t1: 0.62, v: 300 }],
      hits: [{ t0: 0.54, t1: 0.66, box: { x: 0, y: -166, w: 92, h: 160 }, dmg: 15, kb: 400, last: true, pbal: 40 }],
      ev: [{ t: 0.54, fn: () => G.SFX.play('c6_clang', 0.8) }],
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : vdt();
      const J = hPose(e, WP, dt, { walk: true, stride: 14, step: () => G.SFX.play('stepOn', 'concrete', 0.9) });
      const bd = { x: Math.sin(J.sw), y: Math.cos(J.sw) };
      J.btip = { x: J.hdF.x + bd.x * 46, y: J.hdF.y + bd.y * 46 }; J.bbut = { x: J.hdF.x - bd.x * 8, y: J.hdF.y - bd.y * 8 };
      e.J = J;
      if (!ghost) {
        e.shieldJolt = Math.max(0, (e.shieldJolt || 0) - dt * 5); e.shieldKnock = Math.max(0, (e.shieldKnock || 0) - dt * 1.4);
        const ant = toW(e, { x: J.chest.x - 13, y: J.chest.y - 6 }, WS);
        e.antenna.update(ant.x, ant.y, e.facing, dt, -e.vx * 3, 0.3);
      }
      const sink = K.emerge(ctx, e) * 160;
      ctx.save();
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing * WS, WS);
      dissolve(ctx, e, -150, 10, ghost);
      drawWarden(ctx, e, J);
      ctx.restore();
      dbg(ctx, e);
    },
  };

  const WC = { enamel: '#e3e8ec', enamelB: '#aab4bf', suit: '#2d3648', suitB: '#1d2433', glass: '#122230', boot: '#3a3f4c', grip: '#24262e', steel: '#9aa7b4' };
  function drawWarden(ctx, e, J) {
    const t = e.t, broken = e.state === 'broken';
    const Q = torsoF(J);
    // antenna whip (world chain → local)
    if (e.antenna.inited) {
      const pts = e.antenna.p.map((q) => ({ x: (q.x - e.x) * e.facing / WS, y: (q.y - e.y) / WS }));
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
      ctx.strokeStyle = '#7d8896'; ctx.lineWidth = 0.7; ctx.stroke();
      const tip = pts[pts.length - 1];
      lighter(ctx, () => { glow(ctx, tip.x, tip.y, 6, broken ? CRIM : CYAN, 0.8); });
    }
    // radio pack on the back
    blob(ctx, [Q(0.45, -11), Q(0.95, -12), Q(1.0, -19), Q(0.55, -20)]); fillInk(ctx, lit(ctx, ...Q(0.75, -15), 6, '#59657a'), 1);
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 0.6; ctx.beginPath(); for (const s of [0.6, 0.7, 0.8]) { const a = Q(s, -13), b = Q(s, -18.5); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
    // back leg + back arm (shadow side)
    LC(ctx, [J.hip, lerpP(J.hip, J.kneeB, 0.5), J.kneeB, lerpP(J.kneeB, J.ankB, 0.5), J.ankB], [6.4, 5.8, 4.6, 4.2, 3.2], WC.suitB);
    LB(ctx, lerpP(J.kneeB, J.ankB, 0.12), lerpP(J.kneeB, J.ankB, 0.85), 5.2, 4.2, WC.enamelB, { spec: 0.2 });
    LB(ctx, J.ankB, J.toeB, 3.8, 2.8, '#2a2e38');
    LC(ctx, [J.shB, J.elB, J.hdB], [4.4, 3.8, 3.0], WC.suitB);
    // torso: undersuit
    blob(ctx, [Q(-0.12, -9.5), Q(0.45, -10.5), Q(0.92, -12.5), Q(1.1, -6), Q(1.08, 6), Q(0.85, 12), Q(0.45, 10.5), Q(-0.05, 9.5)]);
    fillInk(ctx, lit(ctx, ...Q(0.5, 0), 13, WC.suit), 1.3);
    // enamel riot vest (bulky, two plates)
    blob(ctx, [Q(0.38, -12), Q(0.98, -13.5), Q(1.1, -4), Q(1.06, 8.5), Q(0.82, 14), Q(0.42, 12.5)]);
    fillInk(ctx, lit(ctx, ...Q(0.72, 1), 14, WC.enamel), 1.3);
    pth(ctx, [Q(0.12, -10.5), Q(0.4, -11), Q(0.42, 12), Q(0.12, 11)]); fillInk(ctx, lit(ctx, ...Q(0.26, 0), 11, WC.enamelB), 1);
    // cyan service stripe + collar number
    lighter(ctx, () => { const a = Q(0.6, -12), b = Q(0.66, 13); seg(ctx, a[0], a[1], b[0], b[1], 'rgba(111,240,255,0.85)', 1.5); });
    ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 0.6; ctx.beginPath(); { const a = Q(0.95, -6), b = Q(0.86, 11); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
    // belt + pouches
    { const a = Q(0.1, -10.5), b = Q(0.1, 10.5); LB(ctx, P2(a), P2(b), 2.4, 2.4, '#1a1c24', { noHatch: true }); }
    for (const f of [-5, 4]) { const c = Q(0.02, f); pth(ctx, [[c[0] - 3, c[1] - 2], [c[0] + 3, c[1] - 2], [c[0] + 3, c[1] + 5], [c[0] - 3, c[1] + 5]]); fillInk(ctx, '#3c4250', 0.8); }
    // the Hush got in through a crack in the vest: crimson crystals + veins
    const cc = Q(0.74, 10);
    ctx.strokeStyle = U.rgba(CRIM, 0.75); ctx.lineWidth = 0.7; ctx.beginPath();
    ctx.moveTo(cc[0], cc[1]); ctx.lineTo(cc[0] - 6, cc[1] - 3); ctx.lineTo(cc[0] - 9, cc[1] + 1); ctx.moveTo(cc[0], cc[1]); ctx.lineTo(cc[0] - 3, cc[1] + 7); ctx.stroke();
    crystalCluster(ctx, cc[0], cc[1], -0.9, 0.62, 0.5 + 0.2 * Math.sin(t * 3), CRIM, '#ffc2d0', t);
    // front leg: armoured shin + knee cop
    LC(ctx, [J.hip, lerpP(J.hip, J.kneeF, 0.5), J.kneeF, lerpP(J.kneeF, J.ankF, 0.5), J.ankF], [7.0, 6.2, 4.8, 4.4, 3.3], WC.suit, { spec: 0.25 });
    LB(ctx, lerpP(J.kneeF, J.ankF, 0.12), lerpP(J.kneeF, J.ankF, 0.88), 5.6, 4.4, WC.enamel, { spec: 0.4 });
    LB(ctx, lerpP(J.hip, J.kneeF, 0.92), lerpP(J.kneeF, J.ankF, 0.1), 5.4, 5.0, WC.enamelB, { noHatch: true });
    LB(ctx, J.ankF, J.toeF, 4.0, 3.0, WC.boot);
    // helmet
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    blob(ctx, [[-10.5, -1], [-9.5, -10], [-2, -14.5], [7, -12.5], [11.5, -5], [11.5, 3], [3, 5], [-9.5, 6]]); fillInk(ctx, lit(ctx, 0, -4, 12, WC.enamel), 1.3);
    pth(ctx, [[-9, 3], [-11.5, 9], [-4, 11], [1, 6]]); fillInk(ctx, WC.enamelB, 0.9);             // neck guard
    pth(ctx, [[1.5, -7.5], [12.2, -6.2], [12.8, 1.6], [2.4, 1.2]]); fillInk(ctx, WC.glass, 1);    // visor
    pth(ctx, [[2, 1.8], [12, 2.2], [10, 8.5], [2.5, 9], [-1.5, 5.5]]); fillInk(ctx, lit(ctx, 5, 5, 6, '#c2cbd4'), 1); // jaw guard
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 0.5; ctx.beginPath(); for (const x of [4, 6.5, 9]) { ctx.moveTo(x, 4); ctx.lineTo(x - 0.6, 8); } ctx.stroke();
    // visor scan line: cyan, with one crimson fracture
    const scan = broken ? 0.4 + Math.random() * 0.4 : 0.85 + Math.sin(t * 7) * 0.1;
    lighter(ctx, () => {
      ctx.fillStyle = U.rgba(CYAN, scan); ctx.fillRect(4, -3.6, 8, 1.6);
      glow(ctx, 9, -2.8, 9, CYAN, 0.45 * scan);
      ctx.strokeStyle = U.rgba(CRIM, 0.9); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(6, -7); ctx.lineTo(7.5, -4.5); ctx.lineTo(6.2, -2); ctx.lineTo(8, 1); ctx.stroke();
    });
    ctx.strokeStyle = U.rgba(CYAN, 0.7); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(1, -2, 11.5, -2.3, -1.1); ctx.stroke();  // crest stripe
    spike(ctx, -7, -9, -2.2, 9, 2, CRIM, '#ffc2d0'); spike(ctx, -9.5, -5, -2.7, 6, 1.6, CRIM, '#ffc2d0');
    ctx.restore();
    // riot shield on the back hand
    const fa = fwdAng(J.elB, J.hdB);
    const knock = e.shieldKnock || 0, jolt = e.shieldJolt || 0;
    const sc = { x: J.hdB.x + 3 - jolt * 3, y: J.hdB.y - 6 }; J.shc = { x: sc.x + 6, y: sc.y };
    ctx.save(); ctx.translate(sc.x, sc.y); ctx.rotate((PI / 2 - fa) * 0.45 + knock * 0.5 - jolt * 0.08);
    const sh = 39, sw2 = 9;
    pth(ctx, [[-sw2 - 3, -sh + 2], [-sw2, -sh], [-sw2, sh], [-sw2 - 3, sh - 2]]); fillInk(ctx, '#7c8796', 1);   // edge thickness
    blob(ctx, [[-sw2, -sh], [sw2 + 2, -sh + 1], [sw2 + 3, -sh + 10], [sw2 + 3, sh - 8], [sw2 + 1, sh], [-sw2, sh], [-sw2 - 1, 0]]);
    ctx.fillStyle = lit(ctx, 0, 0, 12, '#9fb6c6'); ctx.fill();
    // polycarbonate window (translucent, shows a faint reflection streak)
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(160,230,255,0.25)'; ctx.fillRect(-sw2 + 2, -sh + 6, sw2 * 2 - 1, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; pth(ctx, [[-sw2 + 3, -sh + 30], [sw2 + 3, -sh + 14], [sw2 + 3, -sh + 18], [-sw2 + 3, -sh + 35]]); ctx.fill();
    ctx.fillStyle = 'rgba(20,30,46,0.55)'; pth(ctx, [[-sw2, sh - 22], [sw2 + 3, sh - 30], [sw2 + 3, sh], [-sw2, sh]]); ctx.fill();
    ctx.restore();
    blob(ctx, [[-sw2, -sh], [sw2 + 2, -sh + 1], [sw2 + 3, -sh + 10], [sw2 + 3, sh - 8], [sw2 + 1, sh], [-sw2, sh], [-sw2 - 1, 0]]); inkS(ctx, 1.4);
    ctx.strokeStyle = WC.enamel; ctx.lineWidth = 1.6; ctx.strokeRect(-sw2 + 2, -sh + 4, sw2 * 2 - 1, sh * 2 - 8);
    // stencilled ferry service marks (blocks, not text)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 4; i++) ctx.fillRect(-2, -6 + i * 5, 6, 2.6);
    lighter(ctx, () => { ctx.fillStyle = U.rgba(CYAN, 0.7); ctx.fillRect(-sw2 + 3, -sh + 26, sw2 * 2 - 3, 1.2); });
    crystalCluster(ctx, sw2 + 2, sh - 10, 0.6, 0.55, 0.35, CRIM, '#ffc2d0', t);
    if (jolt > 0) lighter(ctx, () => glow(ctx, sw2, 0, 30, '#ffffff', jolt * 0.6));
    ctx.restore();
    // front arm: pauldron, sleeve, enamel bracer, glove, stun baton
    LC(ctx, [J.sh, lerpP(J.sh, J.elF, 0.5), J.elF, J.hdF], [4.6, 4.2, 3.6, 3.0], WC.suit, { spec: 0.25 });
    LB(ctx, lerpP(J.elF, J.hdF, 0.12), lerpP(J.elF, J.hdF, 0.85), 4.0, 3.4, WC.enamel, { spec: 0.4 });
    blob(ctx, [[J.sh.x - 7, J.sh.y - 1], [J.sh.x - 2, J.sh.y - 7], [J.sh.x + 6, J.sh.y - 5], [J.sh.x + 8, J.sh.y + 3], [J.sh.x, J.sh.y + 6]]);
    fillInk(ctx, lit(ctx, J.sh.x, J.sh.y - 1, 8, WC.enamel), 1.2);
    lighter(ctx, () => seg(ctx, J.sh.x - 5, J.sh.y - 3, J.sh.x + 6, J.sh.y - 2, U.rgba(CYAN, 0.6), 1));
    LB(ctx, J.bbut, J.hdF, 2.2, 2.4, WC.grip, { noHatch: true });
    LB(ctx, J.hdF, J.btip, 2.3, 2.0, WC.steel, { spec: 0.5 });
    const c0 = lerpP(J.hdF, J.btip, 0.55);
    const charging = e.state === 'atk' && e.atk === TYPES.c6_warden.baton3;
    lighter(ctx, () => {
      seg(ctx, c0.x, c0.y, J.btip.x, J.btip.y, U.rgba(CYAN, charging ? 0.95 : 0.6), 2.4);
      glow(ctx, J.btip.x, J.btip.y, charging ? 13 : 8, CYAN, charging ? 0.7 : 0.35);
      if (charging && Math.random() < 0.5) { const q = lerpP(c0, J.btip, Math.random()); seg(ctx, q.x, q.y, q.x + (Math.random() - 0.5) * 9, q.y + (Math.random() - 0.5) * 9, 'rgba(220,255,255,0.9)', 0.7); }
    });
    ctx.beginPath(); ctx.arc(J.hdF.x, J.hdF.y, 3.3, 0, TAU); fillInk(ctx, '#2a2a30', 0.9);   // gloved fist
    const tw = e.atk === TYPES.c6_warden.bash || e.atk === TYPES.c6_warden.shove ? J.shc : J.btip;
    tellGlow(ctx, tw.x, tw.y, e, 26);
    hitFlash(ctx, e, () => { ctx.beginPath(); ctx.ellipse(J.hip.x, J.hip.y - 26, 20, 60, 0, 0, TAU); ctx.fill(); });
  }

  /* =====================================================================================
     沉睡的亡者 THE HUSHED — dead passengers frozen mid-step; noise wakes them, quiet lets them sleep again
     ===================================================================================== */
  const HS = 0.96;
  const HV = [   // four citizens, four frozen moments
    { key: 'commuter', frozen: { ry: 3, torso: 0.12, head: 0.06, tF: 0.38, kF: -0.18, tB: -0.38, kB: -0.55, aF: -0.38, eF: 0.45, aB: 0.5, eB: 0.6, sw: 0 },
      cloth: '#5b6c80', clothB: '#3e4b5c', hair: '#3f3c4a', accent: '#c9a96a' },
    { key: 'gardener', frozen: { ry: 9, torso: 0.6, head: 0.25, tF: 0.25, kF: -0.6, tB: -0.25, kB: -0.25, aF: 1.15, eF: 0.35, aB: 0.85, eB: 0.6, sw: 0 },
      cloth: '#6f8058', clothB: '#4b5a3c', hair: '#d0b886', accent: '#f0a3b8' },
    { key: 'elder', frozen: { ry: 7, torso: 0.38, head: -0.12, tF: 0.22, kF: -0.32, tB: -0.2, kB: -0.32, aF: 0.55, eF: 0.25, aB: 0.2, eB: 0.4, sw: 0 },
      cloth: '#7a6280', clothB: '#544258', hair: '#c9ccd8', accent: '#d8c27a' },
    { key: 'musician', frozen: { ry: 1, torso: -0.06, head: -0.4, tF: 0.15, kF: -0.1, tB: -0.2, kB: -0.15, aF: 2.45, eF: 0.25, aB: -0.2, eB: 0.35, sw: 0 },
      cloth: '#3e4156', clothB: '#2a2c3c', hair: '#26252f', accent: '#8a5a3a' },
  ];
  const HP = {
    idle: (t, e) => {
      if (e && !e.awake) return HV[e.v || 0].frozen;
      const j = Math.sin(t * 13) * Math.max(0, Math.sin(t * 2.3)) * 0.08;   // stuttering, like a scratched record
      return { ry: 7, torso: 0.32 + j, head: 0.3 - j * 2, tF: 0.3, kF: -0.4, tB: -0.3, kB: -0.25, aF: 1.15 + j, eF: 0.35, aB: 0.95 - j, eB: 0.45, sw: 0 };
    },
    pull: { ry: 6, torso: 0.1, head: 0.1, tF: 0.4, kF: -0.5, tB: -0.4, kB: -0.25, aF: 0.4, eF: 1.9, aB: 0.3, eB: 1.8 },
    reach: { ry: 10, torso: 0.55, head: 0.0, tF: 0.9, kF: -0.95, tB: -0.7, kB: -0.15, aF: 1.5, eF: 0.04, aB: 1.42, eB: 0.08 },
    raise: { ry: 1, torso: -0.18, head: -0.3, tF: 0.35, kF: -0.4, tB: -0.35, kB: -0.2, aF: 3.0, eF: 0.3, aB: 2.85, eB: 0.35 },
    raise2: { ry: -1, torso: -0.24, head: -0.35, tF: 0.35, kF: -0.4, tB: -0.35, kB: -0.2, aF: 3.15, eF: 0.25, aB: 3.0, eB: 0.3 },
    slam: { ry: 16, torso: 0.72, head: 0.35, tF: 0.85, kF: -1.1, tB: -0.6, kB: -0.4, aF: 1.05, eF: 0.15, aB: 0.95, eB: 0.25 },
    hurt: { ry: 6, torso: -0.3, head: 0.55, tF: 0.15, kF: -0.5, tB: -0.5, kB: -0.4, aF: 0.4, eF: 1.4, aB: 0.2, eB: 1.2 },
    hitSnap: { torso: -0.35, head: 0.7, aF: 0.2, eF: 1.5, aB: 0.0, eB: 1.2, ry: 5 },
    broken: (t) => ({ ry: 28, torso: 0.95 + Math.sin(t * 2) * 0.04, head: 0.8, tF: 1.3, kF: -1.4, tB: 0.0, kB: -1.57, aF: 0.1, eF: 0.1, aB: 0.05, eB: 0.1 }),
  };
  const LOUD = { light: 1.5, heavy: 1.8, charge: 1.3, air: 1.4, counter: 1.6, skill1: 1.8, skill2: 1.8, execute: 2, hurt: 1, blocked: 1.1, parried: 1.1, dodge: 0.85 };
  function noiseAt(e) {
    const P = G.game.player; if (!P) return 0;
    const dx = Math.abs(P.x - e.x), dy = Math.abs(P.y - e.y);
    if (dy > 240) return 0;
    let lvl = LOUD[P.state] || 0, rad = lvl >= 1.2 ? 380 : 270;
    if (!lvl && P.onGround && Math.abs(P.vx) > 240) { lvl = 0.38; rad = 190; }   // running footsteps (walk past slowly = silent)
    if (!lvl || dx > rad) return 0;
    return lvl * (1 - (dx / rad) * 0.5);
  }
  function hushedWake(e) {
    if (e.awake) return;
    e.awake = true; e.alert = 1; e.calmT = 0; e.cd = Math.max(e.cd, 0.7); e.wakeT = 0;
    e.enc = e.encId;                                              // an awake citizen holds the encounter open
    G.SFX.play('c6_crack', 1); G.FX.shards(e.x, e.y - 70, 8, FROST, 260);
    barkOnce('c6_hushedWake', 200);
  }
  function hushedSleep(e) {
    e.awake = false; e.alert = 0; e.calmT = 0; e.enc = null; e.sleepT = 0;
    G.FX.ember(e.x, e.y - 60, 10, FROST, { w: 30, h: 90, up: 50 });
    barkOnce('c6_hushedSleep', 400);
  }
  TYPES.c6_hushed = {
    name: '沉睡的亡者', en: 'THE HUSHED', w: 36, h: 118, hp: 70, bal: 52, col: FROST, shards: 34, spawnT: 0.25, kbMul: 1, scale: HS,
    portrait: [2.4, 0.92],
    init(e) {
      e.encId = e.enc; e.enc = null; e.awake = false; e.alert = 0; e.calmT = 0;
      const r = U.mulberry32(Math.round(Math.abs(e.x) * 13 + 7));
      e.v = Math.floor(r() * 4); e.seed = r(); e.flipLater = r() < 0.35;
      e.t = r() * 10;
    },
    voice: () => G.SFX.play('c6_hushedVoice'),
    weapon: (e) => { const J = e.J; return J ? toW(e, lerpP(J.hdF, J.hdB, 0.5), HS) : { x: e.x + e.facing * 40, y: e.y - 80 }; },
    think(e, dt) {
      const T = TYPES.c6_hushed;
      if (e.flipLater) { e.flipLater = false; e.facing *= -1; }
      const n = noiseAt(e);
      if (!e.awake) {
        e.vx = U.approach(e.vx, 0, 900 * dt);
        e.alert = U.clamp(e.alert + (n > 0 ? n * 1.25 : -0.3) * dt, 0, 1);
        if (e.alert >= 1) hushedWake(e);
        return;
      }
      e.wakeT += dt;
      if (n > 0.3) e.calmT = 0; else e.calmT += dt;
      if (e.calmT > 4.2 && e.cd <= 0) { hushedSleep(e); return; }
      e.faceP(); const d = e.distP();
      // a lurching, stop-start walk
      const lurch = Math.max(0, Math.sin(e.t * 4.2)) * (0.6 + 0.4 * Math.sin(e.t * 9.7));
      e.vx = U.approach(e.vx, d > 70 ? e.facing * 120 * lurch * e.speedMul : 0, 900 * dt);
      if (e.cd <= 0 && d < 120 && e.wakeT > 0.6) e.startAtk(Math.random() < 0.58 ? T.grab : T.hammer);
    },
    onHit(e, h) {
      if (!e.awake) hushedWake(e);
      e.calmT = 0;
      if (e.hp <= 0 && !e.counted) {
        e.counted = true;
        const F = G.game.save.flags; F.c6_hushed_killed = (F.c6_hushed_killed || 0) + 1;
        barkOnce('c6_hushedKilled', 700);
      }
    },
    // two-handed grab: pulls back, then lunges with both arms (white)
    grab: {
      dur: 1.6, cd: 1.7,
      tells: [{ t: 0.32, c: 'white' }],
      poses: { dur: 1.6, keys: [[0, HP.idle(0, { awake: true })], [0.7, HP.pull], [0.88, HP.reach, 'snap'], [1.2, HP.reach], [1.6, HP.idle(0, { awake: true }), 'io']] },
      moves: [{ t0: 0.8, t1: 1.0, v: 250 }],
      hits: [{ t0: 0.86, t1: 1.0, box: { x: 0, y: -112, w: 66, h: 72 }, dmg: 18, kb: 200, last: true, pbal: 40 }],
      ev: [{ t: 0.86, fn: () => G.SFX.play('whoosh', 0.6) }],
    },
    // both fists overhead, a trembling hold, then down (white)
    hammer: {
      dur: 1.95, cd: 1.9,
      tells: [{ t: 0.38, c: 'white' }],
      poses: { dur: 1.95, keys: [[0, HP.idle(0, { awake: true })], [0.62, HP.raise], [1.0, HP.raise2], [1.14, HP.slam, 'snap'], [1.5, HP.slam], [1.95, HP.idle(0, { awake: true }), 'io']] },
      hits: [{ t0: 1.12, t1: 1.24, box: { x: 0, y: -128, w: 64, h: 128 }, dmg: 22, kb: 260, last: true }],
      ev: [{ t: 1.12, fn: (e) => { G.SFX.play('impact'); G.FX.dust(e.x + e.facing * 45, e.y, 8, { w: 30, speed: 160, size: 10 }); G.FX.shards(e.x + e.facing * 45, e.y - 6, 4, FROST, 260); } }],
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : vdt();
      const J = hPose(e, HP, dt, { walk: !!e.awake, stride: 11, gaitX: 0.8 });
      e.J = J;
      if (!ghost && dt > 0) {
        e.sleepT = (e.sleepT || 0) + dt;
        if (e.awake && Math.abs(e.vx) > 30 && Math.random() < 0.15) G.FX.ember(e.x, e.y - 40 - Math.random() * 60, 1, FROST, { w: 20, h: 10, up: 30 });
      }
      const spawnA = e.state === 'spawn' ? U.clamp(e.st / 0.25, 0, 1) : 1;
      ctx.save();
      ctx.globalAlpha *= spawnA;
      ctx.translate(e.x, e.y); ctx.scale(e.facing * HS, HS);
      // awake jitter (the stasis cracking)
      if (e.awake && e.state !== 'die' && !ghost) { const j = Math.sin(e.t * 31) * Math.max(0, Math.sin(e.t * 2.3)) * 0.8; ctx.translate(j, 0); }
      dissolve(ctx, e, -140, 10, ghost);
      drawHushed(ctx, e, J);
      ctx.restore();
      // the sound they hear: rings near the head as the alert rises
      if (!e.awake && e.alert > 0.05 && e.state !== 'die') {
        const hp = toW(e, J.head, HS), a = e.alert;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const ph = ((e.t * 1.6 + i / 3) % 1), r = 8 + ph * 26 * (0.5 + a);
          ctx.strokeStyle = U.rgba(a > 0.6 ? '#ff7a96' : '#dff6ff', (1 - ph) * a * 0.9); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(hp.x, hp.y, r, -PI * 0.85, -PI * 0.15); ctx.stroke();
        }
        ctx.restore();
      }
      dbg(ctx, e);
    },
  };
  function drawHushed(ctx, e, J) {
    const V = HV[e.v || 0], t = e.t, awake = !!e.awake, Q = torsoF(J);
    const skin = '#d6e2ea', skinS = '#9fb3c4';
    const frost = (x1, y1, x2, y2) => seg(ctx, x1, y1, x2, y2, 'rgba(240,252,255,0.8)', 1.1);
    // violin case slung on the back (musician) / long coat tail (commuter)
    if (V.key === 'musician') {
      ctx.save(); const c = Q(0.62, -11); ctx.translate(c[0], c[1]); ctx.rotate(-0.5 + (J.ha - (e.pose ? e.pose.head : 0)) * 0.3);
      blob(ctx, [[-5, -26], [4, -27], [6, -12], [4, -6], [7, 8], [5, 22], [-5, 22], [-7, 8], [-4, -6], [-6, -12]]); fillInk(ctx, lit(ctx, 0, 0, 7, V.accent), 1.1);
      ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, 20); ctx.stroke();
      ctx.restore();
    }
    // back leg / arm
    LC(ctx, [J.hip, lerpP(J.hip, J.kneeB, 0.5), J.kneeB, lerpP(J.kneeB, J.ankB, 0.5), J.ankB], [5.4, 4.8, 3.8, 3.4, 2.6], V.clothB);
    LB(ctx, J.ankB, J.toeB, 3.0, 2.2, '#2c2a33');
    LC(ctx, [J.shB, J.elB, J.hdB], [3.4, 2.9, 2.3], V.clothB);
    ctx.beginPath(); ctx.arc(J.hdB.x, J.hdB.y, 2.6, 0, TAU); fillInk(ctx, skinS, 0.8);
    if (V.key === 'gardener') {   // a pot of flowers, still held out to someone
      const h = J.hdB; pth(ctx, [[h.x - 6, h.y - 3], [h.x + 6, h.y - 3], [h.x + 4.5, h.y + 6], [h.x - 4.5, h.y + 6]]); fillInk(ctx, lit(ctx, h.x, h.y, 6, '#b8704a'), 1);
      for (const [dx, dy, c] of [[-3, -9, '#7fbf6a'], [0, -12, '#94d27c'], [3, -9, '#6aa85a']]) { ctx.beginPath(); ctx.ellipse(h.x + dx, h.y + dy + 4, 2.2, 4.5, dx * 0.15, 0, TAU); fillInk(ctx, c, 0.7); }
      for (const [dx, dy] of [[-3, -12], [2, -15], [4, -10]]) { ctx.beginPath(); ctx.arc(h.x + dx, h.y + dy, 2, 0, TAU); fillInk(ctx, V.accent, 0.6); }
    }
    // torso + clothing
    blob(ctx, [Q(-0.1, -8), Q(0.45, -8.5), Q(0.95, -10), Q(1.1, -5), Q(1.08, 5), Q(0.85, 9.5), Q(0.45, 8.5), Q(-0.05, 8.5)]);
    fillInk(ctx, lit(ctx, ...Q(0.5, 0), 11, V.cloth), 1.2);
    if (V.key === 'commuter') {     // long coat skirt + scarf
      blob(ctx, [Q(0.05, -9), Q(0.05, 9), Q(-0.65, 11), Q(-0.72, -2), Q(-0.6, -11)]); fillInk(ctx, lit(ctx, ...Q(-0.3, 0), 10, V.cloth), 1.1);
      ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.6; ctx.beginPath(); { const a = Q(0.85, 6), b = Q(-0.65, 7); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
      LB(ctx, P2(Q(1.02, -6)), P2(Q(1.04, 6)), 3.2, 3.0, '#8c3a46', { noHatch: true });
      const sc = Q(0.98, -7); LB(ctx, P2(sc), P2([sc[0] - 4, sc[1] + 16]), 2.4, 1.8, '#8c3a46', { noHatch: true });
    } else if (V.key === 'gardener') {   // apron + shirt sleeves
      blob(ctx, [Q(0.85, 3), Q(0.85, 10), Q(-0.4, 11.5), Q(-0.45, 3)]); fillInk(ctx, lit(ctx, ...Q(0.3, 7), 6, '#d8cfb4'), 1);
      const pk = Q(0.15, 8); ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 0.7; ctx.strokeRect(pk[0] - 3, pk[1] - 2, 6, 5);
    } else if (V.key === 'elder') {      // shawl draped over the shoulders + long skirt
      blob(ctx, [Q(0.05, -8.5), Q(0.05, 8.5), Q(-0.85, 10), Q(-0.9, -6)]); fillInk(ctx, lit(ctx, ...Q(-0.4, 2), 10, '#5d4a62'), 1.1);
      blob(ctx, [Q(1.12, -9), Q(1.12, 7), Q(0.6, 11), Q(0.42, 2), Q(0.55, -12)]); fillInk(ctx, lit(ctx, ...Q(0.85, 0), 10, V.accent), 1.1);
      ctx.strokeStyle = 'rgba(11,6,18,0.45)'; ctx.lineWidth = 0.6; ctx.beginPath(); for (const f of [-5, 0, 5]) { const a = Q(0.6, f), b = Q(0.48, f + 1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1] + 3); } ctx.stroke();
    } else {                              // musician: tailcoat tails + white shirt front + bow tie
      blob(ctx, [Q(0.15, -9), Q(0.05, -2), Q(-0.75, -6), Q(-0.8, -11)]); fillInk(ctx, lit(ctx, ...Q(-0.3, -8), 6, V.cloth), 1);
      blob(ctx, [Q(0.98, 2), Q(1.05, 7), Q(0.4, 8.5), Q(0.35, 4)]); fillInk(ctx, '#e9e6e0', 0.9);
      const bt = Q(1.02, 6); pth(ctx, [[bt[0] - 3, bt[1] - 2], [bt[0] + 3, bt[1] + 2], [bt[0] + 3, bt[1] - 2], [bt[0] - 3, bt[1] + 2]]); fillInk(ctx, '#1d1c26', 0.6);
    }
    // the Hush growing through them: crimson crystals out of the back + veins
    const cb = Q(0.85, -9);
    crystalCluster(ctx, cb[0], cb[1], -2.4 + (e.seed - 0.5) * 0.6, 0.75 + e.seed * 0.3, awake ? 0.75 : 0.32 + 0.12 * Math.sin(t * 2), CRIM, '#ffc2d0', t);
    ctx.strokeStyle = U.rgba(CRIM, awake ? 0.85 : 0.5); ctx.lineWidth = 0.7; ctx.beginPath();
    { const a = Q(0.8, -7), b = Q(0.55, -2), c = Q(0.35, -6), d2 = Q(0.6, 3); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.moveTo(b[0], b[1]); ctx.lineTo(d2[0], d2[1]); } ctx.stroke();
    // front leg (trousers / skirt hem) + shoe
    LC(ctx, [J.hip, lerpP(J.hip, J.kneeF, 0.5), J.kneeF, lerpP(J.kneeF, J.ankF, 0.5), J.ankF], [5.8, 5.2, 4.0, 3.6, 2.8], V.key === 'gardener' ? '#6b6250' : V.clothB, { spec: 0.2 });
    LB(ctx, J.ankF, J.toeF, 3.3, 2.4, '#2c2a33');
    // head: porcelain-frost skin, closed eyes (open + glowing when awake), hair per citizen
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    blob(ctx, [[-1, -9], [5, -8.5], [8, -3.5], [9.4, 0.5], [8, 2.5], [8.4, 5], [5.5, 8.5], [0, 8], [-3, 3]]); fillInk(ctx, lit(ctx, 3, 0, 9, skin), 1.1);
    ctx.fillStyle = skinS; pth(ctx, [[-1, -6], [2.5, -4], [3.2, 4], [6.5, 6.5], [5.5, 8.5], [0, 8], [-3, 3]]); ctx.fill();
    if (awake) {
      lighter(ctx, () => { ctx.fillStyle = U.rgba('#ff7a96', 0.95); ctx.fillRect(5.2, -1.6, 3.2, 1.4); glow(ctx, 7, -1, 7, CRIM, 0.6); });
    } else { ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(6.6, -1.8, 1.8, 0.3, PI - 0.3); ctx.stroke(); }
    ctx.strokeStyle = U.rgba(CRIM, 0.7); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(2, 2); ctx.lineTo(4, 5); ctx.lineTo(3.5, 7.5); ctx.stroke();  // vein on the cheek
    // hair / hats
    const hair = V.hair;
    if (V.key === 'gardener') {
      ctx.beginPath(); ctx.ellipse(1, -8, 15, 3.2, -0.08, 0, TAU); fillInk(ctx, lit(ctx, 1, -8, 15, hair), 1.1);   // brim
      blob(ctx, [[-6, -8], [-5, -15], [3, -16.5], [7, -9]]); fillInk(ctx, lit(ctx, 0, -12, 7, hair), 1);
      LB(ctx, { x: -5.5, y: -10 }, { x: 6.5, y: -10.5 }, 1.4, 1.4, '#7d9a62', { noHatch: true });
    } else if (V.key === 'elder') {
      blob(ctx, [[-4, -9.5], [3, -11], [8, -6], [3, -6], [-1, -2], [-4, 3]]); fillInk(ctx, lit(ctx, 0, -6, 8, hair), 1);
      ctx.beginPath(); ctx.arc(-6, -9, 4.4, 0, TAU); fillInk(ctx, lit(ctx, -6, -9, 4.4, hair), 1);   // bun
    } else if (V.key === 'musician') {
      blob(ctx, [[-4, -8], [2, -11], [8.5, -7.5], [4, -6.5], [0, -4], [-3.5, 2]]); fillInk(ctx, lit(ctx, 0, -6, 8, hair), 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-1, -9); ctx.quadraticCurveTo(3, -10.5, 7, -8); ctx.stroke();
    } else {
      blob(ctx, [[-4.5, -7], [0, -11], [7, -10], [8.5, -6], [4, -6], [1, -3.5], [-3, 3]]); fillInk(ctx, lit(ctx, 0, -6, 8, hair), 1);
    }
    frost(-1, -10.5, 4, -11.5);
    ctx.restore();
    // front arm (+ held objects)
    LC(ctx, [J.sh, lerpP(J.sh, J.elF, 0.5), J.elF, J.hdF], [3.8, 3.5, 3.0, 2.4], V.key === 'gardener' ? '#e6dcc4' : V.cloth, { spec: 0.2 });
    ctx.beginPath(); ctx.arc(J.hdF.x, J.hdF.y, 2.8, 0, TAU); fillInk(ctx, skin, 0.9);
    if (!awake || e.state === 'die') {
      if (V.key === 'commuter') {   // briefcase
        const h = J.hdF; pth(ctx, [[h.x - 9, h.y + 3], [h.x + 7, h.y + 3], [h.x + 7, h.y + 15], [h.x - 9, h.y + 15]]); fillInk(ctx, lit(ctx, h.x, h.y + 9, 9, '#6b4a34'), 1);
        ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(h.x - 1, h.y + 3, 3, PI, 0); ctx.stroke();
        ctx.fillStyle = V.accent; ctx.fillRect(h.x - 2, h.y + 7, 3, 2);
      } else if (V.key === 'elder') {   // cane to the floor
        const h = J.hdF; LB(ctx, { x: h.x + 1, y: h.y - 2 }, { x: h.x + 7, y: 0 }, 1.4, 1.2, '#6a4a32', { noHatch: true });
      }
    }
    // frost caps on the upper surfaces (the stasis rime)
    { const s1 = Q(1.05, -6), s2 = Q(0.9, 4); frost(s1[0], s1[1] - 1, s2[0], s2[1] - 1); }
    if (!awake) lighter(ctx, () => glow(ctx, J.chest.x, J.chest.y + 6, 30, FROST, 0.08 + (e.alert || 0) * 0.15));
    tellGlow(ctx, (J.hdF.x + J.hdB.x) / 2, (J.hdF.y + J.hdB.y) / 2, e, 20);
    hitFlash(ctx, e, () => { ctx.beginPath(); ctx.ellipse(J.hip.x, J.hip.y - 20, 15, 50, 0, 0, TAU); ctx.fill(); });
  }

  /* =====================================================================================
     調律機 TUNING ENGINE — a ceiling crane shaped like a violin's pegbox; sweeps the floor with a beam
     ===================================================================================== */
  const TS = 1.3;
  function tunerEmit(e) {   // world position of the fork's emitter (between the prong tips)
    const a = e.forkA || 0, s = TS, lx = -6 + Math.sin(a) * 58, ly = -34 + Math.cos(a) * 58;
    return { x: e.x + e.facing * lx * s, y: e.y + ly * s };
  }
  const floorAt = (x, y) => { const g = G.Phys.groundBelow(x, y); return g > 1e8 ? y + 260 : g; };
  function hoverTo(e, drop, dt, k = 4) { const ty = (e.homeY ?? e.y) + drop + Math.sin(e.t * 1.3) * 6; e.vy = (ty - e.y) * k; }
  TYPES.c6_tuner = {
    name: '調律者', en: 'THE TUNER', w: 84, h: 94, hp: 115, bal: 80, col: AMBER, shards: 56, fly: true, hover: true, spawnT: 0.9, kbMul: 0.25, scale: TS,
    portrait: [2.2, 0.72],
    init(e) { e.forkA = 0; e.pend = 0; e.pendV = 0; e.beam = null; e.drop = 0; },
    voice: () => G.SFX.play('c6_tune'),
    weapon: (e) => tunerEmit(e),
    think(e, dt) {
      const T = TYPES.c6_tuner;
      e.faceP(); const d = e.distP(), P = e.P;
      const want = d < 150 ? -1 : d > 320 ? 1 : 0;
      e.vx = U.approach(e.vx, want * e.facing * 120 * e.speedMul, 320 * dt);
      hoverTo(e, 0, dt);
      e.forkA = U.damp(e.forkA, 0, 6, dt);
      if (e.cd <= 0) {
        const under = d < 95 && P.y > e.y + 40;
        if (under) e.startAtk(T.slam);
        else if (d < 650) e.startAtk(Math.random() < 0.55 ? T.sweep : T.pulse);
      }
    },
    atkUpdate(e, dt) {
      const T = TYPES.c6_tuner, a = e.atk, st = e.st, P = e.P;
      e.vx = U.approach(e.vx, 0, 500 * dt);
      if (a === T.sweep) {
        if (st < 1.0 && e.bx0 != null) { hoverTo(e, -10, dt); const em = tunerEmit(e); e.forkA = U.damp(e.forkA, Math.atan2((e.bx0 - em.x) * e.facing, e.bfy - em.y) * 0.9, 5, dt); }
        if (e.beam) {
          const k = U.clamp((st - 1.0) / 0.95, 0, 1), em = tunerEmit(e);
          e.beam.x = U.lerp(e.bx0, e.bx1, U.easeInOutSine(k));
          e.forkA = Math.atan2((e.beam.x - em.x) * e.facing, e.beam.y - em.y) * 0.9;
          // the beam is a segment emitter → floor point: test the player's body against it
          if (!e.beam.hit) {
            const hb = P.hurtbox, n = 16;
            for (let i = 0; i <= n; i++) {
              const x = U.lerp(em.x, e.beam.x, i / n), y = U.lerp(em.y, e.beam.y, i / n);
              if (x > hb.x - 9 && x < hb.x + hb.w + 9 && y > hb.y && y < hb.y + hb.h) {
                const r = P.receiveHit(e, { dmg: 26, unblockable: true, kb: 300, hx: x, hy: y });
                if (r !== 'ignored') e.beam.hit = true;
                break;
              }
            }
          }
          if (Math.random() < 0.6) G.FX.spark(e.beam.x, e.beam.y - 2, 2, { col: '#ffd0da', speed: 380, dir: -PI / 2, spread: 2.4, life: 0.3 });
          G.game.shake(0.04);
        }
        if (st > 1.95) { e.drop = U.damp(e.drop, st < 3.05 ? 118 : 0, 5, dt); hoverTo(e, e.drop, dt, 5); if (Math.random() < 0.3) G.FX.dust(e.x - e.facing * 30, e.y - 70, 1, { size: 10, speed: 40, col: 'rgba(230,240,255,' }); }
      } else if (a === T.slam) {
        const fl = floorAt(e.x, e.y);
        if (st < 0.7) { hoverTo(e, -26, dt); e.vx = U.clamp((P.x - e.x) * 3, -200, 200); }
        else if (st < 1.9) {
          const low = fl - 58;
          if (e.y < low) e.vy = 1300; else { e.y = low; e.vy = 0; if (!e.slammed) { e.slammed = true; G.SFX.play('quake'); G.game.shake(0.45); G.FX.dust(e.x, fl, 16, { w: 70, speed: 260, size: 14 }); G.FX.shards(e.x, fl - 4, 8, AMBER, 380); } }
        } else { e.slammed = false; hoverTo(e, 0, dt, 2.5); }
      } else { hoverTo(e, 0, dt); e.forkA = U.damp(e.forkA, Math.atan2((P.x - e.x) * e.facing, P.y - 60 - e.y) * 0.5, 6, dt); }
    },
    // the floor sweep (red): a sight line marks the path, then a beam rakes it — roll through
    sweep: {
      dur: 3.3, cd: 1.7, track: false,
      tells: [{ t: 0.3, c: 'red' }],
      ev: [
        { t: 0.0, fn: (e) => { const P = e.P; e.bx0 = e.x + e.facing * 34; e.bx1 = P.x + e.facing * 250; e.bfy = floorAt(P.x, P.y - 40); e.beam = null; e.drop = 0; } },
        { t: 0.3, fn: (e) => { const P = e.P; e.bx1 = P.x + e.facing * 250; e.bfy = floorAt(P.x, P.y - 40); } },
        { t: 1.0, fn: (e) => { e.beam = { x: e.bx0, y: e.bfy, hit: false }; G.SFX.play('c6_beam'); } },
        { t: 1.95, fn: (e) => { e.beam = null; G.SFX.play('c6_steam'); } },
      ],
    },
    // three tuning pulses (white — a perfect guard sends them home)
    pulse: {
      dur: 2.0, cd: 1.5,
      tells: [{ t: 0.3, c: 'white' }],
      ev: [0.8, 1.1, 1.4].map((t) => ({ t, fn: (e) => {
        const w = tunerEmit(e); K.fireOrb(e, w.x, w.y, 390);
        const arr = G.game.projectiles, p = arr[arr.length - 1]; if (p && p.owner === e) { p.dmg = 17; p.col = AMBER; }
        G.SFX.play('c6_ping'); e.recoil = 1;
      } })),
    },
    // standing beneath it is not safe: the fork slams down (white)
    slam: {
      dur: 2.4, cd: 1.5, track: false,
      tells: [{ t: 0.22, c: 'white' }],
      hits: [{ t0: 0.72, t1: 0.95, box: { x: -46, y: -36, w: 92, h: 94 }, dmg: 20, kb: 320, last: true, pbal: 45 }],
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : vdt(), T = TYPES.c6_tuner;
      const charging = e.state === 'atk' && ((e.atk === T.sweep && e.st < 1.0) || (e.atk === T.pulse && e.st < 1.45));
      if (!ghost) {
        // metronome pendulum: ticks faster while charging, stops while recalibrating / broken
        const still = e.state === 'broken' || (e.atk === T.sweep && e.st > 1.95);
        const rate = charging ? 9 : still ? 0 : 3.2;
        e.pend += dt * rate; e.recoil = Math.max(0, (e.recoil || 0) - dt * 6);
        if (e.state === 'broken' && dt > 0) { const fl = floorAt(e.x, e.y); e.vy = ((fl - 70) - e.y) * 2; }
        if (e.state === 'hurt' && dt > 0) e.forkA = U.damp(e.forkA, 0.4, 8, dt);
      }
      const spawnK = e.state === 'spawn' ? 1 - U.clamp(e.st / 0.9, 0, 1) : 0;
      // the beam and its sight line live in world space
      if (!ghost) drawTunerBeam(ctx, e);
      ctx.save();
      ctx.translate(e.x, e.y - spawnK * 160); ctx.scale(e.facing * TS, TS);
      ctx.globalAlpha *= 1 - spawnK;
      const sway = U.clamp(-e.vx * 0.0012, -0.12, 0.12) + Math.sin(e.t * 1.1) * 0.02 + (e.hitK || 0) * 0.15;
      dissolve(ctx, e, -800, 70, ghost);
      drawTuner(ctx, e, sway, charging);
      ctx.restore();
      dbg(ctx, e);
    },
  };
  function drawTunerBeam(ctx, e) {
    const T = TYPES.c6_tuner;
    if (e.state !== 'atk' || e.atk !== T.sweep) return;
    const st = e.st, em = tunerEmit(e);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (st < 1.0 && e.bx0 != null) {
      // sight: a dashed crimson path on the floor + a thin aiming line, pulsing faster as it nears firing
      const k = st / 1.0, pulse = 0.5 + 0.5 * Math.sin(st * (10 + k * 30));
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -st * 60 * e.facing;
      ctx.strokeStyle = U.rgba(CRIM, 0.35 + 0.45 * pulse * k); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e.bx0, e.bfy - 2); ctx.lineTo(e.bx1, e.bfy - 2); ctx.stroke();
      ctx.setLineDash([]);
      const ax = e.bx1, ay = e.bfy - 2, f = e.facing;
      ctx.fillStyle = U.rgba(CRIM, 0.6 * k); ctx.beginPath(); ctx.moveTo(ax + f * 12, ay); ctx.lineTo(ax - f * 4, ay - 7); ctx.lineTo(ax - f * 4, ay + 7); ctx.fill();
      ctx.strokeStyle = U.rgba(CRIM, 0.25 + 0.4 * k); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(em.x, em.y); ctx.lineTo(e.bx0, e.bfy); ctx.stroke();
      glow(ctx, em.x, em.y, 14 + k * 16, CRIM, 0.3 + 0.5 * k);
    }
    if (e.beam) {
      const b = e.beam, flick = 0.85 + Math.random() * 0.15;
      ctx.strokeStyle = U.rgba(CRIM, 0.35 * flick); ctx.lineWidth = 22; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(em.x, em.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = U.rgba('#ff7a96', 0.7 * flick); ctx.lineWidth = 9; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,245,248,0.95)'; ctx.lineWidth = 3; ctx.stroke();
      glow(ctx, b.x, b.y - 4, 46, CRIM, 0.6); glow(ctx, em.x, em.y, 26, '#ffd0da', 0.7);
      // scorched trail along the floor
      ctx.strokeStyle = U.rgba(CRIM, 0.4); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(e.bx0, b.y - 1); ctx.lineTo(b.x, b.y - 1); ctx.stroke();
    }
    ctx.restore();
  }
  const TC = { enamel: '#e9ebe6', enamelB: '#b0b6ba', brass: '#d1a44a', brassD: '#8a6a2c', steel: '#8f9aa6', dark: '#252a36' };
  function drawTuner(ctx, e, sway, charging) {
    const t = e.t, T = TYPES.c6_tuner, broken = e.state === 'broken';
    const recal = e.state === 'atk' && e.atk === T.sweep && e.st > 1.95;
    const sweepCol = e.atk === T.sweep && e.state === 'atk';
    // ---- the crane: a ceiling rail column, a hinge, and a short link down to the head ----
    const hinge = { x: 4, y: -150 };
    ctx.save();
    const cg = ctx.createLinearGradient(0, hinge.y, 0, hinge.y - 640); cg.addColorStop(0, '#a3adb6'); cg.addColorStop(0.45, 'rgba(70,78,92,0.95)'); cg.addColorStop(1, 'rgba(40,44,56,0)');
    ctx.fillStyle = cg; ctx.fillRect(-3, hinge.y - 640, 14, 640);
    ctx.strokeStyle = 'rgba(11,6,18,0.85)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-3, hinge.y); ctx.lineTo(-3, hinge.y - 440); ctx.moveTo(11, hinge.y); ctx.lineTo(11, hinge.y - 440); ctx.stroke();
    for (let y = hinge.y - 24; y > hinge.y - 440; y -= 64) { pth(ctx, [[-6, y], [14, y], [14, y - 8], [-6, y - 8]]); fillInk(ctx, '#7c8692', 1); ctx.fillStyle = '#c9a24e'; ctx.fillRect(-4, y - 5, 2, 2); ctx.fillRect(10, y - 5, 2, 2); }
    // hydraulic hose looping down to the head
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(14, hinge.y - 200); ctx.bezierCurveTo(38, hinge.y - 120, 34 + sway * 40, hinge.y - 30, 14, -82); ctx.stroke();
    ctx.strokeStyle = '#4a2e36'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.restore();
    // link (two struts + piston) from the hinge to the head's collar
    const collar = { x: 2, y: -86 };
    ctx.save(); ctx.translate(hinge.x, hinge.y); ctx.rotate(sway); ctx.translate(-hinge.x, -hinge.y);
    const hingeL = hinge;
    LB(ctx, { x: hingeL.x - 5, y: hingeL.y }, { x: collar.x - 5, y: collar.y }, 2.8, 2.8, '#7d8894', { spec: 0.3 });
    LB(ctx, { x: hingeL.x + 6, y: hingeL.y }, { x: collar.x + 6, y: collar.y }, 2.8, 2.8, '#6a7480', { spec: 0.2 });
    LB(ctx, { x: hingeL.x + 0.5, y: hingeL.y + 14 }, { x: collar.x + 0.5, y: collar.y - 12 }, 4.2, 4.2, '#c7cfd6', { spec: 0.5 });
    ctx.beginPath(); ctx.arc(hingeL.x + 0.5, hingeL.y, 7, 0, TAU); fillInk(ctx, lit(ctx, hingeL.x, hingeL.y, 7, TC.steel), 1.2);
    ctx.fillStyle = TC.brass; ctx.beginPath(); ctx.arc(hingeL.x + 0.5, hingeL.y, 2.4, 0, TAU); ctx.fill();
    pth(ctx, [[-10, -96], [14, -96], [16, -82], [-12, -82]]); fillInk(ctx, lit(ctx, 2, -89, 12, TC.steel), 1.2);   // collar
    // ---- tuning dial on top: a needle swinging over a scale with a red zone ----
    ctx.save(); ctx.translate(-20, -74);
    ctx.beginPath(); ctx.arc(0, 0, 18, PI, TAU); ctx.closePath(); fillInk(ctx, '#1a1a22', 1.3);
    ctx.strokeStyle = TC.brass; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, 18, PI, TAU); ctx.stroke(); inkS(ctx, 0.6);
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) { const a = PI + i * PI / 8; ctx.strokeStyle = i >= 6 ? '#ff5d7e' : '#e9e1c8'; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 13, Math.sin(a) * 13); ctx.lineTo(Math.cos(a) * (i % 2 ? 15.5 : 16.5), Math.sin(a) * (i % 2 ? 15.5 : 16.5)); ctx.stroke(); }
    const na = -PI / 2 + (charging && sweepCol ? 0.95 + Math.sin(t * 40) * 0.08 : Math.sin(e.pend) * 0.7) * (broken ? 0.2 : 1);
    lighter(ctx, () => { seg(ctx, 0, 0, Math.cos(na) * 14, Math.sin(na) * 14, charging && sweepCol ? '#ff8aa0' : '#ffe6a8', 1.4); });
    ctx.fillStyle = TC.brass; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill(); inkS(ctx, 0.6);
    ctx.restore();
    // ---- the head: a long enamel pegbox tapering back, brass-edged, strings in its throat ----
    const body = [[-50, -64], [-36, -73], [-6, -77], [18, -74], [30, -66], [30, -44], [16, -38], [-8, -36], [-36, -40], [-50, -48]];
    blob(ctx, body); fillInk(ctx, lit(ctx, -8, -58, 28, TC.enamel), 1.6);
    blob(ctx, [[-50, -55], [-36, -45], [-8, -40], [16, -42], [30, -50], [30, -44], [16, -38], [-8, -36], [-36, -40], [-50, -48]]); ctx.fillStyle = 'rgba(42,14,60,0.22)'; ctx.fill();   // belly shadow
    ctx.strokeStyle = TC.brassD; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-48, -64); ctx.quadraticCurveTo(-10, -80, 26, -68); ctx.stroke();
    ctx.strokeStyle = TC.brass; ctx.lineWidth = 1.1; ctx.stroke();
    blob(ctx, [[-38, -63], [10, -67], [16, -54], [-36, -49]]); fillInk(ctx, '#17161f', 1.1);
    const shiv = charging ? 1.4 : recal ? 0 : 0.25;
    for (let i = 0; i < 4; i++) {
      const y0 = -62 + i * 3.6, w = Math.sin(t * 60 + i * 2) * shiv;
      ctx.strokeStyle = i % 2 ? '#f0dca0' : '#d6dee4'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-36, y0 + 2); ctx.quadraticCurveTo(-12, y0 + w, 13, y0 - 2); ctx.stroke();
    }
    if (charging) lighter(ctx, () => glow(ctx, -12, -57, 26, sweepCol ? CRIM : AMBER, 0.35));
    // violin pegs: figure-eight heads, turning
    const pegs = [[-34, -72, -1], [-16, -76, -1], [-28, -40, 1], [-10, -37, 1]];
    pegs.forEach(([x, y, s2], i) => {
      const turn = Math.abs(Math.cos(t * (charging ? 7 : 1.1) + i * 1.3));
      LB(ctx, { x, y }, { x: x - 1, y: y + s2 * 9 }, 2.4, 2, TC.dark, { noHatch: true });
      const hx = x - 2, hy = y + s2 * 14, w = 2 + 5.5 * turn;
      ctx.beginPath(); ctx.ellipse(hx - w * 0.45, hy, w * 0.55, 4.2, 0, 0, TAU); ctx.ellipse(hx + w * 0.45, hy, w * 0.55, 4.2, 0, 0, TAU);
      fillInk(ctx, lit(ctx, hx, hy, 6, TC.brass), 1);
    });
    // the scroll: a real spiral, its eye is the lens
    ctx.save(); ctx.translate(36, -56);
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); fillInk(ctx, lit(ctx, 0, 0, 19, TC.enamel), 1.6);
    ctx.beginPath(); for (let a = 0; a < TAU * 2.1; a += 0.15) { const r = 17.5 - a * 1.25; const x = Math.cos(a + 0.6) * r, y = Math.sin(a + 0.6) * r; a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke(); ctx.strokeStyle = TC.brass; ctx.lineWidth = 1.4; ctx.stroke();
    const eyeCol = broken ? '#8a8a8a' : charging && sweepCol ? CRIM : AMBER, iris = charging ? 2.2 : 3.8;
    ctx.beginPath(); ctx.arc(0, 0, 6.8, 0, TAU); fillInk(ctx, '#120d16', 1.2);
    lighter(ctx, () => {
      glow(ctx, 0, 0, 18 + (charging ? 10 : 0), eyeCol, broken ? 0.15 : 0.7);
      ctx.fillStyle = U.rgba(eyeCol, 0.95); ctx.beginPath(); ctx.ellipse(1, 0, iris * 0.7, iris, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(1.8, -1.6, 1.1, 0, TAU); ctx.fill();
    });
    ctx.restore();
    // crimson Hush crust creeping over the back of the head + a warning lamp
    crystalCluster(ctx, -42, -66, -2.1, 0.8, 0.35, CRIM, '#ffc2d0', t);
    crystalCluster(ctx, -30, -40, 1.9, 0.55, 0.2, CRIM, '#ffc2d0', t + 1);
    const lampOn = (Math.sin(t * (charging ? 16 : 3)) > 0) && !broken;
    ctx.beginPath(); ctx.arc(20, -76, 3.2, 0, TAU); fillInk(ctx, lampOn ? '#ffd27a' : '#6a5a3a', 0.9);
    if (lampOn) lighter(ctx, () => glow(ctx, 20, -76, 10, AMBER, 0.6));
    // ---- the tuning fork (the emitter), aimed by forkA ----
    ctx.save(); ctx.translate(-6, -34); ctx.rotate(-(e.forkA || 0));
    const vib = charging ? Math.sin(t * 80) * 1 : 0, rc = e.recoil || 0;
    LB(ctx, { x: 0, y: -4 }, { x: 0, y: 16 }, 4, 3.2, TC.steel, { spec: 0.4 });
    ctx.beginPath(); ctx.ellipse(0, 3, 6.5, 3, 0, 0, TAU); fillInk(ctx, TC.brass, 1);
    ctx.beginPath(); ctx.moveTo(-9 - vib, 58 - rc * 5); ctx.lineTo(-9 - vib, 26); ctx.quadraticCurveTo(-9, 14, 0, 14); ctx.quadraticCurveTo(9, 14, 9 + vib, 26); ctx.lineTo(9 + vib, 58 - rc * 5);
    ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 7.6; ctx.stroke();
    ctx.strokeStyle = '#c3ccd4'; ctx.lineWidth = 4.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-8, 54); ctx.lineTo(-8, 27); ctx.moveTo(10, 54); ctx.lineTo(10, 27); ctx.stroke();
    // resonance rings around the prongs while charging
    const ec = sweepCol ? CRIM : AMBER;
    lighter(ctx, () => {
      glow(ctx, 0, 58, 13 + (charging ? 12 : 0), ec, charging ? 0.95 : 0.35);
      if (charging) for (let i = 0; i < 3; i++) { const ph = (t * 2.5 + i / 3) % 1; ctx.strokeStyle = U.rgba(ec, (1 - ph) * 0.8); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, 40 + ph * 18, 13 + ph * 8, 3.5 + ph * 2, 0, 0, TAU); ctx.stroke(); }
    });
    if (e.tellT > 0) tellGlow(ctx, 0, 58, e, 28);
    ctx.restore();
    if (recal || broken) lighter(ctx, () => glow(ctx, -46, -58, 24, '#dff6ff', 0.25 + Math.sin(t * 20) * 0.1));
    ctx.restore();
    hitFlash(ctx, e, () => { ctx.beginPath(); ctx.ellipse(-4, -56, 50, 24, 0, 0, TAU); ctx.fill(); });
  }

  /* =====================================================================================
     寂翼 HUSH SERAPH — the atrium's angel statue; wings of blade-feathers
     ===================================================================================== */
  const SS = 1.26;
  function seraphWingPose(e) {
    const T = TYPES.c6_seraph, st = e.st, flap = Math.sin(e.t * 3.1);
    let a1 = -1.85 + flap * 0.16, a2 = -2.6 + flap * 0.3, fan = 1, cut = 0;
    if (e.state === 'atk') {
      if (e.atk === T.dive) {
        const k = U.clamp(st / 0.7, 0, 1);
        if (st < 0.75) { a1 = U.lerp(a1, -1.5, k); a2 = U.lerp(a2, -2.1, k); fan = 1 + k * 0.3; }
        else if (!e.landed) { a1 = -2.6; a2 = 2.9; fan = 0.45; }          // folded back like a thrown blade
        else { a1 = -2.2; a2 = 2.6; fan = 0.8; }
      } else if (e.atk === T.volley) {
        const k = U.clamp(st / 0.75, 0, 1);
        a1 = U.lerp(a1, -1.25, k); a2 = U.lerp(a2, -2.0, k); fan = 1 + k * 0.45;
        if (st > 0.78 && st < 1.5) cut = 1;
      } else if (e.atk === T.wing) {
        if (st < 0.62) { const k = st / 0.62; a1 = U.lerp(a1, -2.4, k); a2 = U.lerp(a2, 3.0, k); fan = 0.7; }
        else { const k = U.clamp((st - 0.62) / 0.14, 0, 1); a1 = U.lerp(-2.4, -0.55, U.easeOutCubic(k)); a2 = U.lerp(3.0, 0.15, U.easeOutCubic(k)); fan = 0.65; }
      }
    } else if (e.state === 'broken') { a1 = -2.9; a2 = 2.2; fan = 0.6; }
    else if (e.state === 'hurt') { a1 = -2.3; a2 = -3.1; fan = 1.3; }
    return { a1, a2, fan, cut };
  }
  function shootFeather(e, x, y, ang, spd) {
    G.game.hazards.push({ c6: 'feather', x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, owner: e, t: 0, life: 3.2, friendly: false, update: featherUpd, draw: featherDraw });
    G.SFX.play('c6_feather');
  }
  function featherUpd(h, dt, g) {
    const P = g.player;
    if (h.friendly) {
      const o = h.owner;
      if (!o || o.dead) { h.done = true; return; }
      const a = Math.atan2(o.cy - h.y, o.cx - h.x), sp = Math.hypot(h.vx, h.vy);
      h.vx = U.lerp(h.vx, Math.cos(a) * sp, 0.15); h.vy = U.lerp(h.vy, Math.sin(a) * sp, 0.15);
    }
    h.x += h.vx * dt; h.y += h.vy * dt;
    for (const s of G.Phys.allSolids()) if (h.x > s.x && h.x < s.x + s.w && h.y > s.y && h.y < s.y + s.h) { h.done = true; G.FX.spark(h.x, h.y, 8, { col: '#ffc2d0', speed: 300 }); return; }
    if (!h.friendly && !h.passed) {
      const hb = P.hurtbox;
      if (h.x > hb.x - 7 && h.x < hb.x + hb.w + 7 && h.y > hb.y - 7 && h.y < hb.y + hb.h + 7) {
        const r = P.receiveHit(h.owner, { dmg: 16, kb: 150, projectile: true, hx: h.x, hy: h.y });
        if (r === 'parried') { h.friendly = true; h.vx = -h.vx * 1.4; h.vy = -h.vy * 0.4 - 90; h.life = h.t + 2.5; G.FX.ring(h.x, h.y, 6, 50, 0.3, '#7ff4ff', 4); }
        else if (r === 'dodged') h.passed = true;
        else if (r !== 'ignored') { h.done = true; G.FX.spark(h.x, h.y, 8, { col: '#ffc2d0', speed: 300 }); }
      }
    } else if (h.friendly) {
      for (const e of g.enemies) {
        if (e.dead) continue; const b = e.box;
        if (h.x > b.x - 8 && h.x < b.x + b.w + 8 && h.y > b.y - 8 && h.y < b.y + b.h + 8) {
          e.takeHit({ dmg: 26 * P.dmgMul, bal: 40, hx: h.x, hy: h.y, big: true }); g.hitstop(0.07); g.shake(0.35); G.SFX.play('hit', 1.2);
          h.done = true; break;
        }
      }
    }
  }
  function featherDraw(ctx, h) {
    const a = Math.atan2(h.vy, h.vx), col = h.friendly ? '#7ff4ff' : ROSE;
    ctx.translate(h.x, h.y); ctx.rotate(a);
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, -8, 0, 22, col, 0.45);
    ctx.strokeStyle = U.rgba(col, 0.35); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-12, 0); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    pth(ctx, [[14, 0], [-4, -4.2], [-20, -1.2], [-22, 0], [-20, 1.2], [-4, 3.2]]); fillInk(ctx, '#f3ece2', 1.2);
    pth(ctx, [[14, 0], [-4, -4.2], [-20, -1.2], [-6, -0.6]]); ctx.fillStyle = h.friendly ? '#9ff6ff' : '#ff3d6e'; ctx.fill();
  }
  TYPES.c6_seraph = {
    name: '寂翼', en: 'HUSH SERAPH', w: 56, h: 120, hp: 100, bal: 70, col: ROSE, shards: 62, fly: true, hover: true, spawnT: 0.9, kbMul: 0.6, scale: SS,
    portrait: [2.0, 0.7],
    init(e) { e.tail = new Rig.Chain(7, 9, 0.08, 0.9); e.tail2 = new Rig.Chain(6, 8, 0.06, 0.9); e.landed = false; e.diveRot = 0; },
    voice: () => G.SFX.play('c6_seraphVoice'),
    weapon: (e) => ({ x: e.x + e.facing * 30, y: e.y - 90 }),
    think(e, dt) {
      const T = TYPES.c6_seraph;
      e.faceP(); const d = e.distP(), P = e.P;
      const want = d < 200 ? -1 : d > 380 ? 1 : 0;
      e.vx = U.approach(e.vx, want * e.facing * 150 * e.speedMul, 380 * dt);
      hoverTo(e, 0, dt, 3);
      e.diveRot = U.damp(e.diveRot, 0, 6, dt); e.landed = false;
      if (e.cd <= 0) {
        if (d < 140) e.startAtk(T.wing);
        else if (d < 620) e.startAtk(Math.random() < 0.5 ? T.dive : T.volley);
      }
    },
    atkUpdate(e, dt) {
      const T = TYPES.c6_seraph, a = e.atk, st = e.st, P = e.P;
      if (a === T.dive) {
        const fl = floorAt(e.x, e.y);
        if (st < 0.72) { e.vx = U.approach(e.vx, -e.facing * 140, 600 * dt); e.vy = ((e.homeY ?? e.y) - 70 - e.y) * 4; }
        else if (!e.landed) {
          e.vx = e.dvx; e.vy = e.dvy;
          e.diveRot = Math.atan2(e.dvy, Math.abs(e.dvx));
          if (Math.random() < 0.8) G.FX.ember(e.x, e.y - 50, 2, ROSE, { w: 20, h: 30, up: 10 });
          if (e.onGround || e.y >= fl - 1) {
            e.landed = true; e.vy = 0; e.vx *= 0.35;
            G.SFX.play('impact'); G.game.shake(0.4); G.FX.dust(e.x, fl, 14, { w: 50, speed: 260, size: 12 }); G.FX.shards(e.x, fl - 4, 6, ROSE, 400);
          }
        } else {
          e.vx = U.approach(e.vx, 0, 900 * dt); e.diveRot = U.damp(e.diveRot, -0.25, 8, dt);
          if (st < 2.0) e.vy = 0; else hoverTo(e, 0, dt, 2.2);
        }
      } else if (a === T.wing) {
        if (st < 0.62) { e.vy = ((P.y + 14) - e.y) * 5; e.vx = U.approach(e.vx, e.facing * 60, 500 * dt); }
        else if (st < 0.86) { e.vx = U.approach(e.vx, e.facing * 140, 900 * dt); e.vy *= 0.8; }
        else { e.vx = U.approach(e.vx, 0, 600 * dt); if (st > 1.1) hoverTo(e, 0, dt, 2.2); else e.vy = 0; }
      } else { e.vx = U.approach(e.vx, 0, 400 * dt); hoverTo(e, -18, dt, 3); }
    },
    // rise, mark, and fall on you like a thrown blade (red — roll)
    dive: {
      dur: 2.6, cd: 1.7, track: false,
      tells: [{ t: 0.12, c: 'red' }],
      ev: [{ t: 0.72, fn: (e) => {
        const P = e.P, fl = floorAt(P.x, P.y - 40);
        const tx = P.x + P.vx * 0.12, ty = fl, ox = e.x, oy = e.y;
        const a = Math.atan2(ty - oy, tx - ox), sp = 1080;
        e.dvx = Math.cos(a) * sp; e.dvy = Math.max(300, Math.sin(a) * sp); e.facing = e.dvx >= 0 ? 1 : -1; e.landed = false;
        G.SFX.play('whoosh', 1.4); G.SFX.play('c6_feather');
      } }],
      hits: [{ t0: 0.74, t1: 1.3, box: { x: -30, y: -108, w: 108, h: 112 }, dmg: 30, red: true, kb: 440, last: true }],
    },
    // three blade-feathers loosed in a fan (white — a perfect guard sends each back)
    volley: {
      dur: 1.9, cd: 1.8,
      tells: [{ t: 0.3, c: 'white' }],
      ev: [0.8, 0.95, 1.1].map((t, i) => ({ t, fn: (e) => {
        const P = e.P, o = { x: e.x - e.facing * 10, y: e.y - 96 };
        const a = Math.atan2(P.y - 62 - o.y, P.x - o.x) + (i - 1) * 0.09;
        shootFeather(e, o.x, o.y, a, 540);
      } })),
    },
    // too close: it drops to your height and scissors both wings forward (white)
    wing: {
      dur: 1.5, cd: 1.4, track: false,
      tells: [{ t: 0.18, c: 'white' }],
      hits: [{ t0: 0.66, t1: 0.82, box: { x: -40, y: -124, w: 168, h: 128 }, dmg: 18, kb: 300, last: true, pbal: 40 }],
      ev: [{ t: 0.64, fn: () => { G.SFX.play('slash', 0.8); G.SFX.play('c6_feather'); } }],
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : vdt();
      const W = seraphWingPose(e);
      const spawnK = e.state === 'spawn' ? 1 - U.clamp(e.st / 0.9, 0, 1) : 0;
      const bob = Math.sin(e.t * 3.1 + 0.6) * 3;
      if (!ghost && dt > 0) {
        const root = toW(e, { x: -4, y: 0 }, SS), r2 = toW(e, { x: -8, y: -30 }, SS);
        e.tail.update(root.x, root.y + bob, e.facing, dt, -e.vx * 5 + Math.sin(e.t * 1.6) * 300, 2.95);
        e.tail2.update(r2.x, r2.y + bob, e.facing, dt, -e.vx * 5 + Math.sin(e.t * 1.9 + 1) * 340, 2.7);
      }
      ctx.save();
      ctx.globalAlpha *= 1 - spawnK;
      ctx.translate(e.x, e.y + bob - spawnK * 120);
      // tail ribbons (world chains, drawn before the flip)
      if (e.tail.inited) {
        const tl = e.tail.p.map((q) => ({ x: q.x - e.x, y: q.y - e.y - bob + spawnK * 120 })), tl2 = e.tail2.p.map((q) => ({ x: q.x - e.x, y: q.y - e.y - bob + spawnK * 120 }));
        Rig.ribbon(ctx, tl2, 3.2, 0.6, '#8f1f3e'); inkS(ctx, 0.9);
        Rig.ribbon(ctx, tl, 7, 1.2, '#eee3d2'); inkS(ctx, 1.1);
        Rig.ribbon(ctx, tl.map((q) => ({ x: q.x + 1, y: q.y - 1 })), 2.2, 0.4, 'rgba(255,255,255,0.55)');
      }
      ctx.scale(e.facing * SS, SS);
      ctx.rotate(e.diveRot * 0.85);
      dissolve(ctx, e, -150, 60, ghost);
      drawSeraph(ctx, e, W);
      ctx.restore();
      dbg(ctx, e);
    },
  };
  function bladeF(ctx, bx, by, ang, L, w, body, edge, vein) {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, tip = [bx + dx * L, by + dy * L];
    pth(ctx, [[bx + nx * w * 0.6, by + ny * w * 0.6], [bx + dx * L * 0.35 + nx * w, by + dy * L * 0.35 + ny * w], tip, [bx + dx * L * 0.45 - nx * w * 0.75, by + dy * L * 0.45 - ny * w * 0.75], [bx - nx * w * 0.5, by - ny * w * 0.5]]);
    fillInk(ctx, body, 1);
    if (edge) { pth(ctx, [[bx + dx * L * 0.28 + nx * w * 0.98, by + dy * L * 0.28 + ny * w * 0.98], tip, [bx + dx * L * 0.42 + nx * w * 0.25, by + dy * L * 0.42 + ny * w * 0.25]]); ctx.fillStyle = edge; ctx.fill(); }
    if (vein) { ctx.strokeStyle = 'rgba(11,6,18,0.45)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + dx * L * 0.72, by + dy * L * 0.72); ctx.stroke(); }
    return tip;
  }
  function seraphWing(ctx, root, W, far, t, seedOff) {
    const k = far ? 0.88 : 1, len1 = 30 * k, len2 = 36 * k;
    const el = [root[0] + Math.cos(W.a1) * len1, root[1] + Math.sin(W.a1) * len1];
    const wr = [el[0] + Math.cos(W.a2) * len2, el[1] + Math.sin(W.a2) * len2];
    const ivory = far ? '#a89a8c' : '#f3eadc', edge = far ? '#8e1a3c' : '#ff3d6e', cov = far ? '#94897c' : '#ddd0bd';
    const n = 8;
    let tipOut = wr;
    // flight blades: inner ones short and hanging, primaries long and swept back
    for (let i = n - 1; i >= 0; i--) {
      if (W.cut && !far && i >= 3 && i <= 5) continue;            // the loosed blades
      const u = i / (n - 1);
      const base = u < 0.45 ? [U.lerp(root[0], el[0], 0.3 + u / 0.45 * 0.7), U.lerp(root[1], el[1], 0.3 + u / 0.45 * 0.7)] : [U.lerp(el[0], wr[0], (u - 0.45) / 0.55), U.lerp(el[1], wr[1], (u - 0.45) / 0.55)];
      const fd = W.a2 - U.lerp(2.15, 0.8, u) * W.fan + Math.sin(t * 2.2 + i * 0.7 + seedOff) * 0.035;
      const tp = bladeF(ctx, base[0], base[1], fd, U.lerp(30, 80, Math.pow(u, 0.9)) * k, U.lerp(3.4, 5.6, u), ivory, edge, !far);
      if (i === n - 1) tipOut = tp;
    }
    // coverts: short overlapping plates along the arm give the wing its mass
    for (let i = 0; i < 6; i++) {
      const u = i / 5, base = u < 0.5 ? [U.lerp(root[0], el[0], u * 2), U.lerp(root[1], el[1], u * 2)] : [U.lerp(el[0], wr[0], (u - 0.5) * 2), U.lerp(el[1], wr[1], (u - 0.5) * 2)];
      bladeF(ctx, base[0], base[1], W.a2 - U.lerp(2.0, 1.1, u) * W.fan, U.lerp(13, 24, u) * k, 3.6, cov, null, false);
    }
    // the wing's arm: a gilded bone
    LC(ctx, [{ x: root[0], y: root[1] }, { x: el[0], y: el[1] }, { x: wr[0], y: wr[1] }], [far ? 3.2 : 4.2, far ? 2.6 : 3.4, far ? 1.8 : 2.3], far ? '#8f7650' : '#d9b872', { spec: far ? 0 : 0.45 });
    return tipOut;
  }
  function drawSeraph(ctx, e, W) {
    const t = e.t, broken = e.state === 'broken', T = TYPES.c6_seraph;
    const sway = Math.sin(t * 1.7) * 3 + U.clamp(-e.vx * e.facing * 0.02, -6, 6);
    // halo: a broken crown of light behind the head (the Ark's own cyan, not the Hush's crimson)
    const hs = broken ? 0.45 : 1;
    lighter(ctx, () => {
      ctx.save(); ctx.translate(-5, -103);
      glow(ctx, 0, 0, 30, CYAN, 0.22 * hs);
      for (let i = 0; i < 6; i++) {
        const a0 = i * TAU / 6 + t * 0.35, a1 = a0 + TAU / 6 - 0.4;
        ctx.strokeStyle = U.rgba('#d8fbff', 0.9 * hs); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 0, 16, a0, a1); ctx.stroke();
        const ra = a0 + 0.2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(Math.cos(ra) * 18, Math.sin(ra) * 18); ctx.lineTo(Math.cos(ra) * (24 + (i % 2) * 5), Math.sin(ra) * (24 + (i % 2) * 5)); ctx.stroke();
      }
      ctx.restore();
    });
    // far wing
    seraphWing(ctx, [-10, -80], { ...W, a1: W.a1 - 0.22, a2: W.a2 - 0.2 }, true, t, 3);
    // veil: from the crown down the back
    ctx.beginPath(); ctx.moveTo(1, -110); ctx.bezierCurveTo(-10, -112, -15, -100, -14 + sway * 0.4, -84); ctx.bezierCurveTo(-15 + sway * 0.6, -74, -18 + sway, -64, -16 + sway, -56);
    ctx.lineTo(-10 + sway * 0.5, -62); ctx.bezierCurveTo(-8, -72, -6, -86, -2, -94); ctx.closePath();
    fillInk(ctx, lit(ctx, -8, -86, 10, '#8f1f3e'), 1.2);
    // robe: long ivory over a crimson slit, gathering into a point
    const robe = () => { ctx.beginPath(); ctx.moveTo(-8, -64); ctx.bezierCurveTo(-15, -46, -14 + sway * 0.4, -18, -6 + sway, 8); ctx.lineTo(-2 + sway, 3); ctx.bezierCurveTo(5 + sway * 0.6, -14, 13, -38, 8, -64); ctx.closePath(); };
    robe(); fillInk(ctx, lit(ctx, -1, -32, 12, '#eee4d4'), 1.4);
    ctx.save(); robe(); ctx.clip();
    ctx.beginPath(); ctx.moveTo(5, -62); ctx.bezierCurveTo(11, -40, 8, -22, 1 + sway * 0.8, 2); ctx.lineTo(-1 + sway * 0.6, -8); ctx.bezierCurveTo(3, -26, 4, -44, 1, -62); ctx.closePath();
    ctx.fillStyle = '#c42a50'; ctx.fill(); inkS(ctx, 0.8);
    ctx.strokeStyle = 'rgba(11,6,18,0.4)'; ctx.lineWidth = 0.6; ctx.beginPath();
    for (const f of [-6, -2.5]) { ctx.moveTo(f, -60); ctx.quadraticCurveTo(f - 3 + sway * 0.3, -30, f * 0.4 + sway * 0.8, -2); } ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#d4ad58'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-13, -40); ctx.quadraticCurveTo(-1, -35, 12, -42); ctx.stroke();   // gilt girdle line
    // cuirass
    blob(ctx, [[-9, -88], [5, -90], [10, -80], [8, -64], [-8, -61], [-11, -74]]); fillInk(ctx, lit(ctx, 0, -76, 11, '#f4ece0'), 1.4);
    ctx.strokeStyle = '#d4ad58'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9, -66); ctx.quadraticCurveTo(0, -62, 8, -66); ctx.moveTo(-2, -88); ctx.quadraticCurveTo(3, -80, 2, -68); ctx.stroke();
    // head: a smooth porcelain profile, crimson hood over the crown, one vertical slit for an eye
    blob(ctx, [[-4, -109], [3, -112], [8, -105], [9.5, -98], [6, -92], [-1, -92], [-5, -99]]); fillInk(ctx, lit(ctx, 3, -102, 8, '#f7f1e8'), 1.2);
    ctx.beginPath(); ctx.moveTo(-6, -98); ctx.bezierCurveTo(-7, -110, 2, -116, 8, -108); ctx.lineTo(4, -106); ctx.bezierCurveTo(0, -109, -3, -106, -3, -97); ctx.closePath(); fillInk(ctx, lit(ctx, 0, -108, 7, '#a2244a'), 1);
    const slitA = broken ? 0.3 : 0.95;
    lighter(ctx, () => { ctx.fillStyle = U.rgba(ROSE, slitA); ctx.fillRect(5.4, -104, 1.5, 9); glow(ctx, 6, -100, 11, ROSE, 0.55 * slitA); });
    // long arms cradling the crimson heart (they open for the wing cut)
    const open = e.state === 'atk' && e.atk === T.wing && e.st > 0.6 ? 1 : e.state === 'atk' && e.atk === T.volley && e.st > 0.4 ? 0.6 : 0;
    const hand = { x: 12 + open * 12, y: -74 + open * 8 };
    LC(ctx, [{ x: 2, y: -86 }, { x: 8 + open * 4, y: -70 + open * 2 }, hand], [2.6, 2.1, 1.6], '#e9decd');
    const hb = broken ? 0.3 : 0.75 + 0.2 * Math.sin(t * 4);
    const hc = { x: 11 - open * 4, y: -76 };
    lighter(ctx, () => glow(ctx, hc.x, hc.y, 15, ROSE, hb * 0.75));
    pth(ctx, [[hc.x, hc.y - 7], [hc.x + 4, hc.y], [hc.x, hc.y + 6], [hc.x - 3.5, hc.y]]); fillInk(ctx, '#ff3d6e', 0.9);
    ctx.fillStyle = '#ffd0dc'; pth(ctx, [[hc.x, hc.y - 7], [hc.x + 2, hc.y - 1], [hc.x, hc.y]]); ctx.fill();
    // near wing (in front of the body)
    const wr = seraphWing(ctx, [-6, -82], W, false, t, 0);
    if (e.tellT > 0) tellGlow(ctx, wr[0], wr[1], e, 28);
    hitFlash(ctx, e, () => { ctx.beginPath(); ctx.ellipse(0, -60, 18, 52, 0, 0, TAU); ctx.fill(); });
  }

  /* =====================================================================================
     第六隊長・洛克 ROOK, THE LAST SENTRY (elite) — tower shield, lance, a lantern for the sleepers
     ===================================================================================== */
  const RS = 1.36, LANCE = 118;
  const RP = {
    idle: (t, e) => {
      const br = Math.sin(t * 1.6), down = e && e.guardT > 0 ? 1 : 0;
      return { ry: 6 + br * 1.2, rx: Math.sin(t * 0.5) * 1, torso: 0.16 + br * 0.012, head: -0.05, tF: 0.42, kF: -0.48, tB: -0.36, kB: -0.22,
        aF: 0.85, eF: 0.62, sw: 1.52 + br * 0.02, aB: U.lerp(0.95, 0.35, down), eB: U.lerp(0.65, 0.3, down) };
    },
    thrA: { ry: 9, torso: 0.02, head: -0.05, tF: 0.5, kF: -0.62, tB: -0.45, kB: -0.3, aF: 0.2, eF: 1.35, sw: 1.62, aB: 1.0, eB: 0.6 },
    thrB: { ry: 13, torso: 0.45, head: -0.12, tF: 0.95, kF: -0.92, tB: -0.75, kB: -0.1, aF: 1.45, eF: 0.05, sw: 1.55, aB: 0.65, eB: 0.85 },
    high: { ry: 3, torso: -0.15, head: -0.1, tF: 0.45, kF: -0.5, tB: -0.42, kB: -0.2, aF: 2.9, eF: 0.35, sw: 3.55, aB: 1.15, eB: 0.45 },
    highDip: { ry: 8, torso: 0.08, head: 0.05, tF: 0.55, kF: -0.7, tB: -0.45, kB: -0.3, aF: 2.55, eF: 0.4, sw: 3.1, aB: 1.1, eB: 0.5 },
    high2: { ry: 0, torso: -0.24, head: -0.2, tF: 0.45, kF: -0.45, tB: -0.42, kB: -0.15, aF: 3.05, eF: 0.4, sw: 3.85, aB: 1.2, eB: 0.4 },
    slam: { ry: 18, torso: 0.7, head: 0.2, tF: 1.0, kF: -1.0, tB: -0.78, kB: -0.15, aF: 1.4, eF: 0.0, sw: 1.22, aB: 0.5, eB: 0.8 },
    brace: { ry: 16, torso: 0.55, head: 0.2, tF: 0.75, kF: -1.15, tB: -0.55, kB: -0.6, aF: 0.55, eF: 0.95, sw: 1.42, aB: 1.45, eB: 0.15 },
    bash: { ry: 12, torso: 0.52, head: 0.05, tF: 0.95, kF: -0.88, tB: -0.72, kB: -0.1, aF: 0.45, eF: 1.0, sw: 1.25, aB: 1.66, eB: 0.0 },
    sweepA: { ry: 24, torso: 0.3, head: 0.1, tF: 0.95, kF: -1.35, tB: -0.6, kB: -0.85, aF: -0.55, eF: 0.25, sw: -1.62, aB: 1.2, eB: 0.4 },
    sweepB: { ry: 26, torso: 0.38, head: 0.0, tF: 1.0, kF: -1.35, tB: -0.65, kB: -0.85, aF: 0.78, eF: 0.0, sw: 1.52, aB: 0.6, eB: 0.6 },
    lamp: { ry: 8, torso: 0.08, head: -0.1, tF: 0.6, kF: -0.7, tB: -0.5, kB: -0.25, aF: 0.6, eF: 0.9, sw: 1.15, aB: 1.95, eB: 0.35 },
    tired: { ry: 16, torso: 0.72, head: 0.4, tF: 0.7, kF: -1.0, tB: -0.5, kB: -0.45, aF: 0.4, eF: 0.4, sw: 0.7, aB: 0.35, eB: 0.3 },
    roar: { ry: 3, torso: -0.32, head: -0.55, tF: 0.5, kF: -0.4, tB: -0.5, kB: -0.15, aF: 0.6, eF: 0.15, sw: 0.25, aB: -0.4, eB: 0.3 },
    hurt: { ry: 8, torso: -0.3, head: 0.45, tF: 0.2, kF: -0.6, tB: -0.55, kB: -0.4, aF: 0.3, eF: 0.9, sw: 1.0, aB: 0.6, eB: 0.9 },
    hitSnap: { torso: -0.3, head: 0.5, aF: 0.4, eF: 1.0, aB: 0.7, eB: 0.9, ry: 6 },
    broken: (t) => ({ ry: 26, torso: 0.82 + Math.sin(t * 2.2) * 0.04, head: 0.6, tF: 1.3, kF: -1.35, tB: 0.0, kB: -1.57, aF: 0.9, eF: 0.1, sw: 0.18, aB: 0.2, eB: 0.2 }),
  };
  const rookShield = (e) => { const J = e.J; if (!J || !J.shc) return { x: e.x + e.facing * 60, y: e.y - 110 }; return toW(e, J.shc, RS); };
  const rookGuardDown = (x) => guardDown(x);
  function spawnLightWall(e) {
    const fl = floorAt(e.x, e.y - 20), sp = rookShield(e), dir = e.facing, p2 = e.phase === 2;
    G.game.hazards.push({
      c6: 'wall', x: sp.x + dir * 20, y: fl, dir, t: 0, life: 2.2, owner: e, hit: false, p2,
      update(h, dt, g) {
        h.x += h.dir * 540 * dt;
        for (const s of G.Phys.allSolids()) if (s.h > 60 && h.x > s.x && h.x < s.x + s.w && h.y - 60 > s.y && h.y - 60 < s.y + s.h) { h.done = true; G.FX.spark(h.x, h.y - 80, 16, { col: '#dffff2', speed: 400 }); return; }
        if (h.hit) return;
        const P = g.player, hb = P.hurtbox, box = { x: h.x - 14, y: h.y - 178, w: 28, h: 178 };
        if (U.rectsOverlap(box, hb)) {
          const r = P.receiveHit(h.owner, { dmg: 22, kb: 280, hx: h.x, hy: P.y - 60, waveFrom: h.x - h.dir * 40 });
          if (r === 'ignored') return;
          h.hit = true;
          if (r === 'parried' && h.owner && !h.owner.dead) {
            const o = h.owner; o.bal = Math.min(o.maxBal, o.bal + 48); o.balT = 0; o.showBar = 3; if (o.bal >= o.maxBal) o.breakBalance();
            h.done = true; G.FX.shards(h.x, h.y - 90, 12, TEAL, 420);
          }
        }
      },
      draw(ctx, h) {
        const k = U.clamp(h.t / 0.12, 0, 1), fade = 1 - U.clamp((h.t - h.life + 0.4) / 0.4, 0, 1), col = h.p2 ? '#ff5d7e' : TEAL;
        ctx.globalAlpha = fade; ctx.globalCompositeOperation = 'lighter';
        const H = 178 * U.easeOutBack(k);
        const g = ctx.createLinearGradient(h.x, h.y, h.x, h.y - H); g.addColorStop(0, U.rgba(col, 0.7)); g.addColorStop(0.7, U.rgba(col, 0.35)); g.addColorStop(1, U.rgba(col, 0));
        ctx.fillStyle = g; ctx.fillRect(h.x - 16, h.y - H, 32, H);
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(h.x - 2.5 + h.dir * 6, h.y - H * 0.95, 5, H * 0.95);
        for (let i = 0; i < 3; i++) { const y = h.y - ((h.t * 260 + i * 60) % H); ctx.fillStyle = U.rgba('#ffffff', 0.6); ctx.fillRect(h.x - 10, y, 20, 2); }
        glow(ctx, h.x, h.y - 4, 40, col, 0.5);
      },
    });
    G.SFX.play('c6_lamp'); G.FX.flash(sp.x, sp.y, 70, 0.25, p2 ? '#ff5d7e' : TEAL);
  }
  TYPES.c6_elite = {
    name: '船衛・洛克', en: 'ROOK, THE LAST SENTRY', w: 52, h: 178, hp: 760, bal: 230, col: TEAL, elite: true, shards: 420, scale: RS, spawnT: 1.1, poise: true,
    defeatDialog: 'c6_eliteDefeat', defeatRelic: 'c6_badge', music: 'c6_elite', portrait: [1.75, 0.94],
    init(e) { e.facing = -1; e.guardT = 0; e.blocks = 0; e.cape = new Rig.Chain(8, 9.5, 0.05, 0.9); e.plume = new Rig.Chain(6, 6, 0.1, 0.85); e.lastPick = null; e.p2k = 0; },
    voice: (e) => G.SFX.play('c6_rookVoice', e.phase === 2 ? 1.12 : 1),
    weapon: (e) => {
      const T = TYPES.c6_elite;
      if (e.atk === T.charge || e.atk === T.lightwall || (e.atk === T.bashsweep && e.st < 0.8)) return rookShield(e);
      const J = e.J; return J ? toW(e, J.ltip, RS) : { x: e.x + e.facing * 120, y: e.y - 110 };
    },
    think(e, dt) {
      const T = TYPES.c6_elite;
      e.guardT = Math.max(0, e.guardT - dt); e.invuln = false;
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) { e.phase = 2; e.speedMul = 1.15; e.startAtk(T.roar); return; }
      e.faceP(); const d = e.distP();
      const want = 175;
      if (d > want + 50) e.vx = U.approach(e.vx, e.facing * 135 * e.speedMul, 800 * dt);
      else if (d < want - 75) e.vx = U.approach(e.vx, -e.facing * 95, 800 * dt);
      else e.vx = U.approach(e.vx, 0, 800 * dt);
      if (e.cd > 0) return;
      const p2 = e.phase === 2;
      const pool = d < 150 ? [['bashsweep', 3], ['thrust3', 2], ['feint', 2]]
        : d < 270 ? [['thrust3', 4], ['feint', 3], ['bashsweep', 1.2]].concat(p2 ? [['flurry', 3.5]] : [])
          : [['charge', 3]].concat(p2 ? [['lightwall', 3]] : [['charge', 0]]);
      if (d >= 270 && d > 560 && !p2) return;                       // too far: keep walking in
      let tot = 0; for (const p of pool) tot += p[0] === e.lastPick ? p[1] * 0.3 : p[1];
      let r = Math.random() * tot, pick = pool[0][0];
      for (const p of pool) { const w = p[0] === e.lastPick ? p[1] * 0.3 : p[1]; if ((r -= w) <= 0) { pick = p[0]; break; } }
      e.lastPick = pick; e.startAtk(T[pick]);
    },
    atkUpdate(e, dt) {
      const T = TYPES.c6_elite;
      e.guardT = Math.max(0, e.guardT - dt);
      if (e.atk === T.charge && e.st > 0.95 && e.st < 1.55 && Math.random() < 0.5) G.FX.dust(e.x - e.facing * 20, e.y, 1, { w: 20, speed: 120, size: 12, col: 'rgba(200,220,215,' });
    },
    guard(e, h) { return shieldGuard(e, h, { at: rookShield, knockT: 1.4, blocks: 3, counter: TYPES.c6_elite.bashsweep, col: TEAL }); },
    // three lance jabs (white ×3)
    thrust3: {
      dur: 2.5, cd: 1.1, onStart: rookGuardDown(0.8),
      tells: [{ t: 0.15, c: 'white' }, { t: 0.75, c: 'white' }, { t: 1.35, c: 'white' }],
      poses: { dur: 2.5, keys: [[0, RP.idle(0)], [0.45, RP.thrA], [0.62, RP.thrB, 'snap'], [0.95, RP.thrA, 'io'], [1.2, RP.thrB, 'snap'], [1.58, RP.thrA, 'io'], [1.82, RP.thrB, 'snap'], [2.5, RP.idle(0), 'io']] },
      moves: [{ t0: 0.54, t1: 0.62, v: 220 }, { t0: 1.12, t1: 1.2, v: 220 }, { t0: 1.72, t1: 1.82, v: 300 }],
      trackWin: 0.4,
      hits: [
        { t0: 0.6, t1: 0.72, box: { x: 30, y: -120, w: 208, h: 46 }, dmg: 20, kb: 240 },
        { t0: 1.2, t1: 1.32, box: { x: 30, y: -120, w: 208, h: 46 }, dmg: 20, kb: 240 },
        { t0: 1.82, t1: 1.96, box: { x: 30, y: -120, w: 210, h: 46 }, dmg: 24, kb: 320, last: true, pbal: 60 },
      ],
      ev: [0.6, 1.2, 1.82].map((t, i) => ({ t, fn: () => G.SFX.play('slash', 0.55 + i * 0.05, i === 2) })),
    },
    // the delayed slam: the lance hangs overhead, twitches — and only then comes down (white)
    feint: {
      dur: 2.35, cd: 1.1, onStart: rookGuardDown(0.9),
      tells: [{ t: 0.45, c: 'white' }],
      poses: { dur: 2.35, keys: [[0, RP.idle(0)], [0.5, RP.high], [0.88, RP.high], [0.98, RP.highDip, 'snap'], [1.12, RP.high, 'io'], [1.38, RP.high2], [1.5, RP.slam, 'snap'], [1.9, RP.slam], [2.35, RP.idle(0), 'io']] },
      moves: [{ t0: 1.42, t1: 1.5, v: 260 }],
      hits: [{ t0: 1.47, t1: 1.6, box: { x: 20, y: -205, w: 215, h: 200 }, dmg: 28, kb: 360, last: true, pbal: 80 }],
      ev: [
        { t: 0.98, fn: (e) => { G.SFX.play('whoosh', 0.5); G.FX.ember(e.x, e.y - 200, 4, TEAL, { w: 40, h: 20 }); } },
        { t: 1.5, fn: (e) => { G.SFX.play('slash', 0.45, true); const x = e.x + e.facing * 215; G.game.shake(0.5); G.FX.dust(x, e.y, 14, { w: 50, speed: 260, size: 14 }); G.FX.shards(x, e.y - 4, 8, e.phase === 2 ? CRIM : TEAL, 420); } },
      ],
    },
    // shield bash (white) into a low lance sweep along the floor (red — jump it or roll)
    bashsweep: {
      dur: 2.45, cd: 1.2, onStart: rookGuardDown(0.8),
      tells: [{ t: 0.15, c: 'white' }, { t: 0.85, c: 'red' }],
      poses: { dur: 2.45, keys: [[0, RP.idle(0)], [0.42, RP.brace], [0.62, RP.bash, 'snap'], [0.9, RP.bash], [1.2, RP.sweepA, 'io'], [1.46, RP.sweepA], [1.56, RP.sweepB, 'snap'], [1.95, RP.sweepB], [2.45, RP.idle(0), 'io']] },
      moves: [{ t0: 0.54, t1: 0.64, v: 320 }, { t0: 1.5, t1: 1.6, v: 200 }],
      hits: [
        { t0: 0.6, t1: 0.72, box: { x: 0, y: -175, w: 98, h: 170 }, dmg: 18, kb: 300 },
        { t0: 1.52, t1: 1.66, box: { x: -30, y: -76, w: 245, h: 76 }, dmg: 26, red: true, kb: 380, last: true },
      ],
      ev: [{ t: 0.6, fn: () => G.SFX.play('c6_clang', 0.7) }, { t: 1.52, fn: (e) => { G.SFX.play('slash', 0.5, true); G.FX.dust(e.x + e.facing * 120, e.y, 18, { w: 200, speed: 200, size: 12 }); } }],
    },
    // the shield charge (red): lowers the tower shield and runs you down
    charge: {
      dur: 2.6, cd: 1.3, track: false, onStart: rookGuardDown(0.7),
      tells: [{ t: 0.3, c: 'red' }],
      poses: { dur: 2.6, keys: [[0, RP.idle(0)], [0.6, RP.brace], [0.95, RP.brace], [1.6, RP.brace], [1.95, RP.tired, 'io'], [2.6, RP.idle(0), 'io']] },
      moves: [{ t0: 0.95, t1: 1.55, v: 720 }],
      hits: [{ t0: 0.95, t1: 1.55, box: { x: -10, y: -175, w: 108, h: 170 }, dmg: 30, red: true, kb: 520, last: true }],
      ev: [{ t: 0.95, fn: () => { G.SFX.play('whoosh', 1.3); G.SFX.play('c6_rookVoice', 0.9); } }],
    },
    // phase II: the lantern on the shield throws walls of light along the floor (white — guard / parry them)
    lightwall: {
      dur: 2.4, cd: 1.3, track: false, onStart: rookGuardDown(0.6),
      tells: [{ t: 0.3, c: 'white' }, { t: 1.0, c: 'white' }],
      poses: { dur: 2.4, keys: [[0, RP.idle(0)], [0.5, RP.lamp], [2.0, RP.lamp], [2.4, RP.idle(0), 'io']] },
      ev: [{ t: 0.85, fn: (e) => spawnLightWall(e) }, { t: 1.55, fn: (e) => spawnLightWall(e) }],
    },
    // phase II: four fast jabs and a red lunge across the floor
    flurry: {
      dur: 3.3, cd: 1.3, onStart: rookGuardDown(0.9),
      // one white tell announces all four jabs (they come 0.42 s apart — a flash per jab would sit < 0.45 s before its blow)
      tells: [{ t: 0.12, c: 'white' }, { t: 1.95, c: 'red' }],
      poses: { dur: 3.3, keys: [[0, RP.idle(0)], [0.42, RP.thrA], [0.58, RP.thrB, 'snap'], [0.86, RP.thrA, 'io'], [1.0, RP.thrB, 'snap'], [1.28, RP.thrA, 'io'], [1.42, RP.thrB, 'snap'], [1.7, RP.thrA, 'io'], [1.85, RP.thrB, 'snap'], [2.4, RP.thrA, 'io'], [2.56, RP.thrB, 'snap'], [2.85, RP.thrB], [3.3, RP.idle(0), 'io']] },
      moves: [{ t0: 0.5, t1: 0.58, v: 200 }, { t0: 0.92, t1: 1.0, v: 200 }, { t0: 1.34, t1: 1.42, v: 200 }, { t0: 1.77, t1: 1.85, v: 200 }, { t0: 2.5, t1: 2.75, v: 900 }],
      trackWin: 0.35,
      hits: [
        { t0: 0.57, t1: 0.68, box: { x: 30, y: -120, w: 208, h: 46 }, dmg: 17, kb: 200 },
        { t0: 0.99, t1: 1.1, box: { x: 30, y: -120, w: 208, h: 46 }, dmg: 17, kb: 200 },
        { t0: 1.41, t1: 1.52, box: { x: 30, y: -120, w: 208, h: 46 }, dmg: 17, kb: 200 },
        { t0: 1.84, t1: 1.95, box: { x: 30, y: -120, w: 208, h: 46 }, dmg: 19, kb: 240 },
        { t0: 2.55, t1: 2.78, box: { x: 30, y: -122, w: 212, h: 50 }, dmg: 32, red: true, kb: 520, last: true },
      ],
      ev: [0.57, 0.99, 1.41, 1.84].map((t) => ({ t, fn: () => G.SFX.play('slash', 0.62) })).concat([{ t: 2.55, fn: () => { G.SFX.play('slash', 0.45, true); G.SFX.play('whoosh', 1.5); } }]),
    },
    // the vigil breaks (phase change, no hit): the lamp burns crimson, the Hush takes the lance
    roar: {
      dur: 1.7, cd: 0.6, track: false,
      poses: { dur: 1.7, keys: [[0, RP.hurt], [0.4, RP.roar], [1.3, RP.roar], [1.7, RP.idle(0), 'io']] },
      ev: [
        { t: 0.0, fn: (e) => { e.invuln = true; } },
        { t: 0.45, fn: (e) => {
          G.game.bark('c6_eliteP2'); G.SFX.play('roar'); G.SFX.play('c6_crack', 1.4); G.game.shake(0.8); G.game.slowmo(0.5, 0.4);
          G.FX.ring(e.cx, e.cy, 20, 300, 0.7, CRIM, 7); G.FX.shards(e.cx, e.cy - 30, 26, CRIM, 620); G.FX.flash(e.cx, e.cy - 40, 220, 0.35, '#ff5d7e');
        } },
        { t: 1.5, fn: (e) => { e.invuln = false; } },
      ],
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : vdt(), T = TYPES.c6_elite;
      const override = (q) => {
        if (q.state === 'atk' && q.atk === T.charge && q.st > 0.95 && q.st < 1.55) {   // sprinting behind the shield
          q.gaitP = (q.gaitP || 0) + dt * 15; const r = Rig.ANIM.run(q.gaitP, 1);
          return { ...RP.brace, ik: 1, fFx: r.fFx, fFy: r.fFy, fBx: r.fBx, fBy: r.fBy, ry: 12 + r.ry * 0.6 };
        }
        return null;
      };
      const J = hPose(e, RP, dt, { walk: true, stride: 16, override, step: () => G.SFX.play('heavyStep') });
      const ld = { x: Math.sin(J.sw), y: Math.cos(J.sw) };
      J.ltip = { x: J.hdF.x + ld.x * LANCE, y: J.hdF.y + ld.y * LANCE }; J.lbut = { x: J.hdF.x - ld.x * 30, y: J.hdF.y - ld.y * 30 };
      e.J = J;
      if (!ghost) {
        e.p2k = U.approach(e.p2k, e.phase === 2 && !(e.atk === T.roar && e.st < 0.45) ? 1 : 0, dt * 2.5);
        e.shieldJolt = Math.max(0, (e.shieldJolt || 0) - dt * 5); e.shieldKnock = Math.max(0, (e.shieldKnock || 0) - dt * 1.2);
        if (dt > 0) {
          const ca = toW(e, { x: J.chest.x - 9, y: J.chest.y + 2 }, RS);
          e.cape.update(ca.x, ca.y, e.facing, dt, -e.vx * 4 + Math.sin(e.t * 1.7) * 260, 2.75);
          const pa = toW(e, { x: J.head.x - 4, y: J.head.y - 14 }, RS);
          e.plume.update(pa.x, pa.y, e.facing, dt, -e.vx * 6 + Math.sin(e.t * 2.3) * 400, 2.2);
          if (e.p2k > 0.5 && Math.random() < 0.25) G.FX.ember(e.x, e.y - 60 - Math.random() * 100, 1, CRIM, { w: 50, h: 20, up: 70 });
        }
      }
      const sink = K.emerge(ctx, e) * 190;
      ctx.save();
      ctx.translate(e.x, e.y + sink);
      if (e.p2k > 0) lighter(ctx, () => glow(ctx, 0, -95, 150, CRIM, 0.12 * e.p2k));
      ctx.scale(e.facing * RS, RS);
      dissolve(ctx, e, -150, 10, ghost);
      drawRook(ctx, e, J);
      ctx.restore();
      dbg(ctx, e);
    },
  };
  const RC = { steel: '#56636e', steelB: '#38424c', plate: '#8c9aa4', trim: '#d9b45a', cloth: '#1e3c43', clothIn: '#0e1d22', enamel: '#4d8f86' };
  function drawRook(ctx, e, J) {
    const t = e.t, p2 = e.p2k || 0, broken = e.state === 'broken', T = TYPES.c6_elite;
    const Q = torsoF(J), acc = p2 > 0.5 ? CRIM : TEAL;
    const toL = (q) => ({ x: (q.x - e.x) * e.facing / RS, y: (q.y - e.y) / RS });
    // cape (tattered Descent-VI field cloak) + plume
    if (e.cape.inited) K.tattered(ctx, e.cape.p.map(toL), 8, 18, p2 > 0.5 ? '#3a1c2a' : RC.cloth, p2 > 0.5 ? '#5a1024' : RC.clothIn, 4);
    if (e.plume.inited) { const pl = e.plume.p.map(toL); Rig.ribbon(ctx, pl, 4.2, 0.8, '#ece5d6', 1.5); inkS(ctx, 1); Rig.ribbon(ctx, pl.map((q) => ({ x: q.x + 0.8, y: q.y - 1 })), 1.6, 0.3, 'rgba(255,255,255,0.7)'); }
    // back leg (armoured)
    LC(ctx, [J.hip, lerpP(J.hip, J.kneeB, 0.5), J.kneeB, lerpP(J.kneeB, J.ankB, 0.5), J.ankB], [7.2, 6.4, 5.0, 4.6, 3.4], RC.steelB);
    LB(ctx, lerpP(J.kneeB, J.ankB, 0.1), lerpP(J.kneeB, J.ankB, 0.85), 5.6, 4.6, '#6e7c86', { spec: 0.2 });
    LB(ctx, J.ankB, J.toeB, 4.2, 3.0, '#2c3238');
    LC(ctx, [J.shB, J.elB, J.hdB], [4.8, 4.2, 3.4], RC.steelB);
    // torso: gambeson, breastplate with enamel inlay, faulds
    blob(ctx, [Q(-0.12, -10.5), Q(0.45, -11.5), Q(0.92, -13.5), Q(1.12, -6), Q(1.1, 7), Q(0.85, 13), Q(0.45, 11.5), Q(-0.05, 10.5)]);
    fillInk(ctx, lit(ctx, ...Q(0.5, 0), 14, '#3a4650'), 1.4);
    blob(ctx, [Q(0.4, -12.5), Q(0.98, -14), Q(1.12, -4), Q(1.08, 9), Q(0.84, 15), Q(0.45, 13)]);
    fillInk(ctx, lit(ctx, ...Q(0.72, 1), 15, RC.plate), 1.4);
    ctx.strokeStyle = RC.trim; ctx.lineWidth = 1.3; ctx.beginPath(); { const a = Q(0.95, -12), b = Q(0.62, 2), c = Q(0.95, 13.5); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); } ctx.stroke();
    blob(ctx, [Q(0.78, 2), Q(0.92, 6), Q(0.78, 10), Q(0.64, 6)]); fillInk(ctx, p2 > 0.5 ? '#8f1f3e' : RC.enamel, 0.9);   // squad VI enamel
    // fauld lames over the hips
    for (let i = 0; i < 3; i++) { const s0 = 0.28 - i * 0.14; pth(ctx, [Q(s0, -12.5 + i), Q(s0, 13 - i * 0.5), Q(s0 - 0.16, 14 - i), Q(s0 - 0.16, -13 + i)]); fillInk(ctx, lit(ctx, ...Q(s0 - 0.08, 0), 13, i % 2 ? RC.steel : '#6d7a84'), 1); }
    // teal tabard strip with the squad mark
    pth(ctx, [Q(0.32, 3), Q(0.32, 10), Q(-0.75, 9), Q(-0.85, 6.5), Q(-0.75, 4)]); fillInk(ctx, lit(ctx, ...Q(-0.2, 6.5), 4, p2 > 0.5 ? '#6a1830' : '#2e6a66'), 1);
    ctx.strokeStyle = RC.trim; ctx.lineWidth = 0.7; ctx.beginPath(); { const a = Q(0.2, 3.6), b = Q(-0.7, 4.4), c = Q(0.2, 9.4), d2 = Q(-0.7, 8.6); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c[0], c[1]); ctx.lineTo(d2[0], d2[1]); } ctx.stroke();
    // phase II: the Hush breaks out of the plate
    if (p2 > 0) { const c = Q(0.8, -11); ctx.save(); ctx.globalAlpha *= p2; crystalCluster(ctx, c[0], c[1], -2.5, 0.95, 0.6, CRIM, '#ffc2d0', t); ctx.restore(); }
    // front leg (armoured)
    LC(ctx, [J.hip, lerpP(J.hip, J.kneeF, 0.5), J.kneeF, lerpP(J.kneeF, J.ankF, 0.5), J.ankF], [7.8, 7.0, 5.4, 4.8, 3.6], RC.steel, { spec: 0.3 });
    LB(ctx, lerpP(J.hip, J.kneeF, 0.1), lerpP(J.hip, J.kneeF, 0.75), 7.2, 6.0, '#7c8a94', { spec: 0.3 });
    LB(ctx, lerpP(J.kneeF, J.ankF, 0.1), lerpP(J.kneeF, J.ankF, 0.88), 6.0, 4.8, RC.plate, { spec: 0.45 });
    { const k = J.kneeF; ctx.beginPath(); ctx.ellipse(k.x + 1.5, k.y, 5.5, 4.4, 0, 0, TAU); fillInk(ctx, lit(ctx, k.x, k.y, 6, RC.plate), 1.1); ctx.fillStyle = RC.trim; ctx.beginPath(); ctx.arc(k.x + 2, k.y, 1.3, 0, TAU); ctx.fill(); }
    LB(ctx, J.ankF, J.toeF, 4.6, 3.2, '#3a424a');
    // great helm with a T-visor, sentry light inside
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    blob(ctx, [[-10.5, 4], [-11.5, -8], [-6, -14.5], [4, -14], [10.5, -8], [11.5, 6], [6, 10], [-6, 10]]); fillInk(ctx, lit(ctx, 0, -2, 12, '#9aa8b2'), 1.4);
    ctx.fillStyle = '#0d1418'; pth(ctx, [[2, -5.5], [12, -5], [12, -2.6], [8.6, -2.6], [8.6, 7], [6.4, 7], [6.4, -2.6], [2, -2.8]]); ctx.fill(); inkS(ctx, 0.8);
    const vis = broken ? 0.35 + Math.random() * 0.3 : 0.95;
    lighter(ctx, () => {
      ctx.fillStyle = U.rgba(acc, vis); ctx.fillRect(4, -4.8, 7.5, 1.6); ctx.fillRect(7, -3.2, 1.3, 8.5);
      glow(ctx, 9, -3, 12, acc, 0.55 * vis);
    });
    ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-1, -14); ctx.quadraticCurveTo(-2, -2, -1, 9); ctx.stroke();
    for (const [x, y] of [[-6, -9], [-7, 1], [3, 7.5]]) { ctx.fillStyle = RC.trim; ctx.beginPath(); ctx.arc(x, y, 0.9, 0, TAU); ctx.fill(); }
    LB(ctx, { x: -6, y: -15 }, { x: 4, y: -15.5 }, 2.4, 2, RC.trim, { noHatch: true });   // crest ridge
    if (p2 > 0.3) { ctx.strokeStyle = U.rgba(CRIM, p2); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(3, -14); ctx.lineTo(6, -8); ctx.lineTo(4.5, -5); ctx.stroke(); spike(ctx, -8, -11, -2.4, 8 * p2, 2, CRIM, '#ffc2d0'); }
    ctx.restore();
    // the tower shield on the back arm (lantern at its heart)
    const fa = fwdAng(J.elB, J.hdB), knock = e.shieldKnock || 0, jolt = e.shieldJolt || 0;
    const sc = { x: J.hdB.x + 2 - jolt * 4, y: J.hdB.y + 2 }; J.shc = { x: sc.x + 8, y: sc.y - 10 };
    ctx.save(); ctx.translate(sc.x, sc.y); ctx.rotate((PI / 2 - fa) * 0.35 + knock * 0.55 - jolt * 0.06);
    const sh = [[-10, -54], [8, -58], [17, -50], [18, 34], [4, 52], [-10, 40]];
    pth(ctx, [[-10, -54], [-15, -50], [-15, 38], [-10, 40]]); fillInk(ctx, '#2f383f', 1.2);    // edge
    pth(ctx, sh); fillInk(ctx, lit(ctx, 3, -4, 20, '#5d7a78'), 1.6);
    ctx.save(); pth(ctx, sh); ctx.clip();
    ctx.fillStyle = 'rgba(11,6,18,0.18)'; pth(ctx, [[-10, 6], [18, -6], [18, 52], [-10, 52]]); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.8; ctx.beginPath(); for (const [x1, y1, x2, y2] of [[-6, -30, 6, -40], [0, 20, 14, 12], [-4, 30, 2, 26]]) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); } ctx.stroke();   // scars
    ctx.restore();
    ctx.strokeStyle = RC.trim; ctx.lineWidth = 2; pth(ctx, [[-8, -51], [8, -55], [15, -48], [15.5, 32], [4, 48.5], [-8, 38]]); ctx.stroke();
    // engraved sleeping eye + "VI"
    ctx.strokeStyle = 'rgba(11,6,18,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, 22); ctx.quadraticCurveTo(4, 28, 12, 22); ctx.moveTo(-3, 24); ctx.lineTo(-4.5, 27); ctx.moveTo(4, 26.5); ctx.lineTo(4, 30); ctx.moveTo(11, 24); ctx.lineTo(12.5, 27); ctx.stroke();
    ctx.strokeStyle = RC.trim; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-2, -40); ctx.lineTo(1, -32); ctx.lineTo(4, -40); ctx.moveTo(7.5, -40); ctx.lineTo(7.5, -32); ctx.stroke();
    // the lantern
    const lampHot = e.state === 'atk' && e.atk === T.lightwall ? 1 : 0;
    ctx.beginPath(); ctx.arc(4, -6, 8.5, 0, TAU); fillInk(ctx, '#1a1f24', 1.2);
    ctx.strokeStyle = RC.trim; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(4, -6, 8.5, 0, TAU); ctx.stroke();
    lighter(ctx, () => {
      const lc = p2 > 0.5 ? '#ff5d7e' : TEAL;
      glow(ctx, 4, -6, 18 + lampHot * 22 + Math.sin(t * 3) * 2, lc, broken ? 0.2 : 0.6 + lampHot * 0.35);
      ctx.fillStyle = U.rgba(lc, broken ? 0.4 : 0.95); ctx.beginPath(); ctx.ellipse(4, -6, 3.2, 4.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(4.6, -7.4, 1.4, 0, TAU); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(11,6,18,0.8)'; ctx.lineWidth = 0.8; ctx.beginPath(); for (const a of [0, PI / 2, PI, PI * 1.5]) { ctx.moveTo(4 + Math.cos(a) * 3, -6 + Math.sin(a) * 3); ctx.lineTo(4 + Math.cos(a) * 8.5, -6 + Math.sin(a) * 8.5); } ctx.stroke();
    if (p2 > 0) { ctx.save(); ctx.globalAlpha *= p2; crystalCluster(ctx, 17, -40, -0.6, 0.8, 0.3, CRIM, '#ffc2d0', t); crystalCluster(ctx, -8, 36, 2.4, 0.6, 0.2, CRIM, '#ffc2d0', t); ctx.restore(); }
    if (jolt > 0) lighter(ctx, () => glow(ctx, 10, -4, 40, '#ffffff', jolt * 0.6));
    ctx.restore();
    // lance (vamplate cone + long tapered shaft); phase II grows crimson blades along it
    const d = { x: Math.sin(J.sw), y: Math.cos(J.sw) }, n = { x: -d.y, y: d.x };
    const at = (k, w) => [J.hdF.x + d.x * k + n.x * w, J.hdF.y + d.y * k + n.y * w];
    LB(ctx, J.lbut, J.hdF, 2.6, 2.8, '#2d2a28', { noHatch: true });
    pth(ctx, [at(8, 2.8), at(LANCE, 0), at(8, -2.8)]); fillInk(ctx, lit(ctx, ...at(50, 0), 4, '#c4ccd2'), 1.2);
    ctx.strokeStyle = U.rgba(acc, 0.8); ctx.lineWidth = 1.2; ctx.beginPath(); for (const k of [30, 60]) { const a = at(k, 2.3), b = at(k, -2.3); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
    pth(ctx, [at(2, 9.5), at(16, 3), at(16, -3), at(2, -9.5), at(-1, -6), at(-1, 6)]); fillInk(ctx, lit(ctx, ...at(8, 0), 9, '#9aa6ae'), 1.3);   // vamplate
    ctx.strokeStyle = RC.trim; ctx.lineWidth = 1.2; ctx.beginPath(); { const a = at(2, 9.5), b = at(2, -9.5); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
    if (p2 > 0) {
      ctx.save(); ctx.globalAlpha *= p2;
      for (const [k, s] of [[40, 1], [62, -1], [84, 1], [100, -1]]) { const b = at(k, s * 1.5); spike(ctx, b[0], b[1], Math.atan2(d.y, d.x) + s * 0.55, 13 - k * 0.05, 2.2, CRIM, '#ffc2d0'); }
      lighter(ctx, () => seg(ctx, ...at(20, 0), ...at(LANCE, 0), U.rgba(CRIM, 0.45), 2.4));
      ctx.restore();
    }
    // front arm: big layered pauldron, vambrace, gauntlet
    LC(ctx, [J.sh, lerpP(J.sh, J.elF, 0.5), J.elF, J.hdF], [5.2, 4.8, 4.0, 3.4], RC.steelB, { spec: 0.2 });
    LB(ctx, lerpP(J.elF, J.hdF, 0.1), lerpP(J.elF, J.hdF, 0.85), 4.6, 3.9, RC.plate, { spec: 0.45 });
    for (let i = 2; i >= 0; i--) {
      const y0 = J.sh.y - 4 + i * 4.2;
      blob(ctx, [[J.sh.x - 9 + i, y0 - 2], [J.sh.x - 1, y0 - 6 + i], [J.sh.x + 9 - i, y0 - 2], [J.sh.x + 8 - i, y0 + 4], [J.sh.x - 8 + i, y0 + 4]]);
      fillInk(ctx, lit(ctx, J.sh.x, y0, 9, i === 0 ? '#a4b0b8' : RC.plate), 1.1);
    }
    ctx.strokeStyle = RC.trim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(J.sh.x - 8, J.sh.y - 6.5); ctx.quadraticCurveTo(J.sh.x - 1, J.sh.y - 10.5, J.sh.x + 8, J.sh.y - 6.5); ctx.stroke();
    if (p2 > 0) { ctx.save(); ctx.globalAlpha *= p2; crystalCluster(ctx, J.sh.x - 2, J.sh.y - 8, -1.8, 0.85, 0.45, CRIM, '#ffc2d0', t); ctx.restore(); }
    ctx.beginPath(); ctx.arc(J.hdF.x, J.hdF.y, 3.8, 0, TAU); fillInk(ctx, lit(ctx, J.hdF.x, J.hdF.y, 4, '#6c7880'), 1);
    // tell flare
    const shieldAtk = e.atk === T.charge || e.atk === T.lightwall || (e.atk === T.bashsweep && e.st < 0.8);
    const tp = shieldAtk ? J.shc : J.ltip;
    tellGlow(ctx, tp.x, tp.y, e, 30);
    hitFlash(ctx, e, () => { ctx.beginPath(); ctx.ellipse(J.hip.x, J.hip.y - 28, 22, 62, 0, 0, TAU); ctx.fill(); });
  }

  /* =========================== relic: 守夜者徽章 =========================== */
  G.Relics = G.Relics || {};
  G.Relics.c6_badge = { apply(P) { P.maxSta += 25; P.rallyMul += 0.5; } };
  D.relics = D.relics || {};
  if (!D.relics.c6_badge) D.relics.c6_badge = { name: '守夜者徽章', desc: '最大耐力 +25；格擋後反擊取回的可回復生命 +50%' };

  /* =========================== barks / speakers used by these foes =========================== */
  D.barks = D.barks || {}; D.speakers = D.speakers || {};
  if (!D.speakers.c6_rook) D.speakers.c6_rook = { name: '洛克', en: 'ROOK', color: '#7dffcf' };
  const BK = {
    c6_shieldHint: { who: 'ode', text: '……那面盾，沒有縫。' },
    c6_hushedWake: { who: 'ode', text: '……他醒了。是聲音。' },
    c6_hushedSleep: { who: 'ode', text: '……又睡了。' },
    c6_hushedKilled: { who: 'ode', text: '……那是乘客。我會記得。' },
    c6_eliteP2: { who: 'c6_rook', text: '……還有人在睡。我不能倒下。' },
  };
  for (const k in BK) if (!D.barks[k]) D.barks[k] = BK[k];

  /* =========================== codex: 寂裔 =========================== */
  const CODEX = [
    { id: 'c6_warden', name: '渡船守衛', en: 'FERRY WARDEN', portrait: 'c6_warden', unlock: 'seen_c6_warden', tag: '寂裔｜中階・人型・持盾',
      body: [
        '渡魂船的守衛。門關上那天，他們奉命守住艙道——至今仍在執勤，只是再也分不清誰是要保護的人。頭盔裡反覆傳出同一句：「請保持安靜，原地等候渡河。」',
        '攻擊模式：短棍三連擊（白光，可格擋）／盾牌衝撞（紅光，無法格擋，必須閃避）／正面連續被擋下三次攻擊後，會以盾牌反推（白光）。',
        '弱點：站定時正面攻擊會被盾牌彈開。繞到背後、用重擊撞開盾牌，或趁衝撞落空的空檔反擊。',
      ] },
    { id: 'c6_hushed', name: '沉睡的亡者', en: 'THE HUSHED', portrait: 'c6_hushed', unlock: 'seen_c6_hushed', tag: '寂裔？｜渡船乘客・長眠',
      body: [
        '渡魂船上的乘客之一。船心讓他們睡在走到一半的那一步——提著菜籃的、澆花的、趕著上船的、正要回頭說再見的。結晶從他們腳下長出來，像一道遲來的影子。',
        '他們聽得見。靠近時奔跑、揮劍或翻滾都可能把人吵醒（頭上浮現聲波時就是警告）；醒來的亡者會緩慢地抓人、捶打（白光，可格擋）。',
        '觀察：保持安靜一段時間，他們會重新睡去。殺死他們不會有人責怪妳。但寧舒會記得。',
      ] },
    { id: 'c6_tuner', name: '調律者', en: 'THE TUNER', portrait: 'c6_tuner', unlock: 'seen_c6_tuner', tag: '寂裔｜懸吊・調弦架',
      body: [
        '掛在船艙頂軌上的調弦架，外形像一把巨大的琴頭，原本替整艘船的龍骨調音，好讓渡歌傳到每一層船艙。如今它只調一個音：休止。',
        '攻擊模式：地面掃射光束（紅光，虛線標出路徑，用翻滾穿過）／三連調音波（白光，完美格擋可反彈）／站在它正下方時，音叉會砸下來（白光）。',
        '弱點：光束掃射後必須重新校準，會降到劍能觸及的高度。反彈回去的調音波也能擊中它。',
      ] },
    { id: 'c6_seraph', name: '寂翼', en: 'HUSH SERAPH', portrait: 'c6_seraph', unlock: 'seen_c6_seraph', tag: '寂裔｜飛行・刃翼',
      body: [
        '渡歌中庭的天使像。從前每次開船，它們會展翅領航，船上的孩子會數它們的羽毛。門關上之後，它們的羽毛變成了刀。',
        '攻擊模式：俯衝斬（紅光，無法格擋，翻滾閃避）／羽刃齊射（白光，完美格擋可將羽刃彈回）／靠得太近時會降下來以雙翼剪斬（白光）。',
        '弱點：俯衝落空後會在地面停留片刻——那是砍它的時候。',
      ] },
    { id: 'c6_elite', name: '船衛・洛克', en: 'ROOK, THE LAST SENTRY', portrait: 'c6_elite', unlock: 'seen_c6_elite', tag: '菁英｜渡魂船船衛長',
      body: [
        '渡魂船的船衛長。門關上之後，船衛們一個接一個睡去。只有洛克沒有閉眼。他站在沉睡的亡者之間，提著燈，守了十八年的夜。',
        '攻擊模式：長槍三連刺（白光）／高舉長槍、停頓、假動作後才落下的下劈（白光）／盾擊接貼地掃槍（白光→紅光，掃槍可以跳過）／盾牌衝鋒（紅光）。',
        '第二階段：守夜燈轉紅，盾上的燈會沿地面放出光牆（白光，完美格擋可削減架勢），並加入四連刺接紅光突進。',
        '弱點：他只在站定時舉盾。等他出手，在收招的空檔反擊；重擊能把盾撞開。',
      ] },
  ];
  D.codex = D.codex || {}; D.codex.hushborn = D.codex.hushborn || []; D.codex.items = D.codex.items || [];
  for (const c of CODEX) if (!D.codex.hushborn.some((q) => q.id === c.id)) D.codex.hushborn.push(c);
  if (!D.codex.items.some((q) => q.id === 'c6_badge')) D.codex.items.push({
    id: 'c6_badge', name: '守夜者徽章', en: "SENTRY'S BADGE", unlock: 'relic_c6_badge', relic: true,
    body: ['洛克胸前的船衛徽章。背面密密麻麻，刻滿細小的刻痕——每守過一夜，他就刻一道。', '最後一道只刻了一半。', '遺物效果：最大耐力 +25；格擋後以攻擊取回的可回復生命 +50%。'],
  });
})(window.G);

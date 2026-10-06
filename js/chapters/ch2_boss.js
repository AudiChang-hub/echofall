'use strict';
/* ECHOFALL — Chapter II boss: 守鐘尼・卡菈 KARA, THE GATE-BELL NUN (docs/STORY_V3.md §3 II)
   The first gate's keeper, fused into the gate bell (it hangs as the coffin line's counterweight): a towering nun whose skirt IS the bell,
   still hanging from the station's chains. She has no tongue; the bell sings for her.
   Phase 1  鐘擺橫掃 pendulum sweep (white, white) · 裙擺重擊 skirt slam (red → frost quake-waves along the floor, jump them)
            鎖鏈鞭笞 chain lash (white, long reach — step inside it and the chain whips over your head)
   Phase 2  the bell cracks, the gag plate falls, she sings without a voice:
            summons two Knell Monks (once) · 連續鳴鐘 toll combo (white ×3 → red slam) · 冰凌墜落 icicle rain (red, arena-wide,
            two interleaved volleys: step into where the last ones fell) · 共鳴環 resonance rings (white; a perfect guard
            cracks her balance) · 三連擺 triple pendulum (white, white, red) · 回鞭 double lash.
   Every heavy move ends with the bell lodged in the snow for ~1–1.5 s: that is the opening. */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK;
  const ICE = '#8fe9ff', ROSE = '#ff6fae', CRIM = K.CRIM, FROST = '#eef7ff', FROSTS = '#9fbde6';
  const BRONZE = '#8a5a34', BRONZE_L = '#d39a58', HABIT = '#2b2638', HABIT_D = '#17131f', SKIN = '#dcd0d8', LINEN = '#ece6dc';
  const BH = 196, LIPW = 144;                       // bell: waist pivot → lip, half-width at the lip
  const PROF = [[0, 47], [12, 55], [36, 59], [72, 63], [106, 70], [134, 82], [156, 98], [172, 116], [184, 132], [192, 142], [196, 144]];
  const UA = 60, FA = 54, LC = 400;                 // upper arm, forearm, lash chain length
  const LASH_A0 = -0.85, LASH_A1 = 0.72;            // lash sweep: from up-forward to down-forward (tip meets the floor ≈ 425 out)
  const LOWQ = () => G.Quality && G.Quality.low;
  const HAB_R = { hi: '#8a7fa6', lit: '#3d3652', base: HABIT, dark: '#1a1424', bounce: '#3a3a5e' };
  const HAB_RB = { hi: '#6a6188', lit: '#2c2640', base: '#211c2c', dark: '#140f1c', bounce: '#2c2c48' };

  /* ------------------------------------------------------------------ pose system ------------------------------- */
  // sw: bell swing (+ = lip forward) · lift: hoisted by her chains · lean/head: torso + head tilt · aF/eF/aB/eB: arms
  // (angle from straight down, + toward facing) · coil/ext/lash: front chain whirl, extension, sweep progress ·
  // raise: hands grip the station chains · sing: mouth/eyes · glow: bell's inner light · squash: impact squash · shake
  const BASE = { sw: 0, lift: 0, lean: 0.12, head: 0.3, aF: 0.3, eF: 1.85, aB: 0.2, eB: 1.95, coil: 0, ext: 0, lash: 0, raise: 0, sing: 0, glow: 0.25, squash: 0, shake: 0 };
  const PK = Object.keys(BASE);
  const full = (p) => { const o = {}; for (const k of PK) o[k] = p[k] ?? BASE[k]; return o; };
  const lerpPose = (a, b, k) => { const o = {}; for (const q of PK) o[q] = a[q] + (b[q] - a[q]) * k; return o; };
  const EASE = { lin: (t) => t, io: U.easeInOutSine, out: U.easeOutCubic, snap: (t) => 1 - Math.pow(1 - t, 4), in: U.easeInCubic };
  function sample(keys, t) {
    if (t <= keys[0][0]) return full(keys[0][1]);
    for (let i = 1; i < keys.length; i++) {
      const k1 = keys[i];
      if (t <= k1[0]) { const k0 = keys[i - 1]; return lerpPose(full(k0[1]), full(k1[1]), EASE[k1[2] || 'io'](U.clamp((t - k0[0]) / Math.max(1e-4, k1[0] - k0[0]), 0, 1))); }
    }
    return full(keys[keys.length - 1][1]);
  }
  const idle = (t) => ({ sw: Math.sin(t * 1.1) * 0.035, lean: 0.12 + Math.sin(t * 1.4) * 0.025, head: 0.3 + Math.sin(t * 0.9) * 0.05, aF: 0.3 + Math.sin(t * 1.4 + 1) * 0.04, eF: 1.85, aB: 0.2, eB: 1.95, glow: 0.25 + Math.sin(t * 2) * 0.1 });
  const I0 = idle(0);
  const CP = {
    ready: { sw: -0.06, lean: 0.05, head: 0.15, aF: 0.0, eF: 0.6, aB: -0.4, eB: 0.6, glow: 0.4 },
    back: { sw: -0.3, lean: -0.16, head: 0.0, aF: -0.9, eF: 0.5, aB: -1.2, eB: 0.4, glow: 0.6 },
    swing: { sw: 0.26, lean: 0.46, head: 0.38, aF: 1.6, eF: 0.15, aB: 1.1, eB: 0.2, glow: 0.8 },
    follow: { sw: 0.18, lean: 0.36, head: 0.34, aF: 1.3, eF: 0.25, aB: 0.8, eB: 0.35, glow: 0.6 },
    back2: { sw: -0.34, lean: -0.2, head: -0.05, aF: -1.0, eF: 0.5, aB: -1.3, eB: 0.4, glow: 0.8 },
    swing2: { sw: 0.3, lean: 0.52, head: 0.42, aF: 1.75, eF: 0.1, aB: 1.25, eB: 0.2, glow: 1 },
    over: { sw: 0.34, lean: 0.55, head: 0.5, aF: 1.4, eF: 0.2, aB: 0.9, eB: 0.3, glow: 0.6 },
    wob: { sw: -0.1, lean: 0.2, head: 0.42, aF: 0.6, eF: 0.5, aB: 0.3, eB: 0.7, glow: 0.4 },
    back3: { sw: -0.38, lift: 46, lean: -0.24, head: -0.15, aF: 2.75, eF: 0.25, aB: -2.6, eB: -0.3, glow: 1, raise: 1 },
    swing3: { sw: 0.4, lift: 8, lean: 0.56, head: 0.45, aF: 1.9, eF: 0.1, aB: 1.5, eB: 0.2, glow: 1 },
    crouch: { sw: 0.04, lean: 0.34, head: 0.45, aF: 0.9, eF: 0.9, aB: 0.6, eB: 1.0, glow: 0.6, squash: 1 },
    rise: { lift: 130, sw: -0.1, lean: -0.18, head: -0.12, aF: 2.75, eF: 0.25, aB: -2.6, eB: -0.3, glow: 1, raise: 1 },
    peak: { lift: 150, sw: -0.04, lean: -0.08, head: 0.05, aF: 2.85, eF: 0.15, aB: -2.7, eB: -0.2, glow: 1, raise: 1, shake: 1 },
    slam: { lift: 0, sw: 0, lean: 0.55, head: 0.55, aF: 1.1, eF: 0.2, aB: 0.7, eB: 0.3, glow: 1, squash: 1 },
    lodged: { sw: 0.05, lean: 0.62, head: 0.72, aF: 0.5, eF: 0.25, aB: 0.3, eB: 0.35, glow: 0.4 },
    lodged2: { sw: 0.02, lean: 0.42, head: 0.55, aF: 0.45, eF: 0.7, aB: 0.3, eB: 0.8, glow: 0.3 },
    coilA: { lean: 0.02, head: 0.05, aF: 2.6, eF: 0.45, aB: -0.5, eB: 0.6, coil: 1, glow: 0.4 },
    coilB: { lean: -0.1, head: 0.0, aF: 2.9, eF: 0.3, aB: -0.8, eB: 0.5, coil: 1, glow: 0.5 },
    crackA: { lean: 0.15, head: 0.15, aF: 2.0, eF: 0.05, aB: -0.6, eB: 0.5, ext: 1, lash: 0.1 },
    crackM: { lean: 0.34, head: 0.25, aF: 1.55, eF: 0.0, aB: -0.4, eB: 0.5, ext: 1, lash: 0.78, sw: 0.04 },
    crackB: { lean: 0.42, head: 0.3, aF: 1.35, eF: 0.0, aB: -0.3, eB: 0.5, ext: 1, lash: 1, sw: 0.06 },
    pull: { lean: 0.22, head: 0.3, aF: 0.9, eF: 0.8, aB: 0.1, eB: 0.8, ext: 0, lash: 1 },
    lowA: { lean: 0.3, head: 0.3, aF: 1.05, eF: 0.1, aB: -0.2, eB: 0.6, ext: 1, lash: 1 },
    upB: { lean: -0.06, head: 0.0, aF: 2.3, eF: 0.1, aB: -0.7, eB: 0.5, ext: 1, lash: 0 },
    upB2: { lean: -0.1, head: 0.05, aF: 2.45, eF: 0.2, aB: -0.6, eB: 0.5, ext: 0.7, lash: -0.15 },
    yank: { sw: -0.12, lean: -0.12, head: -0.15, aF: 2.8, eF: 0.2, aB: -2.7, eB: -0.25, raise: 1, glow: 0.6 },
    toll: { sw: 0.2, lean: 0.22, head: 0.22, aF: 2.35, eF: 0.6, aB: -2.4, eB: -0.6, raise: 1, glow: 1 },
    pray: { lean: 0.0, head: -0.22, aF: 1.25, eF: 1.7, aB: 1.05, eB: 1.8, sing: 1, glow: 1 },
    pray2: { lean: -0.05, head: -0.32, aF: 1.3, eF: 1.65, aB: 1.1, eB: 1.75, sing: 1, glow: 1 },
    yankUp: { lean: -0.2, head: -0.35, aF: 3.0, eF: 0.1, aB: -2.85, eB: -0.12, raise: 1, glow: 0.8 },
    spread: { lean: -0.12, head: -0.3, aF: 2.2, eF: 0.4, aB: -2.0, eB: -0.4, sing: 1, glow: 1 },
    hang: { sw: 0.03, lean: 0.35, head: 0.95, aF: 0.12, eF: 0.1, aB: 0.05, eB: 0.1, glow: 0 },
  };
  const broken = (t) => ({ sw: 0.16, lean: 0.85 + Math.sin(t * 2) * 0.04, head: 0.95, aF: 0.35, eF: 0.15, aB: 0.2, eB: 0.2, glow: 0.1 + Math.sin(t * 5) * 0.05 });

  /* ------------------------------------------------------------------ geometry ---------------------------------- */
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const rot = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }; };
  const up = (a, l) => ({ x: Math.sin(a) * l, y: -Math.cos(a) * l });
  const down = (a, l) => ({ x: Math.sin(a) * l, y: Math.cos(a) * l });
  const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  function wAt(y) {
    if (y <= PROF[0][0]) return PROF[0][1];
    for (let i = 1; i < PROF.length; i++) if (y <= PROF[i][0]) { const a = PROF[i - 1], b = PROF[i]; return U.lerp(a[1], b[1], (y - a[0]) / (b[0] - a[0])); }
    return LIPW;
  }
  // joints in local coords (feet origin, +x = facing)
  function rigOf(p) {
    const th = -p.sw;
    const pen = LIPW * Math.abs(Math.sin(th)) + BH * Math.cos(th) - BH;  // the low rim would sink this far: lift instead
    const lift = p.lift + Math.max(0, pen) + (p.shake ? Math.sin(p.shake * 90) * 2 : 0);
    const W = { x: 0, y: -BH - lift };
    const ta = p.lean - p.sw * 0.4;
    const u = up(ta, 1), f = { x: Math.cos(ta), y: Math.sin(ta) };
    const TQ = (a, b) => ({ x: W.x + u.x * a + f.x * b, y: W.y + u.y * a + f.y * b });
    const chest = TQ(90, 0), neck = TQ(108, 2);
    const ha = ta * 0.5 + p.head;
    const head = add(neck, up(ta * 0.6 + p.head * 0.35, 25));
    const shF = TQ(94, 9), shB = TQ(96, -12);
    const elF = add(shF, down(p.aF, UA)), hdF = add(elF, down(p.aF + p.eF, FA));
    const elB = add(shB, down(p.aB, UA)), hdB = add(elB, down(p.aB + p.eB, FA));
    const B = (x, y) => add(W, rot({ x, y }, th));   // bell frame → local
    return { th, lift, W, ta, u, f, TQ, chest, neck, head, ha, shF, shB, elF, hdF, elB, hdB, B };
  }

  /* ------------------------------------------------------------------ painters ---------------------------------- */
  const seed = U.mulberry32(20722);
  const VERD = Array.from({ length: 10 }, () => ({ f: seed() * 1.7 - 0.85, y: 48 + seed() * 130, r: 5 + seed() * 12, s: 0.5 + seed() * 0.7, drip: seed() < 0.6 }));
  const GLYPH = Array.from({ length: 15 }, (_, i) => ({ f: -0.9 + i * 0.128 + (seed() - 0.5) * 0.03, o: seed() < 0.5 ? -2 : 2, stem: seed() < 0.7, beam: seed() < 0.3 }));
  const HEM = Array.from({ length: 12 }, () => seed());
  const CRACK1 = [[36, BH], [44, 178], [37, 162], [48, 146], [43, 130]];
  const CRACK2 = [[-18, BH + 2], [-8, 172], [-22, 146], [-6, 114], [-17, 86], [2, 58], [-7, 32], [5, 10]];
  const BRANCH = [[[-22, 146], [-46, 132], [-60, 112]], [[-6, 114], [22, 102], [32, 84]], [[-17, 86], [-38, 76]]];

  function bellPath(ctx) {
    const n = PROF.length;
    ctx.beginPath(); ctx.moveTo(-PROF[0][1], PROF[0][0]);
    for (let i = 1; i < n; i++) { const a = PROF[i - 1], b = PROF[i]; ctx.quadraticCurveTo(-a[1], a[0], -(a[1] + b[1]) / 2, (a[0] + b[0]) / 2); }
    ctx.lineTo(-LIPW, BH); ctx.quadraticCurveTo(0, BH + 5, LIPW, BH);
    for (let i = n - 1; i > 0; i--) { const a = PROF[i], b = PROF[i - 1]; ctx.quadraticCurveTo(a[1], a[0], (a[1] + b[1]) / 2, (a[0] + b[0]) / 2); }
    ctx.lineTo(PROF[0][1], PROF[0][0]);
    ctx.bezierCurveTo(PROF[0][1] - 4, -16, -PROF[0][1] + 4, -16, -PROF[0][1], PROF[0][0]);
    ctx.closePath();
  }
  // a band wrapping the bell (curves down in the middle: we look at it slightly from above)
  function bandLine(ctx, y, sag) { const w = wAt(y); ctx.moveTo(-w - 2, y); ctx.quadraticCurveTo(0, y + sag, w + 2, y); }
  // vertical stripe that follows the bell profile at fraction f0..f1 of the half-width
  function stripe(ctx, f0, f1, y0, y1) {
    ctx.beginPath();
    for (let y = y0; y <= y1; y += 14) ctx.lineTo(f0 * wAt(y), y);
    ctx.lineTo(f0 * wAt(y1), y1);
    for (let y = y1; y >= y0; y -= 14) ctx.lineTo(f1 * wAt(y), y);
    ctx.lineTo(f1 * wAt(y0), y0); ctx.closePath();
  }
  function polyline(ctx, pts, n) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < (n ?? pts.length); i++) ctx.lineTo(pts[i][0], pts[i][1]); }
  function crystal(ctx, x, y, a, l, w) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w * 0.7, -l * 0.7); ctx.lineTo(0, -l); ctx.lineTo(w * 0.8, -l * 0.62); ctx.lineTo(w, 0); ctx.closePath();
    ctx.fillStyle = '#bff3ff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -l); ctx.lineTo(w * 0.8, -l * 0.62); ctx.lineTo(w, 0); ctx.closePath(); ctx.fillStyle = '#5fa8d8'; ctx.fill();
    ctx.strokeStyle = ROSE; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-w * 0.3, -2); ctx.lineTo(-w * 0.15, -l * 0.55); ctx.lineTo(w * 0.2, -l * 0.8); ctx.stroke();
    ctx.restore();
  }
  // a chain drawn as links: ink, steel, alternating dark link holes
  function links(ctx, pts, w, col, dash) {
    if (pts.length < 2) return;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = w + 2.8; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    ctx.setLineDash([dash, dash]); ctx.strokeStyle = 'rgba(11,6,18,0.8)'; ctx.lineWidth = w * 0.42; ctx.stroke();
    ctx.setLineDash([dash * 0.35, dash * 1.65]); ctx.lineDashOffset = -dash * 0.3; ctx.strokeStyle = 'rgba(235,245,255,0.55)'; ctx.lineWidth = w * 0.3; ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
  // ragged cloth along a chain (K.tattered with our own cloth ramp)
  function rag(ctx, pts, w0, w1, RMP, inner, sd) {
    const n = pts.length, Lp = [], Rp = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = U.lerp(w0, w1, i / (n - 1));
      Lp.push({ x: pts[i].x - dy / d * w, y: pts[i].y + dx / d * w }); Rp.push({ x: pts[i].x + dy / d * w, y: pts[i].y - dx / d * w });
    }
    const tip = pts[n - 1], prev = pts[n - 2], ex = tip.x - prev.x, ey = tip.y - prev.y, el = Math.hypot(ex, ey) || 1;
    ctx.beginPath(); ctx.moveTo(Lp[0].x, Lp[0].y);
    for (let i = 1; i < n; i++) { const m = lerpP(Lp[i - 1], Lp[i], 0.5); ctx.quadraticCurveTo(Lp[i - 1].x, Lp[i - 1].y, m.x, m.y); }
    for (let k = 0; k <= 6; k++) { const q = lerpP(Lp[n - 1], Rp[n - 1], k / 6), j = (k % 2 ? 10 : -3) + ((sd * 7 + k * 3) % 5) * 1.5; ctx.lineTo(q.x + ex / el * j, q.y + ey / el * j); }
    for (let i = n - 1; i > 0; i--) { const m = lerpP(Rp[i], Rp[i - 1], 0.5); ctx.quadraticCurveTo(Rp[i].x, Rp[i].y, m.x, m.y); }
    ctx.lineTo(Rp[0].x, Rp[0].y); ctx.closePath();
    const mid = pts[n >> 1];
    ctx.fillStyle = Rig.celGrad(ctx, mid.x, mid.y, 1, 0, Math.max(w0, w1) + 6, Rig.lightDir(ctx).x >= 0 ? 1 : -1, RMP); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 1;
    for (const k of [0.3, 0.65]) { ctx.beginPath(); for (let i = 1; i < n; i++) { const q = lerpP(Lp[i], Rp[i], k); i === 1 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); } ctx.stroke(); }
    void inner;
  }
  function flatLimb(ctx, a, b, w1, w2, col, hi) {
    Rig.limb(ctx, a, b, w1, w2, null);
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    if (hi) { ctx.strokeStyle = hi; ctx.lineWidth = 0.9; ctx.beginPath(); const m = lerpP(a, b, 0.2), n = lerpP(a, b, 0.75); ctx.moveTo(m.x + 0.8, m.y - w1 * 0.45); ctx.lineTo(n.x + 0.8, n.y - w2 * 0.45); ctx.stroke(); }
  }

  function drawBell(ctx, e, R, p, ck, t) {
    const lq = LOWQ();
    ctx.save(); ctx.translate(R.W.x, R.W.y); ctx.rotate(R.th);
    if (p.squash > 0.01) { const s = p.squash; ctx.translate(0, BH); ctx.scale(1 + s * 0.05, 1 - s * 0.07); ctx.translate(0, -BH); }
    const s = Rig.lightDir(ctx).x >= 0 ? 1 : -1;
    // the Hush crystal that replaced her clapper: hangs out under the lip when she's hoisted
    if (R.lift > 8) {
      const k = U.clamp((R.lift - 8) / 70, 0, 1);
      crystal(ctx, -6, BH + 26 * k, PI + 0.08, 46 * k + 10, 9);
      crystal(ctx, 10, BH + 14 * k, PI - 0.25, 28 * k + 8, 6);
    }
    bellPath(ctx);
    ctx.fillStyle = '#40222c'; ctx.fill();
    ctx.save(); ctx.clip();
    // bronze as a surface of revolution: hard cel stripes that follow the profile (shadow → mid → lit, with a dark
    // reflection band and a hot specular — that is what makes it read as metal, not paint)
    for (const [u0, u1, c] of [[-1, -0.9, '#3a4e5c'], [-0.3, 0.2, '#5c3828'], [0.2, 1, '#94643c'], [0.4, 0.54, '#55331f'], [0.78, 0.86, '#efcb8e'], [0.95, 1, '#c99358']]) {
      ctx.fillStyle = c; stripe(ctx, s * u0, s * u1, -20, BH + 8); ctx.fill();
    }
    ctx.fillStyle = 'rgba(30,8,30,0.38)'; ctx.fillRect(-LIPW - 4, -24, LIPW * 2 + 8, 52);
    ctx.fillStyle = 'rgba(30,8,30,0.22)'; ctx.fillRect(-LIPW - 4, 28, LIPW * 2 + 8, 22);
    ctx.fillStyle = 'rgba(176,214,244,0.2)'; ctx.fillRect(-LIPW - 4, 186, LIPW * 2 + 8, 24);   // snow bounce on the sound-bow
    // inscription band: a staff of notes running round the bell (Calla's hymn, engraved)
    ctx.fillStyle = 'rgba(255,214,160,0.14)'; ctx.beginPath(); bandLine(ctx, 50, 8); { const w = wAt(66); ctx.lineTo(w + 2, 66); ctx.quadraticCurveTo(0, 74, -w - 2, 66); } ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(11,6,18,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); bandLine(ctx, 50, 8); bandLine(ctx, 66, 8); ctx.stroke();
    ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(11,6,18,0.45)'; ctx.beginPath(); for (const y of [54, 58, 62]) bandLine(ctx, y, 8); ctx.stroke();
    ctx.fillStyle = 'rgba(30,10,24,0.8)'; ctx.strokeStyle = 'rgba(30,10,24,0.8)'; ctx.lineWidth = 0.8;
    for (const g of GLYPH) {
      const w = wAt(58), x = g.f * w, y = 58 + g.o + (1 - g.f * g.f) * 8;
      ctx.beginPath(); ctx.ellipse(x, y, 2.3, 1.6, -0.4, 0, TAU); ctx.fill();
      if (g.stem) { ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 2, y - 7); if (g.beam) ctx.lineTo(x + 9, y - 7.5); ctx.stroke(); }
    }
    // lower bands
    ctx.strokeStyle = 'rgba(11,6,18,0.75)'; ctx.lineWidth = 1.3; ctx.beginPath(); bandLine(ctx, 132, 10); bandLine(ctx, 140, 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,226,180,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); bandLine(ctx, 134.5, 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(11,6,18,0.85)'; ctx.lineWidth = 1.8; ctx.beginPath(); bandLine(ctx, 178, 12); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,226,180,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); bandLine(ctx, 181, 12); ctx.stroke();
    // verdigris: a wash under each ledge and green streaks weeping down the metal
    if (!lq) {
      ctx.fillStyle = 'rgba(79,160,140,0.32)';
      for (const [y, sag] of [[66, 8], [140, 10]]) { ctx.beginPath(); bandLine(ctx, y, sag); const w = wAt(y + 9); ctx.lineTo(w, y + 9); ctx.quadraticCurveTo(0, y + 9 + sag + 3, -w, y + 9); ctx.closePath(); ctx.fill(); }
      ctx.lineCap = 'round';
      for (const v of VERD) {
        const yl = v.y < 110 ? 67 : 141, w = wAt(yl), fx = v.f, x = fx * w, y = yl + (1 - fx * fx) * 9;
        ctx.strokeStyle = 'rgba(79,160,140,0.5)'; ctx.lineWidth = 1.2 + v.s * 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 1, y + v.r, x + 0.5, y + 10 + v.r * 2.6); ctx.stroke();
      }
    }
    // hairline crack (always) and the great crack of the second movement
    ctx.strokeStyle = 'rgba(16,6,16,0.85)'; ctx.lineWidth = 1.3; polyline(ctx, CRACK1); ctx.stroke();
    if (ck > 0) {
      const n = Math.max(2, Math.ceil(CRACK2.length * Math.min(1, ck * 1.6)));
      ctx.strokeStyle = '#140812'; ctx.lineWidth = 6 * ck; ctx.lineJoin = 'miter'; polyline(ctx, CRACK2, n); ctx.stroke();
      ctx.lineWidth = 3 * ck; for (const b of BRANCH) { polyline(ctx, b); ctx.stroke(); }
      // the missing chunk at the lip
      if (ck > 0.4) { ctx.fillStyle = '#12060f'; ctx.beginPath(); ctx.moveTo(66, BH + 6); ctx.lineTo(72, 178); ctx.lineTo(88, 166); ctx.lineTo(97, 176); ctx.lineTo(106, 168); ctx.lineTo(114, BH + 6); ctx.closePath(); ctx.fill(); }
    }
    // inner light pulsing through the metal when she tolls
    const pulse = Math.max(e.pulse || 0, 0);
    if (pulse > 0.02) { ctx.fillStyle = U.rgba(ICE, pulse * 0.22); ctx.fillRect(-LIPW - 4, -20, LIPW * 2 + 8, BH + 30); }
    ctx.restore();
    bellPath(ctx); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    // rim highlight on the lip + snow resting on the band ledges
    ctx.strokeStyle = 'rgba(255,232,190,0.75)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(s * 20, BH - 2.5); ctx.quadraticCurveTo(s * 80, BH - 2, s * (LIPW - 6), BH - 3); ctx.stroke();
    ctx.fillStyle = FROST; ctx.strokeStyle = INK; ctx.lineWidth = 1;
    for (const [y, sag] of [[66, 8], [140, 10]]) {
      const w = wAt(y);
      ctx.beginPath(); ctx.moveTo(-w + 6, y); ctx.quadraticCurveTo(-w * 0.2, y + sag - 4.5, w * 0.35, y + sag * 0.6 - 3.5); ctx.quadraticCurveTo(w * 0.7, y - 2, w - 4, y - 1);
      ctx.quadraticCurveTo(w * 0.4, y + sag * 0.8, -w * 0.1, y + sag + 0.5); ctx.quadraticCurveTo(-w * 0.6, y + 3, -w + 6, y); ctx.fill(); ctx.stroke();
      // icicles hanging off the ledge
      for (let i = 0; i < 6; i++) {
        const fx = -0.7 + i * 0.27 + (i % 2) * 0.05, x = fx * w, yy = y + (1 - fx * fx) * sag + 0.5, l = 5 + ((i * 7) % 5) * 1.6;
        ctx.beginPath(); ctx.moveTo(x - 2, yy); ctx.lineTo(x + 0.3, yy + l); ctx.lineTo(x + 2, yy); ctx.closePath(); ctx.fillStyle = '#d6efff'; ctx.fill(); ctx.lineWidth = 0.7; ctx.stroke();
      }
      ctx.fillStyle = FROST; ctx.lineWidth = 1;
    }
    // the Hush crystal grown through the bell's hymn band: her heart, and the accent you track across the arena
    {
      const hx = s * 0.34 * wAt(58), hy = 60;
      crystal(ctx, hx - 4, hy + 6, -0.35, 22, 6); crystal(ctx, hx + 5, hy + 6, 0.3, 30, 7.5); crystal(ctx, hx + 13, hy + 7, 0.75, 16, 4.5);
      e.heart = { x: hx + 4, y: hy - 6 };
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx + 4, hy - 8, 30 + p.glow * 16, ck > 0 ? ROSE : ICE, 0.35 + p.glow * 0.3 + (e.pulse || 0) * 0.3); ctx.restore();
    }
    // crystals forcing their way out of the great crack
    if (ck > 0.3) {
      const k = U.clamp((ck - 0.3) / 0.7, 0, 1);
      crystal(ctx, -20, 146, -1.2, 26 * k, 6); crystal(ctx, -8, 116, 0.9, 30 * k, 7); crystal(ctx, -16, 88, -0.8, 22 * k, 5); crystal(ctx, 90, 172, 0.25, 18 * k, 5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = U.rgba(ROSE, 0.75 * k); ctx.lineWidth = 2.4; polyline(ctx, CRACK2); ctx.stroke();
      ctx.strokeStyle = U.rgba('#ffffff', 0.85 * k); ctx.lineWidth = 0.9; polyline(ctx, CRACK2); ctx.stroke();
      ctx.restore();
    }
    // the habit spilling over the bell's crown, tattered
    const sw = Math.sin(t * 2.1) * 2.5;
    ctx.beginPath(); ctx.moveTo(-58, -6); ctx.bezierCurveTo(-44, -30, 44, -30, 58, -6); ctx.lineTo(68, 18);
    for (let i = 0; i <= 11; i++) { const x = 68 - i * (136 / 11), y = 28 + (i % 2 ? 24 : 6) + HEM[i] * 12 + Math.sin(t * 2.3 + i) * 1.8 + (i % 2 ? sw : 0); ctx.lineTo(x, y); }
    ctx.lineTo(-58, 12); ctx.closePath();
    ctx.fillStyle = Rig.celGrad(ctx, 0, 20, 1, 0, 70, s, HAB_R); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 1;
    for (let i = 1; i <= 11; i += 2) { const x = 68 - i * (136 / 11); ctx.beginPath(); ctx.moveTo(x * 0.6, -4); ctx.quadraticCurveTo(x * 0.9, 18, x, 28 + 24 + HEM[i] * 12 - 6); ctx.stroke(); }
    // snow caught in the folds
    ctx.fillStyle = FROST; ctx.strokeStyle = INK; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-50, -10); ctx.quadraticCurveTo(-30, -26, -6, -24); ctx.quadraticCurveTo(-20, -18, -28, -12); ctx.quadraticCurveTo(-40, -8, -50, -10); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, -23); ctx.quadraticCurveTo(40, -22, 54, -10); ctx.quadraticCurveTo(40, -14, 30, -15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawTorso(ctx, e, R, p, t) {
    const TQ = R.TQ, s = Rig.lightDir(ctx).x >= 0 ? 1 : -1;
    const pts = [TQ(-6, -30), TQ(30, -24), TQ(62, -28), TQ(86, -30), TQ(100, -24), TQ(110, -9), TQ(110, 12), TQ(98, 24), TQ(80, 27), TQ(58, 20), TQ(30, 22), TQ(-6, 30)];
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1], b = pts[i % pts.length]; ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    ctx.closePath();
    const c = TQ(55, 0);
    ctx.fillStyle = Rig.celGrad(ctx, c.x, c.y, R.f.x, R.f.y, 30, s, HAB_R); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    // folds
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 1;
    for (const [a0, b0, a1, b1] of [[8, -12, 60, -16], [4, 6, 54, 10], [20, 16, 70, 20]]) { const q0 = TQ(a0, b0), q1 = TQ(a1, b1); ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke(); }
    // cincture: a knotted cord at the waist, its tail hanging over the bell
    const k0 = TQ(10, -28), k1 = TQ(4, 30), tail = [TQ(6, 22), TQ(-16, 30), TQ(-40, 33), TQ(-62, 30 + Math.sin(t * 1.7) * 2)];
    ctx.strokeStyle = INK; ctx.lineWidth = 4.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(k0.x, k0.y); ctx.lineTo(k1.x, k1.y); ctx.moveTo(tail[0].x, tail[0].y); for (const q of tail) ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.strokeStyle = '#c8b58e'; ctx.lineWidth = 2.4; ctx.stroke(); ctx.beginPath(); ctx.moveTo(k0.x, k0.y); ctx.lineTo(k1.x, k1.y); ctx.stroke();
    ctx.fillStyle = '#c8b58e'; for (const q of tail.slice(1)) { ctx.beginPath(); ctx.arc(q.x, q.y, 2.6, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.stroke(); }
    // guimpe: the starched white bib
    const g = [TQ(111, -8), TQ(109, 16), TQ(97, 30), TQ(76, 31), TQ(64, 18), TQ(78, 2), TQ(92, -10), TQ(102, -16)];
    const gp = () => { ctx.beginPath(); ctx.moveTo((g[0].x + g[g.length - 1].x) / 2, (g[0].y + g[g.length - 1].y) / 2); for (let i = 0; i < g.length; i++) { const a = g[i], b = g[(i + 1) % g.length]; ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); } ctx.closePath(); };
    gp(); ctx.fillStyle = LINEN; ctx.fill();
    ctx.save(); ctx.clip(); const sh = TQ(82, -s * 22); ctx.fillStyle = '#a7aec8'; ctx.beginPath(); ctx.arc(sh.x, sh.y, 20, 0, TAU); ctx.fill(); const sh2 = TQ(66, 8); ctx.fillStyle = '#c9cbd8'; ctx.beginPath(); ctx.arc(sh2.x, sh2.y, 9, 0, TAU); ctx.fill(); ctx.restore();
    gp(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    // rosary of small bells
    const r0 = TQ(104, 16), r1 = TQ(58, 22), ctl = TQ(78, 34);
    ctx.fillStyle = '#2a1a22';
    for (let i = 0; i <= 9; i++) { const u = i / 9, x = (1 - u) * (1 - u) * r0.x + 2 * u * (1 - u) * ctl.x + u * u * r1.x, y = (1 - u) * (1 - u) * r0.y + 2 * u * (1 - u) * ctl.y + u * u * r1.y; ctx.beginPath(); ctx.arc(x, y, 1.9, 0, TAU); ctx.fill(); }
    const swing = Math.sin(t * 2.4) * 0.25 + p.sw * 0.8;
    ctx.save(); ctx.translate(r1.x, r1.y); ctx.rotate(swing);
    ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(-3.5, 9); ctx.quadraticCurveTo(-6, 13, -6.5, 14); ctx.lineTo(6.5, 14); ctx.quadraticCurveTo(6, 13, 3.5, 9); ctx.lineTo(1, 0); ctx.closePath();
    ctx.fillStyle = BRONZE_L; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  function drawHead(ctx, e, R, p, ck, t, ghost) {
    const lq = LOWQ();
    ctx.save(); ctx.translate(R.head.x, R.head.y); ctx.rotate(R.ha); ctx.scale(1.22, 1.22);
    // halo of frost behind the veil: a bronze ring with ice thorns (broken in the second movement)
    const hr = 31, hx = -6, hy = -6, rot0 = t * 0.25;
    if (!lq && !ghost) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, 58, ck > 0 ? ROSE : ICE, 0.22 + p.glow * 0.12); ctx.restore(); }
    const a0 = ck > 0 ? 0.5 : 0, a1 = ck > 0 ? TAU - 0.35 : TAU;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(hx, hy, hr, a0, a1); ctx.stroke();
    ctx.strokeStyle = BRONZE_L; ctx.lineWidth = 2.8; ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const a = rot0 + i * TAU / 9; if (ck > 0 && ((a % TAU) + TAU) % TAU < 0.5) continue;
      const l = i % 2 ? 9 : 14, c = Math.cos(a), sn = Math.sin(a);
      ctx.beginPath(); ctx.moveTo(hx + c * hr - sn * 2.6, hy + sn * hr + c * 2.6); ctx.lineTo(hx + c * (hr + l), hy + sn * (hr + l)); ctx.lineTo(hx + c * hr + sn * 2.6, hy + sn * hr - c * 2.6); ctx.closePath();
      ctx.fillStyle = ck > 0 && i % 3 === 0 ? '#ffc2dc' : '#dff4ff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    }
    // wimple: white linen framing the face, wrapping under the chin
    ctx.beginPath(); ctx.moveTo(10, -16); ctx.quadraticCurveTo(-4, -22, -12, -12); ctx.quadraticCurveTo(-18, 6, -10, 22); ctx.quadraticCurveTo(0, 30, 14, 24); ctx.quadraticCurveTo(20, 18, 17, 12); ctx.quadraticCurveTo(18, -6, 10, -16); ctx.closePath();
    ctx.fillStyle = LINEN; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = '#a7aec8'; ctx.beginPath(); ctx.moveTo(-10, 22); ctx.quadraticCurveTo(0, 30, 14, 24); ctx.quadraticCurveTo(4, 24, -4, 16); ctx.closePath(); ctx.fill();
    // face in profile
    ctx.beginPath(); ctx.moveTo(5, -12); ctx.quadraticCurveTo(13.5, -12.5, 14.2, -6); ctx.lineTo(17.6, 0.6); ctx.lineTo(14.8, 2); ctx.quadraticCurveTo(15.8, 5, 15, 7.6); ctx.quadraticCurveTo(14.6, 11.6, 10.6, 12.6); ctx.quadraticCurveTo(5, 13.4, 3, 7); ctx.lineTo(2.6, -8); ctx.closePath();
    ctx.fillStyle = SKIN; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#a693a8'; ctx.beginPath(); ctx.moveTo(3, -9); ctx.quadraticCurveTo(7, 0, 4, 12); ctx.quadraticCurveTo(2.5, 6, 2.6, -8); ctx.closePath(); ctx.fill();
    // eye: shut, frost on the lashes, a frozen tear (P1) — open and burning (P2)
    if (ck > 0.2) {
      ctx.fillStyle = '#eafcff'; ctx.beginPath(); ctx.ellipse(11.2, -4.2, 2.4, 1.4, -0.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8.4, -5.6); ctx.quadraticCurveTo(11.5, -7.2, 14, -5); ctx.stroke();
    } else {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(11.2, -5.4, 2.6, 0.25, PI - 0.25); ctx.stroke();
      ctx.fillStyle = '#ffffff'; for (const [x, y] of [[9.4, -2.6], [11.4, -2.2], [13.2, -2.9]]) { ctx.beginPath(); ctx.arc(x, y, 0.7, 0, TAU); ctx.fill(); }
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(8, -8.6); ctx.quadraticCurveTo(11.5, -10, 14.6, -8.4); ctx.stroke();
    // mouth: a riveted bronze gag-plate (she gave her tongue away) — gone in P2, the silent song shows
    if (ck < 0.5) {
      ctx.beginPath(); ctx.moveTo(10.2, 2.4); ctx.lineTo(17.4, 1.6); ctx.lineTo(18, 9.6); ctx.lineTo(11.4, 11.4); ctx.closePath();
      ctx.fillStyle = BRONZE; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = BRONZE_L; ctx.beginPath(); ctx.moveTo(10.6, 2.6); ctx.lineTo(17.3, 1.9); ctx.lineTo(17.5, 4.2); ctx.lineTo(11, 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe6b8'; for (const [x, y] of [[12, 4], [16.3, 3.6], [12.6, 9.6], [16.6, 8.8]]) { ctx.beginPath(); ctx.arc(x, y, 0.8, 0, TAU); ctx.fill(); }
    } else {
      const o = 1.5 + p.sing * 2.5 + Math.sin(t * 7) * 0.4 * p.sing;
      ctx.fillStyle = '#1a0610'; ctx.beginPath(); ctx.moveTo(13.6, 4); ctx.quadraticCurveTo(16.2, 4 + o * 0.3, 15.8, 4.5 + o); ctx.quadraticCurveTo(14.2, 5 + o, 13.4, 4.8 + o * 0.6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(140,40,70,0.9)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(15.6, 1.2); ctx.lineTo(17, 10); ctx.stroke(); // the scar the plate left
    }
    // veil: black hood over the wimple
    ctx.beginPath(); ctx.moveTo(14.5, -12.5); ctx.quadraticCurveTo(10, -24, -4, -24); ctx.quadraticCurveTo(-22, -22, -25, -4); ctx.quadraticCurveTo(-27, 16, -20, 30); ctx.lineTo(-9, 26); ctx.quadraticCurveTo(-12, 8, -8, -4); ctx.quadraticCurveTo(-1, -15, 14.5, -12.5); ctx.closePath();
    ctx.fillStyle = HABIT; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = '#4a4560'; ctx.beginPath(); ctx.moveTo(10, -21); ctx.quadraticCurveTo(-2, -26, -14, -18); ctx.quadraticCurveTo(-4, -21, 8, -18); ctx.closePath(); ctx.fill();
    // coif band where veil meets linen
    ctx.strokeStyle = LINEN; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(14, -12); ctx.quadraticCurveTo(0, -15, -7, -4); ctx.quadraticCurveTo(-10, 8, -8, 22); ctx.stroke();
    // snow on the hood
    ctx.fillStyle = FROST; ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(8, -21.5); ctx.quadraticCurveTo(-4, -28, -16, -20); ctx.quadraticCurveTo(-6, -22, 0, -21); ctx.quadraticCurveTo(4, -22, 8, -21.5); ctx.fill(); ctx.stroke();
    // glows: frozen tear / burning eye / the seam of the plate
    if (!ghost) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (ck > 0.2) { K.glow(ctx, 11.5, -4.2, 14, ROSE, 0.55 + p.sing * 0.3); }
      else { ctx.strokeStyle = U.rgba(ICE, 0.9); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(11.6, -1.6); ctx.quadraticCurveTo(12.2, 2, 11.2, 5.5); ctx.stroke(); }
      if (ck < 0.5) { ctx.strokeStyle = U.rgba(ICE, 0.75 + Math.sin(t * 3) * 0.2); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(11, 6.6); ctx.lineTo(17.6, 5.8); ctx.stroke(); }
      else if (p.sing > 0.1) { ctx.fillStyle = U.rgba(ROSE, 0.6 * p.sing); ctx.beginPath(); ctx.arc(14.6, 6, 2.2, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
  }

  // one arm: habit sleeve over the upper arm, a wide bell sleeve, a pale forearm, a bronze shackle with its chain
  function drawArm(ctx, sh, el, hd, a, e, back) {
    const s = Rig.lightDir(ctx).x >= 0 ? 1 : -1;
    const col = back ? '#211c2c' : HABIT;
    Rig.limbChain(ctx, [sh, el], [9, 7], col);
    const dx = hd.x - el.x, dy = hd.y - el.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    // forearm + hand (long, thin fingers)
    flatLimb(ctx, el, hd, 4.6, 3.6, back ? '#b4a6b4' : SKIN, back ? null : 'rgba(255,250,240,0.7)');
    const tip = { x: hd.x + ux * 13, y: hd.y + uy * 13 };
    flatLimb(ctx, hd, tip, 3.4, 1.4, back ? '#b4a6b4' : SKIN);
    // shackle
    const c0 = lerpP(el, hd, 0.72), c1 = lerpP(el, hd, 0.94);
    flatLimb(ctx, c0, c1, 5.6, 5.6, back ? '#6a4428' : BRONZE, BRONZE_L);
    // bell sleeve: hangs from the elbow, opening downward (gravity), ragged hem
    const m = lerpP(el, hd, 0.5), dr = 16 + Math.abs(nx) * 6;
    const A = { x: el.x + nx * 8, y: el.y + ny * 8 }, B = { x: el.x - nx * 8, y: el.y - ny * 8 };
    const C = { x: m.x - nx * 15, y: m.y - ny * 15 + dr }, D = { x: m.x + nx * 15, y: m.y + ny * 15 + dr };
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(A.x + nx * 6, A.y + ny * 6 + 8, D.x, D.y);
    for (let i = 1; i < 5; i++) { const q = lerpP(D, C, i / 5); ctx.lineTo(q.x + (i % 2 ? 0 : 0), q.y + (i % 2 ? 6 : -1)); }
    ctx.lineTo(C.x, C.y); ctx.quadraticCurveTo(B.x - nx * 6, B.y - ny * 6 + 8, B.x, B.y); ctx.closePath();
    ctx.fillStyle = Rig.celGrad(ctx, m.x, m.y, 1, 0, 22, s, back ? HAB_RB : HAB_R); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = HABIT_D; ctx.beginPath(); ctx.moveTo(D.x, D.y); ctx.quadraticCurveTo((C.x + D.x) / 2, (C.y + D.y) / 2 - 7, C.x, C.y); ctx.quadraticCurveTo((C.x + D.x) / 2, (C.y + D.y) / 2 + 2, D.x, D.y); ctx.fill();
  }

  /* ------------------------------------------------------------------ hazards ----------------------------------- */
  const arenaOf = (e) => { const a = G.game.arena; return a && a.id === e.enc ? a : { x0: (e.homeX ?? e.x) - 950, x1: (e.homeX ?? e.x) + 450 }; };
  // frost quake: a ridge of ice spikes racing along the floor — red, jump it
  function quakeWave(e, x, dir) {
    G.game.hazards.push({
      t: 0, life: 3, x, y: e.y, dir, speed: 540, hit: false, trail: [],
      update(h, dt, g) {
        h.x += h.dir * h.speed * dt; const a = arenaOf(e);
        if (h.x < a.x0 + 4 || h.x > a.x1 - 4) { h.done = true; G.FX.shards(U.clamp(h.x, a.x0, a.x1), h.y - 20, 6, ICE, 300); return; }
        h.tr = (h.tr || 0) + dt; if (h.tr > 0.045) { h.tr = 0; h.trail.unshift({ x: h.x, t: h.t }); if (h.trail.length > 6) h.trail.pop(); if (Math.random() < 0.5) G.FX.dust(h.x, h.y - 4, 2, { w: 30, speed: 140, size: 14, col: 'rgba(225,240,255,' }); }
        if (!h.hit) {
          const P = g.player, box = { x: h.x - 22, y: h.y - 52, w: 44, h: 52 };
          if (U.rectsOverlap(box, P.hurtbox)) { const r = P.receiveHit(e, { dmg: 18, unblockable: true, kb: 280, hx: h.x, hy: h.y - 30, waveFrom: h.x - h.dir * 60 }); if (r !== 'ignored') h.hit = true; }
        }
      },
      draw(ctx, h) {
        const grow = U.clamp(h.t / 0.08, 0, 1), fade = 1 - U.clamp((h.t - h.life + 0.3) / 0.3, 0, 1);
        ctx.globalAlpha = fade;
        // spent ice behind the front
        h.trail.forEach((q, i) => { const k = 1 - (i + 1) / 7; ctx.globalAlpha = fade * k * 0.8; spikes(ctx, q.x, h.y, h.dir, 0.45 * k + 0.1, i + 3); });
        ctx.globalAlpha = fade;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,42,95,0.28)'; ctx.beginPath(); ctx.ellipse(h.x, h.y - 2, 34, 9, 0, 0, TAU); ctx.fill(); ctx.restore();
        spikes(ctx, h.x, h.y, h.dir, grow, 0);
        ctx.globalAlpha = 1;
      },
    });
  }
  const SPK = [[-20, 20, -0.25], [-9, 42, -0.1], [2, 54, 0.05], [12, 36, 0.2], [21, 18, 0.35]];
  function spikes(ctx, x, y, dir, k, sd) {
    for (let i = 0; i < SPK.length; i++) {
      const [ox, hh, lean] = SPK[i], H = hh * k * (0.85 + ((i * 7 + sd * 3) % 5) * 0.06), bx = x + ox * dir, a = lean * dir;
      if (H < 2) continue;
      const tx = bx + Math.sin(a) * H, ty = y - Math.cos(a) * H;
      ctx.beginPath(); ctx.moveTo(bx - 6, y + 2); ctx.lineTo(tx, ty); ctx.lineTo(bx + 6, y + 2); ctx.closePath();
      ctx.fillStyle = '#d8efff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, y + 2); ctx.lineTo(tx, ty); ctx.lineTo(bx + 6, y + 2); ctx.closePath(); ctx.fillStyle = '#6f9ccc'; ctx.fill();
    }
  }
  // a toll: three white arcs that show exactly how far the sound reaches (purely visual; the attack's hitbox does the work)
  function tollFx(e, reach) {
    const f = e.facing, cx = e.x + f * 10, cy = e.y - 120;
    G.game.hazards.push({
      t: 0, life: 0.42,
      update() { },
      draw(ctx, h) {
        const k = h.t / h.life;
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const u = U.clamp(k * 1.6 - i * 0.22, 0, 1); if (u <= 0) continue;
          const r = 70 + (reach - 70) * U.easeOutCubic(u), a = 1 - u;
          const a0 = f > 0 ? -0.95 : PI - 0.95, a1 = f > 0 ? 0.75 : PI + 0.75;
          ctx.strokeStyle = U.rgba('#ffffff', 0.85 * a); ctx.lineWidth = 6 - i * 1.5;
          ctx.beginPath(); if (f > 0) ctx.arc(cx, cy, r, a0, a1); else ctx.arc(cx, cy, r, PI - 0.75, PI + 0.95); ctx.stroke();
          ctx.strokeStyle = U.rgba(ICE, 0.35 * a); ctx.lineWidth = 16 - i * 4; ctx.stroke();
        }
      },
    });
    e.pulse = 1;
  }
  // resonance ring: a white sound-wave expanding from the bell; a perfect guard bleeds her balance
  function resonance(e, i) {
    const cx = e.x, cy = e.y - 120, floor = e.y;
    G.SFX.play('c2_ring', i); G.FX.ring(cx, cy, 10, 90, 0.35, '#ffffff', 5); e.pulse = 1;
    G.game.hazards.push({
      t: 0, life: 3.6, x: cx, y: cy, r: 40, speed: 330 + i * 40, hit: false,
      update(h, dt, g) {
        h.r += h.speed * dt;
        const P = g.player, px = P.x, py = P.y - 56, d = Math.hypot(px - h.x, py - h.y);
        if (!h.hit && Math.abs(d - h.r) < 24) {
          const res = P.receiveHit(e, { dmg: 16, kb: 220, hx: px, hy: py, waveFrom: h.x });
          if (res === 'ignored') return;
          h.hit = true;
          if (res === 'parried' && !e.dead) {
            e.bal = Math.min(e.maxBal, e.bal + 46); e.balT = 0; e.showBar = 3; e.pulse = 1;
            G.FX.ring(px, py, 8, 70, 0.35, ICE, 4); G.SFX.play('c2_clang', 1.2);
            if (e.bal >= e.maxBal && e.state !== 'broken') e.breakBalance();
          }
        }
      },
      draw(ctx, h) {
        const fade = 1 - U.clamp((h.t - h.life + 0.6) / 0.6, 0, 1);
        ctx.beginPath(); ctx.rect(h.x - h.r - 30, h.y - h.r - 30, h.r * 2 + 60, floor - (h.y - h.r - 30) + 1); ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.rgba(ICE, 0.22 * fade); ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = U.rgba('#ffffff', 0.9 * fade); ctx.lineWidth = 3.2; ctx.stroke();
        ctx.setLineDash([10, 26]); ctx.lineDashOffset = -h.t * 60; ctx.strokeStyle = U.rgba(ROSE, 0.7 * fade); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h.x, h.y, h.r - 9, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = U.rgba('#ffffff', 0.35 * fade); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(h.x, h.y, h.r + 10, 0, TAU); ctx.stroke();
      },
    });
  }
  // icicles shaken loose from the station gantry: crimson floor marks → a whistle → impact
  function icicle(e, x, delay) {
    const len = 120 + Math.random() * 50, wob = Math.random() * 10;
    G.game.hazards.push({
      t: -delay, life: 2.3, x, y: e.y, warn: 1.0, hit: false, len,
      update(h, dt, g) {
        if (h.t < 0) return;
        const ft = h.t - h.warn;
        if (ft >= 0 && !h.whistled) { h.whistled = true; if (Math.abs(h.x - g.player.x) < 500 && Math.random() < 0.45) G.SFX.play('c2_icicle'); }
        if (ft >= 0.16 && !h.landed) {
          h.landed = true; G.FX.shards(h.x, h.y - 10, 7, '#dff4ff', 380); G.FX.dust(h.x, h.y - 2, 5, { w: 30, speed: 160, size: 12, col: 'rgba(230,242,255,' });
          if (Math.abs(h.x - g.player.x) < 420) { G.SFX.play('c2_shatter', 0.7); g.shake(0.12); }
        }
        if (!h.hit && ft > 0.06 && ft < 0.28) {
          const tipY = h.y - (1 - Math.min(1, ft / 0.16)) * 560, P = g.player;
          const box = { x: h.x - 15, y: tipY - h.len, w: 30, h: h.len };
          if (U.rectsOverlap(box, P.hurtbox)) { const r = P.receiveHit(e, { dmg: 22, unblockable: true, kb: 180, hx: h.x, hy: Math.max(tipY - 30, P.y - 90), waveFrom: h.x }); if (r !== 'ignored') h.hit = true; }
        }
      },
      draw(ctx, h) {
        if (h.t < 0) return;
        const ft = h.t - h.warn;
        if (ft < 0) {
          const k = U.clamp(h.t / h.warn, 0, 1);
          // crimson mark on the floor + a thin curtain of falling frost
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = U.rgba(CRIM, 0.12 + k * 0.22); ctx.beginPath(); ctx.ellipse(h.x, h.y - 1, 26 * (0.4 + k * 0.6), 6, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = U.rgba(CRIM, 0.4 + k * 0.5); ctx.lineWidth = 2; ctx.stroke();
          ctx.strokeStyle = 'rgba(220,240,255,' + (0.1 + k * 0.16) + ')'; ctx.lineWidth = 1.4; ctx.setLineDash([6, 16]); ctx.lineDashOffset = -h.t * 300;
          ctx.beginPath(); ctx.moveTo(h.x, h.y - 560); ctx.lineTo(h.x, h.y - 6); ctx.stroke(); ctx.setLineDash([]);
          ctx.globalCompositeOperation = 'source-over';
          drawIcicle(ctx, h.x + Math.sin(h.t * 40 + wob) * k * 2, h.y - 560 + k * 30, h.len);
        } else if (ft < 0.16) {
          const tipY = h.y - (1 - ft / 0.16) * 560;
          ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(220,240,255,0.35)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(h.x, tipY - h.len - 80); ctx.lineTo(h.x, tipY - h.len); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
          drawIcicle(ctx, h.x, tipY, h.len);
        } else {
          // shattered stub, melting away
          const k = 1 - U.clamp((ft - 0.5) / 0.6, 0, 1);
          ctx.globalAlpha = k; drawIcicle(ctx, h.x, h.y + 4, h.len * 0.34, true); ctx.globalAlpha = 1;
        }
      },
    });
  }
  function drawIcicle(ctx, x, tipY, len, stub) {
    const w = stub ? 13 : 11, top = tipY - len;
    ctx.beginPath();
    if (stub) { ctx.moveTo(x - w, tipY); ctx.lineTo(x - w * 0.6, top + 8); ctx.lineTo(x - 2, top); ctx.lineTo(x + 4, top + 10); ctx.lineTo(x + w * 0.8, top + 4); ctx.lineTo(x + w, tipY); }
    else { ctx.moveTo(x - w, top); ctx.lineTo(x - w * 0.55, top + len * 0.45); ctx.lineTo(x, tipY); ctx.lineTo(x + w * 0.5, top + len * 0.5); ctx.lineTo(x + w, top); }
    ctx.closePath(); ctx.fillStyle = '#e4f6ff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 1, top); ctx.lineTo(x, stub ? tipY : tipY); ctx.lineTo(x + w * (stub ? 1 : 0.5), stub ? tipY : top + len * 0.5); ctx.lineTo(x + w, top); ctx.closePath(); ctx.fillStyle = '#76a6d4'; ctx.fill();
    ctx.strokeStyle = U.rgba(ROSE, 0.85); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 3, top + 4); ctx.lineTo(x - 1.5, top + len * 0.45); ctx.lineTo(x - 0.4, top + len * 0.7); ctx.stroke();
    if (!stub) { ctx.fillStyle = '#5c6a84'; ctx.fillRect(x - w - 2, top - 5, w * 2 + 4, 6); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(x - w - 2, top - 5, w * 2 + 4, 6); }
  }
  function volley(e, k) {
    const a = arenaOf(e), P = G.game.player;
    const step = 150, off = ((e.hailOff + k * 75) % step + step) % step;
    for (let x = a.x0 + 40 + off; x < a.x1 - 30; x += step) icicle(e, x, Math.abs(x - e.x) / 2600);
    G.SFX.play('c2_chain', 1.2); G.game.shake(0.3); e.jerk = 1;
    if (k === 0) G.SFX.play('c2_toll', 1.5, 0.6);
    void P;
  }
  function slamImpact(e) {
    const g = G.game;
    g.shake(0.95); g.hitstop(0.05); G.SFX.play('c2_slam');
    G.FX.ring(e.x, e.y - 6, 20, 330, 0.55, ICE, 7, { flat: 0.16 }); G.FX.flash(e.x, e.y - 40, 220, 0.25, '#dff6ff');
    G.FX.dust(e.x, e.y - 4, LOWQ() ? 16 : 32, { w: 280, speed: 380, size: 22, col: 'rgba(230,242,255,' });
    G.FX.shards(e.x, e.y - 20, 14, '#dff4ff', 520); G.FX.shards(e.x, e.y - 20, 6, BRONZE_L, 420);
    quakeWave(e, e.x + 120, 1); quakeWave(e, e.x - 120, -1);
    e.pulse = 1;
  }
  function swingFx(e, i) {
    const f = e.facing;
    G.SFX.play('c2_swing', i); G.SFX.play('c2_toll', 1.2 + i * 0.1, 0.45);
    G.FX.slashMark(e.x + f * 120, e.y - 70, f > 0 ? 0.22 : PI - 0.22, 230, '#eef7ff', 0.26, 13);
    G.FX.dust(e.x + f * 130, e.y - 4, 10, { w: 120, speed: 300, size: 16, dir: f > 0 ? -0.3 : PI + 0.3, spread: 0.6, col: 'rgba(230,242,255,' });
    e.pulse = 0.7;
  }
  function summonMonks(e) {
    const a = arenaOf(e), P = G.game.player;
    G.SFX.play('c2_toll', 0.8, 1.1); G.SFX.play('c2_hum'); G.game.shake(0.4);
    if (!TYPES.c2_knellmonk) return;
    for (const side of [0, 1]) {
      let x = side ? a.x1 - 170 : a.x0 + 170;
      if (Math.abs(x - P.x) < 220) x += side ? -260 : 260;
      const y = G.Phys.groundBelow(x, e.y - 200); const yy = y > 1e8 ? e.y : y;
      const m = new G.Enemy('c2_knellmonk', x, yy, { enc: e.enc });
      m.facing = P.x < x ? -1 : 1; G.game.enemies.push(m);
      G.FX.shards(x, yy - 10, 12, ICE, 320); G.FX.ring(x, yy - 60, 10, 120, 0.5, '#ffffff', 4);
      if (G.game.save) G.game.save.flags.seen_c2_knellmonk = true;
    }
  }

  /* ------------------------------------------------------------------ attacks ----------------------------------- */
  const TB = { x: 30, y: -240, w: 210, h: 240 };          // toll: the sound burst in front of the bell (arcs drawn to 240)
  const SB = { x: -140, y: -140, w: 280, h: 140 };        // slam: the bell's own footprint
  const LB = { x: 280, y: -170, w: 150, h: 170 };         // lash: where the chain's fan crosses a standing body
  const sweep = {
    kind: 'sweep', dur: 2.4, cd: 1.0, trackWin: 0.6,
    tells: [{ t: 0.15, c: 'white' }, { t: 1.0, c: 'white' }],
    keys: [[0, I0], [0.2, CP.ready], [0.7, CP.back, 'io'], [0.82, CP.swing, 'snap'], [1.0, CP.follow, 'out'], [1.42, CP.back2, 'io'], [1.55, CP.swing2, 'snap'], [1.8, CP.over, 'out'], [2.05, CP.wob, 'io'], [2.4, I0, 'io']],
    moves: [{ t0: 0.74, t1: 0.86, v: 460 }, { t0: 1.48, t1: 1.6, v: 480 }],
    hits: [{ t0: 0.76, t1: 0.9, box: { x: 20, y: -200, w: 190, h: 200 }, dmg: 18, kb: 300 },
      { t0: 1.5, t1: 1.66, box: { x: 20, y: -210, w: 200, h: 210 }, dmg: 21, kb: 380, last: true, pbal: 60 }],
    ev: [{ t: 0.74, fn: (e) => swingFx(e, 0) }, { t: 1.48, fn: (e) => swingFx(e, 1) }],
  };
  const sweep3 = {
    kind: 'sweep', dur: 3.3, cd: 1.1, trackWin: 0.6,
    tells: [{ t: 0.15, c: 'white' }, { t: 0.98, c: 'white' }, { t: 1.62, c: 'red' }],
    keys: [[0, I0], [0.2, CP.ready], [0.7, CP.back, 'io'], [0.82, CP.swing, 'snap'], [1.0, CP.follow, 'out'], [1.4, CP.back2, 'io'], [1.53, CP.swing2, 'snap'], [1.7, CP.follow, 'out'], [2.12, CP.back3, 'io'], [2.3, CP.swing3, 'snap'], [2.6, CP.over, 'out'], [2.95, CP.wob, 'io'], [3.3, I0, 'io']],
    moves: [{ t0: 0.74, t1: 0.86, v: 460 }, { t0: 1.46, t1: 1.58, v: 480 }, { t0: 2.2, t1: 2.36, v: 620 }],
    hits: [{ t0: 0.76, t1: 0.9, box: { x: 20, y: -200, w: 190, h: 200 }, dmg: 18, kb: 300 },
      { t0: 1.48, t1: 1.62, box: { x: 20, y: -210, w: 200, h: 210 }, dmg: 20, kb: 320, pbal: 50 },
      { t0: 2.24, t1: 2.4, box: { x: 10, y: -230, w: 230, h: 230 }, dmg: 26, red: true, kb: 460, last: true }],
    ev: [{ t: 0.74, fn: (e) => swingFx(e, 0) }, { t: 1.46, fn: (e) => swingFx(e, 1) }, { t: 1.95, fn: () => G.SFX.play('c2_chain', 1) }, { t: 2.22, fn: (e) => { swingFx(e, 2); G.game.shake(0.4); } }],
  };
  const slam = {
    kind: 'slam', dur: 2.6, cd: 1.2, track: false, drift: [0.35, 1.0],
    tells: [{ t: 0.25, c: 'red' }],
    keys: [[0, I0], [0.3, CP.crouch], [0.85, CP.rise, 'out'], [1.02, CP.peak, 'io'], [1.12, CP.slam, 'in'], [1.3, CP.lodged, 'out'], [2.2, CP.lodged2, 'lin'], [2.6, I0, 'io']],
    hits: [{ t0: 1.1, t1: 1.22, box: SB, dmg: 30, red: true, kb: 440, last: true }],
    ev: [{ t: 0.3, fn: () => { G.SFX.play('c2_chain', 1.3); G.SFX.play('c2_hoist'); } }, { t: 1.12, fn: slamImpact }],
  };
  const lash = {
    kind: 'lash', dur: 1.75, cd: 0.9, track: false,
    tells: [{ t: 0.22, c: 'white' }],
    keys: [[0, I0], [0.25, CP.coilA], [0.68, CP.coilB, 'io'], [0.76, CP.crackA, 'snap'], [0.83, CP.crackM, 'lin'], [0.9, CP.crackB, 'out'], [1.08, CP.crackB], [1.45, CP.pull, 'io'], [1.75, I0, 'io']],
    hits: [{ t0: 0.78, t1: 0.9, box: LB, dmg: 20, kb: 300, last: true, pbal: 70 }],
    ev: [{ t: 0.25, fn: () => G.SFX.play('c2_whirl') }, { t: 0.76, fn: () => G.SFX.play('c2_crack') }, { t: 1.1, fn: () => G.SFX.play('c2_chain', 0.7) }],
  };
  const lash2 = {
    kind: 'lash', dur: 2.5, cd: 1.0, track: false,
    tells: [{ t: 0.22, c: 'white' }, { t: 0.98, c: 'white' }],
    keys: [[0, I0], [0.25, CP.coilA], [0.68, CP.coilB, 'io'], [0.76, CP.crackA, 'snap'], [0.83, CP.crackM, 'lin'], [0.9, CP.crackB, 'out'], [1.05, CP.crackB], [1.36, CP.lowA, 'io'], [1.46, { ...CP.crackM, lash: 0.4 }, 'in'], [1.54, CP.upB, 'out'], [1.72, CP.upB2, 'out'], [2.2, { ...CP.pull, lash: 0 }, 'io'], [2.5, I0, 'io']],
    hits: [{ t0: 0.78, t1: 0.9, box: LB, dmg: 20, kb: 300, pbal: 60 }, { t0: 1.44, t1: 1.56, box: LB, dmg: 20, kb: 320, last: true, pbal: 70 }],
    ev: [{ t: 0.25, fn: () => G.SFX.play('c2_whirl') }, { t: 0.76, fn: () => G.SFX.play('c2_crack') }, { t: 1.42, fn: () => G.SFX.play('c2_crack', 1.2) }],
  };
  const toll = {
    kind: 'toll', dur: 3.4, cd: 1.1, trackWin: 0.5, drift: [1.75, 2.2],
    tells: [{ t: 0.15, c: 'white' }, { t: 0.6, c: 'white' }, { t: 1.05, c: 'white' }, { t: 1.62, c: 'red' }],
    keys: [[0, I0], [0.3, CP.yank], [0.62, CP.toll, 'snap'], [0.85, CP.yank, 'io'], [1.07, CP.toll, 'snap'], [1.3, CP.yank, 'io'], [1.52, CP.toll, 'snap'], [1.72, CP.crouch, 'io'], [2.12, { ...CP.peak, lift: 120 }, 'out'], [2.28, CP.slam, 'in'], [2.45, CP.lodged, 'out'], [3.0, CP.lodged2, 'lin'], [3.4, I0, 'io']],
    hits: [{ t0: 0.6, t1: 0.72, box: TB, dmg: 14, kb: 200, pbal: 40 }, { t0: 1.05, t1: 1.17, box: TB, dmg: 14, kb: 200, pbal: 40 }, { t0: 1.5, t1: 1.62, box: TB, dmg: 15, kb: 220, pbal: 44 },
      { t0: 2.26, t1: 2.38, box: SB, dmg: 28, red: true, kb: 440, last: true }],
    ev: [0.6, 1.05, 1.5].map((t, i) => ({ t, fn: (e) => { G.SFX.play('c2_toll', 1 + i * 0.122, 1); tollFx(e, 240); G.game.shake(0.18); } })).concat([{ t: 2.28, fn: slamImpact }]),
  };
  const rings = {
    kind: 'rings', dur: 3.3, cd: 1.0, track: false,
    tells: [{ t: 0.3, c: 'white' }, { t: 1.05, c: 'white' }, { t: 1.8, c: 'white' }],
    keys: [[0, I0], [0.45, CP.pray, 'io'], [3.0, CP.pray2, 'lin'], [3.3, I0, 'io']],
    ev: [{ t: 0.2, fn: () => G.SFX.play('c2_hum') }].concat([0.8, 1.55, 2.3].map((t, i) => ({ t, fn: (e) => resonance(e, i) }))),
  };
  const hail = {
    kind: 'hail', dur: 2.9, cd: 1.3, track: false,
    tells: [{ t: 0.3, c: 'red' }],
    keys: [[0, I0], [0.32, CP.crouch], [0.55, CP.yankUp, 'snap'], [0.95, { ...CP.yankUp, head: -0.2 }, 'io'], [1.3, CP.yank, 'io'], [1.45, CP.yankUp, 'snap'], [2.3, CP.pray, 'io'], [2.9, I0, 'io']],
    onStart: (e) => { const a = arenaOf(e), P = G.game.player; e.hailOff = ((P.x - a.x0 - 40) % 150 + 150) % 150; },
    ev: [{ t: 0.55, fn: (e) => volley(e, 0) }, { t: 1.45, fn: (e) => volley(e, 1) }],
  };
  const summon = {
    kind: 'summon', dur: 2.3, cd: 0.8, track: false,
    keys: [[0, I0], [0.5, CP.spread, 'io'], [1.0, { ...CP.spread, head: -0.4 }, 'io'], [1.9, CP.spread], [2.3, I0, 'io']],
    ev: [{ t: 1.0, fn: summonMonks }],
  };

  /* ------------------------------------------------------------------ the type ---------------------------------- */
  TYPES.c2_boss = {
    name: '守鐘尼・卡菈', en: 'KARA, THE GATE-BELL NUN', w: 170, h: 340, hp: 1700, bal: 300, col: ICE, shards: 700,
    boss: true, poise: true, spawnT: 2.8, kbMul: 0.2, portrait: [0.82, 0.94],
    defeatDialog: 'c2_bossDefeat', phase2Bark: 'c2_bossP2', phase2Music: 'c2_boss2',
    sweep, sweep3, slam, lash, lash2, toll, rings, hail, summon,
    init(e) {
      e.facing = -1; e.homeX = e.x; e.lastMoves = []; e.pulse = 0; e.jerk = 0; e.hailOff = 0;
      e.veil = new Rig.Chain(9, 17, 0.05, 0.9); e.veil2 = new Rig.Chain(7, 14, 0.06, 0.9);
      e.chF = new Rig.Chain(9, 12, 0.03, 0.94); e.chB = new Rig.Chain(8, 12, 0.03, 0.94); e.snap = new Rig.Chain(6, 14, 0.02, 0.95);
    },
    voice: (e) => { G.SFX.play('c2_chain', 0.5); },
    weapon(e) {
      const W = e.wp, a = e.atk; if (!W) return { x: e.x, y: e.y - 200 };
      if (!a) return W.lip;
      if (a.kind === 'lash' || a.kind === 'hail') return W.hand;
      if (a.kind === 'rings' || (a.kind === 'toll' && e.st < 1.58)) return W.bell;
      if (a.kind === 'slam' || a.kind === 'toll') return W.base;
      return W.lip;
    },
    think(e, dt) {
      e.faceP();
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) { G.game.bossPhase2(e); return; }
      const d = e.distP(), p2 = e.phase === 2;
      const tv = d > 300 ? e.facing * 135 * e.speedMul : d < 120 ? -e.facing * 70 : 0;
      e.vx = U.approach(e.vx, tv, 520 * dt);
      if (Math.abs(e.vx) > 40) {
        e.grindT = (e.grindT || 0) - dt;
        if (e.grindT <= 0) { e.grindT = 0.32; G.FX.dust(e.x + e.facing * 110, e.y - 3, 3, { w: 40, speed: 120, size: 13, col: 'rgba(230,242,255,' }); if (d < 900) G.SFX.play('c2_grind'); }
      }
      if (e.cd > 0) return;
      if (p2 && e.pendingSummon) { e.pendingSummon = false; e.startAtk(summon); return; }
      const L = e.lastMoves, last = L[L.length - 1], last2 = L[L.length - 2];
      const pool = [];
      if (d < 260) pool.push([p2 ? 'sweep3' : 'sweep', 4]);
      if (d < (p2 ? 430 : 560)) pool.push(['slam', d < 220 ? 1.4 : d > 440 ? 3 : 2.4]);
      if (d >= 270 && d <= 440) pool.push([p2 ? 'lash2' : 'lash', 3.4]);
      if (p2) {
        if (d < 270) pool.push(['toll', 3.4]);
        if (last !== 'rings' && last2 !== 'rings') pool.push(['rings', 2]);
        if (last !== 'hail' && last2 !== 'hail') pool.push(['hail', d > 330 ? 2.4 : 1.4]);
      }
      if (!pool.length) return;
      const wt = (q) => (q[0] === last ? q[1] * 0.25 : q[1]);
      let r = Math.random() * pool.reduce((s, q) => s + wt(q), 0), pick = pool[0][0];
      for (const q of pool) { if ((r -= wt(q)) <= 0) { pick = q[0]; break; } }
      L.push(pick); if (L.length > 6) L.shift();
      e.startAtk(TYPES.c2_boss[pick]);
    },
    atkUpdate(e, dt) {
      const a = e.atk; if (!a) return;
      if (a.drift && e.st >= a.drift[0] && e.st <= a.drift[1]) e.vx = U.clamp((e.P.x - e.x) * 2.6, -470, 470);
    },
    onHit(e, h) {
      // the bell rings under the blade: every hit sounds and shivers the metal
      const now = e.t; if (now - (e.clangT || -9) > 0.09) { e.clangT = now; G.SFX.play('c2_clang', h.big ? 1 : 0.6); }
      e.pulse = Math.max(e.pulse || 0, h.big ? 0.55 : 0.3);
      if (h.hy != null && h.hy > e.y - BH - 10) G.FX.ring(h.hx, h.hy, 4, h.big ? 60 : 38, 0.22, BRONZE_L, 2.5);
    },
    onPhase2(e, game) {
      e.p2T = 0; e.pendingSummon = true; e.cd = 2.0;
      G.SFX.play('c2_break'); game.hitstop(0.12);
      G.FX.shards(e.x, e.y - 120, 26, BRONZE_L, 640); G.FX.shards(e.x, e.y - 120, 18, ICE, 700);
      G.FX.shards(e.x + e.facing * 30, e.y - BH - 130, 6, BRONZE, 300); // the gag plate, falling away
      G.FX.ring(e.x, e.y - 120, 30, 620, 1.1, '#ffffff', 6);
      e.pulse = 1;
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis, t = e.t, f = e.facing;
      // ---- pose
      let tg, oy = 0;
      const st = e.state;
      if (st === 'atk' && e.atk && e.atk.keys) tg = sample(e.atk.keys, e.st);
      else if (st === 'broken' || st === 'executed') tg = full(broken(e.t));
      else if (st === 'spawn') {
        const k = U.clamp(e.st / 2.8, 0, 1), kd = U.clamp(k / 0.5, 0, 1);
        // she hangs in her chains low enough to be seen through the intro dialogue (the trigger's focus frames her),
        // then the chains pay out and she drops onto the platform
        oy = -(1 - kd * kd) * 260;
        if (kd >= 1 && !e.landed && !ghost) {
          e.landed = true; G.SFX.play('c2_slam'); G.game.shake && G.game.shake(0.8);
          G.FX.dust(e.x, e.y - 4, 30, { w: 300, speed: 360, size: 22, col: 'rgba(230,242,255,' }); G.FX.ring(e.x, e.y - 6, 20, 360, 0.6, ICE, 6, { flat: 0.16 });
        }
        if (k > 0.74 && !e.unveiled && !ghost) { e.unveiled = true; G.SFX.play('c2_toll', 1, 1.2); G.SFX.play('c2_hum'); G.FX.ring(e.x, e.y - 120, 20, 420, 0.9, '#ffffff', 5); e.pulse = 1; }
        // held by the intro dialogue: arms raised to the sky, singing without a voice (as Ode describes her)
        const held = k < 0.02 && G.UI && G.UI.dialogActive;
        tg = held ? full({ ...CP.spread, sing: 1 }) : k < 0.5 ? full(CP.hang) : sample([[0.5, CP.hang], [0.58, { ...CP.crouch, head: 0.9 }, 'out'], [0.8, { ...CP.spread, sing: 0.4 }, 'io'], [0.92, CP.spread], [1, I0, 'io']], k);
      } else if (st === 'hurt' || st === 'recoil') tg = full({ ...idle(e.t), lean: -0.18, head: -0.1, sw: -0.12, aF: 0.1, aB: -0.2, glow: 0.6 });
      else if (st === 'die') tg = full({ ...idle(e.t), lean: 0.75, head: 0.95, sw: 0.12, aF: 0.2, eF: 0.1, aB: 0.1, eB: 0.1 });
      else tg = full(idle(e.t));
      const hk = e.hitK; if (hk > 0) tg = lerpPose(tg, full({ ...tg, lean: tg.lean - 0.2, head: tg.head - 0.22, sw: tg.sw - 0.07, aF: tg.aF - 0.25, aB: tg.aB - 0.2 }), Math.min(1, hk * 1.3));
      if (!e.pose) e.pose = tg;
      else if (dt > 0) e.pose = lerpPose(e.pose, tg, 1 - Math.exp(-(st === 'atk' || st === 'spawn' ? 32 : hk > 0 ? 30 : 9) * dt));
      const p = e.pose;
      if (dt > 0) { e.pulse = Math.max(0, (e.pulse || 0) - dt * 2.2); e.jerk = Math.max(0, (e.jerk || 0) - dt * 3); if (e.phase === 2) e.p2T = (e.p2T || 0) + dt; }
      const ck = e.phase === 2 ? U.clamp((e.p2T || 0) / 1.0, 0, 1) : 0;
      const R = rigOf(p);
      const dying = st === 'die' ? U.clamp(e.st / 0.5, 0, 1) : 0;
      const lq = LOWQ();
      const toW = (q) => ({ x: e.x + f * q.x, y: e.y + oy + q.y });
      const toL = (q) => ({ x: (q.x - e.x) * f, y: q.y - e.y - oy });
      // ---- world-space cloth & chains
      const vb = add(R.head, rot({ x: -24, y: 10 }, R.ha)), vw = toW(vb);
      const anF = toW(lerpP(R.elF, R.hdF, 0.86)), anB = toW(lerpP(R.elB, R.hdB, 0.86));
      const ancF = R.B(36, 6), ancB = R.B(-36, 6);
      if (dt > 0) {
        const wind = -f * 340 - e.vx * 3 + Math.sin(t * 1.3) * 220;
        e.veil.update(vw.x, vw.y, f, dt, wind, 2.45); e.veil2.update(vw.x - f * 3, vw.y - 6, f, dt, wind * 1.2, 2.2);
        e.chF.update(anF.x, anF.y, f, dt, -e.vx * 2, 3.0); e.chB.update(anB.x, anB.y, f, dt, -e.vx * 2, 3.05);
        const sa = toW(ancF); e.snap.update(sa.x, sa.y, f, dt, Math.sin(t * 1.7) * 200 - e.vx * 2, 3.08);
      }
      ctx.save();
      ctx.translate(e.x, e.y + oy); ctx.scale(f, 1);
      if (dying) ctx.globalAlpha = 1 - dying * 0.85;
      // contact shadow + the light that spills from under the lifted bell
      const fy = -oy;
      ctx.fillStyle = 'rgba(10,6,20,' + (0.4 * U.clamp(1 - R.lift / 260, 0.25, 1) * (oy < -1 ? 1 + oy / 640 : 1)) + ')';
      ctx.beginPath(); ctx.ellipse(0, fy + 2, 150 + R.lift * 0.1, 13, 0, 0, TAU); ctx.fill();
      if (R.lift > 6 && !ghost) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(0, fy); ctx.scale(1, 0.16);
        K.glow(ctx, 0, 0, 190, ICE, U.clamp(R.lift / 90, 0, 1) * 0.55); ctx.restore();
      }
      // ---- the station chains she hangs from (rise out of frame)
      if (!dying) {
        const jy = e.jerk * 14 * Math.sin(t * 50);
        for (const [an, side] of [[ancB, -1], [ancF, 1]]) {
          const topX = an.x * 0.4 + side * 6 + Math.sin(t * 0.7 + side) * 6, topY = -1500;
          let pts;
          const grip = p.raise > 0.4 ? (side > 0 ? R.hdF : R.hdB) : null;
          if (side > 0 && ck > 0.3) {
            // snapped in the second movement: upper half hangs from the gantry, a stub dangles from the bell
            pts = [{ x: topX, y: topY }, { x: topX + 3, y: -640 + jy }];
            links(ctx, pts, 5, '#6c7488', 11);
            ctx.fillStyle = '#6c7488'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(topX + 3, -630 + jy, 4, 7, 0.4, 0, TAU); ctx.fill(); ctx.stroke();
            if (e.snap.inited) links(ctx, e.snap.p.map(toL), 4.5, '#6c7488', 10);
            continue;
          }
          if (grip) pts = [an, lerpP(an, grip, 0.5), grip, { x: grip.x * 0.6 + topX * 0.4, y: -700 + jy }, { x: topX, y: topY }];
          else pts = [an, { x: an.x + Math.sin(t * 0.9 + side) * 2, y: -500 + jy }, { x: topX, y: topY }];
          links(ctx, pts, side > 0 ? 5.5 : 4.5, side > 0 ? '#7a8296' : '#545a6c', 11);
        }
      }
      // ---- veil (behind everything that is her)
      if (e.veil.inited) {
        if (!lq) rag(ctx, e.veil2.p.map(toL), 6, 11, HAB_RB, HABIT_D, 4);
        rag(ctx, e.veil.p.map(toL), 10, 19, HAB_R, HABIT_D, 2);
      }
      // ---- back arm and its chain
      drawArm(ctx, R.shB, R.elB, R.hdB, p.aB, e, true);
      if (e.chB.inited && !(p.raise > 0.4)) links(ctx, e.chB.p.map(toL), 3.6, '#5a6074', 9);
      // ---- the bell, her body
      drawBell(ctx, e, R, p, ck, t);
      drawTorso(ctx, e, R, p, t);
      drawHead(ctx, e, R, p, ck, t, ghost);
      // ---- front arm, its chain (hanging / whirling overhead / lashing out)
      const hand = R.hdF;
      if (p.ext > 0.04) {
        const ang = U.lerp(LASH_A0, LASH_A1, p.lash), n = 14, pts = [];
        const len = LC * p.ext, lag = (1 - Math.abs(p.lash - 0.5) * 2) * 0.35;
        for (let i = 0; i <= n; i++) {
          const u = i / n, a = ang - lag * u * u * Math.sign(0.5 - (e.lastLash ?? 0.5) + 0.01), r = len * u;
          const wave = Math.sin(u * 9 - t * 30) * 6 * (1 - p.ext) * u;
          pts.push({ x: hand.x + Math.cos(a) * r - Math.sin(a) * wave, y: hand.y + Math.sin(a) * r + Math.cos(a) * wave });
        }
        if (!ghost) e.lastLash = p.lash;
        links(ctx, pts, 4, '#8a92a8', 10);
        const tip = pts[n];
        ctx.fillStyle = BRONZE_L; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(tip.x + 9, tip.y); ctx.lineTo(tip.x, tip.y - 6); ctx.lineTo(tip.x - 7, tip.y); ctx.lineTo(tip.x, tip.y + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (st === 'atk' && e.atk && e.atk.hits && e.atk.hits.some((h) => e.st >= h.t0 - 0.03 && e.st <= h.t1 + 0.03) && !ghost) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hand.x, hand.y);
          for (const q of pts) ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.restore();
        }
      } else if (p.coil > 0.05) {
        const c = { x: hand.x - 6, y: hand.y - 30 }, rr = 46 * p.coil, ph = t * 15, pts = [hand];
        for (let i = 0; i <= 16; i++) { const a = ph + i * 0.42; pts.push({ x: c.x + Math.cos(a) * rr * (0.4 + i / 26), y: c.y + Math.sin(a) * rr * 0.45 * (0.4 + i / 26) }); }
        links(ctx, pts, 3.6, '#8a92a8', 9);
        if (!ghost) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(220,240,255,0.35)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(c.x, c.y, rr * 1.05, rr * 0.48, 0, ph, ph + 2.4); ctx.stroke(); ctx.restore(); }
      } else if (e.chF.inited && !(p.raise > 0.4)) links(ctx, e.chF.p.map(toL), 3.8, '#7a8296', 9);
      drawArm(ctx, R.shF, R.elF, R.hdF, p.aF, e, false);
      // ---- tell glow at the active weapon point
      const lipF = R.B(LIPW - 10, BH - 30), bellC = R.B(18, BH * 0.45), base = { x: 0, y: -40 };
      if (e.tellT > 0 && !ghost) {
        const tp = e.atk && (e.atk.kind === 'lash' || e.atk.kind === 'hail') ? hand : e.atk && e.atk.kind === 'rings' ? bellC : e.atk && (e.atk.kind === 'slam' || (e.atk.kind === 'toll' && e.st >= 1.58)) ? base : e.atk && e.atk.kind === 'toll' ? bellC : lipF;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, tp.x, tp.y, 46, e.tellCol === 'red' ? CRIM : '#ffffff', e.tellT * 1.2); ctx.restore();
      }
      ctx.restore();
      e.wp = { lip: toW(lipF), hand: toW(hand), bell: toW(bellC), base: toW(base) };
      // dissolve into frost on death
      if (dying && !ghost && Math.random() < 0.7) G.FX.ember(e.x, e.y - 160, 3, ICE, { w: 220, h: 300, up: 160 });
    },
  };

  /* ------------------------------------------------------------------ sound ------------------------------------- */
  const S = G.SFX;
  S.c2_toll = (t, pitch = 1, k = 1) => {
    const A = G.AudioKit, f = A.mtof(38) * pitch;
    A.bell(f, t, 0.2 * k, 4.2, 0.75, 0.9);
    A.bell(f * 2.4, t + 0.004, 0.07 * k, 2.4, 0.7, 0.6);       // the minor-third "tierce" that makes a bell sound sad
    A.tone('sine', f / 2, t, 0.01, 0.26 * k, 1.8, { wet: 0.45 });
    A.noise(t, 0.002, 0.14 * k, 0.16, 'bandpass', 2400, 900, 1.2, 0.3);
  };
  S.c2_clang = (t, k = 1) => {
    const A = G.AudioKit, f = A.mtof(62 + Math.floor(Math.random() * 3) * 2);
    A.bell(f, t, 0.07 * k, 1.2, 0.5, 1.2); A.bell(f * 1.5, t, 0.03 * k, 0.6, 0.4, 1);
    A.tone('sine', 110, t, 0.002, 0.18 * k, 0.25, { to: 70, wet: 0.2 });
  };
  S.c2_slam = (t) => {
    const A = G.AudioKit;
    S.c2_toll(t, 0.7, 1.2);
    A.tone('sine', 52, t, 0.004, 0.6, 0.7, { to: 28, wet: 0.25 });
    A.noise(t, 0.004, 0.34, 0.6, 'lowpass', 900, 80, 0.7, 0.3);
    A.noise(t + 0.02, 0.01, 0.12, 0.5, 'highpass', 3000, 6500, 0.7, 0.4);
  };
  S.c2_chain = (t, k = 1) => {
    const A = G.AudioKit;
    for (let i = 0; i < 6; i++) { const tt = t + i * 0.045 + Math.random() * 0.02; A.tone('triangle', 1700 + Math.random() * 900, tt, 0.001, 0.022 * k, 0.09, { wet: 0.3 }); A.noise(tt, 0.001, 0.045 * k, 0.03, 'bandpass', 4200, 3000, 2, 0.1); }
  };
  S.c2_hoist = (t) => { const A = G.AudioKit; A.tone('sawtooth', 70, t, 0.2, 0.05, 0.7, { to: 110, filter: 'lowpass', ff: 500, wet: 0.3 }); A.noise(t, 0.2, 0.06, 0.6, 'bandpass', 700, 1400, 3, 0.3); };
  S.c2_whirl = (t) => { const A = G.AudioKit; for (let i = 0; i < 4; i++) A.noise(t + i * 0.11, 0.04, 0.11, 0.08, 'bandpass', 900 + i * 300, 1800 + i * 300, 1.4, 0.1); };
  S.c2_crack = (t, p = 1) => { const A = G.AudioKit; A.noise(t, 0.001, 0.5, 0.06, 'highpass', 2500 * p, 6000, 0.7, 0.2); A.tone('square', 1800 * p, t, 0.001, 0.04, 0.05, { to: 600, wet: 0.2 }); S.c2_chain(t + 0.03, 0.7); };
  S.c2_swing = (t, i = 0) => { const A = G.AudioKit; A.noise(t, 0.05, 0.3, 0.32, 'bandpass', 500 + i * 120, 180, 0.8, 0.15); A.tone('sine', 70, t, 0.04, 0.2, 0.3, { to: 45, wet: 0.1 }); S.c2_chain(t, 0.6); };
  S.c2_ring = (t, i = 0) => {
    const A = G.AudioKit;
    A.bell(A.mtof(74 + [0, 3, 7][i % 3]), t, 0.07, 2.4, 0.85, 0.4);
    A.tone('sine', A.mtof(62), t, 0.05, 0.07, 1.2, { to: A.mtof(74), wet: 0.6 });
    A.noise(t, 0.1, 0.04, 0.9, 'bandpass', 3000, 1500, 4, 0.7);
  };
  S.c2_icicle = (t) => { const A = G.AudioKit; A.tone('sine', 2600, t, 0.01, 0.02, 0.18, { to: 700, wet: 0.3 }); };
  S.c2_shatter = (t, k = 1) => {
    const A = G.AudioKit;
    for (let i = 0; i < 4; i++) A.tone('sine', 2400 + Math.random() * 2600, t + i * 0.012, 0.001, 0.025 * k, 0.22, { wet: 0.4 });
    A.noise(t, 0.001, 0.16 * k, 0.16, 'highpass', 3500, 7000, 0.7, 0.2);
  };
  S.c2_hum = (t) => {
    // the silent song: breath through a choir that never quite becomes a voice
    const A = G.AudioKit;
    [62, 65, 69].forEach((m, i) => A.choirVoice(A.mtof(m), t + i * 0.06, 1.4, 0.022, A.sfxBus));
    A.noise(t, 0.4, 0.05, 1.4, 'bandpass', 1200, 900, 2.5, 0.7);
  };
  S.c2_grind = (t) => { const A = G.AudioKit; A.noise(t, 0.04, 0.035, 0.25, 'bandpass', 380, 300, 2, 0.1); };
  S.c2_break = (t) => { S.c2_toll(t, 0.5, 1.4); S.c2_shatter(t + 0.02, 1.3); S.c2_crack(t, 0.6); S.c2_hum(t + 0.4); };

  /* ------------------------------------------------------------------ data -------------------------------------- */
  const D = G.DATA;
  D.speakers.c2_calla = D.speakers.c2_calla || { name: '卡菈', en: 'KARA', color: '#9fe6ff' };
  D.barks.c2_bossP2 = D.barks.c2_bossP2 || { who: 'c2_calla', text: '（鐘身裂開。裂縫裡，有她的聲音。）……一個……也不放。' };
  if (!D.codex.hushborn.some((c) => c.id === 'c2_boss')) {
    D.codex.hushborn.push({
      id: 'c2_boss', name: '守鐘尼・卡菈', en: 'KARA, THE GATE-BELL NUN', portrait: 'c2_boss', unlock: 'seen_c2_boss',
      tag: '頭目｜雪嶺山門・第一位守門人',
      body: [
        '冥界第一道門的守門人。很久以前，她把舌頭交給了門鐘，當作鐘舌。從此她只用鐘聲說話：放一個亡者進門，就敲一下。',
        '十八年前，門後的人要她停下。她停了，把自己鎖進門鐘裡，一下也不敲。門外的人排成了雪，她記下每一個名字——如今鐘是她的裙擺，沉默是她的回答。',
        '第一樂章：鐘擺橫掃（白・白）；裙擺重擊（紅）——落地後冰浪沿地面擴散，跳過去；鎖鏈鞭笞（白，遠距離）——貼近她，鎖鏈會從頭頂掠過。',
        '第二樂章：鐘身碎裂。召喚喪鐘僧；連續鳴鐘（白×3 接紅色重擊）；冰凌墜落（紅）——看地上的紅色標記，站到上一輪落下的位置；共鳴環（白）——完美閃避穿過它，再趁隙反擊。',
        '弱點：每次重擊之後，巨鐘會卡在雪裡一秒多。那就是出刀的時候。',
      ],
    });
  }
})(window.G);

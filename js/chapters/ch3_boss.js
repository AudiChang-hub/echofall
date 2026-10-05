'use strict';
/* ECHOFALL — Chapter III boss: 鑽井王・哈德爾 HADAL, THE BORE-KING (c3_boss)
   Descent III's leader, welded into the colossal drill-rig crawler he drove down the Faultwell twenty years ago.
   Phase I  (steel drill, furnace orange): boom sweep ×2 (white, white) · drill lunge (red, drill sticks in the floor)
            claw piston ×3 (white — the parry lesson) · claw grab (red) · hull buck (white, close) · rear steam vent (red)
            ceiling rockfall (arena hazard).
   Phase II (the drill turns to Hush crystal, violet): burrow & erupt ×2 (red) · spiral shard spray (white, parry reflects)
            fault-line crystal spikes racing across the floor (red, jump) · crystal rain · a 3-hit sweep with a red finisher.
   Everything the boss hits with is derived from the same geometry the renderer draws (geo()), so reach == drawn reach. */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK, D = G.DATA, CRIM = K.CRIM;
  const ORE = '#ff9a3c', EMBER = '#ffd08a', CRY = '#c77dff', CRYL = '#f3d6ff', MAG = '#ff6ad5', LAMP = '#fff0c2';
  const C = {
    paint: '#a8792f', iron: '#3d3949', steel: '#8b90a4', brass: '#c08f47', rubber: '#2a2631', chrome: '#cfd3df',
    coat: '#433a4c', band: '#e07a2e', skin: '#a7959f', helm: '#c39b4a', beard: '#aaa4b4', banner: '#2f6074', bannerIn: '#16303e', rock: '#5d5468',
  };
  const ramp = (h) => Rig.ramp(h);

  /* =========================== pose & keyframes =========================== */
  // boom: drill arm angle (rad, 0 = straight ahead, + = down) · ext: boom telescope · spin: drill rev/s · ca/cb: claw upper/fore
  // arm angles · open: claw talons · cext: claw flung forward on its cable · pitch: whole rig (+ nose down) · crouch: suspension
  // hR/hL/hHead: Hadal's front-arm raise / torso lean / head tilt · heat: drill glow · sink: buried (0..1) · vent: pipe blast
  // roar: arms flung wide · dorm: powered down (intro)
  const POSE0 = { boom: 0.2, ext: 0, spin: 3, ca: -1.05, cb: 0.85, open: 0.25, cext: 0, pitch: 0, crouch: 0, hR: 0.1, hL: 0, hHead: 0, heat: 0.2, sink: 0, vent: 0, roar: 0, dorm: 0 };
  const PK = Object.keys(POSE0);
  const full = (q) => { const o = {}; for (const k of PK) o[k] = q[k] ?? POSE0[k]; return o; };
  const lerpPose = (a, b, t) => { const o = {}; for (const k of PK) o[k] = a[k] + (b[k] - a[k]) * t; return o; };
  const EASE = { lin: (t) => t, io: U.easeInOutSine, out: U.easeOutCubic, in: U.easeInCubic, snap: (t) => 1 - Math.pow(1 - t, 4) };
  // each key only lists what changes: it inherits everything else from the key before it
  function keys(list) {
    let prev = POSE0;
    return list.map(([t, q, ez]) => { const p = full(Object.assign({}, prev, q)); prev = p; return [t, p, ez || 'io']; });
  }
  function sample(ks, t) {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) { const a = ks[i - 1], b = ks[i]; return lerpPose(a[1], b[1], EASE[b[2]]((t - a[0]) / (b[0] - a[0] || 1))); }
    }
    return ks[ks.length - 1][1];
  }

  /* =========================== geometry (local: facing +x, feet at y = 0) =========================== */
  const PV = { x: 112, y: -122 }, HOUSE = 64, DL = 150, DR = 30;          // drill boom pivot, housing, drill length / radius
  const CS = { x: 62, y: -178 }, L1 = 84, L2 = 108, HEAD = 50, CEXT = 200;  // claw shoulder, arm segments, head, cable reach
  function geo(p) {
    const ux = Math.cos(p.boom), uy = Math.sin(p.boom), hl = HOUSE + p.ext * 60;
    const base = { x: PV.x + ux * hl, y: PV.y + uy * hl }, tip = { x: base.x + ux * DL, y: base.y + uy * DL };
    const el = { x: CS.x + Math.cos(p.ca) * L1, y: CS.y + Math.sin(p.ca) * L1 };
    const fe = { x: el.x + Math.cos(p.cb) * L2, y: el.y + Math.sin(p.cb) * L2 };
    const ha = U.lerp(p.cb, 0.12, U.clamp(p.cext * 1.4, 0, 1));
    const hd = { x: fe.x + p.cext * CEXT, y: fe.y };
    const hc = { x: hd.x + Math.cos(ha) * HEAD * 0.55, y: hd.y + Math.sin(ha) * HEAD * 0.55 };
    return { ux, uy, nx: -uy, ny: ux, hl, base, tip, el, fe, hd, ha, hc };
  }
  const drillPts = (g) => [{ x: g.base.x + g.nx * DR, y: g.base.y + g.ny * DR }, { x: g.base.x - g.nx * DR, y: g.base.y - g.ny * DR }, g.tip,
    { x: (g.base.x + g.tip.x) / 2 + g.nx * DR * 0.5, y: (g.base.y + g.tip.y) / 2 + g.ny * DR * 0.5 }, { x: (g.base.x + g.tip.x) / 2 - g.nx * DR * 0.5, y: (g.base.y + g.tip.y) / 2 - g.ny * DR * 0.5 }];
  const clawPts = (g) => [{ x: g.hc.x - 32, y: g.hc.y - 30 }, { x: g.hc.x + 32, y: g.hc.y + 30 }];
  function aabb(pts, pad = 0) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    return { x: Math.round(x0 - pad), y: Math.round(y0 - pad), w: Math.round(x1 - x0 + pad * 2), h: Math.round(y1 - y0 + pad * 2) };
  }
  // the box a part sweeps through between t0 and t1 of an attack (hitboxes are built from the drawn geometry)
  function swept(ks, t0, t1, part, pad = 4) {
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push(...part(geo(sample(ks, t0 + (t1 - t0) * i / 8))));
    return aabb(pts, pad);
  }
  const lerpPt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  function ik2(o, t, a, b, bend) {
    const dx = t.x - o.x, dy = t.y - o.y, d0 = Math.hypot(dx, dy) || 1, d = U.clamp(d0, Math.abs(a - b) + 1, a + b - 0.5);
    const ang = Math.atan2(dy, dx), A = Math.acos(U.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), ea = ang + bend * A;
    return { el: { x: o.x + Math.cos(ea) * a, y: o.y + Math.sin(ea) * a }, hand: { x: o.x + dx / d0 * d, y: o.y + dy / d0 * d } };
  }
  function arenaOf(e) {
    const a = G.game.arena;
    if (a && a.id === e.enc) return a;
    const hx = e.homeX ?? e.x;
    return { x0: hx - 950, x1: hx + 450 };
  }

  /* =========================== attacks =========================== */
  const SWING_K = keys([
    [0, {}],
    [0.5, { boom: -1.12, ext: -0.2, pitch: -0.05, hR: 1, hL: -0.35, spin: 9, heat: 0.45, ca: -1.6, cb: -0.5 }],
    [0.62, { boom: -1.18 }, 'lin'],
    [0.76, { boom: 0.62, ext: 0.15, pitch: 0.045, hR: 0.35, hL: 0.7, spin: 12 }, 'snap'],
    [1.0, { boom: 0.58, ext: 0.1, pitch: 0.02 }],
    [1.3, { boom: 0.42, ext: -0.45, pitch: -0.03, hR: 0.9, hL: -0.4, ca: -1.8, cb: -0.8 }],
    [1.5, { boom: -0.38, ext: 0.45, pitch: 0.035, hR: 0.2, hL: 0.75, spin: 14 }, 'snap'],
    [1.85, { boom: -0.32, ext: 0.4, pitch: 0.01 }],
    [2.45, POSE0],
  ]);
  const SW3_K = keys([
    [0, {}],
    [0.42, { boom: -1.12, ext: -0.2, pitch: -0.05, hR: 1, hL: -0.35, spin: 12, heat: 0.6, ca: -1.6, cb: -0.5 }],
    [0.52, { boom: -1.18 }, 'lin'],
    [0.64, { boom: 0.62, ext: 0.15, pitch: 0.045, hR: 0.35, hL: 0.7, spin: 16 }, 'snap'],
    [0.84, { boom: 0.58, ext: 0.1, pitch: 0.02 }],
    [1.1, { boom: 0.42, ext: -0.45, pitch: -0.03, hR: 0.9, hL: -0.4, ca: -1.8, cb: -0.8 }],
    [1.28, { boom: -0.38, ext: 0.45, pitch: 0.035, hR: 0.2, hL: 0.75, spin: 18 }, 'snap'],
    [1.6, { boom: 0.1, ext: -0.55, crouch: 1, spin: 36, heat: 1, hL: 0.9, hR: 0.7, pitch: -0.02 }],
    [1.98, {}, 'lin'],
    [2.08, { boom: 0.12, ext: 0.7, crouch: 0.2, pitch: 0.03, hL: 1.1 }, 'snap'],
    [2.36, {}, 'lin'],
    [3.1, POSE0],
  ]);
  const BORE_K = keys([
    [0, {}],
    [0.3, { boom: 0.1, ext: -0.5, crouch: 1, hL: 0.85, hR: 0.7, spin: 8, heat: 0.45, ca: -1.7, cb: 0.1 }],
    [0.9, { ext: -0.58, spin: 32, heat: 1, pitch: -0.025 }, 'lin'],
    [1.0, { boom: 0.12, ext: 0.65, crouch: 0.2, pitch: 0.03, hL: 1.1 }, 'snap'],
    [1.32, {}, 'lin'],
    [1.5, { boom: 0.52, ext: 0.5, pitch: 0.06, spin: 16, heat: 0.9 }, 'out'],
    [2.45, { boom: 0.55, ext: 0.45, spin: 3, heat: 0.5, hL: 0.25, hR: 0.2 }, 'lin'],
    [2.72, { boom: 0.05, ext: 0, pitch: -0.035, spin: 8 }, 'snap'],
    [3.1, POSE0],
  ]);
  const PIST_K = keys([
    [0, {}],
    [0.45, { ca: -1.7, cb: -0.75, open: 0, hR: 1, hL: -0.25, pitch: -0.03, boom: -0.55, spin: 4 }],
    [0.6, { ca: -1.76, cb: -0.82 }, 'lin'],
    [0.72, { ca: 0.05, cb: 1.35, pitch: 0.035, hL: 0.6, hR: 0.4 }, 'snap'],
    [0.9, { ca: 0.0, cb: 1.3 }],
    [1.16, { ca: -1.3, cb: -0.4, pitch: -0.02, hR: 0.9, hL: -0.2 }],
    [1.3, { ca: 0.05, cb: 1.35, pitch: 0.035, hL: 0.6, hR: 0.4 }, 'snap'],
    [1.48, { ca: 0.0, cb: 1.3 }],
    [1.8, { ca: -1.85, cb: -0.95, pitch: -0.055, hR: 1, hL: -0.5 }],
    [1.98, { ca: -1.9, cb: -1.02 }, 'lin'],
    [2.1, { ca: 0.1, cb: 1.4, pitch: 0.055, hL: 0.85, hR: 0.3 }, 'snap'],
    [2.65, { ca: 0.08, cb: 1.38, pitch: 0.02 }],
    [3.1, POSE0],
  ]);
  const GRAB_K = keys([
    [0, {}],
    [0.38, { ca: -2.25, cb: -2.3, open: 1, hR: 0.8, hL: -0.45, pitch: -0.035, boom: -0.35 }],
    [0.86, { ca: -2.35, cb: -2.4 }, 'lin'],
    [0.98, { ca: 0.35, cb: 0.55, cext: 1, hL: 0.85, hR: 0.2, pitch: 0.03 }, 'snap'],
    [1.2, { open: 0.85 }, 'lin'],
    [1.95, { ca: 0.3, cb: 0.6, cext: 0.92, open: 0.6 }, 'lin'],
    [2.3, { ca: -0.9, cb: 0.4, cext: 0, open: 0.3, boom: 0.1 }],
    [2.65, POSE0],
  ]);
  const HOLD_K = keys([
    [0, Object.assign({}, sample(GRAB_K, 1.0), { open: 0 })],
    [0.55, { ca: -0.35, cb: 0.25, cext: 0.25, open: 0, boom: -0.08, spin: 22, heat: 0.85, hL: 0.6, hR: 1, pitch: 0 }],
    [1.22, { spin: 36, heat: 1 }, 'lin'],
    [1.34, { ca: -0.7, cb: -0.35, open: 1, cext: 0.1, boom: -0.15, hR: 0.2 }, 'snap'],
    [2.1, POSE0],
  ]);
  const BUCK_K = keys([
    [0, {}],
    [0.5, { pitch: -0.2, hR: 0.7, hL: -0.5, boom: -0.35, ca: -1.6, cb: -0.3, spin: 6 }],
    [0.62, { pitch: -0.215 }, 'lin'],
    [0.72, { pitch: 0.05, hL: 0.7, hR: 0.2, boom: 0.35, ca: -1.1, cb: 0.9 }, 'snap'],
    [1.0, { pitch: 0 }],
    [1.7, POSE0],
  ]);
  const VENT_K = keys([
    [0, {}],
    [0.6, { vent: 1, hL: -0.35, hHead: -0.6, pitch: 0.02 }],
    [0.8, { vent: 1.25, pitch: 0.045 }, 'lin'],
    [1.3, { vent: 0.3, pitch: 0 }],
    [1.9, POSE0],
  ]);
  const ROCK_K = keys([
    [0, {}],
    [0.5, { boom: -1.45, ext: 0.35, spin: 26, heat: 0.8, hR: 1, hL: -0.6, hHead: -0.7, ca: -1.95, cb: -1.4, pitch: -0.05 }],
    [1.6, { spin: 34 }, 'lin'],
    [2.05, { boom: 0.25, ext: 0, spin: 5, heat: 0.4, hR: 0.1, hL: 0.2, hHead: 0, ca: -1.25, cb: 0.75, pitch: 0.01 }],
    [2.6, POSE0],
  ]);
  const BUR_K = keys([
    [0, {}],
    [0.45, { boom: 1.2, ext: 0.25, pitch: 0.1, spin: 32, heat: 1, hL: 0.7, hR: 0.9, ca: -1.7, cb: -0.7 }],
    [0.6, {}, 'lin'],
    [1.25, { sink: 1 }, 'in'],
    [2.55, { boom: -1.5, ext: 0.3, pitch: 0 }, 'lin'],
    [2.72, { sink: 0.5 }, 'snap'],
    [2.95, {}, 'lin'],
    [3.3, { sink: 1 }, 'in'],
    [4.4, {}, 'lin'],
    [4.62, { sink: 0, pitch: -0.08, boom: -1.45 }, 'snap'],
    [4.95, { pitch: 0, boom: -1.1 }],
    [5.45, { boom: 0.6, ext: 0, spin: 2, heat: 0.35, hL: 1.0, hR: 0, ca: -0.4, cb: 1.3, open: 0.6, vent: 0.5, hHead: 0.4 }],
    [5.95, POSE0],
  ]);
  const SPI_K = keys([
    [0, {}],
    [0.6, { boom: -1.05, ext: 0.3, spin: 18, heat: 1, hR: 1, hL: -0.3, ca: -1.9, cb: -1.25, pitch: -0.03 }],
    [2.65, { boom: -0.95, spin: 40 }, 'lin'],
    [3.0, { boom: 0.35, ext: 0, spin: 4, heat: 0.7, vent: 0.7, hL: 0.5, hR: 0.1, ca: -1.25, cb: 0.75, pitch: 0.01 }],
    [3.6, POSE0],
  ]);
  const FAULT_K = keys([
    [0, {}],
    [0.55, { boom: -1.3, ext: 0.15, spin: 22, heat: 1, hR: 1, hL: -0.5, pitch: -0.07, ca: -1.9, cb: -1.3 }],
    [0.68, { boom: -1.36 }, 'lin'],
    [0.82, { boom: 0.62, ext: 0.2, pitch: 0.06, hL: 0.85, hR: 0.3 }, 'snap'],
    [1.6, { spin: 6, heat: 0.7, pitch: 0.03 }],
    [2.4, POSE0],
  ]);
  const TRANS_K = keys([
    [0, { pitch: 0.05, hL: 1.0, hHead: 0.6, boom: 0.65, spin: 0, heat: 0.1, ca: -0.4, cb: 1.3 }],
    [0.75, { pitch: -0.12, roar: 1, hR: 1, hHead: -0.9, hL: -0.6, boom: -1.4, ext: 0.2, ca: -2.1, cb: -1.6, open: 1, heat: 0.4 }, 'out'],
    [2.0, { spin: 40, heat: 1, pitch: -0.1 }, 'lin'],
    [2.6, POSE0],
  ]);
  const INTRO_K = keys([
    [0, { dorm: 1, hL: 1.15, hHead: 0.85, boom: 0.68, ext: 0.1, spin: 0, heat: 0, ca: -0.35, cb: 1.4, open: 0.7, pitch: 0.035, hR: 0 }],
    [0.7, {}, 'lin'],
    [1.3, { dorm: 0 }, 'lin'],
    [1.7, { hL: 0.2, hHead: -0.2 }],
    [2.3, { boom: -1.3, ext: 0.3, spin: 34, heat: 1, hR: 1, hL: -0.5, hHead: -0.8, roar: 1, ca: -2.05, cb: -1.5, open: 1, pitch: -0.08 }, 'out'],
    [2.75, {}, 'lin'],
    [3.4, POSE0],
  ]);
  const drillBox = (ks, t0, t1) => swept(ks, t0, t1, drillPts);
  const clawBox = (ks, t0, t1) => swept(ks, t0, t1, clawPts, 0);
  const W = { face: false };
  const tw = (t) => Object.assign({ t, c: 'white' }, W), tr = (t) => Object.assign({ t, c: 'red' }, W);
  const sfx = (n, ...a) => () => G.SFX.play(n, ...a);

  /* =========================== hazards =========================== */
  function floorAt(x, y) { const f = G.Phys.groundBelow(x, y - 60); return f > 1e8 ? y : f; }
  // falling rock / crystal stalactite: shadow + crimson floor ring telegraph (unblockable), lands, leaves rubble
  function makeRock(e, x, delay, crystal) {
    const rng = U.mulberry32(((x * 7.31) | 0) + 77), n = 8, r = crystal ? 20 : 27 + rng() * 11, pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rng() * 0.45; const rr = r * (0.74 + rng() * 0.38); pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.86]); }
    const warn = crystal ? 0.8 : 0.95, fall = 0.24;
    return { kind: 'c3_rock', t: -delay, life: warn + fall + 0.85, warn, fall, x, y: -9999, floor: floorAt(x, e.y), r, pts, crystal, owner: e, rot: rng() * TAU, spin: (rng() - 0.5) * 9, update: rockUpd, draw: rockDraw };
  }
  function rockUpd(h, dt, g) {
    if (h.t < 0) return;
    const P = g.player, hb = P.hurtbox;
    if (h.t >= h.warn && h.t < h.warn + h.fall) {
      const k = (h.t - h.warn) / h.fall;
      h.y = U.lerp(h.floor - 760, h.floor - h.r * 0.8, k * k); h.rot += h.spin * dt;
      if (!h.hit && Math.abs(P.x - h.x) < h.r + 13 && h.y + h.r > hb.y && h.y - h.r < hb.y + hb.h) { h.hit = true; P.receiveHit(h, { dmg: 20, unblockable: true, kb: 280, hx: h.x, hy: h.y }); }
    } else if (h.t >= h.warn + h.fall && !h.landed) {
      h.landed = true; h.y = h.floor - h.r * 0.8;
      if (!h.hit && Math.abs(P.x - h.x) < h.r + 13 && hb.y + hb.h > h.floor - h.r * 1.7) { h.hit = true; P.receiveHit(h, { dmg: 20, unblockable: true, kb: 280, hx: h.x, hy: h.y }); }
      if (h.crystal) { G.FX.shards(h.x, h.floor - 10, 14, CRY, 420); G.SFX.play('c3_crystal'); }
      else { G.FX.shards(h.x, h.floor - 10, 8, '#8f8396', 360); G.SFX.play('c3_rockLand'); }
      G.FX.dust(h.x, h.floor, 12, { w: h.r * 2, speed: 220, size: 16, col: h.crystal ? 'rgba(200,160,255,' : 'rgba(150,135,160,' });
      g.shake(0.18);
    }
  }
  function rockDraw(ctx, h) {
    if (h.t < 0) return;
    const k = U.clamp(h.t / h.warn, 0, 1);
    if (h.t < h.warn + h.fall) {
      // floor telegraph: a shadow that sharpens + a crimson ring that tightens (red = can't be guarded)
      ctx.fillStyle = `rgba(8,3,12,${0.2 + 0.4 * k})`;
      ctx.beginPath(); ctx.ellipse(h.x, h.floor, h.r * (1.9 - 0.7 * k), 6 + 2 * k, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = U.rgba(h.crystal ? MAG : CRIM, 0.3 + 0.6 * k); ctx.lineWidth = 2 + k * 1.5;
      ctx.beginPath(); ctx.ellipse(h.x, h.floor, h.r * (2.4 - 1.1 * k), 8 - 2 * k, 0, 0, TAU); ctx.stroke();
      // a trickle of grit from the ceiling
      ctx.fillStyle = h.crystal ? 'rgba(220,180,255,0.7)' : 'rgba(190,175,200,0.6)';
      for (let i = 0; i < 5; i++) { const py = h.floor - 620 + ((h.t * 640 + i * 131) % 620); ctx.fillRect(h.x + (i - 2) * h.r * 0.35 + Math.sin(i * 7) * 4, py, 2, 6); }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (h.t < h.warn) return;
    if (h.crystal && h.landed) return;
    const fade = h.landed ? 1 - U.clamp((h.t - h.warn - h.fall - 0.35) / 0.5, 0, 1) : 1;
    if (fade <= 0) return;
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(h.x, h.y + (h.landed ? (1 - fade) * 12 : 0)); ctx.rotate(h.rot);
    if (h.crystal) {
      // stalactite: a long violet fang pointing down
      const s = h.r / 20;
      ctx.beginPath(); ctx.moveTo(0, 38 * s); ctx.lineTo(10 * s, -8 * s); ctx.lineTo(6 * s, -34 * s); ctx.lineTo(-6 * s, -36 * s); ctx.lineTo(-11 * s, -6 * s); ctx.closePath();
      ctx.fillStyle = '#5a2a8c'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 38 * s); ctx.lineTo(10 * s, -8 * s); ctx.lineTo(6 * s, -34 * s); ctx.lineTo(0, -35 * s); ctx.closePath(); ctx.fillStyle = '#c48cff'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 38 * s); ctx.lineTo(10 * s, -8 * s); ctx.lineTo(6 * s, -34 * s); ctx.lineTo(-6 * s, -36 * s); ctx.lineTo(-11 * s, -6 * s); ctx.closePath();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,220,255,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(2 * s, 30 * s); ctx.lineTo(6 * s, -24 * s); ctx.stroke();
    } else {
      const R = ramp(C.rock);
      ctx.beginPath(); h.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.fillStyle = R.dark; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.rotate(-h.rot); ctx.fillStyle = R.lit; ctx.beginPath(); ctx.moveTo(-h.r * 2, -h.r * 2); ctx.lineTo(h.r * 2, -h.r * 2); ctx.lineTo(h.r * 2, h.r * 0.3); ctx.lineTo(-h.r * 2, -h.r * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = R.hi; ctx.beginPath(); ctx.moveTo(h.r * 0.2, -h.r * 2); ctx.lineTo(h.r * 2, -h.r * 2); ctx.lineTo(h.r * 2, -h.r * 0.2); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.beginPath(); h.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(h.pts[1][0] * 0.6, h.pts[1][1] * 0.6); ctx.lineTo(0, 0); ctx.lineTo(h.pts[5][0] * 0.5, h.pts[5][1] * 0.5); ctx.stroke();
      // a fleck of Hush crystal in the stone
      ctx.fillStyle = CRY; ctx.beginPath(); ctx.moveTo(h.pts[3][0] * 0.5, h.pts[3][1] * 0.5); ctx.lineTo(h.pts[3][0] * 0.5 + 3, h.pts[3][1] * 0.5 - 7); ctx.lineTo(h.pts[3][0] * 0.5 + 6, h.pts[3][1] * 0.5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function spawnRocks(e, crystal) {
    const ar = arenaOf(e), P = e.P, n = crystal ? 9 : 7;
    const xs = [U.clamp(P.x + P.vx * 0.3, ar.x0 + 60, ar.x1 - 60)];
    for (let guard = 0; xs.length < n && guard < 300; guard++) {
      const x = U.rand(ar.x0 + 60, ar.x1 - 60);
      if (xs.every((q) => Math.abs(q - x) > 128)) xs.push(x);
    }
    xs.forEach((x, i) => G.game.hazards.push(makeRock(e, x, i === 0 ? 0 : 0.15 * i + U.rand(0, 0.12), crystal)));
    G.SFX.play('c3_rumble');
  }
  // fault line: a glowing crack races along the floor and crystal fangs burst up behind it (red: jump or dodge through)
  function makeFault(e, x0, dir, delay, maxLen) {
    const ar = arenaOf(e), end = dir > 0 ? ar.x1 - 12 : ar.x0 + 12, len = Math.min(maxLen || 1e9, Math.max(0, (end - x0) * dir));
    const n = Math.max(1, Math.floor(len / 46)), rng = U.mulberry32(((x0 * 3.7) | 0) + n), speed = 640;
    const spikes = Array.from({ length: n }, (_, i) => ({ x: x0 + dir * (i * 46 + 23), h: 78 + rng() * 46, w: 13 + rng() * 6, lean: (rng() - 0.5) * 0.45, t0: delay + 0.24 + (i * 46) / speed, sub: rng() }));
    return { kind: 'c3_fault', t: 0, life: (spikes.length ? spikes[n - 1].t0 : delay) + 0.8, spikes, dir, x0, delay, speed, floor: floorAt(x0, e.y), owner: e, hit: false, update: faultUpd, draw: faultDraw };
  }
  function faultUpd(h, dt, g) {
    const P = g.player, hb = P.hurtbox;
    h.spikes.forEach((s, i) => {
      const a = h.t - s.t0;
      if (a >= 0 && !s.up) { s.up = true; if (i % 3 === 0) { G.FX.shards(s.x, h.floor - 6, 3, CRY, 300); G.SFX.play('c3_shard'); } if (i % 2 === 0) G.FX.dust(s.x, h.floor, 3, { w: 30, speed: 120, size: 10, col: 'rgba(190,160,230,' }); }
      if (!h.hit && a >= 0 && a < 0.13 && hb.x < s.x + 22 && hb.x + hb.w > s.x - 22 && hb.y + hb.h > h.floor - s.h * U.clamp(a / 0.08, 0.3, 1)) {
        h.hit = true; P.receiveHit({ x: s.x - h.dir * 30, owner: h.owner }, { dmg: 18, unblockable: true, kb: 330, hx: s.x, hy: h.floor - 40 });
      }
    });
  }
  function faultDraw(ctx, h) {
    const t = h.t, y = h.floor;
    // the racing crack (leads the spikes by 0.24 s) — crimson at its head
    const head = h.x0 + h.dir * Math.max(0, (t - h.delay) * h.speed);
    const tail = h.x0, endX = h.spikes.length ? h.spikes[h.spikes.length - 1].x + h.dir * 23 : h.x0;
    const hx = h.dir > 0 ? Math.min(head, endX) : Math.max(head, endX);
    if (t >= h.delay) {
      const fade = 1 - U.clamp((t - h.life + 0.5) / 0.5, 0, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,70,140,${0.75 * fade})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(tail, y - 1);
      for (let x = tail, i = 0; (x - hx) * h.dir < 0; x += h.dir * 14, i++) ctx.lineTo(x, y - 1 - ((i * 7) % 5) * 0.8);
      ctx.lineTo(hx, y - 1); ctx.stroke();
      K.glow(ctx, hx, y - 4, 46, CRIM, 0.55 * fade);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const s of h.spikes) {
      const a = t - s.t0; if (a < 0) continue;
      const rise = U.easeOutBack(U.clamp(a / 0.09, 0, 1)), sinkK = U.clamp((a - 0.42) / 0.3, 0, 1), H = s.h * rise * (1 - sinkK);
      if (H <= 1) continue;
      ctx.save(); ctx.translate(s.x, y); ctx.rotate(s.lean);
      const w = s.w;
      ctx.beginPath(); ctx.moveTo(-w, 2); ctx.lineTo(-w * 0.45, -H * 0.62); ctx.lineTo(0, -H); ctx.lineTo(w * 0.5, -H * 0.58); ctx.lineTo(w, 2); ctx.closePath();
      ctx.fillStyle = '#4b2178'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -H); ctx.lineTo(w * 0.5, -H * 0.58); ctx.lineTo(w, 2); ctx.closePath(); ctx.fillStyle = '#b57cff'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-w, 2); ctx.lineTo(-w * 0.45, -H * 0.62); ctx.lineTo(0, -H); ctx.lineTo(w * 0.5, -H * 0.58); ctx.lineTo(w, 2); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
      // a smaller side fang
      const sh = H * (0.45 + s.sub * 0.2), sx = (s.sub > 0.5 ? 1 : -1) * w * 0.9;
      ctx.beginPath(); ctx.moveTo(sx - 6, 2); ctx.lineTo(sx + (sx > 0 ? 5 : -5), -sh); ctx.lineTo(sx + 6, 2); ctx.closePath(); ctx.fillStyle = '#8a4fd6'; ctx.fill(); ctx.stroke();
      if (a < 0.2) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,220,255,${0.8 * (1 - a / 0.2)})`; ctx.beginPath(); ctx.moveTo(-w, 2); ctx.lineTo(0, -H); ctx.lineTo(w, 2); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
  }
  // rear exhaust: a scalding plume billowing out behind the rig
  function makeSteam(e) {
    const f = e.facing;
    return { kind: 'c3_steam', t: 0, life: 1.25, x0: e.x - f * 150, dir: -f, floor: e.y, owner: e, hit: false, crys: e.crys || 0, update: steamUpd, draw: steamDraw };
  }
  const steamReach = (h) => 350 * U.easeOutCubic(U.clamp(h.t / 0.36, 0, 1));
  function steamUpd(h, dt, g) {
    if (h.hit || h.t > 0.55) return;
    const P = g.player, hb = P.hurtbox, r = steamReach(h), xa = Math.min(h.x0, h.x0 + h.dir * r), xb = Math.max(h.x0, h.x0 + h.dir * r);
    if (hb.x < xb && hb.x + hb.w > xa && hb.y < h.floor && hb.y + hb.h > h.floor - 250) {
      h.hit = true; P.receiveHit({ x: h.x0, owner: h.owner }, { dmg: 18, unblockable: true, kb: 430, hx: P.x, hy: P.y - 60 });
    }
  }
  function steamDraw(ctx, h) {
    const r = steamReach(h), fade = 1 - U.clamp((h.t - 0.5) / 0.75, 0, 1);
    for (let i = 8; i >= 0; i--) {
      const u = i / 8, x = h.x0 + h.dir * r * u, y = h.floor - 92 - Math.sin(u * 2.4) * 40 + (1 - fade) * -30 * u, rr = (24 + 46 * u) * (0.6 + 0.4 * fade + h.t * 0.4);
      ctx.fillStyle = `rgba(92,78,120,${0.5 * fade})`; ctx.beginPath(); ctx.arc(x + h.dir * 4, y + 6, rr, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(236,230,246,${0.62 * fade})`; ctx.beginPath(); ctx.arc(x - h.dir * 3, y - 3, rr * 0.86, 0, TAU); ctx.fill();
    }
    if (h.t < 0.35) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, h.x0 + h.dir * 40, h.floor - 160, 120, h.crys > 0.5 ? CRY : ORE, 0.6 * (1 - h.t / 0.35)); ctx.globalCompositeOperation = 'source-over'; }
  }
  // crystal shard (spiral spray): white — a perfect guard sends it back into the rig
  function fireShard(e, x, y, ang, sp) {
    G.game.hazards.push({ kind: 'c3_shard', t: 0, life: 3, x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, owner: e, refl: false, passed: false, update: shardUpd, draw: shardDraw });
  }
  function shardUpd(h, dt, g) {
    h.x += h.vx * dt; h.y += h.vy * dt;
    const floor = G.Phys.groundBelow(h.x, h.y - 40);
    if (h.y >= floor - 2) { h.done = true; G.FX.shards(h.x, floor - 4, 3, h.refl ? '#7ff4ff' : CRY, 240); return; }
    const ar = G.game.arena;
    if (ar && (h.x < ar.x0 - 60 || h.x > ar.x1 + 60)) { h.done = true; return; }
    const P = g.player;
    if (!h.refl) {
      if (h.passed) return;
      const hb = P.hurtbox, r = 9;
      if (h.x + r > hb.x && h.x - r < hb.x + hb.w && h.y + r > hb.y && h.y - r < hb.y + hb.h) {
        const res = P.receiveHit(h, { dmg: 12, kb: 170, projectile: true, hx: h.x, hy: h.y });
        if (res === 'parried') {
          const o = h.owner, a = Math.atan2(o.cy - 40 - h.y, o.cx - h.x);
          h.refl = true; h.vx = Math.cos(a) * 980; h.vy = Math.sin(a) * 980; h.life = h.t + 2;
          G.FX.ring(h.x, h.y, 6, 60, 0.3, '#7ff4ff', 4);
        } else if (res === 'dodged' || res === 'ignored') h.passed = true;
        else { h.done = true; G.FX.shards(h.x, h.y, 4, CRY, 260); }
      }
    } else {
      const o = h.owner;
      if (o && !o.dead) {
        const b = o.box;
        if (h.x > b.x && h.x < b.x + b.w && h.y > b.y && h.y < b.y + b.h) {
          o.takeHit({ dmg: 26 * (P.dmgMul || 1), bal: 40, hx: h.x, hy: h.y, big: true });
          g.hitstop(0.06); g.shake(0.35); G.SFX.play('hit', 1.2); G.SFX.play('c3_shard'); h.done = true;
        }
      }
    }
  }
  function shardDraw(ctx, h) {
    const a = Math.atan2(h.vy, h.vx), col = h.refl ? '#7ff4ff' : CRY;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = U.rgba(col, 0.35); ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x - Math.cos(a) * 46, h.y - Math.sin(a) * 46); ctx.stroke();
    K.glow(ctx, h.x, h.y, 26, col, 0.5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(h.x, h.y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(0, -6); ctx.lineTo(-13, 0); ctx.lineTo(0, 6); ctx.closePath();
    ctx.fillStyle = h.refl ? '#bff8ff' : '#9a5ae8'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(0, -6); ctx.lineTo(-13, 0); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(0, -6); ctx.lineTo(-13, 0); ctx.lineTo(0, 6); ctx.closePath(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
  }
  // burrow eruption debris (visual only — the eruption's hit is the attack's own hitbox)
  function makeErupt(x, y) {
    const rng = U.mulberry32((x | 0) + 991), fangs = Array.from({ length: 7 }, (_, i) => ({ dx: (i - 3) * 26 + (rng() - 0.5) * 12, h: 50 + rng() * 70 - Math.abs(i - 3) * 9, lean: (i - 3) * 0.16 + (rng() - 0.5) * 0.2 }));
    return {
      kind: 'c3_erupt', t: 0, life: 1.1, x, y, fangs,
      update() { },
      draw(ctx, h) {
        const k = U.easeOutBack(U.clamp(h.t / 0.14, 0, 1)) * (1 - U.clamp((h.t - 0.6) / 0.5, 0, 1));
        if (k <= 0) return;
        for (const f of h.fangs) {
          const H = f.h * k; ctx.save(); ctx.translate(h.x + f.dx, h.y); ctx.rotate(f.lean);
          ctx.beginPath(); ctx.moveTo(-11, 2); ctx.lineTo(0, -H); ctx.lineTo(11, 2); ctx.closePath(); ctx.fillStyle = '#56258a'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -H); ctx.lineTo(11, 2); ctx.closePath(); ctx.fillStyle = '#c08aff'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(-11, 2); ctx.lineTo(0, -H); ctx.lineTo(11, 2); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
          ctx.restore();
        }
      },
    };
  }

  /* =========================== attack definitions =========================== */
  const atWorld = (e, q) => ({ x: e.x + e.facing * q.x, y: e.y + q.y });
  function boreLunge(e) {
    const P = e.P, d = Math.abs(P.x - e.x);
    // close the gap so the drill tip (≈ 360 out) ends just past the target
    e.boreV = U.clamp((d - 200) / 0.32, 220, 1050);
  }
  function digFx(e) {
    const g = geo(e.pose || POSE0), q = atWorld(e, g.tip);
    G.FX.dust(q.x, e.y, 18, { w: 60, speed: 260, size: 16, col: 'rgba(160,140,170,' }); G.FX.shards(q.x, e.y - 6, 10, e.crys > 0.5 ? CRY : '#9a8ea4', 420);
    G.FX.spark(q.x, e.y - 10, 16, { col: EMBER, speed: 700, dir: -PI / 2, spread: 2.4 });
    G.game.shake(0.55); G.SFX.play('c3_clang', 1); G.SFX.play('c3_grind');
  }
  function slamFx(e, x, big) {
    G.FX.dust(x, e.y, big ? 22 : 12, { w: big ? 90 : 50, speed: big ? 320 : 220, size: big ? 18 : 13, col: 'rgba(165,145,175,' });
    G.FX.ring(x, e.y - 4, 10, big ? 200 : 120, 0.4, big ? '#ffffff' : '#ffe2c0', big ? 6 : 4, { flat: 0.16 });
    G.FX.spark(x, e.y - 8, big ? 14 : 8, { col: EMBER, speed: 560, dir: -PI / 2, spread: 2.6 });
    G.game.shake(big ? 0.6 : 0.35); G.SFX.play('c3_clang', big ? 1.2 : 0.8);
  }

  const ATK = {};
  ATK.swing = {
    dur: 2.45, cd: 1.1, keys: SWING_K, at: 'drill', poise: true,
    tells: [tw(0.2), tw(0.95)],
    hits: [
      { t0: 0.69, t1: 0.8, box: drillBox(SWING_K, 0.62, 0.8), dmg: 17, kb: 300, pbal: 40 },
      { t0: 1.43, t1: 1.56, box: drillBox(SWING_K, 1.34, 1.56), dmg: 18, kb: 340, last: true, pbal: 55 },
    ],
    ev: [{ t: 0.3, fn: sfx('c3_drillRev', 0.6) }, { t: 0.69, fn: sfx('whoosh', 1.3) }, { t: 0.77, fn: (e) => slamFx(e, atWorld(e, geo(e.pose || POSE0).tip).x, false) }, { t: 1.43, fn: sfx('whoosh', 1.2) }],
  };
  ATK.swing3 = {
    dur: 3.1, cd: 1.0, keys: SW3_K, at: 'drill',
    tells: [tw(0.1), tw(0.76), tr(1.4)],
    hits: [
      { t0: 0.57, t1: 0.68, box: drillBox(SW3_K, 0.5, 0.68), dmg: 18, kb: 300, pbal: 40 },
      { t0: 1.22, t1: 1.34, box: drillBox(SW3_K, 1.14, 1.34), dmg: 18, kb: 320, pbal: 45 },
      { t0: 2.04, t1: 2.3, box: drillBox(SW3_K, 2.06, 2.3), dmg: 25, red: true, kb: 440, last: true },
    ],
    moves: [{ t0: 2.04, t1: 2.26, v: 720 }],
    ev: [{ t: 0.2, fn: sfx('c3_drillRev', 0.6) }, { t: 0.57, fn: sfx('whoosh', 1.3) }, { t: 0.65, fn: (e) => slamFx(e, atWorld(e, geo(e.pose || POSE0).tip).x, false) }, { t: 1.22, fn: sfx('whoosh', 1.2) }, { t: 1.5, fn: sfx('c3_drillRev', 1) }, { t: 2.04, fn: sfx('slash', 0.5, true) }],
  };
  ATK.bore = {
    dur: 3.1, cd: 1.2, keys: BORE_K, at: 'drill', track: false,
    tells: [tr(0.3)],
    hits: [{ t0: 0.98, t1: 1.34, box: drillBox(BORE_K, 0.98, 1.34), dmg: 26, red: true, kb: 470, last: true }],
    ev: [{ t: 0.25, fn: sfx('c3_drillRev', 1.2) }, { t: 0.92, fn: boreLunge }, { t: 0.98, fn: sfx('slash', 0.45, true) }, { t: 1.48, fn: digFx }, { t: 2.5, fn: sfx('c3_hydraulic') }],
    upd(e, dt, st) {
      if (st > 0.3 && st < 0.95 && Math.random() < dt * 18) G.FX.dust(e.x - e.facing * 150, e.y, 2, { w: 30, speed: 160, size: 12, dir: e.facing > 0 ? PI : 0, spread: 0.6 });
      if (st >= 0.96 && st < 1.32) e.vx = e.facing * (e.boreV || 600) * e.speedMul;
      else if (st >= 1.32 && st < 1.6) e.vx = U.approach(e.vx, 0, 3200 * dt);
      if (st > 1.5 && st < 2.45 && Math.random() < dt * 10) { const q = atWorld(e, geo(e.pose || POSE0).tip); G.FX.spark(q.x, e.y - 8, 2, { col: EMBER, speed: 380, dir: -PI / 2, spread: 2 }); }
    },
  };
  ATK.piston = {
    dur: 3.1, cd: 1.1, keys: PIST_K, at: 'claw',
    tells: [tw(0.15), tw(0.74), tw(1.55)],
    hits: [
      { t0: 0.64, t1: 0.78, box: clawBox(PIST_K, 0.62, 0.78), dmg: 14, kb: 240, pbal: 45 },
      { t0: 1.22, t1: 1.36, box: clawBox(PIST_K, 1.2, 1.36), dmg: 14, kb: 240, pbal: 45 },
      { t0: 2.02, t1: 2.16, box: clawBox(PIST_K, 2.0, 2.16), dmg: 20, kb: 380, last: true, pbal: 85 },
    ],
    ev: [
      { t: 0.05, fn: sfx('c3_hydraulic') }, { t: 0.7, fn: (e) => slamFx(e, atWorld(e, geo(e.pose || POSE0).hc).x, false) },
      { t: 1.28, fn: (e) => slamFx(e, atWorld(e, geo(e.pose || POSE0).hc).x, false) }, { t: 1.6, fn: sfx('c3_hydraulic') },
      { t: 2.08, fn: (e) => {
        const x = atWorld(e, geo(e.pose || POSE0).hc).x; slamFx(e, x, true);
        // phase II: the last blow splits the floor both ways (short fault lines). They start a step away from the
        // impact and only after the crack has run for 0.3 s, so a player who guarded/parried the (white) claw on the
        // spot is never hit by an unblockable spike that had no tell of its own.
        if (e.phase === 2) { G.game.hazards.push(makeFault(e, x + e.facing * 70, e.facing, 0.3, 300)); G.game.hazards.push(makeFault(e, x - e.facing * 70, -e.facing, 0.3, 260)); }
      } },
    ],
  };
  ATK.grab = {
    dur: 2.65, cd: 1.2, keys: GRAB_K, at: 'claw', track: false,
    tells: [tr(0.3)],
    onStart(e) { e.grabTried = false; },
    ev: [{ t: 0.1, fn: sfx('c3_hydraulic') }, { t: 0.92, fn: sfx('whoosh', 1.5) }, { t: 1.0, fn: (e) => { if (!e.grabbing) slamFx(e, atWorld(e, geo(e.pose || POSE0).hc).x, false); } }, { t: 2.0, fn: sfx('c3_hydraulic') }],
    upd(e, dt, st) {
      if (e.grabTried || st < 0.92 || st > 1.16) return;
      const P = e.P, g = geo(e.pose || POSE0), c = atWorld(e, g.hc), hb = P.hurtbox;
      if (Math.abs(P.x - c.x) < 34 + hb.w / 2 && hb.y < c.y + 30 && hb.y + hb.h > c.y - 30) {
        e.grabTried = true;
        const res = P.receiveHit(e, { dmg: 10, unblockable: true, kb: 0, hx: c.x, hy: c.y });
        if (res === 'hit' && P.hp > 0) { e.startAtk(TYPES.c3_boss.grabHold); e.grabbing = true; e.grindHit = false; G.SFX.play('c3_clang', 1.1); G.game.shake(0.5); }
      }
    },
  };
  ATK.grabHold = {
    dur: 2.1, cd: 1.2, keys: HOLD_K, at: 'drill', track: false,
    ev: [{ t: 0.5, fn: sfx('c3_drillRev', 1.2) }, { t: 0.62, fn: sfx('c3_grind') }],
    upd(e, dt, st) {
      const P = e.P;
      if (!e.grabbing) return;
      if (P.state === 'dead' || P.hp <= 0) { e.grabbing = false; return; }
      const g = geo(e.pose || POSE0), hd = atWorld(e, g.hd);
      if (st < 1.3) {
        P.x = hd.x + e.facing * 16; P.y = Math.min(e.y, hd.y + 98); P.vx = 0; P.vy = 0; P.facing = -e.facing;
        if (P.state !== 'hurt') P.setState('hurt', 0.03);
        P.st = 0; P.hurtInv = Math.max(P.hurtInv, 0.12);
        if (st > 0.55 && Math.random() < 0.7) { const q = atWorld(e, g.tip); G.FX.spark(q.x, q.y, 3, { col: EMBER, speed: 520 }); }
        if (st >= 1.12 && !e.grindHit) {
          e.grindHit = true; P.hurtInv = 0;
          P.receiveHit(e, { dmg: 16, unblockable: true, kb: 0, hx: P.x, hy: P.y - 60 });
          G.game.shake(0.5); G.game.hitstop(0.06);
        }
      } else {
        e.grabbing = false; P.hurtInv = 0.45;
        if (P.state !== 'dead') { P.vx = e.facing * 640; P.vy = -430; P.setState('hurt', 0.03); }
        G.SFX.play('whoosh', 1.4); G.game.shake(0.4);
      }
    },
  };
  ATK.buck = {
    dur: 1.7, cd: 1.0, keys: BUCK_K, at: 'drill', track: false,
    tells: [tw(0.15)],
    hits: [{ t0: 0.68, t1: 0.8, box: { x: -150, y: -150, w: 345, h: 150 }, dmg: 18, kb: 380, last: true, pbal: 50 }],
    ev: [{ t: 0.12, fn: sfx('c3_engine', 1.4) }, { t: 0.72, fn: (e) => { slamFx(e, e.x + e.facing * 140, true); G.FX.ring(e.x, e.y - 4, 20, 260, 0.45, '#ffe2c0', 5, { flat: 0.14 }); } }],
  };
  ATK.vent = {
    dur: 1.9, cd: 0.9, keys: VENT_K, at: 'pipes', track: false,
    tells: [tr(0.12)],
    ev: [{ t: 0.2, fn: sfx('c3_hydraulic') }, { t: 0.78, fn: (e) => { G.game.hazards.push(makeSteam(e)); G.SFX.play('c3_steam'); G.game.shake(0.35); } }],
  };
  ATK.rockfall = {
    dur: 2.6, cd: 1.2, keys: ROCK_K, at: 'drill', track: false,
    tells: [tr(0.25)],
    ev: [
      { t: 0.3, fn: sfx('c3_drillRev', 1.2) },
      { t: 0.55, fn: (e) => { G.game.shake(0.8); G.SFX.play('c3_grind'); const q = atWorld(e, geo(e.pose || POSE0).tip); G.FX.spark(q.x, q.y, 20, { col: EMBER, speed: 700, dir: PI / 2, spread: 2 }); } },
      { t: 0.6, fn: (e) => spawnRocks(e, e.phase === 2) },
    ],
    upd(e, dt, st) {
      if (st > 0.55 && st < 1.6) { G.game.shake(dt * 1.2); if (Math.random() < dt * 14) { const q = atWorld(e, geo(e.pose || POSE0).tip); G.FX.dust(q.x, q.y + 30, 2, { w: 40, speed: 80, size: 12, col: 'rgba(150,135,160,' }); } }
    },
  };
  ATK.burrow = {
    dur: 5.95, cd: 1.0, keys: BUR_K, track: false,
    at: (st) => (st < 0.8 ? 'drill' : 'floor'),
    tells: [tr(0.22), tr(2.0), tr(3.85)],
    hits: [
      { t0: 2.6, t1: 2.88, box: { x: -95, y: -360, w: 190, h: 360 }, dmg: 24, red: true, kb: 420 },
      { t0: 4.48, t1: 4.74, box: { x: -110, y: -380, w: 220, h: 380 }, dmg: 26, red: true, kb: 460, last: true },
    ],
    ev: [
      { t: 0.3, fn: sfx('c3_drillRev', 1.3) }, { t: 0.62, fn: (e) => { digFx(e); G.SFX.play('c3_rumble'); } },
      { t: 1.0, fn: (e) => { G.FX.dust(e.x, e.y, 30, { w: 300, speed: 300, size: 22, col: 'rgba(150,130,165,' }); G.game.shake(0.7); } },
      { t: 2.0, fn: sfx('c3_rumble') }, { t: 3.85, fn: sfx('c3_rumble') },
      { t: 2.6, fn: (e) => { G.game.hazards.push(makeErupt(e.x, e.y)); G.FX.shards(e.x, e.y - 20, 24, CRY, 620); G.SFX.play('c3_crystal'); G.game.shake(0.8); } },
      { t: 4.4, fn: (e) => { const ar = arenaOf(e); e.x = U.clamp(e.x, ar.x0 + 170, ar.x1 - 170); e.facing = e.P.x < e.x ? -1 : 1; } },
      { t: 4.48, fn: (e) => { G.game.hazards.push(makeErupt(e.x, e.y)); G.FX.shards(e.x, e.y - 20, 30, CRY, 700); G.FX.dust(e.x, e.y, 30, { w: 320, speed: 340, size: 22, col: 'rgba(170,140,200,' }); G.SFX.play('c3_crystal'); G.SFX.play('roar'); G.game.shake(1); } },
    ],
    upd(e, dt, st) {
      e.invuln = st >= 0.95 && st < 4.5;
      const ar = arenaOf(e), P = e.P;
      const travel = (st >= 1.25 && st < 2.0) || (st >= 3.3 && st < 3.85);
      if (travel) { e.vx = U.clamp((P.x - e.x) * 4, -620, 620); if (Math.random() < dt * 22) G.FX.dust(e.x, e.y, 2, { w: 60, speed: 140, size: 13, col: 'rgba(150,130,165,' }); if (Math.random() < dt * 4) G.SFX.play('c3_treads'); }
      else if (st >= 0.6) e.vx = 0;
      // same bounds as the final re-emergence, so the marked spot never jumps after its red tell
      if (st < 4.4) e.x = U.clamp(e.x, ar.x0 + 170, ar.x1 - 170);
    },
  };
  ATK.spiral = {
    dur: 3.6, cd: 1.2, keys: SPI_K, at: 'drill', track: false,
    tells: [tw(0.3)],
    ev: [{ t: 0.35, fn: sfx('c3_drillRev', 1.3) }].concat(Array.from({ length: 17 }, (_, i) => ({
      t: 0.95 + i * 0.1, fn: (e) => {
        const g = geo(e.pose || POSE0), q = atWorld(e, g.tip), u = i / 16;
        const th = 1.3 - 1.02 * (0.5 - 0.5 * Math.cos(u * TAU));
        const dir = (a) => (e.facing > 0 ? a : PI - a);
        fireShard(e, q.x, q.y, dir(th), 560);
        if (i % 4 === 2) fireShard(e, q.x, q.y, dir(th + 0.2), 520);
        G.SFX.play('c3_shard'); G.FX.spark(q.x, q.y, 3, { col: CRYL, speed: 400 });
      },
    }))),
  };
  ATK.fault = {
    dur: 2.4, cd: 1.1, keys: FAULT_K, at: 'drill',
    tells: [tr(0.18)],
    hits: [{ t0: 0.78, t1: 0.9, box: drillBox(FAULT_K, 0.72, 0.9), dmg: 22, red: true, kb: 420 }],
    ev: [
      { t: 0.25, fn: sfx('c3_drillRev', 1.1) },
      { t: 0.82, fn: (e) => {
        const tip = atWorld(e, geo(e.pose || POSE0).tip).x; digFx(e); G.SFX.play('c3_crystal');
        G.game.hazards.push(makeFault(e, tip, e.facing, 0)); G.game.hazards.push(makeFault(e, e.x - e.facing * 170, -e.facing, 0.22));
      } },
    ],
  };
  ATK.transform = {
    dur: 2.6, cd: 0.6, keys: TRANS_K, track: false,
    ev: [
      { t: 0.1, fn: sfx('c3_hadal', 2) },
      { t: 0.75, fn: (e) => {
        const q = atWorld(e, geo(e.pose || POSE0).tip);
        G.FX.shards(q.x, q.y, 26, '#a9afc2', 560); G.FX.shards(q.x, q.y, 26, CRY, 640); G.FX.flash(q.x, q.y, 220, 0.5, CRY);
        G.FX.ring(e.x, e.y - 150, 20, 420, 0.8, CRY, 7); G.SFX.play('c3_crystal'); G.SFX.play('c3_steam'); G.game.shake(1);
      } },
      { t: 1.4, fn: sfx('c3_drillRev', 1.4) },
    ],
    upd(e, dt, st) { e.invuln = st < 2.2; e.crys = U.clamp((st - 0.75) / 1.0, 0, 1); if (st > 0.8 && st < 2 && Math.random() < dt * 20) { const q = atWorld(e, geo(e.pose || POSE0).tip); G.FX.ember(q.x, q.y, 2, CRY, { w: 60, h: 60, up: 90 }); } },
  };

  /* =========================== AI =========================== */
  const BIG = { rockfall: 1, burrow: 1, spiral: 1, fault: 1 };
  function choose(e, d) {
    const p2 = e.phase === 2, bigReady = e.t - e.lastBig > (p2 ? 6.5 : 8.5), pool = [];
    const add = (k, w) => { if (w > 0) pool.push([k, w]); };
    const sw = p2 ? 'swing3' : 'swing';
    if (d < 140) { add('buck', 4); add('piston', 1); }
    else if (d < 285) { add(sw, 3); add('piston', 2.6); add('grab', 1.4); if (d < 175) add('buck', 1); }
    else if (d < 430) { add('grab', 2.6); add('bore', 2.4); add(sw, 0.8); }
    else if (d < 720) add('bore', 3);
    if (bigReady) { add('rockfall', p2 ? 1.2 : 2.2); if (p2) { add('burrow', 2.4); add('spiral', d > 200 ? 2.6 : 1.2); add('fault', 2); } }
    if (!pool.length) return false;
    const last = e.lastMoves[e.lastMoves.length - 1];
    const wOf = (p) => (p[0] === last ? p[1] * 0.2 : p[1]);
    let r = Math.random() * pool.reduce((s, p) => s + wOf(p), 0), pick = pool[0][0];
    for (const p of pool) { if ((r -= wOf(p)) <= 0) { pick = p[0]; break; } }
    e.lastMoves.push(pick); if (e.lastMoves.length > 6) e.lastMoves.shift();
    if (BIG[pick]) e.lastBig = e.t;
    e.startAtk(TYPES.c3_boss[pick]);
    return true;
  }

  /* =========================== rendering helpers =========================== */
  const poly = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
  const ink = (g, w = 1.6) => { g.strokeStyle = INK; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
  const fillInk = (g, col, w = 1.6) => { g.fillStyle = col; g.fill(); ink(g, w); };
  function rivets(g, pts, r = 1.5) {
    g.fillStyle = '#1b1422'; g.beginPath(); for (const [x, y] of pts) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } g.fill();
    g.fillStyle = 'rgba(255,238,205,0.6)'; g.beginPath(); for (const [x, y] of pts) { g.moveTo(x + r * 0.2, y - r * 0.35); g.arc(x - r * 0.25, y - r * 0.35, r * 0.42, 0, TAU); } g.fill();
  }
  const row = (x0, x1, y, step) => { const a = []; for (let x = x0; x <= x1 + 0.1; x += step) a.push([x, y]); return a; };
  const col = (x, y0, y1, step) => { const a = []; for (let y = y0; y <= y1 + 0.1; y += step) a.push([x, y]); return a; };
  // vertical cylinder with hard cel bands (ls = +1 when the light comes from local +x)
  function cylinder(g, cx, w, top, bot, hex, ls) {
    const r = ramp(hex), x0 = cx - w / 2;
    const band = (a, b, c) => { g.fillStyle = c; g.fillRect(ls > 0 ? x0 + a * w : x0 + (1 - b) * w, top, (b - a) * w, bot - top); };
    g.fillStyle = r.base; g.fillRect(x0, top, w, bot - top);
    band(0, 0.26, r.dark); band(0.55, 1, r.lit); band(0.7, 0.8, r.hi); band(0, 0.08, r.bounce);
    g.beginPath(); g.rect(x0, top, w, bot - top); ink(g, 1.7);
  }

  /* --------- cached layers: the static paintwork is drawn once per facing (light side flips with it) --------- */
  const CACHE = {};
  const BOX_A = { x0: -228, y0: -372, x1: 40, y1: -168 };    // organ-pipe stacks, throne, banner pole
  const BOX_B = { x0: -206, y0: -222, x1: 200, y1: -2 };    // hull, fender, cockpit collar
  function cached(key, box, f, paint) {
    const R = G.Quality.low ? 1.35 : 2, id = key + f;
    let c = CACHE[id];
    if (c && c.R === R) return c;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((box.x1 - box.x0) * R); cv.height = Math.ceil((box.y1 - box.y0) * R);
    const g = cv.getContext('2d');
    g.setTransform(f * R, 0, 0, R, f > 0 ? -box.x0 * R : box.x1 * R, -box.y0 * R);
    g.lineJoin = 'round'; g.lineCap = 'round';
    paint(g, Rig.lightDir(g).x > 0 ? 1 : -1);
    c = CACHE[id] = { cv, R };
    return c;
  }
  function blit(ctx, c, box, f) {
    ctx.save(); ctx.scale(f, 1);
    ctx.drawImage(c.cv, f > 0 ? box.x0 : -box.x1, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    ctx.restore();
  }
  const PIPES = [[-183, 17, -292, C.brass], [-162, 21, -342, C.iron], [-140, 18, -314, C.brass], [-119, 16, -278, C.iron], [-101, 13, -250, C.brass]];
  const PIPE_BASE = -188;
  const EYES = [[116, -150], [134, -127]];
  const mouthY = (i) => PIPE_BASE - 34 - (i % 2) * 16;

  function paintBack(g, ls) {
    const rng = U.mulberry32(3303);
    // banner pole with a crossbar
    g.beginPath(); g.moveTo(-190, -186); g.lineTo(-208, -344); g.lineWidth = 7; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3.6; g.strokeStyle = '#4a4458'; g.stroke();
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,230,190,0.45)'; g.beginPath(); g.moveTo(-190 + ls, -190); g.lineTo(-207.5 + ls, -340); g.stroke();
    g.beginPath(); g.moveTo(-222, -334); g.lineTo(-196, -337); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#5c556b'; g.stroke();
    poly(g, [[-212, -344], [-208, -356], [-204, -344]]); fillInk(g, C.brass, 1.4);
    // throne back plate: gothic iron with a cog halo behind Hadal's head
    const th = [[-76, -186], [-82, -272], [-64, -314], [-46, -300], [-26, -358], [-6, -300], [12, -314], [28, -272], [20, -186]];
    const ir = ramp(C.iron);
    poly(g, th); g.fillStyle = ir.base; g.fill();
    g.save(); poly(g, th); g.clip();
    g.fillStyle = ls > 0 ? ir.lit : ir.dark; g.fillRect(ls > 0 ? -20 : -90, -370, 70, 190);
    g.fillStyle = ir.dark; g.fillRect(ls > 0 ? -90 : 6, -370, 24, 190);
    g.restore();
    poly(g, th); ink(g, 2.2);
    poly(g, [[-68, -190], [-72, -266], [-56, -298], [-26, -336], [4, -298], [18, -266], [13, -190]]); g.strokeStyle = U.rgba(C.brass, 0.85); g.lineWidth = 2; g.stroke();
    rivets(g, col(-72, -258, -196, 13).concat(col(16, -258, -196, 13)), 1.6);
    // cog halo
    const cx = -8, cy = -284, br = ramp(C.brass);
    g.beginPath();
    for (let i = 0; i < 14; i++) { const a0 = (i / 14) * TAU, a1 = a0 + TAU / 28; g.arc(cx, cy, 44, a0, a1); g.arc(cx, cy, 37, a1, a1 + TAU / 28); }
    g.closePath(); g.fillStyle = br.base; g.fill(); ink(g, 1.6);
    g.beginPath(); g.arc(cx, cy, 37, ls > 0 ? -1.9 : 1.2, ls > 0 ? 0.3 : 3.4); g.strokeStyle = br.hi; g.lineWidth = 2.5; g.stroke();
    g.beginPath(); g.arc(cx, cy, 27, 0, TAU); g.fillStyle = '#17111d'; g.fill(); ink(g, 1.4);
    // organ-pipe exhaust stacks
    PIPES.forEach(([x, w, top, hex], i) => {
      cylinder(g, x, w, top + 6, PIPE_BASE, hex, ls);
      const r = ramp(hex);
      // bands
      for (let y = top + 30; y < PIPE_BASE - 20; y += 34) {
        g.fillStyle = r.dark; g.fillRect(x - w / 2 - 1.5, y, w + 3, 5); g.fillStyle = r.hi; g.fillRect(x - w / 2 - 1.5, y, w + 3, 1.4);
        g.beginPath(); g.rect(x - w / 2 - 1.5, y, w + 3, 5); ink(g, 1);
      }
      // flared crown + dark bore
      poly(g, [[x - w / 2, top + 10], [x - w / 2 - 4, top], [x + w / 2 + 4, top], [x + w / 2, top + 10]]); fillInk(g, r.lit, 1.5);
      g.beginPath(); g.ellipse(x, top, w / 2 + 4, 3.2, 0, 0, TAU); fillInk(g, '#120c14', 1.2);
      // organ mouth: a dark slot with a lip
      const my = mouthY(i);
      poly(g, [[x - w * 0.32, my], [x + w * 0.32, my], [x + w * 0.32, my + 9], [x, my + 15], [x - w * 0.32, my + 9]]); fillInk(g, '#140c12', 1.2);
      g.fillStyle = r.hi; g.fillRect(x - w * 0.32, my - 2.5, w * 0.64, 2);
      // soot streaks running down from the crown
      g.fillStyle = 'rgba(14,8,18,0.45)';
      for (let k = 0; k < 3; k++) { const sx = x - w / 2 + 2 + rng() * (w - 4); g.fillRect(sx, top + 10, 1.4, 20 + rng() * 40); }
    });
    // braided hoses from the stacks to the throne
    const hose = (pts, w, c) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]); g.lineCap = 'round'; g.lineWidth = w + 3.2; g.strokeStyle = INK; g.stroke(); g.lineWidth = w; g.strokeStyle = c; g.stroke(); g.lineWidth = w * 0.3; g.strokeStyle = 'rgba(255,235,210,0.35)'; g.stroke(); };
    hose([[-110, -230], [-92, -250], [-80, -236], [-66, -246]], 6, C.rubber);
    hose([[-128, -205], [-100, -214], [-84, -200], [-66, -210]], 5, '#3b2f3a');
  }

  function paintHull(g, ls) {
    const rng = U.mulberry32(3311), pr = ramp(C.paint), ir = ramp(C.iron);
    // the side slab
    const S = [[-188, -82], [-192, -160], [-170, -184], [54, -184], [104, -168], [150, -114], [156, -82]];
    poly(g, S); g.fillStyle = pr.base; g.fill();
    g.save(); poly(g, S); g.clip();
    g.fillStyle = pr.lit; g.fillRect(-200, -200, 400, 36);                 // sunlit upper band
    g.fillStyle = pr.dark; g.fillRect(-200, -104, 400, 40);                // shadowed belly
    poly(g, [[40, -184], [104, -168], [150, -114], [156, -82], [126, -82], [122, -112], [84, -162]]); g.fillStyle = ls > 0 ? pr.lit : pr.dark; g.fill(); // glacis
    poly(g, [[-196, -82], [-196, -170], [-170, -186], [-160, -186], [-170, -160], [-168, -82]]); g.fillStyle = ls > 0 ? pr.dark : pr.lit; g.fill();   // rear plate
    g.fillStyle = pr.hi; g.fillRect(-200, -184, 400, 2.5);
    // hazard stripes along the belly
    g.save(); g.beginPath(); g.rect(-160, -100, 280, 11); g.clip();
    g.fillStyle = '#e0b445'; g.fillRect(-160, -100, 280, 11); g.fillStyle = '#1a1420';
    for (let x = -170; x < 130; x += 16) { g.beginPath(); g.moveTo(x, -89); g.lineTo(x + 8, -89); g.lineTo(x + 19, -100); g.lineTo(x + 11, -100); g.closePath(); g.fill(); }
    g.restore();
    g.beginPath(); g.rect(-160, -100, 280, 11); ink(g, 1);
    // grime: the paint darkens toward the tracks; soot blooms over the furnace
    const gg = g.createLinearGradient(0, -170, 0, -84);
    gg.addColorStop(0, 'rgba(34,14,44,0)'); gg.addColorStop(1, 'rgba(34,14,44,0.5)');
    g.fillStyle = gg; g.fillRect(-200, -190, 400, 110);
    const sg = g.createRadialGradient(-118, -168, 4, -118, -168, 70);
    sg.addColorStop(0, 'rgba(20,10,24,0.55)'); sg.addColorStop(1, 'rgba(20,10,24,0)');
    g.fillStyle = sg; g.fillRect(-190, -190, 150, 90);
    // panel seams + rivets
    g.strokeStyle = 'rgba(11,6,18,0.7)'; g.lineWidth = 1.1;
    for (const x of [-126, -52, 20]) { g.beginPath(); g.moveTo(x, -182); g.lineTo(x, -101); g.stroke(); }
    g.beginPath(); g.moveTo(-168, -140); g.lineTo(84, -140); g.stroke();
    g.beginPath(); g.moveTo(84, -162); g.lineTo(122, -112); g.lineTo(126, -82); g.stroke();
    let rv = row(-160, 76, -177, 11).concat(row(-160, 76, -134, 11));
    for (const x of [-126, -52, 20]) rv = rv.concat(col(x + 4, -170, -108, 10));
    rivets(g, rv, 1.4);
    // paint chips, scratches and rust tears
    for (let i = 0; i < 26; i++) {
      const x = -180 + rng() * 300, y = -180 + rng() * 80, s = 2 + rng() * 5;
      g.fillStyle = rng() < 0.6 ? 'rgba(40,30,46,0.55)' : 'rgba(255,236,190,0.35)';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + s * 0.3); g.lineTo(x + s * 0.4, y + s * 0.9); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(122,52,30,0.45)';
    for (let i = 0; i < 9; i++) { const x = -170 + rng() * 280, y = -176 + rng() * 40; g.fillRect(x, y, 1.6, 14 + rng() * 26); }
    // raised armour plate (bevelled) carrying the squad stencil
    const AP = [[-44, -172], [12, -172], [20, -160], [20, -112], [12, -104], [-44, -104], [-50, -112], [-50, -160]];
    poly(g, AP); g.fillStyle = pr.base; g.fill();
    g.save(); poly(g, AP); g.clip();
    g.fillStyle = pr.lit; g.fillRect(-60, -180, 90, 16); g.fillStyle = pr.dark; g.fillRect(-60, -118, 90, 20);
    g.fillStyle = ls > 0 ? pr.hi : pr.dark; g.fillRect(ls > 0 ? 12 : -50, -172, 8, 70);
    g.restore();
    poly(g, AP); ink(g, 2);
    rivets(g, [[-42, -166], [10, -166], [-42, -110], [10, -110], [-16, -168], [-16, -108]], 1.7);
    // stencils
    g.save(); g.translate(-15, -122); g.fillStyle = 'rgba(236,226,206,0.62)'; g.font = '700 34px Georgia, serif'; g.textAlign = 'center';
    if (ls < 0) { g.scale(-1, 1); }
    g.fillText('III', 0, -4);
    g.font = '700 8.5px Rajdhani, sans-serif'; g.fillText('DESCENT · BORE RIG 07', 0, 10);
    g.restore();
    g.fillStyle = pr.base; for (let i = 0; i < 7; i++) g.fillRect(-34 + rng() * 36, -152 + rng() * 32, 2 + rng() * 3, 2);
    // furnace window (live glow is laid over it)
    poly(g, [[-152, -158], [-82, -158], [-80, -118], [-154, -118]]); fillInk(g, '#1a0e12', 1.8);
    g.fillStyle = '#0d070b'; g.fillRect(-150, -156, 68, 6);
    for (let x = -146; x <= -86; x += 10) { poly(g, [[x, -157], [x + 4, -157], [x + 4, -119], [x, -119]]); fillInk(g, ir.base, 0.9); g.fillStyle = ls > 0 ? ir.hi : ir.lit; g.fillRect(ls > 0 ? x + 2.8 : x, -156, 1.2, 36); }
    rivets(g, [[-156, -160], [-78, -160], [-156, -116], [-78, -116]], 1.8);
    // gauges by the cockpit
    for (const [x, y, r] of [[26, -158, 7.5], [40, -146, 5.5]]) {
      g.beginPath(); g.arc(x, y, r + 2, 0, TAU); fillInk(g, C.brass, 1.3);
      g.beginPath(); g.arc(x, y, r, 0, TAU); fillInk(g, '#ece4cf', 1);
      g.strokeStyle = '#a3262f'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r * 0.7, y - r * 0.45); g.stroke();
    }
    // nose lamps + boom mount
    for (const [x, y] of EYES) {
      g.save(); g.translate(x, y); g.rotate(0.86);
      poly(g, [[-15, -2], [-9, -8], [13, -6], [16, 0], [10, 6], [-12, 5]]); fillInk(g, '#120a10', 1.6);
      poly(g, [[-17, -6], [-9, -13], [15, -11], [18, -6], [13, -8], [-9, -9]]); fillInk(g, ir.lit, 1.4);   // heavy brow plate
      g.restore();
    }
    g.beginPath(); g.arc(PV.x, PV.y, 25, 0, TAU); fillInk(g, ir.base, 2);
    g.beginPath(); g.arc(PV.x, PV.y, 25, ls > 0 ? -1.6 : 1.5, ls > 0 ? 0.2 : 3.3); g.strokeStyle = ir.hi; g.lineWidth = 2.5; g.stroke();
    rivets(g, Array.from({ length: 10 }, (_, i) => [PV.x + Math.cos(i / 10 * TAU) * 21, PV.y + Math.sin(i / 10 * TAU) * 21]), 1.5);
    g.restore();
    poly(g, S); ink(g, 2.6);
    // deck lip (we look slightly down onto the deck)
    poly(g, [[-170, -184], [54, -184], [62, -193], [-162, -193]]); fillInk(g, ir.lit, 1.6);
    rivets(g, row(-150, 40, -188.5, 14), 1.2);
    // handrail at the back of the deck
    g.strokeStyle = INK; g.lineWidth = 3.2;
    for (const x of [-158, -136]) { g.beginPath(); g.moveTo(x, -192); g.lineTo(x, -214); g.stroke(); }
    g.beginPath(); g.moveTo(-162, -213); g.lineTo(-130, -212); g.stroke();
    g.strokeStyle = '#7c7690'; g.lineWidth = 1.5;
    for (const x of [-158, -136]) { g.beginPath(); g.moveTo(x, -192); g.lineTo(x, -214); g.stroke(); }
    g.beginPath(); g.moveTo(-162, -213); g.lineTo(-130, -212); g.stroke();
    // cockpit collar: the front half of the ring Hadal is welded into
    const ccx = -24, ccy = -188;
    g.beginPath(); g.ellipse(ccx, ccy, 46, 12, 0, 0, PI); g.ellipse(ccx, ccy + 1, 38, 7, 0, PI, 0, true); g.closePath(); fillInk(g, ramp(C.brass).base, 1.8);
    g.beginPath(); g.ellipse(ccx, ccy + 2, 44, 10, 0, 0.25, PI - 0.25); g.strokeStyle = ramp(C.brass).hi; g.lineWidth = 1.6; g.stroke();
    rivets(g, Array.from({ length: 7 }, (_, i) => { const a = 0.35 + i * (PI - 0.7) / 6; return [ccx + Math.cos(a) * 42, ccy + Math.sin(a) * 9.5]; }), 1.3);
    // fender skirt over the tracks
    const cuts = [-198, -126, -54, 18, 90, 166];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1], bend = (rng() - 0.5) * 6;
      const F = [[a, -94], [b, -94], [b + 2, -60 + bend * 0.3], [(a + b) / 2, -57 + bend], [a - 2, -60 - bend * 0.3]];
      poly(g, F); g.fillStyle = ir.base; g.fill();
      g.save(); poly(g, F); g.clip();
      g.fillStyle = ir.lit; g.fillRect(a - 4, -96, b - a + 8, 9);
      g.fillStyle = ir.dark; g.fillRect(a - 4, -72, b - a + 8, 20);
      g.fillStyle = 'rgba(86,62,48,0.55)';                                // mud
      for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(a + rng() * (b - a), -60 - rng() * 8, 2 + rng() * 5, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(255,240,220,0.3)'; g.lineWidth = 0.8;     // scratches
      for (let k = 0; k < 3; k++) { const x = a + rng() * (b - a), y = -88 + rng() * 18; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + rng() * 8, y + 2 - rng() * 4); g.stroke(); }
      g.restore();
      poly(g, F); ink(g, 2);
      rivets(g, row(a + 7, b - 7, -88, 11), 1.3);
    }
    g.fillStyle = '#e0b445'; g.fillRect(-198, -97, 364, 3.5); g.beginPath(); g.rect(-198, -97, 364, 3.5); ink(g, 1);
    // ripper jaw: a toothed plough blade bolted under the nose
    const J = [[148, -98], [172, -94], [190, -62], [194, -30], [184, -8], [158, -6], [150, -40]];
    poly(g, J); g.fillStyle = ir.base; g.fill();
    g.save(); poly(g, J); g.clip();
    g.fillStyle = ls > 0 ? ir.lit : ir.dark; g.fillRect(170, -100, 40, 100); g.fillStyle = ir.dark; g.fillRect(140, -40, 70, 40);
    g.restore();
    poly(g, J); ink(g, 2.2);
    const sr = ramp(C.steel);
    for (const [y, l] of [[-56, 15], [-40, 18], [-24, 17], [-10, 13]]) {
      const x = y < -50 ? 190 : y < -30 ? 193 : y < -15 ? 192 : 186;
      poly(g, [[x - 2, y - 6], [x + l, y + 1], [x - 2, y + 6]]); g.fillStyle = sr.dark; g.fill();
      poly(g, [[x - 2, y - 6], [x + l, y + 1], [x - 2, y]]); g.fillStyle = sr.lit; g.fill();
      poly(g, [[x - 2, y - 6], [x + l, y + 1], [x - 2, y + 6]]); ink(g, 1.5);
    }
    rivets(g, [[160, -86], [166, -66], [170, -44], [168, -22]], 1.8);
  }

  /* --------- live parts --------- */
  function drawTreads(ctx, trk, ls, dorm) {
    const x0 = -142, x1 = 116, cy = -34, r = 34, Ls = x1 - x0, Lp = 2 * Ls + TAU * r;
    const belt = (inset) => { ctx.beginPath(); ctx.moveTo(x0, cy - r + inset); ctx.lineTo(x1, cy - r + inset); ctx.arc(x1, cy, r - inset, -PI / 2, PI / 2); ctx.lineTo(x0, cy + r - inset); ctx.arc(x0, cy, r - inset, PI / 2, PI * 1.5); ctx.closePath(); };
    belt(0); ctx.fillStyle = '#211d29'; ctx.fill(); ink(ctx, 2.6);
    belt(8); ctx.fillStyle = '#120f18'; ctx.fill();
    // wheels: drive sprocket (rear), idler (front), five road wheels
    const wheel = (x, y, rr, teeth) => {
      const a = trk / rr;
      if (teeth) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const q = a + i / 10 * TAU; ctx.moveTo(x + Math.cos(q - 0.12) * rr, y + Math.sin(q - 0.12) * rr); ctx.lineTo(x + Math.cos(q) * (rr + 5), y + Math.sin(q) * (rr + 5)); ctx.lineTo(x + Math.cos(q + 0.12) * rr, y + Math.sin(q + 0.12) * rr); } ctx.fillStyle = '#4b4658'; ctx.fill(); ink(ctx, 1); }
      ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fillStyle = '#3a3546'; ctx.fill(); ink(ctx, 1.8);
      ctx.beginPath(); ctx.arc(x, y, rr - 3, ls > 0 ? -1.9 : 1.2, ls > 0 ? 0.25 : 3.35); ctx.strokeStyle = '#8a8499'; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, rr * 0.42, 0, TAU); ctx.fillStyle = '#9297aa'; ctx.fill(); ink(ctx, 1.2);
      ctx.fillStyle = '#1b1422'; ctx.beginPath();
      for (let i = 0; i < 5; i++) { const q = a + i / 5 * TAU, bx = x + Math.cos(q) * rr * 0.27, by = y + Math.sin(q) * rr * 0.27; ctx.moveTo(bx + 1.4, by); ctx.arc(bx, by, 1.4, 0, TAU); }
      ctx.fill();
      ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i < 3; i++) { const q = a * 1 + i / 3 * TAU; ctx.moveTo(x + Math.cos(q) * rr * 0.45, y + Math.sin(q) * rr * 0.45); ctx.lineTo(x + Math.cos(q) * (rr - 4), y + Math.sin(q) * (rr - 4)); }
      ctx.stroke();
    };
    wheel(x0, cy - 2, 26, true); wheel(x1, cy - 4, 23, false);
    for (const x of [-104, -56, -8, 40, 84]) wheel(x, -22, 18, false);
    // track links: grouser plates sliding round the belt
    const N = Math.round(Lp / 14), ph = ((trk % Lp) + Lp) % Lp;
    const at = (s) => {
      s = ((s % Lp) + Lp) % Lp;
      if (s < Ls) return [x1 - s, cy + r, 0, 1];                                         // bottom run (front → rear)
      s -= Ls; if (s < PI * r) { const q = PI / 2 + s / r; return [x0 + Math.cos(q) * r, cy + Math.sin(q) * r, Math.cos(q), Math.sin(q)]; }
      s -= PI * r; if (s < Ls) return [x0 + s, cy - r, 0, -1];                           // top run (rear → front)
      s -= Ls; const q = -PI / 2 + s / r; return [x1 + Math.cos(q) * r, cy + Math.sin(q) * r, Math.cos(q), Math.sin(q)];
    };
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const [x, y, nx, ny] = at(i * Lp / N + ph), tx = -ny, ty = nx;
      ctx.moveTo(x + tx * 5.5 - nx * 1, y + ty * 5.5 - ny * 1); ctx.lineTo(x + tx * 5.5 + nx * 5, y + ty * 5.5 + ny * 5);
      ctx.lineTo(x - tx * 5.5 + nx * 5, y - ty * 5.5 + ny * 5); ctx.lineTo(x - tx * 5.5 - nx * 1, y - ty * 5.5 - ny * 1); ctx.closePath();
    }
    ctx.fillStyle = '#4a4555'; ctx.fill(); ink(ctx, 1.1);
    ctx.strokeStyle = 'rgba(255,236,210,0.25)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < N; i++) { const [x, y, nx, ny] = at(i * Lp / N + ph); if (ny > -0.5) continue; ctx.moveTo(x - 4, y + ny * 4.5); ctx.lineTo(x + 4, y + ny * 4.5); }
    ctx.stroke();
  }
  // a lattice girder (claw upper arm)
  function girder(ctx, a, b, w, hex, ls) {
    Rig.limb(ctx, a, b, w, w * 0.85, hex, { noHatch: true });
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    ctx.strokeStyle = 'rgba(11,6,18,0.75)'; ctx.lineWidth = 1.3; ctx.beginPath();
    const n = Math.max(2, Math.round(L / 16));
    for (let i = 0; i < n; i++) {
      const t0 = 0.12 + (i / n) * 0.76, t1 = 0.12 + ((i + 1) / n) * 0.76, s = i % 2 ? 1 : -1, ww = w * 0.55;
      ctx.moveTo(a.x + dx * t0 + nx * ww * s, a.y + dy * t0 + ny * ww * s); ctx.lineTo(a.x + dx * t1 - nx * ww * s, a.y + dy * t1 - ny * ww * s);
    }
    ctx.stroke();
  }
  function drawClawArm(ctx, g, p, ls) {
    girder(ctx, CS, g.el, 11, C.paint, ls);
    Rig.limb(ctx, g.el, lerpPt(g.el, g.fe, 0.62), 8.5, 8, C.iron, { noHatch: true });
    Rig.limb(ctx, lerpPt(g.el, g.fe, 0.58), g.fe, 4.4, 4.2, C.chrome, { spec: 0.7, noHatch: true });
    for (const [q, r] of [[CS, 13], [g.el, 9.5]]) {
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); fillInk(ctx, '#4b4658', 1.8);
      ctx.beginPath(); ctx.arc(q.x, q.y, r * 0.45, 0, TAU); fillInk(ctx, C.brass, 1.2);
    }
  }
  function drawClawHead(ctx, e, g, p, crys) {
    if (p.cext > 0.02) {
      const mx = (g.fe.x + g.hd.x) / 2, my = (g.fe.y + g.hd.y) / 2 + 14 * (1 - p.cext) + 6;
      ctx.beginPath(); ctx.moveTo(g.fe.x, g.fe.y); ctx.quadraticCurveTo(mx, my, g.hd.x, g.hd.y);
      ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 4.4; ctx.stroke(); ctx.strokeStyle = '#9da2b4'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.save(); ctx.translate(g.hd.x, g.hd.y); ctx.rotate(g.ha);
    const op = p.open, sr = ramp(C.steel);
    // talons: upper pair + lower thumb, opened by `op`
    const talon = (sgn, rot, len) => {
      ctx.save(); ctx.translate(16, sgn * 6); ctx.rotate(sgn * (-0.55 * op) + rot);
      const T = [[0, -sgn * 4], [len * 0.45, -sgn * 9], [len, sgn * -2], [len * 0.82, sgn * 5], [len * 0.62, sgn * 1], [len * 0.3, sgn * 4], [0, sgn * 5]];
      poly(ctx, T); ctx.fillStyle = sr.dark; ctx.fill();
      poly(ctx, [[0, -sgn * 4], [len * 0.45, -sgn * 9], [len, sgn * -2], [len * 0.5, -sgn * 2], [0, 0]]); ctx.fillStyle = sr.lit; ctx.fill();
      poly(ctx, T); ink(ctx, 1.7);
      ctx.restore();
    };
    talon(-1, 0, 58); talon(1, 0, 50);
    // palm block with a glowing core
    const B = [[-10, -13], [14, -15], [22, -7], [22, 7], [14, 15], [-10, 13], [-14, 0]];
    poly(ctx, B); ctx.fillStyle = ramp(C.iron).base; ctx.fill();
    poly(ctx, [[-10, -13], [14, -15], [22, -7], [22, 0], [-14, 0]]); ctx.fillStyle = ramp(C.iron).lit; ctx.fill();
    poly(ctx, B); ink(ctx, 2);
    rivets(ctx, [[-6, -9], [-6, 9], [12, -11], [12, 11]], 1.3);
    ctx.fillStyle = '#e0b445'; ctx.fillRect(-12, -3, 6, 6);
    ctx.globalCompositeOperation = 'lighter';
    const cc = crys > 0.5 ? CRY : ORE, glowA = (1 - p.dorm) * (0.6 + 0.3 * Math.sin(e.t * 6));
    ctx.fillStyle = U.rgba(cc, glowA); ctx.beginPath(); ctx.arc(6, 0, 4, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
  function drawDrill(ctx, e, g, p, crys, ls) {
    const { base: B, tip: T, ux, uy, nx, ny } = g;
    const Ld = Rig.lightDir(ctx), s = (nx * Ld.x + ny * Ld.y) >= 0 ? 1 : -1;
    // boom housing (telescoping) + hydraulic ram underneath
    const ramA = { x: 72, y: -100 }, ramB = { x: PV.x + ux * g.hl * 0.55 + nx * 12, y: PV.y + uy * g.hl * 0.55 + ny * 12 };
    Rig.limb(ctx, ramA, lerpPt(ramA, ramB, 0.55), 6.5, 6, C.iron, { noHatch: true });
    Rig.limb(ctx, lerpPt(ramA, ramB, 0.5), ramB, 3.4, 3.4, C.chrome, { spec: 0.7, noHatch: true });
    Rig.limb(ctx, PV, { x: B.x - ux * 8, y: B.y - uy * 8 }, 17, 15, C.paint, { noHatch: true });
    const hm = lerpPt(PV, B, 0.5);
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(hm.x + nx * 15, hm.y + ny * 15); ctx.lineTo(hm.x - nx * 15, hm.y - ny * 15); ctx.stroke();
    rivets(ctx, [[hm.x + nx * 9 + ux * 10, hm.y + ny * 9 + uy * 10], [hm.x - nx * 9 + ux * 10, hm.y - ny * 9 + uy * 10], [hm.x + nx * 9 - ux * 14, hm.y + ny * 9 - uy * 14], [hm.x - nx * 9 - ux * 14, hm.y - ny * 9 - uy * 14]], 1.4);
    // hub
    ctx.beginPath(); ctx.arc(PV.x, PV.y, 15, 0, TAU); fillInk(ctx, '#4b4658', 2);
    ctx.beginPath(); ctx.arc(PV.x, PV.y, 7, 0, TAU); fillInk(ctx, C.brass, 1.3);
    // collar
    const cw = DR + 6;
    poly(ctx, [[B.x + nx * cw, B.y + ny * cw], [B.x + nx * cw - ux * 14, B.y + ny * cw - uy * 14], [B.x - nx * cw - ux * 14, B.y - ny * cw - uy * 14], [B.x - nx * cw, B.y - ny * cw]]);
    fillInk(ctx, '#4b4658', 2);
    rivets(ctx, [-0.7, -0.25, 0.25, 0.7].map((k) => [B.x + nx * cw * k - ux * 7, B.y + ny * cw * k - uy * 7]), 1.6);
    // the drill cone — steel (phase I) or Hush crystal (phase II)
    const cry = crys > 0.5;
    const M = cry ? { dark: '#3f1b6b', base: '#7b3cc8', lit: '#c891ff', hi: '#fde9ff' } : { dark: '#3a394c', base: '#6e7287', lit: '#b6bbcc', hi: '#f1f2f8' };
    const at = (u, k) => ({ x: B.x + ux * DL * u + nx * k * DR * (1 - u * 0.97), y: B.y + uy * DL * u + ny * k * DR * (1 - u * 0.97) });
    const cone = () => { const a = at(0, 1), b = at(0, -1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(T.x, T.y); ctx.lineTo(b.x, b.y); ctx.closePath(); };
    cone(); ctx.fillStyle = M.dark; ctx.fill();
    ctx.save(); cone(); ctx.clip();
    let q0 = at(0, s), q1 = at(0, -s * 0.3);
    ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(T.x, T.y); ctx.lineTo(q1.x, q1.y); ctx.closePath(); ctx.fillStyle = M.base; ctx.fill();
    q1 = at(0, s * 0.25);
    ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(T.x, T.y); ctx.lineTo(q1.x, q1.y); ctx.closePath(); ctx.fillStyle = M.lit; ctx.fill();
    // helical flutes travel toward the tip as it spins
    const ph = e.spinPh || 0;
    for (let k = 0; k < 7; k++) {
      const u = (k / 7 + ph) % 1, a = at(u, s * 1.15), b = at(Math.min(1, u + 0.14), -s * 1.15), wk = 1 - u;
      ctx.strokeStyle = INK; ctx.lineWidth = 3.4 * wk + 0.6; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = M.hi; ctx.lineWidth = 1.3 * wk + 0.3; ctx.beginPath(); ctx.moveTo(a.x - ux * 3.2, a.y - uy * 3.2); ctx.lineTo(b.x - ux * 3.2, b.y - uy * 3.2); ctx.stroke();
    }
    if (cry) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,160,250,${0.35 + 0.25 * Math.sin(e.t * 9)})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(T.x, T.y); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    cone(); ink(ctx, 2.4);
    // phase II: crystal spurs jutting from the cone
    if (cry) {
      for (const [u, k, L] of [[0.18, 1, 26], [0.36, -1, 22], [0.55, 1, 16], [0.08, -1, 18]]) {
        const a = at(u, k), dl = L * U.clamp((crys - 0.5) * 2, 0, 1);
        if (dl < 2) continue;
        const tx = a.x + (nx * k * 0.8 + ux * 0.6) * dl, ty = a.y + (ny * k * 0.8 + uy * 0.6) * dl;
        poly(ctx, [[a.x - ux * 6, a.y - uy * 6], [tx, ty], [a.x + ux * 6, a.y + uy * 6]]); fillInk(ctx, '#a05ef0', 1.4);
        ctx.fillStyle = '#f0d4ff'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(tx, ty); ctx.lineTo(a.x + ux * 6, a.y + uy * 6); ctx.closePath(); ctx.fill();
      }
    }
    // tip glint + heat
    ctx.fillStyle = M.hi; ctx.beginPath(); const tg = at(0.86, s * 0.5); ctx.moveTo(tg.x, tg.y); ctx.lineTo(T.x, T.y); ctx.lineTo(at(0.8, s * 0.1).x, at(0.8, s * 0.1).y); ctx.closePath(); ctx.fill();
    const heat = p.heat * (1 - p.dorm);
    if (heat > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, T.x - ux * 20, T.y - uy * 20, 30 + 40 * heat, cry ? MAG : ORE, 0.55 * heat);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  const HS = 1.3;
  function drawHadal(ctx, e, p, crys, ls) {
    const t = e.t, br = Math.sin(t * 1.7), dorm = p.dorm;
    const lean = 0.08 + p.hL * 0.3 - p.roar * 0.32 + br * 0.015;
    const hip = { x: -24, y: -184 }, cl = Math.cos(lean), sl = Math.sin(lean);
    const T2 = (x, y) => ({ x: hip.x + x * cl - y * sl, y: hip.y + x * sl + y * cl });
    const shF = T2(16, -52 - br), shB = T2(-30, -50 - br), headC = T2(8, -76 - br);
    // Hadal is a giant: everything below is drawn 1.3x about his hips (arm targets live in that space too)
    ctx.save(); ctx.translate(hip.x, hip.y); ctx.scale(HS, HS); ctx.translate(-hip.x, -hip.y);
    // back arm on the lever (flung back in a roar)
    const hB = lerpPt({ x: -62, y: -196 }, { x: -96, y: -282 }, p.roar);
    const aB = ik2(shB, hB, 27, 27, 1);
    Rig.limbChain(ctx, [shB, aB.el, aB.hand], [9.5, 8, 7], '#2f2836');
    ctx.beginPath(); ctx.moveTo(-64, -186); ctx.lineTo(hB.x + 2, hB.y + 4); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.4; ctx.strokeStyle = '#8a8499'; ctx.stroke();
    ctx.beginPath(); ctx.arc(aB.hand.x, aB.hand.y, 7, 0, TAU); fillInk(ctx, '#3a3546', 1.5);
    // torso: a hunched giant in a Descent miner's coat
    const tp = [T2(-24, 4), T2(-34, -24), T2(-40, -46), T2(-24, -60), T2(8, -62), T2(26, -54), T2(30, -30), T2(22, 4)];
    ctx.beginPath(); ctx.moveTo(tp[0].x, tp[0].y);
    for (let i = 1; i <= tp.length; i++) { const a = tp[i - 1], b = tp[i % tp.length]; ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    ctx.closePath();
    const cr = ramp(C.coat), c0 = T2(0, -30);
    ctx.fillStyle = Rig.celGrad(ctx, c0.x, c0.y, cl, sl, 36, ls, cr); ctx.fill(); ink(ctx, 2.2);
    ctx.save(); ctx.clip();
    // hi-vis band and stitched seams
    const b0 = T2(-40, -44), b1 = T2(30, -14);
    ctx.lineCap = 'butt'; ctx.strokeStyle = C.band; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,200,0.75)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(b0.x, b0.y - 1); ctx.lineTo(b1.x, b1.y - 1); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b0.x, b0.y - 4); ctx.lineTo(b1.x, b1.y - 4); ctx.moveTo(b0.x, b0.y + 4); ctx.lineTo(b1.x, b1.y + 4); ctx.stroke();
    ctx.restore();
    // Hush crystal through the chest (grows in phase II)
    const cc = T2(4, -34), cs = 7 + crys * 9;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, cc.x, cc.y, 22 + crys * 22, CRY, (0.35 + crys * 0.4) * (1 - dorm * 0.8)); ctx.restore();
    poly(ctx, [[cc.x - cs * 0.4, cc.y + cs * 0.5], [cc.x - cs * 0.2, cc.y - cs], [cc.x + cs * 0.35, cc.y - cs * 0.7], [cc.x + cs * 0.5, cc.y + cs * 0.4]]); fillInk(ctx, '#9b5ce6', 1.3);
    ctx.fillStyle = CRYL; ctx.beginPath(); ctx.moveTo(cc.x - cs * 0.2, cc.y - cs); ctx.lineTo(cc.x + cs * 0.35, cc.y - cs * 0.7); ctx.lineTo(cc.x + cs * 0.1, cc.y + cs * 0.2); ctx.closePath(); ctx.fill();
    // rag collar
    const nk = [T2(-26, -56), T2(-14, -66), T2(-2, -60), T2(8, -68), T2(18, -58), T2(24, -50), T2(4, -50), T2(-20, -48)];
    poly(ctx, nk.map((q) => [q.x, q.y])); fillInk(ctx, '#6b5b52', 1.4);
    // back pauldron
    ctx.beginPath(); ctx.ellipse(shB.x, shB.y - 2, 15, 11, lean - 0.3, 0, TAU); fillInk(ctx, ramp(C.brass).dark, 1.8);
    // head
    const ha = lean * 0.5 + p.hHead * 0.45 + Math.sin(t * 0.9) * 0.03;
    const chin = drawHadalHead(ctx, e, headC, ha, p, crys, ls);
    // front arm: rests on the dash, rises with every wind-up, flings up in a roar
    const rest = { x: 30, y: -194 }, up = { x: 34, y: -300 }, roar = { x: 62, y: -282 };
    const hF = lerpPt(lerpPt(rest, up, p.hR), roar, p.roar);
    const aF = ik2(shF, hF, 30, 30, -1);
    Rig.limbChain(ctx, [shF, aF.el, aF.hand], [11, 9, 7.5], C.coat, { spec: 0.2 });
    // gauntlet fist
    ctx.save(); ctx.translate(aF.hand.x, aF.hand.y); ctx.rotate(Math.atan2(aF.hand.y - aF.el.y, aF.hand.x - aF.el.x));
    poly(ctx, [[-4, -10], [12, -11], [16, -4], [16, 6], [10, 11], [-4, 10]]); fillInk(ctx, ramp(C.iron).lit, 1.8);
    ctx.strokeStyle = 'rgba(11,6,18,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); for (const x of [5, 10]) { ctx.moveTo(x, -10); ctx.lineTo(x, 10); } ctx.stroke();
    rivets(ctx, [[0, -6], [0, 6]], 1.2);
    ctx.restore();
    // front pauldron (drill-bit spikes)
    const pr = ramp(C.brass);
    ctx.save(); ctx.translate(shF.x, shF.y - 2); ctx.rotate(lean - 0.2);
    poly(ctx, [[-16, 6], [-14, -8], [0, -14], [16, -8], [18, 6], [0, 10]]); ctx.fillStyle = pr.base; ctx.fill();
    poly(ctx, [[-14, -8], [0, -14], [16, -8], [16, -2], [-14, -2]]); ctx.fillStyle = pr.lit; ctx.fill();
    poly(ctx, [[-16, 6], [-14, -8], [0, -14], [16, -8], [18, 6], [0, 10]]); ink(ctx, 1.9);
    for (const [x, h] of [[-8, 14], [4, 18]]) { poly(ctx, [[x - 3.5, -11], [x, -11 - h], [x + 3.5, -11]]); fillInk(ctx, C.steel, 1.2); }
    rivets(ctx, [[-10, 1], [0, 3], [10, 1]], 1.3);
    ctx.restore();
    ctx.restore();
    return { x: hip.x + (chin.x - hip.x) * HS, y: hip.y + (chin.y - hip.y) * HS };
  }
  function drawHadalHead(ctx, e, c, ang, p, crys, ls) {
    const dorm = p.dorm;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(ang);
    // skull + jaw (grey, Hush-bled skin)
    const sk = ramp(C.skin);
    ctx.beginPath(); ctx.moveTo(-12, -4); ctx.quadraticCurveTo(-14, 10, -4, 15); ctx.lineTo(10, 15); ctx.quadraticCurveTo(16, 8, 15, -2); ctx.closePath();
    ctx.fillStyle = sk.base; ctx.fill(); ink(ctx, 1.8);
    ctx.fillStyle = sk.dark; ctx.beginPath(); ctx.moveTo(-12, -4); ctx.quadraticCurveTo(-14, 10, -4, 15); ctx.lineTo(0, 15); ctx.lineTo(-4, -2); ctx.closePath(); ctx.fill();
    // crystal scabs across the cheek (more in phase II)
    if (crys > 0.2) { poly(ctx, [[-8, 2], [-4, -6 - crys * 6], [0, 2]]); fillInk(ctx, '#a463f0', 1); poly(ctx, [[-12, 8], [-9, 0 - crys * 3], [-6, 8]]); fillInk(ctx, '#c58cff', 1); }
    // rebreather mask over mouth & nose: rubber, canister and hose
    poly(ctx, [[2, 2], [16, 1], [18, 10], [12, 16], [0, 16]]); fillInk(ctx, '#2c2733', 1.6);
    ctx.strokeStyle = 'rgba(255,240,220,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); for (const y of [6, 9, 12]) { ctx.moveTo(6, y); ctx.lineTo(15, y - 0.5); } ctx.stroke();
    ctx.beginPath(); ctx.ellipse(16, 12, 5, 6.5, -0.3, 0, TAU); fillInk(ctx, ramp(C.iron).lit, 1.4);
    ctx.beginPath(); ctx.ellipse(16, 12, 2.4, 3.2, -0.3, 0, TAU); ctx.fillStyle = '#17111d'; ctx.fill();
    // eye under the brim
    const eyeCol = crys > 0.5 ? CRY : ORE, ea = 1 - dorm;
    ctx.fillStyle = '#120c16'; ctx.beginPath(); ctx.ellipse(8, -4, 6, 3.6, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = U.rgba(eyeCol, 0.95 * ea); ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(13, -5.5); ctx.lineTo(12, -2.5); ctx.closePath(); ctx.fill();
    K.glow(ctx, 9, -4, 16 + crys * 8, eyeCol, 0.7 * ea);
    ctx.globalCompositeOperation = 'source-over';
    // battered miner's helmet
    const hr = ramp(C.helm);
    ctx.beginPath(); ctx.moveTo(-16, -2); ctx.quadraticCurveTo(-17, -22, 0, -24); ctx.quadraticCurveTo(15, -24, 17, -8); ctx.lineTo(23, -6); ctx.lineTo(22, -2); ctx.lineTo(-16, -2); ctx.closePath();
    ctx.fillStyle = Rig.celGrad(ctx, 0, -12, 1, -0.4, 18, ls, hr); ctx.fill(); ink(ctx, 2);
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-14, -8); ctx.quadraticCurveTo(0, -11, 20, -6); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,210,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-4, -16, 3, 0.3, 2); ctx.stroke(); ctx.beginPath(); ctx.arc(6, -19, 2, 0.5, 2.4); ctx.stroke();
    // crown of broken drill bits
    for (const [x, y, a, h] of [[-12, -16, -0.75, 14], [-5, -22, -0.35, 19], [3, -24, 0.05, 23], [10, -21, 0.4, 17]]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      const bc = crys > 0.5 ? '#9c5ce8' : C.steel, R = ramp(bc);
      poly(ctx, [[-4, 2], [0, -h], [4, 2]]); ctx.fillStyle = R.dark; ctx.fill();
      poly(ctx, [[0, 2], [0, -h], [4, 2]]); ctx.fillStyle = R.lit; ctx.fill();
      ctx.strokeStyle = 'rgba(11,6,18,0.7)'; ctx.lineWidth = 0.9; ctx.beginPath(); for (let k = 0.25; k < 0.9; k += 0.22) { ctx.moveTo(-4 * (1 - k), 2 - (h + 2) * k + 2); ctx.lineTo(4 * (1 - k), 2 - (h + 2) * k - 1); } ctx.stroke();
      poly(ctx, [[-4, 2], [0, -h], [4, 2]]); ink(ctx, 1.4);
      ctx.restore();
    }
    // headlamp
    ctx.beginPath(); ctx.ellipse(16, -15, 6, 6.5, 0, 0, TAU); fillInk(ctx, ramp(C.iron).base, 1.6);
    ctx.beginPath(); ctx.ellipse(18, -15, 3.2, 4.4, 0, 0, TAU); ctx.fillStyle = dorm > 0.5 ? '#4a4450' : '#fff7dc'; ctx.fill(); ink(ctx, 1);
    if (dorm < 0.9) {
      ctx.globalCompositeOperation = 'lighter';
      const la = (1 - dorm) * (0.85 + 0.1 * Math.sin(e.t * 13));
      K.glow(ctx, 19, -15, 14, LAMP, 0.55 * la);
      // a faint beam cone
      const bg = ctx.createLinearGradient(20, -15, 150, 10);
      bg.addColorStop(0, `rgba(255,240,200,${0.1 * la})`); bg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(20, -18); ctx.lineTo(150, -30); ctx.lineTo(150, 40); ctx.lineTo(20, -12); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    const ca = Math.cos(ang), sa = Math.sin(ang);
    return { x: c.x + 6 * ca - 15 * sa, y: c.y + 6 * sa + 15 * ca };
  }
  // phase II: Hush crystal bursting through the seams of the rig
  const CLUSTERS = [[-64, -186, 26, -0.25], [30, -172, 18, 0.45], [-150, -98, 20, -1.0], [104, -160, 15, 0.7], [-128, -192, 17, -0.15], [-6, -146, 13, 0.25], [-40, -98, 15, 0.1]];
  function drawCrystals(ctx, crys) {
    for (let i = 0; i < CLUSTERS.length; i++) {
      const [x, y, s0, a0] = CLUSTERS[i], s = s0 * U.clamp(crys * 1.4 - i * 0.06, 0, 1);
      if (s < 2) continue;
      for (const [da, k, off] of [[-0.45, 0.65, -6], [0, 1, 0], [0.5, 0.75, 6]]) {
        const a = a0 + da - PI / 2, L = s * 2 * k, w = s * 0.42 * k, bx = x + off * Math.cos(a0), by = y + off * Math.sin(a0) * 0.3;
        const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
        const pts = [[bx + nx * w, by + ny * w], [bx + nx * w + ux * L * 0.72, by + ny * w + uy * L * 0.72], [bx + ux * L, by + uy * L], [bx - nx * w + ux * L * 0.72, by - ny * w + uy * L * 0.72], [bx - nx * w, by - ny * w]];
        poly(ctx, pts); ctx.fillStyle = '#5b2a92'; ctx.fill();
        poly(ctx, [pts[0], pts[1], pts[2], [bx + ux * L * 0.1, by + uy * L * 0.1]]); ctx.fillStyle = '#c38bff'; ctx.fill();
        poly(ctx, pts); ink(ctx, 1.5);
        ctx.strokeStyle = 'rgba(255,230,255,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx + nx * w * 0.4 + ux * 3, by + ny * w * 0.4 + uy * 3); ctx.lineTo(bx + ux * L * 0.8, by + uy * L * 0.8); ctx.stroke();
      }
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, -64, -196, 50 * crys, CRY, 0.35 * crys); K.glow(ctx, -150, -108, 40 * crys, CRY, 0.3 * crys);
    ctx.restore();
  }
  // chain links (world space)
  function drawChain(ctx, pts) {
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, ang = Math.atan2(b.y - a.y, b.x - a.x), L = Math.hypot(b.x - a.x, b.y - a.y) * 0.62;
        ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
        ctx.beginPath();
        if (i % 2) { ctx.moveTo(-L, 0); ctx.lineTo(L, 0); } else ctx.ellipse(0, 0, L, 3.2, 0, 0, TAU);
        ctx.strokeStyle = pass ? '#9a9fb2' : INK; ctx.lineWidth = pass ? 1.5 : 3.6; ctx.stroke();
        ctx.restore();
      }
    }
    const t = pts[pts.length - 1];
    ctx.beginPath(); ctx.arc(t.x, t.y + 6, 6, -PI * 0.9, PI * 0.55); ctx.strokeStyle = INK; ctx.lineWidth = 4.4; ctx.stroke(); ctx.strokeStyle = '#a3a8ba'; ctx.lineWidth = 2; ctx.stroke();
  }

  /* =========================== pose state =========================== */
  function idlePose(e) {
    const t = e.t, p2 = e.phase === 2;
    return full({
      boom: 0.2 + Math.sin(t * 1.3) * 0.035, ca: -1.25 + Math.sin(t * 1.1 + 1) * 0.05, cb: 0.75 + Math.sin(t * 1.1) * 0.08, open: 0.25 + Math.sin(t * 0.9) * 0.1,
      spin: p2 ? 7 : 3, heat: p2 ? 0.6 : 0.22, hR: 0.1, hHead: Math.sin(t * 0.7) * 0.08,
    });
  }
  function targetPose(e) {
    const s = e.state;
    if (s === 'atk' && e.atk && e.atk.keys) return sample(e.atk.keys, e.st);
    if (s === 'spawn') return sample(INTRO_K, e.st);
    if (s === 'broken' || s === 'executed') return full({ boom: 0.72, ext: 0.1, spin: 0, heat: 0.05, ca: -0.25, cb: 1.45, open: 0.85, pitch: 0.04, crouch: 1, hL: 1.2 + Math.sin(e.t * 2) * 0.05, hHead: 0.9, hR: 0, vent: 0.35 });
    if (s === 'die') { const k = U.clamp(e.st / 0.5, 0, 1); return full({ boom: 0.75, spin: 0, heat: 0, ca: -0.2, cb: 1.5, open: 1, pitch: 0.07 * k, crouch: 1, hL: 1.3, hHead: 1, sink: 0.14 * k, dorm: k }); }
    if (s === 'hurt' || s === 'recoil') {
      const k = Math.sin(Math.min(1, e.st / (s === 'recoil' ? 0.6 : 0.28)) * PI);
      return Object.assign(idlePose(e), { pitch: -0.05 * k, hL: -0.6 * k, hHead: 0.5 * k, boom: 0.2 - 0.35 * k });
    }
    return idlePose(e);
  }
  function updPose(e, dt) {
    const tp = targetPose(e);
    if (e.state === 'atk' || e.state === 'spawn' || !e.pose) e.pose = tp;
    else e.pose = lerpPose(e.pose, tp, 1 - Math.exp(-(e.state === 'hurt' || e.state === 'recoil' ? 22 : 9) * dt));
    const k = e.hitK;
    return k > 0 ? Object.assign({}, e.pose, { pitch: e.pose.pitch - 0.035 * k, hL: e.pose.hL - 0.6 * k, hHead: e.pose.hHead + 0.4 * k }) : e.pose;
  }

  /* =========================== the type =========================== */
  const BOSS = TYPES.c3_boss = Object.assign({
    name: '鑽井王・哈德爾', en: 'HADAL, THE BORE-KING', w: 230, h: 240, hp: 1900, bal: 310, shards: 900,
    boss: true, poise: true, kbMul: 0.2, spawnT: 3.4, scale: 1,
    defeatDialog: 'c3_bossDefeat', phase2Bark: 'c3_bossP2', phase2Music: 'c3_boss2',
    portrait: [0.8, 0.86],
    get col() { const b = G.game && G.game.bossRef; return b && b.type === 'c3_boss' && b.phase === 2 ? CRY : ORE; },
    init(e) {
      e.facing = -1; e.homeX = e.x; e.trk = 0; e.spinPh = 0; e.behindT = 0; e.lastVent = -99; e.lastBig = e.t - 3.5; e.lastMoves = [];
      e.crys = 0; e.turnT = -1; e.humT = 0; e.introEv = {};
      e.chains = [new Rig.Chain(8, 8.5, 0.012, 0.93), new Rig.Chain(6, 8.5, 0.012, 0.93)];
      e.beard = new Rig.Chain(6, 6.5, 0.07, 0.88);
      e.banner = new Rig.Chain(8, 10, 0.035, 0.9);
    },
    voice(e) { G.SFX.play('c3_hydraulic'); if (Math.random() < 0.3) G.SFX.play('c3_hadal', e.phase); },
    weapon(e) {
      const p = e.pose || POSE0, g = geo(p), a = e.atk, at = a && a.at ? (typeof a.at === 'function' ? a.at(e.st) : a.at) : 'drill';
      if (at === 'floor') return { x: e.x, y: e.y - 18 };
      const q = at === 'claw' ? g.hc : at === 'pipes' ? { x: -150, y: -320 } : g.tip;
      return { x: e.x + e.facing * q.x, y: e.y + q.y + p.sink * 380 };
    },
    think(e, dt) {
      e.invuln = false; e.grabbing = false;
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) { G.game.bossPhase2(e); return; }
      if (e._execd) { e._execd = false; e.cd = Math.max(e.cd, 1.1); }
      const P = e.P, ar = arenaOf(e), dx = P.x - e.x, d = Math.abs(dx), side = dx >= 0 ? 1 : -1, p2 = e.phase === 2;
      // idle engine chug
      e.humT -= dt; if (e.humT <= 0) { e.humT = Math.abs(e.vx) > 30 ? 0.42 : 0.9; if (d < 900) G.SFX.play(Math.abs(e.vx) > 30 ? 'c3_treads' : 'c3_engine', 0.5); }
      // a crawler can't spin on the spot: it pivots (a window to punish from behind)
      if (e.turnT >= 0) {
        const TD = p2 ? 0.5 : 0.72;
        e.turnT += dt; e.vx = U.approach(e.vx, 0, 900 * dt);
        if (!e.turnFlip && e.turnT >= TD / 2) { e.turnFlip = true; e.facing = -e.facing; G.FX.dust(e.x, e.y, 10, { w: 300, speed: 160, size: 14 }); }
        if (e.turnT >= TD) { e.turnT = -1; e.cd = Math.max(e.cd, 0.25); }
        return;
      }
      if (side !== e.facing && d > 36) {
        e.behindT += dt; e.vx = U.approach(e.vx, 0, 900 * dt);
        if (e.behindT > (p2 ? 0.3 : 0.45)) {
          e.behindT = 0;
          if (e.cd < 0.8 && e.t - e.lastVent > 6.5 && d < 400) { e.lastVent = e.t; e.startAtk(BOSS.vent); }
          else { e.turnT = 0; e.turnFlip = false; G.SFX.play('c3_treads'); }
        }
        return;
      }
      e.behindT = 0;
      const sp = p2 ? 190 : 150, want = 215;
      let tv = 0;
      if (d > want + 50) tv = e.facing * sp; else if (d < 105) tv = -e.facing * 120;
      e.vx = U.approach(e.vx, tv * e.speedMul, 520 * dt);
      e.x = U.clamp(e.x, ar.x0 + 165, ar.x1 - 165);
      if (e.cd <= 0) choose(e, d);
    },
    atkUpdate(e, dt) {
      const a = e.atk, ar = arenaOf(e);
      if (!a) return;
      e.invuln = false;
      if (a.keys) e.pose = sample(a.keys, e.st);
      if (a.upd) a.upd(e, dt, e.st);
      if (a !== BOSS.burrow) e.x = U.clamp(e.x, ar.x0 + 165, ar.x1 - 165);
      if (e.atk !== BOSS.grabHold) e.grabbing = false;
    },
    onPhase2(e) {
      e.startAtk(BOSS.transform);
      G.FX.dust(e.x, e.y, 30, { w: 360, speed: 300, size: 20, col: 'rgba(170,140,200,' });
    },
    onHit(e, h) { if (Math.random() < 0.6) G.SFX.play('armor'); if (h.big) G.FX.spark(h.hx ?? e.cx, h.hy ?? e.cy, 8, { col: EMBER, speed: 520 }); },
    draw(ctx, e, ghost) { drawBoss(ctx, e, ghost); },
  }, ATK);

  /* =========================== draw =========================== */
  function drawBoss(ctx, e, ghost) {
    const dt = ghost ? 0 : G.game.dtVis || 0;
    if (!ghost && e.state !== 'atk') { e.invuln = false; if (e.state !== 'idle') e.grabbing = false; }
    if (!ghost && e.state === 'executed') e._execd = true;
    const p = updPose(e, dt), f = e.facing, crys = e.crys || 0, dorm = p.dorm;
    // drill spin + track travel
    if (dt > 0) {
      e.spinPh = ((e.spinPh || 0) + p.spin * dt * 0.22) % 1;
      e.trk += (e.x - (e.lastX ?? e.x)) * f + (e.turnT >= 0 ? 260 * dt : 0);
      e.lastX = e.x;
    }
    if (!ghost && dt > 0) introEvents(e);
    const dying = e.state === 'die' ? U.clamp(e.st / 0.5, 0, 1) : 0;
    const sinkY = p.sink * 380;
    const TD = e.phase === 2 ? 0.5 : 0.72, ts = e.turnT >= 0 ? Math.max(0.07, Math.abs(Math.cos(PI * e.turnT / TD))) : 1;
    ctx.save();
    if (dying > 0) ctx.globalAlpha *= 1 - Math.pow(dying, 1.6);
    // contact shadow + burrow mound (above the floor, so outside the clip)
    if (p.sink < 0.95) { ctx.fillStyle = `rgba(6,2,10,${0.38 * (1 - p.sink)})`; ctx.beginPath(); ctx.ellipse(e.x - f * 10, e.y + 2, 200 * ts, 13, 0, 0, TAU); ctx.fill(); }
    if (p.sink > 0.4) drawMound(ctx, e, p);
    if (p.sink > 0.001) { ctx.beginPath(); ctx.rect(e.x - 900, e.y - 1400, 1800, 1400 + 1); ctx.clip(); }
    const WT = ctx.getTransform();
    ctx.translate(e.x, e.y + sinkY); ctx.scale(f * ts, 1);
    const pv = p.pitch < 0 ? -150 : 128;
    ctx.translate(pv, 0); ctx.rotate(p.pitch); ctx.translate(-pv, 0);
    const ls = Rig.lightDir(ctx).x > 0 ? 1 : -1;
    const L2W = WT.inverse().multiply(ctx.getTransform());
    const toW = (q) => { const r = L2W.transformPoint({ x: q.x, y: q.y }); return { x: r.x, y: r.y }; };
    const g = geo(p);
    // phase II aura
    if (crys > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, -30, -190, 280, CRY, 0.13 * crys * (1 - dorm)); ctx.restore(); }
    // banner (world space cloth behind everything)
    const bAnchor = toW({ x: -214, y: -334 });
    if (dt > 0) e.banner.update(bAnchor.x, bAnchor.y, f, dt, -e.vx * 3 - f * 260 + Math.sin(e.t * 1.7) * 220, 2.75);
    if (e.banner.inited) { ctx.save(); ctx.setTransform(WT); K.tattered(ctx, e.banner.p, 11, 16, C.banner, C.bannerIn, 4); ctx.restore(); }
    blit(ctx, cached('A', BOX_A, f, paintBack), BOX_A, f);
    drawPipesLive(ctx, e, p, crys, dt, ghost, toW);
    // Hadal, then his beard (world-space chain)
    const chin = drawHadal(ctx, e, p, crys, ls);
    const cw = toW(chin);
    if (dt > 0) e.beard.update(cw.x, cw.y, f, dt, -e.vx * 2 + Math.sin(e.t * 2.2) * 120, 2.95 - p.hL * 0.25);
    if (e.beard.inited) {
      ctx.save(); ctx.setTransform(WT);
      Rig.ribbon(ctx, e.beard.p, 6.5, 1.2, C.beard, 1.4); ink(ctx, 1.6);
      ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); e.beard.p.forEach((q, i) => (i ? ctx.lineTo(q.x + 1, q.y) : ctx.moveTo(q.x + 1, q.y))); ctx.stroke();
      for (const i of [2, 4]) { const q = e.beard.p[i]; ctx.beginPath(); ctx.ellipse(q.x, q.y, 4.2, 2.4, 0, 0, TAU); ctx.fillStyle = C.brass; ctx.fill(); ink(ctx, 1.1); }
      ctx.restore();
    }
    drawTreads(ctx, e.trk || 0, ls, dorm);
    blit(ctx, cached('B', BOX_B, f, paintHull), BOX_B, f);
    drawFurnace(ctx, e, p, crys);
    if (crys > 0.01) drawCrystals(ctx, crys);
    drawClawArm(ctx, g, p, ls);
    drawDrill(ctx, e, g, p, crys, ls);
    // chains swinging under the boom
    const anchors = [lerpPt(PV, g.base, 0.35), lerpPt(PV, g.base, 0.8)].map((q) => toW({ x: q.x + g.nx * 14, y: q.y + g.ny * 14 }));
    if (dt > 0) e.chains.forEach((c, i) => c.update(anchors[i].x, anchors[i].y, f, dt, -e.vx * 3 + Math.sin(e.t * 2 + i) * 60, PI));
    if (e.chains[0].inited) { ctx.save(); ctx.setTransform(WT); e.chains.forEach((c) => drawChain(ctx, c.p)); ctx.restore(); }
    drawClawHead(ctx, e, g, p, crys);
    // tell aura on the part about to strike
    if (e.tellT > 0 && e.atk) {
      const at = typeof e.atk.at === 'function' ? e.atk.at(e.st) : e.atk.at;
      const q = at === 'claw' ? g.hc : at === 'pipes' ? { x: -150, y: -320 } : at === 'floor' ? null : g.tip;
      if (q) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, q.x, q.y, 64, e.tellCol === 'red' ? CRIM : '#ffffff', Math.min(1, e.tellT * 1.6)); ctx.restore(); }
    }
    // balance break: sparks + smoke from the stalled engine
    if (!ghost && dt > 0 && (e.state === 'broken' || dying > 0) && Math.random() < dt * 8) {
      const q = toW({ x: -60 + U.rand(-90, 90), y: -150 + U.rand(-30, 30) });
      G.FX.spark(q.x, q.y, 4, { col: EMBER, speed: 360 }); G.FX.dust(q.x, q.y, 2, { w: 30, speed: 40, size: 18, col: 'rgba(40,30,50,' });
    }
    ctx.restore();
    // floor tell for the burrow (where it will erupt)
    if (e.state === 'atk' && e.atk === BOSS.burrow && p.sink > 0.6 && e.tellT > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, e.x, e.y - 6, 120, CRIM, Math.min(1, e.tellT * 1.5)); ctx.restore();
    }
  }
  function drawPipesLive(ctx, e, p, crys, dt, ghost, toW) {
    const c = crys > 0.5 ? CRY : ORE, on = 1 - p.dorm, fl = 0.75 + 0.25 * Math.sin(e.t * 11) * Math.sin(e.t * 7.3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    PIPES.forEach(([x, w], i) => {
      const my = mouthY(i), a = on * (0.45 + 0.35 * p.vent + 0.15 * p.heat) * fl;
      ctx.fillStyle = U.rgba(c, Math.min(1, a)); ctx.fillRect(x - w * 0.28, my + 1, w * 0.56, 9);
      if (p.vent > 0.2) K.glow(ctx, x, my + 4, 26 * p.vent, c, 0.5 * p.vent);
    });
    ctx.restore();
    if (ghost || dt <= 0) return;
    // smoke from the crowns; a scalding blast while venting
    if (Math.random() < dt * (on * 3 + p.vent * 30)) {
      const [x, , top] = PIPES[(Math.random() * PIPES.length) | 0], q = toW({ x, y: top - 4 });
      G.FX.dust(q.x, q.y, 1 + (p.vent > 0.5 ? 2 : 0), { w: 10, speed: 50 + p.vent * 140, size: 14 + p.vent * 10, dir: -PI / 2, spread: 0.6, col: p.vent > 0.5 ? 'rgba(235,230,245,' : 'rgba(46,38,56,' });
    }
  }
  function drawFurnace(ctx, e, p, crys) {
    const on = 1 - p.dorm;
    // ignition flicker during the intro
    const flick = p.dorm > 0.02 && p.dorm < 0.98 ? (Math.sin(e.t * 47) > 0.2 ? 1 : 0.3) : 1;
    const a = on * flick * (0.5 + 0.3 * p.heat + 0.12 * Math.sin(e.t * 9) * Math.sin(e.t * 5.1)), c = crys > 0.5 ? CRY : ORE;
    if (a <= 0.01) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = U.rgba(c, 0.55 * a); ctx.fillRect(-150, -150, 68, 30);
    ctx.fillStyle = U.rgba(crys > 0.5 ? '#ffd6ff' : '#ffe2a8', 0.45 * a); ctx.fillRect(-148, -132, 64, 12);
    K.glow(ctx, -116, -138, 70, c, 0.4 * a);
    // nose lamps
    for (const [x, y] of EYES) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(0.86);
      ctx.fillStyle = U.rgba(c, 0.95 * on); ctx.beginPath(); ctx.moveTo(-11, -1); ctx.lineTo(-7, -5); ctx.lineTo(11, -3.5); ctx.lineTo(13, 0); ctx.lineTo(8, 3); ctx.lineTo(-9, 2.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,250,235,${0.9 * on})`; ctx.fillRect(-3, -2.5, 9, 2);
      ctx.restore();
      K.glow(ctx, x, y, 26, c, 0.5 * on);
    }
    ctx.restore();
  }
  function drawMound(ctx, e, p) {
    // a travelling heave of rubble with a violet crack where the drill is about to break through
    const k = U.clamp((p.sink - 0.4) / 0.6, 0, 1), x = e.x, y = e.y, w = 70 + 20 * Math.sin(e.t * 9);
    ctx.fillStyle = '#2b2433';
    ctx.beginPath(); ctx.moveTo(x - w, y + 1);
    for (let i = 0; i <= 8; i++) { const u = i / 8, hx = x - w + u * w * 2, hh = Math.sin(u * PI) * (14 + 6 * Math.sin(e.t * 13 + i)) * k; ctx.lineTo(hx, y - hh); }
    ctx.lineTo(x + w, y + 1); ctx.closePath(); ctx.fill(); ink(ctx, 2);
    ctx.fillStyle = '#4c4358'; for (let i = 0; i < 5; i++) { const hx = x - w * 0.7 + i * w * 0.35, hy = y - 8 * k - Math.abs(Math.sin(e.t * 11 + i * 2)) * 10 * k; ctx.beginPath(); ctx.arc(hx, hy, 3 + (i % 2) * 2, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(210,120,255,${0.6 * k})`; ctx.lineWidth = 2.4; ctx.beginPath();
    ctx.moveTo(x - w * 0.8, y - 1); for (let i = 1; i <= 6; i++) ctx.lineTo(x - w * 0.8 + i * w * 0.27, y - 1 - ((i * 5) % 3) * 2 * k); ctx.stroke();
    K.glow(ctx, x, y - 6, 60, CRY, 0.35 * k);
    ctx.restore();
  }
  function introEvents(e) {
    if (e.state !== 'spawn') return;
    const ev = e.introEv || (e.introEv = {}), st = e.st, f = e.facing;
    if (st > 0.7 && !ev.a) { ev.a = 1; G.SFX.play('c3_engine', 1.4); G.SFX.play('c3_steam'); for (const [x, , top] of PIPES) G.FX.dust(e.x + f * x, e.y + top, 3, { w: 12, speed: 120, size: 18, dir: -PI / 2, spread: 0.5, col: 'rgba(235,230,245,' }); }
    if (st > 1.3 && !ev.b) { ev.b = 1; G.SFX.play('c3_hadal', 1); G.FX.flash(e.x + f * -10, e.y - 262, 70, 0.4, ORE); }
    if (st > 2.2 && !ev.c) {
      ev.c = 1; G.SFX.play('c3_drillRev', 1.4); G.SFX.play('roar'); G.game.shake(0.9);
      G.FX.dust(e.x, e.y, 26, { w: 380, speed: 260, size: 20, col: 'rgba(160,140,175,' });
      G.FX.shards(e.x - f * 40, e.y - 200, 12, '#8f8396', 380);
    }
  }

  /* =========================== audio =========================== */
  const SND = {
    c3_engine(t, k = 1) { const A = G.AudioKit; A.tone('sine', 52, t, 0.004, 0.2 * k, 0.16, { to: 34, wet: 0.05 }); A.noise(t, 0.003, 0.07 * k, 0.12, 'lowpass', 420, 120, 0.8, 0.04); A.tone('sine', 50, t + 0.17, 0.004, 0.14 * k, 0.14, { to: 33, wet: 0.05 }); },
    c3_treads(t, k = 1) { const A = G.AudioKit; for (let i = 0; i < 4; i++) A.noise(t + i * 0.05, 0.002, 0.05 * k, 0.05, 'bandpass', 900 + i * 140, 600, 2.2, 0.05); A.tone('square', 96, t, 0.004, 0.02 * k, 0.2, { to: 70, filter: 'lowpass', ff: 600, wet: 0.08 }); },
    c3_drillRev(t, k = 1) {
      const A = G.AudioKit;
      A.tone('sawtooth', 60, t, 0.35, 0.05 * k, 0.8, { to: 250, filter: 'lowpass', ff: 1600, wet: 0.15 });
      A.tone('square', 121, t, 0.35, 0.018 * k, 0.8, { to: 500, filter: 'bandpass', ff: 1100, q: 2, wet: 0.15 });
      A.noise(t, 0.3, 0.09 * k, 0.7, 'bandpass', 900, 3400, 1.4, 0.15);
    },
    c3_grind(t) { const A = G.AudioKit; A.noise(t, 0.01, 0.22, 0.7, 'bandpass', 3200, 1800, 1.6, 0.2); A.tone('sawtooth', 180, t, 0.01, 0.05, 0.6, { to: 120, filter: 'lowpass', ff: 900, wet: 0.1 }); A.noise(t, 0.01, 0.15, 0.5, 'lowpass', 500, 120, 0.7, 0.1); },
    c3_clang(t, k = 1) { const A = G.AudioKit; A.tone('sine', 64, t, 0.003, 0.5 * k, 0.32, { to: 30, wet: 0.1 }); A.noise(t, 0.002, 0.3 * k, 0.16, 'lowpass', 2000, 260, 0.7, 0.1); A.bell(A.mtof(40), t, 0.06 * k, 1.1, 0.35, 0.5); },
    c3_steam(t) { const A = G.AudioKit; A.noise(t, 0.03, 0.3, 0.9, 'highpass', 2600, 1400, 0.7, 0.25); A.tone('sine', 1760, t, 0.04, 0.025, 0.55, { to: 1480, wet: 0.5 }); A.tone('sine', 2217, t, 0.04, 0.018, 0.5, { to: 1870, wet: 0.5 }); },
    // a growl pushed through organ pipes: low sawtooth chord swelling under a throat noise
    c3_hadal(t, ph = 1) {
      const A = G.AudioKit, root = ph === 2 ? 41 : 38;
      [0, 7, 12, ph === 2 ? 13 : 15].forEach((iv, i) => A.tone('sawtooth', A.mtof(root + iv), t + i * 0.025, 0.18, 0.032, 1.1, { filter: 'lowpass', ff: 700, wet: 0.45 }));
      A.noise(t, 0.15, 0.08, 0.9, 'bandpass', 380, 160, 1.6, 0.3);
    },
    c3_rumble(t) { const A = G.AudioKit; A.tone('sine', 36, t, 0.2, 0.3, 1.2, { to: 28, wet: 0.3 }); A.noise(t, 0.2, 0.13, 1.1, 'lowpass', 300, 90, 0.7, 0.3); for (let i = 0; i < 6; i++) A.noise(t + 0.2 + i * 0.13 + Math.random() * 0.05, 0.001, 0.04, 0.04, 'bandpass', 2400 + Math.random() * 1500, null, 2.5, 0.1); },
    c3_rockLand(t) { const A = G.AudioKit; A.tone('sine', 70, t, 0.003, 0.42, 0.25, { to: 32 }); A.noise(t, 0.002, 0.32, 0.22, 'lowpass', 1500, 200, 0.7, 0.1); A.noise(t + 0.02, 0.002, 0.1, 0.12, 'bandpass', 2600, 1200, 1.2, 0.05); },
    c3_crystal(t) { const A = G.AudioKit; A.bell(A.mtof(81), t, 0.05, 1.4, 0.6, 1.2); A.bell(A.mtof(88), t + 0.03, 0.04, 1.2, 0.6, 1.2); A.tone('sine', 55, t, 0.004, 0.38, 0.4, { to: 30, wet: 0.2 }); A.noise(t, 0.002, 0.22, 0.3, 'highpass', 3000, 5200, 0.6, 0.3); },
    c3_shard(t) { const A = G.AudioKit; A.tone('sine', 1500 + Math.random() * 400, t, 0.002, 0.028, 0.18, { to: 1100, wet: 0.4 }); A.noise(t, 0.001, 0.04, 0.05, 'highpass', 5000, null, 0.7, 0.1); },
    c3_hydraulic(t) { const A = G.AudioKit; A.noise(t, 0.04, 0.08, 0.25, 'bandpass', 1400, 600, 1.0, 0.08); A.tone('sine', 140, t, 0.02, 0.045, 0.2, { to: 90 }); },
  };
  for (const k in SND) G.SFX[k] = SND[k];

  /* =========================== data: bark, codex, portrait =========================== */
  D.speakers.c3_hadal = D.speakers.c3_hadal || { name: '哈德爾', en: 'HADAL', color: '#ffb35c' };
  D.barks.c3_bossP2 = { who: 'c3_hadal', text: '聽見了嗎……鑽頭在唱歌。再深一點……再深一點……' };
  // fallbacks only — the chapter file (ch3.js) registers after this one and its own lines replace these
  if (!D.dialog.c3_bossDefeat) {
    D.dialog.c3_bossDefeat = [
      { who: 'c3_hadal', text: '……鑽頭……停了。' },
      { who: 'c3_hadal', text: '原來……它不是沉默。是在換氣。' },
    ];
  }
  if (!D.codex.hushborn.some((c) => c.id === 'c3_boss')) {
    D.codex.hushborn.push({
      id: 'c3_boss', name: '鑽井王・哈德爾', en: 'HADAL, THE BORE-KING', portrait: 'c3_boss', unlock: 'seen_c3_boss',
      tag: '頭目｜失聲者・斷層之井',
      body: [
        '第三降臨隊隊長。十年前帶著鑽井隊向下挖，要找寂靜的源頭。隊員一個個沉默之後，他把自己焊進鑽井履帶車的駕駛座，再也沒有出來。',
        '第一樂章：鑽臂兩連掃（白光）、鑽頭突進（紅光——突進後鑽頭會卡進地面，是反擊的好時機）、鐵爪三連搥（白光，第三下會停頓一拍）、鐵爪擒拿（紅光）、近身車體衝撞（白光）、天井落石。',
        '第二樂章：鑽頭化為寂晶。潛地突襲（地面裂光——紅色，閃開）、螺旋晶雨（白光，完美格擋可以把晶片彈回去）、地脈裂晶（紅色，跳過去）。',
        '弱點：履帶車轉身很慢，繞到背後就能痛擊——但別待太久，排氣管會噴出滾燙的蒸氣（紅光）。',
        '操控台上焊著一行字：「只要鑽頭還在轉，寂靜就不會贏。」',
      ],
    });
  }
  if (G.UI && G.UI.portraits) {
    G.UI.portraits.c3_boss = (ctx, Wd, Hd, g) => {
      const off = document.createElement('canvas'); off.width = Wd; off.height = Hd;
      const oc = off.getContext('2d');
      const e = new G.Enemy('c3_boss', 0, 0, {}); e.state = 'idle'; e.facing = 1; e.onGround = true; e.t = 1.3;
      const s = Wd / 650;
      for (let k = 0; k < 50; k++) { oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, Wd, Hd); oc.setTransform(s, 0, 0, s, Wd * 0.39, Hd * 0.86); e.t += 1 / 60; e.draw(oc); }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(off, 0, 0);
    };
  }
})(window.G);

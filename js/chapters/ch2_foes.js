'use strict';
/* ECHOFALL — Chapter II foes: Rimehound, Knell Monk, Tetherling, Linesman, and the elite Olin, the Frozen Bugler.
   Everything here is drawn procedurally in the Hades-like inked cel style (see docs/CHAPTER_API.md §5). */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK;
  const ICE = '#8fe9ff', ICE_W = '#e6fbff', ROSE = '#ff6fa8', AMBER = '#ffbf6b', BRONZE = '#b8833f';
  const clamp = U.clamp, lerp = U.lerp;
  const DBG = typeof location !== 'undefined' && /c2box/.test(location.hash);
  // test aid: #...&c2pose=attack:time holds every foe that has that attack frozen at that moment (gallery/shot)
  const DPOSE = typeof location !== 'undefined' && (location.hash.match(/c2pose=(\w+):([\d.]+)/) || null);
  function debugPose(e) {
    if (!DPOSE || e.dead) return false;
    const def = e.T[DPOSE[1]]; if (!def) return false;
    if (e.atk !== def) { e.startAtk(def); }
    e.st = +DPOSE[2]; e.vx = 0; e.cd = 99; if (!e.fly) e.vy = 0;
    return true;
  }

  /* ============================ shared helpers ============================ */
  const dirv = (a, l) => ({ x: Math.sin(a) * l, y: Math.cos(a) * l });            // angle from straight down (+ = forward)
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const rot = (p, a) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });
  const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const snap = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 4);
  const win = (t, a, b) => clamp((t - a) / (b - a), 0, 1);               // 0..1 ramp inside [a,b]
  const bump = (t, a, b) => { const k = win(t, a, b); return Math.sin(k * PI); };
  function ink(ctx, w = 1.3) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  function poly(ctx, pts, close = true) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); if (close) ctx.closePath(); }
  function smooth(ctx, pts) {
    ctx.beginPath(); const n = pts.length, m0 = mix(pts[n - 1], pts[0], 0.5); ctx.moveTo(m0.x, m0.y);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], m = mix(a, b, 0.5); ctx.quadraticCurveTo(a.x, a.y, m.x, m.y); }
    ctx.closePath();
  }
  const P = (x, y) => ({ x, y });
  const pts = (arr) => { const o = []; for (let i = 0; i < arr.length; i += 2) o.push({ x: arr[i], y: arr[i + 1] }); return o; };
  // a hard two-tone cel plate: dark body, lit upper band, ink contour and a rim glint along the top edge
  function plate(ctx, q, lit, dark, rim = 'rgba(255,255,255,0.85)', w = 1.2) {
    poly(ctx, q); ctx.fillStyle = dark; ctx.fill();
    const n = q.length, h = Math.ceil(n / 2);
    const top = q.slice(0, h).concat([mix(q[h - 1], q[h % n], 0.5), mix(q[0], q[n - 1], 0.5)]);
    poly(ctx, top); ctx.fillStyle = lit; ctx.fill();
    poly(ctx, q); ink(ctx, w);
    if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); for (let i = 1; i < h; i++) ctx.lineTo(q[i].x, q[i].y); ctx.stroke(); }
  }
  // crystal shard: split down its axis into a lit and a shadow facet
  function shard(ctx, base, a, len, wid, lit, dark, tip) {
    const d = dirv(a, len), n = { x: Math.cos(a) * wid, y: -Math.sin(a) * wid };
    const T = add(base, d), L = add(base, n), R = { x: base.x - n.x, y: base.y - n.y }, M = add(base, { x: d.x * 0.3, y: d.y * 0.3 });
    poly(ctx, [L, T, M]); ctx.fillStyle = lit; ctx.fill();
    poly(ctx, [R, T, M]); ctx.fillStyle = dark; ctx.fill();
    if (tip) { poly(ctx, [mix(L, T, 0.62), T, mix(R, T, 0.62)]); ctx.fillStyle = tip; ctx.fill(); }
    poly(ctx, [L, T, R]); ink(ctx, 1);
  }
  // ink-cased cable/limb stroke: thick ink, colour core, thin highlight (no gradients — cheap for many legs)
  function cable(ctx, p, col, w, hi) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.strokeStyle = INK; ctx.lineWidth = w + 2.2; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    if (hi) { ctx.save(); ctx.translate(-w * 0.18, -w * 0.22); ctx.strokeStyle = hi; ctx.lineWidth = Math.max(0.6, w * 0.3); ctx.stroke(); ctx.restore(); }
  }
  function cel(ctx, cx, cy, nx, ny, w, hex) { const L = Rig.lightDir(ctx), sd = nx * L.x + ny * L.y >= 0 ? 1 : -1; return Rig.celGrad(ctx, cx, cy, nx, ny, w, sd, Rig.ramp(hex)); }
  function glowAdd(ctx, x, y, r, col, a) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, r, col, a); ctx.restore(); }
  const dying = (e) => (e.state === 'die' ? clamp(e.st / 0.5, 0, 1) : 0);
  // death: frost crumbles away — the body squats, fades, sheds glittering motes in the foe's colour
  function dissolve(ctx, e, ghost, col) {
    const k = dying(e); if (!k) return 0;
    ctx.globalAlpha *= 1 - k * k;
    ctx.translate(0, 0); ctx.scale(1 + k * 0.12, 1 - k * 0.3);
    if (!ghost && G.game.dtVis > 0 && Math.random() < 0.7) G.FX.ember(e.x, e.y - e.h * (0.3 + Math.random() * 0.5), 1, col, { w: e.w, h: 10, up: 90 });
    return k;
  }
  // rising out of the floor: clip at the feet so the part still underground stays hidden (the floor is painted behind
  // the foes, and a dialogue can freeze a foe mid-emerge for several seconds)
  function riseClip(ctx, e, sink) { if (sink > 0.5) { ctx.beginPath(); ctx.rect(e.x - 900, e.y - 2400, 1800, 2403); ctx.clip(); } }
  function tellGlow(ctx, e, x, y, r = 26) { if (e.tellT > 0) glowAdd(ctx, x, y, r, e.tellCol === 'red' ? K.CRIM : '#ffffff', e.tellT * 1.4); }
  function dbg(ctx, e) {
    if (!DBG || !e.atk || !e.atk.hits) return;
    ctx.save(); ctx.lineWidth = 1.5;
    for (const h of e.atk.hits) { const b = e.boxW(h.box), on = e.st >= h.t0 && e.st <= h.t1; ctx.strokeStyle = h.red ? 'rgba(255,40,80,.95)' : 'rgba(120,255,140,.95)'; ctx.setLineDash(on ? [] : [5, 4]); ctx.strokeRect(b.x, b.y, b.w, b.h); }
    ctx.restore();
  }
  const hurtW = (e) => Math.max(e.hitK, e.state === 'hurt' || e.state === 'recoil' ? Math.sin(Math.min(1, e.st / (e.hurtDur || 0.36)) * PI) : 0);
  const others = (e, r) => G.game.enemies.filter((o) => o !== e && !o.dead && o.state !== 'spawn' && Math.abs(o.x - e.x) < r && Math.abs(o.y - e.y) < 300);
  const groundAt = (x, y) => { const g = G.Phys.groundBelow(x, y); return g > 1e8 ? null : g; };

  /* ---- shared hazards ---- */
  // Rimehound howl: hasted foes run hotter for a few seconds (shared ticker restores their speed afterwards)
  function haste(o, dur) {
    if (o.boss) return;
    if (!o.c2haste) { o.c2base = o.speedMul; o.speedMul = o.speedMul * 1.35; }
    o.c2haste = dur; o.cd = Math.min(o.cd, 0.5);
    const g = G.game;
    if (!g.hazards.some((h) => h.c2aura)) {
      g.hazards.push({
        c2aura: true, t: 0,
        update(h, dt, game) {
          let any = false;
          for (const q of game.enemies) if (q.c2haste > 0) {
            q.c2haste -= dt; any = true;
            if (q.c2haste <= 0 || q.dead) { q.c2haste = 0; q.speedMul = q.c2base || 1; }
            else if (Math.random() < dt * 14) G.FX.ember(q.x - q.facing * q.w * 0.3, q.y - q.h * 0.5, 1, ICE, { w: q.w, h: q.h * 0.6, up: 40, sp: 60, life: 0.5 });
          }
          if (!any) h.done = true;
        },
        draw(ctx, h, game) {
          ctx.globalCompositeOperation = 'lighter';
          for (const q of game.enemies) if (q.c2haste > 0 && !q.dead) {
            const a = Math.min(1, q.c2haste) * 0.5, y = q.y - q.h * 0.5;
            K.glow(ctx, q.x, q.y - 4, q.w * 0.9, ICE, a * 0.6);
            ctx.strokeStyle = U.rgba(ICE_W, a); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
            for (let i = 0; i < 3; i++) {
              const yy = y + (i - 1) * q.h * 0.22, ph = (h.t * 3 + i * 0.37) % 1, x0 = q.x - q.facing * (q.w * 0.4 + ph * 40);
              ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 - q.facing * (18 + i * 6), yy + 2); ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }
        },
      });
    }
  }

  /* ============================ RIMEHOUND 霜鳴犬 ============================ */
  // A wolf of ice plates over a hollow ribcage — the crystal heart glows inside the bars. Packs of 2–3.
  const RH = TYPES.c2_rimehound = {
    name: '霜鳴犬', en: 'RIMEHOUND', w: 76, h: 56, hp: 58, bal: 44, col: ICE, shards: 22, kbMul: 1.15, spawnT: 0.7,
    portrait: [3.1, 0.82],
    init(e) { e.tail = new Rig.Chain(6, 7.5, 0.16, 0.84); e.gait = Math.random() * TAU; e.howlCd = 1.5 + Math.random() * 2.5; e.slot = Math.random() * 60; },
    voice: (e) => G.SFX.play('c2_rimeSnarl', e.atk === RH.howl),
    weapon: (e) => ({ x: e.x + e.facing * 66, y: e.y - 46 }),
    think(e, dt) {
      e.faceP(); const d = e.distP(); e.howlCd -= dt;
      const want = 150 + e.slot;
      const tv = d > want + 30 ? 250 : d < want - 60 ? -140 : Math.sin(e.t * 1.7 + e.slot) * 40;
      e.vx = U.approach(e.vx, e.facing * tv * e.speedMul, 1500 * dt);
      if (e.cd > 0) return;
      const pack = others(e, 650);
      if (e.howlCd <= 0 && pack.length && !pack.some((o) => o.c2haste > 0) && d > 170) { e.howlCd = 11 + Math.random() * 4; e.startAtk(RH.howl); return; }
      if (d < 115) e.startAtk(RH.snap2);
      else if (d < 245) e.startAtk(RH.lunge);
    },
    // lunge-bite: crouch, spring and close the exact gap (white)
    lunge: {
      dur: 1.2, cd: 1.5, track: false, tells: [{ t: 0.12, c: 'white' }],
      hits: [{ t0: 0.6, t1: 0.82, box: { x: 4, y: -56, w: 68, h: 48 }, dmg: 14, kb: 240, last: true, pbal: 34 }],
      ev: [{ t: 0.58, fn: (e) => { const d = Math.max(0, (e.P.x - e.x) * e.facing); e.lungeV = clamp((d - 26) / 0.2, 150, 820); e.vy = -280; G.SFX.play('whoosh', 0.9); } }],
    },
    // double snap: two quick bites stepping in (white, white)
    snap2: {
      dur: 1.45, cd: 1.3, tells: [{ t: 0.02, c: 'white' }, { t: 0.55, c: 'white' }],
      moves: [{ t0: 0.42, t1: 0.5, v: 300 }, { t0: 0.94, t1: 1.02, v: 320 }],
      hits: [{ t0: 0.48, t1: 0.58, box: { x: 10, y: -52, w: 60, h: 42 }, dmg: 11, kb: 180 }, { t0: 1.0, t1: 1.1, box: { x: 10, y: -52, w: 60, h: 42 }, dmg: 12, kb: 230, last: true }],
      ev: [{ t: 0.48, fn: () => G.SFX.play('c2_bite') }, { t: 1.0, fn: () => G.SFX.play('c2_bite') }],
    },
    // howl: no blow — the pack around it runs faster for a few seconds
    howl: {
      dur: 1.7, cd: 0.6,
      ev: [{ t: 0.55, fn: (e) => {
        G.SFX.play('c2_howl'); G.FX.ring(e.x + e.facing * 40, e.y - 60, 10, 220, 0.7, ICE, 4); G.FX.ring(e.x + e.facing * 40, e.y - 60, 10, 140, 0.5, ROSE, 2);
        haste(e, 5); for (const o of others(e, 650)) { haste(o, 5); G.FX.ring(o.cx, o.cy, 6, 60, 0.4, ICE, 3); }
      } }],
    },
    atkUpdate(e, dt) {
      if (e.atk === RH.lunge) {
        if (e.st >= 0.58 && e.st < 0.8) e.vx = e.facing * e.lungeV;
        else if (e.st >= 0.8 && e.onGround) e.vx = U.approach(e.vx, 0, 2600 * dt);
      }
    },
    draw(ctx, e, ghost) {
      const dt = G.game.dtVis, t = e.t, st = e.st, A = e.atk;
      ctx.save();
      const sink = K.emerge(ctx, e) * 50;
      riseClip(ctx, e, sink);
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing, 1);
      dissolve(ctx, e, ghost, ICE);
      const moving = Math.abs(e.vx) > 25 && e.state !== 'atk' && e.onGround;
      if (moving) e.gait += dt * Math.abs(e.vx) * 0.06;
      const hk = hurtW(e), broken = e.state === 'broken' ? 1 : 0;
      // ---- animation channels ----
      let crouch = 0, stretch = 0, jaw = 0.12 + Math.sin(t * 2.3) * 0.06, headA = 0.18 + Math.sin(t * 1.4) * 0.05, pitch = 0, headX = 0, howl = 0;
      if (e.state === 'atk' && A === RH.lunge) {
        crouch = ease(st / 0.5) * (1 - win(st, 0.58, 0.64));
        stretch = win(st, 0.56, 0.62) * (1 - win(st, 0.86, 1.05));
        jaw = st < 0.56 ? 0.05 : stretch * 0.95;
        headA = lerp(0.35, -0.15, stretch); pitch = -0.08 * crouch + 0.12 * stretch;
        crouch += 0.6 * bump(st, 0.82, 1.2);
      } else if (e.state === 'atk' && A === RH.snap2) {
        const o1 = win(st, 0.12, 0.44) * (1 - win(st, 0.48, 0.52)), o2 = win(st, 0.62, 0.96) * (1 - win(st, 1.0, 1.04));
        jaw = Math.max(o1, o2) * 0.95 + 0.04; crouch = 0.35 * Math.max(o1, o2);
        headX = 9 * Math.max(bump(st, 0.46, 0.62), bump(st, 0.98, 1.14)); headA = 0.3 - 0.25 * Math.max(o1, o2);
      } else if (e.state === 'atk' && A === RH.howl) {
        howl = win(st, 0.2, 0.5) * (1 - win(st, 1.35, 1.65));
        headA = lerp(headA, -1.05, howl); jaw = lerp(jaw, 0.85, win(st, 0.45, 0.6) * (1 - win(st, 1.3, 1.5))); pitch = 0.22 * howl; crouch = -0.1 * howl;
      }
      if (broken) { crouch = 1.4; headA = 0.85 + Math.sin(t * 2.5) * 0.12; jaw = 0.3; pitch = -0.05; }
      headA -= 0.55 * hk; pitch += 0.12 * hk; jaw = Math.max(jaw, 0.6 * hk);
      const bob = moving ? -Math.abs(Math.sin(e.gait)) * 2.5 : Math.sin(t * 2.2) * 1.2;
      const air = !e.onGround && e.state !== 'spawn' ? 1 : 0;
      // ---- skeleton ----
      const C = P(-2 + stretch * 4, -41 + crouch * 12 + bob);
      const S = add(C, rot(P(23 + stretch * 8, -5), -pitch)), H = add(C, rot(P(-25 - stretch * 6, -3), -pitch));
      const N = add(S, rot(P(8, -10), -pitch)), HD = add(N, P(7 + headX, -2));
      // ---- feet ----
      const feet = (front, near) => {
        const base = front ? S.x + 3 : H.x - 3, off = near ? 5 : -4;
        let fx = base + off, fy = 0;
        if (moving) { const ph = e.gait + (front === near ? 0 : PI); fx += Math.cos(ph) * 14; fy = -Math.max(0, -Math.sin(ph)) * 10; }
        if (air || stretch > 0.3) { const k = Math.max(stretch, air * 0.7); fx += (front ? 22 : -24) * k; fy -= 8 * k; }
        if (broken) { fx = base + (front ? 10 : -6) + off; }
        return P(fx, fy);
      };
      const leg = (front, near) => {
        const f = feet(front, near), root = front ? add(S, P(near ? 2 : -2, 4)) : add(H, P(near ? 1 : -3, 5));
        const col = near ? '#7d96bb' : '#3a4767';
        if (front) {
          const wr = add(f, P(-2, -10)), s = Rig.solve2(root, wr, 19, 20, -1), el = add(root, dirv(s.a, 19));
          Rig.limbChain(ctx, [root, el, wr, add(f, P(5, 0))], [6.6, 4.2, 3, 2.4], col);
          if (near) shard(ctx, mix(root, el, 0.4), s.a + 2.6, 14, 4.4, '#d4efff', '#55759f');
        } else {
          const hock = add(f, P(-7, -14)), s = Rig.solve2(root, hock, 20, 19, 1), kn = add(root, dirv(s.a, 20));
          Rig.limbChain(ctx, [root, kn, hock, add(f, P(4, 0))], [8.6, 5, 3.2, 2.4], col);
          if (near) shard(ctx, mix(root, kn, 0.3), s.a + 3.4, 16, 5.4, '#d4efff', '#55759f');
        }
        ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath();   // claws
        for (let i = 0; i < 3; i++) { ctx.moveTo(f.x + 2 + i * 2, f.y - 1); ctx.lineTo(f.x + 6 + i * 2.2, f.y + 1.2); } ctx.stroke();
      };
      // ground shadow
      if (e.onGround) { ctx.fillStyle = 'rgba(10,14,30,0.28)'; ctx.beginPath(); ctx.ellipse(0, 1, 44, 5, 0, 0, TAU); ctx.fill(); }
      leg(true, false); leg(false, false);
      // ---- tail: a chain of shrinking ice shards ----
      if (!ghost) e.tail.update(e.x + e.facing * H.x, e.y + sink + H.y - 2, e.facing, dt, -e.vx * 3 + Math.sin(t * 2.6) * 260, 1.9 - howl * 0.4);
      if (e.tail.inited) {
        const tp = e.tail.p.map((q) => P((q.x - e.x) * e.facing, q.y - e.y - sink));
        for (let i = tp.length - 2; i >= 0; i--) {
          const a = tp[i], b = tp[i + 1], ang = Math.atan2(b.x - a.x, b.y - a.y);
          shard(ctx, a, ang, 11 - i * 0.6, 4.6 - i * 0.55, i % 2 ? '#d6f5ff' : '#c2ebff', '#5e7fae', i === tp.length - 2 ? ROSE : null);
        }
      }
      // ---- hollow ribcage ----
      const sp = (u) => { const q = mix(H, S, u); return P(q.x, q.y - Math.sin(u * PI) * 6); };   // arched spine
      const belly = (u) => { const q = mix(H, S, u); return P(q.x + 2, q.y + 17 - Math.sin(u * PI) * 1 - crouch * 2); };
      ctx.beginPath(); ctx.moveTo(sp(0).x, sp(0).y);
      for (let u = 0.1; u <= 1.001; u += 0.1) ctx.lineTo(sp(u).x, sp(u).y);
      for (let u = 1; u >= -0.001; u -= 0.1) ctx.lineTo(belly(u).x, belly(u).y);
      ctx.closePath(); ctx.fillStyle = '#0b1222'; ctx.fill();
      // crystal heart inside the bars
      const hc = add(mix(H, S, 0.6), P(0, 6)), pulse = 0.75 + Math.sin(t * 4) * 0.25 + howl * 0.4;
      glowAdd(ctx, hc.x, hc.y, 26, ICE, 0.55 * pulse);
      poly(ctx, [P(hc.x, hc.y - 9), P(hc.x + 6, hc.y - 1), P(hc.x + 1, hc.y + 8), P(hc.x - 5, hc.y)]); ctx.fillStyle = '#c9f6ff'; ctx.fill();
      poly(ctx, [P(hc.x, hc.y - 9), P(hc.x + 1, hc.y + 8), P(hc.x - 5, hc.y)]); ctx.fillStyle = '#5fd2f0'; ctx.fill();
      ctx.strokeStyle = ROSE; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(hc.x - 2, hc.y - 4); ctx.lineTo(hc.x + 2, hc.y + 1); ctx.lineTo(hc.x - 1, hc.y + 5); ctx.stroke();
      poly(ctx, [P(hc.x, hc.y - 9), P(hc.x + 6, hc.y - 1), P(hc.x + 1, hc.y + 8), P(hc.x - 5, hc.y)]); ink(ctx, 0.9);
      // ribs: bone-ice bars curling under the chest
      for (let i = 0; i < 6; i++) {
        const u = 0.3 + i * 0.12, a = sp(u), b = belly(u - 0.07);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(a.x + 9, (a.y + b.y) / 2, b.x, b.y);
        ctx.strokeStyle = INK; ctx.lineWidth = 4.4; ctx.lineCap = 'round'; ctx.stroke();
        ctx.strokeStyle = '#dcefff'; ctx.lineWidth = 2.4; ctx.stroke();
        ctx.strokeStyle = '#7c95c2'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x + 3, (a.y + b.y) / 2 + 3); ctx.quadraticCurveTo(a.x + 5, b.y - 2, b.x - 1, b.y - 1); ctx.stroke();
      }
      // belly line + sternum spur
      ctx.beginPath(); ctx.moveTo(belly(0.25).x, belly(0.25).y); for (let u = 0.3; u <= 1.0; u += 0.1) ctx.lineTo(belly(u).x, belly(u).y); ink(ctx, 1.4);
      // ---- back armour: overlapping plates hip → shoulder ----
      const hipPlate = [add(H, P(-15, -2)), add(H, P(-4, -14)), add(H, P(12, -11)), add(H, P(14, 2)), add(H, P(2, 10)), add(H, P(-12, 8))];
      plate(ctx, hipPlate, '#d6f0ff', '#5574a6');
      for (let i = 0; i < 4; i++) {
        const u = 0.32 + i * 0.17, a = sp(u - 0.1), b = sp(u + 0.1);
        plate(ctx, [add(a, P(-3, -5)), add(b, P(4, -9)), add(b, P(6, 4)), add(a, P(-1, 6))], i % 2 ? '#cdeaff' : '#e0f6ff', '#52719f');
      }
      leg(false, true);
      // ---- neck: a thick throat of stacked plates bridging chest and skull ----
      const throat = add(HD, P(-2, 9)), chest = add(S, P(4, 12));
      poly(ctx, [add(S, P(-10, -6)), add(HD, P(-4, -8)), add(HD, P(4, 4)), throat, chest, add(S, P(-6, 14))]); ctx.fillStyle = '#5a78a8'; ctx.fill(); ink(ctx, 1.3);
      for (let i = 0; i < 3; i++) {
        const a = mix(S, HD, 0.15 + i * 0.28), b = mix(S, HD, 0.42 + i * 0.28);
        plate(ctx, [add(a, P(-3, -7)), add(b, P(3, -9)), add(b, P(5, 3)), add(a, P(-1, 5))], '#d8f2ff', '#5d7eb0');
      }
      // ---- mane: tall crystal spikes swept back off the shoulders (the silhouette) ----
      const mane = [[-0.2, 2.75, 22], [0.3, 2.62, 30], [0.75, 2.5, 26], [1.05, 2.38, 18]];
      for (const [u, a, l] of mane) {
        const b = mix(S, N, u), wob = Math.sin(t * 3 + u * 4) * 0.04 - howl * 0.25 + hk * 0.3;
        shard(ctx, add(b, P(-2, -4)), a + wob - pitch, l * (1 + howl * 0.15), 4.8, '#f0fcff', '#6c8ebf', u > 0.5 ? '#ffb3d1' : null);
      }
      leg(true, true);
      // ---- head ----
      ctx.save(); ctx.translate(HD.x, HD.y); ctx.rotate(headA - pitch); ctx.scale(1.18, 1.18);
      const ja = jaw * 0.75;
      // mouth cavity
      poly(ctx, [P(0, 2), P(27, 1), ...[P(25, 6)].map((q) => rot(q, ja)), rot(P(3, 9), ja)]); ctx.fillStyle = '#2a0c24'; ctx.fill();
      if (jaw > 0.3) glowAdd(ctx, 12, 4, 14, howl ? ICE : ROSE, 0.35 * jaw);
      // lower jaw
      ctx.save(); ctx.rotate(ja);
      plate(ctx, [P(1, 3), P(25, 4), P(23, 8.5), P(4, 10)], '#c9e9fb', '#6383b3', null, 1.1);
      ctx.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) { const x = 9 + i * 4.2; poly(ctx, [P(x, 4.2), P(x + 1.4, 0.4), P(x + 2.8, 4.2)]); ctx.fill(); }
      ctx.restore();
      // upper skull: angular ice plates
      const skull = [P(-9, -7), P(3, -12), P(16, -9), P(28, -5), P(31, -1), P(28, 2.6), P(1, 3.4), P(-8, 2)];
      plate(ctx, skull, '#eefbff', '#7495c4', 'rgba(255,255,255,0.9)', 1.3);
      ctx.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) { const x = 6 + i * 4.3; poly(ctx, [P(x, 2.2), P(x + 1.5, 6.6 - (i % 2) * 1.5), P(x + 3, 2.2)]); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke(); }
      // snout ridge plate + nose
      plate(ctx, [P(6, -9.5), P(24, -6), P(22, -3), P(7, -5)], '#ffffff', '#9fc0e2', null, 0.8);
      poly(ctx, [P(29, -3.2), P(32, -1.4), P(29.6, 0.6)]); ctx.fillStyle = '#1c2236'; ctx.fill();
      // swept crystal ears
      shard(ctx, P(-3, -9), 2.55 - hk * 0.3 + howl * 0.2, 16, 4, '#e6f8ff', '#5f81b3', ROSE);
      shard(ctx, P(-7, -7), 2.4 - hk * 0.3, 12, 3.4, '#cdeeff', '#4e6f9e', null);
      // eye: icy slit with a rose pupil
      const eyeA = broken ? 0.35 + Math.sin(t * 9) * 0.25 : 1;
      glowAdd(ctx, 13, -5, 11, ICE, 0.6 * eyeA);
      poly(ctx, [P(8, -5.2), P(17.5, -7.2), P(15.5, -4.2)]); ctx.fillStyle = U.rgba('#e9fdff', eyeA); ctx.fill();
      ctx.fillStyle = ROSE; ctx.beginPath(); ctx.arc(14, -5.6, 1.1, 0, TAU); ctx.fill();
      tellGlow(ctx, e, 26, 0, 24);
      // frost breath
      if (!broken) for (let i = 0; i < 2; i++) {
        const ph = (t * 0.55 + i * 0.5) % 1;
        ctx.fillStyle = `rgba(230,248,255,${(1 - ph) * 0.28})`; ctx.beginPath(); ctx.arc(32 + ph * 18, 1 - ph * 8, 2.5 + ph * 6, 0, TAU); ctx.fill();
      }
      ctx.restore();
      ctx.restore();
      dbg(ctx, e);
    },
  };

  /* ============================ KNELL MONK 喪鐘僧 ============================ */
  // A towering monk in a frost-crusted burgundy robe; his head is a cracked bronze bell turned to face you,
  // a crystal clapper glowing inside its mouth. He carries a long bell-hammer like a pilgrim's staff.
  function kf(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i], k = (b[2] === 'snap' ? snap : b[2] === 'lin' ? (x) => clamp(x, 0, 1) : ease)((t - a[0]) / (b[0] - a[0] || 1)), o = {};
      for (const n in b[1]) o[n] = lerp(a[1][n] ?? b[1][n], b[1][n], k);
      return o;
    }
    return keys[keys.length - 1][1];
  }
  const MKI = { hx: 27, hy: -100, ha: 0.12, lean: 0.1, cr: 0, tilt: 0 };
  // ground shockwave: a ridge of ice and bronze sound that runs along the floor — jump it (red)
  function shockwave(owner, x, y, dir, opt = {}) {
    G.game.hazards.push({
      t: 0, life: opt.life || 1.6, x, y, x0: x, dir, owner, hit: false, speed: opt.speed || 470, dmg: opt.dmg || 15, col: opt.col || ICE,
      update(h, dt, g) {
        const nx = h.x + h.dir * h.speed * dt, gy = groundAt(nx, h.y - 30);
        if (gy == null || Math.abs(gy - h.y) > 26) { h.done = true; return; }
        for (const s of G.Phys.allSolids()) if (nx > s.x && nx < s.x + s.w && h.y - 12 > s.y && h.y - 12 < s.y + s.h) { h.done = true; return; }
        h.x = nx; h.y = gy;
        const Pl = g.player;
        if (!h.hit && h.t < h.life - 0.15 && Math.abs(Pl.x - h.x) < 26 && Pl.y > h.y - 34 && Pl.y <= h.y + 6) {
          h.hit = true; Pl.receiveHit(h.owner, { dmg: h.dmg, unblockable: true, kb: 300, hx: h.x, hy: h.y - 20 });
        }
        if (Math.random() < dt * 26) G.FX.shards(h.x, h.y - 3, 1, h.col, 280);
        if (Math.random() < dt * 20) G.FX.dust(h.x, h.y, 1, { w: 20, speed: 120, size: 8 });
      },
      draw(ctx, h) {
        const fade = 1 - clamp((h.t - (h.life - 0.3)) / 0.3, 0, 1), d = h.dir;
        ctx.globalAlpha = fade;
        // the trail: cracked frost line back toward the origin
        ctx.strokeStyle = U.rgba(h.col, 0.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(h.x0, h.y - 1); ctx.lineTo(h.x, h.y - 1); ctx.stroke();
        // sound arcs riding behind the crest
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const ph = (h.t * 5 + i / 3) % 1, r = 10 + ph * 34;
          ctx.strokeStyle = U.rgba(i % 2 ? AMBER : h.col, (1 - ph) * 0.7); ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.ellipse(h.x - d * ph * 30, h.y - 2, r * 0.55, r, 0, d > 0 ? -PI / 2 : PI / 2, d > 0 ? PI / 2 : PI * 1.5, d < 0); ctx.stroke();
        }
        K.glow(ctx, h.x, h.y - 14, 46, h.col, 0.45);
        ctx.restore();
        // the crest: a jagged run of crystal teeth
        const rng = U.mulberry32((h.x0 | 0) + 7);
        for (let i = 0; i < 5; i++) {
          const bx = h.x - d * i * 9, ht = (32 - i * 6) * (0.85 + rng() * 0.3) * (0.85 + Math.sin(h.t * 30 + i) * 0.15);
          shard(ctx, P(bx, h.y + 2), PI - d * (0.25 + i * 0.08), ht, 5 - i * 0.6, '#effcff', '#5a7fb6', i === 0 ? ROSE : null);
        }
        ctx.globalAlpha = 1;
      },
    });
  }
  const MK = TYPES.c2_knellmonk = {
    name: '喪鐘僧', en: 'KNELL MONK', w: 50, h: 176, hp: 125, bal: 92, col: '#ffcf8a', shards: 38, poise: true, kbMul: 0.7, spawnT: 1.0,
    portrait: [1.75, 0.93],
    init(e) { e.stole = new Rig.Chain(6, 9, 0.1, 0.86); e.gaitP = 0; },
    voice: (e) => G.SFX.play('c2_knell', e.atk === MK.toll ? 1 : 0.6),
    weapon: (e) => e.hhead ? { x: e.x + e.facing * e.hhead.x, y: e.y + e.hhead.y } : { x: e.x + e.facing * 40, y: e.y - 120 },
    onHit: () => G.SFX.play('c2_bronze', 0.5),
    think(e, dt) {
      e.faceP(); const d = e.distP();
      const tv = d > 150 ? 78 : d < 80 ? -60 : 0;
      e.vx = U.approach(e.vx, e.facing * tv * e.speedMul, 600 * dt);
      if (e.cd > 0) return;
      if (d < 150) e.startAtk(Math.random() < 0.55 ? MK.sweep : MK.toll);
      else if (d < 210 || (d < 460 && Math.random() < 0.012)) e.startAtk(MK.toll);
    },
    // toll-slam: hammer raised behind the bell, brought down in front (red) — the floor rings out a shockwave
    toll: {
      dur: 2.15, cd: 1.7, trackSpeed: 110, tells: [{ t: 0.3, c: 'red' }],
      hits: [{ t0: 1.0, t1: 1.12, box: { x: 30, y: -165, w: 108, h: 165 }, dmg: 24, red: true, kb: 380, last: true }],
      ev: [{ t: 0.92, fn: () => G.SFX.play('whoosh', 1.3) }, { t: 1.06, fn: (e) => {
        const hx = e.x + e.facing * 120, gy = groundAt(hx, e.y - 40) ?? e.y;
        G.game.shake(0.55); G.SFX.play('c2_knell', 1.4); G.SFX.play('quake');
        G.FX.ring(hx, gy, 8, 130, 0.45, AMBER, 5, { flat: 0.2 }); G.FX.dust(hx, gy, 16, { w: 60, speed: 260, size: 14 }); G.FX.shards(hx, gy - 6, 10, ICE, 420);
        shockwave(e, hx, gy, e.facing);
      } }],
      keys: [[0, MKI], [0.55, { hx: 6, hy: -152, ha: PI + 0.45, lean: -0.12, cr: 0, tilt: -0.25 }], [0.97, { hx: 2, hy: -158, ha: PI + 0.62, lean: -0.2, cr: -4, tilt: -0.35 }],
        [1.06, { hx: 42, hy: -74, ha: 0.86, lean: 0.55, cr: 18, tilt: 0.25 }, 'snap'], [1.6, { hx: 40, hy: -76, ha: 0.84, lean: 0.5, cr: 16, tilt: 0.2 }], [2.15, MKI]],
    },
    // sweep: the hammer swings low and wide, chest height (white)
    sweep: {
      dur: 1.4, cd: 1.2, tells: [{ t: 0.08, c: 'white' }],
      hits: [{ t0: 0.56, t1: 0.68, box: { x: 0, y: -152, w: 144, h: 106 }, dmg: 18, kb: 300, last: true, pbal: 46 }],
      ev: [{ t: 0.55, fn: () => G.SFX.play('slash', 0.55, true) }],
      keys: [[0, MKI], [0.48, { hx: -6, hy: -98, ha: -1.3, lean: -0.12, cr: 6, tilt: -0.1 }], [0.62, { hx: 36, hy: -102, ha: 1.75, lean: 0.35, cr: 10, tilt: 0.15 }, 'snap'],
        [0.8, { hx: 30, hy: -112, ha: 2.4, lean: 0.3, cr: 8, tilt: 0.1 }], [1.4, MKI]],
    },
    draw(ctx, e, ghost) {
      const dt = G.game.dtVis, t = e.t, hk = hurtW(e);
      let p;
      if (e.state === 'atk' && e.atk && e.atk.keys) p = kf(e.atk.keys, e.st);
      else if (e.state === 'broken') p = { hx: 30, hy: -44, ha: 1.45, lean: 0.75, cr: 34, tilt: 0.6 + Math.sin(t * 2) * 0.05 };
      else { const br = Math.sin(t * 1.6); p = { ...MKI, hy: MKI.hy + br * 1.5, lean: MKI.lean + br * 0.015, tilt: Math.sin(t * 0.7) * 0.06 }; }
      if (hk) p = { ...p, lean: p.lean - 0.28 * hk, tilt: p.tilt - 0.5 * hk, hx: p.hx - 6 * hk };
      const walking = Math.abs(e.vx) > 12 && e.state !== 'atk';
      if (walking) {
        const prev = Math.floor(e.gaitP / PI); e.gaitP += Math.abs(e.vx) * dt * 0.09;
        if (!ghost && Math.floor(e.gaitP / PI) !== prev && Math.abs(e.x - e.P.x) < 800) G.SFX.play('heavyStep');
      }
      ctx.save();
      const sink = K.emerge(ctx, e) * 180;
      riseClip(ctx, e, sink);
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing, 1);
      dissolve(ctx, e, ghost, AMBER);
      const bob = walking ? -Math.abs(Math.sin(e.gaitP)) * 3 : 0;
      const Hp = P(0, -74 + p.cr + bob), lean = p.lean;
      const U2 = (x, y) => add(Hp, rot(P(x, y), lean));
      const shF = U2(15, -54), shB = U2(-15, -52), neck = U2(2, -60);
      const sway = Math.sin(t * 1.3) * 3 - e.vx * 0.03;
      // ground shadow + feet peeking under the hem
      ctx.fillStyle = 'rgba(10,12,28,0.3)'; ctx.beginPath(); ctx.ellipse(0, 1, 46, 6, 0, 0, TAU); ctx.fill();
      for (const k of [0, 1]) {
        const ph = e.gaitP + k * PI, fx = (k ? -8 : 10) + (walking ? Math.cos(ph) * 10 : 0), fy = walking ? -Math.max(0, Math.sin(ph)) * 4 : 0;
        poly(ctx, [P(fx - 8, fy), P(fx - 6, fy - 7), P(fx + 8, fy - 6), P(fx + 12, fy)]); ctx.fillStyle = k ? '#1d1418' : '#2e2228'; ctx.fill(); ink(ctx, 1);
      }
      // hammer pieces (needed for draw order: shaft behind the near arm)
      const ha = p.ha, H1 = P(p.hx, p.hy + bob), H2 = add(H1, dirv(ha, -20));
      const butt = add(H1, dirv(ha, -36)), head = add(H1, dirv(ha, 100));
      e.hhead = head;
      // back arm (sleeve) reaching the lower grip
      const arm = (sh, hand, near) => {
        const s1 = Rig.solve2(sh, hand, 30, 28, 1), s2 = Rig.solve2(sh, hand, 30, 28, -1);
        const s = s1.ky > s2.ky ? s1 : s2, el = add(sh, dirv(s.a, 30));
        const col = near ? '#6a2838' : '#3e1824';
        Rig.limb(ctx, sh, el, 8, 8.5, col);
        // flared bell sleeve
        const d = Math.atan2(hand.x - el.x, hand.y - el.y), n = P(Math.cos(d), -Math.sin(d)), cuff = mix(el, hand, 0.78);
        poly(ctx, [add(el, P(n.x * 8, n.y * 8)), add(cuff, P(n.x * 13, n.y * 13)), add(cuff, P(-n.x * 13 + Math.sin(d) * 4, -n.y * 13 + Math.cos(d) * 4)), add(el, P(-n.x * 8, -n.y * 8))]);
        ctx.fillStyle = cel(ctx, cuff.x, cuff.y, n.x, n.y, 13, col); ctx.fill(); ink(ctx, 1.3);
        ctx.strokeStyle = '#d7c7a6'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cuff.x + n.x * 12, cuff.y + n.y * 12); ctx.lineTo(cuff.x - n.x * 12 + Math.sin(d) * 4, cuff.y - n.y * 12 + Math.cos(d) * 4); ctx.stroke();
        // gaunt hand around the shaft
        ctx.beginPath(); ctx.ellipse(hand.x, hand.y, 5, 4.2, -ha, 0, TAU); ctx.fillStyle = near ? '#cfc6d6' : '#8f88a0'; ctx.fill(); ink(ctx, 1);
      };
      // hood/cowl rising behind the bell (the tall silhouette)
      const hoodTop = U2(-10, -98), hoodL = U2(-24, -54), hoodR = U2(16, -62);
      poly(ctx, [hoodL, U2(-26, -76), hoodTop, U2(2, -86), hoodR]); ctx.fillStyle = '#3a1522'; ctx.fill(); ink(ctx, 1.4);
      poly(ctx, [U2(-20, -60), U2(-19, -78), hoodTop, U2(-6, -80), U2(8, -62)]); ctx.fillStyle = '#12080d'; ctx.fill();
      arm(shB, H2, false);
      // shaft
      cable(ctx, [butt, add(head, dirv(ha, -8))], '#5a3a26', 4.2, 'rgba(255,214,160,0.5)');
      // robe: burgundy, cel shaded, frost caked at the hem
      const hem = [];
      for (let i = 0; i <= 8; i++) { const u = i / 8; hem.push(P(lerp(32 + sway, -36 + sway * 1.4, u) + (i % 2 ? 2 : -1), (i % 2 ? -4 : 0) + Math.sin(t * 2.4 + i) * 1.5)); }
      const outline = [U2(19, -2), shF, U2(9, -60), U2(-8, -61), shB, U2(-20, 0), P(-33 + sway * 1.2, -32), ...hem.slice().reverse(), P(27 + sway * 0.6, -30)];
      poly(ctx, outline); ctx.fillStyle = cel(ctx, Hp.x, Hp.y - 10, 1, 0, 30, '#6a2838'); ctx.fill(); ink(ctx, 1.6);
      // folds
      ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 1;
      for (const k of [-0.6, -0.15, 0.35]) { const a = U2(k * 18, -6), b = P(k * 40 + sway, -6); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2 + 4, (a.y + b.y) / 2, b.x, b.y); ctx.stroke(); }
      // frost crust along the hem
      ctx.fillStyle = '#eef8ff';
      ctx.beginPath(); ctx.moveTo(hem[0].x, hem[0].y);
      for (let i = 0; i <= 16; i++) { const u = i / 16, q = P(lerp(hem[0].x, hem[8].x, u), lerp(hem[0].y, hem[8].y, u) - 4 - ((i * 7) % 5)); ctx.lineTo(q.x, q.y); }
      ctx.lineTo(hem[8].x, hem[8].y); ctx.closePath(); ctx.fill(); ink(ctx, 0.8);
      // embroidered front panel
      const pa = U2(6, -40), pb = U2(14, -40);
      poly(ctx, [pa, pb, P(pb.x + 6 + sway * 0.4, -8), P(pa.x + 3 + sway * 0.4, -6)]); ctx.fillStyle = '#3a1522'; ctx.fill(); ink(ctx, 1);
      ctx.strokeStyle = '#d9a24e'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { const q = mix(mix(pa, pb, 0.5), P((pa.x + pb.x) / 2 + 4 + sway * 0.4, -8), 0.15 + i * 0.22); ctx.beginPath(); ctx.arc(q.x, q.y, 2.4, 0, TAU); ctx.stroke(); }
      // grey wool mantle over the shoulders, frost on its crown, ragged hem
      const mt = [U2(-24, -46), U2(-18, -62), U2(-4, -66), U2(12, -64), U2(22, -50)];
      const mh = []; for (let i = 0; i <= 6; i++) { const u = i / 6, q = mix(U2(22, -36), U2(-24, -34), u); mh.push(P(q.x, q.y + (i % 2 ? 7 : 0))); }
      poly(ctx, mt.concat(mh)); ctx.fillStyle = cel(ctx, neck.x, neck.y + 18, 1, 0, 26, '#8d93a8'); ctx.fill(); ink(ctx, 1.4);
      ctx.fillStyle = '#f2faff'; poly(ctx, [mt[0], mt[1], mt[2], mt[3], mt[4], U2(18, -52), U2(4, -58), U2(-10, -56), U2(-20, -48)]); ctx.fill(); ink(ctx, 0.8);
      ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.9;
      for (const k of [-14, -2, 10]) { const a2 = U2(k, -54), b2 = U2(k + 2, -38); ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke(); }
      // rope belt with tiny bells
      const bl = U2(-17, -4), br = U2(17, -4);
      ctx.beginPath(); ctx.moveTo(bl.x, bl.y); ctx.quadraticCurveTo(Hp.x, Hp.y + 4, br.x, br.y); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#c99a4c'; ctx.lineWidth = 3; ctx.stroke();
      const knot = U2(10, 0);
      for (let i = 0; i < 2; i++) {
        const sw = Math.sin(t * 2.2 + i) * 0.15 - e.vx * 0.002, b0 = add(knot, P(i * 6 - 2, 2)), b1 = add(b0, dirv(sw, 18 + i * 6));
        ctx.strokeStyle = '#c99a4c'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
        poly(ctx, [add(b1, P(-3, 5)), add(b1, P(-2, 0)), add(b1, P(2, 0)), add(b1, P(3, 5))]); ctx.fillStyle = '#d9a24e'; ctx.fill(); ink(ctx, 0.8);
      }
      // stole: frost-white prayer scarf falling from the neck (cloth physics)
      if (!ghost) e.stole.update(e.x + e.facing * (neck.x + 4), e.y + sink + neck.y + 4, e.facing, dt, -e.vx * 3 + Math.sin(t * 1.5) * 120, 0.2);
      if (e.stole.inited) {
        const sp = e.stole.p.map((q) => P((q.x - e.x) * e.facing, q.y - e.y - sink));
        Rig.ribbon(ctx, sp, 4, 5.5, '#d9ceb6'); ink(ctx, 1.1);
        Rig.ribbon(ctx, sp.map((q) => P(q.x + 1.4, q.y)), 1.6, 2.4, '#f6f0e2');
        const end = sp[sp.length - 1]; ctx.fillStyle = '#b8833f'; ctx.fillRect(end.x - 5, end.y - 2, 10, 3);
      }
      // prayer beads across the chest
      for (let i = 0; i < 9; i++) { const q = add(mix(shF, U2(-12, -14), i / 8), P(0, Math.sin(i / 8 * PI) * 5)); ctx.beginPath(); ctx.arc(q.x, q.y, 2.3, 0, TAU); ctx.fillStyle = i === 4 ? ICE : '#2a1a14'; ctx.fill(); ink(ctx, 0.7); }
      // ---- the bell head ----
      const a = 1.2 - lean * 0.45 + p.tilt;
      ctx.save(); ctx.translate(neck.x, neck.y); ctx.rotate(-a); ctx.scale(1.32, 1.32); ctx.translate(0, 8);
      const bellPath = () => {
        ctx.beginPath(); ctx.moveTo(-9, -24); ctx.quadraticCurveTo(0, -30, 9, -24);
        ctx.bezierCurveTo(14, -18, 13, 0, 17, 12); ctx.quadraticCurveTo(22, 20, 27, 24);
        ctx.lineTo(-27, 24); ctx.quadraticCurveTo(-22, 20, -17, 12); ctx.bezierCurveTo(-13, 0, -14, -18, -9, -24); ctx.closePath();
      };
      // crown loop
      ctx.beginPath(); ctx.arc(0, -29, 5, PI, 0); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3.4; ctx.strokeStyle = '#8a5f2c'; ctx.stroke();
      bellPath(); ctx.fillStyle = cel(ctx, 0, 0, 1, 0, 24, BRONZE); ctx.fill();
      ctx.save(); bellPath(); ctx.clip();
      // verdigris weathering, bands and inscription
      ctx.fillStyle = 'rgba(78,170,150,0.75)';
      for (const [x, y, r] of [[-14, 14, 7], [-6, 20, 6], [12, 18, 5], [-10, -10, 4]]) { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0.4, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(40,20,8,0.7)'; ctx.lineWidth = 1.2;
      for (const y of [-14, -10, 9]) { ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(20, y + 1); ctx.stroke(); }
      ctx.fillStyle = 'rgba(40,20,8,0.6)'; for (let i = -3; i <= 3; i++) ctx.fillRect(i * 4 - 1, -6, 2, 3 + (i % 2));
      ctx.restore();
      bellPath(); ink(ctx, 1.6);
      // the crack: hush light leaking out
      const crack = [P(4, -26), P(1, -16), P(6, -8), P(2, 2), P(8, 12), P(5, 24)];
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(ROSE, 0.55); ctx.lineWidth = 4; poly(ctx, crack, false); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = '#ffe1ef'; ctx.lineWidth = 1.1; poly(ctx, crack, false); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.7; poly(ctx, crack.map((q) => P(q.x - 1.2, q.y)), false); ctx.stroke();
      // mouth: dark interior with the glowing crystal clapper (its "eye")
      ctx.beginPath(); ctx.ellipse(0, 24, 27, 6.5, 0, 0, TAU); ctx.fillStyle = '#0f070c'; ctx.fill(); ink(ctx, 1.4);
      const glowK = e.state === 'broken' ? 0.3 + Math.sin(t * 10) * 0.2 : 0.75 + Math.sin(t * 3) * 0.2 + (e.state === 'atk' ? 0.3 : 0);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, 0, 23, 30, ICE, 0.55 * glowK); ctx.restore();
      const cl = Math.sin(t * 2.4) * 2 + hk * 5;
      poly(ctx, [P(cl - 4, 20), P(cl, 14), P(cl + 4, 20), P(cl, 27)]); ctx.fillStyle = '#dffbff'; ctx.fill(); ink(ctx, 0.8);
      ctx.fillStyle = ROSE; ctx.beginPath(); ctx.arc(cl, 21, 1.4, 0, TAU); ctx.fill();
      ctx.restore();
      // steam from the crack
      if (!ghost && dt > 0 && Math.random() < dt * 4) G.FX.ember(e.x + e.facing * neck.x, e.y + neck.y - 20, 1, '#dff4ff', { w: 10, h: 6, up: 40, sp: 20, life: 0.8 });
      // near arm + hammer head
      arm(shF, H1, true);
      ctx.save(); ctx.translate(head.x, head.y); ctx.rotate(-ha);
      // mallet: a squat bronze bell laid sideways, bound to the shaft with iron
      const mal = () => { ctx.beginPath(); ctx.moveTo(-15, -9); ctx.lineTo(13, -9); ctx.quadraticCurveTo(17, -3, 19, 12); ctx.lineTo(-19, 12); ctx.quadraticCurveTo(-17, -3, -15, -9); ctx.closePath(); };
      mal(); ctx.fillStyle = cel(ctx, 0, 0, 0, -1, 14, BRONZE); ctx.fill(); ink(ctx, 1.5);
      ctx.fillStyle = '#2a2a33'; ctx.fillRect(-16, -2, 32, 4); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(-16, -2, 32, 4);
      ctx.beginPath(); ctx.ellipse(0, 12, 19, 3.5, 0, 0, TAU); ctx.fillStyle = '#5c3a1c'; ctx.fill(); ink(ctx, 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(ICE, 0.8); ctx.fillRect(-2, -8, 4, 5); ctx.restore();
      ctx.restore();
      tellGlow(ctx, e, head.x, head.y, 34);
      ctx.restore();
      dbg(ctx, e);
    },
  };

  /* ============================ TETHERLING 縛索蛛 ============================ */
  // A spider knotted together from snapped elevator cable: a wound-steel body, frayed wire legs with clamp feet,
  // a rose Hush crystal grown through its back. It hangs from a strand, drops on you, then skitters and spits.
  const TL = TYPES.c2_tetherling = {
    name: '縛索蛛', en: 'TETHERLING', w: 58, h: 46, hp: 48, bal: 36, col: ROSE, shards: 20, fly: true, hover: true, kbMul: 1.2, spawnT: 0.8,
    portrait: [3.0, 0.78],
    init(e) {
      e.gait = 0; e.snapT = 9; e.strandHp = 3; e.landed = true;
      // placed on a floor ({x} only) it lowers itself on a strand to hang ~240 above it; placed in the air it hangs there
      if (DBG && /c2ground/.test(location.hash)) { e.mode = 'ground'; e.fly = false; return; }
      const g = e.enc ? groundAt(e.x, e.y - 4) : null;
      e.mode = 'hang'; e.landed = false;
      if (g != null && g - e.y < 40) { e.hangY = g - 240; e.y = e.hangY; } else e.hangY = e.y;
    },
    voice: (e) => G.SFX.play(e.atk === TL.drop ? 'c2_creak' : 'skitter'),
    weapon: (e) => (e.mode === 'hang' ? { x: e.x, y: e.y - 20 } : { x: e.x + e.facing * 30, y: e.y - 24 }),
    onHit(e) {
      G.SFX.play('c2_twang', 0.5);
      if (e.mode === 'hang' && !e.dead && --e.strandHp <= 0) snapStrand(e, 120);
    },
    think(e, dt) {
      if (e.mode === 'hang') {
        const dx = e.P.x - e.x;
        e.facing = dx < 0 ? -1 : 1;
        e.vx = U.approach(e.vx, Math.abs(dx) > 30 ? Math.sign(dx) * 70 * e.speedMul : 0, 220 * dt);
        e.vy = (e.hangY + Math.sin(e.t * 1.3) * 5 - e.y) * 3;
        if (e.cd <= 0 && Math.abs(dx) < 180 && e.P.y > e.y + 20 && e.P.y - e.y < 560) e.startAtk(TL.drop);
        return;
      }
      e.faceP(); const d = e.distP();
      e.skT = (e.skT ?? 0) - dt; if (e.skT <= 0) { e.skT = 0.4 + Math.random() * 0.6; e.skDir = Math.random() < 0.5 ? -1 : 1; }
      const tv = d > 300 ? 240 : d < 150 ? -210 : e.skDir * 130;
      e.vx = U.approach(e.vx, e.facing * tv * e.speedMul, 1800 * dt);
      if (e.cd > 0) return;
      if (d < 105) e.startAtk(TL.jab);
      else if (d < 560) e.startAtk(TL.spit);
    },
    // drop: the strand creaks, the shadow on the floor darkens, then it lets go (red — move out from under it)
    drop: {
      dur: 1.75, cd: 1.2, track: false, tells: [{ t: 0.15, c: 'red', face: false }],
      hits: [{ t0: 0.78, t1: 1.6, box: { x: -36, y: -52, w: 72, h: 60 }, dmg: 20, red: true, kb: 300, last: true }],
      ev: [{ t: 0.76, fn: (e) => snapStrand(e, 760) }],
    },
    // spit: a knot of sticky cable fibre (white — guard it, parry it back); a hit tangles your legs
    spit: { dur: 1.3, cd: 1.7, tells: [{ t: 0.3, c: 'white' }], ev: [{ t: 0.82, fn: (e) => spitGlob(e) }] },
    // jab: rears up and stabs with the two front legs (white)
    jab: {
      dur: 1.05, cd: 1.1, tells: [{ t: 0.06, c: 'white' }], moves: [{ t0: 0.5, t1: 0.58, v: 260 }],
      hits: [{ t0: 0.54, t1: 0.66, box: { x: 6, y: -54, w: 64, h: 50 }, dmg: 12, kb: 200, last: true }],
      ev: [{ t: 0.54, fn: () => G.SFX.play('c2_twang', 1) }],
    },
    atkUpdate(e, dt) {
      if (e.atk === TL.drop) {
        if (e.st < 0.62 && e.mode === 'hang') { const dx = e.P.x - e.x; e.vx = U.approach(e.vx, clamp(dx * 4, -160, 160), 900 * dt); e.vy = (e.hangY - e.y) * 3; }
        else if (e.mode === 'hang') { e.vx = 0; e.vy = 0; }
        else e.vx = 0;
        if (e.mode === 'ground' && e.onGround && !e.landed) {
          e.landed = true; e.landT = e.st;
          G.game.shake(0.45); G.SFX.play('c2_land'); G.FX.dust(e.x, e.y, 18, { w: 60, speed: 260, size: 12 }); G.FX.ring(e.x, e.y, 8, 110, 0.4, ROSE, 4, { flat: 0.2 });
        }
        if (e.landed && e.landT != null && e.st > e.landT + 0.1) e.hitsDone[0] = true;   // the blow is the impact, not the crouch after
      } else if (e.mode === 'hang') { e.vx = U.approach(e.vx, 0, 400 * dt); e.vy = (e.hangY - e.y) * 3; }
    },
    draw(ctx, e, ghost) {
      const dt = G.game.dtVis, t = e.t, hk = hurtW(e), st = e.st;
      const hang = e.mode === 'hang' || !e.mode;
      const falling = e.mode === 'ground' && !e.onGround && e.state !== 'spawn';
      const moving = Math.abs(e.vx) > 30 && !hang && e.onGround;
      if (moving) e.gait += dt * Math.abs(e.vx) * 0.09;
      e.snapT += dt;
      const drop = e.state === 'atk' && e.atk === TL.drop;
      // ---- floor shadow (the warning for the drop) ----
      const gy = hang ? groundAt(e.x, e.y + 4) : null;
      if (gy != null && gy - e.y < 900) {
        const warn = drop ? win(st, 0.1, 0.76) : 0, r = 22 + warn * 22;
        ctx.fillStyle = `rgba(16,8,22,${0.18 + warn * 0.4})`; ctx.beginPath(); ctx.ellipse(e.x, gy + 1, r * 1.5, 5 + warn * 3, 0, 0, TAU); ctx.fill();
        if (warn > 0) { ctx.strokeStyle = U.rgba(K.CRIM, warn * 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x, gy + 1, r * 1.7, 6 + warn * 3, 0, 0, TAU); ctx.stroke(); }
      }
      ctx.save();
      const desc = e.state === 'spawn' ? K.emerge(ctx, e) : 0;   // lowering itself down the strand
      ctx.globalAlpha *= 1 - desc * 0.6;
      ctx.translate(e.x, e.y - desc * 280); ctx.scale(e.facing, 1);
      dissolve(ctx, e, ghost, ROSE);
      // ---- the strand ----
      const shiver = drop && st < 0.76 ? Math.sin(t * 60) * 1.6 * win(st, 0.3, 0.7) : 0;
      if (hang) {
        const top = -760;
        ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(shiver, top); ctx.stroke();
        ctx.strokeStyle = '#8f9aac'; ctx.lineWidth = 2.2; ctx.stroke();
        ctx.strokeStyle = '#dfe6f0'; ctx.lineWidth = 0.8; ctx.setLineDash([3, 4]); ctx.lineDashOffset = -t * 6; ctx.stroke(); ctx.setLineDash([]);
      } else if (e.snapT < 0.6) {
        // the snapped end whipping back up
        const k = e.snapT / 0.6, y0 = -60 - k * 260;
        ctx.save(); ctx.globalAlpha *= 1 - k; ctx.strokeStyle = '#8f9aac'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(Math.sin(k * 20) * 10, y0); ctx.quadraticCurveTo(14, y0 - 60, 0, y0 - 300); ctx.stroke(); ctx.restore();
      }
      // ---- pose channels ----
      let bodyRot = hang ? 1.25 + Math.sin(t * 1.3) * 0.08 : 0, lift = 0, rear = 0, clamp2 = 0.2 + Math.sin(t * 5) * 0.1, splay = falling ? 1 : 0;
      if (e.state === 'atk' && e.atk === TL.jab) { rear = win(st, 0.1, 0.48) * (1 - win(st, 0.56, 0.9)); clamp2 = 0.9 * rear; }
      if (e.state === 'atk' && e.atk === TL.spit) { rear = 0.45 * win(st, 0.2, 0.75) * (1 - win(st, 0.85, 1.1)); clamp2 = 1 * win(st, 0.5, 0.8) * (1 - win(st, 0.86, 1.0)); }
      if (drop && hang) { bodyRot = 1.25 + shiver * 0.05; clamp2 = 0.8; }
      if (drop && !hang && e.landed && e.landT != null) lift = -8 * (1 - win(st, e.landT, e.landT + 0.25));
      const broken = e.state === 'broken';
      if (broken) { lift = -6; clamp2 = 0.6 + Math.sin(t * 9) * 0.3; }
      rear += 0.5 * hk;
      ctx.save();
      ctx.translate(shiver, lift);
      if (hang) { ctx.translate(0, -22); ctx.rotate(bodyRot); ctx.translate(0, 22); }
      const tilt = -rear * 0.42;
      const B = P(-4, -26 - rear * 6);
      // ---- legs ----
      const hipOf = (i) => add(B, rot(P(4 + i * 4.5, 2), tilt));
      const footOf = (i, near) => {
        const sp = [34, 17, -6, -28][i] + (near ? 3 : -3);
        if (hang) {
          const sa = (near ? [-1.3, -0.5, 0.4, 1.1] : [-1.85, -2.6, 2.7, 2.0])[i] + Math.sin(t * 2.2 + i) * 0.07 + (drop ? Math.sin(t * 40 + i) * 0.06 : 0), a = sa - bodyRot;
          return add(B, P(Math.cos(a) * (near ? 36 : 32) + 4, Math.sin(a) * (near ? 34 : 30)));
        }
        let fx = sp * (1 + splay * 0.25), fy = splay * 6;
        if (moving) { const ph = e.gait + i * 1.7 + (near ? 0 : PI); fx += Math.cos(ph) * 7; fy -= Math.max(0, Math.sin(ph)) * 7; }
        if (i === 0 && rear > 0.05) { fx = lerp(fx, 46, rear); fy = lerp(fy, -30, rear) ; }
        if (i === 1 && rear > 0.05) { fx = lerp(fx, 38, rear * 0.6); fy = lerp(fy, -12, rear * 0.6); }
        if (broken) { fx *= 0.55; fy = -14 - Math.abs(Math.sin(t * 7 + i)) * 6; }
        return P(fx, fy);
      };
      const legDraw = (near) => {
        for (let i = 3; i >= 0; i--) {
          const h = hipOf(i), f = footOf(i, near), mid = mix(h, f, 0.5);
          const dx = f.x - h.x, dy = f.y - h.y, ln = Math.hypot(dx, dy) || 1;
          let nx = dy / ln, ny = -dx / ln; if (ny > 0) { nx = -nx; ny = -ny; }
          const kn = add(mix(h, f, 0.32), P(nx * (16 + ln * 0.3), ny * (16 + ln * 0.3))), an = add(mix(h, f, 0.8), P(nx * 5, ny * 5));
          const lc = near ? '#8793a8' : '#3f4759';
          cable(ctx, [h, kn], lc, near ? 2.9 : 2.3, near ? 'rgba(255,255,255,0.6)' : null);
          cable(ctx, [kn, an, f], lc, near ? 1.9 : 1.5, near ? 'rgba(255,255,255,0.5)' : null);
          ctx.beginPath(); ctx.arc(kn.x, kn.y, near ? 2.6 : 2, 0, TAU); ctx.fillStyle = near ? '#c8692e' : '#5e3220'; ctx.fill(); ink(ctx, 0.8);
          // frayed wire at the knee + clamp foot
          ctx.strokeStyle = near ? '#e6ecf5' : '#7d879b'; ctx.lineWidth = 0.7; ctx.beginPath();
          for (let k = 0; k < 3; k++) { ctx.moveTo(kn.x, kn.y); ctx.lineTo(kn.x + (k - 1) * 4, kn.y - 5 - k); } ctx.stroke();
          ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.x - 2, f.y - 1); ctx.lineTo(f.x + 1, f.y + 1); ctx.lineTo(f.x + 3, f.y - 1); ctx.stroke();
        }
      };
      legDraw(false);
      // ---- abdomen: a ball of wound cable ----
      const ab = add(B, rot(P(-17, -4), tilt)), abA = -0.35 + tilt;
      const abPath = () => { ctx.beginPath(); ctx.ellipse(ab.x, ab.y, 23, 18, abA, 0, TAU); };
      abPath(); ctx.fillStyle = '#2e3544'; ctx.fill();
      ctx.save(); abPath(); ctx.clip();
      for (let k = 0; k < 7; k++) {
        const off = -22 + k * 7.4, a0 = add(ab, rot(P(off - 8, -18), abA)), a1 = add(ab, rot(P(off + 9, 18), abA)), c1 = add(ab, rot(P(off + 10, -2), abA));
        ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.quadraticCurveTo(c1.x, c1.y, a1.x, a1.y);
        ctx.strokeStyle = INK; ctx.lineWidth = 6.4; ctx.stroke(); ctx.strokeStyle = k % 2 ? '#5f6a7e' : '#7a869a'; ctx.lineWidth = 4.4; ctx.stroke();
        ctx.strokeStyle = 'rgba(240,246,255,0.75)'; ctx.lineWidth = 0.8; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.fillStyle = 'rgba(30,10,40,0.35)'; ctx.beginPath(); ctx.ellipse(ab.x - 4, ab.y + 7, 20, 9, abA, 0, TAU); ctx.fill();
      ctx.restore();
      abPath(); ink(ctx, 1.6);
      // Hush crystal through the back
      const cr = add(ab, rot(P(2, -13), abA));
      glowAdd(ctx, cr.x, cr.y - 8, 24, ROSE, 0.5 + Math.sin(t * 4) * 0.12);
      shard(ctx, cr, PI + 0.35 + tilt, 20, 5.5, '#ffd0e4', '#b03a74', ICE_W);
      shard(ctx, add(cr, P(-7, 3)), PI + 0.95 + tilt, 12, 4, '#ffc2dc', '#93305f', null);
      // ---- head knot: clamp jaws and a cluster of crystal eyes ----
      const hd = add(B, rot(P(14, -1), tilt));
      ctx.beginPath(); ctx.ellipse(hd.x, hd.y, 13.5, 11, tilt, 0, TAU); ctx.fillStyle = cel(ctx, hd.x, hd.y, 0, -1, 11, '#5a6479'); ctx.fill(); ink(ctx, 1.4);
      ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(hd.x - 2, hd.y, 7, -1.2, 1.4); ctx.stroke();
      ctx.strokeStyle = '#a3aec0'; ctx.lineWidth = 1.8; ctx.stroke();
      for (const s of [-1, 1]) {
        const j0 = add(hd, rot(P(9, 4 + s * 2), tilt)), ja = tilt + s * (0.25 + clamp2 * 0.55);
        const tip = add(j0, rot(P(12, s * 2), ja));
        ctx.beginPath(); ctx.moveTo(j0.x, j0.y); ctx.quadraticCurveTo(tip.x + 2, tip.y - s * 6, tip.x, tip.y);
        ctx.strokeStyle = INK; ctx.lineWidth = 4.6; ctx.stroke(); ctx.strokeStyle = '#d0763a'; ctx.lineWidth = 2.6; ctx.stroke();
      }
      const eyeK = broken ? 0.3 + Math.abs(Math.sin(t * 8)) * 0.4 : 1;
      const ec = add(hd, rot(P(6, -5), tilt));
      glowAdd(ctx, ec.x, ec.y, 16, ICE, 0.55 * eyeK);
      for (const [x, y, r] of [[0, 0, 2.6], [4.2, 1.6, 1.7], [-3.4, 1.8, 1.5], [1.4, -3.2, 1.3]]) {
        ctx.beginPath(); ctx.arc(ec.x + x, ec.y + y, r, 0, TAU); ctx.fillStyle = U.rgba('#dffbff', eyeK); ctx.fill(); ink(ctx, 0.6);
      }
      ctx.fillStyle = ROSE; ctx.beginPath(); ctx.arc(ec.x + 0.6, ec.y, 1, 0, TAU); ctx.fill();
      legDraw(true);
      tellGlow(ctx, e, hd.x + 12, hd.y, 22);
      ctx.restore();
      ctx.restore();
      dbg(ctx, e);
    },
  };
  function snapStrand(e, vy) {
    if (e.mode !== 'hang') return;
    e.mode = 'ground'; e.fly = false; e.vy = vy; e.snapT = 0; e.landed = false; e.landT = null;
    G.SFX.play('c2_twang', 1.4); G.FX.spark(e.x, e.y - 44, 8, { col: '#dfe6f0', speed: 300 });
  }
  function spitGlob(e) {
    const Pl = G.game.player, x = e.x + e.facing * 30, y = e.y - 26, a = Math.atan2(Pl.y - 62 - y, Pl.x - x), sp = 430;
    G.SFX.play('c2_spit');
    G.game.hazards.push({
      t: 0, life: 3, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, owner: e, friendly: false, r: 10,
      update(h, dt, g) {
        h.x += h.vx * dt; h.y += h.vy * dt;
        const pop = () => { h.done = true; G.FX.spark(h.x, h.y, 8, { col: '#e4e9f2', speed: 300 }); G.FX.shards(h.x, h.y, 3, ROSE, 200); };
        for (const s of G.Phys.allSolids()) if (h.x > s.x && h.x < s.x + s.w && h.y > s.y && h.y < s.y + s.h) { pop(); return; }
        const Pl2 = g.player;
        if (!h.friendly) {
          const hb = Pl2.hurtbox;
          if (!h.passed && h.x + h.r > hb.x && h.x - h.r < hb.x + hb.w && h.y + h.r > hb.y && h.y - h.r < hb.y + hb.h) {
            const res = Pl2.receiveHit(h, { dmg: 11, kb: 150, projectile: true, hx: h.x, hy: h.y });
            if (res === 'parried') { h.friendly = true; h.vx = -h.vx * 1.6; h.vy = -h.vy * 0.4 - 60; h.life = h.t + 2.5; G.FX.ring(h.x, h.y, 6, 60, 0.3, '#7ff4ff', 4); }
            else if (res === 'dodged') h.passed = true;
            else { if (res === 'hit') ensnare(2.4); pop(); }
          }
        } else {
          if (h.owner && !h.owner.dead) { const aa = Math.atan2(h.owner.cy - h.y, h.owner.cx - h.x), s2 = Math.hypot(h.vx, h.vy); h.vx = lerp(h.vx, Math.cos(aa) * s2, 0.12); h.vy = lerp(h.vy, Math.sin(aa) * s2, 0.12); }
          for (const o of g.enemies) {
            if (o.dead || o.state === 'spawn') continue; const b = o.box;
            if (h.x > b.x - h.r && h.x < b.x + b.w + h.r && h.y > b.y - h.r && h.y < b.y + b.h + h.r) {
              o.takeHit({ dmg: 26 * Pl2.dmgMul, bal: 40, hx: h.x, hy: h.y, big: true }); g.hitstop(0.08); g.shake(0.4); G.SFX.play('hit', 1.2); pop(); return;
            }
          }
        }
      },
      draw(ctx, h) {
        const col = h.friendly ? '#7ff4ff' : ROSE, a = Math.atan2(h.vy, h.vx);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, h.x, h.y, 26, col, 0.5); ctx.restore();
        // trailing fibres
        ctx.strokeStyle = 'rgba(220,228,240,0.7)'; ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) { const w = Math.sin(h.t * 30 + i * 2) * 4; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.quadraticCurveTo(h.x - Math.cos(a) * 12, h.y - Math.sin(a) * 12 + w, h.x - Math.cos(a) * (22 + i * 4), h.y - Math.sin(a) * (22 + i * 4) + (i - 1.5) * 4); ctx.stroke(); }
        // the tangle
        ctx.beginPath(); ctx.arc(h.x, h.y, 8, 0, TAU); ctx.fillStyle = '#566074'; ctx.fill(); ink(ctx, 1.4);
        ctx.strokeStyle = '#c9d2e0'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(h.x, h.y, 7, 3.2, h.t * 6 + i * 1.05, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(h.x, h.y, 2.6, 0, TAU); ctx.fill();
      },
    });
  }
  // tangled legs: running is halved for a moment (dodging is free — that's the way out)
  function ensnare(dur) {
    const g = G.game, Pl = g.player;
    const ex = g.hazards.find((q) => q.c2snare);
    if (ex) { ex.left = Math.max(ex.left, dur); return; }
    G.FX.text(Pl.x, Pl.y - 140, '纏住了', '#ffb3d1', 18, 0.9);
    g.hazards.push({
      c2snare: true, t: 0, left: dur, max: dur, lx: Pl.x,
      update(h, dt, gm) {
        const Q = gm.player; h.left -= dt;
        if (h.left <= 0 || Q.state === 'dead') { h.done = true; return; }
        if (Q.state === 'move' || Q.state === 'guard') Q.x = h.lx + (Q.x - h.lx) * 0.5;
        h.lx = Q.x;
      },
      draw(ctx, h, gm) {
        const Q = gm.player, k = Math.min(1, h.left / 0.4);
        ctx.globalAlpha = k;
        for (let i = 0; i < 4; i++) {
          const y = Q.y - 8 - i * 9, w = 15 - i * 1.5;
          ctx.beginPath(); ctx.ellipse(Q.x, y, w, 3.4, Math.sin(h.t * 3 + i) * 0.2, 0, TAU);
          ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke(); ctx.strokeStyle = '#b8c2d2'; ctx.lineWidth = 1.6; ctx.stroke();
        }
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, Q.x, Q.y - 20, 22, ROSE, 0.35 * k); ctx.restore();
        ctx.globalAlpha = 1;
      },
    });
  }

  /* ============================ LINESMAN 巡線兵 ============================ */
  // A former Ark tether technician: signal-orange parka caked in frost, fur-ruffed hood, brass goggles (one lens
  // grown through with Hush crystal), a cable spool on his back and a long insulated hook-pole.
  const LP = {
    idle: (t) => ({ ry: 5 + Math.sin(t * 2) * 1.2, torso: 0.24 + Math.sin(t * 2) * 0.015, head: -0.12, tF: 0.5, kF: -0.65, tB: -0.38, kB: -0.3, aF: 0.8, eF: 0.95, aB: 0.55, eB: 1.25, sw: 1.5 }),
    hookA: { ry: 7, torso: -0.08, head: 0.05, tF: 0.25, kF: -0.4, tB: -0.6, kB: -0.25, aF: 0.15, eF: 1.75, aB: -0.3, eB: 1.6, sw: 1.66 },
    hookB: { ry: 13, torso: 0.52, head: -0.25, tF: 1.0, kF: -0.95, tB: -0.75, kB: -0.12, aF: 1.45, eF: 0.06, aB: 1.0, eB: 0.6, sw: 1.6 },
    sweepA: { ry: 9, torso: 0.05, head: 0.0, tF: 0.4, kF: -0.6, tB: -0.5, kB: -0.3, aF: -0.45, eF: 1.0, aB: -0.6, eB: 0.8, sw: -1.25 },
    sweepB: { ry: 16, torso: 0.48, head: -0.2, tF: 0.95, kF: -1.05, tB: -0.7, kB: -0.15, aF: 1.2, eF: 0.2, aB: 0.6, eB: 0.6, sw: 1.36 },
    sweepC: { ry: 4, torso: -0.12, head: 0.1, tF: 0.45, kF: -0.5, tB: -0.45, kB: -0.3, aF: 2.5, eF: 0.5, aB: 1.6, eB: 0.6, sw: 3.7 },
    sweepD: { ry: 11, torso: 0.4, head: -0.15, tF: 0.85, kF: -0.9, tB: -0.65, kB: -0.15, aF: 1.72, eF: 0.1, aB: 1.2, eB: 0.5, sw: 1.84 },
    plant: { ry: 30, torso: 0.75, head: -0.4, tF: 1.35, kF: -1.6, tB: -0.2, kB: -1.5, aF: 1.4, eF: 0.9, aB: 0.6, eB: 0.2, sw: 3.0 },
    hurt: { ry: 9, torso: -0.35, head: 0.6, tF: 0.2, kF: -0.6, tB: -0.6, kB: -0.4, aF: 0.4, eF: 1.4, aB: -0.8, eB: 1.0, sw: 2.4 },
    broken: (t) => ({ ry: 30, torso: 0.95 + Math.sin(t * 2.6) * 0.05, head: 0.55, tF: 1.3, kF: -1.4, tB: 0.0, kB: -1.57, aF: 0.3, eF: 0.4, aB: 0.2, eB: 0.4, sw: 1.0 }),
  };
  const LS = 1.15;
  const LM = TYPES.c2_linesman = {
    name: '巡線兵', en: 'LINESMAN', w: 44, h: 150, hp: 95, bal: 72, col: AMBER, shards: 30, poise: false, kbMul: 0.9, spawnT: 0.9, scale: LS,
    portrait: [2.0, 0.92],
    init(e) { e.ant = new Rig.Chain(5, 7, 0.2, 0.8); e.gaitP = 0; },
    voice: (e) => G.SFX.play('c2_radio', e.atk === LM.hook ? 1 : 0.6),
    onHit: () => G.SFX.play('c2_thud'),
    weapon: (e) => e.tipW || { x: e.x + e.facing * 150, y: e.y - 100 },
    think(e, dt) {
      e.faceP(); const d = e.distP();
      const want = 150;
      const tv = d > want + 30 ? 150 : d < want - 50 ? -110 : 0;
      e.vx = U.approach(e.vx, e.facing * tv * e.speedMul, 1100 * dt);
      if (e.cd > 0) return;
      const beaconUp = e.beacon && G.game.hazards.includes(e.beacon);
      if (e.pulled) { e.pulled = false; e.startAtk(LM.sweep); return; }
      if (!beaconUp && d > 200 && d < 460 && Math.random() < 0.5) { e.startAtk(LM.plant); return; }
      if (d < 165) e.startAtk(LM.sweep);
      else if (d < 225) e.startAtk(LM.hook);
    },
    // hook-pull: drives the hooked pole out at full reach and drags you in (red)
    hook: {
      dur: 1.45, cd: 0.9, tells: [{ t: 0.04, c: 'red' }],   // red: ≥ 0.6 s before the hook lands (0.66)
      poses: { dur: 1.45, keys: [[0, LP.idle(0)], [0.5, LP.hookA], [0.62, LP.hookA], [0.7, LP.hookB, 'snap'], [0.95, LP.hookB], [1.45, LP.idle(0), 'io']] },
      moves: [{ t0: 0.62, t1: 0.72, v: 260 }],
      hits: [{ t0: 0.66, t1: 0.8, box: { x: 40, y: -122, w: 150, h: 60 }, dmg: 14, red: true, kb: -560, last: true }],
      ev: [{ t: 0.66, fn: () => G.SFX.play('whoosh', 1.1) }],
    },
    // pole sweep: low then high (white, white)
    sweep: {
      dur: 1.75, cd: 1.3, tells: [{ t: 0.0, c: 'white' }, { t: 0.6, c: 'white' }],
      poses: { dur: 1.75, keys: [[0, LP.idle(0)], [0.44, LP.sweepA], [0.54, LP.sweepB, 'snap'], [0.66, LP.sweepB], [0.98, LP.sweepC], [1.1, LP.sweepD, 'snap'], [1.75, LP.idle(0), 'io']] },
      moves: [{ t0: 0.44, t1: 0.54, v: 220 }, { t0: 1.0, t1: 1.1, v: 200 }],
      hits: [{ t0: 0.48, t1: 0.6, box: { x: 0, y: -78, w: 172, h: 78 }, dmg: 13, kb: 200 }, { t0: 1.05, t1: 1.17, box: { x: 0, y: -158, w: 172, h: 84 }, dmg: 15, kb: 260, last: true }],
      ev: [{ t: 0.48, fn: () => G.SFX.play('slash', 0.7) }, { t: 1.05, fn: () => G.SFX.play('slash', 0.8) }],
    },
    // plant: kneels and drives a sparking relay beacon into the snow — it zaps anyone standing close (red ring)
    plant: {
      dur: 1.35, cd: 0.6, track: false,
      poses: { dur: 1.35, keys: [[0, LP.idle(0)], [0.4, LP.plant], [0.9, LP.plant], [1.35, LP.idle(0), 'io']] },
      ev: [{ t: 0.72, fn: (e) => plantBeacon(e) }],
    },
    atkUpdate(e) {
      if (e.atk === LM.hook && e.hitsDone[0] && !e.pulledSet) { e.pulledSet = true; e.pulled = true; e.cd = 0; }
      if (e.atk !== LM.hook || e.st < 0.1) e.pulledSet = false;
    },
    draw(ctx, e, ghost) {
      const dt = G.game.dtVis, t = e.t;
      // ---- pose ----
      let target;
      if (e.state === 'atk' && e.atk && e.atk.poses) target = Rig.sample(e.atk.poses, e.st);
      else if (e.state === 'hurt' || e.state === 'recoil') target = LP.hurt;
      else if (e.state === 'broken') target = LP.broken(t);
      else if (Math.abs(e.vx) > 30 && e.onGround) {
        const prev = Math.floor(e.gaitP / PI); e.gaitP += Math.abs(e.vx) * dt * PI / 30;
        if (!ghost && Math.floor(e.gaitP / PI) !== prev && Math.abs(e.x - e.P.x) < 800) G.SFX.play('stepOn', 'snow', 0.8);
        const w = Rig.ANIM.walk(e.gaitP);
        target = { ...LP.idle(t), ik: 1, fFx: w.fFx * 1.2 + 6, fFy: w.fFy * 1.3, fBx: w.fBx * 1.2 - 6, fBy: w.fBy * 1.3, ry: w.ry + 4 };
      } else target = LP.idle(t);
      if (e.onGround && e.state !== 'broken' && !target.ik) target = Rig.groundify(target);
      if (e.hitK > 0) target = Rig.lerpPose(Rig.full(target), Rig.full({ ...Rig.full(target), torso: -0.4, head: 0.7, ry: 8 }), Math.min(1, e.hitK * 1.2));
      K.blendPose(e, target, dt, e.hitK > 0 ? 45 : e.state === 'atk' ? 30 : 14);
      const J = Rig.compute(e.pose); e.J = J;
      const sd = dirv(J.sw, 1), grip2 = add(J.hdF, P(-sd.x * 24, -sd.y * 24));
      const sB = [Rig.solve2(J.shB, grip2, Rig.DIM.UARM, Rig.DIM.FARM, 1), Rig.solve2(J.shB, grip2, Rig.DIM.UARM, Rig.DIM.FARM, -1)];
      const hold = e.state === 'atk' && e.atk === LM.plant ? 0 : 1;
      if (hold) { const s = sB[0].ky > sB[1].ky ? sB[0] : sB[1]; J.elB = add(J.shB, dirv(s.a, Rig.DIM.UARM)); J.hdB = grip2; }
      const tip = add(J.hdF, P(sd.x * 100, sd.y * 100)), butt = add(J.hdF, P(-sd.x * 52, -sd.y * 52));
      e.tipW = { x: e.x + e.facing * tip.x * LS, y: e.y + tip.y * LS };
      ctx.save();
      const sink = K.emerge(ctx, e) * 170;
      riseClip(ctx, e, sink);
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing * LS, LS);
      dissolve(ctx, e, ghost, AMBER);
      ctx.fillStyle = 'rgba(10,12,28,0.3)'; ctx.beginPath(); ctx.ellipse(0, 1, 30, 4.5, 0, 0, TAU); ctx.fill();
      const LC = Rig.limbChain, L = Rig.limb;
      const { x: ux, y: uy } = (() => { const a = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x); return { x: Math.cos(a), y: Math.sin(a) }; })();
      const nx = -uy, ny = ux;
      const Q = (a, f) => P(J.hip.x + ux * a * 36 + nx * f, J.hip.y + uy * a * 36 + ny * f);
      // ---- backpack: cable spool, battery, whip antenna with a blinking tip ----
      const bp = Q(0.62, -13);
      ctx.save(); ctx.translate(bp.x, bp.y); ctx.rotate(Math.atan2(uy, ux) + PI / 2);
      poly(ctx, pts([-8, -16, 7, -16, 8, 15, -9, 15])); ctx.fillStyle = cel(ctx, 0, 0, 1, 0, 9, '#4a5040'); ctx.fill(); ink(ctx, 1.2);
      ctx.beginPath(); ctx.arc(-6, 2, 10, 0, TAU); ctx.fillStyle = '#2b2f3a'; ctx.fill(); ink(ctx, 1.3);
      ctx.strokeStyle = '#c8692e'; ctx.lineWidth = 2; for (const r of [7.5, 5]) { ctx.beginPath(); ctx.arc(-6, 2, r, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = '#9aa3b5'; ctx.beginPath(); ctx.arc(-6, 2, 2.4, 0, TAU); ctx.fill(); ink(ctx, 0.8);
      ctx.restore();
      const antBase = Q(1.05, -16);
      if (!ghost) e.ant.update(e.x + e.facing * antBase.x * LS, e.y + sink + antBase.y * LS, e.facing, dt, -e.vx * 6 + Math.sin(t * 3) * 300, 3.0);
      if (e.ant.inited) {
        const ap = e.ant.p.map((q) => P((q.x - e.x) * e.facing / LS, (q.y - e.y - sink) / LS));
        ctx.strokeStyle = INK; ctx.lineWidth = 1.6; poly(ctx, ap, false); ctx.stroke();
        const tp = ap[ap.length - 1], blink = (t * 1.3) % 1 < 0.18;
        ctx.fillStyle = blink ? '#ffd27a' : '#7a4a20'; ctx.beginPath(); ctx.arc(tp.x, tp.y, 1.8, 0, TAU); ctx.fill();
        if (blink) glowAdd(ctx, tp.x, tp.y, 9, AMBER, 0.8);
      }
      // ---- back arm + back leg ----
      LC(ctx, [J.shB, J.elB, J.hdB], [4.8, 4.2, 3.4], '#9a4524');
      ctx.beginPath(); ctx.arc(J.hdB.x, J.hdB.y, 3.2, 0, TAU); ctx.fillStyle = '#26262c'; ctx.fill(); ink(ctx, 0.9);
      LC(ctx, [J.hip, mix(J.hip, J.kneeB, 0.5), J.kneeB, mix(J.kneeB, J.ankB, 0.5), J.ankB], [7, 6.2, 5, 4.6, 3.6], '#232c43');
      L(ctx, J.ankB, add(J.toeB, P(2, 0)), 4.2, 3.2, '#2b211c');
      // ---- the pole (behind the front arm) ----
      cable(ctx, [butt, tip], '#e4d27a', 2.6, 'rgba(255,255,255,0.8)');
      ctx.strokeStyle = INK; ctx.lineWidth = 2.8;
      for (const u of [0.18, 0.3, 0.42]) { const q = mix(butt, tip, u), q2 = add(q, P(sd.x * 3, sd.y * 3)); ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q2.x, q2.y); ctx.stroke(); }
      // ceramic insulator discs + the brass hook
      for (const u of [0.8, 0.86]) { const q = mix(butt, tip, u); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(-J.sw); ctx.beginPath(); ctx.ellipse(0, 0, 6, 1.8, 0, 0, TAU); ctx.fillStyle = '#e8eef5'; ctx.fill(); ink(ctx, 0.8); ctx.restore(); }
      ctx.save(); ctx.translate(tip.x, tip.y); ctx.rotate(-J.sw);
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 7); ctx.arc(-5, 7, 5, 0, PI * 0.9); ctx.lineTo(-11, 2);
      ctx.strokeStyle = INK; ctx.lineWidth = 4.4; ctx.stroke(); ctx.strokeStyle = '#d9a24e'; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.restore();
      // ---- torso: puffy parka, hi-vis tape, frost ----
      const tp2 = [Q(-0.12, -11), Q(0.4, -12.5), Q(0.9, -13.5), Q(1.12, -6), Q(1.12, 8), Q(0.9, 12.5), Q(0.4, 12), Q(-0.15, 11)];
      smooth(ctx, tp2); ctx.fillStyle = cel(ctx, Q(0.5, 0).x, Q(0.5, 0).y, nx, ny, 14, '#c8602c'); ctx.fill(); ink(ctx, 1.5);
      ctx.save(); smooth(ctx, tp2); ctx.clip();
      ctx.strokeStyle = '#dfe5ee'; ctx.lineWidth = 2.6; for (const a of [0.35, 0.62]) { const p1 = Q(a, -16), p2 = Q(a + 0.02, 16); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(11,6,18,0.45)'; ctx.lineWidth = 0.9; for (const a of [0.15, 0.5, 0.8]) { const p1 = Q(a, -14), p2 = Q(a + 0.04, 0); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.quadraticCurveTo(Q(a - 0.04, -7).x, Q(a - 0.04, -7).y, p2.x, p2.y); ctx.stroke(); }
      ctx.fillStyle = '#f2f8ff'; poly(ctx, [Q(0.78, -15), Q(1.15, -10), Q(1.15, 2), Q(1.0, -3), Q(0.92, 1), Q(0.85, -6)]); ctx.fill();
      ctx.restore();
      // tool belt
      const b1 = Q(0.06, -12), b2 = Q(0.1, 12);
      ctx.strokeStyle = INK; ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.stroke(); ctx.strokeStyle = '#5a3a26'; ctx.lineWidth = 2.6; ctx.stroke();
      const pouch = Q(0.0, 8); poly(ctx, [add(pouch, P(-3, 0)), add(pouch, P(4, 0)), add(pouch, P(4, 8)), add(pouch, P(-3, 8))]); ctx.fillStyle = '#4a5040'; ctx.fill(); ink(ctx, 0.9);
      // ---- front leg: insulated trousers, knee pad, crampon boot ----
      LC(ctx, [J.hip, mix(J.hip, J.kneeF, 0.5), J.kneeF, mix(J.kneeF, J.ankF, 0.5), J.ankF], [7.6, 6.8, 5.4, 5, 4], '#33405e', { spec: 0.2 });
      ctx.beginPath(); ctx.ellipse(J.kneeF.x + 1, J.kneeF.y, 5, 6, 0, 0, TAU); ctx.fillStyle = '#1b2030'; ctx.fill(); ink(ctx, 1);
      L(ctx, mix(J.kneeF, J.ankF, 0.6), J.ankF, 5.4, 4.8, '#3b2a22');
      L(ctx, J.ankF, add(J.toeF, P(3, 0)), 4.6, 3.6, '#3b2a22', { spec: 0.3 });
      ctx.strokeStyle = '#c9d2e0'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 3; k++) { const q = mix(J.ankF, J.toeF, 0.2 + k * 0.4); ctx.moveTo(q.x, q.y + 3); ctx.lineTo(q.x + 1, q.y + 6); } ctx.stroke();
      // ---- head: fur-ruffed hood, frosted balaclava, brass goggles ----
      ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
      poly(ctx, pts([-14, 2, -13, -9, -5, -15, 4, -14.5, 11, -9, 12, 4, 6, 12, -6, 12]));
      ctx.fillStyle = cel(ctx, 0, 0, 1, 0, 14, '#b9582a'); ctx.fill(); ink(ctx, 1.4);
      ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-10, -8); ctx.quadraticCurveTo(-4, -2, -6, 10); ctx.stroke();
      ctx.fillStyle = '#f2f8ff'; poly(ctx, pts([-13, -9, -5, -15, 4, -14.5, 0, -12, -6, -11.5, -10, -7])); ctx.fill();
      // fur ruff: jagged ring around the face opening
      ctx.beginPath();
      for (let i = 0; i <= 22; i++) { const a = -1.95 + i / 22 * 3.9, r = (i % 2 ? 12.5 : 10); const x = 4.5 + Math.cos(a) * r * 0.72, y = 0.5 + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fillStyle = '#ddd5c4'; ctx.fill(); ink(ctx, 1.1);
      ctx.beginPath(); ctx.ellipse(5.5, 0.5, 5.6, 8, 0, 0, TAU); ctx.fillStyle = '#1e2436'; ctx.fill();
      // balaclava with a frost crust over the mouth
      ctx.fillStyle = '#2f3a58'; ctx.beginPath(); ctx.ellipse(6, 3.5, 4.6, 4.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#eef6ff'; poly(ctx, pts([3, 5, 10, 4, 9.5, 6.5, 6, 8, 3.5, 7])); ctx.fill();
      // goggles: brass rims, glowing lenses, one sprouting crystal
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(4, -3.5); ctx.stroke();
      for (const [gx, cr] of [[5.5, false], [9.6, true]]) {
        ctx.beginPath(); ctx.arc(gx, -3.3, 2.7, 0, TAU); ctx.fillStyle = '#c9963e'; ctx.fill(); ink(ctx, 0.9);
        ctx.beginPath(); ctx.arc(gx, -3.3, 1.7, 0, TAU); ctx.fillStyle = e.state === 'broken' && Math.sin(t * 9) > 0 ? '#3a6070' : '#c9fbff'; ctx.fill();
        if (cr) shard(ctx, P(gx + 0.6, -5), PI + 0.5, 8, 2, '#ffd0e4', '#b03a74', null);
      }
      glowAdd(ctx, 7.5, -3.3, 12, ICE, 0.6);
      ctx.restore();
      // ---- front arm: puffy sleeve, tape cuff, glove ----
      LC(ctx, [J.sh, J.elF, J.hdF], [5.6, 4.8, 3.8], '#c8602c');
      const cuff = mix(J.elF, J.hdF, 0.7); ctx.strokeStyle = '#dfe5ee'; ctx.lineWidth = 2.2;
      ctx.beginPath(); const fd = Math.atan2(J.hdF.y - J.elF.y, J.hdF.x - J.elF.x); ctx.moveTo(cuff.x - Math.sin(fd) * 4.2, cuff.y + Math.cos(fd) * 4.2); ctx.lineTo(cuff.x + Math.sin(fd) * 4.2, cuff.y - Math.cos(fd) * 4.2); ctx.stroke();
      ctx.fillStyle = '#f2f8ff'; ctx.beginPath(); ctx.ellipse(J.sh.x - 1, J.sh.y - 3, 6, 2.6, -0.3, 0, TAU); ctx.fill(); ink(ctx, 0.8);
      ctx.beginPath(); ctx.arc(J.hdF.x, J.hdF.y, 3.6, 0, TAU); ctx.fillStyle = '#26262c'; ctx.fill(); ink(ctx, 1);
      tellGlow(ctx, e, tip.x, tip.y, 24);
      ctx.restore();
      dbg(ctx, e);
    },
  };
  // relay beacon: a little tripod that charges (red ring on the snow) and discharges every couple of seconds
  function plantBeacon(e) {
    const x = e.x + e.facing * 56, y = groundAt(x, e.y - 40) ?? e.y, R = 92;
    G.SFX.play('c2_thud'); G.FX.dust(x, y, 8, { w: 20, speed: 140, size: 8 }); G.FX.spark(x, y - 30, 8, { col: '#ffd27a', speed: 260 });
    const h = {
      c2beacon: true, t: 0, life: 9, x, y, owner: e, R, cyc: 2.3, warn: 0.95,
      update(h2, dt, g) {
        if (h2.owner.dead && h2.life > h2.t + 0.6) h2.life = h2.t + 0.6;
        if (h2.t < 0.5 || h2.t > h2.life - 0.4) return;
        const c = (h2.t - 0.5) % h2.cyc, idx = Math.floor((h2.t - 0.5) / h2.cyc);
        if (c < h2.warn) {
          if (h2.wi !== idx) { h2.wi = idx; G.FX.star(h2.x, h2.y - 46, K.CRIM, 56, 0.45); G.SFX.play('tellRed'); G.SFX.play('c2_charge'); }
        } else if (h2.zi !== idx) {
          h2.zi = idx; G.SFX.play('c2_zap'); G.FX.ring(h2.x, h2.y - 4, 10, h2.R, 0.3, '#bff8ff', 4, { flat: 0.25 }); G.FX.flash(h2.x, h2.y - 40, 120, 0.2, '#bff8ff');
          G.FX.spark(h2.x, h2.y - 40, 16, { col: '#e6fbff', speed: 600 });
          const Q = g.player;
          if (Math.abs(Q.x - h2.x) < h2.R && Q.y > h2.y - 160 && Q.y < h2.y + 12) Q.receiveHit(h2, { dmg: 13, unblockable: true, kb: 260, hx: Q.x, hy: Q.y - 60 });
        }
      },
      draw(ctx, h2) {
        const fade = Math.min(1, h2.t / 0.2, (h2.life - h2.t) / 0.4), x0 = h2.x, y0 = h2.y;
        ctx.globalAlpha = Math.max(0, fade);
        const on = h2.t > 0.5 && h2.t < h2.life - 0.4, c = on ? (h2.t - 0.5) % h2.cyc : 9, warnK = on && c < h2.warn ? c / h2.warn : 0, zapK = on && c >= h2.warn && c < h2.warn + 0.18 ? 1 - (c - h2.warn) / 0.18 : 0;
        if (warnK > 0) {
          ctx.fillStyle = U.rgba(K.CRIM, 0.08 + warnK * 0.14); ctx.beginPath(); ctx.ellipse(x0, y0, h2.R, 9, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = U.rgba(K.CRIM, 0.4 + warnK * 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x0, y0, h2.R, 9, 0, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(x0, y0, h2.R * warnK, 9 * warnK, 0, 0, TAU); ctx.stroke();
        }
        // tripod
        for (const s of [-1, 1, 0]) { ctx.beginPath(); ctx.moveTo(x0, y0 - 30); ctx.lineTo(x0 + s * 13, y0 + (s ? 0 : -2)); ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.stroke(); ctx.strokeStyle = s ? '#6c7488' : '#4a5163'; ctx.lineWidth = 1.8; ctx.stroke(); }
        poly(ctx, pts([x0 - 6, y0 - 46, x0 + 6, y0 - 46, x0 + 7, y0 - 28, x0 - 7, y0 - 28])); ctx.fillStyle = '#c8602c'; ctx.fill(); ink(ctx, 1.3);
        ctx.fillStyle = '#dfe5ee'; ctx.fillRect(x0 - 7, y0 - 38, 14, 2.4);
        // coil + lamp
        ctx.strokeStyle = '#d9a24e'; ctx.lineWidth = 1.4; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x0, y0 - 50 - i * 3, 4.5, 1.4, 0, 0, TAU); ctx.stroke(); }
        const lamp = 0.4 + warnK * 0.6 + zapK;
        ctx.beginPath(); ctx.arc(x0, y0 - 64, 3.4, 0, TAU); ctx.fillStyle = warnK > 0 ? '#ff8aa8' : '#ffe0a0'; ctx.fill(); ink(ctx, 1);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x0, y0 - 60, 30 + warnK * 20, warnK > 0 ? K.CRIM : AMBER, 0.35 * lamp);
        // crackling arcs while charging / the discharge
        if (warnK > 0 || zapK > 0) {
          const n = zapK > 0 ? 6 : 2, rr = zapK > 0 ? h2.R : 14 + warnK * 20, rng = U.mulberry32(((h2.t * 30) | 0) + 3);
          ctx.strokeStyle = zapK > 0 ? `rgba(220,250,255,${zapK})` : `rgba(255,190,210,${0.5 + warnK * 0.5})`; ctx.lineWidth = zapK > 0 ? 2.4 : 1.2;
          for (let k = 0; k < n; k++) {
            const ex = x0 + (rng() * 2 - 1) * rr, ey = zapK > 0 ? y0 : y0 - 60 + (rng() * 2 - 1) * rr * 0.6;
            ctx.beginPath(); ctx.moveTo(x0, y0 - 62);
            for (let j = 1; j <= 5; j++) { const u = j / 5; ctx.lineTo(lerp(x0, ex, u) + (rng() - 0.5) * 14, lerp(y0 - 62, ey, u) + (rng() - 0.5) * 8); }
            ctx.stroke();
          }
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      },
    };
    e.beacon = h; G.game.hazards.push(h);
  }

  /* ============================ ELITE — OLIN, THE FROZEN BUGLER 冰封號手・歐林 ============================ */
  // Descent II's signaller, frozen into his post for seventeen years: a giant in a frost-stiff greatcoat, an icicle
  // beard hanging from his visor, a great brass helicon coiled round his back with its bell flaring over his
  // shoulder, and a bearded axe whose poll is a little bugle bell. Phase 2: the horn cracks and blooms rose crystal.
  const OS = 1.45;
  const OP = {
    idle: (t) => { const br = Math.sin(t * 1.6); return { ry: 7 + br * 1.2, torso: 0.2 + br * 0.015, head: -0.05, tF: 0.5, kF: -0.6, tB: -0.42, kB: -0.25, aF: 0.55, eF: 0.75, aB: -0.15, eB: 1.1, sw: 1.15 }; },
    hi: { ry: 2, torso: -0.12, head: -0.15, tF: 0.55, kF: -0.6, tB: -0.5, kB: -0.25, aF: 2.8, eF: 0.45, aB: -0.6, eB: 0.6, sw: 3.75 },
    chop: { ry: 15, torso: 0.6, head: 0.1, tF: 0.95, kF: -1.0, tB: -0.65, kB: -0.15, aF: 1.15, eF: 0.1, aB: -0.9, eB: 0.4, sw: 1.2 },
    low: { ry: 12, torso: 0.42, head: 0.05, tF: 0.7, kF: -0.9, tB: -0.55, kB: -0.2, aF: -0.45, eF: 0.6, aB: 0.6, eB: 0.5, sw: -0.55 },
    rise: { ry: 4, torso: 0.02, head: -0.15, tF: 0.75, kF: -0.8, tB: -0.6, kB: -0.2, aF: 2.35, eF: 0.15, aB: -0.8, eB: 0.5, sw: 2.55 },
    slam: { ry: 26, torso: 0.82, head: 0.25, tF: 1.05, kF: -1.5, tB: -0.6, kB: -1.0, aF: 0.95, eF: 0.05, aB: -1.0, eB: 0.4, sw: 0.72 },
    sweepW: { ry: 16, torso: 0.3, head: 0.0, tF: 0.6, kF: -0.95, tB: -0.6, kB: -0.3, aF: -0.9, eF: 0.4, aB: 0.5, eB: 0.6, sw: -1.45 },
    sweep: { ry: 26, torso: 0.55, head: 0.1, tF: 1.05, kF: -1.3, tB: -0.75, kB: -0.3, aF: 0.75, eF: 0.15, aB: -0.6, eB: 0.4, sw: 1.62 },
    blow: { ry: 4, torso: -0.24, head: -0.38, tF: 0.5, kF: -0.5, tB: -0.5, kB: -0.25, aF: 0.35, eF: 0.55, aB: 2.05, eB: 2.15, sw: 0.85 },
    charge: { ry: 18, torso: 0.78, head: -0.35, tF: 1.0, kF: -1.15, tB: -0.85, kB: -0.2, aF: 0.15, eF: 1.5, aB: -0.4, eB: 1.2, sw: 2.9 },
    knee: { ry: -2, torso: 0.08, head: -0.1, tF: 1.55, kF: -1.95, tB: -0.2, kB: -0.1, aF: 0.9, eF: 0.5, aB: 2.05, eB: 2.1, sw: 1.5 },
    stomp: { ry: 20, torso: 0.45, head: 0.15, tF: 0.8, kF: -0.6, tB: -0.6, kB: -0.45, aF: 0.6, eF: 0.4, aB: 1.6, eB: 1.9, sw: 1.3 },
    hurt: { ry: 10, torso: -0.3, head: 0.5, tF: 0.3, kF: -0.6, tB: -0.6, kB: -0.4, aF: 0.3, eF: 1.2, aB: -0.6, eB: 1.0, sw: 2.2 },
    broken: (t) => ({ ry: 36, torso: 0.95 + Math.sin(t * 2) * 0.04, head: 0.65, tF: 1.4, kF: -1.6, tB: 0.05, kB: -1.65, aF: 0.6, eF: 0.15, aB: 0.3, eB: 0.4, sw: 0.12 }),
  };
  const OI = OP.idle(0);
  // horn blast: an expanding ring of sound (white — guard it; a perfect guard shakes his stance)
  function hornRing(e, x, y) {
    G.SFX.play('c2_hornBlast', e.phase); G.game.shake(0.3);
    G.FX.ring(x, y, 6, 90, 0.35, '#ffffff', 6); G.FX.flash(x, y, 120, 0.25, ICE_W);
    G.game.hazards.push({
      t: 0, life: 2.3, x, y, r: 18, speed: 440, owner: e, hit: false, p2: e.phase === 2,
      update(h, dt, g) {
        h.r += h.speed * dt;
        const Q = g.player, px = Q.x, py = Q.y - 60, d = Math.hypot(px - h.x, py - h.y);
        if (!h.hit && Math.abs(d - h.r) < 26) {
          h.hit = true;
          const res = Q.receiveHit(h.owner, { dmg: 17, kb: 240, hx: px, hy: py, waveFrom: h.x });
          const o = h.owner;
          if (res === 'parried' && o && !o.dead) { o.bal = Math.min(o.maxBal, o.bal + 40); o.balT = 0; o.showBar = 3; if (o.bal >= o.maxBal && o.state !== 'broken') o.breakBalance(); }
        }
      },
      draw(ctx, h) {
        const k = h.t / h.life, a = (1 - k) * (1 - k);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.rgba(h.p2 ? ROSE : ICE, 0.45 * a); ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * a})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.35 * a})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(h.x, h.y, h.r - 14, 0, TAU); ctx.stroke();
        ctx.restore();
        // notes riding the wavefront
        ctx.fillStyle = `rgba(240,250,255,${a})`; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        for (let i = 0; i < 8; i++) {
          const an = i / 8 * TAU + 0.3, nx = h.x + Math.cos(an) * h.r, ny = h.y + Math.sin(an) * h.r;
          ctx.beginPath(); ctx.ellipse(nx, ny, 4.2, 3, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(nx + 3.6, ny - 1); ctx.lineTo(nx + 3.6, ny - 13); ctx.lineTo(nx + 8, ny - 9); ctx.stroke();
        }
      },
    });
  }
  // glacier march: a line of ice spikes erupting toward you, one after another (red floor cracks first)
  function iceSpike(owner, x, delay) {
    const y = groundAt(x, owner.y - 60); if (y == null) return;
    G.game.hazards.push({
      t: -delay, life: 1.32, x, y, owner, warn: 0.62, hit: false, seed: (x | 0) * 13,
      update(h, dt, g) {
        if (h.t >= h.warn && !h.up) { h.up = true; G.SFX.play('crystal', 4); G.FX.shards(h.x, h.y - 10, 8, ICE, 520); G.FX.dust(h.x, h.y, 8, { w: 30, speed: 220, size: 10 }); g.shake(0.15); }
        if (h.up && !h.hit && h.t < h.warn + 0.22) {
          const box = { x: h.x - 25, y: h.y - 150, w: 50, h: 150 };
          if (U.rectsOverlap(box, g.player.hurtbox)) { h.hit = true; g.player.receiveHit(h.owner, { dmg: 20, unblockable: true, kb: 320, hx: h.x, hy: g.player.y - 60 }); }
        }
      },
      draw(ctx, h) {
        if (h.t < 0) return;
        if (!h.up) {
          const k = h.t / h.warn;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, h.x, h.y - 6, 30 + k * 26, K.CRIM, 0.25 + k * 0.45); ctx.restore();
          ctx.strokeStyle = U.rgba('#ffffff', 0.4 + k * 0.5); ctx.lineWidth = 1.6; ctx.beginPath();
          const rng = U.mulberry32(h.seed);
          for (let i = 0; i < 5; i++) { const a = (rng() - 0.5) * 2.6, l = (10 + rng() * 22) * k; ctx.moveTo(h.x, h.y - 1); ctx.lineTo(h.x + Math.sin(a) * l, h.y - 1 + Math.cos(a) * 3); }
          ctx.stroke();
          return;
        }
        const k = U.easeOutBack(clamp((h.t - h.warn) / 0.14, 0, 1)), fade = 1 - clamp((h.t - h.warn - 0.45) / 0.25, 0, 1);
        ctx.globalAlpha = fade;
        const rng = U.mulberry32(h.seed + 5);
        for (let i = 0; i < 4; i++) {
          const ox = (i - 1.5) * 11 + (rng() - 0.5) * 6, ht = (i === 1 || i === 2 ? 150 : 80 + rng() * 30) * k;
          shard(ctx, P(h.x + ox, h.y + 4), PI + (i - 1.5) * 0.18, ht, 9 - Math.abs(i - 1.5) * 2, '#effcff', '#5778b0', i === 1 ? ROSE : ICE_W);
        }
        ctx.globalAlpha = 1;
      },
    });
  }
  function olinPhase2(e) {
    e.phase = 2; e.speedMul = 1.15; e.atk = null; e.setState('idle'); e.cd = 1.4; e.p2T = 0;
    const g = G.game;
    g.bark('c2_eliteP2'); g.shake(0.9); g.slowmo(0.7, 0.3);
    G.SFX.play('c2_hornBlast', 2); G.SFX.play('crystal', 6);
    G.FX.ring(e.cx, e.cy, 20, 420, 0.9, ROSE, 7); G.FX.ring(e.cx, e.cy, 20, 300, 0.7, ICE, 4); G.FX.flash(e.cx, e.cy - 40, 300, 0.5, ROSE);
    G.FX.shards(e.cx, e.cy - 40, 30, ICE, 700); G.FX.shards(e.cx, e.cy - 40, 16, ROSE, 600);
  }
  const OL = TYPES.c2_elite = {
    name: '冰封號手・歐林', en: 'OLIN, THE FROZEN BUGLER', w: 62, h: 206, hp: 520, bal: 190, col: '#9fd8ff', elite: true, shards: 170, scale: OS, spawnT: 1.2,
    poise: true, defeatDialog: 'c2_eliteDefeat', defeatRelic: 'c2_horn', music: 'c2_elite',
    portrait: [1.55, 0.94],
    init(e) { e.coat = new Rig.Chain(5, 10, 0.07, 0.86); e.coatF = new Rig.Chain(4, 9, 0.09, 0.86); e.gaitP = 0; e.last = []; e.facing = -1; },
    voice: (e) => G.SFX.play('growl', 0.62),
    onHit: (e) => G.SFX.play(Math.random() < 0.5 ? 'c2_bronze' : 'c2_thud', 0.4),
    weapon: (e) => e.axeW || { x: e.x + e.facing * 120, y: e.y - 160 },
    think(e, dt) {
      e.faceP(); const d = e.distP();
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) { olinPhase2(e); return; }
      const want = 140;
      e.vx = U.approach(e.vx, d > want + 40 ? e.facing * 150 * e.speedMul : d < 90 ? -e.facing * 100 : 0, 900 * dt);
      if (e.cd > 0) return;
      const p2 = e.phase === 2;
      const pool = d > 380 ? [['charge', 3], ['blast', 2], ['fanfare', p2 ? 2 : 0], ['glacier', p2 ? 2.2 : 0]]
        : d > 200 ? [['blast', 2], ['charge', 1.2], ['overhead', 1], ['glacier', p2 ? 1.6 : 0], ['fanfare', p2 ? 1 : 0]]
          : [['combo', 3], ['overhead', 2], ['feint', 2], ['blast', 1], ['glacier', p2 ? 1 : 0]];
      const last = e.last[e.last.length - 1];
      const w = (p) => (p[0] === last ? p[1] * 0.2 : p[1]);
      let r = Math.random() * pool.reduce((s, p) => s + w(p), 0), pick = pool[0][0];
      for (const p of pool) { if ((r -= w(p)) <= 0) { pick = p[0]; break; } }
      e.last.push(pick); if (e.last.length > 4) e.last.shift();
      e.startAtk(OL[pick]);
    },
    // three-hit axe chain: down-chop, rising backhand, heavy overhead (white, white, white)
    combo: {
      dur: 2.7, cd: 1.0, tells: [{ t: 0.05, c: 'white' }, { t: 0.47, c: 'white' }, { t: 1.08, c: 'white' }],
      poses: { dur: 2.7, keys: [[0, OI], [0.4, OP.hi], [0.53, OP.chop, 'snap'], [0.82, OP.low], [0.96, OP.rise, 'snap'], [1.42, OP.hi], [1.6, OP.chop, 'snap'], [2.7, OI, 'io']] },
      moves: [{ t0: 0.42, t1: 0.53, v: 260 }, { t0: 0.86, t1: 0.96, v: 220 }, { t0: 1.5, t1: 1.6, v: 280 }],
      hits: [
        { t0: 0.5, t1: 0.62, box: { x: 10, y: -270, w: 170, h: 270 }, dmg: 18 },
        { t0: 0.93, t1: 1.05, box: { x: 10, y: -290, w: 168, h: 270 }, dmg: 18 },
        { t0: 1.56, t1: 1.7, box: { x: 15, y: -270, w: 175, h: 270 }, dmg: 22, last: true, pbal: 50 },
      ],
      ev: [0.5, 0.93, 1.56].map((t, i) => ({ t, fn: () => { G.SFX.play('slash', 0.5 + i * 0.05, i === 2); G.SFX.play('c2_bugle', 0.6 + i * 0.15); } })),
    },
    // delayed overhead: raised, held trembling far too long, then brought down (red) — don't dodge early
    overhead: {
      dur: 2.75, cd: 1.1, tells: [{ t: 0.55, c: 'red' }],
      poses: { dur: 2.75, keys: [[0, OI], [0.5, OP.hi], [1.3, { ...OP.hi, aF: 3.0, sw: 3.95, torso: -0.2 }], [1.4, OP.slam, 'snap'], [2.1, OP.slam], [2.75, OI, 'io']] },
      moves: [{ t0: 1.3, t1: 1.4, v: 360 }],
      hits: [{ t0: 1.36, t1: 1.52, box: { x: 20, y: -270, w: 186, h: 275 }, dmg: 30, red: true, kb: 430, last: true }],
      ev: [{ t: 1.3, fn: () => G.SFX.play('whoosh', 1.5) }, { t: 1.42, fn: (e) => {
        const ax = e.axeW ? e.axeW.x : e.x + e.facing * 150, gy = groundAt(ax, e.y - 40) ?? e.y;
        G.game.shake(0.8); G.SFX.play('quake'); G.SFX.play('crystal', 5); G.FX.ring(ax, gy, 10, 200, 0.5, ICE, 6, { flat: 0.2 }); G.FX.shards(ax, gy - 6, 18, ICE, 620); G.FX.dust(ax, gy, 24, { w: 90, speed: 320, size: 16 });
        if (e.phase === 2) shockwave(e, ax, gy, e.facing, { dmg: 16, col: ROSE });
      } }],
    },
    // feint: the chop starts… stops… then a fast low sweep (white)
    feint: {
      dur: 2.15, cd: 1.0, tells: [{ t: 0.85, c: 'white' }],
      poses: { dur: 2.15, keys: [[0, OI], [0.42, OP.hi], [0.7, { ...OP.hi, aF: 2.6, sw: 3.5 }], [1.15, OP.sweepW], [1.32, OP.sweep, 'snap'], [1.6, OP.sweep], [2.15, OI, 'io']] },
      moves: [{ t0: 1.2, t1: 1.32, v: 320 }],
      hits: [{ t0: 1.3, t1: 1.42, box: { x: 0, y: -150, w: 185, h: 150 }, dmg: 20, last: true, pbal: 60 }],
      ev: [{ t: 1.3, fn: () => { G.SFX.play('slash', 0.45, true); G.SFX.play('c2_bugle', 0.8); } }],
    },
    // horn blast: one expanding ring of sound (white)
    blast: {
      dur: 1.95, cd: 1.0, track: false, tells: [{ t: 0.4, c: 'white' }],
      poses: { dur: 1.95, keys: [[0, OI], [0.6, OP.blow], [1.4, OP.blow], [1.95, OI, 'io']] },
      ev: [{ t: 0.95, fn: (e) => { const b = e.bellW || { x: e.x, y: e.y - 260 }; hornRing(e, b.x, b.y); } }],
    },
    // shoulder rush across the floor (red)
    charge: {
      dur: 1.8, cd: 1.0, track: false, tells: [{ t: 0.06, c: 'red' }],   // red: ≥ 0.6 s before the rush (0.7)
      poses: { dur: 1.8, keys: [[0, OI], [0.6, OP.charge], [1.2, OP.charge], [1.8, OI, 'io']] },
      moves: [{ t0: 0.7, t1: 1.15, v: 740 }],
      hits: [{ t0: 0.7, t1: 1.15, box: { x: -10, y: -230, w: 112, h: 228 }, dmg: 24, red: true, kb: 420, last: true }],
      ev: [{ t: 0.7, fn: () => { G.SFX.play('whoosh', 1.4); G.SFX.play('c2_bugle', 0.5); } }],
    },
    // (phase 2) fanfare: three rings in quick succession (white ×3)
    fanfare: {
      dur: 2.6, cd: 1.2, track: false, tells: [{ t: 0.35, c: 'white' }, { t: 0.75, c: 'white' }, { t: 1.15, c: 'white' }],
      poses: { dur: 2.6, keys: [[0, OI], [0.5, OP.blow], [2.0, OP.blow], [2.6, OI, 'io']] },
      ev: [0.85, 1.25, 1.65].map((t) => ({ t, fn: (e) => { const b = e.bellW || { x: e.x, y: e.y - 260 }; hornRing(e, b.x, b.y); } })),
    },
    // (phase 2) glacier: a stomp sends spikes marching toward you (red)
    glacier: {
      dur: 2.2, cd: 1.2, track: false, tells: [{ t: 0.25, c: 'red' }],
      poses: { dur: 2.2, keys: [[0, OI], [0.6, OP.knee], [0.85, OP.knee], [0.95, OP.stomp, 'snap'], [1.6, OP.stomp], [2.2, OI, 'io']] },
      ev: [{ t: 0.95, fn: (e) => {
        G.game.shake(0.7); G.SFX.play('quake'); G.FX.ring(e.x, e.y, 10, 160, 0.4, ICE, 5, { flat: 0.2 });
        const dir = Math.sign(e.P.x - e.x) || e.facing;
        for (let i = 0; i < 7; i++) iceSpike(e, e.x + dir * (110 + i * 92), i * 0.13);
      } }],
    },
    atkUpdate(e) {
      if (e.atk === OL.charge && e.st > 0.7 && e.st < 1.15 && Math.random() < 0.5) G.FX.dust(e.x, e.y, 1, { w: 30, speed: 160, size: 10 });
    },
    draw(ctx, e, ghost) {
      const dt = G.game.dtVis, t = e.t, p2 = e.phase === 2, st = e.st, A = e.atk;
      if (p2) e.p2T = (e.p2T || 0) + dt;
      // ---- pose ----
      let target;
      if (e.state === 'atk' && A && A.poses) {
        target = Rig.sample(A.poses, st);
        if (A === OL.overhead && st > 0.5 && st < 1.3) target = { ...target, aF: target.aF + Math.sin(t * 46) * 0.035, ry: target.ry + Math.sin(t * 40) * 0.8 };
      } else if (e.state === 'hurt' || e.state === 'recoil') target = OP.hurt;
      else if (e.state === 'broken') target = OP.broken(t);
      else if (e.state === 'spawn') target = OP.broken(t);
      else if (Math.abs(e.vx) > 30 && e.onGround) {
        const prev = Math.floor(e.gaitP / PI); e.gaitP += Math.abs(e.vx) * dt * PI / 34;
        if (!ghost && Math.floor(e.gaitP / PI) !== prev && Math.abs(e.x - e.P.x) < 900) { G.SFX.play('heavyStep'); G.game.shake(0.06); }
        const w = Rig.ANIM.walk(e.gaitP);
        target = { ...OP.idle(t), ik: 1, fFx: w.fFx * 1.3 + 8, fFy: w.fFy * 1.4, fBx: w.fBx * 1.3 - 8, fBy: w.fBy * 1.4, ry: w.ry + 6 };
      } else target = OP.idle(t);
      if (e.onGround && e.state !== 'broken' && e.state !== 'spawn' && !target.ik) target = Rig.groundify(target);
      if (e.hitK > 0) target = Rig.lerpPose(Rig.full(target), Rig.full({ ...Rig.full(target), torso: target.torso - 0.25, head: 0.4 }), Math.min(1, e.hitK));
      K.blendPose(e, target, dt, e.hitK > 0 ? 40 : e.state === 'atk' ? 28 : 12);
      const J = Rig.compute(e.pose); e.J = J;
      const sd = dirv(J.sw, 1), edge = P(-Math.cos(J.sw), Math.sin(J.sw));
      const axeC = add(J.hdF, P(sd.x * 60, sd.y * 60));
      e.axeW = { x: e.x + e.facing * (axeC.x + edge.x * 14) * OS, y: e.y + (axeC.y + edge.y * 14) * OS };
      const a0 = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x), ux = Math.cos(a0), uy = Math.sin(a0), nx = -uy, ny = ux;
      const Q = (a, f) => P(J.hip.x + ux * a * 36 + nx * f, J.hip.y + uy * a * 36 + ny * f);
      const bellO = Q(1.62, -27), throat = Q(1.08, -20);
      e.bellW = { x: e.x + e.facing * bellO.x * OS, y: e.y + bellO.y * OS };
      const blowK = A && (A === OL.blast || A === OL.fanfare || A === OL.glacier) && e.state === 'atk' ? win(st, 0.2, 0.6) * (1 - win(st, A.dur - 0.5, A.dur - 0.1)) : 0;
      ctx.save();
      // he doesn't rise out of the floor (the gantry is a thin deck): he kneels at his post glazed in frost and wakes.
      // Nothing of him is ever drawn below the deck (a kneeling or slamming axe reads as bitten into it, not through it)
      const frozen = K.emerge(ctx, e), sink = 0;
      if (e.onGround || e.state === 'spawn') { ctx.beginPath(); ctx.rect(e.x - 900, e.y - 2400, 1800, 2406); ctx.clip(); }
      if (frozen > 0 && frozen < 0.2 && !e.thawed && !ghost) {
        e.thawed = true; G.SFX.play('crystal', 5); G.SFX.play('c2_bronze', 0.7);
        G.FX.shards(e.x, e.y - 110, 26, ICE, 560); G.FX.dust(e.x, e.y, 14, { w: 90, speed: 220, size: 12 });
      }
      ctx.translate(e.x, e.y + sink); ctx.scale(e.facing * OS, OS);
      dissolve(ctx, e, ghost, '#bfe9ff');
      ctx.fillStyle = 'rgba(10,12,28,0.32)'; ctx.beginPath(); ctx.ellipse(0, 1, 40, 4.5, 0, 0, TAU); ctx.fill();
      // phase-2 aura
      if (p2) { const pa = 0.3 + Math.sin(t * 3) * 0.08; glowAdd(ctx, Q(0.7, -6).x, Q(0.7, -6).y, 95, ROSE, pa * 0.6); glowAdd(ctx, bellO.x, bellO.y, 50, ROSE, pa); }
      // ---- the great horn (behind) ----
      const hc = Q(0.58, -17), R = 22;
      const brass = (pts2, w) => { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; poly(ctx, pts2, false); ctx.strokeStyle = INK; ctx.lineWidth = w + 2.6; ctx.stroke(); ctx.strokeStyle = '#b8862f'; ctx.lineWidth = w; ctx.stroke(); ctx.strokeStyle = 'rgba(255,236,170,0.85)'; ctx.lineWidth = w * 0.3; ctx.save(); ctx.translate(0.6, -0.8); ctx.stroke(); ctx.restore(); };
      const ringPts = (r, a1, a2, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const a = a1 + (a2 - a1) * i / n; return P(hc.x + Math.cos(a) * r, hc.y + Math.sin(a) * r); });
      brass(ringPts(R, 0, TAU), 5.2);
      brass(ringPts(R - 7, 0.6, TAU - 0.2), 3.2);
      // bell: flares from the coil up over the back shoulder
      const ax = bellO.x - throat.x, ay = bellO.y - throat.y, al = Math.hypot(ax, ay), bx = -ay / al, by = ax / al;
      brass([P(hc.x + Math.cos(-1.2) * R, hc.y + Math.sin(-1.2) * R), mix(P(hc.x + Math.cos(-1.2) * R, hc.y + Math.sin(-1.2) * R), throat, 0.5), throat], 5);
      const bw0 = 4, bw1 = 17;
      ctx.beginPath(); ctx.moveTo(throat.x + bx * bw0, throat.y + by * bw0);
      ctx.quadraticCurveTo(throat.x + ax * 0.75 + bx * 5, throat.y + ay * 0.75 + by * 5, bellO.x + bx * bw1, bellO.y + by * bw1);
      ctx.lineTo(bellO.x - bx * bw1, bellO.y - by * bw1);
      ctx.quadraticCurveTo(throat.x + ax * 0.75 - bx * 5, throat.y + ay * 0.75 - by * 5, throat.x - bx * bw0, throat.y - by * bw0); ctx.closePath();
      ctx.fillStyle = cel(ctx, mix(throat, bellO, 0.6).x, mix(throat, bellO, 0.6).y, bx, by, 14, '#c99a3c'); ctx.fill(); ink(ctx, 1.4);
      // frost on the brass
      ctx.fillStyle = 'rgba(240,250,255,0.9)'; poly(ctx, [add(bellO, P(bx * 15, by * 15)), add(mix(throat, bellO, 0.55), P(bx * 7, by * 7)), add(mix(throat, bellO, 0.7), P(bx * 3, by * 3)), add(bellO, P(bx * 8, by * 8))]); ctx.fill();
      // the opening
      ctx.save(); ctx.translate(bellO.x, bellO.y); ctx.rotate(Math.atan2(by, bx));
      ctx.beginPath(); ctx.ellipse(0, 0, bw1 + 1.5, 5.5, 0, 0, TAU); ctx.fillStyle = '#d9b056'; ctx.fill(); ink(ctx, 1.3);
      ctx.beginPath(); ctx.ellipse(0, 0.5, bw1 - 2, 3.6, 0, 0, TAU); ctx.fillStyle = '#140a10'; ctx.fill();
      ctx.restore();
      const bellGlow = (p2 ? 0.6 : 0.35) + blowK * 0.6 + Math.sin(t * 2.5) * 0.08;
      glowAdd(ctx, bellO.x, bellO.y, 26 + blowK * 16, p2 ? ROSE : ICE, bellGlow);
      if (p2) { // cracked bell blooming rose crystal
        shard(ctx, add(bellO, P(bx * 10, by * 10)), Math.atan2(ax, ay) + 0.4, 18, 4.5, '#ffd0e4', '#b03a74', ICE_W);
        shard(ctx, add(bellO, P(-bx * 8, -by * 8)), Math.atan2(ax, ay) - 0.5, 13, 3.6, '#ffc2dc', '#93305f', null);
        ctx.strokeStyle = '#ffd6e8'; ctx.lineWidth = 1.2; poly(ctx, [add(throat, P(bx * 2, by * 2)), add(mix(throat, bellO, 0.4), P(bx * 6, by * 6)), add(mix(throat, bellO, 0.6), P(bx * 2, by * 2)), add(mix(throat, bellO, 0.85), P(bx * 10, by * 10))], false); ctx.stroke();
      }
      // ---- back arm + back leg ----
      Rig.limbChain(ctx, [J.shB, J.elB, J.hdB], [5.6, 5, 4], '#24384c');
      ctx.beginPath(); ctx.arc(J.hdB.x, J.hdB.y, 4.2, 0, TAU); ctx.fillStyle = '#3a3d48'; ctx.fill(); ink(ctx, 1);
      Rig.limbChain(ctx, [J.hip, mix(J.hip, J.kneeB, 0.5), J.kneeB, mix(J.kneeB, J.ankB, 0.5), J.ankB], [8, 7.2, 5.8, 5.4, 4.6], '#1f2a3a');
      Rig.limb(ctx, mix(J.kneeB, J.ankB, 0.45), J.ankB, 6, 5.4, '#2b2a30'); Rig.limb(ctx, J.ankB, add(J.toeB, P(3, 0)), 5.2, 4, '#2b2a30');
      // ---- greatcoat tails (cloth physics), frozen ragged hem with icicles ----
      const hipBack = Q(0.02, -10), hipFront = Q(0.02, 9);
      if (!ghost) {
        e.coat.update(e.x + e.facing * hipBack.x * OS, e.y + sink + hipBack.y * OS, e.facing, dt, -e.vx * 2.5 + Math.sin(t * 1.3) * 160, 2.95);
        e.coatF.update(e.x + e.facing * hipFront.x * OS, e.y + sink + hipFront.y * OS, e.facing, dt, -e.vx * 2 + Math.sin(t * 1.5) * 120, 3.25);
      }
      const loc = (c) => c.p.map((q) => P((q.x - e.x) * e.facing / OS, (q.y - e.y - sink) / OS));
      const icicles = (pts2) => {
        const end = pts2[pts2.length - 1], prv = pts2[pts2.length - 2], dx = end.x - prv.x, dy = end.y - prv.y, dl = Math.hypot(dx, dy) || 1, ex = -dy / dl, ey = dx / dl;
        ctx.fillStyle = '#e8f8ff';
        for (let i = -1; i <= 1; i++) { const b = add(end, P(ex * i * 6, ey * i * 6)); poly(ctx, [add(b, P(-1.6, 0)), add(b, P(dx / dl * (6 + (i + 1) * 2), dy / dl * (6 + (i + 1) * 2))), add(b, P(1.6, 0))]); ctx.fill(); ink(ctx, 0.6); }
      };
      if (e.coat.inited) { const cp = loc(e.coat); K.tattered(ctx, cp, 9, 15, '#2c4560', '#162232', 3); icicles(cp); }
      // ---- torso: greatcoat, bandolier, Descent II bell badge, frost ----
      const tp2 = [Q(-0.12, -13), Q(0.45, -14), Q(0.95, -16), Q(1.15, -7), Q(1.15, 9), Q(0.92, 15), Q(0.45, 13.5), Q(-0.15, 12.5)];
      smooth(ctx, tp2); ctx.fillStyle = cel(ctx, Q(0.5, 0).x, Q(0.5, 0).y, nx, ny, 16, '#35536e'); ctx.fill(); ink(ctx, 1.6);
      ctx.save(); smooth(ctx, tp2); ctx.clip();
      // double-breasted placket + brass buttons
      ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 1; const pl1 = Q(0.05, 6), pl2 = Q(1.0, 9); ctx.beginPath(); ctx.moveTo(pl1.x, pl1.y); ctx.lineTo(pl2.x, pl2.y); ctx.stroke();
      for (let i = 0; i < 4; i++) { const b = Q(0.2 + i * 0.2, 9.5); ctx.beginPath(); ctx.arc(b.x, b.y, 1.5, 0, TAU); ctx.fillStyle = '#e0b553'; ctx.fill(); ink(ctx, 0.5); }
      // bandolier strap holding the horn
      const s1 = Q(1.05, 12), s2 = Q(0.1, -12);
      ctx.strokeStyle = INK; ctx.lineWidth = 6.4; ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
      ctx.strokeStyle = '#6b4126'; ctx.lineWidth = 4.4; ctx.stroke();
      ctx.fillStyle = '#e0b553'; const bk = mix(s1, s2, 0.4); ctx.fillRect(bk.x - 2.4, bk.y - 2.4, 4.8, 4.8);
      // frost crust over chest and shoulders
      ctx.fillStyle = '#eef8ff'; poly(ctx, [Q(0.85, -18), Q(1.2, -9), Q(1.2, 4), Q(1.04, 1), Q(0.98, 6), Q(0.9, -2), Q(0.8, 2), Q(0.76, -9)]); ctx.fill();
      ctx.restore();
      // Descent II badge: a little gold bell
      const bdg = Q(0.72, 4);
      ctx.beginPath(); ctx.moveTo(bdg.x - 3.2, bdg.y + 3); ctx.quadraticCurveTo(bdg.x - 3, bdg.y - 4, bdg.x, bdg.y - 4.2); ctx.quadraticCurveTo(bdg.x + 3, bdg.y - 4, bdg.x + 3.2, bdg.y + 3); ctx.closePath();
      ctx.fillStyle = '#ffd27a'; ctx.fill(); ink(ctx, 0.8);
      // belt
      const bl1 = Q(0.06, -13.5), bl2 = Q(0.08, 13);
      ctx.strokeStyle = INK; ctx.lineWidth = 5.6; ctx.beginPath(); ctx.moveTo(bl1.x, bl1.y); ctx.lineTo(bl2.x, bl2.y); ctx.stroke(); ctx.strokeStyle = '#3d2a1e'; ctx.lineWidth = 3.8; ctx.stroke();
      // ---- front leg: armoured greave + boot ----
      Rig.limbChain(ctx, [J.hip, mix(J.hip, J.kneeF, 0.5), J.kneeF, mix(J.kneeF, J.ankF, 0.5), J.ankF], [8.6, 7.8, 6.2, 5.8, 5], '#2a3a50', { spec: 0.2 });
      Rig.limb(ctx, mix(J.kneeF, J.ankF, 0.15), mix(J.kneeF, J.ankF, 0.9), 6.6, 5.6, '#8a98ab', { spec: 0.4 });
      Rig.limb(ctx, J.ankF, add(J.toeF, P(4, 0)), 5.8, 4.4, '#2b2a30', { spec: 0.3 });
      ctx.beginPath(); ctx.ellipse(J.kneeF.x + 1.5, J.kneeF.y, 5.5, 6.5, 0, 0, TAU); ctx.fillStyle = '#9fadc0'; ctx.fill(); ink(ctx, 1.1);
      if (e.coatF.inited) { const cp = loc(e.coatF); K.tattered(ctx, cp, 7, 10, '#35536e', '#1d2c3d', 5); icicles(cp); }
      // ---- head: rounded Descent helm, visor slit, a beard of icicles ----
      ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha); ctx.scale(1.12, 1.12);
      const helm = () => { ctx.beginPath(); ctx.moveTo(-10, 6); ctx.bezierCurveTo(-12, -6, -7, -13, 1, -13); ctx.bezierCurveTo(8, -13, 12, -7, 12, 0); ctx.lineTo(12, 5); ctx.quadraticCurveTo(4, 9, -10, 6); ctx.closePath(); };
      helm(); ctx.fillStyle = cel(ctx, 0, -3, 1, 0, 12, '#7c8aa0'); ctx.fill(); ink(ctx, 1.4);
      ctx.save(); helm(); ctx.clip();
      ctx.fillStyle = '#eef8ff'; poly(ctx, pts([-12, -6, -6, -13, 4, -14, 12, -8, 8, -9, 2, -7, -4, -9, -9, -4])); ctx.fill();
      ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(1, -13); ctx.lineTo(1, 6); ctx.stroke();
      ctx.restore();
      // visor band + glowing slit
      poly(ctx, pts([2, -4.5, 13, -4, 13, 1.2, 2.5, 1.5])); ctx.fillStyle = '#1b2230'; ctx.fill(); ink(ctx, 1);
      const eyeC = p2 ? ROSE : ICE, eyeK = e.state === 'broken' ? 0.3 + Math.abs(Math.sin(t * 6)) * 0.4 : 1;
      glowAdd(ctx, 9, -1.6, 14, eyeC, 0.7 * eyeK);
      ctx.fillStyle = U.rgba(p2 ? '#ffe0ee' : '#e9fdff', eyeK); ctx.fillRect(4.5, -2.4, 8, 1.7);
      // icicle beard
      for (let i = 0; i < 6; i++) {
        const bx2 = 1 + i * 2.2, ln = [7, 11, 14, 12, 9, 6][i] + Math.sin(t * 1.3 + i) * 0.4;
        poly(ctx, [P(bx2 - 1.4, 2), P(bx2 + 0.3, 2 + ln), P(bx2 + 1.4, 2)]); ctx.fillStyle = i % 2 ? '#dff4ff' : '#bfe6fb'; ctx.fill(); ink(ctx, 0.6);
      }
      // breath fog leaking from the visor
      if (!ghost && e.state !== 'broken') for (let i = 0; i < 2; i++) {
        const ph = (t * 0.45 + i * 0.5) % 1;
        ctx.fillStyle = `rgba(230,248,255,${(1 - ph) * 0.3})`; ctx.beginPath(); ctx.arc(14 + ph * 16, -1 - ph * 10, 2.5 + ph * 6, 0, TAU); ctx.fill();
      }
      ctx.restore();
      // ---- mouthpiece lead pipe (to the visor while blowing) ----
      const mpRest = Q(0.95, 12), mpBlow = add(J.head, rot(P(10, 4), J.ha)), mp = mix(mpRest, mpBlow, blowK);
      brass([P(hc.x + Math.cos(0.3) * R, hc.y + Math.sin(0.3) * R), mix(P(hc.x + R, hc.y), mp, 0.5), mp], 2.6);
      ctx.beginPath(); ctx.arc(mp.x, mp.y, 2.4, 0, TAU); ctx.fillStyle = '#e0b553'; ctx.fill(); ink(ctx, 0.8);
      // ---- front pauldron: ice-crusted steel ----
      const pa = add(J.sh, P(-1, -2));
      ctx.save(); ctx.translate(pa.x, pa.y); ctx.rotate(J.ha * 0.3 - 0.3);
      ctx.beginPath(); ctx.moveTo(-11, 4); ctx.quadraticCurveTo(-10, -9, 2, -10); ctx.quadraticCurveTo(12, -8, 12, 4); ctx.quadraticCurveTo(0, 9, -11, 4); ctx.closePath();
      ctx.fillStyle = cel(ctx, 0, 0, 0.6, -0.8, 10, '#8090a6'); ctx.fill(); ink(ctx, 1.3);
      ctx.fillStyle = '#f2faff'; poly(ctx, pts([-10, -2, -6, -9, 4, -10, 11, -5, 4, -6, -2, -4])); ctx.fill();
      if (p2) shard(ctx, P(-2, -8), PI - 0.3, 12, 3.4, '#ffd0e4', '#b03a74', null);
      ctx.restore();
      // ---- front arm + the horn-axe ----
      Rig.limbChain(ctx, [J.sh, J.elF, J.hdF], [6, 5.2, 4.4], '#2e4862');
      Rig.limb(ctx, mix(J.elF, J.hdF, 0.25), J.hdF, 5.2, 4.8, '#7d8ca2', { spec: 0.35 });
      const butt = add(J.hdF, P(-sd.x * 16, -sd.y * 16)), hTop = add(J.hdF, P(sd.x * 72, sd.y * 72));
      cable(ctx, [butt, hTop], '#5b3b28', 3.4, 'rgba(255,214,160,0.45)');
      for (const u of [0.1, 0.62]) { const q = mix(butt, hTop, u); ctx.beginPath(); ctx.arc(q.x, q.y, 2.8, 0, TAU); ctx.fillStyle = '#c99a3c'; ctx.fill(); ink(ctx, 0.8); }
      ctx.save(); ctx.translate(axeC.x, axeC.y); ctx.rotate(Math.atan2(edge.y, edge.x));
      // local: +x = edge direction, +y = along the haft toward the hand? (rotate so the haft runs along y)
      const blade = () => { ctx.beginPath(); ctx.moveTo(1, -10); ctx.quadraticCurveTo(12, -14, 24, -17); ctx.quadraticCurveTo(31, 0, 25, 18); ctx.quadraticCurveTo(12, 13, 1, 9); ctx.closePath(); };
      blade(); ctx.fillStyle = cel(ctx, 12, 0, 0, -1, 16, '#b9cbd9'); ctx.fill(); ink(ctx, 1.5);
      ctx.strokeStyle = p2 ? '#ffb3d1' : '#ffffff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(24.5, -15); ctx.quadraticCurveTo(30, 0, 24.5, 16); ctx.stroke();
      if (p2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(ROSE, 0.5); ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
      ctx.fillStyle = '#eef8ff'; poly(ctx, pts([2, -9, 12, -12, 9, -6, 4, -4])); ctx.fill();
      // the poll: a little bugle bell
      ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(-10, -6); ctx.quadraticCurveTo(-15, -8, -17, -9); ctx.lineTo(-17, 9); ctx.quadraticCurveTo(-15, 8, -10, 6); ctx.lineTo(-2, 3); ctx.closePath();
      ctx.fillStyle = cel(ctx, -9, 0, 0, -1, 8, '#c99a3c'); ctx.fill(); ink(ctx, 1.2);
      ctx.beginPath(); ctx.ellipse(-17, 0, 2.6, 9, 0, 0, TAU); ctx.fillStyle = '#140a10'; ctx.fill(); ink(ctx, 1);
      ctx.fillStyle = '#5b3b28'; ctx.fillRect(-3, -5, 6, 10); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(-3, -5, 6, 10);
      ctx.restore();
      ctx.beginPath(); ctx.arc(J.hdF.x, J.hdF.y, 4.6, 0, TAU); ctx.fillStyle = '#3a3d48'; ctx.fill(); ink(ctx, 1.1);
      tellGlow(ctx, e, axeC.x + edge.x * 18, axeC.y + edge.y * 18, 30);
      // waking: seventeen years of rime still crusting knees, hips, shoulders and helm — it cracks away as he stands
      if (frozen > 0.01) {
        ctx.save(); ctx.globalAlpha *= clamp(frozen * 1.7, 0, 1);
        ctx.fillStyle = 'rgba(236,248,255,0.9)'; ctx.beginPath(); ctx.ellipse(8, 0.5, 44, 5, 0, 0, TAU); ctx.fill(); ink(ctx, 1);
        const rng = U.mulberry32(1717), grow = 0.45 + 0.55 * frozen;
        for (const [j, n, len] of [[J.kneeF, 3, 24], [J.kneeB, 2, 17], [J.hip, 3, 20], [J.sh, 3, 18], [J.head, 2, 13], [P(-26, 0), 2, 26], [P(34, 0), 2, 22]]) {
          for (let i = 0; i < n; i++) shard(ctx, add(j, P((rng() - 0.5) * 16, (rng() - 0.5) * 8)), PI + (rng() - 0.5) * 1.5, len * (0.6 + rng() * 0.6) * grow, 2.8 + rng() * 2.6, '#f2fbff', '#7aa6d6', ICE_W);
        }
        ctx.restore();
      }
      ctx.restore();
      dbg(ctx, e);
    },
  };

  if (DPOSE) for (const id of Object.keys(TYPES).filter((k) => k.startsWith('c2_') && k !== 'c2_boss')) {
    const T = TYPES[id], th = T.think, au = T.atkUpdate;
    T.think = function (e, dt) { if (!debugPose(e)) th.call(T, e, dt); };
    T.atkUpdate = function (e, dt) { if (au) au.call(T, e, dt); debugPose(e); };
  }

  /* ============================ data / codex / sfx ============================ */
  const D = G.DATA, hush = D.codex.hushborn = D.codex.hushborn || [];
  const codex = (o) => { if (!hush.some((q) => q.id === o.id)) hush.push(o); };
  // Olin's phase-2 bark (his own signal call, see the note 「歐林的號譜」)
  D.barks.c2_eliteP2 = D.barks.c2_eliteP2 || { who: 'c2_olin', text: '一長，不停……我在這裡。跟著聲音……走。' };
  codex({
    id: 'c2_rimehound', name: '霜鳴犬', en: 'RIMEHOUND', portrait: 'c2_rimehound', unlock: 'seen_c2_rimehound', tag: '寂裔｜低階・群獵',
    body: [
      '鐘樓獵人說，雪夜裡聽見的狼嚎，有一半不是狼。冰晶甲片包著一具空心肋籠，裡面只剩一顆會發光的晶核在跳——像有什麼東西替牠記得怎麼呼吸。總是兩三隻一起出現。',
      '攻擊模式：伏低後撲咬（白光，可格擋）；連續兩次咬合（白、白）。抬頭長嚎時，附近的寂裔會加速數秒。',
      '弱點：撲咬落地後的空檔。先打斷正在長嚎的那一隻。',
    ],
  });

  codex({
    id: 'c2_knellmonk', name: '喪鐘僧', en: 'KNELL MONK', portrait: 'c2_knellmonk', unlock: 'seen_c2_knellmonk', tag: '寂裔｜中階・人型',
    body: [
      '鐘樓的老人說，以前每座山寺都有一口為死者敲的鐘。寂靜降臨後，敲鐘的人和鐘長成了同一個東西：頭顱是一口裂開的青銅鐘，鐘口裡吊著一顆發光的晶錘，代替他看著你。',
      '攻擊模式：高舉鐘槌後重砸（紅光，不可格擋），落地的鐘聲會沿著地面推出一道衝擊波——跳過去；橫掃鐘槌（白光，可格擋）。',
      '弱點：重砸之後鐘槌會在地上停留很久。他揮槌時不會因輕擊而退縮，切勿貪攻。',
    ],
  });
  codex({
    id: 'c2_tetherling', name: '縛索蛛', en: 'TETHERLING', portrait: 'c2_tetherling', unlock: 'seen_c2_tetherling', tag: '寂裔｜低階・伏擊',
    body: [
      '錨站的升降索斷了十七年，斷頭沒有落地，而是自己打了結、長出腳。它們倒吊在半空的索上，等腳下有東西經過。',
      '攻擊模式：從頭頂墜落（紅光——地上的影子變深就快離開）；落地後吐出黏稠的纜絲團（白光，可格擋，完美格擋能彈回去），被打中雙腿會被纏住、跑不快——用閃避掙脫；近身時用前腳戳刺（白光）。',
      '弱點：倒吊時跳起來砍它的索——連中三下，它會自己摔下來。',
    ],
  });
  codex({
    id: 'c2_linesman', name: '巡線兵', en: 'LINESMAN', portrait: 'c2_linesman', unlock: 'seen_c2_linesman', tag: '寂裔｜中階・人型',
    body: [
      '方舟升降索的維修技師。最後一班的值勤日誌停在「索體異常共振，前往檢查」。他還在巡線——護目鏡的一片鏡片裡長出了晶體，無線電裡只剩沙沙聲，他仍然每隔幾秒就回報一次「線路正常」。',
      '攻擊模式：絕緣鉤桿全力突刺（紅光，不可格擋），鉤中會把你拖到他面前；鉤桿低掃、高掃兩連擊（白、白）。會在雪地插下中繼信標：地上亮起紅圈時離開範圍，信標會放電。',
      '弱點：突刺落空後收桿很慢。信標會在他倒下後熄滅。',
    ],
  });
  codex({
    id: 'c2_elite', name: '冰封號手・歐林', en: 'OLIN, THE FROZEN BUGLER', portrait: 'c2_elite', unlock: 'seen_c2_elite', tag: '菁英｜第二降臨隊・信號手',
    body: [
      '第二降臨隊的信號手。他的號角曾經在暴風雪裡替整支隊伍指路——直到某一天，號角吹出的不再是聲音，而是寂靜。', '鐘樓的孩子們還記得他。他們不知道，那首集合號，他後來又吹了十七年。',
      '他守在錨站上方的平台，背上的巨號與斧刃結成冰。號角聲會擴散成一圈聲環（白光，可完美格擋）；斧刃連擊之後，常接一記延遲的紅光劈砍。',
      '第二階段：冰甲裂開，他會吹響衝鋒號、踏冰突進。號聲未歇，不可戀戰。',
    ],
  });

  const SFX = G.SFX;
  SFX.c2_rimeSnarl = function (t, howl) {
    const A = G.AudioKit; if (howl) return;
    A.noise(t, 0.02, 0.12, 0.28, 'bandpass', 380, 180, 2.2, 0.05);
    A.tone('sawtooth', 120, t, 0.02, 0.05, 0.3, { to: 80, filter: 'lowpass', ff: 600 });
    A.bell(A.mtof(98), t + 0.02, 0.012, 0.4, 0.5, 0.6);
  };
  SFX.c2_knell = function (t, k = 1) { const A = G.AudioKit; A.bell(A.mtof(40), t, 0.1 * k, 3.2, 0.6, 0.9); A.bell(A.mtof(52), t + 0.01, 0.05 * k, 2.4, 0.6, 0.6); A.tone('sine', 55, t, 0.01, 0.16 * k, 0.9, { to: 44, wet: 0.3 }); };
  SFX.c2_bronze = function (t, k = 1) { const A = G.AudioKit; A.bell(A.mtof(64 + Math.floor(Math.random() * 3)), t, 0.05 * k, 0.9, 0.4, 1.1); A.noise(t, 0.001, 0.08 * k, 0.05, 'highpass', 3000, 2000, 1, 0.05); };
  SFX.c2_creak = function (t) { const A = G.AudioKit; for (let i = 0; i < 4; i++) A.tone('sawtooth', 140 + i * 23, t + i * 0.11, 0.02, 0.025, 0.12, { to: 95 + i * 15, filter: 'bandpass', ff: 900, q: 6, wet: 0.3 }); };
  SFX.c2_twang = function (t, k = 1) { const A = G.AudioKit; A.tone('triangle', 180 * k + 60, t, 0.002, 0.07, 0.35, { to: 110 * k + 40, wet: 0.3 }); A.noise(t, 0.001, 0.05, 0.06, 'highpass', 4000, 3000, 1, 0.05); };
  SFX.c2_land = function (t) { const A = G.AudioKit; A.tone('sine', 70, t, 0.003, 0.3, 0.25, { to: 38 }); A.noise(t, 0.002, 0.14, 0.2, 'lowpass', 900, 200, 0.7, 0.1); SFX.skitter(t + 0.05); };
  SFX.c2_spit = function (t) { const A = G.AudioKit; A.noise(t, 0.01, 0.12, 0.16, 'bandpass', 1400, 500, 1.4, 0.1); A.tone('sine', 300, t, 0.005, 0.05, 0.12, { to: 160 }); };
  SFX.c2_radio = function (t, k = 1) { const A = G.AudioKit; for (let i = 0; i < 5; i++) A.noise(t + i * 0.045, 0.002, 0.05 * k, 0.03, 'bandpass', 1800 + Math.random() * 1600, 1200, 3, 0.05); A.tone('square', 1320, t + 0.24, 0.002, 0.018 * k, 0.07, { filter: 'lowpass', ff: 3000 }); A.tone('square', 990, t + 0.33, 0.002, 0.018 * k, 0.07, { filter: 'lowpass', ff: 3000 }); };
  SFX.c2_thud = function (t) { const A = G.AudioKit; A.tone('sine', 110, t, 0.002, 0.14, 0.12, { to: 60 }); A.noise(t, 0.002, 0.08, 0.08, 'lowpass', 1100, 300, 0.7, 0.03); };
  SFX.c2_charge = function (t) { const A = G.AudioKit; A.tone('sawtooth', 120, t, 0.6, 0.03, 0.4, { to: 900, toT: 0.9, filter: 'bandpass', ff: 1400, q: 3, wet: 0.2 }); };
  SFX.c2_zap = function (t) { const A = G.AudioKit; A.noise(t, 0.001, 0.25, 0.22, 'highpass', 2500, 900, 0.8, 0.15); A.tone('square', 70, t, 0.001, 0.08, 0.2, { to: 40, filter: 'lowpass', ff: 900 }); };
  SFX.c2_bite = function (t) { const A = G.AudioKit; A.noise(t, 0.002, 0.16, 0.06, 'highpass', 2600, 1800, 0.8, 0.02); A.bell(A.mtof(91), t, 0.02, 0.25, 0.2, 1); A.tone('sine', 140, t, 0.002, 0.12, 0.08, { to: 70 }); };
  SFX.c2_howl = function (t) {
    const A = G.AudioKit;
    A.tone('triangle', 330, t, 0.25, 0.07, 1.3, { to: 520, toT: 0.5, wet: 0.7 });
    A.tone('sine', 660, t + 0.05, 0.3, 0.035, 1.2, { to: 990, toT: 0.6, wet: 0.8 });
    A.noise(t, 0.3, 0.05, 1.1, 'bandpass', 900, 1800, 3, 0.6);
    [86, 93, 98].forEach((m, i) => A.bell(A.mtof(m), t + 0.2 + i * 0.12, 0.018, 1.2, 0.7, 0.6));
  };
})(window.G);

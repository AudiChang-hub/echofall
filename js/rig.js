'use strict';
/* ECHOFALL — procedural skeletal rig, keyframe poses, hair physics, and the hero renderer. */
(function (G) {
  const U = G.U, PI = Math.PI, TAU = PI * 2;
  const DIM = { HIP: 62, THIGH: 31, SHIN: 31, FOOT: 12, TORSO: 36, NECK: 6.2, HEAD: 9.6, UARM: 22, FARM: 20, SWORD: 76 };
  // ik: 0..1 blend from authored leg angles to two-bone IK feet targets (fFx/fFy, fBx/fBy, root-local, ground = 0)
  // hold: 0..1 back hand joins the hilt (two-handed grip)
  const DEF = { rx: 0, ry: 0, rot: 0, torso: 0.1, head: 0, tF: 0.2, kF: -0.3, tB: -0.2, kB: -0.2, aF: 0.4, eF: 0.6, aB: -0.1, eB: 0.5, sw: 1.1, glow: 0, ik: 0, fFx: 12, fFy: 0, fBx: -12, fBy: 0, hold: 0 };
  const KEYS = Object.keys(DEF);
  const dir = (a, l) => ({ x: Math.sin(a) * l, y: Math.cos(a) * l });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });

  const Rig = G.Rig = { DIM, DEF };

  Rig.full = (p) => { const o = {}; for (const k of KEYS) o[k] = p[k] ?? DEF[k]; return o; };
  Rig.lerpPose = (a, b, t) => { const o = {}; for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t; return o; };
  Rig.norm = (p) => { const o = Object.assign({}, p); o.rot = Math.atan2(Math.sin(o.rot), Math.cos(o.rot)); return o; };

  const EASE = { lin: (t) => t, io: U.easeInOutSine, out: U.easeOutCubic, snap: (t) => 1 - Math.pow(1 - t, 4), in: U.easeInCubic };
  // anim = { dur, loop?, keys: [[time, pose, ease]] }
  Rig.sample = (anim, t) => {
    const ks = anim.keys;
    if (t <= ks[0][0]) return Rig.full(ks[0][1]);
    for (let i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) {
        const a = ks[i - 1], b = ks[i];
        const k = (EASE[b[2] || 'io'])((t - a[0]) / (b[0] - a[0] || 1));
        return Rig.lerpPose(Rig.full(a[1]), Rig.full(b[1]), k);
      }
    }
    return Rig.full(ks[ks.length - 1][1]);
  };

  // two-bone IK: returns { a: upper abs angle, b: lower relative angle } reaching t from o
  function solve2(o, t, a, b, bend) {
    let dx = t.x - o.x, dy = t.y - o.y;
    const hyp = Math.hypot(dx, dy) || 1, d = U.clamp(hyp, Math.abs(a - b) + 0.5, a + b - 0.05);
    dx = dx / hyp * d; dy = dy / hyp * d;
    const phi = Math.atan2(dx, dy);
    const alpha = Math.acos(U.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    const up = phi + bend * alpha;
    const kx = o.x + Math.sin(up) * a, ky = o.y + Math.cos(up) * a;
    const low = Math.atan2(o.x + dx - kx, o.y + dy - ky);
    let rel = low - up;
    while (rel > PI) rel -= TAU; while (rel < -PI) rel += TAU;
    return { a: up, b: rel, ky };
  }
  Rig.solve2 = solve2;

  Rig.compute = (p) => {
    const hip = { x: p.rx, y: -DIM.HIP + p.ry };
    let tF = p.tF, kF = p.kF, tB = p.tB, kB = p.kB;
    if (p.ik > 0.001) {
      // knees bend forward (+x), feet stay planted on their targets
      const sF = solve2(hip, { x: p.fFx, y: p.fFy }, DIM.THIGH, DIM.SHIN, 1), sB = solve2(hip, { x: p.fBx, y: p.fBy }, DIM.THIGH, DIM.SHIN, 1);
      tF = U.lerp(tF, sF.a, p.ik); kF = U.lerp(kF, sF.b, p.ik); tB = U.lerp(tB, sB.a, p.ik); kB = U.lerp(kB, sB.b, p.ik);
    }
    const kneeF = add(hip, dir(tF, DIM.THIGH)), ankF = add(kneeF, dir(tF + kF, DIM.SHIN));
    const kneeB = add(hip, dir(tB, DIM.THIGH)), ankB = add(kneeB, dir(tB + kB, DIM.SHIN));
    const flat = 0.55 + 0.4 * U.clamp(p.ik, 0, 1);
    const fa = (s, lift) => U.lerp(s + PI / 2, PI / 2, lift < -2 ? 0.45 : flat);
    const toeF = add(ankF, dir(fa(tF + kF, p.fFy), DIM.FOOT)), toeB = add(ankB, dir(fa(tB + kB, p.fBy), DIM.FOOT));
    const chest = { x: hip.x + Math.sin(p.torso) * DIM.TORSO, y: hip.y - Math.cos(p.torso) * DIM.TORSO };
    const sh = { x: hip.x + Math.sin(p.torso) * (DIM.TORSO - 5), y: hip.y - Math.cos(p.torso) * (DIM.TORSO - 5) };
    const ha = p.torso + p.head;
    const head = { x: chest.x + Math.sin(ha) * (DIM.NECK + DIM.HEAD), y: chest.y - Math.cos(ha) * (DIM.NECK + DIM.HEAD) };
    const elF = add(sh, dir(p.aF, DIM.UARM)), hdF = add(elF, dir(p.aF + p.eF, DIM.FARM));
    const shB = { x: sh.x - 2, y: sh.y + 1 };
    let aB = p.aB, eB = p.eB;
    if (p.hold > 0.001) {
      // back hand grips the hilt just below the front hand; pick the elbow-down solution
      const tgt = add(hdF, dir(p.sw, -6.5));
      const s1 = solve2(shB, tgt, DIM.UARM, DIM.FARM, 1), s2 = solve2(shB, tgt, DIM.UARM, DIM.FARM, -1);
      const s = s1.ky > s2.ky ? s1 : s2;
      aB = U.lerp(aB, s.a, p.hold); eB = U.lerp(eB, s.b, p.hold);
    }
    const elB = add(shB, dir(aB, DIM.UARM)), hdB = add(elB, dir(aB + eB, DIM.FARM));
    const tip = add(hdF, dir(p.sw, DIM.SWORD)), pommel = add(hdF, dir(p.sw, -12));
    const J = { hip, kneeF, ankF, toeF, kneeB, ankB, toeB, chest, sh, head, elF, hdF, shB, elB, hdB, tip, pommel, ha, sw: p.sw };
    if (p.rot) {
      const c = Math.cos(p.rot), s = Math.sin(p.rot);
      for (const k in J) {
        const q = J[k]; if (typeof q !== 'object') continue;
        const dx = q.x - hip.x, dy = q.y - hip.y;
        J[k] = { x: hip.x + dx * c - dy * s, y: hip.y + dx * s + dy * c };
      }
      J.ha += p.rot; J.sw += p.rot;
    }
    J.rot = p.rot;
    return J;
  };
  // convert an angle-authored stance into a planted one: feet keep their authored spacing but sit on the ground
  Rig.groundify = (p) => {
    if (p.ik) return p;
    const f = Rig.full(p); f.ik = 0;
    const J = Rig.compute(f);
    return Object.assign({}, p, { ik: 1, fFx: J.ankF.x, fFy: 0, fBx: J.ankB.x, fBy: 0 });
  };

  /* --------- primitive: tapered capsule --------- */
  // Hades-style ink & paint: hard two-tone cel split, purple-tinted shadows, a warm rim on the lit edge,
  // a cool coloured bounce on the shadow edge, bold ink outline and comic hatching in the shade.
  const RAMP = new Map();
  function ramp(hex) {
    let r = RAMP.get(hex);
    if (!r) {
      // dark fabrics keep a dark lit plane (only a thin warm rim); pale materials take more light
      const c = U.hex2rgb(hex), L = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255;
      r = {
        hi: U.mixHex(hex, '#ffe6b8', 0.32 + 0.3 * L),   // rim light
        lit: U.mixHex(hex, '#ffcf96', 0.06 + 0.14 * L),  // sunlit plane
        base: hex,
        dark: U.mixHex(hex, '#2a0e3c', 0.55), // shadow plane (purple)
        bounce: U.mixHex(hex, '#36c6d8', 0.28), // coloured back-light
      };
      RAMP.set(hex, r);
    }
    return r;
  }
  const INK = '#0b0612';
  const OUTLINE = INK;
  // light comes from the upper right of the screen; mirror it when the context is flipped
  function lightDir(ctx) { const a = ctx.getTransform().a; return { x: a < 0 ? -0.62 : 0.62, y: -0.78 }; }
  // hard-stop cel gradient across an axis
  function celGrad(ctx, cx, cy, nx, ny, w, s, r) {
    const g = ctx.createLinearGradient(cx + nx * w * s, cy + ny * w * s, cx - nx * w * s, cy - ny * w * s);
    g.addColorStop(0, r.hi); g.addColorStop(0.1, r.hi); g.addColorStop(0.1, r.lit); g.addColorStop(0.47, r.lit);
    g.addColorStop(0.47, r.dark); g.addColorStop(0.87, r.dark); g.addColorStop(0.87, r.bounce); g.addColorStop(1, r.bounce);
    return g;
  }
  // bulge: { t, f, b } — swell the front (f) / back (b) side at fraction t of the limb (muscle silhouettes)
  function limbPath(ctx, a, b, w1, w2, bulge) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const tn = Math.atan2(ny, nx);
    ctx.beginPath();
    ctx.moveTo(a.x + nx * w1, a.y + ny * w1);
    // quadratic control point that makes the edge pass through the swollen point (≈ at its middle)
    const ctrl = (p0x, p0y, p2x, p2y, qx, qy) => [2 * qx - (p0x + p2x) / 2, 2 * qy - (p0y + p2y) / 2];
    const t = bulge ? bulge.t : 0, mx = a.x + dx * t, my = a.y + dy * t, w = U.lerp(w1, w2, t);
    if (bulge) {
      const [cx, cy] = ctrl(a.x + nx * w1, a.y + ny * w1, b.x + nx * w2, b.y + ny * w2, mx + nx * (w + bulge.f), my + ny * (w + bulge.f));
      ctx.quadraticCurveTo(cx, cy, b.x + nx * w2, b.y + ny * w2);
    } else ctx.lineTo(b.x + nx * w2, b.y + ny * w2);
    ctx.arc(b.x, b.y, w2, tn, tn + PI, true);
    if (bulge) {
      const [cx, cy] = ctrl(b.x - nx * w2, b.y - ny * w2, a.x - nx * w1, a.y - ny * w1, mx - nx * (w + bulge.b), my - ny * (w + bulge.b));
      ctx.quadraticCurveTo(cx, cy, a.x - nx * w1, a.y - ny * w1);
    } else ctx.lineTo(a.x - nx * w1, a.y - ny * w1);
    ctx.arc(a.x, a.y, w1, tn + PI, tn, true);
    ctx.closePath();
    return { nx, ny };
  }
  // tapered capsule; solid hex fills get cel paint + ink outline + hatching (+ optional specular dash)
  function limb(ctx, a, b, w1, w2, fill, opt) {
    const { nx, ny } = limbPath(ctx, a, b, w1, w2, opt && opt.bulge);
    if (!fill) return;
    if (typeof fill === 'string' && fill.length === 7 && fill[0] === '#' && Rig.shade) {
      const r = ramp(fill), Ld = lightDir(ctx);
      const s = nx * Ld.x + ny * Ld.y >= 0 ? 1 : -1, w = Math.max(w1, w2);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.fillStyle = celGrad(ctx, mx, my, nx, ny, w, s, r); ctx.fill();
      if (!opt || opt.outline !== false) { ctx.strokeStyle = INK; ctx.lineWidth = 0.8 + Math.min(w, 9) * 0.06; ctx.lineJoin = 'round'; ctx.stroke(); }
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if (Rig.hatch && w >= 2.6 && L > 10 && !(opt && opt.noHatch)) {
        // short diagonal ink strokes across the shadow plane
        const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
        ctx.strokeStyle = 'rgba(14,4,22,0.55)'; ctx.lineWidth = 0.38; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let t = 0.25; t <= 0.75; t += 0.16) {
          const ww = U.lerp(w1, w2, t), px = a.x + (b.x - a.x) * t - nx * s * ww * 0.3, py = a.y + (b.y - a.y) * t - ny * s * ww * 0.3;
          ctx.moveTo(px, py); ctx.lineTo(px + ux * 1.8 - nx * s * ww * 0.5, py + uy * 1.8 - ny * s * ww * 0.5);
        }
        ctx.stroke();
      }
      if (opt && opt.spec) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(255,250,236,${Math.min(1, opt.spec * 1.3)})`; ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(a.x + nx * w1 * 0.58 * s + (b.x - a.x) * 0.18, a.y + ny * w1 * 0.58 * s + (b.y - a.y) * 0.18);
        ctx.lineTo(a.x + nx * w2 * 0.58 * s + (b.x - a.x) * 0.55, a.y + ny * w2 * 0.58 * s + (b.y - a.y) * 0.55);
        ctx.stroke();
      }
    } else { ctx.fillStyle = fill; ctx.fill(); }
  }
  Rig.hatch = true;
  Rig.INK = INK;
  Rig.celGrad = celGrad;  Rig.shade = true;
  Rig.limb = limb;
  Rig.ramp = ramp;
  Rig.lightDir = lightDir;
  // hero limbs: shaded with a glossy streak (rim colour kept for API compatibility)
  function limbLit(ctx, a, b, w1, w2, base, rim, spec = 0.35, bulge) {
    limb(ctx, a, b, w1, w2, base, { spec, bulge });
  }
  // muscle silhouettes (n-side = back of a downward limb)
  const THIGH = { t: 0.35, f: 0.6, b: 1.1 }, CALF = { t: 0.3, f: 1.2, b: 0.2 }, FOREARM = { t: 0.3, f: 0.5, b: 0.4 }, UPPERARM = { t: 0.4, f: 0.3, b: 0.4 };
  const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  /* --------- hair (verlet chain, world space) --------- */
  class Chain {
    constructor(n, seg, stiff = 0.08, damp = 0.9) { this.n = n; this.seg = seg; this.stiff = stiff; this.damp = damp; this.p = []; this.inited = false; }
    reset(x, y) { this.p = Array.from({ length: this.n }, (_, i) => ({ x: x - i * this.seg, y: y + i * 2, px: x - i * this.seg, py: y + i * 2 })); this.inited = true; }
    update(ax, ay, facing, dt, wind = 0, restAng = 2.3) {
      if (!this.inited) {
        // start already hanging along the rest direction (no one-frame horizontal plank)
        this.reset(ax, ay);
        const rx = -facing * Math.sin(restAng), ry = -Math.cos(restAng);
        this.p.forEach((q, i) => { q.x = q.px = ax + rx * this.seg * i; q.y = q.py = ay + ry * this.seg * i; });
      }
      const P = this.p, g = 900 * dt * dt;
      P[0].x = ax; P[0].y = ay; P[0].px = ax; P[0].py = ay;
      for (let i = 1; i < this.n; i++) {
        const q = P[i];
        const vx = (q.x - q.px) * this.damp, vy = (q.y - q.py) * this.damp;
        q.px = q.x; q.py = q.y;
        q.x += vx + wind * dt * dt * (0.5 + i / this.n); q.y += vy + g;
      }
      const rd = { x: -facing * Math.sin(restAng), y: -Math.cos(restAng) };
      for (let it = 0; it < 3; it++) {
        for (let i = 1; i < this.n; i++) {
          const a = P[i - 1], b = P[i];
          // shape memory
          const tx = a.x + rd.x * this.seg, ty = a.y + rd.y * this.seg;
          const st = this.stiff * (1 - i / this.n * 0.6);
          b.x += (tx - b.x) * st; b.y += (ty - b.y) * st;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, diff = (d - this.seg) / d;
          b.x -= dx * diff; b.y -= dy * diff;
        }
      }
    }
  }
  Rig.Chain = Chain;

  function ribbon(ctx, pts, w0, w1, fill, bulge = 0) {
    if (pts.length < 2) return;
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const u = i / (pts.length - 1);
      const w = U.lerp(w0, w1, u) + bulge * Math.sin(Math.min(1, u * 1.6) * PI);
      L.push({ x: pts[i].x - dy / d * w, y: pts[i].y + dx / d * w }); R.push({ x: pts[i].x + dy / d * w, y: pts[i].y - dx / d * w });
    }
    ctx.beginPath(); ctx.moveTo(L[0].x, L[0].y);
    for (let i = 1; i < L.length; i++) { const m = lerpP(L[i - 1], L[i], 0.5); ctx.quadraticCurveTo(L[i - 1].x, L[i - 1].y, m.x, m.y); }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    for (let i = R.length - 1; i > 0; i--) { const m = lerpP(R[i], R[i - 1], 0.5); ctx.quadraticCurveTo(R[i].x, R[i].y, m.x, m.y); }
    ctx.lineTo(R[0].x, R[0].y); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  }
  Rig.ribbon = ribbon;

  /* --------- palette --------- */
  const C = {
    suit: '#16171d', suitB: '#0d0e12', suitRim: '#4b4f5e', armor: '#ecebe6', armorB: '#a3a7b0', armorRim: '#ffffff', armorShade: '#b9bcc4',
    cyan: '#6ff3ff', skin: '#ecc9b6', skinS: '#c99a88', hair: '#e3e5ec', hairS: '#a2a6b8', hairD: '#5f6378', boot: '#e4e2dc', bootB: '#9a9ea6',
    // swordswoman outfit: long navy duster with crimson lining and gold trim, bone shirt, wine vest, leather boots, crimson scarf
    coat: '#26305c', coatB: '#1a2142', lining: '#9a2438', gold: '#e2b04f', shirt: '#ece4d6', shirtB: '#c9bfae',
    vest: '#6a1f35', pants: '#24223a', pantsB: '#191828', leather: '#7a4a30', leatherB: '#583421', glove: '#3a2a22', scarf: '#d43b3f', scarfD: '#8e1f2c',
  };
  Rig.C = C;

  /* --------- the hero: RINNE --------- */
  // h: { hair: Chain, rib1: Chain, rib2: Chain } in world coords
  const poly = (ctx, pts, close = true) => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); if (close) ctx.closePath(); };
  const smooth = (ctx, pts) => {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1], b = pts[i % pts.length], m = lerpP(a, b, 0.5); ctx.quadraticCurveTo(a.x, a.y, m.x, m.y); }
    ctx.closePath();
  };
  // gradient across an axis (from lit side to shadow side)
  const sideGrad = (ctx, c, nx, ny, w, r) => {
    const Ld = lightDir(ctx), s = nx * Ld.x + ny * Ld.y >= 0 ? 1 : -1;
    return celGrad(ctx, c.x, c.y, nx, ny, w, s, r);
  };
  // bold ink line (Hades-weight); thin calls are scaled up so every shape keeps a readable contour
  const ink = (ctx, w = 0.65) => { ctx.strokeStyle = INK; ctx.lineWidth = Math.max(0.7, w * 1.9); ctx.lineJoin = 'round'; ctx.stroke(); };
  const glowLine = (ctx, a, b, col, w = 0.9, alpha = 0.85) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = U.rgba(col, alpha * 0.35); ctx.lineWidth = w * 3.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = U.rgba(col, alpha); ctx.lineWidth = w; ctx.stroke();
    ctx.restore();
  };

  // Hades-style ponytail: chunky banded shapes, bold ink contour, a few heavy strand lines, sharp highlights
  function drawPonytail(ctx, hp, rib) {
    const n = hp.length;
    ribbon(ctx, hp, 5.4, 0.8, '#4a4472', 2.8);                 // shadow mass (purple)
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.lineJoin = 'round'; ctx.stroke();
    ribbon(ctx, hp.map((q) => ({ x: q.x + 0.7, y: q.y - 1.0 })), 3.8, 0.5, '#b8bbd6', 2.0);  // lit band
    ribbon(ctx, hp.map((q) => ({ x: q.x + 1.3, y: q.y - 1.7 })), 1.5, 0.2, '#f4f5fb', 0.9);  // highlight band
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
    for (const off of [-1.4, 0.6]) {
      ctx.beginPath();
      hp.forEach((q, i) => { const u = i / (n - 1); if (u < 0.15 || u > 0.85) return; const k = Math.sin(u * PI); const px = q.x + off * k, py = q.y + off * 0.35 * k; ctx.lineTo(px, py); });
      ctx.stroke();
    }
    // hard white glints on the lit band
    ctx.fillStyle = '#ffffff';
    for (const u of [0.22, 0.42]) {
      const i = Math.floor(u * (n - 1)), q = hp[i], q2 = hp[Math.min(n - 1, i + 1)];
      const dx = q2.x - q.x, dy = q2.y - q.y, d = Math.hypot(dx, dy) || 1;
      ctx.beginPath(); ctx.moveTo(q.x + 1.6, q.y - 2.0); ctx.lineTo(q.x + 1.6 + dx / d * 5, q.y - 2.0 + dy / d * 5); ctx.lineTo(q.x + 1.0 + dx / d * 2, q.y - 1.0 + dy / d * 2); ctx.fill();
    }
    // spiky tips
    const t = hp[n - 1], p = hp[n - 3];
    ctx.fillStyle = '#4a4472'; ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
    for (const sp of [-0.55, 0.5]) {
      const dx = t.x - p.x, dy = t.y - p.y;
      ctx.beginPath(); ctx.moveTo(p.x - dy * 0.2, p.y + dx * 0.2); ctx.lineTo(t.x + dx * 0.55 - dy * sp, t.y + dy * 0.55 + dx * sp); ctx.lineTo(p.x + dy * 0.2, p.y - dx * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // crimson cloth ribbons tied into the hair (match the scarf)
    for (const r of rib) {
      if (!r) continue;
      ribbon(ctx, r, 1.9, 1.2, C.scarfD); ink(ctx, 0.4);
      ribbon(ctx, r.map((q) => ({ x: q.x + 0.3, y: q.y - 0.5 })), 1.0, 0.5, C.scarf);
    }
  }

  // Hades-style head: angular profile, two-tone skin with a hard terminator, heavy liner, glowing iris
  function drawHead(ctx, hc, ha, flash) {
    ctx.save(); ctx.translate(hc.x, hc.y); ctx.rotate(ha); ctx.scale(1.08, 1.08);
    const facePath = () => {
      ctx.beginPath();
      ctx.moveTo(-0.6, -9.3);
      ctx.bezierCurveTo(3.8, -9.6, 7.2, -7.2, 7.7, -3.6);
      ctx.lineTo(7.9, -2.4); ctx.lineTo(7.6, -1.7);
      ctx.lineTo(10.3, 1.6); ctx.lineTo(8.7, 2.3);            // angular nose
      ctx.lineTo(9.0, 3.3); ctx.lineTo(8.4, 3.9); ctx.lineTo(8.8, 4.8);
      ctx.lineTo(8.0, 5.6); ctx.lineTo(8.3, 6.9);              // chin
      ctx.lineTo(6.6, 8.5); ctx.lineTo(0.8, 7.9);              // sharp jaw
      ctx.lineTo(-1.6, 4.4); ctx.lineTo(-1.6, -6); ctx.closePath();
    };
    // hair mass behind
    ctx.beginPath();
    ctx.moveTo(-0.5, -10.4); ctx.bezierCurveTo(-6.5, -11.2, -11.6, -7.5, -11.4, -2.6);
    ctx.bezierCurveTo(-11.3, 1.8, -10.2, 4.6, -8.6, 6.2); ctx.lineTo(-3.2, 6.6); ctx.lineTo(-1.2, -1); ctx.closePath();
    ctx.fillStyle = '#4a4472'; ctx.fill(); ink(ctx, 0.7);
    // skin: lit plane, then the shadow plane cut along the cheek
    facePath(); ctx.fillStyle = '#f3c9ab'; ctx.fill();
    ctx.save(); facePath(); ctx.clip();
    ctx.fillStyle = '#b77a78';
    ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(3.4, -4); ctx.quadraticCurveTo(4.6, 1.6, 3.2, 5.6); ctx.lineTo(7.4, 6.4); ctx.lineTo(7, 9.5); ctx.lineTo(-2, 9.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,220,0.9)'; ctx.beginPath(); ctx.moveTo(8.0, -0.9); ctx.lineTo(9.6, 1.3); ctx.lineTo(8.9, 1.3); ctx.closePath(); ctx.fill(); // nose glint
    ctx.restore();
    facePath(); ink(ctx, 0.7);
    // lips
    ctx.fillStyle = '#b8505e'; ctx.beginPath(); ctx.moveTo(8.8, 3.1); ctx.lineTo(8.4, 3.9); ctx.lineTo(8.7, 4.7); ctx.lineTo(8.0, 4.4); ctx.lineTo(8.1, 3.4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(8.4, 3.9); ctx.lineTo(7.6, 4.0); ctx.stroke();
    // eye: heavy upper liner sweeping into a wing, glowing resonant iris
    ctx.fillStyle = '#efe6e6'; ctx.beginPath(); ctx.moveTo(5.3, -1.2); ctx.quadraticCurveTo(6.4, -2.0, 7.5, -1.3); ctx.lineTo(6.7, -0.6); ctx.lineTo(5.6, -0.8); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const ig = ctx.createRadialGradient(6.95, -1.15, 0, 6.95, -1.15, 2.6); ig.addColorStop(0, U.rgba(C.cyan, 0.9)); ig.addColorStop(1, U.rgba(C.cyan, 0));
    ctx.fillStyle = ig; ctx.fillRect(4, -4, 6, 6);
    ctx.restore();
    ctx.fillStyle = '#3fd8ea'; ctx.beginPath(); ctx.ellipse(6.95, -1.15, 0.55, 0.65, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8ffff'; ctx.beginPath(); ctx.arc(7.05, -1.25, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath();
    ctx.moveTo(5.0, -1.0); ctx.quadraticCurveTo(6.3, -2.35, 7.7, -1.45); ctx.lineTo(8.7, -2.1); ctx.lineTo(7.6, -1.0); ctx.quadraticCurveTo(6.4, -1.75, 5.3, -0.75); ctx.closePath(); ctx.fill();
    // brow: a single angular stroke
    ctx.fillStyle = '#3a3550'; ctx.beginPath(); ctx.moveTo(4.4, -3.4); ctx.lineTo(7.9, -3.9); ctx.lineTo(8.1, -3.4); ctx.lineTo(4.6, -2.95); ctx.closePath(); ctx.fill();
    // hair: crown in three hard bands with ink strand cuts
    const crown = () => {
      ctx.beginPath();
      ctx.moveTo(-11.4, -2.6); ctx.bezierCurveTo(-11.8, -9.8, -5.5, -12.6, 0.8, -12.1);
      ctx.bezierCurveTo(5.8, -11.7, 9.0, -9.2, 9.4, -5.6);
      ctx.lineTo(7.0, -7.0); ctx.lineTo(4.6, -6.0); ctx.lineTo(2.6, -7.2); ctx.lineTo(1.0, -4.0); ctx.lineTo(-0.4, 1.2); ctx.lineTo(-4.6, -1.6); ctx.closePath();
    };
    crown(); ctx.fillStyle = '#b8bbd6'; ctx.fill();
    ctx.save(); crown(); ctx.clip();
    ctx.fillStyle = '#5a5488'; ctx.beginPath(); ctx.moveTo(-12, -4); ctx.quadraticCurveTo(-5, -6, 1, 2); ctx.lineTo(-12, 4); ctx.closePath(); ctx.fill();   // shadow band
    ctx.fillStyle = '#f4f5fb'; ctx.beginPath(); ctx.moveTo(-6, -11.6); ctx.quadraticCurveTo(0, -12.6, 6, -10.6); ctx.lineTo(4.5, -9.4); ctx.quadraticCurveTo(0, -10.8, -5, -9.8); ctx.closePath(); ctx.fill(); // highlight band
    ctx.restore();
    crown(); ink(ctx, 0.75);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(6.5, -8.6); ctx.quadraticCurveTo(-1, -10, -8.5, -6.2); ctx.moveTo(3.2, -6.8); ctx.quadraticCurveTo(-3, -7.6, -9.2, -3.2); ctx.stroke();
    // angular bangs
    const lock = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fillStyle = '#c9cce2'; ctx.fill(); ink(ctx, 0.55); };
    lock([[3.6, -11.2], [8.9, -8.2], [9.1, -4.3], [7.0, -7.0]]);
    lock([[2.2, -10.6], [6.4, -6.0], [6.2, -2.4], [4.6, -6.0]]);
    lock([[0.6, -10.2], [3.4, -5.4], [2.4, -1.6], [1.4, -5.6]]);
    lock([[0.2, -6.2], [2.8, 1.8], [1.6, 10.6], [-0.4, 1.0]]); // side lock
    // ear (a person, not a headset) + gold hair clasp
    ctx.fillStyle = '#e8b89c'; ctx.beginPath(); ctx.ellipse(-0.9, 1.6, 1.6, 2.4, 0.2, 0, TAU); ctx.fill(); ink(ctx, 0.4);
    ctx.strokeStyle = '#b77a78'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(-0.7, 1.7, 0.9, -1.2, 1.4); ctx.stroke();
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(-1.1, 4.4, 0.75, 0, TAU); ctx.fill(); // earring
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.ellipse(-9.6, -5.6, 1.6, 2.6, -0.5, 0, TAU); ctx.fill(); ink(ctx, 0.45);
    ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(-9.2, -6.4, 0.5, 0, TAU); ctx.fill();
    if (flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(C.cyan, flash * 0.3); ctx.beginPath(); ctx.arc(5, -1, 6, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }

  // torso frame: s runs hip→chest (0..1), f is the side offset (+ = facing side)
  const torsoQ = (J) => {
    const tA = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x);
    const ux = Math.cos(tA), uy = Math.sin(tA), nx = -uy, ny = ux;
    const Q = (s, f) => ({ x: J.hip.x + ux * s * DIM.TORSO + nx * f, y: J.hip.y + uy * s * DIM.TORSO + ny * f });
    return { Q, nx, ny };
  };
  // where the cloth chains hang from (local, facing-relative): coat back/front tails and the scarf tail
  Rig.clothAnchors = (J) => { const { Q } = torsoQ(J); return { coatB: Q(0.04, -8.6), coatF: Q(0.02, 6.4), scarf: Q(1.0, -5.2) }; };
  Rig.CLOTH = { coatB: [6, 8.6, 0.09, 0.86, 2.86], coatF: [4, 7.4, 0.1, 0.86, 3.24], scarf: [7, 6.2, 0.035, 0.9, 2.05] };
  // static fallback (portraits, first frame): hang straight from the anchor along the rest angle
  const restPts = (a, spec) => Array.from({ length: spec[0] }, (_, i) => ({ x: a.x - Math.sin(spec[4]) * spec[1] * i, y: a.y - Math.cos(spec[4]) * spec[1] * i }));
  // shift a chain sideways along its own normal (k may vary along the chain)
  const offsetPts = (pts, k) => pts.map((q, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, kk = typeof k === 'function' ? k(i / (pts.length - 1)) : k;
    return { x: q.x - dy / d * kk, y: q.y + dx / d * kk };
  });
  const polyline = (ctx, pts) => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); };
  // cloth panel along a chain: cel-painted face, lining showing on the trailing edge, ink folds, gold hem
  function clothPanel(ctx, pts, w0, w1, col, lining, hem) {
    const n = pts.length, mid = pts[n >> 1];
    const wAt = (u) => U.lerp(w0, w1, u);
    if (lining) { ribbon(ctx, offsetPts(pts, (u) => -wAt(u) * 0.55), wAt(0) * 0.5, wAt(1) * 0.55, lining); }
    ribbon(ctx, pts, w0, w1, sideGrad(ctx, mid, 1, 0, Math.max(w0, w1), ramp(col)));
    ink(ctx, 0.6);
    ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 0.55; ctx.lineCap = 'round';
    for (const k of [0.32, -0.28]) { const f = offsetPts(pts, (u) => wAt(u) * k).slice(1, n - 1); if (f.length > 1) { polyline(ctx, f); ctx.stroke(); } }
    if (hem) {
      const a = pts[n - 2], b = pts[n - 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = w1 * 0.95;
      ctx.strokeStyle = hem; ctx.lineWidth = 1.3; ctx.beginPath();
      ctx.moveTo(b.x - dy / d * w - dx / d * 1.2, b.y + dx / d * w - dy / d * 1.2); ctx.lineTo(b.x + dy / d * w - dx / d * 1.2, b.y - dx / d * w - dy / d * 1.2); ctx.stroke();
    }
  }
  // one continuous limb through several joints (no outline ring at the knee/elbow — drawn like an illustration, not a doll)
  function limbChain(ctx, pts, ws, col, opt = {}) {
    const n = pts.length, Lp = [], Rp = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      Lp.push({ x: pts[i].x - dy / d * ws[i], y: pts[i].y + dx / d * ws[i] }); Rp.push({ x: pts[i].x + dy / d * ws[i], y: pts[i].y - dx / d * ws[i] });
    }
    const t0 = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x), t1 = Math.atan2(pts[n - 1].y - pts[n - 2].y, pts[n - 1].x - pts[n - 2].x);
    ctx.beginPath(); ctx.moveTo(Lp[0].x, Lp[0].y);
    for (let i = 1; i < n - 1; i++) { const m = lerpP(Lp[i], Lp[i + 1], 0.5); ctx.quadraticCurveTo(Lp[i].x, Lp[i].y, i === n - 2 ? Lp[n - 1].x : m.x, i === n - 2 ? Lp[n - 1].y : m.y); }
    if (n === 2) ctx.lineTo(Lp[1].x, Lp[1].y);
    ctx.arc(pts[n - 1].x, pts[n - 1].y, ws[n - 1], t1 + PI / 2, t1 - PI / 2, true);
    for (let i = n - 2; i > 0; i--) { const m = lerpP(Rp[i], Rp[i - 1], 0.5); ctx.quadraticCurveTo(Rp[i].x, Rp[i].y, i === 1 ? Rp[0].x : m.x, i === 1 ? Rp[0].y : m.y); }
    if (n === 2) ctx.lineTo(Rp[0].x, Rp[0].y);
    ctx.arc(pts[0].x, pts[0].y, ws[0], t0 - PI / 2, t0 + PI / 2, true);
    ctx.closePath();
    // cel paint across the limb's overall axis
    const a = pts[0], b = pts[n - 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
    const Ld = lightDir(ctx), s = nx * Ld.x + ny * Ld.y >= 0 ? 1 : -1, w = Math.max(...ws);
    // the cel bands must span the whole bent limb, or the clamped ends paint it rim-coloured
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    let ext = w; for (let i = 0; i < n; i++) ext = Math.max(ext, Math.abs((pts[i].x - cx) * nx + (pts[i].y - cy) * ny) + ws[i]);
    ctx.fillStyle = celGrad(ctx, cx, cy, nx, ny, ext, s, ramp(col)); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.8 + Math.min(w, 9) * 0.06; ctx.lineJoin = 'round'; ctx.stroke();
    if (opt.spec) {
      ctx.strokeStyle = `rgba(255,250,236,${opt.spec})`; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
      const p = (i, k) => ({ x: pts[i].x + (Lp[i].x - pts[i].x) * k * s, y: pts[i].y + (Lp[i].y - pts[i].y) * k * s });
      ctx.beginPath(); const q0 = lerpP(p(0, 0.55), p(1, 0.55), 0.3), q1 = lerpP(p(0, 0.55), p(1, 0.55), 0.8); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
    }
  }
  Rig.limbChain = limbChain;
  // gloved hand closed around the grip
  function fist(ctx, J, sw, col) {
    const fx = J.x, fy = J.y, sd = { x: Math.sin(sw), y: Math.cos(sw) };
    limb(ctx, { x: fx - sd.x * 2.3, y: fy - sd.y * 2.3 }, { x: fx + sd.x * 2.5, y: fy + sd.y * 2.5 }, 2.8, 2.5, col, { spec: 0.25, noHatch: true });
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 0.45;
    for (const k of [-1.2, 0, 1.2]) { ctx.beginPath(); ctx.arc(fx + sd.x * k, fy + sd.y * k, 2.3, -0.4, 0.9); ctx.stroke(); }
  }

  Rig.drawRinne = (ctx, x, y, facing, pose, h, opts = {}) => {
    const J = Rig.compute(pose);
    ctx.save();
    ctx.translate(x, y); ctx.scale(facing, 1);
    const toL = (q) => ({ x: (q.x - x) * facing, y: q.y - y });
    const flash = opts.flash || 0;
    const { Q, nx, ny } = torsoQ(J);
    const anc = Rig.clothAnchors(J);
    const cloth = (k) => (h && h[k] && h[k].inited ? h[k].p.map(toL) : restPts(anc[k], Rig.CLOTH[k]));

    // --- scarf tail + ponytail (behind everything) ---
    clothPanel(ctx, cloth('scarf'), 2.7, 1.5, C.scarf, C.scarfD, null);
    if (h && h.hair && h.hair.inited) {
      const rib = [h.rib1, h.rib2].filter((r) => r && r.inited).map((r) => r.p.map(toL));
      drawPonytail(ctx, h.hair.p.map(toL), rib);
    }
    // --- back arm: shirt sleeve, leather bracer, glove ---
    limbChain(ctx, [J.shB, J.elB, J.hdB], [3.9, 3.0, 2.3], C.shirtB);
    limb(ctx, lerpP(J.elB, J.hdB, 0.38), lerpP(J.elB, J.hdB, 0.9), 3.2, 2.7, C.leatherB, { spec: 0.2 });
    limb(ctx, J.hdB, lerpP(J.elB, J.hdB, 1.14), 2.6, 2.2, C.glove, { noHatch: true });
    // --- back leg: trousers + tall boot ---
    limbChain(ctx, [J.hip, lerpP(J.hip, J.kneeB, 0.45), J.kneeB, lerpP(J.kneeB, J.ankB, 0.35), J.ankB], [7.2, 6.3, 4.3, 4.3, 2.7], C.pantsB);
    limb(ctx, lerpP(J.kneeB, J.ankB, 0.3), J.ankB, 4.4, 3.0, C.leatherB, { spec: 0.3 });
    limb(ctx, J.ankB, J.toeB, 3.1, 2.0, C.leatherB);
    // --- coat back panel: hangs behind the near leg, sweeps out when she runs ---
    clothPanel(ctx, cloth('coatB'), 6.4, 11.5, C.coatB, C.lining, C.gold);

    // --- torso: wine vest over a bone shirt ---
    const mid = Q(0.5, 0);
    const pts = [Q(-0.05, -9.4), Q(0.22, -7.0), Q(0.5, -5.8), Q(0.9, -7.6), Q(1.06, -4), Q(1.08, 3.5), Q(0.88, 8.6), Q(0.72, 9.2), Q(0.54, 5.8), Q(0.32, 5.6), Q(0.06, 8.6), Q(-0.1, 6.4)];
    smooth(ctx, pts);
    ctx.fillStyle = sideGrad(ctx, mid, nx, ny, 10, ramp(C.vest)); ctx.fill(); ink(ctx, 0.75);
    // shirt front + collar showing at the neckline
    smooth(ctx, [Q(0.78, 3.0), Q(1.04, 3.4), Q(1.08, 6.4), Q(0.9, 8.0)]);
    ctx.fillStyle = sideGrad(ctx, Q(0.95, 5), nx, ny, 3, ramp(C.shirt)); ctx.fill(); ink(ctx, 0.45);
    // vest buttons + princess seam
    ctx.fillStyle = C.gold;
    for (const s of [0.3, 0.46, 0.62]) { const b = Q(s, 5.4 + s * 1.2); ctx.beginPath(); ctx.arc(b.x, b.y, 0.85, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.5; poly(ctx, [Q(0.12, 2.5), Q(0.5, 1.2), Q(0.8, 3.0)], false); ctx.stroke();
    // coat body: covers the back of the torso, open at the front; crimson lapel, gold edge
    const coat = [Q(-0.08, -10.6), Q(0.3, -8.4), Q(0.62, -7.6), Q(0.95, -8.8), Q(1.1, -5.5), Q(1.12, -1.0), Q(1.0, 2.8), Q(0.7, 3.6), Q(0.4, 2.2), Q(0.12, 2.6), Q(-0.06, 2.0)];
    smooth(ctx, coat);
    ctx.fillStyle = sideGrad(ctx, Q(0.5, -4), nx, ny, 9, ramp(C.coat)); ctx.fill(); ink(ctx, 0.75);
    poly(ctx, [Q(1.0, 2.8), Q(0.7, 3.6), Q(0.62, 1.2), Q(0.9, 0.6)]); ctx.fillStyle = C.lining; ctx.fill(); ink(ctx, 0.45);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 0.8; poly(ctx, [Q(1.0, 2.9), Q(0.7, 3.7), Q(0.4, 2.3), Q(0.12, 2.7), Q(-0.06, 2.1)], false); ctx.stroke();
    ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 0.55; poly(ctx, [Q(0.15, -6.5), Q(0.55, -4.6), Q(0.88, -5.6)], false); ctx.stroke();
    // tall stand collar behind the neck
    limb(ctx, Q(0.96, -6.6), Q(1.2, -5.0), 2.6, 2.3, C.coat, { noHatch: true });
    ctx.strokeStyle = C.gold; ctx.lineWidth = 0.6; poly(ctx, [Q(1.22, -6.9), Q(1.24, -3.6)], false); ctx.stroke();
    // belt with a resonant gem buckle (the only glow on her body)
    limb(ctx, Q(0.08, -10.2), Q(0.08, 8.4), 2.3, 2.3, C.leatherB, { noHatch: true });
    const bk = Q(0.08, 6.2);
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.ellipse(bk.x, bk.y, 2.0, 2.4, 0, 0, TAU); ctx.fill(); ink(ctx, 0.45);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gr = 4 + pose.glow * 10;
    const cg = ctx.createRadialGradient(bk.x, bk.y, 0, bk.x, bk.y, gr);
    cg.addColorStop(0, U.rgba(C.cyan, 0.9)); cg.addColorStop(0.35, U.rgba(C.cyan, 0.25)); cg.addColorStop(1, U.rgba(C.cyan, 0));
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(bk.x, bk.y, gr, 0, TAU); ctx.fill();
    ctx.restore();

    // --- front leg ---
    limbChain(ctx, [J.hip, lerpP(J.hip, J.kneeF, 0.45), J.kneeF, lerpP(J.kneeF, J.ankF, 0.35), J.ankF], [7.8, 6.8, 4.6, 4.6, 2.9], C.pants, { spec: 0.3 });
    limb(ctx, lerpP(J.kneeF, J.ankF, 0.28), J.ankF, 4.8, 3.2, C.leather, { spec: 0.45 });
    // boot cuff (folded top) + strap
    limb(ctx, lerpP(J.kneeF, J.ankF, 0.24), lerpP(J.kneeF, J.ankF, 0.36), 5.2, 5.0, C.leatherB, { noHatch: true });
    limb(ctx, lerpP(J.kneeF, J.ankF, 0.68), lerpP(J.kneeF, J.ankF, 0.74), 4.0, 3.9, C.leatherB, { noHatch: true });
    limb(ctx, J.ankF, J.toeF, 3.5, 2.2, C.leather);
    { const a = J.ankF, b = J.toeF, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(a.x - dx / d * 2 + dy / d * 3, a.y - dy / d * 2 - dx / d * 3); ctx.lineTo(b.x + dy / d * 2, b.y - dx / d * 2); ctx.stroke(); }
    // --- coat front flap over the near thigh ---
    clothPanel(ctx, cloth('coatF'), 3.0, 5.6, C.coat, C.lining, C.gold);

    // --- neck, scarf wrap, head ---
    limb(ctx, J.chest, lerpP(J.chest, J.head, 0.55), 3.1, 2.9, C.skinS, { noHatch: true });
    limb(ctx, Q(1.0, -4.6), Q(1.1, 4.2), 3.1, 2.9, C.scarf, { noHatch: true });
    ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.5; poly(ctx, [Q(0.97, -2), Q(1.12, 1.6)], false); ctx.stroke();
    drawHead(ctx, J.head, J.ha, flash);

    // --- sword ---
    drawBlade(ctx, J, pose, opts);
    // --- front arm: puffed shirt sleeve, coat armhole, rolled cuff, bracer, glove ---
    limbChain(ctx, [J.sh, lerpP(J.sh, J.elF, 0.5), J.elF, J.hdF], [4.2, 4.0, 3.1, 2.4], C.shirt, { spec: 0.35 });
    ctx.beginPath(); ctx.ellipse(J.sh.x - 0.6, J.sh.y + 0.6, 4.8, 4.0, -0.3, 0, TAU);
    ctx.fillStyle = sideGrad(ctx, J.sh, 0.6, -0.8, 4.8, ramp(C.coat)); ctx.fill(); ink(ctx, 0.6);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(J.sh.x - 0.6, J.sh.y + 0.6, 3.6, 0.2, 1.6); ctx.stroke();
    limb(ctx, lerpP(J.elF, J.hdF, 0.1), lerpP(J.elF, J.hdF, 0.26), 3.6, 3.4, C.shirtB, { noHatch: true }); // rolled cuff
    limb(ctx, lerpP(J.elF, J.hdF, 0.36), lerpP(J.elF, J.hdF, 0.9), 3.4, 2.8, C.leather, { spec: 0.45 });
    ctx.strokeStyle = C.gold; ctx.lineWidth = 0.5; poly(ctx, [lerpP(J.elF, J.hdF, 0.52), lerpP(J.elF, J.hdF, 0.74)], false); ctx.stroke();
    fist(ctx, J.hdF, pose.sw, C.glove);

    // hit flash overlay
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flash * 0.6;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(J.hip.x, J.hip.y - 20, 22, 50, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    return J;
  };

  function drawBlade(ctx, J, pose, opts) {
    // equipped weapon class sets blade length / width, its affinity tints the resonant edge (js/gear.js)
    const bl = opts.blade || null, lm = bl ? bl.len : 1, wm = bl ? bl.w : 1, edge = (bl && bl.col) || C.cyan;
    const b = J.hdF, pm = J.pommel, t = lm === 1 ? J.tip : { x: b.x + (J.tip.x - b.x) * lm, y: b.y + (J.tip.y - b.y) * lm };
    const dx = t.x - b.x, dy = t.y - b.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    // grip
    limb(ctx, pm, b, 1.6, 1.8, '#23252c');
    // guard (thin crossbar)
    limb(ctx, { x: b.x + nx * 4.5, y: b.y + ny * 4.5 }, { x: b.x - nx * 4.5, y: b.y - ny * 4.5 }, 1.2, 1.2, '#cfd3da');
    // blade
    const s = { x: b.x + dx / L * 3, y: b.y + dy / L * 3 };
    ctx.beginPath();
    ctx.moveTo(s.x + nx * 2.1 * wm, s.y + ny * 2.1 * wm);
    ctx.lineTo(t.x - dx / L * 8 + nx * 1.6 * wm, t.y - dy / L * 8 + ny * 1.6 * wm);
    ctx.lineTo(t.x, t.y);
    ctx.lineTo(s.x - nx * 1.3 * wm, s.y - ny * 1.3 * wm);
    ctx.closePath();
    const gr = ctx.createLinearGradient(s.x + nx * 2, s.y + ny * 2, s.x - nx * 2, s.y - ny * 2);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#b9c3cf'); gr.addColorStop(1, '#5d6673');
    ctx.fillStyle = gr; ctx.fill();
    // resonant edge glow
    const glow = 0.45 + (pose.glow || 0) * 0.55 + (opts.bladeGlow || 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = U.rgba(edge, Math.min(1, glow)); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(s.x - nx * 1.2, s.y - ny * 1.2); ctx.lineTo(t.x, t.y); ctx.stroke();
    if (glow > 0.5) {
      ctx.strokeStyle = U.rgba(edge, (glow - 0.5) * 0.5); ctx.lineWidth = 6 * wm;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke();
    }
    // resonance strings (fine lines)
    ctx.strokeStyle = U.rgba('#e6fdff', 0.35); ctx.lineWidth = 0.4;
    for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.moveTo(s.x + nx * i * 0.6, s.y + ny * i * 0.6); ctx.lineTo(t.x - dx / L * 14 + nx * i * 0.5, t.y - dy / L * 14 + ny * i * 0.5); ctx.stroke(); }
    ctx.restore();
  }

  /* --------- ghost silhouette (afterimage) --------- */
  Rig.drawGhost = (ctx, snap, col, alpha) => {
    if (alpha <= 0.01) return;
    const J = Rig.compute(snap.pose);
    ctx.save(); ctx.translate(snap.x, snap.y); ctx.scale(snap.facing, 1);
    ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'lighter';
    const c = U.rgba(col, 0.55);
    limb(ctx, J.hip, J.kneeB, 6, 4.5, c); limb(ctx, J.kneeB, J.ankB, 4.5, 3, c);
    limb(ctx, J.hip, J.chest, 8, 8, c);
    limb(ctx, J.hip, J.kneeF, 6.5, 4.8, c); limb(ctx, J.kneeF, J.ankF, 4.8, 3.2, c);
    limb(ctx, J.sh, J.elF, 3.8, 3.2, c); limb(ctx, J.elF, J.hdF, 3.4, 2.8, c);
    ctx.beginPath(); ctx.arc(J.head.x, J.head.y, 10.5, 0, TAU); ctx.fillStyle = c; ctx.fill();
    limb(ctx, J.hdF, J.tip, 1.6, 0.6, U.rgba(col, 0.8));
    ctx.restore();
  };

  /* --------- ODE: companion drone --------- */
  Rig.drawOde = (ctx, x, y, t, look = 1, talk = 0) => {
    ctx.save(); ctx.translate(x, y);
    // glow
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
    g.addColorStop(0, 'rgba(255,214,150,0.25)'); g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
    // fins
    const fa = Math.sin(t * 6) * 0.15;
    ctx.fillStyle = '#c9ccd3';
    for (const s of [-1, 1]) { ctx.save(); ctx.rotate(s * (0.9 + fa)); ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(s * 3, -17); ctx.lineTo(s * 6, -6); ctx.closePath(); ctx.fill(); ctx.restore(); }
    // shell
    const sg = ctx.createRadialGradient(-3, -4, 1, 0, 0, 10);
    sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.7, '#d4d6dc'); sg.addColorStop(1, '#8b8f99');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1c1e24'; ctx.beginPath(); ctx.ellipse(look * 3.5, 0, 4.6, 5.2, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = U.rgba('#ffd28a', 0.9 + talk * 0.1); ctx.beginPath(); ctx.arc(look * 4, 0, 2 + talk * Math.abs(Math.sin(t * 22)) * 1.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,140,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, 12.5, t * 2, t * 2 + 1.4); ctx.stroke();
    ctx.restore();
  };

  /* =========================== POSE LIBRARY =========================== */
  const A = Rig.ANIM = {};
  // combat stance: weight sits low, breathing lifts the chest, weight shifts slowly between the feet
  A.idle = (t) => {
    const br = Math.sin(t * 2.1), sway = Math.sin(t * 0.75);
    return { ik: 1, fFx: 15, fBx: -14, ry: 6 + br * 0.9, rx: sway * 1.4, torso: 0.13 + br * 0.015 - sway * 0.01, head: -0.06 - br * 0.01,
      aF: 0.55 + br * 0.03, eF: 0.82, aB: -0.05 + br * 0.03, eB: 0.75, sw: 1.12 + br * 0.02 };
  };
  A.calm = (t) => {
    const br = Math.sin(t * 1.6), sway = Math.sin(t * 0.5);
    return { ik: 1, fFx: 7, fBx: -6, ry: 1.5 + br * 0.6, rx: sway * 1.2, torso: 0.02 + br * 0.01, head: 0.03 + Math.sin(t * 0.7) * 0.04,
      aF: 0.1 + br * 0.02, eF: 0.18, aB: -0.08 - br * 0.02, eB: 0.25, sw: 0.16 };
  };
  // gait: each foot follows a stance (planted, sliding back) / swing (lifted, travelling forward) loop; IK bends the knees
  const gaitFoot = (q, S, lift) => { q = ((q % TAU) + TAU) % TAU; return q < PI ? { x: S * Math.cos(q), y: 0 } : { x: S * Math.cos(q), y: -lift * Math.sin(q - PI) }; };
  A.gaitStride = (k) => 22 * k + 8;
  A.run = (p, k = 1) => {
    const S = A.gaitStride(k), f = gaitFoot(p, S, 15 * k + 4), b = gaitFoot(p + PI, S, 15 * k + 4);
    const bob = -Math.cos(2 * p);
    return {
      ik: 1, fFx: f.x + 5 * k, fFy: f.y, fBx: b.x + 5 * k, fBy: b.y,
      rx: 5 * k, ry: 5 + 3.2 * k * bob, torso: 0.3 * k + 0.06 + 0.025 * bob, head: -0.22 * k - 0.02 * bob,
      aF: -0.5 - 0.32 * Math.cos(p), eF: 0.55 + 0.15 * Math.sin(p), sw: -1.95 + 0.14 * Math.cos(p),
      aB: 0.85 * k * Math.cos(p), eB: 1.35 + 0.25 * Math.sin(p),
    };
  };
  A.walk = (p) => {
    const f = gaitFoot(p, 13, 6), b = gaitFoot(p + PI, 13, 6);
    return { ik: 1, fFx: f.x + 2, fFy: f.y, fBx: b.x + 2, fBy: b.y, rx: 2, ry: 2 + 1.6 * -Math.cos(2 * p), torso: 0.05, head: 0.02,
      aF: 0.12 - 0.22 * Math.cos(p), eF: 0.25, aB: 0.3 * Math.cos(p), eB: 0.35, sw: 0.2 };
  };
  A.rise = { ry: -6, torso: 0.2, head: -0.1, tF: 0.95, kF: -1.5, tB: 0.05, kB: -0.9, aF: 0.2, eF: 1.1, aB: -0.7, eB: 0.6, sw: -1.6 };
  A.fall = { ry: -2, torso: 0.12, head: -0.05, tF: 0.45, kF: -0.7, tB: -0.25, kB: -0.55, aF: 0.75, eF: 0.6, aB: -0.95, eB: 0.35, sw: -1.25 };
  A.land = { ry: 12, torso: 0.45, head: -0.2, tF: 0.75, kF: -1.25, tB: -0.25, kB: -1.0, aF: 0.4, eF: 0.6, aB: -0.4, eB: 0.6, sw: -1.4 };
  A.flip = { dur: 0.36, keys: [[0, { ry: -4, torso: 0.3, tF: 1.3, kF: -2.1, tB: 1.0, kB: -2.0, aF: 0.8, eF: 1.2, aB: 0.6, eB: 1.4, sw: -1.4, rot: 0 }], [0.36, { ry: -4, torso: 0.3, tF: 1.3, kF: -2.1, tB: 1.0, kB: -2.0, aF: 0.8, eF: 1.2, aB: 0.6, eB: 1.4, sw: -1.4, rot: TAU }, 'out']] };
  const stance = { tF: 0.55, kF: -0.55, tB: -0.5, kB: -0.2 };
  A.light = [
    { dur: 0.45, active: [0.15, 0.24], keys: [
      [0, { ...stance, ry: 4, torso: -0.05, aF: 2.5, eF: 0.7, aB: -0.6, eB: 0.6, sw: 3.85 }],
      [0.14, { ...stance, ry: 3, torso: -0.08, aF: 2.8, eF: 0.6, aB: -0.7, eB: 0.6, sw: 4.15 }, 'io'],
      [0.23, { tF: 0.8, kF: -0.85, tB: -0.6, kB: -0.25, ry: 11, torso: 0.48, head: -0.1, aF: 1.25, eF: 0.1, aB: -0.9, eB: 0.4, sw: 0.5 }, 'snap'],
      [0.45, { tF: 0.7, kF: -0.8, tB: -0.55, kB: -0.25, ry: 9, torso: 0.34, aF: 0.95, eF: 0.35, aB: -0.6, eB: 0.5, sw: 0.45 }, 'out']] },
    { dur: 0.42, active: [0.10, 0.19], keys: [
      [0, { tF: 0.8, kF: -0.85, tB: -0.6, kB: -0.25, ry: 10, torso: 0.45, aF: 0.6, eF: 0.2, aB: -0.6, eB: 0.5, sw: -0.35 }],
      [0.09, { tF: 0.85, kF: -0.95, tB: -0.6, kB: -0.25, ry: 12, torso: 0.55, aF: 0.4, eF: 0.2, aB: -0.6, eB: 0.5, sw: -0.6 }, 'io'],
      [0.19, { tF: 0.4, kF: -0.4, tB: -0.45, kB: -0.15, ry: -2, torso: -0.12, head: -0.15, aF: 2.75, eF: 0.15, aB: -1.0, eB: 0.3, sw: 2.95 }, 'snap'],
      [0.42, { tF: 0.4, kF: -0.45, tB: -0.4, kB: -0.2, ry: 2, torso: 0.0, aF: 2.3, eF: 0.4, aB: -0.6, eB: 0.5, sw: 2.6 }, 'out']] },
    { dur: 0.46, active: [0.12, 0.22], keys: [
      [0, { ...stance, ry: 2, torso: -0.05, aF: 2.3, eF: 0.8, aB: -0.4, eB: 0.6, sw: 2.6 }],
      [0.11, { ...stance, ry: 1, torso: -0.12, aF: 2.6, eF: 0.8, aB: -0.6, eB: 0.6, sw: 2.95 }, 'io'],
      [0.21, { tF: 0.9, kF: -1.0, tB: -0.65, kB: -0.25, ry: 13, torso: 0.6, head: -0.15, aF: 0.55, eF: 0.15, aB: -1.1, eB: 0.3, sw: -0.45 }, 'snap'],
      [0.46, { tF: 0.8, kF: -0.95, tB: -0.6, kB: -0.25, ry: 11, torso: 0.45, aF: 0.5, eF: 0.3, aB: -0.7, eB: 0.4, sw: -0.3 }, 'out']] },
    { dur: 0.66, active: [0.13, 0.36], keys: [
      [0, { tF: 0.9, kF: -1.3, tB: -0.6, kB: -0.6, ry: 14, torso: 0.55, aF: 0.2, eF: 0.4, aB: -0.6, eB: 0.5, sw: -1.8 }],
      [0.12, { tF: 1.2, kF: -2.0, tB: 0.9, kB: -1.8, ry: -18, torso: 0.3, aF: 1.6, eF: 0.0, aB: -0.4, eB: 0.6, sw: 1.6, rot: 0 }, 'io'],
      [0.34, { tF: 1.2, kF: -2.0, tB: 0.9, kB: -1.8, ry: -14, torso: 0.3, aF: 1.6, eF: 0.0, aB: -0.4, eB: 0.6, sw: 1.6, rot: TAU }, 'out'],
      [0.42, { tF: 0.9, kF: -1.3, tB: -0.6, kB: -0.4, ry: 15, torso: 0.6, head: -0.1, aF: 1.1, eF: 0.1, aB: -1.1, eB: 0.3, sw: 0.35, rot: TAU }, 'snap'],
      [0.66, { tF: 0.7, kF: -1.0, tB: -0.5, kB: -0.3, ry: 10, torso: 0.4, aF: 0.9, eF: 0.4, aB: -0.6, eB: 0.5, sw: 0.5, rot: TAU }, 'out']] },
  ];
  A.air = { dur: 0.42, active: [0.06, 0.30], keys: [
    [0, { ry: -6, torso: 0.3, tF: 1.0, kF: -1.6, tB: 0.6, kB: -1.5, aF: 2.6, eF: 0.4, aB: -0.6, eB: 0.6, sw: 3.4, rot: 0 }],
    [0.30, { ry: -6, torso: 0.3, tF: 1.0, kF: -1.6, tB: 0.6, kB: -1.5, aF: 1.6, eF: 0.1, aB: -0.6, eB: 0.6, sw: 1.4, rot: TAU }, 'out'],
    [0.42, { ry: -2, torso: 0.15, tF: 0.5, kF: -0.8, tB: -0.2, kB: -0.6, aF: 0.8, eF: 0.4, aB: -0.9, eB: 0.4, sw: 0.4, rot: TAU }, 'io']] };
  A.charge = (t, k) => ({ tF: 0.95, kF: -1.25, tB: -0.75, kB: -0.25, ry: 15 + Math.sin(t * 60) * k * 0.8, torso: 0.6, head: -0.2, aF: -0.95, eF: 0.55, aB: 0.9, eB: 1.2, sw: -2.05 - k * 0.15, glow: k });
  A.heavy = { dur: 0.52, active: [0.07, 0.24], keys: [
    [0, { tF: 0.95, kF: -1.25, tB: -0.75, kB: -0.25, ry: 15, torso: 0.6, aF: -0.95, eF: 0.55, aB: 0.9, eB: 1.2, sw: -2.1, glow: 1 }],
    [0.08, { tF: 1.15, kF: -0.6, tB: -1.05, kB: -0.15, ry: 18, torso: 0.78, head: -0.3, rx: 16, aF: 1.62, eF: 0.0, aB: -1.4, eB: 0.2, sw: 1.6, glow: 1 }, 'snap'],
    [0.26, { tF: 1.1, kF: -0.65, tB: -1.0, kB: -0.15, ry: 18, torso: 0.75, head: -0.3, rx: 16, aF: 1.6, eF: 0.0, aB: -1.4, eB: 0.2, sw: 1.58, glow: 0.6 }],
    [0.52, { ...stance, ry: 6, torso: 0.3, aF: 0.9, eF: 0.4, aB: -0.4, eB: 0.5, sw: 1.0 }, 'out']] };
  A.guard = (t) => ({ tF: 0.48, kF: -0.65, tB: -0.5, kB: -0.25, ry: 8, torso: -0.04, head: 0.05, aF: 1.25, eF: 1.55, aB: 1.0, eB: 1.25, sw: 2.95 + Math.sin(t * 3) * 0.01 });
  A.parried = { dur: 0.28, keys: [[0, { tF: 0.3, kF: -0.6, tB: -0.7, kB: -0.25, ry: 6, torso: -0.25, aF: 1.1, eF: 1.3, aB: 0.8, eB: 1.2, sw: 2.35, glow: 1 }], [0.28, { tF: 0.48, kF: -0.65, tB: -0.5, kB: -0.25, ry: 8, torso: -0.04, aF: 1.25, eF: 1.55, aB: 1.0, eB: 1.25, sw: 2.95 }, 'out']] };
  A.blocked = { dur: 0.22, keys: [[0, { tF: 0.2, kF: -0.5, tB: -0.8, kB: -0.2, ry: 6, torso: -0.3, aF: 1.0, eF: 1.5, aB: 0.8, eB: 1.2, sw: 2.6 }], [0.22, { tF: 0.48, kF: -0.65, tB: -0.5, kB: -0.25, ry: 8, torso: -0.04, aF: 1.25, eF: 1.55, aB: 1.0, eB: 1.25, sw: 2.95 }, 'out']] };
  A.dodge = { ry: 20, torso: 0.95, head: -0.4, tF: 1.25, kF: -1.7, tB: -1.15, kB: -0.4, aF: -0.9, eF: 0.4, aB: -1.3, eB: 0.4, sw: -1.75 };
  A.backstep = { ry: 14, torso: -0.25, head: 0.1, tF: 0.6, kF: -0.4, tB: -0.9, kB: -1.0, aF: 0.9, eF: 0.8, aB: -0.6, eB: 0.8, sw: 1.6 };
  A.hurt = { ry: 4, torso: -0.45, head: 0.35, tF: 0.3, kF: -0.5, tB: -0.55, kB: -0.3, aF: -0.3, eF: 1.2, aB: -0.8, eB: 0.6, sw: -0.8 };
  A.kneel = { ry: 27, torso: 0.38, head: 0.55, tF: 1.3, kF: -1.3, tB: 0.0, kB: -1.57, aF: 0.9, eF: 0.2, aB: 0.4, eB: 1.0, sw: 0.05 };
  A.rest = (t) => ({ ry: 27, torso: 0.2 + Math.sin(t * 1.5) * 0.02, head: 0.42, tF: 1.3, kF: -1.3, tB: 0.0, kB: -1.57, aF: 0.95, eF: 0.15, aB: 0.6, eB: 1.0, sw: 0.02, glow: 0.4 });
  A.dead = { dur: 1.2, keys: [[0, A.hurt], [0.5, { ...A.kneel, torso: 0.7, head: 0.7 }, 'out'], [1.2, { ...A.kneel, torso: 0.8, head: 0.8, sw: 0.0, aF: 0.95 }]] };
  A.heal = { dur: 0.9, keys: [[0, { ...stance, ry: 6, torso: 0.1, aF: 0.4, eF: 0.4, aB: 0.8, eB: 2.2, sw: 0.9 }], [0.3, { ...stance, ry: 8, torso: 0.2, head: 0.3, aF: 0.3, eF: 0.4, aB: 1.3, eB: 2.4, sw: 0.8, glow: 1 }], [0.9, { ...stance, ry: 4, torso: 0.1, aF: 0.5, eF: 0.7, aB: -0.1, eB: 0.6, sw: 1.1 }]] };
  A.skill1 = { dur: 0.55, keys: [
    [0, { ry: 18, torso: 0.85, head: -0.4, tF: 1.2, kF: -1.6, tB: -1.0, kB: -0.4, aF: -0.7, eF: 0.4, aB: 0.9, eB: 1.2, sw: -1.75, glow: 1 }],
    [0.1, { ry: 18, torso: 0.9, head: -0.4, tF: 1.25, kF: -1.6, tB: -1.1, kB: -0.4, aF: -0.9, eF: 0.4, aB: 0.9, eB: 1.2, sw: -1.9, glow: 1 }],
    [0.2, { ry: 16, torso: 0.7, head: -0.3, tF: 1.0, kF: -1.0, tB: -1.2, kB: -0.3, aF: 1.75, eF: 0.0, aB: -1.4, eB: 0.2, sw: 1.95, glow: 1 }, 'snap'],
    [0.55, { ...stance, ry: 6, torso: 0.25, aF: 1.0, eF: 0.3, aB: -0.4, eB: 0.5, sw: 1.2 }, 'out']] };
  A.skill2 = { dur: 0.85, keys: [
    [0, { ry: 6, torso: 0.0, tF: 0.4, kF: -0.6, tB: -0.4, kB: -0.3, aF: 2.0, eF: 0.8, aB: 2.0, eB: 0.8, sw: 3.0, glow: 1 }],
    [0.22, { ry: -26, torso: -0.1, head: -0.3, tF: 0.9, kF: -1.6, tB: 0.3, kB: -1.4, aF: 3.05, eF: 0.1, aB: 2.9, eB: 0.3, sw: 3.14, glow: 1 }, 'out'],
    [0.32, { ry: 22, torso: 0.7, head: 0.1, tF: 1.0, kF: -1.6, tB: -0.6, kB: -1.0, aF: 1.15, eF: 0.25, aB: 1.0, eB: 0.6, sw: 0.12, glow: 1 }, 'snap'],
    [0.85, { ry: 18, torso: 0.6, head: 0.1, tF: 1.0, kF: -1.6, tB: -0.6, kB: -1.0, aF: 1.15, eF: 0.25, aB: 1.0, eB: 0.6, sw: 0.12, glow: 0.3 }]] };
  A.execute = { dur: 1.15, keys: [
    [0, A.dodge],
    [0.18, A.light[0].keys[1][1]],
    [0.3, A.light[0].keys[2][1], 'snap'],
    [0.42, A.light[1].keys[1][1]],
    [0.52, A.light[1].keys[2][1], 'snap'],
    [0.72, { ...A.charge(0, 1) }],
    [0.82, A.heavy.keys[1][1], 'snap'],
    [1.15, A.heavy.keys[3][1], 'out']] };

  /* ---- two-handed grips on the heavy, guarded stances ---- */
  const withHold = (fn, h) => (...a) => Object.assign(fn(...a), { hold: h });
  A.guard = withHold(A.guard, 1); A.charge = withHold(A.charge, 1);
  A.heavy.keys[0][1] = { ...A.heavy.keys[0][1], hold: 1 };
  A.parried.keys[1][1] = { ...A.parried.keys[1][1], hold: 1 }; A.blocked.keys[1][1] = { ...A.blocked.keys[1][1], hold: 1 };

  /* ---- plant every grounded stance: authored leg spacing, feet locked to the floor ---- */
  const gnd = Rig.groundify;
  const gndFn = (fn) => (...a) => gnd(fn(...a));
  A.guard = gndFn(A.guard); A.charge = gndFn(A.charge);
  A.land = gnd(A.land); A.dodge = gnd(A.dodge); A.backstep = gnd(A.backstep); A.hurt = gnd(A.hurt);
  const gndKeys = (anim, skip = []) => anim.keys.forEach((k, i) => { if (!skip.includes(i)) k[1] = gnd(k[1]); });
  [A.light[0], A.light[1], A.light[2], A.heavy, A.parried, A.blocked, A.heal, A.skill1, A.execute].forEach((a) => gndKeys(a));
  gndKeys(A.light[3], [1, 2]);
  gndKeys(A.skill2, [1]);
  A.dead.keys[0][1] = A.hurt;
})(window.G);

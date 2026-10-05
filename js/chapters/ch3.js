'use strict';
/* ECHOFALL — Chapter III 斷層之井 THE FAULTWELL: level, inked cavern art, live atmosphere, story, music.
   Spec: docs/STORY.md §3 (III) · API: docs/CHAPTER_API.md. Foes/boss live in ch3_foes.js / ch3_boss.js (referenced by id). */
(function (G) {
  const WK = G.WorldKit, U = G.U, L = G.LEVEL, PI = Math.PI, TAU = PI * 2;
  const INK = '#0b0612';
  const P = (k, t) => WK.P(k, U.clamp(t, 0, 1));
  const mixH = (a, b, t) => U.mixHex(a, b, U.clamp(t, 0, 1));
  const lerp = U.lerp, clamp = U.clamp;
  const nz = (x, s) => U.noise1(x, s);

  /* ============================== layout ============================== */
  // zone starts (world x) — the chapter climbs from the shaft floor (teal) into the Rest's breath (violet)
  const Z = { A: -400, B: 2700, C: 5600, D: 7400, M: 9420, M1: 10080, E: 10080 };
  const BOSS_X0 = 11700, BOSS_X1 = BOSS_X0 + 1400;          // boss arena (contract: 1400 wide, floor y = 0)
  const ELITE_X0 = 8200;                                    // elite arena [x0, x0 + 1000]
  const MINE = [9420, 10060], PIT = [9640, 9940];           // the lightless adit and its pit
  const LAKE = [5600, 7400];
  const CHILD_X = 6990;                                     // the vision on the water (set-piece)
  const TK = [[2600, 0], [5600, 0.12], [7400, 0.25], [9400, 0.5], [10100, 0.7], [11300, 1]];
  function tintAt(x) {
    if (x <= TK[0][0]) return 0;
    for (let i = 1; i < TK.length; i++) if (x <= TK[i][0]) { const a = TK[i - 1], b = TK[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    return 1;
  }
  const zoneOf = (x) => (x < Z.B ? 'A' : x < Z.C ? 'B' : x < Z.D ? 'C' : x < Z.M ? 'D' : x < Z.E ? 'M' : 'E');

  /* ============================== painter helpers ============================== */
  function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
  function path(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); }
  function ink(g, w, col) { g.strokeStyle = col || INK; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  function disc(g, x, y, r, col, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, U.rgba(col, a)); gr.addColorStop(1, U.rgba(col, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // light comes from the upper right (matches G.Rig.lightDir): right planes lit, left planes in purple shade
  const ROCK = {
    top: ['#6ff0d2', '#e08cff'], lip: ['#557a84', '#6a5486'], lit: ['#3a5662', '#4b3b66'], base: ['#25384a', '#31244a'],
    dark: ['#172433', '#20163a'], deep: ['#0b131d', '#120a1e'], crack: ['#060b12', '#0a0612'],
  };
  const BONE = { lit: ['#b4c7bf', '#bcaed0'], base: ['#7a8f90', '#7d6d92'], dark: ['#3f4e5c', '#3f3154'], deep: ['#222a38', '#22182f'], rim: ['#e2fff6', '#f6dcff'] };
  const pick = (pair, t) => mixH(pair[0], pair[1], t);
  const colsOf = (pal, t) => { const o = {}; for (const k in pal) o[k] = pick(pal[k], t); return o; };
  // tone set for background masses: haze = how far they sit inside the fog (0 crisp .. 1 lost)
  function massC(t, base, haze, rimA) {
    const fog = P('fog', t), b = mixH(base, fog, haze);
    return {
      base: b, lit: mixH(b, P('rim', t), 0.2), dark: mixH(b, '#06030e', 0.42), rim: U.rgba(P('rim', t), rimA),
      ridge: '#05030a', ink: U.rgba('#05030a', 0.55 + (1 - haze) * 0.4),
    };
  }

  // stalagmite (up) / stalactite (down) / spire: cel planes, flowstone ridges, hatching, rim + ink contour
  function spike(g, rng, x, base, w, len, C, o = {}) {
    const dir = o.down ? 1 : -1, n = Math.max(4, Math.round(len / 18));
    const lean = (o.lean != null ? o.lean : (rng() - 0.5) * 0.6) * w;
    const Lp = [], Rp = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, j = i === 0 || i === n ? 1 : 0.86 + rng() * 0.26;
      const hw = (w / 2) * Math.pow(1 - u, o.pow || 0.85) * j, cx = x + lean * u * u, y = base + dir * len * u;
      Lp.push([cx - hw, y]); Rp.push([cx + hw, y]);
    }
    const deep = base - dir * (o.deep != null ? o.deep : 300);
    const sil = [[Lp[0][0], deep]].concat(Lp, Rp.slice().reverse(), [[Rp[0][0], deep]]);
    poly(g, sil); g.fillStyle = C.base; g.fill();
    g.save(); g.clip();
    const band = (k, side) => Lp.map((p, i) => { const wd = Rp[i][0] - Lp[i][0]; return [side > 0 ? Rp[i][0] - wd * k : Lp[i][0] + wd * k, p[1]]; });
    const lt = band(o.litK || 0.36, 1);
    poly(g, [[Rp[0][0], deep]].concat(Rp, lt.slice().reverse(), [[lt[0][0], deep]])); g.fillStyle = C.lit; g.fill();
    const sh = band(0.3, -1);
    poly(g, [[Lp[0][0], deep]].concat(Lp, sh.slice().reverse(), [[sh[0][0], deep]])); g.fillStyle = C.dark; g.fill();
    if (o.ridges !== false) {
      g.strokeStyle = U.rgba(C.ridge || '#05030a', 0.32); g.lineWidth = o.ridgeW || 1; g.beginPath();
      for (let i = 1; i < n; i += 1 + (rng() < 0.5 ? 1 : 0)) { const y = Lp[i][1]; g.moveTo(Lp[i][0], y); g.quadraticCurveTo((Lp[i][0] + Rp[i][0]) / 2, y - dir * 4, Rp[i][0], y + dir * 2); }
      g.stroke();
    }
    if (o.hatch !== false) {
      g.strokeStyle = 'rgba(8,3,18,0.42)'; g.lineWidth = o.hatchW || 0.8; g.beginPath();
      for (let i = 1; i < n; i++) { const wd = Rp[i][0] - Lp[i][0]; if (wd < 9) continue; const y = Lp[i][1], x0 = Lp[i][0] + wd * 0.05; g.moveTo(x0, y); g.lineTo(x0 + wd * 0.16, y - dir * 7); }
      g.stroke();
    }
    g.restore();
    if (C.rim) { path(g, Rp.slice(0, n)); ink(g, o.rimW || 1.4, C.rim); }
    if (o.ink !== 0) { path(g, Lp.concat(Rp.slice().reverse())); ink(g, o.ink || 1.6, C.ink || INK); }
    return Lp[n];
  }

  // faceted crystal cluster: dark + lit facet per shard, a core glint, ink contour, optional halo
  function shards(g, rng, x, y, s, col, o = {}) {
    const n = o.n || 3 + Math.floor(rng() * 4);
    if (o.glow !== false) disc(g, x, y - s * 0.45, s * (o.glowR || 1.9), col, o.glowA || 0.3);
    const list = [];
    for (let i = 0; i < n; i++) list.push({ a: (o.base != null ? o.base : -PI / 2) + (rng() - 0.5) * (o.spread || 1.5), len: s * (0.45 + rng() * 0.85), wd: s * (0.12 + rng() * 0.11), bx: x + (rng() - 0.5) * s * 0.55 });
    list.sort((p, q) => q.len - p.len);
    const dk = mixH(col, '#1a0532', 0.58), lt = mixH(col, '#ffffff', 0.28), mid = mixH(col, '#2a0c44', 0.2);
    for (const sh of list) {
      const ca = Math.cos(sh.a), sa = Math.sin(sh.a), nx = -sa, ny = ca, k = 0.7;
      const tip = [sh.bx + ca * sh.len, y + sa * sh.len];
      const L0 = [sh.bx - nx * sh.wd, y - ny * sh.wd], R0 = [sh.bx + nx * sh.wd, y + ny * sh.wd];
      const L1 = [sh.bx + ca * sh.len * k - nx * sh.wd * 1.06, y + sa * sh.len * k - ny * sh.wd * 1.06];
      const R1 = [sh.bx + ca * sh.len * k + nx * sh.wd * 1.06, y + sa * sh.len * k + ny * sh.wd * 1.06];
      const M0 = [sh.bx + nx * sh.wd * 0.15, y + ny * sh.wd * 0.15], M1 = [sh.bx + ca * sh.len * k + nx * sh.wd * 0.2, y + sa * sh.len * k + ny * sh.wd * 0.2];
      const litR = nx > 0;   // the facet that faces right catches the light
      poly(g, [L0, L1, tip, M1, M0]); g.fillStyle = litR ? dk : mid; g.fill();
      poly(g, [M0, M1, tip, R1, R0]); g.fillStyle = litR ? mid : dk; g.fill();
      poly(g, [M1, tip, litR ? R1 : L1]); g.fillStyle = lt; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = Math.max(0.6, s * 0.025);
      g.beginPath(); g.moveTo(lerp(M0[0], tip[0], 0.18), lerp(M0[1], tip[1], 0.18)); g.lineTo(lerp(M0[0], tip[0], 0.7), lerp(M0[1], tip[1], 0.7)); g.stroke();
      if (o.ink !== 0) { poly(g, [L0, L1, tip, R1, R0]); ink(g, o.ink || Math.max(0.9, s * 0.045), o.inkCol); }
    }
  }

  // fossil organ pipe: flue foot, mouth, body rings, broken crown, cel planes, crystal sprouting from cracks
  function organPipe(g, rng, x, base, w, h, C, o = {}) {
    const footH = Math.min(h * 0.22, w * 1.4), top = base - h, my = base - footH;
    const broken = o.broken != null ? o.broken : rng() < 0.4;
    const crown = [];
    if (broken) { const k = 5; for (let i = 0; i <= k; i++) crown.push([x + (w * i) / k, top + (i === 0 || i === k ? 0 : (rng() - 0.25) * w * 0.9)]); }
    else crown.push([x, top], [x + w, top]);
    const sil = [[x + w * 0.3, base + 2], [x, my]].concat(crown, [[x + w, my], [x + w * 0.7, base + 2]]);
    poly(g, sil); g.fillStyle = C.base; g.fill();
    g.save(); g.clip();
    g.fillStyle = C.dark; g.fillRect(x - 2, top - w, w * 0.27 + 2, h + w * 2);
    g.fillStyle = C.lit; g.fillRect(x + w * 0.74, top - w, w * 0.26 + 2, h + w * 2);
    g.fillStyle = U.rgba('#ffffff', 0.12); g.fillRect(x + w * 0.62, top - w, Math.max(1, w * 0.05), h + w * 2);
    // rings
    const gap = o.ring || 34 + rng() * 26;
    for (let y = my - gap * 0.6; y > top + 6; y -= gap) {
      g.fillStyle = U.rgba('#05030a', 0.38); g.fillRect(x, y, w, 2.6);
      g.fillStyle = U.rgba(C.rim2 || '#ffffff', 0.16); g.fillRect(x, y + 2.6, w, 1);
    }
    // mineral drips
    g.strokeStyle = U.rgba('#05030a', 0.25); g.lineWidth = 1;
    for (let k = 0; k < 2 + w / 16; k++) { const sx = x + rng() * w, sy = top + rng() * h * 0.5; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (rng() - 0.5) * 3, sy + 20 + rng() * 60); g.stroke(); }
    g.restore();
    // mouth: dark arch + upper lip catching light
    const mw = w * 0.62, mx = x + (w - mw) / 2, mh = Math.max(6, w * 0.42);
    g.beginPath(); g.moveTo(mx, my); g.lineTo(mx, my - mh * 0.45); g.quadraticCurveTo(mx + mw / 2, my - mh * 1.25, mx + mw, my - mh * 0.45); g.lineTo(mx + mw, my); g.closePath();
    g.fillStyle = '#04030a'; g.fill(); ink(g, Math.max(1, w * 0.04));
    g.strokeStyle = U.rgba(C.rim2 || '#ffffff', 0.5); g.lineWidth = Math.max(0.8, w * 0.035);
    g.beginPath(); g.moveTo(mx + mw * 0.15, my - mh * 0.75); g.quadraticCurveTo(mx + mw / 2, my - mh * 1.12, mx + mw * 0.85, my - mh * 0.75); g.stroke();
    if (o.glowMouth) disc(g, x + w / 2, my - mh * 0.4, mw * 0.9, o.glowMouth, 0.35);
    g.fillStyle = U.rgba('#05030a', 0.5); g.fillRect(mx, my - 1, mw, 2.4);
    if (C.rim) { g.beginPath(); g.moveTo(x + w, my); g.lineTo(x + w, crown[crown.length - 1][1]); ink(g, Math.max(1, w * 0.05), C.rim); }
    poly(g, sil); ink(g, o.ink || Math.max(1.2, w * 0.06), C.ink);
    if (o.xtal && rng() < 0.6) shards(g, rng, x + w * (0.2 + rng() * 0.6), top + h * (0.2 + rng() * 0.4), w * (0.5 + rng() * 0.5), o.xtal, { spread: 2.4, glowA: 0.22, ink: o.inkX });
  }

  // fossil rib arch (giant resonance-organ bone) spanning x0..x1, rising hgt above base
  function ribArch(g, rng, x0, x1, base, hgt, th, C, o = {}) {
    const mx = (x0 + x1) / 2 + (rng() - 0.5) * (x1 - x0) * 0.15;
    const cy = base - hgt * 2;
    g.beginPath(); g.moveTo(x0 - th * 0.5, base + 40); g.quadraticCurveTo(mx, cy - th, x1 + th * 0.5, base + 40);
    g.lineTo(x1 - th * 0.5, base + 40); g.quadraticCurveTo(mx, cy + th * 1.4, x0 + th * 0.5, base + 40); g.closePath();
    g.fillStyle = C.base; g.fill();
    g.save(); g.clip();
    g.lineWidth = th * 0.55; g.strokeStyle = C.lit; g.beginPath(); g.moveTo(x0, base + 40); g.quadraticCurveTo(mx, cy - th * 0.6, x1, base + 40); g.stroke();
    g.lineWidth = th * 0.35; g.strokeStyle = C.dark; g.beginPath(); g.moveTo(x0 + th * 0.4, base + 40); g.quadraticCurveTo(mx, cy + th * 1.3, x1 - th * 0.4, base + 40); g.stroke();
    // vertebral segments
    g.strokeStyle = U.rgba('#05030a', 0.45); g.lineWidth = 1.2;
    const segs = Math.floor((x1 - x0) / (th * 1.6));
    for (let i = 1; i < segs; i++) {
      const u = i / segs, px = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * mx + u * u * x1, py = (1 - u) * (1 - u) * (base + 40) + 2 * u * (1 - u) * cy + u * u * (base + 40);
      const dx = 2 * (1 - u) * (mx - x0) + 2 * u * (x1 - mx), dy = 2 * (1 - u) * (cy - base - 40) + 2 * u * (base + 40 - cy), d = Math.hypot(dx, dy) || 1;
      g.beginPath(); g.moveTo(px - (dy / d) * th, py + (dx / d) * th); g.lineTo(px + (dy / d) * th, py - (dx / d) * th); g.stroke();
    }
    g.restore();
    g.beginPath(); g.moveTo(x0 - th * 0.5, base + 40); g.quadraticCurveTo(mx, cy - th, x1 + th * 0.5, base + 40);
    g.moveTo(x1 - th * 0.5, base + 40); g.quadraticCurveTo(mx, cy + th * 1.4, x0 + th * 0.5, base + 40); ink(g, o.ink || 2, C.ink);
    if (C.rim) { g.beginPath(); g.moveTo(mx, cy * 0.5 + base * 0.5 - th * 0.5); g.quadraticCurveTo(lerp(mx, x1, 0.55), cy * 0.42 + base * 0.58 - th * 0.4, x1 + th * 0.2, base); ink(g, 1.4, C.rim); }
  }

  // glowing cave fungus: stalk + cap (cel), spotted, soft halo
  function fungus(g, rng, x, y, s, col, o = {}) {
    const n = o.n || 2 + Math.floor(rng() * 4);
    if (o.glow !== false) disc(g, x, y - s * 0.8, s * 3, col, 0.28);
    for (let i = 0; i < n; i++) {
      const fx = x + (rng() - 0.5) * s * 2.4, fh = s * (0.6 + rng() * 1.4), cw = s * (0.5 + rng() * 0.6), lean = (rng() - 0.5) * s * 0.6;
      g.strokeStyle = mixH(col, '#e8fff8', 0.55); g.lineWidth = Math.max(1, s * 0.16); g.lineCap = 'round';
      g.beginPath(); g.moveTo(fx, y); g.quadraticCurveTo(fx + lean * 0.3, y - fh * 0.5, fx + lean, y - fh); g.stroke();
      const cx = fx + lean, cy = y - fh;
      g.beginPath(); g.moveTo(cx - cw, cy + 1); g.quadraticCurveTo(cx - cw * 0.9, cy - cw * 0.9, cx, cy - cw * 0.85); g.quadraticCurveTo(cx + cw * 0.9, cy - cw * 0.9, cx + cw, cy + 1); g.closePath();
      g.fillStyle = mixH(col, '#ffffff', 0.15); g.fill();
      g.save(); g.clip(); g.fillStyle = mixH(col, '#1a0a30', 0.45); g.fillRect(cx - cw, cy - cw, cw * 0.7, cw * 2);
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(cx + cw * 0.25, cy - cw * 0.7, cw * 0.25, cw * 0.25); g.restore();
      ink(g, Math.max(0.7, s * 0.12), o.inkCol);
    }
  }

  // hanging bioluminescent roots with glowing bulbs
  function roots(g, rng, x, y, len, col, C, o = {}) {
    const n = o.n || 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      let cx = x + (rng() - 0.5) * 30, cy = y; const L2 = len * (0.45 + rng() * 0.7), sway = (rng() - 0.5) * 30;
      const pts = [[cx, cy]];
      for (let k = 1; k <= 8; k++) { const u = k / 8; pts.push([cx + Math.sin(u * 3 + i) * 6 + sway * u * u, cy + L2 * u]); }
      path(g, pts); ink(g, (o.w || 2.4) + 1.6, o.inkCol); path(g, pts); ink(g, o.w || 2.4, C);
      for (let k = 2; k <= 8; k += 2 + Math.floor(rng() * 2)) {
        const [bx, by] = pts[k], r = 2 + rng() * 2.6;
        if (o.glow !== false) disc(g, bx, by, r * 4, col, 0.35);
        g.beginPath(); g.arc(bx, by, r, 0, TAU); g.fillStyle = mixH(col, '#ffffff', 0.45); g.fill(); ink(g, 0.8, o.inkCol);
      }
    }
  }

  // drill derrick: tapered lattice tower, decks, crown block, drill string and bit
  function derrick(g, x, base, w, h, C, o = {}) {
    const top = base - h, tw = w * 0.32;
    const lx = (y) => lerp(x, x + (w - tw) / 2, (base - y) / h), rx = (y) => lerp(x + w, x + (w + tw) / 2, (base - y) / h);
    const beam = (x1, y1, x2, y2, lw) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); ink(g, lw + 2.2, o.inkCol); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); ink(g, lw, C.base); };
    const lv = o.levels || 9;
    for (let i = 0; i < lv; i++) {
      const y0 = base - (h * i) / lv, y1 = base - (h * (i + 1)) / lv;
      beam(lx(y0), y0, rx(y1), y1, o.lw * 0.55 || 1.6); beam(rx(y0), y0, lx(y1), y1, o.lw * 0.55 || 1.6);
      beam(lx(y1), y1, rx(y1), y1, o.lw * 0.7 || 2);
    }
    beam(x, base, lx(top), top, o.lw || 3.4); beam(x + w, base, rx(top), top, o.lw || 3.4);
    // lit leg (right side faces the light)
    g.beginPath(); g.moveTo(x + w - 1, base); g.lineTo(rx(top) - 1, top); ink(g, 1.1, C.rim || C.lit);
    // crown block + sheave
    g.fillStyle = C.base; g.fillRect(lx(top) - 8, top - 16, tw + 16, 16); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(lx(top) - 8, top - 16, tw + 16, 16);
    g.beginPath(); g.arc(x + w / 2, top - 22, 11, 0, TAU); g.fillStyle = C.dark; g.fill(); ink(g, 2, o.inkCol);
    // drill string
    g.beginPath(); g.moveTo(x + w / 2, top - 20); g.lineTo(x + w / 2, base - (o.bitUp || 0)); ink(g, 5, o.inkCol); g.beginPath(); g.moveTo(x + w / 2, top - 20); g.lineTo(x + w / 2, base - (o.bitUp || 0)); ink(g, 2.6, C.lit);
    // decks
    for (const k of o.decks || [0.32, 0.62]) {
      const y = base - h * k, a = lx(y) - 14, b = rx(y) + 14;
      g.fillStyle = C.dark; g.fillRect(a, y - 5, b - a, 7); g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(a, y - 5, b - a, 7);
      g.beginPath(); for (let px = a + 4; px < b; px += 10) { g.moveTo(px, y - 5); g.lineTo(px, y - 18); } g.moveTo(a, y - 18); g.lineTo(b, y - 18); ink(g, 1.1, C.base);
    }
  }

  // scaffold tower: timber X frames, lashings, plank decks
  function scaffold(g, rng, x, base, w, h, C) {
    const lv = Math.max(2, Math.round(h / 90));
    for (let i = 0; i < lv; i++) {
      const y0 = base - (h * i) / lv, y1 = base - (h * (i + 1)) / lv;
      g.beginPath(); g.moveTo(x, y0); g.lineTo(x + w, y1); g.moveTo(x + w, y0); g.lineTo(x, y1); ink(g, 4.2); g.beginPath(); g.moveTo(x, y0); g.lineTo(x + w, y1); g.moveTo(x + w, y0); g.lineTo(x, y1); ink(g, 2.2, C.base);
      g.fillStyle = C.lit; g.fillRect(x - 10, y1 - 4, w + 20, 7); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(x - 10, y1 - 4, w + 20, 7);
    }
    for (const px of [x, x + w]) { g.beginPath(); g.moveTo(px, base + 10); g.lineTo(px, base - h - 10); ink(g, 6.5); g.beginPath(); g.moveTo(px, base + 10); g.lineTo(px, base - h - 10); ink(g, 3.8, px === x ? C.dark : C.base); }
  }

  // a canvas tent (Descent III camp)
  function tent(g, x, base, w, h, C) {
    const sil = [[x, base], [x + w * 0.5, base - h], [x + w, base]];
    poly(g, sil); g.fillStyle = C.base; g.fill();
    g.save(); g.clip();
    g.fillStyle = C.dark; poly(g, [[x, base], [x + w * 0.5, base - h], [x + w * 0.42, base]]); g.fill();
    g.fillStyle = C.lit; poly(g, [[x + w * 0.5, base - h], [x + w, base], [x + w * 0.78, base]]); g.fill();
    g.fillStyle = C.stripe; g.fillRect(x, base - h * 0.42, w, h * 0.09);
    g.fillStyle = '#05030a'; poly(g, [[x + w * 0.42, base], [x + w * 0.5, base - h * 0.62], [x + w * 0.58, base]]); g.fill();
    g.strokeStyle = U.rgba('#05030a', 0.35); g.lineWidth = 1; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x + w * 0.5, base - h); g.lineTo(x + (w * k) / 5, base); g.stroke(); }
    g.restore();
    poly(g, sil); ink(g, 2.2);
    g.beginPath(); g.moveTo(x + w * 0.5, base - h); g.lineTo(x + w * 0.5, base - h - 14); ink(g, 2.6);
    g.beginPath(); g.moveTo(x + w * 0.5, base - h - 6); g.lineTo(x - 20, base); g.moveTo(x + w * 0.5, base - h - 6); g.lineTo(x + w + 20, base); ink(g, 0.9, 'rgba(10,6,14,0.8)');
  }

  // horizontal water body with reflection streaks (static part; live glints are drawn per frame)
  function water(g, rng, x0, x1, y0, depth, t, o = {}) {
    const gr = g.createLinearGradient(0, y0, 0, y0 + depth);
    gr.addColorStop(0, mixH(o.top || '#123844', '#2a1440', t)); gr.addColorStop(0.25, mixH('#071a24', '#12081e', t)); gr.addColorStop(1, '#03060b');
    g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, depth);
    const gl = mixH('#9ff7ff', '#e6a8ff', t);
    for (let k = 0; k < (x1 - x0) / (o.dens || 14); k++) {
      const sx = x0 + rng() * (x1 - x0), sy = y0 + 2 + Math.pow(rng(), 2.2) * Math.min(depth, o.reach || 160), sl = 6 + rng() * (o.len || 60);
      g.fillStyle = U.rgba(gl, (0.08 + rng() * 0.3) * (1 - (sy - y0) / Math.min(depth, (o.reach || 160) * 1.3)));
      g.fillRect(sx, sy, sl, 1.2);
    }
    g.fillStyle = U.rgba(gl, 0.55); g.fillRect(x0, y0, x1 - x0, 1.2);
  }
  // mirror a draw function about the water line (reflections)
  // (clipped to the water: a body's buried 'deep' root must not flip up above the waterline as a pale slab)
  function mirrored(g, y0, a, fn) { g.save(); g.beginPath(); g.rect(-1e6, y0, 2e6, 1e6); g.clip(); g.globalAlpha = a; g.translate(0, y0 * 2); g.scale(1, -1); fn(); g.restore(); }

  /* ============================== parallax layers ============================== */
  const SPAN = [-400, BOSS_X1];
  const layerRange = (f) => [SPAN[0] * f - 700, SPAN[1] * f + 700];

  // a fill whose colour follows the zone tint continuously along x: a slow layer squeezes thousands of world units into one
  // segment, so a flat per-segment colour would change in hard vertical steps where two segments meet
  function xgrad(g, x0, x1, f, colAt) {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    for (const u of [0, 0.5, 1]) gr.addColorStop(u, colAt(tintAt((x0 + (x1 - x0) * u) / f)));
    return gr;
  }
  // ceiling band: lumpy mass with hanging stalactites (deterministic noise so tiles join seamlessly)
  function ceilingSeg(objs, f, x, segW, yb, amp, seed, mkC, stal) {
    const rng0 = U.mulberry32(seed);
    const sd = (rng0() * 1e9) | 0;
    objs.push({ x: x - 70, y: -2400, w: segW + 140, h: 2400 + yb + amp + stal.len[1] + 40, draw(g) {
      const rng = U.mulberry32(sd), t = tintAt((x + segW / 2) / f), C = mkC(t);
      // the contour noise is seeded per layer (seed − x), not per segment, so neighbouring segments meet without a step
      const ps = seed - Math.round(x), prof = (px) => yb - amp * nz(px * 0.011, ps) - amp * 0.5 * nz(px * 0.047, 7);
      // samples always include both ends (segW is not always a multiple of 8) and overlap the neighbour by 1.5 px (no AA hairline)
      const xs = [x - 1.5]; for (let px = x; px < x + segW; px += 8) xs.push(px); xs.push(x + segW, x + segW + 1.5);
      const pts = [[x - 1.5, -2400]].concat(xs.map((px) => [px, prof(px)]), [[x + segW + 1.5, -2400]]);
      poly(g, pts); g.fillStyle = xgrad(g, x, x + segW, f, (q) => mkC(q).dark); g.fill();
      g.save(); g.clip();
      // lit band above the dark lip (a polygon, not 8-px stamps: those read as pixel stairs up close)
      const bTop = [], bBot = [];
      for (const px of xs) { const lift = 10 * nz(px * 0.035, 3), y = prof(px); bTop.push([px, y - 26 - lift]); bBot.push([px, y - lift]); }
      poly(g, bTop.concat(bBot.reverse())); g.fillStyle = xgrad(g, x, x + segW, f, (q) => mkC(q).base); g.fill();
      g.restore();
      path(g, pts.slice(1, -1)); ink(g, stal.ink || 1.4, C.ink);
      path(g, pts.slice(1, -1).map(([a, b]) => [a, b - 2])); ink(g, 1, U.rgba(P('rim', t), stal.rimA || 0.18));
      const n = stal.n[0] + Math.floor(rng() * (stal.n[1] - stal.n[0] + 1));
      for (let i = 0; i < n; i++) {
        const sx = x + 20 + rng() * (segW - 40), w = stal.w[0] + rng() * (stal.w[1] - stal.w[0]), len = stal.len[0] + Math.pow(rng(), 1.6) * (stal.len[1] - stal.len[0]);
        const tip = spike(g, rng, sx, prof(sx) - 6, w, len, C, { down: true, deep: 60, pow: 0.9, ink: stal.ink, rimW: 1 });
        if (stal.drops && rng() < 0.5) { disc(g, tip[0], tip[1] + 3, 7, P('rim', t), 0.5); g.fillStyle = mixH(P('rim', t), '#ffffff', 0.5); g.beginPath(); g.arc(tip[0], tip[1] + 3, 1.6, 0, TAU); g.fill(); }
      }
    } });
  }
  // floor band: lumpy top line, cel strata (skipped over the lake — water instead)
  function floorSeg(objs, f, x, segW, y0, amp, seed, mkC, o = {}) {
    objs.push({ x: x - 4, y: y0 - amp * 2 - 10, w: segW + 8, h: 900, draw(g) {
      const t = tintAt((x + segW / 2) / f), C = mkC(t);
      const ps = seed - Math.round(x), prof = (px) => y0 - amp * nz(px * 0.02, ps) - amp * 0.4 * nz(px * 0.09, 5);
      const xs = [x - 1.5]; for (let px = x; px < x + segW; px += 8) xs.push(px); xs.push(x + segW, x + segW + 1.5);
      const pts = [[x - 1.5, 900]].concat(xs.map((px) => [px, prof(px)]), [[x + segW + 1.5, 900]]);
      poly(g, pts); g.fillStyle = xgrad(g, x, x + segW, f, (q) => mkC(q).base); g.fill();
      g.save(); g.clip(); g.fillStyle = xgrad(g, x, x + segW, f, (q) => mkC(q).dark); g.fillRect(x - 2, y0 + 26, segW + 4, 900); g.fillStyle = xgrad(g, x, x + segW, f, (q) => mixH(mkC(q).dark, '#000000', 0.4)); g.fillRect(x - 2, y0 + 110, segW + 4, 900); g.restore();
      path(g, pts.slice(1, -1)); ink(g, o.ink || 1.4, C.ink);
      path(g, pts.slice(1, -1).map(([a, b]) => [a, b + 1.5])); ink(g, 1, U.rgba(P('rim', t), o.rimA || 0.2));
    } });
  }

  function genFar() {
    const f = 0.08, objs = [], rng = U.mulberry32(3301);
    const [X0, X1] = layerRange(f);
    const mkC = (t) => massC(t, mixH(P('far', t), '#0a0818', 0.15), 0.32, 0.22);
    // distant biolume forests: pin-pricks of light low on the far floor
    for (let x = X0; x < X1; x += 60 + rng() * 120) {
      const sx = x, sd = (rng() * 1e9) | 0;
      objs.push({ x: sx - 40, y: -140, w: 80, h: 150, draw(g) {
        const r = U.mulberry32(sd), t = tintAt(sx / f), col = r() < 0.25 + t * 0.6 ? '#c45cff' : '#5ff2e0';
        disc(g, sx, -20, 36, col, 0.16);
        for (let k = 0; k < 7; k++) { g.fillStyle = U.rgba(mixH(col, '#ffffff', 0.5), 0.4 + r() * 0.5); g.fillRect(sx + (r() - 0.5) * 50, -4 - r() * 60, 1.4, 1.4); }
      } });
    }
    // columns: stalactite and stalagmite fused into hourglass pillars
    for (let x = X0; x < X1; x += 120 + rng() * 210) {
      const sx = x, w = 34 + rng() * 80, sd = (rng() * 1e9) | 0, waist = -160 - rng() * 110, fused = rng() < 0.7;
      objs.push({ x: sx - w - 20, y: -900, w: w * 2 + 40, h: 1000, draw(g) {
        const r = U.mulberry32(sd), t = tintAt(sx / f), C = massC(t, mixH(P('far', t), P('fog', t), 0.12), 0.38, 0.25);
        C.ink = U.rgba('#05030a', 0.45);
        spike(g, r, sx, -520, w * 1.05, (fused ? 520 + waist + 40 : 140 + r() * 120), C, { down: true, deep: 400, pow: 0.55, ink: 1, rimW: 1 });
        spike(g, r, sx + (r() - 0.5) * 8, 20, w * 1.2, (fused ? -waist + 30 : 60 + r() * 100), C, { deep: 300, pow: 0.6, ink: 1, rimW: 1 });
        if (r() < 0.35) shards(g, r, sx + (r() - 0.5) * w * 0.5, waist + 60 + r() * 80, 10 + r() * 14, t > 0.5 ? '#c45cff' : '#5ff2e0', { ink: 0, glowA: 0.35, glowR: 2.6 });
      } });
    }
    for (let x = X0; x < X1; x += 256) ceilingSeg(objs, f, x, 256, -300, 60, 11 + Math.round(x), mkC, { n: [2, 4], w: [16, 46], len: [30, 170], ink: 1, rimA: 0.16 });
    for (let x = X0; x < X1; x += 256) {
      const wx = (x + 128) / f;
      if (wx > LAKE[0] - 150 && wx < LAKE[1] + 100) continue;
      floorSeg(objs, f, x, 256, 12, 10, 21 + Math.round(x), mkC, { ink: 1, rimA: 0.12 });
    }
    // the far shore of the still lake (mirror water)
    objs.push({ x: LAKE[0] * f - 30, y: -10, w: (LAKE[1] - LAKE[0]) * f + 60, h: 720, draw(g) {
      water(g, U.mulberry32(5), LAKE[0] * f - 30, LAKE[1] * f + 30, 4, 700, 0.15, { dens: 6, len: 26, reach: 80 });
    } });
    /* landmarks */
    // A: the shaft we fell through — a crack of pale light far above and the snapped tether dangling in it
    // (kept inside one 512-px layer tile: its translucent light would show a bright seam where two tiles overlap)
    objs.push({ x: 30, y: -1600, w: 160, h: 1620, draw(g) {
      const cx = 100;
      g.save(); g.globalCompositeOperation = 'lighter';
      const bg = g.createLinearGradient(0, -1600, 0, 10); bg.addColorStop(0, 'rgba(210,240,255,0.42)'); bg.addColorStop(0.55, 'rgba(160,220,240,0.14)'); bg.addColorStop(1, 'rgba(120,200,220,0.03)');
      g.fillStyle = bg; poly(g, [[cx - 6, -1600], [cx + 9, -1600], [cx + 60, 10], [cx - 40, 10]]); g.fill();
      g.restore();
      g.strokeStyle = 'rgba(20,24,34,0.85)'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(cx + 2, -1600); g.bezierCurveTo(cx + 4, -900, cx - 6, -500, cx + 8, -240); g.stroke();
      g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx + 8, -240); g.lineTo(cx + 14, -228); g.moveTo(cx + 8, -240); g.lineTo(cx + 2, -226); g.stroke();
    } });
    // B: the great fossil organ, far away — rows of pipes under a rib vault
    const ox = 3900 * f;
    objs.push({ x: ox - 190, y: -620, w: 380, h: 640, draw(g) {
      const r = U.mulberry32(77), t = tintAt(3900), C = massC(t, mixH(BONE.base[0], P('far', t), 0.55), 0.35, 0.3); C.ink = 'rgba(5,3,10,0.5)'; C.rim2 = P('rim', t);
      ribArch(g, r, ox - 180, ox + 180, 10, 300, 16, C, { ink: 1.2 });
      for (let i = -6; i <= 6; i++) { const h = 330 - Math.abs(i) * 34 + r() * 20, w = 16 - Math.abs(i) * 0.4; organPipe(g, r, ox + i * 21 - w / 2, 10, w, h, C, { broken: Math.abs(i) > 3 && r() < 0.6, ink: 1, ring: 26, glowMouth: '#5ff2e0' }); }
    } });
    // C: "the chandelier" — a colossal crystal-hung stalactite over the lake, mirrored in the still water
    const chx = 6650 * f;
    objs.push({ x: chx - 90, y: -700, w: 180, h: 900, draw(g) {
      const t = 0.18, C = massC(t, P('far', t), 0.25, 0.3); C.ink = 'rgba(5,3,10,0.5)';
      const body = () => { const r = U.mulberry32(91); spike(g, r, chx, -560, 70, 480, C, { down: true, deep: 200, pow: 0.7, ink: 1, lean: 0 }); for (let k = 0; k < 6; k++) shards(g, r, chx + (r() - 0.5) * 50, -380 + k * 40, 10 + r() * 10, '#7ffcff', { base: PI / 2, spread: 1.2, ink: 0, glowA: 0.4, glowR: 2.4 }); };
      body(); mirrored(g, 4, 0.22, body);
    } });
    // D: derricks of Descent III on the horizon
    for (const [dx, dh] of [[8500, 230], [9200, 180], [9700, 150]]) {
      const x = dx * f;
      objs.push({ x: x - 50, y: -dh - 50, w: 100, h: dh + 70, draw(g) {
        const t = tintAt(dx), C = { base: mixH(P('far', t), '#0a0818', 0.3), lit: mixH(P('far', t), P('rim', t), 0.3), dark: '#0a0818', rim: U.rgba(P('rim', t), 0.3) };
        derrick(g, x - 22, 12, 44, dh, C, { lw: 1.6, levels: 7, decks: [0.4], inkCol: 'rgba(5,3,10,0.6)' });
        disc(g, x, 12 - dh * 0.4, 14, '#ffb85c', 0.25);
      } });
    }
    // E: the heart of the Rest — a giant violet geode ring breathing light
    const gx = 12400 * f;
    objs.push({ x: gx - 280, y: -560, w: 560, h: 600, draw(g) {
      const r = U.mulberry32(404);
      disc(g, gx, -230, 260, '#c45cff', 0.32); disc(g, gx, -230, 120, '#ff7ad8', 0.22);
      for (let k = 0; k < 26; k++) { const a = (k / 26) * TAU + r() * 0.2, rr = 150 + r() * 30; shards(g, r, gx + Math.cos(a) * rr, -230 + Math.sin(a) * rr * 0.9, 18 + r() * 26, '#c45cff', { base: a + PI, spread: 0.7, n: 2, ink: 0.8, inkCol: 'rgba(20,6,30,0.6)', glow: false }); }
      g.strokeStyle = 'rgba(255,170,240,0.35)'; g.lineWidth = 3; g.beginPath(); g.ellipse(gx, -230, 128, 116, 0, 0, TAU); g.stroke();
    } });
    return objs;
  }

  function genMid() {
    const f = 0.22, objs = [], rng = U.mulberry32(4402);
    const [X0, X1] = layerRange(f);
    const mkC = (t) => massC(t, mixH(P('mid', t), '#07060f', 0.2), 0.18, 0.3);
    // lake water first (formations reflect into it)
    objs.push({ x: LAKE[0] * f - 60, y: -6, w: (LAKE[1] - LAKE[0]) * f + 120, h: 720, draw(g) {
      water(g, U.mulberry32(6), LAKE[0] * f - 60, LAKE[1] * f + 60, -2, 720, 0.18, { dens: 5, len: 46, reach: 120 });
    } });
    for (let x = X0; x < X1; x += 300) {
      const wx = (x + 150) / f;
      if (wx > LAKE[0] - 120 && wx < LAKE[1] + 80) continue;
      floorSeg(objs, f, x, 300, 20, 14, 33 + Math.round(x), mkC, { ink: 1.3, rimA: 0.22 });
    }
    // formations by zone
    let x = X0;
    while (x < X1) {
      const wx = x / f, zn = zoneOf(wx), sd = (rng() * 1e9) | 0, sx = x;
      const inLake = wx > LAKE[0] - 60 && wx < LAKE[1] + 40;
      let step = 90 + rng() * 140;
      if (zn === 'B' && rng() < 0.42) {
        // organ pipe groups and rib arches
        const n = 4 + Math.floor(rng() * 6), pw = 14 + rng() * 10, hmax = 200 + rng() * 240;
        objs.push({ x: sx - 40, y: -hmax - 120, w: n * pw * 1.15 + 80, h: hmax + 160, draw(g) {
          const r = U.mulberry32(sd), t = tintAt(sx / f), C = massC(t, mixH(BONE.base[0], P('mid', t), 0.45), 0.2, 0.32); C.rim2 = P('rim', t);
          for (let i = 0; i < n; i++) { const h = hmax * (0.45 + 0.55 * Math.sin(((i + 0.5) / n) * PI)) * (0.85 + r() * 0.2); organPipe(g, r, sx + i * pw * 1.12, 22, pw, h, C, { ink: 1.3, xtal: t > 0.5 ? '#c45cff' : '#5ff2e0', inkX: 1, glowMouth: r() < 0.4 ? '#5ff2e0' : null }); }
        } });
        step = n * pw * 1.15 + 60 + rng() * 80;
      } else if (zn === 'B' && rng() < 0.3) {
        const span = 180 + rng() * 160, hg = 220 + rng() * 160;
        objs.push({ x: sx - 30, y: -hg - 60, w: span + 60, h: hg + 140, draw(g) {
          const r = U.mulberry32(sd), t = tintAt(sx / f), C = massC(t, mixH(BONE.base[0], P('mid', t), 0.4), 0.2, 0.3);
          ribArch(g, r, sx, sx + span, 20, hg, 13, C, { ink: 1.5 });
        } });
        step = span * 0.6;
      } else if (zn === 'D' && rng() < 0.45) {
        const kind = rng();
        objs.push({ x: sx - 70, y: -420, w: 220, h: 460, draw(g) {
          const r = U.mulberry32(sd), t = tintAt(sx / f), C = massC(t, mixH('#3a3640', P('mid', t), 0.4), 0.22, 0.3);
          if (kind < 0.45) { derrick(g, sx, 22, 70, 300 + r() * 80, C, { lw: 2.2, levels: 8, inkCol: C.ink }); disc(g, sx + 35, 22 - 150, 22, '#ffb85c', 0.18); }
          else if (kind < 0.75) scaffold(g, r, sx, 22, 46, 140 + r() * 120, C);
          else tent(g, sx, 22, 90, 54, { base: mixH('#6b6250', P('mid', t), 0.45), lit: mixH('#8d8366', P('mid', t), 0.4), dark: mixH('#3a3530', P('mid', t), 0.4), stripe: mixH('#c46a2a', P('mid', t), 0.45) });
        } });
        step = 160 + rng() * 120;
      } else if (zn === 'E' || zn === 'M') {
        const s = 40 + rng() * 90;
        objs.push({ x: sx - s * 2, y: -s * 2.6, w: s * 4, h: s * 2.6 + 60, draw(g) {
          const r = U.mulberry32(sd), t = tintAt(sx / f), C = mkC(t);
          spike(g, r, sx, 22, s * 0.9, s * (0.8 + r() * 1.2), C, { ink: 1.3 });
          shards(g, r, sx + (r() - 0.5) * s, 20, s * (0.6 + r() * 0.5), '#c45cff', { ink: 1.1, inkCol: 'rgba(16,4,26,0.8)', glowA: 0.32 });
        } });
        step = s * 1.4 + rng() * 120;
      } else {
        // rock spire clusters with crystals (A, C islands, B fill)
        const k = 1 + Math.floor(rng() * 3), hb = 90 + rng() * 230;
        objs.push({ x: sx - 80, y: -hb - 80, w: 260, h: hb + 160, draw(g) {
          const r = U.mulberry32(sd), t = tintAt(sx / f), C = mkC(t);
          const body = () => { const r2 = U.mulberry32(sd + 1); for (let i = 0; i < k; i++) spike(g, r2, sx + i * 38 + r2() * 20, 22, 40 + r2() * 50, hb * (0.5 + r2() * 0.6), C, { ink: 1.3 }); if (r2() < 0.6) shards(g, r2, sx + r2() * 60, 18, 14 + r2() * 18, tintAt(sx / f) > 0.4 ? '#c45cff' : '#5ff2e0', { ink: 1, glowA: 0.3 }); };
          if (inLake) mirrored(g, 20, 0.28, body);
          body(); void r;
        } });
        step = 110 + k * 40 + rng() * 120;
      }
      x += step;
    }
    // the great organ facade (signature of the Organ Caverns)
    const ox = 4050 * f;
    objs.push({ x: ox - 330, y: -720, w: 660, h: 760, draw(g) {
      const r = U.mulberry32(1203), t = tintAt(4050), C = massC(t, mixH(BONE.base[0], P('mid', t), 0.32), 0.14, 0.4); C.rim2 = P('rim', t);
      ribArch(g, r, ox - 310, ox + 310, 22, 560, 20, C, { ink: 1.8 });
      ribArch(g, r, ox - 250, ox + 250, 22, 470, 14, C, { ink: 1.5 });
      for (let i = -8; i <= 8; i++) {
        const h = 470 - Math.abs(i) * 40 + (i % 2 ? -30 : 0), w = 24 - Math.abs(i) * 0.6;
        organPipe(g, r, ox + i * 27 - w / 2, 22, w, Math.max(80, h), C, { broken: Math.abs(i) > 5, ink: 1.4, ring: 30, glowMouth: '#5ff2e0', xtal: Math.abs(i) > 4 ? '#5ff2e0' : null, inkX: 1 });
      }
      disc(g, ox, -140, 160, '#5ff2e0', 0.12);
    } });
    // the chandelier stalactite over the lake (mid-depth echo of the far one)
    const chx = 6980 * f;
    objs.push({ x: chx - 140, y: -900, w: 280, h: 1300, draw(g) {
      const t = 0.2, C = mkC(t);
      const body = () => { const r = U.mulberry32(1307); spike(g, r, chx, -700, 120, 560, C, { down: true, deep: 300, pow: 0.75, ink: 1.6, lean: 0.1 }); for (let k = 0; k < 9; k++) shards(g, r, chx + (r() - 0.5) * 90 * (1 - k / 10), -520 + k * 40, 12 + r() * 14, '#7ffcff', { base: PI / 2, spread: 1.3, ink: 1, glowA: 0.4, glowR: 2.2 }); };
      body(); mirrored(g, -2, 0.3, body);
    } });
    for (let x2 = X0; x2 < X1; x2 += 300) ceilingSeg(objs, f, x2, 300, -390, 50, 41 + Math.round(x2), mkC, { n: [2, 4], w: [20, 60], len: [40, 210], ink: 1.3, rimA: 0.24, drops: true });
    return objs;
  }

  function genNear() {
    const f = 0.45, objs = [], rng = U.mulberry32(5503);
    const [X0, X1] = layerRange(f);
    const mkC = (t) => { const b = mixH(P('near', t), '#05040a', 0.15); return { base: b, lit: mixH(b, P('rim', t), 0.16), dark: mixH(b, '#030208', 0.5), rim: U.rgba(P('rim', t), 0.55), ridge: '#030208', ink: INK }; };
    objs.push({ x: LAKE[0] * f - 80, y: 30, w: (LAKE[1] - LAKE[0]) * f + 160, h: 800, draw(g) {
      water(g, U.mulberry32(7), LAKE[0] * f - 80, LAKE[1] * f + 80, 36, 800, 0.2, { dens: 7, len: 70, reach: 150 });
    } });
    for (let x = X0; x < X1; x += 320) {
      const wx = (x + 160) / f;
      if (wx > LAKE[0] - 60 && wx < LAKE[1] + 40) continue;
      floorSeg(objs, f, x, 320, 44, 16, 55 + Math.round(x), mkC, { ink: 2, rimA: 0.35 });
    }
    let x = X0;
    while (x < X1) {
      const wx = x / f, zn = zoneOf(wx), sd = (rng() * 1e9) | 0, sx = x;
      const inLake = wx > LAKE[0] - 40 && wx < LAKE[1] + 20;
      const roll = rng();
      let step = 180 + rng() * 260;
      if (zn === 'D' && roll < 0.5) {
        const kind = rng();
        objs.push({ x: sx - 60, y: -330, w: 220, h: 400, draw(g) {
          const r = U.mulberry32(sd), t = tintAt(sx / f), C = mkC(t);
          if (kind < 0.55) scaffold(g, r, sx, 44, 60, 200 + r() * 90, { base: mixH('#4a3a2c', C.base, 0.5), lit: mixH('#6a5238', C.base, 0.45), dark: mixH('#2a2018', C.base, 0.5) });
          else {
            // ore cart on a rail stub
            g.fillStyle = C.dark; g.fillRect(sx - 30, 40, 150, 4); ink(g, 1);
            poly(g, [[sx, 4], [sx + 90, 4], [sx + 80, 34], [sx + 10, 34]]); g.fillStyle = mixH('#5a4a3c', C.base, 0.4); g.fill(); ink(g, 2);
            g.fillStyle = U.rgba(P('rim', t), 0.4); g.fillRect(sx + 4, 6, 84, 2);
            for (const wx2 of [sx + 22, sx + 68]) { g.beginPath(); g.arc(wx2, 38, 8, 0, TAU); g.fillStyle = '#1a1418'; g.fill(); ink(g, 1.6); }
            shards(g, r, sx + 45, 6, 16, '#c45cff', { ink: 1, glowA: 0.25 });
          }
        } });
      } else if (zn === 'B' && roll < 0.45) {
        const n = 2 + Math.floor(rng() * 3), pw = 26 + rng() * 14;
        objs.push({ x: sx - 40, y: -470, w: n * pw * 1.2 + 80, h: 540, draw(g) {
          const r = U.mulberry32(sd), t = tintAt(sx / f), C = mkC(t); C.base = mixH(C.base, BONE.dark[0], 0.25); C.lit = mixH(C.base, BONE.lit[0], 0.18); C.rim2 = P('rim', t);
          for (let i = 0; i < n; i++) organPipe(g, r, sx + i * pw * 1.2, 46, pw, 200 + r() * 230, C, { ink: 2.2, xtal: '#5ff2e0', inkX: 1.4 });
        } });
      } else if (roll < 0.62) {
        // big dark stalagmite with rim light + fungus at its foot
        const w = 50 + rng() * 80, h = 140 + rng() * 280;
        objs.push({ x: sx - w - 40, y: -h - 40, w: w * 2 + 80, h: h + 120, draw(g) {
          const r = U.mulberry32(sd), t = tintAt(sx / f), C = mkC(t);
          const body = () => { const r2 = U.mulberry32(sd + 3); spike(g, r2, sx, 46, w, h, C, { ink: 2.2, rimW: 1.6 }); };
          if (inLake) mirrored(g, 38, 0.3, body);
          body();
          if (!inLake && r() < 0.7) fungus(g, r, sx + (r() - 0.5) * w, 46, 5 + r() * 4, zn === 'E' || zn === 'M' ? '#d77bff' : '#6ff0d2');
          if ((zn === 'E' || zn === 'M') && r() < 0.8) shards(g, r, sx + w * 0.3, 44, 22 + r() * 22, '#c45cff', { ink: 1.6, glowA: 0.35 });
        } });
        step = w + 120 + rng() * 200;
      } else if (roll < 0.8 && !inLake) {
        const s = 6 + rng() * 6;
        objs.push({ x: sx - 60, y: -40, w: 120, h: 90, draw(g) { const r = U.mulberry32(sd), t = tintAt(sx / f); fungus(g, r, sx, 46, s, t > 0.55 ? '#d77bff' : '#6ff0d2', { n: 3 + Math.floor(r() * 3) }); } });
        step = 120 + rng() * 160;
      }
      x += step;
    }
    // hanging glow-roots from the ceiling
    for (let x2 = X0; x2 < X1; x2 += 140 + rng() * 260) {
      const sx = x2, sd = (rng() * 1e9) | 0, len = 120 + rng() * 220;
      objs.push({ x: sx - 60, y: -720, w: 120, h: 720 - 480 + len + 60, draw(g) {
        const r = U.mulberry32(sd), t = tintAt(sx / f), col = t > 0.55 ? '#d77bff' : '#6ff0d2';
        roots(g, r, sx, -560, len, col, mixH(P('near', t), '#2a3a3a', 0.3), { n: 2 + Math.floor(r() * 2), w: 2.2 });
      } });
    }
    for (let x2 = X0; x2 < X1; x2 += 320) ceilingSeg(objs, f, x2, 320, -540, 70, 61 + Math.round(x2), mkC, { n: [1, 3], w: [34, 110], len: [60, 260], ink: 2.2, rimA: 0.4, drops: true });
    return objs;
  }

  /* ============================== gameplay plane ============================== */
  const GLOW = [];  // live glow points registered by the props; drawn (pulsing) per frame in drawBack
  const glowAt = (x, y, r, c, a = 0.5, o = {}) => GLOW.push({ x, y, r, c, a, ph: (x * 0.013) % TAU, sp: o.sp || 1.1, breath: !!o.breath });

  // split a long solid into tile-sized chunks so each cached tile only paints its own slice
  function chunks(s, step, margin, fn, hMax = 700) {
    const out = [];
    for (let cx = s.x; cx < s.x + s.w; cx += step) {
      const x0 = cx, x1 = Math.min(s.x + s.w, cx + step), seed = (Math.round(x0) * 7919 + Math.round(s.y) * 31 + 17) | 0;
      out.push({ x: x0 - margin, y: s.y - margin, w: x1 - x0 + margin * 2, h: Math.min(s.h, hMax) + margin * 2, draw(g) { fn(g, x0, x1, U.mulberry32(seed)); } });
    }
    return out;
  }
  function bandFill(g, x0, x1, fa, fb, col) {
    const pts = [];
    for (let x = x0; x <= x1 + 0.1; x += 12) pts.push([Math.min(x, x1), fa(Math.min(x, x1))]);
    for (let x = x1; x >= x0 - 0.1; x -= 12) pts.push([Math.max(x, x0), fb(Math.max(x, x0))]);
    poly(g, pts); g.fillStyle = col; g.fill();
  }
  // cel-banded rock mass with embedded blocks, cracks and hatching
  function rockBody(g, s, x0, x1, rng, C, o = {}) {
    const top = s.y, bot = s.y + Math.min(s.h, 700);
    const b1 = (x) => top + 22 + 7 * nz(x * 0.03, 3), b2 = (x) => top + 74 + 22 * nz(x * 0.012, 4), b3 = (x) => top + 180 + 40 * nz(x * 0.008, 5);
    g.fillStyle = C.deep; g.fillRect(x0, top, x1 - x0, bot - top);
    bandFill(g, x0, x1, () => top, b3, C.dark); bandFill(g, x0, x1, () => top, b2, C.base); bandFill(g, x0, x1, () => top, b1, C.lit);
    for (const fb of [b1, b2, b3]) { const pts = []; for (let x = x0; x <= x1 + 0.1; x += 12) pts.push([Math.min(x, x1), fb(Math.min(x, x1))]); path(g, pts); ink(g, 0.9, U.rgba(C.crack, 0.55)); }
    for (let k = 0; k < (x1 - x0) / 40; k++) {
      const bw = 18 + rng() * 34, bh = 10 + rng() * 20, bx = x0 + 6 + rng() * Math.max(1, x1 - x0 - bw - 12), by = top + 28 + Math.pow(rng(), 1.3) * 160;
      const pts = [[bx, by + bh * 0.3], [bx + bw * 0.3, by], [bx + bw, by + bh * 0.15], [bx + bw * 0.92, by + bh], [bx + bw * 0.1, by + bh * 0.9]];
      poly(g, pts); g.fillStyle = U.rgba(o.stone || C.base, 0.85); g.fill(); ink(g, 1, U.rgba(C.crack, 0.8));
      g.beginPath(); g.moveTo(pts[1][0] + 1, pts[1][1] + 1.2); g.lineTo(pts[2][0] - 1, pts[2][1] + 1.2); ink(g, 1.1, U.rgba(C.top, 0.3));
      g.beginPath(); g.moveTo(pts[4][0] + 2, pts[4][1] - 1.5); g.lineTo(pts[3][0] - 2, pts[3][1] - 1.5); ink(g, 1.4, U.rgba('#05030a', 0.35));
    }
    g.strokeStyle = U.rgba(C.crack, 0.85); g.lineWidth = 1.2;
    for (let x = x0 + rng() * 60; x < x1 - 10; x += 50 + rng() * 120) {
      let cx = x, cy = top + 3; const end = top + 70 + rng() * 90; g.beginPath(); g.moveTo(cx, cy);
      while (cy < end) { cx = clamp(cx + (rng() - 0.5) * 14, x0 + 2, x1 - 2); cy += 8 + rng() * 12; g.lineTo(cx, cy); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(4,2,10,0.35)'; g.lineWidth = 0.8; g.beginPath();
    for (let x = x0 + 4; x < x1 - 8; x += 7) { const y = b2(x) + 8 + ((x * 7) % 23); g.moveTo(x, y); g.lineTo(x + 6, y - 7); }
    g.stroke();
  }
  // surface: pebbles, ink edge, glowing moss; sprouts of crystal and fungus
  function rockTop(g, s, x0, x1, rng, C, t, o = {}) {
    const top = s.y;
    g.fillStyle = INK; g.fillRect(x0, top - 1.6, x1 - x0, 2.8);
    g.fillStyle = C.lip; g.fillRect(x0, top + 1.2, x1 - x0, 3.6);
    for (let x = x0 + 4; x < x1 - 6; x += 8 + rng() * 22) { const r = 1.6 + rng() * 3.4; g.beginPath(); g.ellipse(x, top + 1, r * 1.5, r, 0, PI, 0); g.fillStyle = rng() < 0.5 ? C.lip : C.lit; g.fill(); ink(g, 0.8); }
    g.strokeStyle = C.top; g.lineWidth = 1.2; g.beginPath();
    for (let x = x0 + 3; x < x1 - 3; x += 3 + rng() * 8) if (nz(x * 0.012, 9) > (o.moss != null ? o.moss : 0.4)) { const h = 2 + rng() * 5; g.moveTo(x, top + 1); g.lineTo(x + (rng() - 0.5) * 4, top - h); }
    g.stroke();
    if (o.sprouts !== false) for (let x = x0 + 30; x < x1 - 30; x += 90 + rng() * 260) {
      const r = rng();
      if (r < 0.32) shards(g, rng, x, top + 2, 7 + rng() * 9, o.xtal || (t > 0.5 ? '#c45cff' : '#5ff2e0'), { ink: 1, glowA: 0.3 });
      else if (r < 0.58) fungus(g, rng, x, top + 1, 2.4 + rng() * 2, o.fung || (t > 0.5 ? '#d77bff' : '#6ff0d2'), { n: 2 + Math.floor(rng() * 3) });
    }
  }
  function edgeFaces(g, s, x0, x1, C) {
    const h = Math.min(s.h, 260);
    if (x0 === s.x) { g.fillStyle = C.dark; g.fillRect(s.x, s.y, 6, h); g.fillStyle = U.rgba(C.top, 0.25); g.fillRect(s.x + 6, s.y + 4, 1.2, h - 4); g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x, s.y + h); ink(g, 2.4); }
    if (x1 === s.x + s.w) { g.fillStyle = C.lip; g.fillRect(s.x + s.w - 6, s.y, 6, h); g.fillStyle = U.rgba(C.top, 0.7); g.fillRect(s.x + s.w - 2.4, s.y + 2, 1.4, h * 0.6); g.beginPath(); g.moveTo(s.x + s.w, s.y); g.lineTo(s.x + s.w, s.y + h); ink(g, 2.4); }
  }
  const rockC = (t, o = {}) => { const C = colsOf(ROCK, t); if (o.violet) C.top = '#ff7ad8'; return C; };

  function paintRock(s) {
    return chunks(s, 384, 40, (g, x0, x1, rng) => {
      const t = tintAt((x0 + x1) / 2), C = rockC(t);
      rockBody(g, s, x0, x1, rng, C); rockTop(g, s, x0, x1, rng, C, t); edgeFaces(g, s, x0, x1, C);
    });
  }
  // fossil-bone floor of the organ caverns: vertebral plates with pores
  function paintOrgan(s) {
    return chunks(s, 384, 40, (g, x0, x1, rng) => {
      const t = tintAt((x0 + x1) / 2), C = rockC(t), B = colsOf(BONE, t);
      rockBody(g, s, x0, x1, rng, C, { stone: B.dark });
      const top = s.y;
      let x = x0;
      while (x < x1 - 6) {
        const w = Math.min(x1 - x, 34 + rng() * 40), h = 14 + rng() * 6;
        g.beginPath(); g.moveTo(x + 2, top); g.lineTo(x + w - 2, top); g.quadraticCurveTo(x + w + 1, top + h * 0.5, x + w - 4, top + h); g.quadraticCurveTo(x + w / 2, top + h + 4, x + 4, top + h); g.quadraticCurveTo(x - 1, top + h * 0.5, x + 2, top); g.closePath();
        g.fillStyle = B.base; g.fill();
        g.save(); g.clip(); g.fillStyle = B.lit; g.fillRect(x, top, w, 4); g.fillStyle = B.dark; g.fillRect(x, top + h - 5, w, 6); g.fillStyle = B.lit; g.fillRect(x + w - 6, top, 4, h); g.restore();
        ink(g, 1.3);
        for (let k = 0; k < w / 12; k++) { g.beginPath(); g.arc(x + 6 + rng() * (w - 12), top + 5 + rng() * (h - 9), 0.9 + rng() * 1.3, 0, TAU); g.fillStyle = B.deep; g.fill(); }
        x += w;
      }
      g.fillStyle = INK; g.fillRect(x0, top - 1.6, x1 - x0, 2.4);
      for (let px = x0 + 40; px < x1 - 40; px += 140 + rng() * 220) if (rng() < 0.55) shards(g, rng, px, top + 3, 8 + rng() * 10, t > 0.4 ? '#c45cff' : '#5ff2e0', { ink: 1, glowA: 0.3 });
      edgeFaces(g, s, x0, x1, C);
    });
  }
  // stone causeway over the still lake: fitted blocks, piers sinking into black water
  function paintCauseway(s) {
    return chunks(s, 380, 40, (g, x0, x1, rng) => {
      const t = tintAt((x0 + x1) / 2), top = s.y, SB = 16;
      water(g, rng, x0, x1, top + SB, 690, t, { dens: 8, len: 80, reach: 150 });
      const stone = { lit: mixH('#8aa0a8', '#9a88b0', t), base: mixH('#5b6d79', '#62557a', t), dark: mixH('#2f3c48', '#33284a', t) };
      for (let px = Math.ceil((x0 - 20) / 200) * 200 + 20; px < x1 - 30; px += 200) {
        const gr = g.createLinearGradient(0, top + SB, 0, top + SB + 170); gr.addColorStop(0, stone.base); gr.addColorStop(1, U.rgba(stone.dark, 0));
        g.fillStyle = gr; g.fillRect(px, top + SB, 34, 170);
        g.fillStyle = U.rgba(stone.lit, 0.35); g.fillRect(px + 28, top + SB, 4, 120);
        g.fillStyle = 'rgba(4,2,10,0.5)'; g.fillRect(px, top + SB, 6, 150);
      }
      g.fillStyle = 'rgba(3,2,8,0.7)'; g.fillRect(x0, top + SB, x1 - x0, 4);
      let x = x0;
      while (x < x1 - 2) {
        const w = Math.min(x1 - x, 26 + rng() * 34);
        g.fillStyle = rng() < 0.5 ? stone.base : mixH(stone.base, stone.dark, 0.25); g.fillRect(x, top, w, SB);
        g.fillStyle = stone.lit; g.fillRect(x, top, w, 3); g.fillRect(x + w - 3, top, 3, SB);
        g.fillStyle = stone.dark; g.fillRect(x, top + SB - 4, w, 4);
        g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(x + 0.6, top + 0.6, w - 1.2, SB - 1.2);
        if (rng() < 0.3) { g.beginPath(); g.moveTo(x + w * 0.3, top + 3); g.lineTo(x + w * 0.45, top + 9); g.lineTo(x + w * 0.4, top + SB - 3); ink(g, 0.8, 'rgba(4,2,10,0.7)'); }
        if (rng() < 0.25) { g.strokeStyle = mixH('#6ff0d2', '#e08cff', t); g.lineWidth = 1; g.beginPath(); for (let k = 0; k < 5; k++) { const mx = x + 3 + rng() * (w - 6); g.moveTo(mx, top + 1); g.lineTo(mx + (rng() - 0.5) * 3, top - 2 - rng() * 4); } g.stroke(); }
        x += w;
      }
      g.fillStyle = INK; g.fillRect(x0, top - 1.6, x1 - x0, 2.4);
      if (x0 === s.x || x1 === s.x + s.w) edgeFaces(g, s, x0, x1, rockC(t));
    });
  }
  // the drill camp boardwalk: planks, nails over rock
  function paintCamp(s) {
    return chunks(s, 384, 40, (g, x0, x1, rng) => {
      const t = tintAt((x0 + x1) / 2), C = rockC(t), top = s.y, PB = 13;
      rockBody(g, { y: top + PB, h: s.h - PB }, x0, x1, rng, C);
      const wood = { lit: '#a27a52', base: '#6c5038', dark: '#3d2b20' };
      let x = x0;
      while (x < x1 - 1) {
        const w = Math.min(x1 - x, 22 + rng() * 14);
        g.fillStyle = rng() < 0.5 ? wood.base : mixH(wood.base, wood.dark, 0.3); g.fillRect(x, top, w, PB);
        g.fillStyle = wood.lit; g.fillRect(x, top, w, 2.2);
        g.fillStyle = 'rgba(4,2,10,0.35)'; g.fillRect(x, top + PB - 3, w, 3);
        g.strokeStyle = 'rgba(30,18,12,0.6)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x + 3, top + 6 + rng() * 3); g.lineTo(x + w - 4, top + 6 + rng() * 3); g.stroke();
        g.fillStyle = '#1c1416'; g.fillRect(x + 3, top + 4, 1.6, 1.6); g.fillRect(x + w - 5, top + 4, 1.6, 1.6);
        g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + PB); g.stroke();
        x += w;
      }
      g.fillStyle = 'rgba(3,2,8,0.75)'; g.fillRect(x0, top + PB, x1 - x0, 3);
      g.fillStyle = INK; g.fillRect(x0, top - 1.6, x1 - x0, 2.4);
      edgeFaces(g, s, x0, x1, C);
    });
  }
  // violet floor of the Rest's breath: dark rock split by glowing magenta veins
  function paintVein(s) {
    return chunks(s, 384, 40, (g, x0, x1, rng) => {
      const t = tintAt((x0 + x1) / 2), C = rockC(Math.max(t, 0.75), { violet: true });
      rockBody(g, s, x0, x1, rng, C);
      const top = s.y;
      for (let k = 0; k < (x1 - x0) / 120; k++) {
        let vx = x0 + 20 + rng() * (x1 - x0 - 40), vy = top + 4;
        const pts = [[vx, vy]], end = top + 120 + rng() * 120;
        while (vy < end) { vx = clamp(vx + (rng() - 0.5) * 30, x0 + 4, x1 - 4); vy += 10 + rng() * 18; pts.push([vx, vy]); }
        disc(g, pts[1][0], pts[1][1], 26, '#ff5ad8', 0.22);
        path(g, pts); ink(g, 5, '#1a0626'); path(g, pts); ink(g, 2.4, '#ff5ad8'); path(g, pts); ink(g, 0.9, '#ffd6f6');
        if (rng() < 0.6) { const b = pts[1 + Math.floor(rng() * (pts.length - 1))]; const bp = [b, [clamp(b[0] + (rng() - 0.5) * 40, x0 + 4, x1 - 4), b[1] + 20 + rng() * 20]]; path(g, bp); ink(g, 3.6, '#1a0626'); path(g, bp); ink(g, 1.6, '#ff5ad8'); }
      }
      rockTop(g, s, x0, x1, rng, C, 1, { xtal: '#c45cff', fung: '#d77bff', moss: 0.5 });
      edgeFaces(g, s, x0, x1, C);
    });
  }
  // ceiling of the lightless adit: rock underside + timber cap beam
  function paintMineRoof(s) {
    const bot = s.y + s.h;
    return chunks({ x: s.x, y: bot - 340, w: s.w, h: 340 }, 320, 30, (g, x0, x1, rng) => {
      const C = rockC(0.55), prof = (x) => bot - 24 - 18 * nz(x * 0.03, 12);
      const pts = [[x0, bot - 340]]; for (let x = x0; x <= x1 + 0.1; x += 10) pts.push([Math.min(x, x1), prof(Math.min(x, x1))]); pts.push([x1, bot - 340]);
      poly(g, pts); g.fillStyle = C.dark; g.fill();
      g.save(); g.clip();
      const bt = [], bb = []; for (let x = x0; x <= x1 + 0.1; x += 10) { const px = Math.min(x, x1), y = prof(px); bt.push([px, y - 16]); bb.push([px, y + 1]); }
      poly(g, bt.concat(bb.reverse())); g.fillStyle = C.base; g.fill(); g.restore();
      path(g, pts.slice(1, -1)); ink(g, 2);
      for (let x = x0 + 20; x < x1 - 20; x += 40 + rng() * 60) spike(g, rng, x, prof(x) - 4, 8 + rng() * 10, 10 + rng() * 22, C, { down: true, deep: 20, ink: 1.2, hatch: false, ridges: false });
      g.fillStyle = '#4a3626'; g.fillRect(x0, bot - 22, x1 - x0, 22);
      g.fillStyle = '#6e5038'; g.fillRect(x0, bot - 22, x1 - x0, 4);
      g.fillStyle = '#2a1e18'; g.fillRect(x0, bot - 5, x1 - x0, 5);
      g.strokeStyle = 'rgba(20,12,8,0.6)'; g.lineWidth = 0.8; g.beginPath(); for (let x = x0; x < x1; x += 30 + rng() * 40) { g.moveTo(x, bot - 15); g.lineTo(x + 20 + rng() * 30, bot - 13 + rng() * 4); } g.stroke();
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, bot - 22); g.lineTo(x1, bot - 22); g.moveTo(x0, bot); g.lineTo(x1, bot); g.stroke();
    });
  }
  // the organ loft: a fallen fossil rib bridging the caverns' ceiling, pipe stubs hanging beneath
  function paintLoft(s) {
    return [{ x: s.x - 60, y: s.y - 40, w: s.w + 120, h: s.h + 260, draw(g) {
      const r = U.mulberry32(4080), t = tintAt(s.x), B = colsOf(BONE, t);
      const C = { base: B.base, lit: B.lit, dark: B.dark, rim: U.rgba(B.rim, 0.7), ink: INK };
      for (let x = s.x + 30; x < s.x + s.w - 30; x += 50 + r() * 50) spike(g, r, x, s.y + s.h - 6, 14 + r() * 14, 40 + r() * 120, C, { down: true, deep: 20, ink: 1.6 });
      const sil = [[s.x - 30, s.y + 10], [s.x - 6, s.y - 2], [s.x + s.w + 4, s.y - 2], [s.x + s.w + 34, s.y + 16], [s.x + s.w + 10, s.y + s.h], [s.x - 12, s.y + s.h + 4]];
      poly(g, sil); g.fillStyle = B.base; g.fill();
      g.save(); g.clip(); g.fillStyle = B.lit; g.fillRect(s.x - 40, s.y - 4, s.w + 80, 9); g.fillStyle = B.dark; g.fillRect(s.x - 40, s.y + s.h - 14, s.w + 80, 20);
      g.strokeStyle = 'rgba(5,3,10,0.45)'; g.lineWidth = 1.2; g.beginPath(); for (let x = s.x; x < s.x + s.w; x += 26) { g.moveTo(x, s.y + 6); g.quadraticCurveTo(x + 6, s.y + s.h * 0.5, x, s.y + s.h - 4); } g.stroke();
      for (let k = 0; k < s.w / 14; k++) { g.beginPath(); g.arc(s.x + r() * s.w, s.y + 12 + r() * (s.h - 22), 1 + r() * 1.6, 0, TAU); g.fillStyle = B.deep; g.fill(); }
      g.restore();
      poly(g, sil); ink(g, 2.4);
      g.fillStyle = INK; g.fillRect(s.x, s.y - 1.6, s.w, 2.4);
    } }];
  }
  // one-way ledges: fossil rib shelves, scaffold planks, rock lips; 'none' = drawn by a prop (the lift cabin roof)
  function onewayPainter(p) {
    if (p.skin === 'none') return [];
    if (p.skin === 'bone') return [{ x: p.x - 40, y: p.y - 30, w: p.w + 80, h: 150, draw(g) {
      const r = U.mulberry32(Math.round(p.x * 3 + p.y)), t = tintAt(p.x), B = colsOf(BONE, t), C = { base: B.base, lit: B.lit, dark: B.dark, rim: U.rgba(B.rim, 0.6), ink: INK };
      for (let k = 0; k < 3; k++) spike(g, r, p.x + 20 + r() * (p.w - 40), p.y + 12, 10 + r() * 10, 26 + r() * 70, C, { down: true, deep: 10, ink: 1.4 });
      const sil = [[p.x - 14, p.y + 6], [p.x + 4, p.y - 2], [p.x + p.w - 6, p.y - 2], [p.x + p.w + 18, p.y + 4], [p.x + p.w + 2, p.y + 16], [p.x + 8, p.y + 18]];
      poly(g, sil); g.fillStyle = B.base; g.fill(); g.save(); g.clip(); g.fillStyle = B.lit; g.fillRect(p.x - 20, p.y - 4, p.w + 40, 6); g.fillStyle = B.dark; g.fillRect(p.x - 20, p.y + 11, p.w + 40, 9); g.restore();
      poly(g, sil); ink(g, 1.8); g.fillStyle = INK; g.fillRect(p.x, p.y - 1.4, p.w, 2.2);
      shards(g, r, p.x + p.w * (0.2 + r() * 0.6), p.y + 1, 7 + r() * 5, t > 0.4 ? '#c45cff' : '#5ff2e0', { ink: 1, glowA: 0.35 });
    } }];
    if (p.skin === 'plank') return [{ x: p.x - 30, y: p.y - 30, w: p.w + 60, h: (p.post || 170) + 50, draw(g) {
      const post = p.post || 170;
      for (const px of [p.x + 18, p.x + p.w - 22]) { g.fillStyle = '#4a3626'; g.fillRect(px, p.y + 10, 8, post - 10); g.fillStyle = '#7a5a3c'; g.fillRect(px + 5, p.y + 10, 3, post - 10); g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(px, p.y + 10, 8, post - 10); }
      const X = () => { g.beginPath(); g.moveTo(p.x + 22, p.y + 14); g.lineTo(p.x + p.w - 18, p.y + post - 10); g.moveTo(p.x + p.w - 18, p.y + 14); g.lineTo(p.x + 22, p.y + post - 10); };
      X(); ink(g, 3.4); X(); ink(g, 1.6, '#5a4230');
      for (let x = p.x; x < p.x + p.w - 1; x += 26) { const w = Math.min(26, p.x + p.w - x); g.fillStyle = Math.round((x - p.x) / 26) % 2 ? '#5c4430' : '#6c5038'; g.fillRect(x, p.y, w, 11); g.fillStyle = '#a27a52'; g.fillRect(x, p.y, w, 2); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(x + 0.5, p.y + 0.5, w - 1, 10); }
      g.strokeStyle = '#c9b48a'; g.lineWidth = 1.2; for (const px of [p.x + 22, p.x + p.w - 18]) { g.beginPath(); g.moveTo(px - 5, p.y + 12); g.lineTo(px + 5, p.y + 18); g.moveTo(px - 5, p.y + 16); g.lineTo(px + 5, p.y + 22); g.stroke(); }
      g.fillStyle = INK; g.fillRect(p.x, p.y - 1.4, p.w, 2.2);
    } }];
    return [{ x: p.x - 30, y: p.y - 30, w: p.w + 60, h: 120, draw(g) {
      const r = U.mulberry32(Math.round(p.x * 5 + p.y)), t = tintAt(p.x), C = rockC(t);
      const sil = [[p.x - 8, p.y + 4], [p.x + 6, p.y - 2], [p.x + p.w - 4, p.y - 2], [p.x + p.w + 10, p.y + 6], [p.x + p.w * 0.7, p.y + 34], [p.x + p.w * 0.35, p.y + 46], [p.x + 10, p.y + 24]];
      poly(g, sil); g.fillStyle = C.base; g.fill(); g.save(); g.clip(); g.fillStyle = C.lit; g.fillRect(p.x - 10, p.y - 3, p.w + 20, 7); g.fillStyle = C.dark; g.fillRect(p.x - 10, p.y + 20, p.w * 0.5, 30); g.restore();
      poly(g, sil); ink(g, 1.8); g.fillStyle = INK; g.fillRect(p.x, p.y - 1.4, p.w, 2.2);
      shards(g, r, p.x + p.w * 0.7, p.y + 1, 8, t > 0.5 ? '#c45cff' : '#5ff2e0', { ink: 1, glowA: 0.3 });
    } }];
  }

  /* ---------------- props (world space, cached) ---------------- */
  function cliff(objs, x0, x1, side, seed) {
    // a cavern wall closing the level; side = 1 → its right edge faces the play space, -1 → its left edge
    objs.push({ x: x0 - 40, y: -1800, w: x1 - x0 + 80, h: 2600, draw(g) {
      const r = U.mulberry32(seed), t = tintAt(side > 0 ? x1 : x0), C = rockC(t);
      const ex0 = side > 0 ? x1 : x0;
      const edge = (y) => ex0 - side * (26 * nz(y * 0.008, seed % 7) + 12 * nz(y * 0.04, 3) - (y > -160 ? (y + 160) * 0.18 : 0));
      const pts = []; for (let y = -1800; y <= 760; y += 14) pts.push([edge(y), y]);
      const back = side > 0 ? x0 - 40 : x1 + 40;
      poly(g, [[back, -1800]].concat(pts, [[back, 760]])); g.fillStyle = C.base; g.fill();
      g.save(); g.clip();
      g.fillStyle = C.deep; g.fillRect(side > 0 ? x0 - 40 : x0 + (x1 - x0) * 0.4, -1800, (x1 - x0) * 0.6 + 40, 2600);
      g.fillStyle = side > 0 ? C.lit : C.dark; for (const [ex, ey] of pts) g.fillRect(side > 0 ? ex - 34 : ex - 2, ey, 36, 15);
      g.strokeStyle = U.rgba(C.crack, 0.8); g.lineWidth = 1.3;
      for (let y = -1700; y < 700; y += 40 + r() * 70) { g.beginPath(); const ex = edge(y); g.moveTo(ex, y); g.quadraticCurveTo(ex - side * 60, y + 10, ex - side * (120 + r() * 140), y + (r() - 0.5) * 30); g.stroke(); }
      g.restore();
      path(g, pts); ink(g, 3);
      path(g, pts.map(([a, b]) => [a - side * 3, b])); ink(g, 1.4, U.rgba(C.top, side > 0 ? 0.55 : 0.25));
      for (let k = 0; k < 7; k++) { const y = -900 + r() * 880; shards(g, r, edge(y) - side * 6, y, 10 + r() * 16, t > 0.5 ? '#c45cff' : '#5ff2e0', { base: side > 0 ? 0 : PI, spread: 1.4, ink: 1.2, glowA: 0.3 }); }
    } });
  }
  function xtalProp(objs, x, y, s, col, o = {}) {
    objs.push({ x: x - s * 2.2, y: y - s * 2.2, w: s * 4.4, h: s * 2.6, draw(g) { shards(g, U.mulberry32(Math.round(x * 3 + y)), x, y + 2, s, col, Object.assign({ ink: Math.max(1.2, s * 0.05), glowA: 0.32 }, o)); } });
    glowAt(x, y - s * 0.5, s * 2.4, col, 0.32, { breath: col === '#c45cff' });
  }
  function fungusProp(objs, x, y, s, col) {
    objs.push({ x: x - s * 4, y: y - s * 5, w: s * 8, h: s * 5.6, draw(g) { fungus(g, U.mulberry32(Math.round(x * 7)), x, y + 1, s, col, { n: 3 + (Math.round(x) % 3) }); } });
    glowAt(x, y - s * 1.2, s * 4.5, col, 0.35, { sp: 1.6 });
  }

  // the cargo lift that fell with us: a crumpled cabin on its side, Ark livery, the snapped tether coiled beside it
  const CAB = { x: 320, w: 250, top: -150 };
  function liftWreck(objs) {
    const X = CAB.x, W = CAB.w, TOP = CAB.top;
    const bez = (u) => [(1 - u) ** 3 * 470 + 3 * (1 - u) ** 2 * u * 480 + 3 * (1 - u) * u * u * 420 + u ** 3 * 352, (1 - u) ** 3 * -1700 + 3 * (1 - u) ** 2 * u * -1100 + 3 * (1 - u) * u * u * -600 + u ** 3 * (TOP + 8)];
    objs.push({ x: 300, y: -1700, w: 260, h: 1560, draw(g) {
      const cable = (dx, w, col) => { g.beginPath(); g.moveTo(470 + dx, -1700); g.bezierCurveTo(480 + dx, -1100, 420 + dx, -600, 352 + dx, TOP + 8); ink(g, w, col); };
      cable(0, 11); cable(0, 6.5, '#4f5966'); cable(2, 1.4, 'rgba(210,240,255,0.55)');
      g.strokeStyle = 'rgba(5,3,10,0.6)'; g.lineWidth = 1.2; g.beginPath();
      for (let k = 0; k < 70; k++) { const [x, y] = bez(k / 70); g.moveTo(x - 3, y - 2); g.lineTo(x + 3, y + 2); }
      g.stroke();
    } });
    // shaft light falling on the wreck — the only daylight for three kilometres
    objs.push({ x: 60, y: -1500, w: 780, h: 1510, draw(g) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createLinearGradient(0, -1500, 0, 0); gr.addColorStop(0, 'rgba(200,240,255,0.2)'); gr.addColorStop(0.7, 'rgba(150,225,240,0.08)'); gr.addColorStop(1, 'rgba(150,225,240,0.035)');
      g.fillStyle = gr; poly(g, [[400, -1500], [520, -1500], [800, 0], [80, 0]]); g.fill();
      const pg = g.createRadialGradient(450, 0, 10, 450, 0, 330); pg.addColorStop(0, 'rgba(190,240,255,0.22)'); pg.addColorStop(1, 'rgba(190,240,255,0)');
      g.fillStyle = pg; g.fillRect(100, -60, 700, 70);
      g.restore();
    } });
    objs.push({ x: X - 60, y: TOP - 60, w: W + 140, h: 220, draw(g) {
      const r = U.mulberry32(77), steel = { lit: '#9fb0bc', base: '#5d6b78', dark: '#2c3440' }, brass = '#c99a4c';
      const sil = [[X, 0], [X - 6, TOP + 22], [X + 10, TOP], [X + W - 40, TOP], [X + W - 8, TOP + 26], [X + W + 6, TOP + 70], [X + W, 0]];
      poly(g, sil); g.fillStyle = steel.base; g.fill();
      g.save(); g.clip();
      g.fillStyle = steel.dark; g.fillRect(X - 10, TOP, 34, 160); g.fillRect(X - 10, -26, W + 30, 30);
      g.fillStyle = steel.lit; g.fillRect(X, TOP, W, 7); g.fillRect(X + W - 18, TOP, 30, 150);
      g.fillStyle = '#e4e2dc'; g.fillRect(X + 34, TOP + 18, 150, 70);
      g.fillStyle = '#b9bcc4'; g.fillRect(X + 34, TOP + 66, 150, 22);
      g.fillStyle = '#6ff3ff'; g.fillRect(X + 34, TOP + 92, W - 50, 5);
      g.fillStyle = brass; g.fillRect(X, TOP + 104, W, 4);
      g.fillStyle = '#0a0d14'; g.fillRect(X + 196, TOP + 22, 36, 54);
      g.strokeStyle = 'rgba(200,240,255,0.55)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(X + 200, TOP + 26); g.lineTo(X + 214, TOP + 48); g.lineTo(X + 230, TOP + 40); g.moveTo(X + 214, TOP + 48); g.lineTo(X + 208, TOP + 74); g.stroke();
      g.fillStyle = '#2a2e38'; g.font = '700 22px Rajdhani, sans-serif'; g.textAlign = 'left'; g.fillText('L-07', X + 44, TOP + 50);
      g.font = '600 11px "Noto Sans TC", sans-serif'; g.fillText('頌歌之梯 貨運', X + 44, TOP + 64);
      g.strokeStyle = '#2a2e38'; g.lineWidth = 2; g.beginPath(); g.arc(X + 158, TOP + 40, 12, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(X + 138, TOP + 40); g.lineTo(X + 178, TOP + 40); g.stroke();
      for (let k = 0; k < 5; k++) { const dx = X + 20 + r() * (W - 40), dy = TOP + 20 + r() * 110; g.strokeStyle = 'rgba(5,3,10,0.5)'; g.lineWidth = 1.4; g.beginPath(); g.arc(dx, dy, 8 + r() * 10, PI * (1 + r() * 0.3), PI * (1.7 + r() * 0.3)); g.stroke(); }
      const sc = g.createRadialGradient(X + W - 20, TOP + 60, 0, X + W - 20, TOP + 60, 70); sc.addColorStop(0, 'rgba(10,6,8,0.75)'); sc.addColorStop(1, 'rgba(10,6,8,0)'); g.fillStyle = sc; g.fillRect(X + W - 90, TOP, 120, 150);
      g.strokeStyle = 'rgba(5,3,10,0.6)'; g.lineWidth = 1; g.beginPath(); for (let px = X + 30; px < X + W; px += 52) { g.moveTo(px, TOP + 4); g.lineTo(px, -4); } g.stroke();
      g.fillStyle = '#1a1e26'; for (let px = X + 8; px < X + W - 8; px += 13) { g.fillRect(px, TOP + 10, 2, 2); g.fillRect(px, -12, 2, 2); }
      g.restore();
      poly(g, sil); ink(g, 3);
      g.fillStyle = INK; g.fillRect(X + 10, TOP - 1.6, W - 50, 2.6);
      g.beginPath(); g.arc(352, TOP + 2, 9, PI, TAU); ink(g, 6); g.beginPath(); g.arc(352, TOP + 2, 9, PI, TAU); ink(g, 3, brass);
      g.save(); g.translate(X + W + 4, TOP + 60); g.rotate(0.5); g.fillStyle = steel.dark; g.fillRect(0, 0, 18, 62); g.fillStyle = steel.lit; g.fillRect(14, 0, 4, 62); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(0, 0, 18, 62); g.restore();
    } });
    objs.push({ x: 560, y: -60, w: 330, h: 70, draw(g) {
      for (let k = 0; k < 6; k++) {
        const cx = 640 + k * 28, rx = 60 - k * 3, ry = 12 + (k % 2) * 3, cy = -12 - k * 2;
        const arc = () => { g.beginPath(); g.ellipse(cx, cy, rx, ry, -0.05, PI * 0.95, PI * 2.05); };
        arc(); ink(g, 8.5); arc(); ink(g, 4.6, '#56616e');
        g.beginPath(); g.ellipse(cx, cy - 1.5, rx, ry, -0.05, PI * 1.3, PI * 1.7); ink(g, 1.2, 'rgba(210,240,255,0.5)');
      }
      const end = () => { g.beginPath(); g.moveTo(830, -10); g.quadraticCurveTo(860, -20, 872, -4); };
      end(); ink(g, 8.5); end(); ink(g, 4.6, '#56616e');
      for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(872, -4); g.lineTo(872 + 6 + k * 3, -10 + k * 3); ink(g, 1.2, '#9aa4ae'); }
    } });
    glowAt(452, -40, 160, '#bff4ff', 0.18, { sp: 0.4 });
  }

  function signPost(objs, x, y) {
    objs.push({ x: x - 70, y: y - 170, w: 150, h: 180, draw(g) {
      g.fillStyle = '#4a3626'; g.fillRect(x - 4, y - 150, 8, 150); g.fillStyle = '#7a5a3c'; g.fillRect(x + 1, y - 150, 3, 150); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(x - 4, y - 150, 8, 150);
      g.save(); g.translate(x, y - 128); g.rotate(-0.06);
      g.fillStyle = '#3b4652'; g.fillRect(-58, -18, 116, 38); g.fillStyle = '#56636f'; g.fillRect(-58, -18, 116, 5);
      g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(-58, -18, 116, 38);
      g.fillStyle = '#e8803a'; g.fillRect(-54, -10, 22, 26); g.fillStyle = '#1a1416'; g.font = '700 16px Rajdhani, sans-serif'; g.textAlign = 'center'; g.fillText('III', -43, 9);
      g.fillStyle = '#e9e4d8'; g.font = '700 12px "Noto Sans TC", sans-serif'; g.textAlign = 'left'; g.fillText('第三降臨隊', -26, 0); g.font = '600 11px "Noto Sans TC", sans-serif'; g.fillText('鑽井營 →', -26, 14);
      g.fillStyle = '#1a1e26'; g.fillRect(-55, -15, 2, 2); g.fillRect(53, -15, 2, 2); g.fillRect(-55, 16, 2, 2); g.fillRect(53, 16, 2, 2);
      g.restore();
      g.fillStyle = '#c4672a'; poly(g, [[x + 4, y - 96], [x + 30, y - 86], [x + 22, y - 70], [x + 4, y - 84]]); g.fill(); ink(g, 1.2);
    } });
  }
  // stone "listening" monolith of the lake (carved ear spiral, teal runes)
  function listeningStone(objs, x, y, h) {
    objs.push({ x: x - 50, y: y - h - 30, w: 100, h: h + 40, draw(g) {
      const C = { lit: '#6c8590', base: '#44586a', dark: '#24303e' };
      const sil = [[x - 26, y + 2], [x - 30, y - h * 0.6], [x - 18, y - h], [x + 14, y - h - 6], [x + 28, y - h * 0.7], [x + 26, y + 2]];
      poly(g, sil); g.fillStyle = C.base; g.fill(); g.save(); g.clip(); g.fillStyle = C.dark; g.fillRect(x - 40, y - h - 20, 20, h + 40); g.fillStyle = C.lit; g.fillRect(x + 14, y - h - 20, 20, h + 40); g.restore();
      poly(g, sil); ink(g, 2.4);
      g.strokeStyle = '#5ff2e0'; g.lineWidth = 1.6; g.beginPath();
      for (let a = 0; a < PI * 3.4; a += 0.2) { const rr = 2 + a * 2.6, px = x + Math.cos(a) * rr * 0.8, py = y - h * 0.62 + Math.sin(a) * rr; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.stroke();
      g.fillStyle = '#5ff2e0'; for (let k = 0; k < 4; k++) g.fillRect(x - 10 + k * 6, y - h * 0.3, 2.4, 10 + (k % 2) * 6);
    } });
    glowAt(x, y - h * 0.6, 60, '#5ff2e0', 0.28, { sp: 0.7 });
  }
  function sunkBoat(objs, x, y) {
    objs.push({ x: x - 110, y: y - 70, w: 230, h: 110, draw(g) {
      g.save(); g.translate(x, y); g.rotate(-0.12);
      const sil = [[-90, -8], [90, -14], [70, 10], [-74, 14]];
      poly(g, sil); g.fillStyle = '#4a3a2e'; g.fill(); g.save(); g.clip(); g.fillStyle = '#6e563e'; g.fillRect(-100, -16, 200, 6); g.fillStyle = '#2a201a'; g.fillRect(-100, 4, 200, 14); g.restore();
      poly(g, sil); ink(g, 2.2);
      g.fillStyle = '#e8803a'; g.fillRect(-30, -10, 18, 6);
      g.beginPath(); g.moveTo(10, -12); g.lineTo(-6, -64); ink(g, 4); g.beginPath(); g.moveTo(10, -12); g.lineTo(-6, -64); ink(g, 2, '#6e563e');
      g.restore();
      g.fillStyle = 'rgba(3,6,12,0.75)'; g.fillRect(x - 110, y + 6, 230, 30);
      g.fillStyle = 'rgba(159,247,255,0.5)'; g.fillRect(x - 96, y + 6, 190, 1.2);
    } });
  }
  function crate(objs, x, yy, w, h, label) {
    objs.push({ x: x - 6, y: yy - h - 6, w: w + 12, h: h + 12, draw(g) {
      g.fillStyle = '#5c4430'; g.fillRect(x, yy - h, w, h); g.fillStyle = '#7a5a3c'; g.fillRect(x, yy - h, w, 3); g.fillRect(x + w - 4, yy - h, 4, h);
      g.fillStyle = '#3a2a1e'; g.fillRect(x, yy - h, 4, h);
      g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(x, yy - h, w, h); g.beginPath(); g.moveTo(x, yy - h); g.lineTo(x + w, yy); g.lineWidth = 1.2; g.stroke();
      if (label) { g.fillStyle = '#e04040'; g.font = '900 14px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.fillText(label, x + w / 2, yy - h / 2 + 5); }
    } });
  }
  // Brann's camp: relay mast (Talia's voice comes down this wire), tent, crates, dead lamp string
  function campProps(objs) {
    const y = -60, mx = 7480;
    objs.push({ x: 7420, y: -430, w: 160, h: 390, draw(g) {
      const C = { base: '#5b6670', lit: '#9aa8b2', dark: '#2a3038', rim: 'rgba(160,250,240,0.6)' };
      derrick(g, mx - 16, y, 32, 320, C, { lw: 1.8, levels: 7, decks: [], inkCol: INK });
      g.beginPath(); g.ellipse(mx + 22, y - 300, 16, 24, -0.4, -PI / 2, PI / 2); g.fillStyle = '#b9bcc4'; g.fill(); ink(g, 2);
      g.fillStyle = '#e8803a'; g.fillRect(mx - 30, y - 220, 28, 54); g.fillStyle = '#1a1416'; g.font = '700 18px Rajdhani, sans-serif'; g.textAlign = 'center'; g.fillText('III', mx - 16, y - 186);
      g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(mx - 30, y - 220, 28, 54);
      g.beginPath(); g.moveTo(mx, y - 6); g.quadraticCurveTo(mx + 40, y + 6, mx + 80, y - 2); ink(g, 2.2);
    } });
    glowAt(mx, y - 330, 14, '#ff4060', 0.9, { sp: 4 });
    objs.push({ x: 7470, y: -330, w: 400, h: 280, draw(g) {
      tent(g, 7620, y, 150, 92, { base: '#6b6250', lit: '#958a6c', dark: '#3a3530', stripe: '#c4672a' });
      g.beginPath(); g.moveTo(mx, y - 250); g.quadraticCurveTo(7590, y - 120, 7695, y - 104); ink(g, 1.2, 'rgba(10,6,14,0.9)');
      for (let k = 1; k < 8; k++) { const u = k / 8, bx = (1 - u) * (1 - u) * mx + 2 * u * (1 - u) * 7590 + u * u * 7695, by = (1 - u) * (1 - u) * (y - 250) + 2 * u * (1 - u) * (y - 120) + u * u * (y - 104); g.beginPath(); g.ellipse(bx, by + 6, 3, 4.5, 0, 0, TAU); g.fillStyle = '#4a4440'; g.fill(); ink(g, 1); }
    } });
    crate(objs, 7980, y, 40, 30, ''); crate(objs, 8000, y - 30, 30, 24, '');
    crate(objs, 8230, 0, 46, 36, '爆'); crate(objs, 8282, 0, 34, 28, '爆'); crate(objs, 8238, -36, 34, 26, '');
    crate(objs, 9128, 0, 44, 34, '爆'); crate(objs, 9150, -34, 30, 22, '');
  }
  // the Descent III derrick: signature of the drill camp, backdrop of Mog's arena
  function bigDerrick(objs) {
    const x = 8560, w = 320, h = 1000;
    objs.push({ x: x - 60, y: -h - 60, w: w + 120, h: h + 70, draw(g) {
      const C = { base: '#4e5862', lit: '#8c9aa6', dark: '#262c34', rim: 'rgba(170,255,240,0.55)' };
      derrick(g, x, 0, w, h, C, { lw: 4.6, levels: 11, decks: [0.24, 0.5, 0.74], inkCol: INK, bitUp: 0 });
      g.beginPath(); g.ellipse(x + w / 2, -2, 46, 8, 0, 0, TAU); g.fillStyle = '#05030a'; g.fill(); ink(g, 2);
      const bx = x + w * 0.5 - 40, by = -h * 0.74 + 8;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 80, by); g.lineTo(bx + 76, by + 120); g.lineTo(bx + 40, by + 104); g.lineTo(bx + 4, by + 122); g.closePath();
      g.fillStyle = '#b8582a'; g.fill(); g.save(); g.clip(); g.fillStyle = '#7a3418'; g.fillRect(bx, by, 22, 130); g.fillStyle = '#e8803a'; g.fillRect(bx + 62, by, 18, 130); g.restore(); ink(g, 2);
      g.fillStyle = '#f0e4cc'; g.font = '700 34px Rajdhani, sans-serif'; g.textAlign = 'center'; g.fillText('III', bx + 40, by + 52);
      g.font = '600 10px "Noto Sans TC", sans-serif'; g.fillText('第三降臨隊', bx + 40, by + 72);
      for (const [lx, ly] of [[x + 50, -260], [x + w - 50, -260], [x + 110, -520]]) { g.fillStyle = '#2a2e36'; g.fillRect(lx - 8, ly - 6, 16, 12); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(lx - 8, ly - 6, 16, 12); g.fillStyle = '#5a5040'; g.fillRect(lx - 6, ly - 4, 12, 8); }
    } });
    glowAt(x + 110, -520, 60, '#ffb85c', 0.5, { sp: 9 });
    objs.push({ x: 8150, y: -12, w: 1500, h: 16, draw(g) {
      for (let px = 8160; px < 9630; px += 18) { g.fillStyle = '#2a1e18'; g.fillRect(px, -5, 10, 5); }
      g.fillStyle = '#7d8790'; g.fillRect(8150, -7, 1490, 2.2); g.fillStyle = INK; g.fillRect(8150, -5, 1490, 1.2);
    } });
  }
  // the lightless adit: back wall, timber sets, the pit, Mog's chalk tally
  function mineProps(objs) {
    const [x0, x1] = MINE;
    objs.push({ x: x0 - 10, y: -300, w: x1 - x0 + 20, h: 440, draw(g) {
      const C = rockC(0.55);
      g.fillStyle = mixH(C.deep, '#000000', 0.2); g.fillRect(x0, -290, x1 - x0, 300); g.fillRect(PIT[0], 0, PIT[1] - PIT[0], 125);
      for (let y = -270; y < 120; y += 22) for (let x = x0 + (Math.round((y + 270) / 22) % 2 ? 30 : 0); x < x1; x += 70) {
        if (y > -10 && (x < PIT[0] || x > PIT[1] - 64)) continue;
        g.fillStyle = 'rgba(70,50,36,0.55)'; g.fillRect(x, y, 64, 18); g.fillStyle = 'rgba(120,90,60,0.25)'; g.fillRect(x, y, 64, 2);
        g.strokeStyle = 'rgba(5,3,10,0.7)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, 63, 17);
      }
      g.strokeStyle = 'rgba(230,226,214,0.75)'; g.lineWidth = 1.3; g.beginPath();
      for (let k = 0; k < 9; k++) { const tx = 9468 + k * 14; for (let j = 0; j < 4; j++) { g.moveTo(tx + j * 2.4, -200); g.lineTo(tx + j * 2.4 + 1, -176); } g.moveTo(tx - 2, -180); g.lineTo(tx + 10, -196); }
      g.stroke();
      g.fillStyle = 'rgba(230,226,214,0.75)'; g.font = '700 13px "Noto Sans TC", sans-serif'; g.textAlign = 'left'; g.fillText('布蘭 → 燈', 9470, -150);
      for (let x = x0 + 25; x < x1; x += 125) {
        const foot = x > PIT[0] && x < PIT[1] ? 120 : 0;
        g.fillStyle = '#4a3626'; g.fillRect(x - 7, -284, 14, 284 + foot); g.fillStyle = '#76573a'; g.fillRect(x + 2, -284, 4, 284 + foot); g.fillStyle = '#2a1e18'; g.fillRect(x - 7, -284, 3, 284 + foot);
        g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(x - 7, -284, 14, 284 + foot);
        g.fillStyle = '#1a1416'; g.fillRect(x - 3, -240, 6, 3);
        g.beginPath(); g.moveTo(x, -237); g.lineTo(x, -226); ink(g, 1);
      }
      g.save(); g.translate(x0 + 70, -210); g.rotate(0.08); g.fillStyle = '#d8b440'; g.fillRect(-26, -12, 52, 26); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(-26, -12, 52, 26);
      g.fillStyle = '#1a1416'; g.font = '900 14px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.fillText('無光', 0, 6); g.restore();
      g.fillStyle = '#5c4430'; g.fillRect(PIT[0] - 30, -4, 34, 6); g.fillRect(PIT[1] - 4, -4, 34, 6);
      g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(PIT[0] - 30, -4, 34, 6); g.strokeRect(PIT[1] - 4, -4, 34, 6);
    } });
  }
  // the Rest's breath: crystal pillars, the arena gate of drill teeth, the bore ring behind Hadal's arena
  function restProps(objs) {
    for (const [x, s] of [[10230, 70], [10520, 46], [10840, 90], [11080, 56], [11440, 80]]) {
      const sd = Math.round(x);
      objs.push({ x: x - s * 2.2, y: -s * 3.4, w: s * 4.4, h: s * 3.5, draw(g) {
        const r = U.mulberry32(sd), C = { base: '#2a1d40', lit: '#4a3468', dark: '#160e26', rim: 'rgba(255,140,240,0.6)', ink: INK };
        spike(g, r, x, 2, s * 0.8, s * 2.2, C, { ink: 2, lean: (r() - 0.5) * 0.3 });
        shards(g, r, x + s * 0.2, 2, s * 0.9, '#c45cff', { ink: 2, glowA: 0.35, n: 4 });
      } });
      glowAt(x, -s * 0.6, s * 2.2, '#c45cff', 0.4, { breath: true });
    }
    objs.push({ x: 11380, y: -40, w: 140, h: 44, draw(g) {
      for (let k = 0; k < 4; k++) {
        const hx = 11400 + k * 30;
        g.beginPath(); g.moveTo(hx - 12, 0); g.quadraticCurveTo(hx - 12, -20, hx, -21); g.quadraticCurveTo(hx + 12, -20, hx + 12, 0); g.closePath();
        g.fillStyle = k === 2 ? '#8a7a40' : '#b8923f'; g.fill(); g.save(); g.clip(); g.fillStyle = '#6a5428'; g.fillRect(hx - 12, -22, 7, 24); g.fillStyle = '#e0c070'; g.fillRect(hx + 6, -22, 4, 24); g.restore();
        ink(g, 1.8); g.fillStyle = '#1a1416'; g.fillRect(hx - 4, -16, 8, 6); g.fillStyle = INK; g.fillRect(hx - 14, -1, 28, 2);
      }
    } });
    objs.push({ x: BOSS_X0 - 160, y: -600, w: 300, h: 610, draw(g) {
      const C = { base: '#3a2c50', lit: '#5c4680', dark: '#1c1430', rim: 'rgba(255,150,240,0.6)', ink: INK }, r = U.mulberry32(117);
      for (const [gx, gh] of [[BOSS_X0 - 90, 470], [BOSS_X0 + 50, 520]]) {
        spike(g, r, gx, 2, 64, gh, C, { ink: 2.4, pow: 1.2, lean: 0 });
        g.strokeStyle = 'rgba(5,3,10,0.55)'; g.lineWidth = 2;
        for (let k = 0; k < 7; k++) { const y = -40 - (k * gh) / 8, w = 32 * Math.pow(1 - (k / 8), 1.2); g.beginPath(); g.moveTo(gx - w, y); g.quadraticCurveTo(gx, y - 18, gx + w, y - 30); g.stroke(); }
      }
      disc(g, BOSS_X0 - 20, -300, 120, '#c45cff', 0.18);
    } });
    const bx = 12420, by = -390, R = 300;
    objs.push({ x: bx - R - 80, y: by - R - 140, w: (R + 80) * 2, h: R * 2 + 160, draw(g) {
      const r = U.mulberry32(12420);
      const tg = g.createRadialGradient(bx, by, 10, bx, by, R * 0.86); tg.addColorStop(0, '#2a0c3a'); tg.addColorStop(0.35, '#12061c'); tg.addColorStop(1, '#05030a');
      g.beginPath(); g.ellipse(bx, by, R * 0.86, R * 0.8, 0, 0, TAU); g.fillStyle = tg; g.fill();
      disc(g, bx, by, R * 0.5, '#c45cff', 0.25);
      g.strokeStyle = 'rgba(200,120,255,0.22)'; g.lineWidth = 2; g.beginPath();
      for (let a = 0; a < PI * 8; a += 0.08) { const rr = R * 0.8 * Math.exp(-a * 0.14), px = bx + Math.cos(a) * rr, py = by + Math.sin(a) * rr * 0.94; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.stroke();
      const ring = () => { g.beginPath(); g.ellipse(bx, by, R, R * 0.93, 0, 0, TAU); g.ellipse(bx, by, R * 0.86, R * 0.8, 0, 0, TAU, true); };
      ring(); g.fillStyle = '#2c2142'; g.fill('evenodd');
      g.save(); ring(); g.clip('evenodd');
      g.fillStyle = '#4c3a6e'; g.fillRect(bx, by - R, R, R * 2); g.fillStyle = '#170f26'; g.fillRect(bx - R, by - R, R * 0.6, R * 2);
      g.strokeStyle = 'rgba(5,3,10,0.6)'; g.lineWidth = 2.2; for (let k = 0; k < 40; k++) { const a = (k / 40) * TAU; g.beginPath(); g.moveTo(bx + Math.cos(a) * R * 0.86, by + Math.sin(a) * R * 0.8); g.lineTo(bx + Math.cos(a + 0.1) * R, by + Math.sin(a + 0.1) * R * 0.93); g.stroke(); }
      g.restore();
      g.beginPath(); g.ellipse(bx, by, R, R * 0.93, 0, 0, TAU); ink(g, 3.4); g.beginPath(); g.ellipse(bx, by, R * 0.86, R * 0.8, 0, 0, TAU); ink(g, 2.4);
      g.beginPath(); g.ellipse(bx, by, R - 2, R * 0.93 - 2, 0, -PI * 0.45, PI * 0.25); ink(g, 1.6, 'rgba(255,160,240,0.55)');
      for (let k = 0; k < 16; k++) { const a = -PI * 0.1 + (k / 16) * PI * 1.25 + r() * 0.1; shards(g, r, bx + Math.cos(a) * R * 0.98, by + Math.sin(a) * R * 0.92, 18 + r() * 26, '#c45cff', { base: a, spread: 0.9, n: 3, ink: 1.8, glowA: 0.28 }); }
      for (const cx of [bx - 180, bx + 130]) { g.strokeStyle = INK; g.lineWidth = 3; g.setLineDash([7, 4]); g.beginPath(); g.moveTo(cx, by - R - 130); g.quadraticCurveTo(cx + 20, by - R * 0.4, cx + 6, by - 40); g.stroke(); g.setLineDash([]); }
    } });
    glowAt(bx, by, 200, '#c45cff', 0.3, { breath: true });
    objs.push({ x: BOSS_X0, y: -10, w: 1400, h: 14, draw(g) {
      g.fillStyle = 'rgba(3,2,8,0.55)'; for (let x = BOSS_X0 + 40; x < BOSS_X1 - 40; x += 16) { g.fillRect(x, -4, 9, 2.4); g.fillRect(x + 4, -8, 9, 2); }
    } });
  }

  function genProps() {
    const objs = []; GLOW.length = 0;
    cliff(objs, -1100, -386, 1, 13);
    cliff(objs, BOSS_X1 - 4, BOSS_X1 + 700, -1, 29);
    liftWreck(objs);
    signPost(objs, 1230, 0);
    objs.push({ x: 940, y: -170, w: 230, h: 180, draw(g) {
      for (const [x, a, l] of [[1000, -0.5, 130], [1060, 0.35, 90], [1110, -0.15, 60]]) { g.save(); g.translate(x, 2); g.rotate(a); g.fillStyle = '#4e5864'; g.fillRect(-6, -l, 12, l); g.fillStyle = '#8c9aa6'; g.fillRect(3, -l, 3, l); g.fillStyle = '#2a3038'; for (let k = 8; k < l; k += 16) g.fillRect(-6, -k, 12, 3); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(-6, -l, 12, l); g.restore(); }
    } });
    for (const [x, y, s] of [[230, 0, 22], [1000, 0, 16], [1560, -80, 30], [1905, -80, 18], [2360, 0, 26], [2610, 0, 20]]) xtalProp(objs, x, y, s, '#5ff2e0');
    for (const [x, y, s] of [[760, 0, 4], [1420, -80, 5], [2140, 0, 4.5], [2500, 0, 3.5]]) fungusProp(objs, x, y, s, '#6ff0d2');
    // organ caverns: a ribcage corridor and pipe stands behind the walkway
    for (const [x, base, span, hg] of [[2860, 0, 560, 520], [3260, 0, 520, 470], [3720, -110, 560, 520], [4950, -40, 600, 560], [5350, -40, 480, 440]]) {
      objs.push({ x: x - span / 2 - 30, y: base - hg - 50, w: span + 60, h: hg + 110, draw(g) {
        const r = U.mulberry32(Math.round(x)), t = tintAt(x), B = colsOf(BONE, t);
        const C = { base: mixH(B.dark, '#0b1018', 0.25), lit: mixH(B.base, B.dark, 0.35), dark: mixH(B.deep, '#05030a', 0.3), rim: U.rgba(B.rim, 0.45), ink: INK };
        ribArch(g, r, x - span / 2, x + span / 2, base, hg, 22, C, { ink: 2.4 });
      } });
    }
    for (const [x, base, n] of [[2760, 0, 4], [3060, 0, 3], [3420, 0, 2], [4130, -110, 4], [4600, -40, 3], [5120, -40, 5]]) {
      objs.push({ x: x - 30, y: base - 760, w: n * 60 + 60, h: 780, draw(g) {
        const r = U.mulberry32(Math.round(x * 3)), t = tintAt(x), B = colsOf(BONE, t);
        const C = { base: mixH(B.base, B.dark, 0.55), lit: mixH(B.base, B.lit, 0.2), dark: mixH(B.dark, '#05030a', 0.35), rim: U.rgba(B.rim, 0.55), rim2: B.rim, ink: INK };
        for (let i = 0; i < n; i++) { const w = 34 + r() * 18; organPipe(g, r, x + i * 56, base + 2, w, 280 + Math.sin(((i + 0.5) / n) * PI) * 360 + r() * 60, C, { ink: 2.4, xtal: t > 0.35 ? '#c45cff' : '#5ff2e0', inkX: 1.6, glowMouth: r() < 0.5 ? '#5ff2e0' : null }); }
      } });
      glowAt(x + n * 28, base - 60, 90, '#5ff2e0', 0.22, { sp: 0.6 });
    }
    for (const [x, y, s] of [[3500, 0, 24], [4300, -110, 18], [4480, -110, 26], [5560, -40, 22], [4400, -800, 14]]) xtalProp(objs, x, y, s, x > 4400 ? '#9a7bff' : '#5ff2e0');
    for (const [x, y, s] of [[2920, 0, 4], [3640, -110, 5], [5240, -40, 4]]) fungusProp(objs, x, y, s, '#6ff0d2');
    // the still lake
    listeningStone(objs, 5730, 0, 120); listeningStone(objs, 7290, 0, 96);
    sunkBoat(objs, 6160, 34);
    for (const [x, s] of [[6000, 16], [6720, 22], [7140, 14]]) xtalProp(objs, x, 0, s, '#7ffcff');
    // the drill camp, the adit, the Rest
    campProps(objs); bigDerrick(objs);
    for (const [x, y, s] of [[7420, -60, 3.5], [8180, 0, 4]]) fungusProp(objs, x, y, s, '#e0b36b');
    mineProps(objs);
    restProps(objs);
    for (const [x, s] of [[10120, 20], [10660, 26], [11000, 18], [11270, 24]]) xtalProp(objs, x, 0, s, '#c45cff');
    return objs;
  }

  /* ============================== live visuals (per frame — kept light for phones) ============================== */
  const SPR = new Map();
  function spr(col) {
    let c = SPR.get(col); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.16, U.rgba(col, 0.7)); gr.addColorStop(0.5, U.rgba(col, 0.2)); gr.addColorStop(1, U.rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); SPR.set(col, c); return c;
  }
  const breathK = (t) => 0.5 + 0.5 * Math.sin((t * TAU) / 6);          // the Rest breathes every six seconds
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const mineDark = (x) => smooth(MINE[0] - 40, MINE[0] + 140, x) * (1 - smooth(MINE[1] - 160, MINE[1] + 40, x));
  // the set-piece "the Rest breathes" on the lake causeway
  const BR = { on: false, t: 0, phase: 0, dark: 0, child: 0, ring: -1, flare: 0, fired: {} };

  function drawBack(ctx, game) {
    const cam = game.cam, t = game.realTime, x0 = cam.x - 900, x1 = cam.x + 900, bk = breathK(t);
    // phones: the halos shrink to 80 % (≈ 0.6 × the additive fill) — the falloff is soft, the difference is hard to see
    const rk = G.Quality.low ? 0.8 : 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of GLOW) {
      if (p.x + p.r < x0 || p.x - p.r > x1) continue;
      let a = p.a * (0.7 + 0.3 * Math.sin(t * p.sp + p.ph));
      if (p.breath) a *= 0.45 + bk * 0.9;
      ctx.globalAlpha = Math.min(1, a + BR.flare * 0.5);
      const r = p.r * rk;
      ctx.drawImage(spr(p.c), p.x - r, p.y - r, r * 2, r * 2);
    }
    // motes turning in the shaft light over the wreck
    if (cam.x < 1700) {
      ctx.fillStyle = '#e6fbff';
      for (let i = 0; i < 22; i++) {
        const u = (i * 0.618 + t * 0.018 * (1 + (i % 3))) % 1;
        const mx = 260 + ((i * 97) % 360) + Math.sin(t * 0.5 + i) * 18 + u * 140, my = -30 - (1 - u) * 820;
        ctx.globalAlpha = (0.2 + 0.2 * Math.sin(t * 2 + i)) * Math.min(1, u * 4);
        ctx.fillRect(mx, my, 2, 2);
      }
    }
    // drops falling from the chandelier stalactites into the still lake, and their rings
    if (cam.x > LAKE[0] - 700 && cam.x < LAKE[1] + 700) {
      for (let k = 0; k < 5; k++) {
        const ph = (t * 0.33 + k * 0.29) % 1, dx = LAKE[0] + 180 + k * 360;
        if (ph < 0.55) { const u = ph / 0.55; ctx.globalAlpha = 0.7; ctx.fillStyle = '#bffcff'; ctx.fillRect(dx, -520 + 545 * u * u, 1.6, 7); }
        else { const u = (ph - 0.55) / 0.45; ctx.globalAlpha = (1 - u) * 0.7; ctx.strokeStyle = '#9ff7ff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(dx, 26, 6 + u * 46, 1.5 + u * 5, 0, 0, TAU); ctx.stroke(); }
      }
    }
    ctx.restore();
    if (BR.child > 0.01) drawVision(ctx, CHILD_X, 0, BR.child, t);
    if (BR.ring >= 0 && BR.ring < 1) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const u = clamp(BR.ring - k * 0.12, 0, 1); if (u <= 0) continue;
        ctx.globalAlpha = (1 - u) * 0.8; ctx.strokeStyle = k ? '#ff7ad8' : '#e8d4ff'; ctx.lineWidth = 7 - k * 2;
        ctx.beginPath(); ctx.ellipse(CHILD_X, -60, 60 + u * 1700, (60 + u * 1700) * 0.32, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
  }
  // glints running along the near edge of the lake, in front of the causeway
  function drawFront(ctx, game) {
    const cam = game.cam, t = game.realTime;
    if (cam.x < LAKE[0] - 700 || cam.x > LAKE[1] + 700) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#a8faff';
    const a = Math.max(LAKE[0], Math.floor((cam.x - 720) / 34) * 34), b = Math.min(LAKE[1], cam.x + 720);
    for (let x = a; x < b; x += 34) {
      const k = Math.sin(t * 1.6 + x * 0.047) * Math.sin(t * 0.7 + x * 0.013);
      if (k < 0.25) continue;
      ctx.globalAlpha = (k - 0.25) * 0.9; ctx.fillRect(x + Math.sin(t + x) * 8, 22 + ((x * 13) % 34), 9 + (x % 5) * 4, 1.3);
    }
    ctx.restore();
  }
  // near-camera silhouettes (parallax 1.35): stalactites dipping into the frame, crystal-crowned rocks below it
  function drawForeground(ctx, cam, S, game) {
    const f = 1.35, span = 1100, t = game.realTime, tint = L.tintAt(cam.x);
    const rim = tint > 0.55 ? 'rgba(225,140,255,0.6)' : 'rgba(110,240,220,0.5)', glow = tint > 0.55 ? '#d77bff' : '#6ff0d2';
    const inMine = cam.x > MINE[0] - 200 && cam.x < MINE[1] + 200;
    const base = Math.floor((cam.x * f - 1500) / span);
    for (let i = base; i < base + 4; i++) {
      const r = U.mulberry32(i * 733 + 41); if (r() < 0.22) continue;
      const lx = i * span + r() * 500, x = cam.x + (lx - cam.x * f), kind = r();
      if (inMine) {
        // a timber set passing close to the lens: hewn post, cap beam high above, one knee brace
        const top = cam.y - 600, bot = cam.y + 600, pw = 30 + r() * 12, capY = cam.y - 250 - r() * 60, sd = r() < 0.5 ? -1 : 1;
        ctx.fillStyle = '#070403';
        ctx.beginPath(); ctx.moveTo(x - pw / 2, bot); ctx.lineTo(x - pw / 2 + 3, top); ctx.lineTo(x + pw / 2, top); ctx.lineTo(x + pw / 2 - 2, bot); ctx.closePath(); ctx.fill();
        ctx.fillRect(x - 96, capY - 20, 192, 24);
        ctx.beginPath(); ctx.moveTo(x + sd * pw * 0.4, capY + 70); ctx.lineTo(x + sd * (pw / 2 + 58), capY + 2); ctx.lineTo(x + sd * (pw / 2 + 78), capY + 2); ctx.lineTo(x + sd * pw * 0.4, capY + 96); ctx.closePath(); ctx.fill();
        // warm rim from the blade's glow on the near edge, and a strap of iron
        ctx.fillStyle = 'rgba(255,184,92,0.16)'; ctx.fillRect(x + pw / 2 - 4, top, 2.5, bot - top); ctx.fillRect(x - 94, capY + 2, 188, 2);
        ctx.fillStyle = '#16100c'; ctx.fillRect(x - pw / 2, capY + 150, pw, 7);
        continue;
      }
      if (kind < 0.62) {
        const top = cam.y - 470, w = 60 + r() * 90, len = 120 + r() * 110, tipX = x + (r() - 0.5) * 16;
        ctx.beginPath(); ctx.moveTo(x - w, top - 300); ctx.lineTo(x - w * 0.95, top + 10);
        ctx.quadraticCurveTo(x - w * 0.35, top + len * 0.55, tipX, top + len);
        ctx.quadraticCurveTo(x + w * 0.4, top + len * 0.45, x + w, top + 6); ctx.lineTo(x + w, top - 300); ctx.closePath();
        ctx.fillStyle = '#030208'; ctx.fill();
        ctx.strokeStyle = rim; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tipX + 2, top + len - 6); ctx.quadraticCurveTo(x + w * 0.4, top + len * 0.45, x + w, top + 6); ctx.stroke();
        const dp = (t * 0.6 + i * 0.37) % 1;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(spr(glow), tipX - 9, top + len - 4 + dp * 6, 18, 18); ctx.restore();
      } else {
        // a boulder crowned with Hush crystal, silhouetted against the lit floor: faceted shards, one lit facet each,
        // rim light only on the edges that face the light, a low glow where they grow out of the stone
        const gy = cam.y + 345, w = 150 + r() * 130, h = 55 + r() * 60, by = gy - h * 0.62;
        const facet = tint > 0.55 ? '#1b0b2c' : '#071a1e';
        ctx.beginPath(); ctx.moveTo(x - w, gy + 200); ctx.lineTo(x - w * 0.82, gy - h * 0.3); ctx.quadraticCurveTo(x - w * 0.6, gy - h * 1.06, x - w * 0.3, gy - h);
        ctx.lineTo(x + w * 0.2, gy - h * 0.72); ctx.quadraticCurveTo(x + w * 0.45, gy - h * 1.02, x + w * 0.7, gy - h * 0.9); ctx.lineTo(x + w, gy + 200); ctx.closePath();
        ctx.fillStyle = '#030208'; ctx.fill();
        ctx.strokeStyle = rim; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x + w * 0.22, gy - h * 0.74); ctx.quadraticCurveTo(x + w * 0.45, gy - h * 1.02, x + w * 0.7, gy - h * 0.9); ctx.stroke();
        for (let k = 0; k < 3; k++) {
          const sx = x - w * 0.36 + k * w * 0.3 + (r() - 0.5) * 20, sh = h * (0.75 + r() * 0.75), a = -PI / 2 + (r() - 0.5) * 0.8, bw = 15 + r() * 12;
          const tx = sx + Math.cos(a) * sh, ty = by + Math.sin(a) * sh, mx = sx + Math.cos(a) * sh * 0.18 + bw * 0.15, my = by + Math.sin(a) * sh * 0.18;
          ctx.beginPath(); ctx.moveTo(sx - bw, by + 4); ctx.lineTo(tx, ty); ctx.lineTo(sx + bw, by + 4); ctx.closePath(); ctx.fillStyle = '#05030c'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(tx, ty); ctx.lineTo(sx + bw, by + 4); ctx.closePath(); ctx.fillStyle = facet; ctx.fill();
          ctx.beginPath(); ctx.moveTo(sx + bw, by + 4); ctx.lineTo(tx, ty); ctx.lineTo(mx, my); ctx.stroke();
        }
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.32 + 0.1 * Math.sin(t * 1.3 + i); ctx.drawImage(spr(glow), x - w * 0.5, by - 50, w, 90); ctx.restore();
      }
    }
    return true;
  }
  function drawSky(ctx, cam, W, H, S) {
    const t = L.tintAt(cam.x), hy = H / 2 + (60 - cam.y * 0.03) * S, k = clamp(hy / H, 0.25, 0.95);
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, P('skyTop', t)); gr.addColorStop(k * 0.55, P('skyMid', t)); gr.addColorStop(k, P('skyLow', t)); gr.addColorStop(1, P('horizon', t));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    return true;
  }
  const SPORE = (() => { const r = U.mulberry32(303); return Array.from({ length: 48 }, () => ({ x: r(), y: r(), z: 0.35 + r() * 1.3, s: 0.8 + r() * 1.8, p: r() * 10, v: r() < 0.5 })); })();
  function drawAtmos(ctx, cam, W, H, S, time) {
    const t = L.tintAt(cam.x), LQ = G.Quality.low, game = G.game;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // drifting spores / biolume flecks rising slowly
    const n = LQ ? 18 : SPORE.length;
    for (let i = 0; i < n; i++) {
      const d = SPORE[i];
      const px = ((d.x * W * 1.4 - cam.x * d.z * S * 0.5 + Math.sin(time * 0.35 + d.p) * 24 * S) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
      const py = ((d.y * H - time * 9 * d.z * S - cam.y * d.z * S * 0.3) % H + H) % H;
      const a = (0.35 + 0.35 * Math.sin(time * 1.7 + d.p)) * (d.z > 1 ? 0.75 : 0.5);
      ctx.fillStyle = d.v ? (t > 0.5 ? U.rgba('#e3a2ff', a) : U.rgba('#7ffcef', a)) : U.rgba(t > 0.75 ? '#f0c8ff' : '#c8fbff', a);
      const r = d.s * S * d.z; ctx.fillRect(px - r / 2, py - r / 2, r, r);
    }
    // out-of-focus glow discs near the lens
    for (let i = 0; i < (LQ ? 3 : 7); i++) {
      const d = SPORE[i * 6], r = (0.04 + d.s * 0.025) * H;
      const px = ((d.x * W * 1.5 - cam.x * S * 1.5 + time * 6 * S) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.25, py = d.y * H + Math.sin(time * 0.3 + d.p) * 20 * S;
      ctx.globalAlpha = 0.07 + 0.04 * Math.sin(time * 0.5 + d.p);
      ctx.drawImage(spr(d.v || t > 0.6 ? '#c45cff' : '#5ff2e0'), px - r, py - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    // falling drips
    ctx.fillStyle = U.rgba(t > 0.6 ? '#f0c8ff' : '#c8fbff', 0.35);
    for (let i = 0; i < (LQ ? 3 : 6); i++) {
      const ph = (time * (0.5 + i * 0.07) + i * 0.37) % 1, px = ((i * 0.173 + 0.07) * W * 1.3 - cam.x * S * 0.9) % (W * 1.3);
      ctx.fillRect((px + W * 1.3) % (W * 1.3) - W * 0.15, ph * H * 1.1 - 20 * S, 1.2 * S, 9 * S);
    }
    ctx.restore();
    // darkness: the lightless adit, and the cavern holding its breath
    const P = game && game.player;
    if (P) {
      const live = game.state === 'play', md = live ? mineDark(P.x) : 0, d = Math.max(md, live ? BR.dark : 0);
      if (d > 0.01) {
        const px = W / 2 + (P.x - cam.x) * S, py = H / 2 + (P.y - 70 - cam.y) * S, r1 = (BR.dark > md ? 240 : 320) * S;
        const gr = ctx.createRadialGradient(px, py, r1 * 0.2, px, py, r1);
        gr.addColorStop(0, 'rgba(2,1,6,0)'); gr.addColorStop(0.55, `rgba(2,1,6,${0.55 * d})`); gr.addColorStop(1, `rgba(2,1,6,${0.93 * d})`);
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const shine = (wx, wy, r, col, a) => { const sx = W / 2 + (wx - cam.x) * S, sy = H / 2 + (wy - cam.y) * S; ctx.globalAlpha = clamp(a, 0, 1); ctx.drawImage(spr(col), sx - r * S, sy - r * S, r * 2 * S, r * 2 * S); };
        const F = game.save.flags;
        if (md > 0.01) {
          if (!F.c3_got_lamp) shine(9790, 92, 80, '#ffb85c', 0.6 * md * (0.75 + 0.25 * Math.sin(time * 3)));
          if (!F.note_c3_n5) shine(9520, -40, 56, '#ffd28a', 0.45 * md);
        }
        if (BR.child > 0.01) shine(CHILD_X, -40, 140, '#e8e2ff', BR.child * 0.7);
        ctx.restore();
      }
    }
    // the Rest breathes: a slow violet pulse at the edges of the frame (a full-screen pass: skipped on phones,
    // where the breathing crystals in drawBack already carry the beat)
    if (t > 0.6 && !LQ) {
      const k = (t - 0.6) / 0.4 * breathK(time), vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      vg.addColorStop(0, 'rgba(120,30,160,0)'); vg.addColorStop(1, `rgba(120,30,160,${0.16 * k})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    return true;
  }

  /* ============================== characters ============================== */
  // Old Brann: Descent III miner, half his face grown over with Hush crystal, counting in the dark
  function drawBrann(ctx, x, y, t, game) {
    const F = (game && game.save && game.save.flags) || {}, Pl = game && game.player, R = G.Rig, done = !!F.c3_quest_done;
    const look = Pl && Pl.x < x ? -1 : 1;
    ctx.save(); ctx.translate(x, y);
    // the little stove he lit with the last of the lamp oil
    if (done) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
      ctx.drawImage(spr('#ffb85c'), -look * 46 - 60, -70, 120, 120); ctx.restore();
      ctx.fillStyle = '#3a3034'; ctx.fillRect(-look * 46 - 10, -16, 20, 16); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(-look * 46 - 10, -16, 20, 16);
      const fl = Math.sin(t * 13) * 2;
      ctx.beginPath(); ctx.moveTo(-look * 46 - 6, -16); ctx.quadraticCurveTo(-look * 46 - 4 + fl, -30, -look * 46, -36 - fl); ctx.quadraticCurveTo(-look * 46 + 4, -26, -look * 46 + 6, -16); ctx.closePath();
      ctx.fillStyle = '#ffcf6a'; ctx.fill(); ctx.strokeStyle = '#a2441c'; ctx.lineWidth = 1; ctx.stroke();
    }
    // seat: an old powder keg
    ctx.beginPath(); ctx.moveTo(-17, 0); ctx.quadraticCurveTo(-21, -17, -16, -33); ctx.lineTo(16, -33); ctx.quadraticCurveTo(21, -17, 17, 0); ctx.closePath();
    ctx.fillStyle = '#5c4430'; ctx.fill(); ctx.save(); ctx.clip(); ctx.fillStyle = '#3a2a1e'; ctx.fillRect(-22, -34, 12, 36); ctx.fillStyle = '#7a5a3c'; ctx.fillRect(10, -34, 10, 36);
    ctx.fillStyle = '#2e3238'; ctx.fillRect(-22, -28, 44, 3.5); ctx.fillRect(-22, -8, 44, 3.5); ctx.restore();
    ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.scale(look, 1);
    const br = Math.sin(t * 1.25) * 1.1, nod = Math.sin(t * 0.7) * 0.04 + (done ? 0 : Math.max(0, Math.sin(t * 2.1)) * 0.05);
    const suit = '#5a6150', suitB = '#40463a', boot = '#3a2c24';
    // back leg, then front leg (seated: thigh forward, shin down)
    R.limb(ctx, { x: -4, y: -35 }, { x: 13, y: -35 }, 6.5, 5.6, suitB); R.limb(ctx, { x: 13, y: -35 }, { x: 11, y: -6 }, 5.4, 4.6, suitB); R.limb(ctx, { x: 10, y: -5 }, { x: 21, y: -3 }, 4.6, 4, boot, { noHatch: true });
    // pickaxe leaning on the keg (behind the front leg)
    ctx.beginPath(); ctx.moveTo(-24, -2); ctx.lineTo(-10, -66); ink(ctx, 5); ctx.beginPath(); ctx.moveTo(-24, -2); ctx.lineTo(-10, -66); ink(ctx, 2.6, '#7a5a3c');
    ctx.beginPath(); ctx.moveTo(-26, -58); ctx.quadraticCurveTo(-10, -72, 8, -60); ctx.lineTo(4, -57); ctx.quadraticCurveTo(-10, -66, -24, -55); ctx.closePath(); ctx.fillStyle = '#6c7680'; ctx.fill(); ink(ctx, 1.6);
    R.limb(ctx, { x: -1, y: -36 }, { x: 18, y: -38 }, 7.4, 6.4, suit); R.limb(ctx, { x: 18, y: -38 }, { x: 19, y: -6 }, 6, 5, suit); R.limb(ctx, { x: 17, y: -6 }, { x: 29, y: -3 }, 5, 4.2, boot, { noHatch: true });
    // hunched torso: coverall with the Descent III patch
    ctx.save(); ctx.translate(0, br * 0.4); ctx.rotate(nod);
    const torso = [[-12, -33], [-15, -52], [-7, -71], [9, -72], [17, -58], [14, -33]];
    ctx.beginPath(); ctx.moveTo(torso[0][0], torso[0][1]);
    ctx.quadraticCurveTo(-17, -44, torso[1][0], torso[1][1]); ctx.quadraticCurveTo(-14, -66, torso[2][0], torso[2][1]); ctx.lineTo(torso[3][0], torso[3][1]);
    ctx.quadraticCurveTo(18, -68, torso[4][0], torso[4][1]); ctx.quadraticCurveTo(18, -44, torso[5][0], torso[5][1]); ctx.closePath();
    const Ld = R.lightDir(ctx), s = Ld.x > 0 ? 1 : -1;
    ctx.fillStyle = R.celGrad(ctx, 1, -52, 1, 0, 16, s, R.ramp(suit)); ctx.fill(); ink(ctx, 1.6);
    ctx.strokeStyle = 'rgba(14,4,22,0.4)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(1, -70); ctx.lineTo(2, -36); ctx.moveTo(-8, -48); ctx.lineTo(-3, -46); ctx.moveTo(-9, -42); ctx.lineTo(-4, -40); ctx.stroke();
    ctx.fillStyle = '#e8803a'; ctx.fillRect(-11, -64, 9, 7); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(-11, -64, 9, 7);
    ctx.fillStyle = '#1a1416'; ctx.font = '700 5.5px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('III', -6.5, -58.6);
    // crystal creeping up from the back of the shoulder
    const cg = done ? 0.65 : 1;
    shards(ctx, U.mulberry32(31), -10, -62, 10 * cg, '#c45cff', { base: -PI * 0.75, spread: 1.4, n: 4, ink: 1, glowA: 0.4 });
    // arms: counting on his fingers (before) / cradling a tin cup by the stove (after)
    const hx = done ? 22 : 20 + Math.sin(t * 2.1) * 1.5, hy = done ? -48 : -44;
    R.limb(ctx, { x: -2, y: -66 }, { x: 4, y: -48 }, 5.2, 4.6, suitB); R.limb(ctx, { x: 4, y: -48 }, { x: hx - 3, y: hy + 2 }, 4.4, 3.8, suitB);
    R.limb(ctx, { x: 6, y: -66 }, { x: 13, y: -50 }, 5.6, 5, suit); R.limb(ctx, { x: 13, y: -50 }, { x: hx, y: hy }, 4.6, 4, suit);
    ctx.beginPath(); ctx.arc(hx, hy, 3.6, 0, TAU); ctx.fillStyle = '#c99a7e'; ctx.fill(); ink(ctx, 1.1);
    if (done) { ctx.fillStyle = '#9aa4ae'; ctx.fillRect(hx - 3, hy - 9, 7, 8); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(hx - 3, hy - 9, 7, 8); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.moveTo(hx, hy - 11); ctx.quadraticCurveTo(hx + 3 + Math.sin(t * 2) * 2, hy - 18, hx, hy - 24); ctx.stroke(); }
    else { ctx.strokeStyle = '#c99a7e'; ctx.lineWidth = 1.6; const c = Math.floor(t * 1.4) % 5; for (let k = 0; k <= c; k++) { ctx.beginPath(); ctx.moveTo(hx + 1, hy - 2); ctx.lineTo(hx + 2 + k * 1.2, hy - 6 - (k % 2)); ctx.stroke(); } }
    // head: dented helmet with an empty lamp socket, grey beard, crystal half-face
    ctx.save(); ctx.translate(11, -80); ctx.rotate(0.18 + nod);
    ctx.beginPath(); ctx.ellipse(0, 2, 8.4, 9.6, 0, 0, TAU); ctx.fillStyle = '#c99a7e'; ctx.fill(); ink(ctx, 1.3);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 2, 8.4, 9.6, 0, 0, TAU); ctx.clip(); ctx.fillStyle = '#9a6e58'; ctx.fillRect(-9, -8, 6, 20); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-6, 4); ctx.quadraticCurveTo(-7, 18, 2, 19); ctx.quadraticCurveTo(10, 17, 9, 4); ctx.quadraticCurveTo(4, 8, -6, 4); ctx.closePath();
    ctx.fillStyle = '#cfcac0'; ctx.fill(); ink(ctx, 1.1);
    ctx.strokeStyle = 'rgba(80,70,64,0.6)'; ctx.lineWidth = 0.6; ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(-2 + k * 2.6, 8); ctx.lineTo(-1 + k * 2.4, 16); } ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(11, 3.5); ctx.lineTo(8, 4.5); ink(ctx, 1); // nose
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(3, -1); ctx.lineTo(6.5, -1.4); ctx.stroke(); // tired eye
    // crystal overgrowth on the far half of the face
    const cs = done ? 0.6 : 1;
    shards(ctx, U.mulberry32(7), -4, 2, 9 * cs, '#c45cff', { base: -PI * 0.8, spread: 1.8, n: 4, ink: 0.9, glowA: 0.45, glowR: 2.2 });
    if (!done) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 2.2); ctx.drawImage(spr('#e3a2ff'), -8, -6, 10, 10); ctx.restore(); }
    // helmet
    ctx.beginPath(); ctx.moveTo(-10, -2); ctx.quadraticCurveTo(-10, -15, 0, -15); ctx.quadraticCurveTo(10, -15, 10, -2); ctx.lineTo(13, -1); ctx.lineTo(13, 1); ctx.lineTo(-11, 1); ctx.closePath();
    ctx.fillStyle = '#b8923f'; ctx.fill(); ctx.save(); ctx.clip(); ctx.fillStyle = '#7a5f26'; ctx.fillRect(-11, -16, 7, 18); ctx.fillStyle = '#e8c878'; ctx.fillRect(5, -14, 3, 14); ctx.restore(); ink(ctx, 1.4);
    ctx.beginPath(); ctx.arc(6, -7, 3.2, 0, TAU); ctx.fillStyle = '#120c10'; ctx.fill(); ink(ctx, 1.1); // empty lamp socket
    ctx.restore();
    ctx.restore();
    ctx.restore();
  }
  G.UI.portraits.c3_brann = (ctx, W, H, game) => { ctx.setTransform(3.4, 0, 0, 3.4, W / 2 - 10, H * 0.84); drawBrann(ctx, 0, 0, 1.2, Object.assign({}, game, { player: { x: 999 } })); };

  // the vision on the water: a small girl of light with a red scarf, holding a music box, holding her breath
  function childFig(ctx, t) {
    const R = G.Rig, sway = Math.sin(t * 1.1) * 1.2;
    ctx.save(); ctx.scale(-1, 1);
    R.limb(ctx, { x: -3, y: -22 }, { x: -4, y: -1 }, 2.4, 2, '#cfc6f5', { noHatch: true }); R.limb(ctx, { x: 3.5, y: -22 }, { x: 4.5, y: -1 }, 2.4, 2, '#d9d2f8', { noHatch: true });
    // scarf tail, flowing behind her
    ctx.beginPath(); ctx.moveTo(-4, -46); ctx.quadraticCurveTo(-16, -44 + sway, -26, -36 + sway * 2); ctx.lineTo(-24, -32 + sway * 2); ctx.quadraticCurveTo(-14, -39 + sway, -3, -42); ctx.closePath();
    ctx.fillStyle = '#e23a4a'; ctx.fill(); ink(ctx, 1);
    // dress
    ctx.beginPath(); ctx.moveTo(-7, -46); ctx.quadraticCurveTo(-11, -32, -15, -19); ctx.quadraticCurveTo(0, -15, 15, -19); ctx.quadraticCurveTo(11, -32, 7, -46); ctx.closePath();
    ctx.fillStyle = R.celGrad(ctx, 0, -32, 1, 0, 14, R.lightDir(ctx).x > 0 ? 1 : -1, R.ramp('#e2dcff')); ctx.fill(); ink(ctx, 1.2);
    // arms around the music box
    R.limb(ctx, { x: -5, y: -44 }, { x: 4, y: -34 }, 2.2, 1.9, '#e2dcff', { noHatch: true }); R.limb(ctx, { x: 5, y: -44 }, { x: 8, y: -34 }, 2.2, 1.9, '#ece8ff', { noHatch: true });
    ctx.fillStyle = '#d8b46a'; ctx.fillRect(2, -37, 11, 7); ctx.fillStyle = '#b8903e'; ctx.fillRect(2, -40, 11, 3); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(2, -37, 11, 7); ctx.strokeRect(2, -40, 11, 3);
    // scarf wrap
    ctx.beginPath(); ctx.ellipse(0, -46, 7.5, 3.2, 0.1, 0, TAU); ctx.fillStyle = '#e23a4a'; ctx.fill(); ink(ctx, 1);
    // head, bobbed hair, eyes shut, cheeks held full
    ctx.beginPath(); ctx.arc(1, -55, 7.6, 0, TAU); ctx.fillStyle = '#f4efff'; ctx.fill(); ink(ctx, 1.2);
    ctx.beginPath(); ctx.moveTo(-7.5, -50); ctx.quadraticCurveTo(-9, -63, 1, -64); ctx.quadraticCurveTo(9, -63, 8.6, -55); ctx.quadraticCurveTo(4, -59, -1, -57); ctx.quadraticCurveTo(-4, -52, -7.5, -50); ctx.closePath();
    ctx.fillStyle = '#b9aee8'; ctx.fill(); ink(ctx, 1);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(3, -55); ctx.quadraticCurveTo(4.5, -54, 6, -55); ctx.stroke();
    ctx.beginPath(); ctx.arc(5.5, -51.5, 1.8, 0, TAU); ctx.fillStyle = 'rgba(255,150,170,0.6)'; ctx.fill();
    ctx.restore();
  }
  function drawVision(ctx, x, y, a, t) {
    ctx.save(); ctx.translate(x, y);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.7; ctx.drawImage(spr('#d8ccff'), -90, -130, 180, 180); ctx.restore();
    // reflection, broken by the water line
    ctx.save(); ctx.globalAlpha = a * 0.32; ctx.translate(0, 34); ctx.scale(1, -1); childFig(ctx, t); ctx.restore();
    ctx.globalAlpha = a * (0.85 + 0.1 * Math.sin(t * 3)); ctx.translate(0, Math.sin(t * 1.4) * 1.5 - 2);
    childFig(ctx, t);
    ctx.restore();
  }

  /* ============================== the set-piece: the Rest breathes ============================== */
  function startBreath(game) {
    BR.on = true; BR.t = 0; BR.phase = 1; BR.fired = {}; BR.ring = -1; BR.enc = game.encState;
    game.control = false;
    const P = game.player; P.vx = 0; P.setState('cine'); P.cineX = CHILD_X - 200; P.cineRun = false; P.cineFace = 1;
    G.SFX.play('c3_breathIn'); game.shake(0.25);
  }
  function updBreath(game, dt) {
    if (!BR.on) return;
    // the world was reset mid-scene (quit to title + continue, death, chapter restart): drop the scene instead of
    // leaving the screen dark and the music muted forever, and re-arm it if it never finished
    if (BR.enc !== game.encState) {
      Object.assign(BR, { on: false, phase: 0, t: 0, ring: -1, flare: 0, dark: 0, child: 0, fired: {} });
      if (!game.save.flags.c3_breath_seen) game.save.flags.t_c3_t_breath = false;
      return;
    }
    BR.t += dt;
    if (BR.phase === 1) {
      BR.dark = Math.min(1, BR.t / 2.4);
      if (BR.t > 1.8) {
        BR.child = Math.min(1, (BR.t - 1.8) / 1.6);
        if (!BR.fired.focus) { BR.fired.focus = 1; game.focus = { x: CHILD_X - 100, y: -130, zoom: 1.18 }; G.SFX.play('c3_musicbox'); }
      }
      if (BR.t > 5.8 && !BR.fired.dlg) {
        BR.fired.dlg = 1; game.player.setState('move');
        game.dialog('c3_breath', () => {
          BR.phase = 2; BR.t = 0; game.focus = null; game.save.flags.c3_breath_seen = true;
          G.SFX.play('c3_breathOut'); game.shake(0.7); game.hitstop(0.05);
          G.UI.journal('檔案庫更新', '休止 THE REST');
        });
      }
    } else if (BR.phase === 2) {
      BR.ring = Math.min(1, BR.t / 2.2); BR.dark = Math.max(0, 1 - BR.t / 1.1); BR.child = Math.max(0, 1 - BR.t / 0.7);
      BR.flare = Math.max(0, 1 - BR.t / 2.4) * Math.min(1, BR.t / 0.25);
      if (BR.t > 2.6) { BR.on = false; BR.phase = 0; BR.ring = -1; BR.flare = 0; BR.dark = 0; BR.child = 0; }
    }
  }

  /* ============================== story ============================== */
  const flags = () => (G.game && G.game.save && G.game.save.flags) || {};
  const PYLON2 = [
    { who: 'talia', text: '……喂？……凜……音？凜音！！你、你們——還活著？！' },
    { who: 'rinne', text: '嗯。' },
    { who: 'talia', text: '「嗯」是什麼意思啦！我看著貨梯從雲裡掉下去……我在鐘樓頂上坐了一整個晚上……！' },
    { who: 'ode', text: '塔莉亞，我們在梯基正下方約三公里。這座共鳴碑接上了第三降臨隊留下的中繼線。訊號品質：差。我的心情：好。' },
    { who: 'talia', text: '第三降臨隊……那是十年前的事了。大人說，那一年山裡一直在震，震了整整一年。' },
    { who: 'talia', text: '聽好，我沒辦法下去接你們。但我可以從這裡調你的刀——碎片帶來，我就幫你調。然後……你們要自己爬上來，知道嗎？' },
    { who: 'rinne', text: '知道。' },
    { who: 'talia', text: '……還有，謝謝你還活著。' },
  ];
  const BRANN_DONE = [
    { who: 'c3_brann', text: '……！燈。我的……燈。' },
    { who: 'c3_brann', text: '（布蘭用顫抖的手，從懷裡摸出最後一點燈油。火光亮起的那一瞬間，他臉上的晶體，退了一點。）' },
    { who: 'c3_brann', text: '……光。好亮。我……想起來了。我叫布蘭・歐卡，第三降臨隊的礦工。我有個女兒，在方舟上。今年……應該十九歲了。' },
    { who: 'ode', text: '凜音，他的共鳴讀數正在回升。很慢，但是在回升。' },
    { who: 'c3_brann', text: '這盞燈……你帶著。下面……更暗。哈德爾隊長……他不需要燈。他只需要……鑽。' },
    { who: 'c3_brann', text: '我留在這裡。現在……我可以數到天亮了。' },
  ];
  const D3 = {
    speakers: {
      c3_brann: { name: '老布蘭', en: 'OLD BRANN', color: '#e9c27a' },
      c3_hadal: { name: '哈德爾', en: 'HADAL', color: '#ff9a5c' },
      c3_mog: { name: '莫格', en: 'MOG', color: '#ffb36b' },
    },
    dialog: {
      c3_enter: [
        { who: 'ode', text: '……凜音。凜音。生命跡象：有。骨折：……我選擇先不算。' },
        { who: 'rinne', text: '……我們掉了多深？' },
        { who: 'ode', text: '貨梯黑盒子最後的高度讀數是負三千一百公尺。換句話說：比地面還低。低很多。' },
        { who: 'rinne', text: '塔莉亞呢？' },
        { who: 'ode', text: '沒有訊號。上面是三公里的岩石。下面……我不確定下面是什麼。這裡的背景雜訊，是零。' },
        { who: 'rinne', text: '零？' },
        { who: 'ode', text: '寂靜開始的地方，凜音。我們掉進了大寂靜的源頭。' },
        { who: 'rinne', text: '……那就從源頭開始。' },
      ],
      c3_pylon1: [
        { who: 'ode', text: '共鳴碑……在這種深度？有人在這裡架過碑。看編號——第三降臨隊。' },
        { who: 'rinne', text: '塔莉亞？' },
        { who: 'ode', text: '頻段上沒有人。不過她留給我的調校程式還在快取裡——帶著殘響碎片過來，我可以替她調你的刀。' },
        { who: 'ode', text: '品質大概是她親手調的百分之八十。剩下的百分之二十，是她碎碎念的部分。' },
        { who: 'rinne', text: '……那部分我比較想念。' },
      ],
      c3_pylon2: PYLON2,
      c3_pylon2b: PYLON2.slice(0, 7).concat([
        { who: 'talia', text: '對了——鐘樓的大鐘，每天傍晚都會響喔。是你找回鐘錘的那口。我每天都去敲。' },
        { who: 'talia', text: '說不定，你在下面也聽得到。' },
        { who: 'rinne', text: '……聽得到。' },
        PYLON2[7],
      ]),
      c3_pylon3: [
        { who: 'talia', text: '凜音，訊號又變差了……下面那個震動，連鐘樓的地板都在響。' },
        { who: 'ode', text: '前方就是鑽井的本體。震源：每秒十一次。從十年前到現在，一次也沒停過。' },
        { who: 'talia', text: '第三降臨隊的隊長叫哈德爾。小時候我聽過他的故事——他發誓要「把寂靜挖出來，帶回方舟給大家看」。' },
        { who: 'rinne', text: '他挖到了。' },
        { who: 'talia', text: '……小心。等你上來，我請你喝熱湯。鐘樓的湯很難喝，但是是熱的。' },
      ],
      c3_bats: [
        { who: 'ode', text: '頭頂有回音蝠。牠們靠聲納找獵物——在這裡，就是你。' },
        { who: 'ode', text: '俯衝之前會閃白光：格擋把牠彈開，再補一刀。牠們成群行動，別讓自己被包夾。' },
      ],
      c3_carapace: [
        { who: 'ode', text: '那隻蟹……前面那片不是殼，是寂裔晶體長成的盾。正面砍，只會冒火花。' },
        { who: 'ode', text: '兩個辦法：在牠白光鉗擊的瞬間完美格擋，把盾震裂；或者繞到牠背後。紅光的盾衝——閃開。' },
      ],
      c3_organ: [
        { who: 'rinne', text: '……牆在響。' },
        { who: 'ode', text: '不是牆。這些石柱是空心的，排列方式跟管風琴一模一樣。化石化的共鳴器官，比人類文明還老。' },
        { who: 'ode', text: '前面有深聽者。牠看不見，只聽得見：奔跑、跳躍、揮刀都會吵醒牠，被吵醒時會閃紅光猛撲。' },
        { who: 'rinne', text: '那就安靜地走過去。' },
        { who: 'ode', text: '或者安靜地從背後砍牠。兩個方案我都支持。' },
      ],
      c3_borer: [
        { who: 'ode', text: '地面的震動不對勁。底下有東西在挖洞。' },
        { who: 'ode', text: '地面一裂、一冒塵土，就是牠要從那裡竄出來——紅光，閃開。竄出來之後的甩尾是白光，可以格擋。' },
      ],
      c3_lake: [
        { who: 'ode', text: '地下湖。水面平得像鏡子……不對，太平了。一點漣漪都沒有。' },
        { who: 'rinne', text: '水滴下去，也沒有聲音。' },
        { who: 'ode', text: '這裡的寂靜濃度是剛才的三倍。凜音，我們越來越接近了。' },
      ],
      c3_breath: [
        { who: 'rinne', text: '……歐德。水面上。' },
        { who: 'ode', text: '讀數是零。凜音，那裡什麼都沒有。連我自己的風扇聲……我都聽不見了。' },
        { who: 'rinne', text: '是個孩子。圍著紅色的圍巾。' },
        { who: 'ode', text: '……我的感測器看不到她。但是——我聽到了。音樂盒。' },
        { who: 'rinne', text: '她在憋氣。好像只要一出聲，什麼東西就會碎掉。' },
        { who: 'ode', text: '凜音——整座洞窟，在「吐氣」了！' },
      ],
      c3_camp: [
        { who: 'ode', text: '營地。帳篷、絞盤、鑽井塔——方舟第三降臨隊的標誌。十年前派下來的隊伍。' },
        { who: 'rinne', text: '還有人嗎？' },
        { who: 'ode', text: '熱源一個。很弱，很冷……而且，好像在數數。' },
      ],
      c3_eliteIntro: [
        { who: 'ode', text: '前方熱源……不，是引信。有人在這裡佈了炸藥。很多炸藥。' },
        { who: 'c3_mog', text: '站住！這裡是爆破區！……啊，你不是布蘭。你身上有方舟的味道。' },
        { who: 'c3_mog', text: '第三降臨隊，爆破手莫格。隊長說過：誰都不准靠近井口。他在下面鑽，我在上面守。' },
        { who: 'rinne', text: '你們的隊長，已經十年沒有上來了。' },
        { who: 'c3_mog', text: '那就再守十年！引信已經點了，小姑娘——聽好了，這是最後一次警告！' },
      ],
      c3_eliteDefeat: [
        { who: 'c3_mog', text: '……哈。炸了一輩子的石頭，最後被一把會唱歌的刀給拆了。' },
        { who: 'c3_mog', text: '布蘭……那個老傢伙去拿燈油，就再也沒回來。如果你看到他……告訴他，引信我留給他了。' },
        { who: 'c3_mog', text: '隊長在最下面。他……已經不是人了。別讓他的鑽頭……停在半路上。' },
      ],
      c3_mine: [
        { who: 'ode', text: '礦道裡沒有光。在這種寂靜濃度下，我的探照燈只剩兩成。' },
        { who: 'rinne', text: '夠了。' },
        { who: 'ode', text: '止弦的共鳴會發一點微光。你看得到的範圍，就是你的世界。小心腳下的坑。' },
      ],
      c3_rest: [
        { who: 'ode', text: '……凜音，牆壁在「呼吸」。晶脈的亮度，每六秒起伏一次。' },
        { who: 'rinne', text: '跟湖上那時候一樣。' },
        { who: 'ode', text: '休止。瑪絲緹娜的手記裡寫的就是這個——不是怪物，是一首歌裡的「停頓」。而有人……一直讓它停著。' },
      ],
      c3_bossIntro: [
        { who: 'ode', text: '震動頻率每秒十一次，穩定得像心跳。凜音，那不是機器的聲音。' },
        { who: 'c3_hadal', text: '…………誰。誰在上面走動。' },
        { who: 'c3_hadal', text: '第三降臨隊，隊長哈德爾。任務：找到寂靜的源頭。進度：百分之九十九點九。' },
        { who: 'c3_hadal', text: '就差一點。就差最後一層。我把自己焊在鑽台上——這樣我就永遠不會停下來。' },
        { who: 'rinne', text: '下面沒有源頭。只有一個停住的拍子。' },
        { who: 'c3_hadal', text: '那就把它鑽穿！讓它發出聲音！……你擋到我的路了，共鳴者。' },
      ],
      c3_bossDefeat: [
        { who: 'c3_hadal', text: '……鑽頭……停了。' },
        { who: 'c3_hadal', text: '好安靜。原來……停下來的時候，是這種聲音。' },
        { who: 'c3_hadal', text: '我挖了十年，想讓它出聲……它其實一直在……換氣。像一個人……在憋氣……' },
        { who: 'ode', text: '凜音，鑽井打穿的岩層有氣流——往上的氣流。這條豎井，通往地表。' },
        { who: 'rinne', text: '走吧。' },
        { who: 'ode', text: '（攀爬中）高度：負兩千……負八百……負三十……' },
        { who: 'ode', text: '……月光。凜音，我們出來了。這裡是——一座城。泡在水裡的城。' },
        { who: 'ode', text: '舊首都萊拉。音樂之都。官方紀錄：二十年前沉沒，無人生還。' },
        { who: 'rinne', text: '……有人在唱歌。' },
      ],
      c3_brannMeet: [
        { who: 'c3_brann', text: '……三百零七。三百零八。……誰？' },
        { who: 'rinne', text: '方舟第七降臨隊，凜音。' },
        { who: 'c3_brann', text: '方……舟。第三……隊。布蘭。我是……布蘭。礦工。' },
        { who: 'c3_brann', text: '燈。我的燈……掉了。下面……礦道……暗的地方。' },
        { who: 'c3_brann', text: '沒有燈……就數數。數到……天亮。這裡……沒有天亮。' },
        { who: 'ode', text: '凜音，他的半張臉已經結晶化了。寂靜正在吃掉他……很慢。' },
        { who: 'c3_brann', text: '燈……幫我……找燈。有光……就有聲音。' },
      ],
      c3_brannWait: [
        { who: 'c3_brann', text: '……四百一十二。燈……在下面。過了莫格的……炸藥。暗的地方。' },
      ],
      c3_brannDone: [{ who: 'rinne', text: '是這盞嗎？' }].concat(BRANN_DONE),
      c3_brannDoneNew: [
        { who: 'c3_brann', text: '……五百……五百零一。……誰？那是……' },
        { who: 'rinne', text: '礦道裡撿到的。上面刻著「布蘭」。' },
      ].concat(BRANN_DONE),
      c3_brannHadal: [
        { who: 'c3_brann', text: '隊長……是個好人。他說，寂靜是從地底來的，那就把它挖出來，帶回方舟給大家看。' },
        { who: 'c3_brann', text: '後來……鑽頭碰到了「那個」。大家開始……不說話。一個接一個。' },
        { who: 'c3_brann', text: '隊長把自己焊在鑽台上。他說，只要鑽頭不停，就沒有人會被吞掉。' },
        { who: 'c3_brann', text: '十年了。鑽頭……從來沒有停過。' },
      ],
      c3_brannHum: [
        { who: 'c3_brann', text: '井底……有人在哼歌。很小聲。' },
        { who: 'c3_brann', text: '像小孩子。哼到一半……就停了。好像忘了……下一個音。' },
        { who: 'c3_brann', text: '我們都聽過。聽過的人……就不太想說話了。' },
        { who: 'ode', text: '……凜音，他哼的那段旋律。跟瑪絲緹娜的主題，是同一首。' },
      ],
    },
    barks: {
      c3_lampMet: { who: 'ode', text: '布蘭的燈。剛才那個熱源在移動——他好像跟著你的聲音，往前走了。' },
      c3_lampNew: { who: 'ode', text: '一盞熄滅的礦燈，刻著「布蘭」。前方有一個很弱的熱源……也許是燈的主人。' },
    },
    hints: {
      c3_listen: '<b>深聽者</b>只靠聲音獵食：奔跑、跳躍、攻擊都會驚動牠，被驚動時會閃 <b class="r">紅光</b> 猛撲 —— 放慢腳步靠近，或從背後出手',
      c3_quake: '地面 <b>龜裂、冒出塵土</b> 的地方，鑽岩蟲即將竄出（<b class="r">紅光</b>）—— 立刻 {dodge} 閃開，再趁牠露出身體時反擊',
      c3_climb: '頭頂的化石肋骨之間，似乎能一路往上爬…… {jump} 二段跳攀上骨棚',
    },
    codex: {
      people: [
        { id: 'c3_brann', name: '老布蘭', en: 'OLD BRANN — DESCENT III MINER', portrait: 'c3_brann', unlock: 'c3_met_brann',
          tag: 'NPC｜第三降臨隊・礦工',
          body: ['第三降臨隊的礦工，本名布蘭・歐卡。十年前為了替營地取燈油走進礦道，從此再也找不到回去的路。', '他的半張臉已經被寂裔晶體覆蓋。為了不讓自己忘記怎麼說話，他一直在數數——從一數到天亮，再從頭數起。', '「有光……就有聲音。」'] },
        { id: 'c3_hadal', name: '哈德爾', en: 'HADAL — THE BORE-KING', portrait: 'c3_boss', unlock: 'c3_boss_seen',
          tag: '失聲者｜第三降臨隊隊長',
          body: ['第三降臨隊隊長。十年前帶著一座鑽井塔、四十噸炸藥與十二名隊員來到梯基之下，發誓要「把寂靜挖出來」。', '當隊員一個接一個陷入沉默，他把自己焊進了鑽台。只要鑽頭不停，就沒有人會被吞掉——他是這麼相信的。', '十年來，鑽頭一次也沒有停過。'] },
        { id: 'c3_mog', name: '莫格', en: 'MOG — THE SAPPER', portrait: 'c3_elite', unlock: 'c3_elite_seen',
          tag: '菁英｜第三降臨隊・爆破手',
          body: ['第三降臨隊的爆破手。永遠覺得炸藥帶得不夠。', '隊長下令「誰都不准靠近井口」，他就真的守了十年。礦道的岩壁上，留著他用粉筆畫下的三千多道記號。'] },
      ],
      world: [
        { id: 'c3_faultwell', name: '斷層之井', en: 'THE FAULTWELL', unlock: 'c3_entered',
          body: ['頌歌之梯的梯基正下方、深達三千公尺的巨大裂縫。大寂靜最初，就是從這裡湧上地表的。', '這裡的背景雜訊是零。不是很安靜——是「零」。'] },
        { id: 'c3_organs', name: '化石管風琴', en: 'THE RESONANCE ORGANS', unlock: 't_c3_t_organ',
          body: ['斷層之井深處成片的空心石柱與巨大肋骨。排列方式與管風琴完全一致，年代比人類文明還要古老。', '瑪絲緹娜在手記中寫道：「這座洞窟是一具樂器。很久很久以前，大地在這裡唱歌。」'] },
        { id: 'c3_rest', name: '休止', en: 'THE REST', unlock: 'c3_breath_seen',
          body: ['寂靜不是怪物，而是世界之歌裡的一個「休止符」——一段被寫進樂譜的停頓。', '正常的休止會結束，歌會繼續。但這一個沒有。它每六秒「呼吸」一次，像是有人一直憋著氣，不敢讓下一個音落下。', '在鏡湖上，凜音看見了一個圍著紅圍巾的孩子。'] },
        { id: 'c3_descent3', name: '第三降臨隊', en: 'DESCENT SQUAD III', unlock: 't_c3_t_camp',
          body: ['十年前由頌歌方舟派出的第三支降臨隊。與其他隊伍不同，他們的任務不是戰鬥，而是挖掘：找到寂靜的源頭，並帶一塊樣本回去。', '十二名隊員。方舟最後收到的訊息是：「鑽頭不會停。」'] },
      ],
      items: [
        { id: 'c3_reed', name: '化石簧片', en: 'FOSSIL REED', unlock: 'relic_c3_reed', relic: true, body: ['從化石管風琴的音管裡掉出來的石質簧片。對著它吹氣，會發出一個比人類耳朵能聽見的更低的音。', '遺物效果：最大耐力 +15。'] },
        { id: 'c3_lamp', name: '礦燈', en: "BRANN'S LAMP", unlock: 'relic_c3_lamp', relic: true, body: ['老布蘭用最後一點燈油重新點亮的礦燈。光很小，但很暖。', '「有光，就有聲音。」', '遺物效果：擊破寂裔獲得的殘響碎片 +15%。'] },
        { id: 'c3_brannlamp', name: '熄滅的礦燈', en: 'AN UNLIT LAMP', unlock: 'c3_got_lamp', body: ['礦道深處撿到的舊式礦燈，燈罩上刻著「布蘭」。燈油已經乾了。'] },
      ],
      notes: [
        { id: 'c3_n1', name: '鑽井日誌 #001', en: 'DRILL LOG #001 — HADAL', body: ['【第三降臨隊・隊長 哈德爾】', '梯基錨站正下方，岩盤有一道裂縫。方舟想知道寂靜從哪裡來——答案就在我們腳底下。', '我們帶了一座鑽井塔、四十噸炸藥、十二個人。莫格說炸藥太少。莫格永遠說炸藥太少。', '目標：挖到源頭，帶一塊回去。預計工期：三週。'] },
        { id: 'c3_n2', name: '瑪絲緹娜的手記・一', en: "MAESTRINA'S NOTES — I", body: ['（工整的五線譜紙，邊角泛黃。署名：第一降臨隊 瑪絲緹娜。日期：二十年前。）', '這座洞窟是一具樂器。石柱是音管，地下湖是共鳴箱。很久很久以前，大地在這裡唱歌。', '然後歌停了。不是結束——是停頓。樂譜上的一個「休止符」。', '寂裔不是怪物。牠們只是困在休止符裡，忘記怎麼呼吸的音符。'] },
        { id: 'c3_n3', name: '鑽井日誌 #117', en: 'DRILL LOG #117', body: ['鑽頭在深度三千一百公尺碰到了「空洞」。不是空氣，也不是岩石。儀器上什麼都沒有——連雜訊都沒有。', '那天之後，隊員開始不說話。不是不能，是不想。羅森昨天整天坐在湖邊，盯著水面。', '我下令：鑽頭不准停。只要還有聲音，就還有人醒著。'] },
        { id: 'c3_n4', name: '瑪絲緹娜的手記・二', en: "MAESTRINA'S NOTES — II", body: ['（這一頁被摺了好幾次，像是不想被任何人讀到。）', '我在休止裡聽見了呼吸。很輕，很小，像是一個孩子在憋氣——怕自己一出聲，什麼東西就會碎掉。', '休止不是自然的停頓。是有人「撐著」它。', '如果我找得到她，我想告訴她：可以呼吸了。', '葛雷夫說我瘋了。也許吧。'] },
        { id: 'c3_n5', name: '莫格的粉筆記號', en: "MOG'S CHALK MARKS", body: ['（礦道的岩壁上，用粉筆畫滿了密密麻麻的記號。）', '第 3 號炸點：成功。第 4 號：成功。第 5 號：羅森沒回來。', '布蘭去拿燈油，說一下就回來。燈先放這裡——暗的地方要有光，他才找得到路。', '……第 3,650 天。布蘭還沒回來。燈的油，也乾了。'] },
        { id: 'c3_n6', name: '鑽井日誌・最後一頁', en: 'DRILL LOG — FINAL PAGE', body: ['（字跡被焊接的高溫燒焦了一半。）', '我把自己焊在操控台上了。這樣我就不會停下來，也不會想停下來。', '如果有人讀到這裡：別關掉鑽頭。只要它還在轉，寂靜就不會贏。', '……可是最近，我開始覺得，是寂靜在推著鑽頭轉。'] },
      ],
    },
    relics: {
      c3_reed: { name: '化石簧片', desc: '最大耐力 +15' },
      c3_lamp: { name: '礦燈', desc: '擊破寂裔獲得的殘響碎片 +15%' },
    },
  };

  /* ---------------- relic effects ---------------- */
  G.Relics.c3_reed = { apply(P) { P.maxSta += 15; } };
  G.Relics.c3_lamp = { apply() { lampPatch(); } };
  // shards +15%: wrap the death handler once (works in every chapter once the relic is equipped)
  function lampPatch() {
    const g = G.game; if (!g || g._c3Lamp) return; g._c3Lamp = true;
    const orig = g.onEnemyDeath;
    g.onEnemyDeath = function (e) {
      const n0 = this.pickups.length; orig.call(this, e);
      if ((this.save.equipped || []).includes('c3_lamp')) for (let i = n0; i < this.pickups.length; i++) if (this.pickups[i].kind === 'shard') this.pickups[i].val *= 1.15;
    };
  }
  window.addEventListener('load', lampPatch);

  /* ============================== music ============================== */
  // original motif of the Faultwell (B minor, "falling water"): its first bar is Maestrina's opening figure a third lower —
  // the oldest version of her song, as she first heard it down here
  const MOTIF = [
    [0, 71, 6], [6, 74, 2], [8, 78, 8],
    [16, 76, 4], [20, 74, 4], [24, 73, 8],
    [32, 74, 4], [36, 71, 4], [40, 69, 8],
    [48, 71, 12], [60, 66, 4],
    [64, 71, 6], [70, 74, 2], [72, 79, 8],
    [80, 78, 4], [84, 76, 4], [88, 74, 4], [92, 73, 4],
    [96, 74, 4], [100, 73, 4], [104, 70, 8],
    [112, 71, 16],
  ];
  const CELLO = [[0, 59, 8], [8, 62, 8], [16, 59, 8], [24, 57, 8], [32, 57, 8], [40, 54, 8], [48, 55, 16], [64, 59, 8], [72, 55, 8], [80, 52, 8], [88, 55, 8], [96, 54, 8], [104, 58, 8], [112, 59, 16]];
  const THEME3 = G.Music.THEME.map(([s, m, l]) => [s, m - 3, l]);           // Maestrina's theme in the Faultwell's key
  const COUNTER3 = G.Music.COUNTER.map(([s, m, l]) => [s, m - 3, l]);
  const RIFF = [
    [0, 59, 3], [3, 59, 3], [6, 62, 2], [8, 59, 4], [12, 60, 4],
    [16, 59, 3], [19, 59, 3], [22, 64, 2], [24, 62, 8],
    [32, 59, 3], [35, 59, 3], [38, 62, 2], [40, 66, 4], [44, 67, 4],
    [48, 66, 8], [56, 64, 4], [60, 62, 4],
    [64, 71, 3], [67, 71, 3], [70, 74, 2], [72, 71, 4], [76, 72, 4],
    [80, 71, 3], [83, 71, 3], [86, 76, 2], [88, 74, 8],
    [96, 74, 4], [100, 72, 4], [104, 71, 4], [108, 69, 4],
    [112, 66, 8], [120, 70, 8],
  ];
  const chords = {
    c3_Bm: [35, 62, 66, 71], c3_G: [31, 62, 67, 71], c3_Gmaj7: [31, 62, 66, 71], c3_D: [38, 62, 66, 69], c3_A: [33, 61, 64, 69],
    c3_Em: [40, 64, 67, 71], c3_Fs: [42, 61, 66, 70], c3_C: [36, 60, 64, 67], c3_Bsus: [35, 61, 66, 71],
  };
  const tracks = {
    c3_explore: { bpm: 76, chords: ['c3_Bm', 'c3_Gmaj7', 'c3_D', 'c3_A', 'c3_Bm', 'c3_Em', 'c3_Fs', 'c3_Bsus'], melody: MOTIF, mel: 'bell', melEvery: 2, pad: 'strings', arp: 'harp', choir: 0.15, bass: 0.35, drums: 0, counter: true, counterLine: CELLO },
    c3_explore2: { bpm: 62, chords: ['c3_Bm', 'c3_A', 'c3_D', 'c3_G', 'c3_Bm', 'c3_D', 'c3_Fs', 'c3_Bm'], melody: THEME3.map(([s, m, l]) => [s, m + 12, l]), mel: 'musicbox', melEvery: 2, pad: 'strings', arp: 'none', choir: 0.7, bass: 0, drums: 0, counter: true, counterLine: COUNTER3 },
    c3_elite: { bpm: 132, chords: ['c3_Bm', 'c3_C', 'c3_Bm', 'c3_A', 'c3_G', 'c3_C', 'c3_Em', 'c3_Fs'], melody: RIFF, mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 0.2, bass: 1, drums: 1, boss: true, timpani: true },
    c3_boss: { bpm: 140, chords: ['c3_Bm', 'c3_Bm', 'c3_G', 'c3_G', 'c3_Em', 'c3_Em', 'c3_Fs', 'c3_Fs'], melody: MOTIF.map(([s, m, l]) => [s, m - 12, l]), mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 0.7, bass: 1, drums: 1, boss: true, timpani: true, counter: true, counterLine: CELLO.map(([s, m, l]) => [s, m + 12, l]) },
    c3_boss2: { bpm: 152, chords: ['c3_Bm', 'c3_C', 'c3_Bm', 'c3_C', 'c3_Em', 'c3_Fs', 'c3_G', 'c3_Fs'], melody: THEME3.map(([s, m, l]) => [s, m - 12, l]), mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 1, bass: 1, drums: 1, boss: true, timpani: true, toms: true },
  };
  const ambience = {
    c3_drip: { bed: [0.22, 0.03, 0, 0.3], gap: [1.2, 3], evt(t, A) {
      const r = Math.random();
      if (r < 0.55) { const f = 1300 + Math.random() * 1100; A.tone('sine', f, t, 0.002, 0.03, 0.22, { to: f * 1.7, wet: 0.85 }); }
      else if (r < 0.8) A.noise(t, 0.9, 0.05, 1.8, 'lowpass', 90, 55, 0.7, 0.5);
      else A.bell(A.mtof(83 + [0, 3, 7, 10][Math.floor(Math.random() * 4)]), t, 0.012, 2.8, 1, 0.4);
    } },
    c3_organ: { bed: [0.3, 0.05, 0, 0.55], gap: [2, 4], evt(t, A) {
      if (Math.random() < 0.6) { A.tone('sine', A.mtof(35), t, 1.6, 0.05, 3.6, { wet: 0.7 }); A.tone('sine', A.mtof(42), t + 0.3, 1.6, 0.03, 3.4, { wet: 0.7 }); }
      else A.noise(t, 1.2, 0.035, 2.4, 'bandpass', 620, 380, 6, 0.6);
    } },
    c3_lake: { bed: [0.12, 0.02, 0, 0.25], gap: [1.6, 3.4], evt(t, A) {
      const r = Math.random();
      if (r < 0.45) A.noise(t, 0.3, 0.03, 0.9, 'lowpass', 520, 200, 0.5, 0.6);
      else if (r < 0.8) { const f = 260 + Math.random() * 160; A.tone('sine', f, t, 0.004, 0.025, 0.25, { to: f * 2.2, wet: 0.8 }); }
      else A.bell(A.mtof(86 + [0, -3, 2][Math.floor(Math.random() * 3)]), t, 0.008, 2.2, 1, 0.3);
    } },
    c3_camp: { bed: [0.35, 0.08, 0, 0.2], gap: [1.8, 4], evt(t, A) {
      const r = Math.random();
      if (r < 0.4) A.tone('sawtooth', 70 + Math.random() * 40, t, 0.4, 0.012, 1.4, { to: 55, wet: 0.6, filter: 'lowpass', ff: 600 });
      else if (r < 0.7) for (let i = 0; i < 3; i++) A.bell(A.mtof(94 + Math.floor(Math.random() * 5)), t + i * 0.09, 0.008, 0.5, 0.4, 1.2);
      else A.tone('sawtooth', 45, t, 1.0, 0.02, 2.5, { to: 41, filter: 'lowpass', ff: 220, wet: 0.5 });
    } },
    c3_mine: { bed: [0.1, 0.01, 0, 0.35], gap: [1.5, 3], evt(t, A) {
      if (Math.random() < 0.6) { const f = 1500 + Math.random() * 800; A.tone('sine', f, t, 0.002, 0.025, 0.2, { to: f * 1.6, wet: 0.9 }); }
      else A.tone('triangle', 90 + Math.random() * 30, t, 0.3, 0.02, 1.2, { to: 70, wet: 0.6 });
    } },
    c3_breath: { bed: [0.15, 0.02, 0, 0.9], gap: [5.4, 1.2], evt(t, A) {
      A.noise(t, 2.6, 0.06, 2.8, 'lowpass', 160, 520, 0.6, 0.7);
      A.tone('sine', A.mtof(47), t, 2.4, 0.04, 3, { wet: 0.8 });
      if (Math.random() < 0.4 && A.sfxBus) A.choirVoice(A.mtof(71), t + 1.2, 2.6, 0.018, A.sfxBus);
    } },
    c3_hush: { bed: [0.02, 0, 0, 0.6], gap: [60, 1], evt() { } },
  };
  const sfx = {
    c3_breathIn(t) { const A = G.AudioKit; A.noise(t, 2.2, 0.2, 0.8, 'lowpass', 180, 900, 0.8, 0.6); A.tone('sine', 55, t, 2, 0.12, 1.6, { to: 49, wet: 0.5 }); },
    c3_breathOut(t) { const A = G.AudioKit; A.noise(t, 0.08, 0.34, 2.4, 'lowpass', 1400, 120, 0.7, 0.7); A.tone('sine', 98, t, 0.05, 0.14, 2.2, { to: 41, wet: 0.6 }); A.bell(A.mtof(83), t + 0.1, 0.05, 3, 1, 0.6); A.bell(A.mtof(90), t + 0.35, 0.03, 3, 1, 0.5); },
    // the music box on the water: Maestrina's first notes (a third lower), very slow
    c3_musicbox(t) { const A = G.AudioKit, spb = 60 / 54 / 4; for (const [s, m] of THEME3) { if (s >= 64) break; A.bell(A.mtof(m + 12), t + s * spb, 0.07, 1.8, 0.8, 0.35); } },
    c3_lampOn(t) { const A = G.AudioKit; A.noise(t, 0.01, 0.2, 0.25, 'bandpass', 2400, 800, 1.2, 0.2); A.tone('triangle', 330, t + 0.05, 0.02, 0.06, 1.2, { to: 440, wet: 0.5 }); A.bell(A.mtof(79), t + 0.1, 0.06, 2.4, 0.7, 0.5); },
  };

  /* ============================== level ============================== */
  const brann = {
    id: 'c3_brann', label: '交談',
    get x() { return flags().c3_brann_moved ? 11330 : 7830; },
    get y() { return flags().c3_brann_moved ? 0 : -60; },
    // the engine draws every NPC every frame: skip him when he is nowhere near the camera
    draw(ctx, x, y, t, game) { const c = game && game.cam; if (c && Math.abs(x - c.x) > 1400) return; drawBrann(ctx, x, y, t, game); },
    pending(game) { const F = game.save.flags; return !F.c3_met_brann || (F.c3_got_lamp && !F.c3_quest_done); },
    talk(game) {
      const F = game.save.flags;
      if (F.c3_got_lamp && !F.c3_quest_done) {
        const id = F.c3_met_brann ? 'c3_brannDone' : 'c3_brannDoneNew';
        F.c3_met_brann = true;
        game.dialog(id, () => { F.c3_quest_done = true; G.SFX.play('c3_lampOn'); game.giveRelic('c3_lamp'); G.UI.journal('支線任務完成', '數數的礦工'); game.persist(); });
        return;
      }
      if (!F.c3_met_brann) { game.dialog('c3_brannMeet', () => { F.c3_met_brann = true; G.UI.journal('支線任務：數數的礦工', '在無光礦道找回老布蘭的礦燈'); }); return; }
      if (!F.c3_quest_done) { game.dialog('c3_brannWait'); return; }
      game.control = false;
      G.UI.choice({ kicker: '老布蘭 · OLD BRANN', title: '「……現在，我可以數到天亮了。」', desc: '要問他什麼？', items: [
        { label: '問他關於哈德爾隊長', en: 'ABOUT HADAL', action: () => game.dialog('c3_brannHadal') },
        { label: '問他井底的歌聲', en: 'ABOUT THE HUMMING', action: () => game.dialog('c3_brannHum') },
        { label: '告辭', en: 'LEAVE', action: () => { game.control = true; G.Input.clearBuffers(); } },
      ] });
    },
  };
  const level = {
    start: { x: 160, y: 0 }, bounds: [-400, BOSS_X1], gravity: 1,
    solids: [
      { x: -900, y: 0, w: 2250, h: 700, kind: 'c3_rock' },
      { x: 1350, y: -80, w: 650, h: 780, kind: 'c3_rock' },
      { x: 2000, y: 0, w: 1550, h: 700, kind: 'c3_rock' },
      { x: 3550, y: -110, w: 1000, h: 810, kind: 'c3_organ' },
      { x: 4550, y: -40, w: 1050, h: 740, kind: 'c3_organ' },
      { x: LAKE[0], y: 0, w: LAKE[1] - LAKE[0], h: 700, kind: 'c3_causeway' },
      { x: 7400, y: -60, w: 750, h: 760, kind: 'c3_rock' },
      { x: 8150, y: 0, w: PIT[0] - 8150, h: 700, kind: 'c3_camp' },
      { x: PIT[0], y: 120, w: PIT[1] - PIT[0], h: 580, kind: 'c3_rock' },
      { x: PIT[1], y: 0, w: BOSS_X1 + 400 - PIT[1], h: 700, kind: 'c3_vein' },
      { x: MINE[0], y: -1600, w: MINE[1] - MINE[0], h: 1320, kind: 'c3_mineroof' },
      { x: 4080, y: -800, w: 680, h: 50, kind: 'c3_loft' },
      { x: -900, y: -1600, w: 480, h: 1700, kind: 'wall' },
      { x: BOSS_X1, y: -1600, w: 400, h: 1700, kind: 'wall' },
    ],
    oneways: [
      { x: CAB.x + 10, y: CAB.top, w: CAB.w - 50, skin: 'none' },
      { x: 3620, y: -250, w: 170, skin: 'bone' }, { x: 3850, y: -390, w: 160, skin: 'bone' },
      { x: 3640, y: -530, w: 160, skin: 'bone' }, { x: 3870, y: -670, w: 170, skin: 'bone' },
      { x: 7880, y: -230, w: 210, skin: 'plank', post: 170 },
    ],
    pylons: [
      { id: 'c3_p1', x: 860, y: 0, name: '井底共鳴碑', dialog: 'c3_pylon1', flag: 'c3_pylon1_seen' },
      { id: 'c3_p2', x: 7560, y: -60, name: '鑽井營共鳴碑', get dialog() { return flags().c2_quest_done ? 'c3_pylon2b' : 'c3_pylon2'; }, flag: 'c3_pylon2_seen' },
      { id: 'c3_p3', x: 11200, y: 0, name: '休止之息共鳴碑', dialog: 'c3_pylon3', flag: 'c3_pylon3_seen' },
    ],
    notes: [
      { id: 'c3_n1', x: 1090, y: 0 },
      { id: 'c3_n2', x: 4420, y: -110 },
      { id: 'c3_n4', x: 4300, y: -800 },
      { id: 'c3_n3', x: 7990, y: -230 },
      { id: 'c3_n5', x: 9520, y: 0 },
      { id: 'c3_n6', x: 11010, y: 0 },
    ],
    items: [
      { id: 'c3_reed', x: 4690, y: -800, flag: 'c3_got_reed', name: '化石簧片', kind: 'relic' },
      { id: 'c3_brannlamp', x: 9790, y: 120, flag: 'c3_got_lamp', name: '熄滅的礦燈', kind: 'key', sfx: 'pickup',
        onTake(game) { const F = game.save.flags; F.c3_brann_moved = true; game.bark(F.c3_met_brann ? 'c3_lampMet' : 'c3_lampNew'); } },
    ],
    npcs: [brann],
    triggers: [
      { id: 'c3_t_bats', x: 1000, kind: 'dialog', dialog: 'c3_bats' },
      { id: 'c3_t_shield', x: 2030, kind: 'dialog', dialog: 'c3_carapace' },
      { id: 'c3_t_organ', x: 3000, kind: 'dialog', dialog: 'c3_organ', after: 'c3_listen' },   // past the carapace arena (2080–2980): never mid-fight
      { id: 'c3_t_climb', x: 3560, kind: 'hint', hint: 'c3_climb' },
      { id: 'c3_t_borer', x: 4570, kind: 'dialog', dialog: 'c3_borer', after: 'c3_quake' },
      { id: 'c3_t_lake', x: 5610, kind: 'dialog', dialog: 'c3_lake' },
      { id: 'c3_t_breath', x: 6420, kind: 'c3_breath' },
      { id: 'c3_t_camp', x: 7420, kind: 'dialog', dialog: 'c3_camp' },
      { id: 'c3_t_elite', x: ELITE_X0 + 60, kind: 'dialog', dialog: 'c3_eliteIntro', enc: 'c3_elite', startEnc: 'c3_elite', flag: 'c3_elite_seen', focus: { x: ELITE_X0 + 560, y: -170, zoom: 1 } },
      { id: 'c3_t_mine', x: MINE[0] + 20, kind: 'dialog', dialog: 'c3_mine' },
      { id: 'c3_t_rest', x: 10100, kind: 'dialog', dialog: 'c3_rest' },
      { id: 'c3_t_boss', x: BOSS_X0 - 200, kind: 'dialog', dialog: 'c3_bossIntro', enc: 'c3_boss', startEnc: 'c3_boss', flag: 'c3_boss_seen', focus: { x: BOSS_X0 + 800, y: -170, zoom: 0.95 }, music: 'c3_boss' },
    ],
    encounters: {
      c3_e1: { trigger: 1250, respawn: true, waves: [[{ t: 'c3_echobat', x: 1620, y: -250 }, { t: 'c3_echobat', x: 1760, y: -300 }, { t: 'c3_echobat', x: 1900, y: -240 }]] },
      c3_e2: { trigger: 2150, arena: [2080, 2980], waves: [[{ t: 'c3_carapace', x: 2700 }]] },
      c3_e3: { trigger: 3150, respawn: true, waves: [[{ t: 'c3_listener', x: 3420 }], [{ t: 'c3_echobat', x: 3300, y: -260 }, { t: 'c3_echobat', x: 3480, y: -290 }]] },
      c3_e4: { trigger: 4680, yMin: -300, arena: [4600, 5520], waves: [[{ t: 'c3_borer', x: 5150 }, { t: 'c3_echobat', x: 4950, y: -260 }], [{ t: 'c3_carapace', x: 5350 }, { t: 'c3_carapace', x: 4850 }]] },
      c3_e5: { trigger: 5720, arena: [5660, 6340], waves: [[{ t: 'c3_listener', x: 6050 }, { t: 'c3_listener', x: 6230 }], [{ t: 'c3_echobat', x: 5900, y: -260 }, { t: 'c3_echobat', x: 6150, y: -300 }, { t: 'c3_echobat', x: 6250, y: -240 }]] },
      c3_e6: { trigger: 10180, arena: [10120, 10960], waves: [
        [{ t: 'c3_borer', x: 10600 }, { t: 'c3_echobat', x: 10400, y: -260 }, { t: 'c3_echobat', x: 10750, y: -280 }],
        [{ t: 'c3_carapace', x: 10800 }, { t: 'c3_listener', x: 10350 }],
        [{ t: 'c3_borer', x: 10500 }, { t: 'c3_carapace', x: 10300 }],
      ] },
      c3_elite: { manual: true, elite: true, arena: [ELITE_X0, ELITE_X0 + 1000], waves: [[{ t: 'c3_elite', x: ELITE_X0 + 700 }]] },
      c3_boss: { manual: true, boss: true, arena: [BOSS_X0, BOSS_X1], waves: [[{ t: 'c3_boss', x: BOSS_X0 + 950 }]] },
    },
    zones: [
      { x: -1e9, name: '斷層之井・井底', en: 'THE FAULTWELL — SHAFT FLOOR', tint: 0, music: 'c3_explore', amb: 'c3_drip' },
      { x: Z.B, name: '化石管風琴窟', en: 'THE ORGAN CAVERNS', tint: 0.05, music: 'c3_explore', amb: 'c3_organ' },
      { x: Z.C, name: '鏡湖', en: 'THE STILL LAKE', tint: 0.15, music: 'c3_explore', amb: 'c3_lake' },
      { x: Z.D, name: '第三降臨隊・鑽井營', en: 'DESCENT III DRILL CAMP', tint: 0.3, music: 'c3_explore', amb: 'c3_camp' },
      { x: Z.M, name: '無光礦道', en: 'THE LIGHTLESS ADIT', tint: 0.55, music: 'c3_explore2', amb: 'c3_mine' },
      { x: Z.E, name: '休止之息', en: "THE REST'S BREATH", tint: 1, music: 'c3_explore2', amb: 'c3_breath' },
    ],
    tintAt,
  };

  const solidPainters = {
    c3_rock: (s) => paintRock(s), c3_organ: (s) => paintOrgan(s), c3_causeway: (s) => paintCauseway(s), c3_camp: (s) => paintCamp(s),
    c3_vein: (s) => paintVein(s), c3_mineroof: (s) => paintMineRoof(s), c3_loft: (s) => paintLoft(s),
  };

  /* ============================== register ============================== */
  G.Chapters.register({
    id: 3, key: 'ch3', num: 'III', numZh: '三', title: '斷層之井', en: 'THE FAULTWELL',
    intro: [
      { t: '墜落之後，是更深的墜落。', s: 'AFTER THE FALL, A DEEPER ONE.' },
      { t: '梯基之下，有一道從未被聽見的裂縫。\n大寂靜，是從這裡開始的。', s: 'BENEATH THE LADDER LIES A CRACK NO ONE HAS EVER HEARD. THE HUSH BEGAN HERE.' },
    ],
    enterDialog: 'c3_enter',
    outro: '「……月光。是一座泡在水裡的城。」',
    level,
    pal: {
      skyTop: ['#04050b', '#07030d'], skyMid: ['#0a1422', '#150920'], skyLow: ['#0d2c38', '#33103c'], horizon: ['#1a5a60', '#6a2478'],
      far: ['#163a48', '#3a1a52'], mid: ['#1a3040', '#2c173e'], midDark: ['#0d1a26', '#180b24'],
      near: ['#112030', '#1c0f28'], nearDark: ['#09111b', '#100717'], rim: ['#5ff2e0', '#d77bff'],
      ground: ['#2e3f4c', '#3a2a4c'], groundDark: ['#0d141c', '#120a18'], groundTop: ['#7fe8d6', '#d59cff'], fog: ['#2a7f86', '#7c3496'],
    },
    sky: { sun: false, clouds: false, ark: false, shafts: false, rays: 0 },
    bg: { far: () => genFar(), mid: () => genMid(), near: () => genNear(), props: () => genProps() },
    solidPainters,
    onewayPainter,
    music: { explore: 'c3_explore', boss: 'c3_boss', boss2: 'c3_boss2', elite: 'c3_elite', rest: 'rest' },
    tracks, chords,
    musicAt(x) { if (BR.on) return null; const z = L.zoneAt(x); return (z && z.music) || 'c3_explore'; },
    ambienceAt(x) { if (BR.on) return 'c3_hush'; const z = L.zoneAt(x); return (z && z.amb) || 'c3_drip'; },
    ambience, sfx,
    data: D3,
    upgradeBoost: { vit: [300], edge: [300] },
    hooks: {
      enter(game, run) {
        const P = game.player; P.setState('rest'); game.save.flags.c3_entered = true;
        game.focus = { x: 430, y: -300, zoom: 1.1 };
        G.SFX.play('quake'); game.shake(0.45);
        setTimeout(() => {
          if (game.state !== 'play' || !G.Chapters.cur || G.Chapters.cur.id !== 3) return;
          game.focus = null; P.setState('move', 0.6); game.dialog('c3_enter', run);
        }, 1900);
        return true;
      },
      update(game, dt) {
        const F = game.save.flags; if (!F.c3_entered) F.c3_entered = true;
        updBreath(game, dt);
      },
      trigger(game, tr) {
        if (tr.kind !== 'c3_breath') return false;
        // never take control away while Hushborn are still near — re-arm and wait
        if (game.enemies.some((e) => !e.dead && Math.abs(e.x - game.player.x) < 1500)) { game.save.flags['t_' + tr.id] = false; return true; }
        startBreath(game);
        return true;
      },
      drawBack, drawFront, drawForeground, drawSky, drawAtmos,
    },
    next: 4,
  });
})(window.G);

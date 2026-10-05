'use strict';
/* ECHOFALL — Chapter II 頌歌之梯 THE CANTATA LADDER (world, story, music).
   The Belfry (a cliffside village around a colossal silent bell) → the Frostwind Trail → the Old Cableway →
   Ladderwatch Cliff (vista + avalanche) → the Ladder's frozen Anchor Station → the Counterweight (Sister Calla).
   Foes live in ch2_foes.js / ch2_boss.js and are referenced by id. See docs/CHAPTER_API.md + docs/STORY.md. */
(function (G) {
  const WK = G.WorldKit, U = G.U, L = G.LEVEL, PI = Math.PI, TAU = PI * 2;
  const INK = '#0b0612';
  const P = (k, t) => WK.P(k, t);

  /* =========================================================================================
     PALETTE + COMMON INKS
     ========================================================================================= */
  const SNOW = { hi: '#ffffff', lit: '#f3f6ff', mid: '#d6def5', sh: '#9daad8', deep: '#6b74ab' };
  const ROCK = { lit: '#8d90b4', base: '#5e6192', dark: '#3b3c69', deep: '#232348' };
  const WOOD = { lit: '#c08a58', base: '#8a5636', dark: '#552f24', deep: '#2f1a18' };
  const BRONZE = { hi: '#ffe2a0', lit: '#e9b466', base: '#b27a3c', dark: '#6b3a22', deep: '#3a1e16' };
  const STEEL = { hi: '#d9e2f2', lit: '#a3afc8', base: '#6c7894', dark: '#3e465f', deep: '#242a40' };
  const FLAGS = ['#e8473f', '#f2c14e', '#3fa7d6', '#f4f1e8', '#3fb37a'];
  const XTAL = { core: '#bdf8ff', lit: '#8ff0ff', base: '#4fb7e0', dark: '#2c5f9c', vein: '#ff5f9a' };
  const LAMP = '#ffb35a';

  const poly = (g, pts, close = true) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); if (close) g.closePath(); };
  const inkS = (g, w = 1.6, a = 1) => { g.strokeStyle = a < 1 ? `rgba(11,6,18,${a})` : INK; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
  const glowAt = (g, x, y, r, col, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, U.rgba(col, a)); gr.addColorStop(0.4, U.rgba(col, a * 0.35)); gr.addColorStop(1, U.rgba(col, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  };

  /* =========================================================================================
     PAINTERS (cached tiles: deterministic, rng captured at generation time)
     ========================================================================================= */
  // a snow-capped mountain with a hard cel split (sun on the right), ridge lines, crevasse hatching and an ink contour
  function peak(g, rng, x, base, w, h, C, ink = 1.6) {
    const sx = x + w * (0.38 + rng() * 0.24), sy = base - h, n = 8;
    const out = [];
    for (let i = 0; i <= n; i++) { const u = i / n; out.push([U.lerp(x, sx, u) + (i && i < n ? (rng() - 0.5) * w * 0.05 : 0), U.lerp(base, sy, Math.pow(u, 0.85)) + (i && i < n ? (rng() - 0.5) * h * 0.07 : 0)]); }
    for (let i = 1; i <= n; i++) { const u = i / n; out.push([U.lerp(sx, x + w, u) + (i < n ? (rng() - 0.5) * w * 0.05 : 0), U.lerp(sy, base, Math.pow(u, 1.15)) + (i < n ? (rng() - 0.5) * h * 0.07 : 0)]); }
    const deep = base + 700;
    // silhouette (shadow plane)
    g.beginPath(); g.moveTo(x, deep); for (const p of out) g.lineTo(p[0], p[1]); g.lineTo(x + w, deep); g.closePath();
    g.fillStyle = C.shade; g.fill();
    g.save(); g.clip();
    // lit plane: right of a zig-zag spine from the summit
    const spine = [[sx, sy]]; let cx = sx, cy = sy;
    while (cy < base) { cy += h * (0.1 + rng() * 0.12); cx += (rng() - 0.35) * w * 0.07; spine.push([cx, Math.min(cy, base)]); }
    g.beginPath(); g.moveTo(sx, sy); for (const p of spine) g.lineTo(p[0], p[1]); g.lineTo(x + w + 20, base + 10); g.lineTo(x + w + 20, sy - 20); g.closePath();
    g.fillStyle = C.lit; g.fill();
    // snow cap: jagged lower edge with drips down gullies
    const capY = sy + h * (0.32 + rng() * 0.14);
    g.beginPath(); g.moveTo(x - 10, sy - 40);
    for (let xx = x - 10; xx <= x + w + 10; xx += w / 16) {
      const k = Math.abs(xx - sx) / (w * 0.6);
      g.lineTo(xx, capY + k * h * 0.12 + (rng() < 0.3 ? rng() * h * 0.22 : rng() * h * 0.05));
    }
    g.lineTo(x + w + 10, sy - 40); g.closePath();
    g.fillStyle = C.snowS; g.fill();
    g.save(); g.clip();
    g.beginPath(); g.moveTo(sx, sy); for (const p of spine) g.lineTo(p[0], p[1]); g.lineTo(x + w + 20, base); g.lineTo(x + w + 20, sy - 30); g.closePath();
    g.fillStyle = C.snowL; g.fill();
    g.restore();
    // ridges & crevasses (ink, thin) on the shadow side
    g.strokeStyle = U.rgba(C.ink, 0.45); g.lineWidth = ink * 0.55;
    for (let k = 0; k < 5; k++) {
      const u = 0.15 + rng() * 0.7; let px = U.lerp(sx, x, u * 0.6), py = U.lerp(sy, base, u * 0.5);
      g.beginPath(); g.moveTo(px, py);
      for (let s = 0; s < 4; s++) { px -= w * 0.02 + rng() * w * 0.03; py += h * 0.06 + rng() * h * 0.05; g.lineTo(px, py); }
      g.stroke();
    }
    g.strokeStyle = U.rgba(C.ink, 0.5); g.lineWidth = ink * 0.7;
    g.beginPath(); g.moveTo(sx, sy); for (const p of spine) g.lineTo(p[0], p[1]); g.stroke();
    g.restore();
    // ink contour (not along the base)
    g.beginPath(); g.moveTo(out[0][0], out[0][1]); for (const p of out) g.lineTo(p[0], p[1]);
    g.strokeStyle = U.rgba(C.ink, 0.85); g.lineWidth = ink; g.lineJoin = 'round'; g.stroke();
    // warm rim on the sunlit shoulder
    g.beginPath(); for (let i = n; i < out.length - 3; i++) (i === n ? g.moveTo : g.lineTo).call(g, out[i][0] - 1, out[i][1] + 1.5);
    g.strokeStyle = U.rgba(C.rim, 0.75); g.lineWidth = ink * 0.8; g.stroke();
  }

  // snowy conifer: stacked jagged tiers, cel split, a snow load on each tier, inked
  function pine(g, rng, x, base, h, C, ink = 1.3) {
    const tiers = 4 + Math.floor(rng() * 3), W = h * (0.34 + rng() * 0.1);
    g.fillStyle = C.trunk; g.fillRect(x - h * 0.03, base - h * 0.2, h * 0.06, h * 0.22);
    for (let i = 0; i < tiers; i++) {
      const u = i / tiers, ty = base - h * 0.14 - u * h * 0.78, tw = W * (1 - u * 0.72), th = h * (0.3 - u * 0.04);
      const top = [x + (rng() - 0.5) * 2, ty - th], pts = [top];
      const nB = 6;
      for (let k = 0; k <= nB; k++) { const v = k / nB; pts.push([x + tw - v * tw * 2, ty + (k % 2 ? -th * 0.12 : th * 0.04) + (rng() - 0.5) * 3]); }
      poly(g, pts); g.fillStyle = C.dark; g.fill();
      g.save(); g.clip();
      g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(x + tw + 4, ty + 4); g.lineTo(x + 2, ty + 6); g.closePath(); g.fillStyle = C.lit; g.fill();
      // snow load
      g.beginPath(); g.moveTo(top[0], top[1] - 2);
      g.lineTo(x + tw * 0.92, ty - th * 0.08);
      for (let k = 0; k <= 5; k++) { const v = k / 5; g.lineTo(x + tw * 0.92 - v * tw * 1.75, ty - th * (0.22 + (k % 2) * 0.12) - v * th * 0.05); }
      g.closePath(); g.fillStyle = C.snowS; g.fill();
      g.beginPath(); g.moveTo(top[0], top[1] - 2); g.lineTo(x + tw * 0.92, ty - th * 0.08); g.lineTo(x + tw * 0.2, ty - th * 0.3); g.closePath(); g.fillStyle = C.snowL; g.fill();
      g.restore();
      poly(g, pts); inkS(g, ink, 0.9);
    }
  }

  // timber house, gable end facing us: stone plinth, half-timbered wall, warm windows, steep snow roof with icicles
  function house(g, rng, x, base, w, h, C, o = {}) {
    const wallTop = base - h, roofH = w * (0.55 + rng() * 0.2), eave = w * 0.12, ridge = wallTop - roofH;
    // stilts / plinth
    const deep = o.deep ?? 600;
    g.fillStyle = C.stone; g.fillRect(x - 2, base - h * 0.16, w + 4, h * 0.16 + deep);
    g.strokeStyle = U.rgba(INK, 0.5); g.lineWidth = 1;
    for (let yy = base - h * 0.16 + 6; yy < base + 10; yy += 8) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
    // wall with cel split (sun right)
    g.fillStyle = C.wallS; g.fillRect(x, wallTop, w, h * 0.84);
    g.fillStyle = C.wall; g.fillRect(x + w * 0.42, wallTop, w * 0.58, h * 0.84);
    // timber frame
    g.strokeStyle = C.beam; g.lineWidth = Math.max(2, w * 0.04);
    g.beginPath(); g.moveTo(x, wallTop + 3); g.lineTo(x + w, wallTop + 3); g.moveTo(x, base - h * 0.16); g.lineTo(x + w, base - h * 0.16);
    g.moveTo(x + 3, wallTop); g.lineTo(x + 3, base - h * 0.16); g.moveTo(x + w - 3, wallTop); g.lineTo(x + w - 3, base - h * 0.16);
    if (w > 70) { g.moveTo(x + w / 2, wallTop); g.lineTo(x + w / 2, base - h * 0.16); g.moveTo(x + 4, base - h * 0.17); g.lineTo(x + w / 2, wallTop + h * 0.3); g.lineTo(x + w - 4, base - h * 0.17); }
    g.stroke();
    // windows (warm), one or two rows
    const rows = h > 110 ? 2 : 1, cols = Math.max(1, Math.floor(w / 46));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng() < 0.18) continue;
      const ww = Math.min(18, w * 0.2), wh = ww * 1.25;
      const wx = x + (c + 0.5) * (w / cols) - ww / 2 + (cols === 1 ? 0 : 0), wy = wallTop + h * 0.14 + r * h * 0.34;
      const lit = rng() < (o.lit ?? 0.7);
      if (lit) glowAt(g, wx + ww / 2, wy + wh / 2, ww * 2.6, LAMP, 0.35);
      g.fillStyle = lit ? '#ffcf7a' : C.winD; g.fillRect(wx, wy, ww, wh);
      if (lit) { g.fillStyle = '#fff1c4'; g.fillRect(wx + 2, wy + 2, ww * 0.35, wh * 0.4); }
      g.strokeStyle = C.beam; g.lineWidth = 2; g.strokeRect(wx, wy, ww, wh);
      g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.lineWidth = 1.2; g.stroke();
      // snow on the sill
      g.fillStyle = SNOW.lit; g.beginPath(); g.ellipse(wx + ww / 2, wy + wh + 1, ww * 0.62, 2.4, 0, PI, 0); g.fill();
    }
    // door
    if (o.door !== false && h > 70) {
      const dw = Math.min(22, w * 0.24), dx = x + w * (0.62 + rng() * 0.12) - dw / 2, dh = h * 0.36;
      g.fillStyle = C.beam; g.fillRect(dx, base - h * 0.16 - dh, dw, dh);
      g.fillStyle = 'rgba(255,190,110,0.5)'; g.fillRect(dx + dw * 0.4, base - h * 0.16 - dh + 4, dw * 0.2, dh * 0.5);
    }
    // outline walls
    g.beginPath(); g.rect(x, wallTop, w, h * 0.84); inkS(g, o.ink || 1.6, 0.9);
    g.beginPath(); g.rect(x - 2, base - h * 0.16, w + 4, h * 0.16 + deep); inkS(g, (o.ink || 1.6) * 0.8, 0.8);
    // chimney
    if (rng() < 0.75) {
      const cx = x + w * (0.2 + rng() * 0.5), cw = Math.max(8, w * 0.12);
      g.fillStyle = C.stone; g.fillRect(cx, ridge + roofH * 0.25 - 26, cw, 40);
      g.beginPath(); g.rect(cx, ridge + roofH * 0.25 - 26, cw, 40); inkS(g, 1.2, 0.9);
      g.fillStyle = SNOW.lit; g.beginPath(); g.ellipse(cx + cw / 2, ridge + roofH * 0.25 - 26, cw * 0.7, 3.5, 0, PI, 0); g.fill();
    }
    // roof: dark shingle gable, then a thick snow load
    const L0 = [x - eave, wallTop + 4], R0 = [x + w + eave, wallTop + 4], T0 = [x + w / 2, ridge];
    poly(g, [L0, T0, R0, [x + w + eave, wallTop + 10], [x - eave, wallTop + 10]]); g.fillStyle = C.roof; g.fill(); inkS(g, o.ink || 1.6);
    // snow
    const sn = [[x - eave - 3, wallTop + 2], [x + w / 2, ridge - 7], [x + w + eave + 3, wallTop + 2]];
    const lip = [];
    for (let k = 0; k <= 10; k++) { const v = k / 10; lip.push([U.lerp(x + w + eave + 3, x - eave - 3, v), wallTop + 2 + 5 + (k % 3 === 0 ? 4 : 0) + rng() * 2]); }
    poly(g, sn.concat([[x + w + eave + 3, wallTop + 8]], lip.slice(1))); g.fillStyle = SNOW.sh; g.fill();
    poly(g, [[x + w / 2, ridge - 7], [x + w + eave + 3, wallTop + 2], [x + w + eave, wallTop + 6], [x + w / 2 + 2, ridge + 4]]); g.fillStyle = SNOW.lit; g.fill();
    poly(g, [[x + w / 2, ridge - 7], [x - eave - 3, wallTop + 2], [x - eave, wallTop + 5], [x + w / 2 - 2, ridge + 3]]); g.fillStyle = SNOW.mid; g.fill();
    poly(g, sn.concat([[x + w + eave + 3, wallTop + 8]], lip.slice(1))); inkS(g, o.ink || 1.6);
    // icicles under the eaves
    g.fillStyle = '#e6f6ff';
    for (let xx = x - eave + 4; xx < x + w + eave - 4; xx += 5 + rng() * 9) {
      const il = 3 + rng() * 11; g.beginPath(); g.moveTo(xx - 1.6, wallTop + 9); g.lineTo(xx, wallTop + 9 + il); g.lineTo(xx + 1.6, wallTop + 9); g.fill();
    }
    // hanging lantern / small bell under the eave
    if (o.lantern !== false && rng() < 0.6) {
      const lx = x + w + eave - 6, ly = wallTop + 22;
      g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(lx, wallTop + 8); g.lineTo(lx, ly - 6); g.stroke();
      glowAt(g, lx, ly, 28, LAMP, 0.55);
      g.fillStyle = '#ffd38a'; g.fillRect(lx - 4, ly - 6, 8, 11); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(lx - 4, ly - 6, 8, 11);
    }
    return { ridge, wallTop };
  }

  // prayer-flag line between two points: sagging cord with little cloth squares in five colours
  function flagLine(g, rng, x1, y1, x2, y2, sag, size = 9, inkW = 0.8) {
    const q = (u) => { const mx = (x1 + x2) / 2, my = Math.max(y1, y2) + sag; const a = 1 - u; return [a * a * x1 + 2 * a * u * mx + u * u * x2, a * a * y1 + 2 * a * u * my + u * u * y2]; };
    g.strokeStyle = 'rgba(30,20,30,0.85)'; g.lineWidth = inkW; g.beginPath();
    for (let k = 0; k <= 20; k++) { const p = q(k / 20); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke();
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(len / (size * 1.6));
    for (let k = 1; k < n; k++) {
      const p = q(k / n), c = FLAGS[k % 5], tilt = (rng() - 0.3) * 0.35;
      g.save(); g.translate(p[0], p[1]); g.rotate(tilt);
      g.fillStyle = c; g.fillRect(-size * 0.45, 0, size * 0.9, size * 1.1);
      g.fillStyle = 'rgba(40,20,50,0.25)'; g.fillRect(-size * 0.45, size * 0.55, size * 0.9, size * 0.55);
      g.strokeStyle = 'rgba(11,6,18,0.7)'; g.lineWidth = inkW * 0.8; g.strokeRect(-size * 0.45, 0, size * 0.9, size * 1.1);
      g.restore();
    }
  }

  // steel lattice tower (cableway pylons, gantries)
  function lattice(g, x, base, w, h, top, col, colLit, ink = 1.4, cross = true) {
    const tw = top;
    g.strokeStyle = col; g.lineWidth = Math.max(2, w * 0.07);
    g.beginPath(); g.moveTo(x - w / 2, base); g.lineTo(x - tw / 2, base - h); g.moveTo(x + w / 2, base); g.lineTo(x + tw / 2, base - h); g.stroke();
    if (cross) {
      g.lineWidth = Math.max(1, w * 0.03);
      const n = Math.max(3, Math.floor(h / (w * 0.9)));
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const y0 = base - (h * i) / n, y1 = base - (h * (i + 1)) / n, u0 = i / n, u1 = (i + 1) / n;
        const l0 = x - U.lerp(w, tw, u0) / 2, r0 = x + U.lerp(w, tw, u0) / 2, l1 = x - U.lerp(w, tw, u1) / 2, r1 = x + U.lerp(w, tw, u1) / 2;
        g.moveTo(l0, y0); g.lineTo(r1, y1); g.moveTo(r0, y0); g.lineTo(l1, y1); g.moveTo(l1, y1); g.lineTo(r1, y1);
      }
      g.stroke();
    }
    g.strokeStyle = colLit; g.lineWidth = Math.max(1, w * 0.035);
    g.beginPath(); g.moveTo(x + w / 2 - 1, base); g.lineTo(x + tw / 2 - 1, base - h); g.stroke();
    void ink;
  }

  // Hush crystal (Ch II): icy cyan shards with rose veins, inked, small baked glow
  function hcrystal(g, rng, x, y, s, glow = true, ink = 1.4) {
    if (glow) glowAt(g, x, y - s * 0.5, s * 1.7, '#8fe8ff', 0.22);
    const n = 3 + Math.floor(rng() * 4);
    const shards = [];
    for (let i = 0; i < n; i++) {
      const a = -PI / 2 + (rng() - 0.5) * 1.5, len = s * (0.55 + rng() * 0.9), wd = s * (0.12 + rng() * 0.1), bx = x + (rng() - 0.5) * s * 0.7;
      shards.push({ a, len, wd, bx });
    }
    shards.sort((p, q) => q.len - p.len);
    for (const sh of shards) {
      const tx = sh.bx + Math.cos(sh.a) * sh.len, ty = y + Math.sin(sh.a) * sh.len, nx = -Math.sin(sh.a) * sh.wd, ny = Math.cos(sh.a) * sh.wd;
      const mx = sh.bx + Math.cos(sh.a) * sh.len * 0.75, my = y + Math.sin(sh.a) * sh.len * 0.75;
      const pts = [[sh.bx - nx, y - ny], [mx - nx * 0.9, my - ny * 0.9], [tx, ty], [mx + nx * 0.9, my + ny * 0.9], [sh.bx + nx, y + ny]];
      poly(g, pts); g.fillStyle = XTAL.dark; g.fill();
      poly(g, [[sh.bx, y], [mx, my], [tx, ty], [mx + nx * 0.9, my + ny * 0.9], [sh.bx + nx, y + ny]]); g.fillStyle = XTAL.base; g.fill();
      poly(g, [[mx, my], [tx, ty], [mx + nx * 0.9, my + ny * 0.9]]); g.fillStyle = XTAL.lit; g.fill();
      // rose vein
      g.strokeStyle = U.rgba(XTAL.vein, 0.85); g.lineWidth = Math.max(0.8, sh.wd * 0.22);
      g.beginPath(); g.moveTo(sh.bx + nx * 0.2, y - 2); g.lineTo((sh.bx + mx) / 2 - nx * 0.3, (y + my) / 2); g.lineTo(mx + nx * 0.1, my); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(mx + nx * 0.6, my + ny * 0.6); g.lineTo(tx, ty); g.stroke();
      poly(g, pts); inkS(g, ink, 0.9);
    }
  }

  // stone outcrop with snow on top (props / near layer)
  function boulder(g, rng, x, base, w, h, C, ink = 1.6) {
    const pts = [[x, base + 4]]; const n = 6;
    for (let i = 1; i < n; i++) { const u = i / n; pts.push([x + u * w + (rng() - 0.5) * w * 0.08, base - h * Math.sin(u * PI) * (0.75 + rng() * 0.35)]); }
    pts.push([x + w, base + 4]);
    poly(g, pts); g.fillStyle = C.dark; g.fill();
    g.save(); g.clip();
    g.beginPath(); g.moveTo(x + w * 0.45, base - h * 1.2); g.lineTo(x + w + 10, base - h * 1.2); g.lineTo(x + w + 10, base + 10); g.lineTo(x + w * 0.62, base + 10); g.closePath(); g.fillStyle = C.lit; g.fill();
    g.beginPath(); for (let i = 0; i < pts.length; i++) { const p = pts[i]; i ? g.lineTo(p[0], p[1] + h * 0.18 + (i % 2) * 3) : g.moveTo(p[0], p[1] - h); }
    for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1] - 6);
    g.closePath(); g.fillStyle = C.snow; g.fill();
    g.restore();
    poly(g, pts); inkS(g, ink, 0.9);
  }

  /* =========================================================================================
     PARALLAX LAYERS
     ========================================================================================= */
  const WORLD_W = 13400; // bounds span (+ margin)
  const tAt = (wx) => L.tintAt(wx);

  function genFar() {
    const f = 0.08, rng = U.mulberry32(2201), objs = [];
    const X0 = -700, X1 = WORLD_W * f + 900;
    // snowfield base (fills below the ground line) in chunks so the tint follows the journey
    for (let x = X0; x < X1; x += 300) {
      const t = tAt((x + 150) / f), xx = x;
      objs.push({ x: xx - 2, y: -40, w: 304, h: 760, draw(g) {
        const gr = g.createLinearGradient(0, -40, 0, 300);
        gr.addColorStop(0, U.mixHex(P('far', t), '#ffffff', 0.25)); gr.addColorStop(0.3, P('far', t)); gr.addColorStop(1, U.mixHex(P('mid', t), P('far', t), 0.5));
        g.fillStyle = gr; g.fillRect(xx - 2, -40, 304, 760);
      } });
    }
    // palest back range
    for (let x = X0; x < X1; x += 260) {
      const t = tAt((x + 130) / f), xx = x, seed = rng() * 1e6;
      objs.push({ x: xx - 4, y: -330, w: 270, h: 1050, draw(g) {
        const col = U.mixHex(P('far', t), P('skyLow', t), 0.45), hi = U.mixHex(col, '#ffffff', 0.45);
        const yf = (X) => -120 - 150 * U.noise1(X * 0.006, 3) - 55 * U.noise1(X * 0.025, 7);
        g.beginPath(); g.moveTo(xx - 4, 700);
        for (let X = xx - 4; X <= xx + 266; X += 6) g.lineTo(X, yf(X));
        g.lineTo(xx + 266, 700); g.closePath(); g.fillStyle = col; g.fill();
        g.save(); g.clip();
        g.beginPath(); for (let X = xx - 4; X <= xx + 266; X += 6) (X === xx - 4 ? g.moveTo : g.lineTo).call(g, X, yf(X) + 26 + 10 * U.noise1(X * 0.05, 2));
        for (let X = xx + 266; X >= xx - 4; X -= 6) g.lineTo(X, yf(X) - 5);
        g.closePath(); g.fillStyle = hi; g.fill();
        g.restore();
        g.strokeStyle = U.rgba(U.mixHex(col, '#2a2050', 0.5), 0.5); g.lineWidth = 1;
        g.beginPath(); for (let X = xx - 4; X <= xx + 266; X += 6) (X === xx - 4 ? g.moveTo : g.lineTo).call(g, X, yf(X)); g.stroke();
        void seed;
      } });
    }
    // main range
    let x = X0;
    while (x < X1) {
      const w = 220 + rng() * 360, h = 200 + rng() * 300, t = tAt((x + w / 2) / f), seed = rng() * 1e6, xx = x;
      const C = {
        shade: U.mixHex(P('mid', t), P('far', t), 0.55), lit: U.mixHex(P('far', t), P('rim', t), 0.18),
        snowS: U.mixHex('#b9c3e8', P('far', t), 0.35), snowL: U.mixHex('#fff4f0', P('rim', t), 0.12), ink: '#2a2450', rim: P('rim', t),
      };
      objs.push({ x: xx - 10, y: -h - 20, w: w + 20, h: h + 740, draw(g) { peak(g, U.mulberry32(seed | 0), xx, 30, w, h, C, 1.6); } });
      x += w * (0.45 + rng() * 0.35);
    }
    // giant Hush crystal spires on the slopes above the anchor valley
    for (const [cx, s] of [[700, 70], [760, 110], [835, 60], [1010, 90], [1090, 55]]) {
      const seed = rng() * 1e6;
      objs.push({ x: cx - s * 2, y: -s * 2.6, w: s * 4, h: s * 2.8, draw(g) {
        g.globalAlpha = 0.7; hcrystal(g, U.mulberry32(seed | 0), cx, 20, s, true, 1.2); g.globalAlpha = 1;
      } });
    }
    // the Cantata Ladder: one impossible line from the valley into the sky (aligned over the counterweight arena)
    const TX = 12100 * f;
    objs.push({ x: TX - 160, y: -2600, w: 320, h: 2680, draw(g) {
      // anchor collar + struts
      g.fillStyle = '#6f7aa6';
      poly(g, [[TX - 70, 30], [TX - 26, -60], [TX + 26, -60], [TX + 70, 30]]); g.fill(); inkS(g, 1.4, 0.6);
      // column
      const gr = g.createLinearGradient(TX - 9, 0, TX + 9, 0);
      gr.addColorStop(0, '#5a6290'); gr.addColorStop(0.55, '#8d97c4'); gr.addColorStop(0.56, '#c7cdf0'); gr.addColorStop(1, '#e8ebff');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(TX - 11, -50); g.lineTo(TX - 4, -2600); g.lineTo(TX + 4, -2600); g.lineTo(TX + 11, -50); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(40,36,80,0.6)'; g.lineWidth = 1; g.stroke();
      // maintenance rings
      for (let y = -180; y > -2500; y -= 150 + ((y * 7) % 40)) {
        const k = 1 + y / 3400, rw = 26 * k;
        g.strokeStyle = 'rgba(70,74,120,0.85)'; g.lineWidth = 2.2;
        g.beginPath(); g.ellipse(TX, y, rw, rw * 0.22, 0, 0, TAU); g.stroke();
        g.strokeStyle = 'rgba(255,236,230,0.6)'; g.lineWidth = 1; g.beginPath(); g.ellipse(TX, y, rw, rw * 0.22, 0, -0.9, 0.6); g.stroke();
      }
      // dawn catching the right edge high up
      g.fillStyle = 'rgba(255,214,190,0.55)'; g.fillRect(TX + 2, -2600, 2, 2200);
    } });
    // low mist in front of the bases
    objs.push({ x: X0 - 200, y: -70, w: X1 - X0 + 400, h: 120, draw(g) {
      const gr = g.createLinearGradient(0, -70, 0, 50); gr.addColorStop(0, 'rgba(235,240,255,0)'); gr.addColorStop(0.7, 'rgba(232,238,255,0.55)'); gr.addColorStop(1, 'rgba(225,232,250,0.3)');
      g.fillStyle = gr; g.fillRect(this.x, this.y, this.w, this.h);
    } });
    return objs;
  }

  // the frozen waterfall (trail landmark, mid layer): a horseshoe cliff, a cascade frozen into bulging drapery
  function frozenFall(g, rng, x, base, w, h) {
    const top = base - h, C = { dark: '#384273', mid: '#55609a', lit: '#8692c4' };
    // recessed back wall
    g.fillStyle = '#2a3260'; g.fillRect(x - w * 0.15, top - 10, w * 1.3, h + 620);
    // buttresses
    const Lb = [[x - w * 1.3, base + 600], [x - w * 1.25, top + h * 0.2], [x - w * 0.95, top - h * 0.08], [x - w * 0.55, top - h * 0.12], [x - w * 0.12, top + 4], [x - w * 0.02, base + 600]];
    const Rb = [[x + w * 1.02, base + 600], [x + w * 1.1, top + 2], [x + w * 1.5, top - h * 0.1], [x + w * 2.0, top + h * 0.12], [x + w * 2.35, top + h * 0.45], [x + w * 2.5, base + 600]];
    for (const B of [Lb, Rb]) {
      poly(g, B); g.fillStyle = C.dark; g.fill();
      g.save(); g.clip();
      g.fillStyle = C.mid; poly(g, [[B[2][0], B[2][1]], [B[3][0], B[3][1]], [B[3][0] + w * 0.2, base + 600], [B[2][0] + w * 0.25, base + 600]]); g.fill();
      g.fillStyle = C.lit; poly(g, [[B[3][0], B[3][1]], [B[4][0], B[4][1]], [B[4][0] + w * 0.1, base + 600], [B[3][0] + w * 0.2, base + 600]]); g.fill();
      g.strokeStyle = 'rgba(20,16,50,0.45)'; g.lineWidth = 1;
      for (let k = 0; k < 7; k++) { const yy = top + rng() * h, xx0 = B[1][0] + rng() * (B[4][0] - B[1][0]); g.beginPath(); g.moveTo(xx0, yy); g.lineTo(xx0 + 10 + rng() * 14, yy + 8 + rng() * 10); g.stroke(); }
      // snow caps
      g.fillStyle = SNOW.lit;
      g.beginPath(); g.moveTo(B[1][0] - 4, B[1][1] - 2); for (let i = 2; i < 5; i++) g.lineTo(B[i][0], B[i][1] - 4);
      for (let i = 4; i >= 1; i--) g.lineTo(B[i][0] + 3, B[i][1] + 9 + (i % 2) * 7); g.closePath(); g.fill();
      g.restore();
      poly(g, B.slice(0, 5), false); inkS(g, 1.6, 0.85);
    }
    // the cascade: drapery strands (back = darker), bulging and tapering, a few stopping short as huge icicles
    const n = 15;
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
      const u = (i + (pass ? 0.5 : 0)) / n, sx = x + u * w + (rng() - 0.5) * 6, sw = (w / n) * (pass ? 1.2 : 1.7) * (0.75 + rng() * 0.5);
      const full = rng() < 0.6, len = full ? h + 4 : h * (0.45 + rng() * 0.4), ph = rng() * 6;
      const L2 = [], R2 = [];
      for (let k = 0; k <= 8; k++) {
        const v = k / 8, y = top + v * len, wf = (1 + 0.28 * Math.sin(v * PI * 3 + ph)) * (full ? (1 + v * 0.35) : (1 - v * 0.85));
        L2.push([sx - (sw / 2) * wf, y]); R2.push([sx + (sw / 2) * wf, y]);
      }
      const pts = L2.concat(full ? [] : [[sx, top + len + sw * 0.8]], R2.reverse());
      poly(g, pts); g.fillStyle = pass ? '#9fd6f2' : '#5f86c6'; g.fill();
      if (pass) {
        g.save(); poly(g, pts); g.clip();
        g.fillStyle = '#e4f8ff'; g.fillRect(sx + sw * 0.05, top - 4, sw * 0.45, len + 30);
        g.fillStyle = '#ffffff'; g.fillRect(sx + sw * 0.18, top - 4, sw * 0.08, len * 0.8);
        g.fillStyle = 'rgba(60,90,170,0.45)'; g.fillRect(sx - sw, top - 4, sw * 0.7, len + 30);
        g.restore();
      }
      poly(g, pts); g.strokeStyle = pass ? 'rgba(30,50,110,0.7)' : 'rgba(20,30,80,0.6)'; g.lineWidth = 0.9; g.stroke();
    }
    // lip of the falls: snow brow + icicle fringe
    g.fillStyle = SNOW.lit; g.beginPath(); g.ellipse(x + w / 2, top + 2, w * 0.62, 9, 0, PI, TAU); g.fill(); inkS(g, 1.2, 0.8);
    g.fillStyle = '#e8f8ff';
    for (let xx = x - 4; xx < x + w + 4; xx += 3 + rng() * 5) { const il = 8 + rng() * 26; g.beginPath(); g.moveTo(xx - 2, top + 6); g.lineTo(xx, top + 6 + il); g.lineTo(xx + 2, top + 6); g.fill(); }
    // ice mound at the foot (cel)
    poly(g, [[x - w * 0.35, base + 3], [x + w * 0.05, base - 26], [x + w * 0.5, base - 34], [x + w * 0.95, base - 22], [x + w * 1.35, base + 3]]); g.fillStyle = '#8fc6ec'; g.fill();
    poly(g, [[x + w * 0.5, base - 34], [x + w * 0.95, base - 22], [x + w * 1.35, base + 3], [x + w * 0.7, base + 3]]); g.fillStyle = '#dff6ff'; g.fill();
    poly(g, [[x - w * 0.35, base + 3], [x + w * 0.05, base - 26], [x + w * 0.5, base - 34], [x + w * 0.95, base - 22], [x + w * 1.35, base + 3]]); inkS(g, 1.2, 0.75);
  }

  // multi-tier pagoda (the Belfry's bell towers), built on a terrace
  function pagoda(g, rng, x, base, w, tiers, C) {
    let y = base, ww = w;
    g.fillStyle = C.stone; g.fillRect(x - ww * 0.62, y - 14, ww * 1.24, 30); g.beginPath(); g.rect(x - ww * 0.62, y - 14, ww * 1.24, 30); inkS(g, 1.2, 0.8);
    y -= 14;
    for (let k = 0; k < tiers; k++) {
      const th = 30 - k * 2.5, hw = ww / 2;
      g.fillStyle = C.wallS; g.fillRect(x - hw * 0.8, y - th, hw * 1.6, th);
      g.fillStyle = C.wall; g.fillRect(x, y - th, hw * 0.8, th);
      g.fillStyle = 'rgba(255,207,122,0.35)'; g.fillRect(x - 10, y - th + 4, 20, th - 6);
      g.fillStyle = '#ffcf7a'; g.fillRect(x - 4, y - th + 7, 8, th - 12);
      g.beginPath(); g.rect(x - hw * 0.8, y - th, hw * 1.6, th); inkS(g, 1.1, 0.85);
      y -= th;
      const rw = hw * 1.25, rh = 14;
      poly(g, [[x - rw, y + 2], [x - rw * 0.85, y - 4], [x - hw * 0.5, y - rh], [x + hw * 0.5, y - rh], [x + rw * 0.85, y - 4], [x + rw, y + 2], [x + rw * 0.8, y + 5], [x - rw * 0.8, y + 5]]);
      g.fillStyle = C.roof; g.fill(); inkS(g, 1.1, 0.85);
      poly(g, [[x - rw - 2, y], [x - hw * 0.5, y - rh - 3], [x + hw * 0.5, y - rh - 3], [x + rw + 2, y], [x + rw * 0.6, y - 2], [x + hw * 0.3, y - rh + 4], [x - hw * 0.3, y - rh + 4], [x - rw * 0.6, y - 2]]);
      g.fillStyle = C.snow; g.fill();
      g.fillStyle = '#ffffff'; poly(g, [[x, y - rh - 3], [x + hw * 0.5, y - rh - 3], [x + rw + 2, y], [x + rw * 0.6, y - 2], [x + hw * 0.3, y - rh + 4], [x, y - rh + 4]]); g.fill();
      for (const sgn of [-1, 1]) { g.strokeStyle = INK; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x + sgn * rw * 0.95, y + 3); g.lineTo(x + sgn * rw * 0.95, y + 9); g.stroke(); g.fillStyle = BRONZE.lit; g.beginPath(); g.arc(x + sgn * rw * 0.95, y + 10, 2, 0, TAU); g.fill(); }
      y -= rh - 2; ww *= 0.84;
    }
    g.strokeStyle = C.roof; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 26); g.stroke();
    g.fillStyle = BRONZE.lit; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x, y - 6 - k * 7, 2.6 - k * 0.5, 0, TAU); g.fill(); }
    void rng;
  }

  function genMid() {
    const f = 0.22, rng = U.mulberry32(4402), objs = [];
    const X0 = -700, X1 = WORLD_W * f + 900;
    const Cf = (t) => ({
      dark: U.mixHex(P('midDark', t), P('fog', t), 0.32), base: U.mixHex(P('mid', t), P('fog', t), 0.36), lit: U.mixHex(U.mixHex(P('mid', t), P('rim', t), 0.35), P('fog', t), 0.3),
      snowS: U.mixHex(SNOW.sh, P('fog', t), 0.3), snowL: U.mixHex(SNOW.lit, P('fog', t), 0.15), trunk: U.mixHex('#3b2a3a', P('fog', t), 0.3),
    });
    // ground fill
    for (let x = X0; x < X1; x += 400) {
      const t = tAt((x + 200) / f), xx = x;
      objs.push({ x: xx - 2, y: 0, w: 404, h: 720, draw(g) {
        const gr = g.createLinearGradient(0, 0, 0, 260); gr.addColorStop(0, U.mixHex(SNOW.mid, P('fog', t), 0.35)); gr.addColorStop(0.15, U.mixHex(P('mid', t), P('fog', t), 0.3)); gr.addColorStop(1, P('midDark', t));
        g.fillStyle = gr; g.fillRect(xx - 2, 0, 404, 720);
      } });
    }
    // Belfry: the mountainside the village is carved into — faceted rock, snowfields, stone terraces lined with houses,
    // flag lines strung between roofs and two lantern-lit pagodas (world x < 3000)
    const belfryEnd = 3000 * f;
    const ridge = (X) => -250 - 120 * U.noise1(X * 0.004, 11) - 55 * U.noise1(X * 0.018, 4) + Math.max(0, X - (belfryEnd - 120)) * 1.1;
    const TER = [-36, -112, -190];
    const terOK = (X, by) => Math.min(34, ridge(X)) < by - 70;
    for (let x = X0; x < belfryEnd + 300; x += 260) {
      const xx = x, seed = rng() * 1e6;
      objs.push({ x: xx - 4, y: -520, w: 268, h: 1260, draw(g) {
        const r = U.mulberry32(seed | 0), C = Cf(0);
        const rid = (X) => Math.min(34, ridge(X));
        g.beginPath(); g.moveTo(xx - 4, 740); for (let X = xx - 4; X <= xx + 264; X += 8) g.lineTo(X, rid(X)); g.lineTo(xx + 264, 740); g.closePath();
        g.fillStyle = C.dark; g.fill();
        g.save(); g.clip();
        for (let k = 0; k < 8; k++) {
          const fx = xx - 40 + k * 40 + r() * 20, fy = rid(fx) + 6;
          poly(g, [[fx, fy], [fx + 26 + r() * 20, fy + 50 + r() * 60], [fx + 52 + r() * 24, fy + 170 + r() * 90], [fx + 64 + r() * 20, fy + 60], [fx + 30, fy + 4]]);
          g.fillStyle = k % 3 ? C.base : C.lit; g.fill();
        }
        g.strokeStyle = U.rgba(INK, 0.3); g.lineWidth = 1;
        for (let k = 0; k < 12; k++) { const sx0 = xx + r() * 260, sy0 = rid(sx0) + 20 + r() * 220; g.beginPath(); g.moveTo(sx0, sy0); g.lineTo(sx0 + 12 + r() * 16, sy0 + 6 + r() * 12); g.lineTo(sx0 + 26 + r() * 16, sy0 + 2 + r() * 24); g.stroke(); }
        const snowEdge = (X, d) => rid(X) + d + 18 * U.noise1(X * 0.05, 9) + (Math.sin(X * 0.17) > 0.75 ? 26 : 0);
        for (const [d, col] of [[30, C.snowS], [16, C.snowL]]) {
          g.beginPath(); g.moveTo(xx - 4, rid(xx - 4) - 3);
          for (let X = xx - 4; X <= xx + 264; X += 8) g.lineTo(X, rid(X) - 3);
          for (let X = xx + 264; X >= xx - 4; X -= 8) g.lineTo(X, snowEdge(X, d));
          g.closePath(); g.fillStyle = col; g.fill();
        }
        // terraces: stone retaining walls with a snow lip, wherever the slope is high enough
        const wallC = U.mixHex('#6e6a8a', P('fog', 0), 0.3);
        for (const by of TER) {
          g.fillStyle = wallC;
          for (let X = xx - 4; X <= xx + 264; X += 4) if (terOK(X, by)) g.fillRect(X, by, 4.5, 24);
          g.strokeStyle = U.rgba(INK, 0.35); g.lineWidth = 0.8;
          g.beginPath();
          for (let X = xx - 4; X <= xx + 264; X += 14) if (terOK(X, by) && terOK(X + 14, by)) { g.moveTo(X, by + 8); g.lineTo(X + 14, by + 8); g.moveTo(X + 7, by + 8); g.lineTo(X + 7, by + 16); g.moveTo(X, by + 16); g.lineTo(X + 14, by + 16); }
          g.stroke();
          g.fillStyle = C.snowL; for (let X = xx - 4; X <= xx + 264; X += 4) if (terOK(X, by)) g.fillRect(X, by - 3, 4.5, 4);
          g.fillStyle = U.rgba(INK, 0.5); for (let X = xx - 4; X <= xx + 264; X += 4) if (terOK(X, by)) g.fillRect(X, by + 23, 4.5, 1.4);
        }
        g.restore();
        g.beginPath(); for (let X = xx - 4; X <= xx + 264; X += 8) (X === xx - 4 ? g.moveTo : g.lineTo).call(g, X, rid(X)); inkS(g, 1.5, 0.75);
      } });
    }
    const HCm = { stone: U.mixHex('#6e6a8a', P('fog', 0), 0.35), wall: U.mixHex('#b88a63', P('fog', 0), 0.38), wallS: U.mixHex('#7a5146', P('fog', 0), 0.38), beam: U.mixHex('#4a2c28', P('fog', 0), 0.32), roof: U.mixHex('#4a3048', P('fog', 0), 0.32), winD: '#3a3050', snow: U.mixHex(SNOW.mid, P('fog', 0), 0.2) };
    // pagodas first (on the top terrace), then houses from the top terrace down so nearer ones overlap
    for (const [px, tiers] of [[150, 5], [470, 4]]) {
      const seed = rng() * 1e6;
      objs.push({ x: px - 60, y: -190 - tiers * 44 - 60, w: 120, h: tiers * 44 + 90, draw(g) { pagoda(g, U.mulberry32(seed | 0), px, -190, 64, tiers, HCm); } });
    }
    for (let tier = 2; tier >= 0; tier--) {
      const by = TER[tier];
      let prev = null;
      for (let x = X0 + 10; x < belfryEnd - 20; x += 46 + rng() * 70) {
        if (!terOK(x - 10, by + 20) || !terOK(x + 80, by + 20)) { prev = null; continue; }
        if (tier === 2 && (Math.abs(x - 150) < 70 || Math.abs(x - 470) < 60)) { prev = null; continue; }
        if (rng() < 0.22) { prev = null; continue; }
        const hw = 28 + rng() * 24, hh = 22 + rng() * 20, seed = rng() * 1e6, xx = x;
        objs.push({ x: xx - 20, y: by - hh - hw * 0.9 - 40, w: hw + 40, h: hh + hw + 50, draw(g) { house(g, U.mulberry32(seed | 0), xx, by, hw, hh, HCm, { ink: 1.1, lit: 0.75, door: false, deep: 2, lantern: false }); } });
        if (prev && rng() < 0.7) { const a = prev, bx = xx + hw * 0.5, seed2 = rng() * 1e6, top = Math.min(a[1], by - hh); objs.push({ x: a[0] - 10, y: top - 20, w: bx - a[0] + 20, h: 80, draw(g) { flagLine(g, U.mulberry32(seed2 | 0), a[0], a[1], bx, by - hh - 6, 16, 4.5, 0.5); } }); }
        prev = [xx + hw * 0.5, by - hh - 6];
        x += hw;
      }
    }
    // trail: crags, pines and the frozen waterfall (signature) — world x 3000..6600
    let x = belfryEnd;
    const trailEnd = 6700 * f;
    while (x < trailEnd) {
      const t = tAt(x / f), w = 90 + rng() * 140, h = 160 + rng() * 260, seed = rng() * 1e6, xx = x;
      objs.push({ x: xx - 30, y: -h - 40, w: w + 60, h: h + 800, draw(g) {
        const r = U.mulberry32(seed | 0), C = Cf(t);
        const pts = [[xx, 740], [xx + r() * 10, 30 - h * 0.4], [xx + w * 0.3, 30 - h * (0.85 + r() * 0.15)], [xx + w * 0.45, 30 - h], [xx + w * 0.7, 30 - h * (0.7 + r() * 0.2)], [xx + w, 30 - h * 0.3], [xx + w, 740]];
        poly(g, pts); g.fillStyle = C.dark; g.fill();
        g.save(); g.clip();
        poly(g, [[xx + w * 0.45, 30 - h - 10], [xx + w + 10, 30 - h * 0.3], [xx + w + 10, 740], [xx + w * 0.55, 740]]); g.fillStyle = C.base; g.fill();
        poly(g, [[xx, 30 - h * 0.4 - 6], [xx + w * 0.3, 30 - h * 0.9 - 8], [xx + w * 0.45, 30 - h - 8], [xx + w * 0.7, 30 - h * 0.78 - 8], [xx + w, 30 - h * 0.3 - 6], [xx + w * 0.7, 30 - h * 0.62], [xx + w * 0.45, 30 - h * 0.78], [xx + w * 0.25, 30 - h * 0.6]]);
        g.fillStyle = C.snowS; g.fill();
        g.restore();
        poly(g, pts.slice(1, 6), false); inkS(g, 1.4, 0.75);
      } });
      x += w * (0.7 + rng() * 0.5);
    }
    // pine forest bands on the slopes
    for (let px = belfryEnd - 300; px < trailEnd + 60; px += 14 + rng() * 26) {
      const t = tAt(px / f), h = 40 + rng() * 60, seed = rng() * 1e6, xx = px, by = 34 + rng() * 6;
      objs.push({ x: xx - h * 0.5, y: by - h - 4, w: h, h: h + 10, draw(g) { pine(g, U.mulberry32(seed | 0), xx, by, h, Cf(t), 1); } });
    }
    { // the frozen waterfall at world x ≈ 3900
      const fx = 3900 * f - 30;
      objs.push({ x: fx - 120, y: -420, w: 320, h: 1160, draw(g) { frozenFall(g, U.mulberry32(77), fx, 34, 90, 360); } });
    }
    // the old cableway: lattice pylons stepping down toward the station, sagging cables
    const pyl = [[5200 * f, 300], [5900 * f, 340], [6700 * f, 280], [7600 * f, 240], [8600 * f, 230]];
    objs.push({ x: pyl[0][0] - 60, y: -400, w: pyl[pyl.length - 1][0] - pyl[0][0] + 120, h: 460, draw(g) {
      const C = Cf(0.5);
      for (let i = 0; i < pyl.length; i++) {
        const [px, ph] = pyl[i];
        lattice(g, px, 34, 26, ph, 8, U.mixHex('#2c2e52', P('fog', 0.5), 0.2), U.mixHex('#9aa6d8', P('fog', 0.5), 0.2));
        g.fillStyle = U.mixHex('#2c2e52', P('fog', 0.5), 0.2); g.fillRect(px - 22, 34 - ph - 4, 44, 5);
        g.fillStyle = C.snowL; g.fillRect(px - 22, 34 - ph - 6, 44, 2.5);
        if (i < pyl.length - 1) {
          const [qx, qh] = pyl[i + 1];
          for (const dy of [0, 6]) WK.cables(g, px - 18, 34 - ph + dy, qx - 18, 34 - qh + dy, 40, 'rgba(30,30,60,0.8)', 1.1);
        }
      }
      // a stranded gondola car mid-span
      const gx = (pyl[1][0] + pyl[2][0]) / 2 - 18, gy = 34 - 290;
      g.strokeStyle = 'rgba(30,30,60,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx, gy + 18); g.stroke();
      g.fillStyle = '#b8473f'; g.fillRect(gx - 12, gy + 18, 24, 16); g.fillStyle = '#ffd38a'; g.fillRect(gx - 8, gy + 21, 6, 5); g.fillRect(gx + 2, gy + 21, 6, 5);
      g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(gx - 12, gy + 18, 24, 16);
      g.fillStyle = C.snowL; g.fillRect(gx - 13, gy + 16, 26, 2.5);
    } });
    // the anchor station: tanks, gantry cranes, stacks with steam, sodium lamps, crystal growths (world x > 7000)
    x = 7000 * f;
    while (x < X1) {
      const t = tAt(x / f), kind = rng(), seed = rng() * 1e6, xx = x;
      if (kind < 0.35) {
        const w = 60 + rng() * 50, h = 90 + rng() * 120;
        objs.push({ x: xx - 20, y: -h - 60, w: w + 40, h: h + 800, draw(g) {
          const r = U.mulberry32(seed | 0), base = U.mixHex(STEEL.base, P('fog', t), 0.4), dark = U.mixHex(STEEL.dark, P('fog', t), 0.35), lit = U.mixHex(STEEL.lit, P('fog', t), 0.25);
          g.fillStyle = dark; g.fillRect(xx, 30 - h, w, h + 700);
          g.fillStyle = base; g.fillRect(xx + w * 0.4, 30 - h, w * 0.45, h + 700);
          g.fillStyle = lit; g.fillRect(xx + w * 0.78, 30 - h, w * 0.12, h + 700);
          g.fillStyle = dark; g.beginPath(); g.ellipse(xx + w / 2, 30 - h, w / 2, w * 0.14, 0, PI, 0); g.fill();
          g.fillStyle = U.mixHex(SNOW.lit, P('fog', t), 0.2); g.beginPath(); g.ellipse(xx + w / 2, 30 - h, w / 2 + 1, w * 0.14, 0, PI, 0); g.fill();
          g.strokeStyle = U.rgba(INK, 0.35); g.lineWidth = 1; for (let y = 30 - h + 16; y < 30; y += 18) { g.beginPath(); g.moveTo(xx, y); g.lineTo(xx + w, y); g.stroke(); }
          g.beginPath(); g.rect(xx, 30 - h, w, h + 700); inkS(g, 1.4, 0.8);
          // ladder + lamp
          g.strokeStyle = U.rgba(INK, 0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(xx + w * 0.2, 30 - h); g.lineTo(xx + w * 0.2, 30); g.moveTo(xx + w * 0.28, 30 - h); g.lineTo(xx + w * 0.28, 30); g.stroke();
          if (r() < 0.6) { glowAt(g, xx + w * 0.6, 30 - h * 0.6, 24, LAMP, 0.5); g.fillStyle = '#ffd38a'; g.fillRect(xx + w * 0.6 - 3, 30 - h * 0.6 - 3, 6, 6); }
          if (r() < 0.5) { g.globalAlpha = 0.8; hcrystal(g, r, xx + r() * w, 30, 18 + r() * 18, true, 1); g.globalAlpha = 1; }
        } });
        x += w * (0.9 + rng() * 0.6);
      } else if (kind < 0.6) {
        const h = 200 + rng() * 120, w = 160 + rng() * 120;
        objs.push({ x: xx - 30, y: -h - 50, w: w + 90, h: h + 120, draw(g) {
          const dark = U.mixHex('#2c3052', P('fog', t), 0.3), lit = U.mixHex('#a8b4dc', P('fog', t), 0.25);
          lattice(g, xx + 14, 34, 22, h, 14, dark, lit);
          lattice(g, xx + w - 14, 34, 22, h, 14, dark, lit);
          // crane beam with trolley + hook, hazard stripes
          g.fillStyle = dark; g.fillRect(xx - 10, 34 - h - 16, w + 50, 16); g.beginPath(); g.rect(xx - 10, 34 - h - 16, w + 50, 16); inkS(g, 1.2, 0.8);
          g.fillStyle = '#d9a93a'; for (let i = 0; i < w + 50; i += 16) g.fillRect(xx - 10 + i, 34 - h - 16, 7, 4);
          g.fillStyle = U.mixHex(SNOW.lit, P('fog', t), 0.2); g.fillRect(xx - 10, 34 - h - 19, w + 50, 3);
          const tx = xx + w * 0.55; g.fillStyle = dark; g.fillRect(tx - 10, 34 - h, 20, 10);
          g.strokeStyle = U.rgba('#1c1c34', 0.9); g.lineWidth = 1; g.beginPath(); g.moveTo(tx, 34 - h + 10); g.lineTo(tx, 34 - h * 0.45); g.stroke();
          g.beginPath(); g.arc(tx, 34 - h * 0.45 + 5, 5, -0.3, PI); g.stroke();
        } });
        x += w * (1 + rng() * 0.5);
      } else if (kind < 0.8) {
        const h = 160 + rng() * 140, w = 20 + rng() * 12;
        objs.push({ x: xx - 60, y: -h - 140, w: w + 120, h: h + 900, draw(g) {
          const dark = U.mixHex(STEEL.dark, P('fog', t), 0.35), lit = U.mixHex(STEEL.lit, P('fog', t), 0.3);
          g.fillStyle = dark; poly(g, [[xx, 34], [xx + 3, 34 - h], [xx + w - 3, 34 - h], [xx + w, 34], [xx + w, 760], [xx, 760]]); g.fill(); inkS(g, 1.2, 0.8);
          g.fillStyle = lit; g.fillRect(xx + w * 0.7, 34 - h, w * 0.18, h);
          g.fillStyle = '#c0453f'; g.fillRect(xx + 3, 34 - h + 10, w - 6, 6); g.fillRect(xx + 3, 34 - h + 26, w - 6, 6);
          // frozen steam plume (baked; the live one is in the gameplay plane)
          for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(230,236,255,${0.32 - k * 0.04})`; g.beginPath(); g.arc(xx + w / 2 + k * 9, 34 - h - 14 - k * 18, 10 + k * 5, 0, TAU); g.fill(); }
        } });
        x += 80 + rng() * 60;
      } else {
        const s = 30 + rng() * 40;
        objs.push({ x: xx - s * 2, y: 34 - s * 2.6, w: s * 4, h: s * 2.8, draw(g) { hcrystal(g, U.mulberry32(seed | 0), xx, 36, s, true, 1.2); } });
        x += 50 + rng() * 60;
      }
    }
    // valley haze over the bases
    objs.push({ x: X0 - 200, y: -160, w: X1 - X0 + 400, h: 200, draw(g) {
      const gr = g.createLinearGradient(0, -160, 0, 40); gr.addColorStop(0, 'rgba(220,228,255,0)'); gr.addColorStop(1, 'rgba(214,222,250,0.5)');
      g.fillStyle = gr; g.fillRect(this.x, this.y, this.w, this.h);
    } });
    return objs;
  }

  function genNear() {
    const f = 0.45, rng = U.mulberry32(9102), objs = [];
    const X0 = -700, X1 = WORLD_W * f + 900;
    const Cn = (t) => ({
      dark: U.mixHex(P('nearDark', t), '#000000', 0.05), base: P('near', t), lit: U.mixHex(P('near', t), P('rim', t), 0.32),
      snowS: U.mixHex(SNOW.sh, P('near', t), 0.35), snowL: U.mixHex(SNOW.mid, P('near', t), 0.12), trunk: '#1c1424', snow: U.mixHex(SNOW.mid, P('near', t), 0.2),
    });
    for (let x = X0; x < X1; x += 400) {
      const t = tAt((x + 200) / f), xx = x;
      objs.push({ x: xx - 2, y: 30, w: 404, h: 800, draw(g) {
        const gr = g.createLinearGradient(0, 30, 0, 200); gr.addColorStop(0, U.mixHex(SNOW.sh, P('near', t), 0.45)); gr.addColorStop(0.12, P('near', t)); gr.addColorStop(1, P('nearDark', t));
        g.fillStyle = gr; g.fillRect(xx - 2, 30, 404, 800);
      } });
    }
    // Belfry: dark timber houses with warm windows, fences, firewood (world x < 3000)
    let x = X0;
    const belEnd = 3000 * f;
    while (x < belEnd) {
      const w = 70 + rng() * 80, h = 70 + rng() * 80, seed = rng() * 1e6, xx = x, gap = rng() < 0.25;
      if (!gap) objs.push({ x: xx - 40, y: 40 - h - w - 80, w: w + 80, h: h + w + 900, draw(g) {
        const r = U.mulberry32(seed | 0);
        const HC = { stone: '#262238', wall: '#3c2c42', wallS: '#271d30', beam: '#120c18', roof: '#17121f', winD: '#120e1a' };
        house(g, r, xx, 40, w, h, HC, { ink: 2, lit: 0.45 });
      } });
      if (rng() < 0.5) { const px = xx + w + 10, seed2 = rng() * 1e6; objs.push({ x: px - 40, y: 40 - 160, w: 80, h: 170, draw(g) { pine(g, U.mulberry32(seed2 | 0), px, 42, 140, Cn(0), 1.6); } }); }
      x += w * (1.05 + rng() * 0.5);
    }
    // trail: rock shoulders and heavy pines, prayer poles
    x = belEnd;
    const trailEnd = 6700 * f;
    while (x < trailEnd) {
      const t = tAt(x / f), r0 = rng(), seed = rng() * 1e6, xx = x;
      if (r0 < 0.45) {
        const h = 120 + rng() * 120;
        objs.push({ x: xx - h * 0.5, y: 40 - h - 10, w: h, h: h + 20, draw(g) { pine(g, U.mulberry32(seed | 0), xx, 44, h, Cn(t), 1.7); } });
        x += 40 + rng() * 60;
      } else if (r0 < 0.8) {
        const w = 90 + rng() * 140, h = 50 + rng() * 90;
        objs.push({ x: xx - 10, y: 40 - h * 1.2, w: w + 20, h: h * 1.2 + 20, draw(g) { boulder(g, U.mulberry32(seed | 0), xx, 44, w, h, Cn(t), 1.8); } });
        x += w * (0.7 + rng() * 0.4);
      } else {
        const h = 160 + rng() * 60;
        objs.push({ x: xx - 10, y: 40 - h - 10, w: 220, h: h + 30, draw(g) {
          const r = U.mulberry32(seed | 0);
          g.fillStyle = '#1f1828'; g.fillRect(xx - 2, 44 - h, 4, h);
          flagLine(g, r, xx, 44 - h + 4, xx + 200, 44 - h * 0.45, 26, 8, 0.9);
          flagLine(g, r, xx, 44 - h + 16, xx - 160, 44 - h * 0.35, 22, 8, 0.9);
        } });
        x += 120 + rng() * 80;
      }
    }
    // station: girders, crane arms, pipes and containers (world x > 6900)
    x = 6900 * f;
    while (x < X1) {
      const t = tAt(x / f), r0 = rng(), seed = rng() * 1e6, xx = x;
      if (r0 < 0.4) {
        const w = 120 + rng() * 110, h = 50 + rng() * 34, stack = 1 + Math.floor(rng() * 2);
        objs.push({ x: xx - 6, y: 40 - h * stack - 10, w: w + 12, h: h * stack + 20, draw(g) {
          const r = U.mulberry32(seed | 0);
          for (let s = 0; s < stack; s++) {
            const cw = s ? w * (0.5 + r() * 0.3) : w, cx = xx + (s ? r() * (w - cw) : 0), cy = 44 - h * (s + 1);
            const col = ['#6a2e3a', '#2f4f63', '#5b5a2c', '#3e3a5e'][Math.floor(r() * 4)];
            g.fillStyle = U.mixHex(col, P('near', t), 0.45); g.fillRect(cx, cy, cw, h);
            g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.2; for (let i = cx + 6; i < cx + cw; i += 7) { g.beginPath(); g.moveTo(i, cy + 3); g.lineTo(i, cy + h - 3); g.stroke(); }
            g.fillStyle = Cn(t).snowL; g.fillRect(cx - 1, cy - 3, cw + 2, 4);
            g.beginPath(); g.rect(cx, cy, cw, h); inkS(g, 1.8, 0.9);
          }
        } });
        x += w * (0.9 + rng() * 0.6);
      } else if (r0 < 0.7) {
        const h = 200 + rng() * 140;
        objs.push({ x: xx - 30, y: 40 - h - 40, w: 260, h: h + 60, draw(g) {
          const dark = '#191a2c', lit = U.mixHex('#6c7aa8', P('near', t), 0.3);
          lattice(g, xx, 44, 30, h, 18, dark, lit);
          // jib + counter-jib
          g.fillStyle = dark; g.fillRect(xx - 60, 44 - h - 14, 260, 12); g.beginPath(); g.rect(xx - 60, 44 - h - 14, 260, 12); inkS(g, 1.4);
          g.fillStyle = '#d9a93a'; for (let i = 0; i < 260; i += 18) g.fillRect(xx - 60 + i, 44 - h - 14, 8, 3);
          g.fillStyle = Cn(t).snowL; g.fillRect(xx - 60, 44 - h - 17, 260, 3);
          g.strokeStyle = 'rgba(20,20,36,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(xx + 160, 44 - h - 2); g.lineTo(xx + 160, 44 - h * 0.35); g.stroke();
          g.fillStyle = dark; g.fillRect(xx + 152, 44 - h * 0.35, 16, 12);
        } });
        x += 160 + rng() * 120;
      } else if (r0 < 0.85) {
        const s = 34 + rng() * 40;
        objs.push({ x: xx - s * 2, y: 44 - s * 2.6, w: s * 4, h: s * 2.8, draw(g) { hcrystal(g, U.mulberry32(seed | 0), xx, 46, s, true, 1.6); } });
        x += 60 + rng() * 60;
      } else {
        const w = 200 + rng() * 140, py = -60 - rng() * 80;
        objs.push({ x: xx - 10, y: py - 30, w: w + 20, h: 130 - py, draw(g) {
          // insulated pipe run on trestles with frost
          g.fillStyle = '#1c1d30'; for (let i = 10; i < w; i += 70) g.fillRect(xx + i, py + 8, 8, 40 - py);
          const gr = g.createLinearGradient(0, py - 10, 0, py + 10); gr.addColorStop(0, '#8090b8'); gr.addColorStop(0.45, '#4a5276'); gr.addColorStop(1, '#262a44');
          g.fillStyle = gr; g.fillRect(xx, py - 9, w, 18); g.beginPath(); g.rect(xx, py - 9, w, 18); inkS(g, 1.6);
          g.fillStyle = Cn(t).snowL; g.fillRect(xx, py - 12, w, 4);
          g.fillStyle = '#e6f6ff'; for (let i = 6; i < w; i += 9) { const il = 3 + ((i * 13) % 11); g.beginPath(); g.moveTo(xx + i - 1.5, py + 9); g.lineTo(xx + i, py + 9 + il); g.lineTo(xx + i + 1.5, py + 9); g.fill(); }
        } });
        x += w + 40 + rng() * 80;
      }
    }
    return objs;
  }

  /* =========================================================================================
     GAMEPLAY PLANE: solids (chunked so each tile bake only draws what it needs)
     ========================================================================================= */
  const CHUNK = 520;
  function chunks(s, mk) {
    const out = [];
    for (let cx = s.x; cx < s.x + s.w; cx += CHUNK) {
      const cw = Math.min(CHUNK, s.x + s.w - cx);
      out.push(mk(cx, cw, cx === s.x, cx + cw >= s.x + s.w));
    }
    return out;
  }
  // snow over rock: a crisp snow crust (seen slightly from above: wind ripples + sparkles), a lumpy front lip with
  // blue undershadow, then layered slate with embedded boulders; step faces get icicles
  function paintSnow(s) {
    const sx = s.x, sy = s.y, sh = s.h;
    return chunks(s, (cx, cw, first, last) => ({ x: cx - 30, y: sy - 30, w: cw + 60, h: sh + 30, draw(g) {
      const rr = U.mulberry32((cx * 31 + sy * 7) | 0), t = tAt(cx + cw / 2);
      const rk = { lit: U.mixHex(ROCK.lit, P('ground', t), 0.1), base: U.mixHex(ROCK.base, P('groundDark', t), 0.25), dark: U.mixHex(ROCK.dark, P('groundDark', t), 0.3), deep: P('groundDark', t) };
      // rock body
      const gr = g.createLinearGradient(0, sy, 0, sy + 240); gr.addColorStop(0, rk.base); gr.addColorStop(0.35, rk.dark); gr.addColorStop(1, rk.deep);
      g.fillStyle = gr; g.fillRect(cx, sy, cw, sh);
      // strata
      g.strokeStyle = U.rgba(INK, 0.35); g.lineWidth = 1.4;
      for (let yy = sy + 52; yy < sy + 300; yy += 30 + rr() * 30) {
        g.beginPath(); g.moveTo(cx, yy);
        for (let xx = cx; xx <= cx + cw; xx += 40) g.lineTo(xx, yy + Math.sin(xx * 0.013 + yy) * 6);
        g.stroke();
      }
      // embedded stones (cel: lit top-right facet + ink)
      for (let k = 0; k < cw / 70; k++) {
        const bx = cx + rr() * cw, by = sy + 44 + rr() * 140, bw = 16 + rr() * 34, bh = 10 + rr() * 18;
        const pts = [[bx, by + bh * 0.4], [bx + bw * 0.2, by], [bx + bw * 0.75, by - bh * 0.1], [bx + bw, by + bh * 0.5], [bx + bw * 0.7, by + bh], [bx + bw * 0.15, by + bh * 0.9]];
        poly(g, pts); g.fillStyle = rk.dark; g.fill();
        poly(g, [[bx + bw * 0.2, by], [bx + bw * 0.75, by - bh * 0.1], [bx + bw, by + bh * 0.5], [bx + bw * 0.5, by + bh * 0.45]]); g.fillStyle = rk.lit; g.fill();
        poly(g, pts); inkS(g, 1.2, 0.8);
      }
      // snow crust: front lip with drips
      const lipY = (xx) => sy + 22 + Math.sin(xx * 0.045) * 3 + Math.sin(xx * 0.13) * 2;
      g.beginPath(); g.moveTo(cx, sy - 2);
      g.lineTo(cx + cw, sy - 2);
      for (let xx = cx + cw; xx >= cx; xx -= 8) {
        const d = (Math.sin(xx * 0.31) > 0.82) ? 6 + ((xx * 7) % 5) : 0;
        g.lineTo(xx, lipY(xx) + d);
      }
      g.closePath(); g.fillStyle = SNOW.sh; g.fill();
      g.beginPath(); g.moveTo(cx, sy - 2); g.lineTo(cx + cw, sy - 2);
      for (let xx = cx + cw; xx >= cx; xx -= 8) g.lineTo(xx, lipY(xx) - 7);
      g.closePath(); g.fillStyle = SNOW.lit; g.fill();
      // top surface band seen from above (slightly cooler), wind ripples, sparkles
      g.fillStyle = U.mixHex(SNOW.mid, P('groundTop', t), 0.3); g.fillRect(cx, sy, cw, 9);
      g.strokeStyle = 'rgba(140,156,214,0.55)'; g.lineWidth = 0.9;
      for (let k = 0; k < cw / 26; k++) { const rx = cx + rr() * cw, ry = sy + 2 + rr() * 6, rw = 10 + rr() * 22; g.beginPath(); g.moveTo(rx, ry); g.quadraticCurveTo(rx + rw / 2, ry - 2.5, rx + rw, ry); g.stroke(); }
      g.fillStyle = '#ffffff'; for (let k = 0; k < cw / 18; k++) g.fillRect(cx + rr() * cw, sy + 1 + rr() * 16, 1.4, 1.4);
      // drifts mounding above the line (soft, keep low)
      for (let k = 0; k < cw / 160; k++) { const dx = cx + rr() * cw, dw = 30 + rr() * 60; g.fillStyle = SNOW.lit; g.beginPath(); g.ellipse(dx, sy + 1, dw, 4 + rr() * 3, 0, PI, 0); g.fill(); g.strokeStyle = 'rgba(120,136,200,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(dx, sy + 1, dw, 4, 0, PI * 1.05, PI * 1.6); g.stroke(); }
      // dry grass / stones poking through
      for (let xx = cx; xx < cx + cw; xx += 30 + rr() * 90) {
        const r = rr();
        if (r < 0.4) { g.strokeStyle = '#8a6a4a'; g.lineWidth = 1.1; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(xx + k * 2, sy + 2); g.quadraticCurveTo(xx + k * 2 + 2, sy - 6, xx + k * 2 + (rr() - 0.3) * 8, sy - 8 - rr() * 8); g.stroke(); } }
        else if (r < 0.6) { const rw = 6 + rr() * 9; poly(g, [[xx, sy + 1], [xx + rw * 0.3, sy - rw * 0.5], [xx + rw, sy - rw * 0.3], [xx + rw * 1.2, sy + 1]]); g.fillStyle = rk.base; g.fill(); inkS(g, 1, 0.8); g.fillStyle = SNOW.lit; g.fillRect(xx + rw * 0.2, sy - rw * 0.5, rw * 0.7, 2); }
      }
      // crisp ink line along the walkable edge + a pale bounce under the lip
      g.fillStyle = INK; g.fillRect(cx, sy - 1.6, cw, 2);
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1;
      g.beginPath(); for (let xx = cx; xx <= cx + cw; xx += 8) (xx === cx ? g.moveTo : g.lineTo).call(g, xx, lipY(xx) + 3); g.stroke();
      // step faces: snow cornice + icicles + rock face lit on the sun side
      const face = (ex, dir) => {
        g.fillStyle = dir > 0 ? U.rgba(rk.lit, 0.9) : U.rgba(rk.deep, 0.9);
        g.fillRect(dir > 0 ? ex - 6 : ex, sy + 8, 6, sh);
        g.fillStyle = INK; g.fillRect(ex - 1, sy - 2, 2, sh);
        g.fillStyle = SNOW.lit; g.beginPath(); g.ellipse(ex, sy + 4, 12, 8, 0, 0, TAU); g.fill(); inkS(g, 1.2, 0.8);
        g.fillStyle = '#e8f8ff'; for (let k = 0; k < 4; k++) { const ix = ex + dir * (2 + k * 4), il = 8 + ((k * 7 + ex) % 14); g.beginPath(); g.moveTo(ix - 2, sy + 10); g.lineTo(ix, sy + 10 + il); g.lineTo(ix + 2, sy + 10); g.fill(); }
      };
      if (first) face(sx, -1);
      if (last) face(sx + s.w, 1);
    } }));
  }

  // anchor-station deck: riveted steel plates, embedded rail, hazard edges, frost and drifted snow, lattice underneath
  function paintSteel(s) {
    const sy = s.y, sh = s.h;
    return chunks(s, (cx, cw, first) => ({ x: cx - 30, y: sy - 24, w: cw + 60, h: sh + 24, draw(g) {
      const rr = U.mulberry32((cx * 17 + 5) | 0), t = tAt(cx + cw / 2);
      const st = { lit: U.mixHex(STEEL.lit, P('ground', t), 0.2), base: U.mixHex(STEEL.base, P('groundDark', t), 0.3), dark: U.mixHex(STEEL.dark, P('groundDark', t), 0.3), deep: P('groundDark', t) };
      // substructure: dark with girder lattice
      g.fillStyle = st.deep; g.fillRect(cx, sy, cw, sh);
      g.strokeStyle = U.rgba(st.dark, 0.9); g.lineWidth = 5;
      g.beginPath();
      for (let xx = Math.floor(cx / 90) * 90; xx < cx + cw + 90; xx += 90) { g.moveTo(xx, sy + 40); g.lineTo(xx + 90, sy + 130); g.moveTo(xx + 90, sy + 40); g.lineTo(xx, sy + 130); g.moveTo(xx, sy + 30); g.lineTo(xx, sy + 300); }
      g.stroke();
      g.fillStyle = st.dark; g.fillRect(cx, sy + 30, cw, 10); g.fillRect(cx, sy + 130, cw, 8);
      g.strokeStyle = U.rgba(INK, 0.6); g.lineWidth = 1; g.strokeRect(cx, sy + 30, cw, 10);
      // deck plate band
      g.fillStyle = st.base; g.fillRect(cx, sy, cw, 30);
      g.fillStyle = st.lit; g.fillRect(cx, sy, cw, 7);
      for (let xx = Math.floor(cx / 64) * 64; xx < cx + cw; xx += 64) {
        if (xx < cx) continue;
        g.fillStyle = U.rgba(INK, 0.55); g.fillRect(xx, sy + 7, 1.4, 23);
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(xx + 1.4, sy + 7, 1, 23);
        g.fillStyle = U.rgba(INK, 0.6); for (const ry of [11, 25]) { g.beginPath(); g.arc(xx + 6, sy + ry, 1.3, 0, TAU); g.arc(xx + 58, sy + ry, 1.3, 0, TAU); g.fill(); }
      }
      // hazard stripe under the lip
      g.save(); g.beginPath(); g.rect(cx, sy + 22, cw, 8); g.clip();
      g.fillStyle = '#1a1520'; g.fillRect(cx, sy + 22, cw, 8);
      g.fillStyle = '#d9a12e'; for (let xx = Math.floor(cx / 16) * 16 - 16; xx < cx + cw + 16; xx += 16) { g.beginPath(); g.moveTo(xx, sy + 30); g.lineTo(xx + 8, sy + 22); g.lineTo(xx + 14, sy + 22); g.lineTo(xx + 6, sy + 30); g.fill(); }
      g.restore();
      // embedded rail
      g.fillStyle = '#2a2e44'; g.fillRect(cx, sy + 2, cw, 3);
      g.fillStyle = 'rgba(220,230,255,0.5)'; g.fillRect(cx, sy + 2, cw, 1);
      // frost + drifts (snow blown against things)
      for (let k = 0; k < cw / 120; k++) {
        const dx = cx + rr() * cw, dw = 20 + rr() * 70;
        g.fillStyle = SNOW.lit; g.beginPath(); g.ellipse(dx, sy + 1, dw, 4 + rr() * 4, 0, PI, 0); g.fill();
        g.fillStyle = 'rgba(214,224,250,0.8)'; g.beginPath(); g.ellipse(dx + dw * 0.1, sy + 6, dw * 0.8, 3, 0, 0, PI); g.fill();
        g.strokeStyle = 'rgba(110,126,190,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(dx, sy + 1, dw, 4, 0, PI * 1.05, PI * 1.7); g.stroke();
      }
      g.fillStyle = 'rgba(220,236,255,0.35)'; for (let k = 0; k < cw / 30; k++) g.fillRect(cx + rr() * cw, sy + 8 + rr() * 14, 4 + rr() * 14, 1);
      g.fillStyle = INK; g.fillRect(cx, sy - 1.6, cw, 2);
      if (first) { g.fillStyle = INK; g.fillRect(cx - 1, sy, 2, sh); }
    } }));
  }

  function paintGantry(s) {
    return { x: s.x - 30, y: s.y - 70, w: s.w + 60, h: 700, draw(g) {
      const x = s.x, y = s.y, w = s.w;
      // under-truss down to the ground
      g.strokeStyle = '#1c1f33'; g.lineWidth = 7;
      g.beginPath(); for (let xx = x + 40; xx < x + w; xx += 250) { g.moveTo(xx, y + 20); g.lineTo(xx, 0); } g.stroke();
      g.lineWidth = 3; g.beginPath(); for (let xx = x + 40; xx < x + w - 250; xx += 250) { g.moveTo(xx, y + 26); g.lineTo(xx + 250, y + 140); g.moveTo(xx + 250, y + 26); g.lineTo(xx, y + 140); } g.stroke();
      g.strokeStyle = 'rgba(160,176,220,0.4)'; g.lineWidth = 1.5; g.beginPath(); for (let xx = x + 40; xx < x + w; xx += 250) { g.moveTo(xx + 3, y + 20); g.lineTo(xx + 3, 0); } g.stroke();
      // I-beam deck
      g.fillStyle = STEEL.dark; g.fillRect(x, y, w, s.h);
      g.fillStyle = STEEL.base; g.fillRect(x, y, w, 8);
      g.fillStyle = STEEL.lit; g.fillRect(x, y, w, 3);
      g.fillStyle = INK; for (let xx = x + 10; xx < x + w; xx += 22) { g.beginPath(); g.arc(xx, y + 16, 1.4, 0, TAU); g.fill(); }
      g.beginPath(); g.rect(x, y, w, s.h); inkS(g, 1.8);
      // railing
      g.strokeStyle = '#272b44'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(x, y - 34); g.lineTo(x + w, y - 34); g.moveTo(x, y - 18); g.lineTo(x + w, y - 18); for (let xx = x + 4; xx < x + w; xx += 44) { g.moveTo(xx, y); g.lineTo(xx, y - 34); } g.stroke();
      g.strokeStyle = 'rgba(220,232,255,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y - 35.5); g.lineTo(x + w, y - 35.5); g.stroke();
      // snow along the deck + icicles hanging from the underside
      g.fillStyle = SNOW.lit; for (let xx = x; xx < x + w; xx += 60) { g.beginPath(); g.ellipse(xx + 30, y, 34, 3.5, 0, PI, 0); g.fill(); }
      g.fillStyle = '#e8f8ff'; for (let xx = x + 3; xx < x + w; xx += 7) { const il = 3 + ((xx * 13) % 17); g.beginPath(); g.moveTo(xx - 1.5, y + s.h); g.lineTo(xx, y + s.h + il); g.lineTo(xx + 1.5, y + s.h); g.fill(); }
      // stencil
      g.fillStyle = 'rgba(232,180,60,0.85)'; g.font = '700 13px Rajdhani, sans-serif'; g.textAlign = 'left'; g.fillText('CARGO GANTRY  B-2   MAX 40T', x + 60, y + 21);
    } };
  }

  function paintContainer(s) {
    return { x: s.x - 10, y: s.y - 12, w: s.w + 20, h: s.h + 14, draw(g) {
      const x = s.x, y = s.y, w = s.w, h = s.h;
      g.fillStyle = '#7a3540'; g.fillRect(x, y, w, h);
      g.fillStyle = '#9c4a50'; g.fillRect(x + w * 0.6, y, w * 0.4, h);
      g.strokeStyle = 'rgba(20,10,20,0.45)'; g.lineWidth = 1.4; for (let xx = x + 6; xx < x + w; xx += 8) { g.beginPath(); g.moveTo(xx, y + 4); g.lineTo(xx, y + h - 4); g.stroke(); }
      g.fillStyle = 'rgba(255,240,220,0.8)'; g.font = '700 12px Rajdhani, sans-serif'; g.textAlign = 'center'; g.fillText('CANTATA  LOG.', x + w / 2, y + h * 0.55);
      g.fillStyle = SNOW.lit; g.beginPath(); g.moveTo(x - 2, y + 1); g.quadraticCurveTo(x + w * 0.3, y - 9, x + w * 0.6, y - 4); g.quadraticCurveTo(x + w * 0.85, y - 7, x + w + 2, y + 1); g.closePath(); g.fill();
      g.beginPath(); g.rect(x, y, w, h); inkS(g, 2);
      g.fillStyle = '#e8f8ff'; for (let xx = x + 4; xx < x + w; xx += 9) { g.beginPath(); g.moveTo(xx - 1.5, y + h * 0.1); g.lineTo(xx, y + h * 0.1 + 4 + (xx % 5)); g.lineTo(xx + 1.5, y + h * 0.1); g.fill(); }
    } };
  }

  function paintLog(s) {
    return { x: s.x - 20, y: s.y - 14, w: s.w + 40, h: s.h + 16, draw(g) {
      const x = s.x, y = s.y, w = s.w, h = s.h;
      g.fillStyle = WOOD.dark; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2 + 6, h / 2, 0, 0, TAU); g.fill();
      g.fillStyle = WOOD.base; g.beginPath(); g.ellipse(x + w / 2 + 4, y + h / 2 - 3, w / 2, h / 2 - 6, 0, 0, TAU); g.fill();
      g.fillStyle = '#d8b083'; g.beginPath(); g.ellipse(x + w + 2, y + h / 2, 7, h / 2 - 2, 0, 0, TAU); g.fill();
      g.strokeStyle = WOOD.dark; g.lineWidth = 1; g.beginPath(); g.ellipse(x + w + 2, y + h / 2, 3, h / 4, 0, 0, TAU); g.stroke();
      g.fillStyle = SNOW.lit; g.beginPath(); g.ellipse(x + w / 2, y + 3, w / 2, 6, 0, PI, 0); g.fill();
      g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2 + 6, h / 2, 0, 0, TAU); inkS(g, 2);
    } };
  }

  function onewayPainter(p) {
    const x = p.x, y = p.y, w = p.w;
    if (x > 7000) return { x: x - 10, y: y - 30, w: w + 20, h: 220, draw(g) {
      // steel grate platform on a bracket
      g.strokeStyle = '#1e2136'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 14, y + 10); g.lineTo(x + 14, y + 200); g.moveTo(x + w - 14, y + 10); g.lineTo(x + w - 14, y + 200); g.stroke();
      g.fillStyle = STEEL.dark; g.fillRect(x, y, w, 10);
      g.strokeStyle = STEEL.lit; g.lineWidth = 1; for (let xx = x + 4; xx < x + w; xx += 6) { g.beginPath(); g.moveTo(xx, y + 2); g.lineTo(xx + 3, y + 9); g.stroke(); }
      g.fillStyle = STEEL.hi; g.fillRect(x, y, w, 2);
      g.beginPath(); g.rect(x, y, w, 10); inkS(g, 1.6);
      g.fillStyle = SNOW.lit; g.beginPath(); g.ellipse(x + w * 0.4, y, w * 0.3, 3, 0, PI, 0); g.fill();
      g.fillStyle = '#e8f8ff'; for (let xx = x + 5; xx < x + w; xx += 8) { g.beginPath(); g.moveTo(xx - 1.4, y + 10); g.lineTo(xx, y + 14 + (xx % 7)); g.lineTo(xx + 1.4, y + 10); g.fill(); }
    } };
    return { x: x - 14, y: y - 20, w: w + 28, h: 120, draw(g) {
      // timber plank platform: snow on top, rope lashings, brackets and icicles
      g.strokeStyle = WOOD.deep; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x + 10, y + 12); g.lineTo(x + 30, y + 46); g.moveTo(x + w - 10, y + 12); g.lineTo(x + w - 30, y + 46); g.stroke();
      g.fillStyle = WOOD.base; g.fillRect(x - 6, y, w + 12, 12);
      g.fillStyle = WOOD.lit; g.fillRect(x - 6, y, w + 12, 4);
      g.strokeStyle = WOOD.deep; g.lineWidth = 1.2; for (let xx = x + 16; xx < x + w; xx += 22) { g.beginPath(); g.moveTo(xx, y + 1); g.lineTo(xx, y + 12); g.stroke(); }
      g.beginPath(); g.rect(x - 6, y, w + 12, 12); inkS(g, 1.6);
      g.strokeStyle = '#d9c9a0'; g.lineWidth = 1.4; for (const rx of [x + 4, x + w - 4]) { g.beginPath(); g.moveTo(rx - 3, y + 2); g.lineTo(rx + 3, y + 10); g.moveTo(rx + 3, y + 2); g.lineTo(rx - 3, y + 10); g.stroke(); }
      g.fillStyle = SNOW.lit; g.beginPath(); g.moveTo(x - 8, y + 1); for (let xx = x - 8; xx <= x + w + 8; xx += 10) g.lineTo(xx, y - 3 - Math.abs(Math.sin(xx * 0.09)) * 3); g.lineTo(x + w + 8, y + 2); g.closePath(); g.fill();
      g.fillStyle = '#e8f8ff'; for (let xx = x; xx < x + w; xx += 6 + (xx % 5)) { g.beginPath(); g.moveTo(xx - 1.5, y + 12); g.lineTo(xx, y + 16 + (xx % 9)); g.lineTo(xx + 1.5, y + 12); g.fill(); }
    } };
  }

  /* =========================================================================================
     WORLD PROPS (gameplay-plane decor, cached)
     ========================================================================================= */
  const BELL = { x: 1795, y: -606 };         // great bell: rope anchor (top centre)
  const FMX = 10540, WX = 10585;             // freight mast (sheave on top) and the winch under the gantry
  const LANTERNS = [];                       // live flicker points
  const VENTS = [8050, 8920, 9480, 11640, 12520];
  const CHIMNEYS = [];
  function genProps() {
    const objs = [], rng = U.mulberry32(3131);
    LANTERNS.length = 0; CHIMNEYS.length = 0;
    const lanternPost = (x, y, h = 120) => {
      LANTERNS.push({ x: x + 16, y: y - h + 22, r: 70 });
      objs.push({ x: x - 40, y: y - h - 50, w: 100, h: h + 60, draw(g) {
        glowAt(g, x + 16, y - h + 22, 60, LAMP, 0.35);
        g.strokeStyle = WOOD.deep; g.lineWidth = 6; g.lineCap = 'butt'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.lineTo(x + 22, y - h); g.stroke();
        g.strokeStyle = WOOD.base; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 1.5, y); g.lineTo(x + 1.5, y - h); g.stroke();
        g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 16, y - h); g.lineTo(x + 16, y - h + 10); g.stroke();
        poly(g, [[x + 10, y - h + 10], [x + 22, y - h + 10], [x + 24, y - h + 30], [x + 8, y - h + 30]]); g.fillStyle = '#ffd38a'; g.fill(); inkS(g, 1.3);
        g.fillStyle = '#fff4d6'; g.fillRect(x + 13, y - h + 14, 3, 12);
        g.fillStyle = SNOW.lit; g.fillRect(x - 3, y - h - 3, 28, 3);
        flagLine(g, rng, x, y - h + 4, x - 120, y - h + 20, 18, 7, 0.7);
      } });
    };
    // --- the Belfry gate ---
    objs.push({ x: 300, y: -330, w: 300, h: 340, draw(g) {
      const x0 = 360, x1 = 540;
      for (const px of [x0, x1]) {
        g.fillStyle = WOOD.dark; g.fillRect(px - 9, -250, 18, 250); g.fillStyle = WOOD.lit; g.fillRect(px + 3, -250, 5, 250);
        g.beginPath(); g.rect(px - 9, -250, 18, 250); inkS(g, 2);
        g.fillStyle = '#5a5672'; g.fillRect(px - 14, -26, 28, 26); g.beginPath(); g.rect(px - 14, -26, 28, 26); inkS(g, 1.6);
      }
      // two-tier roof beam
      poly(g, [[x0 - 46, -246], [x0 - 20, -276], [x1 + 20, -276], [x1 + 46, -246], [x1 + 30, -238], [x0 - 30, -238]]); g.fillStyle = '#3a2838'; g.fill(); inkS(g, 2);
      poly(g, [[x0 - 50, -248], [x0 - 22, -282], [x1 + 22, -282], [x1 + 50, -248], [x1 + 30, -250], [x1 + 10, -270], [x0 - 10, -270], [x0 - 30, -250]]); g.fillStyle = SNOW.lit; g.fill(); inkS(g, 1.4, 0.8);
      g.fillStyle = WOOD.base; g.fillRect(x0 - 20, -232, x1 - x0 + 40, 14); g.beginPath(); g.rect(x0 - 20, -232, x1 - x0 + 40, 14); inkS(g, 1.6);
      // name board
      g.fillStyle = '#2a1c26'; g.fillRect(410, -214, 80, 34); g.beginPath(); g.rect(410, -214, 80, 34); inkS(g, 1.6);
      g.fillStyle = '#ffd38a'; g.font = '900 20px "Noto Serif TC", serif'; g.textAlign = 'center'; g.fillText('鐘 樓', 450, -190);
      // little bells hanging
      for (const bx of [x0 + 18, x1 - 18]) { g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(bx, -218); g.lineTo(bx, -200); g.stroke(); g.fillStyle = BRONZE.lit; poly(g, [[bx - 5, -188], [bx - 3, -200], [bx + 3, -200], [bx + 5, -188]]); g.fill(); inkS(g, 1); }
      flagLine(g, rng, x0, -240, x0 - 150, -60, 40, 9, 1);
      flagLine(g, rng, x1, -240, x1 + 170, -90, 46, 9, 1);
      flagLine(g, rng, x0, -150, x1, -150, 34, 8, 0.9);
    } });
    // --- village houses behind the walkway ---
    const HC = { stone: '#6e6a8a', wall: '#c99a6c', wallS: '#8a5a48', beam: '#4a2a26', roof: '#3e2a40', winD: '#3a3050' };
    for (const [hx, hw, hh] of [[-260, 150, 120], [640, 120, 100], [1180, 130, 150], [2150, 170, 130], [2440, 120, 160], [2760, 150, 110]]) {
      const seed = rng() * 1e6;
      objs.push({ x: hx - 60, y: -hh - hw - 60, w: hw + 120, h: hh + hw + 70, draw(g) {
        const r = U.mulberry32(seed | 0); const res = house(g, r, hx, 0, hw, hh, HC, { ink: 2.2, lit: 0.8, deep: 2 });
        void res;
      } });
      CHIMNEYS.push(hx + hw * 0.45);
    }
    // --- Talia's workshop by the pylon: tarp lean-to, workbench with a radio, gears, crates ---
    objs.push({ x: 980, y: -190, w: 260, h: 196, draw(g) {
      // tarp lean-to
      g.strokeStyle = WOOD.deep; g.lineWidth = 5; g.beginPath(); g.moveTo(1000, 0); g.lineTo(1000, -150); g.moveTo(1220, 0); g.lineTo(1220, -110); g.stroke();
      poly(g, [[990, -156], [1232, -114], [1226, -100], [992, -140]]); g.fillStyle = '#3f7f73'; g.fill(); inkS(g, 1.8);
      poly(g, [[990, -156], [1232, -114], [1232, -120], [990, -164]]); g.fillStyle = SNOW.lit; g.fill();
      g.fillStyle = '#d99a3e'; g.fillRect(1080, -138, 26, 10); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(1080, -138, 26, 10);
      // workbench
      g.fillStyle = WOOD.base; g.fillRect(1110, -52, 100, 10); g.fillStyle = WOOD.dark; g.fillRect(1116, -42, 8, 42); g.fillRect(1196, -42, 8, 42);
      g.beginPath(); g.rect(1110, -52, 100, 10); inkS(g, 1.6);
      // radio set with dials + antenna
      g.fillStyle = '#4a5a52'; g.fillRect(1130, -84, 44, 32); g.beginPath(); g.rect(1130, -84, 44, 32); inkS(g, 1.6);
      g.fillStyle = '#9cf7b0'; g.fillRect(1136, -78, 18, 8); g.fillStyle = '#e8e2cc'; g.beginPath(); g.arc(1164, -72, 5, 0, TAU); g.arc(1164, -60, 4, 0, TAU); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.moveTo(1170, -84); g.lineTo(1190, -150); g.stroke();
      // big brass gear leaning on the post
      g.save(); g.translate(1060, -30); g.fillStyle = BRONZE.base; g.beginPath();
      for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU, r = i % 2 ? 26 : 31; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); inkS(g, 1.6);
      g.fillStyle = BRONZE.lit; g.beginPath(); g.arc(4, -4, 18, -1.6, 0.4); g.lineTo(0, 0); g.fill();
      g.fillStyle = '#2a1c26'; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill(); g.restore();
      // crates & a toolbox
      g.fillStyle = WOOD.base; g.fillRect(1200, -34, 34, 34); g.beginPath(); g.rect(1200, -34, 34, 34); inkS(g, 1.6);
      g.strokeStyle = WOOD.deep; g.lineWidth = 1.2; g.beginPath(); g.moveTo(1200, -34); g.lineTo(1234, 0); g.stroke();
      g.fillStyle = SNOW.lit; g.fillRect(1199, -37, 36, 4);
      g.fillStyle = '#b8473f'; g.fillRect(1120, -64, 18, 12); g.beginPath(); g.rect(1120, -64, 18, 12); inkS(g, 1);
    } });
    lanternPost(780, 0, 130); lanternPost(1450, 0, 120); lanternPost(2620, 0, 130); lanternPost(3140, 0, 110);
    // --- the Great Bell tower (signature landmark; the bell itself is drawn live) ---
    objs.push({ x: 1520, y: -980, w: 560, h: 990, draw(g) {
      const xl = 1600, xr = 1990, top = -770;
      // stone base
      poly(g, [[xl - 40, 0], [xl - 20, -60], [xr + 20, -60], [xr + 40, 0]]); g.fillStyle = '#5a5672'; g.fill(); inkS(g, 2.2);
      g.fillStyle = '#7a7898'; poly(g, [[1800, -60], [xr + 20, -60], [xr + 40, 0], [1800, 0]]); g.fill();
      g.strokeStyle = U.rgba(INK, 0.5); g.lineWidth = 1; for (let yy = -48; yy < 0; yy += 12) { g.beginPath(); g.moveTo(xl - 30, yy); g.lineTo(xr + 30, yy); g.stroke(); }
      g.fillStyle = SNOW.lit; poly(g, [[xl - 22, -60], [xr + 22, -60], [xr + 18, -54], [xl - 18, -54]]); g.fill();
      // four great posts (two near, two far, slightly darker)
      for (const [px, wd, col] of [[xl + 30, 20, WOOD.dark], [xr - 30, 20, WOOD.dark], [xl, 28, WOOD.base], [xr, 28, WOOD.base]]) {
        g.fillStyle = col; g.fillRect(px - wd / 2, top, wd, 712); g.fillStyle = WOOD.lit; g.fillRect(px + wd * 0.15, top, wd * 0.25, 712);
        g.beginPath(); g.rect(px - wd / 2, top, wd, 712); inkS(g, 2);
      }
      // cross bracing
      g.strokeStyle = WOOD.dark; g.lineWidth = 8;
      g.beginPath(); g.moveTo(xl, -120); g.lineTo(xr, -300); g.moveTo(xr, -120); g.lineTo(xl, -300); g.stroke();
      g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
      // bell beam
      g.fillStyle = WOOD.base; g.fillRect(xl - 30, -626, xr - xl + 60, 22); g.fillStyle = WOOD.lit; g.fillRect(xl - 30, -626, xr - xl + 60, 5);
      g.beginPath(); g.rect(xl - 30, -626, xr - xl + 60, 22); inkS(g, 2);
      g.fillStyle = BRONZE.base; for (const bx of [xl - 20, xr + 4]) { g.fillRect(bx, -628, 16, 26); g.beginPath(); g.rect(bx, -628, 16, 26); inkS(g, 1.2); }
      // pagoda roof (two tiers) with heavy snow and upturned eaves
      const roof = (y, hw, hh) => {
        poly(g, [[1795 - hw, y], [1795 - hw * 0.62, y - hh * 0.55], [1795, y - hh], [1795 + hw * 0.62, y - hh * 0.55], [1795 + hw, y], [1795 + hw - 14, y + 10], [1795 - hw + 14, y + 10]]);
        g.fillStyle = '#3a2838'; g.fill(); inkS(g, 2.2);
        g.fillStyle = '#2a1c2a'; g.fillRect(1795 - hw + 14, y + 4, hw * 2 - 28, 8);
        poly(g, [[1795 - hw - 6, y - 4], [1795 - hw * 0.62, y - hh * 0.55 - 8], [1795, y - hh - 10], [1795 + hw * 0.62, y - hh * 0.55 - 8], [1795 + hw + 6, y - 4], [1795 + hw - 8, y - 2], [1795 + hw * 0.55, y - hh * 0.42], [1795, y - hh * 0.8], [1795 - hw * 0.55, y - hh * 0.42], [1795 - hw + 8, y - 2]]);
        g.fillStyle = SNOW.mid; g.fill();
        poly(g, [[1795, y - hh - 10], [1795 + hw * 0.62, y - hh * 0.55 - 8], [1795 + hw + 6, y - 4], [1795 + hw - 8, y - 2], [1795 + hw * 0.55, y - hh * 0.42], [1795, y - hh * 0.8]]); g.fillStyle = SNOW.lit; g.fill();
        inkS(g, 1.4, 0.85);
        g.fillStyle = '#e8f8ff'; for (let xx = 1795 - hw + 16; xx < 1795 + hw - 16; xx += 7) { const il = 4 + ((xx * 11) % 18); g.beginPath(); g.moveTo(xx - 2, y + 12); g.lineTo(xx, y + 12 + il); g.lineTo(xx + 2, y + 12); g.fill(); }
      };
      roof(top + 4, 260, 90); roof(top - 110, 170, 100);
      g.fillStyle = BRONZE.lit; g.fillRect(1792, top - 250, 6, 40); g.beginPath(); g.arc(1795, top - 252, 7, 0, TAU); g.fill(); inkS(g, 1.2);
      // long flag lines from the roof down to the houses
      flagLine(g, rng, 1795 - 250, top + 6, 1250, -170, 70, 10, 1);
      flagLine(g, rng, 1795 + 250, top + 6, 2300, -150, 80, 10, 1);
      flagLine(g, rng, 1795 - 250, top + 6, 1795 + 250, top + 6, 60, 9, 1);
    } });
    // --- fire barrel + benches in the village square (live flames drawn in drawBack) ---
    objs.push({ x: 2280, y: -60, w: 140, h: 64, draw(g) {
      g.fillStyle = '#3a3448'; g.fillRect(2330, -46, 34, 46); g.fillStyle = '#5a5470'; g.fillRect(2350, -46, 10, 46);
      g.strokeStyle = INK; g.lineWidth = 1; for (const yy of [-38, -14]) { g.beginPath(); g.moveTo(2330, yy); g.lineTo(2364, yy); g.stroke(); }
      g.beginPath(); g.rect(2330, -46, 34, 46); inkS(g, 1.8);
      g.fillStyle = WOOD.base; g.fillRect(2280, -18, 40, 6); g.fillRect(2378, -18, 40, 6); g.fillStyle = WOOD.dark; g.fillRect(2284, -12, 4, 12); g.fillRect(2312, -12, 4, 12); g.fillRect(2382, -12, 4, 12); g.fillRect(2410, -12, 4, 12);
      g.fillStyle = SNOW.lit; g.fillRect(2280, -20, 40, 3); g.fillRect(2378, -20, 40, 3);
    } });
    // --- trail: prayer poles across the path, the roadside shrine, cairns ---
    for (const px of [3330, 4480, 5050]) {
      objs.push({ x: px - 220, y: -330, w: 440, h: 340, draw(g) {
        const by = px > 5000 ? -230 : px > 4000 ? -100 : 0;
        g.fillStyle = WOOD.dark; g.fillRect(px - 4, by - 300, 8, 300); g.beginPath(); g.rect(px - 4, by - 300, 8, 300); inkS(g, 1.6);
        g.fillStyle = BRONZE.lit; g.beginPath(); g.arc(px, by - 304, 6, 0, TAU); g.fill(); inkS(g, 1.2);
        for (let k = 0; k < 4; k++) flagLine(g, rng, px, by - 296 + k * 8, px + (k % 2 ? 1 : -1) * (180 + k * 10), by - 120 + k * 30, 30, 9, 1);
      } });
    }
    objs.push({ x: 3780, y: -150, w: 220, h: 156, draw(g) {
      // stone shrine with a tiny bell and candles (flames live)
      const x = 3850;
      poly(g, [[x - 40, 0], [x - 34, -70], [x + 34, -70], [x + 40, 0]]); g.fillStyle = '#5c5a7a'; g.fill(); inkS(g, 2);
      g.fillStyle = '#7d7b9c'; poly(g, [[x, -70], [x + 34, -70], [x + 40, 0], [x, 0]]); g.fill();
      g.fillStyle = '#1a1424'; g.fillRect(x - 16, -60, 32, 36); g.beginPath(); g.rect(x - 16, -60, 32, 36); inkS(g, 1.4);
      g.fillStyle = BRONZE.lit; poly(g, [[x - 8, -30], [x - 6, -48], [x + 6, -48], [x + 8, -30]]); g.fill(); inkS(g, 1);
      poly(g, [[x - 54, -68], [x, -112], [x + 54, -68]]); g.fillStyle = '#3a2838'; g.fill(); inkS(g, 2);
      poly(g, [[x - 58, -66], [x, -118], [x + 58, -66], [x + 40, -68], [x, -100], [x - 40, -68]]); g.fillStyle = SNOW.lit; g.fill(); inkS(g, 1.2, 0.8);
      g.fillStyle = '#efe6d0'; for (const cx of [x - 30, x + 26, x + 34]) g.fillRect(cx, -8, 4, 8);
      flagLine(g, rng, x + 54, -70, x + 160, -10, 20, 7, 0.8);
    } });
    // --- the old cableway station on the summit: concrete canopy + snapped cables (Tetherling nest) ---
    objs.push({ x: 5200, y: -840, w: 820, h: 620, draw(g) {
      const by = -230, top = -620;
      for (const px of [5260, 5600, 5940]) {
        g.fillStyle = '#4a4866'; g.fillRect(px - 14, top, 28, by - top); g.fillStyle = '#7a78a0'; g.fillRect(px + 4, top, 8, by - top);
        g.beginPath(); g.rect(px - 14, top, 28, by - top); inkS(g, 2);
      }
      g.fillStyle = '#56547a'; g.fillRect(5220, top - 40, 760, 40); g.fillStyle = '#8a88b0'; g.fillRect(5220, top - 40, 760, 8);
      g.beginPath(); g.rect(5220, top - 40, 760, 40); inkS(g, 2.2);
      g.fillStyle = SNOW.lit; g.beginPath(); g.moveTo(5216, top - 40); for (let xx = 5216; xx <= 5984; xx += 16) g.lineTo(xx, top - 46 - Math.abs(Math.sin(xx * 0.05)) * 6); g.lineTo(5984, top - 40); g.closePath(); g.fill(); inkS(g, 1.2, 0.8);
      g.fillStyle = '#e8f8ff'; for (let xx = 5224; xx < 5980; xx += 8) { const il = 4 + ((xx * 7) % 22); g.beginPath(); g.moveTo(xx - 2, top); g.lineTo(xx, top + il); g.lineTo(xx + 2, top); g.fill(); }
      g.fillStyle = 'rgba(240,200,120,0.9)'; g.font = '700 16px Rajdhani, sans-serif'; g.textAlign = 'center'; g.fillText('BELFRY  CABLEWAY  —  UPPER TERMINAL', 5600, top - 14);
      // the bullwheel
      g.save(); g.translate(5780, top + 30); g.strokeStyle = '#24223a'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 54, 0, TAU); g.stroke();
      g.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 52, Math.sin(a) * 52); g.stroke(); }
      g.strokeStyle = 'rgba(200,210,240,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 56, -1.2, 0.3); g.stroke(); g.restore();
      // snapped cables dangling (strands for the spiders)
      g.strokeStyle = '#1f1d30'; g.lineWidth = 2.2;
      for (const [cx, len, sway] of [[5350, 220, 12], [5470, 160, -8], [5690, 260, 16], [5860, 190, -10]]) {
        g.beginPath(); g.moveTo(cx, top); g.quadraticCurveTo(cx + sway, top + len * 0.6, cx + sway * 0.4, top + len); g.stroke();
        g.fillStyle = '#1f1d30'; g.beginPath(); g.arc(cx + sway * 0.4, top + len, 3, 0, TAU); g.fill();
      }
      // wrecked gondola car on the platform
      const gx = 5420; g.save(); g.translate(gx, by); g.rotate(-0.12);
      poly(g, [[-40, 0], [-44, -58], [44, -62], [48, 0]]); g.fillStyle = '#b8473f'; g.fill(); inkS(g, 2);
      g.fillStyle = '#d96a5a'; poly(g, [[10, -60], [44, -62], [48, 0], [14, 0]]); g.fill();
      g.fillStyle = '#2a2236'; g.fillRect(-34, -50, 26, 22); g.fillRect(-2, -52, 26, 22); g.fillStyle = 'rgba(160,220,255,0.35)'; g.fillRect(-32, -48, 10, 8);
      g.fillStyle = SNOW.lit; poly(g, [[-46, -58], [46, -64], [40, -70], [-40, -66]]); g.fill(); inkS(g, 1.2, 0.8);
      g.restore();
    } });
    // --- Ladderwatch: railing at the cliff edge, a coin telescope, the bench where Talia listens to the band ---
    objs.push({ x: 5800, y: -400, w: 820, h: 180, draw(g) {
      const by = -230;
      g.strokeStyle = WOOD.dark; g.lineWidth = 4; g.beginPath(); g.moveTo(6200, by - 40); g.lineTo(6590, by - 40); for (let xx = 6200; xx <= 6590; xx += 39) { g.moveTo(xx, by); g.lineTo(xx, by - 44); } g.stroke();
      g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.moveTo(6200, by - 42); g.lineTo(6590, by - 42); g.stroke();
      g.fillStyle = SNOW.lit; g.fillRect(6198, by - 44, 394, 3);
      // telescope
      const tx = 6440; g.strokeStyle = '#2a2a40'; g.lineWidth = 5; g.beginPath(); g.moveTo(tx, by); g.lineTo(tx, by - 64); g.stroke();
      g.save(); g.translate(tx, by - 70); g.rotate(-0.35); g.fillStyle = '#3f7f73'; g.fillRect(-16, -9, 42, 18); g.fillStyle = '#5aa294'; g.fillRect(-16, -9, 42, 6); g.beginPath(); g.rect(-16, -9, 42, 18); inkS(g, 1.6);
      g.fillStyle = '#9cf7b0'; g.beginPath(); g.ellipse(27, 0, 3, 8, 0, 0, TAU); g.fill(); inkS(g, 1); g.restore();
      // bench + Talia's relay antenna
      g.fillStyle = WOOD.base; g.fillRect(5830, by - 26, 80, 6); g.fillStyle = WOOD.dark; g.fillRect(5836, by - 20, 5, 20); g.fillRect(5898, by - 20, 5, 20); g.fillRect(5830, by - 50, 80, 5);
      g.fillStyle = SNOW.lit; g.fillRect(5830, by - 28, 80, 3);
      g.strokeStyle = '#2a2a40'; g.lineWidth = 3; g.beginPath(); g.moveTo(5930, by); g.lineTo(5930, by - 150); g.stroke();
      g.lineWidth = 1.4; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(5930 - 18 + k * 3, by - 150 + k * 16); g.lineTo(5930 + 18 - k * 3, by - 150 + k * 16); g.stroke(); }
      g.fillStyle = '#ff5f6a'; g.beginPath(); g.arc(5930, by - 154, 3, 0, TAU); g.fill();
    } });
    // --- the station gate: fence, arch sign, floodlights ---
    objs.push({ x: 7380, y: -330, w: 380, h: 340, draw(g) {
      const x0 = 7460, x1 = 7700;
      for (const px of [x0, x1]) { g.fillStyle = STEEL.dark; g.fillRect(px - 10, -280, 20, 280); g.fillStyle = STEEL.lit; g.fillRect(px + 3, -280, 4, 280); g.beginPath(); g.rect(px - 10, -280, 20, 280); inkS(g, 2); }
      g.fillStyle = '#262a42'; g.fillRect(x0 - 30, -300, x1 - x0 + 60, 40); g.beginPath(); g.rect(x0 - 30, -300, x1 - x0 + 60, 40); inkS(g, 2);
      g.fillStyle = SNOW.lit; g.fillRect(x0 - 32, -304, x1 - x0 + 64, 5);
      g.fillStyle = '#ffd38a'; g.font = '900 20px "Noto Serif TC", serif'; g.textAlign = 'center'; g.fillText('梯 基 錨 站', (x0 + x1) / 2, -274);
      g.fillStyle = 'rgba(255,211,138,0.8)'; g.font = '600 10px Rajdhani, sans-serif'; g.fillText('CANTATA LADDER — ANCHOR STATION 01', (x0 + x1) / 2, -264);
      // chain-link fence segment (bent open)
      g.strokeStyle = 'rgba(40,44,70,0.85)'; g.lineWidth = 1;
      for (let xx = x0 - 120; xx < x0; xx += 8) { g.beginPath(); g.moveTo(xx, -140); g.lineTo(xx + 8, 0); g.moveTo(xx + 8, -140); g.lineTo(xx, 0); g.stroke(); }
      g.strokeStyle = STEEL.dark; g.lineWidth = 3; g.beginPath(); g.moveTo(x0 - 120, -140); g.lineTo(x0, -140); g.stroke();
      g.fillStyle = SNOW.lit; g.beginPath(); g.ellipse(x0 - 60, 0, 70, 22, 0, PI, 0); g.fill(); inkS(g, 1.2, 0.7);
      // warning sign
      g.save(); g.translate(x1 + 40, -120); g.rotate(0.08); g.fillStyle = '#d9a12e'; poly(g, [[0, -24], [24, 16], [-24, 16]]); g.fill(); inkS(g, 1.6);
      g.fillStyle = INK; g.font = '900 20px Rajdhani'; g.textAlign = 'center'; g.fillText('!', 0, 12); g.restore();
    } });
    // --- station yard props: floodlight masts, containers, frozen railcar (clapper), crystals ---
    for (const mx of [7900, 9100, 10250, 11300]) {
      LANTERNS.push({ x: mx + 22, y: -332, r: 110, cold: true });
      objs.push({ x: mx - 60, y: -420, w: 160, h: 430, draw(g) {
        glowAt(g, mx + 22, -330, 90, '#ffe6b0', 0.3);
        g.strokeStyle = '#202338'; g.lineWidth = 6; g.beginPath(); g.moveTo(mx, 0); g.lineTo(mx, -340); g.lineTo(mx + 30, -340); g.stroke();
        g.strokeStyle = 'rgba(170,184,230,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(mx + 2, 0); g.lineTo(mx + 2, -338); g.stroke();
        g.fillStyle = '#2f3450'; g.fillRect(mx + 10, -350, 26, 14); g.beginPath(); g.rect(mx + 10, -350, 26, 14); inkS(g, 1.4);
        g.fillStyle = '#fff3d4'; g.fillRect(mx + 12, -337, 22, 4);
        g.fillStyle = SNOW.lit; g.fillRect(mx + 8, -353, 30, 3);
      } });
    }
    objs.push({ x: 8200, y: -150, w: 260, h: 156, draw(g) {
      // stacked containers behind the walkway
      for (const [cx, cy, cw, col] of [[8220, -64, 130, '#2f4f63'], [8352, -64, 100, '#5b5a2c'], [8250, -128, 120, '#6a2e3a']]) {
        g.fillStyle = col; g.fillRect(cx, cy, cw, 64); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(cx + cw * 0.62, cy, cw * 0.38, 64);
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2; for (let xx = cx + 6; xx < cx + cw; xx += 8) { g.beginPath(); g.moveTo(xx, cy + 4); g.lineTo(xx, cy + 60); g.stroke(); }
        g.fillStyle = SNOW.lit; g.fillRect(cx - 1, cy - 3, cw + 2, 4);
        g.beginPath(); g.rect(cx, cy, cw, 64); inkS(g, 2);
      }
    } });
    objs.push({ x: 10180, y: -140, w: 330, h: 146, draw(g) {
      // the frozen railcar (the clapper glows inside the open door)
      const x = 10200, y = -18;
      g.fillStyle = '#1e2032'; g.fillRect(x + 10, y, 280, 18); for (const wx of [x + 50, x + 240]) { g.beginPath(); g.arc(wx, -8, 12, 0, TAU); g.fill(); }
      g.fillStyle = '#4a3a5e'; g.fillRect(x, -120, 300, 104); g.fillStyle = '#6a5a82'; g.fillRect(x + 190, -120, 110, 104);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.4; for (let xx = x + 8; xx < x + 300; xx += 10) { g.beginPath(); g.moveTo(xx, -116); g.lineTo(xx, -20); g.stroke(); }
      g.fillStyle = '#120e1c'; g.fillRect(x + 110, -110, 70, 92);
      g.fillStyle = 'rgba(255,214,140,0.22)'; g.fillRect(x + 110, -110, 70, 92);
      g.beginPath(); g.rect(x, -120, 300, 104); inkS(g, 2.2);
      g.fillStyle = SNOW.lit; g.beginPath(); g.moveTo(x - 4, -120); g.quadraticCurveTo(x + 150, -134, x + 304, -120); g.closePath(); g.fill(); inkS(g, 1.2, 0.8);
      g.fillStyle = '#e8f8ff'; for (let xx = x + 4; xx < x + 300; xx += 7) { g.beginPath(); g.moveTo(xx - 2, -118); g.lineTo(xx, -110 + (xx % 9)); g.lineTo(xx + 2, -118); g.fill(); }
      g.fillStyle = 'rgba(255,240,220,0.75)'; g.font = '700 12px Rajdhani'; g.textAlign = 'left'; g.fillText('BELFRY FREIGHT 07', x + 16, -96);
    } });
    for (const [cx, s] of [[7640, 36], [8700, 30], [9300, 44], [9760, 26], [10120, 34], [10800, 30], [11420, 50], [12700, 60]]) {
      const seed = rng() * 1e6;
      objs.push({ x: cx - s * 2, y: -s * 2.6, w: s * 4, h: s * 2.8, draw(g) { hcrystal(g, U.mulberry32(seed | 0), cx, 2, s, true, 1.8); } });
    }
    // --- the freight winch platform (quest) + Descent II's makeshift chapel ---
    // freight mast: a lattice tower with a sheave on top; the old cable runs from the winch drum over it and up the
    // mountain to the Belfry (the pod rides it when the quest ends)
    objs.push({ x: FMX - 60, y: -446, w: 160, h: 452, draw(g) {
      lattice(g, FMX, 0, 34, 396, 18, '#23263c', 'rgba(170,186,230,0.7)');
      g.strokeStyle = INK; g.lineWidth = 1.1; g.beginPath(); g.moveTo(FMX - 18, 0); g.lineTo(FMX - 10, -396); g.moveTo(FMX + 18, 0); g.lineTo(FMX + 10, -396); g.stroke();
      // foot plate + head frame
      g.fillStyle = '#2f3450'; g.fillRect(FMX - 26, -8, 52, 8); g.beginPath(); g.rect(FMX - 26, -8, 52, 8); inkS(g, 1.4);
      poly(g, [[FMX - 17, -392], [FMX + 17, -392], [FMX + 11, -420], [FMX - 11, -420]]); g.fillStyle = '#2f3450'; g.fill(); inkS(g, 1.6);
      g.fillStyle = '#d9a12e'; g.fillRect(FMX - 17, -397, 34, 4);
      // the sheave
      g.fillStyle = '#4a5276'; g.beginPath(); g.arc(FMX, -424, 16, 0, TAU); g.fill(); inkS(g, 1.8);
      g.strokeStyle = '#23263c'; g.lineWidth = 2.2;
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.3; g.beginPath(); g.moveTo(FMX + Math.cos(a) * 4, -424 + Math.sin(a) * 4); g.lineTo(FMX + Math.cos(a) * 13, -424 + Math.sin(a) * 13); g.stroke(); }
      g.fillStyle = '#23263c'; g.beginPath(); g.arc(FMX, -424, 4.5, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(214,226,255,0.6)'; g.lineWidth = 1.3; g.beginPath(); g.arc(FMX, -424, 12, -2.5, -1.0); g.stroke();
      g.fillStyle = SNOW.lit; g.beginPath(); g.ellipse(FMX - 2, -439, 11, 3, 0, PI, TAU); g.fill();
      // cable down to the winch drum
      g.strokeStyle = '#161826'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(FMX + 15, -420); g.lineTo(WX + 14, -48); g.stroke();
      // enamel sign
      g.fillStyle = '#c8602c'; g.fillRect(FMX - 34, -262, 68, 20); g.beginPath(); g.rect(FMX - 34, -262, 68, 20); inkS(g, 1.4);
      g.fillStyle = '#fff2dc'; g.font = '700 11px Rajdhani'; g.textAlign = 'center'; g.fillText('FREIGHT  ▲  BELFRY', FMX, -248);
      g.fillStyle = SNOW.lit; g.fillRect(FMX - 35, -265, 70, 3);
    } });
    objs.push({ x: 10180, y: -2016, w: 380, h: 1600, draw(g) {
      g.strokeStyle = '#161826'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(FMX - 15, -428); g.lineTo(10200, -2000); g.stroke();
      g.strokeStyle = 'rgba(214,226,255,0.32)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(FMX - 14, -430); g.lineTo(10201, -2002); g.stroke();
    } });
    // the winch itself (the live NPC draws its crank and drum spin on top while you carry the clapper)
    objs.push({ x: WX - 50, y: -90, w: 100, h: 96, draw(g) {
      poly(g, [[WX - 40, 0], [WX + 40, 0], [WX + 34, -10], [WX - 34, -10]]); g.fillStyle = '#2f3450'; g.fill(); inkS(g, 1.6);
      g.fillStyle = '#d9a12e'; for (let xx = WX - 30; xx < WX + 30; xx += 12) g.fillRect(xx, -7, 6, 3);
      // side plate (A-frame) carrying the drum axle
      poly(g, [[WX - 30, -10], [WX + 30, -10], [WX + 14, -66], [WX - 14, -66]]); g.fillStyle = '#3e4766'; g.fill(); inkS(g, 1.8);
      poly(g, [[WX + 4, -10], [WX + 30, -10], [WX + 14, -66], [WX + 2, -66]]); g.fillStyle = '#525d82'; g.fill();
      poly(g, [[WX - 30, -10], [WX + 30, -10], [WX + 14, -66], [WX - 14, -66]]); inkS(g, 1.8);
      for (const [bx, by] of [[-22, -16], [22, -16], [-10, -58], [10, -58]]) { g.fillStyle = '#9aa6c6'; g.beginPath(); g.arc(WX + bx, by, 2, 0, TAU); g.fill(); inkS(g, 0.8); }
      // cable drum flange (cable wound on it)
      g.fillStyle = '#23263c'; g.beginPath(); g.arc(WX, -44, 21, 0, TAU); g.fill(); inkS(g, 2);
      g.strokeStyle = '#5a6488'; g.lineWidth = 1.2; for (const r of [16, 12.5, 9]) { g.beginPath(); g.arc(WX, -44, r, 0, TAU); g.stroke(); }
      g.fillStyle = SNOW.lit; g.beginPath(); g.ellipse(WX - 4, -66, 15, 3.5, 0, PI, TAU); g.fill();
      g.fillStyle = SNOW.lit; g.fillRect(WX - 35, -12, 70, 3);
      // brake lever + enamel plate
      g.strokeStyle = INK; g.lineWidth = 4.2; g.beginPath(); g.moveTo(WX + 24, -12); g.lineTo(WX + 38, -52); g.stroke();
      g.strokeStyle = '#b8473f'; g.lineWidth = 2.4; g.stroke();
      g.fillStyle = '#b8473f'; g.beginPath(); g.arc(WX + 38, -53, 4, 0, TAU); g.fill(); inkS(g, 1);
    } });
    // Descent II's makeshift chapel: a frozen container with its doors forced open, candles, the squad's bell sign
    objs.push({ x: 10620, y: -150, w: 200, h: 156, draw(g) {
      const x = 10640;
      g.fillStyle = '#3e3a5e'; g.fillRect(x, -110, 140, 110); g.fillStyle = '#56527a'; g.fillRect(x + 90, -110, 50, 110);
      g.strokeStyle = 'rgba(11,6,18,0.35)'; g.lineWidth = 1.3; for (let xx = x + 76; xx < x + 140; xx += 8) { g.beginPath(); g.moveTo(xx, -106); g.lineTo(xx, -4); g.stroke(); }
      g.fillStyle = 'rgba(150,90,70,0.35)'; for (const [rx, rl] of [[x + 96, 34], [x + 124, 22]]) g.fillRect(rx, -100, 3, rl);   // rust streaks
      g.beginPath(); g.rect(x, -110, 140, 110); inkS(g, 2.2);
      // the forced door, one leaf bent outward
      g.fillStyle = '#1a1424'; g.fillRect(x + 18, -92, 54, 92);
      glowAt(g, x + 45, -40, 64, LAMP, 0.45);
      poly(g, [[x + 72, -92], [x + 88, -98], [x + 88, -2], [x + 72, 0]]); g.fillStyle = '#4a4670'; g.fill(); inkS(g, 1.6);
      g.beginPath(); g.rect(x + 18, -92, 54, 92); inkS(g, 1.6);
      // a prayer cloth hung inside, and the candles on a crate
      g.fillStyle = '#d9c2ff'; poly(g, [[x + 30, -86], [x + 60, -86], [x + 58, -52], [x + 45, -46], [x + 32, -52]]); g.fill(); inkS(g, 1);
      g.strokeStyle = '#7a5aa8'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 45, -80); g.lineTo(x + 45, -56); g.moveTo(x + 38, -70); g.lineTo(x + 52, -70); g.stroke();
      g.fillStyle = '#5b3b28'; g.fillRect(x + 24, -16, 42, 16); g.beginPath(); g.rect(x + 24, -16, 42, 16); inkS(g, 1.2);
      g.fillStyle = '#efe6d0'; for (const cx of [x + 30, x + 42, x + 58]) { g.fillRect(cx - 1, -28, 4, 12); g.beginPath(); g.rect(cx - 1, -28, 4, 12); inkS(g, 0.7); }
      // bell emblem painted on the door frame (Descent II's sign)
      g.strokeStyle = '#ffd38a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + 104, -60); g.quadraticCurveTo(x + 104, -86, x + 115, -88); g.quadraticCurveTo(x + 126, -86, x + 126, -60); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(x + 115, -94); g.lineTo(x + 115, -88); g.moveTo(x + 112, -56); g.lineTo(x + 118, -56); g.stroke();
      // snow cap with icicles
      g.fillStyle = SNOW.lit; g.beginPath(); g.moveTo(x - 4, -110); g.quadraticCurveTo(x + 70, -122, x + 144, -110); g.closePath(); g.fill(); inkS(g, 1.1, 0.7);
      g.fillStyle = '#e8f8ff'; for (let xx = x + 3; xx < x + 140; xx += 9) { g.beginPath(); g.moveTo(xx - 2, -109); g.lineTo(xx, -101 + (xx % 7)); g.lineTo(xx + 2, -109); g.fill(); }
      g.fillStyle = 'rgba(255,240,220,0.75)'; g.font = '700 11px Rajdhani'; g.textAlign = 'center'; g.fillText('DESCENT  II', x + 115, -36);
    } });
    // --- the Counterweight: anchor collar, tether column, cradle frame, floor plate (boss arena backdrop) ---
    objs.push({ x: 11300, y: -1700, w: 1600, h: 1710, draw(g) {
      const cx = 12100;
      // tether column rising out of frame
      const gr = g.createLinearGradient(cx - 46, 0, cx + 46, 0);
      gr.addColorStop(0, '#2a2e48'); gr.addColorStop(0.5, '#4a5276'); gr.addColorStop(0.51, '#7a86b0'); gr.addColorStop(0.85, '#b0bce0'); gr.addColorStop(0.86, '#e2e8ff'); gr.addColorStop(1, '#ffffff');
      g.fillStyle = gr; g.fillRect(cx - 46, -1700, 92, 1300); g.beginPath(); g.rect(cx - 46, -1700, 92, 1300); inkS(g, 2.4);
      g.strokeStyle = 'rgba(11,6,18,0.5)'; g.lineWidth = 1.2; for (let y = -1690; y < -400; y += 26) { g.beginPath(); g.moveTo(cx - 46, y); g.lineTo(cx + 46, y); g.stroke(); }
      // cradle frame (two towers + crossbeam) that held the counterweight bell
      for (const px of [11520, 12680]) {
        lattice(g, px, 0, 70, 640, 40, '#23263c', 'rgba(170,186,230,0.7)');
        g.fillStyle = '#2c3050'; g.fillRect(px - 44, -660, 88, 26); g.beginPath(); g.rect(px - 44, -660, 88, 26); inkS(g, 2);
        g.fillStyle = SNOW.lit; g.fillRect(px - 46, -664, 92, 5);
      }
      g.fillStyle = '#2c3050'; g.fillRect(11480, -700, 1240, 36); g.fillStyle = '#454c74'; g.fillRect(11480, -700, 1240, 9);
      g.beginPath(); g.rect(11480, -700, 1240, 36); inkS(g, 2.4);
      g.fillStyle = '#d9a12e'; for (let xx = 11480; xx < 12720; xx += 24) g.fillRect(xx, -670, 12, 6);
      g.fillStyle = SNOW.lit; g.fillRect(11476, -704, 1248, 5);
      g.fillStyle = 'rgba(240,200,120,0.9)'; g.font = '700 16px Rajdhani'; g.textAlign = 'center'; g.fillText('COUNTERWEIGHT CRADLE  —  DO NOT STAND BENEATH', 12100, -676);
      // chains down to where the bell hung
      g.strokeStyle = '#1c1e30'; g.lineWidth = 5;
      for (const ch of [11900, 12300]) { g.beginPath(); g.moveTo(ch, -664); g.quadraticCurveTo(ch + 20, -480, ch - 10, -330); g.stroke(); }
      // anchor collar around the column base (huge ring)
      g.fillStyle = '#353a5c'; g.beginPath(); g.ellipse(cx, -420, 210, 46, 0, 0, TAU); g.fill(); inkS(g, 2.4);
      g.fillStyle = '#5a6290'; g.beginPath(); g.ellipse(cx, -428, 196, 36, 0, PI, TAU); g.fill();
      g.strokeStyle = 'rgba(210,222,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, -428, 196, 36, 0, PI * 1.55, PI * 1.98); g.stroke();
      g.fillStyle = SNOW.lit; g.beginPath(); g.ellipse(cx - 60, -458, 110, 10, 0, PI, TAU); g.fill();
      // collar struts to the floor
      g.strokeStyle = '#23263c'; g.lineWidth = 14;
      g.beginPath(); g.moveTo(cx - 190, -400); g.lineTo(cx - 420, 0); g.moveTo(cx + 190, -400); g.lineTo(cx + 420, 0); g.stroke();
      g.strokeStyle = 'rgba(160,176,220,0.45)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 196, -400); g.lineTo(cx + 426, 0); g.stroke();
      g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx - 197, -400); g.lineTo(cx - 427, 0); g.stroke();
      // anchor plate rings on the floor
      g.strokeStyle = 'rgba(120,200,255,0.25)'; g.lineWidth = 2;
      for (const r of [180, 380, 600]) { g.beginPath(); g.ellipse(cx, 2, r, 8, 0, PI, TAU); g.stroke(); }
    } });
    return objs;
  }

  /* =========================================================================================
     LIVE DRAWING (per frame — keep light)
     ========================================================================================= */
  // the great bell, swinging around its crown (ang), mouth open (no clapper until the quest is done)
  function drawBell(ctx, ang, ring, hasClapper) {
    const x = BELL.x, y = BELL.y;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    // yoke + crown
    ctx.fillStyle = WOOD.dark; ctx.fillRect(-46, -2, 92, 16); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-46, -2, 92, 16);
    ctx.fillStyle = BRONZE.dark; ctx.beginPath(); ctx.arc(0, 22, 14, PI, 0); ctx.fill(); ctx.stroke();
    // body
    const body = () => {
      ctx.beginPath(); ctx.moveTo(-34, 26);
      ctx.bezierCurveTo(-48, 30, -52, 70, -56, 120); ctx.bezierCurveTo(-60, 160, -78, 176, -90, 186);
      ctx.lineTo(90, 186); ctx.bezierCurveTo(78, 176, 60, 160, 56, 120); ctx.bezierCurveTo(52, 70, 48, 30, 34, 26); ctx.closePath();
    };
    body();
    const Rr = { hi: BRONZE.hi, lit: BRONZE.lit, base: BRONZE.base, dark: BRONZE.dark, bounce: '#5f8f9a' };
    ctx.fillStyle = G.Rig.celGrad(ctx, 0, 110, 1, 0, 80, 1, Rr); ctx.fill();
    ctx.save(); ctx.clip();
    // bands + inscription ridges
    ctx.strokeStyle = 'rgba(58,30,22,0.8)'; ctx.lineWidth = 3;
    for (const by of [52, 128, 164]) { ctx.beginPath(); ctx.moveTo(-100, by); ctx.lineTo(100, by); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,226,160,0.55)'; ctx.lineWidth = 1.2;
    for (const by of [54, 130, 166]) { ctx.beginPath(); ctx.moveTo(-100, by); ctx.lineTo(100, by); ctx.stroke(); }
    ctx.fillStyle = 'rgba(58,30,22,0.6)'; ctx.font = '700 15px "Noto Serif TC", serif'; ctx.textAlign = 'center';
    ctx.fillText('鳴 則 不 寂', 0, 100);
    // verdigris streaks
    ctx.fillStyle = 'rgba(90,170,150,0.45)'; for (const vx of [-38, -12, 22, 44]) ctx.fillRect(vx, 58, 4, 40 + (vx & 15));
    ctx.restore();
    body(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    // mouth
    ctx.fillStyle = '#1a0e10'; ctx.beginPath(); ctx.ellipse(0, 186, 90, 12, 0, 0, PI); ctx.fill(); ctx.stroke();
    // snow cap on the shoulders
    ctx.fillStyle = SNOW.lit; ctx.beginPath(); ctx.moveTo(-34, 26); ctx.quadraticCurveTo(0, 14, 34, 26); ctx.quadraticCurveTo(44, 36, 30, 38); ctx.quadraticCurveTo(0, 30, -30, 38); ctx.quadraticCurveTo(-44, 36, -34, 26); ctx.fill();
    if (hasClapper) {
      ctx.strokeStyle = '#2a1c18'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(Math.sin(-ang * 2) * 10, 168); ctx.stroke();
      ctx.fillStyle = BRONZE.dark; ctx.beginPath(); ctx.arc(Math.sin(-ang * 2) * 10, 176, 11, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
    if (ring > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const k = (ring * 1.2 + i * 0.33) % 1;
        ctx.strokeStyle = `rgba(255,226,160,${(1 - k) * 0.5 * Math.min(1, ring)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x, y + 110, 90 + k * 380, (90 + k * 380) * 0.55, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Talia — 17, oversized patched teal coat, brass goggles on her forehead, auburn braid, mittens, tool satchel
  const TAL = { coat: '#3f7f73', coatS: '#2a5652', lining: '#d99a3e', patch: '#c0583e', pants: '#34364f', boot: '#5a3a2a', mitten: '#d9573b', scarf: '#e2b04f', skin: '#f1c9a8', hair: '#b04a2e', hairS: '#6e2a22', gog: '#d9a441' };
  function drawTalia(ctx, x, y, t, look, walk, braid) {
    const R = G.Rig, br = Math.sin(t * 1.8) * 1.2, ph = walk ? walk : 0, step = walk ? Math.sin(ph) : 0;
    ctx.save(); ctx.translate(x, y);
    // shadow
    ctx.fillStyle = 'rgba(20,24,60,0.35)'; ctx.beginPath(); ctx.ellipse(0, 1, 22, 4, 0, 0, TAU); ctx.fill();
    ctx.scale(look, 1);
    // braid (behind)
    if (braid && braid.p.length) {
      const pts = braid.p.map((q) => ({ x: (q.x - x) * look, y: q.y - y }));
      R.ribbon(ctx, pts, 3.4, 1.4, TAL.hairS); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = TAL.hair; ctx.lineWidth = 1.4;
      for (let i = 1; i < pts.length - 1; i++) { const p = pts[i]; ctx.beginPath(); ctx.moveTo(p.x - 2, p.y - 1); ctx.lineTo(p.x + 2, p.y + 2); ctx.stroke(); }
      const e = pts[pts.length - 1]; ctx.fillStyle = TAL.scarf; ctx.fillRect(e.x - 2.5, e.y - 2, 5, 4); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(e.x - 2.5, e.y - 2, 5, 4);
    }
    // legs (short, chunky boots)
    const hip = { x: 0, y: -36 + br * 0.3 };
    const kneeB = { x: -3 - step * 6, y: -19 }, ankB = { x: -5 - step * 10, y: -5 + Math.max(0, step) * -4 };
    const kneeF = { x: 4 + step * 6, y: -19 }, ankF = { x: 6 + step * 10, y: -5 + Math.max(0, -step) * -4 };
    R.limb(ctx, hip, kneeB, 5.4, 4.6, U.mixHex(TAL.pants, '#000000', 0.2)); R.limb(ctx, kneeB, ankB, 4.6, 4, U.mixHex(TAL.pants, '#000000', 0.2));
    R.limb(ctx, hip, kneeF, 5.4, 4.6, TAL.pants); R.limb(ctx, kneeF, ankF, 4.6, 4, TAL.pants);
    for (const [a, dark] of [[ankB, true], [ankF, false]]) {
      ctx.fillStyle = dark ? '#3e2820' : TAL.boot; ctx.beginPath(); ctx.moveTo(a.x - 6, a.y - 5); ctx.lineTo(a.x + 5, a.y - 5); ctx.quadraticCurveTo(a.x + 12, a.y - 2, a.x + 11, a.y + 5); ctx.lineTo(a.x - 6, a.y + 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = '#e6dccb'; ctx.fillRect(a.x - 6, a.y - 6, 11, 2.5);
    }
    // coat: oversized trapezoid, knee length, with lining showing at the hem and patches
    const sh = -66 + br, hem = -16;
    ctx.beginPath(); ctx.moveTo(-11, sh); ctx.quadraticCurveTo(-20, -40, -21, hem); ctx.lineTo(19, hem + 2); ctx.quadraticCurveTo(18, -40, 11, sh); ctx.closePath();
    ctx.fillStyle = R.celGrad(ctx, 0, -40, 1, 0, 20, 1, R.ramp(TAL.coat)); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = TAL.lining; ctx.beginPath(); ctx.moveTo(-21, hem); ctx.lineTo(-14, hem - 4); ctx.lineTo(-6, hem + 1); ctx.closePath(); ctx.fill(); ctx.stroke();
    // front opening + toggles
    ctx.strokeStyle = TAL.coatS; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(5, sh + 4); ctx.lineTo(7, hem); ctx.stroke();
    ctx.fillStyle = '#e8d8b0'; for (const ty of [-54, -44, -34]) { ctx.fillRect(4, ty + br * 0.5, 6, 2.2); }
    // patches with stitches
    ctx.fillStyle = TAL.patch; ctx.fillRect(-15, -36, 9, 8); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(-15, -36, 9, 8);
    ctx.fillStyle = TAL.lining; ctx.fillRect(10, -28, 7, 7); ctx.strokeRect(10, -28, 7, 7);
    ctx.strokeStyle = '#f4ead0'; ctx.lineWidth = 0.7; ctx.setLineDash([1.5, 1.5]); ctx.strokeRect(-14, -35, 7, 6); ctx.setLineDash([]);
    // satchel strap + bag with a wrench
    ctx.strokeStyle = '#5a3a24'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-9, sh + 2); ctx.lineTo(12, -30); ctx.stroke();
    ctx.fillStyle = '#7a4a30'; ctx.fillRect(9, -34, 13, 14); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(9, -34, 13, 14);
    ctx.fillStyle = '#5a3424'; ctx.fillRect(9, -34, 13, 5);
    ctx.strokeStyle = '#b8c0d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(18, -34); ctx.lineTo(21, -44); ctx.stroke(); ctx.beginPath(); ctx.arc(21.5, -46, 2.4, 0, TAU); ctx.stroke();
    // back arm (mitten) + front arm
    const shB = { x: -8, y: sh + 4 }, shF = { x: 8, y: sh + 4 };
    const swing = walk ? Math.sin(ph + PI) * 0.4 : 0;
    const elB = { x: shB.x - 3 + swing * 8, y: sh + 18 }, hdB = { x: shB.x - 1 + swing * 12, y: sh + 30 };
    R.limb(ctx, shB, elB, 5, 4.6, TAL.coatS); R.limb(ctx, elB, hdB, 4.6, 4.2, TAL.coatS);
    ctx.fillStyle = U.mixHex(TAL.mitten, '#000000', 0.2); ctx.beginPath(); ctx.arc(hdB.x, hdB.y + 2, 4.6, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    const wave = !walk && (t % 7) < 1.2 ? Math.sin((t % 7) * 10) : 0;
    const elF = { x: shF.x + 4 - swing * 8 + (wave ? 6 : 0), y: sh + (wave ? 8 : 17) }, hdF = { x: shF.x + 6 - swing * 12 + (wave ? 10 + wave * 3 : 0), y: sh + (wave ? -6 : 29) };
    R.limb(ctx, shF, elF, 5.2, 4.8, TAL.coat); R.limb(ctx, elF, hdF, 4.8, 4.4, TAL.coat);
    ctx.fillStyle = TAL.lining; ctx.fillRect(hdF.x - 4, hdF.y - 4, 8, 3);
    ctx.fillStyle = TAL.mitten; ctx.beginPath(); ctx.arc(hdF.x, hdF.y + 2, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.arc(hdF.x + 3.5, hdF.y - 0.5, 2, 0, TAU); ctx.fill(); ctx.stroke();
    // scarf (chunky wrap + tail)
    ctx.fillStyle = TAL.scarf; ctx.beginPath(); ctx.ellipse(1, sh - 2, 11, 6, 0.05, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#c4902e'; ctx.beginPath(); ctx.moveTo(-6, sh); ctx.lineTo(-11, sh + 14 + Math.sin(t * 2.4) * 1.5); ctx.lineTo(-5, sh + 15); ctx.lineTo(-1, sh + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,70,20,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-7, sh - 4); ctx.lineTo(9, sh - 3); ctx.stroke();
    // head
    const hx = 1, hy = sh - 15;
    ctx.fillStyle = TAL.skin; ctx.beginPath(); ctx.moveTo(hx - 9, hy - 6); ctx.quadraticCurveTo(hx - 10, hy + 7, hx - 1, hy + 10); ctx.quadraticCurveTo(hx + 9, hy + 9, hx + 10, hy + 1); ctx.quadraticCurveTo(hx + 10, hy - 9, hx, hy - 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(200,120,110,0.35)'; ctx.beginPath(); ctx.moveTo(hx - 9, hy - 2); ctx.quadraticCurveTo(hx - 10, hy + 7, hx - 1, hy + 10); ctx.quadraticCurveTo(hx - 6, hy + 4, hx - 9, hy - 2); ctx.fill();
    // cheeks + freckles
    ctx.fillStyle = 'rgba(240,120,110,0.45)'; ctx.beginPath(); ctx.ellipse(hx + 6, hy + 4, 2.6, 1.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a0583e'; for (const [fx, fy] of [[4, 2], [6.5, 1.5], [8, 3]]) ctx.fillRect(hx + fx, hy + fy, 0.9, 0.9);
    // eyes (blink)
    const blink = (t % 4.3) < 0.12;
    ctx.fillStyle = INK;
    if (blink) { ctx.fillRect(hx + 2, hy - 1, 4, 1.2); ctx.fillRect(hx + 7.5, hy - 1, 2.5, 1.2); }
    else {
      ctx.beginPath(); ctx.ellipse(hx + 4, hy - 1, 1.6, 2.4, 0, 0, TAU); ctx.ellipse(hx + 8.6, hy - 1, 1.2, 2.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(hx + 4.2, hy - 2.6, 0.9, 0.9); ctx.fillRect(hx + 8.8, hy - 2.6, 0.8, 0.8);
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(hx + 5, hy + 6); ctx.quadraticCurveTo(hx + 7, hy + 7, hx + 8.5, hy + 5.5); ctx.stroke();
    // hair: auburn cap + fringe, tie at the back
    ctx.fillStyle = TAL.hair; ctx.beginPath(); ctx.moveTo(hx - 11, hy + 4); ctx.quadraticCurveTo(hx - 13, hy - 12, hx, hy - 13); ctx.quadraticCurveTo(hx + 11, hy - 13, hx + 11, hy - 3);
    ctx.lineTo(hx + 8, hy - 6); ctx.lineTo(hx + 6, hy - 3); ctx.lineTo(hx + 3, hy - 7); ctx.lineTo(hx, hy - 4); ctx.lineTo(hx - 3, hy - 7); ctx.quadraticCurveTo(hx - 6, hy - 2, hx - 7, hy + 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = TAL.hairS; ctx.beginPath(); ctx.moveTo(hx - 11, hy + 4); ctx.quadraticCurveTo(hx - 12, hy - 6, hx - 6, hy - 10); ctx.quadraticCurveTo(hx - 8, hy - 2, hx - 7, hy + 5); ctx.closePath(); ctx.fill();
    // goggles on the forehead
    ctx.strokeStyle = '#3a2a24'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(hx - 11, hy - 8); ctx.quadraticCurveTo(hx, hy - 15, hx + 10, hy - 10); ctx.stroke();
    for (const [gx, gr] of [[hx + 1.5, 4.2], [hx + 8.5, 3.6]]) {
      ctx.fillStyle = TAL.gog; ctx.beginPath(); ctx.arc(gx, hy - 11, gr, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = '#5ad6c4'; ctx.beginPath(); ctx.arc(gx, hy - 11, gr - 1.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8fffb'; ctx.fillRect(gx - 1.2, hy - 12.6, 1.4, 1.4);
    }
    ctx.restore();
  }
  // a villager in a padded coat (kind 0 = elder with shawl and broom, 1 = child, 2 = adult with lantern)
  function drawVillager(ctx, x, y, t, kind, look, seed) {
    const sc = kind === 1 ? 0.66 : kind === 0 ? 0.9 : 1, br = Math.sin(t * 1.6 + seed) * 1;
    const cols = [['#6a4a68', '#8a6a5a'], ['#c0583e', '#3f7f73'], ['#41506e', '#9a7a52']][kind];
    ctx.save(); ctx.translate(x, y); ctx.scale(look * sc, sc);
    ctx.fillStyle = 'rgba(20,24,60,0.3)'; ctx.beginPath(); ctx.ellipse(0, 1, 20, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2820'; ctx.fillRect(-8, -10, 7, 10); ctx.fillRect(2, -10, 7, 10); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(-8, -10, 7, 10); ctx.strokeRect(2, -10, 7, 10);
    const lean = kind === 0 ? 4 : 0;
    ctx.beginPath(); ctx.moveTo(-10 + lean, -62 + br); ctx.quadraticCurveTo(-18, -30, -15, -9); ctx.lineTo(15, -9); ctx.quadraticCurveTo(16, -36, 9 + lean, -62 + br); ctx.closePath();
    ctx.fillStyle = G.Rig.celGrad(ctx, 0, -36, 1, 0, 16, 1, G.Rig.ramp(cols[0])); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.stroke();
    ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.ellipse(lean, -60 + br, 11, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    const hx = lean + 1, hy = -72 + br;
    ctx.fillStyle = '#e8bfa0'; ctx.beginPath(); ctx.arc(hx, hy, 8.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(hx + 4, hy - 1, 1.6, 2.2);
    // hat / hood
    ctx.fillStyle = kind === 0 ? '#8a6a5a' : cols[1]; ctx.beginPath(); ctx.arc(hx, hy - 2, 9.5, PI * 0.95, PI * 2.05); ctx.fill(); ctx.stroke();
    if (kind === 0) { ctx.fillStyle = '#ece6dc'; ctx.fillRect(hx - 8, hy + 2, 5, 5); }
    if (kind === 1) { ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(hx - 1, hy - 12, 3.5, 0, TAU); ctx.fill(); ctx.stroke(); }
    // arm
    ctx.strokeStyle = cols[0]; ctx.lineWidth = 5; ctx.lineCap = 'round';
    if (kind === 0) {
      const sw = Math.sin(t * 2.2 + seed) * 6;
      ctx.beginPath(); ctx.moveTo(lean + 4, -54 + br); ctx.lineTo(12 + sw * 0.3, -34); ctx.stroke();
      ctx.strokeStyle = WOOD.base; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(10 + sw * 0.3, -48); ctx.lineTo(22 + sw, -2); ctx.stroke();
      ctx.strokeStyle = '#c9a86a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(20 + sw, -6); ctx.lineTo(28 + sw * 1.2, 0); ctx.stroke();
    } else if (kind === 2) {
      ctx.beginPath(); ctx.moveTo(lean + 4, -54 + br); ctx.lineTo(16, -36); ctx.stroke();
      ctx.fillStyle = '#ffd38a'; ctx.fillRect(13, -34, 8, 10); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(13, -34, 8, 10);
    } else {
      ctx.beginPath(); ctx.moveTo(lean + 4, -54 + br); ctx.lineTo(14, -44 + Math.sin(t * 6 + seed) * 4); ctx.stroke();
    }
    ctx.restore();
  }

  // the avalanche wall (front edge at h.x), billowing cel-shaded snow with tumbling debris
  function drawAvalanche(ctx, h, cam) {
    const fx = h.x, base = groundAt(fx), H = 380, t = h.t;
    ctx.save();
    // trailing body behind the front
    ctx.fillStyle = SNOW.sh; ctx.fillRect(fx - 1400, base - H * 0.75, 1400 - 60, H * 0.75 + 40);
    ctx.fillStyle = SNOW.mid; ctx.fillRect(fx - 1400, base - H * 0.6, 1400 - 120, H * 0.6 + 40);
    // billows (front)
    for (let i = 0; i < 11; i++) {
      const k = i / 10, r = 50 + 46 * Math.sin(i * 2.7) * 0.5 + 40 * (1 - k), ph = t * 6 + i * 1.7;
      const bx = fx - 30 - k * 160 + Math.sin(ph) * 10, by = base - k * H * 0.9 - 30 + Math.cos(ph * 0.8) * 8;
      ctx.fillStyle = SNOW.sh; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
      ctx.fillStyle = SNOW.lit; ctx.beginPath(); ctx.arc(bx + r * 0.18, by - r * 0.18, r * 0.78, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, r, -1.6, 1.4); ctx.stroke();
    }
    // debris: logs and rocks
    for (let i = 0; i < 5; i++) {
      const a = t * (3 + i) + i, dx = fx - 60 - i * 70 + Math.sin(a) * 30, dy = base - 80 - i * 50 + Math.cos(a * 1.3) * 40;
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(a);
      if (i % 2) { ctx.fillStyle = WOOD.base; ctx.fillRect(-24, -5, 48, 10); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(-24, -5, 48, 10); }
      else { ctx.fillStyle = ROCK.base; poly(ctx, [[-10, -8], [8, -10], [12, 6], [-6, 10]]); ctx.fill(); inkS(ctx, 1.6); }
      ctx.restore();
    }
    // spray ahead of the front
    ctx.fillStyle = 'rgba(240,246,255,0.75)';
    for (let i = 0; i < 26; i++) {
      const k = ((t * 1.7 + i * 0.137) % 1), sx = fx + k * 120 - 40, sy = base - 20 - ((i * 37) % 300) * (1 - k * 0.5);
      ctx.fillRect(sx, sy, 3 + (i % 3), 3 + (i % 3));
    }
    ctx.restore();
    void cam;
  }

  function groundAt(x) { const y = G.Phys.groundBelow(x, -900); return y > 1e8 ? 0 : y; }

  /* =========================================================================================
     ATMOSPHERE: blizzard snow (screen space), gust streaks; foreground boughs/icicles/chains
     ========================================================================================= */
  const SNOWF = (() => { const r = U.mulberry32(616); return Array.from({ length: 170 }, () => ({ x: r(), y: r(), z: 0.35 + r() * 1.6, p: r() * 10, s: 0.6 + r() * 1.2 })); })();
  function drawSnowAtmos(ctx, cam, W, H, S, time) {
    const t = L.tintAt(cam.x), low = G.Quality.low, n = low ? 70 : 170;
    const gust = Math.max(0, Math.sin(time * 0.23) * Math.sin(time * 0.71 + 1)) ;
    const wind = (90 + 160 * gust) * (t > 0.6 ? 0.6 : 1);
    const bins = [[], [], []];
    for (let i = 0; i < n; i++) { const f = SNOWF[i]; bins[f.z < 0.8 ? 0 : f.z < 1.3 ? 1 : 2].push(f); }
    const cols = ['rgba(232,240,255,0.45)', 'rgba(246,250,255,0.7)', 'rgba(255,255,255,0.85)'];
    for (let b = 0; b < 3; b++) {
      ctx.fillStyle = cols[b];
      for (const f of bins[b]) {
        const sp = S * f.z;
        const px = (((f.x * W * 1.4 + time * wind * sp * 0.6 - cam.x * sp * 0.55 + Math.sin(time * 1.3 + f.p) * 14 * sp) % (W * 1.4)) + W * 1.4) % (W * 1.4) - W * 0.2;
        const py = (((f.y * H + time * (36 + 34 * f.z) * sp - cam.y * sp * 0.4) % H) + H) % H;
        const r = f.s * sp * 1.3;
        if (b === 2 && !low) { ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); } else ctx.fillRect(px, py, r * 1.6, r * 1.2);
      }
    }
    // gust streaks
    if (gust > 0.3) {
      ctx.strokeStyle = `rgba(240,246,255,${(gust - 0.3) * 0.3})`; ctx.lineWidth = 1.2 * S;
      for (let i = 0; i < (low ? 4 : 9); i++) {
        const yy = ((i * 0.137 + 0.08) % 1) * H, xx = (((i * 0.41) * W + time * 900 * S) % (W * 1.5)) - W * 0.25, len = (80 + i * 23) * S;
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + len * 0.5, yy - 6 * S, xx + len, yy + 2 * S); ctx.stroke();
      }
    }
    // cold haze at the bottom of the frame
    const hz = ctx.createLinearGradient(0, H * 0.72, 0, H);
    hz.addColorStop(0, 'rgba(220,232,255,0)'); hz.addColorStop(1, `rgba(220,232,255,${0.1 + gust * 0.08})`);
    ctx.fillStyle = hz; ctx.fillRect(0, H * 0.72, W, H * 0.28);
    return true;
  }

  function drawFG(ctx, cam, S, game) {
    const f = 1.35, span = 1250;
    const base = Math.floor((cam.x * f - 1300) / span), time = game.realTime;
    for (let i = base; i < base + 4; i++) {
      const rng = U.mulberry32(i * 733 + 29);
      if (rng() < 0.4) continue;
      const lx = i * span + rng() * 500, x = cam.x + (lx - cam.x * f);
      const station = x > 7300, kind = rng();
      ctx.save();
      if (!station && kind < 0.55) {
        // snow-laden pine bough reaching in from the top
        const top = cam.y - 420, sway = Math.sin(time * 0.9 + i) * 6, dir = rng() < 0.5 ? 1 : -1;
        ctx.translate(x, top); ctx.scale(dir, 1);
        ctx.fillStyle = 'rgba(10,10,24,0.94)'; ctx.strokeStyle = 'rgba(10,10,24,0.94)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-260, -40); ctx.quadraticCurveTo(-60, 40 + sway, 200, 120 + sway); ctx.stroke();
        for (let k = 0; k < 9; k++) {
          const u = k / 8, bx = U.lerp(-220, 190, u), by = U.lerp(-20, 116, u * u) + sway * u;
          ctx.beginPath(); ctx.moveTo(bx - 40, by - 10); ctx.lineTo(bx + 30, by + 46 - k * 2); ctx.lineTo(bx + 46, by + 2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(200,214,250,0.6)'; ctx.beginPath(); ctx.ellipse(bx, by - 6, 30, 6, 0.3, PI, 0); ctx.fill(); ctx.fillStyle = 'rgba(10,10,24,0.94)';
        }
      } else if (!station) {
        // snowbank + rocks rising from the bottom edge
        const gy = cam.y + 300 + rng() * 30;
        ctx.fillStyle = 'rgba(12,12,28,0.94)';
        ctx.beginPath(); ctx.moveTo(x - 200, gy + 200); ctx.quadraticCurveTo(x - 160, gy - 10, x - 40, gy - 30); ctx.quadraticCurveTo(x + 60, gy - 50, x + 120, gy - 6); ctx.quadraticCurveTo(x + 180, gy + 20, x + 220, gy + 200); ctx.fill();
        ctx.strokeStyle = 'rgba(205,220,255,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 160, gy - 6); ctx.quadraticCurveTo(x - 40, gy - 44, x + 110, gy - 10); ctx.stroke();
      } else if (kind < 0.6) {
        // hanging chains + hook from above
        const top = cam.y - 420, sway = Math.sin(time * 0.7 + i) * 10;
        ctx.strokeStyle = 'rgba(10,10,22,0.92)'; ctx.lineWidth = 7;
        for (let k = 0; k < 2; k++) { const cx = x + k * 70; ctx.beginPath(); ctx.moveTo(cx, top); ctx.quadraticCurveTo(cx + sway * 0.5, top + 140, cx + sway, top + 220 + k * 60); ctx.stroke(); }
        ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x + 70 + sway, top + 300, 22, -0.2, PI * 1.1); ctx.stroke();
      } else {
        // a frosted pipe crossing low
        const gy = cam.y + 280;
        ctx.fillStyle = 'rgba(10,10,22,0.94)'; ctx.fillRect(x - 300, gy, 600, 46);
        ctx.fillStyle = 'rgba(205,220,255,0.5)'; ctx.fillRect(x - 300, gy - 3, 600, 5);
        ctx.fillRect(x - 40, gy - 20, 30, 86);
      }
      ctx.restore();
    }
    return true;
  }

  /* =========================================================================================
     MUSIC — an E-minor "ladder" motif: it climbs a step at a time and keeps reaching for the high E
     ========================================================================================= */
  const MOTIF = [
    [0, 76, 4], [4, 78, 4], [8, 79, 8],
    [16, 83, 6], [22, 81, 2], [24, 79, 8],
    [32, 76, 4], [36, 79, 4], [40, 81, 4], [44, 83, 4],
    [48, 86, 12], [60, 83, 4],
    [64, 84, 4], [68, 83, 4], [72, 81, 8],
    [80, 79, 4], [84, 81, 4], [88, 83, 4], [92, 76, 4],
    [96, 78, 8], [104, 75, 4], [108, 78, 4],
    [112, 76, 16],
  ];
  const MOTIF_COLD = MOTIF.map(([s, m, l]) => [s, m === 78 && s < 16 ? 77 : m, l]);
  const COUNTER2 = [[0, 52, 8], [8, 55, 8], [16, 55, 8], [24, 52, 8], [32, 57, 12], [44, 55, 4], [48, 59, 8], [56, 55, 8], [64, 57, 8], [72, 55, 8], [80, 59, 8], [88, 55, 8], [96, 54, 8], [104, 51, 8], [112, 52, 16]];
  const HORN = [
    [0, 64, 2], [2, 64, 2], [4, 71, 8], [12, 69, 4], [16, 67, 4], [20, 69, 4], [24, 71, 8],
    [32, 72, 6], [38, 71, 2], [40, 67, 8], [48, 69, 4], [52, 66, 4], [56, 62, 8],
    [64, 64, 2], [66, 64, 2], [68, 71, 8], [76, 74, 4], [80, 76, 8], [88, 74, 4], [92, 71, 4],
    [96, 72, 4], [100, 71, 4], [104, 69, 8], [112, 71, 8], [120, 66, 4], [124, 63, 4],
  ];
  const THEME_E = (G.Music && G.Music.THEME ? G.Music.THEME : []).map(([s, m, l]) => [s, m + 2 - 12, l]);
  const CHORDS = {
    c2Em: [40, 64, 67, 71], c2C: [36, 64, 67, 72], c2Am: [45, 64, 69, 72], c2G: [43, 62, 67, 71], c2D: [38, 62, 66, 69],
    c2B: [35, 63, 66, 71], c2F: [41, 65, 69, 72], c2Dm: [38, 62, 65, 69],
  };
  const TRACKS = {
    c2_explore: { bpm: 76, chords: ['c2Em', 'c2C', 'c2Am', 'c2G', 'c2C', 'c2Em', 'c2B', 'c2Em'], melody: MOTIF, mel: 'piano', melEvery: 2, pad: 'strings', arp: 'harp', choir: 0.15, bass: 0.35, drums: 0, counter: true, counterLine: COUNTER2 },
    c2_explore2: { bpm: 66, chords: ['c2Em', 'c2F', 'c2Em', 'c2Dm', 'c2C', 'c2F', 'c2B', 'c2Em'], melody: MOTIF_COLD, mel: 'bell', melEvery: 2, pad: 'strings', arp: 'none', choir: 0.45, bass: 0.25, drums: 0, counter: true, counterLine: COUNTER2.map(([s, m, l]) => [s, m === 55 ? 53 : m, l]) },
    c2_elite: { bpm: 126, chords: ['c2Em', 'c2Em', 'c2C', 'c2D', 'c2Em', 'c2Em', 'c2Am', 'c2B'], melody: HORN, mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 0.3, bass: 1, drums: 1, boss: true, timpani: true },
    c2_boss: { bpm: 136, chords: ['c2Em', 'c2C', 'c2Am', 'c2B', 'c2Em', 'c2F', 'c2D', 'c2B'], melody: MOTIF.map(([s, m, l]) => [s, m - 12, l]), mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 0.9, bass: 1, drums: 1, boss: true, timpani: true, counter: true, counterLine: COUNTER2 },
    c2_boss2: { bpm: 150, chords: ['c2Em', 'c2D', 'c2G', 'c2C', 'c2Em', 'c2G', 'c2B', 'c2Em'], melody: THEME_E.length ? THEME_E : MOTIF, mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 1, bass: 1, drums: 1, boss: true, toms: true, timpani: true, counter: true, counterLine: MOTIF.map(([s, m, l]) => [s, m - 12, l]) },
  };

  /* ambience: the village (chimes, creaks, the bell once it has its heart back), the trail (howling wind, ice),
     the station (metal groans, steam, a dead PA chime, the tether's hum), the counterweight (deep drone) */
  const AMB = {
    c2_village: { bed: [0.5, 0.28, 0, 0.04], gap: [2, 4], evt(t, A) {
      const r = Math.random(), F = G.game && G.game.save ? G.game.save.flags : {};
      if (F.c2_quest_done && r < 0.18) { A.bell(A.mtof(40), t, 0.06, 6, 0.9, 0.6); A.bell(A.mtof(52), t + 0.02, 0.025, 4, 0.9, 0.4); }
      else if (r < 0.5) { const b = 84 + [0, 3, 7, 10][Math.floor(Math.random() * 4)]; for (let i = 0; i < 3; i++) A.bell(A.mtof(b + i * 2), t + i * 0.11 + Math.random() * 0.05, 0.012, 1.6, 0.8, 0.5); }
      else if (r < 0.75) A.tone('sine', 180 + Math.random() * 40, t, 0.2, 0.02, 0.9, { to: 140, wet: 0.5 });
      else for (let i = 0; i < 4; i++) A.noise(t + i * 0.09, 0.01, 0.025, 0.08, 'bandpass', 900, 1400, 0.8, 0.3);
    } },
    c2_trail: { bed: [0.95, 0.62, 0, 0.06], gap: [2.5, 5], evt(t, A) {
      const r = Math.random();
      if (r < 0.3) { A.noise(t, 0.002, 0.06, 0.12, 'highpass', 3000, 6000, 0.7, 0.4); A.tone('sine', 1900, t, 0.002, 0.012, 0.3, { to: 1200, wet: 0.6 }); }
      else if (r < 0.55) { A.tone('sine', 320, t, 0.4, 0.012, 2.4, { to: 520, wet: 0.95 }); A.tone('sine', 330, t + 0.1, 0.4, 0.008, 2.2, { to: 300, wet: 0.95 }); }
      else if (r < 0.8) A.noise(t, 0.6, 0.05, 1.6, 'lowpass', 400, 120, 0.7, 0.5);
      else for (let i = 0; i < 6; i++) A.noise(t + i * 0.06, 0.005, 0.03, 0.05, 'bandpass', 1100, 1600, 0.8, 0.2);
    } },
    c2_station: { bed: [0.45, 0.22, 0, 0.35], gap: [2, 4.5], evt(t, A) {
      const r = Math.random();
      if (r < 0.3) A.tone('sawtooth', 70, t, 0.4, 0.012, 1.8, { to: 52, wet: 0.7 });
      else if (r < 0.55) A.noise(t, 0.05, 0.05, 1.1, 'highpass', 2600, 4200, 0.7, 0.3);
      else if (r < 0.72) { A.bell(A.mtof(79), t, 0.02, 1.4, 0.8, 0.2); A.bell(A.mtof(74), t + 0.35, 0.02, 1.8, 0.8, 0.2); }
      else if (r < 0.88) { A.tone('sine', 55, t, 1, 0.03, 3, { wet: 0.5 }); A.tone('sine', 55.8, t, 1, 0.03, 3, { wet: 0.5 }); }
      else if (G.SFX.crystal) G.SFX.crystal(t, 2);
    } },
    c2_tether: { bed: [0.35, 0.2, 0, 0.8], gap: [3, 5], evt(t, A) {
      if (Math.random() < 0.5) A.tone('sawtooth', 48, t, 0.6, 0.012, 2.6, { to: 44, wet: 0.8 });
      else { A.tone('sine', A.mtof(64), t, 0.8, 0.012, 3, { wet: 0.95 }); A.tone('sine', A.mtof(71), t + 0.4, 0.8, 0.01, 3, { wet: 0.95 }); }
    } },
  };

  const SFX = {
    c2_toll(t) { const A = G.AudioKit; A.bell(A.mtof(40), t, 0.32, 7, 0.9, 0.8); A.bell(A.mtof(52), t + 0.01, 0.12, 5, 0.9, 0.6); A.bell(A.mtof(59), t + 0.02, 0.05, 4, 0.9, 0.5); A.tone('sine', 41, t, 0.004, 0.4, 1.4, { to: 38, wet: 0.4 }); },
    c2_tollFar(t) { const A = G.AudioKit; A.bell(A.mtof(40), t, 0.1, 7, 1, 0.5); A.bell(A.mtof(52), t + 0.01, 0.04, 5, 1, 0.4); },
    c2_rumble(t) { const A = G.AudioKit; A.noise(t, 0.6, 0.35, 3.2, 'lowpass', 300, 80, 0.7, 0.4); A.tone('sine', 36, t, 0.5, 0.35, 3, { to: 30, wet: 0.3 }); },
    c2_crash(t) { const A = G.AudioKit; A.noise(t, 0.005, 0.5, 1.6, 'lowpass', 1800, 120, 0.7, 0.5); A.tone('sine', 50, t, 0.005, 0.5, 0.8, { to: 28, wet: 0.3 }); },
    c2_zip(t) { const A = G.AudioKit; A.tone('sawtooth', 300, t, 0.05, 0.03, 2.4, { to: 900, wet: 0.4 }); A.noise(t, 0.1, 0.04, 2.4, 'bandpass', 2000, 3500, 2, 0.3); },
    c2_snap(t) { const A = G.AudioKit; A.noise(t, 0.001, 0.6, 0.5, 'highpass', 1500, 400, 0.7, 0.4); A.tone('square', 220, t, 0.001, 0.08, 0.6, { to: 40, wet: 0.5 }); A.tone('sine', 40, t + 0.05, 0.01, 0.6, 1.6, { to: 24, wet: 0.4 }); },
  };

  // the child humming on the Ark band: Maestrina's theme as a thin, breathy voice that stops before the last phrase
  function humOnBand() {
    const A = G.AudioKit; if (!A || !A.ctx) return;
    const t0 = A.ctx.currentTime + 0.6, spb = 60 / 62 / 4;
    for (const [s, m, l] of (G.Music.THEME || [])) {
      if (s >= 96) break;
      const f = A.mtof(m), t = t0 + s * spb, d = l * spb * 0.95;
      A.tone('sine', f, t, 0.12, 0.035, d + 0.3, { wet: 0.85 });
      A.tone('triangle', f * 2, t, 0.15, 0.006, d, { wet: 0.9 });
    }
  }

  /* =========================================================================================
     DATA: speakers, dialogue, barks, hints, codex, relics
     ========================================================================================= */
  const DATA = {
    speakers: {
      c2_calla: { name: '卡菈修女', en: 'SISTER CALLA', color: '#d9c2ff' },
      c2_olin: { name: '歐林', en: 'OLIN', color: '#ffc27a' },
      c2_elder: { name: '葛蘿婆婆', en: 'GRANNY GRO', color: '#e8c9a0' },
    },
    dialog: {
      c2_enter: [
        { who: 'ode', text: '……方舟，這裡是第七降臨隊。請回應。……沒有。連雜訊都沒有。' },
        { who: 'rinne', text: '再試一次。' },
        { who: 'ode', text: '……第四十七次了。' },
        { who: 'talia', text: '——喂！那邊那個，穿長大衣的！' },
        { who: 'talia', text: '你是凜音吧？我是塔莉亞，碑文頻段上那個。……你本人，比聲音高。' },
        { who: 'rinne', text: '你在雪裡等了多久？' },
        { who: 'talia', text: '從方舟的頻段斷掉那天起。要回天上，只剩頌歌之梯——上梯子，一定會經過這裡。' },
        { who: 'talia', text: '歡迎來到鐘樓。三百一十二個人，和一口十七年沒響過的鐘。' },
        { who: 'talia', text: '先到碑那邊吧。這次，我能親手替你調刀。' },
      ],
      c2_pylonTalia: [
        { who: 'talia', text: '把止弦放上來。……六條弦。方舟的鍛造師，都是瘋子。' },
        { who: 'talia', text: '第三弦跟第五弦在互相拉扯。你在灰港，擋了很多次吧。' },
        { who: 'talia', text: '……你們是怎麼活下來的。' },
        { who: 'talia', text: '從今天起，每一座碑都找得到我。不過，還是親手調比較好。' },
      ],
      c2_taliaQuest: [
        { who: 'talia', text: '凜音……能拜託你一件事嗎。一件很大的事。' },
        { who: 'talia', text: '廣場上那口大鐘。鐘樓是為它蓋的。它響著的時候，寂裔不上山。' },
        { who: 'talia', text: '十七年前，第二降臨隊從這裡下山，往錨站去。那一夜之後，鐘錘就不見了。' },
        { who: 'rinne', text: '在哪裡。' },
        { who: 'talia', text: '錨站。有人在凍住的貨運車廂裡，看過一根發光的銅錘。我去過一次……被白色的狗追了回來。' },
        { who: 'talia', text: '那裡有條舊貨運纜線還連著鐘樓。把鐘錘綁上絞盤，我這邊就收得到。……拜託了。' },
      ],
      c2_taliaWait: [
        { who: 'talia', text: '錨站在山的另一頭，順著舊纜車線往下。鐘錘在凍住的貨運車廂裡。' },
        { who: 'talia', text: '找到了，就用錨站的絞盤送上來。……路上小心。那些狗一叫，就會有更多的狗。' },
      ],
      c2_taliaDone: [
        { who: 'rinne', text: '是這個嗎。' },
        { who: 'talia', text: '……就是它。這麼重，你是怎麼扛回來的……' },
        { who: 'talia', text: '大家，過來幫忙！葛蘿婆婆，掃把先放下！' },
      ],
      c2_bellRing: [
        { who: 'talia', text: '聽好了，鐘樓。十七年了——' },
        { who: 'sys', text: '（大鐘響了。一聲，兩聲，三聲。聲音沿著山谷滾下去，像一口憋了很久的氣，終於吐了出來。）' },
        { who: 'talia', text: '……它在響。它真的在響。' },
        { who: 'talia', text: '鐘錘裡卡著一顆共鳴核。我把它磨成了護符……就叫它「鐘樓之心」吧。' },
        { who: 'talia', text: '謝謝你，凜音。不管你走到哪裡，鐘聲都在你身後。' },
      ],
      c2_sendClapper: [
        { who: 'rinne', text: '……綁上去。' },
      ],
      c2_sendNoQuest: [
        { who: 'ode', text: '纜線的另一端是鐘樓。鐘錘的握柄上，刻著同樣的兩個字。' },
        { who: 'rinne', text: '……綁上去。' },
      ],
      c2_bellBand: [
        { who: 'talia', text: '凜音？貨運纜線在動……這是——鐘錘！' },
        { who: 'talia', text: '大家，過來幫忙！……好，裝上了。聽好了，鐘樓。十七年了——' },
        { who: 'sys', text: '（山的另一頭，大鐘響了。一聲，兩聲，三聲。聲音順著纜線傳下來，連腳下的鋼板都在共鳴。）' },
        { who: 'talia', text: '……它在響。凜音，你聽得到嗎？' },
        { who: 'talia', text: '鐘錘裡有顆共鳴核，我磨成護符了，用回程的吊籃送下去。就叫它「鐘樓之心」。' },
        { who: 'talia', text: '謝謝你。不管你走到哪裡，鐘聲都在你身後。' },
      ],
      c2_taliaAfter: [
        { who: 'talia', text: '大鐘每天傍晚都會響一次。我親手敲的。……小艾說，白色的狗都不來了。' },
      ],
      c2_askBelfry: [
        { who: 'talia', text: '三百一十二個人，兩百頭山羊，一台會唱歌的發電機。還有我。' },
        { who: 'talia', text: '大寂靜那年，大家從山下逃上來。這裡夠高、夠冷、夠吵——寂裔不喜歡吵的地方。' },
        { who: 'talia', text: '至少，以前是這樣。鐘不響之後，白色的狗一年比一年近。' },
      ],
      c2_askArk: [
        { who: 'talia', text: '方舟上的人……真的每天都有熱水可以洗澡嗎？' },
        { who: 'rinne', text: '每人每天，三分鐘。' },
        { who: 'talia', text: '……三分鐘。我們燒一桶雪，可以洗半個小時。' },
        { who: 'talia', text: '那上面……是什麼樣子？' },
        { who: 'rinne', text: '……很安靜。' },
      ],
      c2_askDescent: [
        { who: 'talia', text: '第二降臨隊？我那時才剛出生。都是聽大人說的。' },
        { who: 'talia', text: '帶隊的是一位修女，叫卡菈。她在大鐘下唱了一整夜，替這座山祈禱，然後帶著隊員下山，去搭升降梯。' },
        { who: 'talia', text: '升降梯沒有上去。他們也沒有回來。那一夜，錨站整個凍住了，鐘錘也不見了。' },
        { who: 'rinne', text: '……我去看看。' },
      ],
      c2_askFather: [
        { who: 'rinne', text: '錨站的線務員日誌。最後一頁，是寫給你的。' },
        { who: 'talia', text: '……喬納・瓦斯克。那是我爸。' },
        { who: 'talia', text: '我出生那天，他在錨站值班。他答應我媽，下班會帶一個會叫的鐘回來。……他一直沒有下班。' },
        { who: 'talia', text: '「爸爸會晚一點回去」……晚了十七年。笨蛋。' },
        { who: 'talia', text: '……謝謝你告訴我。我沒事。去吧，我還有一堆碑要修。' },
      ],
      c2_elderTalk: [
        { who: 'c2_elder', text: '方舟來的孩子。那丫頭在雪裡等了你好幾天，怎麼叫都不肯進屋。' },
        { who: 'c2_elder', text: '我掃了五十年的雪。鐘不響的這十七年，雪特別重。' },
      ],
      c2_elderAfter: [
        { who: 'c2_elder', text: '聽見了嗎。鐘一響，連雪都輕了。' },
      ],
      c2_hounds: [
        { who: 'rinne', text: '……雪裡有東西。' },
      ],
      c2_monk: [
        { who: 'rinne', text: '……山寺的敲鐘人。曾經是。' },
      ],
      c2_tetherling: [
        { who: 'ode', text: '頭頂的斷纜在動。……不是風。' },
      ],
      c2_vista: [
        { who: 'sys', text: '（雲層裂開。一根線，從山谷筆直地升進天空。）' },
        { who: 'rinne', text: '頌歌之梯。' },
        { who: 'ode', text: '……頻段上，有聲音。' },
        { who: 'sys', text: '（有人在哼歌。一個孩子的聲音，很輕，像怕吵醒誰。）' },
        { who: 'rinne', text: '……這首歌。' },
        { who: 'ode', text: '米菈的音樂盒。瑪絲緹娜。……同一首。' },
        { who: 'ode', text: '方舟沒有壞，凜音。它只是……安靜了下來。但上面，有人在唱。' },
        { who: 'rinne', text: '那就上去。' },
      ],
      c2_station: [
        { who: 'ode', text: '梯基錨站。……整座站，停在同一個瞬間。' },
      ],
      c2_linesmen: [
        { who: 'rinne', text: '……方舟的防寒服。他還在巡線。' },
      ],
      c2_chapel: [
        { who: 'rinne', text: '門框上畫著一口鐘。……她在這裡祈禱過。' },
      ],
      c2_eliteIntro: [
        { who: 'c2_olin', text: '（嗚————）' },
        { who: 'c2_olin', text: '站住。第二降臨隊，信號手歐林。集合號，我吹了十七年。沒有一個人回來。' },
        { who: 'c2_olin', text: '你是第幾隊的……第七？已經那麼久了。' },
        { who: 'c2_olin', text: '那你也聽聽。我的號角，還能讓誰停下腳步。' },
      ],
      c2_eliteDefeat: [
        { who: 'c2_olin', text: '……啊。這一次……有人聽見了。' },
        { who: 'c2_olin', text: '修女還在平衡錘那裡。她說……只要繼續唱，升降梯就會來。' },
        { who: 'c2_olin', text: '號角，給你。替我……吹最後一聲。' },
      ],
      c2_bossIntro: [
        { who: 'c2_calla', text: '（……）' },
        { who: 'ode', text: '她在唱。……沒有聲音。' },
        { who: 'c2_calla', text: '（她抬手指向天空，再指向你。嘴唇在動——「回去」。）' },
        { who: 'rinne', text: '我要上去。' },
      ],
      c2_bossDefeat: [
        { who: 'c2_calla', text: '（裂開的鐘裡，第一次傳出了聲音。很輕，像一句禱詞。）' },
        { who: 'c2_calla', text: '……孩子……我們……沒能上去……' },
        { who: 'c2_calla', text: '上面……很冷。她一個人……在唱……替我們……抱抱她……' },
        { who: 'sys', text: '（平衡錘鬆開了。升降梯，緩緩上升。）' },
        { who: 'ode', text: '……凜音，看上面。方舟的燈，是亮的。' },
      ],
      c2_liftSnap: [
        { who: 'sys', text: '（纜線發出一聲長長的、走了調的鳴響。）' },
        { who: 'sys', text: '（一聲巨響。整座升降梯猛地一沉。）' },
        { who: 'ode', text: '……我們在往下掉。' },
      ],
    },
    barks: {
      c2_run: { who: 'ode', text: '……別回頭。跑。' },
      c2_rumbleWarn: { who: 'ode', text: '……山在響。' },
      c2_clapper: { who: 'ode', text: '……鐘錘。握柄上，刻著「鐘樓」。' },
      c2_bellFar: { who: 'ode', text: '……鐘聲。從山的那一頭。' },
      c2_safe: { who: 'ode', text: '……停了。呼吸，凜音。' },
    },
    hints: {
      c2_jump: '<b class="r">震波</b> 會沿著地面推進——按 {jump} 跳過去',
      c2_glob: '飛來的 <b class="w">白光</b> 彈體：命中前一瞬按 {guard} 完美格擋，就能 <b>彈回去</b>',
      c2_hook: '<b class="r">紅光</b> 鉤索會把你拉近，用 {dodge} 閃開；地上閃爍的信標附近會放電，遠離它',
      c2_tower: '大鐘塔的鷹架似乎爬得上去……按 {jump} 跳上木台，空中再按一次可二段跳',
      c2_upper: '上方的貨運棧橋似乎有路……有號角聲從那裡傳來',
      c2_runHint: '<b class="r">雪崩！</b> 按住 {move} 一直往右跑，遇到倒木就按 {jump}',
    },
    codex: {
      people: [
        {
          id: 'c2_calla', name: '卡菈修女', en: 'SISTER CALLA — THE TONGUELESS BELL', portrait: 'c2_boss', unlock: 'c2_boss_seen',
          tag: '失聲者｜第二降臨隊隊長',
          body: [
            '第二降臨隊隊長，隨軍修女。她相信歌聲是人類最後的祈禱，帶著隊員在鐘樓的大鐘下唱了一整夜，然後下山前往梯基錨站。',
            '升降梯沒有上去。她把自己的聲音交給了寂靜，換一個「它會來」的承諾。十七年後，她仍與平衡錘熔在一起，無聲地唱著。',
            '「上面有個孩子在唱歌。我不能停下來。」',
          ],
        },
        {
          id: 'c2_olin', name: '歐林', en: 'OLIN — THE FROZEN BUGLER', portrait: 'c2_elite', unlock: 'c2_elite_seen',
          tag: '第二降臨隊｜信號手',
          body: [
            '第二降臨隊的信號手。鐘樓的孩子們至今還記得，十七年前有個高大的士兵為他們吹了一首集合號。',
            '他在錨站的貨運棧橋上守了十七年，每天吹一次「我在這裡，跟著聲音走」。沒有任何人跟上來。',
          ],
        },
        {
          id: 'c2_jonah', name: '喬納・瓦斯克', en: 'JONAH VASK', portrait: null, unlock: 'note_c2_n4',
          tag: '梯基錨站｜線務第三班',
          body: [
            '頌歌之梯地面錨站的線務員，塔莉亞的父親。錨站凍結的那一刻，他正在值班。',
            '他答應過，下班要帶一個「會叫的鐘」回家。',
          ],
        },
      ],
      world: [
        {
          id: 'c2_bell', name: '鐘樓大鐘', en: 'THE GREAT BELL', unlock: 'c2_met_talia',
          body: [
            '鐘樓聚落正中央的青銅巨鐘，鐘身鑄著四個字：「鳴則不寂」。聚落的人相信，只要它還在響，寂裔就不敢上山。',
            '十七年前的那一夜，鐘錘在寂靜中消失，大鐘從此只剩風吹過鐘口的聲音。',
          ],
        },
        {
          id: 'c2_ladder', name: '頌歌之梯', en: 'THE CANTATA LADDER', unlock: 'c2_vista_seen',
          body: [
            '連接地表與軌道方舟「頌歌號」的軌道電梯。錨纜全長三萬六千公里，從地面看去像一根插進天空的針。',
            '大寂靜之後，升降梯只為降臨作戰運行。第二降臨隊之後，它再也沒有往上開過。',
          ],
        },
        {
          id: 'c2_anchor', name: '梯基錨站', en: 'ANCHOR STATION', unlock: 'c2_station_seen',
          body: [
            '頌歌之梯的地面錨點，位於鐘樓山下的冰谷。平衡錘、貨運棧橋與升降梯月台都在這裡。',
            '十七年前，錨站在一瞬間凍結。值班人員的日誌停在同一分鐘，像是有人按下了暫停鍵。',
          ],
        },
        {
          id: 'c2_humming', name: '頻段上的哼唱', en: 'THE HUMMING ON THE BAND', unlock: 'c2_vista_seen',
          body: [
            '方舟通訊頻段完全靜默之後，偶爾會出現一段孩子的哼唱。旋律與米菈的音樂盒、與瑪絲緹娜的主題完全一致。',
            '她每次都停在同一個地方，像是不知道下一個音是什麼。',
          ],
        },
      ],
      items: [
        { id: 'c2_horn', name: '號角殘片', en: "OLIN'S HORN", unlock: 'relic_c2_horn', relic: true, body: ['冰封號手歐林的號角碎片。吹口仍有一點溫度。', '十七年來，它只吹過一種號令：一長，不停——我在這裡，跟著聲音走。', '遺物效果：完美格擋時回復 4 生命。'] },
        { id: 'c2_clapper', name: '鐘樓之心', en: 'HEART OF THE BELFRY', unlock: 'relic_c2_clapper', relic: true, body: ['塔莉亞用鐘錘裡的共鳴核磨成的護符。握著它，能聽見很遠的地方有鐘聲。', '她磨了一整夜。磨完之後，才想起自己的父親也曾答應過，要帶一口鐘回家。', '遺物效果：調和劑 +1。'] },
        { id: 'c2_frostbead', name: '霜念珠', en: 'FROST ROSARY', unlock: 'relic_c2_frostbead', relic: true, body: ['掛在大鐘塔頂的念珠。每一顆珠子都結著霜，卻不冰手。', '鐘樓的人說，是一位修女下山前掛上去的。她說，鐘不響的時候，總得有什麼替它祈禱。', '遺物效果：最大耐力 +15。'] },
        { id: 'c2_bellclapper', name: '大鐘的鐘錘', en: 'THE GREAT CLAPPER', unlock: 'c2_got_clapper', body: ['一根比人還長的青銅鐘錘，握柄刻著「鐘樓」。十七年來，它一直躺在錨站的貨運車廂裡，微微發光。'] },
      ],
      notes: [
        { id: 'c2_n1', name: '第二降臨隊 行軍日誌', en: 'DESCENT II — MARCH LOG', body: ['【第二降臨隊・隊長 卡菈修女】', '第十二日。鐘樓的人給了我們熱湯和一夜的屋簷。孩子們圍著號手歐林，要他吹一首歌。他吹了集合號，孩子們笑得像那是世界上最好聽的曲子。', '明天下山去錨站。升降梯若還能動，我們就能回方舟報告：地表上還有人在唱歌。', '願鐘聲護佑這座山。願我們的歌，比寂靜更長。'] },
        { id: 'c2_n2', name: '鐘樓孩子的信', en: 'A LETTER FROM THE BELFRY', body: ['給方舟上的人：', '我叫小艾，九歲。我們這裡很冷，可是大家都很好。塔莉亞姊姊會修所有的東西，除了大鐘。', '大人說大鐘不響了，所以白色的狗會靠過來。我晚上會在被子裡小聲唱歌，這樣牠們就聽不到大鐘沒有響。', '如果你們看到這封信，可以下來幫我們把鐘修好嗎？我可以把我的手套借你。'] },
        { id: 'c2_n3', name: '卡菈修女的禱詞', en: "CALLA'S PRAYER", body: ['主啊，若祢也聽不見了，', '就讓我替祢聽。', '若寂靜是祢的休止符，', '求祢讓我們成為下一個小節。', '——', '（背面以顫抖的字跡寫著：）', '我把聲音交給了它，換升降梯再動一次。它沒有來。它不會來的。', '可是我不能停下來。上面有個孩子在唱歌。'] },
        { id: 'c2_n4', name: '線務員的最後一班', en: 'LAST SHIFT — LINE TECHNICIAN', body: ['【梯基錨站・線務第三班　喬納・瓦斯克】', '04:12　纜線張力正常，平衡錘正常。我女兒今天早上出生了。我答應她媽，下班帶一個會叫的鐘回去。', '04:18　方舟頻段出現異常靜默。總部說是太陽風。', '04:31　同事們停止說話了。不是不想說，是發不出聲音。我的鉤桿在發抖。', '04:33　如果有人讀到這裡——鐘樓的塔莉亞，生日快樂。爸爸會晚一點回去。'] },
        { id: 'c2_n5', name: '頻段上的哼唱', en: 'HUMMING ON THE BAND', body: ['【鐘樓無線電站・值班紀錄　塔莉亞】', '凌晨三點十二分。方舟頻段又出現了。不是說話，是哼歌。', '一個小女孩的聲音，很輕，好像怕吵醒誰。同一段旋律，一遍又一遍，每次都停在同一個地方，像是不知道下一個音是什麼。', '我試著用口琴接下一個音。她停了一下。然後……她又從頭開始了。', '不知道為什麼，我哭了。'] },
        { id: 'c2_n6', name: '塔莉亞的待修清單', en: "TALIA'S REPAIR LIST", body: ['□ 共鳴碑三號：換電容（偷拿雜貨店老闆的收音機零件，記得還）', '□ 葛蘿婆婆的暖爐：又壞了，第六次', '■ 方舟來的共鳴者：到了。（她的刀有六條弦。不要一直盯著看。）', '□ 大鐘：缺鐘錘。十七年。跟我一樣老。', '□ 學會不要在暴風雪裡等人'] },
        { id: 'c2_n7', name: '歐林的號譜', en: "OLIN'S SIGNAL CALLS", body: ['【第二降臨隊・信號手 歐林】', '短、短、長：集合。', '長、長：撤退。', '三短：有人倒下。', '一長，不停：我在這裡，跟著聲音走。', '——修女要我吹最後那一種。她說只要還有人在吹，迷路的人就找得到方向。我已經吹了十七年。'] },
      ],
    },
    relics: {
      c2_horn: { name: '號角殘片', desc: '完美格擋時回復 4 生命' },
      c2_clapper: { name: '鐘樓之心', desc: '調和劑 +1' },
      c2_frostbead: { name: '霜念珠', desc: '最大耐力 +15' },
    },
  };
  // relic effects (the horn's heal-on-parry is an event effect handled in hooks.update)
  G.Relics.c2_clapper = G.Relics.c2_clapper || { apply(P) { P.maxTonic += 1; } };
  G.Relics.c2_frostbead = G.Relics.c2_frostbead || { apply(P) { P.maxSta += 15; } };
  // Olin's horn is an event relic (perfect guard → +4 HP). Relics outlive their chapter, so it hooks the engine's parry
  // event (G.Boons.onParry runs on every perfect guard in every chapter) instead of this chapter's update hook.
  if (!G.Relics.c2_horn) G.Relics.c2_horn = { apply() { } };
  if (G.Boons && G.Boons.onParry && !G.Boons._c2horn) {
    const onParry0 = G.Boons.onParry;
    G.Boons._c2horn = true;
    G.Boons.onParry = function (Pl) {
      const g = G.game, eq = g && g.save && g.save.equipped;
      if (eq && eq.includes('c2_horn') && Pl && Pl.hp > 0 && Pl.hp < Pl.maxHp) {
        Pl.hp = Math.min(Pl.maxHp, Pl.hp + 4);
        G.FX.ember(Pl.x, Pl.y - 70, 6, '#ffc27a', { w: 24, h: 30 });
      }
      return onParry0.apply(this, arguments);
    };
  }

  /* =========================================================================================
     LEVEL
     ========================================================================================= */
  const TALIA_HOME = 1080;
  const talia = {
    id: 'c2_talia', x: TALIA_HOME, y: 0, label: '交談',
    braid: null, walking: false, walkP: 0, greeting: false,
    draw(ctx, x, y, t, game) {
      const P = game.player, look = this.walking ? 1 : (P.x < x ? -1 : 1);
      if (!this.braid) this.braid = new G.Rig.Chain(6, 4.6, 0.06, 0.88);
      const dt = game.dtVis || 0, sh = -66 + Math.sin(t * 1.8) * 1.2;
      this.braid.update(x - look * 7, y + sh - 18, look, Math.min(dt, 1 / 30) || 1 / 60, -60 - (this.walking ? 120 : 0) * look, 2.9);
      drawTalia(ctx, x, y, t, look, this.walking ? this.walkP : 0, this.braid);
    },
    pending(game) {
      if (this.greeting) return false;   // no "talk" marker over her during the opening scene
      const F = game.save.flags; return !F.c2_quest_given || (F.c2_got_clapper && !F.c2_quest_done && !F.c2_clapper_sent);
    },
    talk(game) { taliaTalk(game); },
  };
  const elder = {
    id: 'c2_elder', x: 2230, y: 0, label: '交談',
    draw(ctx, x, y, t, game) { drawVillager(ctx, x, y, t, 0, game.player.x < x ? -1 : 1, 1); },
    pending(game) { return !game.save.flags.c2_met_elder; },
    talk(game) { const F = game.save.flags; game.dialog(F.c2_quest_done ? 'c2_elderAfter' : 'c2_elderTalk', () => { F.c2_met_elder = true; }); },
  };
  const winch = {
    id: 'c2_winch', x: 10585, y: 0, label: '使用絞盤', active: 0,
    draw(ctx, x, y, t) { drawWinch(ctx, x, y, t, this.active); },
    pending(game) { const F = game.save.flags; return F.c2_got_clapper && !F.c2_clapper_sent && !F.c2_quest_done; },
    // the send-off takes a few seconds out of your hands: never while Hushborn are close
    talk(game) { if (game.combatNear) { game.toast('附近還有寂裔——先解決牠們，再操作絞盤', 'warn'); return; } sendClapper(game); },
  };

  const LEVEL = {
    start: { x: 200, y: 0 }, bounds: [-400, 12800], gravity: 1,
    solids: [
      { x: -900, y: -1600, w: 500, h: 1700, kind: 'wall' },
      { x: -900, y: 0, w: 4900, h: 700, kind: 'c2_snow' },
      { x: 4000, y: -100, w: 1100, h: 800, kind: 'c2_snow' },
      { x: 5100, y: -230, w: 1500, h: 930, kind: 'c2_snow' },
      { x: 6600, y: -150, w: 380, h: 850, kind: 'c2_snow' },
      { x: 6760, y: -196, w: 70, h: 46, kind: 'c2_log' },
      { x: 6980, y: -70, w: 360, h: 770, kind: 'c2_snow' },
      { x: 7340, y: 0, w: 5960, h: 700, kind: 'c2_steel' },
      { x: 8480, y: -64, w: 150, h: 64, kind: 'c2_container' },
      { x: 10000, y: -540, w: 1060, h: 26, kind: 'c2_gantry' },
      { x: 12800, y: -1600, w: 500, h: 1700, kind: 'wall' },
    ],
    oneways: [
      // the great bell tower scaffold (secret route: a letter and a relic at the top)
      { x: 1850, y: -170, w: 150 }, { x: 1570, y: -330, w: 150 }, { x: 1850, y: -490, w: 150 }, { x: 1620, y: -650, w: 330 },
      // a porch roof in the village square
      { x: 2440, y: -170, w: 150 },
      // up to the cargo gantry (optional: Olin)
      { x: 9720, y: -180, w: 170 }, { x: 9830, y: -360, w: 150 },
    ],
    pylons: [
      { id: 'c2_p1', x: 930, y: 0, name: '鐘樓共鳴碑', dialog: 'c2_pylonTalia', flag: 'c2_pylon1' },
      { id: 'c2_p2', x: 5990, y: -230, name: '望梯崖共鳴碑' },
      { id: 'c2_p3', x: 10880, y: 0, name: '平衡錘共鳴碑' },
    ],
    notes: [
      { id: 'c2_n6', x: 640, y: 0 },
      { id: 'c2_n2', x: 1640, y: -330 },
      { id: 'c2_n1', x: 3880, y: 0 },
      { id: 'c2_n5', x: 5880, y: -230 },
      { id: 'c2_n4', x: 8380, y: 0, flag: 'c2_read_father' },
      { id: 'c2_n3', x: 10700, y: 0 },
      { id: 'c2_n7', x: 10990, y: -540 },
    ],
    items: [
      { id: 'c2_frostbead', x: 1790, y: -650, flag: 'c2_got_frostbead', name: '霜念珠', kind: 'relic' },
      { id: 'c2_bellclapper', x: 10345, y: 0, flag: 'c2_got_clapper', name: '大鐘的鐘錘', kind: 'key', sfx: 'pickup', onTake(game) {
        G.SFX.play('c2_tollFar'); game.shake(0.2);
        game.bark('c2_clapper');
        G.UI.journal(game.save.flags.c2_quest_given ? '支線任務：鐘樓的心跳' : '大鐘的鐘錘', '用錨站的貨運絞盤送回鐘樓');
      } },
    ],
    npcs: [talia, elder],
    triggers: [
      { id: 'c2_t_tower', x: 1460, kind: 'hint', hint: 'c2_tower' },
      // (first-sight briefings for the four new foes play from hooks.update once the first one has risen: see SIGHT)
      { id: 'c2_t_vista', x: 6160, kind: 'c2_vista' },
      { id: 'c2_t_aval', x: 6470, kind: 'c2_avalanche' },
      { id: 'c2_t_station', x: 7720, kind: 'dialog', dialog: 'c2_station', flag: 'c2_station_seen' },
      { id: 'c2_t_upper', x: 9710, kind: 'hint', hint: 'c2_upper' },   // just past the e5 arena wall (not mid-fight)
      { id: 'c2_t_elite', x: 10090, kind: 'dialog', dialog: 'c2_eliteIntro', enc: 'c2_elite', startEnc: 'c2_elite', flag: 'c2_elite_seen', yMax: -480, focus: { x: 10420, y: -700, zoom: 0.95 } },
      { id: 'c2_t_chapel', x: 10600, kind: 'c2_floorDialog', dialog: 'c2_chapel' },
      { id: 'c2_t_boss', x: 11200, kind: 'dialog', dialog: 'c2_bossIntro', enc: 'c2_boss', startEnc: 'c2_boss', flag: 'c2_boss_seen', focus: { x: 12230, y: -330, zoom: 0.85 }, music: 'c2_boss' },   // framed up: she hangs in her chains through the intro
    ],
    encounters: {
      c2_e1: { trigger: 3200, respawn: true, waves: [[{ t: 'c2_rimehound', x: 3620 }, { t: 'c2_rimehound', x: 3780 }]] },
      c2_e2: { trigger: 4250, arena: [4150, 5000], waves: [[{ t: 'c2_knellmonk', x: 4760 }], [{ t: 'c2_rimehound', x: 4300 }, { t: 'c2_rimehound', x: 4880 }]] },
      // trigger window [5010, 5910] stays clear of the Ladderwatch pylon (respawn at 5950): no ambush after resting
      c2_e3: { trigger: 5010, respawn: true, waves: [[{ t: 'c2_tetherling', x: 5560 }, { t: 'c2_tetherling', x: 5800 }]] },
      c2_e4: { trigger: 7900, respawn: true, waves: [[{ t: 'c2_linesman', x: 8280 }, { t: 'c2_rimehound', x: 8150 }, { t: 'c2_rimehound', x: 8400 }]] },
      c2_e5: {
        trigger: 8900, arena: [8800, 9700],
        waves: [
          [{ t: 'c2_knellmonk', x: 9420 }, { t: 'c2_tetherling', x: 9100 }, { t: 'c2_tetherling', x: 9580 }],
          [{ t: 'c2_linesman', x: 9520 }, { t: 'sentinel', x: 9200 }, { t: 'c2_rimehound', x: 8980 }],
        ],
      },
      // the yard under the gantry: a one-off fight (window [9900, 10800] never covers the counterweight pylon's respawn
      // point, so boss retries start in peace); hooks.encounterStart mirrors it if you come back from the gantry side
      c2_e6: { trigger: 9900, yMin: -100, waves: [[{ t: 'c2_linesman', x: 10480 }, { t: 'c2_tetherling', x: 10300 }, { t: 'c2_knellmonk', x: 10700 }, { t: 'shrieker', x: 10620, y: -300 }]] },
      c2_elite: { manual: true, elite: true, arena: [10030, 11030], wallBottom: -540, yMax: -480, waves: [[{ t: 'c2_elite', x: 10730, y: -540 }]] },
      c2_boss: { manual: true, boss: true, arena: [11400, 12800], waves: [[{ t: 'c2_boss', x: 12350 }]] },
    },
    zones: [
      { x: -1e9, name: '鐘樓聚落', en: 'THE BELFRY', tint: 0, music: 'c2_explore', amb: 'c2_village' },
      { x: 2980, name: '霜嘯山徑', en: 'THE FROSTWIND TRAIL', tint: 0.15, music: 'c2_explore', amb: 'c2_trail' },
      { x: 5120, name: '舊纜車站', en: 'THE OLD CABLEWAY', tint: 0.3, music: 'c2_explore', amb: 'c2_trail' },
      { x: 5960, name: '望梯崖', en: 'LADDERWATCH CLIFF', tint: 0.35, music: 'c2_explore', amb: 'c2_trail' },
      { x: 7420, name: '梯基錨站', en: 'THE ANCHOR STATION', tint: 0.6, music: 'c2_explore2', amb: 'c2_station' },
      { x: 11160, name: '平衡錘', en: 'THE COUNTERWEIGHT', tint: 1, music: 'c2_explore2', amb: 'c2_tether' },
    ],
    tintAt(x) {
      if (x < 3000) return 0;
      if (x < 6600) return 0.35 * (x - 3000) / 3600;
      if (x < 7400) return 0.35 + 0.2 * (x - 6600) / 800;
      return Math.min(1, 0.55 + 0.45 * (x - 7400) / 3600);
    },
  };

  const E6_WAVES = LEVEL.encounters.c2_e6.waves;
  // first sight of each new Hushborn: Ode's briefing waits until the first one has fully risen and is on screen, so
  // she always talks about something you can see (the world holds still while she speaks)
  const SIGHT = [
    { enc: 'c2_e1', type: 'c2_rimehound', dialog: 'c2_hounds', flag: 'c2_saw_hounds', after: 'guard' },
    { enc: 'c2_e2', type: 'c2_knellmonk', dialog: 'c2_monk', flag: 'c2_saw_monk', after: 'c2_jump' },
    { enc: 'c2_e3', type: 'c2_tetherling', dialog: 'c2_tetherling', flag: 'c2_saw_tether', after: 'c2_glob' },
    { enc: 'c2_e4', type: 'c2_linesman', dialog: 'c2_linesmen', flag: 'c2_saw_linesman', after: 'c2_hook' },
  ];
  // test aid (tools/test.html#shot…&c2fight=c2_boss): start that encounter as soon as the shot is placed
  const DFIGHT = typeof location !== 'undefined' && (location.hash.match(/c2fight=(\w+)/) || [])[1];

  // Boss framing. Calla towers ~420 px over the floor (more when her chains hoist the bell), but the engine only pulls
  // the camera back for an arena literally named 'boss'. While her fight runs (and no cutscene focus is set) pull back
  // a little and lift the frame so her face and halo stay in view — most on phones, whose view is the shortest. The
  // engine's own camera state is restored before each update, so this never accumulates or leaks into other chapters.
  function installBossCam(game) {
    if (game._c2cam || typeof game.updCamera !== 'function') return;
    game._c2cam = true;
    const base = game.updCamera;
    let saved = null, w = 0;
    game.updCamera = function (rdt) {
      const c = this.cam;
      if (saved) { c.x = saved.x; c.y = saved.y; c.zoom = saved.z; saved = null; }
      base.call(this, rdt);
      const ch = G.Chapters.cur, a = this.arena;
      const on = !!(ch && ch.id === 2 && a && a.id === 'c2_boss' && !this.focus && this.state === 'play');
      w = U.damp(w, on ? 1 : 0, 2.2, rdt || 0);
      if (!on && w < 0.003) { w = 0; return; }
      const vh = this.viewH || 640, short = U.clamp((640 - vh) / 190, 0, 1);   // 0 = desktop … 1 = phone
      saved = { x: c.x, y: c.y, z: c.zoom };
      c.zoom *= 1 - w * (0.08 + 0.1 * short);
      c.y -= w * (25 + 30 * short);
      if (a) {   // keep the wider frame inside the arena walls
        const hw = this.W / 2 / (this.baseS * c.zoom);
        c.x = a.x1 - a.x0 < hw * 2 ? (a.x0 + a.x1) / 2 : U.clamp(c.x, a.x0 + hw, a.x1 - hw);
      }
    };
  }

  /* =========================================================================================
     STORY LOGIC
     ========================================================================================= */
  function taliaTalk(game) {
    const F = game.save.flags;
    // carrying the clapper home (asked or not): she recognises it at once
    if (F.c2_got_clapper && !F.c2_clapper_sent && !F.c2_quest_done) { F.c2_quest_given = true; ringInPerson(game); return; }
    if (!F.c2_quest_given) {
      game.dialog('c2_taliaQuest', () => { F.c2_quest_given = true; G.UI.journal('支線任務：鐘樓的心跳', '從梯基錨站找回大鐘的鐘錘'); });
      return;
    }
    // a small dialogue tree: topics unlock with what you have seen
    const items = [
      { label: '關於鐘樓', en: 'THE BELFRY', action: () => game.dialog('c2_askBelfry', () => { F.c2_asked_belfry = true; }) },
      { label: '關於方舟', en: 'THE ARK', action: () => game.dialog('c2_askArk', () => { F.c2_asked_ark = true; }) },
      { label: '關於第二降臨隊', en: 'DESCENT II', action: () => game.dialog('c2_askDescent', () => { F.c2_asked_descent = true; }) },
    ];
    if (F.note_c2_n4 && !F.c2_told_father) items.push({ label: '線務員的日誌', en: "THE TECHNICIAN'S LOG", action: () => game.dialog('c2_askFather', () => { F.c2_told_father = true; }) });
    if (F.c2_quest_done) items.unshift({ label: '大鐘', en: 'THE BELL', action: () => game.dialog('c2_taliaAfter') });
    else items.unshift({ label: '鐘錘的事', en: 'THE CLAPPER', action: () => game.dialog('c2_taliaWait') });
    items.push({ label: '沒事了', en: 'LEAVE', action: () => { game.control = true; } });
    game.control = false; game.player.vx = 0;
    G.UI.choice({ kicker: '塔莉亞 TALIA', title: '「要聊什麼？」', desc: '鐘樓的機械師一邊轉著扳手，一邊等你開口。', items });
  }
  // the bell rings: shared by both endings of the quest (in person at the Belfry, or via the freight cable)
  const ST = { bellAng: 0, bellV: 0, ring: 0, pod: null, aval: null };
  function completeBellQuest(game, far) {
    const F = game.save.flags;
    F.c2_quest_done = true;
    const tolls = [0, 1.7, 3.4];
    tolls.forEach((d, i) => setTimeout(() => {
      G.SFX.play(far ? 'c2_tollFar' : 'c2_toll'); game.shake(far ? 0.25 : 0.55);
      ST.bellV += 0.55 * (i % 2 ? -1 : 1); ST.ring = 1.6;
    }, 900 + d * 1000));
    setTimeout(() => {
      game.dialog(far ? 'c2_bellBand' : 'c2_bellRing', () => {
        game.focus = null;
        game.giveRelic('c2_clapper');
        // the extra tonic is usable right away (the engine does the same for Barrow's blessing)
        if (game.player) game.save.tonic = Math.min(game.player.maxTonic, (game.save.tonic || 0) + 1);
        G.UI.journal('支線任務完成', '鐘樓的心跳');
      });
    }, 600);
  }
  function ringInPerson(game) {
    game.dialog('c2_taliaDone', () => {
      game.focus = { x: BELL.x, y: -380, zoom: 0.8 }; game.control = false;
      completeBellQuest(game, false);
    });
  }
  function sendClapper(game) {
    const F = game.save.flags;
    game.dialog(F.c2_quest_given ? 'c2_sendClapper' : 'c2_sendNoQuest', () => {
      F.c2_clapper_sent = true; game.control = false;
      winch.active = 1; G.SFX.play('c2_zip');
      ST.pod = { t: 0, x0: 10560, y0: -400 };
      game.focus = { x: 10460, y: -520, zoom: 0.8 };
      setTimeout(() => { winch.active = 0; game.focus = null; completeBellQuest(game, true); }, 2600);
    });
  }

  // set-piece 1: the vista — the camera pulls back over the valley, the tether wakes, a child hums on the band
  function vista(game) {
    const F = game.save.flags;
    if (F.c2_vista_seen || ST.vistaOn) return;
    ST.vistaOn = true;
    game.control = false; game.player.vx = 0;
    game.focus = { x: 6900, y: -560, zoom: 0.62 };
    ST.quiet = true;
    setTimeout(() => {
      humOnBand();
      game.dialog('c2_vista', () => { F.c2_vista_seen = true; ST.vistaOn = false; game.focus = null; ST.quiet = false; });
    }, 1400);
  }

  // set-piece 2: the avalanche — rumble, a warning, then a wall of snow chases you down to the station gate
  function avalanche(game) {
    const F = game.save.flags;
    if (F.c2_aval_done) return;
    G.SFX.play('c2_rumble'); game.shake(0.5); game.bark('c2_rumbleWarn');
    const P = game.player;
    const h = {
      t: 0, x: P.x - 760, speed: 0, armed: false, done: false,
      update(h, dt, g) {
        if (h.t < 1.3) { g.trauma = Math.max(g.trauma, 0.3); return; }
        if (!h.armed) { h.armed = true; g.bark('c2_run'); g.hint('c2_runHint'); G.SFX.play('c2_rumble'); }
        h.speed = Math.min(360, h.speed + 600 * dt);
        h.x += h.speed * dt;
        g.trauma = Math.max(g.trauma, 0.35);
        const P = g.player;
        if (P.state !== 'dead' && P.x < h.x + 10 && P.x > h.x - 600) {
          const r = P.receiveHit(null, { dmg: 18, unblockable: true, kb: 560, hx: h.x, hy: P.y - 60, waveFrom: h.x - 40 });
          if (r === 'hit') { P.vy = -420; G.FX.dust(P.x, P.y, 14, { col: 'rgba(240,246,255,', size: 18, speed: 260 }); }
        }
        if (Math.random() < 0.6) G.FX.dust(h.x + 20, groundAt(h.x + 20), 3, { col: 'rgba(240,246,255,', size: 22, speed: 200, dir: -PI / 2 - 0.6, spread: 0.8 });
        if (h.x > 7420) {
          h.done = true; F.c2_aval_done = true; ST.aval = null;
          G.SFX.play('c2_crash'); g.shake(1);
          G.FX.dust(7470, 0, 40, { col: 'rgba(240,246,255,', size: 34, speed: 520, w: 120 });
          G.FX.ring(7470, -100, 20, 360, 0.7, '#e8f4ff', 6);
          setTimeout(() => g.bark('c2_safe'), 700);
        }
        if (P.state === 'dead') { h.done = true; ST.aval = null; }
      },
      draw() { },
    };
    ST.aval = h;
    game.hazards.push(h);
  }

  // live overlay on the winch prop (only while it can be used / is running): drum spokes + crank, the clapper lashed to
  // the hook, and an amber ready-lamp that pulses to invite you
  function drawWinch(ctx, x, y, t, active) {
    ctx.save(); ctx.translate(x, y);
    ctx.save(); ctx.translate(0, -44); ctx.rotate(active ? t * 9 : 0.5);
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const b = i * PI / 2; ctx.beginPath(); ctx.moveTo(Math.cos(b) * 4, Math.sin(b) * 4); ctx.lineTo(Math.cos(b) * 17, Math.sin(b) * 17);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#8692b8'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -27); ctx.strokeStyle = INK; ctx.lineWidth = 5.4; ctx.stroke(); ctx.strokeStyle = '#a3afc8'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#b8473f'; ctx.beginPath(); ctx.arc(0, -28, 4.6, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#d9a12e'; ctx.beginPath(); ctx.arc(0, -44, 4.6, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
    const k = active ? 1 : 0.5 + 0.5 * Math.sin(t * 4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(-12, -72, 0, -12, -72, 22); gr.addColorStop(0, `rgba(255,190,90,${0.55 * k})`); gr.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = gr; ctx.fillRect(-34, -94, 44, 44); ctx.restore();
    ctx.fillStyle = '#2f3450'; ctx.fillRect(-16, -70, 8, 4); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(-16, -70, 8, 4);
    ctx.fillStyle = k > 0.5 ? '#ffd27a' : '#c98a3a'; ctx.beginPath(); ctx.arc(-12, -73, 3.4, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  // the freight pod riding the cable up the mountain: trolley wheel, a slatted basket, the bronze clapper inside
  function drawPod(ctx, px, py, t) {
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.sin(t * 5) * 0.06);
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-9, 15); ctx.moveTo(0, 0); ctx.lineTo(9, 15); ctx.stroke();
    ctx.fillStyle = '#4a4670'; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = BRONZE.lit; ctx.beginPath(); ctx.ellipse(1, 10, 5.5, 10, 0.12, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, 15); ctx.lineTo(12, 15); ctx.lineTo(9, 33); ctx.lineTo(-9, 33); ctx.closePath();
    ctx.fillStyle = WOOD.base; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = WOOD.dark; ctx.lineWidth = 1; for (const yy of [21, 27]) { ctx.beginPath(); ctx.moveTo(-11, yy); ctx.lineTo(11, yy); ctx.stroke(); }
    ctx.fillStyle = SNOW.lit; ctx.fillRect(-12, 13, 24, 2.5);
    ctx.restore();
  }

  /* =========================================================================================
     TALIA'S PORTRAIT (codex) — she is a voice no more
     ========================================================================================= */
  if (G.UI && G.UI.drawPortrait && !G.UI._c2Portrait) {
    const base = G.UI.drawPortrait.bind(G.UI);
    G.UI._c2Portrait = true;
    G.UI.drawPortrait = function (key) {
      const g = G.game;
      if (key !== 'talia' || !(g && g.save && g.save.flags && g.save.flags.c2_met_talia)) return base(key);
      const cv = document.getElementById('portrait'); if (!cv) return base(key);
      const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const bg = ctx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.5, W * 0.75); bg.addColorStop(0, '#26303a'); bg.addColorStop(1, '#09080c');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(239,233,223,.05)'; ctx.lineWidth = 1;
      for (let i = 0; i < W; i += 26) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }
      const br = new G.Rig.Chain(6, 4.6, 0.06, 0.88);
      for (let k = 0; k < 60; k++) br.update(-7, -102, 1, 1 / 60, -60, 2.9);
      ctx.setTransform(3.7, 0, 0, 3.7, W / 2, H * 0.92);
      try { drawTalia(ctx, 0, 0, 1.3, 1, 0, br); } catch (e) { console.warn(e); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
  }

  /* =========================================================================================
     REGISTER
     ========================================================================================= */
  G.Chapters.register({
    id: 2, key: 'ch2', num: 'II', numZh: '二', title: '頌歌之梯', en: 'THE CANTATA LADDER',
    intro: [
      { t: '大地之上，只剩一條路通往天空。', s: 'ONE ROAD LEFT TO THE SKY.' },
      { t: '天上的方舟，三天沒有聲音。', s: 'THE ARK HAS BEEN SILENT FOR THREE DAYS.' },
    ],
    enterDialog: 'c2_enter',
    outro: '「……我們在往下掉。」',
    level: LEVEL,
    pal: {
      skyTop: ['#18204a', '#0d1230'], skyMid: ['#46598f', '#2a3263'], skyLow: ['#c39fc4', '#8a76ae'], horizon: ['#ffd6b8', '#f0b4d0'],
      far: ['#a2b2d8', '#8a92c0'], mid: ['#5f6f9e', '#4c5486'], midDark: ['#3a4675', '#2c3060'],
      near: ['#2c3358', '#242848'], nearDark: ['#181d38', '#13162c'], rim: ['#ffd9b0', '#ffbcd6'],
      ground: ['#dfe7f6', '#c7cfe4'], groundDark: ['#262b4a', '#1c1f36'], groundTop: ['#ffffff', '#f2f4ff'],
      fog: ['#bccbea', '#aaa8d8'],
    },
    sky: {
      sunX: 0.8, sunY: 60, sunCore: '#fff6ec', sunGlow: '#ffd8c0', rayCol: '#ffe2d0', rays: 0.55, shaftCol: '255,224,214', ark: true,
      clouds: [{ lit: [255, 228, 220], shade: [96, 108, 156], core: [168, 176, 214] }, { lit: [255, 206, 228], shade: [62, 64, 112], core: [128, 124, 176] }],
    },
    bg: { far: genFar, mid: genMid, near: genNear, props: genProps },
    solidPainters: { c2_snow: paintSnow, c2_steel: paintSteel, c2_gantry: paintGantry, c2_container: paintContainer, c2_log: paintLog },
    onewayPainter,
    music: { explore: 'c2_explore', boss: 'c2_boss', boss2: 'c2_boss2', elite: 'c2_elite', rest: 'rest' },
    // zone music, except while the band is humming at Ladderwatch (the score falls silent to let her be heard)
    musicAt(x) { if (ST.quiet) return null; const z = L.zoneAt(x); return (z && z.music) || 'c2_explore'; },
    tracks: TRACKS,
    chords: CHORDS,
    ambience: AMB,
    sfx: SFX,
    data: DATA,
    hooks: {
      enter(game, run) {
        const F = game.save.flags;
        // she meets you at the gate (held there through the dialogue), then walks back to her workshop by the pylon
        talia.x = 470; talia.walking = false; talia.greeting = true; talia.braid = null;
        game.focus = { x: 340, y: -150, zoom: 1.12 };
        game.player.facing = 1;
        game.dialog('c2_enter', () => {
          game.focus = null; F.c2_met_talia = true; F.met_talia = true;
          talia.greeting = false; talia.walking = true;
          run();
        });
        return true;
      },
      encounterStart(game, id) {
        // the yard fight under the gantry: if you come back to it from the far side (you dropped off the gantry's
        // end), the ambush is mirrored so it still lies ahead of you instead of rising around your feet
        if (id !== 'c2_e6') return;
        const E = L.encounters.c2_e6, px = game.player.x;
        E.waves = px > 10450
          ? [[{ t: 'c2_linesman', x: px - 430 }, { t: 'c2_tetherling', x: px - 600 }, { t: 'c2_knellmonk', x: px - 320 }, { t: 'shrieker', x: px - 380, y: -300 }]]
          : E6_WAVES;
      },
      update(game, dt) {
        const F = game.save.flags, P = game.player;
        installBossCam(game);
        if (DFIGHT && game.encState && game.encState[DFIGHT] === 'idle') game.startEncounter(DFIGHT);
        if (game.control && !G.UI.dialogActive) for (const s of SIGHT) {
          if (F[s.flag] || game.encState[s.enc] !== 'active') continue;
          if (game.enemies.some((q) => q.enc === s.enc && q.type === s.type && !q.dead && q.state !== 'spawn' && Math.abs(q.x - P.x) < 560)) {
            F[s.flag] = true; game.dialog(s.dialog, () => { if (s.after) game.hint(s.after); });
            break;
          }
        }
        // the elite / boss health bar waits for the intro dialogue to finish (it sits under the dialogue box otherwise)
        const bar = G.UI.el && G.UI.el.boss, br = game.bossRef;
        if (bar && G.UI.bossOn) { const want = !(G.UI.dialogActive && br && br.state === 'spawn'); if (bar.classList.contains('show') !== want) bar.classList.toggle('show', want); }
        // Talia walks back to her workshop after meeting you at the gate
        if (talia.walking) {
          talia.x = Math.min(TALIA_HOME, talia.x + 120 * dt); talia.walkP += dt * 7.5;
          if (talia.x >= TALIA_HOME) { talia.walking = false; talia.walkP = 0; }
        } else if (talia.greeting && !G.UI.dialogActive) { talia.greeting = false; talia.walking = true; }   // (dialogue cut short)
        else if (!talia.greeting && talia.x !== TALIA_HOME) talia.x = TALIA_HOME;
        // the freight winch is only something you can use while you carry the clapper
        const want = !!(F.c2_got_clapper && !F.c2_clapper_sent && !F.c2_quest_done), has = L.npcs.includes(winch);
        if (want && !has) L.npcs.push(winch); else if (!want && has && !winch.active) L.npcs.splice(L.npcs.indexOf(winch), 1);
        // the bell's pendulum (damped) + ring decay; it swings gently every morning once it has its heart back
        ST.bellV += (-ST.bellAng * 9 - ST.bellV * 0.9) * dt; ST.bellAng += ST.bellV * dt;
        ST.ring = Math.max(0, ST.ring - dt * 0.7);
        if (F.c2_quest_done && Math.abs(P.x - BELL.x) < 900 && Math.random() < dt / 14) { ST.bellV += 0.3; ST.ring = 1; G.SFX.play('c2_toll'); }
        if (ST.pod) { ST.pod.t += dt; if (ST.pod.t > 3) ST.pod = null; }
      },
      trigger(game, tr) {
        // the two set-pieces take control away: they wait (re-arm) while Hushborn are still on your heels, and the
        // vista always plays before the avalanche (the story beat lives in it)
        const F = game.save.flags, rearm = () => { delete F['t_' + tr.id]; return true; };
        if (tr.kind === 'c2_vista') { if (game.combatNear) return rearm(); vista(game); return true; }
        if (tr.kind === 'c2_avalanche') {
          if (game.combatNear || ST.vistaOn) return rearm();
          if (!F.c2_vista_seen) { vista(game); return rearm(); }
          avalanche(game); return true;
        }
        // a dialogue that only plays down on the station floor (not from the gantry above)
        if (tr.kind === 'c2_floorDialog') { if (game.player.y < -100) delete game.save.flags['t_' + tr.id]; else game.dialog(tr.dialog); return true; }
        return false;
      },
      drawBack(ctx, game) {
        const cx = game.cam.x, t = game.realTime, F = game.save.flags;
        const vis = (x, m = 700) => Math.abs(x - cx) < m + 600;
        // lantern / floodlight flicker
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const l of LANTERNS) {
          if (!vis(l.x)) continue;
          const fl = 0.75 + 0.15 * Math.sin(t * 9 + l.x) + 0.1 * Math.sin(t * 23 + l.x * 0.3);
          const gr = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
          gr.addColorStop(0, l.cold ? `rgba(255,236,200,${0.28 * fl})` : `rgba(255,180,90,${0.32 * fl})`); gr.addColorStop(1, 'rgba(255,180,90,0)');
          ctx.fillStyle = gr; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
          if (l.cold) {
            const cg = ctx.createLinearGradient(0, l.y, 0, 0); cg.addColorStop(0, `rgba(255,236,200,${0.12 * fl})`); cg.addColorStop(1, 'rgba(255,236,200,0)');
            ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(l.x - 10, l.y); ctx.lineTo(l.x + 10, l.y); ctx.lineTo(l.x + 90, 0); ctx.lineTo(l.x - 70, 0); ctx.closePath(); ctx.fill();
          }
        }
        // candles at the shrine and in the chapel
        for (const [x, y] of [[3822, -10], [3878, -10], [3886, -10], [10671, -29], [10683, -29], [10699, -29]]) {
          if (!vis(x)) continue;
          const k = 0.8 + 0.2 * Math.sin(t * 13 + x);
          ctx.fillStyle = `rgba(255,190,100,${0.5 * k})`; ctx.beginPath(); ctx.ellipse(x, y - 3, 2.2, 4.5 * k, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = `rgba(255,160,80,${0.12 * k})`; ctx.beginPath(); ctx.arc(x, y - 3, 14, 0, TAU); ctx.fill();
        }
        // the fire barrel in the village square
        if (vis(2347)) {
          const fx = 2347, fy = -46;
          const gr = ctx.createRadialGradient(fx, fy - 10, 0, fx, fy - 10, 130); gr.addColorStop(0, 'rgba(255,150,70,0.35)'); gr.addColorStop(1, 'rgba(255,150,70,0)');
          ctx.fillStyle = gr; ctx.fillRect(fx - 130, fy - 140, 260, 260);
          for (let i = 0; i < 5; i++) {
            const ph = t * 7 + i * 1.3, h = 18 + 10 * Math.sin(ph), w = 6 + 2 * Math.sin(ph * 1.7);
            ctx.fillStyle = i % 2 ? 'rgba(255,200,90,0.8)' : 'rgba(255,120,60,0.7)';
            ctx.beginPath(); ctx.moveTo(fx - 12 + i * 6 - w, fy); ctx.quadraticCurveTo(fx - 12 + i * 6, fy - h * 1.4, fx - 12 + i * 6 + Math.sin(ph) * 3, fy - h * 1.6); ctx.quadraticCurveTo(fx - 12 + i * 6 + w * 0.4, fy - h * 0.6, fx - 12 + i * 6 + w, fy); ctx.fill();
          }
        }
        // the clapper pod riding the freight cable up to the Belfry
        const podAt = () => { const k = U.easeInOutSine(Math.min(1, ST.pod.t / 2.6)); return [U.lerp(FMX - 15, 10200, k), U.lerp(-428, -2000, k)]; };
        if (ST.pod) {
          const [px, py] = podAt();
          const gr = ctx.createRadialGradient(px, py + 16, 0, px, py + 16, 60); gr.addColorStop(0, 'rgba(255,214,140,0.7)'); gr.addColorStop(1, 'rgba(255,214,140,0)');
          ctx.fillStyle = gr; ctx.fillRect(px - 60, py - 44, 120, 120);
        }
        ctx.restore();
        if (ST.pod) { const [px, py] = podAt(); drawPod(ctx, px, py, t); }
        // chimney smoke (soft puffs rising and drifting with the wind)
        for (const cx0 of CHIMNEYS) {
          if (!vis(cx0)) continue;
          for (let i = 0; i < 5; i++) {
            const k = ((t * 0.18 + i * 0.2) % 1), sx = cx0 + k * 90, sy = -190 - k * 220;
            ctx.fillStyle = `rgba(214,222,246,${(1 - k) * 0.22})`; ctx.beginPath(); ctx.arc(sx, sy, 10 + k * 26, 0, TAU); ctx.fill();
          }
        }
        // steam vents in the station yard
        for (const vx of VENTS) {
          if (!vis(vx)) continue;
          const burst = (Math.sin(t * 0.9 + vx) + 1) / 2;
          ctx.fillStyle = '#23263c'; ctx.fillRect(vx - 14, -8, 28, 8); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(vx - 14, -8, 28, 8);
          for (let i = 0; i < 6; i++) {
            const k = ((t * 0.6 + i / 6) % 1), sx = vx + Math.sin(k * 4 + i) * 8 + k * 30, sy = -8 - k * 220 * (0.5 + burst * 0.5);
            ctx.fillStyle = `rgba(236,242,255,${(1 - k) * 0.3 * (0.4 + burst * 0.6)})`; ctx.beginPath(); ctx.arc(sx, sy, 8 + k * 30, 0, TAU); ctx.fill();
          }
        }
        // crystal pulse in the station
        if (cx > 7000) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          for (const [x, s] of [[7640, 36], [8700, 30], [9300, 44], [9760, 26], [10120, 34], [10800, 30], [11420, 50], [12700, 60]]) {
            if (!vis(x)) continue;
            const k = 0.5 + 0.5 * Math.sin(t * 1.6 + x);
            ctx.fillStyle = `rgba(255,95,154,${0.06 + 0.06 * k})`; ctx.beginPath(); ctx.arc(x, -s * 0.6, s * 1.2, 0, TAU); ctx.fill();
          }
          ctx.restore();
        }
        // the great bell + villagers
        if (vis(BELL.x, 900)) drawBell(ctx, ST.bellAng, ST.ring, !!F.c2_quest_done);
        if (vis(2350)) {
          drawVillager(ctx, 2300, 0, t, 1, 1, 2);
          drawVillager(ctx, 2395, 0, t, 2, -1, 3);
          drawVillager(ctx, 2265, 0, t + 0.7, 1, 1, 5);
        }
        if (vis(700)) drawVillager(ctx, 720, 0, t, 2, -1, 7);
      },
      drawFront(ctx, game) {
        // the avalanche (in front of everything in the world)
        if (ST.aval && ST.aval.t >= 1.3) drawAvalanche(ctx, ST.aval, game.cam);
        // ground drift: wisps of snow skating along the floor around the camera
        const cx = game.cam.x, t = game.realTime;
        if (cx > 7600) return;
        ctx.fillStyle = 'rgba(240,246,255,0.18)';
        for (let i = 0; i < 6; i++) {
          const x = cx - 700 + (((i * 311 + t * 160) % 1400) + 1400) % 1400, y = groundAt(x);
          ctx.beginPath(); ctx.ellipse(x, y - 4, 70 + (i % 3) * 30, 4, 0, 0, TAU); ctx.fill();
        }
      },
      drawForeground(ctx, cam, S, game) { return drawFG(ctx, cam, S, game); },
      drawAtmos(ctx, cam, W, H, S, time) { return drawSnowAtmos(ctx, cam, W, H, S, time); },
      bossDefeated(game) {
        game.dialog('c2_bossDefeat', () => {
          game.control = false;
          G.SFX.play('quake'); game.shake(0.6);
          setTimeout(() => {
            G.SFX.play('c2_snap'); game.shake(1); game.slowmo(1.2, 0.3);
            setTimeout(() => {
              game.fadeTarget = 1;
              game.dialog('c2_liftSnap', () => { game.fadeTarget = 0; game.completeChapter(); });
            }, 700);
          }, 1300);
        });
        return true;
      },
    },
    next: 3,
  });
})(window.G);

'use strict';
/* ECHOFALL — Chapter IV 沉沒的歌劇院 THE DROWNED OPERA (world, art, music, story).
   Lyra, the drowned capital of music, under a full moon: the flooded Boulevard → the Opera Square → (through the façade)
   the Grand Foyer → the drowned stalls → the last stage. Foes: ch4_foes.js, boss: ch4_boss.js (referenced by id only).
   Interior trick: each room of the opera owns two extra parallax layers, drawn clipped to the screen span between its
   doorframes (façade → auditorium doors → end), so stepping through a door swaps the whole backdrop exactly at the frame. */
(function (G) {
  const U = G.U, PI = Math.PI, TAU = PI * 2, INK = '#0b0612';
  const rgba = U.rgba, mixH = U.mixHex;

  /* =============================== LAYOUT =============================== */
  const PLAZA_X = 3700, FACADE = 6300, FOYER_X = 6450, AUD_X = 9440, STALLS_X = 9500, STAGE_X = 11400, ARENA0 = 11500, END_X = 12900;
  const HAZ = [{ x0: 1300, x1: 1420, y: 0 }, { x0: 5290, x1: 5420, y: -90 }];          // black Hush water (hurts)
  const WPOOLS = [{ x0: 2100, x1: 2270, y: 0 }, { x0: 4760, x1: 4980, y: -90 }];       // deep pools the Pit Wyrms rise from
  const CHAND = { x: 10150, top: -1250, hang: -560 };                                  // the auditorium chandelier (set piece)
  // shared with the foe authors: where water lies (the stalls are flooded wall to wall)
  G.C4 = { pools: WPOOLS.concat([{ x0: STALLS_X + 40, x1: STAGE_X - 60, y: 0 }]), hazards: HAZ, facade: FACADE, auditorium: AUD_X };

  const tintAt = (x) => {
    if (x < PLAZA_X) return 0;
    if (x < 6100) return (x - PLAZA_X) / (6100 - PLAZA_X) * 0.3;
    if (x < 6600) return 0.3 + (x - 6100) / 500 * 0.5;
    return 0.8 + U.clamp((x - 6600) / 3000, 0, 1) * 0.2;
  };

  /* =============================== PAINT HELPERS =============================== */
  const C = {
    velvet: '#7a1426', velvetD: '#3d0814', velvetL: '#b8343f', gold: '#c9963a', goldD: '#6e4a1c', goldL: '#ffe08a', goldH: '#fff4c8',
    marble: '#a89c94', marbleL: '#e6dccb', marbleD: '#4a3a40', wood: '#3a1a14', wall: '#4a0f1e', wallD: '#24060f',
    moon: '#cfe2ff', lamp: '#ffc36b', hush: '#ff4f86', hushL: '#ffd0e0', waterD: '#070b18',
  };
  function ink(g, w = 1.6, col = INK) { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
  // arched opening; kind 'round' | 'ogee' (Venetian) | 'flat'
  function archPath(g, x, y, w, h, kind = 'round') {
    const r = w / 2;
    g.beginPath(); g.moveTo(x, y + h);
    if (kind === 'flat') { g.lineTo(x, y); g.lineTo(x + w, y); }
    else if (kind === 'ogee') {
      g.lineTo(x, y + r); g.quadraticCurveTo(x, y + r * 0.15, x + r * 0.55, y + r * 0.05);
      g.quadraticCurveTo(x + r * 0.95, y - r * 0.05, x + r, y - r * 0.55);
      g.quadraticCurveTo(x + r * 1.05, y - r * 0.05, x + r * 1.45, y + r * 0.05); g.quadraticCurveTo(x + w, y + r * 0.15, x + w, y + r);
    } else { g.lineTo(x, y + r); g.arc(x + r, y + r, r, PI, 0); }
    g.lineTo(x + w, y + h); g.closePath();
  }
  function glow(g, x, y, r, col, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.35, rgba(col, a * 0.45)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Hush crystal in this chapter's rose-glass colour (inked, cel-cut facets)
  function hushXtal(g, x, y, s, rr, col = C.hush) {
    const n = 3 + Math.floor(rr() * 3);
    glow(g, x, y - s * 0.5, s * 1.6, col, 0.22);
    for (let i = 0; i < n; i++) {
      const a = -PI / 2 + (rr() - 0.5) * 1.5, len = s * (0.55 + rr() * 0.8), wd = s * 0.17 * (0.7 + rr() * 0.6), bx = x + (rr() - 0.5) * s * 0.7;
      const tx = bx + Math.cos(a) * len, ty = y + Math.sin(a) * len, nx = -Math.sin(a) * wd, ny = Math.cos(a) * wd;
      poly(g, [[bx - nx, y - ny], [tx, ty], [bx + nx, y + ny]]); g.fillStyle = mixH(col, '#3a0a24', 0.45); g.fill();
      poly(g, [[bx, y], [tx, ty], [bx + nx, y + ny]]); g.fillStyle = col; g.fill();
      poly(g, [[bx - nx, y - ny], [tx, ty], [bx + nx, y + ny]]); ink(g, 1);
      g.strokeStyle = rgba(C.hushL, 0.8); g.lineWidth = 0.8; g.beginPath(); g.moveTo(bx + nx * 0.4, y); g.lineTo(tx, ty); g.stroke();
    }
  }
  // cast-iron gas lamp; registers its lanterns for the live glow pass
  const LAMPS = [], CANDLES = [];
  function lampPost(objs, x, y, h = 200, banner = null) {
    LAMPS.push({ x: x - 26, y: y - h + 22, r: 120, col: C.lamp }, { x: x + 26, y: y - h + 22, r: 120, col: C.lamp });
    objs.push({ x: x - 70, y: y - h - 40, w: 140, h: h + 50, draw(g) {
      const top = y - h;
      // post: fluted shaft with a heavy plinth (inked silhouette, moon rim on the right)
      poly(g, [[x - 11, y], [x - 8, y - 26], [x - 4, y - 32], [x - 3.5, top + 30], [x + 3.5, top + 30], [x + 4, y - 32], [x + 8, y - 26], [x + 11, y]]);
      g.fillStyle = '#1b1f33'; g.fill(); ink(g, 1.6);
      g.fillStyle = rgba(C.moon, 0.45); g.fillRect(x + 2, top + 32, 1.3, h - 64);
      // crossbar with scrolls
      g.beginPath(); g.moveTo(x - 30, top + 14); g.quadraticCurveTo(x, top + 4, x + 30, top + 14); g.lineWidth = 3.4; g.strokeStyle = '#1b1f33'; g.stroke();
      g.beginPath(); g.arc(x - 12, top + 22, 6, 0, PI * 1.6); g.arc(x + 12, top + 22, 6, PI * 1.4, PI * 3); g.lineWidth = 1.6; g.stroke();
      for (const sx of [-26, 26]) {
        const lx = x + sx, ly = top + 14;
        poly(g, [[lx - 9, ly + 4], [lx + 9, ly + 4], [lx + 6, ly + 22], [lx - 6, ly + 22]]); g.fillStyle = '#ffd796'; g.fill(); ink(g, 1.4);
        g.fillStyle = '#fff3d0'; g.fillRect(lx - 2, ly + 8, 4, 9);
        poly(g, [[lx - 11, ly + 4], [lx, ly - 6], [lx + 11, ly + 4]]); g.fillStyle = '#151827'; g.fill(); ink(g, 1.2);
        g.fillStyle = '#151827'; g.fillRect(lx - 7, ly + 22, 14, 3);
      }
      // finial
      g.beginPath(); g.moveTo(x, top - 14); g.lineTo(x + 4, top + 4); g.lineTo(x - 4, top + 4); g.closePath(); g.fillStyle = '#1b1f33'; g.fill(); ink(g, 1.1);
      if (banner) {
        // hanging opera banner (crimson, gold border, prima-donna silhouette)
        const bx = x + 6, by = top + 46, bw = 44, bh = 96;
        g.fillStyle = '#151827'; g.fillRect(bx - 2, by - 3, bw + 10, 4);
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bw, by); g.lineTo(bx + bw, by + bh); g.lineTo(bx + bw / 2, by + bh - 12); g.lineTo(bx, by + bh); g.closePath();
        g.fillStyle = banner; g.fill(); ink(g, 1.4);
        g.strokeStyle = rgba(C.goldL, 0.8); g.lineWidth = 1; g.strokeRect(bx + 4, by + 4, bw - 8, bh - 22);
        g.fillStyle = rgba(C.goldL, 0.85); g.beginPath(); g.arc(bx + bw / 2, by + 24, 6, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(bx + bw / 2 - 5, by + 30); g.quadraticCurveTo(bx + bw / 2 - 14, by + 60, bx + bw / 2 - 12, by + 72); g.lineTo(bx + bw / 2 + 12, by + 72); g.quadraticCurveTo(bx + bw / 2 + 14, by + 60, bx + bw / 2 + 5, by + 30); g.fill();
        g.font = '700 9px "Noto Serif TC", serif'; g.textAlign = 'center'; g.fillText('露塞特', bx + bw / 2, by + 84);
      }
    } });
  }
  function moorPole(objs, x, y, h, col = '#b23a3a', capCol = '#e8e0cc') {
    objs.push({ x: x - 14, y: y - h - 14, w: 28, h: h + 60, draw(g) {
      g.save(); g.beginPath(); g.rect(x - 6, y - h, 12, h + 40); g.clip();
      g.fillStyle = '#d9d2c2'; g.fillRect(x - 6, y - h, 12, h + 40);
      g.fillStyle = col; for (let yy = y - h + 6; yy < y + 40; yy += 22) { poly(g, [[x - 6, yy], [x + 6, yy - 9], [x + 6, yy + 2], [x - 6, yy + 11]]); g.fill(); }
      g.fillStyle = 'rgba(20,20,48,0.45)'; g.fillRect(x - 6, y - h, 5, h + 40);
      g.restore();
      g.beginPath(); g.rect(x - 6, y - h, 12, h + 40); ink(g, 1.4);
      g.beginPath(); g.ellipse(x, y - h, 8, 5, 0, 0, TAU); g.fillStyle = capCol; g.fill(); ink(g, 1.2);
      g.fillStyle = 'rgba(40,70,50,0.8)'; g.fillRect(x - 6, y - 8, 12, 8); // algae line
    } });
  }

  /* =============================== PARALLAX: FAR (moonlit lake + Lyra skyline + the Ladder) =============================== */
  function farPiece(g, rr, x, w, h, col, kind) {
    g.fillStyle = col; g.beginPath();
    if (kind === 'dome') {
      const dr = w * 0.42, cx = x + w / 2, dt = -h * 0.55;
      g.moveTo(x, 2); g.lineTo(x, -h * 0.45); g.lineTo(cx - dr, -h * 0.45); g.lineTo(cx - dr, dt + 6); g.arc(cx, dt, dr, PI, 0); g.lineTo(cx + dr, -h * 0.45); g.lineTo(x + w, -h * 0.45); g.lineTo(x + w, 2);
      g.fill(); g.fillRect(cx - 1.5, dt - dr - 14, 3, 16); g.fillRect(cx - 4, dt - dr - 4, 8, 5);
    } else if (kind === 'campanile') {
      g.moveTo(x, 2); g.lineTo(x, -h); g.lineTo(x + w / 2, -h - w * 1.5); g.lineTo(x + w, -h); g.lineTo(x + w, 2); g.fill();
    } else if (kind === 'spire') {
      g.moveTo(x, 2); g.lineTo(x, -h * 0.6); g.lineTo(x + w / 2, -h); g.lineTo(x + w, -h * 0.6); g.lineTo(x + w, 2); g.fill();
    } else {
      g.moveTo(x, 2); g.lineTo(x, -h); for (let k = x; k < x + w - 4; k += 6) { g.lineTo(k + 1, -h - 3); g.lineTo(k + 4, -h - 3); g.lineTo(k + 5, -h); } g.lineTo(x + w, -h); g.lineTo(x + w, 2); g.fill();
    }
  }
  function genFar(WK) {
    const rng = U.mulberry32(4404), objs = [], X0 = -800, X1 = 1600;
    const P = WK.P;
    // the lake: a black mirror from the horizon down
    objs.push({ x: X0, y: -2, w: X1 - X0, h: 720, draw(g) {
      const gr = g.createLinearGradient(0, 0, 0, 240);
      gr.addColorStop(0, '#5f7cab'); gr.addColorStop(0.03, '#2b4170'); gr.addColorStop(0.25, '#141f3e'); gr.addColorStop(1, '#060915');
      g.fillStyle = gr; g.fillRect(this.x, 0, this.w, 720);
    } });
    // distant hills behind the city
    objs.push({ x: X0, y: -150, w: X1 - X0, h: 160, draw(g) {
      for (const [col, amp, off, sc] of [['#3a4f7e', 70, 0, 0.007], ['#2f416c', 45, 2, 0.013]]) {
        g.fillStyle = col; g.beginPath(); g.moveTo(X0, 4);
        for (let x = X0; x <= X1; x += 12) g.lineTo(x, -30 - amp * (0.55 + 0.45 * Math.sin(x * sc + off)) - 14 * Math.sin(x * 0.041 + off));
        g.lineTo(X1, 4); g.closePath(); g.fill();
      }
    } });
    // skyline in two rows (back = hazier), each piece reflected in the lake
    for (const row of [0, 1]) {
      let x = X0;
      while (x < X1) {
        const r = rng(), kind = r < 0.16 ? 'dome' : r < 0.32 ? 'campanile' : r < 0.4 ? 'spire' : 'block';
        const w = kind === 'campanile' ? 10 + rng() * 8 : kind === 'dome' ? 50 + rng() * 40 : 24 + rng() * 50;
        const h = (kind === 'campanile' ? 110 + rng() * 110 : kind === 'dome' ? 70 + rng() * 60 : kind === 'spire' ? 90 + rng() * 90 : 30 + rng() * 60) * (row ? 0.85 : 1);
        const t = Math.min(0.3, tintAt(x / 0.08));
        const col = row ? mixH(P('far', t), '#151b38', 0.35) : mixH(P('far', t), P('skyLow', t), 0.35);
        const bx = x, seed = rng() * 1e6, lit = rng() < 0.4;
        objs.push({ x: bx - 4, y: -h - 80, w: w + 8, h: h + 80 + h * 0.7 + 10, draw(g) {
          const rr = U.mulberry32(seed | 0);
          farPiece(g, rr, bx, w, h, col, kind);
          g.fillStyle = rgba(C.moon, row ? 0.22 : 0.35); g.fillRect(bx + w - 1.6, -h, 1.6, h); // moon rim
          if (lit) { g.fillStyle = 'rgba(255,200,120,0.75)'; for (let k = 0; k < 3; k++) g.fillRect(bx + 3 + rr() * (w - 6), -h * (0.2 + rr() * 0.6), 1.6, 2.2); }
          // reflection: squashed, darker, broken by ripple gaps
          g.save(); g.scale(1, -0.68); g.globalAlpha = row ? 0.3 : 0.42; farPiece(g, rr, bx, w, h, mixH(col, '#0b1024', 0.45), kind); g.restore();
        } });
        x += w * (row ? 0.7 + rng() * 0.6 : 0.9 + rng() * 1.2);
      }
    }
    // the Cantata Ladder, a thread of light across the lake — where the river lift leads
    const LX = 760;
    objs.push({ x: LX - 60, y: -1500, w: 120, h: 1700, draw(g) {
      g.fillStyle = 'rgba(190,206,240,0.55)'; g.fillRect(LX - 1.5, -1500, 3, 1500);
      g.fillStyle = 'rgba(190,206,240,0.35)'; g.fillRect(LX - 5, -60, 10, 60);
      g.strokeStyle = 'rgba(190,206,240,0.45)'; g.lineWidth = 2; g.beginPath(); g.ellipse(LX, -520, 38, 6, 0, 0, TAU); g.stroke();
      for (let y = -40; y > -1500; y -= 70) { g.fillStyle = y % 140 === 0 ? 'rgba(255,90,120,0.8)' : 'rgba(220,235,255,0.7)'; g.fillRect(LX - 1.5, y, 3, 3); }
      g.fillStyle = 'rgba(190,206,240,0.18)'; g.fillRect(LX - 1, 2, 2, 120);
    } });
    // ripple lines + mist on the waterline
    objs.push({ x: X0, y: -30, w: X1 - X0, h: 300, draw(g) {
      const rr = U.mulberry32(77);
      for (let y = 4, k = 0; y < 230; y += 3 + k * 0.9, k++) {
        g.fillStyle = `rgba(175,200,240,${Math.max(0.03, 0.2 - k * 0.008)})`;
        for (let x = X0 + rr() * 40; x < X1; x += 22 + rr() * 60) g.fillRect(x, y, 6 + rr() * 26, 0.8);
      }
      const mg = g.createLinearGradient(0, -30, 0, 16); mg.addColorStop(0, 'rgba(140,170,220,0)'); mg.addColorStop(0.7, 'rgba(150,180,225,0.28)'); mg.addColorStop(1, 'rgba(150,180,225,0)');
      g.fillStyle = mg; g.fillRect(X0, -30, X1 - X0, 46);
    } });
    return objs;
  }

  /* =============================== PARALLAX: MID (palazzi, campanili, the Drowned Muse, the Opera) =============================== */
  function palazzo(g, rr, x, base, w, h, K, o = {}) {
    const top = base - h, pts = [[x, base + 2], [x, top]];
    const roof = o.roof || 'merlon';
    if (roof === 'merlon') for (let k = x + 2; k < x + w - 10; k += 12) pts.push([k, top], [k + 2, top - 7], [k + 5, top - 10], [k + 8, top - 7], [k + 10, top]);
    else if (roof === 'gable') pts.push([x + w / 2, top - Math.min(60, w * 0.22)]);
    pts.push([x + w, top], [x + w, base + 2]);
    poly(g, pts); g.fillStyle = K.body; g.fill();
    if (o.silhouette) return;
    g.save(); poly(g, pts); g.clip();
    g.fillStyle = K.shade; g.fillRect(x, top - 20, w * 0.2, h + 40);
    g.fillStyle = K.lit; g.fillRect(x + w - Math.max(2.5, w * 0.05), top - 20, Math.max(2.5, w * 0.05), h + 40);
    const fh = o.floor || 30, nW = Math.max(2, Math.floor(w / (o.gap || 20)));
    let row = 0;
    for (let yy = top + 10; yy < base - fh * 0.5; yy += fh, row++) {
      g.fillStyle = K.line; g.fillRect(x, yy - 3, w, 2);
      const nob = row === 1 && h > 120;                          // piano nobile: grouped arched windows + balcony
      const ww = (w / nW) * (nob ? 0.62 : 0.46), wh = fh * (nob ? 0.72 : 0.6);
      for (let c = 0; c < nW; c++) {
        const wx = x + (c + 0.5) * (w / nW) - ww / 2, wy = yy + fh * 0.18;
        archPath(g, wx, wy, ww, wh, o.arch || 'ogee');
        const lit = rr() < (o.litP || 0.05);
        g.fillStyle = lit ? '#ffcf86' : K.win; g.fill();
        if (lit) glow(g, wx + ww / 2, wy + wh / 2, ww * 2.4, '#ffb45c', 0.3);
        g.strokeStyle = rgba(C.moon, 0.28); g.lineWidth = 0.8; g.beginPath(); g.moveTo(wx + ww, wy + wh); g.lineTo(wx + ww, wy + ww * 0.5); g.stroke();
      }
      if (nob) { g.fillStyle = K.line; g.fillRect(x + w * 0.2, yy + fh * 0.18 + wh, w * 0.6, 3); for (let bx = x + w * 0.2; bx < x + w * 0.8; bx += 4) g.fillRect(bx, yy + fh * 0.18 + wh - 6, 1.2, 6); }
    }
    // water stain + algae band at the waterline
    g.fillStyle = 'rgba(20,40,40,0.55)'; g.fillRect(x, base - 10, w, 12);
    g.restore();
    poly(g, pts); ink(g, o.ink || 1.4, o.inkCol || INK);
    // Venetian funnel chimneys
    if (o.chimneys !== false) for (let k = 0; k < (w > 70 ? 2 : 1); k++) {
      const cx = x + w * (0.25 + rr() * 0.5), ct = top - (roof === 'merlon' ? 10 : 0);
      poly(g, [[cx - 3, ct], [cx - 3, ct - 16], [cx - 7, ct - 24], [cx + 7, ct - 24], [cx + 3, ct - 16], [cx + 3, ct]]); g.fillStyle = K.body; g.fill(); ink(g, 1);
    }
  }
  function campanile(g, x, base, w, h, K, rr) {
    const top = base - h, bel = top + 6;
    poly(g, [[x, base + 2], [x, top], [x + w, top], [x + w, base + 2]]); g.fillStyle = K.body; g.fill();
    g.fillStyle = K.shade; g.fillRect(x, top, w * 0.3, h);
    g.fillStyle = K.line; for (let yy = top + 30; yy < base; yy += 26) g.fillRect(x, yy, w, 1.4);
    // belfry: open arches with a bell silhouette
    g.fillStyle = K.win; for (let k = 0; k < 2; k++) { archPath(g, x + 3 + k * (w / 2), bel - 34, w / 2 - 6, 28); g.fill(); }
    g.fillStyle = '#6e5a3a'; g.beginPath(); g.arc(x + w / 2, bel - 14, 4, PI, 0); g.lineTo(x + w / 2 + 5, bel - 8); g.lineTo(x + w / 2 - 5, bel - 8); g.fill();
    poly(g, [[x - 3, bel - 34], [x + w / 2, bel - 34 - w * 1.6], [x + w + 3, bel - 34]]); g.fillStyle = K.body; g.fill(); ink(g, 1.2);
    g.fillStyle = K.lit; g.fillRect(x + w - 2, top - 40, 2, h + 40);
    poly(g, [[x, base + 2], [x, bel - 34], [x + w, bel - 34], [x + w, base + 2]]); ink(g, 1.3);
    // lyre weathervane
    g.strokeStyle = K.body; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + w / 2, bel - 34 - w * 1.6); g.lineTo(x + w / 2, bel - 52 - w * 1.6); g.stroke();
    g.beginPath(); g.arc(x + w / 2, bel - 56 - w * 1.6, 4, 0, PI); g.stroke();
    void rr;
  }
  // a colossal statue of a Muse, drowned to the waist, bowing over her lyre (zone 1 landmark)
  function drawMuse(g, mx, base, t, light) {
    const K = { stone: mixH('#8d9cc4', '#c9d4ee', light), shade: '#3f4a78', deep: '#262c52', lyre: '#5f8f7e', lyreD: '#2c4a44' };
    g.save(); g.translate(mx, base); g.rotate(-0.1);
    // robe torso
    const body = [[-78, 10], [-84, -60], [-70, -130], [-52, -168], [-20, -186], [22, -184], [52, -166], [66, -128], [72, -70], [76, 10]];
    poly(g, body); g.fillStyle = K.stone; g.fill();
    g.save(); poly(g, body); g.clip();
    g.fillStyle = K.shade; poly(g, [[-90, 20], [-90, -200], [-24, -190], [-36, -120], [-20, -40], [-30, 20]]); g.fill();
    g.strokeStyle = rgba(K.deep, 0.8); g.lineWidth = 2.4;
    for (const [a, b, c2] of [[-50, -150, -60], [-30, -140, -42], [10, -150, 20], [40, -120, 52], [-58, -90, -70]]) { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo(c2, (b + 10) / 2, a + (c2 - a) * 2, 12); g.stroke(); }
    g.restore();
    poly(g, body); ink(g, 2.2);
    // head bowed, hair bun + laurel
    g.save(); g.translate(8, -200); g.rotate(0.35);
    g.beginPath(); g.ellipse(0, 0, 22, 26, 0, 0, TAU); g.fillStyle = K.stone; g.fill(); ink(g, 2);
    g.beginPath(); g.ellipse(-8, -6, 20, 22, 0, PI * 0.9, PI * 1.9); g.fillStyle = K.shade; g.fill();
    g.beginPath(); g.ellipse(-18, -14, 12, 11, 0, 0, TAU); g.fillStyle = K.shade; g.fill(); ink(g, 1.6);
    g.strokeStyle = '#4f7a62'; g.lineWidth = 2.4; g.beginPath(); g.arc(0, -4, 21, PI * 1.05, PI * 1.9); g.stroke();
    for (let k = 0; k < 6; k++) { const a = PI * 1.1 + k * 0.14; g.beginPath(); g.ellipse(Math.cos(a) * 22, -4 + Math.sin(a) * 22, 4, 2, a, 0, TAU); g.fillStyle = '#5f8a6c'; g.fill(); }
    g.strokeStyle = rgba(K.deep, 0.9); g.lineWidth = 1.4; g.beginPath(); g.moveTo(8, 6); g.quadraticCurveTo(12, 10, 16, 6); g.stroke(); // closed eye
    g.restore();
    // arm cradling the lyre
    g.beginPath(); g.moveTo(40, -150); g.quadraticCurveTo(70, -120, 46, -84); g.quadraticCurveTo(30, -70, 10, -80); g.lineWidth = 20; g.strokeStyle = INK; g.stroke(); g.lineWidth = 16; g.strokeStyle = K.stone; g.stroke();
    // lyre (verdigris bronze)
    g.save(); g.translate(-8, -96); g.rotate(-0.25);
    g.beginPath(); g.moveTo(-26, 30); g.quadraticCurveTo(-44, -10, -24, -52); g.quadraticCurveTo(-16, -62, -10, -54); g.lineWidth = 7; g.strokeStyle = INK; g.stroke(); g.lineWidth = 4.5; g.strokeStyle = K.lyre; g.stroke();
    g.beginPath(); g.moveTo(26, 30); g.quadraticCurveTo(44, -10, 24, -52); g.quadraticCurveTo(16, -62, 10, -54); g.lineWidth = 7; g.strokeStyle = INK; g.stroke(); g.lineWidth = 4.5; g.strokeStyle = K.lyre; g.stroke();
    g.fillStyle = K.lyreD; g.fillRect(-30, -50, 60, 6); g.fillRect(-28, 26, 56, 8); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(-30, -50, 60, 6); g.strokeRect(-28, 26, 56, 8);
    g.strokeStyle = 'rgba(220,240,230,0.7)'; g.lineWidth = 0.8; for (let k = -15; k <= 15; k += 6) { g.beginPath(); g.moveTo(k, -44); g.lineTo(k * 0.8, 26); g.stroke(); }
    g.restore();
    // a crack and a bloom of Hush crystal on her shoulder
    g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-60, -150); g.lineTo(-44, -120); g.lineTo(-52, -92); g.lineTo(-40, -60); g.stroke();
    hushXtal(g, -54, -160, 30, U.mulberry32(9));
    // moon rim on the right edge
    g.strokeStyle = rgba(C.moon, 0.75); g.lineWidth = 1.6; g.beginPath(); g.moveTo(52, -166); g.lineTo(66, -128); g.lineTo(72, -70); g.stroke();
    g.restore();
    void t;
  }
  // the Grand Opera House of Lyra seen across the square (zone 2 landmark): copper dome with a collapsed flank, golden Apollo
  function drawOperaExt(g, ox, base, hz) {
    const W = 400, top = base - 210, stone = mixH('#5d6890', '#8e98bd', 0.3 * (1 - hz)), stoneD = '#2c3256', cu = '#3f7d78', cuD = '#1f4248', cuL = '#8fd0c0';
    const gold = C.gold, goldL = C.goldL;
    // dome (behind the façade)
    const dx = ox + W / 2, dy = top - 70, R = 104;
    g.fillStyle = stone; g.fillRect(dx - 92, dy, 184, 72); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(dx - 92, dy, 184, 72);
    g.fillStyle = stoneD; for (let k = -80; k <= 80; k += 20) { archPath(g, dx + k - 6, dy + 18, 12, 40); g.fill(); }
    g.beginPath(); g.moveTo(dx - R, dy); g.arc(dx, dy, R, PI, PI * 1.62); g.lineTo(dx + 26, dy - R * 0.62); g.lineTo(dx + 46, dy - R * 0.4); g.lineTo(dx + 60, dy - R * 0.52); g.lineTo(dx + 78, dy - R * 0.28); g.lineTo(dx + R, dy - 12); g.lineTo(dx + R, dy); g.closePath();
    const dg = g.createLinearGradient(dx - R, 0, dx + R, 0); dg.addColorStop(0, cuD); dg.addColorStop(0.32, cuD); dg.addColorStop(0.32, cu); dg.addColorStop(0.82, cu); dg.addColorStop(0.82, cuL); dg.addColorStop(1, cuL);
    g.fillStyle = dg; g.fill(); ink(g, 2);
    // ribs + the broken flank (exposed iron ribs against the sky)
    g.strokeStyle = rgba(INK, 0.75); g.lineWidth = 1.4;
    for (let k = -3; k <= 1; k++) { g.beginPath(); g.ellipse(dx, dy, Math.abs(k) * R * 0.28 + 2, R, 0, PI, PI * 1.5 + (k > 0 ? 0.2 : 0)); g.stroke(); }
    g.strokeStyle = '#1b2236'; g.lineWidth = 2.2;
    for (const [a, l] of [[-1.2, 0.95], [-0.9, 0.88], [-0.6, 0.8], [-0.3, 0.7]]) { g.beginPath(); g.moveTo(dx + Math.cos(a) * R * 0.2, dy); g.quadraticCurveTo(dx + Math.cos(a) * R * 0.75, dy - R * l, dx + Math.cos(a) * R * 0.95, dy - R * l * 0.62); g.stroke(); }
    // inner glow through the hole (stage light still burning)
    glow(g, dx + 55, dy - 26, 70, '#ffb070', 0.35);
    // main block
    poly(g, [[ox, base + 2], [ox, top], [ox + W, top], [ox + W, base + 2]]); g.fillStyle = stone; g.fill();
    g.save(); g.beginPath(); g.rect(ox, top, W, base - top + 2); g.clip();
    g.fillStyle = stoneD; g.fillRect(ox, top, W * 0.16, base - top);
    g.fillStyle = rgba(C.moon, 0.4); g.fillRect(ox + W - 4, top, 4, base - top);
    // arcade (warm light inside) + piano nobile columns + attic band
    for (let k = 0; k < 7; k++) {
      const ax = ox + 34 + k * 49; archPath(g, ax, base - 70, 30, 62); g.fillStyle = '#2a1018'; g.fill();
      g.fillStyle = 'rgba(255,170,90,0.55)'; g.fillRect(ax + 4, base - 34, 22, 26);
      g.fillStyle = stoneD; g.fillRect(ax - 9, top + 50, 6, 84); g.fillRect(ax + 33, top + 50, 6, 84);
      archPath(g, ax + 4, top + 62, 22, 54); g.fillStyle = k === 3 ? '#ffcf86' : '#1d2240'; g.fill();
    }
    g.fillStyle = stoneD; g.fillRect(ox, top + 40, W, 6); g.fillRect(ox, base - 80, W, 7);
    g.fillStyle = rgba(gold, 0.85); g.fillRect(ox, top + 16, W, 3); g.fillRect(ox, top + 146, W, 2);
    for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(ox + 22 + k * 45, top + 28, 6, 0, TAU); g.fillStyle = rgba(gold, 0.8); g.fill(); }
    g.restore();
    poly(g, [[ox, base + 2], [ox, top], [ox + W, top], [ox + W, base + 2]]); ink(g, 2);
    // corner pavilions with small domes
    for (const px of [ox - 14, ox + W - 46]) {
      g.fillStyle = stone; g.fillRect(px, top - 30, 60, 30); g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(px, top - 30, 60, 30);
      g.beginPath(); g.arc(px + 30, top - 30, 26, PI, 0); g.closePath(); g.fillStyle = cu; g.fill(); ink(g, 1.6);
      g.fillStyle = cuL; g.beginPath(); g.arc(px + 30, top - 30, 26, PI * 1.6, 0); g.lineTo(px + 30, top - 30); g.fill();
      g.fillStyle = gold; g.fillRect(px + 28, top - 70, 4, 16);
    }
    // pediment + golden Apollo raising his lyre
    const cx = ox + W / 2;
    poly(g, [[cx - 90, top], [cx, top - 52], [cx + 90, top]]); g.fillStyle = stone; g.fill(); ink(g, 1.8);
    g.fillStyle = stoneD; poly(g, [[cx - 66, top - 6], [cx, top - 40], [cx + 66, top - 6]]); g.fill();
    g.save(); g.translate(cx, top - 52);
    g.fillStyle = gold; g.beginPath(); g.moveTo(-9, 0); g.lineTo(-6, -34); g.lineTo(6, -34); g.lineTo(9, 0); g.closePath(); g.fill(); ink(g, 1.2);
    g.beginPath(); g.arc(0, -40, 6, 0, TAU); g.fill(); ink(g, 1.1);
    g.beginPath(); g.moveTo(4, -30); g.lineTo(18, -58); g.lineWidth = 4; g.strokeStyle = gold; g.stroke();
    g.beginPath(); g.moveTo(10, -58); g.quadraticCurveTo(14, -78, 20, -74); g.moveTo(26, -58); g.quadraticCurveTo(22, -78, 16, -74); g.lineWidth = 3; g.stroke();
    g.fillStyle = goldL; g.fillRect(4, -40, 2, 30);
    g.restore();
    glow(g, cx + 14, top - 110, 60, '#ffe2a0', 0.2);
  }
  function genMid(WK) {
    const rng = U.mulberry32(4471), objs = [], P = WK.P, X0 = -760, X1 = 2300, base = 30;
    objs.push({ x: X0, y: base - 2, w: X1 - X0, h: 720, draw(g) {
      const gr = g.createLinearGradient(0, base, 0, base + 260);
      gr.addColorStop(0, '#22365f'); gr.addColorStop(0.06, '#152447'); gr.addColorStop(0.4, '#0b1229'); gr.addColorStop(1, '#05070f');
      g.fillStyle = gr; g.fillRect(this.x, base, this.w, 720);
    } });
    const K0 = (t, haze) => ({
      body: mixH(P('mid', t), P('fog', t), haze), shade: mixH(P('midDark', t), P('fog', t), haze * 0.6), lit: mixH(C.moon, P('mid', t), 0.35),
      line: rgba(mixH(P('midDark', t), '#000000', 0.2), 0.6), win: mixH(P('midDark', t), '#05060e', 0.5),
    });
    const place = (bx, w, h, kind) => {
      const t = Math.min(0.32, tintAt(bx / 0.22)), K = K0(t, 0.18 + rng() * 0.16), seed = rng() * 1e6;
      const roof = rng() < 0.55 ? 'merlon' : rng() < 0.5 ? 'gable' : 'flat';
      objs.push({ x: bx - 30, y: base - h - 160, w: w + 60, h: h + 160 + h + 40, draw(g) {
        const rr = U.mulberry32(seed | 0);
        if (kind === 'camp') campanile(g, bx, base, w, h, K, rr); else palazzo(g, rr, bx, base, w, h, K, { roof, floor: 28, gap: 18, litP: 0.06 });
        // reflection
        g.save(); g.translate(0, base * 2); g.scale(1, -1); g.globalAlpha = 0.4;
        const Kr = { body: mixH(K.body, '#0a1024', 0.5), shade: '#0a1024', lit: K.lit, line: K.line, win: '#050811' };
        const r2 = U.mulberry32(seed | 0);
        if (kind === 'camp') campanile(g, bx, base, w, h, Kr, r2); else palazzo(g, r2, bx, base, w, h, Kr, { roof, floor: 28, gap: 18, litP: 0.06, chimneys: false, ink: 0.8, inkCol: '#0a0f22' });
        g.restore();
      } });
    };
    let x = X0;
    while (x < X1) {
      // keep the Muse and the Opera clear of clutter
      if (x > 180 && x < 360) { x = 360; continue; }
      if (x > 1140 && x < 1640) { x = 1640; continue; }
      const camp = rng() < 0.16, w = camp ? 22 + rng() * 10 : 60 + rng() * 90, h = camp ? 210 + rng() * 120 : 110 + rng() * 150;
      place(x, w, h, camp ? 'camp' : 'pal');
      // stone bridges between some palazzi (the reflection completes the circle)
      if (!camp && rng() < 0.25) {
        const bx = x + w - 6, bw = 70 + rng() * 40, t = Math.min(0.32, tintAt(bx / 0.22)), K = K0(t, 0.3);
        objs.push({ x: bx - 4, y: base - 40, w: bw + 8, h: 90, draw(g) {
          g.beginPath(); g.moveTo(bx, base - 26); g.quadraticCurveTo(bx + bw / 2, base - 40, bx + bw, base - 26); g.lineTo(bx + bw, base); g.lineTo(bx + bw - 8, base);
          g.arc(bx + bw / 2, base, bw / 2 - 8, 0, PI, true); g.lineTo(bx, base); g.closePath(); g.fillStyle = K.body; g.fill(); ink(g, 1.2);
          g.fillStyle = K.lit; g.fillRect(bx, base - 28, bw, 1.4);
          g.strokeStyle = rgba(mixH(K.body, '#0a1024', 0.4), 0.45); g.lineWidth = 3; g.beginPath(); g.arc(bx + bw / 2, base, bw / 2 - 8, 0, PI); g.stroke();
        } });
      }
      x += w * (0.75 + rng() * 0.6);
    }
    // the Drowned Muse
    objs.push({ x: 120, y: base - 280, w: 300, h: 500, draw(g) {
      drawMuse(g, 270, base + 8, 0, 0.3);
      g.save(); g.translate(0, base * 2 + 16); g.scale(1, -0.8); g.globalAlpha = 0.32; drawMuse(g, 270, base + 8, 0, 0); g.restore();
    } });
    // the Grand Opera House across the square
    objs.push({ x: 1180, y: base - 420, w: 460, h: 700, draw(g) {
      drawOperaExt(g, 1215, base - 10, 0.1);
      g.save(); g.translate(0, base * 2); g.scale(1, -0.75); g.globalAlpha = 0.3; drawOperaExt(g, 1215, base - 10, 0.6); g.restore();
    } });
    // ripples over every reflection + mist band on the waterline
    objs.push({ x: X0, y: base - 40, w: X1 - X0, h: 340, draw(g) {
      const rr = U.mulberry32(901);
      for (let y = base + 3, k = 0; y < base + 280; y += 3.2 + k * 1.1, k++) {
        g.fillStyle = `rgba(14,22,48,${0.55})`; g.fillRect(X0, y, X1 - X0, 1.2);
        g.fillStyle = `rgba(170,198,240,${Math.max(0.03, 0.18 - k * 0.007)})`;
        for (let xx = X0 + rr() * 30; xx < X1; xx += 30 + rr() * 70) g.fillRect(xx, y + 1.2, 8 + rr() * 30, 0.9);
      }
      const mg = g.createLinearGradient(0, base - 40, 0, base + 30); mg.addColorStop(0, 'rgba(130,160,215,0)'); mg.addColorStop(0.75, 'rgba(140,170,220,0.32)'); mg.addColorStop(1, 'rgba(140,170,220,0)');
      g.fillStyle = mg; g.fillRect(X0, base - 40, X1 - X0, 70);
    } });
    return objs;
  }

  /* =============================== PARALLAX: NEAR (canal houses, bridges, poles, gondolas → the square's arcades) =============================== */
  function canalHouse(g, rr, x, base, w, h, K) {
    const top = base - h, roofH = 14 + rr() * 16;
    const pts = [[x, base + 2], [x, top], [x - 6, top], [x + w / 2, top - roofH], [x + w + 6, top], [x + w, top], [x + w, base + 2]];
    poly(g, pts); g.fillStyle = K.body; g.fill();
    g.save(); poly(g, pts); g.clip();
    g.fillStyle = K.shade; g.fillRect(x - 6, top - roofH, w * 0.24 + 6, h + roofH + 10);
    g.fillStyle = K.roof; poly(g, [[x - 6, top], [x + w / 2, top - roofH], [x + w + 6, top], [x + w + 6, top + 5], [x - 6, top + 5]]); g.fill();
    g.fillStyle = K.lit; g.fillRect(x + w - 3, top, 3, h);
    // floors of shuttered windows
    const nW = Math.max(1, Math.floor(w / 34)), fh = 46;
    for (let yy = top + 16; yy < base - 60; yy += fh) {
      g.fillStyle = K.line; g.fillRect(x, yy + fh - 6, w, 2);
      for (let c = 0; c < nW; c++) {
        const ww = 16, wx = x + (c + 0.5) * (w / nW) - ww / 2, wy = yy + 4, wh = 26;
        archPath(g, wx, wy, ww, wh, 'round'); const lit = rr() < 0.08; g.fillStyle = lit ? '#ffcf86' : K.win; g.fill();
        if (lit) glow(g, wx + ww / 2, wy + wh / 2, 40, '#ffb45c', 0.28);
        if (!lit && rr() < 0.7) { g.fillStyle = K.shutter; g.fillRect(wx - 6, wy + 6, 5, wh - 6); g.fillRect(wx + ww + 1, wy + 6, 5, wh - 6); }
        g.fillStyle = K.sill; g.fillRect(wx - 3, wy + wh, ww + 6, 2.5);
      }
      if (rr() < 0.3) { // iron balcony
        const bw = Math.min(w - 16, 46), bx = x + (w - bw) / 2, by = yy + 32;
        g.fillStyle = INK; g.fillRect(bx, by, bw, 2.5); for (let k = bx; k <= bx + bw; k += 5) g.fillRect(k, by - 12, 1.2, 12); g.fillRect(bx, by - 12, bw, 1.6);
      }
    }
    // water door with steps sinking into the canal
    archPath(g, x + w * 0.5 - 13, base - 48, 26, 50); g.fillStyle = '#060812'; g.fill();
    g.fillStyle = K.sill; g.fillRect(x + w * 0.5 - 17, base - 6, 34, 3); g.fillRect(x + w * 0.5 - 20, base - 2, 40, 3);
    g.fillStyle = 'rgba(26,52,44,0.85)'; g.fillRect(x, base - 14, w, 16);
    g.fillStyle = 'rgba(80,120,90,0.5)'; for (let k = 0; k < w; k += 3) g.fillRect(x + k, base - 14 - rr() * 6, 1.5, 6);
    g.restore();
    poly(g, pts); ink(g, 2.2);
    // wall lantern
    if (rr() < 0.45) {
      const lx = x + (rr() < 0.5 ? 10 : w - 10), ly = base - 80 - rr() * 40;
      glow(g, lx, ly, 46, '#ffb45c', 0.42);
      g.fillStyle = INK; g.fillRect(lx - 1, ly - 14, 2, 8); g.fillStyle = '#ffd890'; g.fillRect(lx - 4, ly - 6, 8, 10); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(lx - 4, ly - 6, 8, 10);
    }
  }
  function gondola(g, x, y, s = 1, tilt = 0) {
    g.save(); g.translate(x, y); g.rotate(tilt); g.scale(s, s);
    g.beginPath(); g.moveTo(-80, -10); g.quadraticCurveTo(-60, 6, 0, 6); g.quadraticCurveTo(60, 6, 78, -14); g.quadraticCurveTo(86, -30, 92, -40);
    g.lineTo(88, -40); g.quadraticCurveTo(70, -14, 0, -6); g.quadraticCurveTo(-60, -6, -86, -22); g.closePath(); g.fillStyle = '#0d0f1c'; g.fill(); ink(g, 1.6);
    g.strokeStyle = rgba(C.moon, 0.55); g.lineWidth = 1.2; g.beginPath(); g.moveTo(-70, -9); g.quadraticCurveTo(0, -2, 70, -14); g.stroke();
    // ferro (the comb prow)
    g.fillStyle = '#c9cfdc'; g.beginPath(); g.moveTo(86, -40); g.lineTo(96, -62); g.lineTo(100, -60); g.lineTo(94, -38); g.closePath(); g.fill(); ink(g, 1);
    for (let k = 0; k < 4; k++) g.fillRect(93 - k * 1.5, -52 + k * 4, 6, 1.6);
    g.restore();
  }
  function arcadeBlock(g, rr, x, base, w, h, K) {
    const top = base - h;
    poly(g, [[x, base + 2], [x, top], [x + w, top], [x + w, base + 2]]); g.fillStyle = K.body; g.fill();
    g.save(); g.beginPath(); g.rect(x, top - 40, w, h + 50); g.clip();
    g.fillStyle = K.shade; g.fillRect(x, top, w * 0.18, h);
    const n = Math.max(2, Math.floor(w / 46)), aw = w / n;
    for (let k = 0; k < n; k++) {
      const ax = x + k * aw; archPath(g, ax + 8, base - 86, aw - 16, 86); g.fillStyle = '#0b0c18'; g.fill();
      g.fillStyle = K.shade; g.fillRect(ax + 2, base - 90, 6, 90);
      archPath(g, ax + aw * 0.3, top + 30, aw * 0.4, 46); g.fillStyle = rr() < 0.1 ? '#ffcf86' : K.win; g.fill();
      archPath(g, ax + aw * 0.33, top + 96, aw * 0.34, 34); g.fillStyle = K.win; g.fill();
    }
    g.fillStyle = K.line; g.fillRect(x, base - 96, w, 5); g.fillRect(x, top + 84, w, 3); g.fillRect(x, top + 6, w, 4);
    g.fillStyle = K.lit; g.fillRect(x + w - 3, top, 3, h);
    g.restore();
    poly(g, [[x, base + 2], [x, top], [x + w, top], [x + w, base + 2]]); ink(g, 2);
    // balustrade + statues on the roofline
    g.fillStyle = K.body; g.fillRect(x, top - 12, w, 12); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(x, top - 12, w, 12);
    g.fillStyle = K.shade; for (let k = x + 4; k < x + w - 4; k += 7) g.fillRect(k, top - 9, 3, 7);
    for (let k = 0; k < Math.floor(w / 80); k++) {
      const sx = x + 30 + k * 80;
      g.fillStyle = K.body; g.fillRect(sx - 6, top - 18, 12, 6);
      g.beginPath(); g.moveTo(sx - 5, top - 18); g.lineTo(sx - 4, top - 44); g.quadraticCurveTo(sx, top - 56, sx + 4, top - 44); g.lineTo(sx + 5, top - 18); g.closePath(); g.fill(); ink(g, 1.2);
      g.beginPath(); g.arc(sx, top - 50, 4, 0, TAU); g.fill(); ink(g, 1);
    }
  }
  function genNear(WK) {
    const rng = U.mulberry32(4499), objs = [], P = WK.P, base = 40, f = 0.45, X0 = -720, X1 = 7300 * f + 700;
    const PX0 = PLAZA_X * f - 40;  // the square's pavement starts here (world 3700)
    // canal water (boulevard) / pavement (square)
    objs.push({ x: X0, y: base - 2, w: PX0 - X0 + 10, h: 720, draw(g) {
      const gr = g.createLinearGradient(0, base, 0, base + 220); gr.addColorStop(0, '#1d2c52'); gr.addColorStop(0.08, '#0f1733'); gr.addColorStop(1, '#04060c');
      g.fillStyle = gr; g.fillRect(this.x, base, this.w, 720);
    } });
    objs.push({ x: PX0, y: base - 2, w: X1 - PX0, h: 720, draw(g) {
      g.fillStyle = '#1c1f36'; g.fillRect(PX0, base, X1 - PX0, 720);
      g.fillStyle = '#3a3f62'; g.fillRect(PX0, base, X1 - PX0, 4);
      g.strokeStyle = 'rgba(8,8,20,0.6)'; g.lineWidth = 1; for (let xx = PX0; xx < X1; xx += 38) { g.beginPath(); g.moveTo(xx, base + 4); g.lineTo(xx - 30, base + 40); g.stroke(); }
    } });
    let x = X0;
    while (x < X1) {
      const wx = x / f, t = tintAt(wx);
      const plaza = x > PX0 + 20;
      if (wx > FACADE + 900) break;
      const K = {
        body: mixH(P('near', t), ['#3a3550', '#30405a', '#3f3248', '#2c3f4a'][Math.floor(rng() * 4)], 0.45), shade: P('nearDark', t), lit: mixH(C.moon, P('near', t), 0.45),
        roof: mixH('#3a2630', P('nearDark', t), 0.4), line: rgba('#05060e', 0.55), win: '#06070f', shutter: mixH('#2f5048', P('nearDark', t), 0.4), sill: mixH(P('near', t), '#9aa6c8', 0.25),
      };
      const seed = rng() * 1e6, bx = x;
      if (!plaza) {
        const w = 70 + rng() * 80, h = 190 + rng() * 170;
        if (rng() < 0.18) { x += 60 + rng() * 60; continue; }   // open canal view
        objs.push({ x: bx - 30, y: base - h - 60, w: w + 60, h: h + 60 + h + 60, draw(g) {
          const rr = U.mulberry32(seed | 0); canalHouse(g, rr, bx, base, w, h, K);
          g.save(); g.translate(0, base * 2); g.scale(1, -1); g.globalAlpha = 0.33;
          const r2 = U.mulberry32(seed | 0); canalHouse(g, r2, bx, base, w, h, { body: '#0b1024', shade: '#060914', lit: '#2a3a5c', roof: '#0b1024', line: 'rgba(0,0,0,0.3)', win: '#04060c', shutter: '#0b1024', sill: '#141b34' });
          g.restore();
        } });
        // laundry line to the next house, poles + moored gondolas in the canal
        if (rng() < 0.4) { const lx = bx + w, ly = base - h * (0.4 + rng() * 0.3), ln = 50 + rng() * 40, s2 = rng() * 1e5;
          objs.push({ x: lx - 5, y: ly - 5, w: ln + 10, h: 70, draw(g) {
            const r3 = U.mulberry32(s2 | 0); g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(lx, ly); g.quadraticCurveTo(lx + ln / 2, ly + 18, lx + ln, ly); g.stroke();
            for (let k = 0.2; k < 0.9; k += 0.22) { const cx = lx + ln * k, cy = ly + 18 * 4 * k * (1 - k) * 0.5 + 2; g.fillStyle = ['#c9c2b0', '#7a3a46', '#3a5a6a', '#d0b070'][Math.floor(r3() * 4)]; g.fillRect(cx - 5, cy, 10, 12 + r3() * 8); g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(cx - 5, cy, 10, 12); }
          } }); }
        if (rng() < 0.45) { const px = bx + w + 10 + rng() * 30; moorPole(objs, px, base + 4, 70 + rng() * 40, rng() < 0.5 ? '#9a3434' : '#2f5a8a'); }
        if (rng() < 0.22) { const gx = bx + w * 0.5, s3 = 0.6 + rng() * 0.2, tl = (rng() - 0.5) * 0.05; objs.push({ x: gx - 80, y: base - 60, w: 170, h: 90, draw(g) { gondola(g, gx, base + 4, s3, tl); } }); }
        x += w + (rng() < 0.3 ? 30 + rng() * 60 : 0);
      } else {
        const w = 160 + rng() * 140, h = 230 + rng() * 80;
        objs.push({ x: bx - 10, y: base - h - 70, w: w + 20, h: h + 80, draw(g) { const rr = U.mulberry32(seed | 0); arcadeBlock(g, rr, bx, base, w, h, K); } });
        x += w + 40 + rng() * 80;
      }
    }
    return objs;
  }

  /* =============================== INTERIOR ROOMS (custom parallax, clipped to their doorframes) =============================== */
  function column(g, x, base, w, h, K) {
    // fluted marble shaft, gilded capital and base (3 hard cel tones + gold)
    const top = base - h;
    g.fillStyle = K.marble; g.fillRect(x, top + 30, w, h - 52);
    g.fillStyle = K.marbleD; g.fillRect(x, top + 30, w * 0.28, h - 52);
    g.fillStyle = K.marbleL; g.fillRect(x + w * 0.72, top + 30, w * 0.14, h - 52);
    g.strokeStyle = rgba(INK, 0.35); g.lineWidth = 1; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(x + (w * k) / 6, top + 32); g.lineTo(x + (w * k) / 6, base - 24); g.stroke(); }
    g.beginPath(); g.rect(x, top + 30, w, h - 52); ink(g, 1.6);
    // capital (corinthian-ish scrolls) and base
    poly(g, [[x - 12, top + 30], [x - 18, top + 6], [x + w + 18, top + 6], [x + w + 12, top + 30]]); g.fillStyle = K.gold; g.fill(); ink(g, 1.5);
    g.fillStyle = K.goldD; g.beginPath(); g.arc(x - 8, top + 14, 7, 0, TAU); g.arc(x + w + 8, top + 14, 7, 0, TAU); g.fill();
    g.fillStyle = K.goldL; g.fillRect(x - 16, top + 6, w + 32, 3);
    g.fillStyle = K.gold; g.fillRect(x - 22, top - 4, w + 44, 10); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(x - 22, top - 4, w + 44, 10);
    g.fillStyle = K.marbleD; g.fillRect(x - 10, base - 24, w + 20, 24); g.fillStyle = K.gold; g.fillRect(x - 10, base - 24, w + 20, 4); g.strokeRect(x - 10, base - 24, w + 20, 24);
  }
  function drape(g, x0, x1, y, sag, K, tassel = true) {
    // red velvet swag with folds and gold fringe
    const m = (x0 + x1) / 2;
    g.beginPath(); g.moveTo(x0, y - 8); g.quadraticCurveTo(m, y + sag * 0.55, x1, y - 8); g.lineTo(x1, y + 16); g.quadraticCurveTo(m, y + sag + 22, x0, y + 16); g.closePath();
    g.fillStyle = K.velvet; g.fill();
    g.save(); g.clip();
    g.strokeStyle = K.velvetD; g.lineWidth = 5; for (let k = 0.15; k < 0.9; k += 0.17) { g.beginPath(); g.moveTo(x0 + (x1 - x0) * k, y - 8); g.quadraticCurveTo(m, y + sag * 0.5 + 10, x0 + (x1 - x0) * (k + 0.05), y + sag + 30); g.stroke(); }
    g.strokeStyle = K.velvetL; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y - 4); g.quadraticCurveTo(m, y + sag * 0.55 + 4, x1, y - 4); g.stroke();
    g.restore();
    g.beginPath(); g.moveTo(x0, y - 8); g.quadraticCurveTo(m, y + sag * 0.55, x1, y - 8); g.lineTo(x1, y + 16); g.quadraticCurveTo(m, y + sag + 22, x0, y + 16); g.closePath(); ink(g, 1.6);
    g.strokeStyle = K.gold; g.lineWidth = 3; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(x1, y + 16); g.quadraticCurveTo(m, y + sag + 22, x0, y + 16); g.stroke(); g.setLineDash([]);
    if (tassel) for (const tx of [x0, x1]) {
      g.strokeStyle = K.gold; g.lineWidth = 1.6; g.beginPath(); g.moveTo(tx, y); g.lineTo(tx, y + 40); g.stroke();
      poly(g, [[tx - 5, y + 40], [tx + 5, y + 40], [tx + 8, y + 64], [tx - 8, y + 64]]); g.fillStyle = K.gold; g.fill(); ink(g, 1);
      g.beginPath(); g.arc(tx, y + 38, 4, 0, TAU); g.fill(); ink(g, 1);
    }
  }
  function chandelierShape(g, x, y, s, K, lit) {
    // hanging crystal chandelier: gilded hoops, candles, drops
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = K.goldD; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -200); g.lineTo(0, -40); g.stroke();
    for (const [ry, rx] of [[-30, 34], [0, 62], [26, 44]]) {
      g.beginPath(); g.ellipse(0, ry, rx, rx * 0.22, 0, 0, TAU); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); g.lineWidth = 2.4; g.strokeStyle = K.gold; g.stroke();
      for (let k = -rx; k <= rx; k += rx / 3) {
        g.fillStyle = 'rgba(220,235,255,0.75)'; poly(g, [[k - 2, ry + 3], [k + 2, ry + 3], [k, ry + 14]]); g.fill();
        if (lit) { g.fillStyle = '#fff1c8'; g.fillRect(k - 1.5, ry - 12, 3, 9); }
      }
    }
    g.beginPath(); g.moveTo(-8, 36); g.lineTo(0, 64); g.lineTo(8, 36); g.closePath(); g.fillStyle = K.gold; g.fill(); ink(g, 1.2);
    if (lit) glow(g, 0, 0, 120, '#ffcf86', 0.28);
    g.restore();
  }
  // foyer: far wall (f .3) = crimson damask, gilded pilasters, arched mirrors, a painted vault; near (f .6) = marble colonnade + drapes
  function genFoyerFar() {
    const objs = [], X0 = 1350, X1 = 3450, rng = U.mulberry32(6106);
    const K = { marble: '#6e5a5e', marbleD: '#3a2630', marbleL: '#a8948c', gold: '#9a7330', goldD: '#4e3416', goldL: '#e6c070', velvet: '#5e1020', velvetD: '#2e0610', velvetL: '#8a2433' };
    objs.push({ x: X0, y: -1300, w: X1 - X0, h: 2000, draw(g) {
      // damask wall with a woven lozenge pattern
      g.fillStyle = '#3a0a16'; g.fillRect(X0, -1300, X1 - X0, 1300);
      g.fillStyle = 'rgba(120,30,50,0.35)';
      for (let y = -1280; y < 0; y += 28) for (let x = X0 + ((y / 28) % 2 ? 14 : 0); x < X1; x += 28) { poly(g, [[x, y - 6], [x + 6, y], [x, y + 6], [x - 6, y]]); g.fill(); }
      // floor: dark polished marble with warm reflections
      const fg = g.createLinearGradient(0, 0, 0, 160); fg.addColorStop(0, '#2a1416'); fg.addColorStop(1, '#0c0507'); g.fillStyle = fg; g.fillRect(X0, 0, X1 - X0, 700);
      g.fillStyle = '#6e4a1c'; g.fillRect(X0, -4, X1 - X0, 5);
    } });
    for (let x = X0 + 40; x < X1; x += 190) {
      const bx = x, seed = rng() * 1e5;
      objs.push({ x: bx - 40, y: -760, w: 230, h: 780, draw(g) {
        const rr = U.mulberry32(seed | 0);
        // arched mirror between pilasters: smoky glass, diagonal sheen, candle sconces either side
        const mx = bx + 40, mw = 92, my = -330, mh = 300;
        archPath(g, mx - 8, my - 8, mw + 16, mh + 8); g.fillStyle = K.gold; g.fill(); ink(g, 1.4);
        archPath(g, mx, my, mw, mh); const mg = g.createLinearGradient(mx, my, mx + mw, my + mh); mg.addColorStop(0, '#2c2632'); mg.addColorStop(0.5, '#4a3c4c'); mg.addColorStop(1, '#1a141c');
        g.fillStyle = mg; g.fill();
        g.save(); archPath(g, mx, my, mw, mh); g.clip(); g.fillStyle = 'rgba(255,230,200,0.12)'; poly(g, [[mx + 10, my + mh], [mx + 40, my], [mx + 56, my], [mx + 26, my + mh]]); g.fill();
        if (rr() < 0.5) { g.strokeStyle = 'rgba(10,6,10,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(mx + mw * 0.3, my + 60); g.lineTo(mx + mw * 0.5, my + 110); g.lineTo(mx + mw * 0.45, my + 170); g.moveTo(mx + mw * 0.5, my + 110); g.lineTo(mx + mw * 0.75, my + 130); g.stroke(); }
        g.restore();
        for (const sx of [mx - 18, mx + mw + 18]) { g.fillStyle = K.gold; g.fillRect(sx - 2, -200, 4, 26); g.fillStyle = '#fff1c8'; g.fillRect(sx - 1.5, -214, 3, 10); glow(g, sx, -212, 30, '#ffc070', 0.45); }
        // pilaster
        g.fillStyle = K.marbleD; g.fillRect(bx - 22, -620, 30, 620); g.fillStyle = K.marble; g.fillRect(bx - 14, -620, 18, 620); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(bx - 22, -620, 30, 620);
        g.fillStyle = K.gold; g.fillRect(bx - 28, -640, 42, 22); g.fillRect(bx - 26, -22, 38, 22); g.strokeRect(bx - 28, -640, 42, 22);
      } });
    }
    // entablature + painted vault
    objs.push({ x: X0, y: -1300, w: X1 - X0, h: 700, draw(g) {
      g.fillStyle = K.goldD; g.fillRect(X0, -660, X1 - X0, 30); g.fillStyle = K.gold; g.fillRect(X0, -660, X1 - X0, 8); g.fillRect(X0, -640, X1 - X0, 3);
      const vg = g.createLinearGradient(0, -1300, 0, -660); vg.addColorStop(0, '#1a0a14'); vg.addColorStop(1, '#3a2030'); g.fillStyle = vg; g.fillRect(X0, -1300, X1 - X0, 640);
      const rr = U.mulberry32(66);
      for (let x = X0; x < X1; x += 260) {
        g.save(); g.beginPath(); g.ellipse(x + 130, -760, 120, 90, 0, PI, 0); g.closePath(); g.clip();
        const fg = g.createLinearGradient(0, -850, 0, -660); fg.addColorStop(0, '#2c3a64'); fg.addColorStop(1, '#a86a5a'); g.fillStyle = fg; g.fillRect(x, -860, 260, 200);
        g.fillStyle = 'rgba(240,210,190,0.35)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + 40 + rr() * 180, -720 - rr() * 80, 30 + rr() * 30, 12 + rr() * 8, 0, 0, TAU); g.fill(); }
        g.restore();
        g.beginPath(); g.ellipse(x + 130, -760, 120, 90, 0, PI, 0); g.lineWidth = 8; g.strokeStyle = K.gold; g.stroke(); g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke();
      }
    } });
    for (let x = X0 + 200; x < X1; x += 520) objs.push({ x: x - 80, y: -900, w: 160, h: 360, draw(g) { chandelierShape(g, x, -620, 0.8, K, true); } });
    return objs;
  }
  function genFoyerNear() {
    const objs = [], X0 = 3350, X1 = 6150, rng = U.mulberry32(6161);
    const K = { marble: '#8a7a78', marbleD: '#4a3440', marbleL: '#d8c8b8', gold: '#b8862e', goldD: '#5a3a14', goldL: '#ffe08a', velvet: '#6e1022', velvetD: '#34060f', velvetL: '#a82a3a' };
    const cols = [];
    for (let x = X0; x < X1; x += 360 + rng() * 80) cols.push(x);
    cols.forEach((x, i) => {
      objs.push({ x: x - 30, y: -900, w: 140, h: 920, draw(g) { column(g, x, 0, 78, 860, K); } });
      if (i < cols.length - 1) {
        const x2 = cols[i + 1];
        objs.push({ x: x + 40, y: -880, w: x2 - x, h: 260, draw(g) { drape(g, x + 78, x2, -830, 120, K); } });
        const sx = (x + 78 + x2) / 2, kind = i % 3;
        if (kind === 0) objs.push({ x: sx - 50, y: -300, w: 100, h: 310, draw(g) { museStatue(g, sx, 0, 0.9, K, i); } });
        else if (kind === 1) { objs.push({ x: sx - 40, y: -260, w: 80, h: 270, draw(g) { candelabra(g, sx, 0, K); } }); }
      }
    });
    return objs;
  }
  function museStatue(g, x, base, s, K, v) {
    g.save(); g.translate(x, base); g.scale(s, s);
    // plinth
    g.fillStyle = K.marbleD; g.fillRect(-30, -90, 60, 90); g.fillStyle = K.marble; g.fillRect(-22, -90, 40, 90); g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(-30, -90, 60, 90);
    g.fillStyle = K.gold; g.fillRect(-36, -98, 72, 10); g.strokeRect(-36, -98, 72, 10);
    // robed figure: contrapposto, one arm raised (singing), other holding a mask
    const body = [[-18, -98], [-22, -150], [-14, -200], [-6, -224], [8, -224], [16, -200], [20, -150], [22, -98]];
    poly(g, body); g.fillStyle = K.marbleL; g.fill();
    g.save(); poly(g, body); g.clip(); g.fillStyle = K.marble; g.fillRect(-30, -240, 22, 150); g.strokeStyle = rgba(K.marbleD, 0.8); g.lineWidth = 1.6; for (let k = -12; k < 16; k += 7) { g.beginPath(); g.moveTo(k, -190); g.quadraticCurveTo(k + 4, -140, k - 2, -98); g.stroke(); } g.restore();
    poly(g, body); ink(g, 1.6);
    g.beginPath(); g.arc(2, -236, 11, 0, TAU); g.fillStyle = K.marbleL; g.fill(); ink(g, 1.4);
    g.beginPath(); g.arc(-1, -238, 10, PI * 0.7, PI * 1.6); g.fillStyle = K.marble; g.fill();
    g.beginPath(); g.moveTo(12, -210); g.quadraticCurveTo(28, -236, 22, -262); g.lineWidth = 7; g.strokeStyle = INK; g.stroke(); g.lineWidth = 4.5; g.strokeStyle = K.marbleL; g.stroke();
    if (v % 2) { g.beginPath(); g.ellipse(-22, -150, 8, 10, -0.3, 0, TAU); g.fillStyle = K.gold; g.fill(); ink(g, 1.2); g.fillStyle = INK; g.fillRect(-26, -153, 3, 2); g.fillRect(-20, -154, 3, 2); }
    g.restore();
  }
  function candelabra(g, x, base, K) {
    g.fillStyle = K.goldD; poly(g, [[x - 18, base], [x - 6, base - 20], [x + 6, base - 20], [x + 18, base]]); g.fill(); ink(g, 1.2);
    g.fillStyle = K.gold; g.fillRect(x - 3, base - 200, 6, 182); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(x - 3, base - 200, 6, 182);
    g.beginPath(); g.moveTo(x - 34, base - 210); g.quadraticCurveTo(x, base - 180, x + 34, base - 210); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); g.lineWidth = 2.4; g.strokeStyle = K.gold; g.stroke();
    for (const cx of [x - 34, x, x + 34]) { g.fillStyle = '#efe4cc'; g.fillRect(cx - 2.5, base - 232, 5, 20); g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(cx - 2.5, base - 232, 5, 20); glow(g, cx, base - 238, 26, '#ffc070', 0.55); g.fillStyle = '#fff3c0'; g.beginPath(); g.ellipse(cx, base - 238, 2.2, 5, 0, 0, TAU); g.fill(); }
  }
  // auditorium: far (f .3) = horseshoe of box tiers under a broken dome with the moon in the hole; near (f .6) = big box fronts + pilasters
  const DOME_HOLE = { x: 3560, y: -520 };
  function genAudFar() {
    const objs = [], X0 = 2350, X1 = 4400, rng = U.mulberry32(9409);
    const K = { gold: '#a77a2c', goldD: '#4e3416', goldL: '#f0c870', velvet: '#5a0e1e', velvetD: '#260510', velvetL: '#8a2433' };
    objs.push({ x: X0, y: -1300, w: X1 - X0, h: 2000, draw(g) {
      g.fillStyle = '#1e0610'; g.fillRect(X0, -1300, X1 - X0, 2000);
      const fg = g.createLinearGradient(0, 0, 0, 200); fg.addColorStop(0, '#2a0a12'); fg.addColorStop(1, '#060204'); g.fillStyle = fg; g.fillRect(X0, 0, X1 - X0, 700);
    } });
    // four tiers of boxes
    const tiers = [[-40, 70], [-140, 64], [-230, 58], [-312, 52]];
    for (const [ty, th] of tiers) {
      objs.push({ x: X0, y: ty - th - 20, w: X1 - X0, h: th + 40, draw(g) {
        const rr = U.mulberry32((ty * -13) | 0);
        g.fillStyle = '#12040a'; g.fillRect(X0, ty - th, X1 - X0, th);
        for (let x = X0 + 10; x < X1; x += 74) {
          // dark box with a red curtain and a tiny lamp; some boxes lit by ghostly footlight bounce
          archPath(g, x + 6, ty - th + 6, 60, th - 18, 'flat'); g.fillStyle = '#0a0206'; g.fill();
          g.fillStyle = K.velvet; poly(g, [[x + 6, ty - th + 6], [x + 22, ty - th + 6], [x + 14, ty - 14], [x + 6, ty - 12]]); g.fill();
          poly(g, [[x + 66, ty - th + 6], [x + 50, ty - th + 6], [x + 58, ty - 14], [x + 66, ty - 12]]); g.fill();
          g.fillStyle = K.velvetD; g.fillRect(x + 6, ty - th + 6, 60, 6);
          if (rr() < 0.35) { glow(g, x + 36, ty - th * 0.55, 22, '#ffb860', 0.4); g.fillStyle = '#ffe0a0'; g.fillRect(x + 35, ty - th * 0.55, 2, 3); }
          g.fillStyle = K.goldD; g.fillRect(x, ty - th, 6, th);
        }
        // gilded parapet: bulging fronts with a velvet rail
        g.fillStyle = K.gold; g.fillRect(X0, ty - 14, X1 - X0, 16);
        g.fillStyle = K.goldD; for (let x = X0 + 10; x < X1; x += 74) { g.beginPath(); g.ellipse(x + 36, ty - 6, 26, 7, 0, 0, PI); g.fill(); }
        g.fillStyle = K.velvetL; g.fillRect(X0, ty - 17, X1 - X0, 4);
        g.fillStyle = K.goldL; g.fillRect(X0, ty - 13, X1 - X0, 1.5);
        g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(X0, ty - 17, X1 - X0, 19);
      } });
    }
    // the dome above, broken open: night sky + moon in the hole
    objs.push({ x: X0, y: -1300, w: X1 - X0, h: 940, draw(g) {
      g.fillStyle = '#2a0c16'; g.fillRect(X0, -1300, X1 - X0, 930);
      const rr = U.mulberry32(77);
      // painted coffers along the dome ring
      for (let x = X0; x < X1; x += 90) { g.fillStyle = '#3a1420'; g.fillRect(x + 8, -470, 74, 60); g.fillStyle = K.goldD; g.fillRect(x + 8, -470, 74, 4); g.fillRect(x + 8, -414, 74, 4); g.beginPath(); g.arc(x + 45, -440, 10, 0, TAU); g.fillStyle = rgba(K.gold, 0.7); g.fill(); }
      g.fillStyle = K.gold; g.fillRect(X0, -380, X1 - X0, 10); g.fillStyle = K.goldL; g.fillRect(X0, -380, X1 - X0, 2);
      // the hole
      const hx = DOME_HOLE.x, hy = DOME_HOLE.y;
      g.save(); g.beginPath(); g.moveTo(hx - 230, -400);
      for (let k = 0; k <= 16; k++) { const a = PI + (k / 16) * PI, r = 230 + (rr() - 0.5) * 50; g.lineTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.9 + 120); }
      g.lineTo(hx + 230, -400); g.closePath();
      const sg = g.createLinearGradient(0, hy - 220, 0, -400); sg.addColorStop(0, '#0a1230'); sg.addColorStop(1, '#2e4778'); g.fillStyle = sg; g.fill();
      g.clip();
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(230,240,255,${0.4 + rr() * 0.5})`; g.fillRect(hx - 220 + rr() * 440, hy - 120 + rr() * 200, 1.4, 1.4); }
      glow(g, hx + 60, hy - 30, 120, '#cfe2ff', 0.35);
      g.beginPath(); g.arc(hx + 60, hy - 30, 34, 0, TAU); g.fillStyle = '#eef3ff'; g.fill();
      g.save(); g.beginPath(); g.arc(hx + 60, hy - 30, 34, 0, TAU); g.clip(); g.beginPath(); g.arc(hx + 40, hy - 24, 36, 0, TAU); g.fillStyle = '#a9b6dc'; g.fill(); g.restore();
      g.beginPath(); g.arc(hx + 60, hy - 30, 34, 0, TAU); ink(g, 2);
      g.restore();
      // broken ribs across the hole
      g.strokeStyle = '#1a0a10'; g.lineWidth = 7;
      for (const [a, l] of [[-2.6, 0.9], [-2.0, 0.55], [-1.2, 0.7], [-0.5, 0.85]]) { g.beginPath(); g.moveTo(hx + Math.cos(a) * 250, -400); g.quadraticCurveTo(hx + Math.cos(a) * 160, hy + 40, hx + Math.cos(a) * 250 * (1 - l), hy - 60 * l); g.stroke(); }
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(hx - 230, -400); for (let k = 0; k <= 16; k++) { const a = PI + (k / 16) * PI; g.lineTo(hx + Math.cos(a) * 230, hy + Math.sin(a) * 207 + 120); } g.stroke();
    } });
    return objs;
  }
  function genAudNear() {
    const objs = [], X0 = 5350, X1 = 8100, rng = U.mulberry32(9466);
    const K = { marble: '#6a3a40', marbleD: '#381820', marbleL: '#a8686a', gold: '#b8862e', goldD: '#5a3a14', goldL: '#ffe08a', velvet: '#6e1022', velvetD: '#34060f', velvetL: '#a82a3a' };
    for (let x = X0; x < X1; x += 560 + rng() * 120) {
      const bx = x;
      objs.push({ x: bx - 30, y: -900, w: 420, h: 920, draw(g) {
        column(g, bx, 0, 64, 860, K);
        // a close box hanging high on the wall, curtains half drawn
        const px = bx + 120, py = -520;
        g.fillStyle = '#0a0206'; g.fillRect(px, py - 150, 200, 150);
        drape(g, px, px + 200, py - 150, 30, K, false);
        g.fillStyle = K.velvet; poly(g, [[px, py - 140], [px + 40, py - 140], [px + 20, py], [px, py]]); g.fill(); ink(g, 1.2);
        poly(g, [[px + 200, py - 140], [px + 160, py - 140], [px + 180, py], [px + 200, py]]); g.fill(); ink(g, 1.2);
        g.beginPath(); g.moveTo(px - 10, py); g.quadraticCurveTo(px + 100, py + 60, px + 210, py); g.lineTo(px + 210, py - 10); g.lineTo(px - 10, py - 10); g.closePath();
        g.fillStyle = K.gold; g.fill(); ink(g, 1.6);
        g.fillStyle = K.goldD; g.beginPath(); g.ellipse(px + 100, py + 16, 40, 12, 0, 0, TAU); g.fill();
        g.fillStyle = K.velvetL; g.fillRect(px - 10, py - 14, 220, 5);
      } });
    }
    return objs;
  }
  const ROOMS = { built: false, s: 0, list: [] };
  function buildRooms() {
    const TL = G.WorldKit.TiledLayer;
    for (const r of ROOMS.list) for (const l of r.layers) l.flush();
    ROOMS.list = [
      { x0: FACADE, x1: AUD_X, back: '#1c0610', layers: [new TL('mid', 0.3, 0.12, 60, 0.7, genFoyerFar()), new TL('near', 0.6, 0.4, 60, 0.85, genFoyerNear())] },
      { x0: AUD_X, x1: 1e9, back: '#12040a', layers: [new TL('mid', 0.3, 0.12, 60, 0.7, genAudFar()), new TL('near', 0.6, 0.4, 60, 0.85, genAudNear())], dome: true },
    ];
    ROOMS.built = true; ROOMS.s = 0;
  }
  function flushRooms() { for (const r of ROOMS.list) for (const l of r.layers) l.flush(); ROOMS.s = 0; }
  // draw one layer only across the screen span [a, b] (so off-room tiles are never baked)
  function drawSpan(ctx, l, cam, a, b, H, W, S) {
    const Sl = S / cam.zoom * (1 + (cam.zoom - 1) * l.f), Wp = b - a;
    const camXp = cam.x + ((a + Wp / 2) - W / 2) / Sl / l.f;
    ctx.save(); ctx.translate(a, 0); l.draw(ctx, camXp, cam.y, Wp, H, Sl); ctx.restore();
  }
  function drawRooms(ctx, cam, W, H, S, time) {
    if (!ROOMS.built) buildRooms();
    const BG = G.WorldKit.BG;
    if (BG.lastS && BG.lastS !== ROOMS.s) { ROOMS.s = BG.lastS; for (const r of ROOMS.list) for (const l of r.layers) l.setScale(BG.lastS); }
    const sx = (wx) => W / 2 + (wx - cam.x) * S;
    for (const r of ROOMS.list) {
      const a = Math.max(0, Math.floor(sx(r.x0))), b = Math.min(W, Math.ceil(sx(r.x1)));
      if (b - a < 1) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(a, 0, b - a, H); ctx.clip();
      ctx.fillStyle = r.back; ctx.fillRect(a, 0, b - a, H);
      drawSpan(ctx, r.layers[0], cam, a, b, H, W, S);
      if (r.dome) drawMoonbeams(ctx, cam, W, H, S, time, r.layers[0]);
      // depth haze between the far wall and the colonnade
      ctx.fillStyle = r.dome ? 'rgba(40,6,18,0.28)' : 'rgba(60,14,24,0.22)'; ctx.fillRect(a, 0, b - a, H);
      drawSpan(ctx, r.layers[1], cam, a, b, H, W, S);
      ctx.fillStyle = 'rgba(30,4,12,0.16)'; ctx.fillRect(a, 0, b - a, H);
      ctx.restore();
    }
  }
  function drawMoonbeams(ctx, cam, W, H, S, time, l) {
    const Sl = S / cam.zoom * (1 + (cam.zoom - 1) * l.f);
    const hx = W / 2 + (DOME_HOLE.x + 40 - cam.x * l.f) * Sl, hy = H / 2 + (DOME_HOLE.y - (cam.y * l.fy - l.baseY)) * Sl;
    if (hx < -W * 0.8 || hx > W * 1.8) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a = 1.95 + i * 0.09 + Math.sin(time * 0.1 + i) * 0.015, len = H * 1.6, wd = 0.045 + 0.02 * Math.sin(i * 2.1);
      const gr = ctx.createLinearGradient(hx, hy, hx + Math.cos(a) * len, hy + Math.sin(a) * len);
      const al = 0.07 + 0.03 * Math.sin(time * 0.3 + i * 1.7);
      gr.addColorStop(0, `rgba(200,220,255,${al * 1.4})`); gr.addColorStop(0.6, `rgba(200,220,255,${al * 0.6})`); gr.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(hx - 40 * Sl + i * 30 * Sl, hy);
      ctx.lineTo(hx + Math.cos(a - wd) * len, hy + Math.sin(a - wd) * len); ctx.lineTo(hx + Math.cos(a + wd) * len, hy + Math.sin(a + wd) * len); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* =============================== GAMEPLAY PLANE: solid painters =============================== */
  // long solids are painted in 512-wide chunks, each clipped to itself (fast tile baking)
  function chunked(s, up, down, fn) {
    const out = [];
    for (let cx = s.x; cx < s.x + s.w; cx += 512) {
      const cw = Math.min(512, s.x + s.w - cx), x0 = cx;
      out.push({ x: x0, y: s.y - up, w: cw, h: up + down, draw(g) {
        g.save(); g.beginPath(); g.rect(x0, s.y - up, cw, up + down); g.clip();
        fn(g, x0, cw, U.mulberry32(((x0 * 7.31) | 0) + 17), s);
        g.restore();
      } });
    }
    return out;
  }
  const painters = {
    // the flooded causeway: cobbles under a film of water, the black mirror below
    c4_street(s) {
      return chunked(s, 40, 720, (g, cx, cw, rr) => {
        const y = s.y;
        const wg = g.createLinearGradient(0, y + 12, 0, y + 330);
        wg.addColorStop(0, '#24365f'); wg.addColorStop(0.1, '#121b38'); wg.addColorStop(0.55, '#080b19'); wg.addColorStop(1, '#04050b');
        g.fillStyle = wg; g.fillRect(cx, y + 12, cw, 720);
        // mirrored façades and their lit windows, shattered by ripples
        for (let x = cx - 60; x < cx + cw; x += 70 + rr() * 110) {
          const w = 40 + rr() * 90, h = 60 + rr() * 160;
          g.fillStyle = 'rgba(3,5,12,0.55)'; g.fillRect(x, y + 16, w, h);
          if (rr() < 0.45) for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(255,190,110,${0.24 - k * 0.04})`; g.fillRect(x + w * 0.35 + (rr() - 0.5) * 6, y + 26 + k * 7, w * 0.18, 2); }
        }
        for (let yy = y + 16, k = 0; yy < y + 280; yy += 4 + k * 1.4, k++) {
          g.fillStyle = 'rgba(10,16,36,0.5)'; g.fillRect(cx, yy, cw, 1);
          g.fillStyle = `rgba(160,190,240,${Math.max(0.03, 0.2 - k * 0.008)})`;
          for (let x = cx + rr() * 30; x < cx + cw; x += 36 + rr() * 80) g.fillRect(x, yy + 1, 8 + rr() * 34, 1);
        }
        // causeway: two rows of wet cobbles
        g.fillStyle = '#2e3858'; g.fillRect(cx, y, cw, 13);
        for (let row = 0; row < 2; row++) {
          const ry = y + 1.5 + row * 6, off = row ? 9 : 0;
          for (let x = cx - 20 + off; x < cx + cw + 20; x += 15 + rr() * 5) {
            const w = 12 + rr() * 5, h = 5;
            g.beginPath(); g.ellipse(x + w / 2, ry + h / 2, w / 2, h / 2, 0, 0, TAU);
            g.fillStyle = mixH('#4c5a80', '#6a7aa2', rr() * 0.7); g.fill();
            g.strokeStyle = 'rgba(11,6,18,0.75)'; g.lineWidth = 0.8; g.stroke();
            g.fillStyle = 'rgba(200,220,255,0.45)'; g.fillRect(x + w * 0.45, ry + 0.6, w * 0.35, 0.9);
          }
        }
        g.fillStyle = 'rgba(150,180,240,0.16)'; g.fillRect(cx, y, cw, 4);                      // water film
        g.fillStyle = '#c4d6f4'; g.fillRect(cx, y, cw, 1.3);                                     // moonlit lip
        g.fillStyle = INK; g.fillRect(cx, y - 1.2, cw, 1.4); g.fillRect(cx, y + 12.5, cw, 2);
        for (let x = cx + rr() * 40; x < cx + cw; x += 30 + rr() * 70) { g.fillStyle = 'rgba(235,245,255,0.75)'; g.fillRect(x, y + 0.4, 2 + rr() * 5, 0.8); }
        // floating debris: torn sheet music, petals, a plank
        for (let x = cx + rr() * 120; x < cx + cw; x += 140 + rr() * 220) {
          const fy = y + 22 + rr() * 50, r = rr();
          if (r < 0.5) { g.save(); g.translate(x, fy); g.rotate((rr() - 0.5) * 0.5); g.fillStyle = 'rgba(214,206,186,0.55)'; g.fillRect(-8, -2, 16, 4); g.fillStyle = 'rgba(40,30,30,0.5)'; for (let k = 0; k < 3; k++) g.fillRect(-7, -1.4 + k * 1.2, 14, 0.4); g.restore(); }
          else if (r < 0.8) { g.fillStyle = 'rgba(190,60,80,0.6)'; g.beginPath(); g.ellipse(x, fy, 3, 1.4, rr(), 0, TAU); g.fill(); }
          else { g.fillStyle = 'rgba(40,30,30,0.65)'; g.fillRect(x, fy, 30, 3); }
        }
      });
    },
    // the Opera Square: moonlit marble slabs with a gold inlay, a meander frieze, rusticated plinth
    c4_plaza(s) {
      return chunked(s, 40, 720, (g, cx, cw, rr) => {
        const y = s.y;
        const fg = g.createLinearGradient(0, y, 0, y + 300); fg.addColorStop(0, '#3e4466'); fg.addColorStop(0.3, '#1d2038'); fg.addColorStop(1, '#090a14');
        g.fillStyle = fg; g.fillRect(cx, y, cw, 720);
        // rustication blocks
        for (let yy = y + 40, r = 0; yy < y + 320; yy += 30, r++) for (let x = cx - (r % 2) * 40; x < cx + cw; x += 80) {
          g.strokeStyle = 'rgba(8,8,18,0.55)'; g.lineWidth = 1.4; g.strokeRect(x + 2, yy + 2, 76, 26);
          g.fillStyle = 'rgba(170,190,240,0.08)'; g.fillRect(x + 3, yy + 3, 74, 2);
        }
        // meander frieze
        g.fillStyle = '#5f6488'; g.fillRect(cx, y + 17, cw, 20);
        g.strokeStyle = 'rgba(11,6,18,0.7)'; g.lineWidth = 1.4; g.beginPath();
        for (let x = cx - ((cx % 24) + 24) % 24; x < cx + cw; x += 24) { g.moveTo(x, y + 33); g.lineTo(x, y + 21); g.lineTo(x + 16, y + 21); g.lineTo(x + 16, y + 29); g.lineTo(x + 8, y + 29); g.lineTo(x + 8, y + 25); g.moveTo(x + 4, y + 33); g.lineTo(x + 24, y + 33); }
        g.stroke();
        g.fillStyle = INK; g.fillRect(cx, y + 36, cw, 2); g.fillRect(cx, y + 16, cw, 1.5);
        // slabs
        for (let x = cx - rr() * 50; x < cx + cw; x += 50 + rr() * 30) {
          const w = 48 + rr() * 30; g.fillStyle = mixH('#7c82a8', '#9aa0c4', rr()); g.fillRect(x, y, w, 16);
          g.fillStyle = 'rgba(11,6,18,0.6)'; g.fillRect(x, y, 1.2, 16);
          if (rr() < 0.25) { g.strokeStyle = 'rgba(11,6,18,0.55)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + w * 0.2, y); g.lineTo(x + w * 0.4, y + 8); g.lineTo(x + w * 0.35, y + 16); g.stroke(); }
        }
        g.fillStyle = C.gold; g.fillRect(cx, y + 11, cw, 1.6);
        g.fillStyle = '#d6e2ff'; g.fillRect(cx, y, cw, 1.4); g.fillStyle = INK; g.fillRect(cx, y - 1.2, cw, 1.4);
        // moon puddles, moss, crystal sprouts
        for (let x = cx + 80 + rr() * 200; x < cx + cw - 40; x += 260 + rr() * 300) {
          const pw = 20 + rr() * 40; g.fillStyle = 'rgba(120,150,210,0.5)'; g.beginPath(); g.ellipse(x, y + 5, pw, 2.4, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(235,245,255,0.8)'; g.fillRect(x - pw * 0.3, y + 4, pw * 0.4, 0.8);
        }
        for (let x = cx + rr() * 100; x < cx + cw; x += 90 + rr() * 160) { g.fillStyle = 'rgba(52,84,64,0.8)'; for (let k = 0; k < 4; k++) g.fillRect(x + k * 3, y + 37, 2, 8 + rr() * 22); }
        if (rr() < 0.35) hushXtal(g, cx + 60 + rr() * (cw - 120), y + 1, 12 + rr() * 8, rr);
      });
    },
    // the Grand Foyer: polished checkerboard, gilded nosing, wainscot of dark wood and crimson velvet
    c4_marble(s) {
      return chunked(s, 40, 720, (g, cx, cw, rr) => {
        const y = s.y;
        g.fillStyle = '#1a0a0c'; g.fillRect(cx, y, cw, 720);
        for (let i = Math.floor((cx - s.x) / 36) - 1, x = s.x + i * 36; x < cx + cw + 36; i++, x += 36) {
          poly(g, [[x, y], [x + 36, y], [x + 26, y + 18], [x - 10, y + 18]]); g.fillStyle = i % 2 ? '#e2d6c2' : '#241418'; g.fill();
        }
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let x = cx + rr() * 80; x < cx + cw; x += 120 + rr() * 100) { const rg = g.createLinearGradient(0, y, 0, y + 18); rg.addColorStop(0, 'rgba(255,200,130,0.0)'); rg.addColorStop(1, 'rgba(255,200,130,0.16)'); g.fillStyle = rg; g.fillRect(x, y, 14, 18); }
        g.restore();
        g.fillStyle = INK; g.fillRect(cx, y - 1.2, cw, 1.6);
        g.fillStyle = '#fff0cc'; g.fillRect(cx, y, cw, 1);
        // gilded nosing
        g.fillStyle = C.gold; g.fillRect(cx, y + 18, cw, 5); g.fillStyle = C.goldL; g.fillRect(cx, y + 18, cw, 1.4); g.fillStyle = INK; g.fillRect(cx, y + 23, cw, 1.6);
        // wainscot panels
        const p0 = s.x + Math.floor((cx - s.x) / 130) * 130;
        for (let x = p0; x < cx + cw; x += 130) {
          g.fillStyle = C.wood; g.fillRect(x, y + 25, 130, 120);
          g.fillStyle = '#5a1020'; g.fillRect(x + 12, y + 36, 106, 64);
          g.strokeStyle = rgba(C.gold, 0.85); g.lineWidth = 2; g.strokeRect(x + 12, y + 36, 106, 64);
          g.strokeStyle = 'rgba(255,224,150,0.3)'; g.lineWidth = 1; g.strokeRect(x + 18, y + 42, 94, 52);
          g.fillStyle = rgba(C.gold, 0.7); g.beginPath(); g.arc(x + 65, y + 68, 6, 0, TAU); g.fill();
          g.fillStyle = 'rgba(11,6,18,0.7)'; g.fillRect(x, y + 25, 2, 120);
        }
        const dg = g.createLinearGradient(0, y + 40, 0, y + 200); dg.addColorStop(0, 'rgba(10,2,6,0)'); dg.addColorStop(1, 'rgba(10,2,6,0.9)'); g.fillStyle = dg; g.fillRect(cx, y + 40, cw, 680);
      });
    },
    // the flooded stalls: the water stands level with the aisles; gold light drowns in it
    c4_stalls(s) {
      return chunked(s, 40, 720, (g, cx, cw, rr) => {
        const y = s.y;
        const wg = g.createLinearGradient(0, y, 0, y + 260); wg.addColorStop(0, '#3a0e18'); wg.addColorStop(0.08, '#1e060c'); wg.addColorStop(1, '#050103');
        g.fillStyle = wg; g.fillRect(cx, y, cw, 720);
        // drowned seat rows glimpsed below the surface
        for (let row = 0; row < 3; row++) for (let x = cx - 20 + row * 14; x < cx + cw; x += 44) { g.fillStyle = `rgba(110,20,36,${0.35 - row * 0.1})`; g.beginPath(); g.ellipse(x + 20, y + 22 + row * 26, 17, 8, 0, PI, 0); g.fill(); }
        // reflections of the box lamps: warm vertical streaks broken by ripples
        for (let x = cx + rr() * 60; x < cx + cw; x += 70 + rr() * 90) {
          for (let k = 0; k < 9; k++) { g.fillStyle = `rgba(255,180,100,${0.2 - k * 0.02})`; g.fillRect(x + (rr() - 0.5) * 6, y + 8 + k * 8, 6 + rr() * 10, 1.6); }
        }
        for (let yy = y + 4, k = 0; yy < y + 220; yy += 4 + k * 1.3, k++) { g.fillStyle = `rgba(255,170,150,${Math.max(0.02, 0.12 - k * 0.006)})`; for (let x = cx + rr() * 40; x < cx + cw; x += 40 + rr() * 80) g.fillRect(x, yy, 8 + rr() * 26, 0.9); }
        g.fillStyle = 'rgba(255,200,150,0.35)'; g.fillRect(cx, y, cw, 2);
        g.fillStyle = INK; g.fillRect(cx, y - 1.2, cw, 1.4);
        for (let x = cx + rr() * 60; x < cx + cw; x += 50 + rr() * 90) { g.fillStyle = 'rgba(255,236,200,0.7)'; g.fillRect(x, y + 0.5, 3 + rr() * 6, 0.8); }
        // floating programme pages and rose petals
        for (let x = cx + rr() * 100; x < cx + cw; x += 120 + rr() * 200) { const fy = y + 10 + rr() * 30; g.fillStyle = rr() < 0.5 ? 'rgba(200,40,60,0.7)' : 'rgba(220,206,176,0.55)'; g.beginPath(); g.ellipse(x, fy, 4, 1.6, rr(), 0, TAU); g.fill(); }
      });
    },
    // the stage: worn boards with spike tape and trap doors, a black apron with a gilded lip and footlight hoods
    c4_stage(s) {
      return chunked(s, 40, 720, (g, cx, cw, rr) => {
        const y = s.y;
        g.fillStyle = '#0c0608'; g.fillRect(cx, y, cw, 720);
        g.fillStyle = '#5e4030'; g.fillRect(cx, y, cw, 14);
        for (let x = cx - rr() * 60; x < cx + cw; x += 60 + rr() * 70) { g.fillStyle = 'rgba(11,6,18,0.7)'; g.fillRect(x, y, 1.2, 14); g.fillStyle = 'rgba(255,220,170,0.12)'; g.fillRect(x + 1.2, y, 18, 14); g.fillStyle = 'rgba(11,6,18,0.5)'; g.fillRect(x + 6, y + 6, 1.4, 1.4); }
        g.strokeStyle = 'rgba(20,10,8,0.35)'; g.lineWidth = 0.6; for (let yy = y + 4; yy < y + 14; yy += 3.5) { g.beginPath(); g.moveTo(cx, yy); g.lineTo(cx + cw, yy + 0.5); g.stroke(); }
        for (let x = cx + rr() * 160; x < cx + cw; x += 180 + rr() * 220) { g.fillStyle = ['rgba(240,220,120,0.55)', 'rgba(110,200,220,0.5)', 'rgba(230,110,120,0.5)'][Math.floor(rr() * 3)]; g.fillRect(x, y + 4, 9, 1.6); g.fillRect(x + 3.7, y + 1, 1.6, 8); }
        g.fillStyle = '#ffe2b0'; g.fillRect(cx, y, cw, 1.2); g.fillStyle = INK; g.fillRect(cx, y - 1.2, cw, 1.4); g.fillRect(cx, y + 14, cw, 2);
        // gilded apron lip (egg & dart) and footlight hoods
        g.fillStyle = C.goldD; g.fillRect(cx, y + 16, cw, 10); g.fillStyle = C.gold; g.fillRect(cx, y + 16, cw, 4); g.fillStyle = C.goldL; g.fillRect(cx, y + 16, cw, 1);
        for (let x = cx - (cx % 12); x < cx + cw; x += 12) { g.fillStyle = C.goldD; g.beginPath(); g.ellipse(x + 6, y + 23, 3, 2.4, 0, 0, TAU); g.fill(); }
        g.fillStyle = INK; g.fillRect(cx, y + 26, cw, 2);
        const f0 = s.x + Math.ceil((cx - s.x) / 110) * 110;
        for (let x = f0 + 40; x < cx + cw; x += 110) {
          g.beginPath(); g.moveTo(x - 16, y + 30); g.quadraticCurveTo(x, y + 18, x + 16, y + 30); g.lineTo(x + 12, y + 44); g.lineTo(x - 12, y + 44); g.closePath();
          g.fillStyle = '#2a1a12'; g.fill(); ink(g, 1.2); g.strokeStyle = C.gold; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 14, y + 30); g.quadraticCurveTo(x, y + 20, x + 14, y + 30); g.stroke();
        }
        const dg = g.createLinearGradient(0, y + 40, 0, y + 200); dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(1, 'rgba(0,0,0,0.85)'); g.fillStyle = dg; g.fillRect(cx, y + 40, cw, 680);
      });
    },
    c4_step(s) {
      return [{ x: s.x - 4, y: s.y - 4, w: s.w + 8, h: s.h + 30, draw(g) {
        g.fillStyle = '#6e7498'; g.fillRect(s.x, s.y, s.w, s.h + 20); g.fillStyle = '#3e4466'; g.fillRect(s.x, s.y + 8, s.w, s.h + 12);
        g.fillStyle = '#d6e2ff'; g.fillRect(s.x, s.y, s.w, 1.4); g.beginPath(); g.rect(s.x, s.y, s.w, s.h + 20); ink(g, 1.4);
      } }];
    },
    // top of the old campanile: the belfry floor
    c4_roof(s) {
      return [{ x: s.x - 10, y: s.y - 10, w: s.w + 20, h: s.h + 30, draw(g) {
        g.fillStyle = '#4c4a66'; g.fillRect(s.x, s.y, s.w, s.h); g.fillStyle = '#2a2944'; g.fillRect(s.x, s.y + 10, s.w, s.h - 10);
        g.fillStyle = '#c4d2f0'; g.fillRect(s.x, s.y, s.w, 1.6);
        for (let x = s.x + 8; x < s.x + s.w; x += 26) { g.fillStyle = 'rgba(11,6,18,0.5)'; g.fillRect(x, s.y + 12, 14, 8); }
        g.beginPath(); g.rect(s.x, s.y, s.w, s.h); ink(g, 1.8);
      } }];
    },
    // the rehearsal gallery above the foyer: gilded balustrade, swagged velvet below
    c4_gallery(s) {
      const K = { velvet: C.velvet, velvetD: C.velvetD, velvetL: C.velvetL, gold: C.gold };
      return [{ x: s.x - 20, y: s.y - 20, w: s.w + 40, h: s.h + 240, draw(g) {
        g.fillStyle = '#3a1a12'; g.fillRect(s.x, s.y, s.w, 6); g.fillStyle = '#8a1a2a'; g.fillRect(s.x + 20, s.y, s.w - 40, 3);
        g.fillStyle = '#fff0cc'; g.fillRect(s.x, s.y, s.w, 1);
        g.fillStyle = C.goldD; g.fillRect(s.x, s.y + 6, s.w, s.h - 6);
        g.fillStyle = C.gold; g.fillRect(s.x, s.y + 6, s.w, 5); g.fillRect(s.x, s.y + s.h - 6, s.w, 6);
        for (let x = s.x + 8; x < s.x + s.w - 4; x += 14) { g.beginPath(); g.moveTo(x, s.y + 12); g.quadraticCurveTo(x - 4, s.y + 22, x, s.y + s.h - 7); g.lineTo(x + 6, s.y + s.h - 7); g.quadraticCurveTo(x + 10, s.y + 22, x + 6, s.y + 12); g.closePath(); g.fillStyle = C.gold; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke(); }
        g.beginPath(); g.rect(s.x, s.y, s.w, s.h); ink(g, 2);
        for (let x = s.x; x < s.x + s.w - 10; x += 220) drape(g, x, Math.min(s.x + s.w, x + 220), s.y + s.h + 6, 70, K);
      } }];
    },
  };
  // one-way platforms: balconies outside, marble landings in the foyer, theatre boxes over the stalls
  function onewayPainter(p) {
    const d = p.deco || (p.x < FACADE ? 'balcony' : p.x < AUD_X ? 'landing' : 'box');
    if (d === 'none') return [];
    if (d === 'balcony') return [{ x: p.x - 10, y: p.y - 40, w: p.w + 20, h: 110, draw(g) {
      // iron railing behind, stone slab, corbels
      g.strokeStyle = '#141826'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(p.x + 4, p.y - 26); g.lineTo(p.x + p.w - 4, p.y - 26);
      for (let x = p.x + 6; x < p.x + p.w - 4; x += 10) { g.moveTo(x, p.y); g.lineTo(x, p.y - 26); } g.stroke();
      g.beginPath(); for (let x = p.x + 6; x < p.x + p.w - 14; x += 20) { g.moveTo(x + 10, p.y - 4); g.arc(x + 10, p.y - 13, 5, PI * 0.5, PI * 2.3); } g.stroke();
      g.fillStyle = '#5a6488'; g.fillRect(p.x, p.y, p.w, 10); g.fillStyle = '#2c3254'; g.fillRect(p.x, p.y + 6, p.w, 6); g.fillStyle = '#d0dcf6'; g.fillRect(p.x, p.y, p.w, 1.4);
      g.beginPath(); g.rect(p.x, p.y, p.w, 12); ink(g, 1.4);
      for (const cxx of [p.x + 16, p.x + p.w - 30]) { poly(g, [[cxx, p.y + 12], [cxx + 14, p.y + 12], [cxx + 10, p.y + 34], [cxx + 4, p.y + 40]]); g.fillStyle = '#3a4266'; g.fill(); ink(g, 1.2); }
      // flower box spilling ivy (and a lost rose)
      g.fillStyle = '#5a3a2a'; g.fillRect(p.x + p.w * 0.4, p.y - 8, 34, 8); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(p.x + p.w * 0.4, p.y - 8, 34, 8);
      g.strokeStyle = '#3e6a4c'; g.lineWidth = 1.4; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(p.x + p.w * 0.4 + 6 + k * 7, p.y); g.quadraticCurveTo(p.x + p.w * 0.4 + 3 + k * 8, p.y + 20, p.x + p.w * 0.4 + 8 + k * 6, p.y + 30 + k * 6); g.stroke(); }
      g.fillStyle = '#d23a54'; g.beginPath(); g.arc(p.x + p.w * 0.4 + 26, p.y - 10, 3, 0, TAU); g.fill();
    } }];
    if (d === 'landing') return [{ x: p.x - 10, y: p.y - 30, w: p.w + 20, h: 80, draw(g) {
      g.fillStyle = '#d8ccbc'; g.fillRect(p.x, p.y, p.w, 8); g.fillStyle = '#6e5a5e'; g.fillRect(p.x, p.y + 8, p.w, 10);
      g.fillStyle = C.gold; g.fillRect(p.x, p.y + 8, p.w, 3); g.beginPath(); g.rect(p.x, p.y, p.w, 18); ink(g, 1.6);
      // newel posts with brass lamps
      for (const nx of [p.x + 6, p.x + p.w - 14]) { g.fillStyle = '#4a3a40'; g.fillRect(nx, p.y - 26, 8, 26); g.strokeStyle = INK; g.lineWidth = 1.1; g.strokeRect(nx, p.y - 26, 8, 26); g.fillStyle = C.gold; g.beginPath(); g.arc(nx + 4, p.y - 29, 4, 0, TAU); g.fill(); g.stroke(); }
    } }];
    // theatre box: velvet rail on top, bulging gilded parapet hanging below, a curtain behind
    return [{ x: p.x - 16, y: p.y - 130, w: p.w + 32, h: 210, draw(g) {
      g.fillStyle = '#0c0306'; g.fillRect(p.x + 6, p.y - 120, p.w - 12, 120);
      g.fillStyle = C.velvet; poly(g, [[p.x + 6, p.y - 120], [p.x + 40, p.y - 120], [p.x + 22, p.y], [p.x + 6, p.y]]); g.fill(); ink(g, 1.2);
      poly(g, [[p.x + p.w - 6, p.y - 120], [p.x + p.w - 40, p.y - 120], [p.x + p.w - 22, p.y], [p.x + p.w - 6, p.y]]); g.fill(); ink(g, 1.2);
      g.fillStyle = C.velvetD; g.fillRect(p.x + 6, p.y - 124, p.w - 12, 10);
      g.fillStyle = C.velvetL; g.fillRect(p.x - 6, p.y - 2, p.w + 12, 6);
      g.beginPath(); g.moveTo(p.x - 8, p.y + 4); g.lineTo(p.x + p.w + 8, p.y + 4); g.quadraticCurveTo(p.x + p.w + 4, p.y + 40, p.x + p.w / 2, p.y + 58); g.quadraticCurveTo(p.x - 4, p.y + 40, p.x - 8, p.y + 4); g.closePath();
      g.fillStyle = C.gold; g.fill(); ink(g, 1.8);
      g.fillStyle = C.goldD; g.beginPath(); g.ellipse(p.x + p.w / 2, p.y + 28, p.w * 0.28, 12, 0, 0, TAU); g.fill();
      g.fillStyle = C.goldL; g.fillRect(p.x - 6, p.y + 5, p.w + 12, 1.6);
      g.strokeStyle = rgba(C.goldL, 0.6); g.lineWidth = 1; g.beginPath(); g.ellipse(p.x + p.w / 2, p.y + 28, p.w * 0.2, 7, 0, 0, TAU); g.stroke();
    } }];
  }

  /* =============================== GAMEPLAY PLANE: props =============================== */
  function genProps() {
    const objs = [];
    LAMPS.length = 0; CANDLES.length = 0;
    // --- the Drowned Boulevard ---
    // a sunk gondola at the start
    objs.push({ x: 120, y: -90, w: 260, h: 120, draw(g) { gondola(g, 250, 6, 1.15, -0.12); } });
    moorPole(objs, 90, 6, 120); moorPole(objs, 420, 6, 96, '#2f5a8a');
    lampPost(objs, 560, 0); lampPost(objs, 1180, 0); lampPost(objs, 2020, 0); lampPost(objs, 3020, 0); lampPost(objs, 3560, 0);
    // drowned grand piano (its lid is a ledge: the first lost page lies on it)
    objs.push({ x: 690, y: -170, w: 240, h: 190, draw(g) {
      const x = 720, y = -70, w = 170;
      g.fillStyle = '#0d0b14'; g.fillRect(x + 20, y + 10, 8, 70); g.fillRect(x + w - 30, y + 10, 8, 70);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.quadraticCurveTo(x + w + 10, y + 12, x + w - 6, y + 22); g.lineTo(x + 6, y + 22); g.closePath();
      g.fillStyle = '#141220'; g.fill(); ink(g, 1.8);
      g.fillStyle = rgba(C.moon, 0.55); g.fillRect(x + 4, y + 1, w - 10, 1.6);
      g.save(); g.translate(x + w - 10, y); g.rotate(-0.62); g.beginPath(); g.moveTo(0, 0); g.lineTo(-150, -6); g.quadraticCurveTo(-162, 0, -150, 6); g.lineTo(0, 4); g.closePath(); g.fillStyle = '#100e1a'; g.fill(); ink(g, 1.6); g.fillStyle = rgba(C.moon, 0.5); g.fillRect(-148, -5, 146, 1.2); g.restore();
      g.strokeStyle = '#1b1828'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + w - 60, y); g.lineTo(x + w - 40, y - 70); g.stroke();
      // keyboard
      g.fillStyle = '#e8e2d2'; g.fillRect(x - 26, y + 6, 30, 9); g.fillStyle = INK; for (let k = 0; k < 6; k++) g.fillRect(x - 24 + k * 5, y + 6, 2, 5); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(x - 26, y + 6, 30, 9);
      g.fillStyle = 'rgba(30,60,50,0.7)'; g.fillRect(x - 26, y + 60, w + 40, 10);
    } });
    // advertising column with Lucette's poster (story beat)
    objs.push({ x: 1420, y: -260, w: 120, h: 270, draw(g) {
      const x = 1480, y = 0;
      g.fillStyle = '#20263e'; g.fillRect(x - 34, y - 200, 68, 200);
      g.fillStyle = '#141828'; g.fillRect(x - 34, y - 200, 16, 200); g.fillStyle = rgba(C.moon, 0.5); g.fillRect(x + 30, y - 200, 4, 200);
      g.beginPath(); g.rect(x - 34, y - 200, 68, 200); ink(g, 1.8);
      // poster
      g.fillStyle = '#7a1426'; g.fillRect(x - 26, y - 176, 52, 120); g.strokeStyle = C.goldL; g.lineWidth = 1; g.strokeRect(x - 23, y - 173, 46, 114);
      g.fillStyle = '#efe0c0'; g.beginPath(); g.arc(x, y - 146, 7, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(x - 5, y - 139); g.quadraticCurveTo(x - 22, y - 100, x - 18, y - 76); g.lineTo(x + 18, y - 76); g.quadraticCurveTo(x + 22, y - 100, x + 5, y - 139); g.fill();
      g.strokeStyle = '#efe0c0'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 4, y - 132); g.lineTo(x + 16, y - 160); g.stroke();
      g.fillStyle = C.goldL; g.font = '700 9px "Noto Serif TC", serif'; g.textAlign = 'center'; g.fillText('最後的詠嘆', x, y - 64);
      g.font = '600 6px Rajdhani, sans-serif'; g.fillText('LUCETTE · 2263.XI.04', x, y - 58);
      g.fillStyle = 'rgba(30,20,30,0.5)'; poly(g, [[x + 26, y - 176], [x + 12, y - 176], [x + 26, y - 150]]); g.fill(); // torn corner
      // cap
      g.beginPath(); g.ellipse(x, y - 200, 42, 9, 0, 0, TAU); g.fillStyle = '#1b2034'; g.fill(); ink(g, 1.6);
      g.beginPath(); g.moveTo(x - 30, y - 204); g.quadraticCurveTo(x, y - 250, x + 30, y - 204); g.closePath(); g.fill(); ink(g, 1.6);
      g.fillStyle = '#1b2034'; g.fillRect(x - 2, y - 262, 4, 18);
    } });
    // the old campanile — the secret climb (balconies are one-ways, the belfry floor is a solid)
    objs.push({ x: 2330, y: -1150, w: 680, h: 1160, draw(g) {
      const x0 = 2400, x1 = 2950, top = -700;
      const brick = '#4a3c58', brickD = '#2a2238', stone = '#6a7092';
      g.fillStyle = brick; g.fillRect(x0, top, x1 - x0, -top + 10);
      g.fillStyle = brickD; g.fillRect(x0, top, (x1 - x0) * 0.22, -top + 10);
      g.fillStyle = rgba(C.moon, 0.45); g.fillRect(x1 - 5, top, 5, -top);
      g.strokeStyle = 'rgba(11,6,18,0.35)'; g.lineWidth = 1;
      for (let y = top + 8; y < 0; y += 9) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); for (let x = x0 + ((y / 9) % 2 ? 0 : 12); x < x1; x += 24) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 9); g.stroke(); } }
      for (let y = top; y < 0; y += 36) { g.fillStyle = stone; g.fillRect(x0 - 4, y, 18, 18); g.fillRect(x1 - 14, y + 18, 18, 18); }
      // tall arched windows + the stopped clock
      for (const [wx, wy] of [[2470, -300], [2800, -300], [2470, -560], [2800, -560]]) { archPath(g, wx, wy, 40, 90); g.fillStyle = '#0a0b16'; g.fill(); ink(g, 1.4); }
      const cx = 2675, cy = -470;
      g.beginPath(); g.arc(cx, cy, 46, 0, TAU); g.fillStyle = '#e4dcc4'; g.fill(); ink(g, 2.2);
      g.beginPath(); g.arc(cx, cy, 46, 0, TAU); g.lineWidth = 6; g.strokeStyle = C.goldD; g.stroke();
      g.fillStyle = INK; for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; g.fillRect(cx + Math.cos(a) * 38 - 1.5, cy + Math.sin(a) * 38 - 1.5, 3, 3); }
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(-PI / 2 - 0.05) * 24, cy + Math.sin(-PI / 2 - 0.05) * 24); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(-PI / 2 - 0.31) * 34, cy + Math.sin(-PI / 2 - 0.31) * 34); g.stroke();
      g.strokeStyle = 'rgba(11,6,18,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + 10, cy - 40); g.lineTo(cx + 4, cy - 10); g.lineTo(cx + 18, cy + 20); g.stroke();
      // belfry above the floor: open arches, a hanging bronze bell, the pyramid spire
      g.fillStyle = brick; g.fillRect(x0 + 20, top - 250, x1 - x0 - 40, 250);
      for (let k = 0; k < 3; k++) { archPath(g, x0 + 50 + k * 160, top - 230, 130, 220); g.fillStyle = '#0d1022'; g.fill(); ink(g, 1.6); }
      g.save(); g.beginPath(); for (let k = 0; k < 3; k++) archPath(g, x0 + 50 + k * 160, top - 230, 130, 220); g.clip();
      const sg = g.createLinearGradient(0, top - 230, 0, top); sg.addColorStop(0, '#1a2b55'); sg.addColorStop(1, '#3a5a8e'); g.fillStyle = sg; g.fillRect(x0, top - 230, x1 - x0, 230); g.restore();
      for (let k = 0; k < 3; k++) { g.beginPath(); archPath(g, x0 + 50 + k * 160, top - 230, 130, 220); ink(g, 2); }
      const bx = 2700, by = top - 190;
      g.strokeStyle = '#1b1828'; g.lineWidth = 4; g.beginPath(); g.moveTo(x0 + 30, by - 20); g.lineTo(x1 - 30, by - 20); g.stroke();
      g.beginPath(); g.moveTo(bx - 26, by); g.quadraticCurveTo(bx - 30, by + 50, bx - 50, by + 80); g.lineTo(bx + 50, by + 80); g.quadraticCurveTo(bx + 30, by + 50, bx + 26, by); g.closePath();
      const bg = g.createLinearGradient(bx - 50, 0, bx + 50, 0); bg.addColorStop(0, '#3e5a4e'); bg.addColorStop(0.3, '#3e5a4e'); bg.addColorStop(0.3, '#6e8e72'); bg.addColorStop(0.85, '#6e8e72'); bg.addColorStop(0.85, '#b8d4b0'); bg.addColorStop(1, '#b8d4b0');
      g.fillStyle = bg; g.fill(); ink(g, 2);
      g.beginPath(); g.ellipse(bx, by, 26, 8, 0, PI, 0); g.fillStyle = '#3e5a4e'; g.fill(); ink(g, 1.6);
      g.fillStyle = '#2a3a34'; g.fillRect(bx - 50, by + 76, 100, 6);
      poly(g, [[x0 + 6, top - 250], [2675, top - 470], [x1 - 6, top - 250]]); g.fillStyle = brickD; g.fill(); ink(g, 2.4);
      poly(g, [[2675, top - 470], [2730, top - 380], [2780, top - 300], [x1 - 6, top - 250], [2780, top - 250]]); g.fillStyle = '#4c4066'; g.fill();
      g.fillStyle = stone; g.fillRect(x0, top - 260, x1 - x0, 12); g.beginPath(); g.rect(x0, top - 260, x1 - x0, 12); ink(g, 1.6);
      g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); g.rect(x0, top - 250, x1 - x0, 250 - top + 10); g.stroke();
      // lyre weathervane
      g.strokeStyle = '#1b1828'; g.lineWidth = 3; g.beginPath(); g.moveTo(2675, top - 470); g.lineTo(2675, top - 520); g.stroke();
      g.beginPath(); g.moveTo(2660, top - 520); g.quadraticCurveTo(2662, top - 552, 2672, top - 546); g.moveTo(2690, top - 520); g.quadraticCurveTo(2688, top - 552, 2678, top - 546); g.stroke();
      g.fillStyle = 'rgba(30,60,50,0.75)'; g.fillRect(x0, -14, x1 - x0, 14);
      hushXtal(g, 2440, 0, 26, U.mulberry32(41)); hushXtal(g, 2920, -700, 18, U.mulberry32(42));
    } });
    // street sign
    objs.push({ x: 3330, y: -170, w: 160, h: 180, draw(g) {
      const x = 3400; g.fillStyle = '#1b1f33'; g.fillRect(x - 3, -150, 6, 150); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(x - 3, -150, 6, 150);
      g.save(); g.translate(x, -132); g.rotate(-0.06);
      poly(g, [[-50, -15], [50, -15], [64, 0], [50, 15], [-50, 15]]); g.fillStyle = '#2a4a46'; g.fill(); ink(g, 1.6);
      g.strokeStyle = 'rgba(230,226,210,0.6)'; g.lineWidth = 1; g.strokeRect(-46, -11, 92, 22);
      g.fillStyle = '#eae4d2'; g.font = '700 12px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.fillText('劇院廣場', 0, 1); g.font = '600 7px Rajdhani, sans-serif'; g.fillText('PIAZZA DELL\'OPERA →', 0, 10);
      g.restore();
    } });
    // --- the Opera Square ---
    lampPost(objs, 3960, -90, 220, '#8a1a2a'); lampPost(objs, 4420, -90, 220, '#8a1a2a'); lampPost(objs, 5240, -90, 220, '#8a1a2a'); lampPost(objs, 5760, -90, 220, '#8a1a2a');
    // café terrace left behind
    objs.push({ x: 4040, y: -230, w: 220, h: 150, draw(g) {
      const y = -90;
      g.strokeStyle = '#141826'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(4150, y); g.lineTo(4150, y - 120); g.stroke();
      g.beginPath(); g.moveTo(4070, y - 110); g.quadraticCurveTo(4150, y - 150, 4230, y - 110); g.lineTo(4150, y - 122); g.closePath(); g.fillStyle = '#6e1a28'; g.fill(); ink(g, 1.6);
      g.fillStyle = '#e4d8c0'; for (let k = 0; k < 5; k++) { poly(g, [[4070 + k * 32, y - 110], [4086 + k * 32, y - 104], [4102 + k * 32, y - 110]]); g.fill(); }
      for (const [tx, tl] of [[4110, 0], [4196, 0.5]]) { g.save(); g.translate(tx, y); g.rotate(tl); g.fillStyle = '#1b1f33'; g.fillRect(-2, -36, 4, 36); g.beginPath(); g.ellipse(0, -36, 18, 4, 0, 0, TAU); g.fill(); ink(g, 1.2); g.restore(); }
      g.strokeStyle = '#1b1f33'; g.lineWidth = 2; g.beginPath(); g.moveTo(4080, y); g.lineTo(4080, y - 22); g.lineTo(4092, y - 22); g.lineTo(4092, y); g.moveTo(4080, y - 22); g.lineTo(4078, y - 44); g.stroke();
    } });
    // the Lyre Fountain: a basin (a Pit Wyrm's pool) and a Muse on a pedestal (the second lost page lies at her feet)
    objs.push({ x: 4700, y: -560, w: 340, h: 520, draw(g) {
      const cx = 4870, y = -90;
      const K = { marble: '#7c82a8', marbleD: '#3e4466', marbleL: '#c8d2f0', gold: '#a88a4a' };
      g.fillStyle = '#3e4466'; g.fillRect(cx - 26, -280, 52, 190); g.fillStyle = '#5f6488'; g.fillRect(cx - 14, -280, 26, 190);
      g.beginPath(); g.rect(cx - 26, -280, 52, 190); ink(g, 1.8);
      g.fillStyle = K.marbleL; g.fillRect(cx - 80, -290, 160, 12); g.beginPath(); g.rect(cx - 80, -290, 160, 12); g.fillStyle = '#9aa0c4'; g.fill(); ink(g, 1.6);
      g.fillStyle = '#d6e2ff'; g.fillRect(cx - 80, -290, 160, 1.4);
      // the statue above: a Muse with a lyre, head thrown back in song
      g.save(); g.translate(cx, -290);
      const body = [[-22, 0], [-26, -60], [-16, -120], [-8, -146], [10, -146], [18, -120], [24, -60], [24, 0]];
      poly(g, body); g.fillStyle = K.marble; g.fill(); g.save(); poly(g, body); g.clip(); g.fillStyle = K.marbleD; g.fillRect(-30, -150, 20, 150); g.fillStyle = K.marbleL; g.fillRect(14, -150, 12, 150);
      g.strokeStyle = rgba(K.marbleD, 0.8); g.lineWidth = 1.6; for (let k = -14; k < 20; k += 8) { g.beginPath(); g.moveTo(k, -110); g.quadraticCurveTo(k + 5, -60, k - 3, 0); g.stroke(); } g.restore();
      poly(g, body); ink(g, 1.8);
      g.beginPath(); g.ellipse(4, -160, 12, 14, -0.4, 0, TAU); g.fillStyle = K.marble; g.fill(); ink(g, 1.6);
      g.beginPath(); g.ellipse(-2, -164, 11, 12, -0.4, PI * 0.8, PI * 1.8); g.fillStyle = K.marbleD; g.fill();
      g.beginPath(); g.moveTo(14, -130); g.quadraticCurveTo(40, -150, 46, -190); g.lineWidth = 8; g.strokeStyle = INK; g.stroke(); g.lineWidth = 5.5; g.strokeStyle = K.marbleL; g.stroke();
      g.save(); g.translate(48, -206); g.rotate(0.25);
      g.beginPath(); g.moveTo(-14, 16); g.quadraticCurveTo(-24, -6, -12, -26); g.moveTo(14, 16); g.quadraticCurveTo(24, -6, 12, -26); g.lineWidth = 5; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#5f8f7e'; g.stroke();
      g.fillStyle = '#2c4a44'; g.fillRect(-14, -26, 28, 4); g.fillRect(-14, 14, 28, 4); g.strokeStyle = 'rgba(220,240,230,0.7)'; g.lineWidth = 0.7; for (let k = -8; k <= 8; k += 4) { g.beginPath(); g.moveTo(k, -22); g.lineTo(k, 14); g.stroke(); }
      g.restore();
      g.strokeStyle = rgba(C.moon, 0.8); g.lineWidth = 1.4; g.beginPath(); g.moveTo(18, -120); g.lineTo(24, -60); g.lineTo(24, -4); g.stroke();
      g.restore();
      // basin
      g.beginPath(); g.moveTo(cx - 150, y); g.lineTo(cx - 140, y - 46); g.lineTo(cx + 140, y - 46); g.lineTo(cx + 150, y); g.closePath();
      g.fillStyle = '#4a5078'; g.fill(); ink(g, 2);
      g.fillStyle = '#7c82a8'; g.fillRect(cx - 142, y - 50, 284, 8); g.beginPath(); g.rect(cx - 142, y - 50, 284, 8); ink(g, 1.4);
      g.fillStyle = '#d6e2ff'; g.fillRect(cx - 142, y - 50, 284, 1.4);
      g.strokeStyle = rgba(INK, 0.5); g.lineWidth = 1.2; for (let k = -120; k <= 120; k += 60) { g.beginPath(); g.ellipse(cx + k, y - 22, 16, 10, 0, 0, TAU); g.stroke(); }
      hushXtal(g, cx + 128, y - 50, 20, U.mulberry32(44));
    } });
    // carriage wreck
    objs.push({ x: 5520, y: -230, w: 230, h: 150, draw(g) {
      const x = 5560, y = -90;
      g.save(); g.translate(x, y); g.rotate(0.08);
      g.beginPath(); g.moveTo(10, -30); g.lineTo(0, -100); g.quadraticCurveTo(70, -120, 140, -100); g.lineTo(130, -30); g.closePath(); g.fillStyle = '#1a1d30'; g.fill(); ink(g, 2);
      archPath(g, 30, -92, 34, 44); g.fillStyle = '#ffcf86'; g.globalAlpha = 0.25; g.fill(); g.globalAlpha = 1; ink(g, 1.4);
      g.fillStyle = C.gold; g.fillRect(0, -102, 140, 3); g.fillRect(10, -32, 120, 2);
      g.beginPath(); g.arc(30, -18, 20, 0, TAU); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); for (let k = 0; k < 8; k++) { const a = k * PI / 4; g.beginPath(); g.moveTo(30, -18); g.lineTo(30 + Math.cos(a) * 20, -18 + Math.sin(a) * 20); g.lineWidth = 1.4; g.stroke(); }
      g.restore();
      g.save(); g.translate(x + 150, y - 6); g.rotate(1.3); g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); g.restore();
    } });
    // the façade of the Grand Opera: the doorway the whole backdrop changes at
    objs.push({ x: 6100, y: -1500, w: 400, h: 1420, draw(g) {
      const x0 = 6150, x1 = 6450, y = -90, top = -1500, dx = 6300;
      const stone = '#5a5e86', stoneD = '#2c2f50', stoneL = '#a8b4dc';
      g.fillStyle = stone; g.fillRect(x0, top, x1 - x0, y - top);
      g.fillStyle = stoneD; g.fillRect(x0, top, 40, y - top); g.fillStyle = rgba(C.moon, 0.45); g.fillRect(x1 - 5, top, 5, y - top);
      for (let yy = top + 20; yy < y; yy += 40) { g.fillStyle = 'rgba(11,6,18,0.3)'; g.fillRect(x0, yy, x1 - x0, 2); }
      // twin columns
      for (const cx of [x0 + 20, x1 - 54]) { g.fillStyle = stoneL; g.fillRect(cx, -620, 34, 530); g.fillStyle = stoneD; g.fillRect(cx, -620, 10, 530); g.beginPath(); g.rect(cx, -620, 34, 530); ink(g, 1.6); g.fillStyle = C.gold; g.fillRect(cx - 8, -640, 50, 20); g.beginPath(); g.rect(cx - 8, -640, 50, 20); ink(g, 1.4); }
      // grand doorway: deep red light inside, one door torn off its hinges
      archPath(g, dx - 80, -420, 160, 330); g.fillStyle = '#2a0610'; g.fill();
      g.save(); archPath(g, dx - 80, -420, 160, 330); g.clip();
      const ig = g.createLinearGradient(0, -420, 0, -90); ig.addColorStop(0, '#3a0a16'); ig.addColorStop(1, '#a8402a'); g.fillStyle = ig; g.fillRect(dx - 80, -420, 160, 330);
      glow(g, dx, -150, 140, '#ffb070', 0.45);
      g.fillStyle = '#5a1020'; poly(g, [[dx - 80, -340], [dx - 30, -350], [dx - 50, -90], [dx - 80, -90]]); g.fill(); ink(g, 1.2);
      g.restore();
      archPath(g, dx - 80, -420, 160, 330); ink(g, 2.6);
      archPath(g, dx - 94, -434, 188, 344); g.strokeStyle = C.gold; g.lineWidth = 5; g.stroke(); g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke();
      g.save(); g.translate(dx + 82, -90); g.rotate(-0.25); g.fillStyle = '#4a1018'; g.fillRect(0, -300, 26, 300); g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(0, -300, 26, 300); g.fillStyle = C.gold; g.fillRect(6, -160, 14, 6); g.restore();
      // mask keystone + inscription
      g.save(); g.translate(dx, -450);
      g.beginPath(); g.ellipse(-12, 0, 13, 16, -0.2, 0, TAU); g.fillStyle = C.gold; g.fill(); ink(g, 1.4);
      g.beginPath(); g.ellipse(12, 2, 13, 16, 0.2, 0, TAU); g.fillStyle = '#d9c08a'; g.fill(); ink(g, 1.4);
      g.fillStyle = INK; g.beginPath(); g.ellipse(-16, -3, 3, 2, 0, 0, TAU); g.ellipse(-7, -3, 3, 2, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(-12, 6, 5, 0, PI); g.fill();
      g.beginPath(); g.ellipse(8, -1, 3, 2, 0, 0, TAU); g.ellipse(17, -1, 3, 2, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(12, 12, 5, PI, 0); g.fill();
      g.restore();
      g.fillStyle = stoneD; g.fillRect(x0, -720, x1 - x0, 60); g.fillStyle = C.gold; g.fillRect(x0, -720, x1 - x0, 4); g.fillRect(x0, -664, x1 - x0, 4);
      g.fillStyle = C.goldL; g.font = '700 26px "Noto Serif TC", serif'; g.textAlign = 'center'; g.fillText('潮音大劇院', dx, -682);
      g.font = '600 10px Rajdhani, sans-serif'; g.fillText('TEATRO DELLE MAREE · MDCCCXC', dx, -669);
      // statue niches high up
      for (const nx of [x0 + 60, x1 - 60]) { archPath(g, nx - 22, -1000, 44, 120); g.fillStyle = stoneD; g.fill(); ink(g, 1.4); g.fillStyle = stoneL; g.beginPath(); g.ellipse(nx, -930, 10, 40, 0, 0, TAU); g.fill(); ink(g, 1.2); g.beginPath(); g.arc(nx, -980, 8, 0, TAU); g.fill(); ink(g, 1.2); }
      g.beginPath(); g.rect(x0, top, x1 - x0, y - top); ink(g, 3);
      g.fillStyle = '#7c82a8'; g.fillRect(x0 - 10, y - 18, x1 - x0 + 20, 18); g.beginPath(); g.rect(x0 - 10, y - 18, x1 - x0 + 20, 18); ink(g, 1.6);
      for (const lx of [x0 + 2, x1 - 2]) LAMPS.push({ x: lx, y: -300, r: 110, col: '#ffb070' });
      for (const lx of [x0 + 2, x1 - 2]) { g.fillStyle = C.goldD; g.fillRect(lx - 3, -300, 6, 30); g.fillStyle = '#ffd890'; g.fillRect(lx - 6, -318, 12, 18); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(lx - 6, -318, 12, 18); }
    } });
    // --- the Grand Foyer ---
    // ticket booth
    objs.push({ x: 6840, y: -330, w: 140, h: 250, draw(g) {
      const x = 6860, y = -90;
      g.fillStyle = '#3a1a14'; g.fillRect(x, y - 140, 100, 140); g.beginPath(); g.rect(x, y - 140, 100, 140); ink(g, 1.8);
      archPath(g, x + 20, y - 120, 60, 60); g.fillStyle = '#1a0a0c'; g.fill(); g.strokeStyle = C.gold; g.lineWidth = 3; g.stroke();
      g.fillStyle = C.gold; g.fillRect(x - 6, y - 150, 112, 12); g.fillRect(x - 4, y - 50, 108, 6);
      g.beginPath(); g.moveTo(x - 6, y - 150); g.quadraticCurveTo(x + 50, y - 210, x + 106, y - 150); g.closePath(); g.fill(); ink(g, 1.4);
      g.fillStyle = INK; g.font = '700 11px "Noto Serif TC", serif'; g.textAlign = 'center'; g.fillText('售票處', x + 50, y - 160);
      LAMPS.push({ x: x + 50, y: y - 96, r: 80, col: '#ffb070' });
    } });
    // the grand staircase up to the rehearsal gallery
    objs.push({ x: 6940, y: -640, w: 520, h: 560, draw(g) {
      const x0 = 6960, y0 = -90, x1 = 7400, y1 = -600;
      g.beginPath(); g.moveTo(x0, y0); for (let k = 0; k <= 22; k++) { const t = k / 22; g.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); g.lineTo(x0 + (x1 - x0) * (t + 1 / 22), y0 + (y1 - y0) * t); }
      g.lineTo(x1, y0); g.closePath(); g.fillStyle = '#5a4a50'; g.fill(); ink(g, 1.6);
      g.fillStyle = '#8a1a2a'; g.beginPath(); g.moveTo(x0 + 20, y0); g.lineTo(x1 + 4, y1 + 16); g.lineTo(x1 + 4, y1 + 30); g.lineTo(x0 + 40, y0); g.closePath(); g.fill();
      g.strokeStyle = C.gold; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0 - 40); g.lineTo(x1, y1 - 40); g.stroke();
      g.lineWidth = 1.4; for (let k = 0; k <= 22; k++) { const t = k / 22; g.beginPath(); g.moveTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); g.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 40); g.stroke(); }
      g.fillStyle = '#2a1416'; g.fillRect(x0 + 120, y0 - 80, 300, 80); // shadowed undercroft
      archPath(g, x0 + 200, y0 - 150, 120, 150); g.fillStyle = '#12060a'; g.fill(); ink(g, 1.4);
      candelabra(g, x0 - 10, y0, { gold: C.gold, goldD: C.goldD });
    } });
    // statues on plinths, velvet ropes, a fallen small chandelier, potted dead palms
    const KF = { marble: '#a89c94', marbleD: '#4a3a40', marbleL: '#e6dccb', gold: C.gold };
    objs.push({ x: 7820, y: -400, w: 140, h: 320, draw(g) { museStatue(g, 7890, -90, 1, KF, 1); } });
    objs.push({ x: 8320, y: -400, w: 140, h: 320, draw(g) { museStatue(g, 8390, -90, 1, KF, 2); } });
    objs.push({ x: 7550, y: -140, w: 260, h: 60, draw(g) {
      for (const px of [7570, 7680, 7790]) { g.fillStyle = C.gold; g.fillRect(px - 3, -130, 6, 40); g.beginPath(); g.arc(px, -132, 6, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(px - 3, -130, 6, 40); }
      g.strokeStyle = '#8a1a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(7570, -124); g.quadraticCurveTo(7625, -100, 7680, -124); g.quadraticCurveTo(7735, -100, 7790, -124); g.stroke();
    } });
    objs.push({ x: 8100, y: -170, w: 200, h: 90, draw(g) {
      g.save(); g.translate(8200, -96); g.rotate(0.35);
      for (const [rx, ry] of [[50, 10], [34, -12]]) { g.beginPath(); g.ellipse(0, ry, rx, rx * 0.25, 0, 0, TAU); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); g.lineWidth = 2.4; g.strokeStyle = C.gold; g.stroke(); }
      g.restore();
      g.fillStyle = 'rgba(220,235,255,0.7)'; const rr = U.mulberry32(81); for (let k = 0; k < 18; k++) { const x = 8130 + rr() * 150, y = -92 + rr() * 4; poly(g, [[x, y], [x + 3, y - 4], [x + 6, y]]); g.fill(); }
      hushXtal(g, 8170, -90, 14, rr);
    } });
    for (const px of [6640, 8560, 9300]) objs.push({ x: px - 40, y: -260, w: 80, h: 180, draw(g) {
      g.fillStyle = '#5a2a1a'; poly(g, [[px - 18, -90], [px - 22, -128], [px + 22, -128], [px + 18, -90]]); g.fill(); ink(g, 1.4); g.fillStyle = C.gold; g.fillRect(px - 22, -128, 44, 4);
      g.strokeStyle = '#3a3020'; g.lineWidth = 2; for (let k = 0; k < 5; k++) { const a = -PI / 2 + (k - 2) * 0.5; g.beginPath(); g.moveTo(px, -128); g.quadraticCurveTo(px + Math.cos(a) * 30, -170, px + Math.cos(a) * 46, -150 + Math.abs(k - 2) * 14); g.stroke(); }
    } });
    // the auditorium doors: torn portières; the backdrop swaps behind them
    objs.push({ x: 9330, y: -1300, w: 230, h: 1220, draw(g) {
      const x0 = 9360, x1 = 9520, y = -90;
      g.fillStyle = '#2a0c12'; g.fillRect(x0, -1300, x1 - x0, 1210);
      g.fillStyle = '#4a1a20'; g.fillRect(x0, -1300, 30, 1210); g.fillRect(x1 - 30, -1300, 30, 1210);
      g.fillStyle = C.gold; g.fillRect(x0 + 26, -1300, 6, 1210); g.fillRect(x1 - 32, -1300, 6, 1210);
      archPath(g, x0 + 36, -420, x1 - x0 - 72, 330); g.fillStyle = '#0c0306'; g.fill();
      g.save(); archPath(g, x0 + 36, -420, x1 - x0 - 72, 330); g.clip(); glow(g, (x0 + x1) / 2, -200, 120, '#cfe2ff', 0.2); g.restore();
      archPath(g, x0 + 36, -420, x1 - x0 - 72, 330); g.strokeStyle = C.gold; g.lineWidth = 4; g.stroke(); g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke();
      g.fillStyle = C.velvet; poly(g, [[x0 + 36, -420], [x0 + 70, -420], [x0 + 52, -200], [x0 + 60, -90], [x0 + 36, -90]]); g.fill(); ink(g, 1.4);
      poly(g, [[x1 - 36, -420], [x1 - 64, -420], [x1 - 48, -240], [x1 - 70, -150], [x1 - 36, -150]]); g.fill(); ink(g, 1.4);
      g.fillStyle = C.goldL; g.font = '700 14px "Noto Serif TC", serif'; g.textAlign = 'center'; g.fillText('觀 眾 席', (x0 + x1) / 2, -440);
      g.beginPath(); g.rect(x0, -1300, x1 - x0, 1210); ink(g, 2.4);
    } });
    // --- the drowned stalls ---
    objs.push({ x: STALLS_X, y: -60, w: STAGE_X - 100 - STALLS_X, h: 80, draw(g) {
      // two rows of velvet seats breaking the surface
      const rr = U.mulberry32(3131);
      for (const [ry, sc, off] of [[-6, 0.8, 0], [4, 1, 18]]) {
        for (let x = STALLS_X + 30 + off; x < STAGE_X - 120; x += 40 * sc + 4) {
          if (rr() < 0.12) continue;
          const tl = (rr() - 0.5) * 0.25, sw = 30 * sc, sh = 24 * sc;
          g.save(); g.translate(x, ry); g.rotate(tl);
          g.beginPath(); g.moveTo(-sw / 2, 0); g.lineTo(-sw / 2, -sh + 6); g.quadraticCurveTo(-sw / 2, -sh, -sw / 2 + 6, -sh); g.lineTo(sw / 2 - 6, -sh); g.quadraticCurveTo(sw / 2, -sh, sw / 2, -sh + 6); g.lineTo(sw / 2, 0); g.closePath();
          g.fillStyle = sc < 1 ? '#4a0c18' : '#7a1426'; g.fill(); ink(g, 1.3);
          g.fillStyle = sc < 1 ? '#6a1a28' : '#b0303e'; g.fillRect(-sw / 2 + 3, -sh + 3, sw - 6, 3);
          g.fillStyle = C.gold; g.fillRect(-4, -sh * 0.45, 8, 4);
          g.restore();
        }
        g.fillStyle = 'rgba(40,6,14,0.6)'; g.fillRect(STALLS_X, ry - 2, STAGE_X - 100 - STALLS_X, 3);
      }
    } });
    // orchestra pit rail + the conductor's podium (the stage manager waits in the wings beside it)
    objs.push({ x: 11050, y: -220, w: 400, h: 240, draw(g) {
      g.strokeStyle = C.gold; g.lineWidth = 3; g.beginPath(); g.moveTo(11260, -40); g.lineTo(11400, -40); g.stroke();
      for (let x = 11264; x < 11400; x += 22) { g.fillStyle = C.goldD; g.fillRect(x, -40, 3, 40); }
      g.fillStyle = '#2a1416'; poly(g, [[11290, 0], [11300, -30], [11360, -30], [11370, 0]]); g.fill(); ink(g, 1.4);
      g.strokeStyle = '#1b1416'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(11330, -30); g.lineTo(11330, -96); g.stroke();
      poly(g, [[11306, -110], [11354, -102], [11352, -86], [11308, -94]]); g.fillStyle = '#2a1416'; g.fill(); ink(g, 1.4);
      g.fillStyle = '#e8dcc0'; poly(g, [[11312, -106], [11348, -100], [11347, -92], [11313, -98]]); g.fill();
      // prompter's lamp
      g.strokeStyle = '#1b1416'; g.lineWidth = 2; g.beginPath(); g.moveTo(11120, 0); g.lineTo(11126, -60); g.moveTo(11132, 0); g.lineTo(11126, -60); g.stroke();
      poly(g, [[11116, -60], [11136, -60], [11140, -74], [11112, -74]]); g.fillStyle = '#2a1a12'; g.fill(); ink(g, 1.2);
      LAMPS.push({ x: 11126, y: -58, r: 90, col: '#ffcf86' });
    } });
    // --- the last stage: proscenium arch, legs and border, a torn painted backdrop of moonlit Lyra ---
    objs.push({ x: ARENA0 - 160, y: -1400, w: END_X - ARENA0 + 320, h: 1400, draw(g) {
      const a0 = ARENA0, a1 = END_X, mid = (a0 + a1) / 2;
      // backdrop canvas
      const bx0 = a0 + 50, bx1 = a1 - 50, by0 = -800, by1 = -30;
      const bg = g.createLinearGradient(0, by0, 0, by1); bg.addColorStop(0, '#1a2650'); bg.addColorStop(0.55, '#4a5f98'); bg.addColorStop(0.62, '#2a3c6a'); bg.addColorStop(1, '#141c38');
      g.fillStyle = bg; g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
      // painted moon + painted city + painted waves (theatre flats: flat colour, brush strokes)
      g.fillStyle = '#f0ead0'; g.beginPath(); g.arc(mid + 260, -560, 70, 0, TAU); g.fill(); g.strokeStyle = 'rgba(160,140,90,0.7)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = 'rgba(240,234,208,0.2)'; g.beginPath(); g.arc(mid + 260, -560, 110, 0, TAU); g.fill();
      g.fillStyle = '#1e2a52';
      const rr = U.mulberry32(1212);
      g.beginPath(); g.moveTo(bx0, -300); for (let x = bx0; x < bx1; x += 40 + rr() * 50) { const h = 40 + rr() * 120; g.lineTo(x, -300 - h); g.lineTo(x + 30, -300 - h); if (rr() < 0.25) { g.arc(x + 15, -300 - h, 15, PI, 0); } } g.lineTo(bx1, -300); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(210,220,255,0.35)'; g.lineWidth = 3;
      for (let y = -260; y < -40; y += 34) { g.beginPath(); for (let x = bx0; x < bx1; x += 60) { g.moveTo(x, y + (x / 60 % 2) * 6); g.quadraticCurveTo(x + 30, y - 12 + (x / 60 % 2) * 6, x + 60, y + (x / 60 % 2) * 6); } g.stroke(); }
      g.fillStyle = 'rgba(255,250,220,0.5)'; for (let k = 0; k < 10; k++) g.fillRect(mid + 230 + (rr() - 0.5) * 40, -260 + k * 22, 60 - k * 4, 3);
      // the tear: the dark of the fly tower behind
      g.fillStyle = '#06030a'; poly(g, [[mid - 420, by0], [mid - 300, by0], [mid - 330, -560], [mid - 280, -460], [mid - 360, -380], [mid - 400, -520]]); g.fill();
      g.strokeStyle = '#d8c8a8'; g.lineWidth = 2; g.beginPath(); g.moveTo(mid - 300, by0); g.lineTo(mid - 330, -560); g.lineTo(mid - 280, -460); g.lineTo(mid - 360, -380); g.stroke();
      g.beginPath(); g.rect(bx0, by0, bx1 - bx0, by1 - by0); ink(g, 2);
      g.fillStyle = '#2a1a12'; g.fillRect(bx0 - 10, by0 - 12, bx1 - bx0 + 20, 12); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(bx0 - 10, by0 - 12, bx1 - bx0 + 20, 12);
      // legs (side curtains) and the border valance
      for (const [lx, dir] of [[a0, 1], [a1, -1]]) {
        g.beginPath(); g.moveTo(lx, -980); g.lineTo(lx + dir * 90, -980); g.quadraticCurveTo(lx + dir * 60, -500, lx + dir * 80, 0); g.lineTo(lx, 0); g.closePath();
        g.fillStyle = C.velvet; g.fill();
        g.save(); g.clip(); g.strokeStyle = C.velvetD; g.lineWidth = 7; for (let k = 15; k < 90; k += 22) { g.beginPath(); g.moveTo(lx + dir * k, -980); g.quadraticCurveTo(lx + dir * (k - 10), -500, lx + dir * k * 0.9, 0); g.stroke(); } g.strokeStyle = C.velvetL; g.lineWidth = 2; g.beginPath(); g.moveTo(lx + dir * 86, -980); g.quadraticCurveTo(lx + dir * 58, -500, lx + dir * 78, 0); g.stroke(); g.restore();
        g.beginPath(); g.moveTo(lx + dir * 90, -980); g.quadraticCurveTo(lx + dir * 60, -500, lx + dir * 80, 0); ink(g, 1.8);
      }
      g.beginPath(); g.moveTo(a0, -1000); g.lineTo(a1, -1000); g.lineTo(a1, -880);
      for (let x = a1; x > a0; x -= 140) g.quadraticCurveTo(x - 70, -800, x - 140, -880);
      g.closePath(); g.fillStyle = C.velvet; g.fill(); ink(g, 2);
      g.strokeStyle = C.gold; g.lineWidth = 4; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(a1, -880); for (let x = a1; x > a0; x -= 140) g.quadraticCurveTo(x - 70, -800, x - 140, -880); g.stroke(); g.setLineDash([]);
      // gilded proscenium frame
      for (const [px, w] of [[a0 - 130, 130], [a1, 130]]) {
        g.fillStyle = C.goldD; g.fillRect(px, -1400, w, 1400); g.fillStyle = C.gold; g.fillRect(px + 14, -1400, w - 28, 1400); g.fillStyle = C.goldL; g.fillRect(px + w - 30, -1400, 8, 1400);
        g.fillStyle = C.goldD; for (let y = -1360; y < 0; y += 120) { g.beginPath(); g.ellipse(px + w / 2, y, 26, 40, 0, 0, TAU); g.fill(); }
        g.strokeStyle = INK; g.lineWidth = 2.2; g.strokeRect(px, -1400, w, 1400);
      }
      g.fillStyle = C.goldD; g.fillRect(a0 - 130, -1140, a1 - a0 + 260, 140); g.fillStyle = C.gold; g.fillRect(a0 - 130, -1126, a1 - a0 + 260, 112); g.fillStyle = C.goldL; g.fillRect(a0 - 130, -1030, a1 - a0 + 260, 6);
      g.strokeStyle = INK; g.lineWidth = 2.2; g.strokeRect(a0 - 130, -1140, a1 - a0 + 260, 140);
      // cartouche: comedy & tragedy
      g.save(); g.translate(mid, -1070);
      g.beginPath(); g.ellipse(0, 0, 110, 56, 0, 0, TAU); g.fillStyle = C.goldD; g.fill(); ink(g, 2);
      for (const [mx, sg] of [[-36, 1], [36, -1]]) {
        g.beginPath(); g.ellipse(mx, 0, 28, 34, sg * 0.2, 0, TAU); g.fillStyle = sg > 0 ? '#f0e0b0' : '#d8c890'; g.fill(); ink(g, 1.6);
        g.fillStyle = INK; g.beginPath(); g.ellipse(mx - 10, -8, 6, 4, sg * 0.3, 0, TAU); g.ellipse(mx + 10, -8, 6, 4, -sg * 0.3, 0, TAU); g.fill();
        g.beginPath(); if (sg > 0) g.arc(mx, 8, 12, 0, PI); else g.arc(mx, 20, 12, PI, 0); g.fill();
      }
      g.restore();
    } });
    // Hush crystals scattered through the chapter
    for (const [x, y, s] of [[1640, 0, 30], [3180, 0, 26], [4300, -90, 22], [6060, -90, 34], [8660, -90, 24], [9560, 0, 30], [11020, 0, 26]]) {
      objs.push({ x: x - s * 2, y: y - s * 2.6, w: s * 4, h: s * 2.8, draw(g) { hushXtal(g, x, y, s, U.mulberry32(x | 0)); } });
    }
    return objs;
  }

  /* =============================== LIVE (per-frame) VISUALS =============================== */
  const FX4 = { rip: [], ripT: 0, hazT: 0, chand: null, ovT: -1, fog: null, stars: null, motes: null };
  const inView = (game, x0, x1) => { const c = game.cam, hw = game.W / 2 / (game.baseS * c.zoom) + 200; return x1 > c.x - hw && x0 < c.x + hw; };
  function makeFogSprite() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 32, 4, 128, 32, 128); gr.addColorStop(0, 'rgba(200,215,245,0.55)'); gr.addColorStop(1, 'rgba(200,215,245,0)');
    g.setTransform(1, 0, 0, 0.25, 0, 24); g.fillStyle = gr; g.fillRect(0, -100, 256, 300); return c;
  }
  // the auditorium chandelier, pre-rendered once (hanging + wrecked)
  function chandSprite(broken) {
    const c = document.createElement('canvas'), s = 2; c.width = 420 * s; c.height = 300 * s;
    const g = c.getContext('2d'); g.scale(s, s); g.translate(210, 150);
    const K = { gold: C.gold, goldD: C.goldD };
    if (broken) g.rotate(0.42);
    for (const [ry, rx, n] of [[-60, 70, 8], [-10, 130, 12], [40, 96, 10]]) {
      g.beginPath(); g.ellipse(0, ry, rx, rx * 0.2, 0, 0, broken && ry > 0 ? PI * 1.2 : TAU); g.lineWidth = 8; g.strokeStyle = INK; g.stroke(); g.lineWidth = 5; g.strokeStyle = K.gold; g.stroke();
      g.lineWidth = 1.6; g.strokeStyle = C.goldL; g.beginPath(); g.ellipse(0, ry - 2, rx, rx * 0.2, 0, PI * 1.1, PI * 1.9); g.stroke();
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU, px = Math.cos(a) * rx, py = ry + Math.sin(a) * rx * 0.2;
        if (broken && k % 3 === 0) continue;
        g.fillStyle = 'rgba(225,238,255,0.9)'; poly(g, [[px - 3.5, py + 4], [px + 3.5, py + 4], [px, py + 26]]); g.fill(); g.strokeStyle = 'rgba(11,6,18,0.7)'; g.lineWidth = 0.8; g.stroke();
        if (!broken) { g.fillStyle = '#f2e6c8'; g.fillRect(px - 2.5, py - 16, 5, 13); g.strokeRect(px - 2.5, py - 16, 5, 13); g.fillStyle = '#fff3c0'; g.beginPath(); g.ellipse(px, py - 20, 2.2, 4.5, 0, 0, TAU); g.fill(); }
      }
    }
    g.beginPath(); g.moveTo(-14, -80); g.lineTo(0, -120); g.lineTo(14, -80); g.closePath(); g.fillStyle = K.gold; g.fill(); ink(g, 1.6);
    g.beginPath(); g.moveTo(-20, 60); g.lineTo(0, 110); g.lineTo(20, 60); g.closePath(); g.fillStyle = K.gold; g.fill(); ink(g, 1.6);
    g.strokeStyle = K.goldD; g.lineWidth = 4; for (const a of [-1, 1]) { g.beginPath(); g.moveTo(0, -80); g.quadraticCurveTo(a * 90, -60, a * 128, -14); g.stroke(); }
    if (broken) hushXtal(g, 30, 70, 30, U.mulberry32(5));
    return c;
  }
  function drawChandelier(ctx, game, time) {
    const F = game.save.flags, st = FX4.chand;
    if (!inView(game, CHAND.x - 260, CHAND.x + 260)) return;
    if (!FX4.sprH) { FX4.sprH = chandSprite(false); FX4.sprB = chandSprite(true); }
    if (F.c4_chandelier_down && !(st && st.phase === 'fall')) {
      // the wreck lies half-drowned in the stalls: clip it at the waterline, a dark wet band where it enters
      ctx.save(); ctx.beginPath(); ctx.rect(CHAND.x - 220, -420, 440, 426); ctx.clip();
      ctx.drawImage(FX4.sprB, CHAND.x - 210, -150 + 60, 420, 300); ctx.restore();
      ctx.fillStyle = 'rgba(30,6,12,0.55)'; ctx.beginPath(); ctx.ellipse(CHAND.x, 2, 170, 6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,210,170,${0.35 + 0.15 * Math.sin(time * 2)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(CHAND.x, 2, 150 + Math.sin(time) * 10, 4, 0, 0, TAU); ctx.stroke();
      return;
    }
    let y = CHAND.hang, sway = Math.sin(time * 0.6) * 0.02;
    if (st) { if (st.phase === 'creak') sway = Math.sin(st.t * 9) * 0.06 * Math.min(1, st.t); if (st.phase === 'fall') { y = CHAND.hang + Math.min(1, st.ft / 0.55) ** 2 * (-CHAND.hang - 40); sway = st.ft * 0.6; } }
    ctx.save(); ctx.translate(CHAND.x, CHAND.top); ctx.rotate(sway);
    ctx.strokeStyle = '#1a0e0c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, y - CHAND.top - 120); ctx.stroke();
    ctx.translate(0, y - CHAND.top);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 260); gr.addColorStop(0, 'rgba(255,200,120,0.28)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = gr; ctx.fillRect(-260, -260, 520, 520); ctx.restore();
    ctx.drawImage(FX4.sprH, -210, -150, 420, 300);
    ctx.restore();
  }
  function drawSimon(ctx, x, y, t, game) {
    const F = game.save.flags, done = !!F.c4_quest_done, P = game.player, Rig = G.Rig;
    const look = P && P.x < x ? -1 : 1;
    // the prompter's lamp light on him (the lamp itself is baked in the props)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fl = done ? 0.5 : U.clamp(0.62 + 0.22 * Math.sin(t * 11.3) * Math.sin(t * 2.7) + (U.noise1(t * 5, 3) - 0.5) * 0.4, 0.2, 0.92);
    const ag = ctx.createRadialGradient(x, y - 80, 0, x, y - 80, 110); ag.addColorStop(0, `rgba(150,240,230,${0.22 * fl})`); ag.addColorStop(1, 'rgba(150,240,230,0)');
    ctx.fillStyle = ag; ctx.fillRect(x - 110, y - 190, 220, 220); ctx.restore();
    const glitch = !done && U.noise1(t * 1.7, 9) > 0.8 ? (U.noise1(t * 40, 2) - 0.5) * 10 : 0;
    ctx.save(); ctx.translate(x + glitch, y); ctx.scale(look, 1); ctx.globalAlpha = fl;
    const br = Math.sin(t * 1.5) * 0.02;
    const pose = Rig.full({ torso: 0.16 + br, head: -0.05 + Math.sin(t * 0.7) * 0.04, tF: 0.08, kF: -0.06, tB: -0.1, kB: -0.04, aF: done ? 0.3 : -0.5 + Math.sin(t * 1.3) * 0.15, eF: done ? 0.4 : -1.2, aB: 0.35, eB: 1.9, sw: 0 });
    const J = Rig.compute(pose), LC = Rig.limbChain, Lm = Rig.limb;
    const cloth = '#5f8a96', clothD = '#3c5e6e', skin = '#d8f2ee', shirt = '#cfe6ea';
    LC(ctx, [J.shB, J.elB, J.hdB], [3, 2.6, 2.1], shirt);
    LC(ctx, [J.hip, J.kneeB, J.ankB], [5, 4.2, 3], clothD); Lm(ctx, J.ankB, J.toeB, 2.8, 1.8, '#26363e');
    // waistcoat torso
    const tA = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x), ux = Math.cos(tA), uy = Math.sin(tA), nx = -uy, ny = ux;
    const Q = (a, f) => ({ x: J.hip.x + ux * a * 36 + nx * f, y: J.hip.y + uy * a * 36 + ny * f });
    const tp = [Q(-0.1, -8), Q(0.5, -8.5), Q(1.05, -9), Q(1.1, 7), Q(0.5, 8.5), Q(-0.1, 8)];
    ctx.beginPath(); ctx.moveTo(tp[0].x, tp[0].y); for (const p of tp.slice(1)) ctx.lineTo(p.x, p.y); ctx.closePath();
    ctx.fillStyle = Rig.celGrad(ctx, Q(0.5, 0).x, Q(0.5, 0).y, nx, ny, 10, 1, Rig.ramp(cloth)); ctx.fill(); ink(ctx, 1.2, '#10202a');
    ctx.fillStyle = shirt; const s0 = Q(0.95, -2), s1 = Q(0.95, 3), s2 = Q(0.4, 1); ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8d090'; const w0 = Q(0.6, 4), w1 = Q(0.45, 6); ctx.fillRect(w0.x, w0.y, 1.5, 1.5); ctx.fillRect(w1.x, w1.y, 1.5, 1.5); // watch chain
    LC(ctx, [J.hip, J.kneeF, J.ankF], [5.4, 4.6, 3.2], cloth); Lm(ctx, J.ankF, J.toeF, 3, 1.9, '#26363e');
    // prompt book in the back hand
    ctx.save(); ctx.translate(J.hdB.x, J.hdB.y); ctx.rotate(-0.4); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-6, -12, 14, 18); ink(ctx, 1, '#10202a'); ctx.fillStyle = '#efe6cc'; ctx.fillRect(-4, -10, 10, 14); ctx.restore();
    LC(ctx, [J.sh, J.elF, J.hdF], [3.2, 2.8, 2.2], shirt);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(J.hdF.x, J.hdF.y, 2.6, 0, TAU); ctx.fill();
    // head: flat cap, spectacles, moustache
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    ctx.beginPath(); ctx.ellipse(1, 1, 8.6, 9.8, 0, 0, TAU); ctx.fillStyle = skin; ctx.fill(); ink(ctx, 1.1, '#10202a');
    ctx.beginPath(); ctx.ellipse(-1, -6, 10, 4.6, -0.1, PI, TAU); ctx.lineTo(12, -5); ctx.closePath(); ctx.fillStyle = '#3c5e6e'; ctx.fill(); ink(ctx, 1, '#10202a');
    ctx.strokeStyle = '#10202a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(5.5, 0, 2.6, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-4, -1); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(6, -1.4, 1.2, 1.2);
    ctx.fillStyle = '#9fc4c8'; ctx.beginPath(); ctx.ellipse(6, 5, 4, 1.6, 0.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e8d090'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(-9, 3); ctx.stroke(); // pencil
    ctx.restore();
    // scanline flicker over the ghost
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(160,250,240,0.18)'; for (let k = 0; k < 8; k++) ctx.fillRect(-20, -150 + ((t * 40 + k * 20) % 160), 40, 2);
    ctx.restore();
  }
  function drawGhostAudience(ctx, game, time) {
    if (!game.save.flags.c4_ovation || !inView(game, STALLS_X, STAGE_X)) return;
    const k = FX4.ovT >= 0 ? U.clamp(FX4.ovT / 2, 0, 1) : 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const seats = [];
    for (let x = STALLS_X + 70; x < STAGE_X - 140; x += 96) seats.push([x, -18]);
    for (const p of G.LEVEL.oneways) if (p.x > STALLS_X && p.x < STAGE_X) seats.push([p.x + p.w * 0.35, p.y - 4], [p.x + p.w * 0.7, p.y - 4]);
    seats.forEach(([x, y], i) => {
      const fl = (0.18 + 0.12 * Math.sin(time * 3 + i * 1.7)) * k, clap = Math.abs(Math.sin(time * 9 + i)) * 6;
      ctx.fillStyle = `rgba(170,235,255,${fl})`;
      ctx.beginPath(); ctx.arc(x, y - 30, 7, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.quadraticCurveTo(x - 12, y - 22, x, y - 22); ctx.quadraticCurveTo(x + 12, y - 22, x + 12, y); ctx.fill();
      ctx.fillRect(x - 8 + clap * 0.3, y - 24, 4, 4); ctx.fillRect(x + 4 - clap * 0.3, y - 24, 4, 4);
    });
    ctx.restore();
  }
  function drawPools(ctx, game, time) {
    // black Hush water: inky, a crimson rim, sluggish bubbles
    for (const h of HAZ) {
      if (!inView(game, h.x0, h.x1)) continue;
      const cx = (h.x0 + h.x1) / 2, rx = (h.x1 - h.x0) / 2;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(cx, h.y, 0, cx, h.y, rx * 1.3); gr.addColorStop(0, 'rgba(255,40,90,0.22)'); gr.addColorStop(1, 'rgba(255,40,90,0)');
      ctx.fillStyle = gr; ctx.fillRect(cx - rx * 1.3, h.y - 40, rx * 2.6, 60); ctx.restore();
      ctx.beginPath(); ctx.ellipse(cx, h.y + 2, rx, 6, 0, 0, TAU); ctx.fillStyle = '#050208'; ctx.fill();
      ctx.strokeStyle = `rgba(255,60,110,${0.55 + 0.25 * Math.sin(time * 3)})`; ctx.lineWidth = 1.6; ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const ph = (time * 0.6 + i * 0.27) % 1, bx = cx + Math.sin(i * 7.3) * rx * 0.7, r = 2 + ph * 4;
        ctx.strokeStyle = `rgba(255,120,160,${(1 - ph) * 0.7})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(bx, h.y + 1, r * 1.6, r * 0.5, 0, 0, TAU); ctx.stroke();
      }
      for (let i = 0; i < 3; i++) { const ph = (time * 0.5 + i * 0.33) % 1; ctx.fillStyle = `rgba(30,6,16,${0.6 * (1 - ph)})`; ctx.beginPath(); ctx.arc(cx + (i - 1) * rx * 0.5, h.y - ph * 40, 3 + ph * 4, 0, TAU); ctx.fill(); }
    }
    // the deep pools: still, dark, slow rings (something lives there)
    for (const p of WPOOLS) {
      if (!inView(game, p.x0, p.x1)) continue;
      const cx = (p.x0 + p.x1) / 2, rx = (p.x1 - p.x0) / 2;
      ctx.beginPath(); ctx.ellipse(cx, p.y + 2, rx, 7, 0, 0, TAU); ctx.fillStyle = '#040915'; ctx.fill(); ctx.strokeStyle = 'rgba(11,6,18,0.9)'; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 3; i++) { const ph = (time * 0.25 + i / 3) % 1; ctx.strokeStyle = `rgba(150,200,255,${(1 - ph) * 0.35})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx + Math.sin(i * 3) * rx * 0.3, p.y + 2, rx * 0.2 + ph * rx * 0.75, 1.5 + ph * 4, 0, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = 'rgba(220,235,255,0.6)'; ctx.fillRect(cx - rx * 0.4 + Math.sin(time * 0.7) * 10, p.y + 1, rx * 0.3, 1);
    }
  }
  function drawLampGlows(ctx, game, time) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < LAMPS.length; i++) {
      const l = LAMPS[i];
      if (!inView(game, l.x - l.r, l.x + l.r)) continue;
      const fl = 0.85 + 0.15 * Math.sin(time * 7 + i * 2.3) * Math.sin(time * 2.1 + i);
      const gr = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); gr.addColorStop(0, rgba(l.col, 0.42 * fl)); gr.addColorStop(0.3, rgba(l.col, 0.14 * fl)); gr.addColorStop(1, rgba(l.col, 0));
      ctx.fillStyle = gr; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      // reflection in the water below (boulevard / stalls): a shimmering column
      const wet = l.x < PLAZA_X || (l.x > STALLS_X && l.x < STAGE_X);
      if (wet) for (let k = 0; k < 8; k++) { ctx.fillStyle = rgba(l.col, (0.22 - k * 0.025) * fl); const w = 10 + Math.sin(time * 3 + k * 1.3 + i) * 5; ctx.fillRect(l.x - w / 2, 16 + k * 9, w, 2); }
    }
    // footlights along the stage lip
    if (inView(game, ARENA0, END_X)) {
      for (let x = ARENA0 + 40; x < END_X; x += 110) {
        const fl = 0.8 + 0.2 * Math.sin(time * 9 + x);
        const gr = ctx.createRadialGradient(x, -4, 0, x, -4, 70); gr.addColorStop(0, `rgba(255,214,150,${0.35 * fl})`); gr.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.fillStyle = gr; ctx.fillRect(x - 70, -74, 140, 80);
        ctx.fillStyle = `rgba(255,240,200,${0.8 * fl})`; ctx.fillRect(x - 6, -2, 12, 2);
      }
    }
    ctx.restore();
  }
  function drawWaterLife(ctx, game, time) {
    // moving glints on the black mirror in front of the causeway / the stalls
    const c = game.cam, hw = game.W / 2 / (game.baseS * c.zoom);
    const wetAt = (x) => x < PLAZA_X || (x > STALLS_X && x < STAGE_X);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const x = Math.floor((c.x - hw) / 60) * 60 + i * 60 + ((time * 14 + i * 37) % 60);
      if (!wetAt(x)) continue;
      const y = 22 + ((i * 53) % 90), a = 0.25 + 0.25 * Math.sin(time * 2 + i * 1.9);
      ctx.fillStyle = x > STALLS_X ? `rgba(255,200,150,${a * 0.6})` : `rgba(200,225,255,${a})`; ctx.fillRect(x, y, 6 + (i % 4) * 5, 1);
    }
    ctx.restore();
    // ripples under the player's feet
    for (let i = FX4.rip.length - 1; i >= 0; i--) {
      const r = FX4.rip[i], k = r.t / 0.9;
      if (k >= 1) { FX4.rip.splice(i, 1); continue; }
      ctx.strokeStyle = r.warm ? `rgba(255,210,170,${(1 - k) * 0.6})` : `rgba(200,225,255,${(1 - k) * 0.6})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(r.x, r.y + 1, 8 + k * 46 * r.s, 1.5 + k * 4, 0, 0, TAU); ctx.stroke();
    }
  }
  function drawFog(ctx, game, time) {
    if (G.Quality.low) return;
    const c = game.cam; if (c.x > PLAZA_X + 600) return;
    if (!FX4.fog) FX4.fog = makeFogSprite();
    ctx.save(); ctx.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++) {
      const span = 1600, x = Math.floor(c.x / span) * span + ((i * 523 + time * 18) % span) - span / 2 + i * 120;
      ctx.drawImage(FX4.fog, x - 260, -40 - (i % 2) * 20, 520, 70);
    }
    ctx.restore();
  }

  /* =============================== SKY + ATMOSPHERE =============================== */
  function initStars() {
    const r = U.mulberry32(2604);
    FX4.stars = Array.from({ length: 140 }, () => ({ x: r(), y: r() * r(), a: 0.3 + r() * 0.7, s: r() < 0.1 ? 2 : 1.2, f: 0.5 + r() * 3, p: r() * 10, c: r() < 0.15 ? '#ffe2c0' : '#e6eeff' }));
    FX4.motes = Array.from({ length: 50 }, () => ({ x: r(), y: r(), z: 0.4 + r() * 1.2, p: r() * 10, s: 0.8 + r() * 1.6, k: r() }));
  }
  function drawSky(ctx, cam, W, H, S, time, WK) {
    if (!FX4.stars) initStars();
    const t = WK.L.tintAt(cam.x), P = WK.P, sky = CH4.sky;
    const horizonY = H / 2 + (60 - cam.y * 0.03) * S;
    const gr = ctx.createLinearGradient(0, 0, 0, horizonY + 40 * S);
    gr.addColorStop(0, P('skyTop', t)); gr.addColorStop(0.5, P('skyMid', t)); gr.addColorStop(0.86, P('skyLow', t)); gr.addColorStop(1, P('horizon', t));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    const n = G.Quality.low ? 60 : 140;
    for (let i = 0; i < n; i++) {
      const s = FX4.stars[i], px = ((s.x * W * 1.3 - cam.x * 0.004 * S) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15, py = s.y * horizonY * 0.92;
      ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(time * s.f + s.p)); ctx.fillStyle = s.c; ctx.fillRect(px, py, s.s * S, s.s * S);
    }
    ctx.globalAlpha = 1;
    // the full moon: halo, hard-cel gibbous disc, inked rim
    const mx = W * sky.sunX - cam.x * 0.01 * S, my = horizonY - sky.sunY * S, R = 44 * S;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(mx, my, R * 0.8, mx, my, R * 7); hg.addColorStop(0, 'rgba(200,220,255,0.4)'); hg.addColorStop(0.25, 'rgba(150,180,240,0.12)'); hg.addColorStop(1, 'rgba(120,150,220,0)');
    ctx.fillStyle = hg; ctx.fillRect(mx - R * 7, my - R * 7, R * 14, R * 14);
    ctx.strokeStyle = 'rgba(200,220,255,0.12)'; ctx.lineWidth = 1.5 * S; ctx.beginPath(); ctx.arc(mx, my, R * 2.2, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(mx, my, R, 0, TAU); ctx.clip();
    ctx.fillStyle = '#f3f6ff'; ctx.fillRect(mx - R, my - R, R * 2, R * 2);
    ctx.fillStyle = '#b4c0e2'; ctx.beginPath(); ctx.arc(mx - R * 0.62, my + R * 0.12, R * 1.02, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d6def4'; for (const [ox, oy, rr] of [[0.25, -0.3, 0.2], [0.45, 0.2, 0.14], [0.05, 0.4, 0.17], [0.55, -0.05, 0.08]]) { ctx.beginPath(); ctx.ellipse(mx + ox * R, my + oy * R, rr * R, rr * R * 0.8, 0.3, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(11,6,18,0.85)'; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.arc(mx, my, R, 0, TAU); ctx.stroke();
    // moon path on the lake (the far layer's waterline sits exactly on this horizon)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 14; k++) { const w = (30 + k * 6 + Math.sin(time * 1.5 + k) * 8) * S; ctx.fillStyle = `rgba(210,225,255,${0.3 - k * 0.018})`; ctx.fillRect(mx - w / 2 + Math.sin(time + k * 2) * 4 * S, horizonY + (4 + k * k * 0.9) * S, w, 1.4 * S); }
    ctx.restore();
    WK.BG.skyEnd(ctx, cam, W, H, S, time, t, sky);
    return true;
  }
  function drawAtmos(ctx, cam, W, H, S, time) {
    if (!FX4.motes) initStars();
    const t = tintAt(cam.x), inside = t > 0.6, LQ = G.Quality.low;
    const n = LQ ? 18 : 46;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const m = FX4.motes[i];
      const px = ((m.x * W * 1.4 - cam.x * m.z * S * 0.5 + Math.sin(time * 0.4 + m.p) * 30 * S) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
      const py = ((m.y * H + time * (inside ? 16 : 6) * m.z * S - cam.y * m.z * S * 0.3) % H + H) % H;
      if (inside && m.k < 0.35) {
        // rose petals drifting down from the boxes
        ctx.save(); ctx.translate(px, py); ctx.rotate(time * (0.8 + m.k) + m.p); ctx.scale(1, 0.5 + 0.5 * Math.sin(time * 2 + m.p));
        ctx.fillStyle = 'rgba(200,40,64,0.75)'; ctx.beginPath(); ctx.ellipse(0, 0, 3.4 * S * m.z, 2 * S * m.z, 0, 0, TAU); ctx.fill(); ctx.restore();
      } else if (inside) {
        // gold-leaf flakes catching the light
        const a = 0.35 + 0.35 * Math.sin(time * 3 + m.p);
        ctx.save(); ctx.translate(px, py); ctx.rotate(time * 1.5 + m.p); ctx.fillStyle = `rgba(255,214,130,${a})`; const s = m.s * S * m.z; ctx.fillRect(-s, -s * 0.4, s * 2, s * 0.8); ctx.restore();
      } else {
        // silver motes hanging over the lake
        const a = 0.2 + 0.25 * Math.sin(time * 1.2 + m.p);
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(200,220,255,${a})`; const s = m.s * S * m.z * 0.8; ctx.fillRect(px, py, s, s); ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
    return true;
  }
  // near-camera silhouettes (parallax 1.35): mooring poles and wisteria outside; drapes and seat-backs inside
  function drawForeground(ctx, cam, S, game) {
    const f = 1.35, span = 1300, base = Math.floor((cam.x * f - 1400) / span);
    for (let i = base; i < base + 4; i++) {
      const rng = U.mulberry32(i * 911 + 7);
      if (rng() < 0.3) continue;
      const lx = i * span + rng() * 500, x = cam.x + (lx - cam.x * f), inside = tintAt(lx / f) > 0.6;
      ctx.save(); ctx.fillStyle = 'rgba(6,5,10,0.94)'; ctx.strokeStyle = 'rgba(6,5,10,0.94)';
      if (!inside) {
        if (rng() < 0.55) {
          const gy = 150; ctx.fillRect(x - 9, gy - 260, 18, 400);
          ctx.fillStyle = 'rgba(207,226,255,0.25)'; ctx.fillRect(x + 6, gy - 260, 3, 400);
          ctx.fillStyle = 'rgba(6,5,10,0.94)'; ctx.beginPath(); ctx.ellipse(x, gy - 262, 14, 7, 0, 0, TAU); ctx.fill();
          ctx.fillRect(x + 9, gy - 200, 26, 3); ctx.fillRect(x + 30, gy - 200, 3, 16);
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; const lg = ctx.createRadialGradient(x + 32, gy - 176, 0, x + 32, gy - 176, 50); lg.addColorStop(0, 'rgba(255,190,110,0.45)'); lg.addColorStop(1, 'rgba(255,190,110,0)'); ctx.fillStyle = lg; ctx.fillRect(x - 18, gy - 226, 100, 100); ctx.restore();
          ctx.fillRect(x + 26, gy - 186, 12, 16);
        } else {
          const top = cam.y - 380, sw = Math.sin(game.realTime * 0.7 + i) * 6;
          for (let k = 0; k < 7; k++) {
            const vx = x - 120 + k * 38 + sw, len = 80 + rng() * 140;
            ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(vx, top); ctx.quadraticCurveTo(vx + 8, top + len * 0.5, vx + sw * 0.6, top + len); ctx.stroke();
            ctx.fillStyle = 'rgba(70,40,90,0.85)'; for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.ellipse(vx + sw * (j / 5) + (j % 2 ? 4 : -4), top + len * (0.3 + j * 0.15), 5, 9, 0, 0, TAU); ctx.fill(); }
            ctx.fillStyle = 'rgba(6,5,10,0.94)';
          }
        }
      } else if (rng() < 0.5) {
        const top = cam.y - 380;
        ctx.beginPath(); ctx.moveTo(x - 220, top); ctx.quadraticCurveTo(x, top + 120 + rng() * 40, x + 220, top); ctx.lineTo(x + 220, top - 40); ctx.lineTo(x - 220, top - 40); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(201,150,58,0.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 220, top); ctx.quadraticCurveTo(x, top + 120, x + 220, top); ctx.stroke();
        ctx.fillStyle = 'rgba(6,5,10,0.94)'; ctx.fillRect(x + 210, top, 4, 90); ctx.fillRect(x + 204, top + 90, 16, 26);
      } else {
        const gy = 132;
        for (let k = 0; k < 6; k++) { const sx = x - 150 + k * 60; ctx.beginPath(); ctx.moveTo(sx - 24, gy + 200); ctx.lineTo(sx - 24, gy + 6); ctx.quadraticCurveTo(sx - 24, gy - 10, sx - 8, gy - 10); ctx.lineTo(sx + 8, gy - 10); ctx.quadraticCurveTo(sx + 24, gy - 10, sx + 24, gy + 6); ctx.lineTo(sx + 24, gy + 200); ctx.fill(); }
        ctx.strokeStyle = 'rgba(184,52,63,0.35)'; ctx.lineWidth = 2; for (let k = 0; k < 6; k++) { const sx = x - 150 + k * 60; ctx.beginPath(); ctx.moveTo(sx - 18, gy - 6); ctx.lineTo(sx + 18, gy - 6); ctx.stroke(); }
      }
      ctx.restore();
    }
    return true;
  }

  /* =============================== SET PIECE: the great chandelier falls =============================== */
  function startChandelier(game) {
    const P = game.player;
    game.control = false; P.vx = 0;
    FX4.chand = { phase: 'creak', t: 0, ft: 0, done: false };
    game.focus = { x: CHAND.x - 150, y: -330, zoom: 0.86 };
    G.SFX.play('c4_creak');
  }
  function updChandelier(game, dt) {
    const st = FX4.chand; if (!st) return;
    st.t += dt;
    if (st.phase === 'creak') {
      if (Math.random() < dt * 6) G.FX.dust(CHAND.x + (Math.random() - 0.5) * 200, CHAND.hang - 140, 1, { w: 20, speed: 40, size: 6, col: 'rgba(230,200,170,' });
      if (st.t > 0.7 && !st.c2) { st.c2 = true; G.SFX.play('c4_creak'); game.shake(0.25); }
      if (st.t > 1.5) { st.phase = 'fall'; st.ft = 0; G.SFX.play('whoosh', 1.4); }
    } else if (st.phase === 'fall') {
      st.ft += dt;
      if (st.ft >= 0.55) {
        st.phase = 'after'; st.t = 0;
        game.save.flags.c4_chandelier_down = true;
        G.SFX.play('c4_crash'); G.SFX.play('quake');
        game.shake(1); game.hitstop(0.1);
        G.FX.flash(CHAND.x, -60, 320, 0.35, '#ffe2b0');
        G.FX.ring(CHAND.x, -4, 30, 620, 0.9, '#ffd8b0', 6, { flat: 0.22 });
        G.FX.ring(CHAND.x, -4, 20, 380, 0.7, '#ffffff', 3, { flat: 0.22 });
        G.FX.spark(CHAND.x, -40, 46, { col: '#fff0d0', speed: 900, dir: -PI / 2, spread: 2.4, g: 1300, life: 0.7 });
        G.FX.shards(CHAND.x, -40, 30, '#e6f0ff', 700);
        G.FX.dust(CHAND.x, -10, 26, { w: 360, speed: 260, size: 22, col: 'rgba(200,170,190,' });
        G.Input.rumble(1);
      }
    } else if (st.phase === 'after') {
      if (st.t > 1.1 && !st.done) {
        st.done = true;
        game.dialog('c4_chandelier', () => { game.focus = null; FX4.chand = null; game.startEncounter('c4_e8'); });
      }
    }
  }

  /* =============================== MUSIC =============================== */
  // original 8-bar motif for the chapter — "Lucette's aria" (E harmonic minor; the raised 7th is the opera's sigh)
  const MOTIF = [
    [0, 71, 6], [6, 76, 2], [8, 75, 4], [12, 76, 4],
    [16, 79, 6], [22, 78, 2], [24, 76, 8],
    [32, 74, 4], [36, 78, 4], [40, 81, 6], [46, 79, 2],
    [48, 78, 4], [52, 74, 4], [56, 71, 8],
    [64, 72, 6], [70, 76, 2], [72, 79, 4], [76, 84, 4],
    [80, 83, 4], [84, 81, 4], [88, 79, 4], [92, 76, 4],
    [96, 78, 4], [100, 75, 4], [104, 71, 4], [108, 75, 4],
    [112, 76, 12], [124, 71, 4],
  ];
  const tr = (m, k) => m.map(([s, n, l]) => [s, n + k, l]);
  const COUNTER4 = [[0, 52, 8], [8, 55, 8], [16, 57, 12], [28, 55, 4], [32, 54, 8], [40, 57, 8], [48, 55, 8], [56, 59, 8], [64, 60, 8], [72, 64, 8], [80, 60, 8], [88, 57, 8], [96, 59, 8], [104, 63, 8], [112, 64, 16]];
  // a virtuoso's diminution for Valentin: every note answered an octave up
  const RUNS = []; for (const [s, n, l] of MOTIF) { if (l >= 4) { RUNS.push([s, n - 12, l / 2], [s + l / 2, n, l / 2]); } else RUNS.push([s, n - 12, l]); }
  // Maestrina's theme, moved into E minor — sung against Lucette's aria in the boss fight (the story's thread)
  const THEME_E = (G.Music && G.Music.THEME ? G.Music.THEME : []).map(([s, n, l]) => [s, n + 2, l]);
  const TRACKS = {
    c4_explore: { bpm: 72, chords: ['c4Em', 'c4Am', 'c4D', 'c4G', 'C', 'c4Am', 'c4B7', 'c4Em'], melody: MOTIF, mel: 'piano', melEvery: 2, pad: 'strings', arp: 'harp', choir: 0.12, bass: 0.35, drums: 0, counter: true, counterLine: COUNTER4 },
    c4_explore2: { bpm: 63, chords: ['c4Am', 'Dm', 'c4G', 'C', 'F', 'Dm', 'c4E7', 'c4Am'], melody: tr(MOTIF, -7), mel: 'bell', melEvery: 2, pad: 'strings', arp: 'none', choir: 0.5, bass: 0.2, drums: 0, counter: true, counterLine: tr(COUNTER4, -7) },
    c4_elite: { bpm: 138, chords: ['c4Em', 'C', 'c4Am', 'c4B7', 'c4Em', 'c4D', 'C', 'c4B7'], melody: RUNS, mel: 'strings', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 0.25, bass: 1, drums: 1, boss: true, timpani: true },
    c4_boss: { bpm: 112, chords: ['c4Em', 'c4D', 'c4G', 'C', 'c4Em', 'c4G', 'c4B7', 'c4Em'], melody: MOTIF, mel: 'choir', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 1, bass: 1, drums: 1, boss: true, timpani: true, counter: true, counterLine: THEME_E },
    c4_boss2: { bpm: 124, chords: ['c4Em', 'C', 'c4Am', 'c4B7', 'c4Em', 'c4Fdim', 'c4G', 'c4B7'], melody: tr(MOTIF, -12), mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 1, bass: 1, drums: 1, boss: true, toms: true, timpani: true, counter: true, counterLine: THEME_E },
  };
  const CHORDS = {
    c4Em: [40, 64, 67, 71], c4Am: [45, 64, 69, 72], c4D: [38, 62, 66, 69], c4G: [43, 62, 67, 71], c4B7: [47, 63, 66, 69],
    c4E7: [40, 62, 64, 68], c4Fdim: [42, 60, 63, 69],
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const AMB = {
    // the black lake: water lapping on stone, drips, a drowned bell somewhere below, a moored boat creaking
    c4_lake: { bed: [0.3, 0.07, 0, 0.12], gap: [1.4, 3.2], evt(t, A) {
      const r = Math.random();
      if (r < 0.35) { A.noise(t, 0.25, 0.035, 0.7, 'lowpass', 520, 240, 0.8, 0.45); A.noise(t + 0.5, 0.2, 0.025, 0.6, 'lowpass', 460, 220, 0.8, 0.45); }
      else if (r < 0.6) A.tone('sine', 1300 + Math.random() * 700, t, 0.002, 0.025, 0.18, { to: 650, wet: 0.85 });
      else if (r < 0.8) A.bell(A.mtof(pick([40, 43, 47])), t, 0.03, 5, 1, 0.35);
      else A.tone('triangle', 92, t, 0.35, 0.016, 0.9, { to: 70, wet: 0.5 });
    } },
    c4_square: { bed: [0.42, 0.12, 0, 0.08], gap: [2, 4], evt(t, A) {
      const r = Math.random();
      if (r < 0.4) A.tone('triangle', 70 + Math.random() * 30, t, 0.3, 0.012, 1.1, { to: 55, wet: 0.5 }); // banner pole creak
      else if (r < 0.7) A.noise(t, 0.4, 0.02, 1, 'bandpass', 900, 600, 1.2, 0.5); // cloth in the wind
      else A.tone('sine', A.mtof(pick([76, 79, 83])), t, 1.2, 0.006, 2.4, { wet: 1 }); // a voice from inside the opera
    } },
    c4_foyer: { bed: [0.16, 0.05, 0, 0.35], gap: [2, 4], evt(t, A) {
      const r = Math.random();
      if (r < 0.4) for (let i = 0; i < 4; i++) A.bell(A.mtof(94 + Math.floor(Math.random() * 9)), t + i * 0.08, 0.008, 0.9, 0.9, 0.6); // crystal drops tinkling
      else if (r < 0.65) A.tone('sine', 1500 + Math.random() * 400, t, 0.002, 0.02, 0.16, { to: 800, wet: 0.9 });
      else A.tone('sine', A.mtof(pick([71, 76, 79])), t, 1.4, 0.009, 2.6, { wet: 1 });
    } },
    c4_stage: { bed: [0.12, 0.04, 0, 0.5], gap: [2.5, 4], evt(t, A) {
      const r = Math.random();
      if (r < 0.35) for (let i = 0; i < 24; i++) A.noise(t + i * 0.035 + Math.random() * 0.02, 0.001, 0.005, 0.03, 'bandpass', 2400, null, 1.5, 0.7); // ghost applause
      else if (r < 0.65) A.noise(t, 0.25, 0.01, 0.6, 'bandpass', 2600, 3400, 4, 0.85); // whisper
      else A.tone('sine', A.mtof(pick([76, 79, 83, 88])), t, 1.5, 0.01, 3, { wet: 1 });
    } },
  };
  const SFX = {
    c4_creak(t) { const A = G.AudioKit; A.tone('sawtooth', 70, t, 0.3, 0.03, 0.9, { to: 52, wet: 0.5, filter: 'lowpass', ff: 600 }); A.tone('triangle', 140, t + 0.1, 0.4, 0.02, 0.8, { to: 110, wet: 0.6 }); for (let i = 0; i < 5; i++) A.bell(A.mtof(96 + i * 2), t + 0.05 + i * 0.07, 0.006, 0.6, 0.8, 0.5); },
    c4_crash(t) { const A = G.AudioKit; A.noise(t, 0.002, 0.4, 0.9, 'highpass', 2600, 6000, 0.7, 0.4); A.noise(t, 0.003, 0.35, 1.4, 'lowpass', 900, 120, 0.7, 0.4); for (let i = 0; i < 18; i++) A.bell(A.mtof(84 + Math.floor(Math.random() * 20)), t + Math.random() * 0.6, 0.02, 0.8, 0.7, 0.8); A.tone('sine', 50, t, 0.01, 0.6, 1.2, { to: 28, wet: 0.3 }); },
    c4_splash(t) { const A = G.AudioKit; A.noise(t, 0.01, 0.12, 0.5, 'lowpass', 1600, 300, 0.7, 0.3); A.tone('sine', 400, t, 0.003, 0.05, 0.2, { to: 140, wet: 0.4 }); },
    c4_applause(t) { const A = G.AudioKit; for (let i = 0; i < 80; i++) A.noise(t + Math.random() * 2.6, 0.001, 0.02 * (1 - i / 120), 0.035, 'bandpass', 2000 + Math.random() * 1500, null, 1.4, 0.7); },
    c4_scoreSong(t) { const A = G.AudioKit; const th = (G.Music && G.Music.THEME) || []; for (const [s, m] of th.slice(0, 13)) A.bell(A.mtof(m + 12), t + s * 0.13, 0.05, 1.6, 0.6, 0.35); },
  };

  /* =============================== LEVEL =============================== */
  const pagesHave = (F) => ['c4_got_page1', 'c4_got_page2', 'c4_got_page3'].filter((k) => F[k]).length;
  const pageTaken = (game) => {
    const F = game.save.flags, n = pagesHave(F);
    game.toast(`樂譜殘頁　${n} / 3`, 'item');
    if (n === 3) setTimeout(() => game.hint('c4_pages'), 1400);
  };
  const SIMON = {
    id: 'c4_simon', x: 11190, y: 0, label: '交談',
    draw: (ctx, x, y, t, game) => drawSimon(ctx, x, y, t, game),
    pending(game) { const F = game.save.flags; return !F.c4_met_simon || (pagesHave(F) === 3 && !F.c4_quest_done); },
    talk(game) {
      const F = game.save.flags, D = G.DATA.dialog;
      const journal = () => { if (!F.c4_q_journal) { F.c4_q_journal = true; G.UI.journal('支線任務：散落的樂譜', '找回三頁樂譜殘頁，交給舞台監督西蒙'); } };
      if (!F.c4_met_simon) { game.dialog('c4_simonMeet', () => { F.c4_met_simon = true; journal(); }); return; }
      const n = pagesHave(F);
      if (F.c4_quest_done) { game.dialog('c4_simonAfter'); return; }
      if (n < 3) {
        const lines = [{ who: 'c4_simon', text: n === 0 ? '……還沒找到嗎。沒關係。我已經等了很多年。' : `${n} 頁……還差 ${3 - n} 頁。風把它們帶到哪裡去了呢。` }];
        if (!F.c4_got_page1) lines.push({ who: 'c4_simon', text: '大道上那台泡水的鋼琴——指揮以前最喜歡坐在那裡試音。' });
        if (!F.c4_got_page2) lines.push({ who: 'c4_simon', text: '廣場噴泉上的石像，風最喜歡在她腳邊打轉。' });
        if (!F.c4_got_page3) lines.push({ who: 'c4_simon', text: '還有……老鐘樓的頂端。風總是往高處吹。' });
        D.c4_simonWait = lines;
        game.dialog('c4_simonWait');
        return;
      }
      G.SFX.play('c4_scoreSong');
      game.dialog('c4_simonDone', () => {
        F.c4_quest_done = true; game.giveRelic('c4_score');
        setTimeout(() => G.UI.journal('支線任務完成', '散落的樂譜'), 600);
        G.FX.ring(SIMON.x, -80, 10, 220, 0.9, '#bff8f0', 4); G.FX.ember(SIMON.x, -80, 40, '#bff8f0', { w: 40, h: 120, up: 160 });
      });
    },
  };
  const LEVEL = {
    start: { x: 200, y: 0 }, bounds: [-400, END_X], gravity: 1,
    solids: [
      { x: -900, y: 0, w: PLAZA_X + 900, h: 700, kind: 'c4_street' },
      { x: 2560, y: -700, w: 380, h: 36, kind: 'c4_roof' },
      { x: PLAZA_X, y: -45, w: 80, h: 45, kind: 'c4_step' },
      { x: PLAZA_X + 80, y: -90, w: FOYER_X - PLAZA_X - 80, h: 790, kind: 'c4_plaza' },
      { x: FOYER_X, y: -90, w: STALLS_X - FOYER_X, h: 790, kind: 'c4_marble' },
      { x: 7400, y: -600, w: 1100, h: 40, kind: 'c4_gallery' },
      { x: STALLS_X, y: 0, w: STAGE_X - STALLS_X, h: 700, kind: 'c4_stalls' },
      { x: STAGE_X, y: 0, w: END_X - STAGE_X + 400, h: 700, kind: 'c4_stage' },
      { x: END_X, y: -1600, w: 400, h: 1700, kind: 'wall' },
      { x: -900, y: -1600, w: 420, h: 1700, kind: 'wall' },
    ],
    oneways: [
      { x: 720, y: -70, w: 170, deco: 'none' },                 // the drowned piano
      { x: 2380, y: -210, w: 170 }, { x: 2570, y: -380, w: 150 }, { x: 2380, y: -540, w: 160 },   // campanile balconies (secret)
      { x: 4790, y: -290, w: 160, deco: 'none' },              // the fountain's pedestal
      { x: 7000, y: -250, w: 190 }, { x: 7210, y: -420, w: 170 },   // grand staircase landings → gallery
      { x: 9700, y: -230, w: 170 }, { x: 9950, y: -400, w: 170 }, { x: 10250, y: -520, w: 190 }, { x: 10550, y: -400, w: 170 }, { x: 10800, y: -240, w: 160 },   // theatre boxes
    ],
    pylons: [
      { id: 'c4_p1', x: 1600, y: 0, name: '沉沒大道魂燈台', dialog: 'c4_pylonSimon', flag: 'c4_met_simon' },
      { id: 'c4_p2', x: 6700, y: -90, name: '大廳魂燈台', dialog: 'c4_pylonTalia', flag: 'c4_talia_line' },
      { id: 'c4_p3', x: 10950, y: 0, name: '後台魂燈台', dialog: 'c4_pylonWings', flag: 'c4_wings_seen' },
    ],
    notes: [
      { id: 'c4_n1', x: 470, y: 0 },
      { id: 'c4_n2', x: 1960, y: 0 },
      { id: 'c4_n3', x: 2640, y: -700 },
      { id: 'c4_n4', x: 4130, y: -90 },
      { id: 'c4_n5', x: 8050, y: -90 },
      { id: 'c4_n6', x: 10330, y: -520 },
    ],
    items: [
      { id: 'c4_page1', x: 820, y: -70, flag: 'c4_got_page1', name: '樂譜殘頁（一）', kind: 'key', sfx: 'pageOpen', onTake: pageTaken },
      { id: 'c4_page2', x: 4870, y: -290, flag: 'c4_got_page2', name: '樂譜殘頁（二）', kind: 'key', sfx: 'pageOpen', onTake: pageTaken },
      { id: 'c4_page3', x: 2860, y: -700, flag: 'c4_got_page3', name: '樂譜殘頁（三）', kind: 'key', sfx: 'pageOpen', onTake: pageTaken },
    ],
    npcs: [SIMON],
    triggers: [
      { id: 'c4_t_lake', x: 330, kind: 'dialog', dialog: 'c4_lake' },
      { id: 'c4_t_puppet', x: 640, kind: 'dialog', dialog: 'c4_puppets', after: 'guard' },
      { id: 'c4_t_pool', x: 1150, kind: 'hint', hint: 'c4_pool' },
      { id: 'c4_t_poster', x: 1430, kind: 'dialog', dialog: 'c4_poster' },
      { id: 'c4_t_wyrm', x: 1840, kind: 'dialog', dialog: 'c4_wyrm', after: 'dodge' },
      { id: 'c4_t_climb', x: 2290, kind: 'hint', hint: 'c4_climb' },
      { id: 'c4_t_usher', x: 2960, kind: 'dialog', dialog: 'c4_usher' },
      { id: 'c4_t_opera', x: 3800, kind: 'dialog', dialog: 'c4_opera' },
      { id: 'c4_t_choir', x: 4200, kind: 'dialog', dialog: 'c4_choir' },
      { id: 'c4_t_foyer', x: 6480, kind: 'dialog', dialog: 'c4_foyer' },
      { id: 'c4_t_gallery', x: 6900, kind: 'hint', hint: 'c4_gallery' },
      { id: 'c4_t_elite', x: 7500, kind: 'dialog', dialog: 'c4_eliteIntro', enc: 'c4_elite', startEnc: 'c4_elite', flag: 'c4_elite_seen', yMax: -520 },
      { id: 'c4_t_chandelier', x: 9580, kind: 'c4_chandelier', dialog: 'c4_chandelier', enc: 'c4_e8' },
      { id: 'c4_t_boss', x: ARENA0 - 200, kind: 'dialog', dialog: 'c4_bossIntro', enc: 'c4_boss', startEnc: 'c4_boss', flag: 'c4_boss_seen', focus: { x: ARENA0 + 800, y: -170, zoom: 0.95 }, music: 'c4_boss' },
    ],
    encounters: {
      c4_e1: { trigger: 700, respawn: true, waves: [[{ t: 'c4_marionette', x: 1050 }, { t: 'c4_marionette', x: 1200 }]] },
      c4_e2: { trigger: 1960, respawn: true, waves: [[{ t: 'c4_pitwyrm', x: 2185 }, { t: 'c4_marionette', x: 2420 }]] },
      c4_e3: { trigger: 3060, arena: [3000, 3690], yMin: -200, waves: [[{ t: 'c4_usher', x: 3450 }], [{ t: 'c4_marionette', x: 3220 }, { t: 'c4_chorister', x: 3600 }]] },
      c4_e4: { trigger: 4330, arena: [4250, 5200], waves: [
        [{ t: 'c4_chorister', x: 5060 }, { t: 'c4_marionette', x: 4640 }, { t: 'c4_marionette', x: 5120 }],
        [{ t: 'c4_usher', x: 4480 }, { t: 'c4_pitwyrm', x: 4870 }, { t: 'shrieker', x: 5050, y: -330 }],
      ] },
      c4_e5: { trigger: 5480, respawn: true, waves: [[{ t: 'c4_usher', x: 5840 }, { t: 'c4_marionette', x: 5960 }, { t: 'c4_chorister', x: 6070 }]] },
      c4_e6: { trigger: 7020, yMin: -200, respawn: true, waves: [[{ t: 'c4_marionette', x: 7420 }, { t: 'c4_marionette', x: 7660 }, { t: 'c4_chorister', x: 7900 }]] },
      c4_elite: { manual: true, elite: true, arena: [7450, 8450], wallBottom: -600, yMax: -520, waves: [[{ t: 'c4_elite', x: 8150, y: -600 }]] },
      c4_e7: { trigger: 8660, arena: [8600, 9450], yMin: -200, waves: [
        [{ t: 'c4_usher', x: 9000 }, { t: 'c4_marionette', x: 9250 }],
        [{ t: 'c4_chorister', x: 9320 }, { t: 'c4_usher', x: 8800 }, { t: 'c4_marionette', x: 9100 }],
      ] },
      c4_e8: { manual: true, arena: [9550, 10850], waves: [
        [{ t: 'c4_pitwyrm', x: 9900 }, { t: 'c4_pitwyrm', x: 10420 }],
        [{ t: 'c4_usher', x: 10600 }, { t: 'c4_marionette', x: 10120 }, { t: 'c4_chorister', x: 10700 }],
      ] },
      c4_boss: { manual: true, boss: true, arena: [ARENA0, ARENA0 + 1400], waves: [[{ t: 'c4_boss', x: ARENA0 + 950, y: 0 }]] },
    },
    zones: [
      { x: -1e9, name: '沉沒大道', en: 'THE DROWNED BOULEVARD', music: 'c4_explore', amb: 'c4_lake' },
      { x: PLAZA_X, name: '劇院廣場', en: 'THE OPERA SQUARE', music: 'c4_explore', amb: 'c4_square' },
      { x: FACADE, name: '大廳', en: 'THE GRAND FOYER', music: 'c4_explore2', amb: 'c4_foyer' },
      { x: STALLS_X, name: '沉沒的觀眾席', en: 'THE DROWNED STALLS', music: 'c4_explore2', amb: 'c4_stage' },
      { x: 10930, name: '最後的舞台', en: 'THE LAST STAGE', music: 'c4_explore2', amb: 'c4_stage' },
    ],
    tintAt,
  };

  /* =============================== STORY: dialogue, hints, codex =============================== */
  const speakers = {
    c4_simon: { name: '西蒙', en: 'SIMON', color: '#bfe8e0' },
    c4_valentin: { name: '瓦倫丁', en: 'VALENTIN', color: '#d8b8ff' },
    c4_lucette: { name: '露塞特', en: 'LUCETTE', color: '#ff9ec4' },
  };
  const dialog = {
    c4_enter: [
      { who: 'ode', text: '……第三道門。' },
      { who: 'rinne', text: '整條街，泡在水裡。' },
      { who: 'ode', text: '海吞下去的東西，最後都會沉到這裡。' },
      { who: 'rinne', text: '水面上，連漣漪都沒有聲音。' },
      { who: 'rinne', text: '……劇院。從那裡穿過去。' },
    ],
    c4_lake: [
      { who: 'rinne', text: '……我的倒影，沒有呼吸聲。' },
      { who: 'ode', text: '這片水映得出光。映不出聲音。' },
    ],
    c4_puppets: [
      { who: 'rinne', text: '……線的另一端，沒有人。' },
    ],
    c4_poster: [
      { who: 'rinne', text: '……〈最後的詠嘆〉。露塞特。' },
      { who: 'ode', text: '大潮來的那一晚，演的就是這一齣。' },
      { who: 'rinne', text: '她唱完了嗎。' },
    ],
    c4_pylonSimon: [
      { who: 'sys', text: '（燈台的火光一陣搖晃。接著，是一個蒼老、溫和的男聲。）' },
      { who: 'c4_simon', text: '……開場前五分鐘。燈光就位。弦樂，調音——' },
      { who: 'rinne', text: '誰？' },
      { who: 'c4_simon', text: '……觀眾？真的有觀眾。失禮了。舞台監督，西蒙。' },
      { who: 'ode', text: '沒有身體的聲音。……這座劇院，還記得他。' },
      { who: 'c4_simon', text: '圓頂塌下的那晚，一份樂譜被風吹散了。三頁，只有三頁。' },
      { who: 'c4_simon', text: '是指揮託我保管的。她說，總有一天，會有人把它唱完。' },
      { who: 'c4_simon', text: '我找了很久……可我好像，走不出這座劇院。' },
      { who: 'rinne', text: '我會留意。' },
      { who: 'c4_simon', text: '找齊了，就到舞台側翼來。我一直都在那裡。……一直都在。' },
    ],
    c4_wyrm: [
      { who: 'rinne', text: '水面下有東西。……只有出水的時候，才碰得到。' },
    ],
    c4_usher: [
      { who: 'ode', text: '它們還在替散場的觀眾，找座位。' },
    ],
    c4_opera: [
      { who: 'rinne', text: '……圓頂破了。' },
      { who: 'ode', text: '光落在舞台上。像最後一次打光。' },
    ],
    c4_choir: [
      { who: 'rinne', text: '……它在替同伴唱歌。用的，不是自己的聲音。' },
    ],
    c4_pylonTalia: [
      { who: 'talia', text: '——是妳？……是妳。燈台的火，好幾天都沒動了。' },
      { who: 'rinne', text: '我在。' },
      { who: 'talia', text: '我還以為……算了。妳還在就好。' },
      { who: 'talia', text: '這裡是溺死的人的劇院吧。每天晚上，他們都在唱自己的輓歌。燈台這邊，也聽得見。' },
      { who: 'talia', text: '我死得太早，沒看過海。……下次，告訴我海是什麼顏色。' },
      { who: 'talia', text: '……不問了。妳的表情，好像我問了什麼很難的事。' },
      { who: 'talia', text: '刀拿過來吧。在這種地方，刀可不能走音。' },
    ],
    c4_foyer: [
      { who: 'rinne', text: '……好安靜。' },
      { who: 'ode', text: '這裡的牆，還記得很多聲音。' },
    ],
    c4_eliteIntro: [
      { who: 'sys', text: '（迴廊盡頭，一把小提琴反覆拉著同一個 A 音。）' },
      { who: 'c4_valentin', text: 'A，四百四十。……不，四百三十九。又走音了。' },
      { who: 'c4_valentin', text: '妳遲到了。這場排練，十八年前就開始了。' },
      { who: 'c4_valentin', text: '首席，瓦倫丁。我的聲音，在露塞特小姐那裡。她唱完之前，誰也不准上台。' },
      { who: 'c4_valentin', text: '來吧。讓我聽聽，妳的拍子準不準。' },
    ],
    c4_eliteDefeat: [
      { who: 'c4_valentin', text: '……漂亮的切分音。妳搶拍了。搶得很好。' },
      { who: 'c4_valentin', text: '松香，拿去吧。這把弓乾了太久，該有人拉出真正的聲音。' },
      { who: 'c4_valentin', text: '替我告訴她……可以謝幕了。' },
    ],
    c4_chandelier: [
      { who: 'sys', text: '（頭頂一聲細響。吊燈的鏈條，斷了。）' },
      { who: 'rinne', text: '……水裡，有東西醒了。' },
    ],
    c4_pylonWings: [
      { who: 'rinne', text: '……舞台上，有人在等。' },
      { who: 'ode', text: '那就別讓她，等太久。' },
    ],
    c4_simonMeet: [
      { who: 'c4_simon', text: '觀眾請止步——……啊，是妳。我們見過嗎？我記不太清楚了。' },
      { who: 'c4_simon', text: '舞台監督，西蒙。圓頂塌下那晚，指揮託我保管的樂譜，被風吹散了。三頁。' },
      { who: 'c4_simon', text: '大道上、廣場上，還有老鐘樓的頂端……風總往那邊吹。能替我找回來嗎？' },
    ],
    c4_simonDone: [
      { who: 'rinne', text: '三頁都在這裡。' },
      { who: 'c4_simon', text: '……就是這一份。潮水帶下來的那一份。' },
      { who: 'sys', text: '（他把樂譜攤在譜架上。泛黃的五線譜最上方，有一行小字：「給沒有名字的孩子」。）' },
      { who: 'c4_simon', text: '很多年前，潮水把一只木匣沖進這座劇院。裡面沒有人，只有這首搖籃曲——只寫了一半。' },
      { who: 'c4_simon', text: '指揮把後半段補上了。她說：「總要有人，替那個孩子唱一次。」' },
      { who: 'ode', text: '……前半段的筆跡。我見過。' },
      { who: 'rinne', text: '……沒有名字的孩子。' },
      { who: 'ode', text: '井底那個孩子，哼到一半停下的，就是這一段。' },
      { who: 'c4_simon', text: '♪ 睡吧，浪會替妳數星星——睡吧，海會記得妳的模樣——' },
      { who: 'c4_simon', text: '♪ 就算沒有人叫妳的名字，別害怕——等妳醒來，我們再一起唱。' },
      { who: 'c4_simon', text: '……謝謝妳。我終於可以喊「落幕」了。' },
      { who: 'c4_simon', text: '把它帶下去吧。帶到她在的地方。' },
    ],
    c4_simonAfter: [
      { who: 'sys', text: '（舞台監督的身影很淡了。他朝妳點點頭，像在示意下一個燈光變換。）' },
    ],
    c4_bossIntro: [
      { who: 'sys', text: '（舞台的燈，一盞一盞亮了起來。沒有人去開它們。）' },
      { who: 'c4_lucette', text: '……妳遲到了。第三幕，開始很久了。' },
      { who: 'rinne', text: '他們的聲音，該還給他們了。' },
      { who: 'c4_lucette', text: '還給他們，他們就會往下走。……然後，台上只剩我一個。' },
      { who: 'c4_lucette', text: '留下來吧。第三道門的過路錢……就用妳的聲音付。' },
    ],
    c4_bossDefeat: [
      { who: 'c4_lucette', text: '……最高的那個音。我唱到了。' },
      { who: 'c4_lucette', text: '觀眾席……好多人。他們在鼓掌嗎？' },
      { who: 'rinne', text: '在鼓掌。' },
      { who: 'c4_lucette', text: '……十八年前，海上漂過一只木箱。裡面的孩子，哭得好響。' },
      { who: 'c4_lucette', text: '我等她沉下來。她沒有。……現在，她自己走下來了。' },
      { who: 'c4_lucette', text: '這一聲……就當作，過門的錢。' },
      { who: 'ode', text: '……第三道門，收下了妳的聲音。' },
      { who: 'rinne', text: '……' },
    ],
  };
  const barks = {
    c4_ovation: { who: 'ode', text: '……包廂裡，他們在鼓掌。沒有聲音。' },
  };
  const hints = {
    c4_pool: '<b class="r">黑水</b> 會吞噬聲音——站在裡面會持續受傷。用 {jump} 跳過去',
    c4_climb: '那座老鐘樓的陽台……好像可以一路爬上去（{jump} 二段跳）',
    c4_gallery: '大廳的階梯通往上層迴廊……上面傳來小提琴的調音聲',
    c4_pages: '三頁樂譜都找齊了。拿去給 <b>舞台側翼的西蒙</b>',
  };
  const notes = [
    { id: 'c4_n1', name: '給露塞特小姐的信', en: 'A LETTER TO LUCETTE', body: [
      '露塞特小姐：', '我叫安娜，九歲。媽媽說妳十二歲就站上了潮音大劇院的舞台，所以我還有三年。',
      '我每天都在浴室練高音，鄰居敲了好幾次牆。媽媽說，那代表他們聽見了。',
      '十一月的季終公演，我們買到了頂樓最後一排的票。如果妳往上看，我會揮手。——安娜'] },
    { id: 'c4_n2', name: '港口守夜人的最後一班', en: 'THE HARBOR WATCH — LAST SHIFT', body: [
      '21:40　潮水漲過了第一道防波堤。港務官說，大劇院今晚照常開演。我問是誰說的。沒有人回答。',
      '22:15　水進來了，比預期快。碼頭、大道、廣場……整條港街變成一面鏡子。',
      '22:31　水不退了。它就那樣靜靜地停著，連風吹過去都沒有聲音。',
      '劇院那邊還亮著燈。她還在唱。我聽不見，但我看得見燈。'] },
    { id: 'c4_n3', name: '那一夜，門關上了', en: 'THE NIGHT THE DOORS CLOSED', body: [
      '（鐘樓頂上的一頁日記，被鐘錘壓著，才沒被風吹走。）',
      '十八年前的那一晚，第三幕唱到一半，劇院外的門關上了。從那天起，再也沒有新的溺死者走進來。',
      '露塞特小姐沒有停。她讓我們把同一齣戲，再唱一次。再一次。',
      '我們的輓歌早就唱完了。可是聲音還繫在她的線上，我們就走不進第三道門。',
      '我在這座鐘樓上，敲了一整夜的鐘。鐘沒有響。'] },
    { id: 'c4_n4', name: '節目單背面的字', en: 'ON THE BACK OF A PROGRAMME', body: [
      '（泡得發皺的節目單。背面是鉛筆字，筆畫很用力。）',
      '大潮那晚，我唱到最高的那個音——水就進來了。我的聲音停在那個音上，沒有跟我一起下來。',
      '在這裡，溺死的人唱完自己的輓歌，就把聲音交給我，往下走。這是第三道門的規矩。',
      '可是門關上以後，就再也沒有人下來了。我只好讓他們唱。一遍，又一遍。……我只是不想一個人站在台上。'] },
    { id: 'c4_n5', name: '首席的調音記錄', en: "THE PRINCIPAL'S TUNING LOG", body: [
      '第 6,514 天。A = 439.6。',
      '第 6,515 天。A = 439.2。弦在下沉，就像這座劇院。',
      '第 6,516 天。露塞特小姐今天又上台了。她張開嘴，唱出來的是安娜的聲音。她說今天的聲音很好。我說是的，很好。',
      '第 6,517 天。如果有人走進這座劇院，我會擋住他。她還沒唱完。她永遠都不會唱完。',
      '……A = 439.0。'] },
    { id: 'c4_n6', name: '舞台監督的值班簿', en: "THE STAGE MANAGER'S LOGBOOK", body: [
      '（值班簿的最後幾頁。墨水被水暈開了。）',
      '今晚，潮水帶進來一只木匣。裡面沒有人，只有一份樂譜。封蠟上壓著浪紋，是王宮用的那種。',
      '最上方寫著：「給沒有名字的孩子」。下面是一首搖籃曲，只寫了一半，像是寫的人哭得寫不下去了。',
      '指揮把後半段補上了。她說：「總要有人，替那個孩子唱一次。」',
      '首演定在下一季。……那一季，再也沒有來。'] },
  ];
  const people = [
    { id: 'c4_lucette', name: '露塞特', en: 'LUCETTE — THE PUPPETEER DIVA', portrait: null, unlock: 'c4_boss_seen', tag: '第三道門｜提線歌姬',
      body: ['潮音大劇院最後的首席女高音。大潮之夜，她唱到最高音的那一刻，水淹進了劇院。',
        '在冥界，她成了第三道門的守門人：溺死的人唱完自己的輓歌，便把聲音交給她，然後往下走。',
        '門關上之後，再也沒有人下來。她把收來的聲音一根一根繫上絲線，讓同一群人，把同一齣戲唱了十八年。'] },
    { id: 'c4_valentin', name: '瓦倫丁', en: 'VALENTIN — THE PRINCIPAL', portrait: null, unlock: 'c4_elite_seen', tag: '第三道門｜首席',
      body: ['潮音大劇院的首席男高音，露塞特的搭檔。他的聲音早就交了出去，如今只剩一把從樂池撈起的小提琴。',
        '他每天替琴調音，記錄 A 音一天天往下沉。他知道她再也唱不出自己的聲音，卻從來沒有告訴她。他自己，也一直沒有謝幕。'] },
    { id: 'c4_simon', name: '西蒙', en: 'SIMON — THE STAGE MANAGER', portrait: null, unlock: 'c4_met_simon', tag: '溺死者｜潮音大劇院舞台監督',
      body: ['大潮之夜沒能離開劇院的舞台監督。他的輓歌很短，早就唱完了；可是他不肯往下走。',
        '他還在倒數開場，還在替燈光就位，還在等一份被風吹散的樂譜回到譜架上。',
        '「各部門注意——開場前五分鐘。」這句話，他已經說了很多年。'] },
  ];
  const world = [
    { id: 'c4_lyra', name: '沉港', en: 'THE SUNKEN HARBOR', unlock: 't_c4_t_lake',
      body: ['溫陀的舊港街。很多年前的一場大潮，把整條港街連同大劇院，一起帶進了海裡。',
        '在庫爾，海吞下去的東西，最後都會沉到這裡：船骨、街燈、整座劇院，還有人。'] },
    { id: 'c4_mirror', name: '黑鏡湖', en: 'THE BLACK MIRROR', unlock: 't_c4_t_lake',
      body: ['淹沒沉港的水。它反射光、燈火與倒影，卻不反射任何聲音。',
        '少數地方的水是真正的黑色——那是「黑水」，會一點一點吞掉站在裡面的人的心跳。'] },
    { id: 'c4_opera', name: '潮音大劇院', en: 'THE TIDESONG OPERA', unlock: 't_c4_t_opera',
      body: ['兩千四百個座位、一百一十二個包廂、溫陀最大的水晶吊燈。銅綠色的圓頂上，金色的海神高舉著七弦琴。',
        '圓頂在某個冬天坍塌。光從破口直接照進觀眾席——那裡如今積滿了水。',
        '舞台底下有一道往下的石階。溺死的人唱完輓歌，就從那裡走向第三道門。'] },
    { id: 'c4_echoes', name: '殘響之人', en: 'THOSE WHO LINGER', unlock: 'c4_met_simon',
      body: ['寧舒說：在這座劇院裡，一個人最後的歌，會被牆記住，一遍一遍地重唱。',
        '「這不是鬼。」祂說，「是還沒唱完的輓歌。」停了很久之後：「……我大概，沒有資格這樣說別人。」'] },
  ];
  const items = [
    { id: 'c4_score', name: '無名的搖籃曲', en: 'A LULLABY WITH NO NAME', unlock: 'relic_c4_score', relic: true,
      body: ['從海上漂下來的樂譜，最上方寫著「給沒有名字的孩子」。前半是一個母親的字跡，後半是指揮補上的。它從來沒有被唱給那個孩子聽過。', '遺物效果：完美閃避判定時間 +30ms。'] },
    { id: 'c4_page1', name: '樂譜殘頁（一）', en: 'SCORE FRAGMENT I', unlock: 'c4_got_page1', body: ['泡過水的五線譜。音符被暈開了，但還讀得出旋律的開頭。'] },
    { id: 'c4_page2', name: '樂譜殘頁（二）', en: 'SCORE FRAGMENT II', unlock: 'c4_got_page2', body: ['邊緣被噴泉的水染成了青色。上面有一行鉛筆小字：「這裡要換氣」。'] },
    { id: 'c4_page3', name: '樂譜殘頁（三）', en: 'SCORE FRAGMENT III', unlock: 'c4_got_page3', body: ['最後一頁，是指揮的字跡。結尾是一個很長的休止，像是在等誰接著唱。'] },
  ];
  const relics = { c4_score: { name: '無名的搖籃曲', desc: '完美閃避判定 +30ms' } };
  G.Relics.c4_score = { apply(P) { P.parryWin += 0.03; } };
  // the elite's relic belongs to ch4_foes.js; only fill it in if that file did not define it
  if (!G.DATA.relics.c4_rosin) {
    relics.c4_rosin = { name: '松香', desc: '攻擊力 +8%' };
    items.push({ id: 'c4_rosin', name: '松香', en: 'ROSIN', unlock: 'relic_c4_rosin', relic: true, body: ['瓦倫丁的松香塊，被握得溫熱。弓弦乾了十八年，擦上它，還是會唱。', '遺物效果：攻擊力 +8%。'] });
  }
  if (!G.Relics.c4_rosin) G.Relics.c4_rosin = { apply(P) { P.dmgMul = (P.dmgMul || 1) * 1.08; } };

  /* =============================== REGISTER =============================== */
  const CH4 = G.Chapters.register({
    id: 4, key: 'ch4', num: 'IV', numZh: '四', title: '溺死者的劇場', en: 'THE THEATRE OF THE DROWNED',
    intro: [
      { t: '溺死的人，在這裡唱自己的輓歌。', s: 'HERE THE DROWNED SING THEIR OWN DIRGES.' },
      { t: '唱完的，往下走。\n沒唱完的，留下來。', s: 'THOSE WHO FINISH GO DOWN. THOSE WHO DO NOT, STAY.' },
    ],
    enterDialog: 'c4_enter',
    outro: '「十八年前，海上漂過一只木箱。」',
    level: LEVEL,
    pal: {
      skyTop: ['#04071a', '#0c0308'], skyMid: ['#122149', '#2a0a16'], skyLow: ['#36578c', '#5a1626'], horizon: ['#9cbbe2', '#c8604a'],
      far: ['#56709f', '#4a1a2a'], mid: ['#34446e', '#5a1624'], midDark: ['#1b2444', '#2e0a14'], near: ['#20284c', '#3a0c18'], nearDark: ['#0e1229', '#1d050c'],
      rim: ['#cfe2ff', '#ffc46b'], ground: ['#4a5878', '#6b1c22'], groundDark: ['#121729', '#1a0609'], groundTop: ['#bcd2f0', '#f2c77a'], fog: ['#5f7cb4', '#9a2a3a'],
    },
    sky: {
      sunX: 0.7, sunY: 235, rays: 0, shafts: true, shaftCol: '180,205,255', ark: false,
      clouds: [{ lit: [196, 214, 248], shade: [24, 32, 70], core: [62, 78, 128] }, { lit: [255, 186, 150], shade: [50, 12, 26], core: [104, 36, 56] }],
    },
    bg: { far: genFar, mid: genMid, near: genNear, props: () => genProps() },
    solidPainters: painters,
    onewayPainter: onewayPainter,
    music: { explore: 'c4_explore', boss: 'c4_boss', boss2: 'c4_boss2', elite: 'c4_elite', rest: 'rest' },
    tracks: TRACKS, chords: CHORDS, ambience: AMB, sfx: SFX,
    data: { speakers, dialog, barks, hints, codex: { people, world, items, notes }, relics },
    hooks: {
      drawSky,
      drawAtmos,
      drawForeground,
      afterLayer(key, ctx, cam, W, H, S, time) { if (key === 'near') drawRooms(ctx, cam, W, H, S, time); },
      drawBack(ctx, game) {
        const t = game.realTime;
        drawLampGlows(ctx, game, t);
        drawPools(ctx, game, t);
        drawChandelier(ctx, game, t);
        drawGhostAudience(ctx, game, t);
      },
      drawFront(ctx, game) { const t = game.realTime; drawWaterLife(ctx, game, t); drawFog(ctx, game, t); },
      trigger(game, tr) {
        if (tr.kind !== 'c4_chandelier') return false;
        if (game.save.flags.c4_chandelier_down) { game.startEncounter('c4_e8'); return true; }
        startChandelier(game); return true;
      },
      encounterClear(game, id) {
        if (id === 'c4_e8' && !game.save.flags.c4_ovation) { game.save.flags.c4_ovation = true; FX4.ovT = 0; setTimeout(() => G.SFX.play('c4_applause'), 900); setTimeout(() => game.bark('c4_ovation'), 1800); }
      },
      update(game, dt) {
        const P = game.player, F = game.save.flags;
        if (!P) return;
        updChandelier(game, dt);
        if (FX4.ovT >= 0) FX4.ovT += dt;
        // the side quest is logged the first time Simon's voice comes through the pylon band
        if (F.c4_met_simon && !F.c4_q_journal) { F.c4_q_journal = true; setTimeout(() => G.UI.journal('支線任務：散落的樂譜', '找回三頁樂譜殘頁，交給舞台側翼的西蒙'), 300); }
        // black water hurts
        FX4.hazT = Math.max(0, FX4.hazT - dt);
        for (const h of HAZ) {
          if (P.onGround && Math.abs(P.y - h.y) < 3 && P.x > h.x0 + 6 && P.x < h.x1 - 6 && FX4.hazT <= 0 && P.state !== 'dead') {
            FX4.hazT = 0.75;
            const r = P.receiveHit(null, { dmg: 8, unblockable: true, kb: 160, hx: P.x, hy: P.y - 20, waveFrom: (h.x0 + h.x1) / 2, noRes: true });
            if (r === 'hit') { G.FX.spark(P.x, h.y - 4, 10, { col: '#ff4f86', speed: 300, dir: -PI / 2, spread: 1.4 }); game.hint('c4_pool'); }
          }
        }
        // footfall ripples on water
        const wet = (P.x < PLAZA_X && Math.abs(P.y) < 2) || (P.x > STALLS_X && P.x < STAGE_X && Math.abs(P.y) < 2);
        FX4.ripT -= dt;
        if (wet && P.onGround && Math.abs(P.vx) > 60 && FX4.ripT <= 0) { FX4.ripT = 0.24; FX4.rip.push({ x: P.x, y: P.y, t: 0, s: 0.7 + Math.random() * 0.4, warm: P.x > STALLS_X }); if (FX4.rip.length > 14) FX4.rip.shift(); }
        if (wet && P.onGround && !FX4.wasG) { FX4.rip.push({ x: P.x, y: P.y, t: 0, s: 1.6, warm: P.x > STALLS_X }); }
        FX4.wasG = P.onGround;
        for (const r of FX4.rip) r.t += dt;
        // warm the interior tiles ahead of the camera
        if (ROOMS.built && ((game._c4pw = (game._c4pw || 0) + 1) % 12 === 0)) {
          const c = game.cam, S = game.baseS * c.zoom, dir = P.vx >= 0 ? 1 : -1;
          for (const r of ROOMS.list) if (c.x + game.W / S > r.x0 && c.x - game.W / S < r.x1) for (const l of r.layers) l.prewarm(c.x, c.y, game.W, game.H, S, dir);
        }
      },
    },
    next: 5,
  });

  // free the interior tiles when another chapter takes over the backdrop
  const BG = G.BG, baseRebuild = BG.rebuild;
  BG.rebuild = function (def) { if (def !== CH4) flushRooms(); else ROOMS.built = false; return baseRebuild.call(this, def); };
})(window.G);

'use strict';
/* ECHOFALL — world: level geometry, interactables, and tiled parallax art layers (lazy, LRU-cached). */
(function (G) {
  const U = G.U;

  /* =========================== LEVEL =========================== */
  const L = G.LEVEL = {
    start: { x: 220, y: 0 },
    bounds: [-500, 9050],
    gravity: 1,
    solids: [
      { x: -900, y: 0, w: 3950, h: 700, kind: 'ground' },
      { x: 760, y: -66, w: 160, h: 66, kind: 'car' },
      { x: 2975, y: -42, w: 75, h: 42, kind: 'crate' },
      { x: 3050, y: -90, w: 2850, h: 790, kind: 'ground' },
      { x: 4600, y: -640, w: 900, h: 46, kind: 'roof' },
      { x: 5900, y: 0, w: 3400, h: 700, kind: 'ground' },
      { x: 9000, y: -1600, w: 400, h: 1700, kind: 'wall' },
      { x: -900, y: -1600, w: 420, h: 1700, kind: 'wall' },
    ],
    oneways: [
      { x: 3420, y: -260, w: 210 },
      { x: 3960, y: -270, w: 190 },
      { x: 4170, y: -410, w: 170 },
      { x: 4380, y: -540, w: 190 },
      { x: 6600, y: -230, w: 200 },
    ],
    pylons: [
      { id: 'p1', x: 2780, y: 0, name: '墜落點共鳴碑' },
      { id: 'p2', x: 6080, y: 0, name: '沉鐘共鳴碑' },
    ],
    notes: [
      { id: 'n1', x: 470, y: 0 },
      { id: 'n2', x: 1880, y: 0 },
      { id: 'n4', x: 4720, y: -640 },
      { id: 'n6', x: 5300, y: -640 },
      { id: 'n3', x: 6330, y: 0 },
      { id: 'n5', x: 6950, y: 0 },
    ],
    items: [
      { id: 'hushbell', x: 4475, y: -540, flag: 'relic_hushbell', name: '靜默之鈴', kind: 'relic' },
      { id: 'musicbox', x: 5420, y: -640, flag: 'got_musicbox', name: '米菈的音樂盒', kind: 'key' },
    ],
    npcs: [{ id: 'barrow', x: 6250, y: 0 }],
    triggers: [
      { id: 'h_attack', x: 980, kind: 'hint', hint: 'attack' },
      { id: 'd_first', x: 1180, kind: 'dialog', dialog: 'firstEnemy', after: 'guard' },
      { id: 'd_sent', x: 2010, kind: 'dialog', dialog: 'sentinel', after: 'dodge' },
      { id: 'h_climb', x: 3900, kind: 'hint', hint: 'climb', yMax: 9999 },
      { id: 'd_roof', x: 4880, kind: 'dialog', dialog: 'rooftop', yMax: -500, enc: 'graves', startEnc: 'graves', flag: 'graves_seen' },
      { id: 'd_cath', x: 7350, kind: 'dialog', dialog: 'cathedral' },
      { id: 'd_boss', x: 7800, kind: 'dialog', dialog: 'bossIntro', enc: 'boss', startEnc: 'boss', flag: 'boss_seen', focus: { x: 8350, y: -170, zoom: 0.95 }, music: 'boss' },
    ],
    encounters: {
      // Chapter I escalation: one crawler (learn the swing) → crawler + a bell-crow off the rooftops (white dives only:
      // the parry lesson) → the Sentinel duel, then a flanking pair → the Pillar-Bearer alone (read its tells), then the air →
      // mixed arena gauntlet → cathedral gate (brute + flock)
      e1: { trigger: 1250, respawn: true, waves: [[{ t: 'murmur', x: 1600 }], [{ t: 'murmur', x: 1780 }, { t: 'c1_bellcrow', x: 1880, y: -220 }]] },
      e2: { trigger: 2060, arena: [1960, 2700], waves: [[{ t: 'sentinel', x: 2480 }], [{ t: 'murmur', x: 2160 }, { t: 'c1_bellcrow', x: 2560, y: -230 }]] },
      e3: {
        trigger: 3250, respawn: true,
        waves: [
          [{ t: 'c1_pillar', x: 3780 }],
          [{ t: 'shrieker', x: 3900, y: -330 }, { t: 'c1_bellcrow', x: 3640, y: -230 }, { t: 'murmur', x: 3760 }],
        ],
      },
      e4: {
        trigger: 4920, arena: [4820, 5760], wallTop: -600, yMin: -500,
        waves: [
          [{ t: 'murmur', x: 5300 }, { t: 'c1_bellcrow', x: 5460, y: -230 }, { t: 'murmur', x: 5600 }],
          [{ t: 'c1_pillar', x: 5520 }, { t: 'shrieker', x: 5180, y: -330 }],
          [{ t: 'sentinel', x: 5000 }, { t: 'sentinel', x: 5600 }],
        ],
      },
      graves: { manual: true, elite: true, arena: [4620, 5480], wallBottom: -640, yMax: -500, waves: [[{ t: 'graves', x: 5250, y: -640 }]] },
      e5: {
        trigger: 6700, respawn: true,
        waves: [
          [{ t: 'c1_pillar', x: 7150 }, { t: 'murmur', x: 7000 }, { t: 'shrieker', x: 7250, y: -300 }],
          [{ t: 'sentinel', x: 7050 }, { t: 'c1_bellcrow', x: 7200, y: -240 }, { t: 'c1_bellcrow', x: 7360, y: -280 }],
        ],
      },
      boss: { manual: true, arena: [7620, 8900], boss: true, waves: [[{ t: 'maestrina', x: 8500, y: -60 }]] },
    },
    zoneAt(x) {
      const zs = (L.zones && L.zones.length) ? L.zones : G.DATA.zones;
      let z = zs[0];
      for (const zz of zs) if (x >= zz.x) z = zz;
      return z;
    },
    // 0..1 how "cathedral" the palette is
    tintAt(x) {
      if (x < 2850) return U.clamp((x - 1800) / 1050, 0, 1) * 0.35;
      if (x < 6200) return 0.35 + U.clamp((x - 5200) / 1000, 0, 1) * 0.45;
      return 0.8 + U.clamp((x - 6200) / 1400, 0, 1) * 0.2;
    },
  };

  /* -------- physics helpers (shared by all bodies) -------- */
  G.Phys = {
    dyn: [], // arena walls etc.
    allSolids() { return L.solids.concat(this.dyn); },
    move(b, dt, opts = {}) {
      const solids = this.allSolids();
      b.onGround = false;
      // X
      b.x += b.vx * dt;
      let box = { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h };
      for (const s of solids) {
        if (U.rectsOverlap(box, s)) {
          if (b.vx > 0 || (b.vx === 0 && b.x < s.x + s.w / 2)) b.x = s.x - b.w / 2 - 0.01;
          else b.x = s.x + s.w + b.w / 2 + 0.01;
          b.hitWall = true; b.vx = opts.bounce ? -b.vx * 0.3 : 0;
          box.x = b.x - b.w / 2;
        }
      }
      // Y
      const prevBottom = b.y;
      b.y += b.vy * dt;
      box = { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h };
      for (const s of solids) {
        if (U.rectsOverlap(box, s)) {
          if (b.vy >= 0 && prevBottom <= s.y + 4) { b.y = s.y; b.vy = 0; b.onGround = true; }
          else if (b.vy < 0) { b.y = s.y + s.h + b.h; b.vy = 0; }
          else { b.y = s.y; b.vy = 0; b.onGround = true; }
          box.y = b.y - b.h;
        }
      }
      if (!b.dropThrough && b.vy >= 0) {
        for (const p of L.oneways) {
          if (b.x + b.w / 2 > p.x && b.x - b.w / 2 < p.x + p.w && prevBottom <= p.y + 1 && b.y >= p.y) {
            b.y = p.y; b.vy = 0; b.onGround = true;
          }
        }
      }
    },
    groundBelow(x, y) {
      let best = 1e9;
      for (const s of this.allSolids()) if (x >= s.x && x <= s.x + s.w && s.y >= y - 2 && s.y < best) best = s.y;
      for (const p of L.oneways) if (x >= p.x && x <= p.x + p.w && p.y >= y - 2 && p.y < best) best = p.y;
      return best;
    },
  };

  /* =========================== ART: TILED LAYERS =========================== */
  const TILE = 512;
  const LAYER_LOOK = { far: { blur: 1.3, tex: 0.12 }, mid: { blur: 0.6, tex: 0.3 }, near: { tex: 0.38 }, ground: { tex: 0.4 } };
  // tileable weathering texture: value noise (3 octaves) + per-pixel grain → dark stains / pale dust
  function makeTexture(size = 256, seed = 99) {
    const rng = U.mulberry32(seed), c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
    const oct = [[4, 0.5], [12, 0.3], [40, 0.2]].map(([n, amp]) => ({ n, amp, grid: Float32Array.from({ length: n * n }, () => rng()) }));
    const sm = (t) => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let v = 0;
      for (const o of oct) {
        const fx = (x / size) * o.n, fy = (y / size) * o.n, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
        const G = (a, b) => o.grid[((b % o.n) * o.n) + (a % o.n)];
        v += o.amp * U.lerp(U.lerp(G(ix, iy), G(ix + 1, iy), tx), U.lerp(G(ix, iy + 1), G(ix + 1, iy + 1), tx), ty);
      }
      v += (rng() - 0.5) * 0.22;
      const k = (y * size + x) * 4, dv = v - 0.5;
      if (dv < 0) { d[k] = 22; d[k + 1] = 15; d[k + 2] = 14; d[k + 3] = Math.min(255, -dv * 2 * 255 * 0.9); }
      else { d[k] = 255; d[k + 1] = 238; d[k + 2] = 214; d[k + 3] = Math.min(255, dv * 2 * 255 * 0.45); }
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  class TiledLayer {
    constructor(key, f, fy, baseY, res, objs) {
      this.key = key; this.f = f; this.fy = fy; this.baseY = baseY; this.res = res; this.objs = objs;
      this.cache = new Map(); this.empty = new Set(); this.scale = 1; this.visN = 0;
    }
    // memory budget: on 'low' fewer tiles are kept and each one is lower resolution — but never fewer than what is on
    // screen right now (+ a margin), or the cache would rebuild the same tiles every frame (thrash → stutter + memory churn)
    get max() { const base = G.Quality.low ? (this.key === 'ground' ? 14 : 10) : (this.key === 'ground' ? 28 : 18); return Math.max(base, this.visN + 6); }
    setScale(s) { const sc = Math.min(G.Quality.low ? 1.0 : 2.2, s * this.res); if (Math.abs(sc - this.scale) > 0.01) { this.scale = sc; this.flush(); } }
    // free GPU/bitmap memory right away instead of waiting for GC (matters on 3 GB devices)
    flush() { for (const c of this.cache.values()) if (c) { c.width = 0; c.height = 0; } this.cache.clear(); this.empty.clear(); }
    tile(tx, ty) {
      const k = tx + ',' + ty;
      if (this.empty.has(k)) return null;
      let c = this.cache.get(k);
      if (c) { this.cache.delete(k); this.cache.set(k, c); return c; } // true LRU: a used tile becomes the newest
      const rx = tx * TILE, ry = ty * TILE;
      const rect = { x: rx, y: ry, w: TILE, h: TILE };
      const hits = this.objs.filter((o) => U.rectsOverlap(rect, o));
      if (!hits.length) { this.empty.add(k); return null; }
      const px = Math.ceil(TILE * this.scale);
      c = document.createElement('canvas'); c.width = px; c.height = px;
      const g = c.getContext('2d');
      g.setTransform(this.scale, 0, 0, this.scale, -rx * this.scale, -ry * this.scale);
      // depth of field: distant layers are baked slightly out of focus
      const LOOK = LAYER_LOOK[this.key] || {};
      if (LOOK.blur && 'filter' in g && !G.Quality.low) g.filter = `blur(${(LOOK.blur * this.scale).toFixed(2)}px)`;
      for (const o of hits) { g.save(); o.draw(g); g.restore(); }
      if ('filter' in g) g.filter = 'none';
      // surface texture (grain + stains), world-aligned so it is seamless across tiles
      if (LOOK.tex && BG.texCanvas) {
        g.save(); g.globalCompositeOperation = 'source-atop';
        const fine = g.createPattern(BG.texCanvas, 'repeat'), macro = g.createPattern(BG.texCanvas, 'repeat');
        if (macro.setTransform) macro.setTransform(new DOMMatrix().scale(3.2).rotate(37));
        g.globalAlpha = LOOK.tex * 0.6; g.fillStyle = macro; g.fillRect(rx, ry, TILE, TILE);
        g.globalAlpha = LOOK.tex; g.fillStyle = fine; g.fillRect(rx, ry, TILE, TILE);
        g.restore();
      }
      this.cache.set(k, c);
      while (this.cache.size > this.max) {
        const old = this.cache.keys().next().value, oc = this.cache.get(old);
        if (oc) { oc.width = 0; oc.height = 0; }
        this.cache.delete(old);
      }
      return c;
    }
    draw(ctx, camX, camY, W, H, S) {
      // layer coordinate visible range
      const lxC = camX * this.f, lyC = camY * this.fy - this.baseY;
      const halfW = W / 2 / S, halfH = H / 2 / S;
      const x0 = Math.floor((lxC - halfW) / TILE), x1 = Math.floor((lxC + halfW) / TILE);
      const y0 = Math.floor((lyC - halfH) / TILE), y1 = Math.floor((lyC + halfH) / TILE);
      this.visN = (x1 - x0 + 1) * (y1 - y0 + 1);
      const dsz = TILE * S;
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const c = this.tile(tx, ty);
          if (!c) continue;
          const sx = Math.floor(W / 2 + (tx * TILE - lxC) * S), sy = Math.floor(H / 2 + (ty * TILE - lyC) * S);
          ctx.drawImage(c, sx, sy, Math.ceil(dsz) + 1, Math.ceil(dsz) + 1);
        }
      }
    }
    // warm cache for upcoming tiles (called during idle frames)
    prewarm(camX, camY, W, H, S, dir) {
      const lxC = camX * this.f + dir * (W / S) * 0.9, lyC = camY * this.fy - this.baseY;
      const tx = Math.floor(lxC / TILE), ty = Math.floor(lyC / TILE);
      for (let dy = -1; dy <= 1; dy++) { const k = tx + ',' + (ty + dy); if (!this.cache.has(k) && !this.empty.has(k)) { this.tile(tx, ty + dy); return; } }
    }
  }

  /* -------- palette per tint (0 = dusty dusk, 1 = cathedral crimson) -------- */
  const PAL = {
    skyTop: ['#1b1238', '#120a24'], skyMid: ['#6b4a78', '#5a1f4a'], skyLow: ['#ff9b5c', '#d63e5c'], horizon: ['#ffd48a', '#ff8a6a'],
    far: ['#c98d72', '#8a3d5c'], mid: ['#7a5a72', '#5a2a4c'], midDark: ['#5a3f5a', '#3e1a38'],
    near: ['#3a2a44', '#2c1430'], nearDark: ['#24182e', '#1c0c20'], rim: ['#ffc27a', '#ff7a6a'],
    ground: ['#9a7a62', '#6a4058'], groundDark: ['#2e2030', '#1e1020'], groundTop: ['#f0c890', '#e09a8a'],
    fog: ['#f2a878', '#d05a7a'],
  };
  G.PAL = PAL;
  const P = (k, t) => U.mixHex(PAL[k][0], PAL[k][1], U.clamp(t, 0, 1));

  /* -------- primitive painters -------- */
  function jaggedTop(g, x, top, w, rng, rough = 18) {
    // path along top of building from left to right with broken silhouette
    const n = Math.max(2, Math.floor(w / 14));
    g.lineTo(x, top + rng() * rough);
    for (let i = 1; i < n; i++) g.lineTo(x + (w * i) / n, top + rng() * rough * (rng() < 0.2 ? 3 : 1));
    g.lineTo(x + w, top + rng() * rough);
  }
  function building(g, rng, x, base, w, h, col, opts = {}) {
    const top = base - h;
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x, base + 600);
    if (opts.broken) jaggedTop(g, x, top, w, rng, opts.rough || 20);
    else { g.lineTo(x, top); g.lineTo(x + w, top); }
    g.lineTo(x + w, base + 600); g.closePath(); g.fill();
    // antenna / spires
    if (opts.spire) {
      g.fillRect(x + w * 0.45, top - opts.spire, Math.max(2, w * 0.04), opts.spire);
      g.fillRect(x + w * 0.3, top - opts.spire * 0.4, Math.max(1.5, w * 0.02), opts.spire * 0.4);
    }
    // windows
    if (opts.windows) {
      g.fillStyle = opts.winCol;
      const cw = opts.winW || 6, ch = opts.winH || 8, gx = opts.gapX || 12, gy = opts.gapY || 16;
      for (let yy = top + 24; yy < base - 10; yy += gy) {
        for (let xx = x + 8; xx < x + w - cw - 4; xx += gx) {
          const r = rng();
          if (r < 0.62) g.fillRect(xx, yy, cw, ch);
        }
      }
      if (opts.lit) {
        for (let i = 0; i < opts.lit; i++) {
          g.fillStyle = opts.litCol;
          g.fillRect(x + 8 + Math.floor(rng() * (w - 20) / gx) * gx, top + 24 + Math.floor(rng() * (h - 40) / gy) * gy, cw, ch);
        }
      }
    }
    // floor lines
    if (opts.floors) {
      g.fillStyle = opts.floorCol;
      for (let yy = top + 30; yy < base; yy += opts.floors) g.fillRect(x, yy, w, 2);
    }
    // rim light (sun from left-back)
    if (opts.rim) {
      const grd = g.createLinearGradient(x, 0, x + Math.min(30, w * 0.3), 0);
      grd.addColorStop(0, opts.rim); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(x, top + 6, Math.min(30, w * 0.3), h + 600);
    }
  }
  function crystal(g, x, y, s, rng, col = '#ff3d7f', glow = true) {
    const n = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rng() - 0.5) * 1.6, len = s * (0.5 + rng()), wd = s * 0.16 * (0.6 + rng());
      const bx = x + (rng() - 0.5) * s * 0.6;
      const tx = bx + Math.cos(a) * len, ty = y + Math.sin(a) * len;
      const nx = -Math.sin(a) * wd, ny = Math.cos(a) * wd;
      g.beginPath(); g.moveTo(bx - nx, y - ny); g.lineTo(tx, ty); g.lineTo(bx + nx, y + ny); g.closePath();
      const gr = g.createLinearGradient(bx, y, tx, ty);
      gr.addColorStop(0, '#16101a'); gr.addColorStop(0.6, U.rgba(col, 0.75)); gr.addColorStop(1, '#ffd0e0');
      g.fillStyle = gr; g.fill();
    }
    if (glow) {
      const r = g.createRadialGradient(x, y - s * 0.4, 0, x, y - s * 0.4, s * 1.4);
      r.addColorStop(0, U.rgba(col, 0.28)); r.addColorStop(1, U.rgba(col, 0));
      g.fillStyle = r; g.fillRect(x - s * 1.5, y - s * 2, s * 3, s * 3);
    }
  }
  function cables(g, x1, y1, x2, y2, sag, col, wdt = 1.2) {
    g.strokeStyle = col; g.lineWidth = wdt;
    g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2, Math.max(y1, y2) + sag, x2, y2); g.stroke();
  }
  function vines(g, rng, x, y, len, col) {
    g.strokeStyle = col; g.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      g.beginPath(); let cx = x + (rng() - 0.5) * 20, cy = y; g.moveTo(cx, cy);
      const L2 = len * (0.5 + rng());
      for (let k = 0; k < L2; k += 8) { cx += (rng() - 0.5) * 5; cy += 8; g.lineTo(cx, cy); }
      g.stroke();
      // leaves
      g.fillStyle = col;
      for (let k = 0; k < L2 / 14; k++) { g.beginPath(); g.ellipse(cx + (rng() - 0.5) * 10, y + rng() * L2, 3, 1.6, rng() * 3, 0, Math.PI * 2); g.fill(); }
    }
  }
  function gothicSpire(g, x, base, w, h, col, rng) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x, base + 600); g.lineTo(x, base - h * 0.6);
    g.lineTo(x + w * 0.15, base - h * 0.62); g.lineTo(x + w * 0.5, base - h); g.lineTo(x + w * 0.85, base - h * 0.62);
    g.lineTo(x + w, base - h * 0.6); g.lineTo(x + w, base + 600); g.closePath(); g.fill();
    // pinnacles
    for (let i = 0; i < 3; i++) { const px = x + w * (0.1 + i * 0.4); g.beginPath(); g.moveTo(px - 4, base - h * 0.55); g.lineTo(px, base - h * 0.72 - rng() * 20); g.lineTo(px + 4, base - h * 0.55); g.fill(); }
  }

  /* -------- layer generators -------- */
  function genFar() {
    const rng = U.mulberry32(1337), objs = [];
    const f = 0.08, len = 9400 * f + 900;
    // atmospheric base band
    objs.push({ x: -800, y: -10, w: len + 1600, h: 700, draw(g) {
      const gr = g.createLinearGradient(0, -10, 0, 300); gr.addColorStop(0, U.rgba('#c7a98a', 0)); gr.addColorStop(0.15, U.rgba('#b59a83', 0.9)); gr.addColorStop(1, '#8a7466');
      g.fillStyle = gr; g.fillRect(this.x, this.y, this.w, this.h);
    } });
    let x = -700;
    while (x < len) {
      const w = 40 + rng() * 120, h = 140 + rng() * 380, wx = x / f, t = L.tintAt(wx);
      const col = U.mixHex(P('far', t), P('skyLow', t), 0.25 + rng() * 0.3);
      const bx = x, spire = rng() < 0.4 ? 40 + rng() * 120 : 0, broken = rng() < 0.5, r2 = rng() * 1e6;
      objs.push({ x: bx - 2, y: -h - spire - 60, w: w + 4, h: h + spire + 700, draw(g) {
        const rr = U.mulberry32(r2 | 0);
        // distant towers still read as architecture: faint window grid, floor bands, a few lit rooms, a sun-side rim
        building(g, rr, bx, 0, w, h, col, {
          spire, broken, rough: 10, windows: true, winCol: U.rgba(U.mixHex(col, '#2a0e3c', 0.35), 0.55), winW: 4, winH: 6, gapX: 9, gapY: 13,
          lit: 2 + Math.floor(rr() * 4), litCol: 'rgba(255,226,170,0.75)', floors: 39, floorCol: U.rgba(U.mixHex(col, '#2a0e3c', 0.3), 0.35), rim: 'rgba(255,232,190,0.45)',
        });
        g.strokeStyle = U.rgba('#2a0e3c', 0.35); g.lineWidth = 1.2; g.strokeRect(bx + 0.6, -h + 0.6, w - 1.2, h + 600);
      } });
      x += w * (0.5 + rng() * 0.7);
    }
    // the broken space elevator "Cantata Ladder"
    const ex = 3300 * f;
    objs.push({ x: ex - 160, y: -1400, w: 320, h: 1410, draw(g) {
      g.fillStyle = 'rgba(160,150,150,0.55)';
      g.fillRect(ex - 3, -1400, 6, 1400);
      g.fillRect(ex - 10, -300, 20, 300);
      g.fillStyle = 'rgba(160,150,150,0.4)';
      g.beginPath(); g.ellipse(ex, -760, 90, 12, 0, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = 'rgba(150,140,140,0.5)'; g.stroke();
      // snapped dangling segment
      g.save(); g.translate(ex + 2, -520); g.rotate(0.25); g.fillRect(-2, 0, 4, 160); g.restore();
    } });
    return new TiledLayer('far', f, 0.03, 60, 0.55, objs);
  }

  /* -------- ruined tower painter: collapse notches, breaches, slabs, overgrowth, sun-side rim -------- */
  function ruinTower(g, rng, x, base, w, h, C, o = {}) {
    const top = base - h, deep = base + 700;
    // silhouette
    const pts = [];
    const n = Math.max(3, Math.floor(w / 12));
    const notchC = rng(), notchW = 0.25 + rng() * 0.35, notchD = h * (0.08 + rng() * (o.collapse ?? 0.3));
    const slant = (rng() - 0.5) * 30;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      let y = top + slant * u + rng() * 8;
      const dn = Math.abs(u - notchC) / notchW;
      if (dn < 1 && o.broken !== false) y += notchD * (1 - dn * dn) + rng() * 14;
      pts.push([x + u * w, y]);
    }
    g.beginPath(); g.moveTo(x, deep);
    for (const [px, py] of pts) g.lineTo(px, py);
    g.lineTo(x + w, deep); g.closePath();
    const vg = g.createLinearGradient(0, top, 0, base + 60);
    vg.addColorStop(0, C.lit); vg.addColorStop(0.18, C.body); vg.addColorStop(1, C.dark);
    g.fillStyle = vg; g.fill();
    g.save(); g.clip();
    // facade lighting: sun from the right
    g.fillStyle = 'rgba(34,8,44,0.38)'; g.fillRect(x, top - 60, w * 0.32, h + 760);
    g.strokeStyle = 'rgba(14,4,22,0.28)'; g.lineWidth = 1;
    g.beginPath(); for (let hy = top; hy < base; hy += 7) { g.moveTo(x, hy + 6); g.lineTo(x + w * 0.3, hy - w * 0.12); } g.stroke();
    g.fillStyle = U.rgba(C.rim, 0.22); g.fillRect(x + w * 0.84, top - 60, w * 0.16, h + 760);
    const hg = g.createLinearGradient(x, 0, x + w, 0);
    hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hg; g.fillRect(x, top - 60, w, h + 760);
    // floor slabs + windows
    const fh = o.floor || 20 + Math.floor(rng() * 8);
    const cols = Math.max(2, Math.floor(w / (o.winGap || 15)));
    const cw = w / cols;
    for (let yy = top + fh * 0.6; yy < base + 10; yy += fh) {
      g.fillStyle = U.rgba(C.slab, 0.55); g.fillRect(x, yy, w, 1.6);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, yy + 1.6, w, 2.4);
      if (o.windows === false) continue;
      for (let c = 0; c < cols; c++) {
        const r = rng();
        if (r < 0.32) continue;
        const wx = x + c * cw + cw * 0.22, ww = cw * 0.56, wy = yy + 5, wh = fh - 9;
        if (r > 0.985 && o.lit) { g.fillStyle = 'rgba(255,200,140,0.55)'; g.fillRect(wx, wy, ww, wh); continue; }
        g.fillStyle = C.win; g.fillRect(wx, wy, ww, wh);
        if (r > 0.9) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(wx - cw * 0.3, wy, ww + cw * 0.6, wh); }
      }
    }
    // structural breach with exposed girders
    if (o.breach !== false && rng() < 0.65 && w > 70) {
      const bx = x + w * (0.15 + rng() * 0.5), by = top + h * (0.15 + rng() * 0.45), bw = w * (0.2 + rng() * 0.3), bh = h * (0.12 + rng() * 0.2);
      g.fillStyle = 'rgba(8,7,10,0.88)';
      g.beginPath(); g.moveTo(bx, by + rng() * 10);
      for (let k = 1; k <= 6; k++) g.lineTo(bx + (bw * k) / 6, by + (rng() - 0.5) * 16);
      g.lineTo(bx + bw + rng() * 8, by + bh); for (let k = 5; k >= 0; k--) g.lineTo(bx + (bw * k) / 6, by + bh + (rng() - 0.5) * 16);
      g.closePath(); g.fill();
      g.strokeStyle = U.rgba(C.slab, 0.45); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(bx, by + bh * 0.5); g.lineTo(bx + bw, by + bh * 0.5);
      g.moveTo(bx + bw * 0.3, by); g.lineTo(bx + bw * 0.62, by + bh); g.moveTo(bx + bw * 0.62, by); g.lineTo(bx + bw * 0.3, by + bh); g.stroke();
    }
    // weathering streaks
    for (let k = 0; k < w / 18; k++) {
      const sx = x + rng() * w, sy = top + rng() * h * 0.6, sl = 30 + rng() * 120;
      const sg = g.createLinearGradient(0, sy, 0, sy + sl); sg.addColorStop(0, 'rgba(10,8,8,0.25)'); sg.addColorStop(1, 'rgba(10,8,8,0)');
      g.fillStyle = sg; g.fillRect(sx, sy, 2 + rng() * 4, sl);
    }
    g.restore();
    // bold ink contour around the whole silhouette (heavier on nearer layers)
    g.strokeStyle = 'rgba(16,6,22,0.9)'; g.lineWidth = o.ink || 2.2; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x, base + 40); pts.forEach(([px, py]) => g.lineTo(px, py)); g.lineTo(x + w, base + 40); g.stroke();
    // moss / sand on the broken top, rebar, overgrowth
    g.strokeStyle = U.rgba(C.moss, 0.55); g.lineWidth = 1.6; g.lineJoin = 'round';
    g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py + 1.5) : g.moveTo(px, py + 1.5))); g.stroke();
    g.strokeStyle = U.rgba(C.rim, 0.35); g.lineWidth = 0.6;
    g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
    g.strokeStyle = C.dark; g.lineWidth = 1.3;
    for (let k = 0; k < Math.floor(w / 25); k++) { const p = pts[Math.floor(rng() * pts.length)]; g.beginPath(); g.moveTo(p[0], p[1] + 2); g.lineTo(p[0] + (rng() - 0.5) * 14, p[1] - 8 - rng() * 22); g.stroke(); }
    if (o.vines !== false) {
      const nv = Math.floor(rng() * 4);
      for (let k = 0; k < nv; k++) { const p = pts[Math.floor(rng() * pts.length)]; vines(g, rng, p[0], p[1], 50 + rng() * h * 0.6, C.vine); }
    }
    return pts;
  }

  function genMid() {
    const rng = U.mulberry32(4242), objs = [];
    const f = 0.22, len = 9400 * f + 900;
    objs.push({ x: -800, y: 20, w: len + 1600, h: 700, draw(g) { g.fillStyle = '#5a5058'; g.fillRect(this.x, this.y, this.w, this.h); } });
    let x = -600;
    while (x < len) {
      const w = 50 + rng() * 120, h = 140 + rng() * 300, wx = x / f, t = L.tintAt(wx);
      const haze = 0.32 + rng() * 0.18;
      const C = {
        body: U.mix(P('mid', t), P('fog', t), haze), dark: U.mix(P('midDark', t), P('fog', t), haze * 0.8), lit: U.mix(P('fog', t), '#ffffff', 0.1),
        slab: U.mixHex(P('fog', t), '#ffffff', 0.2), win: U.mix(P('midDark', t), P('fog', t), haze * 0.6, 0.5), moss: '#7d8a6a', rim: P('rim', t), vine: 'rgba(70,84,60,0.6)',
      };
      const r2 = rng() * 1e6, lean = rng() < 0.15 ? (rng() - 0.5) * 0.22 : 0, bx = x;
      const crystalOn = (rng() < 0.3 && t > 0.15) || rng() < 0.12;
      const cath = wx > 6500 && rng() < 0.5;
      objs.push({ x: bx - 140, y: -h - 220, w: w + 280, h: h + 900, draw(g) {
        const rr = U.mulberry32(r2 | 0);
        g.translate(bx + w / 2, 30); g.rotate(lean); g.translate(-(bx + w / 2), -30);
        if (cath) gothicSpire(g, bx, 30, w, h * 1.3, C.body, rr);
        else ruinTower(g, rr, bx, 30, w, h, C, { winGap: 11, floor: 15, vines: false, breach: rr() < 0.5, lit: true, ink: 1.1 });
        if (crystalOn) crystal(g, bx + w * rr(), 30 - h * (0.3 + rr() * 0.6), 18 + rr() * 22, rr, t > 0.6 ? '#ff2a5f' : '#d64dff');
      } });
      x += w * (0.6 + rng() * 0.7);
    }
    objs.push({ x: -800, y: -300, w: len + 1600, h: 340, draw(g) {
      const gr = g.createLinearGradient(0, -300, 0, 40); gr.addColorStop(0, 'rgba(230,190,150,0)'); gr.addColorStop(1, 'rgba(226,178,140,0.62)');
      g.fillStyle = gr; g.fillRect(this.x, this.y, this.w, this.h);
    } });
    return new TiledLayer('mid', f, 0.1, 80, 0.7, objs);
  }

  function genNear() {
    const rng = U.mulberry32(9001), objs = [];
    const f = 0.45, len = 9400 * f + 900;
    objs.push({ x: -800, y: 40, w: len + 1600, h: 800, draw(g) { g.fillStyle = '#26232a'; g.fillRect(this.x, this.y, this.w, this.h); } });
    let x = -500;
    while (x < len) {
      const wx = x / f, t = L.tintAt(wx);
      const gap = rng() < 0.3;
      const w = 80 + rng() * 150, h = 110 + rng() * 240;
      const C = {
        body: P('near', t), dark: P('nearDark', t), lit: U.mixHex(P('near', t), P('rim', t), 0.35), slab: U.mixHex(P('near', t), P('rim', t), 0.4),
        win: 'rgba(10,9,13,0.78)', moss: t > 0.6 ? '#3f3438' : '#4f5e3c', rim: P('rim', t), vine: t > 0.6 ? 'rgba(60,40,50,0.95)' : 'rgba(52,70,44,0.95)',
      };
      const r2 = rng() * 1e6, bx = x, kind = rng();
      const cath = wx > 6400;
      if (!gap) objs.push({ x: bx - 160, y: -h * 1.6 - 280, w: w + 320, h: h * 1.6 + 1000, draw(g) {
        const rr = U.mulberry32(r2 | 0);
        if (cath && kind < 0.55) {
          gothicSpire(g, bx, 40, w, h * 1.6, C.dark, rr);
          g.strokeStyle = U.rgba('#ff4d7a', 0.35); g.lineWidth = 3;
          g.beginPath(); g.arc(bx + w / 2, 40 - h * 0.6, w * 0.22, 0, Math.PI * 2); g.stroke();
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(bx + w / 2, 40 - h * 0.6); g.lineTo(bx + w / 2 + Math.cos(a) * w * 0.22, 40 - h * 0.6 + Math.sin(a) * w * 0.22); g.stroke(); }
          return;
        }
        ruinTower(g, rr, bx, 40, w, h, C, { winGap: 18, collapse: 0.45 });
        if (rr() < 0.35) {
          const sx = bx + w * 0.18, sy = 40 - h * (0.35 + rr() * 0.3);
          g.fillStyle = '#16141a'; g.fillRect(sx, sy, 26, 70);
          g.fillStyle = rr() < 0.5 ? 'rgba(111,243,255,0.5)' : 'rgba(255,90,130,0.45)';
          g.font = 'bold 18px "Noto Serif TC", serif'; g.textAlign = 'center';
          const words = ['灰港', '鐘樓', '劇院', '旅館', '藥局', '電台'];
          const wd = words[Math.floor(rr() * words.length)];
          g.fillText(wd[0], sx + 13, sy + 28); g.fillText(wd[1], sx + 13, sy + 54);
        }
        if (rr() < 0.3) crystal(g, bx + rr() * w, 40 - h * rr() * 0.8, 20 + rr() * 30, rr, t > 0.6 ? '#ff2a5f' : '#c94dff');
      } });
      if (rng() < 0.2) {
        const ox = x + w * 0.5, ow = 260 + rng() * 260, oy = -40 - rng() * 110, tilt = (rng() - 0.5) * 0.18;
        objs.push({ x: ox - 20, y: oy - 80, w: ow + 40, h: 240 - oy, draw(g) {
          g.save(); g.translate(ox, oy); g.rotate(tilt);
          g.fillStyle = '#23222a'; g.fillRect(0, 0, ow, 16); g.fillStyle = U.rgba(C.rim, 0.35); g.fillRect(0, -3, ow, 3);
          g.fillStyle = '#1d1c22'; for (let i = 20; i < ow; i += 90) g.fillRect(i, 16, 14, 160 - oy);
          g.strokeStyle = '#18171c'; g.lineWidth = 1; for (let i = 0; i < ow; i += 6) { g.beginPath(); g.moveTo(i, -3); g.lineTo(i, -13); g.stroke(); }
          // snapped end with hanging slab
          g.fillStyle = '#23222a'; g.beginPath(); g.moveTo(ow, 0); g.lineTo(ow + 30, 50); g.lineTo(ow + 18, 56); g.lineTo(ow - 6, 16); g.fill();
          g.restore();
          cables(g, ox + ow * 0.2, oy + 16, ox + ow * 0.6, oy + 20, 60, 'rgba(15,14,18,0.8)');
          vines(g, U.mulberry32(ox | 0), ox + ow * 0.4, oy + 16, 80, C.vine);
        } });
      }
      x += w * (gap ? 1.1 : 0.85 + rng() * 0.5);
    }
    return new TiledLayer('near', f, 0.25, 110, 0.85, objs);
  }

  /* -------- gameplay-plane art (ground, props) -------- */
  function genGround(def) {
    const objs = [];
    const rng = U.mulberry32(777);
    const custom = (def && def.solidPainters) || {};
    for (const s of L.solids) {
      if (s.kind === 'wall' || s.kind === 'invisible') continue;
      const ss = s;
      if (custom[s.kind]) { const o = custom[s.kind](ss, WK); if (o) objs.push(...(Array.isArray(o) ? o : [o])); continue; }
      if (s.kind === 'ground') {
        objs.push({ x: s.x - 10, y: s.y - 40, w: s.w + 20, h: s.h + 40, draw(g) {
          const rr = U.mulberry32(Math.floor(ss.x * 13));
          const t = L.tintAt(ss.x + ss.w / 2);
          const gr = g.createLinearGradient(0, ss.y, 0, ss.y + 260);
          gr.addColorStop(0, P('ground', t)); gr.addColorStop(0.08, U.mixHex(P('ground', t), P('groundDark', t), 0.55)); gr.addColorStop(1, P('groundDark', t));
          g.fillStyle = gr; g.fillRect(ss.x, ss.y, ss.w, ss.h);
          // strata / slabs
          g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5;
          for (let xx = ss.x; xx < ss.x + ss.w; xx += 60 + rr() * 140) {
            g.beginPath(); g.moveTo(xx, ss.y + 4); let cy = ss.y + 4, cx = xx;
            while (cy < ss.y + 160) { cx += (rr() - 0.5) * 18; cy += 10 + rr() * 16; g.lineTo(cx, cy); }
            g.stroke();
          }
          for (let yy = ss.y + 30; yy < ss.y + 300; yy += 34 + rr() * 30) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(ss.x, yy, ss.w, 2); }
          // road surface band, seen from slightly above: asphalt, lane paint, cracks, puddles reflecting the sky
          const SB = 18;
          const sg = g.createLinearGradient(0, ss.y, 0, ss.y + SB);
          sg.addColorStop(0, U.mixHex(P('groundTop', t), P('ground', t), 0.45)); sg.addColorStop(0.5, P('ground', t)); sg.addColorStop(1, U.mixHex(P('ground', t), P('groundDark', t), 0.35));
          g.fillStyle = sg; g.fillRect(ss.x, ss.y, ss.w, SB);
          g.fillStyle = P('groundTop', t); g.fillRect(ss.x, ss.y, ss.w, 1.6);
          g.fillStyle = '#140a1a'; g.fillRect(ss.x, ss.y - 1.2, ss.w, 1.6); // ink edge
          g.fillStyle = 'rgba(10,8,10,0.45)'; g.fillRect(ss.x, ss.y + SB, ss.w, 2.5);
          g.fillStyle = 'rgba(255,240,210,0.18)'; g.fillRect(ss.x, ss.y + SB + 2.5, ss.w, 1.2);
          if (ss.w > 1500) {
            g.fillStyle = 'rgba(232,214,168,0.32)';
            for (let xx = ss.x + 20; xx < ss.x + ss.w; xx += 74) if (rr() > 0.18) { const fade = 0.4 + rr() * 0.6; g.globalAlpha = fade; g.fillRect(xx, ss.y + 8.5, 34 * (0.6 + rr() * 0.4), 1.6); }
            g.globalAlpha = 1;
          }
          g.strokeStyle = 'rgba(20,14,14,0.45)'; g.lineWidth = 0.7;
          for (let xx = ss.x; xx < ss.x + ss.w; xx += 40 + rr() * 90) {
            g.beginPath(); let cx = xx, cy = ss.y + 2 + rr() * 6; g.moveTo(cx, cy);
            for (let k = 0; k < 4; k++) { cx += 6 + rr() * 12; cy = U.clamp(cy + (rr() - 0.5) * 6, ss.y + 1, ss.y + SB - 1); g.lineTo(cx, cy); }
            g.stroke();
          }
          for (let xx = ss.x + 200; xx < ss.x + ss.w - 100; xx += 260 + rr() * 520) {
            const pw = 30 + rr() * 70, ph = 2.5 + rr() * 2.5, py = ss.y + 6 + rr() * 6;
            const pg = g.createLinearGradient(0, py - ph, 0, py + ph);
            pg.addColorStop(0, P('horizon', t)); pg.addColorStop(0.6, P('skyLow', t)); pg.addColorStop(1, P('skyMid', t));
            g.fillStyle = pg; g.beginPath(); g.ellipse(xx, py, pw, ph, 0, 0, Math.PI * 2); g.fill();
            g.strokeStyle = 'rgba(255,248,230,0.55)'; g.lineWidth = 0.6; g.beginPath(); g.ellipse(xx, py, pw * 0.7, ph * 0.5, 0, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
            g.strokeStyle = 'rgba(30,22,22,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(xx, py, pw, ph, 0, 0, Math.PI * 2); g.stroke();
          }
          // sand drifts + rubble
          for (let xx = ss.x; xx < ss.x + ss.w; xx += 12 + rr() * 40) {
            const r = rr();
            if (r < 0.35) { g.fillStyle = U.rgba(P('groundTop', t), 0.55); g.beginPath(); g.ellipse(xx, ss.y + 1, 20 + rr() * 40, 3 + rr() * 3, 0, Math.PI, 0); g.fill(); }
            else if (r < 0.6) { g.fillStyle = U.mixHex(P('groundDark', t), P('ground', t), 0.5); const rw = 4 + rr() * 10; g.beginPath(); g.moveTo(xx, ss.y); g.lineTo(xx + rw * 0.3, ss.y - rw * 0.7); g.lineTo(xx + rw, ss.y - rw * 0.4); g.lineTo(xx + rw * 1.2, ss.y); g.fill(); }
            else if (r < 0.66) { g.strokeStyle = '#4a3f3a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(xx, ss.y); g.lineTo(xx + (rr() - 0.5) * 20, ss.y - 8 - rr() * 18); g.stroke(); }
            else if (r < 0.72) { g.fillStyle = 'rgba(70,88,60,0.85)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(xx + k * 2, ss.y); g.quadraticCurveTo(xx + k * 2 + 3, ss.y - 8, xx + k * 2 + (rr() - 0.3) * 8, ss.y - 10 - rr() * 10); g.lineTo(xx + k * 2 + 1, ss.y); g.fill(); } }
          }
          // step faces (vertical edges facing left)
          g.fillStyle = 'rgba(255,220,180,0.10)'; g.fillRect(ss.x, ss.y, 4, ss.h);
        } });
      } else if (s.kind === 'roof') {
        objs.push({ x: s.x - 20, y: s.y - 60, w: s.w + 40, h: 500, draw(g) {
          g.fillStyle = '#3a3438'; g.fillRect(ss.x, ss.y, ss.w, ss.h);
          g.fillStyle = '#c9b49a'; g.fillRect(ss.x, ss.y, ss.w, 3);
          g.fillStyle = '#26222a'; g.fillRect(ss.x, ss.y + ss.h - 8, ss.w, 8);
          // railings & water tanks
          g.strokeStyle = '#1e1b20'; g.lineWidth = 2;
          g.beginPath(); for (let xx = ss.x + 10; xx < ss.x + ss.w; xx += 22) { g.moveTo(xx, ss.y); g.lineTo(xx, ss.y - 26); } g.moveTo(ss.x, ss.y - 26); g.lineTo(ss.x + ss.w * 0.4, ss.y - 26); g.stroke();
          g.fillStyle = '#2a262c'; g.fillRect(ss.x + ss.w * 0.55, ss.y - 70, 60, 70); g.fillRect(ss.x + ss.w * 0.55 + 6, ss.y - 84, 48, 14);
          // hanging supports underneath
          g.fillStyle = '#1d1a1f'; for (let xx = ss.x + 40; xx < ss.x + ss.w; xx += 160) g.fillRect(xx, ss.y + ss.h, 18, 380);
          cables(g, ss.x + 60, ss.y + ss.h, ss.x + 300, ss.y + ss.h, 60, 'rgba(10,10,12,0.9)', 1.5);
          cables(g, ss.x + 500, ss.y + ss.h, ss.x + 720, ss.y + ss.h, 90, 'rgba(10,10,12,0.9)', 1.5);
          // neon "鐘塔" sign
          g.fillStyle = '#141216'; g.fillRect(ss.x + ss.w - 120, ss.y - 110, 90, 34);
          g.font = 'bold 22px "Noto Serif TC", serif'; g.fillStyle = 'rgba(255,190,120,0.75)'; g.textAlign = 'center'; g.fillText('鐘 塔', ss.x + ss.w - 75, ss.y - 85);
        } });
      } else if (s.kind === 'car') {
        objs.push({ x: s.x - 30, y: s.y - 40, w: s.w + 60, h: s.h + 50, draw(g) {
          const x = ss.x, y = ss.y, w = ss.w, h = ss.h;
          g.fillStyle = '#2b2a2f';
          g.beginPath(); g.moveTo(x - 6, y + h); g.lineTo(x, y + 26); g.lineTo(x + 30, y + 22); g.lineTo(x + 52, y - 4); g.lineTo(x + 116, y - 2); g.lineTo(x + 140, y + 22); g.lineTo(x + w + 6, y + 30); g.lineTo(x + w + 8, y + h); g.closePath(); g.fill();
          g.fillStyle = '#5c6a70'; g.beginPath(); g.moveTo(x + 58, y + 2); g.lineTo(x + 84, y + 2); g.lineTo(x + 84, y + 20); g.lineTo(x + 40, y + 22); g.closePath(); g.fill();
          g.fillStyle = '#4a565c'; g.beginPath(); g.moveTo(x + 90, y + 2); g.lineTo(x + 112, y + 3); g.lineTo(x + 130, y + 20); g.lineTo(x + 90, y + 20); g.fill();
          g.fillStyle = '#a99780'; g.fillRect(x, y + 26, w, 2);
          g.fillStyle = '#121114'; g.beginPath(); g.arc(x + 32, y + h - 4, 15, 0, Math.PI * 2); g.arc(x + 124, y + h - 4, 15, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(217,195,160,0.6)'; g.beginPath(); g.ellipse(x + 70, y - 2, 40, 4, 0, Math.PI, 0); g.fill();
          g.fillStyle = 'rgba(70,90,60,0.9)'; for (let k = 0; k < 6; k++) g.fillRect(x + 100 + k * 5, y + h - 14 - k * 2, 2, 14 + k * 2);
        } });
      } else if (s.kind === 'crate') {
        objs.push({ x: s.x - 5, y: s.y - 5, w: s.w + 10, h: s.h + 10, draw(g) {
          g.fillStyle = '#4a3f38'; g.fillRect(ss.x, ss.y, ss.w, ss.h);
          g.strokeStyle = '#2a231f'; g.lineWidth = 2; g.strokeRect(ss.x + 2, ss.y + 2, ss.w - 4, ss.h - 4);
          g.beginPath(); g.moveTo(ss.x, ss.y); g.lineTo(ss.x + ss.w, ss.y + ss.h); g.stroke();
          g.fillStyle = '#c9b49a'; g.fillRect(ss.x, ss.y, ss.w, 2);
        } });
      }
    }
    for (const p of L.oneways) {
      const pp = p;
      if (def && def.onewayPainter) { const o = def.onewayPainter(pp, WK); if (o) objs.push(...(Array.isArray(o) ? o : [o])); continue; }
      objs.push({ x: p.x - 10, y: p.y - 10, w: p.w + 20, h: 200, draw(g) {
        g.fillStyle = '#2e2b31'; g.fillRect(pp.x, pp.y, pp.w, 14);
        g.fillStyle = '#c8b398'; g.fillRect(pp.x, pp.y, pp.w, 2);
        g.strokeStyle = '#1f1d22'; g.lineWidth = 2;
        g.beginPath(); for (let xx = pp.x; xx < pp.x + pp.w - 10; xx += 24) { g.moveTo(xx, pp.y + 14); g.lineTo(xx + 12, pp.y + 2); g.lineTo(xx + 24, pp.y + 14); } g.stroke();
        g.strokeStyle = '#5a4a40'; g.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) { const rx = pp.x + 10 + i * (pp.w / 4); g.beginPath(); g.moveTo(rx, pp.y + 14); g.lineTo(rx + 3, pp.y + 40 + i * 9); g.stroke(); }
        cables(g, pp.x + 10, pp.y + 14, pp.x + pp.w - 10, pp.y + 14, 30, 'rgba(15,14,18,0.8)');
      } });
    }
    if (def && !def.defaultBg) {
      const extra = def.bg && def.bg.props ? def.bg.props(WK) : [];
      return new TiledLayer('ground', 1, 1, 0, 1, objs.concat(extra || []));
    }
    // decor props (chapter 1)
    const props = [];
    const lamp = (x, y, bent = 0) => props.push({ x: x - 50, y: y - 230, w: 120, h: 240, draw(g) {
      g.strokeStyle = '#1c1b20'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 150); g.quadraticCurveTo(x + bent * 0.4, y - 210, x + 30 + bent, y - 200 + Math.abs(bent) * 0.5); g.stroke();
      g.fillStyle = '#1c1b20'; g.fillRect(x + 22 + bent, y - 204 + Math.abs(bent) * 0.5, 24, 8);
      g.fillStyle = '#2a282e'; g.fillRect(x - 7, y - 16, 14, 16);
    } });
    const barricade = (x, y) => props.push({ x: x - 10, y: y - 50, w: 120, h: 60, draw(g) {
      g.fillStyle = '#35333a'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y - 40); g.lineTo(x + 90, y - 40); g.lineTo(x + 104, y); g.fill();
      g.fillStyle = 'rgba(255,170,90,0.6)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x + 18 + i * 20, y - 36); g.lineTo(x + 28 + i * 20, y - 36); g.lineTo(x + 20 + i * 20, y - 12); g.lineTo(x + 10 + i * 20, y - 12); g.fill(); }
    } });
    const xtal = (x, y, s, col) => props.push({ x: x - s * 2, y: y - s * 2.2, w: s * 4, h: s * 2.4, draw(g) { crystal(g, x, y, s, U.mulberry32(x | 0), col); } });
    const sign = (x, y, txt) => props.push({ x: x - 40, y: y - 140, w: 120, h: 150, draw(g) {
      g.fillStyle = '#1a191d'; g.fillRect(x - 3, y - 130, 6, 130);
      g.save(); g.translate(x, y - 120); g.rotate(-0.12);
      g.fillStyle = '#2f4f4a'; g.fillRect(-46, -16, 92, 32);
      g.strokeStyle = 'rgba(230,230,220,0.6)'; g.lineWidth = 1.5; g.strokeRect(-43, -13, 86, 26);
      g.fillStyle = 'rgba(235,235,225,0.85)'; g.font = '600 13px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.fillText(txt, 0, 5);
      g.restore();
    } });
    lamp(380, 0, 20); lamp(1420, 0, -40); lamp(2350, 0, 30); lamp(3300, -90, 0); lamp(4150, -90, -30); lamp(6500, 0, 25);
    barricade(1050, 0); barricade(2230, 0); barricade(4600, -90);
    sign(1300, 0, '灰港 中央區 →'); sign(3150, -90, '沉鐘大道'); sign(6600, 0, '大教堂 1.2km');
    xtal(1640, 0, 26, '#d64dff'); xtal(2560, 0, 34, '#d64dff'); xtal(3700, -90, 30, '#e04dff'); xtal(4420, -90, 40, '#ff3d7f');
    xtal(5810, -90, 36, '#ff3d7f'); xtal(6900, 0, 30, '#ff2a5f'); xtal(7400, 0, 48, '#ff2a5f'); xtal(7700, 0, 60, '#ff2a5f'); xtal(8950, 0, 70, '#ff2a5f');
    // Barrow's cracked bell
    props.push({ x: 6150, y: -260, w: 260, h: 270, draw(g) {
      const bx = 6300, by = 0;
      g.fillStyle = '#1e1c21'; g.fillRect(bx - 90, by - 230, 14, 230); g.fillRect(bx + 76, by - 230, 14, 230); g.fillRect(bx - 100, by - 240, 200, 16);
      const gr = g.createLinearGradient(bx - 50, 0, bx + 50, 0); gr.addColorStop(0, '#5a3d24'); gr.addColorStop(0.4, '#b98a52'); gr.addColorStop(0.7, '#7a5530'); gr.addColorStop(1, '#3b2716');
      g.fillStyle = gr; g.beginPath(); g.moveTo(bx - 20, by - 220); g.quadraticCurveTo(bx - 30, by - 180, bx - 44, by - 130); g.quadraticCurveTo(bx - 52, by - 110, bx - 58, by - 104); g.lineTo(bx + 58, by - 104); g.quadraticCurveTo(bx + 52, by - 110, bx + 44, by - 130); g.quadraticCurveTo(bx + 30, by - 180, bx + 20, by - 220); g.closePath(); g.fill();
      g.strokeStyle = '#1a120c'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx + 10, by - 210); g.lineTo(bx + 4, by - 170); g.lineTo(bx + 14, by - 140); g.lineTo(bx + 6, by - 106); g.stroke();
      g.fillStyle = '#2a1d12'; g.fillRect(bx - 58, by - 108, 116, 5);
    } });
    // cathedral gate + boss arena architecture
    props.push({ x: 7500, y: -900, w: 1600, h: 910, draw(g) {
      const c1 = '#221622', c2 = '#2e1d2c';
      // columns
      for (let i = 0; i < 7; i++) {
        const cx = 7560 + i * 230;
        g.fillStyle = c2; g.fillRect(cx, -820, 46, 820);
        g.fillStyle = 'rgba(255,120,140,0.08)'; g.fillRect(cx, -820, 6, 820);
        g.fillStyle = c1; g.fillRect(cx - 8, -40, 62, 40); g.fillRect(cx - 8, -840, 62, 30);
        if (i < 6) {
          g.strokeStyle = c2; g.lineWidth = 16; g.beginPath(); g.arc(cx + 23 + 115, -820, 115, Math.PI, 0); g.stroke();
          // stained glass (broken)
          const wx = cx + 70, wy = -720;
          const gr = g.createLinearGradient(wx, wy, wx, wy + 300);
          gr.addColorStop(0, 'rgba(255,80,120,0.20)'); gr.addColorStop(0.5, 'rgba(140,70,255,0.14)'); gr.addColorStop(1, 'rgba(255,170,90,0.10)');
          g.fillStyle = gr; g.beginPath(); g.moveTo(wx, wy + 300); g.lineTo(wx, wy + 60); g.quadraticCurveTo(wx + 45, wy - 20, wx + 90, wy + 60); g.lineTo(wx + 90, wy + 300); g.fill();
          g.strokeStyle = 'rgba(20,10,20,0.7)'; g.lineWidth = 2;
          for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(wx + k * 15, wy + 40); g.lineTo(wx + k * 15, wy + 300); g.stroke(); }
        }
      }
      // floor runes
      g.strokeStyle = 'rgba(255,60,110,0.25)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(8260, 0, 420, 10, 0, Math.PI, 0); g.stroke();
    } });
    // drop pod wreck
    props.push({ x: 60, y: -150, w: 260, h: 160, draw(g) {
      const x = 150, y = 0;
      g.save(); g.translate(x, y); g.rotate(-0.28);
      const gr = g.createLinearGradient(-60, 0, 60, 0); gr.addColorStop(0, '#d8d8d4'); gr.addColorStop(0.6, '#9a9b9c'); gr.addColorStop(1, '#4a4a4e');
      g.fillStyle = gr; g.beginPath(); g.moveTo(-50, 10); g.lineTo(-56, -70); g.quadraticCurveTo(0, -150, 56, -70); g.lineTo(50, 10); g.closePath(); g.fill();
      g.fillStyle = '#1c1c20'; g.beginPath(); g.moveTo(-26, -40); g.quadraticCurveTo(0, -90, 26, -40); g.lineTo(22, -10); g.lineTo(-22, -10); g.fill();
      g.fillStyle = '#6ff3ff'; g.fillRect(-40, -4, 80, 3);
      g.fillStyle = '#2a2a2e'; g.font = 'bold 12px Rajdhani, sans-serif'; g.textAlign = 'center'; g.fillText('VII-07', 0, -56);
      g.restore();
      g.fillStyle = 'rgba(40,30,25,0.6)'; g.beginPath(); g.ellipse(150, 2, 140, 10, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(30,25,22,0.8)'; g.lineWidth = 2; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(150, 0); g.lineTo(150 + Math.cos(i) * 150, Math.sin(i * 3) * 4); g.stroke(); }
    } });
    return new TiledLayer('ground', 1, 1, 0, 1, objs.concat(props));
  }

  /* -------- volumetric clouds: horizontally tileable fBm density, lit from the sun (upper right) -------- */
  function makeClouds(variant, seed, cols) {
    const W = 640, H = 200, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, rng = U.mulberry32(seed);
    const octs = [[6, 3, 0.55], [12, 6, 0.27], [24, 12, 0.13], [48, 24, 0.07]].map(([gx, gy, amp]) => ({ gx, gy, amp, v: Float32Array.from({ length: gx * (gy + 1) }, () => rng()) }));
    const sm = (t) => t * t * (3 - 2 * t);
    const dens = (x, y) => {
      let s = 0;
      for (const o of octs) {
        const fx = (x / W) * o.gx, fy = (y / H) * o.gy, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
        const at = (a, b) => o.v[(Math.min(b, o.gy) * o.gx) + (((a % o.gx) + o.gx) % o.gx)];
        s += o.amp * U.lerp(U.lerp(at(ix, iy), at(ix + 1, iy), tx), U.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty);
      }
      const v = y / H; // banks thin out at the top and bottom
      return s * (1 - Math.pow(Math.abs(v - 0.55) * 1.9, 2.2));
    };
    const lit = cols ? cols.lit : variant ? [255, 190, 196] : [255, 226, 190], shade = cols ? cols.shade : variant ? [96, 44, 70] : [120, 112, 128], core = cols ? cols.core : variant ? [150, 70, 96] : [196, 170, 160];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const de = dens(x, y), a = U.clamp((de - 0.42) / 0.22, 0, 1);
      if (a <= 0) continue;
      const l = U.clamp(0.5 + (de - dens(x + 4, y - 4)) * 6, 0, 1); // brighter on the sun-facing rims
      const k = (y * W + x) * 4;
      const base = [0, 1, 2].map((i) => U.lerp(shade[i], core[i], a));
      d[k] = U.lerp(base[0], lit[0], l); d[k + 1] = U.lerp(base[1], lit[1], l); d[k + 2] = U.lerp(base[2], lit[2], l);
      d[k + 3] = a * 210;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  /* =========================== BACKGROUND RENDERER =========================== */
  const sk0 = () => (BG.def && BG.def.sky) || {};
  const BG = G.BG = {
    layers: [], ground: null, dust: [], clouds: [],
    init() {
      this.texCanvas = makeTexture();
      // soft out-of-focus disc for foreground bokeh
      const bk = document.createElement('canvas'); bk.width = bk.height = 128;
      const bg = bk.getContext('2d'), rg = bg.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, 'rgba(255,255,255,0.35)'); rg.addColorStop(0.72, 'rgba(255,255,255,0.5)'); rg.addColorStop(0.86, 'rgba(255,255,255,0.65)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      bg.fillStyle = rg; bg.fillRect(0, 0, 128, 128); this.bokehImg = bk;
      const rb = U.mulberry32(8);
      this.bokeh = Array.from({ length: 14 }, () => ({ x: rb(), y: rb(), r: 0.02 + rb() * 0.05, a: 0.04 + rb() * 0.08, p: rb() * 10, warm: rb() < 0.7 }));
      this.ash = Array.from({ length: 40 }, () => ({ x: rb(), y: rb(), s: 0.6 + rb() * 1.6, p: rb() * 10, z: 0.6 + rb() * 0.9 }));
      this.layers = [genFar(), genMid(), genNear()];
      this.ground = genGround();
      const rng = U.mulberry32(55);
      this.dust = Array.from({ length: 140 }, () => ({ x: rng(), y: rng(), z: 0.2 + rng() * 1.4, s: 0.5 + rng() * 1.8, p: rng() * 10 }));
      this.clouds = Array.from({ length: 9 }, () => ({ x: rng() * 3000, y: 0.12 + rng() * 0.28, w: 400 + rng() * 900, h: 14 + rng() * 30, a: 0.1 + rng() * 0.2 }));
      // grain texture
      const gc = document.createElement('canvas'); gc.width = gc.height = 256;
      const gx = gc.getContext('2d'); const id = gx.createImageData(256, 256);
      for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      gx.putImageData(id, 0, 0); this.grain = gc;
    },
    setScale(S) { this.lastS = S; for (const l of this.layers) l.setScale(S); this.ground.setScale(S); },
    // swap every art layer for a chapter (its own generators, or the chapter-1 painters recoloured by its palette)
    rebuild(def) {
      for (const l of this.layers) l.flush(); if (this.ground) this.ground.flush();
      this.def = def; this.cloudTex = null;
      const bg = (def && def.bg) || {};
      const mk = (key, fallback, params) => {
        if (!bg[key]) return fallback();
        const p = Object.assign({}, params, bg.params && bg.params[key]);
        return new TiledLayer(key, p.f, p.fy, p.baseY, p.res, bg[key](WK) || []);
      };
      if (def && def.defaultBg) this.layers = [genFar(), genMid(), genNear()];
      else this.layers = [
        mk('far', genFar, { f: 0.08, fy: 0.03, baseY: 60, res: 0.55 }),
        mk('mid', genMid, { f: 0.22, fy: 0.1, baseY: 80, res: 0.7 }),
        mk('near', genNear, { f: 0.45, fy: 0.25, baseY: 110, res: 0.85 }),
      ];
      this.ground = genGround(def);
      if (this.lastS) this.setScale(this.lastS);
    },
    // drop every cached tile (quality change / lost GPU context)
    flush() { for (const l of this.layers) l.flush(); this.ground.flush(); if (this.bc) { this.bc.width = 0; this.bc = null; } },
    drawSky(ctx, cam, W, H, S, time) {
      const H2 = this.def && this.def.hooks && this.def.hooks.drawSky;
      if (H2 && H2(ctx, cam, W, H, S, time, WK) === true) return;
      this.drawSkyDefault(ctx, cam, W, H, S, time);
    },
    drawSkyDefault(ctx, cam, W, H, S, time) {
      const t = L.tintAt(cam.x), sky = (this.def && this.def.sky) || {};
      const horizonY = H / 2 + (60 - cam.y * 0.03) * S;
      const gr = ctx.createLinearGradient(0, 0, 0, horizonY + 40 * S);
      gr.addColorStop(0, P('skyTop', t)); gr.addColorStop(0.45, P('skyMid', t)); gr.addColorStop(0.82, P('skyLow', t)); gr.addColorStop(1, P('horizon', t));
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      // sun
      const sx = W * (sky.sunX ?? 0.72) - cam.x * 0.01 * S, sy = horizonY - (sky.sunY ?? 150) * S;
      if (sky.sun === false) { this.skyEnd(ctx, cam, W, H, S, time, t, sky); return; }
      ctx.globalCompositeOperation = 'lighter';
      const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 520 * S);
      sun.addColorStop(0, U.rgba(sky.sunCore || '#fff4dc', 0.95)); sun.addColorStop(0.04, U.rgba(sky.sunGlow || '#ffe2b0', 0.75)); sun.addColorStop(0.12, U.rgba(P('horizon', t), 0.28)); sun.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
      // god rays
      ctx.save(); ctx.translate(sx, sy);
      for (let i = 0; i < 12; i++) {
        const a = i * 0.52 + Math.sin(time * 0.05 + i) * 0.04 + 0.4;
        const len = (900 + 300 * Math.sin(i * 7.3)) * S, wdt = 0.035 + 0.02 * Math.sin(i * 3.1);
        ctx.fillStyle = U.rgba(sky.rayCol || '#ffe6c0', (0.035 + 0.02 * Math.sin(time * 0.3 + i)) * (sky.rays ?? 1));
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - wdt) * len, Math.sin(a - wdt) * len); ctx.lineTo(Math.cos(a + wdt) * len, Math.sin(a + wdt) * len); ctx.fill();
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
      this.skyEnd(ctx, cam, W, H, S, time, t, sky);
    },
    skyEnd(ctx, cam, W, H, S, time, t, sky) {
      // volumetric cloud banks (two parallax decks, dusk and crimson bakes blended by zone)
      if (sky.clouds === false) { ctx.globalAlpha = 1; return; }
      if (!this.cloudTex) this.cloudTex = sky.clouds ? [makeClouds(0, 11, sky.clouds[0]), makeClouds(1, 23, sky.clouds[1] || sky.clouds[0])] : [makeClouds(0, 11), makeClouds(1, 23)];
      const decks = [[0.012, 4, H * 0.06, 1.25, 0.85], [0.03, 9, H * 0.2, 0.95, 0.7]];
      for (const [par, drift, top, sc, al] of decks) {
        for (let v = 0; v < 2; v++) {
          const img = this.cloudTex[v], a = (v === 0 ? 1 - t : t) * al;
          if (a < 0.02) continue;
          const w = img.width * sc * S * 0.75, h = img.height * sc * S * 0.75;
          let x0 = -(((cam.x * par + time * drift) * S) % w); if (x0 > 0) x0 -= w;
          ctx.globalAlpha = a;
          for (let x = x0; x < W; x += w) ctx.drawImage(img, x, top, w + 1, h);
        }
      }
      ctx.globalAlpha = 1;
      // orbital ark glint (Cantata) high in sky
      if (sky.ark === false) return;
      const ax = W * 0.18 - cam.x * 0.004 * S, ay = H * 0.12;
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(ax, ay, 26 * S, 1.5 * S); ctx.fillRect(ax + 10 * S, ay - 3 * S, 6 * S, 7 * S);
    },
    drawLayers(ctx, cam, W, H, S, time) {
      const sky = (this.def && this.def.sky) || {};
      for (const l of this.layers) {
        const Sl = S / cam.zoom * (1 + (cam.zoom - 1) * l.f);
        l.draw(ctx, cam.x, cam.y, W, H, Sl);
        if (l.key === 'mid' && sky.shafts !== false) this.drawShafts(ctx, cam, W, H, S, time);
        const AH = this.def && this.def.hooks && this.def.hooks.afterLayer;
        if (AH) AH(l.key, ctx, cam, W, H, S, time, WK);
        // atmospheric haze between layers
        const t = L.tintAt(cam.x);
        const hz = ctx.createLinearGradient(0, H * 0.35, 0, H);
        hz.addColorStop(0, U.rgba(P('fog', t), 0)); hz.addColorStop(1, U.rgba(P('fog', t), l.key === 'far' ? 0.14 : l.key === 'mid' ? 0.09 : 0.04));
        ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H);
      }
    },
    // volumetric light shafts raking down from the sun through the ruins
    drawShafts(ctx, cam, W, H, S, time) {
      const t = L.tintAt(cam.x);
      const horizonY = H / 2 + (60 - cam.y * 0.03) * S;
      const sx = W * (sk0().sunX ?? 0.72) - cam.x * 0.01 * S, sy = horizonY - (sk0().sunY ?? 150) * S;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const sk = (this.def && this.def.sky) || {}, col = sk.shaftCol || (t > 0.7 ? '255,140,150' : '255,214,160');
      for (let i = 0; i < 7; i++) {
        const a = 1.95 + i * 0.13 + Math.sin(time * 0.07 + i * 1.7) * 0.03;
        const len = Math.hypot(W, H) * 1.2, wd = (0.018 + 0.014 * Math.sin(i * 2.3 + 1)) * (1 + 0.15 * Math.sin(time * 0.4 + i));
        const ex = sx + Math.cos(a) * len, ey = sy + Math.sin(a) * len;
        const gr = ctx.createLinearGradient(sx, sy, ex, ey);
        const al = 0.05 + 0.03 * Math.sin(time * 0.25 + i * 2.1);
        gr.addColorStop(0, `rgba(${col},${al * 1.6})`); gr.addColorStop(0.45, `rgba(${col},${al})`); gr.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a - wd) * len, sy + Math.sin(a - wd) * len);
        ctx.lineTo(sx + Math.cos(a + wd) * len, sy + Math.sin(a + wd) * len); ctx.closePath(); ctx.fill();
      }
      // anamorphic streak through the sun
      const st = ctx.createLinearGradient(sx - W * 0.5, 0, sx + W * 0.5, 0);
      st.addColorStop(0, 'rgba(255,220,180,0)'); st.addColorStop(0.5, 'rgba(255,236,210,0.22)'); st.addColorStop(1, 'rgba(255,220,180,0)');
      ctx.fillStyle = st; ctx.fillRect(sx - W * 0.5, sy - 1.5 * S, W, 3 * S);
      ctx.restore();
    },
    prewarm(cam, W, H, S, dir) {
      for (const l of this.layers) l.prewarm(cam.x, cam.y, W, H, S, dir);
      this.ground.prewarm(cam.x, cam.y, W, H, S, dir);
    },
    drawGround(ctx, cam, W, H, S) { this.ground.draw(ctx, cam.x, cam.y, W, H, S); },
    drawDust(ctx, cam, W, H, S, time) {
      const AT = this.def && this.def.hooks && this.def.hooks.drawAtmos;
      if (AT && AT(ctx, cam, W, H, S, time, WK) === true) return;
      const t = L.tintAt(cam.x);
      ctx.globalCompositeOperation = 'lighter';
      const LQ = G.Quality.low;
      for (const d of LQ ? this.dust.slice(0, 50) : this.dust) {
        const px = ((d.x * W * 1.5 - cam.x * d.z * S * 0.6 + time * 14 * d.z * S) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.25;
        const py = ((d.y * H + Math.sin(time * 0.6 + d.p) * 18 * S - cam.y * d.z * S * 0.3 + time * 6 * d.z) % H + H) % H;
        const a = 0.25 + 0.25 * Math.sin(time * 1.3 + d.p);
        ctx.fillStyle = U.rgba(t > 0.7 ? '#ffb0b8' : '#ffe2b8', a * (d.z > 1 ? 0.6 : 0.4));
        const r = d.s * S * d.z;
        ctx.fillRect(px, py, r, r);
      }
      // out-of-focus light discs drifting close to the lens
      for (const b of LQ ? this.bokeh.slice(0, 5) : this.bokeh) {
        const px = ((b.x * W * 1.4 - cam.x * S * 1.6 + time * 8 * S) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
        const py = b.y * H + Math.sin(time * 0.3 + b.p) * 20 * S;
        const r = b.r * H * (1 + 0.1 * Math.sin(time * 0.7 + b.p));
        ctx.globalAlpha = b.a * (0.7 + 0.3 * Math.sin(time * 0.5 + b.p));
        ctx.filter = 'none';
        ctx.drawImage(this.bokehImg, px - r, py - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      // falling ash flakes
      ctx.fillStyle = t > 0.7 ? 'rgba(40,20,30,0.55)' : 'rgba(60,52,50,0.5)';
      for (const a of LQ ? this.ash.slice(0, 14) : this.ash) {
        const px = ((a.x * W - cam.x * a.z * S * 0.9 + Math.sin(time * 0.9 + a.p) * 30 * S - time * 20 * S) % W + W) % W;
        const py = ((a.y * H + time * 26 * a.z * S - cam.y * a.z * S * 0.5) % H + H) % H;
        const s = a.s * S * a.z;
        ctx.save(); ctx.translate(px, py); ctx.rotate(time * 2 + a.p); ctx.fillRect(-s, -s * 0.4, s * 2, s * 0.8); ctx.restore();
      }
    },
    // bloom: bright-pass + blur on a quarter-res copy, screened back over the frame
    bloom(ctx, src, W, H, strength = 0.38) {
      if (G.Quality.low) return; // the quarter-res filtered copy is the most expensive pass on weak GPUs
      const w = Math.max(1, Math.ceil(W / 4)), h = Math.max(1, Math.ceil(H / 4));
      if (!this.bc) { this.bc = document.createElement('canvas'); this.bx = this.bc.getContext('2d'); this.canFilter = 'filter' in this.bx; }
      if (this.bc.width !== w || this.bc.height !== h) { this.bc.width = w; this.bc.height = h; }
      const b = this.bx;
      b.globalCompositeOperation = 'copy'; b.globalAlpha = 1;
      if (this.canFilter) {
        // a high threshold: only real highlights (blade, sparks, sun) bloom — a bright sky must not wash the fighters out
        b.filter = 'brightness(0.78) contrast(3.4) saturate(1.3) blur(5px)';
        b.drawImage(src, 0, 0, w, h);
        b.filter = 'none';
      } else {
        b.drawImage(src, 0, 0, w, h);
        b.globalCompositeOperation = 'multiply'; b.drawImage(this.bc, 0, 0); b.drawImage(this.bc, 0, 0);
      }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = strength * 0.7;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.bc, 0, 0, W, H);
      ctx.restore();
    },
    drawPost(ctx, W, H, S, time, opts) {
      const t = opts.tint;
      // bottom fog
      const fg = ctx.createLinearGradient(0, H * 0.7, 0, H);
      fg.addColorStop(0, U.rgba(P('fog', t), 0)); fg.addColorStop(1, U.rgba(P('fog', t), 0.14));
      ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
      // grade: warm highlights / teal shadows
      ctx.globalCompositeOperation = 'soft-light';
      const cg = ctx.createLinearGradient(0, 0, W, H);
      cg.addColorStop(0, t > 0.7 ? 'rgba(120,40,90,0.35)' : 'rgba(40,90,110,0.35)'); cg.addColorStop(1, t > 0.7 ? 'rgba(255,120,90,0.3)' : 'rgba(255,170,90,0.3)');
      ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      // painted look: punchier saturation and contrast (one filtered self-copy; skipped on low quality)
      if (!G.Quality.low && 'filter' in ctx) {
        ctx.save(); ctx.filter = 'saturate(1.28) contrast(1.1)'; ctx.globalCompositeOperation = 'copy';
        ctx.drawImage(ctx.canvas, 0, 0); ctx.restore();
      }
      // vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(5,4,8,${0.55 + (opts.lowHp || 0) * 0.25})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      if (opts.lowHp) {
        const lg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
        lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, `rgba(160,10,40,${opts.lowHp * (0.25 + 0.12 * Math.sin(time * 5))})`);
        ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
      }
      // grain
      if (this.grain) {
        ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'overlay';
        const ox = Math.floor(Math.random() * 256), oy = Math.floor(Math.random() * 256);
        const pat = ctx.createPattern(this.grain, 'repeat');
        ctx.save(); ctx.translate(-ox, -oy); ctx.fillStyle = pat; ctx.fillRect(ox, oy, W, H); ctx.restore();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    },
  };

  /* painters + layer class for chapter art (docs/CHAPTER_API.md) */
  const WK = G.WorldKit = { U, TILE, TiledLayer, makeTexture, makeClouds, jaggedTop, building, crystal, cables, vines, gothicSpire, ruinTower, P, PAL, L, genFar, genMid, genNear, get BG() { return BG; } };
})(window.G);

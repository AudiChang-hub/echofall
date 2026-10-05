'use strict';
/* ECHOFALL — Chapter V 無重之塔 THE UNMOORED SPIRE (world author: level, look, music, story).
   The Ladder's upper reach above the clouds: enamel waystations, derelict cargo cars, the aurora gap (cable-car
   set piece), the storm ring and the deck where Descent V cut its mooring. Gravity 0.62 (floaty, higher jumps).
   Foes / elite live in ch5_foes.js, the boss in ch5_boss.js — referenced here by id. See docs/CHAPTER_API.md. */
(function (G) {
  const WK = G.WorldKit, U = G.U, PI = Math.PI, TAU = PI * 2;
  const L = G.LEVEL, INK = '#0b0612';
  const rgba = U.rgba, mixH = U.mixHex, clamp = U.clamp, lerp = U.lerp;
  const P = (k, t) => WK.P(k, clamp(t, 0, 1));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* =========================================================================================
     LEVEL GEOMETRY
     ========================================================================================= */
  const GD = { a: 7105, b: 8655, w: 240, y: -140 };            // cable car: parked left edge at dock A / dock B
  const CAB = { ca: GD.a + GD.w / 2, cb: GD.b + GD.w / 2 };     // car centre at each station
  const cableY = (cx) => -430 + 60 * Math.sin(PI * clamp((cx - CAB.ca) / (CAB.cb - CAB.ca), 0, 1));
  const ARENA = { e4: [5700, 6500], e6: [9600, 10400], elite: [10650, 11650], boss: [12150, 13550] };

  const tintAt = (x) => {
    if (x < 2400) return 0;
    if (x < 6400) return 0.25 * (x - 2400) / 4000;
    if (x < 8900) return 0.25 + 0.25 * (x - 6400) / 2500;
    if (x < 11900) return 0.5 + 0.18 * (x - 8900) / 3000;
    return 0.68 + 0.32 * sstep(11900, 12500, x);
  };
  const stormAt = (x) => sstep(8600, 9400, x);
  const gapAt = (x) => sstep(6700, 7300, x) * (1 - sstep(8700, 9200, x));

  const gondSolid = { x: GD.a, y: GD.y, w: GD.w, h: 22, kind: 'invisible' };

  const level = {
    start: { x: 160, y: 0 }, bounds: [-400, 13600], gravity: 0.62,
    solids: [
      { x: -820, y: -2600, w: 440, h: 2700, kind: 'wall' },
      { x: -820, y: 0, w: 3220, h: 700, kind: 'c5deck' },
      { x: 2400, y: -140, w: 4700, h: 840, kind: 'c5deck' },
      { x: 3450, y: -290, w: 260, h: 150, kind: 'c5cargo', style: 0 },
      { x: 4000, y: -320, w: 300, h: 180, kind: 'c5cargo', style: 1 },
      { x: 5150, y: -300, w: 260, h: 160, kind: 'c5cargo', style: 2 },
      { x: 5190, y: -440, w: 180, h: 140, kind: 'c5cargo', style: 3 },
      { x: 7100, y: 320, w: 1800, h: 380, kind: 'c5under' },
      { x: 8840, y: 90, w: 60, h: 610, kind: 'c5pier' },
      { x: 8900, y: -140, w: 600, h: 840, kind: 'c5deck' },
      { x: 9500, y: 0, w: 4500, h: 700, kind: 'c5deck' },
      { x: 13600, y: -2600, w: 400, h: 2700, kind: 'wall' },
      gondSolid,
    ],
    oneways: [
      { x: 560, y: -220, w: 190 },                                              // signal perch (first note)
      { x: 4330, y: -560, w: 200 }, { x: 4640, y: -600, w: 220 }, { x: 4960, y: -640, w: 170 },   // upper rail-walk
      { x: 5250, y: -760, w: 170 }, { x: 5390, y: -1060, w: 270, cab: true },  // crane tower (secret)
      { x: 7380, y: 80, w: 150 }, { x: 8480, y: 90, w: 150 },                   // underdeck climb-outs
      { x: 9900, y: -230, w: 240 },                                             // storm-ring catwalk
    ],
    pylons: [
      { id: 'c5_p1', x: 1950, y: 0, name: '第九中繼站共鳴碑', dialog: 'c5_pylon1', flag: 'c5_pylon1_seen' },
      { id: 'c5_p2', x: 6650, y: -140, name: '斷口纜車站共鳴碑', dialog: 'c5_pylon2', flag: 'c5_pylon2_seen' },
      { id: 'c5_p3', x: 11880, y: 0, name: '斷錨甲板共鳴碑', dialog: 'c5_pylon3', flag: 'c5_pylon3_seen' },
    ],
    notes: [
      { id: 'c5_n1', x: 650, y: -220 },
      { id: 'c5_n2', x: 4150, y: -320, flag: 'c5_read_manifest' },
      { id: 'c5_n3', x: 5600, y: -1060, flag: 'c5_read_crayon' },
      { id: 'c5_n4', x: 8000, y: 320 },
      { id: 'c5_n5', x: 9380, y: -140, flag: 'c5_read_idris' },
      { id: 'c5_n6', x: 11740, y: 0 },
    ],
    items: [
      { id: 'c5_ribbon', x: 5470, y: -1060, flag: 'c5_got_ribbon', name: '紅色布條', kind: 'key', sfx: 'pickup',
        onTake(game) { game.bark(game.save.flags.c5_met_dingding ? 'c5_ribbonMet' : 'c5_ribbon'); } },
    ],
    npcs: [],   // filled below (Dingding needs the painter)
    triggers: [
      { id: 'c5_t_grav', x: 300, kind: 'hint', hint: 'c5_lowgrav' },
      { id: 'c5_t_void', x: 850, kind: 'dialog', dialog: 'c5_voidling' },
      { id: 'c5_t_gallery', x: 2450, kind: 'dialog', dialog: 'c5_gallery' },
      { id: 'c5_t_breach', x: 3150, kind: 'dialog', dialog: 'c5_breacher' },
      { id: 'c5_t_drift', x: 4380, kind: 'dialog', dialog: 'c5_driftwatch' },
      { id: 'c5_t_secret', x: 5000, kind: 'hint', hint: 'c5_secret' },
      { id: 'c5_t_crane', x: 5300, kind: 'dialog', dialog: 'c5_crane', yMax: -900 },
      { id: 'c5_t_gap', x: 6720, kind: 'dialog', dialog: 'c5_gap', after: 'c5_gondola', focus: { x: 7950, y: -330, zoom: 0.72 } },
      { id: 'c5_t_storm', x: 8900, kind: 'dialog', dialog: 'c5_storm' },
      { id: 'c5_t_elite', x: ARENA.elite[0] - 200, kind: 'dialog', dialog: 'c5_eliteIntro', enc: 'c5_elite', startEnc: 'c5_elite', flag: 'c5_elite_seen',
        focus: { x: ARENA.elite[0] + 600, y: -170, zoom: 0.95 } },
      { id: 'c5_t_boss', x: ARENA.boss[0] - 200, kind: 'dialog', dialog: 'c5_bossIntro', enc: 'c5_boss', startEnc: 'c5_boss', flag: 'c5_boss_seen',
        focus: { x: ARENA.boss[0] + 800, y: -170, zoom: 0.95 }, music: 'c5_boss' },
    ],
    encounters: {
      c5_e1: { trigger: 1100, respawn: true, waves: [[{ t: 'c5_voidling', x: 1450 }, { t: 'c5_voidling', x: 1640 }]] },
      c5_e2: { trigger: 3300, respawn: true, waves: [[{ t: 'c5_breacher', x: 3850 }, { t: 'c5_mender', x: 3580 }]] },
      c5_e3: { trigger: 4500, respawn: true, waves: [[{ t: 'c5_driftwatch', x: 4850, y: -300 }, { t: 'c5_driftwatch', x: 5080, y: -260 }, { t: 'c5_voidling', x: 4950 }]] },
      c5_e4: {
        trigger: 5800, arena: ARENA.e4,
        waves: [
          [{ t: 'c5_breacher', x: 6250 }, { t: 'c5_voidling', x: 6050 }],
          [{ t: 'c5_driftwatch', x: 6150, y: -300 }, { t: 'c5_mender', x: 6380 }, { t: 'c5_voidling', x: 5900 }],
        ],
      },
      c5_e5u: { trigger: 7700, yMin: 200, respawn: true, waves: [[{ t: 'c5_voidling', x: 8000 }, { t: 'c5_mender', x: 8250 }]] },
      c5_e5: { trigger: 8950, respawn: true, waves: [[{ t: 'c5_driftwatch', x: 9250, y: -300 }, { t: 'c5_driftwatch', x: 9420, y: -260 }, { t: 'c5_breacher', x: 9380 }]] },
      c5_e6: {
        trigger: 9700, arena: ARENA.e6,
        waves: [
          [{ t: 'c5_breacher', x: 10100 }, { t: 'c5_voidling', x: 10250 }],
          [{ t: 'c5_mender', x: 9800 }, { t: 'c5_driftwatch', x: 10150, y: -300 }, { t: 'c5_voidling', x: 10300 }, { t: 'c5_voidling', x: 9750 }],
        ],
      },
      c5_elite: { manual: true, elite: true, arena: ARENA.elite, waves: [[{ t: 'c5_elite', x: ARENA.elite[0] + 700 }]] },
      c5_boss: { manual: true, boss: true, arena: ARENA.boss, waves: [[{ t: 'c5_boss', x: ARENA.boss[0] + 950 }]] },
    },
    zones: [
      { x: -1e9, name: '第九中繼站', en: 'WAYSTATION NINE', tint: 0, music: 'c5_explore', amb: 'c5_high' },
      { x: 2400, name: '貨運懸廊', en: 'THE CARGO GALLERY', tint: 0.15, music: 'c5_explore', amb: 'c5_gallery' },
      { x: 6550, name: '極光斷口', en: 'THE AURORA GAP', tint: 0.3, music: 'c5_explore2', amb: 'c5_high' },
      { x: 8900, name: '上環風暴層', en: 'THE STORM RING', tint: 0.55, music: 'c5_explore2', amb: 'c5_storm' },
      { x: 11900, name: '斷錨甲板', en: 'THE UNMOORED DECK', tint: 1, music: 'c5_explore2', amb: 'c5_deck' },
    ],
    tintAt,
  };

  /* =========================================================================================
     PALETTE  (tint 0 = night-blue waystation under green aurora · tint 1 = violet storm ring)
     ========================================================================================= */
  const pal = {
    skyTop: ['#040817', '#07041a'], skyMid: ['#0c1d45', '#1a1042'], skyLow: ['#16426a', '#3a1f66'], horizon: ['#57d8c0', '#b062e0'],
    far: ['#2c4c7a', '#3d2c6a'], mid: ['#1e3660', '#2a1d52'], midDark: ['#101f3e', '#170f34'],
    near: ['#152443', '#1b1236'], nearDark: ['#0a1228', '#0d081e'], rim: ['#9ff5df', '#e3a8ff'],
    ground: ['#c3cde2', '#a7a3c9'], groundDark: ['#1a2440', '#1a1236'], groundTop: ['#f4f8ff', '#efe2ff'],
    fog: ['#3f84a8', '#6a4aa0'],
  };

  // fixed material colours (Hades-like: hard cel tones, purple-leaning shadow, mint/lilac rim from the aurora)
  const M = {
    enamel: '#e6ecf6', enamelL: '#ffffff', enamelS: '#8d97bd', enamelD: '#4a4f7e',
    steel: '#2a3456', steelL: '#5b6c9a', steelD: '#141a33', steelDD: '#0c1124',
    amber: '#ffb85c', amberL: '#ffe2a6', red: '#ff4d5e', hazard: '#f2c14e', cyan: '#7ff4ff', hush: '#ff4fa0',
    rust: '#b5643a', teal: '#2f8f8c', crate: '#c2543a',
  };

  /* =========================================================================================
     SMALL PAINTER KIT
     ========================================================================================= */
  const ink = (g, w = 2) => { g.strokeStyle = INK; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
  const poly = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
  const rect = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // inked rectangle with cel faces: lit top strip, shadow bottom/left strip
  function block(g, x, y, w, h, C, o = {}) {
    rect(g, x - 1.5, y - 1.5, w + 3, h + 3, INK);
    rect(g, x, y, w, h, C.body);
    const t = o.top ?? Math.min(4, h * 0.2);
    rect(g, x, y, w, t, C.lit);
    rect(g, x, y + h - Math.min(5, h * 0.25), w, Math.min(5, h * 0.25), C.dark);
    if (o.side !== false) rect(g, x, y, Math.min(5, w * 0.22), h, C.dark);
  }
  // split a long band into world-aligned clipped chunks so tiles only replay what they show
  function chunks(x0, x1, step, y, h, fn) {
    const out = [];
    for (let a = x0; a < x1; a += step) {
      const b = Math.min(x1, a + step), aa = a;
      out.push({ x: aa, y, w: b - aa, h, draw(g) { g.beginPath(); g.rect(aa, y - 10, b - aa, h + 20); g.clip(); fn(g, aa, b); } });
    }
    return out;
  }
  // vertical lattice tower (two chords, X-bracing), inked
  function lattice(g, x, yTop, yBot, w, C, o = {}) {
    const n = Math.max(1, Math.round((yBot - yTop) / (w * 1.15))), seg = (yBot - yTop) / n;
    const bw = o.brace || Math.max(0.9, w * 0.06);
    const path = () => {
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const y0 = yTop + i * seg, y1 = y0 + seg;
        g.moveTo(x, y0); g.lineTo(x + w, y1); g.moveTo(x + w, y0); g.lineTo(x, y1); g.moveTo(x, y0); g.lineTo(x + w, y0);
      }
    };
    const ik = C.ink || INK, iw = o.inkW ?? 1.6;
    path(); g.strokeStyle = ik; g.lineWidth = bw + iw; g.lineCap = 'butt'; g.stroke();
    path(); g.strokeStyle = C.dark; g.lineWidth = bw; g.stroke();
    const cw = o.chord || Math.max(2, w * 0.14);
    rect(g, x - cw / 2 - iw * 0.75, yTop, cw + iw * 1.5, yBot - yTop, ik); rect(g, x + w - cw / 2 - iw * 0.75, yTop, cw + iw * 1.5, yBot - yTop, ik);
    rect(g, x - cw / 2, yTop, cw, yBot - yTop, C.dark);
    rect(g, x + w - cw / 2, yTop, cw, yBot - yTop, C.body);
    rect(g, x + w + cw / 2 - Math.max(0.8, cw * 0.32), yTop, Math.max(0.8, cw * 0.32), yBot - yTop, C.lit);
  }
  // horizontal I-beam with lightening holes and rivets
  function girder(g, x0, x1, y, h, C, o = {}) {
    rect(g, x0 - 1.5, y - 1.5, x1 - x0 + 3, h + 3, INK);
    rect(g, x0, y, x1 - x0, h, C.body);
    const fl = Math.max(1.5, h * 0.2);
    rect(g, x0, y, x1 - x0, fl, C.lit);
    rect(g, x0, y + h - fl, x1 - x0, fl, C.dark);
    if (o.holes !== false && h > 10) {
      g.fillStyle = C.hole || C.dark;
      for (let xx = x0 + h * 1.1; xx < x1 - h * 0.8; xx += h * 1.7) { g.beginPath(); g.ellipse(xx, y + h / 2, h * 0.42, h * 0.24, 0, 0, TAU); g.fill(); }
    }
    if (o.rivets !== false && h > 7) {
      g.fillStyle = C.lit;
      for (let xx = x0 + 4; xx < x1 - 2; xx += Math.max(7, h * 0.55)) { g.fillRect(xx, y + fl * 0.4, 1.2, 1.2); g.fillRect(xx, y + h - fl * 0.7, 1.2, 1.2); }
    }
  }
  // scalloped, cel-shaded cloud band (ink first, fills cover the inner strokes → only the outer contour remains)
  function makePuffs(seed, x0, x1, top, amp, rMin, rMax) {
    const rng = U.mulberry32(seed), out = []; let x = x0;
    while (x < x1) {
      const r = rMin + rng() * (rMax - rMin);
      const y = top - amp * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(x * 0.0021 + seed))) * (0.4 + 0.6 * rng());
      out.push({ x: x + r * 0.7, y: y + r * 0.55, r });
      x += r * (0.9 + rng() * 0.6);
    }
    return out;
  }
  function cloudBand(g, puffs, a, b, deep, C, inkW = 2) {
    const rMax = 260, vis = puffs.filter((p) => p.x + p.r > a - rMax && p.x - p.r < b + rMax);
    if (!vis.length) return;
    let base = -1e9; for (const p of vis) base = Math.max(base, p.y);
    const shape = () => { g.beginPath(); for (const p of vis) { g.moveTo(p.x + p.r, p.y); g.arc(p.x, p.y, p.r, 0, TAU); } g.rect(a - rMax, base, b - a + rMax * 2, deep - base); };
    shape(); g.strokeStyle = C.ink || INK; g.lineWidth = inkW * 2; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = C.shade; g.fill();
    g.save(); shape(); g.clip();
    g.fillStyle = C.body; g.beginPath();
    for (const p of vis) { g.moveTo(p.x + p.r * 0.86 + p.r * 0.1, p.y - p.r * 0.12); g.arc(p.x + p.r * 0.1, p.y - p.r * 0.12, p.r * 0.86, 0, TAU); }
    g.fill();
    g.fillStyle = C.lit; g.beginPath();
    for (const p of vis) { g.moveTo(p.x + p.r * 0.68 + p.r * 0.24, p.y - p.r * 0.34); g.arc(p.x + p.r * 0.24, p.y - p.r * 0.34, p.r * 0.68, 0, TAU); }
    g.fill();
    // underside shadow band (clouds sit on a darker bed)
    const sg = g.createLinearGradient(0, base - 30, 0, base + 120);
    sg.addColorStop(0, rgba(C.bed || C.shade, 0)); sg.addColorStop(1, rgba(C.bed || C.shade, 0.85));
    g.fillStyle = sg; g.fillRect(a - rMax, base - 30, b - a + rMax * 2, deep - base + 30);
    g.restore();
  }
  // inked, cel-shaded stacked cumulus tower (storm towers far away)
  function cloudTower(g, rng, x, base, w, h, C, anvil) {
    const puffs = [];
    // enough lobes that neighbours overlap (≈0.6 r apart): a solid billowing mass, not a string of beads
    const n = clamp(Math.ceil(h / (w * 0.2)) + 2, 6, 18);
    for (let i = 0; i < n; i++) {
      // a column that leans downwind and narrows towards the top, cauliflower lobes along both flanks
      // cumulus narrow towards the top; a thunderhead swells up into its anvil (no mushroom stalk)
      const u = i / (n - 1), r = w * ((anvil ? 0.25 + 0.13 * u : 0.36 - 0.17 * u) + rng() * 0.06), cx = x + u * w * 0.35 + (rng() - 0.5) * w * 0.14;
      puffs.push({ x: cx, y: base - u * h, r });
      for (const s of [-1, 1]) if (rng() < 0.7) { const rr = r * (0.5 + rng() * 0.25); puffs.push({ x: cx + s * r * (0.72 + rng() * 0.2), y: base - u * h + r * (0.15 + rng() * 0.25), r: rr }); }
    }
    if (anvil) { const ty = base - h * 1.02; for (let k = -4; k <= 5; k++) { const e = Math.abs(k - 0.5) / 4.5; puffs.push({ x: x + w * 0.35 + k * w * 0.21, y: ty + e * e * w * 0.16 + rng() * 5, r: w * (0.24 - 0.08 * e + rng() * 0.05) }); } }
    const shape = () => { g.beginPath(); for (const p of puffs) { g.moveTo(p.x + p.r, p.y); g.arc(p.x, p.y, p.r, 0, TAU); } g.rect(x - w * 0.6, base, w * 1.2, 400); };
    shape(); g.strokeStyle = C.ink; g.lineWidth = 3; g.stroke(); g.fillStyle = C.shade; g.fill();
    g.save(); shape(); g.clip();
    g.fillStyle = C.body; g.beginPath(); for (const p of puffs) { g.moveTo(p.x + p.r * 0.86 + p.r * 0.14, p.y - p.r * 0.12); g.arc(p.x + p.r * 0.14, p.y - p.r * 0.12, p.r * 0.86, 0, TAU); } g.fill();
    g.fillStyle = C.lit; g.beginPath(); for (const p of puffs) { g.moveTo(p.x + p.r * 0.58 + p.r * 0.34, p.y - p.r * 0.38); g.arc(p.x + p.r * 0.34, p.y - p.r * 0.38, p.r * 0.58, 0, TAU); } g.fill();
    g.restore();
  }
  function aviationLight(g, x, y, col, r = 3) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 6); gr.addColorStop(0, rgba(col, 0.55)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
    g.fillStyle = INK; g.beginPath(); g.arc(x, y, r + 1, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(x - r * 0.35, y - r * 0.5, r * 0.5, r * 0.5);
  }
  function stencil(g, txt, x, y, size, col, o = {}) {
    g.save(); g.font = `${o.weight || 900} ${size}px ${o.font || '"Noto Sans TC", sans-serif'}`; g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
    if (o.ink !== false) { g.lineWidth = Math.max(2, size * 0.16); g.strokeStyle = INK; g.lineJoin = 'round'; g.strokeText(txt, x, y); }
    g.fillStyle = col; g.fillText(txt, x, y); g.restore();
  }
  const layerC = (key, t, haze = 0) => {
    const body = mixH(P(key, t), P('fog', t), haze), dark = mixH(P(key === 'near' ? 'nearDark' : 'midDark', t), P('fog', t), haze * 0.7);
    return { body, dark, lit: mixH(body, P('rim', t), 0.5 - haze * 0.3), hole: mixH(dark, P('skyLow', t), 0.35), rim: P('rim', t) };
  };

  /* =========================================================================================
     PARALLAX LAYERS
     ========================================================================================= */
  const SPAN = [-400, 13600];
  const TETHER_FAR_X = 480;   // the Ladder itself, visible all chapter long (far layer, ≈ world 6000)

  function genFar() {
    const f = 0.08, x0 = -900, x1 = SPAN[1] * f + 1000, objs = [];
    const rng = U.mulberry32(5501);
    // distant storm towers / cumulus rising out of the cloud sea (aurora-lit rims)
    let x = x0;
    while (x < x1) {
      const wx = x / f, t = tintAt(wx), st = stormAt(wx);
      const w = 50 + rng() * 80, h = 70 + rng() * 120 + st * 90, r2 = rng() * 1e6, bx = x, anvil = st > 0.4 ? rng() < 0.7 : rng() < 0.25;
      const far = P('far', t), sky = P('skyMid', t), fog = P('fog', t);
      const C = { ink: rgba('#0b0612', 0.4), shade: mixH(far, sky, 0.62), body: mixH(mixH(far, fog, 0.3), sky, 0.35), lit: mixH(mixH(far, fog, 0.5), P('rim', t), 0.22) };
      if (Math.abs(bx - TETHER_FAR_X) > 140) objs.push({ x: bx - w * 1.6, y: 40 - h * 1.25 - w, w: w * 3.6, h: h * 1.3 + w + 400, draw(g) { cloudTower(g, U.mulberry32(r2 | 0), bx, 70, w, h, C, anvil); } });
      x += w * (2.2 + rng() * 3.2);
    }
    // the Ladder: a white enamel spine climbing out of the clouds into the stars
    const tx = TETHER_FAR_X;
    objs.push({ x: tx - 170, y: -900, w: 340, h: 1300, draw(g) {
      const t = tintAt(tx / f), rim = P('rim', t);
      const body = mixH(M.enamel, P('far', t), 0.42), dark = mixH(M.enamelD, P('far', t), 0.35), lit = mixH(M.enamelL, rim, 0.25);
      // counterweight sleeves + node rings
      const w0 = 26;
      rect(g, tx - w0 - 2, -900, w0 * 2 + 4, 1300, rgba(INK, 0.7));
      rect(g, tx - w0, -900, w0 * 2, 1300, body);
      rect(g, tx - w0, -900, w0 * 0.7, 1300, dark);
      rect(g, tx + w0 - 7, -900, 7, 1300, lit);
      // twin guide rails
      rect(g, tx - w0 - 14, -900, 5, 1300, dark); rect(g, tx + w0 + 9, -900, 5, 1300, body); rect(g, tx + w0 + 13, -900, 1.5, 1300, lit);
      for (let y = -880; y < 200; y += 46) {
        rect(g, tx - w0 - 6, y, w0 * 2 + 12, 5, rgba(INK, 0.6)); rect(g, tx - w0 - 5, y + 1, w0 * 2 + 10, 3, body); rect(g, tx + w0 - 4, y + 1, 9, 3, lit);
        if ((y / 46 | 0) % 3 === 0) { g.fillStyle = 'rgba(160,240,255,0.85)'; g.fillRect(tx - 2, y + 14, 4, 4); }
      }
      // waystation ring orbiting the spine (back half / spine / front half)
      const ring = (cy, rx, ry, th, front) => {
        g.beginPath(); g.ellipse(tx, cy, rx, ry, 0, front ? 0 : PI, front ? PI : TAU);
        g.strokeStyle = rgba(INK, 0.7); g.lineWidth = th + 3; g.stroke(); g.strokeStyle = front ? body : dark; g.lineWidth = th; g.stroke();
        if (front) { g.beginPath(); g.ellipse(tx, cy - th * 0.3, rx, ry, 0, 0.15, PI - 0.15); g.strokeStyle = lit; g.lineWidth = 1.5; g.stroke(); }
      };
      ring(-300, 150, 22, 9, false); ring(-300, 150, 22, 9, true);
      ring(-560, 96, 14, 6, false); ring(-560, 96, 14, 6, true);
      for (let k = 0; k < 9; k++) { const a = (k / 9) * PI; g.fillStyle = 'rgba(255,214,150,0.9)'; g.fillRect(tx + Math.cos(a) * 150 - 1, -300 + Math.sin(a) * 22 - 1, 2.5, 2.5); }
      // base anchor dissolving into the clouds
      const bg = g.createLinearGradient(0, 0, 0, 120); bg.addColorStop(0, rgba(P('fog', t), 0)); bg.addColorStop(1, rgba(P('fog', t), 0.85));
      g.fillStyle = bg; g.fillRect(tx - 60, 0, 120, 120);
    } });
    // cloud sea: the planet's cloud tops (seamless chunks)
    const puffs = makePuffs(77, x0 - 300, x1 + 300, 70, 26, 26, 64);
    objs.push(...chunks(x0, x1, 512, -40, 900, (g, a, b) => {
      const t = tintAt(((a + b) / 2) / f), far = P('far', t);
      cloudBand(g, puffs, a, b, 900, { ink: rgba('#0b0612', 0.5), shade: mixH(far, P('skyTop', t), 0.4), body: mixH(far, P('fog', t), 0.25), lit: mixH(P('fog', t), P('rim', t), 0.55), bed: P('skyTop', t) }, 1.2);
    }));
    return objs;
  }

  function genMid() {
    const f = 0.22, x0 = -800, x1 = SPAN[1] * f + 900, objs = [];
    const rng = U.mulberry32(6611);
    const wxOf = (lx) => lx / f;
    // generic lattice relay towers (skip the vista + landmark windows)
    const busy = [[100, 380], [840, 1110], [1400, 1990], [1980, 2620], [2700, 3000]];
    let x = x0;
    while (x < x1) {
      const wx = wxOf(x), t = tintAt(wx);
      const w = 20 + rng() * 22, top = -200 - rng() * 230, r2 = rng() * 1e6, bx = x;
      const blocked = busy.some(([a, b]) => bx > a - 40 && bx < b + 40);
      if (!blocked) objs.push({ x: bx - 90, y: top - 160, w: w + 180, h: 900, draw(g) {
        const rr = U.mulberry32(r2 | 0), C = layerC('mid', t, 0.5);
        C.ink = rgba(mixH(INK, P('midDark', t), 0.4), 0.75);
        lattice(g, bx, top, 60, w, C, { inkW: 1.1 });
        // service platforms + antennas + aviation lights
        const np = 1 + Math.floor(rr() * 2);
        for (let i = 0; i < np; i++) { const py = top + 40 + rr() * 160, pw = w + 26 + rr() * 30; girder(g, bx - (pw - w) / 2, bx + w + (pw - w) / 2, py, 6, C, { holes: false }); }
        lattice(g, bx + w * 0.3, top - 60 - rr() * 50, top, w * 0.4, C, { chord: 2, inkW: 1 });
        aviationLight(g, bx + w * 0.5, top - 64, rr() < 0.5 ? M.red : '#ffffff', 2.2);
        if (rr() < 0.5) { const dy = top + 26; g.fillStyle = C.ink; g.beginPath(); g.ellipse(bx + w + 18, dy, 14, 18, -0.5, 0, TAU); g.fill(); g.fillStyle = C.lit; g.beginPath(); g.ellipse(bx + w + 17, dy, 11, 15, -0.5, 0, TAU); g.fill(); g.fillStyle = C.body; g.beginPath(); g.ellipse(bx + w + 14, dy + 1, 8, 12, -0.5, 0, TAU); g.fill(); }
      } });
      x += 220 + rng() * 300;
    }
    // Z1 landmark: the Waystation Nine hub drum (warm windows — the lights are still on)
    objs.push({ x: 60, y: -560, w: 360, h: 640, draw(g) {
      const t = 0, C = layerC('mid', t, 0.3), cx = 230, cy = -300;
      lattice(g, cx - 18, cy + 40, 60, 36, C);
      lattice(g, cx - 10, -540, cy - 70, 20, C);
      // drum body (cel faces)
      g.beginPath(); g.ellipse(cx, cy - 64, 120, 16, 0, 0, TAU); g.rect(cx - 120, cy - 64, 240, 120); g.ellipse(cx, cy + 56, 120, 16, 0, 0, TAU);
      ink(g, 4); g.fillStyle = C.body; g.fill();
      rect(g, cx - 120, cy - 64, 50, 120, C.dark);
      rect(g, cx + 88, cy - 64, 32, 120, C.lit);
      g.fillStyle = C.lit; g.beginPath(); g.ellipse(cx, cy - 64, 120, 16, 0, 0, TAU); g.fill(); ink(g, 2);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 14; k++) {
        const wx = cx - 104 + k * 16, wy = cy - 44 + r * 26;
        g.fillStyle = (k * 7 + r * 3) % 5 === 0 ? 'rgba(255,200,120,0.95)' : (k + r) % 4 === 0 ? 'rgba(160,230,255,0.75)' : mixH(C.dark, '#000000', 0.3);
        g.fillRect(wx, wy, 9, 13);
      }
      stencil(g, '09', cx + 52, cy - 8, 40, mixH(M.enamel, P('far', 0), 0.2));
      // dish
      g.save(); g.translate(cx - 150, cy - 110); g.rotate(-0.6);
      g.beginPath(); g.ellipse(0, 0, 42, 16, 0, 0, PI); g.closePath(); ink(g, 3); g.fillStyle = C.lit; g.fill();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 40); ink(g, 3); g.restore();
      aviationLight(g, cx, -548, M.red, 3);
    } });
    // Z2 landmark: a giant cargo car hanging askew from a snapped rail
    objs.push({ x: 830, y: -640, w: 280, h: 720, draw(g) {
      const t = tintAt(950 / f), C = layerC('mid', t, 0.32);
      lattice(g, 860, -560, 60, 30, C); lattice(g, 1060, -600, 60, 30, C);
      girder(g, 850, 950, -520, 14, C); girder(g, 1010, 1100, -560, 14, C);
      // snapped rail ends
      g.save(); g.translate(950, -520); g.rotate(0.35); girder(g, 0, 40, 0, 14, C); g.restore();
      // chain + car
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(985, -500); g.lineTo(975, -400); g.stroke();
      g.save(); g.translate(975, -330); g.rotate(-0.42);
      const cw = 130, ch = 68;
      rect(g, -cw / 2 - 2, -ch / 2 - 2, cw + 4, ch + 4, INK);
      rect(g, -cw / 2, -ch / 2, cw, ch, mixH(M.rust, C.body, 0.5));
      rect(g, -cw / 2, -ch / 2, cw, 6, mixH(M.rust, C.lit, 0.4));
      rect(g, -cw / 2, -ch / 2, 14, ch, mixH(M.rust, C.dark, 0.6));
      g.strokeStyle = rgba(INK, 0.45); g.lineWidth = 1.2; g.beginPath(); for (let k = -cw / 2 + 18; k < cw / 2; k += 7) { g.moveTo(k, -ch / 2 + 7); g.lineTo(k, ch / 2 - 3); } g.stroke();
      stencil(g, '方舟貨運 05', 6, 0, 14, 'rgba(240,230,210,0.85)', { weight: 900 });
      g.restore();
      aviationLight(g, 875, -566, M.red, 2.5);
    } });
    // Z3: the cableway's far support towers + the long haul cable sagging across the vista
    objs.push({ x: 1380, y: -560, w: 640, h: 640, draw(g) {
      const t = tintAt(1700 / f), C = layerC('mid', t, 0.32);
      lattice(g, 1460, -470, 60, 26, C); lattice(g, 1940, -500, 60, 26, C);
      g.strokeStyle = rgba(INK, 0.85); g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(1473, -460); g.quadraticCurveTo(1700, -380, 1953, -490); g.stroke();
      g.beginPath(); g.moveTo(1473, -440); g.quadraticCurveTo(1700, -350, 1953, -470); g.stroke();
      aviationLight(g, 1473, -478, M.red, 2.4); aviationLight(g, 1953, -508, M.red, 2.4);
    } });
    // Z4 landmark: the maintenance ring (上環) — a colossal torus seen from inside its arc
    objs.push({ x: 1900, y: -760, w: 780, h: 840, draw(g) {
      const t = tintAt(2280 / f), C = layerC('mid', t, 0.32), cx = 2290, cy = -120;
      const band = (r1, r2, th, col) => { g.beginPath(); g.ellipse(cx, cy, r1, r2, 0, PI * 1.02, PI * 1.98); g.strokeStyle = INK; g.lineWidth = th + 4; g.stroke(); g.strokeStyle = col; g.lineWidth = th; g.stroke(); };
      band(380, 520, 44, C.dark); band(380, 520, 30, C.body);
      g.beginPath(); g.ellipse(cx, cy, 380, 520, 0, PI * 1.5, PI * 1.98); g.strokeStyle = C.lit; g.lineWidth = 4; g.stroke();
      // panel joints + lights along the arc
      for (let k = 0; k <= 22; k++) {
        const a = PI * 1.04 + (k / 22) * PI * 0.92, px = cx + Math.cos(a) * 380, py = cy + Math.sin(a) * 520;
        g.save(); g.translate(px, py); g.rotate(a + PI / 2); rect(g, -2, -24, 4, 48, INK); g.restore();
        if (k % 3 === 0) { g.fillStyle = k % 6 === 0 ? 'rgba(255,184,92,0.95)' : 'rgba(200,170,255,0.9)'; g.fillRect(px - 2, py - 2, 4, 4); }
      }
      // spokes down into the clouds
      for (const a of [PI * 1.15, PI * 1.85]) { const px = cx + Math.cos(a) * 380, py = cy + Math.sin(a) * 520; lattice(g, px - 12, py, 60, 24, C); }
      // lightning rods on top
      for (const a of [PI * 1.35, PI * 1.5, PI * 1.65]) { const px = cx + Math.cos(a) * 380, py = cy + Math.sin(a) * 520; rect(g, px - 2, py - 90, 4, 70, INK); rect(g, px - 1, py - 90, 2, 70, C.lit); aviationLight(g, px, py - 92, '#d9b8ff', 2.4); }
    } });
    // Z5: the mooring winch tower and chains rising towards the Ark
    objs.push({ x: 2620, y: -900, w: 420, h: 980, draw(g) {
      const t = 1, C = layerC('mid', t, 0.3);
      lattice(g, 2840, -420, 60, 54, C);
      block(g, 2810, -470, 114, 60, C);
      for (const [x0, y0, x1, y1] of [[2860, -470, 2700, -900], [2900, -470, 2780, -900]]) {
        const n = 16;
        for (let i = 0; i < n; i++) {
          const u = i / n, px = lerp(x0, x1, u), py = lerp(y0, y1, u), a = Math.atan2(y1 - y0, x1 - x0);
          g.save(); g.translate(px, py); g.rotate(a);
          g.beginPath(); if (i % 2) g.ellipse(0, 0, 13, 3, 0, 0, TAU); else g.ellipse(0, 0, 13, 7, 0, 0, TAU);
          g.strokeStyle = INK; g.lineWidth = 6; g.stroke(); g.strokeStyle = i % 2 ? C.dark : C.body; g.lineWidth = 3; g.stroke();
          g.restore();
        }
      }
      aviationLight(g, 2867, -480, M.red, 3);
    } });
    // cloud bed (lower deck of clouds, mid distance)
    const puffs = makePuffs(91, x0 - 300, x1 + 300, 40, 30, 34, 90);
    objs.push(...chunks(x0, x1, 512, -60, 900, (g, a, b) => {
      const t = tintAt(((a + b) / 2) / f), mid = P('mid', t);
      cloudBand(g, puffs, a, b, 900, { ink: rgba('#0b0612', 0.7), shade: mixH(mid, P('skyTop', t), 0.25), body: mixH(mid, P('fog', t), 0.35), lit: mixH(P('fog', t), P('rim', t), 0.6), bed: P('midDark', t) }, 1.5);
    }));
    return objs;
  }

  function genNear() {
    const f = 0.45, x0 = -900, x1 = SPAN[1] * f + 900, objs = [];
    const rng = U.mulberry32(7723);
    const zoneOf = (lx) => { const wx = lx / f; return wx < 2400 ? 1 : wx < 6400 ? 2 : wx < 8900 ? 3 : wx < 11900 ? 4 : 5; };
    let x = x0;
    while (x < x1) {
      const wx = x / f, z = zoneOf(x), t = tintAt(wx), r2 = rng() * 1e6, bx = x;
      if (z === 3) { x += 300; continue; }   // keep the aurora gap open
      const kind = rng(), w = 30 + rng() * 40;
      objs.push({ x: bx - 260, y: -900, w: w + 520, h: 1100, draw(g) {
        const rr = U.mulberry32(r2 | 0), C = layerC('near', t, 0.06);
        if (z === 5) {
          // giant mooring chain falling across the view + anchor fluke
          const n = 14, ax = bx, ay = -700;
          for (let i = 0; i < n; i++) {
            const px = ax + i * 24, py = ay + i * 52;
            g.save(); g.translate(px, py); g.rotate(1.1);
            g.beginPath(); if (i % 2) g.ellipse(0, 0, 30, 5, 0, 0, TAU); else g.ellipse(0, 0, 30, 15, 0, 0, TAU);
            g.strokeStyle = INK; g.lineWidth = 11; g.stroke(); g.strokeStyle = i % 2 ? C.dark : C.body; g.lineWidth = 6; g.stroke();
            if (!(i % 2)) { g.beginPath(); g.ellipse(0, -3, 26, 11, 0, PI * 1.1, PI * 1.6); g.strokeStyle = C.lit; g.lineWidth = 1.6; g.stroke(); }
            g.restore();
          }
          return;
        }
        if (kind < 0.32) {
          // heavy column with gusset plates and a cross girder
          const top = -700 - rr() * 200;
          block(g, bx, top, w * 0.6, 900, C);
          rect(g, bx + w * 0.6 - 3, top, 3, 900, C.lit);
          for (let y = top + 40; y < 120; y += 70 + rr() * 40) { rect(g, bx - 4, y, w * 0.6 + 8, 4, INK); rect(g, bx + w * 0.3, y + 6, 2, 2, C.lit); }
          const gy = -320 - rr() * 260, gl = 180 + rr() * 260;
          girder(g, bx - gl * 0.5, bx + gl * 0.5 + w * 0.6, gy, 18, C);
          if (z === 2 && rr() < 0.7) {
            // hanging cargo container silhouette on chains
            const cx = bx + gl * 0.2, cy = gy + 80 + rr() * 60, cw = 110 + rr() * 40, ch = 52;
            g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + 15, gy + 18); g.lineTo(cx + 12, cy); g.moveTo(cx + cw - 15, gy + 18); g.lineTo(cx + cw - 12, cy); g.stroke();
            block(g, cx, cy, cw, ch, { body: mixH(C.body, M.rust, 0.25), lit: mixH(C.lit, M.rust, 0.2), dark: C.dark });
            g.strokeStyle = rgba(INK, 0.5); g.lineWidth = 1; g.beginPath(); for (let k = cx + 10; k < cx + cw - 4; k += 6) { g.moveTo(k, cy + 6); g.lineTo(k, cy + ch - 4); } g.stroke();
          }
          if (z === 4 && rr() < 0.8) { rect(g, bx + w * 0.3 - 2, top - 120, 4, 120, INK); rect(g, bx + w * 0.3 - 1, top - 120, 2, 120, C.lit); }
        } else if (kind < 0.7) {
          // truss arm with signal lamp / dangling cables
          const ty = -520 - rr() * 240;
          lattice(g, bx, ty, 140, w * 0.8, C);
          g.strokeStyle = rgba(INK, 0.9); g.lineWidth = 1.6;
          for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(bx + w * 0.4, ty + 40 + k * 30); g.quadraticCurveTo(bx + 80 + k * 40, ty + 160 + k * 30, bx + 160 + k * 50, ty + 20 + k * 30); g.stroke(); }
          if (z === 1 && rr() < 0.6) {
            const sy = ty + 100;
            rect(g, bx - 46, sy, 92, 36, INK); rect(g, bx - 44, sy + 2, 88, 32, mixH(C.body, M.enamel, 0.25));
            stencil(g, rr() < 0.5 ? '第九站' : '往上環', bx, sy + 18, 15, 'rgba(255,220,170,0.75)', { ink: false });
          }
        } else {
          // ring walkway fragment / rail beam on brackets
          const gy = -260 - rr() * 380, gl = 320 + rr() * 300;
          girder(g, bx, bx + gl, gy, 22, C);
          for (let k = bx + 30; k < bx + gl; k += 110) { g.beginPath(); g.moveTo(k, gy + 22); g.lineTo(k + 40, gy + 70); g.lineTo(k + 50, gy + 22); g.closePath(); ink(g, 2); g.fillStyle = C.dark; g.fill(); }
          g.strokeStyle = rgba(INK, 0.9); g.lineWidth = 2;
          g.beginPath(); for (let k = bx; k < bx + gl; k += 16) { g.moveTo(k, gy); g.lineTo(k, gy - 22); } g.moveTo(bx, gy - 22); g.lineTo(bx + gl, gy - 22); g.stroke();
        }
      } });
      x += 300 + rng() * 380;
    }
    // lower cloud bank under the decks
    const puffs = makePuffs(133, x0 - 300, x1 + 300, 70, 34, 40, 110);
    objs.push(...chunks(x0, x1, 512, -40, 900, (g, a, b) => {
      const t = tintAt(((a + b) / 2) / f), near = P('near', t);
      cloudBand(g, puffs, a, b, 900, { shade: mixH(near, P('nearDark', t), 0.5), body: mixH(near, P('fog', t), 0.22), lit: mixH(P('fog', t), P('rim', t), 0.35), bed: P('nearDark', t) }, 1.8);
    }));
    return objs;
  }

  /* =========================================================================================
     GAMEPLAY PLANE: solids, one-ways, props (world space, cached)
     ========================================================================================= */
  const deckC = (t) => ({ body: P('ground', t), lit: P('groundTop', t), dark: mixH(P('ground', t), M.enamelD, 0.55), steel: mixH(M.steel, P('groundDark', t), 0.3), steelL: mixH(M.steelL, P('rim', t), 0.25), steelD: M.steelDD });
  function paintDeck(s) {
    const top = s.y, ends = [s.x, s.x + s.w];
    return chunks(s.x - 12, s.x + s.w + 12, 512, top - 30, 760, (g, a, b) => {
      const t = tintAt((a + b) / 2), C = deckC(t), rim = P('rim', t);
      const A = Math.max(a, s.x), B = Math.min(b, s.x + s.w);
      if (B <= A) return;
      // open truss under the deck (sky shows between members)
      const tb = top + 40, bb = top + 214;
      g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = 'butt';
      g.beginPath();
      const p0 = Math.floor(A / 120) * 120;
      for (let xx = p0; xx < B + 120; xx += 120) { const dir = (xx / 120) % 2 === 0; g.moveTo(xx, dir ? tb : bb); g.lineTo(xx + 120, dir ? bb : tb); g.moveTo(xx, tb); g.lineTo(xx, bb); }
      g.stroke();
      g.strokeStyle = C.steel; g.lineWidth = 4; g.stroke();
      g.strokeStyle = rgba(rim, 0.35); g.lineWidth = 1; g.beginPath();
      for (let xx = p0; xx < B + 120; xx += 120) { const dir = (xx / 120) % 2 === 0; g.moveTo(xx + 2, (dir ? tb : bb) - 1.5); g.lineTo(xx + 122, (dir ? bb : tb) - 1.5); }
      g.stroke();
      rect(g, A, bb - 1.5, B - A, 11, INK); rect(g, A, bb, B - A, 8, C.steel); rect(g, A, bb, B - A, 1.5, C.steelL);
      // deep support columns fading into the clouds
      for (let xx = Math.floor(A / 640) * 640 + 300; xx < B; xx += 640) {
        if (xx < A || xx > B - 30) continue;
        const cg = g.createLinearGradient(0, bb, 0, top + 700);
        cg.addColorStop(0, C.steel); cg.addColorStop(1, rgba(C.steel, 0));
        rect(g, xx - 2, bb, 34, 520, rgba(INK, 0.8)); g.fillStyle = cg; g.fillRect(xx, bb, 30, 520);
        rect(g, xx + 24, bb, 4, 300, rgba(rim, 0.25));
      }
      // edge beam (steel, bolts, keep-clear stripe segments)
      rect(g, A, top + 14, B - A, 28, INK);
      rect(g, A, top + 16, B - A, 22, C.steel);
      rect(g, A, top + 16, B - A, 2.5, C.steelL);
      rect(g, A, top + 34, B - A, 4, C.steelD);
      g.fillStyle = C.steelL; for (let xx = Math.floor(A / 48) * 48 + 10; xx < B; xx += 48) { g.fillRect(xx, top + 22, 2, 2); g.fillRect(xx, top + 30, 2, 2); }
      for (let xx = Math.floor(A / 1024) * 1024 + 560; xx < B; xx += 1024) {
        g.save(); g.beginPath(); g.rect(xx, top + 18, 150, 14); g.clip();
        rect(g, xx, top + 18, 150, 14, M.hazard);
        g.fillStyle = INK; for (let k = -20; k < 160; k += 16) { g.beginPath(); g.moveTo(xx + k, top + 32); g.lineTo(xx + k + 8, top + 32); g.lineTo(xx + k + 22, top + 18); g.lineTo(xx + k + 14, top + 18); g.fill(); }
        g.restore(); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(xx, top + 18, 150, 14);
      }
      // enamel walking surface (seen slightly from above)
      rect(g, A, top - 1.6, B - A, 2, INK);
      rect(g, A, top, B - A, 15, C.body);
      rect(g, A, top, B - A, 2.2, C.lit);
      rect(g, A, top + 11, B - A, 4, C.dark);
      g.fillStyle = rgba(INK, 0.55);
      for (let xx = Math.floor(A / 96) * 96; xx < B; xx += 96) { g.fillRect(xx, top + 2, 1.4, 10); g.fillStyle = C.lit; g.fillRect(xx + 1.4, top + 2, 1, 10); g.fillStyle = rgba(INK, 0.55); }
      g.fillStyle = rgba(INK, 0.45); for (let xx = Math.floor(A / 32) * 32 + 6; xx < B; xx += 32) g.fillRect(xx, top + 6, 1.6, 1.6);
      // lane paint + scuffs + frost drifts (deterministic, world aligned)
      const rr = U.mulberry32(Math.floor(A) * 7 + 3);
      for (let xx = Math.floor(A / 180) * 180 + 40; xx < B; xx += 180) { if (rr() < 0.55) { g.fillStyle = rgba(M.amber, 0.55); g.fillRect(xx, top + 7, 70, 2); } }
      for (let k = 0; k < (B - A) / 70; k++) {
        const xx = A + rr() * (B - A), r = rr();
        if (r < 0.4) { g.fillStyle = rgba('#ffffff', 0.55); g.beginPath(); g.ellipse(xx, top + 0.5, 14 + rr() * 30, 2.5 + rr() * 2, 0, PI, 0); g.fill(); }
        else if (r < 0.6) { g.strokeStyle = rgba(INK, 0.35); g.lineWidth = 0.8; g.beginPath(); g.moveTo(xx, top + 3); g.lineTo(xx + 8 + rr() * 16, top + 5 + rr() * 6); g.stroke(); }
      }
      // bulkhead end caps
      for (const e of ends) {
        if (e < a - 12 || e > b + 12) continue;
        const left = e === s.x, ex = left ? e : e - 18;
        rect(g, ex - 2, top - 2, 22, 230, INK);
        rect(g, ex, top, 18, 226, C.steel);
        rect(g, left ? ex : ex + 14, top, 4, 226, left ? C.steelD : C.steelL);
        g.save(); g.beginPath(); g.rect(ex + 3, top + 4, 12, 60); g.clip(); rect(g, ex + 3, top + 4, 12, 60, M.hazard);
        g.fillStyle = INK; for (let k = -12; k < 70; k += 12) { g.beginPath(); g.moveTo(ex + 3, top + 4 + k); g.lineTo(ex + 15, top + 4 + k - 8); g.lineTo(ex + 15, top + 4 + k - 2); g.lineTo(ex + 3, top + 10 + k); g.fill(); }
        g.restore();
      }
    });
  }
  function paintCargo(s) {
    const styles = [
      { body: '#c2543a', lit: '#ef8a5e', dark: '#6d2534', text: '方舟貨運', sub: 'CANTATA FREIGHT  C-05-118' },
      { body: '#2f7f86', lit: '#5fc3c0', dark: '#173e57', text: '第五降臨隊', sub: 'DESCENT V  SUPPLY' },
      { body: '#d9dde8', lit: '#ffffff', dark: '#7c80a8', text: '易碎', sub: 'FRAGILE — RESONANT GLASS' },
      { body: '#a1863f', lit: '#e6c46b', dark: '#55402a', text: '攀升艙', sub: 'CLIMBER  09' },
    ];
    const S0 = styles[s.style || 0];
    return [{ x: s.x - 20, y: s.y - 30, w: s.w + 40, h: s.h + 40, draw(g) {
      const t = tintAt(s.x), rim = P('rim', t), x = s.x, y = s.y, w = s.w, h = s.h, rr = U.mulberry32(s.x | 0);
      const body = mixH(S0.body, P('near', t), 0.12), lit = mixH(S0.lit, rim, 0.18), dark = mixH(S0.dark, '#1a0e30', 0.25);
      rect(g, x - 2.5, y - 2.5, w + 5, h + 5, INK);
      rect(g, x, y, w, h, body);
      // corrugation: alternating lit / shadow ribs
      for (let k = x + 12; k < x + w - 12; k += 9) { rect(g, k, y + 9, 3, h - 18, lit); rect(g, k + 3, y + 9, 2, h - 18, dark); }
      // frame: top/bottom rails + corner posts
      rect(g, x, y, w, 8, dark); rect(g, x, y, w, 2.5, lit);
      rect(g, x, y + h - 8, w, 8, dark);
      rect(g, x, y, 10, h, dark); rect(g, x + w - 10, y, 10, h, mixH(dark, lit, 0.35)); rect(g, x + w - 3, y, 3, h, lit);
      for (const cx of [x + 2, x + w - 8]) for (const cy of [y + 2, y + h - 8]) { rect(g, cx, cy, 6, 6, INK); rect(g, cx + 1.5, cy + 1.5, 3, 3, lit); }
      // door end with locking bars
      const dx = x + w - 52;
      rect(g, dx, y + 8, 2, h - 16, INK);
      for (const bxx of [dx + 12, dx + 30]) { rect(g, bxx, y + 10, 4, h - 20, INK); rect(g, bxx + 1, y + 10, 2, h - 20, lit); rect(g, bxx - 3, y + h * 0.5 - 4, 10, 8, INK); }
      // stencils
      const panelW = w - 70;
      if (panelW > 60) {
        stencil(g, S0.text, x + 14 + panelW / 2, y + h * 0.42, Math.min(28, h * 0.22), 'rgba(250,244,230,0.9)');
        stencil(g, S0.sub, x + 14 + panelW / 2, y + h * 0.42 + Math.min(28, h * 0.22) * 0.95, 9, 'rgba(250,244,230,0.75)', { weight: 700, font: 'Rajdhani, sans-serif', ink: false });
      }
      // rust streaks + dents
      for (let k = 0; k < w / 40; k++) { const sx = x + 12 + rr() * (w - 24), sl = 12 + rr() * h * 0.5; const sg = g.createLinearGradient(0, y + 8, 0, y + 8 + sl); sg.addColorStop(0, 'rgba(90,30,20,0.55)'); sg.addColorStop(1, 'rgba(90,30,20,0)'); g.fillStyle = sg; g.fillRect(sx, y + 8, 2 + rr() * 3, sl); }
      // frost cap on the roof
      g.fillStyle = 'rgba(240,248,255,0.92)'; g.beginPath(); g.moveTo(x - 1, y);
      for (let k = 0; k <= 10; k++) g.lineTo(x + (w * k) / 10, y - 2 - rr() * 3); g.lineTo(x + w + 1, y); g.lineTo(x + w, y + 2); g.lineTo(x, y + 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 1, y); for (let k = 0; k <= 10; k++) g.lineTo(x + (w * k) / 10, y - 2 - U.mulberry32(s.x + k)() * 3); g.stroke();
      // icicles under the rim
      g.fillStyle = 'rgba(220,240,255,0.85)'; for (let k = x + 6; k < x + w - 6; k += 13 + rr() * 16) { const l = 4 + rr() * 9; g.beginPath(); g.moveTo(k, y + h); g.lineTo(k + 2, y + h + l); g.lineTo(k + 4, y + h); g.fill(); }
    } }];
  }
  function paintUnder(s) {
    return chunks(s.x, s.x + s.w, 512, s.y - 140, 520, (g, a, b) => {
      const t = tintAt((a + b) / 2), C = deckC(t), top = s.y, rim = P('rim', t);
      // back railing
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath();
      for (let xx = Math.floor(a / 64) * 64; xx < b + 64; xx += 64) { g.moveTo(xx, top); g.lineTo(xx, top - 40); }
      g.moveTo(a, top - 40); g.lineTo(b, top - 40); g.moveTo(a, top - 20); g.lineTo(b, top - 20); g.stroke();
      g.strokeStyle = C.steel; g.lineWidth = 1.5; g.stroke();
      // grating walkway
      rect(g, a, top - 1.5, b - a, 16, INK);
      rect(g, a, top, b - a, 12, C.steel);
      rect(g, a, top, b - a, 2, C.steelL);
      g.fillStyle = C.steelD; for (let xx = Math.floor(a / 8) * 8; xx < b; xx += 8) g.fillRect(xx + 2, top + 4, 4, 5);
      // hazard lip
      rect(g, a, top + 12, b - a, 5, M.hazard); g.fillStyle = INK; for (let xx = Math.floor(a / 14) * 14; xx < b; xx += 14) g.fillRect(xx, top + 12, 6, 5);
      // brackets + hanging cables + work lamps
      for (let xx = Math.floor(a / 300) * 300 + 120; xx < b; xx += 300) {
        g.beginPath(); g.moveTo(xx, top + 17); g.lineTo(xx + 50, top + 70); g.lineTo(xx + 60, top + 17); g.closePath(); ink(g, 2.5); g.fillStyle = C.steel; g.fill();
        g.strokeStyle = rgba(INK, 0.9); g.lineWidth = 1.6; g.beginPath(); g.moveTo(xx + 70, top + 17); g.quadraticCurveTo(xx + 130, top + 120, xx + 200, top + 17); g.stroke();
        if ((xx / 300 | 0) % 2 === 0) { rect(g, xx + 6, top - 70, 4, 70, INK); rect(g, xx - 4, top - 78, 24, 10, INK); rect(g, xx - 2, top - 76, 20, 6, M.amber);
          const lg = g.createRadialGradient(xx + 8, top - 70, 0, xx + 8, top - 70, 90); lg.addColorStop(0, 'rgba(255,184,92,0.32)'); lg.addColorStop(1, 'rgba(255,184,92,0)'); g.fillStyle = lg; g.fillRect(xx - 90, top - 160, 196, 180); }
      }
      void rim;
    });
  }
  function paintPier(s) {
    return [{ x: s.x - 20, y: s.y - 20, w: s.w + 40, h: 520, draw(g) {
      const C = deckC(tintAt(s.x));
      rect(g, s.x - 2, s.y - 2, s.w + 4, 14, INK); rect(g, s.x, s.y, s.w, 10, C.steel); rect(g, s.x, s.y, s.w, 2, C.steelL);
      lattice(g, s.x + 8, s.y + 10, s.y + 420, s.w - 16, { body: C.steel, dark: C.steelD, lit: C.steelL });
      rect(g, s.x + 4, s.y - 40, 3, 40, INK); rect(g, s.x + s.w - 7, s.y - 40, 3, 40, INK); rect(g, s.x + 4, s.y - 40, s.w - 8, 3, INK);
    } }];
  }
  function onewayPainter(p) {
    const t = tintAt(p.x), C = deckC(t);
    const objs = [{ x: p.x - 30, y: p.y - 520, w: p.w + 60, h: 620, draw(g) {
      const x = p.x, y = p.y, w = p.w, rim = P('rim', t);
      if (p.cab) {
        // the crane cab: back wall, a bench, a window onto the stars and a child's crayon drawings
        rect(g, x - 3, y - 152, w + 6, 155, INK);
        rect(g, x, y - 150, w, 150, mixH(M.hazard, C.steel, 0.55));
        rect(g, x, y - 150, w, 5, mixH(M.hazard, rim, 0.3));
        rect(g, x + w - 6, y - 150, 6, 150, mixH(M.hazard, rim, 0.2));
        rect(g, x + 20, y - 128, 120, 64, INK); rect(g, x + 23, y - 125, 114, 58, '#0a1636');
        g.fillStyle = 'rgba(255,255,255,0.8)'; for (let k = 0; k < 14; k++) { const rr = U.mulberry32(k * 31 + 7); g.fillRect(x + 26 + rr() * 108, y - 122 + rr() * 52, 1.4, 1.4); }
        g.strokeStyle = rgba('#7dffc4', 0.5); g.lineWidth = 3; g.beginPath(); g.moveTo(x + 23, y - 85); g.quadraticCurveTo(x + 80, y - 110, x + 137, y - 92); g.stroke();
        rect(g, x + 78, y - 125, 3, 58, INK);
        // crayon drawings taped to the wall
        const paper = (px, py, rot, fn) => { g.save(); g.translate(px, py); g.rotate(rot); rect(g, -16, -13, 32, 26, '#f3ead6'); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(-16, -13, 32, 26); rect(g, -5, -15, 10, 4, 'rgba(255,240,180,0.7)'); fn(); g.restore(); };
        paper(x + 172, y - 108, -0.08, () => { g.strokeStyle = '#3a6fd8'; g.lineWidth = 1.4; g.strokeRect(-7, -4, 12, 11); g.beginPath(); g.arc(-1, -7, 4, PI, 0); g.moveTo(-1, -11); g.lineTo(2, -15); g.stroke(); g.fillStyle = '#e8b13a'; g.beginPath(); g.arc(2.5, -15.5, 1.8, 0, TAU); g.fill(); g.strokeStyle = '#d13a3a'; g.beginPath(); g.moveTo(1, -13); g.lineTo(7, -10); g.stroke(); });
        paper(x + 214, y - 96, 0.1, () => { g.fillStyle = '#c98a2c'; g.beginPath(); g.moveTo(-6, 6); g.quadraticCurveTo(-7, -6, 0, -8); g.quadraticCurveTo(7, -6, 6, 6); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke(); });
        paper(x + 190, y - 62, 0.04, () => { g.fillStyle = '#1b1b24'; g.beginPath(); g.ellipse(-4, -4, 4, 7, 0, 0, TAU); g.fill(); g.strokeStyle = '#d13a3a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(6, -2); g.lineTo(6, 8); g.stroke(); g.fillStyle = '#f2c9a8'; g.beginPath(); g.arc(6, -5, 2.6, 0, TAU); g.fill(); g.strokeStyle = '#1b1b24'; g.lineWidth = 1; g.beginPath(); g.moveTo(-3, 2); g.lineTo(-3, 9); g.stroke(); });
        // bench
        rect(g, x + 150, y - 30, 70, 8, INK); rect(g, x + 152, y - 28, 66, 4, C.steelL); rect(g, x + 156, y - 22, 4, 22, INK); rect(g, x + 208, y - 22, 4, 22, INK);
        // jib root + hook cable out the right side
        girder(g, x + w - 10, x + w + 260, y - 172, 18, { body: mixH(M.hazard, C.steel, 0.45), lit: mixH(M.hazard, rim, 0.4), dark: C.steelD });
        g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x + w + 230, y - 154); g.lineTo(x + w + 230, y + 300); g.stroke();
        g.beginPath(); g.arc(x + w + 236, y + 312, 10, PI * 0.9, PI * 0.1, true); g.lineWidth = 5; g.stroke(); g.strokeStyle = C.steelL; g.lineWidth = 2; g.stroke();
      }
      // catwalk: grating, toe-board, railing, suspension rods up to the structure above
      if (y < 0) {
        g.strokeStyle = INK; g.lineWidth = 2.6; g.beginPath();
        g.moveTo(x + 8, y); g.lineTo(x + 8 - 30, y - 420); g.moveTo(x + w - 8, y); g.lineTo(x + w - 8 + 30, y - 420); g.stroke();
        g.strokeStyle = rgba(rim, 0.4); g.lineWidth = 0.8; g.stroke();
      }
      g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath();
      for (let xx = x + 6; xx < x + w; xx += 34) { g.moveTo(xx, y); g.lineTo(xx, y - 30); }
      g.moveTo(x + 4, y - 30); g.lineTo(x + w - 4, y - 30); g.stroke();
      g.strokeStyle = C.steelL; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 4, y - 31); g.lineTo(x + w - 4, y - 31); g.stroke();
      rect(g, x - 2, y - 2, w + 4, 14, INK);
      rect(g, x, y, w, 10, C.steel); rect(g, x, y, w, 2, C.steelL);
      g.fillStyle = C.steelD; for (let xx = x + 3; xx < x + w - 3; xx += 7) g.fillRect(xx, y + 4, 4, 4);
      rect(g, x, y + 10, w, 3, M.hazard);
      g.beginPath(); g.moveTo(x + 10, y + 12); g.lineTo(x + w / 2, y + 40); g.lineTo(x + w - 10, y + 12); ink(g, 3); g.strokeStyle = C.steel; g.lineWidth = 1.5; g.stroke();
      // a little amber lamp on secret / service platforms (the ladder lights you can see from below)
      if (y < -700 || p.cab) { rect(g, x + w - 18, y - 46, 3, 16, INK); rect(g, x + w - 22, y - 52, 11, 7, INK); rect(g, x + w - 21, y - 51, 9, 5, M.amber);
        const lg = g.createRadialGradient(x + w - 16, y - 48, 0, x + w - 16, y - 48, 70); lg.addColorStop(0, 'rgba(255,184,92,0.4)'); lg.addColorStop(1, 'rgba(255,184,92,0)'); g.fillStyle = lg; g.fillRect(x + w - 86, y - 118, 140, 140); }
    } }];
    return objs;
  }

  // world props (cached; behind all actors)
  function genProps() {
    const objs = [];
    const lamp = (x, y, lit = true) => objs.push({ x: x - 70, y: y - 230, w: 140, h: 240, draw(g) {
      const t = tintAt(x), C = deckC(t);
      if (lit) { const lg = g.createRadialGradient(x + 14, y - 170, 0, x + 14, y - 170, 120); lg.addColorStop(0, 'rgba(255,190,110,0.30)'); lg.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = lg; g.fillRect(x - 110, y - 290, 250, 260);
        const cone = g.createLinearGradient(0, y - 165, 0, y); cone.addColorStop(0, 'rgba(255,200,130,0.18)'); cone.addColorStop(1, 'rgba(255,200,130,0)'); g.fillStyle = cone; g.beginPath(); g.moveTo(x + 6, y - 166); g.lineTo(x + 24, y - 166); g.lineTo(x + 60, y); g.lineTo(x - 30, y); g.fill(); }
      rect(g, x - 4.5, y - 176, 9, 176, INK); rect(g, x - 3, y - 176, 4, 176, C.steel); rect(g, x + 1, y - 176, 2, 176, C.steelL);
      rect(g, x - 10, y - 12, 20, 12, INK); rect(g, x - 8, y - 10, 16, 8, C.steel);
      g.beginPath(); g.moveTo(x, y - 174); g.quadraticCurveTo(x + 4, y - 190, x + 22, y - 186); ink(g, 5); g.strokeStyle = C.steel; g.lineWidth = 2.5; g.stroke();
      poly(g, [[x + 6, y - 184], [x + 26, y - 184], [x + 30, y - 170], [x + 2, y - 170]]); ink(g, 2.5); g.fillStyle = C.steel; g.fill();
      rect(g, x + 4, y - 170, 24, 4, lit ? M.amberL : '#3a3f58');
    } });
    const railing = (x0, x1, y) => objs.push(...chunks(x0, x1, 512, y - 60, 70, (g, a, b) => {
      const C = deckC(tintAt((a + b) / 2));
      g.strokeStyle = INK; g.lineWidth = 3.5; g.beginPath();
      for (let xx = Math.floor(a / 60) * 60; xx < b + 60; xx += 60) { g.moveTo(xx, y); g.lineTo(xx, y - 46); }
      g.moveTo(a, y - 46); g.lineTo(b, y - 46); g.moveTo(a, y - 24); g.lineTo(b, y - 24); g.stroke();
      g.strokeStyle = C.steel; g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = rgba(P('rim', tintAt(a)), 0.55); g.lineWidth = 0.8; g.beginPath(); g.moveTo(a, y - 47.5); g.lineTo(b, y - 47.5); g.stroke();
    }));
    const beaconAv = (x, y) => objs.push({ x: x - 30, y: y - 30, w: 60, h: 60, draw(g) { aviationLight(g, x, y, M.red, 3); } });

    // ---- Z1: arrival lift cage from the opera (Chapter IV)
    objs.push({ x: -400, y: -700, w: 470, h: 720, draw(g) {
      const C = deckC(0), x = -340, y = 0, w = 300, h = 270, rim = P('rim', 0);
      for (const cx of [x + 30, x + w - 30]) { g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, y - h); g.lineTo(cx, -700); g.stroke(); g.strokeStyle = C.steelL; g.lineWidth = 1.5; g.stroke(); }
      block(g, x - 10, y - h - 26, w + 20, 26, { body: C.steel, lit: C.steelL, dark: C.steelD });
      g.beginPath(); g.arc(x + w / 2, y - h - 40, 26, 0, TAU); ink(g, 4); g.fillStyle = C.steel; g.fill(); g.beginPath(); g.arc(x + w / 2, y - h - 40, 8, 0, TAU); g.fillStyle = C.steelL; g.fill();
      // cage frame
      g.strokeStyle = INK; g.lineWidth = 7; g.strokeRect(x, y - h, w, h); g.strokeStyle = C.steel; g.lineWidth = 4; g.strokeRect(x, y - h, w, h);
      g.strokeStyle = rgba(INK, 0.9); g.lineWidth = 2; g.beginPath(); for (let k = x + 20; k < x + w; k += 20) { g.moveTo(k, y - h); g.lineTo(k, y - h + 40); } g.stroke();
      // folded accordion gate on the right
      g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); for (let k = 0; k < 6; k++) { const gx = x + w - 30 + (k % 2) * 8; g.moveTo(gx, y - h + 40); g.lineTo(x + w - 30 + ((k + 1) % 2) * 8, y - 4); } g.stroke();
      g.strokeStyle = M.hazard; g.lineWidth = 1; g.stroke();
      // interior warm light + floor
      const lg = g.createRadialGradient(x + w / 2, y - h + 60, 0, x + w / 2, y - h + 60, 200); lg.addColorStop(0, 'rgba(255,196,120,0.30)'); lg.addColorStop(1, 'rgba(255,196,120,0)'); g.fillStyle = lg; g.fillRect(x, y - h, w, h);
      rect(g, x + w / 2 - 20, y - h + 44, 40, 8, INK); rect(g, x + w / 2 - 18, y - h + 46, 36, 4, M.amberL);
      // sign
      rect(g, x + 50, y - h - 92, 200, 44, INK); rect(g, x + 53, y - h - 89, 194, 38, mixH(M.enamel, C.body, 0.3));
      stencil(g, '升降梯 ▽ 萊拉', x + 150, y - h - 76, 15, '#1b2240', { ink: false });
      stencil(g, 'LIFT — TO LYRA', x + 150, y - h - 58, 10, '#1b2240', { ink: false, weight: 700, font: 'Rajdhani, sans-serif' });
      void rim;
    } });
    // ---- Z1: station signage
    objs.push({ x: 820, y: -330, w: 360, h: 340, draw(g) {
      const C = deckC(0), x = 860, y = 0;
      for (const px of [x + 20, x + 260]) { rect(g, px - 4, y - 260, 10, 260, INK); rect(g, px - 2, y - 260, 6, 260, C.steel); rect(g, px + 2, y - 260, 2, 260, C.steelL); }
      rect(g, x - 4, y - 300, 300, 96, INK);
      rect(g, x, y - 296, 292, 88, M.enamel); rect(g, x, y - 296, 292, 6, M.enamelL); rect(g, x, y - 214, 292, 6, M.enamelS);
      rect(g, x, y - 296, 18, 88, '#2f5fae');
      stencil(g, '頌歌之梯・第九中繼站', x + 155, y - 266, 24, '#16204a', { ink: false });
      stencil(g, 'CANTATA LADDER — WAYSTATION 09 — ALT. 41,200 M', x + 155, y - 238, 10, '#3a4470', { ink: false, weight: 700, font: 'Rajdhani, sans-serif' });
      rect(g, x + 30, y - 228, 232, 2, '#16204a');
      stencil(g, '◁ 往下 往萊拉　　往上環 ▷', x + 155, y - 220, 11, '#16204a', { ink: false, weight: 700 });
      g.fillStyle = rgba('#3a1f20', 0.45); for (let k = 0; k < 6; k++) { const rr = U.mulberry32(k + 900); g.fillRect(x + rr() * 290, y - 296 + rr() * 20, 2, 18 + rr() * 30); }
    } });
    // ---- Z1: beacon mast (the rotating lamp is animated in drawBack)
    objs.push({ x: 1180, y: -820, w: 200, h: 830, draw(g) {
      const C = deckC(0), x = 1250, top = -720;
      lattice(g, x, top, 0, 46, { body: C.steel, dark: C.steelD, lit: C.steelL });
      block(g, x - 20, top - 50, 86, 50, { body: C.steel, lit: C.steelL, dark: C.steelD });
      rect(g, x - 8, top - 92, 62, 44, INK); rect(g, x - 5, top - 89, 56, 38, 'rgba(255,220,160,0.85)');
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 4; k++) { g.moveTo(x - 5 + k * 18, top - 89); g.lineTo(x - 5 + k * 18, top - 51); } g.stroke();
      poly(g, [[x - 14, top - 92], [x + 23, top - 116], [x + 60, top - 92]]); ink(g, 3); g.fillStyle = C.steel; g.fill();
      rect(g, x + 21, top - 140, 4, 26, INK); aviationLight(g, x + 23, top - 142, M.red, 3);
      // service ladder
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 14, top); g.lineTo(x - 14, 0); g.moveTo(x - 4, top); g.lineTo(x - 4, 0); for (let y = top + 8; y < 0; y += 14) { g.moveTo(x - 14, y); g.lineTo(x - 4, y); } g.stroke();
    } });
    lamp(380, 0); lamp(1520, 0); lamp(2240, 0);
    railing(-380, 2390, -6);
    // equipment on Z1 deck: fuel cylinders, a crate stack
    objs.push({ x: 1600, y: -110, w: 260, h: 120, draw(g) {
      const C = deckC(0);
      for (let k = 0; k < 3; k++) { const cx = 1640 + k * 34; g.beginPath(); g.roundRect ? g.roundRect(cx - 14, -84, 28, 84, 10) : g.rect(cx - 14, -84, 28, 84); ink(g, 3); g.fillStyle = k === 1 ? M.crate : M.enamel; g.fill(); rect(g, cx - 14, -60, 28, 6, INK); rect(g, cx + 6, -80, 5, 76, rgba('#ffffff', 0.35)); }
      block(g, 1760, -54, 70, 54, { body: '#5a4a6a', lit: '#8d7aa8', dark: '#2d2140' }); stencil(g, 'O₂', 1795, -27, 16, 'rgba(255,255,255,0.8)', { ink: false });
      void C;
    } });
    beaconAv(-200, -300);

    // ---- Z2: overhead cargo rail with hanging chains & trolleys
    objs.push(...chunks(2500, 5000, 512, -880, 520, (g, a, b) => {
      const C = deckC(tintAt(a)), S = { body: C.steel, lit: C.steelL, dark: C.steelD };
      girder(g, a, b, -860, 34, S);
      for (let xx = Math.floor(a / 450) * 450 + 200; xx < b; xx += 450) {
        rect(g, xx - 22, -826, 44, 20, INK); rect(g, xx - 20, -824, 40, 16, mixH(M.hazard, C.steel, 0.3));
        g.beginPath(); g.arc(xx - 12, -828, 7, 0, TAU); g.arc(xx + 12, -828, 7, 0, TAU); g.fillStyle = INK; g.fill();
        const len = 260 + ((xx / 450) % 3) * 70;
        for (let k = 0; k < len; k += 9) { g.beginPath(); if ((k / 9) % 2) g.ellipse(xx, -806 + k, 2, 4.5, 0, 0, TAU); else g.ellipse(xx, -806 + k, 3.6, 4.5, 0, 0, TAU); g.strokeStyle = INK; g.lineWidth = 2.6; g.stroke(); g.strokeStyle = C.steelL; g.lineWidth = 1; g.stroke(); }
        g.beginPath(); g.arc(xx + 4, -806 + len + 10, 9, PI * 1.0, PI * 0.15, true); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); g.strokeStyle = C.steelL; g.lineWidth = 2; g.stroke();
      }
    }));
    for (const cx of [2700, 3620, 4540]) objs.push({ x: cx - 30, y: -880, w: 60, h: 760, draw(g) { const C = deckC(tintAt(cx)); lattice(g, cx - 16, -830, -140, 32, { body: C.steel, dark: C.steelD, lit: C.steelL }); } });
    // ---- Z2: Dingding's home — an opened cargo car full of polished lamps and 7,300 tally marks
    objs.push({ x: 2640, y: -380, w: 420, h: 250, draw(g) {
      const t = tintAt(2800), C = deckC(t), x = 2670, y = -140, w = 330, h = 190;
      rect(g, x - 3, y - h - 3, w + 6, h + 3, INK);
      rect(g, x, y - h, w, h, '#2a2236');
      const lg = g.createRadialGradient(x + 200, y - 70, 0, x + 200, y - 70, 230); lg.addColorStop(0, 'rgba(255,190,110,0.55)'); lg.addColorStop(1, 'rgba(255,190,110,0.04)'); g.fillStyle = lg; g.fillRect(x, y - h, w, h);
      // shelf of lamps
      for (const sy of [y - 150, y - 100]) {
        rect(g, x + 20, sy, 200, 5, INK); rect(g, x + 20, sy, 200, 3, '#7a5b3a');
        for (let k = 0; k < 7; k++) { const lx = x + 34 + k * 27, lit = (k * 3 + sy) % 4 !== 0; rect(g, lx - 6, sy - 24, 12, 22, INK); rect(g, lx - 4, sy - 22, 8, 18, lit ? M.amberL : '#4a4560'); rect(g, lx - 6, sy - 27, 12, 4, INK); }
      }
      // tally marks on the back wall (days kept)
      g.strokeStyle = 'rgba(240,230,210,0.55)'; g.lineWidth = 1;
      g.beginPath(); for (let r = 0; r < 4; r++) for (let k = 0; k < 18; k++) { const tx = x + 236 + (k % 6) * 13, ty = y - 176 + r * 15 + Math.floor(k / 6) * 0; if (k >= 6) continue; for (let m = 0; m < 4; m++) { g.moveTo(tx + m * 2.2, ty); g.lineTo(tx + m * 2.2, ty + 10); } g.moveTo(tx - 1, ty + 9); g.lineTo(tx + 9, ty + 1); } g.stroke();
      // blanket + cushion
      g.beginPath(); g.moveTo(x + 14, y); g.quadraticCurveTo(x + 60, y - 30, x + 120, y - 8); g.lineTo(x + 120, y); g.closePath(); ink(g, 2); g.fillStyle = '#4d6aa8'; g.fill();
      // open doors swung outward + frame
      rect(g, x, y - h, w, 8, '#8a3a2a'); rect(g, x, y - h, w, 2.5, '#d07a50');
      for (const [dx, dw] of [[x - 54, 50], [x + w + 4, 50]]) { rect(g, dx - 2, y - h - 2, dw + 4, h + 2, INK); rect(g, dx, y - h, dw, h, '#a2492f'); for (let k = dx + 6; k < dx + dw - 4; k += 8) rect(g, k, y - h + 8, 3, h - 16, '#d3734a'); rect(g, dx + dw - 6, y - h, 6, h, '#6a2a25'); }
      stencil(g, '叮叮的家', x + w + 29, y - h + 30, 13, 'rgba(255,240,215,0.95)');
      stencil(g, '請勿打擾 ♪', x + w + 29, y - h + 48, 9, 'rgba(255,240,215,0.85)', { ink: false, weight: 700 });
      void C;
    } });
    lamp(2560, -140); lamp(3300, -140); lamp(4700, -140); lamp(5650, -140, false); lamp(6560, -140);
    railing(2420, 7080, -146);
    // ---- Z2: the crane tower (secret route) — lattice rising to the cab at -1060
    objs.push({ x: 5180, y: -1320, w: 400, h: 1190, draw(g) {
      const C = deckC(tintAt(5300)), S = { body: mixH(M.hazard, C.steel, 0.5), dark: mixH(M.hazard, C.steelD, 0.72), lit: mixH(M.hazard, P('rim', 0.2), 0.35) };
      lattice(g, 5300, -1200, -140, 70, S);
      girder(g, 5280, 5440, -1220, 22, S);
      rect(g, 5355, -1300, 6, 80, INK); aviationLight(g, 5358, -1304, M.red, 3);
      // ladder lights (blink handled per frame for the lowest two)
      for (const ly of [-420, -620, -880]) { rect(g, 5296, ly, 8, 5, INK); rect(g, 5297, ly + 1, 6, 3, M.amber); }
    } });
    // ---- Z3: cableway stations A and B (bull wheels animated in drawBack)
    const station = (x0, x1, wheelX, label, en) => objs.push({ x: x0 - 40, y: -640, w: x1 - x0 + 80, h: 650, draw(g) {
      const t = tintAt(wheelX), C = deckC(t), S = { body: C.steel, lit: C.steelL, dark: C.steelD };
      for (const px of [x0, x1 - 26]) { lattice(g, px, -540, -140, 26, S); }
      girder(g, x0 - 20, x1 + 20, -560, 26, S);
      poly(g, [[x0 - 40, -560], [(x0 + x1) / 2, -620], [x1 + 40, -560]]); ink(g, 4); g.fillStyle = mixH(M.enamel, C.body, 0.4); g.fill();
      rect(g, (x0 + x1) / 2 - 2, -620, 3, 60, rgba(INK, 0.6));
      rect(g, wheelX - 8, -534, 16, 70, INK); rect(g, wheelX - 5, -534, 10, 70, C.steel);
      // sign board
      const sx = (x0 + x1) / 2 - (wheelX > (x0 + x1) / 2 ? 90 : -90);
      rect(g, sx - 92, -520, 184, 50, INK); rect(g, sx - 89, -517, 178, 44, '#173a52');
      stencil(g, label, sx, -503, 17, '#bff6ff', { ink: false });
      stencil(g, en, sx, -484, 9, '#7fd8e8', { ink: false, weight: 700, font: 'Rajdhani, sans-serif' });
    } });
    station(6740, 7230, CAB.ca, '極光斷口纜車站', 'AURORA GAP CABLEWAY — STATION A');
    station(8640, 9060, CAB.cb, '上環纜車站', 'STATION B — STORM RING');
    // haul + return cables across the gap (the car rides the lower one)
    objs.push({ x: CAB.ca - 20, y: -560, w: CAB.cb - CAB.ca + 40, h: 200, draw(g) {
      for (const [dy, w2] of [[0, 3.2], [-34, 2.4]]) {
        g.beginPath();
        for (let x = CAB.ca; x <= CAB.cb; x += 20) { const y = cableY(x) + dy; if (x === CAB.ca) g.moveTo(x, y); else g.lineTo(x, y); }
        g.strokeStyle = INK; g.lineWidth = w2 + 2; g.stroke(); g.strokeStyle = '#4a5784'; g.lineWidth = w2 - 0.8; g.stroke();
      }
    } });
    lamp(6790, -140); lamp(9180, -140);
    // ---- underdeck: pipes and a warning board
    objs.push({ x: 7100, y: 120, w: 1800, h: 220, draw(g) {
      const C = deckC(0.35);
      girder(g, 7100, 8900, 150, 16, { body: C.steel, lit: C.steelL, dark: C.steelD }, { holes: false });
      g.strokeStyle = INK; g.lineWidth = 9; g.beginPath(); g.moveTo(7100, 210); g.lineTo(8900, 210); g.stroke(); g.strokeStyle = '#4b6a7a'; g.lineWidth = 5; g.stroke(); g.strokeStyle = 'rgba(200,240,255,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(7100, 208); g.lineTo(8900, 208); g.stroke();
      rect(g, 7690, 236, 170, 46, INK); rect(g, 7693, 239, 164, 40, M.hazard);
      stencil(g, '維修甲板・禁止進入', 7775, 252, 13, '#1b1530', { ink: false });
      stencil(g, 'SERVICE DECK — NO ENTRY', 7775, 268, 9, '#1b1530', { ink: false, weight: 700, font: 'Rajdhani, sans-serif' });
    } });
    // ---- Z4: storm ring — lightning rods, railings, Vela's watch perch
    railing(8920, 9490, -146); railing(9520, 13580, -6);
    for (const rx of [9150, 10520, 11320, 12100]) objs.push({ x: rx - 40, y: -560, w: 80, h: 570, draw(g) {
      const C = deckC(tintAt(rx)), base = rx < 9500 ? -140 : 0;
      rect(g, rx - 5, base - 400, 10, 400, INK); rect(g, rx - 3, base - 400, 5, 400, C.steel); rect(g, rx + 1, base - 400, 1.5, 400, C.steelL);
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(rx, base - 120 - k * 90); g.lineTo(rx - 30, base - 60 - k * 90); g.moveTo(rx, base - 120 - k * 90); g.lineTo(rx + 30, base - 60 - k * 90); ink(g, 2.5); }
      poly(g, [[rx - 4, base - 400], [rx, base - 430], [rx + 4, base - 400]]); ink(g, 2); g.fillStyle = '#e0c8ff'; g.fill();
      rect(g, rx - 12, base - 16, 24, 16, INK); rect(g, rx - 10, base - 14, 20, 12, C.steel);
    } });
    objs.push({ x: 11380, y: -520, w: 300, h: 530, draw(g) {
      const C = deckC(tintAt(11500)), S = { body: C.steel, lit: C.steelL, dark: C.steelD };
      lattice(g, 11420, -380, 0, 22, S); lattice(g, 11600, -380, 0, 22, S);
      girder(g, 11400, 11640, -392, 14, S);
      g.beginPath(); g.moveTo(11410, -392); g.lineTo(11450, -460); g.quadraticCurveTo(11530, -440, 11630, -470); g.lineTo(11640, -392); g.closePath(); ink(g, 3); g.fillStyle = '#3d4a3a'; g.fill();
      g.strokeStyle = rgba('#b9f5a0', 0.35); g.lineWidth = 1; g.beginPath(); g.moveTo(11455, -455); g.quadraticCurveTo(11530, -438, 11625, -462); g.stroke();
      rect(g, 11440, -420, 40, 26, INK); rect(g, 11442, -418, 36, 22, '#2b2f3a');
      stencil(g, '瞭望哨 V', 11525, -405, 12, 'rgba(220,255,210,0.7)', { ink: false });
    } });
    // ---- Z5: the Unmoored Deck — winch drum, bollards, cut mooring arms, Descent V emblem
    objs.push({ x: 12100, y: -40, w: 1500, h: 60, draw(g) {
      // painted landing circle + "V" (deck marking)
      g.save(); g.translate(12850, 4); g.scale(1, 0.12);
      g.beginPath(); g.arc(0, 0, 420, 0, TAU); g.strokeStyle = rgba('#e0a8ff', 0.5); g.lineWidth = 26; g.stroke();
      g.beginPath(); g.arc(0, 0, 380, 0, TAU); g.strokeStyle = rgba('#ffffff', 0.25); g.lineWidth = 6; g.stroke();
      g.restore();
      stencil(g, 'V', 12850, 6, 14, 'rgba(255,255,255,0.4)', { ink: false });
    } });
    objs.push({ x: 13150, y: -900, w: 560, h: 910, draw(g) {
      const C = deckC(1), S = { body: C.steel, lit: C.steelL, dark: C.steelD };
      // winch housing
      block(g, 13300, -330, 360, 330, S);
      for (let y = -300; y < 0; y += 40) rect(g, 13300, y, 360, 2, rgba(INK, 0.6));
      // drum with chain wraps
      g.beginPath(); g.ellipse(13420, -230, 120, 120, 0, 0, TAU); ink(g, 6); g.fillStyle = C.steelD; g.fill();
      g.beginPath(); g.ellipse(13420, -230, 96, 96, 0, 0, TAU); g.fillStyle = C.steel; g.fill();
      g.strokeStyle = C.steelL; g.lineWidth = 2; for (let r = 40; r < 96; r += 14) { g.beginPath(); g.arc(13420, -230, r, -1.2, 0.4); g.stroke(); }
      g.beginPath(); g.arc(13420, -230, 18, 0, TAU); g.fillStyle = INK; g.fill();
      // chains leaving the drum, rising to the sky (towards the Ark)
      for (const [ox, ang] of [[-60, -2.05], [-20, -1.9]]) {
        for (let i = 0; i < 26; i++) {
          const px = 13420 + ox + Math.cos(ang) * i * 26, py = -330 + Math.sin(ang) * i * 26;
          g.save(); g.translate(px, py); g.rotate(ang);
          g.beginPath(); if (i % 2) g.ellipse(0, 0, 15, 3.5, 0, 0, TAU); else g.ellipse(0, 0, 15, 8, 0, 0, TAU);
          g.strokeStyle = INK; g.lineWidth = 7; g.stroke(); g.strokeStyle = i % 2 ? C.steelD : '#5d6a96'; g.lineWidth = 3.5; g.stroke();
          g.restore();
        }
      }
      stencil(g, '錨鏈絞盤 — 第五降臨隊', 13480, -60, 15, 'rgba(230,220,255,0.75)', { ink: false });
    } });
    for (const bx of [12260, 12620, 13050]) objs.push({ x: bx - 30, y: -60, w: 60, h: 66, draw(g) {
      const C = deckC(1);
      g.beginPath(); g.moveTo(bx - 18, 0); g.lineTo(bx - 14, -40); g.quadraticCurveTo(bx, -52, bx + 14, -40); g.lineTo(bx + 18, 0); g.closePath(); ink(g, 3); g.fillStyle = C.steel; g.fill();
      rect(g, bx - 22, -46, 44, 8, INK); rect(g, bx - 20, -44, 40, 4, C.steelL); rect(g, bx + 6, -36, 4, 34, rgba('#ffffff', 0.18));
      // snapped mooring cable coiled at the bollard
      g.beginPath(); g.ellipse(bx + 34, -4, 22, 6, 0, 0, TAU); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); g.strokeStyle = '#7b6b5a'; g.lineWidth = 2; g.stroke();
    } });
    lamp(12000, 0); lamp(13500, 0);
    return objs;
  }

  /* =========================================================================================
     SKY (screen space, per frame) — stars, the dead planet's limb, aurora, the Ark, lightning
     ========================================================================================= */
  const SKY = { stars: null, aurA: null, aurB: null, ark: null, tw: null, bolt: null, flash: 0, nextStrike: 4 };
  function buildStars() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d'), rng = U.mulberry32(9050);
    for (let i = 0; i < 80; i++) {
      const u = rng(), x = u * 1024, y = 360 - u * 280 + (rng() - 0.5) * 110, r = 30 + rng() * 80;
      for (const ox of [-1024, 0, 1024]) { const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, r); gr.addColorStop(0, `rgba(150,170,255,${0.04 + rng() * 0.045})`); gr.addColorStop(1, 'rgba(150,170,255,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y - r, r * 2, r * 2); }
    }
    for (let i = 0; i < 1100; i++) {
      const x = rng() * 1024, y = rng() * 512, m = rng(), s = m < 0.92 ? 0.6 + rng() * 0.8 : 1.4 + rng() * 1.3;
      const col = rng() < 0.2 ? '255,220,190' : rng() < 0.45 ? '190,220,255' : '255,255,255';
      g.fillStyle = `rgba(${col},${0.3 + rng() * 0.65})`; g.fillRect(x, y, s, s);
      if (m > 0.988) { g.fillStyle = `rgba(${col},0.5)`; g.fillRect(x - 3, y + s / 2 - 0.4, 6 + s, 0.8); g.fillRect(x + s / 2 - 0.4, y - 3, 0.8, 6 + s); }
    }
    return c;
  }
  function buildAurora(cA, cB, seed) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 320;
    const g = c.getContext('2d');
    const per = (x, k, ph) => Math.sin((x / 1024) * TAU * k + ph);
    for (let x = 0; x < 1024; x += 2) {
      const hem = 250 + 30 * per(x, 2, seed) + 16 * per(x, 5, seed * 2.1) + 7 * per(x, 11, seed * 3.3);
      const len = 140 + 80 * (0.5 + 0.5 * per(x, 3, seed * 1.7));
      const a = 0.18 + 0.4 * Math.pow(0.5 + 0.5 * per(x, 7, seed * 0.6), 2) + 0.3 * Math.pow(0.5 + 0.5 * per(x, 23, seed), 6);
      const gr = g.createLinearGradient(0, hem - len, 0, hem + 6);
      gr.addColorStop(0, rgba(cB, 0)); gr.addColorStop(0.5, rgba(cB, a * 0.3)); gr.addColorStop(0.88, rgba(cA, a * 0.85)); gr.addColorStop(0.94, rgba('#eafff6', a * 0.6)); gr.addColorStop(1, rgba(cA, 0));
      g.fillStyle = gr; g.fillRect(x, hem - len, 2, len + 6);
    }
    return c;
  }
  function buildArk() {
    const W = 1600, H = 600, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), rng = U.mulberry32(7701), cx = W / 2;
    const body = '#2b3358', lit = '#8ea3d4', rim = '#d8ecff', shade = '#151a33', belly = '#1d2342';
    // hull silhouette: a long cathedral-ship seen from below and in front
    const hull = [[60, 300], [180, 236], [420, 214], [640, 186], [760, 150], [840, 150], [960, 186], [1180, 214], [1420, 236], [1540, 300], [1420, 352], [1160, 384], [900, 404], [700, 404], [440, 384], [180, 352]];
    poly(g, hull); g.strokeStyle = INK; g.lineWidth = 10; g.lineJoin = 'round'; g.stroke(); g.fillStyle = body; g.fill();
    g.save(); poly(g, hull); g.clip();
    rect(g, 0, 300, W, 200, belly);
    g.beginPath(); g.moveTo(0, 300); for (let x = 0; x <= W; x += 40) g.lineTo(x, 300 + 8 * Math.sin(x * 0.02)); g.lineTo(W, 0); g.lineTo(0, 0); g.closePath(); g.fillStyle = body; g.fill();
    g.fillStyle = lit; g.beginPath(); g.moveTo(800, 150); g.lineTo(1540, 300); g.lineTo(1540, 240); g.lineTo(840, 140); g.closePath(); g.fill();
    rect(g, 0, 140, W, 14, rgba(rim, 0.35));
    // panel lines + window rows (warm and cold — the lights are still on)
    g.strokeStyle = rgba(INK, 0.6); g.lineWidth = 2;
    for (let x = 120; x < W - 80; x += 60) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x + (x - cx) * 0.05, 420); g.stroke(); }
    for (let r = 0; r < 7; r++) {
      const y = 230 + r * 22;
      for (let x = 100; x < W - 100; x += 9) {
        if (rng() < 0.42) continue;
        g.fillStyle = rng() < 0.6 ? `rgba(255,214,140,${0.55 + rng() * 0.45})` : `rgba(190,232,255,${0.5 + rng() * 0.4})`;
        g.fillRect(x, y + Math.abs(x - cx) * 0.06 * (r < 3 ? -1 : 1) * 0.3, 4, 3);
      }
    }
    g.restore();
    // spires along the spine (the Cantata: an organ of a ship)
    for (let k = 0; k < 15; k++) {
      const x = 260 + k * 76, hgt = 40 + (k === 7 ? 120 : (7 - Math.abs(k - 7)) * 12) + rng() * 20, base = 214 - (7 - Math.abs(k - 7)) * 8;
      poly(g, [[x - 10, base + 6], [x - 6, base - hgt * 0.7], [x, base - hgt], [x + 6, base - hgt * 0.7], [x + 10, base + 6]]);
      g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); g.fillStyle = k > 7 ? lit : body; g.fill();
      g.fillStyle = 'rgba(255,220,160,0.9)'; g.fillRect(x - 1.5, base - hgt * 0.5, 3, 4);
    }
    // the habitat ring, edge-on around the middle
    g.beginPath(); g.ellipse(cx, 290, 90, 270, 0, 0, TAU); g.strokeStyle = INK; g.lineWidth = 30; g.stroke(); g.strokeStyle = shade; g.lineWidth = 22; g.stroke();
    g.beginPath(); g.ellipse(cx, 290, 90, 270, 0, -PI / 2, PI / 2); g.strokeStyle = lit; g.lineWidth = 8; g.stroke();
    for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; g.fillStyle = 'rgba(255,214,140,0.95)'; g.fillRect(cx + Math.cos(a) * 90 - 2, 290 + Math.sin(a) * 270 - 2, 4, 4); }
    // docking collar where the Ladder plugs in
    poly(g, [[cx - 70, 404], [cx + 70, 404], [cx + 26, 560], [cx - 26, 560]]); g.strokeStyle = INK; g.lineWidth = 6; g.stroke(); g.fillStyle = shade; g.fill();
    rect(g, cx + 6, 410, 10, 150, rgba(lit, 0.5));
    // navigation lights
    for (const [x, y, col] of [[70, 300, '#ff4d5e'], [1530, 300, '#5dff9c'], [cx, 140, '#ffffff']]) { const gr = g.createRadialGradient(x, y, 0, x, y, 30); gr.addColorStop(0, rgba(col, 0.8)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(x - 30, y - 30, 60, 60); }
    return c;
  }
  const skyInit = () => {
    if (SKY.stars) return;
    SKY.stars = buildStars();
    SKY.aurA = buildAurora('#5dffb0', '#6c7bff', 1.3);
    SKY.aurB = buildAurora('#d27bff', '#4fd1ff', 2.7);
    SKY.ark = buildArk();
    const r = U.mulberry32(42); SKY.tw = Array.from({ length: 26 }, () => ({ x: r(), y: r() * 0.55, p: r() * 10, s: 1 + r() * 1.6 }));
    const hc = document.createElement('canvas'); hc.width = hc.height = 64;
    const hg = hc.getContext('2d'), gr = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(M.hush, 1)); gr.addColorStop(1, rgba(M.hush, 0)); hg.fillStyle = gr; hg.fillRect(0, 0, 64, 64);
    SKY.hushDot = hc;
  };
  function drawSky(ctx, cam, W, H, S, time) {
    skyInit();
    const t = tintAt(cam.x), st = stormAt(cam.x), gp = gapAt(cam.x);
    const horizonY = H / 2 + (60 - cam.y * 0.03) * S;
    const gr = ctx.createLinearGradient(0, 0, 0, horizonY + 20 * S);
    gr.addColorStop(0, P('skyTop', t)); gr.addColorStop(0.5, P('skyMid', t)); gr.addColorStop(0.86, P('skyLow', t)); gr.addColorStop(1, P('horizon', t));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // stars
    const sS = S * 0.95, iw = 1024 * sS;
    let ox = -(((cam.x * 0.006 + time * 0.4) * S) % iw); if (ox > 0) ox -= iw;
    ctx.globalAlpha = 0.9 - st * 0.45;
    for (let x = ox; x < W; x += iw) ctx.drawImage(SKY.stars, x, -cam.y * 0.01 * S - 20 * S, iw + 1, 512 * sS);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    for (const s of SKY.tw) { const a = 0.35 + 0.65 * Math.max(0, Math.sin(time * 1.7 + s.p)); ctx.globalAlpha = a * (1 - st * 0.5); const px = ((s.x * W * 1.3 - cam.x * 0.006 * S) % W + W) % W; ctx.fillRect(px, s.y * H, s.s * S, s.s * S); ctx.fillRect(px - 2 * S, s.y * H + s.s * S * 0.4, (4 + s.s) * S, 0.6 * S); }
    ctx.globalAlpha = 1;
    // the Ark, plugged onto the top of the Ladder: nearer and larger the higher we climb
    const f = 0.08, Sl = S / cam.zoom * (1 + (cam.zoom - 1) * f);
    const tsx = W / 2 + (TETHER_FAR_X - cam.x * f) * Sl;
    const pr = clamp((cam.x - 200) / 12600, 0, 1), k = pr * pr;
    const aw = W * (0.34 + 1.55 * k), ah = aw * (600 / 1600), by = H * (0.13 + 0.25 * k) - cam.y * 0.012 * S;
    const flick = SKY.flash > 0 ? 0.85 + 0.15 * Math.sin(time * 60) : 1;
    ctx.globalAlpha = (0.5 + 0.5 * pr) * flick;
    ctx.drawImage(SKY.ark, tsx - aw / 2, by - ah * (560 / 600), aw, ah);
    ctx.globalAlpha = 1;
    // aurora curtains (green → violet with the storm)
    ctx.globalCompositeOperation = 'lighter';
    const aBoost = 0.55 + gp * 0.4 - st * 0.15;
    for (const [img, par, drift, yk, sc, al] of [[SKY.aurA, 0.012, 6, 0.04, 1.5, 1 - t], [SKY.aurB, 0.02, -4, 0.12, 1.25, 0.35 + t * 0.65], [SKY.aurA, 0.03, 9, 0.2, 1.1, (1 - t) * 0.5]]) {
      if (al < 0.03 || (par === 0.03 && G.Quality.low)) continue;
      const w = 1024 * sc * S, h = 320 * sc * S * (0.92 + 0.08 * Math.sin(time * 0.3 + par * 90));
      let x0 = -(((cam.x * par + time * drift) * S) % w); if (x0 > 0) x0 -= w;
      ctx.globalAlpha = al * aBoost * (0.8 + 0.2 * Math.sin(time * 0.5 + par * 50));
      for (let x = x0; x < W; x += w) ctx.drawImage(img, x, H * yk - cam.y * 0.02 * S, w + 1, h);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // the dead planet's limb: a dark curve with a thin airglow (the Hush glows faintly pink on the night side)
    const R = W * 2.2, pcx = W / 2 + (TETHER_FAR_X * 0.2 - cam.x * 0.0035) * S, pcy = horizonY - 6 * S + R;
    const pg = ctx.createLinearGradient(0, horizonY - 8 * S, 0, horizonY + 90 * S);
    pg.addColorStop(0, mixH(P('horizon', t), '#ffffff', 0.25)); pg.addColorStop(0.05, mixH(P('horizon', t), P('skyLow', t), 0.4)); pg.addColorStop(0.35, mixH(P('skyLow', t), P('skyTop', t), 0.6)); pg.addColorStop(1, P('skyTop', t));
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(pcx, pcy, R, 0, TAU); ctx.fill();
    const ag = ctx.createRadialGradient(pcx, pcy, R, pcx, pcy, R + 46 * S);
    ag.addColorStop(0, rgba(P('horizon', t), 0.45)); ag.addColorStop(1, rgba(P('horizon', t), 0));
    ctx.fillStyle = ag; ctx.fillRect(0, horizonY - 60 * S, W, 70 * S);
    ctx.strokeStyle = rgba('#eafff7', 0.65); ctx.lineWidth = 1.4 * S; ctx.beginPath(); ctx.arc(pcx, pcy, R, PI * 1.2, PI * 1.8); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { const u = U.noise1(i * 3.7, 4), hx = ((u * W * 1.6 - cam.x * 0.01 * S) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3, hy = horizonY + (8 + i * 4) * S; const hr = (6 + (i % 3) * 4) * S; ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time + i); ctx.drawImage(SKY.hushDot, hx - hr * 3, hy - hr * 3, hr * 6, hr * 6); }
    ctx.globalAlpha = 1;
    // lightning (storm ring)
    if (SKY.bolt && SKY.bolt.t < 0.28) {
      const b = SKY.bolt, a = 1 - b.t / 0.28;
      ctx.strokeStyle = `rgba(230,210,255,${a * 0.35})`; ctx.lineWidth = 7 * S; ctx.lineJoin = 'round';
      ctx.beginPath(); b.pts.forEach(([px, py], i) => { const X = px * W, Y = py * horizonY; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.8 * S; ctx.stroke();
      ctx.fillStyle = `rgba(180,150,255,${a * 0.12})`; ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
    return true;
  }

  /* =========================================================================================
     LIVE ATMOSPHERE (screen space) + FOREGROUND + animated world bits
     ========================================================================================= */
  const ATM = (() => { const r = U.mulberry32(5150); return { motes: Array.from({ length: 90 }, () => ({ x: r(), y: r(), z: 0.4 + r() * 1.3, s: 0.6 + r() * 1.6, p: r() * 10 })) }; })();
  function drawAtmos(ctx, cam, W, H, S, time) {
    const g = G.game, st = stormAt(cam.x), low = G.Quality.low;
    const n = Math.floor((low ? 34 : 70) + st * (low ? 16 : 20));
    const wind = 40 + st * 260;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = st > 0.5 ? '#dccdff' : '#c8faf0';
    for (let i = 0; i < n; i++) {
      const m = ATM.motes[i];
      const px = ((m.x * W * 1.4 - cam.x * m.z * S * 0.7 - time * wind * m.z * S) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
      const py = ((m.y * H + time * (14 + st * 40) * m.z * S - cam.y * m.z * S * 0.4 + Math.sin(time * 0.8 + m.p) * 10 * S) % H + H) % H;
      ctx.globalAlpha = (0.25 + 0.25 * Math.sin(time * 1.6 + m.p)) * (m.z > 1 ? 0.75 : 0.5);
      const r = m.s * S * m.z;
      if (st > 0.3) ctx.fillRect(px, py, r * (1 + st * 7), Math.max(0.6, r * 0.5)); else ctx.fillRect(px, py, r, r);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (SKY.flash > 0.01 && g.settings.flashes) { ctx.fillStyle = `rgba(210,190,255,${SKY.flash * 0.16})`; ctx.fillRect(0, 0, W, H); }
    return true;
  }
  function drawForeground(ctx, cam, S, game) {
    const f = 1.35, span = 1300, gp = gapAt(cam.x);
    if (gp > 0.7) return true;
    const base = Math.floor((cam.x * f - 1300) / span);
    const t = tintAt(cam.x), rim = P('rim', t);
    for (let i = base; i < base + 4; i++) {
      const rng = U.mulberry32(i * 911 + 5);
      if (rng() < 0.4) continue;
      const x = cam.x + (i * span + rng() * 500 - cam.x * f);
      const kind = rng();
      ctx.save(); ctx.globalAlpha = 1 - gp;
      if (kind < 0.55) {
        // a girder crossing near the top of frame, rivets catching the aurora
        const top = cam.y - 330 - rng() * 40, wdt = 500 + rng() * 300;
        ctx.fillStyle = 'rgba(5,7,16,0.94)'; ctx.fillRect(x - wdt / 2, top, wdt, 30);
        ctx.fillStyle = rgba(rim, 0.35); ctx.fillRect(x - wdt / 2, top + 30, wdt, 1.5);
        ctx.fillStyle = 'rgba(5,7,16,0.94)'; ctx.fillRect(x - 20, top - 200, 40, 200);
        ctx.strokeStyle = 'rgba(5,7,16,0.9)'; ctx.lineWidth = 2;
        const sway = Math.sin(game.realTime * 0.9 + i) * 6;
        ctx.beginPath(); ctx.moveTo(x + 60, top + 30); ctx.quadraticCurveTo(x + 64 + sway, top + 120, x + 70 + sway * 1.4, top + 170); ctx.stroke();
        ctx.fillRect(x + 62 + sway * 1.4, top + 170, 16, 10);
      } else {
        // railing posts + a coil of cable rising from the bottom
        const gy = cam.y + 300;
        ctx.fillStyle = 'rgba(5,7,16,0.95)';
        for (let k = 0; k < 4; k++) ctx.fillRect(x - 120 + k * 80, gy - 120, 12, 200);
        ctx.fillRect(x - 130, gy - 124, 330, 10);
        ctx.fillStyle = rgba(rim, 0.3); ctx.fillRect(x - 130, gy - 125, 330, 1.2);
      }
      ctx.restore();
    }
    return true;
  }

  // gondola, beacon beam, blinking lights (world space, per frame)
  const GON = { x: GD.a, state: 'A', armed: true, standT: 0, recallT: 0, from: GD.a, to: GD.a, t: 0, dur: 10, wheel: 0, rides: 0, barks: 0, idleT: 0 };
  const gondCenter = () => GON.x + GD.w / 2;
  const gondFloor = () => cableY(gondCenter()) + 290;
  function drawGondola(ctx, game) {
    const cx = gondCenter(), fy = gondFloor(), cy = cableY(cx), t = tintAt(cx), C = deckC(t), rim = P('rim', t);
    const x = GON.x, w = GD.w, sway = GON.state === 'move' ? Math.sin(game.realTime * 2.2) * 0.012 : Math.sin(game.realTime * 1.1) * 0.004;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(sway); ctx.translate(-cx, -cy);
    // grip on the haul cable + hanger arm
    ctx.fillStyle = INK; ctx.fillRect(cx - 22, cy - 8, 44, 16);
    ctx.fillStyle = C.steel; ctx.fillRect(cx - 20, cy - 6, 40, 12);
    ctx.beginPath(); ctx.arc(cx - 12, cy - 4, 6, 0, TAU); ctx.arc(cx + 12, cy - 4, 6, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(cx, cy + 6); ctx.lineTo(cx, fy - 150); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = C.steel; ctx.stroke();
    ctx.lineWidth = 1.4; ctx.strokeStyle = C.steelL; ctx.beginPath(); ctx.moveTo(cx + 2, cy + 6); ctx.lineTo(cx + 2, fy - 150); ctx.stroke();
    // cabin: roof, open sides with corner posts, floor (the floor is the solid)
    const roofY = fy - 150;
    ctx.beginPath(); ctx.moveTo(x - 6, roofY + 14); ctx.lineTo(x + 24, roofY - 6); ctx.lineTo(x + w - 24, roofY - 6); ctx.lineTo(x + w + 6, roofY + 14); ctx.closePath();
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = mixH(M.crate, C.body, 0.15); ctx.fill();
    ctx.fillStyle = mixH(M.crate, rim, 0.35); ctx.fillRect(x + 24, roofY - 6, w - 48, 3);
    ctx.fillStyle = INK; ctx.fillRect(x - 6, roofY + 12, w + 12, 6);
    for (const px of [x + 2, x + w - 10]) { ctx.fillStyle = INK; ctx.fillRect(px - 1.5, roofY + 14, 11, fy - roofY - 14); ctx.fillStyle = mixH(M.crate, C.body, 0.1); ctx.fillRect(px, roofY + 14, 8, fy - roofY - 14); ctx.fillStyle = mixH(M.crate, rim, 0.3); ctx.fillRect(px + 6, roofY + 14, 2, fy - roofY - 14); }
    // waist rail + window frame top
    ctx.fillStyle = INK; ctx.fillRect(x, fy - 52, w, 6); ctx.fillStyle = C.steelL; ctx.fillRect(x, fy - 51, w, 2);
    // floor slab with hazard lip
    ctx.fillStyle = INK; ctx.fillRect(x - 3, fy - 2, w + 6, 26);
    ctx.fillStyle = C.steel; ctx.fillRect(x, fy, w, 20);
    ctx.fillStyle = C.steelL; ctx.fillRect(x, fy, w, 2.5);
    ctx.fillStyle = M.hazard; ctx.fillRect(x, fy + 14, w, 5); ctx.fillStyle = INK; for (let k = x; k < x + w; k += 14) ctx.fillRect(k, fy + 14, 6, 5);
    ctx.font = '700 11px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,240,220,0.9)'; ctx.fillText('CAR 02 · 極光斷口', cx, fy - 128);
    // cabin lamp
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(cx, roofY + 24, 0, cx, roofY + 24, 110); lg.addColorStop(0, 'rgba(255,200,130,0.35)'); lg.addColorStop(1, 'rgba(255,200,130,0)');
    ctx.fillStyle = lg; ctx.fillRect(cx - 110, roofY - 86, 220, 220);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
  function drawWheel(ctx, x, y, ang, C) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.arc(0, 0, 54, 0, TAU); ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = C.steel; ctx.stroke();
    ctx.rotate(ang); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 50, Math.sin(a) * 50); } ctx.stroke();
    ctx.lineWidth = 1.6; ctx.strokeStyle = C.steelL; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fillStyle = INK; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fillStyle = M.hazard; ctx.fill();
    ctx.restore();
  }
  const BLINKS = [[-200, -300], [1273, -862], [5358, -1304], [2867 / 0.22, 0], [CAB.ca, -630], [CAB.cb, -630]].filter((b) => b[1] !== 0);
  function drawBack(ctx, game) {
    const cam = game.cam, t = game.realTime, vx0 = cam.x - 900, vx1 = cam.x + 900;
    // beacon mast lamp: a slow sweeping beam (Z1)
    if (vx0 < 1700 && vx1 > 800) {
      const bx = 1273, by = -790, a = Math.sin(t * 0.45) * 0.9 + PI;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const len = 1100, sp = 0.09, gr = ctx.createRadialGradient(bx, by, 0, bx, by, len);
      gr.addColorStop(0, 'rgba(255,226,170,0.35)'); gr.addColorStop(1, 'rgba(255,226,170,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - sp) * len, by + Math.sin(a - sp) * len * 0.5); ctx.lineTo(bx + Math.cos(a + sp) * len, by + Math.sin(a + sp) * len * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,190,0.9)'; ctx.beginPath(); ctx.arc(bx, by, 9 + Math.sin(t * 3) * 1.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // blinking aviation lights
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [x, y] of BLINKS) {
      if (x < vx0 || x > vx1) continue;
      const on = (t * 0.9 + x * 0.001) % 1 < 0.18;
      if (!on) continue;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, 40); gr.addColorStop(0, 'rgba(255,90,100,0.75)'); gr.addColorStop(1, 'rgba(255,90,100,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - 40, y - 40, 80, 80);
    }
    // crane ladder lamps flicker (hint at the secret route)
    if (vx0 < 5600 && vx1 > 5000) for (const [i, ly] of [[0, -418], [1, -618], [2, -878]]) { const a = 0.4 + 0.4 * Math.max(0, Math.sin(t * 2 + i * 1.3)); const gr = ctx.createRadialGradient(5300, ly, 0, 5300, ly, 46); gr.addColorStop(0, `rgba(255,184,92,${a})`); gr.addColorStop(1, 'rgba(255,184,92,0)'); ctx.fillStyle = gr; ctx.fillRect(5254, ly - 46, 92, 92); }
    ctx.restore();
    // the cable car + its bull wheels
    if (vx1 > CAB.ca - 400 && vx0 < CAB.cb + 400) {
      const C = deckC(tintAt(cam.x));
      drawWheel(ctx, CAB.ca, -470, GON.wheel, C); drawWheel(ctx, CAB.cb, -470, -GON.wheel, C);
      drawGondola(ctx, game);
    }
    // storm ring: lightning rods flare on a strike
    if (SKY.flash > 0.05 && stormAt(cam.x) > 0.3) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const rx of [9150, 10520, 11320, 12100]) {
        if (rx < vx0 || rx > vx1) continue;
        const ry = (rx < 9500 ? -140 : 0) - 430, gr = ctx.createRadialGradient(rx, ry, 0, rx, ry, 70);
        gr.addColorStop(0, `rgba(230,210,255,${SKY.flash})`); gr.addColorStop(1, 'rgba(230,210,255,0)'); ctx.fillStyle = gr; ctx.fillRect(rx - 70, ry - 70, 140, 140);
      }
      ctx.restore();
    }
  }
  // wind ribbons in the storm ring + cloud wisps sliding past the cable car
  function drawFront(ctx, game) {
    const cam = game.cam, t = game.realTime, st = stormAt(cam.x), gp = gapAt(cam.x);
    if (st < 0.2 && gp < 0.2) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const n = G.Quality.low ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const ph = (t * (0.35 + i * 0.07) + i * 0.37) % 1, x = cam.x + 700 - ph * 1600, y = cam.y - 220 + ((i * 97) % 420);
      const a = Math.sin(ph * PI) * (0.18 + st * 0.2);
      ctx.strokeStyle = st > 0.5 ? `rgba(225,210,255,${a})` : `rgba(210,255,240,${a})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - 60, y - 14, x - 120, y + 14, x - 200, y - 4 + Math.sin(t + i) * 6); ctx.stroke();
    }
    if (gp > 0.3 && GON.state === 'move') {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.12 + i / 3) % 1, x = cam.x + 900 - ph * 1800, y = cam.y + 140 + i * 60;
        const wg = ctx.createRadialGradient(x, y, 0, x, y, 220); wg.addColorStop(0, `rgba(200,230,255,${0.08 * Math.sin(ph * PI)})`); wg.addColorStop(1, 'rgba(200,230,255,0)');
        ctx.fillStyle = wg; ctx.fillRect(x - 220, y - 220, 440, 440);
      }
    }
    ctx.restore();
  }

  /* =========================================================================================
     NPC: 叮叮 DINGDING — maintenance unit F-12 (kept the lamps lit for twenty years)
     ========================================================================================= */
  function drawDingding(ctx, x, y, t, look, ribbon, talk) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(4,6,18,0.4)'; ctx.beginPath(); ctx.ellipse(0, 1, 34, 5, 0, 0, TAU); ctx.fill();
    // the lantern he polishes, on the deck in front of him
    const lx = look * 40;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(lx, -18, 0, lx, -18, 90); lg.addColorStop(0, 'rgba(255,196,120,0.45)'); lg.addColorStop(1, 'rgba(255,196,120,0)'); ctx.fillStyle = lg; ctx.fillRect(lx - 90, -110, 180, 120);
    ctx.restore();
    ctx.fillStyle = INK; ctx.fillRect(lx - 9, -30, 18, 30); ctx.fillRect(lx - 11, -34, 22, 5);
    ctx.fillStyle = '#ffd890'; ctx.fillRect(lx - 6, -27, 12, 22); ctx.fillStyle = '#fff3d0'; ctx.fillRect(lx - 2, -24, 4, 14);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(lx, -38, 5, PI, 0); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.scale(look, 1);
    const bob = Math.sin(t * 2.4) * 1.2, pol = Math.sin(t * 6.2), blink = (t % 4.2) < 0.12;
    // safety tether (so he does not float away) to a deck clamp behind him
    ctx.beginPath(); ctx.moveTo(-14, -34 + bob); ctx.quadraticCurveTo(-40, -6, -54, -4);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#e8b13a'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(-62, -8, 14, 8); ctx.fillStyle = '#4a5784'; ctx.fillRect(-60, -6, 10, 5);
    // legs (back leg in shadow)
    const leg = (hx, fx, col, colL) => {
      ctx.beginPath(); ctx.moveTo(hx, -26 + bob); ctx.lineTo(hx - 5, -13); ctx.lineTo(fx, -3);
      ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 4.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(fx + 2, -2.5, 8, 3.5, 0, 0, TAU); ctx.fillStyle = INK; ctx.fill(); ctx.beginPath(); ctx.ellipse(fx + 2, -3.5, 6.2, 2.2, 0, 0, TAU); ctx.fillStyle = colL; ctx.fill();
    };
    leg(-8, -10, '#2c3554', '#4a5784'); leg(7, 10, '#3d4a74', '#6c7fb2');
    // barrel body: enamel with a chipped hazard band, cel-shaded (lit right, purple shadow left)
    const by = -30 + bob;
    ctx.beginPath(); ctx.moveTo(-18, by - 22); ctx.quadraticCurveTo(-21, by, -16, by + 8); ctx.lineTo(16, by + 8); ctx.quadraticCurveTo(21, by, 18, by - 22); ctx.quadraticCurveTo(0, by - 28, -18, by - 22); ctx.closePath();
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = M.enamel; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = M.enamelS; ctx.fillRect(-22, by - 30, 14, 40);
    ctx.fillStyle = M.enamelL; ctx.fillRect(12, by - 30, 8, 40);
    ctx.fillStyle = M.hazard; ctx.fillRect(-22, by - 6, 44, 7); ctx.fillStyle = INK; for (let k = -22; k < 22; k += 8) ctx.fillRect(k, by - 6, 3.5, 7);
    ctx.fillStyle = 'rgba(90,40,30,0.5)'; ctx.fillRect(-6, by - 18, 2, 11); ctx.fillRect(9, by - 20, 1.5, 8);
    ctx.restore();
    // chest display: a little heart that beats in cyan
    const hb = 0.6 + 0.4 * Math.max(0, Math.sin(t * 3.4));
    ctx.fillStyle = INK; ctx.fillRect(-1, by - 19, 13, 10); ctx.fillStyle = `rgba(127,244,255,${hb})`; ctx.font = '700 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥', 5.5, by - 11.5);
    // manipulator arm, polishing the lantern
    const sh = { x: 14, y: by - 12 }, el = { x: 30 + pol * 2, y: by - 2 + pol * 3 }, hd = { x: 38 + pol * 4, y: by + 4 + pol * 4 };
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(el.x, el.y); ctx.lineTo(hd.x, hd.y); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#4a5784'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(el.x, el.y, 3.2, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.moveTo(hd.x - 3, hd.y - 2); ctx.quadraticCurveTo(hd.x + 6, hd.y + 2, hd.x + 2, hd.y + 9); ctx.lineTo(hd.x - 5, hd.y + 5); ctx.closePath(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#e8e0cc'; ctx.fill();
    // neck + dome head with one big amber lens
    const hx = 2 + Math.sin(t * 0.7) * 1.5, hy = by - 38 + Math.sin(t * 1.3 + 1) * 0.8 + (talk ? Math.sin(t * 18) * 0.8 : 0);
    ctx.fillStyle = INK; ctx.fillRect(-3, by - 30, 8, 8); ctx.fillStyle = '#4a5784'; ctx.fillRect(-1.5, by - 29, 5, 7);
    ctx.beginPath(); ctx.arc(hx, hy, 14, PI * 0.95, PI * 2.05); ctx.lineTo(hx + 14, hy + 6); ctx.lineTo(hx - 14, hy + 6); ctx.closePath();
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#c9d2e6'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = '#8890b8'; ctx.fillRect(hx - 16, hy - 16, 9, 24); ctx.fillStyle = '#ffffff'; ctx.fillRect(hx + 8, hy - 14, 4, 18); ctx.restore();
    ctx.fillStyle = INK; ctx.fillRect(hx - 15, hy + 4, 30, 4);
    // lens
    ctx.beginPath(); ctx.arc(hx + 6, hy - 2, 7.5, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    if (!blink) {
      const lgl = ctx.createRadialGradient(hx + 7, hy - 3, 0, hx + 7, hy - 3, 7); lgl.addColorStop(0, '#fff2c8'); lgl.addColorStop(0.45, '#ffc86b'); lgl.addColorStop(1, '#a8601c');
      ctx.beginPath(); ctx.arc(hx + 6, hy - 2, 5.6, 0, TAU); ctx.fillStyle = lgl; ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(hx + 7.5, hy - 2, 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(hx + 4, hy - 6, 2, 2);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const eg = ctx.createRadialGradient(hx + 6, hy - 2, 0, hx + 6, hy - 2, 22); eg.addColorStop(0, 'rgba(255,200,107,0.35)'); eg.addColorStop(1, 'rgba(255,200,107,0)'); ctx.fillStyle = eg; ctx.fillRect(hx - 16, hy - 24, 44, 44); ctx.restore();
    } else { ctx.fillStyle = '#ffc86b'; ctx.fillRect(hx + 1, hy - 2.5, 10, 1.5); }
    // antenna with a tiny brass bell (and the red ribbon, once returned)
    const ax = hx - 5, ay = hy - 13, tipX = ax - 6 + Math.sin(t * 2.1) * 2.5, tipY = ay - 26;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(ax - 2, ay - 14, tipX, tipY); ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke(); ctx.strokeStyle = '#9aa6c4'; ctx.lineWidth = 1.2; ctx.stroke();
    const sw = Math.sin(t * 3.1) * 0.35;
    ctx.save(); ctx.translate(tipX, tipY); ctx.rotate(sw);
    ctx.beginPath(); ctx.moveTo(-4, 6); ctx.quadraticCurveTo(-4.5, -1, 0, -2); ctx.quadraticCurveTo(4.5, -1, 4, 6); ctx.closePath(); ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#e8b13a'; ctx.fill();
    ctx.fillStyle = '#fff1b8'; ctx.fillRect(1, -0.5, 1.4, 4); ctx.beginPath(); ctx.arc(0, 7, 1.5, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    ctx.restore();
    if (ribbon) {
      const pts = []; for (let i = 0; i < 6; i++) { const u = i / 5; pts.push({ x: ax - 3 - u * 22, y: ay - 14 + u * 4 + Math.sin(t * 4 - u * 4) * 3 * u }); }
      G.Rig.ribbon(ctx, pts, 2.6, 1.2, '#d43b3f'); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
      const pts2 = pts.map((q, i) => ({ x: q.x + 2, y: q.y + 3 + i * 0.8 + Math.sin(t * 3.4 - i) * 2 }));
      G.Rig.ribbon(ctx, pts2, 2.2, 0.8, '#8e1f2c'); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke();
    } else {
      ctx.strokeStyle = '#8e1f2c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ax - 2, ay - 13); ctx.lineTo(ax - 7, ay - 9); ctx.moveTo(ax - 2, ay - 13); ctx.lineTo(ax - 6, ay - 15); ctx.stroke();
    }
    ctx.restore();
  }
  const dingdingNPC = {
    id: 'c5_dingding', x: 2850, y: -140, label: '交談',
    draw(ctx, x, y, t, game) {
      const F = game.save.flags, P2 = game.player, look = P2 && P2.x < x ? -1 : 1;
      drawDingding(ctx, x, y, t, look, !!F.c5_quest_done, G.UI.dialogActive && Math.abs(P2.x - x) < 300);
    },
    pending(game) { const F = game.save.flags; return !F.c5_met_dingding || (F.c5_got_ribbon && !F.c5_quest_done); },
    talk(game) {
      const F = game.save.flags;
      const done = () => {
        G.SFX.play('musicbox');
        game.dialog(F.gave_musicbox ? 'c5_dingDoneMB' : 'c5_dingDone', () => {
          F.c5_quest_done = true; game.giveRelic('c5_chime'); G.UI.journal('支線任務完成', '叮叮的紅布條'); game.persist();
        });
      };
      if (!F.c5_met_dingding) {
        game.dialog('c5_dingMeet', () => {
          F.c5_met_dingding = true;
          if (F.c5_got_ribbon) done();
          else G.UI.journal('支線任務：叮叮的紅布條', '到起重機艙找回綁在叮叮天線上的紅布條');
        });
      } else if (F.c5_got_ribbon && !F.c5_quest_done) done();
      else if (!F.c5_quest_done) game.dialog('c5_dingWait');
      else game.dialog('c5_dingAfter');
    },
  };
  level.npcs.push(dingdingNPC);

  /* =========================================================================================
     MUSIC — original Chapter V themes (E lydian "unmoored" motif, C# minor storm variant)
     ========================================================================================= */
  const MOTIF = [
    [0, 71, 6], [6, 73, 2], [8, 76, 8],
    [16, 75, 4], [20, 73, 4], [24, 68, 8],
    [32, 70, 6], [38, 71, 2], [40, 73, 4], [44, 75, 4],
    [48, 71, 12], [60, 68, 4],
    [64, 71, 6], [70, 73, 2], [72, 76, 4], [76, 78, 4],
    [80, 80, 8], [88, 78, 4], [92, 75, 4],
    [96, 73, 4], [100, 75, 4], [104, 76, 4], [108, 70, 4],
    [112, 71, 16],
  ];
  const MOTIF_MINOR = [
    [0, 68, 6], [6, 71, 2], [8, 73, 8],
    [16, 76, 4], [20, 75, 4], [24, 71, 8],
    [32, 69, 6], [38, 71, 2], [40, 73, 4], [44, 76, 4],
    [48, 75, 12], [60, 71, 4],
    [64, 68, 6], [70, 71, 2], [72, 73, 4], [76, 76, 4],
    [80, 78, 8], [88, 76, 4], [92, 73, 4],
    [96, 76, 4], [100, 78, 4], [104, 81, 4], [108, 80, 4],
    [112, 80, 8], [120, 72, 8],
  ];
  const CELLO = [[0, 59, 16], [16, 61, 16], [32, 57, 16], [48, 59, 12], [60, 63, 4], [64, 64, 16], [80, 63, 16], [96, 61, 8], [104, 63, 8], [112, 59, 16]];
  const CELLO_MINOR = [[0, 61, 16], [16, 57, 16], [32, 64, 12], [44, 63, 4], [48, 59, 16], [64, 61, 8], [72, 64, 8], [80, 66, 16], [96, 64, 8], [104, 61, 8], [112, 60, 16]];
  const VELA = [[0, 61, 12], [12, 64, 4], [16, 68, 16], [32, 66, 8], [40, 64, 8], [48, 63, 16], [64, 61, 12], [76, 64, 4], [80, 69, 16], [96, 68, 8], [104, 66, 4], [108, 64, 4], [112, 63, 16]];
  const SHANTY = [
    [0, 61, 4], [4, 61, 2], [6, 64, 2], [8, 68, 8], [16, 66, 4], [20, 64, 4], [24, 63, 8],
    [32, 61, 4], [36, 64, 4], [40, 69, 6], [46, 68, 2], [48, 68, 16],
    [64, 73, 4], [68, 71, 4], [72, 69, 4], [76, 68, 4], [80, 66, 8], [88, 64, 8],
    [96, 69, 4], [100, 68, 4], [104, 66, 4], [108, 64, 4], [112, 63, 8], [120, 60, 8],
  ];
  const THEME_CS = ((G.Music && G.Music.THEME) || []).map(([s, m, l]) => [s, m - 13, l]);
  const tracks = {
    c5_explore: { bpm: 76, chords: ['c5E', 'c5Csm', 'c5A', 'c5B', 'c5E', 'c5Gsm', 'c5A', 'c5Bsus'], melody: MOTIF, mel: 'bell', melEvery: 2, pad: 'strings', arp: 'harp', choir: 0.22, bass: 0.3, drums: 0, counter: true, counterLine: CELLO },
    c5_explore2: { bpm: 88, chords: ['c5Csm', 'c5A', 'c5E', 'c5B', 'c5Csm', 'c5Fsm', 'c5A', 'c5Gs7'], melody: MOTIF_MINOR, mel: 'strings', melEvery: 2, pad: 'strings', arp: 'harp', choir: 0.35, bass: 0.45, drums: 0, counter: true, counterLine: CELLO_MINOR },
    c5_elite: { bpm: 112, chords: ['c5Csm', 'c5Csm', 'c5A', 'c5A', 'c5Fsm', 'c5Fsm', 'c5Gs7', 'c5Gs7'], melody: VELA, mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 0.3, bass: 1, drums: 1, boss: true, timpani: true, counter: true, counterLine: CELLO_MINOR },
    c5_boss: { bpm: 128, chords: ['c5Csm', 'c5B', 'c5A', 'c5Gs7', 'c5Csm', 'c5B', 'c5A', 'c5Gs7'], melody: SHANTY, mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 0.8, bass: 1, drums: 1, boss: true, timpani: true, counter: true, counterLine: [[0, 61, 16], [16, 59, 16], [32, 57, 16], [48, 56, 16], [64, 61, 16], [80, 59, 16], [96, 57, 16], [112, 56, 16]] },
    c5_boss2: { bpm: 142, chords: ['c5Csm', 'c5D', 'c5Csm', 'c5D', 'c5Fsm', 'c5Gs7', 'c5A', 'c5Gs7'], melody: THEME_CS.length ? THEME_CS : SHANTY, mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 1, bass: 1, drums: 1, boss: true, timpani: true, toms: true },
  };
  const chords = {
    c5E: [40, 63, 66, 71], c5Csm: [37, 64, 68, 71], c5A: [33, 61, 63, 68], c5B: [35, 63, 66, 68], c5Gsm: [44, 63, 66, 71],
    c5Fsm: [42, 64, 69, 73], c5Gs7: [44, 66, 72, 75], c5D: [38, 62, 66, 69], c5Bsus: [35, 64, 66, 71],
  };
  const ambience = {
    // thin high wind, cable groans far below, a beacon ping now and then
    c5_high: { bed: [0.55, 0.62, 0, 0.12], gap: [2.5, 5], evt(t, A) {
      const r = Math.random();
      if (r < 0.35) A.tone('sine', 90 + Math.random() * 40, t, 0.6, 0.03, 2.4, { to: 70, wet: 0.8 });
      else if (r < 0.65) A.bell(A.mtof(88 + [0, 2, 7][Math.floor(Math.random() * 3)]), t, 0.012, 2.6, 1, 0.3);
      else if (r < 0.85) for (let i = 0; i < 4; i++) A.noise(t + i * 0.09, 0.002, 0.02, 0.05, 'highpass', 5000, null, 1, 0.6);
      else A.tone('triangle', 1318, t, 0.002, 0.01, 0.6, { wet: 0.9 });
    } },
    c5_gallery: { bed: [0.45, 0.4, 0, 0.1], gap: [2, 4], evt(t, A) {
      const r = Math.random();
      if (r < 0.45) for (let i = 0; i < 5; i++) A.noise(t + i * 0.11 + Math.random() * 0.04, 0.002, 0.035, 0.07, 'bandpass', 3200, 1800, 3, 0.5);   // chains clinking
      else if (r < 0.8) A.tone('sawtooth', 70 + Math.random() * 20, t, 0.4, 0.012, 1.6, { to: 55, wet: 0.7 });   // car creak
      else A.bell(A.mtof(81), t, 0.01, 1.4, 1, 0.5);   // a lamp being tapped clean
    } },
    c5_storm: { bed: [0.95, 0.8, 0, 0.28], gap: [2, 4], evt(t, A) {
      const r = Math.random();
      if (r < 0.5) A.noise(t, 0.4, 0.06, 2.4, 'lowpass', 220, 90, 0.7, 0.8);   // rolling thunder far away
      else if (r < 0.8) A.noise(t, 0.05, 0.03, 0.6, 'bandpass', 1400, 600, 2, 0.6);   // sleet gust
      else A.tone('sine', 55, t, 0.5, 0.04, 2.8, { to: 48, wet: 0.6 });
    } },
    c5_deck: { bed: [0.7, 0.5, 0, 0.45], gap: [3, 4], evt(t, A) {
      if (Math.random() < 0.6) for (let i = 0; i < 3; i++) A.noise(t + i * 0.18, 0.004, 0.05, 0.12, 'bandpass', 900, 500, 2, 0.6);   // chain links settling
      else A.tone('sawtooth', 41, t, 1, 0.025, 3, { to: 36, wet: 0.8 });   // hull groan above
    } },
    c5_under: { bed: [0.35, 0.2, 0, 0.2], gap: [1.5, 3], evt(t, A) { A.bell(A.mtof(96 + Math.floor(Math.random() * 3) * 2), t, 0.008, 0.9, 1, 0.2); } },
  };
  const sfx = {
    c5_thunder(t, delay = 0.6) { const A = G.AudioKit; A.noise(t + delay, 0.02, 0.22, 0.25, 'lowpass', 1800, 300, 0.7, 0.4); A.noise(t + delay + 0.1, 0.5, 0.16, 2.6, 'lowpass', 260, 70, 0.6, 0.8); },
    c5_gondolaStart(t) { const A = G.AudioKit; A.noise(t, 0.01, 0.12, 0.25, 'bandpass', 600, 300, 2, 0.3); A.tone('sawtooth', 55, t, 0.6, 0.03, 1.6, { to: 82, wet: 0.4 }); A.bell(A.mtof(76), t + 0.2, 0.04, 1.6, 0.6, 0.5); },
    c5_gondolaDock(t) { const A = G.AudioKit; A.noise(t, 0.005, 0.2, 0.3, 'lowpass', 900, 200, 1, 0.3); A.tone('sine', 110, t, 0.01, 0.08, 0.5, { to: 60 }); A.bell(A.mtof(83), t + 0.1, 0.035, 1.2, 0.6, 0.6); },
    c5_ding(t) { const A = G.AudioKit; A.bell(A.mtof(93), t, 0.05, 0.9, 0.5, 0.8); A.bell(A.mtof(100), t + 0.12, 0.035, 0.8, 0.5, 0.8); },
  };

  /* =========================================================================================
     STORY: dialogue, barks, hints, codex
     ========================================================================================= */
  const DONE_A = [
    { who: 'rinne', text: '是這個嗎？' },
    { who: 'c5_dingding', text: '……叮。' },
    { who: 'c5_dingding', text: '是的。是的是的是的。叮叮的天線……又完整了。' },
    { who: 'c5_dingding', text: '叮叮有一段錄音。工頭說私人錄音違反規定……可是叮叮一直留著。訪客，要聽嗎？' },
    { who: 'c5_girl', text: '（雜訊。然後，一個小女孩的聲音。）……這樣綁就不會掉了。你叫「叮叮」好不好？因為你走路都會叮、叮、叮。' },
    { who: 'c5_girl', text: '我叫米菈。老師說，我們要去很高、很高的地方。到了那裡，就不會再有人哭了。' },
    { who: 'c5_girl', text: '可是……我好想念爸爸的鐘聲喔。叮叮，你幫我記住它，好不好？' },
    { who: 'rinne', text: '……米菈。' },
    { who: 'ode', text: '凜音。巴洛的女兒……二十年前，她經過這裡。往上。' },
  ];
  const DONE_MB = [
    { who: 'rinne', text: '她父親的鐘還在響。我答應過他，要讓她聽見。' },
    { who: 'c5_dingding', text: '那、那叮叮也要擦得更亮一點。這樣她從上面往下看，就會知道路還在。' },
  ];
  const DONE_B = [
    { who: 'c5_dingding', text: '訪客，請把布條帶給她。叮叮的腳爬不上去，可是訪客可以。' },
    { who: 'c5_dingding', text: '這個給你——叮叮的鈴芯。它會幫你記住節拍。叮！' },
  ];

  const data = {
    speakers: {
      c5_dingding: { name: '叮叮', en: 'DINGDING', color: '#ffc86b' },
      c5_girl: { name: '錄音', en: 'RECORDING', color: '#ff9a9a' },
      c5_vela: { name: '薇拉', en: 'VELA', color: '#b9f5a0' },
      c5_idris: { name: '伊德里斯', en: 'CAPTAIN IDRIS', color: '#8fd3ff' },
    },
    hints: {
      c5_lowgrav: '這裡的重力只有地表的 <b>六成</b>：跳得更高、落得更慢。{jump} 空中再按一次二段跳，能攀上更高的支架',
      c5_secret: '起重機塔上似乎有路……低重力下，<b>二段跳</b> 能跳得比想像中更高',
      c5_gondola: '站上纜車，它就會自己出發。掉下去也別慌——下方有維修甲板，可以從兩側爬回來',
    },
    barks: {
      c5_ride1: { who: 'ode', text: '凜音，往下看。……不，算了。別往下看。' },
      c5_ride2: { who: 'rinne', text: '……那是方舟。' },
      c5_ride3: { who: 'ode', text: '方舟的燈都亮著。四萬兩千人份的燈。可是頻段上……一點聲音都沒有。' },
      c5_ribbon: { who: 'ode', text: '一條褪色的紅布……像是從圍巾上撕下來的。' },
      c5_ribbonMet: { who: 'ode', text: '找到了，叮叮的紅布條。回去找它吧——它大概又在擦燈了。' },
      c5_fallSave: { who: 'ode', text: '抓到你了。下次請不要測試我的反應速度。' },
    },
    dialog: {
      c5_enter: [
        { who: 'ode', text: '抵達。頌歌之梯，第九中繼站。海拔……我換個說法：雲在我們腳下。' },
        { who: 'rinne', text: '……好安靜。' },
        { who: 'ode', text: '空氣稀薄，聲音傳不遠。另外，這一段的重力只有地表的六成——跳躍時請保持謙虛。' },
        { who: 'rinne', text: '方舟呢？' },
        { who: 'ode', text: '頻段上還是一片死寂。不過往上看：那條白色的線一路通進星星裡。方舟就在它的盡頭。' },
        { who: 'ode', text: '第五降臨隊最後的訊號，也是在這一帶消失的。' },
        { who: 'rinne', text: '那就往上走。' },
      ],
      c5_voidling: [
        { who: 'ode', text: '等等——前面的空氣在……閃爍？' },
        { who: 'ode', text: '真空寂裔。它們會「眨」到你背後。紅光是背刺，閃開；接下來的白光斬，可以格擋。' },
        { who: 'rinne', text: '背後。知道了。' },
      ],
      c5_gallery: [
        { who: 'ode', text: '貨運懸廊。以前從地表運上來的物資，都在這裡換車。' },
        { who: 'ode', text: '奇怪……這裡的燈全都亮著，而且很乾淨。有人在保養它們。' },
      ],
      c5_breacher: [
        { who: 'ode', text: '重型反應。那是方舟的真空作業服——磁力靴還在運轉。' },
        { who: 'ode', text: '它的磁力牽引會把你整個拖過去：紅光，閃開。跺地的震波是白光，擋得住。' },
        { who: 'ode', text: '旁邊那隻爬在支架上的小東西會替它「修補」。先處理小的——這是戰術建議，也是人生建議。' },
      ],
      c5_driftwatch: [
        { who: 'ode', text: '浮游哨。舊的軌道監視器，被寂靜重新「調律」過。' },
        { who: 'ode', text: '紅色瞄準線會一路跟著你；等它鎖定、開始閃爍——那一瞬間翻滾。靠太近它會放電，那是白光，擋得住。' },
      ],
      c5_crane: [
        { who: 'rinne', text: '……這裡有畫。' },
        { who: 'ode', text: '蠟筆畫。一台機器人、一口鐘，還有一個長頭髮的女人。畫的人……年紀不大。' },
      ],
      c5_gap: [
        { who: 'ode', text: '極光斷口。前面一千六百公尺，沒有路。' },
        { who: 'ode', text: '但纜車還能動。站上去它就會出發。如果它在半路停下來……我們就一起學習自由落體。' },
        { who: 'rinne', text: '……走吧。' },
      ],
      c5_storm: [
        { who: 'ode', text: '上環風暴層。注意閃電——好消息是，它不會特別瞄準你。大概。' },
        { who: 'ode', text: '壞消息是：我們不是唯一的乘客。' },
      ],
      c5_pylon1: [
        { who: 'talia', text: '……喂？凜音？訊號好遠——你們到底爬到哪裡去了？' },
        { who: 'rinne', text: '雲上面。' },
        { who: 'talia', text: '雲、雲上面？！我這輩子連鐘樓的屋頂都只爬上去過三次欸！' },
        { who: 'ode', text: '塔莉亞，報告現況：重力六成，空氣稀薄，景色評分十分。生還率評分——請不要問。' },
        { who: 'talia', text: '那你們小心點！碑文這邊的頻段很乾淨，我可以幫止弦多擰幾圈——上限又能往上調了。' },
        { who: 'talia', text: '還有……方舟的頻段我也試過了。一直都是安靜的。凜音，那上面的人……還好嗎？' },
        { who: 'rinne', text: '我會去看。' },
      ],
      c5_pylon2: [
        { who: 'talia', text: '凜音，你聽——' },
        { who: 'talia', text: '（雜訊之中，有一段斷斷續續的哼唱。很小聲，像個孩子。）' },
        { who: 'rinne', text: '……是那首歌。' },
        { who: 'ode', text: '訊號來源在方舟的上方。比方舟還高。我重算了三次，結果都一樣。' },
        { who: 'talia', text: '比方舟還高？那上面還有什麼？' },
        { who: 'ode', text: '根據所有已知資料：什麼都沒有。' },
        { who: 'rinne', text: '那就是有東西。' },
      ],
      c5_pylon3: [
        { who: 'ode', text: '前面是斷錨甲板，第五降臨隊最後的座標。再往上……就是方舟的船底了。' },
        { who: 'talia', text: '凜音……鐘樓的老人們說，第五隊的伊德里斯船長是個好人。他們經過鐘樓的時候，他還幫大家修過水塔。' },
        { who: 'rinne', text: '好人也會累。' },
        { who: 'talia', text: '……嗯。那就讓他休息吧。然後，你一定要回來。' },
      ],
      c5_dingMeet: [
        { who: 'c5_dingding', text: '叮！訪客！訪客！第一百二十萬四千五百五十二顆螺栓——暫停計數。' },
        { who: 'c5_dingding', text: '我是維修機 F-12。不過大家都叫我叮叮，因為我走路會——叮、叮。' },
        { who: 'ode', text: '一台會自我介紹的維修機。凜音，我覺得我的工作受到了威脅。' },
        { who: 'rinne', text: '你一直待在這裡？' },
        { who: 'c5_dingding', text: '工頭說：「燈不能滅，我們會回來。」所以叮叮每天擦燈。七千……三百……很多天了。' },
        { who: 'c5_dingding', text: '工頭還沒回來。可是有一次，一個小女孩經過這裡。她把紅色的布條綁在叮叮的天線上，說這樣就不會走丟。' },
        { who: 'c5_dingding', text: '上次的暴風把布條吹走了，卡在上面的起重機艙。叮叮的腳……爬不上去了。訪客，可以幫叮叮拿回來嗎？' },
      ],
      c5_dingWait: [
        { who: 'c5_dingding', text: '起重機艙在貨運懸廊的最上面，很高、很高。這裡重力很輕——訪客跳兩次，就會變成鳥。叮！' },
      ],
      c5_dingDone: DONE_A.concat(DONE_B),
      c5_dingDoneMB: DONE_A.concat(DONE_MB, DONE_B),
      c5_dingAfter: [
        { who: 'c5_dingding', text: '第一百二十萬四千五百五十三顆螺栓。叮！訪客，路上小心。' },
        { who: 'c5_dingding', text: '替叮叮跟米菈說：燈，都還亮著。' },
      ],
      c5_eliteIntro: [
        { who: 'ode', text: '熱源反應——甲板另一頭，距離八百。她已經瞄準我們……很久了。' },
        { who: 'c5_vela', text: '第五降臨隊，狙擊手薇拉。船長下過命令：任何人都不准再往上。' },
        { who: 'c5_vela', text: '我在這裡守了很久，從來沒有失手過。轉身離開吧，共鳴者。這是唯一一次警告。' },
        { who: 'rinne', text: '你們的船長，還在上面？' },
        { who: 'c5_vela', text: '……他在等。我們都在等。' },
      ],
      c5_eliteDefeat: [
        { who: 'c5_vela', text: '……呵。最後一發，我是故意打偏的。你發現了嗎？' },
        { who: 'c5_vela', text: '船長他……已經不說話了。他把錨鏈纏在自己身上，說這樣才不會被「上面」拉走。' },
        { who: 'c5_vela', text: '去吧。替我……讓他休息。' },
        { who: 'ode', text: '……她的瞄準鏡還是溫的。凜音，帶著它吧。' },
      ],
      c5_bossIntro: [
        { who: 'ode', text: '斷錨甲板。頌歌之梯的最上層——再往上，就是方舟的船底。' },
        { who: 'c5_idris', text: '……又一艘船。又一個不肯下錨的傻子。' },
        { who: 'c5_idris', text: '第五降臨隊，伊德里斯。我們切斷了和方舟的纜索，追著那首歌爬到這裡。然後，船員一個接一個……安靜下來。' },
        { who: 'rinne', text: '你在上面看見了什麼？' },
        { who: 'c5_idris', text: '比方舟還高的地方。有個孩子在屏住呼吸——替整個世界屏住。' },
        { who: 'c5_idris', text: '我不會讓任何人再上去。就算要我把這座塔整個翻過來。……起錨吧，共鳴者！' },
      ],
      c5_bossDefeat: [
        { who: 'c5_idris', text: '……錨……斷了。哈……原來，這麼輕……' },
        { who: 'c5_idris', text: '聽好，共鳴者。休止……不在地底。它被錨在梯子的頂端——方舟的上面。那孩子……就在錨的另一頭。' },
        { who: 'rinne', text: '她的名字。' },
        { who: 'c5_idris', text: '……米菈。她一直在哼那首歌……好讓自己……不要害怕……' },
        { who: 'ode', text: '……訊號消失。凜音，梯子的張力讀數正在下降。上面的「拉力」……鬆了一點。' },
        { who: 'rinne', text: '米菈。巴洛的女兒。' },
        { who: 'ode', text: '方舟的船殼就在正上方，燈全都亮著。我正在呼叫——第七降臨隊呼叫頌歌號。頌歌號，請回答。' },
        { who: 'ode', text: '…………' },
        { who: 'ode', text: '沒有人回答。' },
      ],
    },
    codex: {
      people: [
        { id: 'c5_dingding', name: '叮叮', en: 'DINGDING — MAINTENANCE UNIT F-12', portrait: 'c5_dingding', unlock: 'c5_met_dingding', tag: 'NPC｜第九中繼站的維修機',
          body: ['頌歌之梯上段的維修機 F-12。梯子斷裂後，工頭留下一句「燈不能滅，我們會回來」，便再也沒有回來。', '它每天擦拭中繼站的每一盞燈，數著自己鎖緊過的每一顆螺栓——一百二十萬顆，還在增加。', '名字是一個小女孩取的。因為它走路的時候，天線上的小鈴會「叮、叮」地響。'] },
        { id: 'c5_vela', name: '薇拉', en: 'VELA — THE LONGSHOT', portrait: 'c5_elite', unlock: 'c5_elite_seen', tag: '菁英敵人｜第五降臨隊・狙擊手',
          body: ['第五降臨隊的狙擊手。船長下令封鎖上環之後，她一個人在風暴裡守了很多年。', '她的狙擊鏡能看見八百公尺外的心跳。她說自己從不失手——只是有時候，選擇不扣扳機。'] },
        { id: 'c5_idris', name: '伊德里斯', en: 'CAPTAIN IDRIS — THE UNMOORED', portrait: 'c5_boss', unlock: 'c5_boss_seen', tag: '頭目｜第五降臨隊隊長・失聲者',
          body: ['第五降臨隊隊長，舊時代的軌道拖船船長。途經鐘樓時替村民修好了水塔，留下了「下錨的地方就是家」這句話。', '為了追上那首歌，他親手切斷了降臨隊與方舟之間的纜索。後來，他把錨鏈纏在自己身上——為了不被「上面」拉走。', '「我不會下錨。我只是……再也找不到可以停靠的地方。」'] },
      ],
      world: [
        { id: 'c5_spire', name: '無重之塔', en: 'THE UNMOORED SPIRE', unlock: 'c5_arrived', body: ['頌歌之梯在雲層之上的上段。為了節省能源，維修局把這一段的人工重力調到了地表的六成。', '人們說，越往上爬，身體就越輕。到了最頂端，連聲音都沒有重量。'] },
        { id: 'c5_waystation', name: '第九中繼站', en: 'WAYSTATION NINE', unlock: 'c5_arrived', body: ['頌歌之梯上段最後一個有人駐守的中繼站，攀升艙在這裡換軌、加壓、補給。', '大寂靜之後，所有的人都撤走了。只有燈還亮著。'] },
        { id: 'c5_descent5', name: '第五降臨隊', en: 'DESCENT V', unlock: 'note_c5_n5', body: ['方舟派出的第五支降臨隊，由伊德里斯船長率領。他們一路降到鐘樓，才發現那首歌來自上方——於是切斷與方舟的纜索，掉頭往上追去。', '隊員名單：伊德里斯、薇拉，以及其他十一人。生還者：未知。'] },
        { id: 'c5_gap', name: '極光斷口', en: 'THE AURORA GAP', unlock: 't_c5_t_gap', body: ['頌歌之梯上段一段斷開的懸廊，只剩下一條纜車線橫越其上。', '從纜車上往下看，是整片死去的星球，與在它上空靜靜燃燒的極光。'] },
      ],
      items: [
        { id: 'c5_chime', name: '叮叮的鈴芯', en: "DINGDING'S CHIME", unlock: 'relic_c5_chime', relic: true, body: ['維修機 F-12 的節拍核心。它用這個記住自己每天走過的步數。', '遺物效果：最大耐力 +15；每次完美格擋，回復 12 耐力——踩著節拍，就不會累。'] },
        { id: 'c5_ribbon', name: '紅色布條', en: 'THE RED RIBBON', unlock: 'c5_got_ribbon', body: ['從一條紅色圍巾上撕下來的布條，已經褪色。', '叮叮說，這要交還給它原本的主人。'] },
      ],
      notes: [
        { id: 'c5_n1', name: '第九中繼站 交接日誌', en: 'WAYSTATION NINE — HANDOVER LOG', body: ['【維修局・上段第九站　最後一班】', '電梯停了，下面的人說梯子斷了。上級命令：全員撤往方舟，重力降到六成以節省能源。', '維修機 F-12 繼續例行巡檢。燈不能滅——這是規定，也是我答應的事。', 'F-12，聽好：我們會回來。在那之前，把燈擦亮。'] },
        { id: 'c5_n2', name: '攀升艙貨運清單 #2241', en: 'CLIMBER MANIFEST #2241', body: ['【上行・最終班次・二十年前】', '乘員：成人一名（共鳴者，第一降臨隊隊長）。', '　　　兒童一名（未登記。無方舟居留證。依隊長權限放行）。', '隨身物品：紅色圍巾一條（已破損）。蠟筆一盒。', '備註：兒童在整段旅程中都在哼歌。押運員表示「聽了很安心」。'] },
        { id: 'c5_n3', name: '起重機艙裡的蠟筆畫', en: 'CRAYONS IN THE CRANE CAB', body: ['牆上貼著三張蠟筆畫。', '第一張是一台頭上有鈴鐺的機器人，旁邊寫著：「叮叮」。', '第二張是一口很大的鐘，寫著：「爸爸的鐘」。', '第三張是一個黑色長頭髮的女人，牽著一個圍紅圍巾的小女孩。下面歪歪扭扭地寫著：', '「我叫米菈。我今天沒有哭。」'] },
        { id: 'c5_n4', name: '梯工的維修筆記', en: "LADDER RIGGER'S NOTES", body: ['斷口纜車的握索器又鬆了。我已經跟上面報告第四次。', '另一件事我不知道該跟誰報告：梯子頂端的張力計，一直顯示一個不可能的讀數。', '照理說，梯子是被方舟「往上吊著」的。可是最近，張力大到像是——有什麼東西在方舟的更上面，抓著整條梯子往上拉。', '像是一個往天上拋的錨。'] },
        { id: 'c5_n5', name: '伊德里斯的航海日誌', en: "CAPTAIN IDRIS' LOG", body: ['第五降臨隊，第 211 日。我們不再往下走了。那首歌是從「上面」傳來的。', '起重機艙裡有孩子的畫。中繼站那台維修機說，她叫米菈，二十年前跟著瑪絲緹娜往上去了。', '休止不在地底。它被錨在梯子的頂端，比方舟還高。那孩子就在錨的另一頭，替整個世界屏住呼吸。', '我下令切斷與方舟的纜索。從今天起，第五降臨隊不再下錨。', '……船員一個接一個安靜了下來。我把錨鏈纏在身上。我不會讓他們把我也拉上去。'] },
        { id: 'c5_n6', name: '薇拉的最後一封信', en: "VELA'S LAST LETTER", body: ['給方舟上的弟弟：', '我透過瞄準鏡看了這塊甲板好多年。船長已經不說話了，我還在守著他的命令：任何人都不准上去。', '今天有人來了。一個拿著細刀的共鳴者，走路的樣子，很像薇格隊長。', '如果你讀到這封信……我沒有失手。我只是，選擇不扣扳機。'] },
      ],
    },
    relics: {
      c5_chime: { name: '叮叮的鈴芯', desc: '最大耐力 +15、完美格擋回復 12 耐力' },
    },
  };

  // the elite's relic is normally defined by the foes author; provide a fallback so the drop never breaks
  if (!G.DATA.relics.c5_scope) {
    data.relics.c5_scope = { name: '薇拉的瞄準鏡', desc: '完美格擋判定 +30ms' };
    data.codex.items.push({ id: 'c5_scope', name: '薇拉的瞄準鏡', en: "VELA'S SCOPE", unlock: 'relic_c5_scope', relic: true, body: ['第五降臨隊狙擊手的瞄準鏡。鏡片上有一道裂痕，正好劃過十字線。', '遺物效果：完美格擋判定 +30ms。'] });
    if (!G.Relics.c5_scope) G.Relics.c5_scope = { apply(P2) { P2.parryWin += 0.03; } };
  }
  // Dingding's chime keeps the beat: +15 stamina, and every perfect guard gives 12 back. (Vela's scope already boosts
  // resonance, so the chapter's two relics pull in different directions.) Relics outlive the chapter, so this rides the
  // engine's parry event (G.Boons.onParry fires on every perfect guard in every chapter), like Olin's horn in Chapter II.
  G.Relics.c5_chime = { apply(P2) { P2.maxSta += 15; } };
  if (G.Boons && G.Boons.onParry && !G.Boons._c5chime) {
    const onParry0 = G.Boons.onParry;
    G.Boons._c5chime = true;
    G.Boons.onParry = function (Pl) {
      const g = G.game, eq = g && g.save && g.save.equipped;
      if (eq && eq.includes('c5_chime') && Pl && Pl.hp > 0 && Pl.sta < Pl.maxSta) {
        Pl.sta = Math.min(Pl.maxSta, Pl.sta + 12);
        G.FX.ember(Pl.x, Pl.y - 60, 4, '#ffc86b', { w: 22, h: 26 });
      }
      return onParry0.apply(this, arguments);
    };
  }
  if (G.UI && G.UI.portraits) G.UI.portraits.c5_dingding = (ctx, W, H, game) => { ctx.setTransform(3.4, 0, 0, 3.4, W / 2 - 20, H * 0.84); drawDingding(ctx, 0, 0, game.realTime || 1, 1, !!(game.save && game.save.flags.c5_quest_done), false); };

  /* =========================================================================================
     HOOKS — cable car, lightning, cinematic arena entrances, fall safety
     ========================================================================================= */
  const RT = { walk: null, safe: { x: 160, y: 0 } };
  function gondUpdate(game, dt) {
    const Pl = game.player, F = game.save.flags;
    const fy0 = gondFloor();
    const on = Pl.onGround && Math.abs(Pl.y - fy0) < 3 && Pl.x > GON.x - 4 && Pl.x < GON.x + GD.w + 4;
    const riders = game.enemies.filter((e) => !e.fly && !e.dead && e.onGround && Math.abs(e.y - fy0) < 3 && e.x > GON.x && e.x < GON.x + GD.w);
    const prevX = GON.x, prevY = fy0;
    if (GON.state === 'move') {
      GON.t += dt;
      const k = clamp(GON.t / GON.dur, 0, 1), e = U.easeInOutSine(k);
      GON.x = lerp(GON.from, GON.to, e);
      GON.wheel += (GON.to > GON.from ? 1 : -1) * dt * 2.6 * Math.sin(k * PI + 0.15);
      if (on && GON.rideBarks) {
        if (k > 0.15 && GON.barks === 0) { GON.barks = 1; game.bark('c5_ride1'); }
        else if (k > 0.45 && GON.barks === 1) { GON.barks = 2; game.bark('c5_ride2'); }
        else if (k > 0.72 && GON.barks === 2) { GON.barks = 3; game.bark('c5_ride3'); }
      }
      if (on && GON.cine) game.focus = { x: gondCenter() + (GON.to > GON.from ? 200 : -200), y: -330, zoom: 0.8 };
      if (k >= 1) {
        GON.state = GON.to === GD.a ? 'A' : 'B'; GON.armed = false; GON.standT = 0; GON.idleT = 0;
        if (GON.cine) { game.focus = null; GON.cine = false; }
        G.SFX.play('c5_gondolaDock'); game.shake(0.18);
      }
    } else {
      // idle at a station: ride when the player stands on it; come to the player when called from the other side
      if (!on) GON.armed = true;
      GON.standT = on ? GON.standT + dt : 0;
      const atA = GON.state === 'A', other = atA ? GD.b : GD.a;
      if (on && GON.armed && GON.standT > 0.45 && game.control) {
        GON.state = 'move'; GON.from = GON.x; GON.to = other; GON.t = 0; GON.dur = atA && !F.c5_rode ? 11 : 7; GON.barks = 0;   // the first crossing is the show; runbacks are quicker
        GON.rideBarks = atA && !F.c5_rode; GON.cine = atA;
        if (atA) F.c5_rode = true;
        G.SFX.play('c5_gondolaStart'); game.shake(0.12);
      } else if (!on) {
        const nearOther = Pl.onGround && Math.abs(Pl.y + 140) < 4 && (atA ? Pl.x > 8900 && Pl.x < 9300 : Pl.x > 6800 && Pl.x < 7100);
        const farAway = !atA && !nearOther && (Pl.x < 8600 || Pl.x > 9500 || Pl.y > 100);
        GON.recallT = nearOther ? GON.recallT + dt : 0;
        GON.idleT = farAway ? GON.idleT + dt : 0;
        if (GON.recallT > 1.0 || GON.idleT > 3) {
          GON.state = 'move'; GON.from = GON.x; GON.to = other; GON.t = 0; GON.dur = 6; GON.rideBarks = false; GON.cine = false; GON.recallT = 0; GON.idleT = 0;
          G.SFX.play('c5_gondolaStart');
        }
      }
    }
    // keep the solid in sync and carry whoever stands on the car
    const fy = gondFloor(), dx = GON.x - prevX, dy = fy - prevY;
    gondSolid.x = GON.x; gondSolid.y = fy;
    if (on) { Pl.x += dx; Pl.y = fy; Pl.vy = Math.max(0, Pl.vy); }
    for (const e of riders) { e.x += dx; e.y += dy; }
  }
  const hooks = {
    enter(game, run) {
      game.save.flags.c5_arrived = true;
      GON.x = GD.a; GON.state = 'A'; GON.armed = true; gondSolid.x = GON.x; gondSolid.y = gondFloor();
      return false;
    },
    update(game, dt) {
      const Pl = game.player, F = game.save.flags;
      F.c5_arrived = true;
      gondUpdate(game, dt);
      // gravity safety net: only Idris' flip field may change it, and only while that field exists
      // (covers boss death, player death, retries and dialogue pauses — the engine skips hazards while someone talks)
      if (L.gravity !== level.gravity && !game.hazards.some((h) => h.kind === 'c5_grav')) L.gravity = level.gravity;
      // lightning in the storm ring
      SKY.flash = Math.max(0, SKY.flash - dt * 3.2);
      if (SKY.bolt) SKY.bolt.t += dt;
      const st = stormAt(game.cam.x);
      if (st > 0.3) {
        SKY.nextStrike -= dt;
        if (SKY.nextStrike <= 0) {
          SKY.nextStrike = 4 + Math.random() * 7;
          const x0 = 0.1 + Math.random() * 0.8, pts = [[x0, 0]];
          let px = x0;
          for (let i = 1; i <= 9; i++) { px += (Math.random() - 0.5) * 0.06; pts.push([px, i / 9]); }
          SKY.bolt = { pts, t: 0 }; SKY.flash = 1;
          G.SFX.play('c5_thunder', 0.4 + Math.random() * 0.9);
        }
      }
      // cinematic walk-in for the elite / boss arenas (keeps the contract trigger at x0-200 without a snap)
      if (RT.walk) {
        const w = RT.walk;
        if (Pl.busy && Pl.state !== 'rest') Pl.setState('move');
        Pl.facing = 1; Pl.vx = 300;
        if (Pl.x >= w.tx || (w.t += dt) > 2.5) {
          RT.walk = null; Pl.vx = 0;
          const tr = w.tr;
          if (tr.flag) F[tr.flag] = true;
          if (tr.startEnc) game.startEncounter(tr.startEnc);
          if (tr.focus) game.focus = tr.focus;
          game.dialog(tr.dialog, () => {
            game.focus = null;
            if (tr.music) { G.Music.play(tr.music); G.SFX.play('roar'); game.shake(0.8); }
          });
        }
      }
      // fall safety: anything below the service deck returns you to the last solid footing
      if (Pl.onGround && Pl.y < 600 && Pl.state !== 'dead') { RT.safe.x = Pl.x; RT.safe.y = Pl.y; }
      if (Pl.y > 1100 && Pl.state !== 'dead') {
        Pl.x = RT.safe.x; Pl.y = RT.safe.y - 4; Pl.vx = 0; Pl.vy = 0;
        game.cam.x = Pl.x; game.cam.y = Pl.y - 150; game.fadeA = 0.8;
        game.bark('c5_fallSave', true);
      }
    },
    trigger(game, tr) {
      if (tr.id !== 'c5_t_elite' && tr.id !== 'c5_t_boss') return false;
      const E = L.encounters[tr.startEnc];
      game.control = false;
      RT.walk = { tr, tx: E.arena[0] + 90, t: 0 };
      return true;
    },
    encounterStart(game, id) {
      // a retry after death starts the fight straight from the trigger: cut to the arena instead of snapping
      const E = L.encounters[id], Pl = game.player;
      if (E && E.arena && (E.boss || E.elite) && Pl.x < E.arena[0] + 20) {
        Pl.x = E.arena[0] + 90; Pl.vx = 0; game.cam.x = Pl.x + 200; game.fadeA = 1;
      }
    },
    drawSky, drawAtmos, drawForeground, drawBack, drawFront,
  };

  /* =========================================================================================
     REGISTER
     ========================================================================================= */
  G.Chapters.register({
    id: 5, key: 'ch5', num: 'V', numZh: '五', title: '無重之塔', en: 'THE UNMOORED SPIRE',
    intro: [
      { t: '河道升降梯把她們送回了梯子。\n這一次，一路往上。', s: 'THE RIVER LIFT RETURNS THEM TO THE LADDER. THIS TIME, ONLY UP.' },
      { t: '雲在腳下，星星很近。\n越往上，一切就越輕。', s: 'CLOUDS BELOW. STARS CLOSE. THE HIGHER YOU CLIMB, THE LIGHTER EVERYTHING BECOMES.' },
    ],
    enterDialog: 'c5_enter',
    outro: '「燈是亮著的。可是，沒有人回答。」',
    level, pal,
    sky: { sun: false, shafts: false, clouds: false, ark: false, rays: 0 },
    bg: {
      far: genFar, mid: genMid, near: genNear, props: genProps,
      params: { far: { f: 0.08, fy: 0.03, baseY: 60, res: 0.55 }, mid: { f: 0.22, fy: 0.1, baseY: 80, res: 0.7 }, near: { f: 0.45, fy: 0.25, baseY: 110, res: 0.85 } },
    },
    solidPainters: { c5deck: paintDeck, c5cargo: paintCargo, c5under: paintUnder, c5pier: paintPier },
    onewayPainter,
    music: { explore: 'c5_explore', boss: 'c5_boss', boss2: 'c5_boss2', elite: 'c5_elite', rest: 'rest' },
    tracks, chords,
    musicAt(x, y) { const z = L.zoneAt(x); return (z && z.music) || 'c5_explore'; },
    ambienceAt(x, y) { if (y > 200) return 'c5_under'; const z = L.zoneAt(x); return (z && z.amb) || 'c5_high'; },
    ambience, sfx, data,
    upgradeBoost: { vit: [420], edge: [420], tempo: [300] },
    hooks,
    next: 6,
  });
})(window.G);

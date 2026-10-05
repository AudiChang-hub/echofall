'use strict';
/* ECHOFALL — Chapter VII 休止之所 THE REST (world author: level, look, music, story).
   Beyond the Ark hangs a page nobody finished writing. Every sound the Hush ever swallowed fell onto it: the Ark's morning
   hymn, Barrow's evening bell, Lucette's last high note, a captain's last three seconds. Rinne walks it bar by bar —
   the first bar · Ashport folded into the margin · the Long Rest (one line over nothing, where the page turns over) ·
   the Opera as the Rest remembers it · the final barline, where Elaine Vega's echo is waiting.
   Look: ink on paper — white-on-black staves underfoot, a sky of slow ink, monochrome with gold and ONE red (Mira's scarf,
   and the red thread it unravelled into). Foes: ch7_foes.js (Rest Mark, Echo Self, Voiceless Choir, Fermata, Graves);
   boss: ch7_boss.js (c7_boss, by id). See docs/CHAPTER_API.md and docs/STORY.md (§0–2, chapter VII). */
(function (G) {
  const WK = G.WorldKit, U = G.U, Rig = G.Rig, PI = Math.PI, TAU = PI * 2;
  const L = G.LEVEL, INK = '#0b0612';
  const rgba = U.rgba, mixH = U.mixHex, clamp = U.clamp, lerp = U.lerp;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const low = () => !!(G.Quality && G.Quality.low);
  const DEVQ = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;

  /* =========================================================================================
     LEVEL GEOMETRY
     ========================================================================================= */
  const SPAN = [-400, 13300];
  const ZX = [-1e9, 2500, 5200, 7650, 10400];                // prelude · Ashport · the Long Rest · the Opera · the final barline
  const zoneOf = (x) => (x < ZX[1] ? 0 : x < ZX[2] ? 1 : x < ZX[3] ? 2 : x < ZX[4] ? 3 : 4);
  const ARENA = { e3: [3700, 4500], e7: [10550, 11250], elite: [9250, 10250], boss: [11900, 13300] };
  const RAISE = { x0: 2250, x1: 2700, y: -110 };              // a raised system (second staff) at the end of the prelude
  const ROOF = { x0: 3250, x1: 3560, y: -120 };               // Ashport's bell-tower roof, fallen onto the staff (Mira)
  const PIT = { x0: 4800, x1: 5200, y: 180 };                 // a sunken bar, bridged by a tie (Rest Marks erase it)
  const LINE = { x0: 5360, x1: 7600 };                        // the Long Rest: a single staff line over nothing
  const FLIP = { x0: 5700, x1: 7300 };                        // …where the page turns over
  const DAIS = { x0: 8700, x1: 8950, y: -100 };               // the conductor's podium
  const BELFRY = { x: 4700, y: -980 };                        // Ashport's belfry hanging upside down (secret route)
  const MIRA = { x: 3420, y: ROOF.y };

  // palette blend 0 → 0.69 (kept under 0.7: the engine's post grade turns crimson above it — this world has ONE red)
  const tintAt = (x) => {
    if (x < 2500) return 0.05 * clamp((x + 400) / 2900, 0, 1);
    if (x < 5200) return 0.05 + 0.13 * (x - 2500) / 2700;
    if (x < 7650) return 0.18 + 0.14 * (x - 5200) / 2450;
    if (x < 10400) return 0.32 + 0.18 * (x - 7650) / 2750;
    return 0.5 + 0.19 * sstep(10400, 11900, x);
  };
  // how far the page has darkened into ink (sky, haze, plume colour)
  const nightAt = (x) => clamp(0.12 * sstep(2400, 3600, x) + 0.18 * sstep(5100, 6200, x) + 0.25 * sstep(7500, 8700, x) + 0.45 * sstep(10200, 11700, x), 0, 1);
  const voidAt = (x) => sstep(5260, 5520, x) * (1 - sstep(7440, 7700, x));
  const operaAt = (x) => sstep(7450, 8000, x) * (1 - sstep(10250, 10700, x));
  const codaAt = (x) => sstep(10200, 11400, x);

  const st = (x, y, w, k, o) => Object.assign({ x, y, w, k }, o || {});
  const level = {
    start: { x: 150, y: 0 }, bounds: SPAN.slice(), gravity: 1,
    solids: [
      { x: -820, y: -2600, w: 420, h: 2700, kind: 'wall' },
      { x: -820, y: 0, w: RAISE.x0 + 820, h: 700, kind: 'c7staff' },
      { x: RAISE.x0, y: RAISE.y, w: RAISE.x1 - RAISE.x0, h: 700 - RAISE.y, kind: 'c7staff' },
      { x: RAISE.x1, y: 0, w: PIT.x0 - RAISE.x1, h: 700, kind: 'c7staff' },
      { x: ROOF.x0, y: ROOF.y, w: ROOF.x1 - ROOF.x0, h: -ROOF.y, kind: 'c7roof' },
      { x: PIT.x0, y: PIT.y, w: PIT.x1 - PIT.x0, h: 700 - PIT.y, kind: 'c7staff' },
      { x: PIT.x1, y: 0, w: LINE.x0 - PIT.x1, h: 700, kind: 'c7staff' },
      { x: LINE.x0, y: 0, w: LINE.x1 - LINE.x0, h: 700, kind: 'c7line' },
      { x: LINE.x1, y: 0, w: ARENA.elite[0] - LINE.x1, h: 700, kind: 'c7staff' },
      { x: DAIS.x0, y: DAIS.y, w: DAIS.x1 - DAIS.x0, h: -DAIS.y, kind: 'c7dais' },
      { x: ARENA.elite[0], y: 0, w: ARENA.elite[1] - ARENA.elite[0], h: 700, kind: 'c7stage' },
      { x: ARENA.elite[1], y: 0, w: ARENA.boss[0] - ARENA.elite[1], h: 700, kind: 'c7staff' },
      { x: ARENA.boss[0], y: 0, w: 13700 - ARENA.boss[0], h: 700, kind: 'c7coda' },
      { x: 13300, y: -2600, w: 400, h: 2700, kind: 'wall' },
    ],
    oneways: [
      // the first bar: a lone whole rest to hop on, then the upper route over the first Rest Marks (erasable on purpose)
      st(760, -150, 170, 'rest'), st(1150, -170, 210, 'stave'), st(1430, -265, 240, 'beam', { c7h: 44 }), st(1745, -180, 200, 'stave'),
      st(2010, -215, 170, 'fermata'),
      // Ashport: rooftops drifting over the choir's ring
      st(3820, -215, 220, 'roof'), st(4150, -290, 200, 'roof'),
      // the secret climb into the hanging belfry (never erased)
      st(4500, -170, 150, 'ledger', { noErase: true }), st(4690, -330, 140, 'ledger', { noErase: true }), st(4500, -500, 170, 'rest', { noErase: true }),
      st(4700, -660, 140, 'ledger', { noErase: true }), st(4515, -820, 150, 'ledger', { noErase: true }), st(4560, BELFRY.y, 290, 'belfry', { noErase: true, c7h: 40 }),
      // the sunken bar: a tie bridges it (erase it and you drop in — climb out with a jump), two rests above
      st(PIT.x0, 0, PIT.x1 - PIT.x0, 'bridge', { c7h: 32 }), st(4870, -205, 160, 'rest'), st(5080, -235, 150, 'rest'),
      // the Opera: theatre boxes
      st(7950, -195, 180, 'box', { c7h: 40 }), st(8550, -235, 190, 'box', { c7h: 40 }), st(9000, -310, 180, 'box', { c7h: 40 }),
      // the final barline: two staves over the last gauntlet
      st(10650, -205, 200, 'stave'), st(10960, -265, 220, 'beam', { c7h: 44 }),
    ],
    pylons: [
      { id: 'c7_p1', x: 2800, y: 0, name: '灰港摺頁共鳴碑', dialog: 'c7_pylon1', flag: 'c7_pylon1_seen' },
      { id: 'c7_p2', x: 7740, y: 0, name: '歌劇院後台共鳴碑', dialog: 'c7_pylon2', flag: 'c7_pylon2_seen' },
      { id: 'c7_p3', x: 11420, y: 0, name: '終止線前共鳴碑', dialog: 'c7_pylon3', flag: 'c7_pylon3_seen' },
    ],
    notes: [
      { id: 'c7_n1', x: 600, y: 0, flag: 'c7_read_hymn' },
      { id: 'c7_n2', x: 3060, y: 0, flag: 'c7_read_toll' },
      { id: 'c7_n3', x: 4590, y: -500, flag: 'c7_read_vent' },
      { id: 'c7_n4', x: 6660, y: 0, flag: 'c7_read_retreat' },
      { id: 'c7_n5', x: 8160, y: 0, flag: 'c7_read_aria' },
      { id: 'c7_n6', x: 11300, y: 0, flag: 'c7_read_breath' },
      { id: 'c7_n7', x: 11570, y: 0, flag: 'c7_read_vega' },
    ],
    items: [
      { id: 'c7_toll', x: BELFRY.x + 30, y: BELFRY.y, flag: 'c7_got_toll', name: '巴洛的鐘聲', kind: 'key', sfx: 'c7_toll',
        onTake(game) { game.bark(game.save.flags.c7_met_mira ? 'c7_tollMet' : 'c7_toll'); } },
    ],
    npcs: [],   // filled below (little Mira needs her painter)
    triggers: [
      { id: 'c7_t_score', x: 250, kind: 'dialog', dialog: 'c7_score' },
      { id: 'c7_t_rest', x: 860, kind: 'dialog', dialog: 'c7_restmarks', after: 'c7_erase' },
      { id: 'c7_t_mirror', x: 1880, kind: 'dialog', dialog: 'c7_mirror' },
      { id: 'c7_t_ashport', x: 2520, kind: 'dialog', dialog: 'c7_ashport' },
      { id: 'c7_t_hum', x: 2960, kind: 'c7_bark', bark: 'c7_hum' },
      { id: 'c7_t_choir', x: 3560, kind: 'dialog', dialog: 'c7_choir' },
      { id: 'c7_t_secret', x: 4540, kind: 'hint', hint: 'c7_secret' },
      { id: 'c7_t_belfry', x: 4480, kind: 'dialog', dialog: 'c7_belfry', yMax: -900 },
      { id: 'c7_t_pit', x: 4720, kind: 'c7_bark', bark: 'c7_pit' },
      { id: 'c7_t_line', x: 5250, kind: 'dialog', dialog: 'c7_line' },
      { id: 'c7_t_flip', x: FLIP.x0, kind: 'c7_flip' },
      { id: 'c7_t_bell', x: 6250, kind: 'c7_bell' },
      { id: 'c7_t_unflip', x: FLIP.x1, kind: 'c7_unflip' },
      { id: 'c7_t_opera', x: 7790, kind: 'dialog', dialog: 'c7_opera' },
      { id: 'c7_t_fermata', x: 7960, kind: 'dialog', dialog: 'c7_fermata', after: 'c7_hold' },
      { id: 'c7_t_elite', x: ARENA.elite[0] - 200, kind: 'dialog', dialog: 'c7_eliteIntro', enc: 'c7_elite', startEnc: 'c7_elite', flag: 'c7_elite_seen',
        focus: { x: ARENA.elite[0] + 600, y: -170, zoom: 0.95 } },
      { id: 'c7_t_coda', x: 10420, kind: 'dialog', dialog: 'c7_coda' },
      { id: 'c7_t_boss', x: ARENA.boss[0] - 200, kind: 'dialog', dialog: 'c7_bossIntro', enc: 'c7_boss', startEnc: 'c7_boss', flag: 'c7_boss_seen',
        focus: { x: ARENA.boss[0] + 800, y: -170, zoom: 0.95 }, music: 'c7_boss' },
    ],
    encounters: {
      // the first bar: two Rest Marks cross out the platforms you stand on (the floor is always there)
      c7_e1: { trigger: 1000, respawn: true, waves: [
        [{ t: 'c7_restmark', x: 1480, y: -150 }, { t: 'c7_restmark', x: 1720, y: -170 }],
        [{ t: 'c7_restmark', x: 1260, y: -160 }, { t: 'c7_restmark', x: 1880, y: -150 }]] },
      // your own sword, written in ink — then once more from the raised system
      c7_e2: { trigger: 1980, respawn: true, waves: [
        [{ t: 'c7_mirror', x: 2160 }],
        [{ t: 'c7_mirror', x: 2480 }, { t: 'c7_restmark', x: 2300, y: -150 }]] },
      // Ashport's square closes: the choir rings you, then the echo walks in
      c7_e3: { trigger: 3800, arena: ARENA.e3, waves: [
        [{ t: 'c7_choir', x: 3960, y: -40 }, { t: 'c7_choir', x: 4150, y: -40 }, { t: 'c7_choir', x: 4330, y: -40 }],
        [{ t: 'c7_mirror', x: 4300 }, { t: 'c7_restmark', x: 3900, y: -150 }, { t: 'c7_choir', x: 4120, y: -40 }]] },
      // the sunken bar: the tie is erased under you; an Ark soldier remembered in ink waits below
      c7_e4: { trigger: 4700, yMin: -60, respawn: true, waves: [
        [{ t: 'c7_restmark', x: 4950, y: -150 }, { t: 'c7_restmark', x: 5130, y: -170 }, { t: 'c7_mirror', x: 5020 }],
        [{ t: 'sentinel', x: 5060 }, { t: 'c7_restmark', x: 4880, y: -160 }]] },
      // the Opera's aisle: a Fermata holds the beat, the choir sings nothing
      c7_e5: { trigger: 8000, respawn: true, waves: [
        [{ t: 'c7_fermata', x: 8260 }, { t: 'c7_choir', x: 8060, y: -40 }, { t: 'c7_choir', x: 8420, y: -40 }],
        [{ t: 'c7_restmark', x: 8150, y: -150 }, { t: 'c7_restmark', x: 8450, y: -160 }]] },
      // the conductor's podium: two echoes and a dancer the Opera never forgot
      c7_e6: { trigger: 8660, respawn: true, waves: [
        [{ t: 'c7_mirror', x: 8830 }, { t: 'c7_mirror', x: 9060 }],
        [{ t: 'c4_marionette', x: 8900 }, { t: 'c7_restmark', x: 8780, y: -150 }]] },
      c7_elite: { manual: true, elite: true, arena: ARENA.elite, waves: [[{ t: 'c7_elite', x: ARENA.elite[0] + 700 }]] },
      // the last measures before the barline lock behind you
      c7_e7: { trigger: 10650, arena: ARENA.e7, waves: [
        [{ t: 'c7_fermata', x: 11020 }, { t: 'c7_restmark', x: 10760, y: -150 }, { t: 'c7_restmark', x: 11160, y: -170 }],
        [{ t: 'c7_choir', x: 10700, y: -40 }, { t: 'c7_choir', x: 10900, y: -40 }, { t: 'c7_choir', x: 11100, y: -40 }],
        [{ t: 'c7_mirror', x: 10780 }, { t: 'c7_mirror', x: 11120 }]] },
      c7_boss: { manual: true, boss: true, arena: ARENA.boss, waves: [[{ t: 'c7_boss', x: ARENA.boss[0] + 950 }]] },
    },
    zones: [
      { x: -1e9, name: '序奏・第一小節', en: 'PRELUDE — THE FIRST BAR', tint: 0, music: 'c7_explore', amb: 'c7_paper' },
      { x: ZX[1], name: '摺頁裡的灰港', en: 'ASHPORT, FOLDED INTO THE MARGIN', tint: 0.1, music: 'c7_explore', amb: 'c7_ashport' },
      { x: ZX[2], name: '長休止', en: 'THE LONG REST', tint: 0.25, music: 'c7_void', amb: 'c7_void' },
      { x: ZX[3], name: '回憶裡的歌劇院', en: 'THE OPERA, AS IT IS REMEMBERED', tint: 0.4, music: 'c7_explore2', amb: 'c7_opera' },
      { x: ZX[4], name: '終止線', en: 'THE FINAL BARLINE', tint: 0.6, music: 'c7_explore2', amb: 'c7_coda' },
    ],
    tintAt,
  };
  // a boss that hovers declares its own spawn height (contract: floor y = 0 unless the type says otherwise)
  { const BT = G.ENEMY_TYPES && G.ENEMY_TYPES.c7_boss; if (BT && BT.fly && BT.spawnY != null) level.encounters.c7_boss.waves[0][0].y = BT.spawnY; }

  /* =========================================================================================
     PALETTE + MATERIALS — ink, paper, gilt, and one red
     ========================================================================================= */
  const pal = {
    skyTop: ['#cdc4b2', '#07060a'], skyMid: ['#e3dbc9', '#17131c'], skyLow: ['#efe8d8', '#2c2632'], horizon: ['#f7f1e3', '#5b4f55'],
    far: ['#b4aca6', '#2a2430'], mid: ['#8f8796', '#1f1a25'], midDark: ['#5d5566', '#110e15'],
    near: ['#4a4352', '#0e0b12'], nearDark: ['#2a2430', '#07060a'], rim: ['#fff1c4', '#f2c766'],
    ground: ['#17131c', '#0e0b12'], groundDark: ['#0b0612', '#050407'], groundTop: ['#efe7d6', '#e9e1cf'],
    fog: ['#ddd5c6', '#1a1620'],
  };
  const C = {
    ink1: '#17131c', ink2: '#221d29', ink3: '#2f2937', ink4: '#3f3848', ink5: '#544c5e',
    pap: '#efe7d6', papL: '#fbf6ea', papS: '#d9cfbb', papD: '#b3a893', papDD: '#8a8070', papV: '#9b91a1',
    gold: '#f2c766', goldL: '#fff1c4', goldM: '#d9ad55', goldD: '#a8772f', goldDD: '#6e4c1f',
    red: '#d43b3f', redD: '#8e1f2c', redL: '#ff8a7a',
  };
  // a wash grey for a layer at a world x: paper-light by day, ink-dark by night (k = 0 light … 1 dark)
  function wash(x, k) {
    const n = nightAt(x);
    const day = mixH('#e6dfd1', '#4f4858', k), night = mixH('#5d5468', '#0f0c14', k);
    return mixH(day, night, n);
  }

  /* =========================================================================================
     PAINTER KIT — calligraphic brush strokes, cel fills, notation glyphs
     ========================================================================================= */
  const LX = 0.62, LY = -0.78;                  // light from the upper right (Rig convention)
  const ink = (g, w = 2, col = INK) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
  const poly = (g, pts, close = true) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); if (close) g.closePath(); };
  const rect = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  function glow(g, x, y, r, col, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // smooth closed curve through the midpoints of a polygon
  function blob(g, a) {
    const n = a.length; g.beginPath(); g.moveTo((a[n - 1][0] + a[0][0]) / 2, (a[n - 1][1] + a[0][1]) / 2);
    for (let i = 0; i < n; i++) { const p = a[i], q = a[(i + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    g.closePath();
  }
  // split a long band into world-aligned clipped chunks so a tile only replays what it shows
  function chunks(x0, x1, step, y, h, fn) {
    const out = [];
    for (let a = x0; a < x1; a += step) {
      const b = Math.min(x1, a + step), aa = a;
      out.push({ x: aa - 2, y, w: b - aa + 4, h, draw(g) { g.beginPath(); g.rect(aa, y - 10, b - aa, h + 20); g.clip(); fn(g, aa, b); } });
    }
    return out;
  }
  // a calligraphic stroke: centre line P (unit coords) with half-widths W, scaled by s around (ox, oy) → closed path
  function brushPath(g, P, W, s, ox, oy, keep) {
    const n = P.length, A = [], B = [];
    for (let i = 0; i < n; i++) {
      const p = P[Math.max(0, i - 1)], q = P[Math.min(n - 1, i + 1)];
      let dx = q[0] - p[0], dy = q[1] - p[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const w = W[i] * s, x = ox + P[i][0] * s, y = oy + P[i][1] * s;
      A.push([x - dy * w, y + dx * w]); B.push([x + dy * w, y - dx * w]);
    }
    if (!keep) g.beginPath();
    g.moveTo(A[0][0], A[0][1]);
    for (let i = 1; i < n - 1; i++) g.quadraticCurveTo(A[i][0], A[i][1], (A[i][0] + A[i + 1][0]) / 2, (A[i][1] + A[i + 1][1]) / 2);
    g.lineTo(A[n - 1][0], A[n - 1][1]); g.lineTo(B[n - 1][0], B[n - 1][1]);
    for (let i = n - 2; i > 0; i--) g.quadraticCurveTo(B[i][0], B[i][1], (B[i][0] + B[i - 1][0]) / 2, (B[i][1] + B[i - 1][1]) / 2);
    g.lineTo(B[0][0], B[0][1]); g.closePath();
  }
  // Hades-like cel paint on any path: shadow everywhere, the lit plane pushed toward the light, a warm rim, an ink contour
  function cel(g, path, lit, dark, d, rim, inkW = 2, inkCol = INK) {
    path(); g.fillStyle = dark; g.fill();
    if (lit && d > 0) { g.save(); path(); g.clip(); g.translate(LX * d, LY * d); path(); g.fillStyle = lit; g.fill(); g.restore(); }
    if (rim) { const r = Math.max(0.7, d * 0.3); g.save(); path(); g.clip(); g.translate(-LX * r, -LY * r); path(); g.strokeStyle = rim; g.lineWidth = r * 1.5; g.stroke(); g.restore(); }
    if (inkW > 0) { path(); g.strokeStyle = inkCol; g.lineWidth = inkW; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  }
  // notation, in staff-space units (origin on the reference line, y down); one pen stroke each + dots
  const GLYPH = {
    treble: {
      P: [[-0.62, 2.62], [-0.3, 3.02], [0.16, 2.98], [0.43, 2.48], [0.43, 1.6], [0.31, 0.4], [0.18, -0.9], [0.07, -2.1], [0.02, -3.1], [0.1, -3.95], [0.32, -4.52], [0.6, -4.42], [0.68, -3.9], [0.5, -3.25],
        [0.06, -2.62], [-0.55, -1.95], [-1.05, -1.18], [-1.22, -0.35], [-1.0, 0.45], [-0.44, 0.99], [0.32, 1.1], [0.9, 0.7], [1.04, 0.05], [0.74, -0.5], [0.15, -0.68], [-0.3, -0.4], [-0.37, 0.12]],
      W: [0.11, 0.12, 0.12, 0.13, 0.13, 0.12, 0.11, 0.1, 0.09, 0.07, 0.06, 0.08, 0.13, 0.17, 0.22, 0.27, 0.31, 0.33, 0.3, 0.24, 0.16, 0.13, 0.14, 0.13, 0.1, 0.07, 0.05],
      dots: [[-0.6, 2.56, 0.42]],
    },
    bass: { P: [[-0.55, -0.3], [-0.38, -0.82], [0.1, -1.1], [0.62, -0.98], [0.98, -0.5], [1.02, 0.2], [0.72, 0.9], [0.15, 1.5], [-0.45, 1.9], [-0.82, 2.06]],
      W: [0.16, 0.12, 0.1, 0.15, 0.22, 0.27, 0.24, 0.16, 0.09, 0.04], dots: [[-0.52, -0.3, 0.36], [1.44, -0.5, 0.15], [1.44, 0.5, 0.15]] },
    fermata: { P: [[-1.45, 0.05], [-1.25, -0.62], [-0.7, -1.12], [0, -1.32], [0.7, -1.12], [1.25, -0.62], [1.45, 0.05]], W: [0.04, 0.12, 0.2, 0.25, 0.2, 0.12, 0.04], dots: [[0, -0.14, 0.24]] },
    qrest: { P: [[-0.22, -1.62], [0.34, -0.92], [-0.2, -0.28], [0.32, 0.44], [-0.1, 0.62], [-0.38, 1.0], [-0.08, 1.46]], W: [0.06, 0.34, 0.08, 0.34, 0.17, 0.12, 0.05] },
    erest: { P: [[-0.32, -0.6], [0.1, -0.48], [0.47, -0.72], [0.2, 0.2], [-0.08, 1.06]], W: [0.06, 0.06, 0.08, 0.07, 0.05], dots: [[-0.3, -0.62, 0.25]] },
    slur: { P: [[-2, 0], [-1.3, -0.62], [0, -0.9], [1.3, -0.62], [2, 0]], W: [0.02, 0.09, 0.13, 0.09, 0.02] },
  };
  function glyphPath(g, key, x, y, s, flip = 1) {
    const D = GLYPH[key], P = flip === 1 ? D.P : D.P.map((p) => [p[0] * flip, p[1]]);
    brushPath(g, P, D.W, s, x, y);
    if (D.dots) for (const [dx, dy, r] of D.dots) { g.moveTo(x + dx * s * flip + r * s, y + dy * s); g.arc(x + dx * s * flip, y + dy * s, r * s, 0, TAU); }
  }
  // o: { lit, dark, rim, d, inkW, inkCol, flip }
  function glyph(g, key, x, y, s, o = {}) {
    cel(g, () => glyphPath(g, key, x, y, s, o.flip || 1), o.lit ?? C.ink3, o.dark || C.ink1, o.d ?? s * 0.14, o.rim, o.inkW ?? Math.max(0.8, s * 0.07), o.inkCol || INK);
  }
  // a note head (tilted oval), filled or open, with optional stem (+ up / - down) and flags
  function noteHead(g, x, y, s, filled, col, inkCol = INK, inkW = 1) {
    g.save(); g.translate(x, y); g.rotate(-0.38);
    g.beginPath(); g.ellipse(0, 0, s * 0.66, s * 0.46, 0, 0, TAU);
    g.fillStyle = col; g.fill(); if (inkW > 0) { g.strokeStyle = inkCol; g.lineWidth = inkW; g.stroke(); }
    if (!filled) { g.beginPath(); g.ellipse(0.06 * s, 0, s * 0.42, s * 0.2, -0.5, 0, TAU); g.fillStyle = inkCol === INK ? mixH(col, INK, 0.88) : inkCol; g.fill(); }
    g.restore();
  }
  function note(g, x, y, s, o = {}) {
    const col = o.col || C.ink1, up = o.up ?? 1, sx = x + (up > 0 ? s * 0.6 : -s * 0.6), len = s * (o.len || 3.3);
    g.strokeStyle = o.stemCol || col; g.lineWidth = Math.max(1, s * 0.11); g.lineCap = 'butt';
    g.beginPath(); g.moveTo(sx, y - up * s * 0.15); g.lineTo(sx, y - up * len); g.stroke();
    for (let f = 0; f < (o.flags || 0); f++) {
      const fy = y - up * (len - f * s * 0.75);
      g.beginPath(); g.moveTo(sx, fy); g.bezierCurveTo(sx + s * 0.25, fy + up * s * 0.5, sx + s * 1.05, fy + up * s * 0.75, sx + s * 0.7, fy + up * s * 1.8);
      g.lineTo(sx + s * 0.6, fy + up * s * 1.7); g.bezierCurveTo(sx + s * 0.8, fy + up * s * 1.0, sx + s * 0.2, fy + up * s * 0.9, sx, fy + up * s * 0.55);
      g.closePath(); g.fillStyle = o.stemCol || col; g.fill();
    }
    noteHead(g, x, y, s, o.filled !== false, col, o.inkCol || INK, o.inkW ?? Math.max(0.6, s * 0.08));
  }
  // five lines (gap = staff space) — the floor, the sky, the threads
  function staffLines(g, x0, x1, y, gap, col, w) { g.fillStyle = col; for (let i = 0; i < 5; i++) g.fillRect(x0, y + i * gap - w / 2, x1 - x0, w); }
  function sharp(g, x, y, s, col) {
    g.fillStyle = col; g.fillRect(x - s * 0.32, y - s * 1.4, s * 0.1, s * 2.7); g.fillRect(x + s * 0.22, y - s * 1.6, s * 0.1, s * 2.7);
    for (const o of [-0.45, 0.45]) { g.beginPath(); g.moveTo(x - s * 0.62, y + o * s + s * 0.14); g.lineTo(x + s * 0.62, y + o * s - s * 0.2); g.lineTo(x + s * 0.62, y + o * s - s * 0.02); g.lineTo(x - s * 0.62, y + o * s + s * 0.32); g.fill(); }
  }
  function flat(g, x, y, s, col) {
    g.fillStyle = col; g.fillRect(x - s * 0.35, y - s * 2.2, s * 0.1, s * 2.6);
    g.beginPath(); g.moveTo(x - s * 0.3, y + s * 0.4); g.bezierCurveTo(x + s * 0.9, y - s * 0.3, x + s * 0.5, y - s * 1.1, x - s * 0.3, y - s * 0.3);
    g.lineTo(x - s * 0.3, y - s * 0.05); g.bezierCurveTo(x + s * 0.25, y - s * 0.6, x + s * 0.5, y - s * 0.2, x - s * 0.3, y + s * 0.22); g.closePath(); g.fill();
  }
  function text(g, txt, x, y, size, col, o = {}) {
    g.save(); g.font = `${o.italic === false ? '' : 'italic '}${o.weight || 600} ${size}px ${o.font || '"Cormorant Garamond", "Noto Serif TC", serif'}`;
    g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
    if (o.ink) { g.lineWidth = o.ink; g.strokeStyle = o.inkCol || INK; g.lineJoin = 'round'; g.strokeText(txt, x, y); }
    g.fillStyle = col; g.fillText(txt, x, y); g.restore();
  }
  const DYN = ['pp', 'p', 'mp', 'mf', 'dolce', 'rit.', 'morendo', 'a tempo', 'sostenuto', 'perdendosi', 'lontano', 'smorzando', 'calando', 'niente'];
  // a torn edge (paper fibres) along a horizontal line, as a polygon you can fill
  function tornEdge(rng, x0, x1, y, amp, step = 7) { const pts = []; for (let x = x0; x <= x1; x += step * (0.6 + rng() * 0.8)) pts.push([x, y + (rng() - 0.5) * amp * 2]); pts.push([x1, y]); return pts; }

  /* =========================================================================================
     SKY (screen space, per frame) — paper, slow ink falling through it, a whole-note sun that fills in as you
     near the Heart (it becomes the black sun), the red thread, and the abyss under the Long Rest
     ========================================================================================= */
  const SKY = { plumes: null, stars: null };
  // ink dropped into still water: soft dabs walking down a curling flow, then hair-fine filaments (baked once)
  function makePlume(seed, light) {
    // slow ink, drawn the way an inker would: a scroll-cloud of lobes with an ink contour, two flat wash tones, curls
    // rolling off its ends, long wisps trailing, and a few drips of ink hanging from its belly. Baked once.
    const W = 620, H = 300, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), rng = U.mulberry32(seed);
    const K = light ? { line: '#ece4d4', body: '#9a91a2', dark: '#756c80', lit: '#cfc6bc' } : { line: '#120e17', body: '#5c5464', dark: '#3c3546', lit: '#7f7787' };
    const lobes = [];
    let x = 70;
    while (x < W - 90) { const r = 20 + rng() * 30; lobes.push([x + r * 0.5, 130 - rng() * 34 - r * 0.35 + Math.sin(x * 0.012) * 10, r]); x += r * (0.85 + rng() * 0.45); }
    const x0 = lobes[0][0], x1 = lobes[lobes.length - 1][0], base = 150;
    const belly = []; for (let bx = x0 + 10; bx < x1; bx += 34 + rng() * 16) belly.push([bx, base - 16 + rng() * 6, 26 + rng() * 10]);
    const mass = (dx = 0, dy = 0) => {
      g.beginPath();
      for (const [lx, ly, r] of lobes) { g.moveTo(lx + r + dx, ly + dy); g.arc(lx + dx, ly + dy, r, 0, TAU); }
      for (const [lx, ly, r] of belly) { g.moveTo(lx + r * 1.4 + dx, ly + dy); g.ellipse(lx + dx, ly + dy, r * 1.4, r * 0.62, 0, 0, TAU); }
      for (let k = 0; k < lobes.length - 1; k++) { const a = lobes[k], b = lobes[k + 1], mx = (a[0] + b[0]) / 2; g.moveTo(mx + 30 + dx, (a[1] + b[1]) / 2 + 22 + dy); g.ellipse(mx + dx, (a[1] + b[1]) / 2 + 22 + dy, 30, 26, 0, 0, TAU); }
    };
    // contour first (wide), then the opaque body over it: only the outer half of the line survives
    g.lineJoin = 'round'; mass(); g.strokeStyle = K.line; g.lineWidth = 5; g.stroke();
    mass(); g.fillStyle = K.body; g.fill();
    g.save(); mass(); g.clip();
    mass(-7, 12); g.fillStyle = K.dark; g.fill();
    mass(9, -12); g.fillStyle = K.body; g.fill();
    mass(16, -22); g.fillStyle = K.lit; g.fill();
    // wash striations
    g.strokeStyle = rgba(K.line, 0.18); g.lineWidth = 1;
    for (let k = 0; k < 5; k++) { const yy = 118 + k * 8 + rng() * 4; g.beginPath(); g.moveTo(x0 - 20, yy); g.bezierCurveTo(x0 + 120, yy - 8, x1 - 120, yy + 8, x1 + 20, yy); g.stroke(); }
    g.restore();
    // curls rolling off the ends and out of a few lobes
    const curl = (cx, cy, r, dir) => {
      g.beginPath();
      for (let i = 0; i <= 26; i++) { const t = i / 26, a = dir * t * TAU * 1.3, rr = r * (1 - t * 0.85); const px = cx + Math.cos(a) * rr * dir, py = cy + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.strokeStyle = K.line; g.lineWidth = 3.2; g.lineCap = 'round'; g.stroke();
    };
    curl(x0 - 6, base - 18, 22, -1); curl(x1 + 8, base - 22, 24, 1);
    { const k = 1 + Math.floor(rng() * (lobes.length - 2)), [lx, ly, r] = lobes[k]; curl(lx + r * 0.25, ly - r * 0.1, r * 0.5, rng() < 0.5 ? 1 : -1); }
    // wisps trailing off both ends
    g.lineCap = 'round';
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      const sx = side < 0 ? x0 - 10 : x1 + 10, sy = base - 30 + k * 12;
      g.beginPath(); g.moveTo(sx, sy);
      g.bezierCurveTo(sx + side * (40 + k * 10), sy - 20 - k * 6, sx + side * (80 + k * 20), sy + 14, sx + side * (110 + k * 30 + rng() * 30), sy - 4 + k * 8);
      g.strokeStyle = rgba(K.line, 0.75 - k * 0.18); g.lineWidth = 2.2 - k * 0.5; g.stroke();
    }
    // ink hanging from its belly
    for (let k = 0; k < 4; k++) {
      const dx = x0 + 30 + rng() * (x1 - x0 - 60), len = 20 + rng() * 70, wd = 1.6 + rng() * 2.2;
      g.fillStyle = K.line; g.beginPath(); g.moveTo(dx - wd, base); g.lineTo(dx - wd * 0.4, base + len); g.quadraticCurveTo(dx - wd * 1.8, base + len + wd * 1.4, dx, base + len + wd * 2.4); g.quadraticCurveTo(dx + wd * 1.8, base + len + wd * 1.4, dx + wd * 0.4, base + len); g.lineTo(dx + wd, base); g.closePath(); g.fill();
    }
    return c;
  }
  function skyInit() {
    // the plumes are baked one per frame (no hitch on the chapter's first frame)
    if (!SKY.plumes) SKY.plumes = [];
    if (SKY.plumes.length < 4) SKY.plumes.push(makePlume(7171 + SKY.plumes.length, SKY.plumes.length >= 2));
    if (SKY.stars) return;
    const r = U.mulberry32(7175); SKY.stars = Array.from({ length: 46 }, () => ({ x: r(), y: r(), s: 0.6 + r() * 1.6, p: r() * 10 }));
  }
  function drawSky(ctx, cam, W, H, S, time) {
    skyInit();
    const x = cam.x, n = nightAt(x), v = voidAt(x), co = codaAt(x), op = operaAt(x);
    const hY = H / 2 + (60 - cam.y * 0.03) * S;
    const top = mixH('#b0a591', '#060509', n), mid = mixH('#c9bfaa', '#17121c', n), lo = mixH('#d9cfbb', '#352c3a', n);
    const hor = mixH('#ebe2cf', mixH('#73605a', '#9a7448', co), n);
    const gr = ctx.createLinearGradient(0, 0, 0, hY + 40 * S);
    gr.addColorStop(0, top); gr.addColorStop(0.46, mid); gr.addColorStop(0.84, lo); gr.addColorStop(1, hor);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // the sun: a whole note (open), filling in toward the Heart — at the barline it is a black sun with a gilt corona
    {
      const sx = W * 0.76 - x * 0.006 * S, sy = hY - (262 + 20 * op) * S, R = (56 + 14 * co) * S;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const cg = ctx.createRadialGradient(sx, sy, R * 0.5, sx, sy, R * 3.2);
      cg.addColorStop(0, `rgba(255,226,150,${0.2 + 0.25 * co})`); cg.addColorStop(0.35, `rgba(242,199,102,${0.08 + 0.12 * co})`); cg.addColorStop(1, 'rgba(242,199,102,0)');
      ctx.fillStyle = cg; ctx.fillRect(sx - R * 3.3, sy - R * 3.3, R * 6.6, R * 6.6);
      ctx.restore();
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(-0.36);
      const hole = clamp(1 - co * 1.6, 0, 1);
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.32, R * 0.92, 0, 0, TAU);
      if (hole > 0.01) ctx.ellipse(R * 0.04, 0, R * 0.8 * hole, R * 0.42 * hole, -0.62, 0, TAU, true);
      ctx.fillStyle = mixH(mixH('#fff6dc', '#f2c766', 0.35 + 0.4 * n), '#0b0811', co); ctx.fill('evenodd');
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.32, R * 0.92, 0, 0, TAU);
      ctx.lineWidth = 2.4 * S; ctx.strokeStyle = co > 0.5 ? 'rgba(255,214,130,0.9)' : rgba(INK, 0.55); ctx.stroke();
      if (co > 0.02) {
        // the black sun's corona: a thin gilt ring and long, faint rays
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.ellipse(0, 0, R * 1.4, R * 1.0, 0, 0, TAU); ctx.strokeStyle = `rgba(255,236,190,${0.55 * co})`; ctx.lineWidth = 1.2 * S; ctx.stroke();
        ctx.strokeStyle = `rgba(255,214,130,${0.18 * co})`; ctx.lineWidth = 1.4 * S; ctx.beginPath();
        for (let k = 0; k < 18; k++) { const a = k / 18 * TAU + time * 0.01, r0 = R * 1.5, r1 = R * (2.2 + 0.9 * ((k * 7) % 5) / 5); ctx.moveTo(Math.cos(a) * r0 * 1.3, Math.sin(a) * r0 * 0.9); ctx.lineTo(Math.cos(a) * r1 * 1.3, Math.sin(a) * r1 * 0.9); }
        ctx.stroke();
      }
      ctx.restore();
    }
    // slow ink: scroll-clouds drawn in ink, drifting across the top of the page (pale ink by night)
    {
      const PL = SKY.plumes, cnt = low() ? 2 : 3, span = W * 1.9, HY = [250, 330, 196], SC = [1.05, 1.3, 0.78];
      for (let i = 0; i < cnt; i++) {
        const sc = SC[i] * S, w = 620 * sc, h = 300 * sc;
        const px = (((i * 0.41 + 0.07) * span - x * (0.012 + i * 0.005) * S + time * (2.4 + i * 0.9) * S) % span + span) % span - w * 0.55;
        const py = hY - HY[i] * S - h * 0.42 + Math.sin(time * 0.07 + i * 2) * 6 * S - cam.y * 0.012 * S;
        const aD = (1 - n) * [0.72, 0.6, 0.42][i] * (1 - 0.6 * v), aL = n * [0.5, 0.42, 0.3][i];
        const dI = PL[i % 2], lI = PL[2 + (i % 2)];
        if (aD > 0.02 && dI) { ctx.globalAlpha = aD; ctx.drawImage(dI, px, py, w, h); }
        if (aL > 0.02 && lI) { ctx.globalAlpha = aL; ctx.drawImage(lI, px, py, w, h); }
      }
      ctx.globalAlpha = 1;
    }
    // the abyss beneath the Long Rest (the layers leave it open)
    if (v > 0.01) {
      const ag = ctx.createLinearGradient(0, hY - 20 * S, 0, H);
      ag.addColorStop(0, `rgba(58,50,66,0)`); ag.addColorStop(0.18, `rgba(40,33,48,${0.85 * v})`); ag.addColorStop(1, `rgba(6,5,9,${v})`);
      ctx.fillStyle = ag; ctx.fillRect(0, hY - 20 * S, W, H - hY + 20 * S);
      ctx.fillStyle = 'rgba(255,246,222,0.9)';
      for (const s of SKY.stars) {
        const px = ((s.x * W * 1.3 - x * 0.03 * S) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15, py = hY + 40 * S + s.y * (H - hY);
        const a = v * (0.25 + 0.35 * Math.sin(time * 0.9 + s.p));
        if (a > 0.05) { ctx.globalAlpha = a; ctx.fillRect(px, py, s.s * S, s.s * S); }
      }
      ctx.globalAlpha = 1;
    }
    // the red thread: Mira's scarf, unravelled across the whole page (the only red in the sky)
    const ashK = sstep(2300, 2800, x) * (1 - sstep(4800, 5300, x));
    if (ashK < 0.98) {
      ctx.globalAlpha = 1 - ashK;
      const y0 = hY - (236 - 50 * co) * S, ph = x * 0.0011;
      ctx.beginPath();
      for (let j = 0; j <= 32; j++) {
        const px = -60 + j / 32 * (W + 120), u = px / S;
        const py = y0 + Math.sin(u * 0.0042 + ph * 6 + time * 0.2) * 34 * S + Math.sin(u * 0.012 - time * 0.33 + ph * 9) * 9 * S + Math.sin(u * 0.0019 + ph) * 46 * S;
        if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(80,14,26,0.3)'; ctx.lineWidth = 2.6 * S; ctx.stroke();
      ctx.strokeStyle = 'rgba(212,59,63,0.8)'; ctx.lineWidth = 1.3 * S; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    return true;
  }

  /* =========================================================================================
     PARALLAX — FAR (f 0.08): the cities the Rest remembers, hanging upside down from the top of the page
     (the Ark's belly · Ashport's spires · the Belfry's mountain with the Ladder falling out of it · Lyra's domes),
     and their upright reflections standing in a sea of ink-mist at the horizon. Under the Long Rest the page is torn.
     ========================================================================================= */
  const FAR_F = 0.08, MID_F = 0.22, NEAR_F = 0.45;
  const FAR_VOID = [LINE.x0 * FAR_F + 4, LINE.x1 * FAR_F - 4];
  const mistTop = (x) => -118 + Math.sin(x * 0.011) * 13 + Math.sin(x * 0.037 + 1) * 6 + Math.sin(x * 0.093 + 2) * 3;
  // an upright city block (drawn mirrored for the hanging cities): body, roof by kind, lit windows
  function cityBlock(g, rr, x, base, w, h, kind, body, shade, line, win) {
    const top = base - h;
    g.beginPath(); g.moveTo(x, base + 4); g.lineTo(x, top);
    if (kind === 'spire') { g.lineTo(x + w * 0.15, top); g.lineTo(x + w / 2, top - h * 0.55); g.lineTo(x + w * 0.85, top); }
    else if (kind === 'gable') g.lineTo(x + w / 2, top - w * 0.55);
    else if (kind === 'dome') { g.lineTo(x + w * 0.08, top); g.bezierCurveTo(x + w * 0.05, top - w * 0.75, x + w * 0.95, top - w * 0.75, x + w * 0.92, top); }
    else if (kind === 'tower') { g.lineTo(x + w * 0.1, top); g.lineTo(x + w * 0.1, top - 8); g.lineTo(x + w * 0.3, top - 8); g.lineTo(x + w * 0.5, top - h * 0.3); g.lineTo(x + w * 0.7, top - 8); g.lineTo(x + w * 0.9, top - 8); g.lineTo(x + w * 0.9, top); }
    g.lineTo(x + w, top); g.lineTo(x + w, base + 4); g.closePath();
    g.fillStyle = body; g.fill(); g.strokeStyle = line; g.lineWidth = 1.2; g.stroke();
    g.save(); g.clip(); g.fillStyle = shade; g.fillRect(x, top - h, w * 0.32, h * 2 + 10); g.restore();
    if (kind === 'dome') { g.strokeStyle = line; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + w / 2, top - w * 0.56); g.lineTo(x + w / 2, top - w * 0.56 - 12); g.stroke(); }
    if (kind === 'tower') { g.fillStyle = line; g.beginPath(); g.ellipse(x + w / 2, top + 10, w * 0.16, 7, 0, 0, TAU); g.fill(); }
    g.fillStyle = win;
    for (let yy = top + 8; yy < base - 6; yy += 9 + rr() * 5) for (let xx = x + 3; xx < x + w - 3; xx += 5 + rr() * 2) if (rr() < 0.18) g.fillRect(xx, yy, 1.6, 2.4);
  }
  // far colours are camera-independent (the far layer shows ±7000 px of the world at once): neutral ink washes,
  // translucent, so the per-frame sky behind them carries the zone's mood (pale by day, ink by night)
  const FC = { body: 'rgba(98,90,108,0.42)', shade: 'rgba(62,55,72,0.46)', line: 'rgba(11,6,18,0.34)', win: 'rgba(242,199,102,0.8)', mist0: 'rgba(132,124,140,0.4)', mist1: 'rgba(92,84,102,0.62)', mist2: 'rgba(52,46,60,0.9)' };
  function genFar() {
    const f = FAR_F, x0 = -760, x1 = 1780, objs = [], rng = U.mulberry32(7101);
    // 1) the ink-mist sea (torn open over the Long Rest)
    objs.push(...chunks(x0, x1, 512, -200, 920, (g, a, b) => {
      for (const [s0, s1] of [[a - 6, Math.min(b + 6, FAR_VOID[0])], [Math.max(a - 6, FAR_VOID[1]), b + 6]]) {
        if (s1 <= s0) continue;
        g.beginPath(); g.moveTo(s0, 720);
        for (let xx = s0; xx <= s1; xx += 6) g.lineTo(xx, mistTop(xx));
        g.lineTo(s1, 720); g.closePath();
        const mg = g.createLinearGradient(0, -140, 0, 220); mg.addColorStop(0, FC.mist0); mg.addColorStop(0.45, FC.mist1); mg.addColorStop(1, FC.mist2);
        g.fillStyle = mg; g.fill();
        // ruled lines receding into the mist (a staff the size of an ocean)
        g.strokeStyle = 'rgba(40,34,48,0.22)'; g.lineWidth = 0.9;
        for (let i = 0; i < 5; i++) { const yy = -46 + i * 8 + i * i * 1.6; g.beginPath(); g.moveTo(s0, yy); g.lineTo(s1, yy); g.stroke(); }
        g.strokeStyle = 'rgba(255,248,230,0.4)'; g.lineWidth = 1.2;
        g.beginPath(); for (let xx = s0; xx <= s1; xx += 6) { const yy = mistTop(xx); if (xx === s0) g.moveTo(xx, yy + 1); else g.lineTo(xx, yy + 1); } g.stroke();
      }
      // the torn edges of the page around the Long Rest
      for (const ex of FAR_VOID) {
        if (ex < a - 30 || ex > b + 30) continue;
        const rr = U.mulberry32(Math.floor(ex) * 3), dir = ex === FAR_VOID[0] ? -1 : 1;
        g.strokeStyle = 'rgba(255,248,230,0.35)'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(ex, mistTop(ex)); for (let yy = mistTop(ex); yy < 300; yy += 8) g.lineTo(ex + dir * (rr() * 5), yy); g.stroke();
        for (let k = 0; k < 9; k++) { const yy = mistTop(ex) + 10 + rr() * 200; g.beginPath(); g.moveTo(ex, yy); g.quadraticCurveTo(ex - dir * 8, yy + 14, ex - dir * (4 + rr() * 10), yy + 30 + rr() * 30); g.stroke(); }
      }
    }));
    // 2) the cities, hanging (and standing, reflected, in the mist)
    const ceil = -600;
    const zoneKinds = (lx) => (lx < 210 ? ['block', 'tower', 'block'] : lx < FAR_VOID[0] ? ['spire', 'gable', 'tower', 'spire'] : lx < FAR_VOID[1] ? null : lx < 840 ? ['dome', 'block', 'dome', 'spire'] : 'end');
    let x = x0;
    while (x < 900) {
      const kinds = zoneKinds(x); if (kinds === 'end') break;
      const w = 16 + rng() * 34, hang = 230 + rng() * 240, seed = rng() * 1e6 | 0, bx = x, rh = 30 + rng() * 70, pick = rng();
      if (kinds && !(bx > -420 && bx < 150)) {
        const kind = kinds[Math.floor(pick * kinds.length)];
        objs.push({ x: bx - 4, y: ceil - 40, w: w + 8, h: hang + w + 120, draw(g) {
          g.save(); g.translate(0, ceil); g.scale(1, -1);
          cityBlock(g, U.mulberry32(seed), bx, 0, w, hang, kind, FC.body, FC.shade, FC.line, FC.win);
          g.restore();
        } });
        objs.push({ x: bx - 4, y: -300, w: w + 8, h: 300, draw(g) {
          g.globalAlpha = 0.6; cityBlock(g, U.mulberry32(seed + 1), bx, mistTop(bx + w / 2) + 4, w, rh, kind, FC.body, FC.shade, 'rgba(11,6,18,0.16)', 'rgba(242,199,102,0.5)'); g.globalAlpha = 1;
        } });
      }
      x += w + 4 + rng() * 26;
    }
    // the Ark's belly (where Rinne climbed out through CANTOR's iris)
    objs.push({ x: -470, y: -640, w: 640, h: 420, draw(g) {
      const cx = -150, cy = -420, rx = 290, ry = 120;
      const hull = () => { g.beginPath(); g.moveTo(cx - rx, cy - 200); g.lineTo(cx - rx, cy); g.ellipse(cx, cy, rx, ry, 0, PI, 0, true); g.lineTo(cx + rx, cy - 200); g.closePath(); };
      hull(); g.fillStyle = 'rgba(236,230,218,0.34)'; g.fill(); g.strokeStyle = FC.line; g.lineWidth = 1.6; g.stroke();
      g.save(); hull(); g.clip(); g.fillStyle = FC.shade; g.beginPath(); g.ellipse(cx - 70, cy + 24, rx, ry * 0.9, 0, 0, TAU); g.fill();
      g.fillStyle = FC.win; const rr = U.mulberry32(77);
      for (let k = 0; k < 4; k++) { const yy = cy - 60 + k * 22; for (let xx = cx - rx + 20; xx < cx + rx - 20; xx += 7) if (rr() < 0.4) g.fillRect(xx, yy, 1.8, 2.2); }
      g.restore();
      g.strokeStyle = 'rgba(11,6,18,0.3)'; g.lineWidth = 7; g.beginPath(); g.ellipse(cx, cy - 6, rx + 30, 26, 0, 0, PI); g.stroke();
      g.strokeStyle = 'rgba(236,230,218,0.4)'; g.lineWidth = 4; g.stroke();
      glow(g, cx + 20, cy + ry - 8, 60, C.gold, 0.4);
      g.beginPath(); g.ellipse(cx + 20, cy + ry - 14, 26, 9, 0, 0, TAU); g.fillStyle = '#fff1c4'; g.fill(); g.strokeStyle = FC.line; g.lineWidth = 1.2; g.stroke();
    } });
    // the Belfry: its mountain hangs upside down over the torn page; the Ladder falls out of it into the abyss
    objs.push({ x: FAR_VOID[0] - 40, y: -640, w: FAR_VOID[1] - FAR_VOID[0] + 80, h: 1360, draw(g) {
      const cx = (FAR_VOID[0] + FAR_VOID[1]) / 2, tip = -250, rr = U.mulberry32(91);
      const rock = () => { g.beginPath(); g.moveTo(cx - 120, -640); g.lineTo(cx - 105, -470); g.lineTo(cx - 70, -380); g.lineTo(cx - 34, -300); g.lineTo(cx - 6, tip); g.lineTo(cx + 10, tip + 6); g.lineTo(cx + 40, -320); g.lineTo(cx + 80, -420); g.lineTo(cx + 118, -520); g.lineTo(cx + 125, -640); g.closePath(); };
      rock(); g.fillStyle = 'rgba(98,90,108,0.42)'; g.fill(); g.strokeStyle = FC.line; g.lineWidth = 1.3; g.stroke();
      g.save(); rock(); g.clip(); g.fillStyle = FC.shade; g.beginPath(); g.moveTo(cx - 130, -640); g.lineTo(cx - 10, tip + 10); g.lineTo(cx - 140, tip); g.fill(); g.restore();
      g.save(); g.translate(0, -640); g.scale(1, -1);
      for (let k = 0; k < 12; k++) { const t = rr(), side = rr() < 0.5 ? -1 : 1, yy = 120 + t * 260, wx2 = cx + side * (110 - t * 95) - (side > 0 ? 12 : 0); cityBlock(g, rr, wx2, yy - 4, 12 + rr() * 8, 10 + rr() * 10, 'gable', FC.body, FC.shade, FC.line, 'rgba(242,199,102,0.9)'); }
      cityBlock(g, rr, cx - 9, 384, 20, 46, 'tower', FC.body, FC.shade, FC.line, 'rgba(242,199,102,0.9)');
      g.restore();
      const lg = g.createLinearGradient(0, tip, 0, 720); lg.addColorStop(0, 'rgba(255,236,190,0.9)'); lg.addColorStop(1, 'rgba(255,236,190,0)');
      g.fillStyle = lg; g.fillRect(cx + 1, tip + 40, 1.6, 680);
      glow(g, cx + 2, tip + 52, 18, C.goldL, 0.5);
    } });
    // the final pages: no cities, only staves running down out of the dark like rain
    objs.push(...chunks(840, x1, 256, -640, 560, (g, a, b) => {
      const rr = U.mulberry32(Math.floor(a) + 404);
      for (let k = 0; k < 4; k++) {
        const xx = a + rr() * (b - a), len = 140 + rr() * 260, al = 0.14 + rr() * 0.14;
        g.fillStyle = `rgba(232,224,206,${al})`;
        for (let i = 0; i < 5; i++) g.fillRect(xx + i * 3.2, -640, 0.8, 260 + len);
        if (rr() < 0.5) { g.fillStyle = `rgba(242,199,102,${al * 2})`; g.beginPath(); g.ellipse(xx + 6, -380 + len, 4, 2.8, -0.4, 0, TAU); g.fill(); }
      }
    }));
    return objs;
  }

  /* =========================================================================================
     PARALLAX — MID (f 0.22): torn scraps of score drifting with their glyphs; Ashport's bell tower hanging
     upside down; the Belfry's great bell sinking through the abyss; the Opera's proscenium and its chandelier;
     the colossal double barline at the end of everything
     ========================================================================================= */
  const MID_VOID = [LINE.x0 * MID_F + 6, LINE.x1 * MID_F - 6];
  const midBase = () => -14;
  // a torn scrap of score floating in the air: paper face with a staff, ragged underside, threads hanging off it
  function scrap(g, rr, x, y, w, col, dark, line, o = {}) {
    // a curled leaf of manuscript paper seen edge-on: its ruled face, a thin shadowed underside, fibres trailing
    const th = o.th || 10 + w * 0.05;
    const face = [[x + 3, y], [x + w - 3, y]];
    for (let q = 0; q <= 4; q++) face.push([x + w + (rr() - 0.5) * 5, y + q * th / 4]);
    for (let xx = x + w - 6; xx > x + 4; xx -= 7 + rr() * 6) face.push([xx, y + th + (rr() - 0.3) * 3]);
    for (let q = 4; q >= 0; q--) face.push([x + (rr() - 0.5) * 5, y + q * th / 4]);
    poly(g, face.map((p) => [p[0], p[1] + th * 0.45])); g.fillStyle = dark; g.fill();
    poly(g, face); g.fillStyle = col; g.fill(); g.strokeStyle = line; g.lineWidth = 1.1; g.stroke();
    g.fillStyle = rgba(line, 0.7); for (let i = 0; i < 5; i++) g.fillRect(x + 4, y + 1.6 + i * th * 0.17, w - 8, 0.7);
    for (let k = 0; k < w / 16; k++) { g.beginPath(); g.ellipse(x + 8 + rr() * (w - 16), y + 1.6 + Math.floor(rr() * 9) * th * 0.085, 1.6, 1.1, -0.4, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,248,226,0.7)'; g.fillRect(x + 3, y - 0.6, w - 6, 1.1);
    g.strokeStyle = rgba(line, 0.4); g.lineWidth = 0.7;
    for (let k = 0; k < w / 34; k++) { const xx = x + 6 + rr() * (w - 12), yy = y + th * 1.4; g.beginPath(); g.moveTo(xx, yy); g.quadraticCurveTo(xx + (rr() - 0.5) * 14, yy + 16, xx + (rr() - 0.5) * 8, yy + 22 + rr() * 36); g.stroke(); }
  }
  // Ashport's cathedral bell tower (upright; mirrored where it hangs): shaft, buttresses, lancets, an open belfry, spire
  function bellTower(g, x, base, w, h, Cb, rr) {
    const top = base - h, bfy = top + 40, bfh = 70;
    const body = [[x, base], [x, bfy], [x + w * 0.5, top - h * 0.22], [x + w, bfy], [x + w, base]];
    cel(g, () => poly(g, body), Cb.lit, Cb.body, 7, Cb.rim, 1.8, Cb.line);
    // spire ribs and crockets
    g.strokeStyle = Cb.line; g.lineWidth = 1; g.beginPath(); g.moveTo(x + w * 0.5, top - h * 0.22); g.lineTo(x + w * 0.5, bfy); g.stroke();
    for (let k = 1; k < 6; k++) { const t = k / 6, yy = top - h * 0.22 + (bfy - top + h * 0.22) * t, hw = w * 0.5 * t; g.beginPath(); g.moveTo(x + w / 2 - hw, yy); g.lineTo(x + w / 2 - hw - 4, yy - 3); g.moveTo(x + w / 2 + hw, yy); g.lineTo(x + w / 2 + hw + 4, yy - 3); g.stroke(); }
    // belfry: two open arches with the bell inside
    for (let i = 0; i < 2; i++) {
      const ax = x + 8 + i * (w / 2 - 4), aw = w / 2 - 12;
      g.beginPath(); g.moveTo(ax, bfy + bfh); g.lineTo(ax, bfy + 22); g.quadraticCurveTo(ax + aw / 2, bfy + 2, ax + aw, bfy + 22); g.lineTo(ax + aw, bfy + bfh); g.closePath();
      g.fillStyle = Cb.hole; g.fill(); g.strokeStyle = Cb.line; g.lineWidth = 1.4; g.stroke();
    }
    const bx = x + w / 2, by = bfy + 30;
    g.beginPath(); g.moveTo(bx - 4, by - 16); g.quadraticCurveTo(bx - 14, by - 14, bx - 15, by + 6); g.lineTo(bx - 20, by + 14); g.lineTo(bx + 20, by + 14); g.lineTo(bx + 15, by + 6); g.quadraticCurveTo(bx + 14, by - 14, bx + 4, by - 16); g.closePath();
    g.fillStyle = Cb.gold; g.fill(); g.strokeStyle = Cb.line; g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = Cb.line; g.lineWidth = 0.9; g.beginPath(); g.moveTo(bx + 3, by - 12); g.lineTo(bx - 2, by - 2); g.lineTo(bx + 4, by + 8); g.stroke();
    // shaft: lancet windows, string courses, buttresses
    for (let yy = bfy + bfh + 24; yy < base - 30; yy += 64) {
      g.fillStyle = Cb.line; g.fillRect(x - 2, yy - 6, w + 4, 3);
      for (const lx of [x + w * 0.22, x + w * 0.62]) { g.beginPath(); g.moveTo(lx, yy + 40); g.lineTo(lx, yy + 12); g.quadraticCurveTo(lx + w * 0.08, yy, lx + w * 0.16, yy + 12); g.lineTo(lx + w * 0.16, yy + 40); g.closePath(); g.fillStyle = rr() < 0.3 ? 'rgba(242,199,102,0.85)' : Cb.hole; g.fill(); }
    }
    for (const sx of [x - 8, x + w]) { g.fillStyle = Cb.body; g.fillRect(sx, bfy + bfh, 8, base - bfy - bfh); g.fillStyle = Cb.line; g.fillRect(sx, bfy + bfh, 8, 1.4); g.fillRect(sx + (sx < x ? 0 : 6.6), bfy + bfh, 1.4, base - bfy - bfh); }
  }
  // Ashport's cathedral facade (upright; mirrored where it hangs): two towers with spires, a gable, a rose window
  function cathedral(g, cx, base, s, Cb, rr) {
    const tw = 64 * s, nw = 150 * s, th = 400 * s, nh = 300 * s, sp = 140 * s;
    const gable = () => { g.beginPath(); g.moveTo(cx - nw / 2, base); g.lineTo(cx - nw / 2, base - nh); g.lineTo(cx, base - nh - 90 * s); g.lineTo(cx + nw / 2, base - nh); g.lineTo(cx + nw / 2, base); g.closePath(); };
    cel(g, gable, Cb.lit, Cb.body, 8, Cb.rim, 1.8, Cb.line);
    const ry = base - nh + 30 * s, R = 38 * s;
    glow(g, cx, ry, R * 2, C.gold, 0.35);
    g.beginPath(); g.arc(cx, ry, R, 0, TAU); g.fillStyle = 'rgba(255,226,150,0.9)'; g.fill(); g.strokeStyle = Cb.line; g.lineWidth = 3 * s; g.stroke();
    g.lineWidth = 1.2 * s; g.beginPath(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; g.moveTo(cx + Math.cos(a) * R * 0.25, ry + Math.sin(a) * R * 0.25); g.lineTo(cx + Math.cos(a) * R, ry + Math.sin(a) * R); } g.stroke();
    g.beginPath(); g.arc(cx, ry, R * 0.25, 0, TAU); g.stroke(); g.beginPath(); g.arc(cx, ry, R * 0.62, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(cx - 30 * s, base); g.lineTo(cx - 30 * s, base - 80 * s); g.quadraticCurveTo(cx, base - 130 * s, cx + 30 * s, base - 80 * s); g.lineTo(cx + 30 * s, base); g.closePath(); g.fillStyle = Cb.hole; g.fill(); g.strokeStyle = Cb.line; g.lineWidth = 2 * s; g.stroke();
    for (let k = -3; k <= 3; k++) { const ax = cx + k * 17 * s; g.beginPath(); g.moveTo(ax - 6 * s, base - 150 * s); g.lineTo(ax - 6 * s, base - 170 * s); g.quadraticCurveTo(ax, base - 180 * s, ax + 6 * s, base - 170 * s); g.lineTo(ax + 6 * s, base - 150 * s); g.closePath(); g.fillStyle = Cb.hole; g.fill(); }
    for (const side of [-1, 1]) {
      const tx = cx + side * (nw / 2 + tw / 2 - 8 * s) - tw / 2;
      cel(g, () => { g.beginPath(); g.rect(tx, base - th, tw, th); }, Cb.lit, Cb.body, 7, Cb.rim, 1.8, Cb.line);
      for (let yy = base - 60 * s; yy > base - th + 20 * s; yy -= 70 * s) { g.fillStyle = Cb.line; g.fillRect(tx - 2, yy, tw + 4, 3 * s); }
      for (const lx of [tx + tw * 0.2, tx + tw * 0.58]) { g.beginPath(); g.moveTo(lx, base - th + 90 * s); g.lineTo(lx, base - th + 40 * s); g.quadraticCurveTo(lx + tw * 0.11, base - th + 22 * s, lx + tw * 0.22, base - th + 40 * s); g.lineTo(lx + tw * 0.22, base - th + 90 * s); g.closePath(); g.fillStyle = rr() < 0.5 ? 'rgba(255,226,150,0.85)' : Cb.hole; g.fill(); }
      cel(g, () => { g.beginPath(); g.moveTo(tx - 4 * s, base - th); g.lineTo(tx + tw / 2, base - th - sp); g.lineTo(tx + tw + 4 * s, base - th); g.closePath(); }, Cb.lit, Cb.body, 5, Cb.rim, 1.6, Cb.line);
      g.strokeStyle = Cb.line; g.lineWidth = 1; for (let k = 1; k < 6; k++) { const t = k / 6, yy = base - th - sp * t, hw = (tw / 2 + 4 * s) * (1 - t); g.beginPath(); g.moveTo(tx + tw / 2 - hw, yy); g.lineTo(tx + tw / 2 - hw - 4, yy - 4); g.moveTo(tx + tw / 2 + hw, yy); g.lineTo(tx + tw / 2 + hw + 4, yy - 4); g.stroke(); }
      g.fillStyle = Cb.gold; g.beginPath(); g.arc(tx + tw / 2, base - th - sp - 6 * s, 4 * s, 0, TAU); g.fill();
    }
  }
  // the Belfry's great bell (upright; it sinks mouth-up through the abyss)
  function greatBell(g, x, y, s, Cg) {
    const path = () => {
      g.beginPath(); g.moveTo(x - 14 * s, y - 92 * s); g.bezierCurveTo(x - 46 * s, y - 92 * s, x - 50 * s, y - 50 * s, x - 54 * s, y - 14 * s);
      g.quadraticCurveTo(x - 60 * s, y + 2 * s, x - 76 * s, y + 8 * s); g.lineTo(x + 76 * s, y + 8 * s); g.quadraticCurveTo(x + 60 * s, y + 2 * s, x + 54 * s, y - 14 * s);
      g.bezierCurveTo(x + 50 * s, y - 50 * s, x + 46 * s, y - 92 * s, x + 14 * s, y - 92 * s); g.closePath();
    };
    cel(g, path, Cg.lit, Cg.body, 14 * s, Cg.rim, 2.2 * s, Cg.line);
    // crown, bands, inscription, the crack
    g.beginPath(); g.ellipse(x, y - 98 * s, 16 * s, 8 * s, 0, 0, TAU); g.fillStyle = Cg.body; g.fill(); g.strokeStyle = Cg.line; g.lineWidth = 1.6 * s; g.stroke();
    g.strokeStyle = Cg.line; g.lineWidth = 1.4 * s;
    for (const [yy, hw] of [[-74, 46], [-20, 54], [-6, 58]]) { g.beginPath(); g.moveTo(x - hw * s, y + yy * s); g.quadraticCurveTo(x, y + (yy + 5) * s, x + hw * s, y + yy * s); g.stroke(); }
    g.fillStyle = rgba(Cg.line, 0.6); for (let k = -4; k <= 4; k++) g.fillRect(x + k * 9 * s - 2 * s, y - 50 * s, 4 * s, 7 * s);
    g.lineWidth = 1.8 * s; g.beginPath(); g.moveTo(x + 18 * s, y - 88 * s); g.lineTo(x + 10 * s, y - 64 * s); g.lineTo(x + 22 * s, y - 40 * s); g.lineTo(x + 14 * s, y - 16 * s); g.stroke();
  }
  // the Opera's proscenium (gilt frame, tiers of boxes, drawn-back curtains) — distant
  function proscenium(g, cx, base, w, h, Co, rr) {
    const x = cx - w / 2, top = base - h;
    // the house beyond the stage: boxes in tiers
    for (let t = 0; t < 3; t++) {
      const yy = base - 70 - t * 74;
      for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
        const bx = cx + side * (w * 0.5 + 12 + k * 46) - (side < 0 ? 40 : 0);
        g.fillStyle = Co.hole; g.fillRect(bx, yy - 40, 40, 40);
        g.fillStyle = Co.gold; g.fillRect(bx - 2, yy - 4, 44, 5); g.fillStyle = Co.line; g.fillRect(bx - 2, yy + 1, 44, 1.2);
        g.strokeStyle = Co.gold; g.lineWidth = 1; g.beginPath(); for (let q = 4; q < 40; q += 6) { g.moveTo(bx + q, yy - 4); g.lineTo(bx + q, yy - 14); } g.stroke();
        if (rr() < 0.4) glow(g, bx + 20, yy - 24, 14, C.gold, 0.35);
      }
    }
    // the frame
    const frame = () => { g.beginPath(); g.moveTo(x - 36, base); g.lineTo(x - 36, top + 60); g.quadraticCurveTo(x - 36, top - 36, cx, top - 52); g.quadraticCurveTo(x + w + 36, top - 36, x + w + 36, top + 60); g.lineTo(x + w + 36, base);
      g.lineTo(x + w, base); g.lineTo(x + w, top + 70); g.quadraticCurveTo(x + w, top + 4, cx, top - 6); g.quadraticCurveTo(x, top + 4, x, top + 70); g.lineTo(x, base); g.closePath(); };
    g.fillStyle = Co.stage; g.fillRect(x, top, w, h);
    // curtains, drawn back (grey velvet in this memory)
    for (const side of [-1, 1]) {
      const ex = side < 0 ? x : x + w;
      g.beginPath(); g.moveTo(ex, top); g.quadraticCurveTo(ex + side * -w * 0.24, top + h * 0.35, ex + side * -w * 0.12, base - h * 0.36);
      g.quadraticCurveTo(ex + side * -w * 0.2, base - 40, ex + side * -w * 0.1, base); g.lineTo(ex, base); g.closePath();
      g.fillStyle = Co.velvet; g.fill(); g.strokeStyle = Co.line; g.lineWidth = 1.2; g.stroke();
      g.strokeStyle = rgba(Co.line, 0.6); g.lineWidth = 0.9;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(ex + side * -k * 9, top + 6); g.quadraticCurveTo(ex + side * -(w * 0.06 + k * 8), top + h * 0.4, ex + side * -(w * 0.05 + k * 6), base - 6); g.stroke(); }
    }
    // valance
    g.beginPath(); g.moveTo(x, top); for (let k = 0; k <= 10; k++) g.quadraticCurveTo(x + (k - 0.5) * w / 10, top + 34, x + k * w / 10, top + 14); g.lineTo(x + w, top); g.closePath();
    g.fillStyle = Co.velvet; g.fill(); g.strokeStyle = Co.line; g.lineWidth = 1; g.stroke();
    g.fillStyle = Co.gold; for (let k = 0; k <= 10; k++) g.fillRect(x + k * w / 10 - 1.5, top + 14, 3, 10);
    cel(g, frame, Co.goldL, Co.gold, 6, '#fff6d8', 1.8, Co.line);
    // cartouche: a lyre over the arch
    g.beginPath(); g.ellipse(cx, top - 40, 26, 18, 0, 0, TAU); g.fillStyle = Co.gold; g.fill(); g.strokeStyle = Co.line; g.lineWidth = 1.4; g.stroke();
    g.strokeStyle = Co.line; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - 10, top - 30); g.quadraticCurveTo(cx - 16, top - 52, cx - 4, top - 52); g.moveTo(cx + 10, top - 30); g.quadraticCurveTo(cx + 16, top - 52, cx + 4, top - 52); g.moveTo(cx - 8, top - 34); g.lineTo(cx + 8, top - 34); g.stroke();
  }
  function chandelier(g, cx, cy, s, Co, rr) {
    g.strokeStyle = Co.line; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, cy - 400); g.lineTo(cx, cy - 60 * s); g.stroke();
    glow(g, cx, cy, 120 * s, C.gold, 0.28);
    for (let t = 0; t < 3; t++) {
      const ry = cy - 30 * s + t * 26 * s, rx = (30 + t * 22) * s;
      g.beginPath(); g.ellipse(cx, ry, rx, rx * 0.22, 0, 0, TAU); g.strokeStyle = Co.line; g.lineWidth = 3; g.stroke(); g.strokeStyle = Co.gold; g.lineWidth = 1.6; g.stroke();
      for (let k = 0; k < 7 + t * 3; k++) {
        const a = k / (7 + t * 3) * TAU, px = cx + Math.cos(a) * rx, py = ry + Math.sin(a) * rx * 0.22;
        g.strokeStyle = rgba('#fff8e8', 0.75); g.lineWidth = 0.8; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + 10 * s + rr() * 8 * s); g.stroke();
        g.fillStyle = '#fff4d0'; g.beginPath(); g.moveTo(px, py + 10 * s); g.lineTo(px + 2.2 * s, py + 15 * s); g.lineTo(px, py + 20 * s); g.lineTo(px - 2.2 * s, py + 15 * s); g.fill();
        if (Math.sin(a) < 0) { g.fillStyle = C.goldL; g.fillRect(px - 1, py - 7 * s, 2, 6 * s); glow(g, px, py - 8 * s, 7 * s, C.gold, 0.6); }
      }
    }
  }
  function genMid() {
    const f = MID_F, objs = [], rng = U.mulberry32(7201), W0 = (lx) => lx / f;
    const tone = (lx, k) => wash(W0(lx), k);
    // 1) a distant system of staves under everything (the score goes on below you) — open over the Long Rest
    objs.push(...chunks(-720, 3560, 512, -60, 780, (g, a, b) => {
      for (const [s0, s1] of [[a - 4, Math.min(b + 4, MID_VOID[0])], [Math.max(a - 4, MID_VOID[1]), b + 4]]) {
        if (s1 <= s0) continue;
        const top = midBase(s0);
        const body = tone((s0 + s1) / 2, 0.82), line = rgba(tone((s0 + s1) / 2, 0.15), 0.55);
        g.fillStyle = body; g.fillRect(s0, top, s1 - s0, 760);
        g.fillStyle = line; for (let i = 0; i < 5; i++) g.fillRect(s0, top + 3 + i * 6, s1 - s0, 0.9);
        g.fillStyle = 'rgba(255,240,200,0.4)'; g.fillRect(s0, top - 1, s1 - s0, 1.4);
        const rr = U.mulberry32(Math.floor(s0) + 7);
        for (let xx = Math.ceil(s0 / 150) * 150; xx < s1; xx += 150) { g.fillStyle = line; g.fillRect(xx, top + 3, 1, 24); }
        for (let xx = s0 + rr() * 20; xx < s1; xx += 14 + rr() * 22) if (rr() < 0.5) { g.fillStyle = line; g.beginPath(); g.ellipse(xx, top + 3 + Math.floor(rr() * 9) * 3, 2.4, 1.7, -0.4, 0, TAU); g.fill(); }
      }
      // over the Long Rest the staves come loose and fall into the dark
      for (const ex of MID_VOID) {
        if (ex < a - 200 || ex > b + 200) continue;
        const dir = ex === MID_VOID[0] ? 1 : -1, line = rgba(tone(ex, 0.12), 0.5);
        g.strokeStyle = line; g.lineWidth = 0.9;
        for (let i = 0; i < 5; i++) { const y0 = midBase(ex) + 3 + i * 6; g.beginPath(); g.moveTo(ex, y0); g.bezierCurveTo(ex + dir * (30 + i * 12), y0 + 4, ex + dir * (60 + i * 8), y0 + 60 + i * 20, ex + dir * (40 + i * 18), y0 + 220 + i * 30); g.stroke(); }
      }
    }));
    // 2) drifting scraps of score with their glyphs (density by zone; none inside the landmarks)
    const KEEP = [[560, 1080], [1880, 2300], [2560, 2760], [MID_VOID[0] - 60, MID_VOID[1] + 60]];
    for (let lx = -680; lx < 3540; lx += 190 + rng() * 230) {
      if (KEEP.some(([a, b]) => lx > a - 60 && lx < b + 40)) continue;
      const inVoid = lx > MID_VOID[0] - 40 && lx < MID_VOID[1] + 40;
      const w = 50 + rng() * 90, y = inVoid ? -150 - rng() * 250 : -110 - rng() * 300, seed = rng() * 1e6 | 0;
      const kinds = ['qrest', 'fermata', 'erest', 'notes', 'treble', 'bass', 'none'], kind = kinds[Math.floor(rng() * kinds.length)];
      const gs = 6 + rng() * 5, x = lx;
      objs.push({ x: x - 50, y: y - gs * 8 - 30, w: w + 100, h: gs * 8 + 130, draw(g) {
        const rr = U.mulberry32(seed), k0 = 0.16 + (y + 400) / 1800;
        const col = tone(x, k0), dark = tone(x, k0 + 0.3), line = tone(x, Math.min(1, k0 + 0.6));
        scrap(g, rr, x, y, w, col, dark, line);
        const gx = x + w * (0.3 + rr() * 0.4), gl = tone(x, k0 + 0.3), gd = tone(x, k0 + 0.48), rim = 'rgba(242,199,102,0.7)';
        if (kind === 'qrest') glyph(g, 'qrest', gx, y - gs * 1.7, gs, { lit: gl, dark: gd, rim, inkW: 1.1, inkCol: line });
        else if (kind === 'erest') glyph(g, 'erest', gx, y - gs * 1.1, gs * 1.2, { lit: gl, dark: gd, rim, inkW: 1.1, inkCol: line });
        else if (kind === 'fermata') glyph(g, 'fermata', gx, y - 4, gs * 1.4, { lit: gl, dark: gd, rim, inkW: 1.1, inkCol: line });
        else if (kind === 'treble') glyph(g, 'treble', gx, y - gs * 3.1, gs * 0.95, { lit: gl, dark: gd, rim, inkW: 1.1, inkCol: line });
        else if (kind === 'bass') glyph(g, 'bass', gx, y - gs * 2.2, gs, { lit: gl, dark: gd, rim, inkW: 1.1, inkCol: line });
        else if (kind === 'notes') for (let k = 0; k < 3; k++) note(g, x + w * (0.2 + k * 0.25), y - 6 - k * 3, gs * 0.8, { col: gd, up: 1, len: 3.2, flags: k === 2 ? 1 : 0, inkCol: line });
      } });
    }
    // 3) Ashport's cathedral (the one Maestrina sang in), hanging upside down from the top of the page; rooftops drift by
    const ASH = 840;
    objs.push({ x: ASH - 190, y: -1000, w: 380, h: 960, draw(g) {
      const rr = U.mulberry32(731), Cb = { body: tone(ASH, 0.5), lit: tone(ASH, 0.32), rim: 'rgba(255,240,200,0.85)', line: tone(ASH, 0.95), hole: tone(ASH, 0.84), gold: C.goldM };
      g.save(); g.translate(0, -640); g.scale(1, -1);
      cathedral(g, ASH, 0, 1, Cb, rr);
      g.restore();
      // ink still running off the spires' tips
      g.fillStyle = Cb.line;
      for (const dx of [-99, 99]) { g.fillRect(ASH + dx - 0.6, -100, 1.2, 70); g.beginPath(); g.ellipse(ASH + dx, -28, 2.4, 3.6, 0, 0, TAU); g.fill(); }
    } });
    for (const [rx, ry, rw] of [[640, -250, 110], [980, -300, 130], [1090, -170, 90], [700, -120, 80]]) {
      objs.push({ x: rx - 20, y: ry - 120, w: rw + 40, h: 220, draw(g) {
        const rr = U.mulberry32(rx * 7), body = tone(rx, 0.5), dark = tone(rx, 0.68), line = tone(rx, 0.95);
        scrap(g, rr, rx, ry, rw, tone(rx, 0.42), dark, line, { th: 14 });
        // roofs with chimneys and a lamp
        for (let xx = rx + 6; xx < rx + rw - 20; xx += 26 + rr() * 14) {
          const hw = 12 + rr() * 6, hh = 18 + rr() * 16;
          g.beginPath(); g.moveTo(xx, ry); g.lineTo(xx, ry - hh); g.lineTo(xx + hw, ry - hh - hw * 0.7); g.lineTo(xx + hw * 2, ry - hh); g.lineTo(xx + hw * 2, ry); g.closePath();
          g.fillStyle = body; g.fill(); g.strokeStyle = line; g.lineWidth = 1.1; g.stroke();
          g.fillStyle = dark; g.fillRect(xx, ry - hh, hw * 0.6, hh);
          if (rr() < 0.6) { g.fillStyle = line; g.fillRect(xx + hw * 1.4, ry - hh - hw * 0.7 - 8, 5, 12); }
          if (rr() < 0.5) { g.fillStyle = 'rgba(242,199,102,0.9)'; g.fillRect(xx + hw * 0.9, ry - hh * 0.6, 3, 4); }
        }
        g.strokeStyle = line; g.lineWidth = 1.2; g.beginPath(); g.moveTo(rx + rw - 10, ry); g.lineTo(rx + rw - 10, ry - 36); g.stroke();
        glow(g, rx + rw - 10, ry - 38, 12, C.gold, 0.55); g.fillStyle = C.goldL; g.fillRect(rx + rw - 12, ry - 41, 4, 5);
      } });
    }
    // 4) the Belfry's great bell, sinking mouth-up through the abyss under the Long Rest (upright when the page turns)
    const BELL = (MID_VOID[0] + MID_VOID[1]) / 2 + 20;
    objs.push({ x: BELL - 130, y: -60, w: 260, h: 460, draw(g) {
      const Cg = { body: '#8a6a3a', lit: '#c99a52', rim: '#ffe6a6', line: '#1a1420' };
      g.save(); g.translate(BELL, 78); g.scale(1, -1); greatBell(g, 0, 0, 0.95, Cg); g.restore();
      // its rope, trailing up toward the line it fell from
      g.strokeStyle = 'rgba(236,228,212,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(BELL, 176); g.bezierCurveTo(BELL + 20, 230, BELL - 30, 280, BELL + 6, 380); g.stroke();
      glow(g, BELL, 110, 130, C.gold, 0.14);
    } });
    // 5) the Opera: proscenium + chandelier (distant)
    const OPX = 1960;
    objs.push({ x: OPX - 420, y: -720, w: 840, h: 760, draw(g) {
      const rr = U.mulberry32(2040), Co = { gold: '#9c8150', goldL: '#c2a670', line: tone(OPX, 0.97), hole: tone(OPX, 0.88), velvet: tone(OPX, 0.66), stage: tone(OPX, 0.8) };
      proscenium(g, OPX, midBase(OPX), 230, 280, Co, rr);
      chandelier(g, OPX, -420, 1.1, Co, rr);
    } });
    // 6) the final barline: a thin bar and a thick bar the height of the sky, a fermata held over them; segno and coda drift by
    const FBX = 2660;
    objs.push({ x: FBX - 160, y: -1000, w: 320, h: 1040, draw(g) {
      const body = '#1b1620', lit = '#3c3444', rim = '#f2c766';
      cel(g, () => { g.beginPath(); g.rect(FBX - 40, -960, 14, 960 + midBase(FBX)); }, lit, body, 5, rim, 1.6);
      cel(g, () => { g.beginPath(); g.rect(FBX - 8, -960, 44, 960 + midBase(FBX)); }, lit, body, 10, rim, 1.8);
      glyph(g, 'fermata', FBX, -620, 46, { lit: '#4a4152', dark: '#1b1620', rim: '#ffe6a6', inkW: 2 });
      glow(g, FBX, -650, 110, C.gold, 0.22);
    } });
    for (const [sx, sy, kind] of [[2480, -380, 'segno'], [2860, -300, 'coda'], [2380, -230, 'fermata'], [3020, -420, 'qrest']]) {
      objs.push({ x: sx - 50, y: sy - 60, w: 100, h: 120, draw(g) {
        const line = tone(sx, 0.95), gl = tone(sx, 0.4), gd = tone(sx, 0.62);
        if (kind === 'coda') { g.strokeStyle = line; g.lineWidth = 6; g.beginPath(); g.ellipse(sx, sy, 22, 30, 0, 0, TAU); g.moveTo(sx - 36, sy); g.lineTo(sx + 36, sy); g.moveTo(sx, sy - 44); g.lineTo(sx, sy + 44); g.stroke(); g.strokeStyle = gl; g.lineWidth = 3; g.stroke(); }
        else if (kind === 'segno') {
          glyph(g, 'slur', sx - 2, sy - 6, 9, { lit: gl, dark: gd, inkW: 1.4, inkCol: line });
          g.save(); g.translate(sx, sy); g.rotate(PI); glyph(g, 'slur', 2, -6, 9, { lit: gl, dark: gd, inkW: 1.4, inkCol: line }); g.restore();
          g.strokeStyle = line; g.lineWidth = 3; g.beginPath(); g.moveTo(sx - 26, sy + 30); g.lineTo(sx + 26, sy - 30); g.stroke();
          g.fillStyle = line; g.beginPath(); g.arc(sx - 22, sy + 8, 4, 0, TAU); g.arc(sx + 22, sy - 8, 4, 0, TAU); g.fill();
        } else glyph(g, kind, sx, sy, 22, { lit: gl, dark: gd, rim: 'rgba(242,199,102,0.7)', inkW: 1.6, inkCol: line });
      } });
    }
    return objs;
  }

  /* =========================================================================================
     PARALLAX — NEAR (f 0.45): staves torn loose and sweeping through the air, ink running down from the top of
     the page, loose leaves; standing in the margin: quills planted like swords (prelude), Ashport's gas lamps,
     the empty orchestra (music stands, a harp), the barline's candles
     ========================================================================================= */
  const NEAR_VOID = [LINE.x0 * NEAR_F + 4, LINE.x1 * NEAR_F - 4];
  function bez(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t; out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]); }
    return out;
  }
  // a five-line staff following a curve: a paper band, the lines frayed at both ends, notes riding it
  function staffRibbon(g, rr, pts, gap, o) {
    const n = pts.length, N = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1; return [-dy / d, dx / d]; });
    const at = (i, k) => [pts[i][0] + N[i][0] * k * gap, pts[i][1] + N[i][1] * k * gap];
    const s0 = 2, s1 = n - 3;
    g.beginPath(); for (let i = s0; i <= s1; i++) { const p = at(i, -2.7); i === s0 ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1]); }
    for (let i = s1; i >= s0; i--) { const p = at(i, 2.7); g.lineTo(p[0], p[1]); }
    g.closePath(); g.fillStyle = o.paper; g.fill();
    g.strokeStyle = o.line; g.lineWidth = o.lw; g.lineCap = 'round';
    for (let k = -2; k <= 2; k++) {
      const a = Math.floor(rr() * 4), b = n - 1 - Math.floor(rr() * 4);
      g.beginPath(); for (let i = a; i <= b; i++) { const p = at(i, k); i === a ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1]); } g.stroke();
    }
    for (let i = 5; i < n - 5; i += 3 + Math.floor(rr() * 4)) {
      if (rr() < 0.35) continue;
      const k = Math.floor(rr() * 9) / 2 - 2, p = at(i, k), ang = Math.atan2(N[i][1], N[i][0]);
      g.save(); g.translate(p[0], p[1]); g.rotate(ang + PI / 2);
      noteHead(g, 0, 0, gap * 0.95, rr() < 0.75, o.line, o.line, 0);
      g.fillStyle = o.line; g.fillRect(gap * 0.55, -gap * 3.2, gap * 0.16, gap * 3.2);
      g.restore();
      if (rr() < 0.2) { const q = at(i, 3.4); g.fillStyle = o.gold; g.beginPath(); g.arc(q[0], q[1], gap * 0.35, 0, TAU); g.fill(); }
    }
  }
  // a quill planted in the page like a sword in a field
  function quill(g, x, base, h, lean, Cq) {
    g.save(); g.translate(x, base); g.rotate(lean);
    const vane = () => { g.beginPath(); g.moveTo(0, -h * 0.18); g.bezierCurveTo(-h * 0.13, -h * 0.4, -h * 0.12, -h * 0.85, 0, -h); g.bezierCurveTo(h * 0.06, -h * 0.8, h * 0.09, -h * 0.42, 0, -h * 0.18); g.closePath(); };
    cel(g, vane, Cq.lit, Cq.body, 6, Cq.rim, 1.6, Cq.line);
    g.strokeStyle = Cq.line; g.lineWidth = 0.8;
    for (let k = 0; k < 14; k++) { const t = 0.25 + k * 0.05, yy = -h * t; g.beginPath(); g.moveTo(0, yy); g.lineTo(-h * 0.1 * Math.sin(t * PI), yy - h * 0.03); g.moveTo(0, yy); g.lineTo(h * 0.06 * Math.sin(t * PI), yy - h * 0.025); g.stroke(); }
    g.strokeStyle = Cq.line; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 6); g.lineTo(0, -h * 0.95); g.stroke();
    g.fillStyle = Cq.gold; g.beginPath(); g.moveTo(-3, 0); g.lineTo(0, 12); g.lineTo(3, 0); g.closePath(); g.fill();
    g.restore();
  }
  function genNear() {
    const f = NEAR_F, objs = [], rng = U.mulberry32(7301), W0 = (lx) => lx / f, x0 = -820, x1 = 6620;
    const look = (lx) => {
      const wx = W0(lx), n = Math.max(nightAt(wx), voidAt(wx));
      return { paper: `rgba(${n > 0.5 ? '34,28,40' : '236,228,210'},${0.46 - 0.14 * n})`, line: mixH('#2a2430', '#d8cfbd', n), gold: 'rgba(242,199,102,0.85)', drip: mixH('#2c2633', '#cfc5b3', n) };
    };
    // 1) staves sweeping through the upper air (and, over the Long Rest, coiling down into the abyss)
    for (let lx = x0; lx < x1; lx += 520 + rng() * 420) {
      const inVoid = lx > NEAR_VOID[0] - 200 && lx < NEAR_VOID[1];
      const len = 700 + rng() * 500, yA = -300 - rng() * 170, yB = inVoid ? 120 + rng() * 160 : -260 - rng() * 220;
      const p0 = [lx, yA], p3 = [lx + len, yB], p1 = [lx + len * 0.3, yA - 160 + rng() * 120], p2 = [lx + len * 0.7, yB + (inVoid ? -260 : -140 + rng() * 200)];
      const pts = bez(p0, p1, p2, p3, 46), seed = rng() * 1e6 | 0, gap = 5 + rng() * 2.5;
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; for (const p of pts) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); }
      objs.push({ x: bx0 - 30, y: by0 - 30, w: bx1 - bx0 + 60, h: by1 - by0 + 60, draw(g) { staffRibbon(g, U.mulberry32(seed), pts, gap, Object.assign({ lw: 1.3 }, look(lx))); } });
    }
    // 2) ink running down from the top of the page
    for (let lx = x0; lx < x1; lx += 260 + rng() * 420) {
      const len = 200 + rng() * 170, wd = 1.5 + rng() * 3, seed = rng() * 1e6 | 0;
      if (lx > NEAR_VOID[0] - 80 && lx < NEAR_VOID[1] + 80) continue;
      objs.push({ x: lx - 14, y: -1100, w: 28, h: 1100 - 760 + len + 40, draw(g) {
        const rr = U.mulberry32(seed), c = look(lx).drip, end = -760 + len;
        g.fillStyle = c; g.beginPath(); g.moveTo(lx - wd, -1100); g.lineTo(lx - wd * 0.55, end - 18); g.quadraticCurveTo(lx - wd * 2.1, end, lx, end + wd * 2.2); g.quadraticCurveTo(lx + wd * 2.1, end, lx + wd * 0.55, end - 18); g.lineTo(lx + wd, -1100); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,246,226,0.35)'; g.fillRect(lx + wd * 0.2, -1100, Math.max(0.6, wd * 0.25), 1100 + end - 30);
        if (rr() < 0.5) { const dy = end + 26 + rr() * 60; g.fillStyle = c; g.beginPath(); g.ellipse(lx, dy, wd * 0.9, wd * 1.3, 0, 0, TAU); g.fill(); }
      } });
    }
    // 3) loose leaves
    for (let lx = x0; lx < x1; lx += 380 + rng() * 500) {
      if (lx > NEAR_VOID[0] && lx < NEAR_VOID[1] && rng() < 0.5) continue;
      const y = -360 - rng() * 120, rot = (rng() - 0.5) * 1.2, seed = rng() * 1e6 | 0;
      objs.push({ x: lx - 70, y: y - 70, w: 140, h: 140, draw(g) {
        const rr = U.mulberry32(seed), lk = look(lx), n = nightAt(W0(lx));
        g.save(); g.translate(lx, y); g.rotate(rot);
        const edge = [[-34, -44], [34, -44]]; for (let yy = -44; yy <= 44; yy += 8) edge.push([34 + (rr() - 0.5) * 5, yy]); edge.push([-34, 44]);
        poly(g, edge); g.fillStyle = mixH('#ece4d2', '#3a3342', n); g.fill(); g.strokeStyle = rgba(INK, 0.6); g.lineWidth = 1; g.stroke();
        g.fillStyle = mixH('#d9cfbb', '#2a2430', n); g.fillRect(-34, 22, 68, 22);
        g.fillStyle = lk.line; for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) g.fillRect(-28, -34 + r * 24 + i * 3.4, 58, 0.7);
        for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(-22 + k * 9, -34 + Math.floor(rr() * 3) * 24 + Math.floor(rr() * 5) * 3.4, 2.2, 1.5, -0.4, 0, TAU); g.fill(); }
        g.restore();
      } });
    }
    // 4) in the margin, standing in the half-light behind the action (low contrast on purpose)
    // prelude: quills planted in the page
    for (const [qx, qh, lean] of [[-560, 280, -0.12], [330, 300, -0.1], [1060, 250, 0.2]]) {
      objs.push({ x: qx - 140, y: -qh - 80, w: 280, h: qh + 120, draw(g) {
        const Cq = { body: wash(W0(qx), 0.48), lit: wash(W0(qx), 0.32), rim: 'rgba(255,240,206,0.7)', line: rgba(INK, 0.6), gold: C.goldM };
        quill(g, qx, 8, qh, lean, Cq);
      } });
    }
    // Ashport: gas lamps along a street that is no longer there
    for (let lx = 1180; lx < NEAR_VOID[0] - 60; lx += 190 + rng() * 120) {
      const seed = rng() * 1e6 | 0, hh = 150 + rng() * 60;
      objs.push({ x: lx - 40, y: -hh - 60, w: 80, h: hh + 70, draw(g) {
        const rr = U.mulberry32(seed), line = rgba(INK, 0.6), body = wash(W0(lx), 0.62);
        g.fillStyle = body; g.fillRect(lx - 2.5, -hh, 5, hh + 10); g.fillStyle = line; g.fillRect(lx - 2.5, -hh, 1.2, hh + 10);
        g.fillStyle = body; g.fillRect(lx - 7, -12, 14, 12); g.fillRect(lx - 12, -hh + 10, 24, 3);
        g.beginPath(); g.moveTo(lx - 9, -hh); g.lineTo(lx + 9, -hh); g.lineTo(lx + 6, -hh - 18); g.lineTo(lx - 6, -hh - 18); g.closePath(); g.fillStyle = rr() < 0.75 ? 'rgba(255,226,150,0.9)' : body; g.fill(); g.strokeStyle = line; g.lineWidth = 1.2; g.stroke();
        g.beginPath(); g.moveTo(lx - 10, -hh - 18); g.lineTo(lx, -hh - 28); g.lineTo(lx + 10, -hh - 18); g.closePath(); g.fillStyle = body; g.fill(); g.stroke();
        glow(g, lx, -hh - 9, 34, C.gold, 0.32);
      } });
    }
    // the Opera: an empty orchestra — music stands, chairs, a harp
    for (let lx = NEAR_VOID[1] + 120; lx < 4650; lx += 70 + rng() * 90) {
      const seed = rng() * 1e6 | 0, kind = rng() < 0.12 ? 'harp' : rng() < 0.5 ? 'stand' : 'chair';
      objs.push({ x: lx - 50, y: -200, w: 100, h: 210, draw(g) {
        const line = rgba(INK, 0.55), body = wash(W0(lx), 0.66);
        g.strokeStyle = body; g.lineCap = 'round';
        if (kind === 'stand') { g.lineWidth = 2; g.beginPath(); g.moveTo(lx, 4); g.lineTo(lx, -86); g.moveTo(lx - 14, 4); g.lineTo(lx, -10); g.lineTo(lx + 14, 4); g.stroke(); poly(g, [[lx - 22, -86], [lx + 22, -92], [lx + 20, -122], [lx - 20, -116]]); g.fillStyle = body; g.fill(); g.strokeStyle = line; g.lineWidth = 1; g.stroke(); g.fillStyle = 'rgba(255,236,190,0.5)'; g.fillRect(lx - 16, -112, 30, 1); g.fillRect(lx - 16, -106, 30, 1); g.fillRect(lx - 16, -100, 30, 1); }
        else if (kind === 'chair') { g.lineWidth = 2.6; g.beginPath(); g.moveTo(lx - 10, 4); g.lineTo(lx - 10, -36); g.lineTo(lx + 12, -36); g.lineTo(lx + 12, 4); g.moveTo(lx - 10, -36); g.lineTo(lx - 12, -76); g.stroke(); }
        else { g.lineWidth = 3; g.beginPath(); g.moveTo(lx - 20, 4); g.lineTo(lx - 24, -150); g.quadraticCurveTo(lx + 10, -170, lx + 30, -120); g.quadraticCurveTo(lx + 36, -60, lx - 20, 4); g.stroke(); g.lineWidth = 0.7; g.strokeStyle = 'rgba(255,236,190,0.6)'; g.beginPath(); for (let k = 0; k < 9; k++) { const t = k / 9; g.moveTo(lx - 22 + t * 4, -146 + t * 140); g.lineTo(lx - 20 + t * 50, -150 + t * 30 + t * t * 100); } g.stroke(); }
      } });
    }
    // the barline: tall candles burning gold in the dark
    for (let lx = 4720; lx < x1; lx += 160 + rng() * 140) {
      const hh = 70 + rng() * 120, seed = rng() * 1e6 | 0;
      objs.push({ x: lx - 40, y: -hh - 70, w: 80, h: hh + 80, draw(g) {
        const rr = U.mulberry32(seed);
        g.fillStyle = '#3a3242'; g.fillRect(lx - 6, -hh, 12, hh + 6); g.fillStyle = '#55495c'; g.fillRect(lx + 2, -hh, 3, hh + 6);
        g.fillStyle = '#3a3242'; for (let k = 0; k < 3; k++) { const dy = -hh + 6 + rr() * hh * 0.5; g.beginPath(); g.ellipse(lx + (rr() < 0.5 ? -6 : 6), dy, 2, 6, 0, 0, TAU); g.fill(); }
        glow(g, lx, -hh - 12, 40, C.gold, 0.45);
        g.fillStyle = C.goldL; g.beginPath(); g.moveTo(lx, -hh - 22); g.quadraticCurveTo(lx + 5, -hh - 8, lx, -hh - 2); g.quadraticCurveTo(lx - 5, -hh - 8, lx, -hh - 22); g.fill();
      } });
    }
    return objs;
  }

  /* =========================================================================================
     GAMEPLAY PLANE — the floor is a staff: a black slab whose face carries five white lines and the music
     written on them (bar lines, notes, rests, dynamics, rubbed-out passages); pages beneath pages below it.
     The Long Rest is a single line. The Opera's elite fight is on a stage; the boss fight on the last, gilt system.
     ========================================================================================= */
  const GAP = 9;
  const DYN_BY_ZONE = [['dolce', 'pp', 'espressivo', 'a tempo', 'mp'], ['lontano', 'mf', 'rit.', 'calando', 'pp'], ['niente', 'pppp', 'perdendosi'], ['cantabile', 'f', 'rubato', 'con dolore', 'sotto voce'], ['morendo', 'smorzando', 'ppp', 'attacca']];
  function engrave(g, a, b, top, z, rr, col, gold) {
    const M = 480, x0 = Math.floor(a / M) * M;
    for (let m = x0; m < b + M; m += M) {
      // bar line (+ a measure number under the staff)
      if (m > a - 4 && m < b + 4) { rect(g, m - 0.7, top, 1.4, GAP * 4, col); text(g, String(Math.round(m / M) + 1), m + 10, top + GAP * 4 + 14, 10, gold, { weight: 600 }); }
      const rm = U.mulberry32(m * 13 + 5 + z);
      // a rubbed-out passage (the Hush got here first)
      const smudge = rm() < (z === 1 ? 0.45 : 0.2);
      const n = 3 + Math.floor(rm() * 4);
      for (let i = 0; i < n; i++) {
        const nx = m + 40 + (i + rm() * 0.4) * (M - 80) / n, k = 2 + Math.floor(rm() * 7), ny = top + k * GAP / 2;
        if (nx < a - 20 || nx > b + 20) { rm(); rm(); continue; }
        const kind = rm();
        if (kind < 0.12) glyph(g, 'qrest', nx, top + GAP * 2, GAP * 0.95, { lit: col, dark: col, inkW: 0, d: 0 });
        else if (kind < 0.2) glyph(g, 'erest', nx, top + GAP * 2, GAP * 0.95, { lit: col, dark: col, inkW: 0, d: 0 });
        else {
          // stems hang down into the slab so the walking line stays clean
          const s = GAP * 0.95, open = kind > 0.85;
          g.fillStyle = col; g.fillRect(nx - s * 0.62, ny, Math.max(1, s * 0.11), s * 3.2);
          if (kind > 0.6 && kind < 0.75) { g.beginPath(); g.moveTo(nx - s * 0.62, ny + s * 3.2); g.quadraticCurveTo(nx + s * 0.3, ny + s * 2.4, nx + s * 0.2, ny + s * 1.4); g.lineTo(nx + s * 0.05, ny + s * 1.6); g.quadraticCurveTo(nx, ny + s * 2.5, nx - s * 0.52, ny + s * 2.9); g.fill(); }
          noteHead(g, nx, ny, s, !open, col, col, 0);
          if (open) { g.save(); g.translate(nx, ny); g.rotate(-0.38); g.beginPath(); g.ellipse(0.05 * s, 0, s * 0.4, s * 0.19, -0.5, 0, TAU); g.fillStyle = '#1b1621'; g.fill(); g.restore(); }
          if (k >= 8) { rect(g, nx - s, top + GAP * 4.5 - 0.5, s * 2, 1, col); }
          if (rm() < 0.15) sharp(g, nx - s * 1.6, ny, s * 0.62, col);
        }
      }
      if (rm() < 0.55) { const tx = m + 60 + rm() * (M - 160); if (tx > a - 40 && tx < b + 40) text(g, DYN_BY_ZONE[z][Math.floor(rm() * DYN_BY_ZONE[z].length)], tx, top + GAP * 4 + 30, 13, gold, { weight: 600 }); }
      if (rm() < 0.35) { const sx = m + 80 + rm() * (M - 240); if (sx > a - 120 && sx < b + 40) { g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); g.moveTo(sx, top + GAP * 4 + 6); g.quadraticCurveTo(sx + 60, top + GAP * 4 + 18, sx + 120, top + GAP * 4 + 6); g.stroke(); } }
      if (smudge) { const sx = m + 60 + rm() * (M - 200), sw = 60 + rm() * 90; if (sx < b + 40 && sx + sw > a - 40) { const sg = g.createRadialGradient(sx + sw / 2, top + GAP * 2, 4, sx + sw / 2, top + GAP * 2, sw * 0.7); sg.addColorStop(0, 'rgba(120,110,124,0.55)'); sg.addColorStop(1, 'rgba(120,110,124,0)'); g.fillStyle = sg; g.fillRect(sx - 10, top + 2, sw + 20, GAP * 4 - 2);
        g.strokeStyle = 'rgba(200,190,176,0.35)'; g.lineWidth = 1; for (let q = 0; q < 6; q++) { const qx = sx + q * sw / 6; g.beginPath(); g.moveTo(qx, top + GAP * 3.6); g.lineTo(qx + 14, top + 6); g.stroke(); } } }
    }
  }
  function slab(g, a, b, top, z) {
    const rr = U.mulberry32(Math.floor(a) * 7 + 3 + z * 101);
    const sg = g.createLinearGradient(0, top, 0, top + 240); sg.addColorStop(0, '#1f1a26'); sg.addColorStop(0.3, '#15111b'); sg.addColorStop(1, '#08060b');
    g.fillStyle = sg; g.fillRect(a, top, b - a, 720);
    // pages beneath pages: ghost staves deeper in the slab
    for (const [dy, al] of [[96, 0.16], [178, 0.09], [262, 0.05]]) { g.fillStyle = `rgba(232,224,208,${al})`; for (let i = 0; i < 5; i++) g.fillRect(a, top + dy + i * 7, b - a, 0.8); }
    for (let x = Math.floor(a / 240) * 240 + 60; x < b; x += 240) { g.fillStyle = 'rgba(232,224,208,0.1)'; g.fillRect(x, top + 96, 0.9, 28); }
    // the staff on the slab's face: the top line is the one you walk on
    const col = '#e6ddca', gold = 'rgba(242,199,102,0.8)';
    rect(g, a, top - 2.6, b - a, 1.6, INK);
    rect(g, a, top - 1.2, b - a, 3, '#f3ead6'); rect(g, a, top - 1.2, b - a, 0.9, '#fffaf0');
    rect(g, a, top + 1.8, b - a, 0.8, 'rgba(242,199,102,0.75)');
    for (let i = 1; i < 5; i++) rect(g, a, top + i * GAP - 0.6, b - a, 1.2, col);
    engrave(g, a, b, top, z, rr, col, gold);
    // the slab's lower edge of the staff, a hairline of gilt
    rect(g, a, top + GAP * 4 + 44, b - a, 0.8, 'rgba(242,199,102,0.25)');
  }
  function paintStaff(s) {
    const out = [];
    for (let zi = 0; zi < 5; zi++) {
      const za = Math.max(zi ? ZX[zi] : -1e9, s.x), zb = Math.min(zi < 4 ? ZX[zi + 1] : 1e9, s.x + s.w);
      if (zb <= za) continue;
      const zz = zi;
      out.push(...chunks(za, zb, 512, s.y - 30, 760, (g, a, b) => slab(g, a, b, s.y, zz)));
    }
    // vertical faces of a raised / sunken slab: an inked edge with a gilt rim and the staff's line ends
    out.push({ x: s.x - 6, y: s.y - 4, w: 12, h: 400, draw(g) { rect(g, s.x - 1.5, s.y, 3, 400, INK); rect(g, s.x + 1.5, s.y, 1.4, 400, 'rgba(242,199,102,0.55)'); } });
    out.push({ x: s.x + s.w - 6, y: s.y - 4, w: 12, h: 400, draw(g) { rect(g, s.x + s.w - 1.5, s.y, 3, 400, INK); rect(g, s.x + s.w - 3, s.y, 1.4, 400, 'rgba(242,199,102,0.4)'); } });
    return out;
  }
  // the Long Rest: one line over nothing (pale threads and beads hang off it into the abyss)
  function paintLine(s) {
    return chunks(s.x, s.x + s.w, 512, s.y - 30, 340, (g, a, b) => {
      const rr = U.mulberry32(Math.floor(a) + 5555);
      rect(g, a, -3.2, b - a, 1.6, INK); rect(g, a, -1.8, b - a, 3.4, '#f6eedb'); rect(g, a, -1.8, b - a, 1, '#fffcf2'); rect(g, a, 1.6, b - a, 1.4, INK);
      for (let x = Math.floor(a / 160) * 160 + 40; x < b; x += 160) { g.fillStyle = 'rgba(255,226,150,0.9)'; g.fillRect(x + rr() * 60, -2.2, 10 + rr() * 16, 1.2); }
      for (let x = Math.floor(a / 600) * 600 + 300; x < b; x += 600) rect(g, x - 0.7, 1, 1.4, 14, 'rgba(240,232,216,0.6)');
      g.strokeStyle = 'rgba(232,224,208,0.4)'; g.lineWidth = 0.8;
      for (let x = a + rr() * 40; x < b; x += 50 + rr() * 90) {
        const len = 18 + rr() * 90; g.beginPath(); g.moveTo(x, 2); g.quadraticCurveTo(x + (rr() - 0.5) * 12, 2 + len * 0.6, x + (rr() - 0.5) * 8, 2 + len); g.stroke();
        if (rr() < 0.4) { g.fillStyle = 'rgba(242,199,102,0.7)'; g.beginPath(); g.arc(x, 4 + len, 1.6, 0, TAU); g.fill(); }
      }
    });
  }
  // Ashport's bell-tower roof, fallen onto the staff (Mira sits on its ridge)
  function paintRoof(s) {
    return [{ x: s.x - 70, y: s.y - 120, w: s.w + 140, h: -s.y + 160, draw(g) {
      const x = s.x, y = s.y, w = s.w, h = -y, rr = U.mulberry32(3250);
      // the building's face under the roof line: plaster, a round window lit gold, the sign
      const face = () => { g.beginPath(); g.moveTo(x + 6, 0); g.lineTo(x + 6, y + 22); g.lineTo(x + w - 6, y + 22); g.lineTo(x + w - 6, 0); g.closePath(); };
      cel(g, face, '#d8cfbd', '#a79c8c', 9, '#fff6e4', 1.8);
      g.save(); face(); g.clip();
      g.strokeStyle = 'rgba(40,32,44,0.35)'; g.lineWidth = 1; for (let yy = y + 34; yy < 0; yy += 14) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); for (let xx = x + ((yy / 14) % 2) * 16; xx < x + w; xx += 32) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + 14); g.stroke(); } }
      g.restore();
      const ox = x + w * 0.3, oy = y + 62;
      glow(g, ox, oy, 46, C.gold, 0.45);
      g.beginPath(); g.arc(ox, oy, 20, 0, TAU); g.fillStyle = '#ffe2a0'; g.fill(); ink(g, 3);
      g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.moveTo(ox - 20, oy); g.lineTo(ox + 20, oy); g.moveTo(ox, oy - 20); g.lineTo(ox, oy + 20); g.stroke();
      // the old sign from the bell tower, hanging crooked
      g.save(); g.translate(x + w * 0.7, y + 64); g.rotate(0.06);
      rect(g, -34, -15, 68, 30, INK); rect(g, -32, -13, 64, 26, '#2a2430');
      text(g, '鐘 塔', 0, 1, 17, 'rgba(255,214,140,0.95)', { italic: false, weight: 900, font: '"Noto Serif TC", serif' });
      g.restore();
      g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + w * 0.7 - 26, y + 22); g.lineTo(x + w * 0.7 - 26, y + 50); g.moveTo(x + w * 0.7 + 26, y + 22); g.lineTo(x + w * 0.7 + 26, y + 52); g.stroke();
      // the roof slab you stand on: slates, a stone coping, an eave with a gilt drip-line
      rect(g, x - 4, y - 2, w + 8, 26, INK);
      rect(g, x - 2, y, w + 4, 8, '#e8dfcc'); rect(g, x - 2, y, w + 4, 2, '#fffaf0');
      for (let xx = x; xx < x + w; xx += 22) rect(g, xx, y + 1, 1.2, 6, 'rgba(40,32,44,0.4)');
      rect(g, x - 2, y + 8, w + 4, 13, '#3a3342');
      for (let r = 0; r < 2; r++) for (let xx = x - 2 + r * 7; xx < x + w; xx += 14) { g.fillStyle = r ? '#4a4252' : '#2c2633'; g.fillRect(xx, y + 9 + r * 6, 12, 5); }
      rect(g, x - 6, y + 21, w + 12, 3, C.goldM);
      // chimney and a little weather-vane bell at the far end
      const cx = x + w - 40;
      cel(g, () => { g.beginPath(); g.rect(cx, y - 52, 22, 52); }, '#cfc5b2', '#968b7c', 5, '#fff3dc', 1.6);
      rect(g, cx - 3, y - 56, 28, 6, INK); rect(g, cx - 1, y - 55, 24, 3, '#e8dfcc');
      g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx + 11, y - 56); g.lineTo(cx + 11, y - 92); g.stroke();
      g.beginPath(); g.moveTo(cx + 5, y - 74); g.quadraticCurveTo(cx + 5, y - 86, cx + 11, y - 86); g.quadraticCurveTo(cx + 17, y - 86, cx + 17, y - 74); g.lineTo(cx + 19, y - 70); g.lineTo(cx + 3, y - 70); g.closePath(); g.fillStyle = C.gold; g.fill(); ink(g, 1.2);
      // where it fused into the page: a torn paper hem
      const hem = tornEdge(rr, x - 8, x + w + 8, -6, 4, 6); hem.push([x + w + 8, 4], [x - 8, 4]);
      poly(g, hem); g.fillStyle = '#e9e0cc'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
    } }];
  }
  // the conductor's podium
  function paintDais(s) {
    return [{ x: s.x - 30, y: s.y - 150, w: s.w + 60, h: -s.y + 160, draw(g) {
      const x = s.x, y = s.y, w = s.w;
      cel(g, () => { g.beginPath(); g.rect(x, y, w, -y); }, '#3a3342', '#221d29', 8, '#f2c766', 2);
      rect(g, x - 6, y - 2, w + 12, 10, INK); rect(g, x - 4, y, w + 8, 6, '#efe7d6'); rect(g, x - 4, y + 6, w + 8, 1.6, C.goldM);
      for (let px = x + 18; px < x + w - 20; px += 44) { g.strokeStyle = C.goldM; g.lineWidth = 1.4; g.strokeRect(px, y + 22, 30, -y - 34); }
      // the score left open on the stand, and the baton
      const sx = x + w * 0.62;
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(sx, y); g.lineTo(sx, y - 92); g.stroke(); g.strokeStyle = '#4a4252'; g.lineWidth = 1.4; g.stroke();
      poly(g, [[sx - 34, y - 92], [sx + 34, y - 98], [sx + 30, y - 130], [sx - 30, y - 124]]); g.fillStyle = '#efe7d6'; g.fill(); ink(g, 1.6);
      g.fillStyle = 'rgba(30,24,36,0.7)'; for (let i = 0; i < 2; i++) for (let k = 0; k < 5; k++) g.fillRect(sx - 26, y - 122 + i * 14 + k * 2.4, 52, 0.7);
      g.strokeStyle = '#f6eedb'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(sx - 12, y - 100); g.lineTo(sx + 26, y - 116); g.stroke();
    } }];
  }
  // the Opera's stage: boards, the stage lip, footlights, the dark of the pit below
  function paintStage(s) {
    return chunks(s.x, s.x + s.w, 512, s.y - 30, 760, (g, a, b) => {
      const top = s.y, rr = U.mulberry32(Math.floor(a) + 909);
      g.fillStyle = '#100c14'; g.fillRect(a, top, b - a, 720);
      rect(g, a, top - 2.4, b - a, 2, INK);
      rect(g, a, top - 0.6, b - a, 12, '#e6dcc6'); rect(g, a, top - 0.6, b - a, 1.4, '#fffaf0'); rect(g, a, top + 8, b - a, 3.4, '#b9ad97');
      for (let x = Math.floor(a / 64) * 64; x < b; x += 64) { rect(g, x, top + 1, 1.2, 9, 'rgba(40,32,44,0.45)'); if (rr() < 0.5) rect(g, x + 20 + rr() * 30, top + 3, 8, 0.9, 'rgba(40,32,44,0.3)'); }
      // gilt stage lip with a running ornament
      rect(g, a, top + 11.4, b - a, 2, INK); rect(g, a, top + 13.4, b - a, 14, C.goldM); rect(g, a, top + 13.4, b - a, 2, C.goldL); rect(g, a, top + 25, b - a, 2.4, C.goldDD);
      g.strokeStyle = C.goldD; g.lineWidth = 1.2; for (let x = Math.floor(a / 24) * 24; x < b; x += 24) { g.beginPath(); g.arc(x + 12, top + 20, 4.5, PI, TAU); g.stroke(); }
      rect(g, a, top + 27.4, b - a, 2, INK);
      // footlights (cached glow; the live flicker is drawn in drawBack)
      for (let x = Math.floor(a / 120) * 120 + 60; x < b; x += 120) { glow(g, x, top + 34, 26, C.gold, 0.5); g.beginPath(); g.arc(x, top + 36, 7, PI, TAU); g.fillStyle = '#ffe9b0'; g.fill(); ink(g, 1.4); }
      // the pit: music stands in the dark, a faint staff
      g.fillStyle = 'rgba(232,224,208,0.1)'; for (let i = 0; i < 5; i++) g.fillRect(a, top + 90 + i * 7, b - a, 0.8);
      g.strokeStyle = 'rgba(232,224,208,0.14)'; g.lineWidth = 1.6;
      for (let x = Math.floor(a / 90) * 90 + 30; x < b; x += 90) { g.beginPath(); g.moveTo(x, top + 160); g.lineTo(x, top + 64); g.moveTo(x - 16, top + 64); g.lineTo(x + 16, top + 58); g.stroke(); }
    });
  }
  // the last system: black glass with gilt lines, the coda sign, a held whole note
  function paintCoda(s) {
    return chunks(s.x, s.x + s.w, 512, s.y - 30, 760, (g, a, b) => {
      const top = s.y;
      const sg = g.createLinearGradient(0, top, 0, top + 200); sg.addColorStop(0, '#120e17'); sg.addColorStop(1, '#050407');
      g.fillStyle = sg; g.fillRect(a, top, b - a, 720);
      rect(g, a, top - 2.6, b - a, 1.6, INK); rect(g, a, top - 1.2, b - a, 3, '#ffe6a6'); rect(g, a, top - 1.2, b - a, 0.9, '#fff8e0');
      for (let i = 1; i < 5; i++) rect(g, a, top + i * GAP - 0.6, b - a, 1.2, 'rgba(242,199,102,0.75)');
      const rg = g.createLinearGradient(0, top, 0, top + 60); rg.addColorStop(0, 'rgba(255,214,140,0.16)'); rg.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = rg; g.fillRect(a, top + 1, b - a, 60);
      for (const [dy, al] of [[96, 0.12], [178, 0.07]]) { g.fillStyle = `rgba(242,199,102,${al})`; for (let i = 0; i < 5; i++) g.fillRect(a, top + dy + i * 7, b - a, 0.8); }
      // the coda sign where the last system begins; a whole note held under a fermata at the centre of the arena
      const cs = ARENA.boss[0] + 30; if (cs > a - 40 && cs < b + 40) { g.strokeStyle = 'rgba(242,199,102,0.85)'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(cs, top + 18, 9, 13, 0, 0, TAU); g.moveTo(cs - 16, top + 18); g.lineTo(cs + 16, top + 18); g.moveTo(cs, top - 1); g.lineTo(cs, top + 37); g.stroke(); }
      const wn = ARENA.boss[0] + 700; if (wn > a - 80 && wn < b + 80) { noteHead(g, wn, top + GAP * 2, GAP * 1.25, false, 'rgba(242,199,102,0.9)', '#120e17', 0); glyph(g, 'fermata', wn, top + GAP * 4 + 32, 8, { lit: '#f2c766', dark: '#a8772f', inkW: 0, d: 0 }); }
      for (let m = Math.floor(a / 700) * 700; m < b; m += 700) if (m > a - 2) rect(g, m - 0.7, top, 1.4, GAP * 4, 'rgba(242,199,102,0.6)');
    });
  }
  function noPaint() { return []; }

  /* ---------- floating platforms: the glyphs of the score made solid ---------- */
  function paintOneway(p) {
    const x = p.x, y = p.y, w = p.w, k = p.k || 'stave';
    return [{ x: x - 24, y: y - 44, w: w + 48, h: 130, draw(g) {
      const rr = U.mulberry32((x | 0) * 3 + (y | 0));
      if (k === 'stave' || k === 'roof') {
        if (k === 'stave') {
          // a strip of manuscript paper with its staff, torn at both ends
          const pts = [[x + 4, y - 1], [x + w - 4, y - 1]]; for (let q = 0; q <= 5; q++) pts.push([x + w - 2 + (rr() - 0.5) * 6, y + q * 4.4]);
          for (let xx = x + w - 6; xx > x; xx -= 9) pts.push([xx, y + 22 + rr() * 3]); for (let q = 5; q >= 0; q--) pts.push([x + 2 + (rr() - 0.5) * 6, y + q * 4.4]);
          g.fillStyle = 'rgba(11,6,18,0.25)'; g.beginPath(); g.ellipse(x + w / 2, y + 34, w * 0.42, 5, 0, 0, TAU); g.fill();
          cel(g, () => poly(g, pts), '#f3ecdc', '#c8bda8', 5, '#fffaf0', 1.6);
          g.fillStyle = '#2a2430'; for (let i = 0; i < 5; i++) g.fillRect(x + 6, y + 2.5 + i * 4.2, w - 12, i === 0 ? 1.6 : 0.9);
          glyph(g, rr() < 0.5 ? 'treble' : 'bass', x + 16, y + 10.5 + (rr() < 0.5 ? 0 : -2), 3.6, { lit: '#3a3342', dark: '#17131c', inkW: 0, d: 0 });
          for (let q = 0; q < w / 34; q++) { const nx = x + 36 + q * 30 + rr() * 6; if (nx > x + w - 14) break; noteHead(g, nx, y + 2.5 + Math.floor(rr() * 9) * 2.1, 3.8, rr() < 0.7, '#2a2430', '#2a2430', 0); }
          rect(g, x + 6, y - 1.6, w - 12, 1, 'rgba(242,199,102,0.85)');
        } else {
          // a drifting Ashport roof: slates over a gutter, roots of ink underneath
          g.fillStyle = 'rgba(11,6,18,0.22)'; g.beginPath(); g.ellipse(x + w / 2, y + 36, w * 0.4, 5, 0, 0, TAU); g.fill();
          const under = [[x + w, y + 14]]; for (let xx = x + w; xx >= x; xx -= 10) under.push([xx, y + 16 + rr() * 9 + (Math.abs(xx - x - w / 2) < w * 0.3 ? 5 : 0)]);
          poly(g, [[x - 4, y + 14], [x + w + 4, y + 14]].concat(under)); g.fillStyle = '#d6ccb8'; g.fill(); ink(g, 1.4);
          rect(g, x - 5, y - 2, w + 10, 17, INK); rect(g, x - 3, y, w + 6, 4, '#ece3d0'); rect(g, x - 3, y, w + 6, 1.2, '#fffaf0');
          for (let r = 0; r < 2; r++) for (let xx = x - 3 + r * 6; xx < x + w; xx += 12) { g.fillStyle = r ? '#4a4252' : '#36303e'; g.fillRect(xx, y + 4.5 + r * 5, 10.5, 4.4); }
          rect(g, x - 5, y + 14, w + 10, 2, C.goldD);
          g.strokeStyle = 'rgba(30,24,36,0.7)'; g.lineWidth = 1; for (let q = 0; q < w / 30; q++) { const rx = x + 8 + rr() * (w - 16); g.beginPath(); g.moveTo(rx, y + 22); g.quadraticCurveTo(rx + (rr() - 0.5) * 14, y + 34, rx + (rr() - 0.5) * 10, y + 40 + rr() * 22); g.stroke(); }
        }
      } else if (k === 'rest' || k === 'ledger') {
        // a ledger line with a whole rest (or a small note) hanging from it
        g.fillStyle = 'rgba(11,6,18,0.22)'; g.beginPath(); g.ellipse(x + w / 2, y + 30, w * 0.36, 4, 0, 0, TAU); g.fill();
        rect(g, x - 2, y - 2.5, w + 4, 7, INK); rect(g, x, y - 1, w, 3.6, '#f3ecdc'); rect(g, x, y - 1, w, 1, '#fffaf0'); rect(g, x + 3, y - 3, w - 6, 0.9, 'rgba(242,199,102,0.9)');
        if (k === 'rest') {
          const bw = Math.min(64, w * 0.42), bx = x + w / 2 - bw / 2;
          cel(g, () => { g.beginPath(); g.rect(bx, y + 4, bw, 14); }, '#3a3342', '#17131c', 4, '#f2c766', 1.6);
        } else {
          g.fillStyle = '#2a2430'; g.fillRect(x + w * 0.5 + 3, y + 4, 1.6, 14);
          noteHead(g, x + w * 0.5 - 2, y + 18, 5.4, true, '#2a2430', INK, 1);
          glow(g, x + w * 0.5 - 2, y + 18, 14, C.gold, 0.35);
        }
        for (const ex of [x, x + w]) { g.fillStyle = INK; g.beginPath(); g.arc(ex, y + 0.8, 3.4, 0, TAU); g.fill(); g.fillStyle = C.goldM; g.beginPath(); g.arc(ex, y + 0.8, 1.8, 0, TAU); g.fill(); }
      } else if (k === 'beam') {
        // a beamed run of eighth notes: you stand on the beam
        g.fillStyle = 'rgba(11,6,18,0.2)'; g.beginPath(); g.ellipse(x + w / 2, y + 52, w * 0.4, 5, 0, 0, TAU); g.fill();
        const n = Math.max(3, Math.round(w / 56));
        for (let q = 0; q < n; q++) {
          const sx = x + 10 + q * (w - 20) / (n - 1), hy = y + 30 + (q % 2 ? 4 : 0) + Math.sin(q * 1.7) * 3;
          rect(g, sx - 1.6, y + 6, 3.2, hy - y - 6, INK); rect(g, sx - 0.6, y + 6, 1, hy - y - 6, '#4a4252');
          noteHead(g, sx - 5, hy, 7.4, true, '#2a2430', INK, 1.4);
          g.fillStyle = 'rgba(255,246,226,0.5)'; g.beginPath(); g.ellipse(sx - 7, hy - 2, 2, 1, -0.4, 0, TAU); g.fill();
        }
        cel(g, () => { g.beginPath(); g.rect(x, y, w, 9); }, '#3a3342', '#17131c', 3, '#f2c766', 1.8);
        rect(g, x + 2, y - 0.4, w - 4, 1.2, '#efe7d6');
      } else if (k === 'fermata') {
        // hold here: a ledger with a fermata hung beneath it like a hammock
        rect(g, x - 2, y - 2.5, w + 4, 7, INK); rect(g, x, y - 1, w, 3.6, '#f3ecdc'); rect(g, x, y - 1, w, 1, '#fffaf0');
        g.save(); g.translate(x + w / 2, y + 5); g.scale(1, -1); glyph(g, 'fermata', 0, 0, w * 0.24, { lit: '#3a3342', dark: '#17131c', rim: '#f2c766', inkW: 1.4 }); g.restore();
        g.fillStyle = C.gold; g.beginPath(); g.arc(x + w / 2, y + 7, 2.4, 0, TAU); g.fill();
      } else if (k === 'belfry') {
        // the bell-frame beam inside the hanging belfry
        cel(g, () => { g.beginPath(); g.rect(x, y, w, 14); }, '#5a4a3e', '#2c231f', 4, '#f2c766', 1.8);
        rect(g, x, y - 1, w, 2, '#e8dcc0');
        for (const bx of [x + 16, x + w - 24]) { rect(g, bx, y + 14, 8, 22, INK); rect(g, bx + 2, y + 14, 4, 20, '#3a3342'); }
        g.fillStyle = C.goldD; for (let bx = x + 8; bx < x + w; bx += 26) { g.beginPath(); g.arc(bx, y + 7, 2, 0, TAU); g.fill(); }
      } else if (k === 'bridge') {
        // a tie across the sunken bar: you walk the beam, the tie arcs beneath it
        cel(g, () => { g.beginPath(); g.rect(x - 2, y, w + 4, 8); }, '#3a3342', '#17131c', 3, '#f2c766', 1.8);
        rect(g, x, y - 0.4, w, 1.4, '#f3ecdc');
        g.save(); g.translate(x + w / 2, y + 10); g.scale(1, -1); glyph(g, 'slur', 0, 0, w * 0.22, { lit: '#efe7d6', dark: '#cfc4ae', inkW: 1.6 }); g.restore();
        for (const ex of [x + 8, x + w - 8]) noteHead(g, ex, y + 14, 7, true, '#2a2430', INK, 1.2);
      } else if (k === 'box') {
        // a theatre box: you stand on its floor; the front is gilt and swagged
        g.fillStyle = 'rgba(11,6,18,0.2)'; g.beginPath(); g.ellipse(x + w / 2, y + 50, w * 0.4, 5, 0, 0, TAU); g.fill();
        const front = () => { g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + w + 4, y); g.lineTo(x + w, y + 26); g.quadraticCurveTo(x + w / 2, y + 40, x, y + 26); g.closePath(); };
        cel(g, front, '#e9dfc9', '#b6a993', 6, '#fff8e8', 1.8);
        rect(g, x - 6, y - 2, w + 12, 6, INK); rect(g, x - 4, y - 1, w + 8, 3.4, C.goldM); rect(g, x - 4, y - 1, w + 8, 1, C.goldL);
        g.strokeStyle = C.goldD; g.lineWidth = 1.4; for (let q = 0; q < 3; q++) { const sx = x + q * w / 3; g.beginPath(); g.moveTo(sx + 4, y + 6); g.quadraticCurveTo(sx + w / 6, y + 18, sx + w / 3 - 4, y + 6); g.stroke(); }
        for (let q = 0; q <= 3; q++) { const sx = x + q * w / 3; g.fillStyle = C.goldM; g.beginPath(); g.arc(sx, y + 6, 2.6, 0, TAU); g.fill(); }
        glow(g, x + w / 2, y + 26, 30, C.gold, 0.25);
      }
    } }];
  }

  /* =========================================================================================
     WORLD PROPS (cached; behind every actor): the title page and the clef at the first bar, double barlines
     between the movements, Ashport's belfry hanging upside down over the secret climb, the red thread from
     Mira's roof to it, the measure of silence in the sunken bar, the staff unravelling into the Long Rest,
     the Opera's proscenium around the elite's stage, the final double barline and its fermata
     ========================================================================================= */
  const floorY = (x) => (x >= RAISE.x0 && x < RAISE.x1 ? RAISE.y : x >= PIT.x0 && x < PIT.x1 ? PIT.y : 0);
  const MOVES = [[2500, 'II', '灰港・摺頁', 'Ashport, folded'], [5270, 'III', '長休止', 'the Long Rest'], [7650, 'IV', '歌劇院', 'the Opera'], [10440, 'V', '終止線', 'the final barline']];
  function doubleBar(g, x, base, top, s = 1) {
    cel(g, () => { g.beginPath(); g.rect(x, top, 7 * s, base - top); }, '#3c3444', '#17131c', 3, '#f2c766', 1.6);
    cel(g, () => { g.beginPath(); g.rect(x + 14 * s, top, 20 * s, base - top); }, '#3c3444', '#17131c', 6, '#f2c766', 2);
  }
  function hangingBelfry(g) {
    const x0 = 4575, x1 = 4855, w = x1 - x0, cx = (x0 + x1) / 2, top = -2400, sb = -1130, bot = -900, rr = U.mulberry32(4700);
    const stone = '#b9ae9c', stoneL = '#ddd3c1', stoneD = '#847a8a';
    // shaft: hanging from the top of the page
    cel(g, () => { g.beginPath(); g.rect(x0, top, w, sb - top); }, stoneL, stone, 14, '#fff6e2', 2.4);
    g.save(); g.beginPath(); g.rect(x0, top, w, sb - top); g.clip();
    g.fillStyle = 'rgba(40,32,48,0.25)'; for (let yy = top; yy < sb; yy += 26) { g.fillRect(x0, yy, w, 1.2); for (let xx = x0 + ((yy / 26) % 2) * 22; xx < x1; xx += 44) g.fillRect(xx, yy, 1.2, 26); }
    for (let yy = sb - 120; yy > top; yy -= 210) {
      rect(g, x0 - 2, yy + 92, w + 4, 8, INK); rect(g, x0, yy + 94, w, 3, stoneL);
      for (const lx of [x0 + w * 0.2, x0 + w * 0.6]) { const lw = w * 0.2; g.beginPath(); g.moveTo(lx, yy - 40); g.lineTo(lx, yy + 30); g.quadraticCurveTo(lx + lw / 2, yy + 64, lx + lw, yy + 30); g.lineTo(lx + lw, yy - 40); g.closePath(); g.fillStyle = rr() < 0.4 ? '#ffe2a0' : '#2a2430'; g.fill(); ink(g, 2.4); g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(lx + lw / 2, yy - 40); g.lineTo(lx + lw / 2, yy + 46); g.stroke(); }
    }
    g.restore();
    for (const bx of [x0 - 22, x1]) cel(g, () => { g.beginPath(); g.moveTo(bx, top); g.lineTo(bx + 22, top); g.lineTo(bx + 22, sb); g.lineTo(bx + (bx < x0 ? 22 : 0), sb + 40); g.closePath(); }, stoneL, stoneD, 6, '#fff6e2', 2);
    // the belfry, upside down: open arches whose points hang down, the bell inside mouth-up
    const bf = () => { g.beginPath(); g.rect(x0 - 16, sb, w + 32, bot - sb); };
    cel(g, bf, stoneL, stone, 10, '#fff6e2', 2.6);
    g.fillStyle = '#17131c';
    for (let i = 0; i < 2; i++) { const ax = x0 + 16 + i * (w / 2 - 6), aw = w / 2 - 26; g.beginPath(); g.moveTo(ax, sb + 18); g.lineTo(ax + aw, sb + 18); g.lineTo(ax + aw, bot - 70); g.quadraticCurveTo(ax + aw / 2, bot - 6, ax, bot - 70); g.closePath(); g.fill(); ink(g, 2.6); }
    // the jagged stump where its spire broke off (the spire is the roof Mira sits on)
    const stump = [[x0 - 16, bot]]; for (let xx = x0 - 16; xx <= x1 + 16; xx += 14) stump.push([xx, bot + 6 + rr() * 26]); stump.push([x1 + 16, bot]);
    poly(g, stump); g.fillStyle = stoneD; g.fill(); ink(g, 2.2);
    g.save(); g.translate(cx + 6, -1052); g.scale(1, -1); greatBell(g, 0, 0, 0.62, { body: '#8a6a3a', lit: '#c99a52', rim: '#ffe6a6', line: INK }); g.restore();
    glow(g, cx + 20, BELFRY.y - 40, 90, C.gold, 0.22);
    // ink still dripping off the break
    g.fillStyle = '#17131c';
    for (let k = 0; k < 7; k++) { const dx = x0 + rr() * w, len = 30 + rr() * 140; g.fillRect(dx, bot + 20, 2.2, len); g.beginPath(); g.ellipse(dx + 1.1, bot + 22 + len, 3, 4.4, 0, 0, TAU); g.fill(); }
  }
  function genProps() {
    const out = [];
    // --- the first bar: the title page, the clef ---
    out.push({ x: -40, y: -330, w: 290, h: 340, draw(g) {
      const rr = U.mulberry32(17);
      g.save(); g.translate(110, 0); g.rotate(-0.035);
      const pts = [[-110, 0], [-112, -290]]; for (let x = -112; x <= 112; x += 10) pts.push([x, -290 - (rr() < 0.3 ? rr() * 6 : 0)]); pts.push([112, -282]); for (let y = -282; y <= 0; y += 12) pts.push([112 + (rr() - 0.5) * 6, y]);
      g.fillStyle = 'rgba(11,6,18,0.3)'; g.beginPath(); g.ellipse(4, 2, 130, 7, 0, 0, TAU); g.fill();
      cel(g, () => poly(g, pts), '#f4ecdb', '#cfc4ae', 10, '#fffaf0', 2.2);
      text(g, '休止之所', 0, -246, 30, '#1c1722', { italic: false, weight: 900, font: '"Noto Serif TC", serif' });
      text(g, 'THE REST — Op. 7', 0, -214, 13, '#5a4f62', { weight: 600 });
      g.fillStyle = '#2a2430'; for (let i = 0; i < 5; i++) g.fillRect(-96, -170 + i * 7, 192, 1);
      glyph(g, 'treble', -84, -156, 6.4, { lit: '#2a2430', dark: '#17131c', inkW: 0, d: 0 });
      flat(g, -66, -163.5, 5, '#2a2430');
      text(g, 'C', -50, -156, 22, '#2a2430', { italic: false, weight: 600 });
      note(g, -28, -149, 6.4, { col: '#2a2430', up: 1, len: 3.4, inkW: 0 }); note(g, -6, -142, 6.4, { col: '#2a2430', up: 1, len: 3.4, inkW: 0 }); note(g, 16, -156, 6.4, { col: '#2a2430', up: -1, len: 3.4, inkW: 0 });
      rect(g, 36, -170, 1.2, 28, '#2a2430');
      glyph(g, 'qrest', 58, -156, 6, { lit: '#2a2430', dark: '#17131c', inkW: 0, d: 0 }); glyph(g, 'qrest', 82, -156, 6, { lit: '#2a2430', dark: '#17131c', inkW: 0, d: 0 });
      g.fillStyle = 'rgba(42,36,48,0.35)'; for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) g.fillRect(-96, -112 + r * 26 + i * 3.6, 192, 0.7);
      text(g, 'for one voice, and silence', 0, -14, 12, '#8a6328', { weight: 600 });
      rect(g, -96, -26, 192, 0.8, C.goldD);
      g.restore();
    } });
    out.push({ x: -330, y: -560, w: 300, h: 570, draw(g) {
      const s = 62, ox = -190, oy = -3.02 * s - 4;
      g.fillStyle = 'rgba(11,6,18,0.32)'; g.beginPath(); g.ellipse(ox, 2, 120, 9, 0, 0, TAU); g.fill();
      glow(g, ox + 10, oy - 60, 220, C.gold, 0.16);
      glyph(g, 'treble', ox, oy, s, { lit: '#433b4d', dark: '#17131c', rim: '#f2c766', d: 11, inkW: 3.4 });
      // gold leaf laid along the spine of the stroke
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,214,130,0.35)'; g.lineWidth = 1.6; g.beginPath();
      const P = GLYPH.treble.P; P.forEach((p, i) => { const X = ox + p[0] * s + 3, Y = oy + p[1] * s - 3; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke(); g.restore();
    } });
    // --- double barlines between the movements ---
    for (const [mx, num, zh, en] of MOVES) {
      const base = floorY(mx), top = -1150;
      out.push({ x: mx - 30, y: top - 20, w: 140, h: base - top + 40, draw(g) {
        glow(g, mx + 17, base - 300, 160, C.gold, 0.1);
        doubleBar(g, mx, base, top, 1.2);
        // a plaque at the foot: the movement's number and name
        cel(g, () => { g.beginPath(); g.rect(mx - 6, base - 82, 64, 56); }, '#f1e9d7', '#cdc2ad', 6, '#fffaf0', 1.8);
        text(g, num, mx + 26, base - 64, 22, '#1c1722', { weight: 600 });
        text(g, zh, mx + 26, base - 44, 10, '#3a3342', { italic: false, weight: 600, font: '"Noto Serif TC", serif' });
        text(g, en, mx + 26, base - 33, 7.5, '#8a6328', { weight: 600 });
      } });
    }
    // --- Ashport's belfry hanging over the secret climb, and the red thread leading up to it from Mira's roof ---
    out.push({ x: 4520, y: -2420, w: 400, h: 1720, draw: hangingBelfry });
    out.push({ x: 3380, y: -1080, w: 1360, h: 960, draw(g) {
      const pts = bez([MIRA.x + 26, MIRA.y - 62], [3720, -760], [4160, -260], [BELFRY.x + 40, BELFRY.y - 70], 60);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); pts.forEach((p, i) => { const y = p[1] + Math.sin(i * 0.7) * 3; i ? g.lineTo(p[0], y) : g.moveTo(p[0], y); });
      g.strokeStyle = 'rgba(70,12,24,0.6)'; g.lineWidth = 3.6; g.stroke(); g.strokeStyle = C.red; g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(255,170,160,0.5)'; g.lineWidth = 0.7; g.stroke();
    } });
    // --- the sunken bar: a measure of silence painted on its back wall ---
    out.push({ x: PIT.x0, y: -4, w: PIT.x1 - PIT.x0, h: PIT.y + 8, draw(g) {
      const a = PIT.x0, b = PIT.x1, h = PIT.y;
      const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#2a2430'); bg.addColorStop(1, '#141019'); g.fillStyle = bg; g.fillRect(a, 0, b - a, h);
      g.fillStyle = 'rgba(232,224,208,0.22)'; for (let i = 0; i < 5; i++) g.fillRect(a, 64 + i * 12, b - a, 1);
      const cx = (a + b) / 2;
      rect(g, cx - 90, 82, 180, 14, '#e9e1cf'); rect(g, cx - 92, 70, 4, 38, '#e9e1cf'); rect(g, cx + 88, 70, 4, 38, '#e9e1cf');
      text(g, '8', cx, 44, 30, C.goldM, { italic: false, weight: 600 });
      text(g, 'G.P.', cx, 134, 13, 'rgba(242,199,102,0.7)', { weight: 600 });
      rect(g, a, 0, 3, h, INK); rect(g, b - 3, 0, 3, h, INK);
    } });
    // --- the staff unravelling into the Long Rest (and knitting itself back together on the far side) ---
    for (const [ex, dir] of [[LINE.x0, 1], [LINE.x1, -1]]) {
      out.push({ x: ex - 260, y: -20, w: 520, h: 420, draw(g) {
        const rr = U.mulberry32(ex);
        // torn end of the slab
        const edge = [[ex, -2]]; for (let y = 0; y <= 380; y += 10) edge.push([ex + dir * (rr() * 8), y]); edge.push([ex - dir * 6, 380], [ex - dir * 6, -2]);
        poly(g, edge); g.fillStyle = '#1b1621'; g.fill(); g.strokeStyle = 'rgba(232,224,208,0.35)'; g.lineWidth = 1; g.stroke();
        // four loose lines curling down into the dark
        g.lineCap = 'round';
        for (let i = 1; i < 5; i++) {
          const y0 = i * GAP, len = 110 + i * 46 + rr() * 30;
          g.strokeStyle = 'rgba(236,228,212,0.85)'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(ex - dir * 10, y0); g.bezierCurveTo(ex + dir * (40 + i * 22), y0 + 4, ex + dir * (70 + i * 16), y0 + len * 0.6, ex + dir * (44 + i * 30), y0 + len);
          g.quadraticCurveTo(ex + dir * (30 + i * 30), y0 + len + 30, ex + dir * (50 + i * 34), y0 + len + 40); g.stroke();
          if (rr() < 0.7) noteHead(g, ex + dir * (46 + i * 30), y0 + len + 6, 4.4, true, '#e9e1cf', INK, 0.8);
        }
      } });
    }
    // --- the Opera: a proscenium around the elite's stage; on the backdrop, Ashport's roofs painted in grisaille ---
    out.push({ x: ARENA.elite[0] - 110, y: -900, w: ARENA.elite[1] - ARENA.elite[0] + 220, h: 920, draw(g) {
      const x0 = ARENA.elite[0], x1 = ARENA.elite[1], cx = (x0 + x1) / 2, top = -700, rr = U.mulberry32(9250);
      // the painted backdrop (mid values so a white knight and a dark coat both read against it)
      const bg = g.createLinearGradient(0, top, 0, 0); bg.addColorStop(0, '#5f5868'); bg.addColorStop(0.7, '#8d8594'); bg.addColorStop(1, '#a29aa6');
      g.fillStyle = bg; g.fillRect(x0 - 20, top, x1 - x0 + 40, -top);
      g.save(); g.beginPath(); g.rect(x0 - 20, top, x1 - x0 + 40, -top); g.clip();
      g.beginPath(); g.ellipse(cx + 220, -430, 74, 50, -0.36, 0, TAU); g.ellipse(cx + 223, -430, 44, 22, -0.98, 0, TAU, true); g.fillStyle = 'rgba(255,246,222,0.75)'; g.fill('evenodd');
      g.fillStyle = '#6e6677'; let xx = x0 - 20; while (xx < x1 + 20) { const w = 40 + rr() * 70, h = 80 + rr() * 150; g.fillRect(xx, -h, w, h); if (rr() < 0.4) { g.beginPath(); g.moveTo(xx, -h); g.lineTo(xx + w / 2, -h - w * 0.6); g.lineTo(xx + w, -h); g.fill(); } xx += w + 4; }
      g.fillStyle = '#58505f'; g.beginPath(); g.moveTo(cx - 140, 0); g.lineTo(cx - 140, -300); g.lineTo(cx - 110, -330); g.lineTo(cx - 80, -460); g.lineTo(cx - 50, -330); g.lineTo(cx - 20, -300); g.lineTo(cx - 20, 0); g.fill();
      g.fillStyle = 'rgba(255,226,150,0.55)'; for (let k = 0; k < 40; k++) g.fillRect(x0 + rr() * (x1 - x0), -40 - rr() * 200, 2, 3);
      g.strokeStyle = 'rgba(40,32,48,0.18)'; g.lineWidth = 1; for (let y = top + 10; y < 0; y += 22) { g.beginPath(); g.moveTo(x0, y + rr() * 4); g.lineTo(x1, y + rr() * 4); g.stroke(); }
      // canvas seams and the painter's brush marks
      g.strokeStyle = 'rgba(30,24,36,0.25)'; g.lineWidth = 1.4; for (let sx = x0 + 250; sx < x1; sx += 250) { g.beginPath(); g.moveTo(sx, top); g.lineTo(sx + 3, 0); g.stroke(); }
      g.strokeStyle = 'rgba(200,192,206,0.12)'; g.lineWidth = 6; g.lineCap = 'round'; for (let k = 0; k < 26; k++) { const bx = x0 + rr() * (x1 - x0), by = top + 40 + rr() * 300; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 30 + rr() * 50, by + (rr() - 0.5) * 10); g.stroke(); }
      // two follow-spots raking down onto the boards
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const sx of [cx - 260, cx + 240]) {
        const sg = g.createLinearGradient(0, top, 0, 0); sg.addColorStop(0, 'rgba(255,226,160,0.02)'); sg.addColorStop(1, 'rgba(255,226,160,0.16)');
        g.fillStyle = sg; g.beginPath(); g.moveTo(sx - 30, top); g.lineTo(sx + 30, top); g.lineTo(sx + 170, 0); g.lineTo(sx - 170, 0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,226,160,0.14)'; g.beginPath(); g.ellipse(sx, -4, 170, 16, 0, 0, TAU); g.fill();
      }
      g.restore();
      // hand-cut cardboard roofs standing in front of the backdrop, braced from behind
      let fx = x0 + 10;
      while (fx < x1 - 60) {
        const fw = 70 + rr() * 90, fh = 60 + rr() * 90;
        g.strokeStyle = 'rgba(30,24,36,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx + fw * 0.5, -fh + 20); g.lineTo(fx + fw * 0.5 + 26, 0); g.stroke();
        const pts = [[fx, 0], [fx, -fh * 0.6], [fx + fw * 0.25, -fh * 0.6], [fx + fw * 0.25, -fh * 0.85], [fx + fw * 0.5, -fh], [fx + fw * 0.75, -fh * 0.85], [fx + fw * 0.75, -fh * 0.55], [fx + fw, -fh * 0.55], [fx + fw, 0]];
        poly(g, pts); g.fillStyle = '#4c4555'; g.fill(); g.strokeStyle = 'rgba(232,224,208,0.55)'; g.lineWidth = 1.4; g.stroke();
        g.fillStyle = 'rgba(255,226,150,0.8)'; for (let k = 0; k < 3; k++) if (rr() < 0.6) g.fillRect(fx + 8 + rr() * (fw - 20), -fh * 0.45 + rr() * fh * 0.3, 4, 5);
        fx += fw + 30 + rr() * 80;
      }
      g.restore();
      // curtains drawn back, a valance with tassels
      for (const side of [-1, 1]) {
        const ex = side < 0 ? x0 - 20 : x1 + 20;
        const cur = () => { g.beginPath(); g.moveTo(ex, top); g.quadraticCurveTo(ex - side * 190, top + 280, ex - side * 70, -170); g.quadraticCurveTo(ex - side * 120, -60, ex - side * 60, 0); g.lineTo(ex, 0); g.closePath(); };
        cel(g, cur, '#7a7282', '#4c4555', 12, '#e8dfcc', 2);
        g.strokeStyle = 'rgba(20,16,26,0.45)'; g.lineWidth = 1.4; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(ex - side * k * 12, top + 10); g.quadraticCurveTo(ex - side * (60 + k * 22), top + 300, ex - side * (30 + k * 6), -6); g.stroke(); }
        g.strokeStyle = C.goldM; g.lineWidth = 3; g.beginPath(); g.moveTo(ex - side * 70, -175); g.quadraticCurveTo(ex - side * 30, -190, ex, -200); g.stroke();
        g.fillStyle = C.gold; g.beginPath(); g.ellipse(ex - side * 72, -168, 6, 10, 0, 0, TAU); g.fill(); ink(g, 1.2);
      }
      cel(g, () => { g.beginPath(); g.moveTo(x0 - 30, top); for (let k = 0; k <= 12; k++) g.quadraticCurveTo(x0 - 30 + (k - 0.5) * (x1 - x0 + 60) / 12, top + 70, x0 - 30 + k * (x1 - x0 + 60) / 12, top + 34); g.lineTo(x1 + 30, top); g.closePath(); }, '#7a7282', '#4c4555', 6, '#e8dfcc', 1.8);
      for (let k = 0; k <= 12; k++) { const tx = x0 - 30 + k * (x1 - x0 + 60) / 12; g.fillStyle = C.goldM; g.fillRect(tx - 2, top + 34, 4, 16); g.beginPath(); g.ellipse(tx, top + 54, 4, 6, 0, 0, TAU); g.fill(); }
      // the gilt frame: pilasters and the arch
      for (const px of [x0 - 92, x1 + 30]) {
        cel(g, () => { g.beginPath(); g.rect(px, top - 40, 62, 40 - top); }, '#f0cf7e', '#b8924e', 10, '#fff4cf', 2.4);
        for (let yy = top + 20; yy < -30; yy += 90) { g.strokeStyle = C.goldDD; g.lineWidth = 2; g.strokeRect(px + 12, yy, 38, 66); }
        rect(g, px - 8, top - 60, 78, 24, INK); rect(g, px - 6, top - 58, 74, 20, C.gold);
        rect(g, px - 8, -24, 78, 24, INK); rect(g, px - 6, -22, 74, 22, C.goldM);
      }
      const arch = () => { g.beginPath(); g.moveTo(x0 - 100, top - 36); g.lineTo(x0 - 100, top - 90); g.quadraticCurveTo(cx, top - 230, x1 + 100, top - 90); g.lineTo(x1 + 100, top - 36); g.quadraticCurveTo(cx, top - 150, x0 - 100, top - 36); g.closePath(); };
      cel(g, arch, '#f0cf7e', '#b8924e', 10, '#fff4cf', 2.6);
      g.beginPath(); g.ellipse(cx, top - 150, 46, 32, 0, 0, TAU); g.fillStyle = C.gold; g.fill(); ink(g, 2.4);
      g.strokeStyle = INK; g.lineWidth = 2.6; g.beginPath(); g.moveTo(cx - 16, top - 132); g.quadraticCurveTo(cx - 28, top - 172, cx - 6, top - 172); g.moveTo(cx + 16, top - 132); g.quadraticCurveTo(cx + 28, top - 172, cx + 6, top - 172); g.moveTo(cx - 14, top - 140); g.lineTo(cx + 14, top - 140); g.stroke();
      g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(cx + k * 4, top - 140); g.lineTo(cx + k * 3, top - 168); g.stroke(); }
    } });
    // --- the end: the final double barline (the arena's far wall) and a fermata held over the whole last measure ---
    out.push({ x: ARENA.boss[1] - 170, y: -1620, w: 200, h: 1640, draw(g) {
      glow(g, ARENA.boss[1] - 90, -600, 260, C.gold, 0.14);
      cel(g, () => { g.beginPath(); g.rect(ARENA.boss[1] - 150, -1600, 20, 1600); }, '#3c3444', '#17131c', 5, '#f2c766', 2);
      cel(g, () => { g.beginPath(); g.rect(ARENA.boss[1] - 110, -1600, 70, 1600); }, '#3c3444', '#17131c', 14, '#f2c766', 2.4);
    } });
    out.push({ x: ARENA.boss[0] + 380, y: -640, w: 640, h: 300, draw(g) {
      const fx = ARENA.boss[0] + 700, fy = -400;
      glow(g, fx, fy - 40, 200, C.gold, 0.16);
      glyph(g, 'fermata', fx, fy, 84, { lit: '#4a4152', dark: '#17131c', rim: '#ffe6a6', d: 12, inkW: 3 });
    } });
    return out;
  }

  /* =========================================================================================
     NPC: 米菈的回憶 MIRA, A MEMORY — twelve, Barrow's red scarf (a strip of it missing), her music box on her lap,
     sitting on the roof that fell off Ashport's bell tower, humming her song backwards, waiting for six o'clock
     ========================================================================================= */
  const MIRA_POSE = {
    sit: { ry: 47, torso: -0.1, head: -0.08, tF: 2.0, kF: -1.5, tB: 1.86, kB: -1.32, aF: 0.5, eF: 1.15, aB: 0.36, eB: 1.25 },
    look: { ry: 47, torso: 0.0, head: 0.05, tF: 2.0, kF: -1.5, tB: 1.86, kB: -1.32, aF: 0.52, eF: 1.1, aB: 0.38, eB: 1.2 },
    talk: { ry: 47, torso: 0.06, head: 0.1, tF: 2.0, kF: -1.5, tB: 1.86, kB: -1.32, aF: 1.7, eF: 1.0, aB: 0.38, eB: 1.2 },
  };
  // her own cel ramps (unique hexes): ink-violet shadows, paper-white light, a gilt bounce — no colour but the scarf
  const mramp = (hex, hi, lit, dark, bounce) => { Object.assign(Rig.ramp(hex), { hi, lit, dark, bounce }); return hex; };
  const MIRA_COL = {
    coat: mramp('#e8e0cf', '#fffaf0', '#ece4d4', '#a89eb0', '#d9bf86'), coatS: mramp('#bcb1a1', '#e6ddcc', '#c2b8a8', '#857a8f', '#b89c62'),
    stock: mramp('#2b2533', '#5a5266', '#332c3c', '#17121c', '#4a3e2e'), boot: mramp('#393243', '#6a6276', '#41394b', '#1d1824', '#57472f'),
    skin: mramp('#f3e9d8', '#fffcf4', '#f6eee0', '#bfb2c0', '#e7cf9a'), hair: mramp('#1e1925', '#4d4658', '#26202e', '#0f0c14', '#3a3024'),
    red: C.red, redD: C.redD, box: '#d9ad55' };
  function drawMira(ctx, x, y, t, look, mode, done, sc = 0.94) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(11,6,18,0.3)'; ctx.beginPath(); ctx.ellipse(6, 1, 34, 4.5, 0, 0, TAU); ctx.fill();
    // a memory: a faint gilt halo behind her
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -38, 70, C.gold, 0.12 + 0.04 * Math.sin(t * 1.7)); ctx.restore();
    ctx.scale(look * sc, sc);
    const hum = Math.sin(t * 1.6);
    const pose = Object.assign({}, mode === 2 ? MIRA_POSE.talk : mode === 1 ? MIRA_POSE.look : MIRA_POSE.sit);
    pose.torso += hum * 0.025; pose.head += (mode === 0 ? hum * 0.06 : 0);
    if (mode === 2) { pose.aF += Math.sin(t * 6) * 0.25; pose.eF += Math.sin(t * 7.3) * 0.3; }
    if (done) { pose.tF += Math.sin(t * 3.1) * 0.1; pose.tB += Math.sin(t * 3.1 + 1.6) * 0.1; }
    const J = Rig.compute(Rig.full(pose)), K = MIRA_COL, Ld = Rig.lightDir(ctx);
    const hand = (p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, TAU); ctx.fillStyle = K.skin; ctx.fill(); ink(ctx, 0.9); };
    // scarf tails flying behind her (the far one first)
    const nk = { x: J.chest.x - 1, y: J.chest.y + 2 };
    const tail = (ph, len, wd, col) => { const pts = []; for (let i = 0; i <= 7; i++) { const u = i / 7; pts.push({ x: nk.x - u * len, y: nk.y + 4 + u * 16 + Math.sin(t * 3.4 + ph - u * 3.6) * 5 * u }); } Rig.ribbon(ctx, pts, wd, wd * 0.45, col); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke(); };
    tail(1.3, 34, 4, K.redD);
    // back leg, back arm
    Rig.limb(ctx, J.hip, J.kneeB, 4.4, 3.8, K.stock); Rig.limb(ctx, J.kneeB, J.ankB, 3.8, 3.2, K.stock); Rig.limb(ctx, J.ankB, J.toeB, 4, 3.4, K.boot);
    Rig.limb(ctx, J.shB, J.elB, 3.8, 3.4, K.coatS); Rig.limb(ctx, J.elB, J.hdB, 3.4, 3, K.coatS); hand(J.hdB);
    // front leg
    Rig.limb(ctx, J.hip, J.kneeF, 4.6, 4, K.stock, { spec: 0.2 }); Rig.limb(ctx, J.kneeF, J.ankF, 4, 3.4, K.stock); Rig.limb(ctx, J.ankF, J.toeF, 4.2, 3.6, K.boot);
    // coat: A-line from the shoulders, its hem pooled on the roof
    const ux = J.chest.x - J.hip.x, uy = J.chest.y - J.hip.y, ul = Math.hypot(ux, uy), nx = -uy / ul, ny = ux / ul;
    const Q = (a, b) => [J.hip.x + ux * a + nx * b, J.hip.y + uy * a + ny * b];
    blob(ctx, [Q(1.1, -9), Q(1.12, 9), Q(0.5, 12), Q(-0.12, 22), Q(-0.24, 6), Q(-0.2, -16), Q(0.4, -12)]);
    ctx.fillStyle = Rig.celGrad(ctx, ...Q(0.4, 0), Ld.x, Ld.y, 16, 1, Rig.ramp(K.coat)); ctx.fill(); ink(ctx, 1.3);
    ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = 0.8; ctx.beginPath(); { const a = Q(1.0, 2), b = Q(-0.05, 6); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
    ctx.fillStyle = INK; for (const a of [0.75, 0.42]) { const p = Q(a, 5); ctx.beginPath(); ctx.arc(p[0], p[1], 1.2, 0, TAU); ctx.fill(); }
    // the music box on her lap (lid open, a gilt comb)
    const bx = (J.hip.x + J.kneeF.x) / 2 + 2, by = J.hip.y - 6;
    ctx.save(); ctx.translate(bx, by);
    ctx.beginPath(); ctx.rect(-8, -6, 16, 9); ctx.fillStyle = K.box; ctx.fill(); ink(ctx, 1);
    ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-11, -17); ctx.lineTo(5, -17); ctx.lineTo(8, -6); ctx.closePath(); ctx.fillStyle = '#b8924e'; ctx.fill(); ink(ctx, 1);
    ctx.fillStyle = '#fff1c4'; ctx.fillRect(-6, -5, 12, 1.4); ctx.fillStyle = INK; ctx.fillRect(-2, -2, 4, 2);
    ctx.restore();
    if (!done || mode !== 2) {
      // her song rising out of it, backwards: little notes that fade as they climb
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.32 + i / 3) % 1, nx2 = bx + ph * 18 - 4 + Math.sin(t * 2 + i) * 3, ny2 = by - 14 - ph * 46;
        ctx.globalAlpha = Math.sin(ph * PI) * 0.9;
        ctx.fillStyle = '#2a2430'; ctx.beginPath(); ctx.ellipse(nx2, ny2, 2.6, 1.9, -0.4, 0, TAU); ctx.fill(); ctx.fillRect(nx2 + 1.8, ny2 - 9, 1, 9);
        if (i === 1) ctx.fillRect(nx2 + 1.8, ny2 - 9, 4, 1.4);
      }
      ctx.globalAlpha = 1;
    }
    // front arm (round the box) and the near scarf tail
    Rig.limb(ctx, J.sh, J.elF, 4, 3.6, K.coat, { spec: 0.2 }); Rig.limb(ctx, J.elF, J.hdF, 3.6, 3, K.coat); hand(J.hdF);
    // head: dark bob with a fringe, a gilt hair clip, one big ink eye
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    blob(ctx, [[-10, -2], [-11, -11], [-3, -15], [7, -13], [11, -5], [10, 8], [4, 12], [-8, 12], [-12, 6]]); ctx.fillStyle = Rig.celGrad(ctx, -2, -4, Ld.x, Ld.y, 12, 1, Rig.ramp(K.hair)); ctx.fill(); ink(ctx, 1.1);
    blob(ctx, [[-4, -9], [5, -10], [10, -3], [10.6, 2], [9, 3.6], [9.4, 6.4], [5.6, 9.6], [-1, 9.4], [-4.5, 3]]); ctx.fillStyle = Rig.celGrad(ctx, 3, 0, Ld.x, Ld.y, 10, 1, Rig.ramp(K.skin)); ctx.fill(); ink(ctx, 1);
    blob(ctx, [[-7, -11], [3, -13], [11, -8], [7, -5.5], [2, -6.5], [-4, -2]]); ctx.fillStyle = K.hair; ctx.fill(); ink(ctx, 0.9);
    const blink = (t % 4.3) < 0.12, shut = mode === 0 && Math.sin(t * 0.7) > 0.55;
    if (blink || shut) { ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(4.2, -0.6); ctx.quadraticCurveTo(6.2, 0.8, 8.2, -0.6); ctx.stroke(); }
    else { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(6.4, -1, 1.7, 2.4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillRect(6.6, -2.6, 1, 1); }
    if (mode === 2 || mode === 0) { ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(7.4, 5.4, mode === 2 ? 1.6 : 1.1, 0, PI); ctx.stroke(); }
    ctx.save(); ctx.translate(-3, -11.5); ctx.rotate(0.5); rect(ctx, -4, -1.6, 8, 3.2, INK); rect(ctx, -3, -0.9, 6, 1.8, C.gold); ctx.restore();
    ctx.restore();
    // the scarf: wound at the throat, the near tail torn short (a strip of it is somewhere on the Ladder)
    ctx.beginPath(); ctx.ellipse(nk.x + 1, nk.y - 1, 6.6, 3.8, -0.2, 0, TAU); ctx.fillStyle = K.red; ctx.fill(); ink(ctx, 1.1);
    ctx.fillStyle = K.redD; ctx.fillRect(nk.x - 3, nk.y - 0.5, 7, 1.4);
    tail(0, 24, 4.4, K.red);
    ctx.restore();
  }
  const miraNPC = {
    id: 'c7_mira', x: MIRA.x, y: MIRA.y, label: '交談',
    draw(ctx, x, y, t, game) {
      const F = game.save.flags, Pl = game.player, near = Pl && Math.abs(Pl.x - x) < 300 && Math.abs(Pl.y - y) < 160;
      const look = Pl && near ? (Pl.x < x ? -1 : 1) : 1;
      drawMira(ctx, x, y, t, look, G.UI.dialogActive && near ? 2 : near ? 1 : 0, !!F.c7_quest_done);
    },
    pending(game) { const F = game.save.flags; return !F.c7_met_mira || (F.c7_got_toll && !F.c7_quest_done); },
    talk(game) {
      const F = game.save.flags;
      const done = () => {
        miraLines(F);
        game.dialog('c7_miraDone', () => {
          F.c7_quest_done = true; game.giveRelic('c7_key'); G.UI.journal('支線任務完成', '回家的鐘聲'); game.persist();
        });
        setTimeout(() => G.SFX.play('c7_toll'), 900);
      };
      miraLines(F);
      if (!F.c7_met_mira) {
        game.dialog(F.c7_got_toll ? 'c7_miraMeetHave' : 'c7_miraMeet', () => {
          F.c7_met_mira = true;
          if (F.c7_got_toll) done();
          else G.UI.journal('支線任務：回家的鐘聲', '順著紅線往上，到倒掛的鐘樓裡找回巴洛的鐘聲');
        });
      } else if (F.c7_got_toll && !F.c7_quest_done) done();
      else if (!F.c7_quest_done) game.dialog('c7_miraWait');
      else game.dialog('c7_miraAfter');
    },
  };
  level.npcs.push(miraNPC);

  /* =========================================================================================
     LIVE TOUCHES (per frame, cheap): footlight flicker, ink dripping off the hanging belfry, falling notes,
     gilt flecks, near-camera silhouettes — and the page turning over in the Long Rest
     ========================================================================================= */
  const SPR = {};
  function sprite(key, rgb, r = 32) {
    if (SPR[key]) return SPR[key];
    const c = document.createElement('canvas'); c.width = c.height = r * 2; const g = c.getContext('2d');
    const gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, `rgba(${rgb},0.9)`); gr.addColorStop(0.35, `rgba(${rgb},0.35)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return (SPR[key] = c);
  }
  const FLP = { k: 0, vis: 0, want: null };
  const EPI = { mode: null, t: 0, x: 0 };
  const NOTES = (() => { const r = U.mulberry32(7401); return Array.from({ length: 16 }, () => ({ x: r(), y: r(), s: 4 + r() * 4, sp: 18 + r() * 26, rot: r() * TAU, vr: (r() - 0.5) * 1.6, kind: r() < 0.6 ? 0 : r() < 0.5 ? 1 : 2, gold: r() < 0.18 })); })();
  const FLECKS = (() => { const r = U.mulberry32(7402); return Array.from({ length: 34 }, () => ({ x: r(), y: r(), z: 0.4 + r() * 1.2, s: 0.8 + r() * 1.8, p: r() * 10, gold: r() < 0.55 })); })();
  function drawBack(ctx, game) {
    const cx = game.cam.x, t = game.realTime;
    // footlights on the Opera's stage
    if (cx > ARENA.elite[0] - 900 && cx < ARENA.elite[1] + 900) {
      const sp = sprite('gold', '255,214,140');
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let x = ARENA.elite[0] + 60; x < ARENA.elite[1]; x += 120) {
        if (Math.abs(x - cx) > 760) continue;
        const f = 0.55 + 0.25 * Math.sin(t * 7.1 + x) + 0.15 * Math.sin(t * 13.3 + x * 0.3);
        ctx.globalAlpha = f * 0.6; ctx.drawImage(sp, x - 40, 2, 80, 64);
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    // ink still dripping from the belfry's broken stump
    if (Math.abs(cx - 4700) < 900 && game.cam.y < -300) {
      ctx.fillStyle = '#17131c';
      for (let i = 0; i < 4; i++) { const ph = (t * 0.45 + i * 0.27) % 1, dx = 4600 + i * 61, dy = -870 + ph * ph * 520; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(dx, dy, 2.6, 3.8 + ph * 3, 0, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  function drawFront(ctx, game) {
    const cam = game.cam, t = game.realTime, n = nightAt(cam.x), W = 1500, H = 900;
    // falling notes, slow as snow (ink by day, pale by night, a few of them gilt)
    const ink0 = n > 0.5 ? 'rgba(230,222,206,0.55)' : 'rgba(24,19,30,0.5)', cnt = low() ? 8 : NOTES.length;
    for (let i = 0; i < cnt; i++) {
      const q = NOTES[i];
      const px = cam.x - W / 2 + ((q.x * W + t * 9 + Math.sin(t * 0.4 + i) * 30) % W + W) % W;
      const py = cam.y - H / 2 + ((q.y * H + t * q.sp) % H + H) % H;
      ctx.save(); ctx.translate(px, py); ctx.rotate(q.rot + t * q.vr * 0.4);
      ctx.fillStyle = q.gold ? 'rgba(242,199,102,0.75)' : ink0;
      ctx.beginPath(); ctx.ellipse(0, 0, q.s * 0.66, q.s * 0.46, -0.38, 0, TAU); ctx.fill();
      if (q.kind) { ctx.fillRect(q.s * 0.5, -q.s * 3, q.s * 0.14, q.s * 3); if (q.kind === 2) ctx.fillRect(q.s * 0.5, -q.s * 3, q.s * 0.9, q.s * 0.3); }
      ctx.restore();
    }
    // the epilogue: Vega's echo going up as gold
    if (EPI.mode === 'listen' || EPI.mode === 'sever') {
      const sp = sprite('gold', '255,214,140'), k = EPI.mode === 'listen' ? 1 : 0.35;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < (low() ? 14 : 30); i++) {
        const ph = (EPI.t * (0.18 + (i % 5) * 0.03) + i / 30) % 1, px = EPI.x + Math.sin(i * 2.3 + EPI.t * 0.8) * (30 + ph * 60), py = -20 - ph * 520;
        ctx.globalAlpha = Math.sin(ph * PI) * 0.7 * k; ctx.drawImage(sp, px - 9, py - 9, 18, 18);
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  // near-camera ink (parallax 1.35): staves and drips crossing the top and bottom edges of the frame
  function drawForeground(ctx, cam, S, game) {
    const f = 1.35, span = 1500, base = Math.floor((cam.x * f - 1600) / span), t = game.realTime, n = nightAt(cam.x);
    const col = n > 0.6 ? 'rgba(5,4,8,0.9)' : 'rgba(10,8,14,0.86)';
    for (let i = base; i < base + 4; i++) {
      const rng = U.mulberry32(i * 977 + 71);
      if (rng() < 0.3) continue;
      const lx = i * span + rng() * 700, x = cam.x + (lx - cam.x * f), kind = rng();
      ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col;
      if (kind < 0.45) {
        // a staff sweeping across the top corner
        const top = cam.y - 400 + rng() * 40, sway = Math.sin(t * 0.5 + i) * 6;
        ctx.lineWidth = 3;
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x - 320, top + k * 13 + 60); ctx.quadraticCurveTo(x + sway, top + k * 13 - 30 + rng() * 20, x + 360, top + k * 13 + 90); ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(x - 60, top + 28, 11, 8, -0.4, 0, TAU); ctx.fill(); ctx.fillRect(x - 51, top - 6, 3, 34);
      } else if (kind < 0.8) {
        // ink running down from above, a drop about to fall
        const top = cam.y - 420, len = 120 + rng() * 120, wd = 7 + rng() * 9, sw = Math.sin(t * 0.7 + i) * 2;
        ctx.beginPath(); ctx.moveTo(x - wd, top); ctx.lineTo(x - wd * 0.5 + sw, top + len); ctx.quadraticCurveTo(x - wd * 1.6 + sw, top + len + wd * 1.5, x + sw, top + len + wd * 2.6); ctx.quadraticCurveTo(x + wd * 1.6 + sw, top + len + wd * 1.5, x + wd * 0.5 + sw, top + len); ctx.lineTo(x + wd, top); ctx.closePath(); ctx.fill();
      } else {
        // a giant quarter rest rearing out of the bottom edge
        ctx.translate(x, cam.y + 300); brushPath(ctx, GLYPH.qrest.P, GLYPH.qrest.W, 70, 0, 0); ctx.fill();
      }
      ctx.restore();
    }
    return true;
  }
  // screen space: gilt flecks and paper motes; then (in the Long Rest) the whole frame turns over like a page
  // dev aid (?c7art=1): an art board of the chapter's hand-drawn pieces at large scale
  const DEVART = DEVQ && DEVQ.get('c7art');
  function artBoard(ctx, W, H, S, time) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = DEVART === '2' ? '#2a2430' : '#d9cfbb'; ctx.fillRect(0, 0, W, H);
    const PL = SKY.plumes || [];
    for (let i = 0; i < PL.length; i++) ctx.drawImage(PL[i], (i % 2) * W * 0.5, Math.floor(i / 2) * H * 0.26, W * 0.5, W * 0.5 * 300 / 620);
    const k = H / 720;
    ctx.translate(0, H * 0.55);
    const keys = ['treble', 'bass', 'fermata', 'qrest', 'erest'];
    keys.forEach((kk, i) => glyph(ctx, kk, (120 + i * 150) * k, 60 * k, 26 * k, { lit: '#433b4d', dark: '#17131c', rim: '#f2c766', d: 4 * k, inkW: 2 }));
    drawMira(ctx, 980 * k, 200 * k, time, 1, 0, false, 3.2 * k);
    ctx.restore();
  }
  // the abyss under the Long Rest: painted over the far layer (whose mist would otherwise fill it), under everything else
  function afterLayer(key, ctx, cam, W, H, S, time) {
    if (key !== 'far') return;
    const v = voidAt(cam.x); if (v < 0.01) return;
    const ly = H / 2 - cam.y * S;
    if (ly > H) return;
    const gr = ctx.createLinearGradient(0, ly - 40 * S, 0, H);
    gr.addColorStop(0, 'rgba(14,11,18,0)'); gr.addColorStop(0.14, `rgba(16,12,20,${0.86 * v})`); gr.addColorStop(1, `rgba(5,4,8,${v})`);
    ctx.fillStyle = gr; ctx.fillRect(0, ly - 40 * S, W, H - ly + 40 * S);
    ctx.fillStyle = 'rgba(255,246,222,0.9)';
    for (const st of SKY.stars || []) {
      const px = ((st.x * W * 1.3 - cam.x * 0.03 * S) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15, py = ly + 30 * S + st.y * (H - ly);
      const a = v * (0.25 + 0.35 * Math.sin(time * 0.9 + st.p));
      if (a > 0.05) { ctx.globalAlpha = a; ctx.fillRect(px, py, st.s * S, st.s * S); }
    }
    ctx.globalAlpha = 1;
  }
  function drawAtmos(ctx, cam, W, H, S, time) {
    if (DEVART) { artBoard(ctx, W, H, S, time); return true; }
    const n = nightAt(cam.x), v = voidAt(cam.x), cnt = low() ? 14 : FLECKS.length;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < cnt; i++) {
      const d = FLECKS[i];
      const px = ((d.x * W * 1.4 - cam.x * d.z * S * 0.5 + time * 6 * d.z * S) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
      const py = ((d.y * H - time * 7 * d.z * S - cam.y * d.z * S * 0.25) % H + H) % H;
      const a = (0.3 + 0.3 * Math.sin(time * 1.1 + d.p)) * (d.gold ? 1 : 0.6) * (0.6 + 0.4 * n + 0.4 * v);
      ctx.fillStyle = d.gold ? `rgba(255,214,130,${a})` : `rgba(255,248,232,${a * 0.6})`;
      const r = d.s * S * d.z * 0.8;
      ctx.fillRect(px, py, r, r);
    }
    ctx.globalCompositeOperation = 'source-over';
    // the page turning over: mirror the finished frame about its horizontal centre line
    if (FLP.vis > 0.001) {
      const k = U.easeInOutSine(FLP.vis), sy = Math.cos(k * PI);
      ctx.save();
      ctx.globalCompositeOperation = 'copy';
      ctx.setTransform(1, 0, 0, sy, 0, H / 2 * (1 - sy));
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.restore();
      if (Math.abs(sy) < 0.999) {
        // behind the turning page: ink, and the hinge of light it turns on
        ctx.save(); ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#07060a'; ctx.fillRect(0, 0, W, H); ctx.restore();
        const e = 1 - Math.abs(sy), h = Math.abs(sy) * H / 2;
        ctx.fillStyle = `rgba(0,0,0,${0.45 * e})`; ctx.fillRect(0, H / 2 - h, W, h * 2);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const lg = ctx.createLinearGradient(0, H / 2 - 30 * S, 0, H / 2 + 30 * S); lg.addColorStop(0, 'rgba(255,214,140,0)'); lg.addColorStop(0.5, `rgba(255,230,180,${0.8 * e})`); lg.addColorStop(1, 'rgba(255,214,140,0)');
        ctx.fillStyle = lg; ctx.fillRect(0, H / 2 - 30 * S, W, 60 * S);
        ctx.restore();
      }
    }
    return true;
  }

  /* =========================================================================================
     MUSIC — a question left hanging (the chapter's own motif: it ends on the second degree and stops),
     and Maestrina's theme heard the way the Rest hears it: backwards, in pieces, on Mira's music box.
     Only at the very end, if you let Vega finish, does the theme play forwards again.
     ========================================================================================= */
  const THEME = (G.Music && G.Music.THEME) || [];
  const REV = THEME.map(([s, m, l]) => [128 - s - l, m, l]).sort((a, b) => a[0] - b[0]);
  // the reversed theme in pieces: every third note dropped, the survivors left ringing into the gaps
  const REV_FRAG = REV.filter((n, i) => i % 3 !== 1).map(([s, m, l]) => [s, m, Math.min(16, l * 2)]);
  const MOTIF = [[0, 69, 8], [8, 74, 6], [16, 72, 4], [20, 69, 12], [40, 65, 4], [44, 67, 4], [48, 69, 16],
    [64, 76, 8], [72, 74, 4], [76, 72, 4], [80, 74, 12], [92, 70, 4], [96, 69, 8], [104, 67, 4], [108, 65, 4], [112, 64, 12]];
  const shift = (arr, ds, dm = 0) => arr.map(([s, m, l]) => [s + ds, m + dm, l]);
  const CELLO = [[0, 50, 16], [16, 53, 16], [32, 55, 16], [48, 52, 16], [64, 50, 24], [88, 57, 8], [96, 51, 16], [112, 52, 16]];
  const WALTZ = [[0, 74, 6], [6, 77, 6], [12, 81, 4], [16, 82, 8], [24, 81, 4], [28, 79, 4], [32, 77, 6], [38, 74, 6], [44, 77, 4], [48, 76, 12], [60, 73, 4],
    [64, 74, 6], [70, 77, 6], [76, 81, 4], [80, 84, 8], [88, 82, 4], [92, 81, 4], [96, 79, 6], [102, 77, 6], [108, 76, 4], [112, 74, 16]];
  const chords = {
    c7Dm9: [38, 65, 69, 72, 76], c7Bbmaj7: [34, 65, 69, 70, 74], c7Gm9: [31, 62, 65, 69, 70], c7Asus: [33, 62, 64, 69, 74],
    c7Fadd9: [41, 64, 67, 69, 72], c7Csus2: [36, 62, 64, 67, 74], c7Ebmaj7: [39, 62, 67, 70, 74], c7Dsus: [38, 62, 67, 69, 74], c7Am7: [33, 64, 67, 69, 72],
  };
  const tracks = {
    // the first bar → Ashport: the motif on a music box, then the theme played backwards on it, a cello under both
    c7_explore: { bpm: 56, chords: ['c7Dm9', 'c7Bbmaj7', 'c7Gm9', 'c7Asus', 'c7Dm9', 'c7Fadd9', 'c7Ebmaj7', 'c7Asus', 'c7Bbmaj7', 'c7Fadd9', 'c7Csus2', 'c7Dsus', 'c7Gm9', 'c7Ebmaj7', 'c7Asus', 'c7Dm9'],
      melody: MOTIF.concat(shift(REV_FRAG, 128)), mel: 'musicbox', melEvery: 1, pad: 'strings', arp: 'none', choir: 0.32, bass: 0, drums: 0,
      counter: true, counterLine: CELLO.concat(shift(CELLO, 128, -2)) },
    // the Long Rest: almost nothing — a drone, a choir breathing, three bell notes of the theme, backwards
    c7_void: { bpm: 42, chords: ['c7Dsus', 'c7Dsus', 'c7Ebmaj7', 'c7Ebmaj7', 'c7Dsus', 'c7Bbmaj7', 'c7Asus', 'c7Asus'],
      melody: [[0, 81, 16], [40, 77, 8], [64, 74, 32], [112, 73, 16]], mel: 'bell', melEvery: 1, pad: 'strings', arp: 'none', choir: 0.6, bass: 0, drums: 0 },
    // the Opera and the barline: the reversed theme carried by strings, the motif answering in the cellos, a harp
    c7_explore2: { bpm: 60, chords: ['c7Dm9', 'c7Gm9', 'c7Ebmaj7', 'c7Asus', 'c7Bbmaj7', 'c7Gm9', 'c7Asus', 'c7Dsus'],
      melody: shift(REV_FRAG, 0, -12), mel: 'strings', melEvery: 1, pad: 'strings', arp: 'harp', choir: 0.25, bass: 0.2, drums: 0,
      counter: true, counterLine: shift(MOTIF, 0, -12) },
    // Graves, remembered: a noble waltz in a march's clothes, the theme backwards in the cellos under it
    c7_elite: { bpm: 120, chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Eb', 'C', 'A'], melody: WALTZ, mel: 'strings', melEvery: 1, pad: 'strings', arp: 'ostinato',
      choir: 0.45, bass: 1, drums: 1, boss: true, timpani: true, counter: true, counterLine: REV },
    // Vega's echo: the theme as the Rest wrote her — backwards, in brass; the chapter's motif in the low strings
    c7_boss: { bpm: 126, chords: ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Eb', 'A', 'A'], melody: shift(REV_FRAG, 0, -12), mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato',
      choir: 0.7, bass: 1, drums: 1, boss: true, timpani: true, counter: true, counterLine: MOTIF },
    // the last lesson: the theme turns the right way round
    c7_boss2: { bpm: 138, chords: ['Dm', 'C', 'F', 'Bb', 'Dm', 'Bb', 'A', 'Dm'], melody: shift(THEME, 0, -12), mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato',
      choir: 1, bass: 1, drums: 1, boss: true, timpani: true, toms: true, counter: true, counterLine: MOTIF },
    // if you let her finish: the song, forwards, the way it was written
    c7_farewell: { bpm: 58, chords: ['Dm', 'C', 'F', 'Bb', 'Dm', 'F', 'A', 'Dm'], melody: THEME, mel: 'piano', melEvery: 1, pad: 'strings', arp: 'harp', choir: 0.5, bass: 0, drums: 0, counter: true },
  };
  const ambience = {
    // paper: a page turning somewhere, a music-box note sounding backwards (it swells in, then stops)
    c7_paper: { bed: [0.16, 0.05, 0, 0.12], gap: [3, 5], evt(t, A) {
      if (Math.random() < 0.55) { const m = 81 + [0, -3, -7, -5, -12][Math.floor(Math.random() * 5)]; A.tone('sine', A.mtof(m), t, 1.1, 0.014, 0.05, { wet: 0.9 }); A.tone('sine', A.mtof(m) * 2.76, t, 1.1, 0.004, 0.04, { wet: 0.9 }); }
      else A.noise(t, 0.08, 0.018, 0.35, 'highpass', 2600, 5200, 0.6, 0.5);
    } },
    // Ashport: its evening bell, very far away, and gulls that never finish their cry
    c7_ashport: { bed: [0.26, 0.08, 0, 0.16], gap: [4, 6], evt(t, A) {
      const r = Math.random();
      if (r < 0.45) A.bell(A.mtof(50), t, 0.028, 5, 0.95, 0.5);
      else if (r < 0.75) A.tone('triangle', A.mtof(62 + [0, 3, 7][Math.floor(Math.random() * 3)]), t, 1.4, 0.012, 0.06, { wet: 0.95 });
      else A.tone('sine', 1500, t, 0.05, 0.006, 0.25, { to: 1100, wet: 0.8 });
    } },
    // the Long Rest: nothing — then, far below, one high bell, or a slow heartbeat
    c7_void: { bed: [0.04, 0.02, 0, 0.42], gap: [6, 8], evt(t, A) {
      if (Math.random() < 0.5) A.bell(A.mtof(93), t, 0.008, 3.5, 1, 0.3);
      else { A.tone('sine', 52, t, 0.01, 0.05, 0.35, { to: 40, wet: 0.5 }); A.tone('sine', 50, t + 0.42, 0.01, 0.035, 0.35, { to: 38, wet: 0.5 }); }
    } },
    // the Opera: an orchestra tuning to an A that never resolves, a single cough of applause
    c7_opera: { bed: [0.12, 0.03, 0, 0.22], gap: [4, 7], evt(t, A) {
      if (Math.random() < 0.6) A.stringVoice(440, t, 2.6, 0.012, A.sfxBus, 1600);
      else for (let i = 0; i < 9; i++) A.noise(t + i * 0.05 + Math.random() * 0.04, 0.003, 0.012, 0.05, 'bandpass', 1600 + Math.random() * 1400, null, 1.2, 0.6);
    } },
    // the barline: a timpani roll held under a fermata, ink dripping
    c7_coda: { bed: [0.18, 0.04, 0, 0.6], gap: [5, 8], evt(t, A) {
      if (Math.random() < 0.5) for (let i = 0; i < 6; i++) A.drum('timpani', t + i * 0.09, 0.05 + i * 0.012, A.sfxBus);
      else A.tone('sine', 1400, t, 0.002, 0.02, 0.14, { to: 560, wet: 0.7 });
    } },
  };
  const sfx = {
    // the page turning over: a long paper swish, a low swell, a shimmer on the hinge
    c7_flip(t) {
      const A = G.AudioKit;
      A.noise(t, 0.5, 0.12, 1.4, 'bandpass', 700, 3400, 0.8, 0.5);
      A.noise(t + 0.9, 0.05, 0.1, 0.5, 'highpass', 2400, 6000, 0.7, 0.6);
      A.tone('sine', 55, t, 1.0, 0.12, 1.6, { to: 82, wet: 0.6 });
      [86, 89, 93, 98].forEach((m, i) => A.bell(A.mtof(m), t + 1.1 + i * 0.06, 0.03, 2.4, 1, 0.5));
    },
    // Barrow's evening bell, cracked, still ringing
    c7_toll(t) {
      const A = G.AudioKit;
      A.bell(A.mtof(50), t, 0.26, 6, 0.9, 0.7); A.bell(A.mtof(62), t + 0.012, 0.08, 4.5, 0.9, 0.45);
      A.tone('sine', A.mtof(38), t, 0.02, 0.1, 4, { wet: 0.6 }); A.tone('sine', A.mtof(50) * 1.012, t, 0.02, 0.05, 3, { wet: 0.7 });
    },
    // the Belfry's great bell, sinking through the dark
    c7_greatBell(t) { const A = G.AudioKit; A.bell(A.mtof(43), t, 0.2, 8, 1, 0.6); A.bell(A.mtof(55), t + 0.02, 0.06, 6, 1, 0.4); A.tone('sine', A.mtof(31), t, 0.05, 0.12, 6, { wet: 0.8 }); },
    // a memory letting go: gilt chimes climbing
    c7_memory(t) { const A = G.AudioKit; [74, 77, 81, 86, 89].forEach((m, i) => A.bell(A.mtof(m), t + i * 0.16, 0.05, 2.6, 1, 0.6)); },
    // a thread cut
    c7_sever(t) { const A = G.AudioKit; A.noise(t, 0.003, 0.3, 0.18, 'highpass', 3000, 900, 0.9, 0.3); A.tone('sawtooth', 880, t, 0.002, 0.05, 0.6, { to: 110, wet: 0.5 }); A.bell(A.mtof(50), t + 0.3, 0.06, 3, 1, 0.3); },
  };

  /* =========================================================================================
     STORY — dialogue, barks, hints, codex
     ========================================================================================= */
  const data = {
    speakers: {
      c7_mira: { name: '米菈', en: 'MIRA — A MEMORY', color: '#ff9a8c' },
      c7_odevega: { name: '歐德……？', en: 'ODE — IN HER VOICE', color: '#ffffff' },
    },
    hints: {
      c7_erase: '休止符劃出<b>紅色劃痕</b>時，那塊平台約一秒後會消失三秒——離開它，或趁它劃到一半時用 {light} 打斷。地面永遠都在',
      c7_secret: '紅線一路往上，牽進倒掛的鐘樓……利用<b>二段跳</b>（空中再按 {jump}），沿著懸浮的音符一層一層往上爬',
      c7_hold: '延長記號的<b>金色穹頂</b>會讓你的腳步變慢——別在裡面硬拚，翻滾 {dodge} 出去。拱門倒下後要花很久才站得起來，那是出手的時機',
    },
    barks: {
      c7_hum: { who: 'ode', text: '……有人在哼歌。是那首歌——倒著唱的。' },
      c7_pit: { who: 'ode', text: '這一小節整個沉下去了，上面只剩一條連結線。被擦掉的話——跳上來就好。' },
      c7_toll: { who: 'ode', text: '一聲鐘響……被摺成一張紙的形狀。它還是溫的。' },
      c7_tollMet: { who: 'ode', text: '巴洛的鐘聲。拿回屋頂上給米菈吧——她在等六點。' },
      c7_bellRing: { who: 'ode', text: '下面那口大鐘，是鐘樓聚落的大鐘。它在響……塔莉亞修好的那一聲，傳到這裡來了。' },
      c7_bellMute: { who: 'ode', text: '鐘樓聚落的大鐘。沒有鐘錘，它一聲也發不出來——在這裡也一樣。' },
      c7_unflip: { who: 'ode', text: '頁面翻回來了。……我的陀螺儀需要一點時間，才能原諒這件事。' },
    },
    dialog: {
      c7_enter: [
        { who: 'ode', text: '……凜音？聽得到嗎？' },
        { who: 'rinne', text: '聽得到。……太清楚了。' },
        { who: 'ode', text: '定位系統回報：「此處不存在」。高度計回報：「上面」。重力計回報：「大概有」。三個都很誠實，我很欣慰。' },
        { who: 'ode', text: '腳下是五條平行線，間距九公分。凜音——我們站在一頁樂譜上。' },
        { who: 'rinne', text: '休止之所。' },
        { who: 'ode', text: '這裡不是沒有聲音。是每一個聲音，都停在等下一個音的那一刻。' },
      ],
      c7_score: [
        { who: 'ode', text: '線上寫滿了東西。音符、休止符、強弱記號……有些段落被擦掉了。' },
        { who: 'ode', text: '比對資料庫：這一小節是方舟的晨禱。下一小節是灰港的早市叫賣。再下一小節……是一個人的心跳。' },
        { who: 'rinne', text: '所有被寂靜吃掉的聲音，都落在這裡。' },
        { who: 'ode', text: '那這本樂譜，應該很厚。' },
      ],
      c7_restmarks: [
        { who: 'ode', text: '前面有東西浮在線上——休止符。活的。' },
        { who: 'ode', text: '它們會用紅線把你腳下的平台劃掉。被劃掉的地方，有三秒鐘什麼都不存在。' },
        { who: 'rinne', text: '那就別站在它想擦掉的地方。' },
        { who: 'ode', text: '……或是在它劃到一半的時候，把它打斷。我比較喜歡這個方案。' },
      ],
      c7_mirror: [
        { who: 'ode', text: '凜音，前面那個……是你。' },
        { who: 'ode', text: '用墨水寫成的你。你剛剛揮出的每一刀，它都抄下來了。' },
        { who: 'rinne', text: '那它應該很清楚，我會怎麼贏。' },
        { who: 'ode', text: '它只會照抄。少出手、多格擋——讓它抄一份很無聊的作業。' },
      ],
      c7_ashport: [
        { who: 'rinne', text: '……灰港。' },
        { who: 'ode', text: '倒過來的灰港。大教堂、沉鐘大道、屋頂——被摺進了樂譜的邊緣。' },
        { who: 'ode', text: '聲紋比對：鐘聲、海鷗、早市、小孩子的笑聲。全部都停在「快要響起來」的前一刻。' },
      ],
      c7_choir: [
        { who: 'ode', text: '廣場上有人在唱詩。……不，他們張著嘴，卻沒有聲音。' },
        { who: 'ode', text: '無聲詩班。只要附近還有一個活著，你的共鳴就會被吞掉——一點都存不起來。' },
        { who: 'rinne', text: '先拆散那個圓圈。' },
      ],
      c7_belfry: [
        { who: 'ode', text: '灰港大教堂的鐘樓，倒掛著。尖頂斷了——斷掉的那一截，就是下面那個女孩坐著的屋頂。' },
        { who: 'ode', text: '鐘還在。可是它的聲音……掉出來了。就浮在那裡。' },
      ],
      c7_line: [
        { who: 'ode', text: '……五線譜到這裡，只剩下一條線。' },
        { who: 'ode', text: '下面什麼都沒有。不是黑——是「沒有」。我的感測器拒絕回答深度。' },
        { who: 'rinne', text: '長休止。整個樂團一起停下來的地方。' },
        { who: 'ode', text: '那我們就是唯一還在動的東西。很好，我一直想當獨奏。' },
      ],
      c7_flip: [
        { who: 'ode', text: '……凜音。不要慌。' },
        { who: 'ode', text: '我們沒有掉下去。是這一頁——翻過來了。' },
        { who: 'rinne', text: '……城市是正的。' },
        { who: 'ode', text: '嗯。在休止之所，「上」和「下」只是兩種記譜方式。繼續走，線還在你腳下。' },
      ],
      c7_opera: [
        { who: 'rinne', text: '……萊拉大歌劇院。' },
        { who: 'ode', text: '跟我們在湖底看到的不一樣。這裡的它還沒有沉。燈全亮著，座位全空著。' },
        { who: 'ode', text: '這是露塞特記得的樣子。……也可能是觀眾記得的樣子。休止之所分不太清楚。' },
      ],
      c7_fermata: [
        { who: 'ode', text: '那座拱門在走路。延長記號——「在這裡，停久一點」。它把這句話當成了命令。' },
        { who: 'ode', text: '小心它的金色穹頂，罩住你的時候，你的腳步只剩一半。整座拱門倒下來的那一招是紅光——閃開。' },
      ],
      c7_eliteIntro: [
        { who: 'graves', text: '……又見面了，方舟的劍。' },
        { who: 'rinne', text: '葛雷夫。' },
        { who: 'graves', text: '別緊張。這裡沒有我要守的東西了。她已經安息——我也是。' },
        { who: 'graves', text: '只有一件事放不下：上一次，我是用一把斷了弦的劍跟你打的。' },
        { who: 'graves', text: '這一次，讓我用完整的劍，跳完這支舞。三拍子——跟上。' },
      ],
      c7_eliteDefeat: [
        { who: 'graves', text: '……好劍。比上一次還要好。' },
        { who: 'graves', text: '那時候，我請你替我告訴她，我累了。……她聽到了。謝謝你。' },
        { who: 'graves', text: '這是我的誓言。我已經不需要它了——你帶著走吧。' },
        { who: 'graves', text: '往上走，凜音。那個孩子還在等。這一次，別讓她一個人唱。' },
        { who: 'ode', text: '……他走了。這一次，是他自己決定走的。' },
      ],
      c7_coda: [
        { who: 'ode', text: '凜音，你看太陽。' },
        { who: 'rinne', text: '……塗滿了。' },
        { who: 'ode', text: '剛進來的時候，它是一個空心的全音符。現在，它是黑色的。' },
        { who: 'ode', text: '終止線就在前面。過了那條線，這首曲子就結束了。……然後，是最後一個樂章。' },
      ],
      c7_bossIntro: [
        { who: 'ode', text: '凜音。前方有一個訊號。' },
        { who: 'ode', text: '頻率……和我核心裡的那一段，一模一樣。' },
        { who: 'vega', text: '——站住。報上隊別和編號。' },
        { who: 'rinne', text: '……第七降臨隊。晚禱七號。' },
        { who: 'vega', text: '第七隊。……奇怪。我不記得你的臉。' },
        { who: 'vega', text: '我只記得，有一個人，我還沒有教完。' },
        { who: 'vega', text: '拔刀。手會記得的事，比臉多。' },
        { who: 'ode', text: '凜音，那不是她。那是休止照著她的樣子，重新寫出來的——' },
        { who: 'rinne', text: '我知道。……可是那是她的站姿。' },
      ],
      c7_bossDefeat: [
        { who: 'vega', text: '……斷弦。收刀的時候，手腕還是會抖一下。' },
        { who: 'vega', text: '跟我一模一樣。……原來是你，凜音。你長得好高了。' },
        { who: 'vega', text: '我還有好多話沒說完。可是我好像……只剩下一句話的時間。' },
        { who: 'ode', text: '她的訊號在散開。凜音——' },
      ],
      c7_listen: [
        { who: 'vega', text: '你七歲那年，在育幼院對著通風口唱歌。你說，通風口會回答。' },
        { who: 'vega', text: '我那時候沒告訴你——回答你的，不只是頌者。有一天晚上，我也聽見了：有個孩子，在很遠很遠的地方，接著你唱下一句。' },
        { who: 'vega', text: '所以我教你握刀。不是要你去打仗。是要你有一天能走到這裡，替那個孩子，把歌唱完。' },
        { who: 'vega', text: '……對不起。這件事，本來應該是我來做的。' },
        { who: 'rinne', text: '隊長——' },
        { who: 'vega', text: '還有。早餐要吃。大衣的袖子我改短了，記得穿。出發前檢查三次刀——這個你本來就會。' },
        { who: 'vega', text: '最後一句。我一直想親口說完的那一句……別回頭——' },
        { who: 'c7_odevega', text: '——往前走。替我，把歌唱完。' },
        { who: 'vega', text: '……啊。原來那一句，我留在你那裡了。' },
        { who: 'vega', text: '歐德。……替我照顧她。' },
        { who: 'ode', text: '……收到，隊長。' },
        { who: 'rinne', text: '我會唱完的。' },
      ],
      c7_sever: [
        { who: 'rinne', text: '隊長最後的話，我已經聽過了。不需要休止再替你說一次。' },
        { who: 'vega', text: '……是嗎。那就……往——' },
        { who: 'ode', text: '……訊號消失。我的核心裡，剛才有一句話差點說出口。現在，它不見了。' },
        { who: 'rinne', text: '走吧。' },
      ],
      // pylon first visits and Mira's lines are rebuilt from the save on entry (they remember what you did)
      c7_pylon1: [], c7_pylon2: [], c7_pylon3: [],
      c7_miraMeet: [], c7_miraMeetHave: [], c7_miraWait: [], c7_miraDone: [], c7_miraAfter: [],
    },
    codex: {
      people: [
        { id: 'c7_mira', name: '米菈的回憶', en: 'MIRA — A MEMORY', portrait: 'c7_mira', unlock: 'c7_met_mira', tag: 'NPC｜坐在灰港屋頂上的女孩',
          body: ['休止之所裡，一段關於米菈的回憶：十二歲，圍著父親的紅圍巾，抱著會唱歌的音樂盒，坐在灰港鐘塔斷落的屋頂上，等傍晚六點的鐘聲。',
            '她記得黑頭髮的大姐姐教她的歌，記得「只要屏住呼吸，就不會再有東西不見」。她不記得，自己已經屏住呼吸多久了。',
            '她的紅圍巾末端少了一截。那一截，被風吹到了很遠很遠的地方。'] },
        { id: 'c7_vega', name: '薇格的殘響', en: 'THE ECHO OF ELAINE VEGA', portrait: 'c7_boss', unlock: 'c7_boss_seen', tag: '頭目｜第七降臨隊隊長（殘響）',
          body: ['艾蓮・薇格陣亡的那一刻，她把一小段自己上傳進了一架戰術無人機。剩下的——沒說完的話、沒教完的課——沉進了休止之所。',
            '休止把她重新寫了一遍：墨水與金箔，比生前高大一些，用的是凜音的劍術。因為那本來就是她的劍術。',
            '她不記得凜音的臉。可是她的手記得。'] },
        { id: 'c7_graves', name: '葛雷夫的回憶', en: 'GRAVES, REMEMBERED', portrait: 'c7_elite', unlock: 'c7_elite_seen', tag: '菁英｜第一降臨隊副隊長（殘響）',
          body: ['灰港屋頂上的斷弦騎士。在聖堂前，他請凜音替他告訴瑪絲緹娜：「我累了。」',
            '在休止之所裡，他的鎧甲是白的，劍是完整的。他不再守護誰的寂靜——他只是想用一把完整的劍，把那支舞跳完。'] },
      ],
      world: [
        { id: 'c7_rest', name: '休止之所', en: 'THE REST', unlock: 'c7_arrived',
          body: ['方舟上方、星星之間，一塊沒有星光的方形黑暗。從裡面看，它是一頁沒有寫完的樂譜。',
            '大寂靜吞掉的每一個聲音都落在這裡：方舟的晨禱、灰港的晚鐘、歌劇院最後的高音、一位隊長最後的三秒。它們沒有消失——它們在等下一個音。',
            '歐德的測量結果：寬度「很寬」，深度「拒絕回答」，時間「暫停中」。'] },
        { id: 'c7_staff', name: '五線', en: 'THE FIVE LINES', unlock: 't_c7_t_score',
          body: ['休止之所的地面是五線譜：黑色的石板，表面刻著五條白線，和寫在線上的音樂。',
            '有些段落被擦掉了，只剩下灰色的指痕。歐德說，那是寂靜先到過的地方。',
            '石板底下還有一頁，再一頁——樂譜一直往下疊。沒有人知道有幾頁。'] },
        { id: 'c7_folds', name: '摺頁', en: 'THE FOLDED PAGES', unlock: 't_c7_t_ashport',
          body: ['休止之所把它記得的地方摺進了樂譜的邊緣：倒掛的灰港、懸在虛空上的鐘樓聚落、燈火通明的萊拉大歌劇院、方舟的腹部。',
            '它們都是倒著的——在這裡，城市從天空長下來。只有在那一頁翻過去的時候，它們才是正的。'] },
        { id: 'c7_longrest', name: '長休止', en: 'THE LONG REST', unlock: 't_c7_t_line',
          body: ['五線譜在這裡只剩下一條線，底下什麼都沒有。樂譜上，這叫「長休止」：整個樂團一起停下來，好幾個小節，一個音也不發。',
            '走到一半，整頁樂譜會翻過來。上面變成下面，倒掛的城市變成正的。線還在你腳下——只要你繼續走。'] },
        { id: 'c7_thread', name: '紅線', en: 'THE RED THREAD', unlock: 'c7_met_mira',
          body: ['休止之所裡唯一的紅色：一條細細的紅線，橫過整片天空，一路往上延伸。',
            '那是米菈圍巾上的鬚鬚。她把它綁在鐘樓上、綁在每一個她去過的地方——這樣才不會迷路。',
            '順著它走，就會找到她。'] },
        { id: 'c7_finalbar', name: '終止線', en: 'THE FINAL BARLINE', unlock: 't_c7_t_coda',
          body: ['一細一粗兩條直線，高得看不到頂。在樂譜上，它的意思是「全曲終」。',
            '終止線上方懸著一個巨大的延長記號——「在這裡，停久一點」。有人一直停在那裡，停了很久很久。',
            '剛進入休止之所時，天上的太陽是一個空心的全音符。走到這裡，它已經被塗滿了：一顆黑色的太陽。'] },
      ],
      items: [
        { id: 'c7_toll', name: '巴洛的鐘聲', en: "BARROW'S TOLL", unlock: 'c7_got_toll',
          body: ['從灰港大教堂倒掛的鐘樓裡掉出來的一聲鐘響，被摺成一張紙的形狀。握在手裡，是溫的。',
            '靜默之夜之後，巴洛每天傍晚六點都去敲一次那口裂掉的鐘。這是其中的一聲。'] },
        { id: 'c7_key', name: '發條鑰匙', en: 'THE WINDING KEY', unlock: 'relic_c7_key', relic: true,
          body: ['米菈音樂盒的發條鑰匙。音樂盒掉在灰港，鑰匙卻一直被她握在手心裡。', '「這樣歌就不會停了。」', '遺物效果：最大生命 +15，共鳴累積 +15%。'] },
      ],
      notes: [
        { id: 'c7_n1', name: '晨禱的第二句', en: 'THE SECOND LINE', body: [
          '（五線譜的角落，摺著一小段旋律。旁邊用四萬兩千種筆跡，寫著同一句歌詞。）',
          '「在。我們都在。」',
          '頌歌號的晨禱，第二句。那一天早上六點，所有人都張開了嘴，卻沒有唱出來。',
          '它沒有消失。它掉到了這裡，一直摺著，等人把它唱完。',
          '（最下面一行，是用蠟筆寫的，歪歪扭扭：「在。——朵朵」）'] },
        { id: 'c7_n2', name: '第七千三百零五聲', en: 'THE 7,305TH TOLL', body: [
          '（一張被雨淋濕過的樂譜。上面只有一個音，重複了很多很多次，每一個音旁邊都標著小小的數字。）',
          '1、2、3……7303、7304、7305。',
          '灰港大教堂的晚鐘。靜默之夜之後，有個人每天傍晚六點都去敲一次——即使鐘已經裂了，即使它一聲也沒有響。',
          '休止之所把每一聲都收下了。一聲都沒有漏。',
          '最後一個數字旁邊，有人用很輕的筆跡寫著：「她找得到回家的路。」'] },
        { id: 'c7_n3', name: '通風口的回答', en: 'WHAT THE VENT SANG BACK', body: [
          '（一張很舊的作業紙，頁首印著「頌歌號・第三育幼院」。上面是孩子歪歪扭扭畫的五線譜。）',
          '上半段：一個七歲的孩子對著通風口唱的歌。音準很差，可是很認真。',
          '下半段：另一種筆跡，很細、很輕，像是怕吵到誰。它接著上半段，把旋律唱了下去——一個音都沒有錯。',
          '那是瑪絲緹娜教給一個女孩的歌。',
          '紙的背面寫著：「通風口會回答。——凜音，七歲」'] },
        { id: 'c7_n4', name: '沒有吹響的撤退號', en: 'THE RETREAT NEVER SOUNDED', body: [
          '（一段軍號譜，標題是「撤退」。每一個音都被人用指甲輕輕刮過，卻沒有刮破紙。）',
          '第二降臨隊的信號手歐林，十七年來每天吹一次集合號：「我在這裡，跟著聲音走。」',
          '他從來沒有吹過撤退號。',
          '譜的邊緣寫著：「只要撤退號不響，就沒有人需要回頭。」',
          '（這一頁，是倒著寫的。）'] },
        { id: 'c7_n5', name: '沒唱完的高音', en: 'THE UNSUNG HIGH C', body: [
          '（歌劇總譜的最後一頁。女高音聲部停在一個很高很高的音上——一個沒有唱出來的高音 C。）',
          '萊拉大歌劇院，季終公演。十九歲的露塞特・德瓦爾唱到這裡的那一瞬間，大寂靜抵達了。',
          '兩千名觀眾屏住呼吸，等那個音。',
          '他們到現在都還在等。',
          '音符上方，有人用鉛筆輕輕畫了一個延長記號。旁邊寫著：「多久都可以。」'] },
        { id: 'c7_n6', name: '屏住的呼吸', en: 'A HELD BREATH', body: [
          '（一整頁，什麼都沒有寫。只有正中央，一個小小的休止符。）',
          '休止符旁邊，有一行孩子的字：',
          '「如果我不出聲，就不會再有人不見了。」',
          '「所以我要一直、一直憋著氣。」',
          '「……可是，好難過喔。」'] },
        { id: 'c7_n7', name: '最後的三秒', en: 'THE LAST THREE SECONDS', body: [
          '【第七降臨隊・隊長通訊　最後三秒　降臨伏擊】',
          '第一秒：「凜音，進艙。不要回頭。」',
          '第二秒：（上傳中……）「無人機，接住這一段。拜託了。」',
          '第三秒：「……還有，凜音，記得吃早——」',
          '（通訊中斷。休止之所把最後半句，原封不動地收著。）'] },
      ],
    },
    relics: {
      c7_key: { name: '發條鑰匙', desc: '最大生命 +15；共鳴累積 +15%（這樣歌就不會停了）' },
    },
  };
  G.Relics.c7_key = { apply(P2) { P2.maxHp += 15; P2.resMul *= 1.15; } };
  // the elite's relic belongs to the foes author; keep a fallback so the drop never breaks
  if (!G.DATA.relics.c7_oath) data.relics.c7_oath = { name: '斷弦之誓', desc: '生命高於 70% 時，劍擊傷害 +15%' };
  if (G.UI && G.UI.portraits) G.UI.portraits.c7_mira = (ctx, W, H, game) => { ctx.setTransform(3.4, 0, 0, 3.4, W / 2 - 20, H * 0.82); drawMira(ctx, 0, 0, (game && game.realTime) || 1, 1, 1, !!(game && game.save && game.save.flags.c7_quest_done), 1); };

  // lines that remember what you did in earlier chapters (rebuilt whenever the chapter is entered or Mira speaks)
  function pylonLines(F) {
    const D = G.DATA.dialog;
    D.c7_pylon1 = [
      { who: 'ode', text: '共鳴碑……在這裡也能調諧？頻段上有雜訊——不，是人聲。' },
      { who: 'talia', text: '凜音？凜音！你的訊號是從——方舟的「上面」傳來的？那裡明明什麼都沒有啊！' },
      { who: 'rinne', text: '有。這裡是一頁樂譜。' },
      { who: 'talia', text: '……好，我不問了。我遠端幫你校正了共鳴碑，還多刻了幾格刻度——你那裡好像會需要。' },
      F.c2_quest_done ? { who: 'talia', text: '還有，鐘樓聚落每天傍晚六點都在敲鐘。大家說，要一直敲到你回家為止。' } : { who: 'talia', text: '還有……小心點。你的訊號，一直在變小聲。' },
      { who: 'rinne', text: '……我聽得到。' },
    ];
    D.c7_pylon2 = [
      { who: 'ode', text: '凜音。我的核心……從剛才開始就有點熱。' },
      { who: 'ode', text: '像是這一頁的另一面，有人在叫我的名字。不是「歐德」，是另一個名字。' },
      { who: 'rinne', text: '……你想去看看嗎？' },
      { who: 'ode', text: '我是無人機。無人機不「想」。……但是如果你要去，我會跟著。' },
    ];
    D.c7_pylon3 = [
      { who: 'ode', text: '凜音，在我們過那條線之前——' },
      { who: 'ode', text: '如果前面真的是她……我不知道之後，我還會不會是我。' },
      { who: 'rinne', text: '你是歐德。會數數，會吐槽，飛得有點歪。' },
      { who: 'ode', text: '……飛得歪是因為你走路不看前面。好。數到三，我們就進去。一。二。……三。' },
    ];
  }
  function miraLines(F) {
    const D = G.DATA.dialog;
    const meet = [
      { who: 'c7_mira', text: '……啊。妳踩到我的屋頂了。' },
      { who: 'c7_mira', text: '沒關係，這裡很大。這裡是離天空最近的地方——爸爸說的。' },
      { who: 'rinne', text: '妳是……米菈？' },
      { who: 'c7_mira', text: '嗯！妳怎麼知道？妳是方舟來的嗎？跟那個黑頭髮的大姐姐一樣？' },
      { who: 'c7_mira', text: '她是我的老師，教了我一首歌。她說，只要我屏住呼吸，就不會再有任何東西不見了。' },
    ];
    D.c7_miraMeet = meet.concat([
      { who: 'c7_mira', text: '可是我在等一個聲音。每天傍晚六點，爸爸會敲鐘。聽到鐘聲，我就知道該回家了。' },
      { who: 'c7_mira', text: '這裡好安靜……聽不到鐘聲，我就不知道哪一邊是家。' },
      { who: 'c7_mira', text: '聲音會掉下來喔。在這裡，掉下來的聲音都會浮在某個地方。妳可以幫我找找看嗎？' },
    ], F.gave_musicbox ? [{ who: 'ode', text: '（凜音，她說的「爸爸」是巴洛——灰港的守鐘人。她的音樂盒，我們已經還給他了。）' }] : [],
    F.c5_got_ribbon ? [{ who: 'ode', text: '（她的圍巾末端少了一截。叮叮那條紅布條……就是從這裡撕下來的。）' }] : [],
    [{ who: 'rinne', text: '我去找。' }]);
    D.c7_miraMeetHave = meet.slice(0, 2).concat([{ who: 'c7_mira', text: '……咦？妳身上，有鐘聲的味道。' }]);
    D.c7_miraWait = [
      { who: 'c7_mira', text: '鐘聲會往上掉喔。這裡的東西，都是往上掉的。' },
      { who: 'c7_mira', text: '妳看那條紅線——是我的圍巾鬚鬚。我把它綁在鐘樓上，這樣才不會迷路。' },
    ];
    D.c7_miraDone = [
      { who: 'rinne', text: '……找到了。' },
      { who: 'c7_mira', text: '……！' },
      { who: 'sys', text: '（一聲鐘響。在沒有空氣的地方，傳得很遠、很遠。）' },
      { who: 'c7_mira', text: '是爸爸。……是爸爸的鐘。他還在敲。' },
      { who: 'c7_mira', text: '那我就還可以回家。對不對？' },
      { who: 'rinne', text: '……對。' },
      F.gave_musicbox ? { who: 'c7_mira', text: '我的音樂盒在爸爸那裡嗎？那他一定是用髮夾在上發條。笨爸爸——鑰匙在我這裡啦。' }
        : { who: 'c7_mira', text: '我的音樂盒掉在灰港了。如果妳找到它——這把鑰匙可以讓它再唱一次。' },
      { who: 'c7_mira', text: '給妳。發條鑰匙。這樣歌就不會停了。' },
      { who: 'c7_mira', text: '姐姐，妳要往上走對吧？上面很安靜喔。……如果妳在那裡遇到我，跟我說，鐘還在響。' },
    ];
    D.c7_miraAfter = [
      { who: 'c7_mira', text: '噓——妳聽。六點了。' },
      { who: 'c7_mira', text: '……我再坐一下下。等鐘敲完，我就回家。' },
    ];
  }

  /* =========================================================================================
     HOOKS — the page turning, walk-in entrances, Vega's last words and the choice after them
     ========================================================================================= */
  let CH7 = null;
  const RT = { walk: null };
  const SEQ = { q: [], wait: 0 };
  function seqRun(game, steps) { SEQ.q = steps.slice(); SEQ.wait = 0; seqNext(game); }
  function seqNext(game) {
    const s = SEQ.q.shift(); if (!s) return;
    if (s.fn) { s.fn(game); seqNext(game); }
    else if (s.wait != null) SEQ.wait = s.wait;
    else if (s.dlg) game.dialog(s.dlg, () => { game.control = false; seqNext(game); });
  }
  function hold(game) { const Pl = game.player; game.control = false; Pl.vx = 0; if (Pl.busy && Pl.state !== 'rest' && Pl.state !== 'dead') Pl.setState('move'); }
  function release(game) { game.focus = null; game.control = true; G.Input.clearBuffers(); }
  function finish(game, listened) {
    if (CH7) CH7.outro = listened ? '「別回頭。」——往前走。' : '「……往——」';
    game.focus = null;
    game.completeChapter();
  }
  function epilogue(game, listened) {
    const F = game.save.flags;
    F.c7_listened = !!listened; game.persist();
    EPI.t = 0;
    game.focus = { x: EPI.x - 140, y: -190, zoom: 1.08 };
    if (listened) {
      EPI.mode = 'listen';
      G.Music.play('c7_farewell'); G.SFX.play('c7_memory');
      seqRun(game, [
        { wait: 1.4 },
        { dlg: 'c7_listen' },
        { fn: () => G.SFX.play('c7_memory') },
        { wait: 2.4 },
        { fn: (gm) => finish(gm, true) },
      ]);
    } else {
      EPI.mode = 'sever';
      G.Music.play(null); G.SFX.play('c7_sever'); game.shake(0.35); game.hitstop(0.12);
      seqRun(game, [
        { wait: 0.9 },
        { dlg: 'c7_sever' },
        { wait: 1.2 },
        { fn: (gm) => finish(gm, false) },
      ]);
    }
  }
  // foes from earlier chapters appear here as the Rest remembers them: in ink. A 'luminosity' composite keeps their
  // shading and takes the colour of the page behind them (monochrome); their own glows stay additive.
  function inkMemory(type) {
    const T = G.ENEMY_TYPES && G.ENEMY_TYPES[type]; if (!T || T._c7ink) return;
    const draw = T.draw; T._c7ink = true;
    T.draw = function (ctx, e, ghost) {
      // luminosity blending repaints every stroke through a frame copy on laptop GPUs: only on 高
      if (ghost || L.chapter !== 7 || !G.Quality.full) return draw.call(this, ctx, e, ghost);
      ctx.save(); ctx.globalCompositeOperation = 'luminosity';
      try { return draw.call(this, ctx, e, ghost); } finally { ctx.restore(); }
    };
  }
  const hooks = {
    enter(game) {
      const F = game.save.flags;
      inkMemory('sentinel'); inkMemory('c4_marionette');
      F.c7_arrived = true;
      FLP.k = 0; FLP.vis = 0; FLP.want = null; EPI.mode = null; EPI.t = 0; RT.walk = null; SEQ.q = []; SEQ.wait = 0;
      pylonLines(F); miraLines(F);
      return false;
    },
    update(game, dt) {
      const Pl = game.player, F = game.save.flags;
      F.c7_arrived = true;
      if (SEQ.wait > 0) { SEQ.wait -= dt; if (SEQ.wait <= 0) { SEQ.wait = 0; seqNext(game); } }
      // the page turns over while you walk the middle of the Long Rest (and turns back if you walk out of it)
      const want = Pl.x > FLIP.x0 && Pl.x < FLIP.x1 && Pl.y > -400 && Pl.y < 200 ? 1 : 0;
      if (want !== FLP.want) { if (FLP.want != null) G.SFX.play('c7_flip'); FLP.want = want; }
      FLP.k = U.approach(FLP.k, want, dt / 2.2);
      FLP.vis = DEVQ && DEVQ.get('c7flip') ? +DEVQ.get('c7flip') : FLP.k;
      // while the page is upside down, world-space text is drawn pre-flipped so the mirrored frame shows it upright
      G.textFlip = Math.cos(U.easeInOutSine(Math.min(1, FLP.vis)) * PI) < 0 ? -1 : 1;
      // while the page is over, frame the line a little lower so the upturned city has the screen (and the HUD clears it)
      if (FLP.vis > 0.001 && !RT.walk) {
        const lift = 150 * (game.viewH || 640) / 640, e = U.easeInOutSine(Math.min(1, FLP.vis));
        game.focus = { x: Pl.x + Pl.facing * 70 + Pl.vx * 0.18, y: Pl.y - lift + 0.45 * lift * e, zoom: 1, c7: true };
        FLP.cam = true;
      } else if (FLP.cam) { FLP.cam = false; if (game.focus && game.focus.c7) game.focus = null; }
      if (EPI.mode) EPI.t += dt;
      // the haze between the layers follows the camera: paper by day, ink by night, near-black over the abyss
      { const cx = game.cam.x, fc = mixH(mixH('#d6cec0', '#1c1822', nightAt(cx)), '#0c0a10', voidAt(cx) * 0.9); G.PAL.fog = [fc, fc]; }
      // cinematic walk-in for the elite / boss stages (keeps the contract trigger at x0 - 200 without a snap)
      if (RT.walk) {
        const w = RT.walk;
        if (Pl.state !== 'cine') Pl.setState('cine');
        Pl.cineX = w.tx; Pl.cineRun = false; Pl.cineFace = 1;
        if (Math.abs(Pl.x - w.tx) < 8 || (w.t += dt) > 3) {
          RT.walk = null; Pl.setState('move');
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
    },
    trigger(game, tr) {
      const F = game.save.flags;
      if (tr.kind === 'c7_bark') { game.bark(tr.bark); return true; }
      if (tr.kind === 'c7_bell') { G.SFX.play('c7_greatBell'); game.bark(F.c2_quest_done ? 'c7_bellRing' : 'c7_bellMute'); return true; }
      if (tr.kind === 'c7_flip') {
        if (F.c7_flipped) return true;
        F.c7_flipped = true;
        hold(game);
        seqRun(game, [{ wait: 2.8 }, { dlg: 'c7_flip' }, { fn: (gm) => release(gm) }]);
        return true;
      }
      if (tr.kind === 'c7_unflip') { setTimeout(() => game.bark('c7_unflip'), 2400); return true; }
      if (tr.id !== 'c7_t_elite' && tr.id !== 'c7_t_boss') return false;
      const E = L.encounters[tr.startEnc];
      game.control = false;
      RT.walk = { tr, tx: E.arena[0] + 90, t: 0 };
      return true;
    },
    encounterStart(game, id) {
      // a retry after death starts the fight straight from the trigger: cut into the arena instead of snapping
      const E = L.encounters[id], Pl = game.player;
      if (E && E.arena && (E.boss || E.elite) && Pl.x < E.arena[0] + 20) { Pl.x = E.arena[0] + 90; Pl.vx = 0; game.cam.x = Pl.x + 200; game.fadeA = 1; }
    },
    bossDefeated(game, e) {
      hold(game);
      EPI.x = e ? e.x : ARENA.boss[0] + 950;
      game.dialog('c7_bossDefeat', () => {
        hold(game);
        if (DEVQ && DEVQ.get('c7choose')) { epilogue(game, DEVQ.get('c7choose') !== 'sever'); return; }   // dev aid: run a branch headless
        G.UI.choice({
          kicker: '薇格的殘響　THE ECHO OF ELAINE VEGA',
          title: '讓她把話說完嗎？',
          desc: '她的聲音正在散開。聽她說完，殘響會在這裡用盡最後的時間；斬斷它，休止就再也不能把她寫成別的樣子。',
          items: [
            { label: '聽她說完', en: 'LET HER FINISH', action: () => epilogue(game, true) },
            { label: '斬斷殘響', en: 'SEVER THE ECHO', action: () => epilogue(game, false) },
          ],
        });
      });
      return true;
    },
    drawSky, drawAtmos, drawForeground, drawBack, drawFront, afterLayer,
  };

  /* =========================================================================================
     REGISTER
     ========================================================================================= */
  CH7 = G.Chapters.register({
    id: 7, key: 'ch7', num: 'VII', numZh: '七', title: '休止之所', en: 'THE REST',
    intro: [
      { t: '方舟之上，星星之間，\n有一頁沒有寫完的樂譜。', s: 'ABOVE THE ARK, BETWEEN THE STARS — A PAGE NO ONE FINISHED.' },
      { t: '所有被寂靜吞掉的聲音，\n都落在這裡。', s: 'EVERY SOUND THE HUSH EVER SWALLOWED FELL HERE.' },
    ],
    enterDialog: 'c7_enter',
    outro: '「別回頭。」——往前走。',
    level, pal,
    sky: { sun: false, shafts: false, clouds: false, ark: false, rays: 0 },
    bg: {
      far: genFar, mid: genMid, near: genNear, props: genProps,
      params: { far: { f: FAR_F, fy: 0.03, baseY: 60, res: 0.55 }, mid: { f: MID_F, fy: 0.1, baseY: 80, res: 0.7 }, near: { f: NEAR_F, fy: 0.25, baseY: 110, res: 0.85 } },
    },
    solidPainters: { c7staff: paintStaff, c7line: paintLine, c7roof: paintRoof, c7dais: paintDais, c7stage: paintStage, c7coda: paintCoda, c7none: noPaint },
    onewayPainter: paintOneway,
    music: { explore: 'c7_explore', boss: 'c7_boss', boss2: 'c7_boss2', elite: 'c7_elite', rest: 'rest' },
    tracks, chords,
    musicAt(x, y) { const z = L.zoneAt(x); return (z && z.music) || 'c7_explore'; },
    ambienceAt(x, y) { const z = L.zoneAt(x); return (z && z.amb) || 'c7_paper'; },
    ambience, sfx, data,
    upgradeBoost: { vit: [560], edge: [560], still: [400] },
    hooks,
    next: 8,
  });
  pylonLines({}); miraLines({});
  inkMemory('sentinel'); inkMemory('c4_marionette');
})(window.G);

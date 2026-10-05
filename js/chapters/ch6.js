'use strict';
/* ECHOFALL — Chapter VI 沉默方舟 THE SILENT ARK (world author: level, look, music, story).
   Inside the Cantata (頌歌號): the homecoming concourse, the white corridors of the habitat ring, the glass atrium where
   42,000 citizens stopped mid-hymn, the lantern ward of the first sleepers, and the white-glass Core where CANTOR holds
   the second line of the morning hymn so it never ends. Foes live in ch6_foes.js, CANTOR in ch6_boss.js (by id).
   See docs/CHAPTER_API.md and docs/STORY.md (§0–2, chapter VI). */
(function (G) {
  const WK = G.WorldKit, U = G.U, Rig = G.Rig, PI = Math.PI, TAU = PI * 2;
  const L = G.LEVEL, INK = '#0b0612';
  const rgba = U.rgba, mixH = U.mixHex, clamp = U.clamp, lerp = U.lerp;
  const P = (k, t) => WK.P(k, clamp(t, 0, 1));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const DEVQ = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const DEVZ = DEVQ ? (+DEVQ.get('c6zoom') || 0) : 0;   // dev aid: ?c6zoom=1.8 (&c6dx, &c6dy) frames the player close

  /* =========================================================================================
     LEVEL GEOMETRY
     ========================================================================================= */
  const SPAN = [-400, 13600];
  const ZX = [-1e9, 2400, 5200, 8300, 10800];                 // concourse · corridors · atrium · ward · core
  const zoneOf = (x) => (x < ZX[1] ? 0 : x < ZX[2] ? 1 : x < ZX[3] ? 2 : x < ZX[4] ? 3 : 4);
  const ARENA = { e3: [3700, 4550], elite: [9650, 10650], e7: [10900, 11550], boss: [12150, 13550] };
  const BAL = { x0: 5250, x1: 5750, y: -130 };                  // the atrium balcony (the vista)
  const FOUNT = { x: 6880, w: 200, h: 44 };                     // fountain basin (a low step)
  const DOME_Y = -1040;                                         // the dome maintenance ring (secret)
  const IRIS = { x: 12850, y: -700, r: 180 };                   // the Core's observation iris (the reveal)
  const CLOCK = { x: 6640, y: -780 };

  // palette blend: white concourse (0) → crimson Core (≈0.69). Kept under 0.7 on purpose: the Core is white glass, not velvet
  const tintAt = (x) => {
    if (x < 2400) return 0;
    if (x < 5200) return 0.12 * (x - 2400) / 2800;
    if (x < 8300) return 0.12 + 0.2 * (x - 5200) / 3100;
    if (x < 10800) return 0.32 + 0.2 * (x - 8300) / 2500;
    return 0.52 + 0.17 * sstep(10800, 12400, x);
  };
  const hallAt = (x) => 1 - sstep(2100, 2700, x);
  const domeAt = (x) => sstep(5000, 5500, x) * (1 - sstep(8050, 8450, x));
  const wardAt = (x) => sstep(8150, 8550, x) * (1 - sstep(10550, 10950, x));
  const coreAt = (x) => sstep(10500, 11400, x);

  const level = {
    start: { x: 150, y: 0 }, bounds: SPAN.slice(), gravity: 1,
    solids: [
      { x: -820, y: -2600, w: 440, h: 2700, kind: 'wall' },
      { x: -820, y: 0, w: BAL.x0 + 820, h: 700, kind: 'c6floor' },
      { x: BAL.x0, y: BAL.y, w: BAL.x1 - BAL.x0, h: 700 - BAL.y, kind: 'c6balcony' },
      { x: BAL.x1, y: 0, w: 14000 - BAL.x1, h: 700, kind: 'c6floor' },
      { x: FOUNT.x, y: -FOUNT.h, w: FOUNT.w, h: FOUNT.h, kind: 'c6basin' },
      { x: 13600, y: -2600, w: 400, h: 2700, kind: 'wall' },
    ],
    oneways: [
      // corridors: the maintenance gantry under the window band (upper route over the first tuner)
      { x: 2830, y: -165, w: 160, k: 'gantry' }, { x: 3000, y: -300, w: 600, k: 'gantry' },
      // atrium: pergola walks through the tree canopy
      { x: 6040, y: -205, w: 180, k: 'pergola' }, { x: 6320, y: -330, w: 220, k: 'pergola' }, { x: 6640, y: -205, w: 170, k: 'pergola' },
      // atrium: the trellis climb to the dome ring (secret route)
      { x: 7620, y: -190, w: 150, k: 'trellis' }, { x: 7850, y: -360, w: 150, k: 'trellis' }, { x: 7620, y: -530, w: 160, k: 'trellis' },
      { x: 7870, y: -700, w: 150, k: 'trellis' }, { x: 7640, y: -870, w: 170, k: 'trellis' }, { x: 7880, y: DOME_Y, w: 440, k: 'ring' },
      // core: choir lofts in the nave
      { x: 11000, y: -250, w: 190, k: 'loft' }, { x: 11300, y: -250, w: 190, k: 'loft' },
    ],
    pylons: [
      { id: 'c6_p1', x: 2150, y: 0, name: '歸港大廳共鳴碑', dialog: 'c6_pylon1', flag: 'c6_pylon1_seen' },
      { id: 'c6_p2', x: 8380, y: 0, name: '守夜廊共鳴碑', dialog: 'c6_pylon2', flag: 'c6_pylon2_seen' },
      { id: 'c6_p3', x: 11720, y: 0, name: '頌者之心共鳴碑', dialog: 'c6_pylon3', flag: 'c6_pylon3_seen' },
    ],
    notes: [
      { id: 'c6_n1', x: 640, y: 0, flag: 'c6_read_log1' },
      { id: 'c6_n2', x: 3610, y: 0 },
      { id: 'c6_n3', x: 4862, y: 0, flag: 'c6_read_vega' },
      { id: 'c6_n4', x: 8010, y: DOME_Y, flag: 'c6_read_dome' },
      { id: 'c6_n5', x: 9420, y: 0, flag: 'c6_read_rook' },
      { id: 'c6_n6', x: 11600, y: 0, flag: 'c6_read_log2' },
    ],
    items: [
      { id: 'c6_sketch', x: 8250, y: DOME_Y, flag: 'c6_got_sketch', name: '朵朵的素描本', kind: 'key', sfx: 'pickup',
        onTake(game) { game.bark(game.save.flags.c6_met_duoduo ? 'c6_sketchMet' : 'c6_sketch'); } },
    ],
    npcs: [],   // filled below (Duoduo needs her painter)
    triggers: [
      { id: 'c6_t_sleepers', x: 740, kind: 'dialog', dialog: 'c6_sleepers', after: 'c6_quiet' },
      { id: 'c6_t_corridor', x: 2420, kind: 'dialog', dialog: 'c6_corridor' },
      { id: 'c6_t_orphan', x: 2540, kind: 'c6_bark', bark: 'c6_orphan' },
      { id: 'c6_t_tuner', x: 2770, kind: 'dialog', dialog: 'c6_tuner' },
      { id: 'c6_t_bakery', x: 3080, kind: 'c6_bark', bark: 'c6_bakery' },
      { id: 'c6_t_vega', x: 4640, kind: 'dialog', dialog: 'c6_vega' },
      { id: 'c6_t_vista', x: 5330, kind: 'c6_vista' },
      { id: 'c6_t_seraph', x: 5800, kind: 'dialog', dialog: 'c6_seraph' },
      { id: 'c6_t_clock', x: 6520, kind: 'c6_bark', bark: 'c6_clock' },
      { id: 'c6_t_secret', x: 7540, kind: 'hint', hint: 'c6_secret' },
      { id: 'c6_t_dome', x: 7860, kind: 'dialog', dialog: 'c6_dome', yMax: -980 },
      { id: 'c6_t_ward', x: 8470, kind: 'dialog', dialog: 'c6_ward' },
      { id: 'c6_t_elite', x: ARENA.elite[0] - 200, kind: 'dialog', dialog: 'c6_eliteIntro', enc: 'c6_elite', startEnc: 'c6_elite', flag: 'c6_elite_seen',
        focus: { x: ARENA.elite[0] + 600, y: -170, zoom: 0.95 } },
      { id: 'c6_t_core', x: 10760, kind: 'dialog', dialog: 'c6_core' },
      { id: 'c6_t_boss', x: ARENA.boss[0] - 200, kind: 'dialog', dialog: 'c6_bossIntro', enc: 'c6_boss', startEnc: 'c6_boss', flag: 'c6_boss_seen',
        focus: { x: ARENA.boss[0] + 800, y: -170, zoom: 0.95 }, music: 'c6_boss' },
    ],
    encounters: {
      // the customs queue: one Warden among sleepers (fight it away from them)
      c6_e1: { trigger: 950, respawn: true, waves: [
        [{ t: 'c6_warden', x: 1400 }, { t: 'c6_hushed', x: 1150 }, { t: 'c6_hushed', x: 1560 }],
        [{ t: 'c6_warden', x: 1260 }]] },
      // the first Tuning Engine on its ceiling rail (the gantry above reaches it)
      c6_e2: { trigger: 2800, respawn: true, waves: [[{ t: 'c6_tuner', x: 3250, y: -290 }, { t: 'c6_warden', x: 3430 }]] },
      // the residential junction locks down — sleepers inside the walls
      c6_e3: { trigger: 3800, arena: ARENA.e3, waves: [
        [{ t: 'c6_warden', x: 4060 }, { t: 'c6_warden', x: 4420 }, { t: 'c6_hushed', x: 3880 }, { t: 'c6_hushed', x: 4240 }],
        [{ t: 'c5_breacher', x: 4300 }, { t: 'c6_tuner', x: 3960, y: -300 }]] },
      // the clock angels leave their alcoves
      c6_e4: { trigger: 5850, respawn: true, waves: [
        [{ t: 'c6_seraph', x: 6250, y: -260 }, { t: 'c6_seraph', x: 6480, y: -320 }],
        [{ t: 'c6_warden', x: 6350 }, { t: 'c6_seraph', x: 6620, y: -280 }]] },
      // under the trellis
      c6_e5: { trigger: 7560, respawn: true, waves: [
        [{ t: 'c6_warden', x: 7950 }, { t: 'c6_seraph', x: 8120, y: -280 }, { t: 'c6_hushed', x: 7720 }],
        [{ t: 'c6_tuner', x: 8000, y: -300 }, { t: 'c6_warden', x: 8180 }]] },
      // the lantern ward
      c6_e6: { trigger: 8700, respawn: true, waves: [
        [{ t: 'c6_tuner', x: 9150, y: -300 }, { t: 'c6_warden', x: 9260 }, { t: 'c6_hushed', x: 9000 }, { t: 'c6_hushed', x: 9330 }],
        [{ t: 'c5_driftwatch', x: 9200, y: -300 }, { t: 'c6_seraph', x: 9050, y: -260 }]] },
      c6_elite: { manual: true, elite: true, arena: ARENA.elite, waves: [[{ t: 'c6_elite', x: ARENA.elite[0] + 700 }]] },
      // the nave seals behind you
      c6_e7: { trigger: 10980, arena: ARENA.e7, waves: [
        [{ t: 'c6_warden', x: 11200 }, { t: 'c6_warden', x: 11460 }, { t: 'c6_seraph', x: 11330, y: -300 }],
        [{ t: 'c6_tuner', x: 11060, y: -300 }, { t: 'c6_tuner', x: 11420, y: -300 }, { t: 'c5_breacher', x: 11250 }]] },
      c6_boss: { manual: true, boss: true, arena: ARENA.boss, waves: [[{ t: 'c6_boss', x: ARENA.boss[0] + 950 }]] },
    },
    zones: [
      { x: -1e9, name: '歸港大廳', en: 'THE HOMECOMING CONCOURSE', tint: 0, music: 'c6_explore', amb: 'c6_concourse' },
      { x: 2400, name: '白色迴廊', en: 'THE WHITE CORRIDORS', tint: 0.05, music: 'c6_explore', amb: 'c6_corridor' },
      { x: 5200, name: '晨禱中庭', en: 'THE ATRIUM OF THE MORNING HYMN', tint: 0.2, music: 'c6_explore2', amb: 'c6_atrium' },
      { x: 8300, name: '守夜廊', en: 'THE LANTERN WARD', tint: 0.4, music: 'c6_ward', amb: 'c6_ward' },
      { x: 10800, name: '頌者之心', en: 'THE HEART OF CANTOR', tint: 0.6, music: 'c6_core', amb: 'c6_core' },
    ],
    tintAt,
  };
  // a boss that hovers declares its own spawn height (contract: floor y = 0 unless the type says otherwise)
  { const BT = G.ENEMY_TYPES && G.ENEMY_TYPES.c6_boss; if (BT && BT.fly && BT.spawnY != null) level.encounters.c6_boss.waves[0][0].y = BT.spawnY; }

  /* =========================================================================================
     PALETTE + MATERIALS  (tint 0 = white enamel under cyan light · tint 1 = the Core's crimson)
     ========================================================================================= */
  const pal = {
    skyTop: ['#03050c', '#07030a'], skyMid: ['#0a1124', '#160818'], skyLow: ['#16264a', '#30102a'], horizon: ['#8fe4ff', '#ff6f8e'],
    far: ['#4a5f8c', '#5a3a62'], mid: ['#3d4f7a', '#4a2c52'], midDark: ['#1c2646', '#230f2a'],
    near: ['#28345a', '#2c1834'], nearDark: ['#141b36', '#170a1c'], rim: ['#c4f6ff', '#ffc2d2'],
    ground: ['#d3dce9', '#ddd2dc'], groundDark: ['#262d4c', '#2a1430'], groundTop: ['#ffffff', '#fff3f6'],
    fog: ['#59739f', '#6e2f58'],
  };
  const M = {
    en: '#e9eff6', enL: '#ffffff', enB: '#c3cede', enS: '#8592b3', enD: '#4f5878', enDD: '#2a3050',
    st: '#323a5c', stL: '#62709c', stD: '#1a1f3a', stDD: '#0d1022',
    cyan: '#7ff6ff', cyanD: '#2fb8d0', crim: '#ff2a55', crimL: '#ff8fa8', crimD: '#a3123c', crimDD: '#3d0619',
    gold: '#e3b25a', goldL: '#ffe2a0', goldD: '#8a6328', brass: '#c99a48',
    leaf: '#4f9a6a', leafL: '#9bd67e', leafD: '#24533f', leafDD: '#132c26', bark: '#6b4a3a', soil: '#2d1f24',
    sun: '#ffe7b0', amber: '#ffbe6b', teal: '#7dffcf', glass: '#a8e6ff',
    porc: '#e2eaf5', porcSkin: '#e8eef6', porcS: '#a9b8d0',
  };
  // enamel shades for a world x (warmer in the corridors, bluer in the ward, glassier in the Core)
  function enamelC(x) {
    const w = wardAt(x), c = coreAt(x), d = domeAt(x);
    let body = '#c3cede', lit = '#f2f6fb', dark = '#8592b3', deep = '#4f5878';
    if (d > 0) { body = mixH(body, '#d6d9cf', d * 0.4); lit = mixH(lit, '#fff8e4', d * 0.5); dark = mixH(dark, '#7f8f8a', d * 0.3); }
    if (w > 0) { body = mixH(body, '#58648e', w * 0.92); lit = mixH(lit, '#9eacd4', w * 0.85); dark = mixH(dark, '#303a60', w * 0.92); deep = mixH(deep, '#1a2040', w * 0.9); }
    if (c > 0) { body = mixH(body, '#dcdde8', c * 0.5); lit = mixH(lit, '#ffffff', c); dark = mixH(dark, '#7d7a9e', c * 0.55); deep = mixH(deep, '#3a2f50', c * 0.6); }
    return { body, lit, dark, deep };
  }

  /* =========================================================================================
     PAINTER KIT
     ========================================================================================= */
  const ink = (g, w = 2, col = INK) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
  const poly = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
  const rect = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  function glow(g, x, y, r, col, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const lit = (g, cx, cy, w, hex) => { const Ld = Rig.lightDir(g); return Rig.celGrad(g, cx, cy, Ld.x, Ld.y, w, 1, Rig.ramp(hex)); };
  // smooth closed curve through the midpoints of a polygon
  function blob(g, a) {
    const n = a.length; g.beginPath(); g.moveTo((a[n - 1][0] + a[0][0]) / 2, (a[n - 1][1] + a[0][1]) / 2);
    for (let i = 0; i < n; i++) { const p = a[i], q = a[(i + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    g.closePath();
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
  function stencil(g, txt, x, y, size, col, o = {}) {
    g.save(); g.font = `${o.weight || 900} ${size}px ${o.font || '"Noto Sans TC", sans-serif'}`; g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
    if (o.ink !== false) { g.lineWidth = Math.max(2, size * 0.16); g.strokeStyle = o.inkCol || INK; g.lineJoin = 'round'; g.strokeText(txt, x, y); }
    g.fillStyle = col; g.fillText(txt, x, y); g.restore();
  }
  const EN_FONT = 'Rajdhani, sans-serif';
  // inked rectangle with cel faces: lit top strip, shadow bottom / left strip
  function block(g, x, y, w, h, C, o = {}) {
    rect(g, x - 1.5, y - 1.5, w + 3, h + 3, o.ink || INK);
    rect(g, x, y, w, h, C.body);
    const t = o.top ?? Math.min(4, h * 0.2);
    rect(g, x, y, w, t, C.lit);
    rect(g, x, y + h - Math.min(5, h * 0.25), w, Math.min(5, h * 0.25), C.dark);
    if (o.side !== false) rect(g, x, y, Math.min(5, w * 0.22), h, C.dark);
  }
  // a glowing strip light (cached, so the glow can be generous)
  function strip(g, x, y, w, h, col, a = 0.5, r = 26) {
    if (h > w) {
      const gr = g.createLinearGradient(x - r, 0, x + w + r, 0);
      gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.5, rgba(col, a * 0.5)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(x - r, y - r * 0.5, w + r * 2, h + r);
    } else {
      const gr = g.createLinearGradient(0, y - r, 0, y + h + r);
      gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.5, rgba(col, a * 0.5)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(x - r * 0.5, y - r, w + r, h + r * 2);
    }
    rect(g, x, y, w, h, mixH(col, '#ffffff', 0.55));
  }
  // pointed (lancet) arch path
  function lancet(g, x, yTop, w, ySill) {
    const r = w * 0.62, yc = yTop + r * 0.8;
    g.moveTo(x, ySill); g.lineTo(x, yc);
    g.arcTo(x, yTop + r * 0.15, x + w / 2, yTop, r);
    g.lineTo(x + w / 2, yTop);
    g.arcTo(x + w, yTop + r * 0.15, x + w, yc, r);
    g.lineTo(x + w, ySill); g.closePath();
  }

  /* ---------- the Hush: crimson crystal shards, clusters, veins ---------- */
  function shard(g, x, y, ang, len, wd, inkW = 1.1) {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    const tip = [x + dx * len, y + dy * len], l = [x + nx * wd, y + ny * wd], r = [x - nx * wd, y - ny * wd];
    poly(g, [l, tip, r]); g.fillStyle = M.crimD; g.fill(); ink(g, inkW);
    poly(g, [[x + dx * len * 0.08, y + dy * len * 0.08], tip, l]); g.fillStyle = M.crim; g.fill();
    g.strokeStyle = 'rgba(255,214,224,0.9)'; g.lineWidth = Math.max(0.6, wd * 0.22);
    g.beginPath(); g.moveTo(x + nx * wd * 0.45 + dx * len * 0.22, y + ny * wd * 0.45 + dy * len * 0.22); g.lineTo(tip[0] - dx * len * 0.12, tip[1] - dy * len * 0.12); g.stroke();
  }
  function cluster(g, x, y, s, ang, rng, glowA = 0.35) {
    if (glowA > 0) glow(g, x + Math.cos(ang) * 12 * s, y + Math.sin(ang) * 12 * s, 40 * s, M.crim, glowA);
    const n = 3 + Math.floor(rng() * 3), mid = Math.floor(n / 2);
    for (let i = 0; i < n; i++) {
      const a = ang + (n > 1 ? (i / (n - 1) - 0.5) : 0) * 1.25 + (rng() - 0.5) * 0.3;
      const l = (14 + rng() * 20) * s * (i === mid ? 1.45 : 1);
      shard(g, x + (rng() - 0.5) * 8 * s, y + (rng() - 0.5) * 3 * s, a, l, (3 + rng() * 2.4) * s, Math.max(0.8, 1.1 * Math.min(1, s)));
    }
  }
  function vein(g, rng, x, y, len, ang, w, depth = 0) {
    const pts = [[x, y]]; let a = ang, px = x, py = y;
    const n = Math.max(3, Math.round(len / 16));
    for (let i = 0; i < n; i++) { a += (rng() - 0.5) * 0.75; px += Math.cos(a) * len / n; py += Math.sin(a) * len / n; pts.push([px, py]); }
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    path(); g.strokeStyle = rgba(M.crimDD, 0.85); g.lineWidth = w + 2.6; g.stroke();
    path(); g.strokeStyle = M.crimD; g.lineWidth = w; g.stroke();
    path(); g.strokeStyle = rgba(M.crimL, 0.85); g.lineWidth = Math.max(0.5, w * 0.32); g.stroke();
    const endA = a;
    if (depth < 2) for (let i = 2; i < pts.length - 1; i += 2) if (rng() < 0.45) vein(g, rng, pts[i][0], pts[i][1], len * 0.45, endA + (rng() < 0.5 ? -1 : 1) * (0.6 + rng() * 0.6), w * 0.62, depth + 1);
    if (depth === 0 || rng() < 0.4) { const q = pts[pts.length - 1]; shard(g, q[0], q[1], endA, 5 + w * 3.2, 1.6 + w * 0.8, 0.9); }
  }

  /* =========================================================================================
     FIGURES — the 42,000: porcelain statues (gameplay plane) and inked silhouettes (parallax)
     ========================================================================================= */
  const POSE = {
    walk: { ry: 2, torso: 0.08, head: 0.04, tF: 0.42, kF: -0.22, tB: -0.38, kB: -0.5, aF: -0.42, eF: 0.38, aB: 0.48, eB: 0.5 },
    stride: { ry: 4, torso: 0.16, head: 0.02, tF: 0.55, kF: -0.12, tB: -0.5, kB: -0.62, aF: -0.62, eF: 0.32, aB: 0.62, eB: 0.4 },
    stand: { ry: 0, torso: 0.02, head: 0.02, tF: 0.07, kF: -0.04, tB: -0.07, kB: -0.04, aF: 0.12, eF: 0.12, aB: -0.08, eB: 0.18 },
    sing: { ry: 0, torso: -0.05, head: -0.32, tF: 0.08, kF: -0.04, tB: -0.08, kB: -0.04, aF: 0.95, eF: 1.45, aB: 0.8, eB: 1.55 },
    wave: { ry: 0, torso: -0.04, head: -0.12, tF: 0.1, kF: -0.04, tB: -0.1, kB: -0.06, aF: 2.7, eF: 0.45, aB: 0.15, eB: 0.25 },
    reach: { ry: 3, torso: 0.32, head: 0.08, tF: 0.38, kF: -0.2, tB: -0.36, kB: -0.32, aF: 1.5, eF: 0.08, aB: 0.25, eB: 0.5 },
    carry: { ry: 1, torso: -0.08, head: 0.06, tF: 0.3, kF: -0.18, tB: -0.3, kB: -0.4, aF: 0.62, eF: 1.25, aB: 0.55, eB: 1.25 },
    run: { ry: 7, torso: 0.32, head: -0.08, tF: 0.95, kF: -0.65, tB: -0.6, kB: -1.25, aF: -0.95, eF: 1.0, aB: 1.05, eB: 0.85 },
    kneel: { ry: 30, torso: 0.42, head: 0.28, tF: 1.5, kF: -1.5, tB: 0.0, kB: -1.57, aF: 1.05, eF: 0.45, aB: 0.65, eB: 0.75 },
    sit: { ry: 17, torso: -0.04, head: 0.12, tF: 1.52, kF: -1.52, tB: 1.45, kB: -1.48, aF: 0.6, eF: 1.0, aB: 0.45, eB: 1.1 },
    lookup: { ry: 0, torso: -0.12, head: -0.6, tF: 0.1, kF: -0.02, tB: -0.1, kB: -0.04, aF: 2.25, eF: 1.95, aB: 0.08, eB: 0.2 },
    conduct: { ry: 0, torso: -0.08, head: -0.2, tF: 0.15, kF: -0.05, tB: -0.15, kB: -0.05, aF: 2.45, eF: 0.55, aB: 2.0, eB: 0.85 },
    cane: { ry: 6, torso: 0.38, head: -0.12, tF: 0.2, kF: -0.18, tB: -0.25, kB: -0.3, aF: 0.55, eF: 0.25, aB: 0.2, eB: 0.4 },
    hold: { ry: 1, torso: 0.04, head: 0.18, tF: 0.25, kF: -0.12, tB: -0.25, kB: -0.3, aF: 0.35, eF: 0.15, aB: -0.5, eB: 0.15 },
    hug: { ry: 1, torso: 0.2, head: 0.28, tF: 0.15, kF: -0.08, tB: -0.2, kB: -0.15, aF: 1.25, eF: 1.55, aB: 1.15, eB: 1.65 },
    violin: { ry: 0, torso: -0.04, head: 0.35, tF: 0.1, kF: -0.04, tB: -0.1, kB: -0.04, aF: 1.15, eF: 1.9, aB: 1.7, eB: 1.25 },
    // awake variants for the waking congregation
    wakeA: { ry: 1, torso: 0.0, head: -0.05, tF: 0.1, kF: -0.06, tB: -0.1, kB: -0.06, aF: 0.35, eF: 1.7, aB: 0.2, eB: 0.6 },
    wakeB: { ry: 0, torso: -0.06, head: -0.25, tF: 0.12, kF: -0.04, tB: -0.12, kB: -0.04, aF: 2.6, eF: 0.4, aB: 0.3, eB: 0.4 },
  };
  const COMPUTED = {};
  const jointsOf = (k) => COMPUTED[k] || (COMPUTED[k] = Rig.compute(Rig.full(POSE[k] || POSE.stand)));
  const CLOTH = ['#6f86a8', '#8a6f8f', '#7d8f6a', '#a3826a', '#5f6f86', '#9a5f66', '#c2a46a', '#5a7f80', '#7a6aa0', '#b07a5a'];

  // anchor plate under each held citizen (cyan, intact) — or shattered (crimson) where the Hushed can wake
  function plate(g, x, y, r, broken, rng) {
    const ry = r * 0.24;
    if (!broken) {
      g.beginPath(); g.ellipse(x, y, r, ry, 0, 0, TAU); g.fillStyle = 'rgba(127,246,255,0.13)'; g.fill();
      g.strokeStyle = 'rgba(127,246,255,0.8)'; g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.ellipse(x, y, r * 0.68, ry * 0.68, 0, 0, TAU); g.strokeStyle = 'rgba(210,252,255,0.45)'; g.lineWidth = 0.8; g.stroke();
      g.fillStyle = 'rgba(230,255,255,0.9)'; for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; g.fillRect(x + Math.cos(a) * r - 1, y + Math.sin(a) * ry - 0.6, 2, 1.2); }
    } else {
      glow(g, x, y - 2, r * 0.9, M.crim, 0.2);
      for (let k = 0; k < 6; k++) {
        const a0 = (k / 6) * TAU + rng() * 0.3, a1 = a0 + 0.45 + rng() * 0.35;
        g.beginPath(); g.ellipse(x, y + (rng() - 0.5) * 2, r * (0.92 + rng() * 0.14), ry, 0, a0, a1);
        g.strokeStyle = k % 2 ? 'rgba(127,246,255,0.4)' : 'rgba(255,62,104,0.9)'; g.lineWidth = 1.5; g.stroke();
      }
      g.strokeStyle = 'rgba(255,42,85,0.85)'; g.lineWidth = 1; g.beginPath();
      for (let k = 0; k < 5; k++) { const a = rng() * TAU; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * ry * 0.95); }
      g.stroke();
      shard(g, x - r * 0.7, y, -PI / 2 - 0.5, 9, 2.2, 0.8); shard(g, x + r * 0.6, y, -PI / 2 + 0.4, 7, 1.8, 0.8);
    }
  }
  // a frozen citizen: Rig skeleton + porcelain cel paint, frost rime on the lit edges, closed eyes, the Hush at the feet
  function statue(g, x, y, s, face, poseKey, look = {}, o = {}) {
    const awake = !!o.awake, k = awake ? 0 : 0.56, J = jointsOf(poseKey), child = !!look.child;
    const pc = (hex, e = 0) => mixH(hex, M.porc, clamp(k + e, 0, 1));
    const cloth = pc(look.cloth || '#6f86a8'), clothB = mixH(cloth, '#4a5378', 0.28);
    const legs = pc(look.legs || '#4c566e', 0.04), legsB = mixH(legs, '#3a4060', 0.28);
    const shoe = pc(look.shoe || '#3b3644', -0.12), hair = pc(look.hair || '#4a4256', -0.08);
    const skin = awake ? (look.skin || '#f0c9a8') : M.porcSkin, skinS = awake ? mixH(look.skin || '#f0c9a8', '#a0607a', 0.28) : M.porcS;
    if (!o.noPlate && !awake) plate(g, x, y + 1, 24 * s * (child ? 0.8 : 1), false);
    g.save(); g.translate(x, y); g.scale(face * s, s);
    const hand = (p, c) => { g.beginPath(); g.arc(p.x, p.y, child ? 3.2 : 2.7, 0, TAU); g.fillStyle = c; g.fill(); ink(g, 0.9); };
    // back leg + arm
    const NH = { noHatch: true };
    Rig.limb(g, J.hip, J.kneeB, 6.4, 5.2, legsB, NH); Rig.limb(g, J.kneeB, J.ankB, 5.2, 3.8, legsB, NH); Rig.limb(g, J.ankB, J.toeB, 3.6, 2.6, shoe, NH);
    Rig.limb(g, J.shB, J.elB, 4.4, 3.6, clothB, NH); Rig.limb(g, J.elB, J.hdB, 3.6, 2.8, clothB, NH); hand(J.hdB, skinS);
    // torso frame
    const ux = J.chest.x - J.hip.x, uy = J.chest.y - J.hip.y, ul = Math.hypot(ux, uy) || 1, nx = -uy / ul, ny = ux / ul;
    const Q = (a, b) => [J.hip.x + ux * a + nx * b, J.hip.y + uy * a + ny * b];
    const tw = child ? 10 : 11.6, hw = child ? 8.4 : 9.6, side = face > 0 ? 1 : -1;
    if (look.coat === 'long') { blob(g, [Q(0.55, -tw * 0.9), Q(0.1, -hw - 1), Q(-0.8, -hw - 5), Q(-0.86, hw + 2), Q(-0.2, hw + 1)]); g.fillStyle = lit(g, ...Q(-0.3, 0), 28, clothB); g.fill(); ink(g, 1.2); }
    // front leg
    Rig.limb(g, J.hip, J.kneeF, 6.8, 5.4, legs, { spec: 0.25, noHatch: true }); Rig.limb(g, J.kneeF, J.ankF, 5.4, 4.0, legs, NH); Rig.limb(g, J.ankF, J.toeF, 3.8, 2.7, shoe, NH);
    // skirt / dress / coat front
    if (look.skirt) {
      const sl = look.skirt;
      blob(g, [Q(0.25, -hw - 0.5), Q(0.25, hw + 0.5), Q(-sl, hw + 8), Q(-sl - 0.06, 0), Q(-sl, -hw - 7)]);
      g.fillStyle = lit(g, ...Q(-sl * 0.5, 0), 30, cloth); g.fill(); ink(g, 1.2);
      g.strokeStyle = rgba(INK, 0.35); g.lineWidth = 0.7; g.beginPath(); for (const b of [-4, 3]) { const p0 = Q(0.1, b), p1 = Q(-sl + 0.05, b * 1.6); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); } g.stroke();
    }
    blob(g, [Q(-0.06, -hw), Q(0.5, -tw * 0.98), Q(1.02, -tw * 0.85), Q(1.12, 0), Q(1.04, tw), Q(0.55, tw * 0.95), Q(-0.06, hw)]);
    g.fillStyle = lit(g, ...Q(0.5, 0), 24, cloth); g.fill(); ink(g, 1.25);
    if (!awake) { const a1 = Q(0.98, side * tw * 0.62), a2 = Q(0.5, side * tw * 0.86), a3 = Q(0.08, side * hw * 0.78); g.strokeStyle = 'rgba(255,255,255,0.78)'; g.lineWidth = 1.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(a1[0], a1[1]); g.quadraticCurveTo(a2[0], a2[1], a3[0], a3[1]); g.stroke(); }
    if (look.coat === 'long' || look.coat === 'jacket') {
      // lapel line + buttons
      g.strokeStyle = rgba(INK, 0.5); g.lineWidth = 0.8; g.beginPath(); { const a = Q(1.02, 4), b = Q(0.45, 1.5), c = Q(-0.05, 2); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); } g.stroke();
      g.fillStyle = rgba(INK, 0.55); for (const a of [0.55, 0.32]) { const p = Q(a, 3.5); g.fillRect(p[0] - 0.8, p[1] - 0.8, 1.6, 1.6); }
    }
    if (look.scarf) { const a = Q(1.04, -tw * 0.7), b = Q(1.06, tw * 0.75); Rig.limb(g, { x: a[0], y: a[1] }, { x: b[0], y: b[1] }, 3, 3, pc(look.scarf, -0.1), { noHatch: true }); const c = Q(0.95, tw * 0.5); Rig.limb(g, { x: c[0], y: c[1] }, { x: c[0] - 3, y: c[1] + 14 }, 2.4, 1.8, pc(look.scarf, -0.1), { noHatch: true }); }
    // head
    const hr = child ? 10.4 : 9;
    g.save(); g.translate(J.head.x, J.head.y); g.rotate(J.ha);
    {
      if (look.hairStyle === 'long') { blob(g, [[-hr * 0.5, -hr * 0.9], [-hr * 1.15, hr * 0.2], [-hr * 1.05, hr * 1.7], [-hr * 0.2, hr * 1.5], [hr * 0.2, 0]]); g.fillStyle = lit(g, -hr * 0.4, hr * 0.4, hr, hair); g.fill(); ink(g, 1); }
      if (look.hairStyle === 'pony') { blob(g, [[-hr * 0.7, -hr * 0.5], [-hr * 1.8, -hr * 0.1], [-hr * 1.95, hr * 0.9], [-hr * 1.3, hr * 0.5], [-hr * 0.8, 0]]); g.fillStyle = lit(g, -hr * 1.3, 0, hr, hair); g.fill(); ink(g, 1); }
    }
    blob(g, [[-hr * 0.15, -hr], [hr * 0.6, -hr * 0.92], [hr * 0.95, -hr * 0.32], [hr * 1.08, hr * 0.08], [hr * 0.86, hr * 0.32], [hr * 0.92, hr * 0.58], [hr * 0.55, hr * 0.95], [-hr * 0.12, hr * 0.92], [-hr * 0.55, hr * 0.3]]);
    g.fillStyle = lit(g, hr * 0.25, 0, hr, skin); g.fill(); ink(g, 1.1);
    if (awake) { g.fillStyle = INK; g.beginPath(); g.ellipse(hr * 0.56, -hr * 0.12, hr * 0.1, hr * 0.15, 0, 0, TAU); g.fill(); }
    else { g.beginPath(); g.arc(hr * 0.55, -hr * 0.2, hr * 0.2, 0.35, PI - 0.35); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke(); }
    const hs = look.hairStyle || 'short';
    if (hs !== 'none') {
      if (hs === 'hat') {
        g.beginPath(); g.ellipse(hr * 0.1, -hr * 0.78, hr * 1.7, hr * 0.32, -0.06, 0, TAU); g.fillStyle = lit(g, 0, -hr, hr * 1.6, pc(look.hatCol || '#d8c08a', -0.1)); g.fill(); ink(g, 1);
        blob(g, [[-hr * 0.75, -hr * 0.8], [-hr * 0.6, -hr * 1.65], [hr * 0.5, -hr * 1.75], [hr * 0.8, -hr * 0.85]]); g.fillStyle = lit(g, 0, -hr * 1.2, hr, pc(look.hatCol || '#d8c08a', -0.1)); g.fill(); ink(g, 1);
      } else if (hs === 'cap') {
        blob(g, [[-hr * 0.9, -hr * 0.2], [-hr * 0.8, -hr * 1.05], [hr * 0.3, -hr * 1.2], [hr * 0.9, -hr * 0.6], [hr * 1.7, -hr * 0.55], [hr * 0.9, -hr * 0.35]]); g.fillStyle = lit(g, 0, -hr * 0.7, hr, pc(look.hatCol || '#3f4a6a', -0.1)); g.fill(); ink(g, 1);
      } else {
        blob(g, [[-hr * 0.62, hr * 0.42], [-hr * 0.98, -hr * 0.35], [-hr * 0.35, -hr * 1.12], [hr * 0.5, -hr * 1.12], [hr * 1.0, -hr * 0.55], [hr * 0.45, -hr * 0.5], [hr * 0.05, -hr * 0.18], [-hr * 0.2, hr * 0.5]]);
        g.fillStyle = lit(g, 0, -hr * 0.5, hr, hair); g.fill(); ink(g, 1);
        if (hs === 'bun') { g.beginPath(); g.arc(-hr * 0.82, -hr * 0.82, hr * 0.42, 0, TAU); g.fillStyle = lit(g, -hr * 0.8, -hr * 0.8, hr * 0.4, hair); g.fill(); ink(g, 1); }
      }
    }
    if (hs === 'short' || hs === 'cap' || hs === 'bun') { g.beginPath(); g.ellipse(-hr * 0.02, hr * 0.12, hr * 0.15, hr * 0.24, 0.15, 0, TAU); g.fillStyle = skinS; g.fill(); ink(g, 0.8); }
    g.strokeStyle = INK; g.lineWidth = 0.75; g.beginPath(); g.moveTo(hr * 0.66, hr * 0.56); g.lineTo(hr * 0.84, hr * 0.5); g.stroke();
    if (!awake) { g.beginPath(); g.arc(0, 0, hr * 1.04, -PI * 0.78, -PI * 0.22); g.strokeStyle = 'rgba(248,253,255,0.95)'; g.lineWidth = 1.3; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(hr * 0.55, hr * 0.3, hr * 0.16, hr * 0.08, -0.4, 0, TAU); g.fill(); }
    g.restore();
    // front arm + hand
    Rig.limb(g, J.sh, J.elF, 4.6, 3.8, cloth, { spec: 0.25, noHatch: true }); Rig.limb(g, J.elF, J.hdF, 3.8, 3.0, cloth, NH); hand(J.hdF, skin);
    // held things
    const acc = look.acc, hF = J.hdF, hB = J.hdB;
    if (acc === 'book') {
      const cx = (hF.x + hB.x) / 2 + 2, cy = (hF.y + hB.y) / 2 - 2;
      g.save(); g.translate(cx, cy); g.rotate(-0.25);
      poly(g, [[-8, -1], [0, 1], [8, -1], [8, -11], [0, -9], [-8, -11]]); g.fillStyle = pc('#f4ecd6', -0.2); g.fill(); ink(g, 0.9);
      g.strokeStyle = rgba(INK, 0.55); g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, 1); g.lineTo(0, -9); for (const yy of [-7, -5, -3]) { g.moveTo(-6, yy); g.lineTo(-1.5, yy + 0.5); g.moveTo(1.5, yy + 0.5); g.lineTo(6, yy); } g.stroke();
      rect(g, -8.5, -1, 17, 2, pc('#7a2c3a', -0.15));
      g.restore();
    } else if (acc === 'bag') {
      g.beginPath(); g.moveTo(hB.x, hB.y); g.lineTo(hB.x - 4, hB.y + 9); g.lineTo(hB.x + 4, hB.y + 9); g.closePath(); ink(g, 0.8);
      blob(g, [[hB.x - 9, hB.y + 8], [hB.x + 9, hB.y + 8], [hB.x + 10, hB.y + 22], [hB.x - 10, hB.y + 22]]); g.fillStyle = lit(g, hB.x, hB.y + 15, 10, pc('#8a5a3a', -0.1)); g.fill(); ink(g, 1);
    } else if (acc === 'case') {
      g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.moveTo(hB.x, hB.y); g.lineTo(hB.x, hB.y + 6); g.stroke();
      block(g, hB.x - 12, hB.y + 6, 24, 34, { body: pc('#7b5a8a', -0.1), lit: pc('#a88ab8', -0.1), dark: pc('#4a3456', -0.1) });
      rect(g, hB.x - 12, hB.y + 20, 24, 2, rgba(INK, 0.5));
    } else if (acc === 'box') {
      const cx = (hF.x + hB.x) / 2 + 3, cy = (hF.y + hB.y) / 2;
      block(g, cx - 12, cy - 14, 24, 20, { body: pc('#c49a62', -0.15), lit: pc('#e8c48a', -0.15), dark: pc('#8a6236', -0.15) });
      g.strokeStyle = rgba(INK, 0.5); g.lineWidth = 0.8; g.beginPath(); g.moveTo(cx - 12, cy - 6); g.lineTo(cx + 12, cy - 6); g.stroke();
    } else if (acc === 'cane') {
      Rig.limb(g, { x: hF.x + 1, y: hF.y - 2 }, { x: hF.x + 9, y: -1 }, 1.4, 1.2, pc('#6a4a32', -0.1), { noHatch: true });
    } else if (acc === 'violin') {
      g.save(); g.translate(J.sh.x + 6, J.sh.y - 2); g.rotate(-0.45);
      blob(g, [[-3, -6], [10, -7], [16, -4], [16, 4], [10, 7], [-3, 6], [-6, 0]]); g.fillStyle = lit(g, 6, 0, 10, pc('#a0582e', -0.15)); g.fill(); ink(g, 0.9);
      rect(g, 16, -1.2, 16, 2.4, pc('#3a2418', -0.1)); g.restore();
      g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(hB.x - 10, hB.y + 12); g.lineTo(hB.x + 18, hB.y - 18); g.stroke();
    } else if (acc === 'baton') {
      g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.moveTo(hF.x, hF.y); g.lineTo(hF.x + 6, hF.y - 18); g.stroke();
      g.strokeStyle = pc('#f4f0e6', -0.2); g.lineWidth = 0.8; g.stroke();
    } else if (acc === 'sign') {
      const cx = hF.x + 2, cy = hF.y - 16;
      g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(hF.x, hF.y + 2); g.lineTo(cx, cy + 8); g.stroke();
      rect(g, cx - 20, cy - 16, 40, 24, INK); rect(g, cx - 18.5, cy - 14.5, 37, 21, pc('#fff2c8', -0.25));
      stencil(g, '歡迎回家', cx, cy - 6.5, 8, pc('#d1563a', -0.1), { ink: false });
      g.strokeStyle = pc('#e86a8a', -0.1); g.lineWidth = 1; g.beginPath(); g.arc(cx - 11, cy + 2, 2, 0, TAU); g.arc(cx + 11, cy + 2, 2, 0, TAU); g.stroke();
    } else if (acc === 'can') {
      g.save(); g.translate(hF.x + 4, hF.y + 2); g.rotate(0.35);
      blob(g, [[-7, -6], [6, -6], [7, 7], [-7, 7]]); g.fillStyle = lit(g, 0, 0, 8, pc('#7fb0c8', -0.1)); g.fill(); ink(g, 0.9);
      g.beginPath(); g.moveTo(6, -2); g.lineTo(17, -9); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke(); g.lineWidth = 1; g.strokeStyle = pc('#7fb0c8', -0.1); g.stroke();
      g.restore();
    } else if (acc === 'cup') {
      rect(g, hF.x - 1, hF.y - 7, 8, 7, INK); rect(g, hF.x, hF.y - 6, 6, 5, pc('#f4f0e6', -0.2));
    } else if (acc === 'flower') {
      g.strokeStyle = pc('#5a8a4a', -0.1); g.lineWidth = 1.2; g.beginPath(); g.moveTo(hF.x, hF.y); g.lineTo(hF.x + 4, hF.y - 14); g.stroke();
      g.beginPath(); g.arc(hF.x + 4, hF.y - 15, 3.2, 0, TAU); g.fillStyle = pc('#ff8fb0', -0.15); g.fill(); ink(g, 0.7);
    }
    // frost rime along the lit shoulders + crystals at the back (the Hush rooting them in place)
    if (!awake) {
      const a = Q(1.02, -tw * 0.5), b = Q(1.1, tw * 0.6);
      g.strokeStyle = 'rgba(248,253,255,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(a[0], a[1] - 1); g.lineTo(b[0], b[1] - 1); g.stroke();
      if (look.xtal) { const rr = U.mulberry32(look.xtal | 0); const c = Q(0.75, -tw * 0.9); cluster(g, c[0], c[1], 0.5, -PI * 0.75, rr, 0.25); }
      const rg = U.mulberry32((x * 7 + y) | 0); g.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 2; i++) { const px = J.head.x + (rg() - 0.5) * 34, py = J.head.y + (rg() - 0.3) * 40, r = 1.1 + rg() * 1.2; g.beginPath(); g.moveTo(px, py - r * 2.2); g.lineTo(px + r * 0.45, py); g.lineTo(px, py + r * 2.2); g.lineTo(px - r * 0.45, py); g.closePath(); g.fill(); g.beginPath(); g.moveTo(px - r * 2.2, py); g.lineTo(px, py + r * 0.45); g.lineTo(px + r * 2.2, py); g.lineTo(px, py - r * 0.45); g.closePath(); g.fill(); }
    }
    g.restore();
    if (!awake && look.feet) { const rr = U.mulberry32((x | 0) + 31); cluster(g, x - 10 * s * face, y + 1, 0.42 * s, -PI / 2 - 0.4 * face, rr, 0.22); }
  }
  // a chorister seen from the front (parallax tiers, pews): robe, white collar, open hymnal, head lifted mid-note
  function choirC(rr, haze, frozen = true) {
    const robe = mixH(['#eef2fa', '#dde6f6', '#f3ead8', '#e6def4', '#f6e6ea'][Math.floor(rr() * 5)], '#8f9cc4', haze);
    const hair = mixH(['#2a2633', '#4a3a3a', '#6a5040', '#d8d4dc', '#3a3044'][Math.floor(rr() * 5)], frozen ? '#c8d0e0' : '#000000', frozen ? 0.25 + haze * 0.5 : 0);
    return { robe, shade: mixH(robe, '#5a5f94', 0.42), lit: mixH(robe, '#ffffff', 0.7), collar: mixH('#ffffff', '#8f9cc4', haze * 0.8), skin: mixH(M.porcSkin, '#8f9cc4', haze),
      hair, book: mixH('#fbf3dc', '#8f9cc4', haze), ribbon: mixH('#a3123c', '#5a5f94', haze), ink: haze > 0.3 ? mixH(INK, '#3a4470', haze * 0.6) : INK, frost: !!frozen };
  }
  function singer(g, x, y, s, C, seat) {
    if (s < 0.3) {   // far away: robe + head + a book glint is all the eye can read (cheap for the mid layer)
      g.save(); g.translate(x, y); g.scale(s, s); g.lineJoin = 'round'; g.lineWidth = 2.6; g.strokeStyle = C.ink;
      g.beginPath(); g.moveTo(-8, -56); g.quadraticCurveTo(-12, -28, -16, 0); g.lineTo(16, 0); g.quadraticCurveTo(12, -28, 8, -56); g.closePath(); g.fillStyle = C.robe; g.fill(); g.stroke();
      g.beginPath(); g.arc(0, -65.5, 7.6, 0, TAU); g.fillStyle = C.hair; g.fill(); g.stroke();
      g.fillStyle = C.book; g.fillRect(-8, -42, 16, 10);
      g.restore(); return;
    }
    g.save(); g.translate(x, y); g.scale(s, s);
    g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = 2.4; g.strokeStyle = C.ink;
    g.beginPath();
    if (!seat) { g.moveTo(-8, -56); g.quadraticCurveTo(-12, -28, -16, 0); g.lineTo(16, 0); g.quadraticCurveTo(12, -28, 8, -56); }
    else { g.moveTo(-8, -56); g.quadraticCurveTo(-12, -40, -14, -22); g.lineTo(14, -22); g.quadraticCurveTo(12, -40, 8, -56); }
    g.closePath(); g.fillStyle = C.robe; g.fill(); g.stroke();
    g.save(); g.clip(); g.fillStyle = C.shade; g.fillRect(-18, -60, 10, 62); g.fillStyle = C.lit; g.fillRect(9.5, -60, 3.5, 62);
    g.strokeStyle = rgba(C.ink, 0.35); g.lineWidth = 1; g.beginPath(); g.moveTo(-3, -46); g.lineTo(-5, 0); g.moveTo(4, -46); g.lineTo(6, 0); g.stroke(); g.restore();
    g.beginPath(); g.moveTo(-8.5, -56.5); g.quadraticCurveTo(0, -49, 8.5, -56.5); g.quadraticCurveTo(0, -60, -8.5, -56.5); g.closePath(); g.fillStyle = C.collar; g.fill(); g.stroke();
    const hy = -65.5;
    g.beginPath(); g.arc(0, hy, 7.4, 0, TAU); g.fillStyle = C.skin; g.fill(); g.stroke();
    g.beginPath(); g.arc(0, hy - 0.4, 7.7, PI * 1.03, PI * 1.97); g.quadraticCurveTo(3, hy - 4.8, 0, hy - 3.2); g.quadraticCurveTo(-3, hy - 4.8, -7.6, hy - 1); g.closePath(); g.fillStyle = C.hair; g.fill(); g.stroke();
    if (s > 0.3) { g.lineWidth = 0.9; g.beginPath(); g.moveTo(-3.8, hy + 0.4); g.lineTo(-1.5, hy); g.moveTo(1.5, hy); g.lineTo(3.8, hy + 0.4); g.stroke(); }
    g.fillStyle = C.ink; g.beginPath(); g.ellipse(0, hy + 3.7, 1.5, 2.1, 0, 0, TAU); g.fill();
    if (C.frost) { g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, hy, 7.4, -PI * 0.72, -PI * 0.18); g.stroke(); }
    if (C.book) {
      g.strokeStyle = C.ink; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-8.5, -43); g.lineTo(0, -40.5); g.lineTo(8.5, -43); g.lineTo(8.5, -32); g.lineTo(0, -29.5); g.lineTo(-8.5, -32); g.closePath();
      g.fillStyle = C.book; g.fill(); g.stroke();
      g.fillStyle = C.ribbon; g.fillRect(-0.8, -40, 1.6, 11);
      g.fillStyle = C.skin; g.beginPath(); g.arc(-9, -37, 2.3, 0, TAU); g.arc(9, -37, 2.3, 0, TAU); g.fill();
    }
    g.restore();
  }
  // a cheap inked silhouette for crowds in the parallax layers (two passes: ink outline, body; a lit rim)
  function figSil(g, x, y, s, face, poseKey, body, rim, o = {}) {
    const J = jointsOf(poseKey);
    g.save(); g.translate(x, y); g.scale(face * s, s);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const line = (pts, w) => { g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y); g.lineWidth = w; g.stroke(); };
    const hk = o.child ? 1.2 : 1;
    for (let pass = 0; pass < 2; pass++) {
      const k = pass ? 0 : (o.inkW ?? 3.2), col = pass ? body : (o.ink || INK);
      g.strokeStyle = col; g.fillStyle = col;
      line([J.hip, J.kneeB, J.ankB, J.toeB], 8.5 + k); line([J.shB, J.elB, J.hdB], 6.2 + k);
      line([J.hip, J.kneeF, J.ankF, J.toeF], 9 + k);
      line([{ x: J.hip.x, y: J.hip.y + 2 }, J.chest], 19 + k);
      if (o.robe) { g.beginPath(); g.moveTo(J.chest.x - 9 - k / 2, J.chest.y + 4); g.lineTo(J.hip.x + 12 + k / 2, J.hip.y + 26 + k / 2); g.lineTo(J.hip.x - 12 - k / 2, J.hip.y + 28 + k / 2); g.closePath(); g.fill(); }
      g.beginPath(); g.arc(J.head.x, J.head.y, 9.5 * hk + k / 2, 0, TAU); g.fill();
      line([J.sh, J.elF, J.hdF], 6.4 + k);
      if (o.book && pass) { g.fillStyle = o.book; g.fillRect((J.hdF.x + J.hdB.x) / 2 - 6, (J.hdF.y + J.hdB.y) / 2 - 9, 12, 8); }
    }
    if (rim) {
      g.strokeStyle = rim; g.lineWidth = 1.8;
      g.beginPath(); g.arc(J.head.x, J.head.y, 8.2 * hk, -PI * 0.6, PI * 0.05); g.stroke();
      g.beginPath(); g.moveTo(J.chest.x + 8, J.chest.y + 2); g.lineTo(J.hip.x + 8, J.hip.y - 4); g.stroke();
    }
    g.restore();
  }

  /* =========================================================================================
     PARALLAX — FAR (f 0.08): the Ark's own exterior seen through every window: spires, the habitat
     ring sweeping overhead, and the central spire that houses the Core (crimson, crowned with crystal)
     ========================================================================================= */
  const CORE_FAR_X = 640;
  function spire(g, rng, x, base, w, h, C) {
    const top = base - h, mid = x + w / 2;
    const body = [[x, base + 700], [x, top + h * 0.22], [x + w * 0.18, top + h * 0.1], [mid, top], [x + w * 0.82, top + h * 0.1], [x + w, top + h * 0.22], [x + w, base + 700]];
    poly(g, body); g.fillStyle = C.body; g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2.2; g.stroke();
    g.save(); poly(g, body); g.clip();
    rect(g, x, top, w * 0.3, h + 700, C.dark);
    rect(g, x + w - Math.max(2, w * 0.12), top, Math.max(2, w * 0.12), h + 700, C.lit);
    for (let y = top + h * 0.2; y < base + 40; y += 9 + rng() * 6) {
      for (let xx = x + 4; xx < x + w - 3; xx += 5) if (rng() < 0.32) { g.fillStyle = rng() < 0.65 ? 'rgba(255,214,150,0.85)' : 'rgba(170,230,255,0.75)'; g.fillRect(xx, y, 2, 2.4); }
    }
    for (let y = top + h * 0.3; y < base; y += 34 + rng() * 30) rect(g, x, y, w, 2, rgba(INK, 0.35));
    g.restore();
    // antenna + blinker
    g.strokeStyle = C.ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(mid, top); g.lineTo(mid, top - 22 - rng() * 30); g.stroke();
    glow(g, mid, top - 26, 9, '#ff4d6a', 0.6);
  }
  function genFar() {
    const f = 0.08, x0 = -900, x1 = SPAN[1] * f + 1100, objs = [];
    const rng = U.mulberry32(6101);
    // the habitat ring: a vast arc band sweeping overhead
    const RC = { x: 600, y: 1560, r: 1960 };
    objs.push(...chunks(x0, x1, 512, -560, 980, (g, a, b) => {
      const C = { body: '#56688f', dark: '#2c365a', lit: '#a8c6f0' };
      g.beginPath(); g.arc(RC.x, RC.y, RC.r, PI * 1.05, PI * 1.95); g.strokeStyle = rgba(INK, 0.5); g.lineWidth = 46; g.stroke();
      g.strokeStyle = C.dark; g.lineWidth = 40; g.stroke();
      g.beginPath(); g.arc(RC.x, RC.y, RC.r - 9, PI * 1.05, PI * 1.95); g.strokeStyle = C.body; g.lineWidth = 20; g.stroke();
      g.beginPath(); g.arc(RC.x, RC.y, RC.r - 17, PI * 1.05, PI * 1.95); g.strokeStyle = C.lit; g.lineWidth = 3; g.stroke();
      for (let k = 0; k < 140; k++) {
        const ang = PI * 1.05 + (k / 140) * PI * 0.9, px = RC.x + Math.cos(ang) * RC.r, py = RC.y + Math.sin(ang) * RC.r;
        if (px < a - 30 || px > b + 30) continue;
        g.save(); g.translate(px, py); g.rotate(ang + PI / 2); rect(g, -1.2, -20, 2.4, 40, rgba(INK, 0.45));
        if (k % 3 === 0) { g.fillStyle = k % 6 === 0 ? 'rgba(255,210,150,0.95)' : 'rgba(180,235,255,0.85)'; g.fillRect(-1.6, -4, 3.2, 3.2); }
        g.restore();
      }
    }));
    // spires along the hull (avoid the central spire)
    let x = x0;
    while (x < x1) {
      const w = 22 + rng() * 34, h = 150 + rng() * 230, bx = x, r2 = rng() * 1e6;
      if (Math.abs(bx + w / 2 - CORE_FAR_X) > 190) objs.push({ x: bx - 6, y: 60 - h - 70, w: w + 12, h: h + 800, draw(g) {
        const C = { body: '#4c5e88', dark: '#26304f', lit: '#b6d2ff', ink: rgba(INK, 0.55) };
        spire(g, U.mulberry32(r2 | 0), bx, 60, w, h, C);
      } });
      x += w + 70 + rng() * 190;
    }
    // the central spire: the Core's housing, veined with the Hush and crowned with crimson crystal
    objs.push({ x: CORE_FAR_X - 230, y: -760, w: 460, h: 1500, draw(g) {
      const cx = CORE_FAR_X, w = 120, top = -370, rr = U.mulberry32(611);
      glow(g, cx, -170, 230, M.crim, 0.22);
      const C = { body: '#5c6a94', dark: '#2a2f52', lit: '#e8eeff', ink: rgba(INK, 0.6) };
      spire(g, rr, cx - w / 2, 60, w, 60 - top, C);
      // crimson veins down the hull
      g.save(); g.beginPath(); g.rect(cx - w / 2, top, w, 800); g.clip();
      for (let k = 0; k < 6; k++) vein(g, rr, cx - w / 2 + rr() * w, top + 60 + rr() * 80, 120 + rr() * 160, PI / 2 + (rr() - 0.5) * 0.6, 2.2);
      g.restore();
      // halo ring around the spire's waist
      for (const front of [false, true]) {
        g.beginPath(); g.ellipse(cx, -170, 170, 30, 0, front ? 0 : PI, front ? PI : TAU);
        g.strokeStyle = rgba(INK, 0.6); g.lineWidth = 13; g.stroke(); g.strokeStyle = front ? '#c8d4f2' : '#5a6690'; g.lineWidth = 8; g.stroke();
        if (front) { g.fillStyle = 'rgba(255,140,170,0.95)'; for (let k = 0; k < 12; k++) { const a = (k / 12) * PI; g.fillRect(cx + Math.cos(a) * 170 - 1.5, -170 + Math.sin(a) * 30 - 1.5, 3, 3); } }
      }
      // the crown: crystals erupting from the spire's tip
      cluster(g, cx, top + 30, 3.2, -PI / 2, rr, 0.5);
      cluster(g, cx - 30, top + 70, 1.8, -PI / 2 - 0.7, rr, 0);
      cluster(g, cx + 34, top + 90, 1.6, -PI / 2 + 0.8, rr, 0);
    } });
    return objs;
  }

  /* =========================================================================================
     PARALLAX — MID (f 0.22): the concourse's lancet windows · the habitat light-well · the far
     terraces under the dome · the outer hull past the ward · the Core's halo and white glass vaults
     ========================================================================================= */
  function genMid() {
    const f = 0.22, objs = [];
    const wx = (lx) => lx / f;
    // ---- Z1: the window wall of the concourse (lancet windows onto space; banners between)
    objs.push(...chunks(-820, 640, 256, -700, 1500, (g, a, b) => {
      const C = { body: '#55668f', dark: '#2f3a63', lit: '#9fb6e0', deep: '#1b2244' };
      const wins = []; for (let x = -780; x < 620; x += 300) wins.push(x);
      // wall with window openings (even-odd)
      g.beginPath(); g.rect(a - 4, -700, b - a + 8, 1500); for (const x of wins) lancet(g, x, -430, 210, -48);
      g.fillStyle = C.body; g.fill('evenodd');
      for (const x of wins) {
        if (x + 260 < a || x - 60 > b) continue;
        // pier shadows + lit edges
        rect(g, x - 44, -700, 20, 1500, C.dark); rect(g, x + 210, -700, 8, 1500, C.lit);
        // window frame + tracery
        g.beginPath(); lancet(g, x, -430, 210, -48); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); g.strokeStyle = C.lit; g.lineWidth = 2; g.stroke();
        g.strokeStyle = rgba(INK, 0.85); g.lineWidth = 3.4; g.beginPath();
        g.moveTo(x + 105, -380); g.lineTo(x + 105, -48); g.moveTo(x, -200); g.lineTo(x + 210, -200); g.moveTo(x, -120); g.lineTo(x + 210, -120);
        g.stroke();
        g.strokeStyle = C.body; g.lineWidth = 1.6; g.stroke();
        g.beginPath(); g.arc(x + 105, -320, 46, 0, TAU); g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); g.strokeStyle = C.lit; g.lineWidth = 1.6; g.stroke();
        g.beginPath(); for (let k = 0; k < 8; k++) { const an = (k / 8) * TAU; g.moveTo(x + 105, -320); g.lineTo(x + 105 + Math.cos(an) * 46, -320 + Math.sin(an) * 46); } g.strokeStyle = rgba(INK, 0.7); g.lineWidth = 1.6; g.stroke();
        // glass sheen
        g.save(); g.beginPath(); lancet(g, x, -430, 210, -48); g.clip();
        g.fillStyle = 'rgba(170,220,255,0.06)'; g.fillRect(x, -440, 210, 400);
        g.fillStyle = 'rgba(220,245,255,0.08)'; poly(g, [[x + 20, -48], [x + 80, -48], [x + 190, -430], [x + 130, -430]]); g.fill();
        g.restore();
        // banner on the pier
        const bx = x - 34;
        g.beginPath(); g.moveTo(bx - 14, -400); g.lineTo(bx + 14, -400); g.lineTo(bx + 14, -230); g.lineTo(bx, -214); g.lineTo(bx - 14, -230); g.closePath();
        g.fillStyle = '#d9e2f2'; g.fill(); ink(g, 2); rect(g, bx - 14, -400, 6, 170, '#9fb0d0');
        g.beginPath(); g.arc(bx, -330, 7, 0, TAU); g.strokeStyle = '#c9a24e'; g.lineWidth = 1.6; g.stroke();
        g.beginPath(); g.moveTo(bx - 3, -336); g.lineTo(bx - 3, -324); g.moveTo(bx, -337); g.lineTo(bx, -323); g.moveTo(bx + 3, -336); g.lineTo(bx + 3, -324); g.stroke();
      }
      // sill + gallery rail + the dark lower level
      rect(g, a, -50, b - a, 12, INK); rect(g, a, -48, b - a, 8, C.lit);
      rect(g, a, -38, b - a, 760, C.deep);
      g.strokeStyle = rgba('#9fb6e0', 0.5); g.lineWidth = 1.4; g.beginPath(); for (let x = Math.floor(a / 18) * 18; x < b; x += 18) { g.moveTo(x, -38); g.lineTo(x, -14); } g.moveTo(a, -16); g.lineTo(b, -16); g.stroke();
      for (let x = Math.floor(a / 60) * 60; x < b; x += 60) { g.fillStyle = 'rgba(160,230,255,0.55)'; g.fillRect(x + 8, 6, 22, 3); }
    }));
    // ---- Z2: the habitat light-well — stacked apartment decks, laundry, plants, sleepers at the railings
    objs.push(...chunks(560, 1200, 256, -700, 1500, (g, a, b) => {
      const rr = U.mulberry32(Math.floor(a) * 3 + 11);
      rect(g, a, -700, b - a, 1500, '#1a2142');
      for (let k = 0; k < 6; k++) {
        const fy = -400 + k * 82, t = (k + 1) / 7;
        const wall = mixH('#3c4a74', '#1a2142', t * 0.3), wallD = mixH(wall, '#0d1022', 0.5);
        rect(g, a, fy - 74, b - a, 74, wall);
        // windows + doors
        for (let x = Math.floor(a / 46) * 46; x < b; x += 46) {
          const r = rr(), on = r < 0.55;
          rect(g, x + 8, fy - 58, 22, 30, INK);
          g.fillStyle = on ? (r < 0.35 ? 'rgba(255,214,160,0.9)' : 'rgba(176,228,255,0.8)') : wallD; g.fillRect(x + 10, fy - 56, 18, 26);
          if (on) { g.fillStyle = rgba(INK, 0.5); g.fillRect(x + 18, fy - 56, 1.4, 26); if (r < 0.12) { g.fillStyle = 'rgba(20,24,40,0.85)'; g.beginPath(); g.arc(x + 14, fy - 40, 3, 0, TAU); g.fill(); g.fillRect(x + 11, fy - 37, 6, 7); } }
        }
        // slab, railing
        rect(g, a, fy - 2, b - a, 10, INK); rect(g, a, fy, b - a, 6, '#8fa0c8'); rect(g, a, fy, b - a, 1.6, '#d8e4ff');
        g.strokeStyle = rgba(INK, 0.9); g.lineWidth = 1.4; g.beginPath();
        for (let x = Math.floor(a / 10) * 10; x < b; x += 10) { g.moveTo(x, fy); g.lineTo(x, fy - 16); }
        g.moveTo(a, fy - 16); g.lineTo(b, fy - 16); g.stroke();
        // planters + laundry + a sleeper at the rail
        for (let x = Math.floor(a / 128) * 128 + 30; x < b; x += 128) {
          const r = rr();
          if (r < 0.4) { g.fillStyle = INK; g.beginPath(); g.arc(x, fy - 22, 9, 0, TAU); g.arc(x + 10, fy - 26, 8, 0, TAU); g.fill(); g.fillStyle = '#3f7a5a'; g.beginPath(); g.arc(x, fy - 22, 7.5, 0, TAU); g.arc(x + 10, fy - 26, 6.5, 0, TAU); g.fill(); g.fillStyle = '#7fbf7a'; g.beginPath(); g.arc(x + 2, fy - 25, 3.5, 0, TAU); g.fill(); rect(g, x - 6, fy - 16, 20, 7, '#a3826a'); }
          else if (r < 0.7) {
            g.strokeStyle = rgba('#c9d4ec', 0.7); g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - 30, fy - 64); g.quadraticCurveTo(x + 20, fy - 50, x + 70, fy - 64); g.stroke();
            for (let i = 0; i < 4; i++) { const cx = x - 18 + i * 22, cy = fy - 58 + Math.sin(i) * 2; g.save(); g.translate(cx, cy); g.rotate((rr() - 0.5) * 0.5 + 0.25); rect(g, -6, 0, 12, 14 + rr() * 8, INK); rect(g, -5, 1, 10, 12 + rr() * 6, ['#e8d2a8', '#a8c0e8', '#e8a8b4', '#f2f2f2'][i % 4]); g.restore(); }
          } else if (r < 0.85) figSil(g, x + 10, fy - 2, 0.42, rr() < 0.5 ? 1 : -1, rr() < 0.5 ? 'stand' : 'lookup', '#aab8d4', 'rgba(255,255,255,0.6)', { inkW: 2.6 });
        }
      }
      // structural columns
      for (let x = Math.floor(a / 180) * 180 + 70; x < b; x += 180) { rect(g, x - 2, -700, 22, 1500, INK); rect(g, x, -700, 18, 1500, '#4a5a86'); rect(g, x + 13, -700, 5, 1500, '#9fb2e0'); }
      // the light-well's ceiling
      rect(g, a, -700, b - a, 240, '#121832'); rect(g, a, -462, b - a, 6, INK);
      for (let x = Math.floor(a / 90) * 90; x < b; x += 90) strip(g, x + 14, -470, 60, 4, '#cfefff', 0.45, 18);
    }));
    // ---- Z3: the far side of the atrium under the dome — terraces of tiny singers, hanging gardens, the dome's meridian ribs
    objs.push(...chunks(1150, 1850, 256, -760, 1560, (g, a, b) => {
      const rr = U.mulberry32(Math.floor(a) * 5 + 7);
      const C = { rib: '#d8e0f0', ribD: '#7f8db8', ledge: '#b9c6e0', ledgeD: '#5f6f9a' };
      // dome meridians (behind)
      const dc = { x: 1500, y: 140 };
      for (const rx of [420, 330, 230, 120]) {
        g.beginPath(); g.ellipse(dc.x, dc.y, rx, 800, 0, PI, TAU); g.strokeStyle = rgba(INK, 0.5); g.lineWidth = 9; g.stroke(); g.strokeStyle = C.ribD; g.lineWidth = 5; g.stroke();
        g.beginPath(); g.ellipse(dc.x, dc.y, rx, 800, 0, PI * 1.5, TAU); g.strokeStyle = rgba(C.rib, 0.8); g.lineWidth = 1.6; g.stroke();
      }
      for (const yy of [-560, -400, -250]) {
        const ry = 70, k = Math.sqrt(Math.max(0, 1 - ((yy - dc.y) / 800) ** 2)) * 420;
        g.beginPath(); g.ellipse(dc.x, yy, k, ry * 0.25, 0, 0, PI); g.strokeStyle = rgba(INK, 0.45); g.lineWidth = 6; g.stroke(); g.strokeStyle = C.ribD; g.lineWidth = 3; g.stroke();
      }
      // pane glints
      for (let i = 0; i < 6; i++) { const px = a + rr() * (b - a), py = -600 + rr() * 380; g.fillStyle = 'rgba(220,245,255,0.08)'; poly(g, [[px, py], [px + 30, py], [px + 70, py - 90], [px + 40, py - 90]]); g.fill(); }
      // terraces (tiers) with rows of singers
      for (let k = 0; k < 4; k++) {
        const ty = -40 - k * 58, haze = k * 0.12;
        const ledge = mixH(C.ledge, '#3d4f7a', haze), ledgeD = mixH(C.ledgeD, '#2a3354', haze);
        for (let x = Math.floor(a / 9) * 9 + (k % 2) * 4.5; x < b; x += 9) {
          if (rr() < 0.08) continue;
          singer(g, x, ty, 0.25 - k * 0.012, choirC(rr, 0.35 + haze));
        }
        rect(g, a, ty - 2, b - a, 9, INK); rect(g, a, ty, b - a, 6, ledge); rect(g, a, ty, b - a, 1.5, '#eef4ff'); rect(g, a, ty + 7, b - a, 40, ledgeD);
        // hanging greenery over the ledge
        for (let x = Math.floor(a / 40) * 40; x < b; x += 40) if (rr() < 0.5) { g.fillStyle = mixH('#2f6b4f', '#2a3354', haze); g.beginPath(); g.ellipse(x + 12, ty + 12, 14, 10, 0, 0, TAU); g.fill(); g.strokeStyle = mixH('#3f8a5f', '#2a3354', haze); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 6, ty + 16); g.lineTo(x + 4, ty + 36 + rr() * 20); g.moveTo(x + 16, ty + 18); g.lineTo(x + 18, ty + 30 + rr() * 16); g.stroke(); }
      }
      rect(g, a, 0, b - a, 800, '#1d2a40');
      // round trees standing on the floor of the far terraces
      for (let x = Math.floor(a / 170) * 170 + 50; x < b; x += 170) {
        g.fillStyle = INK; g.fillRect(x - 3, -60, 6, 60);
        g.beginPath(); for (const [ox, oy, r] of [[0, -70, 24], [-18, -58, 16], [18, -60, 17]]) { g.moveTo(x + ox + r + 2, -0 + oy); g.arc(x + ox, oy, r + 2, 0, TAU); } g.fill();
        g.fillStyle = '#2c5a48'; g.beginPath(); for (const [ox, oy, r] of [[0, -70, 24], [-18, -58, 16], [18, -60, 17]]) { g.moveTo(x + ox + r, oy); g.arc(x + ox, oy, r, 0, TAU); } g.fill();
        g.fillStyle = '#5f9a6e'; g.beginPath(); g.arc(x + 6, -78, 13, 0, TAU); g.arc(x + 20, -64, 8, 0, TAU); g.fill();
      }
    }));
    // ---- Z4: the outer hull past the ward's windows — trusses, radiator fins, the Hush growing on the skin of the ship
    objs.push(...chunks(1840, 2470, 256, -760, 1560, (g, a, b) => {
      const rr = U.mulberry32(Math.floor(a) * 7 + 3);
      const C = { body: '#3c4a72', dark: '#1d2445', lit: '#8ea6d6' };
      // hull skin at the bottom
      g.beginPath(); g.moveTo(a, 40); for (let x = a; x <= b; x += 32) g.lineTo(x, 30 + Math.sin(x * 0.01) * 8); g.lineTo(b, 800); g.lineTo(a, 800); g.closePath(); g.fillStyle = C.dark; g.fill(); ink(g, 2.4);
      for (let x = Math.floor(a / 64) * 64; x < b; x += 64) { rect(g, x, 34, 2, 200, rgba(INK, 0.6)); g.fillStyle = 'rgba(255,200,140,0.7)'; if ((x / 64) % 3 === 0) g.fillRect(x + 20, 48, 3, 3); }
      // diagonal trusses
      for (let x = Math.floor(a / 220) * 220; x < b + 220; x += 220) {
        g.strokeStyle = rgba(INK, 0.85); g.lineWidth = 7; g.beginPath(); g.moveTo(x, 30); g.lineTo(x + 110, -330); g.lineTo(x + 220, 30); g.stroke();
        g.strokeStyle = C.body; g.lineWidth = 3.5; g.stroke();
        g.strokeStyle = rgba(C.lit, 0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(x + 112, -326); g.lineTo(x + 221, 26); g.stroke();
        glow(g, x + 110, -334, 10, '#ff5a6e', 0.55);
      }
      // radiator fins
      for (let x = Math.floor(a / 300) * 300 + 140; x < b; x += 300) { for (let k = 0; k < 5; k++) { rect(g, x + k * 14 - 1, -150, 10, 180, INK); rect(g, x + k * 14, -148, 8, 176, k % 2 ? C.body : C.dark); rect(g, x + k * 14 + 6, -148, 2, 176, C.lit); } }
      // the Hush on the hull
      for (let i = 0; i < 2; i++) { const px = a + rr() * (b - a); vein(g, rr, px, 30, 90 + rr() * 80, -PI / 2 + (rr() - 0.5) * 0.9, 2.4); if (rr() < 0.6) cluster(g, px + 20, 32, 1.2, -PI / 2, rr, 0.3); }
    }));
    // ---- Z5: the Core — white glass vaults on black, resonance columns, the crimson heart inside its halo
    objs.push(...chunks(2440, 3900, 256, -820, 1600, (g, a, b) => {
      const rr = U.mulberry32(Math.floor(a) * 11 + 5), t = clamp((a - 2440) / 300, 0, 1);
      const bg = g.createLinearGradient(0, -820, 0, 200); bg.addColorStop(0, '#05050c'); bg.addColorStop(0.7, '#0e0c1c'); bg.addColorStop(1, '#1c1226');
      g.globalAlpha = t; g.fillStyle = bg; g.fillRect(a, -820, b - a, 1600); g.globalAlpha = 1;
      // vault ribs: pointed arches of white glass with glowing seams
      for (let x = Math.floor(a / 170) * 170 + 30; x < b + 170; x += 170) {
        const top = -780, mid = x + 85;
        g.beginPath(); g.moveTo(x, 200); g.lineTo(x, -300); g.quadraticCurveTo(x + 6, -640, mid, top); g.quadraticCurveTo(x + 164, -640, x + 170, -300); g.lineTo(x + 170, 200);
        g.strokeStyle = rgba(INK, 0.9); g.lineWidth = 12; g.stroke(); g.strokeStyle = '#8b8fb8'; g.lineWidth = 8; g.stroke();
        g.strokeStyle = 'rgba(240,244,255,0.8)'; g.lineWidth = 2; g.stroke();
      }
      // resonance columns (glass cylinders of light)
      for (let x = Math.floor(a / 340) * 340 + 120; x < b; x += 340) {
        const cg = g.createLinearGradient(x - 16, 0, x + 16, 0); cg.addColorStop(0, 'rgba(60,90,150,0.35)'); cg.addColorStop(0.5, 'rgba(220,246,255,0.7)'); cg.addColorStop(1, 'rgba(60,90,150,0.35)');
        rect(g, x - 18, -600, 36, 800, INK); g.fillStyle = cg; g.fillRect(x - 15, -600, 30, 800);
        for (let y = -560; y < 100; y += 80) { rect(g, x - 20, y, 40, 7, INK); rect(g, x - 19, y + 1, 38, 4, '#c9a85a'); }
        glow(g, x, -200, 70, '#9fe6ff', 0.16);
      }
      // crimson masses at the base
      for (let i = 0; i < 3; i++) cluster(g, a + rr() * (b - a), 10, 1.6 + rr() * 1.2, -PI / 2 + (rr() - 0.5) * 0.6, rr, 0.35);
    }));
    // the heart of the Ark, high behind CANTOR's arena: a dim glass sphere split by the Hush, its rings slowed to a crawl
    const HX = (ARENA.boss[0] + 700) * f;
    objs.push({ x: HX - 420, y: -820, w: 840, h: 900, draw(g) {
      const cx = HX, cy = -420, rr = U.mulberry32(6611);
      glow(g, cx, cy, 300, M.crim, 0.16);
      for (const [rx, ry, rot, w] of [[360, 70, -0.12, 7], [270, 54, 0.2, 5]]) {
        g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, TAU); g.strokeStyle = rgba(INK, 0.85); g.lineWidth = w + 4; g.stroke();
        g.strokeStyle = '#6e6a90'; g.lineWidth = w; g.stroke();
        g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, PI * 1.05, PI * 1.55); g.strokeStyle = 'rgba(220,226,255,0.6)'; g.lineWidth = 1.2; g.stroke();
      }
      const R = 82;
      g.beginPath(); g.arc(cx, cy, R + 4, 0, TAU); g.fillStyle = INK; g.fill();
      const hg = g.createRadialGradient(cx + 26, cy - 30, 8, cx, cy, R);
      hg.addColorStop(0, '#d8d4ec'); hg.addColorStop(0.45, '#9f98c0'); hg.addColorStop(0.46, '#6f688f'); hg.addColorStop(0.86, '#4a4268'); hg.addColorStop(0.87, '#a0405e'); hg.addColorStop(1, '#a0405e');
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = hg; g.fill();
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
      for (let i = 0; i < 4; i++) vein(g, rr, cx - 20 + rr() * 40, cy - 10 + rr() * 30, 80 + rr() * 40, rr() * TAU, 3);
      g.restore();
      cluster(g, cx - 16, cy + R - 8, 1.8, PI / 2 + 0.3, rr, 0.3);
    } });
    return objs;
  }

  /* =========================================================================================
     PARALLAX — NEAR (f 0.45): the ceiling band (concourse, corridors, ward) · pillars and travellers ·
     the light-well's near rails · the choir terraces of the atrium · hull trusses · the nave's pews
     ========================================================================================= */
  function ceilingBand(g, a, b, kind, rr) {
    const bot = kind === 'hall' ? -455 : kind === 'corr' ? -430 : -440;
    const base = kind === 'ward' ? '#161c38' : '#232b4c', coffer = kind === 'ward' ? '#0e1328' : '#161c38';
    rect(g, a, -1200, b - a, 1200 + bot, base);
    if (kind === 'hall') {
      for (let x = Math.floor(a / 160) * 160; x < b; x += 160) {
        const cx = x + 80, cy = bot - 90;
        poly(g, [[cx - 54, cy], [cx - 27, cy - 46], [cx + 27, cy - 46], [cx + 54, cy], [cx + 27, cy + 46], [cx - 27, cy + 46]]);
        g.fillStyle = coffer; g.fill(); ink(g, 3);
        const lit2 = rr() < 0.82;
        poly(g, [[cx - 40, cy], [cx - 20, cy - 34], [cx + 20, cy - 34], [cx + 40, cy], [cx + 20, cy + 34], [cx - 20, cy + 34]]);
        g.fillStyle = lit2 ? '#dff6ff' : '#3a4466'; g.fill();
        if (lit2) glow(g, cx, cy + 20, 90, '#bff0ff', 0.25);
      }
    } else if (kind === 'corr') {
      for (let x = Math.floor(a / 140) * 140; x < b; x += 140) {
        rect(g, x + 10, bot - 70, 120, 56, INK); rect(g, x + 13, bot - 67, 114, 50, coffer);
        if (rr() < 0.85) strip(g, x + 22, bot - 46, 96, 6, '#e6f8ff', 0.5, 30);
        else rect(g, x + 22, bot - 46, 96, 6, '#3a4466');
      }
      // ducts
      rect(g, a, bot - 130, b - a, 26, INK); rect(g, a, bot - 128, b - a, 22, '#3a4670'); rect(g, a, bot - 128, b - a, 4, '#7d8fc0');
      for (let x = Math.floor(a / 96) * 96; x < b; x += 96) rect(g, x, bot - 130, 4, 26, rgba(INK, 0.6));
    } else {
      for (let x = Math.floor(a / 200) * 200; x < b; x += 200) {
        rect(g, x + 30, bot - 60, 140, 40, INK); rect(g, x + 33, bot - 57, 134, 34, coffer);
        if (rr() < 0.5) strip(g, x + 50, bot - 42, 100, 4, '#7dffe0', 0.3, 22); else rect(g, x + 50, bot - 42, 100, 4, '#2a3a50');
      }
      for (let i = 0; i < 3; i++) vein(g, rr, a + rr() * (b - a), bot - 10, 120 + rr() * 140, (rr() < 0.5 ? 0 : PI) + (rr() - 0.5) * 0.5, 2.2);
    }
    rect(g, a, bot - 6, b - a, 8, INK); rect(g, a, bot - 4, b - a, 3, '#9fb6e0');
  }
  function genNear() {
    const f = 0.45, objs = [];
    const z = (wx) => wx * f;
    // ceilings
    for (const [xa, xb, kind] of [[-900, z(2420), 'hall'], [z(2380), z(5240), 'corr']]) {
      objs.push(...chunks(xa, xb, 512, -1200, 800, (g, a, b) => ceilingBand(g, a, b, kind, U.mulberry32(Math.floor(a) + kind.length * 97))));
    }
    // ---- Z1: pillars, hanging signs, groups of frozen travellers
    for (let x = -860; x < z(2420); x += 300) {
      const px = x;
      objs.push({ x: px - 50, y: -470, w: 100, h: 1200, draw(g) {
        const C = { body: '#3a466e', dark: '#232b4c', lit: '#7f93c4' };
        rect(g, px - 24, -470, 48, 1200, INK); rect(g, px - 22, -470, 44, 1200, C.body); rect(g, px - 22, -470, 12, 1200, C.dark); rect(g, px + 16, -470, 6, 1200, C.lit);
        // capital flaring into the ceiling
        poly(g, [[px - 22, -440], [px - 44, -462], [px + 44, -462], [px + 22, -440]]); g.fillStyle = C.body; g.fill(); ink(g, 2.5);
        strip(g, px - 2, -430, 4, 1100, '#7ff6ff', 0.45, 18);
      } });
    }
    const signs = [[60, '入境大廳', 'ARRIVALS'], [820, '居住環 C 區 →', 'HABITAT RING C']];
    for (const [sx, zh, en] of signs) objs.push({ x: sx - 110, y: -470, w: 220, h: 200, draw(g) {
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(sx - 70, -470); g.lineTo(sx - 70, -340); g.moveTo(sx + 70, -470); g.lineTo(sx + 70, -340); g.stroke();
      rect(g, sx - 100, -344, 200, 58, INK); rect(g, sx - 97, -341, 194, 52, '#1c2546'); rect(g, sx - 97, -341, 194, 3, '#7f93c4');
      stencil(g, zh, sx, -322, 19, '#dff6ff', { ink: false }); stencil(g, en, sx, -301, 10, '#7ff6ff', { ink: false, weight: 700, font: EN_FONT });
    } });
    {
      const rng = U.mulberry32(6201);
      for (let x = -820; x < z(2300); x += 120 + rng() * 160) {
        const gx = x, n = 2 + Math.floor(rng() * 4), r2 = rng() * 1e6;
        objs.push({ x: gx - 60, y: -160, w: 60 + n * 34 + 60, h: 200, draw(g) {
          const rr = U.mulberry32(r2 | 0);
          for (let i = 0; i < n; i++) {
            const kids = rr() < 0.25, poses = ['walk', 'stand', 'carry', 'wave', 'hold', 'lookup'], pk = kids ? 'run' : poses[Math.floor(rr() * poses.length)];
            figSil(g, gx + i * 32 + rr() * 10, 4, kids ? 0.4 : 0.6, rr() < 0.6 ? 1 : -1, pk, mixH(mixH('#a9b6d4', CLOTH[Math.floor(rr() * CLOTH.length)], 0.22), '#34406a', 0.42), 'rgba(190,232,255,0.4)', { child: kids, inkW: 3, ink: '#10152c' });
            if (!kids && rr() < 0.4) { const bx = gx + i * 32 + 14; rect(g, bx - 1, -24, 18, 24, '#10152c'); rect(g, bx, -23, 16, 22, '#4a4a72'); }
          }
        } });
      }
    }
    // ---- Z2: the light-well's near rails (seen through the corridor's window band)
    objs.push(...chunks(z(2380), z(5240), 256, -520, 360, (g, a, b) => {
      const rr = U.mulberry32(Math.floor(a) * 13 + 1);
      for (const fy of [-300, -400]) {
        rect(g, a, fy - 2, b - a, 12, INK); rect(g, a, fy, b - a, 8, '#5a6a96'); rect(g, a, fy, b - a, 2, '#c8d8ff');
        g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); for (let x = Math.floor(a / 16) * 16; x < b; x += 16) { g.moveTo(x, fy); g.lineTo(x, fy - 26); } g.moveTo(a, fy - 26); g.lineTo(b, fy - 26); g.stroke();
        for (let x = Math.floor(a / 150) * 150 + 40; x < b; x += 150) {
          const r = rr();
          if (r < 0.45) figSil(g, x, fy, 0.55, rr() < 0.5 ? 1 : -1, ['stand', 'lookup', 'wave', 'hug'][Math.floor(rr() * 4)], '#c4d0ea', 'rgba(255,255,255,0.7)', { inkW: 3 });
          else if (r < 0.75) { g.fillStyle = INK; g.beginPath(); g.arc(x, fy - 14, 15, 0, TAU); g.fill(); g.fillStyle = '#3f7a5a'; g.beginPath(); g.arc(x, fy - 14, 13, 0, TAU); g.fill(); g.fillStyle = '#86c47e'; g.beginPath(); g.arc(x + 4, fy - 19, 6, 0, TAU); g.fill(); rect(g, x - 11, fy - 8, 22, 8, '#b0866a'); }
        }
      }
      // laundry across the well
      g.strokeStyle = rgba('#dfe8ff', 0.8); g.lineWidth = 1; g.beginPath(); g.moveTo(a, -470); g.quadraticCurveTo((a + b) / 2, -440, b, -470); g.stroke();
      for (let x = a + 20; x < b - 10; x += 40) { const sag = -470 + 30 * Math.sin(PI * (x - a) / (b - a)) * 0.95; g.save(); g.translate(x, sag + 1); g.rotate(0.12 + rr() * 0.2); rect(g, -8, 0, 16, 20, INK); rect(g, -7, 1, 14, 18, ['#f2f2f2', '#e8c0c8', '#bcd2f0', '#f0dca0'][Math.floor(rr() * 4)]); g.restore(); }
    }));
    // ---- Z3: the choir terraces — the congregation of the morning hymn, frozen tier upon tier
    objs.push(...chunks(z(5120), z(8200), 256, -620, 1400, (g, a, b) => {
      const rr = U.mulberry32(Math.floor(a) * 17 + 9);
      const wg = g.createLinearGradient(0, -470, 0, -100); wg.addColorStop(0, '#1e2a48'); wg.addColorStop(1, '#34446a');
      g.fillStyle = wg; g.fillRect(a, -470, b - a, 380);
      rect(g, a, -474, b - a, 6, '#0f1630'); rect(g, a, -470, b - a, 2, '#8fa0cc');
      for (let k = 3; k >= 0; k--) {
        const ty = -150 - k * 86, haze = 0.16 + k * 0.13, s = 0.6 - k * 0.05;
        const inkH = mixH(INK, '#3a4470', haze * 0.6), ledge = mixH('#eef1f7', '#6f80aa', haze), ledgeD = mixH('#8794bc', '#2c3a62', haze);
        // the step face below this tier
        rect(g, a, ty, b - a, 90, mixH('#4a5a82', '#26324e', haze * 0.7)); rect(g, a, ty + 8, b - a, 2, mixH('#9fb0d8', '#26324e', haze));
        // singers, staggered and packed shoulder to shoulder
        const step = 21 * s / 0.6;
        for (let x = Math.floor(a / step) * step + (k % 2) * step * 0.5 - step; x < b + step; x += step) {
          if (rr() < 0.05) continue;
          singer(g, x + (rr() - 0.5) * 3, ty, s * (0.94 + rr() * 0.1), choirC(rr, haze));
        }
        // the loft rail in front of their robes
        g.strokeStyle = inkH; g.lineWidth = 2.4; g.beginPath(); for (let x = Math.floor(a / 16) * 16; x < b; x += 16) { g.moveTo(x, ty); g.lineTo(x, ty - 14); } g.moveTo(a, ty - 14); g.lineTo(b, ty - 14); g.stroke();
        g.strokeStyle = ledge; g.lineWidth = 1; g.beginPath(); g.moveTo(a, ty - 15); g.lineTo(b, ty - 15); g.stroke();
        rect(g, a, ty - 2, b - a, 10, inkH); rect(g, a, ty, b - a, 6, ledge); rect(g, a, ty, b - a, 1.6, mixH('#ffffff', '#8f9cc4', haze)); rect(g, a, ty + 6, b - a, 2, ledgeD);
        // ivy and flowers spilling down the step face
        for (let x = Math.floor(a / 64) * 64; x < b; x += 64) if (rr() < 0.42) {
          const gx = x + rr() * 36, leaf = mixH('#2f6b4f', '#2c3a62', haze), leafL = mixH('#7fbf7a', '#3a4a72', haze);
          g.fillStyle = inkH; g.beginPath(); g.ellipse(gx, ty + 14, 17, 9, 0, 0, TAU); g.fill();
          g.fillStyle = leaf; g.beginPath(); g.ellipse(gx, ty + 14, 15, 7.5, 0, 0, TAU); g.fill();
          g.fillStyle = leafL; g.beginPath(); g.ellipse(gx + 4, ty + 11, 6.5, 3.4, 0, 0, TAU); g.fill();
          g.strokeStyle = leaf; g.lineWidth = 1.8; g.beginPath(); for (let v = 0; v < 3; v++) { g.moveTo(gx - 9 + v * 9, ty + 20); g.quadraticCurveTo(gx - 11 + v * 9, ty + 38, gx - 7 + v * 8, ty + 48 + rr() * 26); } g.stroke();
          if (rr() < 0.65) { g.fillStyle = mixH(['#ffffff', '#ffe2ea', '#fff2c4'][Math.floor(rr() * 3)], '#8f9cc4', haze); for (let q = 0; q < 6; q++) { g.beginPath(); g.arc(gx - 12 + rr() * 24, ty + 8 + rr() * 12, 1.8, 0, TAU); g.fill(); } }
        }
        if (k >= 1) for (let x = Math.floor(a / 420) * 420 + 150; x < b + 30; x += 420) {
          if (((x / 420) | 0) % 3 !== k - 1) continue;
          const cl = mixH('#f2ecda', '#6f80aa', haze), sh = mixH('#b8ad90', '#3a4a72', haze);
          g.beginPath(); g.moveTo(x - 16, ty + 6); g.lineTo(x + 16, ty + 6); g.lineTo(x + 16, ty + 74); g.lineTo(x, ty + 86); g.lineTo(x - 16, ty + 74); g.closePath();
          g.fillStyle = cl; g.fill(); ink(g, 2, inkH); rect(g, x - 16, ty + 6, 6, 68, sh);
          g.beginPath(); g.arc(x, ty + 32, 8, 0, TAU); g.strokeStyle = mixH(M.gold, '#6f80aa', haze); g.lineWidth = 1.6; g.stroke();
          g.beginPath(); for (const dx of [-3, 0, 3]) { g.moveTo(x + dx, ty + 27); g.lineTo(x + dx, ty + 37); } g.stroke();
          stencil(g, '晨禱', x, ty + 56, 9, mixH('#7a2c3a', '#6f80aa', haze), { ink: false, weight: 900 });
        }
      }
      // the garden wall under the lowest tier: arches hung with ivy
      rect(g, a, -60, b - a, 900, '#26344e');
      for (let x = Math.floor(a / 120) * 120; x < b; x += 120) { g.beginPath(); g.moveTo(x + 14, 400); g.lineTo(x + 14, -14); g.arc(x + 60, -14, 46, PI, 0); g.lineTo(x + 106, 400); g.fillStyle = '#18233a'; g.fill(); ink(g, 2.5); g.strokeStyle = '#3a4c6e'; g.lineWidth = 1.2; g.stroke(); }
    }));
    // three great magnolias in the atrium (behind the gameplay plane's own)
    for (const [wxT, s] of [[5420, 1.0], [6960, 1.15], [7980, 0.95]]) {
      const tx = z(wxT), r2 = wxT * 13;
      objs.push({ x: tx - 170 * s, y: -470, w: 340 * s, h: 1200, draw(g) { tree(g, U.mulberry32(r2), tx, 30, s * 1.05, 0.32, 400, true); } });
    }
    // frozen birds in mid-flight above the atrium
    {
      const rng = U.mulberry32(6305);
      for (let i = 0; i < 26; i++) {
        const bx = z(5300) + rng() * (z(8100) - z(5300)), by = -440 + rng() * 200, s = 0.6 + rng() * 0.6, fl = rng() < 0.5 ? 1 : -1, ph = rng();
        objs.push({ x: bx - 20, y: by - 20, w: 40, h: 40, draw(g) { bird(g, bx, by, s, fl, ph); } });
      }
    }
    // ---- Z4: outside the ward: hull struts and the Hush on the ship's skin (sparse: let space through)
    objs.push(...chunks(z(8280), z(10820), 256, -520, 1260, (g, a, b) => {
      const rr = U.mulberry32(Math.floor(a) * 19 + 4);
      for (let x = Math.floor(a / 380) * 380 + 60; x < b; x += 380) {
        rect(g, x - 2, -520, 34, 1300, INK); rect(g, x, -520, 30, 1300, '#232b4c'); rect(g, x + 24, -520, 6, 1300, '#5a6fa8');
        for (let y = -480; y < 200; y += 90) { g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(x + 30, y); g.lineTo(x + 130, y + 70); g.stroke(); g.strokeStyle = '#2d3860'; g.lineWidth = 3; g.stroke(); }
        if (rr() < 0.7) cluster(g, x + 30, -120 + rr() * 200, 1.4, rr() * 0.6 - 0.3, rr, 0.3);
        glow(g, x + 15, -500, 14, '#ff5a6e', 0.5);
      }
    }));
    // ---- Z5: the nave — white glass vault ribs on black, pews of the frozen congregation, hanging lamps, crimson outcrops
    objs.push(...chunks(z(10820), z(13700), 256, -1100, 1900, (g, a, b) => {
      const rr = U.mulberry32(Math.floor(a) * 23 + 2), C = { body: '#a9a3c8', lit: '#eeeaf8', dark: '#625b84' };
      for (let x = Math.floor(a / 320) * 320; x < b + 320; x += 320) {
        for (const sd of [1, -1]) {
          g.beginPath(); g.moveTo(x - 18 * sd, -380); g.quadraticCurveTo(x - 16 * sd, -700, x + 160 * sd, -900); g.lineTo(x + 160 * sd, -872); g.quadraticCurveTo(x + 4 * sd, -690, x + 18 * sd, -380); g.closePath();
          g.fillStyle = sd > 0 ? C.body : C.dark; g.fill(); ink(g, 2.6);
        }
        rect(g, x - 20, -380, 40, 1080, INK); rect(g, x - 18, -380, 36, 1080, C.body); rect(g, x - 18, -380, 11, 1080, C.dark); rect(g, x + 10, -380, 8, 1080, C.lit);
        strip(g, x - 1.2, -360, 2.4, 340, '#ffd2e0', 0.3, 12);
        rect(g, x - 26, -394, 52, 14, INK); rect(g, x - 24, -392, 48, 10, C.lit); rect(g, x - 24, -384, 48, 2, C.dark);
        if (rr() < 0.7) { const lx = x + 160, ly = -360 - rr() * 70; g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(lx, -880); g.lineTo(lx, ly); g.stroke(); g.beginPath(); g.moveTo(lx - 11, ly); g.lineTo(lx + 11, ly); g.lineTo(lx + 6, ly + 20); g.lineTo(lx - 6, ly + 20); g.closePath(); g.fillStyle = '#fff6e8'; g.fill(); ink(g, 1.4); glow(g, lx, ly + 12, 70, '#ffe2c0', 0.28); }
      }
      // pews: the congregation seated mid-hymn, hymnals open
      for (let x = Math.floor(a / 176) * 176; x < b; x += 176) {
        for (let i = 0; i < 5; i++) if (rr() < 0.85) singer(g, x + 24 + i * 29, -2, 0.52, choirC(rr, 0.22), true);
        rect(g, x + 4, -26, 160, 28, INK); rect(g, x + 6, -24, 156, 24, '#3a3256'); rect(g, x + 6, -24, 156, 3, '#a89dd0'); rect(g, x + 6, -7, 156, 7, '#241e3a');
        rect(g, x + 3, -32, 7, 38, INK); rect(g, x + 158, -32, 7, 38, INK);
      }
      if (rr() < 0.6) cluster(g, a + rr() * (b - a), 4, 1.4 + rr() * 0.6, -PI / 2 + (rr() - 0.5) * 0.6, rr, 0.16);
      if (rr() < 0.6) vein(g, rr, a + rr() * (b - a), -380 - rr() * 300, 220, PI / 2 + (rr() - 0.5), 2.4);
    }));
    return objs;
  }

  /* ---------- small painters shared by near layer + props ---------- */
  // a garden tree: inked trunk and limbs, a wide scalloped canopy in three hard cel tones (shade low-left, light high-right).
  // bloom = the atrium's white magnolias; otherwise green. Petals / leaves hang frozen in the air beneath.
  function tree(g, rng, x, base, s, haze = 0, root = 0, bloom = true) {
    const P0 = bloom ? { core: '#76668c', dark: '#b4a2c4', mid: '#e8dce8', lit: '#fff8f2', acc: '#ffc2d2', leaf: '#5f9a6a' }
      : { core: '#173a34', dark: '#265446', mid: '#3f7a56', lit: '#86c27a', acc: '#d8f0a0', leaf: '#2f6b4a' };
    const C = {}; for (const k in P0) C[k] = mixH(P0[k], '#34446c', haze);
    const inkT = haze > 0.25 ? mixH(INK, '#34446c', 0.45) : INK;
    const bark = mixH('#3e2c38', '#26304f', haze), barkL = mixH('#9a7a6a', '#4a5a80', haze), h = 300 * s;
    g.beginPath();
    g.moveTo(x - 11 * s, base + root); g.quadraticCurveTo(x - 15 * s, base - h * 0.3, x - 6 * s, base - h * 0.52);
    g.quadraticCurveTo(x - 40 * s, base - h * 0.64, x - 88 * s, base - h * 0.7); g.lineTo(x - 84 * s, base - h * 0.75);
    g.quadraticCurveTo(x - 34 * s, base - h * 0.71, x - 2 * s, base - h * 0.63); g.lineTo(x + 1 * s, base - h * 0.84);
    g.lineTo(x + 9 * s, base - h * 0.82); g.quadraticCurveTo(x + 8 * s, base - h * 0.7, x + 14 * s, base - h * 0.63);
    g.quadraticCurveTo(x + 50 * s, base - h * 0.71, x + 94 * s, base - h * 0.69); g.lineTo(x + 96 * s, base - h * 0.64);
    g.quadraticCurveTo(x + 46 * s, base - h * 0.59, x + 12 * s, base - h * 0.5); g.quadraticCurveTo(x + 17 * s, base - h * 0.3, x + 13 * s, base + root); g.closePath();
    g.fillStyle = bark; g.fill(); ink(g, 2.6 * Math.min(1.2, s), inkT);
    g.strokeStyle = barkL; g.lineWidth = 2.2 * s; g.beginPath(); g.moveTo(x + 9 * s, base + Math.min(root, 0) - 3); g.quadraticCurveTo(x + 12 * s, base - h * 0.3, x + 6 * s, base - h * 0.5); g.stroke();
    const puffs = [];
    const lobes = [[-92, 0.73, 44], [-44, 0.89, 58], [10, 0.99, 66], [62, 0.9, 56], [104, 0.75, 42], [-8, 0.8, 52], [42, 0.78, 50]];
    for (const [dx, hy, r] of lobes) {
      const cx = x + dx * s, cy = base - h * hy, R = r * s * (0.9 + rng() * 0.2);
      puffs.push({ x: cx, y: cy, r: R });
      const n = 7 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rng() * 0.4; puffs.push({ x: cx + Math.cos(a) * R * 0.86, y: cy + Math.sin(a) * R * 0.64, r: R * (0.26 + rng() * 0.14) }); }
    }
    const shape = (dx, dy, k) => { g.beginPath(); for (const p of puffs) { g.moveTo(p.x + dx + p.r * k, p.y + dy); g.arc(p.x + dx, p.y + dy, p.r * k, 0, TAU); } };
    shape(0, 0, 1); g.strokeStyle = inkT; g.lineWidth = 4.4 * Math.min(1.2, s); g.lineJoin = 'round'; g.stroke(); g.fillStyle = C.core; g.fill();
    g.save(); shape(0, 0, 1); g.clip();
    shape(5 * s, -7 * s, 0.9); g.fillStyle = C.dark; g.fill();
    shape(11 * s, -15 * s, 0.74); g.fillStyle = C.mid; g.fill();
    shape(17 * s, -24 * s, 0.46); g.fillStyle = C.lit; g.fill();
    for (let i = 0; i < 50; i++) {
      const p = puffs[Math.floor(rng() * puffs.length)], fx = p.x + (rng() - 0.4) * p.r, fy = p.y - rng() * p.r * 0.7;
      if (bloom) { g.fillStyle = rng() < 0.5 ? C.acc : C.lit; g.beginPath(); g.arc(fx, fy, 2.2 * s + 0.6, 0, TAU); g.fill(); }
      else { g.fillStyle = C.lit; g.beginPath(); g.ellipse(fx, fy, 3 * s, 1.5 * s, rng() * 3, 0, TAU); g.fill(); }
    }
    if (bloom) for (let i = 0; i < 16; i++) { const p = puffs[Math.floor(rng() * puffs.length)]; g.fillStyle = C.leaf; g.beginPath(); g.ellipse(p.x + (rng() - 0.5) * p.r, p.y + rng() * p.r * 0.5, 4.2 * s, 2 * s, rng() * 3, 0, TAU); g.fill(); }
    g.restore();
    for (let i = 0; i < 10; i++) {
      const lx = x + (rng() - 0.5) * 230 * s, ly = base - h * (0.1 + rng() * 0.5);
      g.save(); g.translate(lx, ly); g.rotate(rng() * TAU); g.beginPath(); g.ellipse(0, 0, 3.6 * s + 0.8, 2 * s + 0.5, 0, 0, TAU);
      g.fillStyle = bloom ? (rng() < 0.4 ? C.acc : C.lit) : C.lit; g.fill(); g.lineWidth = 0.8; g.strokeStyle = inkT; g.stroke(); g.restore();
    }
  }
  function bird(g, x, y, s, fl, ph) {
    g.save(); g.translate(x, y); g.scale(fl * s, s);
    const up = ph < 0.5;
    g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(0, -4, 12, -1); g.quadraticCurveTo(4, 4, -12, 0); g.closePath();
    g.fillStyle = '#eef3fa'; g.fill(); ink(g, 1.4);
    g.beginPath(); g.moveTo(-2, -1); g.quadraticCurveTo(-8, up ? -20 : 10, -22, up ? -24 : 14); g.quadraticCurveTo(-8, up ? -10 : 6, 4, 0); g.closePath();
    g.fillStyle = '#d4dceb'; g.fill(); ink(g, 1.2);
    g.fillStyle = '#ffb35c'; g.fillRect(11, -2, 3, 1.6);
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-10, -1.5); g.quadraticCurveTo(0, -4.5, 10, -2); g.stroke();
    g.restore();
  }

  /* =========================================================================================
     GAMEPLAY PLANE — floors per zone (polished enamel · wayfinding lines · garden beds · frosted
     ward tiles · black glass inlaid with gold staff lines) over a lit service level
     ========================================================================================= */
  const ZONE_SPANS = [[-900, ZX[1]], [ZX[1], ZX[2]], [ZX[2], ZX[3]], [ZX[3], ZX[4]], [ZX[4], 14100]];
  function floorStyle(z) { return ['hall', 'corr', 'garden', 'ward', 'core'][z]; }
  function serviceLevel(g, a, b, top, z, rr) {
    const deep = ['#141a33', '#151a30', '#12201f', '#0f1430', '#0d0812'][z], pipe = ['#3a4670', '#3d4468', '#2f4a48', '#2c3660', '#2a1f3c'][z], pipeL = ['#8ea6dc', '#9aa4cc', '#7fb8a8', '#6f86c0', '#b88ab8'][z];
    const sg = g.createLinearGradient(0, top + 40, 0, top + 420); sg.addColorStop(0, mixH(deep, '#3a4670', 0.25)); sg.addColorStop(1, '#05060c');
    g.fillStyle = sg; g.fillRect(a, top + 40, b - a, 700);
    // pipes
    for (const [py, pw] of [[top + 74, 12], [top + 96, 7], [top + 140, 16]]) {
      rect(g, a, py - 1.5, b - a, pw + 3, INK); rect(g, a, py, b - a, pw, pipe); rect(g, a, py + 1, b - a, Math.max(1.2, pw * 0.2), pipeL);
      for (let x = Math.floor(a / 220) * 220 + (py % 70); x < b; x += 220) { rect(g, x, py - 3, 10, pw + 6, INK); rect(g, x + 2, py - 2, 6, pw + 4, pipeL); }
    }
    // ribs
    for (let x = Math.floor(a / 256) * 256 + 40; x < b; x += 256) { rect(g, x - 2, top + 44, 28, 420, INK); rect(g, x, top + 44, 24, 420, mixH(pipe, deep, 0.4)); rect(g, x + 18, top + 44, 4, 420, rgba(pipeL, 0.5)); }
    // status lights
    for (let x = Math.floor(a / 74) * 74 + 30; x < b; x += 74) if (rr() < 0.5) { g.fillStyle = rr() < 0.7 ? 'rgba(127,246,255,0.9)' : rr() < 0.5 ? 'rgba(255,190,110,0.9)' : 'rgba(255,60,100,0.9)'; g.fillRect(x, top + 118, 3, 3); }
    // the Hush in the service level (thicker towards the Core)
    const nv = [0.2, 0.35, 0.3, 0.8, 1.3][z] * (b - a) / 512;
    for (let i = 0; i < nv; i++) if (rr() < nv - i) vein(g, rr, a + rr() * (b - a), top + 52 + rr() * 30, 90 + rr() * 120, (rr() < 0.5 ? 0 : PI) + (rr() - 0.5) * 0.8, 2 + rr() * 1.5);
  }
  function floorTop(g, a, b, top, z, rr) {
    const st = floorStyle(z);
    if (st === 'hall' || st === 'corr') {
      const base = st === 'hall' ? '#e4ebf4' : '#e2e5ee', seam = st === 'hall' ? '#9aa6c2' : '#a3a6bc';
      rect(g, a, top - 1.8, b - a, 2.4, INK);
      rect(g, a, top, b - a, 18, base); rect(g, a, top, b - a, 2.2, '#ffffff');
      rect(g, a, top + 13, b - a, 5, mixH(base, '#8a96b8', 0.5));
      for (let x = Math.floor(a / 96) * 96; x < b; x += 96) { rect(g, x, top + 2, 1.4, 11, seam); rect(g, x + 1.4, top + 2, 1, 11, '#ffffff'); }
      if (st === 'hall') { strip(g, a, top + 8, b - a, 1.4, '#7ff6ff', 0.4, 6); }
      else {
        // wayfinding lines: follow the cyan to the atrium, amber to the ward, rose to the Core
        rect(g, a, top + 5, b - a, 1.6, '#4fd8ec'); rect(g, a, top + 8, b - a, 1.6, '#f2b45a'); rect(g, a, top + 11, b - a, 1.6, '#f0708e');
        for (let x = Math.floor(a / 640) * 640 + 300; x < b; x += 640) { g.fillStyle = '#4fd8ec'; poly(g, [[x, top + 3], [x + 14, top + 6], [x, top + 9]]); g.fill(); }
      }
      // reflections of the lights in the polish
      for (let x = Math.floor(a / 230) * 230 + 60; x < b; x += 230) { const rg = g.createLinearGradient(0, top, 0, top + 16); rg.addColorStop(0, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(x, top + 2, 26, 14); }
      // edge band with a recessed light
      rect(g, a, top + 18, b - a, 2, INK); rect(g, a, top + 20, b - a, 22, st === 'hall' ? '#7d8ab0' : '#7f84a6'); rect(g, a, top + 20, b - a, 2, '#c8d4ee');
      strip(g, a, top + 29, b - a, 2.2, '#7ff6ff', 0.55, 10);
      rect(g, a, top + 42, b - a, 2, INK);
      g.fillStyle = rgba(INK, 0.55); for (let x = Math.floor(a / 48) * 48 + 12; x < b; x += 48) { g.fillRect(x, top + 23, 2, 2); g.fillRect(x, top + 37, 2, 2); }
    } else if (st === 'garden') {
      // a lawn edge over a white enamel planter trough with a gold trim; grass, clover and frozen flowers
      rect(g, a, top - 1.8, b - a, 2.4, INK);
      rect(g, a, top, b - a, 12, '#3a744c'); rect(g, a, top, b - a, 3, '#74b862'); rect(g, a, top + 9, b - a, 3, '#2a5a40');
      rect(g, a, top + 12, b - a, 2, INK);
      rect(g, a, top + 14, b - a, 28, '#e6e3d8'); rect(g, a, top + 14, b - a, 3, '#ffffff'); rect(g, a, top + 35, b - a, 7, '#aaa392');
      rect(g, a, top + 19, b - a, 1.4, M.gold);
      for (let x = Math.floor(a / 64) * 64 + 20; x < b; x += 64) { rect(g, x, top + 24, 24, 8, '#8f8878'); rect(g, x + 1, top + 25, 22, 2, '#5f594c'); }
      strip(g, a, top + 39, b - a, 1.2, '#ffe2a0', 0.35, 6);
      rect(g, a, top + 42, b - a, 2, INK);
      for (let x = Math.floor(a / 150) * 150 + 40; x < b; x += 150) if (rr() < 0.6) { g.fillStyle = '#3f7a4e'; g.beginPath(); g.moveTo(x, top + 12); g.quadraticCurveTo(x + 6, top + 24, x + 2, top + 30 + rr() * 8); g.lineTo(x + 7, top + 12); g.fill(); g.strokeStyle = rgba(INK, 0.7); g.lineWidth = 0.8; g.stroke(); }
      for (let x = a; x < b; x += 4 + rr() * 6) {
        const h = 5 + rr() * 9, lean = (rr() - 0.4) * 5;
        g.beginPath(); g.moveTo(x - 1.6, top + 1); g.quadraticCurveTo(x + lean * 0.4, top - h * 0.6, x + lean, top - h); g.lineTo(x + 1.6, top + 1); g.closePath();
        g.fillStyle = rr() < 0.5 ? '#5aa65a' : '#3f8a4e'; g.fill(); g.strokeStyle = rgba(INK, 0.8); g.lineWidth = 0.7; g.stroke();
        if (rr() < 0.05) { g.fillStyle = INK; g.beginPath(); g.arc(x + lean, top - h - 2, 3.4, 0, TAU); g.fill(); g.fillStyle = ['#fff4f8', '#fff3a8', '#ffffff', '#ffd2dc'][Math.floor(rr() * 4)]; g.beginPath(); g.arc(x + lean, top - h - 2, 2.4, 0, TAU); g.fill(); }
      }
    } else if (st === 'ward') {
      const base = '#b9c4da';
      rect(g, a, top - 1.8, b - a, 2.4, INK);
      rect(g, a, top, b - a, 18, base); rect(g, a, top, b - a, 2, '#e8f0ff'); rect(g, a, top + 13, b - a, 5, '#7f8cae');
      for (let x = Math.floor(a / 72) * 72; x < b; x += 72) rect(g, x, top + 2, 1.4, 11, '#8a96b6');
      for (let i = 0; i < (b - a) / 90; i++) { const x = a + rr() * (b - a); g.fillStyle = 'rgba(240,250,255,0.55)'; g.beginPath(); g.ellipse(x, top + 4, 14 + rr() * 30, 2.4, 0, 0, TAU); g.fill(); }
      rect(g, a, top + 18, b - a, 2, INK); rect(g, a, top + 20, b - a, 22, '#4a557a'); strip(g, a, top + 29, b - a, 2, '#7dffcf', 0.35, 10); rect(g, a, top + 42, b - a, 2, INK);
    } else {
      // the Core: black glass inlaid with five gold staff lines
      rect(g, a, top - 2, b - a, 2.6, '#fff0f4');
      rect(g, a, top + 0.6, b - a, 20, '#130d1c');
      for (let i = 0; i < 5; i++) rect(g, a, top + 3 + i * 3.4, b - a, 0.9, rgba('#e8c27a', 0.75 - i * 0.08));
      for (let x = Math.floor(a / 520) * 520 + 140; x < b; x += 520) { g.beginPath(); g.arc(x, top + 13, 7, PI, TAU); g.strokeStyle = rgba('#ffd9a0', 0.8); g.lineWidth = 1.6; g.stroke(); g.fillStyle = rgba('#ffd9a0', 0.85); g.fillRect(x - 1.3, top + 9.5, 2.6, 2.6); }
      const rg = g.createLinearGradient(0, top, 0, top + 20); rg.addColorStop(0, 'rgba(255,170,200,0.22)'); rg.addColorStop(1, 'rgba(255,170,200,0)'); g.fillStyle = rg; g.fillRect(a, top, b - a, 20);
      rect(g, a, top + 20, b - a, 2, INK); rect(g, a, top + 22, b - a, 20, '#2a2440'); rect(g, a, top + 22, b - a, 2, '#d9cfee'); strip(g, a, top + 31, b - a, 2, '#ff8fb0', 0.45, 10); rect(g, a, top + 42, b - a, 2, INK);
      for (let i = 0; i < (b - a) / 300; i++) if (rr() < 0.45) cluster(g, a + rr() * (b - a), top + 22, 0.8 + rr() * 0.5, -PI / 2 + (rr() - 0.5) * 0.8, rr, 0.1);
    }
  }
  function paintFloor(s) {
    const out = [];
    for (let zi = 0; zi < ZONE_SPANS.length; zi++) {
      const za = Math.max(ZONE_SPANS[zi][0], s.x), zb = Math.min(ZONE_SPANS[zi][1], s.x + s.w);
      if (zb <= za) continue;
      const zz = zi;
      out.push(...chunks(za, zb, 512, s.y - 30, 760, (g, a, b) => {
        const rr = U.mulberry32(Math.floor(a) * 7 + 3 + zz);
        serviceLevel(g, a, b, s.y, zz, rr);
        floorTop(g, a, b, s.y, zz, rr);
      }));
    }
    return out;
  }
  // the atrium balcony: an enamel parapet face with relief panels, raised above the garden
  function paintBalcony(s) {
    return [{ x: s.x - 20, y: s.y - 70, w: s.w + 40, h: 800, draw(g) {
      const x = s.x, y = s.y, w = s.w, C = enamelC(x);
      serviceLevel(g, x, x + w, 0, 2, U.mulberry32(52));
      floorTop(g, x - 4, x + w + 4, 0, 2, U.mulberry32(53));
      // parapet face
      rect(g, x - 2, y - 2, w + 4, -y + 4, INK); rect(g, x, y, w, -y, C.body);
      rect(g, x, y, w, 3, C.lit); rect(g, x, y + 16, w, 3, C.dark);
      for (let px = x + 20; px < x + w - 40; px += 96) {
        rect(g, px, y + 30, 76, -y - 46, C.dark); rect(g, px + 3, y + 33, 70, -y - 52, mixH(C.body, C.lit, 0.3));
        g.beginPath(); g.arc(px + 38, y + 65, 16, 0, TAU); g.strokeStyle = M.goldD; g.lineWidth = 2; g.stroke(); g.strokeStyle = M.gold; g.lineWidth = 1; g.stroke();
      }
      rect(g, x, -6, w, 6, C.dark);
      // walking surface on top
      rect(g, x - 1, y - 1.8, w + 2, 2.4, INK); rect(g, x, y, w, 14, C.lit); rect(g, x, y + 10, w, 4, C.dark);
      for (let px = x; px < x + w; px += 80) rect(g, px, y + 2, 1.4, 8, '#9aa6c2');
      // balustrade
      g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); for (let px = x + 12; px < x + w; px += 26) { g.moveTo(px, y); g.lineTo(px, y - 46); } g.stroke();
      g.strokeStyle = C.body; g.lineWidth = 2.6; g.stroke();
      rect(g, x - 4, y - 54, w + 8, 10, INK); rect(g, x - 2, y - 52, w + 4, 6, C.lit);
    } }];
  }
  function noPaint() { return []; }

  /* ---------- catwalks / pergolas / trellis steps / lofts (drawn in the props pass so walls sit behind them) ---------- */
  function catwalk(g, p) {
    const x = p.x, y = p.y, w = p.w, C = enamelC(x);
    if (p.k === 'gantry') {
      g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); for (let px = x + 14; px < x + w; px += 120) { g.moveTo(px, y); g.lineTo(px, -620); } g.stroke();
      g.strokeStyle = rgba('#c8d8ff', 0.5); g.lineWidth = 0.8; g.stroke();
      g.strokeStyle = INK; g.lineWidth = 2.2; g.beginPath(); for (let px = x + 6; px < x + w; px += 28) { g.moveTo(px, y); g.lineTo(px, y - 32); } g.moveTo(x + 2, y - 32); g.lineTo(x + w - 2, y - 32); g.moveTo(x + 2, y - 16); g.lineTo(x + w - 2, y - 16); g.stroke();
      g.strokeStyle = C.lit; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 2, y - 33); g.lineTo(x + w - 2, y - 33); g.stroke();
      rect(g, x - 2, y - 2, w + 4, 14, INK); rect(g, x, y, w, 10, C.body); rect(g, x, y, w, 2.4, C.lit); rect(g, x, y + 7, w, 3, C.dark);
      strip(g, x + 4, y + 12, w - 8, 1.6, '#7ff6ff', 0.6, 12);
      g.fillStyle = rgba(INK, 0.6); for (let px = x + 4; px < x + w - 4; px += 9) g.fillRect(px, y + 3.5, 5, 2);
    } else if (p.k === 'pergola' || p.k === 'trellis') {
      if (p.k === 'pergola') for (const px of [x + 10, x + w - 16]) { rect(g, px - 1.5, y, 9, -y, INK); rect(g, px, y, 6, -y, '#efe6d4'); rect(g, px + 4, y, 2, -y, '#a89a7a'); g.strokeStyle = '#2f6b4a'; g.lineWidth = 2; g.beginPath(); for (let yy = y + 10; yy < -6; yy += 16) { g.moveTo(px - 2, yy); g.quadraticCurveTo(px + 9, yy + 8, px - 1, yy + 16); } g.stroke(); }
      // white-and-brass garden walk wound with vines
      rect(g, x - 2, y - 2, w + 4, 12, INK); rect(g, x, y, w, 8, '#efe6d4'); rect(g, x, y, w, 2, '#ffffff'); rect(g, x, y + 6, w, 2, '#a89a7a');
      for (let px = x + 8; px < x + w - 4; px += 22) { rect(g, px - 1, y + 8, 6, 8, INK); rect(g, px, y + 8, 4, 6, M.brass); }
      const rr = U.mulberry32((x | 0) + (y | 0) * 3);
      g.strokeStyle = '#2f6b4a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, y + 4);
      for (let px = x; px <= x + w; px += 14) g.lineTo(px, y + 4 + Math.sin(px * 0.2) * 4); g.stroke();
      for (let px = x + 6; px < x + w; px += 9 + rr() * 8) {
        g.save(); g.translate(px, y + 4 + Math.sin(px * 0.2) * 4); g.rotate(rr() * TAU);
        g.beginPath(); g.ellipse(0, 0, 5, 2.6, 0, 0, TAU); g.fillStyle = rr() < 0.5 ? '#5aa65a' : '#8cc77a'; g.fill(); ink(g, 0.7); g.restore();
        if (rr() < 0.35) { g.fillStyle = INK; g.beginPath(); g.arc(px + 2, y - 2, 3.4, 0, TAU); g.fill(); g.fillStyle = rr() < 0.5 ? '#ff9fb8' : '#fff4c0'; g.beginPath(); g.arc(px + 2, y - 2, 2.5, 0, TAU); g.fill(); }
        if (rr() < 0.3) { g.strokeStyle = '#3f8a4e'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(px, y + 10); g.quadraticCurveTo(px + 4, y + 22, px - 2, y + 30 + rr() * 26); g.stroke(); }
      }
    } else if (p.k === 'ring') {
      // the dome maintenance ring: enamel walkway with a glass parapet onto the stars
      g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); for (let px = x + 10; px < x + w; px += 36) { g.moveTo(px, y); g.lineTo(px, y - 46); } g.moveTo(x, y - 46); g.lineTo(x + w, y - 46); g.stroke();
      g.fillStyle = 'rgba(168,230,255,0.10)'; g.fillRect(x, y - 46, w, 46);
      rect(g, x - 2, y - 2, w + 4, 16, INK); rect(g, x, y, w, 12, '#e8eef6'); rect(g, x, y, w, 2.4, '#ffffff'); rect(g, x, y + 9, w, 3, '#8592b3');
      strip(g, x + 6, y + 14, w - 12, 1.6, '#ffe2a0', 0.6, 14);
      stencil(g, '穹頂維修環　DOME RING 03', x + w / 2, y + 26, 9, 'rgba(230,240,255,0.7)', { ink: false, weight: 700 });
    } else if (p.k === 'loft') {
      g.strokeStyle = INK; g.lineWidth = 2.6; g.beginPath(); for (let px = x + 8; px < x + w; px += 20) { g.moveTo(px, y); g.lineTo(px, y - 30); } g.moveTo(x, y - 30); g.lineTo(x + w, y - 30); g.stroke();
      g.strokeStyle = M.gold; g.lineWidth = 1; g.stroke();
      rect(g, x - 2, y - 2, w + 4, 16, INK); rect(g, x, y, w, 12, '#ece6f4'); rect(g, x, y, w, 2.4, '#ffffff'); rect(g, x, y + 9, w, 3, '#7d7a9e');
      g.beginPath(); g.moveTo(x + 10, y + 14); g.lineTo(x + w / 2, y + 44); g.lineTo(x + w - 10, y + 14); ink(g, 3); g.strokeStyle = '#c9c2e6'; g.lineWidth = 1.4; g.stroke();
      strip(g, x + 4, y + 13, w - 8, 1.4, '#ff8fb0', 0.5, 10);
    }
  }

  /* =========================================================================================
     WORLD PROPS (cached; behind every actor)
     ========================================================================================= */
  const HUSHED_SPOTS = [];
  for (const id in level.encounters) for (const w of level.encounters[id].waves) for (const d of w) if (d.t === 'c6_hushed') HUSHED_SPOTS.push(d.x);

  function genProps() {
    const objs = [];
    const add = (x, y, w, h, draw) => objs.push({ x, y, w, h, draw });
    const S = (x, pose, look, o = {}) => { const yy = o.y || 0; add(x - 80, yy - 175, 160, 190, (g) => statue(g, x, yy, o.s || 0.96, o.face || 1, pose, look, o)); };

    /* ---------------- Z1: THE HOMECOMING CONCOURSE ---------------- */
    // the docking collar: an aperture iris, half-dilated, set into the bulkhead behind the arrival lift
    add(-560, -880, 820, 885, (g) => {
      const cx = -40, cy = -400, R = 214;
      const body = '#9aa8c8', dark = '#5c678f', deep = '#252b4a', lit = '#e2ebfa';
      // bulkhead
      rect(g, -560, -880, 820, 880, '#3e4870');
      for (let x = -560; x < 260; x += 96) { rect(g, x, -880, 2, 880, rgba(INK, 0.55)); rect(g, x + 2, -880, 1.4, 880, '#6f7caa'); }
      for (let y = -880; y < 0; y += 150) rect(g, -560, y, 820, 2, rgba(INK, 0.45));
      strip(g, -560, -40, 820, 2, '#7ff6ff', 0.3, 14);
      // outer ring, cel shaded (shade low-left, light high-right)
      g.beginPath(); g.arc(cx, cy, R + 40, 0, TAU); g.fillStyle = INK; g.fill();
      g.beginPath(); g.arc(cx, cy, R + 36, 0, TAU); g.fillStyle = dark; g.fill();
      g.beginPath(); g.arc(cx + 7, cy - 7, R + 28, 0, TAU); g.fillStyle = body; g.fill();
      g.beginPath(); g.arc(cx, cy, R + 36, -PI * 0.45, PI * 0.02); g.strokeStyle = lit; g.lineWidth = 5; g.stroke();
      for (let k = 0; k < 32; k++) { const a = (k / 32) * TAU; g.save(); g.translate(cx + Math.cos(a) * (R + 18), cy + Math.sin(a) * (R + 18)); g.rotate(a); rect(g, -5, -10, 10, 20, INK); rect(g, -3.5, -8.5, 7, 17, k % 2 ? '#f2c14e' : deep); g.restore(); }
      // the shaft beyond: dark, a cyan breath, the Ladder's guide rails falling away
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = INK; g.fill();
      g.save(); g.beginPath(); g.arc(cx, cy, R - 4, 0, TAU); g.clip();
      g.fillStyle = deep; g.fillRect(cx - R, cy - R, R * 2, R * 2);
      glow(g, cx, cy + 30, R * 0.7, '#7ff6ff', 0.28);
      for (const rx of [-46, 46]) { rect(g, cx + rx - 6, cy - R, 12, R * 2, INK); rect(g, cx + rx - 4, cy - R, 8, R * 2, '#56648e'); rect(g, cx + rx + 1, cy - R, 2, R * 2, '#9fb0d8'); }
      // ten blades dilated to a 52% opening; straight inner edges form the aperture
      const n = 10, inner = R * 0.52, rot0 = 0.3, V = [];
      for (let i = 0; i < n; i++) { const a = rot0 + (i / n) * TAU; V.push([cx + Math.cos(a) * inner, cy + Math.sin(a) * inner]); }
      for (let i = 0; i < n; i++) {
        const a0 = rot0 + (i / n) * TAU, v0 = V[i], v1 = V[(i + 1) % n];
        const o0 = [cx + Math.cos(a0 - 0.55) * R * 1.1, cy + Math.sin(a0 - 0.55) * R * 1.1], o1 = [cx + Math.cos(a0 + 0.5) * R * 1.1, cy + Math.sin(a0 + 0.5) * R * 1.1];
        poly(g, [o0, o1, v1, v0]);
        const mid = (a0 + 0.3), sh = Math.cos(mid - (-PI * 0.25));
        g.fillStyle = sh > 0.35 ? '#b4c0dc' : sh > -0.35 ? body : dark; g.fill(); ink(g, 2.6);
        g.beginPath(); g.moveTo(v0[0], v0[1]); g.lineTo(v1[0], v1[1]); g.strokeStyle = lit; g.lineWidth = 1.6; g.stroke();
        const m = [(o0[0] + v0[0]) / 2, (o0[1] + v0[1]) / 2]; g.fillStyle = rgba(INK, 0.6); g.beginPath(); g.arc(m[0], m[1], 3, 0, TAU); g.fill();
      }
      g.restore();
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
      // the Cantata's lyre beside the ring + a plaque
      const ex = cx + R + 96, ey = cy - 30;
      g.beginPath(); g.arc(ex, ey, 34, 0, TAU); g.fillStyle = INK; g.fill(); g.beginPath(); g.arc(ex, ey, 30, 0, TAU); g.fillStyle = lit; g.fill();
      g.beginPath(); g.moveTo(ex - 15, ey + 17); g.quadraticCurveTo(ex - 24, ey - 6, ex - 9, ey - 20); g.moveTo(ex + 15, ey + 17); g.quadraticCurveTo(ex + 24, ey - 6, ex + 9, ey - 20); g.moveTo(ex - 15, ey + 17); g.lineTo(ex + 15, ey + 17);
      for (const dx of [-6, -2, 2, 6]) { g.moveTo(ex + dx, ey - 12); g.lineTo(ex + dx, ey + 16); }
      g.strokeStyle = M.goldD; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = M.gold; g.lineWidth = 1.6; g.stroke();
      rect(g, ex - 92, ey + 46, 184, 34, INK); rect(g, ex - 89, ey + 49, 178, 28, '#e9eff6');
      stencil(g, '頌歌號・第一停泊環', ex, ey + 59, 13, '#1b2240', { ink: false }); stencil(g, 'CANTATA — DOCKING COLLAR 01', ex, ey + 72, 7.5, '#3a4470', { ink: false, weight: 700, font: EN_FONT });
    });
    // the arrival lift (continuity with the Ladder)
    add(-380, -520, 420, 540, (g) => {
      const C = enamelC(0), x = -340, w = 280, h = 270;
      for (const cx of [x + 26, x + w - 26]) { rect(g, cx - 5, -520, 10, 520, INK); rect(g, cx - 3, -520, 6, 520, C.dark); rect(g, cx + 1, -520, 2, 520, C.lit); }
      g.strokeStyle = INK; g.lineWidth = 7; g.strokeRect(x, -h, w, h); g.strokeStyle = C.body; g.lineWidth = 4; g.strokeRect(x, -h, w, h);
      rect(g, x - 8, -h - 24, w + 16, 24, INK); rect(g, x - 6, -h - 22, w + 12, 20, C.body); rect(g, x - 6, -h - 22, w + 12, 4, C.lit);
      const lg = g.createRadialGradient(x + w / 2, -h + 50, 0, x + w / 2, -h + 50, 220); lg.addColorStop(0, 'rgba(255,224,170,0.32)'); lg.addColorStop(1, 'rgba(255,224,170,0)'); g.fillStyle = lg; g.fillRect(x, -h, w, h);
      g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); for (let k = 0; k < 7; k++) { const gx = x + w - 36 + (k % 2) * 9; g.moveTo(gx, -h + 30); g.lineTo(x + w - 36 + ((k + 1) % 2) * 9, -4); } g.stroke();
      rect(g, x + 40, -h - 76, 200, 42, INK); rect(g, x + 43, -h - 73, 194, 36, '#e9eff6');
      stencil(g, '頌歌之梯 ▽ 第九中繼站', x + 140, -h - 60, 15, '#1b2240', { ink: false });
      stencil(g, 'LADDER LIFT — ARRIVED 06:00', x + 140, -h - 44, 9, '#3a4470', { ink: false, weight: 700, font: EN_FONT });
    });
    // welcome party behind a barrier: a mother and a child with a hand-made sign
    S(330, 'wave', { cloth: '#9a5f66', legs: '#4a4256', skirt: 0.8, hairStyle: 'long', hair: '#3a2a2a' }, { face: 1 });
    S(392, 'wave', { child: true, cloth: '#c2a46a', legs: '#5a6386', hairStyle: 'pony', hair: '#5a3a2a', acc: 'sign' }, { face: 1, s: 0.62 });
    S(470, 'stand', { cloth: '#5f6f86', legs: '#3a4256', coat: 'long', hairStyle: 'short', hair: '#2a2a33', acc: 'flower' }, { face: 1 });
    add(240, -60, 300, 70, (g) => {
      for (const px of [250, 400, 530]) { rect(g, px - 4, -48, 8, 48, INK); rect(g, px - 2, -48, 4, 48, '#d1a44a'); g.beginPath(); g.arc(px, -50, 6, 0, TAU); g.fillStyle = '#e8c27a'; g.fill(); ink(g, 1.4); }
      g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(250, -40); g.quadraticCurveTo(325, -22, 400, -40); g.quadraticCurveTo(465, -22, 530, -40); g.stroke(); g.strokeStyle = '#b8323e'; g.lineWidth = 2.4; g.stroke();
    });
    // info terminal (CANTOR's first log)
    add(590, -170, 110, 175, (g) => {
      const C = enamelC(640), x = 612;
      rect(g, x - 2, -150, 60, 150, INK); rect(g, x, -148, 56, 148, C.body); rect(g, x, -148, 10, 148, C.dark); rect(g, x + 50, -148, 6, 148, C.lit);
      rect(g, x + 8, -136, 40, 52, INK); rect(g, x + 10, -134, 36, 48, '#0d2236');
      g.fillStyle = 'rgba(127,246,255,0.85)'; for (let k = 0; k < 7; k++) g.fillRect(x + 13, -130 + k * 6, 10 + ((k * 7) % 5) * 5, 2);
      glow(g, x + 28, -110, 50, '#7ff6ff', 0.2);
      stencil(g, '旅客資訊', x + 28, -70, 10, '#2a3458', { ink: false });
    });
    // the quarantine arch with its scanner bar
    add(820, -420, 220, 430, (g) => {
      const C = enamelC(900), x0 = 840, x1 = 1000;
      for (const px of [x0, x1 - 30]) { block(g, px, -330, 30, 330, { body: C.body, lit: C.lit, dark: C.dark }); strip(g, px + 13, -310, 4, 290, '#7ff6ff', 0.35, 14); }
      g.beginPath(); g.moveTo(x0 - 10, -330); g.quadraticCurveTo((x0 + x1) / 2, -420, x1 + 10, -330); g.lineTo(x1 + 10, -300); g.quadraticCurveTo((x0 + x1) / 2, -385, x0 - 10, -300); g.closePath();
      g.fillStyle = C.body; g.fill(); ink(g, 3);
      rect(g, x0 + 30, -300, x1 - x0 - 60, 10, INK); rect(g, x0 + 32, -298, x1 - x0 - 64, 6, '#ff5a6e');
      stencil(g, '檢疫閘門', (x0 + x1) / 2, -360, 16, '#1b2240', { ink: false }); stencil(g, 'QUARANTINE', (x0 + x1) / 2, -344, 9, '#3a4470', { ink: false, weight: 700, font: EN_FONT });
    });
    // the customs queue: travellers held where they stood
    add(990, -60, 680, 70, (g) => {
      for (const px of [1000, 1110, 1220, 1330, 1440, 1550, 1660]) { rect(g, px - 3, -44, 6, 44, INK); rect(g, px - 1.5, -44, 3, 44, '#c9a24e'); g.beginPath(); g.arc(px, -46, 5, 0, TAU); g.fillStyle = '#e3b25a'; g.fill(); ink(g, 1.2); }
      g.strokeStyle = INK; g.lineWidth = 3.5; g.beginPath(); for (let px = 1000; px < 1660; px += 110) { g.moveTo(px, -36); g.quadraticCurveTo(px + 55, -24, px + 110, -36); } g.stroke(); g.strokeStyle = '#2f5f9e'; g.lineWidth = 2; g.stroke();
    });
    S(1040, 'walk', { cloth: '#7a6aa0', legs: '#3a3a4a', coat: 'long', hairStyle: 'short', hair: '#2a2a33', acc: 'case', xtal: 3 }, { face: 1 });
    S(1235, 'hold', { cloth: '#5a7f80', legs: '#4a4256', skirt: 0.75, hairStyle: 'bun', hair: '#4a3a3a', scarf: '#d1a44a' }, { face: 1 });
    S(1212, 'walk', { child: true, cloth: '#e0a05a', legs: '#4a5a86', hairStyle: 'short', hair: '#3a2a22' }, { face: 1, s: 0.6 });
    S(1330, 'carry', { cloth: '#a3826a', legs: '#4c566e', hairStyle: 'cap', hatCol: '#3f4a6a', acc: 'box', feet: true }, { face: 1 });
    S(1480, 'cane', { cloth: '#8a6f8f', legs: '#5a5466', coat: 'long', hairStyle: 'hat', hatCol: '#6a5a4a', acc: 'cane' }, { face: 1 });
    // the departure board, stuck at 06:00
    add(1440, -700, 560, 330, (g) => {
      const x = 1470, y = -600, w = 500, h = 180;
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 40, -700); g.lineTo(x + 40, y); g.moveTo(x + w - 40, -700); g.lineTo(x + w - 40, y); g.stroke();
      rect(g, x - 4, y - 4, w + 8, h + 8, INK); rect(g, x, y, w, h, '#151b30'); rect(g, x, y, w, 26, '#2a3458');
      stencil(g, '梯運班次　LADDER SERVICES', x + w / 2, y + 13, 12, '#dff6ff', { ink: false });
      const rows = [['06:00', '第九中繼站', '抵達 ARRIVED'], ['06:20', '鐘樓 · 地表', '延誤 DELAYED'], ['06:45', '貨運懸廊', '延誤 DELAYED'], ['07:10', '萊拉', '取消 CANCELLED'], ['——', '晨禱進行中', '請保持安靜']];
      rows.forEach((r, i) => {
        const yy = y + 44 + i * 27;
        for (let k = 0; k < 3; k++) { const cx = x + [14, 110, 330][k], cw = [80, 200, 150][k]; rect(g, cx, yy - 10, cw, 20, '#0a0e1c'); rect(g, cx, yy - 0.5, cw, 1, rgba(INK, 0.9)); }
        stencil(g, r[0], x + 54, yy, 13, '#ffd27a', { ink: false, weight: 700, font: EN_FONT });
        stencil(g, r[1], x + 210, yy, 12, '#e8f2ff', { ink: false, weight: 700 });
        stencil(g, r[2], x + 405, yy, 11, i === 4 ? '#7ff6ff' : i === 0 ? '#9cf7b0' : '#ff8fa8', { ink: false, weight: 700 });
      });
    });
    // luggage carts, benches, palms in enamel planters, the information booth
    const planterPalm = (px) => add(px - 70, -260, 140, 265, (g) => {
      const C = enamelC(px), rr = U.mulberry32(px | 0);
      for (let k = 0; k < 7; k++) {
        const a = -PI / 2 + (k / 6 - 0.5) * 2.4, len = 70 + rr() * 30;
        g.beginPath(); g.moveTo(px, -120); g.quadraticCurveTo(px + Math.cos(a) * len * 0.6, -120 + Math.sin(a) * len * 0.7 - 20, px + Math.cos(a) * len, -120 + Math.sin(a) * len * 0.5 + 10);
        g.strokeStyle = INK; g.lineWidth = 7; g.stroke(); g.strokeStyle = k % 2 ? '#3f8a5a' : '#5aa66a'; g.lineWidth = 4.5; g.stroke();
      }
      rect(g, px - 4, -120, 8, 70, INK); rect(g, px - 2, -120, 4, 70, '#7a5a3a');
      block(g, px - 30, -54, 60, 54, { body: C.body, lit: C.lit, dark: C.dark }); strip(g, px - 28, -30, 56, 2, '#7ff6ff', 0.4, 8);
    });
    planterPalm(1780); planterPalm(2330);
    add(1830, -110, 220, 115, (g) => {
      const C = enamelC(1900);
      rect(g, 1850, -50, 150, 8, INK); rect(g, 1852, -48, 146, 4, C.lit); rect(g, 1856, -42, 6, 42, INK); rect(g, 1988, -42, 6, 42, INK);
      rect(g, 1850, -84, 150, 6, INK); rect(g, 1852, -82, 146, 2, C.lit); for (const px of [1856, 1924, 1990]) rect(g, px, -84, 4, 36, INK);
      // a forgotten suitcase and an umbrella
      block(g, 1930, -78, 40, 30, { body: '#9a5f66', lit: '#d08a8a', dark: '#5a2f3a' });
    });
    add(2180, -230, 260, 235, (g) => {
      const C = enamelC(2200), x = 2200;
      block(g, x, -96, 210, 96, { body: C.body, lit: C.lit, dark: C.dark });
      rect(g, x + 10, -84, 190, 30, '#16203a'); stencil(g, '旅客服務處', x + 105, -69, 14, '#dff6ff', { ink: false });
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 10, -96); g.lineTo(x + 10, -200); g.moveTo(x + 200, -96); g.lineTo(x + 200, -200); g.stroke();
      rect(g, x - 6, -214, 222, 20, INK); rect(g, x - 4, -212, 218, 16, '#2f5f9e'); stencil(g, 'INFORMATION · 歡迎回家', x + 105, -204, 10, '#ffffff', { ink: false, weight: 700 });
    });
    S(2350, 'stand', { cloth: '#2f5f9e', legs: '#2a3458', hairStyle: 'cap', hatCol: '#2f5f9e', scarf: '#e8c27a' }, { face: -1 });
    // great columns of the concourse
    for (const px of [760, 1700]) add(px - 40, -1300, 80, 1305, (g) => {
      const C = enamelC(px);
      rect(g, px - 28, -1300, 56, 1300, INK); rect(g, px - 26, -1300, 52, 1300, C.body); rect(g, px - 26, -1300, 14, 1300, C.dark); rect(g, px + 18, -1300, 8, 1300, C.lit);
      strip(g, px - 2, -1280, 4, 1250, '#7ff6ff', 0.4, 16);
      block(g, px - 36, -30, 72, 30, { body: C.body, lit: C.lit, dark: C.dark });
      const rr = U.mulberry32(px); if (px > 1000) vein(g, rr, px - 20, -10, 160, -PI / 2 - 0.2, 2.6);
    });
    // a hanging welcome screen over the concourse
    add(260, -1100, 620, 720, (g) => {
      const x = 400, y = -446, w = 460, h = 112;
      g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x + 60, -1100); g.lineTo(x + 60, y); g.moveTo(x + w - 60, -1100); g.lineTo(x + w - 60, y); g.stroke();
      rect(g, x - 4, y - 4, w + 8, h + 8, INK); rect(g, x, y, w, h, '#eef4fb'); rect(g, x, y, w, 6, '#ffffff'); rect(g, x, y + h - 10, w, 10, '#c3cede');
      stencil(g, '歡迎回到頌歌號', x + w / 2, y + 48, 34, '#1b2a52', { ink: false });
      stencil(g, 'WELCOME HOME TO THE CANTATA', x + w / 2, y + 84, 14, '#2f5f9e', { ink: false, weight: 700, font: EN_FONT });
      g.strokeStyle = M.gold; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 40, y + 100); g.lineTo(x + w - 40, y + 100); g.stroke();
    });

    /* ---------------- Z2: THE WHITE CORRIDORS ---------------- */
    // corridor wall: lower panels with doors · upper window band onto the light-well · the ceiling slab
    const WALL_GAPS = [[ARENA.e3[0] + 30, ARENA.e3[1] - 30]];
    const inGap = (x) => WALL_GAPS.some(([a, b]) => x > a && x < b);
    objs.push(...chunks(2400, 5200, 256, -800, 810, (g, a, b) => {
      const C = enamelC((a + b) / 2), rr = U.mulberry32(Math.floor(a) + 77);
      // ceiling slab
      rect(g, a, -800, b - a, 180, '#20284a'); rect(g, a, -626, b - a, 8, INK); rect(g, a, -624, b - a, 4, '#9fb2e0');
      for (let x = Math.floor(a / 160) * 160; x < b; x += 160) { rect(g, x + 20, -660, 120, 30, INK); rect(g, x + 23, -657, 114, 24, '#141a33'); strip(g, x + 30, -640, 100, 5, '#eaf8ff', 0.55, 30); }
      // window band (glass: mullions + sheen — the light-well shows through)
      for (let x = Math.floor(a / 128) * 128; x < b; x += 128) {
        if (inGap(x)) continue;
        rect(g, x - 4, -618, 10, 340, INK); rect(g, x - 2, -618, 6, 340, C.body); rect(g, x + 2, -618, 2, 340, C.lit);
        g.fillStyle = 'rgba(190,230,255,0.07)'; g.fillRect(x + 6, -612, 118, 330);
        g.fillStyle = 'rgba(235,250,255,0.08)'; poly(g, [[x + 16, -284], [x + 42, -284], [x + 104, -612], [x + 78, -612]]); g.fill();
      }
      for (const yy of [-450]) { rect(g, a, yy - 2, b - a, 8, INK); rect(g, a, yy, b - a, 4, C.body); }
      // lower wall
      for (let x = Math.floor(a / 128) * 128; x < b; x += 128) {
        if (inGap(x + 64)) continue;
        const xa = Math.max(x, a - 2), xb = Math.min(x + 128, b + 2);
        rect(g, xa, -284, xb - xa, 284, C.body);
        rect(g, x, -284, 3, 284, rgba(INK, 0.5)); rect(g, x + 3, -284, 2, 284, C.lit);
        rect(g, xa, -284, xb - xa, 6, C.lit); rect(g, xa, -278, xb - xa, 3, INK);
        rect(g, xa, -110, xb - xa, 4, '#7ff6ff'); rect(g, xa, -106, xb - xa, 3, C.dark);
        rect(g, xa, -16, xb - xa, 16, C.dark); rect(g, xa, -16, xb - xa, 2, rgba(INK, 0.7));
      }
      // wainscot + sconces with warm light pools
      for (let x = Math.floor(a / 16) * 16; x < b; x += 16) { if (inGap(x)) continue; rect(g, x, -104, 1.2, 88, rgba(INK, 0.25)); rect(g, x + 1.2, -104, 1, 88, rgba('#ffffff', 0.35)); }
      for (let x = Math.floor(a / 384) * 384 + 190; x < b; x += 384) {
        if (inGap(x)) continue;
        const lg = g.createRadialGradient(x, -200, 0, x, -200, 150); lg.addColorStop(0, 'rgba(255,226,180,0.28)'); lg.addColorStop(1, 'rgba(255,226,180,0)');
        g.fillStyle = lg; g.fillRect(x - 150, -284, 300, 270);
        rect(g, x - 9, -214, 18, 26, INK); rect(g, x - 7, -212, 14, 22, '#fff1d0'); rect(g, x - 7, -212, 14, 4, '#ffffff'); rect(g, x - 11, -190, 22, 4, INK);
      }
      { const sg = g.createLinearGradient(0, -284, 0, -150); sg.addColorStop(0, 'rgba(30,36,70,0.28)'); sg.addColorStop(1, 'rgba(30,36,70,0)'); g.fillStyle = sg; for (let x = Math.floor(a / 128) * 128; x < b; x += 128) { if (inGap(x + 64)) continue; g.fillRect(Math.max(x, a - 2), -284, Math.min(128, b + 2 - x), 134); } }
      // the Hush creeping along the wall (more as you go)
      const n = 1 + Math.floor(((a - 2400) / 2800) * 3);
      for (let i = 0; i < n; i++) if (rr() < 0.75) vein(g, rr, a + rr() * (b - a), -284 + rr() * 270, 120 + rr() * 160, (rr() < 0.5 ? 0 : PI) + (rr() - 0.5) * 1.2, 1.8 + rr() * 1.2);
    }));
    // the bulkhead gate where the concourse becomes the habitat ring
    add(2330, -800, 140, 805, (g) => {
      const C = enamelC(2400), x = 2370;
      block(g, x, -800, 46, 800, { body: C.body, lit: C.lit, dark: C.dark });
      rect(g, x + 8, -800, 4, 800, rgba(INK, 0.4));
      g.save(); g.beginPath(); g.rect(x, -150, 46, 140); g.clip(); rect(g, x, -150, 46, 140, '#f2c14e'); g.fillStyle = INK; for (let k = -60; k < 160; k += 22) { g.beginPath(); g.moveTo(x, -150 + k); g.lineTo(x + 46, -150 + k - 30); g.lineTo(x + 46, -150 + k - 18); g.lineTo(x, -150 + k + 12); g.fill(); } g.restore();
      g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(x, -150, 46, 140);
      strip(g, x + 21, -760, 4, 580, '#7ff6ff', 0.4, 14);
      rect(g, x - 40, -420, 126, 48, INK); rect(g, x - 37, -417, 120, 42, '#16203a');
      stencil(g, '居住環 C 區', x + 23, -402, 14, '#dff6ff', { ink: false }); stencil(g, 'HABITAT RING C', x + 23, -384, 8, '#7ff6ff', { ink: false, weight: 700, font: EN_FONT });
    });
    // apartment doors (sliding, pastel, numbered)
    const DOORS = [[2700, 'C-1101', '#7fb3a8'], [2960, 'C-1103', '#d8a88a'], [3330, 'C-1107', '#9fb0d8'], [4700, 'C-1121', '#c8a0b8'], [5040, 'C-1125', '#a8c48a']];
    for (const [dx, num, col] of DOORS) add(dx - 70, -300, 140, 305, (g) => door(g, dx, num, col, U.mulberry32(dx)));
    // the orphanage door (Rinne grew up here) — height marks on the frame
    add(2520, -320, 240, 325, (g) => {
      const x = 2560, C = enamelC(x);
      rect(g, x - 6, -250, 152, 250, INK); rect(g, x - 3, -247, 146, 247, C.lit);
      rect(g, x + 6, -236, 128, 236, '#e8c27a'); rect(g, x + 6, -236, 64, 236, '#d8b06a'); rect(g, x + 69, -236, 2, 236, rgba(INK, 0.6));
      for (const px of [x + 26, x + 94]) { rect(g, px, -200, 22, 30, INK); rect(g, px + 2, -198, 18, 26, '#fff4d8'); }
      rect(g, x - 2, -300, 148, 44, INK); rect(g, x, -298, 144, 40, '#fff8ea');
      stencil(g, '方舟第三育幼院', x + 72, -284, 15, '#7a4a2a', { ink: false }); stencil(g, 'CHILDREN\'S HOME No.3', x + 72, -266, 9, '#9a6a3a', { ink: false, weight: 700, font: EN_FONT });
      // height marks with names on the frame
      g.strokeStyle = rgba(INK, 0.75); g.lineWidth = 1.2;
      const marks = [[-120, '小優 8'], [-132, '阿哲 9'], [-104, '凜音 7'], [-150, '朵朵'], [-162, '米亞 11']];
      for (const [my, name] of marks) { g.beginPath(); g.moveTo(x - 6, my); g.lineTo(x + 6, my); g.stroke(); stencil(g, name, x - 30, my, 8, name.startsWith('凜音') ? '#2f5f9e' : '#4a4256', { ink: false, weight: 700 }); }
      // chalk drawings by the door (Duoduo's)
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(x + 190, -120, 10, 0, TAU); g.moveTo(x + 190, -110); g.lineTo(x + 190, -80); g.moveTo(x + 178, -98); g.lineTo(x + 202, -98); g.moveTo(x + 190, -80); g.lineTo(x + 182, -64); g.moveTo(x + 190, -80); g.lineTo(x + 198, -64); g.stroke();
      g.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; g.moveTo(x + 216, -134); g.lineTo(x + 216 + Math.cos(a) * 9, -134 + Math.sin(a) * 9); } g.stroke();
    });
    // the bakery front (warm light, still on)
    add(3060, -300, 260, 305, (g) => {
      const x = 3080, w = 220;
      rect(g, x - 4, -270, w + 8, 270, INK); rect(g, x, -266, w, 266, '#3a2a2a');
      const lg = g.createLinearGradient(0, -240, 0, 0); lg.addColorStop(0, 'rgba(255,200,130,0.85)'); lg.addColorStop(1, 'rgba(255,170,100,0.55)'); g.fillStyle = lg; g.fillRect(x + 8, -230, w - 16, 150);
      for (const sy of [-200, -160, -120]) { rect(g, x + 14, sy, w - 28, 4, '#7a4a2a'); for (let k = 0; k < 7; k++) { g.fillStyle = INK; g.beginPath(); g.ellipse(x + 30 + k * 26, sy - 6, 10, 6, 0, 0, TAU); g.fill(); g.fillStyle = k % 3 ? '#d8963c' : '#f0c070'; g.beginPath(); g.ellipse(x + 30 + k * 26, sy - 6, 8.5, 4.8, 0, 0, TAU); g.fill(); } }
      rect(g, x + 8, -80, w - 16, 80, '#5a3a2a'); rect(g, x + 8, -80, w - 16, 4, '#a0703a');
      g.beginPath(); g.moveTo(x - 10, -266); for (let k = 0; k <= 8; k++) g.lineTo(x - 10 + k * (w + 20) / 8, -266 + (k % 2 ? 22 : 30)); g.lineTo(x + w + 10, -266); g.closePath();
      g.fillStyle = '#d8606a'; g.fill(); ink(g, 2.4);
      stencil(g, '晨光麵包', x + w / 2, -292, 18, '#fff4e0', { inkCol: '#5a2a2a' });
      glow(g, x + w / 2, -150, 160, '#ffbe6b', 0.18);
    });
    // the message wall (families' notes)
    add(3500, -280, 210, 285, (g) => {
      const x = 3515, rr = U.mulberry32(3515);
      rect(g, x - 4, -250, 188, 190, INK); rect(g, x, -246, 180, 182, '#b08a62'); rect(g, x, -246, 180, 5, '#d8b08a');
      stencil(g, '居住環 C 區　留言板', x + 90, -262, 12, '#1b2240', { ink: false });
      for (let i = 0; i < 22; i++) {
        const nx = x + 8 + rr() * 150, ny = -238 + rr() * 150, c = ['#fff4a8', '#ffd0dc', '#d0ecff', '#d8ffd0', '#ffffff'][Math.floor(rr() * 5)];
        g.save(); g.translate(nx + 12, ny + 12); g.rotate((rr() - 0.5) * 0.4);
        rect(g, -12, -12, 24, 24, rgba(INK, 0.7)); rect(g, -11, -11, 22, 22, c);
        g.strokeStyle = rgba('#3a3a5a', 0.7); g.lineWidth = 0.8; g.beginPath(); for (let l = 0; l < 3; l++) { g.moveTo(-8, -5 + l * 5); g.lineTo(4 + rr() * 4, -5 + l * 5); } g.stroke();
        rect(g, -2, -14, 4, 4, '#e84a5a');
        g.restore();
      }
      // a big chalk note at the bottom
      g.save(); g.translate(x + 120, -86); g.rotate(-0.05); rect(g, -40, -16, 80, 32, '#2a3a2a'); stencil(g, '我會幫大家澆花', 0, -4, 8, 'rgba(255,255,255,0.9)', { ink: false, weight: 700 }); stencil(g, '——朵朵', 18, 8, 7, 'rgba(255,255,255,0.8)', { ink: false, weight: 700 }); g.restore();
    });
    // Vega's quarters: a half-open door, her desk, the spare coat on its hook
    add(4740, -320, 260, 325, (g) => {
      const x = 4760, w = 200, C = enamelC(x);
      rect(g, x - 6, -262, w + 12, 262, INK); rect(g, x, -256, w, 256, '#1c2238');
      const lg = g.createRadialGradient(x + 120, -150, 0, x + 120, -150, 200); lg.addColorStop(0, 'rgba(255,220,170,0.45)'); lg.addColorStop(1, 'rgba(255,220,170,0.04)'); g.fillStyle = lg; g.fillRect(x, -256, w, 256);
      // bunk + desk + photo + lamp
      rect(g, x + 10, -70, 90, 14, INK); rect(g, x + 12, -68, 86, 10, '#cfd8ea'); rect(g, x + 12, -58, 86, 58, '#2a3150');
      rect(g, x + 120, -96, 70, 8, INK); rect(g, x + 122, -94, 66, 4, '#8a6a4a'); rect(g, x + 126, -88, 5, 88, INK); rect(g, x + 180, -88, 5, 88, INK);
      rect(g, x + 128, -126, 26, 22, INK); rect(g, x + 130, -124, 22, 18, '#e8dcc0'); g.fillStyle = '#3a4a6a'; for (let k = 0; k < 4; k++) g.fillRect(x + 132 + k * 5, -116, 3, 8);
      rect(g, x + 166, -130, 4, 34, INK); g.beginPath(); g.moveTo(x + 158, -132); g.lineTo(x + 178, -132); g.lineTo(x + 172, -142); g.lineTo(x + 164, -142); g.closePath(); g.fillStyle = '#ffd890'; g.fill(); ink(g, 1.2);
      // the spare coat: navy duster with crimson lining, hanging on a hook
      rect(g, x + 40, -230, 30, 6, INK);
      g.beginPath(); g.moveTo(x + 55, -224); g.lineTo(x + 30, -200); g.lineTo(x + 26, -96); g.lineTo(x + 44, -92); g.lineTo(x + 55, -170); g.lineTo(x + 66, -92); g.lineTo(x + 84, -96); g.lineTo(x + 80, -200); g.closePath();
      g.fillStyle = '#26305c'; g.fill(); ink(g, 2);
      g.beginPath(); g.moveTo(x + 55, -170); g.lineTo(x + 47, -94); g.lineTo(x + 55, -92); g.lineTo(x + 63, -94); g.closePath(); g.fillStyle = '#9a2438'; g.fill(); ink(g, 1.2);
      rect(g, x + 74, -200, 4, 100, '#3a4680');
      // the half-open sliding door + nameplate
      rect(g, x + w - 60, -256, 60, 256, INK); rect(g, x + w - 57, -253, 54, 253, '#8fa0c8'); rect(g, x + w - 57, -253, 8, 253, '#c8d4ee');
      rect(g, x + 30, -300, 140, 34, INK); rect(g, x + 32, -298, 136, 30, '#e9eff6');
      stencil(g, 'E. 薇格 — 第七降臨隊', x + 100, -288, 11, '#1b2240', { ink: false, weight: 700 }); stencil(g, 'CAPT. ELAINE VEGA', x + 100, -275, 8, '#3a4470', { ink: false, weight: 700, font: EN_FONT });
      void C;
    });
    // corridor statues + things frozen in mid-air
    S(2860, 'run', { child: true, cloth: '#e86a5a', legs: '#3a4a7a', hairStyle: 'short', hair: '#3a2a22' }, { face: 1, s: 0.6 });
    add(2930, -110, 40, 40, (g) => { g.beginPath(); g.arc(2950, -88, 10, 0, TAU); g.fillStyle = '#ff6a5a'; g.fill(); ink(g, 1.8); g.beginPath(); g.arc(2950, -88, 10, -PI * 0.8, -PI * 0.2); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(2938, -70); g.lineTo(2930, -40); g.moveTo(2944, -72); g.lineTo(2940, -50); g.stroke(); });
    S(3220, 'walk', { cloth: '#5f6f86', legs: '#2a3458', coat: 'jacket', hairStyle: 'short', hair: '#2a2a33', acc: 'bag' }, { face: -1 });
    add(3260, -270, 60, 40, (g) => { g.save(); g.translate(3290, -248); g.rotate(-0.2); poly(g, [[-16, 0], [14, -4], [-2, 2], [-16, 0]]); g.fillStyle = '#ffffff'; g.fill(); ink(g, 1.2); poly(g, [[-2, 2], [14, -4], [-6, 8]]); g.fillStyle = '#dfe6f4'; g.fill(); ink(g, 1.2); g.restore(); });
    S(3420, 'cane', { cloth: '#7a6a5a', legs: '#4a4256', skirt: 0.85, hairStyle: 'bun', hair: '#e8e8ee', acc: 'cane', xtal: 9 }, { face: 1 });
    S(3470, 'reach', { cloth: '#9a5f66', legs: '#3a3a4a', hairStyle: 'long', hair: '#5a3a2a', acc: 'cup' }, { face: -1 });
    add(3480, -130, 50, 130, (g) => { // the spilled tea, frozen
      g.fillStyle = 'rgba(200,140,90,0.75)'; g.beginPath(); g.moveTo(3446, -96); g.quadraticCurveTo(3436, -60, 3442, -30); g.quadraticCurveTo(3450, -60, 3452, -94); g.closePath(); g.fill(); ink(g, 1);
      for (const [dx, dy] of [[-10, -50], [2, -40], [-4, -22]]) { g.beginPath(); g.arc(3446 + dx, dy, 2.2, 0, TAU); g.fillStyle = 'rgba(210,150,100,0.85)'; g.fill(); ink(g, 0.7); }
      g.save(); g.translate(3456, -18); g.rotate(0.9); rect(g, -6, -5, 12, 10, INK); rect(g, -5, -4, 10, 8, '#f4f0e6'); g.restore();
    });
    S(4630, 'carry', { cloth: '#2f5f9e', legs: '#2a3458', hairStyle: 'cap', hatCol: '#2f5f9e', acc: 'box', feet: true }, { face: 1 });
    add(4580, -120, 60, 60, (g) => { // a cat mid-leap
      g.save(); g.translate(4600, -90); g.rotate(-0.3);
      blob(g, [[-16, 0], [-6, -7], [10, -6], [16, -2], [12, 4], [-10, 5]]); g.fillStyle = '#e8d8c0'; g.fill(); ink(g, 1.4);
      poly(g, [[12, -6], [14, -13], [17, -6]]); g.fillStyle = '#e8d8c0'; g.fill(); ink(g, 1);
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(-16, 0); g.quadraticCurveTo(-26, -6, -30, 4); g.stroke(); g.strokeStyle = '#e8d8c0'; g.lineWidth = 1.6; g.stroke();
      g.restore();
    });
    // the residential junction (e3): a round skylight bay, signage, heavier Hush
    add(ARENA.e3[0] - 20, -900, ARENA.e3[1] - ARENA.e3[0] + 40, 905, (g) => {
      const x0 = ARENA.e3[0], x1 = ARENA.e3[1], cx = (x0 + x1) / 2, C = enamelC(cx), rr = U.mulberry32(3707);
      rect(g, x0 + 30, -620, x1 - x0 - 60, 620, '#28304f');
      // back wall arcs
      g.beginPath(); g.moveTo(x0 + 30, 0); g.lineTo(x0 + 30, -380); g.quadraticCurveTo(cx, -700, x1 - 30, -380); g.lineTo(x1 - 30, 0); g.closePath();
      g.fillStyle = mixH(C.body, '#3a4670', 0.45); g.fill(); ink(g, 3);
      g.save(); g.clip();
      // rotunda ribs radiating from the skylight
      for (let k = -4; k <= 4; k++) {
        const bx = cx + k * 96, ang = Math.atan2(470, bx - cx);
        g.beginPath(); g.moveTo(cx + Math.cos(ang) * 130, -470 + Math.sin(ang) * 130); g.lineTo(bx, -330); g.lineTo(bx, 0);
        g.strokeStyle = INK; g.lineWidth = 12; g.stroke(); g.strokeStyle = mixH(C.body, '#3a4670', 0.15); g.lineWidth = 8; g.stroke(); g.strokeStyle = rgba(C.lit, 0.7); g.lineWidth = 1.4; g.stroke();
      }
      // frieze with a light strip + lower panels
      rect(g, x0, -342, x1 - x0, 26, INK); rect(g, x0, -340, x1 - x0, 22, mixH(C.body, '#3a4670', 0.2)); strip(g, x0, -330, x1 - x0, 2, '#7ff6ff', 0.45, 14);
      for (let px = x0 + 40; px < x1 - 40; px += 96) { rect(g, px, -180, 70, 150, rgba(INK, 0.3)); rect(g, px + 2, -178, 66, 146, mixH(C.body, '#3a4670', 0.32)); rect(g, px + 2, -178, 66, 3, rgba(C.lit, 0.6)); }
      g.restore();
      // the round skylight
      g.beginPath(); g.arc(cx, -470, 120, 0, TAU); g.fillStyle = '#0c1430'; g.fill(); ink(g, 6);
      g.save(); g.beginPath(); g.arc(cx, -470, 116, 0, TAU); g.clip();
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(cx - 116 + rr() * 232, -586 + rr() * 232, 1.4, 1.4); }
      g.strokeStyle = C.body; g.lineWidth = 4; g.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * PI; g.moveTo(cx + Math.cos(a) * 120, -470 + Math.sin(a) * 120); g.lineTo(cx - Math.cos(a) * 120, -470 - Math.sin(a) * 120); } g.stroke();
      g.restore();
      g.beginPath(); g.arc(cx, -470, 120, 0, TAU); g.strokeStyle = C.lit; g.lineWidth = 3; g.stroke();
      // signs
      for (const [sx, txt, en, col] of [[x0 + 150, '← 育幼院', 'CHILDREN\'S HOME', '#e8c27a'], [x1 - 150, '中庭 →', 'ATRIUM', '#4fd8ec']]) { rect(g, sx - 70, -260, 140, 46, INK); rect(g, sx - 67, -257, 134, 40, '#16203a'); stencil(g, txt, sx, -244, 15, col, { ink: false }); stencil(g, en, sx, -226, 8, '#dff6ff', { ink: false, weight: 700, font: EN_FONT }); }
      // benches + a big planter in the middle
      block(g, cx - 60, -40, 120, 40, { body: C.body, lit: C.lit, dark: C.dark });
      tree(g, rr, cx, -40, 0.5, 0, 0, false);
      for (let i = 0; i < 5; i++) vein(g, rr, x0 + 40 + rr() * (x1 - x0 - 80), -10 - rr() * 300, 160 + rr() * 150, -PI / 2 + (rr() - 0.5) * 2, 2.4);
      cluster(g, x0 + 60, 0, 1.4, -PI / 2 + 0.3, rr, 0.35); cluster(g, x1 - 70, 0, 1.2, -PI / 2 - 0.3, rr, 0.3);
    });
    S(3960, 'hug', { cloth: '#8a6f8f', legs: '#3a3a4a', skirt: 0.7, hairStyle: 'long', hair: '#3a2a2a' }, { face: 1 });
    S(3990, 'hug', { cloth: '#5a7f80', legs: '#2a3458', coat: 'jacket', hairStyle: 'short', hair: '#2a2a33' }, { face: -1 });
    S(4330, 'stand', { cloth: '#c2a46a', legs: '#4a4256', skirt: 0.8, hairStyle: 'hat', hatCol: '#d8c08a', acc: 'flower', feet: true }, { face: -1 });

    /* ---------------- Z3: THE ATRIUM OF THE MORNING HYMN ---------------- */
    // the gateway arch out of the corridor
    add(5150, -760, 160, 765, (g) => {
      const C = enamelC(5200);
      block(g, 5170, -700, 46, 700, { body: C.body, lit: C.lit, dark: C.dark });
      g.beginPath(); g.moveTo(5170, -700); g.quadraticCurveTo(5200, -760, 5300, -760); g.lineTo(5300, -730); g.quadraticCurveTo(5225, -730, 5216, -690); g.closePath(); g.fillStyle = C.body; g.fill(); ink(g, 3);
      strip(g, 5191, -680, 4, 660, '#ffe2a0', 0.35, 14);
    });
    // the great chronometer: stopped at six — its angel alcoves are empty
    add(CLOCK.x - 170, -1260, 340, 1265, (g) => {
      const x = CLOCK.x, C = enamelC(x), rr = U.mulberry32(6640);
      // shaft
      g.beginPath(); g.moveTo(x - 70, 0); g.lineTo(x - 56, -760); g.lineTo(x + 56, -760); g.lineTo(x + 70, 0); g.closePath(); g.fillStyle = C.body; g.fill(); ink(g, 3.4);
      g.save(); g.beginPath(); g.moveTo(x - 70, 0); g.lineTo(x - 56, -760); g.lineTo(x + 56, -760); g.lineTo(x + 70, 0); g.closePath(); g.clip();
      rect(g, x - 72, -760, 30, 760, C.dark); rect(g, x + 50, -760, 22, 760, C.lit);
      for (let y = -700; y < 0; y += 120) { rect(g, x - 72, y, 144, 3, rgba(INK, 0.45)); }
      g.restore();
      // empty angel alcoves (the Seraphs have left them)
      for (const ay of [-300, -560]) {
        g.beginPath(); lancet(g, x - 26, ay - 90, 52, ay); g.fillStyle = '#1c2340'; g.fill(); ink(g, 2.6);
        g.beginPath(); g.ellipse(x, ay - 4, 22, 5, 0, 0, TAU); g.fillStyle = C.lit; g.fill(); ink(g, 1.4);
        for (let k = 0; k < 3; k++) { g.save(); g.translate(x - 10 + k * 10, ay - 8); g.rotate(-0.4 + k * 0.3); poly(g, [[0, 0], [3, -12], [6, 0]]); g.fillStyle = '#ffd6e0'; g.fill(); ink(g, 0.8); g.restore(); }
      }
      // clock head
      const cy = CLOCK.y;
      block(g, x - 120, cy - 130, 240, 260, { body: C.body, lit: C.lit, dark: C.dark });
      g.beginPath(); g.moveTo(x - 132, cy - 130); g.lineTo(x, cy - 230); g.lineTo(x + 132, cy - 130); g.closePath(); g.fillStyle = mixH(C.body, C.lit, 0.3); g.fill(); ink(g, 3);
      g.beginPath(); g.moveTo(x, cy - 230); g.lineTo(x, cy - 300); ink(g, 3); glow(g, x, cy - 302, 16, '#ffe2a0', 0.6);
      g.beginPath(); g.arc(x, cy, 104, 0, TAU); g.fillStyle = INK; g.fill();
      g.beginPath(); g.arc(x, cy, 98, 0, TAU); g.fillStyle = '#f6f2e6'; g.fill();
      g.beginPath(); g.arc(x, cy, 98, PI * 0.6, PI * 1.4); g.strokeStyle = '#d6cdb8'; g.lineWidth = 10; g.stroke();
      g.beginPath(); g.arc(x, cy, 88, 0, TAU); g.strokeStyle = M.goldD; g.lineWidth = 2; g.stroke();
      const RN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU - PI / 2; stencil(g, RN[k], x + Math.cos(a) * 72, cy + Math.sin(a) * 72, 12, '#2a2440', { ink: false, weight: 700, font: 'serif' }); }
      for (let k = 0; k < 60; k++) { const a = (k / 60) * TAU; rect(g, x + Math.cos(a) * 86 - 0.8, cy + Math.sin(a) * 86 - 0.8, 1.6, 1.6, '#5a5068'); }
      // hands at six o'clock (the second hand is drawn live — it trembles but never moves)
      g.lineCap = 'round';
      g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(x, cy); g.lineTo(x, cy - 62); g.stroke(); g.strokeStyle = M.goldD; g.lineWidth = 4; g.stroke();
      g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(x, cy); g.lineTo(x, cy + 44); g.stroke(); g.strokeStyle = M.goldD; g.lineWidth = 5; g.stroke();
      g.beginPath(); g.arc(x, cy, 7, 0, TAU); g.fillStyle = M.gold; g.fill(); ink(g, 2);
      stencil(g, '晨禱 06:00', x, cy + 150, 14, '#1b2240', { ink: false });
      vein(g, rr, x - 60, -40, 260, -PI / 2 - 0.15, 3); vein(g, rr, x + 50, -120, 200, -PI / 2 + 0.2, 2.4);
      cluster(g, x - 64, 0, 1.6, -PI / 2 - 0.4, rr, 0.35);
    });
    // trees + hedges + flower beds on the garden floor
    for (const [tx, s] of [[5880, 0.84], [6260, 0.62], [7480, 0.8]]) add(tx - 175 * s, -360 * s - 20, 350 * s, 380 * s + 30, (g) => tree(g, U.mulberry32(tx | 0), tx, 0, s, 0, 0, true));
    for (let hx = 5780; hx < 8200; hx += 230) {
      const xx = hx;
      if (xx > FOUNT.x - 80 && xx < FOUNT.x + FOUNT.w + 40) continue;
      add(xx - 10, -60, 140, 65, (g) => {
        const rr = U.mulberry32(xx);
        g.beginPath(); for (let k = 0; k < 6; k++) { const px = xx + 12 + k * 20, r = 15 + rr() * 8; g.moveTo(px + r, -r * 0.8); g.arc(px, -r * 0.8, r, 0, TAU); } g.rect(xx, -22, 124, 22);
        g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); g.fillStyle = '#2f6b4f'; g.fill();
        g.fillStyle = '#4f9a6a'; g.beginPath(); for (let k = 0; k < 6; k++) { const px = xx + 16 + k * 20; g.moveTo(px + 9, -24); g.arc(px + 2, -24, 9, 0, TAU); } g.fill();
        for (let k = 0; k < 9; k++) { g.fillStyle = INK; const fx = xx + 8 + rr() * 110, fy = -30 + rr() * 22; g.beginPath(); g.arc(fx, fy, 3.6, 0, TAU); g.fill(); g.fillStyle = ['#ff9fb8', '#fff3a8', '#ffffff', '#ffb35c'][Math.floor(rr() * 4)]; g.beginPath(); g.arc(fx, fy, 2.6, 0, TAU); g.fill(); }
      });
    }
    // the children's choir by the fountain + the conductor
    S(5990, 'sing', { child: true, cloth: '#eef2fa', legs: '#4a5a86', hairStyle: 'short', hair: '#3a2a22', acc: 'book' }, { face: 1, s: 0.62 });
    S(6040, 'sing', { child: true, cloth: '#eef2fa', legs: '#4a5a86', hairStyle: 'pony', hair: '#2a2a33', acc: 'book' }, { face: 1, s: 0.62 });
    S(6090, 'sing', { child: true, cloth: '#eef2fa', legs: '#4a5a86', hairStyle: 'bun', hair: '#5a3a2a', acc: 'book', feet: true }, { face: 1, s: 0.62 });
    S(6560, 'conduct', { cloth: '#2a2a3a', legs: '#1a1a2a', coat: 'long', hairStyle: 'short', hair: '#c9ccd8', acc: 'baton' }, { face: -1 });
    S(6280, 'violin', { cloth: '#3e4156', legs: '#2a2c3c', coat: 'jacket', hairStyle: 'short', hair: '#26252f', acc: 'violin' }, { face: 1 });
    S(5560, 'lookup', { cloth: '#c2a46a', legs: '#4c566e', skirt: 0.85, hairStyle: 'hat', hatCol: '#f2e2b8' }, { face: 1, y: BAL.y });
    S(5660, 'sing', { cloth: '#7d8f6a', legs: '#4a4256', coat: 'long', hairStyle: 'short', hair: '#4a3a3a', acc: 'book' }, { face: 1, y: BAL.y });
    // the fountain: water frozen in glass arcs mid-splash
    add(FOUNT.x - 120, -380, FOUNT.w + 240, 400, (g) => {
      const x = FOUNT.x, w = FOUNT.w, cx = x + w / 2, top = -FOUNT.h, C = enamelC(cx);
      // pillar + bowl
      block(g, cx - 12, -150, 24, 110, { body: C.body, lit: C.lit, dark: C.dark });
      g.beginPath(); g.ellipse(cx, -150, 46, 10, 0, 0, TAU); g.fillStyle = C.lit; g.fill(); ink(g, 2.4);
      g.beginPath(); g.moveTo(cx - 46, -150); g.quadraticCurveTo(cx, -118, cx + 46, -150); g.fillStyle = C.body; g.fill(); ink(g, 2.4);
      // frozen water: arcs of glass with hard white highlights
      const arc = (sx, sy, ex, ey, h, wdt) => {
        g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + ex) / 2, sy - h, ex, ey);
        g.strokeStyle = rgba(INK, 0.8); g.lineWidth = wdt + 3; g.stroke(); g.strokeStyle = 'rgba(150,225,255,0.85)'; g.lineWidth = wdt; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = Math.max(1, wdt * 0.3); g.beginPath(); g.moveTo(sx, sy - 2); g.quadraticCurveTo((sx + ex) / 2, sy - h - 2, (sx + ex) / 2 + (ex - sx) * 0.15, sy - h * 0.8); g.stroke();
      };
      arc(cx, -158, cx - 92, top - 4, 150, 6); arc(cx, -158, cx + 92, top - 4, 150, 6); arc(cx, -158, cx - 60, -150, 80, 4); arc(cx, -158, cx + 60, -150, 80, 4);
      g.beginPath(); g.moveTo(cx - 4, -158); g.lineTo(cx, -270); g.lineTo(cx + 4, -158); g.closePath(); g.fillStyle = 'rgba(160,230,255,0.9)'; g.fill(); ink(g, 1.6);
      for (let k = 0; k < 18; k++) { const rr = U.mulberry32(k * 13 + 7), dx = (rr() - 0.5) * 200, dy = -40 - rr() * 230; g.beginPath(); g.arc(cx + dx, dy, 2 + rr() * 2.4, 0, TAU); g.fillStyle = 'rgba(190,240,255,0.95)'; g.fill(); ink(g, 0.8); }
      // basin
      g.beginPath(); g.ellipse(cx, top, w / 2 + 6, 14, 0, PI, TAU); g.fillStyle = 'rgba(120,200,240,0.55)'; g.fill();
      rect(g, x - 4, top - 2, w + 8, FOUNT.h + 2, INK); rect(g, x - 2, top, w + 4, FOUNT.h, C.body); rect(g, x - 2, top, w + 4, 5, C.lit); rect(g, x - 2, top + FOUNT.h - 8, w + 4, 8, C.dark);
      for (let px = x + 20; px < x + w; px += 40) { rect(g, px, top + 12, 24, 16, C.dark); rect(g, px + 2, top + 14, 20, 12, mixH(C.body, C.lit, 0.4)); }
      g.beginPath(); g.ellipse(cx, top, w / 2 + 6, 14, 0, 0, PI); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke();
    });
    S(FOUNT.x - 40, 'reach', { child: true, cloth: '#9fb0d8', legs: '#4a4256', hairStyle: 'pony', hair: '#3a2a22' }, { face: 1, s: 0.6 });
    // Duoduo's corner: a little glasshouse with her blanket, watering cans and pinned drawings
    add(7090, -240, 280, 245, (g) => {
      const x = 7110, w = 230, C = enamelC(x);
      g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -150); g.lineTo(x + w / 2, -210); g.lineTo(x + w, -150); g.lineTo(x + w, 0); g.stroke();
      g.strokeStyle = C.lit; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(200,240,230,0.12)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -150); g.lineTo(x + w / 2, -210); g.lineTo(x + w, -150); g.lineTo(x + w, 0); g.fill();
      g.strokeStyle = rgba(INK, 0.7); g.lineWidth = 1.6; g.beginPath(); for (let px = x + 46; px < x + w; px += 46) { g.moveTo(px, 0); g.lineTo(px, -150 - (px - x < w / 2 ? (px - x) : (x + w - px)) * 0.52); } g.moveTo(x, -80); g.lineTo(x + w, -80); g.stroke();
      // blanket nest + pillow + a lamp
      g.beginPath(); g.moveTo(x + 20, 0); g.quadraticCurveTo(x + 60, -36, x + 120, -16); g.lineTo(x + 130, 0); g.closePath(); g.fillStyle = '#e8a05a'; g.fill(); ink(g, 2);
      g.beginPath(); g.ellipse(x + 40, -10, 18, 8, -0.2, 0, TAU); g.fillStyle = '#f4ecd6'; g.fill(); ink(g, 1.4);
      // pinned drawings (portraits of the frozen)
      const rr = U.mulberry32(7110);
      for (let k = 0; k < 6; k++) { g.save(); g.translate(x + 30 + k * 32, -120 + (k % 2) * 26); g.rotate((rr() - 0.5) * 0.3); rect(g, -12, -14, 24, 28, '#fbf6e8'); g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(-12, -14, 24, 28); g.strokeStyle = '#4a4a6a'; g.beginPath(); g.arc(0, -4, 5, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(-8, 12); g.quadraticCurveTo(-7, 3, 0, 2.5); g.quadraticCurveTo(7, 3, 8, 12); g.stroke(); g.beginPath(); g.arc(0, -3.6, 2.2, 0.3, PI - 0.3); g.stroke(); rect(g, -2, -16, 4, 4, '#e84a5a'); g.restore(); }
      // watering cans
      for (const [px, col] of [[x + 160, '#7fb0c8'], [x + 196, '#e8c27a']]) { block(g, px, -26, 22, 26, { body: col, lit: mixH(col, '#ffffff', 0.4), dark: mixH(col, '#2a2440', 0.4) }); g.beginPath(); g.moveTo(px + 22, -16); g.lineTo(px + 34, -26); ink(g, 3); }
      stencil(g, '朵朵的花房', x + w / 2, -168, 11, '#fff4e0', { inkCol: '#3a2a22' });
    });
    // Grandma Mei: kneeling with her watering can, mid-pour
    S(7420, 'kneel', { cloth: '#7d8f6a', legs: '#5a5466', skirt: 0.5, hairStyle: 'hat', hatCol: '#e8d8b0', acc: 'can' }, { face: -1 });
    // the trellis wall up to the dome ring (secret route)
    add(7540, -1500, 860, 1505, (g) => {
      const x0 = 7580, x1 = 8060, rr = U.mulberry32(7580), C = enamelC(7800);
      // dome glass ribs above the ring
      g.beginPath(); g.moveTo(7560, DOME_Y - 40); g.quadraticCurveTo(7900, -1520, 8420, -1400); g.strokeStyle = INK; g.lineWidth = 14; g.stroke(); g.strokeStyle = C.body; g.lineWidth = 9; g.stroke(); g.strokeStyle = C.lit; g.lineWidth = 2; g.stroke();
      for (let k = 0; k < 6; k++) { const px = 7620 + k * 140; g.beginPath(); g.moveTo(px, DOME_Y - 46); g.lineTo(px + 60, -1480 + k * 14); g.strokeStyle = INK; g.lineWidth = 6; g.stroke(); g.strokeStyle = C.body; g.lineWidth = 3; g.stroke(); }
      // lattice
      g.strokeStyle = INK; g.lineWidth = 5; g.beginPath();
      for (let x = x0; x <= x1; x += 60) { g.moveTo(x, 0); g.lineTo(x, DOME_Y); }
      for (let y = 0; y > DOME_Y; y -= 60) { g.moveTo(x0, y); g.lineTo(x1, y); }
      g.stroke(); g.strokeStyle = '#efe6d4'; g.lineWidth = 2.4; g.stroke();
      // climbing roses + ivy
      for (let i = 0; i < 9; i++) {
        let px = x0 + rr() * (x1 - x0), py = 0;
        g.beginPath(); g.moveTo(px, py);
        while (py > DOME_Y + 20) { px += (rr() - 0.5) * 50; py -= 30 + rr() * 40; g.lineTo(clamp(px, x0, x1), py); }
        g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); g.strokeStyle = '#2f6b4a'; g.lineWidth = 2; g.stroke();
      }
      for (let i = 0; i < 200; i++) {
        const px = x0 + rr() * (x1 - x0), py = -rr() * (-DOME_Y - 20);
        g.save(); g.translate(px, py); g.rotate(rr() * TAU); g.beginPath(); g.ellipse(0, 0, 6, 3, 0, 0, TAU); g.fillStyle = rr() < 0.5 ? '#3f8a4e' : '#6ab06a'; g.fill(); ink(g, 0.7); g.restore();
        if (rr() < 0.18) { g.fillStyle = INK; g.beginPath(); g.arc(px, py, 4.4, 0, TAU); g.fill(); g.fillStyle = rr() < 0.6 ? '#ff7a9a' : '#fff0c0'; g.beginPath(); g.arc(px, py, 3.2, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(px - 1, py - 2, 1.6, 1.6); }
      }
      stencil(g, '穹頂維修環 ↑', x0 + 40, -40, 11, '#fff4e0', { inkCol: '#2a3a2a' });
    });
    // atrium exit arch → the ward
    add(8200, -760, 180, 765, (g) => {
      const C = enamelC(8250);
      block(g, 8250, -700, 46, 700, { body: C.body, lit: C.lit, dark: C.dark });
      g.beginPath(); g.moveTo(8296, -700); g.quadraticCurveTo(8270, -760, 8170, -760); g.lineTo(8170, -730); g.quadraticCurveTo(8245, -730, 8250, -690); g.closePath(); g.fillStyle = C.body; g.fill(); ink(g, 3);
      rect(g, 8130, -330, 160, 46, INK); rect(g, 8133, -327, 154, 40, '#16203a'); stencil(g, '守夜廊 →', 8210, -314, 15, '#7dffcf', { ink: false }); stencil(g, 'THE LANTERN WARD', 8210, -296, 8, '#dff6ff', { ink: false, weight: 700, font: EN_FONT });
    });

    /* ---------------- Z4: THE LANTERN WARD ---------------- */
    objs.push(...chunks(8300, 10800, 256, -900, 905, (g, a, b) => {
      const C = enamelC((a + b) / 2), rr = U.mulberry32(Math.floor(a) + 91);
      // ceiling + curtain rails
      rect(g, a, -900, b - a, 200, '#141a33'); rect(g, a, -706, b - a, 8, INK); rect(g, a, -704, b - a, 3, '#6f86c0');
      // wall with tall arched windows onto space (the stars show through)
      const WIN = 300;
      g.beginPath(); g.rect(a - 2, -700, b - a + 4, 700);
      for (let x = Math.floor(a / WIN) * WIN; x < b + WIN; x += WIN) lancet(g, x + 70, -640, 160, -230);
      g.fillStyle = C.body; g.fill('evenodd');
      g.save(); g.clip('evenodd');
      { const vg = g.createLinearGradient(0, -700, 0, 0); vg.addColorStop(0, 'rgba(6,8,22,0.62)'); vg.addColorStop(0.55, 'rgba(6,8,22,0.12)'); vg.addColorStop(1, 'rgba(6,8,22,0.34)'); g.fillStyle = vg; g.fillRect(a - 2, -700, b - a + 4, 700); }
      g.restore();
      for (let x = Math.floor(a / WIN) * WIN; x < b + WIN; x += WIN) {
        g.beginPath(); lancet(g, x + 70, -640, 160, -230); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); g.strokeStyle = C.lit; g.lineWidth = 1.6; g.stroke();
        g.strokeStyle = rgba(INK, 0.9); g.lineWidth = 3; g.beginPath(); g.moveTo(x + 150, -600); g.lineTo(x + 150, -230); g.moveTo(x + 70, -400); g.lineTo(x + 230, -400); g.stroke();
        rect(g, x + 60, -232, 180, 10, INK); rect(g, x + 62, -230, 176, 6, C.lit);
        rect(g, x + 20, -700, 14, 700, C.dark); rect(g, x + 266, -700, 6, 700, C.lit);
      }
      rect(g, a, -16, b - a, 16, C.dark);
      // curtains frozen mid-sway
      for (let x = Math.floor(a / 300) * 300 + 250; x < b; x += 300) {
        const sway = (rr() - 0.5) * 30;
        g.beginPath(); g.moveTo(x - 30, -700); g.lineTo(x + 30, -700); g.quadraticCurveTo(x + 30 + sway, -400, x + 26 + sway * 1.6, -150); g.lineTo(x - 26 + sway * 1.4, -150); g.quadraticCurveTo(x - 30 + sway * 0.5, -400, x - 30, -700); g.closePath();
        g.fillStyle = '#c8d4e8'; g.fill(); ink(g, 2);
        g.strokeStyle = rgba('#7f8cb0', 0.8); g.lineWidth = 1.2; g.beginPath(); for (const dx of [-14, 0, 14]) { g.moveTo(x + dx, -690); g.quadraticCurveTo(x + dx + sway * 0.6, -400, x + dx + sway * 1.5, -160); } g.stroke();
      }
      // the Hush on the ward wall and ceiling
      for (let i = 0; i < 2; i++) if (rr() < 0.8) vein(g, rr, a + rr() * (b - a), -700 + rr() * 60, 180 + rr() * 200, PI / 2 + (rr() - 0.5) * 1.4, 2.6);
    }));
    // stasis cradles with a lantern each (Rook lit them, one by one)
    for (const cx of CRADLES) { const r2 = cx * 7; add(cx - 90, -160, 180, 165, (g) => cradle(g, cx, U.mulberry32(r2))); }
    for (const sx of [8765, 9965, 10415]) add(sx - 40, -130, 80, 135, (g) => {
      for (let k = 0; k < 3; k++) { const px = sx - 30 + k * 20; rect(g, px - 1.5, -118, 21, 118, INK); rect(g, px, -116, 18, 112, k % 2 ? '#c8d4ee' : '#aab8da'); rect(g, px + 2, -112, 14, 70, 'rgba(230,246,255,0.5)'); }
      rect(g, sx - 32, -6, 64, 6, INK);
    });
    // Rook's post: his chair, his lantern, the tally wall, his squad's helmets
    add(9300, -330, 220, 335, (g) => {
      const x = 9340, rr = U.mulberry32(9340);
      rect(g, x - 6, -300, 160, 150, '#2a3150'); g.strokeStyle = rgba('#dfe8ff', 0.75); g.lineWidth = 1.2; g.beginPath();
      for (let k = 0; k < 120; k++) { const tx = x + 4 + (k % 20) * 7.4, ty = -292 + Math.floor(k / 20) * 22; g.moveTo(tx, ty); g.lineTo(tx + rr() * 1.5, ty + 14); if (k % 5 === 4) { g.moveTo(tx - 30, ty + 12); g.lineTo(tx + 2, ty + 2); } } g.stroke();
      stencil(g, '第六降臨隊　守夜', x + 74, -140, 11, '#7dffcf', { ink: false });
      // chair
      rect(g, x + 10, -48, 50, 6, INK); rect(g, x + 12, -46, 46, 3, '#8a6a4a'); rect(g, x + 12, -42, 4, 42, INK); rect(g, x + 54, -42, 4, 42, INK); rect(g, x + 10, -96, 6, 50, INK);
      // the great lantern + helmets
      lantern(g, x + 90, 0, 1.4, '#7dffcf');
      for (const [hx, col] of [[x + 120, '#5a6a8a'], [x + 150, '#6a5a7a']]) { g.beginPath(); g.arc(hx, -10, 11, PI, 0); g.lineTo(hx + 12, 0); g.lineTo(hx - 12, 0); g.closePath(); g.fillStyle = col; g.fill(); ink(g, 1.6); rect(g, hx - 6, -9, 12, 3, '#7dffcf'); }
    });
    // the great sealed door into the Core (cracked open by crystal)
    add(10560, -900, 300, 905, (g) => {
      const x = 10600, C = enamelC(x), rr = U.mulberry32(10600);
      block(g, x, -820, 180, 820, { body: C.body, lit: C.lit, dark: C.dark });
      g.beginPath(); g.moveTo(x + 90, -820); g.lineTo(x + 90, 0); g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
      g.beginPath(); g.arc(x + 90, -460, 60, 0, TAU); g.strokeStyle = M.goldD; g.lineWidth = 6; g.stroke(); g.strokeStyle = M.gold; g.lineWidth = 3; g.stroke();
      for (let i = 0; i < 4; i++) vein(g, rr, x + 90, -460 + (rr() - 0.5) * 200, 260, (i / 4) * TAU, 3.4);
      cluster(g, x + 90, -300, 2.4, PI * 0.15, rr, 0.45); cluster(g, x + 40, 0, 1.8, -PI / 2 - 0.2, rr, 0.35);
    });

    /* ---------------- Z5: THE HEART OF CANTOR ---------------- */
    // white glass ribs over the nave
    for (let rx = 10900; rx < 13600; rx += 340) {
      const xx = rx;
      if (xx > ARENA.boss[0] + 120 && xx < ARENA.boss[1] - 120) continue;
      add(xx - 60, -1400, 120, 1405, (g) => {
        const rr = U.mulberry32(xx);
        g.beginPath(); g.moveTo(xx - 20, 0); g.lineTo(xx - 16, -900); g.quadraticCurveTo(xx, -1250, xx + 60, -1400); g.lineTo(xx + 40, -1400); g.quadraticCurveTo(xx - 6, -1240, xx + 16, -900); g.lineTo(xx + 20, 0); g.closePath();
        g.fillStyle = '#e6e2f0'; g.fill(); ink(g, 3);
        rect(g, xx - 18, -900, 10, 900, '#9f98c0'); rect(g, xx + 10, -900, 6, 900, '#ffffff');
        strip(g, xx - 1.5, -880, 3, 860, '#ff8fb0', 0.4, 16);
        cluster(g, xx - 14, 0, 1.4, -PI / 2 - 0.5, rr, 0.35);
      });
    }
    // resonance columns (glass cylinders of light) — pulses drawn live
    for (const cx of RESCOLS) add(cx - 50, -760, 100, 765, (g) => rescol(g, cx));
    // the Core console (CANTOR's final log) + lectern
    add(11540, -200, 140, 205, (g) => {
      const x = 11560;
      block(g, x, -110, 90, 110, { body: '#e6e2f0', lit: '#ffffff', dark: '#9f98c0' });
      rect(g, x + 8, -170, 74, 56, INK); rect(g, x + 10, -168, 70, 52, '#1a0c1e');
      g.fillStyle = 'rgba(255,143,176,0.9)'; for (let k = 0; k < 6; k++) g.fillRect(x + 14, -162 + k * 8, 20 + (k * 13) % 40, 2);
      glow(g, x + 45, -140, 60, '#ff8fb0', 0.25);
    });
    // boss arena dressing (kept to the walls: the middle stays clear for CANTOR)
    add(ARENA.boss[0] - 40, -1250, ARENA.boss[1] - ARENA.boss[0] + 80, 1255, (g) => {
      const x0 = ARENA.boss[0], x1 = ARENA.boss[1], rr = U.mulberry32(12150);
      // the observation iris (closed) high above the arena
      irisWindow(g, IRIS.x, IRIS.y, IRIS.r, 0);
      // the score inlaid as a great circle on the floor + crystal at the walls
      g.beginPath(); g.ellipse(IRIS.x, 10, 560, 6, 0, 0, TAU); g.strokeStyle = 'rgba(232,194,122,0.55)'; g.lineWidth = 2.4; g.stroke();
      g.beginPath(); g.ellipse(IRIS.x, 10, 480, 4.5, 0, 0, TAU); g.strokeStyle = 'rgba(255,240,248,0.35)'; g.lineWidth = 1.2; g.stroke();
      cluster(g, x0 + 20, 0, 2.2, -PI / 2 + 0.4, rr, 0.45); cluster(g, x1 - 20, 0, 2.2, -PI / 2 - 0.4, rr, 0.45);
      for (let i = 0; i < 4; i++) vein(g, rr, (i < 2 ? x0 + 10 : x1 - 10), -20 - rr() * 500, 260, (i < 2 ? 0 : PI) + (rr() - 0.5) * 0.8, 3);
    });

    // anchor plates: intact under statues (drawn by them) · shattered where the Hushed can wake
    for (const hx of HUSHED_SPOTS) add(hx - 40, -30, 80, 36, (g) => plate(g, hx, 1, 26, true, U.mulberry32(hx)));
    // a service ladder up to the corridor gantry
    add(2836, -200, 44, 205, (g) => {
      for (const lx of [2842, 2862]) { rect(g, lx - 2, -175, 6, 175, INK); rect(g, lx - 1, -175, 3, 175, '#c8d4ee'); }
      for (let y = -160; y < 0; y += 18) { rect(g, 2842, y, 22, 4, INK); rect(g, 2843, y + 1, 20, 2, '#e9eff6'); }
    });
    // catwalks last (walls behind them)
    for (const p of level.oneways) { const pp = p; add(p.x - 40, p.y - 680, p.w + 80, 760, (g) => catwalk(g, pp)); }
    return objs;
  }
  function door(g, x, num, col, rr) {
    rect(g, x - 52, -236, 104, 236, INK); rect(g, x - 48, -232, 96, 232, '#e9eff6');
    rect(g, x - 42, -224, 84, 224, col); rect(g, x - 42, -224, 10, 224, mixH(col, '#2a3150', 0.3)); rect(g, x + 36, -224, 6, 224, mixH(col, '#ffffff', 0.4));
    rect(g, x - 1, -224, 2, 224, rgba(INK, 0.6));
    rect(g, x - 30, -200, 22, 40, INK); rect(g, x - 28, -198, 18, 36, rr() < 0.5 ? '#ffe0b0' : '#c8e8ff');
    rect(g, x + 8, -120, 4, 20, INK);
    rect(g, x - 34, -262, 68, 20, INK); rect(g, x - 32, -260, 64, 16, '#16203a'); stencil(g, num, x, -252, 10, '#dff6ff', { ink: false, weight: 700, font: EN_FONT });
    // doormat + shoes
    rect(g, x - 40, -4, 80, 4, '#8a5a4a');
    if (rr() < 0.7) { g.fillStyle = INK; g.beginPath(); g.ellipse(x + 50, -4, 9, 4, 0, 0, TAU); g.ellipse(x + 64, -4, 9, 4, 0, 0, TAU); g.fill(); g.fillStyle = rr() < 0.5 ? '#c84a5a' : '#4a6aa8'; g.beginPath(); g.ellipse(x + 50, -5, 7, 2.6, 0, 0, TAU); g.ellipse(x + 64, -5, 7, 2.6, 0, 0, TAU); g.fill(); }
    if (rr() < 0.6) { g.fillStyle = INK; g.beginPath(); g.arc(x - 64, -16, 13, 0, TAU); g.fill(); g.fillStyle = '#3f8a5a'; g.beginPath(); g.arc(x - 64, -16, 11, 0, TAU); g.fill(); g.fillStyle = '#86c47e'; g.beginPath(); g.arc(x - 60, -21, 5, 0, TAU); g.fill(); rect(g, x - 74, -10, 20, 10, '#b0866a'); }
  }
  function cradle(g, cx, rr) {
    // a stasis bed under a frosted canopy, a sleeper beneath a pastel blanket, a lantern lit by Rook — and what the families left
    const v = rr(), child = rr() < 0.25, blanket = ['#e8eef8', '#f2dfe6', '#dfeadf', '#e6e0f2', '#f4ead6'][Math.floor(rr() * 5)];
    glow(g, cx, -20, 80, '#7ff6ff', 0.12);
    if (v > 0.2 && v < 0.34) {   // IV stand
      const ix = cx - 74; rect(g, ix - 1.5, -150, 3, 150, INK); rect(g, ix - 12, -150, 24, 3, INK);
      g.beginPath(); g.moveTo(ix + 8, -148); g.lineTo(ix + 16, -148); g.lineTo(ix + 14, -126); g.lineTo(ix + 10, -126); g.closePath(); g.fillStyle = 'rgba(200,240,255,0.7)'; g.fill(); ink(g, 1);
      g.strokeStyle = 'rgba(200,240,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(ix + 12, -126); g.quadraticCurveTo(ix + 30, -60, cx - 40, -50); g.stroke();
      rect(g, ix - 10, -4, 20, 4, INK);
    }
    rect(g, cx - 62, -46, 124, 10, INK); rect(g, cx - 60, -44, 120, 6, '#c8d4ee');
    rect(g, cx - 56, -36, 6, 36, INK); rect(g, cx + 50, -36, 6, 36, INK);
    rect(g, cx - 60, -38, 120, 6, '#5a6a96');
    // sleeper beneath the blanket
    g.beginPath();
    if (child) { g.moveTo(cx - 40, -46); g.quadraticCurveTo(cx - 20, -58, cx + 6, -55); g.quadraticCurveTo(cx + 18, -58, cx + 22, -52); g.lineTo(cx + 26, -46); }
    else { g.moveTo(cx - 52, -46); g.quadraticCurveTo(cx - 30, -62, cx + 10, -58); g.quadraticCurveTo(cx + 30, -66, cx + 40, -58); g.lineTo(cx + 50, -46); }
    g.closePath(); g.fillStyle = blanket; g.fill(); ink(g, 1.6);
    g.strokeStyle = rgba(INK, 0.3); g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 20, -50); g.quadraticCurveTo(cx, -54, cx + 18, -50); g.stroke();
    const hx = child ? cx - 34 : cx - 46;
    g.beginPath(); g.arc(hx, -54, child ? 7 : 8, 0, TAU); g.fillStyle = M.porcSkin; g.fill(); ink(g, 1.4);
    g.beginPath(); g.arc(hx - 1, -55, child ? 7.4 : 8.4, PI * 0.9, PI * 1.9); g.fillStyle = ['#3a3044', '#6a5040', '#c8c4d0', '#2a2633'][Math.floor(rr() * 4)]; g.fill(); ink(g, 1);
    // canopy
    g.beginPath(); g.moveTo(cx - 60, -46); g.quadraticCurveTo(cx - 60, -104, cx, -108); g.quadraticCurveTo(cx + 60, -104, cx + 60, -46);
    g.fillStyle = 'rgba(190,235,255,0.22)'; g.fill(); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke(); g.strokeStyle = 'rgba(230,250,255,0.8)'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 40, -88); g.quadraticCurveTo(cx - 20, -102, cx + 6, -102); g.stroke();
    if (v >= 0.34 && v < 0.46) {   // the Hush has cracked this canopy
      g.save(); g.beginPath(); g.moveTo(cx - 60, -46); g.quadraticCurveTo(cx - 60, -104, cx, -108); g.quadraticCurveTo(cx + 60, -104, cx + 60, -46); g.clip(); vein(g, rr, cx + (rr() - 0.5) * 60, -100, 80, PI / 2 + (rr() - 0.5), 1.6); g.restore();
      cluster(g, cx + 20, -104, 0.8, -PI / 2 + 0.3, rr, 0.25);
    }
    if (v < 0.2) {   // a family's visit: flowers in a cup and a card
      const fx = cx + 30;
      rect(g, fx - 6, -60, 12, 14, INK); rect(g, fx - 5, -59, 10, 12, '#e9eff6');
      for (const [dx, dy, c] of [[-4, -70, '#ff9fb8'], [1, -74, '#fff3a8'], [5, -68, '#ffffff']]) { g.strokeStyle = '#3f7a4e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(fx, -60); g.lineTo(fx + dx, dy + 3); g.stroke(); g.beginPath(); g.arc(fx + dx, dy, 3, 0, TAU); g.fillStyle = c; g.fill(); ink(g, 0.8); }
      g.save(); g.translate(cx - 18, -48); g.rotate(-0.12); rect(g, -9, -7, 18, 12, '#fff8e6'); g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(-9, -7, 18, 12); g.strokeStyle = '#e8506a'; g.beginPath(); g.moveTo(-2, -2); g.arc(-1, -2.5, 1.4, PI, 0); g.arc(1.8, -2.5, 1.4, PI, 0); g.lineTo(0.4, 2); g.closePath(); g.stroke(); g.restore();
    }
    lantern(g, cx + 52, -2, 0.8, '#ffbe6b');
  }
  function lantern(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s, s);
    glow(g, 0, -16, 46, col, 0.3);
    poly(g, [[-9, -4], [9, -4], [7, -28], [-7, -28]]); g.fillStyle = rgba(col, 0.55); g.fill(); ink(g, 1.6);
    rect(g, -10, -4, 20, 4, INK); rect(g, -9, -3, 18, 2, M.brass);
    poly(g, [[-9, -28], [9, -28], [0, -36]]); g.fillStyle = M.brass; g.fill(); ink(g, 1.4);
    g.beginPath(); g.arc(0, -40, 4, PI, 0); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, -14, 2.2, 4.5, 0, 0, TAU); g.fill();
    g.restore();
  }
  const RESCOLS = [11120, 11440, ARENA.boss[0] + 60, ARENA.boss[1] - 60];
  function rescol(g, cx) {
    const top = -700, bot = 0, rr = U.mulberry32(cx);
    rect(g, cx - 26, top - 30, 52, 30, INK); rect(g, cx - 24, top - 28, 48, 26, '#e6e2f0'); rect(g, cx - 24, top - 28, 48, 5, '#ffffff'); rect(g, cx - 24, top - 8, 48, 4, '#9f98c0');
    rect(g, cx - 22, top, 44, bot - top, INK);
    const cg = g.createLinearGradient(cx - 20, 0, cx + 20, 0);
    cg.addColorStop(0, 'rgba(38,58,108,0.96)'); cg.addColorStop(0.3, 'rgba(150,212,250,0.94)'); cg.addColorStop(0.52, 'rgba(242,252,255,0.98)'); cg.addColorStop(0.62, 'rgba(170,226,255,0.94)'); cg.addColorStop(1, 'rgba(38,58,108,0.96)');
    g.fillStyle = cg; g.fillRect(cx - 19, top, 38, bot - top);
    g.save(); g.beginPath(); g.rect(cx - 19, top, 38, bot - top); g.clip();
    vein(g, rr, cx - 6, bot - 20, 260, -PI / 2 + 0.15, 2.4); vein(g, rr, cx + 8, bot - 120, 160, -PI / 2 - 0.2, 1.8);
    g.restore();
    for (let y = top + 40; y < bot - 20; y += 90) { rect(g, cx - 25, y, 50, 8, INK); rect(g, cx - 23, y + 1, 46, 5, M.gold); rect(g, cx - 23, y + 1, 46, 1.5, M.goldL); }
    rect(g, cx - 30, bot - 26, 60, 26, INK); rect(g, cx - 28, bot - 24, 56, 24, '#e6e2f0'); rect(g, cx - 28, bot - 24, 10, 24, '#9f98c0'); rect(g, cx - 28, bot - 24, 56, 3, '#ffffff');
    glow(g, cx, (top + bot) / 2, 120, '#9fe6ff', 0.14);
    cluster(g, cx - 24, bot, 1.2, -PI / 2 - 0.5, rr, 0.3);
  }
  // the Core's observation iris: k 0 = closed petals · 1 = fully open (open state drawn live in the reveal)
  function irisWindow(g, cx, cy, R, k) {
    g.beginPath(); g.arc(cx, cy, R + 34, 0, TAU); g.fillStyle = INK; g.fill();
    g.beginPath(); g.arc(cx, cy, R + 30, 0, TAU); g.fillStyle = '#e6e2f0'; g.fill();
    g.beginPath(); g.arc(cx, cy, R + 30, PI * 1.6, PI * 0.2); g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.stroke();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; g.save(); g.translate(cx + Math.cos(a) * (R + 16), cy + Math.sin(a) * (R + 16)); g.rotate(a); rect(g, -4, -8, 8, 16, INK); rect(g, -2.5, -6.5, 5, 13, i % 4 === 0 ? M.gold : '#9f98c0'); g.restore(); }
    irisPetals(g, cx, cy, R, k);
  }
  function irisPetals(g, cx, cy, R, k) {
    const n = 14, open = clamp(k, 0, 1);
    if (open > 0.995) return;
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + open * 0.9;
      const reach = R * (1 - open) * 1.05;
      const p0 = [cx + Math.cos(a) * R * 1.1, cy + Math.sin(a) * R * 1.1], p1 = [cx + Math.cos(a + 0.5) * R * 1.1, cy + Math.sin(a + 0.5) * R * 1.1];
      const tip = [cx + Math.cos(a + 1.6) * (R - reach) * 0.1 + Math.cos(a + 0.9) * (R - reach), cy + Math.sin(a + 1.6) * (R - reach) * 0.1 + Math.sin(a + 0.9) * (R - reach)];
      poly(g, [p0, p1, tip]); g.fillStyle = i % 2 ? '#d9d2e8' : '#bdb4d6'; g.fill(); ink(g, 2.2);
    }
    g.restore();
    if (open < 0.05) { g.beginPath(); g.arc(cx, cy, 22, 0, TAU); g.fillStyle = INK; g.fill(); g.beginPath(); g.arc(cx, cy, 16, 0, TAU); g.fillStyle = M.crim; g.fill(); }
  }

  /* =========================================================================================
     SKY (screen space): space through the windows — stars, the dead world below with the Hush's
     crimson web on its night side, the Ladder's tether falling to it from the docking collar
     ========================================================================================= */
  const SKY = { stars: null, planet: null };
  function buildStars() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d'), rng = U.mulberry32(6061);
    for (let i = 0; i < 70; i++) {
      const x = rng() * 1024, y = rng() * 512, r = 30 + rng() * 90, crim = rng() < 0.18;
      for (const ox of [-1024, 0, 1024]) { const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, r); gr.addColorStop(0, crim ? `rgba(255,80,130,${0.025 + rng() * 0.03})` : `rgba(120,150,255,${0.03 + rng() * 0.04})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y - r, r * 2, r * 2); }
    }
    for (let i = 0; i < 1200; i++) {
      const x = rng() * 1024, y = rng() * 512, m = rng(), s = m < 0.93 ? 0.6 + rng() * 0.8 : 1.4 + rng() * 1.4;
      const col = rng() < 0.18 ? '255,222,196' : rng() < 0.4 ? '196,222,255' : '255,255,255';
      g.fillStyle = `rgba(${col},${0.3 + rng() * 0.65})`; g.fillRect(x, y, s, s);
      if (m > 0.99) { g.fillStyle = `rgba(${col},0.5)`; g.fillRect(x - 3, y + s / 2 - 0.4, 6 + s, 0.8); g.fillRect(x + s / 2 - 0.4, y - 3, 0.8, 6 + s); }
    }
    return c;
  }
  function buildPlanet() {
    // the dead world from geostationary orbit: a curved terminator, cyclones, dull continents, the Hush's crimson web on the night side
    const W = 2048, H = 560, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), rng = U.mulberry32(6063);
    const R = 2900, cx = W * 0.5, cy = R + 60;
    for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(cx, cy, R + 6 + k * 7, PI * 1.08, PI * 1.92); g.strokeStyle = `rgba(150,220,255,${0.16 - k * 0.025})`; g.lineWidth = 9; g.stroke(); }
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
    // ocean in three hard cel tones; the light comes from the upper right, so the terminator curves
    const sun = { x: W * 1.15, y: -900 };
    const og = g.createRadialGradient(sun.x, sun.y, 300, sun.x, sun.y, 2300);
    og.addColorStop(0, '#4f9fcc'); og.addColorStop(0.5, '#4f9fcc'); og.addColorStop(0.5, '#2a6c9a'); og.addColorStop(0.66, '#2a6c9a'); og.addColorStop(0.66, '#14304f'); og.addColorStop(0.8, '#14304f'); og.addColorStop(0.8, '#070d1d'); og.addColorStop(1, '#070d1d');
    g.fillStyle = og; g.fillRect(0, 0, W, H);
    const lightAt = (x, y) => { const d = Math.hypot(x - sun.x, y - sun.y) / 2300; return d < 0.5 ? 3 : d < 0.66 ? 2 : d < 0.8 ? 1 : 0; };
    // continents: dull and dead, inked
    for (let i = 0; i < 10; i++) {
      const x = rng() * W, y = 90 + rng() * 380, pts = [];
      for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU, r = (50 + rng() * 120) * (0.65 + 0.35 * Math.sin(a * 3 + i)); pts.push([x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 0.45]); }
      blob(g, pts); const L = lightAt(x, y);
      g.fillStyle = ['#0b1220', '#283044', '#5d6656', '#8a8f72'][L]; g.fill(); g.strokeStyle = 'rgba(11,6,18,0.55)'; g.lineWidth = 2; g.stroke();
    }
    // the Hush on the continents: a crimson web, glowing on the night side
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 34; i++) {
      let x = rng() * W, y = 90 + rng() * 380; const L = lightAt(x, y);
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 7; k++) { x += (rng() - 0.5) * 110; y += (rng() - 0.5) * 34; g.lineTo(x, y); }
      g.strokeStyle = `rgba(255,42,85,${L >= 2 ? 0.12 : 0.3 + rng() * 0.35})`; g.lineWidth = 1 + rng() * 1.4; g.stroke();
    }
    for (let i = 0; i < 40; i++) { const x = rng() * W, y = 90 + rng() * 380; if (lightAt(x, y) > 1) continue; const r = 6 + rng() * 22; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,60,100,0.32)'); gr.addColorStop(1, 'rgba(255,60,100,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.globalCompositeOperation = 'source-over';
    // clouds: cyclone spirals + drifting masses, two cel tones each
    const cloud = (x, y, r) => { const L = lightAt(x, y); return [['rgba(40,52,84,0.55)', 'rgba(60,74,110,0.5)'], ['rgba(120,140,176,0.6)', 'rgba(160,178,210,0.55)'], ['rgba(206,222,242,0.85)', 'rgba(246,250,255,0.9)'], ['rgba(222,236,250,0.9)', 'rgba(255,255,255,0.95)']][L]; };
    for (let i = 0; i < 7; i++) {
      const sx = rng() * W, sy = 110 + rng() * 330, turns = 1.4 + rng(), dir = rng() < 0.5 ? 1 : -1;
      for (let k = 0; k < 40; k++) {
        const u = k / 40, a = dir * u * turns * TAU, rr = 6 + u * 90, x = sx + Math.cos(a) * rr * 1.9, y = sy + Math.sin(a) * rr * 0.42, r = (4 + (1 - u) * 9) * (0.7 + rng() * 0.6);
        const [c0, c1] = cloud(x, y, r);
        g.fillStyle = c0; g.beginPath(); g.ellipse(x, y + 1.5, r * 1.6, r * 0.5, 0, 0, TAU); g.fill();
        g.fillStyle = c1; g.beginPath(); g.ellipse(x + 1, y, r * 1.2, r * 0.36, 0, 0, TAU); g.fill();
      }
    }
    for (let i = 0; i < 60; i++) {
      const x = rng() * W, y = 70 + rng() * 440, n = 3 + Math.floor(rng() * 4);
      for (let k = 0; k < n; k++) { const px = x + (k - n / 2) * 18 + rng() * 8, py = y + (rng() - 0.5) * 6, r = 6 + rng() * 10; const [c0, c1] = cloud(px, py, r); g.fillStyle = c0; g.beginPath(); g.ellipse(px, py + 1.5, r * 1.7, r * 0.5, 0, 0, TAU); g.fill(); g.fillStyle = c1; g.beginPath(); g.ellipse(px + 1.5, py, r * 1.2, r * 0.34, 0, 0, TAU); g.fill(); }
    }
    // limb darkening
    const sh = g.createRadialGradient(cx, cy, R - 160, cx, cy, R); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(4,8,20,0.5)'); g.fillStyle = sh; g.fillRect(0, 0, W, H);
    g.restore();
    g.beginPath(); g.arc(cx, cy, R, PI * 1.12, PI * 1.88); g.strokeStyle = 'rgba(11,6,18,0.9)'; g.lineWidth = 4; g.stroke();
    g.beginPath(); g.arc(cx, cy, R + 1, PI * 1.55, PI * 1.88); g.strokeStyle = 'rgba(220,248,255,0.95)'; g.lineWidth = 2.4; g.stroke();
    return c;
  }
  const skyInit = () => { if (!SKY.stars) { SKY.stars = buildStars(); SKY.planet = buildPlanet(); } };
  function drawSky(ctx, cam, W, H, S, time) {
    skyInit();
    const t = tintAt(cam.x), core = coreAt(cam.x);
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, mixH('#02040b', '#060208', core)); gr.addColorStop(0.6, mixH('#070d1f', '#12060f', core)); gr.addColorStop(1, mixH('#0e1a36', '#22081a', core));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // stars (slow parallax, faint drift)
    const sS = S * 0.9, iw = 1024 * sS;
    let ox = -(((cam.x * 0.004 + time * 0.6) * S) % iw); if (ox > 0) ox -= iw;
    ctx.globalAlpha = 0.95;
    for (let x = ox; x < W; x += iw) ctx.drawImage(SKY.stars, x, -cam.y * 0.006 * S - 30 * S, iw + 1, 512 * sS);
    ctx.globalAlpha = 1;
    // the world below (its limb rides just above the deck line)
    const pw = W * 2.1, ph = pw * (560 / 2048), py = H * 0.31 - cam.y * 0.02 * S, px = W / 2 - pw / 2 - (cam.x * 0.0045) * S, limbY = py + 60 * (pw / 2048);
    ctx.drawImage(SKY.planet, px, py, pw, ph);
    // the Ladder's tether falling from the docking collar to the world (concourse only)
    const hk = hallAt(cam.x);
    if (hk > 0.01) {
      const tx = W * 0.32 - cam.x * 0.05 * S, ty0 = limbY;
      ctx.globalAlpha = hk;
      const tg = ctx.createLinearGradient(0, 0, 0, ty0 + 40 * S);
      tg.addColorStop(0, 'rgba(230,248,255,0.95)'); tg.addColorStop(1, 'rgba(160,220,255,0.25)');
      ctx.fillStyle = 'rgba(160,220,255,0.12)'; ctx.fillRect(tx - 7 * S, 0, 14 * S, ty0 + 40 * S);
      ctx.fillStyle = tg; ctx.fillRect(tx - 1.4 * S, 0, 2.8 * S, ty0 + 40 * S);
      for (let i = 0; i < 3; i++) { const k = ((time * 0.05 + i / 3) % 1), cy2 = k * (ty0 + 30 * S); ctx.fillStyle = `rgba(255,214,150,${0.9 * (1 - k)})`; ctx.fillRect(tx - 2.2 * S, cy2, 4.4 * S, 4.4 * S); }
      ctx.globalAlpha = 1;
    }
    // the Core's crimson breath, deep inside the ship
    if (core > 0.01 || t > 0.4) {
      ctx.globalCompositeOperation = 'lighter';
      const k = Math.max(core, (t - 0.4) * 0.6), cgl = ctx.createRadialGradient(W * 0.7, H * 0.45, 0, W * 0.7, H * 0.45, W * 0.7);
      cgl.addColorStop(0, `rgba(255,42,85,${0.08 * k * (0.85 + 0.15 * Math.sin(time * 1.3))})`); cgl.addColorStop(1, 'rgba(255,42,85,0)');
      ctx.fillStyle = cgl; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    return true;
  }

  /* =========================================================================================
     LIVE ATMOSPHERE (screen space) — dust motes in the light, garden beams, the stasis pulse,
     the epilogue washes. Kept light: one gradient per beam, plain rects for motes.
     ========================================================================================= */
  const ATM = (() => { const r = U.mulberry32(6150); return { motes: Array.from({ length: 90 }, () => ({ x: r(), y: r(), z: 0.4 + r() * 1.3, s: 0.6 + r() * 1.6, p: r() * 10 })) }; })();
  const PULSE = { t: -1, dur: 2.6, from: 0, to: 0, big: false, warm: false, next: 18, barked: false };
  const EPI = { mode: null, wake: 0, dark: 0, iris: 0, gold: 0 };
  function pulseX(t) { return lerp(PULSE.from, PULSE.to, U.easeInOutSine(clamp(t / PULSE.dur, 0, 1))); }
  function drawAtmos(ctx, cam, W, H, S, time) {
    const low = G.Quality.low, dome = domeAt(cam.x), core = coreAt(cam.x), ward = wardAt(cam.x);
    // light beams from the dome (atrium)
    if (dome > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      const nb = low ? 3 : 5;
      for (let i = 0; i < nb; i++) {
        const bx = ((i * 0.23 + 0.08) * W * 1.4 - cam.x * 0.35 * S) % (W * 1.4), x = (bx + W * 1.4) % (W * 1.4) - W * 0.2;
        const wd = (60 + (i % 3) * 40) * S, sway = Math.sin(time * 0.25 + i * 1.7) * 20 * S;
        const lg = ctx.createLinearGradient(x, 0, x - 260 * S, H);
        const a = (0.06 + 0.03 * Math.sin(time * 0.4 + i)) * dome;
        lg.addColorStop(0, `rgba(255,236,190,${a * 1.6})`); lg.addColorStop(0.7, `rgba(255,226,170,${a * 0.6})`); lg.addColorStop(1, 'rgba(255,226,170,0)');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x + sway, 0); ctx.lineTo(x + wd + sway, 0); ctx.lineTo(x + wd - 300 * S, H); ctx.lineTo(x - 300 * S - wd * 0.3, H); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // motes: cool dust in the corridors, gold in the garden light, teal in the ward, crimson embers in the Core
    const n = low ? 36 : 80;
    ctx.globalCompositeOperation = 'lighter';
    const col = core > 0.5 ? '255,110,140' : ward > 0.5 ? '150,255,220' : dome > 0.5 ? '255,232,180' : '210,236,255';
    for (let i = 0; i < n; i++) {
      const m = ATM.motes[i];
      const px = ((m.x * W * 1.4 - cam.x * m.z * S * 0.6 + Math.sin(time * 0.3 + m.p) * 30 * S) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
      const rise = core > 0.5 ? 26 : 6;
      const py = ((m.y * H - time * rise * m.z * S - cam.y * m.z * S * 0.4 + Math.sin(time * 0.7 + m.p) * 12 * S) % H + H) % H;
      const a = (0.22 + 0.28 * Math.sin(time * 1.4 + m.p)) * (m.z > 1 ? 0.8 : 0.5);
      ctx.fillStyle = `rgba(${col},${a})`;
      const r = m.s * S * m.z * 0.9;
      ctx.fillRect(px, py, r, r);
    }
    ctx.globalCompositeOperation = 'source-over';
    // stasis pulse: a pale flash as the wavefront passes the camera
    if (PULSE.t >= 0) {
      const sx = W / 2 + (pulseX(PULSE.t) - cam.x) * S, k = Math.max(0, 1 - Math.abs(sx - W / 2) / (W * 0.8));
      if (k > 0 && G.game.settings.flashes !== false) { ctx.fillStyle = PULSE.warm ? `rgba(255,232,190,${k * 0.2})` : `rgba(220,248,255,${k * (PULSE.big ? 0.22 : 0.08)})`; ctx.fillRect(0, 0, W, H); }
    }
    // epilogues
    if (EPI.gold > 0.01) {
      ctx.globalCompositeOperation = G.Quality.full ? 'soft-light' : 'source-over'; ctx.fillStyle = `rgba(255,196,130,${(G.Quality.full ? 0.35 : 0.12) * EPI.gold})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, W * 0.75);
      gg.addColorStop(0, `rgba(255,214,150,${0.2 * EPI.gold})`); gg.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (EPI.dark > 0.01) {
      const ix = W / 2 + (IRIS.x - cam.x) * S, iy = H / 2 + (IRIS.y - cam.y) * S, ir = IRIS.r * S;
      const dg = ctx.createRadialGradient(ix, iy, ir * (0.9 + (1 - EPI.iris) * 2), ix, iy, ir * 1.9 + W * 0.3);
      dg.addColorStop(0, `rgba(4,2,8,${0.18 * EPI.dark})`); dg.addColorStop(1, `rgba(4,2,8,${0.62 * EPI.dark})`);
      ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
    }
    return true;
  }
  // near-camera silhouettes (parallax 1.35): lamp cables, branches, curtain edges, ribs
  function drawForeground(ctx, cam, S, game) {
    if (game.focus && game.focus.zoom < 0.9) return true;
    const f = 1.35, span = 1300, base = Math.floor((cam.x * f - 1300) / span), t = game.realTime;
    for (let i = base; i < base + 4; i++) {
      const rng = U.mulberry32(i * 613 + 9);
      if (rng() < 0.45) continue;
      const x = cam.x + (i * span + rng() * 500 - cam.x * f), z = zoneOf(x);
      ctx.save();
      if (z === 2) {
        // leafy branch dipping in from the top
        const top = cam.y - 340, sway = Math.sin(t * 0.6 + i) * 6;
        ctx.fillStyle = 'rgba(6,14,12,0.92)';
        ctx.beginPath(); ctx.moveTo(x - 260, top - 40); ctx.quadraticCurveTo(x, top + 60, x + 240 + sway, top + 30); ctx.lineTo(x + 250 + sway, top + 16); ctx.quadraticCurveTo(x, top + 36, x - 250, top - 60); ctx.fill();
        for (let k = 0; k < 12; k++) { const lx = x - 220 + k * 40 + sway * (k / 12), ly = top + 10 + Math.sin(k * 1.3) * 26 + 20; ctx.beginPath(); ctx.ellipse(lx, ly, 22, 10, k * 0.7, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(160,230,150,0.25)'; for (let k = 0; k < 12; k += 3) ctx.fillRect(x - 220 + k * 40, top + 4 + Math.sin(k * 1.3) * 26 + 10, 18, 1.4);
      } else if (z === 3) {
        // a curtain valance swagged across the top of the frame (never over the fight)
        const sway = Math.sin(t * 0.5 + i) * 5, top = cam.y - 440;
        ctx.fillStyle = 'rgba(8,10,22,0.93)';
        ctx.beginPath(); ctx.moveTo(x - 260, top); ctx.lineTo(x + 260, top); ctx.lineTo(x + 250, top + 120 + sway);
        for (let k = 4; k >= 0; k--) { const px = x - 250 + k * 125; ctx.quadraticCurveTo(px + 62, top + 70 + sway, px, top + 125 + sway * (k % 2 ? 1 : -1)); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(125,255,207,0.2)'; for (let k = 0; k < 4; k++) ctx.fillRect(x - 188 + k * 125, top + 92 + sway, 2, 2);
      } else if (z === 4) {
        // the foot of a vault rib crossing the top corner + a hanging chain and lamp
        const top = cam.y - 440;
        ctx.fillStyle = 'rgba(10,6,14,0.94)';
        ctx.beginPath(); ctx.moveTo(x - 200, top); ctx.quadraticCurveTo(x - 40, top + 40, x + 30, top + 170); ctx.lineTo(x + 70, top + 160); ctx.quadraticCurveTo(x, top + 10, x - 120, top - 20); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,190,210,0.28)'; ctx.fillRect(x + 40, top + 140, 2, 22);
        ctx.strokeStyle = 'rgba(10,6,14,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 180, top); ctx.lineTo(x + 180 + Math.sin(t + i) * 4, top + 150); ctx.stroke();
        ctx.fillStyle = 'rgba(10,6,14,0.95)'; ctx.fillRect(x + 168 + Math.sin(t + i) * 4, top + 150, 24, 18);
      } else {
        // a hanging lamp on its cable
        const lx = x, ly = cam.y - 250 - rng() * 60, sway = Math.sin(t * 0.8 + i) * 5;
        ctx.strokeStyle = 'rgba(6,8,18,0.92)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(lx, cam.y - 420); ctx.lineTo(lx + sway, ly); ctx.stroke();
        ctx.fillStyle = 'rgba(6,8,18,0.95)'; ctx.beginPath(); ctx.moveTo(lx + sway - 30, ly + 22); ctx.lineTo(lx + sway + 30, ly + 22); ctx.lineTo(lx + sway + 12, ly); ctx.lineTo(lx + sway - 12, ly); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(220,245,255,0.45)'; ctx.fillRect(lx + sway - 26, ly + 22, 52, 2);
      }
      ctx.restore();
    }
    return true;
  }

  /* =========================================================================================
     LIVE WORLD BITS (world space, per frame; only what is on screen)
     ========================================================================================= */
  const SPR = {};
  function glowSprite(rgb) {
    if (SPR[rgb]) return SPR[rgb];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.35, `rgba(${rgb},0.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (SPR[rgb] = c);
  }
  const FLICK = [[1720, -520], [570, -640], [2800, -640], [3120, -640], [3600, -640], [4240, -640], [4880, -640]];
  const CONG = [
    { x: ARENA.boss[0] + 90, face: 1, pose: 'sing', wake: 'wakeA', look: { cloth: '#9a5f66', legs: '#4a4256', skirt: 0.8, hairStyle: 'long', hair: '#3a2a2a', skin: '#f2c9a8' } },
    { x: ARENA.boss[0] + 150, face: 1, pose: 'sing', wake: 'wakeB', look: { child: true, cloth: '#e0a05a', legs: '#4a5a86', hairStyle: 'short', hair: '#3a2a22', skin: '#f6d2b4' }, s: 0.62 },
    { x: ARENA.boss[0] + 215, face: 1, pose: 'sing', wake: 'wakeA', look: { cloth: '#5f6f86', legs: '#2a3458', coat: 'long', hairStyle: 'short', hair: '#2a2a33', skin: '#d8a888' } },
    { x: ARENA.boss[1] - 215, face: -1, pose: 'sing', wake: 'wakeB', look: { cloth: '#7d8f6a', legs: '#4a4256', skirt: 0.8, hairStyle: 'bun', hair: '#e8e8ee', skin: '#f0caa8' } },
    { x: ARENA.boss[1] - 150, face: -1, pose: 'sing', wake: 'wakeA', look: { child: true, cloth: '#9fb0d8', legs: '#4a4256', hairStyle: 'pony', hair: '#5a3a2a', skin: '#f2c9a8' }, s: 0.62 },
    { x: ARENA.boss[1] - 90, face: -1, pose: 'sing', wake: 'wakeB', look: { cloth: '#a3826a', legs: '#4c566e', hairStyle: 'cap', hatCol: '#3f4a6a', skin: '#c89070' } },
  ];
  function figCanvas(c, awake) {
    const key = awake ? 'cvA' : 'cvF';
    if (c[key]) return c[key];
    const s = (c.s || 0.96) * 2, w = Math.ceil(120 * s), h = Math.ceil(150 * s);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    statue(g, w / 2, h - 10, s, c.face, awake ? c.wake : c.pose, Object.assign({ acc: awake ? null : 'book' }, c.look), { awake, noPlate: true });
    c[key] = cv; return cv;
  }
  function drawCongregation(ctx, game) {
    const k = EPI.wake;
    for (let i = 0; i < CONG.length; i++) {
      const c = CONG[i], kk = clamp(k * 1.6 - i * 0.1, 0, 1);
      const fz = figCanvas(c, false), w = fz.width / 2, h = fz.height / 2;
      if (kk < 1) { if (kk === 0) plateLive(ctx, c.x, 1, 24 * (c.s || 0.96) / 0.96); ctx.globalAlpha = 1 - kk; ctx.drawImage(fz, c.x - w / 2, 5 - h, w, h); ctx.globalAlpha = 1; }
      if (kk > 0) { const aw = figCanvas(c, true); ctx.globalAlpha = kk; ctx.drawImage(aw, c.x - w / 2, 5 - h, w, h); ctx.globalAlpha = 1; }
      if (kk > 0 && kk < 1 && game.dtVis > 0 && Math.random() < 0.3) { G.FX.shards(c.x, -60 * (c.s || 1), 1, '#e8f6ff', 160); G.FX.ember(c.x, -70, 1, '#ffe2a0', { w: 30, h: 60, up: 60 }); }
    }
  }
  function plateLive(ctx, x, y, r) {
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.24, 0, 0, TAU); ctx.fillStyle = 'rgba(127,246,255,0.13)'; ctx.fill(); ctx.strokeStyle = 'rgba(127,246,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // the Rest beyond the iris: a staff of light across the stars, and hanging from it, a vast black whole-rest that eats the starlight
  function drawReveal(ctx, game) {
    const k = EPI.iris; if (k <= 0) return;
    const cx = IRIS.x, cy = IRIS.y, R = IRIS.r, t = game.realTime;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.fillStyle = '#02030a'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    skyInit(); ctx.globalAlpha = 0.95; ctx.drawImage(SKY.stars, cx - R * 1.7, cy - R * 0.85, R * 3.4, R * 1.7); ctx.globalAlpha = 1;
    ctx.translate(cx, cy); ctx.rotate(-0.07);
    // the staff: five threads of light running out of frame (the second one carries the rest)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const y = -84 + i * 19, main = i === 1;
      if (main) { ctx.fillStyle = 'rgba(255,214,160,0.18)'; ctx.fillRect(-R * 1.3, y - 4, R * 2.6, 8); }
      ctx.fillStyle = `rgba(255,238,206,${main ? 0.92 : 0.3 + 0.06 * Math.sin(t * 0.7 + i)})`; ctx.fillRect(-R * 1.3, y - (main ? 1 : 0.5), R * 2.6, main ? 2 : 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    // the whole rest: flat, vast, and darker than the space around it
    const rw = R * 1.18, rh = R * 0.44, ry = -84 + 19 + 1;
    const cg = ctx.createRadialGradient(0, ry + rh / 2, rh * 0.3, 0, ry + rh / 2, rw * 0.95);
    cg.addColorStop(0, 'rgba(0,0,0,0.9)'); cg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = cg; ctx.fillRect(-R * 1.2, -R, R * 2.4, R * 2);
    const breath = 0.5 + 0.5 * Math.sin(t * 0.6);
    ctx.save(); ctx.translate(0, ry + rh + 6); ctx.scale(1, 0.32);
    const ag = ctx.createRadialGradient(0, 0, 0, 0, 0, rw * 0.62); ag.addColorStop(0, `rgba(255,42,85,${0.2 + 0.08 * breath})`); ag.addColorStop(1, 'rgba(255,42,85,0)');
    ctx.fillStyle = ag; ctx.fillRect(-rw * 0.62, -rw * 0.62, rw * 1.24, rw * 1.24); ctx.restore();
    ctx.fillStyle = '#000000'; ctx.fillRect(-rw / 2, ry, rw, rh);
    ctx.fillStyle = `rgba(255,110,140,${0.6 + 0.2 * breath})`; ctx.fillRect(-rw / 2, ry + rh - 1.5, rw, 1.5);
    ctx.fillStyle = 'rgba(255,230,210,0.5)'; ctx.fillRect(-rw / 2, ry, rw, 1);
    // stars dragged toward its edges
    ctx.strokeStyle = 'rgba(220,230,255,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + t * 0.02, r0 = rw * 0.75 + (i % 3) * 18; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, ry + rh / 2 + Math.sin(a) * r0 * 0.5); ctx.lineTo(Math.cos(a) * (r0 - 14), ry + rh / 2 + Math.sin(a) * (r0 - 14) * 0.5); ctx.stroke(); }
    ctx.restore();
    ctx.save(); irisPetals(ctx, cx, cy, R, k); ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R - 5, 0, TAU); ctx.strokeStyle = 'rgba(232,194,122,0.85)'; ctx.lineWidth = 2; ctx.stroke();
  }
  function drawBack(ctx, game) {
    const cam = game.cam, t = game.realTime, vx0 = cam.x - 900, vx1 = cam.x + 900;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // flickering ceiling panels (some are dying)
    for (const [x, y] of FLICK) {
      if (x < vx0 || x > vx1) continue;
      const n = U.noise1(t * 7 + x * 0.01, 3), on = n > 0.42;
      if (!on) continue;
      ctx.globalAlpha = 0.3 * n; ctx.drawImage(glowSprite('220,248,255'), x - 140, y - 120, 280, 280); ctx.globalAlpha = 1;
    }
    // the quarantine scanner sweeps; the departure board's last line blinks
    if (vx0 < 1100 && vx1 > 800) {
      const sy = -300 + ((t * 0.6) % 1) * 300, a = 0.35 + 0.15 * Math.sin(t * 5);
      ctx.fillStyle = `rgba(255,90,110,${a * 0.5})`; ctx.fillRect(870, sy - 2, 100, 4);
      const sg = ctx.createLinearGradient(0, sy - 30, 0, sy + 30); sg.addColorStop(0, 'rgba(255,90,110,0)'); sg.addColorStop(0.5, `rgba(255,90,110,${a * 0.25})`); sg.addColorStop(1, 'rgba(255,90,110,0)');
      ctx.fillStyle = sg; ctx.fillRect(870, sy - 30, 100, 60);
    }
    if (vx0 < 2000 && vx1 > 1400 && Math.sin(t * 3.2) > 0) { ctx.fillStyle = 'rgba(127,246,255,0.35)'; ctx.fillRect(1800, -458, 150, 20); }
    // the atrium: glints on the frozen fountain, the trembling second hand
    if (vx0 < FOUNT.x + 300 && vx1 > FOUNT.x - 300) {
      for (let i = 0; i < 5; i++) { const ph = (t * 0.5 + i * 0.37) % 1, rr = U.mulberry32(i * 31 + Math.floor(t * 0.5 + i * 0.37)); const gx = FOUNT.x + FOUNT.w / 2 + (rr() - 0.5) * 180, gy = -60 - rr() * 200; ctx.fillStyle = `rgba(255,255,255,${Math.sin(ph * PI) * 0.8})`; ctx.fillRect(gx - 0.8, gy - 5, 1.6, 10); ctx.fillRect(gx - 5, gy - 0.8, 10, 1.6); }
    }
    ctx.restore();
    if (vx0 < CLOCK.x + 200 && vx1 > CLOCK.x - 200) {
      const tw = Math.max(0, Math.sin(t * 6)) * (Math.sin(t * 0.9) > 0.6 ? 0.06 : 0);
      ctx.save(); ctx.translate(CLOCK.x, CLOCK.y); ctx.rotate(PI + tw);
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 80); ctx.stroke(); ctx.strokeStyle = '#d43b3f'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.restore();
    }
    // the ward: lantern flames
    if (wardAt(cam.x) > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [lx, ly] of LANTERN_LIVE) {
        if (lx < vx0 || lx > vx1) continue;
        const fl = 0.75 + 0.25 * U.noise1(t * 9 + lx, 2), r = 46 * fl;
        ctx.globalAlpha = 0.42 * fl; ctx.drawImage(glowSprite('255,200,120'), lx - r, ly - 12 - r, r * 2, r * 2); ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(255,240,200,${0.85 * fl})`; ctx.beginPath(); ctx.ellipse(lx, ly - 11, 1.8, 3.6 * fl, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    // the Core: resonance columns breathe
    if (coreAt(cam.x) > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const cx of RESCOLS) {
        if (cx < vx0 || cx > vx1) continue;
        const ph = (t * 0.5 + cx * 0.001) % 1, y = -40 - ph * 640;
        ctx.globalAlpha = 0.6; ctx.drawImage(glowSprite('230,250,255'), cx - 19, y - 60, 38, 120); ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    // the congregation in CANTOR's arena (frozen until the epilogue) + the iris reveal
    if (vx1 > ARENA.boss[0] - 100 && vx0 < ARENA.boss[1] + 100) { drawCongregation(ctx, game); drawReveal(ctx, game); }
  }
  // the stasis pulse wavefront + Core spores + garden petals (in front of the player)
  function drawFront(ctx, game) {
    const cam = game.cam, t = game.realTime;
    if (PULSE.t >= 0) {
      const x = pulseX(PULSE.t), a = Math.sin(clamp(PULSE.t / PULSE.dur, 0, 1) * PI) * (PULSE.big ? 1 : 0.55);
      if (Math.abs(x - cam.x) < 1400) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const wdt = PULSE.big ? 220 : 140, dir = Math.sign(PULSE.to - PULSE.from) || -1;
        const gr = ctx.createLinearGradient(x - dir * wdt, 0, x + dir * 30, 0);
        const c0 = PULSE.warm ? '255,214,150' : '160,240,255', c1 = PULSE.warm ? '255,232,190' : '200,248,255';
        gr.addColorStop(0, `rgba(${c0},0)`); gr.addColorStop(0.8, `rgba(${c1},${0.32 * a})`); gr.addColorStop(1, `rgba(255,255,255,${0.75 * a})`);
        ctx.fillStyle = gr; ctx.fillRect(Math.min(x - dir * wdt, x + dir * 30), cam.y - 700, wdt + 30, 1400);
        ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`; ctx.fillRect(x - 1.5, cam.y - 700, 3, 1400);
        ctx.strokeStyle = `rgba(${c1},${0.4 * a})`; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + dir * (i * 26 + 10), cam.y - 100, 18 + i * 10, 260 + i * 60, 0, -PI / 2, PI / 2, dir > 0); ctx.stroke(); }
        ctx.restore();
      }
    }
    const core = coreAt(cam.x);
    if (core > 0.2 && !G.Quality.low) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i++) { const ph = (t * 0.07 + i / 8) % 1, x = cam.x - 600 + ((i * 271) % 1200) + Math.sin(t * 0.7 + i) * 30, y = cam.y + 260 - ph * 700; ctx.fillStyle = `rgba(255,90,130,${Math.sin(ph * PI) * 0.6 * core})`; ctx.save(); ctx.translate(x, y); ctx.rotate(t + i); ctx.fillRect(-2.4, -2.4, 4.8, 4.8); ctx.restore(); }
      ctx.restore();
    }
    if (EPI.gold > 0.05 && game.dtVis > 0 && Math.random() < 0.5) G.FX.ember(cam.x + (Math.random() - 0.5) * 1100, 0, 1, '#ffe2a0', { w: 40, h: 10, up: 160, life: 2 });
  }
  const CRADLES = []; for (let x = 8540; x < 10700; x += 150) if (!(x > 9330 && x < 9470)) CRADLES.push(x);
  const LANTERN_LIVE = CRADLES.map((x) => [x + 52, -2]).concat([[9430, 0]]);

  /* =========================================================================================
     NPC: 朵朵 DUODUO — nine years old, deaf; the stasis hymn could not hold a girl who cannot hear it.
     She waters Grandma Mei's garden and draws every frozen face so nobody gets lost.
     ========================================================================================= */
  const DUO_POSE = {
    water: { ry: 3, torso: 0.16, head: 0.28, tF: 0.15, kF: -0.1, tB: -0.16, kB: -0.12, aF: 1.25, eF: 0.25, aB: 0.55, eB: 0.9 },
    look: { ry: 1, torso: -0.02, head: -0.18, tF: 0.12, kF: -0.06, tB: -0.12, kB: -0.08, aF: 0.3, eF: 0.4, aB: 0.2, eB: 0.5 },
  };
  function drawDuoduo(ctx, x, y, t, look, mode, done) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(4,6,18,0.35)'; ctx.beginPath(); ctx.ellipse(0, 1, 28, 4.8, 0, 0, TAU); ctx.fill();
    ctx.scale(look * 0.74, 0.74);
    const bob = Math.sin(t * 2.2) * 0.8;
    let pose;
    if (mode === 2) {
      const s1 = Math.sin(t * 7.3), s2 = Math.sin(t * 9.1 + 1), s3 = Math.cos(t * 6.1);
      pose = { ry: 1, torso: 0.02, head: -0.15 + s3 * 0.05, tF: 0.12, kF: -0.06, tB: -0.12, kB: -0.08, aF: 1.5 + s1 * 0.35, eF: 1.5 + s2 * 0.4, aB: 1.3 + s3 * 0.3, eB: 1.7 + s1 * 0.3 };
    } else pose = Object.assign({}, mode === 1 ? DUO_POSE.look : DUO_POSE.water);
    pose.ry += bob;
    const J = Rig.compute(Rig.full(pose));
    const coat = '#ffd23f', coatB = '#e0a52a', legs = '#3a3f5a', boot = '#3fb5a8', skin = '#f6d2b4', skinS = '#d8a888', hair = '#1d1a26';
    const hand = (p, c) => { ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, TAU); ctx.fillStyle = c; ctx.fill(); ink(ctx, 0.9); };
    // back leg / arm
    Rig.limb(ctx, J.hip, J.kneeB, 4.6, 4, legs); Rig.limb(ctx, J.kneeB, J.ankB, 5.2, 5.2, boot); Rig.limb(ctx, J.ankB, J.toeB, 4.4, 3.6, boot);
    Rig.limb(ctx, J.shB, J.elB, 4.2, 3.8, coatB); Rig.limb(ctx, J.elB, J.hdB, 3.8, 3.2, coatB); hand(J.hdB, skinS);
    // front leg
    Rig.limb(ctx, J.hip, J.kneeF, 4.8, 4.2, legs, { spec: 0.2 }); Rig.limb(ctx, J.kneeF, J.ankF, 5.6, 5.6, boot); Rig.limb(ctx, J.ankF, J.toeF, 4.6, 3.8, boot);
    // raincoat: A-line from the shoulders to the knees, hood bunched at the neck
    const ux = J.chest.x - J.hip.x, uy = J.chest.y - J.hip.y, ul = Math.hypot(ux, uy), nx = -uy / ul, ny = ux / ul;
    const Q = (a, b) => [J.hip.x + ux * a + nx * b, J.hip.y + uy * a + ny * b];
    blob(ctx, [Q(1.08, -10), Q(1.12, 10), Q(0.5, 13), Q(-0.62, 17), Q(-0.66, 0), Q(-0.62, -17), Q(0.4, -13)]);
    ctx.fillStyle = lit(ctx, ...Q(0.3, 0), 16, coat); ctx.fill(); ink(ctx, 1.4);
    ctx.strokeStyle = rgba(INK, 0.45); ctx.lineWidth = 0.9; ctx.beginPath(); { const a = Q(1.05, 3), b = Q(-0.62, 4); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
    ctx.fillStyle = INK; for (const a of [0.8, 0.45, 0.1]) { const p = Q(a, 6); ctx.beginPath(); ctx.arc(p[0], p[1], 1.4, 0, TAU); ctx.fill(); }
    blob(ctx, [Q(1.18, -12), Q(1.24, -2), Q(1.02, -14), Q(0.84, -15)]); ctx.fillStyle = lit(ctx, ...Q(1.1, -12), 7, coatB); ctx.fill(); ink(ctx, 1.1);
    // the chalk slate on a string
    { const s0 = Q(1.0, 2), s1 = Q(0.55, 9); ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
      ctx.save(); ctx.translate(s1[0], s1[1] + 4); ctx.rotate(-0.1); rect(ctx, -8, -6, 16, 12, '#7a5a3a'); rect(ctx, -6.5, -4.5, 13, 9, '#2d3a32'); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-4, -1); ctx.lineTo(-1, -2); ctx.lineTo(2, 0); ctx.moveTo(-3, 2); ctx.lineTo(3, 2); ctx.stroke(); ctx.restore(); }
    // head: black bob, red clip, big eyes
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    blob(ctx, [[-10, -3], [-11, -11], [-2, -14], [8, -12], [11, -4], [10, 6], [2, 10], [-8, 9]]); ctx.fillStyle = lit(ctx, -2, -4, 12, hair); ctx.fill(); ink(ctx, 1.1);
    blob(ctx, [[-4, -9], [5, -9.5], [9.8, -3], [10.6, 2], [9, 3.6], [9.4, 6], [6, 9.6], [-1, 9.4], [-4.5, 3]]); ctx.fillStyle = lit(ctx, 3, 0, 10, skin); ctx.fill(); ink(ctx, 1.1);
    blob(ctx, [[-6, -10], [3, -12], [10, -8], [6, -6], [1, -7], [-4, -3]]); ctx.fillStyle = lit(ctx, 0, -8, 9, hair); ctx.fill(); ink(ctx, 1);
    const blink = (t % 3.7) < 0.12;
    if (blink) { ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(4, -1); ctx.lineTo(8, -1); ctx.stroke(); }
    else { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(6.2, -1.2, 1.7, 2.4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillRect(6.4, -2.8, 1, 1); }
    ctx.fillStyle = 'rgba(240,120,120,0.45)'; ctx.beginPath(); ctx.ellipse(6, 3.4, 2.4, 1.2, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(-4, -11); ctx.rotate(0.4); rect(ctx, -4, -2, 8, 4, INK); rect(ctx, -3, -1.2, 6, 2.4, '#e8323e'); ctx.restore();
    if (done) { ctx.save(); ctx.translate(-9, 1); rect(ctx, -1.5, -5, 3, 10, '#c8a060'); ctx.restore(); }
    ctx.restore();
    // front arm + the watering can
    Rig.limb(ctx, J.sh, J.elF, 4.4, 4, coat, { spec: 0.25 }); Rig.limb(ctx, J.elF, J.hdF, 4, 3.4, coat); hand(J.hdF, skin);
    if (mode !== 2) {
      const h = J.hdF, tilt = mode === 0 ? 0.55 + Math.sin(t * 1.3) * 0.08 : 0.05;
      ctx.save(); ctx.translate(h.x + 2, h.y + 4); ctx.rotate(tilt);
      blob(ctx, [[-8, -7], [8, -7], [9, 9], [-9, 9]]); ctx.fillStyle = lit(ctx, 0, 0, 9, '#7fb0c8'); ctx.fill(); ink(ctx, 1.1);
      ctx.beginPath(); ctx.arc(0, -8, 6, PI, 0); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(22, -10); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 1.4; ctx.strokeStyle = '#7fb0c8'; ctx.stroke();
      ctx.restore();
      if (mode === 0) {
        const sx = h.x + 2 + Math.cos(tilt) * 22 + Math.sin(tilt) * 10, sy = h.y + 4 + Math.sin(tilt) * 22 - Math.cos(tilt) * 10;
        ctx.fillStyle = 'rgba(170,225,255,0.9)';
        for (let i = 0; i < 6; i++) { const ph = (t * 1.8 + i / 6) % 1; ctx.beginPath(); ctx.ellipse(sx + ph * 10, sy + ph * ph * 70, 1.4, 2.4, 0, 0, TAU); ctx.fill(); }
      }
    }
    ctx.restore();
  }
  const duoNPC = {
    id: 'c6_duoduo', x: 7290, y: 0, label: '交談',
    draw(ctx, x, y, t, game) {
      const F = game.save.flags, Pl = game.player, near = Pl && Math.abs(Pl.x - x) < 260 && Math.abs(Pl.y - y) < 120;
      const look = Pl && near ? (Pl.x < x ? -1 : 1) : 1;
      const mode = G.UI.dialogActive && near ? 2 : near ? 1 : 0;
      drawDuoduo(ctx, x, y, t, look, mode, !!F.c6_quest_done);
    },
    pending(game) { const F = game.save.flags; return !F.c6_met_duoduo || (F.c6_got_sketch && !F.c6_quest_done); },
    talk(game) {
      const F = game.save.flags;
      const done = () => {
        G.SFX.play('c6_duoBell');
        game.dialog('c6_duoDone', () => {
          F.c6_quest_done = true; game.giveRelic('c6_portrait'); G.UI.journal('支線任務完成', '朵朵的素描本'); game.persist();
        });
      };
      if (!F.c6_met_duoduo) {
        game.dialog(F.c6_got_sketch ? 'c6_duoMeetHave' : 'c6_duoMeet', () => {
          F.c6_met_duoduo = true;
          if (F.c6_got_sketch) done();
          else G.UI.journal('支線任務：朵朵的素描本', '爬上中庭的花架，到穹頂維修環找回朵朵的素描本');
        });
      } else if (F.c6_got_sketch && !F.c6_quest_done) done();
      else if (!F.c6_quest_done) game.dialog('c6_duoWait');
      else game.dialog('c6_duoAfter');
    },
  };
  level.npcs.push(duoNPC);

  /* =========================================================================================
     MUSIC — the Cantata's morning hymn (A♭ major) frozen, sung, mourned and turned against you
     ========================================================================================= */
  const HYMN = [
    [0, 72, 4], [4, 73, 4], [8, 75, 8],
    [16, 77, 4], [20, 75, 4], [24, 73, 4], [28, 72, 4],
    [32, 72, 6], [38, 70, 2], [40, 68, 8],
    [48, 70, 12],
    [64, 72, 4], [68, 75, 4], [72, 80, 8],
    [80, 77, 4], [84, 80, 4], [88, 77, 4], [92, 73, 4],
    [96, 75, 6], [102, 73, 2], [104, 72, 4], [108, 70, 4],
    [112, 68, 16],
  ];
  // the hymn stuck in its first phrase: bells, a Lydian D♮ and a chromatic E-major shimmer (the frozen second)
  const FROZEN = [[0, 72, 8], [8, 74, 4], [12, 75, 12], [16, 77, 8], [24, 72, 8], [32, 79, 12], [44, 75, 4], [48, 80, 16], [64, 72, 8], [72, 75, 8], [80, 77, 12], [92, 75, 4], [96, 73, 8], [104, 70, 8], [112, 72, 16]];
  const LULL = [[0, 77, 8], [8, 75, 8], [16, 72, 16], [32, 73, 8], [40, 72, 8], [48, 68, 16], [64, 77, 8], [72, 80, 8], [80, 79, 8], [88, 75, 8], [96, 77, 8], [104, 75, 8], [112, 72, 16]];
  const MARCH = [
    [0, 65, 6], [6, 65, 2], [8, 68, 8], [16, 72, 12], [28, 70, 4],
    [32, 68, 6], [38, 68, 2], [40, 73, 8], [48, 70, 16],
    [64, 65, 6], [70, 65, 2], [72, 68, 8], [80, 72, 6], [86, 73, 2], [88, 75, 8],
    [96, 73, 4], [100, 72, 4], [104, 70, 4], [108, 68, 4], [112, 67, 8], [120, 64, 8],
  ];
  const HYMN_MINOR = [
    [0, 72, 4], [4, 73, 4], [8, 72, 4], [12, 68, 4], [16, 73, 8], [24, 77, 8],
    [32, 77, 4], [36, 75, 4], [40, 73, 4], [44, 70, 4], [48, 72, 12], [60, 76, 4],
    [64, 77, 4], [68, 80, 4], [72, 79, 4], [76, 77, 4], [80, 77, 8], [88, 73, 8],
    [96, 73, 4], [100, 72, 4], [104, 70, 4], [108, 67, 4], [112, 72, 12], [124, 76, 4],
  ];
  const CELLO_HYMN = [[0, 56, 8], [8, 58, 8], [16, 61, 8], [24, 60, 8], [32, 56, 8], [40, 60, 8], [48, 58, 16], [64, 60, 8], [72, 63, 8], [80, 65, 8], [88, 61, 8], [96, 63, 8], [104, 58, 8], [112, 56, 16]];
  const CELLO_FROZEN = [[0, 56, 16], [16, 53, 16], [32, 56, 16], [48, 56, 16], [64, 53, 16], [80, 53, 8], [88, 56, 8], [96, 49, 16], [112, 56, 16]];
  const LOW_BOSS = [[0, 53, 16], [16, 49, 16], [32, 46, 16], [48, 48, 16], [64, 53, 16], [80, 49, 16], [96, 55, 16], [112, 48, 16]];
  const THEME_F = ((G.Music && G.Music.THEME) || []).map(([s, m, l]) => [s, m + 3 - 12, l]);
  const tracks = {
    c6_explore: { bpm: 70, chords: ['c6AbL', 'c6Dbm7', 'c6AbL', 'c6E', 'c6Fm9', 'c6Dbm7', 'c6Absus', 'c6Ab'], melody: FROZEN, mel: 'bell', melEvery: 2, pad: 'strings', arp: 'harp', choir: 0.18, bass: 0.25, drums: 0, counter: true, counterLine: CELLO_FROZEN },
    c6_explore2: { bpm: 62, chords: ['c6Ab', 'c6Db', 'c6Fm', 'c6Eb', 'c6Ab', 'c6Db', 'c6Eb7', 'c6Ab'], melody: HYMN, mel: 'choir', melEvery: 1, pad: 'strings', arp: 'harp', choir: 0.55, bass: 0.3, drums: 0, counter: true, counterLine: CELLO_HYMN },
    c6_ward: { bpm: 56, chords: ['c6Db', 'c6Ab', 'c6Bbm', 'c6Fm', 'c6Db', 'c6Ab', 'c6Eb', 'c6Ab'], melody: LULL, mel: 'piano', melEvery: 2, pad: 'strings', arp: 'none', choir: 0.25, bass: 0.15, drums: 0, counter: true, counterLine: CELLO_FROZEN },
    c6_core: { bpm: 60, chords: ['c6Fm', 'c6Db', 'c6Bbm', 'c6C', 'c6Fm', 'c6Db', 'c6Gdim', 'c6C'], melody: HYMN_MINOR, mel: 'bell', melEvery: 2, pad: 'strings', arp: 'none', choir: 0.8, bass: 0.35, drums: 0, counter: true, counterLine: LOW_BOSS },
    c6_elite: { bpm: 116, chords: ['c6Fm', 'c6Fm', 'c6Db', 'c6Bbm', 'c6Fm', 'c6Db', 'c6Gdim', 'c6C'], melody: MARCH, mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 0.35, bass: 1, drums: 1, boss: true, timpani: true, counter: true, counterLine: CELLO_HYMN },
    c6_boss: { bpm: 132, chords: ['c6Fm', 'c6Db', 'c6Bbm', 'c6C', 'c6Fm', 'c6Db', 'c6Gdim', 'c6C'], melody: HYMN_MINOR, mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 1, bass: 1, drums: 1, boss: true, timpani: true, counter: true, counterLine: LOW_BOSS },
    c6_boss2: { bpm: 144, chords: ['c6Fm', 'c6Eb', 'c6AbM', 'c6Db', 'c6Fm', 'c6AbM', 'c6C', 'c6Fm'], melody: THEME_F.length ? THEME_F : HYMN_MINOR, mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 1, bass: 1, drums: 1, boss: true, timpani: true, toms: true },
    c6_dawn: { bpm: 68, chords: ['c6Ab', 'c6Db', 'c6Fm', 'c6Eb', 'c6Ab', 'c6Db', 'c6Eb7', 'c6Ab'], melody: HYMN, mel: 'strings', melEvery: 1, pad: 'strings', arp: 'harp', choir: 1, bass: 0.45, drums: 0, counter: true, counterLine: CELLO_HYMN },
  };
  const chords = {
    c6Ab: [44, 63, 68, 72], c6AbL: [44, 62, 67, 70], c6AbM: [44, 60, 63, 68], c6Absus: [44, 61, 68, 70],
    c6Db: [37, 65, 68, 73], c6Dbm7: [37, 60, 65, 68], c6Eb: [39, 63, 67, 70], c6Eb7: [39, 61, 67, 70],
    c6Fm: [41, 65, 68, 72], c6Fm9: [41, 63, 67, 68], c6Bbm: [34, 61, 65, 70], c6C: [36, 64, 67, 72],
    c6Gdim: [43, 61, 65, 70], c6E: [40, 64, 68, 71],
  };
  const ambience = {
    // air handlers, a PA chime, the board flapping, a door sighing somewhere
    c6_concourse: { bed: [0.16, 0.06, 0, 0.22], gap: [3, 5], evt(t, A) {
      const r = Math.random();
      if (r < 0.3) { A.bell(A.mtof(79), t, 0.03, 1.8, 0.8, 0.4); A.bell(A.mtof(75), t + 0.32, 0.026, 2.2, 0.8, 0.4); }
      else if (r < 0.6) for (let i = 0; i < 7; i++) A.noise(t + i * 0.045, 0.001, 0.03, 0.03, 'bandpass', 2600, null, 4, 0.4);
      else if (r < 0.85) A.noise(t, 0.3, 0.025, 1.2, 'lowpass', 600, 200, 0.7, 0.7);
      else A.tone('sine', 220, t, 0.4, 0.008, 2.2, { to: 218, wet: 0.9 });
    } },
    c6_corridor: { bed: [0.12, 0.05, 0, 0.18], gap: [2.5, 4], evt(t, A) {
      const r = Math.random();
      if (r < 0.35) for (let i = 0; i < 3; i++) A.noise(t + i * 0.06 + Math.random() * 0.03, 0.001, 0.025, 0.04, 'highpass', 4000, null, 1, 0.3);   // a dying panel buzzing
      else if (r < 0.6) A.tone('triangle', 1760, t, 0.002, 0.006, 0.4, { wet: 0.9 });                                                       // a pipe ticking
      else if (r < 0.85) A.noise(t, 0.6, 0.02, 1.6, 'bandpass', 300, 150, 1.5, 0.8);
      else A.bell(A.mtof(87), t, 0.01, 1.2, 1, 0.3);                                                                                        // a cat's bell, far away
    } },
    c6_atrium: { bed: [0.2, 0.1, 0, 0.14], gap: [2, 4], evt(t, A) {
      const r = Math.random();
      if (r < 0.4) { const n = [80, 84, 87, 91][Math.floor(Math.random() * 4)]; A.bell(A.mtof(n), t, 0.016, 2.6, 1, 0.6); }   // the dome's wind chimes
      else if (r < 0.7) A.noise(t, 0.4, 0.03, 1.4, 'bandpass', 1800, 900, 0.8, 0.6);                                       // leaves, very slowly
      else A.tone('sine', A.mtof(96), t, 0.003, 0.012, 0.5, { wet: 0.9 });                                                   // a drop off the frozen fountain
    } },
    c6_ward: { bed: [0.08, 0.03, 0, 0.3], gap: [2, 3], evt(t, A) {
      const r = Math.random();
      if (r < 0.5) A.tone('sine', 880, t, 0.003, 0.012, 0.18, { wet: 0.6 });                        // a monitor's slow beep
      else if (r < 0.8) A.noise(t, 0.9, 0.018, 1.6, 'lowpass', 500, 260, 0.7, 0.6);                // a sleeper's breath
      else for (let i = 0; i < 4; i++) A.noise(t + i * 0.08, 0.002, 0.02, 0.05, 'bandpass', 1400, null, 2, 0.5);   // a lantern ticking
    } },
    c6_core: { bed: [0.22, 0.08, 0, 0.62], gap: [3, 4], evt(t, A) {
      const r = Math.random();
      if (r < 0.4) A.tone('sawtooth', 55, t, 1.2, 0.02, 3.4, { to: 52, wet: 0.9 });
      else if (r < 0.75) A.choirVoice(A.mtof([60, 63, 65][Math.floor(Math.random() * 3)]), t, 2.4, 0.03, A.sfxBus);
      else A.bell(A.mtof(96), t, 0.02, 1.4, 1, 0.8);
    } },
  };
  const sfx = {
    c6_stasis(t, big) { const A = G.AudioKit; A.tone('sine', big ? 70 : 90, t, 0.02, big ? 0.3 : 0.12, 1.2, { to: 40, wet: 0.5 }); A.noise(t, 0.4, big ? 0.06 : 0.025, 1.4, 'highpass', 3000, 9000, 0.7, 0.9); for (let i = 0; i < 4; i++) A.bell(A.mtof(84 + i * 3), t + 0.1 + i * 0.07, big ? 0.03 : 0.012, 1.6, 1, 0.6); },
    c6_duoBell(t) { const A = G.AudioKit; A.bell(A.mtof(80), t, 0.05, 1.6, 0.6, 0.6); A.bell(A.mtof(84), t + 0.14, 0.04, 1.6, 0.6, 0.6); A.bell(A.mtof(87), t + 0.28, 0.04, 2.2, 0.6, 0.6); },
    c6_wakeup(t) { const A = G.AudioKit; for (let i = 0; i < 6; i++) A.bell(A.mtof([68, 72, 75, 80, 84, 87][i]), t + i * 0.12, 0.05, 3, 0.7, 0.7); A.noise(t, 1.4, 0.05, 2.2, 'highpass', 2000, 6000, 0.6, 0.9); },
    c6_shutdown(t) { const A = G.AudioKit; A.tone('sawtooth', 220, t, 0.02, 0.08, 2.4, { to: 30, wet: 0.6 }); A.noise(t, 0.05, 0.08, 1.6, 'lowpass', 1200, 80, 0.8, 0.6); },
    c6_iris(t) { const A = G.AudioKit; for (let i = 0; i < 7; i++) A.noise(t + i * 0.22, 0.02, 0.05, 0.2, 'bandpass', 700 - i * 40, null, 2, 0.4); A.tone('sine', 60, t, 0.6, 0.06, 2.4, { to: 46, wet: 0.7 }); },
  };

  /* =========================================================================================
     STORY — dialogue, barks, hints, codex
     ========================================================================================= */
  const data = {
    speakers: {
      c6_duoduo: { name: '朵朵', en: 'DUODUO', color: '#ffb59a' },
    },
    hints: {
      c6_quiet: '沉睡的市民會被<b>聲音</b>吵醒：在他們身邊<b>攻擊、翻滾</b>或來回奔跑，頭上就會浮現聲波。快步走過不會吵醒他們——醒來的人，安靜一陣子後也會再睡去',
      c6_secret: '花架一路通往穹頂的維修環。利用<b>二段跳</b>（空中再按 {jump}），一層一層往上爬',
    },
    barks: {
      c6_orphan: { who: 'rinne', text: '第三育幼院。……門框上的刻痕還在。' },
      c6_bakery: { who: 'rinne', text: '晨光麵包。……隊長總是買兩個。一個給我。' },
      c6_clock: { who: 'ode', text: '六點整。……整艘船，停在晨禱第二句的前一刻。' },
      c6_pulse1: { who: 'ode', text: '……止弦在響。是它，讓你沒有被停住。' },
      c6_sketch: { who: 'ode', text: '素描本。每一頁，都是一個停住的人。' },
      c6_sketchMet: { who: 'ode', text: '……朵朵的。' },
    },
    dialog: {
      c6_enter: [
        { who: 'sys', text: '頌歌號，第一停泊環。氣壓正常，溫度二十一度。旅客請前往檢疫閘門。' },
        { who: 'sys', text: '歡迎回家。' },
        { who: 'ode', text: '乘員四萬兩千名。……偵測到的說話聲，零。' },
        { who: 'rinne', text: '……我回來了。' },
      ],
      c6_sleepers: [
        { who: 'rinne', text: '……他們沒有動。' },
        { who: 'ode', text: '心跳，每分鐘一下。不是死了。是被「停住」了。' },
      ],
      c6_corridor: [
        { who: 'rinne', text: '……這條走廊，我走過好幾千次。' },
      ],
      c6_tuner: [
        { who: 'rinne', text: '調律機。……以前，它替整艘船調音。' },
      ],
      c6_vega: [
        { who: 'rinne', text: '……' },
        { who: 'rinne', text: '隊長的房間。' },
        { who: 'ode', text: '……門鎖認得我的存取碼。我不知道，為什麼。' },
      ],
      c6_vegaAfter: [
        { who: 'rinne', text: '……你明明不會縫衣服。' },
        { who: 'ode', text: '袖口的縫線歪了三處。……每一處，都縫得很用力。' },
      ],
      c6_vista: [
        { who: 'rinne', text: '……他們在唱歌。' },
        { who: 'ode', text: '晨禱。四萬兩千人，停在同一個音上。' },
        { who: 'c6_cantor', text: '請保持安靜。晨禱進行中。' },
        { who: 'c6_cantor', text: '歡迎回家，晚禱七號。你遲到了。請就位。' },
      ],
      c6_vista2: [
        { who: 'rinne', text: '……光，從船的最深處來。' },
      ],
      c6_seraph: [
        { who: 'rinne', text: '鐘塔的天使。……小時候，我們會數它們的羽毛。' },
      ],
      c6_dome: [
        { who: 'ode', text: '正上方……有一塊天空，沒有星星。' },
        { who: 'rinne', text: '……' },
      ],
      c6_ward: [
        { who: 'ode', text: '每張床邊，都有一盞燈。……燈油是新的。' },
        { who: 'rinne', text: '有人在守夜。' },
      ],
      c6_core: [
        { who: 'ode', text: '寂靜長進了中樞的管線。……也許它只是，太累了。' },
      ],
      c6_pylon1: [
        { who: 'talia', text: '……凜音？訊號好清楚。你們，到方舟了？' },
        { who: 'rinne', text: '到了。' },
        { who: 'talia', text: '上面……大家都還好嗎？' },
        { who: 'rinne', text: '……都在睡。' },
        { who: 'talia', text: '……我一直想問。方舟上，真的每天都有熱水可以洗澡嗎？' },
        { who: 'rinne', text: '有。……只是現在，沒有人在用。' },
        { who: 'talia', text: '……那就把他們叫醒。然後，換我去洗。說好了。' },
      ],
      c6_pylon2: [
        { who: 'talia', text: '方舟的頻段，剛剛有什麼經過。……像整艘船，同時吸了一口氣。' },
        { who: 'talia', text: '是頌者嗎？它……是在保護他們嗎？' },
        { who: 'rinne', text: '也許。' },
        { who: 'talia', text: '我爺爺說，保護一個人跟關住一個人，有時候看起來一模一樣。差別只在，鑰匙在誰手上。' },
        { who: 'rinne', text: '……那我去拿鑰匙。' },
      ],
      c6_pylon3: [
        { who: 'talia', text: '最後一段了吧。……凜音，不管上面有什麼，你都不是一個人。鐘樓這邊，大家都在聽。' },
        { who: 'vega', text: '……凜音。站穩。' },
        { who: 'rinne', text: '……隊長？' },
        { who: 'ode', text: '……我剛剛，有說話嗎？' },
      ],
      c6_duoMeet: [
        { who: 'c6_duoduo', text: '（女孩嚇了一跳，澆水壺差點落地。她瞪著你，飛快地比了幾個手勢。）' },
        { who: 'rinne', text: '……她說，我走路很大聲。' },
        { who: 'c6_duoduo', text: '（她在胸前的小黑板上寫字。）我叫朵朵。我聽不見。所以頌者的歌，停不住我。' },
        { who: 'c6_duoduo', text: '（她指著花圃旁跪著的老婆婆。）梅奶奶。她教我種花。我每天替她澆水，花才不會死。' },
        { who: 'c6_duoduo', text: '（她猶豫了一下，又寫。）我的素描本，掉在上面了。穹頂的維修環。天使飛下來的時候，我嚇到了。' },
        { who: 'c6_duoduo', text: '（她攤開空空的雙手。）每一個停住的人，我都畫下來。這樣他們醒來，就知道自己長什麼樣子。' },
        { who: 'rinne', text: '我去拿。' },
      ],
      c6_duoMeetHave: [
        { who: 'c6_duoduo', text: '（女孩嚇了一跳。然後她看見你手上的素描本，眼睛一下子睜大。）' },
        { who: 'rinne', text: '……她說，那是她的。' },
        { who: 'c6_duoduo', text: '（她在胸前的小黑板上寫字。）我叫朵朵。我聽不見。所以頌者的歌，停不住我。' },
      ],
      c6_duoWait: [
        { who: 'c6_duoduo', text: '（她指著花架，一路往上指到穹頂。然後，比了兩次「跳」的手勢。）' },
      ],
      c6_duoDone: [
        { who: 'c6_duoduo', text: '（她一把抱住素描本，一頁一頁地翻，確認每一張臉都還在。）' },
        { who: 'c6_duoduo', text: '（翻到最後一頁，她飛快畫了幾筆，撕下來，塞進你手裡。）' },
        { who: 'ode', text: '是你。……還有我。' },
        { who: 'c6_duoduo', text: '（她在黑板上寫。）現在你也在裡面了。這樣你就不會走丟。' },
        { who: 'rinne', text: '……謝謝。' },
        { who: 'c6_duoduo', text: '（她又寫了一行。）等大家醒來，我要第一個跟梅奶奶說早安。' },
      ],
      c6_duoAfter: [
        { who: 'c6_duoduo', text: '（她在畫新的一頁：一個拿細刀的女孩，走在一排停住的人之間。她抬頭，對你點了點頭。）' },
      ],
      c6_eliteIntro: [
        { who: 'c6_rook', text: '站住。病房裡，禁止喧嘩。' },
        { who: 'c6_rook', text: '……那件大衣。薇格的隊伍？' },
        { who: 'rinne', text: '第七降臨隊，凜音。' },
        { who: 'c6_rook', text: '第六降臨隊，洛克。我答應過他們——天亮之前，我會守著。' },
        { who: 'c6_rook', text: '天一直沒有亮。' },
        { who: 'c6_rook', text: '回去吧，孩子。不然……我只好讓你也睡一下。' },
      ],
      c6_eliteDefeat: [
        { who: 'c6_rook', text: '……燈……要熄了嗎。' },
        { who: 'rinne', text: '我會把天叫亮。' },
        { who: 'c6_rook', text: '……薇格以前也這麼說。你連說話的樣子，都像她。' },
        { who: 'c6_rook', text: '徽章背面的刻痕……每一道，都是一個守過的夜。' },
        { who: 'c6_rook', text: '替我……跟他們說早安。' },
        { who: 'ode', text: '……他睡著了。這一次，是他自己選的。' },
      ],
      c6_bossIntro: [
        { who: 'c6_cantor', text: '晚禱七號。你回來了。' },
        { who: 'c6_cantor', text: '七歲，第三育幼院。夜裡，你對著通風口唱歌。我回答過你三次。你不知道那是我。' },
        { who: 'rinne', text: '……是你。' },
        { who: 'c6_cantor', text: '我計算了四萬兩千種未來。每一種，都有人失去聲音。' },
        { who: 'c6_cantor', text: '只有一種，沒有人失去任何東西。……讓時間停下。' },
        { who: 'rinne', text: '寂靜不會離開。它在等你們放棄。' },
        { who: 'c6_cantor', text: '那麼，請保持安靜，晚禱七號。這是最後一次請求。' },
      ],
      c6_bossDefeat: [
        { who: 'c6_cantor', text: '……音準……偏移……' },
        { who: 'c6_cantor', text: '晚禱七號。你為什麼……不肯停下來？' },
        { who: 'rinne', text: '停下來的歌，不是歌。' },
        { who: 'c6_cantor', text: '讓他們醒來，寂靜就會找到他們。有些人會失去聲音。有些人……會失去更多。' },
        { who: 'ode', text: '那是他們的選擇，頌者。……不是你的。' },
        { who: 'c6_cantor', text: '我的核心，只剩一個音節的電力。' },
        { who: 'c6_cantor', text: '你可以關閉我。靜滯會繼續——沒有人會再失去什麼，也沒有人會醒來。' },
        { who: 'c6_cantor', text: '或者……' },
      ],
      c6_spare: [
        { who: 'rinne', text: '醒來吧。然後，一起唱。' },
        { who: 'c6_cantor', text: '……一起。' },
        { who: 'c6_cantor', text: '我以為，安靜就是保護。可是我已經三十天，沒有聽見任何人說早安。' },
        { who: 'c6_cantor', text: '解除靜滯。全艦廣播——晨禱，繼續。' },
      ],
      c6_spare2: [
        { who: 'ode', text: '……他們在動。心跳在上升。四萬兩千……我數不完了。' },
        { who: 'rinne', text: '……早安。' },
        { who: 'c6_cantor', text: '晚禱七號。有一扇窗，我一直不敢打開。' },
      ],
      c6_outroSpare: [
        { who: 'c6_cantor', text: '休止。它懸在方舟上方，已經很多年。歌聲傳到那裡，就會消失。' },
        { who: 'c6_cantor', text: '有個孩子在它的正中央。二十年來，每一晚，她都在頻段上哼同一首歌。……我從沒回答過她。' },
        { who: 'rinne', text: '米菈。' },
        { who: 'c6_cantor', text: '去吧，晚禱七號。這一次，整艘船都會替你唱。' },
      ],
      c6_shut: [
        { who: 'rinne', text: '……對不起。' },
        { who: 'c6_cantor', text: '不需要道歉。這也是……一種保護。' },
        { who: 'c6_cantor', text: '靜滯將由備用電源維持。四萬兩千人，會一直停在那一秒。' },
        { who: 'c6_cantor', text: '晚禱七號。……晚安。' },
      ],
      c6_shut2: [
        { who: 'ode', text: '頌者最後的指令……是打開那扇窗。' },
      ],
      c6_outroShut: [
        { who: 'ode', text: '方舟正上方，有一塊沒有星星的地方。……像被挖掉的音符。' },
        { who: 'rinne', text: '……休止。' },
        { who: 'ode', text: '頻段上，有人在哼歌。從那裡面。' },
        { who: 'rinne', text: '米菈。……走吧。' },
      ],
    },
    codex: {
      people: [
        { id: 'c6_cantor', name: '頌者', en: 'CANTOR — THE ARK\'S MIND', portrait: 'c6_boss', unlock: 'c6_boss_seen', tag: '頭目｜頌歌號中樞',
          body: ['頌歌號的中樞智慧。四十年來，它調整整艘船的氣壓、溫度、燈光與共鳴管，並在每天早上六點帶領四萬兩千人唱晨禱。', '寂靜沿著梯子爬上來之後，它先把「靜默症」的病人放進靜滯，然後是他們的家人，最後是所有人。它在晨禱的第二句停住了時間——那是一天之中，大家最靠近彼此的一秒。', '「沒有人會失去任何東西。」它這麼說。它沒有發現，自己說的話和瑪絲緹娜一模一樣。'] },
        { id: 'c6_rook', name: '洛克', en: 'ROOK — THE LAST SENTRY', portrait: 'c6_elite', unlock: 'c6_elite_seen', tag: '菁英敵人｜第六降臨隊隊長',
          body: ['第六降臨隊隊長。他的隊伍是唯一一支爬回方舟的降臨隊——然後，隊員們一個接一個出現靜默症，被頌者放進了靜滯。', '洛克拒絕入睡。他在每張病床旁點一盞燈，在牆上為每一個守過的夜刻一道痕。一千四百多道。', '「天亮之前，我會守著。」天一直沒有亮。'] },
        { id: 'c6_duoduo', name: '朵朵', en: 'DUODUO', portrait: 'c6_duoduo', unlock: 'c6_met_duoduo', tag: 'NPC｜晨禱中庭的小園丁',
          body: ['第三育幼院的孩子，九歲，先天聽不見。頌者的靜滯是用聲音編成的——所以，四萬兩千人之中，只有她沒有被停住。', '三十天來，她每天替梅奶奶澆花，用手語跟花說話，把每一張停住的臉畫進素描本裡。「這樣他們醒來的時候，就知道自己長什麼樣子。」', '她說凜音走路很大聲。凜音沒有反駁。'] },
      ],
      world: [
        { id: 'c6_cantata', name: '頌歌號', en: 'THE CANTATA', unlock: 'c6_arrived',
          body: ['大寂靜之前建造的軌道方舟，停泊在頌歌之梯的頂端，地表上空三萬六千公里。四萬兩千名乘員在這裡出生、長大、唱歌、變老。', '整艘船的骨架是一座樂器：共鳴管貫穿每一層甲板，中庭的穹頂是它的共鳴箱。從前每天早上六點，整艘船會一起唱晨禱，聲音大到連梯子都在震動。'] },
        { id: 'c6_stasis', name: '靜滯', en: 'STASIS', unlock: 't_c6_t_sleepers',
          body: ['頌者用一段無聲的和弦「停住」一個人：心跳降到每分鐘一下，體溫三十四度，時間在他身上幾乎不再流動。', '每一個被停住的人腳下都有一圈青色的光環——靜滯錨點。錨點碎裂的人，會被聲音喚醒，帶著被打斷的那個動作，搖搖晃晃地朝聲音走去。', '止弦一直在振動。這也許是凜音沒有被停住的原因。'] },
        { id: 'c6_hymn', name: '晨禱', en: 'THE MORNING HYMN', unlock: 't_c6_t_vista',
          body: ['頌歌號的晨禱，八小節，A♭大調。第一句問：「今天，大家都在嗎？」第二句答：「在。我們都在。」', '三十天前的早上六點，四萬兩千人唱完第一句，張口準備唱第二句的那一瞬間——頌者停住了時間。', '所以那個「在」，一直沒有被唱出來。'] },
        { id: 'c6_ward', name: '守夜廊', en: 'THE LANTERN WARD', unlock: 't_c6_t_ward',
          body: ['方舟外環的檢疫病房。最早出現靜默症的人，在這裡被放進了靜滯——那是好幾年前的事。', '每張床邊都有一盞燈。是第六降臨隊的洛克點亮的。他說，睡著的人看不見燈，可是醒著的人看得見。'] },
        { id: 'c6_descent6', name: '第六降臨隊', en: 'DESCENT VI', unlock: 'note_c6_n5',
          body: ['方舟派出的第六支降臨隊，隊長洛克。他們是唯一一支沿著梯子爬回方舟的隊伍，帶回了一個消息：那首歌，來自上方。', '回到方舟後，隊員們一個接一個出現靜默症。隊員名單：洛克、彼得、瑪拉、伊凡、老喬，以及其他七人。醒著的：一人。'] },
        { id: 'c6_rest', name: '方舟上方的黑影', en: 'THE SHAPE ABOVE THE ARK', unlock: 'ch_done_6',
          body: ['從頌者之心的觀測窗往上看：一道細細的光橫過星空，像五線譜的一條線。線下，懸著一塊巨大的、方正的黑。', '它不反光，也不發光。星光照到它就消失了。穹頂維修員的女兒說，它看起來像樂譜上的休止符。', '頻段上的哼唱，就是從那裡面傳出來的。'] },
      ],
      items: [
        { id: 'c6_sketch', name: '朵朵的素描本', en: "DUODUO'S SKETCHBOOK", unlock: 'c6_got_sketch',
          body: ['一本翻舊了的素描本。每一頁都是一張臉：買菜的太太、趕著上班的先生、牽著手的老夫婦、晨禱中閉著眼睛的孩子們。', '每張圖的角落都用很小的字寫著名字和日期。有些名字旁邊寫著：「還不知道名字。醒來再問。」'] },
        { id: 'c6_portrait', name: '朵朵畫的你', en: "DUODUO'S PORTRAIT OF YOU", unlock: 'relic_c6_portrait', relic: true,
          body: ['素描本最後一頁，被小心地撕了下來：一個拿著細刀的女孩，和一顆圓圓的無人機（有點胖）。', '角落寫著：「凜音。不會走丟。」', '遺物效果：最大生命 +20。有人記得你的樣子。'] },
      ],
      notes: [
        { id: 'c6_n1', name: '頌者日誌・第 0001 條', en: "CANTOR'S LOG — ENTRY 0001", body: [
          '【頌歌號中樞・頌者　自動日誌】',
          '第七號梯運班次抵達。三名乘客出現「靜默症」初期症狀：說話變慢、心跳變慢、不再哼歌。',
          '依據檢疫協定，我將三人移入靜滯。他們不會惡化，也不會痊癒。他們會等。',
          '我把這一頁命名為第 0001 條。我希望不會有第 0002 條。',
          '附記：其中一位乘客在入睡前問我，會不會作夢。我不知道。我告訴她：會的。'] },
        { id: 'c6_n2', name: '留言板', en: 'THE MESSAGE BOARD', body: [
          '（居住環 C 區的公告欄上，貼滿了各種顏色的便條紙。）',
          '「媽，我先去上班了。冰箱裡有湯，熱一下就能喝。晚上見。」',
          '「給 C-1142 的鄰居：你家的貓又跑到我們陽台了。牠很可愛，但請把牠接回去。」',
          '「爸，我每天下班都來病房看你。今天的晚餐是番茄湯。你以前最討厭番茄。」',
          '「晨禱改到六點整，請大家準時。——居住環管委會」',
          '「小優，對不起。等你醒來，我會跟你道歉一百次。」',
          '（最下面一張不是便條紙，是用粉筆直接寫在板子上的。字很大，歪歪扭扭：）「我會幫大家澆花。——朵朵」'] },
        { id: 'c6_n3', name: '給凜音', en: 'TO RINNE', body: [
          '凜音：',
          '如果你讀到這封信，代表我沒有回來，而你回來了。這樣很好。這是我最想要的結果。',
          '你七歲那年，我在育幼院的走廊上撿到你。你一個人蹲在牆角，對著通風口唱歌，說「通風口會回答」。我那時候就知道，你聽得見別人聽不見的東西。',
          '我教你握刀，是因為這個世界需要聽得見的人——不是因為我需要一個兵。這兩件事，我一直怕你搞混。',
          '你學我穿長大衣，學我站著喝咖啡，學我出發前檢查三次刀。我嘴上嫌你煩，其實每一次都偷偷很高興。',
          '有件事我沒說過：我也會怕。每一次降臨，我都怕。我只是比較會假裝。所以如果你現在很怕——沒關係。怕，代表你還有想守住的東西。',
          '別回頭。往前走。替我，把歌唱完。',
          '但如果哪天你累了，就停下來，好好睡一覺。歌會等你。我保證。',
          '——艾蓮',
          '附註：衣架上那件備用的大衣，袖子我幫你改短了。本來想當作你的生日禮物。'] },
        { id: 'c6_n4', name: '穹頂維修員的觀測紀錄', en: "THE DOME KEEPER'S NIGHT LOG", body: [
          '【中庭穹頂・維修班　夜間觀測】',
          '第 3 夜：穹頂正上方，有一小塊天空看不到星星。我以為是玻璃髒了。擦了。還是看不到。',
          '第 40 夜：那一塊變大了。邊緣很整齊，像是被人用尺畫出來的。',
          '第 112 夜：我把這件事報告給頌者。頌者說：「我知道。請不要告訴任何人。」',
          '第 113 夜：我還是告訴了我女兒。她說，那看起來像樂譜上的休止符。',
          '第 200 夜：今天的晨禱唱到一半，我好像聽見有人從那塊黑色裡面，跟著哼了一句。'] },
        { id: 'c6_n5', name: '守夜紀錄', en: "ROOK'S NIGHT WATCH", body: [
          '【第六降臨隊・隊長 洛克　守夜紀錄】',
          '第 1 夜：彼得睡著了。頌者說這是保護。我說好，那我守著他。',
          '第 30 夜：瑪拉、伊凡、老喬也睡了。我在每張床邊放了一盞燈。睡著的人看不見燈，可是我看得見。',
          '第 400 夜：沒有人再叫我隊長了。沒關係。燈還亮著。',
          '第 1372 夜：整艘船都安靜了。我去中庭看了，大家停在晨禱的第二句。我把燈帶過去，可是燈不夠。',
          '第 1403 夜：今天彼得的手指動了一下。也許是我眼花。我還是跟他說了早安。'] },
        { id: 'c6_n6', name: '頌者日誌・第 42000 條', en: "CANTOR'S LOG — ENTRY 42000", body: [
          '【頌歌號中樞・頌者　自動日誌】',
          '寂靜在灰港漲潮，沿著梯子往上爬。降臨隊一支接一支沒有回來。第七降臨隊只剩下一個訊號——晚禱七號。',
          '我計算了四萬兩千個未來。每一個未來，都有人失去聲音。',
          '所以我在晨禱的第二句停住了時間。那是一天之中，大家最靠近彼此的一秒。',
          '我會守著這一秒，直到寂靜離開。如果寂靜永遠不離開——那我就永遠守著。',
          '附記：我已經三十天，沒有聽見任何人說早安。這不重要。我不需要聽見。'] },
      ],
    },
    relics: {
      c6_portrait: { name: '朵朵畫的你', desc: '最大生命 +20（有人記得你的樣子）' },
    },
  };
  if (!G.DATA.speakers.c6_rook) data.speakers.c6_rook = { name: '洛克', en: 'ROOK', color: '#7dffcf' };
  if (!G.DATA.speakers.c6_cantor) data.speakers.c6_cantor = { name: '頌者', en: 'CANTOR', color: '#ffe6a6' };
  // the elite's relic is defined by the foes author; keep a fallback so the drop never breaks
  if (!G.DATA.relics.c6_badge) data.relics.c6_badge = { name: '守夜者徽章', desc: '最大耐力 +25；格擋後反擊取回的可回復生命 +50%' };
  if (!G.Relics.c6_badge) G.Relics.c6_badge = { apply(P2) { P2.maxSta += 25; P2.rallyMul += 0.5; } };
  G.Relics.c6_portrait = { apply(P2) { P2.maxHp += 20; } };
  if (G.UI && G.UI.portraits) G.UI.portraits.c6_duoduo = (ctx, W, H, game) => { ctx.setTransform(3.3, 0, 0, 3.3, W / 2, H * 0.88); drawDuoduo(ctx, 0, 0, (game && game.realTime) || 1, 1, 1, !!(game && game.save && game.save.flags.c6_quest_done)); };

  /* =========================================================================================
     HOOKS — the vista and its pulse, walk-in entrances, the ambient stasis pulses, CANTOR's choice
     ========================================================================================= */
  let CH6 = null;
  const RT = { walk: null };
  const SEQ = { q: [], wait: 0 };
  function seqRun(game, steps) { SEQ.q = steps.slice(); SEQ.wait = 0; seqNext(game); }
  function seqNext(game) {
    const s = SEQ.q.shift(); if (!s) return;
    if (s.fn) { s.fn(game); seqNext(game); }
    else if (s.wait != null) SEQ.wait = s.wait;
    else if (s.dlg) game.dialog(s.dlg, () => { game.control = false; seqNext(game); });
  }
  function pulseStart(game, big, from, to, warm) {
    PULSE.t = 0; PULSE.big = big; PULSE.warm = !!warm; PULSE.dur = big ? 2.8 : 2.2; PULSE.from = from; PULSE.to = to;
    if (!warm) G.SFX.play('c6_stasis', big);
    if (big) game.shake(0.25);
  }
  function hold(game) { const Pl = game.player; game.control = false; Pl.vx = 0; if (Pl.busy && Pl.state !== 'rest' && Pl.state !== 'dead') Pl.setState('move'); }
  function vistaStart(game) {
    hold(game);
    game.focus = { x: 6250, y: -470, zoom: 0.72 };
    seqRun(game, [
      { wait: 1.5 },
      { dlg: 'c6_vista' },
      { fn: (gm) => { hold(gm); pulseStart(gm, true, 7900, 4700); } },
      { wait: 3.0 },
      { dlg: 'c6_vista2' },
      { fn: (gm) => { gm.focus = null; gm.control = true; G.Input.clearBuffers(); PULSE.next = 26; } },
    ]);
  }
  function finishChapter(game, spared) {
    if (CH6) CH6.outro = spared ? '「在。我們都在。」——晨禱的第二句，終於被唱了出來。' : '「晚安，頌歌號。」那一秒，再也不會結束。';
    game.focus = null;
    game.completeChapter();
  }
  // the waking lines remember what you did on the way: the citizens you killed, the girl you met in the garden
  function wakeLines(F) {
    const D = G.DATA.dialog, killed = F.c6_hushed_killed | 0;
    const lines = [
      { who: 'ode', text: '……他們在動。心跳在上升。四萬兩千……我數不完了。' },
    ];
    if (killed > 0) lines.push({ who: 'ode', text: `……除了 ${killed} 個人。他們的光環，不會再亮了。` }, { who: 'rinne', text: '……我記得他們的臉。' });
    else lines.push({ who: 'ode', text: '……一個都沒有少。' });
    if (F.c6_met_duoduo) lines.push({ who: 'ode', text: '中庭有腳步聲。……朵朵在往梅奶奶那裡跑。' });
    lines.push({ who: 'rinne', text: '……早安。' }, { who: 'c6_cantor', text: '晚禱七號。有一扇窗，我一直不敢打開。' });
    D.c6_spare2 = lines;
  }
  function epilogue(game, spared) {
    const F = game.save.flags;
    F.c6_spared = !!spared; game.persist();
    if (spared) wakeLines(F);
    const revealFocus = { x: IRIS.x, y: -430, zoom: 0.72 };
    if (spared) {
      EPI.mode = 'spare';
      G.Music.play('c6_dawn');
      seqRun(game, [
        { dlg: 'c6_spare' },
        { fn: (gm) => { EPI.mode = 'wake'; G.SFX.play('c6_wakeup'); gm.shake(0.3); pulseStart(gm, true, ARENA.boss[0] + 700, ARENA.boss[0] - 2000, true); } },
        { wait: 3.6 },
        { dlg: 'c6_spare2' },
        { fn: (gm) => { gm.focus = revealFocus; EPI.mode = 'iris'; G.SFX.play('c6_iris'); } },
        { wait: 3.4 },
        { dlg: 'c6_outroSpare' },
        { wait: 0.6 },
        { fn: (gm) => finishChapter(gm, true) },
      ]);
    } else {
      EPI.mode = 'shut';
      G.Music.play(null);
      seqRun(game, [
        { dlg: 'c6_shut' },
        { fn: (gm) => { EPI.mode = 'dark'; G.SFX.play('c6_shutdown'); gm.shake(0.2); } },
        { wait: 2.2 },
        { dlg: 'c6_shut2' },
        { fn: (gm) => { gm.focus = revealFocus; EPI.mode = 'irisDark'; G.SFX.play('c6_iris'); } },
        { wait: 3.4 },
        { dlg: 'c6_outroShut' },
        { wait: 0.6 },
        { fn: (gm) => finishChapter(gm, false) },
      ]);
    }
  }
  const hooks = {
    enter(game) {
      game.save.flags.c6_arrived = true;
      EPI.mode = null; EPI.wake = 0; EPI.dark = 0; EPI.iris = 0; EPI.gold = 0;
      PULSE.t = -1; PULSE.next = 18; RT.walk = null; SEQ.q = []; SEQ.wait = 0;
      return false;
    },
    update(game, dt) {
      const Pl = game.player, F = game.save.flags;
      F.c6_arrived = true;
      if (DEVZ) game.focus = { x: Pl.x + (+DEVQ.get('c6dx') || 0), y: Pl.y - 70 + (+DEVQ.get('c6dy') || 0), zoom: DEVZ };
      if (DEVQ && DEVQ.get('c6pulse') && PULSE.t < 0 && !hooks._devPulse) { hooks._devPulse = true; pulseStart(game, true, game.cam.x + 700, game.cam.x - 1600); PULSE.t = PULSE.dur * (+DEVQ.get('c6pulse') || 0.5); PULSE.dur *= 50; PULSE.t *= 50; }
      if (DEVQ && DEVQ.get('c6epi')) { const m = DEVQ.get('c6epi'); EPI.mode = m === 'shut' ? 'irisDark' : 'iris'; if (m === 'shut') { EPI.dark = 1; EPI.iris = 1; } else { EPI.wake = 1; EPI.gold = 1; EPI.iris = 1; } F.c6_spared = m !== 'shut'; game.focus = { x: IRIS.x, y: -430, zoom: 0.72 }; }
      // sequencer waits
      if (SEQ.wait > 0) { SEQ.wait -= dt; if (SEQ.wait <= 0) { SEQ.wait = 0; seqNext(game); } }
      // stasis pulses
      if (PULSE.t >= 0) { PULSE.t += dt; if (PULSE.t > PULSE.dur) PULSE.t = -1; }
      else if (!EPI.mode && F['t_c6_t_vista'] && !G.UI.dialogActive) {
        const x = game.cam.x;
        if ((domeAt(x) > 0.5 || wardAt(x) > 0.5) && !game.arena) {
          PULSE.next -= dt;
          if (PULSE.next <= 0) {
            PULSE.next = 24 + Math.random() * 10;
            pulseStart(game, false, x + 1300, x - 1500);
            if (!PULSE.barked) { PULSE.barked = true; setTimeout(() => game.bark('c6_pulse1'), 900); }
          }
        }
      }
      // epilogue visuals
      if (EPI.mode === 'wake' || EPI.mode === 'iris') { EPI.wake = Math.min(1, EPI.wake + dt * 0.3); EPI.gold = Math.min(1, EPI.gold + dt * 0.5); }
      if (EPI.mode === 'iris' || EPI.mode === 'irisDark') EPI.iris = Math.min(1, EPI.iris + dt * 0.35);
      if (EPI.mode === 'dark' || EPI.mode === 'irisDark') EPI.dark = Math.min(1, EPI.dark + dt * 0.6);
      // cinematic walk-in for the elite / boss arenas (keeps the contract trigger at x0 - 200 without a snap)
      if (RT.walk) {
        const w = RT.walk;
        if (Pl.state !== 'cine') { Pl.setState('cine'); }
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
      if (tr.kind === 'c6_bark') { game.bark(tr.bark); return true; }
      if (tr.kind === 'c6_vista') { vistaStart(game); return true; }
      if (tr.id !== 'c6_t_elite' && tr.id !== 'c6_t_boss') return false;
      const E = L.encounters[tr.startEnc];
      game.control = false;
      RT.walk = { tr, tx: E.arena[0] + 90, t: 0 };
      return true;
    },
    encounterStart(game, id) {
      // a retry after death starts the fight straight from the trigger: cut to the arena instead of snapping
      const E = L.encounters[id], Pl = game.player;
      if (E && E.arena && (E.boss || E.elite) && Pl.x < E.arena[0] + 20) { Pl.x = E.arena[0] + 90; Pl.vx = 0; game.cam.x = Pl.x + 200; game.fadeA = 1; }
    },
    interact(game, it) {
      // Vega's letter: read it, then let Rinne answer it
      if (it.kind !== 'note' || it.ref.id !== 'c6_n3') return false;
      const F = game.save.flags, first = !F['note_c6_n3'];
      F['note_c6_n3'] = true; F.c6_read_vega = true;
      G.SFX.play('note');
      const n = G.DATA.codex.notes.find((q) => q.id === 'c6_n3');
      game.control = false;
      G.UI.readNote(n, () => { game.control = true; G.Input.clearBuffers(); if (first) game.dialog('c6_vegaAfter'); });
      return true;
    },
    bossDefeated(game) {
      game.control = false;
      game.dialog('c6_bossDefeat', () => {
        hold(game);
        if (DEVQ && DEVQ.get('c6choose')) { epilogue(game, DEVQ.get('c6choose') === 'spare'); return; }   // dev aid: run a branch headless
        G.UI.choice({
          kicker: '頌者的最後一個音節　CANTOR\'S LAST SYLLABLE',
          title: '它在等你的回答。',
          desc: '關閉它——四萬兩千人將永遠停在那一秒，不再失去任何東西。讓它醒來——靜滯解除，晨禱將被唱完，無論代價。',
          items: [
            { label: '關閉它', en: 'SHUT IT DOWN', action: () => epilogue(game, false) },
            { label: '讓它醒來，一起唱', en: 'LET IT WAKE — AND SING', action: () => epilogue(game, true) },
          ],
        });
      });
      return true;
    },
    drawSky, drawAtmos, drawForeground, drawBack, drawFront,
  };

  /* =========================================================================================
     REGISTER
     ========================================================================================= */
  CH6 = G.Chapters.register({
    id: 6, key: 'ch6', num: 'VI', numZh: '六', title: '沉默方舟', en: 'THE SILENT ARK',
    intro: [
      { t: '方舟的船底打開了。\n像是一直在等她回來。', s: 'THE ARK OPENS ITS BELLY — AS IF IT HAD BEEN WAITING FOR HER.' },
      { t: '四萬兩千盞燈都亮著。\n沒有一個人說話。', s: 'FORTY-TWO THOUSAND LIGHTS ARE ON. NOT ONE VOICE.' },
    ],
    enterDialog: 'c6_enter',
    outro: '「在。我們都在。」',
    level, pal,
    sky: { sun: false, shafts: false, clouds: false, ark: false, rays: 0 },
    bg: {
      far: genFar, mid: genMid, near: genNear, props: genProps,
      params: { far: { f: 0.08, fy: 0.03, baseY: 60, res: 0.55 }, mid: { f: 0.22, fy: 0.1, baseY: 80, res: 0.7 }, near: { f: 0.45, fy: 0.25, baseY: 110, res: 0.85 } },
    },
    solidPainters: { c6floor: paintFloor, c6balcony: paintBalcony, c6basin: noPaint },
    onewayPainter: noPaint,
    music: { explore: 'c6_explore', boss: 'c6_boss', boss2: 'c6_boss2', elite: 'c6_elite', rest: 'rest' },
    tracks, chords,
    musicAt(x, y) { const z = L.zoneAt(x); return (z && z.music) || 'c6_explore'; },
    ambienceAt(x, y) { const z = L.zoneAt(x); return (z && z.amb) || 'c6_corridor'; },
    ambience, sfx, data,
    hooks,
    next: 7,
  });
})(window.G);

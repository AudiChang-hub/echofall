'use strict';
/* ECHOFALL — Chapter VIII 最後的樂章 THE LAST MOVEMENT (world author: level, look, music, story, the three endings).
   The Heart of the Rest: a pale endless stage under a black sun. Rinne climbs it tier by tier — the wings, a memory of
   Barrow's bell, the Staircase of Light past the Belfry, the rooftop where a little girl watched the sunset — while every
   place she ever fought through floats around her as an island of memory. At the top, centre-back of the last stage,
   stands the music box: a giant one, still playing the first half of a lullaby. Mira sits in front of it.
   Foes live in ch8_foes.js (c8_hushling, c8_conductor, c8_cadence, c8_coda, the trio c8_elite), Mira in ch8_boss.js
   (c8_boss) — referenced by id. Ending flags: docs/STORY.md §2. Dev aids (inert without the URL parameter):
   ?c8true=1 grants the true-ending flags · ?c8choose=encore|solo|fermata picks the ending headlessly ·
   ?c8epi=encore|solo|fermata freezes an epilogue tableau for screenshots · ?c8choice=1 opens the final choice ·
   ?c8card=encore|solo|fermata shows an ending card · ?c8vista=1 frames the vista · ?c8clear=c8_e5 marks fights won ·
   ?c8zoom=1.6 frames the player close · ?c8dbg=1 logs what defeats Rinne. */
(function (G) {
  const WK = G.WorldKit, U = G.U, Rig = G.Rig, PI = Math.PI, TAU = PI * 2;
  const L = G.LEVEL, INK = '#0b0612';
  const rgba = U.rgba, mixH = U.mixHex, clamp = U.clamp, lerp = U.lerp;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const DEVQ = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const dev = (k) => (DEVQ ? DEVQ.get(k) : null);

  /* =========================================================================================
     LEVEL GEOMETRY — five tiers of one giant stage, each a step of 200 up toward the black sun
     ========================================================================================= */
  const SPAN = [-400, 8300];
  const FLOOR = [800, 600, 400, 200, 0];            // A the wings · B the bells · C the stair · D the rooftop · E the heart
  const RISE = [1350, 2700, 4100, 5560];            // where each next tier begins
  const tierAt = (x) => (x < RISE[0] ? 0 : x < RISE[1] ? 1 : x < RISE[2] ? 2 : x < RISE[3] ? 3 : 4);
  const floorAt = (x) => FLOOR[tierAt(x)];
  const ARENA = { e3: [3360, 3950], elite: [4700, 5700], e5: [5600, 6250], boss: [6900, 8300] };
  const DECK = { x0: 4680, x1: 5740, y: -330, h: 120 };   // Descent I's launch deck, twenty years old (optional elite)
  const BELFRY = { x0: 3040, x1: 3340, y: -15 };           // the floating Belfry (secret climb · Talia's letter)
  const ROOF = { x0: 4170, x1: 4430, y: 90 };              // the rooftop at sunset (little Mira)
  const BELL = { x: 2470, y: FLOOR[1] };                   // Barrow's bell (memory)
  const DOOR = { x: 6350 };                                // the last door
  const BOX = { x: 7600, w: 880, h: 250 };                 // the great music box (boss arena, centre-back)
  const GHOSTS = [[300, FLOOR[0]], [6560, 0]];             // ghost lights: a bare bulb left burning on an empty stage
  // palette blend: the cool pearl of the wings (0) → the warm gilt of the heart (0.65; < 0.7 keeps the default grade)
  const tintAt = (x) => 0.65 * sstep(-300, 7300, x);
  const heartAt = (x) => sstep(5400, 6900, x);
  const prog = (x) => clamp((x + 200) / 7900, 0, 1);

  const level = {
    start: { x: 140, y: FLOOR[0] }, bounds: SPAN.slice(), gravity: 1,
    solids: [
      { x: -820, y: -2600, w: 420, h: 4400, kind: 'wall' },
      { x: -900, y: FLOOR[0], w: RISE[0] + 900, h: 1000, kind: 'c8_stage', tier: 0 },
      { x: RISE[0], y: FLOOR[1], w: RISE[1] - RISE[0], h: 1200, kind: 'c8_stage', tier: 1 },
      { x: RISE[1], y: FLOOR[2], w: RISE[2] - RISE[1], h: 1400, kind: 'c8_stage', tier: 2 },
      { x: RISE[2], y: FLOOR[3], w: RISE[3] - RISE[2], h: 1600, kind: 'c8_stage', tier: 3 },
      { x: RISE[3], y: 0, w: 8700 - RISE[3], h: 1800, kind: 'c8_stage', tier: 4 },
      { x: DECK.x0, y: DECK.y, w: DECK.x1 - DECK.x0, h: DECK.h, kind: 'c8_deck' },
      { x: 8300, y: -2600, w: 400, h: 2700, kind: 'wall' },
    ],
    oneways: [
      // staircases of light at every rise (two hops of 100)
      { x: RISE[0] - 140, y: FLOOR[0] - 100, w: 130, k: 'light' },
      { x: RISE[1] - 140, y: FLOOR[1] - 100, w: 130, k: 'light' },
      { x: RISE[2] - 140, y: FLOOR[2] - 100, w: 130, k: 'light' },
      { x: RISE[3] - 140, y: FLOOR[3] - 100, w: 130, k: 'light' },
      // the Belfry climb (secret): frozen ledges up to the floating cliff
      { x: 2905, y: 300, w: 115, k: 'ledge' }, { x: 3000, y: 195, w: 100, k: 'ledge' }, { x: 2905, y: 90, w: 115, k: 'ledge' },
      { x: BELFRY.x0, y: BELFRY.y, w: BELFRY.x1 - BELFRY.x0, k: 'cliff' },
      // the rooftop ridge
      { x: ROOF.x0, y: ROOF.y, w: ROOF.x1 - ROOF.x0, k: 'roof' },
      // the stair of light up to Descent I's deck
      { x: 4470, y: 100, w: 130, k: 'light' }, { x: 4565, y: -5, w: 115, k: 'light' }, { x: 4455, y: -110, w: 120, k: 'light' }, { x: 4560, y: -215, w: 120, k: 'light' },
    ],
    pylons: [
      { id: 'c8_p1', x: 2800, y: FLOOR[2], name: '光之階梯魂燈台', dialog: 'c8_pylon1', flag: 'c8_pylon1_seen' },
      { id: 'c8_p2', x: 6500, y: 0, name: '最後的魂燈台', dialog: 'c8_pylon2', flag: 'c8_pylon2_seen' },
    ],
    notes: [
      { id: 'c8_n1', x: 430, y: FLOOR[0], flag: 'c8_read_apology' },
      { id: 'c8_n2', x: 2615, y: FLOOR[1], flag: 'c8_read_diary' },
      { id: 'c8_n3', x: 3125, y: BELFRY.y, flag: 'c8_read_talia' },
      { id: 'c8_n4', x: 5430, y: FLOOR[3], flag: 'c8_read_odelog' },
      { id: 'c8_n5', x: 5585, y: DECK.y, flag: 'c8_read_rollcall' },
    ],
    items: [],
    npcs: [],   // filled below (memory painters)
    triggers: [
      { id: 'c8_t_ghost', x: 200, kind: 'c8_bark', bark: 'c8_ghost' },
      { id: 'c8_t_hush', x: 560, kind: 'dialog', dialog: 'c8_hush' },
      { id: 'c8_t_stairs', x: 1050, kind: 'hint', hint: 'c8_stairs' },
      { id: 'c8_t_bell', x: 2110, kind: 'dialog', dialog: 'c8_bellMem' },
      { id: 'c8_t_vista', x: RISE[1] + 30, kind: 'c8_vista' },
      { id: 'c8_t_secret', x: 2870, kind: 'hint', hint: 'c8_secret' },
      { id: 'c8_t_belfry', x: 3070, kind: 'c8_bark', bark: 'c8_belfry' },
      { id: 'c8_t_roof', x: RISE[2] + 30, kind: 'dialog', dialog: 'c8_roof' },
      { id: 'c8_t_island', x: 4450, kind: 'c8_bark', bark: 'c8_island' },
      { id: 'c8_t_elite', x: 4560, yMax: -300, kind: 'dialog', dialog: 'c8_eliteIntro', enc: 'c8_elite', startEnc: 'c8_elite', flag: 'c8_elite_seen',
        focus: { x: ARENA.elite[0] + 600, y: DECK.y - 170, zoom: 0.95 } },
      { id: 'c8_t_summit', x: RISE[3] + 10, yMax: 60, kind: 'dialog', dialog: 'c8_summit' },
      { id: 'c8_t_door', x: 6262, kind: 'c8_bark', bark: 'c8_door' },
      { id: 'c8_t_vega', x: 6330, kind: 'c8_vega' },
      { id: 'c8_t_boss', x: ARENA.boss[0] - 200, kind: 'dialog', dialog: 'c8_bossIntro', enc: 'c8_boss', startEnc: 'c8_boss', flag: 'c8_boss_seen',
        focus: { x: ARENA.boss[0] + 800, y: -170, zoom: 0.95 }, music: 'c8_boss' },
    ],
    // `air` = height above the floor for fliers (walkers ignore it) — resolved against the live types below
    encounters: {
      // the wings: the held breaths come first, and a murmur from Ashport that the Rest remembers
      c8_e1: { trigger: 640, respawn: true, waves: [
        [{ t: 'c8_hushling', x: 1000 }, { t: 'c8_hushling', x: 1110 }, { t: 'murmur', x: 1230 }],
        [{ t: 'c8_conductor', x: 1150, air: -230 }, { t: 'murmur', x: 1260 }]] },
      // the bells: a conductor keeps time for the Belfry's hounds
      c8_e2: { trigger: 1480, respawn: true, waves: [
        [{ t: 'c8_conductor', x: 1900, air: -230 }, { t: 'c2_rimehound', x: 1990 }, { t: 'c2_rimehound', x: 2110 }],
        [{ t: 'c8_cadence', x: 2050 }, { t: 'c8_hushling', x: 1850 }, { t: 'c4_marionette', x: 2170 }]] },
      // the Staircase of Light seals under the Belfry
      c8_e3: { trigger: 3430, arena: ARENA.e3, wallBottom: FLOOR[2], waves: [
        [{ t: 'c8_cadence', x: 3800 }, { t: 'c8_hushling', x: 3620 }, { t: 'c6_warden', x: 3700 }],
        [{ t: 'c8_coda', x: 3720 }, { t: 'c8_conductor', x: 3860, air: -230 }, { t: 'c3_echobat', x: 3600, air: -260 }]] },
      // under Descent I's deck (only once Rinne is down on the boards, never while she stands on the deck above)
      c8_e4: { trigger: 4800, yMin: 100, respawn: true, waves: [
        [{ t: 'c8_coda', x: 5150 }, { t: 'c5_breacher', x: 5290 }, { t: 'c8_hushling', x: 5040 }],
        [{ t: 'c8_conductor', x: 5100, air: -220 }, { t: 'c3_listener', x: 5360 }]] },
      c8_elite: { manual: true, elite: true, arena: ARENA.elite, wallBottom: DECK.y, waves: [[{ t: 'c8_elite', x: ARENA.elite[0] + 700 }]] },
      // the last gauntlet: everything the Rest remembers, at once
      c8_e5: { trigger: 5680, yMin: -100, arena: ARENA.e5, waves: [
        [{ t: 'c8_cadence', x: 6020 }, { t: 'c7_mirror', x: 6150 }, { t: 'c8_hushling', x: 5800 }],
        [{ t: 'c8_conductor', x: 5900, air: -240 }, { t: 'c6_seraph', x: 6100, air: -260 }, { t: 'c2_knellmonk', x: 5760 }],
        [{ t: 'c8_coda', x: 6050 }, { t: 'c4_usher', x: 5820 }]] },
      c8_boss: { manual: true, boss: true, arena: ARENA.boss, waves: [[{ t: 'c8_boss', x: ARENA.boss[0] + 950 }]] },
    },
    zones: [
      { x: -1e9, name: '第七道門', en: 'THE SEVENTH GATE', tint: 0, music: 'c8_explore', amb: 'c8_wings' },
      { x: RISE[0], name: '鐘聲的記憶', en: 'A MEMORY OF BELLS', tint: 0.1, music: 'c8_explore', amb: 'c8_memory' },
      { x: RISE[1], name: '光之階梯', en: 'THE STAIRCASE OF LIGHT', tint: 0.25, music: 'c8_explore2', amb: 'c8_memory' },
      { x: RISE[2], name: '畫出來的夕陽', en: 'A PAINTED SUNSET', tint: 0.4, music: 'c8_explore2', amb: 'c8_memory' },
      { x: RISE[3], name: '冥后的王座', en: 'THE THRONE OF THE DEAD QUEEN', tint: 0.55, music: 'c8_heart', amb: 'c8_heart' },
    ],
    tintAt,
  };
  // resolve flier heights against the live foe types (walkers spawn on the floor)
  for (const id in level.encounters) for (const w of level.encounters[id].waves) for (const d of w) {
    if (d.air == null) continue;
    const T = G.ENEMY_TYPES && G.ENEMY_TYPES[d.t];
    if (T && T.fly) d.y = T.hover ? d.air : floorAt(d.x) + d.air;
    delete d.air;
  }
  // a boss that hovers declares its own spawn height (contract: floor y = 0 unless the type says otherwise)
  { const BT = G.ENEMY_TYPES && G.ENEMY_TYPES.c8_boss; if (BT && BT.fly && BT.spawnY != null) level.encounters.c8_boss.waves[0][0].y = BT.spawnY; }

  /* =========================================================================================
     PALETTE + MATERIALS  (tint 0 = the cool pearl of the wings · tint 1 = the gilt of the heart)
     ========================================================================================= */
  const pal = {
    skyTop: ['#120d1c', '#170d18'], skyMid: ['#3a2d4a', '#4a2c3e'], skyLow: ['#9b7480', '#b47c6e'], horizon: ['#ecc8b0', '#ffd8a4'],
    far: ['#7a6880', '#86666a'], mid: ['#4b3b55', '#583c4a'], midDark: ['#2d2238', '#35202c'],
    near: ['#3a2c44', '#45293a'], nearDark: ['#241a2e', '#2b1623'], rim: ['#f2c98a', '#ffd59a'],
    ground: ['#ece2d2', '#f2e3cb'], groundDark: ['#2a2035', '#2f1c29'], groundTop: ['#fffaf0', '#fff3da'],
    fog: ['#5a4560', '#6a4552'],
  };
  const M = {
    ivory: '#ece2d2', ivoryL: '#fffaf0', ivoryS: '#c9bcab', ivoryD: '#9a8b84', seam: '#a89a8e',
    face: '#2c2236', faceL: '#43344f', faceD: '#1c1526', faceDD: '#120d19',
    gold: '#d9b25e', goldL: '#ffe2a0', goldD: '#8a6328', goldDD: '#4a3418',
    velvet: '#5c1a33', velvetL: '#8e2c4c', velvetD: '#330c1e',
    rose: '#ff9b7a', sun: '#ffb867', sunL: '#ffe0a0', amber: '#ffbe6b', ice: '#9fe8ff', iceD: '#4f8fb8', snow: '#f4f8ff',
    bronze: '#b98a52', bronzeL: '#e8c48a', bronzeD: '#6a4a2a', scarf: '#c23b36', scarfD: '#7a1e22',
    lilac: '#b9a8c8', lilacD: '#7d6c93', pearl: '#efe8f2', crim: '#ff2a5f',
    steel: '#59607a', steelL: '#9aa3c0', steelD: '#2c3046', hazard: '#e8b440',
    brass: '#c99a48', brassL: '#ffe2a0', brassD: '#7a5524', wood: '#5a3524', woodL: '#8a5a3a', woodD: '#33190f', comb: '#b9c0d2',
  };

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
  // inked block with cel faces: lit top strip, shadow bottom / left strip
  function block(g, x, y, w, h, C, o = {}) {
    rect(g, x - 1.5, y - 1.5, w + 3, h + 3, o.ink || INK);
    rect(g, x, y, w, h, C.body);
    const t = o.top ?? Math.min(4, h * 0.2);
    rect(g, x, y, w, t, C.lit);
    rect(g, x, y + h - Math.min(5, h * 0.25), w, Math.min(5, h * 0.25), C.dark);
    if (o.side !== false) rect(g, x, y, Math.min(5, w * 0.22), h, C.dark);
  }
  // a hanging cable / rope
  function rope(g, x1, y1, x2, y2, sag, col, w) { g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2, Math.max(y1, y2) + sag, x2, y2); g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.stroke(); }
  // sheet of music: a little paper with five staff lines and a few note heads
  function sheet(g, x, y, w, h, ang, rr, col = '#f2ead9') {
    g.save(); g.translate(x, y); g.rotate(ang);
    poly(g, [[-w / 2, -h / 2], [w / 2, -h / 2 + rr() * 2], [w / 2 - 1, h / 2], [-w / 2 + rr() * 2, h / 2]]); g.fillStyle = col; g.fill(); ink(g, 0.8);
    g.strokeStyle = 'rgba(40,30,50,0.55)'; g.lineWidth = 0.5; g.beginPath();
    for (let k = 0; k < 5; k++) { const yy = -h * 0.3 + k * h * 0.12; g.moveTo(-w * 0.4, yy); g.lineTo(w * 0.4, yy); }
    g.stroke();
    g.fillStyle = 'rgba(30,20,40,0.8)';
    for (let k = 0; k < 4; k++) { const nx = -w * 0.3 + k * w * 0.2, ny = -h * 0.3 + Math.floor(rr() * 5) * h * 0.06; g.beginPath(); g.ellipse(nx, ny, 1.4, 1, -0.4, 0, TAU); g.fill(); g.fillRect(nx + 1, ny - 5, 0.5, 5); }
    g.restore();
  }
  // a quarter rest (𝄽) — the Rest's own sign
  function restGlyph(g, x, y, s) {
    g.beginPath();
    g.moveTo(x - 2 * s, y - 14 * s); g.lineTo(x + 3 * s, y - 7 * s); g.quadraticCurveTo(x - 2 * s, y - 3 * s, x + 1 * s, y + 1 * s);
    g.lineTo(x + 3 * s, y + 5 * s); g.quadraticCurveTo(x - 4 * s, y + 2 * s, x - 1 * s, y + 10 * s);
    g.quadraticCurveTo(x - 6 * s, y + 5 * s, x - 1 * s, y + 3 * s); g.lineTo(x - 3 * s, y - 1 * s);
    g.quadraticCurveTo(x + 1 * s, y - 5 * s, x - 2 * s, y - 14 * s); g.closePath();
  }
  // a cluster of Hush crystals in the Rest's colours: pearl with a black heart
  function pearlShard(g, x, y, ang, len, wd) {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    const tip = [x + dx * len, y + dy * len], l = [x + nx * wd, y + ny * wd], r = [x - nx * wd, y - ny * wd];
    poly(g, [l, tip, r]); g.fillStyle = '#a99cb6'; g.fill(); ink(g, 1);
    poly(g, [[x + dx * len * 0.1, y + dy * len * 0.1], tip, l]); g.fillStyle = '#f4eef8'; g.fill();
    g.strokeStyle = 'rgba(11,6,18,0.75)'; g.lineWidth = Math.max(0.6, wd * 0.25);
    g.beginPath(); g.moveTo(x + dx * len * 0.25, y + dy * len * 0.25); g.lineTo(x + dx * len * 0.6, y + dy * len * 0.6); g.stroke();
  }
  function pearlCluster(g, x, y, s, ang, rr) {
    glow(g, x, y - 8 * s, 34 * s, '#fff1e0', 0.25);
    const n = 3 + Math.floor(rr() * 3);
    for (let i = 0; i < n; i++) {
      const a = ang + (i / (n - 1 || 1) - 0.5) * 1.2 + (rr() - 0.5) * 0.3;
      pearlShard(g, x + (rr() - 0.5) * 8 * s, y, a, (12 + rr() * 18) * s * (i === (n >> 1) ? 1.5 : 1), (2.6 + rr() * 2) * s);
    }
  }

  /* =========================================================================================
     PARALLAX — FAR (f 0.08): the endless pale stage running to the horizon, colossal prosceniums
     half-dissolved into the eclipse, the Ladder's broken tether, the Ark adrift; the music box waiting far ahead
     ========================================================================================= */
  const FAR_BOX = BOX.x * 0.08;
  function proscenium(g, rr, x, base, w, h, k) {
    // two pilasters and a broken arch, hazy lilac with a warm rim on the sun side
    const pw = w * 0.13, C = { body: mixH('#8b7790', '#a48f9a', k), dark: mixH('#6c5a76', '#86707e', k), lit: mixH('#f3dcc6', '#fff0dc', k) };
    const top = base - h, archR = (w - pw) / 2;
    for (const px of [x, x + w - pw]) {
      poly(g, [[px, base + 4], [px, top + archR * 0.3], [px + pw, top + archR * 0.3], [px + pw, base + 4]]);
      g.fillStyle = C.body; g.fill(); g.strokeStyle = rgba(INK, 0.32); g.lineWidth = 1.4; g.stroke();
      rect(g, px + pw - 3, top + archR * 0.3, 3, h - archR * 0.3, C.lit);
      rect(g, px, top + archR * 0.3, pw * 0.3, h - archR * 0.3, C.dark);
      for (let y = top + archR * 0.5; y < base; y += 26 + rr() * 16) rect(g, px, y, pw, 1, rgba(INK, 0.18));
      // capital
      rect(g, px - 4, top + archR * 0.3 - 7, pw + 8, 7, C.body); rect(g, px - 4, top + archR * 0.3 - 7, pw + 8, 2, C.lit);
    }
    // the arch, broken at a random point (its missing stones float a little above)
    const cx = x + w / 2, cy = top + archR * 0.3, brk = 0.25 + rr() * 0.5;
    g.lineWidth = pw * 0.8; g.lineCap = 'butt';
    g.beginPath(); g.arc(cx, cy, archR, PI, PI + PI * brk); g.strokeStyle = C.body; g.stroke();
    g.beginPath(); g.arc(cx, cy, archR, PI + PI * (brk + 0.12), TAU); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, archR + pw * 0.4, PI * (1.55 + brk * 0.2), TAU); g.strokeStyle = C.lit; g.stroke();
    for (let i = 0; i < 3; i++) {
      const a = PI + PI * (brk + 0.03 + i * 0.035), r = archR, fx = cx + Math.cos(a) * r, fy = cy + Math.sin(a) * r - 18 - i * 14 - rr() * 10;
      g.save(); g.translate(fx, fy); g.rotate(a + rr()); rect(g, -pw * 0.3, -pw * 0.3, pw * 0.6, pw * 0.5, C.body); g.restore();
    }
  }
  function genFar() {
    const x0 = -1000, x1 = 1600, objs = [];
    const rng = U.mulberry32(8101);
    // the endless stage: boards converging on the music box, the corona's reflection running down the lacquer
    objs.push(...chunks(x0, x1, 512, -40, 760, (g, a, b) => {
      const gr = g.createLinearGradient(0, -6, 0, 700);
      gr.addColorStop(0, '#f7e2c8'); gr.addColorStop(0.025, '#dcc4b6'); gr.addColorStop(0.2, '#ae97a2'); gr.addColorStop(0.55, '#7c6884'); gr.addColorStop(1, '#4a3a54');
      g.fillStyle = gr; g.fillRect(a, -2, b - a, 704);
      if (b > FAR_BOX - 400 && a < FAR_BOX + 400) {
        const rg = g.createLinearGradient(FAR_BOX - 120, 0, FAR_BOX + 120, 0);
        rg.addColorStop(0, 'rgba(255,240,215,0)'); rg.addColorStop(0.5, 'rgba(255,240,215,0.32)'); rg.addColorStop(1, 'rgba(255,240,215,0)');
        g.fillStyle = rg; g.fillRect(FAR_BOX - 120, 0, 240, 700);
      }
      g.strokeStyle = 'rgba(52,34,64,0.3)'; g.lineWidth = 0.9; g.beginPath();
      for (let k = -70; k <= 70; k++) { g.moveTo(FAR_BOX + k * 1.4, 0); g.lineTo(FAR_BOX + k * 62, 700); }
      g.stroke();
      for (let i = 1; i < 22; i++) { const yy = 700 * Math.pow(i / 22, 2.1); rect(g, a, yy, b - a, 0.6 + yy * 0.003, 'rgba(52,34,64,0.24)'); }
      rect(g, a, -1.5, b - a, 2.2, 'rgba(255,244,222,0.95)');
    }));
    // colossal prosceniums along the horizon
    let x = x0;
    while (x < x1) {
      const w = 150 + rng() * 140, h = 260 + rng() * 260, bx = x, seed = (rng() * 1e6) | 0, k = clamp((x + 200) / 1500, 0, 1);
      objs.push({ x: bx - 30, y: -h - 110, w: w + 60, h: h + 120, draw(g) { proscenium(g, U.mulberry32(seed), bx, 4, w, h, k); } });
      x += w + 120 + rng() * 260;
    }
    // the Ladder's tether, snapped, still hanging out of the sky
    objs.push({ x: -480, y: -1300, w: 60, h: 1310, draw(g) {
      g.strokeStyle = rgba('#e8d8ff', 0.35); g.lineWidth = 7; g.beginPath(); g.moveTo(-450, -1300); g.lineTo(-450, -520); g.stroke();
      g.strokeStyle = rgba('#5a4870', 0.8); g.lineWidth = 2.4; g.beginPath(); g.moveTo(-450, -1300); g.lineTo(-450, -520); g.lineTo(-446, -505); g.stroke();
      g.beginPath(); g.moveTo(-452, -330); g.lineTo(-450, 2); g.stroke();
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-450 + (i - 2) * 3, -505); g.lineTo(-450 + (i - 2) * 6, -470 - i * 6); g.stroke(); }
    } });
    // the Ark, adrift in the eclipse: a white silhouette with a few lit windows
    objs.push({ x: 1040, y: -420, w: 260, h: 140, draw(g) {
      const cx = 1170, cy = -350;
      g.fillStyle = rgba('#d8d2e6', 0.72);
      g.beginPath(); g.ellipse(cx, cy, 100, 16, 0, 0, TAU); g.fill();
      for (let i = 0; i < 7; i++) { const sx = cx - 70 + i * 23, sh = 20 + ((i * 37) % 30); g.fillRect(sx, cy - sh, 7, sh); }
      g.strokeStyle = rgba('#d8d2e6', 0.6); g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy - 6, 124, 22, 0, PI * 1.05, PI * 1.95); g.stroke();
      g.fillStyle = 'rgba(255,214,150,0.9)'; for (let i = 0; i < 9; i++) g.fillRect(cx - 80 + i * 19, cy - 3, 2, 2);
    } });
    // the music box on the horizon
    objs.push({ x: FAR_BOX - 130, y: -150, w: 260, h: 160, draw(g) {
      const bx = FAR_BOX, w = 120, h = 40;
      g.save(); g.translate(bx, 0);
      poly(g, [[-w / 2, 0], [-w / 2, -h], [w / 2, -h], [w / 2, 0]]); g.fillStyle = '#5a4466'; g.fill(); g.strokeStyle = rgba(INK, 0.5); g.lineWidth = 1.2; g.stroke();
      poly(g, [[-w / 2, -h], [-w / 2 + 8, -h - 16], [w / 2 + 8, -h - 16], [w / 2, -h]]); g.fillStyle = '#7e6688'; g.fill(); g.stroke();
      rect(g, -w / 2, -h, w, 2, 'rgba(255,226,170,0.9)'); rect(g, -w / 2 + 8, -h - 16, w, 2, 'rgba(255,236,200,0.8)');
      rect(g, -w * 0.3, -h * 0.7, w * 0.6, h * 0.4, 'rgba(255,170,110,0.55)');
      glow(g, 0, -h - 6, 70, '#ffe2a0', 0.45);
      g.restore();
    } });
    // the Rest's sign, written huge and faint across the sky
    for (const [rx, ry, rs] of [[160, -250, 7], [760, -300, 9], [1420, -240, 6]]) objs.push({ x: rx - 60, y: ry - 120, w: 120, h: 240, draw(g) {
      restGlyph(g, rx, ry, rs); g.fillStyle = 'rgba(214,196,226,0.12)'; g.fill(); g.strokeStyle = 'rgba(240,226,250,0.16)'; g.lineWidth = 2; g.stroke();
    } });
    return objs;
  }

  /* =========================================================================================
     PARALLAX — MID (f 0.22): islands of memory — every place Rinne fought through, adrift around the
     ascent (Ashport, the Faultwell, the Belfry, the bell tower at sunset, the Ladder, the Opera, the Ark),
     strung together by staircases of light
     ========================================================================================= */
  const ISL = { body: '#4b3b55', lit: '#6f5a78', dark: '#2a2034', rim: '#f2c98a', ink: rgba(INK, 0.8) };
  function islandRock(g, rr, cx, cy, w, h) {
    // inverted, jagged cone of stage-stone; returns the top-surface y
    const pts = [[cx - w / 2, cy]];
    const n = 7;
    for (let i = 1; i <= n; i++) { const k = i / n; pts.push([cx - w / 2 + w * 0.5 * k + (rr() - 0.5) * w * 0.08, cy + h * Math.pow(k, 1.3) * (0.8 + rr() * 0.3)]); }
    pts.push([cx + (rr() - 0.5) * w * 0.1, cy + h]);
    for (let i = n; i >= 1; i--) { const k = i / n; pts.push([cx + w / 2 - w * 0.5 * k + (rr() - 0.5) * w * 0.08, cy + h * Math.pow(k, 1.25) * (0.8 + rr() * 0.3)]); }
    pts.push([cx + w / 2, cy]);
    poly(g, pts); g.fillStyle = ISL.body; g.fill();
    g.save(); poly(g, pts); g.clip();
    // cel planes: lit right flank, shadowed left, strata
    poly(g, [[cx + w * 0.08, cy], [cx + w / 2 + 4, cy], [cx + w * 0.05, cy + h + 4]]); g.fillStyle = ISL.lit; g.fill();
    poly(g, [[cx - w / 2 - 4, cy], [cx - w * 0.3, cy], [cx - w * 0.05, cy + h]]); g.fillStyle = ISL.dark; g.fill();
    g.strokeStyle = rgba(INK, 0.35); g.lineWidth = 1;
    for (let y = cy + 10; y < cy + h; y += 9 + rr() * 9) { g.beginPath(); g.moveTo(cx - w / 2, y); g.lineTo(cx + w / 2, y + (rr() - 0.5) * 6); g.stroke(); }
    g.restore();
    poly(g, pts); g.strokeStyle = ISL.ink; g.lineWidth = 2; g.stroke();
    rect(g, cx - w / 2, cy - 2, w, 4, '#3c2f48');
    rect(g, cx + w * 0.05, cy - 2, w * 0.45, 2, ISL.rim);
    // hanging roots / rebar, and two loose stones drifting below
    g.strokeStyle = rgba(INK, 0.7); g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { const rx = cx - w * 0.3 + rr() * w * 0.6, ry = cy + h * (0.4 + rr() * 0.4); g.beginPath(); g.moveTo(rx, ry); g.quadraticCurveTo(rx + (rr() - 0.5) * 20, ry + 30, rx + (rr() - 0.5) * 16, ry + 40 + rr() * 50); g.stroke(); }
    for (let i = 0; i < 2; i++) { const sx = cx + (rr() - 0.5) * w * 0.5, sy = cy + h + 20 + rr() * 50, s = 5 + rr() * 8; poly(g, [[sx - s, sy], [sx, sy - s * 0.6], [sx + s, sy], [sx, sy + s * 1.4]]); g.fillStyle = ISL.body; g.fill(); g.strokeStyle = ISL.ink; g.lineWidth = 1; g.stroke(); }
    return cy;
  }
  function islandScene(g, rr, kind, cx, cy, w) {
    if (kind === 'ashport') {
      // broken city blocks, warm windows, a bent street lamp
      let x = cx - w * 0.42;
      while (x < cx + w * 0.38) {
        const bw = 18 + rr() * 22, bh = 30 + rr() * 60;
        poly(g, [[x, cy], [x, cy - bh], [x + bw * 0.4, cy - bh - rr() * 8], [x + bw, cy - bh + rr() * 12], [x + bw, cy]]);
        g.fillStyle = '#3a2c44'; g.fill(); ink(g, 1.2, rgba(INK, 0.8));
        rect(g, x + bw - 2, cy - bh + 10, 2, bh - 10, 'rgba(255,190,130,0.5)');
        for (let yy = cy - bh + 8; yy < cy - 6; yy += 9) for (let xx = x + 3; xx < x + bw - 4; xx += 6) if (rr() < 0.3) rect(g, xx, yy, 2.4, 3, rr() < 0.7 ? 'rgba(255,190,110,0.95)' : 'rgba(255,240,200,0.9)');
        x += bw + 2 + rr() * 6;
      }
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + w * 0.4, cy); g.lineTo(cx + w * 0.4, cy - 50); g.quadraticCurveTo(cx + w * 0.4 + 2, cy - 64, cx + w * 0.4 + 14, cy - 60); g.stroke();
      glow(g, cx + w * 0.4 + 14, cy - 57, 16, '#ffbe6b', 0.6);
    } else if (kind === 'faultwell') {
      for (let i = 0; i < 6; i++) {
        const x = cx - w * 0.35 + i * w * 0.13, h = 24 + rr() * 50, a = -PI / 2 + (rr() - 0.5) * 0.6;
        glow(g, x, cy - h * 0.5, h * 0.8, '#b04dff', 0.18);
        poly(g, [[x - 6, cy], [x + Math.cos(a) * h, cy + Math.sin(a) * h], [x + 6, cy]]); g.fillStyle = i % 2 ? '#7a3fb0' : '#a45ad8'; g.fill(); ink(g, 1.2);
        g.strokeStyle = 'rgba(240,210,255,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 2, cy - 4); g.lineTo(x + Math.cos(a) * h * 0.8, cy + Math.sin(a) * h * 0.8); g.stroke();
      }
    } else if (kind === 'belfry') {
      // snow cap, a little belfry, lanterns and prayer flags; the tether climbing out of frame
      blob(g, [[cx - w / 2, cy + 2], [cx - w * 0.3, cy - 10], [cx, cy - 6], [cx + w * 0.3, cy - 12], [cx + w / 2, cy + 2], [cx, cy + 6]]); g.fillStyle = '#eef4ff'; g.fill(); ink(g, 1.2, rgba(INK, 0.6));
      const bx = cx - w * 0.1;
      rect(g, bx - 16, cy - 60, 32, 52, '#3a3048'); rect(g, bx - 16, cy - 60, 32, 52, 'rgba(0,0,0,0)');
      poly(g, [[bx - 24, cy - 58], [bx, cy - 84], [bx + 24, cy - 58]]); g.fillStyle = '#f4f8ff'; g.fill(); ink(g, 1.4);
      poly(g, [[bx - 9, cy - 50], [bx - 7, cy - 38], [bx + 7, cy - 38], [bx + 9, cy - 50], [bx, cy - 54]]); g.fillStyle = M.bronze; g.fill(); ink(g, 1);
      g.strokeStyle = rgba(INK, 0.85); g.lineWidth = 1.4; g.strokeRect(bx - 16, cy - 58, 32, 50);
      rope(g, cx - w * 0.45, cy - 40, cx + w * 0.35, cy - 46, 14, rgba(INK, 0.7), 0.8);
      for (let i = 0; i < 9; i++) { const fx = cx - w * 0.42 + i * w * 0.085, fy = cy - 40 + Math.sin(i / 9 * PI) * 12; poly(g, [[fx, fy], [fx + 6, fy], [fx + 3, fy + 8]]); g.fillStyle = ['#e85a4a', '#f2c94a', '#5ab0e8', '#f4f4f4', '#6ad08a'][i % 5]; g.fill(); }
      for (const lx of [cx + w * 0.25, cx - w * 0.32]) { rect(g, lx - 2, cy - 22, 4, 7, INK); glow(g, lx, cy - 18, 14, '#ffbe6b', 0.7); rect(g, lx - 1.5, cy - 21, 3, 5, '#ffd48a'); }
      g.strokeStyle = rgba('#dfe9ff', 0.45); g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx + w * 0.38, cy - 4); g.lineTo(cx + w * 0.36, cy - 900); g.stroke();
    } else if (kind === 'tower') {
      // the cathedral bell tower of Ashport, a sunset caught behind it
      glow(g, cx + 6, cy - 110, 120, '#ff9b5c', 0.45); glow(g, cx + 6, cy - 110, 46, '#ffe0a0', 0.6);
      g.beginPath(); g.arc(cx + 6, cy - 104, 30, 0, TAU); g.fillStyle = '#ffcf88'; g.fill();
      const tw = 38;
      poly(g, [[cx - tw / 2, cy], [cx - tw / 2, cy - 130], [cx - tw / 2 - 4, cy - 134], [cx, cy - 176], [cx + tw / 2 + 4, cy - 134], [cx + tw / 2, cy - 130], [cx + tw / 2, cy]]);
      g.fillStyle = '#2e2236'; g.fill(); ink(g, 1.6);
      poly(g, [[cx - 8, cy - 118], [cx - 8, cy - 98], [cx + 8, cy - 98], [cx + 8, cy - 118], [cx, cy - 126]]); g.fillStyle = 'rgba(255,190,120,0.85)'; g.fill();
      rect(g, cx + tw / 2 - 3, cy - 130, 3, 130, 'rgba(255,170,110,0.55)');
      for (const [x2, h2] of [[cx - w * 0.36, 40], [cx + w * 0.3, 52], [cx - w * 0.2, 28]]) { rect(g, x2, cy - h2, 22, h2, '#33263f'); g.strokeStyle = rgba(INK, 0.8); g.lineWidth = 1.2; g.strokeRect(x2, cy - h2, 22, h2); }
    } else if (kind === 'ladder') {
      // a strut of the Ladder with a derelict cargo car hanging from it
      g.strokeStyle = '#5c6080'; g.lineWidth = 3;
      for (const sx of [cx - 18, cx + 18]) { g.beginPath(); g.moveTo(sx, cy); g.lineTo(sx, cy - 700); g.stroke(); }
      g.lineWidth = 1.4; g.beginPath(); for (let y = cy; y > cy - 700; y -= 24) { g.moveTo(cx - 18, y); g.lineTo(cx + 18, y - 24); } g.stroke();
      rect(g, cx + 24, cy - 120, 40, 28, '#6a6e8c'); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(cx + 24, cy - 120, 40, 28);
      rect(g, cx + 30, cy - 114, 10, 8, 'rgba(160,240,220,0.8)');
      glow(g, cx, cy - 300, 24, '#9dffcf', 0.35);
    } else if (kind === 'opera') {
      // the drowned opera's dome rising from a pool of black water
      g.beginPath(); g.ellipse(cx, cy - 2, w * 0.4, 6, 0, 0, TAU); g.fillStyle = '#0d0a16'; g.fill();
      g.strokeStyle = 'rgba(200,220,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy - 2, w * 0.28, 3, 0, PI * 1.1, PI * 1.8); g.stroke();
      g.beginPath(); g.arc(cx, cy - 8, w * 0.26, PI, TAU); g.fillStyle = '#5a2236'; g.fill(); ink(g, 1.6);
      g.save(); g.beginPath(); g.arc(cx, cy - 8, w * 0.26, PI, TAU); g.clip();
      g.strokeStyle = '#d9a650'; g.lineWidth = 1.4; for (let i = 1; i < 6; i++) { g.beginPath(); g.ellipse(cx, cy - 8, w * 0.26 * (i / 6), w * 0.26, 0, PI, TAU); g.stroke(); }
      rect(g, cx + w * 0.06, cy - w * 0.3, w * 0.12, w * 0.12, 'rgba(255,214,150,0.25)');
      g.restore();
      g.beginPath(); g.arc(cx + w * 0.1, cy - 8 - w * 0.18, 9, 0, TAU); g.fillStyle = '#0d0a16'; g.fill();
      rect(g, cx - 2, cy - 8 - w * 0.26 - 16, 4, 16, '#d9a650');
    } else if (kind === 'ark') {
      // white spires with cyan windows and a halo ring — the Ark remembered from below
      for (let i = 0; i < 5; i++) {
        const sx = cx - w * 0.3 + i * w * 0.15, sh = 50 + ((i * 53) % 70);
        poly(g, [[sx, cy], [sx, cy - sh], [sx + 7, cy - sh - 12], [sx + 14, cy - sh], [sx + 14, cy]]); g.fillStyle = '#d8dcea'; g.fill(); ink(g, 1.2);
        rect(g, sx, cy - sh, 4, sh, '#a3a9c4');
        for (let y = cy - sh + 8; y < cy - 4; y += 8) rect(g, sx + 6, y, 3, 3, 'rgba(127,246,255,0.9)');
      }
      g.strokeStyle = rgba(INK, 0.7); g.lineWidth = 5; g.beginPath(); g.ellipse(cx, cy - 60, w * 0.45, 12, 0, 0, PI); g.stroke();
      g.strokeStyle = '#e8eef8'; g.lineWidth = 2.5; g.stroke();
    }
  }
  function lightStair(g, x, y, n, dx, dy, w) {
    for (let i = 0; i < n; i++) {
      const sx = x + i * dx, sy = y + i * dy, sw = w * (1 - i * 0.012), a = 0.75 - i * 0.012;
      glow(g, sx + sw / 2, sy + 4, sw * 0.8, '#ffe8c0', 0.16 * a);
      rect(g, sx, sy, sw, 5, rgba('#fff4dc', a)); rect(g, sx, sy, sw, 1.4, 'rgba(255,255,255,0.95)');
      g.strokeStyle = rgba('#c49a5a', a * 0.8); g.lineWidth = 0.8; g.strokeRect(sx, sy, sw, 5);
      rect(g, sx + sw * 0.2, sy + 5, sw * 0.6, 14, rgba('#fff0d0', 0.06 * a));
    }
  }
  // islands float at a steady height on screen whichever tier Rinne stands on: seat them by the tier below them
  const midY = (lx) => 0.1 * floorAt(lx / 0.22) - 282;
  const ISLANDS = [
    [-420, 10, 180, 120, 'ashport'], [90, 30, 220, 140, 'ashport'], [300, -50, 150, 110, 'faultwell'], [700, 20, 210, 150, 'belfry'],
    [960, 40, 200, 130, 'tower'], [1170, -40, 130, 100, 'ladder'], [1340, 10, 190, 140, 'opera'], [1490, -40, 160, 120, 'ark'],
    [1990, 20, 200, 140, 'opera'], [2300, -20, 180, 120, 'ark'],
  ];
  function genMid() {
    const objs = [];
    ISLANDS.forEach(([cx, dy, w, h, kind], i) => {
      const seed = 8200 + i * 31, cy = midY(cx) + dy;
      objs.push({ x: cx - w / 2 - 140, y: cy - 920, w: w + 280, h: h + 1020, draw(g) {
        const rr = U.mulberry32(seed);
        islandRock(g, rr, cx, cy, w, h);
        islandScene(g, rr, kind, cx, cy, w);
      } });
    });
    // staircases of light, stringing the memories together and climbing toward the black sun
    const STAIRS = [[40, 70, 14, 9, -17, 34], [560, -40, 10, 13, -16, 30], [1060, 40, 22, 11, -20, 30], [1500, 20, 26, 10, -22, 34], [1780, -250, 12, 14, -15, 26]];
    for (const [sx, sy0, n, dx, dy, w] of STAIRS) {
      const sy = sy0 + midY(sx) + 202;
      const x0 = Math.min(sx, sx + n * dx) - 60, y0 = sy + n * dy - 60;
      objs.push({ x: x0, y: y0, w: Math.abs(n * dx) + w + 120, h: Math.abs(n * dy) + 120, draw(g) { lightStair(g, sx, sy, n, dx, dy, w); } });
    }
    // hanging stage drapes framing the far left and right of the ascent
    for (const [dx0, dw] of [[-760, 260], [2440, 300]]) objs.push({ x: dx0 - 20, y: -900, w: dw + 40, h: 1000, draw(g) {
      const rr = U.mulberry32(dx0 | 0);
      for (let i = 0; i < 6; i++) {
        const fx = dx0 + i * dw / 6, fw = dw / 6 + 6;
        const gr = g.createLinearGradient(fx, 0, fx + fw, 0);
        gr.addColorStop(0, '#3a1028'); gr.addColorStop(0.45, '#7a2442'); gr.addColorStop(0.55, '#8e2c4c'); gr.addColorStop(1, '#2a0a1c');
        poly(g, [[fx, -900], [fx + fw, -900], [fx + fw + (rr() - 0.5) * 10, 40], [fx + (rr() - 0.5) * 10, 40]]); g.fillStyle = gr; g.fill();
        g.strokeStyle = rgba(INK, 0.6); g.lineWidth = 1; g.stroke();
      }
      rect(g, dx0, 30, dw, 8, '#c9a050');
    } });
    return objs;
  }

  /* =========================================================================================
     PARALLAX — NEAR (f 0.45): upstage — painted flats of Mira's memories, fly rigging, music stands,
     ghost lights, a staircase of piano keys; gilded columns around the heart
     ========================================================================================= */
  function flat(g, rr, x, base, w, h, scene) {
    // braces behind (seen at the edges), sandbag weights, then the painted face with a cut-out silhouette
    g.strokeStyle = '#1e1416'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x + 10, base); g.lineTo(x - 22, base); g.lineTo(x + 6, base - h * 0.6); g.stroke();
    g.beginPath(); g.moveTo(x + w - 10, base); g.lineTo(x + w + 22, base); g.lineTo(x + w - 6, base - h * 0.6); g.stroke();
    blob(g, [[x - 32, base], [x - 30, base - 10], [x - 12, base - 12], [x - 8, base]]); g.fillStyle = '#3a2c2a'; g.fill(); ink(g, 1);
    blob(g, [[x + w + 8, base], [x + w + 12, base - 12], [x + w + 30, base - 10], [x + w + 32, base]]); g.fill(); ink(g, 1);
    const top = [];
    if (scene === 'houses') {
      let xx = x; top.push([x, base]);
      while (xx < x + w) { const bw = 34 + rr() * 40, bh = h * (0.55 + rr() * 0.45); top.push([xx, base - bh + 14], [xx + bw * 0.5, base - bh - 12], [Math.min(x + w, xx + bw), base - bh + 14]); xx += bw; }
      top.push([x + w, base]);
    } else if (scene === 'pines') {
      top.push([x, base]); for (let xx = x; xx < x + w; xx += 30) { const ph = h * (0.6 + rr() * 0.4); top.push([xx + 4, base - ph * 0.4], [xx + 15, base - ph], [xx + 26, base - ph * 0.4]); } top.push([x + w, base]);
    } else if (scene === 'moon') {
      top.push([x, base], [x + w * 0.1, base - h * 0.7], [x + w * 0.5, base - h], [x + w * 0.9, base - h * 0.7], [x + w, base]);
    } else {
      top.push([x, base]); for (let xx = x; xx <= x + w; xx += 26) top.push([xx, base - h * 0.75 - Math.sin((xx - x) / w * PI * 3) * h * 0.18]); top.push([x + w, base]);
    }
    poly(g, top);
    const sky = scene === 'houses' ? ['#c08a76', '#6a4a5e'] : scene === 'pines' ? ['#93a0bc', '#545a7a'] : scene === 'moon' ? ['#76769a', '#45405e'] : ['#6a78a0', '#40405e'];
    const gr = g.createLinearGradient(0, base - h, 0, base); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]);
    g.fillStyle = gr; g.fill();
    g.save(); poly(g, top); g.clip();
    // paint: the scene in broad stage-paint strokes
    if (scene === 'houses') {
      g.beginPath(); g.arc(x + w * 0.7, base - h * 0.55, h * 0.14, 0, TAU); g.fillStyle = '#e8b878'; g.fill();
      for (let xx = x + 8; xx < x + w - 8; xx += 13) if (rr() < 0.4) rect(g, xx, base - h * (0.2 + rr() * 0.4), 4, 6, '#e8b070');
      rect(g, x, base - h * 0.18, w, h * 0.18, '#3a2232');
    } else if (scene === 'pines') {
      for (let xx = x + 10; xx < x + w; xx += 30) rect(g, xx + 3, base - h, 2, h, 'rgba(255,255,255,0.25)');
      rect(g, x, base - h * 0.14, w, h * 0.14, '#b8c4dc');
    } else if (scene === 'moon') {
      g.beginPath(); g.arc(x + w * 0.5, base - h * 0.55, h * 0.26, 0, TAU); g.fillStyle = '#d8d0b0'; g.fill();
      g.beginPath(); g.arc(x + w * 0.58, base - h * 0.6, h * 0.24, 0, TAU); g.fillStyle = '#3a3658'; g.fill();
      for (let i = 0; i < 9; i++) rect(g, x + rr() * w, base - h * (0.3 + rr() * 0.6), 2, 2, 'rgba(255,240,200,0.7)');
    } else {
      g.strokeStyle = 'rgba(200,215,240,0.45)'; g.lineWidth = 2;
      for (let k = 0; k < 4; k++) { g.beginPath(); for (let xx = x; xx <= x + w; xx += 12) g.lineTo(xx, base - h * (0.18 + k * 0.14) - Math.sin((xx - x) / 40 + k) * 5); g.stroke(); }
    }
    // dry-brush texture, then the haze of the Rest and the shadow side
    g.strokeStyle = 'rgba(255,240,220,0.06)'; g.lineWidth = 3;
    for (let i = 0; i < 10; i++) { const yy = base - rr() * h; g.beginPath(); g.moveTo(x + rr() * w * 0.3, yy); g.lineTo(x + w * (0.5 + rr() * 0.5), yy + (rr() - 0.5) * 6); g.stroke(); }
    g.fillStyle = 'rgba(132,112,140,0.42)'; g.fillRect(x - 2, base - h - 40, w + 4, h + 44);
    const sg = g.createLinearGradient(x, 0, x + w, 0); sg.addColorStop(0, 'rgba(30,16,40,0.32)'); sg.addColorStop(0.5, 'rgba(30,16,40,0)'); sg.addColorStop(1, 'rgba(255,200,150,0.08)');
    g.fillStyle = sg; g.fillRect(x - 2, base - h - 40, w + 4, h + 44);
    g.restore();
    poly(g, top); ink(g, 2.2);
    // a warm rim on the sun side
    g.strokeStyle = 'rgba(255,214,160,0.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(top[top.length - 2][0], top[top.length - 2][1]); g.lineTo(x + w, base); g.stroke();
  }
  function musicStand(g, x, base, h, rr) {
    g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - h); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.moveTo(x - 16, base); g.lineTo(x, base - 20); g.lineTo(x + 16, base); g.stroke();
    g.save(); g.translate(x, base - h); g.rotate(-0.12);
    poly(g, [[-26, -30], [26, -30], [24, 4], [-24, 4]]); g.fillStyle = '#2a2232'; g.fill(); ink(g, 1.6);
    sheet(g, -10, -14, 22, 30, -0.05, rr, '#cfc4b2'); sheet(g, 11, -14, 22, 30, 0.04, rr, '#d8cdbb');
    g.restore();
  }
  // the upstage floor steps with the terraces, so the scenery always stands just behind the stage edge Rinne is on
  const NEARF = 0.45;
  const nearGround = (lx) => 0.25 * floorAt(lx / NEARF) - 14;
  const NEAR_RISES = RISE.map((r) => r * NEARF);
  function genNear() {
    const x0 = -1000, x1 = 4600, objs = [];
    const rng = U.mulberry32(8301);
    // upstage floor: worn boards, gaffer tape, one gilt-edged step per terrace
    objs.push(...chunks(x0, x1, 512, -40, 960, (g, a, b) => {
      const rr = U.mulberry32((a | 0) + 77);
      const cuts = [a].concat(NEAR_RISES.filter((r) => r > a && r < b), [b]);
      for (let i = 0; i < cuts.length - 1; i++) {
        const s0 = cuts[i], s1 = cuts[i + 1], gy = nearGround((s0 + s1) / 2);
        const gr = g.createLinearGradient(0, gy - 4, 0, gy + 420);
        gr.addColorStop(0, '#6e5a72'); gr.addColorStop(0.05, '#44364f'); gr.addColorStop(0.4, '#2a2036'); gr.addColorStop(1, '#14101c');
        g.fillStyle = gr; g.fillRect(s0, gy - 2, s1 - s0, 920);
        rect(g, s0, gy - 2, s1 - s0, 1.6, 'rgba(255,226,190,0.55)');
        rect(g, s0, gy + 9, s1 - s0, 2, 'rgba(201,160,80,0.35)');
        g.strokeStyle = 'rgba(14,8,20,0.45)'; g.lineWidth = 1; g.beginPath();
        for (let xx = Math.floor(s0 / 40) * 40; xx < s1; xx += 40) { g.moveTo(xx, gy); g.lineTo(xx, gy + 8); }
        g.stroke();
        for (let xx = s0 + rr() * 120; xx < s1; xx += 160 + rr() * 260) { g.save(); g.translate(xx, gy + 4); g.scale(1, 0.4); g.rotate(rr()); rect(g, -8, -1.5, 16, 3, 'rgba(240,200,120,0.5)'); rect(g, -1.5, -8, 3, 16, 'rgba(240,200,120,0.5)'); g.restore(); }
      }
      for (const r of NEAR_RISES) if (r >= a - 4 && r <= b + 4) { const g1 = nearGround(r + 1), g0 = nearGround(r - 1); rect(g, r - 3, g1 - 2, 6, g0 - g1 + 4, '#5a4430'); rect(g, r - 1, g1, 1.4, g0 - g1, '#e8c890'); }
    }));
    // fly rigging: a batten with lamps, ropes with sandbags (high, so the action stays clear)
    objs.push(...chunks(x0, x1, 512, -900, 640, (g, a, b) => {
      const rr = U.mulberry32((a | 0) + 991);
      rect(g, a, -452, b - a, 6, '#1e1626'); rect(g, a, -452, b - a, 1.5, 'rgba(255,220,170,0.4)');
      for (let xx = Math.floor(a / 230) * 230 + 40; xx < b; xx += 230) {
        g.strokeStyle = '#1a1220'; g.lineWidth = 2; g.beginPath(); g.moveTo(xx, -446); g.lineTo(xx, -420); g.stroke();
        poly(g, [[xx - 14, -420], [xx + 14, -420], [xx + 9, -398], [xx - 9, -398]]); g.fillStyle = '#2a2030'; g.fill(); ink(g, 1.4);
        if ((xx / 230 | 0) % 3 === 0) { glow(g, xx, -392, 40, '#ffe2a0', 0.35); rect(g, xx - 7, -399, 14, 2, '#fff1c8'); }
      }
      for (let xx = Math.floor(a / 410) * 410 + 120; xx < b; xx += 410) {
        const len = 520 + rr() * 140;
        g.strokeStyle = 'rgba(30,22,34,0.9)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(xx, -900); g.lineTo(xx, -900 + len); g.stroke();
        blob(g, [[xx - 9, -900 + len], [xx + 9, -900 + len], [xx + 10, -900 + len + 22], [xx - 10, -900 + len + 22]]); g.fillStyle = '#4a3a30'; g.fill(); ink(g, 1.2);
      }
    }));
    // painted flats and music stands — a stage that remembers (kept clear of the steps and of the heart's columns)
    let x = x0 + 60;
    while (x < 2950) {
      const r = rng(), bx = x, seed = (rng() * 1e6) | 0;
      const base = nearGround(bx) + 4;
      if (r < 0.34) {
        const w = 150 + rng() * 120, h = 110 + rng() * 70, scene = ['houses', 'pines', 'waves', 'moon'][Math.floor(rng() * 4)];
        if (NEAR_RISES.some((q) => q > bx - 50 && q < bx + w + 50)) { x += 120; continue; }
        objs.push({ x: bx - 40, y: base - h - 60, w: w + 80, h: h + 70, draw(g) { flat(g, U.mulberry32(seed), bx, base, w, h, scene); } });
        x += w + 110 + rng() * 140;
      } else if (r < 0.62) {
        if (NEAR_RISES.some((q) => q > bx - 30 && q < bx + 30)) { x += 60; continue; }
        objs.push({ x: bx - 40, y: base - 200, w: 80, h: 206, draw(g) { musicStand(g, bx, base, 100 + (seed % 40), U.mulberry32(seed)); } });
        x += 120 + rng() * 140;
      } else {
        x += 100 + rng() * 200;
      }
    }
    // a staircase of piano keys climbing out of the frame
    objs.push({ x: 2480, y: -790, w: 820, h: 800, draw(g) {
      const kb = nearGround(2500);
      for (let i = 0; i < 26; i++) {
        const kx = 2500 + i * 30, ky = kb - i * 29, kw = 64;
        poly(g, [[kx, ky], [kx + kw, ky], [kx + kw, ky + 10], [kx, ky + 10]]); g.fillStyle = i % 7 === 3 ? '#e8dccb' : '#f2e8d8'; g.fill(); ink(g, 1.2);
        rect(g, kx, ky, kw, 2, '#ffffff'); rect(g, kx, ky + 8, kw, 2, '#b8a898');
        if ([0, 1, 3, 4, 5].includes(i % 7)) { poly(g, [[kx + 24, ky - 9], [kx + 54, ky - 9], [kx + 54, ky], [kx + 24, ky]]); g.fillStyle = '#16111c'; g.fill(); rect(g, kx + 24, ky - 9, 30, 1.4, '#6a5a78'); }
        g.strokeStyle = 'rgba(20,14,24,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(kx + 6, ky + 10); g.lineTo(kx + 6, ky + 40); g.stroke();
      }
      glow(g, 2860, kb - 560, 120, '#ffe8c0', 0.12);
    } });
    // gilded columns and the great curtain swags that frame the heart
    for (const cx of [3080, 3920]) objs.push({ x: cx - 70, y: -900, w: 140, h: 910, draw(g) {
      const w = 64;
      const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      gr.addColorStop(0, '#3a2a30'); gr.addColorStop(0.3, '#7a5a3a'); gr.addColorStop(0.62, '#c9a050'); gr.addColorStop(0.7, '#ffe2a0'); gr.addColorStop(0.78, '#a07a3a'); gr.addColorStop(1, '#3a2a24');
      rect(g, cx - w / 2, -900, w, 904, gr); g.strokeStyle = INK; g.lineWidth = 2.4; g.strokeRect(cx - w / 2, -900, w, 904);
      g.strokeStyle = 'rgba(40,26,20,0.55)'; g.lineWidth = 1.4; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(cx - w / 2 + k * w / 5, -880); g.lineTo(cx - w / 2 + k * w / 5, -10); g.stroke(); }
      for (const yy of [-24, -880]) { rect(g, cx - w / 2 - 10, yy, w + 20, 20, '#c9a050'); rect(g, cx - w / 2 - 10, yy, w + 20, 4, '#ffe2a0'); g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(cx - w / 2 - 10, yy, w + 20, 20); }
    } });
    objs.push({ x: 3000, y: -720, w: 1000, h: 380, draw(g) {
      for (const s of [0, 2]) {
        const sx = 3080 + s * 280, sw = 280, dip = -380 - (s % 2) * 26;
        const gr = g.createLinearGradient(0, -700, 0, dip); gr.addColorStop(0, '#4a1026'); gr.addColorStop(0.7, '#8e2c4c'); gr.addColorStop(1, '#5c1a33');
        g.beginPath(); g.moveTo(sx, -710); g.lineTo(sx + sw, -710); g.quadraticCurveTo(sx + sw / 2, dip * 2 + 710, sx, -710); g.fillStyle = gr; g.fill(); ink(g, 2);
        g.strokeStyle = '#d9b25e'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx + 6, -700); g.quadraticCurveTo(sx + sw / 2, dip * 2 + 680, sx + sw - 6, -700); g.stroke();
      }
    } });
    return objs;
  }

  /* =========================================================================================
     GAMEPLAY PLANE — the terraces: ivory boards, a gilt nosing, the dark apron with its panels and
     footlight slots; Descent I's torn launch deck; staircases of light, frozen ledges, a rooftop ridge
     ========================================================================================= */
  const FOOT_STEP = 150;                                   // footlight slot spacing along every apron
  function rosette(g, x, y, r) {
    g.strokeStyle = rgba(M.gold, 0.5); g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const a = i * PI / 3; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.5, r * 0.22, a, 0, TAU); g.stroke(); }
    g.beginPath(); g.arc(x, y, r * 0.18, 0, TAU); g.fillStyle = rgba(M.goldL, 0.6); g.fill();
  }
  function stageChunk(g, s, a, b) {
    const top = s.y, k = tintAt((a + b) / 2), h = heartAt((a + b) / 2), rr = U.mulberry32(((a | 0) * 7 + s.tier * 131) >>> 0);
    // the apron and the substage beneath it
    const fg = g.createLinearGradient(0, top, 0, top + 700);
    fg.addColorStop(0, mixH(M.face, '#3e2434', k * 0.6)); fg.addColorStop(0.3, mixH(M.faceD, '#24121c', k * 0.5)); fg.addColorStop(1, M.faceDD);
    g.fillStyle = fg; g.fillRect(a, top, b - a, 720);
    // recessed panels (world-aligned) with gilt filigree
    for (let px = Math.floor(a / 180) * 180; px < b; px += 180) {
      const x0 = px + 16, w = 148, y0 = top + 52, ph = 112;
      rect(g, x0, y0, w, ph, mixH(M.faceD, '#200f19', k * 0.4));
      rect(g, x0, y0, w, 4, 'rgba(5,2,10,0.45)'); rect(g, x0, y0, 3, ph, 'rgba(5,2,10,0.35)');
      rect(g, x0, y0 + ph - 2, w, 2, M.faceL); rect(g, x0 + w - 2, y0, 2, ph, rgba(M.goldL, 0.22));
      g.strokeStyle = rgba(INK, 0.7); g.lineWidth = 1.2; g.strokeRect(x0, y0, w, ph);
      g.strokeStyle = rgba(M.gold, 0.32 + h * 0.2); g.lineWidth = 1; g.strokeRect(x0 + 9, y0 + 9, w - 18, ph - 18);
      rosette(g, x0 + w / 2, y0 + ph / 2, 11);
      for (const cx of [x0 + 9, x0 + w - 9]) for (const cy of [y0 + 9, y0 + ph - 9]) { g.beginPath(); g.arc(cx, cy, 2, 0, TAU); g.fillStyle = rgba(M.goldL, 0.5); g.fill(); }
    }
    // footlight trough under the nosing: brass hoods with a lamp slit (their glow is live)
    rect(g, a, top + 28, b - a, 16, mixH(M.faceD, '#120a12', 0.3));
    for (let fx = Math.floor(a / FOOT_STEP) * FOOT_STEP + 75; fx < b + 20; fx += FOOT_STEP) {
      poly(g, [[fx - 22, top + 30], [fx + 22, top + 30], [fx + 17, top + 42], [fx - 17, top + 42]]); g.fillStyle = M.brassD; g.fill(); ink(g, 1);
      rect(g, fx - 20, top + 30, 40, 2, M.brassL);
      rect(g, fx - 14, top + 33, 28, 3, '#fff4d6');
    }
    rect(g, a, top + 44, b - a, 2, rgba(INK, 0.8));
    // ivory boards (seen a little from above): three plank rows, staggered butt joints, grain, nails
    const SB = 20;
    const bg = g.createLinearGradient(0, top, 0, top + SB);
    bg.addColorStop(0, M.ivoryL); bg.addColorStop(0.12, mixH(M.ivory, '#f6e2c4', k * 0.5)); bg.addColorStop(1, mixH(M.ivoryS, '#d4b89a', k * 0.4));
    g.fillStyle = bg; g.fillRect(a, top, b - a, SB);
    rect(g, a, top - 1.2, b - a, 1.6, INK);
    rect(g, a, top + 0.4, b - a, 1.4, '#ffffff');
    for (const [ry, rh] of [[2, 6], [8, 6], [14, 6]]) {
      rect(g, a, top + ry + rh - 0.6, b - a, 0.8, rgba(M.seam, 0.8));
      const off = (ry * 37) % 120;
      for (let jx = Math.floor((a - off) / 140) * 140 + off; jx < b; jx += 140) {
        rect(g, jx, top + ry, 0.9, rh, rgba(M.ivoryD, 0.9));
        g.fillStyle = rgba('#5a4a44', 0.7); g.fillRect(jx - 3, top + ry + rh / 2 - 0.5, 1.2, 1.2); g.fillRect(jx + 2.4, top + ry + rh / 2 - 0.5, 1.2, 1.2);
      }
    }
    g.strokeStyle = 'rgba(120,96,84,0.22)'; g.lineWidth = 0.6; g.beginPath();
    for (let gx = a + rr() * 20; gx < b; gx += 14 + rr() * 30) { const gy = top + 3 + Math.floor(rr() * 3) * 6 + rr() * 3; g.moveTo(gx, gy); g.lineTo(gx + 8 + rr() * 22, gy + (rr() - 0.5) * 0.8); }
    g.stroke();
    // scuffs, chalk marks and spike tape left by a show that never ended
    for (let sx = a + rr() * 200; sx < b; sx += 140 + rr() * 260) {
      const r = rr();
      if (r < 0.45) { g.fillStyle = 'rgba(120,96,90,0.16)'; g.beginPath(); g.ellipse(sx, top + 10, 26 + rr() * 30, 3.5, 0, 0, TAU); g.fill(); }
      else if (r < 0.75) { const tc = ['rgba(232,180,64,0.85)', 'rgba(255,120,140,0.8)', 'rgba(110,220,240,0.8)'][Math.floor(rr() * 3)]; g.fillStyle = tc; g.fillRect(sx - 6, top + 9, 12, 2); g.fillRect(sx - 1, top + 6, 2, 8); }
      else { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(sx, top + 11, 12, 2.4, 0, 0, TAU); g.stroke(); }
    }
    // the heart: a great gilt staff inlaid in the boards, five lines running into the music box
    if (s.tier === 4 && b > ARENA.boss[0] - 200) {
      g.strokeStyle = rgba(M.gold, 0.75); g.lineWidth = 0.9;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(Math.max(a, ARENA.boss[0] - 200), top + 4 + i * 3.2); g.lineTo(b, top + 4 + i * 3.2); g.stroke(); }
      g.strokeStyle = rgba(M.goldL, 0.9); g.lineWidth = 1.4; g.beginPath(); g.ellipse(BOX.x, top + 10, 620, 8.5, 0, 0, TAU); g.stroke();
    }
    // the nosing: a gilt strip along the stage edge
    rect(g, a, top + SB, b - a, 8, mixH(M.gold, '#e8b860', h * 0.4)); rect(g, a, top + SB, b - a, 1.6, M.goldL); rect(g, a, top + SB + 6, b - a, 2, M.goldD);
    rect(g, a, top + SB + 8, b - a, 1.4, INK);
  }
  // the step up onto a tier: a gilded corner pilaster from this tier's boards down to the lower one
  function riserEdge(g, s) {
    const x = s.x, top = s.y, lower = FLOOR[s.tier - 1];
    const sg = g.createLinearGradient(x, 0, x + 70, 0); sg.addColorStop(0, 'rgba(5,2,10,0.55)'); sg.addColorStop(1, 'rgba(5,2,10,0)');
    g.fillStyle = sg; g.fillRect(x, top + 28, 70, lower - top);
    rect(g, x - 2, top - 2, 4, lower - top + 4, INK);
    poly(g, [[x - 1, top + 28], [x + 15, top + 28], [x + 15, lower], [x - 1, lower]]); g.fillStyle = M.goldD; g.fill(); ink(g, 1.2);
    rect(g, x + 10, top + 30, 4, lower - top - 30, M.gold); rect(g, x + 12, top + 30, 1.4, lower - top - 30, M.goldL);
    for (let yy = top + 60; yy < lower - 10; yy += 34) { g.beginPath(); g.arc(x + 7, yy, 3, 0, TAU); g.fillStyle = M.gold; g.fill(); ink(g, 0.7); }
  }
  function paintStage(s) {
    const out = [], x0 = s.x, x1 = s.x + s.w;
    for (let a = Math.floor(x0 / 512) * 512; a < x1; a += 512) {
      const ca = Math.max(a, x0), cb = Math.min(a + 512, x1);
      out.push({ x: ca, y: s.y - 6, w: cb - ca, h: 740, draw(g) { g.beginPath(); g.rect(ca, s.y - 4, cb - ca, 740); g.clip(); stageChunk(g, s, ca, cb); } });
    }
    if (s.tier > 0) out.push({ x: s.x - 6, y: s.y - 6, w: 84, h: FLOOR[s.tier - 1] - s.y + 12, draw(g) { riserEdge(g, s); } });
    return out;
  }
  function paintDeck(s) {
    const x0 = s.x, x1 = s.x + s.w, top = s.y, bot = s.y + s.h;
    return [{ x: x0 - 40, y: top - 12, w: s.w + 80, h: s.h + 260, draw(g) {
      const rr = U.mulberry32(8441);
      // hull underside: torn plating, ribs, hanging cables and the squad banner
      poly(g, [[x0, top], [x1, top], [x1, bot - 20], [x1 - 40, bot], [x1 - 120, bot + 26], [x1 - 260, bot + 8], [x0 + 420, bot + 34], [x0 + 200, bot + 6], [x0 + 60, bot + 22], [x0, bot - 10]]);
      const hg = g.createLinearGradient(0, top, 0, bot + 30); hg.addColorStop(0, M.steel); hg.addColorStop(0.25, M.steelD); hg.addColorStop(1, '#14141f');
      g.fillStyle = hg; g.fill(); ink(g, 2.2);
      g.save(); g.clip();
      for (let rx = x0 + 30; rx < x1; rx += 70) { rect(g, rx, top + 22, 6, s.h, '#1c1e2c'); rect(g, rx + 6, top + 22, 1.4, s.h, rgba(M.steelL, 0.4)); }
      for (let yy = top + 46; yy < bot + 30; yy += 26) rect(g, x0, yy, s.w, 1.2, rgba(INK, 0.6));
      for (let px = x0 + 90; px < x1 - 60; px += 210) { g.beginPath(); g.arc(px, top + 62, 8, 0, TAU); g.fillStyle = '#0c0d16'; g.fill(); g.strokeStyle = M.steelL; g.lineWidth = 2; g.stroke(); glow(g, px, top + 62, 14, '#ffd48a', 0.4); }
      g.restore();
      stencil(g, 'JUDGEMENT', x0 + 330, top + 70, 15, rgba('#e8e2d0', 0.75), { font: 'Rajdhani, sans-serif', weight: 700, ink: false });
      stencil(g, '審判之座', x0 + 520, top + 70, 13, rgba('#e8e2d0', 0.65), { ink: false });
      // the deck surface: steel plates, rivets, hazard ends, the launch rails
      rect(g, x0, top, s.w, 20, M.steelL); rect(g, x0, top, s.w, 2, '#e6ecff'); rect(g, x0, top + 18, s.w, 3, '#2a2d40');
      for (let px = x0; px < x1; px += 96) { rect(g, px, top + 2, 1.2, 16, rgba(INK, 0.55)); for (const ry of [5, 14]) { g.fillStyle = '#c8d0e8'; g.fillRect(px + 5, top + ry, 1.6, 1.6); g.fillRect(px + 88, top + ry, 1.6, 1.6); } }
      for (const [hx, hw] of [[x0, 70], [x1 - 70, 70]]) {
        g.save(); g.beginPath(); g.rect(hx, top + 2, hw, 16); g.clip();
        for (let k = -20; k < hw + 20; k += 14) { poly(g, [[hx + k, top + 18], [hx + k + 7, top + 18], [hx + k + 15, top + 2], [hx + k + 8, top + 2]]); g.fillStyle = M.hazard; g.fill(); }
        g.restore();
      }
      rect(g, x0 + 120, top + 8, s.w - 240, 2, '#2a2d40'); rect(g, x0 + 120, top + 13, s.w - 240, 2, '#2a2d40');
      rect(g, x0, top - 1.2, s.w, 1.6, INK);
      // hanging cables and a torn banner (the squad's colours, sun-bleached for twenty years)
      for (let i = 0; i < 7; i++) { const cx = x0 + 60 + rr() * (s.w - 120); rope(g, cx, bot + 10, cx + 30 + rr() * 60, bot + 10, 60 + rr() * 90, 'rgba(12,10,18,0.85)', 1.6); }
      const fx = x0 + 760;
      poly(g, [[fx, bot + 14], [fx + 70, bot + 14], [fx + 66, bot + 120], [fx + 50, bot + 104], [fx + 36, bot + 136], [fx + 20, bot + 110], [fx + 4, bot + 128]]);
      g.fillStyle = '#8a2a3a'; g.fill(); ink(g, 1.4);
      rect(g, fx + 30, bot + 30, 10, 54, '#e8d8b8'); rect(g, fx + 22, bot + 30, 26, 6, '#e8d8b8'); rect(g, fx + 22, bot + 78, 26, 6, '#e8d8b8');
    } }];
  }
  function paintLight(p) {
    return [{ x: p.x - 30, y: p.y - 30, w: p.w + 60, h: 180, draw(g) {
      glow(g, p.x + p.w / 2, p.y + 4, p.w * 0.85, '#ffe8c0', 0.32);
      const lg = g.createLinearGradient(0, p.y + 10, 0, p.y + 140); lg.addColorStop(0, 'rgba(255,236,200,0.22)'); lg.addColorStop(1, 'rgba(255,236,200,0)');
      g.fillStyle = lg; poly(g, [[p.x + 8, p.y + 10], [p.x + p.w - 8, p.y + 10], [p.x + p.w - 24, p.y + 140], [p.x + 24, p.y + 140]]); g.fill();
      poly(g, [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w - 6, p.y + 12], [p.x + 6, p.y + 12]]); g.fillStyle = 'rgba(255,246,226,0.86)'; g.fill();
      g.strokeStyle = rgba('#a87a3a', 0.9); g.lineWidth = 1.2; g.stroke();
      rect(g, p.x, p.y, p.w, 2, '#ffffff'); rect(g, p.x + 8, p.y + 8, p.w - 16, 1, 'rgba(201,154,72,0.6)');
      g.fillStyle = 'rgba(255,248,230,0.85)'; for (let i = 0; i < 5; i++) { const mx = p.x + 12 + ((i * 37) % (p.w - 20)), my = p.y + 22 + ((i * 53) % 70); g.fillRect(mx, my, 2, 2); }
    } }];
  }
  function paintLedge(p) {
    return [{ x: p.x - 10, y: p.y - 14, w: p.w + 20, h: 60, draw(g) {
      const rr = U.mulberry32((p.x * 3 + p.y) | 0);
      poly(g, [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w - 8, p.y + 14], [p.x + p.w * 0.6, p.y + 26], [p.x + p.w * 0.25, p.y + 20], [p.x + 6, p.y + 12]]);
      g.fillStyle = '#5a6a8a'; g.fill(); ink(g, 1.6);
      poly(g, [[p.x + p.w * 0.5, p.y], [p.x + p.w, p.y], [p.x + p.w - 8, p.y + 14], [p.x + p.w * 0.6, p.y + 22]]); g.fillStyle = '#7d8eb0'; g.fill();
      blob(g, [[p.x - 3, p.y + 2], [p.x + p.w * 0.3, p.y - 7], [p.x + p.w * 0.7, p.y - 5], [p.x + p.w + 3, p.y + 2], [p.x + p.w * 0.5, p.y + 4]]); g.fillStyle = M.snow; g.fill(); ink(g, 1.1);
      for (let i = 0; i < 5; i++) { const ix = p.x + 10 + rr() * (p.w - 20), il = 6 + rr() * 14; poly(g, [[ix - 2.5, p.y + 12], [ix + 2.5, p.y + 12], [ix, p.y + 12 + il]]); g.fillStyle = rgba('#dff6ff', 0.9); g.fill(); g.strokeStyle = rgba(INK, 0.6); g.lineWidth = 0.6; g.stroke(); }
    } }];
  }
  const noPaint = () => [];

  /* =========================================================================================
     PROPS (gameplay plane, cached): the wings, ghost lights, painted flats, scattered pages, the three
     memories (Barrow's bell, the floating Belfry, the rooftop at sunset), Descent I's gear, the last door,
     and the music box — case, lid painting and plinth (its comb, cylinder and key are live)
     ========================================================================================= */
  function velvet(g, x0, x1, top, base, rr, tie) {
    const n = Math.max(3, Math.round((x1 - x0) / 46));
    for (let i = 0; i < n; i++) {
      const fx = x0 + (i / n) * (x1 - x0), fw = (x1 - x0) / n + 2, pull = tie ? Math.sin(i / n * PI) * 22 : 0;
      const gr = g.createLinearGradient(fx, 0, fx + fw, 0);
      gr.addColorStop(0, M.velvetD); gr.addColorStop(0.42, M.velvet); gr.addColorStop(0.55, M.velvetL); gr.addColorStop(0.7, M.velvet); gr.addColorStop(1, M.velvetD);
      g.beginPath(); g.moveTo(fx, top); g.lineTo(fx + fw, top);
      if (tie) { g.quadraticCurveTo(fx + fw + pull, (top + base) * 0.55, fx + fw * 0.7 + pull * 0.4, base); g.lineTo(fx + pull * 0.4, base); g.quadraticCurveTo(fx + pull, (top + base) * 0.55, fx, top); }
      else { g.lineTo(fx + fw + (rr() - 0.5) * 6, base); g.lineTo(fx + (rr() - 0.5) * 6, base); }
      g.closePath(); g.fillStyle = gr; g.fill(); g.strokeStyle = rgba(INK, 0.55); g.lineWidth = 1; g.stroke();
    }
    rect(g, x0, base - 10, x1 - x0, 10, M.gold); rect(g, x0, base - 10, x1 - x0, 2, M.goldL);
    g.fillStyle = M.goldD; for (let fx = x0 + 3; fx < x1; fx += 6) g.fillRect(fx, base, 2, 8);
  }
  function ghostLight(g, x, base) {
    g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 26, base); g.lineTo(x, base - 34); g.lineTo(x + 26, base); g.moveTo(x, base - 34); g.lineTo(x, base + 1); g.stroke();
    g.strokeStyle = '#2a2232'; g.lineWidth = 2.4; g.stroke();
    g.strokeStyle = INK; g.lineWidth = 4.6; g.beginPath(); g.moveTo(x, base - 34); g.lineTo(x, base - 168); g.stroke();
    g.strokeStyle = '#4a3e52'; g.lineWidth = 2.4; g.stroke();
    rect(g, x - 3, base - 176, 6, 10, '#2a2232');
    // the cage around the bare bulb
    g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.ellipse(x, base - 190, 11, 15, 0, 0, TAU); g.stroke();
    g.beginPath(); for (const ox of [-6, 0, 6]) { g.moveTo(x + ox, base - 205); g.lineTo(x + ox * 1.1, base - 175); } g.stroke();
    g.beginPath(); g.arc(x, base - 190, 6.5, 0, TAU); g.fillStyle = '#fff6dc'; g.fill(); g.strokeStyle = rgba(INK, 0.7); g.lineWidth = 0.8; g.stroke();
  }
  function crayonDrawing(g, x, y) {
    // Mira's crayon drawing (as found in the Ladder's crane cab): the black-haired teacher, the girl in the red scarf
    rect(g, x - 34, y - 44, 68, 50, '#f3ead6'); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(x - 34, y - 44, 68, 50);
    rect(g, x - 34, y - 44, 68, 3, 'rgba(255,255,255,0.8)');
    g.lineCap = 'round'; g.lineJoin = 'round';
    const cr = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.stroke(); };
    cr([[x - 26, y - 24], [x - 20, y - 36], [x - 4, y - 38], [x + 22, y - 30]], '#ffb347', 1.6);
    g.beginPath(); g.arc(x + 22, y - 33, 5, 0, TAU); g.fillStyle = '#ffcf5a'; g.fill();
    cr([[x - 12, y - 28], [x - 12, y - 6]], '#2a2230', 2.2); g.beginPath(); g.arc(x - 12, y - 31, 4, 0, TAU); g.fillStyle = '#2a2230'; g.fill();
    cr([[x - 16, y - 30], [x - 18, y - 14]], '#2a2230', 1.4);
    cr([[x - 12, y - 18], [x - 1, y - 16]], '#2a2230', 1.2);
    cr([[x + 2, y - 18], [x + 2, y - 5]], '#7a6a5a', 1.8); g.beginPath(); g.arc(x + 2, y - 21, 3.2, 0, TAU); g.fillStyle = '#f0c8a0'; g.fill();
    cr([[x - 1, y - 17], [x + 5, y - 17], [x + 7, y - 12]], M.scarf, 1.8);
    cr([[x - 30, y + 2], [x + 30, y + 2]], '#6ab06a', 1.4);
    g.fillStyle = '#3a3040'; g.font = '700 6px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.fillText('無名', x + 18, y - 4);
  }
  function easel(g, x, base) {
    g.strokeStyle = INK; g.lineWidth = 3.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 24, base); g.lineTo(x - 4, base - 110); g.moveTo(x + 24, base); g.lineTo(x + 4, base - 110); g.moveTo(x, base - 104); g.lineTo(x + 6, base + 1); g.stroke();
    g.strokeStyle = M.woodL; g.lineWidth = 1.6; g.stroke();
    rect(g, x - 40, base - 46, 80, 4, M.wood); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(x - 40, base - 46, 80, 4);
    crayonDrawing(g, x, base - 50);
  }
  // Barrow's bell (memory of Ashport): a patch of the old avenue set into the stage, the bell frame and its lamp
  function barrowMemory(g) {
    const top = FLOOR[1], x0 = 2230, x1 = 2700, rr = U.mulberry32(8611);
    // the warm column of light the memory stands in
    const lg = g.createLinearGradient(0, top - 420, 0, top); lg.addColorStop(0, 'rgba(255,170,110,0)'); lg.addColorStop(1, 'rgba(255,170,110,0.2)');
    g.fillStyle = lg; poly(g, [[x0 + 120, top - 420], [x1 - 160, top - 420], [x1 - 10, top], [x0 + 10, top]]); g.fill();
    // asphalt of the Avenue of Sunken Bells, its edges fraying into ivory boards
    g.beginPath(); g.moveTo(x0, top + 0.5);
    for (let x = x0; x <= x1; x += 18) g.lineTo(x, top + 0.5 + (x === x0 || x >= x1 - 10 ? 0 : (rr() < 0.25 ? rr() * 3 : 0)));
    g.lineTo(x1, top + 19); for (let x = x1; x >= x0; x -= 22) g.lineTo(x, top + 19 - (x > x0 + 30 && x < x1 - 30 ? 0 : rr() * 10)); g.closePath();
    const ag = g.createLinearGradient(0, top, 0, top + 20); ag.addColorStop(0, '#9c8070'); ag.addColorStop(0.5, '#6a5250'); ag.addColorStop(1, '#4a3a40');
    g.fillStyle = ag; g.fill();
    g.fillStyle = 'rgba(232,214,168,0.6)'; for (let x = x0 + 40; x < x1 - 50; x += 74) g.fillRect(x, top + 8.5, 34, 1.8);
    for (const [px, pw] of [[2330, 46], [2600, 30]]) { const pg = g.createLinearGradient(0, top + 6, 0, top + 14); pg.addColorStop(0, '#ffd48a'); pg.addColorStop(1, '#c86a5a'); g.fillStyle = pg; g.beginPath(); g.ellipse(px, top + 10, pw, 3, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(30,20,22,0.4)'; g.lineWidth = 0.8; g.stroke(); }
    for (let x = x0 + 10; x < x1; x += 20 + rr() * 30) if (rr() < 0.5) { g.fillStyle = rgba('#f0c890', 0.55); g.beginPath(); g.ellipse(x, top + 1, 14 + rr() * 22, 3 + rr() * 2, 0, PI, 0); g.fill(); }
    // the bent street lamp
    const lx = 2290;
    g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(lx, top); g.lineTo(lx, top - 150); g.quadraticCurveTo(lx + 6, top - 205, lx + 40, top - 196); g.stroke();
    g.strokeStyle = '#3a3038'; g.lineWidth = 3.4; g.stroke();
    poly(g, [[lx + 28, top - 200], [lx + 52, top - 200], [lx + 47, top - 188], [lx + 33, top - 188]]); g.fillStyle = '#2a2230'; g.fill(); ink(g, 1.2);
    rect(g, lx - 7, top - 18, 14, 18, '#2a262c'); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(lx - 7, top - 18, 14, 18);
    // the crate Barrow sits on between tolls
    block(g, 2340, top - 28, 40, 28, { body: '#5a4632', lit: '#a8875e', dark: '#33261c' });
    g.strokeStyle = rgba(INK, 0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(2340, top - 28); g.lineTo(2380, top); g.stroke();
    // the bell frame (the bell itself and its rope are live)
    const fx0 = BELL.x - 74, fx1 = BELL.x + 74, beam = top - 250;
    for (const px of [fx0, fx1]) { block(g, px - 9, beam, 18, 250, { body: '#4a3626', lit: '#8a6a48', dark: '#2a1c14' }); }
    block(g, fx0 - 20, beam - 16, fx1 - fx0 + 40, 18, { body: '#4a3626', lit: '#9a7a52', dark: '#2a1c14' });
    poly(g, [[fx0 - 9, beam + 40], [fx0 + 30, beam + 2], [fx0 + 36, beam + 8], [fx0 - 3, beam + 46]]); g.fillStyle = '#3a2a1e'; g.fill(); ink(g, 1);
    poly(g, [[fx1 + 9, beam + 40], [fx1 - 30, beam + 2], [fx1 - 36, beam + 8], [fx1 + 3, beam + 46]]); g.fill(); ink(g, 1);
    g.beginPath(); g.arc(BELL.x - 40, beam + 6, 14, 0, TAU); g.fillStyle = '#5a4430'; g.fill(); ink(g, 1.4);
    g.strokeStyle = '#8a6a48'; g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const a = i * PI / 3; g.beginPath(); g.moveTo(BELL.x - 40, beam + 6); g.lineTo(BELL.x - 40 + Math.cos(a) * 12, beam + 6 + Math.sin(a) * 12); g.stroke(); }
  }
  // the Belfry, floating: a cliff of snow and rock with its little belfry, lanterns and prayer flags
  function belfryMemory(g) {
    const x0 = BELFRY.x0, x1 = BELFRY.x1, top = BELFRY.y, rr = U.mulberry32(8622);
    // cold dawn light around it
    glow(g, (x0 + x1) / 2, top - 60, 260, '#9fd8ff', 0.16);
    // the rock body, hanging below the walkable top: faceted, cold, snow caught on its ledges
    const pts = [[x0 - 10, top + 2], [x1 + 8, top + 2], [x1 + 2, top + 40], [x1 - 30, top + 90], [x1 - 70, top + 150], [x0 + 150, top + 210], [x0 + 90, top + 140], [x0 + 30, top + 96], [x0 - 4, top + 40]];
    poly(g, pts); g.fillStyle = '#36405c'; g.fill();
    g.save(); poly(g, pts); g.clip();
    for (let i = 0; i < 26; i++) {
      const fx = x0 - 10 + rr() * (x1 - x0 + 20), fy = top + 6 + rr() * 200, fw = 26 + rr() * 54, fh = 18 + rr() * 40, k = rr();
      poly(g, [[fx, fy], [fx + fw * 0.55, fy - fh * 0.35], [fx + fw, fy + fh * 0.35], [fx + fw * 0.35, fy + fh]]);
      g.fillStyle = fx > x0 + 140 ? (k < 0.55 ? '#5a6c94' : '#46567c') : (k < 0.3 ? '#4a5a80' : '#2c3450'); g.fill();
      g.strokeStyle = rgba(INK, 0.4); g.lineWidth = 1; g.stroke();
      if (k > 0.72) { poly(g, [[fx + fw * 0.05, fy + 1], [fx + fw * 0.55, fy - fh * 0.3], [fx + fw * 0.7, fy - fh * 0.15], [fx + fw * 0.2, fy + 4]]); g.fillStyle = 'rgba(236,244,255,0.85)'; g.fill(); }
    }
    const rim = g.createLinearGradient(x1 - 70, 0, x1 + 8, 0); rim.addColorStop(0, 'rgba(190,220,255,0)'); rim.addColorStop(1, 'rgba(190,220,255,0.45)');
    g.fillStyle = rim; g.fillRect(x1 - 70, top, 80, 220);
    const dk = g.createLinearGradient(0, top + 60, 0, top + 215); dk.addColorStop(0, 'rgba(10,8,24,0)'); dk.addColorStop(1, 'rgba(10,8,24,0.55)');
    g.fillStyle = dk; g.fillRect(x0 - 12, top + 60, x1 - x0 + 24, 160);
    g.restore();
    poly(g, pts); ink(g, 2.4);
    for (let i = 0; i < 9; i++) { const ix = x0 + 20 + rr() * (x1 - x0 - 40), iy = top + 20 + rr() * 60, il = 10 + rr() * 26; poly(g, [[ix - 3, iy], [ix + 3, iy], [ix, iy + il]]); g.fillStyle = rgba('#dff6ff', 0.85); g.fill(); g.strokeStyle = rgba(INK, 0.5); g.lineWidth = 0.7; g.stroke(); }
    // snow-covered top band
    blob(g, [[x0 - 14, top + 6], [x0 + 40, top - 8], [x0 + 140, top - 5], [x0 + 220, top - 9], [x1 + 12, top + 4], [x1 - 40, top + 12], [x0 + 60, top + 12]]);
    g.fillStyle = M.snow; g.fill(); ink(g, 1.4);
    rect(g, x0 + 10, top - 1, x1 - x0 - 20, 1.4, 'rgba(160,200,255,0.6)');
    // the little belfry (its bell is live)
    const bx = 3250, bt = top - 190;
    for (const px of [bx - 52, bx + 52]) block(g, px - 7, bt + 40, 14, 152, { body: '#4a3a3a', lit: '#8a7064', dark: '#2a1e1e' });
    poly(g, [[bx - 82, bt + 46], [bx, bt - 6], [bx + 82, bt + 46]]); g.fillStyle = '#3a2e36'; g.fill(); ink(g, 2);
    blob(g, [[bx - 88, bt + 48], [bx - 40, bt + 16], [bx, bt - 10], [bx + 44, bt + 18], [bx + 88, bt + 48], [bx, bt + 30]]); g.fillStyle = M.snow; g.fill(); ink(g, 1.3);
    rect(g, bx - 60, bt + 40, 120, 10, '#4a3a3a'); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(bx - 60, bt + 40, 120, 10);
    // prayer flags from the belfry to a pole, and two lanterns
    g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(x0 + 24, top); g.lineTo(x0 + 24, top - 120); g.stroke();
    rope(g, x0 + 24, top - 116, bx - 60, bt + 44, 26, rgba(INK, 0.8), 1);
    for (let i = 0; i < 11; i++) {
      const k = (i + 0.5) / 11, fx = lerp(x0 + 24, bx - 60, k), fy = lerp(top - 116, bt + 44, k) + Math.sin(k * PI) * 26 * 0.9;
      poly(g, [[fx - 4, fy], [fx + 4, fy], [fx + 1, fy + 11]]); g.fillStyle = ['#e85a4a', '#f2c94a', '#5ab0e8', '#f4f4f4', '#6ad08a'][i % 5]; g.fill(); g.strokeStyle = rgba(INK, 0.6); g.lineWidth = 0.6; g.stroke();
    }
    for (const lx of [x0 + 24, x1 - 20]) { rect(g, lx - 5, top - 34, 10, 14, '#2a2030'); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(lx - 5, top - 34, 10, 14); rect(g, lx - 3, top - 32, 6, 10, '#ffcf88'); glow(g, lx, top - 27, 22, '#ffbe6b', 0.55); }
    g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x1 - 20, top); g.lineTo(x1 - 20, top - 20); g.stroke();
  }
  // the rooftop at sunset: a chunk of Ashport's bell-tower roof, set on the stage like scenery, a sun caught behind it
  function roofMemory(g) {
    const x0 = ROOF.x0, x1 = ROOF.x1, ridge = ROOF.y, base = FLOOR[3], cx = (x0 + x1) / 2 + 30, rr = U.mulberry32(8633);
    // the sunset, held in a bubble of memory
    const sx = cx + 40, sy = ridge - 150, R = 230;
    const sg = g.createRadialGradient(sx, sy, 10, sx, sy, R);
    sg.addColorStop(0, 'rgba(255,236,190,0.95)'); sg.addColorStop(0.18, 'rgba(255,190,120,0.85)'); sg.addColorStop(0.5, 'rgba(255,130,100,0.55)'); sg.addColorStop(0.8, 'rgba(160,70,110,0.28)'); sg.addColorStop(1, 'rgba(120,50,100,0)');
    g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, R, 0, TAU); g.fill();
    const sd = g.createRadialGradient(sx, sy + 10, 4, sx, sy + 10, 62); sd.addColorStop(0, '#fff6dc'); sd.addColorStop(0.55, '#ffc888'); sd.addColorStop(1, '#ff9a6a');
    g.beginPath(); g.arc(sx, sy + 10, 62, 0, TAU); g.fillStyle = sd; g.fill();
    g.save(); g.beginPath(); g.arc(sx, sy, R - 4, 0, TAU); g.clip();
    for (let i = 0; i < 5; i++) { const cy2 = sy - 40 + i * 28, cw = 90 + rr() * 120, cxx = sx - 150 + rr() * 200; blob(g, [[cxx, cy2], [cxx + cw * 0.3, cy2 - 7], [cxx + cw, cy2 - 3], [cxx + cw * 0.8, cy2 + 5], [cxx + cw * 0.2, cy2 + 4]]); g.fillStyle = i % 2 ? 'rgba(170,80,110,0.55)' : 'rgba(255,170,130,0.5)'; g.fill(); }
    g.fillStyle = 'rgba(60,30,50,0.85)';
    for (let i = 0; i < 4; i++) { const bx = sx - 120 + i * 40 + rr() * 20, by = sy - 70 + rr() * 50; g.beginPath(); g.moveTo(bx - 6, by); g.quadraticCurveTo(bx - 2, by - 3, bx, by); g.quadraticCurveTo(bx + 2, by - 3, bx + 6, by); g.lineTo(bx, by + 1.5); g.fill(); }
    g.restore();
    g.beginPath(); g.arc(sx, sy, R - 2, PI * 1.05, PI * 1.75); g.strokeStyle = 'rgba(255,236,210,0.16)'; g.lineWidth = 2; g.stroke();
    // chimney and antenna
    block(g, x0 + 30, ridge - 64, 34, 70, { body: '#7a3a30', lit: '#c8705a', dark: '#4a2020' });
    rect(g, x0 + 26, ridge - 70, 42, 8, '#4a2a26'); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(x0 + 26, ridge - 70, 42, 8);
    g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x1 - 40, ridge); g.lineTo(x1 - 40, ridge - 92); g.moveTo(x1 - 62, ridge - 76); g.lineTo(x1 - 18, ridge - 80); g.moveTo(x1 - 56, ridge - 60); g.lineTo(x1 - 24, ridge - 62); g.stroke();
    // the roof: terracotta tiles from the ridge down to the boards, eaves overhanging
    const rp = [[x0 - 26, base - 6], [x0 - 10, ridge + 2], [x1 + 10, ridge + 2], [x1 + 26, base - 6]];
    poly(g, rp); g.fillStyle = '#9a4a38'; g.fill();
    g.save(); poly(g, rp); g.clip();
    for (let row = 0; row < 7; row++) {
      const yy = ridge + 6 + row * 15;
      rect(g, x0 - 30, yy + 10, x1 - x0 + 60, 4, 'rgba(60,20,20,0.5)');
      for (let tx = x0 - 30 + (row % 2) * 9; tx < x1 + 30; tx += 18) { g.beginPath(); g.ellipse(tx + 9, yy + 8, 8.5, 7, 0, PI, TAU); g.fillStyle = row % 3 === 1 ? '#b85a40' : '#a8503c'; g.fill(); g.strokeStyle = 'rgba(40,12,12,0.6)'; g.lineWidth = 0.9; g.stroke(); rect(g, tx + 12, yy + 2, 3, 5, 'rgba(255,190,140,0.55)'); }
    }
    const shade = g.createLinearGradient(x0, 0, x1, 0); shade.addColorStop(0, 'rgba(40,10,30,0.4)'); shade.addColorStop(0.6, 'rgba(40,10,30,0)'); shade.addColorStop(1, 'rgba(255,170,110,0.15)');
    g.fillStyle = shade; g.fillRect(x0 - 30, ridge, x1 - x0 + 60, base - ridge);
    g.restore();
    poly(g, rp); ink(g, 2.4);
    // the ridge cap she sits on
    rect(g, x0 - 10, ridge - 6, x1 - x0 + 20, 9, '#7a3a30'); rect(g, x0 - 10, ridge - 6, x1 - x0 + 20, 2, '#e89a7a');
    g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(x0 - 10, ridge - 6, x1 - x0 + 20, 9);
  }
  // Descent I's launch deck furniture: the old drop pod, crates, a floodlight, the squad flag
  function deckProps(g) {
    const top = DECK.y;
    // the drop pod, docked and cold for twenty years (left end, outside the arena walls)
    const px = 4740, pw = 46;
    blob(g, [[px - pw, top], [px - pw * 1.05, top - 70], [px - pw * 0.6, top - 128], [px, top - 146], [px + pw * 0.6, top - 128], [px + pw * 1.05, top - 70], [px + pw, top]]);
    g.fillStyle = lit(g, px, top - 70, pw, '#7a8098'); g.fill(); ink(g, 2.2);
    rect(g, px - 18, top - 112, 36, 26, '#1a1e2c'); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(px - 18, top - 112, 36, 26);
    rect(g, px - 14, top - 108, 12, 8, 'rgba(160,230,255,0.4)');
    stencil(g, 'I-01', px, top - 60, 12, '#e8e2d0', { font: 'Rajdhani, sans-serif', weight: 700 });
    for (const fx of [px - pw - 6, px + pw + 6]) { poly(g, [[fx, top], [fx + (fx < px ? -12 : 12), top - 20], [fx, top - 50]]); g.fillStyle = '#4a5068'; g.fill(); ink(g, 1.4); }
    // crates and the floodlight at the far end
    block(g, 5560, top - 34, 44, 34, { body: '#4a5068', lit: '#9aa3c0', dark: '#2c3046' }); block(g, 5610, top - 24, 30, 24, { body: '#5a4632', lit: '#a8875e', dark: '#33261c' });
    g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(5690, top); g.lineTo(5690, top - 130); g.stroke();
    poly(g, [[5676, top - 140], [5708, top - 132], [5704, top - 112], [5672, top - 120]]); g.fillStyle = '#3a3e52'; g.fill(); ink(g, 1.4);
    // the squad flag on its pole (left of the arena so it frames the fight)
    g.strokeStyle = INK; g.lineWidth = 3.4; g.beginPath(); g.moveTo(4800, top); g.lineTo(4800, top - 230); g.stroke(); g.strokeStyle = '#c9a050'; g.lineWidth = 1.6; g.stroke();
    poly(g, [[4802, top - 226], [4880, top - 220], [4872, top - 190], [4884, top - 160], [4802, top - 168]]); g.fillStyle = '#9a2a3e'; g.fill(); ink(g, 1.6);
    rect(g, 4836, top - 210, 8, 36, '#efe2c4'); rect(g, 4830, top - 210, 20, 5, '#efe2c4'); rect(g, 4830, top - 179, 20, 5, '#efe2c4');
  }
  // the last door: a stage door standing alone on the boards, ajar, warm light behind it
  function lastDoor(g) {
    const x = DOOR.x, base = 0, w = 116, h = 268, rr = U.mulberry32(8655);
    const lg = g.createLinearGradient(x, 0, x + 260, 0); lg.addColorStop(0, 'rgba(255,214,150,0.45)'); lg.addColorStop(1, 'rgba(255,214,150,0)');
    g.fillStyle = lg; poly(g, [[x + w / 2 - 6, base - h + 12], [x + w / 2 + 240, base - h - 40], [x + w / 2 + 260, base + 2], [x + w / 2 - 6, base]]); g.fill();
    // the frame (pale wood, gilt mouldings)
    const fr = [[x - w / 2 - 14, base], [x - w / 2 - 14, base - h - 10], [x - w / 2, base - h - 34], [x + w / 2, base - h - 34], [x + w / 2 + 14, base - h - 10], [x + w / 2 + 14, base]];
    poly(g, fr); g.fillStyle = '#d8ccb8'; g.fill(); ink(g, 2.4);
    rect(g, x - w / 2 - 14, base - h - 10, 6, h + 10, '#a8987e'); rect(g, x + w / 2 + 8, base - h - 10, 6, h + 10, '#fff4e0');
    rect(g, x - w / 2, base - h - 30, w, 6, M.gold); rect(g, x - w / 2, base - h - 30, w, 1.6, M.goldL);
    // the opening: warm light
    const og = g.createLinearGradient(0, base - h, 0, base); og.addColorStop(0, '#fff2d4'); og.addColorStop(1, '#ffc888');
    rect(g, x - w / 2, base - h, w, h, og);
    glow(g, x + 10, base - h * 0.5, 120, '#fff0d0', 0.4);
    // the door leaf, swung toward us (seen nearly edge-on, in perspective)
    poly(g, [[x - w / 2, base - h], [x - w / 2 + 44, base - h - 16], [x - w / 2 + 44, base + 8], [x - w / 2, base]]);
    g.fillStyle = '#5a4436'; g.fill(); ink(g, 2);
    poly(g, [[x - w / 2 + 8, base - h + 10], [x - w / 2 + 38, base - h], [x - w / 2 + 38, base - h * 0.55], [x - w / 2 + 8, base - h * 0.52]]); g.strokeStyle = rgba(M.gold, 0.7); g.lineWidth = 1.4; g.stroke();
    poly(g, [[x - w / 2 + 8, base - h * 0.45], [x - w / 2 + 38, base - h * 0.47], [x - w / 2 + 38, base - 10], [x - w / 2 + 8, base - 6]]); g.stroke();
    g.beginPath(); g.arc(x - w / 2 + 34, base - h * 0.5, 3.4, 0, TAU); g.fillStyle = M.goldL; g.fill(); ink(g, 0.8);
    // the sign above
    rect(g, x - 46, base - h - 62, 92, 22, '#1e1626'); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(x - 46, base - h - 62, 92, 22);
    stencil(g, '第七道門', x, base - h - 55, 10, 'rgba(255,214,150,0.95)', { ink: false });
    stencil(g, 'THE SEVENTH GATE', x, base - h - 45.5, 7, 'rgba(255,214,150,0.7)', { ink: false, font: 'Rajdhani, sans-serif', weight: 700 });
    void rr;
  }
  // the great music box: the case and plinth, the open lid with its painting (comb, cylinder and key are live)
  const BOXG = { x0: BOX.x - BOX.w / 2, x1: BOX.x + BOX.w / 2, top: -BOX.h, bed: -BOX.h - 46, lidTop: -BOX.h - 46 - 58 };
  function lidPainting(g, x0, y0, w, h) {
    // a painted sunset over Ashport: the bell tower, the roofs, a man and a little girl holding hands
    const sky = g.createLinearGradient(0, y0, 0, y0 + h); sky.addColorStop(0, '#5a3a6a'); sky.addColorStop(0.45, '#d8706a'); sky.addColorStop(0.75, '#ffb070'); sky.addColorStop(1, '#ffd89a');
    rect(g, x0, y0, w, h, sky);
    g.beginPath(); g.arc(x0 + w * 0.62, y0 + h * 0.72, h * 0.16, 0, TAU); g.fillStyle = '#fff0c0'; g.fill();
    for (let i = 0; i < 4; i++) { const cy = y0 + h * (0.2 + i * 0.12), cx = x0 + w * (0.1 + (i * 0.27) % 0.8); blob(g, [[cx, cy], [cx + 60, cy - 8], [cx + 140, cy - 2], [cx + 110, cy + 7], [cx + 20, cy + 6]]); g.fillStyle = 'rgba(255,200,170,0.5)'; g.fill(); }
    const base = y0 + h;
    let xx = x0;
    const rr = U.mulberry32(8677);
    g.fillStyle = '#3a2238';
    g.beginPath(); g.moveTo(x0, base);
    while (xx < x0 + w) { const bw = 30 + rr() * 40, bh = h * (0.12 + rr() * 0.16); g.lineTo(xx, base - bh); g.lineTo(xx + bw * 0.5, base - bh - 10); g.lineTo(xx + bw, base - bh); xx += bw; }
    g.lineTo(x0 + w, base); g.closePath(); g.fill();
    const tx = x0 + w * 0.3;
    poly(g, [[tx - 16, base], [tx - 16, base - h * 0.5], [tx, base - h * 0.66], [tx + 16, base - h * 0.5], [tx + 16, base]]); g.fillStyle = '#2a1830'; g.fill();
    poly(g, [[tx - 6, base - h * 0.47], [tx - 6, base - h * 0.39], [tx + 6, base - h * 0.39], [tx + 6, base - h * 0.47]]); g.fillStyle = '#ffcf88'; g.fill();
    // the two figures on the roofline, hand in hand
    const fx = x0 + w * 0.68, fy = base - h * 0.15;
    g.fillStyle = '#1e1224';
    g.beginPath(); g.arc(fx, fy - 30, 5, 0, TAU); g.fill(); g.fillRect(fx - 4, fy - 25, 8, 24);
    g.beginPath(); g.arc(fx + 16, fy - 18, 4, 0, TAU); g.fill(); g.fillRect(fx + 13, fy - 14, 6, 14);
    g.strokeStyle = '#1e1224'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx + 3, fy - 16); g.lineTo(fx + 14, fy - 10); g.stroke();
    g.strokeStyle = M.scarf; g.lineWidth = 2; g.beginPath(); g.moveTo(fx + 13, fy - 13); g.lineTo(fx + 22, fy - 11); g.stroke();
    rect(g, x0, base - 2, w, 2, 'rgba(255,230,190,0.6)');
    // varnish and age
    g.fillStyle = 'rgba(70,40,30,0.2)'; g.fillRect(x0, y0, w, h);
  }
  function musicBoxProp(g) {
    const { x0, x1, top, bed, lidTop } = BOXG, cx = BOX.x;
    // shadow on the boards and the glow the box gives off
    glow(g, cx, top + 60, 560, '#ffd8a0', 0.12);
    g.fillStyle = 'rgba(10,4,16,0.35)'; g.beginPath(); g.ellipse(cx, 2, BOX.w * 0.56, 12, 0, 0, TAU); g.fill();
    // the lid, thrown all the way back: seen nearly edge-on, a mirror strip catching the eclipse
    const lid = [[x0 + 14, bed + 2], [x0 + 34, lidTop], [x1 + 18, lidTop - 6], [x1 - 14, bed + 2]];
    poly(g, lid); g.fillStyle = '#3a1e14'; g.fill(); ink(g, 3);
    poly(g, [[x0 + 30, bed - 6], [x0 + 44, lidTop + 10], [x1 + 4, lidTop + 4], [x1 - 22, bed - 6]]);
    const mg = g.createLinearGradient(0, lidTop, 0, bed); mg.addColorStop(0, '#f6e8d8'); mg.addColorStop(0.35, '#9a8aa8'); mg.addColorStop(1, '#2a2036');
    g.fillStyle = mg; g.fill(); g.strokeStyle = M.gold; g.lineWidth = 3; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0 + 120, lidTop + 14); g.lineTo(x0 + 260, lidTop + 12); g.moveTo(x1 - 260, lidTop + 9); g.lineTo(x1 - 160, lidTop + 8); g.stroke();
    rect(g, x0 + 14, lidTop - 2, BOX.w + 4, 3, rgba(M.goldL, 0.7));
    // the bed of the mechanism (seen from a little above): a dark velvet tray
    poly(g, [[x0, top], [x0 + 18, bed], [x1 - 18, bed], [x1, top]]); g.fillStyle = '#2a1424'; g.fill(); ink(g, 2.4);
    rect(g, x0 + 18, bed, BOX.w - 36, 3, rgba(M.goldL, 0.4));
    // the case: walnut, gilt inlay, brass corners, the plaque — and, in the middle, the painting of home
    const cg = g.createLinearGradient(x0, 0, x1, 0); cg.addColorStop(0, '#2a140e'); cg.addColorStop(0.5, '#4a2a1c'); cg.addColorStop(0.92, '#66402a'); cg.addColorStop(1, '#94603e');
    rect(g, x0, top, BOX.w, BOX.h - 18, cg); g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(x0, top, BOX.w, BOX.h - 18);
    rect(g, x0, top, BOX.w, 10, '#8a5a3a'); rect(g, x0, top, BOX.w, 2.5, '#d8a070');
    const pw0 = 410, px0 = cx - pw0 / 2, py0 = top + 36, ph0 = 150;
    for (const [px, pw] of [[x0 + 24, px0 - x0 - 46], [px0 + pw0 + 22, x1 - (px0 + pw0) - 46]]) {
      const py = top + 34, ph = BOX.h - 90;
      rect(g, px, py, pw, ph, 'rgba(20,8,6,0.35)'); g.strokeStyle = rgba(M.gold, 0.85); g.lineWidth = 2; g.strokeRect(px, py, pw, ph);
      g.strokeStyle = rgba(M.goldL, 0.5); g.lineWidth = 1; g.strokeRect(px + 7, py + 7, pw - 14, ph - 14);
      rosette(g, px + pw / 2, py + ph / 2, 18);
    }
    g.save(); g.beginPath(); g.rect(px0, py0, pw0, ph0); g.clip(); lidPainting(g, px0, py0, pw0, ph0); g.restore();
    g.strokeStyle = INK; g.lineWidth = 9; g.strokeRect(px0 - 4, py0 - 4, pw0 + 8, ph0 + 8);
    g.strokeStyle = M.gold; g.lineWidth = 6; g.strokeRect(px0 - 4, py0 - 4, pw0 + 8, ph0 + 8);
    g.strokeStyle = M.goldL; g.lineWidth = 1.4; g.strokeRect(px0 - 6, py0 - 6, pw0 + 12, ph0 + 12);
    for (const bx of [x0, x1 - 30]) for (const by of [top, BOXG.top + BOX.h - 48]) { poly(g, [[bx, by], [bx + 30, by], [bx + 30, by + 30], [bx, by + 30]]); g.fillStyle = M.brass; g.fill(); ink(g, 1.4); rect(g, bx + 2, by + 2, 26, 3, M.brassL); }
    rect(g, cx - 70, top + 12, 140, 18, M.brass); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(cx - 70, top + 12, 140, 18);
    stencil(g, '給沒有名字的孩子', cx, top + 21.5, 12, '#3a2414', { ink: false });
    g.beginPath(); g.arc(cx, top + 207, 8, 0, TAU); g.fillStyle = M.brass; g.fill(); ink(g, 1.2);
    rect(g, cx - 2, top + 205, 4, 9, '#1a0e08');
    // the plinth and its feet
    rect(g, x0 - 20, -18, BOX.w + 40, 18, '#2a1810'); rect(g, x0 - 20, -18, BOX.w + 40, 3, '#8a5a3a'); g.strokeStyle = INK; g.lineWidth = 2.4; g.strokeRect(x0 - 20, -18, BOX.w + 40, 18);
    for (const fx of [x0 - 12, x1 + 12]) { g.beginPath(); g.ellipse(fx, -6, 20, 9, 0, 0, TAU); g.fillStyle = M.brass; g.fill(); ink(g, 1.4); }
    // the winding key's boss on the right flank
    g.beginPath(); g.arc(x1 + 4, top + 110, 16, 0, TAU); g.fillStyle = M.brassD; g.fill(); ink(g, 1.6);
  }
  function scatteredPages(objs) {
    const rng = U.mulberry32(8701);
    for (let x = 200; x < 8200; x += 180 + rng() * 420) {
      if ((x > ARENA.boss[0] + 80 && x < ARENA.boss[1] - 80) || (x > BELL.x - 260 && x < BELL.x + 240)) continue;
      const fl = floorAt(x), seed = (rng() * 1e6) | 0, n = 1 + Math.floor(rng() * 3);
      objs.push({ x: x - 40, y: fl - 20, w: 120, h: 30, draw(g) {
        const rr = U.mulberry32(seed);
        for (let i = 0; i < n; i++) { g.save(); g.translate(x + i * 22, fl + 8); g.scale(1, 0.32); sheet(g, 0, 0, 20, 26, (rr() - 0.5) * 1.6, rr, '#efe6d4'); g.restore(); }
      } });
    }
  }
  function genProps() {
    const objs = [];
    // the wings: a velvet curtain gathered at the stage's left edge, the pin rail with its ropes
    objs.push({ x: -820, y: -1300, w: 720, h: 2110, draw(g) {
      velvet(g, -760, -110, -1300, FLOOR[0], U.mulberry32(8801), true);
      rect(g, -130, -60, 26, FLOOR[0] + 60, '#1e1626'); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(-130, -60, 26, FLOOR[0] + 60);
      for (let y = 40; y < FLOOR[0] - 40; y += 90) { rect(g, -136, y, 38, 8, M.brassD); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(-136, y, 38, 8); rope(g, -118, y + 8, -110, y + 60, 6, 'rgba(200,180,140,0.7)', 1.6); }
    } });
    // the far wing beyond the music box
    objs.push({ x: 8240, y: -1400, w: 520, h: 1420, draw(g) { velvet(g, 8300, 8720, -1400, 0, U.mulberry32(8802), false); } });
    // ghost lights
    for (const [gx, gy] of GHOSTS) objs.push({ x: gx - 40, y: gy - 220, w: 80, h: 226, draw(g) { ghostLight(g, gx, gy); } });
    // painted flats leaning in the wings, music stands and a chair on the first tiers
    objs.push({ x: 640, y: FLOOR[0] - 320, w: 420, h: 330, draw(g) {
      flat(g, U.mulberry32(8811), 700, FLOOR[0] + 2, 300, 240, 'houses');
    } });
    for (const [mx, seed] of [[560, 1], [1720, 2], [3060, 3], [4960, 4], [6040, 5]]) {
      const fl = floorAt(mx);
      objs.push({ x: mx - 40, y: fl - 180, w: 80, h: 186, draw(g) { musicStand(g, mx, fl + 2, 120, U.mulberry32(8820 + seed)); } });
    }
    objs.push({ x: 1580, y: FLOOR[1] - 80, w: 80, h: 84, draw(g) {
      const x = 1610, b = FLOOR[1];
      g.save(); g.translate(x, b); g.rotate(-1.3);
      rect(g, -20, -40, 40, 6, M.woodL); rect(g, -20, -40, 4, 40, M.wood); rect(g, 16, -40, 4, 40, M.wood); rect(g, -20, -86, 6, 46, M.wood); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(-20, -40, 40, 6);
      g.restore();
    } });
    // the memories
    objs.push({ x: 2180, y: FLOOR[1] - 440, w: 580, h: 470, draw: barrowMemory });
    objs.push({ x: 2600, y: FLOOR[1] - 130, w: 120, h: 134, draw(g) { easel(g, 2668, FLOOR[1]); } });
    objs.push({ x: BELFRY.x0 - 280, y: BELFRY.y - 340, w: BELFRY.x1 - BELFRY.x0 + 560, h: 600, draw: belfryMemory });
    objs.push({ x: ROOF.x0 - 200, y: ROOF.y - 400, w: ROOF.x1 - ROOF.x0 + 420, h: FLOOR[3] - ROOF.y + 410, draw: roofMemory });
    objs.push({ x: DECK.x0 - 20, y: DECK.y - 260, w: DECK.x1 - DECK.x0 + 40, h: 262, draw: deckProps });
    objs.push({ x: DOOR.x - 130, y: -380, w: 470, h: 392, draw: lastDoor });
    objs.push({ x: BOXG.x0 - 600, y: BOXG.lidTop - 40, w: BOX.w + 1200, h: -BOXG.lidTop + 60, draw: musicBoxProp });
    // the Rest's crystals, pearl with a black heart, gathering where the stage is tired
    const rng = U.mulberry32(8890);
    for (const [px, n] of [[960, 2], [2060, 1], [3580, 2], [4300, 1], [5300, 2], [5900, 2], [6800, 1]]) {
      const fl = floorAt(px), seed = (rng() * 1e6) | 0;
      objs.push({ x: px - 70, y: fl - 90, w: 140, h: 96, draw(g) { const rr = U.mulberry32(seed); for (let i = 0; i < n; i++) pearlCluster(g, px + i * 34, fl + 2, 0.9 + rr() * 0.5, -PI / 2 + (rr() - 0.5) * 0.4, rr); } });
    }
    scatteredPages(objs);
    return objs;
  }

  /* =========================================================================================
     SKY (screen space): an eclipse over the endless stage — dark overhead, a rose-gold ring of twilight
     on the horizon, the black sun with its white corona, inverted rays, a faint staff written across the sky.
     The sun drifts toward the centre and grows as Rinne climbs; the endings change it.
     ========================================================================================= */
  const EPI = { mode: null, t: 0, k: 0, crack: 0, dawn: 0, pale: 0, still: 0, flood: 0, coat: 0, mira: null };
  const SKY = { corona: null };
  function buildCorona() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d'), cx = 256, cy = 256, R = 60, rr = U.mulberry32(8901);
    let gr = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, 256);
    gr.addColorStop(0, 'rgba(255,240,214,0.85)'); gr.addColorStop(0.06, 'rgba(255,220,180,0.42)'); gr.addColorStop(0.3, 'rgba(240,176,150,0.12)'); gr.addColorStop(1, 'rgba(200,140,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    // coronal streamers: long tapering petals of light
    for (let i = 0; i < 22; i++) {
      const a = rr() * TAU, len = R * (1.4 + rr() * 2.4), wd = 0.04 + rr() * 0.1;
      const sg = g.createLinearGradient(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len));
      sg.addColorStop(0, `rgba(255,246,228,${0.35 + rr() * 0.3})`); sg.addColorStop(1, 'rgba(255,230,200,0)');
      g.fillStyle = sg; g.beginPath();
      g.moveTo(cx + Math.cos(a - wd) * R, cy + Math.sin(a - wd) * R);
      g.quadraticCurveTo(cx + Math.cos(a) * (R + len * 0.5), cy + Math.sin(a) * (R + len * 0.5), cx + Math.cos(a + wd * 0.2) * (R + len), cy + Math.sin(a + wd * 0.2) * (R + len));
      g.lineTo(cx + Math.cos(a + wd) * R, cy + Math.sin(a + wd) * R); g.closePath(); g.fill();
    }
    g.beginPath(); g.arc(cx, cy, R + 3, 0, TAU); g.strokeStyle = 'rgba(255,230,190,0.45)'; g.lineWidth = 14; g.stroke();
    g.strokeStyle = 'rgba(255,253,244,1)'; g.lineWidth = 4; g.stroke();
    // the one red: a thin chromosphere arc low on the disc
    g.beginPath(); g.arc(cx, cy, R + 1.5, PI * 0.18, PI * 0.42); g.strokeStyle = 'rgba(255,60,100,0.9)'; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = '#05030a'; g.fill();
    return c;
  }
  function sunAt(cam, W, H, S) {
    const p = prog(cam.x), horizonY = H / 2 + (60 - cam.y * 0.03) * S;
    return { x: W / 2 + (BOX.x - cam.x) * 0.05 * S, y: horizonY - (300 + 10 * p) * S, r: (54 + 34 * p) * S, horizonY, p };
  }
  function drawSky(ctx, cam, W, H, S, time) {
    if (!SKY.corona) SKY.corona = buildCorona();
    const t = tintAt(cam.x), sun = sunAt(cam, W, H, S), e = EPI;
    let top = mixH('#0e0916', '#170c19', t), mid = mixH('#2f2340', '#432536', t), low = mixH('#8a6678', '#b2766a', t), hor = mixH('#efcdb2', '#ffdbac', t);
    if (e.dawn > 0) { const k = e.dawn; top = mixH(top, '#2a3058', k); mid = mixH(mid, '#a86a8a', k); low = mixH(low, '#ffb894', k); hor = mixH(hor, '#fff2d2', k); }
    if (e.pale > 0) { const k = e.pale * 0.8; top = mixH(top, '#8c8698', k); mid = mixH(mid, '#c8c0cc', k); low = mixH(low, '#ece4e0', k); hor = mixH(hor, '#fffaf2', k); }
    if (e.still > 0) { const k = e.still * 0.85; top = mixH(top, '#141418', k); mid = mixH(mid, '#3a3a42', k); low = mixH(low, '#77747e', k); hor = mixH(hor, '#b8b4ba', k); }
    const gr = ctx.createLinearGradient(0, 0, 0, sun.horizonY + 10 * S);
    gr.addColorStop(0, top); gr.addColorStop(0.45, mid); gr.addColorStop(0.84, low); gr.addColorStop(1, hor);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = hor; ctx.fillRect(0, sun.horizonY + 9 * S, W, H);
    // a staff written faintly across the sky, bowing around the sun
    ctx.strokeStyle = `rgba(255,236,214,${0.06 + 0.03 * Math.sin(time * 0.3)})`; ctx.lineWidth = Math.max(1, S);
    const off = -(cam.x * 0.02 * S) % 400;
    for (let i = 0; i < 5; i++) {
      const y0 = sun.y + (90 + i * 9) * S;
      ctx.beginPath(); ctx.moveTo(-50, y0 + 60 * S); ctx.quadraticCurveTo(sun.x + off * 0.1, y0 - 30 * S, W + 50, y0 + 50 * S); ctx.stroke();
    }
    // rays: thin light petals and inverted dark ones, turning slowly
    ctx.save(); ctx.translate(sun.x, sun.y);
    const still = e.still > 0.5 ? 0 : 1;
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16 + time * 0.012 * still + Math.sin(i * 3.1) * 0.12, len = (700 + 280 * Math.sin(i * 7.3)) * S, wd = 0.018 + 0.012 * Math.sin(i * 2.3);
      ctx.fillStyle = i % 2 ? `rgba(255,236,210,${(0.035 + 0.015 * Math.sin(time * 0.4 * still + i)) * (1 - e.pale * 0.6)})` : `rgba(6,3,12,${0.07 * (1 - e.dawn)})`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - wd) * len, Math.sin(a - wd) * len); ctx.lineTo(Math.cos(a + wd) * len, Math.sin(a + wd) * len); ctx.fill();
    }
    ctx.restore();
    // the black sun
    const shrink = 1 - e.pale * 0.35, R = sun.r * shrink, pulse = 1 + 0.025 * Math.sin(time * 0.8) * still;
    const sz = R / 60 * 256 * pulse;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - e.dawn * 0.3;
    ctx.drawImage(SKY.corona, sun.x - sz, sun.y - sz, sz * 2, sz * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.arc(sun.x, sun.y, R * 0.985, 0, TAU); ctx.fillStyle = '#05030a'; ctx.fill();
    // the ending: the black sun cracks, and morning pours through
    if (e.crack > 0) {
      ctx.save(); ctx.beginPath(); ctx.arc(sun.x, sun.y, R, 0, TAU); ctx.clip();
      ctx.strokeStyle = `rgba(255,236,190,${Math.min(1, e.crack * 1.6)})`; ctx.lineWidth = 2.2 * S; ctx.lineCap = 'round';
      const rr = U.mulberry32(8999);
      for (let i = 0; i < 9; i++) {
        let a = rr() * TAU, x = sun.x + Math.cos(a) * R * 0.1, y = sun.y + Math.sin(a) * R * 0.1;
        ctx.beginPath(); ctx.moveTo(x, y);
        const n = 4, reach = R * 1.05 * Math.min(1, e.crack * 1.4);
        for (let k = 1; k <= n; k++) { a += (rr() - 0.5) * 0.7; x = sun.x + Math.cos(a) * reach * k / n; y = sun.y + Math.sin(a) * reach * k / n; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      if (e.dawn > 0) { const dg = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, R); dg.addColorStop(0, `rgba(255,250,232,${e.dawn})`); dg.addColorStop(1, `rgba(255,214,150,${e.dawn * 0.9})`); ctx.fillStyle = dg; ctx.fillRect(sun.x - R, sun.y - R, R * 2, R * 2); }
      ctx.restore();
      if (e.dawn > 0) {
        ctx.globalCompositeOperation = 'lighter';
        const hg = ctx.createRadialGradient(sun.x, sun.y, R, sun.x, sun.y, R * 6);
        hg.addColorStop(0, `rgba(255,226,170,${0.4 * e.dawn})`); hg.addColorStop(1, 'rgba(255,200,150,0)');
        ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    return true;
  }

  /* =========================================================================================
     LIVE ATMOSPHERE (screen space): silence falling like pale snow, gold motes rising where memories
     are, the breath of the Rest, and the washes of the three endings
     ========================================================================================= */
  const ATM = (() => { const r = U.mulberry32(8950); return Array.from({ length: 90 }, () => ({ x: r(), y: r(), z: 0.4 + r() * 1.3, s: 0.6 + r() * 1.5, p: r() * 10, up: r() < 0.4 })); })();
  const MEM_X = [BELL.x, (BELFRY.x0 + BELFRY.x1) / 2, ROOF.x0 + 150, BOX.x];
  function drawAtmos(ctx, cam, W, H, S, time) {
    const low = G.Quality.low, n = low ? 34 : 80, e = EPI;
    let memK = 0; for (const mx of MEM_X) memK = Math.max(memK, 1 - Math.abs(cam.x - mx) / 900);
    memK = Math.max(memK, heartAt(cam.x) * 0.6, e.flood);
    const frozen = e.still > 0.6;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const m = ATM[i];
      const gold = m.up && memK > 0.05;
      const tt = frozen ? 0 : time;
      const px = ((m.x * W * 1.4 - cam.x * m.z * S * 0.5 + Math.sin(tt * 0.3 + m.p) * 30 * S) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
      const vy = gold ? -18 - 14 * memK : 9;
      const py = ((m.y * H + tt * vy * m.z * S - cam.y * m.z * S * 0.4) % H + H) % H;
      const a = (0.18 + 0.22 * Math.sin(tt * 1.2 + m.p)) * (m.z > 1 ? 0.85 : 0.5) * (gold ? 0.6 + memK : 1);
      ctx.fillStyle = gold ? `rgba(255,214,140,${a})` : `rgba(236,228,246,${a * 0.75})`;
      const r = m.s * S * m.z * (gold ? 1.1 : 0.8);
      ctx.fillRect(px, py, r, r);
    }
    ctx.globalCompositeOperation = 'source-over';
    // the endings
    if (e.flood > 0.01) {
      ctx.globalCompositeOperation = G.Quality.full ? 'soft-light' : 'source-over'; ctx.fillStyle = `rgba(255,190,130,${(G.Quality.full ? 0.4 : 0.14) * e.flood})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const v = G.game && G.game._view, bx = v ? W / 2 + (BOX.x - v.cam.x) * v.S : W / 2, by = v ? H / 2 + (-260 - v.cam.y) * v.S : H * 0.5;
      const gg = ctx.createRadialGradient(bx, by, 0, bx, by, W * 0.8);
      gg.addColorStop(0, `rgba(255,220,160,${0.24 * e.flood})`); gg.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (e.pale > 0.01) {
      const v = G.game && G.game._view, P = G.game && G.game.player;
      const px = v && P ? W / 2 + (P.x - v.cam.x) * v.S : W / 2, py = v && P ? H / 2 + (P.y - 70 - v.cam.y) * v.S : H / 2;
      const pg = ctx.createRadialGradient(px, py, 40 * S, px, py, W * 0.75);
      pg.addColorStop(0, `rgba(255,252,246,${0.05 * e.pale})`); pg.addColorStop(0.35, `rgba(246,242,250,${0.32 * e.pale})`); pg.addColorStop(1, `rgba(236,232,244,${0.55 * e.pale})`);
      ctx.fillStyle = pg; ctx.fillRect(0, 0, W, H);
    }
    if (e.still > 0.01) {
      if (G.Quality.full) { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(0,0,0,${0.75 * e.still})`; } else ctx.fillStyle = `rgba(40,44,60,${0.3 * e.still})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = G.Quality.full ? 'soft-light' : 'source-over'; ctx.fillStyle = `rgba(120,140,190,${(G.Quality.full ? 0.3 : 0.12) * e.still})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    return true;
  }
  // near-camera silhouettes (parallax 1.35): fly ropes and sandbags, a hanging lamp, curtain swags — never over the fight
  function drawForeground(ctx, cam, S, game) {
    if ((game.focus && game.focus.zoom < 0.9) || (game.arena && game.arena.id === 'c8_boss')) return true;
    const f = 1.35, span = 1250, base = Math.floor((cam.x * f - 1250) / span), t = game.realTime;
    for (let i = base; i < base + 4; i++) {
      const rng = U.mulberry32(i * 719 + 13);
      if (rng() < 0.4) continue;
      const x = cam.x + (i * span + rng() * 500 - cam.x * f), kind = rng(), top = cam.y - 420;
      ctx.save();
      if (kind < 0.4) {
        const sway = Math.sin(t * 0.7 + i) * 6;
        ctx.strokeStyle = 'rgba(10,6,16,0.92)'; ctx.lineWidth = 2.6;
        for (const ox of [0, 26]) { ctx.beginPath(); ctx.moveTo(x + ox, top); ctx.lineTo(x + ox + sway, top + 150 + ox * 2); ctx.stroke(); }
        ctx.fillStyle = 'rgba(10,6,16,0.95)';
        for (const ox of [0, 26]) { ctx.beginPath(); ctx.ellipse(x + ox + sway, top + 168 + ox * 2, 13, 18, 0, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,220,170,0.18)'; ctx.fillRect(x + sway + 6, top + 156, 2, 20);
      } else if (kind < 0.7) {
        const sway = Math.sin(t * 0.5 + i) * 4;
        ctx.fillStyle = 'rgba(14,6,14,0.94)';
        ctx.beginPath(); ctx.moveTo(x - 280, top - 20); ctx.lineTo(x + 280, top - 20); ctx.lineTo(x + 270, top + 70 + sway);
        for (let k = 4; k >= 0; k--) { const px = x - 270 + k * 135; ctx.quadraticCurveTo(px + 67, top + 30 + sway, px, top + 76 + sway * (k % 2 ? 1 : -1)); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(217,178,94,0.35)'; for (let k = 0; k < 4; k++) ctx.fillRect(x - 203 + k * 135, top + 52 + sway, 3, 3);
      } else {
        const lx = x, ly = top + 120 + rng() * 60, sway = Math.sin(t * 0.8 + i) * 5;
        ctx.strokeStyle = 'rgba(10,6,16,0.92)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(lx, top - 20); ctx.lineTo(lx + sway, ly); ctx.stroke();
        ctx.fillStyle = 'rgba(10,6,16,0.96)'; ctx.beginPath(); ctx.moveTo(lx + sway - 26, ly + 30); ctx.lineTo(lx + sway + 26, ly + 30); ctx.lineTo(lx + sway + 12, ly); ctx.lineTo(lx + sway - 12, ly); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,230,190,0.5)'; ctx.fillRect(lx + sway - 22, ly + 30, 44, 2);
      }
      ctx.restore();
    }
    return true;
  }

  /* =========================================================================================
     LIVE WORLD (world space, per frame, culled): footlights, ghost lights, the shimmer on the staircases
     of light, the two bells, the sunset's breath, the music box playing what the score plays, memory halos
     ========================================================================================= */
  const SPR = {};
  function glowSprite(rgb) {
    if (SPR[rgb]) return SPR[rgb];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.35, `rgba(${rgb},0.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); SPR[rgb] = c; return c;
  }
  const sprite = (ctx, rgb, x, y, r, a) => { if (a <= 0.003) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2); };
  // bells: tiny damped pendulums, rung by memory (Barrow) and — if its clapper came home — by the Belfry
  const BELLS = {
    barrow: { th: 0, v: 0, next: 1.5, pull: 0, x: BELL.x, y: FLOOR[1] - 236, sfx: 'c8_bellToll', period: 8.5, amp: 2.4 },
    belfry: { th: 0, v: 0, next: 4, pull: 0, x: 3250, y: BELFRY.y - 142, sfx: 'c8_belfryToll', period: 10.5, amp: 2.0 },
  };
  function updBells(game, dt) {
    const F = game.save.flags, P = game.player;
    for (const k in BELLS) {
      const b = BELLS[k];
      const active = k === 'barrow' || !!F.c2_quest_done;
      b.pull = Math.max(0, b.pull - dt);
      if (active && EPI.mode !== 'fermata') {
        b.next -= dt;
        if (b.next <= 0) { b.next = b.period + Math.random() * 2; b.pull = 0.6; b.v += b.amp * (b.th >= 0 ? -1 : 1) * 0.6 + b.amp * 0.4; }
      }
      const prev = b.v;
      b.v += (-b.th * 9 - b.v * 0.55) * dt; b.th += b.v * dt;
      // the clapper strikes at each turn of the swing
      if (Math.sign(prev) !== Math.sign(b.v) && Math.abs(b.th) > 0.12) {
        const d = Math.abs(P.x - b.x);
        if (d < 1100 && game.state === 'play' && !G.UI.dialogActive) G.SFX.play(b.sfx, Math.max(0.15, 1 - d / 1100));
        if (d < 1600) G.FX.ring(b.x + Math.sin(b.th) * 40, b.y + 60, 10, 120, 0.9, k === 'barrow' ? '#ffd8a0' : '#cfeaff', 2.5);
      }
    }
  }
  function drawBell(ctx, x, y, th, s, C, frost, cracked) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(th); ctx.scale(s, s);
    ctx.fillStyle = INK; ctx.fillRect(-4, -8, 8, 12);
    const body = [[-14, 4], [-18, 22], [-22, 44], [-30, 56], [-33, 62], [33, 62], [30, 56], [22, 44], [18, 22], [14, 4]];
    blob(ctx, [[-14, 2], [-19, 24], [-24, 46], [-35, 62], [35, 62], [24, 46], [19, 24], [14, 2], [0, -2]]);
    const gr = ctx.createLinearGradient(-34, 0, 34, 0);
    gr.addColorStop(0, C.dark); gr.addColorStop(0.35, C.body); gr.addColorStop(0.62, C.lit); gr.addColorStop(0.72, C.body); gr.addColorStop(1, C.dark);
    ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.fillStyle = C.dark; ctx.fillRect(-34, 58, 68, 5); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(-34, 58, 68, 5);
    ctx.strokeStyle = rgba(INK, 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-20, 30); ctx.lineTo(20, 30); ctx.moveTo(-26, 50); ctx.lineTo(26, 50); ctx.stroke();
    if (cracked) { ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(2, 26); ctx.lineTo(9, 38); ctx.lineTo(4, 58); ctx.stroke(); }
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-Math.sin(th) * 30, 66, 5, 0, TAU); ctx.fill();
    if (frost) {
      ctx.strokeStyle = 'rgba(240,250,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, 4); ctx.quadraticCurveTo(-22, 30, -33, 60); ctx.stroke();
      for (let i = 0; i < 6; i++) { const ix = -28 + i * 11, il = 6 + (i * 7) % 12; ctx.beginPath(); ctx.moveTo(ix - 2.5, 63); ctx.lineTo(ix + 2.5, 63); ctx.lineTo(ix, 63 + il); ctx.closePath(); ctx.fillStyle = 'rgba(220,244,255,0.9)'; ctx.fill(); ctx.strokeStyle = rgba(INK, 0.6); ctx.lineWidth = 0.6; ctx.stroke(); }
    }
    ctx.restore();
  }
  // the music box mechanism: one tooth per pitch, plucked by the score that is actually playing
  const COMB = { n: 44, x0: 7262, dx: 12.6, y: -258, len0: 19, len1: 9 };
  const BOXST = { last: -1, track: null, phi: 0, pl: new Float32Array(44).fill(9), demo: 0, demoI: 0, fan: 0, key: 0 };
  const toothFor = (m) => clamp(Math.round((m - 62) * 43 / 34), 0, 43);
  function updBox(game, dt) {
    const Pl = game.player, near = Math.abs(game.cam.x - BOX.x) < 1700;
    for (let i = 0; i < 44; i++) BOXST.pl[i] += dt;
    if (!near) return;
    const stop = EPI.mode === 'fermata' ? EPI.still : 0;
    const Mu = G.Music, A = G.AudioKit, ac = A && A.ctx;
    if (Mu && Mu.def && ac && stop < 0.5) {
      const d = Mu.def, spb = 60 / d.bpm / 4, loop = d.chords.length * 16;
      const cur = Mu.step - Math.ceil(Math.max(0, Mu.nextT - ac.currentTime) / spb);
      if (BOXST.track !== Mu.track || cur < BOXST.last || cur - BOXST.last > 64) { BOXST.track = Mu.track; BOXST.last = cur - 1; }
      for (let st = BOXST.last + 1; st <= cur; st++) {
        const ls = ((st % loop) + loop) % loop, cyc = Math.floor(st / loop);
        if (d.melEvery === 1 || cyc % d.melEvery === d.melEvery - 1) for (const n of d.melody) if (n[0] === ls) BOXST.pl[toothFor(n[1] > 90 ? n[1] - 12 : n[1] < 62 ? n[1] + 12 : n[1])] = 0;
        if (d.c8x) for (const line of d.c8x) if (line.box) for (const n of line.notes) if (n[0] === ls) BOXST.pl[toothFor(n[1] > 90 ? n[1] - 12 : n[1])] = 0;
      }
      BOXST.last = cur;
      BOXST.phi = (((cur % loop) + loop) % loop) / loop * TAU;
    } else if (stop < 0.5) {
      // no audio (muted / headless): the box hums the first half of the theme to itself
      BOXST.demo -= dt;
      if (BOXST.demo <= 0) {
        const T = G.Music.THEME, nn = T[BOXST.demoI % 13];
        BOXST.pl[toothFor(nn[1])] = 0; BOXST.demo = nn[2] * 0.11; BOXST.demoI++;
      }
      BOXST.phi += dt * 0.35;
    }
    const spin = 1 - stop;
    BOXST.fan += dt * 14 * spin; BOXST.key += dt * 0.25 * spin;
    void Pl;
  }
  function drawBox(ctx, game) {
    const t = game.realTime, x0 = BOXG.x0, x1 = BOXG.x1, still = EPI.mode === 'fermata' ? EPI.still : 0;
    // the cylinder: brass, its pins turning through the comb
    const cy = -283, cr = 15, cx0 = 7240, cx1 = 7830;
    const gr = ctx.createLinearGradient(0, cy - cr, 0, cy + cr);
    gr.addColorStop(0, '#fff0c0'); gr.addColorStop(0.18, M.brassL); gr.addColorStop(0.45, M.brass); gr.addColorStop(0.8, M.brassD); gr.addColorStop(1, '#3a2410');
    ctx.fillStyle = gr; ctx.fillRect(cx0, cy - cr, cx1 - cx0, cr * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(cx0, cy - cr, cx1 - cx0, cr * 2);
    for (const ex of [cx0, cx1]) { ctx.beginPath(); ctx.ellipse(ex, cy, 5, cr, 0, 0, TAU); ctx.fillStyle = M.brassD; ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#fff6dc';
    for (let i = 0; i < 44; i++) {
      const px = COMB.x0 + i * COMB.dx + COMB.dx * 0.35;
      for (let j = 0; j < 3; j++) {
        const a = BOXST.phi * 3 + j * 2.09 + i * 0.83;
        const c = Math.cos(a); if (c < 0.1) continue;
        ctx.fillRect(px - 1, cy + Math.sin(a) * cr * 0.92 - 1, 2, 2);
      }
    }
    // the comb: steel teeth, longer for the low notes; a plucked tooth rings and glows
    ctx.fillStyle = '#9aa2b8'; ctx.fillRect(COMB.x0 - 8, COMB.y - 2, COMB.n * COMB.dx + 14, 10);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(COMB.x0 - 8, COMB.y - 2, COMB.n * COMB.dx + 14, 10);
    for (let i = 0; i < COMB.n; i++) {
      const px = COMB.x0 + i * COMB.dx, len = lerp(COMB.len0, COMB.len1, i / 43), pl = BOXST.pl[i];
      const ring = pl < 0.9 ? (1 - pl / 0.9) : 0, wob = ring * Math.sin(pl * 60) * 2.4;
      ctx.fillStyle = ring > 0 ? mixH(M.comb, '#fff6d8', ring) : M.comb;
      ctx.beginPath(); ctx.moveTo(px, COMB.y - 1); ctx.lineTo(px + 8, COMB.y - 1); ctx.lineTo(px + 7 + wob, COMB.y - len); ctx.lineTo(px + 1 + wob, COMB.y - len); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.stroke();
      if (ring > 0.05) sprite(ctx, '255,226,170', px + 4, COMB.y - len, 16 + ring * 10, ring * 0.9);
    }
    ctx.globalAlpha = 1;
    // the governor fan and the spring barrel at the right end
    const gx = 7880, gy = cy;
    ctx.fillStyle = M.brassD; ctx.beginPath(); ctx.arc(gx, gy, 10, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    const fw = Math.cos(BOXST.fan) * 16;
    ctx.fillStyle = 'rgba(220,226,240,0.85)'; ctx.fillRect(gx - Math.abs(fw), gy - 22, Math.abs(fw) * 2, 6); ctx.strokeRect(gx - Math.abs(fw), gy - 22, Math.abs(fw) * 2, 6);
    ctx.beginPath(); ctx.arc(7960, cy + 2, 21, 0, TAU); ctx.fillStyle = M.brass; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = M.brassD; ctx.lineWidth = 1.2; for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + BOXST.key * 0.6; ctx.beginPath(); ctx.moveTo(7960 + Math.cos(a) * 14, cy + 2 + Math.sin(a) * 14); ctx.lineTo(7960 + Math.cos(a) * 20, cy + 2 + Math.sin(a) * 20); ctx.stroke(); }
    // the winding key outside the right flank, turning as the spring lets go
    const kx = x1 + 16, ky = BOXG.top + 110, kw = Math.cos(BOXST.key) * 34;
    ctx.fillStyle = M.brass; ctx.fillRect(x1 + 4, ky - 4, 18, 8); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(x1 + 4, ky - 4, 18, 8);
    ctx.beginPath(); ctx.ellipse(kx + 18, ky - Math.abs(kw) * 0.55, 10, Math.max(3, Math.abs(kw) * 0.55), 0, 0, TAU); ctx.ellipse(kx + 18, ky + Math.abs(kw) * 0.55, 10, Math.max(3, Math.abs(kw) * 0.55), 0, 0, TAU);
    ctx.fillStyle = kw > 0 ? M.brassL : M.brass; ctx.fill(); ctx.stroke();
    // the figurine on its turntable: a black-haired conductor and a girl in a red scarf, hand in hand
    const fx = x0 + 64, fy = BOXG.bed + 2, rot = Math.cos(BOXST.phi * 2 + t * 0.4 * (1 - still));
    ctx.fillStyle = M.brass; ctx.beginPath(); ctx.ellipse(fx, fy, 26, 6, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.save(); ctx.translate(fx, fy); ctx.scale(rot, 1);
    ctx.fillStyle = '#1a1220'; ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(-4, -2); ctx.lineTo(-6, -30); ctx.lineTo(-10, -30); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(-8, -34, 4.4, 0, TAU); ctx.fill(); ctx.fillRect(-12, -34, 3, 16);
    ctx.strokeStyle = '#1a1220'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-9, -26); ctx.lineTo(-18, -38); ctx.stroke();
    ctx.fillStyle = '#e8d8c0'; ctx.beginPath(); ctx.moveTo(3, -2); ctx.lineTo(11, -2); ctx.lineTo(9, -18); ctx.lineTo(5, -18); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -21, 3.4, 0, TAU); ctx.fillStyle = '#f0c8a0'; ctx.fill();
    ctx.fillStyle = M.scarf; ctx.fillRect(4, -18, 8, 2.4);
    ctx.strokeStyle = '#1a1220'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, -20); ctx.lineTo(5, -14); ctx.stroke();
    ctx.restore();
  }
  function drawBack(ctx, game) {
    const cam = game.cam, S = (game._view && game._view.S) || 1, hw = game.W / 2 / S + 160, t = game.realTime;
    const xa = cam.x - hw, xb = cam.x + hw, F = game.save.flags;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // footlights along every apron in view
    for (const s of L.solids) {
      if (s.kind !== 'c8_stage' || s.x > xb || s.x + s.w < xa) continue;
      const a = Math.max(s.x, xa), b = Math.min(s.x + s.w, xb);
      for (let fx = Math.floor(a / FOOT_STEP) * FOOT_STEP + 75; fx < b; fx += FOOT_STEP) {
        // the upper stage stays dark until Rinne reaches it; then the lights come on in a wave toward the heart
        let on = 1, flash = 0;
        if (fx > RISE[1] && VISTA.t < 99) {
          const front = VISTA.t < 0 ? -1 : VISTA.t * 1100, d = fx - RISE[1];
          on = d < front ? 1 : 0.14; flash = d < front && d > front - 260 ? 1 - (front - d) / 260 : 0;
        }
        const fl = (0.8 + 0.2 * Math.sin(t * 7 + fx * 0.37) * Math.sin(t * 2.3 + fx)) * on;
        sprite(ctx, '255,214,150', fx, s.y + 35, 34 + flash * 40, 0.55 * fl + flash * 0.5);
        sprite(ctx, '255,236,200', fx, s.y + 34, 12, 0.8 * fl + flash * 0.4);
      }
    }
    // ghost lights
    for (const [gx, gy] of GHOSTS) {
      if (gx < xa || gx > xb) continue;
      const fl = 0.85 + 0.15 * Math.sin(t * 13 + gx) * Math.sin(t * 3.1);
      sprite(ctx, '255,236,200', gx, gy - 190, 130, 0.38 * fl); sprite(ctx, '255,250,236', gx, gy - 190, 26, 0.95 * fl);
    }
    // the staircases of light: a slow bright sweep and motes lifting off them
    for (const p of L.oneways) {
      if (p.k !== 'light' || p.x > xb || p.x + p.w < xa) continue;
      const k = (t * 0.45 + p.x * 0.0013) % 1.6, sx = p.x + k * p.w;
      if (k < 1) { ctx.globalAlpha = 0.7 * Math.sin(k * PI); ctx.fillStyle = '#fffaf0'; ctx.fillRect(sx - 6, p.y, 12, 3); }
      for (let i = 0; i < 3; i++) { const q = (t * 0.3 + i / 3 + p.x * 0.01) % 1; sprite(ctx, '255,236,200', p.x + (i + 0.5) * p.w / 3 + Math.sin(t + i) * 6, p.y - q * 70, 5, (1 - q) * 0.7); }
    }
    // the rooftop sunset breathing
    if (ROOF.x1 + 300 > xa && ROOF.x0 - 300 < xb) sprite(ctx, '255,190,120', ROOF.x0 + 200, ROOF.y - 140, 200 + Math.sin(t * 0.6) * 12, 0.22);
    ctx.globalAlpha = 1; ctx.restore();
    // the Belfry's bell (rung only if its clapper came home)
    if (3250 > xa - 200 && 3250 < xb + 200) {
      const b = BELLS.belfry;
      drawBell(ctx, b.x, b.y, b.th, 0.86, { body: M.bronze, lit: M.bronzeL, dark: M.bronzeD }, !F.c2_quest_done, false);
    }
    // the music box
    if (BOX.x + 700 > xa && BOX.x - 700 < xb) drawBox(ctx, game);
    // memory halos: foes the Rest remembers from earlier chapters stand in a pale glow
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const e of game.enemies) {
      if (e.dead || e.state === 'die' || !e.enc || !String(e.enc).startsWith('c8_') || String(e.type).startsWith('c8_')) continue;
      if (e.x < xa || e.x > xb) continue;
      const h = (e.T && e.T.h) || 80, em = e.state === 'spawn' ? 0.5 : 1;
      sprite(ctx, '236,228,250', e.x, e.y - h * 0.55, Math.max(60, h * 0.9), 0.32 * em);
      ctx.globalAlpha = 0.4 * em; ctx.strokeStyle = 'rgba(240,232,255,0.9)'; ctx.lineWidth = 1;
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(e.x - 46, e.y - 2 - k * 3); ctx.lineTo(e.x + 46, e.y - 2 - k * 3); ctx.stroke(); }
    }
    ctx.globalAlpha = 1; ctx.restore();
    drawEpilogueBack(ctx, game);
  }
  function drawFront(ctx, game) {
    const cam = game.cam, t = game.realTime, hk = heartAt(cam.x);
    // notes lifting off the music box into the eclipse (the heart only)
    if (hk > 0.2 && EPI.mode !== 'fermata') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const n = G.Quality.low ? 5 : 10, boost = 1 + EPI.flood * 2;
      for (let i = 0; i < n * boost; i++) {
        const q = (t * 0.07 + i * 0.137) % 1, x = BOX.x - 380 + ((i * 97) % 760) + Math.sin(t * 0.8 + i) * 22, y = -300 - q * 520;
        ctx.globalAlpha = Math.sin(q * PI) * 0.8 * hk;
        ctx.fillStyle = '#ffe2a8';
        ctx.beginPath(); ctx.ellipse(x, y, 4, 3, -0.4, 0, TAU); ctx.fill(); ctx.fillRect(x + 3, y - 13, 1.4, 13);
        if (i % 3 === 0) ctx.fillRect(x + 3, y - 13, 6, 2);
      }
      ctx.globalAlpha = 1; ctx.restore();
    }
    drawEpilogueFront(ctx, game);
  }

  /* =========================================================================================
     MEMORY NPCs — Barrow ringing his bell at dusk; a little girl on a rooftop with a music box;
     Elaine Vega's fragment, projected by Ode beside the last door
     ========================================================================================= */
  const NH = { noHatch: true };
  const POSES = {
    pullUp: { ry: 1, torso: -0.06, head: -0.25, tF: 0.12, kF: -0.08, tB: -0.14, kB: -0.08, aF: 2.75, eF: 0.25, aB: 2.55, eB: 0.35 },
    pullDown: { ry: 7, torso: 0.3, head: 0.1, tF: 0.32, kF: -0.4, tB: -0.2, kB: -0.36, aF: 1.25, eF: 0.55, aB: 1.05, eB: 0.75 },
    sitBox: { ry: 0, torso: -0.02, head: 0.14, tF: 1.5, kF: -1.45, tB: 1.42, kB: -1.35, aF: 0.95, eF: 1.05, aB: 0.85, eB: 1.15 },
    stand: { ry: 0, torso: 0.02, head: 0.02, tF: 0.12, kF: -0.06, tB: -0.12, kB: -0.05, aF: 0.18, eF: 0.15, aB: -0.2, eB: 0.35 },
    standHilt: { ry: 0, torso: -0.03, head: -0.04, tF: 0.16, kF: -0.06, tB: -0.16, kB: -0.06, aF: 0.55, eF: 1.25, aB: -0.3, eB: 0.4 },
  };
  function person(g, x, y, s, face, J, L2) {
    g.save(); g.translate(x, y); g.scale(face * s, s);
    const hand = (p, c) => { g.beginPath(); g.arc(p.x, p.y, L2.child ? 2.6 : 2.8, 0, TAU); g.fillStyle = c; g.fill(); ink(g, 0.9); };
    const legsB = mixH(L2.legs, '#241a34', 0.3), coatB = mixH(L2.coat, '#241a34', 0.3);
    Rig.limb(g, J.hip, J.kneeB, 6.2, 5, legsB, NH); Rig.limb(g, J.kneeB, J.ankB, 5, 3.8, legsB, NH); Rig.limb(g, J.ankB, J.toeB, 3.6, 2.6, L2.shoe, NH);
    Rig.limb(g, J.shB, J.elB, 4.4, 3.6, coatB, NH); Rig.limb(g, J.elB, J.hdB, 3.6, 2.8, coatB, NH); hand(J.hdB, L2.skin);
    const ux = J.chest.x - J.hip.x, uy = J.chest.y - J.hip.y, ul = Math.hypot(ux, uy) || 1, nx = -uy / ul, ny = ux / ul;
    const Q = (a, b) => [J.hip.x + ux * a + nx * b, J.hip.y + uy * a + ny * b];
    const tw = L2.child ? 9.4 : 11.5, hw = L2.child ? 8.4 : 9.6;
    if (L2.long) { const sw = L2.sway || 0; blob(g, [Q(0.55, -tw * 0.9), Q(0.05, -hw - 2), Q(-0.98, -hw - 6 - sw), Q(-1.04, hw + 3 - sw * 0.5), Q(-0.2, hw + 1)]); g.fillStyle = lit(g, ...Q(-0.4, 0), 28, coatB); g.fill(); ink(g, 1.3); }
    Rig.limb(g, J.hip, J.kneeF, 6.6, 5.2, L2.legs, { spec: 0.2, noHatch: true }); Rig.limb(g, J.kneeF, J.ankF, 5.2, 4, L2.legs, NH); Rig.limb(g, J.ankF, J.toeF, 3.8, 2.7, L2.shoe, NH);
    if (L2.skirt) { const sl = L2.skirt; blob(g, [Q(0.25, -hw - 0.5), Q(0.25, hw + 0.5), Q(-sl, hw + 7), Q(-sl - 0.06, 0), Q(-sl, -hw - 6)]); g.fillStyle = lit(g, ...Q(-sl * 0.5, 0), 26, L2.skirtCol || L2.coat); g.fill(); ink(g, 1.2); }
    blob(g, [Q(-0.06, -hw), Q(0.5, -tw * 0.98), Q(1.02, -tw * 0.85), Q(1.12, 0), Q(1.04, tw), Q(0.55, tw * 0.95), Q(-0.06, hw)]);
    g.fillStyle = lit(g, ...Q(0.5, 0), 24, L2.coat); g.fill(); ink(g, 1.25);
    if (L2.lapel) { g.strokeStyle = rgba(INK, 0.5); g.lineWidth = 0.8; g.beginPath(); { const a = Q(1.02, 4), b = Q(0.4, 1.5), c = Q(-0.05, 2); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); } g.stroke(); }
    if (L2.scarf) {
      const a = Q(1.04, -tw * 0.75), b = Q(1.07, tw * 0.8);
      Rig.limb(g, { x: a[0], y: a[1] }, { x: b[0], y: b[1] }, 3.4, 3.4, L2.scarf, NH);
      if (L2.tail) Rig.ribbon(g, L2.tail, 3, 1.6, L2.scarf); else { const c = Q(0.95, -tw * 0.6); Rig.limb(g, { x: c[0], y: c[1] }, { x: c[0] - 4, y: c[1] + 16 }, 2.6, 2, L2.scarf, NH); }
    }
    // head
    const hr = L2.child ? 10.2 : 9;
    g.save(); g.translate(J.head.x, J.head.y); g.rotate(J.ha);
    if (L2.hair === 'bob') { blob(g, [[-hr * 0.4, -hr * 1.05], [-hr * 1.25, -hr * 0.2], [-hr * 1.15, hr * 0.95], [-hr * 0.2, hr * 0.85], [hr * 0.3, 0]]); g.fillStyle = lit(g, -hr * 0.4, 0, hr, L2.hairCol); g.fill(); ink(g, 1); }
    blob(g, [[-hr * 0.15, -hr], [hr * 0.6, -hr * 0.92], [hr * 0.95, -hr * 0.32], [hr * 1.08, hr * 0.08], [hr * 0.86, hr * 0.32], [hr * 0.92, hr * 0.58], [hr * 0.55, hr * 0.95], [-hr * 0.12, hr * 0.92], [-hr * 0.55, hr * 0.3]]);
    g.fillStyle = lit(g, hr * 0.25, 0, hr, L2.skin); g.fill(); ink(g, 1.1);
    if (L2.beard) { blob(g, [[hr * 0.2, hr * 0.35], [hr * 0.95, hr * 0.42], [hr * 0.8, hr * 1.25], [hr * 0.3, hr * 1.3], [-hr * 0.1, hr * 0.7]]); g.fillStyle = L2.hairCol; g.fill(); ink(g, 0.9); }
    if (L2.eyes === 'closed') { g.beginPath(); g.arc(hr * 0.55, -hr * 0.18, hr * 0.2, 0.35, PI - 0.35); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke(); }
    else { g.fillStyle = INK; g.beginPath(); g.ellipse(hr * 0.56, -hr * 0.12, hr * 0.1, hr * 0.15, 0, 0, TAU); g.fill(); }
    if (L2.hair === 'white') {
      blob(g, [[-hr * 0.55, hr * 0.5], [-hr * 1.0, -hr * 0.2], [-hr * 0.5, -hr * 1.0], [hr * 0.3, -hr * 1.1], [hr * 0.65, -hr * 0.75], [hr * 0.1, -hr * 0.55], [-hr * 0.2, hr * 0.4]]);
      g.fillStyle = L2.hairCol; g.fill(); ink(g, 1);
    } else if (L2.hair === 'bob') {
      blob(g, [[-hr * 0.85, hr * 0.3], [-hr * 1.05, -hr * 0.5], [-hr * 0.3, -hr * 1.2], [hr * 0.6, -hr * 1.1], [hr * 1.12, -hr * 0.45], [hr * 0.7, -hr * 0.3], [hr * 0.3, -hr * 0.6], [-hr * 0.3, hr * 0.3]]);
      g.fillStyle = lit(g, 0, -hr * 0.5, hr, L2.hairCol); g.fill(); ink(g, 1);
    } else if (L2.hair === 'short') {
      blob(g, [[-hr * 0.7, hr * 0.5], [-hr * 1.05, -hr * 0.3], [-hr * 0.4, -hr * 1.15], [hr * 0.55, -hr * 1.15], [hr * 1.1, -hr * 0.6], [hr * 0.8, -hr * 0.2], [hr * 0.35, -hr * 0.55], [hr * 0.0, -hr * 0.1], [-hr * 0.25, hr * 0.55]]);
      g.fillStyle = lit(g, 0, -hr * 0.5, hr, L2.hairCol); g.fill(); ink(g, 1);
      if (L2.scar) { g.strokeStyle = rgba(L2.scarCol || '#ffffff', 0.9); g.lineWidth = 1; g.beginPath(); g.moveTo(hr * 0.25, -hr * 0.62); g.lineTo(hr * 0.95, -hr * 0.3); g.stroke(); }
    }
    g.strokeStyle = INK; g.lineWidth = 0.75; g.beginPath(); g.moveTo(hr * 0.66, hr * 0.56); g.lineTo(hr * 0.84, hr * 0.5); g.stroke();
    g.restore();
    Rig.limb(g, J.sh, J.elF, 4.6, 3.8, L2.coat, { spec: 0.2, noHatch: true }); Rig.limb(g, J.elF, J.hdF, 3.8, 3, L2.coat, NH); hand(J.hdF, L2.skin);
    g.restore();
  }
  const COMPUTED = {};
  const jointsOf = (k) => COMPUTED[k] || (COMPUTED[k] = Rig.compute(Rig.full(POSES[k])));
  const lerpJ = (A, B, k) => { const o = {}; for (const n in A) { const a = A[n], b = B[n]; o[n] = typeof a === 'object' ? { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k } : a + (b - a) * k; } return o; };
  // Barrow, as his daughter remembers him: ringing the cracked bell at dusk so she can find her way home
  const BARROW_LOOK = { coat: '#5a4636', legs: '#3e342e', shoe: '#2a2220', skin: '#e2bea0', hair: 'white', hairCol: '#e6e2da', beard: true, eyes: 'closed', scarf: '#8a3a2e', lapel: true, long: true };
  function drawBarrowMem(ctx, x, y, t, game) {
    const b = BELLS.barrow, F = game.save.flags, k = clamp(b.pull / 0.6, 0, 1);
    const pullK = k > 0 ? Math.sin(k * PI) : 0;
    const J = lerpJ(jointsOf('pullUp'), jointsOf('pullDown'), 0.25 + pullK * 0.75);
    // the bell and its rope (from the wheel down into his hands)
    const beam = FLOOR[1] - 250;
    drawBell(ctx, b.x, b.y, b.th, 1, { body: M.bronze, lit: M.bronzeL, dark: M.bronzeD }, false, true);
    const s = 1.12, hx = x + J.hdF.x * s, hy = y + J.hdF.y * s;
    ctx.strokeStyle = '#c8b48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(BELL.x - 40 - 13, beam + 6); ctx.quadraticCurveTo(hx - 6, (beam + hy) / 2, hx, hy); ctx.stroke();
    ctx.strokeStyle = rgba(INK, 0.6); ctx.lineWidth = 0.8; ctx.stroke();
    // memory haze: a warm halo and a faint pale outline (he is remembered, not here)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; sprite(ctx, '255,200,140', x, y - 70, 90, 0.3); ctx.restore(); ctx.globalAlpha = 1;
    person(ctx, x, y, s, 1, J, BARROW_LOOK);
    // if his daughter's music box came home, it sits on the crate beside him
    if (F.gave_musicbox) {
      const mx = 2360, my = FLOOR[1] - 28;
      block(ctx, mx - 10, my - 12, 20, 12, { body: M.brass, lit: M.brassL, dark: M.brassD });
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; sprite(ctx, '255,226,170', mx, my - 8, 22, 0.5 + 0.2 * Math.sin(t * 2)); ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  // the little girl on the rooftop, legs swinging, a music box in her lap, a red scarf much too big for her
  const GIRL_LOOK = { coat: '#e8d8c0', legs: '#f0c8a8', shoe: '#5a3a3a', skin: '#f2cfae', hair: 'bob', hairCol: '#6a4430', eyes: 'open', child: true, skirt: 0.55, skirtCol: '#6a8ab8' };
  const GIRL = { tail: null };
  function drawGirl(ctx, x, y, t, game) {
    const P = game.player, look = P.x < x - 30 ? -1 : 1, near = Math.abs(P.x - x) < 260;
    const base = jointsOf('sitBox'), sw = Math.sin(t * 2.1) * 0.25, s = 0.84;
    const J = Object.assign({}, base);
    const kneeF = base.kneeF, kneeB = base.kneeB;
    J.ankF = { x: kneeF.x + Math.sin(sw) * 31, y: kneeF.y + Math.cos(sw) * 31 }; J.toeF = { x: J.ankF.x + 11, y: J.ankF.y + 2 };
    J.ankB = { x: kneeB.x + Math.sin(-sw * 0.8) * 31, y: kneeB.y + Math.cos(sw * 0.8) * 31 }; J.toeB = { x: J.ankB.x + 11, y: J.ankB.y + 2 };
    J.ha = base.ha + (near ? -0.12 : 0.05) + Math.sin(t * 1.3) * 0.03;
    // seat her hips on the ridge
    const oy = y - base.hip.y * s;
    // the scarf tail flutters in a wind that only exists in this memory
    const tx = x + base.chest.x * s * look, ty = oy + base.chest.y * s;
    if (!GIRL.tail) { GIRL.tail = new Rig.Chain(6, 6, 0.12, 0.86); GIRL.tail.reset(tx, ty); }
    GIRL.tail.update(tx, ty, -look, Math.min(0.05, game.dtVis || 0.016), 60 + Math.sin(t * 1.7) * 40, 2.2);
    const local = GIRL.tail.p.map((q) => ({ x: (q.x - x) / (s * look), y: (q.y - oy) / s }));
    person(ctx, x, oy, s, look, J, Object.assign({ scarf: M.scarf, tail: local }, GIRL_LOOK));
    // the music box in her lap
    const bx = x + (base.hdF.x + 3) * s * look, by = oy + (base.hdF.y + 1) * s;
    block(ctx, bx - 8, by - 9, 16, 10, { body: M.brass, lit: M.brassL, dark: M.brassD });
    poly(ctx, [[bx - 8, by - 9], [bx - 6 * look, by - 19], [bx + 9 * look, by - 18], [bx + 8, by - 9]]); ctx.fillStyle = M.wood; ctx.fill(); ink(ctx, 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; sprite(ctx, '255,226,170', bx, by - 6, 26, 0.45); ctx.restore(); ctx.globalAlpha = 1;
    // she hums: little notes drifting up toward the sunset
    ctx.fillStyle = 'rgba(255,236,200,0.9)';
    for (let i = 0; i < 3; i++) {
      const q = (t * 0.35 + i / 3) % 1, nx = bx + look * (8 + q * 40) + Math.sin(t * 2 + i) * 4, ny = by - 24 - q * 70;
      ctx.globalAlpha = Math.sin(q * PI) * 0.85;
      ctx.beginPath(); ctx.ellipse(nx, ny, 3, 2.2, -0.4, 0, TAU); ctx.fill(); ctx.fillRect(nx + 2.2, ny - 10, 1.2, 10);
    }
    ctx.globalAlpha = 1;
  }
  // Elaine Vega's fragment: a hologram Ode throws onto the boards — short dark hair, the long coat Rinne copied, the scar
  const VEGA_LOOK = { coat: '#3a7898', legs: '#2c5a7a', shoe: '#1e3a58', skin: '#c8f4ff', hair: 'short', hairCol: '#1e3a5a', eyes: 'open', long: true, lapel: true, scar: true, scarCol: '#ffffff' };
  function drawVega(ctx, x, y, t, game) {
    const F = game.save.flags, done = !!F.c8_vega_done, P = game.player;
    const face = P.x < x ? -1 : 1, flick = 0.86 + 0.14 * Math.sin(t * 23) * Math.sin(t * 3.7);
    const here = game.encState && game.encState.c8_e5 === 'cleared';
    if (!here) { ctx.save(); ctx.globalAlpha = 0.35 * flick; ctx.strokeStyle = 'rgba(160,240,255,0.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, y - 1, 24, 4, 0, 0, TAU); ctx.stroke(); ctx.restore(); return; }
    const a = (done ? 0.5 : 0.9) * flick;
    // emitter ring on the boards and a soft column of light
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    sprite(ctx, '150,240,255', x, y - 80, 110, 0.22 * flick);
    ctx.globalAlpha = 0.7 * flick; ctx.strokeStyle = 'rgba(160,240,255,0.9)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(x, y - 1, 34, 6, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y - 1, 22 + Math.sin(t * 3) * 3, 4, 0, 0, TAU); ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.save(); ctx.globalAlpha = a;
    const J = jointsOf('standHilt');
    person(ctx, x + Math.sin(t * 31) * (flick < 0.75 ? 2 : 0), y, 1.12, face, J, Object.assign({ sway: Math.sin(t * 1.4) * 3 }, VEGA_LOOK));
    ctx.restore();
    // scanlines over her
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(170,245,255,${0.12 * flick})`;
    for (let yy = y - 150; yy < y; yy += 4) ctx.fillRect(x - 30, yy + ((t * 30) % 4), 60, 1);
    ctx.restore();
  }

  /* =========================================================================================
     MUSIC — everything is built from Maestrina's theme (G.Music.THEME), and none of it finishes:
     every phrase of the exploration loses its last note, the heart plays only the first half, Mira's
     first phase stops at bar four, her second at bar six. Her third phase — and the true ending —
     finally play the whole song (music box + strings + choir) and resolve.
     Tracks may carry `c8x`: extra voices layered by the scheduler patch below (inert for every other track).
     ========================================================================================= */
  const THEME = (G.Music && G.Music.THEME) || [];
  const up = (mel, d) => mel.map(([s, m, l]) => [s, m + d, l]);
  const at = (mel, o) => mel.map(([s, m, l]) => [s + o, m, l]);
  const cut = (mel, a, b) => mel.filter(([s]) => s >= a && s < b);
  const MAJ = { 77: 78, 72: 73, 70: 71, 82: 83, 65: 66, 60: 61, 58: 59, 84: 85, 89: 90, 94: 95 };
  const major = (mel) => mel.map(([s, m, l]) => [s, MAJ[m] || m, l]);
  const GAPS = new Set([24, 60, 88, 112]);
  const THEME_HELD = THEME.filter(([s]) => !GAPS.has(s));            // every phrase stops one note short: a held breath
  // the chapter's own motif — "the breath": a rising sigh that stops on the dominant and never comes down
  const MOTIF = [[0, 69, 8], [8, 74, 4], [12, 76, 4], [16, 77, 12], [28, 76, 4], [32, 74, 8], [40, 72, 4], [44, 69, 4], [48, 70, 16],
    [64, 69, 8], [72, 74, 4], [76, 76, 4], [80, 77, 8], [88, 79, 8], [96, 79, 8], [104, 77, 4], [108, 76, 4], [112, 76, 16]];
  const chords = {
    c8D: [38, 62, 66, 69], c8G: [43, 62, 67, 71], c8Bm: [35, 62, 66, 71], c8Em: [40, 64, 67, 71], c8A: [33, 61, 64, 69],
  };
  const tracks = {
    // the wings and the bells: a music box alone on an empty stage
    c8_explore: { bpm: 58, chords: ['Dm', 'C', 'F', 'Bb', 'Dm', 'F', 'A', 'A'], melody: up(THEME_HELD, 12), mel: 'musicbox', melEvery: 2, pad: 'strings', arp: 'none', choir: 0.22, bass: 0, drums: 0 },
    // the staircase and the rooftop: the breath on felt piano, the theme answering in the cellos
    c8_explore2: { bpm: 64, chords: ['Dm', 'F', 'Dm', 'Bb', 'Dm', 'F', 'C', 'A'], melody: MOTIF, mel: 'piano', melEvery: 2, pad: 'strings', arp: 'harp', choir: 0.3, bass: 0.2, drums: 0, counter: true, counterLine: up(cut(THEME_HELD, 0, 64), -12) },
    // the heart: the music box plays the first half of the lullaby — and holds its breath for the second
    c8_heart: { bpm: 52, chords: ['Dm', 'C', 'F', 'Bb', 'Dm', 'F', 'A', 'A'], melody: up(cut(THEME, 0, 64), 12), mel: 'musicbox', melEvery: 1, pad: 'strings', arp: 'none', choir: 0.15, bass: 0, drums: 0 },
    // Descent I: Maestrina's first squad marches to her theme one last time
    c8_elite: { bpm: 122, chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Eb', 'A'], melody: up(THEME, -12), mel: 'brass', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 0.5, bass: 1, drums: 1, boss: true, timpani: true, counter: true, counterLine: MOTIF },
    // Mira I — a frightened child: four bars of the lullaby over the storm, then nothing
    c8_boss: { bpm: 132, chords: ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A'], melody: up(cut(THEME, 0, 64), 12), mel: 'musicbox', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 0.6, bass: 1, drums: 1, boss: true, timpani: true, counter: true, counterLine: MOTIF,
      c8x: [{ v: 'strings', notes: cut(THEME, 0, 64), vel: 0.05 }] },
    // Mira II — six bars now; still no cadence
    c8_boss2: { bpm: 140, chords: ['Dm', 'Eb', 'Dm', 'Eb', 'Gm', 'A', 'Bb', 'A'], melody: cut(THEME, 0, 96), mel: 'strings', melEvery: 1, pad: 'strings', arp: 'ostinato', choir: 1, bass: 1, drums: 1, boss: true, toms: true, timpani: true, counter: true, counterLine: MOTIF,
      c8x: [{ v: 'musicbox', notes: up(cut(THEME, 0, 96), 12), vel: 0.07, box: true }] },
    // Mira III — the shadow alone: the whole song at last, music box + strings + choir, landing on D major
    c8_boss3: { bpm: 116, chords: ['Dm', 'C', 'F', 'Bb', 'Dm', 'F', 'A', 'c8D'], melody: THEME, mel: 'strings', melEvery: 1, pad: 'strings', arp: 'harp', choir: 1, bass: 1, drums: 1, boss: true, timpani: true,
      c8x: [{ v: 'musicbox', notes: up(THEME, 12), vel: 0.08, box: true }, { v: 'choir', notes: cut(THEME, 64, 128), vel: 0.05 }] },
    // ENDING A — sung together: once as it was written (D minor), once as it was meant (D major)
    c8_end_a: { bpm: 64, chords: ['Dm', 'C', 'F', 'Bb', 'Dm', 'F', 'A', 'Dm', 'c8D', 'c8G', 'c8Bm', 'c8G', 'c8D', 'c8Em', 'c8A', 'c8D'],
      melody: up(THEME, 12).concat(at(up(major(THEME), 12), 128)), mel: 'musicbox', melEvery: 1, pad: 'strings', arp: 'harp', choir: 0.75, bass: 0.3, drums: 0,
      c8x: [{ v: 'strings', notes: THEME.concat(at(major(THEME), 128)), vel: 0.055 }, { v: 'choir', notes: at(major(THEME), 128), vel: 0.045 }] },
    // ENDING B — the world sings again in D major; the last note is missing (hers)
    c8_end_b: { bpm: 54, chords: ['c8D', 'c8Bm', 'c8G', 'c8A', 'c8D', 'c8Bm', 'c8G', 'c8A'], melody: major(THEME).filter(([s]) => s !== 112), mel: 'strings', melEvery: 1, pad: 'strings', arp: 'none', choir: 0.35, bass: 0, drums: 0,
      c8x: [{ v: 'musicbox', notes: up(cut(major(THEME), 0, 64), 12), vel: 0.05, every: 2 }] },
    // ENDING C — the fermata: the box runs down; the leading tone is held forever and never resolves
    c8_end_c: { bpm: 44, chords: ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A'], melody: up([[0, 74, 8], [16, 77, 8], [32, 81, 16], [56, 79, 8], [72, 77, 12], [96, 76, 8], [108, 73, 20]], 12), mel: 'musicbox', melEvery: 1, pad: 'strings', arp: 'none', choir: 0.2, bass: 0, drums: 0 },
  };
  // scheduler patch: c8x voices ride on the live score; the credits keep an ending's own theme. Both inert for other tracks.
  (function patchMusic() {
    const Mu = G.Music; if (!Mu || Mu._c8) return; Mu._c8 = true;
    const sched = Mu.schedule, play = Mu.play;
    Mu.schedule = function (step, t, spb) {
      sched.call(this, step, t, spb);
      const d = this.def; if (!d || !d.c8x) return;
      const A = G.AudioKit, Lr = this.layers, loop = d.chords.length * 16, ls = step % loop, cyc = Math.floor(step / loop);
      for (const line of d.c8x) {
        if (line.every && cyc % line.every !== line.every - 1) continue;
        for (const [st, m, len] of line.notes) {
          if (st !== ls) continue;
          const f = A.mtof(m), dur = len * spb * 0.95;
          if (line.v === 'musicbox') A.bell(f, t, line.vel || 0.08, 1.8, 0, 0.4, Lr.mel);
          else if (line.v === 'strings') A.stringVoice(f, t, dur, line.vel || 0.06, Lr.mel, 1600);
          else if (line.v === 'choir') A.choirVoice(f, t, dur, line.vel || 0.06, Lr.choir);
          else if (line.v === 'piano') A.pianoVoice(f, t, line.vel || 0.16, Lr.mel, 2.4);
        }
      }
    };
    Mu.play = function (name) {
      if (name === 'ending' && this.track && /^c8_end_/.test(this.track) && G.game && G.game.state === 'ending') return;
      return play.call(this, name);
    };
  })();
  const ambience = {
    c8_wings: { bed: [0.2, 0.05, 0, 0.28], gap: [3, 5], evt(t, A) {
      const r = Math.random();
      if (r < 0.4) A.tone('sine', 120 + Math.random() * 50, t, 0.25, 0.018, 1.1, { to: 92, wet: 0.7 });
      else if (r < 0.78) A.bell(A.mtof([86, 89, 93, 81][Math.floor(Math.random() * 4)]), t, 0.014, 2.6, 0.9, 0.3);
      else A.tone('sine', 60, t, 0.6, 0.008, 2.2, { wet: 0.4 });
    } },
    c8_memory: { bed: [0.28, 0.09, 0, 0.2], gap: [2.5, 4.5], evt(t, A) {
      const r = Math.random();
      if (r < 0.3) A.bell(A.mtof(50), t, 0.022, 4.5, 0.95, 0.6);
      else if (r < 0.55) A.noise(t, 1.4, 0.018, 2.2, 'bandpass', 700, 300, 0.6, 0.7);
      else if (r < 0.85) [74, 77, 81].forEach((m, i) => A.tone('triangle', A.mtof(m), t + i * 0.42, 0.08, 0.01, 0.5, { wet: 0.85 }));
      else A.bell(A.mtof(98), t, 0.01, 1.6, 1, 0.2);
    } },
    c8_heart: { bed: [0.12, 0.03, 0, 0.5], gap: [1.6, 2.6], evt(t, A) {
      const r = Math.random();
      if (r < 0.5) for (let i = 0; i < 3; i++) A.noise(t + i * 0.16, 0.001, 0.02, 0.04, 'highpass', 3200);
      else if (r < 0.8) A.tone('sine', 55, t, 2, 0.02, 3, { wet: 0.5 });
      else A.bell(A.mtof(86), t, 0.012, 2, 0.9, 0.3);
    } },
  };
  const sfx = {
    c8_memoryFlash(t) { const A = G.AudioKit; [74, 81, 86, 93].forEach((m, i) => A.bell(A.mtof(m), t + i * 0.08, 0.05, 2.2, 0.8, 0.6)); A.noise(t, 0.9, 0.04, 0.2, 'highpass', 2500, 7000, 0.7, 0.6); },
    c8_bellToll(t, v = 1) { const A = G.AudioKit; A.bell(A.mtof(50), t, 0.13 * v, 4.5, 0.6, 0.9); A.bell(A.mtof(50) * 1.013, t, 0.06 * v, 3.5, 0.6, 0.5); A.noise(t, 0.002, 0.05 * v, 0.12, 'lowpass', 800); },
    c8_belfryToll(t, v = 1) { const A = G.AudioKit; A.bell(A.mtof(43), t, 0.15 * v, 6.5, 0.7, 0.8); A.bell(A.mtof(55), t, 0.05 * v, 4, 0.7, 0.5); A.noise(t, 0.002, 0.06 * v, 0.15, 'lowpass', 600); },
    c8_ignite(t, v = 1) { const A = G.AudioKit; A.tone('sine', 240, t, 0.004, 0.03 * v, 0.25, { to: 900 }); A.noise(t, 0.001, 0.04 * v, 0.05, 'highpass', 4000); },
    c8_sunCrack(t) { const A = G.AudioKit; A.noise(t, 0.002, 0.22, 0.7, 'highpass', 1800, 6000, 1, 0.5); A.tone('sine', 62, t, 0.01, 0.2, 2.6, { to: 31 }); A.bell(A.mtof(98), t + 0.15, 0.05, 3, 0.9, 0.5); },
    c8_exhale(t) { const A = G.AudioKit; A.noise(t, 0.9, 0.07, 2.6, 'lowpass', 1400, 280, 0.7, 0.6); },
    c8_choirSwell(t) { const A = G.AudioKit; for (const m of [62, 66, 69, 74]) A.choirVoice(A.mtof(m), t, 3.2, 0.035, A.sfxBus); },
    c8_boxStop(t) { const A = G.AudioKit; [86, 83, 81, 79, 77, 76].forEach((m, i) => A.bell(A.mtof(m), t + i * 0.22 + i * i * 0.09, 0.05 * (1 - i * 0.12), 1.8, 0.7, 0.4)); },
    c8_doorCreak(t) { const A = G.AudioKit; A.tone('sawtooth', 85, t, 0.35, 0.018, 0.9, { to: 150, filter: 'bandpass', ff: 700, q: 3 }); },
    c8_holo(t) { const A = G.AudioKit; A.tone('sine', 880, t, 0.01, 0.025, 0.5, { to: 1320, wet: 0.5 }); A.noise(t, 0.002, 0.03, 0.3, 'bandpass', 3000, 5000, 2, 0.4); },
  };

  /* =========================================================================================
     STORY DATA
     ========================================================================================= */
  const data = {
    speakers: {
      c8_mira: { name: '厄蕾絲', en: 'ERESH', color: '#ffd2dc' },
      c8_girl: { name: '沒有名字的女孩', en: 'THE GIRL WITH NO NAME', color: '#ffb59a' },
      c8_barrow: { name: '老鐸（回憶）', en: 'OLD DOR — REMEMBERED', color: '#e8c9a0' },
      c8_trio: { name: '三判官', en: 'THE THREE JUDGES', color: '#f2d38a' },
    },
    hints: {
      c8_stairs: '<b>光之階梯</b>可以從下方 {jump} 穿過去站上；站在上面時按住「下」再按 {jump} 就能落下',
      c8_secret: '冰封的岩棚一路往上——懸浮的鐘樓上，好像有東西在發光',
    },
    barks: {
      c8_ghost: { who: 'ode', text: '……空舞台上，留著一盞燈。' },
      c8_memoryFoe: { who: 'ode', text: '……是記憶。冥界記得每一場仗。' },
      c8_belfryRing: { who: 'ode', text: '……整座冥界，只有這口鐘還在響。' },
      c8_belfryMute: { who: 'ode', text: '鐘結了冰。在這裡，它也是啞的。' },
      c8_belfry: { who: 'ode', text: '鐘結了冰。在這裡，它也是啞的。' },
      c8_island: { who: 'ode', text: '……那三道目光，在上面。' },
      c8_door: { who: 'ode', text: '……等一下。燈裡，有人想見妳。' },
      c8_taliaAfter: { who: 'ode', text: '……她把笑聲，藏進了燈油裡。' },
      c8_e5clear: { who: 'ode', text: '……安靜了。這一次，是我們讓它安靜的。' },
    },
    dialog: {
      c8_enter: [
        { who: 'sys', text: '（第七道門。門後沒有守門人，只有三道目光。它們看了妳一眼，妳就死了。）' },
        { who: 'sys', text: '（妳被掛在宮殿的鉤子上，掛了三天。第三天，一盞燈飄進來，帶著一口糧、一口水。）' },
        { who: 'ode', text: '……醒來。' },
        { who: 'sys', text: '（宮殿的最高處，有一只音樂盒在響。只有上半段。）' },
        { who: 'rinne', text: '（妳站起來。）' },
      ],
      c8_hush: [
        { who: 'sys', text: '（前方有小小的人影。沒有臉，雙手死死摀著嘴。）' },
        { who: 'rinne', text: '（不是孩子。是沒能出生的孩子。）' },
      ],
      c8_bellMem: [
        { who: 'sys', text: '（鐘聲。在不可能有聲音的地方。）' },
        { who: 'rinne', text: '（王城的鐘。在這裡，不該聽得見。）' },
        { who: 'sys', text: '（每天黃昏，有人在這裡敲鐘，好讓一個愛爬屋頂的女孩知道該回家。有人從底下，聽了很多年。）' },
      ],
      c8_barrowTalk: [
        { who: 'c8_barrow', text: '諾娜——天快黑了，下來吃飯。' },
        { who: 'c8_barrow', text: '……又躲到屋頂上了吧。爹再敲一次。聽到了，就知道路在哪裡。' },
        { who: 'sys', text: '（他看不見妳。這是很多年前，某一個黃昏。）' },
      ],
      c8_barrowAgain: [
        { who: 'c8_barrow', text: '一、二、三……數到一百，就要回家喔。爹會一直敲，敲到妳回來。' },
      ],
      c8_vista: [
        { who: 'sys', text: '（腳邊的燈一盞盞亮起，沿著宮殿邊緣，一路亮到看不見的高處。）' },
        { who: 'sys', text: '（四周漂著島：王城、山門、礦道、劇場、倒懸之塔、渡魂船。走過的每一道門，這裡都記得。）' },
        { who: 'rinne', text: '她在等。' },
      ],
      c8_roof: [
        { who: 'sys', text: '（夕陽。整座冥界裡，唯一有顏色的天空。顏色塗錯了。）' },
        { who: 'sys', text: '（屋頂上，坐著一個小女孩。）' },
        { who: 'rinne', text: '（紅色的圍巾。大得不像是她的。像是從上面撿來的。）' },
      ],
      c8_girlTalk: [
        { who: 'c8_girl', text: '……妳也是來看夕陽的嗎？' },
        { who: 'c8_girl', text: '這是我畫的。上面的夕陽，是這個顏色嗎？' },
        { who: 'rinne', text: '（妳蹲下來，看著她。）' },
        { who: 'c8_girl', text: '……妳想問我的名字嗎？沒有人替我取。' },
        { who: 'c8_girl', text: '上面每天黃昏，都有人敲鐘叫一個女孩回家。我每天都在聽。' },
        { who: 'c8_girl', text: '從來沒有人，敲鐘叫我。' },
        { who: 'rinne', text: '（妳伸出手。）' },
        { who: 'c8_girl', text: '要帶我上去嗎？那妳要答應我——' },
        { who: 'c8_girl', text: '如果有一天，門真的打開了……妳要唱歌給我聽。這樣我就不怕了。' },
      ],
      c8_girlAgain: [
        { who: 'c8_girl', text: '♪ 睡吧，燈會替妳數星星——……後面我不會。只聽人唱過一次，只有上半段。' },
      ],
      c8_eliteIntro: [
        { who: 'sys', text: '（高台上站著三個人。面具底下沒有臉。一人執旗，一人執鼓，一人執鐘。）' },
        { who: 'c8_trio', text: '第七個女兒。我們判過妳了。' },
        { who: 'c8_trio', text: '妳死過一次。為什麼還站著。' },
        { who: 'rinne', text: '（妳身旁，燈火亮了一下。）' },
        { who: 'c8_trio', text: '……那就再判一次。' },
      ],
      c8_eliteDefeat: [
        { who: 'c8_trio', text: '……判決，收回。' },
        { who: 'c8_trio', text: '十八年。我們判了十八年的死，一個人也沒有走進來。' },
        { who: 'rinne', text: '（妳抬頭，看向更高的地方。）' },
        { who: 'c8_trio', text: '……要去那裡嗎。三判官，退庭。' },
        { who: 'sys', text: '（三人同時垂下了目光。然後，像布幕落下一樣，靜靜地消失了。）' },
      ],
      c8_summit: [
        { who: 'sys', text: '（最後一層。巨大的音樂盒在黑色的太陽下緩緩轉著，只唱上半段。）' },
        { who: 'sys', text: '（妳走過的每一道門、每一個對手，都在這裡等著。）' },
        { who: 'rinne', text: '最後一次。' },
      ],
      c8_vegaTalk: [
        { who: 'sys', text: '（寧舒的燈火一晃，在地上投出一個人影——束著髮，佩著刀，衣角燒焦了一塊。）' },
        { who: 'vega', text: '……又見面了。' },
        { who: 'rinne', text: '（妳想叫她。叫不出聲。）' },
        { who: 'vega', text: '上次，妳沒等我說完。沒關係。妳的刀一向比心快。……剩下的，只有一句。' },
        { who: 'vega', text: '門後的那個人，是我們的大姊。她生下來，就沒有呼吸過。' },
        { who: 'vega', text: '我走到第六道門，就忘了自己是來救人的。只好把最後一句話，留給一盞燈。' },
        { who: 'ode', text: '……我有名字。' },
        { who: 'vega', text: '抱歉，寧舒。——小妹。「走到底」，從來不是要妳一個人走。' },
        { who: 'vega', text: '去吧。不管妳選哪條路，我都在。' },
      ],
      c8_vegaAgain: [
        { who: 'sys', text: '（她把手放在妳的肩上。光沒有重量，但妳感覺得到。）' },
        { who: 'vega', text: '別回頭。走到底。' },
      ],
      c8_pylon1: [
        { who: 'sys', text: '（魂燈台。燈火裡，妲莉的聲音斷斷續續。）' },
        { who: 'talia', text: '……（燈花爆了一下）……還……？……燈……亮著……' },
        { who: 'rinne', text: '告訴她，我還在走。' },
      ],
      c8_pylon2: [
        { who: 'sys', text: '（最後一座魂燈台。燈火很低。）' },
        { who: 'ode', text: '我也這樣帶過另一位公主。帶回來三次。第四次，她不記得要醒。' },
        { who: 'rinne', text: '（妳握住了燈。）' },
      ],
      c8_apologyAfter: [
        { who: 'rinne', text: '（「下半段，我一直沒能唱完。」）' },
      ],
      c8_odeAfter: [
        { who: 'ode', text: '……那些灰，不存在。' },
        { who: 'rinne', text: '……' },
        { who: 'ode', text: '……妳的呼吸，慢了一點。妳在笑嗎。' },
      ],
      c8_bossIntro: [
        { who: 'sys', text: '（音樂盒前坐著一個女孩，抱著膝蓋。她的背後，有一道比天空還大的影子。）' },
        { who: 'c8_mira', text: '……噓。' },
        { who: 'c8_mira', text: '父王的第七個女兒。我看著他，把妳放進木箱。' },
        { who: 'c8_mira', text: '我是第一個。生下來就沒有呼吸。他連名字，都沒有給我。' },
        { who: 'rinne', text: '（妳握緊了刀。）' },
        { who: 'c8_mira', text: '他不要女兒。那就讓他永遠死不了。' },
        { who: 'sys', text: '（影子張開雙臂，把整座宮殿擁進懷裡。）' },
        { who: 'c8_mira', text: '……妳不該來的。' },
      ],
      c8_bossDefeat: [
        { who: 'sys', text: '（影子散開，像潑進水裡的墨。音樂盒前只剩一個跪著的身影，縮成小小的一團。）' },
        { who: 'c8_mira', text: '……好累。' },
        { who: 'c8_mira', text: '十八年。我一直在等他往下看一眼。他一次都沒有。' },
        { who: 'rinne', text: '（妳在她面前跪下。）' },
        { who: 'c8_mira', text: '……嗯。妳來了。' },
        { who: 'sys', text: '（音樂盒底下，有一口井。井裡的水，是亮的。）' },
      ],
      // epilogue placeholders (rebuilt from the save's flags when an ending begins)
      c8_endA1: [{ who: 'rinne', text: '（妳在大姊身邊坐下。）' }],
      c8_endA3: [{ who: 'c8_mira', text: '……門，開了。' }],
      c8_endB1: [{ who: 'rinne', text: '（妳伸出手。）' }],
      c8_endB3: [{ who: 'ode', text: '……門，開了。' }],
      c8_endC1: [{ who: 'rinne', text: '（妳搖頭。）' }],
      c8_endC2: [{ who: 'c8_mira', text: '……水的聲音。' }],
    },
    codex: {
      people: [
        { id: 'c8_mira', name: '冥后・厄蕾絲', en: 'ERESH, QUEEN OF THE DEAD', portrait: 'c8_girl', unlock: 'c8_boss_seen', tag: '冥界之主｜溫陀王的第一個女兒',
          body: ['溫陀王的第一個女兒。生下來就沒有呼吸，父親沒有替她取名字，讓人把小小的棺木抬進了冥界。', '她在冥界長大。亡者一個一個被叫著名字走進門，只有她站在門口等，等到自己成了替所有人關門的人。從來沒有人為她唱過一首歌。', '十八年前，她看見父親把第七個女兒放進木箱，推進大海。那一天，她關上了門。'] },
        { id: 'c8_descent1', name: '三判官', en: 'THE THREE JUDGES', unlock: 'c8_elite_seen', tag: '冥后宮殿的審判者',
          body: ['坐在第七道門後的三位判官。一人執旗，一人執鼓，一人執鐘。', '他們的眼睛是「死亡之眼」：被看一眼的人，就會死。十八年來門關著，他們一個人也沒有判過。', '直到一個沒有名字的女孩，自己走了進來。'] },
      ],
      world: [
        { id: 'c8_heart', name: '冥后宮殿', en: 'THE PALACE OF THE DEAD QUEEN', unlock: 'c8_arrived',
          body: ['冥界的最底層。宮殿沒有牆，只有一座望不到盡頭的白色舞台，白得像一張還沒寫上名字的紙。', '所有沒被叫出口的名字，都收在這裡。生命之水也在這裡。十八年來，沒有人來取。'] },
        { id: 'c8_blacksun', name: '黑色的太陽', en: 'THE BLACK SUN', unlock: 't_c8_t_vista',
          body: ['掛在冥后宮殿上空的日蝕。光被它吃掉，只剩一圈白色的日冕。', '亡者叫它「死亡之眼」。越往宮殿的高處走，它就越大、越近——像一口從來沒有吸進去的氣。'] },
        { id: 'c8_islands', name: '記憶之島', en: 'ISLANDS OF MEMORY', unlock: 't_c8_t_vista',
          body: ['漂浮在宮殿四周的島：王城的街、雪嶺的山門、回頭的礦道、溺死者的劇場、倒懸之塔、渡魂船的桅杆。', '妳走過的每一道門，冥界都記得。光之階梯把它們串在一起，一路通往黑色的太陽。'] },
        { id: 'c8_ghostlight', name: '鬼燈', en: 'THE GHOST LIGHT', unlock: 't_c8_t_ghost',
          body: ['劇場的老規矩：散場之後，舞台上要留一盞沒有燈罩的燈，讓舞台永遠不會完全變暗。', '冥后的舞台上，也有人留了一盞。沒有人知道是誰。燈座上，有一道很舊的焦痕。'] },
        { id: 'c8_musicbox', name: '巨大的音樂盒', en: 'THE GREAT MUSIC BOX', unlock: 'c8_boss_seen',
          body: ['立在最後一層正中央的音樂盒。蓋子內側畫著人間的夕陽，鐘塔的屋頂上，一個男人牽著一個圍紅圍巾的女孩。畫的人沒看過夕陽，顏色塗錯了。', '銅牌上刻著：「給沒有名字的孩子」。它的滾筒只轉得完上半段——下半段的針，一根都沒有。'] },
        { id: 'c8_endA', name: '終章　歸還', en: 'ENDING A — RETURN', unlock: 'ending_encore',
          body: ['巴里帶著生命之水回到人間。王與王后醒來，冥界的七道門重新打開。', '冥界要一個人來換。第一次跪下來道歉的國王，自己走下了冥界。'] },
        { id: 'c8_endB', name: '終章　引魂', en: 'ENDING B — THE GUIDE', unlock: 'ending_solo',
          body: ['巴里把生命之水交給寧舒帶上去，自己留在冥界，成為替亡者領路的人。', '厄蕾絲第一次走出冥界，去過她從沒過過的人生。'] },
        { id: 'c8_endC', name: '終章　安息', en: 'ENDING C — REPOSE', unlock: 'ending_fermata',
          body: ['巴里把生命之水倒進乾涸的冥河。沒有人復活；所有寂裔終於得以入冥安息，國王也在其中。', '冥河邊，兩姊妹並肩坐著，誰也沒有說話。'] },
      ],
      notes: [
        { id: 'c8_n1', name: '王后的歌', en: "THE QUEEN'S LULLABY", body: [
          '給我的第一個孩子：',
          '妳生下來的那天，沒有哭。產婆說，沒有呼吸的孩子，不算數。妳父王點了點頭，就走了。',
          '他們不讓我替妳取名字。他們說，取了名字，就要記得。',
          '我替妳寫了一首歌，叫〈給沒有名字的孩子〉。只寫完上半段，只唱了一次，箱子就被抬走了。',
          '後來我又生了六個女兒。每一個，我都唱完了整首。只有妳，我一直欠著。',
          '下半段，我一直沒能唱完。',
          '如果有人去找妳，請她替我唱完。　——溫陀王后'] },
        { id: 'c8_n2', name: '棺木板上的字', en: 'WORDS ON A COFFIN BOARD', body: [
          '（一片小小的棺木板。上面用炭寫著字，字很大，像剛學會寫字。）',
          '今天又有人下來了。他們都有名字。守門的人一個一個叫，叫到的就進門。',
          '沒有人叫我。我站在門口等，等到門都關了。',
          '上面每天黃昏都有人敲鐘，叫一個女孩回家。我數過，他敲一百下。',
          '我想知道，被叫回家是什麼感覺。',
          '如果我一直不讓他們進來，上面的人，是不是就會一直叫？'] },
        { id: 'c8_n3', name: '妲莉的紙條', en: "DALI'S NOTE", body: [
          '（一張纏在燈芯上的小紙條。字寫得很小，怕佔掉燈芯的位置。）',
          '我不知道妳收不收得到。燈芯只有一根，我只好把字寫得很小、很小。',
          '妳走得越深，燈就越暗。所以我在每一座燈台的油裡，偷偷加了一點東西。',
          '是我的笑聲。我只剩這個了。只要妳還碰得到燈台，燈裡就有人在笑。',
          '快點回來。我想知道外面的花長什麼樣子。我已經跟大家說了，妳會帶一朵下來。',
          '　——妲莉'] },
        { id: 'c8_n4', name: '燈芯的灰', en: "ASH FROM NINSHU'S WICK", body: [
          '（魂燈裡燒落的灰。排起來，像字。）',
          '燈不會寫字。所以，這些字不存在。',
          '第一次（雪嶺山門）：妳死了。我把妳帶回燈台。妳醒來的時候，什麼都沒問。',
          '第二次：妳醒來，先摸了一下刀。我記下來了。',
          '第二十七次：燈裡住著一個人，她不說話。她一直在看妳握刀的樣子。',
          '第 ??? 次：冥界沒有日夜。我改用妳的呼吸計時。很穩。',
          '給以前的我：那位公主最後一次沒有醒，不是你的錯。',
          '給妳：我不會唱歌。可是我會數。一、二、三……妳只要跟著醒來就好。'] },
        { id: 'c8_n5', name: '判決簿・最後一頁', en: 'THE BOOK OF JUDGEMENT — LAST PAGE', body: [
          '（三判官的判決簿。前面十八年，每一頁都只寫著同一行。）',
          '本年。入冥者：無。',
          '本年。入冥者：無。',
          '本年。入冥者：一名。名字：無。女。生者。',
          '判決：死。',
          '（底下另一種筆跡，很淡，像燈火燒出來的：「判決，三日後失效。」）',
          '退庭。'] },
      ],
    },
    relics: {},
  };
  if (!G.DATA.speakers.c6_cantor) data.speakers.c6_cantor = { name: '渡魂船之心', en: 'HEART OF THE FERRY', color: '#ffe6a6' };
  // the elite's relic belongs to the foes author; keep a fallback so its drop can never break
  if (!G.DATA.relics.c8_banner) data.relics.c8_banner = { name: '判官之旗', desc: '最大生命 +15；處決後回復 10 生命' };
  if (!G.Relics.c8_banner) G.Relics.c8_banner = { apply(P2) { P2.maxHp += 15; } };
  if (G.UI && G.UI.portraits) G.UI.portraits.c8_girl = (ctx, W, H, game) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const gr = ctx.createRadialGradient(W * 0.64, H * 0.36, 8, W * 0.64, H * 0.36, W * 0.75);
    gr.addColorStop(0, 'rgba(255,224,170,0.95)'); gr.addColorStop(0.18, 'rgba(255,160,110,0.55)'); gr.addColorStop(0.6, 'rgba(120,50,90,0.25)'); gr.addColorStop(1, 'rgba(40,20,40,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(3.3, 0, 0, 3.3, W / 2, H * 0.62);
    ctx.fillStyle = '#7a3a30'; ctx.fillRect(-70, -4, 140, 9); ctx.fillStyle = '#e89a7a'; ctx.fillRect(-70, -4, 140, 2);
    ctx.fillStyle = '#9a4a38'; ctx.beginPath(); ctx.moveTo(-74, 5); ctx.lineTo(74, 5); ctx.lineTo(90, 60); ctx.lineTo(-90, 60); ctx.closePath(); ctx.fill();
    const keep = GIRL.tail; GIRL.tail = GIRL.ptail || null;
    drawGirl(ctx, 0, 0, (game && game.realTime) || 1, { player: { x: 999 }, dtVis: 0.016, save: { flags: {} } });
    GIRL.ptail = GIRL.tail; GIRL.tail = keep;
  };

  /* =========================================================================================
     DIALOGUE THAT REMEMBERS — lines rebuilt from the save's flags (everything Rinne did on the way)
     ========================================================================================= */
  const DD = G.DATA.dialog;
  const say = (who, text) => ({ who, text });
  function buildDialogs(F) {
    // Barrow, remembered: the music box on his crate if it ever came home
    const bt = [say('c8_barrow', '諾娜——天快黑了，下來吃飯。'), say('c8_barrow', '……又躲到屋頂上了吧。爹再敲一次。聽到了，就知道路在哪裡。'),
      say('sys', '（他看不見妳。這是很多年前，某一個黃昏。）')];
    if (F.gave_musicbox) bt.push(say('sys', '（他腳邊的木箱上，擱著那只音樂盒。記憶，跟著人間改變了。）'), say('rinne', '（她會知道的。爹還在等。）'));
    else if (F.got_musicbox) bt.push(say('sys', '（那只音樂盒，還在妳的行囊裡。他還不知道。）'), say('rinne', '……'));
    else bt.push(say('sys', '（他身邊沒有音樂盒。它大概還躺在王城的某個屋頂上。）'));
    bt.push(say('c8_barrow', '（他又拉了一次鐘繩。裂開的鐘，用它唯一會的那個音，喊著同一個名字。）'));
    DD.c8_barrowTalk = bt;
    // Elaine Vega, through Ode
    const vt = [DD.c8_vegaTalk[0], say('vega', '……又見面了。'), say('rinne', '（妳想叫她。叫不出聲。）')];
    if (F.c7_listened) vt.push(say('vega', '上次，妳讓我把話說完了。……所以這一次，只說一件事。'));
    else vt.push(say('vega', '上次，妳沒等我說完。沒關係。妳的刀一向比心快。……剩下的，只有一句。'));
    vt.push(say('vega', '門後的那個人，是我們的大姊。她生下來，就沒有呼吸過。'),
      say('vega', '我走到第六道門，就忘了自己是來救人的。只好把最後一句話，留給一盞燈。'),
      say('ode', '……我有名字。'),
      say('vega', '抱歉，寧舒。——小妹。「走到底」，從來不是要妳一個人走。'),
      say('vega', '去吧。不管妳選哪條路，我都在。'));
    DD.c8_vegaTalk = vt;
    // the pylon band: Talia if her bell rings again; CANTOR if the Ark woke
    if (F.c2_quest_done) DD.c8_pylon1 = [
      say('talia', '……妳還在嗎？燈好暗——'),
      say('talia', '山上的門鐘，剛剛自己響了一聲。大家都跑出來看。……我覺得，那是妳。'),
      say('rinne', '（妳把燈舉高了一點。）'),
      say('talia', '……好暗。算了，我不問。我會怕。'),
      say('talia', '不管妳在哪裡，燈都在妳後面。')];
    if (F.c6_spared) DD.c8_pylon2 = [
      say('c6_cantor', '第七位公主。這裡是渡魂船。'),
      say('c6_cantor', '船上的亡者，都在看妳往下走。他們不知道妳是誰，只知道妳替他們走。'),
      say('c6_cantor', '門開的時候，整艘船都會來接。'),
      say('rinne', '……謝謝。')];
  }
  function buildEpilogue(F, kind) {
    if (kind === 'encore') {
      const a1 = [say('rinne', '（妳在大姊身邊坐下。）'), say('rinne', '（妳張開嘴。沒有聲音。）'),
        say('c8_mira', '……妳也沒有聲音了嗎。從來沒有人唱給我聽過。我只聽過上半段。')];
      if (F.c4_quest_done) a1.push(say('sys', '（妳攤開從劇場找回的那份樂譜：〈給沒有名字的孩子〉。上半段是王后的筆跡。下半段，溺死的人替她寫完了。）'));
      else a1.push(say('sys', '（下半段，妳其實聽過。在島上，在很小的時候。妳只是忘了自己還記得。）'));
      if (F.c5_quest_done) a1.push(say('rinne', '（妳指向上面。倒懸之塔上的燈，都還亮著。）'), say('c8_mira', '……燈。（她好像懂了。笑了，很小聲。）'));
      a1.push(say('rinne', '（沒有聲音。妳還是唱了。）'), say('c8_mira', '……♪ 睡吧，燈會替妳數星星——'));
      DD.c8_endA1 = a1;
      DD.c8_endA2a = [say('sys', '（很遠的地方，一口裂開的鐘響了。一聲、兩聲——是王城。）'), say('barrow', '諾娜——天黑了，該回家了。')];
      DD.c8_endA2b = [say('talia', '……燈台的火，自己亮了。不是我點的。是妳吧？')];
      DD.c8_endA2c = [say('c6_cantor', '渡魂船，起錨。……十八年份的亡者，請上船。')];
      DD.c8_endA2d = [say('sys', '（無數的聲音接上了旋律。走音的、沙啞的、太小聲的。沒有一個是完美的。）'),
        say('rinne', '♪ 睡吧，浪會記得回家的路——'), say('c8_mira', '♪ ……天亮的時候，有人叫妳的名字。'),
        say('sys', '（那是妳的聲音。它回來了。旋律底下，還有一個男人的聲音，很遠，很輕。像在說對不起。）')];
      const a3 = [say('sys', '（厄蕾絲吐出一口氣。這輩子的第一口氣。）'), say('sys', '（黑色的太陽裂開了。裂縫裡，是早晨。）'),
        say('c8_mira', '……門，開了。'), say('c8_mira', '小妹。把水帶上去。……他在等妳。'),
        say('ode', '……燈裡的那一位，要走了。'), say('vega', '……走到底了呢。')];
      a3.push(F.c7_listened ? say('vega', '上一次，妳讓我把話說完。這一次，換我聽妳唱。……很難聽。可是很好。')
        : say('vega', '上一次妳沒等我說完。沒關係。要說的，只剩這一句。'));
      a3.push(say('vega', '回去吧。現在，可以回頭了——有很多人，在等妳回家。'), say('rinne', '……六姊。我走到了。'),
        say('ode', '……她走了。最後留下的，是那句沒說完的話——「早飯要吃。」'));
      DD.c8_endA3 = a3;
    } else if (kind === 'solo') {
      DD.c8_endB1 = [say('rinne', '（妳伸出手。）'), say('c8_mira', '……妳要什麼？'), say('rinne', '（妳指了指她身後的影子，再指了指自己。）'),
        say('c8_mira', '那樣，妳就再也回不去了。再也看不到夕陽。'), say('rinne', '（妳笑了一下。夕陽是什麼顏色，妳早就忘了。）'),
        say('ode', '……公主。'), say('rinne', '（妳把水瓶，放進燈火裡。）')];
      DD.c8_endB2 = [say('sys', '（影子離開了厄蕾絲，像一件太大的斗篷，落在妳的腳下。很重。妳又有了影子。）'), say('c8_mira', '……小妹。'),
        say('rinne', '（妳替她把圍巾繫好，指了指上面。）'), say('sys', '（從這一刻起，每一個走下冥界的人，都會在門口看見一盞燈。）')];
      const b3 = [say('ode', '……門，開了。死去的人，有地方去了。')];
      if (F.c2_quest_done) b3.push(say('talia', '……燈台的火，全亮了。可是妳那邊，怎麼這麼安靜？……還在嗎？'));
      if (F.c6_spared) b3.push(say('c6_cantor', '渡魂船，聽候妳的吩咐。每一天，每一個黃昏。'));
      b3.push(F.c7_listened ? say('vega', '傻孩子。我要妳走到底，可沒要妳留在底下。……可是，我懂。我也是這樣的人。')
        : say('ode', '……燈裡的那一位，沒有說話。我想，她是不忍心。'));
      b3.push(say('barrow', '……妳是誰家的孩子？……天黑了。跟我回家吧。'));
      b3.push(say('ode', '我把水帶上去，再回來。總得有人替妳提燈。'));
      DD.c8_endB3 = b3;
    } else {
      DD.c8_endC1 = [say('sys', '（妳跪下，把生命之水倒進乾涸的冥河。水碰到河床，沒有聲音。）'), say('c8_mira', '……妳不帶回去？'),
        say('rinne', '（妳搖頭。）'), say('rinne', '（河床上，寂裔排成很長的隊。他們等了十八年。）'), say('c8_mira', '父王，也會死。'), say('rinne', '（妳點頭。）'),
        say('ode', '……那我也留下。河邊，總要有一盞燈。')];
      const c2 = [say('sys', '（音樂盒的發條轉到了盡頭。最後一個音停在半空，沒有落下。）'), say('sys', '（河床上，水開始流。）'), say('c8_mira', '……水的聲音。原來是這樣。')];
      c2.push(F.c7_listened ? say('vega', '……這樣也好。我也可以走了。')
        : say('ode', '……燈裡，很安靜。像有人睡著了。'));
      if (F.c2_quest_done) c2.push(say('talia', '……燈台的火，一盞一盞熄了。不是壞掉。是大家都到了。'));
      if (F.c6_spared) c2.push(say('c6_cantor', '渡魂船，最後一航。甲板上，一個空位也沒有。'));
      c2.push(say('sys', F.gave_musicbox ? '（很遠、很遠的地方，王城的鐘響了最後一聲。然後，是很長、很長的安靜。）' : '（很遠、很遠的地方，有一口鐘響了一聲。然後，是很長、很長的安靜。）'));
      DD.c8_endC2 = c2;
    }
  }
  const SPAN_LINE = (s, last) => `<span style="display:block;margin:${last ? '.55em' : '.1em'} 0 0;font:${last ? 'italic 500 13px/1.5' : '500 13.5px/1.55'} var(--serif);letter-spacing:.1em;font-style:${last ? 'italic' : 'normal'};color:${last ? 'var(--dim)' : 'var(--bone)'}">${s}</span>`;
  // the epilogue is the payoff — on a landscape phone (≤ 480 px tall) the ending card's rank and stats shrink so all
  // eight lines and the last quote fit without scrolling. The rules ride inside the card's own text block, so they
  // only exist while this ending card does (the next card replaces them).
  const END_FIT = '<style>@media (max-height:480px){#ending .end-inner h2{margin-top:6px}#ending .end-rank{font-size:30px;margin:2px auto 0}'
    + '#ending .end-stats{grid-template-columns:repeat(4,1fr);gap:2px 10px;margin-top:6px;padding:5px 0}#ending .end-stats div{font-size:10px;line-height:1.25;letter-spacing:.12em}'
    + '#ending .end-stats b{font-size:14px}#ending .end-tbc{margin-top:6px}#ending .end-line>span{font-size:12px!important;line-height:1.42!important}#ending .pane-foot{margin-top:6px}}</style>';
  const ENDINGS = {
    encore: { kicker: 'ENDING A — RETURN', title: '終章　歸還', name: '終章　歸還 — RETURN', music: 'c8_end_a', lines: (F) => [
      '黑色的太陽裂開了。冥界的七道門，在同一個早晨打開。',
      '生命之水回到溫陀。王與王后，睜開了眼睛。',
      F.c2_quest_done ? '雪嶺的門鐘又響了。每響一聲，就有一個亡者走進山門。' : '雪嶺的門鐘依然啞著。亡者們卻自己排好了隊，一個一個走上山。',
      F.c6_spared ? '渡魂船重新起錨。十八年份的亡者，坐滿了甲板。' : '渡魂船仍在沉睡。亡者們涉水過河，河水只到膝蓋。',
      F.c4_quest_done ? '〈給沒有名字的孩子〉終於有了下半段。最後一行，添上了一個名字。' : '散落的樂譜沒有被找回。那首歌，已經不需要紙了。',
      '冥界要一個人來換。國王跪在第七個女兒面前，說了對不起，第一次叫了她的名字。',
      '然後他自己走下了冥界，去還欠大女兒的那一個名字。',
      '「這一次，換我走下去。」'] },
    solo: { kicker: 'ENDING B — THE GUIDE', title: '終章　引魂', name: '終章　引魂 — THE GUIDE', music: 'c8_end_b', lines: (F) => [
      '冥界的門開了。死去的人有了去處，也有了領路的人。',
      '寧舒把生命之水帶回溫陀。王與王后醒來時，枕邊只放著一盞燈。',
      F.c2_quest_done ? '雪嶺的門鐘每天都響。每一聲，都是她在門口接人。' : '雪嶺的門鐘依然啞著。亡者上山時，卻總看見一盞燈在等。',
      F.c6_spared ? '渡魂船重新起錨。船頭的燈，是她親手點的。' : '渡魂船仍在沉睡。她提著燈，一個一個把亡者牽過河。',
      '厄蕾絲走出了冥界。她第一次看見夕陽，看了很久、很久。',
      '有人問她叫什麼名字。她想了很久，說：「巴里。」',
      '在冥界最深的門口，有個沒有名字的人提著燈，替每一個走下來的人，叫出他們的名字。',
      '「別怕。我來帶路。」'] },
    fermata: { kicker: 'ENDING C — REPOSE', title: '終章　安息', name: '終章　安息 — REPOSE', music: 'c8_end_c', lines: (F) => [
      '生命之水流進了乾涸的冥河。沒有人醒來。',
      F.gave_musicbox ? '老鐸敲完最後一聲，抱著音樂盒走進了河裡。諾娜在對岸等。' : '老鐸敲完最後一聲，走進了河裡。',
      F.c2_quest_done ? '雪嶺的門鐘響了一整夜。十八年份的亡者，一個一個走進山門。' : '雪嶺的門鐘沒有響。亡者們排成很長的隊，安靜地上山。',
      F.c6_spared ? '渡魂船載滿了寂裔，最後一次渡河。' : '渡魂船沒有醒。寂裔們涉水過河，河水第一次是暖的。',
      '國王歐古走在隊伍的最後面。他沒有回頭。',
      '那年冬天，溫陀的花開了。第一個嬰兒，哭得很大聲。',
      '寧舒的燈浮在河面上，一直沒有熄。',
      '冥河邊，兩姊妹並肩坐著。誰也沒有說話。'] },
  };
  function chapterTitles() {
    const FALL = [[1, '一', '送葬之城'], [2, '二', '雪嶺山門'], [3, '三', '回頭路'], [4, '四', '溺死者的劇場'], [5, '五', '倒懸之塔'], [6, '六', '渡魂船'], [7, '七', '遺忘之庭'], [8, '八', '冥后宮殿']];
    return FALL.map(([id, zh, title]) => { const c = G.Chapters.get(id); return `第${(c && c.numZh) || zh}章「${(c && c.title) || title}」`; });
  }

  /* =========================================================================================
     NPCs
     ========================================================================================= */
  function memoryFlash(game, x, y, col) { G.SFX.play('c8_memoryFlash'); G.FX.ring(x, y, 10, 260, 1.1, col, 3); G.FX.ember(x, y, 24, col, { w: 60, h: 80, up: 120 }); }
  level.npcs.push(
    { id: 'c8_barrow', x: 2410, y: FLOOR[1], label: '聆聽', draw: drawBarrowMem, pending: (g) => !g.save.flags.c8_met_barrow,
      talk(game) {
        const F = game.save.flags; buildDialogs(F);
        if (!F.c8_met_barrow) { memoryFlash(game, 2410, FLOOR[1] - 80, '#ffd8a0'); BELLS.barrow.next = 0.4; }
        game.dialog(F.c8_met_barrow ? 'c8_barrowAgain' : 'c8_barrowTalk', () => { F.c8_met_barrow = true; });
      } },
    { id: 'c8_girl', x: ROOF.x0 + 190, y: ROOF.y, label: '交談', draw: drawGirl, pending: (g) => !g.save.flags.c8_met_girl,
      talk(game) {
        const F = game.save.flags;
        if (!F.c8_met_girl) memoryFlash(game, ROOF.x0 + 190, ROOF.y - 50, '#ffc89a');
        game.dialog(F.c8_met_girl ? 'c8_girlAgain' : 'c8_girlTalk', () => { F.c8_met_girl = true; });
      } },
    { id: 'c8_vega', x: 6205, y: 0, label: '交談', draw: drawVega, pending: (g) => !g.save.flags.c8_vega_done && g.encState.c8_e5 === 'cleared',
      talk(game) { if (game.encState.c8_e5 === 'cleared') vegaScene(game); } },
  );
  function vegaScene(game) {
    const F = game.save.flags;
    if (F.c8_vega_done) { game.dialog('c8_vegaAgain'); return; }
    buildDialogs(F); G.SFX.play('c8_holo');
    game.focus = { x: 6260, y: -150, zoom: 1.15 };
    game.dialog('c8_vegaTalk', () => { F.c8_vega_done = true; game.focus = null; game.persist(); });
  }

  /* =========================================================================================
     ENDINGS — hooks.bossDefeated → G.UI.choice → an epilogue for each ending → game.ending(variant)
     ========================================================================================= */
  let CH8 = null;
  const SEQ = { q: [], wait: 0, walk: null };
  const RT = { walk: null, init: false, dlgT: 0 };
  const VISTA = { t: -1, pan: false };
  function hold(game) { const Pl = game.player; game.control = false; Pl.vx = 0; if (Pl.busy && Pl.state !== 'rest' && Pl.state !== 'dead') Pl.setState('move'); }
  function seqRun(game, steps) { SEQ.q = steps.slice(); SEQ.wait = 0; SEQ.walk = null; seqNext(game); }
  function seqNext(game) {
    const s = SEQ.q.shift(); if (!s) return;
    if (s.fn) { s.fn(game); seqNext(game); }
    else if (s.wait != null) SEQ.wait = s.wait;
    else if (s.dlg) game.dialog(s.dlg, () => { hold(game); seqNext(game); });
    else if (s.walk != null) SEQ.walk = { tx: s.walk, t: 0, face: s.face || 1 };
  }
  function resetEpi() { Object.assign(EPI, { mode: null, t: 0, k: 0, stage: 0, crack: 0, dawn: 0, pale: 0, still: 0, flood: 0, coat: 0, mira: null }); }
  function trueEnding(F) {
    const n = ['c2_quest_done', 'c4_quest_done', 'c6_spared', 'c7_listened'].filter((k) => F[k]).length;
    return !!F.gave_musicbox && n >= 3;
  }
  function missingVoices(F) {
    const m = [];
    if (!F.gave_musicbox) m.push('老鐸，還沒有拿回那只音樂盒');
    if (!F.c2_quest_done) m.push('雪嶺的門鐘，仍然啞著');
    if (!F.c4_quest_done) m.push('劇場的輓歌，仍然散落');
    if (!F.c6_spared) m.push('渡魂船，仍在沉睡');
    if (!F.c7_listened) m.push('六姊的話，還沒有說完');
    return m;
  }
  function chooseEnding(game) {
    const F = game.save.flags, ok = trueEnding(F);
    hold(game);
    const pick = dev('c8choose');
    if (pick === 'encore' || pick === 'solo' || pick === 'fermata') { epilogue(game, pick === 'encore' && !ok ? 'solo' : pick); return; }
    const items = [];
    if (ok) items.push({ label: '帶著水回去', en: 'A　歸還 · RETURN', action: () => epilogue(game, 'encore') });
    items.push({ label: '我留下來引路', en: 'B　引魂 · THE GUIDE', action: () => epilogue(game, 'solo') });
    items.push({ label: '把水倒進冥河', en: 'C　安息 · REPOSE', action: () => epilogue(game, 'fermata') });
    G.UI.choice({
      kicker: '冥后宮殿　THE PALACE OF THE DEAD QUEEN',
      title: '「生命之水，要給誰？」',
      desc: ok ? '大姊關了十八年的門，就要打開。一路上替妳記住的東西，都還在妳身邊。'
        : '大姊關了十八年的門，就要打開。一個人，帶不回所有人。有些東西，還沒有跟上：' + missingVoices(F).join('；') + '。',
      items,
    });
  }
  function epilogue(game, kind) {
    const F = game.save.flags, P = game.player, mx = EPI.mira ? EPI.mira.x : BOX.x + 250;
    F.c8_ending_choice = kind; game.persist();
    EPI.mode = kind; EPI.t = 0; EPI.stage = 0;
    buildEpilogue(F, kind);
    hold(game);
    const near = { x: (P.x + mx) / 2, y: -190, zoom: 1.05 }, wide = { x: BOX.x, y: -330, zoom: 0.72 };
    game.focus = near;
    let steps;
    if (kind === 'encore') {
      steps = [
        { dlg: 'c8_endA1' },
        { fn: (gm) => { G.Music.play('c8_end_a'); EPI.stage = 1; G.SFX.play('c8_choirSwell'); gm.focus = wide; } },
        { wait: 2.0 },
        { fn: () => G.SFX.play('c8_bellToll', 0.8) }, { dlg: 'c8_endA2a' },
      ];
      if (F.c2_quest_done) steps.push({ fn: () => G.SFX.play('c8_belfryToll', 0.8) }, { dlg: 'c8_endA2b' });
      if (F.c6_spared) steps.push({ fn: () => G.SFX.play('c8_choirSwell') }, { dlg: 'c8_endA2c' });
      steps.push(
        { dlg: 'c8_endA2d' },
        { fn: (gm) => { EPI.stage = 2; G.SFX.play('c8_exhale'); gm.shake(0.3); } },
        { wait: 1.2 },
        { fn: (gm) => { G.SFX.play('c8_sunCrack'); gm.shake(0.6); } },
        { wait: 1.4 },
        { fn: () => { EPI.stage = 3; } },
        { wait: 1.8 },
        { fn: (gm) => { gm.focus = near; } },
        { dlg: 'c8_endA3' },
        { wait: 1.0 },
        { fn: (gm) => finishEnding(gm, 'encore') });
    } else if (kind === 'solo') {
      steps = [
        { dlg: 'c8_endB1' },
        { fn: (gm) => { G.Music.play('c8_end_b'); EPI.stage = 1; gm.player.setState('rest'); G.SFX.play('c8_exhale'); gm.shake(0.25); } },
        { wait: 2.4 },
        { dlg: 'c8_endB2' },
        { fn: (gm) => { EPI.stage = 2; gm.focus = wide; } },
        { wait: 2.2 },
        { dlg: 'c8_endB3' },
        { wait: 1.0 },
        { fn: (gm) => finishEnding(gm, 'solo') },
      ];
    } else {
      steps = [
        { fn: (gm) => gm.player.setState('rest') },
        { dlg: 'c8_endC1' },
        { fn: () => { G.Music.play(null); G.SFX.play('c8_boxStop'); EPI.stage = 1; } },
        { wait: 2.6 },
        { fn: (gm) => { G.Music.play('c8_end_c'); gm.focus = wide; } },
        { dlg: 'c8_endC2' },
        { wait: 1.6 },
        { fn: (gm) => finishEnding(gm, 'fermata') },
      ];
    }
    seqRun(game, steps);
  }
  function finishEnding(game, kind) {
    const F = game.save.flags, E = ENDINGS[kind], ls = E.lines(F);
    // the finale ends through game.ending(), not completeChapter(): mark the last chapter done so the credits roll
    // (which lists the chapters with ch_done_N) names all eight
    F['ch_done_' + ((CH8 && CH8.id) || 8)] = true;
    G.UI.creditsExtra = [
      { h: 'CHAPTERS · 章節', p: chapterTitles() },
      { h: 'THE GATEKEEPERS · 守門人', p: ['送葬司儀・瑪格 — 溫陀王城', '守鐘尼・卡菈 — 第一道門', '掘路王・哈德爾 — 第二道門', '提線歌姬・露塞特 — 第三道門', '錨長・伊德里斯 — 第四道門', '渡魂船之心・伊莉絲 — 第五道門', '六公主的殘影 — 第六道門', '三判官 — 第七道門'] },
      { h: 'AND · 以及', p: ['冥后・厄蕾絲 — 溫陀王的第一個女兒', '寧舒 — 魂燈侍靈'] },
      { h: 'ENDING', p: [E.name] },
    ];
    if (CH8) CH8.outro = ls[ls.length - 1];
    game.ending({ id: kind, kicker: E.kicker, title: E.title, lines: ls.map((s, i) => (i ? '' : END_FIT) + SPAN_LINE(s, i === ls.length - 1)), music: E.music });
  }
  // world-space epilogue visuals: warm rings from the music box (A), the coat of shadow moving onto Rinne (B)
  function drawEpilogueBack(ctx, game) {
    const e = EPI; if (!e.mode) return;
    const t = game.realTime;
    if (e.flood > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const q = (t * 0.45 + i / 4) % 1, r = 120 + q * 1500;
        ctx.globalAlpha = (1 - q) * 0.5 * e.flood; ctx.strokeStyle = '#ffd8a0'; ctx.lineWidth = 6 * (1 - q) + 1;
        ctx.beginPath(); ctx.ellipse(BOX.x, -150, r, r * 0.45, 0, 0, TAU); ctx.stroke();
      }
      sprite(ctx, '255,226,170', BOX.x, -300, 520, 0.35 * e.flood);
      ctx.globalAlpha = 1; ctx.restore();
    }
    if (e.coat > 0.01 && e.mira) {
      const P = game.player, ax = e.mira.x, ay = e.mira.y - 90, bx = P.x, by = P.y - 80, k = e.coat;
      const mx = lerp(ax, bx, Math.min(1, k * 1.2)), my = Math.min(ay, by) - 160 * Math.sin(Math.min(1, k) * PI);
      ctx.save();
      ctx.strokeStyle = rgba(INK, 0.8 * Math.min(1, k * 2)); ctx.lineWidth = 34 * k; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + mx) / 2, my, mx, lerp(ay, by, Math.min(1, k * 1.2))); ctx.stroke();
      ctx.strokeStyle = `rgba(240,236,250,${0.5 * k})`; ctx.lineWidth = 2; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      const ag = ctx.createRadialGradient(bx, by, 10, bx, by, 160);
      ag.addColorStop(0, rgba(INK, 0.5 * k)); ag.addColorStop(1, rgba(INK, 0));
      ctx.fillStyle = ag; ctx.fillRect(bx - 160, by - 160, 320, 320);
      ctx.restore();
    }
  }
  function drawEpilogueFront(ctx, game) {
    const e = EPI; if (!e.mode) return;
    if (e.still > 0.05) {
      // the silence settles: pale flakes hang in the air, motionless
      ctx.save(); ctx.fillStyle = `rgba(240,240,250,${0.6 * e.still})`;
      const rr = U.mulberry32(9101), cx = game.cam.x, cy = game.cam.y;
      for (let i = 0; i < 40; i++) { const x = cx - 700 + rr() * 1400, y = cy - 400 + rr() * 800, s = 1 + rr() * 2.4; ctx.fillRect(x, y, s, s); }
      ctx.restore();
    }
  }

  /* =========================================================================================
     HOOKS
     ========================================================================================= */
  function vistaStart(game) {
    hold(game);
    VISTA.t = 0; VISTA.pan = true;
    game.focus = { x: 2950, y: 220, zoom: 0.86 };
    G.SFX.play('c8_memoryFlash');
    seqRun(game, [
      { wait: 2.6 },
      { dlg: 'c8_vista' },
      { fn: (gm) => { VISTA.pan = false; gm.focus = null; gm.control = true; G.Input.clearBuffers(); } },
    ]);
  }
  const hooks = {
    enter(game) {
      const F = game.save.flags;
      F.c8_arrived = true; delete F.c8_ending_choice;
      resetEpi(); SEQ.q = []; SEQ.wait = 0; SEQ.walk = null; RT.walk = null; RT.init = true;
      VISTA.t = F.t_c8_t_vista || game.player.x > RISE[1] + 700 ? 99 : -1;
      buildDialogs(F);
      return false;
    },
    update(game, dt) {
      const Pl = game.player, F = game.save.flags;
      if (!RT.init) { RT.init = true; resetEpi(); delete F.c8_ending_choice; VISTA.t = F.t_c8_t_vista || Pl.x > RISE[1] + 700 ? 99 : -1; buildDialogs(F); }
      F.c8_arrived = true;
      // dev aids (inert without their URL parameter)
      if (dev('c8true') && !RT.devTrue) { RT.devTrue = true; Object.assign(F, { gave_musicbox: true, got_musicbox: true, c2_quest_done: true, c4_quest_done: true, c5_quest_done: true, c6_spared: true, c7_listened: true }); buildDialogs(F); }
      if (dev('c8zoom')) game.focus = { x: Pl.x + (+dev('c8dx') || 0), y: Pl.y - 70 + (+dev('c8dy') || 0), zoom: +dev('c8zoom') };
      if (dev('c8vista') && !RT.devVista) { RT.devVista = true; VISTA.t = 99; F.t_c8_t_vista = true; game.focus = { x: 4550, y: -170, zoom: 0.56 }; }
      if (dev('c8dbg') && Pl.hp <= 0 && !RT.dbgDead) {
        RT.dbgDead = true;
        console.warn('c8dbg death ' + JSON.stringify({ x: Math.round(Pl.x), y: Math.round(Pl.y), st: Pl.state, foes: game.enemies.filter((q) => !q.dead).map((q) => q.type + '@' + Math.round(q.x) + ',' + Math.round(q.y) + ':' + q.state + (q.atk && q.atk.name ? '/' + q.atk.name : '')), hz: game.hazards.map((h) => h.kind || '?') }));
      }
      if (dev('c8dbg') && Pl.hp > 0) RT.dbgDead = false;
      // ?c8trio=1: log the trio elite's state every 1.5 s (bot timing / balance checks)
      if (dev('c8trio') && game.encState.c8_elite === 'active' && (RT.trioT = (RT.trioT || 0) + dt) > 1.5) { RT.trioT = 0; console.warn('trio ' + Math.round(game.time) + ' P' + Math.round(Pl.x) + ',' + Math.round(Pl.y) + ':' + Math.round(Pl.hp) + '/' + Pl.maxHp + ':' + Pl.state + (game.control ? '' : ':NC') + ':' + ((G.UI.top() || {}).id || '-') + ' ' + game.enemies.filter((q) => q.enc === 'c8_elite').map((q) => q.type.replace('c8_elite', 'E') + ':' + Math.round(q.hp) + ':' + q.state + (q.atk && q.atk.name ? '/' + q.atk.name : '') + (q.kneel ? ':K' : '') + (q.dead ? ':D' : '') + (q.invuln ? ':I' : '') + (q.lead ? '' : ':sq' + (q.squad || []).length) + '@' + Math.round(q.x)).join(' ') + ' hz' + game.hazards.length); }
      if (dev('c8clear') && !RT.devClear) { RT.devClear = true; for (const id of dev('c8clear').split(',')) { game.encState[id] = 'cleared'; game.save.cleared[id] = true; } }
      if (dev('c8choice') && !RT.devChoice && game.time > 1) { RT.devChoice = true; chooseEnding(game); }
      if (dev('c8card') && !RT.devCard && game.time > 1) { RT.devCard = true; finishEnding(game, dev('c8card')); return; }
      if (dev('c8epi') && !RT.devEpi) {
        RT.devEpi = true; const m = dev('c8epi');
        EPI.mode = m; EPI.mira = { x: ARENA.boss[0] + 900, y: 0 }; EPI.stage = 3;
        if (m === 'encore') Object.assign(EPI, { flood: 1, crack: 1, dawn: 1 });
        if (m === 'solo') { Object.assign(EPI, { coat: 1, pale: 1 }); Pl.setState('rest'); }
        if (m === 'fermata') { Object.assign(EPI, { still: 1 }); Pl.setState('rest'); }
        F.c8_ending_choice = m;
        game.focus = { x: BOX.x, y: -330, zoom: 0.72 };
      }
      // the sequencer (vista, epilogues)
      if (SEQ.wait > 0) { SEQ.wait -= dt; if (SEQ.wait <= 0) { SEQ.wait = 0; seqNext(game); } }
      if (SEQ.walk) {
        const w = SEQ.walk;
        if (Pl.state !== 'cine') Pl.setState('cine');
        Pl.cineX = w.tx; Pl.cineRun = false; Pl.cineFace = w.face;
        if (Math.abs(Pl.x - w.tx) < 8 || (w.t += dt) > 3) { SEQ.walk = null; Pl.setState('move'); Pl.facing = w.face; hold(game); seqNext(game); }
      }
      // the stage lights coming on, one after another
      if (VISTA.t >= 0 && VISTA.t < 99) {
        const before = VISTA.t; VISTA.t += dt;
        // the camera rides the wave of footlights up the terraces toward the heart
        if (VISTA.pan) { const k = U.easeInOutSine(clamp(VISTA.t / 2.6, 0, 1)); game.focus = { x: lerp(2950, 4550, k), y: lerp(220, -170, k), zoom: lerp(0.86, 0.56, k) }; }
        const step = 0.12; if (Math.floor(before / step) !== Math.floor(VISTA.t / step) && VISTA.t < 4) G.SFX.play('c8_ignite', 0.5 + Math.random() * 0.4);
        if (VISTA.t > 8) VISTA.t = 99;
      }
      updBells(game, dt);
      updBox(game, dt);
      // a finale interrupted (the game closed during the epilogue): Mira is still waiting for an answer
      if (F.boss_8 && !F.ending_encore && !F.ending_solo && !F.ending_fermata && !EPI.mode && !RT.reoffer && game.control
        && !game.enemies.some((q) => q.boss && !q.dead) && game.encState.c8_boss === 'cleared' && Pl.x > ARENA.boss[0] + 150) {
        RT.reoffer = true; hooks.bossDefeated(game, { x: ARENA.boss[0] + 950, y: 0 });
      }
      // the epilogue's light
      if (EPI.mode && !dev('c8epi')) {
        EPI.t += dt;
        const ap = (k, v, rate) => { EPI[k] = U.approach(EPI[k], v, rate * dt); };
        if (EPI.mode === 'encore') { ap('flood', EPI.stage >= 1 ? 1 : 0, 0.4); ap('crack', EPI.stage >= 2 ? 1 : 0, 0.6); ap('dawn', EPI.stage >= 3 ? 1 : 0, 0.32); }
        if (EPI.mode === 'solo') { ap('coat', EPI.stage >= 1 ? 1 : 0, 0.42); ap('pale', EPI.stage >= 2 ? 1 : 0, 0.3); }
        if (EPI.mode === 'fermata') ap('still', EPI.stage >= 1 ? 1 : 0, 0.4);
        if (EPI.mode === 'encore' && EPI.flood > 0.3 && Math.random() < dt * 6) G.FX.ember(BOX.x + (Math.random() - 0.5) * 700, -280, 2, '#ffe2a8', { w: 40, h: 20, up: 220 });
      }
      // cinematic walk-in for the elite and boss arenas (contract trigger stays at x0 - 200, no snap)
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
          game.dialog(tr.dialog, () => { game.focus = null; if (tr.music) { G.Music.play(tr.music); G.SFX.play('roar'); game.shake(0.8); } });
        }
      }
    },
    trigger(game, tr) {
      const F = game.save.flags;
      // the summit line belongs to the last tier's floor; the elite's deck above overlaps its x range — on the deck
      // (mid-duel) it stays armed instead of interrupting the fight and being used up
      if (tr.id === 'c8_t_summit' && game.player.y < -150) { delete F['t_' + tr.id]; return true; }
      if (tr.kind === 'c8_bark') { game.bark(tr.bark === 'c8_belfry' ? (F.c2_quest_done ? 'c8_belfryRing' : 'c8_belfryMute') : tr.bark); return true; }
      if (tr.kind === 'c8_vista') { vistaStart(game); return true; }
      if (tr.kind === 'c8_vega') { if (!F.c8_vega_done) vegaScene(game); return true; }
      if (tr.id === 'c8_t_bell' || tr.id === 'c8_t_roof') { G.SFX.play('c8_memoryFlash'); return false; }
      if (tr.id !== 'c8_t_elite' && tr.id !== 'c8_t_boss') return false;
      const E = L.encounters[tr.startEnc];
      game.control = false;
      RT.walk = { tr, tx: E.arena[0] + 90, t: 0 };
      return true;
    },
    encounterStart(game, id) {
      const E = L.encounters[id], Pl = game.player, F = game.save.flags;
      // a retry after death starts the fight straight from the trigger: cut to the arena instead of snapping
      if (E && E.arena && (E.boss || E.elite) && Pl.x < E.arena[0] + 20) { Pl.x = E.arena[0] + 90; Pl.vx = 0; game.cam.x = Pl.x + 200; game.fadeA = 1; }
      if (id === 'c8_e1' && !F.c8_memory_barked) { F.c8_memory_barked = true; setTimeout(() => game.bark('c8_memoryFoe'), 1800); }
    },
    encounterClear(game, id) { if (id === 'c8_e5') setTimeout(() => game.bark('c8_e5clear'), 900); },
    interact(game, it) {
      const F = game.save.flags;
      if (it.kind === 'pylon') { buildDialogs(F); return false; }
      if (it.kind !== 'note') return false;
      const id = it.ref.id, follow = { c8_n1: 'c8_apologyAfter', c8_n4: 'c8_odeAfter' }[id];
      if (!follow && id !== 'c8_n3') return false;
      const first = !F['note_' + id];
      F['note_' + id] = true; if (it.ref.flag) F[it.ref.flag] = true;
      G.SFX.play('note');
      const n = G.DATA.codex.notes.find((q) => q.id === id);
      game.control = false;
      G.UI.readNote(n, () => {
        game.control = true; G.Input.clearBuffers();
        if (!first) return;
        if (follow) game.dialog(follow); else game.bark('c8_taliaAfter');
      });
      return true;
    },
    bossDefeated(game, e) {
      const P = game.player;
      EPI.mira = { x: e.x, y: e.y };
      hold(game);
      G.Music.play('c8_heart');
      game.dialog('c8_bossDefeat', () => {
        hold(game);
        const side = P.x < e.x ? -1 : 1, tx = clamp(e.x + side * 120, ARENA.boss[0] + 60, ARENA.boss[1] - 60);
        seqRun(game, [{ walk: tx, face: -side }, { wait: 0.5 }, { fn: chooseEnding }]);
      });
      return true;
    },
    drawSky, drawAtmos, drawForeground, drawBack, drawFront,
  };

  /* =========================================================================================
     REGISTER
     ========================================================================================= */
  CH8 = G.Chapters.register({
    id: 8, key: 'ch8', num: 'VIII', numZh: '八', title: '冥后宮殿', en: 'THE PALACE OF THE DEAD QUEEN',
    intro: [
      { t: '第七道門的後面，\n沒有路了。', s: 'BEYOND THE SEVENTH GATE, THERE IS NO ROAD.' },
      { t: '有人在那裡關著門。\n已經十八年了。', s: 'SOMEONE THERE HAS KEPT THE DOOR SHUT. FOR EIGHTEEN YEARS.' },
    ],
    enterDialog: 'c8_enter',
    outro: '「這一次，換我走下去。」',
    level, pal,
    sky: { sun: false, shafts: false, clouds: false, ark: false, rays: 0 },
    bg: {
      far: genFar, mid: genMid, near: genNear, props: genProps,
      params: { far: { f: 0.08, fy: 0.03, baseY: 60, res: 0.55 }, mid: { f: 0.22, fy: 0.1, baseY: 80, res: 0.7 }, near: { f: 0.45, fy: 0.25, baseY: 110, res: 0.85 } },
    },
    solidPainters: { c8_stage: paintStage, c8_deck: paintDeck },
    onewayPainter(p) { return p.k === 'light' ? paintLight(p) : p.k === 'ledge' ? paintLedge(p) : noPaint(); },
    music: { explore: 'c8_explore', boss: 'c8_boss', boss2: 'c8_boss2', boss3: 'c8_boss3', elite: 'c8_elite', rest: 'rest' },
    tracks, chords,
    ambience, sfx, data,
    hooks,
    next: null,
  });
})(window.G);

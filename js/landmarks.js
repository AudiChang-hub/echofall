'use strict';
/* ECHOFALL — 地標 (landmarks): every side road and every chamber of the well gets its own skyline.
   One great silhouette stands on the horizon (a kneeling colossus, a gallows bell, a drowned ship, a dead tree hung with
   ribbons...), and a row of smaller ruins passes in front of it (broken columns, lantern posts, graves, banners).
   Which ones appear is seeded per chapter and road, so the same road always looks the same and no two look alike.
   Colours are sampled from the loaded chapter's palette, so a silhouette belongs to whatever sky it stands under.
   Drawn from the chapter's afterLayer hook: the great one after the far layer, the ruins after the mid layer. */
(function (G) {
  const U = G.U;
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const P = (k, t) => U.mixHex(G.PAL[k][0], G.PAL[k][1], U.clamp(t, 0, 1));

  // which great silhouettes suit which chapter (the roads and the well draw from these)
  const PREF = {
    1: ['bell', 'colossus', 'gate', 'tower', 'ship'],
    2: ['gate', 'stair', 'colossus', 'tree', 'bell'],
    3: ['bones', 'stair', 'tower', 'cage', 'colossus'],
    4: ['ship', 'cage', 'bell', 'moonhand', 'gate'],
    5: ['tower', 'stair', 'moonhand', 'cage', 'bones'],
    6: ['ship', 'bones', 'bell', 'tree', 'moonhand'],
    7: ['tree', 'colossus', 'moonhand', 'stair', 'gate'],
    8: ['gate', 'cage', 'colossus', 'moonhand', 'tower'],
  };
  const PROPS = ['column', 'lantern', 'graves', 'banner', 'statue', 'arch', 'deadtree', 'hangcage'];

  /* ---------------------------------------------------------------- helpers (units: u = H/800, y up is negative) */
  function poly(ctx, u, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0] * u, pts[0][1] * u); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * u, pts[i][1] * u); ctx.closePath(); ctx.fill(); }
  function rect(ctx, u, x, y, w, h) { ctx.fillRect(x * u, y * u, w * u, h * u); }
  function glowDot(ctx, u, x, y, r, col, a) {
    const g = ctx.createRadialGradient(x * u, y * u, 0, x * u, y * u, r * u);
    g.addColorStop(0, U.rgba(col, a)); g.addColorStop(1, U.rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect((x - r) * u, (y - r) * u, r * 2 * u, r * 2 * u);
  }
  // a thin edge of light down the sunward side
  function rimLine(ctx, u, pts, col, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(col, a); ctx.lineWidth = Math.max(1, 1.6 * u);
    ctx.beginPath(); ctx.moveTo(pts[0][0] * u, pts[0][1] * u); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * u, pts[i][1] * u); ctx.stroke(); ctx.restore();
  }

  /* ---------------------------------------------------------------- the great silhouettes (base centre at 0,0; ~480u tall) */
  const BIG = {
    // a kneeling giant, head bowed over a sword driven into the ground
    colossus(ctx, u, t, C, r) {
      ctx.fillStyle = C.body;
      poly(ctx, u, [[-190, 0], [-170, -120], [-120, -170], [-140, -250], [-110, -330], [-60, -360], [-20, -350], [10, -330], [60, -340], [100, -300], [110, -230], [80, -160], [150, -130], [170, 0]]);
      poly(ctx, u, [[-40, -350], [-46, -400], [-20, -430], [16, -428], [34, -400], [26, -356]]);   // head, bowed
      poly(ctx, u, [[60, -300], [120, -250], [150, -190], [138, -180], [100, -230], [52, -270]]);  // arm to the hilt
      rect(ctx, u, 142, -250, 12, 250); rect(ctx, u, 112, -258, 72, 12);                          // the sword
      // a broken shoulder and cracks of light
      ctx.fillStyle = C.dark; poly(ctx, u, [[-120, -170], [-150, -230], [-110, -260], [-96, -200]]);
      rimLine(ctx, u, [[-46, -400], [-20, -430], [16, -428], [34, -400]], C.rim, 0.5);
      rimLine(ctx, u, [[60, -340], [100, -300], [110, -230]], C.rim, 0.35);
      const p = 0.5 + 0.5 * Math.sin(t * 0.9);
      glowDot(ctx, u, -4, -404, 22, C.glow, 0.35 + p * 0.25);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(C.glow, 0.28 + p * 0.2); ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.moveTo(-60 * u, -300 * u); ctx.lineTo(-40 * u, -250 * u); ctx.lineTo(-62 * u, -200 * u); ctx.lineTo(-44 * u, -140 * u); ctx.stroke(); ctx.restore();
    },
    // two pillars and a lintel; the doors stand ajar on a light that breathes
    gate(ctx, u, t, C, r) {
      const p = 0.5 + 0.5 * Math.sin(t * 0.7);
      const g = ctx.createLinearGradient(0, -420 * u, 0, 0); g.addColorStop(0, U.rgba(C.glow, 0)); g.addColorStop(1, U.rgba(C.glow, 0.35 + p * 0.2));
      ctx.fillStyle = g; ctx.fillRect(-70 * u, -400 * u, 140 * u, 400 * u);
      ctx.fillStyle = C.body;
      rect(ctx, u, -200, -420, 80, 420); rect(ctx, u, 120, -420, 80, 420);
      poly(ctx, u, [[-250, -420], [250, -420], [270, -470], [0, -500], [-270, -470]]);
      rect(ctx, u, -230, -440, 460, 24);
      poly(ctx, u, [[-120, -400], [-70, -390], [-50, 0], [-120, 0]]);   // the doors, swung in
      poly(ctx, u, [[120, -400], [70, -390], [50, 0], [120, 0]]);
      ctx.fillStyle = C.dark; for (let i = 0; i < 5; i++) rect(ctx, u, -196, -400 + i * 80, 72, 6), rect(ctx, u, 124, -400 + i * 80, 72, 6);
      rimLine(ctx, u, [[-270, -470], [0, -500], [270, -470]], C.rim, 0.45);
      // a broken corner
      ctx.fillStyle = C.sky; poly(ctx, u, [[200, -470], [270, -470], [262, -440], [226, -446]]);
    },
    // a gallows frame and a great bell that still sways
    bell(ctx, u, t, C, r) {
      ctx.fillStyle = C.body;
      poly(ctx, u, [[-230, 0], [-200, -470], [-180, -470], [-196, 0]]); poly(ctx, u, [[230, 0], [200, -470], [180, -470], [196, 0]]);
      rect(ctx, u, -240, -490, 480, 26); poly(ctx, u, [[-250, -490], [-230, -510], [230, -510], [250, -490]]);
      const sw = Math.sin(t * 0.6) * 0.06;
      ctx.save(); ctx.translate(0, -464 * u); ctx.rotate(sw);
      rect(ctx, u, -6, 0, 12, 60);
      poly(ctx, u, [[-40, 60], [40, 60], [70, 110], [90, 250], [130, 310], [-130, 310], [-90, 250], [-70, 110]]);
      ctx.fillStyle = C.dark; rect(ctx, u, -110, 270, 220, 10); rect(ctx, u, -80, 120, 160, 6);
      rimLine(ctx, u, [[40, 60], [70, 110], [90, 250], [130, 310]], C.rim, 0.5);
      ctx.fillStyle = C.body; poly(ctx, u, [[-14, 300], [14, 300], [10, 350], [-10, 350]]);   // the clapper
      ctx.restore();
      // ropes and the stair up to it
      ctx.strokeStyle = C.body; ctx.lineWidth = 2 * u;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 190 * u, -470 * u); ctx.quadraticCurveTo(s * 120 * u, -300 * u, s * 160 * u, -140 * u); ctx.stroke(); }
    },
    // a hulk run aground, listing, its masts snapped and sails in rags
    ship(ctx, u, t, C, r) {
      ctx.save(); ctx.rotate(-0.12);
      ctx.fillStyle = C.body;
      poly(ctx, u, [[-300, -40], [-260, -150], [200, -150], [300, -220], [320, -200], [260, -60], [180, 0], [-240, 10]]);
      poly(ctx, u, [[-300, -150], [-230, -150], [-230, -210], [-290, -200]]);   // stern castle
      rect(ctx, u, -120, -470, 12, 320); rect(ctx, u, 60, -380, 10, 230); rect(ctx, u, -180, -300, 160, 8);
      ctx.fillStyle = C.dark; for (let i = 0; i < 8; i++) rect(ctx, u, -220 + i * 52, -110, 18, 12);
      // rag sails, breathing in the wind
      ctx.fillStyle = C.body;
      const w = Math.sin(t * 1.1) * 8;
      poly(ctx, u, [[-108, -440], [-20 + w, -420], [-30 + w, -340], [-60 + w, -330], [-70 + w * 0.5, -360], [-108, -330]]);
      poly(ctx, u, [[70, -360], [150 + w, -340], [140 + w, -270], [110, -290], [70, -250]]);
      rimLine(ctx, u, [[-260, -150], [200, -150], [300, -220]], C.rim, 0.45);
      ctx.restore();
      // the waterline mist it sits in
      const g = ctx.createLinearGradient(0, -80 * u, 0, 20 * u); g.addColorStop(0, U.rgba(C.fogHex, 0)); g.addColorStop(1, U.rgba(C.fogHex, 0.55));
      ctx.fillStyle = g; ctx.fillRect(-380 * u, -80 * u, 760 * u, 100 * u);
    },
    // a tall tower leaning, crown broken, a few windows still lit
    tower(ctx, u, t, C, r) {
      ctx.save(); ctx.rotate(0.09);
      ctx.fillStyle = C.body;
      poly(ctx, u, [[-90, 0], [-80, -380], [-60, -420], [-50, -500], [-20, -540], [10, -510], [30, -560], [50, -470], [70, -420], [80, -380], [90, 0]]);
      rect(ctx, u, -110, -380, 220, 18); rect(ctx, u, -104, -200, 208, 14);
      for (let i = 0; i < 6; i++) {
        const y = -340 + i * 52, lit = ((i * 7 + 3) % 4 === 0), fl = 0.6 + 0.4 * Math.sin(t * 3 + i * 2);
        ctx.fillStyle = lit ? U.rgba(C.glow, 0.55 * fl) : C.dark;
        rect(ctx, u, -40, y, 16, 26); rect(ctx, u, 24, y + 12, 16, 26);
      }
      rimLine(ctx, u, [[50, -470], [70, -420], [80, -380], [90, 0]], C.rim, 0.4);
      ctx.restore();
      // a flock wheeling round the crown
      ctx.strokeStyle = C.body; ctx.lineWidth = 1.6 * u;
      for (let i = 0; i < 7; i++) {
        const a = t * 0.4 + i * 0.9, bx = Math.cos(a) * (90 + i * 9) + 40, by = -560 + Math.sin(a * 1.3) * 30 - i * 4, f = Math.sin(t * 8 + i) * 4;
        ctx.beginPath(); ctx.moveTo((bx - 8) * u, (by - f) * u); ctx.lineTo(bx * u, by * u); ctx.lineTo((bx + 8) * u, (by - f) * u); ctx.stroke();
      }
    },
    // a vast dead tree, ribbons tied to every branch, all of them moving
    tree(ctx, u, t, C, r) {
      ctx.fillStyle = C.body;
      poly(ctx, u, [[-70, 0], [-40, -60], [-34, -220], [-24, -300], [24, -300], [34, -220], [40, -60], [80, 0]]);
      const tips = [];
      ctx.strokeStyle = C.body; ctx.lineCap = 'round';
      const branch = (x, y, a, len, wd, d) => {
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        ctx.lineWidth = wd * u; ctx.beginPath(); ctx.moveTo(x * u, y * u); ctx.lineTo(x2 * u, y2 * u); ctx.stroke();
        if (d === 0 || len < 20) { tips.push([x2, y2]); return; }
        branch(x2, y2, a - 0.35 - r() * 0.3, len * (0.62 + r() * 0.15), wd * 0.62, d - 1);
        branch(x2, y2, a + 0.3 + r() * 0.3, len * (0.6 + r() * 0.15), wd * 0.6, d - 1);
      };
      branch(0, -290, -Math.PI / 2 - 0.5, 150, 22, 4); branch(0, -290, -Math.PI / 2 + 0.55, 160, 22, 4); branch(0, -300, -Math.PI / 2, 120, 18, 3);
      // ribbons: white and red, hung from the tips
      for (let i = 0; i < tips.length; i += 2) {
        const [x, y] = tips[i], len = 30 + ((i * 37) % 40), sw = Math.sin(t * 1.6 + i) * 10;
        ctx.strokeStyle = U.rgba(i % 6 === 0 ? '#d64a4a' : '#efe6d6', 0.55); ctx.lineWidth = 3 * u;
        ctx.beginPath(); ctx.moveTo(x * u, y * u); ctx.quadraticCurveTo((x + sw * 0.5) * u, (y + len * 0.5) * u, (x + sw) * u, (y + len) * u); ctx.stroke();
      }
      rimLine(ctx, u, [[24, -300], [34, -220], [40, -60], [80, 0]], C.rim, 0.35);
    },
    // an endless stair climbing out of the mist into the clouds; someone is still climbing it
    stair(ctx, u, t, C, r) {
      ctx.fillStyle = C.body;
      for (let i = 0; i < 26; i++) {
        const x = -260 + i * 22, y = -i * 22, a = 1 - i / 34;
        ctx.globalAlpha = a; rect(ctx, u, x, y - 22, 26, 22 + 30 * (1 - i / 26));
      }
      ctx.globalAlpha = 1;
      rect(ctx, u, -280, -40, 40, 40);
      // a lone climber, a few steps up
      const k = 8, cx = -260 + k * 22 + 13, cy = -k * 22 - 22 - Math.abs(Math.sin(t * 1.4)) * 3;
      poly(ctx, u, [[cx - 5, cy], [cx + 5, cy], [cx + 4, cy - 26], [cx, cy - 34], [cx - 4, cy - 26]]);
      glowDot(ctx, u, cx + 8, cy - 22, 14, C.glow, 0.5 + 0.2 * Math.sin(t * 4));
      // where it disappears, a ring of light
      glowDot(ctx, u, 330, -590, 90, C.glow, 0.22);
    },
    // the ribs of something enormous, an arch over the road
    bones(ctx, u, t, C, r) {
      ctx.strokeStyle = C.body; ctx.lineCap = 'round';
      ctx.lineWidth = 18 * u; ctx.beginPath(); ctx.moveTo(-320 * u, -60 * u); ctx.quadraticCurveTo(0, -260 * u, 320 * u, -40 * u); ctx.stroke();   // the spine
      for (let i = 0; i < 9; i++) {
        const x = -280 + i * 70, y = -60 - Math.sin((i / 8) * Math.PI) * 140, h = 180 + Math.sin((i / 8) * Math.PI) * 220;
        ctx.lineWidth = (12 - Math.abs(i - 4)) * u;
        ctx.beginPath(); ctx.moveTo(x * u, y * u); ctx.quadraticCurveTo((x + 60) * u, (y - h * 0.2) * u, (x + 40) * u, (y + h * 0.4) * u); ctx.lineTo((x + 30) * u, 0); ctx.stroke();
      }
      ctx.fillStyle = C.body; poly(ctx, u, [[300, -40], [380, -120], [420, -100], [430, -40], [380, 0], [300, 0]]);   // the skull
      ctx.fillStyle = C.dark; poly(ctx, u, [[370, -90], [396, -96], [392, -76]]);
      rimLine(ctx, u, [[-320, -62], [-160, -170], [0, -200]], C.rim, 0.3);
    },
    // a great cage hung on chains from somewhere above the sky; someone sits in it
    cage(ctx, u, t, C, r) {
      const sw = Math.sin(t * 0.5) * 0.04;
      ctx.save(); ctx.translate(0, -560 * u); ctx.rotate(sw);
      ctx.strokeStyle = C.body; ctx.lineWidth = 4 * u;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 20 * u, -400 * u); ctx.lineTo(s * 4 * u, 0); ctx.stroke(); }
      ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.ellipse(0, 230 * u, 120 * u, 26 * u, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = C.body; poly(ctx, u, [[-20, 0], [20, 0], [120, 60], [-120, 60]]);
      ctx.lineWidth = 4 * u;
      for (let i = 0; i <= 8; i++) { const x = -120 + i * 30; ctx.beginPath(); ctx.moveTo(x * u, 60 * u); ctx.lineTo(x * u, 236 * u); ctx.stroke(); }
      // the prisoner, knees drawn up
      poly(ctx, u, [[-30, 230], [30, 230], [24, 190], [8, 170], [-6, 164], [-20, 186]]);
      glowDot(ctx, u, 0, 200, 46, C.glow, 0.25 + 0.15 * Math.sin(t * 1.2));
      ctx.restore();
    },
    // a vast pale moon and the shadow of a hand reaching for it
    moonhand(ctx, u, t, C, r) {
      const g = ctx.createRadialGradient(40 * u, -420 * u, 40 * u, 40 * u, -420 * u, 200 * u);
      g.addColorStop(0, U.rgba(C.moon, 0.6)); g.addColorStop(0.7, U.rgba(C.moon, 0.35)); g.addColorStop(1, U.rgba(C.moon, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(40 * u, -420 * u, 200 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = U.rgba(C.moon, 0.5); ctx.beginPath(); ctx.arc(40 * u, -420 * u, 130 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.body;
      // forearm out of the ground, fingers spread toward the moon
      poly(ctx, u, [[-60, 0], [-40, -200], [-30, -300], [10, -330], [50, -320], [40, -200], [50, 0]]);
      const fingers = [[-26, -310, -0.3, 120], [0, -330, -0.08, 140], [24, -332, 0.1, 132], [44, -320, 0.32, 110], [-34, -270, -0.9, 90]];
      for (const [x, y, a, l] of fingers) {
        const bend = Math.sin(t * 0.5 + x) * 0.04;
        ctx.save(); ctx.translate(x * u, y * u); ctx.rotate(a + bend);
        poly(ctx, u, [[-9, 0], [9, 0], [7, -l * 0.55], [4, -l], [-4, -l], [-7, -l * 0.55]]);
        ctx.restore();
      }
      rimLine(ctx, u, [[50, -320], [40, -200], [50, 0]], C.rim, 0.35);
    },
  };

  /* ---------------------------------------------------------------- the passing ruins (base at 0,0; ~120–260u) */
  const SMALL = {
    column(ctx, u, t, C, r) {
      ctx.fillStyle = C.body; rect(ctx, u, -26, -200, 52, 200); rect(ctx, u, -36, -214, 72, 16); rect(ctx, u, -40, -12, 80, 12);
      poly(ctx, u, [[-26, -200], [-10, -246], [8, -226], [26, -260], [26, -200]]);
      ctx.fillStyle = C.dark; for (let i = -14; i <= 14; i += 14) rect(ctx, u, i - 2, -196, 4, 180);
      poly(ctx, u, [[50, 0], [62, -30], [110, -26], [120, 0]]);   // the fallen drum
    },
    lantern(ctx, u, t, C, r) {
      ctx.fillStyle = C.body; rect(ctx, u, -5, -230, 10, 230); rect(ctx, u, -5, -230, 60, 8);
      rect(ctx, u, 44, -222, 2, 20);
      poly(ctx, u, [[34, -202], [56, -202], [60, -170], [30, -170]]);
      const f = 0.7 + 0.3 * Math.sin(t * 7 + r() * 9) * Math.sin(t * 3.1);
      glowDot(ctx, u, 45, -186, 46, C.glow, 0.55 * f);
      ctx.fillStyle = U.rgba(C.glow, 0.8 * f); rect(ctx, u, 38, -198, 14, 22);
    },
    graves(ctx, u, t, C, r) {
      ctx.fillStyle = C.body;
      const n = 5;
      for (let i = 0; i < n; i++) {
        const x = -120 + i * 60, h = 40 + ((i * 53) % 50), tilt = ((i * 31) % 7 - 3) * 0.05;
        ctx.save(); ctx.translate(x * u, 0); ctx.rotate(tilt);
        if (i % 2) { rect(ctx, u, -4, -h - 30, 8, h + 30); rect(ctx, u, -18, -h - 10, 36, 8); }
        else { ctx.beginPath(); ctx.moveTo(-16 * u, 0); ctx.lineTo(-16 * u, -h * u); ctx.arc(0, -h * u, 16 * u, Math.PI, 0); ctx.lineTo(16 * u, 0); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
      rect(ctx, u, -150, -8, 300, 8);
    },
    banner(ctx, u, t, C, r) {
      ctx.fillStyle = C.body; rect(ctx, u, -4, -260, 8, 260); rect(ctx, u, -4, -256, 70, 6);
      const pts = [[0, -250]];
      for (let i = 0; i <= 6; i++) pts.push([10 + i * 9 + Math.sin(t * 2.2 + i * 0.8) * 5 * (i / 6), -250 + i * 22]);
      pts.push([50 + Math.sin(t * 2.2 + 6) * 5, -118], [60, -250]);
      ctx.fillStyle = U.rgba(C.banner, 0.75); poly(ctx, u, pts.map(([x, y]) => [x + 4, y]));
    },
    statue(ctx, u, t, C, r) {
      ctx.fillStyle = C.body; rect(ctx, u, -46, -60, 92, 60); rect(ctx, u, -54, -70, 108, 12);
      poly(ctx, u, [[-30, -70], [-36, -150], [-24, -200], [-12, -214], [12, -214], [24, -200], [36, -150], [30, -70]]);
      ctx.beginPath(); ctx.arc(0, -228 * u, 16 * u, 0, Math.PI * 2); ctx.fill();
      poly(ctx, u, [[-12, -190], [12, -190], [6, -160], [-6, -160]]);   // hands joined in prayer
      ctx.fillStyle = C.dark; rect(ctx, u, -1, -244, 2, 10);
    },
    arch(ctx, u, t, C, r) {
      ctx.fillStyle = C.body;
      rect(ctx, u, -110, -200, 40, 200); rect(ctx, u, 70, -150, 40, 150);
      ctx.beginPath(); ctx.moveTo(-110 * u, -200 * u); ctx.arc(0, -200 * u, 110 * u, Math.PI, Math.PI * 1.62); ctx.lineTo(-30 * u, -240 * u); ctx.arc(0, -200 * u, 70 * u, Math.PI * 1.7, Math.PI, true); ctx.closePath(); ctx.fill();
      poly(ctx, u, [[110, 0], [150, -20], [190, 0]]);
    },
    deadtree(ctx, u, t, C, r) {
      ctx.strokeStyle = C.body; ctx.lineCap = 'round';
      ctx.lineWidth = 12 * u; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10 * u, -100 * u, -10 * u, -190 * u); ctx.stroke();
      ctx.lineWidth = 5 * u;
      for (const [x, y, x2, y2] of [[-4, -120, -60, -170], [-8, -160, 50, -220], [-10, -186, -40, -240], [2, -80, 50, -110]]) { ctx.beginPath(); ctx.moveTo(x * u, y * u); ctx.lineTo(x2 * u, y2 * u); ctx.stroke(); }
      const sw = Math.sin(t * 1.8) * 6;
      ctx.strokeStyle = U.rgba('#d64a4a', 0.55); ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.moveTo(50 * u, -220 * u); ctx.quadraticCurveTo((52 + sw) * u, -200 * u, (50 + sw) * u, -180 * u); ctx.stroke();
    },
    hangcage(ctx, u, t, C, r) {
      ctx.fillStyle = C.body; rect(ctx, u, -6, -280, 12, 280); rect(ctx, u, -6, -280, 90, 10);
      const sw = Math.sin(t * 0.9) * 0.08;
      ctx.save(); ctx.translate(76 * u, -270 * u); ctx.rotate(sw);
      ctx.strokeStyle = C.body; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 40 * u); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 40 * u, 24 * u, 8 * u, 0, Math.PI, 0); ctx.fill();
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 11 * u, 40 * u); ctx.lineTo(i * 11 * u, 100 * u); ctx.stroke(); }
      rect(ctx, u, -26, 98, 52, 6);
      ctx.restore();
    },
  };

  // colours for what stands at a given depth in this chapter's sky
  function colours(t, depth) {
    const body = U.mixHex(U.mixHex(P('mid', t), P('midDark', t), 0.5), P('fog', t), depth);
    return {
      body, dark: U.mixHex(body, '#000000', 0.25), sky: U.mixHex(P('far', t), P('fog', t), 0.4),
      rim: P('rim', t), glow: P('rim', t), fogHex: P('fog', t), moon: U.mixHex(P('horizon', t), '#ffffff', 0.4), banner: U.mixHex(P('rim', t), '#a01c2c', 0.6),
    };
  }

  // where a background layer's ground line sits on screen right now (same mapping as TiledLayer.draw)
  function horizon(key, cam, H, S, ly) {
    const l = G.BG && G.BG.layers && G.BG.layers.find((q) => q.key === key); if (!l) return H * 0.7;
    const Sl = S / cam.zoom * (1 + (cam.zoom - 1) * l.f);
    return H / 2 + (ly - (cam.y * l.fy - l.baseY)) * Sl;
  }
  const L = G.Landmarks = {
    PREF, BIG, SMALL,
    // what a road or a chamber shows: a great silhouette and a seeded row of ruins
    plan(ch, seed, pick) {
      const r = rng(seed * 7 + 13), pref = PREF[ch] || PREF[1];
      const big = pref[pick != null ? pick % pref.length : Math.floor(r() * pref.length)];
      const props = []; for (let i = 0; i < 24; i++) props.push(PROPS[Math.floor(r() * PROPS.length)]);
      return { big, props, seed, side: r() < 0.5 ? -1 : 1, gap: 1500 + Math.floor(r() * 700), off: Math.floor(r() * 900) };
    },
    /* draw a plan for the given layer.
       x0: world x where the stretch begins; len: its length (the great one is set so it crosses the screen over that walk);
       fy: the floor of the stretch (to keep the horizon steady while the camera climbs) */
    draw(key, ctx, cam, W, H, S, time, plan, x0, len, fy) {
      if (!plan) return;
      const t = G.LEVEL && G.LEVEL.tintAt ? G.LEVEL.tintAt(cam.x) : 0, u = H / 800;
      if (key === 'far') {
        const f = 0.05, anchor = x0 + len * 0.42;
        const sx = W / 2 + (anchor - cam.x) * f * S + plan.side * W * 0.12, by = horizon('mid', cam, H, S, 30);
        if (sx < -500 * u || sx > W + 500 * u) return;
        ctx.save(); ctx.translate(sx, by); ctx.globalAlpha = 0.9;
        BIG[plan.big](ctx, u, time, colours(t, 0.42), rng(plan.seed));
        ctx.restore();
        // the mist they stand in
        const g = ctx.createLinearGradient(0, by - 140 * u, 0, by + 20 * u); const fog = P('fog', t);
        g.addColorStop(0, U.rgba(fog, 0)); g.addColorStop(1, U.rgba(fog, 0.35));
        ctx.fillStyle = g; ctx.fillRect(0, by - 140 * u, W, 160 * u + Math.max(0, H - by));
      } else if (key === 'mid') {
        const f = 0.16, gap = plan.gap, C = colours(t, 0.2), by = horizon('near', cam, H, S, 50);
        // walk along the stretch in plan.gap steps, drawing the ones on screen
        const lo = cam.x - (W / 2 + 300 * u) / (f * S), hi = cam.x + (W / 2 + 300 * u) / (f * S);
        const i0 = Math.max(0, Math.floor((lo - x0 + plan.off) / gap)), i1 = Math.floor((hi - x0 + plan.off) / gap);
        for (let i = i0; i <= i1; i++) {
          const wx = x0 - plan.off + i * gap, kind = plan.props[i % plan.props.length];
          const sx = W / 2 + (wx - cam.x) * f * S;
          ctx.save(); ctx.translate(sx, by); ctx.scale(0.85 + ((i * 37) % 30) / 100, 0.85 + ((i * 37) % 30) / 100);
          SMALL[kind](ctx, u, time + i, C, rng(plan.seed + i));
          ctx.restore();
        }
      }
    },
    /* fixed placements along a chapter's own road (chapter 1's districts): each one fades in around its x */
    drawPlaced(key, ctx, cam, W, H, S, time, list, fy) {
      const t = G.LEVEL && G.LEVEL.tintAt ? G.LEVEL.tintAt(cam.x) : 0, u = H / 800;
      for (const o of list) {
        if ((o.layer || 'far') !== key) continue;
        const d = Math.abs(cam.x - o.x), a = U.clamp(1 - (d - o.r) / 1400, 0, 1);
        if (a <= 0.01) continue;
        const f = o.f || 0.06, sx = W / 2 + (o.x - cam.x) * f * S + (o.dx || 0) * W, by = horizon(o.layer === 'mid' ? 'near' : 'mid', cam, H, S, o.ly != null ? o.ly : 30);
        ctx.save(); ctx.translate(sx, by); ctx.globalAlpha = a * (o.a || 0.9); if (o.s) ctx.scale(o.s, o.s);
        (BIG[o.kind] || SMALL[o.kind])(ctx, u, time, colours(t, o.depth != null ? o.depth : 0.42), rng(o.x | 0));
        ctx.restore();
      }
    },
  };
})(window.G);

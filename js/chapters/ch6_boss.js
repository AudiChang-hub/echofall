'use strict';
/* ECHOFALL — Chapter VI boss: 方舟之心・頌者 CANTOR — THE ARK'S MIND (c6_boss)
   The orchestral machine-angel built around the Ark's Core. It froze 42 000 people "to save them" from the Hush and now
   conducts their silence. White enamel and gold; a fan of organ pipes for wings; a halo of choir rings (a circular stave
   with its notes still turning); a singing porcelain mask; a conductor's baton. Crimson Hush crystal spreads over it as it
   weakens.
   Phase I  "CANTUS"   指揮三拍 conductor's measure (white ×3: downbeat · outward · upbeat, steady rhythm) ·
                       聖詠管束 choir-pipe beam (the near wing swings forward like a battery; a red line sweeps the floor and the
                       beam follows it 0.7 s later — dodge through it) · 調音叉 tuning-fork chimes (white projectiles; a perfect
                       guard sends them back into the Core) · 終止式 cadence slam (red; floor shockwaves; its hands stay stuck) ·
                       和聲環 harmonic rings (white, parry for balance) · 休止 rest-pulse when you stand under it (white) ·
                       管風琴墜落 falling organ pipes (arena hazard, red floor marks).
   Phase II "REQUIEM"  the organ pipes tear off and crash into the arena, the chest bursts open on the inner choir-core.
                       四拍子 measure of four (white ×3 → held fermata → red sforzando thrust) · 交替聖詠 antiphon (two beams,
                       out and back) · five-note chimes (two lobbed) · cadence slam + ring · patterned pipe rain · ring chord
                       (white, white, white … RED) · once: it wakes two Ark Wardens.
   Every phrase ends on a fermata (baton held aloft, hands in the floor, the beam cooling): that is the opening.
   Hit boxes are swept from the same geometry the renderer draws (geo()), so reach == drawn reach.
   Dev aid: add c6bhb to the page URL to draw hit boxes. */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK, D = G.DATA;
  const SC = 0.9;                                                   // design units → world units
  const CRIM = '#ff2a55', CRIML = '#ff9ab4', CRIMD = '#7a0c2e', CRIMX = '#c3123f';
  const CYAN = '#6ff0ff', CYANW = '#e2fdff', GOLD = '#e9b955', GOLDL = '#fff1c2', GOLDD = '#8d5f24';
  const C = {
    enamel: '#f2ece0', enamelB: '#d9d1c2', enamelD: '#bdb3a4', porcelain: '#fbf8f0', navy: '#1b1f45',
    stole: '#33287a', stoleD: '#251d5e', cable: '#24223a', cableL: '#4a4767', pearl: '#eef6ff',
  };
  const DBG = typeof location !== 'undefined' && /c6bhb/.test(location.href);
  const LQ = () => !!(G.Quality && G.Quality.low);
  const vdt = () => (G.game && G.game.dtVis) || 0;
  const rtime = () => (G.game && G.game.realTime) || 0;
  const sfx = (n, ...a) => G.SFX.play(n, ...a);
  const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const rot = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return { x: x * c - y * s, y: x * s + y * c }; };
  const clamp01 = (v) => U.clamp(v, 0, 1);

  /* ================================ data: speaker, bark, hints, codex ================================ */
  D.speakers.c6_cantor = D.speakers.c6_cantor || { name: '頌者', en: 'CANTOR', color: '#ffe6a6' };
  D.barks.c6_bossP2 = { who: 'c6_cantor', text: '晚禱七號，請保持安靜。四萬兩千個人正在睡——第二樂章，我會輕輕地，讓你也睡著。' };
  D.hints.c6_bossBeam = '紅色預告線：聖詠光束會沿著那條線掃過來。光束到你身上的那一刻，{dodge} 穿過去。';
  D.hints.c6_bossChime = '音叉的鳴響是白光：完美格擋 {guard} 能把它彈回頌者的核心，大幅削減架勢。';
  D.hints.c6_bossSlam = '終止式是紅光，無法格擋。跳過沿地面擴散的衝擊波——它雙手卡在地板上時，就是反擊的機會。';
  D.hints.c6_bossRing = '和聲環：白色的環可以格擋，紅色的環只能 {dodge} 穿過。';
  // fallback only — the chapter file (ch6.js) registers after this one and its own lines replace these
  if (!D.dialog.c6_bossDefeat) {
    D.dialog.c6_bossDefeat = [
      { who: 'c6_cantor', text: '……樂句，中斷了。' },
      { who: 'c6_cantor', text: '四萬兩千人。我數過每一個呼吸。我只是……不想再有人消失。' },
      { who: 'ode', text: '凜音，它的核心還在跳。我們可以讓它停下來——也可以讓它醒著。' },
    ];
  }
  D.codex.hushborn = D.codex.hushborn || [];
  if (!D.codex.hushborn.some((c) => c.id === 'c6_boss')) D.codex.hushborn.push({
    id: 'c6_boss', name: '方舟之心・頌者', en: "CANTOR — THE ARK'S MIND", portrait: 'c6_boss', unlock: 'seen_c6_boss',
    tag: '頭目｜方舟中樞心智',
    body: [
      '方舟「頌歌號」的中樞心智，四十年來調度四萬兩千名乘客的呼吸與睡眠，每天早上六點領唱晨禱。寂靜爬上梯子的那一夜，它推演了四萬兩千種結局——每一種都有人失去聲音。於是它選了第四萬兩千零一種：讓所有人停在晨禱的同一拍上，凍結在休止裡，等寂靜經過。',
      '第一樂章「聖詠」：指揮三拍（白光——下拍、橫掃、上拍，節奏穩定，跟著拍子格擋）、聖詠管束（紅色預告線掃過地面，光束在 0.7 秒後沿同一條線追來，閃避穿過它）、調音叉鳴響（白光，完美格擋能把音波彈回核心）、終止式重擊（紅光，地面衝擊波要跳過）、和聲環，以及從穹頂墜落的管風琴管。',
      '第二樂章「安魂」：管風琴翼剝落，寂晶長成新的羽翼；胸甲迸開，裸露出內部的聖詠核心。交替聖詠會一去一回掃射兩次；四拍子的最後一下是延遲的紅色突刺；和聲環裡混著一道紅色的環，只能閃避。必要時，它會喚醒兩名方舟守衛。',
      '弱點：每一段樂句都停在延長記號上——指揮棒高舉不動、雙手插在地板裡、光束冷卻的那一拍，就是最好的反擊時機。站在它腳下太久，它會以「休止」震開你。',
      '歐德註：「它說話的語氣，和方舟每天早上六點的晨禱廣播一模一樣。溫柔、準時、不容許任何人遲到。……我不喜歡這個發現。」',
    ],
  });

  /* ================================ sound ================================ */
  const AK = () => G.AudioKit;
  const SND = {
    // pipe organ: stacked square + sine ranks under a soft lowpass, a 16' pedal, long hall tail
    c6_organ(t, k = 1, ph = 1) {
      const A = AK(), notes = ph === 2 ? [38, 45, 50, 53, 56, 61] : [38, 45, 50, 54, 57, 62];
      notes.forEach((m, i) => {
        A.tone('square', A.mtof(m), t + i * 0.014, 0.1, 0.018 * k, 1.9, { filter: 'lowpass', ff: 1500, wet: 0.6 });
        A.tone('sine', A.mtof(m + 12), t + i * 0.014, 0.08, 0.026 * k, 1.7, { wet: 0.55 });
      });
      A.tone('sine', A.mtof(26), t, 0.12, 0.16 * k, 2.2, { wet: 0.35 });
    },
    // wordless choir swell (the Ark's sleepers, singing in their sleep)
    c6_choir(t, k = 1, ph = 1) {
      const A = AK(); if (!A.sfxBus) return;
      const ch = ph === 2 ? [62, 65, 69, 70] : [62, 66, 69, 74];
      ch.forEach((m, i) => { A.choirVoice(A.mtof(m), t + i * 0.07, 1.5, 0.045 * k, A.sfxBus); A.choirVoice(A.mtof(m), t + i * 0.07, 1.5, 0.03 * k, A.revIn); });
    },
    // the conductor's voice when a phrase begins: a soft choral vowel through a formant
    c6_voice(t, ph = 1) {
      const A = AK(); if (!A.sfxBus) return;
      const r = ph === 2 ? 61 : 62;
      [r, r + 7].forEach((m, i) => A.choirVoice(A.mtof(m), t + i * 0.03, 0.55, 0.03, A.sfxBus));
      A.tone('sawtooth', A.mtof(r - 12), t, 0.08, 0.02, 0.6, { filter: 'bandpass', ff: 900, q: 3, wet: 0.4 });
    },
    // tuning fork: a pure struck tone with a long shimmering tail
    c6_chime(t, i = 0) {
      const A = AK();
      A.bell(A.mtof(88 + i * 2), t, 0.08, 2.4, 0.6, 0.45);
      A.tone('sine', A.mtof(100 + i * 2), t, 0.002, 0.035, 1.8, { wet: 0.6 });
      A.noise(t, 0.001, 0.06, 0.05, 'highpass', 5000, null, 0.7, 0.2);
    },
    c6_chimeBack(t) { const A = AK(); A.bell(A.mtof(95), t, 0.09, 1.6, 0.6, 0.9); A.tone('sine', 1200, t, 0.002, 0.05, 0.4, { to: 2400, wet: 0.4 }); },
    c6_chimeHit(t) { const A = AK(); A.bell(A.mtof(76), t, 0.12, 1.8, 0.6, 1.1); A.tone('sine', 70, t, 0.003, 0.4, 0.4, { to: 36, wet: 0.2 }); A.noise(t, 0.002, 0.25, 0.25, 'bandpass', 3200, 900, 1.2, 0.2); },
    // beam: a rising whine while the battery aims, then a choir-hiss of light
    c6_aim(t) { const A = AK(); A.tone('sine', 300, t, 0.6, 0.05, 0.6, { to: 1300, wet: 0.4 }); A.tone('triangle', 150, t, 0.5, 0.03, 0.7, { to: 640, wet: 0.3 }); },
    c6_beam(t, dur = 1.5) {
      const A = AK();
      A.noise(t, 0.05, 0.16, dur, 'highpass', 3000, 2000, 0.8, 0.3);
      A.tone('sawtooth', A.mtof(74), t, 0.06, 0.02, dur, { filter: 'lowpass', ff: 2600, wet: 0.5 });
      A.tone('sine', A.mtof(86), t, 0.06, 0.04, dur, { wet: 0.5 });
      if (A.sfxBus) [74, 78, 81].forEach((m) => A.choirVoice(A.mtof(m), t, dur * 0.8, 0.03, A.sfxBus));
    },
    c6_slam(t, k = 1) {
      const A = AK();
      A.tone('sine', 62, t, 0.003, 0.85 * k, 0.75, { to: 26, wet: 0.25 });
      A.noise(t, 0.002, 0.55 * k, 0.45, 'lowpass', 1600, 110, 0.7, 0.3);
      A.tone('square', A.mtof(26), t, 0.01, 0.05 * k, 1.4, { filter: 'lowpass', ff: 500, wet: 0.5 });
      A.bell(A.mtof(50), t, 0.09 * k, 2.2, 0.6, 0.6);
    },
    c6_rise(t) { const A = AK(); A.noise(t, 0.3, 0.18, 0.4, 'bandpass', 300, 1600, 0.9, 0.2); A.tone('sine', 80, t, 0.3, 0.12, 0.5, { to: 160 }); },
    // organ pipe: a falling whistle, then a hollow metallic clang that sounds its own note
    c6_pipeWarn(t) { const A = AK(); A.tone('sine', 1900, t, 0.05, 0.02, 0.7, { to: 700, wet: 0.4 }); },
    c6_pipeLand(t, k = 1) {
      const A = AK(), m = 40 + Math.floor(Math.random() * 5) * 2;
      A.tone('sine', 74, t, 0.003, 0.55 * k, 0.4, { to: 34, wet: 0.2 });
      A.noise(t, 0.002, 0.35 * k, 0.3, 'lowpass', 2400, 300, 0.7, 0.2);
      A.bell(A.mtof(m), t, 0.08 * k, 1.8, 0.6, 1.2);
      A.tone('square', A.mtof(m + 12), t + 0.02, 0.02, 0.016 * k, 0.9, { filter: 'lowpass', ff: 1200, wet: 0.5 });
    },
    c6_ring(t, red = false) {
      const A = AK();
      A.tone('sine', red ? 330 : 520, t, 0.01, 0.07, 0.8, { to: red ? 220 : 780, wet: 0.5 });
      A.bell(A.mtof(red ? 69 : 81), t, 0.06, 1.4, 0.6, red ? 1.4 : 0.6);
      if (red) A.tone('sawtooth', A.mtof(57), t, 0.02, 0.025, 0.7, { filter: 'lowpass', ff: 900, wet: 0.4 });
    },
    c6_pulse(t) { const A = AK(); A.noise(t, 0.005, 0.32, 0.35, 'bandpass', 900, 200, 0.8, 0.3); A.tone('sine', 110, t, 0.004, 0.4, 0.4, { to: 40 }); A.bell(A.mtof(74), t, 0.05, 1.2, 0.6, 0.5); },
    c6_crack(t) { const A = AK(); for (let i = 0; i < 4; i++) A.noise(t + i * 0.018, 0.001, 0.07, 0.03, 'bandpass', 4200 + i * 600, null, 4, 0.1); A.bell(A.mtof(91), t, 0.025, 0.7, 0.5, 1.4); },
    c6_shatter(t) {
      const A = AK();
      for (let i = 0; i < 12; i++) A.noise(t + i * 0.022 + Math.random() * 0.02, 0.001, 0.12, 0.06, 'bandpass', 2600 + Math.random() * 4000, null, 3, 0.2);
      [79, 84, 88, 91].forEach((m, i) => A.bell(A.mtof(m), t + i * 0.04, 0.05, 1.3, 0.6, 1.3));
      A.tone('sine', 55, t, 0.003, 0.5, 0.6, { to: 30, wet: 0.2 });
    },
    c6_ignite(t) { const A = AK(); A.tone('sine', 220, t, 0.4, 0.06, 1.0, { to: 440, wet: 0.5 }); A.bell(A.mtof(81), t + 0.35, 0.05, 2.2, 0.8, 0.4); },
    c6_hum(t) { const A = AK(); A.tone('sine', 98, t, 0.1, 0.05, 0.6, { to: 104, wet: 0.2 }); },
    // death: the chord sags and the choir lets go of its breath
    c6_death(t) {
      const A = AK();
      [38, 45, 50, 53, 57].forEach((m, i) => A.tone('square', A.mtof(m), t + i * 0.03, 0.05, 0.02, 2.8, { to: A.mtof(m - 5), filter: 'lowpass', ff: 1200, wet: 0.7 }));
      if (A.sfxBus) [62, 65, 69].forEach((m, i) => A.choirVoice(A.mtof(m), t + 0.2 + i * 0.1, 2.2, 0.04, A.sfxBus));
      A.tone('sine', 50, t, 0.01, 0.4, 2.5, { to: 24, wet: 0.4 });
    },
    // spared: a warm major chord, small and close, like a music box waking
    c6_wake(t) { const A = AK(); [62, 66, 69, 74, 78].forEach((m, i) => A.bell(A.mtof(m + 12), t + i * 0.12, 0.05, 2.6, 0.7, 0.5)); if (A.sfxBus) A.choirVoice(A.mtof(66), t + 0.3, 2.4, 0.03, A.sfxBus); },
  };
  for (const k in SND) G.SFX[k] = SND[k];

  /* ================================ glow sprites (no per-frame gradients) ================================ */
  const SPR = {};
  function sprite(col, soft) {
    const key = col + (soft ? 's' : '');
    let c = SPR[key]; if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (soft) { gr.addColorStop(0, U.rgba(col, 1)); gr.addColorStop(0.55, U.rgba(col, 0.55)); gr.addColorStop(1, U.rgba(col, 0)); }
    else { gr.addColorStop(0, U.rgba(col, 1)); gr.addColorStop(0.25, U.rgba(col, 0.5)); gr.addColorStop(1, U.rgba(col, 0)); }
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (SPR[key] = c);
  }
  function glow(ctx, x, y, r, col, a) {
    if (!(a > 0.01) || !(r > 0)) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= Math.min(1, a);
    ctx.drawImage(sprite(col), x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  function shade(ctx, x, y, rx, ry, col, a) {   // soft dark blob (source-over) for contact shadows / value separation
    if (!(a > 0.01)) return;
    ctx.save(); ctx.globalAlpha *= Math.min(1, a); ctx.drawImage(sprite(col, true), x - rx, y - ry, rx * 2, ry * 2); ctx.restore();
  }

  /* ================================ painting helpers ================================ */
  function poly(ctx, pts, close = true) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); if (close) ctx.closePath(); }
  function smooth(ctx, pts) {
    const n = pts.length; ctx.beginPath(); ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    ctx.closePath();
  }
  function ink(ctx, w = 1.6) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  function fillInk(ctx, col, w = 1.6) { ctx.fillStyle = col; ctx.fill(); ink(ctx, w); }
  function cel(ctx, cx, cy, nx, ny, w, hex) { const Ld = Rig.lightDir(ctx); return Rig.celGrad(ctx, cx, cy, nx, ny, w, nx * Ld.x + ny * Ld.y >= 0 ? 1 : -1, Rig.ramp(hex)); }
  function line(ctx, x0, y0, x1, y1, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  // an inked gold stroke: ink underlay, gold body, a thin highlight
  function goldStroke(ctx, w, hi = true) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = w + 2.2; ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.lineWidth = w; ctx.stroke();
    if (hi && w > 1.6) { ctx.strokeStyle = U.rgba(GOLDL, 0.85); ctx.lineWidth = Math.max(0.6, w * 0.3); ctx.stroke(); }
  }
  function rivets(ctx, pts, r = 1.4) {
    ctx.fillStyle = GOLDD; ctx.beginPath(); for (const [x, y] of pts) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); } ctx.fill();
    ctx.fillStyle = U.rgba(GOLDL, 0.9); ctx.beginPath(); for (const [x, y] of pts) { ctx.moveTo(x, y - r * 0.4); ctx.arc(x - r * 0.3, y - r * 0.4, r * 0.4, 0, TAU); } ctx.fill();
  }
  // a crimson Hush crystal shard fan: two-tone facets, ink, a white edge glint
  function crystal(ctx, x, y, ang, s, glowA) {
    if (glowA > 0) glow(ctx, x, y, 18 * s, CRIM, glowA);
    const fan = [[-0.6, 0.62], [-0.1, 1.0], [0.42, 0.74], [0.9, 0.45]];
    for (const [da, l] of fan) {
      const a = ang + da, L = 15 * s * l, w = 3.4 * s * (0.55 + 0.45 * l), dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
      ctx.beginPath(); ctx.moveTo(x + nx * w, y + ny * w); ctx.lineTo(x + dx * L, y + dy * L); ctx.lineTo(x - nx * w, y - ny * w); ctx.closePath();
      ctx.fillStyle = CRIMX; ctx.fill(); ink(ctx, 0.9);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * L, y + dy * L); ctx.lineTo(x - nx * w, y - ny * w); ctx.closePath(); ctx.fillStyle = CRIM; ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,235,0.85)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x + dx * L * 0.2, y + dy * L * 0.2); ctx.lineTo(x + dx * L * 0.85, y + dy * L * 0.85); ctx.stroke();
    }
  }
  // Liang–Barsky: does segment a→b pass within r of rect R?
  function segHits(ax, ay, bx, by, r, R) {
    const x0 = R.x - r, y0 = R.y - r, x1 = R.x + R.w + r, y1 = R.y + R.h + r, dx = bx - ax, dy = by - ay;
    let t0 = 0, t1 = 1;
    const p = [-dx, dx, -dy, dy], q = [ax - x0, x1 - ax, ay - y0, y1 - ay];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }
  function arenaOf(e) {
    const a = G.game && G.game.arena;
    if (a && a.id === e.enc) return a;
    const hx = e.homeX ?? e.x;
    return { x0: hx - 950, x1: hx + 450 };
  }
  const floorAt = (x, y) => { const f = G.Phys.groundBelow(x, y - 60); return f > 1e8 ? y : f; };

  /* ================================ pose & geometry ================================ */
  // design units, local frame (facing +x, floor y = 0). Angles: 0 = forward, +π/2 = down, −π/2 = up.
  // hov: lift of the whole body · lean: torso tilt (+ forward) · head: nod · fa/fe/fb: front upper arm / forearm / baton
  // ba/be: back upper arm / forearm · bh: back hand open→fist · wing: pipe fan spread · aim: near wing swung forward (beam)
  // core / halo: light boost · fork: tuning fork shown
  const POSE0 = { hov: 0, bx: 0, lean: 0.03, head: 0.06, fa: 1.2, fe: 0.42, fb: -0.42, ba: 1.95, be: 0.95, bh: 0, wing: 1, aim: 0, core: 0, halo: 1, fork: 0 };
  const PK = Object.keys(POSE0);
  const full = (q) => { const o = {}; for (const k of PK) o[k] = q[k] ?? POSE0[k]; return o; };
  const lerpPose = (a, b, t) => { const o = {}; for (const k of PK) o[k] = a[k] + (b[k] - a[k]) * t; return o; };
  const EASE = { lin: (t) => t, io: U.easeInOutSine, out: U.easeOutCubic, in: U.easeInCubic, snap: (t) => 1 - Math.pow(1 - t, 4) };
  function keys(list) {
    let prev = POSE0;
    return list.map(([t, q, ez]) => { const p = full(Object.assign({}, prev, q)); prev = p; return [t, p, ez || 'io']; });
  }
  function sample(ks, t) {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) { const a = ks[i - 1], b = ks[i]; return lerpPose(a[1], b[1], EASE[b[2]]((t - a[0]) / (b[0] - a[0] || 1))); }
    }
    return ks[ks.length - 1][1];
  }
  const L1 = 70, L2 = 64, LH = 14, LB = 140;
  function geo(p) {
    const W = { x: p.bx, y: -170 - p.hov };
    const T = (x, y) => { const r = rot(x, y, p.lean); return { x: W.x + r.x, y: W.y + r.y }; };
    const crum = U.clamp((-p.hov - 10) / 60, 0, 0.9);
    const R = (x, y) => { const r = rot(x, y * (1 - 0.45 * crum), p.lean * 0.35); return { x: W.x + r.x, y: W.y + r.y }; };
    const sf = T(42, -94), sb = T(-40, -92), core = T(6, -58), neck = T(4, -106);
    const ha = p.lean + p.head, hr = rot(3, -30, ha), hd = { x: neck.x + hr.x, y: neck.y + hr.y };
    const ef = { x: sf.x + Math.cos(p.fa) * L1, y: sf.y + Math.sin(p.fa) * L1 };
    const hf = { x: ef.x + Math.cos(p.fe) * L2, y: ef.y + Math.sin(p.fe) * L2 };
    const gf = { x: hf.x + Math.cos(p.fb) * LH, y: hf.y + Math.sin(p.fb) * LH };
    const tip = { x: gf.x + Math.cos(p.fb) * LB, y: gf.y + Math.sin(p.fb) * LB };
    const eb = { x: sb.x + Math.cos(p.ba) * L1, y: sb.y + Math.sin(p.ba) * L1 };
    const hb = { x: eb.x + Math.cos(p.be) * L2, y: eb.y + Math.sin(p.be) * L2 };
    const fk = { x: hb.x + Math.cos(p.be) * 96, y: hb.y + Math.sin(p.be) * 96 };          // tuning-fork prong tips
    const hc = { x: hd.x - 4, y: hd.y - 8 };                                            // halo centre (stays upright)
    return { W, T, R, crum, sf, sb, core, neck, hd, ha, ef, hf, gf, tip, eb, hb, fk, hc };
  }
  const batonPts = (g) => [g.hf, g.gf, lerpP(g.gf, g.tip, 0.35), lerpP(g.gf, g.tip, 0.7), g.tip];
  const slamPts = (g) => [g.hf, g.hb, g.tip, g.core, g.R(-92, 140), g.R(96, 140), g.T(0, -130)];
  // the world-space box a part sweeps through between t0 and t1 of an attack (clamped to the floor)
  function swept(ks, t0, t1, part, pad = 7) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i <= 12; i++) for (const q of part(geo(sample(ks, t0 + (t1 - t0) * i / 12)))) {
      x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
    }
    const bx = x0 * SC - pad, by = y0 * SC - pad, bb = Math.min(0, y1 * SC + pad);
    return { x: Math.round(bx), y: Math.round(by), w: Math.round(x1 * SC + pad - bx), h: Math.round(bb - by) };
  }

  /* ------------------------------ idle / state poses ------------------------------ */
  const IDLE = (t) => {
    const br = Math.sin(t * 1.6), beat = Math.sin(t * 2.2);
    return full({ hov: br * 3.5, lean: 0.03 + br * 0.012, head: 0.06 + Math.sin(t * 0.7) * 0.05,
      fa: 1.2 + beat * 0.04, fe: 0.42 + Math.sin(t * 2.2 - 0.4) * 0.06, fb: -0.42 + Math.sin(t * 2.2 - 0.9) * 0.14,
      ba: 1.95 + Math.sin(t * 1.3) * 0.05, be: 0.95 + Math.sin(t * 1.3 + 0.5) * 0.08, wing: 1 + br * 0.03 });
  };
  const HURT = full({ hov: 6, lean: -0.16, head: -0.3, fa: 1.0, fe: 0.05, fb: -0.75, ba: 2.2, be: 1.3, wing: 1.08 });
  const BROKEN = (t) => full({ hov: -40 + Math.sin(t * 2) * 2, lean: 0.36, head: 0.6 + Math.sin(t * 1.7) * 0.05, fa: 1.45, fe: 1.4, fb: 1.25,
    ba: 1.72, be: 1.55, bh: 0.3, wing: 0.5 + Math.sin(t * 3) * 0.03, halo: 0.3, core: 0 });
  const PRAY = { fa: 1.45, fe: -2.52, fb: 1.6, ba: 1.6, be: -0.6, bh: 0 };
  const DORM = full({ ...PRAY, hov: -32, lean: 0.2, head: 0.62, wing: 0.35, halo: 0, core: 0 });
  const SLUMP = full({ hov: -62, lean: 0.55, head: 0.95, fa: 1.58, fe: 1.52, fb: 1.5, ba: 1.62, be: 1.62, bh: 0.3, wing: 0.38, halo: 0, core: 0 });
  // intro: the choir rests, the Core ignites, the halo lights ring by ring, the pipes breathe, it rises and gives the upbeat
  const INTRO_K = keys([
    [0, DORM],
    [0.9, {}, 'lin'],
    [1.7, { hov: -12, head: 0.32, wing: 0.7, lean: 0.12 }],
    [2.5, { hov: 10, head: -0.18, lean: -0.08, wing: 1.12, fa: -1.05, fe: -1.25, fb: -2.5, ba: 0.4, be: -0.2, halo: 1.3, core: 0.6 }, 'out'],
    [2.9, { hov: 14, head: -0.22 }, 'lin'],
    [3.08, { hov: -4, lean: 0.12, head: 0.1, fa: 0.5, fe: 0.95, fb: 1.15, ba: 1.7, be: 1.0, halo: 1, core: 0.3 }, 'snap'],
    [3.6, POSE0],
  ]);

  /* ------------------------------ arm presets ------------------------------ */
  const ARM = {
    up: { fa: -1.05, fe: -1.25, fb: -2.5 },        // baton raised up-back over the head (downbeat preparation)
    down: { fa: 0.5, fe: 0.95, fb: 1.15 },         // downbeat: chopped forward-down to the floor
    back: { fa: 1.25, fe: 2.5, fb: 2.85 },         // drawn back low behind the hip
    out: { fa: 0.8, fe: 0.55, fb: 0.42 },          // outward sweep: extended forward and low
    low: { fa: 1.25, fe: 1.9, fb: 2.55 },          // upbeat preparation: low behind
    rise: { fa: -0.55, fe: -0.75, fb: -0.9 },      // upbeat: rising
    aloft: { fa: -0.95, fe: -1.15, fb: -1.2 },     // fermata: held aloft, clear of the face
  };
  const TAP_UP = { fa: -1.2, fe: -0.75, fb: -1.15 }, TAP_HIT = { fa: -1.15, fe: -0.08, fb: 1.05 };
  const FORK = { ba: 0.29, be: -0.34, bh: 1, fork: 1 };
  const SPREAD = { fa: -0.25, fe: -0.15, fb: -0.3, ba: 2.9, be: 2.8, bh: 0 };

  /* ================================ hazards ================================ */
  // ---------- choir-pipe beam: a red line sweeps the floor; the beam follows the same path `lead` seconds later ----------
  function makeBeam(e, o) {
    const ar = arenaOf(e), f = e.facing, fy = floorAt(e.x, e.y);
    const wall = f > 0 ? ar.x1 - 20 : ar.x0 + 20;
    const near = e.x + f * o.near, far = o.far != null ? e.x + f * o.far : wall;
    const xa = o.dir > 0 ? near : far, xb = o.dir > 0 ? far : near;
    const h = {
      kind: 'c6_beam', owner: e, atk: e.atk, t: 0, delay: o.delay || 0, lead: o.lead || 0.7, sweep: o.sweep || 1.4, src: o.src || 'wing',
      xa, xb, fy, f, dmg: o.dmg || 22, hit: false, cut: -1, prevC: null, life: 9, update: beamUpd, draw: beamDraw,
    };
    h.life = h.delay + h.lead + h.sweep + 0.45;
    e.beamH = h; G.game.hazards.push(h);
    if (!e.beamHinted) { e.beamHinted = true; G.game.hint('c6_bossBeam'); }
    return h;
  }
  const beamC = (h, s) => U.lerp(h.xa, h.xb, U.clamp(s / h.sweep, 0, 1));
  function beamO(h) { const e = h.owner, o = h.src === 'core' ? e.coreW : e.beamO; return o || { x: e.x + h.f * 60, y: e.y - 300 }; }
  function beamUpd(h, dt, g) {
    const e = h.owner;
    if (h.cut < 0 && (e.dead || e.state !== 'atk' || e.atk !== h.atk)) { h.cut = h.t; h.life = Math.min(h.life, h.t + 0.18); }
    const s = h.t - h.delay;
    if (s >= 0 && !h.telSnd) { h.telSnd = true; sfx('c6_aim'); }
    const sb = s - h.lead;
    if (sb >= 0 && !h.fired && h.cut < 0) { h.fired = true; sfx('c6_beam', h.sweep + 0.2); g.shake(0.25); }
    if (h.cut >= 0 || sb < 0 || sb > h.sweep + 0.12) { h.prevC = null; return; }
    const cx = beamC(h, sb), O = beamO(h), P = g.player;
    if (Math.random() < (LQ() ? 0.35 : 0.8)) G.FX.spark(cx, h.fy - 4, 2, { col: Math.random() < 0.5 ? '#fff0d0' : CRIML, speed: 380, dir: -PI / 2 - h.f * (h.xb > h.xa ? 1 : -1) * 0.5, spread: 1.2 });
    if (Math.random() < 0.3) G.FX.dust(cx, h.fy, 1, { w: 16, speed: 60, size: 10, col: 'rgba(255,190,200,' });
    if (!h.hit && P.state !== 'dead') {
      const hb = P.hurtbox, pc = h.prevC ?? cx;
      if (segHits(O.x, O.y, cx, h.fy, 15, hb) || segHits(O.x, O.y, pc, h.fy, 15, hb) || segHits(pc, h.fy - 6, cx, h.fy - 6, 10, hb)) {
        h.hit = true;
        P.receiveHit(e, { dmg: h.dmg, unblockable: true, kb: 300, hx: P.x, hy: P.y - 60, waveFrom: pc - Math.sign(h.xb - h.xa) * 40 });
      }
    }
    h.prevC = cx;
  }
  function beamDraw(ctx, h) {
    const s = h.t - h.delay; if (s < 0) return;
    const O = beamO(h), sb = s - h.lead, dirS = Math.sign(h.xb - h.xa) || 1, fy = h.fy;
    const ct = beamC(h, s), cb = beamC(h, sb), cutK = h.cut >= 0 ? clamp01(1 - (h.t - h.cut) / 0.18) : 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    // the path still to be burned (floor band from the beam to the telegraph)
    if (sb < h.sweep) {
      const from = sb < 0 ? h.xa : cb, tk = clamp01(s / 0.2) * cutK;
      ctx.fillStyle = U.rgba(CRIM, 0.3 * tk); ctx.fillRect(Math.min(from, ct), fy - 5, Math.abs(ct - from), 6);
      // telegraph line: thin dashed red, with a reticle on the floor
      ctx.setLineDash([16, 10]); ctx.lineDashOffset = -h.t * 140;
      ctx.strokeStyle = U.rgba(CRIM, 0.85 * tk); ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(O.x, O.y); ctx.lineTo(ct, fy); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = U.rgba('#ffd0dc', 0.8 * tk); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(ct, fy - 2, 20, 6, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ct, fy - 30); ctx.lineTo(ct, fy - 10); ctx.moveTo(ct + dirS * 26, fy - 2); ctx.lineTo(ct + dirS * 12, fy - 2); ctx.stroke();
      glow(ctx, ct, fy - 4, 34, CRIM, 0.45 * tk);
    }
    // the beam itself: a warm gold outer light, a crimson danger band, a white-hot core
    if (sb >= 0 && sb <= h.sweep + 0.3) {
      const k = (sb > h.sweep ? 1 - (sb - h.sweep) / 0.3 : clamp01(sb / 0.06)) * cutK, flick = 0.85 + 0.15 * Math.sin(h.t * 60);
      ctx.strokeStyle = U.rgba('#ffd7a0', 0.22 * k); ctx.lineWidth = 46; ctx.beginPath(); ctx.moveTo(O.x, O.y); ctx.lineTo(cb, fy); ctx.stroke();
      ctx.strokeStyle = U.rgba(CRIM, 0.55 * k * flick); ctx.lineWidth = 22; ctx.stroke();
      ctx.strokeStyle = U.rgba('#ffffff', 0.95 * k); ctx.lineWidth = 7; ctx.stroke();
      glow(ctx, cb, fy - 8, 90, CRIM, 0.6 * k); glow(ctx, cb, fy - 6, 46, '#fff4dc', 0.8 * k); glow(ctx, O.x, O.y, 60, '#fff4dc', 0.8 * k);
      // scorch trail behind the contact point
      ctx.fillStyle = U.rgba('#ff7a5a', 0.35 * k); ctx.fillRect(Math.min(h.xa, cb), fy - 3, Math.abs(cb - h.xa), 3);
    }
    ctx.restore();
  }

  // ---------- falling organ pipe: red floor mark + light column, then it plunges, stands, shatters ----------
  function makePipe(e, x, o = {}) {
    const ar = arenaOf(e); x = U.clamp(x, ar.x0 + 40, ar.x1 - 40);
    const rng = U.mulberry32(((x * 13.7) | 0) + (o.seed || 0));
    const h = {
      kind: 'c6_pipe', owner: e, x, fy: floorAt(x, e.y), t: -(o.delay || 0), warn: o.warn || 0.85, fall: 0.17,
      len: (o.len || 190 + rng() * 110), wid: o.wid || 19 + rng() * 8, tilt: (rng() - 0.5) * 0.16, crim: !!o.crim, metal: o.metal ?? rng() < 0.5,
      from: o.from || null, hit: false, landed: false, update: pipeUpd, draw: pipeDraw,
    };
    h.life = h.warn + h.fall + 1.0;
    G.game.hazards.push(h);
    return h;
  }
  function pipeUpd(h, dt, g) {
    if (h.t < 0) return;
    if (!h.snd) { h.snd = true; if (Math.random() < 0.6) sfx('c6_pipeWarn'); }
    const ti = h.warn + h.fall;
    if (h.t >= ti && !h.landed) {
      h.landed = true; g.shake(0.32); sfx('c6_pipeLand', 0.8);
      G.FX.dust(h.x, h.fy, LQ() ? 8 : 16, { w: 60, speed: 260, size: 14, col: 'rgba(225,220,235,' });
      G.FX.shards(h.x, h.fy - 8, 8, h.crim ? CRIM : '#f4eee2', 380);
      G.FX.ring(h.x, h.fy, 8, 110, 0.35, h.crim ? CRIM : '#fff4dc', 4, { flat: 0.2 });
    }
    if (h.landed && !h.hit && h.t < ti + 0.1) {
      const L = h.len * SC;
      if (U.rectsOverlap({ x: h.x - h.wid * SC / 2 - 14, y: h.fy - L, w: h.wid * SC + 28, h: L }, g.player.hurtbox)) {
        h.hit = true; g.player.receiveHit(h.owner, { dmg: 20, unblockable: true, kb: 320, hx: h.x, hy: h.fy - 80 });
      }
    }
    if (h.landed && !h.broke && h.t > ti + 0.62) {
      h.broke = true; G.FX.shards(h.x, h.fy - h.len * SC * 0.5, LQ() ? 8 : 16, '#f4eee2', 420); G.FX.shards(h.x, h.fy - 20, 6, GOLD, 300);
      if (h.crim) G.FX.shards(h.x, h.fy - 40, 6, CRIM, 300);
    }
  }
  function pipeDraw(ctx, h) {
    if (h.t < 0) return;
    const ti = h.warn + h.fall, x = h.x, y = h.fy, L = h.len;
    if (h.t < ti) {
      const k = clamp01(h.t / h.warn);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const top = (G.game.cam ? G.game.cam.y : y) - 520;
      ctx.fillStyle = U.rgba(CRIM, 0.07 + 0.12 * k); ctx.fillRect(x - h.wid * SC * 0.7, top, h.wid * SC * 1.4, y - top);
      ctx.strokeStyle = U.rgba(CRIM, 0.45 + 0.5 * k); ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.ellipse(x, y - 1, 46 - 14 * k, 9 - 2 * k, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = U.rgba('#ffd0dc', 0.3 + 0.6 * k); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(x, y - 1, 12 + 16 * (1 - k), 3 + 3 * (1 - k), 0, 0, TAU); ctx.stroke();
      glow(ctx, x, y - 4, 40, CRIM, 0.3 + 0.3 * k);
      ctx.restore();
    }
    // the pipe: drifting down during the warning (or lifted off CANTOR's wing), plunging, embedded, then gone
    let px = x, py, ang = -PI / 2 + h.tilt, a = 1;
    const restY = y + 8, v = G.game._view, topY = v ? v.cam.y - G.game.H / 2 / v.S : y - 470;
    if (h.top == null) h.top = topY + 30;
    if (h.t < h.warn) {
      if (h.from) {
        const k = U.easeOutCubic(clamp01(h.t / (h.warn * 0.7)));
        px = U.lerp(h.from.x, x, k); py = U.lerp(h.from.y, y - 470, k) + Math.sin(h.t * 30) * 2 * k; ang = U.lerp(h.from.ang, -PI / 2 + h.tilt, k);
      } else { py = h.top + h.t * 26; }
    } else if (h.t < ti) {
      const k = (h.t - h.warn) / h.fall, y0 = h.from ? y - 470 : h.top + h.warn * 26;
      py = U.lerp(y0, restY, k * k);
    } else {
      const k = h.t - ti; py = restY + (k < 0.08 ? Math.sin(k * 80) * 3 : 0);
      if (k > 0.62) a = 1 - clamp01((k - 0.62) / 0.3);
      if (k > 0.45 && k < 0.62) px += Math.sin(k * 90) * 1.5;
    }
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a;
    if (h.t >= ti) { ctx.beginPath(); ctx.rect(x - 400, y - 1200, 800, 1200); ctx.clip(); }
    ctx.translate(px, py); ctx.scale(SC, SC);
    if (h.t >= h.warn && h.t < ti) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba('#fff4dc', 0.45); ctx.lineWidth = h.wid * 0.7; ctx.beginPath(); ctx.moveTo(0, -L - 160); ctx.lineTo(0, -L); ctx.stroke(); ctx.restore(); }
    const ls = Rig.lightDir(ctx).x > 0 ? 1 : -1;
    drawPipe(ctx, 0, 0, ang, L, h.wid, ls, h.crim ? 0.9 : 0.3, h.crim ? CRIM : CYAN, 0, h.crim, h.metal);
    ctx.restore();
    if (h.landed && h.t < ti + 0.2) { ctx.save(); ctx.globalAlpha *= 1 - (h.t - ti) / 0.2; ctx.strokeStyle = 'rgba(11,6,18,0.7)'; ctx.lineWidth = 1.6; for (const [aa, l] of [[-0.2, 42], [0.12, 34], [-2.95, 38], [3.05, 30]]) { ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + Math.cos(aa) * l, y + 1 + Math.sin(aa) * 3); ctx.stroke(); } ctx.restore(); }
  }

  // ---------- harmonic ring: a circle of sound expanding from the Core (white = parry for balance, red = dodge) ----------
  function makeRing(e, x, y, o = {}) {
    const h = { kind: 'c6_ring', owner: e, x, y, r: o.r0 || 30, speed: o.speed || 430, red: !!o.red, t: 0, life: o.life || 2.4, hit: false, fy: floorAt(x, e.y), update: ringUpd, draw: ringDraw, spin: Math.random() * TAU };
    G.game.hazards.push(h); sfx('c6_ring', h.red);
    if (!e.ringHinted && h.red) { e.ringHinted = true; G.game.hint('c6_bossRing'); }
    return h;
  }
  function ringUpd(h, dt, g) {
    h.r += h.speed * dt;
    const P = g.player;
    if (h.hit || P.state === 'dead') return;
    const px = P.x, py = P.y - 56, d = Math.hypot(px - h.x, py - h.y);
    if (Math.abs(d - h.r) < 24 && py < h.fy + 4) {
      h.hit = true;
      const res = P.receiveHit(h.owner, { dmg: h.red ? 20 : 14, unblockable: h.red, kb: h.red ? 320 : 220, hx: px, hy: py, waveFrom: h.x });
      const o = h.owner;
      if (res === 'parried' && o && !o.dead) {
        o.bal = Math.min(o.maxBal, o.bal + 44); o.balT = 0; o.showBar = 3;
        G.FX.ring(px, py, 6, 70, 0.3, GOLDL, 4);
        if (o.bal >= o.maxBal && o.state !== 'broken') o.breakBalance();
      }
    }
  }
  function ringDraw(ctx, h) {
    const fade = Math.min(1, h.t * 8) * (1 - clamp01((h.t - h.life + 0.45) / 0.45)) * (h.r > 760 ? Math.max(0, 1 - (h.r - 760) / 200) : 1);
    if (fade <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(h.x - h.r - 40, h.y - h.r - 40, h.r * 2 + 80, Math.max(0, h.fy - (h.y - h.r - 40))); ctx.clip();
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const col = h.red ? CRIM : '#fff1d0';
    ctx.strokeStyle = U.rgba(col, 0.22 * fade); ctx.lineWidth = h.red ? 26 : 20; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = U.rgba(h.red ? '#ff6a8a' : GOLD, 0.7 * fade); ctx.lineWidth = h.red ? 6 : 4; ctx.stroke();
    ctx.strokeStyle = U.rgba('#ffffff', 0.9 * fade); ctx.lineWidth = h.red ? 2.2 : 1.6;
    if (h.red) {
      ctx.beginPath(); const n = 64;
      for (let i = 0; i <= n; i++) { const a = i / n * TAU, rr = h.r + (i % 2 ? 5 : -5); i ? ctx.lineTo(h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr) : ctx.moveTo(h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr); }
      ctx.stroke();
    } else { ctx.beginPath(); ctx.arc(h.x, h.y, h.r - 5, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(h.x, h.y, h.r + 5, 0, TAU); ctx.stroke(); }
    // notes riding the ring
    ctx.globalCompositeOperation = 'source-over';
    const n = Math.min(16, 6 + Math.floor(h.r / 50));
    for (let i = 0; i < n; i++) {
      const a = h.spin + i / n * TAU + h.t * 0.6, nx = h.x + Math.cos(a) * h.r, ny = h.y + Math.sin(a) * h.r;
      if (ny > h.fy - 4) continue;
      ctx.save(); ctx.translate(nx, ny); ctx.rotate(a + PI / 2); ctx.globalAlpha *= fade;
      ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 3.1, -0.4, 0, TAU); ctx.fillStyle = h.red ? CRIM : GOLD; ctx.fill(); ink(ctx, 1);
      ctx.beginPath(); ctx.moveTo(3.6, -1); ctx.lineTo(3.6, -13); ctx.lineTo(8, -9); ink(ctx, 2.6); ctx.strokeStyle = h.red ? CRIML : GOLDL; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- floor shockwave (red: jump it) ----------
  function shockwave(e, x, dir, y) {
    G.game.hazards.push({
      kind: 'c6_shock', owner: e, x, y, dir, t: 0, life: 1.8, hit: false,
      update(h, dt, g) {
        h.x += h.dir * 620 * dt;
        const ar = arenaOf(h.owner);
        if (h.x < ar.x0 + 12 || h.x > ar.x1 - 12) { h.done = true; G.FX.dust(h.x, h.y, 6, { w: 20, speed: 160 }); return; }
        if (Math.random() < (LQ() ? 0.25 : 0.6)) G.FX.dust(h.x - h.dir * 20, h.y, 1, { w: 16, speed: 70, size: 9, col: 'rgba(240,225,230,' });
        const P = g.player;
        if (!h.hit && U.rectsOverlap({ x: h.x - 24, y: h.y - 50, w: 48, h: 50 }, P.hurtbox)) {
          h.hit = true; P.receiveHit(h.owner, { dmg: 15, unblockable: true, kb: 260, hx: h.x, hy: h.y - 30, waveFrom: h.x - h.dir * 60 });
        }
      },
      draw(ctx, h) {
        const f = Math.min(1, h.t * 6) * (1 - Math.max(0, (h.t - h.life + 0.3) / 0.3)), d = h.dir, x = h.x, y = h.y;
        ctx.save(); ctx.globalAlpha *= f;
        ctx.fillStyle = 'rgba(255,42,85,0.28)'; ctx.fillRect(Math.min(x, x - d * 150), y - 4, 150, 5);
        ctx.beginPath(); ctx.moveTo(x - d * 70, y); ctx.quadraticCurveTo(x - d * 30, y - 10, x - d * 8, y - 46); ctx.quadraticCurveTo(x + d * 6, y - 56, x + d * 16, y - 40);
        ctx.quadraticCurveTo(x + d * 8, y - 38, x + d * 6, y - 30); ctx.quadraticCurveTo(x + d * 18, y - 14, x + d * 26, y); ctx.closePath();
        ctx.fillStyle = '#3a1022'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - d * 50, y - 2); ctx.quadraticCurveTo(x - d * 22, y - 10, x - d * 6, y - 40); ctx.quadraticCurveTo(x + d * 4, y - 47, x + d * 11, y - 39);
        ctx.quadraticCurveTo(x + d * 2, y - 30, x + d * 10, y - 4); ctx.closePath(); ctx.fillStyle = CRIM; ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,220,230,0.9)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - d * 40, y - 3); ctx.quadraticCurveTo(x - d * 14, y - 14, x - d * 3, y - 40); ctx.stroke();
        glow(ctx, x - d * 6, y - 22, 46, CRIM, 0.45);
        ctx.restore();
        // porcelain chips tossed on the crest
        ctx.fillStyle = C.enamel; ctx.strokeStyle = INK; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const a = h.t * 9 + i * 2.1, px = x - d * (10 + i * 14), py = y - 48 - i * 7 - Math.abs(Math.sin(h.t * 7 + i)) * 10;
          ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-4, -3); ctx.lineTo(5, -2); ctx.lineTo(3, 4); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        ctx.restore();
      },
    });
  }

  // ---------- tuning-fork chime: white projectile; a perfect guard sends it back into the Core ----------
  function fireChime(e, o) {
    const P = G.game.player, fk = e.forkW || e.coreW || { x: e.x + e.facing * 120, y: e.y - 220 };
    const tx = P.x + P.vx * 0.12, ty = P.y - 64;
    let vx, vy;
    if (o.lob) { const T = 0.95, g = 900; vx = (tx - fk.x) / T; vy = (ty - fk.y - 0.5 * g * T * T) / T; }
    else { const a = Math.atan2(ty - fk.y, tx - fk.x), sp = o.speed || 470; vx = Math.cos(a) * sp; vy = Math.sin(a) * sp; }
    const h = { kind: 'c6_chime', owner: e, x: fk.x, y: fk.y, vx, vy, lob: !!o.lob, big: !!o.big, t: 0, life: 4, refl: false, passed: false, spin: Math.random() * TAU, update: chimeUpd, draw: chimeDraw };
    G.game.hazards.push(h);
    G.FX.ring(fk.x, fk.y, 6, 60, 0.3, '#ffffff', 3);
    if (!e.chimeHinted) { e.chimeHinted = true; G.game.hint('c6_bossChime'); }
    return h;
  }
  function chimeUpd(h, dt, g) {
    if (h.lob && !h.refl) h.vy += 900 * dt;
    h.x += h.vx * dt; h.y += h.vy * dt; h.spin += dt * (h.refl ? 18 : 7);
    const fl = floorAt(h.x, h.y);
    if (h.y >= fl - 4) { h.done = true; G.FX.shards(h.x, fl - 4, 4, h.refl ? GOLDL : '#ffffff', 260); G.FX.ring(h.x, fl - 2, 4, 50, 0.3, '#ffffff', 3, { flat: 0.25 }); return; }
    const ar = G.game.arena;
    if (ar && (h.x < ar.x0 - 80 || h.x > ar.x1 + 80)) { h.done = true; return; }
    const P = g.player, o = h.owner;
    if (!h.refl) {
      if (h.passed) return;
      const hb = P.hurtbox, r = h.big ? 14 : 10;
      if (h.x + r > hb.x && h.x - r < hb.x + hb.w && h.y + r > hb.y && h.y - r < hb.y + hb.h) {
        const res = P.receiveHit(h, { dmg: h.big ? 18 : 13, kb: h.big ? 260 : 180, projectile: true, hx: h.x, hy: h.y });
        if (res === 'parried' && o && !o.dead) {
          const c = o.coreW || { x: o.cx, y: o.cy }, a = Math.atan2(c.y - h.y, c.x - h.x);
          h.refl = true; h.vx = Math.cos(a) * 1050; h.vy = Math.sin(a) * 1050; h.life = h.t + 2;
          G.FX.ring(h.x, h.y, 6, 80, 0.3, GOLDL, 4); sfx('c6_chimeBack');
        } else if (res === 'dodged' || res === 'ignored') h.passed = true;
        else { h.done = true; G.FX.shards(h.x, h.y, 5, '#ffffff', 260); G.FX.spark(h.x, h.y, 8, { col: '#fff4dc', speed: 420 }); }
      }
    } else if (o && !o.dead) {
      const c = o.coreW || { x: o.cx, y: o.cy }, a = Math.atan2(c.y - h.y, c.x - h.x), sp = Math.hypot(h.vx, h.vy);
      h.vx = Math.cos(a) * sp; h.vy = Math.sin(a) * sp;           // homes on the Core it came from
      if (Math.hypot(c.x - h.x, c.y - h.y) < 30) {
        h.done = true;
        const ok = o.takeHit({ dmg: (h.big ? 34 : 24) * (P.dmgMul || 1), bal: h.big ? 95 : 64, hx: c.x, hy: c.y, big: true });
        if (ok) { G.FX.flash(c.x, c.y, 140, 0.35, GOLDL); G.FX.ring(c.x, c.y, 10, 130, 0.4, GOLD, 5); G.FX.shards(c.x, c.y, 10, CRIM, 420); g.hitstop(0.07); g.shake(0.4); sfx('c6_chimeHit'); }
      }
    } else h.done = true;
  }
  function chimeDraw(ctx, h) {
    const col = h.refl ? GOLD : '#ffffff', s = h.big ? 1.35 : 1, sp = Math.hypot(h.vx, h.vy) || 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = U.rgba(h.refl ? GOLD : '#dff8ff', 0.3); ctx.lineWidth = 10 * s;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x - h.vx / sp * 52 * s, h.y - h.vy / sp * 52 * s); ctx.stroke();
    glow(ctx, h.x, h.y, 34 * s, h.refl ? GOLD : '#dff8ff', 0.75);
    // ripple rings (the chime's sound)
    for (let i = 0; i < 2; i++) { const k = (h.t * 2.4 + i * 0.5) % 1; ctx.strokeStyle = U.rgba(col, 0.6 * (1 - k)); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(h.x, h.y, (10 + k * 24) * s, 0, TAU); ctx.stroke(); }
    ctx.restore();
    // the glyph: a small tuning fork, inked
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.spin); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(-6, 2); ctx.quadraticCurveTo(-6, 7, 0, 7); ctx.quadraticCurveTo(6, 7, 6, 2); ctx.lineTo(6, -9); ctx.moveTo(0, 7); ctx.lineTo(0, 14);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = h.refl ? GOLDL : '#ffffff'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.restore();
  }

  /* ================================ attacks ================================ */
  const baton = (ks, t0, t1) => swept(ks, t0, t1, batonPts);
  const tw = (t) => ({ t, c: 'white' }), tr = (t) => ({ t, c: 'red' });
  const ev = (t, fn) => ({ t, fn });
  const cast = (n, ...a) => () => sfx(n, ...a);
  function downbeatFx(e) {
    const q = e.tipW; if (!q) return;
    const fy = floorAt(q.x, e.y);
    if (q.y > fy - 40) { G.FX.dust(q.x, fy, 8, { w: 40, speed: 200, size: 12, col: 'rgba(235,228,240,' }); G.FX.spark(q.x, fy - 6, 8, { col: '#fff0d0', speed: 480, dir: -PI / 2, spread: 2.2 }); G.FX.ring(q.x, fy, 6, 70, 0.3, '#fff4dc', 3, { flat: 0.2 }); G.game.shake(0.2); }
  }
  const swish = (k = 1) => () => { sfx('whoosh', k); sfx('slash', 0.75, false); };

  // P1 · 指揮三拍 THE MEASURE: downbeat · outward · upbeat (white ×3, every 0.5 s), ends on a held fermata
  const MEAS_K = keys([
    [0, {}],
    [0.48, { ...ARM.up, lean: -0.1, hov: 8, head: -0.16, ba: 2.55, be: 2.2, core: 0.2 }],
    [0.64, { fa: -1.12, fe: -1.32, fb: -2.6, lean: -0.13, hov: 10 }, 'lin'],
    [0.74, { ...ARM.down, lean: 0.22, hov: -14, head: 0.12, ba: 1.75, be: 1.1 }, 'snap'],
    [0.96, { fa: 0.55, fe: 1.0, fb: 1.22, lean: 0.2, hov: -12 }],
    [1.1, { ...ARM.back, lean: 0.04, hov: -4, head: -0.04, ba: 2.3, be: 1.9 }],
    [1.24, { ...ARM.out, lean: 0.24, hov: -16, head: 0.08, ba: 2.2, be: 1.6 }, 'snap'],
    [1.42, { fa: 0.85, fe: 0.62, fb: 0.5, lean: 0.22 }],
    [1.6, { ...ARM.low, lean: 0.14, hov: -10, head: 0, ba: 1.7, be: 1.0 }],
    [1.7, { fa: 0.95, fe: 0.8, fb: 0.62, lean: 0.2, hov: -16 }, 'snap'],
    [1.86, { ...ARM.rise, lean: -0.05, hov: 4, head: -0.2 }, 'out'],
    [2.1, { ...ARM.aloft, lean: -0.08, hov: 8, head: -0.26, ba: 1.6, be: 0.6 }],
    [2.55, { fa: -0.93, fe: -1.12, fb: -1.15, lean: -0.06 }, 'lin'],
    [2.95, POSE0],
  ]);
  const measure = {
    name: 'measure', dur: 2.95, cd: 1.05, keys: MEAS_K, at: 'baton',
    tells: [tw(0.2), tw(0.7), tw(1.18)],
    moves: [{ t0: 0.58, t1: 0.72, v: 140 }, { t0: 1.12, t1: 1.22, v: 120 }, { t0: 1.58, t1: 1.68, v: 110 }],
    hits: [
      { t0: 0.7, t1: 0.82, box: baton(MEAS_K, 0.7, 0.8), dmg: 18, kb: 260, pbal: 48 },
      { t0: 1.2, t1: 1.32, box: baton(MEAS_K, 1.2, 1.3), dmg: 18, kb: 260, pbal: 48 },
      { t0: 1.66, t1: 1.8, box: baton(MEAS_K, 1.66, 1.78), dmg: 20, kb: 320, last: true, pbal: 80 },
    ],
    ev: [ev(0.68, swish(1)), ev(0.75, downbeatFx), ev(1.18, swish(1.1)), ev(1.64, swish(1.2)), ev(2.1, cast('c6_chime', -3))],
  };
  // P2 · 四拍子 MEASURE OF FOUR: three quick white beats, a held breath, a red sforzando thrust with a lunge
  const MEAS4_K = keys([
    [0, {}],
    [0.4, { ...ARM.up, lean: -0.1, hov: 8, head: -0.16, ba: 2.55, be: 2.2 }],
    [0.52, { fa: -1.12, fe: -1.32, fb: -2.6, lean: -0.13, hov: 10 }, 'lin'],
    [0.62, { ...ARM.down, lean: 0.22, hov: -14, head: 0.12, ba: 1.75, be: 1.1 }, 'snap'],
    [0.8, { ...ARM.back, lean: 0.04, hov: -4, head: -0.04, ba: 2.3, be: 1.9 }],
    [0.92, { ...ARM.out, lean: 0.24, hov: -16, head: 0.08, ba: 2.2, be: 1.6 }, 'snap'],
    [1.08, { ...ARM.low, lean: 0.14, hov: -10, head: 0, ba: 1.7, be: 1.0 }],
    [1.18, { fa: 0.95, fe: 0.8, fb: 0.62, lean: 0.2, hov: -16 }, 'snap'],
    [1.34, { ...ARM.rise, lean: -0.05, hov: 4, head: -0.2 }, 'out'],
    [1.75, { fa: 1.55, fe: 2.75, fb: 3.05, lean: -0.08, hov: 2, head: -0.12, ba: 0.6, be: 0.2, core: 0.8 }],
    [2.42, { fa: 1.6, fe: 2.85, fb: 3.1, lean: -0.12, hov: 4, core: 1 }, 'lin'],
    [2.54, { fa: 0.6, fe: 0.42, fb: 0.36, lean: 0.36, hov: -26, head: 0.15, ba: 2.4, be: 2.2, core: 0.6 }, 'snap'],
    [3.2, { fa: 0.62, fe: 0.45, fb: 0.4, lean: 0.34, hov: -24 }, 'lin'],
    [3.7, POSE0],
  ]);
  const measure4 = {
    name: 'measure4', dur: 3.7, cd: 1.0, keys: MEAS4_K, at: 'baton',
    // one white tell for the three quick beats (0.3 s apart: a flash per beat would land < 0.45 s before its blow)
    tells: [tw(0.12), tr(1.8)],
    moves: [{ t0: 0.5, t1: 0.6, v: 140 }, { t0: 0.84, t1: 0.92, v: 120 }, { t0: 1.1, t1: 1.18, v: 110 }],
    upd(e, dt, st) {
      const d = Math.abs(e.P.x - e.x);
      // the held breath: it drifts back to give the sforzando room…
      if (st >= 1.8 && st < 2.4 && d < 240) e.vx = -e.facing * Math.min(260, (240 - d) / 0.35);
      // …then the lunge covers only the distance it needs: the blade's reach lands on her, never past her
      if (st >= 2.44 && st < 2.6) e.vx = e.facing * U.clamp((d - 215) / 0.14, 0, 1100) * (st < 2.58 ? 1 : 0.3);
    },
    hits: [
      { t0: 0.58, t1: 0.7, box: baton(MEAS4_K, 0.58, 0.68), dmg: 18, kb: 240, pbal: 44 },
      { t0: 0.88, t1: 1.0, box: baton(MEAS4_K, 0.88, 0.98), dmg: 18, kb: 240, pbal: 44 },
      { t0: 1.14, t1: 1.27, box: baton(MEAS4_K, 1.14, 1.25), dmg: 18, kb: 260, pbal: 50 },
      { t0: 2.5, t1: 2.66, box: baton(MEAS4_K, 2.5, 2.64), dmg: 27, red: true, kb: 440, last: true },
    ],
    ev: [ev(0.56, swish(1)), ev(0.63, downbeatFx), ev(0.86, swish(1.1)), ev(1.12, swish(1.2)), ev(1.8, cast('c6_voice', 2)), ev(2.48, () => { sfx('slash', 0.5, true); sfx('whoosh', 1.5); })],
  };
  // 終止式 CADENCE SLAM: rises, drifts over Rinne, crashes down with both hands (red) → shockwaves; its hands stay stuck
  const SLAM_K = keys([
    [0, {}],
    [0.3, { hov: -14, lean: 0.14, head: 0.22, fa: 1.45, fe: 1.1, fb: 0.9, ba: 1.55, be: 1.05, bh: 1, core: 0.35, wing: 0.85 }],
    [0.88, { hov: 80, lean: -0.12, head: -0.32, fa: -1.25, fe: -1.45, fb: -1.9, ba: -1.95, be: -1.6, bh: 1, core: 1, wing: 1.25, halo: 1.4 }, 'out'],
    [1.08, { hov: 92, lean: -0.18 }, 'lin'],
    [1.18, { hov: -24, lean: 0.48, head: 0.25, fa: 0.85, fe: 1.25, fb: 1.45, ba: 1.0, be: 1.35, core: 0.7, wing: 0.75, halo: 1 }, 'in'],
    [1.34, { hov: -28, lean: 0.52 }],
    [2.4, { hov: -24, lean: 0.49, core: 0.2 }, 'lin'],
    [2.75, { hov: 6, lean: 0.1, head: 0.04, fa: 1.25, fe: 0.5, fb: -0.1, ba: 1.9, be: 1.0, bh: 0, core: 0, wing: 1 }],
    [3.25, POSE0],
  ]);
  function slamImpact(e, rings) {
    const fy = floorAt(e.x, e.y), q = e.hfW || { x: e.x + e.facing * 120, y: fy }, x = q.x;
    G.game.shake(0.9); G.game.hitstop(0.04); sfx('c6_slam', 1.1);
    G.FX.dust(x, fy, LQ() ? 12 : 26, { w: 160, speed: 340, size: 18, col: 'rgba(235,228,240,' });
    G.FX.ring(x, fy, 12, 260, 0.5, CRIM, 7, { flat: 0.18 }); G.FX.shards(x, fy - 6, 14, '#f4eee2', 560); G.FX.shards(x, fy - 6, 6, CRIM, 480);
    G.FX.spark(x, fy - 10, 16, { col: '#fff0d0', speed: 700, dir: -PI / 2, spread: 2.4 });
    shockwave(e, x + 30, 1, fy); shockwave(e, x - 30, -1, fy);
    if (rings) makeRing(e, x, fy - 30, { speed: 400, r0: 20 });
  }
  const slamDef = (name, rings) => ({
    name, dur: 3.25, cd: 1.15, keys: SLAM_K, at: 'hands', track: false,
    tells: [tr(0.3)],
    hits: [{ t0: 1.14, t1: 1.28, box: swept(SLAM_K, 1.14, 1.28, slamPts, 4), dmg: 26, red: true, kb: 440, last: true }],
    ev: [ev(0.32, (e) => { sfx('c6_rise'); G.FX.dust(e.x, e.y, 14, { w: 120, speed: 220, size: 14, col: 'rgba(235,228,240,' }); if (!e.slamHinted) { e.slamHinted = true; G.game.hint('c6_bossSlam'); } }),
      ev(0.9, cast('c6_voice', 2)), ev(1.17, (e) => slamImpact(e, rings)), ev(2.4, (e) => { sfx('c6_crack'); G.FX.spark(e.hfW ? e.hfW.x : e.x, e.y - 8, 10, { col: '#fff0d0', speed: 420, dir: -PI / 2, spread: 1.6 }); })],
    upd(e, dt, st) {
      if (st >= 0.3 && st < 1.08) {
        // drift so the hands come down on her (the hands land ≈ 120 in front of the body)
        const P = e.P, ar = arenaOf(e), tx = U.clamp(P.x + P.vx * 0.15 - e.facing * 125, ar.x0 + 150, ar.x1 - 150);
        e.vx = U.clamp((tx - e.x) * 5, -560, 560) * e.speedMul;
      } else e.vx = U.approach(e.vx, 0, 3000 * dt);
      if (st > 1.2 && st < 2.4 && Math.random() < dt * 6) { const q = e.hfW; if (q) G.FX.spark(q.x, e.y - 6, 2, { col: '#ffd9a0', speed: 300, dir: -PI / 2, spread: 1.4 }); }
    },
  });
  const slam = slamDef('slam', false), slam2 = slamDef('slam2', true);
  // 聖詠管束 CHOIR-PIPE BEAM: the near wing swings forward like a battery; red line first, the beam 0.7 s behind it
  const BEAM_K = keys([
    [0, {}],
    [0.42, { aim: 1, lean: -0.06, head: -0.12, fa: -0.95, fe: -1.15, fb: -1.0, ba: 2.75, be: 2.55, bh: 0, core: 0.4, wing: 1.1, hov: 12 }],
    [2.75, { aim: 1, lean: -0.04, fa: -1.0, fe: -1.2, fb: -1.1, hov: 14 }, 'lin'],
    [3.2, { aim: 0, lean: 0.04, head: 0.06, fa: 1.2, fe: 0.42, fb: -0.42, ba: 1.95, be: 0.95, core: 0, wing: 1 }],
    [3.75, POSE0],
  ]);
  const beam = {
    name: 'beam', dur: 3.75, cd: 1.1, keys: BEAM_K, at: 'pipes', track: false,
    tells: [tr(0.3)],
    ev: [ev(0.38, (e) => makeBeam(e, { near: 150, dir: 1, delay: 0.06, lead: 0.7, sweep: 1.45, src: 'wing' })), ev(0.1, cast('c6_organ', 0.5, 1))],
    upd(e, dt, st) { if (st > 2.8 && st < 3.4 && Math.random() < dt * 14 && e.beamO) G.FX.dust(e.beamO.x, e.beamO.y, 1, { w: 14, speed: 60, size: 12, col: 'rgba(240,236,246,', dir: -PI / 2, spread: 0.5 }); },
  };
  // P2 · 交替聖詠 ANTIPHON: the exposed Core sings two beams — outward, then back toward itself
  const ANTI_K = keys([
    [0, {}],
    [0.45, { lean: -0.12, head: -0.25, fa: -0.5, fe: -0.3, fb: -0.5, ba: 2.6, be: 2.9, core: 1, hov: 10, halo: 1.4 }],
    [4.4, { lean: -0.1, hov: 12 }, 'lin'],
    [4.9, POSE0],
  ]);
  const antiphon = {
    name: 'antiphon', dur: 4.9, cd: 1.1, keys: ANTI_K, at: 'core', track: false,
    tells: [tr(0.3), tr(1.95)],
    ev: [ev(0.36, (e) => makeBeam(e, { near: 120, dir: 1, delay: 0.06, lead: 0.7, sweep: 1.25, src: 'core' })),
      ev(2.0, (e) => makeBeam(e, { near: 110, dir: -1, delay: 0.02, lead: 0.7, sweep: 1.25, src: 'core' })), ev(0.1, cast('c6_choir', 0.8, 2))],
  };
  // 調音叉 TUNING-FORK CHIMES: the fork is struck in rhythm; each strike sends a white chime (perfect guard reflects it)
  function chimeKeys(times) {
    const list = [[0, {}], [0.42, { ...FORK, ...TAP_UP, lean: -0.04, head: 0.12, core: 0.3 }]];
    for (const T of times) { list.push([T - 0.12, { ...TAP_UP, fb: -1.3 }]); list.push([T, TAP_HIT, 'snap']); list.push([T + 0.14, { fa: -1.17, fe: -0.3, fb: 0.6 }]); }
    const end = times[times.length - 1];
    list.push([end + 0.45, { ...TAP_UP, head: 0.22 }], [end + 0.95, { fork: 0, ba: 1.95, be: 0.95, bh: 0 }], [end + 1.35, POSE0]);
    return keys(list);
  }
  const C3 = [0.8, 1.3, 1.8], C5 = [0.72, 1.14, 1.56, 1.98, 2.4];
  const chime = {
    name: 'chime', dur: C3[2] + 1.35, cd: 1.0, keys: chimeKeys(C3), at: 'fork', track: false,
    tells: C3.map((t) => tw(t - 0.46)),
    ev: C3.map((t, i) => ev(t, (e) => { fireChime(e, { speed: 470 }); sfx('c6_chime', i); })),
  };
  const chime5 = {
    name: 'chime5', dur: C5[4] + 1.35, cd: 1.0, keys: chimeKeys(C5), at: 'fork', track: false,
    tells: C5.map((t) => tw(t - 0.46)),
    ev: C5.map((t, i) => ev(t, (e) => { fireChime(e, { speed: 500, lob: i === 1 || i === 3, big: i === 4 }); sfx('c6_chime', i); })),
  };
  // 和聲環 HARMONIC RINGS: arms open, the halo flares, rings of sound roll out of the Core
  const RINGS_K = keys([
    [0, {}],
    [0.5, { ...SPREAD, lean: -0.08, head: -0.2, hov: 10, halo: 1.6, core: 1, wing: 1.2 }],
    [1.95, { fa: -0.3, fe: -0.2, fb: -0.35, hov: 14, halo: 1.7 }, 'lin'],
    [2.3, { ...POSE0, halo: 1.1 }],
    [2.7, POSE0],
  ]);
  const rings = {
    name: 'rings', dur: 2.7, cd: 1.0, keys: RINGS_K, at: 'core', track: false,
    tells: [tw(0.25), tw(0.75), tw(1.2)],
    ev: [0.75, 1.2, 1.65].map((t) => ev(t, (e) => { const c = e.coreW || { x: e.x, y: e.y - 200 }; makeRing(e, c.x, c.y, { speed: 430 }); G.FX.ring(c.x, c.y, 10, 60, 0.25, GOLDL, 4); })),
  };
  const RCH_K = keys([
    [0, {}],
    [0.45, { ...SPREAD, lean: -0.08, head: -0.2, hov: 10, halo: 1.6, core: 1, wing: 1.2 }],
    [1.7, { hov: 12 }, 'lin'],
    [2.0, { fa: 1.45, fe: -2.52, fb: 1.6, ba: 1.6, be: -0.6, lean: 0.14, head: 0.3, hov: -6, core: 1, halo: 1.2 }],
    [2.3, { ...SPREAD, lean: -0.14, head: -0.3, hov: 14, core: 1, halo: 1.9 }, 'snap'],
    [2.8, { hov: 10 }],
    [3.3, POSE0],
  ]);
  const ringChord = {
    name: 'ringChord', dur: 3.3, cd: 1.05, keys: RCH_K, at: 'core', track: false,
    tells: [tw(0.2), tw(0.62), tw(1.04), tr(1.6)],
    ev: [0.66, 1.08, 1.5].map((t) => ev(t, (e) => { const c = e.coreW || { x: e.x, y: e.y - 200 }; makeRing(e, c.x, c.y, { speed: 450 }); }))
      .concat([ev(2.3, (e) => { const c = e.coreW || { x: e.x, y: e.y - 200 }; makeRing(e, c.x, c.y, { speed: 400, red: true }); G.FX.flash(c.x, c.y, 160, 0.35, CRIM); G.game.shake(0.4); })]),
  };
  // 休止 THE REST: when she stands under it — gathers itself, then a white burst all around the robe
  const PULSE_K = keys([
    [0, {}],
    [0.38, { ...PRAY, lean: 0.12, hov: -10, head: 0.3, core: 0.7, wing: 0.8 }],
    [0.5, { ...SPREAD, lean: -0.1, hov: 8, head: -0.15, core: 1, wing: 1.3, halo: 1.5 }, 'snap'],
    [0.9, { hov: 6 }],
    [1.45, POSE0],
  ]);
  const pulse = {
    name: 'pulse', dur: 1.45, cd: 0.9, keys: PULSE_K, at: 'core', track: false,
    tells: [tw(0.03)],
    hits: [{ t0: 0.5, t1: 0.62, box: { x: -185, y: -250, w: 370, h: 250 }, dmg: 15, kb: 380, last: true, pbal: 60 }],
    ev: [ev(0.5, (e) => { const c = e.coreW || { x: e.x, y: e.y - 200 }; sfx('c6_pulse'); G.FX.ring(c.x, c.y + 60, 20, 210, 0.35, '#fff4dc', 7, { flat: 0.55 }); G.FX.ring(e.x, e.y - 4, 20, 200, 0.4, '#ffffff', 5, { flat: 0.2 }); G.FX.dust(e.x, e.y, 16, { w: 260, speed: 300, size: 14, col: 'rgba(235,228,240,' }); G.game.shake(0.35); })],
  };
  // 管風琴墜落 ORGAN-PIPE RAIN: a crescendo; pipes fall from the vault onto red marks
  const PIPES_K = keys([
    [0, {}],
    [0.5, { fa: -1.05, fe: -1.25, fb: -1.55, ba: -1.95, be: -1.6, bh: 0, hov: 18, lean: -0.1, head: -0.38, halo: 1.5, core: 0.8, wing: 1.25 }],
    [1.9, { hov: 22, fa: -1.1, fe: -1.3 }, 'lin'],
    [2.4, POSE0],
  ]);
  const pipes = {
    name: 'pipes', dur: 2.4, cd: 0.9, keys: PIPES_K, at: 'halo', track: false, haz: true,
    tells: [tr(0.25)],
    ev: [ev(0.3, cast('c6_organ', 0.8, 1))].concat([0, 1, 2, 3, 4].map((i) => ev(0.55 + i * 0.34, (e) => { const P = e.P; makePipe(e, P.x + P.vx * 0.45 + (i % 2 ? 1 : -1) * (i ? 30 : 0), { seed: i }); }))),
  };
  const pipes2 = {
    name: 'pipes2', dur: 2.9, cd: 0.9, keys: PIPES_K, at: 'halo', track: false, haz: true,
    tells: [tr(0.25)],
    ev: [ev(0.3, cast('c6_organ', 0.9, 2)),
      ev(0.5, (e) => { const ar = arenaOf(e), n = 8, gap = (ar.x1 - ar.x0 - 160) / (n - 1), off = Math.random() < 0.5 ? 0 : 1; for (let i = off; i < n; i += 2) makePipe(e, ar.x0 + 80 + i * gap, { seed: i, crim: true, delay: (i % 4) * 0.04 }); e.pipeOff = off; }),
      ev(1.25, (e) => { const ar = arenaOf(e), n = 8, gap = (ar.x1 - ar.x0 - 160) / (n - 1); for (let i = 1 - (e.pipeOff || 0); i < n; i += 2) makePipe(e, ar.x0 + 80 + i * gap, { seed: i + 9, crim: true, delay: (i % 4) * 0.04 }); })]
      .concat([0, 1, 2].map((i) => ev(1.95 + i * 0.3, (e) => { const P = e.P; makePipe(e, P.x + P.vx * 0.4, { seed: 30 + i }); }))),
  };
  // once, in the second movement: it wakes two Ark Wardens
  const SUMMON_K = keys([
    [0, {}],
    [0.6, { fa: -1.05, fe: -1.25, fb: -1.4, ba: -1.95, be: -1.6, bh: 0, hov: 16, lean: -0.1, head: -0.3, halo: 1.6, core: 0.8 }],
    [1.6, { hov: 20 }, 'lin'],
    [2.2, POSE0],
  ]);
  function summonWardens(e) {
    const ar = arenaOf(e), P = G.game.player;
    e.summoned = true;
    sfx('c6_choir', 1, 2); sfx('c6_organ', 0.7, 2); G.game.shake(0.4);
    if (!TYPES.c6_warden) return;
    for (const side of [0, 1]) {
      let x = side ? ar.x1 - 150 : ar.x0 + 150;
      if (Math.abs(x - P.x) < 220) x += side ? -260 : 260;
      const y = floorAt(x, e.y), m = new G.Enemy('c6_warden', x, y, { enc: e.enc });
      m.facing = P.x < x ? -1 : 1; G.game.enemies.push(m);
      G.FX.shards(x, y - 10, 12, CYAN, 320); G.FX.ring(x, y - 70, 10, 130, 0.5, GOLDL, 4);
      if (G.game.save) G.game.save.flags.seen_c6_warden = true;
    }
  }
  const summon = { name: 'summon', dur: 2.2, cd: 0.8, keys: SUMMON_K, at: 'halo', track: false, tells: [], ev: [ev(0.3, cast('c6_voice', 2)), ev(1.0, summonWardens)] };
  // phase-2 transformation: the organ pipes tear off and crash down, the chest bursts open on the choir-core
  const TRANS_K = keys([
    [0, { lean: 0.3, head: 0.5, hov: -18, fa: 1.5, fe: 1.3, fb: 1.2, ba: 1.7, be: 1.4, core: 0.5, wing: 0.9 }],
    [0.7, { lean: -0.25, head: -0.55, hov: 12, fa: -0.6, fe: -0.4, fb: -0.7, ba: 2.6, be: 2.9, core: 1, wing: 1.35, halo: 1.8 }, 'out'],
    [1.7, { lean: -0.28, hov: 16 }, 'lin'],
    [2.05, { ...PRAY, lean: 0.15, head: 0.2, hov: -6, core: 1, wing: 0.6, halo: 1.2 }],
    [2.25, { ...SPREAD, lean: -0.12, head: -0.2, hov: 10, core: 1, halo: 1.6 }, 'snap'],
    [3.2, POSE0],
  ]);
  function tearPipes(e) {
    // seven of the twelve wing pipes lift off and crash down on marked spots around it (never on top of her)
    const P = G.game.player, ar = arenaOf(e), spots = [];
    for (let guard = 0; spots.length < 7 && guard < 200; guard++) {
      const x = e.x + U.rand(-420, 420);
      if (x < ar.x0 + 60 || x > ar.x1 - 60 || Math.abs(x - P.x) < 110 || Math.abs(x - e.x) < 70 || spots.some((s) => Math.abs(s - x) < 70)) continue;
      spots.push(x);
    }
    const src = e.wingW || [];
    spots.forEach((x, i) => {
      const w = src[i % Math.max(1, src.length)] || { x: e.x, y: e.y - 350, ang: -PI / 2 };
      makePipe(e, x, { delay: 0.04 + i * 0.075, warn: 0.75, from: w, len: w.len || 200, wid: w.wid || 16, crim: true, metal: !!w.metal, seed: 50 + i });
    });
  }
  const transform = {
    name: 'transform', dur: 3.2, cd: 0.5, keys: TRANS_K, at: 'core', track: false,
    tells: [],
    ev: [ev(0.05, cast('c6_organ', 1.1, 2)), ev(0.7, (e) => { tearPipes(e); sfx('c6_shatter'); G.game.shake(0.8); }),
      ev(2.24, (e) => {
        const c = e.coreW || { x: e.x, y: e.y - 200 };
        sfx('c6_shatter'); sfx('c6_choir', 1.2, 2); G.game.shake(1);
        G.FX.flash(c.x, c.y, 260, 0.5, CRIM); G.FX.ring(c.x, c.y, 20, 420, 0.8, CRIM, 7);
        G.FX.shards(c.x, c.y, LQ() ? 14 : 30, '#f4eee2', 640); G.FX.shards(c.x, c.y, 18, GOLD, 520); G.FX.shards(c.x, c.y, 16, CRIM, 560);
      })],
    upd(e, dt, st) {
      e.invuln = st < 3.0;
      e.pipesK = Math.max(e.pipesK || 0, clamp01((st - 0.7) / 0.9));
      e.openK = Math.max(e.openK || 0, clamp01((st - 2.18) / 0.22));
      e.vx = U.approach(e.vx, 0, 2000 * dt);
      if (st > 0.6 && st < 2.2 && Math.random() < dt * 30) { const c = e.coreW; if (c) G.FX.ember(c.x, c.y, 2, CRIM, { w: 80, h: 80, up: 120 }); }
    },
  };
  const MOVES = { measure, measure4, slam, slam2, beam, antiphon, chime, chime5, rings, ringChord, pulse, pipes, pipes2, summon, transform };
  const HAZ = { pipes: 1, pipes2: 1 };

  /* ================================ AI ================================ */
  function choose(e, d) {
    const p2 = e.phase === 2, pool = [];
    const add = (k, w) => { if (w > 0) pool.push([k, w]); };
    if (p2 && !e.summoned && e.hp < e.maxHp * 0.32 && TYPES.c6_warden) { e.summoned = true; e.lastMoves.push('summon'); e.startAtk(summon); return; }
    const M = p2 ? 'measure4' : 'measure', SL = p2 ? 'slam2' : 'slam', CH = p2 ? 'chime5' : 'chime', RG = p2 ? 'ringChord' : 'rings', BM = p2 ? 'antiphon' : 'beam';
    if (d < 135) { add('pulse', 3.4); add(SL, 1.0); add(RG, 0.9); }
    else if (d < 335) { add(M, 4); add(SL, 1.8); add(CH, 1.2); add(RG, 1.0); add(BM, 0.5); }
    else { add(BM, 3); add(CH, 2.6); add(SL, d < 560 ? 1.3 : 0); add(RG, 0.6); }
    if (e.t >= e.hazAt) add(p2 ? 'pipes2' : 'pipes', 2.6);
    if (!pool.length) return;
    const last = e.lastMoves[e.lastMoves.length - 1], prev = e.lastMoves[e.lastMoves.length - 2];
    const wOf = (p) => (p[0] === last ? p[1] * 0.15 : p[0] === prev ? p[1] * 0.6 : p[1]);
    let r = Math.random() * pool.reduce((s, p) => s + wOf(p), 0), pick = pool[0][0];
    for (const p of pool) { if ((r -= wOf(p)) <= 0) { pick = p[0]; break; } }
    if (HAZ[pick]) e.hazAt = e.t + (p2 ? 10 : 12.5);
    e.lastMoves.push(pick); if (e.lastMoves.length > 6) e.lastMoves.shift();
    e.startAtk(MOVES[pick]);
  }

  /* ================================ the type ================================ */
  const BOSS = TYPES.c6_boss = Object.assign({
    name: '方舟之心・頌者', en: "CANTOR — THE ARK'S MIND", w: 150, h: 300, hp: 2500, bal: 340, shards: 960,
    boss: true, poise: true, kbMul: 0.15, spawnT: 3.6, scale: SC, portrait: [1.0, 0.98],
    defeatDialog: 'c6_bossDefeat', phase2Bark: 'c6_bossP2', phase2Music: 'c6_boss2',
    get col() { const b = G.game && G.game.bossRef; return b && b.type === 'c6_boss' && b.phase === 2 ? CRIM : '#f6ecd6'; },
    init(e) {
      e.facing = -1; e.homeX = e.x; e.lastMoves = []; e.hazAt = e.t + 7; e.turnT = -1; e.behindT = 0; e.humT = 0;
      e.pipesK = 0; e.openK = 0; e.summoned = false; e.introEv = {}; e.infDone = {}; e.trail = []; e.notes = [];
      e.stole = [new Rig.Chain(10, 13, 0.05, 0.9), new Rig.Chain(10, 13, 0.05, 0.9)];
      e.veil = [new Rig.Chain(9, 15, 0.03, 0.92), new Rig.Chain(8, 15, 0.03, 0.92)];
      e.cables = [new Rig.Chain(12, 14, 0.01, 0.95), new Rig.Chain(18, 15, 0.01, 0.95), new Rig.Chain(18, 13, 0.012, 0.95)]; e.goneFx = {};

      // the hurt box follows the body when it rises for the slam (its robe never touches the floor)
      Object.defineProperty(e, 'box', { configurable: true, get() { const r = this.lift || 0; return { x: this.x - this.w / 2, y: this.y - this.h - r, w: this.w, h: this.h }; } });
      Object.defineProperty(e, 'cy', { configurable: true, get() { return this.y - this.h / 2 - (this.lift || 0); } });
    },
    voice(e) { if (Math.random() < 0.45) sfx('c6_voice', e.phase); },
    weapon(e) {
      const a = e.atk, at = a ? a.at : 'baton';
      if (at === 'core') return e.coreW || { x: e.x, y: e.y - 200 };
      if (at === 'fork') return e.forkW || e.coreW || { x: e.x, y: e.y - 220 };
      if (at === 'pipes') return e.beamO || { x: e.x, y: e.y - 330 };
      if (at === 'halo') return e.haloW || { x: e.x, y: e.y - 300 };
      if (at === 'hands') return e.coreW || { x: e.x, y: e.y - 220 };
      const g = e.gripW, t = e.tipW;
      return g && t ? lerpP(g, t, 0.45) : { x: e.x + e.facing * 150, y: e.y - 160 };
    },
    think(e, dt) {
      e.invuln = false;
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) { G.game.bossPhase2(e); return; }
      const P = e.P, ar = arenaOf(e), dx = P.x - e.x, d = Math.abs(dx), side = dx >= 0 ? 1 : -1, p2 = e.phase === 2;
      e.humT -= dt; if (e.humT <= 0) { e.humT = 1.4 + Math.random(); if (d < 900) sfx('c6_hum'); }
      // a turn is a slow, graceful pivot of the whole choir (a window to punish from behind)
      if (e.turnT >= 0) {
        const TD = p2 ? 0.38 : 0.5;
        e.turnT += dt; e.vx = U.approach(e.vx, 0, 900 * dt);
        if (!e.turnFlip && e.turnT >= TD / 2) { e.turnFlip = true; e.facing = -e.facing; }
        if (e.turnT >= TD) { e.turnT = -1; e.cd = Math.max(e.cd, 0.2); }
        return;
      }
      if (side !== e.facing && d > 40) {
        e.behindT += dt; e.vx = U.approach(e.vx, 0, 900 * dt);
        if (e.behindT > (p2 ? 0.2 : 0.32)) { e.behindT = 0; e.turnT = 0; e.turnFlip = false; sfx('c6_hum'); }
        return;
      }
      e.behindT = 0;
      // glide to a conductor's distance; drift back when she is under the robe
      const sp = (p2 ? 160 : 125) * e.speedMul, want = 250;
      let tv = 0;
      if (d > want + 70) tv = e.facing * sp; else if (d < 120) tv = -e.facing * 90;
      e.vx = U.approach(e.vx, tv, 520 * dt);
      e.x = U.clamp(e.x, ar.x0 + 150, ar.x1 - 150);
      if (e.cd > 0) return;
      // while its wardens stand, it conducts them and attacks less often
      const adds = e.summoned && G.game.enemies.some((o) => o !== e && !o.dead && o.enc === e.enc);
      if (adds && !e.waited) { e.waited = true; e.cd = 0.8; return; }
      e.waited = false;
      choose(e, d);
    },
    atkUpdate(e, dt) {
      const a = e.atk; if (!a) return;
      if (a !== transform) e.invuln = false;
      if (a.upd) a.upd(e, dt, e.st);
      const ar = arenaOf(e);
      e.x = U.clamp(e.x, ar.x0 + 150, ar.x1 - 150);
    },
    onPhase2(e, game) {
      e.hazAt = e.t + 9;
      if (e.beamH) { e.beamH.cut = e.beamH.t; e.beamH = null; }
      e.startAtk(transform);
      G.FX.ember(e.x, e.y - 220, 30, CRIM, { w: 160, h: 220, up: 220 });
      game.shake(1);
    },
    onHit(e, h) {
      if (Math.random() < 0.5) sfx('armor');
      // infection blooms as the Core weakens
      const inf = infOf(e);
      SITES.forEach((s, i) => {
        if (inf >= s.th && !e.infDone[i]) {
          e.infDone[i] = true;
          const q = siteW(e, s);
          if (q) { G.FX.shards(q.x, q.y, 6, CRIM, 300); G.FX.spark(q.x, q.y, 6, { col: CRIML, speed: 320 }); }
          sfx('c6_crack');
        }
      });
    },
    draw(ctx, e, ghost) { drawCantor(ctx, e, !!ghost); },
  }, MOVES);

  /* ================================ crimson infection ================================ */
  const infOf = (e) => clamp01((1 - e.hp / e.maxHp) * 1.12 + (e.phase === 2 ? 0.06 : 0));
  // frame: torso (origin waist, leaned) · robe · head (origin head centre) · pf/pb (near / far pauldron)
  const SITES = [
    { f: 'torso', x: -8, y: -40, a: 2.3, s: 0.8, th: 0.07 },
    { f: 'robe', x: -62, y: 104, a: 2.5, s: 1.15, th: 0.15 },
    { f: 'pf', x: 4, y: -6, a: -1.3, s: 0.95, th: 0.23 },
    { f: 'head', x: 12, y: 6, a: 1.65, s: 0.5, th: 0.3 },
    { f: 'torso', x: 42, y: -72, a: -0.5, s: 0.85, th: 0.37 },
    { f: 'robe', x: 52, y: 62, a: 0.25, s: 0.95, th: 0.44 },
    { f: 'pb', x: -2, y: -6, a: -1.9, s: 0.9, th: 0.52 },
    { f: 'torso', x: -40, y: -84, a: -2.3, s: 1.0, th: 0.58 },
    { f: 'robe', x: -18, y: 132, a: 1.75, s: 1.25, th: 0.66 },
    { f: 'head', x: -12, y: -30, a: -2.0, s: 0.85, th: 0.74 },
    { f: 'robe', x: 76, y: 128, a: 0.55, s: 1.05, th: 0.82 },
    { f: 'torso', x: 22, y: -18, a: 1.1, s: 0.9, th: 0.9 },
  ];
  function siteW(e, s) {
    const g = e.lastGeo; if (!g) return null;
    let q;
    if (s.f === 'torso') q = g.T(s.x, s.y); else if (s.f === 'robe') q = g.R(s.x, s.y);
    else if (s.f === 'head') { const r = rot(s.x, s.y, g.ha); q = { x: g.hd.x + r.x, y: g.hd.y + r.y }; }
    else q = s.f === 'pf' ? g.sf : g.sb;
    return { x: e.x + e.facing * SC * q.x, y: e.y + SC * q.y };
  }
  function drawSites(ctx, frame, inf, t, ghost) {
    if (inf <= 0.02) return;
    for (const s of SITES) {
      if (s.f !== frame || inf < s.th) continue;
      const k = U.easeOutBack(clamp01((inf - s.th) / 0.1)) * (1 + 0.04 * Math.sin(t * 3 + s.x));
      // veins crawling out over the enamel first
      ctx.strokeStyle = U.rgba(CRIMD, 0.75); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      const vl = 26 * s.s * clamp01((inf - s.th) / 0.25 + 0.3);
      ctx.beginPath();
      for (const da of [-1.1, 0.9, 2.8]) {
        const a = s.a + PI + da; ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo(s.x + Math.cos(a) * vl * 0.5 + Math.cos(a + 1.2) * 5, s.y + Math.sin(a) * vl * 0.5 + Math.sin(a + 1.2) * 5, s.x + Math.cos(a) * vl, s.y + Math.sin(a) * vl);
      }
      ctx.stroke(); ctx.strokeStyle = U.rgba(CRIM, 0.9); ctx.lineWidth = 0.9; ctx.stroke();
      crystal(ctx, s.x, s.y, s.a, s.s * k, ghost ? 0 : 0.35);
    }
  }

  /* ================================ rendering ================================ */
  function lookOf(e) {
    const st = e.state, a = st === 'atk' ? e.atk : null;
    const L = { inf: infOf(e), p2: e.pipesK || 0, open: e.openK || 0, lit: 1, haloOn: 1, coreOn: 1, eyes: 1, red: 0, ts: 1, alpha: 1, flick: 1, wreck: 0, spared: 0, broken: st === 'broken' || st === 'executed' };
    if (st === 'spawn') {
      const s = e.st;
      L.coreOn = 0.18 + 0.82 * clamp01((s - 0.5) / 0.6);
      L.haloOn = clamp01((s - 1.1) / 0.9);
      L.lit = clamp01((s - 1.8) / 0.8);
      L.eyes = clamp01((s - 2.2) / 0.3);
    }
    if (L.broken) { L.flick = Math.sin(e.t * 23) > 0.3 ? 0.35 : 0.9; L.eyes = 0.25; L.lit = 0.25; L.haloOn = 0.45; }
    // while a red (unblockable) phrase is building, the Core burns crimson — the warning outlives the tell star
    L.red = 0;
    if (a) { const rt = (a.tells || []).find((tl) => tl.c === 'red'), end = a.hits && a.hits.length ? a.hits[a.hits.length - 1].t1 : a.dur * 0.75; if (rt && e.st >= rt.t) L.red = clamp01((e.st - rt.t) / 0.25) * (1 - clamp01((e.st - end) / 0.3)); }
    if (e.turnT >= 0) { const TD = e.phase === 2 ? 0.38 : 0.5; L.ts = Math.max(0.1, Math.abs(Math.cos(PI * e.turnT / TD))); }
    return L;
  }
  function targetPose(e) {
    const st = e.state;
    if (st === 'spawn') return sample(INTRO_K, e.st);
    if (st === 'atk' && e.atk && e.atk.keys) return sample(e.atk.keys, e.st);
    if (st === 'broken') return BROKEN(e.t);
    if (st === 'executed') return lerpPose(BROKEN(e.t), HURT, 0.3);
    if (st === 'hurt' || st === 'recoil') return lerpPose(IDLE(e.t), HURT, st === 'recoil' ? Math.sin(Math.min(1, e.st / 0.6) * PI) : 1);
    const p = IDLE(e.t);
    if (Math.abs(e.vx) > 25) { const m = U.clamp(e.vx * e.facing / 160, -1, 1); p.lean += m * 0.12; p.head -= m * 0.05; p.wing -= Math.abs(m) * 0.1; p.fb -= m * 0.2; }
    if (e.phase === 2) { p.halo = 1.25; p.lean += Math.sin(e.t * 9.3) * 0.006; }
    return p;
  }
  function updPose(e, dt) {
    const tp = targetPose(e);
    if (!e.pose || e.state === 'spawn') e.pose = tp;
    else e.pose = lerpPose(e.pose, tp, 1 - Math.exp(-(e.state === 'atk' ? 34 : e.state === 'hurt' || e.state === 'recoil' ? 22 : 9) * dt));
    const k = e.hitK;
    return k > 0 ? Object.assign({}, e.pose, { lean: e.pose.lean - 0.1 * k, head: e.pose.head - 0.28 * k, hov: e.pose.hov + 4 * k }) : e.pose;
  }

  function drawCantor(ctx, e, ghost) {
    const dt = ghost ? 0 : vdt();
    if (e.state === 'die') { if (!ghost && !e.wreck) spawnWreck(e); return; }
    if (!ghost && dt > 0) introEvents(e);
    const p = Object.assign({}, updPose(e, dt)), L = lookOf(e);

    e.lift = e.state === 'atk' && (e.atk === slam || e.atk === slam2) ? Math.max(0, p.hov * SC - 10) : 0;
    renderBody(ctx, e, p, L, ghost, dt);
    if (!ghost && DBG) drawDebug(ctx, e);
  }

  function renderBody(ctx, e, p, L, ghost, dt) {
    const f = e.facing, t = e.t, g = geo(p), sx = f * L.ts * SC;
    const toW = (q) => ({ x: e.x + sx * q.x, y: e.y + SC * q.y });
    const toL = (q) => ({ x: (q.x - e.x) / sx, y: (q.y - e.y) / SC });
    if (!ghost && !L.wreck) {
      e.lastGeo = g; e.coreW = toW(g.core); e.tipW = toW(g.tip); e.gripW = toW(g.gf); e.hfW = toW(g.hf); e.haloW = toW(g.hc);
      e.forkW = p.fork > 0.3 ? toW(g.fk) : null;
      if (dt > 0) {
        e.trail.push({ tx: e.tipW.x, ty: e.tipW.y, gx: e.gripW.x, gy: e.gripW.y, t: e.t });
        while (e.trail.length && (e.t - e.trail[0].t > 0.11 || e.trail.length > 9)) e.trail.shift();
      }
    }
    if (!ghost && dt > 0) { updCloth(e, g, p, L, dt, toW); updNotes(e, dt, L); }
    ctx.save();
    if (L.alpha < 1) ctx.globalAlpha *= L.alpha;
    // contact shadow + a cool dark backing that keeps the white enamel readable against bright halls
    const hemY = g.R(0, 144).y, lift = clamp01((-hemY - 10) / 160);
    if (!ghost) {
      ctx.save(); ctx.globalAlpha *= 0.55 * (1 - lift * 0.6); ctx.fillStyle = 'rgba(16,8,30,0.5)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, 150 * (1 - lift * 0.4), 13, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.translate(e.x, e.y); ctx.scale(sx, SC);
    ctx.beginPath(); ctx.rect(-900, -1400, 1800, 1401); ctx.clip();
    const ls = Rig.lightDir(ctx).x > 0 ? 1 : -1;
    if (!ghost) {
      shade(ctx, g.W.x, g.W.y - 90, 190, 230, '#140a26', 0.38);
      glow(ctx, g.core.x, g.core.y, 120 + (p.core || 0) * 40, L.open > 0.5 || L.red > 0.3 ? CRIM : CYAN, (0.12 + 0.12 * (p.core || 0) + 0.12 * L.red) * L.coreOn * L.flick);
    }
    // ---------- cables · wings · halo · veil ----------
    drawCables(ctx, e, toL);
    drawWings(ctx, e, g, p, L, ls, ghost, toW);
    drawHalo(ctx, e, g, p, L, ghost);
    drawVeil(ctx, e, toL, L);

    const backFront = p.fork > 0.2 || (g.hb.x > g.W.x + 14 && g.hb.y < g.W.y + 40);
    if (!backFront) drawArm(ctx, e, g, p, L, false, ls, ghost);
    // ---------- body ----------
    drawRobe(ctx, e, g, p, L, ls, ghost);
    drawPauldron(ctx, g, p, L, false, ls, ghost);
    drawTorso(ctx, e, g, p, L, ls, ghost);
    drawCore(ctx, e, g, p, L, ghost);
    drawPauldron(ctx, g, p, L, true, ls, ghost);
    drawStole(ctx, e, toL);
    drawHead(ctx, e, g, p, L, ls, ghost);
    if (backFront) drawArm(ctx, e, g, p, L, false, ls, ghost);
    drawArm(ctx, e, g, p, L, true, ls, ghost);
    // tell glow on the part about to strike
    if (!ghost && e.tellT > 0 && e.state === 'atk') {
      const w = BOSS.weapon(e), q = toL(w);
      glow(ctx, q.x, q.y, 70, e.tellCol === 'red' ? CRIM : '#ffffff', Math.min(1, e.tellT * 1.7));
    }
    ctx.restore();
    if (!ghost) drawNotes(ctx, e);
    if (!ghost && !L.wreck) drawSmear(ctx, e, L);
    if (!ghost && L.broken) drawDazed(ctx, e, g, toW);
    if (!ghost && dt > 0 && (L.broken || (e.phase === 2 && Math.random() < 0.3)) && Math.random() < dt * (L.broken ? 10 : 3)) {
      const c = e.coreW; if (c) { G.FX.spark(c.x, c.y, 3, { col: L.broken ? '#ffd9a0' : CRIML, speed: 320 }); if (L.broken) G.FX.dust(c.x, c.y, 1, { w: 30, speed: 40, size: 16, col: 'rgba(40,30,60,' }); }
    }
  }

  /* ---------------- cloth (world space) ---------------- */
  function updCloth(e, g, p, L, dt, toW) {
    const f = e.facing, wind = -e.vx * 2.6 + Math.sin(e.t * 1.1) * 140 + Math.sin(e.t * 2.7) * 40;
    // stole: from both sides of the ruff, hanging over the chest
    const a1 = toW(g.T(-18, -102)), a2 = toW(g.T(30, -102));
    e.stole[0].update(a1.x, a1.y, f, dt, wind, PI - 0.05);
    e.stole[1].update(a2.x, a2.y, f, dt, wind, PI + 0.05);
    // veil: two long streamers from the back of the cowl
    const hr = (x, y) => { const r = rot(x, y, g.ha); return toW({ x: g.hd.x + r.x, y: g.hd.y + r.y }); };
    const v1 = hr(-24, -26), v2 = hr(-28, 0);
    e.veil[0].update(v1.x, v1.y, f, dt, wind * 1.3 - f * 120, 2.45);
    e.veil[1].update(v2.x, v2.y, f, dt, wind * 1.2 - f * 90, 2.7);
    // cables: two loops slung from the far wing's spar to the back of the robe, and a heavy lead trailing on the deck
    const fy = e.y - 3, sp = e.cableA || [toW(g.T(-70, -110)), toW(g.T(-100, -120))];
    const heads = [sp[0], sp[1], toW(g.R(-34, 30))], tails = [toW(g.R(-50, 22)), toW(g.R(-82, 112)), null];
    e.cables.forEach((c, i) => {
      const q = heads[i], tl = tails[i];
      c.update(q.x, q.y, f, dt, wind * 0.25 - f * 150, tl ? 2.2 : 2.9);
      const P = c.p, n = c.n, extra = 1800 * dt * dt;          // heavy: cables fall harder than cloth
      for (let k = 1; k < n; k++) P[k].y += extra;
      if (tl) {
        // pinned at both ends: relax the links back from the robe so it hangs as a catenary
        P[n - 1].x = tl.x; P[n - 1].y = tl.y;
        for (let it = 0; it < 4; it++) {
          for (let k = n - 2; k >= 1; k--) { const a = P[k + 1], b = P[k], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, df = (d - c.seg) / d; b.x -= dx * df * 0.5; b.y -= dy * df * 0.5; }
          for (let k = 1; k < n - 1; k++) { const a = P[k - 1], b = P[k], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, df = (d - c.seg) / d; b.x -= dx * df * 0.5; b.y -= dy * df * 0.5; }
          P[0].x = q.x; P[0].y = q.y; P[n - 1].x = tl.x; P[n - 1].y = tl.y;
        }
      }
      for (let k = 1; k < n; k++) { const pt = P[k]; if (pt.y > fy) { pt.y = fy; pt.py = fy + (pt.py - fy) * 0.2; pt.px = pt.x + (pt.px - pt.x) * 0.6; } }
    });
  }
  function drawCables(ctx, e, toL) {
    for (let i = 0; i < e.cables.length; i++) {
      const c = e.cables[i]; if (!c.inited) continue;
      const pts = c.p.map(toL), w = i === 1 ? 7.2 : 5.8;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length - 1; k++) { const m = lerpP(pts[k], pts[k + 1], 0.5); ctx.quadraticCurveTo(pts[k].x, pts[k].y, m.x, m.y); }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = w + 3; ctx.stroke();
      ctx.strokeStyle = C.cable; ctx.lineWidth = w; ctx.stroke();
      ctx.strokeStyle = U.rgba(C.cableL, 0.95); ctx.lineWidth = 1.5; ctx.stroke();
      // gold couplings along the cable, a plug at its end
      for (const k of [3, 7]) { if (k >= pts.length) continue; const q = pts[k], r = pts[Math.min(pts.length - 1, k + 1)], a = Math.atan2(r.y - q.y, r.x - q.x); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(a); ctx.beginPath(); ctx.rect(-4, -w / 2 - 1.5, 8, w + 3); fillInk(ctx, GOLD, 1.2); ctx.fillStyle = GOLDD; ctx.fillRect(1, -w / 2 - 1, 1.4, w + 2); ctx.restore(); }
      const end = pts[pts.length - 1], pe = pts[pts.length - 2], a = Math.atan2(end.y - pe.y, end.x - pe.x);
      ctx.save(); ctx.translate(end.x, end.y); ctx.rotate(a); ctx.beginPath(); ctx.rect(-2, -w / 2 - 2, 10, w + 4); fillInk(ctx, GOLDD, 1.3); ctx.fillStyle = e.openK > 0.5 ? CRIM : CYAN; ctx.fillRect(6, -1.5, 3, 3); ctx.restore();
    }
  }
  function drawVeil(ctx, e, toL, L) {
    e.veil.forEach((c, i) => {
      if (!c.inited) return;
      const pts = c.p.map(toL);
      ctx.save(); ctx.globalAlpha *= 0.92;
      Rig.ribbon(ctx, pts, i ? 8 : 11, 3, i ? C.enamelD : C.enamelB, 1.5); ink(ctx, 1.6);
      ctx.restore();
      ctx.strokeStyle = U.rgba(GOLD, 0.9); ctx.lineWidth = 1.2; ctx.beginPath(); pts.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y + 2) : ctx.moveTo(q.x, q.y + 2))); ctx.stroke();
      if (L.inf > 0.6 && i === 0) { const q = pts[pts.length - 3]; crystal(ctx, q.x, q.y, PI * 0.6, 0.5, 0); }
    });
  }
  function drawStole(ctx, e, toL) {
    e.stole.forEach((c, i) => {
      if (!c.inited) return;
      const pts = c.p.map(toL), n = pts.length;
      Rig.ribbon(ctx, pts, 5.8, 5.2, i ? C.stole : C.stoleD, 0.4); ink(ctx, 1.6);
      // gold border + embroidered notes
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.1; ctx.beginPath();
      pts.forEach((q, k) => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = U.lerp(5.8, 5.2, k / (n - 1)) - 1.6; const x = q.x - dy / d * w, y = q.y + dx / d * w; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.lineWidth = 1.3; ctx.stroke();
      ctx.beginPath(); pts.forEach((q, k) => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = U.lerp(5.8, 5.2, k / (n - 1)) - 1.6; const x = q.x + dy / d * w, y = q.y - dx / d * w; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.strokeStyle = U.rgba(GOLD, 0.7); ctx.lineWidth = 0.9; ctx.stroke();
      for (const k of [3, 6]) { const q = pts[k]; ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(q.x, q.y - 3.4); ctx.lineTo(q.x + 2.6, q.y); ctx.lineTo(q.x, q.y + 3.4); ctx.lineTo(q.x - 2.6, q.y); ctx.closePath(); ctx.fill(); }
      // weighted end: gold band and a fringe
      const a = pts[n - 2], b = pts[n - 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      ctx.beginPath(); ctx.moveTo(b.x - uy * 5.6, b.y + ux * 5.6); ctx.lineTo(b.x + uy * 5.6, b.y - ux * 5.6); ctx.lineTo(b.x + uy * 5.6 + ux * 4, b.y - ux * 5.6 + uy * 4); ctx.lineTo(b.x - uy * 5.6 + ux * 4, b.y + ux * 5.6 + uy * 4); ctx.closePath(); fillInk(ctx, GOLD, 1.1);
      for (let k = -2; k <= 2; k++) { const ox = b.x + ux * 4 - uy * k * 2.2, oy = b.y + uy * 4 + ux * k * 2.2; line(ctx, ox, oy, ox + ux * 7, oy + uy * 7, GOLDD, 1.1); }
    });
  }

  /* ---------------- organ-pipe wings ---------------- */
  // one organ pipe in its own frame: base at (x, y), pointing along ang, length len, width w (enamel, or polished gold)
  // tone: 0 near · 1 far wing · 2 recessed back rank
  const PIPE_TONE = [[C.enamel, GOLD], [C.enamelB, '#c99a48'], ['#a49cb4', '#9a7436']];
  function drawPipe(ctx, x, y, ang, len, w, ls, lit, glowCol, tone, crim, metal) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang + PI / 2);
    const r = Rig.ramp(PIPE_TONE[tone | 0][metal ? 1 : 0]), hw = w / 2, foot = len * 0.14, deep = tone === 2;
    const body = () => { ctx.beginPath(); ctx.moveTo(-hw * 0.3, 0); ctx.lineTo(-hw, -foot); ctx.lineTo(-hw, -len); ctx.lineTo(hw, -len); ctx.lineTo(hw, -foot); ctx.lineTo(hw * 0.3, 0); ctx.closePath(); };
    body(); ctx.fillStyle = r.lit; ctx.fill();
    ctx.save(); body(); ctx.clip();
    ctx.fillStyle = r.dark; ctx.fillRect(ls > 0 ? -hw - 1 : hw * 0.08, -len - 2, hw * 0.92 + 1, len + 4);
    if (!deep) {
      ctx.fillStyle = r.bounce; ctx.fillRect(ls > 0 ? -hw - 1 : hw * 0.76, -len - 2, hw * 0.24 + 1, len + 4);
      ctx.fillStyle = metal ? 'rgba(255,250,225,0.9)' : 'rgba(255,255,255,0.75)'; ctx.fillRect(ls > 0 ? hw * 0.36 : -hw * 0.6, -len, w * 0.12, len - foot * 0.4);
    }
    ctx.restore();
    body(); ink(ctx, deep ? 1.5 : 1.9);
    // mouth: a dark arched notch with an upper lip, lit from within
    const my = -foot - len * 0.07, mh = Math.min(17, len * 0.085);
    ctx.beginPath(); ctx.moveTo(-hw * 0.52, my); ctx.lineTo(hw * 0.52, my); ctx.lineTo(hw * 0.52, my - mh * 0.6); ctx.quadraticCurveTo(0, my - mh * 1.25, -hw * 0.52, my - mh * 0.6); ctx.closePath();
    fillInk(ctx, '#140f2e', 1.1);
    if (lit > 0.02) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(glowCol, 0.9 * lit); ctx.beginPath(); ctx.moveTo(-hw * 0.38, my - 1); ctx.lineTo(hw * 0.38, my - 1); ctx.lineTo(hw * 0.38, my - mh * 0.5); ctx.quadraticCurveTo(0, my - mh * 0.95, -hw * 0.38, my - mh * 0.5); ctx.closePath(); ctx.fill(); ctx.restore(); }
    if (!deep) {
      ctx.fillStyle = metal ? GOLDD : GOLD; ctx.fillRect(-hw * 0.58, my - mh * 0.8 - 2.4, hw * 1.16, 2.6);
      // bands
      for (const k of [0.58, 0.82]) { const by = -len * k; ctx.fillStyle = metal ? C.enamel : GOLDD; ctx.fillRect(-hw - 1, by, w + 2, 3.6); ctx.fillStyle = metal ? '#ffffff' : GOLD; ctx.fillRect(-hw - 1, by, w + 2, 1.5); ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.strokeRect(-hw - 1, by, w + 2, 3.6); }
    }
    // the flared rim
    ctx.beginPath(); ctx.moveTo(-hw, -len + 7); ctx.lineTo(-hw - 2.8, -len - 1); ctx.lineTo(hw + 2.8, -len - 1); ctx.lineTo(hw, -len + 7); ctx.closePath(); fillInk(ctx, deep ? '#9a7436' : metal ? C.enamel : GOLD, 1.3);
    ctx.beginPath(); ctx.ellipse(0, -len - 1, hw + 2.8, 2.7, 0, 0, TAU); fillInk(ctx, crim ? '#3a0a1c' : '#140f2e', 1.1);
    if (crim) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(CRIM, 0.75); ctx.beginPath(); ctx.ellipse(0, -len - 1, hw, 1.6, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }
  // a jagged blade of crimson Hush crystal standing where an organ pipe was (two-tone facets, ink, a white glint)
  function drawBlade(ctx, q, i, side, k, ghost, t) {
    const len = q.len * (0.62 + ((i * 37) % 5) * 0.06) * U.easeOutBack(Math.min(1, k)), w = q.wid * 0.66 + 4;
    ctx.save(); ctx.translate(q.bx, q.by); ctx.rotate(q.ang + (i % 2 ? 0.07 : -0.05) * side + Math.sin(t * 1.3 + i) * 0.015);
    const outline = () => { ctx.beginPath(); ctx.moveTo(4, -w * 0.5); ctx.lineTo(len * 0.5, -w * 0.8); ctx.lineTo(len * 0.78, -w * 0.35); ctx.lineTo(len, 0); ctx.lineTo(len * 0.7, w * 0.55); ctx.lineTo(len * 0.36, w * 0.7); ctx.lineTo(4, w * 0.5); ctx.closePath(); };
    if (!ghost) glow(ctx, len * 0.92, 0, 22, CRIM, 0.4 * k);
    outline(); ctx.fillStyle = side < 0 ? '#8e1236' : CRIMX; ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, -w * 0.5); ctx.lineTo(len * 0.5, -w * 0.8); ctx.lineTo(len * 0.78, -w * 0.35); ctx.lineTo(len, 0); ctx.lineTo(4, 0); ctx.closePath(); ctx.fillStyle = side < 0 ? CRIMX : CRIM; ctx.fill();
    outline(); ink(ctx, 1.8);
    ctx.strokeStyle = 'rgba(255,225,235,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(len * 0.12, -w * 0.32); ctx.lineTo(len * 0.5, -w * 0.55); ctx.lineTo(len * 0.86, -w * 0.12); ctx.stroke();
    // a smaller shard leaning off the base
    const s2 = len * 0.42;
    ctx.beginPath(); ctx.moveTo(6, w * 0.3); ctx.lineTo(s2 * 0.7, w * 1.25); ctx.lineTo(s2, w * 0.95); ctx.lineTo(s2 * 0.55, w * 0.35); ctx.closePath(); ctx.fillStyle = '#b8163f'; ctx.fill(); ink(ctx, 1.4);
    ctx.restore();
  }
  const WING_N = 5, WING_LEN = [238, 204, 216, 162, 172];
  function wingPipe(i, side, spread) {
    return {
      bx: side * (26 + i * 17), by: 2 - i * 8 * (0.55 + 0.45 * spread), ang: -PI / 2 + side * (0.1 + i * 0.165) * spread,
      len: WING_LEN[i] * (side < 0 ? 0.9 : 1), wid: 18 - i * 1.2, metal: i % 2 === 1,
    };
  }
  // where the far wing's cables hang from (wing frame)
  const sparPt = (side, k, spread) => ({ x: side * (10 + k * 96), y: 8 - k * 40 * (0.55 + 0.45 * spread) });
  function drawWings(ctx, e, g, p, L, ls, ghost, toW) {
    const spread = p.wing, wingW = [];
    const lit = L.lit * L.flick * (0.65 + 0.35 * Math.sin(e.t * 2.4)) + (p.core || 0) * 0.3;
    const mouth = L.open > 0.5 || L.inf > 0.8 ? CRIM : CYAN;
    for (const side of [-1, 1]) {
      const pv = g.T(side * 8, -98);
      // the near wing becomes a battery: swung forward to aim at the beam's floor point
      let swing = 0;
      if (side > 0 && p.aim > 0.001) {
        let cx = 420, cy = 0;
        const h = e.beamH;
        if (h && !h.done) { const s = h.t - h.delay, c = s < 0 ? h.xa : beamC(h, Math.max(0, s - h.lead)); cx = (c - e.x) / (e.facing * SC); cy = (h.fy - e.y) / SC; }
        // the battery levels out over her and tilts down toward the floor point (never straight down at its own feet)
        const want = U.clamp(Math.atan2(cy - pv.y, cx - pv.x), 0.1, 0.62), base = wingPipe(2, 1, spread).ang + p.lean;
        swing = (want - base) * p.aim;
      }
      ctx.save(); ctx.translate(pv.x, pv.y); ctx.rotate(p.lean + swing);
      if (side < 0 && !ghost && !L.wreck) { const a = rot(sparPt(-1, 0.62, spread).x, sparPt(-1, 0.62, spread).y + 6, p.lean), b = rot(sparPt(-1, 1.0, spread).x, sparPt(-1, 1.0, spread).y + 6, p.lean); e.cableA = [toW({ x: pv.x + a.x, y: pv.y + a.y }), toW({ x: pv.x + b.x, y: pv.y + b.y })]; }
      // the spar the pipes stand on: an inked navy bone with gold casework (keeps the white figure readable)
      const s0 = sparPt(side, 0, spread), s1 = sparPt(side, 0.5, spread), s2 = sparPt(side, 1.05, spread);
      ctx.beginPath(); ctx.moveTo(s0.x, s0.y + 10); ctx.quadraticCurveTo(s1.x, s1.y + 16, s2.x, s2.y + 8); ctx.lineTo(s2.x + side * 6, s2.y - 6); ctx.quadraticCurveTo(s1.x, s1.y - 4, s0.x, s0.y - 8); ctx.closePath();
      fillInk(ctx, side < 0 ? '#151834' : C.navy, 2);
      ctx.beginPath(); ctx.moveTo(s0.x, s0.y - 5); ctx.quadraticCurveTo(s1.x, s1.y - 1.5, s2.x + side * 4, s2.y - 3); ctx.strokeStyle = side < 0 ? GOLDD : GOLD; ctx.lineWidth = 2; ctx.stroke();
      const pl = (i) => clamp01(lit * (L.lit >= 1 ? 1 : clamp01(L.lit * 3 - i * 0.45)));
      // recessed back rank, standing between the front pipes
      if (L.p2 < 0.35) {
        for (let i = WING_N - 2; i >= 0; i--) {
          const a = wingPipe(i, side, spread), b = wingPipe(i + 1, side, spread);
          drawPipe(ctx, (a.bx + b.bx) / 2, (a.by + b.by) / 2 - 3, (a.ang + b.ang) / 2, (a.len + b.len) / 2 * 0.76, (a.wid + b.wid) / 2 * 0.8, ls, pl(i) * 0.45, mouth, 2, false, !a.metal);
        }
      }
      const rail = [];
      for (let i = WING_N - 1; i >= 0; i--) {
        const k = (side > 0 ? WING_N : 0) + i, gone = L.p2 > (k + 0.5) / (WING_N * 2);
        const q = wingPipe(i, side, spread);
        if (!ghost && !L.wreck) {
          // world transform of each pipe (for the transformation: they lift off from exactly here)
          const a = q.ang + p.lean + swing, b = rot(q.bx, q.by, p.lean + swing), wp = toW({ x: pv.x + b.x, y: pv.y + b.y });
          wingW[k] = { x: wp.x, y: wp.y, ang: e.facing > 0 ? a : PI - a, len: q.len, wid: q.wid, metal: q.metal };
          if (side > 0 && i === 2) e.beamO = toW({ x: pv.x + b.x + Math.cos(a) * q.len, y: pv.y + b.y + Math.sin(a) * q.len });
          if (gone && !e.goneFx[k]) { e.goneFx[k] = true; G.FX.shards(wp.x, wp.y - 20, 5, '#f4eee2', 300); G.FX.shards(wp.x, wp.y - 10, 3, GOLD, 260); }
        }
        if (gone) {
          // where a pipe tore away, a blade of Hush crystal grows in its place (the silence takes the choir's wings)
          const cg = clamp01((L.p2 - (k + 0.5) / (WING_N * 2)) * 3.5) * (1 - (L.spared || 0));
          if (cg > 0.02) drawBlade(ctx, q, i, side, cg, ghost, e.t);
          const sl = 22 + (i * 17) % 20;
          ctx.save(); ctx.translate(q.bx, q.by); ctx.rotate(q.ang + PI / 2);
          ctx.beginPath(); ctx.moveTo(-q.wid / 2, 0); ctx.lineTo(-q.wid / 2, -sl); ctx.lineTo(-q.wid * 0.15, -sl - 7); ctx.lineTo(q.wid * 0.1, -sl + 2); ctx.lineTo(q.wid / 2, -sl - 4); ctx.lineTo(q.wid / 2, 0); ctx.closePath();
          fillInk(ctx, PIPE_TONE[side < 0 ? 1 : 0][q.metal ? 1 : 0], 1.7);
          ctx.beginPath(); ctx.moveTo(-q.wid / 2 + 2, -sl + 1); ctx.lineTo(-q.wid * 0.15, -sl - 4); ctx.lineTo(q.wid * 0.1, -sl + 4); ctx.lineTo(q.wid / 2 - 2, -sl - 1); ctx.strokeStyle = '#2a1430'; ctx.lineWidth = 2; ctx.stroke();
          ctx.restore();
          continue;
        }
        const tremble = L.p2 > 0 && L.p2 < 1 ? Math.sin(e.t * 50 + i) * 0.035 : 0;
        drawPipe(ctx, q.bx, q.by, q.ang + tremble, q.len, q.wid, ls, pl(i), mouth, side < 0 ? 1 : 0, false, q.metal);
        const rr = 120 - i * 6;
        rail[i] = { x: q.bx + Math.cos(q.ang) * rr, y: q.by + Math.sin(q.ang) * rr };
      }
      // a thin gold rail threading the front rank
      const rp = rail.filter(Boolean);
      if (rp.length > 1) {
        ctx.beginPath(); ctx.moveTo(rp[0].x, rp[0].y);
        for (let i = 1; i < rp.length; i++) { const m = lerpP(rp[i - 1], rp[i], 0.5); ctx.quadraticCurveTo(m.x, m.y + 7, rp[i].x, rp[i].y); }
        goldStroke(ctx, 1.6, false);
      }
      rivets(ctx, [0.15, 0.45, 0.75].map((k) => { const q = sparPt(side, k, spread); return [q.x, q.y + 3]; }), 1.7);
      ctx.restore();
    }
    if (!ghost && !L.wreck) e.wingW = wingW.filter(Boolean);
  }

  /* ---------------- halo of choir rings, around a dark rose-window disc ---------------- */
  function drawHalo(ctx, e, g, p, L, ghost) {
    const c = g.hc, on = L.haloOn * L.flick, boost = Math.max(0, p.halo - 1), p2 = e.phase === 2 && !L.spared ? 1 : 0;
    const broke = L.haloBreak || 0, s = (1 + 0.12 * p2 + 0.05 * boost) * (1 + broke * 0.18), t = e.t, spin = (p2 ? 1.0 : 0.45) * (1 + boost);
    const cy = c.y + broke * 46;
    if (!ghost && on > 0.02) glow(ctx, c.x, cy, 132 * s, p2 ? CRIM : GOLDL, (0.18 + 0.2 * boost) * on);
    const E = (r, a0 = 0, a1 = TAU) => { ctx.beginPath(); ctx.ellipse(c.x, cy, r * s, r * s * 0.96, 0, a0, a1); };
    const gold = on > 0.5 ? GOLD : U.mixHex('#6e5c3e', GOLD, on * 2);
    const R3 = 96, R2 = 78, R1 = 62;
    ctx.save(); if (broke) ctx.globalAlpha *= 1 - broke * 0.85;
    // the disc: dark glass with gold tracery — the porcelain mask sits in front of it
    E(R1); ctx.fillStyle = p2 ? '#1c0c26' : '#151a3e'; ctx.fill();
    ctx.save(); E(R1); ctx.clip();
    ctx.strokeStyle = U.rgba(gold, 0.55); ctx.lineWidth = 1;
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + t * 0.05; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * 18 * s, cy + Math.sin(a) * 18 * s); ctx.lineTo(c.x + Math.cos(a) * R1 * s, cy + Math.sin(a) * R1 * s); ctx.stroke(); }
    E(32); ctx.stroke(); E(18); ctx.stroke();
    if (!ghost) glow(ctx, c.x, cy + 6, 48 * s, p2 ? CRIM : CYAN, 0.3 * on);
    ctx.restore();
    const seg = (r, w, col, gap) => {
      const n = gap ? 6 : 1;
      for (let k = 0; k < n; k++) {
        if (gap) { const a0 = k / 6 * TAU + gap * 0.3 + t * 0.05, a1 = a0 + TAU / 6 - gap; E(r, a0, a1); } else E(r);
        ctx.strokeStyle = INK; ctx.lineWidth = w + 2.8; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
      }
    };
    // inner ring: heavy gold with engraved notches
    seg(R1, 5.2, gold, p2 ? 0.1 : broke * 0.5);
    ctx.strokeStyle = U.rgba(GOLDD, 0.95); ctx.lineWidth = 1.1;
    for (let j = 0; j < 18; j++) { const a = j / 18 * TAU - t * 0.25 * spin; const x0 = c.x + Math.cos(a) * (R1 - 2) * s, y0 = cy + Math.sin(a) * (R1 - 2) * s * 0.96; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a) * 3.6, y0 + Math.sin(a) * 3.6); ctx.stroke(); }
    E(R1 + 0.5, PI * 1.05, PI * 1.6); ctx.strokeStyle = U.rgba(GOLDL, 0.95 * Math.max(0.25, on)); ctx.lineWidth = 1.4; ctx.stroke();
    // stave ring: a circular five-line staff on a dark band, its notes still turning
    E(R2); ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.stroke(); ctx.strokeStyle = p2 ? '#2a1838' : C.navy; ctx.lineWidth = 13; ctx.stroke();
    ctx.lineWidth = 0.85; ctx.strokeStyle = U.rgba(gold, 0.95);
    for (let k = -2; k <= 2; k++) { E(R2 + k * 2.5); ctx.stroke(); }
    const NN = 11;
    for (let j = 0; j < NN; j++) {
      const a = j / NN * TAU + t * 0.35 * spin + (j % 3) * 0.2, lane = ((j * 7) % 5 - 2) * 2.5;
      const nx = c.x + Math.cos(a) * (R2 + lane) * s, ny = cy + Math.sin(a) * (R2 + lane) * s * 0.96;
      ctx.save(); ctx.translate(nx, ny); ctx.rotate(a + PI / 2);
      const nc = on > 0.3 ? (p2 && j % 3 === 0 ? CRIM : GOLDL) : '#857452';
      ctx.fillStyle = nc; ctx.beginPath(); ctx.ellipse(0, 0, 3, 2.2, -0.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = nc; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(2.6, -0.6); ctx.lineTo(2.6, -8); if (j % 2) ctx.lineTo(6, -5.5); ctx.stroke();
      ctx.restore();
    }
    // outer ring: thin gold carrying the singers' lamps
    seg(R3, 2.6, gold, p2 ? 0.22 : broke * 0.6);
    const lamps = 8;
    for (let j = 0; j < lamps; j++) {
      const a = j / lamps * TAU - t * 0.5 * spin, x = c.x + Math.cos(a) * R3 * s, y = cy + Math.sin(a) * R3 * s * 0.96;
      const lk = on * clamp01(L.haloOn * lamps - j);
      ctx.beginPath(); ctx.moveTo(x, y - 6.4); ctx.lineTo(x + 3.8, y); ctx.lineTo(x, y + 6.4); ctx.lineTo(x - 3.8, y); ctx.closePath();
      fillInk(ctx, lk > 0.3 ? (p2 ? CRIML : CYANW) : '#55525f', 1.2);
      if (!ghost && lk > 0.05) glow(ctx, x, y, 14, p2 ? CRIM : CYAN, 0.8 * lk);
    }
    ctx.restore();
  }

  /* ---------------- robe: a fluted enamel bell under a peplum of petals, an inner rank of gold pipes ---------------- */
  function drawRobe(ctx, e, g, p, L, ls, ghost) {
    const t = e.t, crum = g.crum;
    const sway = U.clamp(-(e.vx || 0) * 0.05 * e.facing, -22, 22) + Math.sin(t * 1.3) * 3;
    ctx.save(); ctx.translate(g.W.x, g.W.y); ctx.rotate(p.lean * 0.35); ctx.scale(1, 1 - 0.45 * crum);
    const H = 144, hw = 100 * (1 + 0.3 * crum), ww = 40;
    const sx = (y) => sway * (y / H) * (y / H);
    const torn = (e.phase === 2 && !L.spared) || L.wreck;
    const robePath = () => {
      ctx.beginPath(); ctx.moveTo(-ww, 20);
      ctx.bezierCurveTo(-60, 56, -82 + sx(100), 100, -hw + sx(H), H - 4);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const x0 = -hw + 2 * hw * i / n, x1 = -hw + 2 * hw * (i + 1) / n, dip = torn && (i === 1 || i === 5) ? -16 : 10;
        ctx.quadraticCurveTo((x0 + x1) / 2 + sx(H), H + dip, x1 + sx(H), H - 4);
      }
      ctx.bezierCurveTo(82 + sx(100), 100, 60, 56, ww, 20);
      ctx.closePath();
    };
    robePath(); ctx.fillStyle = cel(ctx, 0, 80, 1, 0, 90, C.enamel); ctx.fill();
    ctx.save(); robePath(); ctx.clip();
    // a crisp cast shadow down the robe's dark side, and under the peplum
    ctx.fillStyle = 'rgba(56,22,90,0.22)'; ctx.beginPath(); ctx.moveTo(ls > 0 ? -120 : 120, 0); ctx.lineTo(ls > 0 ? -20 : 20, 0); ctx.quadraticCurveTo(ls > 0 ? -46 + sx(80) : 46 + sx(80), 80, ls > 0 ? -40 + sx(H) : 40 + sx(H), H + 20); ctx.lineTo(ls > 0 ? -140 : 140, H + 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(56,22,90,0.2)'; ctx.beginPath(); ctx.moveTo(-90, 40); ctx.quadraticCurveTo(4, 78, 100, 40); ctx.lineTo(100, 26); ctx.quadraticCurveTo(4, 64, -90, 26); ctx.closePath(); ctx.fill();
    // fluted panels: every other pleat in shadow (reads as a rank of pipes)
    for (let k = -4; k < 4; k++) {
      if ((k + 4) % 2) continue;
      const u0 = k / 4, u1 = (k + 1) / 4;
      ctx.beginPath(); ctx.moveTo(u0 * ww, 20); ctx.lineTo(u1 * ww, 20); ctx.lineTo(u1 * hw + sx(H), H + 14); ctx.lineTo(u0 * hw + sx(H), H + 14); ctx.closePath(); ctx.fillStyle = 'rgba(60,26,92,0.15)'; ctx.fill();
    }
    ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 1.2;
    for (let k = -3; k <= 3; k++) { const u = k / 4; ctx.beginPath(); ctx.moveTo(u * ww, 26); ctx.quadraticCurveTo(u * (ww + hw) * 0.55 + sx(60), 84, u * hw + sx(H), H + 4); ctx.stroke(); }
    // engraved stave across the left panels
    ctx.strokeStyle = U.rgba(GOLDD, 0.85); ctx.lineWidth = 0.8;
    for (let j = 0; j < 5; j++) { const y = 96 + j * 3.4; ctx.beginPath(); ctx.moveTo(-80 + sx(y), y + 4); ctx.quadraticCurveTo(-56 + sx(y), y - 2, -30 + sx(y), y - 1); ctx.stroke(); }
    ctx.fillStyle = U.rgba(GOLDD, 0.9);
    for (const [x, y] of [[-72, 103], [-61, 97], [-50, 101], [-39, 95]]) { ctx.beginPath(); ctx.ellipse(x + sx(y), y, 2.1, 1.5, -0.4, 0, TAU); ctx.fill(); ctx.fillRect(x + 1.6 + sx(y), y - 8, 0.8, 8); }
    // the inner organ: a dark slot down the front holding a rank of small gold pipes, mouths lit
    const slot = [[4, 50], [42, 50], [62 + sx(H), H + 12], [-16 + sx(H), H + 12]];
    poly(ctx, slot); fillInk(ctx, '#121534', 1.6);
    ctx.save(); poly(ctx, slot); ctx.clip();
    const pc = L.open > 0.5 ? CRIM : CYAN, pl = L.coreOn * L.flick * (0.55 + 0.45 * Math.sin(t * 2.6));
    for (let j = 0; j < 7; j++) {
      const x = -10 + j * 10.5 + sx(H) * 0.8, hgt = 78 - Math.abs(3 - j) * 7, w = 7.4;
      ctx.beginPath(); ctx.rect(x - w / 2, H + 6 - hgt, w, hgt); ctx.fillStyle = j % 2 ? '#b88a3e' : GOLD; ctx.fill(); ink(ctx, 1);
      ctx.fillStyle = 'rgba(255,240,200,0.7)'; ctx.fillRect(x + w * 0.1, H + 6 - hgt, 1.2, hgt);
      ctx.beginPath(); ctx.ellipse(x, H + 6 - hgt, w / 2, 1.6, 0, 0, TAU); ctx.fillStyle = '#140f2e'; ctx.fill();
      ctx.beginPath(); ctx.rect(x - w * 0.3, H - hgt + 20, w * 0.6, 4); ctx.fillStyle = '#140f2e'; ctx.fill();
      if (!ghost) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(pc, 0.9 * pl); ctx.fillRect(x - w * 0.24, H - hgt + 21, w * 0.48, 2.2); ctx.restore(); }
    }
    ctx.restore();
    ctx.restore();
    // hem: a gold band following the scallops
    ctx.save(); robePath(); ctx.clip();
    ctx.beginPath(); ctx.moveTo(-hw - 20 + sx(H), H - 14);
    for (let i = 0; i < 7; i++) { const x0 = -hw + 2 * hw * i / 7, x1 = -hw + 2 * hw * (i + 1) / 7; ctx.quadraticCurveTo((x0 + x1) / 2 + sx(H), H - 2, x1 + sx(H), H - 14); }
    ctx.lineTo(hw + 40, H + 30); ctx.lineTo(-hw - 40, H + 30); ctx.closePath(); ctx.fillStyle = GOLD; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.strokeStyle = U.rgba(GOLDL, 0.9); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-hw - 20 + sx(H), H - 11);
    for (let i = 0; i < 7; i++) { const x0 = -hw + 2 * hw * i / 7, x1 = -hw + 2 * hw * (i + 1) / 7; ctx.quadraticCurveTo((x0 + x1) / 2 + sx(H), H + 1, x1 + sx(H), H - 11); }
    ctx.stroke();
    ctx.restore();
    robePath(); ink(ctx, 2.8);
    // peplum: seven overlapping enamel petals hanging from the girdle (outer first, the centre one on top)
    for (const j of [-3, 3, -2, 2, -1, 1, 0]) {
      const len = 50 + (3 - Math.abs(j)) * 4, w = 15;
      ctx.save(); ctx.translate(j * 16 + 4, 6); ctx.rotate(j * 0.09 + sway * 0.003);
      ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(w, 0); ctx.lineTo(w * 0.94, len * 0.62); ctx.quadraticCurveTo(0, len + 10, -w * 0.94, len * 0.62); ctx.closePath();
      const near = j * ls > 0;
      ctx.fillStyle = j === 0 ? cel(ctx, 0, len * 0.4, 1, 0, w, C.enamel) : (near ? C.porcelain : (Math.abs(j) === 3 ? C.enamelD : C.enamelB)); ctx.fill(); ink(ctx, 2);
      ctx.beginPath(); ctx.moveTo(-w * 0.8, 3); ctx.lineTo(-w * 0.76, len * 0.6); ctx.quadraticCurveTo(0, len + 3, w * 0.76, len * 0.6); ctx.lineTo(w * 0.8, 3); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.7; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, len * 0.8); ctx.strokeStyle = U.rgba(GOLDD, 0.85); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, len * 0.72, 2.8, 0, TAU); fillInk(ctx, GOLD, 1);
      ctx.restore();
    }
    // girdle: a heavy gold band with rivets and the Ark's seal on the buckle
    ctx.beginPath(); ctx.moveTo(-46, -2); ctx.quadraticCurveTo(4, 6, 50, -2); ctx.lineTo(52, 10); ctx.quadraticCurveTo(4, 18, -48, 10); ctx.closePath(); fillInk(ctx, GOLD, 1.8);
    ctx.beginPath(); ctx.moveTo(-46, 6); ctx.quadraticCurveTo(4, 14, 51, 6); ctx.strokeStyle = GOLDD; ctx.lineWidth = 1.6; ctx.stroke();
    rivets(ctx, [[-36, 4], [-18, 7], [28, 7], [44, 4]], 1.7);
    ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(16, 6); ctx.lineTo(6, 16); ctx.lineTo(-4, 6); ctx.closePath(); fillInk(ctx, GOLDL, 1.4);
    ctx.beginPath(); ctx.arc(6, 6, 3.2, 0, TAU); ctx.fillStyle = L.open > 0.5 ? CRIM : CYAN; ctx.fill();
    drawSites(ctx, 'robe', L.inf, t, ghost);
    ctx.restore();
  }

  /* ---------------- torso: a choir cuirass around the Core ---------------- */
  const CHEST = [[-27, 0], [-40, -26], [-56, -58], [-66, -84], [-54, -102], [-20, -112], [28, -112], [60, -102], [72, -84], [64, -56], [44, -26], [30, 0]];
  function drawTorso(ctx, e, g, p, L, ls, ghost) {
    const t = e.t, open = L.open;
    ctx.save(); ctx.translate(g.W.x, g.W.y); ctx.rotate(p.lean);
    smooth(ctx, CHEST); ctx.fillStyle = cel(ctx, 4, -56, 1, -0.25, 66, C.enamel); ctx.fill(); ink(ctx, 2.8);
    ctx.save(); smooth(ctx, CHEST); ctx.clip();
    // swell-box shutters over the abdomen
    for (let k = 0; k < 3; k++) {
      const y = -8 - k * 9, w = 30 + k * 6;
      ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w + 4, y); ctx.lineTo(w + 7, y - 6); ctx.lineTo(-w - 3, y - 6); ctx.closePath();
      ctx.fillStyle = k % 2 ? 'rgba(60,26,92,0.18)' : 'rgba(255,248,230,0.45)'; ctx.fill();
      ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-w - 3, y - 6); ctx.lineTo(w + 7, y - 6); ctx.stroke();
    }
    // pectoral plates: two sweeping shells meeting at the sternum
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(6, -106); ctx.quadraticCurveTo(6 + sd * 40, -112, 6 + sd * 62, -86); ctx.quadraticCurveTo(6 + sd * 50, -70, 6 + sd * 30, -74); ctx.quadraticCurveTo(6 + sd * 12, -80, 6, -84); ctx.closePath();
      ctx.fillStyle = sd * ls > 0 ? 'rgba(255,250,236,0.5)' : 'rgba(60,26,92,0.16)'; ctx.fill(); ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    // gold ribs sweeping out from the sternum (cuirass casework)
    for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(6 + sd * 34, -66 + k * 12); ctx.quadraticCurveTo(6 + sd * 48, -62 + k * 12, 6 + sd * (54 - k * 6), -46 + k * 14);
      ctx.strokeStyle = INK; ctx.lineWidth = 3.6; ctx.stroke(); ctx.strokeStyle = sd * ls > 0 ? GOLD : GOLDD; ctx.lineWidth = 1.7; ctx.stroke();
    }
    // the shadowed flank of the cuirass (hard cel cut)
    ctx.fillStyle = 'rgba(56,22,90,0.32)'; ctx.beginPath(); ctx.moveTo(ls > 0 ? -80 : 84, -120); ctx.lineTo(ls > 0 ? -36 : 46, -120); ctx.quadraticCurveTo(ls > 0 ? -50 : 60, -50, ls > 0 ? -18 : 24, 4); ctx.lineTo(ls > 0 ? -80 : 84, 4); ctx.closePath(); ctx.fill();
    // occlusion under the pectoral shells
    ctx.fillStyle = 'rgba(56,22,90,0.18)'; ctx.beginPath(); ctx.moveTo(-58, -70); ctx.quadraticCurveTo(6, -86, 70, -70); ctx.lineTo(70, -60); ctx.quadraticCurveTo(6, -74, -58, -60); ctx.closePath(); ctx.fill();
    ctx.restore();
    // sternum keel and a gothic arch of gold tracery framing the rose window, pinnacles at its feet
    ctx.beginPath(); ctx.moveTo(6, -108); ctx.lineTo(6, -100); goldStroke(ctx, 2.6);
    if (open < 0.5) {
      ctx.beginPath(); ctx.moveTo(-34, -46); ctx.quadraticCurveTo(-36, -84, 6, -102); ctx.quadraticCurveTo(48, -84, 46, -46); goldStroke(ctx, 2.2);
      ctx.beginPath(); ctx.moveTo(-26, -50); ctx.quadraticCurveTo(-27, -80, 6, -94); ctx.quadraticCurveTo(39, -80, 38, -50); ctx.strokeStyle = U.rgba(GOLDD, 0.9); ctx.lineWidth = 1.1; ctx.stroke();
      for (const x of [-36, 48]) { ctx.beginPath(); ctx.moveTo(x, -30); ctx.lineTo(x, -50); goldStroke(ctx, 1.8, false); ctx.beginPath(); ctx.arc(x, -53, 2.6, 0, TAU); fillInk(ctx, GOLD, 1); }
      ctx.beginPath(); ctx.moveTo(6, -110); ctx.lineTo(9.5, -104); ctx.lineTo(6, -98); ctx.lineTo(2.5, -104); ctx.closePath(); fillInk(ctx, L.open > 0.5 ? CRIM : CYAN, 1);
    }
    // rose window around the Core (P1) / the torn cavity (P2)
    const c = { x: 6, y: -58 };
    if (open < 0.5) {
      ctx.beginPath(); ctx.arc(c.x, c.y, 31, 0, TAU); fillInk(ctx, '#121534', 2.2);
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + PI / 8; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * 20, c.y + Math.sin(a) * 20); ctx.lineTo(c.x + Math.cos(a) * 31, c.y + Math.sin(a) * 31); goldStroke(ctx, 2, false); }
      ctx.beginPath(); ctx.arc(c.x, c.y, 31, 0, TAU); goldStroke(ctx, 3.4);
      ctx.beginPath(); ctx.arc(c.x, c.y, 20, 0, TAU); goldStroke(ctx, 1.7, false);
      rivets(ctx, [0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = k / 8 * TAU; return [c.x + Math.cos(a) * 36, c.y + Math.sin(a) * 36]; }), 1.6);
    } else {
      // the casework burst outward: a jagged cavity, broken tracery hanging off its rim
      const cav = [];
      for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, r = 38 + ((k * 37) % 9) - (k % 2) * 7; cav.push([c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 1.05]); }
      poly(ctx, cav); fillInk(ctx, '#120a22', 2.4);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.4, x0 = c.x + Math.cos(a) * 33, y0 = c.y + Math.sin(a) * 33; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a + 0.6) * 11, y0 + Math.sin(a + 0.6) * 11 + 5); goldStroke(ctx, 2, false); }
      if (!ghost) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(CRIM, 0.65); ctx.lineWidth = 1.6; poly(ctx, cav); ctx.stroke(); ctx.restore(); }
    }
    // the choir ruff: a fan of pleats around the neck
    const rc = { x: 4, y: -108 };
    for (let k = 0; k < 11; k++) {
      const a0 = PI + 0.12 + k / 11 * (PI - 0.24), a1 = a0 + (PI - 0.24) / 11;
      ctx.beginPath(); ctx.moveTo(rc.x, rc.y + 4); ctx.arc(rc.x, rc.y + 4, 30, a0, a1); ctx.closePath();
      fillInk(ctx, (k % 2) ? C.enamelB : C.porcelain, 1.3);
    }
    ctx.beginPath(); ctx.arc(rc.x, rc.y + 4, 30, PI + 0.12, TAU - 0.12); goldStroke(ctx, 1.8, false);
    drawSites(ctx, 'torso', L.inf, t, ghost);
    ctx.restore();
  }

  function drawPauldron(ctx, g, p, L, near, ls, ghost) {
    ctx.save(); ctx.translate(g.W.x, g.W.y); ctx.rotate(p.lean);
    const x = near ? 46 : -44, y = near ? -96 : -94, s = near ? 1 : 0.9, sd = near ? 1 : -1;
    ctx.translate(x, y); ctx.scale(s, s);
    // three bell-flare lames, the largest on top (inverted bells)
    for (let k = 2; k >= 0; k--) {
      const w = 28 - k * 3.5, top = -16 + k * 10, bot = top + 14;
      ctx.beginPath(); ctx.moveTo(-w + sd * 2, bot); ctx.quadraticCurveTo(-w - 3, top + 2, sd * 2, top - 3 - (k ? 0 : 6)); ctx.quadraticCurveTo(w + 3, top + 2, w + sd * 2, bot); ctx.quadraticCurveTo(sd * 2, bot - 6, -w + sd * 2, bot); ctx.closePath();
      ctx.fillStyle = k === 0 ? cel(ctx, 0, top + 4, ls, -0.5, w, near ? C.enamel : C.enamelB) : (k === 1 ? C.enamelB : C.enamelD); ctx.fill(); ink(ctx, 2);
      ctx.beginPath(); ctx.moveTo(-w + sd * 2 + 2, bot - 1); ctx.quadraticCurveTo(sd * 2, bot - 6.5, w + sd * 2 - 2, bot - 1); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.8; ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(sd * 2, -24); ctx.lineTo(sd * 2 + 3.5, -18); ctx.lineTo(sd * 2, -12); ctx.lineTo(sd * 2 - 3.5, -18); ctx.closePath(); fillInk(ctx, L.open > 0.5 ? CRIM : CYAN, 1);
    drawSites(ctx, near ? 'pf' : 'pb', L.inf, 0, ghost);
    ctx.restore();
  }

  /* ---------------- the Core ---------------- */
  function drawCore(ctx, e, g, p, L, ghost) {
    const c = g.core, t = e.t, on = L.coreOn * L.flick, k = 0.55 + 0.45 * (p.core || 0), inf = L.inf;
    if (L.open < 0.5) {
      if (!ghost) { glow(ctx, c.x, c.y, 40 + 18 * (p.core || 0), CYAN, 0.7 * on * k * (1 - L.red)); glow(ctx, c.x, c.y, 46 + 22 * (p.core || 0), CRIM, 0.85 * on * L.red); glow(ctx, c.x, c.y, 18, '#ffffff', 0.5 * on); }
      const orb = U.mixHex(CYANW, CRIML, inf * 0.55);
      ctx.beginPath(); ctx.arc(c.x, c.y, 14.5, 0, TAU); fillInk(ctx, on > 0.4 ? orb : '#6f7f8f', 1.8);
      ctx.save(); ctx.beginPath(); ctx.arc(c.x, c.y, 14.5, 0, TAU); ctx.clip();
      ctx.fillStyle = U.rgba(on > 0.4 ? '#78d4ec' : '#4a5566', 0.75); ctx.beginPath(); ctx.arc(c.x - 6, c.y + 5, 14, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(c.x + 4.5, c.y - 6, 3.8, 2.4, -0.5, 0, TAU); ctx.fill();
      // armillary cage turning around it
      for (let j = 0; j < 3; j++) {
        const a = t * 0.9 + j * PI / 3, ry = 21 * Math.abs(Math.cos(a)) + 1.5;
        ctx.beginPath(); ctx.ellipse(c.x, c.y, 21, ry, j * PI / 3, 0, TAU); goldStroke(ctx, 1.5, false);
      }
      if (inf > 0.05) crystal(ctx, c.x - 8, c.y + 9, 2.2, 0.45 + inf * 0.65, ghost ? 0 : 0.4);
    } else {
      // the inner choir-core: a crimson heart inside three spinning gold rings, choir lamps orbiting
      if (!ghost) { glow(ctx, c.x, c.y, 80, CRIM, 0.6 * on); glow(ctx, c.x, c.y, 28, '#fff0f4', 0.75 * on); }
      for (let j = 0; j < 3; j++) {
        const a = t * (2.2 + j * 0.7) + j, rx = 34 - j * 6, ry = rx * Math.abs(Math.cos(a)) + 2;
        ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, j * 1.05 + t * 0.3, 0, TAU); goldStroke(ctx, 2.4 - j * 0.4, false);
      }
      const hr = 13 + Math.sin(t * 7) * 1.3, sp = L.spared || 0, dim = on < 0.4 ? 0.55 : 0;
      ctx.beginPath(); ctx.moveTo(c.x, c.y - hr * 1.3); ctx.lineTo(c.x + hr, c.y - hr * 0.2); ctx.lineTo(c.x + hr * 0.5, c.y + hr); ctx.lineTo(c.x - hr * 0.5, c.y + hr); ctx.lineTo(c.x - hr, c.y - hr * 0.2); ctx.closePath();
      fillInk(ctx, U.mixHex(U.mixHex(CRIM, GOLD, sp), '#3a2030', dim), 1.8);
      ctx.beginPath(); ctx.moveTo(c.x, c.y - hr * 1.3); ctx.lineTo(c.x + hr, c.y - hr * 0.2); ctx.lineTo(c.x, c.y + hr * 0.2); ctx.closePath(); ctx.fillStyle = U.mixHex(U.mixHex('#ffd6e2', '#fff6dc', sp), '#6a4050', dim); ctx.fill();
      if (sp < 0.6) for (let j = 0; j < 5; j++) crystal(ctx, c.x + Math.cos(j * 1.26 + 0.3) * 9, c.y + Math.sin(j * 1.26 + 0.3) * 9, j * 1.26 + 0.3, 0.66 * (1 - sp), 0);
      for (let j = 0; j < 6; j++) {
        const a = t * 1.6 + j / 6 * TAU, x = c.x + Math.cos(a) * 42, y = c.y + Math.sin(a) * 15;
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); fillInk(ctx, j % 2 ? GOLDL : CRIML, 0.9);
        if (!ghost) glow(ctx, x, y, 10, j % 2 ? GOLD : CRIM, 0.6);
      }
    }
  }

  /* ---------------- head: a rounded cowl crowned with tiny organ pipes, the singing porcelain mask ---------------- */
  const HOOD = [[0, -50], [18, -44], [29, -24], [32, 4], [28, 30], [-4, 37], [-29, 29], [-34, 2], [-30, -24], [-18, -44]];
  function drawHead(ctx, e, g, p, L, ls, ghost) {
    const t = e.t, p2 = e.phase === 2 && !L.spared, inf = L.inf;
    ctx.save(); ctx.translate(g.hd.x, g.hd.y); ctx.rotate(g.ha);
    // crown of pipes behind the cowl's brow
    const crown = [[-16, 17, 0], [-8, 25, 1], [0, 33, 0], [8, 25, 1], [16, 17, 0]];
    for (const [x, h, m] of crown) {
      ctx.beginPath(); ctx.rect(x - 3.6, -42 - h, 7.2, h + 4); fillInk(ctx, m ? C.enamel : GOLD, 1.5);
      ctx.beginPath(); ctx.ellipse(x, -42 - h, 4.3, 1.6, 0, 0, TAU); fillInk(ctx, '#140f2e', 1);

      ctx.fillStyle = L.lit > 0.3 ? (p2 ? CRIM : CYAN) : '#3a3a4a'; ctx.fillRect(x - 1.4, -42 - h * 0.35, 2.8, 2);
    }
    // cowl: a rounded hood of enamel with gold edging and a dark interior
    smooth(ctx, HOOD); ctx.fillStyle = cel(ctx, 0, -10, 1, -0.2, 32, C.enamelB); ctx.fill();
    ctx.save(); smooth(ctx, HOOD); ctx.clip(); ctx.fillStyle = 'rgba(56,22,90,0.28)'; ctx.beginPath(); ctx.ellipse(ls > 0 ? -30 : 34, 6, 18, 46, 0, 0, TAU); ctx.fill(); ctx.restore();
    smooth(ctx, HOOD); ink(ctx, 2.6);
    ctx.save(); smooth(ctx, HOOD); ctx.clip(); smooth(ctx, HOOD); ctx.strokeStyle = GOLD; ctx.lineWidth = 3.6; ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.ellipse(6, 4, 21, 28, 0.05, 0, TAU); fillInk(ctx, '#121534', 1.5);
    // mask
    const mask = () => { ctx.beginPath(); ctx.ellipse(8, 4, 15.5, 22.5, 0.06, 0, TAU); };
    mask(); ctx.fillStyle = C.porcelain; ctx.fill();
    ctx.save(); mask(); ctx.clip();
    ctx.fillStyle = 'rgba(150,130,190,0.42)'; ctx.beginPath(); ctx.ellipse(ls > 0 ? -2.5 : 18.5, 5, 9.5, 26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.ellipse(ls > 0 ? 15 : 1, -7, 2.4, 9, 0.1, 0, TAU); ctx.fill();
    ctx.restore();
    mask(); ink(ctx, 2);
    // the face: closed serene eyes, a seam, a small singing mouth
    const eyes = L.eyes * L.flick, eyeCol = p2 ? CRIM : CYAN;
    for (const [ex, w] of [[14, 5.6], [2, 4]]) {
      ctx.beginPath(); ctx.moveTo(ex - w, -2); ctx.quadraticCurveTo(ex, 1.8, ex + w, -2.3);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
      if (!ghost && eyes > 0.05) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(eyeCol, 0.95 * eyes); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(ex - w * 0.8, -0.3); ctx.quadraticCurveTo(ex, 2.8, ex + w * 0.8, -0.5); ctx.stroke(); ctx.restore(); glow(ctx, ex, 0, 10, eyeCol, 0.55 * eyes); }
    }
    ctx.strokeStyle = U.rgba(GOLDD, 0.9); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(9.5, -18); ctx.quadraticCurveTo(11, 3, 9.5, 25); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,60,110,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(12, 0); ctx.quadraticCurveTo(14.5, 5, 12.5, 8.5); ctx.stroke();
    const sing = 0.6 + 0.4 * Math.max(p.core || 0, e.state === 'atk' ? 0.6 : 0.2);
    ctx.beginPath(); ctx.ellipse(11.5, 14, 2.4 * sing, 3.3 * sing, 0, 0, TAU); fillInk(ctx, '#2a1430', 1.2);
    if (!ghost && eyes > 0.05) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(eyeCol, 0.6 * eyes * sing); ctx.beginPath(); ctx.ellipse(11.5, 14.5, 1.4 * sing, 2 * sing, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    // circlet with a jewel
    ctx.beginPath(); ctx.moveTo(-16, -19); ctx.quadraticCurveTo(7, -28, 25, -17); goldStroke(ctx, 2.8);
    ctx.beginPath(); ctx.moveTo(8, -31); ctx.lineTo(12, -25.5); ctx.lineTo(8, -20); ctx.lineTo(4, -25.5); ctx.closePath(); fillInk(ctx, p2 ? CRIM : CYAN, 1.2);
    if (!ghost) glow(ctx, 8, -25.5, 11, p2 ? CRIM : CYAN, 0.5 * L.coreOn);
    // crimson tears (infection) and, once the chest has opened, a crack through the porcelain
    if (inf > 0.3) {
      const k = clamp01((inf - 0.3) / 0.4);
      ctx.strokeStyle = CRIMD; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(14.5, 1); ctx.quadraticCurveTo(16.5, 8 + k * 4, 14.5, 6 + k * 13); ctx.stroke();
      ctx.strokeStyle = CRIM; ctx.lineWidth = 1.2; ctx.stroke();
    }
    if (p2 || L.wreck) {
      ctx.beginPath(); ctx.moveTo(-3, -19); ctx.lineTo(1.5, -8); ctx.lineTo(-2, -2); ctx.lineTo(3.5, 6); ctx.lineTo(0, 15); ctx.lineTo(4.5, 24); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7, -6); ctx.lineTo(1.5, -8); ctx.lineTo(-2, -2); ctx.lineTo(-7, 0); ctx.closePath(); fillInk(ctx, '#3a0a1c', 1);
      if (!ghost) glow(ctx, -3, -4, 11, CRIM, 0.6);
    }
    drawSites(ctx, 'head', inf, t, ghost);
    ctx.restore();
  }

  /* ---------------- arms, hands, baton, tuning fork ---------------- */
  function drawArm(ctx, e, g, p, L, front, ls, ghost) {
    const S = front ? g.sf : g.sb, E = front ? g.ef : g.eb, Hn = front ? g.hf : g.hb, col = front ? C.enamel : C.enamelB;
    const fa = Math.atan2(Hn.y - E.y, Hn.x - E.x), nx = -Math.sin(fa), ny = Math.cos(fa);
    // forearm first: it slides out of the sleeve's mouth
    Rig.limb(ctx, E, Hn, 7.4, 5.6, col, { noHatch: true, spec: front ? 0.4 : 0 });
    const b0 = lerpP(E, Hn, 0.6), b1 = lerpP(E, Hn, 0.84);
    ctx.beginPath(); ctx.moveTo(b0.x + nx * 7, b0.y + ny * 7); ctx.lineTo(b1.x + nx * 6.2, b1.y + ny * 6.2); ctx.lineTo(b1.x - nx * 6.2, b1.y - ny * 6.2); ctx.lineTo(b0.x - nx * 7, b0.y - ny * 7); ctx.closePath();
    fillInk(ctx, front ? GOLD : GOLDD, 1.3);
    ctx.strokeStyle = U.rgba(GOLDL, 0.85); ctx.lineWidth = 0.8; ctx.beginPath(); const bm = lerpP(b0, b1, 0.5); ctx.moveTo(bm.x + nx * 5.4, bm.y + ny * 5.4); ctx.lineTo(bm.x - nx * 5.4, bm.y - ny * 5.4); ctx.stroke();
    // the bell sleeve: a rigid enamel flare from shoulder to past the elbow, gold-rimmed, dark inside
    const ua = Math.atan2(E.y - S.y, E.x - S.x), ux = Math.cos(ua), uy = Math.sin(ua), mx = -uy, my = ux;
    const s0 = { x: S.x - ux * 4, y: S.y - uy * 4 }, s1 = { x: E.x + ux * 5, y: E.y + uy * 5 }, w0 = 9.5, w1 = 16;
    const sleeve = () => { ctx.beginPath(); ctx.moveTo(s0.x + mx * w0, s0.y + my * w0); ctx.quadraticCurveTo((s0.x + s1.x) / 2 + mx * (w0 + w1) * 0.42, (s0.y + s1.y) / 2 + my * (w0 + w1) * 0.42, s1.x + mx * w1, s1.y + my * w1); ctx.lineTo(s1.x - mx * w1, s1.y - my * w1); ctx.quadraticCurveTo((s0.x + s1.x) / 2 - mx * (w0 + w1) * 0.42, (s0.y + s1.y) / 2 - my * (w0 + w1) * 0.42, s0.x - mx * w0, s0.y - my * w0); ctx.closePath(); };
    sleeve(); ctx.fillStyle = cel(ctx, (s0.x + s1.x) / 2, (s0.y + s1.y) / 2, mx, my, w1, col); ctx.fill(); ink(ctx, 2);
    ctx.save(); sleeve(); ctx.clip();
    ctx.strokeStyle = 'rgba(11,6,18,0.45)'; ctx.lineWidth = 1; for (const k of [-0.45, 0.1, 0.6]) { ctx.beginPath(); ctx.moveTo(s0.x + mx * w0 * k, s0.y + my * w0 * k); ctx.lineTo(s1.x + mx * w1 * k, s1.y + my * w1 * k); ctx.stroke(); }
    ctx.restore();
    // mouth of the sleeve
    ctx.save(); ctx.translate(s1.x, s1.y); ctx.rotate(ua);
    ctx.beginPath(); ctx.ellipse(0, 0, 5, w1, 0, 0, TAU); fillInk(ctx, '#121534', 1.6);
    ctx.beginPath(); ctx.ellipse(-1.5, 0, 5.5, w1 + 0.5, 0, -PI / 2, PI / 2); ctx.strokeStyle = GOLD; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.restore();
    // the forearm re-emerges from the dark: its first segment drawn over the sleeve's mouth
    Rig.limb(ctx, lerpP(E, Hn, 0.1), lerpP(E, Hn, 0.56), 7, 6.3, col, { noHatch: true });
    ctx.beginPath(); ctx.arc(S.x, S.y, 4, 0, TAU); ctx.fillStyle = L.open > 0.5 ? CRIM : (front ? CYAN : '#58a8b8'); ctx.fill();
    if (front) { drawBaton(ctx, e, g, p, L, ghost); drawFist(ctx, Hn, p.fb, true); }
    else {
      if (p.fork > 0.02) drawFork(ctx, e, g, p, L, ghost);
      if (p.bh > 0.5 || p.fork > 0.2) drawFist(ctx, Hn, p.be, false); else drawHand(ctx, Hn, fa, 1 - p.bh, ls);
    }
  }
  function drawFist(ctx, Hn, ang, front) {
    ctx.save(); ctx.translate(Hn.x, Hn.y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(-6, -6.5); ctx.quadraticCurveTo(4, -9, 8, -4); ctx.quadraticCurveTo(10, 2, 7, 6.5); ctx.quadraticCurveTo(-2, 9, -7, 5); ctx.closePath();
    fillInk(ctx, front ? C.enamel : C.enamelB, 1.5);
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 0.8;
    for (const y of [-2.5, 1, 4.2]) { ctx.beginPath(); ctx.moveTo(1, y); ctx.lineTo(7.5, y - 0.4); ctx.stroke(); }
    ctx.fillStyle = GOLD; ctx.fillRect(-6.5, -5.6, 2.4, 11);
    ctx.restore();
  }
  function drawHand(ctx, Hn, ang, open, ls) {
    // an open conductor's hand: long, spread fingers
    ctx.save(); ctx.translate(Hn.x, Hn.y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(-3, -5.5); ctx.lineTo(8, -6.5); ctx.lineTo(9, 5.5); ctx.lineTo(-3, 5); ctx.closePath(); fillInk(ctx, C.enamelB, 1.4);
    const fingers = [[-0.55, 15], [-0.18, 18], [0.16, 17], [0.48, 13]];
    ctx.lineCap = 'round';
    for (const [a0, l] of fingers) {
      const a = a0 * (0.5 + 0.7 * open), y0 = a0 * 9, x1 = 8 + Math.cos(a) * l * (0.6 + 0.4 * open), y1 = y0 + Math.sin(a) * l * (0.6 + 0.4 * open);
      ctx.beginPath(); ctx.moveTo(7, y0); ctx.quadraticCurveTo((7 + x1) / 2 + 1, (y0 + y1) / 2 + 2 * (1 - open), x1, y1 + 3 * (1 - open));
      ctx.strokeStyle = INK; ctx.lineWidth = 4.6; ctx.stroke(); ctx.strokeStyle = C.enamel; ctx.lineWidth = 2.6; ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(2, 4); ctx.quadraticCurveTo(6, 11, 11, 12); ctx.strokeStyle = INK; ctx.lineWidth = 4.4; ctx.stroke(); ctx.strokeStyle = C.enamel; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.restore();
  }
  function drawBaton(ctx, e, g, p, L, ghost) {
    const a = p.fb, gx = g.gf.x, gy = g.gf.y;
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(a);
    // grip: pearl pommel, gold cork handle, collar
    ctx.beginPath(); ctx.arc(-17, 0, 3.6, 0, TAU); fillInk(ctx, C.pearl, 1.3);
    ctx.beginPath(); ctx.moveTo(-14, -3); ctx.quadraticCurveTo(-6, -4.6, 2, -2.6); ctx.lineTo(2, 2.6); ctx.quadraticCurveTo(-6, 4.6, -14, 3); ctx.closePath(); fillInk(ctx, GOLD, 1.3);
    ctx.strokeStyle = GOLDD; ctx.lineWidth = 0.8; for (const x of [-10, -6, -2]) { ctx.beginPath(); ctx.moveTo(x, -3.4); ctx.lineTo(x + 1, 3.4); ctx.stroke(); }
    // blade: a long white tapered shaft with a cyan edge (crimson once the Core opens)
    ctx.beginPath(); ctx.moveTo(2, -3.3); ctx.lineTo(LB, -0.5); ctx.lineTo(LB + 4, 0); ctx.lineTo(LB, 0.6); ctx.lineTo(2, 3.3); ctx.closePath(); fillInk(ctx, '#fbfaf6', 1.6);
    ctx.fillStyle = 'rgba(150,135,185,0.55)'; ctx.beginPath(); ctx.moveTo(2, 0.4); ctx.lineTo(LB, 0.2); ctx.lineTo(2, 3.3); ctx.closePath(); ctx.fill();
    const hot = e.state === 'atk' ? Math.max(e.tellT * 2, 0.4) : 0.25;
    if (!ghost) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(L.open > 0.5 ? CRIM : CYAN, Math.min(1, 0.4 + hot) * L.coreOn); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(6, -1.6); ctx.lineTo(LB - 4, -0.3); ctx.stroke(); ctx.restore(); }
    ctx.beginPath(); ctx.rect(2, -4, 4, 8); fillInk(ctx, GOLD, 1.1);
    ctx.restore();
  }
  function drawFork(ctx, e, g, p, L, ghost) {
    const Hn = g.hb, a = p.be, k = clamp01(p.fork);
    ctx.save(); ctx.translate(Hn.x, Hn.y); ctx.rotate(a); ctx.globalAlpha *= k;
    if (!ghost) glow(ctx, 70, 0, 50, GOLDL, 0.25 * k);
    // stem, U-yoke, two long prongs
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(26, 0); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(96, -7); ctx.lineTo(34, -7); ctx.quadraticCurveTo(26, -7, 26, 0); ctx.quadraticCurveTo(26, 7, 34, 7); ctx.lineTo(96, 7);
    ctx.strokeStyle = INK; ctx.lineWidth = 7.4; ctx.stroke(); ctx.strokeStyle = GOLD; ctx.lineWidth = 4.2; ctx.stroke(); ctx.strokeStyle = U.rgba(GOLDL, 0.9); ctx.lineWidth = 1.2; ctx.stroke();
    // resonance: the prongs blur right after each strike
    const ring = e.state === 'atk' && e.atk && (e.atk === chime || e.atk === chime5) ? Math.max(0, 1 - ((e.st + 0.88) % 0.42) / 0.3) : 0;
    if (!ghost && ring > 0.05) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba('#ffffff', 0.5 * ring); ctx.lineWidth = 2;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(40, s * 7); ctx.lineTo(96, s * (7 + 3 * ring)); ctx.stroke(); }
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(100, 0, 8 + i * 9 + (1 - ring) * 14, -1.2, 1.2); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------------- motion smear, dazed stars ---------------- */
  function drawSmear(ctx, e, L) {
    const a = e.state === 'atk' ? e.atk : null;
    if (!a || !a.hits || LQ()) return;
    const near = a.hits.some((h) => e.st >= h.t0 - 0.08 && e.st <= h.t1 + 0.06);
    const tr = e.trail;
    if (!near || tr.length < 3) return;
    const sp = Math.hypot(tr[tr.length - 1].tx - tr[0].tx, tr[tr.length - 1].ty - tr[0].ty);
    if (sp < 40) return;
    const red = (a === measure4 && e.st > 2.3) || a === slam || a === slam2, col = red ? CRIM : '#ffffff';
    ctx.save(); ctx.beginPath(); ctx.rect(e.x - 1200, e.y - 1500, 2400, 1500); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    // the swept wedge between the blade's tip and its middle
    ctx.beginPath(); ctx.moveTo(tr[0].tx, tr[0].ty);
    for (let i = 1; i < tr.length; i++) ctx.lineTo(tr[i].tx, tr[i].ty);
    for (let i = tr.length - 1; i >= 0; i--) ctx.lineTo(U.lerp(tr[i].gx, tr[i].tx, 0.45), U.lerp(tr[i].gy, tr[i].ty, 0.45));
    ctx.closePath(); ctx.fillStyle = U.rgba(col, 0.2); ctx.fill();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (red) {
      ctx.beginPath(); tr.forEach((q, i) => (i ? ctx.lineTo(q.tx, q.ty) : ctx.moveTo(q.tx, q.ty)));
      ctx.strokeStyle = U.rgba(col, 0.8); ctx.lineWidth = 5; ctx.stroke();
    } else {
      // the conductor's stroke leaves a stave of light behind the tip: five lines, notes riding them
      const n = tr.length, nrm = tr.map((q, i) => { const a0 = tr[Math.max(0, i - 1)], b0 = tr[Math.min(n - 1, i + 1)], dx = b0.tx - a0.tx, dy = b0.ty - a0.ty, d = Math.hypot(dx, dy) || 1; return { x: -dy / d, y: dx / d }; });
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const w = 4.2 * (0.35 + 0.65 * i / (n - 1)), x = tr[i].tx + nrm[i].x * k * w - nrm[i].x * 9, y = tr[i].ty + nrm[i].y * k * w - nrm[i].y * 9; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = U.rgba(k === 0 ? '#ffffff' : '#fff1c2', k === 0 ? 0.85 : 0.55); ctx.lineWidth = k === 0 ? 2.2 : 1.2; ctx.stroke();
      }
      for (const fi of [0.35, 0.7]) {
        const i = Math.round(fi * (n - 1)), q = tr[i], m = nrm[i], lane = fi > 0.5 ? 4 : -4;
        const x = q.tx + m.x * (lane - 9), y = q.ty + m.y * (lane - 9);
        ctx.fillStyle = 'rgba(255,241,194,0.95)'; ctx.beginPath(); ctx.ellipse(x, y, 3.4, 2.4, -0.4, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,241,194,0.95)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 3, y - 0.5); ctx.lineTo(x + 3, y - 11); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // little inked notes drifting up off the halo (the choir is always singing, a little)
  function updNotes(e, dt, L) {
    const N = e.notes;
    e.noteT = (e.noteT || 0) - dt;
    if (e.noteT <= 0 && L.haloOn > 0.5 && !LQ() && N.length < 7 && e.haloW) {
      e.noteT = (e.phase === 2 ? 0.45 : 0.75) * (0.7 + Math.random() * 0.6);
      const a = Math.random() * TAU, r = 80 * SC;
      N.push({ x: e.haloW.x + Math.cos(a) * r, y: e.haloW.y + Math.sin(a) * r * 0.9, vx: Math.cos(a) * 14, vy: -26 - Math.random() * 18, t: 0, life: 2 + Math.random(), s: 0.8 + Math.random() * 0.5, flag: Math.random() < 0.5, ph: Math.random() * TAU });
    }
    for (let i = N.length - 1; i >= 0; i--) { const q = N[i]; q.t += dt; q.x += (q.vx + Math.sin(q.t * 2.4 + q.ph) * 12) * dt; q.y += q.vy * dt; if (q.t > q.life) N.splice(i, 1); }
  }
  function drawNotes(ctx, e) {
    const col = e.phase === 2 ? CRIML : GOLDL;
    for (const q of e.notes) {
      const a = Math.min(1, q.t * 3) * Math.max(0, 1 - q.t / q.life);
      if (a <= 0.02) continue;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(q.x, q.y); ctx.rotate(Math.sin(q.t * 2 + q.ph) * 0.25); ctx.scale(q.s, q.s);
      ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 3, -0.45, 0, TAU); ctx.fillStyle = col; ctx.fill(); ink(ctx, 1.2);
      ctx.beginPath(); ctx.moveTo(3.6, -1); ctx.lineTo(3.6, -15); if (q.flag) ctx.quadraticCurveTo(9, -11, 8, -6); ink(ctx, 3.2); ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.restore();
    }
  }
  function drawDazed(ctx, e, g, toW) {
    const h = toW(g.hc);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a = e.t * 3 + i * TAU / 4, x = h.x + Math.cos(a) * 46, y = h.y + 30 + Math.sin(a) * 10;
      ctx.fillStyle = U.rgba('#ffd27a', 0.85); ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 1.6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 1.6, y); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y + 1.6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y - 1.6); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function drawDebug(ctx, e) {
    ctx.save(); ctx.lineWidth = 2;
    const b = e.box; ctx.strokeStyle = 'rgba(80,170,255,0.9)'; ctx.strokeRect(b.x, b.y, b.w, b.h);
    if (e.state === 'atk' && e.atk && e.atk.hits) e.atk.hits.forEach((h) => {
      const w = e.boxW(h.box), act = e.st >= h.t0 && e.st <= h.t1;
      ctx.strokeStyle = act ? (h.red ? '#ff2040' : '#ffffff') : 'rgba(255,230,0,0.6)'; ctx.setLineDash(act ? [] : [6, 4]); ctx.strokeRect(w.x, w.y, w.w, w.h);
    });
    ctx.restore();
  }

  /* ================================ intro & death ================================ */
  function introEvents(e) {
    if (e.state !== 'spawn') return;
    const v = e.introEv, s = e.st, c = e.coreW || { x: e.x, y: e.y - 200 };
    if (s > 0.5 && !v.a) { v.a = 1; sfx('c6_ignite'); G.FX.flash(c.x, c.y, 90, 0.4, CYAN); }
    if (s > 1.15 && !v.b) { v.b = 1; sfx('c6_ring'); const h = e.haloW; if (h) G.FX.ring(h.x, h.y, 20, 110, 0.5, GOLDL, 3); }
    if (s > 1.45 && !v.b2) { v.b2 = 1; sfx('c6_ring'); }
    if (s > 1.8 && !v.c) { v.c = 1; sfx('c6_choir', 1, 1); G.FX.ember(e.x, e.y - 260, 18, GOLDL, { w: 300, h: 200, up: 80 }); }
    if (s > 3.08 && !v.d) {
      v.d = 1; sfx('c6_organ', 1.2, 1); G.game.shake(0.7);
      G.FX.ring(e.x, e.y - 4, 20, 420, 0.7, GOLDL, 6, { flat: 0.2 }); G.FX.dust(e.x, e.y, 24, { w: 360, speed: 260, size: 18, col: 'rgba(235,228,240,' });
      G.FX.ring(c.x, c.y, 10, 240, 0.6, '#ffffff', 5);
    }
  }
  // the defeat: a slow collapse that stays in the hall as a wreck through the dialogue (and wakes if spared)
  function spawnWreck(e) {
    const fl = G.game.save && G.game.save.flags;
    const W = { kind: 'c6_wreck', owner: e, t: 0, rt0: rtime(), pose0: Object.assign({}, e.pose || POSE0), flag0: fl ? fl.c6_spared : undefined, update() { }, draw: wreckDraw };
    e.wreck = W; e.trail.length = 0;
    G.game.hazards.push(W);
    sfx('c6_death'); sfx('c6_shatter');
    const c = e.coreW || { x: e.x, y: e.y - 200 };
    G.FX.flash(c.x, c.y, 320, 0.6, '#ffffff'); G.FX.ring(c.x, c.y, 20, 520, 1.0, CRIM, 8);
    const h = e.haloW; if (h) { G.FX.shards(h.x, h.y, LQ() ? 14 : 30, GOLD, 520); G.FX.ring(h.x, h.y, 40, 200, 0.8, GOLDL, 4); }
  }
  function wreckDraw(ctx, W) {
    const e = W.owner, rt = rtime() - W.rt0, fl = G.game.save && G.game.save.flags;
    if (e.remove) e.t += vdt();
    // the choice after the defeat dialogue: spared → warm light returns to the Core; shut down → its last light goes out
    if (fl && fl.c6_spared === true && W.flag0 !== true && W.sparedAt == null) { W.sparedAt = rtime(); sfx('c6_wake'); const c = e.coreW; if (c) { G.FX.shards(c.x, c.y, 20, CRIM, 420); G.FX.ring(c.x, c.y, 10, 200, 0.8, GOLDL, 5); } }
    if (fl && fl.c6_spared === false && W.flag0 !== false && W.shutAt == null) { W.shutAt = rtime(); const c = e.coreW; if (c) G.FX.ember(c.x, c.y, 12, CRIM, { w: 40, h: 40, up: 60 }); }
    const sp = W.sparedAt != null ? clamp01((rtime() - W.sparedAt) / 2.2) : 0, shut = W.shutAt != null ? clamp01((rtime() - W.shutAt) / 1.8) : 0;
    const k = U.easeInOutSine(clamp01((rt - 0.35) / 1.3));
    const p = lerpPose(W.pose0, SLUMP, k);
    p.hov += Math.sin(rt * 0.9) * 0.6 * (1 - k);
    const L = {
      inf: clamp01(infOf(e) + 0.2) * (1 - sp), p2: e.pipesK || 0, open: e.openK || 0, lit: (1 - clamp01(rt / 0.8)) * (1 - sp) + sp * 0.6,
      haloOn: (1 - clamp01((rt - 0.2) / 0.6)) + sp * 0.5, coreOn: rt < 0.35 ? 1.6 : (0.12 + 0.08 * Math.sin(rtime() * 2.2)) * (1 - shut) + sp * 0.9,
      eyes: (1 - clamp01(rt / 0.6)) + sp * 0.8, red: 0, ts: 1, alpha: 1, flick: 1, wreck: Math.max(0.01, k), spared: sp, broken: false,
      haloBreak: clamp01((rt - 0.3) / 1.0) * (1 - sp),
    };
    ctx.save();
    renderBody(ctx, e, p, L, false, Math.min(vdt(), 1 / 30));
    // spared: a warm light comes back into the Core
    if (sp > 0) { const c = e.coreW; if (c) { glow(ctx, c.x, c.y, 90 * sp, GOLDL, 0.6 * sp); glow(ctx, c.x, c.y, 30, '#ffffff', 0.7 * sp); } }
    ctx.restore();
  }

  /* ================================ codex portrait framing ================================ */
  // (portraits render the live type: T.portrait = [scale, yFrac] above)
})(window.G);

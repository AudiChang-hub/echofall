'use strict';
/* ECHOFALL — Chapter VIII boss: 米菈・休止之心 MIRA — HEART OF THE REST (c8_boss)
   Barrow's lost daughter. Twenty years ago Maestrina carried her up the Ladder; up here she became the Heart of the Rest:
   a frightened child holding the world's breath. Behind her stands a vast shadow of silence — a girl-shaped night sky with
   her bob, her scarf and her gestures, ×4.4, mirroring her a heartbeat late. She is not a monster: the fight is a duet.
   I   搖籃曲 LULLABY   eyes shut, cheeks puffed — holding her breath. 音盒鈴音 chime volley (white notes; a perfect guard sends
                        them back into the box) · 搖籃環 lullaby rings (white, parry = balance) · 影之手 the shadow's hand slaps
                        the floor and sweeps it (red: jump / dodge) · 休止符雨 rest signs fall onto red marks · 「噓——」 silence
                        (sound ducks, the screen edges dim, rests fall without a sound) · 影之掌 crowd her and the shadow's
                        palm presses down over you (red) · cornered, she floats over your head.
   II  二重唱 DUET      she opens her eyes and curtsies; the shadow steps back and sings with her in CANON, 0.6 s behind:
                        her note · its ink note (long-short) · canon rings · 拂 her small white brush of light → the shadow's
                        giant red sweep 0.6 s later · palm presses in counterpoint with a chime · duet phrase · silence + canon.
   III 休止 THE REST    (30 %) the shadow alone, enormous, front-on; Mira curled in its chest like a heart behind a stave.
                        double sweep (out, then back) · heartbeat rings in pairs · lobbed music-box notes · alternating
                        palm presses · 終曲 THE LAST REST: silence, rest lanes, falling notes, a two-handed clap — then it
                        collapses for the longest opening of the fight.
   Every perfect guard is an answer: the parry rings the next note of Maestrina's theme, her box answers a sixth above, a gold
   note joins the ring around her and her colour comes back. Fourteen answers complete the phrase: she remembers the next note.
   Defeat does not kill her: the shadow breaks into light and Mira kneels, alive. A persistent hazard draws her until the
   chapter ends and answers save.flags.c8_ending_choice ('encore' | 'solo' | 'fermata') or ending_encore / _solo / _fermata.
   Hit boxes of the shadow's hands are its drawn hands (the same sampled pose drives both).
   Dev aids (URL, inert otherwise): c8dbg (hit boxes) · c8ph=2|3 (start in a phase) · c8warm=0..1 · c8kneel=1|encore|solo|fermata. */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK, D = G.DATA;
  const CRIM = '#ff2a55', CRIML = '#ff9ab4';
  const GOLD = '#ffd27a', GOLDL = '#fff2cc', LIGHT = '#fff9ec';
  const VOID = '#0d0721', LILAC = '#d6caff', RIM = '#a892f2';
  const SCARF = '#d2353d', SCARFD = '#8a1b2a', SCARFL = '#ff9a86';
  const BRASS = '#d3a04a', BRASSL = '#ffe4a6', BRASSD = '#7b5022';
  const SS = 4.6, SHIP = 205, HC = 2.15, TURN = 0.32, MS = 1.2;   // shadow ×4.6 of her · Mira drawn ×1.2
  const QS = (() => { try { return new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, '')); } catch (err) { return new URLSearchParams(''); } })();
  const DBG = QS.has('c8dbg');
  const DEV = { ph: +(QS.get('c8ph') || 0), warm: QS.has('c8warm') ? +QS.get('c8warm') : null, kneel: QS.get('c8kneel') };
  const LQ = () => !!(G.Quality && G.Quality.low);
  const vdt = () => (G.game && G.game.dtVis) || 0;
  const gtime = () => (G.game && G.game.time) || 0;
  const sfx = (n, ...a) => G.SFX.play(n, ...a);
  const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const rot = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return { x: x * c - y * s, y: x * s + y * c }; };
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const dirv = (a, l) => ({ x: Math.sin(a) * l, y: Math.cos(a) * l });
  const clamp01 = (v) => U.clamp(v, 0, 1);
  const sm01 = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };
  const lerpAng = (a, b, t) => { let d = b - a; while (d > PI) d -= TAU; while (d < -PI) d += TAU; return a + d * t; };
  const floorAt = (x, y) => { const f = G.Phys.groundBelow(x, y - 60); return f > 1e8 ? y : f; };
  function arenaOf(e) {
    const a = G.game && G.game.arena;
    if (a && a.id === e.enc) return a;
    const hx = e.homeX ?? e.x;
    return { x0: hx - 950, x1: hx + 450 };
  }
  function viewTop() { const v = G.game && G.game._view; return v ? v.cam.y - G.game.H / 2 / v.S - 30 : -700; }
  // the leitmotif as every Perfect Guard plays it (audio.js) — Mira's box answers a diatonic sixth above it (D minor)
  const PARRY_THEME = [74, 77, 81, 79, 77, 76, 74, 72, 74, 69, 70, 72, 74, 81];
  const SCALE = [0, 2, 3, 5, 7, 8, 10];
  function thirdBelow(m) {
    const rel = (((m - 2) % 12) + 12) % 12; let i = SCALE.indexOf(rel); if (i < 0) i = Math.max(0, SCALE.findIndex((s) => s > rel) - 1);
    const j = i - 2, oct = Math.floor(j / 7);
    return m - rel + SCALE[((j % 7) + 7) % 7] + oct * 12;
  }

  /* ================================ data: speaker, barks, hints, codex ================================ */
  D.speakers.c8_mira = D.speakers.c8_mira || { name: '厄蕾絲', en: 'ERESH', color: '#ffd6a0' };
  D.barks.c8_bossP2 = { who: 'c8_mira', text: '從來沒有人唱給我聽過……所以，我自己唱。妳要跟好喔。' };
  D.barks.c8_bossP3 = { who: 'c8_mira', text: '不要過來……只要門一直關著，就不會再有人被丟掉。' };
  D.barks.c8_bossTaught = { who: 'c8_mira', text: '……下一個音。我好像，聽過。' };
  D.barks.c8_bossHush = { who: 'ode', text: '……她，從來沒有呼吸過。' };
  D.barks.c8_bossFinale = { who: 'c8_mira', text: '最後一道門……拜託，讓它一直關著。' };
  D.hints.c8_bossChime = '音樂盒的音符是白光：在音符碰到你的瞬間 {dodge} 完美閃避，就是一句回答。';
  D.hints.c8_bossTeach = '每一次完美閃避都是一句回答——她的顏色會一點一點回來。湊滿一整句旋律，她會想起下一個音。';
  D.hints.c8_bossSweep = '影子的手是紅光：手掌拍上地板的那一拍，{jump} 跳過它，或 {dodge} 穿過去。';
  D.hints.c8_bossHush = '「噓——」：寂靜裡聽不見預告聲。看地板上的紅色記號，休止符會落在那裡。';
  D.hints.c8_bossCanon = '卡農：影子會在 0.6 秒後重複她剛才的動作。她的白光之後，往往緊跟著影子的紅光。';
  D.hints.c8_bossFinale = '終曲：跟著記號換位置、閃過落下的音符；雙手在你頭上合起時 {dodge}。之後影子會累倒——全力反擊。';
  // fallback only — the chapter file (ch8.js) registers after this one and its own lines replace these
  if (!D.dialog.c8_bossDefeat) {
    D.dialog.c8_bossDefeat = [
      { who: 'sys', text: '（她吐出了一口氣。這輩子的第一口氣。）' },
      { who: 'c8_mira', text: '……我好怕。一直、一直都好怕。' },
      { who: 'ode', text: '……她在呼吸。' },
    ];
  }
  D.codex.hushborn = D.codex.hushborn || [];
  if (!D.codex.hushborn.some((c) => c.id === 'c8_boss')) D.codex.hushborn.push({
    id: 'c8_boss', name: '冥后・厄蕾絲', en: 'ERESH, QUEEN OF THE DEAD', portrait: 'c8_boss', unlock: 'seen_c8_boss',
    tag: '頭目｜冥后宮殿',
    body: [
      '溫陀王的第一個女兒。生下來就沒有呼吸，父親沒有替她取名字。她在冥界長大，成了冥界的女王。十八年前，她看見父親又丟掉一個女兒，於是關上了冥界的門——讓他永遠死不了，看著自己的國家腐爛。',
      '她身後那道巨大的影子不是怪物。那是冥界本身：同樣的短髮、同樣的圍巾、同樣的手勢，只是大了四倍，裡面裝滿了沒有星星的夜空。至於她自己，模樣停在一個從沒長大的女孩。',
      '第一樂章「搖籃曲」：音樂盒鈴音（白光——在音符碰到你的瞬間完美閃避）、搖籃環（白光，看準了閃過）、影之手（紅光：手掌拍上地板的那一拍，跳過或閃避）、休止符雨（地上的紅色記號）、「噓——」寂靜（聲音消失、視野邊緣變暗，只剩眼睛可靠）。靠得太近，影子會用手掌護住她；被逼到牆角，她會從你頭上飄過去。',
      '第二樂章「二重唱」：她睜開了眼睛，行了一個小小的屈膝禮。影子退到她身後，與她錯開 0.6 秒合唱——卡農。她的白光之後，往往緊跟著影子的紅光；節奏總是一長一短。',
      '第三樂章「休止」：影子獨自站起，她蜷縮在它的胸口，隔著一道五線譜，像一顆心臟。心跳環成對而來；終曲「最後的休止」會吞掉所有聲音，以一記雙手合拍收尾——之後它會累倒在地，那是整場戰鬥最長的反擊時機。',
      '弱點：每一次完美閃避都是一句回答。她的顏色會一點一點回來；湊滿十四個音，她會想起旋律的下一個音。',
      '寧舒的燈芯灰：「她從來沒有呼吸過。整整一輩子。……我算不出一個人可以不呼吸多久。我只知道，她已經憋得太久了。」',
    ],
  });

  /* ================================ sound: music-box tines, breath, reversed bells ================================ */
  const AK = () => G.AudioKit;
  const SND = {
    // a music-box tine: a bright struck comb tooth, the tick of its pin, a long glassy tail
    c8_tine(t, m = 86, k = 1) {
      const A = AK(), f = A.mtof(m);
      A.bell(f, t, 0.06 * k, 1.7, 0.55, 1.3);
      A.tone('sine', f * 3.01, t, 0.001, 0.012 * k, 0.35, { wet: 0.5 });
      A.noise(t, 0.0005, 0.035 * k, 0.012, 'highpass', 7000, null, 0.7, 0.1);
    },
    c8_wind(t, n = 7) { const A = AK(); for (let i = 0; i < n; i++) A.noise(t + i * 0.05, 0.0006, 0.05, 0.016, 'bandpass', 3000 + (i % 2) * 1100, null, 6, 0.04); },
    c8_breathIn(t, k = 1) { const A = AK(); A.noise(t, 0.5, 0.07 * k, 0.12, 'bandpass', 700, 2600, 0.8, 0.3); },
    c8_breathOut(t, k = 1) { const A = AK(); A.noise(t, 0.05, 0.08 * k, 1.1, 'bandpass', 2400, 500, 0.8, 0.4); },
    // a bell played backwards: a slow swell that is cut off — the sound of a breath being held
    c8_rev(t, m = 62, k = 1, len = 1.0) {
      const A = AK(), f = A.mtof(m);
      [1, 2.0, 2.76, 4.07].forEach((r, i) => A.tone('sine', f * r, t, len, 0.05 * k / (1 + i * 0.9), 0.05, { wet: 0.75 }));
      A.noise(t, len * 0.9, 0.025 * k, 0.04, 'bandpass', Math.min(9000, f * 4), null, 2, 0.6);
    },
    c8_shh(t) { const A = AK(); A.noise(t, 0.06, 0.15, 1.05, 'highpass', 3600, 5600, 0.7, 0.45); A.noise(t + 0.03, 0.08, 0.05, 0.8, 'bandpass', 2200, 1600, 1.4, 0.5); },
    c8_ring(t, dark = false) {
      const A = AK(), r = dark ? 62 : 74;
      [r, r + 7, r + 12].forEach((m, i) => A.bell(A.mtof(m + 12), t + i * 0.03, 0.03, 1.6, 0.7, dark ? 0.4 : 0.8));
      A.tone('sine', dark ? 220 : 440, t, 0.02, 0.05, 0.7, { to: dark ? 160 : 660, wet: 0.5 });
    },
    c8_sweep(t) { const A = AK(); A.noise(t, 0.1, 0.32, 0.5, 'lowpass', 260, 1500, 0.8, 0.25); A.tone('sine', 72, t + 0.08, 0.02, 0.36, 0.45, { to: 38, wet: 0.15 }); },
    c8_slap(t, k = 1) { const A = AK(); A.tone('sine', 90, t, 0.002, 0.55 * k, 0.3, { to: 40, wet: 0.2 }); A.noise(t, 0.001, 0.35 * k, 0.2, 'lowpass', 1400, 200, 0.7, 0.25); A.bell(A.mtof(38), t, 0.04 * k, 1.4, 0.6, 0.3); },
    c8_rise(t) { const A = AK(); A.noise(t, 0.35, 0.1, 0.2, 'bandpass', 220, 900, 0.9, 0.3); A.tone('sine', 60, t, 0.3, 0.12, 0.3, { to: 110, wet: 0.2 }); },
    c8_restWarn(t) { const A = AK(); A.tone('sine', 1600, t, 0.03, 0.016, 0.65, { to: 640, wet: 0.5 }); },
    c8_restLand(t, k = 1) { const A = AK(); A.tone('sine', 140, t, 0.002, 0.42 * k, 0.26, { to: 52, wet: 0.15 }); A.noise(t, 0.001, 0.22 * k, 0.12, 'bandpass', 800, 260, 2.2, 0.15); A.tone('triangle', A.mtof(45), t, 0.002, 0.035 * k, 0.1, { wet: 0.3 }); },
    c8_heart(t, k = 1) { const A = AK(); A.tone('sine', 64, t, 0.004, 0.4 * k, 0.2, { to: 38, wet: 0.12 }); A.tone('sine', 58, t + 0.22, 0.004, 0.3 * k, 0.24, { to: 34, wet: 0.12 }); },
    c8_answer(t, m = 86) { const A = AK(); A.bell(A.mtof(m), t, 0.035, 2.0, 0.7, 1.2); A.tone('sine', A.mtof(m + 12), t, 0.002, 0.01, 1.2, { wet: 0.6 }); },
    // the phrase completes: a Picardy third — D major, rising on music-box tines, a child's choir underneath
    c8_complete(t) {
      const A = AK();
      [62, 66, 69, 74, 78, 81, 86].forEach((m, i) => A.bell(A.mtof(m + 12), t + i * 0.085, 0.045, 2.8, 0.7, 1.0));
      if (A.sfxBus) [66, 69, 74].forEach((m, i) => A.choirVoice(A.mtof(m + 12), t + 0.25 + i * 0.05, 2.6, 0.028, A.sfxBus));
    },
    c8_hum(t, m = 74) { const A = AK(); if (A.sfxBus) A.choirVoice(A.mtof(m), t, 0.8, 0.022, A.sfxBus); A.tone('sine', A.mtof(m), t, 0.12, 0.012, 0.7, { wet: 0.5 }); },
    c8_gasp(t) { const A = AK(); A.noise(t, 0.04, 0.12, 0.35, 'bandpass', 1600, 3200, 1.2, 0.3); SND.c8_rev(t, 57, 1.2, 0.8); },
    c8_trans(t, ph = 2) {
      const A = AK();
      if (ph === 2) { [62, 69, 74, 77].forEach((m, i) => SND.c8_rev(t + i * 0.05, m, 0.9, 1.1)); if (A.sfxBus) [74, 77, 81].forEach((m, i) => A.choirVoice(A.mtof(m), t + 1.1 + i * 0.06, 1.8, 0.03, A.sfxBus)); }
      else { SND.c8_rev(t, 38, 1.6, 1.4); SND.c8_rev(t, 50, 1.2, 1.4); A.tone('sine', 46, t + 1.4, 0.01, 0.5, 1.6, { to: 30, wet: 0.3 }); SND.c8_heart(t + 1.6, 1.2); }
    },
    // the shadow breaks into light: the held chord lets go — D minor → D major, a long breath out
    c8_death(t) {
      const A = AK();
      [50, 57, 62, 65].forEach((m, i) => SND.c8_rev(t + i * 0.04, m, 1.0, 0.9));
      [62, 66, 69, 74, 78, 81, 86, 90].forEach((m, i) => A.bell(A.mtof(m + 12), t + 0.95 + i * 0.07, 0.05, 3.2, 0.75, 1.0));
      if (A.sfxBus) [62, 66, 69, 74].forEach((m, i) => A.choirVoice(A.mtof(m + 12), t + 1.0 + i * 0.08, 3.0, 0.03, A.sfxBus));
      SND.c8_breathOut(t + 1.2, 1.3);
    },
    c8_wake(t) { const A = AK(); [74, 78, 81, 86].forEach((m, i) => A.bell(A.mtof(m + 12), t + i * 0.12, 0.05, 2.4, 0.7, 1.1)); if (A.sfxBus) A.choirVoice(A.mtof(78), t + 0.3, 2.0, 0.03, A.sfxBus); },
    c8_fade(t) { const A = AK(); [81, 78, 74, 69].forEach((m, i) => A.bell(A.mtof(m + 12), t + i * 0.22, 0.04, 2.6, 0.8, 0.6)); SND.c8_breathOut(t + 0.4, 0.8); },
    c8_sleep(t) { const A = AK(); [74, 69, 66, 62].forEach((m, i) => A.bell(A.mtof(m + 12), t + i * 0.3, 0.035, 2.6, 0.8, 0.5)); SND.c8_breathOut(t, 0.6); },
  };
  for (const k in SND) G.SFX[k] = SND[k];
  // the silence: duck the music and the effects for a moment (scheduled on the audio clock, so it always comes back)
  const DUCK = { base: null, until: 0 };
  function duck(dur) {
    try {
      const A = G.AudioKit, ac = A && A.ctx; if (!ac || !A.musicBus || !A.sfxBus) return;
      const now = ac.currentTime;
      if (now > DUCK.until || !DUCK.base) DUCK.base = { m: A.musicBus.gain.value, s: A.sfxBus.gain.value };
      const B = DUCK.base;
      for (const [bus, base, low] of [[A.musicBus, B.m, 0.08], [A.sfxBus, B.s, 0.34]]) {
        const g = bus.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(base * low, now + 0.3); g.setValueAtTime(base * low, now + dur); g.linearRampToValueAtTime(base, now + dur + 0.8);
      }
      DUCK.until = now + dur + 0.8;
    } catch (err) { /* no audio */ }
  }
  function unduck(r = 0.4) {
    try {
      const A = G.AudioKit, ac = A && A.ctx; if (!ac || !DUCK.base || ac.currentTime > DUCK.until) return;
      const now = ac.currentTime, B = DUCK.base;
      for (const [bus, base] of [[A.musicBus, B.m], [A.sfxBus, B.s]]) { const g = bus.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(base, now + r); }
      DUCK.until = now + r;
    } catch (err) { /* no audio */ }
  }

  /* ================================ glow sprites + the night-sky texture ================================ */
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
  function shade(ctx, x, y, rx, ry, col, a) {
    if (!(a > 0.01)) return;
    ctx.save(); ctx.globalAlpha *= Math.min(1, a); ctx.drawImage(sprite(col, true), x - rx, y - ry, rx * 2, ry * 2); ctx.restore();
  }
  // the shadow is filled with a night sky: indigo nebulae and stars (one 256² tile, built once, repeated)
  let SKY = null; const PATS = new WeakMap();
  function skyTex() {
    if (SKY) return SKY;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), rng = U.mulberry32(80808);
    g.fillStyle = '#140b2c'; g.fillRect(0, 0, 256, 256);
    const blob = (x, y, r, col, a) => {
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, U.rgba(col, a)); gr.addColorStop(1, U.rgba(col, 0));
        g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    };
    for (let i = 0; i < 10; i++) blob(rng() * 256, rng() * 256, 36 + rng() * 70, ['#2f1d66', '#40205e', '#1c2a63', '#2a1450'][i % 4], 0.6);
    for (let i = 0; i < 4; i++) blob(rng() * 256, rng() * 256, 16 + rng() * 22, '#6b4bb0', 0.28);
    for (let i = 0; i < 120; i++) {
      const x = rng() * 256, y = rng() * 256, s = rng();
      g.globalAlpha = 0.35 + 0.65 * rng(); g.fillStyle = s > 0.93 ? '#ffffff' : s > 0.6 ? '#d8ccff' : '#8a7bc6';
      g.beginPath(); g.arc(x, y, s > 0.93 ? 1.15 : 0.62, 0, TAU); g.fill();
    }
    g.globalAlpha = 1; g.strokeStyle = 'rgba(240,232,255,0.8)'; g.lineWidth = 0.6;
    for (let i = 0; i < 6; i++) { const x = rng() * 256, y = rng() * 256, l = 3 + rng() * 3; g.beginPath(); g.moveTo(x - l, y); g.lineTo(x + l, y); g.moveTo(x, y - l); g.lineTo(x, y + l); g.stroke(); }
    return (SKY = c);
  }
  function skyPat(ctx) { let p = PATS.get(ctx); if (!p) { p = ctx.createPattern(skyTex(), 'repeat'); PATS.set(ctx, p); } return p || '#140b2c'; }

  /* ================================ painting helpers ================================ */
  function ink(ctx, w = 1.4) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  function smoothTo(P, pts) {   // closed quadratic-midpoint curve through pts into a ctx or a Path2D
    const n = pts.length, a0 = pts[n - 1], b0 = pts[0];
    P.moveTo((a0.x + b0.x) / 2, (a0.y + b0.y) / 2);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; P.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    P.closePath();
  }
  function smoothPath(ctx, pts) { ctx.beginPath(); smoothTo(ctx, pts); }
  function capsule(P, a, b, r0, r1) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 0.001, nx = -dy / L, ny = dx / L, an = Math.atan2(dy, dx);
    P.moveTo(a.x + nx * r0, a.y + ny * r0); P.lineTo(b.x + nx * r1, b.y + ny * r1);
    P.arc(b.x, b.y, r1, an + PI / 2, an - PI / 2, true); P.lineTo(a.x - nx * r0, a.y - ny * r0);
    P.arc(a.x, a.y, r0, an - PI / 2, an + PI / 2, true); P.closePath();
  }
  function curvePts(a, m, b, n) {     // quadratic through m (at t = 0.5) from a to b
    const c = { x: 2 * m.x - (a.x + b.x) / 2, y: 2 * m.y - (a.y + b.y) / 2 }, out = [];
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }); }
    return out;
  }
  function offsetPts(pts, k) {
    return pts.map((q, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const kk = typeof k === 'function' ? k(i / (pts.length - 1)) : k;
      return { x: q.x - dy / d * kk, y: q.y + dx / d * kk };
    });
  }
  // a small inked eighth note ♪ (x, y = note head), s = scale
  function noteGlyph(ctx, x, y, s, col, a, rot0 = -0.15) {
    if (a <= 0.02) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot0); ctx.scale(s, s); ctx.globalAlpha *= a;
    ctx.beginPath(); ctx.ellipse(0, 0, 3.6, 2.6, -0.45, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3.1, -0.9); ctx.lineTo(3.1, -12); ctx.quadraticCurveTo(4.6, -8.6, 8, -7.4);
    ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.restore();
  }
  // many small notes at once: all heads in one fill, all stems/flags in two strokes (cheap enough for rings and halos)
  function notesBatch(ctx, list, s, col, a) {
    if (!list.length || a <= 0.02) return;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.beginPath();
    for (const [x, y, r] of list) { const c = Math.cos(r), sn = Math.sin(r); ctx.moveTo(x + 3.6 * s * c, y + 3.6 * s * sn); ctx.ellipse(x, y, 3.6 * s, 2.6 * s, r - 0.45, 0, TAU); }
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.beginPath();
    for (const [x, y, r] of list) {
      const P = (u, v) => { const q = rot(u * s, v * s, r); return [x + q.x, y + q.y]; };
      const p0 = P(3.1, -0.9), p1 = P(3.1, -12), c = P(4.6, -8.6), p2 = P(8, -7.4);
      ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.quadraticCurveTo(c[0], c[1], p2[0], p2[1]);
    }
    ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 2.8 * s; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 1.2 * s; ctx.stroke();
    ctx.restore();
  }
  // a quarter rest 𝄽 as calligraphic strokes in a frame ~ 40 × 110 (origin = its foot), s = scale
  const QREST = [[[-7, -108], [9, -86], 6], [[9, -86], [-6, -62], 13], [[-6, -62], [9, -40], 6]];
  function restGlyph(ctx, x, y, s, ang, fill, edge, a) {
    if (a <= 0.02) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s); ctx.globalAlpha *= a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pass = (col, extra) => {
      ctx.strokeStyle = col;
      for (const [p0, p1, w] of QREST) { ctx.lineWidth = w + extra; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); }
      ctx.lineWidth = 7 + extra; ctx.beginPath(); ctx.moveTo(9, -40); ctx.quadraticCurveTo(-14, -34, -5, -15); ctx.quadraticCurveTo(-1, -6, 6, -3); ctx.stroke();
    };
    pass(INK, 5); pass(fill, 0);
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-6, -105); ctx.lineTo(7, -87); ctx.moveTo(6, -84); ctx.lineTo(-6, -66); ctx.stroke(); }
    ctx.restore();
  }

  /* ================================ Mira's palette: her colour comes back as you answer ================================ */
  const PALE = { skin: '#eeeaff', skinS: '#aea4e2', hair: '#d6cff4', hairS: '#9488cf', hairL: '#ffffff', dress: '#e1dbfa', dressS: '#a196d8', dressL: '#ffffff', collar: '#ffffff', tights: '#f3f0ff', shoe: '#bdb3ea', iris: '#c9bcff', blush: '#ffc4dc', aura: '#e6deff' };
  const WARM = { skin: '#f7d2b6', skinS: '#cf8f86', hair: '#8f5536', hairS: '#4f2a2c', hairL: '#e8ae80', dress: '#79a3dc', dressS: '#41579a', dressL: '#d6e8ff', collar: '#fff7ea', tights: '#f4ede6', shoe: '#6e3a2b', iris: '#f0a83c', blush: '#ff8f9c', aura: '#ffd9a0' };
  const PALC = {};
  function palOf(w) {
    const wq = Math.round(clamp01(w) * 14) / 14, key = wq.toFixed(3);
    let p = PALC[key]; if (!p) { p = {}; for (const k in PALE) p[k] = U.mixHex(PALE[k], WARM[k], wq); PALC[key] = p; }
    return p;
  }

  /* ================================ pose ================================ */
  // Mira (local frame: facing +x, floor y = 0): hov = toes above the floor · bx · lean · head · fx/fy & bkx/bky = wrist targets
  // from the near / far shoulder · ft = near-hand shape (0 relaxed, 1 finger up "shh", 2 open palm) · tF/kF/tB/kB legs ·
  // lid / boxA / crank (music box) · eyes 0 shut … 1 open · puff (held breath) · sm (smile) · glow
  // The shadow (world units from its base on the floor): so = base offset along her facing · ss scale · sl/sh extra lean/head ·
  // sv visibility · sE eyes · rise · cr crouch (colossus) · wf + hfx/hfy, wb + hbx/hby = hand overrides (palm centres) · of/ob flat palms
  const POSE0 = {
    hov: 26, bx: 0, lean: 0.05, head: 0.12, fx: 14.5, fy: 8.5, bkx: 15, bky: 13, ft: 0,
    tF: 0.3, kF: 0.85, tB: -0.02, kB: 0.66, lid: 0.55, boxA: 0, crank: 0.3, eyes: 0, puff: 0.6, sm: 0, glow: 0,
    so: -70, ss: 1, sl: 0, sh: 0, sv: 1, sE: 0, rise: 1, cr: 0, kn: 0,
    wf: 0, hfx: 0, hfy: 0, of: 0, wb: 0, hbx: 0, hby: 0, ob: 0,
  };
  const PK = Object.keys(POSE0);
  const full = (q, base = POSE0) => { const o = {}; for (const k of PK) o[k] = q[k] ?? base[k]; return o; };
  const lerpPose = (a, b, t) => { const o = {}; for (const k of PK) o[k] = a[k] + (b[k] - a[k]) * t; return o; };
  const EASE = { lin: (t) => t, io: U.easeInOutSine, out: U.easeOutCubic, in: U.easeInCubic, snap: (t) => 1 - Math.pow(1 - t, 4) };
  function keys(list, base = POSE0) {
    let prev = base;
    return list.map(([t, q, ez]) => { const p = full(Object.assign({}, prev, q)); prev = p; return [t, p, ez || 'io']; });
  }
  function sample(ks, t) {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) { const a = ks[i - 1], b = ks[i]; return lerpPose(a[1], b[1], EASE[b[2]]((t - a[0]) / (b[0] - a[0] || 1))); }
    }
    return ks[ks.length - 1][1];
  }
  const DIRECT = ['wf', 'hfx', 'hfy', 'of', 'wb', 'hbx', 'hby', 'ob', 'so', 'ss', 'cr', 'kn'];
  const BOX_FACE = { bkx: 13, bky: -1.5 }, BOX_HUG = { bkx: 9, bky: 9.5, fx: 8.5, fy: 6.5, crank: 0 }, BOX_HIGH = { bkx: 4, bky: -25, fx: 7, fy: -23, crank: 0 }, BOX_LOW = { bkx: 12, bky: 17 };
  const CURL = { hov: 224, bx: 0, lean: 0.62, head: 0.55, fx: 9, fy: 8, bkx: 8.5, bky: 10.5, crank: 0, ft: 0, tF: 1.95, kF: 2.6, tB: 1.75, kB: 2.45, lid: 0.15, eyes: 0, puff: 0.25, sm: 0 };
  const P2B = full({ so: -150, sE: 1, eyes: 1, puff: 0, hov: 32, sm: 0.12, lean: 0.03, head: 0.06 });
  const P3B = full({ ...CURL, so: 0, sE: 1, ss: 1.45, kn: 1, sl: -0.16, sh: -0.28 });
  const IDLE1 = (t) => {
    const br = Math.sin(t * 1.7);
    return full({
      hov: 26 + br * 4, lean: 0.05 + br * 0.015, head: 0.12 + Math.sin(t * 0.8) * 0.04, bky: 13 + br * 0.6,
      tF: 0.3 + Math.sin(t * 1.3) * 0.08, kF: 0.85 + Math.sin(t * 1.3 + 0.6) * 0.12, tB: -0.02 + Math.sin(t * 1.1 + 1) * 0.07, kB: 0.66 + Math.sin(t * 1.1 + 1.5) * 0.1,
      puff: 0.55 + 0.2 * Math.sin(t * 2.3), lid: 0.5 + 0.05 * Math.sin(t * 3), sl: Math.sin(t * 0.6) * 0.02,
    });
  };
  const IDLE2 = (t) => {
    const br = Math.sin(t * 1.7);
    return full({
      hov: 32 + br * 4, lean: 0.03 + br * 0.015, head: 0.04 + Math.sin(t * 0.8) * 0.05, bky: 13 + br * 0.6,
      tF: 0.3 + Math.sin(t * 1.3) * 0.08, kF: 0.85 + Math.sin(t * 1.3 + 0.6) * 0.12, tB: -0.02 + Math.sin(t * 1.1 + 1) * 0.07, kB: 0.66 + Math.sin(t * 1.1 + 1.5) * 0.1,
      lid: 0.7, crank: 0.45, sl: Math.sin(t * 0.6) * 0.03,
    }, P2B);
  };
  const IDLE3 = (t) => full({ head: 0.55 + Math.sin(t * 0.9) * 0.04, cr: Math.sin(t * 1.1) * 0.03, sl: -0.16 + Math.sin(t * 0.7) * 0.025 }, P3B);
  const HURT = (ph) => ph >= 3 ? full({ cr: 0.12, sE: 0.6, head: 0.7 }, P3B) : full({ ...BOX_HUG, lean: -0.2, head: 0.38, hov: 34, puff: 1, eyes: 0, sl: -0.06, so: ph === 2 ? -150 : -70, sE: ph === 2 ? 0.6 : 0 }, ph === 2 ? P2B : POSE0);
  const BROKEN1 = (t, ph) => full({
    hov: 8 + Math.sin(t * 2) * 2, lean: 0.42, head: 0.72 + Math.sin(t * 1.6) * 0.05, fx: 9, fy: 16, bkx: 8, bky: 18, crank: 0, lid: 1,
    tF: 0.95, kF: 1.7, tB: 0.62, kB: 1.45, puff: 0, eyes: 0, sv: 0.55, sl: 0.22, sh: 0.45, so: ph === 2 ? -150 : -70, sE: 0.2,
  }, ph === 2 ? P2B : POSE0);
  const BROKEN3 = (t) => full({ cr: 0.85 + Math.sin(t * 2) * 0.03, sE: 0.25, head: 0.75 }, P3B);
  // after the defeat
  const KNEEL = full({ hov: -26, bx: 0, lean: 0.12, head: 0.42, fx: 10, fy: 19, bkx: 12, bky: 20, crank: 0, ft: 0, tF: 1.04, kF: 2.56, tB: 0.95, kB: 2.5, lid: 0.45, eyes: 0, puff: 0, sm: 0, so: 0 });
  const STAND = full({ hov: 1, lean: -0.02, head: -0.12, fx: 12, fy: 2, bkx: 13, bky: 3, crank: 0.25, tF: 0.08, kF: 0.12, tB: -0.08, kB: 0.14, lid: 1, eyes: 1, puff: 0, sm: 1, so: 0 });
  const SLEEP = full({ hov: -24, lean: 0.08, head: 0.22, fx: 9, fy: 5, bkx: 9.5, bky: 7, crank: 0, tF: 0.42, kF: 0.55, tB: 0.3, kB: 0.4, lid: 0.25, eyes: 0, puff: 0, sm: 0.3, so: 0 });

  /* ================================ geometry ================================ */
  // two-bone IK; a stretched (shadow) arm arcs its elbow upward instead of locking straight
  function ik(S, T, a, b, bend, stretch) {
    const dx = T.x - S.x, dy = T.y - S.y, d = Math.max(0.001, Math.hypot(dx, dy)), ux = dx / d, uy = dy / d;
    if (d >= a + b - 0.01) {
      if (!stretch) { const L = a + b - 0.01; return { el: { x: S.x + ux * a, y: S.y + uy * a }, hd: { x: S.x + ux * L, y: S.y + uy * L }, k: 1 }; }
      const k = d / (a + b);
      let px = -uy, py = ux; if (py > 0) { px = -px; py = -py; }
      const lift = Math.min(0.2, (k - 1) * 0.08) * d, fa = a / (a + b);
      return { el: { x: S.x + ux * d * fa + px * lift, y: S.y + uy * d * fa + py * lift }, hd: { x: T.x, y: T.y }, k };
    }
    const dd = Math.max(Math.abs(a - b) + 0.01, d);
    const ca = U.clamp((a * a + dd * dd - b * b) / (2 * a * dd), -1, 1), sa = Math.sqrt(1 - ca * ca) * bend;
    return { el: { x: S.x + a * (ux * ca - uy * sa), y: S.y + a * (uy * ca + ux * sa) }, hd: { x: S.x + ux * dd, y: S.y + uy * dd }, k: 1 };
  }
  // Mira, ~100 tall; the near hand rides the music-box crank while p.crank > 0
  function geoM(p, ca) {
    const hip = { x: p.bx, y: -(p.hov + 38) };
    const T = (x, y) => { const q = rot(x, y, p.lean); return { x: hip.x + q.x, y: hip.y + q.y }; };
    const chest = T(0.5, -19), neck = T(0.8, -27), shF = T(2.2, -24), shB = T(-2.4, -23.5);
    const ha = p.lean + p.head, hq = rot(1.4, -10.6, ha), hc = { x: neck.x + hq.x, y: neck.y + hq.y };
    const ab = ik(shB, { x: shB.x + p.bkx, y: shB.y + p.bky }, 14, 13, 1, false);
    const ba = p.boxA + p.lean * 0.4, bq = rot(4.5, -5.5, ba), box = { x: ab.hd.x + bq.x, y: ab.hd.y + bq.y };
    const knob = add(box, rot(Math.cos(ca) * 4.4, 0.6 + Math.sin(ca) * 4.4, ba));
    const cw = clamp01(p.crank * 3) * (p.ft ? 0 : 1);
    let tf = { x: shF.x + p.fx, y: shF.y + p.fy };
    if (cw > 0) tf = lerpP(tf, knob, cw);
    const af = ik(shF, tf, 14, 13, 1, false);
    const hjF = T(1.6, 1.5), hjB = T(-2.2, 1);
    const knF = add(hjF, dirv(p.tF, 16.5)), anF = add(knF, dirv(p.tF - p.kF, 16));
    const knB = add(hjB, dirv(p.tB, 16.5)), anB = add(knB, dirv(p.tB - p.kB, 16));
    const lips = add(hc, rot(9.6, 4.6, ha));
    return { hip, T, chest, neck, shF, shB, hc, ha, elF: af.el, hdF: af.hd, elB: ab.el, hdB: ab.hd, hjF, knF, anF, hjB, knB, anB, box, ba, knob, lips, lean: p.lean };
  }
  // the profile shadow (P1/P2): her own silhouette ×4.6 — bob, puff sleeves, smock, scarf — looming over her, its legs
  // melting into ink; hm = Mira 0.13 s ago (the mirror)
  function geoS(p, hm) {
    const s = SS * p.ss, r = p.rise;
    const cr = U.clamp(p.cr, -0.3, 1), kn = clamp01(p.kn);
    const lean = (hm ? hm.lean : p.lean) * 0.8 + p.sl + 0.1 + 0.42 * Math.max(0, cr), ha = lean + (hm ? hm.head : p.head) * 0.8 + p.sh - 0.06 + 0.25 * Math.max(0, cr);
    const hip = { x: -26 * kn * p.ss, y: -SHIP * p.ss * r * (1 - 0.6 * kn) * (1 - 0.3 * cr) };
    const T = (x, y) => { const q = rot(x * s, y * s, lean); return { x: hip.x + q.x, y: hip.y + q.y }; };
    const neck = T(0.8, -27), shF = T(2.2, -24), shB = T(-2.4, -23.5), chest = T(0.5, -19);
    const hq = rot(1.4 * s, -10.6 * s, ha), hc = { x: neck.x + hq.x, y: neck.y + hq.y };
    const arm = (sh, v, ov, w, of, hsA) => {
      const hs = U.lerp(7.5, hsA, w);
      const mw = { x: sh.x + v.x * s, y: sh.y + v.y * s }, d0 = Math.atan2(mw.y - sh.y, mw.x - sh.x);
      const mc = { x: mw.x + Math.cos(d0) * hs * HC, y: mw.y + Math.sin(d0) * hs * HC };
      const tc = w > 0 ? lerpP(mc, ov, w) : mc;
      const ang = lerpAng(Math.atan2(tc.y - sh.y, tc.x - sh.x), 0, of);
      const wr = { x: tc.x - Math.cos(ang) * hs * HC, y: tc.y - Math.sin(ang) * hs * HC };
      const k = ik(sh, wr, 14 * s, 13 * s, 1, true);
      return { sh, el: k.el, wr: k.hd, k: k.k, ang, hs, c: tc, w };
    };
    const vf = hm ? hm.vf : { x: p.fx, y: p.fy }, vb = hm ? hm.vb : { x: p.bkx, y: p.bky };
    const aF = arm(shF, vf, { x: p.hfx, y: p.hfy }, p.wf, p.of, 26), aB = arm(shB, vb, { x: p.hbx, y: p.hby }, p.wb, p.ob, 26);
    aF.pt = p.wf < 0.5 && Math.round(hm ? hm.ft : p.ft) === 1;
    // legs: her dangling legs, ×4.6 — below the knee they turn to ink and pour into the pool
    const lg = hm ? hm.legs : [p.tF, p.kF, p.tB, p.kB];
    const leg = (hj, t0, k0) => { const kn = add(hj, dirv(t0, 16.5 * s)), an = add(kn, dirv(t0 - k0, 16 * s)); return { hj, kn, an }; };
    const lF = leg(T(1.6, 1.5), lg[0], lg[1]), lB = leg(T(-2.2, 1), lg[2], lg[3]);
    return { s, r, kn, hip, T, neck, chest, shF, shB, hc, ha, lean, aF, aB, lF, lB, heart: T(2.2, -15.5) };
  }
  const hipOff = (p) => ({ x: p.bx, y: -(p.hov + 38) });

  /* ================================ hazards ================================ */
  // late hazards are painted by the boss after its own body (so they read over the shadow); without her, by the engine
  function lateDraw(ctx, h) { const o = h.owner; if (o && !o.dead && G.game.enemies.indexOf(o) >= 0 && o.lateOK) return; h.paint(ctx, h); }
  function homeOf(o) { return o.phase >= 3 ? (o.heartW || { x: o.x, y: o.y - 262 }) : (o.boxPos || { x: o.x, y: o.y - 90 }); }
  function pop(h, col = '#ffffff') { G.FX.shards(h.x, h.y, 5, col, 260); G.FX.spark(h.x, h.y, 6, { col: '#fff4dc', speed: 360 }); }

  // ---------- a music-box note (white; a perfect guard sends it home into the box) ----------
  function fireNote(e, from, o = {}) {
    const P = G.game.player, tx = P.x + P.vx * 0.15, ty = P.y - 64, T = o.T || 0.8;
    let vx, vy, g = 0;
    if (o.lob) { g = 900; vx = (tx - from.x) / T; vy = (ty - from.y - 0.5 * g * T * T) / T; }
    else { vx = (tx - from.x) / T; vy = (ty - from.y) / T; const sp = Math.hypot(vx, vy) || 1, k = U.clamp(sp, 300, 780) / sp; vx *= k; vy *= k; }
    const h = { kind: 'c8_note', owner: e, x: from.x, y: from.y, vx, vy, g, dark: !!o.dark, m: o.m || 86, t: 0, life: 4, refl: false, passed: false, spin: (Math.random() - 0.5) * 0.5, trail: [], late: true, update: noteUpd, draw: lateDraw, paint: notePaint };
    G.game.hazards.push(h);
    G.FX.ring(from.x, from.y, 4, 38, 0.25, o.dark ? LILAC : '#ffffff', 2.5);
    if (!silenced()) sfx('c8_tine', o.dark ? h.m - 12 : h.m, o.dark ? 0.8 : 1);
    if (!e.noteHinted) { e.noteHinted = true; G.game.hint('c8_bossChime'); }
    return h;
  }
  function noteUpd(h, dt, g) {
    if (!h.refl) h.vy += h.g * dt;
    h.x += h.vx * dt; h.y += h.vy * dt;
    h.trail.push({ x: h.x, y: h.y }); if (h.trail.length > 9) h.trail.shift();
    if (h.y >= floorAt(h.x, h.y) - 3) { pop(h, h.dark ? LILAC : '#ffffff'); h.done = true; return; }
    const ar = G.game.arena; if (ar && (h.x < ar.x0 - 80 || h.x > ar.x1 + 80)) { h.done = true; return; }
    const P = g.player, o = h.owner;
    if (!h.refl) {
      if (h.passed) return;
      const hb = P.hurtbox, r = 11;
      if (h.x + r > hb.x && h.x - r < hb.x + hb.w && h.y + r > hb.y && h.y - r < hb.y + hb.h) {
        const res = P.receiveHit(h, { dmg: h.dark ? 17 : 15, kb: 200, projectile: true, hx: h.x, hy: h.y });
        if (res === 'parried' && o && !o.dead) {
          const c = homeOf(o), a = Math.atan2(c.y - h.y, c.x - h.x);
          h.refl = true; h.vx = Math.cos(a) * 980; h.vy = Math.sin(a) * 980; h.life = h.t + 2;
          G.FX.ring(h.x, h.y, 6, 72, 0.3, GOLDL, 4);
        } else if (res === 'dodged' || res === 'ignored') h.passed = true;
        else { h.done = true; pop(h); }
      }
    } else if (o && !o.dead) {
      const c = homeOf(o), a = Math.atan2(c.y - h.y, c.x - h.x), sp = Math.hypot(h.vx, h.vy);
      h.vx = Math.cos(a) * sp; h.vy = Math.sin(a) * sp;
      if (Math.hypot(c.x - h.x, c.y - h.y) < 26) {
        h.done = true;
        const ok = o.takeHit({ dmg: 24 * (P.dmgMul || 1), bal: 62, hx: c.x, hy: c.y, big: true });
        if (ok) { G.FX.flash(c.x, c.y, 120, 0.3, GOLDL); G.FX.ring(c.x, c.y, 8, 110, 0.4, GOLD, 4); g.hitstop(0.05); g.shake(0.3); sfx('c8_tine', h.m + 12, 1.1); }
      }
    } else h.done = true;
  }
  function notePaint(ctx, h) {
    const col = h.refl ? GOLD : h.dark ? '#c9b8ff' : '#fff7e2';
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (h.trail.length > 1) {
      ctx.strokeStyle = U.rgba(col, 0.32); ctx.lineWidth = 8; ctx.beginPath(); h.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
      ctx.strokeStyle = U.rgba('#ffffff', 0.5); ctx.lineWidth = 2; ctx.stroke();
    }
    glow(ctx, h.x, h.y, 34, h.refl ? GOLD : h.dark ? '#b9a2ff' : '#fff1d8', 0.9);
    for (let i = 0; i < 2; i++) { const k = (h.t * 2.6 + i * 0.5) % 1; ctx.strokeStyle = U.rgba(h.dark && !h.refl ? '#ffffff' : col, 0.6 * (1 - k)); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(h.x, h.y, 10 + k * 22, 0, TAU); ctx.stroke(); }
    ctx.restore();
    const wob = h.spin + Math.sin(h.t * 9) * 0.18;
    if (h.dark && !h.refl) {   // an ink note in a white halo (still white: guard it)
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; noteGlyph(ctx, h.x - 2, h.y + 4, 1.75, '#ffffff', 0.9, wob); ctx.restore();
      noteGlyph(ctx, h.x - 2, h.y + 4, 1.45, '#1c1238', 1, wob);
    } else noteGlyph(ctx, h.x - 2, h.y + 4, 1.45, h.refl ? GOLDL : '#fffaf0', 1, wob);
  }

  // ---------- lullaby ring (white: guard it; a perfect guard costs her balance) ----------
  function makeRing(e, x, y, o = {}) {
    const h = { kind: 'c8_ring', owner: e, x, y, r: o.r0 || 18, speed: o.speed || 360, dark: !!o.dark, t: 0, life: o.life || 2.6, hit: false, fy: floorAt(x, e.y), spin: Math.random() * TAU, late: true, update: ringUpd, draw: lateDraw, paint: ringPaint };
    G.game.hazards.push(h); if (!silenced()) sfx('c8_ring', h.dark);
    return h;
  }
  function ringUpd(h, dt, g) {
    h.r += h.speed * dt;
    const P = g.player; if (h.hit || P.state === 'dead') return;
    const px = P.x, py = P.y - 56, d = Math.hypot(px - h.x, py - h.y);
    if (Math.abs(d - h.r) < 22 && py < h.fy + 4) {
      h.hit = true;
      const res = P.receiveHit(h.owner, { dmg: h.dark ? 17 : 15, kb: 220, hx: px, hy: py, waveFrom: h.x });
      const o = h.owner;
      if (res === 'parried' && o && !o.dead) {
        o.bal = Math.min(o.maxBal, o.bal + 44); o.balT = 0; o.showBar = 3;
        G.FX.ring(px, py, 6, 70, 0.3, GOLDL, 4);
        if (o.bal >= o.maxBal && o.state !== 'broken' && !o.invuln) o.breakBalance();
      }
    }
  }
  function ringPaint(ctx, h) {
    const fade = Math.min(1, h.t * 8) * (1 - clamp01((h.t - h.life + 0.45) / 0.45)) * (h.r > 820 ? Math.max(0, 1 - (h.r - 820) / 200) : 1);
    if (fade <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(h.x - h.r - 40, h.y - h.r - 40, h.r * 2 + 80, Math.max(0, h.fy - (h.y - h.r - 40))); ctx.clip();
    if (h.dark) { ctx.strokeStyle = U.rgba('#1a0f36', 0.55 * fade); ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter';
    const col = h.dark ? '#c6b4ff' : '#fff1d0';
    ctx.strokeStyle = U.rgba(col, 0.2 * fade); ctx.lineWidth = 24; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) { ctx.strokeStyle = U.rgba(i === 0 ? '#ffffff' : col, (i === 0 ? 0.95 : 0.6) * fade); ctx.beginPath(); ctx.arc(h.x, h.y, Math.max(1, h.r + i * 3.8), 0, TAU); ctx.stroke(); }
    ctx.restore();
    // notes riding the stave
    const n = Math.min(LQ() ? 8 : 14, 5 + Math.floor(h.r / 55)), list = [];
    for (let i = 0; i < n; i++) {
      const a = h.spin + i / n * TAU + h.t * 0.5, nx = h.x + Math.cos(a) * h.r, ny = h.y + Math.sin(a) * h.r;
      if (ny < h.fy - 6) list.push([nx, ny, a + PI / 2]);
    }
    notesBatch(ctx, list, 1.05, h.dark ? '#2a1d55' : GOLD, fade);
  }

  // ---------- a falling rest sign (red mark first; the falling glyph itself is what hurts) ----------
  function makeRest(e, x, o = {}) {
    const ar = arenaOf(e); x = U.clamp(x, ar.x0 + 40, ar.x1 - 40);
    const h = { kind: 'c8_rest', owner: e, x, fy: floorAt(x, e.y), t: -(o.delay || 0), warn: o.warn || 0.9, fall: 0.16, wide: !!o.wide, hit: false, landed: false, top: viewTop(), tilt: (Math.random() - 0.5) * 0.12, late: true, update: restUpd, draw: lateDraw, paint: restPaint };
    h.life = h.warn + h.fall + 1.0;
    G.game.hazards.push(h);
    return h;
  }
  const restWH = (h) => (h.wide ? [150, 52] : [50, 124]);
  function restBottom(h) {   // where the glyph's foot is now
    const k = clamp01((h.t - h.warn) / h.fall);
    if (h.t < h.warn) return h.top + restWH(h)[1] * 0.4 + h.t * 30;
    return U.lerp(h.top + restWH(h)[1] * 0.4 + h.warn * 30, h.fy, k * k);
  }
  function restUpd(h, dt, g) {
    if (h.t < 0) return;
    if (!h.snd) { h.snd = true; if (!silenced()) sfx('c8_restWarn'); }
    const ti = h.warn + h.fall;
    if (h.t >= ti && !h.landed) {
      h.landed = true; g.shake(h.wide ? 0.34 : 0.24); sfx('c8_restLand', h.wide ? 1 : 0.8);
      const W = restWH(h)[0];
      G.FX.dust(h.x, h.fy, LQ() ? 6 : 12, { w: W * 0.6, speed: 230, size: 13, col: 'rgba(214,200,255,' });
      G.FX.ring(h.x, h.fy, 8, W * 0.9, 0.35, LILAC, 4, { flat: 0.2 });
    }
    if (!h.hit && h.t >= h.warn && h.t < ti + 0.08) {
      const [W, H] = restWH(h), yb = Math.min(h.fy, restBottom(h));
      if (U.rectsOverlap({ x: h.x - W / 2, y: yb - H, w: W, h: H }, g.player.hurtbox)) { h.hit = true; g.player.receiveHit(h.owner, { dmg: h.wide ? 26 : 24, unblockable: true, kb: 300, hx: h.x, hy: yb - 50 }); }
    }
  }
  function restPaint(ctx, h) {
    if (h.t < 0) return;
    const ti = h.warn + h.fall, x = h.x, y = h.fy, [W, H] = restWH(h), sil = silenced();
    if (h.t < ti + 0.06) {   // the red mark (brighter in the silence: there is no sound to warn you)
      const k = clamp01(h.t / h.warn), boost = sil ? 1.5 : 1;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const top = h.top - 80;
      ctx.fillStyle = U.rgba(CRIM, (0.05 + 0.11 * k) * boost); ctx.fillRect(x - W * 0.55, top, W * 1.1, y - top);
      ctx.strokeStyle = U.rgba(CRIM, Math.min(1, (0.5 + 0.5 * k) * boost)); ctx.lineWidth = sil ? 3.6 : 2.6;
      ctx.beginPath(); ctx.ellipse(x, y - 1, W * 0.6 + 18 * (1 - k), 8 - 2 * k, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = U.rgba('#ffd0dc', 0.4 + 0.5 * k); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(x, y - 1, W * 0.25 + 10 * (1 - k), 3 + 2 * (1 - k), 0, 0, TAU); ctx.stroke();
      glow(ctx, x, y - 4, W * 0.75, CRIM, (0.3 + 0.35 * k) * boost);
      ctx.restore();
    }
    let a = 1, yb = Math.min(y, restBottom(h)), shake = 0;
    if (h.t < h.warn) a = 0.35 + 0.4 * clamp01(h.t / h.warn);
    else if (h.t > ti) { const k = h.t - ti; if (k < 0.1) shake = Math.sin(k * 90) * 2; if (k > 0.55) a = 1 - clamp01((k - 0.55) / 0.4); if (k > 0.55 && Math.random() < 0.4 && vdt() > 0) G.FX.ember(x, y - H * 0.5, 1, LILAC, { w: W * 0.6, h: H * 0.8, up: 70 }); }
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a;
    if (h.t >= h.warn && h.t < ti) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba('#e7dcff', 0.35); ctx.fillRect(x - W * 0.35, yb - H - 170, W * 0.7, 170); ctx.restore(); }
    if (h.wide) {   // a half rest: a slab sitting on its line
      const xx = x + shake, w = W, hh = H * 0.62;
      ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(xx - w * 0.62, yb - 2); ctx.lineTo(xx + w * 0.62, yb - 2); ctx.stroke();
      ctx.strokeStyle = LILAC; ctx.lineWidth = 2.6; ctx.stroke();
      ctx.beginPath(); ctx.rect(xx - w / 2, yb - 2 - hh, w, hh); ctx.fillStyle = '#1a1033'; ctx.fill(); ink(ctx, 3);
      ctx.fillStyle = U.rgba('#3a2a6a', 0.9); ctx.fillRect(xx - w / 2 + 3, yb - 2 - hh + 3, w - 6, 5);
      ctx.strokeStyle = U.rgba(GOLDL, 0.85); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(xx - w / 2 + 4, yb - hh + 1); ctx.lineTo(xx + w / 2 - 4, yb - hh + 1); ctx.stroke();
    } else restGlyph(ctx, x + shake, yb + 2, 1.12, h.tilt, '#1a1033', U.rgba(GOLDL, 0.8), 1);
    ctx.restore();
  }
  function restVolley(e, n, o = {}) {
    const P = G.game.player, base = P.x + P.vx * 0.35;
    const offs = o.alt ? [-80, 90, U.rand(-380, -240), U.rand(240, 380)] : [0, -150, 150, U.rand(-430, -260), U.rand(260, 430)];
    for (let i = 0; i < n; i++) makeRest(e, base + offs[i % offs.length], { delay: i * (o.gap || 0.24), warn: o.warn || 0.9 });
  }
  function restLanes(e, odd, o = {}) {   // the finale: half rests fill every other lane of the arena
    const ar = arenaOf(e), n = 7, lw = (ar.x1 - ar.x0) / n;
    for (let i = odd ? 1 : 0; i < n; i += 2) makeRest(e, ar.x0 + lw * (i + 0.5), { wide: true, warn: o.warn || 1.0, delay: (i % 3) * 0.05 });
  }

  // ---------- the silence: sound ducks, the edges of the world dim, small rests drift in the dark ----------
  const SIL = { until: -1 };
  function silenced() { return gtime() < SIL.until; }
  function makeSilence(e, dur) {
    const src = e.lipsW || e.heartW || { x: e.x, y: e.y - 100 };
    const h = { kind: 'c8_silence', owner: e, t: 0, life: dur + 0.8, dur, endAt: dur, x: src.x, y: src.y, update: silUpd, draw: silPaint };
    G.game.hazards.unshift(h);
    e.silH = h; SIL.until = gtime() + dur; duck(dur);
    if (!e.hushBark) { e.hushBark = true; G.game.bark('c8_bossHush'); G.game.hint('c8_bossHush'); }
    return h;
  }
  function silUpd(h) { if (h.t > h.endAt + 0.7) h.done = true; }
  function endSilence(h) {   // a perfect guard inside the silence answers it — the silence breaks early
    if (h.t >= h.endAt) return;
    h.endAt = h.t; SIL.until = gtime(); unduck(0.35);
    const o = h.owner, c = o && (o.phase >= 3 ? o.heartW : o.chestW);
    if (c) { G.FX.ring(c.x, c.y, 20, 520, 0.7, GOLDL, 5); G.FX.flash(c.x, c.y, 200, 0.35, GOLDL); }
  }
  function silPaint(ctx, h) {
    const v = G.game._view; if (!v) return;
    const k = Math.min(1, h.t / 0.3) * (1 - clamp01((h.t - h.endAt) / 0.6));
    if (k <= 0) return;
    const S = v.S, cam = v.cam, w = G.game.W / S, hh = G.game.H / S, x0 = cam.x - w / 2, y0 = cam.y - hh / 2, R = Math.max(w, hh);
    ctx.save();
    // the colour drains out of the world behind her (everything that matters is drawn after this, in colour)
    if (G.Quality.full) { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(0,0,0,${0.82 * k})`; ctx.fillRect(x0 - 20, y0 - 20, w + 40, hh + 40); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(14,8,32,${0.34 * k})`; ctx.fillRect(x0 - 20, y0 - 20, w + 40, hh + 40);
    const gr = ctx.createRadialGradient(cam.x, cam.y + hh * 0.06, R * 0.16, cam.x, cam.y, R * 0.62);
    gr.addColorStop(0, 'rgba(9,4,22,0)'); gr.addColorStop(0.45, `rgba(9,4,22,${0.55 * k})`); gr.addColorStop(1, `rgba(5,2,14,${0.96 * k})`);
    ctx.fillStyle = gr; ctx.fillRect(x0 - 20, y0 - 20, w + 40, hh + 40);
    // the hush wave rolling out of her lips
    if (h.t < 1.4) {
      const r = 40 + h.t * 820, a = (1 - h.t / 1.4) * k;
      ctx.strokeStyle = `rgba(18,8,40,${0.55 * a})`; ctx.lineWidth = 30; ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(LILAC, 0.5 * a); ctx.lineWidth = 2; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // little rests drifting in the dark margins
    for (let i = 0; i < (LQ() ? 0 : 6); i++) {
      const u = (i * 0.618 + 0.05) % 1, side = i % 2 ? 1 : -1;
      const px = cam.x + side * w * (0.36 + 0.1 * ((i * 0.37) % 1)), py = y0 + hh * (1 - ((u + h.t * 0.05 * (1 + (i % 3) * 0.3)) % 1));
      restGlyph(ctx, px, py, 0.32, Math.sin(h.t * 0.8 + i) * 0.25, '#2c2058', U.rgba(LILAC, 0.6), 0.55 * k);
    }
    ctx.restore();
  }
  function hushWave(e) {
    const q = e.lipsW || e.heartW || { x: e.x, y: e.y - 100 };
    sfx('c8_shh'); G.FX.ring(q.x, q.y, 6, 120, 0.6, LILAC, 3); G.FX.text(q.x + e.facing * 24, q.y - 26, '噓……', '#e6dcff', 16, 1.1);
  }

  /* ================================ shadow-hand gameplay (what is drawn is what hits) ================================ */
  function atkPose(e, st = e.st) {
    const a = e.atk; if (!a || !a.keys) return null;
    const p = Object.assign({}, sample(a.keys, st));
    if (a.dyn) a.dyn(e, p, st);
    return p;
  }
  function handTW(e, p, hand) {
    const f = e.facing, bx = e.x + f * p.so;
    if (hand === 'b') return { x: bx + f * p.hbx, y: e.y + p.hby };
    if (hand === 'fb') return { x: bx + f * (p.hfx + p.hbx) / 2, y: e.y + (p.hfy + p.hby) / 2 };
    return { x: bx + f * p.hfx, y: e.y + p.hfy };
  }
  function handBox(e, p, h) {
    const q = handTW(e, p, h.hand), w = h.hand === 'fb' ? Math.abs(p.hfx - p.hbx) + h.w : h.w;
    return { q, box: { x: q.x - w / 2, y: q.y - h.h / 2, w, h: h.h } };
  }
  function shadowHits(e) {
    const a = e.atk; if (!a || !a.sh) return;
    let p = null;
    a.sh.forEach((h, i) => {
      if (e.shDone[i] || e.st < h.t0 || e.st > h.t1) return;
      p = p || atkPose(e);
      const { q, box } = handBox(e, p, h);
      if (U.rectsOverlap(box, e.P.hurtbox)) { e.shDone[i] = true; e.P.receiveHit(e, { dmg: h.dmg, unblockable: true, kb: h.kb || 380, hx: q.x, hy: q.y }); }
    });
  }
  // presses: the palm follows Rinne until it locks, then comes down where it locked
  const trackUpd = (list) => (e, dt, st) => {
    for (const [hand, t0, t1] of list) if (st >= t0 && st < t1) {
      const tx = e.P.x + e.P.vx * 0.12;
      e.trk[hand] = e.trk[hand] == null ? tx : U.damp(e.trk[hand], tx, 7, dt);
    }
  };
  const trackDyn = (list) => (e, p, st) => {
    for (const [hand, t0] of list) if (st >= t0) {
      const wx = e.trk[hand] ?? e.P.x, lx = (wx - (e.x + e.facing * p.so)) * e.facing;
      if (hand === 'b') p.hbx = lx; else p.hfx = lx;
    }
  };
  function slapFx(e, hand, k = 1) {
    const p = atkPose(e); if (!p) return;
    const q = handTW(e, p, hand), fy = floorAt(q.x, e.y);
    G.game.shake(0.32 * k); sfx('c8_slap', k);
    G.FX.dust(q.x, fy, LQ() ? 8 : 18, { w: 90, speed: 300, size: 16, col: 'rgba(205,190,250,' });
    G.FX.ring(q.x, fy, 10, 150 * k, 0.4, LILAC, 5, { flat: 0.2 });
  }
  function sweepDust(e, hand, dt) {
    if (Math.random() > dt * (LQ() ? 18 : 40)) return;
    const p = atkPose(e); if (!p) return;
    const q = handTW(e, p, hand);
    G.FX.dust(q.x - e.facing * 40, floorAt(q.x, e.y), 1, { w: 30, speed: 90, size: 14, col: 'rgba(205,190,250,' });
  }
  function hintOnce(e, id) { G.game.hint(id); }

  /* ================================ attacks ================================ */
  const tw = (t, src, face) => ({ t, c: 'white', src, face }), tr = (t, src, face) => ({ t, c: 'red', src, face });
  const ev = (t, fn) => ({ t, fn });
  const cast = (n, ...a) => () => sfx(n, ...a);
  const NOTE_M = [86, 89, 93];

  // ---------------- I · 搖籃曲 LULLABY ----------------
  // 音盒鈴音 CHIMES: the box up to her face, two turns of the crank, three notes on the beat
  const CHIME_K = keys([
    [0, {}],
    [0.38, { ...BOX_FACE, lean: -0.05, head: -0.04, hov: 31, crank: 0.4, lid: 0.35 }],
    [0.52, { crank: 1.4, lid: 1 }, 'snap'],
    [0.9, {}, 'lin'],
    [0.92, { boxA: -0.32, lean: -0.1 }, 'snap'], [1.08, { boxA: 0, lean: -0.05 }],
    [1.42, { boxA: -0.32, lean: -0.1 }, 'snap'], [1.58, { boxA: 0, lean: -0.05 }],
    [1.92, { boxA: -0.4, lean: -0.12 }, 'snap'], [2.08, { boxA: 0, lean: -0.04, crank: 0.2 }],
    [2.4, { bkx: 15, bky: 15, lean: 0.14, head: 0.3, hov: 22, lid: 0.45, puff: 0.15 }],
    [2.75, POSE0],
  ]);
  const chimes = {
    name: 'chimes', dur: 2.75, cd: 1.0, keys: CHIME_K, track: false,
    tells: [tw(0.45, 'box'), tw(0.95, 'box'), tw(1.45, 'box')],
    ev: [ev(0.42, cast('c8_wind'))].concat([0.92, 1.42, 1.92].map((t, i) => ev(t, (e) => fireNote(e, srcW(e, 'box'), { m: NOTE_M[i] })))),
  };
  // 搖籃環 LULLABY RINGS: she hugs the box and rocks; rings of stave-light roll out on each sway
  const RING_K = keys([
    [0, {}],
    [0.3, { ...BOX_HUG, lean: 0.1, head: 0.42, lid: 0.85, puff: 0.75, hov: 24 }],
    [0.55, { bx: -3, lean: 0.02 }], [0.78, { bx: 3, lean: 0.17 }, 'snap'],
    [1.15, { bx: -3, lean: 0.02 }], [1.38, { bx: 3, lean: 0.17 }, 'snap'],
    [1.75, { bx: -3, lean: 0.02 }], [1.98, { bx: 3, lean: 0.17 }, 'snap'],
    [2.4, { bx: 0, lean: 0.14, head: 0.32, hov: 20, puff: 0.2 }],
    [2.8, POSE0],
  ]);
  const ringAt = (src, o) => (e) => { const b = srcW(e, src); makeRing(e, b.x, b.y, o); G.FX.ring(b.x, b.y, 8, 50, 0.25, o && o.dark ? LILAC : GOLDL, 3); };
  const rings = {
    name: 'rings', dur: 2.8, cd: 1.0, keys: RING_K, track: false,
    tells: [tw(0.3, 'box'), tw(0.9, 'box'), tw(1.5, 'box')],
    ev: [0.78, 1.38, 1.98].map((t) => ev(t, ringAt('box'))),
  };
  // 影之手 SWEEP: she lifts her little hand — "go away" — and the shadow slaps the floor and sweeps it (red)
  const SWEEP_K = keys([
    [0, {}],
    [0.2, { wf: 0, hfx: 60, hfy: -270 }],
    [0.32, { fx: 4.5, fy: -15.5, ft: 2, crank: 0, ...BOX_LOW, lean: -0.1, head: -0.12, hov: 30 }],
    [0.6, { wf: 1, hfx: -30, hfy: -395, of: 0.2, sl: -0.08 }],
    [0.95, { hfx: -46, hfy: -410, fx: 3.5, fy: -17.5, lean: -0.14 }, 'lin'],
    [1.0, { hfx: 175, hfy: -42, of: 1, sl: 0.22 }, 'in'],
    [1.16, { hfx: 190, fx: 17, fy: 2, lean: 0.12, head: 0.08 }, 'lin'],
    [1.52, { hfx: 900, sl: 0.3, fx: 18, fy: 6, lean: 0.14 }, 'out'],
    [1.9, { hfx: 925 }, 'lin'],
    [2.15, { ft: 0, fx: 14.5, fy: 9, lean: 0.16, head: 0.3, hov: 22, puff: 0.2 }],
    [2.5, { wf: 0, hfx: 520, hfy: -130, of: 0, sl: 0 }],
    [2.7, POSE0],
  ]);
  const sweepEv = (land, go) => [ev(land, (e) => slapFx(e, 'f')), ev(go, cast('c8_sweep'))];
  const sweep = {
    name: 'sweep', dur: 2.7, cd: 1.05, keys: SWEEP_K, track: false,
    tells: [tr(0.3, 'shandF')],
    sh: [{ hand: 'f', t0: 0.98, t1: 1.54, w: 124, h: 86, dmg: 28, kb: 380, warn: 0.3 }],
    ev: [ev(0.32, (e) => { sfx('c8_rise'); hintOnce(e, 'c8_bossSweep'); })].concat(sweepEv(1.0, 1.16)),
    upd(e, dt, st) { if (st > 1.16 && st < 1.55) sweepDust(e, 'f', dt); },
  };
  // 休止符雨 REST RAIN: she offers the box to the sky; rests fall where the floor turns red
  const RAIN_K = keys([
    [0, {}],
    [0.42, { ...BOX_HIGH, lid: 1, lean: -0.12, head: -0.42, hov: 34 }],
    [1.7, { hov: 38, head: -0.46 }, 'lin'],
    [2.1, { bkx: 15, bky: 14, fx: 14.5, fy: 8.5, lid: 0.5, lean: 0.12, head: 0.25, hov: 24, puff: 0.2 }],
    [2.5, POSE0],
  ]);
  const rain = {
    name: 'rain', dur: 2.5, cd: 0.9, keys: RAIN_K, track: false,
    tells: [tr(0.3, 'box')],
    ev: [ev(0.35, cast('c8_rev', 69, 0.8, 0.5)), ev(0.45, (e) => restVolley(e, 5, { gap: 0.24 }))],
  };
  // 「噓——」 SHH: a finger to her lips; the shadow does it too; the world goes silent and rests fall without a sound
  const SHH_K = keys([
    [0, {}],
    [0.3, { fx: 7, fy: -13, ft: 1, crank: 0, ...BOX_LOW, lean: 0.02, head: 0.06, puff: 0.95 }],
    [0.62, { fx: 9.6, fy: -8.4, head: 0.14, lean: 0.06 }],
    [0.76, { head: 0.22, lean: 0.11 }, 'snap'],
    [3.2, { head: 0.18, lean: 0.08, hov: 30 }, 'lin'],
    [3.55, { fx: 14.5, fy: 8.5, ft: 0, bkx: 15, bky: 13, puff: 0.6, head: 0.15 }],
    [3.9, POSE0],
  ]);
  const shh = {
    name: 'shh', dur: 3.9, cd: 1.0, keys: SHH_K, track: false,
    tells: [tr(0.95, 'lips')],
    ev: [ev(0.3, cast('c8_breathIn', 0.8)), ev(0.76, hushWave), ev(0.86, (e) => makeSilence(e, 3.2)),
      ev(1.0, (e) => restVolley(e, 3, { gap: 0.2, warn: 1.0 })), ev(1.95, (e) => restVolley(e, 3, { gap: 0.2, warn: 1.0, alt: true }))],
  };
  // 影之掌 PRESS: crowded, she flinches; the shadow's palm hovers over Rinne and comes down (red)
  const PRESS_K = keys([
    [0, {}],
    [0.12, { ...BOX_HUG, lean: -0.16, head: 0.45, hov: 34, bx: -4, puff: 1, wf: 0 }],
    [0.55, { wf: 1, hfy: -330, of: 1 }],
    [0.75, { hfy: -350 }, 'lin'],
    [0.85, { hfy: -46 }, 'in'],
    [1.6, { hfy: -44, head: 0.4 }, 'lin'],
    [2.05, { lean: 0.1, head: 0.25, hov: 26, bx: 0, puff: 0.5, wf: 0, hfy: -200, of: 0 }],
    [2.4, POSE0],
  ]);
  const press = {
    name: 'press', dur: 2.4, cd: 1.0, keys: PRESS_K, track: false,
    tells: [tr(0.15, 'shandF')],
    sh: [{ hand: 'f', t0: 0.8, t1: 0.92, w: 150, h: 92, dmg: 30, kb: 420, warn: 0.15 }],
    ev: [ev(0.12, cast('c8_gasp')), ev(0.84, (e) => slapFx(e, 'f', 1.2))],
    upd: trackUpd([['f', 0.15, 0.62]]), dyn: trackDyn([['f', 0.15]]),
  };
  // cornered and crowded: she floats over Rinne's head to the other side (no hit)
  const ESC_K = keys([[0, {}], [0.22, { ...BOX_HUG, hov: 70, lean: -0.22, head: 0.3, puff: 1, sv: 0.6 }], [0.55, { hov: 150, lean: 0.25, sv: 0.25 }], [0.85, { hov: 64, lean: 0.1, sv: 0.8 }], [1.05, POSE0]]);
  const escape = {
    name: 'escape', dur: 1.05, cd: 0.35, keys: ESC_K, track: false, tells: [],
    onStart(e) { e.escX0 = e.x; e.escF = e.facing; e.escFlip = false; sfx('c8_gasp'); },
    upd(e, dt, st) {
      const ar = arenaOf(e), k = U.easeInOutSine(clamp01((st - 0.12) / 0.8));
      e.x = U.clamp(e.escX0 + e.escF * 430 * k, ar.x0 + 150, ar.x1 - 150); e.vx = 0;
      if (st > 0.55 && !e.escFlip) { e.escFlip = true; e.facing = -e.escF; }
    },
  };

  // ---------------- II · 二重唱 DUET (the shadow sings 0.6 s behind her) ----------------
  // the opening of the duet: she opens her eyes, lets out a breath, and curtsies; the shadow steps back to sing with her
  const TR2_K = keys([
    [0, { ...BOX_HUG, lean: -0.14, head: 0.42, hov: 30, puff: 1, bx: -3 }],
    [0.7, { head: 0.3, puff: 0.9, eyes: 0.1 }],
    [1.25, { eyes: 1, puff: 0, head: -0.06, lean: -0.04, hov: 34, bx: 0, sE: 1, so: -150 }],
    [1.65, { fx: 6, fy: 25, crank: 0, ft: 0, bkx: 8, bky: 21 }],
    [2.1, { lean: 0.34, head: 0.38, hov: 28, tF: 0.45, kF: 1.2, tB: -0.32, kB: 0.55, sm: 0.3 }],
    [2.6, { lean: 0.08, head: 0.08, hov: 32, tF: 0.3, kF: 0.85, tB: -0.02, kB: 0.66 }],
    [2.9, P2B],
  ]);
  const transform2 = {
    name: 'transform2', dur: 2.9, cd: 0.6, keys: TR2_K, track: false, tells: [],
    ev: [ev(0.02, (e) => { G.FX.ember(e.x, e.y - 90, 20, GOLDL, { w: 80, h: 100, up: 120 }); }),
      ev(1.1, (e) => { sfx('c8_breathOut', 0.8); sfx('c8_trans', 2); const c = srcW(e, 'chest'); G.FX.ring(c.x, c.y, 10, 260, 0.8, GOLDL, 5); G.FX.flash(c.x, c.y, 180, 0.5, GOLDL); }),
      ev(2.1, (e) => { sfx('c8_tine', 86, 0.8); sfx('c8_tine', 93, 0.6); G.game.hint('c8_bossCanon'); })],
    upd(e, dt, st) { e.invuln = st < 2.6; e.vx = U.approach(e.vx, 0, 900 * dt); },
  };
  // canon chimes: her note · the shadow's ink note, 0.6 s behind (long-short, long-short)
  const CH2_K = keys([
    [0, {}],
    [0.38, { ...BOX_FACE, lean: -0.05, hov: 34, crank: 0.4, lid: 0.4, wf: 1, hfx: 40, hfy: -300, of: 0 }],
    [0.52, { crank: 1.4, lid: 1 }, 'snap'],
    [0.92, { boxA: -0.32, lean: -0.1 }, 'snap'], [1.08, { boxA: 0, lean: -0.05 }],
    [1.46, { hfx: 30, hfy: -330 }], [1.52, { hfx: 110, hfy: -300 }, 'snap'], [1.7, { hfx: 50, hfy: -320 }],
    [2.02, { boxA: -0.32, lean: -0.1 }, 'snap'], [2.18, { boxA: 0, lean: -0.05 }],
    [2.56, { hfx: 30, hfy: -330 }], [2.62, { hfx: 110, hfy: -300 }, 'snap'], [2.8, { hfx: 50, hfy: -320 }],
    [3.12, { boxA: -0.4, lean: -0.12 }, 'snap'], [3.28, { boxA: 0, crank: 0.2 }],
    [3.66, { hfx: 30, hfy: -330 }], [3.72, { hfx: 110, hfy: -300 }, 'snap'],
    [4.0, { wf: 0.3, hfx: 60, hfy: -260, bkx: 15, bky: 15, lean: 0.12, head: 0.26, hov: 26, lid: 0.45 }],
    [4.35, P2B],
  ], P2B);
  const CN_M = [0.92, 2.02, 3.12], CN_S = [1.52, 2.62, 3.72];
  const chimes2 = {
    name: 'chimes2', dur: 4.35, cd: 1.0, keys: CH2_K, track: false,
    tells: [0.45, 1.0, 1.55, 2.1, 2.65, 3.2].map((t, i) => tw(t, i % 2 ? 'shandF' : 'box', i ? false : undefined)),
    ev: [ev(0.42, cast('c8_wind'))]
      .concat(CN_M.map((t, i) => ev(t, (e) => fireNote(e, srcW(e, 'box'), { m: NOTE_M[i] }))))
      .concat(CN_S.map((t, i) => ev(t, (e) => fireNote(e, srcW(e, 'shandF'), { m: NOTE_M[i], dark: true })))),
  };
  // canon rings: her ring from the box, its ring from its chest 0.6 s later
  const RG2_K = keys([
    [0, {}],
    [0.3, { ...BOX_HUG, lean: 0.1, head: 0.36, lid: 0.85, hov: 28, wf: 1, hfx: 40, hfy: -260, wb: 1, hbx: 20, hby: -250, of: 0, ob: 0 }],
    [0.55, { bx: -3, lean: 0.02, sl: -0.05 }], [0.78, { bx: 3, lean: 0.17 }, 'snap'],
    [1.15, { sl: 0.08 }], [1.38, { sl: -0.05, hfx: 70, hbx: 50 }, 'snap'],
    [1.7, { bx: -3, lean: 0.02, hfx: 40, hbx: 20 }], [1.92, { bx: 3, lean: 0.17 }, 'snap'],
    [2.3, { sl: 0.08 }], [2.52, { sl: -0.05, hfx: 70, hbx: 50 }, 'snap'],
    [2.9, { bx: 0, lean: 0.12, head: 0.28, hov: 26, wf: 0, wb: 0, sl: 0 }],
    [3.3, P2B],
  ], P2B);
  const rings2 = {
    name: 'rings2', dur: 3.3, cd: 1.0, keys: RG2_K, track: false,
    tells: [tw(0.3, 'box'), tw(0.86, 'schest', false), tw(1.44, 'box', false), tw(2.0, 'schest', false)],
    ev: [ev(0.78, ringAt('box')), ev(1.38, ringAt('schest', { dark: true, speed: 330 })), ev(1.92, ringAt('box')), ev(2.52, ringAt('schest', { dark: true, speed: 330 }))],
  };
  // 拂 BRUSH: her small white brush of light (guard it) → then, its red tell only after her blow has landed, the shadow
  // repeats it as a giant sweep (jump it). Tells and blows always come in the same order: white · red.
  const BR_K = keys([
    [0, {}],
    [0.2, { fx: -7, fy: 9, ft: 2, crank: 0, ...BOX_LOW, lean: -0.08, hov: 30, wf: 0, hfx: 40, hfy: -300 }],
    [0.62, { fx: -9, fy: 8, lean: -0.12 }, 'lin'],
    [0.72, { fx: 21, fy: -9, lean: 0.2, head: 0.02 }, 'snap'],
    [0.86, { fx: 20, fy: -6, wf: 0.6, hfx: -20, hfy: -360, of: 0.2, sl: -0.04 }],
    [1.25, { wf: 1, hfx: -60, hfy: -410, sl: -0.08 }],
    [1.46, { hfx: 180, hfy: -42, of: 1, sl: 0.22 }, 'in'],
    [1.62, { hfx: 195 }, 'lin'],
    [1.98, { hfx: 905, sl: 0.3 }, 'out'],
    [2.25, { hfx: 925, fx: 14.5, fy: 9, ft: 0, lean: 0.14, head: 0.28, hov: 24 }, 'lin'],
    [2.75, { wf: 0, hfx: 520, hfy: -130, of: 0, sl: 0 }],
    [3.05, P2B],
  ], P2B);
  const brush = {
    name: 'brush', dur: 3.05, cd: 0.95, keys: BR_K,
    tells: [tw(0.2, 'handF'), tr(0.79, 'shandF', false)],
    hits: [{ t0: 0.7, t1: 0.82, box: { x: -6, y: -166, w: 98, h: 122 }, dmg: 20, kb: 260, pbal: 70 }],
    sh: [{ hand: 'f', t0: 1.44, t1: 2.0, w: 124, h: 86, dmg: 28, kb: 380, warn: 0.79 }],
    ev: [ev(0.68, () => { sfx('whoosh', 1.3); sfx('c8_tine', 93, 0.7); })].concat(sweepEv(1.46, 1.62)),
    upd(e, dt, st) { if (st > 1.62 && st < 2.0) sweepDust(e, 'f', dt); },
  };
  // presses in counterpoint: its palm · its other palm · her chime (red · red · white, tells in the same order)
  const PR2_K = keys([
    [0, {}],
    [0.12, { ...BOX_HUG, lean: -0.12, head: 0.36, hov: 34, puff: 0.6, wf: 0 }],
    [0.55, { wf: 1, hfy: -330, of: 1 }],
    [0.75, { hfy: -350 }, 'lin'],
    [0.85, { hfy: -46 }, 'in'],
    [1.0, { hfy: -44, wb: 0.6, hby: -260, ob: 0.8 }, 'lin'],
    [1.3, { wf: 0.5, hfy: -160, of: 0.5, wb: 1, hby: -330, ob: 1 }],
    [1.5, { hby: -350 }, 'lin'],
    [1.6, { hby: -46 }, 'in'],
    [1.8, { ...BOX_FACE, crank: 1.2, lid: 1, lean: -0.04, head: 0, wf: 0, hfy: -200, of: 0 }],
    [2.21, { boxA: -0.32 }, 'snap'], [2.36, { boxA: 0, crank: 0.3 }],
    [2.7, { hby: -44, wb: 0, ...BOX_LOW, lean: 0.12, head: 0.26, hov: 26, ob: 0 }],
    [3.4, P2B],
  ], P2B);
  const press2 = {
    name: 'press2', dur: 3.4, cd: 1.0, keys: PR2_K, track: false,
    tells: [tr(0.15, 'shandF'), tr(0.95, 'shandB', false), tw(1.75, 'box', false)],
    sh: [{ hand: 'f', t0: 0.8, t1: 0.92, w: 150, h: 92, dmg: 30, kb: 420, warn: 0.15 }, { hand: 'b', t0: 1.55, t1: 1.67, w: 150, h: 92, dmg: 30, kb: 420, warn: 0.95 }],
    ev: [ev(0.84, (e) => slapFx(e, 'f', 1.2)), ev(1.59, (e) => slapFx(e, 'b', 1.2)), ev(2.21, (e) => fireNote(e, srcW(e, 'box'), { m: 89 }))],
    upd: trackUpd([['f', 0.15, 0.62], ['b', 0.95, 1.37]]), dyn: trackDyn([['f', 0.15], ['b', 0.95]]),
  };
  // the duet phrase — call and answer: her chime (white) · its sweep (red) · her ring (white)
  const DU_K = keys([
    [0, {}],
    [0.3, { ...BOX_FACE, crank: 1.2, lid: 1, lean: -0.05, hov: 34 }],
    [0.76, { boxA: -0.35, lean: -0.1 }, 'snap'],
    [0.92, { boxA: 0, lean: -0.04, crank: 0.3 }],
    [1.62, { ...BOX_HUG, lid: 0.8, wf: 0.7, hfx: -30, hfy: -370, of: 0.2, sl: -0.05 }],
    [2.05, { wf: 1, hfx: -60, hfy: -410, sl: -0.08 }],
    [2.3, { hfx: 180, hfy: -42, of: 1, sl: 0.22, lean: 0.12 }, 'in'],
    [2.46, { hfx: 195 }, 'lin'],
    [2.82, { hfx: 905, sl: 0.3 }, 'out'],
    [3.1, { bx: -3, lean: 0.02, wf: 0.4, hfx: 600, hfy: -120, of: 0.4 }], [3.41, { bx: 3, lean: 0.18, wf: 0, sl: 0, of: 0 }, 'snap'],
    [3.8, { bx: 0, lean: 0.14, head: 0.3, hov: 24 }],
    [4.4, P2B],
  ], P2B);
  const duet = {
    name: 'duet', dur: 4.4, cd: 1.0, keys: DU_K, track: false,
    tells: [tw(0.3, 'box'), tr(1.65, 'shandF', false), tw(2.95, 'box', false)],
    sh: [{ hand: 'f', t0: 2.28, t1: 2.84, w: 124, h: 86, dmg: 28, kb: 380, warn: 1.65 }],
    ev: [ev(0.76, (e) => fireNote(e, srcW(e, 'box'), { m: 86 }))].concat(sweepEv(2.3, 2.46)).concat([ev(3.41, ringAt('box'))]),
    upd(e, dt, st) { if (st > 2.46 && st < 2.85) sweepDust(e, 'f', dt); },
  };
  // silence, in canon: a finger to her lips; in the hush the shadow lets fall two ink notes and the rests come down
  const SH2_K = keys([
    [0, {}],
    [0.3, { fx: 7, fy: -13, ft: 1, crank: 0, ...BOX_LOW, lean: 0.02, head: 0.04, wf: 0 }],
    [0.62, { fx: 9.6, fy: -8.4, head: 0.12, lean: 0.06 }],
    [0.76, { head: 0.2, lean: 0.1 }, 'snap'],
    [1.5, { wf: 1, hfx: 50, hfy: -320, of: 0 }],
    [2.06, { hfx: 40, hfy: -335 }], [2.12, { hfx: 110, hfy: -300 }, 'snap'], [2.4, { hfx: 50, hfy: -320 }],
    [2.96, { hfx: 40, hfy: -335 }], [3.02, { hfx: 110, hfy: -300 }, 'snap'],
    [3.6, { fx: 14.5, fy: 8.5, ft: 0, bkx: 15, bky: 13, head: 0.1, wf: 0 }],
    [4.2, P2B],
  ], P2B);
  const shh2 = {
    name: 'shh2', dur: 4.2, cd: 1.0, keys: SH2_K, track: false,
    tells: [tr(0.95, 'lips'), tw(1.66, 'shandF', false), tw(2.56, 'shandF', false)],
    ev: [ev(0.3, cast('c8_breathIn', 0.8)), ev(0.76, hushWave), ev(0.86, (e) => makeSilence(e, 3.4)),
      ev(1.0, (e) => restVolley(e, 3, { gap: 0.2, warn: 1.0 })), ev(2.0, (e) => restVolley(e, 3, { gap: 0.2, warn: 1.0, alt: true })),
      ev(2.12, (e) => fireNote(e, srcW(e, 'shandF'), { m: 89, dark: true })), ev(3.02, (e) => fireNote(e, srcW(e, 'shandF'), { m: 93, dark: true }))],
  };
  // rest rain in canon: her volley, then the shadow's echo of it
  const rain2 = {
    name: 'rain2', dur: 2.9, cd: 0.9, keys: keys(RAIN_K.map(([t, q, ez]) => [t, Object.assign({}, q, { so: -150, sE: 1, eyes: 1, puff: 0 }), ez]), P2B), track: false,
    tells: [tr(0.3, 'box')],
    ev: [ev(0.35, cast('c8_rev', 69, 0.8, 0.5)), ev(0.45, (e) => restVolley(e, 5, { gap: 0.22 })), ev(1.05, (e) => restVolley(e, 3, { gap: 0.22, alt: true }))],
  };

  // ---------------- III · 休止 THE REST (the colossus; near hand = wf, far hand = wb) ----------------
  // she gasps, curls up and is drawn back into the shadow's chest; the shadow swells, turns to face Rinne and opens its arms
  const TR3_K = keys([
    [0, { ...BOX_HUG, lean: -0.22, head: -0.3, hov: 40, puff: 1, eyes: 0 }],
    [0.3, {}],
    [1.0, { ...CURL, hov: 130, ss: 1.15, kn: 0.4, sl: -0.05, wf: 0.6, hfx: 50, hfy: -250, wb: 0.6, hbx: 20, hby: -240, of: 0, ob: 0 }],
    [1.7, { hov: 210, ss: 1.38, kn: 1, sl: -0.12, sh: -0.2, wf: 1, hfx: 70, hfy: -235, wb: 1, hbx: 40, hby: -225 }],
    [2.3, { wf: 1, hfx: 420, hfy: -440, wb: 1, hbx: -380, hby: -460, of: 0.4, ob: 0.4, ss: 1.52, sl: -0.3, sh: -0.4 }],
    [2.9, { wf: 0.5, hfx: 300, hfy: -260, wb: 0.5, hbx: -200, hby: -260, ss: 1.45 }],
    [3.6, P3B],
  ], P2B);
  const transform3 = {
    name: 'transform3', dur: 3.6, cd: 0.5, keys: TR3_K, track: false, tells: [],
    onStart(e) { e.tr3X0 = e.x; const ar = arenaOf(e); e.tr3X1 = U.clamp(e.x - e.facing * 150, ar.x0 + 270, ar.x1 - 270); },
    dyn(e, p, st) { const k = U.easeInOutSine(clamp01((st - 0.3) / 1.3)); p.so = U.lerp(-150, 0, k); },
    upd(e, dt, st) {
      e.invuln = st < 3.4;
      const k = U.easeInOutSine(clamp01((st - 0.3) / 1.3)); e.x = U.lerp(e.tr3X0, e.tr3X1, k); e.vx = 0;
      if (st > 0.5 && st < 1.8 && Math.random() < dt * 20) G.FX.ember(e.x, e.y - 220, 2, LILAC, { w: 200, h: 260, up: 100 });
    },
    ev: [ev(0.02, cast('c8_gasp')), ev(0.4, (e) => sfx('c8_trans', 3)),
      ev(1.85, (e) => { const c = srcW(e, 'heart'); G.game.shake(1); G.FX.flash(c.x, c.y, 320, 0.6, '#ffffff'); G.FX.ring(c.x, c.y, 20, 600, 0.9, LILAC, 8); G.FX.ring(e.x, e.y, 30, 520, 0.8, LILAC, 6, { flat: 0.2 }); }),
      ev(2.3, (e) => { G.FX.dust(e.x, e.y, LQ() ? 14 : 30, { w: 520, speed: 300, size: 20, col: 'rgba(205,190,250,' }); G.game.shake(0.6); })],
  };
  // double sweep: the near hand slaps and sweeps outward; the far hand crosses over and sweeps back
  const S3_K = keys([
    [0, {}],
    [0.15, { wf: 0 }],
    [0.5, { wf: 1, hfx: 230, hfy: -400, of: 0.2 }],
    [0.9, { hfx: 210, hfy: -420 }, 'lin'],
    [1.0, { hfx: 235, hfy: -48, of: 1 }, 'in'],
    [1.16, { hfx: 250 }, 'lin'],
    [1.5, { hfx: 1060 }, 'out'],
    [1.55, { wb: 0 }],
    [1.85, { wb: 1, hbx: 640, hby: -470, ob: 0.2, wf: 0.6, hfx: 700, hfy: -160, of: 0 }],
    [2.0, { hbx: 980, hby: -440 }],
    [2.1, { hbx: 1010, hby: -48, ob: 1 }, 'in'],
    [2.26, { hbx: 995 }, 'lin'],
    [2.6, { hbx: 150, wf: 0 }, 'out'],
    [2.85, { hbx: 140 }, 'lin'],
    [3.3, { wb: 0, hbx: -100, hby: -150, ob: 0 }],
    [3.5, P3B],
  ], P3B);
  const p3sweep = {
    name: 'p3sweep', dur: 3.5, cd: 0.95, keys: S3_K, track: false,
    tells: [tr(0.3, 'shandF'), tr(1.4, 'shandB', false)],
    sh: [{ hand: 'f', t0: 0.98, t1: 1.52, w: 140, h: 92, dmg: 30, kb: 400, warn: 0.3 }, { hand: 'b', t0: 2.08, t1: 2.62, w: 140, h: 92, dmg: 30, kb: 400, warn: 1.4 }],
    ev: [ev(0.3, cast('c8_rise')), ev(1.0, (e) => slapFx(e, 'f', 1.3)), ev(1.16, cast('c8_sweep')), ev(1.4, cast('c8_rise')), ev(2.1, (e) => slapFx(e, 'b', 1.3)), ev(2.26, cast('c8_sweep'))],
    upd(e, dt, st) { if (st > 1.16 && st < 1.52) sweepDust(e, 'f', dt); if (st > 2.26 && st < 2.62) sweepDust(e, 'b', dt); },
  };
  // heartbeat: it holds its heart; rings come in pairs — lub · dub
  const HB_K = keys([
    [0, {}],
    [0.35, { wf: 1, hfx: 70, hfy: -270, wb: 1, hbx: -70, hby: -270, of: 0, ob: 0, cr: 0.05 }],
    [0.8, { hfx: 125, hbx: -125, cr: -0.04 }, 'snap'], [0.95, { hfx: 80, hbx: -80 }],
    [1.1, { hfx: 125, hbx: -125 }, 'snap'], [1.4, { hfx: 70, hbx: -70 }],
    [1.9, { hfx: 130, hbx: -130 }, 'snap'], [2.05, { hfx: 80, hbx: -80 }],
    [2.2, { hfx: 130, hbx: -130 }, 'snap'], [2.6, { wf: 0, wb: 0, cr: 0 }],
    [3.0, P3B],
  ], P3B);
  const beatRing = (e) => { e.beat0 = e.t; const c = srcW(e, 'heart'); makeRing(e, c.x, c.y, { speed: 380, r0: 40 }); G.FX.ring(c.x, c.y, 20, 90, 0.3, GOLDL, 4); };
  const heartbeat = {
    name: 'heartbeat', dur: 3.0, cd: 1.0, keys: HB_K, track: false,
    tells: [tw(0.32, 'heart'), tw(1.42, 'heart', false)],
    ev: [ev(0.78, cast('c8_heart', 1.2)), ev(1.88, cast('c8_heart', 1.2))].concat([0.8, 1.1, 1.9, 2.2].map((t) => ev(t, beatRing))),
  };
  // the heart's music box plays five notes that arc down onto Rinne
  const C3_K = keys([
    [0, {}],
    [0.4, { wf: 1, hfx: 300, hfy: -300, wb: 1, hbx: -300, hby: -300, of: 0, ob: 0, lid: 1, cr: -0.06 }],
    [2.8, { hfx: 320, hfy: -320, hbx: -320, hby: -320 }, 'lin'],
    [3.15, { wf: 0, wb: 0, cr: 0, lid: 0.15 }],
    [3.4, P3B],
  ], P3B);
  const p3chimes = {
    name: 'p3chimes', dur: 3.4, cd: 1.0, keys: C3_K, track: false,
    tells: [0.3, 0.8, 1.3, 1.8, 2.3].map((t, i) => tw(t, 'heart', i ? false : undefined)),
    ev: [ev(0.28, cast('c8_wind'))].concat([0.77, 1.27, 1.77, 2.27, 2.77].map((t, i) => ev(t, (e) => fireNote(e, srcW(e, 'heart'), { m: [86, 89, 93, 91, 89][i], lob: true, T: 1.0 })))),
  };
  // alternating palms: near, then far
  const PR3_K = keys([
    [0, {}],
    [0.15, { wf: 0 }],
    [0.55, { wf: 1, hfy: -360, of: 1 }],
    [0.75, { hfy: -380 }, 'lin'],
    [0.85, { hfy: -56 }, 'in'],
    [1.2, { hfy: -54 }, 'lin'],
    [1.5, { wb: 1, hby: -360, ob: 1 }],
    [1.6, { wf: 0.4, hfy: -200 }],
    [1.75, { hby: -380 }, 'lin'],
    [1.85, { hby: -56 }, 'in'],
    [2.4, { hby: -54, wf: 0 }, 'lin'],
    [2.8, { wb: 0, hby: -200, ob: 0 }],
    [3.1, P3B],
  ], P3B);
  const p3press = {
    name: 'p3press', dur: 3.1, cd: 0.95, keys: PR3_K, track: false,
    tells: [tr(0.15, 'shandF'), tr(1.15, 'shandB', false)],
    sh: [{ hand: 'f', t0: 0.8, t1: 0.92, w: 170, h: 104, dmg: 32, kb: 430, warn: 0.15 }, { hand: 'b', t0: 1.8, t1: 1.92, w: 170, h: 104, dmg: 32, kb: 430, warn: 1.15 }],
    ev: [ev(0.84, (e) => slapFx(e, 'f', 1.4)), ev(1.84, (e) => slapFx(e, 'b', 1.4))],
    upd: trackUpd([['f', 0.15, 0.62], ['b', 1.15, 1.62]]), dyn: trackDyn([['f', 0.15], ['b', 1.15]]),
  };
  // 終曲 THE LAST REST: silence; rest lanes; four falling notes; both hands gather over her and clap — then it collapses
  const FIN_K = keys([
    [0, {}],
    [0.9, { wf: 1, hfx: 420, hfy: -410, wb: 1, hbx: -400, hby: -420, of: 0, ob: 0, cr: -0.14, ss: 1.55, sl: -0.3, sh: -0.35, lid: 1 }],
    [3.9, { hfx: 430, hfy: -420, hbx: -410, hby: -430 }, 'lin'],
    [4.35, { hfy: -400, hby: -400, of: 1, ob: 1 }],
    [4.9, { hfy: -425, hby: -425 }, 'lin'],
    [5.02, { hfy: -60, hby: -60 }, 'in'],
    [5.3, { hfy: -52, hby: -52, cr: 0.1 }, 'lin'],
    [5.9, { cr: 1, ss: 1.45, sl: -0.16, sh: -0.28, hfy: -30, hby: -30, sE: 0.15, head: 0.8, lid: 0.3 }, 'out'],
    [8.2, { cr: 0.96 }, 'lin'],
    [9.0, P3B],
  ], P3B);
  const finale = {
    name: 'finale', dur: 9.0, cd: 1.2, keys: FIN_K, track: false,
    tells: [tr(0.95, 'heart'), tw(1.45, 'heart', false), tw(1.95, 'heart', false), tw(2.45, 'heart', false), tw(2.95, 'heart', false), tr(4.3, 'shandF', false)],
    sh: [{ hand: 'fb', t0: 4.98, t1: 5.1, w: 170, h: 104, dmg: 36, kb: 460, warn: 4.3 }],
    ev: [ev(0.1, (e) => { sfx('c8_rev', 50, 1.4, 0.9); sfx('c8_rev', 62, 1.0, 0.9); G.game.hint('c8_bossFinale'); }),
      ev(0.9, (e) => { makeSilence(e, 4.4); if (!e.finBark) { e.finBark = true; G.game.bark('c8_bossFinale'); } }),
      ev(1.0, (e) => restLanes(e, false)), ev(2.2, (e) => restLanes(e, true)),
      ev(4.3, cast('c8_rise')),
      ev(5.0, (e) => { const p = atkPose(e); const q = handTW(e, p, 'fb'), fy = floorAt(q.x, e.y); G.game.shake(1); G.game.hitstop(0.06); sfx('c8_slap', 1.6); G.FX.dust(q.x, fy, LQ() ? 14 : 30, { w: 260, speed: 360, size: 20, col: 'rgba(205,190,250,' }); G.FX.ring(q.x, fy, 20, 360, 0.6, LILAC, 7, { flat: 0.2 }); G.FX.flash(q.x, fy - 60, 260, 0.4, '#ffffff'); }),
      ev(5.35, (e) => { sfx('c8_breathOut', 1.2); if (e.silH) endSilence(e.silH); }),
      ev(5.9, (e) => { const c = srcW(e, 'heart'); G.FX.ring(c.x, c.y, 10, 120, 0.6, GOLDL, 3); })]
      .concat([1.92, 2.42, 2.92, 3.42].map((t, i) => ev(t, (e) => fireNote(e, srcW(e, 'heart'), { m: [74, 77, 81, 79][i], lob: true, T: 1.0 })))),
    dyn(e, p, st) { if (st >= 4.3) { const wx = e.trk.f ?? e.P.x, lx = (wx - (e.x + e.facing * p.so)) * e.facing; p.hfx = lx + 72; p.hbx = lx - 72; } },
    upd(e, dt, st) { trackUpd([['f', 4.3, 4.75]])(e, dt, st); if (st > 5.9 && st < 8.2 && Math.random() < dt * 6) { const c = e.heartW; if (c) G.FX.ember(c.x, c.y, 1, GOLDL, { w: 50, h: 40, up: 50 }); } },
  };
  const MOVES = { chimes, rings, sweep, rain, shh, press, escape, transform2, chimes2, rings2, brush, press2, duet, shh2, rain2, transform3, p3sweep, heartbeat, p3chimes, p3press, finale };
  const HAZ = { rain: 1, shh: 1, rain2: 1, shh2: 1 };
  for (const k in MOVES) {
    const m = MOVES[k], os = m.onStart;
    m.onStart = (e) => { e.shDone = {}; e.trk = {}; if (os) os(e); };
  }

  /* ================================ AI ================================ */
  function choose(e, d) {
    const ph = e.phase, pool = [];
    const put = (k, w) => { if (w > 0 && MOVES[k]) pool.push([k, w]); };
    if (ph >= 3) {
      if (e.t >= e.finAt || (e.hp < e.maxHp * 0.14 && !e.finForced)) {
        if (e.hp < e.maxHp * 0.14) e.finForced = true;
        e.finAt = e.t + 24; e.lastMoves.push('finale'); e.startAtk(finale); return;
      }
      put('p3sweep', 2.2); put('heartbeat', 2.0); put('p3chimes', 1.6); put('p3press', d < 380 ? 2.4 : 1.1);
    } else if (ph === 2) {
      if (d < 150) { put('brush', 3.2); put('press2', 1.4); put('rings2', 0.8); }
      else if (d < 420) { put('chimes2', 2.2); put('rings2', 1.6); put('duet', 2.4); put('brush', 0.5); }
      else { put('chimes2', 2.6); put('duet', 1.4); put('rings2', 0.6); }
      if (e.t >= e.hazAt) put(e.t >= e.silAt ? 'shh2' : 'rain2', 3.2);
    } else {
      if (d < 165) { put('press', e.crowdT > 0.7 ? 4 : 1.3); put('rings', 1.2); put('sweep', 1.4); }
      else if (d < 430) { put('chimes', 2.6); put('rings', 1.8); put('sweep', 2.2); }
      else { put('chimes', 2.8); put('sweep', 1.0); put('rings', 0.6); }
      if (e.t >= e.hazAt) put(e.t >= e.silAt ? 'shh' : 'rain', 3.2);
    }
    if (!pool.length) return;
    const last = e.lastMoves[e.lastMoves.length - 1], prev = e.lastMoves[e.lastMoves.length - 2];
    const wOf = (q) => (q[0] === last ? q[1] * 0.12 : q[0] === prev ? q[1] * 0.55 : q[1]);
    let r = Math.random() * pool.reduce((s, q) => s + wOf(q), 0), pick = pool[0][0];
    for (const q of pool) { if ((r -= wOf(q)) <= 0) { pick = q[0]; break; } }
    if (HAZ[pick]) { e.hazAt = e.t + (ph === 2 ? 9.5 : 11); if (pick === 'shh' || pick === 'shh2') e.silAt = e.t + (ph === 2 ? 19 : 22); }
    e.lastMoves.push(pick); if (e.lastMoves.length > 6) e.lastMoves.shift();
    e.startAtk(MOVES[pick]);
  }
  // the engine's phase change roars; a child does not — she gasps (the swap is synchronous and restored at once)
  function withVoice(fn) { const r = G.SFX.roar; G.SFX.roar = SND.c8_gasp; try { fn(); } finally { G.SFX.roar = r; } }
  function enterP2(e) { withVoice(() => G.game.bossPhase2(e)); }
  function enterP3(e) {
    const g = G.game;
    e.phase = 3; e.atk = null; e.setState('idle'); e.cd = 0; e.speedMul = 1.2;
    g.bark('c8_bossP3'); g.shake(1); g.slowmo(0.8, 0.3);
    G.FX.ring(e.cx, e.cy, 20, 520, 1, LILAC, 8); G.FX.flash(e.cx, e.cy, 400, 0.6, LILAC);
    if (G.Music.TRACKS.c8_boss3) G.Music.play('c8_boss3');
    e.finAt = e.t + 3.6 + 10; e.lastMoves.length = 0;
    if (e.silH) endSilence(e.silH);
    e.startAtk(transform3);
  }
  function teach(e) {
    e.taught++; e.phraseN = Math.min(14, e.phraseN + 1); e.noteBorn[e.phraseN - 1] = e.t;
    e.warm = Math.min(1, e.warm + 1 / 14); e.teachT = 1;
    const m = PARRY_THEME[(e.taught - 1) % PARRY_THEME.length];
    try { const A = G.AudioKit; if (A.ctx && G.Audio && G.Audio.ready) SND.c8_answer(A.ctx.currentTime + 0.16, thirdBelow(m) + 12); } catch (err) { /* audio off */ }
    const c = srcW(e, e.phase >= 3 ? 'heart' : 'chest');
    G.FX.ring(c.x, c.y, 8, 70, 0.45, GOLD, 3); G.FX.ember(c.x, c.y, LQ() ? 4 : 8, GOLDL, { w: 40, h: 50, up: 70 });
    if (e.silH && !e.silH.done) endSilence(e.silH);
    if (e.taught === 1) G.game.hint('c8_bossTeach');
    if (e.phraseN >= 14) phraseComplete(e);
  }
  function phraseComplete(e) {
    e.phraseN = 0; e.phrases++; e.burstT = e.t; e.warm = 1;
    sfx('c8_complete');
    if (e.phrases === 1) G.game.bark('c8_bossTaught');
    const c = srcW(e, e.phase >= 3 ? 'heart' : 'chest');
    G.FX.flash(c.x, c.y, 240, 0.6, GOLDL); G.FX.ring(c.x, c.y, 14, 280, 0.8, GOLD, 6); G.FX.ember(c.x, c.y, LQ() ? 10 : 24, GOLDL, { w: 90, h: 90, up: 120 });
    G.game.shake(0.35);
    if (!e.invuln && e.state !== 'spawn' && e.state !== 'broken') { e.bal = Math.min(e.maxBal, e.bal + 150); e.balT = 0; e.showBar = 3; if (e.bal >= e.maxBal) e.breakBalance(); }
  }
  function srcW(e, src) {
    switch (src) {
      case 'box': return e.boxPos || { x: e.x + e.facing * 16, y: e.y - 92 };
      case 'handF': return e.handW || { x: e.x + e.facing * 22, y: e.y - 100 };
      case 'lips': return e.lipsW || { x: e.x + e.facing * 12, y: e.y - 128 };
      case 'chest': return e.chestW || { x: e.x, y: e.y - 80 };
      case 'shandF': return (e.sHandW && e.sHandW.f) || { x: e.x, y: e.y - 300 };
      case 'shandB': return (e.sHandW && e.sHandW.b) || { x: e.x, y: e.y - 300 };
      case 'schest': return e.sChestW || { x: e.x - e.facing * 150, y: e.y - 280 };
      case 'heart': return e.heartW || { x: e.x, y: e.y - 262 };
    }
    return { x: e.x, y: e.y - 100 };
  }
  function tick(e, dt) {
    if (e.dead) return;
    const s = G.game && G.game.stats;
    if (s) {
      if (e.parrySeen == null) e.parrySeen = s.parries;
      if (s.parries > e.parrySeen) { const n = Math.min(3, s.parries - e.parrySeen); e.parrySeen = s.parries; if (e.state !== 'spawn') for (let i = 0; i < n; i++) teach(e); }
    }
    e.warmShow = U.damp(e.warmShow, e.warm, 2.5, dt);
    e.teachT = Math.max(0, e.teachT - dt * 1.2);
    e.crankA += dt * (1.3 + 10 * clamp01(e.pose ? e.pose.crank : 0.3));
    if (e.turnT >= 0 && e.state !== 'idle') e.turnT = -1;
    // the heart keeps its own time in the last movement
    if (e.phase >= 3 && e.state !== 'atk' && e.state !== 'spawn') { e.beatT -= dt; if (e.beatT <= 0) { e.beatT = 1.5; e.beat0 = e.t; if (e.distP() < 1000) sfx('c8_heart', 0.45); } }
    // the box keeps playing, a little: tiny notes drift out of it while it is open
    if (e.phase < 3 && e.pose && e.pose.lid > 0.6 && Math.random() < dt * 2.2 && e.boxPos) e.boxNotes.push({ x: e.boxPos.x, y: e.boxPos.y - 6, vx: (Math.random() - 0.5) * 20 - e.facing * 10, t: 0, s: 0.5 + Math.random() * 0.25 });
    for (let i = e.boxNotes.length - 1; i >= 0; i--) { const n = e.boxNotes[i]; n.t += dt; n.x += n.vx * dt; n.y -= 28 * dt; if (n.t > 1.6) e.boxNotes.splice(i, 1); }
    if (e.boxNotes.length > 7) e.boxNotes.shift();
    if (DEV.kneel && !e.devK && e.state === 'idle' && e.t > (e.devT0 ?? (e.devT0 = e.t)) + 0.4) { e.devK = true; e.devKneel = true; }
  }

  /* ================================ the type ================================ */
  const BOSS = TYPES.c8_boss = Object.assign({
    name: '冥后・厄蕾絲', en: 'ERESH, QUEEN OF THE DEAD', w: 64, h: 150, hp: 3200, bal: 380, shards: 1200,
    boss: true, poise: true, kbMul: 0.1, spawnT: 3.6, portrait: [0.9, 0.93],
    defeatDialog: 'c8_bossDefeat', phase2Bark: 'c8_bossP2', phase2Music: 'c8_boss2',
    get col() { const b = G.game && G.game.bossRef; return b && b.type === 'c8_boss' && b.phase >= 3 && !b.dead ? '#cbb8ff' : '#ffe3a8'; },
    init(e) {
      e.facing = -1; e.homeX = e.x; e.lastMoves = []; e.hazAt = e.t + 6; e.silAt = e.t + 13; e.finAt = 1e9; e.finForced = false;
      e.turnT = -1; e.behindT = 0; e.crowdT = 0; e.introEv = {}; e.hist = []; e.trk = {}; e.shDone = {}; e.sHandW = {};
      e.warm = 0; e.warmShow = 0; e.teachT = 0; e.taught = 0; e.phraseN = 0; e.phrases = 0; e.noteBorn = []; e.burstT = -9;
      e.crankA = 0; e.beatT = 0.8; e.beat0 = -9; e.boxNotes = []; e.humI = 0;
      e.scT = new Rig.Chain(12, 6.4, 0.032, 0.92); e.scF = new Rig.Chain(5, 4.4, 0.1, 0.86);
      // the hurt box: Mira herself (P1/P2) · the colossus' body around the heart (P3)
      Object.defineProperty(e, 'box', {
        configurable: true, get() {
          if (this.phase >= 3) { const h = this.heartW || { x: this.x + this.facing * 30, y: this.y - 240 }, top = h.y - 120; return { x: h.x - 95, y: top, w: 190, h: this.y - top }; }
          const hv = this.pose ? this.pose.hov : 26, bx = this.pose ? this.facing * this.pose.bx * MS : 0, top = (hv + 102) * MS;
          return { x: this.x + bx - 34, y: this.y - top, w: 68, h: top };
        },
      });
      Object.defineProperty(e, 'cy', { configurable: true, get() { return this.phase >= 3 ? (this.heartW ? this.heartW.y : this.y - 262) : this.y - ((this.pose ? this.pose.hov : 26) + 62) * MS; } });
      const baseUpdate = e.update;
      e.update = function (dt) { baseUpdate.call(this, dt); tick(this, dt); };
      const baseDie = e.die;
      e.die = function () { const s = G.SFX.enemyDie; G.SFX.enemyDie = SND.c8_death; try { baseDie.call(this); } finally { G.SFX.enemyDie = s; } SIL.until = -1; unduck(0.8); };
      if (DEV.ph >= 2) { e.phase = DEV.ph; e.speedMul = 1.15; if (DEV.ph >= 3) e.finAt = e.t + 8; }
      if (DEV.warm != null) { e.warm = e.warmShow = clamp01(DEV.warm); e.phraseN = Math.min(13, Math.round(DEV.warm * 14)); for (let i = 0; i < e.phraseN; i++) e.noteBorn[i] = -9; }
    },
    voice(e) {
      if (e.phase === 1) { if (Math.random() < 0.4) sfx('c8_breathIn', 0.45); }
      else if (e.phase === 2) { if (Math.random() < 0.55) sfx('c8_hum', PARRY_THEME[e.humI++ % PARRY_THEME.length]); }
      else if (Math.random() < 0.5) sfx('c8_rev', 50, 0.6, 0.6);
    },
    weapon(e) {
      const a = e.atk; let src = 'box';
      if (a && a.tells) for (const tl of a.tells) if (tl.t <= e.st + 1e-6) src = tl.src || 'box';
      return srcW(e, src);
    },
    think(e, dt) {
      e.invuln = false;
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) { enterP2(e); return; }
      if (e.phase === 2 && e.hp < e.maxHp * 0.3) { enterP3(e); return; }
      const P = e.P, ar = arenaOf(e), dx = P.x - e.x, d = Math.abs(dx), side = dx >= 0 ? 1 : -1, ph = e.phase;
      // a turn: she spins in the air (the shadow flows through her to the other side)
      if (e.turnT >= 0) {
        e.turnT += dt; e.vx = U.approach(e.vx, 0, 900 * dt);
        if (!e.turnFlip && e.turnT >= TURN / 2) { e.turnFlip = true; e.facing = -e.facing; }
        if (e.turnT >= TURN) { e.turnT = -1; e.cd = Math.max(e.cd, 0.15); }
        return;
      }
      if (side !== e.facing && d > 36) {
        e.behindT += dt; e.vx = U.approach(e.vx, 0, 900 * dt);
        if (e.behindT > (ph >= 3 ? 0.3 : 0.18)) { e.behindT = 0; e.turnT = 0; e.turnFlip = false; if (ph < 3) sfx('whoosh', 0.6); }
        return;
      }
      e.behindT = 0;
      if (ph >= 3) {
        let tv = 0; if (d > 420) tv = e.facing * 70; else if (d < 190) tv = -e.facing * 45;
        e.vx = U.approach(e.vx, tv, 220 * dt);
        e.x = U.clamp(e.x, ar.x0 + 270, ar.x1 - 270);
      } else {
        const want = ph === 2 ? 250 : 300, sp = (ph === 2 ? 170 : 140) * e.speedMul;
        const nearWall = e.facing > 0 ? e.x - ar.x0 < 200 : ar.x1 - e.x < 200;
        let tv = 0;
        if (d < want - 70 && !nearWall) tv = -e.facing * sp; else if (d > want + 90) tv = e.facing * sp;
        e.vx = U.approach(e.vx, tv, 520 * dt);
        e.x = U.clamp(e.x, ar.x0 + 150, ar.x1 - 150);
        e.crowdT = d < 175 ? e.crowdT + dt : Math.max(0, e.crowdT - dt * 2);
        if (nearWall && e.crowdT > 1.1 && e.cd < 0.5) { e.crowdT = 0; e.startAtk(escape); return; }
      }
      if (e.cd > 0) return;
      choose(e, d);
    },
    atkUpdate(e, dt) {
      const a = e.atk; if (!a) return;
      if (a !== transform2 && a !== transform3) e.invuln = false;
      if (a.upd) a.upd(e, dt, e.st);
      shadowHits(e);
      const ar = arenaOf(e), m = e.phase >= 3 ? 270 : 150;
      e.x = U.clamp(e.x, ar.x0 + m, ar.x1 - m);
    },
    onPhase2(e, game) {
      e.hazAt = e.t + 9; e.silAt = e.t + 15; e.lastMoves.length = 0;
      if (e.silH) endSilence(e.silH);
      e.startAtk(transform2);
      G.FX.ember(e.x, e.y - 90, 24, GOLDL, { w: 90, h: 120, up: 160 });
    },
    onHit(e) { if (Math.random() < 0.3 && !silenced()) sfx('c8_tine', 96 + ((Math.random() * 5) | 0), 0.35); },
    draw(ctx, e, ghost) { drawBoss(ctx, e, !!ghost); },
  }, MOVES);

  /* ================================ look ================================ */
  function heartPulse(e) {
    if (e.phase < 3) return 0;
    const ph = e.t - e.beat0;
    return Math.exp(-Math.pow(ph / 0.07, 2)) + 0.7 * Math.exp(-Math.pow((ph - 0.22) / 0.07, 2));
  }
  function lookOf(e, p) {
    const st = e.state, a = st === 'atk' ? e.atk : null;
    const L = {
      warm: e.warmShow, pal: palOf(e.warmShow), teach: e.teachT, alpha: 1, miraA: 1, mote: 0, sAlpha: clamp01(p.sv), colK: e.phase >= 3 ? 1 : 0,
      redF: 0, redB: 0, broken: st === 'broken' || st === 'executed', ghost: false, beat: heartPulse(e), ts: 1, cage: 1, burst: clamp01(1 - (e.t - e.burstT) / 1.2),
    };
    if (st === 'spawn') { L.miraA = sm01(0.5, 1.0, e.st); L.mote = 1 - sm01(0.55, 1.0, e.st); }
    if (a === transform3) L.colK = sm01(1.2, 1.8, e.st);
    if (a === finale) L.cage = 1 - sm01(5.2, 5.9, e.st) * (1 - sm01(8.2, 8.8, e.st));
    if (L.broken && e.phase >= 3) L.cage = 0.25;
    if (a && a.sh) for (const h of a.sh) if (e.st >= h.warn) {
      const k = clamp01((e.st - h.warn) / 0.2) * (1 - clamp01((e.st - h.t1) / 0.2));
      if (h.hand !== 'b') L.redF = Math.max(L.redF, k);
      if (h.hand !== 'f') L.redB = Math.max(L.redB, k);
    }
    if (e.turnT >= 0) { L.ts = Math.max(0.15, Math.abs(Math.cos(PI * e.turnT / TURN))); L.sAlpha *= 0.35 + 0.65 * L.ts; }
    if (L.broken) L.sAlpha *= 0.62 + 0.12 * Math.sin(e.t * 9);
    return L;
  }
  function targetPose(e) {
    const st = e.state, ph = e.phase;
    if (st === 'spawn') return sample(INTRO_K, e.st);
    if (st === 'atk' && e.atk && e.atk.keys) return atkPose(e);
    if (st === 'broken') return ph >= 3 ? BROKEN3(e.t) : BROKEN1(e.t, ph);
    if (st === 'executed') return ph >= 3 ? BROKEN3(e.t) : lerpPose(BROKEN1(e.t, ph), HURT(ph), 0.5);
    let p = ph >= 3 ? IDLE3(e.t) : ph === 2 ? IDLE2(e.t) : IDLE1(e.t);
    if (st === 'hurt' || st === 'recoil') p = lerpPose(p, HURT(ph), Math.sin(Math.min(1, e.st / (st === 'recoil' ? 0.6 : 0.28)) * PI));
    if (ph < 3 && Math.abs(e.vx) > 20) { const m = U.clamp(e.vx * e.facing / 170, -1, 1); p.lean += m * 0.1; p.tF -= m * 0.15; p.tB -= m * 0.2; p.sl += m * 0.04; }
    return p;
  }
  function updPose(e, dt) {
    const tp = targetPose(e);
    if (!e.pose || e.state === 'spawn') e.pose = Object.assign({}, tp);
    else {
      e.pose = lerpPose(e.pose, tp, 1 - Math.exp(-(e.state === 'atk' ? 22 : e.state === 'hurt' || e.state === 'recoil' ? 18 : 8) * dt));
      if (e.state === 'atk') for (const q of DIRECT) e.pose[q] = tp[q];
    }
    const p = Object.assign({}, e.pose), hk = e.hitK;
    if (hk > 0) { p.lean -= 0.14 * hk; p.head += 0.2 * hk; p.hov += 5 * hk; p.puff = Math.min(1, p.puff + hk); p.sl -= 0.05 * hk; }
    return p;
  }
  const CURLI = { ...CURL, hov: 200, lid: 0, eyes: 0, so: -70, sE: 0 };
  const INTRO_K = keys([
    [0, { ...CURLI, sv: 0, rise: 0.02 }],
    [0.55, {}, 'lin'],
    [1.5, { hov: 70, rise: 0.45, sv: 0.6, lean: 0.4, head: 0.4 }, 'out'],
    [2.05, { hov: 30, lean: -0.05, head: -0.1, tF: 0.3, kF: 0.85, tB: -0.02, kB: 0.66, ...BOX_FACE, fx: 14.5, fy: 8.5, crank: 1.2, lid: 0.95, rise: 1, sv: 1, puff: 0.2 }],
    [2.75, { crank: 0.3, lid: 0.7, puff: 1, head: 0.22, lean: 0.08, bkx: 15, bky: 13 }],
    [3.6, POSE0],
  ]);
  function introEvents(e) {
    if (e.state !== 'spawn') return;
    const v = e.introEv, s = e.st, c = e.chestW || { x: e.x, y: e.y - 200 };
    if (!v.a) { v.a = 1; if (G.SFX.resetTheme) G.SFX.resetTheme(); sfx('c8_tine', 86, 0.7); }
    if (s > 0.6 && !v.b) { v.b = 1; sfx('c8_rev', 74, 1, 0.6); G.FX.flash(c.x, c.y, 120, 0.5, GOLDL); G.FX.ring(c.x, c.y, 6, 120, 0.6, GOLDL, 3); }
    if (s > 1.1 && !v.c) { v.c = 1; sfx('c8_rise'); G.FX.dust(e.x - e.facing * 70, e.y, 16, { w: 260, speed: 160, size: 18, col: 'rgba(120,96,190,' }); }
    if (s > 1.95 && !v.d) { v.d = 1; sfx('c8_wind'); }
    [74, 77, 81].forEach((m, i) => { if (s > 2.05 + i * 0.25 && !v['n' + i]) { v['n' + i] = 1; sfx('c8_tine', m + 12, 0.9); const b = e.boxPos; if (b) G.FX.ring(b.x, b.y, 4, 40, 0.3, GOLDL, 2); } });
    if (s > 2.75 && !v.e) { v.e = 1; sfx('c8_breathIn', 1); }
    if (s > 3.3 && !v.f) { v.f = 1; sfx('c8_rev', 62, 0.7, 0.35); }
  }

  /* ================================ drawing ================================ */
  function ensureAnchor(e) {
    // an empty hazard at the front of the list records the clean world transform each frame (no hit-jolt), so the
    // shadow, the colossus and the late hazards can be painted without Mira's hit reaction shaking them
    if (e.anchor && G.game.hazards.indexOf(e.anchor) >= 0) return;
    e.anchor = { kind: 'c8_anchor', owner: e, t: 0, update(h) { if (h.owner.dead || h.owner.remove) h.done = true; }, draw(ctx, h) { h.owner.worldTf = ctx.getTransform(); } };
    G.game.hazards.unshift(e.anchor);
  }
  function drawBoss(ctx, e, ghost) {
    const dt = ghost ? 0 : vdt();
    if (e.state === 'die') { if (!ghost && !e.kneelH) spawnKneel(e, ctx); return; }
    if (!ghost && e.devKneel) { e.devKneel = false; spawnKneel(e, ctx, true); return; }
    const live = G.game.enemies.indexOf(e) >= 0;
    if (!ghost && live) { ensureAnchor(e); e.lateOK = true; }
    if (!ghost && live && dt > 0) introEvents(e);
    if (!live) e.worldTf = null;
    const p = updPose(e, dt), L = lookOf(e, p);
    L.ghost = ghost;
    renderBoss(ctx, e, p, L, ghost, dt);
  }
  function renderBoss(ctx, e, p, L, ghost, dt) {
    const f = e.facing, t = e.t, gm = geoM(p, e.crankA);
    const hm = histAt(e, t - 0.13);
    if (!ghost && dt > 0) pushHist(e, p, gm);
    const baseX = e.x + f * p.so;
    const gs = geoS(p, hm), heart = L.colK > 0;
    // Mira's frame: herself, or (the last movement) the heart in the shadow's chest
    const msx = f * L.ts * MS;
    let ox = e.x, oy = e.y;
    if (heart) { const hp = hipOff(p), cx = baseX + f * gs.heart.x - msx * hp.x, cy = e.y + gs.heart.y - MS * hp.y; ox = U.lerp(ox, cx, L.colK); oy = U.lerp(oy, cy, L.colK); }
    const toW = (q) => ({ x: ox + msx * q.x, y: oy + MS * q.y });
    const toL = (q) => ({ x: (q.x - ox) / msx, y: (q.y - oy) / MS });
    if (!ghost) {
      e.boxPos = toW(gm.box); e.handW = toW(gm.hdF); e.lipsW = toW(gm.lips); e.chestW = toW(gm.chest);
      e.sHandW = { f: { x: baseX + f * gs.aF.c.x, y: e.y + gs.aF.c.y }, b: { x: baseX + f * gs.aB.c.x, y: e.y + gs.aB.c.y } };
      e.sChestW = { x: baseX + f * gs.chest.x, y: e.y + gs.chest.y };
      e.heartW = { x: baseX + f * gs.heart.x, y: e.y + gs.heart.y };
      if (dt > 0) updScarf(e, gm, toW, dt, p);
    }
    L.scT = e.scT.inited ? e.scT.p.map(toL) : null; L.scF = e.scF.inited ? e.scF.p.map(toL) : null;
    const M = { t, vx: e.vx * f, crankA: e.crankA };
    const shadowTf = () => { if (e.worldTf) ctx.setTransform(e.worldTf); ctx.translate(baseX, e.y); ctx.scale(f, 1); if (e.phase >= 3 && e.hitK > 0) ctx.translate(-5 * e.hitK * (e.hitDir || 1) * f, 0); };
    // ---------- the shadow (clean transform: Mira's hit-jolt does not shake it) ----------
    if (!ghost) {
      ctx.save(); shadowTf();
      const mloc = { x: (ox - baseX) * f + gm.chest.x * MS * L.ts, y: oy - e.y + gm.chest.y * MS };
      drawShadowProfile(ctx, e, p, gs, L, L.sAlpha, mloc, gm.T(-3.2, -26.2), heart);
      ctx.restore();
    }
    // ---------- Mira ----------
    const mA = L.miraA * L.alpha;
    if (mA > 0.01) {
      if (!ghost && L.colK < 0.5) {   // her light on the floor + a soft contact shade
        const fy = e.y, lift = clamp01(p.hov / 160), hx = ox + msx * gm.hip.x;
        shade(ctx, hx, fy + 2, 36 - 14 * lift, 7, '#120a26', 0.32 * (1 - lift * 0.6) * mA);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= mA * (0.5 + 0.3 * L.warm);
        ctx.drawImage(sprite(L.pal.aura, true), hx - 70, fy - 9, 140, 18); ctx.restore();
      }
      if (!ghost) drawHaloNotes(ctx, e, toW(gm.chest), false, L);
      ctx.save(); ctx.globalAlpha *= mA;
      ctx.translate(ox, oy); ctx.scale(msx, MS);
      if (heart && L.beat > 0.02) { const k = 1 + 0.04 * L.beat; ctx.translate(gm.hip.x, gm.hip.y); ctx.scale(k, k); ctx.translate(-gm.hip.x, -gm.hip.y); }
      drawMira(ctx, M, p, gm, L);
      ctx.restore();
      if (!ghost) drawHaloNotes(ctx, e, toW(gm.chest), true, L);
      if (L.mote > 0.01 && !ghost) { const c = toW(gm.chest); glow(ctx, c.x, c.y, 40, GOLDL, L.mote); glow(ctx, c.x, c.y, 12, '#ffffff', L.mote); }
    }
    if (ghost) return;
    // ---------- the last movement: the stave caging her, and the arm that holds her, in front ----------
    if (heart) { ctx.save(); shadowTf(); drawHeartFront(ctx, e, p, gs, L); ctx.restore(); }
    // ---------- her brush of light (P2) ----------
    if (e.state === 'atk' && e.atk === brush && e.st > 0.64 && e.st < 0.95) drawBrush(ctx, e, gm, toW);
    // ---------- tell glow at a far source (shadow hands, heart) ----------
    if (e.tellT > 0 && e.state === 'atk') { const w = BOSS.weapon(e); glow(ctx, w.x, w.y, 70, e.tellCol === 'red' ? CRIM : '#ffffff', Math.min(1, e.tellT * 1.5)); }
    // ---------- box notes, late hazards, daze, debug ----------
    for (const n of e.boxNotes) noteGlyph(ctx, n.x + Math.sin(n.t * 5) * 3, n.y, n.s, GOLDL, Math.sin(clamp01(n.t / 1.6) * PI) * 0.8, -0.2 + Math.sin(n.t * 3) * 0.2);
    ctx.save(); if (e.worldTf) ctx.setTransform(e.worldTf);
    for (const h of G.game.hazards) if (h.late && h.owner === e) { ctx.save(); h.paint(ctx, h); ctx.restore(); }
    if (L.broken) drawDazed(ctx, e, e.phase >= 3 ? e.heartW : toW(gm.hc));
    if (DBG) drawDebug(ctx, e);
    ctx.restore();
  }
  function pushHist(e, p, g) {
    e.hist.push({ t: e.t, lean: p.lean, head: p.head, vf: sub(g.hdF, g.shF), vb: sub(g.hdB, g.shB), legs: [p.tF, p.kF, p.tB, p.kB], ft: p.ft });
    if (e.hist.length > 40) e.hist.shift();
  }
  function histAt(e, t) { const H = e.hist; if (!H.length) return null; for (let i = H.length - 1; i >= 0; i--) if (H[i].t <= t) return H[i]; return H[0]; }
  function updScarf(e, g, toW, dt, p) {
    const f = e.facing, t = e.t;
    const back = toW(g.T(-3.2, -26.2)), knot = toW(g.T(5.6, -24.6));
    const wind = -e.vx * 2.2 + Math.sin(t * 1.3) * 260 + Math.sin(t * 2.9) * 120;
    e.scT.update(back.x, back.y, f, Math.min(dt, 1 / 30), wind - f * 160, 1.35);
    e.scF.update(knot.x, knot.y, f, Math.min(dt, 1 / 30), wind * 0.3, 3.3);
  }

  /* ---------------- Mira ---------------- */
  function drawMira(ctx, M, p, g, L) {
    const C = L.pal;
    if (!L.ghost) {
      if (!LQ()) glow(ctx, g.hip.x, g.hip.y - 14, 120, C.aura, 0.28 + 0.1 * L.warm);
      glow(ctx, g.chest.x, g.chest.y - 8, 80 + 30 * L.teach + 40 * L.burst, C.aura, 0.55 + 0.3 * L.teach + 0.2 * p.glow + 0.4 * L.burst);
    }
    if (L.scT) drawScarfRibbon(ctx, L.scT, 3.4, 2.6, true);
    drawArmM(ctx, g.shB, g.elB, g.hdB, 0, C, false);
    drawLegM(ctx, g.hjB, g.knB, g.anB, C, false);
    drawLegM(ctx, g.hjF, g.knF, g.anF, C, true);
    drawDress(ctx, M, p, g, C, L);
    drawHeadM(ctx, M, p, g, C, L);
    drawScarfWrap(ctx, g, L);
    drawBox(ctx, M, p, g, L);
    drawArmM(ctx, g.shF, g.elF, g.hdF, p.ft, C, true);
    if (L.breath > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const q = add(g.lips, { x: 4 + 10 * (1 - L.breath), y: -8 * (1 - L.breath) }); ctx.globalAlpha *= L.breath * 0.6; ctx.drawImage(sprite('#fff4dc', true), q.x - 7, q.y - 5, 14, 10); ctx.restore(); }
  }
  function drawLegM(ctx, hj, kn, an, C, front) {
    Rig.limbChain(ctx, [hj, kn, an], [2.8, 2.15, 1.55], front ? C.tights : U.mixHex(C.tights, C.dressS, 0.35));
    const sd = sub(an, kn), L0 = Math.hypot(sd.x, sd.y) || 1, ux = sd.x / L0 + 0.55, uy = sd.y / L0, m = Math.hypot(ux, uy) || 1, dx = ux / m, dy = uy / m;
    const nx = -dy, ny = dx, toe = { x: an.x + dx * 6.2, y: an.y + dy * 6.2 };
    ctx.beginPath();
    ctx.moveTo(an.x - dx * 1.6 + nx * 2.2, an.y - dy * 1.6 + ny * 2.2);
    ctx.quadraticCurveTo(toe.x + nx * 2.6, toe.y + ny * 2.6, toe.x + dx * 1.2, toe.y + dy * 1.2);
    ctx.quadraticCurveTo(toe.x - nx * 2.4, toe.y - ny * 2.4, an.x - dx * 1.4 - nx * 2.2, an.y - dy * 1.4 - ny * 2.2);
    ctx.closePath(); ctx.fillStyle = front ? C.shoe : U.mixHex(C.shoe, '#2a1640', 0.3); ctx.fill(); ink(ctx, 1.1);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(an.x + nx * 2.1 + dx * 1.2, an.y + ny * 2.1 + dy * 1.2); ctx.lineTo(an.x - nx * 2.1 + dx * 1.6, an.y - ny * 2.1 + dy * 1.6); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(toe.x - dx * 2 + nx * 1.1, toe.y - dy * 2 + ny * 1.1, 0.7, 0, TAU); ctx.fill();
  }
  function drawArmM(ctx, sh, el, hd, ft, C, front) {
    const skin = front ? C.skin : U.mixHex(C.skin, C.skinS, 0.35);
    Rig.limbChain(ctx, [sh, el, hd], [2.4, 2.0, 1.55], skin);
    const sl = lerpP(sh, el, 0.26), a = Math.atan2(el.y - sh.y, el.x - sh.x);
    ctx.save(); ctx.translate(sl.x, sl.y); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(-0.4, 0, 6, 4.5, 0, 0, TAU); ctx.fillStyle = front ? C.dress : C.dressS; ctx.fill(); ink(ctx, 1);
    if (front) { ctx.fillStyle = U.rgba(C.dressL, 0.7); ctx.beginPath(); ctx.ellipse(-1, -1.8, 3.6, 1.4, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = U.rgba(C.collar, 0.95); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(4.4, 0, 1.2, 3.8, 0, -PI / 2, PI / 2); ctx.stroke();
    ctx.restore();
    drawHandM(ctx, el, hd, ft, skin);
  }
  function drawHandM(ctx, el, hd, ft, skin) {
    const a = Math.atan2(hd.y - el.y, hd.x - el.x);
    ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(a);
    if (ft === 1) {   // a finger to her lips
      ctx.beginPath(); ctx.ellipse(1.4, 0.3, 2.6, 2.1, 0, 0, TAU); ctx.fillStyle = skin; ctx.fill(); ink(ctx, 0.9);
      ctx.save(); ctx.translate(2.2, -1.2); ctx.rotate(-1.35);
      ctx.beginPath(); ctx.ellipse(2.4, 0, 2.8, 0.85, 0, 0, TAU); ctx.fillStyle = skin; ctx.fill(); ink(ctx, 0.8); ctx.restore();
    } else if (ft === 2) {   // an open palm, fingers spread
      ctx.fillStyle = skin;
      for (let i = 0; i < 4; i++) { const fa = -0.5 + i * 0.32; ctx.save(); ctx.translate(2.2, 0); ctx.rotate(fa); ctx.beginPath(); ctx.ellipse(2.2, 0, 2.3, 0.75, 0, 0, TAU); ctx.fill(); ink(ctx, 0.7); ctx.restore(); }
      ctx.beginPath(); ctx.ellipse(1.2, 0, 2.4, 2.2, 0, 0, TAU); ctx.fill(); ink(ctx, 0.9);
    } else {
      ctx.beginPath(); ctx.ellipse(1.6, 0, 2.6, 2.0, 0, 0, TAU); ctx.fillStyle = skin; ctx.fill(); ink(ctx, 0.9);
      ctx.beginPath(); ctx.ellipse(1.0, -1.7, 1.2, 0.7, -0.6, 0, TAU); ctx.fill(); ink(ctx, 0.6);
    }
    ctx.restore();
  }
  function drawDress(ctx, M, p, g, C, L) {
    const T = g.T, t = M.t, sw = Math.sin(t * 2.3), drag = U.clamp(-(M.vx || 0) / 260, -1, 1);
    const fl = 4.5 + sw * 1.4 + Math.abs(drag) * 2, hx = drag * 5;
    const pts = [T(4.3, -25.4), T(6.4, -18), T(5.8, -9), T(8.4, 1), T(15.2 + fl + hx, 15.6 + sw), T(9 + hx, 18.4 - sw * 0.5), T(1 + hx, 17.4 + sw * 0.4), T(-7 + hx, 18.3 - sw * 0.4), T(-14.6 - fl * 0.6 + hx, 15 + sw * 0.3), T(-8.2, 1), T(-5.6, -9), T(-5.4, -18.4), T(-3.2, -25.8)];
    // light wisps trailing from the hem (she is made of light; it drips off her like water)
    const drip = clamp01((p.hov - 4) / 16);
    if (!L.ghost && !LQ() && drip > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.globalAlpha *= drip; ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = T(-10 + i * 7 + hx, 17), len = (14 + 8 * Math.sin(t * 1.7 + i * 1.9)) * drip, sx = Math.sin(t * 2.1 + i) * 3 - hx * 0.6;
        ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(a.x + sx, a.y + len * 0.6, a.x + sx * 1.6, a.y + len);
      }
      ctx.strokeStyle = U.rgba(C.aura, 0.32); ctx.lineWidth = 3.2; ctx.stroke(); ctx.strokeStyle = U.rgba('#ffffff', 0.4); ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    smoothPath(ctx, pts); ctx.fillStyle = C.dress; ctx.fill();
    ctx.save(); smoothPath(ctx, pts); ctx.clip();
    const a = T(0.6, -27), b = T(-1.2, 3), c = T(2 + hx, 21), d = T(-30, 30), e2 = T(-30, -30);
    ctx.fillStyle = C.dressS; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.lineTo(e2.x, e2.y); ctx.closePath(); ctx.fill();
    // underside of the skirt
    const u0 = T(-16, 13), u1 = T(16 + fl, 13);
    ctx.fillStyle = U.rgba(C.dressS, 0.55); ctx.beginPath(); ctx.moveTo(u0.x, u0.y); ctx.lineTo(u1.x, u1.y); const u2 = T(20, 24), u3 = T(-20, 24); ctx.lineTo(u2.x, u2.y); ctx.lineTo(u3.x, u3.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = U.rgba(C.dressL, 0.85); ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
    [T(4.6, -24), T(6.1, -18), T(5.5, -9), T(8.1, 1), T(13.6 + fl + hx, 14)].forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
    // sash
    const s0 = T(-6, -11.2), s1 = T(6.6, -11.2), s2 = T(6.4, -8.2), s3 = T(-5.8, -8.2);
    ctx.fillStyle = U.mixHex(C.dressS, '#2a1640', 0.15); ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.lineTo(s3.x, s3.y); ctx.closePath(); ctx.fill();
    // folds
    ctx.strokeStyle = 'rgba(11,6,18,0.38)'; ctx.lineWidth = 0.7; ctx.beginPath();
    for (const [x0, x1] of [[1.2, 4], [-3.5, -6.5], [5, 10]]) { const q0 = T(x0, -6), q1 = T(x1 + hx, 17); ctx.moveTo(q0.x, q0.y); ctx.quadraticCurveTo((q0.x + q1.x) / 2 + 1.5, (q0.y + q1.y) / 2, q1.x, q1.y); }
    ctx.stroke();
    ctx.restore();
    smoothPath(ctx, pts); ink(ctx, 1.25);
    // hem lace
    ctx.fillStyle = U.rgba(C.collar, 0.9); ctx.beginPath();
    for (let i = 0; i < 7; i++) { const q = T(-12 + i * 4.2 + hx, 16.6 + Math.sin(i * 1.7 + t * 2.3) * 0.6); ctx.moveTo(q.x + 0.75, q.y); ctx.arc(q.x, q.y, 0.75, 0, TAU); }
    ctx.fill();
    // the sash bow at her back
    const bw = T(-6.2, -9.7);
    ctx.save(); ctx.translate(bw.x, bw.y); ctx.rotate(g.lean);
    ctx.fillStyle = U.mixHex(C.dressS, '#2a1640', 0.15);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-2.2, s * 1.8, 2.6, 1.4, s * 0.5, 0, TAU); ctx.fill(); ink(ctx, 0.7); }
    ctx.beginPath(); ctx.moveTo(-0.5, 0.5); ctx.quadraticCurveTo(-3, 5, -2 + Math.sin(t * 2) * 1.5, 9); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
    // Peter Pan collar + buttons
    const cl = T(3.3, -24.8);
    ctx.save(); ctx.translate(cl.x, cl.y); ctx.rotate(g.lean - 0.2);
    ctx.beginPath(); ctx.ellipse(0, 0, 3.8, 2.1, 0, 0, TAU); ctx.fillStyle = C.collar; ctx.fill(); ink(ctx, 0.8); ctx.restore();
    ctx.beginPath();
    for (const yy of [-21, -16.6, -12.8]) { const q = T(5.3, yy); ctx.moveTo(q.x + 0.62, q.y); ctx.arc(q.x, q.y, 0.62, 0, TAU); }
    ctx.fillStyle = GOLD; ctx.fill(); ink(ctx, 0.4);
  }
  function drawHeadM(ctx, M, p, g, C, L) {
    const t = M.t, puff = clamp01(p.puff), eyes = clamp01(p.eyes);
    ctx.save(); ctx.translate(g.hc.x, g.hc.y); ctx.rotate(g.ha);
    const sway = Math.sin(t * 1.6) * 0.6 - (M.vx || 0) * 0.004;
    // back hair (the bob)
    ctx.beginPath();
    ctx.moveTo(1.5, -12.4);
    ctx.bezierCurveTo(-6.5, -13.2, -12.6, -7.6, -12.4, -0.6);
    ctx.bezierCurveTo(-12.3, 4.6, -11.2 + sway, 8.4, -12.6 + sway, 11.2);
    ctx.quadraticCurveTo(-9, 11.6, -6.4, 10.2);
    ctx.lineTo(-3.4, 8.6); ctx.lineTo(-1.4, 1.5); ctx.closePath();
    ctx.fillStyle = C.hairS; ctx.fill(); ink(ctx, 1.1);
    // face + the round cheek of a held breath (outline pass, then fill: one silhouette)
    const face = () => {
      ctx.beginPath();
      ctx.moveTo(-1.8, -10.2);
      ctx.bezierCurveTo(3.6, -11.2, 8.2, -8.6, 8.9, -3.8);
      ctx.quadraticCurveTo(9.1, -2.2, 9.0, -1.2);
      ctx.quadraticCurveTo(10.4, 0.6, 10.8, 1.6);
      ctx.quadraticCurveTo(10.6, 2.4, 9.6, 2.5);
      ctx.quadraticCurveTo(10.0, 3.4, 9.7, 4.2);
      ctx.quadraticCurveTo(9.3, 4.6, 9.6, 5.2);
      ctx.quadraticCurveTo(9.6, 6.6, 8.2, 7.8);
      ctx.quadraticCurveTo(5.8, 9.6, 2.6, 9.2);
      ctx.lineTo(-0.4, 8.2); ctx.lineTo(-2, 2); ctx.closePath();
      const cr = 2.8 + puff * 1.05, cx = 6.5 + puff * 0.9;
      ctx.moveTo(cx + cr, 3.9); ctx.ellipse(cx, 3.9, cr, cr * 0.92, 0, 0, TAU);
    };
    face(); ctx.lineWidth = 2.3; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
    face(); ctx.fillStyle = C.skin; ctx.fill();
    ctx.save(); face(); ctx.clip();
    ctx.fillStyle = C.skinS; ctx.beginPath(); ctx.moveTo(-3, -11); ctx.quadraticCurveTo(3.4, -4, 2.4, 3); ctx.quadraticCurveTo(3.6, 7.8, 8.8, 8.8); ctx.lineTo(8, 12); ctx.lineTo(-3, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = U.rgba('#ffffff', 0.55); ctx.beginPath(); ctx.ellipse(7.2, -6.4, 1.6, 0.8, -0.4, 0, TAU); ctx.fill();
    ctx.restore();
    // blush
    ctx.fillStyle = U.rgba(C.blush, 0.3 + 0.35 * puff); ctx.beginPath(); ctx.ellipse(6.9 + puff * 0.6, 4.6, 2.5, 1.4, 0, 0, TAU); ctx.fill();
    // eyes: squeezed shut while she holds her breath; open in the duet
    if (eyes < 0.12) {
      ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 1.05;
      ctx.beginPath(); ctx.moveTo(4.2, -1.3); ctx.quadraticCurveTo(5.8, 0.3, 7.6, -0.9); ctx.stroke();
      ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(7.3, -0.8); ctx.lineTo(8.4, -0.3); ctx.moveTo(6.6, -0.3); ctx.lineTo(7.1, 0.6); ctx.stroke();
      if (puff > 0.5) { ctx.globalAlpha *= 0.7; ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(4.7, -2.8); ctx.quadraticCurveTo(6.0, -2.2, 7.4, -2.7); ctx.stroke(); ctx.globalAlpha /= 0.7; }
    } else {
      const k = eyes;
      ctx.beginPath(); ctx.moveTo(4.2, -1.2); ctx.quadraticCurveTo(5.9, -1.2 - 2.4 * k, 7.9, -1.6 * k - 0.1); ctx.quadraticCurveTo(6.2, -1.2 + 1.7 * k, 4.2, -1.2); ctx.closePath();
      ctx.fillStyle = '#fbf7ff'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = C.iris; ctx.beginPath(); ctx.ellipse(6.5, -1.3, 1.35, 1.7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(6.8, -1.3, 0.6, 0.9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(7.05, -1.95, 0.45, 0, TAU); ctx.fill();
      ctx.restore();
      if (!L.ghost) glow(ctx, 6.5, -1.3, 4, C.iris, 0.5 * k);
      ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(4.0, -1.1); ctx.quadraticCurveTo(5.9, -1.3 - 2.5 * k, 8.1, -1.8 * k - 0.1); ctx.lineTo(8.9, -2.3 * k - 0.1); ctx.stroke();
    }
    // brows: worried (raised inner end)
    ctx.strokeStyle = C.hairS; ctx.lineWidth = 1.0; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(4.4, -4.3 - 0.2 * puff); ctx.quadraticCurveTo(6.2, -5.6 - 0.3 * puff, 8.0, -5.4 + 0.3 * eyes); ctx.stroke();
    // mouth
    ctx.strokeStyle = INK; ctx.lineWidth = 0.7;
    if (p.sm > 0.3) { ctx.beginPath(); ctx.moveTo(9.5, 4.9); ctx.quadraticCurveTo(8.9, 6.0 + p.sm * 0.4, 7.8, 5.3); ctx.stroke(); }
    else if (puff > 0.4) { ctx.beginPath(); ctx.moveTo(9.5, 5.2); ctx.lineTo(8.3, 5.4); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(9.5, 5.1); ctx.quadraticCurveTo(8.9, 5.5, 8.2, 5.3); ctx.stroke(); }
    // front hair: fringe and the side lock over the ear
    const front = () => {
      ctx.beginPath();
      ctx.moveTo(-3, -12.6);
      ctx.bezierCurveTo(3.5, -14.4, 9.2, -11, 9.8, -5.6);
      ctx.lineTo(8.6, -4.4); ctx.lineTo(7.7, -5.9); ctx.lineTo(6.5, -4.0); ctx.lineTo(5.3, -5.9); ctx.lineTo(3.9, -4.3); ctx.lineTo(3.0, -6.4);
      ctx.quadraticCurveTo(0.6, -6.0, -0.3, -3.0);
      ctx.quadraticCurveTo(0.4, 2.0, 0.2 + sway * 0.3, 7.6);
      ctx.quadraticCurveTo(-1.8, 10.2, -4.4 + sway * 0.5, 10.6);
      ctx.quadraticCurveTo(-3.6, 4, -6.4, -2);
      ctx.closePath();
    };
    front(); ctx.fillStyle = C.hair; ctx.fill();
    ctx.save(); front(); ctx.clip();
    ctx.fillStyle = C.hairS; ctx.beginPath(); ctx.moveTo(-7, -2); ctx.quadraticCurveTo(-1, -4, 1, 11); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.hairL; ctx.globalAlpha *= 0.85; ctx.beginPath(); ctx.moveTo(-2, -12.2); ctx.quadraticCurveTo(4, -13.6, 8, -9.6); ctx.lineTo(7, -8.6); ctx.quadraticCurveTo(3.4, -11.6, -1.8, -10.8); ctx.closePath(); ctx.fill();
    ctx.restore();
    front(); ink(ctx, 1.05);
    ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(6.4, -9.4); ctx.quadraticCurveTo(3, -9.6, 0.4, -6.6); ctx.moveTo(-1.6, -9.6); ctx.quadraticCurveTo(-2.4, -4, -1.6, 6); ctx.stroke();
    // Barrow's bell: a tiny brass bell clipped in her hair
    ctx.save(); ctx.translate(-4.4, -10.6); ctx.rotate(-0.3 + Math.sin(t * 2.4) * 0.12);
    ctx.fillStyle = SCARF; ctx.beginPath(); ctx.moveTo(0, -2.2); ctx.lineTo(-2.6, -3.6); ctx.lineTo(-2.4, -1.2); ctx.closePath(); ctx.moveTo(0, -2.2); ctx.lineTo(2.6, -3.6); ctx.lineTo(2.4, -1.2); ctx.closePath(); ctx.fill(); ink(ctx, 0.5);
    ctx.beginPath(); ctx.moveTo(-1.7, 1.3); ctx.quadraticCurveTo(-1.8, -2.4, 0, -2.4); ctx.quadraticCurveTo(1.8, -2.4, 1.7, 1.3); ctx.closePath(); ctx.fillStyle = BRASS; ctx.fill(); ink(ctx, 0.6);
    ctx.fillStyle = BRASSL; ctx.beginPath(); ctx.ellipse(-0.6, -0.8, 0.45, 1.0, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = BRASSD; ctx.beginPath(); ctx.arc(0, 1.9, 0.6, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
  }
  function drawScarfRibbon(ctx, pts, w0, w1, tail) {
    if (!pts || pts.length < 2) return;
    Rig.ribbon(ctx, pts, w0 + 1.1, w1 + 1.1, INK);
    Rig.ribbon(ctx, pts, w0, w1, SCARF);
    Rig.ribbon(ctx, offsetPts(pts, (u) => -U.lerp(w0, w1, u) * 0.45), w0 * 0.5, w1 * 0.5, SCARFD);
    ctx.strokeStyle = 'rgba(80,10,24,0.55)'; ctx.lineWidth = 0.55; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = U.lerp(w0, w1, i / (pts.length - 1)) * 0.8;
      ctx.moveTo(pts[i].x - dy / d * w, pts[i].y + dx / d * w); ctx.lineTo(pts[i].x + dy / d * w, pts[i].y - dx / d * w);
    }
    ctx.stroke();
    ctx.strokeStyle = U.rgba(SCARFL, 0.75); ctx.lineWidth = 0.7; ctx.beginPath();
    offsetPts(pts, (u) => U.lerp(w0, w1, u) * 0.55).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
    if (tail) {   // Barrow's old scarf: two cream stripes near the end, a short fringe
      const n = pts.length;
      ctx.beginPath();
      for (const k of [n - 3, n - 2]) {
        const a = pts[k], b = pts[k + 1], m = lerpP(a, b, 0.5), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = w1 * 0.95;
        ctx.moveTo(m.x - dy / d * w, m.y + dx / d * w); ctx.lineTo(m.x + dy / d * w, m.y - dx / d * w);
      }
      ctx.strokeStyle = '#f3e3c8'; ctx.lineWidth = 1.5; ctx.lineCap = 'butt'; ctx.stroke();
      const a = pts[n - 2], b = pts[n - 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = -2.5; i <= 2.5; i += 1) {
        const s = { x: b.x - uy * i * w1 * 0.36, y: b.y + ux * i * w1 * 0.36 };
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + ux * 3.2 + Math.sin(i * 2.1) * 0.5, s.y + uy * 3.2 + Math.cos(i * 1.7) * 0.5);
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); ctx.strokeStyle = SCARFD; ctx.lineWidth = 0.7; ctx.stroke();
    }
  }
  function drawScarfWrap(ctx, g, L) {
    const T = g.T;
    if (L.scF) drawScarfRibbon(ctx, L.scF, 2.8, 2.4, true);
    const c = T(0.8, -26.6);
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(g.lean - 0.1);
    ctx.beginPath(); ctx.ellipse(0, 0, 7.4, 3.5, 0, 0, TAU); ctx.fillStyle = SCARF; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = SCARFD; ctx.fillRect(-9, 0.8, 18, 4); ctx.restore();
    ink(ctx, 1.1);
    ctx.strokeStyle = 'rgba(80,10,24,0.55)'; ctx.lineWidth = 0.55;
    for (let i = -5; i <= 5; i += 2) { ctx.beginPath(); ctx.moveTo(i, -2.8 + Math.abs(i) * 0.12); ctx.lineTo(i + 0.4, 2.8 - Math.abs(i) * 0.12); ctx.stroke(); }
    ctx.strokeStyle = U.rgba(SCARFL, 0.8); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(0, -0.6, 5.6, 2.2, 0, PI * 1.1, PI * 1.9); ctx.stroke();
    // the knot
    ctx.beginPath(); ctx.ellipse(5.2, 1.8, 2.6, 2.2, 0.4, 0, TAU); ctx.fillStyle = SCARF; ctx.fill(); ink(ctx, 0.9);
    ctx.restore();
  }
  function drawBox(ctx, M, p, g, L) {
    const b = g.box, a = g.ba, lid = clamp01(p.lid);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
    if (lid > 0.1 && !L.ghost) glow(ctx, 0, -6, 20 + 12 * lid, GOLD, 0.6 * lid);
    // the lid: a flap hinged at the back edge; open, it shows the little sunset painted inside
    const la = lid * 1.75, lh = 8.6 * Math.sin(la), lb = -4.2, lean = Math.cos(la) * 2.2;
    ctx.beginPath(); ctx.moveTo(-8, lb); ctx.lineTo(8, lb); ctx.lineTo(7.4 - lean, lb - lh - 0.4); ctx.lineTo(-7.4 - lean, lb - lh - 0.4); ctx.closePath();
    ctx.fillStyle = BRASS; ctx.fill(); ink(ctx, 0.8);
    if (lid > 0.25 && la < PI / 2 + 0.3) {
      const k = clamp01((lid - 0.25) / 0.3), h2 = lh - 2.4;
      if (h2 > 1) {
        ctx.save(); ctx.globalAlpha *= k;
        ctx.beginPath(); ctx.moveTo(-6.4, lb - 1.2); ctx.lineTo(6.4, lb - 1.2); ctx.lineTo(6 - lean, lb - 1.2 - h2); ctx.lineTo(-6 - lean, lb - 1.2 - h2); ctx.closePath();
        ctx.fillStyle = '#ff9f70'; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.fillStyle = '#ffd59a'; ctx.fillRect(-7, lb - 1.2 - h2, 14, h2 * 0.45);
        ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(2 - lean * 0.5, lb - 1.2 - h2 * 0.42, Math.min(1.7, h2 * 0.28), 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a2440'; ctx.beginPath(); ctx.moveTo(-7, lb - 1.2); ctx.lineTo(-7, lb - 1.2 - h2 * 0.3); ctx.lineTo(-3.5, lb - 1.2 - h2 * 0.3); ctx.lineTo(-2.4, lb - 1.2 - h2 * 0.55); ctx.lineTo(-1.3, lb - 1.2 - h2 * 0.3); ctx.lineTo(7, lb - 1.2 - h2 * 0.22); ctx.lineTo(7, lb - 1.2); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = BRASSD; ctx.lineWidth = 0.6; ctx.stroke();
        ctx.restore();
      }
    }
    // the comb and cylinder, glowing, when open
    if (lid > 0.2) { ctx.strokeStyle = U.rgba(GOLDL, 0.9 * lid); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-6.6, -4.3); ctx.lineTo(6.6, -4.3); ctx.stroke(); ctx.lineWidth = 0.5; for (let i = -6; i <= 6; i += 1.5) { ctx.beginPath(); ctx.moveTo(i, -4.3); ctx.lineTo(i, -5.4 - (i % 3 === 0 ? 0.6 : 0)); ctx.stroke(); } }
    // the body: brass with a lit top, an engraved panel and a little bell motif
    ctx.beginPath(); ctx.moveTo(-8, -4.2); ctx.lineTo(8, -4.2); ctx.lineTo(8.2, 4.6); ctx.quadraticCurveTo(8.2, 5.4, 7.4, 5.4); ctx.lineTo(-7.4, 5.4); ctx.quadraticCurveTo(-8.2, 5.4, -8.2, 4.6); ctx.closePath();
    ctx.fillStyle = BRASS; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = BRASSD; ctx.beginPath(); ctx.moveTo(-9, 2.4); ctx.lineTo(9, 3.4); ctx.lineTo(9, 6); ctx.lineTo(-9, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = BRASSL; ctx.fillRect(-9, -4.4, 18, 1.4);
    ctx.restore();
    ink(ctx, 1.0);
    ctx.strokeStyle = U.rgba(BRASSD, 0.9); ctx.lineWidth = 0.55; ctx.strokeRect(-6.2, -2.4, 12.4, 5.6);
    // feet
    ctx.fillStyle = BRASSD; for (const fx of [-6.2, 6.2]) { ctx.beginPath(); ctx.arc(fx, 5.6, 1.2, 0, PI); ctx.fill(); }
    // crank on the side face
    const ca = M.crankA, kx = Math.cos(ca) * 4.4, ky = 0.6 + Math.sin(ca) * 4.4;
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0.6); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.strokeStyle = BRASSL; ctx.lineWidth = 1.0; ctx.stroke();
    ctx.fillStyle = BRASS; ctx.beginPath(); ctx.arc(0, 0.6, 1.5, 0, TAU); ctx.fill(); ink(ctx, 0.6);
    ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.arc(kx, ky, 1.2, 0, TAU); ctx.fill(); ink(ctx, 0.5);
    ctx.restore();
  }

  /* ---------------- the shadow (profile) ---------------- */
  function drawPool(ctx, cx, rx, t, a) {
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.beginPath(); ctx.ellipse(cx, 1, rx, 15, 0, 0, TAU); ctx.fillStyle = VOID; ctx.fill();
    ctx.fillStyle = VOID;
    for (let i = 0; i < 9; i++) { const u = i / 8, x = cx - rx * 0.95 + u * rx * 1.9, r = 6 + ((i * 37) % 7) + Math.sin(t * 1.6 + i) * 1.5; ctx.beginPath(); ctx.ellipse(x, 1 + Math.sin(i * 2.1) * 6, r * 1.8, r * 0.6, 0, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(cx, 1, rx, 15, 0, 0, TAU); ink(ctx, 2.4);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = U.rgba(RIM, 0.45); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(cx, 0, rx * 0.86, 10, 0, PI * 1.08, PI * 1.92); ctx.stroke();
    for (let i = 0; i < 3; i++) { const k = (t * 0.4 + i / 3) % 1; ctx.fillStyle = U.rgba(LILAC, 0.5 * (1 - k)); ctx.beginPath(); ctx.arc(cx + Math.sin(i * 2.4 + t * 0.3) * rx * 0.6, -k * 60, 1.4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function shadowArm(ctx, A, pat, red, t, s) {
    if (!A) return;
    const thin = Math.max(0.55, 1 / Math.sqrt(A.k)), pts = curvePts(A.sh, A.el, A.wr, 8);
    const w0 = 2.5 * s * thin, w1 = U.lerp(1.65 * s, 0.32 * A.hs, A.w) * thin;
    Rig.ribbon(ctx, pts, w0 + 3.5, w1 + 3.5, red > 0.05 ? U.mixHex(INK, '#6a0a22', red) : INK);
    Rig.ribbon(ctx, pts, w0, w1, pat);
    shadowHand(ctx, A.wr, A.ang, A.hs, A.w > 0.5 ? 1 : 0.35, pat, red, A.pt);
  }
  function shadowHand(ctx, wr, ang, hs, open, pat, red, point) {
    const P = (u, v) => { const q = rot(u * hs, v * hs, ang); return { x: wr.x + q.x, y: wr.y + q.y }; };
    const path = new Path2D();
    const palm = [P(-0.2, -1.4), P(1.4, -1.85), P(2.55, -1.15), P(2.65, 1.05), P(1.5, 1.85), P(-0.2, 1.3)];
    smoothTo(path, palm);
    const spread = 0.12 + 0.2 * open, L = point ? [2.9, 0.9, 0.85, 0.75] : [1.7, 2.0, 1.9, 1.45];
    for (let i = 0; i < 4; i++) {
      const y0 = -1.15 + i * 0.74, a = point ? (i === 0 ? -1.3 : 0.9) : (i - 1.5) * spread, b0 = P(2.3, y0), d = rot(Math.cos(a) * L[i], Math.sin(a) * L[i], 0), b1 = P(2.3 + d.x, y0 + d.y);
      capsule(path, b0, b1, 0.45 * hs, 0.3 * hs);
    }
    const ta = -1.0 - 0.35 * open; capsule(path, P(0.9, -1.35), P(0.9 + Math.cos(ta) * 1.5, -1.35 + Math.sin(ta) * 1.5), 0.48 * hs, 0.32 * hs);
    if (red > 0.05) glow(ctx, P(1.8, 0).x, P(1.8, 0).y, hs * 4.2, CRIM, 0.55 * red);
    ctx.lineJoin = 'round'; ctx.strokeStyle = red > 0.05 ? U.mixHex(INK, '#7a0a26', red) : INK; ctx.lineWidth = 6; ctx.stroke(path);
    ctx.fillStyle = pat; ctx.fill(path);
    if (red > 0.05) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(CRIM, 0.85 * red); ctx.lineWidth = 2.2; ctx.stroke(path); ctx.restore(); }
    else { ctx.save(); ctx.clip(path); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(RIM, 0.4); ctx.lineWidth = 3; ctx.stroke(path); ctx.restore(); }
  }
  // her head as three silhouettes in head units (facing +x): the bob, the face, the fringe — reused ×4.6 by the shadow
  let HEADP = null;
  function headPaths() {
    if (HEADP) return HEADP;
    const back = new Path2D();
    back.moveTo(1.5, -12.4); back.bezierCurveTo(-6.5, -13.2, -12.6, -7.6, -12.4, -0.6); back.bezierCurveTo(-12.3, 4.6, -11.2, 8.4, -12.9, 11.4);
    back.quadraticCurveTo(-9, 11.9, -6.4, 10.2); back.lineTo(-3.4, 8.6); back.lineTo(-1.4, 1.5); back.closePath();
    const face = new Path2D();
    face.moveTo(-1.8, -10.2); face.bezierCurveTo(3.6, -11.2, 8.2, -8.6, 8.9, -3.8); face.quadraticCurveTo(9.1, -2.2, 9.0, -1.2); face.quadraticCurveTo(10.4, 0.6, 10.8, 1.6);
    face.quadraticCurveTo(10.6, 2.4, 9.6, 2.5); face.quadraticCurveTo(10.0, 3.4, 9.7, 4.2); face.quadraticCurveTo(9.3, 4.6, 9.6, 5.2); face.quadraticCurveTo(9.6, 6.6, 8.2, 7.8);
    face.quadraticCurveTo(5.8, 9.6, 2.6, 9.2); face.lineTo(-0.4, 8.2); face.lineTo(-2, 2); face.closePath();
    const fringe = new Path2D();
    fringe.moveTo(-3, -12.6); fringe.bezierCurveTo(3.5, -14.4, 9.2, -11, 9.8, -5.6); fringe.lineTo(8.6, -4.4); fringe.lineTo(7.7, -5.9); fringe.lineTo(6.5, -4.0); fringe.lineTo(5.3, -5.9); fringe.lineTo(3.9, -4.3); fringe.lineTo(3.0, -6.4);
    fringe.quadraticCurveTo(0.6, -6.0, -0.3, -3.0); fringe.quadraticCurveTo(0.4, 2.0, 0.2, 7.6); fringe.quadraticCurveTo(-1.8, 10.2, -4.4, 10.6); fringe.quadraticCurveTo(-3.6, 4, -6.4, -2); fringe.closePath();
    return (HEADP = [back, face, fringe]);
  }
  // the shadow's silhouette pieces (filled one by one so overlapping windings never punch holes)
  function shadowShapes(gs, p, t) {
    const s = gs.s, T = gs.T, out = [];
    const m = new DOMMatrix().translate(gs.hc.x, gs.hc.y).rotate(gs.ha * 180 / PI).scale(s);
    for (const hp of headPaths()) { const q = new Path2D(); q.addPath(hp, m); out.push(q); }
    const neck = new Path2D(); capsule(neck, T(0.4, -23), T(0.9, -29.5), 2.6 * s, 2.4 * s); out.push(neck);
    const sw = Math.sin(t * 1.5) * 1.2, fl = 1.32;
    const dress = new Path2D();
    const pool = (q, k) => (q.y > -6 * k ? { x: q.x, y: Math.min(q.y, 4) } : q);
    const kk = gs.kn, hem = [T(17 * fl, 16 + sw), T(10, 19.5 - sw * 0.4), T(1, 18.2 + sw * 0.3), T(-8, 19.4 - sw * 0.3), T(-17 * fl, 15.5 - sw * 0.6)].map((q, i) => {
      if (kk <= 0) return q;
      const fq = { x: [150, 90, 20, -60, -130][i] * s / SS, y: [2, 6, 5, 6, 2][i] };   // spread on the floor around her knees
      return pool(lerpP(q, fq, kk), kk);
    });
    smoothTo(dress, [T(4.3, -25.4), T(6.6, -18), T(6.0, -9), T(8.8, 1), ...hem, T(-8.6, 1), T(-5.8, -9), T(-5.6, -18.4), T(-3.2, -25.8)]);
    out.push(dress); out.dress = dress;
    const sl = (A, k) => { const c = lerpP(A.sh, A.el, 0.24), a = Math.atan2(A.el.y - A.sh.y, A.el.x - A.sh.x), P = new Path2D(); P.ellipse(c.x, c.y, 6.2 * s * k, 4.7 * s * k, a, 0, TAU); return P; };
    out.push(sl(gs.aB, 0.95));
    out.sleeveF = sl(gs.aF, 1);
    return out;
  }
  // a leg poured out of ink: thigh and shin like hers, then a stream that runs down into the pool
  function shadowLeg(ctx, Lg, s, pat, t, i) {
    const an = Lg.an, w = Math.sin(t * 1.4 + i * 2) * 10;
    const pts = [Lg.hj, lerpP(Lg.hj, Lg.kn, 0.5), Lg.kn, lerpP(Lg.kn, an, 0.5), an, { x: an.x - 8 + w * 0.4, y: an.y * 0.5 }, { x: an.x - 18 + w, y: -3 }];
    Rig.ribbon(ctx, pts, 3.0 * s + 3.5, 1.1 * s + 3.5, INK);
    Rig.ribbon(ctx, pts, 3.0 * s, 1.1 * s, pat);
  }
  function shadowEye(ctx, gs, open, t, size = 1) {
    const s = gs.s, H = (x, y) => { const q = rot(x * s, y * s, gs.ha); return { x: gs.hc.x + q.x, y: gs.hc.y + q.y }; };
    const c = H(6.3, -1.3);
    glow(ctx, c.x, c.y, 26 * size, '#cbbcff', 0.45 + 0.35 * open);
    ctx.save(); ctx.lineCap = 'round';
    if (open < 0.1) {
      const a = H(4.4, -1.2), m = H(6.0, 0.4), b = H(8.0, -0.9);
      ctx.strokeStyle = INK; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(m.x, m.y, b.x, b.y); ctx.stroke();
      ctx.strokeStyle = '#efe8ff'; ctx.lineWidth = 2.6; ctx.stroke();
      const l1 = H(7.6, -0.6), l2 = H(8.7, -0.1); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(l1.x, l1.y); ctx.lineTo(l2.x, l2.y); ctx.stroke();
    } else {
      const a = H(4.2, -1.2), u = H(6.1, -1.2 - 2.6 * open), b = H(8.3, -1.5), d = H(6.3, -1.2 + 1.8 * open);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(u.x, u.y, b.x, b.y); ctx.quadraticCurveTo(d.x, d.y, a.x, a.y); ctx.closePath();
      ctx.fillStyle = '#f7f3ff'; ctx.fill(); ink(ctx, 2.2);
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba('#b9a6ff', 0.5); ctx.beginPath(); ctx.arc(c.x, c.y, 3.2 * size, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // a ribbon with a width per point (cloth that twists as it flutters)
  function ribbonW(ctx, pts, ws, fill) {
    const n = pts.length, Lp = [], Rp = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      Lp.push({ x: pts[i].x - dy / d * ws[i], y: pts[i].y + dx / d * ws[i] }); Rp.push({ x: pts[i].x + dy / d * ws[i], y: pts[i].y - dx / d * ws[i] });
    }
    ctx.beginPath(); ctx.moveTo(Lp[0].x, Lp[0].y);
    for (let i = 1; i < n; i++) { const m = lerpP(Lp[i - 1], Lp[i], 0.5); ctx.quadraticCurveTo(Lp[i - 1].x, Lp[i - 1].y, m.x, m.y); }
    ctx.lineTo(Lp[n - 1].x, Lp[n - 1].y); ctx.lineTo(Rp[n - 1].x, Rp[n - 1].y);
    for (let i = n - 1; i > 0; i--) { const m = lerpP(Rp[i], Rp[i - 1], 0.5); ctx.quadraticCurveTo(Rp[i].x, Rp[i].y, m.x, m.y); }
    ctx.lineTo(Rp[0].x, Rp[0].y); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    return { Lp, Rp };
  }
  // her scarf, ×4.6: a broad banner of night that follows the real scarf, twisting as it flutters; a memory of red
  function shadowScarf(ctx, gs, pat, scT, nb, s, t) {
    if (!scT || !nb) return;
    const a = gs.T(-3.2, -26.2), n = scT.length;
    const pts = scT.map((q, i) => { const u = i / (n - 1); return { x: a.x + (q.x - nb.x) * s * (0.95 + 0.25 * u), y: a.y + (q.y - nb.y) * s * (0.95 + 0.25 * u) }; });
    const ws = pts.map((q, i) => { const u = i / (n - 1); return s * U.lerp(3.6, 4.6, u) * (0.42 + 0.58 * Math.abs(Math.cos(t * 1.7 - i * 0.55))); });
    ribbonW(ctx, pts, ws.map((w) => w + 4), INK);
    ribbonW(ctx, pts, ws, '#561230');
    if (!LQ()) { ctx.save(); ctx.globalAlpha *= 0.4; ribbonW(ctx, pts, ws, pat); ctx.restore(); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(232,84,108,0.55)'; ctx.lineWidth = 2.2; ctx.beginPath();
    pts.forEach((q, i) => { const b = pts[Math.min(n - 1, i + 1)], c = pts[Math.max(0, i - 1)], dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy) || 1, w = ws[i] * 0.78; const x = q.x + dy / d * w, y = q.y - dx / d * w; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.restore();
    // Barrow's two cream stripes, near the end
    ctx.lineCap = 'butt'; ctx.beginPath();
    for (const k of [n - 3, n - 2]) {
      const p0 = pts[k], p1 = pts[k + 1], m = lerpP(p0, p1, 0.5), dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy) || 1, w = (ws[k] + ws[k + 1]) / 2;
      ctx.moveTo(m.x - dy / d * w, m.y + dx / d * w); ctx.lineTo(m.x + dy / d * w, m.y - dx / d * w);
    }
    ctx.strokeStyle = 'rgba(232,214,190,0.55)'; ctx.lineWidth = 7; ctx.stroke();
    // a short, fine fringe
    const A = pts[n - 2], B = pts[n - 1], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, w = ws[n - 1];
    ctx.lineCap = 'round'; ctx.strokeStyle = '#3b0d22'; ctx.lineWidth = 2.6; ctx.beginPath();
    for (let i = -4; i <= 4; i++) { const o = { x: B.x - uy * i * w * 0.2, y: B.y + ux * i * w * 0.2 }; ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + ux * 11 + Math.sin(t * 3 + i) * 2, o.y + uy * 11 + Math.cos(t * 2.6 + i) * 2); }
    ctx.stroke();
  }
  function shadowInterior(ctx, gs, t, mloc, warm) {
    glow(ctx, mloc.x, mloc.y, 170, '#ffd9a0', 0.22 + 0.14 * warm);
    if (LQ()) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.3;
    const yy = (x, i) => gs.hip.y + 30 + x * 0.24 + i * 9 + Math.sin(x * 0.011 + t * 0.6) * 12;
    ctx.strokeStyle = U.rgba(LILAC, 0.2); ctx.beginPath();
    for (let i = 0; i < 5; i++) for (let x = -200; x <= 180; x += 20) { const y = yy(x, i); x === -200 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    for (let k = 0; k < 2; k++) { const x = ((t * 24 + k * 190) % 380) - 200; restGlyph(ctx, x, yy(x, 4) + 2, 0.28, 0, '#3c2c78', null, 0.55); }
    // twinkling stars: three brightness groups, one path each
    for (let gI = 0; gI < 3; gI++) {
      const tw = 0.5 + 0.5 * Math.sin(t * (1.3 + gI * 0.5) + gI * 2.1);
      ctx.beginPath();
      for (let i = gI; i < 12; i += 3) {
        const sx = ((i * 73) % 300) - 150, sy = gs.hip.y - 150 + ((i * 131) % 260), r = 4 * tw;
        ctx.moveTo(sx - r, sy); ctx.lineTo(sx, sy - 0.8); ctx.lineTo(sx + r, sy); ctx.lineTo(sx, sy + 0.8); ctx.closePath(); ctx.moveTo(sx, sy - r); ctx.lineTo(sx + 0.8, sy); ctx.lineTo(sx, sy + r); ctx.lineTo(sx - 0.8, sy); ctx.closePath();
      }
      ctx.fillStyle = U.rgba('#f4efff', 0.7 * tw); ctx.fill();
    }
    ctx.restore();
  }
  function drawShadowProfile(ctx, e, p, gs, L, a, mloc, nb, heart) {
    if (a <= 0.01) return;
    const t = e.t, s = gs.s, pat = skyPat(ctx), ss = p.ss * Math.max(0.3, gs.r);
    ctx.save(); ctx.globalAlpha *= a;
    drawPool(ctx, -10, 175 * ss, t, 1);
    if (gs.r > 0.2) {
      shadowScarf(ctx, gs, pat, L.scT, nb, s, t);
      shadowLeg(ctx, gs.lB, s, pat, t, 1);
      shadowArm(ctx, gs.aB, pat, L.redB, t, s * 0.92);
      shadowLeg(ctx, gs.lF, s, pat, t, 0);
      const shapes = shadowShapes(gs, p, t), all = new Path2D();
      for (const q of shapes) all.addPath(q);
      ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke(all);
      ctx.fillStyle = pat;
      for (const q of shapes) ctx.fill(q);
      ctx.save(); ctx.clip(shapes.dress); shadowInterior(ctx, gs, t, mloc, L.warm); ctx.restore();
      if (heart) {   // the heart: her light shining through the night it is wrapped in
        const hq = gs.heart, k = L.colK;
        glow(ctx, hq.x, hq.y, 230, '#ffd9a0', (0.32 + 0.25 * L.warm + 0.3 * L.beat) * k);
        ctx.save(); ctx.globalAlpha *= k; ctx.beginPath(); ctx.arc(hq.x, hq.y, 66, 0, TAU); ctx.fillStyle = 'rgba(16,8,40,0.55)'; ctx.fill(); ctx.restore();
        glow(ctx, hq.x, hq.y, 96, GOLD, (0.5 + 0.35 * L.beat + 0.25 * L.warm + 0.3 * (1 - L.cage)) * k);
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(RIM, 0.3); ctx.lineWidth = 2.4; ctx.stroke(all); ctx.restore();
      // the scarf's wrap at its neck
      const nc = gs.T(0.8, -26.4), wrap = new Path2D(); wrap.ellipse(nc.x, nc.y, 7.6 * s, 3.4 * s, gs.lean - 0.1, 0, TAU);
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(wrap); ctx.fillStyle = '#3b0d22'; ctx.fill(wrap);
      ctx.save(); ctx.globalAlpha *= 0.5; ctx.fillStyle = pat; ctx.fill(wrap); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(214,70,96,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(nc.x, nc.y - 2, 6 * s, 2.2 * s, gs.lean - 0.1, PI * 1.1, PI * 1.9); ctx.stroke(); ctx.restore();
      shadowEye(ctx, gs, clamp01(p.sE), t);
      nearArm(ctx, p, gs, L, pat, shapes.sleeveF);
      if (p.ob > 0.8 && gs.aB.w > 0.5 && gs.aB.c.y < -120) floorMark(ctx, gs.aB.c.x, gs.aB.hs, L.redB, gs.aB.w);
      if (!L.ghost && vdt() > 0 && Math.random() < 0.25) { const q = gs.T(U.rand(-8, 8), U.rand(-30, 14)); G.FX.ember(e.x + e.facing * (p.so + q.x), e.y + q.y, 1, Math.random() < 0.6 ? LILAC : '#8f7ad8', { w: 20, h: 20, up: 50 }); }
    }
    ctx.restore();
  }
  function nearArm(ctx, p, gs, L, pat, sleeve) {
    shadowArm(ctx, gs.aF, pat, L.redF, 0, gs.s);
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(sleeve); ctx.fillStyle = pat; ctx.fill(sleeve);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(RIM, 0.35); ctx.lineWidth = 2; ctx.stroke(sleeve); ctx.restore();
    if (p.of > 0.8 && gs.aF.w > 0.5 && gs.aF.c.y < -120) floorMark(ctx, gs.aF.c.x, gs.aF.hs, L.redF, gs.aF.w);
  }
  // the last movement: five lines of silence caging her heart (they part when it collapses), then the arm that holds her
  function drawHeartFront(ctx, e, p, gs, L) {
    const t = e.t, hq = gs.heart, R = 70, k = L.colK;
    ctx.save(); ctx.globalAlpha *= k;
    if (L.cage > 0.02) {
      ctx.save(); ctx.beginPath(); ctx.arc(hq.x, hq.y, R, 0, TAU); ctx.clip();
      ctx.translate(hq.x, hq.y); ctx.rotate(gs.lean * 0.6); ctx.globalAlpha *= L.cage; ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        const y = i * 15, bend = Math.sin(t * 1.1 + i) * 4 + 6, open = (1 - L.cage) * 30 * Math.sign(i || 1);
        ctx.strokeStyle = INK; ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(-R, y + open); ctx.quadraticCurveTo(0, y + bend + open, R, y + open); ctx.stroke();
        ctx.strokeStyle = U.rgba(LILAC, 0.8); ctx.lineWidth = 1.4; ctx.stroke();
      }
      // a rest drifting along the middle line
      restGlyph(ctx, ((t * 18) % (R * 2)) - R, 6, 0.22, 0, '#2c2058', U.rgba(LILAC, 0.7), 0.85);
      ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(GOLDL, 0.5 + 0.35 * L.beat); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(hq.x, hq.y, R - 2, 0, TAU); ctx.stroke();
    ctx.strokeStyle = U.rgba(GOLD, 0.25 + 0.3 * L.beat); ctx.lineWidth = 9; ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  function floorMark(ctx, x, hs, red, w) {
    ctx.save(); ctx.globalAlpha *= w;
    ctx.fillStyle = 'rgba(14,6,30,0.45)'; ctx.beginPath(); ctx.ellipse(x, 1, hs * 2.6, 9, 0, 0, TAU); ctx.fill();
    if (red > 0.05) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(CRIM, 0.75 * red); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(x, 1, hs * 2.6, 9, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  /* ---------------- extras: the halo of answers, her brush, the daze, debug ---------------- */
  function drawHaloNotes(ctx, e, c, front, L) {
    const n = Math.min(14, e.phraseN), t = e.t, list = [], fresh = [];
    for (let i = 0; i < n; i++) {
      const a = t * 0.7 + i / 14 * TAU, sn = Math.sin(a);
      if ((sn > 0) !== front) continue;
      const born = clamp01((t - (e.noteBorn[i] ?? -9)) / 0.5);
      const x = c.x + Math.cos(a) * 46 * (0.6 + 0.4 * born), y = c.y + sn * 14 - 6 + Math.sin(t * 2 + i) * 2 - (1 - born) * 20;
      (born < 1 ? fresh : list).push([x, y, -0.15, born]);
    }
    notesBatch(ctx, list, 0.8, front ? GOLDL : '#c9a678', front ? 1 : 0.7);
    for (const q of fresh) noteGlyph(ctx, q[0], q[1], 0.62 + 0.18 * q[3], GOLDL, q[3]);
    if (front && n > 0 && !LQ()) glow(ctx, c.x, c.y - 6, 60, GOLD, 0.12 + 0.012 * n);
    if (L.burst > 0.01 && front) { const r = 46 + (1 - L.burst) * 90; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(GOLDL, 0.8 * L.burst); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(c.x, c.y - 6, r, r * 0.32, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
  function drawBrush(ctx, e, g, toW) {
    const k = (e.st - 0.64) / 0.31, sh = toW(g.shF), f = e.facing, r = 80;
    const a0 = 0.62, a1 = U.lerp(0.62, -0.95, clamp01(k * 2.2)), fade = 1 - clamp01((k - 0.45) / 0.55);
    ctx.save(); ctx.translate(sh.x, sh.y); ctx.scale(f, 1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.arc(0, 0, r, a0, a1, true); ctx.arc(0, 0, r - 26, a1 + 0.2, a0 - 0.1, false); ctx.closePath();
    ctx.fillStyle = U.rgba('#fff3d6', 0.42 * fade); ctx.fill();
    ctx.strokeStyle = U.rgba('#ffffff', 0.9 * fade); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r, a0, a1, true); ctx.stroke();
    ctx.strokeStyle = U.rgba(GOLD, 0.6 * fade); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, r - 10, a0, a1, true); ctx.stroke();
    ctx.restore();
  }
  function drawDazed(ctx, e, c) {
    if (!c) return;
    const t = e.t;
    for (let i = 0; i < 3; i++) { const a = t * 2.4 + i * TAU / 3; restGlyph(ctx, c.x + Math.cos(a) * 26, c.y - 30 + Math.sin(a) * 7, 0.2, Math.sin(t * 3 + i) * 0.3, '#e8e0ff', null, 0.9); }
  }
  function drawDebug(ctx, e) {
    ctx.save(); ctx.lineWidth = 1.5;
    const b = e.box; ctx.strokeStyle = 'rgba(80,255,120,0.9)'; ctx.strokeRect(b.x, b.y, b.w, b.h);
    const a = e.atk;
    if (e.state === 'atk' && a) {
      for (const h of a.hits || []) { const bw = e.boxW(h.box); ctx.strokeStyle = e.st >= h.t0 && e.st <= h.t1 ? 'rgba(255,40,60,1)' : 'rgba(255,40,60,0.35)'; ctx.strokeRect(bw.x, bw.y, bw.w, bw.h); }
      const p = atkPose(e);
      if (p) for (const h of a.sh || []) { const { box } = handBox(e, p, h); ctx.strokeStyle = e.st >= h.t0 && e.st <= h.t1 ? 'rgba(255,150,0,1)' : 'rgba(255,150,0,0.3)'; ctx.strokeRect(box.x, box.y, box.w, box.h); }
    }
    for (const h of G.game.hazards) if (h.kind === 'c8_rest' && h.t >= h.warn) { const [W, H] = restWH(h), yb = Math.min(h.fy, restBottom(h)); ctx.strokeStyle = 'rgba(255,0,200,0.8)'; ctx.strokeRect(h.x - W / 2, yb - H, W, H); }
    ctx.restore();
  }

  /* ================================ the defeat: the shadow breaks into light, Mira kneels, alive ================================ */
  function spawnKneel(e, ctx, dev) {
    const f = e.facing, p0 = Object.assign({}, e.pose || POSE0);
    const from = e.phase >= 3 ? (e.heartW || { x: e.x, y: e.y - 262 }) : { x: e.x + f * MS * (p0.bx || 0), y: e.y - MS * (p0.hov + 38) };
    const W = {
      kind: 'c8_kneel', owner: null, t: 0, t0: gtime(), x: from.x, y: e.y, f, ph: e.phase, from, p0,
      gs0: geoS(p0, histAt(e, e.t - 0.13)), sbx: e.x + f * (p0.so || 0), fe: { t: e.t, x: e.x, facing: f },
      L0: { scT: null, redF: 0, redB: 0, warm: 1, colK: 0, beat: 0, cage: 0, ghost: true },
      scT: e.scT, scF: e.scF, warm0: e.warmShow, choice: null, choiceT: 0, m: { t: e.t, vx: 0, crankA: e.crankA },
      update() { }, draw: kneelDraw,
    };
    e.kneelH = W; G.game.hazards.push(W);
    if (dev) { e.remove = true; G.game.bossRef = null; }
    sfx('c8_death'); SIL.until = -1; unduck(0.8);
    G.FX.flash(from.x, from.y, 340, 0.7, '#ffffff'); G.FX.ring(from.x, from.y, 20, 560, 1.1, GOLDL, 8);
    G.FX.ember(from.x, from.y, LQ() ? 20 : 44, GOLDL, { w: 260, h: 300, up: 160 });
    if (ctx) { ctx.save(); if (e.worldTf) ctx.setTransform(e.worldTf); kneelDraw(ctx, W); ctx.restore(); }
  }
  function kneelChoice(fl) {
    if (!fl) return null;
    const c = fl.c8_ending_choice;
    if (c === 'encore' || c === 'solo' || c === 'fermata') return c;
    return fl.ending_encore ? 'encore' : fl.ending_solo ? 'solo' : fl.ending_fermata ? 'fermata' : null;
  }
  function kneelDraw(ctx, W) {
    const now = gtime(), T = now - W.t0, fl = G.game.save && G.game.save.flags;
    let ch = kneelChoice(fl);
    if (!ch && DEV.kneel && DEV.kneel !== '1' && T > 3.4) ch = DEV.kneel;
    if (ch && ch !== W.choice) { W.choice = ch; W.choiceT = Math.max(now, W.t0 + 2.6); sfx(ch === 'encore' ? 'c8_wake' : ch === 'solo' ? 'c8_fade' : 'c8_sleep'); }
    const dt = Math.min(vdt(), 1 / 30), f = W.f;
    W.m.t += dt; W.m.crankA += dt * 2;
    // 1 · the shadow breaks into light
    const dk = sm01(0, 2.6, T);
    if (dk < 1) {
      ctx.save();
      const pat = skyPat(ctx);
      ctx.translate(W.sbx, W.y); ctx.scale(f, 1);
      W.fe.t = W.m.t;
      drawShadowProfile(ctx, W.fe, W.p0, W.gs0, W.L0, 1 - dk, { x: 0, y: -200 }, null, false);
      // light floods its silhouette as it comes apart
      const shapes = shadowShapes(W.gs0, W.p0, W.m.t);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= (1 - dk) * (0.25 + 0.75 * dk); ctx.fillStyle = U.rgba('#ffe6b0', 0.9); for (const q of shapes) ctx.fill(q);
      ctx.restore();
      if (dt > 0 && Math.random() < (LQ() ? 0.35 : 0.8) * (1 - dk)) { const cx = W.sbx; G.FX.ember(cx + U.rand(-150, 150), W.y - U.rand(40, 420), 1, Math.random() < 0.5 ? GOLDL : LILAC, { w: 30, h: 30, up: 120 }); }
      glow(ctx, W.from.x, W.from.y, 220 * (1 - dk) + 60, GOLDL, 0.5 * (1 - dk) + 0.15);
    }
    // 2 · Mira floats down and kneels; then the ending decides
    const desc = sm01(0.3, 2.4, T), cT = W.choice ? now - W.choiceT : 0, cK = W.choice ? sm01(0, 2.2, cT) : 0;
    let p = lerpPose(W.ph >= 3 ? full(CURL) : W.p0, KNEEL, desc);
    if (W.choice === 'encore') p = lerpPose(p, STAND, cK);
    if (W.choice === 'fermata') p = lerpPose(p, SLEEP, cK);
    const br = Math.sin(W.m.t * 1.3);
    p.lean += br * 0.012 * desc; p.head += Math.sin(W.m.t * 0.7) * 0.03;
    if (W.choice !== 'encore') p.eyes = 0;
    const warm = U.lerp(W.warm0, 1, sm01(0.6, 2.6, T)), alpha = W.choice === 'solo' ? 1 - sm01(0.4, 3.4, cT) : 1;
    const g = geoM(p, W.m.crankA), hp0 = hipOff(W.ph >= 3 ? full(CURL) : W.p0);
    const o = lerpP({ x: W.from.x - f * MS * hp0.x, y: W.from.y - MS * hp0.y }, { x: W.x, y: W.y }, desc);
    // fermata: she lies down on her back, head away from Rinne, about her hip
    const lay = W.choice === 'fermata' ? cK : 0, la = -1.48 * lay, piv = { x: g.hip.x + 4 * lay, y: U.lerp(g.hip.y, -9, lay) };
    const R = (q) => (lay > 0 ? add(piv, rot(q.x - g.hip.x, q.y - g.hip.y, la)) : q);
    const toW = (q) => { const r = R(q); return { x: o.x + f * MS * r.x, y: o.y + MS * r.y }; };
    const toL = (q) => { const l = { x: (q.x - o.x) / (f * MS), y: (q.y - o.y) / MS }; return lay > 0 ? add(g.hip, rot(l.x - piv.x, l.y - piv.y, -la)) : l; };
    if (dt > 0) {
      const back = toW(g.T(-3.2, -26.2)), knot = toW(g.T(5.6, -24.6));
      W.scT.update(back.x, back.y, f, dt, Math.sin(W.m.t * 1.1) * 80 - f * 40, 1.6 + 0.6 * desc);
      W.scF.update(knot.x, knot.y, f, dt, 0, 3.3);
      for (const ch of [W.scT, W.scF]) for (const q of ch.p) if (q.y > W.y - 2) { q.y = W.y - 2; q.py = Math.max(q.py, q.y - 1); }   // her scarf pools on the stage
    }
    const breath = W.choice === 'solo' ? 0 : Math.max(0, Math.sin((T - 2.6) * TAU / 3.4)) * sm01(2.4, 3.2, T);
    const L = { pal: palOf(warm), warm, teach: W.choice === 'encore' ? 0.6 * cK : 0, burst: 0, alpha, ghost: false, scT: W.scT.inited ? W.scT.p.map(toL) : null, scF: W.scF.inited ? W.scF.p.map(toL) : null, breath: breath * (W.choice === 'fermata' ? 0.5 : 1) };
    if (alpha > 0.01) {
      shade(ctx, W.x, W.y + 2, 40, 7, '#120a26', 0.3 * desc * alpha);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= alpha * (0.4 + 0.3 * desc); ctx.drawImage(sprite(L.pal.aura, true), W.x - 80, W.y - 10, 160, 20); ctx.restore();
      ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(o.x, o.y); ctx.scale(f * MS, MS);
      if (lay > 0) { ctx.translate(piv.x, piv.y); ctx.rotate(la); ctx.translate(-g.hip.x, -g.hip.y); }
      drawMira(ctx, W.m, p, g, L);
      ctx.restore();
    }
    // 3 · what each ending leaves behind
    if (W.choice === 'encore' && cK > 0) {
      const b = toW(g.box);
      glow(ctx, b.x, b.y - 10, 60 + 20 * Math.sin(W.m.t * 2), GOLDL, 0.5 * cK);
      for (let i = 0; i < 5; i++) { const k = (W.m.t * 0.35 + i / 5) % 1; noteGlyph(ctx, b.x + Math.sin(k * 6 + i) * 18 + f * k * 24, b.y - 14 - k * 110, 0.7, GOLDL, Math.sin(k * PI) * cK, Math.sin(k * 5) * 0.3); }
    } else if (W.choice === 'solo') {
      if (dt > 0 && cT < 3.4 && Math.random() < 0.6) G.FX.ember(W.x + U.rand(-16, 16), W.y - U.rand(10, 80), 1, GOLDL, { w: 10, h: 10, up: 90 });
      // her music box stays on the stage, still faintly lit
      const b = { x: W.x + f * 16, y: W.y - 6 }, k = sm01(1.5, 3.4, cT);
      if (k > 0) { ctx.save(); ctx.globalAlpha *= k; ctx.translate(b.x, b.y); ctx.scale(f * MS, MS); drawBox(ctx, W.m, { lid: 0.35 }, { box: { x: 0, y: 0 }, ba: 0 }, { ghost: false }); ctx.restore(); glow(ctx, b.x, b.y - 6, 34, GOLD, 0.4 * k); }
    } else if (W.choice === 'fermata' && cK > 0) {
      const hd = toW(g.chest), x = hd.x, y = hd.y - 46 + Math.sin(W.m.t * 0.8) * 3;
      ctx.save(); ctx.globalAlpha *= cK; ctx.lineCap = 'round';
      glow(ctx, x, y, 34, '#e6deff', 0.45);
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y + 6, 13, PI * 1.08, PI * 1.92); ctx.stroke();
      ctx.strokeStyle = '#f2ecff'; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.fillStyle = '#f2ecff'; ctx.beginPath(); ctx.arc(x, y - 1, 2.4, 0, TAU); ctx.fill(); ink(ctx, 1);
      ctx.restore();
    }
  }
})(window.G);

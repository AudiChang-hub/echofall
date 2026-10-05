'use strict';
/* ECHOFALL — Chapter VII boss: 薇格的殘響 THE ECHO OF ELAINE VEGA
   Captain Elaine Vega taught Rinne the sword, then died covering her descent pod. Ode carries one fragment of her; the rest —
   the unfinished sentences, the lessons she never got to give — sank into the Rest, which wrote her back in ink and gold.
   She fights with Rinne's own school, because it was hers first: the same four forms, the same charge, the same 斷弦.
   Phase 1 "THE TEST"   one hand behind her back, like a fencing master testing a pupil.
                        四式 four forms (white ×4 — Rinne's light combo, heavier) · 破 charged lunge (red) ·
                        靜 counter stance (attack into it → she deflects and ripostes, red; wait it out → her probing thrust is
                        white: parry it) · 斷弦 dash through you (red) · 墨浪 ink crescents (white, a parry sends them back) ·
                        墨雨 ink rain on red marks (arena hazard: columns of ink, each one a plucked note of the old theme).
   Phase 2 "THE LAST LESSON"  the ink coat tears open on gold light, both hands on the hilt, and she starts talking between
                        attacks — fragments of what she taught Rinne. Quicker forms · a double lunge · 斷弦 leaves a gold
                        string that snaps a beat later (red line) · three crescents · "the score" (patterned ink rain) ·
                        最後一課 THE FINAL LESSON: four white forms and a held, deliberately late red cut — watch her shoulders.
   Every sequence ends with her flicking the ink off the blade (an old habit): that is the opening. */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK;
  const S = 1.55;                 // drawing scale (rig units → world): an echo remembered a little larger than life
  const BL = 86;                  // blade length (rig units) — longer and heavier than Rinne's
  const GOLD = '#f0c25a', GOLDW = '#fff1c6', GOLDD = '#a9771f', CRIM = '#ff2a5f', REDW = '#ffd0dc', INKC = '#0d0b16';
  // ink-and-gold palette (odd hexes on purpose: their cel ramps are re-tinted below and must not collide with other foes)
  const COL = {
    coat: '#262b41', coatD: '#1b1e30', mantle: '#2d3250', lining: '#3d3524', vest: '#1f2031', shirt: '#e3dccc',
    pants: '#21233a', pantsD: '#18192a', boot: '#25233a', bootD: '#1a1828', glove: '#2e2534', belt: '#2b2233', sleeve: '#272c43', sleeveD: '#1c1f31',
    skin: '#eee2cf', skinD: '#b3a5b5', hair: '#1b1927', hairL: '#4a4e6e', silver: '#d4d8e8', blade: '#232533',
  };
  // Hades-style cel ramps, re-tinted for an echo: paper-gold rim, cool ink-wash lit plane, deep ink shadow, GOLD bounce light
  function inkRamp(hex, o = {}) {
    const r = Rig.ramp(hex);
    r.hi = U.mixHex(hex, '#ffe9bf', o.hi ?? 0.66); r.lit = U.mixHex(hex, '#c9cbe6', o.lit ?? 0.2);
    r.dark = U.mixHex(hex, '#05030b', o.dark ?? 0.42); r.bounce = U.mixHex(hex, '#e8b850', o.bounce ?? 0.34);
    return r;
  }
  for (const k of ['coat', 'coatD', 'mantle', 'vest', 'pants', 'pantsD', 'boot', 'bootD', 'glove', 'belt', 'sleeve', 'sleeveD', 'blade']) inkRamp(COL[k]);
  inkRamp(COL.shirt, { lit: 0.04, hi: 0.4, dark: 0.36, bounce: 0.3 });
  inkRamp(COL.skin, { lit: 0.02, hi: 0.35, dark: 0.3, bounce: 0.28 });
  const lerpP = K.lerpP;
  const LQ = () => !!(G.Quality && G.Quality.low);

  /* ================================ data ================================ */
  const D = G.DATA;
  D.speakers = D.speakers || {};
  if (!D.speakers.vega) D.speakers.vega = { name: '艾蓮・薇格', en: 'ELAINE VEGA', color: '#ffffff' };
  Object.assign(D.barks, {
    c7_bossP2: { who: 'vega', text: '……這把刀，我認得。——別留手。我也不會。' },
    c7_vegaLine1: { who: 'vega', text: '站穩。呼吸。你的刀比你的心快半拍。' },
    c7_vegaLine2: { who: 'vega', text: '別看刀，看肩膀。出手之前，肩膀會先說話。' },
    c7_vegaLine3: { who: 'vega', text: '會怕就對了。怕，代表你還想活下去。' },
    c7_vegaLine4: { who: 'vega', text: '最後一課，凜音——不是贏。是往前走。' },
    c7_vegaParry: { who: 'vega', text: '太急了。' },
    c7_vegaPraise: { who: 'vega', text: '……很好。就是這樣。' },
  });
  Object.assign(D.hints, {
    c7_bossStance: '她擺出了「守勢」——刀身泛著金光、眼睛閉著。這時出手會被她格開並立刻反擊（紅光，快 {dodge}）。耐心等她收勢：收勢那一記突刺是白光，完美格擋 {guard} 能重創她的架勢。',
    c7_bossWave: '墨浪是白光：在它碰到你的瞬間完美格擋 {guard}，就能把它彈回去打她。',
    c7_bossString: '斷弦留下的金弦會在片刻後崩斷（紅光）：跳過它，或在崩斷的瞬間 {dodge}。',
    c7_bossLesson: '最後一擊會刻意延遲。別看刀——等她的肩膀亮起來，再 {dodge}。',
  });
  D.codex.hushborn = D.codex.hushborn || [];
  if (!D.codex.hushborn.some((c) => c.id === 'c7_boss')) D.codex.hushborn.push({
    id: 'c7_boss', name: '薇格的殘響', en: 'THE ECHO OF ELAINE VEGA', portrait: 'c7_boss', unlock: 'seen_c7_boss',
    tag: '頭目｜休止之所',
    body: [
      '第七降臨隊隊長艾蓮・薇格，在降臨伏擊中為了掩護凜音的降臨艙而陣亡。她的人格碎片活在歐德裡；剩下的那些——來不及說完的話、沒能教完的劍——沉進了休止。休止把它們收起來，用墨與金重新寫成一個人影。',
      '她揮的是凜音的劍術：同樣的四式、同樣的蓄力突進、同樣的「斷弦」。那本來就是她教的。只是每一刀都更重、更沉，像一個大人在示範給孩子看。',
      '第一樂章：她只用一隻手，另一隻手背在身後——她在試你。四式連斬（白×4）、蓄力突刺（紅）、斷弦突進（紅）、墨浪（白，完美格擋可以彈回去）、墨雨（紅色落點，站到空隙裡）。她舉刀靜止、閉上眼睛時是「守勢」：這時出手會被格開並立刻反擊（紅）。等她收勢——那一記試探的突刺是白光，完美格擋它。',
      '第二樂章：墨色大衣裂開，金光從裂縫裡漏出來。她改用雙手握刀，開始在招式之間說話。斷弦會留下一條金弦，片刻後崩斷；「最後一課」是一套五段連斬，最後一擊是刻意延遲的紅光——看她的肩膀，不是她的刀。',
      '弱點：每一套連段收刀時，她都會甩掉刀上的墨——那是她的老習慣。就在那一下。',
    ],
  });

  /* ================================ sound ================================ */
  const AK = () => G.AudioKit;
  const THEME = [74, 77, 81, 79, 77, 76, 74, 72, 74, 69];
  Object.assign(G.SFX, {
    // her breath before a cut: a low controlled exhale (phase 2: a ghost choir underneath)
    c7_voice(t, phase = 1) {
      const A = AK();
      A.noise(t, 0.03, 0.08, 0.3, 'bandpass', 950, 420, 1.4, 0.25);
      A.tone('sine', 196, t, 0.04, 0.03, 0.38, { to: 170, wet: 0.5 });
      if (phase === 2) A.choirVoice(A.mtof(62), t, 0.9, 0.016, A.sfxBus);
    },
    // a heavier cut than Rinne's, with a struck-string ring in the blade
    c7_cut(t, k = 1) {
      const A = AK();
      A.noise(t, 0.015, 0.42 * k, 0.24, 'bandpass', 2300, 420, 0.9, 0.14);
      A.noise(t + 0.01, 0.03, 0.2 * k, 0.16, 'lowpass', 800, 200, 0.7, 0.06);
      A.tone('sine', 84, t + 0.02, 0.004, 0.2 * k, 0.16, { to: 46, wet: 0.05 });
      A.bell(A.mtof(81 + Math.floor(Math.random() * 3) * 2), t + 0.02, 0.024 * k, 0.9, 0.6, 0.6);
    },
    // ink: a wet splash and a patter of droplets
    c7_ink(t, k = 1) {
      const A = AK();
      A.noise(t, 0.004, 0.28 * k, 0.22, 'lowpass', 1400, 260, 0.8, 0.18);
      for (let i = 0; i < 5; i++) A.noise(t + 0.03 + i * 0.032 + Math.random() * 0.02, 0.001, 0.055 * k, 0.03, 'bandpass', 2400 + Math.random() * 2000, 1800, 4, 0.1);
    },
    // the counter stance: a held breath — a quiet fifth that waits
    c7_still(t) {
      const A = AK();
      A.tone('sine', A.mtof(69), t, 0.25, 0.03, 1.8, { wet: 0.8 }); A.tone('sine', A.mtof(76), t + 0.05, 0.25, 0.022, 1.8, { wet: 0.8 });
      A.bell(A.mtof(88), t, 0.035, 2.2, 0.9, 0.4);
    },
    // she deflects you: the bright "kin" of steel on steel, gold overtones
    c7_deflect(t) {
      const A = AK();
      A.bell(A.mtof(86), t, 0.16, 1.6, 0.6, 1.2); A.bell(A.mtof(74), t, 0.1, 1.2, 0.5, 0.6);
      A.noise(t, 0.001, 0.34, 0.05, 'bandpass', 3800, 2600, 1.6, 0.3);
      A.tone('sine', 110, t, 0.002, 0.3, 0.16, { to: 55, wet: 0.08 });
    },
    // 斷弦: a string pulled taut, released
    c7_sever(t) {
      const A = AK();
      A.noise(t, 0.05, 0.32, 0.3, 'bandpass', 400, 3400, 0.9, 0.2);
      A.tone('sawtooth', 220, t, 0.004, 0.045, 0.45, { to: 880, filter: 'lowpass', ff: 2600, wet: 0.4 });
      A.bell(A.mtof(93), t + 0.05, 0.06, 1.4, 0.7, 0.6);
    },
    c7_twang(t, k = 1) { const A = AK(); A.tone('triangle', 196, t, 0.003, 0.06 * k, 0.9, { wet: 0.4 }); A.tone('sine', 392.5, t, 0.003, 0.03 * k, 0.7, { wet: 0.4 }); },
    c7_snap(t) {
      const A = AK();
      A.noise(t, 0.001, 0.4, 0.09, 'highpass', 2600, 5200, 0.8, 0.25);
      A.tone('sine', 1480, t, 0.002, 0.08, 0.35, { to: 220, wet: 0.5 });
      A.tone('sine', 70, t, 0.003, 0.35, 0.3, { to: 38, wet: 0.1 });
    },
    // ink rain: every column is a plucked note of the old theme
    c7_pluck(t, m = 74) { const A = AK(); A.tone('triangle', A.mtof(m), t, 0.002, 0.07, 0.6, { wet: 0.6 }); A.tone('sine', A.mtof(m + 12), t, 0.002, 0.03, 0.35, { wet: 0.6 }); },
    c7_pour(t, k = 1) {
      const A = AK();
      A.tone('sine', 62, t, 0.003, 0.45 * k, 0.4, { to: 30, wet: 0.15 });
      A.noise(t, 0.004, 0.36 * k, 0.32, 'lowpass', 1600, 160, 0.8, 0.25);
      G.SFX.c7_ink(t + 0.02, 0.7 * k);
    },
    c7_crescent(t) { const A = AK(); A.noise(t, 0.04, 0.24, 0.32, 'bandpass', 700, 2600, 0.8, 0.2); A.tone('sine', 330, t, 0.02, 0.04, 0.4, { to: 520, wet: 0.5 }); },
    // the ink coat tears: a cloth rip, then gold light swelling through the gaps
    c7_tear(t) {
      const A = AK();
      for (let i = 0; i < 3; i++) A.noise(t + i * 0.07, 0.01, 0.22, 0.16, 'bandpass', 1500 + i * 700, 600, 1.2, 0.15);
      [62, 69, 74, 78, 81].forEach((m, i) => A.choirVoice(A.mtof(m), t + 0.15 + i * 0.04, 2.0, 0.022, A.sfxBus));
      A.bell(A.mtof(86), t + 0.35, 0.07, 3, 0.9, 0.5);
    },
    // the salute: a single clear bell, the theme's first note
    c7_salute(t) { const A = AK(); A.bell(A.mtof(74), t, 0.12, 3.2, 0.9, 0.7); A.bell(A.mtof(86), t + 0.02, 0.05, 2.4, 0.9, 0.5); A.stringVoice(A.mtof(62), t, 2.6, 0.025, A.sfxBus, 1100); },
    // her eyes open on gold
    c7_wake(t) {
      const A = AK();
      A.tone('sine', 41, t, 0.3, 0.35, 1.8, { to: 55, wet: 0.4 });
      [74, 81, 86].forEach((m, i) => A.bell(A.mtof(m), t + 0.25 + i * 0.12, 0.05, 2.6, 0.9, 0.5));
    },
    // the old habit: a flick of the wrist, ink spattering the floor
    c7_flick(t) { const A = AK(); A.noise(t, 0.012, 0.2, 0.12, 'bandpass', 1900, 700, 1, 0.08); G.SFX.c7_ink(t + 0.07, 0.5); },
    // "the final lesson": a low piano note under a string swell
    c7_lesson(t) {
      const A = AK();
      A.pianoVoice(A.mtof(50), t, 0.14, A.sfxBus, 3); A.pianoVoice(A.mtof(62), t + 0.02, 0.08, A.sfxBus, 3);
      A.stringVoice(A.mtof(69), t + 0.1, 2.4, 0.03, A.sfxBus, 1300);
    },
    // the delayed cue: a sharp inhale before the cut
    c7_breath(t) { const A = AK(); A.noise(t, 0.12, 0.12, 0.1, 'bandpass', 1300, 3200, 1.2, 0.2); A.bell(A.mtof(93), t + 0.1, 0.04, 0.8, 0.7, 0.8); },
    // she falls: the theme, descending, on a piano that is mostly reverb
    c7_fall(t) {
      const A = AK();
      [81, 79, 77, 76, 74].forEach((m, i) => A.pianoVoice(A.mtof(m), t + i * 0.38, 0.1, A.sfxBus, 2.6));
      A.choirVoice(A.mtof(62), t + 0.2, 3.2, 0.02, A.sfxBus); A.choirVoice(A.mtof(69), t + 0.4, 3.0, 0.016, A.sfxBus);
      A.tone('sine', 45, t, 0.02, 0.3, 2.2, { to: 30, wet: 0.4 });
    },
  });
  const sfx = (n, ...a) => G.SFX.play(n, ...a);

  /* ================================ poses ================================ */
  // angles in radians from straight down, + toward facing (see Rig.compute); sw = blade direction from the fist
  const ST = { tF: 0.55, kF: -0.55, tB: -0.5, kB: -0.2 };
  const IP = {
    // phase 1: upright, blade low and loose, the other hand behind her back
    idle1: (t) => { const br = Math.sin(t * 1.45), sw = Math.sin(t * 0.5); return { ik: 1, fFx: 19, fBx: -16, ry: 5 + br * 0.8, rx: sw * 1.1, torso: 0.06 + br * 0.012, head: -0.04 + Math.sin(t * 0.37) * 0.025, aF: 0.5 + br * 0.02, eF: 0.5, sw: 1.0 + br * 0.015 }; },
    // phase 2: both hands, point at the throat line, lower and wider
    idle2: (t) => { const br = Math.sin(t * 1.8), sw = Math.sin(t * 0.6); return { ik: 1, fFx: 21, fBx: -18, ry: 9 + br * 1.0, rx: sw * 1.4, torso: 0.18 + br * 0.015, head: -0.1, aF: 0.82 + br * 0.02, eF: 1.08, sw: 1.84 + br * 0.02, hold: 1 }; },
    hurt: { ...ST, ry: 8, torso: -0.34, head: 0.42, aF: 0.25, eF: 0.8, sw: 0.4 },
    broken: (t) => ({ ry: 27, torso: 0.42 + Math.sin(t * 2.4) * 0.03, head: 0.55 + Math.sin(t * 2.4 + 1) * 0.04, tF: 1.3, kF: -1.3, tB: 0.0, kB: -1.57, aF: 0.9, eF: 0.25, sw: 1.02, aB: 0.9, eB: 1.0 }),
    kneel: { ry: 27, torso: 0.52, head: 0.72, tF: 1.3, kF: -1.3, tB: 0.0, kB: -1.57, aF: 0.95, eF: 0.22, sw: 1.04, aB: 0.85, eB: 1.1 },
    backstep: { ry: 12, torso: -0.2, head: 0.08, tF: 0.6, kF: -0.4, tB: -0.9, kB: -1.0, aF: 0.7, eF: 0.6, sw: 1.3 },
    dash: { ry: 16, torso: 0.75, head: -0.35, tF: 1.05, kF: -1.2, tB: -0.9, kB: -0.5, aF: -0.55, eF: 0.4, sw: -1.6 },
    clutch: { ...ST, ry: 15, torso: 0.62, head: 0.75, aF: 0.35, eF: 0.4, sw: 0.25, aB: 1.25, eB: 2.0 },
    salute: { tF: 0.3, kF: -0.3, tB: -0.3, kB: -0.1, ry: 1, torso: 0.0, head: -0.06, aF: 0.52, eF: 2.3, sw: 3.14 },
    talk: (t) => ({ ik: 1, fFx: 17, fBx: -15, ry: 6, torso: 0.04, head: -0.16 + Math.sin(t * 2) * 0.02, aF: 0.6, eF: 0.7, sw: 1.15, hold: 0.6 }),
  };
  // 四式 four forms — Rinne's light combo, performed by the one who taught it
  const F = {
    W1: { ...ST, ry: 4, torso: -0.16, head: 0.06, aF: 2.85, eF: 0.55, sw: 4.25 },
    S1: { tF: 0.95, kF: -1.0, tB: -0.66, kB: -0.25, ry: 13, torso: 0.56, head: -0.12, aF: 1.36, eF: 0.06, sw: 0.98 },
    R1: { tF: 0.88, kF: -0.95, tB: -0.62, kB: -0.25, ry: 12, torso: 0.46, head: -0.05, aF: 1.05, eF: 0.3, sw: 0.86 },
    W2: { tF: 0.9, kF: -1.0, tB: -0.62, kB: -0.25, ry: 13, torso: 0.56, head: -0.05, aF: 0.32, eF: 0.22, sw: -0.7 },
    S2: { tF: 0.45, kF: -0.45, tB: -0.5, kB: -0.15, ry: -1, torso: -0.14, head: -0.16, aF: 2.78, eF: 0.12, sw: 3.02 },
    W3: { ...ST, ry: 1, torso: -0.16, head: 0.02, aF: 2.62, eF: 0.82, sw: 3.02 },
    S3: { tF: 0.98, kF: -1.06, tB: -0.7, kB: -0.25, ry: 15, torso: 0.64, head: -0.16, aF: 1.02, eF: 0.12, sw: 1.12 },
    W4: { tF: 0.95, kF: -1.35, tB: -0.62, kB: -0.6, ry: 16, torso: 0.6, head: -0.1, aF: 0.18, eF: 0.42, sw: -1.9 },
    A4: { tF: 1.2, kF: -2.0, tB: 0.9, kB: -1.8, ry: -16, torso: 0.3, aF: 1.6, eF: 0.0, sw: 1.6, rot: TAU },
    S4: { tF: 0.98, kF: -1.3, tB: -0.62, kB: -0.4, ry: 17, torso: 0.68, head: -0.08, aF: 1.18, eF: 0.08, sw: 0.78, rot: TAU },
    // chiburi: blade swung out, then snapped down — ink flies off the edge
    C1: { ...ST, ry: 7, torso: 0.2, head: 0.0, aF: 1.15, eF: 0.35, sw: 1.55 },
    C2: { ...ST, ry: 6, torso: 0.1, head: 0.06, aF: 0.42, eF: 0.18, sw: 0.18 },
    // 破 charged lunge
    L0: { tF: 1.02, kF: -1.3, tB: -0.82, kB: -0.25, ry: 17, torso: 0.62, head: -0.22, aF: -0.92, eF: 0.55, sw: -2.02 },
    L1: { tF: 1.2, kF: -0.62, tB: -1.1, kB: -0.15, ry: 18, torso: 0.8, head: -0.3, rx: 14, aF: 1.62, eF: 0.0, sw: 1.6 },
    // 靜 stance: blade upright before her face (P1 one hand, P2 two)
    G1: { tF: 0.48, kF: -0.62, tB: -0.55, kB: -0.25, ry: 7, torso: -0.02, head: 0.06, aF: 0.95, eF: 1.95, sw: 3.08 },
    // probing thrust
    PW: { ...ST, ry: 9, torso: 0.06, head: 0.0, aF: 0.95, eF: 2.0, sw: 1.62 },
    PS: { tF: 1.18, kF: -0.66, tB: -1.05, kB: -0.15, ry: 17, torso: 0.72, head: -0.25, rx: 10, aF: 1.6, eF: 0.0, sw: 1.57 },
    // 斷弦
    K1: { ry: 18, torso: 0.88, head: -0.4, tF: 1.25, kF: -1.6, tB: -1.1, kB: -0.4, aF: -0.92, eF: 0.4, sw: -1.92 },
    K2: { ry: 16, torso: 0.7, head: -0.3, tF: 1.0, kF: -1.0, tB: -1.2, kB: -0.3, aF: 1.75, eF: 0.0, sw: 1.95 },
    // 墨浪 horizontal sweep
    VS: { tF: 0.92, kF: -0.98, tB: -0.66, kB: -0.25, ry: 13, torso: 0.52, head: -0.08, aF: 1.5, eF: 0.0, sw: 1.66 },
    // 墨雨: the blade raised to the sky like a baton
    RA: { ...ST, ry: 3, torso: -0.14, head: -0.5, aF: 3.02, eF: 0.04, sw: 3.12 },
    RB: { ...ST, ry: 5, torso: -0.1, head: -0.42, aF: 2.9, eF: 0.12, sw: 3.0 },
    // 最後一課: the held overhead, the late cut
    LO: { tF: 0.55, kF: -0.72, tB: -0.55, kB: -0.3, ry: 4, torso: -0.2, head: -0.25, aF: 2.95, eF: 0.32, sw: 3.72, hold: 1 },
    LT: { tF: 0.5, kF: -0.6, tB: -0.6, kB: -0.25, ry: -1, torso: -0.3, head: -0.32, aF: 3.05, eF: 0.25, sw: 3.92, hold: 1 },
    LS: { tF: 1.25, kF: -1.5, tB: -0.6, kB: -1.0, ry: 28, torso: 0.95, head: 0.08, aF: 0.95, eF: 0.0, sw: 0.52, hold: 1 },
    LR: { tF: 1.25, kF: -1.45, tB: -0.55, kB: -1.0, ry: 26, torso: 0.82, head: 0.25, aF: 0.9, eF: 0.05, sw: 0.45, hold: 1 },
  };
  const hold = (p, h = 1) => ({ ...p, hold: h });

  /* ================================ helpers ================================ */
  const arenaOf = (e) => { const a = G.game.arena; return a ? { x0: a.x0, x1: a.x1 } : { x0: e.x - 700, x1: e.x + 700 }; };
  const floorY = (e) => (e.onGround ? e.y : Math.min(e.y, G.Phys.groundBelow(e.x, e.y - 60)));
  const toW = (e, p) => ({ x: e.x + e.facing * p.x * S, y: e.y + (e.offY || 0) + p.y * S });
  const tipW = (e) => e.tipW || { x: e.x + e.facing * 160, y: e.y - 96 };
  const ev = (t, fn) => ({ t, fn });
  const inWin = (st, w) => !!w && st >= w[0] && st < w[1];
  function poly(ctx, pts, close = true) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); if (close) ctx.closePath(); }
  function smoothClosed(ctx, pts) {
    ctx.beginPath(); const n = pts.length;
    const m0 = lerpP(pts[n - 1], pts[0], 0.5); ctx.moveTo(m0.x, m0.y);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], m = lerpP(a, b, 0.5); ctx.quadraticCurveTo(a.x, a.y, m.x, m.y); }
    ctx.closePath();
  }
  function ink(ctx, w = 1.1) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  function cel(ctx, c, nx, ny, w, hex) { const Ld = Rig.lightDir(ctx); return Rig.celGrad(ctx, c.x, c.y, nx, ny, w, nx * Ld.x + ny * Ld.y >= 0 ? 1 : -1, Rig.ramp(hex)); }
  let GHOST = false;   // true while the engine redraws her through the white hit-flash filter: silhouette only, no light
  function glow(ctx, x, y, r, col, a) { if (GHOST || a <= 0.01 || r <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, r, col, Math.min(1, a)); ctx.restore(); }
  function torsoFrame(J) {
    const tA = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x), ux = Math.cos(tA), uy = Math.sin(tA), nx = -uy, ny = ux;
    return { nx, ny, ux, uy, Q: (s, f) => ({ x: J.hip.x + ux * s * 36 + nx * f, y: J.hip.y + uy * s * 36 + ny * f }) };
  }
  const bladeGeo = (J) => {
    const dx = Math.sin(J.sw), dy = Math.cos(J.sw);
    return { dx, dy, tip: { x: J.hdF.x + dx * BL, y: J.hdF.y + dy * BL }, pommel: { x: J.hdF.x - dx * 15, y: J.hdF.y - dy * 15 } };
  };
  // phase 1: the free hand rests at the small of her back (two-bone IK, elbow out behind her)
  function behindBack(p) {
    const hip = { x: p.rx, y: -62 + p.ry }, ts = Math.sin(p.torso), tc = Math.cos(p.torso);
    const sh = { x: hip.x + ts * 31 - 2, y: hip.y - tc * 31 + 1 };
    // lower back, in the torso frame (s along the spine, f to the back)
    const tgt = { x: hip.x + ts * 9 - tc * 8.5, y: hip.y - tc * 9 - ts * 8.5 };
    const a = Rig.solve2(sh, tgt, 22, 20, 1), b = Rig.solve2(sh, tgt, 22, 20, -1);
    const ex = (s) => sh.x + Math.sin(s.a) * 22;
    const s = ex(a) < ex(b) ? a : b;
    p.aB = s.a; p.eB = s.b; p.hold = 0;
    return p;
  }

  /* ================================ hazards ================================ */
  // ---- 墨浪 ink crescent: white, travels along the floor at chest height; a perfect guard sends it back ----
  function crescent(e, opt = {}) {
    const g = G.game, fy = floorY(e), dir = e.facing;
    const h = {
      kind: 'c7_wave', owner: e, x: e.x + dir * 128, y: fy - (opt.h || 64), dir, vx: dir * (opt.speed || 560), t: 0, life: 4, r: opt.r || 50,
      dmg: opt.dmg || 15, friendly: false, passed: false, big: !!opt.big, seed: Math.random() * 9,
      update(h, dt, gm) {
        const P = gm.player, o = h.owner;
        h.x += h.vx * dt;
        const ar = arenaOf(o);
        if (h.x < ar.x0 + 10 || h.x > ar.x1 - 10) { splash(h.x, h.y, 0.7, h.friendly); h.done = true; return; }
        if (!LQ() && Math.random() < 0.5) G.FX.ember(h.x - h.dir * 20, h.y + U.rand(-30, 30), 1, h.friendly ? '#7ff4ff' : GOLD, { w: 6, h: 6, up: 30, sp: 30, life: 0.4 });
        if (!h.friendly) {
          if (h.passed || P.state === 'dead') return;
          const hb = P.hurtbox, R = { x: h.x - 22, y: h.y - h.r, w: 44, h: h.r * 2 };
          if (U.rectsOverlap(R, hb)) {
            const res = P.receiveHit(o, { dmg: h.dmg, kb: 200, projectile: true, hx: h.x, hy: h.y, waveFrom: h.x - h.dir * 40 });
            if (res === 'parried') {
              h.friendly = true; h.vx = -h.vx * 1.55; h.dir = -h.dir; h.t = Math.min(h.t, 1); h.life = 4;
              G.FX.ring(h.x, h.y, 8, 70, 0.3, '#7ff4ff', 4); G.FX.spark(h.x, h.y, 12, { col: '#bff8ff', speed: 520 });
            } else if (res === 'dodged' || res === 'ignored') h.passed = true;
            else { splash(h.x, h.y, 0.8, false); h.done = true; }
          }
        } else if (!o.dead) {
          const b = o.box;
          if (h.x > b.x - 16 && h.x < b.x + b.w + 16 && h.y > b.y && h.y < b.y + b.h + 10) {
            const P2 = gm.player;
            o.takeHit({ dmg: 30 * (P2.dmgMul || 1), bal: h.big ? 70 : 55, hx: h.x, hy: h.y, big: true, kbx: h.dir * 200 });
            gm.hitstop(0.08); gm.shake(0.4); sfx('hit', 1.2); splash(h.x, h.y, 1, true); h.done = true;
          }
        }
      },
      draw: drawCrescent,
    };
    g.hazards.push(h);
    sfx('c7_crescent');
    if (!e.waveHinted) { e.waveHinted = true; g.hint('c7_bossWave'); }
    return h;
  }
  function splash(x, y, k, friendly) {
    G.FX.dust(x, y, LQ() ? 5 : 10, { w: 30, speed: 220 * k, size: 11, col: 'rgba(16,12,26,', dir: -PI / 2, spread: PI * 1.6 });
    G.FX.spark(x, y, 8, { col: friendly ? '#bff8ff' : GOLDW, speed: 420 * k });
    sfx('c7_ink', 0.7 * k);
  }
  function drawCrescent(ctx, h) {
    const f = Math.min(1, h.t * 8) * (1 - Math.max(0, (h.t - h.life + 0.25) / 0.25)), d = h.dir, x = h.x, y = h.y, r = h.r;
    const col = h.friendly ? '#7ff4ff' : GOLD, colW = h.friendly ? '#e6fdff' : GOLDW;
    ctx.globalAlpha = f;
    // trailing ink smear
    if (!LQ()) {
      const tg = ctx.createLinearGradient(x - d * 150, 0, x, 0); tg.addColorStop(0, 'rgba(13,11,22,0)'); tg.addColorStop(1, 'rgba(13,11,22,0.5)');
      ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(x - d * 150, y - 6); ctx.quadraticCurveTo(x - d * 40, y - r * 0.7, x, y - r * 0.55); ctx.lineTo(x, y + r * 0.55); ctx.quadraticCurveTo(x - d * 40, y + r * 0.7, x - d * 150, y + 6); ctx.closePath(); ctx.fill();
    }
    // the crescent: a thick ink brush stroke bowed forward, a hot gold edge, a paper-white core line
    const wob = Math.sin(h.t * 22 + h.seed) * 2, bow = r * 1.05 + wob;
    const outer = () => { ctx.beginPath(); ctx.moveTo(x - d * 14, y - r); ctx.quadraticCurveTo(x + d * bow, y, x - d * 14, y + r); };
    ctx.beginPath(); ctx.moveTo(x - d * 14, y - r); ctx.quadraticCurveTo(x + d * bow, y, x - d * 14, y + r);
    ctx.quadraticCurveTo(x + d * r * 0.18, y + r * 0.2, x - d * 2, y); ctx.quadraticCurveTo(x + d * r * 0.18, y - r * 0.2, x - d * 14, y - r); ctx.closePath();
    ctx.fillStyle = INKC; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    outer(); ctx.strokeStyle = U.rgba(col, 0.4); ctx.lineWidth = 14; ctx.stroke();
    outer(); ctx.strokeStyle = U.rgba(col, 0.9); ctx.lineWidth = 4; ctx.stroke();
    outer(); ctx.strokeStyle = U.rgba(colW, 1); ctx.lineWidth = 1.6; ctx.stroke();
    K.glow(ctx, x + d * r * 0.45, y, r * 1.25, col, 0.32);
    ctx.restore();
    // droplets torn from the stroke
    ctx.fillStyle = INKC;
    for (let i = 0; i < 4; i++) { const a = h.t * 6 + i * 1.7 + h.seed, px = x - d * (18 + i * 16 + (a % 1) * 8), py = y + Math.sin(a) * r * 0.8; ctx.beginPath(); ctx.arc(px, py, 2.6 - i * 0.4, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  // ---- 墨雨 ink rain column: red note-head mark on the floor → a column of ink pours down from the sky ----
  function inkColumn(e, x, opt = {}) {
    const ar = arenaOf(e); x = U.clamp(x, ar.x0 + 46, ar.x1 - 46);
    const y = floorY(e), warn = opt.warn ?? 0.82;
    G.game.hazards.push({
      kind: 'c7_rain', owner: e, x, y, t: 0, warn, life: warn + 1.0, w: opt.w || 76, hit: false, poured: false, seed: Math.random() * 9,
      update(h, dt, g) {
        if (h.t >= h.warn + POUR && !h.poured) {
          h.poured = true; sfx('c7_pour', 0.8); g.shake(0.22);
          G.FX.dust(h.x, h.y, LQ() ? 6 : 14, { w: h.w, speed: 300, size: 13, col: 'rgba(16,12,26,' });
          G.FX.spark(h.x, h.y - 6, 10, { col: GOLDW, speed: 520, dir: -PI / 2, spread: 2.4 });
        }
        const P = g.player;
        if (h.poured && !h.hit && h.t >= h.warn + POUR && h.t < h.warn + POUR + 0.2 && P.state !== 'dead') {
          if (U.rectsOverlap({ x: h.x - h.w / 2 + 6, y: h.y - 900, w: h.w - 12, h: 900 }, P.hurtbox)) {
            h.hit = true; P.receiveHit(h.owner, { dmg: opt.dmg || 19, unblockable: true, kb: 260, hx: h.x, hy: P.y - 60, waveFrom: h.x });
          }
        }
      },
      draw: drawColumn,
    });
    sfx('c7_pluck', opt.note || 74);
  }
  const POUR = 0.08;   // the column takes this long to reach the floor; it only hurts once it has
  function drawColumn(ctx, h) {
    const x = h.x, y = h.y, w = h.w, top = y - 720;
    if (h.t < h.warn + POUR) {
      const k = U.clamp(h.t / h.warn, 0, 1), pulse = 0.5 + 0.5 * Math.sin(h.t * (14 + 16 * k));
      // the warning: a red column of light where the ink will fall, dashed edges, growing stronger
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const bh = 380 + 160 * k, bg = ctx.createLinearGradient(0, y, 0, y - bh);
      bg.addColorStop(0, U.rgba(CRIM, 0.16 + 0.2 * k * pulse)); bg.addColorStop(1, U.rgba(CRIM, 0));
      ctx.fillStyle = bg; ctx.fillRect(x - w / 2, y - bh, w, bh);
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = h.t * 50; ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        const eg = ctx.createLinearGradient(0, y, 0, y - bh); eg.addColorStop(0, U.rgba(REDW, 0.55 + 0.4 * k)); eg.addColorStop(1, U.rgba(CRIM, 0));
        ctx.strokeStyle = eg; ctx.beginPath(); ctx.moveTo(x + s * w / 2, y); ctx.lineTo(x + s * w / 2, y - bh); ctx.stroke();
      }
      ctx.setLineDash([]);
      K.glow(ctx, x, y - 6, w * 0.9, CRIM, 0.25 + 0.35 * k * pulse);
      ctx.restore();
      // the mark on the floor: an inked note head filling with red
      ctx.save(); ctx.translate(x, y - 6); ctx.rotate(-0.35);
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, TAU); ctx.fillStyle = INKC; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 10.5 * k, 5.8 * k, 0, 0, TAU); ctx.fillStyle = U.rgba(CRIM, 0.9); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x + 11, y - 9); ctx.lineTo(x + 11, y - 52); ctx.stroke();   // note stem
      // the drop gathering high above, then falling the whole way down
      const dy = top + 80 + (y - top - 80) * U.easeInCubic(U.clamp((h.t - h.warn * 0.55) / (h.warn * 0.45 + POUR), 0, 1)), ds = 4 + 5 * Math.min(1, k * 1.6);
      ctx.fillStyle = INKC; ctx.beginPath(); ctx.moveTo(x, dy - ds * 2.4); ctx.quadraticCurveTo(x + ds, dy - ds * 0.2, x, dy + ds * 0.7); ctx.quadraticCurveTo(x - ds, dy - ds * 0.2, x, dy - ds * 2.4); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(GOLDW, 0.8); ctx.beginPath(); ctx.arc(x + ds * 0.3, dy - ds * 0.4, ds * 0.22, 0, TAU); ctx.fill(); ctx.restore();
      if (h.t < h.warn) return;
    }
    // the pour: a heavy wobbling stream that thins from the top once it has struck
    const tt = h.t - h.warn, fall = U.clamp(tt / POUR, 0, 1), fade = 1 - U.clamp((tt - 0.4) / 0.5, 0, 1);
    const tail = U.clamp((tt - 0.12) / 0.4, 0, 1), y0 = U.lerp(top, y - 30, U.easeInCubic(tail)), y1 = top + (y - top) * U.easeInCubic(fall);
    if (y1 > y0 + 4) {
      ctx.globalAlpha = fade;
      const ww = w * (0.62 - 0.22 * tail), N = 14, Lp = [], Rp = [];
      for (let i = 0; i <= N; i++) {
        const yy = y0 + (y1 - y0) * i / N, wob = Math.sin(yy * 0.045 + h.t * 22 + h.seed) * 3.2, wob2 = Math.sin(yy * 0.06 - h.t * 18 + h.seed * 2) * 3.2;
        const flare = i === N && fall >= 1 ? 1.5 : 1;
        Lp.push({ x: x - ww * 0.5 * flare + wob, y: yy }); Rp.push({ x: x + ww * 0.5 * flare + wob2, y: yy });
      }
      ctx.beginPath(); ctx.moveTo(Lp[0].x, Lp[0].y); for (const q of Lp) ctx.lineTo(q.x, q.y); for (let i = N; i >= 0; i--) ctx.lineTo(Rp[i].x, Rp[i].y); ctx.closePath();
      ctx.fillStyle = INKC; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = U.rgba(GOLD, 0.55); ctx.lineWidth = 2.4; ctx.beginPath(); for (let i = 0; i <= N; i++) { const q = lerpP(Lp[i], Rp[i], 0.72); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); } ctx.stroke();
      ctx.strokeStyle = U.rgba(GOLDW, 0.8); ctx.lineWidth = 0.9; ctx.stroke();
      ctx.restore();
      // droplets peeling off the edges
      ctx.fillStyle = INKC;
      for (let i = 0; i < 5; i++) {
        const u = ((h.t * 2.2 + i * 0.21 + h.seed) % 1), yy = y0 + (y1 - y0) * u, s = i % 2 ? 1 : -1, xx = x + s * (ww * 0.5 + 4 + 6 * u);
        ctx.beginPath(); ctx.arc(xx, yy, 2.4 - u, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // splash crown and the stain it leaves
    if (fall >= 1) {
      const sk = U.clamp(tt / 0.18, 0, 1), st = 1 - U.clamp((tt - 0.3) / 0.6, 0, 1);
      ctx.globalAlpha = st;
      ctx.fillStyle = INKC; ctx.beginPath(); ctx.ellipse(x, y - 1, w * (0.6 + tt * 0.8), 5 + tt * 2, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 7; i++) {
        const a = -PI / 2 + (i - 3) * 0.36, l = (24 + (i % 3) * 14) * sk * (1 - tail * 0.6);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 10 - 3.5, y - 2); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.6, y + Math.sin(a) * l * 0.6 - 4, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.lineTo(x + Math.cos(a) * 10 + 3.5, y - 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * l * 1.18, y + Math.sin(a) * l * 1.18 - 3, 2.2, 0, TAU); ctx.fill();
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y - 12, w * 1.2, GOLD, 0.35 * (1 - tail)); ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // ---- 斷弦 (phase 2): the gold string she leaves behind — vibrates, turns red, snaps ----
  function stringLine(e, x0, x1, snapIn) {
    const y = floorY(e) - 62;
    G.game.hazards.push({
      kind: 'c7_string', owner: e, x0: Math.min(x0, x1), x1: Math.max(x0, x1), y, t: 0, snap: snapIn, life: snapIn + 0.5, hit: false, snapped: false,
      update(h, dt, g) {
        if (h.t >= h.snap * 0.22 && !h.warned) { h.warned = true; sfx('tellRed'); sfx('c7_twang', 1.4); }
        if (h.t >= h.snap && !h.snapped) {
          h.snapped = true; sfx('c7_snap'); g.shake(0.35);
          G.FX.beam(h.x0, h.y, h.x1, h.y, CRIM, 0.3, 16);
          for (let i = 0; i < 5; i++) G.FX.slashMark(U.lerp(h.x0, h.x1, Math.random()), h.y + U.rand(-10, 10), U.rand(-0.5, 0.5), 110, REDW, 0.35, 6);
        }
        const P = g.player;
        if (h.snapped && !h.hit && h.t < h.snap + 0.14 && P.state !== 'dead') {
          if (U.rectsOverlap({ x: h.x0, y: h.y - 18, w: h.x1 - h.x0, h: 36 }, P.hurtbox)) { h.hit = true; P.receiveHit(h.owner, { dmg: 20, unblockable: true, kb: 240, hx: P.x, hy: h.y }); }
        }
      },
      draw(ctx, h) {
        if (h.snapped) return;
        const k = U.clamp(h.t / h.snap, 0, 1), red = U.clamp((k - 0.22) / 0.2, 0, 1), amp = 1.5 + 5 * red * k, fq = 30 + 50 * red;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        const path = () => { ctx.beginPath(); const n = 24; for (let i = 0; i <= n; i++) { const u = i / n, xx = U.lerp(h.x0, h.x1, u), yy = h.y + Math.sin(u * PI) * Math.sin(h.t * fq + u * 3) * amp; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } };
        path(); ctx.strokeStyle = U.rgba(red > 0.5 ? CRIM : GOLD, 0.3 + 0.25 * red); ctx.lineWidth = 9; ctx.stroke();
        path(); ctx.strokeStyle = red > 0.5 ? REDW : GOLDW; ctx.lineWidth = 1.8; ctx.stroke();
        for (const xx of [h.x0, h.x1]) K.glow(ctx, xx, h.y, 20, red > 0.5 ? CRIM : GOLD, 0.5);
        ctx.restore();
      },
    });
    sfx('c7_twang', 1);
    if (!e.stringHinted) { e.stringHinted = true; G.game.hint('c7_bossString'); }
  }

  /* ================================ shared attack events ================================ */
  function flick(e) {
    // the old habit: ink flung off the blade in an arc across the floor
    const t = tipW(e), fy = floorY(e);
    sfx('c7_flick');
    G.FX.dust(t.x, fy, LQ() ? 4 : 8, { w: 60, speed: 160, size: 8, col: 'rgba(16,12,26,' });
    for (let i = 0; i < 5; i++) e.splats.push({ x: e.x + e.facing * (70 + i * 26 + Math.random() * 12), y: fy, t: 0, s: 4 + Math.random() * 6, life: 1.6 + Math.random() });
  }
  function impact(e, k = 1, x) {
    const fy = floorY(e), px = x ?? tipW(e).x;
    G.game.shake(0.25 + 0.35 * k); G.game.hitstop(0.02 * k);
    G.FX.dust(px, fy, LQ() ? 6 : 14, { w: 70, speed: 260 * k, size: 13, col: 'rgba(16,12,26,' });
    G.FX.ring(px, fy, 10, 120 + 80 * k, 0.45, GOLD, 5, { flat: 0.18 });
    G.FX.spark(px, fy - 8, 10, { col: GOLDW, speed: 520 * k, dir: -PI / 2, spread: 2.2 });
    sfx('c7_ink', k);
  }
  const cut = (k = 1) => (e) => sfx('c7_cut', k);
  const say = (id, every = 9) => (e) => { if (e.t - (e.sayT || -99) > every) { e.sayT = e.t; G.game.bark(id); } };

  /* ================================ attacks ================================ */
  // P1 · 四式 FOUR FORMS: Rinne's own light combo (white ×4), heavier — down-cut, rising cut, down-cut, spinning slam
  // ts = when the spinning slam lands (≥0.6 s after its tell: it is the big one)
  const formHits = (k, ts) => [
    { t0: 0.65 * k, t1: 0.77 * k, box: { x: 0, y: -246, w: 219, h: 246 }, dmg: 16, kb: 220, pbal: 40 },
    { t0: 1.19 * k, t1: 1.3 * k, box: { x: 0, y: -267, w: 208, h: 267 }, dmg: 16, kb: 220, pbal: 40 },
    { t0: 1.78 * k, t1: 1.89 * k, box: { x: 0, y: -235, w: 214, h: 235 }, dmg: 18, kb: 240, pbal: 46 },
    { t0: ts, t1: ts + 0.13, box: { x: -21, y: -214, w: 230, h: 214 }, dmg: 24, kb: 340, last: true, pbal: 90 },
  ];
  const formPoses = (k, two, dur, ts) => {
    const H = (p) => (two ? hold(p) : p);
    return { dur, keys: [[0, null], [0.42 * k, H(F.W1)], [0.6 * k, H({ ...F.W1, sw: 4.4, torso: -0.2 })], [0.71 * k, H(F.S1), 'snap'], [0.9 * k, H(F.R1), 'out'],
      [1.06 * k, H(F.W2), 'io'], [1.17 * k, H({ ...F.W2, sw: -0.85 })], [1.29 * k, H(F.S2), 'out'], [1.45 * k, H(F.W3), 'io'], [1.72 * k, H({ ...F.W3, sw: 3.2, torso: -0.2 })],
      [1.83 * k, H(F.S3), 'snap'], [ts - 0.49, H(F.W4), 'io'], [ts - 0.07, H(F.A4), 'out'], [ts + 0.03, H(F.S4), 'snap'], [ts + 0.38, H({ ...F.S4, ry: 15 })],
      [ts + 0.58, H({ ...F.C1, rot: TAU }), 'io'], [ts + 0.67, H({ ...F.C2, rot: TAU }), 'snap'], [dur, { rot: TAU }, 'io']] };
  };
  const formEv = (k, ts) => [ev(0.6 * k, cut(0.9)), ev(1.18 * k, cut(0.9)), ev(1.74 * k, cut(1)), ev(ts - 0.45, () => sfx('whoosh', 1.2)),
    ev(ts + 0.03, (e) => { cut(1.3)(e); impact(e, 0.8); }), ev(ts + 0.67, flick)];
  const TS1 = 2.57;
  const form = {
    name: 'form', dur: 3.7, cd: 1.0, air: [TS1 - 0.49, TS1],
    tells: [{ t: 0.15, c: 'white' }, { t: 0.69, c: 'white' }, { t: 1.28, c: 'white' }, { t: TS1 - 0.6, c: 'white' }],
    poses: formPoses(1, false, 3.7, TS1),
    moves: [{ t0: 0.6, t1: 0.7, v: 260 }, { t0: 1.18, t1: 1.26, v: 200 }, { t0: 1.74, t1: 1.82, v: 240 }, { t0: TS1 - 0.43, t1: TS1 - 0.07, v: 290 }],
    hits: formHits(1, TS1), ev: formEv(1, TS1), recover: [TS1 + 0.33, 3.7],
  };
  // P2 · quicker, two-handed
  const K2 = 0.88, TS2 = 1.97 * K2 - 0.05 + 0.6;
  const form2 = {
    name: 'form2', dur: 3.35, cd: 0.9, air: [TS2 - 0.49, TS2],
    tells: [{ t: 0.15 * K2 - 0.02, c: 'white' }, { t: 1.19 * K2 - 0.47, c: 'white' }, { t: 1.28 * K2 - 0.03, c: 'white' }, { t: TS2 - 0.6, c: 'white' }],
    poses: formPoses(K2, true, 3.35, TS2),
    moves: [{ t0: 0.6 * K2, t1: 0.7 * K2, v: 280 }, { t0: 1.18 * K2, t1: 1.26 * K2, v: 220 }, { t0: 1.74 * K2, t1: 1.82 * K2, v: 260 }, { t0: TS2 - 0.43, t1: TS2 - 0.07, v: 320 }],
    hits: formHits(K2, TS2).map((h) => ({ ...h, dmg: h.dmg + 2 })), ev: formEv(K2, TS2), recover: [TS2 + 0.33, 3.35],
  };

  // 破 CHARGED LUNGE (red): Rinne's charge stance, gold gathering on the blade, then a straight-line thrust across the floor
  const lungeDash = (e, t0, t1) => {
    const P = e.P, ar = arenaOf(e), d = Math.abs(P.x - e.x);
    e.faceP();
    const dist = U.clamp(d + 110, 200, 470);
    const to = U.clamp(e.x + e.facing * dist, ar.x0 + 60, ar.x1 - 60);
    e.dash = { x0: e.x, x1: to, t0, t1, hit: false };
    sfx('c7_sever'); sfx('whoosh', 1.4); G.FX.dust(e.x, floorY(e), 12, { w: 50, speed: 260, col: 'rgba(16,12,26,' });
  };
  const lungeHit = { dmg: 30, kb: 420 };
  const lunge = {
    name: 'lunge', dur: 2.55, cd: 1.1, track: false, red: true, charge: [[0.2, 0.95]], ghost: [[0.92, 1.25]],
    tells: [{ t: 0.22, c: 'red' }],
    poses: { dur: 2.55, keys: [[0, null], [0.3, F.L0], [0.9, { ...F.L0, ry: 18, sw: -2.12 }], [0.98, F.L1, 'snap'], [1.45, { ...F.L1, rx: 10 }], [1.75, F.C1, 'io'], [1.86, F.C2, 'snap'], [2.55, null, 'io']] },
    ev: [ev(0.2, (e) => sfx('chargeHum', 0.6)), ev(0.55, (e) => sfx('chargeHum', 1)), ev(0.95, (e) => lungeDash(e, 0.95, 1.18)), ev(1.86, flick)],
    upd(e, dt) { dashUpdate(e, dt, lungeHit, 160); },
    recover: [1.45, 2.55],
  };
  // P2: lunge, plant, turn, lunge back
  const lunge2 = {
    name: 'lunge2', dur: 3.55, cd: 1.1, track: false, red: true, charge: [[0.2, 0.92], [1.42, 2.08]], ghost: [[0.9, 1.22], [2.08, 2.4]],
    tells: [{ t: 0.22, c: 'red' }, { t: 1.42, c: 'red' }],
    poses: { dur: 3.55, keys: [[0, null], [0.3, hold(F.L0)], [0.88, hold({ ...F.L0, sw: -2.12 })], [0.96, hold(F.L1), 'snap'], [1.3, hold(F.L1)], [1.6, hold(F.L0), 'io'], [2.06, hold({ ...F.L0, ry: 18 })],
      [2.14, hold(F.L1), 'snap'], [2.6, hold({ ...F.L1, rx: 10 })], [2.85, hold(F.C1), 'io'], [2.96, hold(F.C2), 'snap'], [3.55, null, 'io']] },
    ev: [ev(0.2, () => sfx('chargeHum', 0.8)), ev(0.93, (e) => lungeDash(e, 0.93, 1.15)), ev(1.42, (e) => { e.faceP(); sfx('chargeHum', 1); }),
      ev(2.1, (e) => lungeDash(e, 2.1, 2.32)), ev(2.96, flick)],
    upd(e, dt) { dashUpdate(e, dt, { dmg: 28, kb: 400 }, 150); },
    recover: [2.6, 3.55],
  };
  // shared dash: eased travel x0→x1 over [t0,t1], a red hit swept along the path
  function dashUpdate(e, dt, hit, reach) {
    const d = e.dash; if (!d) return;
    if (e.st < d.t0) return;
    if (e.st <= d.t1 + 0.02) {
      const k = U.clamp((e.st - d.t0) / (d.t1 - d.t0), 0, 1), px = e.x;
      const nx = U.lerp(d.x0, d.x1, U.easeOutCubic(k));
      e.vx = dt > 0 ? (nx - e.x) / dt : 0;
      if (!d.hit) {
        const P = e.P, a = Math.min(d.x0, nx + e.facing * reach), b = Math.max(d.x0, nx + e.facing * reach);
        if (U.rectsOverlap({ x: a, y: e.y - 150, w: b - a, h: 150 }, P.hurtbox)) {
          d.hit = true; P.receiveHit(e, { dmg: hit.dmg, unblockable: true, kb: hit.kb, hx: P.x, hy: P.y - 60 });
        }
      }
      if (!LQ() && Math.random() < 0.6) G.FX.dust(px, floorY(e), 1, { w: 20, speed: 90, size: 9, col: 'rgba(16,12,26,' });
    } else if (e.st < d.t1 + 0.4) { e.vx = U.approach(e.vx, 0, 5000 * dt); }
    else { e.dash = null; }
  }

  // 靜 COUNTER STANCE: the perfect guard she taught you. Attack into it → deflect + riposte (red). Wait → a white probe.
  const stance = {
    name: 'stance', dur: 3.95, cd: 1.0, stance: [0.32, 2.38],
    tells: [{ t: 2.38, c: 'white' }],
    poses: { dur: 3.95, keys: [[0, null], [0.3, F.G1, 'out'], [2.3, { ...F.G1, ry: 8 }], [2.62, F.PW, 'io'], [2.86, F.PW], [2.95, F.PS, 'snap'], [3.3, { ...F.PS, rx: 8 }], [3.55, F.C1, 'io'], [3.64, F.C2, 'snap'], [3.95, null, 'io']] },
    moves: [{ t0: 2.86, t1: 2.98, v: 520 }],
    hits: [{ t0: 2.9, t1: 3.03, box: { x: 0, y: -160, w: 244, h: 79 }, dmg: 22, kb: 300, last: true, pbal: 135 }],
    ev: [ev(0.3, (e) => { sfx('c7_still'); G.FX.ring(e.x, floorY(e), 10, 90, 0.6, GOLD, 3, { flat: 0.2 }); if (!e.stanceHinted) { e.stanceHinted = true; G.game.hint('c7_bossStance'); } }),
      ev(2.9, cut(1.1)), ev(3.64, flick)],
    recover: [3.1, 3.95],
  };
  // riposte: the instant after her deflection — a red cut that steps through your guard
  const riposte = {
    name: 'riposte', dur: 1.83, cd: 0.9, red: true, parryWin: 0.3, trackSpeed: 420,
    tells: [{ t: 0.03, c: 'red' }],
    poses: { dur: 1.83, keys: [[0, F.G1], [0.12, { ...F.W1, ry: 6, torso: -0.1 }, 'out'], [0.56, { ...F.W1, sw: 4.4 }], [0.66, { ...F.S1, rx: 6 }, 'snap'], [0.93, F.R1, 'out'], [1.2, F.C1, 'io'], [1.29, F.C2, 'snap'], [1.83, null, 'io']] },
    moves: [{ t0: 0.56, t1: 0.66, v: 560 }],
    hits: [{ t0: 0.64, t1: 0.76, box: { x: 0, y: -246, w: 227, h: 246 }, dmg: 26, red: true, kb: 380, last: true }],
    ev: [ev(0.6, cut(1.3)), ev(1.29, flick)],
    recover: [0.93, 1.83],
  };

  // 斷弦 SEVER: Rinne's skill — a crouched draw, a string across the floor, a dash clean through you (red)
  const severPoses = (dur, two) => {
    const H = (p) => (two ? hold(p, 0.5) : p);
    return { dur, keys: [[0, null], [0.28, H(F.K1), 'out'], [0.82, H({ ...F.K1, sw: -2.02, ry: 19 })], [0.9, H(F.K2), 'snap'], [1.32, H({ ...F.K2, rx: 8 })], [1.62, H(F.C1), 'io'], [1.72, H(F.C2), 'snap'], [dur, null, 'io']] };
  };
  function severAim(e, final) {
    const P = e.P, ar = arenaOf(e);
    if (!final) e.faceP();
    const to = U.clamp(P.x + e.facing * 190, ar.x0 + 60, ar.x1 - 60);
    e.sevAim = { x0: e.x, x1: (to - e.x) * e.facing < 120 ? U.clamp(e.x + e.facing * 120, ar.x0 + 60, ar.x1 - 60) : to, locked: !!final };
  }
  const sever = {
    name: 'sever', dur: 2.45, cd: 1.0, track: false, red: true, aim: [0.15, 0.86], ghost: [[0.86, 1.15]],
    tells: [{ t: 0.15, c: 'red' }],
    poses: severPoses(2.45, false),
    ev: [ev(0.15, (e) => severAim(e)), ev(0.62, (e) => severAim(e, true)),
      ev(0.86, (e) => { const a = e.sevAim; e.dash = { x0: e.x, x1: a.x1, t0: 0.86, t1: 1.02, hit: false }; sfx('c7_sever'); sfx('skill1'); }),
      ev(1.05, (e) => { const a = e.sevAim; G.FX.beam(a.x0, floorY(e) - 62, e.x, floorY(e) - 62, GOLD, 0.35, 16); for (let i = 0; i < 4; i++) G.FX.slashMark(U.lerp(a.x0, e.x, Math.random()), floorY(e) - 50 - Math.random() * 40, U.rand(-0.6, 0.6), 120, GOLDW, 0.4, 6); G.game.shake(0.35); }),
      ev(1.72, flick)],
    upd(e, dt) { if (e.st < 0.62 && e.st > 0.15) severAim(e); dashUpdate(e, dt, { dmg: 26, kb: 380 }, 40); },
    recover: [1.3, 2.45],
  };
  const sever2 = {
    name: 'sever2', dur: 2.6, cd: 1.0, track: false, red: true, aim: [0.15, 0.82], ghost: [[0.82, 1.1]],
    tells: [{ t: 0.15, c: 'red' }],
    poses: severPoses(2.6, true),
    ev: [ev(0.15, (e) => severAim(e)), ev(0.58, (e) => severAim(e, true)),
      ev(0.82, (e) => { const a = e.sevAim; e.dash = { x0: e.x, x1: a.x1, t0: 0.82, t1: 0.97, hit: false }; sfx('c7_sever'); sfx('skill1'); }),
      ev(1.0, (e) => { const a = e.sevAim; stringLine(e, a.x0, e.x, 0.85); G.game.shake(0.3); }),
      ev(1.72, flick)],
    upd(e, dt) { if (e.st < 0.58 && e.st > 0.15) severAim(e); dashUpdate(e, dt, { dmg: 26, kb: 380 }, 40); },
    recover: [1.3, 2.6],
  };

  // 墨浪 INK WAVE: a sweep that throws a crescent of ink along the floor (white — parry it back to her)
  const wave = {
    name: 'wave', dur: 2.5, cd: 1.0, track: false,
    tells: [{ t: 0.2, c: 'white' }, { t: 0.98, c: 'white' }],
    poses: { dur: 2.5, keys: [[0, null], [0.48, F.W3, 'io'], [0.64, { ...F.W3, sw: 3.25, torso: -0.2 }], [0.74, F.VS, 'snap'], [0.98, F.W2, 'io'], [1.4, { ...F.W2, sw: -0.85 }], [1.5, F.S2, 'snap'], [1.85, F.C1, 'io'], [1.95, F.C2, 'snap'], [2.5, null, 'io']] },
    ev: [ev(0.72, (e) => crescent(e, { h: 66 })), ev(1.48, (e) => crescent(e, { h: 66, speed: 600 })), ev(1.95, flick)],
    recover: [1.8, 2.5],
  };
  const wave3 = {
    name: 'wave3', dur: 3.15, cd: 1.0, track: false,
    tells: [{ t: 0.18, c: 'white' }, { t: 0.82, c: 'white' }, { t: 1.42, c: 'white' }],
    poses: { dur: 3.15, keys: [[0, null], [0.46, hold(F.W3), 'io'], [0.62, hold({ ...F.W3, sw: 3.25 })], [0.72, hold(F.VS), 'snap'], [0.92, hold(F.W2), 'io'], [1.22, hold({ ...F.W2, sw: -0.85 })], [1.32, hold(F.S2), 'snap'],
      [1.62, hold(F.W1), 'io'], [1.84, hold({ ...F.W1, sw: 4.4 })], [1.94, hold(F.VS), 'snap'], [2.4, hold(F.C1), 'io'], [2.5, hold(F.C2), 'snap'], [3.15, null, 'io']] },
    ev: [ev(0.7, (e) => crescent(e, { h: 66 })), ev(1.3, (e) => crescent(e, { h: 66, speed: 600 })), ev(1.92, (e) => crescent(e, { h: 70, speed: 640, r: 54, dmg: 18, big: true })), ev(2.5, flick)],
    recover: [2.3, 3.15],
  };

  // 墨雨 INK RAIN (arena hazard): she lifts the blade like a baton; columns of ink pour onto red note-heads
  const rainEv = (pattern) => {
    const out = [ev(0.62, (e) => { sfx('c7_voice', e.phase); G.FX.ring(tipW(e).x, tipW(e).y, 6, 70, 0.4, GOLD, 3); G.game.shake(0.2); })];
    if (!pattern) {
      for (let i = 0; i < 5; i++) out.push(ev(0.85 + i * 0.44, (e) => inkColumn(e, e.P.x + e.P.vx * 0.32, { note: THEME[i] })));
    } else {
      const slot = (e, i) => { const ar = arenaOf(e), n = 9, gap = (ar.x1 - ar.x0 - 150) / (n - 1); return ar.x0 + 75 + i * gap; };
      out.push(ev(0.85, (e) => { for (let i = 0; i < 9; i += 2) inkColumn(e, slot(e, i), { note: THEME[i % THEME.length], warn: 0.9 }); }));
      out.push(ev(1.85, (e) => { for (let i = 1; i < 9; i += 2) inkColumn(e, slot(e, i), { note: THEME[(i + 3) % THEME.length], warn: 0.9 }); }));
      for (const [t, n] of [[2.85, 74], [3.2, 77], [3.55, 81]]) out.push(ev(t, (e) => inkColumn(e, e.P.x + e.P.vx * 0.3, { note: n, warn: 0.78 })));
    }
    return out;
  };
  const rainPoses = (dur, two) => {
    const H = (p) => (two ? hold(p, 0.4) : p);
    return { dur, keys: [[0, null], [0.45, H(F.RB), 'io'], [0.62, H(F.RA), 'snap'], [dur - 0.85, H(F.RA)], [dur - 0.62, H(F.C1), 'io'], [dur - 0.52, H(F.C2), 'snap'], [dur, null, 'io']] };
  };
  const rain = { name: 'rain', dur: 3.9, cd: 0.9, track: false, red: true, sky: [0.62, 3.05], tells: [{ t: 0.24, c: 'red' }], poses: rainPoses(3.9, false), ev: rainEv(false).concat([ev(3.38, flick)]), recover: [3.0, 3.9] };
  const rain2 = { name: 'rain2', dur: 4.85, cd: 0.9, track: false, red: true, sky: [0.62, 4.0], tells: [{ t: 0.24, c: 'red' }], poses: rainPoses(4.85, true), ev: rainEv(true).concat([ev(4.33, flick)]), recover: [4.0, 4.85] };

  // 最後一課 THE FINAL LESSON (phase 2): down-cut · rising cut · thrust · spinning slam (white ×4) … then the held overhead and a
  // deliberately late red cut. Her shoulders flare gold the instant she commits.
  const LS_T = 3.98;
  const lesson = {
    name: 'lesson', dur: 5.5, cd: 1.2, air: [2.12, 2.6], red: false,
    tells: [{ t: 0.2, c: 'white' }, { t: 0.72, c: 'white' }, { t: 1.38, c: 'white' }, { t: 2.0, c: 'white' }, { t: 3.1, c: 'red' }],
    poses: { dur: 5.35, keys: [[0, null], [0.46, hold(F.W1)], [0.64, hold({ ...F.W1, sw: 4.4, torso: -0.2 })], [0.75, hold(F.S1), 'snap'], [0.93, hold(F.R1), 'out'],
      [1.04, hold(F.W2), 'io'], [1.17, hold({ ...F.W2, sw: -0.85 })], [1.29, hold(F.S2), 'out'], [1.55, hold(F.PW), 'io'], [1.84, hold(F.PW)], [1.93, hold(F.PS), 'snap'],
      [2.12, hold(F.W4), 'io'], [2.53, hold(F.A4), 'out'], [2.63, hold(F.S4), 'snap'], [2.9, hold({ ...F.S4, ry: 15 })],
      [3.15, { ...F.LO, rot: TAU }, 'io'], [3.7, { ...F.LT, rot: TAU }, 'io'], [3.9, { ...F.LT, sw: 4.0, rot: TAU }], [LS_T, { ...F.LS, rot: TAU }, 'snap'], [4.62, { ...F.LR, rot: TAU }],
      [4.95, { ...hold(F.C1), rot: TAU }, 'io'], [5.05, { ...hold(F.C2), rot: TAU }, 'snap'], [5.5, { rot: TAU }, 'io']] },
    moves: [{ t0: 0.64, t1: 0.74, v: 280 }, { t0: 1.19, t1: 1.27, v: 220 }, { t0: 1.84, t1: 1.95, v: 480 }, { t0: 2.18, t1: 2.53, v: 320 }, { t0: LS_T - 0.1, t1: LS_T, v: 300 }],
    hits: [
      { t0: 0.7, t1: 0.81, box: { x: 0, y: -246, w: 219, h: 246 }, dmg: 17, kb: 220, pbal: 44 },
      { t0: 1.19, t1: 1.3, box: { x: 0, y: -267, w: 208, h: 267 }, dmg: 17, kb: 220, pbal: 44 },
      { t0: 1.88, t1: 2.0, box: { x: 0, y: -160, w: 244, h: 79 }, dmg: 19, kb: 260, pbal: 55 },
      { t0: 2.6, t1: 2.73, box: { x: -21, y: -214, w: 230, h: 214 }, dmg: 24, kb: 340, pbal: 85 },
      { t0: LS_T - 0.06, t1: LS_T + 0.08, box: { x: -11, y: -278, w: 237, h: 278 }, dmg: 36, red: true, kb: 460, last: true },
    ],
    ev: [ev(0.0, (e) => { lessonLine(e, false); sfx('c7_lesson'); if (!e.lessonHinted) { e.lessonHinted = true; G.game.hint('c7_bossLesson'); } }),
      ev(0.66, cut(1)), ev(1.2, cut(1)), ev(1.86, cut(1.1)), ev(2.16, () => sfx('whoosh', 1.2)), ev(2.63, (e) => { cut(1.3)(e); impact(e, 0.8); }),
      ev(3.12, () => sfx('chargeHum', 1)), ev(LS_T - 0.27, (e) => { e.shoulderT = e.t; sfx('c7_breath'); }), ev(LS_T, (e) => { cut(1.6)(e); impact(e, 1.6); G.game.hitstop(0.05); }),
      ev(4.62, (e) => lessonLine(e, true)), ev(5.05, flick)],
    recover: [4.12, 5.5],
  };

  // 「最後一課」 is said once, as the first final lesson begins — or, if she has only just spoken, after the cut lands
  function lessonLine(e, late) {
    if (e.lessonSaid || (!late && e.t - (e.sayT || -99) < 3.6)) return;
    e.lessonSaid = true; e.sayT = e.t; e.lineAt = Math.max(e.lineAt, e.t + 9); G.game.bark('c7_vegaLine4');
  }
  const MOVES = { form, form2, lunge, lunge2, stance, riposte, sever, sever2, wave, wave3, rain, rain2, lesson };
  const RED_MOVES = new Set([lunge, lunge2, riposte, sever, sever2, rain, rain2]);
  const LINES = ['c7_vegaLine1', 'c7_vegaLine2', 'c7_vegaLine3'];

  /* ================================ the type ================================ */
  TYPES.c7_boss = Object.assign({
    name: '薇格的殘響', en: 'THE ECHO OF ELAINE VEGA', w: 62, h: 184, hp: 2700, bal: 350, col: GOLD, boss: true, shards: 900,
    kbMul: 0.45, spawnT: 2.5, poise: true, scale: S, portrait: [2.0, 0.9],
    defeatDialog: 'c7_bossDefeat', phase2Bark: 'c7_bossP2', phase2Music: 'c7_boss2',
    init(e) {
      e.facing = -1; e.offY = 0;
      e.coatB = new Rig.Chain(8, 10.2, 0.07, 0.88); e.coatF = new Rig.Chain(6, 9.5, 0.085, 0.88); e.cape = new Rig.Chain(5, 9.5, 0.08, 0.87);
      e.trail = []; e.drops = []; e.splats = []; e.motes = []; e.after = []; e.lastMoves = [];
      e.rainAt = e.t + 11; e.stanceAt = e.t + 5; e.lessonAt = 0; e.lineAt = 0; e.lineIdx = 0; e.p2At = -99; e.stepT = -9;
      e.dripT = 0; e.moteT = 0; e.ghostT = 0; e.parries = 0;
      // count perfect guards against her (her praise in phase 2; a gold flare when her probing thrust is answered)
      const op = e.onParried;
      e.onParried = function (h) {
        e.parries = (e.parries || 0) + 1;
        const a = e.atk, whites = a && a.hits ? a.hits.filter((q) => !q.red).length : 0;
        if (a === stance) { G.FX.ring(e.x, e.y - 100, 10, 150, 0.5, GOLD, 5); G.FX.flash(e.x, e.y - 100, 160, 0.3, GOLD); }
        if (e.phase === 2 && whites >= 3 && e.parries >= whites) say('c7_vegaPraise', 20)(e);
        return op.call(e, h);
      };
    },
    voice: (e) => sfx('c7_voice', e.phase),
    weapon: (e) => tipW(e),
    think(e, dt) {
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) { G.game.bossPhase2(e); return; }
      if (e.phase === 2 && e.t - e.p2At < 2.1) { e.vx = U.approach(e.vx, 0, 1400 * dt); return; }   // the coat tears; the salute
      if (e.invuln) e.invuln = false;
      e.faceP();
      const d = e.distP(), p2 = e.phase === 2, sp = (p2 ? 175 : 140) * e.speedMul;
      // footwork: close in at a walk, give ground with a backstep when crowded, a ghost-step in phase 2 to close long gaps
      if (e.t - e.stepT < 0.32) { /* stepping */ }
      else if (d < 95 && e.cd > 0.35 && Math.random() < dt * 2.5) { e.stepT = e.t; e.stepDir = -1; e.vx = -e.facing * 420; }
      else if (p2 && d > 520 && e.cd > 0.4 && Math.random() < dt * 1.2) { e.stepT = e.t; e.stepDir = 1; e.vx = e.facing * 760; sfx('whoosh', 1); }
      else if (d > 270) e.vx = U.approach(e.vx, e.facing * sp, 800 * dt);
      else if (d < 140) e.vx = U.approach(e.vx, -e.facing * 70, 800 * dt);
      else e.vx = U.approach(e.vx, 0, 900 * dt);
      // phase 2: between attacks she talks — fragments of what she taught Rinne
      const lessonSoon = !e.lessonSaid && e.t > e.lessonAt - 3;
      if (p2 && e.lineIdx < LINES.length && e.t >= e.lineAt && e.cd > 0.3 && !lessonSoon && e.t - (e.sayT || -99) > 4) {
        G.game.bark(LINES[e.lineIdx++]); e.lineAt = e.t + 11 + Math.random() * 4; e.talkT = e.t; e.sayT = e.t; e.cd = Math.max(e.cd, 1.2);
        sfx('c7_voice', 2); G.FX.ring(e.x + e.facing * 10, e.y - 155, 6, 60, 0.6, GOLD, 2);
        return;
      }
      if (e.cd > 0) return;
      // melee only when the swing (reach ≈ 205 + the engine's step-in) can land
      const last = e.lastMoves[e.lastMoves.length - 1];
      const pool = !p2
        ? [['form', d < 310 ? 4 : 0], ['lunge', d > 200 ? (d < 560 ? 2.6 : 1.4) : 0.3], ['sever', d > 230 ? 2.1 : 0.4], ['wave', d > 280 ? 2.6 : 0.4],
          ['stance', d < 420 && e.t >= e.stanceAt ? 2.2 : 0], ['rain', e.t >= e.rainAt ? (d > 300 ? 2.6 : 1.4) : 0]]
        : [['form2', d < 310 ? 3 : 0], ['lesson', e.t >= e.lessonAt ? (d < 330 ? 5 : 1.2) : 0], ['lunge2', d > 200 ? 2.2 : 0.4], ['sever2', d > 230 ? 2.2 : 0.5],
          ['wave3', d > 270 ? 2.2 : 0.4], ['stance', d < 420 && e.t >= e.stanceAt ? 1.7 : 0], ['rain2', e.t >= e.rainAt ? 2.3 : 0]];
      const wgt = (p) => (p[0] === last ? p[1] * 0.15 : p[1]);
      const tot = pool.reduce((s, p) => s + wgt(p), 0);
      if (tot <= 0) return;
      let r = Math.random() * tot, pick = pool[0][0];
      for (const p of pool) { if ((r -= wgt(p)) <= 0) { pick = p[0]; break; } }
      if (pick === 'rain' || pick === 'rain2') e.rainAt = e.t + (p2 ? 15 : 13);
      if (pick === 'stance') e.stanceAt = e.t + (p2 ? 11 : 9);
      if (pick === 'lesson') e.lessonAt = e.t + 15;
      e.lastMoves.push(pick); if (e.lastMoves.length > 6) e.lastMoves.shift();
      e.parries = 0;
      e.startAtk(MOVES[pick]);
    },
    atkUpdate(e, dt) {
      const a = e.atk;
      if (e.ripostePending) { e.ripostePending = false; e.faceP(); e.startAtk(riposte); return; }
      // a swordmaster never runs through her pupil: forward steps stop once Rinne is already inside the blade's reach
      if (!e.dash && e.vx * e.facing > 0) { const ahead = (e.P.x - e.x) * e.facing; if (ahead < 125) e.vx = e.facing * Math.max(0, (ahead - 75) * 6); }
      if (a.upd) a.upd(e, dt);
    },
    // the counter stance: her perfect guard
    guard(e, h) {
      const a = e.state === 'atk' ? e.atk : null;
      if (!a) return false;
      const stanceOn = inWin(e.st, a.stance), rip = a === riposte && e.st < (a.parryWin || 0);
      if (!stanceOn && !rip) return false;
      e.faceP();
      const P = e.P, bx = e.tipW ? U.lerp(e.hiltW.x, e.tipW.x, 0.4) : e.x + e.facing * 40, by = e.tipW ? U.lerp(e.hiltW.y, e.tipW.y, 0.4) : e.y - 120;
      G.FX.star(bx, by, GOLDW, 110, 0.4); G.FX.ring(bx, by, 6, 80, 0.3, GOLD, 4); G.FX.spark(bx, by, 16, { col: GOLDW, speed: 700, dir: e.facing > 0 ? PI : 0, spread: 1.4 });
      sfx('c7_deflect'); G.game.shake(0.3); G.game.hitstop(0.05);
      if (P && P.onGround) P.vx = -P.facing * 260;
      e.deflectT = e.t;
      if (stanceOn) {
        e.ripostePending = true;
        if (e.phase === 2) say('c7_vegaParry', 14)(e);
      }
      return true;
    },
    onPhase2(e, game) {
      e.p2At = e.t; e.sayT = e.t; e.invuln = true; e.cd = 2.1; e.rainAt = e.t + 10; e.lessonAt = e.t + 5.5; e.lineAt = e.t + 4.5; e.stanceAt = e.t + 8;
      e.dash = null; e.ripostePending = false;
      sfx('c7_tear');
      const c = e.chestW || { x: e.x, y: e.y - 110 };
      G.FX.shards(c.x, c.y, 26, COL.coat, 600); G.FX.shards(c.x, c.y, 18, GOLD, 560);
      G.FX.ring(c.x, c.y, 20, 360, 0.9, GOLD, 7); G.FX.ember(c.x, c.y, 34, GOLD, { w: 90, h: 160, up: 240 });
      game.shake(0.8);
    },
    draw(ctx, e, ghost) { drawVega(ctx, e, !!ghost); },
  }, MOVES);

  /* ================================ rendering ================================ */
  function idlePose(e) { return e.phase === 2 ? IP.idle2(e.t) : IP.idle1(e.t); }
  function targetPose(e) {
    const st = e.state, a = st === 'atk' ? e.atk : null;
    let p, ground = true;
    if (st === 'spawn') {
      const k = U.clamp((e.st - 1.25) / 0.9, 0, 1);
      p = Rig.lerpPose(Rig.full(IP.kneel), Rig.full(IP.idle1(e.t)), U.easeInOutSine(k));
      if (e.st > 2.0) p = Rig.lerpPose(p, Rig.full(F.C2), Math.sin(U.clamp((e.st - 2.0) / 0.5, 0, 1) * PI));
    } else if (a && a.poses) {
      // bookends: the first key is wherever she was when the attack began, the last key is the live idle
      const keys = a.poses.keys;
      if (e.atkRef !== a || e.st < (e.atkSt ?? 0)) { e.atkRef = a; const p0 = { ...(e.pose || Rig.full(idlePose(e))) }; p0.rot = Math.atan2(Math.sin(p0.rot || 0), Math.cos(p0.rot || 0)); e.atkPose0 = p0; }
      e.atkSt = e.st;
      const lastK = keys[keys.length - 1], tail = !lastK[1] || (lastK[1].rot != null && Object.keys(lastK[1]).length === 1);
      const body = tail ? keys.slice(1, -1) : keys.slice(1);
      p = Rig.sample({ keys: [[0, keys[0][1] || e.atkPose0]].concat(body) }, e.st);
      if (tail) {
        const pk = body[body.length - 1][0], k = U.clamp((e.st - pk) / (lastK[0] - pk || 1), 0, 1);
        if (k > 0) p = Rig.lerpPose(p, Rig.full({ ...idlePose(e), rot: lastK[1] ? lastK[1].rot : 0 }), U.easeInOutSine(k));
      }
      if (inWin(e.st, a.air)) ground = false;
    } else if (st === 'broken') p = Rig.full(IP.broken(e.t));
    else if (st === 'die') p = Rig.full(IP.kneel);
    else if (st === 'hurt' || st === 'recoil' || st === 'executed') {
      const w = st === 'recoil' ? Math.sin(Math.min(1, e.st / 0.6) * PI) : 1;
      p = Rig.lerpPose(Rig.full(idlePose(e)), Rig.full(IP.hurt), w);
    } else if (e.phase === 2 && e.t - e.p2At < 2.1) {
      // the coat tears; she folds over the light — then straightens and salutes her student before the last lesson
      const k = e.t - e.p2At;
      if (k < 0.6) p = Rig.full(IP.clutch);
      else if (k < 1.55) p = Rig.lerpPose(Rig.full(IP.clutch), Rig.full(IP.salute), U.easeInOutSine(U.clamp((k - 0.6) / 0.4, 0, 1)));
      else p = Rig.lerpPose(Rig.full(IP.salute), Rig.full(IP.idle2(e.t)), U.easeInOutSine(U.clamp((k - 1.55) / 0.45, 0, 1)));
      if (k > 1.0 && !e.saluted && G.game.dtVis > 0) { e.saluted = true; sfx('c7_salute'); const tw = tipW(e); G.FX.star(tw.x, tw.y, GOLDW, 70, 0.5); G.FX.ring(tw.x, tw.y, 4, 60, 0.4, GOLD, 3); }
    } else if (e.t - e.stepT < 0.32) {
      p = Rig.full(e.stepDir < 0 ? IP.backstep : IP.dash); ground = e.stepDir < 0 ? true : true;
    } else if (e.talkT != null && e.t - e.talkT < 1.4) {
      p = Rig.lerpPose(Rig.full(idlePose(e)), Rig.full(IP.talk(e.t)), Math.sin(U.clamp((e.t - e.talkT) / 1.4, 0, 1) * PI));
    } else if (Math.abs(e.vx) > 25 && e.onGround) {
      const prev = Math.floor((e.gaitP || 0) / PI), dtv = G.game.dtVis || 0;
      e.gaitP = (e.gaitP || 0) + Math.abs(e.vx) * dtv * PI / (2 * 15) * Math.sign(e.vx * e.facing || 1);
      if (Math.floor(e.gaitP / PI) !== prev && dtv > 0 && Math.abs(e.x - e.P.x) < 900) G.SFX.play('stepOn', 'concrete', 0.8);
      const w = Rig.ANIM.walk(e.gaitP), base = idlePose(e);
      p = Rig.full({ ...base, ik: 1, fFx: w.fFx * 1.25 + 5, fFy: w.fFy * 1.4, fBx: w.fBx * 1.25 - 5, fBy: w.fBy * 1.4, ry: w.ry + (e.phase === 2 ? 7 : 4), torso: base.torso + 0.06 });
    } else p = Rig.full(idlePose(e));
    p = Rig.full(p);
    if (ground && !p.ik && p.rot === 0) p = Rig.groundify(p);
    else if (ground && !p.ik && Math.abs(Math.sin(p.rot)) < 1e-3) { const r = p.rot; p.rot = 0; p = Rig.groundify(p); p.rot = r; }
    const hk = e.hitK;
    if (hk > 0) p = Rig.lerpPose(Rig.full(p), Rig.full({ ...p, torso: p.torso - 0.2, head: p.head + 0.3, ry: p.ry + 3 }), Math.min(1, hk));
    return p;
  }
  function blendTo(e, tgt, dt, k) {
    if (!e.pose) { e.pose = { ...tgt }; return; }
    let tr = tgt.rot; while (tr - e.pose.rot > PI) tr -= TAU; while (tr - e.pose.rot < -PI) tr += TAU;
    const t2 = { ...tgt, rot: tr };
    // attacks are sampled from a curve that already starts at her pose: follow it exactly, so the blade is where the hit is
    if (k <= 0) { e.pose = t2; return; }
    e.pose = Rig.lerpPose(e.pose, t2, 1 - Math.exp(-k * dt));
  }
  // the free arm: behind the back while she is testing (phase 1), on the hilt once she means it
  function armRule(e, pose) {
    const p = { ...pose };
    if (e.phase === 1 || e.state === 'spawn') {
      const free = e.state === 'broken' || e.state === 'die';
      if (!free) behindBack(p);
    }
    return p;
  }

  function updCloth(e, J, dt, look) {
    if (dt <= 0) return;
    const f = e.facing, wind = -e.vx * 2.6 + Math.sin(e.t * 1.1) * 220 + Math.sin(e.t * 2.9) * 80;
    const B = 260 + look.p2 * 900;   // the Rest pulls her ink upward a little; more once the coat tears
    const lift = (c, k) => { if (!c.inited) return; for (let i = 1; i < c.n; i++) c.p[i].y -= B * k * dt * dt * (0.2 + 0.8 * i / c.n); };
    const tq = torsoFrame(J), W = (p) => toW(e, p);
    let a = W(tq.Q(0.0, -9.5)); e.coatB.update(a.x, a.y, f, dt, wind, 2.62 - look.p2 * 0.22); lift(e.coatB, 0.5);
    a = W(tq.Q(-0.04, 8)); e.coatF.update(a.x, a.y, f, dt, wind * 0.7, PI - 0.08); lift(e.coatF, 0.4);
    a = W(tq.Q(1.02, -6.5)); e.cape.update(a.x, a.y, f, dt, wind * 1.2, 2.5 - look.p2 * 0.3); lift(e.cape, 0.9);
    // cloth rests on the floor instead of sinking through it
    const fl = floorY(e) - 4;
    if (e.state !== 'spawn') for (const c of [e.coatB, e.coatF, e.cape]) if (c.inited) for (let i = 1; i < c.n; i++) if (c.p[i].y > fl) { c.p[i].y = fl; c.p[i].py = Math.max(c.p[i].py, fl - 1); }
  }

  function drawVega(ctx, e, ghost) {
    const dt = ghost ? 0 : (G.game.dtVis || 0);
    const st = e.state, a = st === 'atk' ? e.atk : null;
    // ---------- pose ----------
    blendTo(e, targetPose(e), dt, st === 'atk' && e.atk && e.atk.poses ? 0 : e.hitK > 0 ? 40 : 11);
    const pose = armRule(e, e.pose);
    const J = Rig.compute(pose); e.J = J;
    const bg = bladeGeo(J);
    // ---------- staging: spawn rise, aerial forms, death ----------
    let offY = 0, alpha = 1, clipFloor = false, dissolve = 0;
    if (st === 'spawn') {
      const k = U.clamp((e.st - 0.35) / 1.3, 0, 1);
      offY = 175 * (1 - U.easeOutCubic(k)); clipFloor = true;
      if (!ghost && e.st > 1.75 && !e.woke) { e.woke = true; sfx('c7_wake'); G.FX.flash(e.x + e.facing * 10, e.y - 150, 90, 0.4, GOLD); G.game.shake(0.3); }
      if (!ghost && e.st > 2.1 && !e.flicked) { e.flicked = true; flick(e); }
    } else if (a && inWin(e.st, a.air)) offY = -Math.sin(PI * (e.st - a.air[0]) / (a.air[1] - a.air[0])) * 95;
    if (st === 'die') { dissolve = U.clamp(e.st / 0.5, 0, 1); if (!ghost && !e.fell) { e.fell = true; sfx('c7_fall'); } if (!ghost && e.st > 0.44 && !e.remnant) spawnRemnant(e, pose); if (e.remnant) return; }
    e.offY = offY;
    const p2 = e.phase === 2 ? U.clamp((e.t - e.p2At - 0.3) / 0.9, 0, 1) : 0;
    const look = buildLook(e, a, p2, dissolve);
    look.floorL = (floorY(e) - e.y - offY) / S;
    // world-space caches for tells, hits and hazards
    e.tipW = toW(e, bg.tip); e.hiltW = toW(e, J.hdF); e.headW = toW(e, J.head); e.chestW = toW(e, J.chest);
    updCloth(e, J, dt, look);
    if (dt > 0) { updParticles(e, J, dt, look, offY); sampleTrail(e, a, dt); sampleAfter(e, a, dt); }

    GHOST = ghost;
    ctx.save();
    if (clipFloor) { ctx.beginPath(); ctx.rect(e.x - 500, e.y - 900, 1000, 900); ctx.clip(); }
    if (!ghost) { drawPool(ctx, e, look); drawAfter(ctx, e); if (a && a.aim && e.sevAim && inWin(e.st, a.aim)) drawAim(ctx, e, a); }
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.save();
    ctx.translate(e.x, e.y + offY); ctx.scale(e.facing * S, S);
    const toL = (q) => ({ x: (q.x - e.x) * e.facing / S, y: (q.y - e.y - offY) / S });
    drawBody(ctx, e, J, pose, bg, look, toL, ghost);
    ctx.restore();
    if (!ghost) { drawTrail(ctx, e); drawParticles(ctx, e); if (st === 'broken') drawDazed(ctx, e, J); }
    ctx.restore();
    GHOST = false;
  }
  // 斷弦's path: a string drawn taut across the floor toward (and past) you — dotted while she aims, solid once locked
  function drawAim(ctx, e, a) {
    const s = e.sevAim, y = floorY(e) - 62, k = U.clamp((e.st - a.aim[0]) / (a.aim[1] - a.aim[0]), 0, 1), x0 = e.x + e.facing * 30, x1 = s.x1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    if (!s.locked) { ctx.setLineDash([12, 10]); ctx.lineDashOffset = -e.t * 120; }
    ctx.strokeStyle = U.rgba(CRIM, 0.2 + 0.4 * k); ctx.lineWidth = s.locked ? 10 : 3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.setLineDash([]);
    if (s.locked) { ctx.strokeStyle = U.rgba(REDW, 0.85); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x0, y + Math.sin(e.t * 60) * 1.2); ctx.lineTo(x1, y); ctx.stroke(); }
    K.glow(ctx, x1, y, 26, CRIM, 0.3 + 0.4 * k);
    ctx.strokeStyle = U.rgba(REDW, 0.7); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y - 16); ctx.lineTo(x1, y + 16); ctx.stroke();
    ctx.restore();
  }

  function buildLook(e, a, p2, dissolve) {
    const st = e.st;
    const red = a && (RED_MOVES.has(a) || (a === lesson && st > 3.05));
    let blade = 0;
    if (a && a.charge) for (const w of a.charge) if (inWin(st, w)) blade = U.clamp((st - w[0]) / (w[1] - w[0]), 0, 1);
    if (a === lesson && st > 3.05 && st < LS_T + 0.1) blade = U.clamp((st - 3.05) / 0.8, 0, 1);
    if (a && (a === sever || a === sever2) && st > 0.15 && st < 0.9) blade = U.clamp((st - 0.15) / 0.6, 0, 1);
    const stanceK = a && a.stance ? (st < a.stance[0] ? st / a.stance[0] : st < a.stance[1] ? 1 : Math.max(0, 1 - (st - a.stance[1]) / 0.25)) : 0;
    const shoulder = e.shoulderT != null ? Math.max(0, 1 - (e.t - e.shoulderT) / 0.35) : 0;
    const deflect = e.deflectT != null ? Math.max(0, 1 - (e.t - e.deflectT) / 0.3) : 0;
    const spawnEyes = e.state === 'spawn' ? U.clamp((e.st - 1.7) / 0.25, 0, 1) : 1;
    return { p2, red: !!red, blade, stance: stanceK, shoulder, deflect, eyes: (1 - stanceK * 0.85) * spawnEyes, dissolve, floorL: 0 };
  }

  /* --------- particles: ink drips from the hem, splats on the floor, gold motes rising --------- */
  function updParticles(e, J, dt, look, offY) {
    const fy = floorY(e), lq = LQ();
    e.dripT -= dt;
    if (e.dripT <= 0 && e.coatB.inited && e.state !== 'spawn') {
      e.dripT = (lq ? 0.5 : 0.24) / (1 + look.p2) * U.rand(0.6, 1.4);
      const src = Math.random() < 0.6 ? e.coatB : e.coatF;
      if (src.inited) { const q = src.p[src.n - 1]; e.drops.push({ x: q.x + U.rand(-6, 6), y: q.y, vx: e.vx * 0.2, vy: 30, s: U.rand(1.6, 3.2), gold: look.p2 > 0.5 && Math.random() < 0.35 }); }
    }
    if (e.state === 'spawn' && Math.random() < 0.5) e.drops.push({ x: e.x + U.rand(-30, 30), y: e.y - U.rand(20, 160) + offY, vx: 0, vy: 60, s: U.rand(1.6, 3.4) });
    for (let i = e.drops.length - 1; i >= 0; i--) {
      const d = e.drops[i];
      if (d.gold) { d.vy -= 260 * dt; d.y += d.vy * dt; d.x += Math.sin(e.t * 4 + i) * 12 * dt; if (d.y < fy - 260) e.drops.splice(i, 1); continue; }
      d.vy += 900 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.y >= fy) { if (e.splats.length < 14) e.splats.push({ x: d.x, y: fy, t: 0, s: d.s * 2.2, life: 1.2 }); e.drops.splice(i, 1); }
    }
    if (e.drops.length > 24) e.drops.splice(0, e.drops.length - 24);
    for (let i = e.splats.length - 1; i >= 0; i--) { const s = e.splats[i]; s.t += dt; if (s.t > s.life) e.splats.splice(i, 1); }
    // gold motes from the shoulders and hair
    e.moteT -= dt;
    if (e.moteT <= 0 && e.state !== 'die') {
      e.moteT = (lq ? 0.6 : 0.3) / (1 + look.p2 * 1.5);
      const src = Math.random() < 0.5 ? J.sh : J.head, w = toW(e, src);
      e.motes.push({ x: w.x + U.rand(-14, 14), y: w.y + U.rand(-8, 12), vy: -U.rand(30, 70), t: 0, life: U.rand(1.0, 1.8), ph: Math.random() * 9 });
    }
    for (let i = e.motes.length - 1; i >= 0; i--) { const m = e.motes[i]; m.t += dt; m.y += m.vy * dt; m.x += Math.sin(m.t * 3 + m.ph) * 16 * dt; if (m.t > m.life) e.motes.splice(i, 1); }
    if (e.motes.length > 18) e.motes.splice(0, e.motes.length - 18);
  }
  function drawParticles(ctx, e) {
    ctx.fillStyle = INKC;
    for (const d of e.drops) {
      if (d.gold) continue;
      ctx.beginPath(); ctx.moveTo(d.x, d.y - d.s * 2.2); ctx.quadraticCurveTo(d.x + d.s, d.y, d.x, d.y + d.s * 0.6); ctx.quadraticCurveTo(d.x - d.s, d.y, d.x, d.y - d.s * 2.2); ctx.fill();
    }
    for (const s of e.splats) {
      const k = 1 - s.t / s.life; ctx.globalAlpha = 0.85 * k;
      ctx.beginPath(); ctx.ellipse(s.x, s.y - 0.5, s.s * (1 + s.t * 0.4), s.s * 0.28, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of e.motes) {
      const k = Math.sin(Math.min(1, m.t / m.life) * PI), s = 0.8 + k * 1.0;
      ctx.fillStyle = U.rgba(GOLD, 0.75 * k);
      ctx.beginPath(); ctx.moveTo(m.x, m.y - s * 1.6); ctx.lineTo(m.x + s * 0.6, m.y); ctx.lineTo(m.x, m.y + s * 1.6); ctx.lineTo(m.x - s * 0.6, m.y); ctx.closePath(); ctx.fill();
    }
    for (const d of e.drops) if (d.gold) { ctx.fillStyle = U.rgba(GOLD, 0.8); ctx.beginPath(); ctx.arc(d.x, d.y, d.s * 0.7, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // the ink she stands in: a pool that ripples with every breath (a ring of staff lines while she waits in her stance)
  function drawPool(ctx, e, look) {
    const fy = floorY(e), x = e.x, sp = e.state === 'spawn' ? U.clamp(e.st / 0.45, 0, 1) : 1, gone = look.dissolve;
    const rx = (64 + 8 * Math.sin(e.t * 1.4)) * sp * (1 - gone * 0.5);
    ctx.fillStyle = 'rgba(9,6,16,0.55)'; ctx.beginPath(); ctx.ellipse(x, fy, rx, 7 * sp, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(9,6,16,0.8)'; ctx.beginPath(); ctx.ellipse(x - e.facing * 4, fy, rx * 0.55, 4 * sp, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const ph = (e.t * 0.6) % 1;
    ctx.strokeStyle = U.rgba(GOLD, 0.35 * (1 - ph) * sp); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, fy, 30 + ph * 70, 3 + ph * 6, 0, 0, TAU); ctx.stroke();
    if (look.stance > 0) {
      const k = look.stance;
      for (let i = 0; i < 5; i++) { ctx.strokeStyle = U.rgba(GOLDW, (0.5 - i * 0.07) * k); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, fy, 96 + i * 6, 9 + i * 1.5, 0, 0, TAU); ctx.stroke(); }
      K.glow(ctx, x, fy - 6, 120, GOLD, 0.16 * k);
    }
    ctx.restore();
  }

  /* --------- blade smear: an ink brush stroke through the air, edged white (or red) --------- */
  function sampleTrail(e, a, dt) {
    const now = e.t;
    // only the cut itself (not the wind-up): hilt position + blade angle, so the arc can be rebuilt smoothly between frames
    const near = a && ((a.hits || []).some((h) => e.st >= h.t0 - 0.015 && e.st <= h.t1 + 0.03) || (e.dash && e.st >= e.dash.t0 && e.st <= e.dash.t1));
    if (near && e.tipW) {
      const dx = e.tipW.x - e.hiltW.x, dy = e.tipW.y - e.hiltW.y;
      e.trail.push({ hx: e.hiltW.x, hy: e.hiltW.y, ang: Math.atan2(dy, dx), len: Math.hypot(dx, dy), t: now, red: e.tellCol === 'red' });
    } else if (e.trail.length && now - e.trail[e.trail.length - 1].t > 0.05) e.trail.length = 0;
    while (e.trail.length && (now - e.trail[0].t > 0.12 || e.trail.length > 10)) e.trail.shift();
  }
  function drawTrail(ctx, e) {
    const p = e.trail; if (p.length < 2) return;
    const now = e.t, life = 0.12, red = p[p.length - 1].red;
    // rebuild the arc: between samples, interpolate the hilt linearly and the blade angle along the short way round
    const pts = [];
    for (let i = 1; i < p.length; i++) {
      const A = p[i - 1], B = p[i];
      let da = B.ang - A.ang; while (da > PI) da -= TAU; while (da < -PI) da += TAU;
      const n = Math.max(1, Math.ceil(Math.abs(da) / 0.12));
      for (let j = i === 1 ? 0 : 1; j <= n; j++) {
        const u = j / n, a = A.ang + da * u, hx = U.lerp(A.hx, B.hx, u), hy = U.lerp(A.hy, B.hy, u), L = U.lerp(A.len, B.len, u);
        pts.push({ ix: hx + Math.cos(a) * L * 0.55, iy: hy + Math.sin(a) * L * 0.55, tx: hx + Math.cos(a) * L, ty: hy + Math.sin(a) * L, k: Math.max(0, 1 - (now - U.lerp(A.t, B.t, u)) / life) });
      }
    }
    if (pts.length < 2) return;
    ctx.save(); ctx.beginPath(); ctx.rect(e.x - 1200, floorY(e) - 1200, 2400, 1200); ctx.clip();
    // an ink brush stroke through the air, thickening toward the newest edge
    ctx.beginPath(); ctx.moveTo(pts[0].tx, pts[0].ty);
    for (const q of pts) ctx.lineTo(q.tx, q.ty);
    for (let i = pts.length - 1; i >= 0; i--) { const q = pts[i]; ctx.lineTo(U.lerp(q.tx, q.ix, q.k), U.lerp(q.ty, q.iy, q.k)); }
    ctx.closePath(); ctx.fillStyle = 'rgba(13,11,22,0.62)'; ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const col = red ? CRIM : '#ffffff';
    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.tx, q.ty) : ctx.moveTo(q.tx, q.ty)));
    ctx.strokeStyle = U.rgba(col, 0.32); ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = U.rgba(red ? REDW : '#ffffff', 0.92); ctx.lineWidth = 2.2; ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  /* --------- afterimages: ink ghosts left behind on every dash --------- */
  function sampleAfter(e, a, dt) {
    const on = (a && a.ghost && a.ghost.some((w) => inWin(e.st, w))) || (e.state === 'idle' && e.t - e.stepT < 0.3 && e.stepDir > 0);
    e.ghostT -= dt;
    if (on && e.ghostT <= 0) { e.ghostT = 0.035; e.after.push({ x: e.x, y: e.y + (e.offY || 0), facing: e.facing, pose: { ...armRule(e, e.pose) }, t: e.t }); }
    while (e.after.length && (e.t - e.after[0].t > 0.32 || e.after.length > 8)) e.after.shift();
  }
  function drawAfter(ctx, e) {
    // gold ghosts of where she just was (the engine's dodge ghosts speak the same language, in Rinne's cyan)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of e.after) {
      const k = 1 - (e.t - s.t) / 0.32; if (k <= 0) continue;
      const J = Rig.compute(s.pose), bg = bladeGeo(J);
      ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.facing * S, S); ctx.globalAlpha = 0.5 * k * k;
      const c = U.rgba(GOLD, 0.45), c2 = U.rgba(GOLD, 0.3);
      ctx.beginPath(); ctx.moveTo(J.sh.x - 7, J.sh.y - 1); ctx.quadraticCurveTo(J.hip.x - 20, J.hip.y + 14, J.hip.x - 24, J.hip.y + 44); ctx.lineTo(J.hip.x + 8, J.hip.y + 34); ctx.lineTo(J.chest.x + 7, J.chest.y + 4); ctx.closePath(); ctx.fillStyle = c2; ctx.fill();
      Rig.limb(ctx, J.hip, J.kneeB, 7, 5, c2); Rig.limb(ctx, J.kneeB, J.ankB, 5, 3.5, c2);
      Rig.limb(ctx, J.hip, J.kneeF, 7, 5, c); Rig.limb(ctx, J.kneeF, J.ankF, 5, 3.5, c);
      Rig.limb(ctx, J.hip, J.chest, 8.5, 8.5, c);
      Rig.limb(ctx, J.sh, J.elF, 4.8, 4, c); Rig.limb(ctx, J.elF, J.hdF, 4, 3.2, c);
      ctx.beginPath(); ctx.arc(J.head.x, J.head.y, 11, 0, TAU); ctx.fillStyle = c; ctx.fill();
      ctx.strokeStyle = U.rgba(GOLDW, 0.9); ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(J.hdF.x, J.hdF.y); ctx.lineTo(bg.tip.x, bg.tip.y); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  /* ================================ the body ================================ */
  function drawBody(ctx, e, J, pose, bg, look, toL, ghost) {
    const tq = torsoFrame(J), Q = tq.Q, p2 = look.p2, t = e.t;
    // back-light: her own gold, lifting the dark silhouette off any background
    glow(ctx, J.chest.x - 6, J.chest.y + 12, 78 + p2 * 34, GOLD, (0.1 + 0.1 * p2) * (1 - look.dissolve));
    if (look.dissolve > 0) ctx.globalAlpha *= 1 - look.dissolve * 0.35;
    // ---------- behind the body ----------
    drawWisps(ctx, J, look, t);
    if (e.cape.inited) drawCape(ctx, e.cape.p.map(toL), Q, look, t);
    if (e.coatB.inited) inkPanel(ctx, e.coatB.p.map(toL), 7.0, 16.5, COL.coatD, { lining: COL.lining, trim: GOLDD, t, seed: 1, tongues: [12, 20, 10, 17, 9], tears: p2 });
    drawBackArm(ctx, J, e, look);
    drawLeg(ctx, J, false);
    // ---------- torso ----------
    drawTorso(ctx, J, tq, look, e);
    drawLeg(ctx, J, true);
    if (e.coatF.inited) inkPanel(ctx, e.coatF.p.map(toL), 3.4, 5.8, COL.coat, { lining: COL.lining, trim: GOLD, t, seed: 4, tongues: [9, 13, 7], front: true });
    // ---------- collar, head ----------
    Rig.limb(ctx, J.chest, lerpP(J.chest, J.head, 0.5), 3.4, 3.1, 'rgb(170,152,168)'); ink(ctx, 0.8);
    drawCollar(ctx, Q, J, look);
    drawHead(ctx, J, e, look, ghost);
    // ---------- blade + front arm ----------
    drawBlade(ctx, J, bg, look, e);
    drawFrontArm(ctx, J, e, look);
    drawEpaulette(ctx, J, tq, look, e);
    // tell glow at the tip (the engine's star sits there too)
    if (e.tellT > 0) glow(ctx, bg.tip.x, bg.tip.y, 26, e.tellCol === 'red' ? CRIM : '#ffffff', e.tellT * 1.4);
    // the late cut's cue: her shoulders flare gold the instant she commits
    if (look.shoulder > 0) { glow(ctx, J.sh.x, J.sh.y, 34, GOLDW, 0.9 * look.shoulder); glow(ctx, J.sh.x, J.sh.y, 12, '#ffffff', look.shoulder); }
  }

  // the echo frays at the edges: thin brush strokes of ink lift off her shoulders and hair (gold once the coat tears)
  function drawWisps(ctx, J, look, t) {
    const n = LQ() ? 2 : 3, k = 1 - look.dissolve;
    for (let i = 0; i < n; i++) {
      const base = i === 1 ? J.shB : J.head, ph = t * (0.7 + i * 0.19) + i * 2.3;
      const bx = base.x - 6 - i * 2, by = base.y - (i === 1 ? 0 : 6);
      const len = (30 + 10 * Math.sin(ph * 0.6 + i)) * (1 + look.p2 * 0.4), pts = [];
      // curls back and away (the Rest pulls her ink behind her), thinning to nothing
      for (let j = 0; j <= 7; j++) { const u = j / 7; pts.push({ x: bx - u * 16 - u * u * 14 + Math.sin(ph + u * 4) * 5 * u, y: by - u * len + u * u * 8 }); }
      Rig.ribbon(ctx, pts, 1.7 - (i === 1) * 0.5, 0.05, look.p2 > 0.4 ? U.rgba(GOLD, 0.26 * k) : `rgba(13,11,22,${0.32 * k})`);
    }
  }

  // cloth panel along a chain, ending in tapering ink brush tongues (an echo's hem never quite ends)
  function inkPanel(ctx, pts, w0, w1, col, o) {
    const n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = U.lerp(w0, w1, i / (n - 1));
      L.push({ x: pts[i].x - dy / d * w, y: pts[i].y + dx / d * w }); R.push({ x: pts[i].x + dy / d * w, y: pts[i].y - dx / d * w });
    }
    const end = pts[n - 1], pre = pts[n - 2], ex = end.x - pre.x, ey = end.y - pre.y, el = Math.hypot(ex, ey) || 1, ux = ex / el, uy = ey / el;
    const tg = o.tongues, m = tg.length;
    const path = () => {
      ctx.beginPath(); ctx.moveTo(L[0].x, L[0].y);
      for (let i = 1; i < n; i++) { const mm = lerpP(L[i - 1], L[i], 0.5); ctx.quadraticCurveTo(L[i - 1].x, L[i - 1].y, mm.x, mm.y); }
      ctx.lineTo(L[n - 1].x, L[n - 1].y);
      for (let k = 0; k < m; k++) {
        const pa = lerpP(L[n - 1], R[n - 1], k / m), pb = lerpP(L[n - 1], R[n - 1], (k + 1) / m), mid = lerpP(pa, pb, 0.5);
        const sway = Math.sin(o.t * 3.1 + k * 1.9 + o.seed) * 2.6, len = tg[k] * (0.85 + 0.15 * Math.sin(o.t * 2.3 + k));
        const tip = { x: mid.x + ux * len - uy * sway, y: mid.y + uy * len + ux * sway };
        ctx.quadraticCurveTo(pa.x + ux * len * 0.55, pa.y + uy * len * 0.55, tip.x, tip.y);
        ctx.quadraticCurveTo(pb.x + ux * len * 0.35, pb.y + uy * len * 0.35, pb.x, pb.y);
      }
      for (let i = n - 1; i > 0; i--) { const mm = lerpP(R[i], R[i - 1], 0.5); ctx.quadraticCurveTo(R[i].x, R[i].y, mm.x, mm.y); }
      ctx.lineTo(R[0].x, R[0].y); ctx.closePath();
    };
    const mid = pts[n >> 1];
    path(); ctx.fillStyle = cel(ctx, mid, 1, 0, Math.max(w0, w1) + 6, col); ctx.fill();
    ctx.save(); path(); ctx.clip();
    // lining on the trailing edge, dry-brush streaks, a darker wash toward the hem (ink bleeding down the cloth)
    if (o.lining) { ctx.fillStyle = o.lining; ctx.beginPath(); for (let i = 0; i < n; i++) ctx.lineTo(lerpP(L[i], pts[i], 0.35).x, lerpP(L[i], pts[i], 0.35).y); for (let i = n - 1; i >= 0; i--) ctx.lineTo(L[i].x - 3, L[i].y); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = 'rgba(205,208,235,0.13)'; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
    for (const k of [0.25, 0.5, 0.7]) { ctx.beginPath(); for (let i = 1; i < n - 1; i++) { const q = lerpP(L[i], R[i], k); i === 1 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); } ctx.stroke(); }
    // ink bleeding down the cloth: two flat washes darkening toward the hem
    for (const [u0, al] of [[0.55, 0.28], [0.78, 0.4]]) { const i0 = Math.floor(u0 * (n - 1)); ctx.fillStyle = `rgba(6,4,12,${al})`; ctx.beginPath(); ctx.moveTo(L[i0].x, L[i0].y); for (let i = i0; i < n; i++) ctx.lineTo(L[i].x, L[i].y); ctx.lineTo(L[n - 1].x + ux * 30, L[n - 1].y + uy * 30); ctx.lineTo(R[n - 1].x + ux * 30, R[n - 1].y + uy * 30); for (let i = n - 1; i >= i0; i--) ctx.lineTo(R[i].x, R[i].y); ctx.closePath(); ctx.fill(); }
    // phase 2: the cloth shreds from the hem up — long slits with gold light pouring through
    if (o.tears > 0) {
      const tk = o.tears;
      for (const [u0, sx, w] of [[0.28, -0.26, 1.15], [0.42, 0.12, 0.9], [0.5, 0.36, 0.75], [0.6, -0.04, 0.7]]) {
        const i0 = Math.floor(u0 * (n - 1)), lp = [], rp = [];
        for (let i = i0; i < n; i++) {
          const u = (i - i0) / Math.max(1, n - 1 - i0), c = lerpP(L[i], R[i], 0.5 + sx), a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ww = (0.4 + 2.6 * u) * w * tk * (1 + 0.25 * Math.sin(o.t * 5 + i * 1.7));
          lp.push({ x: c.x - dy / d * ww, y: c.y + dx / d * ww }); rp.push({ x: c.x + dy / d * ww * 0.8, y: c.y - dx / d * ww * 0.8 });
        }
        const last = lerpP(lp[lp.length - 1], rp[rp.length - 1], 0.5), tipP = { x: last.x + ux * 16, y: last.y + uy * 16 };
        const slit = () => { ctx.beginPath(); ctx.moveTo(lp[0].x, lp[0].y); for (let j = 1; j < lp.length; j++) ctx.lineTo(lp[j].x + (j % 2 ? 0.8 : -0.6), lp[j].y); ctx.lineTo(tipP.x, tipP.y); for (let j = rp.length - 1; j >= 0; j--) ctx.lineTo(rp[j].x + (j % 2 ? -0.7 : 0.5), rp[j].y); ctx.closePath(); };
        slit(); ctx.fillStyle = '#7a4c12'; ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        slit(); ctx.fillStyle = U.rgba(GOLD, 0.85 * tk); ctx.fill();
        ctx.strokeStyle = U.rgba(GOLDW, 0.9 * tk); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(lerpP(lp[0], rp[0], 0.5).x, lerpP(lp[0], rp[0], 0.5).y); for (let j = 1; j < lp.length; j++) { const m = lerpP(lp[j], rp[j], 0.5); ctx.lineTo(m.x, m.y); } ctx.stroke();
        ctx.restore();
        slit(); ink(ctx, 0.9);
      }
    }
    ctx.restore();
    path(); ink(ctx, 1.15);
    if (o.tears > 0 && !GHOST) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < m; k++) {
        const pa = lerpP(L[n - 1], R[n - 1], k / m), pb = lerpP(L[n - 1], R[n - 1], (k + 1) / m), mid = lerpP(pa, pb, 0.5), len = tg[k] * (0.85 + 0.15 * Math.sin(o.t * 2.3 + k));
        const sway = Math.sin(o.t * 3.1 + k * 1.9 + o.seed) * 2.6, tip = { x: mid.x + ux * len - uy * sway, y: mid.y + uy * len + ux * sway };
        ctx.strokeStyle = U.rgba(GOLD, 0.75 * o.tears); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(lerpP(mid, tip, 0.45).x, lerpP(mid, tip, 0.45).y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      }
      ctx.restore();
    }
    // gold trim on the leading edge
    if (o.trim) {
      const E = (R[n >> 1].x > L[n >> 1].x) === !!o.front ? R : L;
      ctx.strokeStyle = o.trim; ctx.lineWidth = 1.0; ctx.beginPath(); for (let i = 0; i < n; i++) { const q = lerpP(E[i], pts[i], 0.14); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); } ctx.stroke();
    }
  }

  // the captain's short cape: hangs from the collar over the back shoulder (VII on it, in gold)
  function drawCape(ctx, pts, Q, look, t) {
    const n = pts.length, p2 = look.p2;
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = U.lerp(7, 11.5, i / (n - 1));
      L.push({ x: pts[i].x - dy / d * w, y: pts[i].y + dx / d * w }); R.push({ x: pts[i].x + dy / d * w, y: pts[i].y - dx / d * w });
    }
    ctx.beginPath(); ctx.moveTo(L[0].x, L[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(L[i].x, L[i].y);
    // scalloped hem (ragged once torn)
    for (let k = 1; k <= 4; k++) { const q = lerpP(L[n - 1], R[n - 1], k / 4), j = p2 > 0 ? (k % 2 ? 6 : -1) * p2 + 2 : 2.4 * Math.sin(k * 1.3 + t * 2); ctx.quadraticCurveTo(lerpP(L[n - 1], R[n - 1], (k - 0.5) / 4).x, lerpP(L[n - 1], R[n - 1], (k - 0.5) / 4).y + 3 + j, q.x, q.y); }
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
    ctx.closePath();
    ctx.fillStyle = cel(ctx, pts[n >> 1], 1, 0, 14, COL.mantle); ctx.fill(); ink(ctx, 1.1);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.9; ctx.beginPath(); for (let k = 0; k <= 8; k++) { const q = lerpP(L[n - 1], R[n - 1], k / 8); k ? ctx.lineTo(q.x, q.y + 1.6 * Math.sin(k)) : ctx.moveTo(q.x, q.y); } ctx.stroke();
    if (p2 > 0) { const c = lerpP(pts[2], pts[3], 0.5); glow(ctx, c.x, c.y, 16, GOLD, 0.5 * p2); }
  }

  function drawBackArm(ctx, J, e, look) {
    // dark coat sleeve, gold cuff, glove — behind her back in phase 1, on the hilt in phase 2
    Rig.limbChain(ctx, [J.shB, lerpP(J.shB, J.elB, 0.5), J.elB, J.hdB], [5.0, 4.6, 3.9, 3.2], COL.sleeveD);
    const c0 = lerpP(J.elB, J.hdB, 0.68), c1 = lerpP(J.elB, J.hdB, 0.84);
    Rig.limb(ctx, c0, c1, 3.9, 3.7, 'rgb(28,31,49)'); ink(ctx, 0.8);
    ctx.strokeStyle = GOLDD; ctx.lineWidth = 0.9; poly(ctx, [c1, lerpP(J.elB, J.hdB, 0.86)], false); ctx.stroke();
    Rig.limb(ctx, lerpP(J.elB, J.hdB, 0.88), lerpP(J.elB, J.hdB, 1.12), 2.9, 2.6, COL.glove, { noHatch: true });
  }

  function drawLeg(ctx, J, front) {
    const hip = J.hip, knee = front ? J.kneeF : J.kneeB, ank = front ? J.ankF : J.ankB, toe = front ? J.toeF : J.toeB;
    const tr = front ? COL.pants : COL.pantsD, bt = front ? COL.boot : COL.bootD;
    Rig.limbChain(ctx, [hip, lerpP(hip, knee, 0.45), knee, lerpP(knee, ank, 0.35), ank], [8.0, 7.0, 4.9, 4.7, 3.1], tr, { spec: front ? 0.18 : 0 });
    // tall riding boot, folded cuff, gold buckle
    Rig.limb(ctx, lerpP(knee, ank, 0.22), ank, 5.0, 3.5, bt, { spec: front ? 0.35 : 0 });
    const b = lerpP(knee, ank, 0.62), dx = ank.x - knee.x, dy = ank.y - knee.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    ctx.strokeStyle = front ? GOLD : GOLDD; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(b.x + nx * 4.6, b.y + ny * 4.6); ctx.lineTo(b.x - nx * 4.6, b.y - ny * 4.6); ctx.stroke();
    Rig.limb(ctx, ank, toe, 3.6, 2.3, bt);
    const fx = toe.x - ank.x, fy = toe.y - ank.y, fl = Math.hypot(fx, fy) || 1;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ank.x - fx / fl * 3, ank.y + 3.2); ctx.lineTo(toe.x + fx / fl * 1.5, toe.y + 2.2); ctx.stroke();
  }

  function drawTorso(ctx, J, tq, look, e) {
    const Q = tq.Q, nx = tq.nx, ny = tq.ny, p2 = look.p2;
    // waistcoat over a high-collared shirt
    const vest = [Q(-0.06, -9.8), Q(0.25, -7.6), Q(0.55, -6.6), Q(0.92, -8.4), Q(1.08, -4.5), Q(1.1, 3.6), Q(0.9, 8.6), Q(0.72, 9.0), Q(0.52, 6.2), Q(0.3, 6.0), Q(0.05, 8.6), Q(-0.1, 6.6)];
    smoothClosed(ctx, vest); ctx.fillStyle = cel(ctx, Q(0.5, 0), nx, ny, 10, COL.vest); ctx.fill(); ink(ctx, 1.1);
    smoothClosed(ctx, [Q(0.8, 3.0), Q(1.08, 3.4), Q(1.14, 6.4), Q(0.92, 7.8)]);
    ctx.fillStyle = cel(ctx, Q(0.95, 5), nx, ny, 3, COL.shirt); ctx.fill(); ink(ctx, 0.8);
    ctx.fillStyle = GOLD; for (const s of [0.3, 0.46, 0.62]) { const b = Q(s, 5.6 + s * 1.2); ctx.beginPath(); ctx.arc(b.x, b.y, 0.9, 0, TAU); ctx.fill(); }
    // phase 2: a seam of gold light over the heart — where the ambush took her
    if (p2 > 0) {
      const a = Q(0.82, 2.2), b = Q(0.6, 7.6), c = Q(0.42, 4.4);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= p2;
      ctx.strokeStyle = U.rgba(GOLD, 0.5); ctx.lineWidth = 3.4; ctx.lineCap = 'round'; poly(ctx, [a, Q(0.7, 5), b, Q(0.5, 5.6), c], false); ctx.stroke();
      ctx.strokeStyle = GOLDW; ctx.lineWidth = 1.1; ctx.stroke();
      if (!GHOST) K.glow(ctx, Q(0.66, 5).x, Q(0.66, 5).y, 14, GOLD, 0.6 + 0.25 * Math.sin(e.t * 5));
      ctx.restore();
    }
    // the greatcoat body: covers the back, open at the front, gold-edged
    const coat = [Q(-0.12, -11.8), Q(0.3, -9.8), Q(0.66, -9.4), Q(0.98, -10.6), Q(1.14, -6.6), Q(1.17, -1.0), Q(1.05, 3.2), Q(0.74, 4.2), Q(0.42, 2.8), Q(0.12, 3.4), Q(-0.1, 2.8)];
    smoothClosed(ctx, coat); ctx.fillStyle = cel(ctx, Q(0.5, -4), nx, ny, 10, COL.coat); ctx.fill(); ink(ctx, 1.2);
    poly(ctx, [Q(1.05, 3.2), Q(0.74, 4.2), Q(0.66, 1.4), Q(0.95, 0.8)]); ctx.fillStyle = COL.lining; ctx.fill(); ink(ctx, 0.7);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.9; poly(ctx, [Q(1.05, 3.3), Q(0.74, 4.3), Q(0.42, 2.9), Q(0.12, 3.5), Q(-0.1, 2.9)], false); ctx.stroke();
    ctx.strokeStyle = 'rgba(205,208,235,0.14)'; ctx.lineWidth = 0.7; poly(ctx, [Q(0.92, -8.4), Q(0.5, -7.6), Q(0.1, -9.6)], false); ctx.stroke();
    ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 0.7; poly(ctx, [Q(0.15, -6.8), Q(0.55, -4.9), Q(0.88, -6)], false); ctx.stroke();
    // belt: dark leather, gold buckle
    Rig.limb(ctx, Q(0.07, -11), Q(0.07, 8.8), 2.4, 2.4, COL.belt, { noHatch: true });
    const bk = Q(0.07, 6.4);
    ctx.beginPath(); ctx.rect(bk.x - 1.8, bk.y - 2.2, 3.6, 4.4); ctx.fillStyle = GOLD; ctx.fill(); ink(ctx, 0.6);
    ctx.fillStyle = GOLDW; ctx.fillRect(bk.x - 1.0, bk.y - 1.6, 0.8, 0.8);
  }

  function drawCollar(ctx, Q, J, look) {
    // tall stand collar, turned up behind the neck
    const a = Q(0.92, -7.8), b = Q(1.26, -5.6), c = Q(1.3, -1.0), d = Q(1.04, -0.2);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(Q(1.2, -8.4).x, Q(1.2, -8.4).y, b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    ctx.fillStyle = cel(ctx, Q(1.1, -4), 0.6, -0.8, 5, COL.coat); ctx.fill(); ink(ctx, 0.9);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    // a pale high shirt collar under the jaw — the one light value between her face and the dark coat
    Rig.limb(ctx, Q(1.02, -2.4), Q(1.16, 3.4), 2.5, 2.3, COL.shirt, { noHatch: true });
    ctx.strokeStyle = 'rgba(11,6,18,0.45)'; ctx.lineWidth = 0.45; poly(ctx, [Q(1.0, 0.4), Q(1.16, 1.4)], false); ctx.stroke();
  }

  // the face: older than Rinne's — a stronger jaw, an aquiline nose, a hooded eye, lines at the mouth. The scar through her brow
  // is a seam of gold now (kintsugi). Short dark hair, cropped at the nape, one silver streak in the fringe.
  function drawHead(ctx, J, e, look, ghost) {
    const p2 = look.p2;
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha); ctx.scale(1.12, 1.12);
    // --- hair mass behind the skull: rounded crown, cropped nape with choppy tufts ---
    const back = () => {
      ctx.beginPath(); ctx.moveTo(1.0, -11.6);
      ctx.bezierCurveTo(-5.5, -12.8, -11.4, -9.4, -11.9, -3.6); ctx.bezierCurveTo(-12.1, -0.4, -11.4, 2.4, -10.2, 4.0);
      ctx.lineTo(-11.6, 6.2); ctx.lineTo(-8.8, 5.0); ctx.lineTo(-8.8, 7.8); ctx.lineTo(-6.6, 5.6); ctx.lineTo(-5.2, 7.2); ctx.lineTo(-3.8, 4.8);
      ctx.lineTo(-1.6, 3.0); ctx.lineTo(-0.6, -4.0); ctx.closePath();
    };
    back(); ctx.fillStyle = COL.hair; ctx.fill();
    ctx.save(); back(); ctx.clip();
    ctx.fillStyle = COL.hairL; ctx.beginPath(); ctx.moveTo(-11.4, -5.6); ctx.quadraticCurveTo(-7, -11.8, 0.5, -12.0); ctx.lineTo(-0.6, -10.4); ctx.quadraticCurveTo(-6.6, -10.0, -10.0, -4.4); ctx.closePath(); ctx.fill();
    ctx.restore();
    back(); ink(ctx, 1.0);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-3, -9.4); ctx.quadraticCurveTo(-8.4, -7, -9.4, 2.4); ctx.moveTo(-1.6, -6.4); ctx.quadraticCurveTo(-5, -3, -6.4, 4.6); ctx.stroke();
    // --- face: paper lit plane, cool ink-wash shadow cut along the cheekbone ---
    const face = () => {
      ctx.beginPath(); ctx.moveTo(-0.4, -9.8);
      ctx.bezierCurveTo(3.8, -10.2, 7.2, -8.0, 7.9, -4.6);
      ctx.lineTo(8.2, -3.6); ctx.lineTo(7.7, -2.6);                                 // brow ridge, nasion
      ctx.lineTo(9.0, -0.9); ctx.lineTo(9.5, -0.2); ctx.lineTo(10.9, 1.9); ctx.lineTo(9.4, 2.6);   // aquiline nose
      ctx.lineTo(9.5, 3.3); ctx.lineTo(8.8, 4.0); ctx.lineTo(9.2, 4.7); ctx.lineTo(8.6, 5.5);       // thin lips
      ctx.lineTo(9.1, 7.0); ctx.lineTo(8.2, 8.4); ctx.lineTo(2.2, 8.8); ctx.lineTo(0.2, 7.2);       // square chin, hard jaw
      ctx.lineTo(-1.6, 4.4); ctx.lineTo(-1.6, -6); ctx.closePath();
    };
    face(); ctx.fillStyle = COL.skin; ctx.fill();
    ctx.save(); face(); ctx.clip();
    ctx.fillStyle = COL.skinD;
    ctx.beginPath(); ctx.moveTo(-2, -7); ctx.lineTo(2.6, -5.4); ctx.quadraticCurveTo(4.6, -1.2, 4.0, 1.6); ctx.quadraticCurveTo(5.8, 3.4, 6.4, 6.0); ctx.lineTo(8.8, 7.4); ctx.lineTo(8.8, 10); ctx.lineTo(-2, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(110,90,135,0.22)'; ctx.beginPath(); ctx.ellipse(6.5, -1.5, 2.7, 1.7, -0.1, 0, TAU); ctx.fill();          // eye socket
    ctx.fillStyle = 'rgba(232,184,80,0.55)'; ctx.beginPath(); ctx.moveTo(2.2, 8.8); ctx.lineTo(8.2, 8.4); ctx.lineTo(8.0, 9.8); ctx.lineTo(2, 9.9); ctx.closePath(); ctx.fill();   // gold bounce under the jaw
    ctx.fillStyle = 'rgba(255,248,232,0.95)'; ctx.beginPath(); ctx.moveTo(9.3, -0.4); ctx.lineTo(10.6, 1.7); ctx.lineTo(9.9, 1.8); ctx.closePath(); ctx.fill();   // nose glint
    ctx.restore();
    face(); ink(ctx, 0.9);
    // age: nose-to-mouth line, the hollow under the cheekbone, crow's feet
    ctx.strokeStyle = 'rgba(58,36,72,0.8)'; ctx.lineWidth = 0.42; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(8.9, 2.5); ctx.quadraticCurveTo(8.2, 3.3, 8.35, 4.6);
    ctx.moveTo(5.0, 2.8); ctx.quadraticCurveTo(6.2, 4.2, 6.5, 6.2);
    ctx.moveTo(4.9, -1.3); ctx.lineTo(4.0, -1.75); ctx.moveTo(4.9, -0.8); ctx.lineTo(4.1, -0.45); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(8.9, 4.05); ctx.lineTo(7.7, 4.18); ctx.stroke();   // a set mouth
    // --- the eye: hooded and gold; closed to a calm line while she holds her stance ---
    const open = look.eyes, eg = (0.8 + 0.2 * Math.sin(e.t * 6)) * (0.55 + 0.45 * open) + p2 * 0.35, lid = Math.max(open, 0.35);
    if (open > 0.12) {
      ctx.fillStyle = '#f1e8de';
      ctx.beginPath(); ctx.moveTo(5.2, -1.1); ctx.quadraticCurveTo(6.3, -1.2 - 1.05 * open, 7.75, -0.25 - 1.4 * open); ctx.lineTo(7.25, -0.5); ctx.quadraticCurveTo(6.2, -0.35, 5.4, -0.75); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b8801f'; ctx.beginPath(); ctx.arc(6.9, -1.12, 0.78 * Math.min(1, open + 0.2), 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(6.95, -1.1, 0.32, 0, TAU); ctx.fill();
    }
    if (!ghost) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, 6.9, -1.15, 3.4 + p2 * 3, GOLD, 0.8 * eg);
      if (open > 0.12) { ctx.fillStyle = U.rgba(GOLDW, 0.95); ctx.beginPath(); ctx.arc(6.75, -1.35, 0.33, 0, TAU); ctx.fill(); }
      else { ctx.strokeStyle = U.rgba(GOLDW, 0.9); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(5.3, -0.95); ctx.quadraticCurveTo(6.5, -0.45, 7.7, -1.0); ctx.stroke(); }
      if (p2 > 0) { ctx.strokeStyle = U.rgba(GOLD, 0.6 * p2); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(7.2, -1.3); ctx.quadraticCurveTo(3, -2.6 - Math.sin(e.t * 8), -3.5 - 4 * p2, -4.2 + Math.sin(e.t * 6) * 1.5); ctx.stroke(); }
      ctx.restore();
    }
    ctx.fillStyle = INK;   // heavy upper lid with a short wing
    ctx.beginPath(); ctx.moveTo(4.9, -1.0); ctx.quadraticCurveTo(6.2, -1.1 - 1.4 * lid, 7.9, -0.3 - 1.4 * lid); ctx.lineTo(8.6, -0.7 - 1.4 * lid); ctx.lineTo(7.8, -0.55 - 0.45 * open); ctx.quadraticCurveTo(6.3, -0.6 - 1.15 * open, 5.2, -0.75); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(58,36,72,0.7)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(5.4, -2.3); ctx.quadraticCurveTo(6.5, -3.05, 7.7, -2.6); ctx.stroke();   // the hood above the lid
    // brow: straight and heavy, broken where the scar crosses it
    ctx.fillStyle = '#24212e';
    ctx.beginPath(); ctx.moveTo(4.3, -3.55); ctx.lineTo(5.5, -3.85); ctx.lineTo(5.5, -3.05); ctx.lineTo(4.4, -2.85); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6.4, -4.05); ctx.lineTo(8.5, -4.35); ctx.lineTo(8.5, -3.55); ctx.lineTo(6.4, -3.22); ctx.closePath(); ctx.fill();
    // the scar across the brow — a seam of gold
    const sc = [[4.5, -8.6], [5.2, -6.6], [5.95, -4.4], [6.3, -2.55]];
    const scar = () => { ctx.beginPath(); sc.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); };
    scar(); ctx.strokeStyle = 'rgba(90,50,40,0.9)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (!ghost) { K.glow(ctx, 5.4, -5.8, 4.2, GOLD, 0.35 + 0.35 * p2); scar(); ctx.strokeStyle = U.rgba(GOLD, 0.5 + 0.3 * p2); ctx.lineWidth = 2.6; ctx.stroke(); }
    scar(); ctx.strokeStyle = GOLDW; ctx.lineWidth = 0.75; ctx.stroke();
    ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(5.2, -6.6); ctx.lineTo(4.3, -6.0); ctx.moveTo(5.6, -5.5); ctx.lineTo(6.5, -6.1); ctx.stroke();
    if (p2 > 0) { ctx.strokeStyle = U.rgba(GOLDW, 0.85 * p2); ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(4.4, 0.6); ctx.lineTo(5.4, 2.4); ctx.lineTo(5.0, 4.4); ctx.moveTo(5.4, 2.4); ctx.lineTo(6.8, 2.8); ctx.stroke(); }
    ctx.restore();
    // --- crown: swept back, a tuft at the top, fringe over the upper forehead ---
    const crown = () => {
      ctx.beginPath(); ctx.moveTo(-11.9, -3.6);
      ctx.bezierCurveTo(-12.4, -10.2, -6.2, -14.0, -0.6, -13.6);
      ctx.lineTo(-2.8, -15.0); ctx.lineTo(1.8, -13.7);
      ctx.bezierCurveTo(6.6, -13.3, 9.9, -10.2, 10.0, -6.9);
      ctx.lineTo(8.7, -7.6); ctx.lineTo(9.0, -5.7); ctx.lineTo(7.1, -7.9); ctx.lineTo(5.8, -7.3); ctx.lineTo(4.6, -8.7); ctx.lineTo(2.8, -9.0);
      ctx.lineTo(1.3, -6.4); ctx.lineTo(0.5, -2.2); ctx.lineTo(-0.4, 1.2); ctx.lineTo(-2.2, -2.6); ctx.lineTo(-4.6, -1.8); ctx.closePath();
    };
    crown(); ctx.fillStyle = COL.hair; ctx.fill();
    ctx.save(); crown(); ctx.clip();
    ctx.fillStyle = COL.hairL; ctx.beginPath(); ctx.moveTo(-9.6, -9.4); ctx.quadraticCurveTo(-1, -14.6, 8.6, -10.4); ctx.lineTo(7.2, -8.9); ctx.quadraticCurveTo(-0.6, -12.2, -8.2, -7.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9fa5c8'; ctx.beginPath(); ctx.moveTo(-5.2, -12.4); ctx.quadraticCurveTo(-0.5, -14.0, 4.2, -12.6); ctx.lineTo(3.4, -12.0); ctx.quadraticCurveTo(-0.5, -13.0, -4.6, -11.7); ctx.closePath(); ctx.fill();
    ctx.restore();
    crown(); ink(ctx, 1.0);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.55;
    ctx.beginPath(); ctx.moveTo(7.6, -9.4); ctx.quadraticCurveTo(0, -11.4, -8.8, -6.8); ctx.moveTo(4.2, -8.4); ctx.quadraticCurveTo(-2.4, -9.0, -9.8, -3.4); ctx.moveTo(0.2, -6.0); ctx.lineTo(-2.4, -3.2); ctx.stroke();
    // the silver streak, swept forward over the fringe
    ctx.beginPath(); ctx.moveTo(-1.2, -12.9); ctx.quadraticCurveTo(4.6, -13.4, 8.6, -9.4); ctx.lineTo(9.3, -6.6); ctx.lineTo(7.4, -8.9); ctx.quadraticCurveTo(4.8, -11.2, 0.6, -12.1); ctx.closePath();
    ctx.fillStyle = COL.silver; ctx.fill(); ink(ctx, 0.5);
    ctx.strokeStyle = 'rgba(120,124,150,0.9)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(1.6, -11.6); ctx.quadraticCurveTo(6.2, -11.4, 8.7, -7.6); ctx.stroke();
    // ear + a small gold stud (Rinne wears its twin)
    ctx.fillStyle = '#c9b8b0'; ctx.beginPath(); ctx.ellipse(-0.7, 1.3, 1.25, 2.0, 0.15, 0, TAU); ctx.fill(); ink(ctx, 0.45);
    ctx.strokeStyle = 'rgba(90,60,90,0.8)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(-0.55, 1.4, 0.75, -1.2, 1.4); ctx.stroke();
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(-0.8, 3.45, 0.6, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawBlade(ctx, J, bg, look, e) {
    const b = J.hdF, t = bg.tip, pm = bg.pommel, dx = bg.dx, dy = bg.dy, nx = -dy, ny = dx;
    ctx.save(); ctx.beginPath(); ctx.rect(-600, -900, 1200, 900 + look.floorL); ctx.clip();
    // grip, wrapped
    Rig.limb(ctx, pm, { x: b.x + dx * 2, y: b.y + dy * 2 }, 1.8, 2.0, '#2a2230'); ink(ctx, 0.9);
    ctx.strokeStyle = 'rgba(240,194,90,0.5)'; ctx.lineWidth = 0.4;
    for (let k = 2; k < 14; k += 3) { const q = { x: b.x - dx * k, y: b.y - dy * k }; ctx.beginPath(); ctx.moveTo(q.x + nx * 1.8, q.y + ny * 1.8); ctx.lineTo(q.x - nx * 1.8 - dx * 1.6, q.y - ny * 1.8 - dy * 1.6); ctx.stroke(); }
    // pommel
    ctx.beginPath(); ctx.arc(pm.x, pm.y, 2.4, 0, TAU); ctx.fillStyle = GOLD; ctx.fill(); ink(ctx, 0.6);
    // guard: a heavy gold cross with a ring
    const g0 = { x: b.x + dx * 3, y: b.y + dy * 3 };
    Rig.limb(ctx, { x: g0.x + nx * 6.5 - dx * 1.5, y: g0.y + ny * 6.5 - dy * 1.5 }, { x: g0.x - nx * 6.5 - dx * 1.5, y: g0.y - ny * 6.5 - dy * 1.5 }, 1.5, 1.5, 'rgb(215,169,74)'); ink(ctx, 0.8);
    ctx.beginPath(); ctx.arc(g0.x + nx * 3, g0.y + ny * 3, 2.2, 0, TAU); ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke(); ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.stroke();
    // blade: paper-bright edge, ink spine, a single fuller
    const s0 = { x: b.x + dx * 4.5, y: b.y + dy * 4.5 };
    ctx.beginPath();
    ctx.moveTo(s0.x + nx * 2.6, s0.y + ny * 2.6);
    ctx.lineTo(t.x - dx * 10 + nx * 2.0, t.y - dy * 10 + ny * 2.0);
    ctx.lineTo(t.x, t.y);
    ctx.lineTo(s0.x - nx * 1.6, s0.y - ny * 1.6);
    ctx.closePath();
    const gr = ctx.createLinearGradient(s0.x + nx * 2.6, s0.y + ny * 2.6, s0.x - nx * 1.6, s0.y - ny * 1.6);
    gr.addColorStop(0, '#fbf6ea'); gr.addColorStop(0.42, '#c9c6d4'); gr.addColorStop(0.43, '#3a3a4e'); gr.addColorStop(1, '#14131e');
    ctx.fillStyle = gr; ctx.fill(); ink(ctx, 0.9);
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(s0.x + nx * 0.2 + dx * 4, s0.y + ny * 0.2 + dy * 4); ctx.lineTo(t.x - dx * 26 + nx * 0.2, t.y - dy * 26 + ny * 0.2); ctx.stroke();
    // the edge sings gold (crimson when the cut is one you cannot guard)
    const hot = look.red && (look.blade > 0 || e.tellT > 0) ? 1 : 0;
    const ecol = hot ? CRIM : GOLD, k = 0.45 + look.blade * 0.55 + look.stance * 0.4 + look.deflect;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = U.rgba(ecol, Math.min(1, 0.55 * k)); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(s0.x + nx * 2.4, s0.y + ny * 2.4); ctx.lineTo(t.x, t.y); ctx.stroke();
    if (k > 0.6) { ctx.strokeStyle = U.rgba(ecol, (k - 0.6) * 0.45); ctx.lineWidth = 7; ctx.stroke(); }
    if (look.blade > 0.05 && !GHOST) {
      // gathering light: motes drawn down the blade toward the tip
      for (let i = 0; i < 4; i++) { const u = ((e.t * 1.6 + i / 4) % 1), q = lerpP(s0, t, u); K.glow(ctx, q.x + nx * 1.5, q.y + ny * 1.5, 4 + look.blade * 4, ecol, 0.6 * look.blade); }
      K.glow(ctx, t.x, t.y, 10 + look.blade * 12, ecol, 0.5 * look.blade);
    }
    ctx.restore();
    ctx.restore();
    // where the edge meets the floor: a ring of ink
    if (t.y > look.floorL - 2 && !GHOST) { const k = U.clamp((t.y - look.floorL) / 30, 0, 1), cx = b.x + (t.x - b.x) * U.clamp((look.floorL - b.y) / ((t.y - b.y) || 1), 0, 1); ctx.fillStyle = 'rgba(9,6,16,0.85)'; ctx.beginPath(); ctx.ellipse(cx, look.floorL, 6 + 10 * k, 1.6 + k, 0, 0, TAU); ctx.fill(); }
  }

  function drawFrontArm(ctx, J, e, look) {
    // dark greatcoat sleeve over the arm, gold cuff band, glove on the grip
    Rig.limbChain(ctx, [J.sh, lerpP(J.sh, J.elF, 0.5), J.elF, J.hdF], [5.4, 5.0, 4.2, 3.3], COL.sleeve, { spec: 0.2 });
    const c0 = lerpP(J.elF, J.hdF, 0.62), c1 = lerpP(J.elF, J.hdF, 0.8);
    Rig.limb(ctx, c0, c1, 4.3, 4.1, 'rgb(43,48,72)'); ink(ctx, 0.9);
    const dx = J.hdF.x - J.elF.x, dy = J.hdF.y - J.elF.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.1; for (const k of [0.64, 0.78]) { const p = lerpP(J.elF, J.hdF, k); ctx.beginPath(); ctx.moveTo(p.x + nx * 4.2, p.y + ny * 4.2); ctx.lineTo(p.x - nx * 4.2, p.y - ny * 4.2); ctx.stroke(); }
    const sd = { x: Math.sin(J.sw), y: Math.cos(J.sw) }, f = J.hdF;
    Rig.limb(ctx, { x: f.x - sd.x * 2.4, y: f.y - sd.y * 2.4 }, { x: f.x + sd.x * 2.6, y: f.y + sd.y * 2.6 }, 3.0, 2.7, COL.glove, { spec: 0.25, noHatch: true });
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 0.45;
    for (const k of [-1.2, 0, 1.2]) { ctx.beginPath(); ctx.arc(f.x + sd.x * k, f.y + sd.y * k, 2.4, -0.4, 0.9); ctx.stroke(); }
  }

  function drawEpaulette(ctx, J, tq, look, e) {
    // the captain's shoulder cape: hangs from the collar over the near shoulder and follows the upper arm; Squad VII in gold
    const sh = J.sh, el = J.elF, Q = tq.Q;
    let ux = el.x - sh.x, uy = el.y - sh.y; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    // keep the cape's "outside" toward the viewer's side of the arm that faces away from the torso
    let nx = -uy, ny = ux; const toBody = (Q(0.6, 0).x - sh.x) * nx + (Q(0.6, 0).y - sh.y) * ny; if (toBody > 0) { nx = -nx; ny = -ny; }
    const P = (u, v) => ({ x: sh.x + ux * u + nx * v, y: sh.y + uy * u + ny * v });
    const sway = Math.sin(e.t * 2.6) * 0.8 - e.vx * 0.003, rag = look.p2;
    const top = P(-5.5, -1), a = P(-1, 8.2), b = P(14 + sway, 9.6), c = P(15.5 + sway, -8.6), d = P(-1, -7.6);
    const path = () => {
      ctx.beginPath(); ctx.moveTo(top.x, top.y);
      ctx.quadraticCurveTo(P(-4, 7).x, P(-4, 7).y, a.x, a.y);
      ctx.lineTo(b.x, b.y);
      // hem: three soft scallops (torn into points once the gold breaks through)
      for (let k = 1; k <= 3; k++) {
        const q0 = lerpP(b, c, (k - 0.5) / 3), q1 = lerpP(b, c, k / 3), dip = rag > 0 ? (k % 2 ? 4.5 : -1) * rag + 1.5 : 2.2;
        ctx.quadraticCurveTo(q0.x + ux * dip, q0.y + uy * dip, q1.x, q1.y);
      }
      ctx.lineTo(d.x, d.y); ctx.quadraticCurveTo(P(-4, -6).x, P(-4, -6).y, top.x, top.y); ctx.closePath();
    };
    path(); ctx.fillStyle = cel(ctx, P(6, 0), nx, ny, 10, COL.mantle); ctx.fill(); ink(ctx, 1.1);
    // fold lines + gold hem
    ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(P(2, 2.5).x, P(2, 2.5).y); ctx.lineTo(P(13, 4).x, P(13, 4).y); ctx.moveTo(P(3, -3).x, P(3, -3).y); ctx.lineTo(P(13.5, -4.5).x, P(13.5, -4.5).y); ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(P(12.6 + sway, 9.4).x, P(12.6 + sway, 9.4).y); ctx.lineTo(P(14.2 + sway, -8.4).x, P(14.2 + sway, -8.4).y); ctx.stroke();
    // VII — roman numerals stitched in gold, running across the arm
    const m = P(8.5, 0.6);
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(U.clamp(Math.atan2(uy, ux) - PI / 2, -0.5, 0.5)); if (e.facing < 0) ctx.scale(-1, 1);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.8; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(-4.2, -1.9); ctx.lineTo(-3.1, 1.9); ctx.lineTo(-2.0, -1.9);         // V
    for (const x0 of [-0.4, 1.2]) { ctx.moveTo(x0, -1.9); ctx.lineTo(x0, 1.9); }   // I I
    ctx.moveTo(-4.6, -1.9); ctx.lineTo(1.8, -1.9); ctx.moveTo(-4.6, 2.05); ctx.lineTo(1.8, 2.05);   // serifs as bars
    ctx.stroke();
    ctx.restore();
    if (look.p2 > 0) glow(ctx, P(9, 0).x, P(9, 0).y, 12, GOLD, 0.45 * look.p2);
  }

  // broken balance: gold eighth-notes circling her bowed head — her rhythm, broken
  function drawDazed(ctx, e, J) {
    const hx = e.x + e.facing * J.head.x * S, hy = e.y + J.head.y * S - 30;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const a = e.t * 2.6 + i * TAU / 3, x = hx + Math.cos(a) * 30, y = hy + Math.sin(a) * 8, front = Math.sin(a) > 0;
      ctx.globalAlpha = front ? 1 : 0.6;
      ctx.fillStyle = GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, y, 3.6, 2.6, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 3.2, y - 0.6); ctx.lineTo(x + 3.2, y - 12); ctx.quadraticCurveTo(x + 8, y - 9, x + 7, y - 5); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.4; ctx.stroke();
    }
    ctx.restore();
  }

  /* ================================ death: the remnant ================================ */
  // When she falls the engine removes her, but an echo should not vanish mid-sentence. She stays — kneeling, drawn by the
  // same renderer — in the hazard layer, which freezes with the world while the epilogue dialogue runs, and she comes apart
  // into gold from the hem up. The world author may end it early with G.C7Boss.release() (e.g. after 「斬斷殘響」, which
  // also flares her out), or let it fade on its own.
  function spawnRemnant(e, pose) {
    e.remnant = true;
    const snap = (c) => ({ inited: c.inited, n: c.n, p: c.inited ? c.p.map((q) => ({ x: q.x, y: q.y })) : [] });
    const h = {
      kind: 'c7_remnant', x: e.x, y: e.y, facing: e.facing, pose: Rig.full({ ...pose }), t: 0, life: 14, rel: null, phase: e.phase,
      proxy: { t: e.t, vx: 0, tellT: 0, facing: e.facing, phase: e.phase, x: e.x, y: e.y, cape: snap(e.cape), coatB: snap(e.coatB), coatF: snap(e.coatF) },
      update(h, dt) {
        if (h.rel != null) { h.rel += dt; if (h.rel > 1.4) h.done = true; }
        if (!LQ() && Math.random() < dt * 10) { const k = remnantLevel(h); G.FX.ember(h.x + U.rand(-40, 40), h.y - 170 * k - U.rand(0, 20), 1, GOLD, { w: 8, h: 6, up: 80, sp: 24, life: 1.2 }); }
      },
      draw: drawRemnant,
    };
    G.game.hazards.push(h);
    G.C7Boss.remnant = h;
  }
  // 0 → 1: how far the gold has risen through her (frozen while dialogue holds the world)
  const remnantLevel = (h) => (h.rel != null ? Math.min(1, 0.35 + h.rel / 1.2) : U.clamp((h.t - 1.5) / (h.life - 3), 0, 1) * 0.9);
  // she is rendered once into an offscreen canvas (and once more as a gold silhouette): the dissolve edge then follows her exact
  // outline with two clipped drawImage calls per frame
  function remnantCache(h) {
    if (h.cache !== undefined) return h.cache;
    h.cache = null;
    try {
      const RES = 2, W = 380, H = 270, ox = 150, oy = 240;
      const mk = () => { const c = document.createElement('canvas'); c.width = W * RES; c.height = H * RES; return c; };
      const body = mk(), gold = mk(), g = body.getContext('2d');
      const J = Rig.compute(h.pose), bg = bladeGeo(J), pr = h.proxy;
      const look = { p2: h.phase === 2 ? 1 : 0, red: false, blade: 0, stance: 0, shoulder: 0, deflect: 0, eyes: 0, dissolve: 0, floorL: 0 };
      const toL = (q) => ({ x: (q.x - h.x) * h.facing / S, y: (q.y - h.y) / S });
      g.setTransform(RES, 0, 0, RES, ox * RES, oy * RES); g.scale(h.facing * S, S);
      drawBody(g, pr, J, h.pose, bg, look, toL, false);
      const g2 = gold.getContext('2d'); g2.drawImage(body, 0, 0); g2.globalCompositeOperation = 'source-atop'; g2.fillStyle = GOLDW; g2.fillRect(0, 0, gold.width, gold.height);
      h.cache = { body, gold, W, H, ox, oy, cx: (J.chest.x * h.facing) * S };
    } catch (err) { h.cache = null; }
    return h.cache;
  }
  function drawRemnant(ctx, h, g) {
    const rt = (g && g.realTime) || 0, lvl = remnantLevel(h);
    const fade = h.rel != null ? 1 - U.clamp((h.rel - 0.6) / 0.8, 0, 1) : 1 - U.clamp((h.t - h.life + 2.5) / 2.5, 0, 1);
    const c = remnantCache(h);
    if (fade <= 0 || !c) return;
    const dx = h.x - c.ox, dy = h.y - c.oy, lineW = h.y + 6 - lvl * 200, br = Math.sin(rt * 1.3) * 0.6;
    ctx.save(); ctx.globalAlpha *= fade;
    glow(ctx, h.x + c.cx * 0.5, h.y - 80, 130, GOLD, 0.1 + 0.12 * lvl);
    // what remains of her, above the rising line
    ctx.save(); ctx.beginPath(); ctx.rect(dx, dy, c.W, lineW - dy); ctx.clip(); ctx.drawImage(c.body, dx, dy + br, c.W, c.H); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // the edge where she is coming apart: her own outline, in gold
    ctx.save(); ctx.beginPath(); ctx.rect(dx, lineW - 16, c.W, 20); ctx.clip(); ctx.globalAlpha *= 0.35; ctx.drawImage(c.gold, dx, dy + br, c.W, c.H); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(dx, lineW - 4, c.W, 6); ctx.clip(); ctx.drawImage(c.gold, dx, dy + br, c.W, c.H); ctx.restore();
    // what is already gone: a faint gold ghost
    ctx.save(); ctx.beginPath(); ctx.rect(dx, lineW + 4, c.W, c.H); ctx.clip(); ctx.globalAlpha *= 0.14 + 0.06 * Math.sin(rt * 2); ctx.drawImage(c.gold, dx, dy + br, c.W, c.H); ctx.restore();
    // flakes lifting off the edge
    for (let i = 0; i < 10; i++) {
      const u = ((rt * 0.4 + i * 0.113) % 1), fx = h.x + c.cx * 0.4 + (i - 4.5) * 7 + Math.sin(rt * 2 + i) * 5, fy = lineW - u * 60;
      ctx.fillStyle = U.rgba(i % 3 ? GOLD : GOLDW, 0.85 * (1 - u)); ctx.beginPath(); ctx.moveTo(fx, fy - 3.2); ctx.lineTo(fx + 1.4, fy); ctx.lineTo(fx, fy + 3.2); ctx.lineTo(fx - 1.4, fy); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }
  G.C7Boss = {
    remnant: null,
    // let the remnant go: the gold finishes rising through her and she is gone (~1.4 s); safe to call at any time
    release() { const h = this.remnant; if (h && h.rel == null) { h.rel = 0; sfx('c7_salute'); G.FX.ember(h.x, h.y - 90, 30, GOLD, { w: 70, h: 150, up: 220 }); } },
    // test hooks (measurement + visual checks)
    _dbg: { IP, F, S, BL, bladeGeo, behindBack, MOVES },
  };
})(window.G);

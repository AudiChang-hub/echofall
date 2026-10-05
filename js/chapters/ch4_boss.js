'use strict';
/* ECHOFALL — Chapter IV boss: 最後的詠嘆・露塞特 LUCETTE, THE LAST ARIA.
   Descent IV's leader, the Grand Opera's prima donna, sealed into a gown of glass. Every move she makes lands on the beat of her
   aria (c4_boss / c4_boss2 — the boss keeps its own beat clock and nudges it onto the live music clock while the track plays).
   P1  扇舞三連 fan-dance combo (white ×3, last one heavy) · 詠嘆之牆 aria sound-walls (white: a perfect guard shatters them and
       staggers her) · 聚光燈 spotlights (arena hazard: stand outside the pools) · 墜落吊燈 falling chandelier (red) ·
       玻璃高音 glass high-C burst (red, close) · 謝幕 curtain-call glide (white gap-closer).
   P2  the gown cracks, her hair comes loose and her shadow steps out of the glass to sing the second voice: a mirrored attacker that
       stands behind the player — 二重唱 duet (alternating sides, ends in a red pincer) · 終幕詠嘆 grand finale (walls from both sides
       on successive beats) · two-wave spotlights · twin chandeliers.
   Every phrase ends in a "breath" (she holds the last pose / catches her breath) — the punish window. */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK, ROSE = '#ff6fae', ROSE_HI = '#ffd1e6', CRIM = K.CRIM, GOLD = '#e8b85a', GOLD_HI = '#fff0c2', VIOLET = '#a98bff';
  const SKIN = '#f3e6ec', SKIN_B = '#d9c3d6', GLOVE = '#24101f', GLOVE_B = '#160913', VELVET = '#5a1232', HAIR = '#5e1a3d', HAIR_D = '#2c0a1f', HAIR_HI = '#b9507c';
  const SHD = { fill: '#140a1f', body: '#1d1030', limb: '#24163a', rim: VIOLET };
  const HS = 2.0;           // head scale (face drawn in hero-sized units, then scaled up)
  const NR = 8;              // glass gores in the gown

  /* ------------------------------------------------------------------ palette (glass shifts rose-violet in phase 2) */
  const GL1 = { hi: '#f6feff', lit: '#cdeef9', mid: '#86bfd8', dark: '#3d5c8c', deep: '#2b2558', bounce: '#5ed3df', edge: '#e9fbff', under: '#4e0c2a', underD: '#240516', heart: ROSE };
  const GL2 = { hi: '#fff0fb', lit: '#f2c6ea', mid: '#c08ad6', dark: '#5a3484', deep: '#2a1440', bounce: '#ff8fc8', edge: '#ffe3f6', under: '#32082c', underD: '#13030f', heart: '#ff3d8a' };
  const palCache = new Map();
  function glassPal(k) {
    const q = Math.round(U.clamp(k, 0, 1) * 16);
    let p = palCache.get(q);
    if (!p) { p = {}; for (const key in GL1) p[key] = U.mixHex(GL1[key], GL2[key], q / 16); palCache.set(q, p); }
    return p;
  }

  /* ------------------------------------------------------------------ beat clock */
  // one boss beat = one music beat of her track, folded into 0.45–0.8 s so tells stay fair at any tempo
  function beatLen(phase) {
    const tr = G.Music.TRACKS[phase === 2 ? 'c4_boss2' : 'c4_boss'];
    let b = 60 / ((tr && tr.bpm) || (phase === 2 ? 128 : 116)), m = 1;
    while (b < 0.45) { b *= 2; m *= 2; }
    while (b > 0.8) { b /= 2; m /= 2; }
    return [b, m];
  }
  const beatPos = (e) => (e.t + e.bOff) / e.B;
  function setTempo(e) {
    const pos = e.B ? beatPos(e) : 0;
    const [b, m] = beatLen(e.phase);
    e.B = b; e.bMul = m; e.bOff = pos * b - e.t;
  }
  // gently pull our beat phase onto the music scheduler's (only while her own track is the one playing)
  function syncBeat(e) {
    const M = G.Music, A = G.AudioKit, ac = A && A.ctx;
    const want = e.phase === 2 ? 'c4_boss2' : 'c4_boss';
    if (!ac || M.track !== want || !M.def || M.def !== M.TRACKS[want]) return;
    const spb = 60 / M.def.bpm / 4;
    const musicBeat = (M.step - (M.nextT - ac.currentTime) / spb) / 4;
    let d = (musicBeat / e.bMul - beatPos(e)) % 1;
    if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
    e.bOff += d * e.B * 0.06;
  }

  /* ------------------------------------------------------------------ poses (custom diva rig: angles from straight down, + = toward facing) */
  const PZ = { x: 0, y: 0, lean: 0.06, head: 0.12, aF: 0.32, eF: 0.85, fan: -0.85, open: 0, aB: -0.45, eB: -0.35, sing: 0, crouch: 0, skirt: 0, eye: 0.35 };
  const PKEYS = Object.keys(PZ);
  const full = (p) => { const o = {}; for (const k of PKEYS) o[k] = p[k] ?? PZ[k]; return o; };
  const lerpPose = (a, b, k) => { const o = {}; for (const key of PKEYS) o[key] = a[key] + (b[key] - a[key]) * k; return o; };
  const EASE = { lin: (t) => t, io: U.easeInOutSine, out: U.easeOutCubic, snap: (t) => 1 - Math.pow(1 - t, 4), in: U.easeInCubic };
  function sample(keys, t) {
    if (t <= keys[0][0]) return full(keys[0][1]);
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i];
        return lerpPose(full(a[1]), full(b[1]), EASE[b[2] || 'io']((t - a[0]) / ((b[0] - a[0]) || 1)));
      }
    }
    return full(keys[keys.length - 1][1]);
  }
  const PS = {
    idle: (t, bp = 0) => {
      const nod = Math.exp(-((bp % 1 + 1) % 1) * 5) * 0.06, br = Math.sin(t * 1.3);
      return full({ lean: 0.05 + br * 0.02, head: 0.14 + Math.sin(t * 0.9) * 0.03 + nod, y: br * 2, aF: 0.3 + br * 0.04, eF: 0.85, fan: -0.85, aB: -0.45 + Math.sin(t * 1.1) * 0.06, eB: -0.35, skirt: Math.sin(t * 0.8) * 0.15 });
    },
    W1: { lean: -0.12, head: -0.15, aF: 2.75, eF: 0.45, fan: 0.35, open: 0.35, aB: -0.9, eB: -0.3, eye: 1, skirt: -0.2 },
    W1b: { lean: -0.16, head: -0.2, aF: 2.95, eF: 0.4, fan: 0.4, open: 0.55, aB: -1.0, eB: -0.3, eye: 1, skirt: -0.25 },
    S1: { lean: 0.75, head: 0.25, aF: 0.9, eF: 0.3, fan: 0.1, open: 1, aB: -1.2, eB: -0.2, eye: 1, skirt: 0.35 },
    S1r: { lean: 0.62, head: 0.3, aF: 0.75, eF: 0.35, fan: 0.0, open: 0.9, aB: -1.1, eB: -0.2, eye: 1, skirt: 0.25 },
    W2: { lean: 0.45, head: 0.2, aF: 0.15, eF: 1.35, fan: 0.75, open: 0.85, aB: -0.9, eB: -0.3, eye: 1, skirt: 0.2 },
    S2: { lean: 0.2, head: -0.1, aF: 2.0, eF: 0.15, fan: -0.3, open: 1, aB: -1.0, eB: -0.4, eye: 1, skirt: -0.1 },
    W3a: { lean: 0.1, head: 0.05, aF: -0.6, eF: 0.3, fan: 0.2, open: 1, aB: 1.0, eB: 0.5, crouch: 0.15, eye: 1, skirt: -0.3 },
    W3: { lean: 0.02, head: -0.05, aF: -1.0, eF: 0.3, fan: 0.2, open: 1, aB: 1.3, eB: 0.5, crouch: 0.28, eye: 1, skirt: -0.5 },
    S3: { lean: 0.85, head: 0.3, aF: 1.05, eF: 0.15, fan: 0.35, open: 1, aB: -1.4, eB: -0.2, crouch: 0.35, eye: 1, skirt: 0.6 },
    REC: { lean: 0.55, head: 0.5, aF: 0.6, eF: 0.4, fan: 0.1, open: 0.7, aB: -0.5, eB: -0.3, crouch: 0.3, sing: 0.25, eye: 0.5, skirt: 0.2 },
    INH: { lean: -0.18, head: -0.35, aF: 1.0, eF: 0.9, fan: -0.6, open: 0, aB: 2.3, eB: 0.3, sing: 0.25, eye: 0.2 },
    INH2: { lean: -0.22, head: -0.42, aF: 1.1, eF: 0.9, fan: -0.6, open: 0, aB: 2.5, eB: 0.25, sing: 0.35, eye: 0.15, y: -4 },
    SING: { lean: -0.25, head: -0.45, aF: 2.0, eF: 0.2, fan: -0.2, open: 0.6, aB: 2.2, eB: 0.2, sing: 1, eye: 0.05, skirt: -0.1 },
    SING2: { lean: -0.18, head: -0.35, aF: 1.8, eF: 0.3, fan: -0.25, open: 0.6, aB: 2.4, eB: 0.2, sing: 0.85, eye: 0.05, skirt: 0.1 },
    UP: { lean: -0.2, head: -0.5, aF: 3.0, eF: 0.1, fan: 0, open: 0.15, aB: -0.8, eB: -0.3, sing: 0.5, eye: 1 },
    CALL: { lean: 0.3, head: 0.1, aF: 1.45, eF: 0.15, fan: 0.15, open: 0.4, aB: -1.0, eB: -0.3, sing: 0.7, eye: 1 },
    HUG: { lean: 0.12, head: 0.55, aF: -0.25, eF: 2.3, fan: 0.6, open: 0, aB: 0.45, eB: 1.9, crouch: 0.3, sing: 0, eye: 1 },
    HUG2: { lean: 0.18, head: 0.62, aF: -0.3, eF: 2.4, fan: 0.6, open: 0, aB: 0.5, eB: 2.0, crouch: 0.38, sing: 0.1, eye: 1, y: 3 },
    BURST: { lean: -0.35, head: -0.55, aF: 2.3, eF: 0.1, fan: 0, open: 1, aB: 2.4, eB: 0.1, crouch: 0, sing: 1, eye: 1 },
    EXH: { lean: 0.55, head: 0.65, aF: 0.4, eF: 0.3, fan: -0.4, open: 0.2, aB: -0.2, eB: 0.2, crouch: 0.35, sing: 0.15, eye: 0.3 },
    BOW: { lean: 1.05, head: 0.35, aF: -0.4, eF: 0.3, fan: 0.2, open: 0, aB: -1.6, eB: -0.2, crouch: 0.45, eye: 0.2, skirt: -0.3 },
    GLIDE: { lean: 0.95, head: 0.25, aF: 0.95, eF: 0.2, fan: 0.25, open: 1, aB: -1.6, eB: -0.1, crouch: 0.4, eye: 1, skirt: -0.6 },
    HURT: { lean: -0.3, head: -0.45, aF: 1.6, eF: 0.6, aB: 1.2, eB: 0.4, sing: 0.5, fan: -0.4 },
    broken: (t) => full({ lean: 0.9 + Math.sin(t * 1.6) * 0.03, head: 0.75, aF: 0.15, eF: 0.25, fan: 0.35, open: 0.55, aB: 0.1, eB: 0.2, crouch: 0.62, sing: 0.12 + Math.sin(t * 1.6) * 0.06, eye: 0 }),
    RISE: { lean: 0.6, head: 0.75, aF: 0.2, eF: 1.9, fan: 0.1, open: 0, aB: 0.25, eB: 1.8, crouch: 0.3, eye: 0 },
    REVEAL: { lean: -0.2, head: -0.32, aF: 2.6, eF: 0.2, fan: 0.1, open: 1, aB: -1.1, eB: -0.2, sing: 0.6, eye: 1, skirt: 0.2 },
  };
  const IDLE0 = PS.idle(0);

  /* ------------------------------------------------------------------ skeleton (local, facing +x, feet/hem at y = 0) */
  const dirv = (a, l) => ({ x: Math.sin(a) * l, y: Math.cos(a) * l });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  function joints(p) {
    const W = { x: p.x, y: -160 + p.y + p.crouch * 46 };
    const sl = Math.sin(p.lean), cl = Math.cos(p.lean);
    const at = (s, f) => ({ x: W.x + sl * s + cl * f, y: W.y - cl * s + sl * f });   // s up the torso, f toward the front
    const C = at(60, 0), S = at(51, 3), SB = at(50, -5);
    const ha = p.lean + p.head;
    const H = { x: C.x + Math.sin(ha) * 30, y: C.y - Math.cos(ha) * 30 };
    const E = add(S, dirv(p.aF, 48)), Hd = add(E, dirv(p.aF + p.eF, 46));
    const EB = add(SB, dirv(p.aB, 46)), HB = add(EB, dirv(p.aB + p.eB, 44));
    const fa = p.aF + p.eF + p.fan, R = U.lerp(98, 114, p.open);
    return { W, C, S, SB, H, ha, E, Hd, EB, HB, fa, R, tip: add(Hd, dirv(fa, R)), at, sl, cl };
  }
  // a point in the head's frame (hero-sized units) → local
  const headPt = (J, lx, ly) => { const c = Math.cos(J.ha), s = Math.sin(J.ha); return { x: J.H.x + (lx * c - ly * s) * HS, y: J.H.y + (lx * s + ly * c) * HS }; };

  /* ------------------------------------------------------------------ hit boxes (reach == the open fan's arc at the strike frame) */
  const BOX = {
    s1: { x: 20, y: -240, w: 210, h: 240 },
    s2: { x: 30, y: -270, w: 185, h: 270 },
    s3: { x: 0, y: -235, w: 240, h: 235 },
    bow: { x: 20, y: -200, w: 215, h: 200 },
    burst: { x: -235, y: -300, w: 470, h: 300 },
  };

  /* ------------------------------------------------------------------ attacks (built in beats, converted to seconds per tempo) */
  const cache = new Map();
  function build(e, name) {
    const B = e.B || 0.5, ph = e.phase || 1, key = name + ':' + B.toFixed(4) + ':' + ph;
    let d = cache.get(key);
    if (!d) { d = MAKE[name](B, ph); d.id = name; d.onStart = startPose; cache.set(key, d); }
    return d;
  }
  function startPose(e) { e.pzStart = Object.assign({}, e.pz || IDLE0); e.trail = []; }
  const sfx = (n, ...a) => () => G.SFX.play(n, ...a);
  // a tell on beat k, pulled earlier when the tempo would leave less than the fair lead before the blow at hitT0
  const tellBy = (beatT, hitT0, red) => Math.max(0.02, Math.min(beatT, hitT0 - (red ? 0.63 : 0.48)));
  const MAKE = {
    // 扇舞三連 — hits on beats 2, 3 and a held-back 4½ (the heavy one); then she catches her breath
    fan(B) {
      const b = (x) => x * B;
      return {
        dur: b(6.6), cd: 0.9, trackWin: 0.7, trackSpeed: 330,
        tells: [{ t: tellBy(b(1), b(2) - 0.07), c: 'white' }, { t: tellBy(b(2), b(2.85)), c: 'white' }, { t: tellBy(b(3.2), b(4.5) - 0.07), c: 'white' }],
        poses: [[0, IDLE0], [b(1), PS.W1], [b(1.82), PS.W1b], [b(2), PS.S1, 'snap'], [b(2.45), PS.S1r], [b(2.82), PS.W2], [b(3), PS.S2, 'snap'],
          [b(3.4), PS.W3a], [b(4.3), PS.W3], [b(4.5), PS.S3, 'snap'], [b(5.4), PS.REC], [b(6.6), IDLE0]],
        hits: [
          { t0: b(2) - 0.07, t1: b(2) + 0.08, box: BOX.s1, dmg: 15, kb: 260 },
          { t0: b(2.85), t1: b(3) + 0.07, box: BOX.s2, dmg: 15, kb: 260 },
          { t0: b(4.5) - 0.07, t1: b(4.5) + 0.09, box: BOX.s3, dmg: 21, kb: 390, last: true, pbal: 75 },
        ],
        ev: [{ t: b(1), fn: sfx('c4_fan') }, { t: b(2) - 0.06, fn: sfx('slash', 0.75) }, { t: b(2.86), fn: sfx('slash', 0.85) }, { t: b(4.5) - 0.06, fn: sfx('slash', 0.6, true) }],
      };
    },
    // 詠嘆之牆 — walls launched on beats, each arriving at the player two beats later
    aria(B, ph) {
      const b = (x) => x * B;
      const launches = ph === 2 ? [[2, 'L'], [3, 'S'], [4, 'L']] : [[2, 'L'], [4, 'L']];
      return {
        dur: b(6.8), cd: 1.0, track: false,
        tells: [{ t: b(0.5), c: 'white' }],
        poses: [[0, IDLE0], [b(0.6), PS.INH], [b(1.85), PS.INH2], [b(2), PS.SING, 'snap'], [b(5.4), PS.SING2], [b(6.8), IDLE0]],
        ev: [{ t: b(0.1), fn: (e) => { G.SFX.play('c4_inhale'); if (ph === 2) shadowSing(e, b(6)); } }]
          .concat(launches.map(([k, who]) => ({ t: b(k), fn: (e) => wallFrom(e, who) }))),
      };
    },
    // 聚光燈 — pools lock after two beats and burn on the next; phase 2 adds a second, interleaved wave
    spot(B, ph) {
      const b = (x) => x * B;
      const ev = [{ t: b(1), fn: (e) => spotWave(e, 0, b(2), b(3)) }];
      if (ph === 2) ev.push({ t: b(3), fn: (e) => spotWave(e, 1, b(2), b(3)) });
      return {
        dur: b(ph === 2 ? 7.4 : 5.4), cd: 1.0, track: false,
        tells: [{ t: b(0.5), c: 'red' }],
        poses: [[0, IDLE0], [b(0.8), PS.UP], [b(1.2), PS.CALL, 'snap'], [b(ph === 2 ? 2.8 : 4.2), PS.CALL], [b(ph === 2 ? 3.2 : 4.6), PS.UP], [b(ph === 2 ? 6.4 : 5.4), PS.REC], [b(ph === 2 ? 7.4 : 5.4), IDLE0]],
      };
    },
    // 墜落吊燈 — the chandelier over the player drops two beats after it appears (red: get out from under it)
    chand(B, ph) {
      const b = (x) => x * B;
      const ev = [{ t: b(1), fn: (e) => dropChandelier(e, b(2)) }];
      if (ph === 2) ev.push({ t: b(2.5), fn: (e) => dropChandelier(e, b(2)) });
      return {
        dur: b(ph === 2 ? 6 : 4.8), cd: 1.0, track: false,
        tells: [{ t: b(0.5), c: 'red' }],
        poses: [[0, IDLE0], [b(0.8), PS.UP], [b(2.6), PS.UP], [b(3), PS.CALL, 'snap'], [b(ph === 2 ? 5 : 3.8), PS.REC], [b(ph === 2 ? 6 : 4.8), IDLE0]],
      };
    },
    // 玻璃高音 — she hugs herself, the gown glows red and cracks… then bursts (red, all around her)
    shatter(B) {
      const b = (x) => x * B;
      return {
        dur: b(5.4), cd: 1.0, track: false,
        tells: [{ t: b(0.4), c: 'red' }],
        poses: [[0, IDLE0], [b(0.6), PS.HUG], [b(1.9), PS.HUG2], [b(2), PS.BURST, 'snap'], [b(3.2), PS.BURST], [b(4.2), PS.EXH], [b(5.4), IDLE0]],
        hits: [{ t0: b(2) - 0.03, t1: b(2) + 0.16, box: BOX.burst, dmg: 24, red: true, kb: 430, last: true }],
        ev: [{ t: b(0.4), fn: sfx('c4_inhale') }, { t: b(2) - 0.02, fn: (e) => glassBurst(e) }],
      };
    },
    // 謝幕 — a deep révérence, then she glides across the stage with the fan low (white, the last hit of a phrase)
    bow(B) {
      const b = (x) => x * B;
      return {
        dur: b(4.4), cd: 1.0, track: false,
        tells: [{ t: b(0.4), c: 'white' }],
        poses: [[0, IDLE0], [b(1.2), PS.BOW], [b(1.45), PS.BOW], [b(1.6), PS.GLIDE, 'snap'], [b(2.3), PS.GLIDE], [b(3.2), PS.REC], [b(4.4), IDLE0]],
        hits: [{ t0: b(1.5), t1: b(2.15), box: BOX.bow, dmg: 18, kb: 360, last: true, pbal: 60 }],
        ev: [{ t: b(1.45), fn: (e) => { G.SFX.play('c4_fan'); G.SFX.play('whoosh', 1.1); } }],
        glide: [b(1.5), b(2.1)],
      };
    },
    // 二重唱 — Lucette (beats 2, 4) and her shadow behind you (beat 3) trade blows; on 5½ both swing at once (red: dodge through)
    duet(B) {
      const b = (x) => x * B;
      return {
        dur: b(7.6), cd: 1.0, trackWin: 0.7, trackSpeed: 330,
        tells: [{ t: tellBy(b(1), b(2) - 0.07), c: 'white' }, { t: tellBy(b(3), b(3.85)), c: 'white' }, { t: tellBy(b(4.3), b(5.5) - 0.07, true), c: 'red' }],
        poses: [[0, IDLE0], [b(1), PS.W1], [b(1.82), PS.W1b], [b(2), PS.S1, 'snap'], [b(2.6), PS.S1r], [b(3.4), PS.W2], [b(3.85), PS.W2], [b(4), PS.S2, 'snap'],
          [b(4.4), PS.W3a], [b(5.3), PS.W3], [b(5.5), PS.S3, 'snap'], [b(6.4), PS.REC], [b(7.6), IDLE0]],
        hits: [
          { t0: b(2) - 0.07, t1: b(2) + 0.08, box: BOX.s1, dmg: 15, kb: 260 },
          { t0: b(3.85), t1: b(4) + 0.07, box: BOX.s2, dmg: 15, kb: 260 },
          { t0: b(5.5) - 0.07, t1: b(5.5) + 0.09, box: BOX.s3, dmg: 22, red: true, kb: 400, last: true },
        ],
        ev: [
          { t: b(0.2), fn: (e) => shadowEngage(e) },
          // the shadow lands on beats 3 and 5½; its own tell flashes when the strike is queued, at least 0.53 / 0.69 s ahead
          { t: b(3) - Math.max(b(1), 0.53), fn: (e) => shadowStrike(e, 's1', Math.max(b(1), 0.53), false) },
          { t: b(5.5) - Math.max(b(1.2), 0.69), fn: (e) => shadowStrike(e, 's3', Math.max(b(1.2), 0.69), true) },
          { t: b(2) - 0.06, fn: sfx('slash', 0.75) }, { t: b(3.86), fn: sfx('slash', 0.85) }, { t: b(5.5) - 0.06, fn: sfx('slash', 0.6, true) },
        ],
      };
    },
    // 終幕詠嘆 — the duet's last movement: walls from her side and from the shadow's side, one per beat
    finale(B) {
      const b = (x) => x * B;
      return {
        dur: b(9.4), cd: 1.2, track: false,
        tells: [{ t: b(0.5), c: 'white' }],
        poses: [[0, IDLE0], [b(0.6), PS.INH], [b(1.85), PS.INH2], [b(2), PS.SING, 'snap'], [b(6), PS.SING2], [b(7.2), PS.SING], [b(8.2), PS.EXH], [b(9.4), IDLE0]],
        ev: [{ t: b(0.1), fn: (e) => { G.SFX.play('c4_inhale'); shadowSing(e, b(7.5)); } }]
          .concat([[2, 'L'], [3, 'S'], [4, 'L'], [5, 'S']].map(([k, who]) => ({ t: b(k), fn: (e) => wallFrom(e, who) }))),
      };
    },
  };
  const MELEE = { fan: true, duet: true };

  /* ------------------------------------------------------------------ hazards */
  function addBal(e, n) {
    if (!e || e.dead || e.state === 'broken' || e.state === 'die') return;
    e.bal = Math.min(e.maxBal, e.bal + n); e.balT = 0; e.showBar = 3; e.hitT = 0; e.hitPow = 0.5; e.hitDir = -e.facing;
    if (e.bal >= e.maxBal) e.breakBalance();
  }
  const arenaOf = (e) => G.game.arena || { x0: e.x - 700, x1: e.x + 700 };

  // aria wall: a white wavefront of staff lines; perfect guard shatters it and costs her balance
  function wallFrom(e, who) {
    const g = G.game, P = g.player;
    const src = who === 'S' && e.shadow && !e.shadow.done ? e.shadow : e;
    const dir = Math.sign(P.x - src.x) || src.facing || 1;
    const x = src.x + dir * 70, dist = Math.abs(P.x - x);
    const sp = U.clamp(dist / (2 * e.B), 160, 950);
    g.hazards.push({ kind: 'c4_wall', t: 0, life: 6, x, y: e.y, dir, sp, owner: e, shadow: src !== e, update: wallUpdate, draw: wallDraw });
    G.SFX.play('c4_wall', src !== e ? 1 : 0); G.FX.ring(x, e.y - 120, 10, 90, 0.35, '#ffffff', 4);
    if (src.tellT != null) { src.tellT = 0.35; src.tellCol = 'white'; }
  }
  function wallUpdate(h, dt, g) {
    const P = g.player, e = h.owner;
    if (h.broke) { h.bt += dt; if (h.bt > 0.35) h.done = true; return; }
    h.x += h.dir * h.sp * dt;
    const ar = arenaOf(e);
    if (h.x < ar.x0 - 60 || h.x > ar.x1 + 60) { h.done = true; return; }
    if (!h.hit && Math.abs(P.x - h.x) < 24 && P.y > h.y - 236 && P.y - 100 < h.y) {
      const res = P.receiveHit(e, { dmg: 14, kb: 250, hx: P.x - h.dir * 8, hy: P.y - 60, waveFrom: h.x - h.dir * 60 });
      if (res === 'ignored') return;
      h.hit = true;
      if (res === 'parried' || res === 'blocked') {
        h.broke = true; h.bt = 0;
        G.FX.shards(h.x, h.y - 110, res === 'parried' ? 14 : 6, '#ffffff', 420);
        if (res === 'parried') { addBal(e, 40); G.FX.ring(h.x, h.y - 110, 10, 120, 0.35, ROSE_HI, 5); G.SFX.play('c4_glass', 5, 0.6); }
      }
    }
  }
  function wallDraw(ctx, h) {
    const x = h.x, y = h.y, d = h.dir, H = 232;
    const a = h.broke ? 1 - h.bt / 0.35 : Math.min(1, h.t / 0.12);
    if (a <= 0) return;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x - d * 20, y - H / 2, 130, h.shadow ? '#d9c8ff' : '#ffffff', 0.2 * a);
    // five staff lines trailing behind the front (fading in three steps)
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const ly = y - 44 - i * 36 + Math.sin(h.t * 9 + i) * 2;
      for (let s = 0; s < 3; s++) {
        ctx.strokeStyle = `rgba(255,255,255,${(0.55 - s * 0.17) * a})`; ctx.lineWidth = 2.2 - s * 0.5;
        ctx.beginPath(); ctx.moveTo(x - d * (8 + s * 50), ly); ctx.lineTo(x - d * (58 + s * 50), ly); ctx.stroke();
      }
    }
    // notes riding the staff
    ctx.fillStyle = `rgba(255,236,246,${0.85 * a})`; ctx.strokeStyle = `rgba(255,236,246,${0.85 * a})`; ctx.lineWidth = 1.6;
    for (let k = 0; k < 3; k++) {
      const nx = x - d * (34 + k * 40), ny = y - 62 - ((k * 53 + 30) % 140);
      ctx.beginPath(); ctx.ellipse(nx, ny, 6, 4.4, -0.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(nx + 5.4, ny - 1); ctx.lineTo(nx + 5.4, ny - 24); ctx.quadraticCurveTo(nx + 12, ny - 18, nx + 13, ny - 10); ctx.stroke();
    }
    // the crescent wavefront
    ctx.fillStyle = `rgba(255,255,255,${0.8 * a})`;
    ctx.beginPath(); ctx.moveTo(x - d * 4, y + 2); ctx.quadraticCurveTo(x + d * 34, y - H / 2, x - d * 4, y - H);
    ctx.quadraticCurveTo(x + d * 10, y - H / 2, x - d * 4, y + 2); ctx.fill();
    ctx.strokeStyle = `rgba(${h.shadow ? '190,170,255' : '255,160,205'},${0.6 * a})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x - d * 14, y); ctx.quadraticCurveTo(x + d * 16, y - H / 2, x - d * 14, y - H); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  // spotlights: three pools (one follows you until it locks), lock → countdown ring → burn (red, unblockable)
  function spotWave(e, wave, lockIn, burnIn) {
    const g = G.game, P = g.player, ar = arenaOf(e);
    const cl = (x) => U.clamp(x, ar.x0 + 90, ar.x1 - 90);
    const xs = wave === 0 ? [P.x, P.x + 270, P.x - 270, P.x + 540, P.x - 540] : [P.x + 135, P.x - 135, P.x + 405, P.x - 405];
    const n = e.phase === 2 ? (wave === 0 ? 3 : 4) : 3;
    const used = [];
    for (let i = 0; i < xs.length && used.length < n; i++) {
      const x = cl(xs[i]);
      if (used.some((u) => Math.abs(u - x) < 150)) continue;
      used.push(x);
      g.hazards.push({ kind: 'c4_spot', t: 0, x, y: e.y, r: 80, follow: wave === 0 && i === 0, lockAt: lockIn, burnAt: burnIn, life: burnIn + 0.7, owner: e, update: spotUpdate, draw: spotDraw });
    }
    G.SFX.play('c4_spot');
  }
  function spotUpdate(h, dt, g) {
    const e = h.owner, P = g.player;
    if (!h.burned && (e.dead || e.state === 'broken')) { h.cancel = (h.cancel || 0) + dt; if (h.cancel > 0.3) h.done = true; return; }
    if (h.follow && h.t < h.lockAt) { const ar = arenaOf(e); h.x = U.clamp(U.approach(h.x, P.x, 230 * dt), ar.x0 + 90, ar.x1 - 90); }
    if (!h.locked && h.t >= h.lockAt) { h.locked = true; G.SFX.play('c4_spot', 1); }
    if (!h.burned && h.t >= h.burnAt) {
      h.burned = true; G.SFX.play('c4_burn'); g.shake(0.22);
      G.FX.ember(h.x, h.y - 10, 12, '#ffb08a', { w: h.r * 1.6, h: 16, up: 260 });
    }
    if (h.burned && !h.hit && h.t < h.burnAt + 0.3 && Math.abs(P.x - h.x) < h.r && P.y > h.y - 320) {
      const res = P.receiveHit(e, { dmg: 20, unblockable: true, kb: 240, hx: P.x, hy: P.y - 50, waveFrom: h.x });
      if (res !== 'ignored') h.hit = true;
    }
  }
  function spotDraw(ctx, h) {
    const x = h.x, y = h.y, r = h.r, top = y - 900;
    const a = Math.min(1, h.t / 0.25) * (h.cancel ? 1 - h.cancel / 0.3 : 1) * (h.burned ? U.clamp(1 - (h.t - h.burnAt - 0.25) / 0.45, 0, 1) : 1);
    if (a <= 0) return;
    const warn = U.clamp((h.t - h.lockAt) / (h.burnAt - h.lockAt), 0, 1);
    const flick = h.locked && !h.burned && warn > 0.62 && Math.sin(h.t * 46) > 0;
    const col = h.burned ? '255,64,96' : flick ? '255,80,104' : h.locked ? '255,200,128' : '255,240,214';
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createLinearGradient(0, top, 0, y);
    gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.7, `rgba(${col},${0.08 * a})`); gr.addColorStop(1, `rgba(${col},${(h.burned ? 0.5 : 0.22) * a})`);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(x - 16, top); ctx.lineTo(x + 16, top); ctx.lineTo(x + r, y); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(${col},${(h.burned ? 0.55 : 0.28) * a})`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${0.85 * a})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.2, 0, 0, TAU); ctx.stroke();
    if (h.locked && !h.burned) {
      // countdown: a ring that closes onto the pool's rim at the burn
      const rr = r * (1 + (1 - warn) * 0.9);
      ctx.strokeStyle = `rgba(${col},${0.9 * a})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.2, 0, 0, TAU); ctx.stroke();
    }
    if (h.burned) {
      const bk = U.clamp(1 - (h.t - h.burnAt) / 0.5, 0, 1);
      ctx.fillStyle = `rgba(255,70,100,${0.5 * bk})`; ctx.fillRect(x - r * 0.85, top, r * 1.7, y - top);
      ctx.fillStyle = `rgba(255,236,240,${0.75 * bk})`; ctx.fillRect(x - r * 0.22, top, r * 0.44, y - top);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // chandelier: hangs over where the player stands, its shadow + red ring grow on the floor, drops on the beat
  function dropChandelier(e, dropIn) {
    const g = G.game, P = g.player, ar = arenaOf(e);
    const x = U.clamp(P.x + P.vx * 0.25, ar.x0 + 110, ar.x1 - 110);
    g.hazards.push({ kind: 'c4_chand', t: 0, x, y0: e.y - 430, y: e.y - 430, floor: e.y, r: 112, dropAt: dropIn, life: dropIn + 1.9, owner: e, seed: (Math.random() * 1e6) | 0, update: chandUpdate, draw: chandDraw });
    G.SFX.play('c4_creak');
  }
  function chandUpdate(h, dt, g) {
    const e = h.owner, P = g.player;
    if (!h.dropping && (e.dead || e.state === 'broken')) { h.yank = (h.yank || 0) + dt; h.y -= 900 * dt; if (h.yank > 0.8) h.done = true; return; }
    if (h.t < h.dropAt) { h.y = h.y0 + Math.sin(h.t * 3) * 4; return; }
    if (!h.dropping) { h.dropping = true; G.SFX.play('whoosh', 0.6); }
    const k = U.clamp((h.t - h.dropAt) / 0.3, 0, 1);
    h.y = U.lerp(h.y0, h.floor, k * k);
    if (k >= 1 && !h.landed) {
      h.landed = true; h.landT = h.t;
      G.SFX.play('c4_crash'); g.shake(0.8); g.hitstop(0.03);
      G.FX.shards(h.x, h.floor - 10, 16, '#dff6ff', 620); G.FX.shards(h.x, h.floor - 10, 8, GOLD, 480);
      G.FX.dust(h.x, h.floor, 24, { w: 160, speed: 320, size: 16, col: 'rgba(220,190,170,' });
      G.FX.ring(h.x, h.floor, 10, 170, 0.45, '#ffd9a8', 5, { flat: 0.2 });
      if (Math.abs(P.x - h.x) < h.r && P.y > h.floor - 280) P.receiveHit(e, { dmg: 26, unblockable: true, kb: 420, hx: P.x, hy: P.y - 50, waveFrom: h.x });
    }
  }
  function drawChandelierBody(ctx, x, y, t, wreck, seed) {
    const sw = wreck ? 0 : Math.sin(t * 2.2) * 0.04;
    ctx.save(); ctx.translate(x, y); ctx.rotate(sw + (wreck ? 0.12 : 0));
    if (wreck) ctx.scale(1.15, 0.55);
    // chain into the flies
    if (!wreck) {
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, -1100); ctx.stroke();
      ctx.strokeStyle = '#8a6a34'; ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(0, -84 - i * 16, i % 2 ? 2 : 4, 7, 0, 0, TAU); ctx.stroke(); }
    }
    // warm glow of the candles
    if (!wreck) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, 0, -10, 130, '#ffc878', 0.32); ctx.globalCompositeOperation = 'source-over'; }
    const ring = (ry, rx, yy, w) => {
      ctx.lineWidth = w + 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(0, yy, rx, ry, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = w; ctx.strokeStyle = GOLD; ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = GOLD_HI; ctx.beginPath(); ctx.ellipse(0, yy, rx, ry, 0, PI * 1.08, PI * 1.92); ctx.stroke();
    };
    // stem + crown
    Rig.limb(ctx, { x: 0, y: -66 }, { x: 0, y: 14 }, 4.5, 3.5, GOLD, { spec: 0.4, noHatch: true });
    ring(5, 26, -54, 3);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * PI; ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 26 - 2.5, -54); ctx.lineTo(Math.cos(a) * 24, -70 - (i % 2) * 6); ctx.lineTo(Math.cos(a) * 26 + 2.5, -54); ctx.fill(); }
    // back half of the arms + ring, candles
    const N = 6;
    const pts = Array.from({ length: N }, (_, i) => { const a = (i / N) * TAU + 0.3; return { x: Math.cos(a) * 72, y: Math.sin(a) * 16, front: Math.sin(a) > 0 }; });
    ctx.lineCap = 'round';
    for (const p of pts) if (!p.front) { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(p.x * 0.5, -30, p.x, p.y); ctx.stroke(); ctx.strokeStyle = '#b38a40'; ctx.lineWidth = 2.6; ctx.stroke(); }
    ring(16, 72, 0, 4.5);
    ctx.beginPath(); ctx.ellipse(0, 18, 18, 9, 0, 0, PI); ctx.fillStyle = GOLD; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    for (const p of pts) if (p.front) { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(p.x * 0.5, -30, p.x, p.y); ctx.stroke(); ctx.strokeStyle = GOLD; ctx.lineWidth = 2.6; ctx.stroke(); }
    // crystal drops (swing a little)
    const rng = U.mulberry32(seed || 7);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + 0.1, px = Math.cos(a) * 70, py = Math.sin(a) * 15, L = 12 + rng() * 16, s = Math.sin(t * 3 + i) * 2;
      ctx.strokeStyle = 'rgba(230,248,255,0.7)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + s, py + L); ctx.stroke();
      ctx.fillStyle = i % 3 ? '#dff6ff' : '#9fd8ee';
      ctx.beginPath(); ctx.moveTo(px + s, py + L - 2); ctx.lineTo(px + s + 3.5, py + L + 5); ctx.lineTo(px + s, py + L + 13); ctx.lineTo(px + s - 3.5, py + L + 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.stroke();
    }
    // candles + flames
    for (const p of pts) {
      ctx.fillStyle = '#f3ead8'; ctx.fillRect(p.x - 3, p.y - 16, 6, 14); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(p.x - 3, p.y - 16, 6, 14);
      if (!wreck) {
        const fl = 1 + Math.sin(t * 17 + p.x) * 0.15;
        ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.moveTo(p.x, p.y - 30 * fl); ctx.quadraticCurveTo(p.x + 5, p.y - 19, p.x, p.y - 15); ctx.quadraticCurveTo(p.x - 5, p.y - 19, p.x, p.y - 30 * fl); ctx.fill();
        ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 19, 1.8, 3.2, 0, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  function chandDraw(ctx, h) {
    const fade = h.landed ? U.clamp(1 - (h.t - h.landT - 0.9) / 0.9, 0, 1) : 1;
    if (!h.landed && !h.yank) {
      // floor warning: shadow + red ring, pulsing harder as the drop nears
      const k = U.clamp(h.t / h.dropAt, 0, 1), fall = h.dropping ? U.clamp((h.t - h.dropAt) / 0.3, 0, 1) : 0;
      ctx.fillStyle = `rgba(10,4,14,${0.25 + 0.35 * k + 0.3 * fall})`;
      ctx.beginPath(); ctx.ellipse(h.x, h.floor, h.r * (0.5 + 0.5 * k), h.r * 0.2 * (0.5 + 0.5 * k), 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = U.rgba(CRIM, 0.45 + 0.45 * k * (0.6 + 0.4 * Math.sin(h.t * 18))); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(h.x, h.floor, h.r, h.r * 0.2, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = U.rgba(CRIM, 0.12 + 0.18 * k); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (fade <= 0) return;
    ctx.globalAlpha = fade;
    drawChandelierBody(ctx, h.x, h.landed ? h.floor - 6 : h.y, h.t, h.landed, h.seed);
    ctx.globalAlpha = 1;
  }

  // glass high-C: the visible burst (damage comes from the attack's own red hit box)
  function glassBurst(e) {
    const g = G.game;
    g.hazards.push({ kind: 'c4_burst', t: 0, life: 0.6, x: e.x, y: e.y - 140, seed: (Math.random() * 1e6) | 0, owner: e, update() { }, draw: burstDraw });
    G.SFX.play('c4_glass', 12, 1.2); G.SFX.play('c4_aria', 93, 0.7, 0.07);
    g.shake(0.6);
    G.FX.shards(e.x, e.y - 140, 26, '#e6f7ff', 820); G.FX.shards(e.x, e.y - 120, 10, CRIM, 620);
    G.FX.ring(e.x, e.y - 130, 20, 260, 0.4, CRIM, 7); G.FX.flash(e.x, e.y - 140, 260, 0.25, '#ffd0dc');
  }
  function burstDraw(ctx, h) {
    const k = h.t / h.life, d = 40 + U.easeOutCubic(k) * 240, a = 1 - k;
    const rng = U.mulberry32(h.seed);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = U.rgba(CRIM, 0.6 * a); ctx.lineWidth = 10 * a + 2;
    ctx.beginPath(); ctx.ellipse(h.x, h.y + 40, d, d * 0.62, 0, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * TAU + rng() * 0.3, dd = d * (0.7 + rng() * 0.45), px = h.x + Math.cos(ang) * dd, py = h.y + 40 + Math.sin(ang) * dd * 0.62;
      ctx.save(); ctx.translate(px, py); ctx.rotate(ang + PI / 2); ctx.globalAlpha = a;
      const L = 10 + rng() * 14;
      ctx.fillStyle = i % 3 === 0 ? '#ff9ab8' : '#e6f7ff'; ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(4, 0); ctx.lineTo(0, L * 0.5); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // intro: a spotlight finds her as she rises through the stage trap; the orchestra's first note
  function introFx(e) {
    G.game.hazards.push({
      kind: 'c4_intro', t: 0, life: 3.2, owner: e,
      update(h) {
        if (!h.s0) { h.s0 = true; G.SFX.play('c4_spot', 1); G.SFX.play('c4_aria', 76, 2.2, 0.05); }
        if (!h.s1 && h.t > 1.55) { h.s1 = true; G.SFX.play('c4_fan'); G.SFX.play('c4_aria', 83, 1.4, 0.07); }
      },
      draw(ctx, h) {
        const e2 = h.owner, a = Math.min(1, h.t / 0.3) * U.clamp((3.2 - h.t) / 0.8, 0, 1);
        const x = e2.x, y = e2.y, top = y - 900, r = 150;
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createLinearGradient(0, top, 0, y);
        gr.addColorStop(0, 'rgba(255,240,220,0)'); gr.addColorStop(1, `rgba(255,240,220,${0.26 * a})`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 24, top); ctx.lineTo(x + 24, top); ctx.lineTo(x + r, y); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(255,240,220,${0.3 * a})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.18, 0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      },
    });
  }

  /* ------------------------------------------------------------------ the shadow (phase 2): a mirrored second voice behind the player */
  function makeShadow(e) {
    return {
      kind: 'c4_shadow', t: 0, owner: e, x: e.x, y: e.y, facing: -e.facing, vx: 0, alpha: 0, born: 0,
      pz: Object.assign({}, e.pz || IDLE0), anim: null, strikes: [], engageT: 0, tellT: 0, tellCol: null, trail: [],
      hair: [new Rig.Chain(11, 11, 0.05, 0.9), new Rig.Chain(10, 10, 0.05, 0.9), new Rig.Chain(12, 11, 0.05, 0.9)],
      veil: new Rig.Chain(10, 15, 0.035, 0.92), pearl: [new Rig.Chain(6, 9, 0.12, 0.85)],
      update: shadowUpdate, draw: shadowDraw,
    };
  }
  function shadowEngage(e) { const h = e.shadow; if (h && !h.done) h.engageT = Math.max(h.engageT, e.B * 7); }
  function shadowSing(e, dur) {
    const h = e.shadow; if (!h || h.done) return;
    const B = e.B;
    h.singT = dur + B;
    h.anim = { t0: h.t, keys: [[0, h.pz], [B * 0.6, PS.INH], [B * 1.85, PS.INH2], [B * 2, PS.SING, 'snap'], [dur, PS.SING2], [dur + B, IDLE0]] };
  }
  function shadowStrike(e, kind, hitIn, red) {
    const h = e.shadow; if (!h || h.done) return;
    const B = e.B, big = kind === 's3';
    h.engageT = Math.max(h.engageT, hitIn + B * 2);
    h.strikes.push({ hitAt: h.t + hitIn, box: big ? BOX.s3 : BOX.s1, dmg: big ? 22 : 15, red, kb: big ? 400 : 260, pbal: red ? 0 : 55, done: false, swish: false });
    const W = big ? PS.W3 : PS.W1b, S = big ? PS.S3 : PS.S1;
    h.anim = { t0: h.t, keys: [[0, h.pz], [hitIn * 0.4, big ? PS.W3a : PS.W1], [hitIn - 0.18, W], [hitIn, S, 'snap'], [hitIn + B * 0.8, PS.REC], [hitIn + B * 2, IDLE0]] };
    h.tellT = 0.5; h.tellCol = red ? 'red' : 'white'; h.tellPending = true;
  }
  function shadowUpdate(h, dt, g) {
    const e = h.owner, P = g.player;
    if (e.dead || e.remove || !g.enemies.includes(e)) { h.alpha -= dt * 2; if (h.alpha <= 0) h.done = true; return; }
    h.born += dt; h.engageT = Math.max(0, h.engageT - dt); h.tellT = Math.max(0, h.tellT - dt);
    const engaged = h.engageT > 0 || h.strikes.length > 0;
    const ar = arenaOf(e);
    // stand beyond the player, away from Lucette (the other side of the stage); fall back to her side if there is no room
    h.singT = Math.max(0, (h.singT || 0) - dt);
    let side = Math.sign(P.x - e.x) || 1, want = engaged ? 168 : h.singT > 0 ? 380 : 280;
    if (P.x + side * want > ar.x1 - 70 || P.x + side * want < ar.x0 + 70) { side = -side; want = Math.max(want, 300); }
    const tx = U.clamp(P.x + side * want, ar.x0 + 60, ar.x1 - 60);
    const nextHit = h.strikes.reduce((m, s) => Math.min(m, s.hitAt - h.t), 9);
    const planted = nextHit < 0.16 && nextHit > -0.12;
    const born = U.clamp(h.born / 1.2, 0, 1);
    h.vx = U.approach(h.vx, planted ? 0 : U.clamp((tx - h.x) * 4, -640, 640) * born, 2600 * dt);
    h.x += h.vx * dt; h.y = e.y;
    if (!planted) h.facing = P.x < h.x ? -1 : 1;
    h.alpha = U.approach(h.alpha, (engaged ? 0.96 : 0.62) * born, dt * 2.5);
    // tells (stars at the shadow's fan) + strike windows
    if (h.tellPending) {
      h.tellPending = false;
      const w = h.Jw || { x: h.x + h.facing * 120, y: h.y - 230 };
      const red = h.tellCol === 'red';
      G.FX.star(w.x, w.y, red ? CRIM : '#ffffff', red ? 70 : 52, red ? 0.5 : 0.38);
      if (red) G.FX.flash(w.x, w.y, 90, 0.45, CRIM);
      G.SFX.play(red ? 'tellRed' : 'tellWhite');
    }
    for (const s of h.strikes) {
      if (s.done) continue;
      const rel = h.t - s.hitAt;
      if (!s.swish && rel > -0.07) { s.swish = true; G.SFX.play('slash', s.red ? 0.6 : 0.8, s.red); }
      if (rel > 0.1) { s.done = true; continue; }
      if (rel < -0.07) continue;
      const b = s.box, bw = h.facing > 0 ? { x: h.x + b.x, y: h.y + b.y, w: b.w, h: b.h } : { x: h.x - b.x - b.w, y: h.y + b.y, w: b.w, h: b.h };
      if (U.rectsOverlap(bw, P.hurtbox)) {
        s.done = true;
        const res = P.receiveHit(e, { dmg: s.dmg, unblockable: s.red, kb: s.kb, hx: bw.x + bw.w / 2, hy: bw.y + bw.h / 2, waveFrom: h.x });
        if (res === 'parried') { addBal(e, s.pbal); h.recoil = 0.5; G.FX.ring(h.x, h.y - 150, 10, 140, 0.4, VIOLET, 5); G.FX.shards(h.x, h.y - 150, 10, VIOLET, 400); }
      }
    }
    h.strikes = h.strikes.filter((s) => !s.done);
    h.recoil = Math.max(0, (h.recoil || 0) - dt);
  }
  function shadowDraw(ctx, h, g) {
    const dt = g.dtVis;
    let target;
    if (h.anim) { const at = h.t - h.anim.t0, last = h.anim.keys[h.anim.keys.length - 1][0]; if (at > last) h.anim = null; else target = sample(h.anim.keys, at); }
    if (!target) target = PS.idle(h.t * 0.9 + 1.7, h.owner && h.owner.B ? beatPos(h.owner) : 0);
    if (h.recoil > 0) target = lerpPose(target, full(PS.HURT), h.recoil * 1.6 > 1 ? 1 : h.recoil * 1.6);
    if (dt > 0) h.pz = lerpPose(full(h.pz), target, 1 - Math.exp(-(h.anim ? 30 : 9) * dt));
    const J = joints(h.pz);
    h.Jw = { x: h.x + h.facing * J.tip.x, y: h.y + J.tip.y };
    if (dt > 0) { h.trail.push(J.fa); if (h.trail.length > 4) h.trail.shift(); }
    updateChains(h, J, h.x, h.y, h.facing, dt, true);
    if (h.alpha <= 0.01) return;
    ctx.globalAlpha = U.clamp(h.alpha, 0, 1);
    ctx.translate(h.x, h.y); ctx.scale(h.facing, 1);
    const hitOn = h.strikes.some((s) => h.t > s.hitAt - 0.1 && h.t < s.hitAt + 0.1);
    drawDiva(ctx, h, J, { shadow: true, p2k: 1, t: h.t, pulse: h.owner && h.owner.B ? Math.exp(-((beatPos(h.owner) % 1 + 1) % 1) * 5) : 0, tellT: h.tellT, tellCol: h.tellCol, trail: hitOn, red: 0, dt });
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ cloth / hair chains */
  function updateChains(o, J, ox, oy, facing, dt, loose) {
    const W = (q) => ({ x: ox + facing * q.x, y: oy + q.y });
    if (dt <= 0 && o.hair[0].inited) return;
    const d = dt > 0 ? dt : 1 / 60;
    const wind = -(o.vx || 0) * 5 + Math.sin(o.t * 1.3) * 260;
    o.hair.forEach((c, i) => {
      if (!loose && i > 1) return;
      const a = W(headPt(J, -10.5 + i * 1.5, -4 + i * 3.2));
      c.update(a.x, a.y, facing, d, wind * (1 + i * 0.2), 2.75 - i * 0.12);
    });
    const v = W(headPt(J, -8, -15));
    o.veil.update(v.x, v.y, facing, d, wind * 1.4 - facing * 120, 2.35);
    o.pearl.forEach((c, i) => { const a = W(J.at(-2, i ? -11 : 9)); c.update(a.x, a.y, facing, d, wind * 0.3, PI - 0.1); });
  }

  /* ------------------------------------------------------------------ drawing */
  function smoothPath(ctx, pts) {
    ctx.beginPath(); ctx.moveTo((pts[0].x + pts[pts.length - 1].x) / 2, (pts[0].y + pts[pts.length - 1].y) / 2);
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    ctx.closePath();
  }
  const ink = (ctx, w, col) => { ctx.strokeStyle = col || INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.stroke(); };
  const toLocal = (pts, ox, oy, facing) => pts.map((q) => ({ x: (q.x - ox) * facing, y: q.y - oy }));

  // the gown: velvet underskirt, faceted glass gores, crinoline hoops, a fringe of glass shards at the hem, a glass train
  function gownGeo(J, p, t) {
    const wy = J.W.y, Rf = 108 + p.crouch * 34, Rb = 122 + p.crouch * 34, hemY = -10, sk = p.skirt;
    const rib = (i, v) => {
      const u = i / NR, top = J.W.x + U.lerp(-15, 15, u), bot = U.lerp(-Rb, Rf, u) + sk * 22;
      const f = 1 - Math.pow(1 - v, 2.5), side = u * 2 - 1;
      const bustle = Math.max(0, 1 - u * 2.2) * 30 * Math.sin(Math.min(1, v / 0.6) * PI);      // gathered at the back
      const flare = v > 0.78 ? side * 14 * Math.pow((v - 0.78) / 0.22, 2) : 0;                  // the hem kicks out
      return { x: top + (bot - top) * f + side * 9 * Math.sin(v * PI) - bustle + flare, y: wy + (hemY - wy) * v };
    };
    return { rib, Rf, Rb, hemY, sk, wy };
  }
  const VS = [0, 0.18, 0.4, 0.64, 0.84, 1];
  const BROKEN = { 1: 1, 4: 1, 6: 1 };
  function drawGown(ctx, J, p, o, C) {
    const gg = gownGeo(J, p, o.t), rib = gg.rib, sh = o.shadow, t = o.t, burst = o.burst || 0;
    const Ld = Rig.lightDir(ctx).x >= 0 ? 1 : -1;
    // contact shadow
    if (!sh) { ctx.fillStyle = 'rgba(8,3,14,0.45)'; ctx.beginPath(); ctx.ellipse(gg.sk * 10, 1, gg.Rf + 34, 12, 0, 0, TAU); ctx.fill(); }
    // train (behind)
    const tw = Math.sin(t * 1.3) * 7;
    const r0 = rib(0, 0.6), tr = [r0, { x: -gg.Rb - 64 + gg.sk * 34 + tw, y: -6 }, { x: -gg.Rb - 30 + tw * 0.5, y: 1 }, { x: -gg.Rb * 0.35, y: 1 }];
    ctx.beginPath(); ctx.moveTo(r0.x, r0.y); ctx.quadraticCurveTo(-gg.Rb - 20, -40, tr[1].x, tr[1].y); ctx.quadraticCurveTo(tr[1].x + 10, 2, tr[2].x, tr[2].y); ctx.lineTo(tr[3].x, tr[3].y); ctx.closePath();
    ctx.fillStyle = sh ? SHD.fill : C.dark; ctx.fill(); ink(ctx, 2, sh ? U.rgba(SHD.rim, 0.7) : INK);
    if (!sh) { ctx.strokeStyle = U.rgba(C.edge, 0.55); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(r0.x - 6, r0.y + 12); ctx.quadraticCurveTo(-gg.Rb - 14, -30, tr[1].x + 14, tr[1].y - 6); ctx.stroke(); }
    // silhouette path
    const outline = () => {
      ctx.beginPath();
      VS.forEach((v, k) => { const q = rib(0, v); k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
      for (let k = VS.length - 1; k >= 0; k--) { const q = rib(NR, VS[k]); ctx.lineTo(q.x, q.y); }
      ctx.closePath();
    };
    // velvet underskirt (shows through the glass)
    outline(); ctx.fillStyle = sh ? SHD.fill : C.under; ctx.fill();
    if (!sh) { ctx.save(); outline(); ctx.clip(); ctx.fillStyle = C.underD; ctx.fillRect(-300, gg.wy + (gg.hemY - gg.wy) * 0.55, 600, 200); ctx.restore(); }
    const p2 = o.p2k || 0;
    // glass gores
    for (let i = 0; i < NR; i++) {
      const c = ((i + 0.5) / NR) * 2 - 1, b = c * Ld;
      const broken = !sh && p2 > 0.4 && BROKEN[i];
      const vmax = broken ? 0.62 : 1;
      const vs = VS.filter((v) => v < vmax).concat([vmax]);
      const ox = burst * c * 50, oy = -burst * 26 * (1 - Math.abs(c));
      ctx.beginPath();
      vs.forEach((v, k) => { const q = rib(i, v); k ? ctx.lineTo(q.x + ox, q.y + oy) : ctx.moveTo(q.x + ox, q.y + oy); });
      if (broken) { // jagged break edge
        const a = rib(i, vmax), z = rib(i + 1, vmax);
        for (let s = 1; s < 4; s++) { const m = lerpP(a, z, s / 4); ctx.lineTo(m.x + ox, m.y + oy + (s % 2 ? -14 : 8)); }
      }
      for (let k = vs.length - 1; k >= 0; k--) { const q = rib(i + 1, vs[k]); ctx.lineTo(q.x + ox, q.y + oy); }
      ctx.closePath();
      if (sh) { ctx.fillStyle = (i % 2) ? SHD.fill : SHD.body; ctx.fill(); }
      else {
        const tone = b > 0.55 ? C.hi : b > 0.12 ? C.lit : b > -0.35 ? C.mid : b > -0.72 ? C.dark : C.bounce;
        ctx.globalAlpha = b > 0.12 ? 0.86 : 0.66; ctx.fillStyle = tone; ctx.fill(); ctx.globalAlpha = 1;
        // occlusion band low on every gore (hard cel step)
        ctx.save(); ctx.clip();
        // specular streak on lit gores
        if (b > 0.12) {
          const s0 = lerpP(rib(i, 0.08), rib(i + 1, 0.08), 0.62), s1 = lerpP(rib(i, 0.62), rib(i + 1, 0.62), 0.5);
          ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = b > 0.55 ? 3 : 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(s0.x + ox, s0.y + oy); ctx.lineTo(s1.x + ox, s1.y + oy); ctx.stroke();
        }
        ctx.restore();
      }
      if (broken) { // the cage shows where the glass fell away
        ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
        for (const u of [0.25, 0.75]) { const a = lerpP(rib(i, 0.6), rib(i + 1, 0.6), u), z = lerpP(rib(i, 1), rib(i + 1, 1), u); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(z.x, z.y); ctx.stroke(); }
      }
    }
    const atUV = (u, v) => { const i0 = U.clamp(Math.floor(u), 0, NR - 1); return lerpP(rib(i0, v), rib(i0 + 1, v), U.clamp(u - i0, 0, 1)); };
    const band = (v0, v1, sag) => {
      ctx.beginPath();
      for (let i = 0; i <= NR; i++) { const q = rib(i, v0); ctx.lineTo(q.x, q.y + Math.sin((i / NR) * PI) * sag); }
      for (let i = NR; i >= 0; i--) { const q = rib(i, v1); ctx.lineTo(q.x, q.y + Math.sin((i / NR) * PI) * sag * 1.4); }
      ctx.closePath(); ctx.fill();
    };
    if (!sh) {
      // glass reads by its reflections: a bright upper cap, a dark horizon band, occlusion near the floor
      ctx.save(); outline(); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.13)'; band(0, 0.27, 6);
      ctx.fillStyle = 'rgba(22,16,66,0.4)'; band(0.29, 0.36, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; band(0.36, 0.39, 8);
      ctx.fillStyle = 'rgba(30,8,48,0.3)'; band(0.76, 1.05, 10);
      ctx.restore();
    }
    // crinoline hoops seen through the glass
    if (!sh) {
      for (const v of [0.36, 0.62, 0.86]) {
        ctx.beginPath(); for (let i = 0; i <= NR; i++) { const q = rib(i, v); i ? ctx.lineTo(q.x, q.y + Math.sin((i / NR) * PI) * 7) : ctx.moveTo(q.x, q.y); }
        ctx.strokeStyle = 'rgba(28,8,40,0.4)'; ctx.lineWidth = 2.4; ctx.stroke();
        ctx.strokeStyle = U.rgba(C.edge, 0.22); ctx.lineWidth = 1; ctx.stroke();
      }
    }
    // gore seams
    ctx.lineCap = 'round';
    for (let i = 1; i < NR; i++) {
      ctx.beginPath(); VS.forEach((v, k) => { const q = rib(i, v); k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
      ctx.strokeStyle = sh ? U.rgba(SHD.rim, 0.25) : U.rgba(C.edge, 0.55); ctx.lineWidth = 1.1; ctx.stroke();
    }
    // ink contour
    outline(); ink(ctx, 2.4, sh ? U.rgba(SHD.rim, 0.85) : INK);
    // peplum: glass petals over the hips, each ending in a crystal pendant (the gown remembers the chandelier)
    const np = 7;
    for (let k = 0; k < np; k++) {
      const u = ((k + 0.5) / np) * NR, c = (k + 0.5) / np * 2 - 1, b = c * Ld;
      const top = atUV(u, 0), tipv = 0.3 + (k % 2) * 0.08 + Math.sin(t * 1.4 + k) * 0.008;
      const tip = atUV(u, tipv), l = atUV(u - 0.95, tipv * 0.5), r = atUV(u + 0.95, tipv * 0.5);
      ctx.beginPath(); ctx.moveTo(top.x - 3, top.y); ctx.quadraticCurveTo(l.x, l.y, tip.x, tip.y); ctx.quadraticCurveTo(r.x, r.y, top.x + 3, top.y); ctx.closePath();
      if (sh) { ctx.fillStyle = SHD.body; ctx.fill(); ink(ctx, 1.1, U.rgba(SHD.rim, 0.7)); }
      else {
        ctx.globalAlpha = 0.93; ctx.fillStyle = b > 0.4 ? C.hi : b > 0 ? C.lit : b > -0.5 ? C.mid : C.dark; ctx.fill(); ctx.globalAlpha = 1;
        ink(ctx, 1.3);
        const m = lerpP(top, tip, 0.5);
        ctx.strokeStyle = U.rgba(GOLD, 0.9); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(top.x, top.y + 2); ctx.quadraticCurveTo(m.x + (r.x - l.x) * 0.12, m.y, tip.x, tip.y - 3); ctx.stroke();
      }
      // pendant
      const sw = Math.sin(t * 2.4 + k * 1.3) * 2.5, bead = { x: tip.x + sw * 0.5, y: tip.y + 8 }, drop = { x: tip.x + sw, y: tip.y + 15 };
      ctx.strokeStyle = sh ? U.rgba(SHD.rim, 0.5) : 'rgba(30,14,40,0.8)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(drop.x, drop.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(bead.x, bead.y, 2.1, 0, TAU); ctx.fillStyle = sh ? SHD.body : '#f2fbff'; ctx.fill(); ink(ctx, 0.7, sh ? U.rgba(SHD.rim, 0.6) : INK);
      ctx.beginPath(); ctx.moveTo(drop.x, drop.y - 2); ctx.lineTo(drop.x + 3.4, drop.y + 4); ctx.lineTo(drop.x, drop.y + 11); ctx.lineTo(drop.x - 3.4, drop.y + 4); ctx.closePath();
      ctx.fillStyle = sh ? SHD.body : (k % 3 === 1 ? ROSE_HI : '#dff6ff'); ctx.fill(); ink(ctx, 0.8, sh ? U.rgba(SHD.rim, 0.6) : INK);
    }
    // hem fringe: individual glass shards
    const hemL = rib(0, 1), hemR = rib(NR, 1), n = 15;
    for (let j = 0; j < n; j++) {
      const u0 = j / n, u1 = (j + 1) / n, a = lerpP(hemL, hemR, u0), z = lerpP(hemL, hemR, u1);
      const tipY = 0 + ((j * 7) % 3) - (sh ? Math.abs(Math.sin(t * 3 + j)) * 8 : 0);
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 3); ctx.lineTo((a.x + z.x) / 2 + ((j % 2) ? 3 : -3), tipY); ctx.lineTo(z.x, z.y - 3); ctx.closePath();
      if (sh) { ctx.fillStyle = SHD.fill; ctx.fill(); ink(ctx, 1, U.rgba(SHD.rim, 0.6)); }
      else { ctx.fillStyle = (j % 2) ? C.lit : C.mid; ctx.fill(); ink(ctx, 1.1); }
    }
    if (sh) return gg;
    // P2 cracks across the glass
    if (p2 > 0 && o.cracks) {
      ctx.lineJoin = 'miter';
      for (const cr of o.cracks) {
        const nShow = Math.max(2, Math.ceil(cr.length * U.clamp(p2 * 1.4, 0, 1)));
        ctx.beginPath();
        for (let k = 0; k < nShow && k < cr.length; k++) {
          const [u, v] = cr[k], i0 = Math.floor(u), f = u - i0;
          const q = lerpP(rib(U.clamp(i0, 0, NR), v), rib(U.clamp(i0 + 1, 0, NR), v), f);
          k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
        }
        ctx.strokeStyle = 'rgba(20,6,30,0.7)'; ctx.lineWidth = 2.2; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,250,0.9)'; ctx.lineWidth = 0.9; ctx.stroke();
      }
    }
    // glints that twinkle on the beat
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) {
      const i = 1 + ((k * 3) % (NR - 1)), v = 0.15 + ((k * 0.37) % 0.7), q = rib(i, v);
      const tw = Math.max(0, Math.sin(t * 2.3 + k * 1.9)) * (0.5 + 0.5 * (o.pulse || 0));
      if (tw < 0.15) continue;
      const s = 3 + tw * 7;
      ctx.fillStyle = `rgba(255,255,255,${0.85 * tw})`;
      ctx.beginPath(); ctx.moveTo(q.x, q.y - s); ctx.lineTo(q.x + 1.2, q.y - 1.2); ctx.lineTo(q.x + s, q.y); ctx.lineTo(q.x + 1.2, q.y + 1.2); ctx.lineTo(q.x, q.y + s); ctx.lineTo(q.x - 1.2, q.y + 1.2); ctx.lineTo(q.x - s, q.y); ctx.lineTo(q.x - 1.2, q.y - 1.2); ctx.closePath(); ctx.fill();
    }
    // red build-up of the glass high-C
    if (o.red > 0) {
      outline(); ctx.fillStyle = U.rgba(CRIM, 0.45 * o.red); ctx.fill();
      ctx.strokeStyle = U.rgba('#ffb0c4', 0.8 * o.red); ctx.lineWidth = 1.4;
      for (let i = 1; i < NR; i += 2) { ctx.beginPath(); const a = rib(i, 0.1), m = rib(i + (i % 3 ? 0.4 : -0.4), 0.5), z = rib(i, 0.9); ctx.moveTo(a.x, a.y); ctx.lineTo(m.x, m.y); ctx.lineTo(z.x, z.y); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'source-over';
    // loose shards drifting around the hem (more of them once the gown has cracked)
    const nf = 3 + Math.round(p2 * 6);
    for (let k = 0; k < nf; k++) {
      const a = t * (0.5 + k * 0.07) + k * 2.1, ca = Math.cos(a), sa = Math.sin(a);
      if (sa < -0.35) continue;
      const x = ca * (gg.Rf + 24 + (k % 3) * 10) + gg.sk * 10, y = -26 - (k % 4) * 26 - Math.sin(t * 1.7 + k) * 8, s2 = 4 + (k % 3) * 2.2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * (1 + k * 0.2) + k);
      ctx.beginPath(); ctx.moveTo(0, -s2 * 1.6); ctx.lineTo(s2 * 0.7, 0); ctx.lineTo(0, s2); ctx.lineTo(-s2 * 0.7, 0); ctx.closePath();
      ctx.fillStyle = k % 2 ? C.lit : C.hi; ctx.fill(); ink(ctx, 1); ctx.restore();
    }
    return gg;
  }

  // the Medici collar: a fan of glass blades behind her head
  function drawCollar(ctx, J, p, o, C) {
    const anc = J.at(57, -7), sh = o.shadow, p2 = o.p2k || 0;
    const n = 9;
    for (let i = n - 1; i >= 0; i--) {
      const u = i / (n - 1), th = p.lean + U.lerp(0.4, -1.75, u);
      const brokenBlade = p2 > 0.5 && (i === 2 || i === 6);
      const L = (44 + 14 * Math.sin(u * PI)) * (brokenBlade ? 0.55 : 1), w = 5.5 + 2 * Math.sin(u * PI);
      const d = { x: Math.sin(th), y: -Math.cos(th) }, nx = -d.y, ny = d.x;
      const tip = { x: anc.x + d.x * L, y: anc.y + d.y * L }, m = { x: anc.x + d.x * L * 0.55, y: anc.y + d.y * L * 0.55 };
      ctx.beginPath(); ctx.moveTo(anc.x + nx * 2, anc.y + ny * 2); ctx.lineTo(m.x + nx * w, m.y + ny * w);
      if (brokenBlade) { ctx.lineTo(tip.x + nx * 3, tip.y + ny * 3); ctx.lineTo(tip.x - nx * 1, tip.y - ny * 1 - 4); ctx.lineTo(tip.x - nx * 4, tip.y - ny * 4); }
      else ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(m.x - nx * w, m.y - ny * w); ctx.lineTo(anc.x - nx * 2, anc.y - ny * 2); ctx.closePath();
      if (sh) { ctx.fillStyle = SHD.fill; ctx.fill(); ink(ctx, 1.1, U.rgba(SHD.rim, 0.7)); continue; }
      ctx.globalAlpha = 0.9; ctx.fillStyle = i % 2 ? C.mid : C.lit; ctx.fill(); ctx.globalAlpha = 1;
      ink(ctx, 1.3);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(anc.x + d.x * L * 0.2 + nx * 1.5, anc.y + d.y * L * 0.2 + ny * 1.5); ctx.lineTo(anc.x + d.x * L * 0.8 + nx * 1.5, anc.y + d.y * L * 0.8 + ny * 1.5); ctx.stroke();
    }
    // gold band at the base of the collar
    ctx.beginPath(); ctx.arc(anc.x, anc.y, 9, 0, TAU); ctx.fillStyle = sh ? SHD.body : GOLD; ctx.fill(); ink(ctx, 1.2, sh ? U.rgba(SHD.rim, 0.7) : INK);
  }

  function drawHairBack(ctx, o, ox, oy, facing, sh, p2) {
    const hair = o.hair, n = p2 > 0.3 || sh ? 3 : 2;
    for (let i = n - 1; i >= 0; i--) {
      const c = hair[i]; if (!c.inited) continue;
      let pts = toLocal(c.p, ox, oy, facing);
      if (i === 2 && !sh) { const k = U.clamp((p2 - 0.3) / 0.6, 0, 1); pts = pts.slice(0, Math.max(2, Math.round(pts.length * k))); if (pts.length < 3) continue; }
      Rig.ribbon(ctx, pts, 7 - i, 1.2, sh ? SHD.body : HAIR_D, 2);
      ink(ctx, 1.4, sh ? U.rgba(SHD.rim, 0.6) : INK);
      if (sh) continue;
      Rig.ribbon(ctx, pts.map((q) => ({ x: q.x + 1, y: q.y - 1.4 })), 4.6 - i, 0.6, HAIR, 1.4);
      Rig.ribbon(ctx, pts.map((q) => ({ x: q.x + 1.8, y: q.y - 2.2 })), 1.6, 0.2, HAIR_HI, 0.6);
    }
  }
  function drawVeil(ctx, o, ox, oy, facing, sh) {
    if (!o.veil.inited) return;
    const pts = toLocal(o.veil.p, ox, oy, facing);
    Rig.ribbon(ctx, pts, 2.5, 15, sh ? 'rgba(60,40,110,0.3)' : 'rgba(255,232,244,0.26)');
    ctx.strokeStyle = sh ? 'rgba(169,139,255,0.35)' : 'rgba(255,240,250,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  }
  function drawPearls(ctx, o, ox, oy, facing, sh) {
    for (const c of o.pearl) {
      if (!c.inited) continue;
      const pts = toLocal(c.p, ox, oy, facing);
      ctx.strokeStyle = sh ? U.rgba(SHD.rim, 0.5) : INK; ctx.lineWidth = 0.8; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
      pts.forEach((q, i) => {
        if (i === 0) return;
        const last = i === pts.length - 1, r = last ? 4 : 2.8;
        ctx.beginPath();
        if (last) { ctx.moveTo(q.x, q.y - 3); ctx.quadraticCurveTo(q.x + 4.5, q.y + 3, q.x, q.y + 7); ctx.quadraticCurveTo(q.x - 4.5, q.y + 3, q.x, q.y - 3); }
        else ctx.arc(q.x, q.y, r, 0, TAU);
        ctx.fillStyle = sh ? SHD.body : last ? ROSE : '#f4eee4'; ctx.fill(); ink(ctx, 0.8, sh ? U.rgba(SHD.rim, 0.6) : INK);
        if (!sh) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(q.x + 0.8, q.y - 1, 0.9, 0, TAU); ctx.fill(); }
      });
    }
  }

  function drawArm(ctx, S, E, Hd, fa, back, sh) {
    const skin = sh ? SHD.limb : back ? SKIN_B : SKIN, glove = sh ? SHD.body : back ? GLOVE_B : GLOVE;
    Rig.limbChain(ctx, [S, E, Hd], [6.4, 4.8, 3.8], skin);
    const g0 = lerpP(S, E, 0.55);
    Rig.limbChain(ctx, [g0, E, Hd], [5.4, 4.9, 3.9], glove, { spec: sh ? 0 : 0.35 });
    if (!sh) { ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6; const d = { x: E.x - S.x, y: E.y - S.y }, L = Math.hypot(d.x, d.y) || 1; ctx.beginPath(); ctx.moveTo(g0.x - d.y / L * 5.4, g0.y + d.x / L * 5.4); ctx.lineTo(g0.x + d.y / L * 5.4, g0.y - d.x / L * 5.4); ctx.stroke(); }
    Rig.limb(ctx, Hd, add(Hd, dirv(fa, 8)), 4, 3, glove, { noHatch: true });
  }

  function drawFan(ctx, J, p, o, C) {
    const piv = J.Hd, R = J.R, fa = J.fa, sh = o.shadow;
    const rimCol = sh ? U.rgba(SHD.rim, 0.85) : INK;
    if (p.open < 0.06) {
      // folded: a slim bundle of glass sticks that widens toward a scalloped head
      const tip = J.tip, nx = -Math.cos(fa), ny = Math.sin(fa), ax = Math.sin(fa), ay = Math.cos(fa), Lf = R;
      const at2 = (s, w) => ({ x: piv.x + ax * Lf * s + nx * w, y: piv.y + ay * Lf * s + ny * w });
      const pts = [at2(0, 3), at2(0.62, 4.2), at2(0.9, 7), at2(0.97, 6.5), at2(1.01, 3), at2(1.02, 0), at2(1.01, -3), at2(0.97, -6.5), at2(0.9, -7), at2(0.62, -4.2), at2(0, -3)];
      ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath();
      ctx.fillStyle = sh ? SHD.body : C.lit; ctx.fill(); ink(ctx, 1.5, rimCol);
      if (!sh) {
        ctx.strokeStyle = 'rgba(40,40,90,0.45)'; ctx.lineWidth = 0.8;
        for (const w of [-2.6, 0, 2.6]) { const a = at2(0.1, w * 0.6), z = at2(0.93, w * 1.9); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(z.x, z.y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.1; const a = at2(0.12, 1.4), z = at2(0.88, 4.5); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(z.x, z.y); ctx.stroke();
        ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6; const g0 = at2(0.9, -7), g1 = at2(0.9, 7); ctx.beginPath(); ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.stroke();
      }
    } else {
      const spread = p.open * 2.3, n = 9, a0 = fa - spread / 2;
      const P_ = (a, r) => ({ x: piv.x + Math.sin(a) * r, y: piv.y + Math.cos(a) * r });
      // pleated glass leaf
      for (let k = 0; k < n - 1; k++) {
        const aa = a0 + spread * k / (n - 1), ab = a0 + spread * (k + 1) / (n - 1);
        const q0 = P_(aa, R * 0.3), q1 = P_(aa, R), q2 = P_(ab, R), q3 = P_(ab, R * 0.3), mid = P_((aa + ab) / 2, R * 1.02);
        ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.quadraticCurveTo(mid.x, mid.y, q2.x, q2.y); ctx.lineTo(q3.x, q3.y); ctx.closePath();
        if (sh) ctx.fillStyle = k % 2 ? SHD.fill : SHD.body;
        else { ctx.globalAlpha = 0.88; ctx.fillStyle = k % 2 ? C.mid : C.lit; }
        ctx.fill(); ctx.globalAlpha = 1;
      }
      // outer contour
      ctx.beginPath(); const s0 = P_(a0, R * 0.3); ctx.moveTo(s0.x, s0.y);
      for (let k = 0; k <= 16; k++) { const q = P_(a0 + spread * k / 16, R); ctx.lineTo(q.x, q.y); }
      const s1 = P_(a0 + spread, R * 0.3); ctx.lineTo(s1.x, s1.y);
      for (let k = 16; k >= 0; k--) { const q = P_(a0 + spread * k / 16, R * 0.3); ctx.lineTo(q.x, q.y); }
      ctx.closePath(); ink(ctx, 1.8, rimCol);
      // ribs
      ctx.strokeStyle = sh ? U.rgba(SHD.rim, 0.4) : 'rgba(11,6,18,0.55)'; ctx.lineWidth = 1;
      for (let k = 0; k < n; k++) { const a = a0 + spread * k / (n - 1), q = P_(a, R * 0.98); ctx.beginPath(); ctx.moveTo(piv.x, piv.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      if (!sh) {
        // gold edge along the arc
        ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath();
        for (let k = 0; k <= 16; k++) { const q = P_(a0 + spread * k / 16, R - 3); k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
        ctx.stroke();
      }
    }
    // pivot guard with a rose gem
    ctx.beginPath(); ctx.arc(piv.x, piv.y, 5, 0, TAU); ctx.fillStyle = sh ? SHD.body : GOLD; ctx.fill(); ink(ctx, 1.1, rimCol);
    ctx.fillStyle = sh ? VIOLET : ROSE; ctx.beginPath(); ctx.arc(piv.x, piv.y, 2.2, 0, TAU); ctx.fill();
  }
  // the swing reads as a bright arc smear while a hit is live
  function drawTrail(ctx, o, J, red) {
    const tr = o.trail; if (!tr || tr.length < 2) return;
    let lo = Infinity, hi = -Infinity; for (const a of tr) { lo = Math.min(lo, a); hi = Math.max(hi, a); }
    const spread = (o.open || 1) * 2.3 / 2;
    lo -= spread * 0.6; hi += spread * 0.6;
    if (hi - lo < 0.15) return;
    const piv = J.Hd, R = J.R * 1.08;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = red ? 'rgba(255,80,110,0.42)' : o.shadow ? 'rgba(200,180,255,0.4)' : 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    for (let k = 0; k <= 14; k++) { const a = lo + (hi - lo) * k / 14; const x = piv.x + Math.sin(a) * R, y = piv.y + Math.cos(a) * R; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    for (let k = 14; k >= 0; k--) { const a = lo + (hi - lo) * k / 14; ctx.lineTo(piv.x + Math.sin(a) * R * 0.45, piv.y + Math.cos(a) * R * 0.45); }
    ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawTorso(ctx, J, p, o, C) {
    const Q = J.at, sh = o.shadow;
    const nx = J.cl, ny = J.sl, side = Rig.lightDir(ctx).x * nx >= 0 ? 1 : -1;
    // bare shoulders + chest above the neckline
    smoothPath(ctx, [Q(40, -12), Q(53, -12), Q(61, -4), Q(62, 4), Q(55, 10), Q(47, 9), Q(44, 0)]);
    ctx.fillStyle = sh ? SHD.limb : Rig.celGrad(ctx, Q(52, 0).x, Q(52, 0).y, nx, ny, 12, side, Rig.ramp(SKIN)); ctx.fill(); ink(ctx, 1.3, sh ? U.rgba(SHD.rim, 0.7) : INK);
    // neck + choker
    const nb = { x: J.H.x - Math.sin(J.ha) * 13, y: J.H.y + Math.cos(J.ha) * 13 };
    Rig.limb(ctx, Q(57, 1), nb, 6, 4.6, sh ? SHD.limb : SKIN, { noHatch: true });
    const ch = lerpP(Q(57, 1), nb, 0.5);
    ctx.fillStyle = sh ? SHD.body : VELVET; ctx.beginPath(); ctx.ellipse(ch.x, ch.y, 5.5, 2.4, p.lean + p.head * 0.5, 0, TAU); ctx.fill(); ink(ctx, 0.9, sh ? U.rgba(SHD.rim, 0.6) : INK);
    // velvet bodice with a pointed basque
    const bod = [Q(-3, -14), Q(14, -11.5), Q(30, -12.5), Q(43, -12), Q(47, -7), Q(45, -1), Q(48, 7), Q(44, 15), Q(36, 17), Q(29, 12), Q(15, 11), Q(1, 13.5), Q(-11, 5), Q(-7, -5)];
    smoothPath(ctx, bod);
    ctx.fillStyle = sh ? SHD.body : Rig.celGrad(ctx, Q(22, 0).x, Q(22, 0).y, nx, ny, 16, side, Rig.ramp(VELVET)); ctx.fill(); ink(ctx, 1.6, sh ? U.rgba(SHD.rim, 0.85) : INK);
    if (!sh) {
      // gold boning + lace neckline
      ctx.strokeStyle = U.rgba(GOLD, 0.85); ctx.lineWidth = 1.1; ctx.lineCap = 'round';
      for (const f of [-6, 2, 9]) { const a = Q(2, f), b = Q(38 - Math.abs(f) * 0.6, f); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
      ctx.beginPath(); [Q(43, -12), Q(47, -7), Q(45, -1), Q(48, 7), Q(44, 15)].forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
      ctx.fillStyle = GOLD_HI; for (const s of [0.2, 0.5, 0.8]) { const q = lerpP(Q(45, -1), Q(48, 7), s); ctx.beginPath(); ctx.arc(q.x, q.y, 1.1, 0, TAU); ctx.fill(); }
    }
    // the Hush heart: a rose crystal over the sternum
    const hc = Q(31, 13), pulse = o.pulse || 0, glowK = (o.heart ?? 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, hc.x, hc.y, (26 + pulse * 14) * (0.6 + 0.4 * glowK), sh ? VIOLET : C.heart, (0.55 + pulse * 0.3) * glowK);
    ctx.restore();
    ctx.save(); ctx.translate(hc.x, hc.y); ctx.rotate(p.lean);
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(4.6, -1); ctx.lineTo(0, 7); ctx.lineTo(-4.2, -1); ctx.closePath();
    ctx.fillStyle = sh ? VIOLET : U.mixHex(C.heart, '#ffffff', 0.25 + 0.5 * pulse * glowK); ctx.fill(); ink(ctx, 1.1);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(2, -1.5); ctx.lineTo(0, -2.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawHead(ctx, J, p, o, C) {
    const sh = o.shadow, sing = p.sing, eye = U.clamp(p.eye, 0, 1), p2 = o.p2k || 0;
    ctx.save(); ctx.translate(J.H.x, J.H.y); ctx.rotate(J.ha); ctx.scale(HS, HS);
    const rim = sh ? U.rgba(SHD.rim, 0.85) : INK;
    // the updo: bun behind and above, a glass tuning-fork pin
    ctx.beginPath(); ctx.ellipse(-7, -8.5, 8.6, 8, -0.3, 0, TAU); ctx.fillStyle = sh ? SHD.body : HAIR_D; ctx.fill(); ink(ctx, 0.7, rim);
    ctx.beginPath(); ctx.ellipse(-3.5, -14.5, 6.6, 5.6, 0.2, 0, TAU); ctx.fillStyle = sh ? SHD.body : HAIR; ctx.fill(); ink(ctx, 0.7, rim);
    if (!sh) {
      ctx.strokeStyle = HAIR_HI; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-7, -8.5, 5.6, -2.4, -0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(-3.5, -14.5, 3.8, -2.6, -1.0); ctx.stroke();
      // pin: two glass prongs + rose bead
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-5, -12); ctx.lineTo(-12, -24); ctx.moveTo(-3.6, -12.8); ctx.lineTo(-9.4, -25.4); ctx.stroke();
      ctx.strokeStyle = C.lit; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = ROSE; ctx.beginPath(); ctx.arc(-4.3, -12.3, 1.5, 0, TAU); ctx.fill(); ink(ctx, 0.4);
      // gold tiara band
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(-1.5, -8.4, 9.5, 3.2, -0.25, PI * 1.05, PI * 1.95); ctx.stroke();
    }
    // face (profile, facing +x)
    const o2 = sing * 2.6;
    const face = () => {
      ctx.beginPath(); ctx.moveTo(-1, -9.6);
      ctx.bezierCurveTo(4.2, -10, 7.4, -7.4, 7.9, -3.8);
      ctx.lineTo(8.1, -2.4); ctx.lineTo(10.4, 1.4); ctx.lineTo(8.8, 2.1);
      ctx.lineTo(9.1, 3.0); ctx.lineTo(8.3, 3.6);
      ctx.lineTo(8.9 - o2 * 0.15, 4.4 + o2); ctx.lineTo(8.2, 5.2 + o2);
      ctx.lineTo(8.5, 6.8 + o2 * 0.8); ctx.lineTo(6.6, 8.6 + o2 * 0.5); ctx.lineTo(1, 8.2);
      ctx.lineTo(-1.5, 4.4); ctx.lineTo(-1.6, -6); ctx.closePath();
    };
    face(); ctx.fillStyle = sh ? SHD.limb : SKIN; ctx.fill();
    if (!sh) {
      ctx.save(); face(); ctx.clip();
      ctx.fillStyle = '#b9a0c6'; ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(3.2, -4); ctx.quadraticCurveTo(4.4, 1.6, 3, 5.6); ctx.lineTo(7.4, 6.6 + o2); ctx.lineTo(7, 10 + o2); ctx.lineTo(-2, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,170,200,0.35)'; ctx.beginPath(); ctx.ellipse(5.2, 2.6, 2, 1.2, 0, 0, TAU); ctx.fill(); // blush
      ctx.restore();
    }
    face(); ink(ctx, 0.75, rim);
    // mouth: crimson lips, open while she sings (with the aria's glow inside)
    if (sing > 0.15) {
      ctx.fillStyle = '#2a0614'; ctx.beginPath(); ctx.ellipse(8.4, 3.9 + o2 * 0.5, 0.9, 0.5 + o2 * 0.45, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, 9.4, 4 + o2 * 0.5, 4 + sing * 5, sh ? VIOLET : ROSE, 0.6 * sing); ctx.restore();
    }
    if (!sh) {
      ctx.fillStyle = '#b0123e';
      ctx.beginPath(); ctx.moveTo(9.0, 2.95); ctx.lineTo(8.3, 3.55); ctx.lineTo(8.0, 3.25); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8.9 - o2 * 0.15, 4.35 + o2); ctx.lineTo(8.1, 4.4 + o2 * 0.7); ctx.lineTo(8.25, 5.15 + o2); ctx.closePath(); ctx.fill();
      // beauty mark
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(6.6, 4.9 + o2 * 0.4, 0.32, 0, TAU); ctx.fill();
    }
    // eye: serene closed lashes, or open and glowing when she means it
    if (eye > 0.5 || sh) {
      ctx.fillStyle = sh ? '#ffffff' : '#fbeef4'; ctx.beginPath(); ctx.moveTo(5.0, -1.3); ctx.quadraticCurveTo(6.3, -2.2, 7.6, -1.4); ctx.lineTo(6.8, -0.5); ctx.lineTo(5.5, -0.7); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, 6.8, -1.2, 4, sh ? '#ffffff' : ROSE, 0.8); ctx.restore();
      if (!sh) { ctx.fillStyle = '#ff4f95'; ctx.beginPath(); ctx.ellipse(6.85, -1.2, 0.6, 0.7, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(4.6, -1.1); ctx.quadraticCurveTo(6.2, -2.6, 7.8, -1.6); ctx.lineTo(9.0, -2.4); ctx.lineTo(7.7, -1.05); ctx.quadraticCurveTo(6.3, -1.9, 4.9, -0.8); ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle = INK; ctx.lineWidth = 0.75; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(4.8, -1.4); ctx.quadraticCurveTo(6.3, -0.4, 7.8, -1.3); ctx.stroke();
      ctx.lineWidth = 0.45; for (let k = 0; k < 4; k++) { const x = 5.4 + k * 0.7; ctx.beginPath(); ctx.moveTo(x, -0.85 + Math.abs(k - 1.5) * 0.12); ctx.lineTo(x - 0.3, 0.2); ctx.stroke(); }
    }
    if (!sh) { ctx.fillStyle = HAIR_D; ctx.beginPath(); ctx.moveTo(4.2, -3.6); ctx.quadraticCurveTo(6.2, -4.6, 8, -3.9); ctx.lineTo(8, -3.4); ctx.quadraticCurveTo(6.2, -4.0, 4.4, -3.1); ctx.closePath(); ctx.fill(); }
    // glass tear-crack down the cheek (phase 2)
    if (p2 > 0.2 && !sh) {
      ctx.strokeStyle = 'rgba(255,240,250,0.95)'; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(6.4, -0.4); ctx.lineTo(5.6, 2.2); ctx.lineTo(6.2, 3.4); ctx.lineTo(5.4, 6.4); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(ROSE, 0.6); ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
    }
    // hair cap over the skull + swept front lock
    const cap = () => { ctx.beginPath(); ctx.moveTo(-1.6, 3); ctx.bezierCurveTo(-4, -2, -2.5, -10.5, 2.6, -10.8); ctx.bezierCurveTo(6.8, -11, 9.4, -8, 8.8, -4.6); ctx.quadraticCurveTo(5, -7.6, 2.2, -5.6); ctx.quadraticCurveTo(0.6, -2, 0.4, 3.4); ctx.closePath(); };
    cap(); ctx.fillStyle = sh ? SHD.body : HAIR; ctx.fill();
    if (!sh) { ctx.save(); cap(); ctx.clip(); ctx.fillStyle = HAIR_HI; ctx.beginPath(); ctx.moveTo(-1, -9); ctx.quadraticCurveTo(3, -11.4, 7.6, -8.4); ctx.lineTo(6, -7.4); ctx.quadraticCurveTo(3, -9.2, 0, -7.6); ctx.closePath(); ctx.fill(); ctx.restore(); }
    cap(); ink(ctx, 0.7, rim);
    // loose lock over the ear in phase 2
    if (p2 > 0.3) { ctx.beginPath(); ctx.moveTo(0.8, -4); ctx.quadraticCurveTo(3.6, 2, 1.4, 9.5); ctx.quadraticCurveTo(0.2, 4, -0.6, -2); ctx.closePath(); ctx.fillStyle = sh ? SHD.body : HAIR; ctx.fill(); ink(ctx, 0.5, rim); }
    ctx.restore();
  }

  // full figure, local coords (+x = facing, hem on y = 0)
  function drawDiva(ctx, o, J, opt) {
    const p = o.pz, sh = !!opt.shadow, C = glassPal(opt.p2k || 0);
    const ox = opt.ox ?? o.x, oy = opt.oy ?? o.y, facing = opt.facing ?? o.facing;
    if (sh) Rig.hatch = false;
    try {
      drawVeil(ctx, o, ox, oy, facing, sh);
      drawHairBack(ctx, o, ox, oy, facing, sh, opt.p2k || 0);
      drawArm(ctx, J.SB, J.EB, J.HB, p.aB + p.eB, true, sh);
      drawGown(ctx, J, p, opt, C);
      drawCollar(ctx, J, p, opt, C);
      drawTorso(ctx, J, p, opt, C);
      drawPearls(ctx, o, ox, oy, facing, sh);
      drawHead(ctx, J, p, opt, C);
      if (opt.trail) drawTrail(ctx, { trail: o.trail, open: p.open, shadow: sh }, J, opt.tellCol === 'red' || opt.redTrail);
      drawArm(ctx, J.S, J.E, J.Hd, J.fa, false, sh);
      drawFan(ctx, J, p, opt, C);
      if (opt.tellT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, J.tip.x, J.tip.y, 40, opt.tellCol === 'red' ? CRIM : '#ffffff', Math.min(1, opt.tellT * 1.6)); ctx.restore(); }
    } finally { Rig.hatch = true; }
  }

  /* ------------------------------------------------------------------ the type */
  const T = TYPES.c4_boss = {
    name: '最後的詠嘆・露塞特', en: 'LUCETTE, THE LAST ARIA',
    w: 120, h: 280, hp: 2100, bal: 320, col: '#ff8cc0', boss: true, shards: 700, spawnT: 2.6, poise: true,
    defeatDialog: 'c4_bossDefeat', phase2Bark: 'c4_bossP2', phase2Music: 'c4_boss2',
    portrait: [1.5, 0.95],
    init(e) {
      e.facing = -1; e.hugT = 0; e.lastMoves = []; e.queued = null; e.trail = [];
      e.pz = full(PS.RISE);
      e.hair = [new Rig.Chain(9, 11, 0.06, 0.9), new Rig.Chain(8, 10, 0.06, 0.9), new Rig.Chain(12, 11, 0.05, 0.9)];
      e.veil = new Rig.Chain(10, 15, 0.035, 0.92);
      e.pearl = [new Rig.Chain(6, 9, 0.12, 0.85), new Rig.Chain(5, 9, 0.12, 0.85)];
      setTempo(e);
      // phase-2 cracks, in (gore, height) space so they bend with the gown
      const rng = U.mulberry32(4417);
      e.cracks = Array.from({ length: 7 }, (_, i) => {
        let u = 1 + rng() * (NR - 2), v = 0.04 + rng() * 0.2; const pts = [[u, v]];
        for (let k = 0; k < 6; k++) { u = U.clamp(u + (rng() - 0.5) * 1.3, 0.2, NR - 0.2); v = Math.min(0.98, v + 0.06 + rng() * 0.12); pts.push([u, v]); }
        return pts;
      });
      if (e.enc && G.game && G.game.hazards) introFx(e);
    },
    voice: (e) => G.SFX.play('c4_bossVoice', e.phase),
    weapon: (e) => (e.Jw ? { x: e.Jw.x, y: e.Jw.y } : { x: e.x + e.facing * 120, y: e.y - 230 }),
    think(e, dt) {
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) { G.game.bossPhase2(e); return; }
      syncBeat(e);
      e.faceP();
      const d = e.distP();
      e.hugT = d < 210 ? e.hugT + dt : Math.max(0, e.hugT - dt * 0.5);
      if (!e.queued && e.cd <= 0) { e.queued = pickMove(e, d); e.qBeat = Math.floor(beatPos(e)) + 1; e.qWait = 0; }
      const melee = e.queued && MELEE[e.queued];
      const want = melee ? 165 : 280;
      let tv = 0;
      if (d > want + 30) tv = e.facing * (melee ? 240 : 130);
      else if (d < want - 70) tv = -e.facing * 110;
      e.vx = U.approach(e.vx, tv * e.speedMul, 700 * dt);
      if (e.queued && beatPos(e) >= e.qBeat) {
        if (!melee || d < 260) {
          const name = e.queued; e.queued = null; e.lastMoves.push(name); if (e.lastMoves.length > 6) e.lastMoves.shift();
          e.startAtk(build(e, name));
        } else { e.qBeat = Math.floor(beatPos(e)) + 1; if (++e.qWait > 5) e.queued = null; }
      }
    },
    atkUpdate(e, dt) {
      syncBeat(e);
      const a = e.atk; if (!a) return;
      if (a.glide) {
        if (e.st >= a.glide[0] && e.st <= a.glide[1]) {
          if (e.bowV == null) e.bowV = U.clamp((e.distP() + 60) / (a.glide[1] - a.glide[0]), 500, 1400);
          e.vx = e.facing * e.bowV;
          if (Math.random() < 0.5) G.FX.dust(e.x - e.facing * 60, e.y, 2, { w: 80, speed: 120, size: 12, col: 'rgba(230,210,220,' });
        } else { if (e.st < a.glide[0]) e.bowV = null; e.vx = U.approach(e.vx, 0, 2400 * dt); }
      } else if (a.track === false) e.vx = U.approach(e.vx, 0, 1600 * dt);
      if (a.id === 'shatter' && e.st > a.tells[0].t && e.st < (a.hits[0].t0) && Math.random() < 0.35) G.FX.ember(e.x, e.y - 90, 1, CRIM, { w: 160, h: 140, up: 90 });
    },
    onHit(e) { e.hugT += 0.15; },
    onPhase2(e, game) {
      setTempo(e); e.queued = null; e.p2At = e.t; e.lastMoves.push('p2');
      G.FX.shards(e.x, e.y - 120, 40, '#e6f7ff', 760); G.FX.shards(e.x, e.y - 160, 18, '#ff8cc0', 520);
      G.FX.ring(e.x, e.y - 150, 20, 420, 0.8, '#ffd1e6', 6);
      G.SFX.play('c4_glass', 14, 1.4); G.SFX.play('c4_aria', 88, 1.6, 0.08);
      const sh = makeShadow(e); sh.x = e.x; sh.facing = e.facing; game.hazards.push(sh); e.shadow = sh;
    },
    draw(ctx, e, ghost) {
      const dt = ghost ? 0 : G.game.dtVis;
      const p2k = e.phase === 2 ? U.clamp((e.t - (e.p2At ?? e.t)) / 1.2, 0, 1) : 0;
      const bp = e.B ? beatPos(e) : 0, pulse = Math.exp(-((bp % 1 + 1) % 1) * 5);
      // ---- pose
      let target, attackPose = false;
      if (e.state === 'atk' && e.atk && e.atk.poses) {
        target = sample(e.atk.poses, e.st); attackPose = true;
        if (e.pzStart && e.st < 0.12) target = lerpPose(full(e.pzStart), target, e.st / 0.12);
      } else if (e.state === 'broken') target = PS.broken(e.t);
      else if (e.state === 'spawn') {
        const k = U.clamp(e.st / (T.spawnT || 2.6), 0, 1);
        target = k < 0.6 ? full(PS.RISE) : lerpPose(full(PS.RISE), full(PS.REVEAL), U.easeOutCubic(U.clamp((k - 0.6) / 0.25, 0, 1)));
        attackPose = true;
      } else if (e.state === 'hurt' || e.state === 'recoil') target = lerpPose(PS.idle(e.t, bp), full(PS.HURT), Math.sin(Math.min(1, e.st / 0.45) * PI));
      else if (e.state === 'die') target = full(PS.EXH);
      else target = PS.idle(e.t, bp);
      const hk = e.hitK;
      if (hk > 0) target = lerpPose(target, full(Object.assign({}, target, { lean: target.lean - 0.3, head: target.head - 0.35, x: -8, sing: 0.5 })), Math.min(1, hk * 1.2));
      if (!e.pz) e.pz = target;
      if (attackPose && hk <= 0) e.pz = target;
      else if (dt > 0) e.pz = lerpPose(full(e.pz), target, 1 - Math.exp(-(hk > 0 ? 40 : 12) * dt));
      // glide lag on the hem
      if (dt > 0) e.pz.skirt = U.clamp(e.pz.skirt - e.vx * 0.0012, -1, 1);
      const J = joints(e.pz);
      // spawn: she rises through the stage trap
      const rise = e.state === 'spawn' ? U.clamp(e.st / ((T.spawnT || 2.6) * 0.62), 0, 1) : 1;
      const sink = (1 - U.easeOutCubic(rise)) * 320;
      e.Jw = { x: e.x + e.facing * J.tip.x, y: e.y + sink + J.tip.y };
      // fan trail history
      if (dt > 0) { e.trail.push(J.fa); if (e.trail.length > 4) e.trail.shift(); }
      const live = e.state === 'atk' && e.atk && (e.atk.hits || []).some((h) => h.box !== BOX.burst && e.st >= h.t0 - 0.06 && e.st <= h.t1 + 0.04);
      updateChains(e, J, e.x, e.y + sink, e.facing, dt, p2k > 0.3);
      // death: glass shatters outward (spawn the shards once, never in the flash pass)
      const dying = e.state === 'die' ? U.clamp(e.st / 0.5, 0, 1) : 0;
      if (dying > 0 && !ghost && !e.dieFx) { e.dieFx = true; G.FX.shards(e.x, e.y - 120, 40, '#e6f7ff', 900); G.SFX.play('c4_glass', 16, 1.6); }
      // shatter wind-up glow
      let red = 0;
      if (e.state === 'atk' && e.atk && e.atk.id === 'shatter') { const a = e.atk; red = U.clamp((e.st - a.tells[0].t) / (a.hits[0].t0 - a.tells[0].t), 0, 1) * (e.st < a.hits[0].t1 + 0.1 ? 1 : 0); }
      // beat ring on the stage at her hem (the rhythm you can read)
      if (!ghost && e.state !== 'die') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const down = (Math.floor(bp) % 4 + 4) % 4 === 0, rr = 150 + (1 - pulse) * 60;
        ctx.strokeStyle = U.rgba(e.phase === 2 ? '#ff7ab6' : '#ffd1e6', (down ? 0.42 : 0.22) * pulse); ctx.lineWidth = down ? 3 : 2;
        ctx.beginPath(); ctx.ellipse(e.x, e.y, rr, rr * 0.13, 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(e.x, e.y + sink);
      if (sink > 0.5) { ctx.beginPath(); ctx.rect(-600, -1200 - sink, 1200, 1200); ctx.clip(); }   // clip at the stage floor while rising
      ctx.scale(e.facing, 1);
      if (dying > 0) ctx.globalAlpha = 1 - dying;
      drawDiva(ctx, e, J, {
        t: e.t, p2k, pulse, cracks: e.cracks, burst: dying, red, ox: e.x, oy: e.y + sink, facing: e.facing,
        heart: e.state === 'broken' ? 0.35 + 0.25 * Math.sin(e.t * 9) : 1,
        tellT: e.tellT, tellCol: e.tellCol, trail: live, redTrail: e.atk && e.atk.hits && e.atk.hits.some((h) => h.red && e.st >= h.t0 - 0.06 && e.st <= h.t1 + 0.04),
      });
      ctx.restore();
    },
  };

  function pickMove(e, d) {
    const p2 = e.phase === 2, last = e.lastMoves[e.lastMoves.length - 1], prev = e.lastMoves[e.lastMoves.length - 2];
    if (!e.lastMoves.length) return 'aria';           // she always opens with her aria
    if (last === 'p2') return 'duet';                  // …and the second act with the duet
    const near = d < 280, sh = e.shadow && !e.shadow.done;
    const sinceFinale = e.lastMoves.length - 1 - e.lastMoves.lastIndexOf('finale');
    const pool = [
      ['fan', near ? 4 : 0.6], ['aria', 1.5], ['spot', 1.3], ['chand', d > 250 ? 1.6 : 0.8],
      ['shatter', d < 230 ? (e.hugT > 1.6 ? 4 : 0.6) : 0], ['bow', d > 380 ? 2.6 : 0],
    ];
    if (p2 && sh) pool.push(['duet', 2.8], ['finale', sinceFinale > 3 || e.lastMoves.lastIndexOf('finale') < 0 ? 1.5 : 0]);
    let tot = 0;
    for (const q of pool) { if (q[0] === last) q[1] *= 0.2; else if (q[0] === prev) q[1] *= 0.6; tot += q[1]; }
    let r = Math.random() * tot;
    for (const q of pool) if ((r -= q[1]) <= 0) return q[0];
    return 'aria';
  }

  // static copies for the test gallery / pose freezer (built at a 0.5 s beat)
  for (const n of Object.keys(MAKE)) T[n] = build({ B: 0.5, phase: n === 'duet' || n === 'finale' ? 2 : 1 }, n);

  /* ------------------------------------------------------------------ sound */
  const S = G.SFX;
  S.c4_glass = (t, n = 7, vol = 1) => {
    const A = G.AudioKit;
    for (let i = 0; i < n; i++) A.bell(2100 + Math.random() * 3400, t + i * 0.016 + Math.random() * 0.02, 0.045 * vol, 0.5 + Math.random() * 0.7, 0.4, 1.2);
    A.noise(t, 0.002, 0.28 * vol, 0.24, 'highpass', 3600, 6500, 0.7, 0.3);
    A.tone('sine', 150, t, 0.004, 0.22 * vol, 0.25, { to: 60, wet: 0.2 });
  };
  // a soprano line: two detuned voices, a breathy onset, slight vibrato via a second sine
  S.c4_aria = (t, midi = 81, dur = 1.2, vel = 0.06) => {
    const A = G.AudioKit, f = A.mtof(midi);
    A.choirVoice(f, t, dur, vel, A.sfxBus);
    A.tone('sine', f, t, 0.08, vel * 0.9, dur, { wet: 0.6 });
    A.tone('sine', f * 1.006, t + 0.04, 0.12, vel * 0.5, dur * 0.9, { wet: 0.7 });
    A.noise(t, 0.04, vel * 0.8, 0.25, 'bandpass', 2600, 1800, 2, 0.3);
  };
  S.c4_inhale = (t) => { G.AudioKit.noise(t, 0.18, 0.09, 0.22, 'bandpass', 900, 2400, 1.5, 0.2); };
  S.c4_wall = (t, alt = 0) => {
    const A = G.AudioKit, m = alt ? 81 : 88;
    A.bell(A.mtof(m), t, 0.06, 1.2, 0.6, 0.6);
    A.choirVoice(A.mtof(m - 12), t, 0.55, 0.05, A.sfxBus);
    A.noise(t, 0.02, 0.12, 0.3, 'bandpass', 2400, 900, 2, 0.4);
  };
  S.c4_fan = (t) => {
    const A = G.AudioKit;
    for (let i = 0; i < 6; i++) A.bell(2900 + i * 330, t + i * 0.022, 0.022, 0.25, 0.3, 1);
    A.noise(t, 0.01, 0.2, 0.18, 'bandpass', 1800, 700, 0.8, 0.15);
  };
  S.c4_spot = (t, lock = 0) => {
    const A = G.AudioKit;
    A.tone('square', lock ? 90 : 62, t, 0.003, 0.1, 0.12, { filter: 'lowpass', ff: 320 });
    A.noise(t, 0.002, 0.22, 0.09, 'lowpass', 900, 200, 0.7, 0.2);
    A.tone('sawtooth', lock ? 180 : 120, t + 0.04, 0.05, 0.018, 0.5, { filter: 'bandpass', ff: 1200, q: 4, wet: 0.3 });
  };
  S.c4_burn = (t) => {
    const A = G.AudioKit;
    A.noise(t, 0.01, 0.32, 0.35, 'bandpass', 700, 3600, 1.2, 0.25);
    A.tone('sawtooth', 220, t, 0.005, 0.07, 0.3, { to: 880, filter: 'lowpass', ff: 2400 });
  };
  S.c4_creak = (t) => {
    const A = G.AudioKit;
    A.tone('sawtooth', 72, t, 0.12, 0.05, 0.7, { to: 54, filter: 'bandpass', ff: 600, q: 6, wet: 0.4 });
    for (let i = 0; i < 4; i++) A.bell(3200 + Math.random() * 1600, t + 0.1 + i * 0.09, 0.015, 0.6, 0.5, 1);
  };
  S.c4_crash = (t) => {
    const A = G.AudioKit;
    A.noise(t, 0.003, 0.6, 0.6, 'lowpass', 3000, 200, 0.6, 0.35);
    A.tone('sine', 56, t, 0.005, 0.55, 0.6, { to: 28 });
    S.c4_glass(t + 0.02, 10, 1.2);
  };
  S.c4_bossVoice = (t, ph = 1) => {
    const A = G.AudioKit;
    A.noise(t, 0.06, 0.05, 0.12, 'bandpass', 1300, 2200, 2, 0.3);
    if (ph === 2) A.tone('sine', A.mtof(69), t + 0.04, 0.06, 0.02, 0.4, { wet: 0.7 });
  };

  /* ------------------------------------------------------------------ data: bark, speaker, codex */
  const D = G.DATA;
  D.speakers.c4_lucette = D.speakers.c4_lucette || { name: '露塞特', en: 'LUCETTE', color: '#ffb3d6' };
  D.barks.c4_bossP2 = { who: 'c4_lucette', text: '安可？好啊——下一段，是二重唱。' };
  if (!D.codex.hushborn.some((c) => c.id === 'c4_boss')) {
    D.codex.hushborn.push({
      id: 'c4_boss', name: '最後的詠嘆・露塞特', en: 'LUCETTE, THE LAST ARIA', portrait: 'c4_boss', unlock: 'seen_c4_boss',
      tag: '失聲者｜第四降下隊隊長',
      body: [
        '第四降下隊的隊長，入伍前是萊拉大歌劇院的首席女高音。歌劇院沉入黑湖的那一夜，她仍站在台上唱最後一段詠嘆——寂靜把她的聲音、連同那件禮服，一起封進了玻璃裡。',
        '她的每一個動作都踩在樂曲的拍點上。扇舞三連（白光，可格擋，第三擊會晚半拍）／詠嘆之牆（白光，完美格擋可震碎並削減她的平衡）／聚光燈（站到光圈外）／墜落吊燈、玻璃高音（紅光，必須閃避）。',
        '第二幕：她的影子會從玻璃裡走出來，站到你的背後唱第二聲部。影子的扇擊也能格擋——但你得先轉身。最後那一下兩人同時揮落，只能閃。',
        '弱點：每一段樂句結束後的換氣。跟著節拍呼吸，就能找到她的空檔。',
      ],
    });
  }
})(window.G);

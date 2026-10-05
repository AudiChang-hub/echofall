'use strict';
/* ECHOFALL — 武器招式 (weapon forms): what you hold decides how you fight.
   Every weapon family has its own four-step combo — its own keyframes, reach, rhythm, hit windows and finisher:
     直刀 katana   balanced cuts; finisher: the spinning cleave
     雙刃 twin     the same cuts, but every blow lands twice
     長刀 odachi   long cuts; finisher: an iai draw that dashes through the foe and cuts behind you
     大劍/巨斧/戰鎚 overhead chop → wide sweep → rising launcher → leaping slam (axe chops crit, the hammer shakes the ground)
     長槍 spear    thrusts high, level and low; finisher: a twirl that strikes in front and behind
     細劍 rapier   quick thrusts; finisher: a three-thrust flurry
     鐮刀 scythe   reaps that pull back across the body (hits behind too); finisher: a death spiral that drags foes in
     巫扇 fan      the fan barely touches: every stroke sends spirit wind
   The class is laid on top (js/dnd.js): the fighter's embers and slam, the rogue's shadow cuts, the paladin's
   shield bash and pillar of light, the shaman's spirit wind on the finisher — whatever the weapon. */
(function (G) {
  const U = G.U, Rig = G.Rig, A = Rig.ANIM, TAU = Math.PI * 2;
  const stance = { tF: 0.55, kF: -0.55, tB: -0.5, kB: -0.2 };
  const gnd = Rig.groundify;
  const plant = (anim, skip = []) => { anim.keys.forEach((k, i) => { if (!skip.includes(i)) k[1] = gnd(k[1]); }); return anim; };
  const H = (p) => Object.assign({}, p, { hold: 1 });

  /* ---------------------------------------------------------------- keyframes */
  // heavy two-handers: overhead chop, wide sweep, rising launcher, leaping slam
  const HEAVY = [
    plant({ dur: 0.6, active: [0.24, 0.34], keys: [
      [0, H({ ...stance, ry: 5, torso: -0.1, aF: 2.9, eF: 0.5, aB: 2.4, eB: 0.6, sw: 3.4 })],
      [0.21, H({ ...stance, ry: 3, torso: -0.28, head: 0.12, aF: 3.25, eF: 0.35, sw: 3.95 }), 'io'],
      [0.31, H({ tF: 1.0, kF: -1.1, tB: -0.7, kB: -0.25, ry: 17, torso: 0.8, head: -0.2, aF: 1.05, eF: 0.0, sw: 0.3 }), 'snap'],
      [0.6, H({ tF: 0.9, kF: -1.0, tB: -0.65, kB: -0.25, ry: 14, torso: 0.62, aF: 0.95, eF: 0.15, sw: 0.25 }), 'out']] }),
    plant({ dur: 0.56, active: [0.17, 0.28], keys: [
      [0, H({ tF: 0.9, kF: -1.0, tB: -0.65, kB: -0.25, ry: 13, torso: 0.6, aF: 0.95, eF: 0.15, sw: 0.25 })],
      [0.15, H({ ...stance, rx: -8, ry: 9, torso: 0.15, aF: -0.55, eF: 0.45, sw: -1.45 }), 'io'],
      [0.26, H({ ...stance, rx: 12, ry: 9, torso: 0.4, aF: 1.65, eF: 0.0, sw: 1.75 }), 'snap'],
      [0.56, H({ ...stance, rx: 6, ry: 8, torso: 0.3, aF: 2.15, eF: 0.3, sw: 2.45 }), 'out']] }),
    plant({ dur: 0.56, active: [0.15, 0.26], keys: [
      [0, H({ ...stance, ry: 8, torso: 0.3, aF: 2.0, eF: 0.3, sw: 2.3 })],
      [0.13, H({ tF: 0.95, kF: -1.2, tB: -0.7, kB: -0.3, ry: 17, torso: 0.75, aF: -0.25, eF: 0.3, sw: -0.85 }), 'io'],
      [0.25, H({ tF: 0.4, kF: -0.4, tB: -0.45, kB: -0.15, ry: -3, torso: -0.2, head: -0.15, aF: 2.95, eF: 0.05, sw: 3.05 }), 'snap'],
      [0.56, H({ tF: 0.4, kF: -0.45, tB: -0.4, kB: -0.2, ry: 2, torso: 0, aF: 2.6, eF: 0.3, sw: 2.85 }), 'out']] }),
    plant({ dur: 0.8, active: [0.3, 0.42], keys: [
      [0, H({ ...stance, ry: 10, torso: 0.3, aF: 2.6, eF: 0.4, sw: 3.0 })],
      [0.2, H({ tF: 1.2, kF: -2.0, tB: 0.9, kB: -1.8, ry: -44, torso: -0.15, head: 0.1, aF: 3.15, eF: 0.3, sw: 3.85 }), 'out'],
      [0.33, H({ tF: 1.05, kF: -1.2, tB: -0.8, kB: -0.3, ry: 20, torso: 0.95, head: -0.25, aF: 0.85, eF: 0.0, sw: 0.1 }), 'snap'],
      [0.8, H({ tF: 0.95, kF: -1.1, tB: -0.7, kB: -0.3, ry: 16, torso: 0.7, aF: 0.85, eF: 0.15, sw: 0.15 }), 'out']] }, [1]),
  ];
  // thrusts: drawn back to the chest, then the whole body behind the point
  const thrust = (aim, dur = 0.38) => plant({ dur, active: [0.11, 0.2], keys: [
    [0, { ...stance, ry: 6, torso: 0.05, aF: 0.75 + aim * 0.3, eF: 1.75, aB: -0.4, eB: 0.6, sw: 1.6 + aim }],
    [0.09, { ...stance, rx: -6, ry: 7, torso: -0.05, aF: 0.45 + aim * 0.3, eF: 2.0, aB: -0.5, eB: 0.6, sw: 1.62 + aim }, 'io'],
    [0.16, { tF: 0.95, kF: -0.85 - Math.max(0, -aim) * 0.6, tB: -0.85, kB: -0.15, rx: 16, ry: 12 + Math.max(0, -aim) * 14, torso: 0.5 + Math.max(0, -aim) * 0.3 - Math.max(0, aim) * 0.25, head: -0.1, aF: 1.55 + aim, eF: 0.02, aB: -1.2, eB: 0.3, sw: 1.57 + aim }, 'snap'],
    [dur, { ...stance, rx: 6, ry: 8, torso: 0.25, aF: 1.15 + aim * 0.5, eF: 0.8, aB: -0.6, eB: 0.5, sw: 1.6 + aim * 0.6 }, 'out']] });
  const THRUST = [thrust(0), thrust(0.4), thrust(-0.35)];
  // the spear's twirl: the shaft circles twice round the hand, striking in front and behind
  const TWIRL = plant({ dur: 0.66, active: [0.1, 0.42], keys: [
    [0, { ...stance, ry: 8, torso: 0.2, aF: 1.4, eF: 0.15, aB: -0.3, sw: 1.57 }],
    [0.08, { ...stance, ry: 9, torso: 0.15, aF: 1.5, eF: 0.1, aB: 0.9, eB: 1.0, sw: 1.57 }, 'io'],
    [0.42, { ...stance, ry: 9, torso: 0.15, aF: 1.5, eF: 0.1, aB: 0.9, eB: 1.0, sw: 1.57 + TAU * 2 }, 'lin'],
    [0.66, { ...stance, rx: 4, ry: 8, torso: 0.3, aF: 1.3, eF: 0.4, aB: -0.4, eB: 0.6, sw: 1.57 + TAU * 2 }, 'out']] });
  // the rapier's flurry: three thrusts, level, high, low
  const ext = (aim) => ({ tF: 0.95, kF: -0.85, tB: -0.85, kB: -0.15, rx: 16, ry: 12, torso: 0.5 - aim * 0.2, aF: 1.55 + aim, eF: 0.02, aB: -1.2, eB: 0.3, sw: 1.57 + aim });
  const back = (aim) => ({ ...stance, rx: -2, ry: 7, torso: 0.05, aF: 0.6 + aim * 0.3, eF: 1.9, aB: -0.5, eB: 0.6, sw: 1.6 + aim });
  const FLURRY = plant({ dur: 0.56, active: [0.05, 0.31], keys: [
    [0, back(0)], [0.07, ext(0), 'snap'], [0.12, back(0.4), 'io'], [0.17, ext(0.4), 'snap'], [0.23, back(-0.3), 'io'], [0.29, ext(-0.3), 'snap'],
    [0.56, { ...stance, rx: 6, ry: 8, torso: 0.25, aF: 1.15, eF: 0.8, aB: -0.6, eB: 0.5, sw: 1.5 }, 'out']] });
  // reaps: the blade pulled back across the body
  const REAP = [
    plant({ dur: 0.5, active: [0.12, 0.24], keys: [
      [0, { ...stance, ry: 6, torso: -0.05, aF: 2.2, eF: 0.3, aB: 1.6, eB: 0.5, sw: 2.3, hold: 0.6 }],
      [0.1, { ...stance, ry: 4, torso: -0.15, aF: 2.5, eF: 0.2, aB: 1.8, eB: 0.4, sw: 2.6, hold: 0.6 }, 'io'],
      [0.24, { tF: 0.4, kF: -0.6, tB: -0.9, kB: -0.25, rx: -10, ry: 10, torso: 0.25, aF: -0.6, eF: 0.3, aB: -0.8, eB: 0.4, sw: -1.4, hold: 0.6 }, 'snap'],
      [0.5, { tF: 0.45, kF: -0.6, tB: -0.8, kB: -0.25, rx: -6, ry: 9, torso: 0.2, aF: -0.4, eF: 0.4, aB: -0.6, eB: 0.5, sw: -1.2, hold: 0.6 }, 'out']] }),
    plant({ dur: 0.5, active: [0.11, 0.23], keys: [
      [0, { tF: 0.45, kF: -0.6, tB: -0.8, kB: -0.25, rx: -6, ry: 9, torso: 0.2, aF: -0.4, eF: 0.4, sw: -1.2, hold: 0.6 }],
      [0.09, { tF: 0.5, kF: -0.7, tB: -0.8, kB: -0.25, rx: -8, ry: 12, torso: 0.35, aF: -0.7, eF: 0.4, sw: -1.5, hold: 0.6 }, 'io'],
      [0.22, { tF: 0.85, kF: -0.9, tB: -0.6, kB: -0.2, rx: 12, ry: 2, torso: -0.1, head: -0.1, aF: 2.6, eF: 0.1, sw: 3.0, hold: 0.6 }, 'snap'],
      [0.5, { tF: 0.8, kF: -0.85, tB: -0.6, kB: -0.2, rx: 6, ry: 4, torso: 0.0, aF: 2.3, eF: 0.3, sw: 2.7, hold: 0.6 }, 'out']] }),
    plant({ dur: 0.52, active: [0.14, 0.25], keys: [
      [0, { ...stance, ry: 5, torso: -0.05, aF: 2.6, eF: 0.4, sw: 3.2, hold: 0.6 }],
      [0.12, { ...stance, ry: 3, torso: -0.2, aF: 2.95, eF: 0.3, sw: 4.1, hold: 0.6 }, 'io'],
      [0.23, { tF: 0.95, kF: -1.05, tB: -0.65, kB: -0.25, ry: 15, torso: 0.7, head: -0.15, aF: 1.1, eF: 0.05, sw: 0.2, hold: 0.6 }, 'snap'],
      [0.52, { tF: 0.85, kF: -0.95, tB: -0.6, kB: -0.25, ry: 12, torso: 0.5, aF: 0.9, eF: 0.3, sw: 0.25, hold: 0.6 }, 'out']] }),
  ];
  // the odachi's iai: crouched with the blade low behind, then drawn through everything as you pass
  const IAI = plant({ dur: 0.72, active: [0.24, 0.33], keys: [
    [0, { tF: 1.0, kF: -1.3, tB: -0.8, kB: -0.4, ry: 18, torso: 0.7, head: -0.2, aF: 0.2, eF: 0.6, aB: 0.6, eB: 1.4, sw: -1.9, hold: 0.8 }],
    [0.15, { tF: 1.05, kF: -1.4, tB: -0.85, kB: -0.4, ry: 21, torso: 0.78, head: -0.25, aF: 0.1, eF: 0.6, aB: 0.6, eB: 1.4, sw: -2.0, hold: 0.8 }, 'io'],
    [0.24, { tF: 1.1, kF: -0.8, tB: -1.0, kB: -0.15, rx: 22, ry: 16, torso: 0.6, head: -0.15, aF: 1.6, eF: 0, aB: -1.3, eB: 0.3, sw: 1.6 }, 'snap'],
    [0.72, { tF: 1.0, kF: -0.8, tB: -0.9, kB: -0.15, rx: 18, ry: 14, torso: 0.5, aF: 1.5, eF: 0.1, aB: -1.0, eB: 0.4, sw: 1.7 }, 'out']] });

  /* ---------------------------------------------------------------- steps: numbers per combo step */
  // the original four cuts (直刀)
  const CUT = [
    { dmg: 10, bal: 7, lunge: 140, cancel: 0.26, box: { x: 0, y: -140, w: 118, h: 140 }, pitch: 1.0 },
    { dmg: 11, bal: 7, lunge: 150, cancel: 0.22, box: { x: 0, y: -160, w: 112, h: 160 }, pitch: 1.1 },
    { dmg: 13, bal: 9, lunge: 170, cancel: 0.26, box: { x: -10, y: -140, w: 128, h: 140 }, pitch: 0.95 },
    { dmg: 24, bal: 20, lunge: 330, cancel: 0.5, box: { x: -40, y: -170, w: 175, h: 175 }, pitch: 0.8, big: true, launch: true, drive: [0.12, 0.34, 260], slam: 0.36 },
  ].map((s, i) => Object.assign(s, { anim: A.light[i] }));
  const HEAVY_S = [
    { dmg: 13, bal: 10, lunge: 110, cancel: 0.36, box: { x: 0, y: -190, w: 140, h: 190 }, pitch: 0.75 },
    { dmg: 12, bal: 9, lunge: 120, cancel: 0.32, box: { x: -50, y: -150, w: 180, h: 150 }, pitch: 0.82 },
    { dmg: 13, bal: 9, lunge: 130, cancel: 0.32, box: { x: -10, y: -220, w: 130, h: 220 }, pitch: 0.9, launch: true },
    { dmg: 28, bal: 24, lunge: 220, cancel: 0.6, box: { x: -60, y: -160, w: 230, h: 165 }, pitch: 0.65, big: true, slam: 0.33, drive: [0.05, 0.28, 240] },
  ].map((s, i) => Object.assign(s, { anim: HEAVY[i] }));
  const THRUST_S = [
    { dmg: 9, bal: 6, lunge: 210, cancel: 0.2, box: { x: 10, y: -135, w: 160, h: 105 }, pitch: 1.25 },
    { dmg: 10, bal: 6, lunge: 220, cancel: 0.2, box: { x: 10, y: -185, w: 150, h: 110 }, pitch: 1.35 },
    { dmg: 11, bal: 7, lunge: 240, cancel: 0.22, box: { x: 10, y: -95, w: 165, h: 95 }, pitch: 1.15 },
  ].map((s, i) => Object.assign(s, { anim: THRUST[i] }));
  const SPEAR_F = { anim: TWIRL, dmg: 8, bal: 7, lunge: 60, cancel: 0.5, box: { x: -120, y: -200, w: 270, h: 200 }, pitch: 0.95, big: true, hits: [[0.1, 0.19], [0.2, 0.3], [0.31, 0.42]] };
  const RAPIER_F = { anim: FLURRY, dmg: 9, bal: 6, lunge: 120, cancel: 0.42, box: { x: 10, y: -150, w: 170, h: 130 }, pitch: 1.45, big: true, hits: [[0.05, 0.1], [0.15, 0.2], [0.26, 0.32]] };
  const REAP_S = [
    { dmg: 11, bal: 7, lunge: 120, cancel: 0.3, box: { x: -100, y: -175, w: 250, h: 175 }, pitch: 0.9 },
    { dmg: 11, bal: 7, lunge: 130, cancel: 0.28, box: { x: -70, y: -210, w: 230, h: 210 }, pitch: 1.0 },
    { dmg: 13, bal: 9, lunge: 150, cancel: 0.3, box: { x: 0, y: -195, w: 170, h: 195 }, pitch: 0.9 },
    { anim: A.light[3], dmg: 22, bal: 18, lunge: 200, cancel: 0.5, box: { x: -170, y: -185, w: 340, h: 185 }, pitch: 0.75, big: true, pull: true, drive: [0.12, 0.34, 200], slam: 0.36 },
  ].map((s, i) => (s.anim ? s : Object.assign(s, { anim: REAP[i] })));
  const IAI_S = { anim: IAI, dmg: 26, bal: 20, lunge: 0, cancel: 0.56, box: { x: -340, y: -150, w: 430, h: 150 }, pitch: 0.7, big: true, dash: [0.17, 0.25, 1500] };
  // twinblades: the same cuts, each landing twice
  const TWIN_S = CUT.map((s, i) => Object.assign({}, s, { dmg: s.dmg * (i === 3 ? 0.62 : 0.6),
    hits: i === 3 ? [[0.13, 0.24], [0.25, 0.36]] : [[s.anim.active[0], (s.anim.active[0] + s.anim.active[1]) / 2], [(s.anim.active[0] + s.anim.active[1]) / 2 + 0.005, s.anim.active[1] + 0.03]] }));
  const FAN_S = CUT.map((s) => Object.assign({}, s, { dmg: s.dmg * 0.35, bal: s.bal * 0.5, lunge: s.lunge * 0.6, box: Object.assign({}, s.box, { w: s.box.w * 0.7 }) }));

  const FORMS = {
    katana: { name: '斬擊', desc: '均衡的四段斬擊，終結技迴旋斬', steps: CUT, fx: 'arc' },
    twin: { name: '連刃', desc: '每一擊都會連斬兩刀', steps: TWIN_S, fx: 'twin' },
    odachi: { name: '居合', desc: '長距離斬擊，終結技居合拔刀：衝刺穿過敵人', steps: [CUT[0], CUT[1], CUT[2], IAI_S], fx: 'arc' },
    great: { name: '劈砍', desc: '直劈・橫掃・上挑・跳斬，慢而沉重', steps: HEAVY_S, fx: 'cleave' },
    axe: { name: '劈斧', desc: '直劈・橫掃・上挑・跳劈，劈砍時濺出火花', steps: HEAVY_S, fx: 'chop' },
    hammer: { name: '重鎚', desc: '直砸・橫掃・上挑・跳砸，每次落地都會震地', steps: HEAVY_S, fx: 'smash' },
    spear: { name: '突刺', desc: '平刺・上刺・下刺，終結技旋槍（前後皆中）', steps: [...THRUST_S, SPEAR_F], fx: 'thrust' },
    rapier: { name: '刺擊', desc: '快速突刺，終結技三連刺', steps: [...THRUST_S, RAPIER_F], fx: 'thrust' },
    scythe: { name: '收割', desc: '往身後拉回的大範圍揮掃（背後也打得到），終結技把敵人拉近', steps: REAP_S, fx: 'reap' },
    fan: { name: '靈風', desc: '扇子本身幾乎不痛：每一揮都放出靈風（中距離穿透）', steps: FAN_S, fx: 'gust' },
  };

  const F = G.Forms = {
    FORMS,
    family(P) { const g = P && P.gear; return (g && g.look && g.look.cls) || 'katana'; },
    form(P) { return FORMS[this.family(P)] || FORMS.katana; },
    step(P, ci) { return this.form(P).steps[ci] || CUT[ci]; },
    info(wc) { return FORMS[wc] || FORMS.katana; },
    // the weapon's own mark on a hit window opening (the class adds its flourish separately, js/dnd.js)
    fx(P, ci, S, win) {
      const fam = this.family(P), f = P.facing, x = P.x, y = P.y, g = G.game;
      const col = (G.DnD.trailCol && G.DnD.trailCol()) || (P.gear && P.gear.look && P.gear.look.col) || '#7ff4ff';
      const reach = (P.gear && P.gear.reach) || 1;
      const kind = this.form(P).fx;
      if (kind === 'thrust') {
        const yy = y + S.box.y + S.box.h * 0.5, len = (S.box.x + S.box.w) * reach;
        if (S === SPEAR_F) { G.FX.ring(x + f * 30, y - 110, 20, 150, 0.3, col, 4); G.SFX.play('whoosh', 0.9 + win * 0.1); return; }
        G.FX.beam(x + f * 30, yy, x + f * len, yy, col, 0.16, 7); G.FX.beam(x + f * 40, yy, x + f * (len - 10), yy, '#ffffff', 0.1, 2);
        G.FX.ring(x + f * len, yy, 4, 30, 0.18, col, 2);
      } else if (kind === 'cleave' || kind === 'chop' || kind === 'smash') {
        const ang = [f > 0 ? 1.0 : Math.PI - 1.0, f > 0 ? 0.05 : Math.PI - 0.05, f > 0 ? -1.1 : Math.PI + 1.1, f > 0 ? 1.2 : Math.PI - 1.2][ci];
        G.FX.slashMark(x + f * 70, y - 95, ang, 230 * reach, col, 0.34, kind === 'cleave' ? 24 : 16);
        if (kind === 'chop') G.FX.spark(x + f * 90, y - 40, 10, { col: '#ffd9a0', speed: 600 });
        if ((ci === 0 || ci === 3) && (kind === 'smash' || ci === 3)) {
          // the blow reaches the ground
          setTimeout(() => {
            if (!g || g.player !== P) return;
            g.shake(kind === 'smash' ? 0.55 : 0.35); G.SFX.play('impact');
            G.FX.ring(x + f * 110, y - 4, 10, kind === 'smash' ? 230 : 160, 0.45, col, 6, { flat: 0.2 }); G.FX.dust(x + f * 110, y, 18, { w: 130, speed: 300, size: 14 });
            if (kind === 'smash') G.DnD.area(P, { x: x + f * 110 - 160, y: y - 70, w: 320, h: 80 }, ci === 3 ? 10 : 5, ci === 3 ? 20 : 10);
          }, 60);
        }
      } else if (kind === 'reap') {
        G.FX.slashMark(x + f * 20, y - 100, f > 0 ? [2.6, -2.2, 1.2, 0][ci] : Math.PI - [2.6, -2.2, 1.2, 0][ci], 260 * reach, col, 0.36, 18);
        if (S.pull) {
          // the death spiral drags everything near back into reach
          for (const e of g.enemies) if (!e.dead && !e.boss && !e.elite && Math.abs(e.x - x) < 330 && Math.abs(e.y - y) < 160) { e.vx = (x - e.x) * 4; if (e.T && e.T.fly) e.vy = (y - 90 - e.y) * 3; }
          G.FX.ring(x, y - 80, 300, 30, 0.4, col, 4);
        }
      } else if (kind === 'twin') {
        G.FX.slashMark(x + f * 55, y - 85, f > 0 ? (win ? -0.6 : 0.6) : Math.PI - (win ? -0.6 : 0.6), 130 * reach, col, 0.2, 7);
      } else if (kind === 'gust') {
        F.gusts(P, ci, x, y, f, g);
      }
      if (S === IAI_S) {
        G.FX.beam(x - f * 340, y - 80, x + f * 20, y - 80, col, 0.3, 10); G.FX.beam(x - f * 340, y - 80, x + f * 20, y - 80, '#ffffff', 0.2, 3);
        G.SFX.play('slash', 0.6, true);
      }
    },
    // spirit wind: hold ↓ / ↑ while swinging to send it slanting down / up. A shaman's wind is stronger.
    gusts(P, ci, x, y, f, g) {
      const aim = G.Input.down('down') ? 1 : G.Input.down('up') ? -1 : 0, k = G.DnD.is('shaman') ? 1 : 0.7;
      const gust = (vy, dmg, r) => g.projectiles.push({ x: x + f * 46, y: y - 66, vx: f * 720 * (aim ? 0.86 : 1), vy: vy * 0.7 + aim * 400, r, rh: aim ? r : 66, owner: null, friendly: true, kind: 'wind', pierce: true, hit: new Set(), pdmg: dmg * k, pbal: 6, life: 0.88, t: 0, col: '#c9b6ff' });
      if (ci === 3) { gust(-150, 9, 26); gust(0, 11, 32); gust(150, 9, 26); } else gust(0, [6, 7, 8][ci] || 7, 26);
      G.FX.ring(x, y - 2, 10, 70, 0.4, '#c9b6ff', 3, { flat: 0.25 }); G.FX.ring(x, y - 2, 6, 46, 0.4, '#f2e6cc', 2, { flat: 0.25 });
      G.SFX.play('musicbox', 1.6 + ci * 0.15); G.SFX.play('whoosh', 1.3 + ci * 0.05);
    },
  };
})(window.G);

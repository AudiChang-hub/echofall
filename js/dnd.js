'use strict';
/* ECHOFALL — D&D layer: six ability scores, four classes (each with a feature), the class choice and the character sheet.
   Scores are raised at a pylon (調校, paid in shards). Modifier = ⌊(score − 10) / 2⌋ (D&D 5e).
   Effects per +1 modifier — STR melee +6% · DEX stamina regen +6%, crit +2%, dodge i-frames +0.01s · CON max HP +8 ·
   INT skill damage +10%, resonance +5% · WIS tonic healing +6% (and perception checks) · CHA prices −5% (and persuasion). */
(function (G) {
  const U = G.U, $ = (s) => document.querySelector(s), I = () => G.Input;
  const ATTRS = [
    { id: 'str', name: '力量', en: 'STR', col: '#ff8f6b', fx: (m) => `近戰傷害 ${sg(6 * m)}%` },
    { id: 'dex', name: '敏捷', en: 'DEX', col: '#8dfcb0', fx: (m) => `耐力回復 ${sg(6 * m)}%・暴擊 ${sg(2 * Math.max(0, m))}%・閃避無敵 ${sg(0.01 * Math.max(0, m), 2)} 秒` },
    { id: 'con', name: '體質', en: 'CON', col: '#ff5d86', fx: (m) => `最大生命 ${sg(8 * m)}` },
    { id: 'int', name: '智力', en: 'INT', col: '#7ff4ff', fx: (m) => `共鳴技能傷害 ${sg(10 * m)}%・共鳴獲取 ${sg(5 * m)}%` },
    { id: 'wis', name: '感知', en: 'WIS', col: '#c9b6ff', fx: (m) => `調和劑回復 ${sg(6 * m)}%・更容易察覺陷阱與謊言` },
    { id: 'cha', name: '魅力', en: 'CHA', col: '#ffd27a', fx: (m) => `商店價格 ${sg(-5 * m)}%・更容易說服他人` },
  ];
  function sg(v, d = 0) { const s = (+v).toFixed(d); return v > 0 ? '+' + s : s; }
  const CLASSES = {
    fighter: {
      name: '劍巫', en: 'FIGHTER', col: '#ff8f6b', icon: 'fighter', outfit: 'chain', weapon: 'bellgreat',
      look: { cls: 'great', len: 1.38, w: 1.9, shape: null, col: '#ffb08f' },
      base: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
      line: '在棄兒之島上，妳學會的第一件事是：站著的人，才有資格說話。',
      feature: { name: '再起之息', desc: '每次休息後一次：生命跌破 30% 時，立刻回復 35% 生命。' },
      style: '大劍・巨斧・戰鎚｜重擊不會被打斷，裂地重斬',
    },
    rogue: {
      name: '影行者', en: 'ROGUE', col: '#8dfcb0', icon: 'rogue', outfit: 'leather', weapon: 'twinfang',
      look: { cls: 'twin', len: 0.82, w: 1.1, shape: null, col: '#b8ffd0' },
      base: { str: 10, dex: 15, con: 12, int: 12, wis: 12, cha: 8 },
      line: '島上的燈塔每晚都會照到妳。妳學會了在光掃過來之前，先一步躲進影子裡。',
      feature: { name: '偷襲', desc: '從背後出手，或完美閃避後的第一擊：傷害 +60%，而且必定暴擊。' },
      style: '雙刃＋短刀｜影步閃避，背刺與飛刀',
    },
    paladin: {
      name: '守誓者', en: 'PALADIN', col: '#ffd27a', icon: 'paladin', outfit: 'robe', weapon: 'zhixian',
      look: { cls: 'katana', len: 1, w: 1, shape: null, col: '#fff1c2' },
      base: { str: 14, dex: 8, con: 13, int: 8, wis: 12, cha: 15 },
      line: '養父母說，被丟掉的人也可以發誓。誓言不需要誰的允許。',
      feature: { name: '神聖斬擊', desc: '完美格擋後的下一擊附加光明之力：傷害 +50%，並回復 5% 生命。' },
      style: '直刀＋盾｜舉盾前進，完美格擋後神聖斬擊',
    },
    shaman: {
      name: '巫女', en: 'SHAMAN', col: '#c9b6ff', icon: 'shaman', outfit: 'gown', weapon: 'spiritfan',
      look: { cls: 'fan', len: 0.9, w: 1, shape: 'fan', col: '#e2d6ff' },
      base: { str: 8, dex: 12, con: 12, int: 15, wis: 13, cha: 10 },
      line: '妳唱的歌，島上的死者聽得見。這件事，妳從來沒有告訴過任何人。',
      feature: { name: '龍語', desc: '共鳴技能消耗 −30%，傷害 +25%。' },
      style: '巫扇＋巫鈴｜中距離作戰，靈風與招魂',
    },
  };
  const ORDER = ['fighter', 'rogue', 'paladin', 'shaman'];
  // weapon classes each class is trained in (drops lean toward these; +10% damage when proficient)
  const PROF = { fighter: ['great', 'axe', 'hammer', 'odachi'], rogue: ['twin', 'rapier', 'scythe', 'katana'], paladin: ['katana', 'odachi', 'rapier', 'hammer'], shaman: ['fan', 'spear'] };
  // attribute scaling per weapon class (Elden Ring–style letter grades)
  const SCALE = {
    katana: { str: 'C', dex: 'C' }, great: { str: 'A', con: 'D' }, rapier: { dex: 'A', cha: 'D' }, twin: { dex: 'A', str: 'D' },
    odachi: { str: 'B', dex: 'B' }, spear: { dex: 'B', str: 'C', int: 'D' }, hammer: { str: 'S' }, scythe: { dex: 'B', int: 'C' },
    axe: { str: 'A', con: 'C' }, fan: { int: 'A', wis: 'C' },
  };
  const GRADE = { S: 0.07, A: 0.055, B: 0.04, C: 0.025, D: 0.012 };
  const MAXS = 20;

  const D = G.DnD = {
    ATTRS, CLASSES, ORDER, PROF, SCALE,
    proficient(wc, sv) { const d = this.st(sv); return !!d && !!wc && PROF[d.cls].includes(wc); },
    // weapon damage from your scores (only positive modifiers count) and class training
    weaponMul(wc) {
      if (!this.st() || !wc) return 1;
      let m = 1; const sc = SCALE[wc] || {};
      for (const k in sc) m += GRADE[sc[k]] * Math.max(0, this.mod(k));
      return m * (this.proficient(wc) ? 1.1 : 1);
    },
    // gear detail: scaling letters and whether this class is trained with it
    weaponHtml(wc) {
      const sc = SCALE[wc] || {}, d = this.st();
      const grades = Object.keys(sc).map((k) => { const a = ATTRS.find((q) => q.id === k); return `<span class="wg" style="--ac:${a.col}">${G.Icons.svg(k, 13)}${a.name}<b>${sc[k]}</b></span>`; }).join('');
      const prof = !d ? '' : this.proficient(wc) ? `<span class="wp on">${G.Icons.svg(CLASSES[d.cls].icon, 13)}${CLASSES[d.cls].name}熟練　傷害 +10%</span>` : '<span class="wp">非本職業武器</span>';
      return `<p class="gd-scale">屬性補正 ${grades}${prof}</p>`;
    },
    // loot: about seven in ten weapons are ones your class is trained in
    pickWeapon(keys, defOf) {
      const d = this.st(); if (!d || Math.random() > 0.7) return null;
      const mine = keys.filter((k) => PROF[d.cls].includes(defOf(k).cls));
      return mine.length ? mine[Math.floor(Math.random() * mine.length)] : null;
    },
    st(sv) { sv = sv || (G.game && G.game.save); return sv && sv.dnd; },
    cls(sv) { const d = this.st(sv); return d ? CLASSES[d.cls] : null; },
    score(id, sv) { const d = this.st(sv); return d ? d.attr[id] : 10; },
    mod(id, sv) { return Math.floor((this.score(id, sv) - 10) / 2); },
    is(c, sv) { const d = this.st(sv); return !!d && d.cls === c; },
    choose(sv, c) {
      const C = CLASSES[c];
      sv.dnd = { cls: c, attr: Object.assign({}, C.base) };
      G.Gear.ensure(sv);
      // the class's own weapon joins the bag and goes in the hand
      if (!sv.inv.some((i) => i.base === C.weapon)) {
        const w = G.Gear.make('weapon', C.weapon, 0, 1); w.uid = 'cls_' + c; sv.inv.unshift(w);
        sv.gear.weapon = w.uid;
      }
    },
    // 調校: +1 to a score, paid in shards
    cost(id, sv) { const s = this.score(id, sv); return s >= MAXS ? null : Math.round(90 * Math.pow(1.2, s - 8)); },
    buy(id, sv) {
      const c = this.cost(id, sv); if (c == null || sv.shards < c) return false;
      sv.shards -= c; sv.dnd.attr[id]++; return true;
    },
    // folded into Player.recalc
    apply(P) {
      if (!this.st()) { P.skillMul = 1; P.healMul = 1; P.staRegen = 1; P.critAdd = 0; P.iframeAdd = 0; return; }
      const m = (k) => this.mod(k);
      P.maxHp += 8 * m('con');
      P.dmgMul *= 1 + 0.06 * m('str');
      P.staRegen = 1 + 0.06 * m('dex');
      P.critAdd = 0.02 * Math.max(0, m('dex'));
      P.iframeAdd = 0.01 * Math.max(0, m('dex'));
      P.resMul *= 1 + 0.05 * m('int');
      P.skillMul = (1 + 0.1 * m('int')) * (this.is('shaman') ? 1.25 : 1);
      P.healMul = 1 + 0.06 * m('wis');
      const hc = document.getElementById('hudCls'); if (hc) hc.textContent = `${this.cls().name} · ${this.cls().en}`;
      { const sn = document.getElementById('skName'), sk = this.skills(); if (sn) sn.textContent = (P.res || 0) >= sk.c2 ? sk.n2 : sk.n1; }
    },
    priceMul() { return this.st() ? U.clamp(1 - 0.05 * this.mod('cha'), 0.6, 1.25) : 1; },
    // the names on the skill button: [technique 1, technique 2] and what each costs
    skills() {
      const c = this.st() && this.st().cls;
      const n = { fighter: ['裂地重斬', '終止式'], rogue: ['飛刀', '終止式'], paladin: ['聖盾衝撞', '終止式'], shaman: ['靈風扇', '招魂'] }[c] || ['斷弦', '終止式'];
      return { n1: n[0], n2: n[1], c1: this.skillCost(25), c2: this.skillCost(50) };
    },
    skillCost(base) { return this.is('shaman') ? Math.round(base * 0.7) : base; },
    // body armor wins; bare, you wear your class's colours
    outfit(o) { const c = this.cls(); return o && o.body ? o : c ? { head: o && o.head, body: c.outfit } : o; },
    // combat hooks
    modHit(P, e, m, h) {
      if (!this.st()) return m;
      let { dmg, bal, crit } = m;
      if (h && h.noRes) dmg *= P.skillMul || 1;                      // resonance techniques
      if (!crit && Math.random() < ((P.gear && P.gear.crit) || 0) + (P.critAdd || 0)) { dmg *= 1.8; crit = true; }
      if (this.is('rogue') && (e.facing === Math.sign(e.x - P.x) || P.sneakT > 0)) {
        dmg *= 1.6; if (!crit) { dmg *= 1.8; crit = true; } P.sneakT = 0;
        G.FX.text(e.cx, e.y - e.h - 30, '偷襲', '#8dfcb0', 18, 0.8);
      }
      if (this.is('paladin') && P.smiteT > 0) {
        dmg *= 1.5; P.smiteT = 0; P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.05);
        G.FX.flash(e.cx, e.cy, 160, 0.5, '#ffd27a'); G.FX.ring(e.cx, e.cy, 10, 150, 0.5, '#ffd27a', 5);
        G.FX.text(e.cx, e.y - e.h - 30, '神聖斬擊', '#ffd27a', 18, 0.8);
      }
      return { dmg, bal, crit };
    },
    onParry(P) { if (this.is('paladin')) { P.smiteT = 2.2; G.FX.ring(P.x, P.y - 70, 8, 90, 0.4, '#ffd27a', 3); } },
    onDodge(P) { if (this.is('rogue')) P.sneakT = 1.6; },
    onHurt(P) {
      if (!this.is('fighter') || P.hp <= 0 || P.windUsed || P.hp >= P.maxHp * 0.3) return;
      P.windUsed = true; P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.35);
      G.FX.ring(P.x, P.y - 60, 10, 200, 0.6, '#ff8f6b', 6); G.SFX.play('heal');
      G.UI.toast('再起之息', 'good');
    },
    rest(P) { P.windUsed = false; },
    update(P, dt) { if (P.sneakT > 0) P.sneakT -= dt; if (P.smiteT > 0) P.smiteT -= dt; },

    /* ------------------------------------------------ fighting styles: each class's plain attacks look and work differently
       劍巫  heavy cleaves (slower, wider, harder) trailing embers; the combo ends in a ground-splitting slam
       影行者 twin-blade flurry (much faster); every cut is followed by a shadow cut, the 3rd step dashes through, the finisher appears behind the foe
       守誓者 measured strikes of light; the 2nd blow is a shield bash, the finisher calls a pillar of light down on the foe
       巫女  the fan barely touches; every stroke throws spirit wind instead (mid range), the finisher a fan of three gusts */
    STYLE: {
      // w = how far the blade reaches (× the base swing box); range = the 1–4 shown on the class card
      fighter: { name: '巨刃', speed: 0.86, dmg: 1.25, bal: 1.3, lunge: 1.1, w: 1.5, range: 3, trail: '#ff8f6b' },
      rogue: { name: '雙刃', speed: 1.38, dmg: 0.82, bal: 0.8, lunge: 1.15, w: 0.7, range: 1, trail: '#8dfcb0' },
      paladin: { name: '聖光', speed: 0.95, dmg: 1.05, bal: 1.1, lunge: 1.0, w: 1.0, range: 2, trail: '#ffd27a' },
      shaman: { name: '靈風', speed: 1.05, dmg: 0.55, bal: 0.6, lunge: 0.6, w: 0.6, range: 4, trail: '#c9b6ff' },
    },
    style() { const d = this.st(); return d ? this.STYLE[d.cls] : null; },
    rangeHtml(c) {
      const r = this.STYLE[c].range, words = ['', '近身', '中距離', '長兵器', '遠距離'];
      return `<span class="cs-range"><em>攻擊距離</em><span class="rg">${[1, 2, 3, 4].map((k) => `<i class="${k <= r ? 'on' : ''}"></i>`).join('')}</span><b>${words[r]}</b></span>`;
    },
    atkSpeed() { const s = this.style(); return s ? s.speed : 1; },
    trailCol() { const s = this.style(); return s ? s.trail : null; },
    noTrail() { return this.is('shaman'); },
    // the light-attack box and numbers for this class
    light(L, ci) {
      const s = this.style(); if (!s) return { box: L.box, dmg: L.dmg, bal: L.bal };
      const box = { x: L.box.x, y: L.box.y, w: L.box.w * s.w, h: L.box.h };
      let bal = L.bal * s.bal;
      if (this.is('paladin') && ci === 1) { box.w *= 0.8; bal *= 2.4; }    // the shield bash
      return { box, dmg: L.dmg * s.dmg, bal };
    },
    lungeMul(ci) { const s = this.style(); if (!s) return 1; return this.is('rogue') && ci === 2 ? 2.4 : s.lunge; },
    onLightStart(P, ci) {
      if (this.is('rogue') && ci === 3) {
        // the finisher: step through the shadow and appear behind the nearest foe in front
        let best = null, bd = 300;
        for (const e of G.game.enemies) { if (e.dead || e.state === 'spawn') continue; const dx = (e.x - P.x) * P.facing, dy = Math.abs(e.y - P.y); if (dx > -20 && dx < bd && dy < 120) { bd = dx; best = e; } }
        if (best) {
          G.FX.ghost({ x: P.x, y: P.y, facing: P.facing, pose: Object.assign({}, P.pose) }, '#8dfcb0', 0.4, 0.7);
          P.x = best.x + P.facing * (best.w / 2 + 44); P.facing = -P.facing; P.vx = 0; P.iframes = Math.max(P.iframes, 0.2);
          G.SFX.play('dodge', 1.4); G.FX.ring(P.x, P.y - 70, 8, 70, 0.3, '#8dfcb0', 3);
        }
      }
      if (this.is('rogue') && ci === 2) G.FX.ghost({ x: P.x, y: P.y, facing: P.facing, pose: Object.assign({}, P.pose) }, '#8dfcb0', 0.3, 0.5);
    },
    // the first frame a light attack is live
    onSwing(P, ci) {
      const f = P.facing, x = P.x, y = P.y, g = G.game;
      if (this.is('fighter')) {
        G.FX.slashMark(x + f * 70, y - 80, f > 0 ? -0.5 + ci * 0.3 : Math.PI + 0.5 - ci * 0.3, 210, '#ff8f6b', 0.36, 22);
        G.FX.slashMark(x + f * 70, y - 80, f > 0 ? -0.5 + ci * 0.3 : Math.PI + 0.5 - ci * 0.3, 170, '#fff1e0', 0.22, 8);
        G.FX.ember(x + f * 70, y - 80, 10, '#ff8f6b', { w: 80, h: 60, up: 60 });
        if (ci === 3) {   // ground-splitting slam
          g.shake(0.6); G.SFX.play('impact');
          G.FX.ring(x + f * 80, y - 4, 10, 200, 0.45, '#ff8f6b', 7, { flat: 0.2 }); G.FX.dust(x + f * 80, y, 20, { w: 140, speed: 300, size: 14 });
          this.area(P, { x: x + f * 80 - 170, y: y - 90, w: 340, h: 100 }, 10, 18);
        }
      } else if (this.is('rogue')) {
        G.FX.ghost({ x: P.x - f * 26, y: P.y, facing: f, pose: Object.assign({}, P.pose) }, '#8dfcb0', 0.28, 0.55);
        G.FX.slashMark(x + f * 55, y - 85, f > 0 ? 0.6 : Math.PI - 0.6, 120, '#b8ffd0', 0.22, 7);
        G.FX.slashMark(x + f * 55, y - 85, f > 0 ? -0.6 : Math.PI + 0.6, 120, '#8dfcb0', 0.22, 7);
      } else if (this.is('paladin')) {
        G.FX.slashMark(x + f * 60, y - 80, f > 0 ? -0.2 : Math.PI + 0.2, 150, '#fff1c2', 0.3, 11);
        if (ci === 1) { G.FX.flash(x + f * 40, y - 80, 110, 0.25, '#ffd27a'); G.FX.ring(x + f * 50, y - 80, 6, 80, 0.25, '#ffd27a', 4); G.SFX.play('parry', false); }
        if (ci === 3) {   // a pillar of light falls on whatever stands in front
          let tx = x + f * 160;
          for (const e of g.enemies) if (!e.dead && Math.abs(e.y - y) < 140 && (e.x - x) * f > 0 && (e.x - x) * f < 360) { tx = e.x; break; }
          G.FX.beam(tx, y - 520, tx, y, '#ffd27a', 0.45, 46); G.FX.beam(tx, y - 520, tx, y, '#ffffff', 0.3, 14);
          G.FX.ring(tx, y - 4, 10, 140, 0.45, '#ffd27a', 6, { flat: 0.2 }); G.SFX.play('pylon', 1.5);
          this.area(P, { x: tx - 60, y: y - 200, w: 120, h: 200 }, 14, 20);
        }
      } else if (this.is('shaman')) {
        // the fan throws spirit wind; the finisher throws three
        // hold down / up while swinging to send the wind slanting down / up (reach a lower ledge, a flier above)
        const aim = G.Input.down('down') ? 1 : G.Input.down('up') ? -1 : 0;
        const gust = (vy, dmg, r) => g.projectiles.push({ x: x + f * 46, y: y - 66, vx: f * 720 * (aim ? 0.86 : 1), vy: vy * 0.7 + aim * 400, r, rh: aim ? r : 66, owner: null, friendly: true, kind: 'wind', pierce: true, hit: new Set(), pdmg: dmg, pbal: 6, life: 0.88, t: 0, col: '#c9b6ff' });
        if (ci === 3) { gust(-150, 9, 26); gust(0, 11, 32); gust(150, 9, 26); } else gust(0, [6, 7, 8][ci] || 7, 26);
        G.FX.ring(x, y - 2, 10, 70, 0.4, '#c9b6ff', 3, { flat: 0.25 }); G.FX.ring(x, y - 2, 6, 46, 0.4, '#f2e6cc', 2, { flat: 0.25 });   // the ritual circle
        G.SFX.play('musicbox', 1.6 + ci * 0.15);   // the shaman's bell
        for (let i = 0; i < 3; i++) G.FX.ember(x + f * 40, y - 80, 1, ['#f2e6cc', '#c9b6ff', '#d43b3f'][i], { w: 20, h: 20, up: 30 });
        G.SFX.play('whoosh', 1.3 + ci * 0.05);
      }
    },
    // a class flourish that strikes everything in a box (separate from the blade's own hit, so the same foe can take both)
    area(P, box, dmg, bal) {
      for (const e of G.game.enemies) {
        if (e.dead || e.state === 'spawn' || !U.rectsOverlap(box, e.box)) continue;
        const m = this.modHit(P, e, { dmg: dmg * P.dmgMul, bal, crit: false }, {});
        e.takeHit({ dmg: m.dmg, bal: m.bal, crit: m.crit, big: true, hx: e.cx, hy: e.cy, echo: true });
      }
    },
    // on every landed blow (melee): class-coloured impact, the rogue's shadow cut
    onHit(P, e, m, h) {
      if (!this.st() || (h && (h.noRes || h.echo))) return;
      const c = this.trailCol();
      G.FX.spark(e.cx, e.cy, 8, { col: c, speed: 520 });
      if (this.is('rogue')) (P.echoQ || (P.echoQ = [])).push({ t: 0.09, e, dmg: m.dmg * 0.45 });
      if (this.is('fighter')) G.FX.ember(e.cx, e.cy, 6, '#ff8f6b', { w: 30, h: 30, up: 50 });
      if (this.is('paladin')) G.FX.star(e.cx, e.cy - 10, '#fff1c2', 46, 0.3);
    },
    echoUpdate(P, dt) {
      const q = P.echoQ; if (!q || !q.length) return;
      for (let i = q.length - 1; i >= 0; i--) {
        const o = q[i]; o.t -= dt; if (o.t > 0) continue;
        q.splice(i, 1);
        if (o.e.dead) continue;
        o.e.takeHit({ dmg: o.dmg, bal: 3, hx: o.e.cx, hy: o.e.cy, echo: true });
        G.FX.slashMark(o.e.cx, o.e.cy - 10, Math.random() * Math.PI, 110, '#8dfcb0', 0.25, 6);
      }
    },

    /* ------------------------------------------------ class techniques (resonance skill 1; the shaman's skill 2) */
    SK: { fighter: 0.95, rogue: 0.5, paladin: 0.62, shaman: 0.62, summon: 0.55 },
    skillStart(P, kind) {
      const k = P.csk = kind || this.st().cls; P.csDone = 0; P.csLanded = 0; P.trail.clear();
      const mx = G.Input.moveX(); if (mx) P.facing = mx > 0 ? 1 : -1;
      if (k === 'fighter') { G.SFX.play('whoosh', 0.8); P.iframes = 0.15; }
      else if (k === 'rogue') { G.SFX.play('whoosh', 1.5); }
      else if (k === 'paladin') { P.iframes = 0.38; G.SFX.play('whoosh', 1.1); G.FX.flash(P.x, P.y - 70, 120, 0.3, '#ffd27a'); }
      else if (k === 'shaman') { G.SFX.play('cloth', 1.4); }
      else if (k === 'summon') { P.iframes = 0.4; G.SFX.play('pylon', 1.3); }
    },
    skillUpdate(P, dt) {
      const k = P.csk, st = P.st, g = G.game, f = P.facing;
      if (k === 'fighter') {
        // 裂地重斬: leap, then bring the blade down with everything; a shockwave both ways
        if (st < 0.12) P.vx = U.approach(P.vx, 0, 3000 * dt);
        else if (!P.csDone) { P.csDone = 1; P.vy = -720; P.vx = f * 280; P.onGround = false; }
        else if (P.csDone === 1 && st > 0.2 && P.onGround) {
          P.csDone = 2; P.csLanded = st; P.vx = 0;
          g.shake(1); g.hitstop(0.1); G.SFX.play('skill2'); G.SFX.play('impact');
          G.FX.ring(P.x + f * 40, P.y - 4, 10, 300, 0.6, '#ff8f6b', 9, { flat: 0.2 });
          G.FX.dust(P.x + f * 40, P.y, 30, { w: 200, speed: 360, size: 16 });
          G.FX.spark(P.x + f * 50, P.y - 10, 30, { col: '#ffd0b8', speed: 800, dir: -Math.PI / 2, spread: 2.4 });
          P.doHits({ abs: true, x: P.x - 240, y: P.y - 140, w: 480, h: 150 }, { dmg: 44, bal: 70, big: true, launch: true, noRes: true });
        }
        if (P.csDone === 2) P.vx = U.approach(P.vx, 0, 3000 * dt);
        if ((st >= this.SK.fighter && P.onGround) || st > 2.5) P.setState('move', 0.15);
      } else if (k === 'rogue') {
        // 飛刀: three knives in a quick fan
        P.vx = U.approach(P.vx, -f * 60, 2000 * dt);
        [0.1, 0.18, 0.26].forEach((t0, i) => {
          if (st >= t0 && P.csDone <= i) {
            P.csDone = i + 1;
            g.projectiles.push({ x: P.x + f * 30, y: P.y - 58, vx: f * 1150, vy: (i - 1) * 70, r: 9, rh: 22, owner: null, friendly: true, kind: 'knife', pdmg: 11, pbal: 9, life: 0.62, t: 0, col: '#8dfcb0' });
            G.SFX.play('slash', 1.6 + i * 0.1);
          }
        });
        if (st >= this.SK.rogue) P.setState('move', 0.1);
      } else if (k === 'paladin') {
        // 聖盾衝撞: charge behind the shield; whatever stands in front is knocked off balance
        if (st >= 0.08 && st < 0.34) {
          P.vx = f * 980;
          P.doHits({ x: 0, y: -150, w: 120, h: 150 }, { dmg: 22, bal: 85, big: true, noRes: true });
          if (Math.random() < 0.5) G.FX.ember(P.x + f * 30, P.y - 70, 2, '#ffd27a', { w: 30, h: 80, up: 40 });
        } else P.vx = U.approach(P.vx, 0, 5000 * dt);
        if (st >= this.SK.paladin) P.setState('move', 0.12);
      } else if (k === 'shaman') {
        // 靈風扇: one sweep of the fan sends a wall of spirit wind rolling forward (passes through foes)
        P.vx = U.approach(P.vx, 0, 2000 * dt);
        if (st >= 0.2 && !P.csDone) {
          P.csDone = 1;
          g.projectiles.push({ x: P.x + f * 40, y: P.y - 70, vx: f * 720, vy: 0, r: 34, rh: 70, owner: null, friendly: true, kind: 'wind', pierce: true, hit: new Set(), pdmg: 18, pbal: 22, life: 0.95, t: 0, col: '#c9b6ff' });
          G.SFX.play('whoosh', 0.9); G.FX.ring(P.x + f * 40, P.y - 70, 8, 90, 0.35, '#c9b6ff', 4);
        }
        if (st >= this.SK.shaman) P.setState('move', 0.12);
      } else {
        // 招魂: an ancestor's spirit rises at your shoulder and fights beside you for eight seconds
        if (st >= 0.3 && !P.csDone) {
          P.csDone = 1; P.spiritT = 8; P.spiritCd = 0.4;
          G.FX.ring(P.x, P.y - 90, 10, 160, 0.6, '#c9b6ff', 6); G.FX.ember(P.x, P.y - 60, 30, '#e2d6ff', { w: 60, h: 120, up: 120 });
        }
        if (st >= this.SK.summon) P.setState('move', 0.12);
      }
    },
    skillPose(P, A, Rig) {
      const k = P.csk, st = P.st, S = (an, t) => Rig.sample(an, Math.max(0, Math.min(an.dur, t)));
      if (k === 'fighter') return P.csDone < 2 ? S(A.heavy, Math.min(st, 0.3) * A.heavy.dur / 0.95) : S(A.heavy, A.heavy.dur * 0.42 + (st - P.csLanded));
      if (k === 'rogue') return S(A.light[1], st * A.light[1].dur / 0.5);
      if (k === 'paladin') return S(A.skill1, st * A.skill1.dur / 0.62);
      if (k === 'shaman') return S(A.light[2], st * A.light[2].dur / 0.62);
      return S(A.skill2, st * A.skill2.dur / 0.55);
    },
    // 劍巫: committed swings cannot be interrupted
    armored(P) { return this.is('fighter') && (P.state === 'heavy' || P.state === 'charge' || P.state === 'cskill'); },
    // 影行者: the dodge is a longer shadow step
    dodgeMul() { return this.is('rogue') ? 1.32 : 1; },
    // 守誓者: the shield takes the blow (less stamina, less chip) and you can advance behind it
    blockMul() { return this.is('paladin') ? 0.55 : 1; },
    guardWalk(P, mx, dt) { if (this.is('paladin') && mx) P.vx = U.approach(P.vx, mx * 120, 1400 * dt); },
    // 巫女: the closing fan stroke of the combo throws a small gust
    windlet(P) {
      if (!this.is('shaman')) return;
      G.game.projectiles.push({ x: P.x + P.facing * 50, y: P.y - 66, vx: P.facing * 620, vy: 0, r: 20, rh: 66, owner: null, friendly: true, kind: 'wind', pierce: true, hit: new Set(), pdmg: 7, pbal: 6, life: 0.42, t: 0, col: '#c9b6ff' });
    },
    // the summoned spirit: follows your shoulder and looses homing motes at the nearest foe
    spiritUpdate(P, dt) {
      if (!(P.spiritT > 0)) return;
      P.spiritT -= dt; P.spiritCd -= dt;
      const sx = P.x - P.facing * 46, sy = P.y - 150 + Math.sin(P.t * 3) * 6;
      P.spirit = { x: P.spirit ? U.lerp(P.spirit.x, sx, 0.15) : sx, y: P.spirit ? U.lerp(P.spirit.y, sy, 0.15) : sy };
      if (P.spiritCd <= 0) {
        let best = null, bd = 720;
        for (const e of G.game.enemies) { if (e.dead || e.state === 'spawn') continue; const d = Math.hypot(e.cx - P.spirit.x, e.cy - P.spirit.y); if (d < bd) { bd = d; best = e; } }
        if (best) {
          P.spiritCd = 0.7;
          const a = Math.atan2(best.cy - P.spirit.y, best.cx - P.spirit.x);
          G.game.projectiles.push({ x: P.spirit.x, y: P.spirit.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, r: 10, owner: best, friendly: true, kind: 'spirit', pdmg: 9, pbal: 10, life: 2, t: 0, col: '#e2d6ff' });
        } else P.spiritCd = 0.25;
      }
      if (P.spiritT <= 0) { G.FX.ember(P.spirit.x, P.spirit.y, 16, '#e2d6ff', { w: 30, h: 40, up: 80 }); P.spirit = null; }
    },
    drawSpirit(ctx, P) {
      const s = P.spirit; if (!s || !(P.spiritT > 0)) return;
      const a = Math.min(1, P.spiritT * 2, (8 - P.spiritT) * 3), t = P.t;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.85 * a;
      const gr = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 40); gr.addColorStop(0, 'rgba(226,214,255,.7)'); gr.addColorStop(1, 'rgba(201,182,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s.x, s.y, 40, 0, Math.PI * 2); ctx.fill();
      // a hooded ancestor: head, shoulders, and a robe that trails off into mist
      ctx.fillStyle = 'rgba(236,228,255,.85)';
      ctx.beginPath(); ctx.arc(s.x, s.y - 14, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(s.x - 12, s.y - 4); ctx.quadraticCurveTo(s.x, s.y - 12, s.x + 12, s.y - 4);
      ctx.quadraticCurveTo(s.x + 10 + Math.sin(t * 4) * 4, s.y + 18, s.x + Math.sin(t * 3) * 6, s.y + 34);
      ctx.quadraticCurveTo(s.x - 10 + Math.sin(t * 4 + 1) * 4, s.y + 18, s.x - 12, s.y - 4); ctx.fill();
      ctx.restore();
    },
    // what the free hand holds (paper doll): a shield, a second dagger, or a shaman's bell cluster
    offhand(look) {
      const c = this.st() && this.st().cls, wc = look && look.cls;
      if (c === 'paladin' && !['great', 'hammer', 'spear', 'scythe', 'axe'].includes(wc)) return 'shield';
      if (c === 'rogue' && ['twin', 'rapier', 'katana'].includes(wc)) return 'dagger';
      if (c === 'shaman' && !['great', 'hammer', 'axe'].includes(wc)) return 'bell';
      return null;
    },

    /* ------------------------------------------------ portraits */
    // the heroine in a class's colours and weapon, drawn with the game's own rig
    portrait(canvas, c, t = 0) {
      const C = CLASSES[c], ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H * 0.62, 10, W / 2, H * 0.62, W * 0.62);
      g.addColorStop(0, U.rgba(C.col, 0.32)); g.addColorStop(1, U.rgba(C.col, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save();
      const s = H / 200; ctx.translate(W / 2 - 6 * s, H * 0.97); ctx.scale(s, s);
      ctx.fillStyle = 'rgba(10,8,12,.45)'; ctx.beginPath(); ctx.ellipse(0, 0, 34, 5, 0, 0, Math.PI * 2); ctx.fill();
      try { G.Rig.drawRinne(ctx, 0, 0, 1, G.Rig.full(G.Rig.ANIM.idle(t)), null, { blade: C.look, outfit: { body: C.outfit }, offhand: { fighter: null, rogue: 'dagger', paladin: 'shield', shaman: 'bell' }[c] }); } catch (e) { /* rig not ready */ }
      ctx.restore();
    },
    // six-point radar of a score set (SVG)
    radar(attr, col, size = 150) {
      const c = size / 2, R = size * 0.36, pts = (f) => ATTRS.map((a, i) => { const ang = -Math.PI / 2 + i * Math.PI / 3, r = R * f(a); return `${(c + Math.cos(ang) * r).toFixed(1)},${(c + Math.sin(ang) * r).toFixed(1)}`; }).join(' ');
      const rings = [0.25, 0.5, 0.75, 1].map((k) => `<polygon points="${pts(() => k)}" class="rd-ring"/>`).join('');
      const labels = ATTRS.map((a, i) => { const ang = -Math.PI / 2 + i * Math.PI / 3; return `<text x="${(c + Math.cos(ang) * (R + 16)).toFixed(1)}" y="${(c + Math.sin(ang) * (R + 16) + 4).toFixed(1)}" text-anchor="middle">${a.name}</text>`; }).join('');
      return `<svg class="radar" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${rings}<polygon points="${pts((a) => attr[a.id] / MAXS)}" style="fill:${U.rgba(col, 0.28)};stroke:${col}"/>${labels}</svg>`;
    },

    /* ------------------------------------------------ the choice */
    chooseClass(sv, done, opts = {}) {
      let el = $('#classSel');
      if (!el) { el = document.createElement('section'); el.id = 'classSel'; el.className = 'screen modal'; document.getElementById('ui').appendChild(el); }
      let ci = 0;
      el.innerHTML = `<div class="cs"><header><p class="cs-k">${opts.returning ? '妳在燈台前醒來。在繼續之前——' : '在走進冥界之前——'}</p><h2>選擇妳的道路</h2></header>
        <div class="cs-cards">${ORDER.map((c, k) => { const C = CLASSES[c]; return `<button type="button" class="cs-card" data-k="${k}" style="--cc:${C.col}">
          <canvas class="cs-por" width="240" height="300"></canvas>
          <span class="cs-name">${G.Icons.svg(C.icon, 22)}<b>${C.name}</b><em>${C.en}</em></span>
          <span class="cs-style">${C.style}</span>${this.rangeHtml(c)}</button>`; }).join('')}</div>
        <div class="cs-detail"></div>
        <footer><button type="button" class="gb-act main cs-go">以這條道路出發</button></footer></div>`;
      const cards = [...el.querySelectorAll('.cs-card')];
      const detail = el.querySelector('.cs-detail');
      const render = () => {
        const c = ORDER[ci], C = CLASSES[c];
        cards.forEach((b, k) => b.classList.toggle('on', k === ci));
        detail.style.setProperty('--cc', C.col);
        detail.innerHTML = `<div class="cs-radar">${this.radar(C.base, C.col, 168)}</div>
          <div class="cs-txt"><p class="cs-line">${C.line}</p>
            <div class="cs-feat">${G.Icons.badge(C.icon, C.col, 44)}<div><b>${C.feature.name}</b><p>${C.feature.desc}</p></div></div>
            <ul class="cs-attrs">${ATTRS.map((a) => `<li style="--ac:${a.col}">${G.Icons.svg(a.id, 16)}<span>${a.name}</span><b>${C.base[a.id]}</b></li>`).join('')}</ul></div>`;
      };
      let t = 0, raf;
      const anim = () => { t += 1 / 60; cards.forEach((b, k) => this.portrait(b.querySelector('canvas'), ORDER[k], k === ci ? t : 0)); if (G.UI.top() && G.UI.top().id === 'classSel') raf = requestAnimationFrame(anim); };
      const go = () => {
        if (!(G.UI.top() && G.UI.top().id === 'classSel')) return;
        cancelAnimationFrame(raf);
        this.choose(sv, ORDER[ci]); G.SFX.play('pylon');
        G.UI.pop(); done && done(ORDER[ci]);
      };
      cards.forEach((b) => { b.onclick = () => { if (ci === +b.dataset.k) return; ci = +b.dataset.k; G.SFX.play('ui'); render(); }; b.ondblclick = go; });
      el.querySelector('.cs-go').onclick = go;
      render();
      G.UI.push({ id: 'classSel', el, handle: () => {
        const In = I();
        if (In.tap('menuLeft') || In.tap('left')) { ci = (ci + 3) % 4; G.SFX.play('ui'); render(); }
        else if (In.tap('menuRight') || In.tap('right')) { ci = (ci + 1) % 4; G.SFX.play('ui'); render(); }
        else if (In.tap('confirm')) go();
      } });
      anim();
    },

    /* ------------------------------------------------ character sheet */
    openSheet() {
      const g = G.game, sv = g.save, d = this.st(sv); if (!d) return;
      const C = CLASSES[d.cls], P = g.player;
      let el = $('#charSheet');
      if (!el) { el = document.createElement('section'); el.id = 'charSheet'; el.className = 'screen modal'; document.getElementById('ui').appendChild(el); }
      el.innerHTML = `<div class="sheet" style="--cc:${C.col}"><header class="gr-head"><div class="gr-title"><b>角色</b><em>CHARACTER</em></div><button type="button" class="x-close sh-close" aria-label="關閉">✕</button></header>
        <div class="sh-body"><div class="sh-left"><canvas class="sh-por" width="260" height="320"></canvas><p class="sh-cls">${G.Icons.svg(C.icon, 20)}${C.name}<em>${C.en}</em></p>${this.radar(d.attr, C.col, 170)}</div>
        <div class="sh-right"><ul class="sh-attrs">${ATTRS.map((a) => { const s = d.attr[a.id], m = this.mod(a.id); return `<li style="--ac:${a.col}">${G.Icons.badge(a.id, a.col, 38)}<div><p><b>${a.name}</b><span>${s}</span><em>${m >= 0 ? '+' + m : m}</em></p><small>${a.fx(m)}</small></div></li>`; }).join('')}</ul>
        <div class="sh-feat">${G.Icons.badge(C.icon, C.col, 40)}<div><b>${C.feature.name}</b><p>${C.feature.desc}</p></div></div>
        <p class="sh-stats">生命 ${P.maxHp}　耐力 ${Math.round(P.maxSta)}　攻擊倍率 ×${P.dmgMul.toFixed(2)}　調和劑 ${P.maxTonic}</p>
        <p class="sh-hint">屬性可以在魂燈台的「調校」用碎片提升。</p></div></div></div>`;
      let t = 0, raf; const por = el.querySelector('.sh-por');
      const anim = () => { t += 1 / 60; this.portrait(por, d.cls, t); if (G.UI.top() && G.UI.top().id === 'charSheet') raf = requestAnimationFrame(anim); };
      const close = () => { if (G.UI.top() && G.UI.top().id === 'charSheet') { cancelAnimationFrame(raf); G.SFX.play('uiBack'); G.UI.pop(); } };
      el.querySelector('.sh-close').onclick = close;
      G.UI.push({ id: 'charSheet', el, handle: () => { if (I().tap('back') || I().tap('confirm')) close(); } });
      anim();
    },
  };
})(window.G);

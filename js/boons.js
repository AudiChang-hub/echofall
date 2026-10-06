'use strict';
/* ECHOFALL — 共鳴回響 (Echoes), modelled on Hades' boons.
   · after a fight: choose 1 of 3 (4 with the Mirror's 合唱) Echoes; each card rolls a rarity
     (普通 / 稀有 / 史詩 / 傳說) that multiplies its numbers — a better copy of an owned Echo upgrades its rarity
   · 殘響果實 (Hades' Pom of Power): sometimes the reward is a fruit that levels up one Echo you already have
   · 雙重共鳴 (duo boons): owning both halves of a pair can unlock a stronger combined Echo
   save.boons[id] = level, save.boonR[id] = rarity index. */
(function (G) {
  const U = G.U, PI = Math.PI;
  const RARITY = [
    { name: '普通', en: 'COMMON', col: '#d9d4cc', mul: 1 },
    { name: '稀有', en: 'RARE', col: '#6fb7ff', mul: 1.3 },
    { name: '史詩', en: 'EPIC', col: '#c08bff', mul: 1.6 },
    { name: '傳說', en: 'LEGENDARY', col: '#ffb347', mul: 2.0 },
  ];
  const n = (v) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toString();
  // v: value per level (index = level); desc(l, m) shows the numbers for level l at rarity multiplier m
  const DEFS = G.ECHOES = {
    echoSlash: { name: '迴響斬', en: 'ECHO SLASH', col: '#7ff4ff', icon: '⟋', max: 3, v: [0, 12, 18, 24], desc: (l, m = 1) => `每第 3 下攻擊放出一道穿透劍氣，造成 <b>${n([0, 12, 18, 24][l] * m)}</b> 傷害` },
    thunder: { name: '雷弦', en: 'THUNDER STRING', col: '#ffe066', icon: 'ϟ', max: 3, v: [0, 25, 35, 45], desc: (l, m = 1) => `命中時 <b>${n(Math.min(80, [0, 25, 35, 45][l] * m))}%</b> 機率引發連鎖雷擊，彈到附近 2 名敵人（${n([0, 8, 11, 14][l] * m)} 傷害）` },
    afterimage: { name: '殘影', en: 'AFTERIMAGE', col: '#c9a2ff', icon: '◈', max: 3, v: [0, 16, 24, 32], desc: (l, m = 1) => `閃避時留下殘影，0.45 秒後爆炸，造成 <b>${n([0, 16, 24, 32][l] * m)}</b> 傷害` },
    ward: { name: '共鳴盾', en: 'RESONANT WARD', col: '#9cf7d8', icon: '◎', max: 3, v: [0, 20, 30, 40], desc: (l, m = 1) => `完美閃避釋放衝擊波，周圍敵人受到 <b>${n([0, 20, 30, 40][l] * m)}</b> 傷害並被擊退` },
    leech: { name: '血契', en: 'BLOOD PACT', col: '#ff5d6e', icon: '♥', max: 3, v: [0, 1, 1.5, 2], desc: (l, m = 1) => `每次命中回復 <b>${n([0, 1, 1.5, 2][l] * m)}</b> 點生命` },
    crit: { name: '漸強', en: 'CRESCENDO', col: '#ffb347', icon: '✦', max: 3, v: [0, 12, 18, 25], desc: (l, m = 1) => `攻擊有 <b>${n(Math.min(60, [0, 12, 18, 25][l] * m))}%</b> 機率暴擊，造成 2 倍傷害` },
    shatter: { name: '破韻', en: 'BROKEN METER', col: '#ffd27a', icon: '✕', max: 3, v: [0, 35, 60, 85], desc: (l, m = 1) => `失衡傷害 <b>+${n([0, 35, 60, 85][l] * m)}%</b>，更快打出處決` },
    tempo: { name: '急奏', en: 'ACCELERANDO', col: '#7fb8ff', icon: '»', max: 3, v: [0, 12, 20, 28], desc: (l, m = 1) => `攻擊速度 <b>+${n([0, 12, 20, 28][l] * m)}%</b>` },
    gale: { name: '疾風', en: 'GALE', col: '#b8ffea', icon: '≋', max: 2, v: [0, 12, 22], desc: (l, m = 1) => `移動速度 <b>+${n([0, 12, 22][l] * m)}%</b>，閃避距離 +${n([0, 15, 28][l] * m)}%` },
    resonance: { name: '共振', en: 'SYMPATHY', col: '#6ff3ff', icon: '◇', max: 2, v: [0, 40, 75], desc: (l, m = 1) => `共鳴累積 <b>+${n([0, 40, 75][l] * m)}%</b>，更快施放技能` },
    defiance: { name: '不屈', en: 'DEFIANCE', col: '#ffffff', icon: '✚', max: 1, v: [0, 30], desc: (l, m = 1) => `每次休息或復活後，抵擋<b>一次致命傷害</b>並保留 ${n(30 * m)}% 生命` },
  };
  // duo Echoes: need both halves; always max level 1, shown in green
  const DUOS = G.ECHO_DUOS = {
    duo_storm: { name: '雷霆殘影', en: 'STORM AFTERIMAGE', col: '#8dfcb0', icon: '⚡', req: ['thunder', 'afterimage'], desc: () => '殘影爆炸時引發<b>連鎖雷擊</b>，彈射 3 名敵人' },
    duo_bloodbolt: { name: '血雷', en: 'BLOOD BOLT', col: '#8dfcb0', icon: '☇', req: ['thunder', 'leech'], desc: () => '每道連鎖雷擊命中時<b>回復 2 點生命</b>' },
    duo_allegro: { name: '疾奏', en: 'ALLEGRO', col: '#8dfcb0', icon: '≫', req: ['tempo', 'gale'], desc: () => '閃避後 1 秒內，攻擊速度再 <b>+30%</b>' },
    duo_breaker: { name: '碎譜漸強', en: 'SHATTERING CRESCENDO', col: '#8dfcb0', icon: '✸', req: ['crit', 'shatter'], desc: () => '暴擊造成<b>三倍失衡傷害</b>' },
    duo_chorus: { name: '共振斬', en: 'RESONANT WAVE', col: '#8dfcb0', icon: '〰', req: ['echoSlash', 'resonance'], desc: () => '迴響斬命中時回復 <b>5 共鳴</b>' },
    duo_bastion: { name: '不破之盾', en: 'UNBROKEN WARD', col: '#8dfcb0', icon: '⛨', req: ['ward', 'defiance'], desc: () => '完美閃避後 2 秒內<b>受到的傷害減半</b>' },
  };
  const ALL = Object.assign({}, DEFS, DUOS);

  const B = G.Boons = {
    waves: [], bombs: [], later: [], lightN: 0, RARITY,
    get save() { const s = G.game.save; if (!s.boons) s.boons = {}; return s.boons; },
    get rar() { const s = G.game.save; if (!s.boonR) s.boonR = {}; return s.boonR; },
    lv(id) { const g = G.game; return (g && g.save && g.save.boons && g.save.boons[id]) || 0; },
    mul(id) { const g = G.game, r = (g && g.save && g.save.boonR && g.save.boonR[id]) || 0; return RARITY[r].mul; },
    // value of an Echo at its current level and rarity
    val(id, table) { return (table || DEFS[id].v)[this.lv(id)] * this.mul(id); },
    has(id) { return this.lv(id) > 0; },
    clear() { this.waves.length = 0; this.bombs.length = 0; this.later.length = 0; this.lightN = 0; },

    /* ---------- passive modifiers ---------- */
    runMul() { return 1 + this.val('gale') / 100; },
    dodgeMul() { return 1 + this.val('gale', [0, 15, 28]) / 100; },
    atkSpeed() {
      const P = G.game && G.game.player;
      return 1 + this.val('tempo') / 100 + (this.has('duo_allegro') && P && P.allegroT > 0 ? 0.3 : 0);
    },
    resMul() { return 1 + this.val('resonance') / 100; },

    /* ---------- combat hooks (called from Player) ---------- */
    modHit(P, e, h) {
      let dmg = h.dmg * P.dmgMul, bal = h.bal * (1 + this.val('shatter') / 100), crit = false;
      const cc = Math.min(0.6, this.val('crit') / 100);
      if (cc && Math.random() < cc) { dmg *= 2; crit = true; }
      if (crit && this.has('duo_breaker')) bal *= 3;
      // Mirror of Echoes: 背刺 (strike a foe that faces away) / 反擊之刃 (first hit after a perfect dodge — it carries what the parry used to) / 澄明 (crit after a perfect dodge)
      const M = G.Mirror;
      if (M) {
        const bs = M.lv('backstab'); if (bs && e.facing === Math.sign(e.x - P.x)) dmg *= 1 + 0.35 * bs;
        const rp = M.lv('riposte'); if (rp && P.riposteT > 0) { dmg *= 1 + 0.6 * rp; P.riposteT = 0; }
        if (M.lv('clarity') && P.critNext && !crit) { dmg *= 2; crit = true; P.critNext = false; }
      }
      return { dmg, bal, crit };
    },
    afterHit(P, e, m) {
      if (m.crit) { G.FX.star(e.cx, e.cy - 20, '#ffb347', 80, 0.35); G.SFX.play('hit', 1.4); }
      if (this.has('leech')) P.hp = Math.min(P.maxHp, P.hp + this.val('leech'));
      if (this.has('thunder') && Math.random() < Math.min(0.8, this.val('thunder') / 100)) this.chain(e, Math.round(this.val('thunder', [0, 8, 11, 14])));
    },
    onLight(P) {
      if (!this.has('echoSlash')) return;
      this.lightN++;
      if (this.lightN % 3 === 0) {
        const dmg = Math.round(this.val('echoSlash'));
        // released on game time (respects hitstop / pause), just as the swing connects
        this.later.push({ t: 0.11, fn: () => { if (P.state !== 'dead') this.wave(P.x + P.facing * 40, P.y - 78, P.facing, dmg); } });
      }
    },
    onDodge(P) {
      if (this.has('duo_allegro')) P.allegroT = 1;
      if (!this.has('afterimage')) return;
      G.FX.ghost({ x: P.x, y: P.y, facing: P.facing, pose: Object.assign({}, P.pose) }, '#c9a2ff', 0.5, 0.85);
      this.bombs.push({ x: P.x, y: P.y - 60, t: 0, dmg: Math.round(this.val('afterimage')) });
    },
    onParry(P) {
      const M = G.Mirror;
      if (M && M.lv('riposte')) P.riposteT = 2;
      if (this.has('duo_bastion')) P.bastionT = 2;
      if (!this.has('ward')) return;
      const x = P.x, y = P.y - 70, dmg = Math.round(this.val('ward'));
      G.FX.ring(x, y, 20, 190, 0.5, '#9cf7d8', 8); G.FX.flash(x, y, 160, 0.3, '#9cf7d8');
      this.area(x, y, 180, dmg, 14, true);
    },
    // returns true when a fatal blow was refused (Echo 不屈, then the Mirror's 不屈之心)
    onLethal(P) {
      if (this.has('defiance') && P.defyReady) {
        P.defyReady = false; return this.refuse(P, Math.min(0.6, 0.3 * this.mul('defiance')), '不屈：抵擋了致命一擊');
      }
      if (G.Mirror && G.Mirror.lv('defy') && P.mirrorDefy) {
        P.mirrorDefy = false; return this.refuse(P, 0.4, '不屈之心：抵擋了致命一擊');
      }
      return false;
    },
    refuse(P, frac, msg) {
      P.hp = Math.round(P.maxHp * frac); P.hurtInv = 1.2;
      G.FX.ring(P.x, P.y - 60, 10, 220, 0.7, '#ffffff', 8); G.FX.star(P.x, P.y - 70, '#ffffff', 140, 0.6);
      G.SFX.play('parry', true); G.game.slowmo(0.6, 0.3); G.game.toast(msg, 'item');
      return true;
    },
    // damage the player takes is softened by 不破之盾 right after a perfect dodge
    dmgTakenMul(P) { return this.has('duo_bastion') && P.bastionT > 0 ? 0.5 : 1; },

    /* ---------- effects ---------- */
    wave(x, y, dir, dmg) {
      this.waves.push({ x, y, dir, dmg, t: 0, hit: new Set() });
      G.SFX.play('whoosh', 1.7);
    },
    chain(from, dmg, hops = 2) {
      const g = G.game; let src = from; const done = new Set([from]);
      for (let k = 0; k < hops; k++) {
        let best = null, bd = 340;
        for (const e of g.enemies) { if (e.dead || done.has(e)) continue; const d = Math.hypot(e.cx - src.cx, e.cy - src.cy); if (d < bd) { bd = d; best = e; } }
        if (!best) break;
        const mx = (src.cx + best.cx) / 2 + (Math.random() - 0.5) * 40, my = (src.cy + best.cy) / 2 - 20 - Math.random() * 30;
        G.FX.beam(src.cx, src.cy, mx, my, '#ffe066', 0.22, 6); G.FX.beam(mx, my, best.cx, best.cy, '#ffe066', 0.22, 6);
        best.takeHit({ dmg, bal: 4, hx: best.cx, hy: best.cy, kbx: Math.sign(best.x - src.x) * 60, boon: true });
        if (this.has('duo_bloodbolt')) { const P = g.player; P.hp = Math.min(P.maxHp, P.hp + 2); }
        done.add(best); src = best;
      }
      if (done.size > 1) { G.SFX.play('tellWhite'); G.FX.flash(from.cx, from.cy, 70, 0.15, '#ffe066'); }
    },
    area(x, y, r, dmg, bal, push) {
      for (const e of G.game.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.cx - x, e.cy - y) > r + e.w / 2) continue;
        e.takeHit({ dmg, bal, big: true, hx: e.cx, hy: e.cy, kbx: push ? Math.sign(e.x - x || 1) * 340 : 0, boon: true });
      }
    },
    update(dt) {
      const g = G.game, P = g.player;
      if (P) { P.allegroT = Math.max(0, (P.allegroT || 0) - dt); P.bastionT = Math.max(0, (P.bastionT || 0) - dt); P.riposteT = Math.max(0, (P.riposteT || 0) - dt); }
      for (let i = this.later.length - 1; i >= 0; i--) { const l = this.later[i]; l.t -= dt; if (l.t <= 0) { this.later.splice(i, 1); l.fn(); } }
      for (let i = this.waves.length - 1; i >= 0; i--) {
        const w = this.waves[i];
        w.t += dt; w.x += w.dir * 980 * dt;
        const box = { x: w.x - 34, y: w.y - 60, w: 68, h: 110 };
        for (const e of g.enemies) {
          if (e.dead || w.hit.has(e) || !U.rectsOverlap(box, e.box)) continue;
          w.hit.add(e);
          e.takeHit({ dmg: w.dmg, bal: 6, hx: e.cx, hy: w.y, kbx: w.dir * 140, boon: true });
          if (this.has('duo_chorus') && P) P.gainRes(5);
          g.hitstop(0.03);
        }
        if (w.t > 0.5 || G.Phys.solidAt && G.Phys.solidAt(w.x, w.y)) this.waves.splice(i, 1);
      }
      for (let i = this.bombs.length - 1; i >= 0; i--) {
        const b = this.bombs[i]; b.t += dt;
        if (b.t >= 0.45) {
          G.FX.ring(b.x, b.y, 10, 130, 0.45, '#c9a2ff', 7); G.FX.flash(b.x, b.y, 140, 0.25, '#c9a2ff');
          G.FX.spark(b.x, b.y, 18, { col: '#e6d4ff', speed: 700 });
          G.SFX.play('hit', 0.7); g.shake(0.25);
          this.area(b.x, b.y, 120, b.dmg, 10, true);
          if (this.has('duo_storm')) { const near = g.enemies.find((e) => !e.dead && Math.hypot(e.cx - b.x, e.cy - b.y) < 260); if (near) this.chain(near, Math.round(b.dmg * 0.6), 3); }
          this.bombs.splice(i, 1);
        }
      }
    },
    draw(ctx) {
      if (!this.waves.length && !this.bombs.length) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const w of this.waves) {
        const k = 1 - w.t / 0.5;
        ctx.save(); ctx.translate(w.x, w.y); ctx.scale(w.dir, 1);
        for (const [r, a, lw] of [[62, 0.25, 16], [58, 0.9, 4]]) {
          ctx.strokeStyle = U.rgba('#7ff4ff', a * k); ctx.lineWidth = lw; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(-34, 0, r, -0.95, 0.95); ctx.stroke();
        }
        ctx.strokeStyle = U.rgba('#ffffff', k); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(-34, 0, 56, -0.8, 0.8); ctx.stroke();
        ctx.restore();
      }
      for (const b of this.bombs) {
        const k = b.t / 0.45, r = 18 + 30 * k;
        ctx.strokeStyle = U.rgba('#c9a2ff', 0.4 + 0.5 * k); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, PI * 2); ctx.stroke();
      }
      ctx.restore();
    },

    /* ---------- the reward ---------- */
    rollRarity() {
      // the Mirror's 幸運 shifts the odds toward rarer cards
      const luck = (G.Mirror && G.Mirror.lv('luck')) || 0, r = Math.random() / (1 + luck * 0.35);
      return r < 0.05 ? 3 : r < 0.17 ? 2 : r < 0.42 ? 1 : 0;
    },
    pool() {
      const s = this.save;
      return Object.keys(DEFS).filter((id) => (s[id] || 0) < DEFS[id].max);
    },
    duoPool() { return Object.keys(DUOS).filter((id) => !this.has(id) && DUOS[id].req.every((q) => this.has(q))); },
    card(id, kind, r) {
      const d = ALL[id], s = this.save, cur = s[id] || 0, curR = this.rar[id] || 0;
      if (kind === 'duo') return { id, kind, def: d, lv: 1, r: -1, tag: '雙重 DUO', col: d.col, desc: d.desc(1) };
      if (kind === 'fruit') {
        const m = RARITY[curR].mul;
        return { id, kind, def: d, lv: cur + 1, r: curR, tag: `果實　Lv ${cur} → ${cur + 1}`, col: d.col, desc: d.desc(cur + 1, m) };
      }
      const lv = Math.max(1, cur), rr = Math.max(r, cur ? curR : 0), m = RARITY[rr].mul;
      const tag = cur ? (r > curR ? `${RARITY[r].name}　品質提升` : `Lv ${cur} → ${cur + 1}`) : `${RARITY[r].name}　新 NEW`;
      return { id, kind, def: d, lv: cur ? (r > curR ? cur : cur + 1) : 1, r: rr, tag, col: d.col, rcol: RARITY[rr].col, desc: d.desc(cur ? (r > curR ? cur : cur + 1) : 1, m) };
    },
    offer(cb, opts) {
      const s = this.save, owned = Object.keys(DEFS).filter((id) => s[id] && s[id] < DEFS[id].max);
      const count = 3 + ((G.Mirror && G.Mirror.lv('chorus')) || 0);
      let cards;
      if (owned.length && ((opts && opts.fruit) || (owned.length >= 2 && Math.random() < 0.22))) {
        // 殘響果實: level up one Echo you already have
        const picks = owned.sort(() => Math.random() - 0.5).slice(0, Math.min(count, owned.length));
        cards = picks.map((id) => this.card(id, 'fruit'));
      } else {
        const pool = this.pool();
        if (!pool.length && !this.duoPool().length) { cb && cb(); return; }
        // owned Echoes come up a little more often so builds can deepen
        const picks = [], bag = pool.flatMap((id) => (s[id] ? [id, id] : [id]));
        while (picks.length < Math.min(count, pool.length)) { const id = bag[Math.floor(Math.random() * bag.length)]; if (!picks.includes(id)) picks.push(id); }
        cards = picks.map((id) => this.card(id, 'echo', this.rollRarity()));
        const duos = this.duoPool();
        if (duos.length && Math.random() < 0.45) {
          const duo = this.card(duos[Math.floor(Math.random() * duos.length)], 'duo');
          if (cards.length >= count) cards[cards.length - 1] = duo; else cards.push(duo);
        }
      }
      G.UI.boonPick(cards, (id) => {
        const c = cards.find((q) => q.id === id) || cards[0];
        if (c.kind === 'duo') s[id] = 1;
        else if (c.kind === 'fruit') s[id] = Math.min(ALL[id].max, (s[id] || 0) + 1);
        else {
          const cur = s[id] || 0, curR = this.rar[id] || 0;
          if (cur && c.r > curR && c.lv === cur) this.rar[id] = c.r;          // a rarer copy upgrades the Echo's rarity
          else { s[id] = Math.min(DEFS[id].max, cur + 1); this.rar[id] = Math.max(curR, c.r); }
        }
        G.game.player.recalc();
        G.game.persist && G.game.persist();
        cb && cb(id);
      });
    },
  };
  B.ALL = ALL;
})(window.G);

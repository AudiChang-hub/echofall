'use strict';
/* ECHOFALL — 共鳴回響 (Echoes): after first clearing a fight, pick 1 of 3 powers that reshape how Rinne fights.
   Hades/Dead Cells-style build variety: every journey grows a different kit. Levels stack when an owned Echo is offered again. */
(function (G) {
  const U = G.U, PI = Math.PI;
  const DEFS = G.ECHOES = {
    echoSlash: { name: '迴響斬', en: 'ECHO SLASH', col: '#7ff4ff', icon: '⟋', max: 3, desc: (l) => `每第 3 下攻擊放出一道穿透劍氣，造成 <b>${[0, 12, 18, 24][l]}</b> 傷害` },
    thunder: { name: '雷弦', en: 'THUNDER STRING', col: '#ffe066', icon: 'ϟ', max: 3, desc: (l) => `命中時 <b>${[0, 25, 35, 45][l]}%</b> 機率引發連鎖雷擊，彈到附近 2 名敵人（${[0, 8, 11, 14][l]} 傷害）` },
    afterimage: { name: '殘影', en: 'AFTERIMAGE', col: '#c9a2ff', icon: '◈', max: 3, desc: (l) => `閃避時留下殘影，0.45 秒後爆炸，造成 <b>${[0, 16, 24, 32][l]}</b> 傷害` },
    ward: { name: '共鳴盾', en: 'RESONANT WARD', col: '#9cf7d8', icon: '◎', max: 3, desc: (l) => `完美格擋釋放衝擊波，周圍敵人受到 <b>${[0, 20, 30, 40][l]}</b> 傷害並被擊退` },
    leech: { name: '血契', en: 'BLOOD PACT', col: '#ff5d6e', icon: '♥', max: 3, desc: (l) => `每次命中回復 <b>${[0, 1, 1.5, 2][l]}</b> 點生命` },
    crit: { name: '漸強', en: 'CRESCENDO', col: '#ffb347', icon: '✦', max: 3, desc: (l) => `攻擊有 <b>${[0, 12, 18, 25][l]}%</b> 機率暴擊，造成 2 倍傷害` },
    shatter: { name: '破韻', en: 'BROKEN METER', col: '#ffd27a', icon: '✕', max: 3, desc: (l) => `失衡傷害 <b>+${[0, 35, 60, 85][l]}%</b>，更快打出處決` },
    tempo: { name: '急奏', en: 'ACCELERANDO', col: '#7fb8ff', icon: '»', max: 3, desc: (l) => `攻擊速度 <b>+${[0, 12, 20, 28][l]}%</b>` },
    gale: { name: '疾風', en: 'GALE', col: '#b8ffea', icon: '≋', max: 2, desc: (l) => `移動速度 <b>+${[0, 12, 22][l]}%</b>，閃避距離 +${[0, 15, 28][l]}%` },
    resonance: { name: '共振', en: 'SYMPATHY', col: '#6ff3ff', icon: '◇', max: 2, desc: (l) => `共鳴累積 <b>+${[0, 40, 75][l]}%</b>，更快施放技能` },
    defiance: { name: '不屈', en: 'DEFIANCE', col: '#ffffff', icon: '✚', max: 1, desc: () => '每次休息或復活後，抵擋<b>一次致命傷害</b>並保留 30% 生命' },
  };

  const B = G.Boons = {
    waves: [], bombs: [], later: [], lightN: 0,
    get save() { const s = G.game.save; if (!s.boons) s.boons = {}; return s.boons; },
    lv(id) { const g = G.game; return (g && g.save && g.save.boons && g.save.boons[id]) || 0; },
    clear() { this.waves.length = 0; this.bombs.length = 0; this.later.length = 0; this.lightN = 0; },

    /* ---------- passive modifiers ---------- */
    runMul() { return 1 + [0, 0.12, 0.22][this.lv('gale')]; },
    dodgeMul() { return 1 + [0, 0.15, 0.28][this.lv('gale')]; },
    atkSpeed() { return 1 + [0, 0.12, 0.2, 0.28][this.lv('tempo')]; },
    resMul() { return 1 + [0, 0.4, 0.75][this.lv('resonance')]; },

    /* ---------- combat hooks (called from Player) ---------- */
    modHit(P, e, h) {
      let dmg = h.dmg * P.dmgMul, bal = h.bal * (1 + [0, 0.35, 0.6, 0.85][this.lv('shatter')]), crit = false;
      const cc = [0, 0.12, 0.18, 0.25][this.lv('crit')];
      if (cc && Math.random() < cc) { dmg *= 2; crit = true; }
      return { dmg, bal, crit };
    },
    afterHit(P, e, m) {
      const g = G.game;
      if (m.crit) { G.FX.star(e.cx, e.cy - 20, '#ffb347', 80, 0.35); G.SFX.play('hit', 1.4); }
      const ll = this.lv('leech');
      if (ll) P.hp = Math.min(P.maxHp, P.hp + [0, 1, 1.5, 2][ll]);
      const tl = this.lv('thunder');
      if (tl && Math.random() < [0, 0.25, 0.35, 0.45][tl]) this.chain(e, [0, 8, 11, 14][tl]);
      void g;
    },
    onLight(P) {
      if (!this.lv('echoSlash')) return;
      this.lightN++;
      if (this.lightN % 3 === 0) {
        const dmg = [0, 12, 18, 24][this.lv('echoSlash')];
        // released on game time (respects hitstop / pause), just as the swing connects
        this.later.push({ t: 0.11, fn: () => { if (P.state !== 'dead') this.wave(P.x + P.facing * 40, P.y - 78, P.facing, dmg); } });
      }
    },
    onDodge(P) {
      const l = this.lv('afterimage'); if (!l) return;
      G.FX.ghost({ x: P.x, y: P.y, facing: P.facing, pose: Object.assign({}, P.pose) }, '#c9a2ff', 0.5, 0.85);
      this.bombs.push({ x: P.x, y: P.y - 60, t: 0, dmg: [0, 16, 24, 32][l] });
    },
    onParry(P) {
      const l = this.lv('ward'); if (!l) return;
      const x = P.x, y = P.y - 70, dmg = [0, 20, 30, 40][l];
      G.FX.ring(x, y, 20, 190, 0.5, '#9cf7d8', 8); G.FX.flash(x, y, 160, 0.3, '#9cf7d8');
      this.area(x, y, 180, dmg, 14, true);
    },
    // returns true when a fatal blow was refused
    onLethal(P) {
      if (!this.lv('defiance') || !P.defyReady) return false;
      P.defyReady = false; P.hp = Math.round(P.maxHp * 0.3); P.hurtInv = 1.2;
      G.FX.ring(P.x, P.y - 60, 10, 220, 0.7, '#ffffff', 8); G.FX.star(P.x, P.y - 70, '#ffffff', 140, 0.6);
      G.SFX.play('parry', true); G.game.slowmo(0.6, 0.3); G.game.toast('不屈：抵擋了致命一擊', 'item');
      return true;
    },

    /* ---------- effects ---------- */
    wave(x, y, dir, dmg) {
      this.waves.push({ x, y, dir, dmg, t: 0, hit: new Set() });
      G.SFX.play('whoosh', 1.7);
    },
    chain(from, dmg) {
      const g = G.game; let src = from; const done = new Set([from]);
      for (let k = 0; k < 2; k++) {
        let best = null, bd = 340;
        for (const e of g.enemies) { if (e.dead || done.has(e)) continue; const d = Math.hypot(e.cx - src.cx, e.cy - src.cy); if (d < bd) { bd = d; best = e; } }
        if (!best) break;
        const mx = (src.cx + best.cx) / 2 + (Math.random() - 0.5) * 40, my = (src.cy + best.cy) / 2 - 20 - Math.random() * 30;
        G.FX.beam(src.cx, src.cy, mx, my, '#ffe066', 0.22, 6); G.FX.beam(mx, my, best.cx, best.cy, '#ffe066', 0.22, 6);
        best.takeHit({ dmg, bal: 4, hx: best.cx, hy: best.cy, kbx: Math.sign(best.x - src.x) * 60, boon: true });
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
      const g = G.game;
      for (let i = this.later.length - 1; i >= 0; i--) { const l = this.later[i]; l.t -= dt; if (l.t <= 0) { this.later.splice(i, 1); l.fn(); } }
      for (let i = this.waves.length - 1; i >= 0; i--) {
        const w = this.waves[i];
        w.t += dt; w.x += w.dir * 980 * dt;
        const box = { x: w.x - 34, y: w.y - 60, w: 68, h: 110 };
        for (const e of g.enemies) {
          if (e.dead || w.hit.has(e) || !U.rectsOverlap(box, e.box)) continue;
          w.hit.add(e);
          e.takeHit({ dmg: w.dmg, bal: 6, hx: e.cx, hy: w.y, kbx: w.dir * 140, boon: true });
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

    /* ---------- the choice ---------- */
    pool() {
      const s = this.save;
      return Object.keys(DEFS).filter((id) => (s[id] || 0) < DEFS[id].max);
    },
    offer(cb) {
      const pool = this.pool();
      if (!pool.length) { cb && cb(); return; }
      // three distinct picks; owned Echoes come up a little more often so builds can deepen
      const picks = [], bag = pool.flatMap((id) => (this.save[id] ? [id, id] : [id]));
      while (picks.length < Math.min(3, pool.length)) { const id = bag[Math.floor(Math.random() * bag.length)]; if (!picks.includes(id)) picks.push(id); }
      G.UI.boonPick(picks.map((id) => ({ id, lv: (this.save[id] || 0) + 1, def: DEFS[id] })), (id) => {
        this.save[id] = (this.save[id] || 0) + 1;
        G.game.player.recalc();
        G.game.persist && G.game.persist();
        cb && cb(id);
      });
    },
  };
})(window.G);

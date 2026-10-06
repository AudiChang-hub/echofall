'use strict';
/* ECHOFALL — interactive combat training (Ode projects a "training phantom" at the crash site).
   Ten short steps, each checked by what the player actually does; skippable at any time. */
(function (G) {
  const K = G.EnemyKit, U = G.U;
  const TX0 = 250, TX1 = 735; // training ground (left of the wrecked car at x 760)

  /* ---------- the phantom: a hologram sentinel whose attacks are slow, readable and almost harmless ---------- */
  const SP = K.SP;
  K.TYPES.phantom = {
    name: '訓練幻影', w: 40, h: 150, hp: 99999, bal: 60, col: '#7ff4ff', shards: 0, scale: 1.1, spawnT: 0.6, kbMul: 0.4,
    weapon: (e) => { const J = e.J, s = 1.1; return J ? { x: e.x + e.facing * J.btip.x * s, y: e.y + J.btip.y * s } : { x: e.x, y: e.y - 120 }; },
    think(e, dt) {
      e.faceP();
      const d = e.distP(), want = 120;
      if (d > want + 50) e.vx = U.approach(e.vx, e.facing * 120, 900 * dt);
      else if (d < want - 50) e.vx = U.approach(e.vx, -e.facing * 90, 900 * dt);
      else e.vx = U.approach(e.vx, 0, 900 * dt);
      const mode = Tut.attackMode();
      if (mode && e.cd <= 0 && d < 260) e.startAtk(mode === 'red' ? K.TYPES.phantom.thrust : K.TYPES.phantom.slash);
    },
    // one slow, clearly telegraphed white slash (tell → impact = 0.75 s)
    slash: {
      dur: 1.7, cd: 1.6, tells: [{ t: 0.3, c: 'white' }],
      poses: { dur: 1.7, keys: [[0, SP.idle(0)], [0.95, SP.slashA], [1.08, SP.slashB, 'snap'], [1.7, SP.idle(0), 'io']] },
      moves: [{ t0: 0.95, t1: 1.05, v: 160 }],
      hits: [{ t0: 1.02, t1: 1.12, box: { x: 0, y: -150, w: 125, h: 140 }, dmg: 4, last: true, pbal: 0 }],
      ev: [{ t: 1.0, fn: () => G.SFX.play('slash', 0.6) }],
    },
    thrust: {
      dur: 1.8, cd: 1.6, tells: [{ t: 0.3, c: 'red' }],
      poses: { dur: 1.8, keys: [[0, SP.idle(0)], [0.85, SP.thrustA], [1.0, SP.thrustB, 'snap'], [1.3, SP.thrustB], [1.8, SP.idle(0), 'io']] },
      moves: [{ t0: 0.98, t1: 1.12, v: 620 }],
      hits: [{ t0: 0.98, t1: 1.16, box: { x: 0, y: -110, w: 140, h: 50 }, dmg: 5, red: true, kb: 260, last: true }],
      ev: [{ t: 0.98, fn: () => G.SFX.play('slash', 0.5, true) }],
    },
    draw(ctx, e, ghostPass) {
      // projected light: cyan-shifted, slightly see-through, with scanlines
      ctx.save();
      if (K.FILTER_OK && !ghostPass) ctx.filter = 'hue-rotate(-92deg) saturate(1.25) brightness(1.2)';
      ctx.globalAlpha *= 0.82 + Math.sin(e.t * 13) * 0.05;
      K.drawHumanoid(ctx, e, 1.1, 'sentinel');
      ctx.restore();
      if (!ghostPass) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(127,244,255,0.07)';
        for (let y = e.y - 170; y < e.y; y += 6) ctx.fillRect(e.x - 40, y + ((e.t * 40) % 6), 80, 1.5);
        K.glow(ctx, e.x, e.y - 2, 60, '#7ff4ff', 0.25);
        ctx.restore();
      }
    },
  };

  /* ---------- steps ---------- */
  const STEPS = [
    { id: 'move', title: '移動', text: '{move} 左右移動', check: (s) => s.moved > 260 },
    { id: 'jump', title: '跳躍', text: '{jump} 跳躍；在空中再按一次可以 <b>二段跳</b>', check: (s) => s.dj },
    { id: 'attack', title: '自動攻擊', text: '巴里會 <b>自動攻擊</b> 武器搆得到的敵人。走近訓練幻影，讓她打出完整的 <b>四段連擊</b>', phantom: true, check: (s) => s.maxCi >= 3 },
    { id: 'dodge', title: '閃避', text: '幻影的刀一發光就是要出招了。按 {dodge} 閃過去（2 次）', phantom: true, attack: 'red', need: 2, count: (s) => s.redDodges, check: (s) => s.redDodges >= 2 },
    { id: 'perfect', title: '完美閃避', text: '等攻擊<b>快打中你的那一瞬間</b>才按 {dodge}，就是 <b>完美閃避</b>：時間變慢、累積共鳴，接著 <b>自動反擊</b>（2 次）', phantom: true, attack: 'white', need: 2, count: (s) => s.perfects, check: (s) => s.perfects >= 2 },
    { id: 'execute', title: '處決', text: '幻影 <b>失衡</b> 了（頭上出現金色菱形）：走近它，巴里會 <b>自動處決</b>', phantom: true, breakIt: true, check: (s) => s.executed },
    { id: 'skill', title: '共鳴技', text: '攻擊命中和完美閃避會累積 <b>共鳴</b>（左上的菱形）。按 {skill} 施放共鳴技', res: 50, check: (s) => s.skill },
    { id: 'heal', title: '回復', text: '按 {heal} 喝調和劑回復生命，到魂燈台可以補充', hurt: true, check: (s) => s.healed },
  ];

  const Tut = G.Tut = {
    active: false, i: 0, s: null, doneT: 0, phantom: null,
    get step() { return STEPS[this.i]; },
    attackMode() { return this.active && this.step && this.doneT <= 0 ? this.step.attack || null : null; },
    // offered right after the landing dialogue on a new journey
    offer(onDone) {
      const g = G.game;
      if (g.save.flags.tut_done) { onDone && onDone(); return; }
      g.control = false;
      G.UI.choice({
        kicker: '戰鬥訓練 · COMBAT TRAINING', title: '要先熟悉戰鬥嗎？',
        desc: '寧舒會喚出一個訓練用的幻影，帶你一步步練習自動攻擊、閃避、完美閃避與處決。第一次遊玩強烈建議參加（約 3 分鐘，隨時可以跳過）。',
        items: [
          { label: '開始訓練', en: 'BEGIN TRAINING', action: () => this.start(onDone) },
          { label: '跳過，直接出發', en: 'SKIP', action: () => { g.save.flags.tut_done = true; g.control = true; onDone && onDone(); } },
        ],
      });
    },
    start(onDone) {
      const g = G.game, P = g.player;
      this.onDone = onDone; this.active = true; this.i = 0; this.doneT = 0;
      this.s = { moved: 0, lastX: P.x, dj: false, maxCi: -1, heavy: false, blocks: 0, parries: 0, perfects: 0, redDodges: 0, executed: false, skill: false, healed: false };
      // fence the training ground so nobody wanders into the first real fight
      // (the open stretch between the drop pod and the wrecked car: nothing to trip over)
      g.arena = { id: 'tut', x0: TX0, x1: TX1 };
      G.Phys.dyn = [{ x: TX0 - 30, y: -1600, w: 30, h: 1640, wall: true }, { x: TX1, y: -1600, w: 30, h: 1640, wall: true }];
      g.control = true; g.tutBonus = 0.06;
      G.UI.tutPanel(true); this.render();
      G.SFX.play('pylon');
    },
    skip() {
      if (!this.active) return;
      this.finish(true);
    },
    finish(skipped) {
      const g = G.game;
      this.active = false; g.tutBonus = 0;
      if (this.phantom && !this.phantom.dead) { this.phantom.remove = true; G.FX.ember(this.phantom.cx, this.phantom.cy, 30, '#7ff4ff', { w: 40, h: 140 }); }
      this.phantom = null;
      if (g.arena && g.arena.id === 'tut') { g.arena = null; G.Phys.dyn = []; }
      g.save.flags.tut_done = true;
      // the lessons are learned: no need to repeat the passive hints
      for (const h of ['move', 'attack', 'guard', 'dodge', 'execute', 'skills', 'rally']) g.save.flags['h_' + h] = true;
      G.UI.tutPanel(false);
      if (!skipped) { G.SFX.play('stingVictory'); g.toast('訓練完成', 'good'); g.save.tonic = g.player.maxTonic; }
      g.control = true; G.Input.clearBuffers();
      const cb = this.onDone; this.onDone = null; cb && cb();
    },
    ensurePhantom() {
      const g = G.game, P = g.player;
      if (this.phantom && !this.phantom.dead && !this.phantom.remove) return this.phantom;
      // appear on the roomier side of the player
      const x = P.x < (TX0 + TX1) / 2 ? Math.min(TX1 - 40, P.x + 230) : Math.max(TX0 + 40, P.x - 230);
      const e = new G.Enemy('phantom', x, 0, { enc: 'tut' });
      e.facing = x > P.x ? -1 : 1; g.enemies.push(e); this.phantom = e;
      G.FX.ring(x, -80, 10, 120, 0.5, '#7ff4ff', 4);
      return e;
    },
    ev(name, info) {
      if (!this.active || this.doneT > 0) return;
      const s = this.s;
      if (name === 'block') s.blocks++;
      else if (name === 'parry') s.parries++;
      else if (name === 'perfectDodge') s.perfects++;
      else if (name === 'dodgeRed') s.redDodges++;
      else if (name === 'execute') s.executed = true;
      void info;
      this.render();
    },
    update(dt) {
      if (!this.active) return;
      const g = G.game, P = g.player, s = this.s, st = this.step;
      // track what the player does
      s.moved += Math.abs(P.x - s.lastX); s.lastX = P.x;
      if (P.jumps >= 2) s.dj = true;
      if (P.state === 'light' && this.phantom && P.hitSet.has(this.phantom)) s.maxCi = Math.max(s.maxCi, P.ci);
      if (P.state === 'heavy' && this.phantom && P.hitSet.has(this.phantom)) s.heavy = true;
      if (P.state === 'skill1' || P.state === 'skill2' || P.state === 'cskill') s.skill = true;
      if (P.state === 'heal') s.healed = true;
      // keep it safe: training never kills
      P.hp = Math.max(P.hp, P.maxHp * 0.45);
      if (st.phantom) {
        const e = this.ensurePhantom();
        e.hp = e.maxHp;
        // while it is teaching a dodge, the automatic blade leaves it alone (a stunned phantom never swings)
        e.invuln = !!st.attack;
        if (!st.breakIt) { if (e.state !== 'broken') e.bal = 0; }
        else if (e.state !== 'broken' && e.state !== 'executed' && !e.dead) { e.atk = null; e.bal = e.maxBal; e.breakBalance(); }
        if (st.breakIt && e.state === 'executed') s.executed = true;
      } else if (this.phantom && !this.phantom.dead) { this.phantom.remove = true; this.phantom = null; }
      if (st.res && !this._resGiven) { this._resGiven = true; P.res = Math.max(P.res, st.res); }
      if (st.hurt && !this._hurtGiven) { this._hurtGiven = true; P.hp = Math.min(P.hp, P.maxHp * 0.55); g.save.tonic = Math.max(1, g.save.tonic); }
      // advance
      if (this.doneT > 0) {
        this.doneT -= dt;
        if (this.doneT <= 0) {
          this.i++; this._resGiven = false; this._hurtGiven = false;
          if (this.i >= STEPS.length) { this.finish(false); return; }
          this.render(); G.SFX.play('pageOpen');
        }
      } else if (st.check(s)) {
        this.doneT = 1.1; G.SFX.play('uiOk'); G.FX.ring(P.x, P.y - 60, 10, 90, 0.4, '#9cf7d8', 4);
        G.UI.tutDone();
      } else if (st.count) this.render();
    },
    render() {
      const st = this.step; if (!st) return;
      const n = st.count ? st.count(this.s) : 0;
      G.UI.tutStep(this.i + 1, STEPS.length, st.title, st.text, st.need ? `${Math.min(n, st.need)} / ${st.need}` : '');
    },
  };
})(window.G);

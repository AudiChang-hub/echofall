'use strict';
/* ECHOFALL — 殘響深淵 (the Abyss): a Hades-style run.
   · enter from a pylon; your Echoes start empty for the run (story Echoes are set aside and restored afterwards)
   · chamber after chamber in the arenas of the chapters you have reached; clear the foes, take the chamber's reward,
     then choose the next door by the reward floating above it (共鳴回響 / 殘響果實 / 結晶 / 碎片 / 裝備 / 鍛造石 / 共鳴泉)
   · every 5th chamber a chapter boss guards the way down, every 5th +3 an elite; after a boss you may climb back out
   · death ends the run — crystals, shards and gear you found are kept (like Hades)
   · 苦難契約 (Pact of Punishment): optional conditions raise the heat for bigger crystal rewards
   Arenas reuse each chapter's boss-room coordinates so boss scripts that know their arena keep working. */
(function (G) {
  const U = G.U;
  const REWARDS = {
    echo: { name: '共鳴回響', icon: '◇', col: '#7ff4ff' },
    fruit: { name: '殘響果實', icon: '❖', col: '#ff8fb8' },
    crystal: { name: '殘響結晶', icon: '⬟', col: '#c08bff' },
    shards: { name: '殘響碎片', icon: '♦', col: '#6ff3ff' },
    gear: { name: '裝備', icon: '⚔', col: '#ffb347' },
    stone: { name: '鍛造石', icon: '⬢', col: '#ffd28a' },
    heal: { name: '共鳴泉', icon: '✚', col: '#9cf7b0' },
    exit: { name: '返回地表', icon: '⇡', col: '#ffffff' },
  };
  // 苦難契約: id → { name, desc(rank), max }
  const PACT = [
    { id: 'hp', name: '堅硬寂裔', desc: (r) => `敵人生命 +${20 * r}%`, max: 3 },
    { id: 'dmg', name: '兇暴寂裔', desc: (r) => `敵人傷害 +${20 * r}%`, max: 3 },
    { id: 'horde', name: '寂裔大軍', desc: (r) => `每一波多 ${r} 名敵人`, max: 2 },
    { id: 'haste', name: '急躁', desc: (r) => `敵人移動速度 +${10 * r}%`, max: 2 },
    { id: 'tonic', name: '斷藥', desc: (r) => `調和劑 -${r}`, max: 2 },
    { id: 'frail', name: '脆弱', desc: (r) => `受到傷害時，額外損失 ${10 * r}% 已損失的生命`, max: 2 },
  ];

  const A = G.Abyss = {
    REWARDS, PACT,
    active: false, run: null,
    heat(p) { p = p || (this.run && this.run.pact) || {}; return PACT.reduce((s, c) => s + (p[c.id] || 0), 0); },
    pact() { return (this.run && this.run.pact) || {}; },
    // enemy scaling inside the Abyss (depth + pact); 1 outside
    hpMul() { if (!this.active) return 1; const r = this.run; return (1 + 0.035 * (r.depth - 1)) * (1 + 0.2 * (r.pact.hp || 0)); },
    dmgMul() { if (!this.active) return 1; const r = this.run; return (1 + 0.025 * (r.depth - 1)) * (1 + 0.2 * (r.pact.dmg || 0)); },
    speedMul() { return this.active ? 1 + 0.1 * (this.run.pact.haste || 0) : 1; },
    // gear and shard drops follow the furthest chapter reached, not the biome
    lootCh() { return this.active ? this.run.reach : (G.Chapters.cur && G.Chapters.cur.id) || 1; },
    tonicMinus() { return this.active ? (this.run.pact.tonic || 0) : 0; },

    /* ---------------------------------------------------------------- run lifecycle */
    start(game, pact, from) {   // from: first depth (test harness only)
      const sv = game.save;
      const reach = game.reachedChapter();
      this.run = {
        depth: Math.max(0, (from || 1) - 1), pact: Object.assign({}, pact), reach, crystals: 0, shards0: sv.shards, kills: 0,
        ret: { chapter: sv.chapter || 1, checkpoint: sv.checkpoint }, reward: 'echo',
      };
      // the run's Echoes start from nothing; story Echoes wait outside
      sv.abyssRun = { boons: sv.boons || {}, boonR: sv.boonR || {}, ret: this.run.ret };
      sv.boons = {}; sv.boonR = {};
      sv.pactLast = this.run.pact;
      this.active = true;
      game.persist();
      this.next(game);
    },
    // the chamber after this one
    next(game) {
      const r = this.run; r.depth++;
      const biomes = []; for (let c = 1; c <= r.reach; c++) biomes.push(c);
      const ch = biomes[Math.floor((r.depth - 1) / 5) % biomes.length];
      const kind = r.depth % 5 === 0 ? 'boss' : r.depth % 5 === 3 ? 'elite' : 'room';
      G.UI.curtain(true);
      const go = () => G.Chapters.ensure(ch).then(() => setTimeout(() => this.build(game, ch, kind), 380))
        .catch(() => { G.UI.toast('載入失敗，請確認網路', 'warn'); setTimeout(go, 2000); });
      go();
    },
    build(game, ch, kind) {
      const r = this.run, base = G.Chapters.get(ch), lv = G.Chapters.levelOf(ch);
      const bossId = Object.keys(lv.encounters).find((k) => lv.encounters[k].boss), BE = lv.encounters[bossId];
      const [a0, a1] = BE.arena, mid = (a0 + a1) / 2;
      // floor of the original boss room
      let fy = 1e9; for (const s of lv.solids) if (mid >= s.x && mid <= s.x + s.w && s.y >= -500 && s.y < fy) fy = s.y;
      if (fy > 1e8) fy = 0;
      const solids = [
        { x: a0 - 700, y: fy, w: (a1 - a0) + 1400, h: 900 },
        { x: a0 - 740, y: fy - 1800, w: 60, h: 1800 }, { x: a1 + 680, y: fy - 1800, w: 60, h: 1800 },
      ];
      const oneways = [];
      if (kind === 'room') {
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) oneways.push({ x: Math.round(U.lerp(a0 + 180, a1 - 380, (i + 0.5) / n) + (Math.random() - 0.5) * 120), y: fy - (160 + Math.floor(Math.random() * 2) * 110), w: 200 });
      }
      const waves = this.waves(ch, kind, BE, a0, a1, fy);
      const level = {
        start: { x: a0 + 140, y: fy }, bounds: [a0 - 600, a1 + 600], gravity: (lv.gravity || 1),
        solids, oneways, pylons: [], notes: [], items: [], npcs: [], triggers: [],
        encounters: { abyss: { manual: true, respawn: true, echo: false, boss: kind === 'boss', elite: kind === 'elite', arena: [a0, a1], waves } },
        zones: [{ x: -1e9, name: `殘響深淵　第 ${r.depth} 層`, en: `THE ABYSS — DEPTH ${r.depth}`, music: kind === 'boss' ? (base.music && base.music.boss) || 'boss' : (base.music && base.music.explore) || 'explore' }],
      };
      const bh = base.hooks || {};
      const safe = (f) => (f ? function () { try { return f.apply(this, arguments); } catch (e) { return undefined; } } : undefined);
      const def = Object.assign(Object.create(base), {
        level, intro: null, enterDialog: null, musicAt: null,
        hooks: { drawSky: safe(bh.drawSky), afterLayer: safe(bh.afterLayer), drawAtmos: safe(bh.drawAtmos),
          update: (g, dt) => this.update(g, dt), drawFront: (ctx, g) => this.drawDoors(ctx, g) },
      });
      G.Chapters.loadDef(def);
      const chip = document.getElementById('abyssChip');
      if (chip) { chip.hidden = false; chip.querySelector('b').textContent = `深淵 ${r.depth}`; chip.querySelector('em').textContent = this.heat() ? `熱度 ${this.heat()}` : base.title; }
      r.ch = ch; r.kind = kind; r.cleared = false; r.doors = null; r.a1 = a1; r.fy = fy;
      game.resetWorld();
      const P = game.player;
      P.reset(level.start.x, fy); P.recalc(); P.hp = Math.min(P.maxHp, r.depth === 1 ? P.maxHp : (r.hp || P.maxHp));
      if (r.depth === 1) { game.save.tonic = P.maxTonic; P.res = 0; game.mirrorRefresh(); }
      game.cam.x = game.cam.tx = P.x + 300; game.cam.y = fy - 160;
      game.state = 'play'; game.control = true; game.fadeA = 1; game.fadeTarget = 0;
      G.UI.showHud(true);
      G.Music.play(level.zones[0].music);
      requestAnimationFrame(() => requestAnimationFrame(() => G.UI.curtain(false)));
      G.UI.zoneCard(level.zones[0].name, `${base.title}・${kind === 'boss' ? '守門者' : kind === 'elite' ? '菁英' : (REWARDS[r.reward] || {}).name || ''}`);
      setTimeout(() => { if (this.active && game.encState.abyss === 'idle') game.startEncounter('abyss'); }, 1100);
    },
    // which foes guard a chamber
    waves(ch, kind, BE, a0, a1, fy) {
      const r = this.run, T = G.ENEMY_TYPES;
      if (kind === 'boss') return BE.waves.map((w) => w.map((d) => Object.assign({}, d)));
      const pool = Object.keys(T).filter((k) => (ch === 1 ? ['murmur', 'sentinel', 'shrieker'].includes(k) : k.startsWith('c' + ch + '_')) && !T[k].boss && !T[k].elite && !T[k].summon && k !== 'phantom');
      const pick = () => pool[Math.floor(Math.random() * pool.length)];
      const at = (i, n) => Math.round(U.lerp(a0 + 520, a1 - 140, n > 1 ? i / (n - 1) : 0.5));
      const mk = (t, x) => (T[t] && T[t].fly ? { t, x, y: -260 } : { t, x });
      // a wave draws from a shuffled deck of the pool so no single foe type floods a chamber
      const row = (n) => {
        const deck = []; while (deck.length < n) deck.push(...pool.slice().sort(() => Math.random() - 0.5));
        return deck.slice(0, n).map((t, i) => mk(t, at(i, n)));
      };
      const count = Math.min(6, 2 + Math.floor(r.depth / 4)) + (r.pact.horde || 0);
      if (kind === 'elite') {
        const el = 'c' + ch + '_elite', elite = T[el] ? el : (ch === 1 ? 'graves' : pick());
        return [[mk(elite, a0 + 950)], row(Math.max(2, count - 2))];
      }
      return r.depth > 1 ? [row(count), row(Math.max(1, count - 1))] : [row(count)];
    },
    update(game, dt) {
      const r = this.run; if (!this.active || !r) return;
      r.hp = game.player.hp;
      if (!r.cleared && game.encState.abyss === 'cleared' && game.control && !game.lootVacuum) { r.cleared = true; this.cleared(game); }
    },
    // chamber done: hand out its reward, then open two doors
    cleared(game) {
      const r = this.run;
      const after = () => { r.doors = this.rollDoors(); G.SFX.play('door'); G.UI.toast('前方的門開啟了：選擇下一個獎勵', 'item'); };
      if (r.kind === 'boss') {
        const n = Math.round((15 + r.depth) * this.rewardMul());
        r.crystals += n; G.Mirror.gain(n, `第 ${r.depth} 層守門者`);
        const best = (game.save.abyss = game.save.abyss || { best: 0, runs: 0 });
        best.best = Math.max(best.best, r.depth);
        this.grant(game, 'gear', after, true);
        return;
      }
      this.grant(game, r.reward, after);
    },
    rewardMul() { return 1 + 0.15 * this.heat(); },
    grant(game, kind, done, rare) {
      const r = this.run, sv = game.save, P = game.player, ch = r.reach, cx = P.x + 120;
      const src = { cx, cy: P.y - 80, y: P.y };
      switch (kind) {
        case 'echo': game.control = false; G.Boons.offer(() => { game.control = true; G.Input.clearBuffers(); done(); }); return;
        case 'fruit': game.control = false; G.Boons.offer(() => { game.control = true; G.Input.clearBuffers(); done(); }, { fruit: true }); return;
        case 'crystal': { const n = Math.round((3 + r.depth * 0.6) * this.rewardMul()); r.crystals += n; G.Mirror.gain(n); break; }
        case 'shards': { const n = Math.round((60 + r.depth * 18) * (1 + 0.1 * this.heat())); sv.shards += n; G.UI.toast(`殘響碎片　+${n}`, 'good'); G.SFX.play('pickup'); break; }
        case 'gear': G.Gear.spawnLoot(game, src, G.Gear.roll(ch, rare ? 2 : 1, 0.1 * this.heat()), 0, 1); break;
        case 'stone': sv.stones = (sv.stones || 0) + 2; G.UI.toast('鍛造石　+2', 'item'); G.SFX.play('pickup'); break;
        case 'heal': P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.5); G.FX.ring(P.x, P.y - 60, 10, 140, 0.6, '#9cf7b0', 5); G.SFX.play('heal'); G.UI.toast('共鳴泉：回復 50% 生命', 'good'); break;
      }
      game.persist();
      done();
    },
    rollDoors() {
      const r = this.run, keys = ['echo', 'echo', 'fruit', 'crystal', 'shards', 'gear', 'stone', 'heal'];
      const owned = Object.keys(G.game.save.boons || {}).length;
      const pick = () => { let k; do { k = keys[Math.floor(Math.random() * keys.length)]; } while (k === 'fruit' && owned < 2); return k; };
      const a = pick(); let b = pick(); let guard = 0; while (b === a && guard++ < 10) b = pick();
      const doors = [{ reward: a, x: r.a1 - 330 }, { reward: b, x: r.a1 - 140 }];
      if (r.kind === 'boss') doors.push({ reward: 'exit', x: r.a1 - 520 });
      return doors;
    },
    go(game, door) {
      if (!this.active || !door) return;
      G.SFX.play('pylon');
      if (door.reward === 'exit') { this.end(game, true); return; }
      this.run.reward = door.reward;
      this.next(game);
    },
    drawDoors(ctx, game) {
      const r = this.run; if (!this.active || !r || !r.doors) return;
      for (const d of r.doors) this.drawArch(ctx, d, r.fy, REWARDS[d.reward], game.time, game.player);
    },
    // a stone arch with light rising through it and the reward's sigil above (also used by the forks, js/routes.js)
    drawArch(ctx, d, y, R, t, P) {
      const arch = (x, y, hw, top) => { ctx.beginPath(); ctx.moveTo(x - hw, y); ctx.lineTo(x - hw, top); ctx.arc(x, top, hw, Math.PI, 0); ctx.lineTo(x + hw, y); ctx.closePath(); };
      {
        const x = d.x, top = y - 150;
        d.glow = U.lerp(d.glow || 0, Math.abs(P.x - x) < 90 ? 1 : 0, 0.12);
        d.born = Math.min(1, (d.born || 0) + 1 / 40);
        const k = d.born, g = d.glow, pulse = 0.5 + 0.5 * Math.sin(t * 3 + x * 0.01);
        ctx.save(); ctx.globalAlpha = k;
        // stone frame: outer arch, inner bevel, keystone
        ctx.fillStyle = '#211c27'; arch(x, y, 54, top); ctx.fill();
        ctx.strokeStyle = '#0b0612'; ctx.lineWidth = 3; ctx.stroke();
        ctx.strokeStyle = 'rgba(239,233,223,.12)'; ctx.lineWidth = 2; arch(x, y, 49, top); ctx.stroke();
        ctx.fillStyle = '#2c2533'; ctx.beginPath(); ctx.moveTo(x - 9, top - 58); ctx.lineTo(x + 9, top - 58); ctx.lineTo(x + 6, top - 40); ctx.lineTo(x - 6, top - 40); ctx.closePath(); ctx.fill(); ctx.stroke();
        for (const sx of [-1, 1]) { ctx.fillStyle = '#2c2533'; ctx.fillRect(x + sx * 54 - (sx > 0 ? 0 : 10), y - 16, 10, 16); }
        // the veil: reward-coloured light rising through the doorway
        ctx.fillStyle = '#0b0712'; arch(x, y, 40, top); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        const vg = ctx.createLinearGradient(0, top - 40, 0, y);
        vg.addColorStop(0, U.rgba(R.col, 0.04)); vg.addColorStop(0.6, U.rgba(R.col, 0.18 + 0.06 * pulse + 0.15 * g)); vg.addColorStop(1, U.rgba(R.col, 0.45 + 0.1 * pulse + 0.3 * g));
        ctx.fillStyle = vg; arch(x, y, 40, top); ctx.fill();
        ctx.strokeStyle = U.rgba(R.col, 0.35 + 0.4 * g); ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const ph = t * (0.7 + i * 0.2) + i * 1.9 + x;
          ctx.beginPath(); ctx.moveTo(x + Math.sin(ph) * 20, y);
          for (let q = 1; q <= 5; q++) ctx.lineTo(x + Math.sin(ph + q * 0.8) * (24 - q * 3), y - q * 34);
          ctx.stroke();
        }
        // light spilling onto the floor
        const fl = ctx.createRadialGradient(x, y, 4, x, y, 120);
        fl.addColorStop(0, U.rgba(R.col, 0.28 + 0.25 * g)); fl.addColorStop(1, U.rgba(R.col, 0));
        ctx.fillStyle = fl; ctx.fillRect(x - 120, y - 14, 240, 22);
        ctx.restore();
        if (Math.random() < 0.15 + 0.3 * g) G.FX.ember(x + (Math.random() - 0.5) * 60, y - 10, 1, R.col, { w: 10, h: 10, up: 80 });
        // the reward sigil above
        const iy = top - 92 + Math.sin(t * 2 + x) * 6, s = 1 + 0.12 * g;
        ctx.save(); ctx.globalAlpha = k; ctx.translate(x, iy); ctx.scale(s, s);
        ctx.globalCompositeOperation = 'lighter';
        const hg = ctx.createRadialGradient(0, 0, 2, 0, 0, 34); hg.addColorStop(0, U.rgba(R.col, 0.4 + 0.3 * g)); hg.addColorStop(1, U.rgba(R.col, 0));
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = U.rgba(R.col, 0.7); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(24, 0); ctx.lineTo(0, 24); ctx.lineTo(-24, 0); ctx.closePath(); ctx.stroke();
        ctx.font = '700 24px "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 5; ctx.strokeStyle = '#0b0612'; ctx.strokeText(R.icon, 0, 1); ctx.fillStyle = R.col; ctx.fillText(R.icon, 0, 1);
        ctx.font = '600 14px "Noto Serif TC", serif'; ctx.lineWidth = 5; ctx.strokeText(R.name, 0, 44); ctx.fillStyle = '#efe9df'; ctx.fillText(R.name, 0, 44);
        if (R.sub) { ctx.font = '500 11px "Noto Sans TC", sans-serif'; ctx.lineWidth = 4; ctx.strokeText(R.sub, 0, 62); ctx.fillStyle = U.rgba(R.col, 0.95); ctx.fillText(R.sub, 0, 62); }
        ctx.restore();
      }
    },
    doorNear(game) {
      const r = this.run; if (!this.active || !r || !r.doors) return [];
      return r.doors.map((d) => ({ kind: 'door', x: d.x, y: r.fy, ref: d, label: `前往：${REWARDS[d.reward].name}` }));
    },
    // run over (death, or climbing out after a boss) — keep the loot, restore the story Echoes, show the tally
    end(game, survived) {
      const r = this.run, sv = game.save;
      if (!this.active) return;
      this.active = false;
      const chip = document.getElementById('abyssChip'); if (chip) chip.hidden = true;
      const back = sv.abyssRun || {};
      sv.boons = back.boons || {}; sv.boonR = back.boonR || {}; delete sv.abyssRun;
      const rec = (sv.abyss = sv.abyss || { best: 0, runs: 0 }); rec.runs++; rec.best = Math.max(rec.best, survived ? r.depth : r.depth - 1);
      game.persist();
      const shards = Math.max(0, Math.floor(sv.shards - r.shards0));
      G.UI.abyssEnd({ depth: r.depth, survived, crystals: r.crystals, shards, best: rec.best, heat: this.heat(r.pact) }, () => {
        game.travelTo(r.ret.chapter, r.ret.checkpoint);
      });
    },
    // a reload in the middle of a run lands back on the surface: give the story Echoes back
    recover(sv) { const chip = document.getElementById('abyssChip'); if (chip) chip.hidden = true; if (sv && sv.abyssRun) { sv.boons = sv.abyssRun.boons || {}; sv.boonR = sv.abyssRun.boonR || {}; delete sv.abyssRun; } this.active = false; this.run = null; },
  };
})(window.G);

'use strict';
/* ECHOFALL — 共鳴之鏡 (Mirror of Echoes), modelled on Hades' Mirror of Night.
   Ten talents; each has two mutually exclusive faces (switch any time, free) and its own ranks.
   Paid with 殘響結晶 (crystals) from bosses, elites, challenge rewards and the Abyss — shards stay for gear.
   The first six A faces are the old 調校 upgrades (save.up keeps their ranks), so earlier saves carry over.
   save.mirror = { side: { slot: 'a' | 'b' }, rank: { 'slot:a' | 'slot:b': n } }, save.crystals = n */
(function (G) {
  const D = G.DATA;
  const up = (id) => D.upgrades.find((u) => u.id === id);
  // A faces of the first six slots read name / max / cost from the old upgrade table (chapter boosts raise their caps)
  const SLOTS = [
    { id: 'vit', a: { up: 'vit' }, b: { id: 'absorb', name: '殘響吸收', en: 'ABSORPTION', max: 3, cost: [12, 24, 40], desc: (l) => `擊倒敵人時回復 <b>${3 * l}%</b> 最大生命` } },
    { id: 'edge', a: { up: 'edge' }, b: { id: 'backstab', name: '背刺', en: 'BACKSTAB', max: 3, cost: [12, 24, 40], desc: (l) => `攻擊背對你的敵人時，傷害 <b>+${35 * l}%</b>` } },
    { id: 'tempo', a: { up: 'tempo' }, b: { id: 'swift', name: '輕身', en: 'LIGHTFOOT', max: 3, cost: [10, 20, 34], desc: (l) => `閃避消耗的耐力 <b>-${25 * l}%</b>` } },
    { id: 'still', a: { up: 'still' }, b: { id: 'riposte', name: '反擊之刃', en: 'RIPOSTE', max: 3, cost: [12, 24, 40], desc: (l) => `完美格擋後 2 秒內的下一擊，傷害 <b>+${60 * l}%</b>` } },
    { id: 'echo', a: { up: 'echo' }, b: { id: 'surge', name: '共鳴湧動', en: 'SURGE', max: 2, cost: [14, 30], desc: (l) => `每次休息、復活或進入新章節時，帶著 <b>${25 * l}</b> 點共鳴` } },
    { id: 'tonic', a: { up: 'tonic' }, b: { id: 'concentrate', name: '濃縮', en: 'CONCENTRATE', max: 3, cost: [10, 20, 34], desc: (l) => `調和劑的回復量 <b>+${15 * l}%</b>` } },
    { id: 'defy', a: { id: 'defy', name: '不屈之心', en: 'DEATH DEFIANCE', max: 1, cost: [45], desc: () => '每次休息或復活後，抵擋<b>一次致命傷害</b>並保留 40% 生命' },
      b: { id: 'endure', name: '堅韌', en: 'STUBBORN ROOTS', max: 3, cost: [12, 24, 40], desc: (l) => `每打完一場戰鬥，回復 <b>${8 * l}%</b> 最大生命` } },
    { id: 'fortune', a: { id: 'fortune', name: '尋寶直覺', en: 'FORTUNE', max: 3, cost: [10, 22, 38], desc: (l) => `裝備掉落率 <b>+${20 * l}%</b>` },
      b: { id: 'magnet', name: '碎片磁力', en: 'SHARD MAGNET', max: 3, cost: [10, 22, 38], desc: (l) => `殘響碎片獲得量 <b>+${15 * l}%</b>` } },
    { id: 'shadow', a: { id: 'shadow', name: '疾影', en: 'SHADOWSTEP', max: 3, cost: [12, 26, 44], desc: (l) => `閃避的無敵時間 <b>+${(0.03 * l).toFixed(2)} 秒</b>` },
      b: { id: 'clarity', name: '澄明', en: 'CLARITY', max: 1, cost: [30], desc: () => '完美閃避後，下一次攻擊<b>必定暴擊</b>' } },
    { id: 'chorus', a: { id: 'chorus', name: '合唱', en: 'CHORUS', max: 1, cost: [50], desc: () => '共鳴回響的選項 <b>3 張變 4 張</b>' },
      b: { id: 'luck', name: '幸運', en: 'FAVOUR', max: 3, cost: [14, 28, 46], desc: (l) => `共鳴回響出現稀有、史詩、傳說的機率提高（<b>Lv ${l}</b>）` } },
  ];

  const M = G.Mirror = {
    SLOTS,
    st(sv) { sv = sv || G.game.save; if (!sv.mirror) sv.mirror = { side: {}, rank: {} }; if (sv.crystals == null) sv.crystals = 0; return sv.mirror; },
    face(slot, side) {
      const f = slot[side];
      if (f.up) { const u = up(f.up); return { id: f.up, name: u.name, en: u.en, max: u.max, cost: u.cost.map((c) => Math.ceil(c / 10)), desc: () => `每一級：${u.desc}`, up: true }; }
      return f;
    },
    side(slot, sv) { return this.st(sv).side[slot.id] || 'a'; },
    rank(slot, side, sv) { sv = sv || G.game.save; const f = slot[side]; return f.up ? (sv.up[f.up] || 0) : (this.st(sv).rank[slot.id + ':' + side] || 0); },
    // rank of an effect id if its face is the active one (0 otherwise) — what gameplay code asks
    lv(effect) {
      const g = G.game, sv = g && g.save; if (!sv) return 0;
      for (const s of SLOTS) for (const side of ['a', 'b']) {
        const f = s[side], id = f.up || f.id;
        if (id === effect) return this.side(s, sv) === side ? this.rank(s, side, sv) : 0;
      }
      return 0;
    },
    setSide(slot, side, sv) { this.st(sv).side[slot.id] = side; },
    cost(slot, side, sv) { const f = this.face(slot, side), r = this.rank(slot, side, sv); return r >= f.max ? null : f.cost[r]; },
    buy(slot, side, sv) {
      sv = sv || G.game.save; const c = this.cost(slot, side, sv); this.st(sv);
      if (c == null || sv.crystals < c) return false;
      sv.crystals -= c;
      const f = slot[side];
      if (f.up) sv.up[f.up] = (sv.up[f.up] || 0) + 1; else sv.mirror.rank[slot.id + ':' + side] = this.rank(slot, side, sv) + 1;
      return true;
    },
    // 殘響結晶 income
    gain(n, why) {
      const g = G.game, sv = g.save; this.st(sv); sv.crystals += n;
      G.UI.toast(`殘響結晶　+${n}${why ? '　' + why : ''}`, 'good'); G.SFX.play('discover', 1.1);
    },
    // older saves: one-time grant for chapters already cleared, so the Mirror is not empty on day one
    migrate(sv) {
      this.st(sv);
      if (sv.mirrorInit) return; sv.mirrorInit = true;
      let n = 0; for (let c = 1; c <= 8; c++) if (sv.flags && (sv.flags['ch_done_' + c] || (c === 1 && sv.flags.boss_dead))) n += 25;
      for (const k in (sv.flags || {})) if (k.startsWith('elite_')) n += 8;
      sv.crystals += n;
    },
  };
})(window.G);

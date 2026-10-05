'use strict';
/* ECHOFALL — equipment & loot (Elden Ring–style build variety, farmable drops)
   Slots: weapon · head · body · 3 talismans (story relics keep their own two slots).
   Weapons come in five classes (each changes damage / speed / reach / poise damage and how the blade looks),
   can carry an affinity (heavy / keen / blood / frost / storm / sacred) and are reinforced +0…+10 with smithing stones.
   Every enemy can drop gear; elites always drop rare gear, bosses drop their signature weapon. Respawning
   encounters (they come back whenever you rest or die) make every area farmable.
   Items are plain JSON in save.inv; save.gear holds the equipped uids. */
(function (G) {
  const U = G.U;

  /* ------------------------------------------------------------------ data */
  const RARITY = [
    { name: '普通', en: 'COMMON', col: '#d9d4cc', mul: 1, fx: 0, salvage: 6 },
    { name: '精良', en: 'FINE', col: '#6fb7ff', mul: 1.05, fx: 1, salvage: 18 },
    { name: '稀有', en: 'RARE', col: '#c08bff', mul: 1.12, fx: 2, salvage: 45 },
    { name: '傳說', en: 'LEGENDARY', col: '#ffb347', mul: 1.22, fx: 3, salvage: 120 },
  ];
  // weapon classes: dmg/spd/reach/bal multipliers, blade look (length, width) and a class trait
  const CLASSES = {
    katana: { name: '直刀', en: 'STRAIGHT SWORD', glyph: '刀', dmg: 1, spd: 1, reach: 1, bal: 1, len: 1, w: 1, trait: '攻守平衡' },
    great: { name: '大劍', en: 'GREATSWORD', glyph: '劍', dmg: 1.38, spd: 0.8, reach: 1.22, bal: 1.6, len: 1.38, w: 1.9, trait: '慢而沉重，削韌極高' },
    rapier: { name: '細劍', en: 'RAPIER', glyph: '刺', dmg: 0.8, spd: 1.22, reach: 1.06, bal: 0.7, len: 1.12, w: 0.55, parry: 0.02, trait: '出手快，完美格擋判定 +20ms' },
    twin: { name: '雙刃', en: 'TWINBLADE', glyph: '雙', dmg: 0.74, spd: 1.3, reach: 0.9, bal: 0.8, len: 0.82, w: 1.1, echo: 0.22, trait: '每次命中 22% 追加一刀' },
    odachi: { name: '長刀', en: 'ODACHI', glyph: '長', dmg: 1.12, spd: 0.9, reach: 1.34, bal: 1.05, len: 1.5, w: 1, trait: '攻擊距離最長' },
  };
  // named weapon bases (ch = earliest chapter they drop in; uq = only from that boss)
  const WEAPONS = {
    zhixian: { cls: 'katana', name: '止弦', lore: '方舟第七降臨隊的制式共鳴刃。弦已經走音了。', start: true },
    grayport: { cls: 'katana', name: '灰港巡夜刀', lore: '灰港守夜人的配刀，刀鞘早已遺失。', ch: 1 },
    mistedge: { cls: 'katana', name: '霧鳴刀', lore: '揮動時會留下一聲很輕的鳴響。', ch: 3 },
    bellgreat: { cls: 'great', name: '鐘樓大劍', lore: '用鑄壞的鐘熔鑄而成，敲到東西會嗡嗡作響。', ch: 2 },
    quarry: { cls: 'great', name: '採石巨刃', lore: '斷層之井的礦工拿它劈開晶脈。', ch: 3 },
    stilettoN: { cls: 'rapier', name: '夜曲細劍', lore: '劍身細得像一根琴弦。', ch: 1 },
    baton: { cls: 'rapier', name: '指揮刺劍', lore: '有人把指揮棒磨成了劍。很難說這是褻瀆還是致敬。', ch: 4 },
    twinfang: { cls: 'twin', name: '雙牙', lore: '一長一短，像兩個聲部。', ch: 2 },
    duetblade: { cls: 'twin', name: '二重唱', lore: '兩把刃總是同時落下。', ch: 5 },
    tidelong: { cls: 'odachi', name: '潮汐長刀', lore: '刀身有一道永遠濕潤的紋路。', ch: 4 },
    skyodachi: { cls: 'odachi', name: '無重長刀', lore: '在高塔上鍛造，揮起來輕得不可思議。', ch: 5 },
    arkgreat: { cls: 'great', name: '方舟護衛大劍', lore: '方舟儀隊的禮劍，開過刃之後就不只是禮劍了。', ch: 6 },
    restkatana: { cls: 'katana', name: '休止之刃', lore: '夢裡撿到的刀，醒來時還握在手上。', ch: 7 },
    // boss signatures (always legendary)
    calla: { cls: 'great', name: '卡菈的聖鐘刃', lore: '修女把整座鐘的沉默都封進了這把劍。', uq: 'c2_boss', aff: 'sacred' },
    hadal: { cls: 'great', name: '鑽井王的鑽心劍', lore: '刃口還在微微旋轉。', uq: 'c3_boss', aff: 'heavy' },
    lucette: { cls: 'rapier', name: '露塞特的扇骨', lore: '最後的詠嘆，留在一根扇骨上。', uq: 'c4_boss', aff: 'frost' },
    idris: { cls: 'odachi', name: '斷錨', lore: '船長斬斷錨鏈的那把刀。', uq: 'c5_boss', aff: 'storm' },
    cantor: { cls: 'great', name: '頌者的管風琴劍', lore: '每揮一次，都有一根音管跟著鳴響。', uq: 'c6_boss', aff: 'sacred' },
    vega: { cls: 'katana', name: '薇格的殘影', lore: '她教過你的每一招，都還在這把刀裡。', uq: 'c7_boss', aff: 'keen' },
    mira: { cls: 'twin', name: '休止符', lore: '兩道休止，中間是一首沒寫完的歌。', uq: 'c8_boss', aff: 'blood' },
  };
  // armor: weight class sets defense and a side effect (light = faster dodge, heavy = slower but sturdier)
  const ARMOR = {
    head: {
      hood: { name: '降臨隊兜帽', wt: 'light', ch: 1, lore: '防水，防寂靜不太行。' },
      veil: { name: '修女頭紗', wt: 'light', ch: 2, lore: '戴上之後，世界會安靜一點。' },
      helmbell: { name: '鐘匠頭盔', wt: 'heavy', ch: 2, lore: '敲一下會響。' },
      lamp: { name: '礦工頭燈盔', wt: 'medium', ch: 3, lore: '燈還會亮。' },
      mask: { name: '歌劇白面', wt: 'light', ch: 4, lore: '笑著的那一面朝外。' },
      tricorn: { name: '船長三角帽', wt: 'medium', ch: 5, lore: '帽簷上有一道鹽漬。' },
      halo: { name: '頌者光冠', wt: 'heavy', ch: 6, lore: '冰冷的金屬光環。' },
      dreamcap: { name: '夢織頭巾', wt: 'light', ch: 7, lore: '摸起來像雲。' },
    },
    body: {
      duster: { name: '降臨隊風衣', wt: 'light', ch: 1, lore: '凜音穿慣的那件，深藍底、紅內裡。' },
      chain: { name: '鐘樓鎖甲', wt: 'heavy', ch: 2, lore: '每一環都是一個小鈴。' },
      leather: { name: '礦工皮甲', wt: 'medium', ch: 3, lore: '肩上縫了好幾層補丁。' },
      gown: { name: '詠嘆禮服', wt: 'light', ch: 4, lore: '裙擺還在滴水。' },
      coat: { name: '船長大衣', wt: 'medium', ch: 5, lore: '口袋裡有一張褪色的航海圖。' },
      robe: { name: '方舟祭袍', wt: 'heavy', ch: 6, lore: '繡著方舟的十二道聲紋。' },
      nightgown: { name: '休止長袍', wt: 'light', ch: 7, lore: '夢裡的衣服，醒來還在。' },
    },
  };
  const WEIGHT = {
    light: { name: '輕', def: 0.6, dodge: 0.08, sta: 6 },
    medium: { name: '中', def: 1, dodge: 0, sta: 0 },
    heavy: { name: '重', def: 1.55, dodge: -0.06, sta: -6 },
  };
  // talismans: fixed effects, one copy of each can be worn
  const TALISMANS = {
    blade: { name: '劍匠護符', d: '攻擊力 +10%', fx: { atk: 0.1 }, ch: 1, r: 1 },
    jade: { name: '碧玉琥珀', d: '最大生命 +15%', fx: { hpPct: 0.15 }, ch: 1, r: 1 },
    turtle: { name: '綠龜護符', d: '耐力 +25、耐力回復加快', fx: { sta: 25 }, ch: 1, r: 1 },
    feather: { name: '疾風羽', d: '閃避距離 +15%', fx: { dodge: 0.15 }, ch: 1, r: 1 },
    shell: { name: '回音貝', d: '完美格擋判定 +25ms', fx: { parry: 0.025 }, ch: 2, r: 2 },
    stone: { name: '共鳴石', d: '共鳴累積 +30%', fx: { res: 0.3 }, ch: 2, r: 1 },
    ring: { name: '斷弦指環', d: '暴擊率 +10%', fx: { crit: 0.1 }, ch: 2, r: 2 },
    crystal: { name: '碎晶之心', d: '削韌（失衡傷害）+35%', fx: { bal: 0.35 }, ch: 3, r: 2 },
    lantern: { name: '守夜燈', d: '殘響碎片獲得 +25%', fx: { shard: 0.25 }, ch: 1, r: 1 },
    glove: { name: '拾荒者手套', d: '裝備掉落率 +40%', fx: { drop: 0.4 }, ch: 2, r: 2 },
    crow: { name: '墨鴉羽', d: '處決傷害 +40%', fx: { exec: 0.4 }, ch: 3, r: 2 },
    fang: { name: '赤紅之牙', d: '生命低於 40% 時攻擊力 +25%', fx: { low: 0.25 }, ch: 4, r: 2 },
    dusk: { name: '薄暮紗', d: '閃避無敵時間 +0.06 秒', fx: { iframes: 0.06 }, ch: 4, r: 3 },
    iron: { name: '鐵之心', d: '受到的傷害 -12%', fx: { dr: 0.12 }, ch: 3, r: 2 },
    bell: { name: '舞者鈴', d: '攻擊速度 +8%', fx: { spd: 0.08 }, ch: 4, r: 2 },
    vow: { name: '血之誓', d: '擊倒敵人回復 6% 生命', fx: { killHeal: 0.06 }, ch: 3, r: 2 },
    leech: { name: '吸血牙', d: '每次命中回復 1 點生命', fx: { leech: 1 }, ch: 5, r: 2 },
    score: { name: '金色樂譜', d: '調和劑回復量 +25%', fx: { heal: 0.25 }, ch: 5, r: 2 },
    key: { name: '守鐘人鑰匙', d: '調和劑 +1', fx: { tonic: 1 }, ch: 6, r: 3 },
    storm: { name: '雷紋護符', d: '命中時 12% 機率引發落雷', fx: { shock: 0.12 }, ch: 5, r: 3 },
    frost: { name: '寒霜之眼', d: '攻擊附帶寒氣累積', fx: { frostB: 9 }, ch: 6, r: 3 },
    blood: { name: '鮮血花', d: '攻擊附帶出血累積', fx: { bleedB: 9 }, ch: 6, r: 3 },
    ward: { name: '盾紋護符', d: '格擋時受到的傷害 -50%', fx: { guard: 0.5 }, ch: 2, r: 1 },
    finale: { name: '終止式胸針', d: '對頭目與菁英傷害 +15%', fx: { boss: 0.15 }, ch: 7, r: 3 },
  };
  // weapon affinities (like Elden's Ashes of War affinities)
  const AFF = {
    heavy: { name: '重質', d: '削韌 +40%', fx: { bal: 0.4 }, col: '#d8b98a' },
    keen: { name: '銳利', d: '暴擊率 +10%', fx: { crit: 0.1 }, col: '#ffffff' },
    blood: { name: '鮮血', d: '出血累積（爆發 12% 最大生命）', fx: { bleedB: 14 }, col: '#ff4d6d' },
    frost: { name: '寒霜', d: '寒氣累積（凍傷：爆發傷害並增傷 15%）', fx: { frostB: 14 }, col: '#9fe8ff' },
    storm: { name: '雷電', d: '命中時 18% 機率引發落雷', fx: { shock: 0.18 }, col: '#ffe066' },
    sacred: { name: '神聖', d: '對頭目與菁英傷害 +15%', fx: { boss: 0.15 }, col: '#fff1b0' },
  };
  // random bonus lines on weapons & armor; v = [min,max] at item level 1 (scales a little with level)
  const AFFIX = {
    atk: { d: (v) => `攻擊力 +${Math.round(v * 100)}%`, w: ['weapon'], v: [0.04, 0.1] },
    spd: { d: (v) => `攻擊速度 +${Math.round(v * 100)}%`, w: ['weapon'], v: [0.03, 0.07] },
    crit: { d: (v) => `暴擊率 +${Math.round(v * 100)}%`, w: ['weapon', 'head'], v: [0.03, 0.08] },
    bal: { d: (v) => `削韌 +${Math.round(v * 100)}%`, w: ['weapon'], v: [0.08, 0.2] },
    leech: { d: (v) => `命中回復 ${v} 生命`, w: ['weapon'], v: [1, 1], int: true },
    exec: { d: (v) => `處決傷害 +${Math.round(v * 100)}%`, w: ['weapon'], v: [0.15, 0.3] },
    hp: { d: (v) => `最大生命 +${v}`, w: ['head', 'body'], v: [8, 18], int: true },
    sta: { d: (v) => `耐力 +${v}`, w: ['head', 'body'], v: [6, 14], int: true },
    dr: { d: (v) => `受到的傷害 -${Math.round(v * 100)}%`, w: ['body'], v: [0.03, 0.06] },
    res: { d: (v) => `共鳴累積 +${Math.round(v * 100)}%`, w: ['head', 'body', 'weapon'], v: [0.08, 0.18] },
    shard: { d: (v) => `殘響碎片獲得 +${Math.round(v * 100)}%`, w: ['head', 'body'], v: [0.06, 0.14] },
    drop: { d: (v) => `裝備掉落率 +${Math.round(v * 100)}%`, w: ['head'], v: [0.1, 0.2] },
    parry: { d: (v) => `完美格擋判定 +${Math.round(v * 1000)}ms`, w: ['head', 'body'], v: [0.008, 0.016] },
    dodge: { d: (v) => `閃避距離 +${Math.round(v * 100)}%`, w: ['body'], v: [0.04, 0.08] },
  };
  const MAX_INV = 80, MAX_PLUS = 10;

  /* ------------------------------------------------------------------ items */
  let uidN = 0;
  const uid = () => 'i' + Date.now().toString(36) + (uidN++).toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const lvScale = (il) => 1 + 0.06 * (Math.max(1, il) - 1);

  function rollRarity(tier, bonus) {
    // tier 0 = regular foe, 1 = elite, 2 = boss
    const r = Math.random() / (1 + (bonus || 0) * 0.5);
    if (tier >= 2) return r < 0.35 ? 3 : 2;
    if (tier === 1) return r < 0.12 ? 3 : 2;
    return r < 0.02 ? 3 : r < 0.12 ? 2 : r < 0.42 ? 1 : 0;
  }
  function rollFx(slot, n, il) {
    const pool = Object.keys(AFFIX).filter((k) => AFFIX[k].w.includes(slot)), out = [];
    while (out.length < n && pool.length) {
      const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0], A = AFFIX[k];
      let v = U.lerp(A.v[0], A.v[1], Math.random()) * (A.int ? lvScale(il) : 1 + (lvScale(il) - 1) * 0.4);
      v = A.int ? Math.max(1, Math.round(v)) : Math.round(v * 1000) / 1000;
      out.push([k, v]);
    }
    return out;
  }
  function make(slot, base, r, il, opts = {}) {
    const it = { uid: uid(), slot, base, r, il, plus: 0, fx: [], aff: opts.aff || '' };
    if (slot === 'talisman') return it;
    it.fx = rollFx(slot, RARITY[r].fx, il);
    if (slot === 'weapon' && !it.aff && r >= 1 && Math.random() < 0.18 + r * 0.14) it.aff = pick(Object.keys(AFF));
    return it;
  }
  // a random drop for chapter `ch`
  function roll(ch, tier, bonus) {
    const r = rollRarity(tier, bonus), x = Math.random();
    if (x < 0.4) {
      const ks = Object.keys(WEAPONS).filter((k) => !WEAPONS[k].uq && !WEAPONS[k].start && (WEAPONS[k].ch || 1) <= ch);
      return make('weapon', pick(ks), r, ch);
    }
    if (x < 0.75) {
      const slot = Math.random() < 0.5 ? 'head' : 'body';
      const ks = Object.keys(ARMOR[slot]).filter((k) => (ARMOR[slot][k].ch || 1) <= ch);
      return make(slot, pick(ks), r, ch);
    }
    const ks = Object.keys(TALISMANS).filter((k) => TALISMANS[k].ch <= ch && TALISMANS[k].r <= Math.max(1, r));
    const k = pick(ks.length ? ks : Object.keys(TALISMANS)), T = TALISMANS[k];
    return make('talisman', k, T.r, ch);
  }

  /* ------------------------------------------------------------------ stats */
  const BASE_DEF = { head: 4, body: 8 };
  function def(it) { return it.slot === 'weapon' ? WEAPONS[it.base] : it.slot === 'talisman' ? TALISMANS[it.base] : ARMOR[it.slot][it.base]; }
  function name(it) {
    const d = def(it); if (!d) return '???';
    const a = it.aff && AFF[it.aff] ? AFF[it.aff].name + '・' : '';
    return a + d.name + (it.plus ? ` +${it.plus}` : '');
  }
  // the numbers an item contributes on its own
  function itemStats(it) {
    const s = {}, add = (k, v) => { s[k] = (s[k] || 0) + v; };
    const d = def(it); if (!d) return s;
    const rm = RARITY[it.r].mul;
    if (it.slot === 'weapon') {
      const C = CLASSES[d.cls];
      s.power = Math.round(100 * C.dmg * lvScale(it.il) * rm * (1 + 0.07 * it.plus));
      s.speed = C.spd; s.reach = C.reach; s.balMul = C.bal;
      if (C.parry) add('parry', C.parry);
      if (C.echo) add('echo', C.echo);
      if (it.aff && AFF[it.aff]) for (const k in AFF[it.aff].fx) add(k, AFF[it.aff].fx[k]);
    } else if (it.slot === 'talisman') {
      for (const k in d.fx) add(k, d.fx[k]);
    } else {
      const W = WEIGHT[d.wt];
      s.defense = Math.round(BASE_DEF[it.slot] * W.def * lvScale(it.il) * rm);
      if (W.dodge) add('dodge', W.dodge * (it.slot === 'body' ? 1 : 0.5));
      if (W.sta) add('sta', W.sta * (it.slot === 'body' ? 1 : 0.5));
    }
    for (const [k, v] of it.fx || []) add(k, v);
    return s;
  }
  // single comparable number: weapons by damage per second, armor by survivability, talismans by rarity
  function score(it) {
    const s = itemStats(it);
    let v = 0;
    if (it.slot === 'weapon') v = s.power * s.speed * (1 + (s.spd || 0)) * (1 + (s.atk || 0)) * (1 + (s.crit || 0)) * (1 + 0.25 * ((s.bleedB || 0) + (s.frostB || 0)) / 14 + (s.shock || 0)) * (1 + (s.reach - 1) * 0.4);
    else if (it.slot === 'talisman') v = 10 * (it.r + 1);
    else v = s.defense * 3 + (s.hp || 0) + (s.sta || 0) * 0.5 + (s.dr || 0) * 300 + (s.dodge || 0) * 80 + (s.crit || 0) * 120 + (s.res || 0) * 40 + (s.parry || 0) * 1500 + (s.shard || 0) * 40 + (s.drop || 0) * 40;
    return Math.round(v);
  }

  const G_ = G.Gear = {
    RARITY, CLASSES, WEAPONS, ARMOR, TALISMANS, AFF, AFFIX, WEIGHT, MAX_INV, MAX_PLUS,
    def, name, itemStats, score, make, roll,
    slotName: { weapon: '武器', head: '頭部', body: '身體', talisman: '護符' },

    // make sure a save has an inventory (older saves get the starting blade)
    ensure(sv) {
      if (!sv) return;
      if (!Array.isArray(sv.inv)) sv.inv = [];
      if (!sv.gear) sv.gear = { weapon: null, head: null, body: null, tal: [null, null, null] };
      if (!Array.isArray(sv.gear.tal)) sv.gear.tal = [null, null, null];
      if (sv.stones == null) sv.stones = 0;
      if (!sv.inv.some((i) => i.slot === 'weapon')) {
        const w = make('weapon', 'zhixian', 0, 1); w.uid = 'start'; sv.inv.unshift(w);
      }
      if (!sv.gear.weapon || !sv.inv.some((i) => i.uid === sv.gear.weapon)) sv.gear.weapon = sv.inv.find((i) => i.slot === 'weapon').uid;
      for (const k of ['head', 'body']) if (sv.gear[k] && !sv.inv.some((i) => i.uid === sv.gear[k])) sv.gear[k] = null;
      sv.gear.tal = sv.gear.tal.map((u) => (u && sv.inv.some((i) => i.uid === u) ? u : null));
    },
    get(sv, u) { return u ? (sv.inv || []).find((i) => i.uid === u) || null : null; },
    equipped(sv) {
      G_.ensure(sv);
      const g = sv.gear;
      return [G_.get(sv, g.weapon), G_.get(sv, g.head), G_.get(sv, g.body), ...g.tal.map((u) => G_.get(sv, u))].filter(Boolean);
    },
    // the item currently worn in the same slot (for talismans: the weakest worn one, or an empty slot)
    current(sv, it) {
      G_.ensure(sv);
      if (it.slot === 'talisman') {
        const worn = sv.gear.tal.map((u) => G_.get(sv, u));
        if (worn.some((w) => w && w.base === it.base)) return worn.find((w) => w && w.base === it.base);
        if (worn.some((w) => !w)) return null;
        return worn.slice().sort((a, b) => score(a) - score(b))[0];
      }
      return G_.get(sv, sv.gear[it.slot]);
    },
    isWorn(sv, it) { const g = sv.gear; return g.weapon === it.uid || g.head === it.uid || g.body === it.uid || g.tal.includes(it.uid); },
    // total effect of everything worn → read by Player.recalc and the combat hooks
    totals(sv) {
      const t = { power: 100, speed: 1, reach: 1, balMul: 1, defense: 0 };
      for (const it of G_.equipped(sv)) {
        const s = itemStats(it);
        for (const k in s) {
          if (k === 'power' || k === 'speed' || k === 'reach' || k === 'balMul') t[k] = s[k];
          else t[k] = (t[k] || 0) + s[k];
        }
      }
      const w = G_.get(sv, sv.gear.weapon), C = w ? CLASSES[def(w).cls] : CLASSES.katana;
      t.look = { len: C.len, w: C.w, col: w && w.aff && AFF[w.aff] ? AFF[w.aff].col : null, r: w ? w.r : 0 };
      // paper doll: what Rinne wears on her head and body (js/rig.js redraws her outfit from these)
      const hd = G_.get(sv, sv.gear.head), bd = G_.get(sv, sv.gear.body);
      t.outfit = { head: hd ? hd.base : null, body: bd ? bd.base : null };
      return t;
    },
    equip(sv, it, talSlot) {
      if (it.slot === 'talisman') {
        const tal = sv.gear.tal;
        const same = tal.findIndex((u) => { const w = G_.get(sv, u); return w && w.base === it.base; });
        let i = talSlot != null ? talSlot : same >= 0 ? same : tal.indexOf(null);
        if (i < 0) { const cur = G_.current(sv, it); i = tal.indexOf(cur ? cur.uid : null); if (i < 0) i = 0; }
        if (same >= 0 && same !== i) tal[same] = null;
        tal[i] = it.uid;
      } else sv.gear[it.slot] = it.uid;
    },
    unequip(sv, it) {
      if (it.slot === 'weapon') return false;          // a blade is always in hand
      if (it.slot === 'talisman') sv.gear.tal = sv.gear.tal.map((u) => (u === it.uid ? null : u));
      else if (sv.gear[it.slot] === it.uid) sv.gear[it.slot] = null;
      return true;
    },
    salvageValue(it) { return { shards: Math.round(RARITY[it.r].salvage * lvScale(it.il) * (1 + it.plus * 0.3)), stones: it.r >= 2 ? it.r - 1 + Math.floor(it.plus / 3) : 0 }; },
    salvage(sv, it) {
      if (G_.isWorn(sv, it) || it.uid === 'start') return null;
      const v = G_.salvageValue(it);
      sv.inv = sv.inv.filter((i) => i !== it); sv.shards += v.shards; sv.stones += v.stones;
      return v;
    },
    upCost(it) { return it.plus >= MAX_PLUS ? null : { stones: it.plus + 1, shards: 40 * (it.plus + 1) * (1 + 0.15 * (it.il - 1)) | 0 }; },
    upgrade(sv, it) {
      const c = G_.upCost(it); if (!c || sv.stones < c.stones || sv.shards < c.shards) return false;
      sv.stones -= c.stones; sv.shards -= c.shards; it.plus++; return true;
    },

    // stat lines for display; with `other` each line carries the change against the worn item
    lines(it, other) {
      const a = itemStats(it), b = other ? itemStats(other) : {};
      const keys = [];
      const push = (k, label, fmt, higherBetter = true) => {
        const va = a[k] || 0, vb = b[k] || 0;
        if (!va && !vb) return;
        keys.push({ k, label, val: fmt(va), delta: other !== undefined ? va - vb : 0, dfmt: fmt, hb: higherBetter });
      };
      if (it.slot === 'weapon') {
        push('power', '攻擊力', (v) => String(Math.round(v)));
        push('speed', '攻擊速度', (v) => `${Math.round(v * 100)}%`);
        push('reach', '攻擊距離', (v) => `${Math.round(v * 100)}%`);
        push('balMul', '削韌', (v) => `${Math.round(v * 100)}%`);
      } else if (it.slot !== 'talisman') push('defense', '防禦', (v) => String(Math.round(v)));
      for (const k of Object.keys(Object.assign({}, a, b))) {
        if (['power', 'speed', 'reach', 'balMul', 'defense'].includes(k)) continue;
        const f = FMT[k]; if (!f) continue;
        push(k, f[0], f[1], f[2] !== false);
      }
      return keys;
    },
    // ▲ / ▼ / = against what is worn (score based)
    verdict(sv, it) {
      if (G_.isWorn(sv, it)) return 'worn';
      const cur = G_.current(sv, it);
      if (it.slot === 'talisman') {
        if (sv.gear.tal.some((u) => { const w = G_.get(sv, u); return w && w.base === it.base; })) return score(it) > score(cur) ? 'up' : 'same';
        return cur ? (score(it) > score(cur) ? 'up' : 'down') : 'up';
      }
      if (!cur) return 'up';
      const d = score(it) - score(cur);
      return d > 0 ? 'up' : d < 0 ? 'down' : 'same';
    },
    // unworn items that would beat what is worn (per slot type) — drives the ▲ badges and the HUD chip
    betterCount(sv, type) { G_.ensure(sv); return sv.inv.filter((i) => i.slot === type && G_.verdict(sv, i) === 'up').length; },
    anyBetter(sv) { if (!sv) return false; G_.ensure(sv); return sv.inv.some((i) => G_.verdict(sv, i) === 'up'); },
    hasNewBetter(sv) { if (!sv || !sv.inv) return false; return sv.inv.some((i) => i.n && G_.verdict(sv, i) === 'up'); },
    icon(it) { return it.slot === 'weapon' ? CLASSES[def(it).cls].glyph : it.slot === 'head' ? '盔' : it.slot === 'body' ? '甲' : '符'; },
    desc(it) {
      const d = def(it);
      if (it.slot === 'weapon') { const C = CLASSES[d.cls]; return `${C.name} · ${C.trait}${it.aff ? `　｜　${AFF[it.aff].name}：${AFF[it.aff].d}` : ''}`; }
      if (it.slot === 'talisman') return d.d;
      return `${WEIGHT[d.wt].name}型${it.slot === 'head' ? '頭盔' : '護甲'}${d.wt === 'light' ? ' · 閃避更遠、耐力更多' : d.wt === 'heavy' ? ' · 防禦高、閃避較短' : ''}`;
    },
    lore(it) { const d = def(it); return d.lore || ''; },

    /* ---------------------------------------------------------------- drops */
    onEnemyDeath(game, e) {
      const sv = game.save; G_.ensure(sv);
      const ch = (G.Chapters.cur && G.Chapters.cur.id) || 1;
      const tot = G_.totals(sv), bonus = tot.drop || 0;
      const drops = [];
      if (e.boss) {
        const sig = Object.keys(WEAPONS).find((k) => WEAPONS[k].uq === e.type);
        if (sig && !sv.flags['sig_' + e.type]) { sv.flags['sig_' + e.type] = true; drops.push(make('weapon', sig, 3, ch, { aff: WEAPONS[sig].aff })); }
        drops.push(roll(ch, 2, bonus));
        G_.stones(game, e, 5);
      } else if (e.elite) {
        drops.push(roll(ch, 1, bonus));
        G_.stones(game, e, 3);
      } else if (!e.T.summon && e.type !== 'phantom') {
        if (Math.random() < 0.13 * (1 + bonus)) drops.push(roll(ch, 0, bonus));
        if (Math.random() < 0.22) G_.stones(game, e, 1);
      }
      drops.forEach((it, i) => G_.spawnLoot(game, e, it, i, drops.length));
    },
    stones(game, e, n) {
      for (let i = 0; i < n; i++) G_.spawnLoot(game, e, { stone: true }, i, n);
    },
    spawnLoot(game, e, it, i, n) {
      const x = e.cx + (i - (n - 1) / 2) * 46, y = e.cy;
      const gy = G.Phys.groundBelow(x, Math.min(y, e.y - 4));
      game.pickups.push({ kind: 'loot', item: it.stone ? null : it, stone: !!it.stone, x, y, vx: (i - (n - 1) / 2) * 60 + U.rand(-30, 30), vy: -380 - Math.random() * 120, t: 0, gy: gy < 1e8 ? gy : e.y });
    },
    // called every frame for loot pickups (shards keep their own magnet in game.updPickups)
    updLoot(game, p, dt) {
      p.t += dt;
      if (!p.landed) {
        p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-2 * dt);
        if (p.vy > 0 && p.y >= p.gy - 14) { p.y = p.gy - 14; p.landed = true; G.SFX.play('land', 1.6); }
      }
      const P = game.player;
      if (p.t > 0.5 && P.state !== 'dead' && Math.abs(P.x - p.x) < 56 && Math.abs(P.y - 40 - p.y) < 110) { G_.collect(game, p); return true; }
      return false;
    },
    collect(game, p) {
      const sv = game.save; G_.ensure(sv);
      if (p.stone) {
        sv.stones++; G.SFX.play('pickup'); G.FX.ember(p.x, p.y, 6, '#ffd28a', { w: 16, h: 16 });
        G.UI.toast('鍛造石　+1', 'item'); return;
      }
      const it = p.item;
      if (sv.inv.length >= MAX_INV) {
        // full bag: the weakest unworn common goes to the forge
        const spare = sv.inv.filter((i) => !G_.isWorn(sv, i) && i.uid !== 'start').sort((a, b) => a.r - b.r || score(a) - score(b))[0];
        if (spare && (spare.r < it.r || score(spare) < score(it))) G_.salvage(sv, spare);
        else { const v = G_.salvageValue(it); sv.shards += v.shards; sv.stones += v.stones; G.UI.toast(`背包已滿：${name(it)} 自動分解`, 'warn'); return; }
      }
      it.n = 1;   // unseen until the equipment screen shows it
      sv.inv.push(it);
      const rc = RARITY[it.r].col;
      G.SFX.play(it.r >= 2 ? 'discover' : 'pickup', it.r >= 3 ? 1 : 1.3);
      G.FX.ring(p.x, p.y, 6, it.r >= 2 ? 90 : 50, 0.45, rc, 3);
      G.UI.lootCard(it);
      game.persist && game.persist();
    },
    drawLoot(ctx, p, t) {
      const col = p.stone ? '#ffd28a' : RARITY[p.item.r].col;
      const r = p.stone ? 0 : p.item.r;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      // a beam of light like an item on the ground in Elden Ring (taller for better rarity)
      if (p.landed && !p.stone) {
        const H = 60 + r * 45, a = 0.18 + r * 0.06 + Math.sin(t * 3 + p.x) * 0.04;
        const g = ctx.createLinearGradient(0, p.y - H, 0, p.y + 10);
        g.addColorStop(0, U.rgba(col, 0)); g.addColorStop(1, U.rgba(col, a));
        ctx.fillStyle = g; ctx.fillRect(p.x - 7, p.y - H, 14, H + 10);
      }
      const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.stone ? 12 : 20);
      gl.addColorStop(0, U.rgba('#ffffff', 0.95)); gl.addColorStop(0.35, U.rgba(col, 0.7)); gl.addColorStop(1, U.rgba(col, 0));
      ctx.fillStyle = gl; ctx.fillRect(p.x - 20, p.y - 20, 40, 40);
      ctx.restore();
      if (Math.random() < 0.06 + r * 0.04) G.FX.ember(p.x, p.y, 1, col, { w: 14, h: 10, up: 50 });
    },
  };

  /* ------------------------------------------------------------------ combat hooks (from Player.doHits) */
  const burst = (e, dmg, col, label) => {
    e.takeHit({ dmg, bal: 6, hx: e.cx, hy: e.cy, kbx: 0, boon: true });
    G.FX.ring(e.cx, e.cy, 8, 110, 0.45, col, 6); G.FX.spark(e.cx, e.cy, 22, { col, speed: 700 });
    if (G.FX.text) G.FX.text(e.cx, e.cy - e.h * 0.6, label, col);
    G.SFX.play('impact'); G.game.hitstop(0.05);
  };
  const decay = (e, k, now) => { const t = e[k + 'T'] || now; e[k] = Math.max(0, (e[k] || 0) - (now - t) * 9); e[k + 'T'] = now; };
  G_.modHit = (P, e, m) => {
    const t = P.gear; if (!t) return m;
    if (t.crit && !m.crit && Math.random() < t.crit) { m.dmg *= 2; m.crit = true; }
    m.bal *= (t.balMul || 1) * (1 + (t.bal || 0));
    if (t.low && P.hp < P.maxHp * 0.4) m.dmg *= 1 + t.low;
    if (t.boss && (e.boss || e.elite)) m.dmg *= 1 + t.boss;
    if (e.frostUntil && G.game.time < e.frostUntil) m.dmg *= 1.15;
    return m;
  };
  G_.afterHit = (P, e, m) => {
    const t = P.gear; if (!t) return;
    const now = G.game.time, tough = e.boss ? 0.035 : e.elite ? 0.06 : 0.12;
    if (t.leech) P.hp = Math.min(P.maxHp, P.hp + t.leech);
    if (t.echo && Math.random() < t.echo) {
      G.Boons.later.push({ t: 0.09, fn: () => {
        if (e.dead) return;
        e.takeHit({ dmg: m.dmg * 0.5, bal: m.bal * 0.3, hx: e.cx, hy: e.cy, kbx: P.facing * 60, boon: true });
        G.FX.slashMark(e.cx, e.cy - 10, P.facing > 0 ? 0.7 : Math.PI - 0.7, 110, '#ffffff', 0.14, 5); G.SFX.play('slash', 1.5);
      } });
    }
    if (t.bleedB && !e.dead) {
      decay(e, 'bleed', now); e.bleed += t.bleedB;
      if (e.bleed >= 100) { e.bleed = 0; burst(e, e.maxHp * tough + 10, '#ff4d6d', '出血'); }
    }
    if (t.frostB && !e.dead) {
      decay(e, 'frost', now); e.frost += t.frostB;
      if (e.frost >= 100) { e.frost = 0; e.frostUntil = now + 6; burst(e, e.maxHp * tough * 0.6 + 8, '#9fe8ff', '凍傷'); }
    }
    if (t.shock && Math.random() < t.shock) {
      const dmg = Math.round(m.dmg * 0.4 + 6);
      G.FX.beam(e.cx + 20, e.cy - 260, e.cx, e.cy, '#ffe066', 0.25, 7); G.FX.flash(e.cx, e.cy, 90, 0.2, '#ffe066');
      if (!e.dead) e.takeHit({ dmg, bal: 5, hx: e.cx, hy: e.cy, kbx: 0, boon: true });
      G.Boons.chain(e, Math.round(dmg * 0.7));
    }
  };

  // formatter for every other stat key: [label, fmt, higherIsBetter]
  const pct = (v) => `+${Math.round(v * 100)}%`;
  const FMT = {
    atk: ['攻擊力加成', pct], spd: ['攻擊速度加成', pct], crit: ['暴擊率', pct], bal: ['削韌加成', pct], echo: ['追加一刀機率', pct],
    leech: ['命中回復', (v) => `${v}`], exec: ['處決傷害', pct], hp: ['最大生命', (v) => `+${Math.round(v)}`], hpPct: ['最大生命', pct],
    sta: ['耐力', (v) => `${v >= 0 ? '+' : ''}${Math.round(v)}`], dr: ['減傷', pct], res: ['共鳴累積', pct], shard: ['碎片獲得', pct],
    drop: ['掉落率', pct], parry: ['完美格擋判定', (v) => `+${Math.round(v * 1000)}ms`], dodge: ['閃避距離', (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`],
    iframes: ['閃避無敵', (v) => `+${v.toFixed(2)}s`], low: ['低血量增傷', pct], killHeal: ['擊倒回復', pct], heal: ['回復量', pct],
    tonic: ['調和劑', (v) => `+${v}`], shock: ['落雷機率', pct], frostB: ['寒氣累積', (v) => `${Math.round(v)}`], bleedB: ['出血累積', (v) => `${Math.round(v)}`],
    guard: ['格擋減傷', pct], boss: ['對頭目增傷', pct],
  };
})(window.G);

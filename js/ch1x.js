'use strict';
/* ECHOFALL — 第一章探索版「溫陀」: the funeral city as one connected place instead of a road.
   Three layers that loop back on each other:
     surface   the old harbour → the funeral avenue → a chasm where the avenue fell in → the cathedral courtyard
     above     the rooftops (Graves, the music box, 魂翼 the soul-wings) → the bell tower; a high wing-jump route over the chasm
     below     the royal crypt (reached down a stairwell in the avenue or by falling into the chasm) → the bell chamber
               (守陵人, then 引魂鈴 the soul-bell) → the chasm hall → stairs up into the courtyard
   Two abilities open the rest of the city:
     魂翼 soul-wings  double jump: warehouse roof, the bell tower, the high route, the cathedral balcony
     引魂鈴 soul-bell  shows the spirit paths (ghost platforms) and dissolves the seals of the dead: the sunken hold under the
                      harbour, the empty tomb under the crypt, the hanging coffin in the chasm
   The cathedral's funeral door wants both the bell and the lullaby of the music box.
   This file rebuilds chapter 1's level before js/chapters.js snapshots it, and carries the chapter's exploration runtime
   (seals, spirit paths, cracked walls, ability shrines, the crypt backdrop). js/map.js draws the map. */
(function (G) {
  const U = G.U, L = G.LEVEL;

  /* ---------------------------------------------------------------- the city */
  L.bounds = [-500, 9050];
  L.solids = [
    // harbour: the start, the docks over the sunken hold (thin lid with a sealed hatch), the rest of the quay
    { x: -900, y: 0, w: 1500, h: 900, kind: 'ground' },
    { x: 600, y: 0, w: 700, h: 120, kind: 'ground' },
    { x: 1420, y: 0, w: 180, h: 120, kind: 'ground' },
    { x: 1600, y: 0, w: 1450, h: 900, kind: 'ground' },
    { x: 600, y: 520, w: 1000, h: 380, kind: 'crypt' },          // hold floor
    { x: 760, y: -66, w: 160, h: 66, kind: 'car' },
    { x: 2975, y: -42, w: 75, h: 42, kind: 'crate' },
    // avenue: west block (its underside is the crypt's west wall and the cracked niche), the stairwell, the avenue proper
    { x: 3050, y: -90, w: 300, h: 200, kind: 'ground' },
    { x: 3050, y: 110, w: 100, h: 850, kind: 'crypt' },
    { x: 3550, y: -90, w: 2000, h: 200, kind: 'ground' },
    { x: 4600, y: -640, w: 900, h: 46, kind: 'roof' },
    // the crypt floor (with the empty tomb carved beneath it) running on under the chasm
    { x: 3150, y: 560, w: 500, h: 400, kind: 'crypt' },
    { x: 3650, y: 560, w: 150, h: 40, kind: 'crypt' },
    { x: 3900, y: 560, w: 150, h: 40, kind: 'crypt' },
    { x: 3600, y: 820, w: 500, h: 200, kind: 'crypt' },
    { x: 4050, y: 560, w: 2200, h: 400, kind: 'crypt' },
    // courtyard and cathedral
    { x: 6250, y: 0, w: 3050, h: 960, kind: 'ground' },
    { x: 9000, y: -1600, w: 400, h: 1700, kind: 'wall' },
    { x: -900, y: -1600, w: 420, h: 1700, kind: 'wall' },
  ];
  L.oneways = [
    // the climb to the rooftops
    // (the first step stands over the avenue, not over the stairwell; single-jump steps of at most 140)
    { x: 3620, y: -230, w: 200 }, { x: 3960, y: -270, w: 190 }, { x: 4150, y: -390, w: 160 }, { x: 4340, y: -510, w: 200 },
    // the hold's way back up through the hatch
    { x: 1150, y: 400, w: 110 }, { x: 1305, y: 280, w: 110 }, { x: 1305, y: 160, w: 110 }, { x: 1305, y: 40, w: 110 },   // stacked under the hatch
    // the stairwell down into the crypt
    { x: 3445, y: 450, w: 100 }, { x: 3355, y: 340, w: 100 }, { x: 3445, y: 230, w: 100 }, { x: 3355, y: 120, w: 100 }, { x: 3445, y: 10, w: 100 },
    // out of the empty tomb
    { x: 3805, y: 720, w: 90 }, { x: 3805, y: 640, w: 90 },   // stacked under the seal's opening (head room)
    // the chasm hall's stair up into the courtyard
    { x: 6120, y: 440, w: 120 }, { x: 6000, y: 320, w: 120 }, { x: 6120, y: 200, w: 120 }, { x: 6120, y: 80, w: 120 },
    // wing routes: warehouse roof, the bell tower, the high road over the chasm, the cathedral balcony
    { x: 2250, y: -250, w: 150 },
    { x: 4700, y: -860, w: 130 }, { x: 4960, y: -1060, w: 150 },
    { x: 5930, y: -600, w: 110 }, { x: 6170, y: -450, w: 100 },
    { x: 7050, y: -250, w: 170 },
  ];
  L.pylons = [
    { id: 'p1', x: 2780, y: 0, name: '舊王港魂燈台' },
    { id: 'p2', x: 4250, y: -90, name: '送葬大道魂燈台' },
    { id: 'pc', x: 5720, y: 560, name: '墓穴魂燈台' },
    { id: 'p3', x: 6560, y: 0, name: '聖堂中庭魂燈台' },
  ];
  L.notes = [
    { id: 'n1', x: 470, y: 0 },
    { id: 'n2', x: 1880, y: 0 },
    { id: 'n4', x: 4720, y: -640 },
    { id: 'n6', x: 5300, y: -640 },
    { id: 'n3', x: 6880, y: 0 },
    { id: 'n5', x: 7060, y: 0 },
    { id: 'x_hold', x: 980, y: 520 },
    { id: 'x_tomb', x: 3960, y: 820 },
    { id: 'x_tower', x: 5000, y: -1060 },
    { id: 'x_crypt', x: 3980, y: 560 },
  ];
  const take = (fn) => (g) => fn(g, g.save);
  const talisman = (key, r) => take((g) => G.Gear.spawnLoot(g, { cx: g.player.x + 50, cy: g.player.y - 80, y: g.player.y }, G.Gear.make('talisman', key, r, 1), 0, 1));
  const shards = (n) => take((g, sv) => { sv.shards += n; g.toast(`殘響碎片　+${n}`, 'good'); });
  const stones = (n) => take((g, sv) => { sv.stones = (sv.stones || 0) + n; g.toast(`鍛造石　+${n}`, 'item'); });
  const gear = (tier) => take((g) => G.Gear.spawnLoot(g, { cx: g.player.x + 50, cy: g.player.y - 80, y: g.player.y }, G.Gear.roll(1, tier, 0.2), 0, 1));
  const chest = (id, x, y, name, onTake) => ({ id, x, y, flag: id + '_got', name, kind: 'key', sfx: 'pickup', chest: true, onTake });
  L.items = [
    { id: 'hushbell', x: 4440, y: -510, flag: 'relic_hushbell', name: '靜默之鈴', kind: 'relic' },
    { id: 'musicbox', x: 5420, y: -640, flag: 'got_musicbox', name: '諾娜的音樂盒', kind: 'key' },
    chest('x_c_niche', 3235, 560, '牆後的暗格', shards(220)),
    chest('x_c_hold', 760, 520, '船艙深處的箱子', talisman('shell', 2)),
    chest('x_c_tomb', 3720, 820, '空墓前的供品', gear(2)),
    chest('x_c_coffin', 5940, -230, '懸棺裡的陪葬品', stones(3)),
    chest('x_c_crane', 1940, -420, '起重機頂的箱子', shards(160)),
    chest('x_c_roof', 2320, -250, '倉庫屋頂的箱子', gear(1)),
    chest('x_c_tower', 5080, -1060, '鐘塔頂的箱子', talisman('ward', 1)),
    chest('x_c_balcony', 7130, -250, '聖堂露台的箱子', stones(2)),
  ];
  L.npcs = [{ id: 'barrow', x: 6760, y: 0 }];
  L.triggers = [
    { id: 'h_attack', x: 980, kind: 'hint', hint: 'attack', yMax: 60 },
    { id: 'd_first', x: 1180, kind: 'dialog', dialog: 'firstEnemy', after: 'guard', yMax: 60 },
    { id: 'd_sent', x: 2010, kind: 'dialog', dialog: 'sentinel', after: 'dodge', yMax: 60 },
    { id: 'h_climb', x: 3900, kind: 'hint', hint: 'climb', yMax: 60 },
    { id: 'd_roof', x: 4880, kind: 'dialog', dialog: 'rooftop', yMax: -500, enc: 'graves', startEnc: 'graves', flag: 'graves_seen' },
    { id: 'd_cath', x: 7350, kind: 'dialog', dialog: 'cathedral' },
    { id: 'd_boss', x: 7800, kind: 'dialog', dialog: 'bossIntro', enc: 'boss', startEnc: 'boss', flag: 'boss_seen', focus: { x: 8350, y: -170, zoom: 0.95 }, music: 'boss' },
  ];
  // fewer locked arenas: most foes simply live in the streets and the crypt (and come back when you rest);
  // the red walls are kept for the Sentinel's duel, the avenue gauntlet, the bell chamber, Graves and Marg
  L.encounters = {
    e1: { trigger: 1250, yMax: 60, respawn: true, waves: [[{ t: 'murmur', x: 1600 }], [{ t: 'murmur', x: 1780 }, { t: 'c1_bellcrow', x: 1880, y: -220 }]] },
    e2: { trigger: 2060, yMax: 60, arena: [1960, 2700], waves: [[{ t: 'sentinel', x: 2480 }], [{ t: 'murmur', x: 2160 }, { t: 'c1_bellcrow', x: 2560, y: -230 }]] },
    e3: { trigger: 3250, yMax: 60, respawn: true, waves: [[{ t: 'c1_pillar', x: 3820 }], [{ t: 'shrieker', x: 3950, y: -330 }, { t: 'c1_bellcrow', x: 3700, y: -230 }, { t: 'murmur', x: 3800 }]] },
    e4: {
      trigger: 4600, yMax: 60, arena: [4500, 5420], wallTop: -600,
      waves: [
        [{ t: 'murmur', x: 4900 }, { t: 'c1_bellcrow', x: 5050, y: -230 }, { t: 'murmur', x: 5250 }],
        [{ t: 'c1_pillar', x: 5100 }, { t: 'shrieker', x: 4800, y: -330 }],
        [{ t: 'sentinel', x: 4650 }, { t: 'sentinel', x: 5250 }],
      ],
    },
    graves: { manual: true, elite: true, arena: [4620, 5480], wallBottom: -640, yMax: -500, waves: [[{ t: 'graves', x: 5250, y: -640 }]] },
    h1: { trigger: 700, yMin: 200, respawn: true, waves: [[{ t: 'murmur', x: 1000 }], [{ t: 'murmur', x: 1250 }, { t: 'murmur', x: 1450 }]] },
    k1: { trigger: 3600, yMin: 300, respawn: true, waves: [[{ t: 'murmur', x: 3950 }, { t: 'murmur', x: 4150 }], [{ t: 'sentinel', x: 4300 }]] },
    k2: {
      trigger: 4560, yMin: 300, arena: [4500, 5360], wallTop: 110, wallBottom: 600,
      waves: [[{ t: 'sentinel', x: 4900 }, { t: 'sentinel', x: 5150 }], [{ t: 'c1_pillar', x: 5000 }, { t: 'murmur', x: 4700 }, { t: 'murmur', x: 5250 }]],
    },
    k3: { trigger: 5560, yMin: 300, respawn: true, waves: [[{ t: 'shrieker', x: 5850, y: -160 }, { t: 'c1_bellcrow', x: 6050, y: -220 }, { t: 'murmur', x: 5950 }]] },
    e5: {
      trigger: 6900, yMax: 60, respawn: true,
      waves: [
        [{ t: 'c1_pillar', x: 7250 }, { t: 'murmur', x: 7100 }, { t: 'shrieker', x: 7350, y: -300 }],
        [{ t: 'sentinel', x: 7150 }, { t: 'c1_bellcrow', x: 7300, y: -240 }, { t: 'c1_bellcrow', x: 7420, y: -280 }],
      ],
    },
    boss: { manual: true, arena: [7620, 8900], boss: true, waves: [[{ t: 'maestrina', x: 8500, y: -60 }]] },
  };

  /* ---------------------------------------------------------------- what the city hides */
  const SEALS = [   // the seals of the dead: solid until the soul-bell rings them open
    { id: 'hold', x: 1300, y: -2, w: 120, h: 24, name: '船艙的封印' },
    { id: 'tomb', x: 3800, y: 558, w: 100, h: 24, name: '空墓的封印' },
  ];
  const SPIRIT = [   // spirit paths: only there for someone carrying the soul-bell
    { x: 1880, y: -140, w: 120 }, { x: 2040, y: -280, w: 120 }, { x: 1880, y: -420, w: 150 },
    { x: 5650, y: 430, w: 110 }, { x: 5820, y: 300, w: 110 }, { x: 5980, y: 170, w: 110 }, { x: 5820, y: 40, w: 110 }, { x: 5980, y: -90, w: 110 }, { x: 5860, y: -230, w: 160 },
  ];
  const CRACKS = [   // walls that give under the blade
    { id: 'niche', x: 3320, y: 110, w: 30, h: 450, hp: 4 },
  ];
  const ABILITY = {
    wings: { x: 5130, y: -640, name: '魂翼', en: 'SOUL-WINGS', col: '#bff8ff', note: 'ab_wings', after: 'graves' },
    bell: { x: 5200, y: 560, name: '引魂鈴', en: 'SOUL-BELL', col: '#ffd9a8', note: 'ab_bell', after: 'k2' },
  };
  // places that are inside: the crypt's stone and candles instead of the city sky (and their name cards)
  const INSIDE = [
    { id: 'crypt', x: 3050, y: 110, w: 3200, h: 1000, name: '王陵地窖', en: 'THE ROYAL CRYPT', fadeFrom: 5550 },
    { id: 'crypt', x: 3350, y: -90, w: 200, h: 200, noCard: true },   // the stairwell down from the avenue
    { id: 'hold', x: 600, y: 120, w: 1000, h: 800, name: '沉船船艙', en: 'THE SUNKEN HOLD' },
  ];
  const HIGH = [{ id: 'tower', x: 4600, y: -1400, w: 700, h: 600, name: '鐘塔頂', en: 'THE BELL TOWER' }];

  const D = G.DATA;
  const NOTES = [
    { id: 'ab_wings', name: '魂翼', en: 'SOUL-WINGS — 能力', body: ['送葬隊伍最前面的人，背上縫著一對紙翼。', '說是讓亡者走得輕一點。', '能力：在空中再按一次 跳躍，就能 二段跳。屋頂更高的地方、裂谷上空的路，現在都去得了。'] },
    { id: 'ab_bell', name: '引魂鈴', en: 'SOUL-BELL — 能力', body: ['守陵人搖了十八年的鈴。', '鈴舌是骨頭做的。搖的時候，聽得見的不是活人。', '能力：照見 靈道（只有亡者走的路）、解開 亡者的封印。港口底下、地窖深處、裂谷裡，都有它照得見的東西。'] },
    { id: 'x_hold', name: '船艙裡的帳本', en: 'THE HOLD — 舊王港', body: ['最後一筆：運出——棺材一具。', '收件人：無。', '備註：棺材裡的孩子還在哭。船長說，開船。'] },
    { id: 'x_tomb', name: '空墓的碑文', en: 'THE EMPTY TOMB — 王陵', body: ['此處預留給第七位公主。', '墓是空的。墓前的供品，每年都有人換新。', '換的人沒有留下名字。只留下一句：「她會回來。」'] },
    { id: 'x_tower', name: '鐘塔上的刻痕', en: 'THE BELL TOWER — 溫陀', body: ['六千五百七十道刻痕。一天一道。', '最後一道旁邊，有人刻了一隻小小的船。', '船頭朝著王城。'] },
    { id: 'x_crypt', name: '守陵人的值夜簿', en: 'THE CRYPT — 王陵地窖', body: ['王上病了。醫者說，只有被丟棄的那個孩子，能從冥界帶回藥水。', '我把引魂鈴留在鐘室。', '若是她回來了——讓她拿走。'] },
  ];
  for (const n of NOTES) if (!D.codex.notes.some((q) => q.id === n.id)) D.codex.notes.push(n);

  /* ---------------------------------------------------------------- runtime */
  const X = G.Ch1X = {
    SEALS, SPIRIT, CRACKS, ABILITY, INSIDE,
    on() { return G.LEVEL.chapter === 1 && !!(G.game && G.game.save && G.game.save.flags && G.game.player) && !(G.Routes && G.Routes.active) && !(G.Abyss && G.Abyss.active); },
    sv() { return G.game && G.game.save; },
    // abilities: anyone past chapter 1 (or replaying it) already carries both
    has(ab) {
      const sv = this.sv(); if (!sv) return true;
      if (!(G.LEVEL.chapter === 1) || (G.Abyss && G.Abyss.active)) return true;
      return !!sv.flags['ab_' + ab] || (sv.maxChapter || 1) > 1 || !!sv.flags.boss_1;
    },
    canDouble() { return this.has('wings'); },
    // a second jump pressed in the air without the wings: tell where they are (now and then, not every press)
    noWings(game) {
      if (!this.on() || game.time - (this._wingT ?? -99) < 10) return;
      this._wingT = game.time;
      game.toast('還不能二段跳——「魂翼」在送葬大道的屋頂上', 'warn');
    },
    // the doors of the funeral cathedral want the bell and the lullaby
    doorOpen() { const F = this.sv().flags; return this.has('bell') && (!!F.got_musicbox || (this.sv().maxChapter || 1) > 1 || !!F.boss_1); },

    // keep the world in step with what Bari carries: seals stand until the bell, spirit paths appear with it, cracked walls until broken
    sync(game) {
      if (!this.on()) return;
      const F = game.save.flags, bell = this.has('bell');
      const want = [];
      if (!bell) for (const s of SEALS) want.push(Object.assign({ keep: true, noGlow: true, ch1x: 'seal:' + s.id }, s));
      for (const c of CRACKS) if (!F['x_crack_' + c.id]) want.push(Object.assign({ keep: true, noGlow: true, ch1x: 'crack:' + c.id }, c));
      const key = want.map((w) => w.ch1x).join('|');
      if (key !== this._dynKey || !G.Phys.dyn.some((w) => w.ch1x) && want.length) {
        G.Phys.dyn = G.Phys.dyn.filter((w) => !w.ch1x).concat(want);
        this._dynKey = key;
      }
      const has = L.oneways.some((o) => o.spirit);
      if (bell && !has) for (const s of SPIRIT) L.oneways.push(Object.assign({ spirit: true }, s));
      else if (!bell && has) L.oneways = L.oneways.filter((o) => !o.spirit);
    },
    update(game, dt) {
      if (!this.on()) return;
      this.sync(game);
      // the first time in the new city: where the map is, and why the second jump is gone
      if (!game.save.flags.x_intro && game.control) {
        game.save.flags.x_intro = true;
        G.UI.journal('溫陀比看起來更深', '按 M（手機右上「地圖」）打開地圖。二段跳要先找到屋頂上的「魂翼」；地底的「引魂鈴」能照見亡者的路');
      }
      // name cards for the places that are not on the street
      const P = game.player, here = INSIDE.concat(HIGH).find((r) => !r.noCard && P.x > r.x && P.x < r.x + r.w && P.y > r.y && P.y < r.y + r.h);
      const id = here ? here.id : null;
      if (id !== this._inside) {
        if (here && this._inside !== undefined) G.UI.zoneCard(here.name, here.en);
        this._inside = id;
      }
    },
    interactables(game) {
      if (!this.on()) return [];
      const F = game.save.flags, out = [];
      for (const k in ABILITY) {
        const a = ABILITY[k];
        if (this.has(k) || (a.after && (game.encState || {})[a.after] !== 'cleared' && !((game.save && game.save.cleared) || {})[a.after])) continue;
        out.push({ kind: 'ch1x', x: a.x, y: a.y, ref: { ab: k }, label: `拾起「${a.name}」` });
      }
      void F;
      return out;
    },
    interact(game, it) {
      if (it.kind !== 'ch1x') return false;
      const k = it.ref.ab, a = ABILITY[k], F = game.save.flags;
      F['ab_' + k] = true; F['note_' + a.note] = true;
      game.control = false;
      G.SFX.play('pylon'); G.SFX.play('perfectDodge');
      G.FX.ring(a.x, a.y - 60, 10, 260, 0.8, a.col, 6); G.FX.ember(a.x, a.y - 60, 50, a.col, { w: 60, h: 120, up: 160 });
      game.slowmo(0.5, 0.4); game.shake(0.3);
      this.sync(game);
      G.UI.journal(`獲得能力：${a.name}`, k === 'wings' ? '在空中再按一次跳躍：二段跳' : '照見靈道，解開亡者的封印');
      const n = D.codex.notes.find((q) => q.id === a.note);
      setTimeout(() => G.UI.readNote(n, () => { game.control = true; G.Input.clearBuffers(); game.persist(); }), 700);
      return true;
    },
    // cracked walls are something the automatic blade swings at, like a foe
    targets(P) {
      if (!this.on()) return [];
      const F = G.game.save.flags, out = [];
      for (const c of CRACKS) if (!F['x_crack_' + c.id]) out.push({ x: c.x + c.w / 2, y: c.y + c.h, w: c.w, box: { x: c.x, y: Math.max(c.y, P.y - 150), w: c.w, h: 150 }, crack: c });
      return out;
    },
    hit(box) {
      if (!this.on()) return;
      const g = G.game, F = g.save.flags;
      for (const c of CRACKS) {
        if (F['x_crack_' + c.id] || !U.rectsOverlap(box, c)) continue;
        if (g.time - (c._hitT || -9) < 0.12) continue;
        c._hitT = g.time; c._hp = (c._hp ?? c.hp) - 1;
        G.FX.dust(c.x + c.w / 2, Math.min(c.y + c.h, g.player.y) - 60, 10, { w: 30, speed: 220, size: 10 }); G.SFX.play('impact'); g.shake(0.15);
        if (c._hp <= 0) {
          F['x_crack_' + c.id] = true; this.sync(g);
          G.FX.shards(c.x + c.w / 2, g.player.y - 80, 40, '#c9b49a', 500); G.FX.dust(c.x + c.w / 2, g.player.y, 30, { w: 80, speed: 320, size: 16 });
          G.SFX.play('door'); g.toast('牆後有東西', 'item'); g.persist();
        }
      }
    },

    /* ---------------- drawing ---------------- */
    // the crypt / hold backdrop: painted over the city layers wherever the camera looks inside
    backdrop(ctx, cam, W, H, S, time) {
      if (!this.on()) return;
      const k = S;   // world → screen scale for the play plane
      for (const r of INSIDE) {
        const x0 = W / 2 + (r.x - cam.x) * k, y0 = H / 2 + (r.y - cam.y) * k, x1 = x0 + r.w * k, y1 = y0 + r.h * k;
        if (x1 < 0 || x0 > W || y1 < 0 || y0 > H) continue;
        ctx.save();
        ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
        const gr = ctx.createLinearGradient(0, y0, 0, y1);
        gr.addColorStop(0, '#1b1520'); gr.addColorStop(0.5, '#120e16'); gr.addColorStop(1, '#0a080c');
        ctx.fillStyle = gr; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        // stone courses and arches, parallax a touch behind the play plane
        const par = 0.85, ox = (cam.x * (1 - par)) * k;
        ctx.strokeStyle = 'rgba(70,58,72,0.35)'; ctx.lineWidth = Math.max(1, 1.2 * k);
        for (let yy = r.y + 40; yy < r.y + r.h; yy += 46) { const sy = H / 2 + (yy - cam.y) * k; ctx.beginPath(); ctx.moveTo(x0, sy); ctx.lineTo(x1, sy); ctx.stroke(); }
        const archW = 420;
        for (let ax = Math.floor((r.x) / archW) * archW; ax < r.x + r.w; ax += archW) {
          const sx = W / 2 + (ax - cam.x) * k + ox, top = H / 2 + (r.y + 60 - cam.y) * k, bot = H / 2 + (r.y + 470 - cam.y) * k, aw = archW * 0.36 * k;
          ctx.fillStyle = 'rgba(6,4,8,0.55)';
          ctx.beginPath(); ctx.moveTo(sx - aw, bot); ctx.lineTo(sx - aw, top + aw); ctx.arc(sx, top + aw, aw, Math.PI, 0); ctx.lineTo(sx + aw, bot); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(120,96,110,0.35)'; ctx.stroke();
          // a candle niche in every other bay
          if (((ax / archW) | 0) % 2 === 0) {
            const cx = sx + aw * 1.6, cy = H / 2 + (r.y + 300 - cam.y) * k, fl = 0.75 + 0.25 * Math.sin(time * 9 + ax) * Math.sin(time * 3.3 + ax * 0.1);
            const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90 * k);
            cg.addColorStop(0, `rgba(255,190,120,${0.35 * fl})`); cg.addColorStop(1, 'rgba(255,190,120,0)');
            ctx.fillStyle = cg; ctx.fillRect(cx - 90 * k, cy - 90 * k, 180 * k, 180 * k);
            ctx.fillStyle = `rgba(255,220,170,${0.9 * fl})`; ctx.fillRect(cx - 2 * k, cy - 10 * k, 4 * k, 8 * k);
            ctx.fillStyle = '#d9cbb3'; ctx.fillRect(cx - 3 * k, cy - 2 * k, 6 * k, 14 * k);
          }
        }
        // where the chasm opens to the sky, the stone fades out upward
        if (r.fadeFrom != null) {
          const fx = W / 2 + (r.fadeFrom - cam.x) * k;
          if (fx < x1) {
            ctx.globalCompositeOperation = 'destination-out';
            const fg = ctx.createLinearGradient(0, y0, 0, H / 2 + (r.y + 420 - cam.y) * k);
            fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = fg; ctx.fillRect(Math.max(fx, x0), y0, x1 - Math.max(fx, x0), (r.h) * k);
            ctx.globalCompositeOperation = 'source-over';
          }
        }
        ctx.restore();
      }
    },
    // in the play plane: seals, spirit paths, cracked walls, ability shrines
    drawWorld(ctx, game) {
      if (!this.on()) return;
      const t = game.time, F = game.save.flags, bell = this.has('bell');
      // spirit paths: a faint shimmer before the bell (something is there), solid ghost-light after
      for (const s of SPIRIT) {
        const a = bell ? 0.75 : 0.1 + 0.06 * Math.sin(t * 2 + s.x);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, s.y - 18, 0, s.y + 10);
        g.addColorStop(0, 'rgba(160,230,255,0)'); g.addColorStop(1, `rgba(160,230,255,${a * 0.5})`);
        ctx.fillStyle = g; ctx.fillRect(s.x, s.y - 18, s.w, 28);
        ctx.strokeStyle = `rgba(200,245,255,${a})`; ctx.lineWidth = 2; ctx.setLineDash([10, 6]); ctx.lineDashOffset = -t * 20;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.w, s.y); ctx.stroke();
        ctx.restore();
      }
      // seals of the dead
      if (!bell) for (const s of SEALS) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const p = 0.5 + 0.5 * Math.sin(t * 1.8 + s.x);
        ctx.fillStyle = `rgba(255,200,170,${0.18 + p * 0.12})`; ctx.fillRect(s.x, s.y - 4, s.w, s.h + 8);
        ctx.strokeStyle = `rgba(255,214,190,${0.55 + p * 0.3})`; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) { const xx = s.x + (i + 0.5) * s.w / 4; ctx.beginPath(); ctx.moveTo(xx - 8, s.y); ctx.lineTo(xx + 8, s.y + s.h); ctx.moveTo(xx + 8, s.y); ctx.lineTo(xx - 8, s.y + s.h); ctx.stroke(); }
        ctx.restore();
        ctx.save(); ctx.font = '600 16px "Noto Serif TC", serif'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,224,200,${0.6 + p * 0.3})`;
        ctx.fillText('封', s.x + s.w / 2, s.y - 12);
        // close by, the seal says what it wants (written on the world, so it never covers dialogue)
        const P = game.player, d = Math.hypot(P.x - (s.x + s.w / 2), (P.y - s.y) * 1.5);
        if (d < 260) {
          ctx.globalAlpha = U.clamp((260 - d) / 80, 0, 1);
          ctx.font = '500 13px "Noto Sans TC", sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(12,8,14,0.85)';
          ctx.strokeText(s.name + '：需要能照見亡者的東西', s.x + s.w / 2, s.y - 34); ctx.fillStyle = 'rgba(255,224,200,0.95)'; ctx.fillText(s.name + '：需要能照見亡者的東西', s.x + s.w / 2, s.y - 34);
        }
        ctx.restore();
      }
      // cracked walls: stone with light leaking through
      for (const c of CRACKS) {
        if (F['x_crack_' + c.id]) continue;
        ctx.save();
        ctx.fillStyle = '#2a2329'; ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.strokeStyle = '#0d0a0f'; ctx.lineWidth = 2;
        for (let yy = c.y; yy < c.y + c.h; yy += 38) { ctx.beginPath(); ctx.moveTo(c.x, yy); ctx.lineTo(c.x + c.w, yy); ctx.stroke(); }
        ctx.globalCompositeOperation = 'lighter';
        const dmg = 1 - (c._hp ?? c.hp) / c.hp;
        ctx.strokeStyle = `rgba(255,214,150,${0.35 + dmg * 0.5})`; ctx.lineWidth = 1.6;
        const r = U.mulberry32(7);
        for (let i = 0; i < 3 + dmg * 6; i++) { let x = c.x + r() * c.w, y = c.y + 60 + r() * (c.h - 120); ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 24; y += 14 + r() * 20; ctx.lineTo(x, y); } ctx.stroke(); }
        ctx.restore();
      }
      // ability shrines
      for (const k in ABILITY) {
        const a = ABILITY[k];
        if (this.has(k)) continue;
        const locked = a.after && (game.encState || {})[a.after] !== 'cleared' && !((game.save && game.save.cleared) || {})[a.after];
        const bob = Math.sin(t * 2) * 6, y = a.y - 90 + bob;
        ctx.save();
        ctx.fillStyle = '#1b1620'; ctx.fillRect(a.x - 26, a.y - 34, 52, 34); ctx.fillStyle = '#2b2430'; ctx.fillRect(a.x - 32, a.y - 40, 64, 8);
        ctx.globalCompositeOperation = 'lighter';
        const gl = ctx.createRadialGradient(a.x, y, 0, a.x, y, 80);
        gl.addColorStop(0, U.rgba(a.col, locked ? 0.2 : 0.55)); gl.addColorStop(1, U.rgba(a.col, 0));
        ctx.fillStyle = gl; ctx.fillRect(a.x - 80, y - 80, 160, 160);
        ctx.strokeStyle = U.rgba(a.col, locked ? 0.4 : 0.95); ctx.fillStyle = U.rgba(a.col, locked ? 0.25 : 0.7); ctx.lineWidth = 2;
        if (k === 'wings') {
          for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(a.x, y); ctx.quadraticCurveTo(a.x + s * 30, y - 34, a.x + s * 46, y - 12); ctx.quadraticCurveTo(a.x + s * 30, y - 6, a.x + s * 38, y + 10); ctx.quadraticCurveTo(a.x + s * 18, y + 6, a.x, y); ctx.fill(); ctx.stroke(); }
        } else {
          ctx.beginPath(); ctx.moveTo(a.x - 14, y + 14); ctx.quadraticCurveTo(a.x - 14, y - 18, a.x, y - 20); ctx.quadraticCurveTo(a.x + 14, y - 18, a.x + 14, y + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(a.x, y + 18, 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    },
    // the funeral door's answer when it stays shut
    doorRefusal(game) {
      const F = game.save.flags, need = [];
      if (!this.has('bell')) need.push('鈴的形狀');
      if (!F.got_musicbox) need.push('音樂盒的形狀');
      game.toast(`送葬門上有凹槽：${need.join('、')}`, 'warn');
      if (!F.x_doorHint) { F.x_doorHint = true; G.UI.journal('送葬門', '門上的凹槽要「引魂鈴」與「諾娜的音樂盒」——鈴在王陵地窖的鐘室，音樂盒在屋頂上'); }
    },
  };
})(window.G);

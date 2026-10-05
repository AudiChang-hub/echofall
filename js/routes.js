'use strict';
/* ECHOFALL — 岔路 (forks): halfway through every chapter the way ahead has collapsed, and two doors offer two new
   districts that both come out beyond the rubble. 險路 is the fighting road (more fights, an elite, rare gear);
   幽徑 is the searching road (climbs, hidden chests, smithing stones, a letter). Pick either: no tokens to collect,
   no backtracking. Once a road is walked the rubble stays open, and both doors stay for anyone who wants to farm.
   Districts are built from modules (steps, ledges, ditches, arenas, an elite hall, a shrine) seeded per chapter,
   so each chapter's two roads always have the same shape. They use the chapter's own art, foes and gravity. */
(function (G) {
  const U = G.U, D = G.DATA;

  // names and the letter each road leaves behind (Elden Ring style: terse, elliptical)
  const LORE = {
    1: { a: ['送葬大道', 'THE FUNERAL AVENUE', '抬棺人的日誌', ['第六千五百七十天。棺材還是空的。', '國王還沒斷氣，我們還在走。', '隊伍最前面的人，已經換過三代了。']],
         b: ['王陵地窖', 'THE ROYAL CRYPT', '刻在空墓上的字', ['此處預留給第七位公主。', '（下方，另一種筆跡）她沒有死。', '是被丟掉的。']] },
    2: { a: ['亡者山道', 'THE PATH OF THE DEAD', '山門守衛的值班表', ['放行亡者：零。', '十八年來，每天都寫零。', '今天也是。']],
         b: ['無名者祠', 'THE SHRINE OF THE NAMELESS', '祠裡的名牌', ['牌子上的名字都被刮掉了。', '交出名字的人，在這裡留下最後一個字。', '有一塊是空白的。像是在等誰。']] },
    3: { a: ['逆掘坑道', 'THE COUNTER-TUNNEL', '掘路人的鎬柄', ['柄上刻著回家的方向。', '刻了很多次。', '每一次，方向都不一樣。']],
         b: ['回音晶洞', 'THE ECHO GEODE', '晶壁上的刮痕', ['從這裡往上挖，就是我的村子。', '我已經挖了十八年。', '上面的人，還記得我嗎。']] },
    4: { a: ['後台迴廊', 'BACKSTAGE', '泡爛的節目單', ['今晚的演出照常進行。', '觀眾請勿離席。', '演員，也是。']],
         b: ['淹沒的包廂', 'THE DROWNED BOXES', '包廂裡的觀劇鏡', ['鏡片後面還留著一層薄霧。', '像是有人看到最後一幕，忘了眨眼。']] },
    5: { a: ['斷錨甲板', 'THE BROKEN ANCHOR DECK', '錨手的結繩', ['每一個結，是一個掉進虛無裡的人。', '繩子，已經不夠長了。']],
         b: ['失重花園', 'THE WEIGHTLESS GARDEN', '園丁的標籤', ['這株不需要土。', '它只需要有人記得替它澆水。', '（標籤上的日期，是十八年前。）']] },
    6: { a: ['船底槳艙', 'THE OAR DECK', '划槳人的手套', ['指尖磨穿了。', '他們說，最後一個划槳的人把船划到河中央，然後停下來等。', '沒有人說，他在等什麼。']],
         b: ['孩童艙', "THE CHILDREN'S CABIN", '黑板上的粉筆字', ['今天學的歌：渡河謠。', '第一句，大家都會了。', '第二句，到了對岸再教。']] },
    7: { a: ['褪色小徑', 'THE FADING PATH', '一截褪色的布條', ['上面寫的字，已經讀不出來了。', '只看得出，是寫給一個孩子的。']],
         b: ['空白之庭', 'THE BLANK COURT', '無字的家書', ['整張紙都是空白的。', '寄信的人，在寫下第一個字之前就忘了。']] },
    8: { a: ['判官迴廊', "THE JUDGES' GALLERY", '最後一張判決書', ['罪名：出生。', '判決：無。', '判決書沒有署名。']],
         b: ['無聲合唱席', 'THE SILENT CHOIR LOFT', '合唱席的名牌', ['每張椅子上都放著名牌。', '有一張，寫著妳的名字——妳交出去的那一個。']] },
  };
  const ROAD = {
    a: { name: '險路', sub: '連戰・菁英・稀有裝備', icon: '⚔', ico: 'pact_dmg', col: '#ff8f9f' },
    b: { name: '幽徑', sub: '攀登・寶箱・事件・文書', icon: '❖', ico: 'chest', col: '#9cf7b0' },
  };
  // the letters join the archive
  for (const ch in LORE) for (const r of ['a', 'b']) {
    const [zh, en, title, body] = LORE[ch][r];
    if (!D.codex.notes.some((n) => n.id === `rt${ch}${r}`)) D.codex.notes.push({ id: `rt${ch}${r}`, name: title, en: `${en} — ${zh}`, body });
  }

  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  const R = G.Routes = {
    ROAD, LORE, active: null, forks: {},
    /* ------------------------------------------------ where the way collapses */
    // a flat stretch past a middle pylon, clear of story triggers, fights and the boss approach
    fork(ch) {
      if (this.forks[ch] !== undefined) return this.forks[ch];
      const lv = G.Chapters.levelOf(ch); if (!lv) return null;
      // main-path ground only: thick bodies, not roofs, gantries or crates
      const ground = (x) => { let b = null; for (const s of lv.solids) if (s.h >= 200 && s.kind !== 'wall' && s.kind !== 'invisible' && x >= s.x && x <= s.x + s.w && (!b || s.y < b.y)) b = s; return b; };
      const encs = Object.values(lv.encounters || {});
      const bossE = encs.find((E) => E.boss);
      const bossTr = (lv.triggers || []).find((t) => t.startEnc && bossE && lv.encounters[t.startEnc] === bossE);
      const limit = Math.min(bossE && bossE.arena ? bossE.arena[0] : lv.bounds[1], bossTr ? bossTr.x : 1e9) - 900;
      // hard: notes/items/NPCs/pylons keep their space; the rubble never splits a fight; doors never sit inside an arena
      const spots = [], fights = [], arenas = [], wakes = [];
      for (const n of (lv.notes || []).concat(lv.items || [])) spots.push([n.x - 100, n.x + 100]);
      for (const n of lv.npcs || []) spots.push([n.x - 160, n.x + 160]);
      for (const p of lv.pylons || []) spots.push([p.x - 200, p.x + 200]);
      for (const E of encs) {
        const xs = (E.waves || []).flat().map((d) => d.x);
        if (E.trigger != null) xs.push(E.trigger);
        if (E.arena) { xs.push(E.arena[0], E.arena[1]); arenas.push([E.arena[0] - 60, E.arena[1] + 60]); }
        if (xs.length) fights.push([Math.min(...xs) - 120, Math.max(...xs) + 120]);
        // a respawning fight wakes anywhere from its trigger to trigger + 900 (game.js): doors there would bring
        // the same foes back every time you return to them
        if (E.respawn && E.trigger != null && !E.manual) wakes.push([E.trigger - 60, (E.arena ? E.arena[1] : E.trigger + 900) + 60]);
      }
      const hit = (list, a, b) => list.some(([p, q]) => a < q && b > p);
      const x0 = lv.start.x + 900, mid = (x0 + limit) / 2;
      let best = null, bestS = 1e9;
      // doors that wake a respawning fight every time you come back to them feel like the foes never stay dead:
      // first look for a spot clear of every fight window, and only then settle for one beside a fight
      for (const strict of [true, false]) {
      if (best) break;
      for (let x = x0; x <= limit; x += 20) {
        const g0 = ground(x); if (!g0) continue;
        let ok = true;
        for (let dx = -470; dx <= 90 && ok; dx += 15) { const g = ground(x + dx); if (!g || g.y !== g0.y) ok = false; }
        if (!ok || hit(spots, x - 470, x + 90) || hit(fights, x - 20, x + 40) || hit(arenas, x - 470, x + 90)) continue;
        // soft: prefer the middle of the chapter, and doors that are not in the middle of a roaming fight
        if (strict && hit(wakes, x - 470, x + 90)) continue;
        const sc = Math.abs(x - mid) + (hit(fights, x - 470, x - 20) ? 1500 : 0);
        if (sc < bestS) { bestS = sc; best = { x, y: g0.y, kind: g0.kind }; }
      }
      }
      return (this.forks[ch] = best);
    },
    done(sv, ch) { return !!(sv.flags['fork_' + ch]); },
    // rubble blocks the way only on the near side, and only until a road has been walked (or the chapter is done)
    walls(game) {
      this.here = null;
      if (this.active || G.Abyss.active) return;
      const ch = G.LEVEL.chapter || 1, f = this.fork(ch), F = game.save.flags;
      if (!f) return;
      this.here = f;
      f.open = !!(F['fork_' + ch] || F['ch_done_' + ch]);
    },
    // checked every frame: the wall only stands while Rinne is on the near side (an old save beyond it is never trapped)
    update(game) {
      const f = this.here, P = game.player; if (!f || !P) return;
      const has = G.Phys.dyn.some((w) => w.fork);
      const want = !f.open && P.x < f.x;
      if (want && !has) G.Phys.dyn.push({ x: f.x - 10, y: f.y - 1800, w: 40, h: 1800, keep: true, fork: true });
      else if (!want && has) G.Phys.dyn = G.Phys.dyn.filter((w) => !w.fork);
    },
    doors(f) { return f.doors || (f.doors = [{ road: 'a', x: f.x - 400 }, { road: 'b', x: f.x - 200 }]); },
    interactables(game) {
      const f = this.here; if (!f || this.active || G.Abyss.active || game.arena) return [];
      if (game.enemies.some((e) => !e.dead && Math.abs(e.x - game.player.x) < 600)) return [];   // not with foes at your back
      const F = game.save.flags, ch = G.LEVEL.chapter || 1;
      return this.doors(f).map((d) => ({ kind: 'road', x: d.x, y: f.y, ref: d, label: `進入「${LORE[ch][d.road][0]}」（${ROAD[d.road].name}${F[`road_${ch}${d.road}`] ? '・已走過' : ''}）` }));
    },
    draw(ctx, game) {
      const f = this.here; if (!f || this.active || G.Abyss.active) return;
      const t = game.time, F = game.save.flags, ch = G.LEVEL.chapter || 1;
      if (!f.open) drawRubble(ctx, f.x + 10, f.y, t);
      for (const d of this.doors(f)) {
        const walked = F[`road_${ch}${d.road}`];
        G.Abyss.drawArch(ctx, d, f.y, { col: ROAD[d.road].col, icon: ROAD[d.road].icon, ico: ROAD[d.road].ico, name: `${ROAD[d.road].name}・${LORE[ch][d.road][0]}`, sub: walked ? '已走過' : ROAD[d.road].sub }, t, game.player);
      }
    },

    /* ------------------------------------------------ building a district */
    enter(game, road) {
      const ch = G.LEVEL.chapter || 1, f = this.fork(ch); if (!f) return;
      // walking a road is not resting: fights already won on the main path stay won when you come back
      this.won = Object.keys(game.encState).filter((id) => game.encState[id] === 'cleared');
      game.control = false; G.SFX.play('pylon');
      G.UI.curtain(true);
      setTimeout(() => this.build(game, ch, road, f), 420);
    },
    build(game, ch, road, f) {
      const base = G.Chapters.get(ch) || G.Chapters.byId[1], lv = G.Chapters.levelOf(ch);
      const r = rng(4813 + ch * 977 + (road === 'b' ? 31 : 0));
      const T = G.ENEMY_TYPES, K = f.kind, fy = f.y, id = (s) => `rt${ch}${road}_${s}`;
      const pool = Object.keys(T).filter((k) => (ch === 1 ? ['murmur', 'sentinel', 'shrieker'].includes(k) : k.startsWith('c' + ch + '_')) && !T[k].boss && !T[k].elite && !T[k].summon && k !== 'phantom');
      const deck = []; const draw = () => { if (!deck.length) deck.push(...pool.slice().sort(() => r() - 0.5)); return deck.pop(); };
      const mk = (t, x, y0) => (T[t] && T[t].fly ? { t, x, y: -240 } : { t, x, ...(y0 != null ? { y: y0 } : {}) });
      const wave = (n, a, b, y0) => Array.from({ length: n }, (_, i) => mk(draw(), Math.round(U.lerp(a, b, n > 1 ? i / (n - 1) : 0.5)), y0));
      const solids = [], oneways = [], encounters = {}, items = [], notes = [];
      const ox = f.x;   // same stretch of sky and distant scenery as the doors
      let x = ox;
      const floor = (x0, w, y = fy) => solids.push({ x: x0, y, w, h: fy + 900 - y, kind: K });
      const lore = LORE[ch][road];
      const chest = (cx, cy, key, label, take) => items.push({ id: id(key), x: cx, y: cy, flag: `${id(key)}_got`, name: label, kind: 'key', sfx: 'pickup', chest: true, onTake: take });
      const M = {
        entry() { floor(x, 600); x += 600; },
        arena(n) {
          const w = 1150; floor(x, w);
          encounters[id('e' + Object.keys(encounters).length)] = { trigger: x + 220, arena: [x + 40, x + w - 40], respawn: true, wallBottom: fy + 40, waves: [wave(n, x + 520, x + w - 140), wave(Math.max(2, n - 1), x + 300, x + w - 140)] };
          x += w;
        },
        steps() {
          const h1 = 95, h2 = 190;
          floor(x, 180); floor(x + 180, 240, fy - h1); floor(x + 420, 380, fy - h2); floor(x + 800, 240, fy - h1); floor(x + 1040, 160);
          if (r() < 0.6) oneways.push({ x: x + 520, y: fy - h2 - 150, w: 180 });
          x += 1200;
        },
        // a dungeon-master event: a lone shrine lit in the dark (js/events.js)
        event() {
          floor(x, 760);
          items.push({ id: id('ev'), x: x + 380, y: fy, flag: `${id('ev')}_seen`, name: '？', kind: 'key', event: true });
          x += 760;
        },
        ledge(key, reward, locked) {
          floor(x, 1000);
          const lx = x + 160 + Math.floor(r() * 80);
          oneways.push({ x: lx, y: fy - 150, w: 180 }, { x: lx + 230, y: fy - 300, w: 180 }, { x: lx + 460, y: fy - 450, w: 240 });
          chest(lx + 580, fy - 450, key, '遺留的箱子', reward);
          if (locked) items[items.length - 1].locked = true;
          x += 1000;
        },
        ditch(n) {
          const w = 1300, d = 210;
          floor(x, 300); floor(x + 300, 700, fy + d); floor(x + 860, 140, fy + d - 105); floor(x + 1000, 300);
          oneways.push({ x: x + 420, y: fy - 40, w: 160 }, { x: x + 640, y: fy - 40, w: 160 });
          encounters[id('e' + Object.keys(encounters).length)] = { trigger: x + 380, arena: [x + 310, x + 990], respawn: true, wallBottom: fy + d + 40, waves: [wave(n, x + 520, x + 940, fy + d)] };
          x += w;
        },
        elite() {
          const w = 1350; floor(x, w);
          const el = T['c' + ch + '_elite'] ? 'c' + ch + '_elite' : 'graves';
          encounters[id('elite')] = { trigger: x + 220, arena: [x + 40, x + w - 40], respawn: true, wallBottom: fy + 40, waves: [[mk(el, x + 900)], wave(3, x + 400, x + w - 160)] };
          x += w;
        },
        shrine(take) {
          const w = 900; floor(x, w);
          notes.push({ id: `rt${ch}${road}`, x: x + 260, y: fy });
          chest(x + 470, fy, 'shrine', road === 'a' ? '險路盡頭的箱子' : '幽徑盡頭的箱子', take);
          R.exitX = x + 720;
          x += w;
        },
      };
      const sv = game.save, gearAt = (tier) => (g) => G.Gear.spawnLoot(g, { cx: g.player.x + 60, cy: g.player.y - 80, y: g.player.y }, G.Gear.roll(ch, tier, 0.1), 0, 1);
      const stones = (n) => (g) => { sv.stones = (sv.stones || 0) + n; g.toast(`鍛造石　+${n}`, 'item'); };
      const crystals = (n) => () => G.Mirror.gain(n, '寶箱');
      M.entry();
      if (road === 'a') {
        M.arena(3); M.steps(); M.event(); M.ditch(3); M.arena(4); M.elite();
        M.shrine((g) => { gearAt(2)(g); crystals(15)(g); });
      } else {
        M.steps(); M.ledge('c1', (g) => { stones(2)(g); sv.shards += 120; g.toast('殘響碎片　+120', 'good'); });
        M.arena(3); M.event(); M.ditch(2); M.ledge('c2', crystals(12), true); M.arena(3);
        M.shrine((g) => { gearAt(1)(g); stones(2)(g); });
      }
      const x1 = x;
      // one continuous body per stretch of equal height, so the ground art has no seams
      solids.sort((p, q) => p.x - q.x);
      for (let i = solids.length - 1; i > 0; i--) {
        const p = solids[i - 1], q = solids[i];
        if (p.y === q.y && p.kind === q.kind && Math.abs(p.x + p.w - q.x) < 1) { p.w += q.w; solids.splice(i, 1); }
      }
      solids.push({ x: ox - 560, y: fy - 1800, w: 60, h: 1800 + 900, kind: 'wall' }, { x: x1, y: fy - 1800, w: 60, h: 1800 + 900, kind: 'wall' });
      const z0 = (lv.zones || []).filter((z) => z.x <= f.x).pop() || {};
      const tint = lv.tintAt ? lv.tintAt(f.x) : 0;
      const level = {
        start: { x: ox + 140, y: fy }, bounds: [ox - 500, x1], gravity: lv.gravity || 1,
        solids, oneways, pylons: [], notes, items, npcs: [], triggers: [], encounters,
        zones: [{ x: -1e9, name: lore[0], en: lore[1], tint: z0.tint || 0, music: z0.music || (base.music && base.music.explore) || 'explore', amb: z0.amb }],
        tintAt: () => tint,
      };
      const bh = base.hooks || {};
      const safe = (fn) => (fn ? function () { try { return fn.apply(this, arguments); } catch (e) { return undefined; } } : undefined);
      const def = Object.assign(Object.create(base), {
        level, intro: null, enterDialog: null, musicAt: null, ambienceAt: null,
        // the chapter's gameplay-plane props are pinned to its own terrain (stations, houses, railcars): keep the backdrops only
        bg: base.bg ? Object.assign({}, base.bg, { props: () => [] }) : base.bg,
        // sky and weather only: the chapter's set pieces (stations, houses, cars) are pinned to its own terrain
        hooks: { drawSky: safe(bh.drawSky), drawAtmos: safe(bh.drawAtmos),
          drawFront: (ctx, g) => R.drawExit(ctx, g) },
      });
      G.Chapters.loadDef(def);
      this.active = { ch, road, f };
      game.resetWorld();
      const P = game.player;
      P.reset(level.start.x, fy); P.vx = 0;
      game.cam.x = game.cam.tx = P.x + 260; game.cam.y = fy - 160; game.camGround = fy;
      game.state = 'play'; game.fadeA = 1; game.fadeTarget = 0; game.lastZone = null;
      G.UI.showHud(true);
      G.Music.play(level.zones[0].music);
      requestAnimationFrame(() => requestAnimationFrame(() => G.UI.curtain(false)));
      setTimeout(() => { game.control = true; G.Input.clearBuffers(); }, 500);
    },
    drawExit(ctx, game) {
      const a = this.active; if (!a) return;
      for (const it of G.LEVEL.items) if (it.chest && !game.save.flags[it.flag]) drawChest(ctx, it.x, it.y, game.time);
      this.exitDoor = this.exitDoor && this.exitDoor.x === this.exitX ? this.exitDoor : { x: this.exitX };
      G.Abyss.drawArch(ctx, this.exitDoor, a.f.y, { col: '#ffd9a8', icon: '⇢', ico: 'exit', name: '回到主路', sub: G.Chapters.info(a.ch).title }, game.time, game.player);
    },
    exitNear() { const a = this.active; return a ? [{ kind: 'roadExit', x: this.exitX, y: a.f.y, label: '穿過去，回到主路' }] : []; },
    // out the far side: the main chapter again, standing just beyond the rubble
    leave(game) {
      const a = this.active; if (!a) return;
      const F = game.save.flags;
      F['fork_' + a.ch] = true; F[`road_${a.ch}${a.road}`] = true;
      game.control = false; G.SFX.play('door');
      G.UI.curtain(true);
      setTimeout(() => {
        this.detach();
        game.resetWorld();
        for (const id of this.won || []) if (game.encState[id] !== undefined) { game.encState[id] = 'cleared'; game.save.cleared[id] = true; }
        this.won = null;
        const P = game.player;
        P.reset(a.f.x + 170, a.f.y); P.facing = 1;
        game.cam.x = game.cam.tx = P.x + 200; game.cam.y = a.f.y - 160; game.camGround = a.f.y;
        game.state = 'play'; game.fadeA = 1; game.fadeTarget = 0;
        G.Music.play(game.zoneMusic());
        game.persist();
        requestAnimationFrame(() => requestAnimationFrame(() => G.UI.curtain(false)));
        setTimeout(() => { game.control = true; G.Input.clearBuffers(); const z = G.LEVEL.zoneAt(P.x); game.lastZone = z; if (z) G.UI.zoneCard(z.name, z.en); }, 500);
      }, 420);
    },
    // back to the chapter proper (leaving, dying, quitting, travelling)
    detach() {
      const a = this.active; if (!a) return;
      this.active = null;
      G.Chapters.load(a.ch);
    },
    // a death on a road drops the shards at the doors, where the main chapter can find them again
    dropAt() { const a = this.active; return a ? { x: a.f.x - 300, y: a.f.y } : null; },
  };

  // an iron-bound chest, lid breathing light
  function drawChest(ctx, x, y, t) {
    ctx.save();
    ctx.fillStyle = '#2a2018'; ctx.strokeStyle = '#0b0612'; ctx.lineWidth = 3;
    ctx.fillRect(x - 26, y - 30, 52, 30); ctx.strokeRect(x - 26, y - 30, 52, 30);
    ctx.beginPath(); ctx.moveTo(x - 28, y - 30); ctx.quadraticCurveTo(x, y - 52, x + 28, y - 30); ctx.closePath(); ctx.fillStyle = '#3a2c20'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9a25a'; ctx.fillRect(x - 3, y - 34, 6, 10);
    ctx.strokeStyle = '#6b5434'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 16, y - 30); ctx.lineTo(x - 16, y); ctx.moveTo(x + 16, y - 30); ctx.lineTo(x + 16, y); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,210,140,${0.25 + 0.15 * Math.sin(t * 3 + x)})`; ctx.fillRect(x - 24, y - 32, 48, 3);
    ctx.restore();
  }
  // the collapsed way: a slump of masonry with resonance bleeding through the cracks
  function drawRubble(ctx, x, y, t) {
    ctx.save();
    const r = rng(77);
    ctx.fillStyle = '#17141c'; ctx.strokeStyle = '#0b0612'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 90, y);
    const pts = [[-70, -60], [-50, -130], [-20, -170], [5, -240], [30, -200], [55, -150], [80, -70], [100, 0]];
    for (const [px, py] of pts) ctx.lineTo(x + px, y + py);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const bx = x - 70 + r() * 150, by = y - 20 - r() * 170, s = 14 + r() * 22;
      ctx.fillStyle = r() < 0.5 ? '#221d29' : '#2a2431';
      ctx.beginPath(); ctx.moveTo(bx - s, by); ctx.lineTo(bx - s * 0.3, by - s * 0.8); ctx.lineTo(bx + s, by - s * 0.4); ctx.lineTo(bx + s * 0.6, by + s * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,120,150,${0.35 + 0.15 * Math.sin(t * 2.2)})`; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); let cx = x - 40 + i * 25, cy = y - 10; ctx.moveTo(cx, cy); for (let k = 0; k < 5; k++) { cx += (r() - 0.5) * 30; cy -= 22 + r() * 18; ctx.lineTo(cx, cy); } ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.font = '600 13px "Noto Serif TC", serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#0b0612'; ctx.strokeText('去路已崩塌', x + 5, y - 262); ctx.fillStyle = 'rgba(239,233,223,.8)'; ctx.fillText('去路已崩塌', x + 5, y - 262);
    ctx.restore();
  }
})(window.G);

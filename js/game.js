'use strict';
/* ECHOFALL — game orchestration: loop, camera, encounters, checkpoints, interactables, rendering */
(function (G) {
  const U = G.U, L = G.LEVEL, PI = Math.PI, TAU = PI * 2;
  const VIEW_H = 640;

  const FREEZE = new Set(['pylon', 'gear', 'build', 'travel', 'trade', 'codex', 'savecode', 'settings', 'controls', 'note', 'relic', 'boon', 'choice', 'pause', 'abyss', 'abyssEnd', 'classSel', 'charSheet', 'event', 'dice']);
  const DEFAULT_SETTINGS = { master: 0.8, music: 0.6, sfx: 0.85, shake: 1, flashes: true, hints: true, textSpeed: 1, touchAssist: true, fps: 'auto' };

  const Game = G.game = {
    state: 'boot', time: 0, realTime: 0, dtVis: 0,
    enemies: [], projectiles: [], hazards: [], pickups: [],
    arena: null, control: false, combatNear: false,
    cam: { x: 0, y: -160, zoom: 1, tx: 0, ty: -160 }, trauma: 0, hitstopT: 0, slowT: 0, slowScale: 1, timeScale: 1,
    cineT: 0, cineTarget: null, letterbox: 0, fadeA: 1, fadeTarget: 0, dmgFlash: 0,
    settings: null, save: null, diff: G.DATA.difficulty.normal, stats: null,

    init() {
      this.canvas = document.getElementById('game');
      this.ctx = this.canvas.getContext('2d');
      this.settings = Object.assign({}, DEFAULT_SETTINGS, G.Store.get('settings', {}));
      G.Quality.pref = this.settings.quality || 'auto';
      G.Input.init(this.canvas);
      // if the browser drops the GPU context under memory pressure, rebuild caches instead of dying
      this.canvas.addEventListener('contextlost', (e) => { e.preventDefault(); this.ctxLost = true; });
      this.canvas.addEventListener('contextrestored', () => { this.ctxLost = false; G.BG.flush(); this.resize(); });
      G.BG.init();
      G.Chapters.load(1);
      window.addEventListener('resize', () => this.resize());
      this.resize();
      this.save = this.defaultSave('normal');
      this.diff = G.DATA.difficulty.normal; this.stats = this.save.stats;
      this.player = new G.Player(this);
      this.player.setState('rest'); this.player.x = 420; this.player.y = 0;
      this.ode = { x: 380, y: -160, talk: 0 };
      G.UI.init();
      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    },
    defaultSave(diff) {
      return { v: 1, diff, chapter: 1, up: {}, shards: 0, tonic: 3, flags: {}, equipped: [], boons: {}, checkpoint: null, cleared: {}, drop: null, stats: { time: 0, deaths: 0, parries: 0, dodges: 0, exec: 0, hits: 0, hitsTaken: 0, kills: 0 } };
    },
    applyQuality() {
      G.Quality.pref = this.settings.quality || 'auto';
      G.BG.flush(); this.resize();
    },
    applySettings() {
      const s = this.settings;
      G.Audio.setVolumes(s.master, s.music, s.sfx);
      G.Store.set('settings', s);
    },
    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      // cap internal resolution so HiDPI screens stay smooth (and phones/tablets stay inside their memory budget)
      const low = G.Quality.low;
      const dpr = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 2, Math.sqrt((low ? 0.75e6 : 2.4e6) / (w * h)));
      this.canvas.width = Math.floor(w * dpr); this.canvas.height = Math.floor(h * dpr);
      this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
      this.W = this.canvas.width; this.H = this.canvas.height;
      // phones frame the action closer (the heroine is ~40% bigger on screen); tablets a little closer
      const touch = G.Fullscreen && G.Fullscreen.isTouch;
      this.viewH = touch ? (h < 520 ? 450 : 560) : VIEW_H;
      this.baseS = Math.min(this.H / this.viewH, this.W / (980 * this.viewH / VIEW_H));
      G.BG.setScale(this.baseS);
    },

    /* ------------------------------ flow ------------------------------ */
    hasSave() { const s = G.Store.get('save', null); return !!(s && s.v === 1 && (s.checkpoint || (s.chapter || 1) > 1)); },
    newGame(diffKey) {
      G.Abyss.active = false; G.Abyss.run = null; G.Routes.active = null;
      G.Chapters.load(1);
      this.save = this.defaultSave(diffKey); G.Mirror.st(this.save); this.save.mirrorInit = true;
      this.diff = G.DATA.difficulty[diffKey]; this.stats = this.save.stats;
      this.player = new G.Player(this);
      this.player.x = 420; this.player.y = 0; this.player.facing = 1; this.player.setState('rest'); this.player.res = 0;
      this.save.tonic = this.player.maxTonic;
      this.resetWorld();
      this.state = 'intro'; this.control = false;
      this.cam.x = this.cam.tx = 600; this.cam.y = -170;
      G.Music.play(null);
      // choose a class first (js/dnd.js), then the story begins
      G.DnD.chooseClass(this.save, () => { this.player.recalc(); this.player.hp = this.player.maxHp; this.save.tonic = this.player.maxTonic; this.persist(); G.UI.intro(G.DATA.intro, () => this.beginPlay()); });
    },
    beginPlay() {
      this.state = 'play'; this.fadeA = 1; this.fadeTarget = 0;
      G.Music.play('explore');
      G.SFX.play('quake');
      this.player.setState('rest');
      setTimeout(() => {
        this.player.setState('move', 0.6);
        this.dialog('land', () => {
          const z = L.zoneAt(this.player.x); this.lastZone = z;
          G.Tut.offer(() => { this.control = true; this.hint('move'); G.UI.zoneCard(z.name, z.en); });
        });
      }, 1600);
    },
    continueGame() {
      const s = G.Store.get('save', null);
      if (!s) return;
      // saves from before classes existed choose one, once
      if (!s.dnd) { G.DnD.chooseClass(s, () => { G.Store.set('save', s); this.continueGame(); }, { returning: true }); return; }
      const want = s.chapter || 1;
      if (!G.Chapters.loaded(want)) {
        const m = G.Chapters.info(want);
        G.UI.loading(true, `載入第${m ? m.numZh : want}章…`);
        G.Chapters.ensure(want).then(() => { G.UI.loading(false); this.continueGame(); })
          .catch(() => { G.UI.loading(false); G.UI.toast('載入失敗，請確認網路後再試一次', 'warn'); G.UI.toTitle(); });
        return;
      }
      this.save = Object.assign(this.defaultSave(s.diff), s); G.Mirror.migrate(this.save);
      if (this.save.abyssRun || G.Abyss.active) G.Abyss.recover(this.save);
      G.Routes.active = null;
      this.diff = G.DATA.difficulty[this.save.diff] || G.DATA.difficulty.normal; this.stats = this.save.stats;
      G.Chapters.load(this.save.chapter || 1);
      this.player = new G.Player(this);
      this.respawnAtCheckpoint(true);
    },
    respawnAtCheckpoint(fromLoad) {
      G.Routes.detach();
      const p = L.pylons.find((q) => q.id === this.save.checkpoint);
      this.resetWorld();
      this.player.reset(p ? p.x - 40 : L.start.x, p ? p.y : L.start.y);
      this.player.recalc(); this.player.hp = this.player.maxHp; this.player.sta = this.player.maxSta;
      this.save.tonic = this.player.maxTonic;
      this.mirrorRefresh();
      this.player.setState('rest');
      this.cam.x = this.cam.tx = this.player.x; this.cam.y = this.player.y - 160;
      this.state = 'play'; this.control = false; this.fadeA = 1; this.fadeTarget = 0;
      G.Music.play(this.zoneMusic());
      setTimeout(() => { this.player.setState('move', 0.5); this.control = true; }, fromLoad ? 900 : 1300);
      G.UI.showHud(true);
    },
    resetWorld() {
      this.enemies = []; this.projectiles = []; this.hazards = []; this.pickups = []; G.FX.clear(); G.Boons.clear(); this.combo = 0; this.comboT = 9;
      this.arena = null; G.Phys.dyn = []; this.encState = {}; this.lootVacuum = false; this.bossRef = null; this.phase2 = false; this.focus = null; this.resting = false;
      for (const id in L.encounters) {
        const E = L.encounters[id];
        if (E.respawn) delete this.save.cleared[id];
        this.encState[id] = this.save.cleared[id] ? 'cleared' : 'idle';
      }
      G.UI.bossBar(null);
      this.lastZone = null;
      G.Props.spawn(this);   // crates, urns and crystals come back with the Hushborn
      G.Props.spawnGates(this);   // boss rooms close again behind a fog gate
      G.Routes.walls(this);       // the collapsed way at the chapter's fork (js/routes.js)
    },
    zoneMusic() { return G.Chapters.musicAt(this.player.x, this.player.y); },

    /* ------------------------------ chapters ------------------------------ */
    // boss down → (chapter epilogue) → chapter card → next chapter; the last chapter hands over to its ending
    completeChapter() {
      const ch = G.Chapters.cur, nid = G.Chapters.nextId(ch);
      this.control = false; this.save.flags['ch_done_' + ch.id] = true;
      if (!nid) { this.ending(); return; }
      this.save.chapter = nid; this.save.checkpoint = null; this.save.drop = null;
      this.save.maxChapter = Math.max(this.save.maxChapter || 1, nid);
      this.persist();
      G.Music.play('rest');
      G.Chapters.ensure(nid).catch(() => {});   // usually already there from the background download
      G.UI.chapterEnd(ch, this.stats, () => this.startChapter(nid));
    },
    startChapter(id) {
      if (!G.Chapters.loaded(id)) {
        const m = G.Chapters.info(id);
        G.UI.loading(true, `載入第${m ? m.numZh : id}章…`);
        G.Chapters.ensure(id).then(() => { G.UI.loading(false); this.startChapter(id); })
          .catch(() => { G.UI.loading(false); G.UI.toast('載入失敗，正在重試…', 'warn'); setTimeout(() => this.startChapter(id), 2500); });
        return;
      }
      const def = G.Chapters.load(id);
      // Echoes, Talia's upgrades, relics, gear and shards all carry over into the next chapter
      this.state = 'intro'; this.control = false; G.Music.play(null); G.Ambience.set('quiet');
      G.UI.showHud(false);
      const begin = () => {
        this.resetWorld();
        const P = this.player;
        P.reset(L.start.x, L.start.y); P.recalc(); P.hp = P.maxHp; P.sta = P.maxSta; this.save.tonic = P.maxTonic; this.mirrorRefresh();
        this.cam.x = this.cam.tx = P.x; this.cam.y = P.y - 160; this.camGround = P.y;
        this.state = 'play'; this.fadeA = 1; this.fadeTarget = 0; G.UI.showHud(true);
        G.Music.play(this.zoneMusic());
        this.persist();
        const run = () => { this.control = true; G.Input.clearBuffers(); const z = L.zoneAt(P.x); this.lastZone = z; if (z) G.UI.zoneCard(z.name, z.en); };
        if (G.Chapters.hook('enter', this, run) === true) return;
        if (def.enterDialog) this.dialog(def.enterDialog, run); else run();
      };
      const card = [{ t: `第${def.numZh || def.num}章\n${def.title}`, s: `CHAPTER ${def.num} — ${def.en}` }];
      G.UI.intro(card.concat(def.intro || []), begin);
      // the chapter card is up: lift the black curtain from the chapter-end screen
      requestAnimationFrame(() => requestAnimationFrame(() => G.UI.curtain(false)));
    },

    /* ------------------------------ loop ------------------------------ */
    frame(now) {
      requestAnimationFrame((t) => this.frame(t));
      // frame cap: 120/144 Hz phones and monitors would otherwise draw every refresh and run hot
      // ('auto' = 60, battery saver = 30, 'max' = uncapped)
      const fps = this.settings.fps === 'max' ? 0 : this.settings.fps === '30' ? 30 : 60;
      if (fps && now - this.last < 1000 / fps - 3) return;
      let rdt = (now - this.last) / 1000; this.last = now;
      // adaptive quality: on 自動, if the machine cannot hold ~45 fps for a few seconds of play, drop to the light profile
      if (this.state === 'play' && G.Quality.pref === 'auto' && !G.Quality.autoLow && rdt > 0 && rdt < 0.5) {
        this.fpsAvg = this.fpsAvg ? this.fpsAvg * 0.97 + rdt * 0.03 : rdt;
        this.perfSlowT = this.fpsAvg > 1 / 44 ? (this.perfSlowT || 0) + rdt : 0;
        if (this.perfSlowT > 4) { G.Quality.autoLow = true; this.applyQuality(); this.fpsAvg = 0; this.perfSlowT = 0; G.UI.toast('偵測到畫面不夠流暢，已自動切換為省電畫質（可在設定調整）', 'item'); }
      }
      if (!(rdt > 0)) rdt = 0;
      if (rdt > 0.05) rdt = 0.05;
      this.realTime += rdt;
      try {
        G.Input.update();
        G.UI.update(rdt);
        if (this.state === 'play' || this.state === 'intro' || this.state === 'title') this.tick(rdt); else this.dtVis = 0;
        this.render(rdt);
      } catch (err) {
        if (!this._errLogged || this.realTime - this._errLogged > 2) { this._errLogged = this.realTime; console.error(err); }
      }
    },
    tick(rdt) {
      // menus freeze the world: resting at a pylon respawns the Hushborn, and they must not walk up and attack
      // while you are tuning, equipping, travelling, trading, reading or choosing an Echo
      if (this.state === 'play' && G.UI.stack.some((l) => FREEZE.has(l.id))) { this.dtVis = 0; return; }
      // pause
      if (this.state === 'play' && G.Input.tap('pause') && !G.UI.modalOpen()) { G.UI.openPause(); return; }
      // time dilation
      if (this.slowT > 0) { this.slowT -= rdt; this.timeScale = U.lerp(this.timeScale, this.slowScale, 0.3); }
      else this.timeScale = U.lerp(this.timeScale, 1, 0.15);
      if (this.hitstopT > 0) { this.hitstopT -= rdt; this.dtVis = 0; return; }
      const dt = rdt * this.timeScale;
      this.dtVis = dt;
      this.time += dt;
      if (this.state === 'play') this.stats.time += rdt;
      this.trauma = Math.max(0, this.trauma - rdt * 1.6);
      this.dmgFlash = Math.max(0, this.dmgFlash - rdt * 2.5);
      this.cineT = Math.max(0, this.cineT - rdt);
      this.comboT += dt; if (this.comboT > 2.2) this.combo = 0;

      const P = this.player;
      if (this.state === 'title') {
        if (P.state !== 'move') P.setState('move');
        P.vx = 0; P.update(dt);
        this.updOde(dt);
        this.cam.zoom = U.damp(this.cam.zoom, 1.18, 1, rdt);
        this.cam.x = U.damp(this.cam.x, P.x - 210 + Math.sin(this.realTime * 0.12) * 30, 1.5, rdt);
        this.cam.y = U.damp(this.cam.y, P.y - 120, 1.5, rdt);
        G.FX.update(dt);
        return;
      }
      P.update(dt);
      // the world holds its breath while someone is speaking
      if (!G.UI.dialogActive) {
        for (const e of this.enemies) e.update(dt);
        this.enemies = this.enemies.filter((e) => !e.remove);
        G.updateProjectiles(dt);
        G.updateHazards(dt);
        G.Boons.update(dt);
      }
      this.updPickups(dt); G.Props.update(dt); G.Routes.update(this);
      G.Tut.update(dt);
      if (this.state === 'play') G.Chapters.hook('update', this, dt);
      G.FX.update(dt);
      this.updOde(dt);
      if (this.state === 'play') {
        this.updTriggers();
        this.updEncounters(dt);
        this.updInteract();
        this.updBeacons();
        this.updMusic();
        if (P.hp > 0 && P.hp < P.maxHp * 0.3) { this.hbT = (this.hbT || 0) - rdt; if (this.hbT <= 0) { this.hbT = 0.95; G.SFX.play('heartbeat', 1 - P.hp / (P.maxHp * 0.3) * 0.5); } }
      }
      this.updCamera(rdt);
      G.BG.prewarm(this.cam, this.W, this.H, this.baseS, Math.sign(P.vx) || P.facing);
      G.UI.hud(P, this);
    },

    /* ------------------------------ juice ------------------------------ */
    shake(a) { this.trauma = Math.min(1, this.trauma + a * this.settings.shake); },
    // directional camera kick (world units, decays in ~0.12 s) and a brief zoom punch for heavy blows
    kick(x, y) { const s = this.settings.shake; this.kickX = (this.kickX || 0) + x * s; this.kickY = (this.kickY || 0) + y * s; },
    punch(z) { this.punchZ = Math.max(this.punchZ || 0, z * Math.min(1, this.settings.shake + 0.3)); },
    hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); },
    slowmo(dur, scale) { this.slowT = Math.max(this.slowT, dur); this.slowScale = scale; },
    cinematic(dur, target) { this.cineT = dur; this.cineTarget = target; this.slowmo(dur * 0.6, 0.55); },
    damageFlash() { if (this.settings.flashes) this.dmgFlash = 1; },
    toast(msg, kind) { G.UI.toast(msg, kind); },
    bark(id, once) {
      if (once) { if (this['_bk_' + id] && this.realTime - this['_bk_' + id] < 12) return; this['_bk_' + id] = this.realTime; }
      const b = G.DATA.barks[id]; if (b) G.UI.bark(b.who, b.text);
    },
    hint(id) {
      if (!this.settings.hints || this.save.flags['h_' + id]) return;
      this.save.flags['h_' + id] = true; G.UI.hint(G.DATA.hints[id]);
    },
    dialog(id, cb) {
      const lines = G.DATA.dialog[id];
      this.control = false; this.player.vx = 0;
      if (this.player.state !== 'dead') { if (this.player.busy && this.player.state !== 'rest') this.player.setState('move'); }
      G.UI.dialog(lines, () => { this.control = true; G.Input.clearBuffers(); cb && cb(); });
    },

    /* ------------------------------ camera ------------------------------ */
    updCamera(rdt) {
      const P = this.player, c = this.cam;
      const S0 = this.baseS, halfW = this.W / 2 / S0, halfH = this.H / 2 / S0;
      // vertical: anchor to the last solid footing so ordinary jumps don't bob the frame
      if (P.onGround || this.camGround == null) this.camGround = P.y;
      const cg = this.camGround;
      let tx = P.x + P.facing * 70 + P.vx * 0.18;
      const lift = 150 * (this.viewH || VIEW_H) / VIEW_H;
      let ty = P.y < cg ? Math.min(cg - lift, P.y + 90) : P.y - lift;
      let zoom = 1;
      if (this.arena && this.arena.id === 'boss') zoom = 0.9;
      if (this.cineT > 0 && this.cineTarget) { tx = (P.x + this.cineTarget.x) / 2; ty = P.y - 110; zoom = 1.28; }
      if (this.focus) { tx = this.focus.x; ty = this.focus.y; zoom = this.focus.zoom || zoom; }
      c.zoom = U.damp(c.zoom, zoom, 4, rdt);
      const hw = halfW / c.zoom;
      if (this.arena) {
        const a = this.arena;
        if (a.x1 - a.x0 < hw * 2) tx = (a.x0 + a.x1) / 2; else tx = U.clamp(tx, a.x0 + hw, a.x1 - hw);
      }
      tx = U.clamp(tx, L.bounds[0] + hw, L.bounds[1] - hw);
      c.x = U.damp(c.x, tx, 5, rdt);
      c.y = U.damp(c.y, ty, 4, rdt);
    },

    /* ------------------------------ triggers / encounters ------------------------------ */
    updTriggers() {
      const P = this.player, F = this.save.flags;
      if (!this.control) return;
      for (const tr of L.triggers) {
        const seen = F['t_' + tr.id];
        // encounter triggers re-arm after a death so the fight can be retried
        if (seen && !(tr.enc && this.encState[tr.enc] === 'idle')) continue;
        if (P.x < tr.x || P.x > tr.x + 500) continue;
        if (tr.yMax != null && P.y > tr.yMax) continue;
        if (tr.enc && this.encState[tr.enc] === 'cleared') { F['t_' + tr.id] = true; continue; }
        F['t_' + tr.id] = true;
        if (seen && tr.enc) {
          this.startEncounter(tr.enc);
          if (tr.music) { G.Music.play(tr.music); G.SFX.play('roar'); this.shake(0.8); }
          continue;
        }
        if (G.Chapters.hook('trigger', this, tr) === true) continue;
        if (tr.kind === 'hint') this.hint(tr.hint);
        else if (tr.kind === 'dialog') {
          if (tr.flag) this.save.flags[tr.flag] = true;
          if (tr.startEnc) this.startEncounter(tr.startEnc);
          if (tr.focus) this.focus = tr.focus;
          this.dialog(tr.dialog, () => {
            this.focus = null;
            if (tr.after) this.hint(tr.after);
            if (tr.music) { G.Music.play(tr.music); G.SFX.play('roar'); this.shake(0.8); }
          });
        }
      }
      // zone cards
      const z = L.zoneAt(P.x);
      if (z !== this.lastZone) { if (this.lastZone) G.UI.zoneCard(z.name, z.en); this.lastZone = z; }
    },
    updEncounters(dt) {
      const P = this.player;
      for (const id in L.encounters) {
        const E = L.encounters[id], st = this.encState[id];
        if (st === 'idle' && !E.manual) {
          const hi = E.arena ? E.arena[1] - 40 : E.trigger + 900;
          if (P.x >= E.trigger && P.x <= hi && (E.yMin == null || P.y >= E.yMin)) this.startEncounter(id);
        } else if (st === 'active') {
          const alive = this.enemies.some((e) => e.enc === id && !e.dead);
          if (!alive) {
            this.encWaveT = (this.encWaveT || 0) + dt;
            if (this.encWaveT < 0.9) continue;
            this.encWaveT = 0;
            this.encWave[id]++;
            if (this.encWave[id] < E.waves.length) this.spawnWave(id);
            else this.clearEncounter(id);
          }
        }
      }
    },
    startEncounter(id) {
      const E = L.encounters[id];
      if (this.encState[id] !== 'idle') return;
      this.encState[id] = 'active'; this.encWave = this.encWave || {}; this.encWave[id] = 0; this.encWaveT = 0;
      if (E.arena) {
        this.arena = { id, x0: E.arena[0], x1: E.arena[1] };
        const top = E.wallBottom != null ? -1600 : (E.wallTop ?? -1600), bot = E.wallBottom ?? 40;
        G.Phys.dyn = G.Phys.dyn.filter((w) => w.keep).concat([{ x: E.arena[0] - 30, y: top, w: 30, h: bot - top, wall: true }, { x: E.arena[1], y: top, w: 30, h: bot - top, wall: true }]);
        G.SFX.play('door');
        if (!E.boss && !E.elite) { this.bark('arena'); G.SFX.play('stingBattle'); }
      }
      G.Chapters.hook('encounterStart', this, id);
      this.spawnWave(id);
    },
    spawnWave(id) {
      const E = L.encounters[id], P = this.player;
      for (const d of E.waves[this.encWave[id]]) {
        const T = G.ENEMY_TYPES[d.t];
        if (!T) { console.warn('unknown enemy type', d.t); continue; }
        // hovering types give their height above the floor under them
        const hover = T.hover || d.t === 'shrieker';
        const y = d.y != null ? (T.fly ? d.y + (hover ? G.Phys.groundBelow(d.x, P.y - 150) : 0) : d.y) : G.Phys.groundBelow(d.x, P.y - 150);
        const e = new G.Enemy(d.t, d.x, y, { enc: id, spawn: d });
        e.facing = P.x < d.x ? -1 : 1;
        if (hover) { e.y0 = y; e.homeY = y; }
        this.enemies.push(e);
        this.save.flags['seen_' + d.t] = true;
        G.FX.shards(d.x, G.Phys.groundBelow(d.x, y - 10), 10, e.T.col, 300);
        if (e.boss) { this.bossRef = e; G.UI.bossBar(e); }
        if (e.elite) { this.bossRef = e; G.UI.bossBar(e); }
      }
    },
    clearEncounter(id) {
      const E = L.encounters[id];
      this.encState[id] = 'cleared'; this.save.cleared[id] = true;
      { const en = G.Mirror.lv('endure'), P = this.player; if (en && P && P.state !== 'dead') P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.08 * en); }
      if (this.arena && this.arena.id === id) {
        this.arena = null;
        for (const w of G.Phys.dyn) if (!w.keep) G.FX.shards(w.x + 15, w.y + w.h - 40, 20, '#ff3d7f', 400);
        G.Phys.dyn = G.Phys.dyn.filter((w) => w.keep); G.SFX.play('door');
        if (!E.boss && !E.elite) { this.bark('clear'); G.SFX.play('stingVictory'); }
      }
      G.Chapters.hook('encounterClear', this, id);
      // the final blow of a fight lands in slow motion
      if (!E.boss && !E.elite) { this.slowmo(0.5, 0.22); this.shake(0.35); }
      if (!E.boss && !E.elite && E.echo !== false && !this.save.flags['echo_' + id]) {
        this.save.flags['echo_' + id] = true;
        setTimeout(() => { if (this.state === 'play' && this.player.state !== 'dead') this.offerEcho(); }, 1100);
      }
    },
    offerEcho(cb) {
      this.control = false; this.player.vx = 0;
      if (this.player.busy) this.player.setState('move');
      G.SFX.play('pylon');
      G.Boons.offer((id) => { this.control = true; G.Input.clearBuffers(); if (id) this.toast('獲得共鳴回響：' + G.ECHOES[id].name, 'item'); cb && cb(); });
    },
    addCombo() { this.combo = this.comboT < 2.2 ? this.combo + 1 : 1; this.comboT = 0; if (this.combo > (this.stats.maxCombo || 0)) this.stats.maxCombo = this.combo; },
    // combo counter: big inked numerals at the right edge, punching in on every hit
    drawCombo(ctx, W, H) {
      if (this.combo < 3 || this.comboT > 2.2 || this.state !== 'play') return;
      const k = Math.min(1, this.comboT / 0.12), fade = this.comboT > 1.6 ? 1 - (this.comboT - 1.6) / 0.6 : 1;
      const s = Math.min(W, H * 1.6) / 900, x = W - 40 * s, y = H * 0.36;
      const pop = 1 + (1 - k) * 0.35;
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y); ctx.scale(pop, pop); ctx.textAlign = 'right';
      const col = this.combo >= 30 ? '#ffb347' : this.combo >= 15 ? '#ffe066' : '#7ff4ff';
      ctx.font = `italic 700 ${Math.round(58 * s)}px Rajdhani, sans-serif`;
      ctx.lineWidth = 8 * s; ctx.strokeStyle = '#0b0612'; ctx.lineJoin = 'round';
      ctx.strokeText(String(this.combo), 0, 0); ctx.fillStyle = col; ctx.fillText(String(this.combo), 0, 0);
      ctx.font = `600 ${Math.round(15 * s)}px "Noto Sans TC", sans-serif`;
      ctx.lineWidth = 5 * s; ctx.strokeText('連擊  COMBO', 0, 22 * s); ctx.fillStyle = '#efe9df'; ctx.fillText('連擊  COMBO', 0, 22 * s);
      ctx.restore();
    },
    onEnemyDeath(e) {
      this.stats.kills++;
      const gt = this.player.gear || {};
      const n = Math.round((e.T.shards || 10) * (0.9 + Math.random() * 0.2) * (1 + (gt.shard || 0) + 0.15 * G.Mirror.lv('magnet')));
      const heal = (gt.killHeal || 0) + 0.03 * G.Mirror.lv('absorb');
      if (heal && this.player.state !== 'dead') this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * heal);
      // 殘響結晶 (Mirror currency): first kill of a boss / elite pays the most; elites keep paying a little
      if (e.boss) { const k = 'cry_' + e.type; if (!this.save.flags[k]) { this.save.flags[k] = true; G.Mirror.gain(40, '頭目'); } }
      else if (e.elite) { const k = 'cry_' + e.type; G.Mirror.gain(this.save.flags[k] ? 4 : 15, '菁英'); this.save.flags[k] = true; }
      if (gt.killRes && this.player.state !== 'dead') this.player.gainRes(gt.killRes);
      G.Gear.onEnemyDeath(this, e);
      const count = Math.min(24, Math.max(3, Math.round(n / 8)));
      for (let i = 0; i < count; i++) {
        const a = -PI / 2 + (Math.random() - 0.5) * 2.4, v = 250 + Math.random() * 300;
        this.pickups.push({ kind: 'shard', x: e.cx, y: e.cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, val: n / count });
      }
      if (e.elite) {
        G.UI.bossBar(null); this.bossRef = null;
        this.slowmo(1.2, 0.3);
        const T = e.T;
        if (G.Abyss.active) return;
        this.save.flags['elite_' + e.type] = true;
        setTimeout(() => {
          if (G.Chapters.hook('eliteDefeated', this, e) === true) return;
          const after = () => { if (T.defeatRelic) this.giveRelic(T.defeatRelic); };
          if (T.defeatDialog) this.dialog(T.defeatDialog, after); else after();
        }, 900);
      }
      if (e.boss) {
        G.UI.bossBar(null); this.bossRef = null;
        this.slowmo(2.5, 0.2); this.shake(1); G.Music.play(null);
        this.hazards = []; this.projectiles = [];
        for (const o of this.enemies) if (o !== e && !o.dead) o.die(); // summoned adds fall with their master
        this.control = false;
        this.lootVacuum = true;   // whatever dropped flies to Rinne before the chapter moves on (js/gear.js)
        const t0 = performance.now();
        const waitLoot = (fn) => (this.pickups.some((p) => p.kind === 'loot') && performance.now() - t0 < 9000 ? setTimeout(() => waitLoot(fn), 250) : fn());
        if (G.Abyss.active) { setTimeout(() => waitLoot(() => { this.control = true; this.lootVacuum = false; }), 2200); return; }
        setTimeout(() => waitLoot(() => {
          const ch = G.Chapters.cur;
          this.save.flags['boss_' + ch.id] = true; if (ch.id === 1) this.save.flags.boss_dead = true;
          this.persist();
          if (G.Chapters.hook('bossDefeated', this, e) === true) return;
          const dlg = e.T.defeatDialog;
          if (dlg) this.dialog(dlg, () => this.completeChapter()); else this.completeChapter();
        }), 2200);
      }
    },
    bossPhase2(e) {
      e.phase = 2; e.atk = null; e.setState('idle'); e.cd = 1.8; e.speedMul = 1.15;
      this.bark(e.T.phase2Bark || 'phase2'); G.SFX.play('roar'); this.shake(1); this.slowmo(0.8, 0.3);
      const pc = e.T.col || '#ff2a5f';
      G.FX.ring(e.cx, e.cy, 20, 500, 1, pc, 8); G.FX.flash(e.cx, e.cy, 400, 0.6, pc);
      if (e.T.onPhase2) e.T.onPhase2(e, this);
      G.Music.play(e.T.phase2Music || G.Chapters.music('boss2'));
      this.phase2 = true;
    },
    onBalanceBreak() { this.hint('execute'); if (!this._execBark) { this._execBark = true; this.bark('execute'); } },
    onPerfectParry() { G.Tut.ev('parry'); },
    onPerfectDodge() { },
    onBlock() { G.Tut.ev('block'); if (!G.Tut.active) this.hint('rally'); },
    findExecutable() {
      const P = this.player;
      let best = null, bd = 200;
      for (const e of this.enemies) {
        if (e.state !== 'broken' || e.dead) continue;
        const d = Math.abs(e.x - P.x);
        if (d < bd && Math.abs(e.y - P.y) < 160) { bd = d; best = e; }
      }
      return best;
    },

    /* ------------------------------ pickups / interactables ------------------------------ */
    updPickups(dt) {
      const P = this.player;
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i];
        if (p.kind === 'loot') { if (G.Gear.updLoot(this, p, dt)) this.pickups.splice(i, 1); continue; }
        p.t += dt;
        if (p.t < 0.45) { p.vx *= Math.exp(-4 * dt); p.vy = p.vy * Math.exp(-4 * dt) + 300 * dt; }
        else {
          const tx = P.x, ty = P.y - 60, a = Math.atan2(ty - p.y, tx - p.x), sp = 300 + (p.t - 0.45) * 1600;
          p.vx = U.lerp(p.vx, Math.cos(a) * sp, 0.2); p.vy = U.lerp(p.vy, Math.sin(a) * sp, 0.2);
          if (Math.hypot(tx - p.x, ty - p.y) < 24) {
            this.save.shards += p.val; this.pickups.splice(i, 1);
            G.SFX.play('pickup'); G.FX.ember(P.x, P.y - 60, 2, '#bff8ff', { w: 20, h: 20 });
            continue;
          }
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      // souls-like drop retrieval
      const d = this.save.drop;
      if (d && P.state !== 'dead' && this.control && Math.abs(P.x - d.x) < 40 && Math.abs(P.y - d.y) < 80) {
        this.save.shards += d.amt; this.save.drop = null;
        G.SFX.play('pylon'); G.FX.ring(d.x, d.y - 40, 10, 120, 0.6, '#bff8ff', 4); G.FX.ember(d.x, d.y - 40, 30, '#bff8ff');
        this.toast(`取回殘響　+${Math.round(d.amt)}`, 'good');
      }
    },
    interactables() {
      const list = [], F = this.save.flags;
      for (const p of L.pylons) list.push({ kind: 'pylon', x: p.x, y: p.y, ref: p, label: '點亮魂燈台' });
      for (const n of L.notes) list.push({ kind: 'note', x: n.x, y: n.y, ref: n, label: '閱讀', read: F['note_' + n.id] });
      for (const it of L.items) if (!F[it.flag]) list.push({ kind: 'item', x: it.x, y: it.y, ref: it, label: it.event ? '調查' : it.locked ? '開鎖（敏捷 DC 12）' : it.chest ? '打開' : '拾取' });
      for (const n of L.npcs) list.push({ kind: 'npc', x: n.x, y: n.y, ref: n, label: '交談' });
      for (const g of G.Props.gates) if (!g.open) list.push({ kind: 'gate', x: g.x - 50, y: g.y, ref: g, label: '進入王房' });
      for (const d of G.Abyss.doorNear(this)) list.push(d);
      for (const d of G.Routes.interactables(this)) list.push(d);
      for (const d of G.Routes.exitNear()) list.push(d);
      return list;
    },
    updInteract() {
      const P = this.player;
      if (!this.control || P.busy || !P.onGround) { G.UI.prompt(null); return; }
      let near = null, nd = 90;
      for (const it of this.interactables()) {
        const d = Math.abs(it.x - P.x);
        if (d < nd && Math.abs(it.y - P.y) < 40) { nd = d; near = it; }
      }
      if (near && this.enemies.some((e) => !e.dead && Math.abs(e.x - P.x) < 500) && near.kind === 'pylon') { G.UI.prompt('附近有寂裔，無法調諧'); return; }
      G.UI.prompt(near ? `<kbd>${G.Input.glyph('interact')}</kbd> ${near.label}` : null);
      if (near && near.kind === 'pylon' && !this.save.flags.h_pylon) this.hint('pylon');
      if (near && G.Input.pressed('interact', 100)) {
        G.Input.consume('interact');
        this.interact(near);
      }
    },
    interact(it) {
      const F = this.save.flags, P = this.player;
      if (G.Chapters.hook('interact', this, it) === true) return;
      if (it.kind === 'gate') { G.Props.openGate(this, it.ref); return; }
      if (it.kind === 'door') { G.Abyss.go(this, it.ref); return; }
      if (it.kind === 'road') { G.Routes.enter(this, it.ref.road); return; }
      if (it.kind === 'roadExit') { G.Routes.leave(this); return; }
      if (it.kind === 'pylon') this.restAt(it.ref);
      else if (it.kind === 'note') {
        F['note_' + it.ref.id] = true; if (it.ref.id === 'n3') F.note_mira = true; if (it.ref.flag) F[it.ref.flag] = true;
        G.SFX.play('note');
        const n = G.DATA.codex.notes.find((q) => q.id === it.ref.id);
        this.control = false;
        G.UI.readNote(n, () => { this.control = true; G.Input.clearBuffers(); });
      } else if (it.kind === 'item' && it.ref.event) {
        F[it.ref.flag] = true; G.SFX.play('pageOpen'); G.Events.open(this);
      } else if (it.kind === 'item' && it.ref.locked) {
        // a locked chest: a DEX check — failure springs the trap, but the lid gives either way
        const ref = it.ref; this.control = false;
        G.Dice.check({ attr: 'dex', dc: 12, title: '上鎖的' + ref.name }, (r) => {
          F[ref.flag] = true; this.control = true; G.Input.clearBuffers();
          if (!r.ok) { P.hp = Math.max(1, P.hp - P.maxHp * 0.15); P.flash = 1; this.shake(0.4); G.SFX.play('hurt'); this.toast('機關射出了毒針', 'warn'); }
          G.SFX.play(ref.sfx || 'pickup'); this.toast(`打開了${ref.name}`, 'item'); if (ref.onTake) ref.onTake(this); this.persist();
        });
      } else if (it.kind === 'item') {
        const ref = it.ref; F[ref.flag] = true;
        G.FX.ring(ref.x, ref.y - 40, 10, 140, 0.6, '#ffe7b0', 4); G.FX.ember(ref.x, ref.y - 40, 24, '#ffe7b0');
        if (ref.kind === 'relic') this.giveRelic(ref.id);
        else { G.SFX.play(ref.sfx || 'musicbox'); this.toast(ref.chest ? `打開了${ref.name}` : `獲得：${ref.name}`, 'item'); if (ref.onTake) ref.onTake(this); }
      } else if (it.kind === 'npc') {
        P.facing = it.x > P.x ? 1 : -1;
        if (it.ref.talk) { it.ref.talk(this); return; }
        F.met_barrow = F.met_barrow || false;
        if (!F.met_barrow) this.dialog('barrowMeet', () => { F.met_barrow = true; G.UI.journal('支線任務：敲鐘人的歌', '替老鐸找回諾娜的音樂盒'); });
        else if (F.got_musicbox && !F.gave_musicbox) {
          G.SFX.play('musicbox');
          this.dialog('barrowDone', () => { F.gave_musicbox = true; this.giveRelic('blessing'); G.UI.journal('支線任務完成', '敲鐘人的歌'); });
        } else if (!F.gave_musicbox) this.dialog('barrowWait');
        else this.dialog('barrowAfter');
      }
    },
    giveRelic(id) {
      const F = this.save.flags; F['relic_' + id] = true;
      const eq = this.save.equipped;
      if (eq.length < 2 && !eq.includes(id)) eq.push(id);
      this.player.recalc();
      if (id === 'blessing') this.save.tonic = Math.min(this.player.maxTonic, this.save.tonic + 1);
      G.SFX.play('pylon');
      G.UI.relicGet(id);
    },
    restAt(py) {
      const P = this.player, F = this.save.flags;
      P.setState('rest', 0.3); this.control = false; this.resting = true;
      this.save.checkpoint = py.id;
      const vp = this.save.visited || (this.save.visited = {}); vp[py.id] = L.chapter || 1;
      G.SFX.play('pylon');
      G.FX.ring(py.x, py.y - 80, 10, 200, 0.8, '#7ff4ff', 4); G.FX.ember(py.x, py.y - 90, 40, '#7ff4ff', { w: 40, h: 140, up: 200 });
      // souls-like: resting revives the Hushborn
      P.recalc(); P.hp = P.maxHp; P.rally = 0; P.sta = P.maxSta; this.save.tonic = P.maxTonic; this.mirrorRefresh();
      const keepDrop = this.save.drop;
      this.resetWorld(); this.save.drop = keepDrop;
      this.resting = true; // resetWorld clears it; resting lasts until the player leaves the pylon
      this.lastZone = L.zoneAt(P.x);
      this.persist();
      const open = () => G.UI.openPylon(py, () => { P.setState('move', 0.4); this.control = true; this.resting = false; G.Input.clearBuffers(); this.persist(); });
      const first = py.dialog || (py.id === 'p1' ? 'pylon1' : null), fflag = py.flag || (py.id === 'p1' ? 'met_talia' : 'pylon_' + py.id);
      if (first && !F[fflag]) setTimeout(() => this.dialog(first, () => { F[fflag] = true; this.control = false; open(); }), 600);
      else setTimeout(open, 500);
    },
    persist() { this.save.flags = this.save.flags || {}; G.Store.set('save', this.save); },
    // per-rest Mirror effects: 不屈之心 re-arms, 共鳴湧動 refills resonance
    mirrorRefresh() {
      const P = this.player; if (!P) return;
      P.mirrorDefy = true; G.DnD.rest(P); G.Events.rest(P); P.recalc();
      const s = G.Mirror.lv('surge'); if (s) P.res = Math.max(P.res || 0, 25 * s);
    },
    // dynamic difficulty (chapter III on): compare Rinne's damage output and toughness with what the chapter expects,
    // and scale the Hushborn's health and damage to match - stronger builds meet tougher foes, struggling ones get a little slack
    dynScale() {
      const P = this.player, ch = (G.Chapters.cur && G.Chapters.cur.id) || 1;
      // the Abyss always measures Rinne against the biome she is in, so early biomes still bite a late-game build
      if (!P || (ch < 3 && !G.Abyss.active)) return { hp: 1, dmg: 1 };
      const EXP_OFF = [1, 1, 1.25, 1.5, 1.75, 2.0, 2.3, 2.6, 2.9], EXP_EHP = [100, 100, 120, 140, 160, 180, 200, 220, 240];
      const echoes = Object.values(this.save.boons || {}).reduce((a, b) => a + b, 0);
      const spd = P.gear ? P.gear.speed * (1 + (P.gear.spd || 0)) : 1;
      const off = P.dmgMul * spd * (1 + echoes * 0.04) * (1 + ((P.gear && P.gear.crit) || 0));
      const ehp = P.maxHp / (P.dmgTaken || 1);
      return { hp: U.clamp(off / EXP_OFF[ch], 0.9, 2.6), dmg: U.clamp(Math.sqrt(ehp / EXP_EHP[ch]), 0.9, 1.8) };
    },
    // furthest chapter this journey has reached (older saves: derive it from completed-chapter flags)
    reachedChapter() {
      const s = this.save, F = s.flags || {}; let m = Math.max(s.maxChapter || 1, s.chapter || 1);
      for (let n = 1; n <= G.Chapters.LAST; n++) if (F['ch_done_' + n]) m = Math.max(m, Math.min(G.Chapters.LAST, n + 1));
      return m;
    },
    // fast travel to a pylon of any reached chapter (farm earlier areas; the save keeps every chapter's progress)
    travelTo(ch, pylonId) {
      this.save.maxChapter = this.reachedChapter();
      this.save.chapter = ch; this.save.checkpoint = pylonId; this.save.drop = null;
      this.persist();
      G.UI.stack.slice().forEach(() => G.UI.pop());
      this.fadeA = 1; this.control = false;
      this.continueGame();
    },
    onPlayerDeath() {
      this.control = false; this.stats.deaths++;
      if (G.Abyss.active) { this.slowmo(1.5, 0.3); G.Music.play(null); setTimeout(() => G.Abyss.end(this, false), 2200); return; }
      const rd = G.Routes.dropAt();
      if (this.save.shards > 0) this.save.drop = { x: rd ? rd.x : this.player.x, y: rd ? rd.y : this.player.y, amt: this.save.shards };
      else this.save.drop = null;
      this.save.shards = 0;
      this.slowmo(1.5, 0.3);
      G.Music.play(null);
      setTimeout(() => G.UI.deathScreen(() => {
        if (this.save.drop) setTimeout(() => this.bark('shards'), 2000);
        this.hint('shards');
        this.respawnAtCheckpoint(false);
      }), 2000);
    },
    // variant: { id, kicker, title, lines[], music? } from the final chapter (multiple endings)
    ending(variant) {
      this.control = false; this.state = 'ending';
      this.save.flags.ending = true; if (variant && variant.id) this.save.flags['ending_' + variant.id] = true; this.persist();
      G.Music.play((variant && variant.music) || 'ending'); G.Ambience.set('off');
      G.UI.ending(this.stats, variant);
    },
    updMusic() {
      const P = this.player;
      let near = false;
      for (const e of this.enemies) if (!e.dead && Math.abs(e.x - P.x) < 900 && e.state !== 'spawn') { near = true; break; }
      this.combatNear = near || !!this.arena;
      G.Ambience.set(G.Chapters.ambienceAt(P.x, P.y));
      if (this.resting) { G.Music.play(G.Chapters.music('rest')); return; }
      if (this.bossRef && this.bossRef.elite) { G.Music.play(this.bossRef.T.music || G.Chapters.music('elite')); return; }
      if (this.bossRef && this.bossRef.boss) return;
      const want = this.zoneMusic();
      if (G.Music.track !== want && !this.bossRef) G.Music.play(want);
      G.Music.setIntensity(this.combatNear ? 1 : 0);
    },
    updOde(dt) {
      const P = this.player, o = this.ode;
      const tx = P.x - P.facing * 48, ty = P.y - 150 + Math.sin(this.realTime * 2) * 7;
      o.x = U.damp(o.x, tx, 4, dt); o.y = U.damp(o.y, ty, 4, dt);
      o.talk = Math.max(0, o.talk - dt);
    },

    /* ------------------------------ render ------------------------------ */
    render(rdt) {
      const ctx = this.ctx, W = this.W, H = this.H, c = this.cam;
      this.kickX = U.damp(this.kickX || 0, 0, 22, rdt); this.kickY = U.damp(this.kickY || 0, 0, 22, rdt);
      this.punchZ = U.damp(this.punchZ || 0, 0, 14, rdt);
      const S = this.baseS * c.zoom * (1 + this.punchZ);
      // shake offset
      const tr = this.trauma * this.trauma, t = this.realTime;
      const sx = (U.noise1(t * 30, 1) - 0.5) * 2 * 22 * tr, sy = (U.noise1(t * 30, 2) - 0.5) * 2 * 18 * tr;
      const cam = { x: c.x + sx / S * 3 + this.kickX, y: c.y + sy / S * 3 + this.kickY, zoom: c.zoom };
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      G.BG.drawSky(ctx, cam, W, H, S, t);
      G.BG.drawLayers(ctx, cam, W, H, S, t);
      // world
      G.BG.drawGround(ctx, cam, W, H, S);
      ctx.setTransform(S, 0, 0, S, W / 2 - cam.x * S, H / 2 - cam.y * S);
      G.Props.drawLedges(ctx, cam, t);
      this.drawWorldProps(ctx);
      G.Props.draw(ctx, cam, t);
      G.Chapters.hook('drawBack', ctx, this);
      G.drawHazards(ctx);
      for (const e of this.enemies) if (e.boss) e.draw(ctx);
      for (const e of this.enemies) if (!e.boss) e.draw(ctx);
      G.FX.drawBack(ctx);
      if (this.state !== 'boot') this.player.draw(ctx, this.time);
      G.Rig.drawOde(ctx, this.ode.x, this.ode.y, this.realTime, this.player.facing, G.UI.odeTalking ? 1 : 0);
      G.drawProjectiles(ctx);
      G.Boons.draw(ctx);
      G.Chapters.hook('drawFront', ctx, this);
      this.drawPickups(ctx);
      G.FX.draw(ctx);
      this.drawEnemyUI(ctx);
      this.drawForeground(ctx, cam, S);
      // screen space
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this._view = { S, cam };
      this.drawCombo(ctx, W, H);
      this.drawEdgeArrows(ctx, W, H);
      G.BG.bloom(ctx, this.canvas, W, H, this.phase2 ? 0.45 : 0.36);
      G.BG.drawDust(ctx, cam, W, H, S, t);
      const P = this.player;
      G.BG.drawPost(ctx, W, H, S, t, { tint: L.tintAt(cam.x), lowHp: this.state === 'play' && P.hp < P.maxHp * 0.3 ? 1 : 0 });
      if (this.phase2 && this.arena && L.encounters[this.arena.id] && L.encounters[this.arena.id].boss) { if (G.Quality.full) { ctx.fillStyle = 'rgba(120,0,30,0.12)'; ctx.globalCompositeOperation = 'multiply'; } else ctx.fillStyle = 'rgba(70,0,20,0.1)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
      if (this.dmgFlash > 0) { ctx.fillStyle = `rgba(255,40,80,${this.dmgFlash * 0.18})`; ctx.fillRect(0, 0, W, H); }
      if (this.timeScale < 0.7) {
        // slow motion drains the colour (cheap version: a cool dim veil — saturation blending stalls laptop GPUs)
        if (G.Quality.full) { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(0,0,0,${(0.7 - this.timeScale) * 0.9})`; }
        else ctx.fillStyle = `rgba(40,46,64,${(0.7 - this.timeScale) * 0.35})`;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }
      // letterbox
      const lbTarget = (this.state === 'play' && (!this.control || this.cineT > 0) && this.player.state !== 'rest') || this.state === 'title' ? 1 : 0;
      this.letterbox = U.damp(this.letterbox, this.state === 'title' ? 0.6 : lbTarget, 6, rdt);
      if (this.letterbox > 0.01) { const h = H * 0.085 * this.letterbox; ctx.fillStyle = '#050407'; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h); }
      // fade
      this.fadeA = U.damp(this.fadeA, this.fadeTarget, 2.2, rdt);
      if (this.fadeA > 0.005) { ctx.fillStyle = `rgba(5,4,7,${this.fadeA})`; ctx.fillRect(0, 0, W, H); }
    },
    drawWorldProps(ctx) {
      const t = this.realTime, F = this.save.flags;
      // arena walls
      const wc = this.arena && this.arena.id === 'tut' ? '111,243,255' : '255,61,127', wl = this.arena && this.arena.id === 'tut' ? 'rgba(190,250,255,0.5)' : 'rgba(255,170,200,0.5)';
      G.Props.drawGates(ctx, t); G.Routes.draw(ctx, this);
      for (const w of G.Phys.dyn) {
        if (w.gate) continue;
        const x = w.x + w.w / 2, top = Math.max(w.y, this.cam.y - 500), bot = Math.min(w.y + w.h, this.cam.y + 500);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(x - 30, 0, x + 30, 0);
        g.addColorStop(0, `rgba(${wc},0)`); g.addColorStop(0.5, `rgba(${wc},${0.25 + Math.sin(t * 4) * 0.05})`); g.addColorStop(1, `rgba(${wc},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - 30, top, 60, bot - top);
        ctx.strokeStyle = wl; ctx.lineWidth = 1.5;
        for (let y = top; y < bot; y += 40) { const o = Math.sin(y * 0.05 + t * 3) * 6; ctx.beginPath(); ctx.moveTo(x + o - 8, y); ctx.lineTo(x - o + 8, y + 40); ctx.stroke(); }
        ctx.restore();
      }
      // pylons
      for (const p of L.pylons) {
        const active = this.save.checkpoint === p.id;
        const x = p.x, y = p.y;
        ctx.fillStyle = '#1b1a20';
        ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.lineTo(x - 18, y - 18); ctx.lineTo(x + 18, y - 18); ctx.lineTo(x + 26, y); ctx.fill();
        ctx.fillStyle = '#2a2830';
        ctx.beginPath(); ctx.moveTo(x - 12, y - 18); ctx.lineTo(x - 7, y - 150); ctx.lineTo(x, y - 162); ctx.lineTo(x + 7, y - 150); ctx.lineTo(x + 12, y - 18); ctx.fill();
        ctx.fillStyle = 'rgba(255,230,200,0.18)'; ctx.fillRect(x - 11, y - 150, 3, 130);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const k = active ? 1 : 0.45;
        for (let i = 0; i < 3; i++) {
          const ry = y - 60 - i * 34 + Math.sin(t * 1.5 + i) * 4;
          ctx.strokeStyle = `rgba(111,243,255,${0.5 * k})`; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.ellipse(x, ry, 22 - i * 4, 5 - i, 0, t * (i % 2 ? 1 : -1), t * (i % 2 ? 1 : -1) + PI * 1.4); ctx.stroke();
        }
        const g = ctx.createRadialGradient(x, y - 100, 0, x, y - 100, 90);
        g.addColorStop(0, `rgba(111,243,255,${0.35 * k})`); g.addColorStop(1, 'rgba(111,243,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 90, y - 190, 180, 180);
        ctx.fillStyle = `rgba(200,250,255,${0.8 * k})`; ctx.fillRect(x - 1.5, y - 140, 3, 100);
        if (active) { const bg = ctx.createLinearGradient(0, y - 600, 0, y - 150); bg.addColorStop(0, 'rgba(111,243,255,0)'); bg.addColorStop(1, 'rgba(111,243,255,0.18)'); ctx.fillStyle = bg; ctx.fillRect(x - 3, y - 600, 6, 450); }
        ctx.restore();
        if (Math.random() < 0.08) G.FX.ember(x, y - 100, 1, '#7ff4ff', { w: 30, h: 80, up: 60 });
      }
      // notes (holo-tablets on the ground) + a beacon so they are hard to walk past
      for (const n of L.notes) {
        const read = F['note_' + n.id];
        const x = n.x, y = n.y;
        ctx.fillStyle = '#25232a'; ctx.save(); ctx.translate(x, y - 4); ctx.rotate(-0.25); ctx.fillRect(-10, -6, 20, 8); ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const a = read ? 0.25 : 0.6 + Math.sin(t * 3 + x) * 0.25;
        ctx.fillStyle = `rgba(255,214,150,${a * 0.5})`; ctx.fillRect(x - 8, y - 14, 16, 8);
        ctx.restore();
        this.drawBeacon(ctx, x, y, '#ffd28a', '文', '文書　可閱讀', read, t);
      }
      // items
      for (const it of L.items) {
        if (F[it.flag]) continue;
        const x = it.x, y = it.y - 30 + Math.sin(t * 2) * 4;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const col = it.kind === 'relic' ? '255,214,140' : '255,240,220';
        const g = ctx.createRadialGradient(x, y, 0, x, y, 34); g.addColorStop(0, `rgba(${col},0.8)`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - 34, y - 34, 68, 68);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
        ctx.restore();
        if (Math.random() < 0.2) G.FX.ember(x, y, 1, it.kind === 'relic' ? '#ffd28a' : '#fff0dc', { w: 20, h: 20, up: 40 });
        this.drawBeacon(ctx, it.x, it.y, it.kind === 'relic' ? '#ffb347' : '#fff0dc', it.kind === 'relic' ? '◆' : '✦', (it.kind === 'relic' ? '遺物　' : it.event ? '事件　？' : it.locked ? '上鎖的寶箱' : it.chest ? '寶箱　' : '物品　') + (it.chest || it.event ? '' : it.name || '可拾取'), false, t);
      }
      // NPCs (chapter-defined drawers, Barrow by default)
      for (const n of L.npcs) {
        if (n.draw) n.draw(ctx, n.x, n.y, t, this); else this.drawBarrow(ctx, n.x, n.y, t);
        const pending = n.pending ? n.pending(this) : (n.id === 'barrow' && (!F.met_barrow || (F.got_musicbox && !F.gave_musicbox)));
        if (pending) this.drawBeacon(ctx, n.x, n.y, '#9cf7b0', '…', n.label || '交談', false, t, true, n._seed != null ? n._seed : (n._seed = Math.random() * 100));
      }
      // souls drop
      const d = this.save.drop;
      if (d && this.state === 'play') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const a = t * 2 + i * 2.1, r = 14 + Math.sin(t * 3 + i) * 4;
          const g = ctx.createRadialGradient(d.x + Math.cos(a) * 6, d.y - 40 + Math.sin(a) * 10, 0, d.x, d.y - 40, r * 2.4);
          g.addColorStop(0, 'rgba(220,250,255,0.6)'); g.addColorStop(1, 'rgba(111,243,255,0)');
          ctx.fillStyle = g; ctx.fillRect(d.x - 50, d.y - 90, 100, 100);
        }
        ctx.restore();
        if (Math.random() < 0.3) G.FX.ember(d.x, d.y - 40, 1, '#bff8ff', { w: 20, h: 30, up: 80 });
      }
    },
    // collectible beacon: a light pillar visible from afar, a pulsing ground ring, a floating inked icon,
    // and a label once you are close. `done` keeps a faint pillar so read notes are still findable.
    drawBeacon(ctx, x, y, col, icon, label, done, t, small, seed) {
      const ph = seed != null ? seed : x;
      const P = this.player, d = Math.hypot(P.x - x, (P.y - y) * 1.5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const H = small ? 160 : 360, a = done ? 0.07 : 0.2 + 0.07 * Math.sin(t * 2.4 + ph * 0.01);
      const pg = ctx.createLinearGradient(0, y - H, 0, y);
      pg.addColorStop(0, U.rgba(col, 0)); pg.addColorStop(0.7, U.rgba(col, a * 0.6)); pg.addColorStop(1, U.rgba(col, a));
      ctx.fillStyle = pg; ctx.fillRect(x - 16, y - H, 32, H);
      ctx.fillStyle = pg; ctx.fillRect(x - 3, y - H, 6, H);
      if (!done) {
        for (let i = 0; i < 2; i++) {
          const k = (t * 0.7 + i * 0.5 + ph * 0.0007) % 1;
          ctx.strokeStyle = U.rgba(col, (1 - k) * 0.7); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y - 2, 10 + 44 * k, (10 + 44 * k) * 0.22, 0, 0, TAU); ctx.stroke();
        }
      }
      ctx.restore();
      if (done || this.state === 'title') return;   // the title backdrop keeps only the light pillar
      // floating sigil
      // floats above the heroine's head so standing on a note never hides its label behind her
      const iy = y - (small ? 128 : 136) + Math.sin(t * 2.2 + ph) * 5, r = 11;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(x, iy - r - 3); ctx.lineTo(x + r + 3, iy); ctx.lineTo(x, iy + r + 3); ctx.lineTo(x - r - 3, iy); ctx.closePath();
      ctx.fillStyle = '#0b0612'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, iy - r); ctx.lineTo(x + r, iy); ctx.lineTo(x, iy + r); ctx.lineTo(x - r, iy); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = '#0b0612'; ctx.font = '700 12px "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // a chapter that mirrors the whole frame (G.textFlip = -1) gets its world-space text pre-flipped so it reads upright
      if ((G.textFlip || 1) < 0) { ctx.save(); ctx.translate(x, iy + 0.5); ctx.scale(1, -1); ctx.fillText(icon, 0, 0); ctx.restore(); } else ctx.fillText(icon, x, iy + 0.5);
      // label fades in as you approach
      const la = U.clamp((460 - d) / 160, 0, 1);
      if (la > 0) {
        ctx.globalAlpha = la; ctx.font = '700 14px "Noto Sans TC", sans-serif'; ctx.textBaseline = 'alphabetic';
        ctx.lineWidth = 5; ctx.strokeStyle = '#0b0612'; ctx.lineJoin = 'round';
        if ((G.textFlip || 1) < 0) { ctx.translate(x, iy - r - 10); ctx.scale(1, -1); ctx.strokeText(label, 0, 0); ctx.fillStyle = col; ctx.fillText(label, 0, 0); } else { ctx.strokeText(label, x, iy - r - 10); ctx.fillStyle = col; ctx.fillText(label, x, iy - r - 10); }
      }
      ctx.restore();
    },
    // pending collectibles near the player: list for edge arrows + a one-time chime when first approached
    beaconTargets() {
      const F = this.save.flags, out = [];
      for (const n of L.notes) if (!F['note_' + n.id]) out.push({ id: 'n:' + n.id, x: n.x, y: n.y, col: '#ffd28a', icon: '文' });
      for (const it of L.items) if (!F[it.flag]) out.push({ id: 'i:' + it.id, x: it.x, y: it.y, col: it.kind === 'relic' ? '#ffb347' : '#fff0dc', icon: it.kind === 'relic' ? '◆' : '✦' });
      for (const n of L.npcs) {
        const pending = n.pending ? n.pending(this) : (n.id === 'barrow' && (!F.met_barrow || (F.got_musicbox && !F.gave_musicbox)));
        if (pending) out.push({ id: 'p:' + n.id, x: n.x, y: n.y, col: '#9cf7b0', icon: '…' });
      }
      return out;
    },
    updBeacons() {
      const P = this.player; this._near = this._near || {};
      for (const b of this.beaconTargets()) {
        const d = Math.abs(b.x - P.x);
        if (d < 380 && Math.abs(b.y - P.y) < 300 && !this._near[b.id]) {
          this._near[b.id] = true;
          G.SFX.play('discover');
          if (!this.save.flags.h_lookhere && !G.Tut.active) { this.save.flags.h_lookhere = true; this.bark('lookHere'); }
        }
      }
    },
    // screen-edge chevrons for collectibles just off-screen (within ~1.6 screens)
    drawEdgeArrows(ctx, W, H) {
      if (this.state !== 'play' || !this.control || !this._view) return;
      const { S, cam } = this._view, s = Math.min(W, H * 1.6) / 900;
      for (const b of this.beaconTargets()) {
        const sx = W / 2 + (b.x - cam.x) * S, sy = H / 2 + (b.y - 60 - cam.y) * S;
        if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
        if (Math.abs(b.x - this.player.x) > 1500 || Math.abs(b.y - this.player.y) > 700) continue;
        const ex = U.clamp(sx, 34 * s, W - 34 * s), ey = U.clamp(sy, 90 * s, H - 70 * s);
        const ang = Math.atan2(sy - ey, sx - ex), pulse = 0.75 + 0.25 * Math.sin(this.realTime * 5);
        ctx.save(); ctx.translate(ex, ey); ctx.globalAlpha = pulse;
        ctx.save(); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(18 * s, 0); ctx.lineTo(4 * s, -10 * s); ctx.lineTo(4 * s, 10 * s); ctx.closePath();
        ctx.fillStyle = b.col; ctx.fill(); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = '#0b0612'; ctx.stroke();
        ctx.restore();
        ctx.beginPath(); ctx.arc(0, 0, 12 * s, 0, TAU); ctx.fillStyle = '#0b0612'; ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = b.col; ctx.stroke();
        ctx.fillStyle = b.col; ctx.font = `700 ${Math.round(12 * s)}px "Noto Sans TC", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.icon, 0, 1);
        ctx.restore();
      }
    },
    drawBarrow(ctx, x, y, t) {
      const F = this.save.flags, P = this.player;
      const look = P.x < x ? -1 : 1;
      ctx.save(); ctx.translate(x, y);
      // lantern glow
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(-26 * look, -30, 0, -26 * look, -30, 120); lg.addColorStop(0, 'rgba(255,190,110,0.35)'); lg.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = lg; ctx.fillRect(-160, -150, 320, 160); ctx.restore();
      // crate seat
      ctx.fillStyle = '#3b3029'; ctx.fillRect(-18, -26, 36, 26); ctx.fillStyle = '#c9b49a'; ctx.fillRect(-18, -26, 36, 2);
      ctx.scale(look, 1);
      const br = Math.sin(t * 1.4) * 1;
      // legs
      ctx.strokeStyle = '#2e2a28'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-2, -30); ctx.lineTo(14, -28); ctx.lineTo(16, -2); ctx.stroke();
      // coat body
      ctx.fillStyle = '#4b3f36';
      ctx.beginPath(); ctx.moveTo(-12, -28); ctx.quadraticCurveTo(-16, -60, -6, -72 + br); ctx.quadraticCurveTo(6, -76 + br, 10, -66 + br); ctx.quadraticCurveTo(14, -44, 10, -26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5c4d42'; ctx.beginPath(); ctx.moveTo(-6, -70 + br); ctx.quadraticCurveTo(-2, -50, 2, -28); ctx.lineTo(-10, -28); ctx.fill();
      // scarf
      ctx.fillStyle = '#7a3b2e'; ctx.beginPath(); ctx.ellipse(1, -70 + br, 10, 5, 0.2, 0, TAU); ctx.fill();
      // head
      ctx.fillStyle = '#d8b9a0'; ctx.beginPath(); ctx.arc(4, -82 + br, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d9d6d0'; ctx.beginPath(); ctx.arc(1, -84 + br, 8.4, PI * 0.8, PI * 1.9); ctx.fill();
      ctx.fillStyle = '#e8e4dc'; ctx.beginPath(); ctx.moveTo(6, -78 + br); ctx.quadraticCurveTo(12, -70 + br, 4, -68 + br); ctx.quadraticCurveTo(2, -74 + br, 6, -78 + br); ctx.fill(); // beard
      ctx.fillStyle = '#2a2420'; ctx.fillRect(8, -84 + br, 2, 1.2);
      // arm + lantern
      ctx.strokeStyle = '#4b3f36'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(2, -62 + br); ctx.lineTo(16, -46); ctx.lineTo(24, -40); ctx.stroke();
      ctx.fillStyle = '#2a2420'; ctx.fillRect(21, -42, 8, 3);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,200,120,0.9)'; ctx.fillRect(22, -38, 6, 9); ctx.restore();
      ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 1; ctx.strokeRect(22, -38, 6, 9);
      ctx.restore();
      void F;
    },
    drawPickups(ctx) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const p of this.pickups) {
        if (p.kind === 'loot') continue;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 12);
        g.addColorStop(0, 'rgba(230,252,255,0.95)'); g.addColorStop(0.4, 'rgba(111,243,255,0.5)'); g.addColorStop(1, 'rgba(111,243,255,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
      }
      ctx.restore();
      for (const p of this.pickups) if (p.kind === 'loot') G.Gear.drawLoot(ctx, p, this.time);
    },
    drawEnemyUI(ctx) {
      const P = this.player;
      for (const e of this.enemies) {
        if (e.dead || e.boss || e.elite || e.state === 'spawn') continue;
        const show = e.showBar > 0 || e.bal > 0 || e.hp < e.maxHp;
        const x = e.x, y = e.y - e.h - 22;
        if (show) {
          const w = 64, a = Math.min(1, Math.max(e.showBar, 0.6));
          ctx.globalAlpha = a;
          ctx.fillStyle = 'rgba(10,8,12,0.7)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
          ctx.fillStyle = '#f2ece4'; ctx.fillRect(x - w / 2, y, w * (e.hp / e.maxHp), 3);
          if (e.bal > 0) {
            const bw = w * (e.bal / e.maxBal);
            ctx.fillStyle = e.state === 'broken' ? '#ffd27a' : 'rgba(255,190,90,0.85)';
            ctx.fillRect(x - bw / 2, y + 6, bw, 2.5);
          }
          ctx.globalAlpha = 1;
        }
        if (e.state === 'broken') {
          const near = Math.abs(e.x - P.x) < 200;
          const pulse = 0.6 + Math.sin(this.realTime * 8) * 0.4;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(255,210,122,${pulse})`;
          const dy = y - 18;
          ctx.beginPath(); ctx.moveTo(x, dy - 9); ctx.lineTo(x + 9, dy); ctx.lineTo(x, dy + 9); ctx.lineTo(x - 9, dy); ctx.fill();
          ctx.restore();
          if (near) {
            ctx.font = '700 13px Rajdhani, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe2a8';
            ctx.fillText(`${G.Input.glyph('light')}  處決`, x, dy - 16);
          }
        }
      }
      // elite/boss execute marker
      const b = this.bossRef;
      if (b && b.state === 'broken') {
        const x = b.x, y = b.y - b.h - 40;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,210,122,${0.6 + Math.sin(this.realTime * 8) * 0.4})`;
        ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 12, y); ctx.fill(); ctx.restore();
        if (Math.abs(b.x - P.x) < 200) { ctx.font = '700 14px Rajdhani, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe2a8'; ctx.fillText(`${G.Input.glyph('light')}  處決`, x, y - 20); }
      }
    },
    drawForeground(ctx, cam, S) {
      if (G.Chapters.hook('drawForeground', ctx, cam, S, this) === true) return;
      // near-camera silhouettes for depth (parallax 1.35)
      const f = 1.35, span = 1400;
      const base = Math.floor((cam.x * f - 1400) / span);
      for (let i = base; i < base + 4; i++) {
        const rng = U.mulberry32(i * 977 + 13);
        if (rng() < 0.35) continue;
        const lx = i * span + rng() * 600;
        const wx = cam.x + (lx - cam.x * f) / f * 1; // place relative so it moves faster than world
        const x = cam.x + (lx - cam.x * f);
        const kind = rng();
        ctx.save();
        ctx.fillStyle = 'rgba(8,7,10,0.92)';
        if (kind < 0.5) {
          // sagging cables and a dangling tag, swaying in the wind
          const top = cam.y - 380, sway = Math.sin(this.realTime * 0.8 + i) * 8;
          ctx.strokeStyle = 'rgba(8,7,10,0.85)';
          for (let k = 0; k < 3; k++) {
            ctx.lineWidth = 2.2 - k * 0.5;
            ctx.beginPath(); ctx.moveTo(x - 160 + k * 30, top); ctx.quadraticCurveTo(x + sway + k * 10, top + 70 + k * 26 + rng() * 40, x + 180 - k * 20, top); ctx.stroke();
          }
          ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 10, top + 60); ctx.lineTo(x + 14 + sway * 1.5, top + 150); ctx.stroke();
          ctx.fillRect(x + 6 + sway * 1.5, top + 150, 16, 22);
        } else {
          // foreground rubble / rebar from bottom
          const gy = 128;
          ctx.beginPath(); ctx.moveTo(x - 140, gy + 200); ctx.lineTo(x - 110, gy + 10); ctx.lineTo(x - 40, gy - 30); ctx.lineTo(x + 30, gy + 4); ctx.lineTo(x + 120, gy - 10); ctx.lineTo(x + 160, gy + 200); ctx.fill();
          ctx.strokeStyle = 'rgba(8,7,10,0.92)'; ctx.lineWidth = 3;
          for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - 60 + k * 30, gy); ctx.lineTo(x - 70 + k * 34 + rng() * 20, gy - 60 - rng() * 60); ctx.stroke(); }
        }
        ctx.restore();
        void wx;
      }
    },
  };

  window.addEventListener('load', () => Game.init());
})(window.G);

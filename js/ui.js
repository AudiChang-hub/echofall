'use strict';
/* ECHOFALL — DOM interface: menus, HUD, dialogue, codex, pylon, endings */
(function (G) {
  const U = G.U, D = G.DATA;
  const $ = (s) => document.querySelector(s);
  const I = () => G.Input;
  const glyphs = (txt) => txt.replace(/\{(\w+)\}/g, (_, a) => `<kbd>${G.Input.glyph(a)}</kbd>`);

  /* ------------------------------ Menu ------------------------------ */
  class Menu {
    constructor(el, items, opts = {}) { this.el = el; this.items = items; this.i = opts.start || 0; this.opts = opts; this.render(); }
    render() {
      this.el.innerHTML = '';
      this.btns = this.items.map((it, k) => {
        const b = document.createElement('button');
        b.className = 'mi' + (it.cls ? ' ' + it.cls : '') + (it.disabled ? ' disabled' : '');
        b.style.animationDelay = (this.opts.delay ?? 0.05) + k * 0.06 + 's';
        b.innerHTML = `<span class="n">${String(k + 1).padStart(2, '0')}</span><span class="l">${it.label}${it.en ? `<span class="en">${it.en}</span>` : ''}</span>${it.val ? `<span class="val">${it.val()}</span>` : ''}${it.extra ? `<span class="xtra">${it.extra()}</span>` : ''}`;
        b.addEventListener('mousemove', () => { if (this.i !== k) this.focus(k, true); });
        // clickSelects: a click/tap only selects (read the details first); the screen offers its own commit button
        b.addEventListener('click', () => { if (this.opts.clickSelects) { this.focus(k); return; } this.focus(k); this.activate(); });
        this.el.appendChild(b);
        return b;
      });
      this.focus(Math.min(this.i, this.items.length - 1), true);
    }
    refresh() {
      this.items.forEach((it, k) => {
        const v = this.btns[k].querySelector('.val'); if (v && it.val) v.innerHTML = it.val();
        const x = this.btns[k].querySelector('.xtra'); if (x && it.extra) x.innerHTML = it.extra();
        this.btns[k].classList.toggle('disabled', !!(typeof it.disabled === 'function' ? it.disabled() : it.disabled));
      });
    }
    focus(k, silent) {
      if (k < 0 || k >= this.items.length) return;
      if (k !== this.i && !silent) G.SFX.play('ui');
      if (k !== this.i && silent && this.btns[k]) G.SFX.play('ui');
      this.i = k;
      this.btns.forEach((b, j) => b.classList.toggle('focus', j === k));
      if (this.btns[k] && this.el.scrollHeight > this.el.clientHeight + 4) this.btns[k].scrollIntoView({ block: 'nearest' });
      this.opts.onFocus && this.opts.onFocus(this.items[k], k);
    }
    activate() {
      const it = this.items[this.i];
      const dis = typeof it.disabled === 'function' ? it.disabled() : it.disabled;
      if (dis) { G.SFX.play('uiBack'); return; }
      if (it.action) { G.SFX.play('uiOk'); it.action(it); }
    }
    handle() {
      const In = I();
      if (In.tap('menuUp')) this.focus((this.i - 1 + this.items.length) % this.items.length);
      else if (In.tap('menuDown')) this.focus((this.i + 1) % this.items.length);
      else if (In.tap('menuLeft') && this.items[this.i].left) { this.items[this.i].left(); G.SFX.play('ui'); this.refresh(); }
      else if (In.tap('menuRight') && this.items[this.i].right) { this.items[this.i].right(); G.SFX.play('ui'); this.refresh(); }
      else if (In.tap('confirm')) this.activate();
    }
  }

  const UI = G.UI = {
    stack: [], frame: 0, closedFrame: -1, odeTalking: false,

    init() {
      this.el = { hud: $('#hud'), boss: $('#bossBar'), prompt: $('#prompt'), bark: $('#bark'), hint: $('#hint'), toasts: $('#toasts'), zone: $('#zone') };
      const boot = $('#boot');
      const go = () => {
        if (this.booted) return; this.booted = true;
        G.Audio.init(); G.game.applySettings();
        boot.classList.remove('show');
        G.SFX.play('pylon');
        setTimeout(() => this.toTitle(true), 300);
      };
      window.addEventListener('keydown', () => { if (!this.booted) go(); });
      boot.addEventListener('pointerdown', go);
      document.documentElement.classList.add('booted');
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        boot.querySelector('.boot-press span').textContent = '點擊畫面開始';
        boot.querySelector('.boot-press em').textContent = 'TAP TO START';
        boot.querySelector('.boot-note').textContent = '建議戴耳機・橫向持握・點擊後自動全螢幕';
      }
      this.hudCache = {};
      setInterval(() => this.refreshGlyphs(), 500);
    },
    refreshGlyphs() {
      if (this._dev === G.Input.device) return; this._dev = G.Input.device;
      document.querySelectorAll('kbd[data-g]').forEach((k) => { k.textContent = G.Input.glyph(k.dataset.g); });
      const tg = $('#titleGlyphs'); if (tg) tg.innerHTML = G.Input.device === 'pad' ? '手把模式 · GAMEPAD' : G.Input.device === 'touch' ? '觸控模式 · TOUCH' : '鍵盤模式 · KEYBOARD';
    },

    /* ---------------- stack ---------------- */
    push(layer) {
      layer.openedFrame = this.frame; this.stack.push(layer); if (layer.el) layer.el.classList.add('show');
      if (layer.el) layer.el.querySelectorAll('kbd[data-g]').forEach((k) => { k.textContent = G.Input.glyph(k.dataset.g); });
      // a layer opened on top of another (e.g. the archive from a pylon) must also draw on top of it, whatever the DOM order
      if (layer.el && !layer.keepShown) layer.el.style.zIndex = this.stack.length > 1 ? String(Math.min(4, this.stack.length)) : '';
      if (['pause', 'codex', 'pylon', 'savecode', 'note'].includes(layer.id)) G.SFX.play('pageOpen');
    },
    pop() { const l = this.stack.pop(); if (l && l.el && !l.keepShown) { l.el.classList.remove('show'); l.el.style.zIndex = ''; } this.closedFrame = this.frame; l && l.onClose && l.onClose(); return l; },
    top() { return this.stack[this.stack.length - 1]; },
    modalOpen() { return this.stack.length > 0 || this.closedFrame === this.frame; },
    get dialogActive() { return this.stack.some((l) => l.id === 'dialog' || l.id === 'note' || l.id === 'relic'); },

    update(dt) {
      this.frame++;
      this._dev !== G.Input.device && this.refreshGlyphs();
      const t = this.top();
      if (t) {
        if (t.handle) t.handle(dt);
        else if (t.menu) {
          t.menu.handle();
          if (I().tap('back') && t.back) { G.SFX.play('uiBack'); t.back(); }
        }
      }
      // bark timer
      if (this.barkT > 0) { this.barkT -= dt; if (this.barkT <= 0) { this.el.bark.classList.remove('show'); this.odeTalkingBark = false; } }
      if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.el.hint.classList.remove('show'); }
      this.odeTalking = (this.dlgWho === 'ode' && this.dlgTyping) || this.odeTalkingBark;
      if (this.stack.length && this._prompt) this.prompt(null);
      const cine = this.stack.some((l) => l.id === 'dialog');
      if (cine !== this._cine) { this._cine = cine; this.el.hud.classList.toggle('cine', cine); }
    },

    /* ---------------- title ---------------- */
    toTitle(first) {
      const g = G.game;
      g.state = 'title'; g.control = false; g.phase2 = false;
      if (G.Abyss.active && g.save) { G.Abyss.recover(g.save); g.persist(); }   // quitting mid-run: back to the surface
      G.Routes.active = null;
      G.Chapters.load(1);
      g.save = g.defaultSave('normal'); g.diff = D.difficulty.normal; g.stats = g.save.stats;
      g.player = new G.Player(g); g.player.x = 470; g.player.y = 0; g.player.facing = 1; g.player.setState('move');
      g.resetWorld(); g.cam.x = 600; g.cam.y = -150; g.fadeA = first ? 1 : g.fadeA; g.fadeTarget = 0;
      this.showHud(false); this.bossBar(null);
      G.Music.play('title'); G.Ambience.set('quiet');
      // the rest of the journey downloads quietly while the player is on the title / in chapter 1
      setTimeout(() => G.Chapters.prefetch(), 2500);
      const title = $('#title');
      title.classList.remove('show'); void title.offsetWidth; title.classList.add('show');
      const items = [];
      // the kicker names the chapter the saved journey is in (Chapter I for a fresh start)
      const kch = (g.hasSave() && G.Chapters.info(((G.Store.get('save', null) || {}).chapter) || 1)) || null, kick = title.querySelectorAll('.logo-kicker span');
      if (kick.length === 3) { kick[0].textContent = 'CHAPTER ' + ((kch && kch.num) || 'I'); kick[2].textContent = (kch && kch.title) || '墜落的音符'; }
      if (g.hasSave()) {
        const sv = G.Store.get('save', null), ch = G.Chapters.info((sv && sv.chapter) || 1);
        items.push({ label: '繼續旅程', en: ch ? `CONTINUE · 第${ch.numZh || ch.num}章 ${ch.title}` : 'CONTINUE', action: () => { this.closeTitle(); G.game.continueGame(); } });
      }
      items.push({ label: '新的旅程', en: 'NEW JOURNEY', action: () => this.openDiff() });
      items.push({ label: '檔案庫', en: 'ARCHIVE', action: () => this.openCodex() });
      items.push({ label: '存檔碼', en: 'SAVE CODE', action: () => this.openSaveCode(false) });
      items.push({ label: '設定', en: 'SETTINGS', action: () => this.openSettings() });
      items.push({ label: '操作說明', en: 'CONTROLS', action: () => this.openControls() });
      items.push({ label: '製作名單', en: 'CREDITS', action: () => this.openCredits(true) });
      this.stack = [];
      this.push({ id: 'title', el: title, keepShown: true, menu: new Menu($('#titleMenu'), items, { delay: 1.2 }) });
    },
    closeTitle() { $('#title').classList.remove('show'); $('#diffPanel').classList.remove('show'); this.stack = []; this.closedFrame = this.frame; },
    openDiff() {
      const panel = $('#diffPanel'), desc = $('#diffDesc');
      const keys = ['story', 'normal', 'master'];
      const items = keys.map((k) => ({ label: D.difficulty[k].name, en: D.difficulty[k].en, key: k, action: () => { this.closeTitle(); G.game.newGame(k); } }));
      const menu = new Menu($('#diffMenu'), items, { start: 1, delay: 0, onFocus: (it) => { desc.textContent = D.difficulty[it.key].desc; } });
      $('#diffClose').onclick = () => { if (this.top() && this.top().id === 'diff') { G.SFX.play('uiBack'); this.pop(); } };
      this.push({ id: 'diff', el: panel, menu, back: () => this.pop() });
    },

    /* ---------------- intro ---------------- */
    intro(lines, cb) {
      const el = $('#intro'), t = $('.intro-t'), s = $('.intro-s');
      el.querySelector('.intro-skip').innerHTML = G.Input.device === 'touch' ? '點擊畫面跳過' : `按 <kbd>${G.Input.glyph('confirm')}</kbd> 跳過`;
      let i = 0, timer = 0, phase = 0, done = false;
      const finish = () => { if (done) return; done = true; this.pop(); el.classList.remove('on'); setTimeout(cb, 200); };
      el.onclick = () => finish();
      const show = () => { t.textContent = lines[i].t; s.textContent = lines[i].s; el.classList.add('on'); phase = 1; timer = 0; };
      this.push({ id: 'intro', el, handle: (dt) => {
        timer += dt;
        if (I().tap('confirm') || I().tap('back')) { finish(); return; }
        if (phase === 0 && timer > 1.0) show();
        else if (phase === 1 && timer > 4.2) { el.classList.remove('on'); phase = 2; timer = 0; }
        else if (phase === 2 && timer > 1.5) { i++; if (i >= lines.length) finish(); else show(); }
      } });
    },

    /* ---------------- HUD ---------------- */
    showHud(v) { this.el.hud.classList.toggle('show', v); },
    hud(P, g) {
      if (g.state !== 'play') return;
      if (!this.el.hud.classList.contains('show')) this.showHud(true);
      const c = this.hudCache, set = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const hpW = U.clamp(P.hp / P.maxHp, 0, 1), rW = U.clamp((P.hp + P.rally) / P.maxHp, 0, 1);
      const hpEl = this.el.hud.querySelector('.bar.hp'), maxW = Math.min(360, 220 + P.maxHp * 0.9);
      set('hpMax', maxW, (v) => (hpEl.style.width = v + 'px'));
      set('hp', hpW.toFixed(3), (v) => { hpEl.querySelector('.fill').style.width = v * 100 + '%'; hpEl.querySelector('.trail').style.width = v * 100 + '%'; });
      set('rally', rW.toFixed(3), (v) => (hpEl.querySelector('.rally').style.width = v * 100 + '%'));
      set('hpn', `${Math.ceil(P.hp)} / ${P.maxHp}`, (v) => ($('#hpNum').textContent = v));
      const sta = this.el.hud.querySelector('.bar.sta');
      set('sta', (P.sta / P.maxSta).toFixed(3), (v) => (sta.querySelector('.fill').style.width = v * 100 + '%'));
      set('staLow', P.sta < 20, (v) => sta.classList.toggle('low', v));
      const r = Math.round(P.res);
      set('res', r, (v) => {
        const cells = document.querySelectorAll('#resCells i');
        cells.forEach((cell, i) => { const f = U.clamp((v - i * 25) / 25, 0, 1); cell.style.setProperty('--f', f); cell.classList.toggle('full', f >= 1); });
        $('#resCells').classList.toggle('max', v >= 100);
        const sk = G.DnD.skills();
        $('#sk1').classList.toggle('ready', v >= sk.c1);
        $('#skName').textContent = v >= sk.c2 ? sk.n2 : sk.n1; $('#skCost').textContent = v >= sk.c2 ? '◆◆' : '◆';
      });
      set('shards', Math.floor(g.save.shards), (v) => { const s = $('#shardNum'); s.textContent = v; const p = s.parentElement; p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); });
      set('gearUp', G.Gear ? G.Gear.hasNewBetter(g.save) : false, (v) => { $('#gearUp').hidden = !v; });
      set('tonic', g.save.tonic, (v) => { $('#tonicNum').textContent = v; $('.tonic').classList.toggle('empty', v <= 0); });
      set('drop', !!g.save.drop, (v) => $('#dropInd').classList.toggle('show', v));
      // owned Echoes as small coloured sigils (level pips under each)
      set('echoes', JSON.stringify(g.save.boons || {}), (v) => {
        const b = JSON.parse(v);
        $('#echoes').innerHTML = Object.keys(b).map((id) => { const d = G.Boons.ALL[id]; return d ? `<span style="--c:${d.col}" title="${d.name}">${d.icon}<i>${'•'.repeat(b[id])}</i></span>` : ''; }).join('');
      });
      // boss
      const b = g.bossRef;
      if (b && this.bossOn) {
        set('bhp', (b.hp / b.maxHp).toFixed(3), (v) => { this.el.boss.querySelector('.bhp .fill').style.width = v * 100 + '%'; this.el.boss.querySelector('.bhp .trail').style.width = v * 100 + '%'; });
        set('bbal', (b.bal / b.maxBal).toFixed(3), (v) => (this.el.boss.querySelector('.bbal .fill').style.width = v * 100 + '%'));
      }
    },
    bossBar(e) {
      this.bossOn = !!e;
      this.el.boss.classList.toggle('show', !!e);
      if (e) {
        $('#bossName').textContent = e.T.name; $('#bossEn').textContent = e.T.en || (e.boss ? 'MAESTRINA — THE FIRST CONDUCTOR' : 'GRAVES — THE UNSTRUNG KNIGHT');
        this.el.boss.classList.toggle('elite', !!e.elite);
        this.hudCache.bhp = null; this.hudCache.bbal = null;
      }
    },
    prompt(html) {
      if (this._prompt === html) return; this._prompt = html;
      if (html) { this.el.prompt.innerHTML = html; this.el.prompt.classList.add('show'); } else this.el.prompt.classList.remove('show');
    },
    bark(who, text) {
      const sp = D.speakers[who];
      this.el.bark.querySelector('b').textContent = sp.en; this.el.bark.querySelector('b').style.color = sp.color;
      this.el.bark.querySelector('span').textContent = text;
      this.el.bark.classList.add('show'); this.barkT = 3.4; this.odeTalkingBark = who === 'ode';
    },
    hint(html) {
      if (!html) return;
      this.el.hint.querySelector('p').innerHTML = glyphs(html);
      this.el.hint.classList.add('show'); this.hintT = 8;
    },
    toast(msg, kind = '') {
      const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = msg;
      this.el.toasts.appendChild(d); setTimeout(() => d.remove(), 2700);
    },
    journal(title, sub) { this.toast(`◆ ${title}　${sub}`, 'item'); G.SFX.play('note'); },
    zoneCard(name, en) {
      const z = this.el.zone; z.querySelector('h2').textContent = name; z.querySelector('p').textContent = en;
      z.classList.remove('show'); void z.offsetWidth; z.classList.add('show');
    },

    /* ---------------- dialogue ---------------- */
    dialog(lines, cb) {
      const el = $('#dialog'), box = el.querySelector('.dlg'), whoEl = el.querySelector('.dlg-who'), textEl = el.querySelector('.dlg-text');
      let i = -1, shown = 0, full = '';
      const next = () => {
        i++;
        if (i >= lines.length) { this.dlgWho = null; this.dlgTyping = false; this.pop(); cb && cb(); return; }
        const ln = lines[i], sp = D.speakers[ln.who];
        whoEl.style.setProperty('--c', sp.color);
        whoEl.querySelector('b').textContent = sp.name; whoEl.querySelector('span').textContent = sp.en;
        full = ln.text; shown = 0; textEl.textContent = ''; box.classList.remove('done');
        this.dlgWho = ln.who; this.dlgTyping = true;
      };
      const adv = () => {
        if (shown < full.length) { shown = full.length; textEl.textContent = full; box.classList.add('done'); this.dlgTyping = false; }
        else { G.SFX.play('ui'); next(); }
      };
      const click = () => { if (this.top() && this.top().id === 'dialog') adv(); };
      el.onclick = click;
      this.push({ id: 'dialog', el, handle: (dt) => {
        if (shown < full.length) {
          const before = Math.floor(shown);
          shown = Math.min(full.length, shown + dt * 42 * G.game.settings.textSpeed);
          if (Math.floor(shown) !== before) { textEl.textContent = full.slice(0, Math.floor(shown)); }
          if (shown >= full.length) { box.classList.add('done'); this.dlgTyping = false; }
        }
        const In = I();
        if (In.tap('confirm') || In.tap('light') || In.tap('interact')) adv();
      } });
      next();
    },

    /* ---------------- pause / settings / controls ---------------- */
    openPause() {
      this._tutSkipItem = G.Tut && G.Tut.active;
      const g = G.game;
      g.paused = true;
      const st = g.stats;
      $('#pauseStats').innerHTML = `<div>遊玩時間<b>${U.fmtTime(st.time)}</b></div><div>完美格擋<b>${st.parries}</b></div><div>殘響閃避<b>${st.dodges}</b></div><div>倒下<b>${st.deaths}</b></div>`;
      const resume = () => { this.pop(); };
      $('#pauseClose').onclick = () => { if (this.top() && this.top().id === 'pause') { G.SFX.play('uiBack'); resume(); } };
      const items = [
        { label: '繼續', en: 'RESUME', action: resume },
        ...(this._tutSkipItem ? [{ label: '跳過戰鬥訓練', en: 'SKIP TRAINING', action: () => { resume(); G.Tut.skip(); } }] : []),
        { label: '全螢幕', en: 'FULLSCREEN', action: () => G.Fullscreen.toggle() },
        ...(g.save && g.save.dnd ? [{ label: '角色', en: 'CHARACTER', action: () => G.DnD.openSheet() }] : []),
        { label: '裝備', en: G.Gear && G.Gear.anyBetter(g.save) ? '▲ 有可替換的裝備' : 'EQUIPMENT', action: () => this.openGear() },
        { label: '殘響・遺物', en: 'BUILD', action: () => this.openBuild() },
        { label: '檔案庫', en: 'ARCHIVE', action: () => this.openCodex() },
        { label: '存檔碼', en: 'SAVE CODE', action: () => this.openSaveCode(true) },
        { label: '設定', en: 'SETTINGS', action: () => this.openSettings() },
        { label: '操作說明', en: 'CONTROLS', action: () => this.openControls() },
        { label: '回到標題', en: 'QUIT TO TITLE', action: () => { this.stack.forEach((l) => l.el && l.el.classList.remove('show')); this.stack = []; g.persist(); this.toTitle(); } },
      ];
      this.push({ id: 'pause', el: $('#pause'), menu: new Menu($('#pauseMenu'), items), back: resume, onClose: () => { g.paused = false; G.Input.clearBuffers(); } });
      G.game.state = 'paused';
      const l = this.top(); const oc = l.onClose; l.onClose = () => { oc(); if (G.game.state === 'paused') G.game.state = 'play'; };
    },
    openSettings() {
      const s = G.game.settings, g = G.game;
      const pct = (v) => `<span class="slider"><i style="width:${v * 100}%"></i></span><b class="num">${Math.round(v * 100)}</b>`;
      const step = (k, d) => () => { s[k] = Math.round(U.clamp(s[k] + d, 0, 1) * 10) / 10; g.applySettings(); };
      // tap / Enter steps up and wraps back to 0, so every value is reachable without arrow keys
      const cycle = (k) => () => { s[k] = s[k] >= 0.95 ? 0 : Math.round((s[k] + 0.1) * 10) / 10; g.applySettings(); };
      const tog = (k) => () => { s[k] = !s[k]; g.applySettings(); };
      const slide = (label, en, k) => ({ label, en, key: k, val: () => pct(s[k]), left: step(k, -0.1), right: step(k, 0.1), action: cycle(k) });
      const items = [
        {
          label: '畫質', en: 'QUALITY', val: () => G.Quality.label,
          action: () => { const o = ['auto', 'high', 'low']; s.quality = o[(o.indexOf(s.quality || 'auto') + 1) % 3]; g.applySettings(); g.applyQuality(); },
          left: () => { const o = ['auto', 'high', 'low']; s.quality = o[(o.indexOf(s.quality || 'auto') + 2) % 3]; g.applySettings(); g.applyQuality(); },
          right: () => { const o = ['auto', 'high', 'low']; s.quality = o[(o.indexOf(s.quality || 'auto') + 1) % 3]; g.applySettings(); g.applyQuality(); },
        },
        {
          label: '幀率', en: 'FRAME RATE', val: () => ({ auto: '60（建議）', '30': '30 省電', max: '不限' })[s.fps || 'auto'],
          action: () => { const o = ['auto', '30', 'max']; s.fps = o[(o.indexOf(s.fps || 'auto') + 1) % 3]; g.applySettings(); },
          left: () => { const o = ['auto', '30', 'max']; s.fps = o[(o.indexOf(s.fps || 'auto') + 2) % 3]; g.applySettings(); },
          right: () => { const o = ['auto', '30', 'max']; s.fps = o[(o.indexOf(s.fps || 'auto') + 1) % 3]; g.applySettings(); },
        },
        slide('主音量', 'MASTER', 'master'), slide('音樂', 'MUSIC', 'music'), slide('音效', 'EFFECTS', 'sfx'), slide('畫面震動', 'SCREEN SHAKE', 'shake'),
        { label: '受傷閃光', en: 'DAMAGE FLASH', val: () => (s.flashes ? '開啟 ON' : '關閉 OFF'), left: tog('flashes'), right: tog('flashes'), action: tog('flashes') },
        { label: '觸控輔助', en: 'TOUCH ASSIST', val: () => (s.touchAssist !== false ? '開啟 ON' : '關閉 OFF'), left: tog('touchAssist'), right: tog('touchAssist'), action: tog('touchAssist') },
        { label: '教學提示', en: 'TUTORIAL HINTS', val: () => (s.hints ? '開啟 ON' : '關閉 OFF'), left: tog('hints'), right: tog('hints'), action: tog('hints') },
        { label: '文字速度', en: 'TEXT SPEED', val: () => ['慢', '標準', '快'][s.textSpeed < 0.9 ? 0 : s.textSpeed > 1.1 ? 2 : 1], left: () => { s.textSpeed = Math.max(0.6, s.textSpeed - 0.5); g.applySettings(); }, right: () => { s.textSpeed = Math.min(1.6, s.textSpeed + 0.5); g.applySettings(); }, action: () => { s.textSpeed = s.textSpeed >= 1.5 ? 0.6 : s.textSpeed + 0.5; g.applySettings(); } },
        { label: '返回', en: 'BACK', action: () => this.pop() },
      ];
      const m = new Menu($('#settingsMenu'), items, { delay: 0 });
      items.forEach((it) => { if (it.action && it.label !== '返回') { const a = it.action; it.action = () => { a(); m.refresh(); }; } });
      // tapping/clicking directly on a slider bar sets that value
      const host = $('#settingsMenu');
      if (!host._slideBound) {
        host._slideBound = true;
        host.addEventListener('click', (e) => {
          const bar = e.target.closest('.slider'); if (!bar || !host._menu) return;
          e.stopPropagation(); e.preventDefault();
          const k = host._menu.btns.indexOf(bar.closest('.mi')), it = host._menu.items[k]; if (!it || !it.key) return;
          const r = bar.getBoundingClientRect();
          G.game.settings[it.key] = Math.round(U.clamp((e.clientX - r.left) / r.width, 0, 1) * 10) / 10; G.game.applySettings();
          host._menu.focus(k, true); host._menu.refresh(); G.SFX.play('ui');
        }, true);
      }
      host._menu = m;
      $('#settingsClose').onclick = () => { if (this.top() && this.top().id === 'settings') { G.SFX.play('uiBack'); this.pop(); } };
      this.push({ id: 'settings', el: $('#settings'), menu: m, back: () => this.pop() });
    },
    openControls() {
      const rows = [['移動', 'left', 'A / D', '左搖桿', '左側虛擬搖桿'], ['跳躍（空中再按一次二段跳）', 'jump', 'Space', 'Ⓐ', '跳'],
        ['攻擊：連按連段・按住重擊・自動處決', 'light', 'J / 滑鼠左鍵', 'Ⓧ', '攻（按住重擊）'], ['格擋・完美格擋', 'guard', 'K / 滑鼠右鍵', 'LB', '擋'],
        ['閃避', 'dodge', 'L / Shift', 'Ⓑ', '閃'], ['共鳴技（自動選擇）', 'skill', 'U / Q', 'Ⓨ', '技（能量足夠時出現）'],
        ['回復（喝調和劑）', 'heal', 'F', 'RT', '右上「回復」'], ['互動', 'interact', 'E', '十字鍵 ▼', '點擊畫面上的提示'],
        ['下跳穿越平台', 'down', 'S + Space', '▼ + Ⓐ', '搖桿往下 + 跳'], ['暫停', 'pause', 'P / Esc', '☰', '右上 ☰']];
      const col = G.Input.device === 'pad' ? 3 : G.Input.device === 'touch' ? 4 : 2;
      $('#ctlGrid').innerHTML = rows.map((r) => `<div><span>${r[0]}</span><span>${r[col]}</span></div>`).join('');
      $('#controlsClose').onclick = () => { if (this.top() && this.top().id === 'controls') { G.SFX.play('uiBack'); this.pop(); } };
      this.push({ id: 'controls', el: $('#controls'), menu: new Menu($('#controlsMenu'), [{ label: '返回', en: 'BACK', action: () => this.pop() }], { delay: 0 }), back: () => this.pop() });
    },

    /* ---------------- save code (export / import) ---------------- */
    openSaveCode(fromPause) {
      const g = G.game, el = $('#savecode'), text = $('#scText'), info = $('#scInfo'), btn = $('#scPrimary'), msg = $('#scMsg'), label = $('#scLabel');
      if (fromPause) g.persist();
      let mode = 'export', pending = null;
      const describe = (s) => {
        const py = G.LEVEL.pylons.find((p) => p.id === s.checkpoint);
        const d = D.difficulty[s.diff] || D.difficulty.normal;
        const done = s.flags && s.flags.ending ? '　·　<b>已通關</b>' : '';
        return `存檔點 <b>${py ? py.name : '起點'}</b>　·　遊玩 <b>${U.fmtTime(s.stats.time || 0)}</b>　·　碎片 <b>${Math.floor(s.shards || 0)}</b>　·　難度 <b>${d.name}</b>${done}`;
      };
      const setMsg = (t, kind = '') => { msg.textContent = t; msg.className = 'sc-msg ' + kind; };
      const render = () => {
        el.querySelectorAll('#scTabs .tab').forEach((b) => b.classList.toggle('on', b.dataset.k === mode));
        setMsg(''); pending = null;
        if (mode === 'export') {
          const s = G.Store.get('save', null);
          label.textContent = '你的存檔碼';
          text.readOnly = true;
          if (s && s.v === 1 && s.checkpoint) {
            info.innerHTML = describe(s);
            text.value = G.SaveCode.encode(s);
            btn.textContent = '複製存檔碼'; btn.disabled = false;
          } else {
            info.textContent = '還沒有存檔。在遊戲中第一次點亮「魂燈台」之後，就會產生存檔。';
            text.value = ''; btn.textContent = '複製存檔碼'; btn.disabled = true;
          }
        } else {
          label.textContent = '貼上存檔碼';
          text.readOnly = false; text.value = '';
          info.textContent = '貼上從另一台裝置複製的存檔碼（以 EF1- 開頭）。載入後會取代這個瀏覽器目前的進度。';
          btn.textContent = '讀取存檔碼'; btn.disabled = false;
          setTimeout(() => text.focus(), 50);
        }
      };
      const close = () => { if (this.top() && this.top().id === 'savecode') { text.blur(); this.pop(); G.Input.clearBuffers(); } };
      btn.onclick = async () => {
        if (mode === 'export') {
          if (btn.disabled) return;
          try { await navigator.clipboard.writeText(text.value); setMsg('已複製。到另一台裝置的「存檔碼 → 匯入」貼上即可。', 'ok'); G.SFX.play('uiOk'); }
          catch (e) { text.focus(); text.select(); setMsg('已幫你選取文字，請按 Ctrl+C（手機請長按）複製。', 'ok'); }
          return;
        }
        if (!pending) {
          const r = G.SaveCode.decode(text.value);
          if (!r.ok) { setMsg(r.error, 'err'); G.SFX.play('uiBack'); return; }
          pending = r.save;
          info.innerHTML = '這個存檔碼的進度：' + describe(r.save);
          btn.textContent = G.Store.get('save', null) ? '確認覆蓋目前進度並載入' : '確認載入';
          setMsg('確認無誤後再按一次。', '');
          G.SFX.play('ui');
          return;
        }
        G.Store.set('save', pending);
        G.SFX.play('pylon');
        this.stack.forEach((l) => l.el && l.el.classList.remove('show'));
        this.stack = []; this.closedFrame = this.frame;
        $('#title').classList.remove('show'); $('#diffPanel').classList.remove('show');
        g.continueGame();
        this.toast('已載入存檔', 'good');
      };
      text.oninput = () => { if (mode === 'import' && pending) { pending = null; btn.textContent = '讀取存檔碼'; setMsg(''); } };
      el.querySelectorAll('#scTabs .tab').forEach((b) => { b.onclick = () => { mode = b.dataset.k; G.SFX.play('ui'); render(); }; });
      $('#scClose').onclick = close;
      render();
      this.push({ id: 'savecode', el, handle: () => {
        const In = I();
        if (In.tap('back')) { G.SFX.play('uiBack'); close(); return; }
        if (document.activeElement === text) return;
        if (In.tap('menuLeft') || In.tap('menuRight') || In.tap('tabL') || In.tap('tabR')) { mode = mode === 'export' ? 'import' : 'export'; G.SFX.play('ui'); render(); }
        else if (In.tap('confirm')) btn.click();
      } });
    },

    /* ---------------- codex ---------------- */
    openCodex(startTab) {
      const F = G.game.save.flags;
      const tabs = [['people', '人物'], ['hushborn', '寂裔'], ['world', '世界'], ['items', '物品'], ['notes', '文書']];
      let ti = Math.max(0, tabs.findIndex((t) => t[0] === startTab)), li = 0;
      const unlocked = (e, cat) => cat === 'notes' ? !!F['note_' + e.id] : (e.always || !!F[e.unlock]);
      const tabsEl = $('#codexTabs'), listEl = $('#codexList'), det = $('#codexDetail');
      const renderTabs = () => {
        tabsEl.innerHTML = tabs.map((t, k) => `<button class="tab ${k === ti ? 'on' : ''}" data-k="${k}">${t[1]}</button>`).join('');
        tabsEl.querySelectorAll('.tab').forEach((b) => b.onclick = () => { ti = +b.dataset.k; li = 0; renderTabs(); renderList(); G.SFX.play('ui'); });
      };
      const entries = () => D.codex[tabs[ti][0]];
      const renderList = () => {
        const cat = tabs[ti][0];
        listEl.innerHTML = entries().map((e, k) => {
          const ok = unlocked(e, cat);
          return `<li class="${k === li ? 'focus' : ''} ${ok ? '' : 'locked'}" data-k="${k}">${ok ? e.name : '？？？'}${ok && e.en ? `<small>${e.en}</small>` : ''}</li>`;
        }).join('');
        listEl.querySelectorAll('li').forEach((n) => {
          n.onmousemove = () => { if (li !== +n.dataset.k) { li = +n.dataset.k; setFocus(); } };
          n.onclick = () => { if (li !== +n.dataset.k) { li = +n.dataset.k; setFocus(); G.SFX.play('ui'); } };
        });
        renderDetail();
      };
      const setFocus = () => {
        listEl.querySelectorAll('li').forEach((n, k) => n.classList.toggle('focus', k === li));
        const f = listEl.children[li]; f && f.scrollIntoView({ block: 'nearest' });
        renderDetail();
      };
      const renderDetail = () => {
        const cat = tabs[ti][0], e = entries()[li]; if (!e) return;
        const ok = unlocked(e, cat);
        det.classList.toggle('locked', !ok);
        const tag = det.querySelector('.cd-tag'), h = det.querySelector('h3'), en = det.querySelector('.cd-en'), body = det.querySelector('.cd-body');
        if (!ok) { tag.textContent = '尚未解鎖'; h.textContent = '？？？'; en.textContent = 'UNDISCOVERED'; body.innerHTML = '<p>繼續往下走，或許能找到更多線索。</p>'; det.classList.add('noimg'); return; }
        tag.textContent = e.tag || (cat === 'notes' ? '拾得文書' : cat === 'world' ? '世界' : '物品');
        h.textContent = e.name; en.textContent = e.en || ''; body.innerHTML = e.body.map((p) => `<p>${p}</p>`).join('');
        det.classList.toggle('noimg', !e.portrait);
        if (e.portrait) this.drawPortrait(e.portrait);
      };
      renderTabs(); renderList();
      $('#codexClose').onclick = () => { if (this.top() && this.top().id === 'codex') { G.SFX.play('uiBack'); this.pop(); } };
      this.push({ id: 'codex', el: $('#codex'), handle: () => {
        const In = I(), n = entries().length;
        if (In.tap('menuUp')) { li = (li - 1 + n) % n; setFocus(); G.SFX.play('ui'); }
        else if (In.tap('menuDown')) { li = (li + 1) % n; setFocus(); G.SFX.play('ui'); }
        else if (In.tap('tabL') || In.tap('menuLeft')) { ti = (ti - 1 + tabs.length) % tabs.length; li = 0; renderTabs(); renderList(); G.SFX.play('ui'); }
        else if (In.tap('tabR') || In.tap('menuRight')) { ti = (ti + 1) % tabs.length; li = 0; renderTabs(); renderList(); G.SFX.play('ui'); }
        else if (In.tap('back') || In.tap('confirm')) { G.SFX.play('uiBack'); this.pop(); }
      } });
    },
    portraits: {},
    drawPortrait(key) {
      const cv = $('#portrait'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height, g = G.game;
      const ally = ['rinne', 'ode', 'talia', 'barrow', 'vega'].includes(key);
      const paint = () => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const bg = ctx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.5, W * 0.75);
        bg.addColorStop(0, ally ? '#26303a' : '#2c1422'); bg.addColorStop(1, '#09080c');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(239,233,223,.05)'; ctx.lineWidth = 1;
        for (let i = 0; i < W; i += 26) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.9, W * 0.3, 12, 0, 0, Math.PI * 2); ctx.fill();
      };
      const prevDt = g.dtVis; g.dtVis = 1 / 60;
      const emblem = (txt, col) => {
        paint(); ctx.save(); ctx.translate(W / 2, H / 2);
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        for (let r = 40; r < 200; r += 34) { ctx.globalAlpha = 1 - r / 220; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.beginPath();
        for (let x = -150; x <= 150; x += 3) { const y = Math.sin(x * 0.08) * Math.cos(x * 0.013) * 40 * (1 - Math.abs(x) / 160); x === -150 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.fillStyle = col; ctx.font = '600 22px "Noto Serif TC"'; ctx.textAlign = 'center'; ctx.fillText(txt, 0, 120);
        ctx.restore();
      };
      try {
        if (key === 'rinne') {
          const h = { hair: new G.Rig.Chain(11, 7, 0.055, 0.9), rib1: new G.Rig.Chain(5, 5.2, 0.05, 0.9), rib2: new G.Rig.Chain(4, 5, 0.05, 0.9) };
          const pose = G.Rig.full(G.Rig.ANIM.idle(0.5));
          const J = G.Rig.compute(pose); const s = 3.3, ox = W / 2 - 10, oy = H * 0.93;
          const c = Math.cos(J.ha), sn = Math.sin(J.ha);
          const lx = J.head.x + (-9.6 * c + 5.6 * sn), ly = J.head.y + (-9.6 * sn - 5.6 * c);
          for (let k = 0; k < 90; k++) { h.hair.update(lx, ly, 1, 1 / 60, -260, 2.62); h.rib1.update(lx, ly, 1, 1 / 60, -340, 2.2); h.rib2.update(lx, ly + 1, 1, 1 / 60, -400, 2.6); }
          paint(); ctx.setTransform(s, 0, 0, s, ox, oy);
          G.Rig.drawRinne(ctx, 0, 0, 1, pose, h, {});
        } else if (key === 'ode') {
          paint(); ctx.setTransform(9, 0, 0, 9, W / 2, H / 2); G.Rig.drawOde(ctx, 0, 0, 1.2, 1, 0);
        } else if (key === 'barrow') {
          paint(); ctx.setTransform(3.6, 0, 0, 3.6, W / 2, H * 0.86); g.drawBarrow(ctx, 0, 0, 1);
        } else if (key === 'talia') emblem('妲莉 · 點燈人', '#9cf7b0');
        else if (key === 'vega') emblem('六公主', '#ffffff');
        else {
          // chapter portraits: a custom painter, or the enemy itself framed by its size (T.portrait = [scale, yFrac])
          if (this.portraits[key]) { paint(); this.portraits[key](ctx, W, H, g); ctx.setTransform(1, 0, 0, 1, 0, 0); g.dtVis = prevDt; return; }
          const T = G.ENEMY_TYPES[key];
          const conf = { murmur: [4, 0.72], sentinel: [2.1, 0.92], shrieker: [3.2, 0.72], graves: [1.75, 0.94], maestrina: [1.35, 0.86] }[key]
            || (T ? T.portrait || [Math.min(4.2, 330 / Math.max(T.h * (T.scale || 1), T.w * 1.4)), T.fly ? 0.66 : 0.9] : null);
          if (!conf) { paint(); return; }
          const e = new G.Enemy(key, 0, 0, {}); e.state = 'idle'; e.facing = 1; e.t = 1.3; e.onGround = true;
          for (let k = 0; k < 50; k++) { paint(); ctx.setTransform(conf[0], 0, 0, conf[0], W / 2, H * conf[1] + (e.fly && key === 'shrieker' ? -40 : 0)); e.t += 1 / 60; e.draw(ctx); }
        }
      } catch (err) { console.warn(err); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      g.dtVis = prevDt;
    },

    /* ---------------- pylon ---------------- */
    openPylon(py, onLeave) {
      const g = G.game, sv = g.save, el = $('#pylon');
      $('#pyName').textContent = py.name;
      const tabs = [['up', '調校'], ['gear', G.Gear && G.Gear.anyBetter(sv) ? '裝備・鍛造 ▲' : '裝備・鍛造'], ['abyss', '無底冥井'], ['travel', '旅行'], ['trade', '交易'], ['relic', '遺物'], ['codex', '檔案庫']];
      let ti = 0;
      const info = $('#pyInfo');
      const taliaLines = ['「燈油還夠。妳慢慢來，我不趕。」', '「外面的花，是什麼顏色的？……下次再告訴我就好。」', '「妳走過的燈，我都會一盞一盞點著。迷路的時候，就往亮的地方走。」', '「妳的刀有一點缺口。坐下來，我幫妳看看。」'];
      const shards = () => { $('#pyShards').textContent = Math.floor(sv.shards); };
      G.Mirror.st(sv);
      let menu;
      // 調校 (Talia's tuning): every ability is its own upgrade, paid in shards — the six originals first, then the rest
      const MR = G.Mirror;
      const pips = (n, r) => Array.from({ length: n }, (_, k) => `<i class="${k < r ? 'on' : ''}"></i>`).join('');
      const tracks = [];
      for (const slot of MR.SLOTS) if (slot.a.up) tracks.push([slot, 'a']);
      for (const slot of MR.SLOTS) for (const side of ['a', 'b']) if (!(side === 'a' && slot.a.up)) tracks.push([slot, side]);
      const attrRows = () => (sv.dnd ? G.DnD.ATTRS.map((a) => ({
        label: `${G.Icons.svg(a.id, 22, a.col)}<span>${a.name}</span>`, en: a.en, attr: a.id, cls: 'tu tu-attr',
        val: () => `<span class="tu-score">${G.DnD.score(a.id, sv)}</span>`,
        action: () => {
          if (!G.DnD.buy(a.id, sv)) { G.SFX.play('uiBack'); return; }
          g.player.recalc(); G.SFX.play('pylon'); shards(); menu.refresh(); showInfo(menu.items[menu.i]); g.persist();
        },
      })) : []);
      const buildUp = () => attrRows().concat(tracks.map(([slot, side]) => {
        const f = MR.face(slot, side);
        return {
          label: `${G.Icons.svg(f.id, 22)}<span>${f.name}</span>`, en: f.en, slot, side, cls: 'tu',
          extra: () => `<span class="lv">${pips(f.max, MR.rank(slot, side, sv))}</span>`,
          action: () => {
            if (!MR.buy(slot, side, sv)) { G.SFX.play('uiBack'); return; }
            g.player.recalc();
            if (f.id === 'tonic') sv.tonic = g.player.maxTonic;
            if (f.id === 'vit') g.player.hp = g.player.maxHp;
            G.SFX.play('pylon'); shards(); menu.refresh(); showInfo(menu.items[menu.i]); g.persist();
          },
        };
      }));
      const buildRelic = () => {
        const owned = Object.keys(D.relics).filter((k) => sv.flags['relic_' + k]);
        if (!owned.length) return [{ label: '尚無遺物', en: 'NONE', none: true, action: () => {} }];
        return owned.map((k) => ({
          label: D.relics[k].name, en: (sv.equipped.includes(k) ? '◆ EQUIPPED' : 'RELIC'), rk: k,
          action: () => {
            const eq = sv.equipped;
            if (eq.includes(k)) eq.splice(eq.indexOf(k), 1);
            else { if (eq.length >= 2) { this.toast('遺物欄位已滿（2）', 'warn'); G.SFX.play('uiBack'); return; } eq.push(k); }
            g.player.recalc(); sv.tonic = Math.min(sv.tonic, g.player.maxTonic);
            G.SFX.play('uiOk'); renderTab(); g.persist();
          },
        }));
      };
      const showInfo = (it) => {
        if (!it) return;
        if (it.locked) {
          info.innerHTML = `<h4>無底冥井</h4><p class="en">THE BOTTOMLESS WELL · 尚未開放</p><p>擊倒第一章的頭目之後，冥井就會開啟。</p>
            <p>冥井是七道門之外、更深的地方，一層又一層的挑戰：每層打完選一扇門、拿門上的獎勵；每 5 層有守門者。死亡不會遺落碎片。</p>`;
          return;
        }
        if (it.attr) {
          const a = G.DnD.ATTRS.find((q) => q.id === it.attr), s = G.DnD.score(a.id, sv), m = G.DnD.mod(a.id, sv), c = G.DnD.cost(a.id, sv), have = Math.floor(sv.shards);
          const nm = Math.floor((s + 1 - 10) / 2);
          const btn = c == null ? '<button type="button" class="py-buy" disabled>已達上限 20</button>'
            : have < c ? `<button type="button" class="py-buy" disabled>碎片不足：需要 ${c}・持有 ${have}</button>`
            : `<button type="button" class="py-buy" data-buy>${a.name}提升到 ${s + 1}<small>－${c} 碎片</small></button>`;
          info.innerHTML = `<div class="tu-head">${G.Icons.badge(a.id, a.col, 52)}<div><h4>${a.name}<em class="tu-sc">${s}</em></h4><p class="en">${a.en} · 修正值 ${m >= 0 ? '+' + m : m}</p></div></div>
            <p>${a.fx(m)}</p>${nm !== m && c != null ? `<p class="tu-next">提升到 ${s + 1} 後：${a.fx(nm)}</p>` : c != null ? '<p class="tu-next">修正值每 2 點提升一次；下一點會讓修正值進位。</p>' : ''}${btn}`;
          const bb = info.querySelector('[data-buy]'); if (bb) bb.onclick = () => { if (this.top() && this.top().id === 'pylon') menu.activate(); };
          return;
        }
        if (it.slot) {
          const f = MR.face(it.slot, it.side), r = MR.rank(it.slot, it.side, sv), c = MR.cost(it.slot, it.side, sv), have = Math.floor(sv.shards);
          const btn = c == null ? '<button type="button" class="py-buy" disabled>已達最高等級</button>'
            : have < c ? `<button type="button" class="py-buy" disabled>碎片不足：需要 ${c}・持有 ${have}</button>`
            : `<button type="button" class="py-buy" data-buy>調校到 Lv ${r + 1}<small>－${c} 碎片</small></button>`;
          info.innerHTML = `<div class="tu-head">${G.Icons.badge(f.id, 'var(--cyan)', 52)}<div><h4>${f.name}</h4><p class="en">${f.en} · Lv ${r} / ${f.max}</p></div></div><p>${f.desc(Math.max(1, r))}</p>${r > 0 && c != null ? `<p class="tu-next">下一級：${f.desc(r + 1)}</p>` : ''}${btn}
            <p class="talia">${taliaLines[(r + it.slot.id.length) % taliaLines.length]}</p>`;
          const bb = info.querySelector('[data-buy]'); if (bb) bb.onclick = () => { if (this.top() && this.top().id === 'pylon') menu.activate(); };
          return;
        } else if (it.rk) {
          const c = D.codex.items.find((x) => x.id === it.rk);
          const on = sv.equipped.includes(it.rk), full = !on && sv.equipped.length >= 2;
          info.innerHTML = `<h4>${D.relics[it.rk].name}</h4><p class="en">${on ? '裝備中 EQUIPPED' : '未裝備'} · 欄位 ${sv.equipped.length}/2</p><p>${c ? c.body[0] : ''}</p><p>${D.relics[it.rk].desc}</p>
            <button type="button" class="py-buy" ${full ? 'disabled' : ''}>${on ? '卸下' : full ? '遺物欄位已滿（2）' : '裝備'}</button>`;
        } else info.innerHTML = '<h4>遺物</h4><p>在冥界探索、挑戰強敵或幫助亡者，可以取得遺物。最多可同時裝備兩件。</p>';
        const buy = info.querySelector('.py-buy'); if (buy) buy.onclick = () => { if (!buy.disabled && this.top() && this.top().id === 'pylon') menu.activate(); };
      };
      const renderTab = () => {
        $('#pyTabs').innerHTML = tabs.map((t, k) => `<button class="tab ${k === ti ? 'on' : ''}" data-k="${k}">${t[1]}</button>`).join('');
        { const on = $('#pyTabs .tab.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
        $('#pyTabs').querySelectorAll('.tab').forEach((b) => b.onclick = () => { ti = +b.dataset.k; if (tabs[ti][0] === 'codex') { ti = 0; this.openCodex(); } else if (tabs[ti][0] === 'gear') { ti = 0; this.openGear({ forge: true, onClose: () => { shards(); renderTab(); } }); } else if (tabs[ti][0] === 'travel') { ti = 0; this.openTravel(); } else if (tabs[ti][0] === 'abyss') { if (sv.flags.boss_1 || sv.flags.boss_dead) { ti = 0; this.openAbyss(); } } else if (tabs[ti][0] === 'trade') { ti = 0; this.openTrade({}); } renderTab(); });
        const items = tabs[ti][0] === 'relic' ? buildRelic() : tabs[ti][0] === 'abyss' ? [{ label: '尚未開放', en: 'LOCKED', locked: true, action: () => {} }] : buildUp();
        menu = new Menu($('#pyMenu'), items, { delay: 0, clickSelects: true, start: menu && menu.items.length === items.length ? menu.i : 0, onFocus: showInfo });
        const gl = (a) => `<kbd>${G.Input.glyph(a)}</kbd>`;
        $('#pyFoot').innerHTML = tabs[ti][0] === 'up'
          ? (G.Input.device === 'touch' ? '點選能力，再按「調校」升級（花費殘響碎片）' : `${gl('menuUp')}${gl('menuDown')} 選擇　${gl('confirm')} 調校　${gl('tabR')} 裝備・鍛造　${gl('back')} 離開`)
          : `${gl('tabL')}${gl('tabR')} 切換　${gl('confirm')} 確認　${gl('back')} 離開魂燈台`;
        showInfo(menu.items[menu.i]);
      };
      shards(); renderTab();
      const leave = () => { this.pop(); onLeave && onLeave(); };
      // the close button always works: shut anything opened on top of the pylon (archive) and leave
      $('#pylonClose').onclick = () => { if (!this.stack.some((l) => l.id === 'pylon')) return; while (this.top() && this.top().id !== 'pylon') this.pop(); G.SFX.play('uiBack'); leave(); };
      this.push({ id: 'pylon', el, handle: () => {
        const In = I();
        if (In.tap('tabL')) { ti = ti === 0 ? tabs.findIndex((t) => t[0] === 'relic') : 0; renderTab(); G.SFX.play('ui'); }
        else if (In.tap('tabR')) { if (ti === 0) { this.openGear({ forge: true, onClose: () => { shards(); renderTab(); } }); } else { ti = 0; renderTab(); } G.SFX.play('ui'); }
        else if (In.tap('back')) { G.SFX.play('uiBack'); leave(); }
        else menu.handle();
      } });
    },

    /* ---------------- note / relic ---------------- */
    readNote(n, cb) {
      const el = $('#note');
      el.querySelector('.note-en').textContent = n.en; el.querySelector('h3').textContent = n.name;
      el.querySelector('.note-body').innerHTML = n.body.map((p) => `<p>${p}</p>`).join('');
      this.push({ id: 'note', el, handle: () => { const In = I(); if (In.tap('confirm') || In.tap('back') || In.tap('interact') || In.tap('light')) { G.SFX.play('uiBack'); this.pop(); cb && cb(); } } });
      el.onclick = () => { if (this.top() && this.top().id === 'note') { this.pop(); cb && cb(); } };
    },
    relicGet(id) {
      const el = $('#relic'), r = D.relics[id];
      el.querySelector('h3').textContent = r.name; el.querySelector('.relic-d').textContent = r.desc + (G.game.save.equipped.includes(id) ? '（已自動裝備，可於魂燈台更換）' : '（遺物欄位已滿，可於魂燈台更換裝備）');
      const g = G.game, prev = g.control; g.control = false;
      const close = () => { this.pop(); g.control = true; G.Input.clearBuffers(); };
      this.push({ id: 'relic', el, handle: () => { const In = I(); if (In.tap('confirm') || In.tap('back') || In.tap('interact') || In.tap('light')) close(); } });
      el.onclick = () => { if (this.top() && this.top().id === 'relic') close(); };
      void prev;
    },

    // Echo choice: selecting a card only highlights it (read the details first); a separate confirm commits.
    // keyboard/pad: ◀ ▶ select, confirm picks · mouse: click selects, the 選擇 button picks · touch: tap selects, tap 選擇
    boonPick(cards, done) {
      const el = $('#boonPick'), host = el.querySelector('.bp-cards'), ok = el.querySelector('.bp-confirm');
      host.innerHTML = '';
      let i = -1, lock = 0.8, picked = false;
      const btns = cards.map((c, k) => {
        const b = document.createElement('button');
        b.className = 'bp-card' + (c.kind === 'duo' ? ' duo' : c.r > 0 ? ' rr' + c.r : ''); b.style.setProperty('--c', c.def.col);
        const tag = c.tag || (c.lv > 1 ? 'Lv ' + c.lv : '新 NEW'), tcls = c.kind === 'duo' ? 'duo' : c.r > 0 ? 'r' + c.r : '';
        b.innerHTML = `<span class="bp-lv ${tcls}">${tag}</span><div class="bp-ico">${c.def.icon}</div><div class="bp-name">${c.def.name}</div><div class="bp-en">${c.def.en}</div><p class="bp-d">${c.desc || c.def.desc(c.lv)}</p>`;
        b.addEventListener('click', (e) => { e.stopPropagation(); if (!picked) focus(k); });
        host.appendChild(b); return b;
      });
      const focus = (k) => {
        if (k !== i) G.SFX.play('ui');
        i = k; btns.forEach((b, j) => b.classList.toggle('focus', j === k));
        const c = cards[k];
        ok.disabled = false; ok.style.setProperty('--c', c.def.col);
        ok.innerHTML = `選擇「${c.def.name}」<em>${c.kind === 'fruit' ? '果實' : c.kind === 'duo' ? '雙重' : c.lv > 1 ? 'Lv ' + c.lv : 'NEW'}</em>`;
      };
      const pick = () => {
        if (picked || i < 0 || lock > 0) return; picked = true;
        G.SFX.play('uiOk'); G.SFX.play('pylon');
        btns[i].classList.add('chosen'); ok.disabled = true;
        setTimeout(() => { this.pop(); done(cards[i].id); }, 420);
      };
      ok.disabled = true; ok.innerHTML = '先選一張卡片';
      ok.onclick = (e) => { e.stopPropagation(); pick(); };
      // keyboard / pad start on the first card; touch and mouse start with nothing chosen
      if (G.Input.device === 'kb' || G.Input.device === 'pad') focus(0);
      // the fight holds still while you read the cards
      const g = G.game, wasPlay = g.state === 'play'; if (wasPlay) g.state = 'paused';
      this.push({ id: 'boon', el, onClose: () => { if (wasPlay && g.state === 'paused') g.state = 'play'; G.Input.clearBuffers(); }, handle: (dt) => {
        lock -= dt; if (picked) return;
        const In = I();
        if (In.tap('menuLeft') || In.tap('left')) focus(i < 0 ? 0 : (i + cards.length - 1) % cards.length);
        else if (In.tap('menuRight') || In.tap('right')) focus(i < 0 ? 0 : (i + 1) % cards.length);
        else if (In.tap('confirm') && lock <= 0) { if (i < 0) focus(0); else pick(); }
      } });
    },

    /* ---------------- generic two/three-way choice ---------------- */
    choice(o) {
      const el = $('#choice');
      el.querySelector('.choice-k').textContent = o.kicker || '';
      el.querySelector('h3').textContent = o.title || '';
      el.querySelector('.choice-d').textContent = o.desc || '';
      const items = o.items.map((it) => ({ label: it.label, en: it.en, action: () => { this.pop(); G.Input.clearBuffers(); it.action(); } }));
      this.push({ id: 'choice', el, menu: new Menu($('#choiceMenu'), items, { delay: 0.1 }) });
    },

    /* ---------------- training panel ---------------- */
    tutPanel(on) {
      let el = $('#tut');
      if (!el) {
        el = document.createElement('div'); el.id = 'tut';
        el.innerHTML = '<div class="tut-head"><span class="tut-k">戰鬥訓練</span><span class="tut-n"></span><button type="button" class="tut-skip">跳過訓練</button></div><div class="tut-bar"><i></i></div><h4></h4><p class="tut-t"></p><p class="tut-c"></p>';
        $('#hud').appendChild(el);
        el.querySelector('.tut-skip').addEventListener('click', (e) => { e.stopPropagation(); G.Tut.skip(); });
        el.querySelector('.tut-skip').addEventListener('pointerdown', (e) => e.stopPropagation());
      }
      el.classList.toggle('show', !!on);
      document.documentElement.classList.toggle('tut-on', !!on);
    },
    tutStep(n, total, title, text, count) {
      const el = $('#tut'); if (!el) return;
      el.classList.remove('done');
      el.querySelector('.tut-n').textContent = `${n} / ${total}`;
      el.querySelector('.tut-bar i').style.width = ((n - 1) / total * 100) + '%';
      el.querySelector('h4').textContent = title;
      el.querySelector('.tut-t').innerHTML = glyphs(text);
      el.querySelector('.tut-c').textContent = count || '';
    },
    tutDone() { const el = $('#tut'); if (el) el.classList.add('done'); },

    /* ---------------- death / ending / credits ---------------- */
    deathScreen(cb) {
      const tips = ['白光攻擊可以格擋；紅光攻擊只能閃避。', '格擋損失的生命會變成灰色，立刻反擊就能取回。', '在攻擊命中前一瞬間閃避，會觸發殘響閃避，接著按攻擊可以瞬間反擊。', '敵人的失衡條滿了之後，靠近按攻擊就會自動處決。', '嘯者的聲波彈可以被完美格擋彈回去。', '遺落的殘響碎片會留在你倒下的地方。', '點亮魂燈台會補滿調和劑，但也會讓寂裔復甦。', '屋頂上似乎藏著什麼……'];
      $('#deathTip').textContent = '◆ ' + tips[Math.floor(Math.random() * tips.length)];
      this.showHud(false);
      let t = 0;
      const el = $('#death');
      let clicked = false;
      el.onclick = () => { clicked = true; };
      this.push({ id: 'death', el, handle: (dt) => {
        t += dt;
        if (t > 1.8 && (clicked || I().tap('confirm') || I().tap('light') || I().tap('jump'))) { el.onclick = null; G.SFX.play('uiOk'); this.pop(); G.game.fadeA = 1; cb(); }
        clicked = false;
      } });
    },
    // rank from a run's stats (time budget scales with how many chapters were played)
    rankOf(st, chapters = 1) {
      const score = 100 - st.deaths * 6 / chapters + Math.min(30, st.parries * 0.6 / chapters) + Math.min(10, st.exec * 2 / chapters) - Math.max(0, (st.time / chapters - 1200) / 60);
      return score >= 100 ? 'S' : score >= 85 ? 'A' : score >= 65 ? 'B' : 'C';
    },
    // chapter complete card (reuses the ending screen), then on to the next chapter
    chapterEnd(ch, st, cb) {
      this.showHud(false); this.bossBar(null);
      const el = $('#ending');
      el.querySelector('.end-k').textContent = `CHAPTER ${ch.num} COMPLETE`;
      el.querySelector('h2').textContent = `第${ch.numZh || ch.num}章　${ch.title}`;
      $('#endRank').textContent = this.rankOf(st, ch.id);
      $('#endStats').innerHTML = `<div>累計時間<b>${U.fmtTime(st.time)}</b></div><div>完美格擋<b>${st.parries}</b></div><div>處決<b>${st.exec}</b></div><div>擊破寂裔<b>${st.kills}</b></div><div>最高連擊<b>${st.maxCombo || 0}</b></div><div>倒下次數<b>${st.deaths}</b></div>`;
      el.querySelector('.end-tbc').textContent = ch.outro || '';
      el.querySelector('.pane-foot').innerHTML = G.Input.device === 'touch' ? '點擊畫面　前往下一章' : `<kbd data-g="confirm">${G.Input.glyph('confirm')}</kbd> 前往下一章`;
      let t = 0;
      setTimeout(() => {
        let clicked = false;
        el.onclick = () => { clicked = true; };
        this.push({ id: 'chapterEnd', el, handle: (dt) => {
          t += dt;
          // fade to black first; the next chapter is built behind the curtain, so its set-up never shows as a freeze
          if (t > 2 && (clicked || I().tap('confirm') || I().tap('back'))) { el.onclick = null; this.pop(); this.curtain(true); G.SFX.play('uiOk'); setTimeout(() => { cb && cb(); }, 420); }
          clicked = false;
        } });
      }, 1200);
    },
    // final ending: variant = { kicker, title, lines[], tbc } supplied by the last chapter
    ending(st, variant) {
      this.showHud(false); this.bossBar(null);
      const el = $('#ending'), v = variant || {};
      const ch = G.Chapters.cur || { id: 1, num: 'I', title: '墜落的音符' };
      el.querySelector('.end-k').textContent = v.kicker || `CHAPTER ${ch.num} COMPLETE`;
      el.querySelector('h2').textContent = v.title || `第${ch.numZh || ch.num}章　${ch.title}`;
      el.querySelector('.end-tbc').innerHTML = v.lines ? v.lines.map((l) => `<span class="end-line">${l}</span>`).join('') : (v.tbc || 'TO BE CONTINUED — 「方舟，沉默了。」');
      el.querySelector('.pane-foot').innerHTML = G.Input.device === 'touch' ? '點擊畫面　製作名單' : `<kbd data-g="confirm">${G.Input.glyph('confirm')}</kbd> 製作名單`;
      const rank = this.rankOf(st, Math.max(1, (G.game.save && G.game.save.chapter) || 1));
      $('#endRank').textContent = rank;
      $('#endStats').innerHTML = `<div>通關時間<b>${U.fmtTime(st.time)}</b></div><div>完美格擋<b>${st.parries}</b></div><div>殘響閃避<b>${st.dodges}</b></div><div>處決<b>${st.exec}</b></div><div>擊破寂裔<b>${st.kills}</b></div><div>倒下次數<b>${st.deaths}</b></div><div>命中<b>${st.hits}</b></div><div>難度<b style="font-family:var(--serif);font-size:20px">${G.game.diff.name}</b></div>`;
      let t = 0;
      setTimeout(() => {
        let clicked = false;
        $('#ending').onclick = () => { clicked = true; };
        this.push({ id: 'ending', el: $('#ending'), handle: (dt) => {
          t += dt;
          if (t > 2 && (clicked || I().tap('confirm') || I().tap('back'))) { $('#ending').onclick = null; this.pop(); this.openCredits(false); }
          clicked = false;
        } });
      }, 1200);
    },
    openCredits(fromTitle) {
      const roll = $('#creditsRoll');
      const sec = (h, ...ps) => `<h3>${h}</h3>${ps.map((p) => `<p>${p}</p>`).join('')}`;
      const chDone = G.Chapters.list.filter((c) => G.game.save && G.game.save.flags['ch_done_' + c.id]).map((c) => `第${c.numZh || c.num}章「${c.title}」`);
      roll.innerHTML = `<p class="big">ECHOFALL</p><p>殘響之刃${this.creditsExtra ? '' : (chDone.length > 1 ? '　' + chDone.join('・') : '　第一章「送葬之城」')}</p>`
        + sec('GAME DIRECTION · 遊戲總監', 'Claude（Anthropic）')
        + sec('DESIGN · 系統與關卡設計', 'Claude', '以 The Game Awards 年度遊戲與各平台頂尖作品為標竿')
        + sec('ART DIRECTION · 美術', '程序化角色骨架 · 視差廢墟 · 體積光', '美術方向參考：Stellar Blade（劍星）')
        + sec('COMBAT · 戰鬥設計', '完美格擋 / 可回復生命 / 失衡處決', '致敬：Lies of P、Sekiro、Elden Ring')
        + sec('WORLD & NARRATIVE · 世界觀與劇本', '溫陀 · 冥界庫爾 · 七道門', '改編自韓國巫歌〈巴里公主〉與蘇美詩歌〈伊南娜下冥界〉')
        + sec('MUSIC & SOUND · 音樂與音效', '即時生成配樂 · WebAudio 程序化音效', '每一次完美格擋，都在彈奏她的主題')
        + sec('CAST · 角色', '巴里 — 第七位公主', '寧舒 — 魂燈侍靈', '妲莉 — 點燈人', '無長丞 — 冥界的守門巨人', '瑪格 — 送葬司儀', '葛雷夫 — 掘墓人', '老鐸 — 敲鐘人', '六公主 — 走過這條路的姊姊', '厄蕾絲 — 冥后')
        + (this.creditsExtra || []).map((x) => sec(x.h, ...x.p)).join('')
        + sec('SPECIAL THANKS', '以及，願意聆聽的你。')
        + `<p class="end">「走到底。替我，把那扇門打開。」<br><br>— 本作為原創改編作品 —</p>`;
      roll.classList.remove('go'); void roll.offsetWidth; roll.classList.add('go');
      G.Music.play('ending');
      let t = 0;
      const done = () => { $('#credits').onclick = null; this.pop(); if (!fromTitle) this.toTitle(); else G.Music.play('title'); };
      let clicked = false;
      $('#credits').onclick = () => { clicked = true; };
      this.push({ id: 'credits', el: $('#credits'), handle: (dt) => { t += dt; if (t > 47 || (t > 1 && (clicked || I().tap('back') || I().tap('confirm')))) done(); clicked = false; } });
    },
  };
})(window.G);

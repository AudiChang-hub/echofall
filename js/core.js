'use strict';
/* ECHOFALL — core: math utils, seeded RNG, input (keyboard / mouse / gamepad), storage */
window.G = window.G || {};
(function (G) {
  const TAU = Math.PI * 2;

  const U = G.U = {
    TAU,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    invLerp: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
    rand: (a, b) => a + Math.random() * (b - a),
    randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    choice: (arr) => arr[Math.floor(Math.random() * arr.length)],
    sign: (v) => (v < 0 ? -1 : 1),
    approach(v, target, d) { return v < target ? Math.min(v + d, target) : Math.max(v - d, target); },
    damp(a, b, lambda, dt) { return b + (a - b) * Math.exp(-lambda * dt); },
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeInCubic: (t) => t * t * t,
    easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeOutExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    rectsOverlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
    mulberry32(seed) {
      let a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    hex2rgb(hex) {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    rgba(hex, a) { const c = U.hex2rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; },
    mix(h1, h2, t, a = 1) {
      const c1 = U.hex2rgb(h1), c2 = U.hex2rgb(h2);
      const r = Math.round(c1[0] + (c2[0] - c1[0]) * t), g = Math.round(c1[1] + (c2[1] - c1[1]) * t), b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
      return `rgba(${r},${g},${b},${a})`;
    },
    mixHex(h1, h2, t) {
      const c1 = U.hex2rgb(h1), c2 = U.hex2rgb(h2);
      const f = (i) => Math.round(c1[i] + (c2[i] - c1[i]) * t).toString(16).padStart(2, '0');
      return '#' + f(0) + f(1) + f(2);
    },
    // smooth 1D value noise
    noise1(x, seed = 0) {
      const i = Math.floor(x), f = x - i;
      const h = (n) => { const s = Math.sin((n + seed * 17.13) * 127.1) * 43758.5453; return s - Math.floor(s); };
      const u = f * f * (3 - 2 * f);
      return h(i) * (1 - u) + h(i + 1) * u;
    },
    fmtTime(sec) {
      sec = Math.floor(sec); const m = Math.floor(sec / 60), s = sec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },
  };

  /* ---------------- Quality profile ----------------
     'low' keeps phones/tablets (e.g. 3 GB devices) inside the browser's memory budget:
     smaller backbuffer, fewer/lower-res cached background tiles, no baked blur, cheaper post. */
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  G.Quality = {
    pref: 'auto',
    autoLow: coarse || (navigator.deviceMemory != null && navigator.deviceMemory <= 4),
    get low() { return this.pref === 'low' || (this.pref === 'auto' && this.autoLow); },
    get label() { return { auto: this.autoLow ? '自動（省電）' : '自動（高）', high: '高', low: '低（省記憶體）' }[this.pref]; },
  };

  /* ---------------- Storage (safe) ---------------- */
  G.Relics = {}; // chapter relic effects: { id: { apply(player) } }
  G.Store = {
    get(key, def) {
      try { const v = localStorage.getItem('echofall:' + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set(key, val) { try { localStorage.setItem('echofall:' + key, JSON.stringify(val)); } catch (e) { /* ignore */ } },
    del(key) { try { localStorage.removeItem('echofall:' + key); } catch (e) { /* ignore */ } },
  };

  /* ---------------- Save codes: portable text copy of a save (device transfer / backup) ----------------
     Format: EF1-<base64url(utf8 json)>-<checksum base36>. Line breaks and spaces are ignored on import. */
  const b64u = {
    enc(str) { const bytes = new TextEncoder().encode(str); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0)); return new TextDecoder().decode(bytes); },
  };
  const checksum = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36).toUpperCase().slice(0, 5); };
  G.SaveCode = {
    encode(save) {
      const body = b64u.enc(JSON.stringify(save));
      return `EF1-${body}-${checksum(body)}`;
    },
    // returns { ok, save } or { ok: false, error }
    decode(code) {
      const c = String(code || '').replace(/\s+/g, '');
      const m = c.match(/^EF1-([A-Za-z0-9_-]+)-([0-9A-Z]{1,5})$/);
      if (!m) return { ok: false, error: '格式不正確：存檔碼應該以 EF1- 開頭，請確認有完整複製。' };
      if (checksum(m[1]) !== m[2]) return { ok: false, error: '存檔碼不完整或被修改過，請重新複製一次。' };
      try {
        const save = JSON.parse(b64u.dec(m[1]));
        if (!save || save.v !== 1 || !save.stats || !save.flags) return { ok: false, error: '這不是 ECHOFALL 的存檔碼。' };
        return { ok: true, save };
      } catch (e) { return { ok: false, error: '無法讀取這個存檔碼，請重新複製一次。' }; }
    },
  };

  /* ---------------- Input ---------------- */
  // Simplified scheme: attack (tap = combo, hold = heavy, auto-execute), guard, dodge, one skill key.
  const KEYMAP = {
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
    jump: ['Space', 'KeyW', 'ArrowUp'], light: ['KeyJ'], dodge: ['KeyL', 'ShiftLeft', 'ShiftRight'],
    guard: ['KeyK'], skill: ['KeyU', 'KeyQ'], heal: ['KeyF', 'KeyR'], interact: ['KeyE'],
    pause: ['Escape', 'KeyP'], confirm: ['Enter', 'Space'], back: ['Escape', 'Backspace'],
    menuUp: ['KeyW', 'ArrowUp'], menuDown: ['KeyS', 'ArrowDown'], menuLeft: ['KeyA', 'ArrowLeft'], menuRight: ['KeyD', 'ArrowRight'],
    tabL: ['KeyQ'], tabR: ['KeyE'],
  };
  // standard gamepad mapping
  const PADMAP = {
    jump: [0], dodge: [1], light: [2], skill: [3, 5], guard: [4, 6], heal: [7, 12], pause: [9],
    interact: [13], confirm: [0], back: [1], menuUp: [12], menuDown: [13], menuLeft: [14], menuRight: [15],
    left: [14], right: [15], up: [12], down: [13], tabL: [4], tabR: [5],
  };
  const GLYPH_KB = {
    move: 'A / D', left: 'A', right: 'D', jump: 'Space', light: 'J', dodge: 'L', guard: 'K', skill: 'U',
    heal: 'F', interact: 'E', pause: 'Esc', confirm: 'Enter', back: 'Esc', tabL: 'Q', tabR: 'E',
  };
  const GLYPH_PAD = {
    move: '左搖桿', left: '◀', right: '▶', jump: 'Ⓐ', light: 'Ⓧ', dodge: 'Ⓑ', guard: 'LB', skill: 'Ⓨ',
    heal: 'RT', interact: '▼', pause: '☰', confirm: 'Ⓐ', back: 'Ⓑ', tabL: 'LB', tabR: 'RB',
  };
  // touch: the labels printed on the on-screen buttons
  const GLYPH_TOUCH = {
    move: '左側搖桿', left: '◀', right: '▶', jump: '跳', light: '攻', dodge: '閃', guard: '擋', skill: '技',
    heal: '回復', interact: '互動', pause: '☰', confirm: '點擊', back: '✕', tabL: '◀', tabR: '▶',
  };

  const Input = G.Input = {
    held: {}, tapped: {}, pressT: {}, consumed: {},
    _pending: {}, _keys: {}, _mouse: {}, _padPrev: {}, _padHeld: {},
    device: 'kb', axisX: 0, enabled: true,
    touchX: 0, touchDown: false, // virtual joystick (touch.js)
    init(target) {
      const typing = (e) => { const t = e.target; return t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable); };
      window.addEventListener('keydown', (e) => {
        if (typing(e)) { if (e.code === 'Escape') this._press('back'); return; }
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
        this.device = 'kb';
        if (e.repeat) return;
        this._keys[e.code] = true;
        for (const a in KEYMAP) if (KEYMAP[a].includes(e.code)) this._press(a);
      });
      window.addEventListener('keyup', (e) => { this._keys[e.code] = false; });
      window.addEventListener('blur', () => { this._keys = {}; this._mouse = {}; });
      // real mouse only — a finger tapping the screen must not count as an attack click
      target.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return;
        this.device = 'kb';
        if (e.button === 0) { this._mouse.l = true; this._press('light'); }
        if (e.button === 2) { this._mouse.r = true; this._press('guard'); }
      });
      window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') return; if (e.button === 0) this._mouse.l = false; if (e.button === 2) this._mouse.r = false; });
      target.addEventListener('contextmenu', (e) => e.preventDefault());
    },
    _press(a) {
      this._pending[a] = true;
      this.pressT[a] = performance.now();
      this.consumed[a] = false;
    },
    update() {
      // gamepad
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let pad = null;
      for (const p of pads) if (p && p.connected) { pad = p; break; }
      const padHeld = {};
      this.axisX = 0;
      if (pad) {
        const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
        if (Math.abs(ax) > 0.35) this.axisX = ax;
        for (const a in PADMAP) {
          for (const b of PADMAP[a]) {
            const btn = pad.buttons[b];
            if (btn && (btn.pressed || btn.value > 0.5)) padHeld[a] = true;
          }
        }
        if (ax < -0.5) { padHeld.left = true; padHeld.menuLeft = true; }
        if (ax > 0.5) { padHeld.right = true; padHeld.menuRight = true; }
        if (ay < -0.6) { padHeld.menuUp = true; }
        if (ay > 0.6) { padHeld.menuDown = true; }
        for (const a in padHeld) {
          if (!this._padPrev[a]) { this._press(a); this.device = 'pad'; }
        }
      }
      this._padPrev = padHeld;
      // compose held
      const held = {};
      for (const a in KEYMAP) {
        held[a] = KEYMAP[a].some((k) => this._keys[k]) || !!padHeld[a];
      }
      if (this._mouse.l) held.light = true;
      if (this._mouse.r) held.guard = true;
      if (this.touchDown) held.down = true;
      this.held = held;
      this.tapped = this._pending;
      this._pending = {};
    },
    down(a) { return this.enabled && !!this.held[a]; },
    tap(a) { return !!this.tapped[a]; },
    // buffered press (ms)
    pressed(a, buffer = 0) {
      if (!this.enabled || this.consumed[a] || !this.pressT[a]) return false;
      return this.tapped[a] || performance.now() - this.pressT[a] <= buffer;
    },
    consume(a) { this.consumed[a] = true; },
    clearBuffers() { for (const a in this.pressT) this.consumed[a] = true; },
    sinceP(a) { return this.pressT[a] ? performance.now() - this.pressT[a] : 1e9; },
    moveX() {
      if (!this.enabled) return 0;
      let x = 0;
      if (KEYMAP.left.some((k) => this._keys[k])) x -= 1;
      if (KEYMAP.right.some((k) => this._keys[k])) x += 1;
      if (x === 0 && this.axisX) x = this.axisX;
      if (x === 0 && this.touchX) x = this.touchX;
      if (x === 0 && this.held.left) x = -1;
      if (x === 0 && this.held.right) x = 1;
      return x;
    },
    glyph(a) { return (this.device === 'pad' ? GLYPH_PAD : this.device === 'touch' ? GLYPH_TOUCH : GLYPH_KB)[a] || a; },
    // haptics: gamepad rumble or a phone buzz (Android; iOS ignores vibrate) — scaled by the screen-shake setting
    rumble(k = 0.5) {
      const s = G.game && G.game.settings ? G.game.settings.shake : 1;
      if (!s || this._rumbleT > performance.now()) return;
      this._rumbleT = performance.now() + 45;
      try {
        if (this.device === 'pad') {
          const pads = navigator.getGamepads ? navigator.getGamepads() : [];
          for (const p of pads) if (p && p.vibrationActuator) { p.vibrationActuator.playEffect('dual-rumble', { duration: 40 + 60 * k, strongMagnitude: 0.3 * k * s, weakMagnitude: 0.7 * k * s }); break; }
        } else if (this.device === 'touch' && navigator.vibrate) navigator.vibrate(Math.round(10 + 22 * k));
      } catch (e) { /* unsupported */ }
    },
  };
})(window.G);

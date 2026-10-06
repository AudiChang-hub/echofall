'use strict';
/* ECHOFALL — mobile controls, modern side-scroller layout:
   left  : floating virtual joystick (appears under the thumb)
   right : 跳 jump (big) and 閃 dodge — attacks are automatic (Bari swings at whatever is in reach)
           + 技 skill bubble that only appears when the resonance gauge can pay for it
   top   : 回復 heal (with count), ⛶ fullscreen, ☰ pause
   interaction is contextual: tap the on-screen prompt ("互動 點亮魂燈台"). */
(function (G) {
  const ACTS = [['Space', '跳', 'a1'], ['KeyL', '閃', 'a2'], ['KeyU', '技', 'a5 sk']];
  const TOP = [['KeyF', '回復', 'heal'], ['KeyM', '地圖', 'map'], ['FS', '⛶', 'fs'], ['Escape', '☰', 'pause']];
  const send = (type, code) => {
    window.dispatchEvent(new KeyboardEvent(type, { code }));
    G.Input.device = 'touch'; // the keydown handler marks 'kb'; these presses come from a finger
  };

  // every hold button registers here so a missed pointerup can never leave one stuck down
  const HELD = [];
  const releaseAll = () => { for (const h of HELD) h.reset(); G.Input.touchX = 0; G.Input.touchDown = false; };
  function holdButton(b, code) {
    const ids = new Set();
    const on = (e) => { e.preventDefault(); e.stopPropagation(); ids.add(e.pointerId); b.setPointerCapture && b.setPointerCapture(e.pointerId); if (ids.size === 1) { send('keydown', code); b.classList.add('on'); } };
    const off = (e) => { if (!ids.delete(e.pointerId)) return; if (!ids.size) { send('keyup', code); b.classList.remove('on'); } };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    HELD.push({ off, reset: () => { if (ids.size) { ids.clear(); send('keyup', code); b.classList.remove('on'); } } });
  }
  // safety nets (iOS sometimes drops pointerup when a finger slides off a button or the view changes under it):
  // a pointer released anywhere frees the buttons it held; no finger on the glass, or the app hidden, frees everything
  document.addEventListener('pointerup', (e) => { for (const h of HELD) h.off(e); }, true);
  document.addEventListener('pointercancel', (e) => { for (const h of HELD) h.off(e); }, true);
  const noFingers = (e) => { if (!e.touches || e.touches.length === 0) releaseAll(); };
  document.addEventListener('touchend', noFingers, true);
  document.addEventListener('touchcancel', noFingers, true);
  window.addEventListener('blur', releaseAll);
  window.addEventListener('pagehide', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  function buildStick(root) {
    const zone = document.createElement('div');
    zone.className = 't-zone';
    zone.innerHTML = '<div class="t-base"><div class="t-knob"></div></div>';
    root.appendChild(zone);
    const base = zone.querySelector('.t-base'), knob = zone.querySelector('.t-knob');
    const R = 46;
    let id = null, ox = 0, oy = 0;
    const home = () => { base.classList.remove('live'); base.style.left = ''; base.style.top = ''; knob.style.transform = 'translate(-50%,-50%)'; };
    const move = (e) => {
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const ax = dx / R;
      G.Input.touchX = Math.abs(ax) < 0.22 ? 0 : Math.sign(ax) * Math.min(1, (Math.abs(ax) - 0.12) / 0.7);
      G.Input.touchDown = dy / R > 0.62 && Math.abs(ax) < 0.6;
      G.Input.device = 'touch';
    };
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      e.preventDefault(); id = e.pointerId; zone.setPointerCapture && zone.setPointerCapture(id);
      const r = zone.getBoundingClientRect();
      ox = e.clientX; oy = e.clientY;
      base.classList.add('live'); base.style.left = (ox - r.left) + 'px'; base.style.top = (oy - r.top) + 'px';
      move(e);
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; G.Input.touchX = 0; G.Input.touchDown = false; home(); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); zone.addEventListener('lostpointercapture', end);
    HELD.push({ off: end, reset: () => { if (id !== null) { id = null; G.Input.touchX = 0; G.Input.touchDown = false; home(); } } });
    home();
  }

  function build() {
    const root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = '<div class="t-acts"></div><div class="t-top"></div>';
    buildStick(root);
    const acts = root.querySelector('.t-acts'), top = root.querySelector('.t-top');
    for (const [code, label, cls] of ACTS) {
      const b = document.createElement('button'); b.className = 'tb ' + cls; b.setAttribute('aria-label', label); b.innerHTML = `<span>${label}</span>`;
      holdButton(b, code); acts.appendChild(b);
    }
    for (const [code, label, cls] of TOP) {
      const b = document.createElement('button'); b.className = 'tb sm ' + cls; b.setAttribute('aria-label', label); b.innerHTML = `<span>${label}</span>`;
      if (code === 'FS') b.addEventListener('click', (e) => { e.preventDefault(); G.Fullscreen.toggle(); });
      else holdButton(b, code);
      top.appendChild(b);
    }
    const rot = document.createElement('div');
    rot.className = 't-rotate'; rot.innerHTML = '<p>請將裝置橫向旋轉</p><em>ROTATE TO LANDSCAPE</em>';
    document.getElementById('app').appendChild(rot);
    document.getElementById('app').appendChild(root);
    if (G.Fullscreen && G.Fullscreen.standalone) root.querySelector('.fs').style.display = 'none';
    root.querySelector('.heal').insertAdjacentHTML('beforeend', '<i class="badge"></i>');
    root.querySelector('.sk').insertAdjacentHTML('beforeend', '<i class="badge"></i>');
    root._heal = root.querySelector('.heal .badge'); root._sk = root.querySelector('.sk'); root._skb = root.querySelector('.sk .badge');
    // contextual interaction: tapping the prompt presses 互動
    const prompt = document.getElementById('prompt');
    prompt.addEventListener('pointerdown', (e) => { if (!document.documentElement.classList.contains('touch')) return; e.preventDefault(); send('keydown', 'KeyE'); setTimeout(() => send('keyup', 'KeyE'), 80); });
    return root;
  }

  let root = null;
  const enable = () => {
    if (root) return;
    root = build();
    document.documentElement.classList.add('touch');
    G.Input.device = 'touch';
    const boot = document.getElementById('boot');
    if (boot && boot.classList.contains('show')) {
      boot.querySelector('.boot-press span').textContent = '點擊畫面開始';
      boot.querySelector('.boot-press em').textContent = 'TAP TO START';
      boot.querySelector('.boot-note').textContent = '建議戴耳機・橫向持握・點擊後自動全螢幕';
    }
  };
  G.Touch = { enable, get on() { return !!root; } };
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) window.addEventListener('load', enable);
  window.addEventListener('touchstart', () => { enable(); G.Input.device = 'touch'; }, { passive: true });

  // the pad shows only while the player is in control (hidden for dialogue, menus and cutscenes)
  setInterval(() => {
    if (!root || !G.game) return;
    const g = G.game;
    const playing = g.state === 'play' && g.control && G.UI && G.UI.stack.length === 0;
    root.classList.toggle('show', playing);
    document.documentElement.classList.toggle('touch-play', playing);
    if (!playing) { G.Input.touchX = 0; G.Input.touchDown = false; }
    if (g.save) { root._heal.textContent = g.save.tonic; root.querySelector('.heal').classList.toggle('empty', g.save.tonic <= 0); }
    if (g.player) {
      const r = g.player.res;
      const sk = G.DnD.skills();
      root._sk.classList.toggle('ready', r >= sk.c1);
      root._skb.textContent = r >= sk.c2 ? sk.n2 : r >= sk.c1 ? sk.n1 : '';
    }
  }, 120);

  /* ---- no accidental page zoom on phones ----
     Fast repeated taps used to trigger the browser's double-tap zoom (iOS ignores user-scalable=no), leaving the
     game magnified with no way back. CSS touch-action blocks double-tap zoom; these block pinch, and if the page
     still ends up zoomed (older iOS), the viewport is re-pinned to scale 1. */
  const stop = (e) => e.preventDefault();
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('gesturechange', stop, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  // Samsung Internet paints a blue "select all" flash on quick taps: never start a text selection outside inputs
  document.addEventListener('selectstart', (e) => { const t = e.target; if (!(t && t.closest && t.closest('input, textarea'))) e.preventDefault(); });
  document.addEventListener('contextmenu', (e) => { const t = e.target; if (!(t && t.closest && t.closest('input, textarea'))) e.preventDefault(); });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  // second quick tap on anything that is not a real control (HUD, prompt bar, empty screen edge) is swallowed so the
  // browser never sees a double-tap; game buttons use pointer events and menu buttons are excluded, so both still work
  let lastTap = 0;
  document.addEventListener('touchend', (e) => {
    const now = e.timeStamp, quick = now - lastTap < 380; lastTap = now;
    if (!quick || e.touches.length) return;
    const t = e.target;
    if (t && t.closest && t.closest('button, a, input, select, textarea, label, .mi, .tab, .bp-card, .py-buy, .prompt, [contenteditable]')) return;
    // swallow the browser's double-tap, but still deliver the tap as a click (dialogue, notes, death screen…)
    e.preventDefault();
    if (t && t.dispatchEvent) t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }, { passive: false });
  const vv = window.visualViewport;
  if (vv) {
    let fixing = false;
    const unzoom = () => {
      if (fixing || vv.scale <= 1.01) return;
      let m = document.querySelector('meta[name="viewport"]');
      if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.appendChild(m); }
      const orig = m.getAttribute('content') || 'width=device-width,initial-scale=1,viewport-fit=cover';
      fixing = true;
      m.setAttribute('content', 'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');
      setTimeout(() => { m.setAttribute('content', orig.includes('maximum-scale') ? orig : orig + ',maximum-scale=1,user-scalable=no'); fixing = false; }, 400);
    };
    vv.addEventListener('resize', () => setTimeout(unzoom, 250));
  }
})(window.G);

'use strict';
/* ECHOFALL — fullscreen + landscape helper (phones/tablets need a user gesture; iPhone Safari has no element fullscreen) */
(function (G) {
  const doc = document, root = doc.documentElement;
  // the permanent home of the game: a fixed address that always serves the newest build (js/update.js keeps it fresh)
  const HOME = 'https://audichang-hub.github.io/echofall/';
  const onHome = location.href.startsWith(HOME);
  // auto-show policy: away from the permanent address (itch frame, claude.ai) once per visit until 不再提醒;
  // on the permanent address in Safari once ever; never inside the home-screen app
  const shouldAutoGuide = () => {
    if (G.Store.get('iosGuideOff', false)) return false;
    if (onHome && !FS.framed) return !G.Store.get('iosFsSeen2', false);
    try { return !sessionStorage.getItem('iosGuideShown'); } catch (e) { return true; }
  };
  const FS = G.Fullscreen = {
    get supported() { return !!(root.requestFullscreen || root.webkitRequestFullscreen); },
    get active() { return !!(doc.fullscreenElement || doc.webkitFullscreenElement); },
    get isTouch() { return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window; },
    get isIOS() { return /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); },
    // launched from the home screen: already chrome-free, nothing to offer
    get standalone() { return navigator.standalone === true || (window.matchMedia && (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches)); },
    get framed() { try { return window.top !== window.self; } catch (e) { return true; } },
    async enter() {
      try {
        if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
        else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
      } catch (e) { /* refused (iframe without permission, iPhone, etc.) */ }
      try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) { /* not allowed outside fullscreen / unsupported */ }
      setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
      return FS.active;
    },
    async exit() {
      try { if (doc.exitFullscreen) await doc.exitFullscreen(); else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen(); } catch (e) { /* ignore */ }
    },
    async toggle() {
      if (FS.active) { await FS.exit(); return; }
      // iPhone has no element fullscreen at all (an Apple restriction, itch's own button fails too): explain the home-screen route
      if (!FS.supported) { FS.guide(); return; }
      const ok = await FS.enter();
      if (!ok && G.UI) G.UI.toast('這個頁面不允許全螢幕，請用 itch.io 右下角的全螢幕按鈕', 'warn');
    },
    guide() {
      const el = doc.getElementById('iosFs');
      if (!el) return;
      // anywhere but the permanent address (itch frame, claude.ai, an old pinned copy) the first step opens it
      el.querySelector('.open').hidden = onHome && !FS.framed;
      el.querySelector('li.f').hidden = onHome && !FS.framed;
      el.querySelectorAll('li:not([hidden]) span').forEach((s, i) => { s.textContent = i + 1; });
      el.classList.add('show');
      G.Store.set('iosFsSeen2', true);
      try { sessionStorage.setItem('iosGuideShown', '1'); } catch (e) { /* ignore */ }
      el.querySelector('.never').hidden = onHome && !FS.framed;
    },
  };

  // iPhone: "Add to Home Screen" is the only true fullscreen — a step-by-step card instead of a dead button
  function buildGuide() {
    const el = doc.createElement('div');
    el.id = 'iosFs';
    el.innerHTML = `<div class="card" role="dialog" aria-label="iPhone 全螢幕">
      <h3>iPhone 全螢幕遊玩</h3><em>FULLSCREEN ON IPHONE</em>
      <p>Apple 不允許網頁在 iPhone 上進入全螢幕（itch.io 右下角的按鈕也會無效）。<br>把遊戲<b>加入主畫面</b>，就能像 App 一樣全螢幕：</p>
      <ol>
        <li class="f"><span>1</span>點下方「開啟遊戲頁」，用 Safari 開啟遊戲的固定網址</li>
        <li><span>2</span>點瀏覽器的 <b>分享</b> 按鈕 → <b>加入主畫面</b></li>
        <li><span>3</span>從主畫面的 ECHOFALL 圖示開啟，就是全螢幕，之後也會自動更新到最新版</li>
      </ol>
      <small>主畫面版的進度和瀏覽器分開，可用「存檔碼」搬過去。</small>
      <div class="row"><a class="open" target="_blank" rel="noopener">開啟遊戲頁</a><button type="button" class="close">知道了</button><button type="button" class="never">不再提醒</button></div>
    </div>`;
    doc.getElementById('app').appendChild(el);
    el.querySelector('.open').href = HOME;
    const hide = () => el.classList.remove('show');
    el.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); hide(); });
    el.querySelector('.never').addEventListener('click', (e) => { e.stopPropagation(); G.Store.set('iosGuideOff', true); hide(); });
    el.addEventListener('click', (e) => { if (e.target === el) hide(); });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  // corner button (touch devices) + keep the layout sized to the real viewport
  function build() {
    const b = doc.createElement('button');
    b.id = 'fsBtn'; b.type = 'button'; b.setAttribute('aria-label', '全螢幕');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
    b.addEventListener('click', (e) => { e.stopPropagation(); FS.toggle(); });
    doc.getElementById('app').appendChild(b);
    const sync = () => { b.classList.toggle('on', FS.active); b.style.display = FS.isTouch && !FS.active && !FS.standalone ? '' : 'none'; };
    doc.addEventListener('fullscreenchange', sync); doc.addEventListener('webkitfullscreenchange', sync);
    sync();
  }
  // rotating a phone to landscape offers fullscreen: browsers only allow it from a tap, so one tap anywhere does it
  function buildRotatePrompt() {
    const p = doc.createElement('div');
    p.id = 'fsPrompt';
    p.innerHTML = '<div><svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><p>點一下畫面進入全螢幕</p><em>TAP FOR FULLSCREEN</em><small>不需要的話，點右上角 ✕ 略過</small></div><button type="button" aria-label="略過">✕</button>';
    doc.getElementById('app').appendChild(p);
    const hide = () => p.classList.remove('show');
    p.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); hide(); });
    p.addEventListener('click', () => { hide(); FS.enter(); });
    const land = window.matchMedia('(orientation: landscape)');
    let tipShown = false;
    const check = () => {
      if (!FS.isTouch || !land.matches || FS.active || FS.standalone) { hide(); return; }
      if (FS.supported) p.classList.add('show');
      else if (!tipShown && G.UI && G.UI.booted && shouldAutoGuide()) { tipShown = true; FS.guide(); }
    };
    (land.addEventListener ? land.addEventListener('change', check) : land.addListener(check));
    doc.addEventListener('fullscreenchange', () => { if (FS.active) hide(); });
    FS.offerOnLandscape = check;
  }
  window.addEventListener('load', () => {
    build();
    buildRotatePrompt();
    buildGuide();
    // first touch anywhere (e.g. the "press any key" screen) on a phone goes fullscreen automatically;
    // on iPhone (no fullscreen) the first tap shows the home-screen guide once instead
    if (FS.isTouch && !FS.standalone) window.addEventListener('pointerdown', function first(e) {
      if (e.pointerType === 'mouse') return;
      window.removeEventListener('pointerdown', first, true);
      if (FS.supported) { if (!FS.active) FS.enter(); }
      else if (shouldAutoGuide()) setTimeout(() => FS.guide(), 600);
    }, true);
  });
  doc.addEventListener('fullscreenchange', () => window.dispatchEvent(new Event('resize')));
})(window.G);

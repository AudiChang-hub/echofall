'use strict';
/* ECHOFALL — self-update for home-screen installs.
   tools/package.py stamps each release: <meta name="ef-version"> in index.html, ?v=<hash> on every script/style,
   and a version.json next to it. A home-screen app is usually resumed rather than reloaded, so on launch, on
   returning to the app and every few minutes we ask the server for version.json (never cached); when it is newer
   we reload — straight away on the title screen, otherwise the next time the player is back on the title.
   Progress lives in localStorage, so an update never touches the save. Inert in development (no meta tag). */
(function (G) {
  const meta = document.querySelector('meta[name="ef-version"]');
  const cur = meta && meta.content;
  G.VERSION = cur || 'dev';
  if (!cur || !window.fetch) return;
  let latest = null, told = false, checking = false;
  const safeNow = () => {
    const g = G.game, ui = G.UI;
    if (!g || !g.state) return true;
    return g.state === 'title' || g.state === 'boot' || !!(ui && ui.stack && ui.stack.some((l) => l.id === 'title'));
  };
  const apply = () => {
    if (!latest || latest === cur) return;
    const key = 'ef-updated-' + latest;
    try { if (sessionStorage.getItem(key)) return; } catch (e) { /* ignore */ }
    if (!safeNow()) {
      if (!told && G.UI && G.UI.toast) { told = true; G.UI.toast('有新版本：回到標題畫面時會自動更新', 'item'); }
      return;
    }
    try { sessionStorage.setItem(key, '1'); } catch (e) { /* ignore */ }
    // refresh the cached page first so the reload really gets the new build
    fetch('index.html', { cache: 'reload' }).catch(() => {}).then(() => location.reload());
  };
  const check = async () => {
    if (checking) return; checking = true;
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); if (j && j.v) latest = j.v; }
    } catch (e) { /* offline: try later */ }
    checking = false; apply();
  };
  G.Update = { check, get latest() { return latest; } };
  // permanent install (GitHub Pages): keep every file offline so home-screen launches open instantly
  if ('serviceWorker' in navigator && /github\.io$/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('load', () => setTimeout(check, 1200));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) check(); });
  setInterval(check, 5 * 60 * 1000);
  setInterval(apply, 2500);
})(window.G);

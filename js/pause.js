'use strict';
/* ECHOFALL — pausing that always works: a pause button on the HUD for the mouse, and the game stops by itself when the
   window loses focus (another tab, another app, a phone call). Esc alone is not enough: in fullscreen and inside an
   embedding page the browser keeps Esc for itself, so P pauses too. */
(function (G) {
  const req = () => { const g = G.game; if (g && g.state === 'play') g.wantPause = true; };
  const btn = document.getElementById('hudPause');
  if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); req(); btn.blur(); });
  // the test harness drives a hidden page: it must not pause itself
  if (!/\/tools\//.test(location.pathname)) {
    const away = () => { const g = G.game; if (g && g.state === 'play' && !(G.UI && G.UI.modalOpen())) { g.wantPause = true; } };
    window.addEventListener('blur', away);
    document.addEventListener('visibilitychange', () => { if (document.hidden) away(); });
  }
})(window.G);

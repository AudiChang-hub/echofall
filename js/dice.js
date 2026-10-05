'use strict';
/* ECHOFALL — d20 checks (D&D 5e): d20 + ability modifier vs a DC. A natural 20 always succeeds brilliantly, a natural 1
   always fails badly. The roll is shown as a tumbling die with the maths laid out beside it, so a check never feels hidden.
   G.Dice.check({ attr, dc, title }, (r) => …)  r = { roll, mod, total, dc, ok, crit, fumble } */
(function (G) {
  const $ = (s) => document.querySelector(s), I = () => G.Input;
  // a d20 drawn as an icosahedron seen face-on: outer hexagon, inner triangle, the face number
  const DIE = (n, col) => `<svg class="d20-svg" viewBox="0 0 120 120" aria-hidden="true">
    <defs><linearGradient id="d20g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
    <polygon points="60,6 107,33 107,87 60,114 13,87 13,33" fill="${col}" stroke="#0b0612" stroke-width="3"/>
    <polygon points="60,6 107,33 107,87 60,114 13,87 13,33" fill="url(#d20g)"/>
    <polygon points="60,30 92,84 28,84" fill="rgba(255,255,255,.12)" stroke="rgba(11,6,18,.6)" stroke-width="2"/>
    <path d="M60 6L60 30M107 33L92 84M107 87L92 84M60 114L92 84M60 114L28 84M13 87L28 84M13 33L28 84M13 33L60 30M107 33L60 30" stroke="rgba(11,6,18,.45)" stroke-width="1.5"/>
    <text x="60" y="72" text-anchor="middle" class="d20-n">${n}</text></svg>`;

  const D = G.Dice = {
    d20() { return 1 + Math.floor(Math.random() * 20); },
    // odds of passing (for the option labels)
    chance(attr, dc) { const m = G.DnD ? G.DnD.mod(attr) : 0; const need = dc - m; return Math.round(100 * Math.min(0.95, Math.max(0.05, (21 - need) / 20))); },
    check(o, done) {
      const A = G.DnD.ATTRS.find((q) => q.id === o.attr) || G.DnD.ATTRS[0];
      const mod = G.DnD ? G.DnD.mod(A.id) : 0, roll = o.force || this.d20(), total = roll + mod;
      const crit = roll === 20, fumble = roll === 1, ok = crit || (!fumble && total >= o.dc);
      let el = $('#diceRoll');
      if (!el) { el = document.createElement('section'); el.id = 'diceRoll'; el.className = 'screen modal'; document.getElementById('ui').appendChild(el); }
      el.innerHTML = `<div class="dice" style="--ac:${A.col}">
        <p class="dice-k">${o.title || '檢定'}</p>
        <h3>${G.Icons.svg(A.id, 22)}${A.name}檢定<span>DC ${o.dc}</span></h3>
        <div class="d20 rolling">${DIE('?', A.col)}</div>
        <p class="dice-math"><span class="dm-roll">d20</span> <i>${mod >= 0 ? '+' : '−'}</i> <span>${Math.abs(mod)}</span><small>${A.name}修正</small> <i>=</i> <b class="dm-total">?</b> <i>vs</i> <span>DC ${o.dc}</span></p>
        <p class="dice-res"></p>
        <button type="button" class="gb-act main dice-ok" disabled>繼續</button></div>`;
      const die = el.querySelector('.d20'), num = () => el.querySelector('.d20-n');
      G.SFX.play('cloth', 1.8);
      let k = 0, finished = false;
      const tick = setInterval(() => {
        k++; const n = k < 14 ? 1 + Math.floor(Math.random() * 20) : roll;
        if (num()) num().textContent = n;
        if (k % 3 === 0) G.SFX.play('ui', 0.8 + Math.random() * 0.6);
        if (k >= 14) {
          clearInterval(tick); finished = true;
          die.classList.remove('rolling'); die.classList.add(crit ? 'crit' : fumble ? 'fumble' : ok ? 'ok' : 'no');
          el.querySelector('.dm-roll').textContent = roll; el.querySelector('.dm-total').textContent = total;
          el.querySelector('.dice-res').innerHTML = crit ? '<b class="r-crit">大成功！</b>' : fumble ? '<b class="r-fum">大失敗……</b>' : ok ? '<b class="r-ok">成功</b>' : '<b class="r-no">失敗</b>';
          G.SFX.play(ok ? 'pylon' : 'uiBack', ok ? 1.2 : 1); if (crit) G.SFX.play('discover', 1.2);
          el.querySelector('.dice-ok').disabled = false;
        }
      }, 70);
      const fin = () => { if (!finished || !(G.UI.top() && G.UI.top().id === 'dice')) return; G.UI.pop(); done && done({ roll, mod, total, dc: o.dc, ok, crit, fumble }); };
      el.querySelector('.dice-ok').onclick = fin;
      G.UI.push({ id: 'dice', el, handle: () => { if (I().tap('confirm') || I().tap('interact')) fin(); } });
    },
  };
})(window.G);

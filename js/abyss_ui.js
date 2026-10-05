'use strict';
/* ECHOFALL — 殘響深淵 screens: the Pact of Punishment (苦難契約) before a run, and the tally after it. */
(function (G) {
  const I = () => G.Input, $ = (s) => document.querySelector(s);

  Object.assign(G.UI, {
    openAbyss() {
      const g = G.game, sv = g.save, A = G.Abyss;
      let el = $('#abyssScreen');
      if (!el) {
        el = document.createElement('section'); el.id = 'abyssScreen'; el.className = 'screen modal';
        el.innerHTML = `<div class="abyss"><header class="gr-head"><div class="gr-title"><b>殘響深淵</b><em>THE ABYSS</em></div>
          <button type="button" class="x-close ab-close" aria-label="關閉">✕</button></header>
          <p class="ab-lore">鐘聲之下還有鐘聲。往下走的人，帶著空手回來，或者不回來。</p>
          <div class="ab-body"><div class="ab-pact"><h4>苦難契約<em>PACT OF PUNISHMENT</em></h4><div class="ab-list"></div></div>
          <aside class="ab-side"><div class="ab-heat"><span>熱度</span><b></b></div><p class="ab-mul"></p>
          <ul class="ab-rules"><li>每一層的獎勵顯示在門上，由你選擇下一扇門</li><li>每 5 層有守門者；擊敗後可以選擇返回地表</li>
          <li>共鳴回響只屬於這一趟；結束後恢復原本的共鳴</li><li>死亡不會遺落碎片，找到的碎片、裝備都會保留</li></ul>
          <p class="ab-rec"></p><button type="button" class="gb-act main ab-go">踏入深淵</button></aside></div></div>`;
        document.getElementById('ui').appendChild(el);
      }
      const pact = Object.assign({}, sv.pactLast || {});
      let fi = 0;
      const render = () => {
        const heat = A.heat(pact);
        el.querySelector('.ab-list').innerHTML = A.PACT.map((c, k) => {
          const r = pact[c.id] || 0;
          const pips = Array.from({ length: c.max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('');
          return `<button type="button" class="ab-c ${k === fi ? 'focus' : ''} ${r ? 'lit' : ''}" data-k="${k}"><span class="ab-n">${c.name}</span><span class="ab-pips">${pips}</span><span class="ab-d">${r ? c.desc(r) : c.desc(1).replace(/^/, '下一級：')}</span></button>`;
        }).join('');
        el.querySelector('.ab-heat b').textContent = heat;
        el.querySelector('.ab-heat').classList.toggle('hot', heat > 0);
        el.querySelector('.ab-mul').textContent = heat ? `守門者獎勵 ×${(1 + 0.15 * heat).toFixed(2)}` : '不加任何契約，也能踏入深淵';
        const rec = sv.abyss || { best: 0, runs: 0 };
        el.querySelector('.ab-rec').textContent = rec.runs ? `最深抵達：第 ${rec.best} 層　·　已下潛 ${rec.runs} 次` : '尚未下潛';
        el.querySelectorAll('.ab-c').forEach((b) => { b.onclick = () => { fi = +b.dataset.k; bump(1); }; });
      };
      // cycle a condition's rank (wraps back to 0 past its max)
      const bump = (d) => {
        const c = A.PACT[fi], r = pact[c.id] || 0;
        pact[c.id] = (r + d + c.max + 1) % (c.max + 1);
        if (!pact[c.id]) delete pact[c.id];
        G.SFX.play(d > 0 ? 'uiOk' : 'ui'); render();
      };
      const close = () => { if (this.top() && this.top().id === 'abyss') { G.SFX.play('uiBack'); this.pop(); } };
      const go = () => {
        if (!(this.top() && this.top().id === 'abyss')) return;
        G.UI.stack.slice().forEach(() => G.UI.pop());
        G.SFX.play('pylon');
        A.start(g, pact);
      };
      el.querySelector('.ab-close').onclick = close;
      el.querySelector('.ab-go').onclick = go;
      render();
      this.push({ id: 'abyss', el, handle: () => {
        const In = I();
        if (In.tap('back')) close();
        else if (In.tap('menuUp')) { fi = (fi - 1 + A.PACT.length) % A.PACT.length; G.SFX.play('ui'); render(); }
        else if (In.tap('menuDown')) { fi = (fi + 1) % A.PACT.length; G.SFX.play('ui'); render(); }
        else if (In.tap('menuRight')) bump(1);
        else if (In.tap('menuLeft')) bump(-1);
        else if (In.tap('confirm')) go();
      } });
    },
    // the tally after a run
    abyssEnd(r, cb) {
      let el = $('#abyssEnd');
      if (!el) {
        el = document.createElement('section'); el.id = 'abyssEnd'; el.className = 'screen modal';
        document.getElementById('ui').appendChild(el);
      }
      el.innerHTML = `<div class="ab-end"><p class="ab-k">${r.survived ? 'ASCENDED' : 'FALLEN'}</p><h3>${r.survived ? '自深淵歸來' : '沉入寂靜'}</h3>
        <div class="ab-depth"><b>${r.depth}</b><span>層</span></div>
        <dl><div><dt>殘響碎片</dt><dd>+${r.shards}</dd></div><div><dt>熱度</dt><dd>${r.heat}</dd></div><div><dt>最深紀錄</dt><dd>${r.best}</dd></div></dl>
        <button type="button" class="gb-act main ab-ok">返回地表</button></div>`;
      this.showHud(false); this.bossBar(null);
      let done = false;
      const ok = () => { if (done) return; done = true; this.pop(); G.Input.clearBuffers(); cb && cb(); };
      el.querySelector('.ab-ok').onclick = ok;
      G.Music.play('rest');
      this.push({ id: 'abyssEnd', el, handle: () => { const In = I(); if (In.tap('confirm') || In.tap('back')) ok(); } });
    },
  });
})(window.G);

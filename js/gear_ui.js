'use strict';
/* ECHOFALL — equipment screen (Elden Ring–style: slots · inventory · detail with auto-comparison) and loot cards.
   Opened from the pause menu (change gear anywhere) or a pylon (also reinforce weapons and salvage).
   Taps only select; every commit (裝備 / 卸下 / 強化 / 分解) is its own button, and 分解 asks twice. */
(function (G) {
  const GR = G.Gear, I = () => G.Input, $ = (s) => document.querySelector(s);
  const SLOTS = [['weapon', '武器'], ['head', '頭部'], ['body', '身體'], ['tal0', '護符 Ⅰ'], ['tal1', '護符 Ⅱ'], ['tal2', '護符 Ⅲ']];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function root() {
    let el = $('#gearScreen');
    if (el) return el;
    el = document.createElement('section');
    el.id = 'gearScreen'; el.className = 'screen modal';
    el.innerHTML = `<div class="gear">
      <header class="gr-head">
        <div class="gr-title"><b>裝備</b><em>EQUIPMENT</em><span class="gr-mode"></span></div>
        <div class="gr-wallet"><span><i class="shard-ico"></i><b class="gr-shards"></b><em>殘響碎片</em></span><span><i class="stone-ico"></i><b class="gr-stones"></b><em>鍛造石</em></span></div>
        <button type="button" class="gr-best">一鍵裝備最強</button>
        <button type="button" class="x-close gr-close" aria-label="關閉">✕</button>
      </header>
      <div class="gr-body">
        <nav class="gr-slots"></nav>
        <div class="gr-list"></div>
        <aside class="gr-detail"></aside>
      </div>
      <p class="pane-foot"><kbd data-g="tabL"></kbd><kbd data-g="tabR"></kbd> 切換欄位　<kbd data-g="menuUp"></kbd><kbd data-g="menuDown"></kbd> 選擇　<kbd data-g="confirm"></kbd> 裝備　<kbd data-g="heal"></kbd> 分解　<kbd data-g="back"></kbd> 返回</p>
    </div>`;
    document.getElementById('ui').appendChild(el);
    return el;
  }

  const statShort = (it) => {
    const s = GR.itemStats(it);
    if (it.slot === 'weapon') return `攻擊 ${s.power}`;
    if (it.slot === 'talisman') return GR.def(it).d;
    return `防禦 ${s.defense}`;
  };
  const badge = (v) => ({ worn: '<i class="gb worn">裝備中</i>', up: '<i class="gb up">▲ 更強</i>', down: '<i class="gb down">▼</i>', same: '<i class="gb same">＝</i>' }[v] || '');

  function lineHtml(l, compare) {
    let d = '';
    if (compare && Math.abs(l.delta) > 1e-6) {
      const good = (l.delta > 0) === l.hb;
      const mag = l.dfmt(Math.abs(l.delta)).replace(/^\+/, '');
      d = `<span class="gd ${good ? 'up' : 'down'}">${l.delta > 0 ? '▲' : '▼'} ${mag}</span>`;
    }
    return `<li><span>${l.label}</span><b>${l.val}</b>${d}</li>`;
  }

  Object.assign(G.UI, {
    /* -------------------------------------------------------- fast travel between reached chapters (pylons) */
    openTravel() {
      const g = G.game, sv = g.save, Ch = G.Chapters, F = sv.flags;
      let el = $('#travelScreen');
      if (!el) {
        el = document.createElement('section'); el.id = 'travelScreen'; el.className = 'screen modal';
        el.innerHTML = '<div class="travel"><header class="gr-head"><div class="gr-title"><b>旅行</b><em>FAST TRAVEL</em></div><span class="tv-sub">回到已經過的章節刷寶；會重生的敵人每次休息都會回來</span><button type="button" class="x-close tv-close" aria-label="關閉">✕</button></header><div class="tv-body"><nav class="tv-ch"></nav><div class="tv-py"></div></div></div>';
        document.getElementById('ui').appendChild(el);
      }
      const reach = g.reachedChapter(), here = Ch.cur ? Ch.cur.id : 1;
      let ci = here, pi = 0;
      const open = (ch) => {
        const pys = Ch.pylonsOf(ch);
        return pys.filter((py, i) => i === 0 || F['ch_done_' + ch] || (sv.visited && sv.visited[py.id]) || (ch === here && sv.checkpoint === py.id));
      };
      const renderCh = () => {
        let h = '';
        for (let n = 1; n <= reach; n++) {
          const m = Ch.info(n), boss = F['boss_' + n] || (n === 1 && F.boss_dead);
          h += `<button type="button" class="tv-c ${n === ci ? 'on' : ''}" data-n="${n}"><span class="tv-n">第${m.numZh}章</span><b>${m.title}</b>
            <em>${n === here ? '<i class="tv-here">目前所在</i>' : ''}${boss ? '頭目已擊倒' : '進行中'}</em></button>`;
        }
        el.querySelector('.tv-ch').innerHTML = h;
        el.querySelectorAll('.tv-c').forEach((b) => { b.onclick = () => { ci = +b.dataset.n; pi = 0; G.SFX.play('ui'); render(); }; });
      };
      const renderPy = () => {
        const host = el.querySelector('.tv-py');
        if (!Ch.loaded(ci)) {
          host.innerHTML = '<p class="tv-wait">正在下載這一章…</p>';
          Ch.ensure(ci).then(() => { if (this.top() && this.top().id === 'travel') render(); }).catch(() => { host.innerHTML = '<p class="tv-wait">下載失敗，請確認網路</p>'; });
          return;
        }
        const list = open(ci);
        pi = Math.min(pi, list.length - 1);
        host.innerHTML = `<h4>共鳴碑</h4>${list.map((py, i) => `<button type="button" class="tv-p ${i === pi ? 'on' : ''}" data-i="${i}"><i class="tv-dot"></i>${py.name || py.id}${ci === here && sv.checkpoint === py.id ? '<em>上次休息</em>' : ''}</button>`).join('')}
          <p class="tv-note">${Ch.pylonsOf(ci).length > list.length ? '還沒造訪的共鳴碑不會顯示。' : ''}</p>
          <button type="button" class="gb-act main tv-go">前往「${(list[pi] && (list[pi].name || list[pi].id)) || ''}」</button>`;
        host.querySelectorAll('.tv-p').forEach((b) => { b.onclick = () => { pi = +b.dataset.i; G.SFX.play('ui'); renderPy(); }; });
        host.querySelector('.tv-go').onclick = go;
      };
      const render = () => { renderCh(); renderPy(); };
      const go = () => {
        if (!Ch.loaded(ci)) return;
        const py = open(ci)[pi]; if (!py) return;
        G.SFX.play('pylon'); g.travelTo(ci, py.id);
      };
      const close = () => { if (this.top() && this.top().id === 'travel') { G.SFX.play('uiBack'); this.pop(); } };
      el.querySelector('.tv-close').onclick = close;
      render();
      this.push({ id: 'travel', el, handle: () => {
        const In = I();
        if (In.tap('back')) close();
        else if (In.tap('menuUp')) { ci = Math.max(1, ci - 1); pi = 0; G.SFX.play('ui'); render(); }
        else if (In.tap('menuDown')) { ci = Math.min(reach, ci + 1); pi = 0; G.SFX.play('ui'); render(); }
        else if (In.tap('menuLeft')) { pi = Math.max(0, pi - 1); G.SFX.play('ui'); renderPy(); }
        else if (In.tap('menuRight')) { pi = pi + 1; G.SFX.play('ui'); renderPy(); }
        else if (In.tap('confirm')) go();
      } });
    },

    /* -------------------------------------------------------- chapter download overlay */
    loading(on, text) {
      let el = $('#chLoad');
      if (!el) { el = document.createElement('div'); el.id = 'chLoad'; el.innerHTML = '<p></p><i><b></b></i>'; document.getElementById('ui').appendChild(el); }
      el.querySelector('p').textContent = text || '載入中…';
      el.classList.toggle('show', !!on);
    },

    /* -------------------------------------------------------- loot card (pickup + auto-compare) */
    lootCard(it) {
      const host = $('#lootCards') || (() => { const h = document.createElement('div'); h.id = 'lootCards'; document.getElementById('ui').appendChild(h); return h; })();
      const sv = G.game.save, R = GR.RARITY[it.r], cur = GR.current(sv, it), v = GR.verdict(sv, it);
      const lines = GR.lines(it, cur).filter((l) => Math.abs(l.delta) > 1e-6).slice(0, 3);
      const card = document.createElement('div');
      card.className = 'loot-card r' + it.r;
      card.style.setProperty('--rc', R.col);
      card.innerHTML = `<div class="lc-ico">${GR.icon(it)}</div><div class="lc-main"><p class="lc-k">${R.name}　${GR.slotName[it.slot]}</p><h4>${esc(GR.name(it))}</h4>
        <p class="lc-s">${esc(statShort(it))}</p>
        ${lines.length && cur ? `<ul class="lc-cmp">${lines.map((l) => lineHtml(l, true)).join('')}</ul><p class="lc-vs">與「${esc(GR.name(cur))}」比較</p>` : ''}
        ${!cur && it.slot !== 'weapon' ? '<p class="lc-vs">此欄位目前是空的</p>' : ''}</div>${badge(v)}`;
      host.appendChild(card);
      while (host.children.length > 3) host.firstChild.remove();
      setTimeout(() => card.classList.add('out'), 4200);
      setTimeout(() => card.remove(), 4800);
      if (v === 'up' && !G.Store.get('gearHint', false)) { G.Store.set('gearHint', true); setTimeout(() => this.toast('撿到更強的裝備了：暫停選單 →「裝備」可以換上', 'item'), 900); }
    },

    /* -------------------------------------------------------- equipment screen */
    openGear(opts = {}) {
      const g = G.game, sv = g.save; GR.ensure(sv);
      const el = root(), forge = !!opts.forge;
      let si = 0, li = 0, armed = null;
      const wasPlay = g.state === 'play'; if (wasPlay) g.state = 'paused';
      const seen = new Set();
      const clearSeen = () => { for (const it of sv.inv) if (seen.has(it.uid)) delete it.n; seen.clear(); };
      // open on the first slot that has something better waiting
      { const k = SLOTS.findIndex(([key]) => GR.betterCount(sv, key.startsWith('tal') ? 'talisman' : key) > 0); if (k >= 0) si = k; }
      el.querySelector('.gr-mode').textContent = forge ? '共鳴碑 · 可強化與分解' : '';
      const slotKey = () => SLOTS[si][0];
      const slotType = () => (slotKey().startsWith('tal') ? 'talisman' : slotKey());
      const worn = (k) => (k.startsWith('tal') ? GR.get(sv, sv.gear.tal[+k.slice(3)]) : GR.get(sv, sv.gear[k]));
      const items = () => {
        const t = slotType();
        const order = { worn: 0, up: 1, same: 2, down: 3 };
        return sv.inv.filter((i) => i.slot === t).sort((a, b) => {
          const wa = worn(slotKey()) === a ? -1 : 0, wb = worn(slotKey()) === b ? -1 : 0;
          return wa - wb || order[GR.verdict(sv, a)] - order[GR.verdict(sv, b)] || GR.score(b) - GR.score(a) || b.r - a.r;
        });
      };
      const wallet = () => { el.querySelector('.gr-shards').textContent = Math.floor(sv.shards); el.querySelector('.gr-stones').textContent = sv.stones || 0; };
      const after = () => { g.player.recalc(); sv.tonic = Math.min(sv.tonic, g.player.maxTonic); g.persist && g.persist(); wallet(); };

      const renderSlots = () => {
        el.querySelector('.gr-slots').innerHTML = SLOTS.map(([k, label], i) => {
          const w = worn(k), R = w ? GR.RARITY[w.r] : null, up = GR.betterCount(sv, k.startsWith('tal') ? 'talisman' : k);
          return `<button type="button" class="gs ${i === si ? 'on' : ''}" data-i="${i}" style="${R ? `--rc:${R.col}` : ''}"><span class="gs-l">${label}${up ? `<i class="gs-up">▲${up}</i>` : ''}</span>
            <span class="gs-n">${w ? `<i class="gi">${GR.icon(w)}</i>${esc(GR.name(w))}` : '<em>— 空 —</em>'}</span></button>`;
        }).join('');
        el.querySelectorAll('.gs').forEach((b) => { b.onclick = () => { clearSeen(); si = +b.dataset.i; li = 0; armed = null; G.SFX.play('ui'); render(); }; });
      };
      const renderList = () => {
        const list = items(), host = el.querySelector('.gr-list');
        list.forEach((it) => { if (it.n) seen.add(it.uid); });
        li = Math.max(0, Math.min(li, list.length - 1));
        host.innerHTML = list.length ? list.map((it, i) => {
          const R = GR.RARITY[it.r], ww = worn(slotKey()) === it;
          return `<button type="button" class="gl ${i === li ? 'on' : ''}" data-i="${i}" style="--rc:${R.col}"><i class="gi">${GR.icon(it)}</i>
            <span class="gl-n">${it.n ? '<i class="gl-new">NEW</i>' : ''}${esc(GR.name(it))}<small>${esc(statShort(it))}</small></span>${ww ? badge('worn') : badge(GR.verdict(sv, it))}</button>`;
        }).join('') : `<p class="gl-empty">還沒有${GR.slotName[slotType()]}。<br>打倒敵人有機率掉落，菁英與頭目必定掉落。</p>`;
        host.querySelectorAll('.gl').forEach((b) => { b.onclick = () => { if (li !== +b.dataset.i) { li = +b.dataset.i; armed = null; G.SFX.play('ui'); renderList(); renderDetail(); } }; });
        const on = host.querySelector('.gl.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
      };
      const renderDetail = () => {
        const it = items()[li], host = el.querySelector('.gr-detail');
        if (!it) { host.innerHTML = '<p class="gd-none">選擇左邊的欄位，查看可以換上的裝備。</p>'; return; }
        const R = GR.RARITY[it.r], k = slotKey(), w = worn(k), isW = w === it;
        const cmpWith = isW ? undefined : it.slot === 'talisman' ? (w || null) : GR.current(sv, it);
        const lines = GR.lines(it, cmpWith);
        const sal = GR.salvageValue(it), cost = forge && it.slot === 'weapon' ? GR.upCost(it) : null;
        const canUp = cost && sv.stones >= cost.stones && sv.shards >= cost.shards;
        host.style.setProperty('--rc', R.col);
        host.innerHTML = `<p class="gd-k">${R.name} ${R.en} · ${GR.slotName[it.slot]}${it.il > 1 ? ` · 第 ${it.il} 章` : ''}</p>
          <h3><i class="gi">${GR.icon(it)}</i>${esc(GR.name(it))}</h3>
          <p class="gd-desc">${esc(GR.desc(it))}</p>
          <ul class="gd-lines">${lines.map((l) => lineHtml(l, cmpWith !== undefined)).join('')}</ul>
          ${cmpWith ? `<p class="gd-vs">▲▼ 與目前裝備的「${esc(GR.name(cmpWith))}」比較</p>` : cmpWith === null && !isW ? '<p class="gd-vs">此欄位目前是空的</p>' : ''}
          <p class="gd-lore">${esc(GR.lore(it))}</p>
          <div class="gd-btns">
            ${isW ? (it.slot === 'weapon' ? '<button type="button" class="gb-act" disabled>使用中</button>' : '<button type="button" class="gb-act" data-a="off">卸下</button>') : '<button type="button" class="gb-act main" data-a="on">裝備</button>'}
            ${cost ? `<button type="button" class="gb-act" data-a="up" ${canUp ? '' : 'disabled'}>強化 +${it.plus}→+${it.plus + 1}<small>鍛造石 ${cost.stones}・碎片 ${cost.shards}</small></button>` : forge && it.slot === 'weapon' ? '<button type="button" class="gb-act" disabled>已強化到 +10</button>' : ''}
            ${isW || it.uid === 'start' ? '' : `<button type="button" class="gb-act warn" data-a="sal">${armed === it.uid ? '確定分解？' : '分解'}<small>碎片 +${sal.shards}${sal.stones ? `・鍛造石 +${sal.stones}` : ''}</small></button>`}
          </div>`;
        host.querySelectorAll('.gb-act[data-a]').forEach((b) => { b.onclick = () => act(b.dataset.a); });
      };
      const render = () => { renderSlots(); renderList(); renderDetail(); wallet(); };
      const act = (a) => {
        const it = items()[li]; if (!it) return;
        const k = slotKey();
        if (a === 'on') {
          if (it.slot === 'talisman') {
            const same = sv.gear.tal.findIndex((u) => { const w = GR.get(sv, u); return w && w.base === it.base && w !== it; });
            if (same >= 0) sv.gear.tal[same] = null;
            GR.equip(sv, it, +k.slice(3));
          } else GR.equip(sv, it);
          G.SFX.play('uiOk'); G.SFX.play('pylon', 1.4); after(); armed = null; li = 0; render();
        } else if (a === 'off') {
          if (GR.unequip(sv, it)) { G.SFX.play('uiBack'); after(); render(); }
        } else if (a === 'up') {
          if (GR.upgrade(sv, it)) { G.SFX.play('pylon'); G.SFX.play('impact'); this.toast(`${GR.name(it)}　強化完成`, 'good'); after(); render(); }
        } else if (a === 'sal') {
          if (armed !== it.uid) { armed = it.uid; G.SFX.play('ui'); renderDetail(); return; }
          const v = GR.salvage(sv, it);
          if (v) { G.SFX.play('pickup'); this.toast(`分解：碎片 +${v.shards}${v.stones ? `　鍛造石 +${v.stones}` : ''}`, 'item'); armed = null; after(); render(); }
        }
      };
      const best = () => {
        const pickBest = (t) => sv.inv.filter((i) => i.slot === t).sort((a, b) => GR.score(b) - GR.score(a))[0];
        for (const t of ['weapon', 'head', 'body']) { const b = pickBest(t); if (b) GR.equip(sv, b); }
        const tals = []; for (const it of sv.inv.filter((i) => i.slot === 'talisman').sort((a, b) => GR.score(b) - GR.score(a))) if (!tals.some((x) => x.base === it.base) && tals.length < 3) tals.push(it);
        sv.gear.tal = [0, 1, 2].map((i) => (tals[i] ? tals[i].uid : null));
        G.SFX.play('uiOk'); this.toast('已換上每個欄位分數最高的裝備', 'good'); after(); li = 0; render();
      };
      el.querySelector('.gr-best').onclick = best;
      const close = () => { if (this.stack.some((l) => l.id === 'gear')) { while (this.top() && this.top().id !== 'gear') this.pop(); G.SFX.play('uiBack'); this.pop(); opts.onClose && opts.onClose(); } };
      const onClose = () => { clearSeen(); g.persist && g.persist(); if (wasPlay && g.state === 'paused') g.state = 'play'; G.Input.clearBuffers(); };
      el.querySelector('.gr-close').onclick = close;
      render();
      this.push({ id: 'gear', el, onClose, handle: () => {
        const In = I();
        if (In.tap('back')) close();
        else if (In.tap('tabL')) { clearSeen(); si = (si + SLOTS.length - 1) % SLOTS.length; li = 0; armed = null; G.SFX.play('ui'); render(); }
        else if (In.tap('tabR')) { clearSeen(); si = (si + 1) % SLOTS.length; li = 0; armed = null; G.SFX.play('ui'); render(); }
        else if (In.tap('menuUp')) { li = Math.max(0, li - 1); armed = null; G.SFX.play('ui'); renderList(); renderDetail(); }
        else if (In.tap('menuDown')) { li = Math.min(items().length - 1, li + 1); armed = null; G.SFX.play('ui'); renderList(); renderDetail(); }
        else if (In.tap('confirm')) { const it = items()[li]; if (it) act(worn(slotKey()) === it ? (forge && it.slot === 'weapon' ? 'up' : 'off') : 'on'); }
        else if (In.tap('heal')) act('sal');
      } });
    },

    /* -------------------------------------------------------- build overview: echoes · relics · gear · stats */
    openBuild() {
      const g = G.game, sv = g.save, P = g.player, D = G.DATA; GR.ensure(sv);
      let el = $('#buildScreen');
      if (!el) {
        el = document.createElement('section'); el.id = 'buildScreen'; el.className = 'screen modal';
        el.innerHTML = '<div class="build"><header class="gr-head"><div class="gr-title"><b>殘響・遺物</b><em>BUILD</em></div><button type="button" class="x-close bd-close" aria-label="關閉">✕</button></header><div class="bd-body"></div></div>';
        document.getElementById('ui').appendChild(el);
      }
      const wasPlay = g.state === 'play'; if (wasPlay) g.state = 'paused';
      const E = G.ECHOES || {}, boons = sv.boons || {};
      const echoes = Object.keys(boons).filter((id) => E[id]).map((id) => {
        const d = E[id], lv = boons[id];
        return `<li style="--c:${d.col}"><i class="bd-ico">${d.icon}</i><div><b>${d.name}<em>Lv ${lv} / ${d.max}</em></b><p>${d.desc(lv)}</p></div></li>`;
      }).join('') || '<li class="bd-none">還沒有共鳴回響。打贏戰鬥後可以從三張卡中選一張，會一路帶到下一章。</li>';
      const owned = Object.keys(D.relics || {}).filter((k) => sv.flags['relic_' + k]);
      const relic = (k, on) => `<li class="${on ? '' : 'off'}"><i class="bd-ico rel">◆</i><div><b>${D.relics[k].name}<em>${on ? '裝備中' : '未裝備'}</em></b><p>${D.relics[k].desc}</p></div></li>`;
      const relics = (sv.equipped || []).map((k) => D.relics[k] ? relic(k, true) : '').join('') + owned.filter((k) => !(sv.equipped || []).includes(k)).map((k) => relic(k, false)).join('')
        || '<li class="bd-none">還沒有遺物。打倒菁英、完成支線就能取得。</li>';
      const gearRow = (label, it) => `<li style="--rc:${it ? GR.RARITY[it.r].col : 'var(--faint)'}"><span>${label}</span><b>${it ? `<i class="gi">${GR.icon(it)}</i>${esc(GR.name(it))}` : '— 空 —'}</b></li>`;
      const gear = gearRow('武器', GR.get(sv, sv.gear.weapon)) + gearRow('頭部', GR.get(sv, sv.gear.head)) + gearRow('身體', GR.get(sv, sv.gear.body))
        + sv.gear.tal.map((u, i) => gearRow('護符 ' + ['Ⅰ', 'Ⅱ', 'Ⅲ'][i], GR.get(sv, u))).join('');
      const up = GR.anyBetter(sv);
      el.querySelector('.bd-body').innerHTML = `
        <section><h4>共鳴回響 <em>ECHOES</em></h4><ul class="bd-list">${echoes}</ul></section>
        <section><h4>遺物 <em>RELICS · ${(sv.equipped || []).length}/2</em></h4><ul class="bd-list">${relics}</ul><p class="bd-hint">遺物要在共鳴碑 →「遺物」更換。</p></section>
        <section><h4>裝備 <em>EQUIPMENT</em></h4><ul class="bd-gear">${gear}</ul>
          <button type="button" class="gb-act main bd-go">${up ? '▲ 有更強的裝備，前往裝備' : '前往裝備'}</button>
          <ul class="bd-stats"><li><span>攻擊倍率</span><b>×${P.dmgMul.toFixed(2)}</b></li><li><span>受到傷害</span><b>${Math.round((P.dmgTaken || 1) * 100)}%</b></li>
          <li><span>最大生命</span><b>${P.maxHp}</b></li><li><span>耐力</span><b>${Math.round(P.maxSta)}</b></li><li><span>完美格擋判定</span><b>${Math.round(P.parryWin * 1000)}ms</b></li></ul></section>`;
      const close = () => { if (this.top() && this.top().id === 'build') { G.SFX.play('uiBack'); this.pop(); } };
      el.querySelector('.bd-close').onclick = close;
      el.querySelector('.bd-go').onclick = () => { this.pop(); this.openGear(); };
      this.push({ id: 'build', el, onClose: () => { if (wasPlay && g.state === 'paused') g.state = 'play'; G.Input.clearBuffers(); }, handle: () => { if (I().tap('back') || I().tap('confirm')) close(); } });
    },
  });
  const hudOpen = (fn) => (e) => {
    e.stopPropagation();
    const g = G.game;
    if (!g || g.state !== 'play' || G.UI.stack.length || !g.control) return;
    fn();
  };
  const bindHud = () => {
    const up = document.getElementById('gearUp'), ec = document.getElementById('echoes');
    if (up) { up.addEventListener('click', hudOpen(() => G.UI.openGear())); up.addEventListener('pointerdown', (e) => e.stopPropagation()); }
    if (ec) { ec.addEventListener('click', hudOpen(() => G.UI.openBuild())); ec.addEventListener('pointerdown', (e) => e.stopPropagation()); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindHud); else bindHud();
})(window.G);

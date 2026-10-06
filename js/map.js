'use strict';
/* ECHOFALL — 地圖 (the map): every chapter remembers where Bari has been.
   The world is cut into 250-unit cells; the cells around her are marked as she moves (save.mapX[chapter]).
   The map screen (M / Tab, pause menu, the touch "地圖" button) draws the level's walkable shapes inside the explored
   cells only, with the lamps, chests, letters, doors, the abilities still waiting, and Bari herself.
   It fits the chapter into the screen; drag or use ←/→ to pan, +/- or the wheel to zoom. */
(function (G) {
  const U = G.U, CELL = 250, RX = 3, RY = 2;

  const M = G.Map = {
    key() {
      if (G.Abyss && G.Abyss.active) return null;
      const ch = G.LEVEL.chapter || 1, R = G.Routes && G.Routes.active;
      return R ? `r${ch}${R.road}` : `c${ch}`;
    },
    cells(sv, k) { sv.mapX = sv.mapX || {}; return (sv.mapX[k] = sv.mapX[k] || {}); },
    mark(game, dt) {
      this.t = (this.t || 0) + dt; if (this.t < 0.2) return; this.t = 0;
      const k = this.key(), P = game.player; if (!k || !P || game.state !== 'play') return;
      const c = this.cells(game.save, k), cx = Math.floor(P.x / CELL), cy = Math.floor((P.y - 60) / CELL);
      for (let i = -RX; i <= RX; i++) for (let j = -RY; j <= RY; j++) c[(cx + i) + ',' + (cy + j)] = 1;
    },
    explored(game) {
      const k = this.key(); if (!k) return 0;
      const L = G.LEVEL, c = this.cells(game.save, k);
      // share of the level's walkable cells that have been seen
      const all = new Set();
      for (const s of L.solids) if (s.kind !== 'wall' && s.kind !== 'invisible') for (let x = Math.floor(s.x / CELL); x <= Math.floor((s.x + s.w) / CELL); x++) all.add(x + ',' + Math.floor((s.y - 60) / CELL));
      for (const o of L.oneways) if (!o.spirit) for (let x = Math.floor(o.x / CELL); x <= Math.floor((o.x + o.w) / CELL); x++) all.add(x + ',' + Math.floor((o.y - 60) / CELL));
      let n = 0; for (const a of all) if (c[a]) n++;
      return all.size ? n / all.size : 0;
    },

    /* ---------------- the screen ---------------- */
    open(game) {
      if (!this.key()) { game.toast('冥井裡沒有地圖', 'warn'); return; }
      let el = document.getElementById('mapScreen');
      if (!el) {
        el = document.createElement('section'); el.id = 'mapScreen'; el.className = 'screen modal';
        el.innerHTML = `<div class="map-wrap"><h2 class="pane-title">地圖<em>MAP</em><span class="map-pct" id="mapPct"></span><button type="button" class="x-close" id="mapClose" aria-label="關閉地圖">✕</button></h2>
          <canvas id="mapCanvas"></canvas>
          <div class="map-legend" id="mapLegend"></div>
          <p class="pane-foot"><kbd data-g="menuLeft"></kbd><kbd data-g="menuRight"></kbd> 移動　<b>+ / −</b> 縮放　<kbd data-g="back"></kbd> 關閉</p></div>`;
        document.getElementById('ui').appendChild(el);
        el.querySelector('#mapClose').onclick = () => { if (G.UI.top() && G.UI.top().id === 'map') G.UI.pop(); };
        const cv = el.querySelector('#mapCanvas');
        let drag = null;
        cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, px: this.view.px, py: this.view.py }; cv.setPointerCapture(e.pointerId); });
        cv.addEventListener('pointermove', (e) => { if (!drag) return; const s = this.view.s; this.view.px = drag.px - (e.clientX - drag.x) / s; this.view.py = drag.py - (e.clientY - drag.y) / s; this.draw(); });
        cv.addEventListener('pointerup', () => { drag = null; });
        cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
        window.addEventListener('keydown', (e) => { if (!(G.UI.top() && G.UI.top().id === 'map')) return; if (e.key === '+' || e.key === '=') this.zoom(1.25); if (e.key === '-') this.zoom(0.8); });
        window.addEventListener('resize', () => { if (G.UI.top() && G.UI.top().id === 'map') this.fit(true); });
      }
      this.el = el;
      G.SFX.play('pageOpen');
      G.UI.push({ id: 'map', el, back: () => { G.SFX.play('uiBack'); G.UI.pop(); }, handle: (dt) => {
        const I = G.Input, sp = 900 * dt / this.view.s;
        if (I.tap('back') || I.tap('map')) { G.SFX.play('uiBack'); G.UI.pop(); return; }
        if (I.down('menuLeft') || I.down('left')) { this.view.px -= sp; this.draw(); }
        if (I.down('menuRight') || I.down('right')) { this.view.px += sp; this.draw(); }
        if (I.down('menuUp') || I.down('up')) { this.view.py -= sp; this.draw(); }
        if (I.down('menuDown') || I.down('down')) { this.view.py += sp; this.draw(); }
      } });
      const pct = Math.round(this.explored(game) * 100);
      el.querySelector('#mapPct').textContent = `探索 ${pct}%`;
      this.fit(false);
    },
    // the whole level in view, centred on Bari
    fit(keep) {
      const cv = this.el.querySelector('#mapCanvas'), r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(10, r.width * dpr); cv.height = Math.max(10, r.height * dpr); this.dpr = dpr;
      const L = G.LEVEL, b = this.bounds();
      const s = Math.min(r.width / (b.x1 - b.x0), r.height / (b.y1 - b.y0)) * 0.94;
      if (!keep || !this.view) { const P = G.game.player; this.view = { s: Math.max(s, r.width / 6000), px: P.x, py: P.y - 200 }; }
      void L; this.draw();
    },
    zoom(f) { if (!this.view) return; this.view.s = U.clamp(this.view.s * f, 0.02, 0.6); this.draw(); },
    bounds() {
      const L = G.LEVEL; let x0 = L.bounds[0], x1 = L.bounds[1], y0 = 1e9, y1 = -1e9;
      for (const s of L.solids) if (s.kind !== 'wall') { y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y + Math.min(s.h, 300)); }
      for (const o of L.oneways) { y0 = Math.min(y0, o.y); y1 = Math.max(y1, o.y + 20); }
      return { x0, x1, y0: y0 - 300, y1: y1 + 100 };
    },
    draw() {
      const el = this.el; if (!el) return;
      const cv = el.querySelector('#mapCanvas'), ctx = cv.getContext('2d'), dpr = this.dpr || 1, g = G.game, L = G.LEVEL, F = g.save.flags;
      const Wc = cv.width / dpr, Hc = cv.height / dpr, v = this.view, s = v.s;
      const X = (x) => Wc / 2 + (x - v.px) * s, Y = (y) => Hc / 2 + (y - v.py) * s;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, Wc, Hc);
      // parchment ground
      const bg = ctx.createRadialGradient(Wc / 2, Hc / 2, 10, Wc / 2, Hc / 2, Math.max(Wc, Hc) * 0.7);
      bg.addColorStop(0, '#1d1820'); bg.addColorStop(1, '#0c0a0e');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, Wc, Hc);
      const c = this.cells(g.save, this.key());
      const seen = (x, y) => !!c[Math.floor(x / CELL) + ',' + Math.floor((y - 60) / CELL)];
      // fog: the explored cells are lit
      ctx.fillStyle = 'rgba(80,66,84,0.22)';
      for (const k in c) { const [cx, cy] = k.split(',').map(Number); ctx.fillRect(X(cx * CELL), Y(cy * CELL + 60), CELL * s + 0.5, CELL * s + 0.5); }
      // shapes, clipped to what has been seen
      ctx.save();
      ctx.beginPath();
      for (const k in c) { const [cx, cy] = k.split(',').map(Number); ctx.rect(X(cx * CELL), Y(cy * CELL + 60), CELL * s + 0.5, CELL * s + 0.5); }
      ctx.clip();
      for (const sd of L.solids) {
        if (sd.kind === 'wall' || sd.kind === 'invisible') continue;
        const h = Math.min(sd.h, sd.kind === 'roof' ? sd.h : 220);
        ctx.fillStyle = sd.kind === 'crypt' ? '#6a5868' : sd.kind === 'roof' ? '#8a7a6e' : '#a8927c';
        ctx.fillRect(X(sd.x), Y(sd.y), sd.w * s, h * s);
        ctx.fillStyle = '#f2dcc0'; ctx.fillRect(X(sd.x), Y(sd.y), sd.w * s, Math.max(1, 2));
      }
      for (const o of L.oneways) { ctx.fillStyle = o.spirit ? '#9fe6ff' : '#e9d3b5'; ctx.fillRect(X(o.x), Y(o.y), o.w * s, Math.max(1.5, 4 * s)); }
      if (G.Ch1X && G.Ch1X.on()) {
        if (!G.Ch1X.has('bell')) for (const sl of G.Ch1X.SEALS) { ctx.fillStyle = '#ffb6a0'; ctx.fillRect(X(sl.x), Y(sl.y), sl.w * s, Math.max(2, sl.h * s)); }
        for (const cr of G.Ch1X.CRACKS) if (!F['x_crack_' + cr.id]) { ctx.fillStyle = '#c9a98a'; ctx.fillRect(X(cr.x), Y(cr.y), Math.max(2, cr.w * s), cr.h * s); }
      }
      ctx.restore();
      // markers (only where seen)
      const labels = [{ x: X(g.player.x) - 22, y: Y(g.player.y) - 32, w: 44, h: 14 }];   // Bari's own name stays clear
      const mark = (x, y, kind, label) => {
        if (!seen(x, y)) return;
        const sx = X(x), sy = Y(y) - 6;
        ctx.save(); ctx.translate(sx, sy);
        if (kind === 'pylon') { ctx.fillStyle = '#7ff4ff'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.shadowColor = '#7ff4ff'; ctx.shadowBlur = 8; ctx.fill(); }
        else if (kind === 'chest') { ctx.fillStyle = '#ffcf7a'; ctx.fillRect(-5, -4, 10, 8); ctx.fillStyle = '#7a5418'; ctx.fillRect(-5, -1, 10, 1.5); }
        else if (kind === 'note') { ctx.fillStyle = '#efe6d6'; ctx.fillRect(-4, -5, 8, 10); ctx.fillStyle = '#7d6e5e'; ctx.fillRect(-2.5, -2, 5, 1); ctx.fillRect(-2.5, 1, 5, 1); }
        else if (kind === 'ability') { ctx.fillStyle = '#bff8ff'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke(); }
        else if (kind === 'door') { ctx.fillStyle = '#ff8f9f'; ctx.fillRect(-4, -10, 8, 14); }
        else if (kind === 'npc') { ctx.fillStyle = '#9cf7b0'; ctx.beginPath(); ctx.arc(0, -2, 4.5, 0, Math.PI * 2); ctx.fill(); }
        if (label) {
          // labels keep out of each other's way (nudged up, or left off when there is no room)
          ctx.shadowBlur = 0; ctx.font = '500 11px "Noto Sans TC", sans-serif'; ctx.textAlign = 'center';
          const w = ctx.measureText(label).width + 6;
          let ly = -14, placed = null;
          for (let k = 0; k < 3 && !placed; k++, ly -= 13) {
            const r = { x: sx - w / 2, y: sy + ly - 11, w, h: 13 };
            if (!labels.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y)) placed = r;
          }
          if (placed) {
            labels.push(placed);
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(12,10,14,0.9)'; ctx.strokeText(label, 0, placed.y - sy + 10);
            ctx.fillStyle = 'rgba(239,233,223,0.9)'; ctx.fillText(label, 0, placed.y - sy + 10);
          }
        }
        ctx.restore();
      };
      for (const p of L.pylons) mark(p.x, p.y, 'pylon', p.name);
      for (const it of L.items) if (!F[it.flag]) mark(it.x, it.y, it.chest || it.kind === 'relic' ? 'chest' : 'chest');
      for (const n of L.notes) if (!F['note_' + n.id]) mark(n.x, n.y, 'note');
      for (const n of L.npcs) mark(n.x, n.y, 'npc');
      for (const gt of (G.Props.gates || [])) if (!gt.open) mark(gt.x, gt.y, 'door', '送葬門');
      if (G.Ch1X && G.Ch1X.on()) for (const k in G.Ch1X.ABILITY) if (!G.Ch1X.has(k)) { const a = G.Ch1X.ABILITY[k]; mark(a.x, a.y, 'ability', a.name); }
      // Bari
      const P = g.player, px = X(P.x), py = Y(P.y) - 8, t = performance.now() / 1000;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pg = ctx.createRadialGradient(px, py, 0, px, py, 26); pg.addColorStop(0, 'rgba(127,244,255,0.6)'); pg.addColorStop(1, 'rgba(127,244,255,0)');
      ctx.fillStyle = pg; ctx.fillRect(px - 26, py - 26, 52, 52); ctx.restore();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px, py, 4 + Math.sin(t * 5) * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.font = '600 12px "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#bff8ff'; ctx.fillText('巴里', px, py - 12);
      // legend
      const lg = el.querySelector('#mapLegend');
      if (lg) lg.innerHTML = '<span><i class="lg-pylon"></i>魂燈台</span><span><i class="lg-chest"></i>未開的寶箱</span><span><i class="lg-note"></i>未讀的文書</span><span><i class="lg-ab"></i>能力</span><span><i class="lg-spirit"></i>靈道</span><span><i class="lg-seal"></i>封印</span>';
    },
  };
})(window.G);

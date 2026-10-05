'use strict';
/* ECHOFALL — breakable props and ledge readability.
   Breakables: crates, barrels, urns and Hushborn crystal clusters scattered along every chapter's floors.
   They are not solid (you walk through them), wobble when struck and burst into shards, smithing stones and
   now and then a piece of gear. Like the Hushborn they return whenever the world resets (rest / death).
   Ledges: every surface you can stand on gets the same thin warm lip, so the eye can tell a platform from
   background clutter at a glance. */
(function (G) {
  const U = G.U, TAU = Math.PI * 2, INK = '#0b0612';
  const KINDS = {
    crate: { w: 44, h: 40, hp: 2, col: '#8a5a34', dark: '#5a3820', lit: '#b07a48', sfx: 'hit', debris: '#a87444' },
    barrel: { w: 34, h: 46, hp: 2, col: '#6e4630', dark: '#4a2e1e', lit: '#94603e', sfx: 'hit', debris: '#8a5a3a' },
    urn: { w: 30, h: 42, hp: 1, col: '#b0784e', dark: '#7a4c30', lit: '#d49a6a', sfx: 'parry', debris: '#c88a5a' },
    crystal: { w: 40, h: 54, hp: 3, col: '#b04dff', dark: '#5c1f99', lit: '#e6b8ff', sfx: 'parry', debris: '#d68cff', glow: true },
  };
  // which props suit each chapter (and the crystal tint)
  const THEME = {
    1: { kinds: ['crate', 'barrel', 'crystal'], crystal: '#b04dff' },
    2: { kinds: ['crate', 'barrel', 'crystal'], crystal: '#7fd8ff' },
    3: { kinds: ['crystal', 'barrel', 'crate', 'crystal'], crystal: '#b04dff' },
    4: { kinds: ['urn', 'crate', 'urn'], crystal: '#9fe8ff' },
    5: { kinds: ['crate', 'barrel', 'crystal'], crystal: '#c9b6ff' },
    6: { kinds: ['urn', 'crystal', 'crate'], crystal: '#ff3d6e' },
    7: { kinds: ['urn', 'crystal'], crystal: '#ffd36a' },
    8: { kinds: ['urn', 'crystal', 'crate'], crystal: '#c9b6ff' },
  };
  // small deterministic RNG so each chapter always gets the same layout
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  const Props = G.Props = {
    list: [],
    // scatter breakables along the current level's walkable surfaces
    spawn(game) {
      const L = G.LEVEL, ch = L.chapter || 1, th = THEME[ch] || THEME[1], r = rng(9173 + ch * 7919);
      const out = [];
      const avoid = [];
      for (const p of L.pylons) avoid.push([p.x - 160, p.x + 160]);
      for (const n of L.notes) avoid.push([n.x - 90, n.x + 90]);
      for (const n of L.items) avoid.push([n.x - 90, n.x + 90]);
      for (const n of L.npcs) avoid.push([n.x - 120, n.x + 120]);
      for (const id in L.encounters) { const E = L.encounters[id]; if ((E.boss || E.elite) && E.arena) avoid.push([E.arena[0] - 40, E.arena[1] + 40]); }
      avoid.push([L.start.x - 200, L.start.x + 200]);
      const blocked = (x) => avoid.some(([a, b]) => x > a && x < b) || x < L.bounds[0] + 120 || x > L.bounds[1] - 120;
      const segs = L.solids.map((s) => ({ x0: s.x, x1: s.x + s.w, y: s.y })).concat((L.oneways || []).map((o) => ({ x0: o.x, x1: o.x + o.w, y: o.y })));
      for (const s of segs) {
        if (s.x1 - s.x0 < 140) continue;
        let x = s.x0 + 70 + r() * 300;
        while (x < s.x1 - 70) {
          // only on an exposed top (not under another solid) and away from story spots
          if (!blocked(x) && Math.abs(G.Phys.groundBelow(x, s.y - 60) - s.y) < 2) {
            const kind = th.kinds[Math.floor(r() * th.kinds.length)];
            out.push({ kind, x, y: s.y, hp: KINDS[kind].hp, hitT: 0, dir: 1, broken: false, seed: r() * 100, tint: kind === 'crystal' ? th.crystal : null, flip: r() < 0.5 ? -1 : 1 });
            if (r() < 0.35) { const x2 = x + 40 + r() * 20; if (x2 < s.x1 - 40 && !blocked(x2)) out.push({ kind: th.kinds[Math.floor(r() * th.kinds.length)], x: x2, y: s.y, hp: 1, hitT: 0, dir: 1, broken: false, seed: r() * 100, tint: th.crystal, flip: 1, small: true }); }
          }
          x += 560 + r() * 520;
        }
      }
      for (const b of out) if (b.small) b.hp = KINDS[b.kind].hp;
      this.list = out;
    },
    // player melee (Player.doHits) asks: did this swing box touch a breakable?
    hit(game, box, dmg, P) {
      for (const b of this.list) {
        if (b.broken || P.hitSet.has(b)) continue;
        const K = KINDS[b.kind], s = b.small ? 0.75 : 1, w = K.w * s, h = K.h * s;
        if (!U.rectsOverlap(box, { x: b.x - w / 2, y: b.y - h, w, h })) continue;
        P.hitSet.add(b);
        b.hp -= 1; b.hitT = 1; b.dir = Math.sign(b.x - P.x) || 1;
        const col = b.tint && b.kind === 'crystal' ? b.tint : K.debris;
        G.FX.spark(b.x, b.y - h / 2, 8, { col: '#fff1d6', speed: 420 });
        G.SFX.play(K.sfx, b.kind === 'crystal' ? false : 1.3);
        if (b.hp <= 0) this.smash(game, b, col, w, h);
        else { game.hitstop(0.03); G.FX.dust(b.x, b.y, 4, { w: 20, speed: 90 }); }
      }
    },
    smash(game, b, col, w, h) {
      b.broken = true;
      G.FX.shards(b.x, b.y - h / 2, b.kind === 'crystal' ? 18 : 12, col, 520);
      G.FX.dust(b.x, b.y, 10, { w: w, speed: 180, size: 10 });
      if (b.kind === 'crystal') { G.FX.ring(b.x, b.y - h / 2, 6, 80, 0.35, col, 4); G.SFX.play('impact'); }
      game.hitstop(0.05); game.shake(0.15);
      // rewards: always a few shards, sometimes a smithing stone, rarely a piece of gear
      const ch = G.Abyss.lootCh(), gt = game.player.gear || {};
      const n = Math.round((5 + Math.random() * 6 + ch * 2) * (b.kind === 'crystal' ? 1.6 : 1) * (1 + (gt.shard || 0)));
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2, v = 200 + Math.random() * 240;
        game.pickups.push({ kind: 'shard', x: b.x, y: b.y - h / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, val: n / 4 });
      }
      const src = { cx: b.x, cy: b.y - h / 2, y: b.y };
      if (Math.random() < (b.kind === 'crystal' ? 0.3 : 0.15)) G.Gear.spawnLoot(game, src, { stone: true }, 0, 1);
      if (Math.random() < 0.05 * (1 + (gt.drop || 0) + 0.2 * G.Mirror.lv('fortune'))) G.Gear.spawnLoot(game, src, G.Gear.roll(ch, 0, gt.drop || 0), 0, 1);
      if (b.kind === 'crystal' && Math.random() < 0.1) G.Mirror.gain(1);
    },
    update(dt) { for (const b of this.list) if (b.hitT > 0) b.hitT = Math.max(0, b.hitT - dt * 5); },
    draw(ctx, cam, t) {
      const vx0 = cam.x - 1400, vx1 = cam.x + 1400;
      for (const b of this.list) {
        if (b.broken || b.x < vx0 || b.x > vx1) continue;
        const K = KINDS[b.kind], s = b.small ? 0.75 : 1, w = K.w * s, h = K.h * s;
        ctx.save(); ctx.translate(b.x, b.y);
        if (b.hitT > 0) { ctx.rotate(Math.sin(b.hitT * 20) * 0.12 * b.hitT * b.dir); ctx.translate(b.dir * 3 * b.hitT, 0); }
        ctx.scale(b.flip, 1);
        ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = INK;
        // contact shadow
        ctx.fillStyle = 'rgba(10,8,12,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.6, 4, 0, 0, TAU); ctx.fill();
        if (b.kind === 'crate') {
          ctx.fillStyle = K.col; ctx.fillRect(-w / 2, -h, w, h); ctx.strokeRect(-w / 2, -h, w, h);
          ctx.fillStyle = K.lit; ctx.fillRect(-w / 2 + 2, -h + 2, w - 4, 5);
          ctx.fillStyle = K.dark; ctx.fillRect(-w / 2 + 2, -6, w - 4, 4);
          ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-w / 2 + 4, -h + 4); ctx.lineTo(w / 2 - 4, -4); ctx.moveTo(w / 2 - 4, -h + 4); ctx.lineTo(-w / 2 + 4, -4); ctx.strokeStyle = K.dark; ctx.stroke();
          ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.strokeRect(-w / 2, -h, w, h);
        } else if (b.kind === 'barrel') {
          ctx.beginPath(); ctx.moveTo(-w / 2 + 3, 0); ctx.quadraticCurveTo(-w / 2 - 3, -h / 2, -w / 2 + 3, -h); ctx.lineTo(w / 2 - 3, -h); ctx.quadraticCurveTo(w / 2 + 3, -h / 2, w / 2 - 3, 0); ctx.closePath();
          ctx.fillStyle = K.col; ctx.fill(); ctx.stroke();
          ctx.fillStyle = K.lit; ctx.fillRect(-w / 2 + 6, -h + 3, 5, h - 6);
          ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 3;
          for (const yy of [-h * 0.22, -h * 0.78]) { ctx.beginPath(); ctx.moveTo(-w / 2 + 1, yy); ctx.lineTo(w / 2 - 1, yy); ctx.stroke(); }
        } else if (b.kind === 'urn') {
          ctx.beginPath(); ctx.moveTo(-w * 0.22, 0); ctx.bezierCurveTo(-w * 0.62, -h * 0.25, -w * 0.62, -h * 0.7, -w * 0.18, -h * 0.82);
          ctx.lineTo(-w * 0.24, -h); ctx.lineTo(w * 0.24, -h); ctx.lineTo(w * 0.18, -h * 0.82);
          ctx.bezierCurveTo(w * 0.62, -h * 0.7, w * 0.62, -h * 0.25, w * 0.22, 0); ctx.closePath();
          ctx.fillStyle = K.col; ctx.fill(); ctx.stroke();
          ctx.fillStyle = K.lit; ctx.beginPath(); ctx.ellipse(-w * 0.2, -h * 0.5, 3, h * 0.2, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#e2b04f'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-w * 0.45, -h * 0.55); ctx.lineTo(w * 0.45, -h * 0.55); ctx.stroke();
        } else {
          // Hushborn crystal cluster: three shards, a cold inner glow
          const c = b.tint || K.col, sh = [[-w * 0.28, h * 0.62, -0.32], [w * 0.22, h * 0.72, 0.28], [0, h, 0.02]];
          if (K.glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(0, -h * 0.4, 0, 0, -h * 0.4, h * 0.9); gl.addColorStop(0, U.rgba(c, 0.32 + Math.sin(t * 2 + b.seed) * 0.08)); gl.addColorStop(1, U.rgba(c, 0)); ctx.fillStyle = gl; ctx.fillRect(-h, -h * 1.4, h * 2, h * 1.6); ctx.restore(); }
          for (const [ox, hh, a] of sh) {
            ctx.save(); ctx.translate(ox, 0); ctx.rotate(a);
            ctx.beginPath(); ctx.moveTo(-w * 0.16, 0); ctx.lineTo(-w * 0.12, -hh * 0.75); ctx.lineTo(0, -hh); ctx.lineTo(w * 0.12, -hh * 0.75); ctx.lineTo(w * 0.16, 0); ctx.closePath();
            ctx.fillStyle = U.mixHex(c, '#1a0c2e', 0.35); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, -hh); ctx.lineTo(w * 0.12, -hh * 0.75); ctx.lineTo(w * 0.05, -2); ctx.lineTo(0, -2); ctx.closePath(); ctx.fillStyle = U.mixHex(c, '#ffffff', 0.35); ctx.fill();
            ctx.restore();
          }
        }
        // "you can hit this" glint: a small star that blinks now and then
        const gk = (t * 0.6 + b.seed) % 3;
        if (gk < 0.35) {
          const a = Math.sin(gk / 0.35 * Math.PI), gx = w * 0.18, gy = -h * 0.82;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,248,225,${a})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(gx - 6 * a, gy); ctx.lineTo(gx + 6 * a, gy); ctx.moveTo(gx, gy - 6 * a); ctx.lineTo(gx, gy + 6 * a); ctx.stroke(); ctx.restore();
        }
        ctx.restore();
      }
    },
    /* ---------- boss fog gates ---------- */
    gates: [],
    spawnGates(game) {
      const L = G.LEVEL, F = game.save.flags, ch = L.chapter || 1;
      this.gates = [];
      if (G.Abyss.active) return;   // Abyss chambers are their own arenas
      if (F['boss_' + ch] || (ch === 1 && F.boss_dead)) return;   // boss already down: the way stays open
      for (const id in L.encounters) {
        const E = L.encounters[id];
        if (!E.boss || !E.arena) continue;
        const tr = L.triggers.find((t) => t.startEnc === id || t.enc === id);
        const x = Math.min(tr ? tr.x : E.arena[0], E.arena[0]) - 70;
        let y = G.Phys.groundBelow(x, (tr && tr.y != null ? tr.y : 0) - 260);
        if (y > 1e8) y = 0;
        const wall = { x: x - 14, y: y - 1800, w: 28, h: 1800, gate: id, keep: true };
        G.Phys.dyn.push(wall);
        this.gates.push({ id, x, y, wall, open: false, t: 0 });
      }
    },
    openGate(game, g) {
      if (g.open) return;
      // the gatekeeper's toll (js/events.js): from the second gate on, each door asks for something of yours
      const ch = G.LEVEL.chapter || 1, F = game.save.flags;
      if (ch >= 2 && !F['gate_' + ch + '_deal'] && G.Events && !g.asking) { g.asking = true; G.Events.gate(game, ch, () => { g.asking = false; F['gate_' + ch + '_deal'] = true; this.openGate(game, g); }); return; }
      g.open = true; G.Phys.dyn = G.Phys.dyn.filter((w) => w !== g.wall);
      G.SFX.play('door'); G.SFX.play('pylon', 0.6);
      G.FX.ring(g.x, g.y - 160, 10, 220, 0.7, '#ffd9a8', 6); G.FX.ember(g.x, g.y - 180, 40, '#ffd9a8', { w: 50, h: 340, up: 120 });
      const P = game.player; P.vx = Math.sign(g.x + 60 - P.x) * 260;
    },
    drawGates(ctx, t) {
      for (const g of this.gates) {
        g.t += 1 / 60; const a = g.open ? Math.max(0, 1 - g.t * 0) : 1;
        if (g.open) continue;
        const H = 380, x = g.x, y = g.y;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
        gr.addColorStop(0, 'rgba(255,214,160,0)'); gr.addColorStop(0.5, `rgba(255,214,160,${0.32 + 0.06 * Math.sin(t * 2)})`); gr.addColorStop(1, 'rgba(255,214,160,0)');
        ctx.fillStyle = gr; ctx.fillRect(x - 40, y - H, 80, H);
        // drifting light threads, like Elden Ring's fog walls
        ctx.strokeStyle = `rgba(255,236,206,${0.55 * a})`; ctx.lineWidth = 1.5;
        for (let i = 0; i < 7; i++) {
          const ph = t * (0.6 + i * 0.13) + i * 1.7, ox = Math.sin(ph) * 16 + (i - 3) * 5;
          ctx.beginPath(); ctx.moveTo(x + ox, y);
          for (let k = 1; k <= 6; k++) ctx.lineTo(x + ox + Math.sin(ph + k * 0.9) * 10, y - H * k / 6);
          ctx.stroke();
        }
        const top = ctx.createLinearGradient(0, y - H, 0, y - H + 120); top.addColorStop(0, 'rgba(255,214,160,0)'); top.addColorStop(1, 'rgba(255,214,160,0.18)');
        ctx.fillStyle = top; ctx.fillRect(x - 40, y - H, 80, 120);
        ctx.restore();
        if (Math.random() < 0.3) G.FX.ember(x, y - Math.random() * H, 1, '#ffe2b8', { w: 30, h: 10, up: 60 });
      }
    },
    // the warm lip on every surface Rinne can stand on
    drawLedges(ctx, cam, t) {
      const L = G.LEVEL, vx0 = cam.x - 1500, vx1 = cam.x + 1500, vy0 = cam.y - 900, vy1 = cam.y + 900;
      ctx.save(); ctx.lineCap = 'round';
      const lip = (x0, x1, y, oneway) => {
        if (x1 < vx0 || x0 > vx1 || y < vy0 || y > vy1) return;
        const a0 = Math.max(x0, vx0), a1 = Math.min(x1, vx1);
        ctx.strokeStyle = 'rgba(255,236,206,0.22)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(a0 + 2, y + 1); ctx.lineTo(a1 - 2, y + 1); ctx.stroke();
        ctx.strokeStyle = oneway ? 'rgba(255,236,206,0.85)' : 'rgba(255,236,206,0.7)'; ctx.lineWidth = 2.4;
        if (oneway) ctx.setLineDash([14, 7]); else ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(a0 + 2, y); ctx.lineTo(a1 - 2, y); ctx.stroke();
      };
      // exposed spans only (a wall standing on the floor hides that stretch of floor) - computed once per level
      const key = (L.chapter || 1) + ':' + L.solids.length + ':' + (L.oneways || []).length;
      if (this._lk !== key) {
        this._lk = key; this._spans = [];
        const add = (x0, x1, y, ow) => {
          let a = null;
          for (let x = x0 + 10; x <= x1 - 10; x += 20) {
            const ok = Math.abs(G.Phys.groundBelow(x, y - 30) - y) < 2;
            if (ok && a === null) a = x - 10; else if (!ok && a !== null) { this._spans.push([a, x - 10, y, ow]); a = null; }
          }
          if (a !== null) this._spans.push([a, x1, y, ow]);
        };
        for (const s of L.solids) add(s.x, s.x + s.w, s.y, false);
        for (const o of L.oneways || []) add(o.x, o.x + o.w, o.y, true);
      }
      for (const [a, b, y, ow] of this._spans) lip(a, b, y, ow);
      ctx.setLineDash([]); ctx.restore();
    },
  };
})(window.G);

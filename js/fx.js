'use strict';
/* ECHOFALL — VFX: particles, blade ribbons, ghosts, rings, impact flashes, world-space text */
(function (G) {
  const U = G.U;
  const FX = G.FX = {
    parts: [], rings: [], flashes: [], texts: [], slashes: [], ghosts: [], beams: [], nums: [],
    clear() { this.parts.length = 0; this.rings.length = 0; this.flashes.length = 0; this.texts.length = 0; this.slashes.length = 0; this.ghosts.length = 0; this.beams.length = 0; this.nums.length = 0; },
    // damage numbers: inked, punch in, drift up (Hades-style)
    num(x, y, v, kind = 'hit') {
      // numbers landing together stack upward instead of piling on top of each other
      const near = this.nums.filter((n) => n.t < 0.35 && Math.abs(n.x - x) < 70 && Math.abs(n.y - y) < 90).length;
      y -= near * 22;
      this.nums.push({ x: x + (Math.random() - 0.5) * 24, y, v: Math.max(1, Math.round(v)), kind, t: 0, dur: kind === 'crit' ? 0.95 : 0.7, vx: (Math.random() - 0.5) * 60 }); if (this.nums.length > 40) this.nums.shift(); },

    spark(x, y, n, opts = {}) {
      const col = opts.col || '#ffe7b0', sp = opts.speed || 600, dir = opts.dir, spread = opts.spread ?? Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = dir != null ? dir + (Math.random() - 0.5) * spread : Math.random() * Math.PI * 2;
        const v = sp * (0.3 + Math.random() * 0.9);
        this.parts.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: (opts.life || 0.35) * (0.5 + Math.random()), col, w: opts.w || 2, g: opts.g ?? 900, drag: 3 });
      }
    },
    shards(x, y, n, col = '#ff3d7f', sp = 420) {
      const floor = G.Phys ? G.Phys.groundBelow(x, y - 4) - 2 : y + 40;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = sp * (0.3 + Math.random());
        this.parts.push({ k: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.8 + Math.random() * 0.8, col, s: 3 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 20, g: 1300, drag: 0.6, floor: floor });
      }
    },
    dust(x, y, n, opts = {}) {
      for (let i = 0; i < n; i++) {
        const a = opts.dir != null ? opts.dir + (Math.random() - 0.5) * (opts.spread || 1) : -Math.PI / 2 + (Math.random() - 0.5) * 2.8;
        const v = (opts.speed || 120) * (0.3 + Math.random());
        this.parts.push({ k: 'dust', x: x + (Math.random() - 0.5) * (opts.w || 20), y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, life: 0, max: 0.5 + Math.random() * 0.6, s: (opts.size || 10) * (0.6 + Math.random()), col: opts.col || 'rgba(214,190,160,', g: -40, drag: 2.5 });
      }
    },
    ember(x, y, n, col = '#7ff4ff', opts = {}) {
      for (let i = 0; i < n; i++) {
        this.parts.push({ k: 'ember', x: x + (Math.random() - 0.5) * (opts.w || 30), y: y + (Math.random() - 0.5) * (opts.h || 30), vx: (Math.random() - 0.5) * (opts.sp || 80), vy: -30 - Math.random() * (opts.up || 120), life: 0, max: 0.6 + Math.random() * (opts.life || 1), s: 1 + Math.random() * 2.2, col, g: -20, drag: 1 });
      }
    },
    ring(x, y, r0, r1, dur, col = '#ffffff', w = 4, opts = {}) { this.rings.push({ x, y, r0, r1, dur, t: 0, col, w, flat: opts.flat || 1 }); },
    flash(x, y, r, dur, col = '#ffffff') { this.flashes.push({ x, y, r, dur, t: 0, col }); },
    star(x, y, col, size = 40, dur = 0.35) { this.flashes.push({ x, y, r: size, dur, t: 0, col, star: true }); },
    text(x, y, str, col = '#fff', size = 22, dur = 0.9) { this.texts.push({ x, y, str, col, size, dur, t: 0 }); },
    // static slash mark (for skill / execution)
    slashMark(x, y, ang, len, col = '#bff8ff', dur = 0.35, w = 10) { this.slashes.push({ x, y, ang, len, col, dur, t: 0, w }); },
    beam(x1, y1, x2, y2, col = '#bff8ff', dur = 0.3, w = 14) { this.beams.push({ x1, y1, x2, y2, col, dur, t: 0, w }); },
    ghost(snap, col = '#6ff3ff', dur = 0.35, alpha = 0.5) { this.ghosts.push({ snap, col, dur, t: 0, alpha }); },

    update(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life += dt;
        if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
        p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt);
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.k === 'shard') { p.r += p.vr * dt; if (p.y > p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; } }
      }
      const step = (arr) => { for (let i = arr.length - 1; i >= 0; i--) { arr[i].t += dt; if (arr[i].t >= arr[i].dur) arr.splice(i, 1); } };
      step(this.rings); step(this.flashes); step(this.texts); step(this.slashes); step(this.ghosts); step(this.beams); step(this.nums);
      for (const n of this.nums) n.x += n.vx * dt;
      const cap = G.Quality && G.Quality.low ? 350 : 900;
      if (this.parts.length > cap) this.parts.splice(0, this.parts.length - cap);
    },

    drawBack(ctx) {
      // ghosts behind the player
      for (const g of this.ghosts) {
        const k = 1 - g.t / g.dur;
        G.Rig.drawGhost(ctx, g.snap, g.col, g.alpha * k);
      }
    },
    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.parts) {
        const k = 1 - p.life / p.max;
        if (p.k === 'spark') {
          ctx.strokeStyle = U.rgba(p.col, k); ctx.lineWidth = p.w * (0.5 + k * 0.5);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
        } else if (p.k === 'ember') {
          ctx.fillStyle = U.rgba(p.col, k * 0.9);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const p of this.parts) {
        const k = 1 - p.life / p.max;
        if (p.k === 'shard') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
          ctx.fillStyle = U.rgba('#120c16', Math.min(1, k * 2));
          ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(p.s * 0.4, 0); ctx.lineTo(0, p.s * 0.6); ctx.lineTo(-p.s * 0.4, 0); ctx.fill();
          ctx.fillStyle = U.rgba(p.col, k * 0.9);
          ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(p.s * 0.4, 0); ctx.lineTo(0, -p.s * 0.1); ctx.fill();
          ctx.restore();
        } else if (p.k === 'dust') {
          ctx.fillStyle = p.col + (k * 0.35) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1.4 - k * 0.6), 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const r of this.rings) {
        const k = r.t / r.dur, e = U.easeOutCubic(k);
        ctx.strokeStyle = U.rgba(r.col, (1 - k) * 0.9); ctx.lineWidth = r.w * (1 - k) + 0.5;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, (r.r0 + (r.r1 - r.r0) * e) * r.flat, 0, 0, Math.PI * 2); ctx.stroke();
      }
      for (const f of this.flashes) {
        const k = f.t / f.dur;
        if (f.star) {
          const s = f.r * (k < 0.3 ? U.easeOutBack(k / 0.3) : 1 - (k - 0.3) / 0.7);
          ctx.fillStyle = U.rgba(f.col, 0.95);
          ctx.beginPath(); ctx.moveTo(f.x - s, f.y); ctx.lineTo(f.x, f.y - s * 0.08); ctx.lineTo(f.x + s, f.y); ctx.lineTo(f.x, f.y + s * 0.08); ctx.fill();
          ctx.beginPath(); ctx.moveTo(f.x, f.y - s * 0.6); ctx.lineTo(f.x + s * 0.06, f.y); ctx.lineTo(f.x, f.y + s * 0.6); ctx.lineTo(f.x - s * 0.06, f.y); ctx.fill();
          const rg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, s * 0.5);
          rg.addColorStop(0, U.rgba(f.col, 0.8)); rg.addColorStop(1, U.rgba(f.col, 0));
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(f.x, f.y, s * 0.5, 0, Math.PI * 2); ctx.fill();
        } else {
          const rg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
          rg.addColorStop(0, U.rgba(f.col, (1 - k) * 0.9)); rg.addColorStop(0.3, U.rgba(f.col, (1 - k) * 0.35)); rg.addColorStop(1, U.rgba(f.col, 0));
          ctx.fillStyle = rg; ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
        }
      }
      for (const s of this.slashes) {
        const k = s.t / s.dur, e = U.easeOutExpo(Math.min(1, k * 3));
        const dx = Math.cos(s.ang), dy = Math.sin(s.ang);
        const l = s.len * e, wd = s.w * (1 - k);
        ctx.fillStyle = U.rgba(s.col, 1 - k);
        ctx.beginPath();
        ctx.moveTo(s.x - dx * l / 2, s.y - dy * l / 2);
        ctx.lineTo(s.x - dy * wd, s.y + dx * wd);
        ctx.lineTo(s.x + dx * l / 2, s.y + dy * l / 2);
        ctx.lineTo(s.x + dy * wd * 0.3, s.y - dx * wd * 0.3);
        ctx.fill();
      }
      for (const b of this.beams) {
        const k = b.t / b.dur;
        ctx.strokeStyle = U.rgba(b.col, (1 - k) * 0.4); ctx.lineWidth = b.w * (1 + k * 2);
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.strokeStyle = U.rgba('#ffffff', 1 - k); ctx.lineWidth = b.w * 0.25 * (1 - k);
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      }
      ctx.restore();
      for (const n of this.nums) {
        const k = n.t / n.dur, pop = k < 0.12 ? 0.6 + k / 0.12 * 0.8 : 1.4 - Math.min(0.4, (k - 0.12) * 2);
        const crit = n.kind === 'crit', size = crit ? 34 : n.kind === 'boon' ? 20 : 24;
        ctx.save(); ctx.translate(n.x, n.y - U.easeOutCubic(k) * 46); ctx.scale(pop, pop * (G.textFlip || 1));
        ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        ctx.font = `${crit ? 'italic ' : ''}700 ${size}px Rajdhani, sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        ctx.lineWidth = crit ? 7 : 5; ctx.strokeStyle = '#0b0612'; ctx.strokeText(String(n.v) + (crit ? '!' : ''), 0, 0);
        ctx.fillStyle = crit ? '#ffb347' : n.kind === 'boon' ? '#d9f6ff' : '#fff6e6'; ctx.fillText(String(n.v) + (crit ? '!' : ''), 0, 0);
        ctx.restore();
      }
      for (const t of this.texts) {
        const k = t.t / t.dur;
        ctx.save();
        ctx.globalAlpha = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
        ctx.font = `700 ${t.size}px Rajdhani, "Noto Sans TC", sans-serif`; ctx.textAlign = 'center';
        ctx.fillStyle = t.col; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b0612';
        if ((G.textFlip || 1) < 0) { ctx.save(); ctx.translate(t.x, t.y - k * 30); ctx.scale(1, -1); ctx.strokeText(t.str, 0, 0); ctx.restore(); } else ctx.strokeText(t.str, t.x, t.y - k * 30);
        if ((G.textFlip || 1) < 0) { ctx.translate(t.x, t.y - k * 30); ctx.scale(1, -1); ctx.fillText(t.str, 0, 0); } else ctx.fillText(t.str, t.x, t.y - k * 30);
        ctx.restore();
      }
    },
  };

  /* -------- Blade ribbon trail (sampled from the real blade motion) -------- */
  class Trail {
    constructor(max = 14) { this.pts = []; this.max = max; }
    push(bx, by, tx, ty, t) { this.pts.push({ bx, by, tx, ty, t }); if (this.pts.length > this.max) this.pts.shift(); }
    clear() { this.pts.length = 0; }
    age(now, life) { while (this.pts.length && now - this.pts[0].t > life) this.pts.shift(); }
    draw(ctx, now, life, col = '#7ff4ff', core = '#ffffff') {
      const p = this.pts; if (p.length < 3) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < p.length; i++) {
          const a = p[i - 1], b = p[i];
          const ka = 1 - (now - a.t) / life, kb = 1 - (now - b.t) / life;
          if (kb <= 0) continue;
          const inner = pass === 0 ? 0.0 : 0.55;
          const lerp = (q, s) => [q.bx + (q.tx - q.bx) * s, q.by + (q.ty - q.by) * s];
          const a0 = lerp(a, inner + (1 - inner) * (1 - Math.max(ka, 0)) * 0.6), b0 = lerp(b, inner + (1 - inner) * (1 - kb) * 0.6);
          ctx.fillStyle = pass === 0 ? U.rgba(col, Math.max(0, kb) * 0.45) : U.rgba(core, Math.max(0, kb) * 0.85);
          ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a.tx, a.ty); ctx.lineTo(b.tx, b.ty); ctx.lineTo(b0[0], b0[1]); ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }
  }
  G.Trail = Trail;
})(window.G);

'use strict';
/* ECHOFALL — Hushborn: Murmur, Hollow Sentinel, Shrieker, Graves (elite), Maestrina (boss), projectiles */
(function (G) {
  const U = G.U, PI = Math.PI, TAU = PI * 2, Rig = G.Rig;
  const HUSH = '#ff3d7f', CRIM = '#ff2a5f', VIO = '#c9a2ff';
  const TYPES = G.ENEMY_TYPES = {};

  /* =========================== BASE =========================== */
  class Enemy {
    constructor(type, x, y, opts = {}) {
      const T = TYPES[type]; this.T = T; this.type = type;
      this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.w = T.w; this.h = T.h; this.facing = -1;
      const d = G.game.diff;
      this.maxHp = Math.round(T.hp * d.hp); this.hp = this.maxHp; this.maxBal = T.bal; this.bal = 0; this.balT = 0;
      this.state = 'spawn'; this.st = 0; this.t = Math.random() * 10; this.cd = 0.9 + Math.random() * 0.6;
      this.flash = 0; this.atk = null; this.hitsDone = {}; this.tellsDone = {}; this.evDone = {};
      this.fly = !!T.fly; this.boss = !!T.boss; this.elite = !!T.elite; this.enc = opts.enc; this.homeY = y;
      this.pose = null; this.dead = false; this.remove = false; this.showBar = 0; this.tellCol = null; this.tellT = 0;
      this.speedMul = 1; this.phase = 1;
      T.init && T.init(this);
    }
    get box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
    get cx() { return this.x; }
    get cy() { return this.y - this.h / 2; }
    get P() { return G.game.player; }
    setState(s) { this.state = s; this.st = 0; }
    faceP() { this.facing = this.P.x < this.x ? -1 : 1; }
    dxP() { return this.P.x - this.x; }
    distP() { return Math.abs(this.P.x - this.x); }
    boxW(b) { return this.facing > 0 ? { x: this.x + b.x, y: this.y + b.y, w: b.w, h: b.h } : { x: this.x - b.x - b.w, y: this.y + b.y, w: b.w, h: b.h }; }
    startAtk(def) {
      this.atk = def; this.setState('atk'); this.hitsDone = {}; this.tellsDone = {}; this.evDone = {}; def.onStart && def.onStart(this);
      if (this.T.voice && Math.abs(this.x - this.P.x) < 900) this.T.voice(this);
    }
    tell(color, pos) {
      const p = pos || (this.T.weapon ? this.T.weapon(this) : { x: this.x + this.facing * 20, y: this.y - this.h * 0.7 });
      const red = color === 'red';
      G.FX.star(p.x, p.y, red ? CRIM : '#ffffff', red ? 70 : 52, red ? 0.5 : 0.38);
      if (red) G.FX.flash(p.x, p.y, 90, 0.45, CRIM);
      G.SFX.play(red ? 'tellRed' : 'tellWhite');
      this.tellCol = color; this.tellT = 0.5;
    }
    runAtk(dt) {
      const a = this.atk, t = this.st;
      (a.tells || []).forEach((tl, i) => { if (!this.tellsDone[i] && t >= tl.t) { this.tellsDone[i] = true; if (tl.face !== false) this.faceP(); this.tell(tl.c); } });
      (a.ev || []).forEach((ev, i) => { if (!this.evDone[i] && t >= ev.t) { this.evDone[i] = true; ev.fn(this); } });
      let moving = false;
      for (const m of a.moves || []) if (t >= m.t0 && t <= m.t1) { this.vx = this.facing * m.v * this.speedMul; moving = true; }
      // a committed melee swing must reach: during the wind-up the attacker steps in until the target sits inside
      // the coming hitbox (so the blow lands — and can be guarded or parried — instead of whiffing in front of you)
      if (!moving && !this.fly && a.track !== false) {
        const k = (a.hits || []).findIndex((h, i) => !this.hitsDone[i] && t < h.t0);
        const h = k >= 0 ? a.hits[k] : null;
        if (h && h.t0 - t < (a.trackWin ?? 0.55)) {
          const P = this.P, dx = P.x - this.x;
          if (Math.sign(dx) === this.facing && Math.abs(P.y - this.y) < 160) {
            const reach = h.box.x + h.box.w + P.w / 2;
            const gap = Math.abs(dx) - reach * 0.72;
            if (gap > 0) { this.vx = this.facing * Math.min(a.trackSpeed ?? 340, gap / Math.max(0.1, h.t0 - t)) * this.speedMul; moving = true; }
          }
        }
      }
      if (!moving && !this.fly) this.vx = U.approach(this.vx, 0, 2400 * dt);
      (a.hits || []).forEach((h, i) => {
        if (this.hitsDone[i] || t < h.t0 || t > h.t1) return;
        const bw = this.boxW(h.box);
        if (U.rectsOverlap(bw, this.P.hurtbox)) {
          this.hitsDone[i] = true;
          const res = this.P.receiveHit(this, { dmg: h.dmg, unblockable: h.red, kb: h.kb ?? 260, hx: bw.x + bw.w / 2, hy: bw.y + bw.h / 2 });
          if (res === 'parried') this.onParried(h);
          else if (res === 'blocked') { this.vx = -this.facing * 120; }
        }
      });
      if (t >= a.dur) { this.atk = null; this.setState('idle'); this.cd = (a.cd ?? 1) / G.game.diff.aggr * U.rand(0.8, 1.25); }
    }
    onParried(h) {
      this.bal = Math.min(this.maxBal, this.bal + (h.pbal ?? h.dmg * 1.8)); this.balT = 0; this.showBar = 3;
      this.flash = 0.6;
      if (this.bal >= this.maxBal) { this.breakBalance(); return; }
      const interrupt = (!this.boss && !this.elite) || h.last;
      if (interrupt) { this.atk = null; this.setState('recoil'); this.vx = -this.facing * 220; }
    }
    breakBalance() {
      this.atk = null; this.setState('broken'); this.vx = -this.facing * 160;
      G.FX.ring(this.cx, this.cy, 10, 120, 0.5, '#ffd27a', 6);
      G.FX.star(this.cx, this.cy - 20, '#ffd27a', 90, 0.5);
      G.SFX.play('parry', false);
      G.game.onBalanceBreak(this);
    }
    takeHit(h) {
      if (this.dead || this.state === 'spawn' || this.state === 'executed' || this.invuln) return false;
      // shields / frontal guards: T.guard(e, h) returns true to deflect the blow entirely
      if (this.T.guard && this.T.guard(this, h)) {
        G.FX.spark(h.hx ?? this.cx, h.hy ?? this.cy, 10, { col: '#ffffff', speed: 520 }); G.SFX.play('parry', false); G.game.hitstop(0.04);
        return false;
      }
      const dmg = h.dmg;
      this.hp -= dmg; this.flash = 1; this.showBar = 3;
      if (this.state !== 'broken') { this.bal = Math.min(this.maxBal, this.bal + h.bal); this.balT = 0; }
      const fx = h.hx ?? this.cx, fy = h.hy ?? this.cy;
      G.FX.spark(fx, fy, h.big ? 22 : 12, { col: '#fff1d6', speed: h.big ? 900 : 650, dir: h.dir ?? (this.P.facing > 0 ? 0 : PI), spread: 2.2 });
      G.FX.shards(fx, fy, h.big ? 8 : 4, this.T.col || HUSH, 380);
      G.FX.flash(fx, fy, h.big ? 80 : 50, 0.14, '#ffffff');
      G.FX.num(fx, fy - 26, dmg, h.crit ? 'crit' : h.boon ? 'boon' : 'hit');
      if (this.T.onHit) this.T.onHit(this, h);
      if (this.hp <= 0) { this.die(); return true; }
      if (this.bal >= this.maxBal && this.state !== 'broken') { this.breakBalance(); return true; }
      // every hit reads on the body: a recoil kick + shake (visual), even when the enemy keeps attacking
      this.hitT = 0; this.hitPow = h.big ? 1 : 0.65; this.hitDir = Math.sign(h.kbx ?? this.P.facing) || 1;
      if (this.state === 'broken') return true;
      // stagger rules: fodder always flinches; armoured foes flinch unless mid-swing, and heavy blows
      // break their wind-up; elites/bosses only stumble from heavy blows while not attacking
      const winding = this.state === 'atk' && this.atk && !this.inActiveFrames();
      const canFlinch = (!this.boss && !this.elite && (!(this.T.poise && this.state === 'atk') || (h.big && winding)))
        || ((this.boss || this.elite) && h.big && this.state === 'idle');
      if (canFlinch) {
        this.atk = null; this.setState('hurt');
        this.hurtDur = (this.boss || this.elite) ? 0.28 : h.big ? 0.6 : 0.36;
        this.vx = (h.kbx ?? this.P.facing * 160) * (this.T.kbMul ?? 1) * (this.boss || this.elite ? 0.4 : 1);
        if (h.launch && !this.fly && !this.boss && !this.elite) this.vy = -380;
      }
      return true;
    }
    inActiveFrames() { return !!(this.atk && (this.atk.hits || []).some((x) => this.st >= x.t0 - 0.05 && this.st <= x.t1)); }
    die() {
      this.dead = true; this.hp = 0; this.setState('die'); this.atk = null;
      G.FX.shards(this.cx, this.cy, this.boss ? 60 : 24, this.T.col || HUSH, 600);
      G.FX.ring(this.cx, this.cy, 10, this.boss ? 400 : 140, 0.6, this.T.col || HUSH, 5);
      G.FX.ember(this.cx, this.cy, 20, this.T.col || HUSH, { w: this.w, h: this.h });
      G.SFX.play('enemyDie');
      G.game.onEnemyDeath(this);
    }
    update(dt) {
      this.t += dt; this.st += dt; this.hitT = (this.hitT ?? 9) + dt;
      this.flash = Math.max(0, this.flash - dt * 4);
      this.showBar = Math.max(0, this.showBar - dt);
      this.tellT = Math.max(0, this.tellT - dt);
      this.balT += dt;
      if (this.balT > 2.2 && this.state !== 'broken') this.bal = Math.max(0, this.bal - this.maxBal * 0.12 * dt);
      if (this.state === 'die') { if (this.st > 0.5) this.remove = true; return; }
      if (this.state === 'executed') { this.vx = 0; this.vy = 0; return; }
      if (this.state === 'broken') {
        this.vx = U.approach(this.vx, 0, 600 * dt);
        if (this.st > (this.boss ? 4.5 : 3.2)) { this.bal = 0; this.setState('idle'); this.cd = 0.4; }
      } else if (this.state === 'spawn') {
        if (this.st > (this.T.spawnT || 0.7)) this.setState('idle');
      } else if (this.state === 'recoil') {
        this.vx = U.approach(this.vx, 0, 900 * dt);
        if (this.st > (this.boss ? 0.6 : 0.5)) { this.setState('idle'); this.cd = 0.3; }
      } else if (this.state === 'hurt') {
        this.vx = U.approach(this.vx, 0, 900 * dt);
        if (this.st > (this.hurtDur || 0.36)) { this.setState('idle'); this.cd = Math.max(this.cd, 0.25); }
      } else if (this.state === 'atk' && this.atk) {
        this.runAtk(dt);
        // the attack may have just ended inside runAtk — only attacks still running get their per-frame update
        if (this.atk && this.T.atkUpdate) this.T.atkUpdate(this, dt);
      } else {
        this.cd -= dt;
        this.T.think(this, dt);
      }
      if (!this.fly) { this.vy = Math.min(this.vy + 2400 * (G.LEVEL.gravity || 1) * dt, 1400); }
      else if (!this.boss && this.state !== 'atk' && this.state !== 'idle') this.vy *= Math.exp(-6 * dt);
      G.Phys.move(this, dt);
      // stay inside arena
      const ar = G.game.arena;
      if (ar && this.enc === ar.id) this.x = U.clamp(this.x, ar.x0 + 30, ar.x1 - 30);
    }
    // 0..1 strength of the hit reaction (decays over ~0.3 s)
    get hitK() { const t = this.hitT ?? 9; return t < 0.3 ? Math.pow(1 - t / 0.3, 2) * (this.hitPow || 0.6) : 0; }
    draw(ctx) {
      ctx.save();
      const k = this.hitK;
      if (k > 0) {
        // knocked back along the blow, a short shake, and a squash on impact
        const shake = (Math.random() - 0.5) * 5 * k;
        ctx.translate(this.hitDir * 9 * k + shake, (Math.random() - 0.5) * 2 * k);
        const sq = 0.1 * k;
        ctx.translate(this.x, this.y); ctx.scale(1 + sq, 1 - sq); ctx.translate(-this.x, -this.y);
      }
      this.T.draw(ctx, this);
      ctx.restore();
      // impact frame: the enemy's exact silhouette flashes white for a few frames (a second pass through a
      // brightness(0)+invert filter turns every fill pure white while keeping the shape's alpha)
      const wf = Math.max(0, this.flash - 0.45) / 0.55;
      if (wf > 0 && FILTER_OK && !this.dead) {
        ctx.save();
        ctx.filter = 'brightness(0) invert(1)'; ctx.globalAlpha = Math.min(1, wf * 1.15);
        // the second pass must not advance animation/cloth or spawn particles twice
        const keep = G.FX.parts.length, dtv = G.game.dtVis; G.game.dtVis = 0;
        if (k > 0) { ctx.translate(this.hitDir * 9 * k, 0); ctx.translate(this.x, this.y); ctx.scale(1 + 0.1 * k, 1 - 0.1 * k); ctx.translate(-this.x, -this.y); }
        this.T.draw(ctx, this, true);
        G.game.dtVis = dtv; G.FX.parts.length = Math.min(G.FX.parts.length, keep);
        ctx.restore();
      }
    }
  }
  G.Enemy = Enemy;
  const FILTER_OK = (() => { try { const c = document.createElement('canvas').getContext('2d'); return 'filter' in c; } catch (e) { return false; } })();

  // smooth pose blend toward a target pose
  function blendPose(e, target, dt, k = 18) {
    const full = Rig.full(target);
    if (!e.pose) { e.pose = full; return; }
    e.pose = Rig.lerpPose(e.pose, full, 1 - Math.exp(-k * dt));
  }
  function glow(ctx, x, y, r, col, a = 0.6) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, U.rgba(col, a)); g.addColorStop(1, U.rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function emerge(ctx, e) {
    if (e.state !== 'spawn') return 0;
    const k = U.clamp(e.st / (e.T.spawnT || 0.7), 0, 1);
    if (Math.random() < 0.5) G.FX.ember(e.x, e.y - 4, 1, e.T.col || HUSH, { w: e.w, h: 6, up: 60 });
    return (1 - U.easeOutCubic(k));
  }
  function flashOver(ctx, e, draw) {
    // where canvas filters exist the silhouette flash in Enemy.draw replaces this soft blob
    if (e.flash <= 0 || FILTER_OK) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = e.flash * 0.7; draw(); ctx.restore();
  }

  /* =========================== MURMUR =========================== */
  TYPES.murmur = {
    name: '囈蟲', w: 62, h: 36, hp: 34, bal: 30, col: '#d64dff', shards: 14, kbMul: 1.2, spawnT: 0.6,
    voice: () => { G.SFX.play('skitter'); G.SFX.play('hiss'); },
    weapon: (e) => ({ x: e.x + e.facing * 38, y: e.y - 20 }),
    think(e, dt) {
      e.faceP();
      const d = e.distP(), T = TYPES.murmur;
      if (d > 230) e.vx = U.approach(e.vx, e.facing * 210 * e.speedMul, 1400 * dt);
      else if (d < 120) e.vx = U.approach(e.vx, -e.facing * 120, 1400 * dt);
      else e.vx = U.approach(e.vx, 0, 1400 * dt);
      if (e.cd > 0) return;
      // crowd it and it snaps; give it room and it pounces
      if (d < 100 && Math.abs(e.P.y - e.y) < 70) e.startAtk(T.snap);
      else if (d < 290) e.startAtk(T.leap);
    },
    // white: coils, then pounces at where you stand (arc length fitted to the distance, up to ~240 px) — the tell leads
    // the first active frame by 0.51 s
    leap: {
      dur: 1.32, cd: 1.6, track: false, tells: [{ t: 0.12, c: 'white' }],
      ev: [{ t: 0.6, fn: (e) => { e.leapV = U.clamp((e.distP() - 30) / 0.39, 240, 620) * e.speedMul; e.vy = -470; e.vx = e.facing * e.leapV; G.SFX.play('whoosh', 0.7); } }],
      hits: [{ t0: 0.63, t1: 1.0, box: { x: 0, y: -40, w: 52, h: 38 }, dmg: 11, kb: 220, last: true, pbal: 30 }],
    },
    // white: rears up with the sickles spread, then lunges a half-step and scissors them shut
    snap: {
      dur: 1.05, cd: 1.3, track: false, tells: [{ t: 0.1, c: 'white' }],
      moves: [{ t0: 0.56, t1: 0.66, v: 300 }],
      hits: [{ t0: 0.58, t1: 0.7, box: { x: 6, y: -38, w: 54, h: 36 }, dmg: 9, kb: 180, last: true, pbal: 30 }],
      ev: [{ t: 0.56, fn: () => { G.SFX.play('whoosh', 1.35); G.SFX.play('skitter'); } }],
    },
    atkUpdate(e) {
      if (e.atk !== TYPES.murmur.leap || e.st < 0.6) return;
      // hold the pounce speed through the flight (runAtk brakes any un-scripted motion), skid to a stop on landing
      if (!e.onGround && e.st < 1.05) e.vx = e.facing * (e.leapV || 560);
      else if (e.st > 0.7) e.vx = U.approach(e.vx, 0, 60);
    },
    // 囈蟲: an armoured, many-legged scavenger — overlapping shell plates studded with Hush crystal, a bone face-plate,
    // sickle mandibles and twitching feelers. Coils before the leap, flips onto its back when its balance breaks.
    draw(ctx, e, ghost) {
      const dt = G.game.dtVis, t = e.t, st = e.st;
      const sink = emerge(ctx, e) * 40;
      const dying = e.state === 'die' ? U.clamp(st / 0.5, 0, 1) : 0;
      const atk = e.state === 'atk', leap = atk && e.atk === TYPES.murmur.leap, snap = atk && e.atk === TYPES.murmur.snap;
      const coil = leap && st < 0.6 ? U.easeOutCubic(U.clamp(st / 0.45, 0, 1)) : 0;
      // snap: rears up (nose high, sickles spread) → drives the head forward and down → settles
      const rearUp = snap ? (st < 0.56 ? U.easeOutCubic(U.clamp(st / 0.4, 0, 1)) : U.clamp(1 - (st - 0.56) / 0.08, 0, 1)) : 0;
      const thrust = snap && st >= 0.56 ? (st < 0.64 ? (st - 0.56) / 0.08 : U.clamp(1 - (st - 0.7) / 0.35, 0, 1)) : 0;
      const air = !e.onGround && !dying ? 1 : 0;
      const splay = leap && st >= 0.66 && e.onGround ? U.clamp(1 - (st - 0.86) / 0.35, 0, 1) : 0;
      const broken = e.state === 'broken' || e.state === 'executed';
      const moving = Math.abs(e.vx) > 20 && e.onGround && !atk;
      const rear = Math.max(e.hitK, e.state === 'hurt' || e.state === 'recoil' ? Math.sin(Math.min(1, st / (e.hurtDur || 0.36)) * PI) : 0);
      if (dt > 0) e.gait = (e.gait || 0) + dt * (moving ? Math.abs(e.vx) * 0.075 : broken ? 14 : 1.6);
      const gait = e.gait || 0;
      ctx.globalAlpha *= 1 - dying * dying;
      ctx.translate(e.x, e.y + sink + dying * 5); ctx.scale(e.facing, 1);
      if (broken) { ctx.translate(0, -49); ctx.scale(1, -1); ctx.rotate(Math.sin(t * 5) * 0.08); }
      ctx.translate(-30, -14); ctx.rotate(-0.42 * rear + (air ? U.clamp(-e.vy / 900, -0.4, 0.45) : 0) - coil * 0.12 - rearUp * 0.34 + thrust * 0.12); ctx.translate(30, 14);
      ctx.translate(0, coil * 5 + (moving ? Math.abs(Math.sin(gait * 2)) * -1.5 : 0));
      const INK = Rig.INK, shell = '#4a3658', crys = '#f3b4ff', crysD = '#8f3cc0', ACC = '#d64dff';
      const tellK = e.tellT > 0 ? e.tellT : 0;
      // legs: [hipX, footX] — the far row first (darker, thin strokes), the near row after the body
      const legs = [[-20, -30], [-3, -6], [14, 20]];
      const legPts = (i, far) => {
        const [hx, fx0] = legs[i], ph = gait + i * 2.1 + (far ? PI : 0);
        const hip = { x: hx + (far ? 3 : 0), y: -13 + coil * 2 };
        let fx = fx0 + (moving ? Math.cos(ph) * 8 : 0) + (far ? 3 : 0) + coil * (i - 1) * 3 + splay * (i - 1) * 6, fy = moving ? -Math.max(0, Math.sin(ph)) * 7 : 0;
        if (air) { fx = hx - 12 + i * 2; fy = -4 - i; }
        if (broken) { fx = fx0 + Math.sin(t * 19 + i * 2 + (far ? 1 : 0)) * 6; fy = -8 + Math.cos(t * 23 + i) * 4; }
        const knee = { x: (hip.x + fx) / 2 + (i - 1) * 7 + 1, y: Math.min(hip.y, fy) - 17 - coil * 5 + splay * 5 };
        return [hip, knee, { x: fx, y: fy }];
      };
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        const [a, b, c] = legPts(i, true);
        ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.stroke();
        ctx.strokeStyle = '#2a2033'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      // tail: a stinger of crystal
      const sw = Math.sin(t * 2.4) * 0.12 + coil * 0.5;
      ctx.save(); ctx.translate(-36, -16); ctx.rotate(-0.25 - sw);
      ctx.beginPath(); ctx.moveTo(2, -5); ctx.quadraticCurveTo(-8, -6, -14, -1); ctx.quadraticCurveTo(-8, 3, 2, 4); ctx.closePath();
      ctx.fillStyle = Rig.celGrad(ctx, -5, -1, 0, -1, 6, 1, Rig.ramp(shell)); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      const stg = () => { ctx.beginPath(); ctx.moveTo(-12, -2.5); ctx.lineTo(-22, -1 - coil * 4); ctx.lineTo(-12, 1.5); ctx.closePath(); };
      stg(); ctx.fillStyle = crysD; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-12, -2.5); ctx.lineTo(-22, -1 - coil * 4); ctx.lineTo(-13, 0); ctx.closePath(); ctx.fillStyle = crys; ctx.fill();
      stg(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore();
      // shell plates (tail → head), each overlapping the one behind it
      const segs = [[-29, -17, 9, 8], [-18, -21, 11, 11], [-4, -24, 13, 13], [11, -24, 12.5, 12.5], [24, -21, 10, 10]];
      const shellG = Rig.celGrad(ctx, 0, -25, 0, -1, 15, 1, Rig.ramp(shell));
      const sq = 1 - coil * 0.16 + (air ? 0.1 : 0);
      const P = segs.map(([x, y, rx, ry], i) => {
        const br = Math.sin(t * 3 - i * 0.8) * 0.9, sep = dying * (i - 2) * 7;
        return [x * sq + sep, y + br - coil * (i < 2 ? 6 - i * 2 : 0) + dying * Math.sin(i * 2.3) * 6, rx, ry];
      });
      for (let i = 0; i < P.length; i++) {
        const [x, y, rx, ry] = P[i];
        ctx.beginPath(); ctx.moveTo(x - rx, y + ry * 0.55);
        ctx.quadraticCurveTo(x - rx * 1.05, y - ry * 1.05, x + rx * 0.1, y - ry);
        ctx.quadraticCurveTo(x + rx * 1.1, y - ry * 0.9, x + rx, y + ry * 0.55);
        ctx.quadraticCurveTo(x, y + ry * 0.9, x - rx, y + ry * 0.55); ctx.closePath();
        ctx.fillStyle = shellG; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
        // lit rim on the upper-front edge + a dark growth band on the trailing edge
        ctx.strokeStyle = 'rgba(255,214,190,0.42)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(x + 1, y - 1, rx * 0.78, ry * 0.8, 0, -PI * 0.78, -PI * 0.18); ctx.stroke();
        ctx.strokeStyle = 'rgba(14,4,22,0.55)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(x + 2.5, y + 1, rx * 0.86, ry * 0.88, 0, PI * 0.9, PI * 1.25); ctx.stroke();
      }
      // crystal crest along the spine — flares while it coils
      const flare = 0.45 + coil * 0.55 + tellK * 0.5 + 0.12 * Math.sin(t * 4);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, P[2][0], P[2][1] - 16, 22 + coil * 12, ACC, 0.32 * flare); ctx.restore();
      const spikes = [[1, -2, 9, -0.55], [1, 4, 6, -0.2], [2, -5, 15, -0.32], [2, 3, 11, 0.05], [3, -2, 13, -0.12], [3, 6, 8, 0.3], [0, 0, 6, -0.7]];
      for (const [si, ox, len, ang] of spikes) {
        const [x, y, , ry] = P[si], bx = x + ox, by = y - ry * 0.85, L = len * (1 + coil * 0.25), a = ang - coil * 0.15;
        const ux = Math.sin(a), uy = -Math.cos(a);
        const sp = () => { ctx.beginPath(); ctx.moveTo(bx - 3, by + 1); ctx.lineTo(bx + ux * L * 0.6 - 2.6 * uy, by + uy * L * 0.6); ctx.lineTo(bx + ux * L, by + uy * L); ctx.lineTo(bx + 3, by + 1); ctx.closePath(); };
        sp(); ctx.fillStyle = crysD; ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx - 3, by + 1); ctx.lineTo(bx + ux * L * 0.6 - 2.6 * uy, by + uy * L * 0.6); ctx.lineTo(bx + ux * L, by + uy * L); ctx.lineTo(bx, by + 1); ctx.closePath();
        ctx.fillStyle = crys; ctx.fill();
        sp(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
      }
      // head: bone face-plate, feelers, sickle mandibles, a cluster of eyes
      const hx = 34 * sq - coil * 2 + dying * 14 + thrust * 9 - rearUp * 3, hy = -18 + coil * 5 - rearUp * 2 + Math.sin(t * 3) * 0.6;
      const open = leap ? (st < 0.6 ? coil : st < 1.05 ? 1 : 0.5) : snap ? (st < 0.56 ? rearUp * 1.2 : st < 0.62 ? 1.2 - (st - 0.56) / 0.06 * 1.15 : 0.05) : 0.18 + Math.sin(t * 3.3) * 0.12;
      const tw = Math.sin(t * 9) * 0.12 + Math.sin(t * 2.3) * 0.2;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      for (const [k, s] of [[0, 1], [1, -1]]) {
        ctx.beginPath(); ctx.moveTo(hx + 2, hy - 7 + k * 2);
        ctx.quadraticCurveTo(hx + 12, hy - 20 - k * 4 + tw * 10 * s, hx + 24 + k * 4, hy - 16 - k * 9 + tw * 14);
        ctx.stroke();
      }
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.08 + coil * 0.15);
      // mandibles behind the face
      for (const s of [-1, 1]) {
        ctx.save(); ctx.translate(8, s * 3); ctx.rotate(s * (0.1 + open * 0.55));
        ctx.beginPath(); ctx.moveTo(-2, -2.2 * s); ctx.quadraticCurveTo(10, -3 * s, 15, 3 * s); ctx.quadraticCurveTo(8, 1 * s, 0, 2.5 * s); ctx.closePath();
        ctx.fillStyle = '#e2d4dc'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath(); ctx.moveTo(-9, 6); ctx.quadraticCurveTo(-11, -9, 1, -10); ctx.quadraticCurveTo(10, -10, 12, -2); ctx.quadraticCurveTo(12, 6, 4, 8); ctx.closePath();
      ctx.fillStyle = Rig.celGrad(ctx, 1, -1, 0.5, -0.9, 10, 1, Rig.ramp('#2c2134')); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1, -8); ctx.quadraticCurveTo(10, -8, 11.5, -1.5); ctx.quadraticCurveTo(10, 3, 5, 4); ctx.quadraticCurveTo(1, -1, 1, -8); ctx.closePath();
      ctx.fillStyle = Rig.celGrad(ctx, 6, -2, 0.6, -0.8, 6, 1, Rig.ramp('#cdbfcd')); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      const eyeK = broken ? 0.4 : 1 - dying;
      glow(ctx, 7, -3, 9 + open * 6 + tellK * 10, ACC, 0.36 * eyeK);
      ctx.fillStyle = U.rgba('#ffd0ff', eyeK);
      for (const [ex, ey, r] of [[6.5, -5, 1.6], [9.4, -3.6, 1.3], [6.2, -1.5, 1.1], [8.4, -0.4, 0.9]]) { ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fill(); }
      if (tellK > 0) glow(ctx, 16, 0, 24, e.tellCol === 'red' ? CRIM : '#ffffff', tellK * 0.9);
      ctx.restore();
      // near legs over the body
      for (let i = 0; i < 3; i++) Rig.limbChain(ctx, legPts(i, false), [2.9, 2.2, 1.0], '#3a2c44');
      flashOver(ctx, e, () => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -20, 46, 18, 0, 0, TAU); ctx.fill(); });
    },
  };

  /* =========================== HOLLOW SENTINEL =========================== */
  const SP = {
    idle: (t) => ({ ry: 2 + Math.sin(t * 1.8) * 1.5, torso: 0.38, head: 0.25, tF: 0.3, kF: -0.45, tB: -0.25, kB: -0.25, aF: 0.6, eF: 0.4, aB: 0.2, eB: 0.3 }),
    slashA: { tF: 0.5, kF: -0.6, tB: -0.4, kB: -0.25, ry: 6, torso: 0.0, head: 0.1, aF: 2.8, eF: 0.4, aB: -0.6, eB: 0.4 },
    slashB: { tF: 0.85, kF: -0.9, tB: -0.6, kB: -0.2, ry: 12, torso: 0.6, head: 0.2, aF: 1.0, eF: 0.0, aB: -0.9, eB: 0.3 },
    slashC: { tF: 0.5, kF: -0.6, tB: -0.4, kB: -0.25, ry: 6, torso: 0.2, head: 0.1, aF: -0.4, eF: 0.6, aB: 0.6, eB: 0.4 },
    slashD: { tF: 0.85, kF: -0.9, tB: -0.6, kB: -0.2, ry: 10, torso: 0.4, head: 0.2, aF: 2.3, eF: 0.1, aB: -0.6, eB: 0.3 },
    thrustA: { tF: 0.6, kF: -0.9, tB: -0.6, kB: -0.3, ry: 14, torso: 0.5, head: 0.0, aF: -0.7, eF: 1.7, aB: 1.0, eB: 0.6 },
    thrustB: { tF: 1.1, kF: -0.6, tB: -1.0, kB: -0.15, ry: 16, torso: 0.75, head: -0.2, aF: 1.57, eF: 0.0, aB: -1.3, eB: 0.2 },
    hurt: { ry: 9, torso: -0.42, head: 0.75, tF: 0.15, kF: -0.7, tB: -0.6, kB: -0.5, aF: -0.4, eF: 1.3, aB: -1.1, eB: 0.9 },
    hitSnap: { torso: -0.5, head: 0.85, aF: -0.2, eF: 1.0, aB: -1.2, eB: 0.7, ry: 6 },
    broken: (t) => ({ ry: 26, torso: 0.9 + Math.sin(t * 3) * 0.05, head: 0.6, tF: 1.3, kF: -1.3, tB: 0.0, kB: -1.57, aF: 0.2, eF: 0.2, aB: 0.2, eB: 0.3 }),
  };
  TYPES.sentinel = {
    name: '寂衛', w: 40, h: 150, hp: 95, bal: 75, col: HUSH, shards: 30, poise: true, scale: 1.2, spawnT: 0.9,
    voice: () => G.SFX.play('growl', 1),
    weapon: (e) => { const J = e.J; if (!J) return { x: e.x, y: e.y - 120 }; const s = TYPES.sentinel.scale; return { x: e.x + e.facing * J.btip.x * s, y: e.y + J.btip.y * s }; },
    think(e, dt) {
      e.faceP();
      const d = e.distP();
      // stand just inside sword reach (the slash covers ~138 from its centre)
      const want = 105;
      if (d > want + 40) e.vx = U.approach(e.vx, e.facing * 130 * e.speedMul, 900 * dt);
      else if (d < want - 45) e.vx = U.approach(e.vx, -e.facing * 90, 900 * dt);
      else e.vx = U.approach(e.vx, 0, 900 * dt);
      if (d < 230 && e.cd <= 0) e.startAtk(Math.random() < 0.62 ? TYPES.sentinel.slash2 : TYPES.sentinel.thrust);
    },
    slash2: {
      // fairness: every hit lands >=0.45 s after its white tell
      dur: 1.82, cd: 1.4, tells: [{ t: 0.1, c: 'white' }, { t: 0.6, c: 'white' }],
      poses: { dur: 1.82, keys: [[0, SP.idle(0)], [0.53, SP.slashA], [0.65, SP.slashB, 'snap'], [0.94, SP.slashC, 'io'], [1.12, SP.slashD, 'snap'], [1.82, SP.idle(0), 'io']] },
      moves: [{ t0: 0.53, t1: 0.65, v: 300 }, { t0: 1.02, t1: 1.12, v: 280 }],
      hits: [{ t0: 0.58, t1: 0.69, box: { x: 0, y: -150, w: 125, h: 140 }, dmg: 14 }, { t0: 1.06, t1: 1.18, box: { x: 0, y: -150, w: 125, h: 140 }, dmg: 15, last: true }],
      ev: [{ t: 0.58, fn: () => G.SFX.play('slash', 0.6) }, { t: 1.06, fn: () => G.SFX.play('slash', 0.55) }],
    },
    thrust: {
      dur: 1.7, cd: 1.5, tells: [{ t: 0.18, c: 'red' }],
      poses: { dur: 1.7, keys: [[0, SP.idle(0)], [0.7, SP.thrustA], [0.84, SP.thrustB, 'snap'], [1.15, SP.thrustB], [1.7, SP.idle(0), 'io']] },
      moves: [{ t0: 0.8, t1: 1.0, v: 760 }],
      hits: [{ t0: 0.8, t1: 1.02, box: { x: 0, y: -110, w: 140, h: 50 }, dmg: 22, red: true, kb: 380, last: true }],
      ev: [{ t: 0.8, fn: () => G.SFX.play('slash', 0.5, true) }],
    },
    init(e) { e.cape = new Rig.Chain(7, 8.5, 0.06, 0.88); },
    draw(ctx, e) {
      const J = e.J, s = TYPES.sentinel.scale;
      if (J) e.cape.update(e.x + e.facing * (J.sh.x - 6) * s, e.y + (J.sh.y + 2) * s, e.facing, G.game.dtVis, -e.vx * 4 + Math.sin(e.t * 1.7) * 200, 2.75);
      drawHumanoid(ctx, e, s, 'sentinel');
    },
  };

  function humanoidPose(e, dt) {
    const T = e.T; let target;
    if (e.state === 'atk' && e.atk && e.atk.poses) target = Rig.sample(e.atk.poses, e.st);
    else if (e.state === 'hurt' || e.state === 'recoil') { const w = Math.sin(Math.min(1, e.st / (e.hurtDur || 0.36)) * Math.PI); target = { ...SP.hurt, rx: -6 * w, ry: SP.hurt.ry + 4 * w }; }
    else if (e.state === 'broken') target = SP.broken(e.t);
    else if (Math.abs(e.vx) > 30 && e.onGround) {
      const prevStep = Math.floor((e.gaitP || 0) / Math.PI);
      e.gaitP = (e.gaitP || 0) + Math.abs(e.vx) * dt * Math.PI / (2 * 15);
      if (Math.floor(e.gaitP / Math.PI) !== prevStep && Math.abs(e.x - e.P.x) < 800) G.SFX.play('heavyStep');
      const w = Rig.ANIM.walk(e.gaitP);
      target = { ...SP.idle(e.t), ik: 1, fFx: w.fFx * 1.15 + 4, fFy: w.fFy * 1.3, fBx: w.fBx * 1.15 - 4, fBy: w.fBy * 1.3, ry: w.ry + 3 };
    } else target = SP.idle(e.t);
    if (e.onGround && e.state !== 'broken' && !(Math.abs(e.vx) > 30 && e.state !== 'atk')) target = Rig.groundify(target);
    const hk = e.hitK;
    if (hk > 0) target = Rig.lerpPose(Rig.full(target), Rig.full({ ...Rig.full(target), ...SP.hitSnap }), Math.min(1, hk * 1.2));
    blendPose(e, target, dt, hk > 0 ? 45 : e.state === 'atk' ? 30 : 14);
  }

  // tattered cloth along a chain: cel face, ragged hem, ink contour (local coords)
  function tattered(ctx, pts, w0, w1, col, inner, seed) {
    const n = pts.length, Lp = [], Rp = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = U.lerp(w0, w1, i / (n - 1));
      Lp.push({ x: pts[i].x - dy / d * w, y: pts[i].y + dx / d * w }); Rp.push({ x: pts[i].x + dy / d * w, y: pts[i].y - dx / d * w });
    }
    const path = () => {
      ctx.beginPath(); ctx.moveTo(Lp[0].x, Lp[0].y);
      for (let i = 1; i < n; i++) ctx.lineTo(Lp[i].x, Lp[i].y);
      // ragged hem: alternating tongues of cloth
      const a = Lp[n - 1], b = Rp[n - 1], tip = pts[n - 1], prev = pts[n - 2], ex = tip.x - prev.x, ey = tip.y - prev.y, el = Math.hypot(ex, ey) || 1;
      for (let k = 1; k <= 5; k++) { const u = k / 6, p = lerpP(a, b, u), j = (k % 2 ? 6 : -2) + ((seed * 7 + k * 3) % 5); ctx.lineTo(p.x + ex / el * j, p.y + ey / el * j); }
      ctx.lineTo(b.x, b.y);
      for (let i = n - 2; i >= 0; i--) ctx.lineTo(Rp[i].x, Rp[i].y);
      ctx.closePath();
    };
    const mid = pts[n >> 1];
    path(); ctx.fillStyle = Rig.celGrad(ctx, mid.x, mid.y, 1, 0, Math.max(w0, w1) + 4, Rig.lightDir(ctx).x >= 0 ? 1 : -1, Rig.ramp(col)); ctx.fill();
    ctx.strokeStyle = Rig.INK; ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke();
    if (inner) { ctx.save(); path(); ctx.clip(); ctx.fillStyle = inner; ctx.beginPath(); for (let i = 0; i < n; i++) ctx.lineTo(Lp[i].x + (pts[i].x - Lp[i].x) * 0.45, Lp[i].y + (pts[i].y - Lp[i].y) * 0.45); for (let i = n - 1; i >= 0; i--) ctx.lineTo(Lp[i].x - 2, Lp[i].y); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.7;
    for (const k of [0.3, 0.62]) { ctx.beginPath(); for (let i = 1; i < n; i++) { const p = lerpP(Lp[i], Rp[i], k); i === 1 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); } ctx.stroke(); }
  }
  const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  function drawHumanoid(ctx, e, s, kind) {
    const dt = G.game.dtVis;
    humanoidPose(e, dt);
    const J = Rig.compute(e.pose);
    // blade tip (from forearm direction)
    const fa = Math.atan2(J.hdF.x - J.elF.x, J.hdF.y - J.elF.y);
    const blen = kind === 'graves' ? 92 : 84;
    J.btip = { x: J.hdF.x + Math.sin(fa) * blen, y: J.hdF.y + Math.cos(fa) * blen };
    e.J = J;
    const sink = emerge(ctx, e) * 160;
    ctx.translate(e.x, e.y + sink); ctx.scale(e.facing * s, s);
    const L = Rig.limb, LC = Rig.limbChain, INK = Rig.INK;
    const G1 = kind === 'graves';
    // palette: the Sentinel is a hollow Ark guard in dusty violet rags; Graves an armoured knight in gunmetal
    const body = G1 ? '#3a3f52' : '#4a3f5c', bodyB = G1 ? '#262938' : '#2e2640', cloak = G1 ? '#3a2552' : '#5a4c6e', cloakIn = G1 ? '#1a1024' : '#2a2034', plate = G1 ? '#8c93a8' : '#d9cfc0';
    const accent = G1 ? VIO : HUSH;
    // cloak behind (both now wear one; it streams with movement)
    if (e.cape && e.cape.inited) {
      const cp = e.cape.p.map((q) => ({ x: (q.x - e.x) * e.facing / s, y: (q.y - e.y) / s }));
      tattered(ctx, cp, G1 ? 9 : 7, G1 ? 17 : 14, cloak, cloakIn, G1 ? 3 : 1);
    }
    // back arm & leg (continuous, shadowed)
    LC(ctx, [J.shB, J.elB, J.hdB], [3.6, 3.0, 2.3], bodyB);
    LC(ctx, [J.hip, lerpP(J.hip, J.kneeB, 0.45), J.kneeB, lerpP(J.kneeB, J.ankB, 0.4), J.ankB], [6.0, 5.4, 4.0, 3.8, 2.6], bodyB);
    L(ctx, J.ankB, J.toeB, 2.8, 1.7, bodyB);
    // torso: hunched chest with a ribbed breastplate
    const tA = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x), ux = Math.cos(tA), uy = Math.sin(tA), nx = -uy, ny = ux;
    const Q = (a, f) => ({ x: J.hip.x + ux * a * 36 + nx * f, y: J.hip.y + uy * a * 36 + ny * f });
    ctx.beginPath();
    const tp = [Q(-0.08, -9), Q(0.4, -9.5), Q(0.85, -12), Q(1.08, -6), Q(1.1, 5), Q(0.85, 11), Q(0.45, 9), Q(0.05, 8.5)];
    ctx.moveTo(tp[0].x, tp[0].y); for (let i = 1; i <= tp.length; i++) { const a = tp[i - 1], b = tp[i % tp.length]; ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    ctx.closePath(); ctx.fillStyle = Rig.celGrad(ctx, Q(0.5, 0).x, Q(0.5, 0).y, nx, ny, 13, Rig.lightDir(ctx).x * nx >= 0 ? 1 : -1, Rig.ramp(body)); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
    // breastplate
    ctx.beginPath(); const bp = [Q(0.45, 1), Q(0.95, 2), Q(1.02, 9), Q(0.8, 11), Q(0.5, 8.5)];
    ctx.moveTo(bp[0].x, bp[0].y); for (const p of bp.slice(1)) ctx.lineTo(p.x, p.y); ctx.closePath();
    ctx.fillStyle = Rig.celGrad(ctx, Q(0.75, 6).x, Q(0.75, 6).y, nx, ny, 6, 1, Rig.ramp(plate)); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(11,6,18,0.55)'; ctx.lineWidth = 0.6;
    for (const a of [0.62, 0.76, 0.9]) { const p = Q(a, 2.5), q = Q(a + 0.04, 10); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    // hush crystal growing through the plate
    const cm = Q(0.72, 4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, cm.x, cm.y, 16, accent, 0.45); ctx.restore();
    ctx.fillStyle = U.rgba(accent, 0.95); ctx.beginPath(); ctx.moveTo(cm.x, cm.y - 9); ctx.lineTo(cm.x + 3.5, cm.y - 1); ctx.lineTo(cm.x, cm.y + 6); ctx.lineTo(cm.x - 3, cm.y - 1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
    // tattered tabard over the hips
    ctx.fillStyle = G1 ? '#2f2a44' : '#5b4a6c';
    ctx.beginPath(); ctx.moveTo(J.hip.x - 9, J.hip.y - 4); ctx.lineTo(J.hip.x + 9, J.hip.y - 4);
    ctx.lineTo(J.hip.x + 8, J.hip.y + 20); ctx.lineTo(J.hip.x + 3, J.hip.y + 11); ctx.lineTo(J.hip.x - 1, J.hip.y + 24); ctx.lineTo(J.hip.x - 5, J.hip.y + 10); ctx.lineTo(J.hip.x - 10, J.hip.y + 17); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    // front leg with a greave
    LC(ctx, [J.hip, lerpP(J.hip, J.kneeF, 0.45), J.kneeF, lerpP(J.kneeF, J.ankF, 0.4), J.ankF], [6.6, 5.9, 4.4, 4.2, 2.8], body, { spec: 0.25 });
    L(ctx, lerpP(J.kneeF, J.ankF, 0.2), lerpP(J.kneeF, J.ankF, 0.85), 4.6, 3.4, G1 ? plate : '#3a2440', { spec: 0.3 });
    L(ctx, J.ankF, J.toeF, 3.0, 1.8, body);
    // head: hooded porcelain mask (Sentinel) / crested helm (Graves)
    ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
    if (G1) {
      ctx.fillStyle = Rig.celGrad(ctx, 0, 0, 1, 0, 11, 1, Rig.ramp('#5a6072')); ctx.beginPath(); ctx.ellipse(0, -1, 9.5, 11.5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#2a2d38'; ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(10, -4); ctx.lineTo(10, 2); ctx.lineTo(-6, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#6b47a0'; ctx.beginPath(); ctx.moveTo(-2, -11); ctx.quadraticCurveTo(-16, -24, -26, -6); ctx.quadraticCurveTo(-12, -15, -3, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(VIO, 0.95); ctx.fillRect(2, -1.5, 8, 1.6); glow(ctx, 6, -1, 12, VIO, 0.5);
    } else {
      // hood
      ctx.fillStyle = Rig.celGrad(ctx, 0, 0, 1, 0, 13, 1, Rig.ramp(cloak));
      ctx.beginPath(); ctx.moveTo(9, -10); ctx.quadraticCurveTo(2, -20, -9, -14); ctx.quadraticCurveTo(-15, -4, -11, 10); ctx.lineTo(-2, 13); ctx.lineTo(6, 9); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#120d18'; ctx.beginPath(); ctx.ellipse(3.5, -2, 7.5, 11, 0.12, 0, TAU); ctx.fill(); // hood shadow
      // cracked porcelain mask, one burning slit
      ctx.fillStyle = Rig.celGrad(ctx, 4, -3, 1, 0, 8, 1, Rig.ramp('#e6ddcf')); ctx.beginPath(); ctx.ellipse(5, -3, 6, 10.5, 0.12, -PI / 2, PI / 2); ctx.quadraticCurveTo(1, -3, 5, -13.5); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = '#6b655e'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(4, -13); ctx.lineTo(6.5, -6); ctx.lineTo(4.5, 0); ctx.lineTo(6.5, 5); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = U.rgba(HUSH, 0.95); ctx.fillRect(7.2, -9, 1.6, 9);
      glow(ctx, 8, -4, 14, HUSH, 0.5);
    }
    ctx.restore();
    // front arm (+ pauldron) and weapon
    LC(ctx, [J.sh, J.elF, J.hdF], [4.0, 3.4, 2.9], body);
    ctx.beginPath(); ctx.ellipse(J.sh.x, J.sh.y + 1, 7, 5.5, -0.3, 0, TAU);
    ctx.fillStyle = Rig.celGrad(ctx, J.sh.x, J.sh.y, 0.6, -0.8, 7, 1, Rig.ramp(G1 ? plate : '#7a6a8c')); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke();
    if (!G1) { // crystals bursting from the shoulder
      ctx.fillStyle = U.rgba(HUSH, 0.9);
      for (const [ox, oy, h] of [[-2, -4, 9], [2, -5, 6]]) { ctx.beginPath(); ctx.moveTo(J.sh.x + ox - 2, J.sh.y + oy + 2); ctx.lineTo(J.sh.x + ox, J.sh.y + oy - h); ctx.lineTo(J.sh.x + ox + 2, J.sh.y + oy + 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke(); }
    }
    if (G1) {
      L(ctx, J.elF, J.hdF, 3.6, 3, plate, { spec: 0.4 });
      // broken longsword
      const dx = J.btip.x - J.hdF.x, dy = J.btip.y - J.hdF.y, Ln = Math.hypot(dx, dy), nx2 = -dy / Ln, ny2 = dx / Ln;
      L(ctx, { x: J.hdF.x + nx2 * 7, y: J.hdF.y + ny2 * 7 }, { x: J.hdF.x - nx2 * 7, y: J.hdF.y - ny2 * 7 }, 1.6, 1.6, '#6c6f7d');
      ctx.fillStyle = '#b4b9cc';
      ctx.beginPath(); ctx.moveTo(J.hdF.x + nx2 * 3, J.hdF.y + ny2 * 3); ctx.lineTo(J.btip.x + nx2 * 2 - dx * 0.08, J.btip.y + ny2 * 2 - dy * 0.08);
      ctx.lineTo(J.btip.x - nx2 * 1, J.btip.y - ny2 * 1); ctx.lineTo(J.btip.x - nx2 * 3 - dx * 0.12, J.btip.y - ny2 * 3 - dy * 0.12); ctx.lineTo(J.hdF.x - nx2 * 3, J.hdF.y - ny2 * 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(VIO, 0.7); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(J.hdF.x, J.hdF.y); ctx.lineTo(J.btip.x, J.btip.y); ctx.stroke(); ctx.restore();
    } else {
      // forearm fused into a crystal blade
      const dx = J.btip.x - J.elF.x, dy = J.btip.y - J.elF.y, Ln = Math.hypot(dx, dy), nx2 = -dy / Ln, ny2 = dx / Ln;
      ctx.beginPath();
      ctx.moveTo(J.elF.x + nx2 * 4, J.elF.y + ny2 * 4);
      ctx.quadraticCurveTo(J.hdF.x + nx2 * 7, J.hdF.y + ny2 * 7, J.btip.x, J.btip.y);
      ctx.lineTo(J.hdF.x - nx2 * 3, J.hdF.y - ny2 * 3); ctx.lineTo(J.elF.x - nx2 * 3.5, J.elF.y - ny2 * 3.5); ctx.closePath();
      const g = ctx.createLinearGradient(J.elF.x, J.elF.y, J.btip.x, J.btip.y);
      g.addColorStop(0, '#2a2034'); g.addColorStop(0.45, '#7a2a5a'); g.addColorStop(1, '#ffc2d8');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(HUSH, 0.75); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(J.hdF.x, J.hdF.y); ctx.lineTo(J.btip.x, J.btip.y); ctx.stroke(); ctx.restore();
    }
    // tell aura on weapon
    if (e.tellT > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, J.btip.x, J.btip.y, 26, e.tellCol === 'red' ? CRIM : '#ffffff', e.tellT);
      ctx.restore();
    }
    flashOver(ctx, e, () => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(J.hip.x, J.hip.y - 30, 18, 60, 0, 0, TAU); ctx.fill(); });
  }

  /* =========================== SHRIEKER =========================== */
  TYPES.shrieker = {
    name: '嘯者', w: 54, h: 70, hp: 44, bal: 36, col: '#ff5d9e', fly: true, shards: 18, spawnT: 0.8,
    voice: () => G.SFX.play('hiss'),
    init(e) { e.tents = Array.from({ length: 5 }, () => new Rig.Chain(7, 7, 0.06, 0.92)); e.y0 = e.y; },
    weapon: (e) => ({ x: e.x + e.facing * 16, y: e.y - 18 }),
    think(e, dt) {
      e.faceP();
      const d = e.distP();
      const tx = d < 360 ? -e.facing * 140 : d > 520 ? e.facing * 120 : 0;
      e.vx = U.approach(e.vx, tx, 300 * dt);
      e.vy = (e.y0 + Math.sin(e.t * 1.6) * 18 - e.y) * 3;
      // mostly a single note; from mid range it sometimes sings a three-note phrase (a parry-rhythm test)
      if (d < 720 && e.cd <= 0) e.startAtk(d > 260 && d < 640 && Math.random() < 0.35 ? TYPES.shrieker.volley : TYPES.shrieker.cast);
    },
    cast: {
      dur: 1.4, cd: 2.4, tells: [{ t: 0.35, c: 'white' }],
      ev: [{ t: 0.85, fn: (e) => { fireOrb(e, e.x + e.facing * 18, e.y - 18, 400); G.SFX.play('shriek'); } }],
    },
    // white: three orbs on a beat (0.22 s apart, aimed high → centre → low); each can be guarded or parried back
    volley: {
      dur: 2.0, cd: 3.2, tells: [{ t: 0.3, c: 'white' }],
      ev: [0.85, 1.07, 1.29].map((t, i) => ({ t, fn: (e) => { const P = e.P; fireOrb(e, e.x + e.facing * 18, e.y - 18, 380, { x: P.x, y: P.y - 60 + (i - 1) * 24 }); G.SFX.play('shriek'); } })),
    },
    atkUpdate(e, dt) { e.vx = U.approach(e.vx, 0, 400 * dt); e.vy = (e.y0 + Math.sin(e.t * 1.6) * 18 - e.y) * 3; },
    // 嘯者: a bell-jelly that sings — a scalloped membrane dome with a crystal heart, a porcelain singer's mask hung beneath it
    // (the O-mouth fires the orb), oral arms and stinging tendrils. The dome clenches while charging and pulses on release.
    draw(ctx, e, ghost) {
      const dt = G.game.dtVis, t = e.t, st = e.st, INK = Rig.INK, ACC = '#ff5d9e';
      const sp = emerge(ctx, e);
      const dying = e.state === 'die' ? U.clamp(st / 0.5, 0, 1) : 0;
      const atk = e.state === 'atk';
      const volley = atk && e.atk === TYPES.shrieker.volley;
      const charge = atk ? U.clamp(st / 0.85, 0, 1) : 0;
      let fire = 0; if (atk) for (const b of volley ? TYPES.shrieker.volley.ev.map((v) => v.t) : [0.85]) if (st >= b) fire = U.clamp(1 - (st - b) / (volley ? 0.2 : 0.35), 0, 1);
      const broken = e.state === 'broken' || e.state === 'executed';
      const wob = Math.max(e.hitK, e.state === 'hurt' || e.state === 'recoil' ? 1 - Math.min(1, st / (e.hurtDur || 0.36)) : 0);
      const bob = Math.sin(t * 3) * 2 + (broken ? 6 : 0);
      const tilt = broken ? 0.42 + Math.sin(t * 2) * 0.06 : Math.sin(t * 1.3) * 0.06 + Math.sin(t * 38) * 0.26 * wob - 0.22 * wob - fire * 0.12;
      // swim pulse: the bell contracts and relaxes; charging clenches it, firing blows it wide
      const pulse = Math.sin(t * 4.2);
      const sx = (1 + pulse * 0.04) * (1 - charge * 0.12 * (1 - fire)) * (1 + fire * 0.16) * (broken ? 1.08 : 1) * (1 + dying * 0.2);
      const sy = (1 - pulse * 0.05) * (1 + charge * 0.1 * (1 - fire)) * (1 - fire * 0.12) * (broken ? 0.82 : 1) * (1 - dying * 0.5);
      ctx.globalAlpha *= (1 - sp) * (1 - dying * dying);
      // tendrils + oral arms (world-space verlet chains)
      if (!e.arms) e.arms = [new Rig.Chain(8, 6.5, 0.05, 0.9), new Rig.Chain(7, 6.5, 0.05, 0.9)];
      const W = (lx, ly) => ({ x: e.x + e.facing * lx, y: e.y + bob + ly });
      const wind = -e.vx * 6 + Math.sin(t * 2.1) * 120;
      if (dt > 0 || !e.arms[0].inited) e.tents.forEach((c, i) => { const a = W(-18 + i * 8 * sx, -27 * sy); c.update(a.x, a.y, e.facing, dt, wind, PI - 0.12 + (i - 2) * 0.07 + (broken ? 0.3 : 0)); });
      if (dt > 0 || !e.arms[0].inited) e.arms.forEach((c, i) => { const a = W(4 + i * 7, -25 * sy); c.update(a.x, a.y, e.facing, dt, wind * 0.6, PI - 0.25 + i * 0.12); });
      ctx.save();
      ctx.lineJoin = 'round';
      // a travelling wave runs down every tendril so they swim instead of hanging like strings
      const wave = (c, i, amp) => c.p.map((q, k) => ({ x: q.x + Math.sin(t * 3.1 - k * 0.75 + i * 1.7) * k * amp * (broken ? 0.3 : 1), y: q.y }));
      const T5 = e.tents.map((c, i) => (c.inited ? wave(c, i, 0.75) : null)), A2 = e.arms.map((c, i) => (c.inited ? wave(c, i + 3, 0.5) : null));
      T5.forEach((p) => { if (p) { Rig.ribbon(ctx, p, 2.3, 1, INK); Rig.ribbon(ctx, p, 1.3, 0.3, '#4a1f4a'); } });
      ctx.globalCompositeOperation = 'lighter';
      T5.forEach((p) => { if (p) { const q = p[p.length - 1]; Rig.ribbon(ctx, p.slice(3), 0.7, 0.15, U.rgba(ACC, 0.4)); ctx.fillStyle = U.rgba('#ffc2dc', 0.75); ctx.beginPath(); ctx.arc(q.x, q.y, 1.3, 0, TAU); ctx.fill(); } });
      ctx.globalCompositeOperation = 'source-over';
      A2.forEach((p) => { if (p) { Rig.ribbon(ctx, p, 4.2, 1.2, INK, 1.6); Rig.ribbon(ctx, p, 3, 0.5, '#8e3a6e', 1.3); Rig.ribbon(ctx, p.slice(1), 1, 0.2, '#e58fbe'); } });
      ctx.restore();
      ctx.translate(e.x, e.y + bob); ctx.scale(e.facing, 1);
      ctx.translate(0, -40); ctx.rotate(tilt); ctx.translate(0, 40);
      // ---- dome ----
      ctx.save(); ctx.translate(-2, -30); ctx.scale(sx, sy); ctx.translate(2, 30);
      const dome = () => {
        ctx.beginPath(); ctx.moveTo(-28, -30);
        ctx.bezierCurveTo(-33, -58, -16, -75, 0, -74); ctx.bezierCurveTo(18, -75, 31, -58, 26, -30);
        for (let i = 0; i < 6; i++) { const x0 = 26 - i * 9, x1 = x0 - 9; ctx.quadraticCurveTo((x0 + x1) / 2, -23 + (i % 2) * 2, x1, -30); }
        ctx.closePath();
      };
      // velum frill under the margin
      ctx.beginPath(); ctx.moveTo(-27, -30);
      for (let i = 0; i <= 12; i++) { const x = -27 + i * 4.4; ctx.lineTo(x, -25 + Math.sin(t * 7 + i * 1.3) * 2 + (i % 2) * 2); }
      ctx.lineTo(26, -31); ctx.closePath(); ctx.fillStyle = '#2a1230'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
      const L = Rig.lightDir(ctx), s = 0.6 * L.x - 0.8 * L.y >= 0 ? 1 : -1;
      dome(); ctx.fillStyle = Rig.celGrad(ctx, -2, -50, 0.6, -0.8, 30, s, Rig.ramp('#6b2c66')); ctx.fill();
      ctx.save(); dome(); ctx.clip();
      // translucent core: the crystal heart glows through the membrane
      ctx.globalCompositeOperation = 'lighter';
      const heart = 0.45 + 0.2 * Math.sin(t * 4.2 + 1) + charge * (volley ? 0.75 : 0.5) + fire * 0.6 + (e.tellT > 0 ? 0.3 : 0);
      glow(ctx, 0, -46, 26 + charge * 8, ACC, 0.3 * heart * (1 - dying * 0.5));
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255,150,205,0.28)'; ctx.lineWidth = 0.9;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 2, -70); ctx.quadraticCurveTo(i * 8, -54, i * 8.6, -30); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(14,4,22,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(-2, -33, 27, 6, 0, PI * 1.05, PI * 1.95); ctx.stroke();
      ctx.restore();
      dome(); ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.stroke();
      // specular sheen on the lit shoulder of the bell
      ctx.strokeStyle = 'rgba(255,236,246,0.7)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-2, -48, 21, -PI * 0.42, -PI * 0.18); ctx.stroke(); ctx.lineCap = 'butt';
      // crystal heart inside (faceted, drawn over the membrane like a cel highlight)
      for (const [x, y, l, a, w] of [[-5, -40, 13, -0.35, 3], [0, -39, 18, 0.05, 4], [5, -41, 11, 0.45, 2.6]]) {
        const ux = Math.sin(a), uy = -Math.cos(a);
        ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + ux * l, y + uy * l); ctx.lineTo(x + w, y); ctx.closePath();
        ctx.fillStyle = U.rgba('#ff86b8', 0.85); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + ux * l, y + uy * l); ctx.lineTo(x, y + 1); ctx.closePath(); ctx.fillStyle = U.rgba('#ffe1ef', 0.9); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + ux * l, y + uy * l); ctx.lineTo(x + w, y); ctx.closePath(); ctx.strokeStyle = 'rgba(11,6,18,0.7)'; ctx.lineWidth = 0.7; ctx.stroke();
      }
      // crown crystals breaking out of the top
      for (const [x, y, a, l] of [[-13, -66, -0.55, 14], [-2, -72, -0.08, 21], [10, -68, 0.42, 13]]) {
        const ux = Math.sin(a), uy = -Math.cos(a), px = -uy, py = ux;
        const pts = [[x - px * 3.4, y - py * 3.4], [x + ux * l * 0.62 - px * 3, y + uy * l * 0.62 - py * 3], [x + ux * l, y + uy * l], [x + ux * l * 0.6 + px * 2.8, y + uy * l * 0.6 + py * 2.8], [x + px * 3.4, y + py * 3.4]];
        const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath(); };
        path(); ctx.fillStyle = '#b8336e'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[2][0], pts[2][1]); ctx.lineTo(x, y); ctx.closePath(); ctx.fillStyle = '#ffc6e0'; ctx.fill();
        path(); ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.stroke();
      }
      ctx.restore();
      // ---- porcelain singer's mask beneath the bell ----
      ctx.save(); ctx.translate(12, -23 + (1 - sy) * 10); ctx.rotate(0.14 - charge * 0.1 + fire * 0.2);
      ctx.beginPath(); ctx.ellipse(0, 0, 8.6, 11, 0, 0, TAU);
      ctx.fillStyle = Rig.celGrad(ctx, 0, 0, 1, -0.3, 9, 1, Rig.ramp('#ece2d8')); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      // eyes: serene closed arcs; they open into burning slits while it sings
      const open = Math.max(charge, broken ? 0 : 0) * (1 - dying);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
      for (const [ex, ew] of [[-3.6, 2.4], [3.4, 3]]) {
        ctx.beginPath();
        if (broken) { ctx.moveTo(ex - 1.6, -5.6); ctx.lineTo(ex + 1.6, -2.6); ctx.moveTo(ex + 1.6, -5.6); ctx.lineTo(ex - 1.6, -2.6); }
        else ctx.arc(ex, -4.6 - open * 1.2, ew, 0.15 * PI, 0.85 * PI);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.strokeStyle = U.rgba(ACC, 0.75); ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(3.4, -1.8); ctx.quadraticCurveTo(4.4, 3, 3, 8); ctx.stroke(); // crystal tear
      ctx.strokeStyle = 'rgba(90,70,80,0.7)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(-1, -10.6); ctx.lineTo(0.4, -6.5); ctx.lineTo(-1.4, -3.2); ctx.stroke();
      // the O mouth
      const mr = 2.4 + charge * 2.4 * (1 - fire * 0.4) + fire * 1.4;
      ctx.beginPath(); ctx.ellipse(2.2, 4.4, mr * 0.8, mr, 0, 0, TAU); ctx.fillStyle = '#1a0812'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 2.2, 4.4, 10 + charge * 18 + fire * 14, ACC, 0.35 + charge * 0.45);
      ctx.strokeStyle = U.rgba('#ffc2dc', 0.6 + charge * 0.4); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(2.2, 4.4, mr * 0.8, mr, 0, 0, TAU); ctx.stroke();
      if (open > 0.3) { ctx.fillStyle = U.rgba('#ffe6f1', open); ctx.fillRect(1.6, -5.4, 3.6, 1); ctx.fillRect(-5, -5.2, 2.8, 0.9); }
      if (e.tellT > 0) glow(ctx, 2.2, 4.4, 30, e.tellCol === 'red' ? CRIM : '#ffffff', e.tellT);
      ctx.restore();
      // sound rings rippling off the mouth as the orb leaves
      if (fire > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 2; k++) { const r = (1 - fire) * 34 + k * 9; ctx.strokeStyle = U.rgba('#ffc2dc', fire * (0.7 - k * 0.3)); ctx.lineWidth = 2 - k * 0.6; ctx.beginPath(); ctx.ellipse(16, -19, r * 0.55, r, 0, -PI / 2, PI / 2); ctx.stroke(); }
        ctx.restore();
      }
      if (broken) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffc6e0';
        for (let i = 0; i < 3; i++) { const a = t * 4 + i * TAU / 3, px = -2 + Math.cos(a) * 18, py = -82 + Math.sin(a) * 5; ctx.beginPath(); ctx.arc(px, py, 1.8, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
      flashOver(ctx, e, () => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -44, 28, 30, 0, 0, TAU); ctx.fill(); });
      ctx.globalAlpha = 1;
    },
  };

  /* =========================== PROJECTILES =========================== */
  function fireOrb(e, x, y, speed, aimAt) {
    const P = G.game.player;
    const tx = aimAt ? aimAt.x : P.x, ty = aimAt ? aimAt.y : P.y - 60;
    const a = Math.atan2(ty - y, tx - x);
    G.game.projectiles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 11, owner: e, friendly: false, dmg: 13, life: 4, t: 0, col: e.boss ? CRIM : '#ff5d9e' });
    G.FX.ring(x, y, 4, 34, 0.3, '#ffc2dc', 3);
    G.SFX.play('orb');
  }
  G.fireOrb = fireOrb;
  G.updateProjectiles = (dt) => {
    const g = G.game, P = g.player, arr = g.projectiles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.t += dt; p.life -= dt;
      if (p.friendly && p.owner && !p.owner.dead) {
        const a = Math.atan2(p.owner.cy - p.y, p.owner.cx - p.x), sp = Math.hypot(p.vx, p.vy);
        p.vx = U.lerp(p.vx, Math.cos(a) * sp, 0.12); p.vy = U.lerp(p.vy, Math.sin(a) * sp, 0.12);
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (Math.random() < 0.6) G.FX.ember(p.x, p.y, 1, p.friendly ? '#7ff4ff' : p.col, { w: 6, h: 6, up: 10, sp: 20, life: 0.3 });
      let dead = p.life <= 0;
      for (const s of G.Phys.allSolids()) if (p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.h) dead = true;
      if (!p.friendly && !dead) {
        const hb = P.hurtbox;
        if (p.x + p.r > hb.x && p.x - p.r < hb.x + hb.w && p.y + p.r > hb.y && p.y - p.r < hb.y + hb.h && !p.passed) {
          const res = P.receiveHit(p, { dmg: p.dmg, kb: 160, projectile: true, hx: p.x, hy: p.y });
          if (res === 'parried') {
            p.friendly = true; p.vx = -p.vx * 1.5; p.vy = -p.vy * 0.4 - 80; p.life = 3;
            G.FX.ring(p.x, p.y, 6, 60, 0.3, '#7ff4ff', 4);
          } else if (res === 'dodged') p.passed = true;
          else dead = true;
        }
      } else if (p.friendly && !dead) {
        for (const e of g.enemies) {
          if (e.dead) continue;
          const b = e.box;
          if (p.x > b.x - p.r && p.x < b.x + b.w + p.r && p.y > b.y - p.r && p.y < b.y + b.h + p.r) {
            e.takeHit({ dmg: 26 * P.dmgMul, bal: 40, hx: p.x, hy: p.y, big: true }); dead = true;
            G.game.hitstop(0.08); G.game.shake(0.4); G.SFX.play('hit', 1.2);
            break;
          }
        }
      }
      if (dead) { G.FX.spark(p.x, p.y, 10, { col: p.friendly ? '#bff8ff' : '#ffc2dc', speed: 360 }); arr.splice(i, 1); }
    }
  };
  G.drawProjectiles = (ctx) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of G.game.projectiles) {
      const col = p.friendly ? '#7ff4ff' : p.col;
      glow(ctx, p.x, p.y, p.r * 3.2, col, 0.55);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.45, 0, TAU); ctx.fill();
      ctx.strokeStyle = U.rgba(col, 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.8 + Math.sin(p.t * 20) * 0.15), 0, TAU); ctx.stroke();
      ctx.strokeStyle = U.rgba(col, 0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.5, p.t * 8, p.t * 8 + 2); ctx.stroke();
    }
    ctx.restore();
  };

  /* =========================== GRAVES (elite) =========================== */
  const GP = {
    combo1: { tF: 0.5, kF: -0.6, tB: -0.45, kB: -0.25, ry: 6, torso: 0.05, head: 0.0, aF: 2.7, eF: 0.4, aB: -0.6, eB: 0.4 },
    combo2: { tF: 0.9, kF: -0.95, tB: -0.6, kB: -0.2, ry: 12, torso: 0.55, head: 0.1, aF: 0.9, eF: 0.0, aB: -0.9, eB: 0.3 },
    combo3: { tF: 0.6, kF: -0.7, tB: -0.5, kB: -0.25, ry: 8, torso: 0.3, head: 0.0, aF: -0.5, eF: 0.4, aB: 0.6, eB: 0.4 },
    combo4: { tF: 0.9, kF: -0.95, tB: -0.6, kB: -0.2, ry: 10, torso: 0.45, head: 0.1, aF: 2.4, eF: 0.0, aB: -0.6, eB: 0.3 },
    high: { tF: 0.7, kF: -1.6, tB: 0.3, kB: -1.4, ry: -10, torso: -0.1, head: -0.2, aF: 3.0, eF: 0.2, aB: 2.6, eB: 0.3 },
    slam: { tF: 1.0, kF: -1.6, tB: -0.6, kB: -1.0, ry: 22, torso: 0.8, head: 0.2, aF: 0.6, eF: 0.1, aB: -0.5, eB: 0.4 },
  };
  TYPES.graves = {
    name: '斷弦騎士・葛雷夫', w: 46, h: 172, hp: 420, bal: 170, col: VIO, elite: true, shards: 180, scale: 1.32, spawnT: 1.0, defeatDialog: 'gravesDefeat', defeatRelic: 'dawnstring',
    voice: () => G.SFX.play('growl', 0.72),
    init(e) { e.cape = new Rig.Chain(8, 9, 0.05, 0.9); e.facing = -1; },
    think(e, dt) {
      e.faceP();
      const d = e.distP();
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) { e.phase = 2; e.speedMul = 1.2; G.game.bark('gravesP'); G.FX.ring(e.cx, e.cy, 20, 260, 0.7, VIO, 6); }
      if (d > 200) e.vx = U.approach(e.vx, e.facing * 170 * e.speedMul, 900 * dt);
      else if (d < 110) e.vx = U.approach(e.vx, -e.facing * 120, 900 * dt);
      else e.vx = U.approach(e.vx, 0, 900 * dt);
      if (e.cd <= 0) {
        const r = Math.random();
        if (d > 330) e.startAtk(TYPES.graves.leap);
        else if (r < 0.45) e.startAtk(TYPES.graves.combo);
        else if (r < 0.75) e.startAtk(TYPES.graves.feint);
        else e.startAtk(TYPES.graves.leap);
      }
    },
    combo: {
      // fairness: white hits >=0.45 s after their tell, the red thrust >=0.6 s (its tell comes after the 2nd cut)
      dur: 2.95, cd: 1.0, tells: [{ t: 0.15, c: 'white' }, { t: 0.58, c: 'white' }, { t: 1.12, c: 'red' }, { t: 1.95, c: 'white' }],
      poses: { dur: 2.95, keys: [[0, SP.idle(0)], [0.59, GP.combo1], [0.69, GP.combo2, 'snap'], [1.02, GP.combo3], [1.12, GP.combo4, 'snap'], [1.68, SP.thrustA], [1.8, SP.thrustB, 'snap'], [2.25, GP.combo3], [2.5, GP.combo4, 'snap'], [2.95, SP.idle(0), 'io']] },
      moves: [{ t0: 0.59, t1: 0.69, v: 280 }, { t0: 1.03, t1: 1.12, v: 260 }, { t0: 1.73, t1: 1.93, v: 820 }, { t0: 2.4, t1: 2.5, v: 220 }],
      hits: [
        { t0: 0.62, t1: 0.73, box: { x: 0, y: -190, w: 140, h: 180 }, dmg: 16 },
        { t0: 1.05, t1: 1.15, box: { x: 0, y: -190, w: 140, h: 180 }, dmg: 16 },
        { t0: 1.74, t1: 1.94, box: { x: 0, y: -140, w: 150, h: 60 }, dmg: 26, red: true, kb: 420 },
        { t0: 2.42, t1: 2.54, box: { x: -20, y: -170, w: 170, h: 160 }, dmg: 18, last: true },
      ],
      ev: [{ t: 0.62, fn: () => G.SFX.play('slash', 0.5) }, { t: 1.05, fn: () => G.SFX.play('slash', 0.55) }, { t: 1.74, fn: () => G.SFX.play('slash', 0.45, true) }, { t: 2.42, fn: () => G.SFX.play('slash', 0.5, true) }],
    },
    feint: {
      dur: 1.9, cd: 1.0, tells: [{ t: 0.6, c: 'white' }],
      poses: { dur: 1.9, keys: [[0, SP.idle(0)], [0.5, GP.combo1], [0.6, { ...GP.combo1, aF: 2.5 }], [1.05, { ...GP.combo1, aF: 2.95 }], [1.15, GP.combo2, 'snap'], [1.9, SP.idle(0), 'io']] },
      moves: [{ t0: 1.05, t1: 1.15, v: 340 }],
      hits: [{ t0: 1.08, t1: 1.2, box: { x: 0, y: -190, w: 150, h: 180 }, dmg: 22, last: true, pbal: 60 }],
      ev: [{ t: 1.08, fn: () => G.SFX.play('slash', 0.45, true) }],
    },
    leap: {
      dur: 2.0, cd: 1.3, track: false, tells: [{ t: 0.3, c: 'red' }],
      poses: { dur: 2.0, keys: [[0, SP.idle(0)], [0.5, GP.high], [0.95, GP.high], [1.05, GP.slam, 'snap'], [2.0, SP.idle(0), 'io']] },
      ev: [
        { t: 0.5, fn: (e) => { e.faceP(); const tx = G.game.player.x; e.vy = -900; e.leapVx = U.clamp((tx - e.x) / 0.62, -900, 900); G.SFX.play('whoosh', 1.2); } },
        { t: 1.05, fn: (e) => { e.vy = 1400; } },
      ],
      hits: [{ t0: 1.05, t1: 1.3, box: { x: -60, y: -120, w: 200, h: 130 }, dmg: 28, red: true, kb: 460, last: true }],
    },
    atkUpdate(e, dt) {
      if (e.atk === TYPES.graves.leap) {
        if (e.st > 0.5 && e.st < 1.05) e.vx = e.leapVx;
        if (e.st > 1.05 && e.onGround && !e.slammed) {
          e.slammed = true; e.vx = 0;
          G.game.shake(0.7); G.SFX.play('quake');
          G.FX.ring(e.x, e.y, 10, 240, 0.5, VIO, 6, { flat: 0.18 }); G.FX.dust(e.x, e.y, 30, { w: 120, speed: 300, size: 16 });
          G.FX.shards(e.x, e.y - 4, 14, VIO, 500);
        }
        if (e.st < 1.05) e.slammed = false;
      }
    },
    draw(ctx, e) {
      const dt = G.game.dtVis;
      const J = e.J;
      if (J) { const s = TYPES.graves.scale; e.cape.update(e.x + e.facing * J.sh.x * s - e.facing * 4, e.y + J.sh.y * s, e.facing, dt, -e.vx * 4 + Math.sin(e.t * 2) * 300, 2.6); }
      drawHumanoid(ctx, e, TYPES.graves.scale, 'graves');
    },
  };
  TYPES.graves.weapon = (e) => { const J = e.J, s = TYPES.graves.scale; return J ? { x: e.x + e.facing * J.btip.x * s, y: e.y + J.btip.y * s } : { x: e.x, y: e.y - 150 }; };

  /* =========================== MAESTRINA (boss) =========================== */
  const MP = {
    float: (t) => ({ rx: 0, ry: Math.sin(t * 1.4) * 3, torso: 0.05, head: 0.08 + Math.sin(t * 0.8) * 0.04, aF: 0.9 + Math.sin(t * 1.4) * 0.08, eF: 0.6, aB: -0.5, eB: 1.1, sw: 1.2 }),
    raise: { torso: -0.15, head: -0.15, aF: 2.9, eF: 0.3, aB: -1.4, eB: 0.6, sw: 3.5 },
    cut: { torso: 0.45, head: 0.15, aF: 1.1, eF: 0.0, aB: -1.6, eB: 0.4, sw: 0.4 },
    under: { torso: 0.3, head: 0.0, aF: 0.3, eF: 0.2, aB: -1.0, eB: 0.6, sw: -0.4 },
    rise: { torso: -0.1, head: -0.1, aF: 2.6, eF: 0.1, aB: -1.4, eB: 0.4, sw: 2.9 },
    lungeA: { torso: 0.5, head: 0.0, aF: -0.7, eF: 1.6, aB: 1.2, eB: 0.4, sw: 1.57 },
    lungeB: { torso: 0.75, head: -0.1, aF: 1.57, eF: 0.0, aB: -1.5, eB: 0.2, sw: 1.57 },
    conduct: (t) => ({ torso: -0.1, head: -0.25, aF: 2.6 + Math.sin(t * 9) * 0.3, eF: 0.4, aB: 2.4 + Math.cos(t * 9) * 0.3, eB: 0.4, sw: 3.2 + Math.sin(t * 9) * 0.3 }),
    dive: { torso: 0.9, head: 0.2, aF: 0.2, eF: 0.0, aB: -0.3, eB: 0.2, sw: 0.0 },
    broken: (t) => ({ ry: 30, torso: 0.8 + Math.sin(t * 2) * 0.05, head: 0.6, aF: 0.3, eF: 0.2, aB: 0.2, eB: 0.3, sw: 0.2 }),
  };
  // staccato: cut, rising cut, red lunge - white hits >=0.45 s after their tell, the red lunge >=0.6 s (tell after the 2nd cut)
  const staccato = (fast) => {
    const h1 = fast ? 0.55 : 0.62, h2 = fast ? 0.98 : 1.1, rt = h2 + 0.04, h3 = rt + 0.62, end = h3 + (fast ? 0.5 : 0.68);
    return {
      dur: end, cd: 0.9, tells: [{ t: h1 - 0.47, c: 'white' }, { t: h2 - 0.47, c: 'white' }, { t: rt, c: 'red' }],
      poses: { dur: end, keys: [[0, MP.float(0)], [h1 - 0.03, MP.raise], [h1 + 0.07, MP.cut, 'snap'], [h2 - 0.03, MP.under], [h2 + 0.07, MP.rise, 'snap'], [h3 - 0.05, MP.lungeA], [h3 + 0.08, MP.lungeB, 'snap'], [end, MP.float(0), 'io']] },
      moves: [{ t0: 0.0, t1: h1 - 0.06, v: 260 }, { t0: h1 - 0.03, t1: h1 + 0.07, v: 320 }, { t0: h2 - 0.03, t1: h2 + 0.07, v: 300 }, { t0: h3 - 0.02, t1: h3 + 0.2, v: 900 }],
      hits: [
        { t0: h1, t1: h1 + 0.12, box: { x: -10, y: -220, w: 175, h: 210 }, dmg: 16 },
        { t0: h2, t1: h2 + 0.12, box: { x: -10, y: -240, w: 175, h: 230 }, dmg: 16 },
        { t0: h3, t1: h3 + 0.22, box: { x: 0, y: -150, w: 190, h: 70 }, dmg: 26, red: true, kb: 440, last: true },
      ],
      ev: [{ t: h1, fn: () => G.SFX.play('slash', 0.8) }, { t: h2, fn: () => G.SFX.play('slash', 0.9) }, { t: h3, fn: () => G.SFX.play('slash', 0.6, true) }],
    };
  };
  // five-beat phase-2 chain (W W R W W) on the same telegraph rule
  const staccato5 = {
    dur: 3.3, cd: 1.0,
    tells: [{ t: 0.12, c: 'white' }, { t: 0.55, c: 'white' }, { t: 1.08, c: 'red' }, { t: 1.85, c: 'white' }, { t: 2.32, c: 'white' }],
    poses: { dur: 3.3, keys: [[0, MP.float(0)], [0.58, MP.raise], [0.66, MP.cut, 'snap'], [1.0, MP.under], [1.08, MP.rise, 'snap'], [1.66, MP.lungeA], [1.78, MP.lungeB, 'snap'], [2.3, MP.raise], [2.4, MP.cut, 'snap'], [2.78, MP.under], [2.88, MP.rise, 'snap'], [3.3, MP.float(0), 'io']] },
    moves: [{ t0: 0, t1: 0.56, v: 300 }, { t0: 0.58, t1: 0.66, v: 300 }, { t0: 1.0, t1: 1.08, v: 300 }, { t0: 1.68, t1: 1.88, v: 950 }, { t0: 2.3, t1: 2.4, v: 300 }, { t0: 2.78, t1: 2.88, v: 300 }],
    hits: [
      { t0: 0.6, t1: 0.7, box: { x: -10, y: -220, w: 175, h: 210 }, dmg: 15 },
      { t0: 1.02, t1: 1.12, box: { x: -10, y: -240, w: 175, h: 230 }, dmg: 15 },
      { t0: 1.7, t1: 1.9, box: { x: 0, y: -150, w: 190, h: 70 }, dmg: 25, red: true, kb: 420 },
      { t0: 2.32, t1: 2.43, box: { x: -10, y: -220, w: 175, h: 210 }, dmg: 16 },
      { t0: 2.8, t1: 2.92, box: { x: -10, y: -240, w: 175, h: 230 }, dmg: 18, last: true },
    ],
    ev: [0.6, 1.02, 1.7, 2.32, 2.8].map((t, i) => ({ t, fn: () => G.SFX.play('slash', 0.7 + i * 0.05, i === 2) })),
  };
  const fermata = (n) => ({
    dur: 0.8 + n * 0.38 + 0.6, cd: 1.1,
    poses: { dur: 3, keys: [[0, MP.float(0)], [0.5, MP.conduct(0)], [3, MP.conduct(1)]] },
    tells: Array.from({ length: n }, (_, i) => ({ t: 0.5 + i * 0.38, c: 'white', face: true })),
    ev: [{ t: 0, fn: (e) => { e.hoverTarget = -150; } }].concat(Array.from({ length: n }, (_, i) => ({ t: 0.8 + i * 0.38, fn: (e) => { const w = TYPES.maestrina.weapon(e); fireOrb(e, w.x, w.y, 430 + i * 20); } })))
      .concat([{ t: 0.8 + n * 0.38 + 0.4, fn: (e) => { e.hoverTarget = -30; } }]),
  });
  const glissando = {
    dur: 2.3, cd: 1.2, tells: [{ t: 0.62, c: 'red', face: false }],
    poses: { dur: 2.3, keys: [[0, MP.float(0)], [0.5, MP.raise], [1.2, MP.raise], [1.3, MP.dive, 'snap'], [2.3, MP.float(0), 'io']] },
    ev: [
      { t: 0.25, fn: (e) => { e.fade = 1; G.FX.shards(e.cx, e.cy, 12, CRIM, 300); G.SFX.play('whoosh', 1.3); } },
      { t: 0.55, fn: (e) => { const P = G.game.player; e.x = U.clamp(P.x + P.vx * 0.15, G.game.arena.x0 + 60, G.game.arena.x1 - 60); e.y = P.y - 360; e.vy = 0; e.fade = 0; e.hoverLock = true; } },
      { t: 1.25, fn: (e) => { e.vy = 2200; } },
    ],
    hits: [{ t0: 1.25, t1: 1.42, box: { x: -70, y: -200, w: 140, h: 210 }, dmg: 28, red: true, kb: 460, last: true }],
  };
  const requiem = {
    dur: 3.4, cd: 1.2, tells: [{ t: 0.2, c: 'red' }],
    poses: { dur: 3.4, keys: [[0, MP.float(0)], [0.4, MP.conduct(0)], [3.4, MP.conduct(2)]] },
    ev: Array.from({ length: 6 }, (_, i) => ({ t: 0.5 + i * 0.42, fn: (e) => spawnPillar(e, G.game.player.x + G.game.player.vx * 0.25) })),
  };
  const crescendo = {
    dur: 3.6, cd: 1.4, tells: [{ t: 0.3, c: 'white' }],
    poses: { dur: 3.6, keys: [[0, MP.float(0)], [0.6, MP.raise], [3.6, MP.raise]] },
    ev: [{ t: 0, fn: (e) => { e.hoverTarget = -170; } }].concat([1.0, 1.75, 2.5].map((t) => ({ t, fn: (e) => spawnWave(e) }))).concat([{ t: 3.2, fn: (e) => { e.hoverTarget = -30; } }]),
  };
  function spawnPillar(e, x) {
    const ar = G.game.arena; x = U.clamp(x, ar.x0 + 40, ar.x1 - 40);
    G.game.hazards.push({ kind: 'pillar', x, y: G.Phys.groundBelow(x, -10), t: 0, warn: 0.62, life: 1.15, hit: false, owner: e });
  }
  function spawnWave(e) {
    G.game.hazards.push({ kind: 'wave', x: e.x, y: e.y - 80, t: 0, r: 20, speed: 420, life: 2.6, hit: false, owner: e });
    G.SFX.play('shriek'); G.FX.ring(e.x, e.y - 80, 10, 80, 0.4, '#ffffff', 5);
  }
  G.updateHazards = (dt) => {
    const g = G.game, P = g.player;
    for (let i = g.hazards.length - 1; i >= 0; i--) {
      const h = g.hazards[i]; h.t += dt;
      // chapter hazards carry their own behaviour: { update(h, dt, g), draw(ctx, h, g), life?, done? }
      if (h.update) { h.update(h, dt, g); if (h.done || (h.life != null && h.t >= h.life)) g.hazards.splice(i, 1); continue; }
      if (h.kind === 'pillar') {
        if (h.t >= h.warn && !h.erupted) { h.erupted = true; G.SFX.play('pillar'); G.FX.shards(h.x, h.y, 10, CRIM, 520); g.shake(0.25); }
        if (h.erupted && !h.hit && h.t < h.warn + 0.22) {
          const box = { x: h.x - 26, y: h.y - 220, w: 52, h: 220 };
          if (U.rectsOverlap(box, P.hurtbox)) { h.hit = true; P.receiveHit(h.owner, { dmg: 22, unblockable: true, kb: 300, hx: h.x, hy: P.y - 60 }); }
        }
      } else if (h.kind === 'wave') {
        h.r += h.speed * dt;
        const px = P.x, py = P.y - 60, d = Math.hypot(px - h.x, py - h.y);
        if (!h.hit && Math.abs(d - h.r) < 26) {
          h.hit = true;
          const res = P.receiveHit(h.owner, { dmg: 15, kb: 220, hx: px, hy: py, waveFrom: h.x });
          if (res === 'parried') { h.owner.bal = Math.min(h.owner.maxBal, h.owner.bal + 34); h.owner.showBar = 3; if (h.owner.bal >= h.owner.maxBal) h.owner.breakBalance(); }
        }
      }
      if (h.t >= h.life || (h.kind === 'pillar' && h.t >= h.warn + 0.55)) g.hazards.splice(i, 1);
    }
  };
  G.drawHazards = (ctx) => {
    for (const h of G.game.hazards) {
      if (h.draw) { ctx.save(); h.draw(ctx, h, G.game); ctx.restore(); continue; }
      if (h.kind === 'pillar') {
        if (!h.erupted) {
          const k = h.t / h.warn;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          glow(ctx, h.x, h.y, 40 + k * 30, CRIM, 0.3 + k * 0.5);
          ctx.strokeStyle = U.rgba(CRIM, 0.4 + k * 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(h.x, h.y, 30, 5, 0, 0, TAU); ctx.stroke();
          ctx.restore();
        } else {
          const k = U.clamp((h.t - h.warn) / 0.12, 0, 1), fade = 1 - U.clamp((h.t - h.warn - 0.3) / 0.25, 0, 1);
          const H = 230 * U.easeOutBack(k);
          ctx.save(); ctx.globalAlpha = fade;
          const g = ctx.createLinearGradient(h.x, h.y, h.x, h.y - H);
          g.addColorStop(0, '#1a0a14'); g.addColorStop(0.6, '#7a1a3a'); g.addColorStop(1, '#ffd0dc');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(h.x - 24, h.y); ctx.lineTo(h.x - 6, h.y - H); ctx.lineTo(h.x + 4, h.y - H * 0.92); ctx.lineTo(h.x + 22, h.y); ctx.fill();
          ctx.beginPath(); ctx.moveTo(h.x - 30, h.y); ctx.lineTo(h.x - 26, h.y - H * 0.5); ctx.lineTo(h.x - 12, h.y); ctx.fill();
          ctx.beginPath(); ctx.moveTo(h.x + 12, h.y); ctx.lineTo(h.x + 28, h.y - H * 0.6); ctx.lineTo(h.x + 30, h.y); ctx.fill();
          ctx.globalCompositeOperation = 'lighter'; glow(ctx, h.x, h.y - H * 0.5, 60, CRIM, 0.35);
          ctx.restore();
        }
      } else if (h.kind === 'wave') {
        const k = h.t / h.life;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.rgba('#ffffff', 0.7 * (1 - k)); ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = U.rgba(CRIM, 0.5 * (1 - k)); ctx.lineWidth = 14;
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
  };

  TYPES.maestrina = {
    name: '首席指揮・瑪絲緹娜', w: 64, h: 190, hp: 1500, bal: 280, col: CRIM, boss: true, fly: true, shards: 600, scale: 1.4, spawnT: 2.2, defeatDialog: 'bossDefeat',
    voice: (e) => G.SFX.play('bossVoice', e.phase),
    init(e) {
      e.hair = [new Rig.Chain(12, 10, 0.05, 0.93), new Rig.Chain(10, 10, 0.05, 0.93), new Rig.Chain(11, 9, 0.05, 0.93)];
      e.hoverTarget = -30; e.fade = 0; e.facing = -1; e.lastMoves = [];
    },
    weapon: (e) => { const J = e.J, s = TYPES.maestrina.scale; return J ? { x: e.x + e.facing * J.tip.x * s, y: e.y + J.tip.y * s } : { x: e.x, y: e.y - 150 }; },
    think(e, dt) {
      e.faceP();
      const ground = G.Phys.groundBelow(e.x, e.y - 400);
      const ty = ground + e.hoverTarget;
      e.vy = (ty - e.y) * 4;
      const d = e.distP();
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) { G.game.bossPhase2(e); return; }
      e.vx = U.approach(e.vx, d > 260 ? e.facing * 160 : d < 140 ? -e.facing * 110 : 0, 600 * dt);
      if (e.cd <= 0) {
        const pool = e.phase === 1
          ? [['stac', d < 420 ? 4 : 1], ['ferm', d > 260 ? 3 : 1], ['glis', 2]]
          : [['stac5', d < 420 ? 3 : 1], ['ferm', 1.5], ['glis', 2], ['req', 2.5], ['cres', 1.5]];
        const last = e.lastMoves[e.lastMoves.length - 1];
        const tot = pool.reduce((s, p) => s + (p[0] === last ? p[1] * 0.25 : p[1]), 0);
        let r = Math.random() * tot, pick = pool[0][0];
        for (const p of pool) { const w = p[0] === last ? p[1] * 0.25 : p[1]; if ((r -= w) <= 0) { pick = p[0]; break; } }
        e.lastMoves.push(pick);
        const fast = e.phase === 2;
        const M = { stac: staccato(false), stac5: staccato5, ferm: fermata(fast ? 5 : 3), glis: glissando, req: requiem, cres: crescendo };
        e.startAtk(M[pick]);
      }
    },
    atkUpdate(e, dt) {
      const a = e.atk;
      if (a === glissando) {
        if (e.st >= 0.55 && e.st < 1.25) { e.vx = 0; e.vy = 0; }
        if (e.st >= 1.25 && e.onGround && !e.slammed) {
          e.slammed = true; e.vy = 0;
          G.game.shake(0.9); G.SFX.play('quake'); G.FX.ring(e.x, e.y, 10, 300, 0.6, CRIM, 7, { flat: 0.16 }); G.FX.shards(e.x, e.y - 6, 20, CRIM, 600);
          G.FX.dust(e.x, e.y, 30, { w: 140, speed: 340, size: 18, col: 'rgba(200,120,140,' });
        }
        if (e.st < 1.25) e.slammed = false;
        if (e.st > 1.6) { const ground = G.Phys.groundBelow(e.x, e.y - 400); e.vy = (ground - 30 - e.y) * 4; }
        return;
      }
      const ground = G.Phys.groundBelow(e.x, e.y - 400);
      e.vy = (ground + (e.hoverTarget ?? -30) - e.y) * 4;
    },
    draw(ctx, e) {
      const dt = G.game.dtVis, s = TYPES.maestrina.scale;
      let target;
      if (e.state === 'atk' && e.atk && e.atk.poses) target = Rig.sample(e.atk.poses, e.st);
      else if (e.state === 'broken') target = MP.broken(e.t);
      else if (e.state === 'recoil' || e.state === 'hurt') target = { ...MP.float(e.t), torso: -0.45, head: 0.5, aB: 1.2 };
      else if (e.state === 'spawn') target = { ...MP.float(e.t), torso: 0.6, head: 0.7, aF: 0.2, aB: 0.2 };
      else target = MP.float(e.t);
      if (e.hitK > 0) target = Rig.lerpPose(Rig.full(target), Rig.full({ ...Rig.full(target), torso: -0.4, head: 0.6 }), e.hitK);
      blendPose(e, target, dt, e.state === 'atk' ? 28 : 10);
      // legless: tuck legs hidden under gown
      const pose = { ...e.pose, tF: 0.05, kF: 0, tB: -0.05, kB: 0 };
      const J = Rig.compute(pose); e.J = J;
      const alpha = 1 - (e.fade || 0) * 0.9;
      const spawnK = e.state === 'spawn' ? U.clamp(e.st / 2.2, 0, 1) : 1;
      ctx.globalAlpha = alpha * spawnK;
      // hair chains (world)
      const hx = e.x + e.facing * J.head.x * s, hy = e.y + J.head.y * s;
      e.hair.forEach((c, i) => c.update(hx - e.facing * (6 + i * 4), hy - 4 + i * 4, e.facing, dt, -e.vx * 5 + Math.sin(e.t * 1.5 + i) * 500, 2.75 - i * 0.12));
      // crystal wings (world, behind)
      ctx.save(); ctx.translate(e.x - e.facing * 10, e.y + J.chest.y * s); ctx.globalCompositeOperation = 'source-over';
      const phase2 = e.phase === 2;
      for (let i = 0; i < 9; i++) {
        const a = -PI / 2 + (i - 4) * 0.28 + Math.sin(e.t * 0.8 + i) * 0.05 - e.facing * 0.5;
        const len = 120 + (4 - Math.abs(i - 4)) * 26 + (phase2 ? 30 : 0);
        ctx.save(); ctx.rotate(a + PI / 2);
        const g = ctx.createLinearGradient(0, 0, 0, -len);
        g.addColorStop(0, 'rgba(20,8,16,0)'); g.addColorStop(0.3, 'rgba(40,10,30,0.85)'); g.addColorStop(0.85, phase2 ? 'rgba(255,60,100,0.9)' : 'rgba(200,60,110,0.8)'); g.addColorStop(1, 'rgba(255,220,230,0.95)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-5, -20); ctx.lineTo(0, -len); ctx.lineTo(5, -20); ctx.lineTo(0, -10); ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -20, 160, CRIM, phase2 ? 0.28 : 0.16);
      ctx.restore();
      // hair render
      ctx.save();
      e.hair.forEach((c, i) => { if (c.inited) { Rig.ribbon(ctx, c.p, 7 - i, 1, i === 1 ? '#22121e' : '#120a12'); } });
      ctx.globalCompositeOperation = 'lighter';
      e.hair.forEach((c) => { if (c.inited) Rig.ribbon(ctx, c.p.slice(3), 1.2, 0.2, 'rgba(255,60,110,0.3)'); });
      ctx.restore();

      ctx.save();
      ctx.translate(e.x, e.y); ctx.scale(e.facing * s, s);
      const L = Rig.limb;
      // back arm
      L(ctx, J.shB, J.elB, 2.8, 2.4, '#1a1018'); L(ctx, J.elB, J.hdB, 2.4, 1.8, '#c9bcc8');
      // gown (flowing bell)
      const hip = J.hip, sway = Math.sin(e.t * 1.6) * 6, sway2 = Math.cos(e.t * 1.1) * 8;
      const gg = ctx.createLinearGradient(0, hip.y - 10, 0, 40);
      gg.addColorStop(0, '#2a1426'); gg.addColorStop(0.6, '#170b16'); gg.addColorStop(1, 'rgba(60,10,30,0.2)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.moveTo(hip.x - 10, hip.y - 6);
      ctx.bezierCurveTo(hip.x - 26, hip.y + 30, hip.x - 52 + sway, hip.y + 60, hip.x - 58 + sway2, 20);
      for (let i = 0; i <= 8; i++) { const fx = hip.x - 58 + sway2 + i * 14.5, fy = 20 + (i % 2 ? 18 : 0) + Math.sin(e.t * 3 + i) * 4; ctx.lineTo(fx, fy); }
      ctx.bezierCurveTo(hip.x + 50 + sway, hip.y + 60, hip.x + 22, hip.y + 30, hip.x + 10, hip.y - 6);
      ctx.closePath(); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,60,110,0.35)'; ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(hip.x + i * 4, hip.y); ctx.quadraticCurveTo(hip.x + i * 14 + sway, hip.y + 50, hip.x + i * 22 + sway2, 24); ctx.stroke(); }
      ctx.restore();
      // torso (bodice)
      L(ctx, hip, J.chest, 7, 9, '#1c0f1a');
      ctx.fillStyle = '#d7ccd6'; ctx.beginPath(); ctx.ellipse(J.chest.x + 2, J.chest.y + 3, 5, 4, 0, 0, TAU); ctx.fill(); // collarbone skin
      const core = { x: (hip.x + J.chest.x) / 2 + 3, y: (hip.y + J.chest.y) / 2 };
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, core.x, core.y, 26, CRIM, 0.7);
      ctx.fillStyle = '#ffd0dc'; ctx.beginPath(); ctx.moveTo(core.x, core.y - 7); ctx.lineTo(core.x + 3.5, core.y); ctx.lineTo(core.x, core.y + 7); ctx.lineTo(core.x - 3.5, core.y); ctx.fill(); ctx.restore();
      // head
      ctx.save(); ctx.translate(J.head.x, J.head.y); ctx.rotate(J.ha);
      ctx.fillStyle = '#120a12'; ctx.beginPath(); ctx.ellipse(-3, -1, 11, 11, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ddd2dc';
      ctx.beginPath(); ctx.moveTo(-1, -8.5); ctx.quadraticCurveTo(7.5, -9, 8.4, -2.4); ctx.lineTo(10, 0.8); ctx.lineTo(8.4, 1.4); ctx.quadraticCurveTo(9, 3.4, 8, 4.6); ctx.quadraticCurveTo(7.2, 7.8, 4.2, 8.6); ctx.quadraticCurveTo(0, 9.2, -2.4, 5.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a1838'; ctx.fillRect(7.4, 3.4, 1.6, 0.9);
      // veil
      ctx.fillStyle = 'rgba(15,6,14,0.82)'; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(11, -6); ctx.lineTo(10.5, 0.2); ctx.lineTo(-4, 2); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(CRIM, 0.95); ctx.fillRect(4.5, -3.2, 4.5, 1.2);
      // halo crown
      ctx.strokeStyle = U.rgba(CRIM, 0.85); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(-2, -16, 15, 4, -0.2, 0, TAU); ctx.stroke();
      for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + e.t * 0.6; const px = -2 + Math.cos(a) * 15, py = -16 + Math.sin(a) * 4; ctx.fillStyle = U.rgba('#ffd0dc', 0.8); ctx.beginPath(); ctx.moveTo(px - 1.2, py); ctx.lineTo(px, py - 7 - (i % 2) * 4); ctx.lineTo(px + 1.2, py); ctx.fill(); }
      ctx.restore();
      // baton-blade
      const b = J.hdF, t = J.tip, dx = t.x - b.x, dy = t.y - b.y, Ln = Math.hypot(dx, dy), ex = dx / Ln * 40, ey = dy / Ln * 40;
      const tip2 = { x: t.x + ex, y: t.y + ey };
      ctx.strokeStyle = '#e8dfe6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(tip2.x, tip2.y); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(CRIM, 0.7); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(tip2.x, tip2.y); ctx.stroke(); ctx.restore();
      J.tip = tip2;
      // front arm
      L(ctx, J.sh, J.elF, 3, 2.6, '#1c0f1a'); L(ctx, J.elF, J.hdF, 2.6, 2, '#d7ccd6');
      ctx.beginPath(); ctx.arc(J.sh.x, J.sh.y + 1, 4.5, 0, TAU); ctx.fillStyle = '#3a1630'; ctx.fill();
      if (e.tellT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, tip2.x, tip2.y, 30, e.tellCol === 'red' ? CRIM : '#ffffff', e.tellT); ctx.restore(); }
      flashOver(ctx, e, () => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(hip.x, hip.y - 20, 22, 50, 0, 0, TAU); ctx.fill(); });
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  };

  /* toolkit for enemies defined elsewhere (tutorial phantom, chapter rosters) */
  G.EnemyKit = { TYPES, SP, GP, U, Rig, PI, TAU, HUSH, CRIM, VIO, FILTER_OK, blendPose, glow, emerge, flashOver, humanoidPose, drawHumanoid, tattered, lerpP, fireOrb };
})(window.G);

'use strict';
/* ECHOFALL — Rinne: input-driven combat state machine */
(function (G) {
  const U = G.U, Rig = G.Rig, A = Rig.ANIM, PI = Math.PI;
  const RUN = 390, GRAV = 2500, JUMP = -940, DJUMP = -880, MAXFALL = 1300;
  // light-attack steps (reach, timing, damage) belong to the weapon's form: js/forms.js
  const STAM = { light: 9, heavy: 20, dodge: 17, air: 8 };
  const ATTACK_STATES = ['light', 'air', 'heavy', 'skill1', 'skill2', 'execute', 'counter'];

  class Player {
    constructor(game) {
      this.game = game;
      this.hair = new Rig.Chain(11, 7, 0.055, 0.9);
      this.rib1 = new Rig.Chain(5, 5.2, 0.05, 0.9);
      this.rib2 = new Rig.Chain(4, 5.0, 0.05, 0.9);
      // long coat tails + scarf (cloth physics, see Rig.CLOTH)
      for (const k of ['coatB', 'coatF', 'scarf']) { const c = Rig.CLOTH[k]; this[k] = new Rig.Chain(c[0], c[1], c[2], c[3]); }
      this.trail = new G.Trail(22);
      this.reset(G.LEVEL.start.x, G.LEVEL.start.y);
    }
    reset(x, y) {
      this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.w = 26; this.h = 112; this.facing = 1;
      this.state = 'move'; this.st = 0; this.t = 0; this.onGround = false; this.jumps = 0; this.coyote = 0;
      this.iframes = 0; this.hurtInv = 0; this.flash = 0; this.rally = 0; this.rallyT = 0;
      this.staDelay = 0; this.counterT = 0; this.airUsed = false; this.flipT = 0; this.landT = 0; this.runP = 0;
      this.pose = Rig.full(A.idle(0)); this.blendFrom = null; this.blendT = 1; this.blendDur = 0.08;
      this.hitSet = new Set(); this.ghostT = 0; this.stepT = 0; this.dropT = 0;
      this.recalc(); this.hp = this.maxHp; this.sta = this.maxSta; this.res = this.res ?? 0; this.defyReady = true;
      this.hair.inited = false; this.rib1.inited = false; this.rib2.inited = false; this.trail.clear();
      this.coatB.inited = false; this.coatF.inited = false; this.scarf.inited = false;
    }
    recalc() {
      const s = this.game.save, rel = s.equipped || [];
      // 共鳴之鏡: a talent only counts while its face is the active one (js/mirror.js)
      const M = G.Mirror, up = { vit: M.lv('vit'), edge: M.lv('edge'), tempo: M.lv('tempo'), still: M.lv('still'), echo: M.lv('echo'), tonic: M.lv('tonic') };
      const prevMax = this.maxHp || 0;
      this.maxHp = 100 + 20 * (up.vit || 0);
      this.dmgMul = 1 + 0.12 * (up.edge || 0);
      this.maxSta = 100 + 20 * (up.tempo || 0);
      this.parryWin = this.game.diff.parry + 0.025 * (up.still || 0) + (rel.includes('hushbell') ? 0.04 : 0);
      this.resMul = (1 + 0.3 * (up.echo || 0)) * (G.Boons ? G.Boons.resMul() : 1);
      this.maxTonic = Math.max(0, 3 + (up.tonic || 0) + (rel.includes('blessing') ? 1 : 0) - G.Abyss.tonicMinus());
      this.rallyMul = rel.includes('dawnstring') ? 2 : 1;
      // relics added by chapters: G.Relics[id].apply(player) adjusts these same fields
      for (const id of rel) if (G.Relics && G.Relics[id] && G.Relics[id].apply) G.Relics[id].apply(this);
      // ability scores and class (js/dnd.js)
      if (G.DnD) G.DnD.apply(this);
      // equipment (weapon power, armor defense, talismans) — see js/gear.js
      const gt = this.gear = G.Gear ? G.Gear.totals(s) : null;
      if (gt) {
        this.dmgMul *= gt.power / 100 * (1 + (gt.atk || 0)) * (G.DnD ? G.DnD.weaponMul(gt.look && gt.look.cls) : 1);
        this.maxHp = Math.round(this.maxHp * (1 + (gt.hpPct || 0)) + (gt.hp || 0));
        this.maxSta += gt.sta || 0; this.parryWin += gt.parry || 0; this.resMul *= 1 + (gt.res || 0); this.maxTonic += gt.tonic || 0;
        this.dmgTaken = (1 - Math.min(0.5, gt.dr || 0)) * 100 / (100 + (gt.defense || 0));
      } else this.dmgTaken = 1;
      if (G.Events) G.Events.apply(this);   // event blessings / curses until the next rest
      if (this.hp != null && this.maxHp > prevMax) this.hp += this.maxHp - prevMax;
      if (this.hp > this.maxHp) this.hp = this.maxHp;
      if (this.game.dynScale) this.game.dyn = this.game.dynScale();
    }
    get hurtbox() {
      const low = this.state === 'dodge' || this.state === 'skill1' ? 40 : 0;
      return { x: this.x - 13, y: this.y - this.h + low, w: 26, h: this.h - low };
    }
    get busy() { return this.state !== 'move' && this.state !== 'guard'; }
    setState(s, blend = 0.07) {
      this.blendFrom = Rig.norm(this.pose); this.blendT = 0; this.blendDur = blend;
      this.state = s; this.st = 0; this.hitSet.clear();
    }
    gainRes(v) { this.res = U.clamp(this.res + v * this.resMul, 0, 100); if (this.res >= 25) this.game.hint('skills'); }
    spendSta(v) { this.sta = Math.max(0, this.sta - v); this.staDelay = 0.55; }

    /* ------------------------------ update ------------------------------ */
    update(dt) {
      G.DnD.update(this, dt); G.DnD.spiritUpdate(this, dt); G.DnD.echoUpdate(this, dt);
      const I = G.Input, g = this.game;
      const stDt = dt * (this.state === 'light' || this.state === 'heavy' || this.state === 'air' || this.state === 'counter' ? G.Boons.atkSpeed() * G.DnD.atkSpeed() * (this.gear ? this.gear.speed * (1 + (this.gear.spd || 0)) : 1) : 1);
      this.t += dt; this.st += stDt;
      this.iframes = Math.max(0, this.iframes - dt);
      this.hurtInv = Math.max(0, this.hurtInv - dt);
      this.flash = Math.max(0, this.flash - dt * 5);
      this.counterT = Math.max(0, this.counterT - dt);
      this.flipT = Math.max(0, this.flipT - dt);
      this.landT = Math.max(0, this.landT - dt);
      this.dropT = Math.max(0, this.dropT - dt);
      this.coyote = this.onGround ? 0.1 : Math.max(0, this.coyote - dt);
      this.jumpT = (this.jumpT || 0) + dt;
      this.dropThrough = this.dropT > 0;
      // stamina
      this.staDelay -= dt;
      if (this.staDelay <= 0 && !ATTACK_STATES.includes(this.state) && this.state !== 'dodge') {
        this.sta = Math.min(this.maxSta, this.sta + (this.state === 'guard' ? 22 : 48) * (this.staRegen || 1) * dt);
      }
      // rally decay
      this.rallyT += dt;
      if (this.rally > 0 && this.rallyT > 1.4) { const d = Math.min(this.rally, 7 * dt); this.rally -= d; }

      const prevSt = this.st - stDt;
      const ctl = g.control && this.state !== 'dead';
      const mx = ctl ? I.moveX() : 0;

      switch (this.state) {
        case 'move': this.updMove(dt, mx, ctl); break;
        case 'guard': this.updGuard(dt, mx, ctl); break;
        case 'light': this.updLight(dt, ctl); break;
        case 'air': this.updAir(dt, ctl); break;
        case 'charge': this.updCharge(dt, ctl); break;
        case 'heavy': this.updHeavy(dt, ctl); break;
        case 'dodge': this.updDodge(dt, ctl); break;
        case 'parried': case 'blocked':
          this.vx = U.approach(this.vx, 0, 1800 * dt);
          if (ctl && this.tryCancel(true)) break;
          if (this.st >= (this.state === 'parried' ? A.parried.dur : A.blocked.dur)) this.setState(ctl && I.down('guard') ? 'guard' : 'move');
          break;
        case 'hurt': case 'guardBreak':
          this.vx = U.approach(this.vx, 0, 1300 * dt);
          if (this.st >= (this.state === 'hurt' ? 0.38 : 0.95)) this.setState('move');
          break;
        case 'heal': this.updHeal(dt); break;
        case 'skill1': this.updSkill1(dt); break;
        case 'skill2': this.updSkill2(dt); break;
        case 'cskill': G.DnD.skillUpdate(this, dt); break;
        case 'execute': this.updExecute(dt); break;
        case 'counter': this.updCounter(dt); break;
        case 'rest': this.vx = 0; break;
        case 'dead': this.vx = U.approach(this.vx, 0, 900 * dt); break;
        case 'cine': this.updCine(dt); break;
      }

      // physics
      if (this.state !== 'skill1' && this.state !== 'execute') {
        let grav = GRAV * (G.LEVEL.gravity || 1);
        if (this.state === 'air' && this.st < 0.32) grav *= 0.25;
        // short hop when the button is released early — but only after a guaranteed rise, so a quick tap
        // (especially on a phone) still clears a ledge instead of giving an unpredictable tiny jump
        if (this.state === 'move' && this.vy < -200 && !(ctl && I.down('jump')) && (this.jumpT || 0) > 0.13) grav *= 1.5;
        // a little hang time at the top of the arc makes the landing spot easier to steer
        if (!this.onGround && Math.abs(this.vy) < 140 && this.state === 'move') grav *= 0.62;
        this.vy = Math.min(this.vy + grav * dt, MAXFALL);
      }
      const wasGround = this.onGround, vyBefore = this.vy;
      G.Phys.move(this, dt);
      // ledge mantle: reaching a ledge with the feet just below its top (near the apex or falling, pushing toward it)
      // climbs onto it instead of sliding back down - jumps up to a platform no longer need pixel-perfect timing
      if (!this.onGround && this.state === 'move' && this.vy > -260 && ctl) {
        const mx = G.Input.moveX();
        if (mx) {
          const d = Math.sign(mx), fx = this.x + d * 20, top = G.Phys.groundBelow(fx, this.y - 46);
          if (top < 1e8 && this.y - top > 2 && this.y - top < 44 && G.Phys.groundBelow(this.x, this.y - 46) > this.y - 1) {
            this.y = top; this.x += d * 10; this.vy = 0; this.onGround = true;
            G.FX.dust(this.x, this.y, 5, { w: 16, speed: 90 }); G.SFX.play('cloth', 1.3);
          }
        }
      }
      // arena / bounds
      const ar = g.arena, b = G.LEVEL.bounds;
      this.x = U.clamp(this.x, (ar ? ar.x0 : b[0]) + 16, (ar ? ar.x1 : b[1]) - 16);
      if (this.onGround && !wasGround) {
        this.jumps = 0; this.airUsed = false;
        if (vyBefore > 500) { this.landT = 0.14; G.SFX.play('land', U.clamp(vyBefore / 1200, 0.4, 1)); G.SFX.play('armor'); G.FX.dust(this.x, this.y, 8, { w: 30, speed: 140 }); }
        if (this.state === 'air') this.setState('move', 0.1);
      }
      // footsteps
      if (this.state === 'move' && this.onGround && Math.abs(this.vx) > 120) {
        this.stepT -= dt * Math.abs(this.vx) / 300;
        if (this.stepT <= 0) { this.stepT = 0.32; G.SFX.play('stepOn', G.LEVEL.oneways.some((p) => Math.abs(this.y - p.y) < 2 && this.x > p.x && this.x < p.x + p.w) ? 'metal' : 'concrete'); if (Math.random() < 0.5) G.FX.dust(this.x - this.facing * 8, this.y, 2, { w: 6, speed: 50, size: 6 }); }
      }

      // pose & secondary motion
      const target = this.targetPose(dt);
      if (this.blendT < 1 && this.blendFrom) {
        this.blendT = Math.min(1, this.blendT + dt / this.blendDur);
        this.pose = Rig.lerpPose(this.blendFrom, target, U.easeOutCubic(this.blendT));
      } else this.pose = target;
      this.J = Rig.compute(this.pose);
      this.updHair(dt);
      // blade trail
      const now = g.time;
      if (ATTACK_STATES.includes(this.state)) this.sampleTrail(prevSt, this.st, now);
      this.trail.age(now, 0.12);
      // afterimages
      if (this.state === 'dodge' || this.state === 'skill1' || this.state === 'counter' || (this.state === 'execute' && this.st < 0.2)) {
        this.ghostT -= dt;
        if (this.ghostT <= 0) { this.ghostT = 0.035; G.FX.ghost({ x: this.x, y: this.y, facing: this.facing, pose: Object.assign({}, this.pose) }, '#6ff3ff', 0.3, 0.45); }
      }
    }

    tryCancel(allowAttack) {
      const I = G.Input;
      if (I.pressed('dodge', 160) && this.sta > 0) { I.consume('dodge'); this.startDodge(); return true; }
      // guard cuts an attack's recovery short (it used to wait for the whole swing to finish)
      if (this.state !== 'guard' && I.down('guard') && this.onGround) { this.enterGuard(); return true; }
      if (allowAttack && I.pressed('light', 160) && this.sta > 0) {
        I.consume('light');
        if (this.counterT > 0 && this.counterTarget && !this.counterTarget.dead) { this.startCounter(); return true; }
        if (this.onGround) { this.startLight(0); this.holdCheck = true; } else this.startAir();
        return true;
      }
      return false;
    }

    updMove(dt, mx, ctl) {
      const I = G.Input;
      // in the air: letting go of the stick stops the drift quickly and reversing is snappy, so jumps land where aimed
      const acc = this.onGround ? 3400 : (!mx || Math.sign(mx) !== Math.sign(this.vx) ? 3600 : 2400);
      this.vx = U.approach(this.vx, mx * RUN * G.Boons.runMul() * (1 + ((this.gear && this.gear.run) || 0)), acc * dt);
      if (mx) this.facing = mx > 0 ? 1 : -1;
      if (!ctl) return;
      // jumping
      if (I.pressed('jump', 130)) {
        if (I.down('down') && this.onGround && this.y < -10 && G.LEVEL.oneways.some((p) => this.x > p.x && this.x < p.x + p.w && Math.abs(this.y - p.y) < 2)) {
          I.consume('jump'); this.dropT = 0.25; this.y += 2;
        } else if (this.onGround || this.coyote > 0) {
          I.consume('jump'); this.vy = JUMP; this.jumps = 1; this.coyote = 0; this.onGround = false; this.jumpT = 0;
          G.SFX.play('jump'); G.SFX.play('cloth', 0.8); G.FX.dust(this.x, this.y, 6, { w: 20, speed: 120 });
        } else if (this.jumps < 2) {
          I.consume('jump'); this.vy = DJUMP; this.jumps = 2; this.flipT = A.flip.dur; this.jumpT = 0;
          G.SFX.play('jump'); G.FX.ring(this.x, this.y - 10, 4, 40, 0.3, '#7ff4ff', 3, { flat: 0.3 });
        }
      }
      // one attack button: staggered foe nearby → execution; tap → combo; hold → charged heavy
      if (I.pressed('light', 150)) {
        I.consume('light');
        const ex = this.onGround && this.game.findExecutable();
        if (ex) { this.startExecute(ex); return; }
        if (this.sta > 0) {
          if (this.counterT > 0 && this.counterTarget && !this.counterTarget.dead) this.startCounter();
          else if (this.onGround) { this.startLight(0); this.holdCheck = true; }
          else if (!this.airUsed) this.startAir();
          return;
        }
      }
      if (I.pressed('dodge', 150) && this.sta > 0) { I.consume('dodge'); this.startDodge(); return; }
      if (I.down('guard') && this.onGround) { if (!mx) this.autoFace(); this.enterGuard(); return; }
      // one skill button: the strongest technique the resonance gauge can pay for
      if (I.pressed('skill', 150)) {
        I.consume('skill');
        const c2 = G.DnD ? G.DnD.skillCost(50) : 50, c1 = G.DnD ? G.DnD.skillCost(25) : 25;
        const cls = G.DnD.st() && G.DnD.st().cls;
        if (this.res >= c2 && this.onGround) { this.res -= c2; if (cls === 'shaman') { this.setState('cskill', 0.04); G.DnD.skillStart(this, 'summon'); } else this.startSkill2(); return; }
        if (this.res >= c1) { this.res -= c1; if (cls) { this.setState('cskill', 0.03); G.DnD.skillStart(this); } else this.startSkill1(); return; }
        this.game.toast('共鳴不足：攻擊與完美格擋可以累積共鳴', 'warn');
      }
      if (I.pressed('heal', 150) && this.onGround) {
        I.consume('heal');
        if (this.game.save.tonic > 0) { this.setState('heal', 0.12); this.healed = false; }
        else this.game.bark('noTonic');
      }
    }

    // raise the blade now; a guard press buffered during a swing starts the perfect-parry window when the blade is up,
    // so pressing slightly early is never punished
    enterGuard() {
      const I = G.Input, now = performance.now();
      if (now - (I.pressT.guard || 0) < 450 && this.state !== 'parried' && this.state !== 'blocked') I.pressT.guard = now;
      this.setState('guard', 0.04); this.vx *= 0.2;
    }
    updGuard(dt, mx, ctl) {
      const I = G.Input;
      this.vx = U.approach(this.vx, 0, 1800 * dt);
      if (!ctl || !I.down('guard')) { this.setState('move', 0.08); return; }
      if (mx) { G.DnD.guardWalk(this, mx, dt); if (!G.DnD.is('paladin')) this.facing = mx > 0 ? 1 : -1; }
      if (this.tryCancel(true)) return;
      if (I.pressed('jump', 100)) { this.setState('move'); }
    }

    // touch assist (Dead Cells-style mobile help): on a phone the thumb can't aim and time as finely as a pad
    get assist() { return G.Input.device === 'touch' && this.game.settings.touchAssist !== false; }
    autoFace() {
      if (!this.assist) return;
      let best = null, bd = 260;
      for (const e of this.game.enemies) {
        if (e.dead || Math.abs(e.y - this.y) > 140) continue;
        const d = Math.abs(e.x - this.x);
        if (d < bd) { bd = d; best = e; }
      }
      if (best && Math.abs(best.x - this.x) > 4) this.facing = best.x > this.x ? 1 : -1;
    }

    startLight(ci) {
      // the weapon decides the move (js/forms.js): a spear thrusts, a hammer smashes, a scythe reaps
      this.ci = ci; this.step = G.Forms.step(this, ci); this.hitWin = -1; this.setState('light', ci === 0 ? 0.05 : 0.03);
      this.spendSta(STAM.light + ci * 2);
      const mx = G.Input.moveX(); if (mx) this.facing = mx > 0 ? 1 : -1; else this.autoFace();
      this.vx = this.facing * this.step.lunge * G.DnD.lungeMul(ci);
      G.DnD.onLightStart(this, ci);
      G.Boons.onLight(this);
      this.trail.clear(); this.queued = false;
    }
    updLight(dt, ctl) {
      const I = G.Input, L = this.step || (this.step = G.Forms.step(this, this.ci)), an = L.anim;
      const wins = L.hits || [an.active], last = wins[wins.length - 1];
      this.vx = U.approach(this.vx, 0, (this.ci === 3 ? 900 : 1300) * dt);
      if (L.drive && this.st > L.drive[0] && this.st < L.drive[1]) this.vx = this.facing * L.drive[2];
      if (L.dash && this.st > L.dash[0] && this.st < L.dash[1]) {
        // the iai: through the foe, untouchable while passing
        if (!this.dashFx) { this.dashFx = true; G.FX.ghost({ x: this.x, y: this.y, facing: this.facing, pose: Object.assign({}, this.pose) }, G.DnD.trailCol() || '#7ff4ff', 0.4, 0.7); G.SFX.play('dodge', 1.2); }
        this.vx = this.facing * L.dash[2]; this.iframes = Math.max(this.iframes, 0.12);
      } else if (L.dash && this.st > L.dash[1] && this.st < L.dash[1] + 0.05) this.vx = this.facing * 120;
      if (this.st < 0.05) this.dashFx = false;
      const wi = wins.findIndex((w) => this.st >= w[0] && this.st <= w[1]);
      if (wi >= 0) {
        let first = false;
        if (wi !== this.hitWin) {
          // each hit window strikes afresh (twinblades cut twice, the rapier thrusts three times)
          if (this.hitWin >= 0) this.hitSet.clear();
          first = this.hitWin < 0; this.hitWin = wi;
          G.SFX.play('slash', L.pitch * (1 + wi * 0.06), !!L.big && wi === wins.length - 1);
          G.Forms.fx(this, this.ci, L, wi);
        }
        this.swung = true;
        const CL = G.DnD.light(L, this.ci);   // the class's own touch (the paladin's shield bash)
        this.doHits(CL.box, { dmg: CL.dmg, bal: CL.bal, big: L.big && wi === wins.length - 1, launch: !!L.launch });
        if (first) G.DnD.onSwing(this, this.ci);
      } else if (this.st < wins[0][0]) { this.swung = false; this.hitWin = -1; }
      if (L.slam && this.st > L.slam && !this.slamFx) { this.slamFx = true; G.FX.dust(this.x + this.facing * 40, this.y, 14, { w: 60, speed: 220, size: 12 }); G.FX.ring(this.x + this.facing * 50, this.y, 6, 120, 0.35, '#7ff4ff', 4, { flat: 0.15 }); this.game.shake(0.25); }
      if (this.st < 0.1) this.slamFx = false;
      if (!ctl) { if (this.st >= an.dur) this.setState('move', 0.12); return; }
      // holding the attack button through the wind-up turns the opener into a charged heavy
      if (this.ci === 0 && this.holdCheck) {
        if (!I.down('light')) this.holdCheck = false;
        else if (this.st >= 0.14) { this.holdCheck = false; this.setState('charge', 0.1); this.chargeK = 0.15; this.vx *= 0.3; return; }
      }
      if (I.pressed('light', 300) && this.st > 0.06 && !this.holdCheck) this.queued = true;
      if (this.st >= L.cancel) {
        if (this.queued && this.ci < 3) {
          const ex = this.game.findExecutable();
          if (ex) { I.consume('light'); this.startExecute(ex); return; }
          if (this.sta > 0) { I.consume('light'); this.startLight(this.ci + 1); return; }
        }
        if (this.st > last[1] && this.tryCancel(false)) return;
      }
      if (this.st >= an.dur) this.setState('move', 0.14);
    }
    startAir() {
      this.setState('air', 0.04); this.airUsed = true; this.spendSta(STAM.air);
      this.vy = Math.min(this.vy, -120); this.trail.clear(); this.swung = false;
    }
    updAir(dt, ctl) {
      const an = A.air, I = G.Input;
      this.vx = U.approach(this.vx, (ctl ? I.moveX() : 0) * RUN * 0.7, 1500 * dt);
      if (this.st >= an.active[0] && this.st <= an.active[1]) {
        let first = false;
        if (!this.swung) { this.swung = true; first = true; G.SFX.play('slash', 1.15); }
        this.doHits({ x: -60, y: -150, w: 175, h: 170 }, { dmg: 12, bal: 9 });
        if (first) G.DnD.onSwing(this, 0);
      }
      if (this.st >= an.dur) this.setState('move', 0.1);
    }
    updCharge(dt, ctl) {
      const I = G.Input;
      this.vx = U.approach(this.vx, 0, 1600 * dt);
      this.chargeK = Math.min(1, this.chargeK + dt / 0.75);
      this.humT = (this.humT || 0) - dt; if (this.humT <= 0) { this.humT = 0.11; G.SFX.play('chargeHum', this.chargeK); }
      if (Math.random() < this.chargeK * 0.8) G.FX.ember(this.x - this.facing * 30, this.y - 70, 1, '#7ff4ff', { w: 50, h: 60, up: 80 });
      if (this.chargeK >= 1 && !this.chargeFull) { this.chargeFull = true; G.FX.star(this.J.tip.x * this.facing + this.x, this.J.tip.y + this.y, '#bff8ff', 50, 0.3); G.SFX.play('tellWhite'); }
      if (!ctl || !I.down('light') || this.st > 1.6) {
        this.chargeFull = false;
        const k = this.chargeK; this.heavyK = k;
        this.spendSta(STAM.heavy);
        this.setState('heavy', 0.03); this.vx = this.facing * (420 + 520 * k); this.trail.clear(); this.swung = false;
        return;
      }
      if (ctl && I.pressed('dodge', 100) && this.sta > 0) { I.consume('dodge'); this.chargeFull = false; this.startDodge(); }
    }
    updHeavy(dt, ctl) {
      const an = A.heavy, k = this.heavyK;
      this.vx = U.approach(this.vx, 0, 2600 * dt);
      if (this.st >= an.active[0] && this.st <= an.active[1]) {
        if (!this.swung) {
          this.swung = true; G.SFX.play('slash', 0.7, true);
          const tx = this.x + this.facing * (120 + 90 * k);
          G.FX.beam(this.x + this.facing * 10, this.y - 80, tx, this.y - 82, '#7ff4ff', 0.3, 10 + 10 * k);
        }
        this.doHits({ x: -10, y: -125, w: 150 + 60 * k, h: 70 }, { dmg: 20 + 24 * k, bal: 18 + 30 * k, big: k > 0.5, launch: k > 0.8 });
      }
      if (ctl && this.st > an.active[1] + 0.08 && this.tryCancel(false)) return;
      if (this.st >= an.dur) this.setState('move', 0.14);
    }
    startDodge() {
      const mx = G.Input.moveX();
      this.dodgeDir = mx ? (mx > 0 ? 1 : -1) : -this.facing;
      this.back = this.dodgeDir !== this.facing;
      this.setState('dodge', 0.03); this.spendSta(STAM.dodge * (1 - 0.25 * G.Mirror.lv('swift')));
      this.iframes = (this.assist ? 0.36 : 0.27) + ((this.gear && this.gear.iframes) || 0) + 0.03 * G.Mirror.lv('shadow') + (this.iframeAdd || 0); this.perfectUsed = false;
      G.SFX.play('dodge'); G.SFX.play('cloth', 1.2);
      G.Boons.onDodge(this);
      G.FX.dust(this.x, this.y, 6, { w: 20, speed: 160, dir: this.dodgeDir > 0 ? PI : 0, spread: 0.6 });
    }
    updDodge(dt) {
      const k = this.st / 0.34;
      const sp = (this.back ? 640 : 860) * G.Boons.dodgeMul() * G.DnD.dodgeMul() * (1 + ((this.gear && this.gear.dodge) || 0)) * (1 - U.easeInCubic(Math.min(1, k)));
      this.vx = this.dodgeDir * sp;
      if (this.st >= 0.34) { this.setState('move', 0.1); return; }
      if (this.st > 0.22 && this.tryCancel(true)) return;
    }
    startCounter() {
      const e = this.counterTarget; this.counterT = 0;
      this.facing = e.x > this.x ? 1 : -1;
      const tx = e.x - this.facing * (e.w / 2 + 50);
      G.FX.beam(this.x, this.y - 60, tx, this.y - 60, '#bff8ff', 0.25, 8);
      this.x = tx; this.iframes = 0.35;
      this.setState('counter', 0.02); this.trail.clear(); this.swung = false;
    }
    updCounter(dt, ctl) {
      const an = A.light[2];
      this.vx = 0;
      if (this.st >= an.active[0] - 0.04 && this.st <= an.active[1]) {
        if (!this.swung) { this.swung = true; G.SFX.play('slash', 0.8, true); }
        this.doHits({ x: -20, y: -170, w: 170, h: 175 }, { dmg: 28, bal: 34, big: true });
      }
      if (this.st >= an.dur) this.setState('move', 0.12);
    }
    updHeal(dt) {
      this.vx = U.approach(this.vx, 0, 1500 * dt);
      if (this.st > 0.4 && !this.healed) {
        this.healed = true; const g = this.game;
        g.save.tonic--; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.45 * (1 + ((this.gear && this.gear.heal) || 0) + 0.15 * G.Mirror.lv('concentrate')) * (this.healMul || 1) + this.rally); this.rally = 0;
        if ((g.save.equipped || []).includes('blessing')) this.gainRes(25 / this.resMul);
        G.SFX.play('heal'); G.FX.ember(this.x, this.y - 60, 30, '#9cf7d8', { w: 40, h: 90, up: 160 });
        G.FX.ring(this.x, this.y - 60, 10, 90, 0.5, '#9cf7d8', 3);
      }
      if (this.st >= A.heal.dur) this.setState('move', 0.15);
    }
    startSkill1() {
      this.setState('skill1', 0.03); this.s1x = this.x; this.iframes = 0.42; this.trail.clear(); this.swung = false;
      const mx = G.Input.moveX(); if (mx) this.facing = mx > 0 ? 1 : -1;
      G.SFX.play('skill1'); this.game.slowmo(0.12, 0.4);
    }
    updSkill1(dt) {
      this.vy = 0;
      if (this.st >= 0.1 && this.st < 0.26) {
        this.vx = this.facing * 1700;
        const x0 = Math.min(this.s1x, this.x), x1 = Math.max(this.s1x, this.x);
        this.doHits({ abs: true, x: x0 - 20, y: this.y - 120, w: x1 - x0 + 40, h: 120 }, { dmg: 30, bal: 26, big: true, noRes: true });
      } else this.vx = U.approach(this.vx, 0, 6000 * dt);
      if (this.st >= 0.26 && !this.s1done) {
        this.s1done = true;
        G.FX.beam(this.s1x, this.y - 64, this.x, this.y - 64, '#7ff4ff', 0.45, 18);
        for (let i = 0; i < 5; i++) G.FX.slashMark(U.lerp(this.s1x, this.x, Math.random()), this.y - 50 - Math.random() * 40, U.rand(-0.6, 0.6), 120, '#bff8ff', 0.4, 6);
        this.game.shake(0.35);
      }
      if (this.st < 0.1) this.s1done = false;
      if (this.st >= A.skill1.dur) this.setState('move', 0.12);
    }
    startSkill2() { this.setState('skill2', 0.04); this.iframes = 0.5; this.s2done = false; G.SFX.play('whoosh', 1.4); }
    updSkill2(dt) {
      this.vx = U.approach(this.vx, 0, 2000 * dt);
      if (this.st >= 0.32 && !this.s2done) {
        this.s2done = true;
        G.SFX.play('skill2'); this.game.shake(0.8); this.game.hitstop(0.08);
        G.FX.ring(this.x, this.y - 6, 10, 280, 0.6, '#7ff4ff', 8, { flat: 0.22 });
        G.FX.ring(this.x, this.y - 60, 10, 240, 0.5, '#ffffff', 4);
        G.FX.flash(this.x, this.y - 40, 260, 0.35, '#7ff4ff');
        G.FX.spark(this.x, this.y - 4, 40, { col: '#bff8ff', speed: 900, dir: -PI / 2, spread: PI * 1.1 });
        G.FX.dust(this.x, this.y, 24, { w: 120, speed: 300, size: 14 });
        this.doHits({ abs: true, x: this.x - 250, y: this.y - 220, w: 500, h: 230 }, { dmg: 34, bal: 55, big: true, launch: true, noRes: true });
      }
      if (this.st >= A.skill2.dur) this.setState('move', 0.15);
    }
    startExecute(e) {
      this.exTarget = e; e.setState('executed');
      this.facing = e.x > this.x ? 1 : -1;
      this.x = e.x - this.facing * (e.w / 2 + 46); this.y = Math.min(this.y, e.y);
      this.setState('execute', 0.02); this.iframes = 1.3; this.exHits = 0; this.trail.clear();
      this.game.cinematic(1.2, e); G.SFX.play('execute');
    }
    updExecute(dt) {
      this.vx = 0; this.vy = 0;
      const e = this.exTarget, marks = [0.27, 0.5, 0.84];
      if (this.exHits < 3 && this.st >= marks[this.exHits]) {
        const final = this.exHits === 2; this.exHits++;
        G.SFX.play(final ? 'hit' : 'slash', final ? 1.6 : 1.1, final);
        G.FX.slashMark(e.cx, e.cy - 10, final ? 0 : (this.exHits === 1 ? -0.8 : 0.9), final ? 260 : 180, '#ffffff', 0.4, final ? 14 : 8);
        G.FX.spark(e.cx, e.cy, final ? 40 : 16, { col: '#fff1d6', speed: 900 });
        this.game.hitstop(final ? 0.18 : 0.06); this.game.shake(final ? 1 : 0.3);
        if (final) {
          e.setState('idle'); e.bal = 0;
          const dmg = ((e.boss || e.elite) ? e.maxHp * 0.15 : 9999) * (1 + ((this.gear && this.gear.exec) || 0));
          e.takeHit({ dmg, bal: 0, big: true, kbx: this.facing * 300 });
          this.gainRes(22); this.game.stats.exec++;
          G.FX.flash(e.cx, e.cy, 200, 0.4, '#ffffff');
        }
      }
      if (this.st >= A.execute.dur) this.setState('move', 0.15);
    }
    updCine(dt) {
      const tx = this.cineX;
      if (tx != null && Math.abs(tx - this.x) > 6) { const d = Math.sign(tx - this.x); this.facing = d; this.vx = d * (this.cineRun ? RUN : 150); }
      else { this.vx = 0; if (this.cineFace) this.facing = this.cineFace; }
    }

    /* ------------------------------ combat ------------------------------ */
    doHits(box, h) {
      // weapon reach stretches the far edge of the swing box (a greatsword or odachi really reaches further)
      const R = box.abs || !this.gear ? 1 : this.gear.reach, bw = box.w * R + (R - 1) * Math.max(0, box.x) * 0.5;
      const b = box.abs ? box : (this.facing > 0 ? { x: this.x + box.x, y: this.y + box.y, w: bw, h: box.h } : { x: this.x - box.x - bw, y: this.y + box.y, w: bw, h: box.h });
      const g = this.game;
      for (const e of g.enemies) {
        if (e.dead || this.hitSet.has(e)) continue;
        if (!U.rectsOverlap(b, e.box)) continue;
        this.hitSet.add(e);
        const hx = U.clamp(this.x + this.facing * 50, e.box.x, e.box.x + e.box.w), hy = U.clamp(this.y - 70, e.box.y + 10, e.box.y + e.box.h - 10);
        const m = G.DnD.modHit(this, e, G.Gear.modHit(this, e, G.Boons.modHit(this, e, h)), h);
        const ok = e.takeHit({ dmg: m.dmg, bal: m.bal, big: h.big || m.crit, crit: m.crit, launch: h.launch, hx, hy, dir: this.facing > 0 ? -0.2 : PI + 0.2, kbx: this.facing * (h.big ? 300 : 170) });
        if (!ok) continue;
        G.Boons.afterHit(this, e, m); G.Gear.afterHit(this, e, m); G.DnD.onHit(this, e, m, h);
        g.addCombo();
        // impact: freeze, a camera kick along the blow, a streak across the body, a crunch, a buzz in the hand
        const heavy = h.big || m.crit;
        g.hitstop(heavy ? 0.12 : 0.07); g.shake(heavy ? 0.45 : 0.2);
        g.kick(this.facing * (heavy ? 10 : 5), heavy ? 3 : 1); if (heavy) g.punch(0.035);
        const sa = (this.state === 'light' ? [-0.55, 0.6, -0.15, 0.95][this.ci] : this.state === 'heavy' ? 0.05 : -0.4);
        const ang = this.facing > 0 ? sa : PI - sa;
        G.FX.slashMark(e.cx, hy, ang, heavy ? 190 : 130, '#ffffff', heavy ? 0.22 : 0.16, heavy ? 11 : 7);
        const cc = G.DnD.trailCol() || '#7ff4ff';   // the class's own colour on every impact
        G.FX.slashMark(e.cx, hy, ang + 0.08, heavy ? 150 : 100, cc, 0.2, heavy ? 6 : 4);
        G.FX.ring(hx, hy, 4, heavy ? 70 : 44, 0.18, cc, heavy ? 4 : 2.5);
        G.SFX.play('hit', heavy ? 1.2 : 0.85); G.SFX.play('flesh');
        if (heavy) G.SFX.play('impact');
        G.Input.rumble(heavy ? 1 : 0.45);
        if (!h.noRes) this.gainRes(3.5);
        if (this.rally > 0) { const r = Math.min(this.rally, h.dmg * 0.7 * this.rallyMul); this.rally -= r; this.hp = Math.min(this.maxHp, this.hp + r); G.FX.ember(this.x, this.y - 60, 4, '#d6dde8', { w: 20, h: 40 }); }
        g.stats.hits++;
      }
      G.Props.hit(g, b, h.dmg, this);   // crates, urns and crystals break under the blade too
    }
    receiveHit(src, info) {
      const g = this.game;
      if (this.state === 'dead' || this.state === 'execute' || this.state === 'rest' || this.state === 'cine') return 'ignored';
      if (G.Abyss.active) info = Object.assign({}, info, { dmg: info.dmg * G.Abyss.dmgMul() });
      const fromX = info.waveFrom ?? (src && src.x != null ? src.x : info.hx);
      const front = (fromX - this.x) * this.facing >= -12;
      if (this.iframes > 0) {
        if (this.state === 'dodge' && this.st < 0.2 && !this.perfectUsed) this.perfectDodge(src);
        if (this.state === 'dodge' && info.unblockable) G.Tut.ev('dodgeRed');
        return 'dodged';
      }
      if (this.hurtInv > 0) return 'ignored';
      const guarding = this.state === 'guard' || this.state === 'parried' || this.state === 'blocked';
      if (guarding && front && !info.unblockable) {
        const since = (performance.now() - (G.Input.pressT.guard || 0)) / 1000;
        if (since <= this.parryWin + (this.assist ? 0.06 : 0) + (g.tutBonus || 0)) { this.perfectParry(src, info); return 'parried'; }
        this.block(src, info); return 'blocked';
      }
      const hp0 = this.hp;
      this.takeDamage(info.dmg * g.diff.dmg * (this.dmgTaken || 1) * ((g.dyn && g.dyn.dmg) || 1) * G.Boons.dmgTakenMul(this), src, info);
      // 苦難契約・脆弱: every wound also tears at what is already missing
      const fr = G.Abyss.active && G.Abyss.pact().frail;
      if (fr && this.hp > 1 && this.hp < hp0) this.hp = Math.max(1, this.hp - (this.maxHp - this.hp) * 0.1 * fr);
      return 'hit';
    }
    perfectParry(src, info) {
      const g = this.game;
      G.DnD.onParry(this);
      this.setState('parried', 0.02);
      this.sta = Math.min(this.maxSta, this.sta + 15); this.gainRes(13);
      const hx = this.x + this.facing * 26, hy = this.y - 82;
      G.FX.star(hx, hy, '#ffffff', 120, 0.45);
      G.FX.ring(hx, hy, 6, 110, 0.4, '#7ff4ff', 5);
      G.FX.flash(hx, hy, 140, 0.25, '#bff8ff');
      G.FX.spark(hx, hy, 26, { col: '#fff4d0', speed: 1000, dir: this.facing > 0 ? 0 : PI, spread: 1.6, w: 2.5 });
      G.SFX.play('parry', true);
      g.hitstop(0.11); g.shake(0.35); g.slowmo(0.16, 0.35);
      g.stats.parries++;
      g.onPerfectParry();
      G.Boons.onParry(this);
      if (this.gear && this.gear.parryHeal) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.gear.parryHeal);
      this.vx = -this.facing * 90;
    }
    block(src, info) {
      const g = this.game;
      const d = info.dmg * g.diff.dmg * 0.65 * G.DnD.blockMul() * (this.dmgTaken || 1) * ((g.dyn && g.dyn.dmg) || 1) * (1 - ((this.gear && this.gear.guard) || 0));
      this.hp -= d; this.rally += d; this.rallyT = 0;
      this.spendSta((13 + info.dmg * 0.5) * G.DnD.blockMul());
      const hx = this.x + this.facing * 24, hy = this.y - 80;
      G.FX.spark(hx, hy, 10, { col: '#ffd8a8', speed: 500, dir: this.facing > 0 ? 0 : PI, spread: 1.4 });
      G.SFX.play('parry', false); g.shake(0.2); g.hitstop(0.04);
      this.vx = -this.facing * (info.kb ?? 200) * 0.8;
      g.onBlock();
      if (this.hp <= 1) { this.hp = 1; }
      if (this.sta <= 0) { this.setState('guardBreak', 0.05); G.SFX.play('hurt'); g.toast('架勢崩潰', 'warn'); this.hurtInv = 0; }
      else this.setState('blocked', 0.02);
    }
    perfectDodge(src) {
      const g = this.game;
      this.perfectUsed = true; this.gainRes(10); this.sta = Math.min(this.maxSta, this.sta + 10); G.DnD.onDodge(this);
      this.counterTarget = src && src.takeHit ? src : (src && src.owner) || null; this.counterT = 1.1;
      g.slowmo(0.65, 0.22); G.SFX.play('perfectDodge');
      G.FX.ring(this.x, this.y - 60, 10, 160, 0.5, '#7ff4ff', 4);
      G.FX.ghost({ x: this.x, y: this.y, facing: this.facing, pose: Object.assign({}, this.pose) }, '#ffffff', 0.6, 0.7);
      g.stats.dodges++;
      if (G.Mirror.lv('clarity')) this.critNext = true;
      g.onPerfectDodge();
    }
    takeDamage(d, src, info) {
      const g = this.game;
      this.hp -= d; this.rally = 0; this.flash = 1; this.hurtInv = 0.55;
      const dir = info.waveFrom != null ? Math.sign(this.x - info.waveFrom) || 1 : (src && src.x != null ? Math.sign(this.x - src.x) || 1 : -this.facing);
      this.vx = dir * (info.kb ?? 240); this.vy = Math.min(this.vy, -160);
      G.FX.spark(this.x, this.y - 70, 18, { col: '#7ff4ff', speed: 600 });
      G.FX.flash(this.x, this.y - 70, 90, 0.2, '#ff5d86');
      G.SFX.play('hurt'); g.shake(0.6); g.hitstop(0.07); g.damageFlash();
      g.stats.hitsTaken++;
      if (this.hp <= 0 && G.Boons.onLethal(this)) { this.setState('hurt', 0.03); return; }
      if (this.hp <= 0) { this.hp = 0; this.die(); return; }
      G.DnD.onHurt(this);
      if (G.DnD.armored(this)) { this.vx = 0; this.vy = Math.max(this.vy, 0); G.FX.ring(this.x, this.y - 70, 6, 60, 0.25, '#ff8f6b', 3); return; }
      this.setState('hurt', 0.03);
      if (this.hp < this.maxHp * 0.3) g.bark('lowhp', true);
    }
    die() {
      this.setState('dead', 0.1); this.vx *= 0.5;
      G.SFX.play('death'); this.game.onPlayerDeath();
    }

    /* ------------------------------ visuals ------------------------------ */
    targetPose(dt) {
      const s = this.state, st = this.st, t = this.t;
      switch (s) {
        case 'move': case 'cine': {
          if (!this.onGround) {
            if (this.flipT > 0) return Rig.sample(A.flip, A.flip.dur - this.flipT);
            const k = U.clamp((this.vy + 400) / 800, 0, 1);
            return Rig.lerpPose(Rig.full(A.rise), Rig.full(A.fall), k);
          }
          const sp = Math.abs(this.vx);
          let p;
          const calm = s === 'cine' || !this.game.combatNear;
          if (sp > 40) {
            // advance the gait so planted feet travel back at exactly the body's speed (no foot sliding)
            const walking = s === 'cine' && !this.cineRun;
            const S = walking ? 13 : A.gaitStride(U.clamp(sp / RUN, 0.4, 1));
            this.runP += sp * dt * Math.PI / (2 * S);
            p = (s === 'cine' && !this.cineRun) ? Rig.full(A.walk(this.runP)) : Rig.full(A.run(this.runP, U.clamp(sp / RUN, 0.4, 1)));
          } else p = Rig.full(calm ? A.calm(t) : A.idle(t));
          if (this.landT > 0) p = Rig.lerpPose(p, Rig.full(A.land), this.landT / 0.14);
          return p;
        }
        case 'guard': return Rig.full(A.guard(t));
        case 'parried': return Rig.sample(A.parried, st);
        case 'blocked': return Rig.sample(A.blocked, st);
        case 'light': return Rig.sample((this.step && this.step.anim) || A.light[this.ci], st);
        case 'air': return Rig.sample(A.air, st);
        case 'charge': return Rig.full(A.charge(t, this.chargeK));
        case 'heavy': return Rig.sample(A.heavy, st);
        case 'counter': return Rig.sample(A.light[2], st);
        case 'dodge': return Rig.full(this.back ? A.backstep : A.dodge);
        case 'hurt': case 'guardBreak': return Rig.full(A.hurt);
        case 'heal': return Rig.sample(A.heal, st);
        case 'skill1': return Rig.sample(A.skill1, st);
        case 'skill2': return Rig.sample(A.skill2, st);
        case 'cskill': return G.DnD.skillPose(this, A, Rig);
        case 'execute': return Rig.sample(A.execute, st);
        case 'rest': return Rig.full(A.rest(t));
        case 'dead': return Rig.sample(A.dead, st);
      }
      return Rig.full(A.idle(t));
    }
    animFor(s) {
      return { light: (this.step && this.step.anim) || A.light[this.ci], air: A.air, heavy: A.heavy, counter: A.light[2], skill1: A.skill1, execute: A.execute, skill2: A.skill2 }[s];
    }
    sampleTrail(st0, st1, now) {
      const an = this.animFor(this.state); if (!an) return;
      const n = 4;
      for (let k = 1; k <= n; k++) {
        const tt = st0 + (st1 - st0) * (k / n);
        const J = Rig.compute(Rig.sample(an, Math.max(0, tt)));
        const lm = (this.gear && this.gear.look && this.gear.look.len) || 1;
        const tx = J.hdF.x + (J.tip.x - J.hdF.x) * lm, ty = J.hdF.y + (J.tip.y - J.hdF.y) * lm;
        const bx = J.hdF.x + (tx - J.hdF.x) * 0.3, by = J.hdF.y + (ty - J.hdF.y) * 0.3;
        this.trail.push(this.x + this.facing * bx, this.y + by, this.x + this.facing * tx, this.y + ty, now - (1 - k / n) * (st1 - st0));
      }
    }
    updHair(dt) {
      const J = this.J, f = this.facing;
      const ha = J.ha, c = Math.cos(ha), s = Math.sin(ha);
      const lx = J.head.x + (-9.6 * c - (-5.6) * s), ly = J.head.y + (-9.6 * s + (-5.6) * c);
      const ax = this.x + f * lx, ay = this.y + ly;
      const wind = -this.vx * 9 + Math.sin(this.t * 1.7) * 280 - 160 * f * 0 + Math.sin(this.t * 0.6) * 120;
      this.hair.update(ax, ay, f, dt, wind, 2.62);
      this.rib1.update(ax, ay, f, dt, wind * 1.3, 2.2);
      this.rib2.update(ax, ay + 1, f, dt, wind * 1.5, 2.6);
      // coat tails swing with the hips and never sink into the floor; the scarf streams behind
      const an = Rig.clothAnchors(J), CL = Rig.CLOTH;
      const floor = this.onGround ? this.y - 0.5 : 1e9;
      for (const [k, wk] of [['coatB', 0.45], ['coatF', 0.35], ['scarf', 1.25]]) {
        const a = an[k], ch = this[k];
        ch.update(this.x + f * a.x, this.y + a.y, f, dt, wind * wk, CL[k][4]);
        for (const q of ch.p) if (q.y > floor) q.y = floor;
      }
    }
    draw(ctx, now) {
      // charge aura
      if (this.state === 'charge' || (this.res >= 100 && this.state === 'move')) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const k = this.state === 'charge' ? this.chargeK : 0.3 + Math.sin(this.t * 4) * 0.1;
        const r = 60 + k * 30, gx = this.x, gy = this.y - 60;
        const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        gr.addColorStop(0, `rgba(111,243,255,${0.18 * k})`); gr.addColorStop(1, 'rgba(111,243,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
        ctx.restore();
      }
      // ground contact shadow
      const gy = G.Phys.groundBelow(this.x, this.y - 2);
      if (gy < 1e8) {
        // landing marker: stays visible through the whole jump so the touchdown spot is always readable
        const k = U.clamp(1 - (gy - this.y) / 700, 0.4, 1);
        ctx.fillStyle = `rgba(10,8,12,${0.35 * k})`; ctx.beginPath(); ctx.ellipse(this.x, gy, 26 * k, 4 * k, 0, 0, PI * 2); ctx.fill();
        if (gy - this.y > 40) { ctx.strokeStyle = `rgba(111,243,255,${0.55 * k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(this.x, gy, 20, 3.5, 0, 0, PI * 2); ctx.stroke(); }
      }
      const blink = this.hurtInv > 0 && Math.floor(this.t * 30) % 2 === 0 ? 0.65 : 1;
      ctx.globalAlpha = blink;
      Rig.drawRinne(ctx, this.x, this.y, this.facing, this.pose, { hair: this.hair, rib1: this.rib1, rib2: this.rib2, coatB: this.coatB, coatF: this.coatF, scarf: this.scarf },
        { flash: this.flash, bladeGlow: this.counterT > 0 ? 0.6 : 0, blade: this.gear && this.gear.look, offhand: G.DnD.offhand(this.gear && this.gear.look), outfit: G.DnD.outfit(this.gear && this.gear.outfit) });
      ctx.globalAlpha = 1;
      G.DnD.drawSpirit(ctx, this);
      if (!G.DnD.noTrail() || this.state === 'execute') this.trail.draw(ctx, now, 0.12, this.state === 'execute' ? '#ffffff' : G.DnD.trailCol() || (this.gear && this.gear.look && this.gear.look.col) || '#6ff3ff', '#ffffff');
    }
  }
  G.Player = Player;
})(window.G);

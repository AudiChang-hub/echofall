'use strict';
/* ECHOFALL — shared pursuit layer for regular Hushborn (bosses and elites keep their own scripts).
   Each type's think() still chooses its attacks and spacing; this layer only fixes the "dumb" parts it measured:
   · sight: a foe that sees you (≈ 1¼ screens) comes for you, faster the further away you are
   · levels: you on a ledge → it climbs (jumps up to the ledge); you below → it drops through or walks off the edge
   · crowds: at most two melee foes swing at once; extra ones spread to your other side and wait for an opening
   · leash: run far enough away and it gives up and walks back to where it started
   Measured with tools/test.html#ai (seconds until each foe engages an idle player far away / above / below). */
(function (G) {
  const U = G.U;
  // foes that fight from range (their own think keeps the distance; we only bring them into range)
  const RANGED = new Set(['shrieker', 'c2_tetherling', 'c3_echobat', 'c3_borer', 'c4_chorister', 'c4_pitwyrm', 'c4_usher', 'c5_driftwatch', 'c5_mender',
    'c6_tuner', 'c7_restmark', 'c7_choir', 'c7_fermata', 'c8_cadence', 'c8_coda', 'c8_elite_bell']);
  // foes whose whole design is that they cannot see you (they wake on noise, or when struck)
  const STEALTH = new Set(['c3_listener']);
  const SIGHT = 1500, LEASH = 2400, MAX_MELEE = 2;

  // how far a foe's melee reaches, read from its attack hit boxes
  function reachOf(T) {
    let r = 0;
    for (const k in T) { const a = T[k]; if (a && a.hits) for (const h of a.hits) if (h.box) r = Math.max(r, h.box.x + h.box.w); }
    return U.clamp(r || 140, 90, 320);
  }
  // the ledge (solid top or one-way) under a point
  function ledgeAt(x, y) {
    const L = G.LEVEL;
    for (const p of L.oneways) if (x >= p.x - 4 && x <= p.x + p.w + 4 && Math.abs(p.y - y) < 4) return { x: p.x, w: p.w, y: p.y, oneway: true };
    for (const s of G.Phys.allSolids()) if (x >= s.x - 4 && x <= s.x + s.w + 4 && Math.abs(s.y - y) < 4) return { x: s.x, w: s.w, y: s.y };
    return null;
  }
  const meleeBusy = (except) => {
    let n = 0; const P = G.game.player;
    for (const o of G.game.enemies) if (o !== except && !o.dead && !o.boss && !o.elite && o.state === 'atk' && !RANGED.has(o.type) && Math.abs(o.x - P.x) < 520) n++;
    return n;
  };

  const AI = G.AI = {
    RANGED, STEALTH,
    // called from Enemy.startAtk: hold back a third melee swing so a crowd takes turns
    deny(e) {
      if (e.boss || e.elite || e.state === 'atk' || RANGED.has(e.type)) return false;
      return meleeBusy(e) >= MAX_MELEE;
    },
    // called every frame a regular foe is free to move (after its own think)
    pursue(e, dt) {
      const T = e.T, P = e.P, g = G.game;
      if (!P || P.state === 'dead' || T.ai === false || g.state !== 'play') return;
      const A = e._ai || (e._ai = { aware: false, home: e.x, jumpCd: 0.6, dropT: 0, lastX: e.x, stuckT: 0, reach: reachOf(T), ranged: RANGED.has(e.type) });
      A.jumpCd -= dt;
      if (A.dropT > 0) { A.dropT -= dt; e.dropThrough = A.dropT > 0; }
      const dx = P.x - e.x, adx = Math.abs(dx), dy = P.y - e.y, dir = Math.sign(dx) || e.facing;
      // awareness
      if (!A.aware) {
        if (STEALTH.has(e.type) ? (e.aware || e.hp < e.maxHp) : (adx < SIGHT && Math.abs(dy) < 700) || e.hp < e.maxHp) A.aware = true;
        else return;
      }
      if (adx > LEASH) {   // gave up: walk home
        A.aware = false;
        if (Math.abs(A.home - e.x) > 40 && !e.fly) { e.vx = U.approach(e.vx, Math.sign(A.home - e.x) * 160, 900 * dt); e.facing = Math.sign(A.home - e.x) || e.facing; }
        return;
      }
      const sameLevel = Math.abs(dy) < 110;
      const engage = A.ranged ? 640 : A.reach + 60;
      // ---- crowd: if this side is already taken by a closer melee foe, circle to the open side
      let goalX = P.x;
      if (!A.ranged && !e.fly && sameLevel && adx < 600) {
        let closerSame = 0, other = 0;
        for (const o of g.enemies) {
          if (o === e || o.dead || o.boss || o.fly || RANGED.has(o.type) || Math.abs(o.y - P.y) > 110) continue;
          const os = Math.sign(o.x - P.x);
          if (os === -dir && Math.abs(o.x - P.x) < adx) closerSame++;
          else if (os === dir) other++;
        }
        if (closerSame >= 1 && other === 0 && !G.Phys.allSolids().some((s) => s.y < P.y - 10 && s.y + s.h > P.y - 60 && Math.abs(s.x + s.w / 2 - (P.x + dir * 150)) < s.w / 2 + 30)) {
          goalX = P.x + dir * (A.reach + 40);   // walk through to your other side
          e.flank = true;
        } else e.flank = false;
      }
      const gdx = goalX - e.x, gad = Math.abs(gdx), gdir = Math.sign(gdx) || dir;
      // ---- close the distance (fast when far)
      const want = e.flank ? 40 : engage;
      if (gad > want || (!sameLevel && !e.fly)) {
        const far = U.clamp((gad - want) / 600, 0, 1);
        const chase = (e.fly ? 270 : 260) * (1 + 0.9 * far) * (e.speedMul || 1);
        // clearly out of reach: run (many thinks assign vx outright every frame, so set it, don't nudge it)
        if (gad > want + 140) { if (Math.sign(e.vx) !== gdir || Math.abs(e.vx) < chase) e.vx = gdir * chase; }
        else if (Math.sign(e.vx) !== gdir || Math.abs(e.vx) < chase) e.vx = U.approach(e.vx, gdir * chase, 1700 * dt);
        if (!e.flank) e.facing = dir;
      }
      if (e.fly) return;
      // ---- levels
      if (dy < -90 && P.onGround) {
        // you are above: get under your ledge, then jump onto it
        const led = ledgeAt(P.x, P.y), h = e.y - P.y;
        if (led && h <= 360) {
          const tx = U.clamp(e.x, led.x + 30, led.x + led.w - 30), near = Math.abs(tx - e.x);
          if (near > 150) e.vx = U.approach(e.vx, Math.sign(tx - e.x) * 300 * (e.speedMul || 1), 1800 * dt);
          else if (e.onGround && A.jumpCd <= 0) {
            const grav = 2400 * (G.LEVEL.gravity || 1), vy = Math.sqrt(2 * grav * (h + 60));
            const tUp = vy / grav;
            e.vy = -vy; e.vx = U.clamp((tx + Math.sign(tx - e.x || dir) * 40 - e.x) / Math.max(0.25, tUp * 1.6), -380, 380);
            A.jumpCd = 1.4; G.FX.dust(e.x, e.y, 6, { w: 30, speed: 160, size: 9 });
          }
        }
      } else if (dy > 90) {
        // you are below: drop through a one-way, or keep walking off the edge
        const led = ledgeAt(e.x, e.y);
        if (led && led.oneway && e.onGround && A.dropT <= 0) { A.dropT = 0.3; e.dropThrough = true; e.y += 2; }
        else if (gad < 60) e.vx = U.approach(e.vx, gdir * 220, 1700 * dt);
      }
      // ---- walls: blocked while chasing → hop
      if (Math.abs(e.x - A.lastX) < 0.5 && Math.abs(e.vx) > 60 && e.onGround && A.jumpCd <= 0 && gad > 80) {
        A.stuckT += dt;
        if (A.stuckT > 0.25) { e.vy = -Math.sqrt(2 * 2400 * (G.LEVEL.gravity || 1) * 230); A.jumpCd = 1.2; A.stuckT = 0; }
      } else A.stuckT = 0;
      A.lastX = e.x;
    },
  };
})(window.G);

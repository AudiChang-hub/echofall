'use strict';
/* ECHOFALL — Chapter III foes (回頭路 THE WAY BACK)
   c3_carapace 晶甲蟹 · c3_echobat 回音蝠 · c3_listener 深聽者 · c3_borer 鑽岩蟲 · elite c3_elite 爆破手・莫格
   Hand-inked Canvas art, no images. API: docs/CHAPTER_API.md §4–5 · spec: docs/STORY.md §3 (III).
   Dev aid: add ?c3hb=1 to the URL to see every attack's hit boxes (yellow = pending, red = live). */
(function (G) {
  const K = G.EnemyKit, { TYPES, U, Rig, PI, TAU } = K;
  const INK = Rig.INK;
  const DEV = /[?&]c3hb=1/.test((typeof location !== 'undefined' && location.search) || '');
  const LOW = () => !!(G.Quality && G.Quality.low);
  const COL = {
    violet: '#b48cff', amethyst: '#8a5cf0', teal: '#5ff2d6', magenta: '#ff4fa8', amber: '#ffc861', ember: '#ff8a3d',
    shell: '#3d6773', shellD: '#1d2c38', bone: '#cdbfd6', rock: '#8c6e52', fin: '#b06cff', coat: '#b8622b', brass: '#cf9b3e', steel: '#8d96a8',
  };

  /* =========================== shared drawing kit =========================== */
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const k01 = (v) => U.clamp(v, 0, 1);
  const ease = U.easeInOutSine, eout = U.easeOutCubic;
  function path(ctx, pts, close = true) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (close) ctx.closePath();
  }
  // smooth closed outline through the midpoints of a control polygon
  function blob(ctx, pts) {
    const n = pts.length, m = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
    ctx.beginPath(); const s = m(n - 1); ctx.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) { const q = m(i); ctx.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); }
    ctx.closePath();
  }
  function ink(ctx, w = 1.2) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  // hard-stop cel fill lit from the scene's key light (upper right of the screen, mirrored with the foe)
  function lit(ctx, col, cx, cy, w) { const L = Rig.lightDir(ctx); return Rig.celGrad(ctx, cx, cy, L.x, L.y, w, 1, Rig.ramp(col)); }
  // continuous tapered tube through joints (same outline as Rig.limbChain, any fill)
  function tube(ctx, pts, ws) {
    const n = pts.length, Lp = [], Rp = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      Lp.push({ x: pts[i].x - dy / d * ws[i], y: pts[i].y + dx / d * ws[i] }); Rp.push({ x: pts[i].x + dy / d * ws[i], y: pts[i].y - dx / d * ws[i] });
    }
    ctx.beginPath(); ctx.moveTo(Lp[0].x, Lp[0].y);
    for (let i = 1; i < n; i++) { if (i < n - 1) { const m = mid(Lp[i], Lp[i + 1]); ctx.quadraticCurveTo(Lp[i].x, Lp[i].y, m.x, m.y); } else ctx.lineTo(Lp[i].x, Lp[i].y); }
    const t1 = Math.atan2(pts[n - 1].y - pts[n - 2].y, pts[n - 1].x - pts[n - 2].x);
    ctx.arc(pts[n - 1].x, pts[n - 1].y, ws[n - 1], t1 + PI / 2, t1 - PI / 2, true);
    for (let i = n - 2; i >= 0; i--) { if (i > 0) { const m = mid(Rp[i], Rp[i - 1]); ctx.quadraticCurveTo(Rp[i].x, Rp[i].y, m.x, m.y); } else ctx.lineTo(Rp[0].x, Rp[0].y); }
    const t0 = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    ctx.arc(pts[0].x, pts[0].y, ws[0], t0 - PI / 2, t0 + PI / 2, true);
    ctx.closePath();
  }
  function tubeFlat(ctx, pts, ws, fill, w = 1) { tube(ctx, pts, ws); ctx.fillStyle = fill; ctx.fill(); ink(ctx, w); }
  function glowAt(ctx, x, y, r, col, a) { if (a <= 0.02) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, r, col, Math.min(1, a)); ctx.restore(); }
  // faceted crystal: two cel facets split along the ridge, ink contour and a glint (ang 0 = straight up)
  function shard(ctx, x, y, len, ang, w, col) {
    const dx = Math.sin(ang), dy = -Math.cos(ang), nx = -dy, ny = dx, r = Rig.ramp(col), L = Rig.lightDir(ctx);
    const litL = nx * L.x + ny * L.y >= 0;
    const tx = x + dx * len, ty = y + dy * len, Lx = x + nx * w, Ly = y + ny * w, Rx = x - nx * w, Ry = y - ny * w, mx = x + dx * len * 0.2, my = y + dy * len * 0.2;
    ctx.beginPath(); ctx.moveTo(Lx, Ly); ctx.lineTo(tx, ty); ctx.lineTo(mx, my); ctx.closePath(); ctx.fillStyle = litL ? r.lit : r.dark; ctx.fill();
    ctx.beginPath(); ctx.moveTo(Rx, Ry); ctx.lineTo(tx, ty); ctx.lineTo(mx, my); ctx.closePath(); ctx.fillStyle = litL ? r.dark : r.lit; ctx.fill();
    ctx.beginPath(); ctx.moveTo(Lx, Ly); ctx.lineTo(tx, ty); ctx.lineTo(Rx, Ry); ctx.closePath(); ink(ctx, 0.9);
    ctx.strokeStyle = r.hi; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(tx - dx * 1.5, ty - dy * 1.5); ctx.stroke();
  }
  // two-bone reach: elbow position between a and b (bent upward or downward)
  function ik2(a, b, l1, l2, up = true) {
    const dx = b.x - a.x, dy = b.y - a.y, d = U.clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.1);
    const base = Math.atan2(dy, dx), al = Math.acos(U.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const c1 = { x: a.x + Math.cos(base - al) * l1, y: a.y + Math.sin(base - al) * l1 }, c2 = { x: a.x + Math.cos(base + al) * l1, y: a.y + Math.sin(base + al) * l1 };
    return up ? (c1.y < c2.y ? c1 : c2) : (c1.y > c2.y ? c1 : c2);
  }
  // run extra per-frame logic after the engine's update (timers that must tick in every state)
  function hookUpdate(e, fn) { const base = e.update; e.update = function (dt) { base.call(this, dt); fn(this, dt); }; }
  const toW = (e, p, s = 1) => ({ x: e.x + e.facing * p.x * s, y: e.y + p.y * s });

  // spawn rise (ground foes come up through the floor, clipped at the surface), body draw, death dissolve
  function frame(ctx, e, o, body) {
    const sinkK = K.emerge(ctx, e);
    const dying = e.state === 'die' ? k01(e.st / 0.5) : 0;
    ctx.save();
    if (o.fly) { ctx.globalAlpha *= 1 - sinkK; ctx.translate(e.x, e.y - sinkK * 70); }
    else {
      if (sinkK > 0) { ctx.beginPath(); ctx.rect(e.x - 600, e.y - 1000, 1200, 1002); ctx.clip(); }
      ctx.translate(e.x, e.y + sinkK * o.h);
    }
    ctx.scale(e.facing, 1);
    if (!dying) body(ctx);
    else {
      // the Hush lets go: the body splits into drifting slices that burn away in the foe's colour
      const n = 5, H = o.h + 40, rng = U.mulberry32(e.seed || 7), a0 = ctx.globalAlpha;
      for (let i = 0; i < n; i++) {
        const y0 = i === 0 ? -3000 : -H + (H / n) * i, y1 = i === n - 1 ? 3000 : -H + (H / n) * (i + 1);
        const ox = (rng() - 0.5) * 80 * dying, oy = -(14 + rng() * 46) * dying * dying;
        ctx.save(); ctx.beginPath(); ctx.rect(-500, y0, 1000, y1 - y0); ctx.clip();
        ctx.translate(ox, oy); ctx.globalAlpha = a0 * Math.pow(1 - dying, 1.3); body(ctx);
        ctx.restore();
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(e.T.col, 0.85 * (1 - dying)); ctx.lineWidth = 2.5;
      for (let i = 1; i < n; i++) { const y = -H + (H / n) * i - 30 * dying; ctx.beginPath(); ctx.moveTo(-o.w * (0.5 + dying), y); ctx.lineTo(o.w * (0.5 + dying), y); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }
  // dev overlay: the live attack boxes in world space (?c3hb=1)
  function devBoxes(ctx, e) {
    if (!DEV) return;
    ctx.save(); ctx.lineWidth = 2;
    const b = e.box; ctx.strokeStyle = 'rgba(80,255,140,0.7)'; ctx.strokeRect(b.x, b.y, b.w, b.h);
    if (e.atk) for (const h of e.atk.hits || []) {
      const w = e.boxW(h.box), on = e.st >= h.t0 && e.st <= h.t1;
      ctx.strokeStyle = on ? '#ff2040' : 'rgba(255,230,0,0.8)'; ctx.strokeRect(w.x, w.y, w.w, w.h);
      if (on) { ctx.fillStyle = 'rgba(255,32,64,0.2)'; ctx.fillRect(w.x, w.y, w.w, w.h); }
    }
    ctx.restore();
  }
  const once = (key, fn) => { const F = G.game && G.game.save && G.game.save.flags; if (!F || F[key]) return; F[key] = true; fn(); };

  /* =========================== sounds =========================== */
  const S = G.SFX, AK = () => G.AudioKit;
  S.c3_clack = (t) => { const A = AK(); for (let i = 0; i < 3; i++) A.noise(t + i * 0.05, 0.001, 0.12, 0.03, 'bandpass', 2300 + i * 350, 1700, 5, 0.05); A.tone('square', 170, t, 0.002, 0.03, 0.08, { to: 110, filter: 'lowpass', ff: 700 }); };
  S.c3_clink = (t) => { const A = AK(); A.bell(1850 + Math.random() * 400, t, 0.05, 0.45, 0.35, 1.3); A.noise(t, 0.001, 0.08, 0.05, 'highpass', 4200, null, 0.7, 0.1); };
  S.c3_shatter = (t) => {
    const A = AK(); [0, 0.03, 0.07, 0.12, 0.18].forEach((d, i) => A.bell(1300 + i * 380 + Math.random() * 200, t + d, 0.06, 0.7, 0.45, 1.5));
    A.noise(t, 0.002, 0.28, 0.4, 'highpass', 2400, 6500, 0.7, 0.3); A.tone('sine', 95, t, 0.003, 0.32, 0.3, { to: 38 });
  };
  S.c3_chirp = (t) => { const A = AK(); for (let i = 0; i < 3; i++) A.tone('sine', 3600 + i * 300, t + i * 0.06, 0.002, 0.03, 0.05, { to: 5400, wet: 0.5 }); };
  S.c3_sonar = (t) => { const A = AK(); A.tone('sine', 1600, t, 0.004, 0.06, 0.4, { to: 640, wet: 0.75 }); A.tone('sine', 3150, t, 0.004, 0.022, 0.3, { to: 1300, wet: 0.75 }); };
  S.c3_keen = (t) => {
    const A = AK(); A.tone('triangle', 1240, t, 0.05, 0.05, 0.75, { to: 380, wet: 0.65 }); A.tone('sine', 1255, t + 0.01, 0.05, 0.03, 0.75, { to: 392, wet: 0.65 });
    for (let i = 0; i < 4; i++) A.noise(t + 0.05 + i * 0.06, 0.001, 0.07, 0.02, 'bandpass', 1400 + i * 120, null, 6, 0.05);
  };
  S.c3_snap = (t) => { const A = AK(); A.noise(t, 0.01, 0.17, 0.22, 'bandpass', 5200, 1400, 2, 0.3); A.tone('sine', 2100, t, 0.002, 0.05, 0.16, { to: 3400, wet: 0.5 }); A.bell(2600, t + 0.02, 0.03, 0.5, 0.6, 1.2); };
  S.c3_rumble = (t) => { const A = AK(); A.noise(t, 0.08, 0.22, 0.6, 'lowpass', 240, 80, 0.8, 0.15); A.tone('sine', 50, t, 0.05, 0.26, 0.6, { to: 34 }); };
  S.c3_burst = (t) => { const A = AK(); A.noise(t, 0.003, 0.36, 0.55, 'lowpass', 1400, 140, 0.7, 0.2); A.tone('sine', 72, t, 0.003, 0.42, 0.45, { to: 30 }); S.crystal(t + 0.02, 3); };
  S.c3_grind = (t) => { const A = AK(); A.tone('sawtooth', 92, t, 0.03, 0.06, 0.45, { to: 150, filter: 'bandpass', ff: 900, q: 2 }); A.noise(t, 0.02, 0.07, 0.4, 'bandpass', 1800, 900, 3, 0.08); };
  S.c3_mog = (t, k = 1) => {
    const A = AK(); A.tone('sawtooth', 112 * k, t, 0.02, 0.08, 0.32, { to: 78 * k, filter: 'bandpass', ff: 620, q: 1.6, wet: 0.12 });
    A.tone('square', 56 * k, t, 0.02, 0.04, 0.3, { to: 44 * k, filter: 'lowpass', ff: 300 }); A.noise(t + 0.02, 0.04, 0.09, 0.35, 'bandpass', 1600, 700, 1.2, 0.1);
  };
  S.c3_fuse = (t) => { const A = AK(); A.noise(t, 0.01, 0.06, 0.45, 'highpass', 5200, 7400, 0.8, 0.05); };
  S.c3_blast = (t) => { const A = AK(); A.tone('sine', 62, t, 0.003, 0.55, 0.65, { to: 27, wet: 0.2 }); A.noise(t, 0.002, 0.42, 0.75, 'lowpass', 2600, 110, 0.6, 0.3); S.crystal(t + 0.03, 4); };

  /* =========================== codex / data =========================== */
  const D = G.DATA;
  D.speakers.c3_mog = D.speakers.c3_mog || { name: '莫格', en: 'MOG', color: '#ff9a4d' };
  Object.assign(D.barks, {
    c3_eliteP2: { who: 'c3_mog', text: '引信……已經點著了。這一次，上面一定聽得見。' },
    c3_bk_shield: { who: 'ode', text: '……碎了。' },
    c3_bk_heard: { who: 'ode', text: '……牠聽見了。' },
    c3_bk_borer: { who: 'ode', text: '……在底下。' },
  });
  Object.assign(D.hints, {
    c3_h_carapace: '晶甲蟹的盾從正面打不穿。持續攻擊晶盾 <b>六下</b> 就能把它震碎，或用 {dodge} 繞到牠背後。',
    c3_h_listener: '深聽者看不見，但聽得見。<b>奔跑、攻擊、翻滾</b> 都會發出聲音——耳扇越亮越危險。停下來，聲音就會散去。',
    c3_h_borer: '鑽岩蟲在地底時無法被攻擊。地面 <b>裂開泛紅</b> 時立刻 {dodge} 閃開，牠破土後才是反擊的時機。',
  });
  D.relics.c3_fuse = { name: '引信', desc: '對菁英與頭目的處決傷害 +50%' };
  const pushCodex = (k, entry) => { D.codex[k] = D.codex[k] || []; if (!D.codex[k].some((q) => q.id === entry.id)) D.codex[k].push(entry); };
  pushCodex('items', { id: 'c3_fuse', name: '引信', en: 'THE FUSE', unlock: 'relic_c3_fuse', relic: true, body: ['莫格留下的最後一條引信。末端一點火星，十八年不肯熄。他一直在等，等上面傳來一聲回應。', '遺物效果：對菁英與頭目的處決傷害 +50%。'] });
  [
    { id: 'c3_carapace', name: '晶甲蟹', en: 'CARAPACE', tag: '寂裔｜中階・重甲', body: [
      '棲息在化石管風琴之間的大型甲殼類。牠把寂靜結晶養成一面塔盾，一輩子扛在身前。',
      '攻擊模式：鉗擊重砸（白光，閃開）／快鉗（白光）／盾衝（紅光，必須閃避）。正面的攻擊會被晶盾彈開，盾上的裂痕會越來越多。',
      '弱點：晶盾裂到第六道就會碎。牠轉身很慢——翻滾繞到背後，甲殼底下是軟的。'] },
    { id: 'c3_echobat', name: '回音蝠', en: 'ECHO BAT', tag: '寂裔｜低階・飛行群聚', body: [
      '沒有眼睛的洞穴蝙蝠，一對碟形巨耳能聽見三條隧道外的心跳。總是三、四隻一起盤旋，輪流出手。',
      '攻擊模式：先發出一圈聲納掃描，再俯衝撲擊（白光）；也會吐出聲波彈（白光，彈不回去，閃開）。',
      '弱點：俯衝之後會貼著地面滑行一小段，那是砍牠的時機。被擊落後會掉在地上掙扎。', '掘路營的礦工說，牠們在黑暗裡聽的不是獵物，是自己的回音。'] },
    { id: 'c3_listener', name: '深聽者', en: 'DEEP LISTENER', tag: '寂裔｜中階・潛伏', body: [
      '高瘦、沒有眼睛的東西。頭顱後方張著兩片巨大的耳扇，一動也不動地站在黑暗裡「聽」。',
      '牠靠聲音狩獵：奔跑、攻擊、翻滾都會被聽見——耳扇越亮，代表牠聽得越清楚。停下腳步，聲音會慢慢散去。',
      '攻擊模式：聽見聲音的瞬間，以紅光撲擊（必須閃避）；近身時雙爪連抓（白光、白光）。',
      '弱點：在牠察覺之前出手，可以造成奇襲傷害。'] },
    { id: 'c3_borer', name: '鑽岩蟲', en: 'BORER', tag: '寂裔｜中階・地底', body: [
      '鑽穿回頭路岩盤的分節巨蟲。哈德爾的掘路日誌裡，把牠叫做「會自己找路的鑽頭」——牠找到的路，全都往下。',
      '在地底時無法被攻擊——留意滑過地面的晶鰭。地面龜裂、透出紅光時，牠就要破土而出（紅光，必須閃避）。',
      '攻擊模式：破土突襲（紅光）／甩身橫掃（白光）。', '弱點：破土之後牠會在地面上停留一陣子，再鑽回地底。'] },
    { id: 'c3_elite', name: '爆破手・莫格', en: 'MOG THE SAPPER', tag: '菁英｜掘路隊爆破手', body: [
      '掘路隊的爆破手。同伴一個個長進岩壁之後，他仍然守著最後一批火藥——和一條他不肯讓任何人通過的坑道。',
      '攻擊模式：十字鎬二連擊（白光）／高舉後停頓的延遲重劈（白光，別太早閃避）／低掃（白光）／投擲晶體炸藥（落地後紅圈，離開範圍）／重鎬砸地，晶刺沿地面竄出（紅光）。',
      '半血之後，背包裡的晶體炸藥全數覺醒：一次投出三枚，並會接上更長的連擊。', '「炸得夠響，上面就聽得見。……他們一定聽得見。」'] },
  ].forEach((c) => pushCodex('hushborn', Object.assign({ portrait: c.id, unlock: 'seen_' + c.id }, c)));

  /* =========================== 晶甲蟹 CARAPACE =========================== */
  // a squat cave crab carrying a tower shield of grown amethyst; slow to turn, guards everything in front of it
  function makeCracks(seed) {
    const rng = U.mulberry32(seed), out = [];
    for (let i = 0; i < 6; i++) {
      let x = 2 + rng() * 10, y = -40 + rng() * 80; const pts = [[x, y]];
      for (let k = 0; k < 4; k++) { x = U.clamp(x + (rng() - 0.5) * 9, -2, 13); y += (rng() < 0.5 ? -1 : 1) * (6 + rng() * 10); pts.push([x, U.clamp(y, -50, 46)]); }
      out.push(pts);
    }
    return out;
  }
  function crShatter(e) {
    if (!e.shield) return;
    e.shield = 0; e.regrow = 8.5; e.crack = 0; e.shieldK = 0;
    const w = e.wpShield || { x: e.x + e.facing * 54, y: e.y - 54 };
    G.FX.shards(w.x, w.y, 26, COL.violet, 640); G.FX.ring(w.x, w.y, 8, 130, 0.45, COL.violet, 6); G.FX.flash(w.x, w.y, 150, 0.3, '#eadcff');
    G.FX.spark(w.x, w.y, 20, { col: '#f3e8ff', speed: 760 });
    G.SFX.play('c3_shatter'); G.game.shake(0.5); G.game.hitstop(0.09);
    e.bal = Math.min(e.maxBal, e.bal + e.maxBal * 0.35); e.balT = 0; e.showBar = 3;
    if (e.state !== 'broken' && e.state !== 'recoil') { e.atk = null; e.setState('hurt'); e.hurtDur = 0.8; e.vx = -e.facing * 150; }
    once('c3_bk_shield', () => G.game.bark('c3_bk_shield'));
  }
  function crabPose(e) {
    const T = TYPES.c3_carapace, st = e.st, A = e.state === 'atk' ? e.atk : null, t = e.t;
    // cx,cy = the pincer's tip; open = how far the pincer gapes; shield pivot offsets / tilt
    const p = { cx: 64, cy: -112 + Math.sin(t * 2.2) * 2, open: 0.15 + Math.max(0, Math.sin(t * 1.4)) * 0.4, bodyY: Math.sin(t * 2.2) * 1.2, lean: 0, tilt: 0, shX: 0, shY: 0, rot: 0, eyeDrop: 0, eyeSpin: 0 };
    if (A === T.slam) {
      const k1 = eout(k01(st / 0.64)), k2 = k01((st - 0.68) / 0.08), k3 = ease(k01((st - 1.08) / 0.42));
      let x = U.lerp(64, 18, k1), y = U.lerp(-112, -180, k1); p.open = U.lerp(0.15, 1, k1);
      if (k2 > 0) { x = U.lerp(18, 122, k2); y = U.lerp(-180, -6, k2 * k2); p.open = 1 - k2; }
      if (k3 > 0) { x = U.lerp(122, 64, k3); y = U.lerp(-6, -112, k3); p.open = 0.15 * k3; }
      p.cx = x + (st > 0.48 && st < 0.68 ? Math.sin(t * 70) * 1.5 : 0); p.cy = y;
      p.bodyY = -5 * k1 * (1 - k2) + 6 * k2 * (1 - k3); p.lean = 7 * k2 * (1 - k3) - 5 * k1 * (1 - k2);
    } else if (A === T.snip) {
      const k1 = eout(k01(st / 0.55)), k2 = k01((st - 0.6) / 0.05), k3 = ease(k01((st - 0.78) / 0.27));
      let x = U.lerp(64, 30, k1), y = U.lerp(-112, -128, k1); p.open = U.lerp(0.15, 1, k1);
      if (k2 > 0) { x = U.lerp(30, 120, k2); y = U.lerp(-128, -100, k2); p.open = 1 - k2; }
      if (k3 > 0) { x = U.lerp(120, 64, k3); y = U.lerp(-100, -112, k3); p.open = 0.15 * k3; }
      p.cx = x; p.cy = y; p.lean = 6 * k2 * (1 - k3) - 4 * k1 * (1 - k2);
    } else if (A === T.charge) {
      const k1 = eout(k01(st / 0.6)), k3 = ease(k01((st - 1.2) / 0.5)), w = k1 * (1 - k3);
      p.tilt = 0.3 * w; p.shX = 10 * w; p.shY = 5 * w; p.cx = U.lerp(64, 44, w); p.cy = U.lerp(-112, -96, w); p.open = 0.05; p.bodyY = 7 * w;
      p.lean = st > 0.7 && st < 1.15 ? 9 : -6 * w * (st < 0.7 ? 1 : 0);
      if (st < 0.7) p.lean += Math.sin(t * 60) * 1.2 * k1;
    }
    if (e.state === 'hurt' || e.state === 'recoil') {
      const w = Math.sin(k01(st / (e.state === 'recoil' ? 0.5 : (e.hurtDur || 0.36))) * PI);
      p.lean -= 12 * w; p.bodyY -= 3 * w; p.open = 0.9 * w; p.cy -= 12 * w; p.cx -= 14 * w; p.eyeDrop = 7 * w; p.tilt -= 0.12 * w;
    }
    if (e.state === 'broken') { p.cx = 112; p.cy = -3; p.open = 0.55 + Math.sin(t * 5) * 0.1; p.tilt = 1.36; p.shX = 34; p.shY = 30; p.bodyY = 10; p.rot = -0.08 + Math.sin(t * 2) * 0.02; p.eyeDrop = 9; p.eyeSpin = t * 5; p.lean = -4; }
    const k = e.hitK; if (k > 0) { p.lean -= 8 * k; p.eyeDrop += 9 * k; p.open = Math.max(p.open, k); }
    return p;
  }
  const LEGX = [-38, -18, 2], KNX = [-26, -10, 12], FTX = [-50, -22, 20];
  function crabLeg(ctx, e, p, i, far, moving) {
    const ph = e.gait + i * 2.1 + (far ? PI : 0), brk = e.state === 'broken';
    const lift = moving ? Math.max(0, Math.sin(ph)) * 9 : 0, sl = moving ? Math.cos(ph) * 8 : 0, o = far ? 8 : 0;
    const hip = { x: LEGX[i] + o + p.lean * 0.5, y: -36 + p.bodyY };
    const foot = { x: FTX[i] * (brk ? 1.3 : 1) + o + sl + (brk ? Math.sin(e.t * 9 + i * 2) * 2.5 : 0), y: -lift - (far ? 2 : 0) };
    const knee = { x: (hip.x + foot.x) / 2 + KNX[i] * 0.7, y: Math.min(hip.y, foot.y) - 30 - lift * 0.5 + (brk ? 14 : 0) };
    if (far) { tubeFlat(ctx, [hip, knee, foot], [3.6, 2.8, 0.9], '#14202b', 1); return; }
    Rig.limbChain(ctx, [hip, knee, foot], [4.6, 3.6, 1.2], COL.shell);
    ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.arc(knee.x, knee.y - 1, 1.1, 0, TAU); ctx.fill();
    // spur + biolight at the knee
    if (!LOW()) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(COL.teal, 0.8); ctx.beginPath(); ctx.arc(knee.x, knee.y + 2, 1.6, 0, TAU); ctx.fill(); ctx.restore(); }
  }
  function crabShell(ctx, e, p) {
    const ox = p.lean, oy = p.bodyY;
    ctx.save(); ctx.translate(ox, oy);
    // underside / gills
    path(ctx, [[34, -34], [-50, -34], [-40, -22], [22, -22]]); ctx.fillStyle = '#121a24'; ctx.fill(); ink(ctx, 1);
    const sp = [[34, -34], [38, -52], [28, -68], [16, -76], [8, -92], [1, -78], [-10, -82], [-20, -98], [-25, -80], [-36, -74], [-48, -86], [-49, -67], [-58, -54], [-54, -38], [-42, -30], [-20, -27], [0, -28], [20, -29]];
    path(ctx, sp); ctx.fillStyle = lit(ctx, COL.shell, -8, -56, 46); ctx.fill(); ink(ctx, 1.7);
    // plate seams + rim highlight
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-50, -48); ctx.quadraticCurveTo(-12, -62, 30, -50); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-28, -76); ctx.quadraticCurveTo(-22, -52, -26, -30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -76); ctx.quadraticCurveTo(10, -52, 6, -29); ctx.stroke();
    ctx.strokeStyle = 'rgba(205,245,255,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-34, -72); ctx.quadraticCurveTo(-6, -82, 24, -66); ctx.stroke();
    // barnacles of crystal along the ridge
    shard(ctx, -18, -80, 16, -0.25, 4, COL.amethyst); shard(ctx, -10, -78, 10, 0.3, 3, '#c9a8ff'); shard(ctx, -44, -76, 12, -0.5, 3.2, COL.amethyst); shard(ctx, 6, -80, 9, 0.2, 2.6, '#c9a8ff');
    // biolight dots along the lower rim
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(COL.teal, 0.9);
    for (let i = 0; i < 6; i++) { const x = -46 + i * 14, y = -33 - Math.sin(i * 1.3) * 2; ctx.beginPath(); ctx.arc(x, y, 1.4 + (i % 2) * 0.6, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = U.rgba(COL.teal, 0.35); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-52, -36); ctx.quadraticCurveTo(-10, -30, 30, -34); ctx.stroke();
    ctx.restore();
    // mouth plates
    path(ctx, [[30, -40], [40, -38], [38, -28], [30, -26]]); ctx.fillStyle = '#26394a'; ctx.fill(); ink(ctx, 0.9);
    ctx.restore();
  }
  function crabEyes(ctx, e, p) {
    const bx = 22 + p.lean, by = -66 + p.bodyY, bob = Math.sin(e.t * 3.1) * 1.5;
    const eyes = [{ x: bx + 13, y: by - 26 + p.eyeDrop + bob }, { x: bx - 2, y: by - 30 + p.eyeDrop * 1.2 - bob * 0.6 }];
    if (e.state === 'broken') { eyes[0].x += 6; eyes[0].y += 8; eyes[1].x -= 4; eyes[1].y += 12; }
    for (const q of eyes) {
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo((bx + q.x) / 2 + 3, (by + q.y) / 2, q.x, q.y + 3); ink(ctx, 4.2);
      ctx.strokeStyle = '#4c7f8c'; ctx.lineWidth = 2.2; ctx.stroke();
    }
    glowAt(ctx, (eyes[0].x + eyes[1].x) / 2, eyes[0].y, 20, COL.amber, e.state === 'broken' ? 0.15 : 0.4 + e.tellT * 0.6);
    for (const q of eyes) {
      ctx.beginPath(); ctx.ellipse(q.x, q.y, 4.4, 5.2, 0.2, 0, TAU); ctx.fillStyle = lit(ctx, COL.amber, q.x, q.y, 5); ctx.fill(); ink(ctx, 1.1);
      ctx.save(); ctx.translate(q.x + 0.8, q.y); ctx.rotate(p.eyeSpin); ctx.fillStyle = INK; ctx.fillRect(-0.7, -3.2, 1.4, 6.4); ctx.restore();
    }
  }
  function crabClaw(ctx, e, p) {
    const S = { x: 12 + p.lean, y: -62 + p.bodyY }, tip = { x: p.cx + p.lean, y: p.cy + p.bodyY * 0.5 };
    let dx = tip.x - S.x, dy = tip.y - S.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const wr = { x: tip.x - dx * 60, y: tip.y - dy * 60 }, el = ik2(S, wr, 32, 36, true);
    Rig.limbChain(ctx, [S, el, wr], [6.6, 5.4, 5.2], COL.shell, { spec: 0.25 });
    ctx.save(); ctx.translate(wr.x, wr.y); ctx.rotate(Math.atan2(dy, dx));
    const op = p.open * 0.72, R = Rig.ramp(COL.shell);
    // movable finger (dactyl) swings open below
    ctx.save(); ctx.translate(30, 5); ctx.rotate(op);
    path(ctx, [[0, -2], [14, -1], [26, -1], [30, 1], [20, 5], [4, 6]]); ctx.fillStyle = R.dark; ctx.fill(); ink(ctx, 1.1);
    ctx.fillStyle = '#e9e0ff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(7 + i * 6, -1.5); ctx.lineTo(9 + i * 6, -4); ctx.lineTo(11 + i * 6, -1.5); ctx.fill(); }
    ctx.restore();
    // fixed finger
    ctx.save(); ctx.translate(30, -4); ctx.rotate(-op * 0.3);
    path(ctx, [[0, -6], [14, -8], [27, -4], [31, 0], [18, 0], [2, 3]]); ctx.fillStyle = R.lit; ctx.fill(); ink(ctx, 1.1);
    ctx.fillStyle = '#e9e0ff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(8 + i * 6, 0.5); ctx.lineTo(10 + i * 6, 3); ctx.lineTo(12 + i * 6, 0.5); ctx.fill(); }
    ctx.restore();
    // palm (propodus)
    blob(ctx, [[-3, -11], [14, -14], [31, -10], [37, -1], [31, 9], [12, 12], [-3, 9], [-7, 0]]); ctx.fillStyle = lit(ctx, COL.shell, 14, 0, 15); ctx.fill(); ink(ctx, 1.5);
    ctx.strokeStyle = 'rgba(205,245,255,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(2, -8); ctx.quadraticCurveTo(16, -12, 28, -7); ctx.stroke();
    shard(ctx, 10, -11, 14, -0.45, 3.6, COL.amethyst); shard(ctx, 18, -12, 9, 0.1, 2.6, '#c9a8ff');
    if (e.tellT > 0) glowAt(ctx, 52, 0, 34, e.tellCol === 'red' ? K.CRIM : '#ffffff', e.tellT);
    ctx.restore();
    return tip;
  }
  function crabShield(ctx, e, p) {
    const k = e.shield ? e.shieldK : 0;
    const px = 56 + p.shX + p.lean, py = -56 + p.bodyY + p.shY;
    Rig.limb(ctx, { x: 26 + p.lean, y: -44 + p.bodyY }, { x: px - 7, y: py + 4 }, 6, 5, COL.shell);
    if (k <= 0.02) { shard(ctx, px - 6, py + 2, 13, 0.5, 4, COL.amethyst); shard(ctx, px - 8, py + 8, 9, 1.4, 3, '#c9a8ff'); shard(ctx, px - 7, py - 3, 7, -0.4, 2.5, '#c9a8ff'); return { x: px, y: py }; }
    ctx.save(); ctx.translate(px, py + (1 - k) * 40); ctx.rotate(p.tilt + (e.shHit > 0 ? Math.sin(e.t * 90) * 0.05 : 0)); ctx.scale(k, k);
    const r = Rig.ramp(COL.amethyst), Lx = Rig.lightDir(ctx).x;
    const out = [[-10, -50], [3, -60], [14, -42], [16, 30], [6, 52], [-8, 46], [-13, 0]];
    path(ctx, out); ctx.fillStyle = r.dark; ctx.fill();
    path(ctx, [[3, -60], [14, -42], [16, 30], [6, 52], [1, 28], [0, -30]]); ctx.fillStyle = Lx > 0 ? r.lit : r.base; ctx.fill();
    path(ctx, [[-10, -50], [3, -60], [0, -30], [-7, -36]]); ctx.fillStyle = r.hi; ctx.fill();
    path(ctx, [[-13, 0], [-7, -36], [0, -30], [1, 28], [-8, 46]]); ctx.fillStyle = Lx > 0 ? r.dark : r.lit; ctx.fill();
    // refraction: an inner light that pulses (brighter while it's being hammered)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (!LOW()) K.glow(ctx, 4, -6, 34, '#c7a4ff', 0.28 + e.shHit * 1.6 + Math.sin(e.t * 2) * 0.05);
    ctx.strokeStyle = 'rgba(240,226,255,0.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(9, -40); ctx.lineTo(11, 10); ctx.stroke();
    ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(5, -20); ctx.lineTo(6, 34); ctx.stroke();
    ctx.restore();
    // cracks (a map of every blow it absorbed)
    for (let i = 0; i < Math.min(e.crack, 6); i++) {
      const c = e.cracks[i]; ctx.beginPath(); ctx.moveTo(c[0][0], c[0][1]); for (let j = 1; j < c.length; j++) ctx.lineTo(c[j][0], c[j][1]);
      ink(ctx, 1.3); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba('#f0e2ff', 0.5 + e.crack * 0.07); ctx.lineWidth = 0.6; ctx.stroke(); ctx.restore();
    }
    ctx.strokeStyle = 'rgba(11,6,18,0.5)'; ctx.lineWidth = 0.8; path(ctx, [[3, -60], [0, -30], [1, 28], [6, 52]], false); ctx.stroke();
    path(ctx, out); ink(ctx, 1.8);
    shard(ctx, -5, -50, 15, -0.35, 3.6, '#a77bff'); shard(ctx, 4, -55, 10, 0.3, 2.6, '#d2b8ff');
    if (e.tellT > 0 && e.tellCol === 'red') glowAt(ctx, 6, -10, 60, K.CRIM, e.tellT * 0.9);
    ctx.restore();
    return { x: px, y: py };
  }

  TYPES.c3_carapace = {
    name: '晶甲蟹', en: 'CARAPACE', w: 92, h: 82, hp: 120, bal: 80, col: COL.violet, shards: 40, kbMul: 0.55, spawnT: 0.8, poise: true,
    portrait: [2.5, 0.84],
    init(e) {
      e.seed = (Math.random() * 1e9) | 0; e.shield = 1; e.shieldK = 1; e.crack = 0; e.regrow = 0; e.turnT = 0; e.gait = 0; e.shHit = 0;
      e.cracks = makeCracks(e.seed);
      const base = e.onParried;
      e.onParried = function (h) { const slam = this.atk === TYPES.c3_carapace.slam; base.call(this, h); if (slam) crShatter(this); };
      hookUpdate(e, (q, dt) => {
        q.shHit = Math.max(0, q.shHit - dt);
        if (!q.shield && q.state !== 'die') { q.regrow -= dt; if (q.regrow <= 0) { q.shield = 1; q.crack = 0; q.shieldK = 0.05; G.SFX.play('crystal', 3); } }
        if (q.shield && q.shieldK < 1) q.shieldK = Math.min(1, q.shieldK + dt * 1.4);
        if (q.state === 'atk' && q.atk === TYPES.c3_carapace.charge && q.st > 0.72 && q.st < 1.12 && Math.random() < 0.5) G.FX.dust(q.x - q.facing * 30, q.y, 1, { w: 40, speed: 90, size: 9, col: 'rgba(120,130,160,' });
      });
    },
    voice: () => G.SFX.play('c3_clack'),
    weapon: (e) => (e.atk === TYPES.c3_carapace.charge ? e.wpShield : e.wp) || { x: e.x + e.facing * 60, y: e.y - 90 },
    guard(e, h) {
      if (!e.shield || e.shieldK < 0.6 || e.state === 'broken' || e.state === 'spawn' || e.state === 'die') return false;
      const P = G.game.player; if (!P || P.state === 'execute') return false;
      if ((P.x - e.x) * e.facing < -4) return false;   // from behind the shell is soft
      e.crack += h.big ? 2 : 1; e.shHit = 0.25;
      const w = e.wpShield || { x: e.x + e.facing * 56, y: e.y - 56 };
      G.FX.shards(w.x, h.hy ?? w.y, 5, COL.violet, 420); G.SFX.play('c3_clink');
      G.game.hint('c3_h_carapace');
      if (e.crack >= 6) crShatter(e);
      return true;
    },
    think(e, dt) {
      const T = TYPES.c3_carapace, P = e.P, dx = P.x - e.x, d = Math.abs(dx), side = dx < 0 ? -1 : 1;
      if (side !== e.facing && d > 8) {
        // heavy shell: it takes a moment to swing round (that's the flanking window)
        e.turnT += dt; e.vx = U.approach(e.vx, 0, 900 * dt);
        if (e.turnT > (e.shield ? 0.62 : 0.4)) { e.facing = side; e.turnT = 0; G.SFX.play('c3_clack'); }
        return;
      }
      e.turnT = Math.max(0, e.turnT - dt * 2);
      const want = 104, tv = d > want + 30 ? side * 125 * e.speedMul : d < want - 34 ? -side * 85 : 0;
      e.vx = U.approach(e.vx, tv, 700 * dt);
      if (e.cd > 0) return;
      if (d < 150) e.startAtk(Math.random() < (e.shield ? 0.6 : 0.45) ? T.slam : T.snip);
      else if (d > 170 && d < 330 && Math.random() < 0.55) e.startAtk(T.charge);
      else e.cd = 0.35;
    },
    // over-the-shield pincer smash: the parry target (a perfect guard shatters the shield)
    slam: {
      dur: 1.55, cd: 1.5, tells: [{ t: 0.24, c: 'white', face: false }],
      moves: [{ t0: 0.64, t1: 0.72, v: 150 }],
      hits: [{ t0: 0.74, t1: 0.86, box: { x: 34, y: -74, w: 94, h: 76 }, dmg: 18, kb: 260, last: true, pbal: 46 }],
      ev: [{ t: 0.74, fn: (e) => { const w = e.wp || { x: e.x + e.facing * 110, y: e.y }; G.FX.dust(w.x, e.y, 10, { w: 50, speed: 200, size: 12, col: 'rgba(130,120,160,' }); G.SFX.play('impact'); G.game.shake(0.25); } }],
    },
    snip: {
      dur: 1.05, cd: 1.0, tells: [{ t: 0.16, c: 'white', face: false }],
      hits: [{ t0: 0.62, t1: 0.72, box: { x: 46, y: -126, w: 80, h: 56 }, dmg: 13, kb: 200, last: true }],
      ev: [{ t: 0.6, fn: () => G.SFX.play('c3_clack') }],
    },
    // red: shield lowered, a scuttling battering-ram rush (dodge through it — it can't stop)
    charge: {
      dur: 1.75, cd: 2.0, track: false, tells: [{ t: 0.12, c: 'red', face: false }],
      moves: [{ t0: 0.72, t1: 1.1, v: 640 }],
      hits: [{ t0: 0.74, t1: 1.1, box: { x: 14, y: -104, w: 72, h: 104 }, dmg: 24, red: true, kb: 400, last: true }],
      ev: [{ t: 0.72, fn: () => G.SFX.play('whoosh', 1.3) }],
    },
    draw(ctx, e) {
      const dt = G.game.dtVis, moving = Math.abs(e.vx) > 14 && e.state !== 'broken';
      e.gait += dt * (moving ? Math.abs(e.vx) / 13 : (e.turnT > 0 ? 9 : 0));
      const p = crabPose(e);
      let tip = null, shp = null;
      frame(ctx, e, { h: 110, w: 70 }, (c) => {
        c.rotate(p.rot);
        for (let i = 0; i < 3; i++) crabLeg(c, e, p, i, true, moving || e.turnT > 0);
        crabShell(c, e, p);
        for (let i = 0; i < 3; i++) crabLeg(c, e, p, i, false, moving || e.turnT > 0);
        crabEyes(c, e, p);
        shp = crabShield(c, e, p);
        tip = crabClaw(c, e, p);
      });
      if (tip) e.wp = toW(e, tip); if (shp) e.wpShield = toW(e, shp);
      devBoxes(ctx, e);
    },
  };

  /* =========================== 回音蝠 ECHO BAT =========================== */
  // blind cave bat with dish-ears; pings (a sonar sweep you can see), then dives — the flock takes turns
  function batSonar(e) {
    const P = G.game.player, m = e.wp || { x: e.x + e.facing * 20, y: e.y - 30 };
    const a = Math.atan2(P.y - 62 - m.y, P.x - m.x), sp = 360;
    G.game.projectiles.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 10, owner: e, friendly: false, dmg: 12, life: 3.2, t: 0, col: COL.teal });
    G.FX.ring(m.x, m.y, 4, 40, 0.3, '#c8fff4', 3); G.SFX.play('c3_sonar');
  }
  function batWing(ctx, e, far, w, fold) {
    const sh = { x: -1, y: -29 };
    const th = fold ? -2.6 : U.lerp(-1.85, -4.3, (1 - w) / 2);
    const L1 = fold ? 12 : 17, spread = fold ? 0.32 : 1, fs = fold ? 0.72 : 1;
    const wr = { x: sh.x + Math.cos(th) * L1, y: sh.y + Math.sin(th) * L1 };
    const fl = [33, 28, 21], fa = [-0.82, -0.08, 0.6];
    const tips = fa.map((a, i) => ({ x: wr.x + Math.cos(th + a * spread) * fl[i] * fs, y: wr.y + Math.sin(th + a * spread) * fl[i] * fs }));
    const hip = { x: -9, y: -17 };
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(wr.x, wr.y); ctx.lineTo(tips[0].x, tips[0].y);
    for (let i = 1; i < 3; i++) { const m = lerpP(mid(tips[i - 1], tips[i]), wr, 0.32); ctx.quadraticCurveTo(m.x, m.y, tips[i].x, tips[i].y); }
    const m2 = lerpP(mid(tips[2], hip), wr, 0.25); ctx.quadraticCurveTo(m2.x, m2.y, hip.x, hip.y); ctx.closePath();
    if (far) ctx.fillStyle = '#251a3c'; else ctx.fillStyle = lit(ctx, '#5b4389', wr.x, wr.y, 26);
    ctx.fill(); ink(ctx, 1.1);
    // finger bones
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = far ? 2.2 : 2.8; ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(wr.x, wr.y); for (const q of tips) { ctx.moveTo(wr.x, wr.y); ctx.lineTo(q.x, q.y); } ctx.stroke();
    ctx.strokeStyle = far ? '#3b2d58' : '#9a84c4'; ctx.lineWidth = far ? 0.9 : 1.1; ctx.stroke();
    if (!far) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(COL.teal, 0.85);
      for (const q of tips) { ctx.beginPath(); ctx.arc(q.x, q.y, 1.3, 0, TAU); ctx.fill(); }
      ctx.restore();
      // thumb hook at the wrist
      ctx.beginPath(); ctx.moveTo(wr.x, wr.y); ctx.quadraticCurveTo(wr.x + 5, wr.y - 4, wr.x + 4, wr.y - 7); ink(ctx, 1.6);
    }
  }
  function batEar(ctx, x, y, a, s, far, glow) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
    blob(ctx, [[0, -4], [8, -11], [20, -14], [32, -9], [37, 0], [32, 9], [20, 14], [8, 11], [0, 4]]);
    ctx.fillStyle = far ? '#2a1e45' : lit(ctx, '#5d4589', 18, 0, 16); ctx.fill(); ink(ctx, 1.2);
    blob(ctx, [[5, -2], [11, -8], [20, -10], [30, -6], [33, 0], [30, 6], [20, 10], [11, 8], [5, 2]]);
    ctx.fillStyle = far ? '#6b3f72' : '#d690d4'; ctx.fill();
    ctx.strokeStyle = far ? 'rgba(30,10,40,0.6)' : 'rgba(90,30,90,0.55)'; ctx.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(6, i * 0.8); ctx.quadraticCurveTo(18, i * 4.5, 31, i * 3); ctx.stroke(); }
    if (glow > 0.02 && !far) {
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(COL.teal, 0.8 * glow); ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(6, i); ctx.quadraticCurveTo(18, i * 5, 31, i * 3.4); ctx.stroke(); }
    }
    ctx.restore();
  }
  TYPES.c3_echobat = {
    name: '回音蝠', en: 'ECHO BAT', w: 46, h: 42, hp: 45, bal: 28, col: COL.teal, shards: 24, fly: true, hover: true, kbMul: 1.3, spawnT: 0.7,
    portrait: [4.0, 0.62],
    init(e) {
      e.seed = (Math.random() * 1e9) | 0; e.flap = Math.random() * TAU; e.orbit = Math.random() * TAU; e.odir = Math.random() < 0.5 ? -1 : 1; e.pingT = 9; e.scan = Math.random() * 9;
      // knocked out of the air: stagger, parry recoil and balance break drop it to the floor (where it can be executed)
      hookUpdate(e, (q, dt) => {
        q.pingT += dt;
        if (q.state === 'hurt' || q.state === 'recoil' || q.state === 'broken') q.vy = Math.min(q.vy + 2600 * dt, 760);
      });
    },
    voice: () => G.SFX.play('c3_chirp'),
    weapon: (e) => e.wp || { x: e.x + e.facing * 20, y: e.y - 30 },
    think(e, dt) {
      const P = e.P;
      // hover low enough to stay inside a phone's frame (clear of the HUD) and within a jump-slash
      if (e.hoverH == null) { const y0 = e.y0 ?? e.y, fl = G.Phys.groundBelow(e.x, y0 + 2); e.hoverH = U.clamp((fl < 1e8 ? fl : y0 + 170) - y0, 120, 200); }
      e.orbit += dt * 1.25 * e.odir;
      const tx = P.x + Math.cos(e.orbit) * 200, ty = P.y - e.hoverH + Math.sin(e.orbit * 2) * 24;
      e.vx = U.approach(e.vx, U.clamp((tx - e.x) * 2.4, -320, 320), 1000 * dt);
      e.vy = U.approach(e.vy, U.clamp((ty - e.y) * 2.6, -280, 280), 1000 * dt);
      e.faceP();
      if (e.cd > 0) return;
      // one dive at a time: the flock waits its turn
      const busy = G.game.enemies.some((o) => o !== e && o.type === e.type && o.state === 'atk' && o.st < 1.25);
      if (busy || e.distP() > 440) { e.cd = 0.3; return; }
      // only dive when the dive can actually arrive (≤ ~400 px of flight); farther out it pings instead
      const reachD = Math.hypot(P.x - e.x, P.y - 30 - e.y);
      e.startAtk(reachD < 330 && Math.random() < 0.7 ? TYPES.c3_echobat.dive : TYPES.c3_echobat.ping);
    },
    dive: {
      dur: 1.8, cd: 2.4, tells: [{ t: 0.3, c: 'white' }],
      ev: [
        { t: 0.06, fn: (e) => { e.pingT = 0; G.SFX.play('c3_sonar'); } },
        { t: 0.78, fn: (e) => { const P = e.P; e.faceP(); const tx = P.x + P.vx * 0.08, ty = P.y - 30, dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1, sp = U.clamp(d / 0.3, 560, 1150); e.dvx = dx / d * sp; e.dvy = dy / d * sp; e.diveY = ty; G.SFX.play('whoosh', 1.4); } },
      ],
      hits: [{ t0: 0.8, t1: 1.16, box: { x: -26, y: -44, w: 56, h: 46 }, dmg: 13, kb: 220, last: true, pbal: 30 }],
    },
    ping: {
      dur: 1.35, cd: 2.2, tells: [{ t: 0.3, c: 'white' }],
      ev: [{ t: 0.1, fn: (e) => { e.pingT = 0; G.SFX.play('c3_chirp'); } }, { t: 0.82, fn: (e) => batSonar(e) }],
    },
    atkUpdate(e, dt) {
      const T = TYPES.c3_echobat, st = e.st;
      if (e.atk === T.dive) {
        if (st < 0.78) { e.vx = U.approach(e.vx, -e.facing * 110, 900 * dt); e.vy = U.approach(e.vy, -70, 900 * dt); }
        else if (st < 1.16) { e.vx = e.dvx; e.vy = e.y >= e.diveY ? 0 : e.dvy; if (e.y > e.diveY) e.y = e.diveY; }
        else if (st < 1.42) { e.vx = U.approach(e.vx, 0, 1500 * dt); e.vy = 0; }   // skims low: the punish window
        else { e.vx = U.approach(e.vx, 0, 600 * dt); e.vy = U.approach(e.vy, -330, 1400 * dt); }
      } else { e.vx = U.approach(e.vx, 0, 600 * dt); e.vy = U.approach(e.vy, Math.sin(e.t * 3) * 20, 600 * dt); }
    },
    draw(ctx, e) {
      const T = TYPES.c3_echobat, dt = G.game.dtVis, st = e.st, A = e.state === 'atk' ? e.atk : null;
      const diving = A === T.dive && st >= 0.76 && st < 1.2, fall = e.state === 'hurt' || e.state === 'recoil' || e.state === 'broken';
      const grounded = fall && e.onGround;
      e.flap += dt * (diving ? 0 : grounded ? 3 : fall ? 7 : A === T.dive && st < 0.76 ? 23 : 15);
      e.scan += dt;
      const w = grounded ? -0.7 + Math.sin(e.t * 6) * 0.15 : Math.sin(e.flap);
      let mouth = null;
      frame(ctx, e, { fly: true, h: 50, w: 50 }, (c) => {
        let rot = U.clamp(e.vx * e.facing * 0.0011, -0.3, 0.35);
        if (diving) rot = Math.atan2(e.vy, Math.abs(e.vx) + 1) * 0.9;
        if (fall && !grounded) rot = Math.sin(e.t * 13) * 0.7 + 0.4;
        if (grounded) rot = 0.5;
        const k = e.hitK; rot -= 0.5 * k;
        const bob = diving || grounded ? 0 : Math.sin(e.flap) * 2.5;
        c.translate(0, -22 + bob + (grounded ? 12 : 0)); c.rotate(rot); c.translate(0, 22);
        // ears: scan the dark, lock on while pinging
        const ping = A ? k01(1 - st / 0.9) : 0;
        const earA = -1.72 + Math.sin(e.scan * 1.7) * 0.22 * (1 - ping) + ping * 0.45 + (grounded ? 1.0 : 0) - k * 0.6;
        const glow = Math.max(e.pingT < 0.8 ? 1 - e.pingT / 0.8 : 0, e.tellT);
        batEar(c, 6, -36, earA - 0.42, 1.0, true, 0);
        batWing(c, e, true, -w, diving);
        // legs + tail membrane
        c.beginPath(); c.moveTo(-7, -14); c.lineTo(-11, -4); c.moveTo(-3, -12); c.lineTo(-5, -3); ink(c, 1.6);
        c.beginPath(); c.moveTo(-11, -4); c.quadraticCurveTo(-13, -1, -10, 0); c.moveTo(-5, -3); c.quadraticCurveTo(-7, 0, -4, 1); ink(c, 1.1);
        // body
        blob(c, [[13, -30], [8, -38], [-5, -37], [-14, -27], [-13, -15], [-3, -9], [9, -15]]); c.fillStyle = lit(c, '#4a3870', 0, -24, 15); c.fill(); ink(c, 1.4);
        blob(c, [[9, -26], [5, -18], [-2, -13], [-6, -19], [0, -26]]); c.fillStyle = '#7d68a3'; c.fill();
        c.strokeStyle = 'rgba(11,6,18,0.55)'; c.lineWidth = 0.7;
        for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-10 + i * 4, -33 + i); c.lineTo(-12 + i * 4, -29 + i); c.stroke(); }
        // head + leaf nose
        blob(c, [[21, -31], [17, -38], [9, -39], [5, -33], [7, -25], [14, -23], [21, -26]]); c.fillStyle = lit(c, '#55407f', 13, -31, 9); c.fill(); ink(c, 1.2);
        path(c, [[20, -33], [25, -31], [21, -28]]); c.fillStyle = '#d690d4'; c.fill(); ink(c, 0.8);
        const open = Math.max(ping * 0.8, diving ? 1 : 0, grounded ? 0.3 : 0);
        path(c, [[19, -26], [24, -25 + open * 3], [17, -23 + open * 2]]); c.fillStyle = '#1a0c1e'; c.fill(); ink(c, 0.8);
        c.fillStyle = '#f2eaff'; c.beginPath(); c.moveTo(19, -25.5); c.lineTo(19.8, -23); c.lineTo(20.6, -25.3); c.fill();
        c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = U.rgba(COL.teal, 0.9); c.beginPath(); c.arc(13, -33, 1.2, 0, TAU); c.fill(); c.restore();
        batEar(c, 9, -37, earA, 1.08, false, glow);
        batWing(c, e, false, w, diving);
        mouth = { x: 22, y: -26 };
        // sonar sweep: rings of sound you can watch leave its mouth
        if (e.pingT < 0.75) {
          const pk = e.pingT / 0.75;
          c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            const r = 10 + (pk * 120) - i * 16; if (r < 6) continue;
            c.strokeStyle = U.rgba(COL.teal, (1 - pk) * (0.8 - i * 0.2)); c.lineWidth = 2.4 - i * 0.6;
            c.beginPath(); c.arc(22, -26, r, -0.7, 0.7); c.stroke();
          }
          c.restore();
        }
        glowAt(c, 22, -26, 16 + glow * 14, COL.teal, 0.25 + glow * 0.6);
      });
      if (mouth) e.wp = toW(e, mouth);
      devBoxes(ctx, e);
    },
  };

  /* =========================== 深聽者 DEEP LISTENER =========================== */
  // tall, eyeless stilt-walker with two great ear-fans; it hunts by sound (noise meter = how brightly its ears burn)
  const LOUD = ['light', 'heavy', 'air', 'charge', 'skill1', 'skill2', 'counter', 'dodge', 'execute'];
  function lisNoise(e, dt) {
    const P = e.P, d = Math.abs(P.x - e.x), dy = Math.abs(P.y - e.y);
    let L = 0;
    if (P.onGround && Math.abs(P.vx) > 140) L += 1;
    if (LOUD.includes(P.state)) L += 2.6;
    const prox = k01((640 - d) / 440) * (dy < 260 ? 1 : 0.3);
    if (L > 0 && prox > 0) e.noise = Math.min(1.3, e.noise + L * prox * dt * 1.5);
    else e.noise = Math.max(0, e.noise - dt * 0.42);
    return e.noise;
  }
  function lisAlert(e) {
    if (!e.aware) {
      e.aware = 1; e.snapT = 0;
      const h = e.wpHead || { x: e.x, y: e.y - 150 };
      G.FX.ring(h.x, h.y, 6, 90, 0.4, COL.magenta, 4); G.SFX.play('c3_snap');
      once('c3_bk_heard', () => G.game.bark('c3_bk_heard'));
    }
    e.alertT = 4.5;
  }
  function lisPose(e) {
    const T = TYPES.c3_listener, t = e.t, st = e.st, A = e.state === 'atk' ? e.atk : null;
    const aw = e.awareK;
    const p = {
      crouch: 0.08 * Math.sin(t * 1.3) + 0.05, lean: 0.12 * aw, headA: (Math.sin(t * 0.7) * 0.2 + Math.sin(t * 1.9) * 0.06) * (1 - aw) + 0.1 * aw, jaw: 0.1 * aw,
      earA: U.lerp(-2.3, -1.85, aw) + Math.sin(t * 1.1) * 0.07 + Math.sin(t * 23) * 0.05 * e.noise, earS: 0.86 + 0.14 * aw + Math.sin(t * 2.3) * 0.04,
      aN: [8 + 10 * aw, 40 - 4 * aw, 6 + 8 * aw, 40 - 8 * aw], aF: [2 + 8 * aw, 40, 2 + 6 * aw, 42 - 6 * aw], curl: 0.3, fN: 10, fF: -16, hop: 0,
    };
    const set = (q) => Object.assign(p, q);
    if (A === T.lunge) {
      const k1 = eout(k01(st / 0.65)), k2 = k01((st - 0.68) / 0.12), k3 = ease(k01((st - 1.05) / 0.5));
      set({ crouch: U.lerp(p.crouch, 1, k1), lean: U.lerp(0.12, 0.3, k1), earA: U.lerp(p.earA, -2.95, k1), earS: U.lerp(1, 0.62, k1), jaw: k1, headA: -0.15 * k1,
        aN: [-16, 30, -8, 34], aF: [-20, 28, -10, 30], fF: -20 - 8 * k1 });
      if (k2 > 0) set({ crouch: U.lerp(1, 0, k2), lean: U.lerp(0.3, 1, k2), aN: [U.lerp(-16, 40, k2), U.lerp(30, 4, k2), U.lerp(-8, 48, k2), U.lerp(34, 2, k2)], aF: [U.lerp(-20, 34, k2), U.lerp(28, 10, k2), U.lerp(-10, 44, k2), U.lerp(30, 8, k2)], curl: 0.8, fF: -40, fN: 24, headA: 0.1 });
      if (k3 > 0) set({ crouch: U.lerp(0, 0.35, Math.sin(k3 * PI)), lean: U.lerp(1, 0.15, k3), earA: U.lerp(-2.95, -1.9, k3), earS: U.lerp(0.62, 1, k3), jaw: 1 - k3,
        aN: [U.lerp(40, 14, k3), U.lerp(4, 40, k3), U.lerp(48, 14, k3), U.lerp(2, 38, k3)], aF: [U.lerp(34, 10, k3), U.lerp(10, 40, k3), U.lerp(44, 8, k3), U.lerp(8, 38, k3)], fF: U.lerp(-40, -16, k3), fN: U.lerp(24, 10, k3) });
    } else if (A === T.rake) {
      const w1 = eout(k01(st / 0.58)), s1 = k01((st - 0.62) / 0.08), w2 = ease(k01((st - 0.78) / 0.4)), s2 = k01((st - 1.2) / 0.08), r = ease(k01((st - 1.36) / 0.34));
      set({ lean: U.lerp(0.12, 0.2, w1), earA: -1.9, jaw: 0.6 * w1 });
      let aN = [U.lerp(18, -6, w1), U.lerp(36, -38, w1), U.lerp(14, 14, w1), U.lerp(32, -32, w1)], aF = [10, 40, 8, 36];
      if (s1 > 0) { aN = [U.lerp(-6, 34, s1), U.lerp(-38, 20, s1), U.lerp(14, 42, s1), U.lerp(-32, 30, s1)]; p.lean = U.lerp(0.2, 0.5, s1); }
      if (w2 > 0) { aF = [U.lerp(10, -22, w2), U.lerp(40, 30, w2), U.lerp(8, -16, w2), U.lerp(36, 26, w2)]; aN = [U.lerp(34, 20, w2), U.lerp(20, 34, w2), U.lerp(42, 14, w2), U.lerp(30, 34, w2)]; p.lean = U.lerp(0.5, 0.25, w2); }
      if (s2 > 0) { aF = [U.lerp(-22, 36, s2), U.lerp(30, -12, s2), U.lerp(-16, 44, s2), U.lerp(26, -18, s2)]; p.lean = U.lerp(0.25, 0.45, s2); p.jaw = 1; }
      if (r > 0) { aF = [U.lerp(36, 10, r), U.lerp(-12, 40, r), U.lerp(44, 8, r), U.lerp(-18, 36, r)]; aN = [U.lerp(20, 18, r), U.lerp(34, 36, r), U.lerp(14, 14, r), U.lerp(34, 32, r)]; p.lean = U.lerp(0.45, 0.12, r); p.jaw = 1 - r; }
      p.aN = aN; p.aF = aF; p.curl = 0.7;
    }
    if (e.state === 'hurt' || e.state === 'recoil') {
      const w = Math.sin(k01(st / (e.state === 'recoil' ? 0.5 : (e.hurtDur || 0.36))) * PI);
      set({ lean: -0.25 * w, headA: -0.5 * w, earA: p.earA - 0.7 * w, earS: 0.7, jaw: 0.8 * w, aN: [-10, 34, -4, 36], aF: [-14, 32, -6, 34] });
    }
    if (e.state === 'broken') set({ crouch: 1.25, lean: 0.55 + Math.sin(t * 2.2) * 0.04, headA: 0.7 + Math.sin(t * 1.7) * 0.08, earA: 2.3, earS: 0.75, jaw: 0.5, aN: [16, 36, 10, 30], aF: [8, 36, 4, 30], fN: 26, fF: -24 });
    const k = e.hitK; if (k > 0) { p.headA -= 0.6 * k; p.earA -= 0.6 * k; p.lean -= 0.2 * k; }
    return p;
  }
  function earFan(ctx, bx, by, a, s, far, glowK, t) {
    const n = 5, span = 1.55 * s, R = [44, 58, 64, 58, 44].map((r) => r * (0.75 + 0.25 * s));
    const ang = (i) => a - span / 2 + (span * i) / (n - 1) + Math.sin(t * 3 + i) * 0.02;
    const tip = (i) => ({ x: bx + Math.cos(ang(i)) * R[i], y: by + Math.sin(ang(i)) * R[i] });
    const outline = () => {
      ctx.beginPath(); ctx.moveTo(bx, by);
      for (let i = 0; i < n; i++) {
        const q = tip(i);
        if (i === 0) ctx.lineTo(q.x, q.y);
        else { const am = (ang(i - 1) + ang(i)) / 2, rm = (R[i - 1] + R[i]) / 2 * 0.8; ctx.quadraticCurveTo(bx + Math.cos(am) * rm, by + Math.sin(am) * rm, q.x, q.y); }
      }
      ctx.closePath();
    };
    outline(); ctx.fillStyle = far ? '#4a2148' : 'rgba(214,92,156,0.93)'; ctx.fill();
    if (!far) {
      // darker inner fold and a lit outer rim (cel bands)
      ctx.save(); outline(); ctx.clip();
      ctx.fillStyle = '#7d2a66'; ctx.beginPath(); ctx.arc(bx, by, 22 * s, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,236,0.55)'; ctx.lineWidth = 2; outline(); ctx.stroke();
      ctx.restore();
    }
    outline(); ink(ctx, 1.4);
    // cartilage spines
    for (let i = 0; i < n; i++) { const q = tip(i); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(q.x, q.y); ink(ctx, far ? 1.6 : 2.2); ctx.strokeStyle = far ? '#7a5a78' : '#efdcea'; ctx.lineWidth = far ? 0.6 : 0.9; ctx.stroke(); }
    if (glowK > 0.03 && !far) {
      // veins kindle as it hears you
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = U.rgba(COL.magenta, Math.min(1, glowK)); ctx.lineWidth = 1.2;
      for (let i = 0; i < n - 1; i++) {
        const am = (ang(i) + ang(i + 1)) / 2, r0 = 16, r1 = (R[i] + R[i + 1]) / 2 * 0.72;
        ctx.beginPath(); ctx.moveTo(bx + Math.cos(am) * r0, by + Math.sin(am) * r0); ctx.lineTo(bx + Math.cos(am + 0.08) * r1, by + Math.sin(am + 0.08) * r1); ctx.stroke();
      }
      ctx.restore();
    }
  }
  TYPES.c3_listener = {
    name: '深聽者', en: 'DEEP LISTENER', w: 48, h: 176, hp: 110, bal: 70, col: '#ff5fb0', shards: 44, kbMul: 0.8, spawnT: 1.0,
    portrait: [1.75, 0.94],
    init(e) {
      e.seed = (Math.random() * 1e9) | 0; e.noise = 0; e.aware = 0; e.awareK = 0; e.alertT = 0; e.snapT = 9; e.gaitL = 0; e.home = null; e.wander = 0;
      hookUpdate(e, (q, dt) => {
        q.snapT += dt; q.awareK = U.approach(q.awareK, q.aware ? 1 : 0, dt * (q.aware ? 6 : 0.8));
        if (q.state !== 'die' && q.state !== 'spawn' && q.state !== 'broken' && q.state !== 'executed') {
          const n = lisNoise(q, dt);
          if (n >= 1) { const was = q.aware; lisAlert(q); q.noise = 0.6; if (!was && q.state === 'idle' && q.distP() < 360) { q.faceP(); q.startAtk(TYPES.c3_listener.lunge); } }
          if (q.aware && q.state === 'idle') { q.alertT -= dt; if (q.alertT <= 0 && q.noise < 0.2) q.aware = 0; }
        }
      });
    },
    // sneak attack: a blow it never heard coming bites deeper
    onHit(e, h) {
      if (!e.aware && e.state !== 'broken') { const x = Math.round(h.dmg * 0.6); e.hp -= x; G.FX.num(h.hx ?? e.cx, (h.hy ?? e.cy) - 40, x, 'crit'); G.FX.text(e.x, e.y - 200, '奇襲', '#ffd27a', 20, 0.9); }
      lisAlert(e);
    },
    voice: () => G.SFX.play('c3_keen'),
    weapon: (e) => e.wp || { x: e.x + e.facing * 60, y: e.y - 100 },
    think(e, dt) {
      const T = TYPES.c3_listener, P = e.P, d = e.distP();
      if (d < 700) G.game.hint('c3_h_listener');
      if (!e.aware) {
        // blind: it only drifts about its post, head tilting toward echoes
        if (e.home == null) e.home = e.x;
        e.wander += dt;
        const tx = e.home + Math.sin(e.wander * 0.35) * 40;
        e.vx = U.approach(e.vx, U.clamp((tx - e.x) * 1.5, -40, 40), 300 * dt);
        if (Math.abs(e.vx) > 5) e.facing = e.vx > 0 ? 1 : -1;
        return;
      }
      e.faceP();
      e.vx = U.approach(e.vx, d > 170 ? e.facing * 210 * e.speedMul : d < 90 ? -e.facing * 80 : 0, 900 * dt);
      if (e.cd > 0) return;
      if (d < 175) e.startAtk(Math.random() < 0.7 ? T.rake : T.lunge);
      else if (d < 350) e.startAtk(T.lunge);
      else e.cd = 0.3;
    },
    // red: the snap toward the sound — a leaping two-claw pounce
    lunge: {
      dur: 1.55, cd: 1.7, track: false, tells: [{ t: 0.1, c: 'red' }],
      moves: [{ t0: 0.7, t1: 0.94, v: 780 }],
      hits: [{ t0: 0.72, t1: 1.0, box: { x: 30, y: -158, w: 150, h: 120 }, dmg: 26, red: true, kb: 380, last: true }],
      ev: [{ t: 0.7, fn: (e) => { e.vy = -360; G.SFX.play('whoosh', 1.1); } }],
    },
    rake: {
      dur: 1.7, cd: 1.4, tells: [{ t: 0.18, c: 'white' }, { t: 0.76, c: 'white' }],
      moves: [{ t0: 0.6, t1: 0.68, v: 220 }, { t0: 1.18, t1: 1.26, v: 200 }],
      hits: [
        { t0: 0.64, t1: 0.76, box: { x: 24, y: -166, w: 108, h: 160 }, dmg: 15 },
        { t0: 1.22, t1: 1.34, box: { x: 24, y: -182, w: 112, h: 150 }, dmg: 17, last: true },
      ],
      ev: [{ t: 0.64, fn: () => G.SFX.play('slash', 1.3) }, { t: 1.22, fn: () => G.SFX.play('slash', 1.4) }],
    },
    draw(ctx, e) {
      const dt = G.game.dtVis, p = lisPose(e), t = e.t;
      const walking = Math.abs(e.vx) > 20 && e.onGround && e.state !== 'atk';
      e.gaitL += dt * Math.abs(e.vx) / 16;
      if (walking && e.state === 'idle' && Math.floor(e.gaitL / PI) !== Math.floor((e.gaitL - dt * Math.abs(e.vx) / 16) / PI) && Math.abs(e.x - e.P.x) < 700) G.SFX.play('step');
      let claw = null, headW = null;
      frame(ctx, e, { h: 210, w: 60 }, (c) => {
        const SK = COL.bone;
        const hip = { x: -4 + p.lean * 8, y: -100 + p.crouch * 26 };
        const midb = { x: hip.x + 6 + p.lean * 20, y: hip.y - 30 + p.lean * 10 };
        const sh = { x: hip.x + 20 + p.lean * 46, y: hip.y - 50 + p.lean * 30 };
        const hb = { x: sh.x + 16 + p.lean * 6, y: sh.y + 4 + p.lean * 2 };
        // legs (digitigrade stilts)
        const gait = e.gaitL, wk = walking ? 1 : 0;
        const leg = (fx, ph, far) => {
          const foot = { x: fx + Math.sin(ph) * 22 * wk, y: -Math.max(0, Math.cos(ph)) * 10 * wk };
          const knee = { x: hip.x + 14 + (foot.x - hip.x) * 0.25, y: hip.y + 32 - p.crouch * 4 };
          const hock = { x: foot.x - 12 - p.crouch * 7, y: foot.y - 28 + p.crouch * 8 };
          const pts = [{ x: hip.x + (far ? -3 : 0), y: hip.y }, knee, hock, foot];
          if (far) tubeFlat(c, pts, [6, 4, 3, 2], '#5e4d6c', 1.1);
          else Rig.limbChain(c, pts, [7, 4.6, 3.4, 2.4], SK, { spec: 0.2 });
          c.beginPath(); c.moveTo(foot.x, foot.y); c.quadraticCurveTo(foot.x + 8, foot.y - 2, foot.x + 13, foot.y + 1); c.moveTo(foot.x, foot.y); c.quadraticCurveTo(foot.x + 6, foot.y - 4, foot.x + 10, foot.y - 4); ink(c, far ? 1.4 : 1.8);
        };
        leg(p.fF, gait + PI, true);
        // far ear fan (behind the skull) and far arm
        const ha = 0.25 + p.headA + p.lean * 0.15;
        const ebx = hb.x - 2, eby = hb.y - 10;
        earFan(c, ebx - 4, eby + 2, p.earA - 0.5, p.earS * 0.9, true, 0, t);
        const arm = (o, far) => {
          const el = { x: sh.x + o[0], y: sh.y + o[1] }, wr = { x: el.x + o[2], y: el.y + o[3] };
          const pts = [{ x: sh.x - (far ? 4 : 0), y: sh.y + (far ? 2 : 0) }, el, wr];
          if (far) tubeFlat(c, pts, [4, 3, 2.2], '#5e4d6c', 1); else Rig.limbChain(c, pts, [4.6, 3.4, 2.6], SK);
          // three hooked talons
          const a = Math.atan2(wr.y - el.y, wr.x - el.x);
          for (let i = -1; i <= 1; i++) {
            const aa = a + i * 0.28, L = 22 - Math.abs(i) * 3, cu = p.curl * (0.6 + i * 0.1);
            const t1 = { x: wr.x + Math.cos(aa) * L, y: wr.y + Math.sin(aa) * L };
            const cp = { x: wr.x + Math.cos(aa - cu) * L * 0.7, y: wr.y + Math.sin(aa - cu) * L * 0.7 };
            c.beginPath(); c.moveTo(wr.x, wr.y); c.quadraticCurveTo(cp.x, cp.y, t1.x, t1.y); ink(c, far ? 2.6 : 3.2);
            c.strokeStyle = far ? '#3a2440' : '#4a2a4e'; c.lineWidth = far ? 1.2 : 1.6; c.stroke();
            if (!far) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = U.rgba(COL.magenta, 0.85); c.beginPath(); c.arc(t1.x, t1.y, 1.1, 0, TAU); c.fill(); c.restore(); }
          }
          return { x: wr.x + Math.cos(a) * 20, y: wr.y + Math.sin(a) * 20 };
        };
        arm(p.aF, true);
        // torso: emaciated, arched, ribs and vertebrae
        Rig.limbChain(c, [hip, midb, sh], [9, 12.5, 10], SK, { spec: 0.15 });
        const tA = Math.atan2(sh.y - hip.y, sh.x - hip.x), ux = Math.cos(tA), uy = Math.sin(tA), nx = -uy, ny = ux;
        c.strokeStyle = 'rgba(60,30,70,0.6)'; c.lineWidth = 1;
        for (let i = 0; i < 4; i++) { const q = lerpP(midb, sh, 0.1 + i * 0.2); c.beginPath(); c.moveTo(q.x + nx * 10, q.y + ny * 10); c.quadraticCurveTo(q.x + ux * 4, q.y + uy * 4, q.x - nx * 9, q.y - ny * 9); c.stroke(); }
        for (let i = 0; i < 5; i++) { const q = lerpP(hip, sh, 0.15 + i * 0.18); c.beginPath(); c.arc(q.x - nx * 10.5, q.y - ny * 10.5, 2.2, 0, TAU); c.fillStyle = '#e8def0'; c.fill(); ink(c, 0.8); }
        // neck + head
        Rig.limbChain(c, [sh, hb], [6.5, 4.6], SK);
        // the Hush crystal in its throat
        const thr = lerpP(sh, hb, 0.55);
        glowAt(c, thr.x + 2, thr.y + 6, 22, COL.magenta, 0.35 + e.noise * 0.4 + e.tellT * 0.5);
        shard(c, thr.x + 1, thr.y + 6, 12, 2.6, 3.2, '#ff7ac0');
        c.save(); c.translate(hb.x, hb.y); c.rotate(ha);
        blob(c, [[-10, -2], [-7, -10], [4, -11], [16, -8], [27, -3], [29, 1], [20, 3], [8, 5], [-4, 8], [-11, 4]]); c.fillStyle = lit(c, SK, 6, -2, 14); c.fill(); ink(c, 1.4);
        // jaw
        c.save(); c.translate(6, 3); c.rotate(p.jaw * 0.45);
        path(c, [[0, 0], [22, -1], [18, 4], [2, 6]]); c.fillStyle = '#a796b4'; c.fill(); ink(c, 1.1);
        c.fillStyle = '#f6eefc'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(5 + i * 4.5, 0); c.lineTo(6.5 + i * 4.5, -2.6); c.lineTo(8 + i * 4.5, 0); c.fill(); }
        c.restore();
        if (p.jaw > 0.3) { c.fillStyle = U.rgba('#2a0c22', 0.9); path(c, [[7, 2], [26, 0], [24, 3 + p.jaw * 6], [9, 4 + p.jaw * 6]]); c.fill(); }
        // sewn-shut eye pits
        c.strokeStyle = 'rgba(40,16,48,0.85)'; c.lineWidth = 1.1;
        c.beginPath(); c.moveTo(8, -7); c.quadraticCurveTo(12, -5, 16, -6); c.stroke();
        for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(9 + i * 3, -8.3); c.lineTo(10 + i * 3, -4.5); c.stroke(); }
        c.restore();
        // the near ear fan + a halo of incoming sound when it is listening hard
        const gK = Math.max(e.noise, e.awareK * 0.6, e.tellT);
        earFan(c, ebx, eby, p.earA, p.earS, false, gK, t);
        if (e.noise > 0.15 && e.state !== 'broken') {
          c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            const ph = (t * 1.6 + i / 3) % 1, r = 90 - ph * 55;
            c.strokeStyle = U.rgba(COL.magenta, Math.min(0.8, e.noise) * (1 - Math.abs(ph - 0.5) * 2) * 0.8); c.lineWidth = 1.6;
            c.beginPath(); c.arc(ebx, eby, r, p.earA - 0.9, p.earA + 0.9); c.stroke();
          }
          c.restore();
        }
        if (e.snapT < 0.4) { const k = e.snapT / 0.4; c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = U.rgba(COL.magenta, 1 - k); c.lineWidth = 3; c.beginPath(); c.arc(ebx, eby, 20 + k * 60, 0, TAU); c.stroke(); c.restore(); }
        leg(p.fN, gait, false);
        claw = arm(p.aN, false);
        headW = { x: hb.x + 10, y: hb.y - 4 };
        if (e.tellT > 0) glowAt(c, claw.x, claw.y, 34, e.tellCol === 'red' ? K.CRIM : '#ffffff', e.tellT);
      });
      if (claw) e.wp = toW(e, claw); if (headW) e.wpHead = toW(e, headW);
      devBoxes(ctx, e);
    },
  };

  /* =========================== 鑽岩蟲 BORER =========================== */
  // segmented rock-worm: tunnels (invulnerable, a crystal fin cuts the floor), erupts under you (red), whips (white), dives again
  function borerShape(e) {
    const T = TYPES.c3_borer, t = e.t, st = e.st, A = e.state === 'atk' ? e.atk : null;
    const s = { head: { x: 16 + Math.sin(t * 1.3) * 6, y: -132 + Math.sin(t * 1.7) * 5 }, ctrl: { x: -20, y: -70 }, open: 0.25 + Math.sin(t * 2) * 0.1, under: e.under ? 1 : 0, rise: 0 };
    if (A === T.whip) {
      const w = eout(k01(st / 0.6)), k = k01((st - 0.64) / 0.12), r = ease(k01((st - 0.86) / 0.49));
      let hx = U.lerp(s.head.x, -36, w), hy = U.lerp(s.head.y, -160, w), cx = U.lerp(-20, 6, w), cy = U.lerp(-70, -84, w);
      if (k > 0) { hx = U.lerp(-36, 150, k); hy = U.lerp(-160, -34, k * k); cx = U.lerp(6, 48, k); cy = U.lerp(-84, -150, k); }
      if (r > 0) { hx = U.lerp(150, 16, r); hy = U.lerp(-34, -132, r); cx = U.lerp(48, -20, r); cy = U.lerp(-150, -70, r); }
      s.head = { x: hx, y: hy }; s.ctrl = { x: cx, y: cy }; s.open = U.lerp(0.3, 1, w) * (1 - r);
    } else if (A === T.erupt) {
      if (st < 0.8) { s.under = 1; }
      else { const k = eout(k01((st - 0.8) / 0.14)); s.under = 1 - k; s.rise = k; s.head = { x: U.lerp(0, 10, k), y: U.lerp(-150, -176, k) + Math.sin(st * 9) * 3 * k }; s.ctrl = { x: -4, y: -88 }; s.open = 1 - k01((st - 1.1) / 0.6) * 0.6; }
    } else if (A === T.sink) {
      const k = ease(k01((st - 0.15) / 0.55)); s.under = k; s.head = { x: U.lerp(s.head.x, 4, k), y: U.lerp(s.head.y, -60, k) }; s.open = 0.1;
    }
    if (e.state === 'hurt' || e.state === 'recoil') { const w = Math.sin(k01(st / (e.state === 'recoil' ? 0.5 : (e.hurtDur || 0.36))) * PI); s.head.x -= 26 * w; s.head.y -= 6 * w; s.ctrl.x -= 10 * w; s.open = 0.9 * w; }
    if (e.state === 'broken') { s.head = { x: 74 + Math.sin(t * 2) * 3, y: -22 }; s.ctrl = { x: -6, y: -96 }; s.open = 0.5; }
    const k = e.hitK; if (k > 0) { s.head.x -= 16 * k; s.ctrl.x -= 8 * k; }
    return s;
  }
  const bez = (a, c, b, u) => ({ x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * c.x + u * u * b.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * c.y + u * u * b.y });
  const bezT = (a, c, b, u) => { const x = 2 * (1 - u) * (c.x - a.x) + 2 * u * (b.x - c.x), y = 2 * (1 - u) * (c.y - a.y) + 2 * u * (b.y - c.y), d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; };
  function borerHole(ctx, e, front) {
    if (!front) {
      blob(ctx, [[-40, 0], [-30, -6], [0, -8], [30, -6], [40, 0], [30, 5], [0, 7], [-30, 5]]); ctx.fillStyle = '#07040a'; ctx.fill();
      ctx.strokeStyle = 'rgba(11,6,18,0.7)'; ctx.lineWidth = 1.2;
      for (const [a, l] of [[-1, 60], [1, 74], [-1, 34], [1, 40]]) { ctx.beginPath(); ctx.moveTo(a * 36, -1); ctx.lineTo(a * (36 + l * 0.5), 1); ctx.lineTo(a * (36 + l), 0); ctx.stroke(); }
      return;
    }
    const rng = U.mulberry32(e.seed);
    for (let i = 0; i < 7; i++) {
      const x = -42 + i * 14 + rng() * 6, w = 8 + rng() * 8, h = 5 + rng() * 7;
      path(ctx, [[x - w / 2, 2], [x - w / 2 + 2, -h], [x + w * 0.2, -h - 2], [x + w / 2, -h * 0.4], [x + w / 2, 2]]);
      ctx.fillStyle = lit(ctx, '#5a4a62', x, -h / 2, w); ctx.fill(); ink(ctx, 1);
    }
  }
  function borerHead(ctx, e, open) {
    const t = e.t, R = Rig.ramp(COL.rock);
    // mandible hooks fanning from the rim
    for (const [y, a] of [[-19, -0.5], [19, 0.5], [-9, -0.2], [9, 0.2]]) { const sp = a * (0.6 + open); shard(ctx, 18, y, 14 + open * 6, PI / 2 + sp * 1.4, 3, '#c78cff'); }
    blob(ctx, [[-16, -17], [0, -22], [14, -24], [21, -20], [22, 0], [21, 20], [14, 24], [0, 22], [-16, 17], [-19, 0]]);
    ctx.fillStyle = lit(ctx, COL.rock, 2, 0, 24); ctx.fill(); ink(ctx, 1.8);
    ctx.strokeStyle = 'rgba(11,6,18,0.6)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(-4, -21); ctx.quadraticCurveTo(2, 0, -4, 21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -23); ctx.quadraticCurveTo(13, 0, 8, 23); ctx.stroke();
    ctx.strokeStyle = R.hi; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-10, -18); ctx.quadraticCurveTo(4, -23, 18, -20); ctx.stroke();
    // the drill-maw: rotating rings of crystal teeth around a hot core
    const ry = 20 + open * 3, rx = 5 + open * 4;
    ctx.beginPath(); ctx.ellipse(21, 0, rx, ry, 0, 0, TAU); ctx.fillStyle = '#16070f'; ctx.fill(); ink(ctx, 1.5);
    glowAt(ctx, 23, 0, 18 + open * 22, '#ff6a9a', 0.45 + open * 0.5 + e.tellT * 0.5);
    ctx.fillStyle = '#ffe1ec';
    for (let ring = 0; ring < 2; ring++) {
      const n = 9, rr = ring ? 0.55 : 0.92, rot = t * (ring ? -5 : 4);
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * TAU, cy = Math.sin(a), cx = Math.cos(a); if (cx < -0.2) continue;
        const x0 = 21 + rx * rr * cx * 0.5, y0 = cy * ry * rr, x1 = 21 + rx * rr * cx * 0.2 + 2, y1 = cy * ry * rr * 0.6;
        ctx.beginPath(); ctx.moveTo(x0, y0 - 2); ctx.lineTo(x1 + 3, y1); ctx.lineTo(x0, y0 + 2); ctx.closePath(); ctx.fill();
      }
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = U.rgba(COL.teal, 0.85);
    for (const y of [-12, 0, 12]) { ctx.beginPath(); ctx.arc(-12, y, 1.5, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (e.tellT > 0) glowAt(ctx, 24, 0, 44, e.tellCol === 'red' ? K.CRIM : '#ffffff', e.tellT);
  }
  function borerUnder(ctx, e, warn) {
    const t = e.t, mv = Math.min(1, Math.abs(e.vx) / 150);
    // rubble churned up along the floor
    const rng = U.mulberry32(e.seed + 3);
    for (let i = 0; i < 6; i++) {
      const x = -28 + i * 11 + rng() * 4, h = 3 + rng() * 5 + Math.max(0, Math.sin(t * 16 + i * 1.7)) * 5 * mv + warn * 8;
      path(ctx, [[x - 5, 1], [x - 3, -h], [x + 2, -h - 1.5], [x + 5, 1]]); ctx.fillStyle = '#4b3d55'; ctx.fill(); ink(ctx, 0.9);
    }
    // the dorsal fins cutting through the stone
    const wob = Math.sin(t * 11) * 0.06;
    shard(ctx, -6, 2, 24 + warn * 8, -0.55 + wob, 6, COL.fin); shard(ctx, -30, 2, 15, -0.65 + wob, 4.5, COL.fin);
    if (warn > 0) {
      // the floor splits and glows red where it will burst
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      const L = 20 + warn * 54;
      ctx.strokeStyle = U.rgba('#ff4a3a', 0.35 + warn * 0.6); ctx.lineWidth = 2.4;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * L * 0.35, -2); ctx.lineTo(s * L * 0.6, 1); ctx.lineTo(s * L, -1); ctx.stroke(); }
      K.glow(ctx, 0, -4, 30 + warn * 40, '#ff3a2a', 0.25 + warn * 0.45);
      ctx.restore();
    }
  }
  TYPES.c3_borer = {
    name: '鑽岩蟲', en: 'BORER', w: 62, h: 130, hp: 95, bal: 60, col: '#ff8a5c', shards: 38, kbMul: 0.4, spawnT: 0.9,
    portrait: [2.1, 0.9],
    init(e) {
      e.seed = (Math.random() * 1e9) | 0; e.under = false; e.surfT = 0; e.chaseT = 0; e.whips = 0; e.dustT = 0;
      hookUpdate(e, (q, dt) => {
        q.invuln = q.under && q.state !== 'die';
        if (q.under && q.state !== 'die') {
          q.dustT -= dt;
          const warn = q.state === 'atk' && q.atk === TYPES.c3_borer.erupt && q.st < 0.8;
          if (q.dustT <= 0 && (Math.abs(q.vx) > 30 || warn)) { q.dustT = warn ? 0.05 : 0.09; G.FX.dust(q.x, q.y, 1, { w: warn ? 70 : 34, speed: warn ? 120 : 70, size: warn ? 12 : 8, col: 'rgba(120,108,140,' }); }
        }
      });
    },
    voice: (e) => G.SFX.play(e.under ? 'c3_rumble' : 'c3_grind'),
    weapon: (e) => (e.under ? { x: e.x, y: e.y - 14 } : e.wp) || { x: e.x, y: e.y - 120 },
    think(e, dt) {
      const T = TYPES.c3_borer, P = e.P, dx = P.x - e.x;
      if (e.under) {
        if (e.distP() < 700) G.game.hint('c3_h_borer');
        e.facing = dx < 0 ? -1 : 1; e.chaseT += dt;
        e.vx = U.approach(e.vx, U.clamp(dx * 3, -270, 270), 900 * dt);
        if (e.cd <= 0 && (Math.abs(dx) < 46 || e.chaseT > 2.6)) e.startAtk(T.erupt);
        return;
      }
      e.faceP(); e.vx = U.approach(e.vx, 0, 900 * dt); e.surfT += dt;
      if (e.cd > 0) return;
      if (e.distP() < 170 && e.whips < 2) { e.whips++; e.startAtk(T.whip); }
      else if (e.surfT > 1.0) e.startAtk(T.sink);
      else e.cd = 0.2;
    },
    // red: cracks and a red glow mark the spot, then it bursts straight up
    erupt: {
      dur: 2.0, cd: 0.7, track: false, tells: [{ t: 0.16, c: 'red', face: false }],
      hits: [{ t0: 0.8, t1: 0.98, box: { x: -46, y: -196, w: 92, h: 196 }, dmg: 24, red: true, kb: 360, last: true }],
      ev: [
        { t: 0.0, fn: (e) => { e.lockT = 0; G.SFX.play('c3_rumble'); } },
        { t: 0.8, fn: (e) => { e.under = false; e.invuln = false; e.surfT = 0; e.whips = 0; e.vx = 0; G.SFX.play('c3_burst'); G.game.shake(0.5); G.FX.shards(e.x, e.y - 10, 16, COL.rock, 620); G.FX.dust(e.x, e.y, 16, { w: 80, speed: 260, size: 16, col: 'rgba(120,108,140,' }); G.FX.ring(e.x, e.y - 6, 10, 110, 0.35, '#ff8a5c', 5, { flat: 0.2 }); } },
      ],
    },
    whip: {
      dur: 1.35, cd: 0.9, track: false, tells: [{ t: 0.18, c: 'white' }],
      // the box opens once the head is past the body (k ≈ 0.4) — no phantom reach while it is still coiled
      hits: [{ t0: 0.69, t1: 0.8, box: { x: 6, y: -168, w: 166, h: 162 }, dmg: 16, kb: 260, last: true }],
      ev: [{ t: 0.64, fn: () => G.SFX.play('whoosh', 0.8) }],
    },
    sink: {
      dur: 0.85, cd: 0.6, track: false,
      ev: [
        { t: 0.1, fn: (e) => { G.SFX.play('c3_rumble'); G.FX.dust(e.x, e.y, 10, { w: 60, speed: 160, size: 12, col: 'rgba(120,108,140,' }); once('c3_bk_borer', () => G.game.bark('c3_bk_borer')); } },
        { t: 0.72, fn: (e) => { e.under = true; e.invuln = true; e.chaseT = 0; } },
      ],
    },
    atkUpdate(e, dt) {
      const T = TYPES.c3_borer;
      if (e.atk === T.erupt && e.st < 0.34) { const dx = e.P.x - e.x; e.vx = U.clamp(dx * 4, -240, 240); e.facing = dx < 0 ? -1 : 1; }   // homes in, then the spot locks
      else if (e.atk === T.erupt || e.atk === T.whip || e.atk === T.sink) e.vx = U.approach(e.vx, 0, 2400 * dt);
    },
    draw(ctx, e) {
      const s = borerShape(e), T = TYPES.c3_borer;
      let headW = null;
      frame(ctx, e, { h: 210, w: 70 }, (c) => {
        const warn = e.state === 'atk' && e.atk === T.erupt && e.st < 0.8 ? k01(e.st / 0.8) : 0;
        if (s.under >= 1) { borerUnder(c, e, warn); return; }
        // everything below the floor line stays hidden
        c.save(); c.beginPath(); c.rect(-400, -700, 800, 702); c.clip();
        borerHole(c, e, false);
        c.translate(0, s.under * 210);
        const B = { x: 0, y: 14 }, N = 9, segs = [];
        for (let i = 0; i <= N; i++) { const u = i / N; segs.push({ p: bez(B, s.ctrl, s.head, u), d: bezT(B, s.ctrl, s.head, Math.max(0.02, u)) }); }
        const R = Rig.ramp(COL.rock);
        for (let i = 0; i < N; i++) {
          const q = segs[i], r = 15 + Math.min(i, 5) * 0.8, a = Math.atan2(q.d.y, q.d.x);
          c.save(); c.translate(q.p.x, q.p.y); c.rotate(a);
          // dorsal fin (on the back = left of travel, i.e. toward −y in segment space)
          if (i % 2 === 1) shard(c, -2, -r + 2, 13 + (i % 3) * 3, -0.9, 4, COL.fin);
          c.beginPath(); c.ellipse(0, 0, 11.5, r, 0, 0, TAU); c.fillStyle = R.dark; c.fill();
          const L = Rig.lightDir(c); c.beginPath(); c.ellipse(L.x * 2.5, L.y * 3.5 - 1, 9.5, r * 0.78, 0, 0, TAU); c.fillStyle = R.lit; c.fill();
          c.beginPath(); c.ellipse(0, 0, 11.5, r, 0, 0, TAU); ink(c, 1.5);
          c.strokeStyle = R.hi; c.lineWidth = 1.1; c.beginPath(); c.ellipse(0, 0, 9.5, r - 2, 0, -PI * 0.85, -PI * 0.45); c.stroke();
          c.strokeStyle = 'rgba(11,6,18,0.5)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-3, -r * 0.7); c.lineTo(-1, -2); c.lineTo(-4, r * 0.5); c.stroke();
          // biolight seam
          c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = U.rgba(COL.teal, 0.6 + Math.sin(e.t * 3 + i) * 0.2); c.lineWidth = 1.6;
          c.beginPath(); c.ellipse(-10, 0, 3, r * 0.8, 0, -PI / 2, PI / 2); c.stroke(); c.restore();
          c.restore();
        }
        const H = segs[N], ha = Math.atan2(H.d.y, H.d.x);
        c.save(); c.translate(H.p.x, H.p.y); c.rotate(ha); borerHead(c, e, s.open); c.restore();
        headW = { x: H.p.x + Math.cos(ha) * 22, y: H.p.y + Math.sin(ha) * 22 + s.under * 210 };
        c.restore();
        borerHole(c, e, true);
      });
      if (headW) e.wp = toW(e, headW);
      devBoxes(ctx, e);
    },
  };

  /* =========================== 爆破手・莫格 MOG THE SAPPER (elite) =========================== */
  const MG = {
    idle: (t) => ({ ry: 7 + Math.sin(t * 1.7) * 1.6, torso: 0.34 + Math.sin(t * 1.7) * 0.02, head: -0.02, tF: 0.55, kF: -0.65, tB: -0.5, kB: -0.4, aF: 0.55, eF: 1.55, aB: 0.85, eB: 1.2, sw: 3.85, hold: 1 }),
    up: { ry: 0, torso: -0.12, head: -0.15, tF: 0.45, kF: -0.4, tB: -0.55, kB: -0.3, aF: 3.05, eF: 0.25, aB: 2.6, eB: 0.4, sw: 3.95, hold: 1 },
    down: { ry: 16, torso: 0.72, head: 0.2, tF: 0.95, kF: -1.0, tB: -0.65, kB: -0.2, aF: 1.25, eF: 0.1, aB: 1.2, eB: 0.2, sw: 1.55, hold: 1 },
    low: { ry: 14, torso: 0.62, head: 0.15, tF: 0.85, kF: -0.95, tB: -0.6, kB: -0.25, aF: 0.35, eF: 0.15, aB: 0.3, eB: 0.2, sw: 0.25, hold: 1 },
    rise: { ry: 0, torso: -0.05, head: -0.1, tF: 0.5, kF: -0.45, tB: -0.5, kB: -0.3, aF: 2.6, eF: 0.15, aB: 2.4, eB: 0.2, sw: 2.75, hold: 1 },
    dip: { ry: 8, torso: 0.28, head: 0.05, tF: 0.6, kF: -0.7, tB: -0.55, kB: -0.3, aF: 2.45, eF: 0.4, aB: 2.2, eB: 0.4, sw: 3.3, hold: 1 },
    sweepW: { ry: 12, torso: 0.15, head: 0.1, tF: 0.6, kF: -0.75, tB: -0.6, kB: -0.3, aF: -0.9, eF: 0.4, aB: -0.8, eB: 0.4, sw: -1.45, hold: 1 },
    sweepS: { ry: 14, torso: 0.55, head: 0.1, tF: 0.95, kF: -0.9, tB: -0.7, kB: -0.2, aF: 1.5, eF: 0.0, aB: 1.3, eB: 0.2, sw: 1.62, hold: 1 },
    throwW: { ry: 6, torso: -0.12, head: -0.1, tF: 0.4, kF: -0.5, tB: -0.6, kB: -0.3, aF: 0.45, eF: 0.7, sw: 0.5, hold: 0, aB: -2.5, eB: 0.7 },
    throwS: { ry: 10, torso: 0.6, head: 0.1, tF: 0.8, kF: -0.8, tB: -0.6, kB: -0.3, aF: 0.35, eF: 0.5, sw: 0.4, hold: 0, aB: 2.2, eB: 0.1 },
    slamUp: { ry: -4, torso: -0.3, head: -0.25, tF: 0.6, kF: -1.2, tB: 0.1, kB: -1.1, aF: 3.25, eF: 0.15, aB: 3.0, eB: 0.3, sw: 4.1, hold: 1 },
    slamDn: { ry: 26, torso: 0.95, head: 0.25, tF: 1.1, kF: -1.5, tB: -0.6, kB: -0.8, aF: 1.05, eF: 0.05, aB: 1.0, eB: 0.1, sw: 0.95, hold: 1 },
    roar: { ry: 2, torso: -0.35, head: -0.45, tF: 0.6, kF: -0.6, tB: -0.6, kB: -0.4, aF: 2.0, eF: 0.8, aB: -1.6, eB: 0.6, sw: 3.4, hold: 0 },
    hurt: { ry: 10, torso: -0.2, head: 0.5, tF: 0.3, kF: -0.6, tB: -0.6, kB: -0.4, aF: 0.4, eF: 1.0, aB: -0.8, eB: 0.8, sw: 2.2, hold: 0.5 },
    broken: (t) => ({ ry: 30, torso: 0.85 + Math.sin(t * 2.6) * 0.04, head: 0.55, tF: 1.35, kF: -1.6, tB: 0.05, kB: -1.55, aF: 0.9, eF: 0.4, aB: 0.6, eB: 0.6, sw: 0.05, hold: 0.6 }),
  };
  const MI = MG.idle(0);
  function mogBomb(e, tx) {
    const w = e.handB || { x: e.x, y: e.y - 150 };
    const ar = G.game.arena; if (ar) tx = U.clamp(tx, ar.x0 + 40, ar.x1 - 40);
    const ty = G.Phys.groundBelow(tx, e.y - 300); if (ty > 1e8) return;
    const fl = 0.55 + Math.abs(tx - w.x) / 2200, R = 78;
    G.game.hazards.push({
      t: 0, x: w.x, y: w.y, x0: w.x, y0: w.y, tx, ty, fl, R, fuse: 0.95, owner: e, spin: Math.random() * TAU,
      update(h, dt, g) {
        if (h.t < h.fl) { const k = h.t / h.fl; h.x = U.lerp(h.x0, h.tx, k); h.y = U.lerp(h.y0, h.ty - 8, k) - 170 * 4 * k * (1 - k); h.spin += dt * 14; return; }
        if (!h.landed) { h.landed = true; h.x = h.tx; h.y = h.ty - 8; G.SFX.play('bump'); G.SFX.play('c3_fuse'); G.FX.dust(h.x, h.ty, 6, { w: 20, speed: 90, size: 8, col: 'rgba(130,110,140,' }); }
        if (h.owner.dead && !h.boom) { h.boom = true; h.fizzle = true; h.bt = h.t; G.FX.ember(h.x, h.y, 8, COL.magenta, { w: 10, h: 10 }); return; }
        if (!h.boom && h.t >= h.fl + h.fuse) {
          h.boom = true; h.bt = h.t;
          G.SFX.play('c3_blast'); g.shake(0.45);
          G.FX.ring(h.x, h.ty, 10, h.R + 20, 0.35, '#ff7a5a', 7, { flat: 0.3 }); G.FX.flash(h.x, h.ty - 30, 160, 0.3, '#ffb08a');
          G.FX.shards(h.x, h.ty - 10, 14, COL.magenta, 640); G.FX.dust(h.x, h.ty, 14, { w: 90, speed: 240, size: 16, col: 'rgba(110,90,120,' });
          const P = g.player, hb = P.hurtbox;
          if (U.rectsOverlap({ x: h.x - h.R, y: h.ty - 120, w: h.R * 2, h: 124 }, hb)) P.receiveHit(h.owner, { dmg: 22, unblockable: true, kb: 380, hx: h.x, hy: h.ty - 50 });
        }
        if (h.boom && h.t > h.bt + 0.3) h.done = true;
      },
      draw(ctx, h, g) {
        if (h.boom) {
          if (h.fizzle) return;
          const k = (h.t - h.bt) / 0.3;
          ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, h.x, h.ty - 30, 90 + k * 40, '#ff6a4a', 0.7 * (1 - k));
          return;
        }
        if (h.landed) {
          // warning zone on the floor: the ring tightens and the crystal blinks faster as the fuse runs out
          const k = (h.t - h.fl) / h.fuse, blink = Math.sin(h.t * (10 + k * 30)) > 0;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = U.rgba('#ff2a3a', 0.08 + k * 0.18); ctx.beginPath(); ctx.ellipse(h.x, h.ty, h.R, h.R * 0.18, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = U.rgba('#ff3a4a', 0.5 + k * 0.5); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(h.x, h.ty, h.R, h.R * 0.18, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = U.rgba('#ffd0c0', 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(h.x, h.ty, h.R * (1 - k), h.R * 0.18 * (1 - k), 0, 0, TAU); ctx.stroke();
          if (blink) K.glow(ctx, h.x, h.y, 34, K.CRIM, 0.7);
          ctx.restore();
        }
        // the charge: a capped canister around a magenta crystal, sparking fuse
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.landed ? 0.2 : h.spin);
        ctx.fillStyle = '#2b2a33'; ctx.fillRect(-6, -9, 12, 18); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.strokeRect(-6, -9, 12, 18);
        ctx.fillStyle = '#ff6fb8'; ctx.fillRect(-3.5, -6, 7, 12);
        ctx.fillStyle = COL.brass; ctx.fillRect(-7, -10, 14, 3); ctx.fillRect(-7, 7, 14, 3);
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, 0, 0, 16, COL.magenta, 0.8);
        ctx.fillStyle = '#fff1c0'; ctx.beginPath(); ctx.arc(2, -13 + Math.sin(h.t * 40), 1.8, 0, TAU); ctx.fill();
        ctx.restore();
      },
    });
  }
  function mogSpikes(e, n, x0, step, delay) {
    const ar = G.game.arena;
    for (let i = 0; i < n; i++) {
      let x = e.x + e.facing * (x0 + i * step); if (ar) { if (x < ar.x0 + 20 || x > ar.x1 - 20) break; }
      const y = G.Phys.groundBelow(x, e.y - 80); if (y > 1e8) break;
      G.game.hazards.push({
        t: -(delay + i * 0.12), x, y, owner: e, life: 0.7, hit: false, seed: (Math.random() * 1e6) | 0,
        update(h, dt, g) {
          if (h.t >= 0 && !h.fx) { h.fx = true; G.SFX.play('pillar'); G.FX.shards(h.x, h.y - 6, 8, COL.magenta, 520); G.FX.dust(h.x, h.y, 6, { w: 40, speed: 160, size: 10, col: 'rgba(110,90,120,' }); g.shake(0.2); }
          if (h.t > 0.02 && h.t < 0.24 && !h.hit && !h.owner.dead) {
            if (U.rectsOverlap({ x: h.x - 30, y: h.y - 128, w: 60, h: 128 }, g.player.hurtbox)) { h.hit = true; g.player.receiveHit(h.owner, { dmg: 20, unblockable: true, kb: 340, hx: h.x, hy: h.y - 60 }); }
          }
        },
        draw(ctx, h) {
          if (h.t < 0) {
            const k = 1 + h.t / 0.4; if (k <= 0) return;
            ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, h.x, h.y - 4, 26 + k * 20, '#ff3a3a', 0.25 + k * 0.4);
            return;
          }
          const k = U.clamp(h.t / 0.08, 0, 1), fade = 1 - U.clamp((h.t - 0.35) / 0.35, 0, 1), H = 130 * U.easeOutBack(k);
          ctx.globalAlpha = fade;
          const rng = U.mulberry32(h.seed);
          for (let j = 0; j < 3; j++) { const ox = (j - 1) * 14 + (rng() - 0.5) * 6, hh = H * (j === 1 ? 1 : 0.55 + rng() * 0.2); ctx.save(); shard(ctx, h.x + ox, h.y + 2, hh, (j - 1) * 0.25, j === 1 ? 11 : 7, j === 1 ? '#ff5fb0' : '#c45cff'); ctx.restore(); }
          ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, h.x, h.y - H * 0.5, 60, COL.magenta, 0.35 * fade);
        },
      });
    }
  }
  function mogBurst(e, R, warn) {
    G.game.hazards.push({
      t: 0, x: e.x, y: e.y, R, warn, owner: e, life: warn + 0.45,
      update(h, dt, g) {
        if (h.t >= h.warn && !h.boom) {
          h.boom = true; G.SFX.play('c3_blast'); g.shake(0.8);
          G.FX.ring(h.x, h.y - 20, 20, h.R + 40, 0.45, COL.magenta, 8, { flat: 0.35 }); G.FX.shards(h.x, h.y - 20, 30, COL.magenta, 760);
          const P = g.player; if (Math.abs(P.x - h.x) < h.R && Math.abs(P.y - h.y) < 170) P.receiveHit(h.owner, { dmg: 22, unblockable: true, kb: 440, hx: P.x, hy: P.y - 60 });
        }
      },
      draw(ctx, h) {
        ctx.globalCompositeOperation = 'lighter';
        if (!h.boom) {
          const k = h.t / h.warn;
          ctx.fillStyle = U.rgba('#ff2a4a', 0.06 + k * 0.16); ctx.beginPath(); ctx.ellipse(h.x, h.y, h.R, h.R * 0.16, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = U.rgba('#ff3a5a', 0.4 + k * 0.6); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.R, h.R * 0.16, 0, 0, TAU); ctx.stroke();
        } else { const k = (h.t - h.warn) / 0.45; K.glow(ctx, h.x, h.y - 60, h.R * (0.8 + k * 0.4), COL.magenta, 0.6 * (1 - k)); }
      },
    });
  }
  // attack factories (k < 1 = the faster second phase; every tell still leads its hit by ≥ 0.45 s)
  const mog = {
    chop: (k) => ({
      dur: 2.15 * k, cd: 1.0, tells: [{ t: 0.16 * k, c: 'white' }, { t: 0.9 * k, c: 'white' }],
      poses: { dur: 2.15 * k, keys: [[0, MI], [0.6 * k, MG.up], [0.72 * k, MG.down, 'snap'], [1.0 * k, MG.down], [1.34 * k, MG.low], [1.5 * k, MG.rise, 'snap'], [2.15 * k, MI, 'io']] },
      moves: [{ t0: 0.6 * k, t1: 0.72 * k, v: 240 }, { t0: 1.38 * k, t1: 1.5 * k, v: 220 }],
      hits: [{ t0: 0.68 * k, t1: 0.8 * k, box: { x: 30, y: -232, w: 150, h: 228 }, dmg: 19, kb: 260 }, { t0: 1.45 * k, t1: 1.57 * k, box: { x: 20, y: -250, w: 150, h: 246 }, dmg: 17, kb: 300, last: true }],
      ev: [{ t: 0.68 * k, fn: (e) => mogThud(e, 0.35) }, { t: 1.45 * k, fn: () => G.SFX.play('slash', 0.55) }],
    }),
    // the delayed overhead: lifts, twitches as if to swing (don't flinch), holds, then drops
    feint: (k) => ({
      dur: 2.35 * k, cd: 1.0, tells: [{ t: 1.15 * k, c: 'white' }],
      poses: { dur: 2.35 * k, keys: [[0, MI], [0.5 * k, MG.up], [0.66 * k, MG.dip, 'snap'], [0.86 * k, MG.up, 'io'], [1.6 * k, { ...MG.up, aF: 3.15, sw: 4.05 }], [1.72 * k, MG.down, 'snap'], [2.35 * k, MI, 'io']] },
      moves: [{ t0: 1.6 * k, t1: 1.72 * k, v: 300 }],
      hits: [{ t0: 1.68 * k, t1: 1.8 * k, box: { x: 30, y: -232, w: 154, h: 228 }, dmg: 24, kb: 320, last: true, pbal: 70 }],
      ev: [{ t: 0.66 * k, fn: (e) => { G.SFX.play('c3_mog', 1.2); G.SFX.play('whoosh', 0.6); } }, { t: 1.68 * k, fn: (e) => mogThud(e, 0.45) }],
    }),
    sweep: (k) => ({
      dur: 1.55 * k, cd: 1.0, tells: [{ t: 0.16 * k, c: 'white' }],
      poses: { dur: 1.55 * k, keys: [[0, MI], [0.62 * k, MG.sweepW], [0.78 * k, MG.sweepS, 'snap'], [1.55 * k, MI, 'io']] },
      moves: [{ t0: 0.64 * k, t1: 0.76 * k, v: 300 }],
      hits: [{ t0: 0.68 * k, t1: 0.82 * k, box: { x: -10, y: -150, w: 196, h: 146 }, dmg: 18, kb: 320, last: true }],
      ev: [{ t: 0.68 * k, fn: () => G.SFX.play('slash', 0.5, true) }],
    }),
    // red: a hop and an overhead into the stone; a line of crystal spikes races forward from the impact
    slam: (k, n) => ({
      dur: 2.25 * k, cd: 1.2, tells: [{ t: 0.26 * k, c: 'red' }],
      poses: { dur: 2.25 * k, keys: [[0, MI], [0.85 * k, MG.slamUp], [0.97 * k, MG.slamDn, 'snap'], [1.6 * k, MG.slamDn], [2.25 * k, MI, 'io']] },
      moves: [{ t0: 0.6 * k, t1: 0.9 * k, v: 330 }],
      hits: [{ t0: 0.95 * k, t1: 1.1 * k, box: { x: 10, y: -210, w: 150, h: 214 }, dmg: 28, red: true, kb: 420, last: true }],
      ev: [{ t: 0.6 * k, fn: (e) => { if (e.onGround) e.vy = -420; G.SFX.play('whoosh', 0.9); } },
        { t: 0.95 * k, fn: (e) => { mogThud(e, 0.8); mogSpikes(e, n, 205, 90, 0.22); } }],
    }),
    bomb: (k, n) => ({
      dur: 1.6 * k, cd: 1.1, tells: [{ t: 0.25 * k, c: 'red' }],
      poses: { dur: 1.6 * k, keys: [[0, MI], [0.6 * k, MG.throwW], [0.76 * k, MG.throwS, 'snap'], [1.6 * k, MI, 'io']] },
      ev: [{ t: 0.3 * k, fn: () => G.SFX.play('c3_fuse') }, { t: 0.72 * k, fn: (e) => {
        const P = e.P, lead = P.x + P.vx * 0.45;
        if (n === 1) mogBomb(e, lead);
        else { mogBomb(e, lead); mogBomb(e, lead - 140 * e.facing); mogBomb(e, lead + 140 * e.facing); }
        G.SFX.play('whoosh', 1.1);
      } }],
    }),
  };
  function mogThud(e, k) {
    const w = e.wp || { x: e.x + e.facing * 140, y: e.y };
    const fy = G.Phys.groundBelow(w.x, e.y - 60);
    if (Math.abs(fy - w.y) < 70) { G.FX.dust(w.x, fy, 10, { w: 60, speed: 220, size: 14, col: 'rgba(120,100,120,' }); G.FX.shards(w.x, fy - 4, 6, '#9a8a9a', 420); }
    G.SFX.play('impact'); G.SFX.play('slash', 0.45, true); G.game.shake(k);
  }
  const MOG1 = { chop: mog.chop(1), feint: mog.feint(1), sweep: mog.sweep(1), slam: mog.slam(1, 3), bomb: mog.bomb(1, 1) };
  const MOG2 = { chop: mog.chop(0.92), feint: mog.feint(0.94), sweep: mog.sweep(0.92), slam: mog.slam(0.92, 5), bomb: mog.bomb(0.92, 3) };
  // phase-2 only: chop → low sweep → red slam (the long combo ends on a stuck pick: punish it)
  MOG2.cascade = {
    dur: 3.4, cd: 1.3, tells: [{ t: 0.16, c: 'white' }, { t: 0.84, c: 'white' }, { t: 1.5, c: 'red' }],
    poses: { dur: 3.4, keys: [[0, MI], [0.56, MG.up], [0.68, MG.down, 'snap'], [1.22, MG.sweepW], [1.36, MG.sweepS, 'snap'], [2.05, MG.slamUp], [2.17, MG.slamDn, 'snap'], [2.8, MG.slamDn], [3.4, MI, 'io']] },
    moves: [{ t0: 0.56, t1: 0.68, v: 240 }, { t0: 1.22, t1: 1.34, v: 300 }, { t0: 1.85, t1: 2.1, v: 300 }],
    hits: [
      { t0: 0.64, t1: 0.76, box: { x: 30, y: -232, w: 150, h: 228 }, dmg: 18, kb: 240 },
      { t0: 1.3, t1: 1.42, box: { x: -10, y: -150, w: 196, h: 146 }, dmg: 17, kb: 260 },
      { t0: 2.15, t1: 2.3, box: { x: 10, y: -210, w: 150, h: 214 }, dmg: 28, red: true, kb: 420, last: true },
    ],
    ev: [{ t: 0.64, fn: (e) => mogThud(e, 0.35) }, { t: 1.3, fn: () => G.SFX.play('slash', 0.5, true) }, { t: 1.85, fn: (e) => { if (e.onGround) e.vy = -380; } }, { t: 2.15, fn: (e) => { mogThud(e, 0.8); mogSpikes(e, 4, 205, 90, 0.22); } }],
  };
  const MOG_RAGE = {
    dur: 2.0, cd: 0.6, tells: [{ t: 0.3, c: 'red' }],
    poses: { dur: 2.0, keys: [[0, MI], [0.35, MG.roar], [1.5, { ...MG.roar, torso: -0.45 }], [2.0, MI, 'io']] },
    ev: [{ t: 0.1, fn: (e) => mogBurst(e, 200, 1.2) }],
  };
  function mogPhase2(e) {
    e.phase = 2; e.speedMul = 1.12; e.atk = null; e.cd = 0;
    G.game.bark('c3_eliteP2'); G.SFX.play('roar'); G.SFX.play('c3_mog', 0.8); G.game.shake(0.9); G.game.slowmo(0.6, 0.35);
    G.FX.ring(e.cx, e.cy, 20, 340, 0.8, COL.magenta, 7); G.FX.flash(e.cx, e.cy, 280, 0.5, COL.magenta); G.FX.shards(e.x, e.y - 130, 30, COL.magenta, 640);
    e.startAtk(MOG_RAGE);
  }
  function mogPose(e, dt) {
    let target, walking = false;
    if (e.state === 'atk' && e.atk && e.atk.poses) target = Rig.sample(e.atk.poses, e.st);
    else if (e.state === 'hurt' || e.state === 'recoil') { const w = Math.sin(k01(e.st / (e.hurtDur || 0.4)) * PI); target = Rig.lerpPose(Rig.full(MG.idle(e.t)), Rig.full(MG.hurt), w); }
    else if (e.state === 'broken') target = MG.broken(e.t);
    else if (Math.abs(e.vx) > 30 && e.onGround) {
      walking = true;
      const prev = Math.floor((e.gaitP || 0) / PI);
      e.gaitP = (e.gaitP || 0) + Math.abs(e.vx) * dt * PI / (2 * 16);
      if (Math.floor(e.gaitP / PI) !== prev && Math.abs(e.x - e.P.x) < 800) G.SFX.play('heavyStep');
      const w = Rig.ANIM.walk(e.gaitP);
      target = { ...MG.idle(e.t), ik: 1, fFx: w.fFx * 1.1 + 6, fFy: w.fFy * 1.2, fBx: w.fBx * 1.1 - 6, fBy: w.fBy * 1.2, ry: w.ry + 8 };
    } else target = MG.idle(e.t);
    if (e.onGround && e.state !== 'broken' && !walking) target = Rig.groundify(target);
    const hk = e.hitK;
    if (hk > 0) { const f = Rig.full(target); target = Rig.lerpPose(f, { ...f, torso: f.torso - 0.32, head: f.head + 0.45, ry: f.ry + 3 }, Math.min(1, hk * 1.2)); }
    K.blendPose(e, target, dt, hk > 0 ? 40 : e.state === 'atk' ? 30 : 12);
  }
  function mogDraw(ctx, e) {
    const T = TYPES.c3_elite, s = T.scale, dt = G.game.dtVis, p2 = e.phase === 2, t = e.t;
    mogPose(e, dt);
    const J = Rig.compute(e.pose); e.J = J;
    if (e.coat) e.coat.update(e.x + e.facing * (J.hip.x - 8) * s, e.y + (J.hip.y - 6) * s, e.facing, dt, -e.vx * 4 + Math.sin(t * 1.8) * 160, 2.85);
    const d = { x: Math.sin(J.sw), y: Math.cos(J.sw) }, kd = { x: -d.y, y: d.x };
    const grip = J.hdF, head = { x: grip.x + d.x * 60, y: grip.y + d.y * 60 }, butt = { x: grip.x - d.x * 16, y: grip.y - d.y * 16 };
    const spike = { x: head.x + kd.x * 30, y: head.y + kd.y * 30 }, hammer = { x: head.x - kd.x * 12, y: head.y - kd.y * 12 };
    const out = {};
    frame(ctx, e, { h: 280, w: 90 }, (c) => {
      c.scale(s, s);
      const L = Rig.limb, LC = Rig.limbChain;
      const COAT = COL.coat, COATD = '#6e3417', TROU = '#3b302c', BOOT = '#241c1a', GLOVE = '#3a2a22';
      // coat tails
      if (e.coat && e.coat.inited) { const cp = e.coat.p.map((q) => ({ x: (q.x - e.x) * e.facing / s, y: (q.y - e.y) / s })); K.tattered(c, cp, 9, 13, COATD, '#3a1a10', 5); }
      // torso frame
      const tA = Math.atan2(J.chest.y - J.hip.y, J.chest.x - J.hip.x), ux = Math.cos(tA), uy = Math.sin(tA), nx = -uy, ny = ux;
      const Q = (a, f) => ({ x: J.hip.x + ux * a * 36 + nx * f, y: J.hip.y + uy * a * 36 + ny * f });
      // backpack: riveted canister, fuse spool, charge tubes (phase 2: crystals burst through)
      const pk = Q(0.68, -17);
      c.save(); c.translate(pk.x, pk.y); c.rotate(tA + PI / 2);
      if (p2) for (const [x, y, l, a] of [[-6, -18, 30, -0.5], [2, -20, 40, -0.1], [9, -16, 26, 0.35], [-10, -4, 22, -1.0]]) shard(c, x, y, l, a, 5, '#ff5fb0');
      c.fillStyle = lit(c, '#4d5262', 0, 0, 16); c.beginPath(); c.roundRect ? c.roundRect(-11, -19, 22, 38, 5) : c.rect(-11, -19, 22, 38); c.fill(); ink(c, 1.4);
      c.fillStyle = '#c8ccd8'; for (const y of [-14, -4, 6, 14]) { c.beginPath(); c.arc(-8, y, 1, 0, TAU); c.arc(8, y, 1, 0, TAU); c.fill(); }
      c.fillStyle = '#ff6fb8'; c.fillRect(-7, -27, 5, 9); c.fillRect(1, -25, 5, 7); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(-7, -27, 5, 9); c.strokeRect(1, -25, 5, 7);
      c.beginPath(); c.arc(-11, 8, 7, 0, TAU); c.fillStyle = '#7a5032'; c.fill(); ink(c, 1.1);
      c.strokeStyle = '#d9a35a'; c.lineWidth = 0.8; c.beginPath(); for (let a = 0; a < 10; a += 0.3) { const r = 1 + a * 0.55; c.lineTo(-11 + Math.cos(a) * r, 8 + Math.sin(a) * r); } c.stroke();
      c.fillStyle = '#2b2b33'; c.fillRect(4, -30, 4, 10); c.strokeRect(4, -30, 4, 10);
      c.restore();
      if (p2 || !LOW()) glowAt(c, pk.x, pk.y - 14, 26, COL.magenta, p2 ? 0.55 : 0.25);
      out.pack = { x: pk.x - 6, y: pk.y - 30 };
      // back arm + leg
      LC(c, [J.shB, J.elB, J.hdB], [5.6, 4.6, 4.0], COATD);
      L(c, J.hdB, { x: J.hdB.x + 0.1, y: J.hdB.y + 0.1 }, 4.4, 4.4, GLOVE, { noHatch: true });
      LC(c, [J.hip, lerpP(J.hip, J.kneeB, 0.45), J.kneeB, lerpP(J.kneeB, J.ankB, 0.4), J.ankB], [8.5, 7.6, 5.6, 5.0, 4.0], '#2a2220');
      L(c, J.ankB, { x: J.toeB.x + 3, y: J.toeB.y }, 5.4, 4.2, BOOT, { noHatch: true });
      // torso: barrel-chested in a burnt-orange miner's coat
      const tp = [Q(-0.18, -13), Q(0.35, -15.5), Q(0.82, -16.5), Q(1.1, -9), Q(1.14, 6), Q(0.9, 16), Q(0.5, 18), Q(0.0, 15)];
      c.beginPath(); c.moveTo(tp[0].x, tp[0].y); for (let i = 1; i <= tp.length; i++) { const a = tp[i - 1], b = tp[i % tp.length]; c.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); } c.closePath();
      const LD = Rig.lightDir(c);
      c.fillStyle = Rig.celGrad(c, Q(0.5, 0).x, Q(0.5, 0).y, nx, ny, 18, LD.x * nx >= 0 ? 1 : -1, Rig.ramp(COAT)); c.fill(); ink(c, 1.5);
      // hazard-striped hem
      c.save(); c.clip();
      c.fillStyle = '#e8b230'; c.beginPath(); const h0 = Q(-0.18, -16), h1 = Q(0.08, -16); c.moveTo(h0.x, h0.y); c.lineTo(h1.x, h1.y); const h2 = Q(0.08, 20), h3 = Q(-0.18, 20); c.lineTo(h2.x, h2.y); c.lineTo(h3.x, h3.y); c.fill();
      c.strokeStyle = '#141014'; c.lineWidth = 3; for (let i = -3; i <= 3; i++) { const a = Q(-0.2, i * 6), b = Q(0.1, i * 6 + 6); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      if (p2) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = U.rgba(COL.magenta, 0.55 + Math.sin(t * 7) * 0.2); c.lineWidth = 1.2; for (const [a0, f0, a1, f1] of [[0.3, -14, 0.55, -4], [0.55, -4, 0.7, 6], [0.6, 8, 0.85, 12]]) { const A = Q(a0, f0), B = Q(a1, f1); c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke(); } }
      c.restore();
      // harness + bandolier of crystal charges
      const s0 = Q(1.02, -11), s1 = Q(0.1, 15);
      c.beginPath(); c.moveTo(s0.x, s0.y); c.lineTo(s1.x, s1.y); ink(c, 6.5); c.strokeStyle = '#4a2c1c'; c.lineWidth = 4.2; c.stroke();
      for (const u of [0.28, 0.5, 0.72]) {
        const q = lerpP(s0, s1, u), a = Math.atan2(s1.y - s0.y, s1.x - s0.x);
        c.save(); c.translate(q.x, q.y); c.rotate(a + PI / 2);
        c.fillStyle = '#2b2a33'; c.fillRect(-3, -6, 6, 11); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(-3, -6, 6, 11);
        c.fillStyle = p2 ? '#ff8ac8' : '#e0559c'; c.fillRect(-1.6, -4, 3.2, 7); c.fillStyle = COL.brass; c.fillRect(-3.5, -7, 7, 2);
        c.restore();
      }
      if (p2 || !LOW()) glowAt(c, lerpP(s0, s1, 0.5).x, lerpP(s0, s1, 0.5).y, 18, COL.magenta, p2 ? 0.5 : 0.22);
      const bk = Q(0.12, 2); c.fillStyle = COL.brass; c.fillRect(bk.x - 3, bk.y - 3, 6, 6); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(bk.x - 3, bk.y - 3, 6, 6);
      // front leg: knee pad + heavy boot
      LC(c, [J.hip, lerpP(J.hip, J.kneeF, 0.45), J.kneeF, lerpP(J.kneeF, J.ankF, 0.4), J.ankF], [9.2, 8.2, 6.0, 5.4, 4.3], TROU, { spec: 0.15 });
      c.beginPath(); c.ellipse(J.kneeF.x + 1.5, J.kneeF.y, 6.2, 5, 0, 0, TAU); c.fillStyle = lit(c, COL.steel, J.kneeF.x, J.kneeF.y, 6); c.fill(); ink(c, 1.1);
      L(c, J.ankF, { x: J.toeF.x + 3, y: J.toeF.y }, 5.8, 4.6, BOOT, { noHatch: true, spec: 0.2 });
      c.fillStyle = '#100c0c'; c.fillRect(J.ankF.x - 5, J.toeF.y + 1.5, J.toeF.x - J.ankF.x + 12, 2.5);
      // head: brass helmet with the lamp, rebreather, one burning eye
      // hose from the rebreather to the pack
      const hq = { x: J.head.x + Math.sin(J.ha) * 0 + Math.cos(J.ha) * 6, y: J.head.y + 8 };
      c.beginPath(); c.moveTo(hq.x, hq.y); c.quadraticCurveTo(pk.x + 4, hq.y + 16, pk.x + 2, pk.y - 8); ink(c, 4.4); c.strokeStyle = '#3d4250'; c.lineWidth = 2.6; c.stroke();
      c.save(); c.translate(J.head.x, J.head.y); c.rotate(J.ha);
      c.beginPath(); c.ellipse(1, 1, 10, 10.5, 0, 0, TAU); c.fillStyle = '#1a1014'; c.fill(); ink(c, 1.2);
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = U.rgba(COL.magenta, p2 ? 1 : 0.85); c.fillRect(3, -3, 6.5, 1.8); K.glow(c, 6, -2, p2 ? 16 : 11, COL.magenta, p2 ? 0.8 : 0.5); c.restore();
      // rebreather snout + filter
      path(c, [[1, 2], [11, 1], [14, 7], [10, 12], [2, 11]]); c.fillStyle = lit(c, '#4a5060', 8, 6, 8); c.fill(); ink(c, 1.1);
      c.beginPath(); c.arc(11.5, 9, 3.6, 0, TAU); c.fillStyle = '#2a2d36'; c.fill(); ink(c, 1); c.strokeStyle = '#8d96a8'; c.lineWidth = 0.6; c.beginPath(); c.arc(11.5, 9, 2, 0, TAU); c.stroke();
      // helmet dome + brim + lamp
      blob(c, [[-12, -1], [-11, -10], [-3, -16], [7, -15], [12, -9], [13, -3]]); c.fillStyle = lit(c, COL.brass, 1, -8, 13); c.fill(); ink(c, 1.4);
      c.strokeStyle = 'rgba(11,6,18,0.55)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-3, -15.5); c.quadraticCurveTo(0, -8, -2, -1); c.stroke();
      path(c, [[-14, -1], [17, -3], [17, 0], [-13, 2]]); c.fillStyle = '#9a6e2a'; c.fill(); ink(c, 1.1);
      c.fillStyle = '#3a3036'; c.fillRect(9, -13, 6, 7); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(9, -13, 6, 7);
      const lampC = p2 ? COL.magenta : '#b8fff2', fl = p2 ? 0.6 + Math.sin(t * 23) * 0.25 + Math.sin(t * 7) * 0.15 : 0.9;
      c.fillStyle = lampC; c.beginPath(); c.ellipse(15.5, -9.5, 1.6, 3.2, 0, 0, TAU); c.fill(); ink(c, 0.8);
      if (!LOW()) {
        c.save(); c.globalCompositeOperation = 'lighter';
        const gl = c.createLinearGradient(16, -9.5, 110, -2); gl.addColorStop(0, U.rgba(lampC, 0.22 * fl)); gl.addColorStop(1, U.rgba(lampC, 0));
        c.fillStyle = gl; c.beginPath(); c.moveTo(16, -12); c.lineTo(110, -30); c.lineTo(110, 18); c.lineTo(16, -7); c.closePath(); c.fill();
        c.restore();
      }
      glowAt(c, 16, -9.5, 12, lampC, 0.7 * fl);
      // the Hush growing through the helmet
      shard(c, -6, -13, p2 ? 18 : 11, -0.6, 3.4, '#ff5fb0'); if (p2) { shard(c, 1, -15, 13, 0.1, 2.8, '#ff8ac8'); shard(c, -11, -6, 12, -1.3, 2.8, '#c45cff'); }
      c.restore();
      // front arm: sleeve, bare scarred forearm, glove
      LC(c, [J.sh, lerpP(J.sh, J.elF, 0.5), J.elF], [7.2, 6.6, 5.6], COAT, { spec: 0.2 });
      LC(c, [J.elF, J.hdF], [5.0, 4.2], '#8a5e48');
      if (p2) shard(c, lerpP(J.elF, J.hdF, 0.5).x, lerpP(J.elF, J.hdF, 0.5).y, 10, Math.atan2(J.hdF.x - J.elF.x, -(J.hdF.y - J.elF.y)) - 1.2, 2.6, '#ff5fb0');
      // pauldron
      c.beginPath(); c.ellipse(J.sh.x - 1, J.sh.y + 1, 10.5, 7.5, -0.35 + J.ha * 0.3, 0, TAU); c.fillStyle = lit(c, COL.steel, J.sh.x, J.sh.y, 10); c.fill(); ink(c, 1.3);
      c.save(); c.beginPath(); c.ellipse(J.sh.x - 1, J.sh.y + 1, 10.5, 7.5, -0.35 + J.ha * 0.3, 0, TAU); c.clip();
      c.strokeStyle = '#e8b230'; c.lineWidth = 2.4; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(J.sh.x - 12 + i * 6, J.sh.y + 8); c.lineTo(J.sh.x - 6 + i * 6, J.sh.y - 8); c.stroke(); }
      c.restore();
      if (p2) { shard(c, J.sh.x - 4, J.sh.y - 4, 16, -0.4, 3.4, '#ff5fb0'); shard(c, J.sh.x + 2, J.sh.y - 5, 11, 0.3, 2.6, '#c45cff'); }
      // the pick: ash haft with iron bands, a steel head whose spike is fused with Hush crystal
      L(c, butt, head, 2.6, 2.3, '#6b4528', { noHatch: true, spec: 0.3 });
      for (const u of [0.25, 0.7]) { const q = lerpP(butt, head, u); c.beginPath(); c.arc(q.x, q.y, 2.9, 0, TAU); c.fillStyle = '#5b6070'; c.fill(); ink(c, 0.8); }
      c.beginPath();
      c.moveTo(hammer.x + d.x * 5, hammer.y + d.y * 5); c.lineTo(hammer.x - d.x * 5, hammer.y - d.y * 5);
      c.quadraticCurveTo(head.x - d.x * 7, head.y - d.y * 7, spike.x - d.x * 2, spike.y - d.y * 2);
      c.lineTo(spike.x, spike.y);
      c.quadraticCurveTo(head.x + d.x * 8 + kd.x * 4, head.y + d.y * 8 + kd.y * 4, hammer.x + d.x * 5, hammer.y + d.y * 5);
      c.closePath(); c.fillStyle = lit(c, '#a3abbd', head.x, head.y, 18); c.fill(); ink(c, 1.4);
      shard(c, head.x + kd.x * 10, head.y + kd.y * 10, 24, Math.atan2(kd.x, -kd.y), 4.2, p2 ? '#ff5fb0' : '#e0559c');
      L(c, { x: grip.x - d.x * 2.5, y: grip.y - d.y * 2.5 }, { x: grip.x + d.x * 2.5, y: grip.y + d.y * 2.5 }, 4.4, 4, GLOVE, { noHatch: true });
      if (e.tellT > 0) glowAt(c, spike.x, spike.y, 40, e.tellCol === 'red' ? K.CRIM : '#ffffff', e.tellT);
      out.spike = spike; out.handB = J.hdB;
    });
    if (out.spike) { e.wp = toW(e, out.spike, s); e.handB = toW(e, out.handB, s); e.wpPack = toW(e, out.pack, s); }
    devBoxes(ctx, e);
  }
  TYPES.c3_elite = {
    name: '爆破手・莫格', en: 'MOG THE SAPPER', w: 64, h: 190, hp: 580, bal: 200, col: '#ff5fb0', shards: 240, elite: true, scale: 1.42, spawnT: 1.1, poise: true, kbMul: 0.5,
    defeatDialog: 'c3_eliteDefeat', defeatRelic: 'c3_fuse', music: 'c3_elite', portrait: [1.6, 0.95],
    init(e) {
      e.seed = (Math.random() * 1e9) | 0; e.coat = new Rig.Chain(6, 9, 0.06, 0.88); e.facing = -1; e.lastMoves = []; e.puffT = 0;
      hookUpdate(e, (q, dt) => {
        if (q.state === 'die' || q.state === 'spawn' || !q.wpPack) return;
        q.puffT -= dt;
        if (q.puffT <= 0) {
          q.puffT = q.phase === 2 ? 0.12 : 0.5;
          if (q.phase === 2) G.FX.ember(q.wpPack.x, q.wpPack.y, 2, COL.magenta, { w: 30, h: 20, up: 140 });
          else G.FX.dust(q.wpPack.x, q.wpPack.y, 1, { w: 6, speed: 40, size: 9, col: 'rgba(150,140,150,' });
        }
      });
    },
    voice: (e) => G.SFX.play('c3_mog', e.phase === 2 ? 0.85 : 1),
    weapon: (e) => ((e.atk === MOG1.bomb || e.atk === MOG2.bomb) ? e.handB : e.wp) || { x: e.x + e.facing * 120, y: e.y - 160 },
    think(e, dt) {
      e.faceP(); const d = e.distP();
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) { mogPhase2(e); return; }
      const sp = 150 * e.speedMul;
      e.vx = U.approach(e.vx, d > 240 ? e.facing * sp : d < 95 ? -e.facing * 110 : d > 175 ? e.facing * sp * 0.55 : 0, 900 * dt);
      if (e.cd > 0) return;
      const p2 = e.phase === 2, M = p2 ? MOG2 : MOG1, pool = [];
      if (d < 205) { pool.push(['chop', 3], ['feint', 2], ['sweep', 2]); if (p2) pool.push(['cascade', 3]); }
      if (d < 290) pool.push(['slam', d < 230 ? 1.2 : 2.6]);
      if (d > 210) pool.push(['bomb', d > 300 ? 4 : 1.5]);
      if (!pool.length) { e.cd = 0.25; return; }
      const last = e.lastMoves[e.lastMoves.length - 1], wt = (q) => (q[0] === last ? q[1] * 0.25 : q[1]);
      let r = Math.random() * pool.reduce((a, q) => a + wt(q), 0), pick = pool[0][0];
      for (const q of pool) { if ((r -= wt(q)) <= 0) { pick = q[0]; break; } }
      e.lastMoves.push(pick); if (e.lastMoves.length > 4) e.lastMoves.shift();
      e.startAtk(M[pick]);
    },
    atkUpdate(e, dt) { if (!e.onGround) e.vx = U.approach(e.vx, 0, 200 * dt); },
    draw(ctx, e) { mogDraw(ctx, e); },
  };
  // expose the phase-1 moves on the type (gallery: &pose=chop:0.7) and the phase-2 set for tests
  Object.assign(TYPES.c3_elite, MOG1, { cascade: MOG2.cascade, rage: MOG_RAGE, phase2Moves: MOG2 });

  /* =========================== relic: 引信 THE FUSE =========================== */
  // executions on elites/bosses deal +50% (the execution's final blow is a big, balance-free hit during the player's 'execute')
  G.Relics.c3_fuse = { apply() { } };
  if (!G.Enemy.prototype.__c3fuse) {
    const base = G.Enemy.prototype.takeHit;
    G.Enemy.prototype.takeHit = function (h) {
      const g = G.game, P = g && g.player;
      if (h && h.big && h.bal === 0 && (this.boss || this.elite) && P && P.state === 'execute' && P.exTarget === this && (g.save.equipped || []).includes('c3_fuse')) {
        h = Object.assign({}, h, { dmg: h.dmg * 1.5, crit: true });
      }
      return base.call(this, h);
    };
    G.Enemy.prototype.__c3fuse = true;
  }

  // dev aid for close-up screenshots: ?c3hb=1&c3cam=x,y,zoom pins the camera (tools/test.html's own zoom is damped away)
  if (DEV) window.addEventListener('load', () => {
    const m = /[?&]c3cam=(-?[\d.]+),(-?[\d.]+),([\d.]+)/.exec(location.search); if (!m || !G.game) return;
    const v = { x: +m[1], y: +m[2], zoom: +m[3], tx: +m[1], ty: +m[2] }, cam = G.game.cam;
    for (const k in v) Object.defineProperty(cam, k, { get: () => v[k], set() { }, configurable: true });
  });

  /* =========================== self-check (shows up in tools/test.html #lint consoleWarnings) =========================== */
  (function check() {
    const sets = [];
    for (const k of ['c3_carapace', 'c3_echobat', 'c3_listener', 'c3_borer', 'c3_elite']) { const T = TYPES[k]; for (const a in T) if (T[a] && T[a].dur && (T[a].hits || T[a].ev)) sets.push([k + '.' + a, T[a]]); }
    for (const a in MOG2) sets.push(['c3_elite.p2.' + a, MOG2[a]]);
    for (const [name, A] of sets) for (const h of A.hits || []) {
      const tl = (A.tells || []).filter((q) => q.t <= h.t0).pop();
      if (!tl) { console.warn(`[c3_foes] ${name}: hit at ${h.t0.toFixed(2)} has no tell`); continue; }
      const need = tl.c === 'red' ? 0.599 : 0.449;   // STORY.md §2: white ≥ 0.45 s, red / big ≥ 0.6 s
      if (h.t0 - tl.t < need) console.warn(`[c3_foes] ${name}: hit lands ${(h.t0 - tl.t).toFixed(2)}s after its ${tl.c} tell (< ${need > 0.5 ? 0.6 : 0.45})`);
      if (!!h.red !== (tl.c === 'red')) console.warn(`[c3_foes] ${name}: tell colour ${tl.c} does not match hit (red=${!!h.red})`);
    }
  })();
})(window.G);

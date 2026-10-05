'use strict';
/* ECHOFALL — dungeon-master events (on the fork roads and behind the Abyss's "？" doors).
   A parchment card: a painted vignette, a few lines of narration, and two or three approaches — each an ability check
   with its DC and your odds shown up front (js/dice.js). Outcomes are immediate: shards, healing, gear, smithing stones,
   an Echo, a blessing or a curse that lasts until your next rest, or an ambush. */
(function (G) {
  const U = G.U, $ = (s) => document.querySelector(s), I = () => G.Input;
  const chOf = () => (G.LEVEL.chapter || 1);
  const scale = (n) => Math.round(n * (1 + 0.4 * (chOf() - 1)));

  /* ---------------------------------------------------------------- outcomes */
  const O = {
    shards: (n) => (g) => { const v = scale(n); g.save.shards = Math.max(0, g.save.shards + v); return v >= 0 ? `殘響碎片 +${v}` : `殘響碎片 −${-v}`; },
    stone: (n) => (g) => { g.save.stones = (g.save.stones || 0) + n; return `鍛造石 +${n}`; },
    heal: (p) => (g) => { const P = g.player; P.hp = Math.min(P.maxHp, P.hp + P.maxHp * p); G.SFX.play('heal'); return `回復 ${Math.round(p * 100)}% 生命`; },
    hurt: (p) => (g) => { const P = g.player; P.hp = Math.max(1, P.hp - P.maxHp * p); P.flash = 1; g.shake(0.5); G.SFX.play('hurt'); return `失去 ${Math.round(p * 100)}% 生命`; },
    gear: (tier) => (g) => { const P = g.player; G.Gear.spawnLoot(g, { cx: P.x + P.facing * 60, cy: P.y - 80, y: P.y }, G.Gear.roll(G.Abyss.lootCh(), tier, 0.1), 0, 1); return '一件裝備落在你腳邊'; },
    echo: () => (g) => { setTimeout(() => g.offerEcho(), 250); return '殘響回應了你'; },
    bless: () => (g) => { g.player.evBless = true; g.player.recalc(); return '祝福：傷害 +15%（直到下次休息）'; },
    curse: () => (g) => { g.player.evCurse = true; g.player.recalc(); return '詛咒：最大生命 −15%（直到下次休息）'; },
    ambush: (n = 3) => (g) => {
      const P = g.player, T = G.ENEMY_TYPES, ch = chOf();
      const pool = Object.keys(T).filter((k) => (ch === 1 ? ['murmur', 'sentinel'].includes(k) : k.startsWith('c' + ch + '_')) && !T[k].boss && !T[k].elite && !T[k].summon && !T[k].fly && k !== 'phantom' && !k.includes('_elite'));
      for (let i = 0; i < n; i++) {
        const x = P.x + (i % 2 ? 1 : -1) * (220 + i * 60), t = pool[Math.floor(Math.random() * pool.length)];
        const e = new G.Enemy(t, x, G.Phys.groundBelow(x, P.y - 150), { enc: 'evt', spawn: {} }); e.facing = x < P.x ? 1 : -1; g.enemies.push(e);
        G.FX.shards(x, P.y, 10, e.T.col, 300);
      }
      G.SFX.play('stingBattle'); return '寂裔從暗處撲了上來！';
    },
    none: () => () => '什麼也沒有發生',
  };
  const all = (...fs) => (g) => fs.map((f) => f(g)).filter(Boolean).join('・');

  /* ---------------------------------------------------------------- the events */
  const EV = [
    { id: 'hanged', art: 'gallows', title: '吊著的鐘匠', text: '一具屍體掛在斷裂的鐘架上，嘴唇還在動。他在重複一句妳聽不清楚的話。',
      opts: [
        { label: '靠近，聽清楚他在說什麼', attr: 'wis', dc: 12, ok: all(O.shards(160), O.stone(1)), okT: '「……第三塊石板下面。」妳掀開石板，底下藏著他沒來得及帶走的東西。', no: O.hurt(0.15), noT: '他突然睜開眼，牙齒咬進妳的手腕。' },
        { label: '把他放下來', attr: 'str', dc: 13, ok: O.gear(1), okT: '繩子斷了。他落地時鬆開了一直握著的東西，然後終於安靜了。', no: O.ambush(2), noT: '繩子一鬆，他和其他吊著的人一起醒了過來。' },
        { label: '離開', leave: true },
      ] },
    { id: 'merchant', art: 'merchant', title: '沒有臉的商人', text: '提燈的商人沒有臉。他攤開一塊布，上面擺著死者身上的東西，比了個「要不要」的手勢。',
      opts: [
        { label: '殺價', attr: 'cha', dc: 13, ok: all(O.gear(2)), okT: '他想了很久，最後把最好的那件推給妳，什麼也沒收。', no: O.shards(-60), noT: '他收了妳的碎片，然後把貨收起來，消失了。' },
        { label: '看穿他的貨', attr: 'int', dc: 12, ok: O.shards(220), okT: '貨是假的，碎片卻是真的。妳拿走他藏在箱底的那袋。', no: O.curse(), noT: '妳伸手的那一刻，他終於有了一張臉——妳的臉。' },
        { label: '離開', leave: true },
      ] },
    { id: 'altar', art: 'altar', title: '崩塌的祭壇', text: '祭壇裂成兩半，刻在上面的符文還有一半在發光。供品沒有人動過。',
      opts: [
        { label: '把符文接回去', attr: 'int', dc: 12, ok: O.bless(), okT: '最後一道符文合上的瞬間，光流進了妳的劍。', no: O.hurt(0.12), noT: '符文燒穿了妳的手指。' },
        { label: '撬走供品', attr: 'str', dc: 11, ok: O.shards(180), okT: '沒有神會再來收這些了。', no: all(O.shards(90), O.curse()), noT: '妳拿到了一些，也帶走了一些不該帶走的東西。' },
        { label: '離開', leave: true },
      ] },
    { id: 'well', art: 'well', title: '低語之井', text: '井很深，深到聽得見井底有人在說話。說的好像是妳的名字——那個妳已經交出去的名字。',
      opts: [
        { label: '跪下來，仔細聽', attr: 'wis', dc: 13, ok: O.echo(), okT: '井底的聲音給了妳一段旋律。', no: O.curse(), noT: '妳聽太久了，有一部分的妳留在了井底。' },
        { label: '喝一口井水', attr: 'con', dc: 12, ok: O.heal(0.6), okT: '水冰冷，卻讓妳暖了起來。', no: O.hurt(0.2), noT: '水裡有頭髮。很多很多頭髮。' },
        { label: '離開', leave: true },
      ] },
    { id: 'door', art: 'door', title: '封印的門', text: '一扇刻滿封印的石門，門縫裡透出溫暖的光。封印上寫的不是禁止，是道歉。',
      opts: [
        { label: '解讀封印', attr: 'int', dc: 14, ok: all(O.stone(2), O.shards(140)), okT: '封印讀完的時候，門自己開了。裡面是某人留給孩子的東西。', no: O.hurt(0.15), noT: '封印把妳推了回來。' },
        { label: '硬撞開', attr: 'str', dc: 15, ok: O.gear(2), okT: '門倒下的聲音傳得很遠。', no: all(O.hurt(0.2), O.ambush(2)), noT: '門沒開，但聲音把附近的東西都叫醒了。' },
        { label: '離開', leave: true },
      ] },
    { id: 'statue', art: 'statue', title: '哭泣的石像', text: '一尊母親的石像，懷裡是空的。她的眼睛一直在流水，水在腳下積成一面鏡子。',
      opts: [
        { label: '在她身旁坐一會', attr: 'cha', dc: 12, ok: all(O.bless(), O.heal(0.3)), okT: '水停了。石像的手，好像輕輕碰了一下妳的頭。', no: O.none(), noT: '她沒有看妳。她在等的不是妳。' },
        { label: '取下她眼中的淚石', attr: 'dex', dc: 12, ok: O.shards(240), okT: '淚石落在妳掌心，還是溫的。', no: O.ambush(3), noT: '石像發出一聲尖叫，整條路的亡者都轉過頭來。' },
        { label: '離開', leave: true },
      ] },
    { id: 'boat', art: 'boat', title: '擱淺的渡船', text: '一艘小船擱在乾掉的河床上，船夫抱著槳坐著，像在等水回來。',
      opts: [
        { label: '向他行禮，請他載妳一程', attr: 'cha', dc: 13, ok: O.heal(1), okT: '他什麼也沒說，只是讓妳在船上躺了一下。醒來時，傷都好了。', no: O.none(), noT: '他搖搖頭。沒有水，哪裡也去不了。' },
        { label: '翻找船艙', attr: 'dex', dc: 11, ok: all(O.stone(1), O.shards(120)), okT: '船艙裡是付不出船資的人留下的東西。', no: O.hurt(0.12), noT: '船夫的槳打在妳背上。' },
        { label: '離開', leave: true },
      ] },
    { id: 'bell', art: 'bell', title: '倒下的大鐘', text: '一口比房子還大的鐘倒在路中間，鐘裡有東西在敲，一下，一下，很慢。',
      opts: [
        { label: '把鐘推起來', attr: 'str', dc: 14, ok: O.echo(), okT: '鐘響了。十八年來第一次。', no: O.hurt(0.18), noT: '鐘只動了一下，又重重落回妳的腳邊。' },
        { label: '從鐘口看進去', attr: 'wis', dc: 12, ok: O.gear(1), okT: '裡面是一個在敲鐘的骷髏，和他放在身旁的東西。', no: O.curse(), noT: '裡面那雙眼睛，也看了妳很久。' },
        { label: '離開', leave: true },
      ] },
    { id: 'tree', art: 'tree', title: '繫滿布條的神樹', text: '一棵枯樹上繫滿了五色的布條。每一條都是一個沒能回家的人，留給家人的話。',
      opts: [
        { label: '照著巫女的方式祈禱', attr: 'wis', dc: 11, ok: O.bless(), okT: '布條一起飄了起來，像在替妳送行。', no: O.none(), noT: '風沒有來。' },
        { label: '爬上去取下最高的那個布包', attr: 'dex', dc: 13, ok: O.gear(1), okT: '布包裡是一件被小心收著的東西。', no: O.hurt(0.15), noT: '樹枝斷了。妳和它一起摔了下來。' },
        { label: '離開', leave: true },
      ] },
    { id: 'child', art: 'child', title: '迷路的孩子', text: '一個小孩的亡魂蹲在路邊，抱著膝蓋。「我找不到媽媽。妳可以帶我去嗎？」',
      opts: [
        { label: '牽起他的手', attr: 'cha', dc: 11, ok: all(O.heal(0.4), O.shards(120)), okT: '走到路的盡頭，他放開妳的手，笑著跑進光裡。', no: O.hurt(0.1), noT: '他抓得太緊了，緊到開始變冷。' },
        { label: '問他媽媽長什麼樣子', attr: 'int', dc: 12, ok: O.echo(), okT: '他說的那個人，妳好像在哪裡見過。', no: O.none(), noT: '他想了很久，最後說，他忘了。' },
        { label: '離開', leave: true },
      ] },
    { id: 'mirror', art: 'mirror', title: '另一個妳', text: '一面立在路中央的鏡子。鏡子裡的妳，沒有被丟進海裡，穿著公主的衣服。',
      opts: [
        { label: '看穿這面鏡子', attr: 'wis', dc: 14, ok: all(O.echo(), O.bless()), okT: '「那不是我。」鏡子碎了，碎片落成一首歌。', no: O.curse(), noT: '妳看了太久，開始分不清哪一個才是真的。' },
        { label: '一拳打碎它', attr: 'str', dc: 12, ok: O.shards(200), okT: '碎掉的鏡子裡，每一片都映著一枚碎片。', no: all(O.hurt(0.15), O.ambush(2)), noT: '鏡子裡的妳走了出來，帶著她的朋友。' },
        { label: '離開', leave: true },
      ] },
    { id: 'coffer', art: 'chest', title: '上鎖的骨匣', text: '一只用肋骨拼成的匣子，鎖頭是一顆牙齒。裡面有東西在發光。',
      opts: [
        { label: '撬開鎖', attr: 'dex', dc: 13, ok: O.gear(2), okT: '咔。', no: all(O.hurt(0.15), O.shards(60)), noT: '機關射出一排骨刺，但匣子也開了一條縫。' },
        { label: '直接砸開', attr: 'str', dc: 12, ok: O.stone(2), okT: '骨頭碎了，裡面的東西也碎了一些，剩下的還能用。', no: O.hurt(0.12), noT: '骨匣比妳的手還硬。' },
        { label: '離開', leave: true },
      ] },
  ];

  /* ---------------------------------------------------------------- the painted vignette */
  function paint(cv, art, seed) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, r = U.mulberry32(seed || 7);
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#1a1426'); sky.addColorStop(0.6, '#3a2a3f'); sky.addColorStop(1, '#5a3a3a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // a low sun of the underworld and its haze
    const sx = W * (0.25 + r() * 0.5), sun = ctx.createRadialGradient(sx, H * 0.62, 4, sx, H * 0.62, H * 0.9);
    sun.addColorStop(0, 'rgba(255,190,140,.55)'); sun.addColorStop(1, 'rgba(255,190,140,0)'); ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    // far ruins
    ctx.fillStyle = '#2a1f2e';
    for (let x = 0; x < W; x += 30 + r() * 40) { const h = 30 + r() * 70; ctx.fillRect(x, H * 0.72 - h, 18 + r() * 26, h + 10); }
    ctx.fillStyle = '#140f18'; ctx.fillRect(0, H * 0.8, W, H);
    ctx.save(); ctx.translate(W / 2, H * 0.8); ctx.fillStyle = '#0b0712'; ctx.strokeStyle = '#0b0712';
    const glow = (x, y, rad, col) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 1, x, y, rad); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill(); ctx.restore(); ctx.fillStyle = '#0b0712'; };
    const A = {
      gallows() { ctx.fillRect(-70, -150, 8, 150); ctx.fillRect(-70, -150, 110, 7); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, -143); ctx.lineTo(20, -110); ctx.stroke();
        ctx.beginPath(); ctx.arc(20, -102, 8, 0, 7); ctx.fill(); ctx.fillRect(13, -95, 14, 40); ctx.fillRect(14, -56, 5, 30); ctx.fillRect(21, -56, 5, 28); glow(-40, -60, 40, 'rgba(255,170,90,.35)'); },
      merchant() { ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(-26, -60, 0, -95); ctx.quadraticCurveTo(26, -60, 20, 0); ctx.fill();
        ctx.fillStyle = '#d9cbb0'; ctx.beginPath(); ctx.ellipse(0, -80, 7, 9, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#0b0712';
        ctx.fillRect(30, -70, 2, 50); glow(31, -74, 36, 'rgba(255,200,120,.6)'); ctx.fillStyle = '#ffd28a'; ctx.fillRect(27, -78, 8, 9); ctx.fillStyle = '#0b0712';
        ctx.fillRect(-80, -26, 46, 26); ctx.beginPath(); ctx.arc(-70, 0, 9, 0, 7); ctx.arc(-44, 0, 9, 0, 7); ctx.fill(); },
      altar() { ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(-50, -50); ctx.lineTo(-4, -46); ctx.lineTo(-10, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(8, -44); ctx.lineTo(55, -52); ctx.lineTo(62, 0); ctx.fill();
        for (const x of [-40, -24, 22, 40]) { ctx.fillRect(x, -62, 4, 12); glow(x + 2, -66, 14, 'rgba(255,200,120,.7)'); }
        ctx.strokeStyle = 'rgba(127,244,255,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-40, -30); ctx.lineTo(-20, -36); ctx.moveTo(20, -30); ctx.lineTo(40, -38); ctx.stroke(); glow(0, -30, 50, 'rgba(127,244,255,.25)'); },
      well() { ctx.beginPath(); ctx.ellipse(0, -20, 60, 14, 0, 0, 7); ctx.fill(); ctx.fillRect(-60, -20, 120, 20); ctx.fillRect(-48, -90, 6, 70); ctx.fillRect(42, -90, 6, 70); ctx.fillRect(-52, -92, 104, 6);
        glow(0, -24, 60, 'rgba(201,182,255,.45)'); for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(220,210,255,.25)'; ctx.beginPath(); ctx.arc(-30 + i * 12, -40 - i * 8, 6 + i, 0, 7); ctx.fill(); } },
      door() { ctx.fillRect(-55, -130, 110, 130); ctx.fillStyle = '#20182a'; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-40, -95); ctx.arc(0, -95, 40, Math.PI, 0); ctx.lineTo(40, 0); ctx.fill();
        glow(0, -50, 70, 'rgba(255,200,130,.45)'); ctx.strokeStyle = 'rgba(255,214,150,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -130); ctx.lineTo(0, 0); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,214,150,.5)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(0, -40 - i * 18, 10 + i * 3, 0, 7); ctx.stroke(); } },
      statue() { ctx.fillRect(-40, -12, 80, 12); ctx.beginPath(); ctx.moveTo(-26, -12); ctx.quadraticCurveTo(-34, -80, -10, -110); ctx.lineTo(10, -110); ctx.quadraticCurveTo(34, -80, 26, -12); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -120, 13, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(127,244,255,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, -118); ctx.lineTo(-6, -40); ctx.moveTo(4, -118); ctx.lineTo(6, -40); ctx.stroke();
        ctx.fillStyle = 'rgba(127,244,255,.3)'; ctx.beginPath(); ctx.ellipse(0, 4, 70, 6, 0, 0, 7); ctx.fill(); },
      boat() { ctx.beginPath(); ctx.moveTo(-80, -20); ctx.quadraticCurveTo(0, 10, 80, -20); ctx.lineTo(70, -8); ctx.quadraticCurveTo(0, 18, -70, -8); ctx.fill(); ctx.fillRect(-6, -70, 22, 50); ctx.beginPath(); ctx.arc(5, -78, 10, 0, 7); ctx.fill();
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(20, -60); ctx.lineTo(60, 10); ctx.stroke(); ctx.fillRect(-60, -60, 2, 40); glow(-59, -62, 30, 'rgba(255,200,120,.6)'); },
      bell() { ctx.save(); ctx.rotate(-0.5); ctx.beginPath(); ctx.moveTo(-50, 0); ctx.quadraticCurveTo(-46, -80, 0, -95); ctx.quadraticCurveTo(46, -80, 50, 0); ctx.closePath(); ctx.fill(); ctx.restore();
        glow(14, -10, 40, 'rgba(255,190,120,.4)'); ctx.strokeStyle = 'rgba(255,214,150,.5)'; ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(30, -20, 20 * i, -0.6, 0.6); ctx.stroke(); } },
      tree() { ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -80); ctx.stroke(); ctx.lineWidth = 4;
        for (const [a, l] of [[-0.9, 60], [-0.4, 70], [0.3, 66], [0.8, 58]]) { ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(Math.sin(a) * l, -60 - Math.cos(a) * l); ctx.stroke(); }
        const cols = ['#3a6fd8', '#d43b3f', '#e2b04f', '#f2efe8', '#5a4a7a']; for (let i = 0; i < 18; i++) { ctx.fillStyle = cols[i % 5]; const x = -55 + r() * 110, y = -60 - r() * 55; ctx.fillRect(x, y, 3, 14 + r() * 10); } ctx.fillStyle = '#0b0712'; },
      child() { ctx.fillStyle = 'rgba(226,214,255,.85)'; ctx.beginPath(); ctx.arc(0, -46, 9, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-16, -34, 0, -38); ctx.quadraticCurveTo(16, -34, 14, 0); ctx.fill(); glow(0, -30, 50, 'rgba(201,182,255,.35)'); ctx.fillStyle = '#0b0712'; },
      mirror() { ctx.fillRect(-40, -130, 80, 130); ctx.fillStyle = '#4a3f5e'; ctx.fillRect(-32, -122, 64, 114); glow(0, -64, 60, 'rgba(201,182,255,.4)');
        ctx.fillStyle = 'rgba(255,240,220,.75)'; ctx.beginPath(); ctx.arc(0, -86, 7, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-12, -14); ctx.quadraticCurveTo(0, -80, 12, -14); ctx.fill(); ctx.fillStyle = '#0b0712'; },
      chest() { ctx.fillRect(-46, -40, 92, 40); ctx.beginPath(); ctx.ellipse(0, -40, 46, 16, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(235,226,208,.6)'; ctx.lineWidth = 2; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * 13, -40, 12, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } glow(0, -38, 50, 'rgba(255,214,150,.5)'); ctx.fillStyle = '#f2efe8'; ctx.fillRect(-3, -30, 6, 9); },
    };
    (A[art] || A.altar)();
    ctx.restore();
    // drifting ash
    ctx.fillStyle = 'rgba(255,230,210,.25)'; for (let i = 0; i < 40; i++) ctx.fillRect(r() * W, r() * H * 0.85, 1.5, 1.5);
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  /* ---------------------------------------------------------------- the card */
  const E = G.Events = {
    EV,
    pick(seen) { const left = EV.filter((e) => !(seen || []).includes(e.id)); const pool = left.length ? left : EV; return pool[Math.floor(Math.random() * pool.length)]; },
    open(game, ev, done) {
      ev = ev || this.pick(game.save.evSeen);
      game.save.evSeen = (game.save.evSeen || []).concat(ev.id).slice(-8);
      game.control = false; game.player.vx = 0; if (game.player.busy) game.player.setState('move');
      let el = $('#eventCard');
      if (!el) { el = document.createElement('section'); el.id = 'eventCard'; el.className = 'screen modal'; document.getElementById('ui').appendChild(el); }
      el.innerHTML = `<div class="evc"><div class="ev-artw"><canvas class="ev-art" width="640" height="250"></canvas></div>
        <div class="ev-body"><p class="ev-k">${G.Icons.svg('d20', 16)}地城主</p><h3>${ev.title}</h3><p class="ev-text">${ev.text}</p>
        <div class="ev-opts">${ev.opts.map((o, k) => o.leave ? `<button type="button" class="ev-opt leave" data-k="${k}">${o.label}</button>` : o.free ? (() => { const A = G.DnD.ATTRS.find((q) => q.id === o.attr); return `<button type="button" class="ev-opt" data-k="${k}" style="--ac:${A.col}">${G.Icons.badge(o.attr, A.col, 34)}<span class="eo-l">${o.label}</span><span class="eo-c">${A.name} ${G.DnD.score(o.attr)} → ${G.DnD.score(o.attr) + 1}</span></button>`; })() : (() => { const A = G.DnD.ATTRS.find((q) => q.id === o.attr); return `<button type="button" class="ev-opt" data-k="${k}" style="--ac:${A.col}">${G.Icons.badge(o.attr, A.col, 34)}<span class="eo-l">${o.label}</span><span class="eo-c">${A.name} DC ${o.dc}<small>成功率 ${G.Dice.chance(o.attr, o.dc)}%</small></span></button>`; })()).join('')}</div>
        <p class="ev-out" hidden></p></div></div>`;
      paint(el.querySelector('.ev-art'), ev.art, ev.id.length * 97 + chOf());
      let fi = 0, phase = 'choose';
      const btns = [...el.querySelectorAll('.ev-opt')];
      const focus = () => btns.forEach((b, k) => b.classList.toggle('focus', k === fi));
      const finish = () => { if (!(G.UI.top() && G.UI.top().id === 'event')) return; G.UI.pop(); game.control = true; G.Input.clearBuffers(); game.persist(); done && done(); };
      const show = (txt, res) => {
        phase = 'result';
        el.querySelector('.ev-opts').hidden = true;
        const out = el.querySelector('.ev-out'); out.hidden = false;
        out.innerHTML = `<span class="eo-t">${txt}</span>${res ? `<b class="eo-r">${res}</b>` : ''}<button type="button" class="gb-act main ev-done">繼續</button>`;
        out.querySelector('.ev-done').onclick = finish;
      };
      const choose = (k) => {
        if (phase !== 'choose') return;
        const o = ev.opts[k];
        if (o.leave) { G.SFX.play('uiBack'); finish(); return; }
        if (o.free) { G.SFX.play('pylon'); show(o.okT, o.ok(game)); return; }
        phase = 'rolling';
        G.Dice.check({ attr: o.attr, dc: o.dc, title: ev.title }, (r) => {
          let res = r.ok ? o.ok(game) : o.no(game);
          if (r.crit && r.ok) res += '・' + O.shards(80)(game);            // a natural 20 pays a little extra
          if (r.fumble) res += '・' + O.hurt(0.1)(game);                   // a natural 1 stings
          show(r.ok ? o.okT : o.noT, res);
        });
      };
      btns.forEach((b, k) => { b.onclick = () => choose(+b.dataset.k); b.onmouseenter = () => { fi = k; focus(); }; });
      focus();
      G.UI.push({ id: 'event', el, handle: () => {
        const In = I();
        if (phase === 'choose') {
          if (In.tap('menuUp')) { fi = (fi - 1 + btns.length) % btns.length; focus(); G.SFX.play('ui'); }
          else if (In.tap('menuDown')) { fi = (fi + 1) % btns.length; focus(); G.SFX.play('ui'); }
          else if (In.tap('confirm')) choose(fi);
        } else if (phase === 'result' && (In.tap('confirm') || In.tap('back'))) finish();
      } });
    },
    // 冥井的饋贈: a new five-floor record in the Bottomless Well raises one ability score for good
    wellGift(game, depth, done) {
      const ev = { id: 'well' + depth, art: 'well', title: `冥井的饋贈・第 ${depth} 層`, text: `妳走到了比任何人都深的地方。井底有個聲音問妳，想帶走哪一樣東西回到上面。`,
        opts: G.DnD.ATTRS.map((a) => ({ label: `${a.name}`, attr: a.id, free: true, ok: (g) => { g.save.dnd.attr[a.id] = Math.min(20, g.save.dnd.attr[a.id] + 1); g.player.recalc(); return `${a.name}永久 +1`; }, okT: '井水退去，妳的身體記住了這一層的深度。' })) };
      this.open(game, ev, done);
    },
    // the toll at each of the seven gates (Inanna): talk it down, see through it, or simply pay
    gate(game, ch, done) {
      const TOLL = { 2: '名字', 3: '歸途', 4: '聲音', 5: '重量', 6: '影子', 7: '記憶', 8: '生命' }, NUM = ['', '', '一', '二', '三', '四', '五', '六', '七'];
      const item = TOLL[ch] || '名字';
      const pay = (g) => { g.save.flags['gate_' + ch] = 'paid'; return `妳交出了${item}`; };
      const ev = { id: 'gate' + ch, art: 'door', title: `第${NUM[ch]}道門的守門人`,
        text: ch === 8 ? '最後一道門沒有守門人。只有一個聲音：「進來的人，要把命留下。」' : `門前的守門人伸出手，聲音像從很深的地方傳來：「要過這道門，交出妳的${item}。」`,
        opts: [
          { label: '說服祂少拿一點', attr: 'cha', dc: 13, ok: (g) => { g.save.flags['gate_' + ch] = 'half'; return O.bless()(g); }, okT: `祂看了妳很久，只取走了一半的${item}。剩下的那一半，在妳胸口發著光。`,
            no: (g) => { g.save.flags['gate_' + ch] = 'more'; return O.curse()(g); }, noT: `祂拿走的，比祂說的還多。` },
          { label: '看穿祂真正想要的', attr: 'wis', dc: 14, ok: (g) => { g.save.flags['gate_' + ch] = 'half'; return O.bless()(g); }, okT: '祂要的從來不是妳的東西，是妳回頭看一眼。妳沒有回頭。',
            no: (g) => { g.save.flags['gate_' + ch] = 'more'; return O.curse()(g); }, noT: '妳回頭了。' },
          { label: `交出${item}`, attr: null, pay: true },
        ] };
      // paying needs no roll
      ev.opts[2].leave = true;
      this.open(game, ev, () => { if (!game.save.flags['gate_' + ch]) { pay(game); G.UI.toast(`妳交出了${item}`, 'item'); } done && done(); });
    },
    // blessings and curses last until the next rest (Player.recalc reads these)
    apply(P) { if (P.evBless) P.dmgMul *= 1.15; if (P.evCurse) P.maxHp = Math.round(P.maxHp * 0.85); },
    rest(P) { P.evBless = false; P.evCurse = false; },
  };
})(window.G);

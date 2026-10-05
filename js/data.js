'use strict';
/* ECHOFALL — content: characters, bestiary, world lore, items, dialogue, quests, upgrades */
(function (G) {
  const D = G.DATA = {};

  D.speakers = {
    rinne: { name: '凜音', en: 'RINNE', color: '#7ff4ff' },
    ode: { name: '歐德', en: 'ODE', color: '#ffd28a' },
    talia: { name: '塔莉亞', en: 'TALIA', color: '#9cf7b0' },
    barrow: { name: '巴洛', en: 'BARROW', color: '#e8c9a0' },
    maestrina: { name: '瑪絲緹娜', en: 'MAESTRINA', color: '#ff5d86' },
    graves: { name: '葛雷夫', en: 'GRAVES', color: '#c9a2ff' },
    vega: { name: '艾蓮・薇格', en: 'ELAINE VEGA', color: '#ffffff' },
    sys: { name: '系統', en: 'SYSTEM', color: '#9aa4b5' },
  };

  /* ---------------- CODEX ---------------- */
  D.codex = {
    people: [
      {
        id: 'rinne', name: '凜音', en: 'RINNE — VESPER-07', portrait: 'rinne', always: true,
        tag: '主角｜第七降臨隊・晚禱 唯一倖存者',
        body: [
          '頌歌方舟第七降臨隊的「共鳴者」，代號晚禱七號。能將體內的生命振動壓縮為刃，以聲波之力斬斷寂裔的晶質軀殼。',
          '降臨作戰的第一夜，整支隊伍在灰港上空遭到伏擊。凜音醒來時，身邊只剩一具墜毀的降臨艙，與一架戰術無人機。',
          '她很少說話。不是因為冷漠。隊長曾說：「真正的共鳴者，會把聲音留給需要被聽見的東西。」',
          '武器：共鳴刃「止弦」。一把沒有護手的細長直刃，刃身內嵌六條共振弦，揮動時會發出極細的鳴響。',
        ],
      },
      {
        id: 'ode', name: '歐德', en: 'ODE — TACTICAL DRONE', portrait: 'ode', always: true,
        tag: '同伴｜戰術支援無人機 AI',
        body: [
          '第七降臨隊的隨隊戰術 AI，寄居於一具球型無人機。話不多，計算精確，從不出錯。',
          '它的記憶體中有一段加密分區，標籤只有兩個字：「隊長」。',
          '有時它會在一句話的中間停頓，停得太久，不像機器。',
        ],
      },
      {
        id: 'maestrina', name: '瑪絲緹娜', en: 'MAESTRINA — THE FIRST CONDUCTOR', portrait: 'maestrina', unlock: 'boss_seen',
        tag: '敵對｜寂裔之主・首席指揮',
        body: [
          '二十年前，第一降臨隊的隊長，人類史上第一位共鳴者。她在寂靜聖堂的最後一次通訊後失聯，被方舟正式宣告陣亡。',
          '她沒有死。她聽見了寂靜——一種比任何樂章都更完整的「無聲」。她相信，所有的痛苦都來自振動：心跳、哭泣、戰爭的號角。',
          '「只要萬物停止發聲，就不會再有人失去任何東西。」',
          '她手中的指揮刃「休止符」，能讓被斬中的一切在瞬間失去聲音。',
        ],
      },
      {
        id: 'talia', name: '塔莉亞', en: 'TALIA — BELFRY ENGINEER', portrait: 'talia', unlock: 'met_talia',
        tag: '盟友｜鐘樓聚落的機械師',
        body: [
          '地表倖存者聚落「鐘樓」的十七歲機械師。從未見過方舟，卻能靠一台手搖收音機修好任何共鳴碑。',
          '她透過碑文頻段替凜音調弦。說話很快，像是怕一停下來，頻段那頭就沒有人了。',
          '「方舟上的人……真的每天都有熱水可以洗澡嗎？」',
        ],
      },
      {
        id: 'barrow', name: '巴洛', en: 'BARROW — THE OLD BELL-KEEPER', portrait: 'barrow', unlock: 'met_barrow',
        tag: 'NPC｜沉鐘大道的守鐘人',
        body: [
          '在沉鐘大道共鳴碑旁獨自生活的老人。大寂靜降臨前，他是灰港大教堂的敲鐘人。',
          '他的女兒米菈在「靜默之夜」失蹤，只留下一只會唱歌的音樂盒——如今也不知去向。',
          '他每天都會敲一次那口已經裂開的鐘。「只要鐘還在響，她就找得到回家的路。」',
        ],
      },
      {
        id: 'graves', name: '葛雷夫', en: 'GRAVES — THE UNSTRUNG KNIGHT', portrait: 'graves', unlock: 'graves_seen',
        tag: '菁英敵人｜斷弦騎士',
        body: [
          '第一降臨隊的副隊長，瑪絲緹娜的劍。他沒有被寂靜同化——他是自願跟隨她走入沉默的。',
          '他的共鳴刃早已斷弦，卻仍以純粹的劍技守在灰港最高的屋頂上，阻擋任何試圖接近聖堂鐘塔的人。',
          '「我發過誓，要守護她的寂靜。哪怕那份寂靜，是我此生最大的錯誤。」',
        ],
      },
      {
        id: 'vega', name: '艾蓮・薇格', en: 'ELAINE VEGA', portrait: 'vega', unlock: 'ending',
        tag: '第七降臨隊隊長（陣亡）',
        body: [
          '凜音的隊長，也是將她從方舟孤兒院帶出來、教她握刀的人。在降臨伏擊中為掩護凜音的降臨艙而陣亡。',
          '在最後的三秒，她將自己的人格碎片上傳到了最近的終端——一架戰術無人機。',
          '「別回頭，凜音。往前走，替我把歌唱完。」',
        ],
      },
      {
        id: 'mira', name: '米菈', en: 'MIRA', portrait: null, unlock: 'note_mira',
        tag: '失蹤者｜巴洛的女兒',
        body: [
          '守鐘人巴洛的女兒，在大寂靜降臨的那晚失蹤。她喜歡爬上屋頂看夕陽，總把音樂盒帶在身邊。',
          '她的日記最後一頁寫著：「如果世界變安靜了，我就讓音樂盒替我唱。」',
        ],
      },
    ],
    hushborn: [
      {
        id: 'murmur', name: '囈蟲', en: 'MURMUR', portrait: 'murmur', unlock: 'seen_murmur',
        tag: '寂裔｜低階・群聚',
        body: [
          '最常見的寂裔。以碎裂的城市共鳴為食，像蟲群一樣在廢墟間竄動。背上的晶簇會隨著吸收的聲音發出微光。',
          '攻擊模式：蓄力後撲咬。白色閃光——可以格擋。',
          '弱點：撲咬落空後的硬直。',
        ],
      },
      {
        id: 'sentinel', name: '寂衛', en: 'HOLLOW SENTINEL', portrait: 'sentinel', unlock: 'seen_sentinel',
        tag: '寂裔｜中階・人型',
        body: [
          '被寂靜吞噬的方舟士兵所化成的守衛。右臂已與共鳴刃熔成一體，面具上只剩一道縱向的裂光。',
          '攻擊模式：二連斬（白光，可格擋）／突刺（紅光，無法格擋，必須閃避）。',
          '觀察：它們仍會擺出方舟劍術的起手式。某種程度上，它們還記得自己曾經是誰。',
        ],
      },
      {
        id: 'shrieker', name: '嘯者', en: 'SHRIEKER', portrait: 'shrieker', unlock: 'seen_shrieker',
        tag: '寂裔｜中階・遠程',
        body: [
          '漂浮於空中的水母狀寂裔，以環狀口器發射壓縮的聲波彈。',
          '技巧：在聲波彈命中前精準格擋，可以將它原路彈回。',
          '灰港的倖存者說，夜裡嘯者的鳴叫中，偶爾聽得出某個被吞下的名字。',
        ],
      },
      {
        id: 'graves_b', name: '斷弦騎士・葛雷夫', en: 'GRAVES, THE UNSTRUNG', portrait: 'graves', unlock: 'graves_seen',
        tag: '菁英｜選擇性頭目',
        body: [
          '盤踞在鐘塔屋頂的騎士。動作有明顯的方舟劍術痕跡，攻勢連綿且帶有大量假動作。',
          '他的紅光突刺之後，會接一記延遲的橫斬——不要太早反擊。',
        ],
      },
      {
        id: 'maestrina_b', name: '首席指揮・瑪絲緹娜', en: 'MAESTRINA', portrait: 'maestrina', unlock: 'boss_seen',
        tag: '頭目｜寂靜聖堂',
        body: [
          '第一樂章：斷奏連擊、延長記號彈幕、滑音俯衝。',
          '第二樂章：「安魂曲」——晶柱會依序從地面刺出。她的指揮會越來越快，請跟上她的節拍。',
          '提示：每一次完美格擋，都會敲響她的主題旋律中的一個音符。',
        ],
      },
    ],
    world: [
      {
        id: 'hush', name: '大寂靜', en: 'THE HUSH', always: true,
        body: [
          '2263 年，一種以「振動」為食的晶質生命從地殼深處的裂縫湧出。它們吞噬聲音、心跳與一切生命的共鳴，所到之處只剩絕對的無聲。',
          '三個月內，地表九成的城市陷入沉默。人類稱它們為「寂裔」，稱那場災難為「大寂靜」。',
        ],
      },
      {
        id: 'cantata', name: '頌歌方舟', en: 'THE CANTATA', always: true,
        body: [
          '人類最後的軌道方舟，載有四萬兩千名倖存者。透過斷裂的軌道電梯「頌歌之梯」與地表相連。',
          '方舟每隔五年派遣一支降臨隊回到地表，目標只有一個：找到大寂靜的源頭，並讓它重新發出聲音。',
        ],
      },
      {
        id: 'resonant', name: '共鳴者', en: 'RESONANT', always: true,
        body: [
          '經由「調律手術」改造的士兵，能感知並操控生命振動。寂裔對共鳴者的攻擊格外敏感——因為共鳴者，正是它們最渴望吞噬的「聲音」。',
          '手術的倖存率是 11%。',
        ],
      },
      {
        id: 'ashport', name: '灰港', en: 'ASHPORT', always: true,
        body: [
          '曾經擁有兩千萬人口的沿海巨型都市。如今被風沙、藤蔓與寂裔的晶簇覆蓋，傾倒的摩天樓像墓碑一樣排列在海岸線上。',
          '城市中央的灰港大教堂，被寂裔改造成了「寂靜聖堂」。',
        ],
      },
      {
        id: 'pylon', name: '共鳴碑', en: 'RESONANCE PYLON', always: true,
        body: [
          '大寂靜前用於城市廣播的共振塔。塔莉亞將其中幾座修復成了安全點。',
          '在碑前調諧可以恢復生命與調和劑，並以殘響碎片強化止弦。但調諧產生的共鳴，也會喚醒附近沉睡的寂裔。',
        ],
      },
      {
        id: 'shards', name: '殘響碎片', en: 'ECHO SHARDS', always: true,
        body: [
          '寂裔死亡時釋放的、被吞噬的聲音的殘骸。共鳴者可以吸收它們來強化自身。',
          '若共鳴者倒下，攜帶的碎片會散落在原地，形成一團「殘響」。回到那裡，就能把它們找回來——如果你在途中沒有再次倒下的話。',
        ],
      },
      {
        id: 'belfry', name: '鐘樓', en: 'THE BELFRY', unlock: 'met_talia',
        body: [
          '地表倖存者藏身的聚落，位於灰港北方的山區。以一口巨大的銅鐘為中心建成——寂裔討厭鐘聲。',
          '人口：三百一十二人。上週是三百一十四。',
        ],
      },
    ],
    items: [
      {
        id: 'stillstring', name: '共鳴刃「止弦」', en: 'STILLSTRING', always: true,
        body: ['凜音的武器。六弦共鳴刃，由方舟兵工廠第七號鍛造爐打造。每一次精準格擋都會讓刃弦共振，累積「共鳴」能量。'],
      },
      {
        id: 'tonic', name: '共鳴調和劑', en: 'RESONANCE TONIC', always: true,
        body: ['將生命振動重新調律的注射劑。使用後恢復大量生命值。於共鳴碑調諧時補充。'],
      },
      { id: 'hushbell', name: '靜默之鈴', en: 'HUSHBELL', unlock: 'relic_hushbell', relic: true, body: ['一只不會響的鈴。握著它時，世界似乎變慢了一點。', '遺物效果：完美格擋判定時間 +40ms。'] },
      { id: 'dawnstring', name: '破曉弦', en: 'DAWNSTRING', unlock: 'relic_dawnstring', relic: true, body: ['葛雷夫斷刃上僅存的一根弦。仍然記得黎明時的音高。', '遺物效果：攻擊時回復的「可回復生命」加倍。'] },
      { id: 'blessing', name: '守鐘人的祝福', en: "KEEPER'S BLESSING", unlock: 'relic_blessing', relic: true, body: ['巴洛用鐘上的銅屑為你打的護符。', '他每天敲一次那口裂開的鐘，只為讓一個人找得到回家的路。', '遺物效果：調和劑 +1，使用調和劑時額外獲得 25 共鳴。'] },
      { id: 'musicbox', name: '米菈的音樂盒', en: "MIRA'S MUSIC BOX", unlock: 'got_musicbox', body: ['一只小小的黃銅音樂盒。打開時，它仍在唱一首熟悉的旋律——和瑪絲緹娜的主題，一模一樣。'] },
    ],
    notes: [
      { id: 'n1', name: '戰術日誌 #0412', en: 'FIELD LOG — VEGA', body: ['【第七降臨隊・隊長 艾蓮・薇格】', '降臨窗口剩下四分鐘。凜音又在檢查她的刀了，那孩子緊張的時候就會這樣。', '如果這份日誌被誰讀到了，代表我們之中至少有人活了下來。那就夠了。', '——別回頭。往前走。'] },
      { id: 'n2', name: '灰港廣播站殘頁', en: 'ASHPORT BROADCAST', body: ['「……重複，這不是演習。請所有市民立即遠離地下鐵與排水系統。如果您聽見了『那個聲音』——不，如果您『聽不見』任何聲音，請立刻……」', '（剩下的部分被晶簇覆蓋，無法辨識。）'] },
      { id: 'n3', name: '米菈的日記', en: "MIRA'S DIARY", body: ['爸爸今天又去敲鐘了。他說鐘聲可以把壞東西趕走。', '我把音樂盒藏在鐘塔的屋頂上——那裡是全灰港最高、最接近夕陽的地方。', '如果世界變安靜了，我就讓音樂盒替我唱。'] },
      { id: 'n4', name: '第一降臨隊 最後通訊', en: 'FIRST DESCENT — FINAL TRANSMISSION', body: ['【瑪絲緹娜 → 頌歌方舟】', '我們找到源頭了。它不是怪物。它是……一首歌的「休止」。', '葛雷夫，帶隊員撤退。我要再聽一下。只要再一下。', '……好安靜。好美。'] },
      { id: 'n5', name: '聖堂銘文', en: 'CATHEDRAL INSCRIPTION', body: ['「在休止之中，萬物平等。', '　在休止之中，無人失去。', '　來吧，把你的心跳交給我，', '　我會替你保管它的寂靜。」'] },
      { id: 'n6', name: '葛雷夫的誓言', en: "GRAVES' OATH", body: ['我曾對方舟宣誓，要守護人類的聲音。', '後來，我對她宣誓，要守護她的寂靜。', '若有共鳴者讀到這裡——請替我斬斷這個誓言。我已經做不到了。'] },
    ],
  };

  /* ---------------- relics ---------------- */
  D.relics = {
    hushbell: { name: '靜默之鈴', desc: '完美格擋判定 +40ms' },
    dawnstring: { name: '破曉弦', desc: '攻擊回復的可回復生命 ×2' },
    blessing: { name: '守鐘人的祝福', desc: '調和劑 +1；使用時 +25 共鳴' },
  };

  /* ---------------- upgrades (Talia's remote tuning) ---------------- */
  D.upgrades = [
    { id: 'vit', name: '強韌諧波', en: 'VITALITY', max: 3, cost: [60, 130, 220], desc: '最大生命 +20' },
    { id: 'edge', name: '銳弦', en: 'EDGE', max: 3, cost: [60, 130, 220], desc: '攻擊力 +12%' },
    { id: 'tempo', name: '律動', en: 'TEMPO', max: 2, cost: [80, 160], desc: '最大耐力 +20' },
    { id: 'still', name: '靜心', en: 'STILLNESS', max: 2, cost: [90, 180], desc: '完美格擋判定 +25ms' },
    { id: 'echo', name: '回響', en: 'ECHO', max: 2, cost: [70, 150], desc: '共鳴獲取量 +30%' },
    { id: 'tonic', name: '調和', en: 'TONIC', max: 2, cost: [100, 200], desc: '調和劑攜帶量 +1' },
  ];

  /* ---------------- difficulty ---------------- */
  D.difficulty = {
    story: { name: '故事', en: 'STORY', dmg: 0.5, hp: 0.75, parry: 0.27, aggr: 0.7, desc: '專注於故事與探索。完美格擋判定寬鬆，敵人傷害減半。' },
    normal: { name: '標準', en: 'STANDARD', dmg: 1, hp: 1, parry: 0.17, aggr: 1, desc: '推薦。需要觀察、學習並回應敵人的節奏。' },
    master: { name: '大師', en: 'MAESTRO', dmg: 1.5, hp: 1.25, parry: 0.11, aggr: 1.3, desc: '致敬魂系的極限挑戰。一個錯誤的音符，就是終曲。' },
  };

  /* ---------------- tutorials (hint id -> text with {glyph}) ---------------- */
  D.hints = {
    // device-neutral wording: {action} renders as the key, gamepad button or on-screen button in use
    move: '{move} 移動　　{jump} 跳躍（空中再按一次可二段跳）',
    attack: '{light} 攻擊：連按打出連段，<b>按住</b> 蓄力重擊',
    guard: '{guard} 格擋 —— 在 <b class="w">白光</b> 攻擊命中前一瞬按下，就是 <b>完美格擋</b>',
    dodge: '{dodge} 閃避 —— <b class="r">紅光</b> 攻擊不能格擋，要閃開。剛好閃過會觸發 <b>殘響閃避</b>',
    rally: '格擋時損失的生命會變成 <b>可回復生命</b>（灰色），立刻反擊就能取回',
    execute: '敵人的 <b>失衡條</b> 滿了時，靠近按 {light} 攻擊就會自動 <b>處決</b>',
    skills: '{skill} 共鳴技：能量 1 格放「斷弦」突進斬，2 格放「終止式」震波　　{heal} 回復',
    pylon: '按 {interact} 在共鳴碑調諧：恢復、強化、裝備遺物。<br>注意：調諧會讓附近的寂裔復甦',
    note: '按 {interact} 閱讀',
    talk: '按 {interact} 交談',
    shards: '倒下時，殘響碎片會遺落在原地。回到該處即可取回',
    climb: '屋頂上似乎有路……',
  };

  /* ---------------- dialogue scripts ---------------- */
  D.intro = [
    { t: '2263 年，大地停止了歌唱。', s: 'IN 2263, THE WORLD STOPPED SINGING.' },
    { t: '自地底湧出的晶質之物，以聲音為食。\n九成的城市，從此沉默。', s: 'THE HUSHBORN DEVOURED THE SOUND OF NINE CITIES IN TEN.' },
    { t: '倖存者逃上軌道方舟「頌歌號」。\n每隔五年，便有一支降臨隊被投回地表。', s: 'EVERY FIVE YEARS, THE CANTATA SENDS A DESCENT SQUAD.' },
    { t: '二十四年後。\n第七降臨隊「晚禱」，墜落於灰港。', s: 'TWENTY-FOUR YEARS LATER. SQUAD VII — VESPER — IS AMBUSHED OVER ASHPORT.' },
    { t: '倖存者：一名。', s: 'SURVIVORS: ONE.' },
  ];

  D.dialog = {
    land: [
      { who: 'ode', text: '……凜音。還聽得見嗎。' },
      { who: 'rinne', text: '……嗯。' },
      { who: 'rinne', text: '隊長呢？' },
      { who: 'ode', text: '其他的訊號……都熄了。' },
      { who: 'rinne', text: '……那就往前走。' },
    ],
    firstEnemy: [
      { who: 'rinne', text: '……來了。' },
    ],
    sentinel: [
      { who: 'rinne', text: '……方舟的制服。它們曾經是人。' },
    ],
    pylon1: [
      { who: 'talia', text: '……喂？這個頻段，有人嗎？碑……亮了。' },
      { who: 'rinne', text: '方舟第七降臨隊，凜音。' },
      { who: 'talia', text: '方舟……真的是方舟的人。我是塔莉亞，在北邊的鐘樓。這座碑，是我修好的。' },
      { who: 'talia', text: '把刀靠近碑文。帶著殘響碎片來，我能替你調弦。' },
      { who: 'talia', text: '還有……調諧的聲音很大。睡著的東西，會醒。' },
    ],
    barrowMeet: [
      { who: 'barrow', text: '……鐘聲沒有騙我。真的有人來了。' },
      { who: 'barrow', text: '我叫巴洛。以前替大教堂敲鐘，如今只看守一口破鐘。' },
      { who: 'barrow', text: '我在等我女兒。靜默之夜，米菈沒有回來。' },
      { who: 'barrow', text: '她總帶著一只黃銅音樂盒……若你在城裡看見它，帶回來給我。我只想再聽一次那首歌。' },
    ],
    barrowWait: [
      { who: 'barrow', text: '米菈喜歡爬到高處看夕陽。鐘塔的屋頂……她說，那裡離天空最近。' },
    ],
    barrowDone: [
      { who: 'rinne', text: '……是這個嗎。' },
      { who: 'barrow', text: '……' },
      { who: 'barrow', text: '（發條轉動。一段旋律，在廢墟裡輕輕響起。）' },
      { who: 'barrow', text: '是她的……是米菈的。' },
      { who: 'barrow', text: '這首歌，是方舟來的一位大姊姊教她的。也是共鳴者，留著一頭黑色的長髮。' },
      { who: 'ode', text: '……這段旋律。和聖堂的訊號，是同一首。' },
      { who: 'barrow', text: '拿去吧，鐘上的銅屑打的。願鐘聲領你回家。' },
    ],
    barrowAfter: [
      { who: 'barrow', text: '我會繼續敲鐘。現在我知道了——她一直都在唱。' },
    ],
    rooftop: [
      { who: 'graves', text: '……方舟的共鳴者。又一個，來吵醒她的人。' },
      { who: 'graves', text: '第一降臨隊，葛雷夫。拔刀吧。讓我看看二十年後，方舟教出了什麼樣的劍。' },
    ],
    gravesDefeat: [
      { who: 'graves', text: '……好劍。比她當年……還好。' },
      { who: 'graves', text: '去吧。替我告訴她……我累了。' },
    ],
    cathedral: [
      { who: 'ode', text: '這裡……什麼都聽不見了。' },
      { who: 'rinne', text: '……有人在哼歌。' },
    ],
    bossIntro: [
      { who: 'maestrina', text: '……噓。' },
      { who: 'maestrina', text: '你的心跳好吵。像一首還沒寫完，就急著被演奏的曲子。' },
      { who: 'rinne', text: '瑪絲緹娜。第一降臨隊隊長。方舟說你死了。' },
      { who: 'maestrina', text: '在這裡，沒有什麼會死。也沒有什麼……會失去。' },
      { who: 'maestrina', text: '來。讓我替你，畫下休止符。' },
    ],
    bossDefeat: [
      { who: 'maestrina', text: '……啊。這個旋律……' },
      { who: 'maestrina', text: '你每一次格擋……都在彈我教給那孩子的歌。' },
      { who: 'maestrina', text: '原來……還有人……記得……' },
      { who: 'ode', text: '……加密分區，解開了。' },
      { who: 'vega', text: '凜音。聽到這段話，代表你走到了這裡。我就知道你可以。' },
      { who: 'vega', text: '別回頭。往前走——替我，把歌唱完。' },
      { who: 'rinne', text: '……隊長。' },
      { who: 'ode', text: '……方舟的頻段。沒有聲音了。' },
    ],
  };

  D.barks = {
    phase2: { who: 'maestrina', text: '第二樂章。安魂曲……為你而奏。' },
    gravesP: { who: 'graves', text: '還不夠……讓我聽見你的弦。' },
    lowhp: { who: 'ode', text: '……心跳，在變弱。' },
    execute: { who: 'ode', text: '……它站不穩了。' },
    shards: { who: 'ode', text: '……我們遺落的聲音，就在附近。' },
    noTonic: { who: 'ode', text: '……調和劑，沒有了。' },
    arena: { who: 'ode', text: '……被圍住了。' },
    clear: { who: 'ode', text: '……安靜了。' },
    lookHere: { who: 'ode', text: '……那裡，有光。' },
  };

  D.zones = [
    { x: -1e9, name: '灰港・墜落點', en: 'ASHPORT — THE CRASH SITE', tint: 0 },
    { x: 2850, name: '沉鐘大道', en: 'AVENUE OF SUNKEN BELLS', tint: 0.35 },
    { x: 6200, name: '寂靜聖堂', en: 'CATHEDRAL OF THE HUSH', tint: 1 },
  ];
})(window.G);

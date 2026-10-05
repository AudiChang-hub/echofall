'use strict';
/* ECHOFALL — content: characters, bestiary, world lore, items, dialogue, quests, upgrades */
(function (G) {
  const D = G.DATA = {};

  D.speakers = {
    rinne: { name: '巴里', en: 'BARI', color: '#7ff4ff' },
    ode: { name: '寧舒', en: 'NINSHU', color: '#ffd28a' },
    talia: { name: '妲莉', en: 'DALI', color: '#9cf7b0' },
    barrow: { name: '老鐸', en: 'OLD DOR', color: '#e8c9a0' },
    maestrina: { name: '瑪格', en: 'MARG', color: '#ff5d86' },
    graves: { name: '葛雷夫', en: 'GRAVES', color: '#c9a2ff' },
    vega: { name: '六公主', en: 'THE SIXTH PRINCESS', color: '#ffffff' },
    sys: { name: '旁白', en: 'NARRATOR', color: '#9aa4b5' },
  };

  /* ---------------- CODEX ---------------- */
  D.codex = {
    people: [
      {
        id: 'rinne', name: '巴里', en: 'BARI — THE CAST-AWAY', portrait: 'rinne', always: true,
        tag: '主角｜溫陀的第七位公主',
        body: [
          '溫陀國王歐古連的第七個女兒。出生那天，她被放進一只木箱，交給了海。',
          '木箱漂到冥界邊緣的棄兒之島。守燈的老夫婦把她撈起來，養到十八歲，從沒問過她從哪裡來。',
          '寂湧上島的那一年，兩位老人不再說話。她被送回溫陀，才知道自己有一個父親——他快死了，又死不了。',
          '她很少開口。島上的人說，在浪聲裡長大的孩子，聽得見別人聽不見的東西。',
        ],
      },
      {
        id: 'ode', name: '寧舒', en: 'NINSHU — THE LANTERN SPIRIT', portrait: 'ode', always: true,
        tag: '同伴｜魂燈裡的侍靈',
        body: [
          '寄身在一盞魂燈裡的侍靈。沒有人知道祂是從哪一盞燈裡醒來的，只知道祂發過誓，要陪她走到最底。',
          '她每一次倒下，都是寧舒把她從另一側領回來，放在最近的燈火旁。',
          '祂話很少。有時一句話說到一半就停住，停得太久，像是想起了另一個人。',
        ],
      },
      {
        id: 'maestrina', name: '瑪格', en: 'MARG — THE FUNERAL OFFICIANT', portrait: 'maestrina', unlock: 'boss_seen',
        tag: '敵對｜溫陀王家送葬司儀',
        body: [
          '溫陀王家世襲的送葬司儀。十八年前，御醫宣告國王撐不過當夜，她便領著送葬隊伍走出了王宮。',
          '國王沒有斷氣。隊伍也沒有停下。她說，葬禮一旦開始，就不能沒有結束。',
          '十八年來，她走在空著的靈柩前面，替一個還在呼吸的人，把同一篇悼詞唸了又唸。',
          '她手中的長杖「終儀」，是用來敲最後一聲喪鐘的。那一聲，她一直沒有等到。',
        ],
      },
      {
        id: 'talia', name: '妲莉', en: 'DALI — THE LAMPLIGHTER', portrait: 'talia', unlock: 'met_talia',
        tag: '盟友｜亡者之路的點燈人',
        body: [
          '替亡者的路點燈的女孩。她死的時候還很小，小到還來不及長高。',
          '十八年前冥界關門的那一夜，她在門外點燈，從此沒能回去。魂燈台亮著的地方，就找得到她。',
          '她會笑。在這個國家，這件事本身就很奇怪。',
          '「外面的花……長什麼樣子？」',
        ],
      },
      {
        id: 'barrow', name: '老鐸', en: 'OLD DOR — THE BELL-RINGER', portrait: 'barrow', unlock: 'met_barrow',
        tag: 'NPC｜王城的老敲鐘人',
        body: [
          '在送葬大道旁獨自生活的老人。他替王城大教堂敲了一輩子的鐘：生一個孩子，敲三下；走一個人，敲一下。',
          '十八年來，城裡沒有人出生，也沒有人真正死去。他的鐘，只剩一個用處。',
          '每天傍晚，他敲一下那口裂開的鐘。那是他女兒走的時辰。',
        ],
      },
      {
        id: 'graves', name: '葛雷夫', en: 'GRAVES — THE GRAVEDIGGER', portrait: 'graves', unlock: 'graves_seen',
        tag: '菁英敵人｜王城的掘墓人',
        body: [
          '王陵的掘墓人。國王病倒的那一夜，他奉命挖好了一座墳。',
          '國王沒有來。他就再挖一座，再一座。十八年，三千個坑，沒有一個填上。',
          '他守在鐘塔的屋頂上，因為那裡是全城唯一還沒被挖開的地方。',
        ],
      },
      {
        id: 'vega', name: '六公主', en: 'THE SIXTH PRINCESS', portrait: 'vega', unlock: 'ending',
        tag: '溫陀的第六位公主（殘影）',
        body: [
          '巴里的六姊。七姊妹之中，唯一一個曾經走下冥界的人。',
          '她在遺忘之庭忘了自己為什麼而來，從此留在那裡，一遍又一遍地走同一段路。',
          '陪她下去的那盞魂燈，後來自己回到了人間。',
        ],
      },
      {
        id: 'mira', name: '諾娜', en: 'NONA', portrait: null, unlock: 'note_mira',
        tag: '早夭者｜老鐸的女兒',
        body: [
          '老敲鐘人的女兒，七歲那年冬天病逝，在冥界關門以前。她喜歡爬上鐘塔的屋頂看海，總把音樂盒帶在身邊。',
          '出殯那天，音樂盒找不到了。父親替她敲了一下鐘，就再也沒有敲過別人的。',
        ],
      },
    ],
    hushborn: [
      {
        id: 'murmur', name: '囈蟲', en: 'MURMUR', portrait: 'murmur', unlock: 'seen_murmur',
        tag: '寂裔｜低階・群聚',
        body: [
          '最常見的寂裔。死了卻進不了門的人，在十八年裡一點一點縮小，最後只剩一團會爬的聲音。背上的晶簇，亮著它們吞下的別人的話。',
          '攻擊模式：蓄力後撲咬。白色閃光——可以格擋。',
          '弱點：撲咬落空後的硬直。',
        ],
      },
      {
        id: 'sentinel', name: '寂衛', en: 'HOLLOW SENTINEL', portrait: 'sentinel', unlock: 'seen_sentinel',
        tag: '寂裔｜中階・人型',
        body: [
          '溫陀的王城衛兵。死在崗位上，進不了門，只好繼續站崗。右臂已和佩劍長成一體，面盔裡只剩一道縱向的裂光。',
          '攻擊模式：二連斬（白光，可格擋）／突刺（紅光，無法格擋，必須閃避）。',
          '它們仍會擺出衛隊劍術的起手式。換崗的號令，十八年沒有響過。',
        ],
      },
      {
        id: 'shrieker', name: '嘯者', en: 'SHRIEKER', portrait: 'shrieker', unlock: 'seen_shrieker',
        tag: '寂裔｜中階・遠程',
        body: [
          '漂浮於空中的水母狀寂裔，以環狀口器發射壓縮的聲波彈。',
          '技巧：在聲波彈命中前精準格擋，可以將它原路彈回。',
          '王城的人說，夜裡嘯者的鳴叫中，偶爾聽得出某個人的名字。被叫到的人，從不回頭。',
        ],
      },
      {
        id: 'graves_b', name: '掘墓人・葛雷夫', en: 'GRAVES, THE GRAVEDIGGER', portrait: 'graves', unlock: 'graves_seen',
        tag: '菁英｜選擇性頭目',
        body: [
          '盤踞在鐘塔屋頂的掘墓人。動作沉而緩，攻勢連綿，帶有大量假動作。',
          '他的紅光突刺之後，會接一記延遲的橫斬——不要太早反擊。',
        ],
      },
      {
        id: 'maestrina_b', name: '送葬司儀・瑪格', en: 'MARG, THE FUNERAL OFFICIANT', portrait: 'maestrina', unlock: 'boss_seen',
        tag: '頭目｜待葬聖堂',
        body: [
          '第一段悼詞：斷奏連擊、長音彈幕、滑步俯衝。',
          '第二段悼詞：「安魂曲」——晶柱會依序從地面刺出。她的拍子會越來越快，跟上它。',
          '每一次完美格擋，都會敲響輓歌中的一個音。',
        ],
      },
    ],
    world: [
      {
        id: 'hush', name: '寂', en: 'THE STILLING', always: true,
        body: [
          '十八年前，冥界的門關上了。從那天起，死去的人進不去，只能留在人間，先失去聲音，再失去名字。人們稱他們為「寂裔」。',
          '人間從此沒有真正的死亡，也沒有新生。花不再開。產房裡，十八年沒有傳出過哭聲。',
        ],
      },
      {
        id: 'cantata', name: '溫陀', en: 'WENDO', always: true,
        body: [
          '北海的港口王國。國王歐古連有七個女兒，沒有兒子。',
          '第七個女兒出生那天，王命禁鐘。那天傍晚，有一只木箱從王港漂了出去。',
        ],
      },
      {
        id: 'resonant', name: '共鳴', en: 'RESONANCE', always: true,
        body: [
          '在冥界邊緣長大的人，耳朵會變得不一樣。浪聲裡有人說話，風裡有人在哭。',
          '巴里能讓這些聲音沿著刀刃震動。寂裔怕它，也渴望它——那正是它們失去的東西。',
        ],
      },
      {
        id: 'ashport', name: '溫陀王城', en: 'THE ROYAL CITY', always: true,
        body: [
          '曾經是北海最熱鬧的港城。如今每一條街都掛著喪幡，十八年沒有取下。',
          '城中央的王城大教堂成了「待葬聖堂」。送葬的隊伍在那裡繞行，等一個不肯斷氣的人。',
        ],
      },
      {
        id: 'pylon', name: '魂燈台', en: 'SOUL LANTERN', always: true,
        body: [
          '替亡者照路的燈台。從王城一路點進冥界最深處，每一盞，都是同一個女孩點亮的。',
          '在燈前歇息，能恢復生命與藥劑，並以殘響碎片磨利刀刃。但燈亮的時候，附近徘徊的寂裔也會醒來——它們一直在找光。',
        ],
      },
      {
        id: 'shards', name: '殘響碎片', en: 'ECHO SHARDS', always: true,
        body: [
          '亡者遺留的聲音碎片。寂裔倒下時會散落它們：一句沒說完的話，一聲來不及的道別。',
          '若妳倒下，攜帶的碎片會留在原地。回到那裡，就能把它們拾回——只要途中沒有再倒下。',
        ],
      },
      {
        id: 'belfry', name: '雪嶺', en: 'THE SNOW RIDGE', unlock: 'met_talia',
        body: [
          '溫陀北方的雪山。世世代代，亡者的棺木都是從這裡抬上山、送進門的。',
          '山腳的村子以一口大鐘為中心建成。鐘響一聲，就是有人進了門。十八年來，它沒有響過。',
        ],
      },
    ],
    items: [
      {
        id: 'stillstring', name: '細刃「止弦」', en: 'STILLSTRING', always: true,
        body: ['棄兒之島的守燈人留給她的刀。老人說，它是跟著木箱一起漂上岸的。刃身嵌著六條弦，揮動時會發出極細的鳴響。', '刀身上刻著一個她不認得的名字。是誰把它放進箱子的，老人到最後也沒有說。'],
      },
      {
        id: 'tonic', name: '共鳴調和劑', en: 'RESONANCE TONIC', always: true,
        body: ['燈油、海鹽與苦艾調成的藥。棄兒之島的老婦人說，喝下去，魂就會記起自己還有身體。', '使用後恢復大量生命值。於魂燈台歇息時補充。'],
      },
      { id: 'hushbell', name: '靜默之鈴', en: 'HUSHBELL', unlock: 'relic_hushbell', relic: true, body: ['一只拔掉了舌的喪鈴。送葬隊伍裡，走在最前面的人搖它。', '第三年，有人把鈴舌拔了。他說，至少別再吵醒王上。', '遺物效果：完美格擋判定時間 +40ms。'] },
      { id: 'dawnstring', name: '第一鏟土', en: 'THE FIRST SPADEFUL', unlock: 'relic_dawnstring', relic: true, body: ['葛雷夫替國王挖的第一個坑裡的土，裝在一只磨破的皮袋裡。', '十八年來，他一直沒有把它倒回去。', '遺物效果：攻擊時回復的「可回復生命」加倍。'] },
      { id: 'blessing', name: '敲鐘人的祝福', en: "THE RINGER'S BLESSING", unlock: 'relic_blessing', relic: true, body: ['老鐸用鐘上的銅屑為妳打的護符。', '他一輩子敲過的鐘，數得出這座城裡誰來過、誰走了。', '遺物效果：調和劑 +1，使用調和劑時額外獲得 25 共鳴。'] },
      { id: 'musicbox', name: '諾娜的音樂盒', en: "NONA'S MUSIC BOX", unlock: 'got_musicbox', body: ['一只小小的黃銅音樂盒。打開時，它唱的是溫陀的搖籃曲。', '只唱到一半，發條就鬆了。'] },
    ],
    notes: [
      { id: 'n1', name: '王港告示（殘片）', en: 'HARBOUR EDICT', body: ['【奉溫陀王歐古連之命】', '第七女，不予命名。', '著即裝箱，付之於海。王港諸鐘，是日禁鳴。', '（釘子已經鏽穿了紙。告示的下緣，有人用指甲刻了一朵花。）'] },
      { id: 'n2', name: '城門告示', en: 'NOTICE ON THE CITY GATE', body: ['「王上病篤。自即日起，全城服喪。送葬隊伍出宮，以俟升遐。」', '（告示上疊著一張又一張新紙，每一張只寫了一個數字。最上面那張，寫的是十八。）'] },
      { id: 'n3', name: '諾娜的日記', en: "NONA'S DIARY", body: ['爸爸今天敲了三下。有寶寶生出來了。', '我把音樂盒藏在鐘塔的屋頂上。那裡最高，看得見船回來。', '如果我睡著了，就讓音樂盒替我唱。'] },
      { id: 'n4', name: '送葬司儀的手札', en: "THE OFFICIANT'S JOURNAL", body: ['第一年。御醫說，撐不過今夜。我領隊出宮。', '第三年。悼詞唸完了。從頭再唸。', '第十一年。我不記得自己是從哪一天起不用呼吸的。不要緊。', '隊伍不能停。停下來，就沒有人送他了。'] },
      { id: 'n5', name: '聖堂銘文', en: 'CATHEDRAL INSCRIPTION', body: ['「生者，鳴鐘三響；', '　亡者，鳴鐘一響。', '　莫使亡者無歌，', '　莫使無歌之人，無門可入。」'] },
      { id: 'n6', name: '掘墓人的帳', en: "THE GRAVEDIGGER'S LEDGER", body: ['第一座：王上的。挖好了。王上沒有來。', '第二座：還是王上的。前一座積了雨水。', '第四百一十座：我的手沒有知覺了。挖得比較快。', '第三千零七座：給誰的，忘了。', '若有人讀到這裡——隨便挑一座躺下吧。總得有人用。'] },
    ],
  };

  /* ---------------- relics ---------------- */
  D.relics = {
    hushbell: { name: '靜默之鈴', desc: '完美格擋判定 +40ms' },
    dawnstring: { name: '第一鏟土', desc: '攻擊回復的可回復生命 ×2' },
    blessing: { name: '敲鐘人的祝福', desc: '調和劑 +1；使用時 +25 共鳴' },
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
    skills: '{skill} 共鳴技：能量滿 1 格放出職業戰技，2 格放出更強的技藝　　{heal} 回復',
    pylon: '按 {interact} 在魂燈台歇息：恢復、強化、裝備遺物。<br>注意：歇息會讓附近的寂裔復甦',
    note: '按 {interact} 閱讀',
    talk: '按 {interact} 交談',
    shards: '倒下時，殘響碎片會遺落在原地。回到該處即可取回',
    climb: '屋頂上似乎有路……',
  };

  /* ---------------- dialogue scripts ---------------- */
  D.intro = [
    { t: '溫陀國王，有七個女兒。', s: 'THE KING OF WENDO HAD SEVEN DAUGHTERS.' },
    { t: '第七個出生的那天，\n他把她放進木箱，交給了海。', s: 'ON THE DAY THE SEVENTH WAS BORN, HE GAVE HER TO THE SEA.' },
    { t: '十八年前，冥界關上了門。\n死者無處可去，人間不再有新生。', s: 'EIGHTEEN YEARS AGO, THE GATES OF THE DEAD WERE SHUT.' },
    { t: '國王病了。他會死，卻死不了。\n能救他的水，在冥界的最深處。', s: 'THE KING IS DYING, AND CANNOT DIE.' },
    { t: '五個女兒不肯去。一個去了，沒有回來。\n第七個，從海上回來了。', s: 'FIVE REFUSED. ONE WENT, AND DID NOT RETURN. THE SEVENTH CAME BACK FROM THE SEA.' },
  ];

  D.dialog = {
    land: [
      { who: 'ode', text: '……巴里。還聽得見嗎。' },
      { who: 'rinne', text: '……嗯。' },
      { who: 'rinne', text: '這裡是溫陀。' },
      { who: 'ode', text: '妳父親的城。十八年，沒有一口棺材闔上。' },
      { who: 'rinne', text: '……走吧。' },
    ],
    firstEnemy: [
      { who: 'rinne', text: '……來了。' },
    ],
    sentinel: [
      { who: 'rinne', text: '……王城的衛兵。死了，還在站崗。' },
    ],
    pylon1: [
      { who: 'talia', text: '……有人嗎？燈……亮了。' },
      { who: 'rinne', text: '巴里。從海上來的。' },
      { who: 'talia', text: '海上……那妳見過很多東西吧。我是妲莉，點燈的。這盞燈是我點的。' },
      { who: 'talia', text: '帶著碎片來，我能替妳把刀磨亮一點。那是死人留下的聲音，丟了可惜。' },
      { who: 'talia', text: '還有……燈亮的時候，睡著的東西會醒。別怪它們。它們只是怕黑。' },
    ],
    barrowMeet: [
      { who: 'barrow', text: '……有腳步聲。好久沒有人往這邊走了。' },
      { who: 'barrow', text: '我是老鐸。替大教堂敲了一輩子的鐘。生一個，敲三下；走一個，敲一下。' },
      { who: 'barrow', text: '十八年了，這城裡沒有生，也沒有走。我的鐘，只剩一個用處。' },
      { who: 'barrow', text: '我女兒諾娜，七歲那年冬天走的。她的音樂盒，出殯那天就找不到了。若妳看見……帶回來給我。我只想再聽一次。' },
    ],
    barrowWait: [
      { who: 'barrow', text: '諾娜喜歡爬到高處看海。鐘塔的屋頂……她說，在那裡看得見船回來。' },
    ],
    barrowDone: [
      { who: 'rinne', text: '……是這個嗎。' },
      { who: 'barrow', text: '……' },
      { who: 'barrow', text: '（發條轉動。一段旋律，在空蕩的大道上輕輕響起。）' },
      { who: 'barrow', text: '是她的……是諾娜的。' },
      { who: 'barrow', text: '溫陀人生下來，聽的是這首歌。下葬的時候，聽的也是這首。' },
      { who: 'barrow', text: '王上的女兒，我只有兩個沒敲過鐘。第一個生下來沒有哭。第七個……王上不准。' },
      { who: 'barrow', text: '拿去吧，鐘上的銅屑打的。願鐘聲替妳送行。' },
    ],
    barrowAfter: [
      { who: 'barrow', text: '我還是一天敲一下。……現在，她有歌陪了。' },
    ],
    rooftop: [
      { who: 'graves', text: '……又一個沒死的人。' },
      { who: 'graves', text: '十八年，我挖了三千個坑，一個也沒填上。……妳，要不要躺第一個。' },
    ],
    gravesDefeat: [
      { who: 'graves', text: '……也好。' },
      { who: 'graves', text: '最後一個坑……留給我自己。' },
    ],
    cathedral: [
      { who: 'ode', text: '……這裡，什麼都聽不見了。' },
      { who: 'rinne', text: '……有人在唸悼詞。' },
    ],
    bossIntro: [
      { who: 'maestrina', text: '……噓。' },
      { who: 'maestrina', text: '隊伍不可以停下。十八年了，一步也不可以。' },
      { who: 'rinne', text: '他還活著。' },
      { who: 'maestrina', text: '所以，葬禮才還沒有結束。' },
      { who: 'maestrina', text: '妳的心跳好吵。來……也替妳，唸一段。' },
    ],
    bossDefeat: [
      { who: 'maestrina', text: '……停下了。隊伍……停下了。' },
      { who: 'maestrina', text: '十八年……我一直以為，是在送王上。' },
      { who: 'maestrina', text: '原來……棺裡的……是我……' },
      { who: 'ode', text: '……她早就死了。只是，進不去。' },
      { who: 'rinne', text: '……門在哪裡。' },
      { who: 'ode', text: '山上。雪的盡頭。' },
    ],
  };

  D.barks = {
    phase2: { who: 'maestrina', text: '第二段悼詞。……這一段，是為妳唸的。' },
    gravesP: { who: 'graves', text: '還不夠深……' },
    lowhp: { who: 'ode', text: '……妳的燈，在變暗。' },
    execute: { who: 'ode', text: '……它站不穩了。' },
    shards: { who: 'ode', text: '……妳落下的聲音，就在附近。' },
    noTonic: { who: 'ode', text: '……藥，沒有了。' },
    arena: { who: 'ode', text: '……被圍住了。' },
    clear: { who: 'ode', text: '……安靜了。' },
    lookHere: { who: 'ode', text: '……那裡，有光。' },
  };

  D.zones = [
    { x: -1e9, name: '溫陀・舊王港', en: 'WENDO — THE OLD HARBOUR', tint: 0 },
    { x: 2850, name: '送葬大道', en: 'THE FUNERAL AVENUE', tint: 0.35 },
    { x: 6200, name: '待葬聖堂', en: 'CATHEDRAL OF THE UNBURIED', tint: 1 },
  ];
})(window.G);

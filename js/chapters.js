'use strict';
/* ECHOFALL — chapter registry + loader.
   A chapter supplies its level, palette, parallax art, music, dialogue/codex and optional hooks; loading one swaps
   all of that into the live game (G.LEVEL / G.PAL / G.BG / G.DATA) in place. See docs/CHAPTER_API.md. */
(function (G) {
  const U = G.U, L = G.LEVEL, D = G.DATA;
  const LEVEL_KEYS = ['start', 'bounds', 'solids', 'oneways', 'pylons', 'notes', 'items', 'npcs', 'triggers', 'encounters', 'zones', 'gravity'];
  // chapter 1 was authored directly into world.js / data.js — snapshot it so we can always come back
  const CH1_LEVEL = {}; for (const k of LEVEL_KEYS) if (L[k] !== undefined) CH1_LEVEL[k] = L[k];
  CH1_LEVEL.zones = D.zones; CH1_LEVEL.gravity = 1;
  const CH1_TINT = L.tintAt;
  const CH1_PAL = JSON.parse(JSON.stringify(G.PAL));
  const BASE_UP = D.upgrades.map((u) => ({ id: u.id, max: u.max, cost: u.cost.slice() }));

  const Ch = G.Chapters = {
    list: [], byId: {}, cur: null,
    register(def) {
      if (this.byId[def.id]) console.warn('chapter registered twice', def.id);
      this.byId[def.id] = def; this.list.push(def); this.list.sort((a, b) => a.id - b.id);
      // content merges into the shared tables (ids must be unique: prefix them c<N>_)
      const d = def.data || {};
      for (const k of ['dialog', 'barks', 'hints', 'speakers', 'relics']) if (d[k]) Object.assign(D[k], d[k]);
      if (d.codex) for (const k in d.codex) { D.codex[k] = D.codex[k] || []; for (const e of d.codex[k]) if (!D.codex[k].some((q) => q.id === e.id)) D.codex[k].push(e); }
      if (d.upgrades) for (const u of d.upgrades) if (!D.upgrades.some((q) => q.id === u.id)) D.upgrades.push(u);
      if (d.endings) D.endings = Object.assign(D.endings || {}, d.endings);
      if (def.tracks) for (const n in def.tracks) G.Music.define(n, def.tracks[n]);
      if (def.chords) Object.assign(G.Music.CH, def.chords);
      if (def.ambience) for (const z in def.ambience) G.Ambience.define(z, def.ambience[z]);
      if (def.sfx) for (const n in def.sfx) G.SFX[n] = def.sfx[n];
      return def;
    },
    get(id) { return this.byId[id] || null; },
    next(def) { const n = def.next !== undefined ? def.next : def.id + 1; return n == null ? null : this.byId[n] || null; },
    hook(name, ...args) { const h = this.cur && this.cur.hooks && this.cur.hooks[name]; return h ? h(...args) : undefined; },
    // music/ambience for a position: zone fields first, then the chapter's own resolver
    musicAt(x, y) {
      const c = this.cur; if (!c) return 'explore';
      if (c.musicAt) return c.musicAt(x, y);
      const z = L.zoneAt(x); return (z && z.music) || (c.music && c.music.explore) || 'explore';
    },
    ambienceAt(x, y) {
      const c = this.cur; if (!c) return 'city';
      if (c.ambienceAt) return c.ambienceAt(x, y);
      const z = L.zoneAt(x); return (z && z.amb) || 'city';
    },
    music(kind) { const m = this.cur && this.cur.music; return (m && m[kind]) || ({ boss: 'boss', boss2: 'boss2', elite: 'duel', rest: 'rest', explore: 'explore' })[kind]; },
    load(id) {
      const def = this.byId[id] || this.byId[1];
      this.cur = def;
      const lv = def.level || {};
      for (const k of LEVEL_KEYS) L[k] = lv[k] !== undefined ? lv[k] : (k === 'gravity' ? 1 : k === 'zones' ? [] : Array.isArray(CH1_LEVEL[k]) ? [] : k === 'encounters' ? {} : CH1_LEVEL[k]);
      for (const k of ['solids', 'oneways', 'pylons', 'notes', 'items', 'npcs', 'triggers']) if (!L[k]) L[k] = [];
      if (!L.encounters) L.encounters = {};
      L.tintAt = lv.tintAt || (() => 0);
      L.chapter = def.id; G.textFlip = 1;
      Object.assign(G.PAL, CH1_PAL, def.pal || {});
      // Talia's tuning grows with the journey: each chapter up to this one may raise upgrade caps
      // (def.upgradeBoost = { vit: [cost, ...], edge: [...] } appends levels)
      for (const b of BASE_UP) { const u = D.upgrades.find((q) => q.id === b.id); if (u) { u.max = b.max; u.cost = b.cost.slice(); } }
      for (const c of this.list) if (c.id <= def.id && c.upgradeBoost) for (const k in c.upgradeBoost) {
        const u = D.upgrades.find((q) => q.id === k); if (u) { u.cost = u.cost.concat(c.upgradeBoost[k]); u.max = u.cost.length; }
      }
      G.BG.rebuild(def);
      const g = G.game;
      if (g && g.baseS) G.BG.setScale(g.baseS);
      return def;
    },
  };

  // chapter 1: everything already lives in world.js / data.js / audio.js
  Ch.register({
    id: 1, key: 'ch1', num: 'I', numZh: '一', title: '墜落的音符', en: 'THE FALLEN NOTE',
    level: Object.assign({}, CH1_LEVEL, { tintAt: CH1_TINT }),
    pal: CH1_PAL,
    music: { explore: 'explore', boss: 'boss', boss2: 'boss2', elite: 'duel', rest: 'rest' },
    musicAt: (x) => (x >= 6200 ? 'cathedral' : 'explore'),
    ambienceAt: (x, y) => (y < -500 ? 'roof' : x >= 6200 ? 'cathedral' : 'city'),
    defaultBg: true,
    next: 2,
    // chapter 1 ends on Maestrina: the Ark falls silent — on to the Ladder
    hooks: {},
  });
})(window.G);

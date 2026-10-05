'use strict';
/* ECHOFALL — icon set: one consistent engraved-badge style for every attribute, class, ability, reward and pact.
   Each icon is drawn on a 48×48 grid with currentColor strokes (2px, round joins) and a few soft fills.
   G.Icons.svg(id, size?, color?) → inline <svg> markup;  G.Icons.badge(id, color) → icon inside a framed medallion. */
(function (G) {
  const I = {
    /* ---------------- six attributes ---------------- */
    str: '<path d="M14 30v-9a3 3 0 0 1 6 0v-3a3 3 0 0 1 6 0v1a3 3 0 0 1 6 0v2a3 3 0 0 1 6 0v9c0 7-5 12-12 12h-1c-6 0-11-5-11-12z"/><path d="M20 21v6M26 19v7M32 21v6"/><path d="M14 30c3-1 6 0 8 3"/>',
    dex: '<path d="M36 8C22 10 13 21 12 38"/><path d="M36 8c-1 10-7 19-17 24"/><path d="M36 8c-8 3-14 9-17 18"/><path d="M27 15l-6 2M30 21l-7 2M24 28l-5 1"/><path d="M12 38l-3 4"/>',
    con: '<path d="M24 40S9 31 9 20a8 8 0 0 1 15-4 8 8 0 0 1 15 4c0 11-15 20-15 20z"/><path d="M13 23h6l3-5 4 9 3-4h6"/>',
    int: '<path d="M8 12c6-2 11-1 16 3 5-4 10-5 16-3v25c-6-2-11-1-16 3-5-4-10-5-16-3z"/><path d="M24 15v25"/><path d="M12 19c3-1 6-1 8 1M12 25c3-1 6-1 8 1M28 20c2-2 5-2 8-1M28 26c2-2 5-2 8-1"/>',
    wis: '<path d="M5 24s7-11 19-11 19 11 19 11-7 11-19 11S5 24 5 24z"/><circle cx="24" cy="24" r="6"/><circle cx="24" cy="24" r="2" class="f"/><path d="M24 6v4M14 8l2 3M34 8l-2 3"/>',
    cha: '<path d="M10 12c9-3 19-3 28 0 0 13-5 23-14 26-9-3-14-13-14-26z"/><path d="M16 21c2-2 5-2 7 0M25 21c2-2 5-2 7 0"/><path d="M18 30c4 3 8 3 12 0"/>',

    /* ---------------- four classes ---------------- */
    fighter: '<path d="M24 4l3 6v22h-6V10z"/><path d="M15 32h18M24 32v8M21 44h6"/><path d="M10 10l6 6M38 10l-6 6"/>',
    rogue: '<path d="M12 36L30 10l3 2-15 27z"/><path d="M36 36L18 10l-3 2 15 27z"/><path d="M9 40l5-5M39 40l-5-5"/>',
    paladin: '<path d="M24 5l15 5v12c0 10-7 17-15 21-8-4-15-11-15-21V10z"/><path d="M24 13v21M17 21h14"/>',
    shaman: '<path d="M17 20a7 7 0 0 1 14 0v8l3 4H14l3-4z"/><path d="M24 13v-4M21 36a3 3 0 0 0 6 0"/><path d="M8 12c4 2 6 6 6 10M40 12c-4 2-6 6-6 10"/><path d="M6 20c2 1 4 3 4 6M42 20c-2 1-4 3-4 6"/>',

    /* ---------------- twenty abilities (調校) ---------------- */
    vit: '<path d="M24 40S9 31 9 20a8 8 0 0 1 15-4 8 8 0 0 1 15 4c0 11-15 20-15 20z"/><path d="M24 20v10M19 25h10"/>',
    edge: '<path d="M36 6L14 28l6 6L42 12z"/><path d="M14 28l-6 2 4 4-2 6 6-2 4 4 2-6"/>',
    tempo: '<path d="M16 8h16M16 40h16"/><path d="M18 8c0 9 12 9 12 16S18 31 18 40M30 8c0 9-12 9-12 16s12 7 12 16"/><path d="M21 36h6" class="t"/>',
    still: '<path d="M24 8c6 8 10 14 10 19a10 10 0 0 1-20 0c0-5 4-11 10-19z"/><path d="M6 40c4-2 8-2 12 0s8 2 12 0 8-2 12 0"/>',
    echo: '<circle cx="14" cy="24" r="3" class="f"/><path d="M21 16a11 11 0 0 1 0 16M27 11a18 18 0 0 1 0 26M33 6a25 25 0 0 1 0 36"/>',
    tonic: '<path d="M19 6h10M21 6v9l-9 15a8 8 0 0 0 7 12h10a8 8 0 0 0 7-12l-9-15V6"/><path d="M15 30h18" class="t"/>',
    absorb: '<path d="M24 38S11 30 11 21a7 7 0 0 1 13-3 7 7 0 0 1 13 3c0 9-13 17-13 17z"/><path d="M24 4v8M20 9l4 4 4-4"/>',
    backstab: '<path d="M10 38L30 18M30 18l4-8 4 4-8 4z"/><path d="M10 38l-3 3"/><circle cx="34" cy="34" r="6"/><path d="M31 31l6 6"/>',
    swift: '<path d="M10 34h14l6-12 8 3"/><path d="M14 28c4-2 8-3 12-2"/><path d="M6 22h8M4 28h7M8 40h10"/>',
    riposte: '<path d="M8 40L32 16M32 16l4-8 4 4-8 4"/><path d="M40 40L16 16M16 16l-4-8-4 4 8 4"/><path d="M24 34v8M20 38l4 4 4-4"/>',
    surge: '<path d="M4 30c5-8 9-8 13 0s8 8 13 0 9-8 14 0"/><path d="M4 20c5-8 9-8 13 0s8 8 13 0 9-8 14 0"/>',
    concentrate: '<path d="M19 6h10M21 6v9l-9 15a8 8 0 0 0 7 12h10a8 8 0 0 0 7-12l-9-15V6"/><path d="M24 26l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" class="f"/>',
    defy: '<path d="M24 6c3 6 9 8 9 16a9 9 0 0 1-18 0c0-4 2-6 4-8 0 4 2 6 4 6-2-5 0-10 1-14z"/><path d="M14 40h20M18 35l-4 5M30 35l4 5"/>',
    endure: '<path d="M24 6v20"/><path d="M24 14c-5-2-9 0-10 4M24 12c5-3 9-1 11 3"/><path d="M24 26c-3 4-8 6-12 12M24 26c3 4 8 6 12 12M24 26v14M18 34l-4 6M30 34l4 6"/>',
    fortune: '<path d="M14 10h20l7 9-17 22L7 19z"/><path d="M7 19h34M18 10l-4 9 10 22 10-22-4-9"/>',
    magnet: '<path d="M12 8v16a12 12 0 0 0 24 0V8h-7v16a5 5 0 0 1-10 0V8z"/><path d="M12 14h7M29 14h7"/><path d="M40 34l4 2M8 34l-4 2M24 42v4"/>',
    shadow: '<circle cx="30" cy="10" r="4"/><path d="M30 14l-4 12 6 6v10M26 26l-8 4M30 18l8 4"/><path d="M6 20h8M4 27h9M8 34h7"/>',
    clarity: '<path d="M5 24s7-11 19-11 19 11 19 11-7 11-19 11S5 24 5 24z"/><path d="M24 18l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" class="f"/>',
    chorus: '<path d="M12 34V12l12-4v22M24 30V10l12-4v22"/><circle cx="9" cy="34" r="3" class="f"/><circle cx="21" cy="30" r="3" class="f"/><circle cx="33" cy="28" r="3" class="f"/>',
    luck: '<path d="M24 22c-3-6-11-6-11 0 0 4 6 5 11 0zM24 22c6-3 6-11 0-11-4 0-5 6 0 11zM24 22c3 6 11 6 11 0 0-4-6-5-11 0zM24 22c-6 3-6 11 0 11 4 0 5-6 0-11z"/><path d="M24 33c0 5 2 8 6 10"/>',

    /* ---------------- rewards, pact, misc ---------------- */
    shards: '<path d="M24 4l7 12-7 12-7-12z" class="f"/><path d="M12 22l5 9-5 9-5-9zM36 22l5 9-5 9-5-9z"/>',
    stone: '<path d="M14 10h16l8 10-6 18H14L8 22z"/><path d="M14 10l4 12h12l8-2M18 22l-4 16M30 22l2 16"/>',
    gear: '<path d="M36 6L14 28l6 6L42 12z"/><path d="M14 28l-6 2 4 4-2 6 6-2 4 4 2-6"/>',
    heal: '<path d="M19 6h10M21 6v9l-9 15a8 8 0 0 0 7 12h10a8 8 0 0 0 7-12l-9-15V6"/><path d="M24 26v10M19 31h10"/>',
    boon: '<path d="M24 4l5 15 15 5-15 5-5 15-5-15-15-5 15-5z"/>',
    fruit: '<path d="M24 14c-8-4-16 2-14 12 2 9 9 14 14 12 5 2 12-3 14-12 2-10-6-16-14-12z"/><path d="M24 14c0-4 2-7 6-9M24 14c-2-3-5-4-8-3"/>',
    exit: '<path d="M10 42V12a14 14 0 0 1 28 0v30"/><path d="M24 32V18M18 24l6-6 6 6"/>',
    chest: '<path d="M8 20h32v20H8zM8 20c0-8 7-12 16-12s16 4 16 12"/><path d="M8 28h32M22 26h4v6h-4z"/>',
    pact_hp: '<path d="M24 5l15 5v12c0 10-7 17-15 21-8-4-15-11-15-21V10z"/><path d="M24 15v16M16 23h16"/>',
    pact_dmg: '<path d="M10 38L30 18M30 18l4-8 4 4-8 4z"/><path d="M10 38l-3 3M28 32l6 6M32 28l6 6"/>',
    pact_horde: '<circle cx="14" cy="16" r="5"/><circle cx="34" cy="16" r="5"/><circle cx="24" cy="12" r="5"/><path d="M6 38c0-8 4-12 8-12s8 4 8 12M26 38c0-8 4-12 8-12s8 4 8 12M16 34c0-8 4-12 8-12s8 4 8 12"/>',
    pact_haste: '<path d="M26 4L12 28h12l-4 16 16-26H24z"/>',
    pact_tonic: '<path d="M19 6h10M21 6v9l-9 15a8 8 0 0 0 7 12h10a8 8 0 0 0 7-12l-9-15V6"/><path d="M10 10l28 32"/>',
    pact_frail: '<path d="M24 40S9 31 9 20a8 8 0 0 1 15-4 8 8 0 0 1 15 4c0 11-15 20-15 20z"/><path d="M24 16l-4 8 6 4-4 8"/>',
    d20: '<path d="M24 4l17 10v20L24 44 7 34V14z"/><path d="M24 4l-9 16h18zM15 20L7 34M33 20l8 14M15 20l9 24 9-24"/>',
  };
  const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const style = '<style>.f{fill:currentColor;fill-opacity:.85}.t{stroke-opacity:.55}</style>';

  G.Icons = {
    has: (id) => !!I[id],
    svg(id, size = 28, color) {
      const body = I[id] || I.boon;
      return `<svg class="ico" viewBox="0 0 48 48" width="${size}" height="${size}" ${STROKE}${color ? ` style="color:${color}"` : ''} aria-hidden="true">${style}${body}</svg>`;
    },
    // the icon framed in a small engraved medallion (CSS: .ico-badge)
    badge(id, color, size = 40) {
      return `<span class="ico-badge" style="--ic:${color || 'var(--cyan)'};width:${size}px;height:${size}px">${this.svg(id, Math.round(size * 0.62))}</span>`;
    },
    // canvas use (doors, world sprites): draws the icon centred at x,y
    draw(ctx, id, x, y, size, color) {
      const key = id + size + color;
      const C = this._cache || (this._cache = {});
      let img = C[key];
      if (!img) {
        img = C[key] = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size * 2}" height="${size * 2}" ${STROKE.replace(/currentColor/g, color)}><style>.f{fill:${color};fill-opacity:.85}.t{stroke-opacity:.55}</style>${I[id] || I.boon}</svg>`);
      }
      if (img.complete && img.naturalWidth) ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
      return img.complete;
    },
  };
})(window.G);

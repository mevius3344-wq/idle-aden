/* 道具圖示入口 — 委派 ITEM_ART 獨立素材 */
window.ICONS = (() => {
  function of(id, def) {
    if (window.ITEM_ART) return ITEM_ART.of(id, def);
    const rarity = (def && def.rarity) || "common";
    return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="24" height="24" rx="4" fill="#2a2018" stroke="#8a7350"/></svg>`;
  }

  return { of, RARITY: (window.ITEM_ART && ITEM_ART.RARITY) || {} };
})();

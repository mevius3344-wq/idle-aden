/* 角色／魔物／道具：華麗 SVG（不再 probe PNG） */
window.ASSETS = (() => {
  const ok = new Set();
  const fail = new Set();

  const url = {
    hero: (cls, g) => `assets/heroes/${cls}_${g === "f" ? "f" : "m"}.png`,
    mob: (id) => `assets/mobs/${id}.png`,
    item: (id) => `assets/items/${id}.png`,
  };

  function probe(src, box) {
    if (ok.has(src)) {
      box.innerHTML = `<img class="game-asset" src="${src}" alt="" draggable="false">`;
      box.classList.add("has-asset");
      return;
    }
    if (fail.has(src)) return;
    const img = new Image();
    img.className = "game-asset";
    img.alt = "";
    img.draggable = false;
    img.onload = () => {
      ok.add(src);
      box.innerHTML = "";
      box.appendChild(img);
      box.classList.add("has-asset");
    };
    img.onerror = () => fail.add(src);
    img.src = src;
  }

  function wrap(src, fb, cls = "") {
    const uid = `ax-${Math.random().toString(36).slice(2, 9)}`;
    return `<span class="asset-box ${cls}" id="${uid}" data-src="${src}">${fb}</span>`;
  }

  function hydrate(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(".asset-box[data-src]").forEach((box) => {
      if (box.classList.contains("has-asset")) return;
      probe(box.dataset.src, box);
    });
  }

  function hero(cls, gender) {
    const c = cls || "knight";
    const g = gender === "f" ? "f" : "m";
    const svg = window.PIXEL ? PIXEL.hero(c, g) : "";
    return `<div class="hero-lin hero-wuxia">${svg}</div>`;
  }

  function mob(id) {
    const svg = (window.PIXEL ? PIXEL.mob(id) : "") || (window.SPRITES ? SPRITES.mob(id) : "");
    return `<div class="mob-svg mob-wuxia">${svg}</div>`;
  }

  function item(id, def) {
    const svg = window.ITEM_ART ? ITEM_ART.of(id, def) : (window.ICONS ? ICONS.of(id, def) : "");
    const r = (def && def.rarity) || "common";
    return `<span class="ico-svg item-wuxia r-${r}">${svg}</span>`;
  }

  return { url, hero, mob, item, hydrate, ok, fail };
})();

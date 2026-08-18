/* Midjourney / 外部 PNG 素材：放 assets/ 下對應檔名即自動取代像素 fallback */
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
    const src = url.hero(c, g);
    let fb = "";
    if (window.PIXEL) fb = `<div class="hero-pixel">${PIXEL.hero(c, g)}</div>`;
    return wrap(src, fb, "hero-asset");
  }

  function mob(id) {
    const src = url.mob(id);
    const svg = window.PIXEL ? PIXEL.mob(id) : (window.SPRITES ? SPRITES.mob(id) : "");
    return wrap(src, `<div class="mob-svg">${svg}</div>`, "mob-asset");
  }

  function item(id, def) {
    const src = url.item(id);
    const svg = window.ICONS ? ICONS.of(id, def) : "";
    return wrap(src, `<span class="ico-svg r-${(def && def.rarity) || "common"}">${svg}</span>`, "item-asset");
  }

  return { url, hero, mob, item, hydrate, ok, fail };
})();

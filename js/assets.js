/* 外部 PNG：有檔才覆蓋；沒有就用 CSS 人物 / SVG 怪物 / SVG 道具 */
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
    const fb = window.PIXEL
      ? `<div class="hero-lin">${PIXEL.hero(c, g)}</div>`
      : "";
    return wrap(src, fb, "hero-asset");
  }

  const mobFile = {
    orc_arch: "orc", orc_f: "orc", gandi: "orc",
    kobold: "goblin", hobgob: "goblin",
    gnoll: "wolf", wolfman: "wolf", lycan: "wolf",
    skel_a: "skeleton", sparto: "skeleton", lich: "skeleton", zombie: "skeleton",
    ancient: "drake", lindvior: "drake", fafurion: "drake", antharas: "drake",
    balrog: "deathk", demon: "deathk",
  };

  function mob(id) {
    const src = url.mob(mobFile[id] || id);
    const svg = (window.PIXEL ? PIXEL.mob(id) : "") || (window.SPRITES ? SPRITES.mob(id) : "");
    return wrap(src, `<div class="mob-svg">${svg}</div>`, "mob-asset");
  }

  function item(id, def) {
    const src = url.item(id);
    const svg = window.ICONS ? ICONS.of(id, def) : "";
    return wrap(src, `<span class="ico-svg r-${(def && def.rarity) || "common"}">${svg}</span>`, "item-asset");
  }

  return { url, hero, mob, item, hydrate, ok, fail };
})();

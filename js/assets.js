/* 純 PNG 素材：角色 / 魔物 / 道具 / 技能圖（無 CSS 分層、無 SVG） */
window.ASSETS = (() => {
  const ok = new Set();
  const fail = new Set();

  const url = {
    hero: (cls, g) => `assets/heroes/${cls}_${g === "f" ? "f" : "m"}.png`,
    mob: (file) => `assets/mobs/${file}.png`,
    item: (id) => `assets/items/${id}.png`,
    skill: (sid) => `assets/skills/${sid}.png`,
  };

  const mobFile = {
    kobold: "goblin", hobgob: "goblin",
    orc_arch: "orc", orc_f: "orc", gandi: "orc",
    gnoll: "wolf", wolfman: "wolf", lycan: "wolf",
    skel_a: "skeleton", sparto: "skeleton", lich: "skeleton", zombie: "skeleton",
    ancient: "drake", lindvior: "drake", fafurion: "drake", antharas: "drake",
    balrog: "deathk", demon: "deathk",
    harpy: "floating", unicorn: "rabbit",
    black_elder: "skeleton", valakas: "wolf",
  };

  const mobFallback = "goblin";

  const itemEmoji = {
    weapon: "⚔", armor: "🛡", helm: "⛑", shield: "🔰", cloak: "🧥",
    gloves: "🧤", boots: "👢", amulet: "📿", ring: "💍", belt: "🎗",
    potion: "🧪", scroll: "📜", mat: "🪨", misc: "📦",
  };

  function showImg(box, src) {
    box.innerHTML = `<img class="game-asset" src="${src}" alt="" draggable="false">`;
    box.classList.add("has-asset");
  }

  function probeOne(src, box, fb = "") {
    if (ok.has(src)) {
      showImg(box, src);
      return;
    }
    if (fail.has(src)) {
      if (fb) box.innerHTML = fb;
      return;
    }
    const img = new Image();
    img.className = "game-asset";
    img.alt = "";
    img.draggable = false;
    img.onload = () => {
      ok.add(src);
      showImg(box, src);
    };
    img.onerror = () => {
      fail.add(src);
      if (fb) box.innerHTML = fb;
    };
    img.src = src;
  }

  function probeChain(box, sources, finalFb = "") {
    if (box.classList.contains("has-asset")) return;
    let i = 0;
    const next = () => {
      if (box.classList.contains("has-asset")) return;
      if (i >= sources.length) {
        if (finalFb) box.innerHTML = finalFb;
        return;
      }
      const src = sources[i++];
      if (ok.has(src)) {
        showImg(box, src);
        return;
      }
      if (fail.has(src)) {
        next();
        return;
      }
      const img = new Image();
      img.className = "game-asset";
      img.alt = "";
      img.draggable = false;
      img.onload = () => {
        ok.add(src);
        showImg(box, src);
      };
      img.onerror = () => {
        fail.add(src);
        next();
      };
      img.src = src;
    };
    next();
  }

  function wrap(src, fb, cls = "") {
    return `<span class="asset-box ${cls}" data-src="${src}">${fb}</span>`;
  }

  function hydrate(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(".asset-box[data-src]").forEach((box) => {
      if (box.classList.contains("has-asset")) return;
      if (box.classList.contains("mob-asset") && box.dataset.fallback) {
        probeChain(box, [box.dataset.src, box.dataset.fallback], `<span class="asset-fallback mob-fallback">👾</span>`);
        return;
      }
      probeOne(box.dataset.src, box, box.innerHTML);
    });
  }

  function hero(cls, gender) {
    const c = cls || "knight";
    const g = gender === "f" ? "f" : "m";
    return wrap(url.hero(c, g), "", "hero-asset");
  }

  function mob(id) {
    const primary = url.mob(mobFile[id] || id);
    const fb = url.mob(mobFallback);
    return `<span class="asset-box mob-asset" data-src="${primary}" data-fallback="${fb}"></span>`;
  }

  function itemFallback(def) {
    const slot = (def && (def.slot || def.type)) || "misc";
    const em = itemEmoji[slot] || itemEmoji.misc;
    const r = (def && def.rarity) || "common";
    return `<span class="asset-fallback ico-fallback r-${r}">${em}</span>`;
  }

  function item(id, def) {
    return wrap(url.item(id), itemFallback(def), `item-asset r-${(def && def.rarity) || "common"}`);
  }

  function skillFallback(sid) {
    const s = window.DATA && DATA.skills && DATA.skills[sid];
    return `<span class="asset-fallback sk-fallback">${(s && s.icon) || "✦"}</span>`;
  }

  function skill(sid) {
    return wrap(url.skill(sid), skillFallback(sid), "skill-asset");
  }

  return { url, hero, mob, item, skill, hydrate, ok, fail, mobFile };
})();

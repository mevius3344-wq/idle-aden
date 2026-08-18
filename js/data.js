/* 放置亞丁 — 天堂亞丁 2.70 世界資料（原創放置玩法） */
window.DATA = (() => {
  const gameVersion = "亞丁 2.70";
  const R = {
    common: { id: "common", name: "普通", color: "#d8c8a0" },
    uncommon: { id: "uncommon", name: "高級", color: "#9be37d" },
    rare: { id: "rare", name: "稀有", color: "#7ec8ff" },
    epic: { id: "epic", name: "史詩", color: "#c9a0ff" },
    legend: { id: "legend", name: "傳說", color: "#ffd24a" },
  };

  const classes = {
    knight: {
      id: "knight",
      name: "騎士",
      desc: "近戰坦克，高生命與防禦，擅長持續輸出。",
      base: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 12 },
      hp: 16,
      mp: 3,
      atk: 1.15,
      skills: ["bounce", "stun", "reduction", "solid", "smash", "counter"],
    },
    elf: {
      id: "elf",
      name: "妖精",
      desc: "遠程弓箭手。一般共用魔法與精靈共用魔法可學；火／水／風／地屬性魔法請於 Lv.10 找精靈導師四選一。",
      base: { str: 11, dex: 16, con: 12, int: 12, wis: 12, cha: 10 },
      hp: 12,
      mp: 8,
      atk: 1.0,
      skills: [
        "triple",
        "light", "heal", "shield", "lightarrow", "windblade", "icearrow", "holyweapon",
        "firarrow", "holywalk", "extraheal", "magbar", "slow", "greaterheal", "haste", "elfire",
        "resist", "mindswap", "purify", "worldtree", "elemdef", "bodyswap", "singleres", "dispel",
        "erase", "weaken", "summon", "mirror", "strongsummon", "seal",
        "fireweapon", "firedance", "fireblade", "fireattr", "firesoul", "energyboost",
        "waterele", "lifefount", "waterprot", "waterbless", "pollute",
        "windwalk", "windshot", "stormeye", "storm", "precise", "windbind",
        "earthprot", "earthsnare", "earthwall", "earthguard", "steelprot", "vigor",
      ],
    },
    mage: {
      id: "mage",
      name: "法師",
      desc: "遠距魔法，魔力深厚；與妖精共用治癒、加速等魔法。",
      base: { str: 8, dex: 10, con: 10, int: 16, wis: 16, cha: 8 },
      hp: 9,
      mp: 14,
      atk: 0.72,
      skills: [
        "ebolt", "light", "heal", "shield", "icedagger", "holywalk", "magbar", "extraheal", "resist",
        "fireball", "slow", "haste", "icelance", "greaterheal", "lightning", "blizzard", "fullheal", "meteor",
      ],
    },
  };

  const skillTrees = {
    knight: "騎士技能",
    elf: "妖精技能",
    shared: "一般共用魔法",
    spirit: "精靈共用魔法",
    fire: "精靈魔法 · 火",
    water: "精靈魔法 · 水",
    wind: "精靈魔法 · 風",
    earth: "精靈魔法 · 地",
    mage: "法師魔法",
  };

  const elfElements = ["fire", "water", "wind", "earth"];
  const elfElemNames = { fire: "火", water: "水", wind: "風", earth: "地" };

  const skills = {
    bounce: { id: "bounce", name: "反擊", mp: 6, cd: 5, desc: "近戰反擊，造成 160% 物理傷害", kind: "phys", mul: 1.6, minLv: 1, icon: "⚔", tree: "knight" },
    stun: { id: "stun", name: "衝擊之暈", mp: 18, cd: 14, desc: "傷害 120%，暈眩 2 秒", kind: "phys", mul: 1.2, stun: 2, minLv: 12, icon: "💫", tree: "knight" },
    reduction: { id: "reduction", name: "增幅防禦", mp: 16, cd: 22, desc: "20 秒減傷 32%，AC 暫時變差", kind: "buff", reduce: 0.32, ac: 6, dur: 20, minLv: 16, icon: "🛡", tree: "knight" },
    solid: { id: "solid", name: "堅固防護", mp: 20, cd: 24, desc: "18 秒 AC-8，減傷 12%", kind: "buff", ac: -8, reduce: 0.12, dur: 18, minLv: 24, icon: "🔰", tree: "knight" },
    smash: { id: "smash", name: "粉碎性衝擊", mp: 22, cd: 10, desc: "造成 220% 物理傷害", kind: "phys", mul: 2.2, minLv: 28, icon: "💥", tree: "knight" },
    counter: { id: "counter", name: "反擊屏障", mp: 28, cd: 28, desc: "8 秒大幅減傷 48%", kind: "buff", reduce: 0.48, dur: 8, minLv: 36, icon: "✨", tree: "knight" },

    triple: { id: "triple", name: "三重矢", mp: 10, cd: 5, desc: "3 級精靈魔法：極快射出三箭各 85%（需裝備弓）", kind: "phys", mul: 0.85, hits: 3, minLv: 30, icon: "🏹", tree: "elf", requiresBow: true },

    light: { id: "light", name: "日光術", mp: 4, cd: 20, dur: 40, desc: "40 秒命中 +8", kind: "buff", hit: 8, minLv: 4, icon: "☀", tree: "shared", tag: "light" },
    heal: { id: "heal", name: "初級治癒術", mp: 12, cd: 8, desc: "回復 22% 最大生命", kind: "heal", pct: 0.22, below: 0.72, minLv: 8, icon: "💚", tree: "shared" },
    shield: { id: "shield", name: "保護罩", mp: 10, cd: 22, dur: 32, desc: "32 秒 AC-6", kind: "buff", ac: -6, minLv: 8, icon: "🛡", tree: "shared", tag: "armor" },
    lightarrow: { id: "lightarrow", name: "光箭", mp: 4, cd: 2.4, desc: "1 級魔法：壓縮魔法能量造成傷害 120%", kind: "magic", mul: 1.2, minLv: 8, icon: "✴", tree: "shared" },
    windblade: { id: "windblade", name: "風刃", mp: 6, cd: 3, desc: "1 級魔法：風之力高壓利刃 135%", kind: "magic", mul: 1.35, minLv: 8, minLvBy: { mage: 8, elf: 8 }, icon: "🌪", tree: "shared" },
    icearrow: { id: "icearrow", name: "冰箭", mp: 6, cd: 3.5, desc: "1 級魔法：凍氣短劍 140%，略緩速", kind: "magic", mul: 1.4, slow: 0.85, minLv: 8, minLvBy: { mage: 4, elf: 8 }, icon: "❄", tree: "shared" },
    holyweapon: { id: "holyweapon", name: "神聖武器", mp: 10, cd: 24, dur: 28, desc: "1 級魔法：28 秒對不死系傷害 +25%", kind: "buff", dmgMul: 1.25, minLv: 8, icon: "✨", tree: "shared", tag: "holywpn" },
    firarrow: { id: "firarrow", name: "火箭", mp: 10, cd: 4, desc: "2 級魔法：火形魔法箭 160%", kind: "magic", mul: 1.6, minLv: 16, icon: "🔥", tree: "shared" },
    extraheal: { id: "extraheal", name: "中級治癒術", mp: 22, cd: 10, desc: "回復 40% 最大生命", kind: "heal", pct: 0.4, below: 0.55, minLv: 24, minLvBy: { mage: 16, elf: 24 }, icon: "💚", tree: "shared" },
    holywalk: { id: "holywalk", name: "神聖疾走", mp: 12, cd: 22, dur: 20, desc: "20 秒輕微加快攻速", kind: "buff", haste: 0.86, minLv: 16, minLvBy: { mage: 12, elf: 16 }, icon: "✨", tree: "shared", tag: "move" },
    magbar: { id: "magbar", name: "魔法屏障", mp: 14, cd: 22, dur: 18, desc: "18 秒減傷 18%，MR+12", kind: "buff", reduce: 0.18, mr: 12, minLv: 32, minLvBy: { mage: 8, elf: 32 }, icon: "🔷", tree: "shared", tag: "barrier" },
    slow: { id: "slow", name: "緩速術", mp: 14, cd: 10, desc: "魔法傷害 120%，目標攻速變慢", kind: "magic", mul: 1.2, slow: 0.7, minLv: 32, minLvBy: { mage: 16, elf: 32 }, icon: "🕸", tree: "shared" },
    haste: { id: "haste", name: "加速術", mp: 20, cd: 24, dur: 22, desc: "22 秒大幅加快攻速", kind: "buff", haste: 0.72, minLv: 48, minLvBy: { mage: 20, elf: 48 }, icon: "⚡", tree: "shared", tag: "haste" },
    greaterheal: { id: "greaterheal", name: "高級治癒術", mp: 32, cd: 12, desc: "回復 58% 最大生命", kind: "heal", pct: 0.58, below: 0.42, minLv: 40, minLvBy: { mage: 24, elf: 40 }, icon: "💚", tree: "shared" },
    fullheal: { id: "fullheal", name: "完全治癒術", mp: 48, cd: 16, desc: "回復全部生命", kind: "heal", pct: 1, below: 0.28, minLv: 40, icon: "💚", tree: "shared" },
    ebolt: { id: "ebolt", name: "能量箭", mp: 4, cd: 2.4, desc: "魔法傷害 150%", kind: "magic", mul: 1.5, minLv: 1, icon: "✴", tree: "shared" },
    elfire: { id: "elfire", name: "烈炎術", mp: 28, cd: 12, desc: "對全體造成火屬性傷害 185%", kind: "magic", mul: 1.85, aoe: true, minLv: 48, minLvBy: { mage: 28, elf: 48 }, icon: "🌋", tree: "shared" },

    resist: { id: "resist", name: "魔法防禦", mp: 16, cd: 24, dur: 24, desc: "1 級精靈魔法：24 秒 MR+22（+10% 抗魔）", kind: "buff", mr: 22, minLv: 10, minLvBy: { mage: 12, elf: 10 }, icon: "🔮", tree: "spirit", tag: "resist" },
    mindswap: { id: "mindswap", name: "心靈轉換", mp: 4, cd: 10, desc: "1 級精靈魔法：消耗 5% 生命，回復 12% 魔力", kind: "mpheal", mpPct: 0.12, hpCost: 0.05, minLv: 10, icon: "💫", tree: "spirit" },
    purify: { id: "purify", name: "淨化精神", mp: 14, cd: 28, dur: 30, desc: "2 級精靈魔法：30 秒精神 +3，MR+10", kind: "buff", mr: 10, wis: 3, minLv: 20, icon: "🍃", tree: "spirit", tag: "purify" },
    worldtree: { id: "worldtree", name: "世界樹的呼喚", mp: 18, cd: 30, dur: 20, desc: "2 級精靈魔法：20 秒持續回復生命（周圍同伴）", kind: "buff", regen: 8, minLv: 20, icon: "🌳", tree: "spirit", tag: "worldtree" },
    elemdef: { id: "elemdef", name: "屬性防禦", mp: 16, cd: 28, dur: 28, desc: "2 級精靈魔法：28 秒四屬性 MR+15", kind: "buff", mr: 15, minLv: 20, icon: "🔮", tree: "spirit", tag: "elemdef" },
    bodyswap: { id: "bodyswap", name: "魂體轉換", mp: 10, cd: 18, desc: "3 級精靈魔法：消耗 12% 生命，回復 35% 魔力", kind: "mpheal", mpPct: 0.35, hpCost: 0.12, minLv: 30, icon: "💫", tree: "spirit" },
    singleres: { id: "singleres", name: "單屬性防禦", mp: 18, cd: 30, dur: 30, desc: "3 級精靈魔法：30 秒所選屬性 MR+35", kind: "buff", mr: 35, minLv: 30, icon: "🔮", tree: "spirit", tag: "singleres" },
    dispel: { id: "dispel", name: "釋放元素", mp: 14, cd: 16, desc: "3 級精靈魔法：解除召喚／迷魅（魔法傷害 110%）", kind: "magic", mul: 1.1, minLv: 30, icon: "✨", tree: "spirit" },
    erase: { id: "erase", name: "魔法消除", mp: 20, cd: 12, desc: "4 級精靈魔法：魔法傷害 140%，降低目標 MR", kind: "magic", mul: 1.4, minLv: 40, icon: "✨", tree: "spirit" },
    weaken: { id: "weaken", name: "弱化屬性", mp: 18, cd: 16, dur: 20, desc: "4 級精靈魔法：20 秒降低目標同屬性 MR", kind: "magic", mul: 1.1, slow: 0.75, minLv: 40, icon: "🕸", tree: "spirit" },
    summon: { id: "summon", name: "召喚屬性精靈", mp: 22, cd: 36, dur: 30, desc: "4 級精靈魔法：30 秒依屬性強化（MR+12、傷害 +10%）", kind: "buff", mr: 12, dmgMul: 1.1, minLv: 40, icon: "🔮", tree: "spirit", tag: "summon" },
    mirror: { id: "mirror", name: "鏡反射", mp: 24, cd: 40, dur: 18, desc: "5 級精靈魔法：18 秒有機率反射魔法（減傷 35%）", kind: "buff", reduce: 0.35, mr: 15, minLv: 50, icon: "🔮", tree: "spirit", tag: "mirror" },
    strongsummon: { id: "strongsummon", name: "召喚強力屬性精靈", mp: 28, cd: 48, dur: 36, desc: "5 級精靈魔法：36 秒強化屬性精靈（MR+20、傷害 +18%）", kind: "buff", mr: 20, dmgMul: 1.18, minLv: 50, icon: "🔮", tree: "spirit", tag: "strongsummon" },
    seal: { id: "seal", name: "封印禁地", mp: 32, cd: 60, desc: "5 級精靈魔法：全體魔法傷害 150%，大幅減慢攻速", kind: "magic", mul: 1.5, aoe: true, slow: 0.5, minLv: 50, icon: "🕸", tree: "spirit" },

    fireweapon: { id: "fireweapon", name: "火焰武器", mp: 16, cd: 24, dur: 24, desc: "3 級火魔法：24 秒近戰／遠程物理傷害 +18%", kind: "buff", dmgMul: 1.18, minLv: 30, icon: "🔥", tree: "fire", tag: "weapon" },
    firedance: { id: "firedance", name: "舞躍之火", mp: 18, cd: 28, dur: 22, desc: "4 級火魔法：22 秒二段加速（攻速＋移動）", kind: "buff", haste: 0.78, minLv: 40, icon: "🔥", tree: "fire", tag: "firedance" },
    fireblade: { id: "fireblade", name: "烈炎武器", mp: 22, cd: 30, dur: 26, desc: "5 級火魔法：26 秒物理傷害 +28%、命中 +10", kind: "buff", dmgMul: 1.28, hit: 10, minLv: 50, icon: "🔥", tree: "fire", tag: "fireblade" },
    fireattr: { id: "fireattr", name: "屬性之火", mp: 20, cd: 26, dur: 24, desc: "5 級火魔法：24 秒物理傷害 +25%（有機率 1.5 倍）", kind: "buff", dmgMul: 1.25, minLv: 50, icon: "🔥", tree: "fire", tag: "fireattr" },
    firesoul: { id: "firesoul", name: "烈焰之魂", mp: 24, cd: 32, dur: 24, desc: "5 級火魔法：24 秒近戰武器攻擊力最大化（+35%）", kind: "buff", dmgMul: 1.35, minLv: 50, icon: "🔥", tree: "fire", tag: "firesoul" },
    energyboost: { id: "energyboost", name: "能量激發", mp: 20, cd: 28, dur: 30, desc: "5 級火魔法：30 秒負重下仍可回復 HP／MP", kind: "buff", regen: 5, mpRegen: 3, minLv: 50, icon: "🔥", tree: "fire", tag: "energyboost" },

    waterele: { id: "waterele", name: "水之元氣", mp: 16, cd: 24, dur: 24, desc: "3 級水魔法：24 秒首次治癒術效果 +30%", kind: "buff", healBoost: 0.3, minLv: 30, icon: "💧", tree: "water", tag: "waterele" },
    lifefount: { id: "lifefount", name: "生命之泉", mp: 18, cd: 28, dur: 28, desc: "4 級水魔法：28 秒持續回復生命", kind: "buff", regen: 10, minLv: 40, icon: "🌊", tree: "water", tag: "lifefount" },
    waterprot: { id: "waterprot", name: "水之防護", mp: 16, cd: 24, dur: 24, desc: "4 級水魔法：24 秒迴避 +8", kind: "buff", er: 8, minLv: 40, icon: "💧", tree: "water", tag: "waterdef" },
    waterbless: { id: "waterbless", name: "生命的祝福", mp: 28, cd: 20, desc: "5 級水魔法：回復 65% 最大生命", kind: "heal", pct: 0.65, below: 0.5, minLv: 50, icon: "🌊", tree: "water" },
    pollute: { id: "pollute", name: "汙濁之水", mp: 20, cd: 10, desc: "5 級水魔法：水傷 200%，目標治癒效果減半", kind: "magic", mul: 2.0, slow: 0.6, minLv: 50, icon: "💧", tree: "water" },

    windwalk: { id: "windwalk", name: "風之疾走", mp: 14, cd: 22, dur: 22, desc: "3 級風魔法：22 秒移動加速、迴避 +6", kind: "buff", haste: 0.92, er: 6, minLv: 30, icon: "🌪", tree: "wind", tag: "wind" },
    windshot: { id: "windshot", name: "風之神射", mp: 18, cd: 24, dur: 24, desc: "3 級風魔法：24 秒遠程命中 +14、傷害 +12%", kind: "buff", hit: 14, dmgMul: 1.12, minLv: 30, icon: "🌬", tree: "wind", tag: "windshot" },
    stormeye: { id: "stormeye", name: "暴風之眼", mp: 20, cd: 28, dur: 26, desc: "4 級風魔法：26 秒遠程命中 +18", kind: "buff", hit: 18, minLv: 40, icon: "🌬", tree: "wind", tag: "stormeye" },
    storm: { id: "storm", name: "暴風神射", mp: 32, cd: 14, desc: "5 級風魔法：全體 160% 遠程傷害", kind: "phys", mul: 1.6, aoe: true, minLv: 50, icon: "🌀", tree: "wind", requiresBow: true },
    precise: { id: "precise", name: "精準射擊", mp: 18, cd: 20, dur: 22, desc: "5 級風魔法：22 秒命中 +20（無視迴避）", kind: "buff", hit: 20, minLv: 50, icon: "🌬", tree: "wind", tag: "precise" },
    windbind: { id: "windbind", name: "風之枷鎖", mp: 18, cd: 12, desc: "5 級風魔法：180% 傷害，降低攻速", kind: "magic", mul: 1.8, slow: 0.65, minLv: 50, icon: "🌪", tree: "wind" },

    earthprot: { id: "earthprot", name: "大地防護", mp: 16, cd: 24, dur: 28, desc: "3 級地魔法：28 秒 AC-8", kind: "buff", ac: -8, minLv: 30, icon: "🪨", tree: "earth", tag: "earthprot" },
    earthsnare: { id: "earthsnare", name: "地面障礙", mp: 14, cd: 10, desc: "3 級地魔法：130% 傷害，大幅緩速", kind: "magic", mul: 1.3, slow: 0.55, minLv: 30, icon: "🪨", tree: "earth" },
    earthwall: { id: "earthwall", name: "大地屏障", mp: 22, cd: 36, dur: 8, desc: "4 級地魔法：8 秒大幅減傷 55%", kind: "buff", reduce: 0.55, minLv: 40, icon: "🪨", tree: "earth", tag: "earthwall" },
    earthguard: { id: "earthguard", name: "大地的護衛", mp: 18, cd: 28, dur: 24, desc: "4 級地魔法：24 秒減傷 12%", kind: "buff", reduce: 0.12, minLv: 40, icon: "🪨", tree: "earth", tag: "earthguard" },
    steelprot: { id: "steelprot", name: "鋼鐵防護", mp: 22, cd: 30, dur: 28, desc: "5 級地魔法：28 秒 AC-12", kind: "buff", ac: -12, minLv: 50, icon: "🪨", tree: "earth", tag: "steelprot" },
    vigor: { id: "vigor", name: "體能激發", mp: 18, cd: 28, dur: 30, desc: "5 級地魔法：30 秒負重下仍可回復 HP／MP", kind: "buff", regen: 6, mpRegen: 4, minLv: 50, icon: "🪨", tree: "earth", tag: "vigor" },

    icedagger: { id: "icedagger", name: "冰箭", mp: 8, cd: 5, desc: "魔法傷害 180%，緩速", kind: "magic", mul: 1.8, slow: 0.45, minLv: 4, icon: "❄", tree: "mage" },
    fireball: { id: "fireball", name: "火球術", mp: 16, cd: 8, desc: "全體魔法傷害 210%", kind: "magic", mul: 2.1, aoe: true, minLv: 12, icon: "🔥", tree: "mage" },
    icelance: { id: "icelance", name: "冰錐", mp: 20, cd: 9, desc: "魔法傷害 260%，短暫暈眩", kind: "magic", mul: 2.6, stun: 0.8, minLv: 16, icon: "🧊", tree: "mage" },
    lightning: { id: "lightning", name: "極道落雷", mp: 28, cd: 11, desc: "魔法傷害 320%", kind: "magic", mul: 3.2, minLv: 22, icon: "⚡", tree: "mage" },
    blizzard: { id: "blizzard", name: "冰雪暴", mp: 36, cd: 14, desc: "全體魔法傷害 200%，緩速", kind: "magic", mul: 2.0, aoe: true, slow: 0.5, minLv: 28, icon: "🌨", tree: "mage" },
    meteor: { id: "meteor", name: "流星雨", mp: 48, cd: 18, desc: "全體魔法傷害 420%", kind: "magic", mul: 4.2, aoe: true, minLv: 40, icon: "☄", tree: "mage" },
  };

  const slots = [
    ["weapon", "武器"],
    ["helm", "頭盔"],
    ["armor", "盔甲"],
    ["shield", "盾牌"],
    ["cloak", "斗篷"],
    ["gloves", "手套"],
    ["boots", "靴子"],
    ["amulet", "項鍊"],
    ["ring1", "戒指①"],
    ["ring2", "戒指②"],
    ["belt", "腰帶"],
  ];

  /** @type {Record<string, any>} */
  const items = {};
  const addItem = (it) => {
    items[it.id] = it;
    return it;
  };

  const w = (id, name, rarity, lv, dmin, dmax, extra = {}) =>
    addItem({
      id, name, rarity, lv, type: "weapon", slot: "weapon",
      dmin, dmax, hit: extra.hit || 4, spd: extra.spd || 0,
      price: extra.price || lv * 40 + dmax * 8, weight: extra.weight || 12,
      classes: extra.classes || ["knight", "elf", "mage"],
      ac: 0, mr: 0, str: extra.str || 0, dex: extra.dex || 0, int: extra.int || 0,
      ranged: !!extra.ranged,
    });
  const a = (id, name, rarity, lv, slot, ac, extra = {}) =>
    addItem({
      id, name, rarity, lv, type: "armor", slot, ac, mr: extra.mr || 0,
      price: extra.price || lv * 35 + Math.abs(ac) * 20, weight: extra.weight || 8,
      classes: extra.classes || ["knight", "elf", "mage"],
      hp: extra.hp || 0, mp: extra.mp || 0, str: extra.str || 0, dex: extra.dex || 0,
      dmin: 0, dmax: 0,
    });
  const acc = (id, name, rarity, lv, slot, extra = {}) =>
    addItem({
      id, name, rarity, lv, type: "acc", slot, ac: extra.ac || 0, mr: extra.mr || 0,
      price: extra.price || lv * 50 + 80, weight: 2,
      classes: ["knight", "elf", "mage"],
      hp: extra.hp || 0, mp: extra.mp || 0, str: extra.str || 0, dex: extra.dex || 0, int: extra.int || 0,
      dmin: 0, dmax: 0,
    });
  const use = (id, name, rarity, kind, extra = {}) =>
    addItem({
      id, name, rarity, lv: 1, type: "use", slot: null, kind,
      price: extra.price || 20, weight: 1, stack: true,
      hp: extra.hp || 0, mp: extra.mp || 0, healPct: extra.healPct || 0,
      scroll: extra.scroll || null,
    });
  const mat = (id, name, rarity, extra = {}) =>
    addItem({
      id, name, rarity, lv: 1, type: "mat", slot: null, kind: "material",
      price: extra.price || 8, weight: 1, stack: true,
    });

  w("club", "木棒", "common", 1, 2, 5, { price: 8, classes: ["knight", "elf", "mage"] });
  w("ssword", "短劍", "common", 1, 3, 8, { spd: 40, classes: ["knight", "elf"] });
  w("odagger", "歐西斯匕首", "common", 1, 3, 7, { spd: 45, hit: 2, classes: ["knight", "elf"] });
  w("bsword", "闊劍", "common", 5, 6, 14, { classes: ["knight"] });
  w("scimitar", "彎刀", "uncommon", 10, 10, 20, { spd: 30, classes: ["knight", "elf"] });
  w("katana", "武士刀", "rare", 20, 18, 32, { hit: 8, spd: 20, classes: ["knight", "elf"] });
  w("claymore", "雙手劍", "rare", 28, 28, 48, { hit: 6, spd: -40, classes: ["knight"] });
  w("dsword", "死亡之劍", "epic", 40, 40, 68, { hit: 12, str: 3, classes: ["knight"] });
  w("excal", "聖輝長劍", "legend", 52, 58, 92, { hit: 16, str: 5, classes: ["knight"] });
  w("bow", "弓", "common", 1, 3, 7, { spd: 50, classes: ["elf"], ranged: true });
  w("obow", "歐西斯弓", "common", 3, 4, 9, { spd: 48, hit: 4, classes: ["elf"], ranged: true });
  w("lbow", "長弓", "uncommon", 12, 9, 18, { spd: 40, hit: 10, classes: ["elf"], ranged: true });
  w("xbow", "十字弓", "rare", 22, 16, 28, { hit: 14, classes: ["elf"], ranged: true });
  w("elvenbow", "精靈弓", "epic", 38, 32, 54, { hit: 18, dex: 4, classes: ["elf"], ranged: true });
  w("moonbow", "月華之弓", "legend", 50, 50, 84, { hit: 22, dex: 6, classes: ["elf"], ranged: true });
  w("wand", "魔法杖", "common", 1, 1, 4, { classes: ["mage"], int: 1 });
  w("staff", "橡木魔法杖", "uncommon", 10, 2, 8, { classes: ["mage"], int: 2 });
  w("crystal", "水晶魔杖", "rare", 24, 4, 12, { classes: ["mage"], int: 4 });
  w("archstaff", "大法師之杖", "epic", 40, 8, 18, { classes: ["mage"], int: 7 });
  w("starstaff", "星辰權杖", "legend", 52, 12, 24, { classes: ["mage"], int: 10 });
  w("osword", "歐西斯短劍", "common", 3, 4, 10, { hit: 3, classes: ["knight", "elf"] });
  w("lsword", "長劍", "uncommon", 8, 8, 16, { hit: 6, classes: ["knight"] });
  w("axe", "戰斧", "uncommon", 12, 12, 22, { hit: 4, spd: -20, classes: ["knight"] });
  w("spear", "矛", "uncommon", 10, 7, 18, { hit: 5, classes: ["knight", "elf"] });

  a("oring", "歐西斯環甲", "common", 5, "armor", -5, { classes: ["knight", "elf"] });
  a("ochain", "歐西斯鏈甲", "uncommon", 8, "armor", -6, { classes: ["knight", "elf"] });
  a("bronze", "青銅盔甲", "uncommon", 14, "armor", -9, { classes: ["knight"] });
  a("cap", "布帽", "common", 1, "helm", -1);
  a("ohelm", "歐西斯頭盔", "common", 4, "helm", -3, { classes: ["knight", "elf"] });
  a("lhelm", "皮頭盔", "common", 6, "helm", -2);
  a("ihelm", "鋼盔", "uncommon", 16, "helm", -4, { classes: ["knight"] });
  a("dhelm", "龍鱗頭盔", "rare", 32, "helm", -7, { mr: 8 });
  a("cloth", "布衣", "common", 1, "armor", -2, { classes: ["mage", "elf", "knight"] });
  a("leather", "皮盔甲", "common", 1, "armor", -4);
  a("ringmail", "環甲", "uncommon", 12, "armor", -7, { classes: ["knight", "elf"] });
  a("scale", "鱗甲", "rare", 22, "armor", -11, { classes: ["knight"] });
  a("plate", "金屬盔甲", "rare", 32, "armor", -15, { classes: ["knight"] });
  a("crystalarm", "結晶盔甲", "epic", 42, "armor", -18, { mr: 12, classes: ["knight"] });
  a("elvenchain", "精靈鏈甲", "epic", 36, "armor", -12, { dex: 3, classes: ["elf"] });
  a("robe", "法師長袍", "uncommon", 8, "armor", -3, { mp: 20, classes: ["mage"] });
  a("archrobe", "大法師袍", "epic", 38, "armor", -6, { mp: 80, int: 4, classes: ["mage"] });
  a("buckler", "小圓盾", "common", 3, "shield", -2, { classes: ["knight"] });
  a("kite", "大盾牌", "uncommon", 14, "shield", -5, { classes: ["knight"] });
  a("tower", "塔盾", "rare", 28, "shield", -9, { classes: ["knight"] });
  a("cloak1", "旅行斗篷", "common", 2, "cloak", -1);
  a("ocloak", "歐西斯斗篷", "uncommon", 10, "cloak", -2, { classes: ["knight", "elf"] });
  a("cloak2", "抗魔法斗篷", "rare", 24, "cloak", -2, { mr: 10 });
  a("gloves1", "皮手套", "common", 3, "gloves", -1);
  a("gloves2", "力量手套", "rare", 26, "gloves", -2, { str: 2 });
  a("boots1", "皮靴", "common", 3, "boots", -1);
  a("boots2", "疾風靴", "rare", 26, "boots", -2, { dex: 2 });

  acc("amu1", "體質項鍊", "uncommon", 10, "amulet", { hp: 30 });
  acc("amu2", "智慧項鍊", "rare", 22, "amulet", { mp: 40, mr: 6 });
  acc("amu3", "太初項鍊", "legend", 45, "amulet", { hp: 80, mp: 50, ac: -2 });
  acc("ring_mr", "抗魔戒指", "rare", 18, "ring1", { mr: 8 });
  acc("ring_str", "力量戒指", "uncommon", 12, "ring1", { str: 2 });
  acc("ring_dex", "敏捷戒指", "uncommon", 12, "ring1", { dex: 2 });
  acc("ring_imm", "不朽戒指", "epic", 36, "ring1", { hp: 60, mr: 12 });
  acc("belt1", "皮革腰帶", "common", 8, "belt", { hp: 15 });
  acc("belt2", "靈魂腰帶", "epic", 34, "belt", { mp: 40, hp: 40 });

  use("red", "治癒藥水", "common", "potion", { hp: 25, price: 12 });
  use("orange", "強效治癒藥水", "uncommon", "potion", { hp: 80, price: 45 });
  use("clear", "白色藥水", "rare", "potion", { hp: 200, price: 180 });
  use("blue", "藍色藥水", "common", "potion", { mp: 20, price: 15 });
  use("wisdom", "慎重藥水", "uncommon", "potion", { mp: 80, price: 60 });
  use("haste_pot", "自我加速藥水", "uncommon", "potion", { hp: 15, price: 55, desc: "暫時加快攻速（戰鬥外使用無效果）。" });
  use("scroll_w", "對武器施法的卷軸", "rare", "scroll", { scroll: "weapon", price: 800, desc: "武卷：對武器強化，+0～+6 安定。" });
  use("scroll_a", "對防具施法的卷軸", "rare", "scroll", { scroll: "armor", price: 700, desc: "防卷：對防具／飾品強化，+0～+6 安定。" });
  use("scroll_b", "祝福的對武器施法的卷軸", "epic", "scroll", { scroll: "bless", price: 4000, desc: "祝福武卷：強化失敗時裝備不會消失。" });
  use("scroll_poly", "初級變身卷軸", "uncommon", "poly", { polyTier: 1, price: 120 });
  use("scroll_poly2", "中級變身卷軸", "rare", "poly", { polyTier: 2, price: 480 });
  use("scroll_poly3", "高級變身卷軸", "epic", "poly", { polyTier: 3, price: 1800 });

  mat("hide", "皮革", "common", { price: 6 });
  mat("hide2", "高級皮革", "uncommon", { price: 28 });
  mat("bone", "骨頭碎片", "common", { price: 8 });
  mat("ore", "鋼鐵原石", "uncommon", { price: 22 });
  mat("ingot", "金屬塊", "uncommon", { price: 80 });
  mat("steel", "鋼鐵塊", "rare", { price: 220 });
  mat("mithril", "米索莉", "rare", { price: 360 });
  mat("rough_mith", "粗糙的米索莉塊", "uncommon", { price: 120 });
  mat("gem", "寶石", "rare", { price: 90 });
  mat("gem_r", "紅寶石", "rare", { price: 140 });
  mat("gem_g", "綠寶石", "uncommon", { price: 100 });
  mat("scale_mat", "龍鱗", "epic", { price: 260 });
  mat("candle", "蠟燭", "common", { price: 4 });

  const monsters = {
    fox: { id: "fox", name: "狐狸", lv: 1, hp: 14, ac: 9, mr: 2, dmg: [1, 3], exp: 8, gold: [1, 4], icon: "🦊" },
    rabbit: { id: "rabbit", name: "兔子", lv: 1, hp: 12, ac: 10, mr: 2, dmg: [1, 2], exp: 6, gold: [1, 3], icon: "🐰" },
    goblin: { id: "goblin", name: "哥布林", lv: 4, hp: 28, ac: 7, mr: 5, dmg: [2, 5], exp: 18, gold: [4, 10], icon: "👺" },
    orc: { id: "orc", name: "妖魔", lv: 8, hp: 52, ac: 5, mr: 10, dmg: [4, 9], exp: 42, gold: [8, 18], icon: "👹" },
    orc_arch: { id: "orc_arch", name: "妖魔弓箭手", lv: 10, hp: 58, ac: 5, mr: 10, dmg: [5, 10], exp: 52, gold: [10, 22], icon: "🏹" },
    dwarf: { id: "dwarf", name: "侏儒", lv: 6, hp: 48, ac: 6, mr: 8, dmg: [3, 8], exp: 32, gold: [6, 14], icon: "🧔" },
    slime: { id: "slime", name: "史萊姆", lv: 5, hp: 42, ac: 8, mr: 6, dmg: [2, 6], exp: 28, gold: [4, 10], icon: "🟢" },
    boar: { id: "boar", name: "野豬", lv: 7, hp: 55, ac: 5, mr: 6, dmg: [4, 9], exp: 38, gold: [6, 14], icon: "🐗" },
    wolf: { id: "wolf", name: "狼", lv: 9, hp: 68, ac: 4, mr: 10, dmg: [5, 11], exp: 48, gold: [8, 16], icon: "🐺" },
    orc_f: { id: "orc_f", name: "妖魔鬥士", lv: 12, hp: 95, ac: 3, mr: 12, dmg: [7, 14], exp: 72, gold: [12, 26], icon: "🪓" },
    wolfman: { id: "wolfman", name: "狼人", lv: 14, hp: 110, ac: 2, mr: 14, dmg: [8, 16], exp: 88, gold: [14, 28], icon: "🐺" },
    dw_f: { id: "dw_f", name: "侏儒戰士", lv: 10, hp: 88, ac: 3, mr: 12, dmg: [6, 13], exp: 58, gold: [10, 22], icon: "⚒️" },
    floating: { id: "floating", name: "漂浮之眼", lv: 11, hp: 82, ac: 2, mr: 20, dmg: [6, 12], exp: 68, gold: [12, 24], icon: "👁" },
    mushroom: { id: "mushroom", name: "妖魔法師", lv: 12, hp: 75, ac: 3, mr: 22, dmg: [5, 11], exp: 70, gold: [10, 22], icon: "🍄" },
    skeleton: { id: "skeleton", name: "骷髏", lv: 15, hp: 130, ac: 1, mr: 22, dmg: [9, 17], exp: 105, gold: [16, 34], icon: "💀" },
    skel_a: { id: "skel_a", name: "骷髏弓箭手", lv: 16, hp: 118, ac: 1, mr: 20, dmg: [9, 18], exp: 115, gold: [16, 36], icon: "💀" },
    golem: { id: "golem", name: "石頭高崙", lv: 14, hp: 175, ac: 0, mr: 16, dmg: [10, 17], exp: 95, gold: [18, 38], icon: "🪨" },
    hobgob: { id: "hobgob", name: "哈柏哥布林", lv: 16, hp: 140, ac: 1, mr: 14, dmg: [10, 18], exp: 120, gold: [18, 40], icon: "👺" },
    arachne: { id: "arachne", name: "夏洛伯", lv: 17, hp: 148, ac: 0, mr: 18, dmg: [11, 19], exp: 130, gold: [20, 42], icon: "🕷" },
    zombie: { id: "zombie", name: "人形殭屍", lv: 15, hp: 155, ac: 1, mr: 14, dmg: [9, 17], exp: 100, gold: [16, 36], icon: "🧟" },
    bear: { id: "bear", name: "歐熊", lv: 18, hp: 230, ac: 0, mr: 12, dmg: [13, 22], exp: 145, gold: [22, 48], icon: "🐻" },
    ghoul: { id: "ghoul", name: "食屍鬼", lv: 19, hp: 205, ac: 0, mr: 22, dmg: [12, 22], exp: 155, gold: [24, 50], icon: "👻" },
    gandi: { id: "gandi", name: "甘地妖魔", lv: 17, hp: 175, ac: 0, mr: 16, dmg: [11, 20], exp: 125, gold: [20, 44], icon: "👹" },
    lycan: { id: "lycan", name: "萊肯", lv: 20, hp: 185, ac: -1, mr: 20, dmg: [14, 24], exp: 165, gold: [26, 54], icon: "🐺" },
    yangol: { id: "yangol", name: "楊果裡恩", lv: 22, hp: 220, ac: -1, mr: 22, dmg: [15, 26], exp: 195, gold: [28, 58], icon: "🦂" },
    sparto: { id: "sparto", name: "史巴托", lv: 21, hp: 250, ac: -1, mr: 18, dmg: [15, 25], exp: 185, gold: [30, 60], icon: "🦴" },
    ant: { id: "ant", name: "巨蟻", lv: 18, hp: 190, ac: 0, mr: 14, dmg: [12, 21], exp: 140, gold: [20, 44], icon: "🐜" },
    ant_s: { id: "ant_s", name: "巨大兵蟻", lv: 24, hp: 320, ac: -2, mr: 18, dmg: [19, 32], exp: 260, gold: [38, 76], icon: "🐜" },
    scorpion: { id: "scorpion", name: "毒蠍", lv: 22, hp: 250, ac: -1, mr: 22, dmg: [17, 28], exp: 210, gold: [32, 66], icon: "🦂" },
    lizard: { id: "lizard", name: "蜥蜴人", lv: 26, hp: 370, ac: -3, mr: 26, dmg: [21, 35], exp: 290, gold: [48, 92], icon: "🦎" },
    bugbear: { id: "bugbear", name: "食人妖精", lv: 23, hp: 330, ac: -2, mr: 18, dmg: [19, 31], exp: 230, gold: [40, 80], icon: "🧌" },
    hellhound: { id: "hellhound", name: "地獄犬", lv: 28, hp: 400, ac: -3, mr: 24, dmg: [23, 38], exp: 320, gold: [52, 98], icon: "🐶" },
    ogre: { id: "ogre", name: "歐吉", lv: 30, hp: 540, ac: -4, mr: 20, dmg: [27, 44], exp: 380, gold: [68, 128], icon: "👹" },
    darkelf: { id: "darkelf", name: "黑暗精靈", lv: 29, hp: 410, ac: -4, mr: 30, dmg: [23, 40], exp: 350, gold: [58, 108], icon: "🧝" },
    succubus: { id: "succubus", name: "思克巴", lv: 35, hp: 640, ac: -6, mr: 38, dmg: [31, 52], exp: 520, gold: [85, 165], icon: "😈" },
    drake: { id: "drake", name: "飛龍", lv: 36, hp: 740, ac: -6, mr: 42, dmg: [35, 58], exp: 560, gold: [100, 195], icon: "🐉" },
    gargoyle: { id: "gargoyle", name: "石像鬼", lv: 40, hp: 920, ac: -8, mr: 48, dmg: [41, 66], exp: 720, gold: [130, 250], icon: "🗿" },
    deathk: { id: "deathk", name: "死亡騎士", lv: 46, hp: 1450, ac: -10, mr: 58, dmg: [52, 82], exp: 1200, gold: [200, 380], icon: "⚔" },
    ant_queen: { id: "ant_queen", name: "巨大蟻后", lv: 35, hp: 25000, ac: -8, mr: 40, dmg: [40, 70], exp: 2200, gold: [400, 800], icon: "🐜", worldBoss: true },
    succubus_q: { id: "succubus_q", name: "思克巴女皇", lv: 48, hp: 160000, ac: -12, mr: 70, dmg: [55, 90], exp: 2800, gold: [500, 900], icon: "👑", worldBoss: true },
    kobold: { id: "kobold", name: "哥布林", lv: 4, hp: 28, ac: 7, mr: 5, dmg: [2, 5], exp: 18, gold: [4, 10], icon: "👺" },
    gnoll: { id: "gnoll", name: "狼", lv: 9, hp: 68, ac: 4, mr: 10, dmg: [5, 11], exp: 48, gold: [8, 16], icon: "🐺" },
    balrog: { id: "balrog", name: "炎魔", lv: 44, hp: 1000, ac: -9, mr: 50, dmg: [40, 64], exp: 980, gold: [140, 270], icon: "👿" },
    ancient: { id: "ancient", name: "古代飛龍", lv: 38, hp: 800, ac: -7, mr: 44, dmg: [36, 60], exp: 640, gold: [115, 210], icon: "🐉" },
    harpy: { id: "harpy", name: "哈比", lv: 25, hp: 350, ac: -2, mr: 24, dmg: [19, 30], exp: 240, gold: [42, 82], icon: "🦅" },
    medusa: { id: "medusa", name: "美杜莎", lv: 30, hp: 430, ac: -4, mr: 28, dmg: [21, 34], exp: 340, gold: [52, 98], icon: "🐍" },
    unicorn: { id: "unicorn", name: "獨角獸", lv: 28, hp: 490, ac: -3, mr: 34, dmg: [23, 38], exp: 400, gold: [62, 115], icon: "🦄" },
    iron_golem: { id: "iron_golem", name: "鐵門高崙", lv: 38, hp: 840, ac: -6, mr: 32, dmg: [33, 54], exp: 680, gold: [115, 215], icon: "🪨" },
    lich: { id: "lich", name: "巫妖", lv: 42, hp: 900, ac: -8, mr: 52, dmg: [37, 60], exp: 820, gold: [125, 235], icon: "💀" },
    demon: { id: "demon", name: "惡魔", lv: 44, hp: 980, ac: -9, mr: 50, dmg: [39, 64], exp: 900, gold: [145, 275], icon: "👿" },
    guardian: { id: "guardian", name: "守護者", lv: 48, hp: 1250, ac: -10, mr: 44, dmg: [43, 70], exp: 1100, gold: [175, 310], icon: "🛡" },
    baphomet: { id: "baphomet", name: "巴風特", lv: 45, hp: 120000, ac: -11, mr: 65, dmg: [52, 85], exp: 3500, gold: [600, 1000], icon: "👿", worldBoss: true },
    black_elder: { id: "black_elder", name: "黑長老", lv: 48, hp: 150000, ac: -12, mr: 72, dmg: [55, 90], exp: 4000, gold: [700, 1100], icon: "🧙", worldBoss: true },
    lindvior: { id: "lindvior", name: "林德拜爾", lv: 50, hp: 180000, ac: -13, mr: 68, dmg: [58, 95], exp: 4500, gold: [800, 1200], icon: "🐉", worldBoss: true },
    fafurion: { id: "fafurion", name: "法利昂", lv: 52, hp: 220000, ac: -14, mr: 75, dmg: [62, 100], exp: 5000, gold: [900, 1400], icon: "🐲", worldBoss: true },
    antharas: { id: "antharas", name: "安塔瑞斯", lv: 54, hp: 280000, ac: -15, mr: 70, dmg: [65, 105], exp: 5500, gold: [1000, 1600], icon: "🐉", worldBoss: true },
    valakas: { id: "valakas", name: "巴拉卡斯", lv: 56, hp: 350000, ac: -16, mr: 78, dmg: [70, 115], exp: 6200, gold: [1200, 1800], icon: "🔥", worldBoss: true },
  };

  /** 掉落表：比照 Lineage 1.63c／亞丁經典設定（機率為放置版簡化） */
  const drops = {
    rabbit: [{ id: "hide", p: 0.55, n: [1, 2] }, { id: "red", p: 0.22, n: [1, 2] }],
    fox: [{ id: "hide", p: 0.5, n: [1, 2] }, { id: "red", p: 0.25, n: [1, 2] }],
    goblin: [{ id: "hide", p: 0.45 }, { id: "red", p: 0.32 }, { id: "bsword", p: 0.06 }],
    kobold: [{ id: "hide", p: 0.45 }, { id: "red", p: 0.32 }, { id: "bsword", p: 0.05 }],
    orc: [{ id: "rough_mith", p: 0.05 }, { id: "hide", p: 0.35 }, { id: "osword", p: 0.05 }, { id: "ohelm", p: 0.04 }, { id: "oring", p: 0.04 }, { id: "odagger", p: 0.04 }, { id: "scroll_poly", p: 0.025 }, { id: "candle", p: 0.08 }],
    orc_arch: [{ id: "obow", p: 0.05 }, { id: "bow", p: 0.04 }, { id: "ohelm", p: 0.04 }, { id: "oring", p: 0.04 }, { id: "ochain", p: 0.03 }, { id: "red", p: 0.28 }, { id: "scroll_poly", p: 0.02 }],
    orc_f: [{ id: "spear", p: 0.05 }, { id: "oring", p: 0.05 }, { id: "ochain", p: 0.04 }, { id: "ocloak", p: 0.03 }, { id: "cloak2", p: 0.02 }, { id: "ohelm", p: 0.04 }, { id: "red", p: 0.25 }],
    dwarf: [{ id: "ore", p: 0.28, n: [1, 2] }, { id: "ingot", p: 0.06 }, { id: "rough_mith", p: 0.04 }, { id: "red", p: 0.28 }, { id: "scroll_poly", p: 0.02 }],
    dw_f: [{ id: "ore", p: 0.3, n: [1, 2] }, { id: "ingot", p: 0.08 }, { id: "ihelm", p: 0.03 }, { id: "axe", p: 0.04 }],
    slime: [{ id: "blue", p: 0.22 }, { id: "cloth", p: 0.06 }, { id: "red", p: 0.24 }],
    boar: [{ id: "hide", p: 0.52, n: [1, 3] }, { id: "red", p: 0.26 }],
    wolf: [{ id: "hide", p: 0.48, n: [1, 3] }, { id: "red", p: 0.28 }],
    gnoll: [{ id: "hide", p: 0.48, n: [1, 3] }, { id: "red", p: 0.28 }],
    wolfman: [{ id: "lsword", p: 0.04 }, { id: "leather", p: 0.05 }, { id: "buckler", p: 0.04 }, { id: "hide", p: 0.35 }, { id: "orange", p: 0.14 }],
    floating: [{ id: "blue", p: 0.26 }, { id: "wisdom", p: 0.07 }, { id: "staff", p: 0.03 }],
    mushroom: [{ id: "staff", p: 0.05 }, { id: "wand", p: 0.04 }, { id: "blue", p: 0.2 }, { id: "wisdom", p: 0.06 }],
    skeleton: [{ id: "bone", p: 0.48, n: [1, 3] }, { id: "scimitar", p: 0.05 }, { id: "ihelm", p: 0.04 }, { id: "cloak2", p: 0.03 }, { id: "kite", p: 0.03 }, { id: "haste_pot", p: 0.04 }, { id: "scroll_w", p: 0.025 }],
    skel_a: [{ id: "bone", p: 0.42, n: [1, 2] }, { id: "bow", p: 0.05 }, { id: "ihelm", p: 0.04 }, { id: "cloak2", p: 0.03 }, { id: "haste_pot", p: 0.04 }],
    golem: [{ id: "ore", p: 0.38, n: [1, 3] }, { id: "ingot", p: 0.1 }, { id: "gem", p: 0.04 }],
    hobgob: [{ id: "spear", p: 0.05 }, { id: "oring", p: 0.04 }, { id: "orange", p: 0.16 }, { id: "hide", p: 0.2 }],
    arachne: [{ id: "crystal", p: 0.03 }, { id: "haste_pot", p: 0.05 }, { id: "scroll_w", p: 0.03 }, { id: "orange", p: 0.18 }],
    zombie: [{ id: "rough_mith", p: 0.04 }, { id: "bone", p: 0.25 }, { id: "scroll_a", p: 0.03 }, { id: "blue", p: 0.18 }],
    bear: [{ id: "hide", p: 0.5, n: [2, 4] }, { id: "hide2", p: 0.08 }, { id: "orange", p: 0.18 }],
    ghoul: [{ id: "scroll_a", p: 0.045 }, { id: "bone", p: 0.32 }, { id: "orange", p: 0.16 }],
    gandi: [{ id: "osword", p: 0.05 }, { id: "spear", p: 0.04 }, { id: "candle", p: 0.1 }, { id: "red", p: 0.22 }],
    lycan: [{ id: "lsword", p: 0.04 }, { id: "scroll_w", p: 0.035 }, { id: "hide2", p: 0.08 }, { id: "orange", p: 0.18 }, { id: "scroll_poly2", p: 0.025 }],
    yangol: [{ id: "scroll_w", p: 0.04 }, { id: "scroll_a", p: 0.035 }, { id: "gem", p: 0.05 }, { id: "haste_pot", p: 0.05 }, { id: "crystal", p: 0.02 }],
    sparto: [{ id: "scimitar", p: 0.05 }, { id: "bone", p: 0.38, n: [1, 3] }, { id: "kite", p: 0.04 }, { id: "bronze", p: 0.03 }, { id: "ihelm", p: 0.04 }, { id: "haste_pot", p: 0.04 }],
    ant: [{ id: "gem_g", p: 0.05 }, { id: "ore", p: 0.18 }, { id: "orange", p: 0.2 }, { id: "haste_pot", p: 0.04 }],
    ant_s: [{ id: "plate", p: 0.025 }, { id: "bronze", p: 0.04 }, { id: "scale", p: 0.03 }, { id: "gem_r", p: 0.05 }, { id: "scroll_a", p: 0.045 }, { id: "orange", p: 0.22 }],
    scorpion: [{ id: "ring_mr", p: 0.045 }, { id: "gem", p: 0.06 }, { id: "haste_pot", p: 0.05 }, { id: "orange", p: 0.18 }],
    lizard: [{ id: "scale", p: 0.04 }, { id: "lsword", p: 0.025 }, { id: "kite", p: 0.03 }, { id: "clear", p: 0.08 }],
    bugbear: [{ id: "axe", p: 0.06 }, { id: "ringmail", p: 0.04 }, { id: "scroll_w", p: 0.04 }, { id: "scroll_a", p: 0.035 }, { id: "hide2", p: 0.1 }],
    hellhound: [{ id: "gem_r", p: 0.06 }, { id: "hide2", p: 0.1 }, { id: "scroll_w", p: 0.04 }, { id: "orange", p: 0.2 }, { id: "staff", p: 0.03 }],
    ogre: [{ id: "axe", p: 0.07 }, { id: "scroll_w", p: 0.045 }, { id: "scroll_a", p: 0.04 }, { id: "ingot", p: 0.1 }, { id: "ihelm", p: 0.03 }],
    darkelf: [{ id: "katana", p: 0.03 }, { id: "elvenbow", p: 0.02 }, { id: "elvenchain", p: 0.02 }, { id: "gem", p: 0.08 }, { id: "wisdom", p: 0.08 }],
    harpy: [{ id: "lbow", p: 0.035 }, { id: "hide2", p: 0.1 }, { id: "ring_dex", p: 0.04 }, { id: "orange", p: 0.18 }],
    medusa: [{ id: "ring_mr", p: 0.05 }, { id: "scale_mat", p: 0.06 }, { id: "scroll_a", p: 0.045 }, { id: "clear", p: 0.07 }],
    unicorn: [{ id: "gem", p: 0.08 }, { id: "amu2", p: 0.03 }, { id: "clear", p: 0.1 }, { id: "hide2", p: 0.1 }],
    iron_golem: [{ id: "steel", p: 0.1 }, { id: "mithril", p: 0.04 }, { id: "ingot", p: 0.14, n: [1, 2] }, { id: "scroll_poly3", p: 0.03 }],
    lich: [{ id: "scroll_b", p: 0.04 }, { id: "archstaff", p: 0.02 }, { id: "amu3", p: 0.02 }, { id: "gem", p: 0.12 }],
    demon: [{ id: "scroll_b", p: 0.05 }, { id: "cloak2", p: 0.05 }, { id: "ring_imm", p: 0.03 }, { id: "scroll_poly3", p: 0.04 }],
    guardian: [{ id: "plate", p: 0.05 }, { id: "tower", p: 0.03 }, { id: "scroll_b", p: 0.06 }, { id: "mithril", p: 0.06 }],
    baphomet: [{ id: "scroll_b", p: 0.08 }, { id: "amu3", p: 0.03 }, { id: "dsword", p: 0.04 }, { id: "starstaff", p: 0.02 }],
    black_elder: [{ id: "archrobe", p: 0.06 }, { id: "scroll_b", p: 0.1 }, { id: "amu3", p: 0.04 }, { id: "crystalarm", p: 0.03 }],
    lindvior: [{ id: "dhelm", p: 0.05 }, { id: "scale_mat", p: 0.14 }, { id: "scroll_b", p: 0.08 }, { id: "excal", p: 0.02 }],
    fafurion: [{ id: "moonbow", p: 0.03 }, { id: "scale_mat", p: 0.12 }, { id: "scroll_b", p: 0.08 }, { id: "amu3", p: 0.04 }],
    antharas: [{ id: "crystalarm", p: 0.04 }, { id: "mithril", p: 0.1 }, { id: "scroll_b", p: 0.1 }, { id: "excal", p: 0.03 }],
    valakas: [{ id: "excal", p: 0.04 }, { id: "starstaff", p: 0.03 }, { id: "scroll_b", p: 0.12 }, { id: "amu3", p: 0.05 }],
    succubus: [{ id: "wisdom", p: 0.08 }, { id: "scroll_b", p: 0.02 }, { id: "cloak2", p: 0.04 }, { id: "ring_imm", p: 0.02 }, { id: "gem", p: 0.1 }],
    drake: [{ id: "dhelm", p: 0.04 }, { id: "scale_mat", p: 0.12 }, { id: "scroll_b", p: 0.025 }, { id: "elvenbow", p: 0.02 }, { id: "scroll_poly3", p: 0.03 }],
    ancient: [{ id: "dhelm", p: 0.05 }, { id: "scale_mat", p: 0.14 }, { id: "scroll_b", p: 0.03 }, { id: "elvenbow", p: 0.025 }],
    gargoyle: [{ id: "plate", p: 0.04 }, { id: "steel", p: 0.08 }, { id: "mithril", p: 0.04 }, { id: "archstaff", p: 0.02 }, { id: "gem", p: 0.1 }],
    deathk: [{ id: "dsword", p: 0.04 }, { id: "crystalarm", p: 0.03 }, { id: "scroll_b", p: 0.05 }, { id: "gem", p: 0.14 }],
    ant_queen: [{ id: "plate", p: 0.06 }, { id: "gem_r", p: 0.1 }, { id: "scroll_b", p: 0.08 }, { id: "clear", p: 0.28, n: [2, 4] }],
    succubus_q: [{ id: "archrobe", p: 0.06 }, { id: "amu3", p: 0.03 }, { id: "scroll_b", p: 0.1 }, { id: "starstaff", p: 0.02 }, { id: "wisdom", p: 0.12 }],
    balrog: [{ id: "scroll_b", p: 0.04 }, { id: "cloak2", p: 0.05 }, { id: "ring_imm", p: 0.03 }, { id: "gem", p: 0.1 }],
  };

  const maps = [
    { id: "talking", name: "說話之島北部", cat: "field", region: "說話之島", rec: 1, bg: "forest", monsters: ["rabbit", "fox", "goblin"] },
    { id: "talking_s", name: "說話之島南部", cat: "field", region: "說話之島", rec: 2, bg: "forest", monsters: ["goblin", "orc", "kobold"] },
    { id: "talking_d", name: "說話之島地監 1F", cat: "dungeon", region: "說話之島", rec: 8, bg: "dungeon", monsters: ["orc", "zombie", "floating", "skeleton"] },
    { id: "talking_d2", name: "說話之島地監 2F", cat: "dungeon", region: "說話之島", rec: 12, bg: "dungeon", monsters: ["skeleton", "skel_a", "zombie", "ghoul"] },
    { id: "talking_d3", name: "說話之島地監 3F", cat: "dungeon", region: "說話之島", rec: 16, bg: "dungeon", monsters: ["skel_a", "ghoul", "wolfman", "arachne"] },
    { id: "adv_cave", name: "冒險洞穴", cat: "dungeon", region: "說話之島", rec: 10, bg: "dungeon", monsters: ["goblin", "orc", "floating", "skeleton"] },
    { id: "skt", name: "銀騎士村莊周邊", cat: "field", region: "銀騎士", rec: 3, bg: "glade", monsters: ["goblin", "orc", "dwarf", "wolf"] },
    { id: "elfwood", name: "妖精森林", cat: "field", region: "銀騎士", rec: 6, bg: "forest", monsters: ["orc", "mushroom", "wolf", "orc_f", "wolfman"] },
    { id: "dreameye", name: "眠龍洞穴", cat: "dungeon", region: "銀騎士", rec: 12, bg: "dungeon", monsters: ["gandi", "orc_f", "wolfman", "ghoul"] },
    { id: "knightcave", name: "騎士洞穴", cat: "dungeon", region: "銀騎士", rec: 16, bg: "dungeon", monsters: ["skeleton", "skel_a", "sparto", "succubus"] },
    { id: "kent", name: "肯特草原", cat: "field", region: "肯特", rec: 4, bg: "glade", monsters: ["goblin", "boar", "wolfman", "hobgob", "lycan"] },
    { id: "kent_d", name: "肯特地監 1F", cat: "dungeon", region: "肯特", rec: 10, bg: "dungeon", monsters: ["hobgob", "wolfman", "skeleton", "zombie"] },
    { id: "gludio", name: "古魯丁平原", cat: "field", region: "古魯丁", rec: 5, bg: "glade", monsters: ["orc", "dwarf", "slime", "orc_f", "wolf"] },
    { id: "mine", name: "廢棄礦坑", cat: "dungeon", region: "古魯丁", rec: 10, bg: "dungeon", monsters: ["dwarf", "dw_f", "golem", "skeleton"] },
    { id: "gludio_d1", name: "古魯丁地監 1F", cat: "dungeon", region: "古魯丁", rec: 12, bg: "dungeon", monsters: ["skeleton", "skel_a", "zombie", "ghoul"] },
    { id: "gludio_d2", name: "古魯丁地監 2F", cat: "dungeon", region: "古魯丁", rec: 18, bg: "dungeon", monsters: ["ghoul", "sparto", "yangol", "bugbear"] },
    { id: "gludio_d3", name: "古魯丁地監 3F", cat: "dungeon", region: "古魯丁", rec: 24, bg: "dungeon", monsters: ["sparto", "yangol", "bugbear", "hellhound"] },
    { id: "gludio_d4", name: "古魯丁地監 4F", cat: "dungeon", region: "古魯丁", rec: 28, bg: "dungeon", monsters: ["yangol", "bugbear", "hellhound", "lycan"] },
    { id: "gludio_d5", name: "古魯丁地監 5F", cat: "dungeon", region: "古魯丁", rec: 32, bg: "dungeon", monsters: ["bugbear", "hellhound", "lycan", "darkelf"] },
    { id: "gludio_d6", name: "古魯丁地監 6F", cat: "dungeon", region: "古魯丁", rec: 36, bg: "dungeon", monsters: ["hellhound", "lycan", "ogre", "iron_golem"] },
    { id: "gludio_d7", name: "古魯丁地監 7F", cat: "dungeon", region: "古魯丁", rec: 40, bg: "dungeon", monsters: ["lycan", "ogre", "iron_golem", "deathk"] },
    { id: "orcforest", name: "妖魔森林", cat: "field", region: "燃柳", rec: 12, bg: "forest", monsters: ["orc_arch", "orc_f", "gandi", "wolfman", "lycan"] },
    { id: "burn_d", name: "妖魔城地監 1F", cat: "dungeon", region: "燃柳", rec: 14, bg: "dungeon", monsters: ["gandi", "orc_f", "mushroom", "ghoul"] },
    { id: "wood", name: "風木森林", cat: "field", region: "風木", rec: 8, bg: "forest", monsters: ["orc_arch", "orc_f", "wolf", "floating", "lizard"] },
    { id: "desert", name: "風木沙漠", cat: "field", region: "風木", rec: 18, bg: "desert", monsters: ["scorpion", "ant", "ant_s", "lizard"] },
    { id: "wind_d", name: "風木地監 1F", cat: "dungeon", region: "風木", rec: 14, bg: "dungeon", monsters: ["skeleton", "skel_a", "ghoul", "sparto"] },
    { id: "wind_d2", name: "風木地監 2F", cat: "dungeon", region: "風木", rec: 18, bg: "dungeon", monsters: ["skel_a", "ghoul", "sparto", "yangol"] },
    { id: "antnest", name: "螞蟻洞窟", cat: "dungeon", region: "風木", rec: 20, bg: "dungeon", monsters: ["ant", "ant_s", "scorpion"] },
    { id: "desert_d", name: "沙漠地監", cat: "dungeon", region: "風木", rec: 24, bg: "dungeon", monsters: ["bugbear", "hellhound", "ghoul", "lycan"] },
    { id: "giran", name: "奇岩平原", cat: "field", region: "奇岩", rec: 14, bg: "glade", monsters: ["hobgob", "bear", "arachne", "bugbear"] },
    { id: "giran_d", name: "奇岩地監 1F", cat: "dungeon", region: "奇岩", rec: 18, bg: "dungeon", monsters: ["bear", "ghoul", "lycan", "hellhound"] },
    { id: "giran_d2", name: "奇岩地監 2F", cat: "dungeon", region: "奇岩", rec: 24, bg: "dungeon", monsters: ["ghoul", "lycan", "hellhound", "ogre"] },
    { id: "giran_d3", name: "奇岩地監 3F", cat: "dungeon", region: "奇岩", rec: 30, bg: "dungeon", monsters: ["lycan", "hellhound", "ogre", "succubus"] },
    { id: "ivory_l", name: "象牙塔 1~3F", cat: "dungeon", region: "奇岩", rec: 28, bg: "tower", monsters: ["golem", "mushroom", "floating", "gargoyle"] },
    { id: "ivory", name: "象牙塔 4F", cat: "dungeon", region: "奇岩", rec: 34, bg: "tower", monsters: ["golem", "gargoyle", "succubus", "lich"] },
    { id: "dragonv", name: "龍之谷", cat: "field", region: "龍之谷", rec: 22, bg: "volcano", monsters: ["lycan", "sparto", "ogre", "drake", "ancient", "gargoyle"] },
    { id: "dragon_d", name: "龍之谷地監 1F", cat: "dungeon", region: "龍之谷", rec: 28, bg: "dungeon", monsters: ["skel_a", "sparto", "succubus", "drake"] },
    { id: "dragon_d2", name: "龍之谷地監 2F", cat: "dungeon", region: "龍之谷", rec: 34, bg: "dungeon", monsters: ["sparto", "succubus", "drake", "ancient"] },
    { id: "aden_f", name: "亞丁近郊", cat: "field", region: "亞丁", rec: 16, bg: "glade", monsters: ["bear", "ghoul", "lycan", "darkelf"] },
    { id: "mirror", name: "鏡子森林", cat: "field", region: "亞丁", rec: 20, bg: "forest", monsters: ["unicorn", "darkelf", "lycan", "hellhound"] },
    { id: "aden_d1", name: "亞丁地監 1F", cat: "dungeon", region: "亞丁", rec: 26, bg: "dungeon", monsters: ["ghoul", "sparto", "lycan", "hellhound"] },
    { id: "aden_d2", name: "亞丁地監 2F", cat: "dungeon", region: "亞丁", rec: 32, bg: "dungeon", monsters: ["sparto", "yangol", "bugbear", "iron_golem"] },
    { id: "aden_d3", name: "亞丁地監 3F", cat: "dungeon", region: "亞丁", rec: 38, bg: "dungeon", monsters: ["iron_golem", "gargoyle", "lich", "deathk"] },
    { id: "tower1", name: "傲慢之塔 1~10F", cat: "dungeon", region: "亞丁", rec: 44, bg: "tower", monsters: ["gargoyle", "lich", "demon", "guardian"] },
    { id: "tower2", name: "傲慢之塔 11~20F", cat: "dungeon", region: "亞丁", rec: 52, bg: "tower", monsters: ["lich", "demon", "guardian", "balrog"] },
    { id: "tower3", name: "傲慢之塔 21~30F", cat: "dungeon", region: "亞丁", rec: 58, bg: "tower", monsters: ["demon", "guardian", "balrog", "deathk"] },
    { id: "tower4", name: "傲慢之塔 31~40F", cat: "dungeon", region: "亞丁", rec: 64, bg: "tower", monsters: ["guardian", "balrog", "deathk", "lich"] },
    { id: "tower5", name: "傲慢之塔 41~50F", cat: "dungeon", region: "亞丁", rec: 70, bg: "tower", monsters: ["balrog", "deathk", "demon", "guardian"] },
    { id: "oren_f", name: "歐瑞森林", cat: "field", region: "歐瑞", rec: 24, bg: "forest", monsters: ["darkelf", "harpy", "lycan", "ogre"] },
    { id: "oren_d", name: "歐瑞地監 1F", cat: "dungeon", region: "歐瑞", rec: 28, bg: "dungeon", monsters: ["darkelf", "medusa", "bugbear", "hellhound"] },
    { id: "oren_d2", name: "歐瑞地監 2F", cat: "dungeon", region: "歐瑞", rec: 34, bg: "dungeon", monsters: ["darkelf", "medusa", "ogre", "iron_golem"] },
    { id: "elmo", name: "艾爾摩戰場", cat: "field", region: "歐瑞", rec: 36, bg: "volcano", monsters: ["ogre", "iron_golem", "gargoyle", "drake"] },
    { id: "heine_f", name: "海音沼澤", cat: "field", region: "海音", rec: 30, bg: "forest", monsters: ["lizard", "medusa", "scorpion", "darkelf"] },
    { id: "heine_d", name: "海音地監 1F", cat: "dungeon", region: "海音", rec: 34, bg: "dungeon", monsters: ["lizard", "medusa", "succubus", "iron_golem"] },
    { id: "heine_d2", name: "海音地監 2F", cat: "dungeon", region: "海音", rec: 40, bg: "dungeon", monsters: ["medusa", "succubus", "iron_golem", "gargoyle"] },
    { id: "forgotten", name: "忘卻之島", cat: "field", region: "遺忘之島", rec: 40, bg: "volcano", monsters: ["drake", "gargoyle", "demon", "guardian"] },
    { id: "wb1", name: "巨大蟻后", cat: "boss", region: "世界王", rec: 30, bg: "boss", monsters: ["ant_queen"], boss: true, respawn: 1800 },
    { id: "wb2", name: "死亡騎士", cat: "boss", region: "世界王", rec: 38, bg: "boss", monsters: ["deathk"], boss: true, respawn: 3600 },
    { id: "wb3", name: "思克巴女皇", cat: "boss", region: "世界王", rec: 42, bg: "dragon", monsters: ["succubus_q"], boss: true, respawn: 5400 },
    { id: "wb4", name: "巴風特", cat: "boss", region: "世界王", rec: 44, bg: "boss", monsters: ["baphomet"], boss: true, respawn: 3600 },
    { id: "wb5", name: "黑長老", cat: "boss", region: "世界王", rec: 46, bg: "tower", monsters: ["black_elder"], boss: true, respawn: 5400 },
    { id: "wb6", name: "林德拜爾", cat: "boss", region: "世界王", rec: 48, bg: "dragon", monsters: ["lindvior"], boss: true, respawn: 7200 },
    { id: "wb7", name: "法利昂", cat: "boss", region: "世界王", rec: 50, bg: "dragon", monsters: ["fafurion"], boss: true, respawn: 7200 },
    { id: "wb8", name: "安塔瑞斯", cat: "boss", region: "世界王", rec: 52, bg: "volcano", monsters: ["antharas"], boss: true, respawn: 10800 },
    { id: "wb9", name: "巴拉卡斯", cat: "boss", region: "世界王", rec: 55, bg: "volcano", monsters: ["valakas"], boss: true, respawn: 14400 },
  ];

  const bossMeta = {
    wb1: { name: "巨大蟻后", mob: "ant_queen", maxHp: 25000, respawn: 1800, reward: { gold: [800, 1200], exp: 1200 } },
    wb2: { name: "死亡騎士", mob: "deathk", maxHp: 80000, respawn: 3600, reward: { gold: [1200, 2000], exp: 2200 } },
    wb3: { name: "思克巴女皇", mob: "succubus_q", maxHp: 160000, respawn: 5400, reward: { gold: [1800, 2800], exp: 3200 } },
    wb4: { name: "巴風特", mob: "baphomet", maxHp: 120000, respawn: 3600, reward: { gold: [2000, 3200], exp: 3600 } },
    wb5: { name: "黑長老", mob: "black_elder", maxHp: 150000, respawn: 5400, reward: { gold: [2400, 3800], exp: 4200 } },
    wb6: { name: "林德拜爾", mob: "lindvior", maxHp: 180000, respawn: 7200, reward: { gold: [3000, 4800], exp: 5000 } },
    wb7: { name: "法利昂", mob: "fafurion", maxHp: 220000, respawn: 7200, reward: { gold: [3200, 5200], exp: 5400 } },
    wb8: { name: "安塔瑞斯", mob: "antharas", maxHp: 280000, respawn: 10800, reward: { gold: [4000, 6500], exp: 6500 } },
    wb9: { name: "巴拉卡斯", mob: "valakas", maxHp: 350000, respawn: 14400, reward: { gold: [5000, 8000], exp: 8000 } },
  };

  const villages = [
    { id: "v_ti", name: "說話之島", desc: "新手出發的港口島", rec: 1, map: "talking" },
    { id: "v_skt", name: "銀騎士村莊", desc: "騎士團駐守的村莊", rec: 2, map: "skt" },
    { id: "v_kent", name: "肯特", desc: "安靜的城鎮，肯特草原與肯特地監", rec: 4, map: "kent" },
    { id: "v_glu", name: "古魯丁", desc: "大陸門戶，古魯丁地監 1~7F", rec: 5, map: "gludio" },
    { id: "v_elf", name: "隱藏之村", desc: "妖精居住的森林聚落", rec: 6, map: "elfwood" },
    { id: "v_wood", name: "風木", desc: "綠洲與沙漠的交界", rec: 8, map: "wood" },
    { id: "v_burn", name: "燃柳", desc: "妖魔森林與妖魔城地監", rec: 12, map: "orcforest" },
    { id: "v_giran", name: "奇岩", desc: "商業重鎮，奇岩地監與象牙塔", rec: 14, map: "giran" },
    { id: "v_dragon", name: "龍之谷入口", desc: "飛龍與龍之谷地監", rec: 22, map: "dragonv" },
    { id: "v_aden", name: "亞丁城", desc: "王國首都，高級狩獵與地監起點", rec: 16, map: "aden_f" },
    { id: "v_oren", name: "歐瑞", desc: "黑暗精靈出沒的森林城", rec: 24, map: "oren_f" },
    { id: "v_heine", name: "海音", desc: "水都，沼澤與地監獵場", rec: 30, map: "heine_f" },
  ];

  const recipes = [
    { id: "r_ingot", name: "金屬塊", out: "ingot", qty: 1, gold: 40, need: [["ore", 5]] },
    { id: "r_steel", name: "鋼鐵塊", out: "steel", qty: 1, gold: 180, need: [["ingot", 3], ["ore", 4]] },
    { id: "r_hide2", name: "高級皮革", out: "hide2", qty: 1, gold: 30, need: [["hide", 5]] },
    { id: "r_cap", name: "布帽", out: "cap", qty: 1, gold: 20, need: [["hide", 3]] },
    { id: "r_leather", name: "皮盔甲", out: "leather", qty: 1, gold: 50, need: [["hide", 8]] },
    { id: "r_buckler", name: "小圓盾", out: "buckler", qty: 1, gold: 80, need: [["hide", 4], ["ore", 3]] },
    { id: "r_ssword", name: "短劍", out: "ssword", qty: 1, gold: 60, need: [["ore", 6], ["bone", 2]] },
    { id: "r_ihelm", name: "鋼盔", out: "ihelm", qty: 1, gold: 220, need: [["ingot", 4]] },
    { id: "r_bsword", name: "闊劍", out: "bsword", qty: 1, gold: 180, need: [["ingot", 4], ["bone", 2]] },
    { id: "r_ringmail", name: "環甲", out: "ringmail", qty: 1, gold: 400, need: [["ingot", 5], ["hide", 6]] },
    { id: "r_kite", name: "大盾牌", out: "kite", qty: 1, gold: 360, need: [["steel", 2], ["ingot", 2]] },
    { id: "r_osword", name: "歐西斯短劍", out: "osword", qty: 1, gold: 90, need: [["ore", 4], ["bone", 3]] },
    { id: "r_ohelm", name: "歐西斯頭盔", out: "ohelm", qty: 1, gold: 80, need: [["ore", 3], ["hide", 2]] },
    { id: "r_oring", name: "歐西斯環甲", out: "oring", qty: 1, gold: 140, need: [["ore", 5], ["hide", 4]] },
    { id: "r_cloak2", name: "抗魔斗篷", out: "cloak2", qty: 1, gold: 800, need: [["hide2", 4], ["gem", 2]] },
    { id: "r_mithril", name: "米索莉", out: "mithril", qty: 1, gold: 420, need: [["rough_mith", 2], ["steel", 1], ["gem", 1]] },
    { id: "r_poly", name: "初級變身卷軸", out: "scroll_poly", qty: 1, gold: 80, need: [["hide", 4], ["bone", 2]] },
  ];

  const npcs = [
    { id: "shop", name: "雜貨商", desc: "藥水與材料", stock: ["red", "orange", "clear", "blue", "wisdom", "haste_pot"] },
    { id: "weapon", name: "武器商人", desc: "各職業武器", stock: ["ssword", "odagger", "osword", "bsword", "bow", "obow", "wand", "scimitar", "lbow", "staff", "lsword", "spear"] },
    { id: "armor", name: "防具商人", desc: "防具與盾", stock: ["leather", "oring", "ochain", "ringmail", "robe", "buckler", "bronze", "cloak1", "gloves1", "boots1", "ohelm"] },
    { id: "smith", name: "鐵匠", desc: "武卷／防卷強化，+7 起有爆裝風險", kind: "smith" },
    { id: "craft", name: "製作師", desc: "材料製成金屬與裝備", kind: "craft" },
    { id: "poly", name: "變身師", desc: "消耗變身卷軸，變身為魔物", kind: "poly" },
    { id: "trainer", name: "導師", desc: "確認已學會的技能", kind: "trainer" },
    { id: "elfmaster", name: "精靈導師", desc: "選擇精靈魔法屬性（火／水／風／地四選一）", kind: "elfmaster" },
    { id: "wh", name: "倉庫管理員", desc: "存放多餘物品", kind: "warehouse" },
    { id: "tele", name: "傳送師", desc: "快速前往狩獵場", kind: "tele" },
  ];

  const shopBuy = ["red", "orange", "clear", "blue", "wisdom", "haste_pot"];

  const names = {
    knight: { m: ["鋼心", "雷恩", "布拉德", "高文"], f: ["莉亞", "艾琳", "希薇", "瑪格"] },
    elf: { m: ["瑟里昂", "法恩", "林恩", "伊歐"], f: ["席琳", "月華", "艾莉", "薇拉"] },
    mage: { m: ["奧丁", "墨丘", "卡恩", "澤斯"], f: ["摩拉", "星紗", "伊西斯", "露娜"] },
  };

  const transforms = {
    poly_rabbit: {
      id: "poly_rabbit", name: "兔子", mob: "rabbit", tier: 1, minLv: 1,
      classes: ["knight", "elf", "mage"], scroll: "scroll_poly", dur: 120,
      hpMul: 1.12, ac: -2, dmg: [2, 5], haste: 0.98, magic: true,
      desc: "初級變身，略增生命與防禦。",
    },
    poly_wolf: {
      id: "poly_wolf", name: "狼", mob: "wolf", tier: 1, minLv: 10,
      classes: ["knight", "elf"], scroll: "scroll_poly", dur: 160,
      hpMul: 1.28, ac: -4, dmg: [5, 11], haste: 0.9, er: 2, magic: false,
      desc: "近戰型，攻速加快。變身中無法施放魔法。",
    },
    poly_orc: {
      id: "poly_orc", name: "妖魔", mob: "orc", tier: 1, minLv: 15,
      classes: ["knight"], scroll: "scroll_poly", dur: 180,
      hpMul: 1.38, ac: -5, dmg: [7, 15], haste: 0.92, magic: false,
      desc: "騎士專用，高生命與近戰傷害。",
    },
    poly_skeleton: {
      id: "poly_skeleton", name: "骷體", mob: "skeleton", tier: 1, minLv: 18,
      classes: ["knight", "elf", "mage"], scroll: "scroll_poly", dur: 180,
      hpMul: 1.25, ac: -3, mr: 12, dmg: [6, 13], haste: 0.94, magic: true,
      desc: "平衡型，可施放魔法，抗魔提升。",
    },
    poly_goblin: {
      id: "poly_goblin", name: "哥布林", mob: "goblin", tier: 1, minLv: 8,
      classes: ["knight", "elf"], scroll: "scroll_poly", dur: 150,
      hpMul: 1.18, ac: -2, dmg: [4, 9], haste: 0.93, magic: false,
      desc: "初級近戰，攻速略快。",
    },
    poly_floating: {
      id: "poly_floating", name: "漂浮之眼", mob: "floating", tier: 1, minLv: 20,
      classes: ["mage"], scroll: "scroll_poly", dur: 200,
      hpMul: 1.15, ac: -1, mr: 22, dmg: [5, 11], haste: 0.96, magic: true,
      desc: "法師專用，高抗魔、可施法。",
    },
    poly_ant: {
      id: "poly_ant", name: "兵蟻", mob: "ant", tier: 1, minLv: 22,
      classes: ["knight", "elf"], scroll: "scroll_poly", dur: 170,
      hpMul: 1.32, ac: -4, dmg: [7, 14], haste: 0.91, magic: false,
      desc: "初級坦克型，生命偏高。",
    },
    poly_lycan: {
      id: "poly_lycan", name: "萊肯", mob: "wolf", tier: 2, minLv: 22,
      classes: ["knight", "elf"], scroll: "scroll_poly2", dur: 220,
      hpMul: 1.45, ac: -6, dmg: [10, 19], haste: 0.86, er: 4, magic: false,
      desc: "中級近戰，高迴避。",
    },
    poly_lizard: {
      id: "poly_lizard", name: "蜥蜴人", mob: "lizard", tier: 2, minLv: 24,
      classes: ["elf"], scroll: "scroll_poly2", dur: 220,
      hpMul: 1.4, ac: -5, dmg: [9, 17], haste: 0.88, hit: 6, ranged: true, magic: false,
      desc: "妖精專用，遠程爪擊。",
    },
    poly_bugbear: {
      id: "poly_bugbear", name: "食人妖精", mob: "bugbear", tier: 2, minLv: 28,
      classes: ["knight"], scroll: "scroll_poly2", dur: 240,
      hpMul: 1.55, ac: -7, dmg: [13, 24], haste: 0.9, magic: false,
      desc: "中級坦克，高傷害。",
    },
    poly_hellhound: {
      id: "poly_hellhound", name: "地獄犬", mob: "hellhound", tier: 2, minLv: 32,
      classes: ["knight"], scroll: "scroll_poly2", dur: 260,
      hpMul: 1.5, ac: -8, dmg: [15, 26], haste: 0.84, magic: false,
      desc: "高速近戰，火系魔物外型。",
    },
    poly_hobgob: {
      id: "poly_hobgob", name: "哈柏哥布林", mob: "hobgob", tier: 2, minLv: 26,
      classes: ["knight", "elf"], scroll: "scroll_poly2", dur: 230,
      hpMul: 1.42, ac: -5, dmg: [11, 20], haste: 0.89, magic: false,
      desc: "中級近戰，攻防均衡。",
    },
    poly_bear: {
      id: "poly_bear", name: "熊", mob: "bear", tier: 2, minLv: 30,
      classes: ["knight"], scroll: "scroll_poly2", dur: 250,
      hpMul: 1.68, ac: -6, dmg: [14, 25], haste: 0.95, magic: false,
      desc: "中級高生命，近戰重擊。",
    },
    poly_golem: {
      id: "poly_golem", name: "石頭高崙", mob: "golem", tier: 2, minLv: 34,
      classes: ["knight", "mage"], scroll: "scroll_poly2", dur: 270,
      hpMul: 1.75, ac: -8, mr: 14, dmg: [12, 22], haste: 1.05, magic: true,
      desc: "中級坦克，防禦極高但攻速慢。",
    },
    poly_succubus: {
      id: "poly_succubus", name: "思克巴", mob: "succubus", tier: 2, minLv: 36,
      classes: ["mage"], scroll: "scroll_poly2", dur: 260,
      hpMul: 1.38, ac: -4, mr: 20, dmg: [10, 18], haste: 0.9, magic: true,
      desc: "法師中級變身，抗魔與魔法兼備。",
    },
    poly_mushroom: {
      id: "poly_mushroom", name: "妖魔法師", mob: "mushroom", tier: 2, minLv: 28,
      classes: ["mage"], scroll: "scroll_poly2", dur: 240,
      hpMul: 1.3, ac: -3, mr: 18, dmg: [8, 15], haste: 0.92, magic: true,
      desc: "法師專用，魔法型中級變身。",
    },
    poly_gargoyle: {
      id: "poly_gargoyle", name: "石像鬼", mob: "gargoyle", tier: 3, minLv: 38,
      classes: ["knight", "mage"], scroll: "scroll_poly3", dur: 280,
      hpMul: 1.65, ac: -9, mr: 18, dmg: [16, 28], haste: 0.92, magic: true,
      desc: "高級，可施法，抗魔強。",
    },
    poly_drake: {
      id: "poly_drake", name: "飛龍", mob: "drake", tier: 3, minLv: 40,
      classes: ["knight", "elf", "mage"], scroll: "scroll_poly3", dur: 300,
      hpMul: 1.72, ac: -10, mr: 10, dmg: [18, 32], haste: 0.88, magic: true,
      desc: "全職業高級變身，綜合能力強。",
    },
    poly_deathk: {
      id: "poly_deathk", name: "死亡騎士", mob: "deathk", tier: 3, minLv: 45,
      classes: ["knight"], scroll: "scroll_poly3", dur: 360,
      hpMul: 1.85, ac: -12, mr: 8, dmg: [22, 38], haste: 0.9, magic: false,
      desc: "騎士終極變身，極高攻防。",
    },
    poly_demon: {
      id: "poly_demon", name: "惡魔", mob: "demon", tier: 3, minLv: 42,
      classes: ["mage"], scroll: "scroll_poly3", dur: 320,
      hpMul: 1.6, ac: -8, mr: 24, dmg: [16, 28], haste: 0.88, magic: true,
      desc: "法師高級變身，高抗魔與魔法傷害。",
    },
    poly_lich: {
      id: "poly_lich", name: "巫妖", mob: "lich", tier: 3, minLv: 44,
      classes: ["mage"], scroll: "scroll_poly3", dur: 340,
      hpMul: 1.55, ac: -6, mr: 28, dmg: [14, 26], haste: 0.94, magic: true,
      desc: "法師終極魔法變身，抗魔極高。",
    },
    poly_ancient: {
      id: "poly_ancient", name: "古代飛龍", mob: "ancient", tier: 3, minLv: 48,
      classes: ["knight", "elf"], scroll: "scroll_poly3", dur: 380,
      hpMul: 1.9, ac: -11, mr: 12, dmg: [20, 36], haste: 0.86, magic: false,
      desc: "高級物理變身，極高生命與傷害。",
    },
  };

  const enchant = {
    safeMax: 6,
    maxPlus: 10,
    /** 非安定區（+6→+7 起）成功率，索引 0 = 目前 +6 */
    riskRates: [0.33, 0.22, 0.14, 0.08, 0.04],
    /** 非安定區強化失敗時，裝備消失機率（祝福卷軸／祝福裝備為 0） */
    vanishRates: [0.45, 0.55, 0.65, 0.75, 0.85],
    blessRateBonus: 0.12,
  };

  const marqueePool = [
    "系統：歡迎來到放置亞丁（亞丁 2.70 世界）。掛機、衝裝、掉寶，經典迴圈。",
    "亞丁城已開放：鏡子森林、亞丁地監 1~3F、傲慢之塔 1~50F 為高級狩獵區。",
    "古魯丁地監七層、奇岩地監三層、風木地監與沙漠地監已全面開放。",
    "歐瑞與海音：黑暗精靈、美杜莎、哈比等魔物掉落稀有裝備。",
    "世界王：巨大蟻后 30 分、死亡騎士／巴風特 60 分、思克巴女皇／黑長老 90 分、林德拜爾／法利昂 120 分、安塔瑞斯 180 分、巴拉卡斯 240 分重生。",
    "傳聞：奇岩的製作師能把礦石打成金屬塊。",
    "鐵匠：武卷衝武器、防卷衝防具。+0～+6 安定必成，+7 起失敗可能爆裝消失。",
    "祝福武卷：+7 以上失敗裝備不會消失，但仍可能強化失敗。",
    "妖魔掉歐西斯系列、粗糙的米索莉塊；骷髏掉彎刀、鋼盔、抗魔法斗篷、大盾牌。",
    "妖精：一般共用魔法＋精靈共用魔法；屬性魔法火／水／風／地四選一，找精靈導師選定。",
    "變身師：消耗變身卷軸可變成魔物，獲得魔物能力。精神越高，持續越久。",
    "血盟募集中：一起打世界王，傷害有排名。",
  ];

  return { gameVersion, R, classes, skills, skillTrees, elfElements, elfElemNames, enchant, slots, items, monsters, drops, maps, npcs, shopBuy, names, marqueePool, bossMeta, villages, recipes, transforms };
})();

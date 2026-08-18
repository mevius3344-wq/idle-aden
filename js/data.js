/* 放置亞丁 — 原創遊戲資料（靈感來自經典 MMORPG 放置玩法） */
window.DATA = (() => {
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
      skills: ["slash", "stun", "barrier"],
    },
    elf: {
      id: "elf",
      name: "妖精",
      desc: "敏捷遠程，命中高、攻速快，可學元素魔法。",
      base: { str: 11, dex: 16, con: 12, int: 12, wis: 12, cha: 10 },
      hp: 12,
      mp: 8,
      atk: 1.0,
      skills: ["double", "heal", "wind"],
    },
    mage: {
      id: "mage",
      name: "法師",
      desc: "遠距魔法，魔力深厚，後期爆發極強。",
      base: { str: 8, dex: 10, con: 10, int: 16, wis: 16, cha: 8 },
      hp: 9,
      mp: 14,
      atk: 0.72,
      skills: ["missile", "ice", "nova"],
    },
  };

  const skills = {
    slash: { id: "slash", name: "強力斬擊", mp: 8, cd: 6, desc: "造成 180% 物理傷害", kind: "phys", mul: 1.8, minLv: 4 },
    stun: { id: "stun", name: "衝擊暈眩", mp: 14, cd: 12, desc: "傷害 120%，暈眩 1.5 秒", kind: "phys", mul: 1.2, stun: 1.5, minLv: 12 },
    barrier: { id: "barrier", name: "鐵壁", mp: 18, cd: 20, desc: "6 秒內減傷 35%", kind: "buff", reduce: 0.35, dur: 6, minLv: 20 },
    double: { id: "double", name: "二連射", mp: 10, cd: 5, desc: "連續兩次 90% 傷害", kind: "phys", mul: 0.9, hits: 2, minLv: 4 },
    heal: { id: "heal", name: "治癒術", mp: 16, cd: 8, desc: "回復 25% 最大生命", kind: "heal", pct: 0.25, minLv: 8 },
    wind: { id: "wind", name: "風刃", mp: 22, cd: 10, desc: "魔法傷害 220%", kind: "magic", mul: 2.2, minLv: 16 },
    missile: { id: "missile", name: "魔力飛彈", mp: 6, cd: 3, desc: "魔法傷害 160%", kind: "magic", mul: 1.6, minLv: 1 },
    ice: { id: "ice", name: "冰錐", mp: 18, cd: 8, desc: "魔法傷害 240%，緩速", kind: "magic", mul: 2.4, minLv: 10 },
    nova: { id: "nova", name: "究極光裂", mp: 40, cd: 18, desc: "魔法傷害 420%", kind: "magic", mul: 4.2, minLv: 28 },
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

  w("club", "木棍", "common", 1, 2, 5, { price: 8, classes: ["knight", "elf", "mage"] });
  w("ssword", "短劍", "common", 1, 3, 8, { spd: 40, classes: ["knight", "elf"] });
  w("bsword", "闊劍", "common", 5, 6, 14, { classes: ["knight"] });
  w("scimitar", "彎刀", "uncommon", 10, 10, 20, { spd: 30, classes: ["knight", "elf"] });
  w("katana", "武士刀", "rare", 20, 18, 32, { hit: 8, spd: 20, classes: ["knight", "elf"] });
  w("claymore", "雙手劍", "rare", 28, 28, 48, { hit: 6, spd: -40, classes: ["knight"] });
  w("dsword", "死亡之劍", "epic", 40, 40, 68, { hit: 12, str: 3, classes: ["knight"] });
  w("excal", "聖輝長劍", "legend", 52, 58, 92, { hit: 16, str: 5, classes: ["knight"] });
  w("bow", "短弓", "common", 1, 3, 7, { spd: 50, classes: ["elf"] });
  w("lbow", "長弓", "uncommon", 12, 9, 18, { spd: 40, hit: 10, classes: ["elf"] });
  w("xbow", "十字弓", "rare", 22, 16, 28, { hit: 14, classes: ["elf"] });
  w("elvenbow", "精靈長弓", "epic", 38, 32, 54, { hit: 18, dex: 4, classes: ["elf"] });
  w("moonbow", "月華之弓", "legend", 50, 50, 84, { hit: 22, dex: 6, classes: ["elf"] });
  w("wand", "魔法杖", "common", 1, 1, 4, { classes: ["mage"], int: 1 });
  w("staff", "橡木魔杖", "uncommon", 10, 2, 8, { classes: ["mage"], int: 2 });
  w("crystal", "水晶權杖", "rare", 24, 4, 12, { classes: ["mage"], int: 4 });
  w("archstaff", "大法師之杖", "epic", 40, 8, 18, { classes: ["mage"], int: 7 });
  w("starstaff", "星辰權杖", "legend", 52, 12, 24, { classes: ["mage"], int: 10 });

  a("cap", "布帽", "common", 1, "helm", -1);
  a("lhelm", "皮頭盔", "common", 6, "helm", -2);
  a("ihelm", "鐵頭盔", "uncommon", 16, "helm", -4, { classes: ["knight"] });
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
  a("kite", "鳶盾", "uncommon", 14, "shield", -5, { classes: ["knight"] });
  a("tower", "塔盾", "rare", 28, "shield", -9, { classes: ["knight"] });
  a("cloak1", "旅行斗篷", "common", 2, "cloak", -1);
  a("cloak2", "抗魔斗篷", "rare", 24, "cloak", -2, { mr: 10 });
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

  use("red", "紅色藥水", "common", "potion", { hp: 25, price: 12 });
  use("orange", "橙色藥水", "uncommon", "potion", { hp: 80, price: 45 });
  use("clear", "透明藥水", "rare", "potion", { hp: 200, price: 180 });
  use("blue", "藍色藥水", "common", "potion", { mp: 20, price: 15 });
  use("wisdom", "慎重藥水", "uncommon", "potion", { mp: 80, price: 60 });
  use("scroll_w", "武器強化卷軸", "rare", "scroll", { scroll: "weapon", price: 800 });
  use("scroll_a", "防具強化卷軸", "rare", "scroll", { scroll: "armor", price: 700 });
  use("scroll_b", "祝福強化卷軸", "epic", "scroll", { scroll: "bless", price: 4000 });

  mat("hide", "獸皮", "common", { price: 6 });
  mat("bone", "骨頭", "common", { price: 8 });
  mat("ore", "鐵礦石", "uncommon", { price: 22 });
  mat("gem", "寶石碎片", "rare", { price: 90 });
  mat("scale_mat", "龍鱗碎片", "epic", { price: 260 });

  const monsters = {
    fox: { id: "fox", name: "狐狸", lv: 1, hp: 18, ac: 8, dmg: [1, 3], exp: 12, gold: [2, 6], icon: "🦊" },
    orc: { id: "orc", name: "妖魔", lv: 3, hp: 36, ac: 6, dmg: [2, 6], exp: 28, gold: [4, 12], icon: "👺" },
    kobold: { id: "kobold", name: "狗頭人", lv: 5, hp: 52, ac: 5, dmg: [3, 8], exp: 44, gold: [6, 16], icon: "🐶" },
    gnoll: { id: "gnoll", name: "豺狼", lv: 8, hp: 80, ac: 4, dmg: [5, 12], exp: 70, gold: [10, 24], icon: "🐺" },
    skeleton: { id: "skeleton", name: "骷髏", lv: 12, hp: 120, ac: 2, dmg: [8, 16], exp: 110, gold: [16, 36], icon: "💀" },
    zombie: { id: "zombie", name: "殭屍", lv: 14, hp: 160, ac: 1, dmg: [10, 18], exp: 140, gold: [18, 40], icon: "🧟" },
    wolfman: { id: "wolfman", name: "狼人", lv: 18, hp: 220, ac: 0, dmg: [14, 24], exp: 200, gold: [28, 60], icon: "🐺" },
    ghoul: { id: "ghoul", name: "食屍鬼", lv: 20, hp: 260, ac: -1, dmg: [16, 28], exp: 240, gold: [32, 70], icon: "👻" },
    ant: { id: "ant", name: "巨大蟻兵", lv: 22, hp: 300, ac: -2, dmg: [18, 30], exp: 280, gold: [40, 80], icon: "🐜" },
    scorpion: { id: "scorpion", name: "沙漠蠍", lv: 26, hp: 380, ac: -3, dmg: [22, 36], exp: 360, gold: [50, 100], icon: "🦂" },
    lizard: { id: "lizard", name: "蜥蜴人", lv: 30, hp: 480, ac: -4, dmg: [26, 42], exp: 460, gold: [70, 130], icon: "🦎" },
    drake: { id: "drake", name: "飛龍", lv: 36, hp: 720, ac: -6, dmg: [34, 56], exp: 700, gold: [110, 200], icon: "🐉" },
    gargoyle: { id: "gargoyle", name: "石像鬼", lv: 40, hp: 900, ac: -8, dmg: [40, 64], exp: 920, gold: [140, 260], icon: "🗿" },
    deathk: { id: "deathk", name: "死亡騎士", lv: 46, hp: 1400, ac: -10, dmg: [50, 80], exp: 1400, gold: [220, 400], icon: "⚔️" },
    balrog: { id: "balrog", name: "巴風特", lv: 52, hp: 2200, ac: -12, dmg: [64, 100], exp: 2200, gold: [360, 620], icon: "😈" },
    ancient: { id: "ancient", name: "遠古巨龍", lv: 58, hp: 3600, ac: -15, dmg: [80, 130], exp: 3800, gold: [600, 1100], icon: "🐲" },
  };

  const drops = {
    fox: [{ id: "red", p: 0.35, n: [1, 2] }, { id: "ssword", p: 0.04 }, { id: "hide", p: 0.4, n: [1, 2] }],
    orc: [{ id: "red", p: 0.4, n: [1, 3] }, { id: "leather", p: 0.06 }, { id: "club", p: 0.05 }, { id: "bone", p: 0.28, n: [1, 2] }],
    kobold: [{ id: "red", p: 0.4 }, { id: "cap", p: 0.08 }, { id: "bsword", p: 0.04 }, { id: "ore", p: 0.12 }],
    gnoll: [{ id: "orange", p: 0.18 }, { id: "ringmail", p: 0.05 }, { id: "scimitar", p: 0.04 }, { id: "hide", p: 0.3, n: [1, 3] }],
    skeleton: [{ id: "orange", p: 0.22 }, { id: "ihelm", p: 0.05 }, { id: "scroll_w", p: 0.03 }, { id: "bone", p: 0.45, n: [1, 3] }],
    zombie: [{ id: "blue", p: 0.25 }, { id: "cloak1", p: 0.08 }, { id: "scroll_a", p: 0.03 }, { id: "bone", p: 0.3 }],
    wolfman: [{ id: "lbow", p: 0.05 }, { id: "ring_str", p: 0.04 }, { id: "orange", p: 0.25 }, { id: "hide", p: 0.4, n: [1, 3] }],
    ghoul: [{ id: "katana", p: 0.03 }, { id: "amu1", p: 0.05 }, { id: "scroll_w", p: 0.05 }, { id: "gem", p: 0.06 }],
    ant: [{ id: "scale", p: 0.04 }, { id: "belt1", p: 0.06 }, { id: "orange", p: 0.3 }, { id: "ore", p: 0.22, n: [1, 2] }],
    scorpion: [{ id: "xbow", p: 0.04 }, { id: "ring_mr", p: 0.05 }, { id: "scroll_a", p: 0.06 }, { id: "gem", p: 0.08 }],
    lizard: [{ id: "claymore", p: 0.03 }, { id: "crystal", p: 0.03 }, { id: "clear", p: 0.12 }, { id: "ore", p: 0.2 }],
    drake: [{ id: "dhelm", p: 0.05 }, { id: "elvenbow", p: 0.03 }, { id: "scroll_b", p: 0.02 }, { id: "scale_mat", p: 0.12 }],
    gargoyle: [{ id: "plate", p: 0.04 }, { id: "archstaff", p: 0.03 }, { id: "ring_imm", p: 0.03 }, { id: "gem", p: 0.12 }],
    deathk: [{ id: "dsword", p: 0.04 }, { id: "crystalarm", p: 0.03 }, { id: "scroll_b", p: 0.05 }, { id: "gem", p: 0.15 }],
    balrog: [{ id: "archrobe", p: 0.05 }, { id: "amu3", p: 0.02 }, { id: "belt2", p: 0.04 }, { id: "scale_mat", p: 0.18 }],
    ancient: [{ id: "excal", p: 0.03 }, { id: "moonbow", p: 0.03 }, { id: "starstaff", p: 0.03 }, { id: "scale_mat", p: 0.28, n: [1, 2] }],
  };

  const maps = [
    { id: "talking", name: "說話之島", cat: "field", region: "亞丁大陸", rec: 1, bg: "forest", monsters: ["fox", "orc", "kobold"] },
    { id: "gludio", name: "古魯丁", cat: "field", region: "亞丁大陸", rec: 8, bg: "glade", monsters: ["gnoll", "skeleton", "zombie"] },
    { id: "wood", name: "風木", cat: "field", region: "亞丁大陸", rec: 16, bg: "forest", monsters: ["wolfman", "ghoul", "skeleton"] },
    { id: "desert", name: "沙漠", cat: "field", region: "亞丁大陸", rec: 22, bg: "desert", monsters: ["ant", "scorpion", "lizard"] },
    { id: "dragonv", name: "龍之谷", cat: "field", region: "懲罰之地", rec: 34, bg: "volcano", monsters: ["drake", "lizard", "gargoyle"] },
    { id: "mine", name: "廢棄礦坑", cat: "dungeon", region: "地監", rec: 10, bg: "dungeon", monsters: ["kobold", "skeleton", "gnoll"] },
    { id: "antnest", name: "蟻穴", cat: "dungeon", region: "地監", rec: 24, bg: "dungeon", monsters: ["ant", "scorpion", "ghoul"] },
    { id: "ivory", name: "象牙塔", cat: "dungeon", region: "地監", rec: 38, bg: "tower", monsters: ["gargoyle", "deathk", "drake"] },
    { id: "toi", name: "傲慢之塔", cat: "dungeon", region: "地監", rec: 48, bg: "tower", monsters: ["deathk", "balrog", "gargoyle"] },
    { id: "wb1", name: "死亡騎士", cat: "boss", region: "世界王", rec: 40, bg: "boss", monsters: ["deathk"], boss: true, respawn: 180 },
    { id: "wb2", name: "巴風特", cat: "boss", region: "世界王", rec: 50, bg: "boss", monsters: ["balrog"], boss: true, respawn: 300 },
    { id: "wb3", name: "遠古巨龍", cat: "boss", region: "世界王", rec: 55, bg: "dragon", monsters: ["ancient"], boss: true, respawn: 480 },
  ];

  const npcs = [
    { id: "shop", name: "雜貨商", desc: "藥水與卷軸", stock: ["red", "orange", "clear", "blue", "wisdom", "scroll_w", "scroll_a"] },
    { id: "weapon", name: "武器商人", desc: "各職業武器", stock: ["ssword", "bsword", "bow", "wand", "scimitar", "lbow", "staff"] },
    { id: "armor", name: "防具商人", desc: "防具與盾", stock: ["leather", "ringmail", "robe", "buckler", "cloak1", "gloves1", "boots1"] },
    { id: "smith", name: "鐵匠", desc: "強化裝備", kind: "smith" },
    { id: "trainer", name: "導師", desc: "確認已學會的技能", kind: "trainer" },
    { id: "wh", name: "倉庫管理員", desc: "存放多餘物品", kind: "warehouse" },
    { id: "tele", name: "傳送師", desc: "快速前往狩獵場", kind: "tele" },
  ];

  const shopBuy = ["red", "orange", "clear", "blue", "wisdom", "scroll_w", "scroll_a", "scroll_b"];

  const names = {
    knight: { m: ["鋼心", "雷恩", "布拉德", "高文"], f: ["莉亞", "艾琳", "希薇", "瑪格"] },
    elf: { m: ["瑟里昂", "法恩", "林恩", "伊歐"], f: ["席琳", "月華", "艾莉", "薇拉"] },
    mage: { m: ["奧丁", "墨丘", "卡恩", "澤斯"], f: ["摩拉", "星紗", "伊西斯", "露娜"] },
  };

  const marqueePool = [
    "系統：歡迎來到放置亞丁。掛機、衝裝、掉寶，經典迴圈。",
    "傳聞：傲慢之塔上層有人看見遠古的光。",
    "鐵匠：祝福卷軸比一般卷軸更不容易讓裝備消失。",
    "冒險者：沙漠的蠍子會掉抗魔戒指。",
    "血盟募集中：一起打世界王，傷害有排名。",
  ];

  return { R, classes, skills, slots, items, monsters, drops, maps, npcs, shopBuy, names, marqueePool };
})();

window.Engine = (() => {
  const { classes, skills, items, monsters, drops, maps, transforms, elfElements, elfElemNames, enchant: ENCH } = DATA;
  const SPIRIT_TREES = new Set(elfElements || ["fire", "water", "wind", "earth"]);
  const ENCHANT_SAFE = ENCH?.safeMax ?? 6;
  const ENCHANT_MAX = ENCH?.maxPlus ?? 10;

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const xpNeed = (lv) => Math.floor(80 * Math.pow(lv, 2.15));

  const STR_HIT = [
    -2, -2, -2, -2, -2, -2, -2,
    -2, -1, -1, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6,
    7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12,
    13, 13, 13, 14, 14, 14, 15, 15, 15, 16, 16, 16, 17, 17, 17,
  ];
  const DEX_HIT = [
    -2, -2, -2, -2, -2, -2, -1, -1, 0, 0,
    1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    17, 18, 19, 19, 19, 20, 20, 20, 21, 21, 21, 22, 22, 22, 23,
    23, 23, 24, 24, 24, 25, 25, 25, 26, 26, 26, 27, 27, 27, 28,
  ];
  const STR_DMG = (() => {
    const t = new Array(128);
    let dmg = -6;
    for (let str = 0; str <= 22; str++) {
      if (str % 2 === 1) dmg++;
      t[str] = dmg;
    }
    for (let str = 23; str <= 28; str++) {
      if (str % 3 === 2) dmg++;
      t[str] = dmg;
    }
    for (let str = 29; str <= 32; str++) {
      if (str % 2 === 1) dmg++;
      t[str] = dmg;
    }
    for (let str = 33; str <= 34; str++) {
      dmg++;
      t[str] = dmg;
    }
    for (let str = 35; str <= 127; str++) {
      if (str % 4 === 1) dmg++;
      t[str] = dmg;
    }
    return t;
  })();
  const DEX_DMG = (() => {
    const t = new Array(128);
    for (let dex = 0; dex <= 14; dex++) t[dex] = 0;
    t[15] = 1; t[16] = 2; t[17] = 3;
    t[18] = 4; t[19] = 4; t[20] = 4;
    t[21] = 5; t[22] = 5; t[23] = 5;
    let dmg = 5;
    for (let dex = 24; dex <= 35; dex++) {
      if (dex % 3 === 1) dmg++;
      t[dex] = dmg;
    }
    for (let dex = 36; dex <= 127; dex++) {
      if (dex % 4 === 1) dmg++;
      t[dex] = dmg;
    }
    return t;
  })();

  function tbl(stat, table, asIndex1) {
    const v = Math.floor(Number(stat) || 0);
    if (asIndex1) {
      const i = clamp(v, 1, table.length) - 1;
      return table[i];
    }
    return table[clamp(v, 0, table.length - 1)];
  }
  function strHitBonus(str) { return tbl(str, STR_HIT, true); }
  function dexHitBonus(dex) { return tbl(dex, DEX_HIT, true); }
  function strDmgBonus(str) { return tbl(str, STR_DMG, false); }
  function dexDmgBonus(dex) { return tbl(dex, DEX_DMG, false); }
  function dexAcBonus(dex) {
    const d = clamp(Math.floor(dex), 0, 127);
    if (d <= 9) return 0;
    return -Math.floor((d - 6) / 3);
  }
  function wisMrBonus(wis) {
    const w = clamp(Math.floor(wis), 0, 127);
    if (w <= 9) return 0;
    return Math.floor((w - 8) / 2);
  }
  function intSpBonus(intel) {
    const n = clamp(Math.floor(intel), 0, 127);
    if (n < 12) return 0;
    if (n <= 16) return Math.floor((n - 10) / 2);
    return 3 + Math.floor((n - 16) / 4);
  }
  function classTrueSp(classId, level) {
    const lv = Math.max(1, level || 1);
    if (classId === "mage") return Math.floor(lv / 4);
    if (classId === "elf") return Math.floor(lv / 8);
    return Math.floor(lv / 50);
  }
  function classBaseMr(classId) {
    if (classId === "mage") return 15;
    if (classId === "elf") return 15;
    return 10;
  }
  function acDefenseDiv(classId) {
    if (classId === "knight") return 2;
    if (classId === "elf") return 3;
    return 5;
  }

  function instFrom(id, extra = {}) {
    const base = items[id];
    if (!base) return null;
    return {
      iid: uid(),
      id,
      plus: extra.plus || 0,
      blessed: !!extra.blessed,
      cursed: !!extra.cursed,
      qty: extra.qty || 1,
    };
  }

  function itemDef(it) {
    return items[it.id];
  }

  function displayName(it) {
    const d = itemDef(it);
    if (!d) return "?";
    const plus = it.plus ? `+${it.plus} ` : "";
    const b = it.blessed ? "祝福的 " : it.cursed ? "詛咒的 " : "";
    return `${b}${plus}${d.name}`;
  }

  function plusMul(plus) {
    return 1 + plus * 0.12 + (plus >= 7 ? (plus - 6) * 0.08 : 0);
  }

  function itemStats(it) {
    const d = itemDef(it);
    if (!d) return { ac: 0, mr: 0, dmin: 0, dmax: 0, hit: 0, hp: 0, mp: 0, str: 0, dex: 0, int: 0, spd: 0, ranged: false };
    const plus = it.plus || 0;
    const isWpn = d.type === "weapon";
    const blessDmg = it.blessed && isWpn ? 1 : 0;
    return {
      ac: (d.ac || 0) - (isWpn ? 0 : plus),
      mr: d.mr || 0,
      dmin: (d.dmin || 0) + (isWpn ? plus + blessDmg : 0),
      dmax: (d.dmax || 0) + (isWpn ? plus + blessDmg : 0),
      hit: (d.hit || 0) + (isWpn ? Math.floor(plus / 2) : 0),
      hp: d.hp || 0,
      mp: d.mp || 0,
      str: d.str || 0,
      dex: d.dex || 0,
      int: d.int || 0,
      spd: d.spd || 0,
      ranged: !!d.ranged,
    };
  }

  function rarityColor(it) {
    const d = itemDef(it);
    if (it?.blessed) return "#7ec8ff";
    if (it?.cursed) return "#ff7a7a";
    return DATA.R[d?.rarity || "common"].color;
  }

  function equippedList(ch) {
    return Object.values(ch.equip || {}).filter(Boolean);
  }

  function totalStats(ch) {
    const cls = classes[ch.classId];
    const add = { hp: 0, mp: 0, ac: 0, mr: 0, hit: 0, str: 0, dex: 0, int: 0, spd: 0 };
    for (const it of equippedList(ch)) {
      const s = itemStats(it);
      for (const k of Object.keys(add)) add[k] += s[k] || 0;
    }
    const str = ch.attrs.str + add.str;
    const dex = ch.attrs.dex + add.dex;
    const con = ch.attrs.con;
    const intel = ch.attrs.int + add.int;
    const wis = ch.attrs.wis;
    const maxHp = Math.floor(ch.level * (con * 2.2 + cls.hp) + 24 + add.hp);
    const maxMp = Math.floor(ch.level * (wis * 1.1 + intel * 0.6 + cls.mp) + 10 + add.mp);
    const ac = 10 + add.ac + dexAcBonus(dex);
    const mr = classBaseMr(ch.classId) + add.mr + wisMrBonus(wis);
    const weapon = ch.equip.weapon ? itemStats(ch.equip.weapon) : { dmin: 1, dmax: 2, hit: 0, spd: 0, ranged: false };
    const ranged = !!weapon.ranged;
    const dmgBonus = ranged ? dexDmgBonus(dex) : strDmgBonus(str);
    const dmin = Math.max(1, (weapon.dmin || 1) + dmgBonus);
    const dmax = Math.max(dmin, (weapon.dmax || 2) + dmgBonus);
    const wgt = weightOf(ch);
    const cap = weightMax(ch);
    const wRatio = cap > 0 ? wgt / cap : 0;
    let wHit = 0;
    if (wRatio > 0.82) wHit = -5;
    else if (wRatio > 0.66) wHit = -3;
    else if (wRatio > 0.5) wHit = -1;
    const hit = ch.level + strHitBonus(str) + dexHitBonus(dex) + add.hit + wHit;
    const er = Math.max(0, Math.floor(dex / 2));
    const sp = classTrueSp(ch.classId, ch.level) + intSpBonus(intel);
    const magHit = Math.max(0, Math.floor(intel / 8));
    const magCoef = 1 + Math.max(1, intel + sp - 12) * 3 / 32;
    const magBase = 8 + Math.floor(ch.level * 0.35) + sp * 2;
    const magMin = Math.max(1, Math.floor((1 + magBase * 0.35) * magCoef));
    const magMax = Math.max(magMin + 1, Math.floor((magBase + 8) * magCoef));
    const atkMs = clamp(1180 - dex * 9 - (weapon.spd || 0) - Math.min(ch.level, 40) * 4, 380, 1600);
    const base = {
      str, dex, con, int: intel, wis, cha: ch.attrs.cha,
      maxHp, maxMp, ac, mr, dmin, dmax, hit, er, sp, magHit, magMin, magMax, magCoef,
      ranged, atkMs, classId: ch.classId, level: ch.level,
    };
    return applyTransform(base, ch);
  }

  function transformDef(id) {
    return transforms && transforms[id];
  }

  function transformDur(ch, tr) {
    return (tr.dur || 120) + Math.floor((ch.attrs?.wis || 10) * 2.5);
  }

  function availableTransforms(ch) {
    if (!transforms) return [];
    return Object.values(transforms).filter((tr) => {
      if (tr.minLv > ch.level) return false;
      if (tr.classes && !tr.classes.includes(ch.classId)) return false;
      return true;
    });
  }

  function canTransform(ch, formId) {
    const tr = transformDef(formId);
    if (!tr) return { ok: false, msg: "未知變身" };
    if (tr.minLv > ch.level) return { ok: false, msg: `需要 Lv.${tr.minLv}` };
    if (tr.classes && !tr.classes.includes(ch.classId)) return { ok: false, msg: "職業不符" };
    if (ch.transform && ch.transform.id === formId) return { ok: false, msg: "已是此型態" };
    const scroll = tr.scroll || "scroll_poly";
    if (countItem(ch, scroll) < 1) {
      const d = items[scroll];
      return { ok: false, msg: `缺少 ${d ? d.name : scroll}` };
    }
    return { ok: true, tr, scroll };
  }

  function rescaleHp(ch, oldMax, newMax) {
    if (!oldMax || oldMax <= 0) {
      ch.hp = newMax;
      return;
    }
    ch.hp = Math.min(newMax, Math.max(1, Math.floor((ch.hp / oldMax) * newMax)));
  }

  function startTransform(ch, formId) {
    const chk = canTransform(ch, formId);
    if (!chk.ok) return chk;
    const { tr, scroll } = chk;
    const oldSt = totalStats({ ...ch, transform: null });
    consumeItem(ch, scroll, 1);
    ch.transform = { id: formId, left: transformDur(ch, tr) };
    const newSt = totalStats(ch);
    rescaleHp(ch, oldSt.maxHp, newSt.maxHp);
    return { ok: true, msg: `變身為 ${tr.name}（${Math.ceil(ch.transform.left)} 秒）`, tr };
  }

  function cancelTransform(ch, silent) {
    if (!ch.transform) return { ok: false, msg: "未變身" };
    const oldSt = totalStats(ch);
    const name = transformDef(ch.transform.id)?.name || "魔物";
    ch.transform = null;
    const newSt = totalStats(ch);
    rescaleHp(ch, oldSt.maxHp, newSt.maxHp);
    return { ok: true, msg: silent ? "" : `解除變身（${name}）` };
  }

  function tickTransform(ch, dt) {
    if (!ch.transform) return false;
    ch.transform.left -= dt;
    if (ch.transform.left <= 0) {
      cancelTransform(ch, true);
      return true;
    }
    return false;
  }

  function applyTransform(st, ch) {
    const tr = ch.transform && transformDef(ch.transform.id);
    if (!tr) return { ...st, transformed: false, canMagic: true };
    const o = { ...st, transformed: true, transformId: tr.id, canMagic: tr.magic !== false };
    o.maxHp = Math.floor(st.maxHp * (tr.hpMul || 1));
    if (tr.ac) o.ac += tr.ac;
    if (tr.mr) o.mr += tr.mr;
    if (tr.hit) o.hit += tr.hit;
    if (tr.er) o.er += tr.er;
    if (tr.dmg) {
      const bonus = Math.floor(ch.level * 0.35);
      o.dmin = Math.max(1, tr.dmg[0] + bonus);
      o.dmax = Math.max(o.dmin, tr.dmg[1] + bonus);
      o.ranged = !!tr.ranged;
    }
    if (tr.haste) o.atkMs = clamp(Math.floor(o.atkMs * tr.haste), 260, 1600);
    return o;
  }

  function karmaName(k) {
    if (k >= 500) return { t: "正義", c: "#7ec8ff" };
    if (k <= -500) return { t: "邪惡", c: "#ff7a7a" };
    return { t: "中立", c: "#d8c8a0" };
  }

  function weightOf(ch) {
    let w = 0;
    for (const it of ch.bag) {
      const d = itemDef(it);
      w += (d?.weight || 1) * (it.qty || 1);
    }
    for (const it of equippedList(ch)) w += itemDef(it)?.weight || 0;
    return w;
  }

  function weightMax(ch) {
    return 40 + ch.attrs.str * 4 + ch.level * 2;
  }

  function newCharacter({ name, classId, gender, attrs, elfElem: pickElem }) {
    const cls = classes[classId];
    const startW =
      classId === "knight" ? "ssword" : classId === "elf" ? "bow" : "wand";
    const startA = classId === "mage" ? "cloth" : "leather";
    const wpn = instFrom(startW);
    const arm = instFrom(startA);
    const helm = instFrom("cap");
    const bag = [
      wpn,
      arm,
      helm,
      instFrom("red", { qty: 40 }),
      instFrom("blue", { qty: classId === "mage" ? 30 : 12 }),
    ];
    const ch = {
      id: uid(),
      name: name.replace(/[<>]/g, "").slice(0, 8),
      classId,
      gender,
      level: 1,
      exp: 0,
      gold: 80,
      karma: 0,
      hp: 1,
      mp: 1,
      attrs: { ...attrs },
      bag,
      equip: {},
      warehouse: [],
      mapId: null,
      hunting: false,
      skills: cls.skills.filter((s) => skills[s] && skillMinLv(skills[s], classId) <= 1),
      elfElem: classId === "elf" ? (pickElem || null) : undefined,
      elfElemSwaps: classId === "elf" ? 0 : undefined,
      clanId: "",
      clanName: "",
      auto: { hp: 0.45, mp: 0.3, junk: ["club", "cap", "cloth"], potHp: true, potMp: true, pots: ["red", "orange", "clear", "blue", "wisdom"], sell: true, skillOff: [] },
      stats: { kills: 0, deaths: 0, enhanceOk: 0, enhanceFail: 0, play: 0 },
      created: Date.now(),
    };
    tryEquip(ch, wpn);
    tryEquip(ch, arm);
    tryEquip(ch, helm);
    const st = totalStats(ch);
    ch.hp = st.maxHp;
    ch.mp = st.maxMp;
    return ch;
  }

  function tryEquip(ch, it) {
    const d = itemDef(it);
    if (!d || !d.slot) return false;
    if (d.classes && !d.classes.includes(ch.classId)) return false;
    if (d.lv > ch.level) return false;
    let slot = d.slot;
    if (slot === "ring1") {
      slot = ch.equip.ring1 ? "ring2" : "ring1";
    }
    const prev = ch.equip[slot];
    if (prev) ch.bag.push(prev);
    ch.equip[slot] = { ...it, qty: 1 };
    removeFromBag(ch, it.iid, 1);
    return true;
  }

  function unequip(ch, slot) {
    const it = ch.equip[slot];
    if (!it) return;
    ch.bag.push(it);
    delete ch.equip[slot];
  }

  function removeFromBag(ch, iid, qty = 1) {
    const i = ch.bag.findIndex((x) => x.iid === iid);
    if (i < 0) return null;
    const it = ch.bag[i];
    if ((it.qty || 1) > qty) {
      it.qty -= qty;
      return { ...it, qty };
    }
    return ch.bag.splice(i, 1)[0];
  }

  function addToBag(ch, it) {
    const d = itemDef(it);
    if (d?.stack) {
      const found = ch.bag.find((x) => x.id === it.id && !x.plus && !x.blessed);
      if (found) {
        found.qty = (found.qty || 1) + (it.qty || 1);
        return found;
      }
    }
    ch.bag.push(it);
    return it;
  }

  function countItem(ch, id) {
    return (ch.bag || []).filter((x) => x.id === id && !x.plus).reduce((n, x) => n + (x.qty || 1), 0);
  }

  function consumeItem(ch, id, n) {
    let left = n;
    for (let i = ch.bag.length - 1; i >= 0 && left > 0; i--) {
      const it = ch.bag[i];
      if (it.id !== id || it.plus) continue;
      const q = it.qty || 1;
      if (q <= left) {
        left -= q;
        ch.bag.splice(i, 1);
      } else {
        it.qty = q - left;
        left = 0;
      }
    }
    return left <= 0;
  }

  function canCraft(ch, rec) {
    if (!rec || ch.gold < rec.gold) return false;
    return (rec.need || []).every(([id, n]) => countItem(ch, id) >= n);
  }

  function craft(ch, rec) {
    if (!canCraft(ch, rec)) return { ok: false, msg: "材料或金幣不足" };
    const out = items[rec.out];
    if (!out) return { ok: false, msg: "未知成品" };
    ch.gold -= rec.gold;
    for (const [id, n] of rec.need) consumeItem(ch, id, n);
    addToBag(ch, instFrom(rec.out, { qty: rec.qty || 1 }));
    return { ok: true, msg: `製作出 ${out.name}` };
  }

  function skillMinLv(sk, classId) {
    if (typeof sk === "string") sk = skills[sk];
    if (!sk) return 99;
    if (sk.minLvBy && classId && sk.minLvBy[classId] != null) return sk.minLvBy[classId];
    return sk.minLv || 1;
  }

  function isSpiritSkill(sid) {
    const sk = skills[sid];
    return !!(sk && SPIRIT_TREES.has(sk.tree));
  }

  function hasBowEquipped(ch) {
    const w = ch?.equip?.weapon;
    if (!w) return false;
    const d = items[w.id];
    return !!(d && d.ranged);
  }

  function canCastSkill(ch, sid) {
    if (!ch) return true;
    const sk = skills[sid];
    if (!sk) return true;
    if (sk.requiresBow && !hasBowEquipped(ch)) return false;
    if (ch.classId !== "elf") return true;
    if (!SPIRIT_TREES.has(sk.tree)) return true;
    return ch.elfElem === sk.tree;
  }

  function inferElfElem(ch) {
    if (ch.classId !== "elf" || ch.elfElem) return;
    const counts = {};
    for (const s of ch.skills || []) {
      const t = skills[s]?.tree;
      if (SPIRIT_TREES.has(t)) counts[t] = (counts[t] || 0) + 1;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (best) ch.elfElem = best[0];
  }

  function migrateElfMagic(ch) {
    if (ch.classId !== "elf") return;
    inferElfElem(ch);
  }

  function elfElemSwitchCost(ch) {
    if (!ch.elfElem) return 0;
    return Math.min(500000, 50000 * ((ch.elfElemSwaps || 0) + 1));
  }

  function setElfElem(ch, elem) {
    if (ch.classId !== "elf") return { ok: false, msg: "只有遊俠能選擇五行屬性" };
    if (!SPIRIT_TREES.has(elem)) return { ok: false, msg: "無效的屬性" };
    if (ch.level < 10) return { ok: false, msg: "需達 Lv.10 才能選擇五行心法屬性" };
    const cost = ch.elfElem && ch.elfElem !== elem ? elfElemSwitchCost(ch) : 0;
    if (cost > 0 && ch.gold < cost) return { ok: false, msg: `需要 ${cost.toLocaleString()} 金幣才能轉換屬性` };
    if (cost > 0) ch.gold -= cost;
    if (ch.elfElem && ch.elfElem !== elem) ch.elfElemSwaps = (ch.elfElemSwaps || 0) + 1;
    ch.elfElem = elem;
    learnPending(ch);
    const label = (elfElemNames && elfElemNames[elem]) || elem;
    return { ok: true, msg: cost > 0 ? `已轉換為${label}屬性（-${cost.toLocaleString()} 金幣）` : `已選擇${label}屬性五行心法` };
  }

  function canLearnSkill(ch, sid) {
    const sk = skills[sid];
    if (!sk || skillMinLv(sk, ch.classId) > ch.level) return false;
    if (ch.classId === "elf" && isSpiritSkill(sid)) {
      if (!ch.elfElem) return false;
      if (sk.tree !== ch.elfElem) return false;
    }
    return true;
  }

  function canLearn(ch) {
    const cls = classes[ch.classId];
    const got = new Set(ch.skills);
    return cls.skills.filter((s) => !got.has(s) && canLearnSkill(ch, s));
  }

  function learnPending(ch) {
    const remap = {
      slash: "bounce", double: "triple", wind: "windshot",
      nova: "meteor", barrier: "reduction", missile: "ebolt", ice: "icelance",
      fireele: "fireweapon", burnstrike: "firedance", aqua: "pollute", ebolt: "lightarrow",
    };
    ch.skills = [...new Set((ch.skills || []).map((s) => remap[s] || s).filter((s) => skills[s]))];
    migrateElfMagic(ch);
    for (const s of canLearn(ch)) ch.skills.push(s);
  }

  function gainExp(ch, n) {
    ch.exp += n;
    let ups = 0;
    while (ch.exp >= xpNeed(ch.level) && ch.level < 99) {
      ch.exp -= xpNeed(ch.level);
      ch.level += 1;
      ups += 1;
      const st = totalStats(ch);
      ch.hp = st.maxHp;
      ch.mp = st.maxMp;
      learnPending(ch);
    }
    return ups;
  }

  function enchantScrollId(it, bless) {
    const d = itemDef(it);
    if (bless) return "scroll_b";
    return d?.type === "weapon" ? "scroll_w" : "scroll_a";
  }

  function enchantScrollLabel(id) {
    if (id === "scroll_w") return "武卷";
    if (id === "scroll_a") return "防卷";
    if (id === "scroll_b") return "祝福武卷";
    return items[id]?.name || "卷軸";
  }

  function enchantRate(plus, bless) {
    if (plus < ENCHANT_SAFE) return 1;
    const idx = plus - ENCHANT_SAFE;
    const table = ENCH?.riskRates || [0.33, 0.22, 0.14, 0.08, 0.04];
    let r = table[Math.min(idx, table.length - 1)] ?? 0.04;
    if (bless) r = Math.min(1, r + (ENCH?.blessRateBonus ?? 0.12));
    return r;
  }

  function enchantVanishRate(plus, bless, itemBlessed) {
    if (plus < ENCHANT_SAFE || bless || itemBlessed) return 0;
    const idx = plus - ENCHANT_SAFE;
    const table = ENCH?.vanishRates || [0.45, 0.55, 0.65, 0.75, 0.85];
    return table[Math.min(idx, table.length - 1)] ?? 0.85;
  }

  function enchantPreview(ch, it, bless) {
    const d = itemDef(it);
    const plus = it.plus || 0;
    const safe = plus < ENCHANT_SAFE;
    const scrollId = enchantScrollId(it, bless);
    const scroll = items[scrollId];
    const protected_ = bless || it.blessed;
    return {
      plus,
      targetPlus: plus + 1,
      safe,
      safeMax: ENCHANT_SAFE,
      rate: enchantRate(plus, bless || it.blessed),
      vanishOnFail: enchantVanishRate(plus, bless, it.blessed),
      scrollId,
      scrollName: scroll?.name || scrollId,
      scrollShort: enchantScrollLabel(scrollId),
      hasScroll: countItem(ch, scrollId) > 0,
      canEnchant: !!(d && (d.type === "weapon" || d.type === "armor" || d.type === "acc") && plus < ENCHANT_MAX),
      protected: protected_,
      isWeapon: d?.type === "weapon",
    };
  }

  function removeItem(ch, it) {
    const slot = Object.keys(ch.equip).find((k) => ch.equip[k]?.iid === it.iid);
    if (slot) delete ch.equip[slot];
    else removeFromBag(ch, it.iid, 1);
  }

  function enchant(ch, it, bless) {
    const d = itemDef(it);
    if (!d || (d.type !== "weapon" && d.type !== "armor" && d.type !== "acc")) {
      return { ok: false, msg: "這件物品無法強化" };
    }
    if ((it.plus || 0) >= ENCHANT_MAX) return { ok: false, msg: `已達強化上限 +${ENCHANT_MAX}` };
    const scrollId = enchantScrollId(it, bless);
    if (!bless && d.type === "weapon" && scrollId !== "scroll_w") {
      return { ok: false, msg: "武器需使用武卷（對武器施法的卷軸）" };
    }
    if (!bless && d.type !== "weapon" && scrollId !== "scroll_a") {
      return { ok: false, msg: "防具需使用防卷（對防具施法的卷軸）" };
    }
    const scroll = ch.bag.find((x) => x.id === scrollId);
    if (!scroll) return { ok: false, msg: `缺少${enchantScrollLabel(scrollId)}` };
    removeFromBag(ch, scroll.iid, 1);

    const plus = it.plus || 0;
    const safe = plus < ENCHANT_SAFE;
    const rate = enchantRate(plus, bless || it.blessed);

    if (safe || Math.random() < rate) {
      it.plus = plus + 1;
      if (bless) it.blessed = true;
      ch.stats.enhanceOk += 1;
      return {
        ok: true,
        vanish: false,
        safe,
        fromPlus: plus,
        toPlus: it.plus,
        msg: safe
          ? `${displayName(it)} 安定強化成功！（+${plus} → +${it.plus}）`
          : `${displayName(it)} 強化成功！（+${plus} → +${it.plus}）`,
      };
    }

    ch.stats.enhanceFail += 1;
    const vanishR = enchantVanishRate(plus, bless, it.blessed);
    if (vanishR > 0 && Math.random() < vanishR) {
      const gone = displayName(it);
      removeItem(ch, it);
      return {
        ok: false,
        vanish: true,
        safe: false,
        fromPlus: plus,
        msg: `💥 強化失敗！${gone} 發出巨響後消失了……（+${plus} → 爆裝）`,
      };
    }
    return {
      ok: false,
      vanish: false,
      safe: false,
      fromPlus: plus,
      msg: `${displayName(it)} 強化失敗，強化值維持 +${plus}。`,
    };
  }

  function sellPrice(it) {
    const d = itemDef(it);
    if (!d) return 0;
    const m = plusMul(it.plus || 0);
    return Math.max(1, Math.floor((d.price || 10) * 0.35 * m * (it.qty || 1)));
  }

  function rollDrops(mid, mul = 1) {
    const list = drops[mid] || [];
    const out = [];
    for (const d of list) {
      if (Math.random() < d.p * mul) {
        const n = d.n ? irand(d.n[0], d.n[1]) : 1;
        const it = instFrom(d.id, { qty: n });
        if (!it) continue;
        const t = items[d.id] && items[d.id].type;
        if (t !== "use" && t !== "mat") {
          if (Math.random() < 0.04) it.blessed = true;
          if (!it.blessed && Math.random() < 0.03) it.cursed = true;
        }
        out.push(it);
      }
    }
    return out;
  }

  function makeMob(map, forcedId) {
    const pool = (map.monsters || []).filter((id) => {
      const def = monsters[id];
      if (!def) return false;
      if (def.worldBoss && !map.boss) return false;
      return true;
    });
    const id = forcedId && monsters[forcedId] ? forcedId : pick(pool);
    const m = monsters[id];
    if (!m) return null;
    if (m.worldBoss && !map.boss) return null;
    let hp = m.hp;
    let maxHp = m.hp;
    if (map.boss) {
      maxHp = m.hp;
      hp = maxHp;
    }
    return {
      uid: uid(),
      id: m.id,
      name: m.name,
      icon: m.icon,
      lv: m.lv,
      hp,
      maxHp,
      ac: m.ac,
      mr: m.mr != null ? m.mr : Math.floor(m.lv * 1.2),
      hit: m.lv,
      dmg: m.dmg,
      exp: map.boss ? 0 : m.exp,
      gold: map.boss ? [0, 0] : m.gold,
      stun: 0,
      tAtk: rand(0.25, 0.9),
      boss: !!map.boss,
    };
  }

  function mrDefense(dmg, mr, magHit = 0) {
    const resist = Math.max(0, Number(mr) || 0);
    let mrFloor;
    let coef;
    if (resist <= 100) {
      mrFloor = Math.floor((resist - magHit) / 2);
      coef = 1 - 0.01 * mrFloor;
    } else {
      mrFloor = Math.floor((resist - magHit) / 10);
      coef = 0.6 - 0.01 * mrFloor;
    }
    return Math.floor(dmg * clamp(coef, 0.1, 1));
  }

  function physHitVsNpc(hit, npcAc) {
    const attackerDice = irand(1, 20) + hit - 10;
    const defenderDice = 10 - npcAc;
    const fumble = hit - 9;
    const critical = hit + 10;
    let rate = 0;
    let crit = false;
    if (attackerDice <= fumble) rate = 0;
    else if (attackerDice >= critical) {
      rate = 100;
      crit = true;
    } else rate = attackerDice > defenderDice ? 100 : 0;
    return { hit: rate >= irand(1, 100), crit };
  }

  function npcHitVsPc(mobHit, pcAc) {
    const attackerDice = irand(1, 20) + mobHit - 1;
    let defenderDice = 10 - pcAc;
    if (pcAc < 0) defenderDice = 10 + irand(1, Math.max(1, -pcAc));
    const fumble = mobHit;
    const critical = mobHit + 19;
    let rate = 0;
    if (attackerDice <= fumble) rate = 0;
    else if (attackerDice >= critical) rate = 100;
    else rate = attackerDice > defenderDice ? 100 : 0;
    return rate >= irand(1, 100);
  }

  function calcPcDefense(st) {
    const acVal = Math.max(0, 10 - st.ac);
    const acDefMax = Math.floor(acVal / acDefenseDiv(st.classId));
    if (acDefMax <= 0) return 0;
    return irand(0, acDefMax);
  }

  function applyCombatBuffs(st, buffs) {
    if (!buffs || !buffs.length) return { ...st, dmgMul: 1, immune: false };
    const o = { ...st, dmgMul: 1, immune: false };
    for (const b of buffs) {
      if (b.ac) o.ac += b.ac;
      if (b.mr) o.mr += b.mr;
      if (b.hit) o.hit += b.hit;
      if (b.er) o.er += b.er;
      if (b.haste) o.atkMs = clamp(Math.floor(o.atkMs * b.haste), 260, 1600);
      if (b.dmgMul) o.dmgMul *= b.dmgMul;
      if (b.immune) o.immune = true;
      if (b.hp) o.maxHp += b.hp;
    }
    return o;
  }

  function playerHit(ch, mob, mul = 1, magic = false, buffs) {
    const st = applyCombatBuffs(totalStats(ch), buffs);
    if (magic) {
      const dice = Math.max(4, Math.round(10 * mul));
      const value = Math.round((4 + st.sp) * mul);
      let dmg = irand(1, dice) + value;
      dmg = Math.floor(dmg * st.magCoef * (st.dmgMul || 1));
      const crit = Math.random() * 100 <= 10;
      if (crit) dmg = Math.floor(dmg * 1.5);
      dmg = mrDefense(dmg, mob.mr || 0, st.magHit);
      return { miss: false, dmg: Math.max(1, dmg), crit };
    }
    const roll = physHitVsNpc(st.hit, mob.ac);
    if (!roll.hit) return { miss: true, dmg: 0, crit: false };
    let dmg = irand(st.dmin, st.dmax);
    dmg = Math.floor(dmg * mul * (st.dmgMul || 1));
    if (roll.crit) dmg = Math.floor(dmg * 1.5);
    return { miss: false, dmg: Math.max(1, dmg), crit: roll.crit };
  }

  function mobHit(ch, mob, buffs) {
    const st = applyCombatBuffs(totalStats(ch), buffs);
    if (st.immune) return { miss: true, dmg: 0, immune: true };
    if (!npcHitVsPc(mob.hit != null ? mob.hit : mob.lv, st.ac)) return { miss: true, dmg: 0 };
    if (irand(1, 100) <= st.er) return { miss: true, dmg: 0 };
    let dmg = irand(mob.dmg[0], mob.dmg[1]);
    dmg -= calcPcDefense(st);
    return { miss: false, dmg: Math.max(1, Math.floor(dmg)) };
  }

  function autoPotions(ch) {
    const a = ch.auto || {};
    const allow = new Set(a.pots || ["red", "orange", "clear", "blue", "wisdom"]);
    const st = totalStats(ch);
    const logs = [];
    const take = (ids) => ids.filter((id) => allow.has(id)).map((id) => ch.bag.find((x) => x.id === id)).find(Boolean);
    if (a.potHp !== false && ch.hp / st.maxHp < (a.hp || 0.45)) {
      const pot = take(["clear", "orange", "red"]);
      if (pot) {
        const d = itemDef(pot);
        ch.hp = Math.min(st.maxHp, ch.hp + d.hp);
        removeFromBag(ch, pot.iid, 1);
        logs.push(`使用 ${d.name}，HP ${ch.hp}/${st.maxHp}`);
      }
    }
    if (a.potMp !== false && ch.mp / st.maxMp < (a.mp || 0.3)) {
      const pot = take(["wisdom", "blue"]);
      if (pot) {
        const d = itemDef(pot);
        ch.mp = Math.min(st.maxMp, ch.mp + d.mp);
        removeFromBag(ch, pot.iid, 1);
        logs.push(`使用 ${d.name}，MP ${ch.mp}/${st.maxMp}`);
      }
    }
    return logs;
  }

  function autoSellJunk(ch) {
    if (ch.auto && ch.auto.sell === false) return 0;
    const junk = new Set(ch.auto.junk || []);
    let gold = 0;
    const keep = [];
    for (const it of ch.bag) {
      if (junk.has(it.id) && !(it.plus > 0) && !it.blessed) {
        gold += sellPrice(it);
      } else keep.push(it);
    }
    if (gold) {
      ch.bag = keep;
      ch.gold += gold;
    }
    return gold;
  }

  function applyOffline(ch, seconds) {
    if (!ch.hunting || !ch.mapId) return null;
    const map = maps.find((m) => m.id === ch.mapId);
    if (!map || map.boss) return null;
    const cap = Math.min(seconds, 8 * 3600);
    const st = totalStats(ch);
    const cycles = Math.floor(cap / ((st.atkMs + 900) / 1000));
    const avgMob = monsters[map.monsters[0]];
    let exp = 0, gold = 0, kills = 0;
    const loot = [];
    const n = Math.min(cycles, 800);
    for (let i = 0; i < n; i++) {
      const mid = pick(map.monsters);
      const m = monsters[mid];
      if (!m) continue;
      if (st.dmax * 8 < m.hp && ch.level + 8 < m.lv) continue;
      exp += m.exp;
      gold += irand(m.gold[0], m.gold[1]);
      kills += 1;
      for (const it of rollDrops(mid, 0.85)) loot.push(it);
    }
    const ups = gainExp(ch, Math.floor(exp * 0.7));
    ch.gold += Math.floor(gold * 0.7);
    ch.stats.kills += kills;
    for (const it of loot.slice(0, 40)) addToBag(ch, it);
    ch.hp = Math.max(1, Math.floor(st.maxHp * 0.6));
    return { seconds: cap, kills, exp: Math.floor(exp * 0.7), gold: Math.floor(gold * 0.7), ups, loot: loot.length };
  }

  return {
    uid, rand, irand, pick, clamp, xpNeed, instFrom, itemDef, displayName,
    itemStats, rarityColor, totalStats, karmaName, weightOf, weightMax,
    newCharacter, tryEquip, unequip, removeFromBag, addToBag, gainExp,
    countItem, consumeItem, canCraft, craft,
    enchant, sellPrice, rollDrops, makeMob, playerHit, mobHit,
    autoPotions, autoSellJunk, applyOffline, equippedList, canLearn, learnPending,
    enchantRate, enchantVanishRate, enchantPreview, enchantScrollLabel, enchantScrollId,
    applyCombatBuffs, skillMinLv, isSpiritSkill, canCastSkill, hasBowEquipped, setElfElem, elfElemSwitchCost,
    transformDef, availableTransforms, canTransform, startTransform, cancelTransform, tickTransform,
  };
})();

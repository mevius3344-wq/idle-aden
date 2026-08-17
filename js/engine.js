window.Engine = (() => {
  const { classes, skills, items, monsters, drops, maps } = DATA;

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const xpNeed = (lv) => Math.floor(80 * Math.pow(lv, 2.15));

  function strBonus(str) {
    if (str < 10) return 0;
    return Math.floor((str - 8) / 2);
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
    if (!d) return { ac: 0, mr: 0, dmin: 0, dmax: 0, hit: 0, hp: 0, mp: 0, str: 0, dex: 0, int: 0 };
    const m = plusMul(it.plus || 0);
    const bless = it.blessed ? 1.08 : it.cursed ? 1.12 : 1;
    return {
      ac: Math.round((d.ac || 0) * m * (it.cursed ? 1.15 : 1)),
      mr: Math.round((d.mr || 0) * m),
      dmin: Math.round((d.dmin || 0) * m * bless),
      dmax: Math.round((d.dmax || 0) * m * bless),
      hit: d.hit || 0,
      hp: d.hp || 0,
      mp: d.mp || 0,
      str: d.str || 0,
      dex: d.dex || 0,
      int: d.int || 0,
      spd: d.spd || 0,
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
    const add = { hp: 0, mp: 0, ac: 0, mr: 0, dmin: 0, dmax: 0, hit: 0, str: 0, dex: 0, int: 0, spd: 0 };
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
    const ac = add.ac - Math.floor(dex / 4);
    const mr = add.mr + Math.floor(wis / 2);
    const weapon = ch.equip.weapon ? itemStats(ch.equip.weapon) : { dmin: 1, dmax: 3, hit: 2, spd: 0 };
    const dmin = Math.max(1, Math.round((weapon.dmin + strBonus(str)) * cls.atk));
    const dmax = Math.max(dmin + 1, Math.round((weapon.dmax + strBonus(str) + 1) * cls.atk));
    const hit = 68 + dex + (weapon.hit || 0);
    const atkMs = clamp(1180 - dex * 9 - (weapon.spd || 0) - Math.min(ch.level, 40) * 4, 380, 1600);
    return { str, dex, con, int: intel, wis, cha: ch.attrs.cha, maxHp, maxMp, ac, mr, dmin, dmax, hit, atkMs };
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

  function newCharacter({ name, classId, gender, attrs }) {
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
      skills: cls.skills.filter((s) => skills[s].minLv <= 1),
      auto: { hp: 0.45, mp: 0.3, junk: ["club", "cap", "cloth"] },
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

  function canLearn(ch) {
    const cls = classes[ch.classId];
    const got = new Set(ch.skills);
    return cls.skills.filter((s) => !got.has(s) && skills[s].minLv <= ch.level);
  }

  function learnPending(ch) {
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

  function enchantRate(plus, bless) {
    const table = [1, 0.95, 0.85, 0.7, 0.55, 0.4, 0.32, 0.22, 0.14, 0.08, 0.04];
    let r = table[Math.min(plus, table.length - 1)];
    if (bless) r = Math.min(1, r + 0.12);
    return r;
  }

  function enchant(ch, it, bless) {
    const d = itemDef(it);
    if (!d || (d.type !== "weapon" && d.type !== "armor" && d.type !== "acc")) {
      return { ok: false, msg: "這件物品無法強化" };
    }
    if (it.plus >= 10) return { ok: false, msg: "已達強化上限 +10" };
    const need = bless ? "scroll_b" : d.type === "weapon" ? "scroll_w" : "scroll_a";
    const scroll = ch.bag.find((x) => x.id === need);
    if (!scroll) return { ok: false, msg: "缺少對應強化卷軸" };
    removeFromBag(ch, scroll.iid, 1);
    const rate = enchantRate(it.plus, bless || it.blessed);
    if (Math.random() < rate) {
      it.plus += 1;
      if (bless) it.blessed = true;
      ch.stats.enhanceOk += 1;
      return { ok: true, vanish: false, msg: `${displayName(it)} 強化成功！` };
    }
    ch.stats.enhanceFail += 1;
    if (it.plus >= 7 && !bless && Math.random() < 0.55) {
      const slot = Object.keys(ch.equip).find((k) => ch.equip[k]?.iid === it.iid);
      if (slot) delete ch.equip[slot];
      else removeFromBag(ch, it.iid, 1);
      return { ok: false, vanish: true, msg: `${displayName(it)} 強化失敗，裝備消失了！` };
    }
    if (it.plus >= 6 && Math.random() < 0.4) {
      it.plus = Math.max(0, it.plus - 1);
      return { ok: false, vanish: false, msg: `強化失敗，強化值下降。` };
    }
    return { ok: false, vanish: false, msg: "強化失敗。" };
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
        if (Math.random() < 0.04) it.blessed = true;
        if (!it.blessed && Math.random() < 0.03) it.cursed = true;
        if (items[d.id] && items[d.id].type !== "use" && Math.random() < 0.08) it.plus = irand(1, 3);
        out.push(it);
      }
    }
    return out;
  }

  function makeMob(map) {
    const id = pick(map.monsters);
    const m = monsters[id];
    const hpMul = map.boss ? 8 : 1;
    return {
      id: m.id,
      name: m.name,
      icon: m.icon,
      lv: m.lv,
      hp: Math.floor(m.hp * hpMul),
      maxHp: Math.floor(m.hp * hpMul),
      ac: m.ac,
      dmg: m.dmg,
      exp: map.boss ? m.exp * 6 : m.exp,
      gold: m.gold,
      stun: 0,
      boss: !!map.boss,
    };
  }

  function hitChance(atkHit, defAc) {
    return clamp((atkHit - defAc * 2) / 100, 0.18, 0.95);
  }

  function playerHit(ch, mob, mul = 1, magic = false) {
    const st = totalStats(ch);
    const chance = magic ? clamp((st.int + st.wis + 40) / 100, 0.4, 0.96) : hitChance(st.hit, mob.ac);
    if (Math.random() > chance) return { miss: true, dmg: 0 };
    let dmg;
    if (magic) {
      dmg = Math.floor((st.int * 1.4 + st.wis * 0.6 + ch.level) * mul * rand(0.85, 1.15));
      dmg = Math.floor(dmg * (1 - mob.ac / 80));
    } else {
      dmg = irand(st.dmin, st.dmax);
      dmg = Math.floor(dmg * mul * rand(0.9, 1.12));
      dmg = Math.max(1, dmg - Math.max(0, -mob.ac));
    }
    const crit = Math.random() < 0.06 + st.dex / 400;
    if (crit) dmg = Math.floor(dmg * 1.65);
    return { miss: false, dmg: Math.max(1, dmg), crit };
  }

  function mobHit(ch, mob) {
    const st = totalStats(ch);
    if (Math.random() > hitChance(50 + mob.lv, st.ac)) return { miss: true, dmg: 0 };
    let dmg = irand(mob.dmg[0], mob.dmg[1]);
    dmg = Math.max(1, dmg - Math.max(0, -st.ac) * 0.4);
    dmg = Math.floor(dmg * (1 - Math.min(0.45, st.mr / 220)));
    return { miss: false, dmg: Math.max(1, Math.floor(dmg)) };
  }

  function autoPotions(ch) {
    const st = totalStats(ch);
    const logs = [];
    if (ch.hp / st.maxHp < (ch.auto.hp || 0.45)) {
      const pot = ["clear", "orange", "red"].map((id) => ch.bag.find((x) => x.id === id)).find(Boolean);
      if (pot) {
        const d = itemDef(pot);
        ch.hp = Math.min(st.maxHp, ch.hp + d.hp);
        removeFromBag(ch, pot.iid, 1);
        logs.push(`使用 ${d.name}，HP ${ch.hp}/${st.maxHp}`);
      }
    }
    if (ch.mp / st.maxMp < (ch.auto.mp || 0.3)) {
      const pot = ["wisdom", "blue"].map((id) => ch.bag.find((x) => x.id === id)).find(Boolean);
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
    enchant, sellPrice, rollDrops, makeMob, playerHit, mobHit,
    autoPotions, autoSellJunk, applyOffline, equippedList, canLearn, learnPending,
    enchantRate,
  };
})();

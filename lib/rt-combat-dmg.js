/**
 * 🌐 P3 伺服器傷害公式（角色戰鬥快照）
 * - 不採信客戶端每擊 dmg
 * - 客戶端上傳 clamp 後的戰鬥屬性；伺服器自行擲骰
 */
"use strict";

function clampInt(v, lo, hi, fallback) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

function roll(lo, hi) {
  const a = Math.max(1, Math.floor(Number(lo) || 1));
  const b = Math.max(a, Math.floor(Number(hi) || a));
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** 淨化客戶端戰鬥快照（可虛報但有上下限） */
function sanitizeCombatSnap(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  return {
    lv: clampInt(s.lv, 1, 99, 1),
    diceMax: clampInt(s.diceMax, 1, 300, 2),
    hitBonus: clampInt(s.hitBonus, -80, 250, 0),
    dmgBonus: clampInt(s.dmgBonus, -80, 800, 0),
    extraDmg: clampInt(s.extraDmg, 0, 500, 0),
    critRate: clampInt(s.critRate, 0, 100, 0),
    critDmg: clampInt(s.critDmg, 0, 500, 100),
    ranged: !!s.ranged,
    magicDice: clampInt(s.magicDice, 1, 300, 8),
    magicDmg: clampInt(s.magicDmg, -80, 800, 0),
    magicCrit: clampInt(s.magicCrit, 0, 100, 0),
    magicCritDmg: clampInt(s.magicCritDmg, 0, 500, 100),
    aspdMs: clampInt(s.aspdMs, 80, 5000, 400),
    at: Date.now(),
  };
}

function stretchHitExpected(raw) {
  if (raw >= 8) return Math.min(20, raw);
  const e = Math.min(30, 8 - raw);
  const frac = e / 30;
  const h = 2 * frac - frac * frac;
  return 8 - 7 * h;
}

function stretchHitValue(raw) {
  const hv = stretchHitExpected(raw);
  const lo = Math.floor(hv);
  return lo + (Math.random() < hv - lo ? 1 : 0);
}

/**
 * @param {object} combat sanitizeCombatSnap 結果
 * @param {object} mobDef { lv, ac, dr, hardSkin, er }
 * @param {string} [kind] phys|magic
 */
function rollDamage(combat, mobDef, kind) {
  const c = combat && combat.diceMax != null ? combat : sanitizeCombatSnap(combat);
  const mob = mobDef || {};
  const mobLv = clampInt(mob.lv, 1, 200, 1);
  const ac = clampInt(mob.ac, -50, 80, 10);
  const dr = clampInt(mob.dr, 0, 200, 0);
  const hardSkin = clampInt(mob.hardSkin, 0, 200, 0);
  const er = clampInt(mob.er, 0, 100, 0);
  const k = String(kind || "phys");

  // 怪物迴避
  if (er > 0 && Math.random() * 100 < er) {
    return { dmg: 0, hit: false, crit: false, heavy: false, graze: false, miss: "er", kind: k };
  }

  if (k === "magic") {
    const rollHit = roll(1, 20);
    // 簡化魔法命中：lv + magicDmg/4 - mobLv + ac/2
    let hitValue = Math.floor(c.lv + c.magicDmg / 4 - mobLv + ac / 2);
    hitValue = Math.max(1, Math.min(20, stretchHitValue(hitValue)));
    if (rollHit === 1) {
      return { dmg: 0, hit: false, crit: false, heavy: false, graze: false, miss: "roll", kind: k };
    }
    if (rollHit !== 20 && hitValue < rollHit) {
      return { dmg: 0, hit: false, crit: false, heavy: false, graze: false, miss: "roll", kind: k };
    }
    const heavy = rollHit === 20;
    const weaponRoll = heavy ? c.magicDice : roll(1, c.magicDice);
    const isCrit = Math.random() * 100 < c.magicCrit;
    const critMult = isCrit ? 1 + c.magicCritDmg / 100 : 1;
    let inner = Math.floor((weaponRoll + c.magicDmg) * critMult) + c.extraDmg - Math.floor(dr / 2);
    inner = Math.max(1, inner);
    return {
      dmg: Math.min(50000, inner),
      hit: true,
      crit: isCrit,
      heavy: heavy,
      graze: false,
      kind: k,
    };
  }

  // 物理（對齊客戶端 getPhysicalDmg 骨架）
  const rollHit = roll(1, 20);
  let rawHit = c.lv + c.hitBonus - mobLv + ac;
  let hitValue = stretchHitValue(rawHit);
  hitValue = Math.max(1, Math.min(20, hitValue));
  // soft floor：hitBonus 高時略抬
  if (c.hitBonus >= 20) hitValue = Math.max(hitValue, 4);

  let hit = false;
  let heavy = false;
  let graze = false;
  if (rollHit === 20) {
    hit = true;
    heavy = true;
  } else if (rollHit === 1) {
    hit = false;
  } else if (hitValue >= rollHit) {
    hit = true;
  } else if (rollHit === 19) {
    hit = true;
    graze = true;
  }

  if (!hit) {
    return { dmg: 0, hit: false, crit: false, heavy: false, graze: false, miss: "roll", kind: "phys" };
  }

  const isCrit = !graze && Math.random() * 100 < c.critRate;
  const critMult = isCrit ? 1 + c.critDmg / 100 : 1;
  const weaponRoll = heavy ? c.diceMax : roll(1, c.diceMax);
  let inner = Math.floor((weaponRoll + c.dmgBonus) * critMult) + c.extraDmg - (dr + hardSkin);
  inner = Math.max(1, inner);
  if (graze) inner = Math.max(1, Math.floor(inner * 0.5));

  return {
    dmg: Math.min(50000, inner),
    hit: true,
    crit: isCrit,
    heavy: heavy,
    graze: graze,
    kind: "phys",
  };
}

function mobDefFromRow(mob) {
  if (!mob) return { lv: 1, ac: 10, dr: 0, hardSkin: 0, er: 0 };
  const tpl = mob.tpl || {};
  return {
    lv: clampInt(mob.lv != null ? mob.lv : tpl.lv, 1, 200, 1),
    ac: clampInt(mob.ac != null ? mob.ac : tpl.ac, -50, 80, 10),
    dr: clampInt(mob.dr != null ? mob.dr : tpl.dr, 0, 200, 0),
    hardSkin: clampInt(mob.hardSkin != null ? mob.hardSkin : tpl.hardSkin, 0, 200, 0),
    er: clampInt(mob.er != null ? mob.er : tpl.er, 0, 100, 0),
  };
}

module.exports = {
  sanitizeCombatSnap,
  rollDamage,
  mobDefFromRow,
  clampInt,
};

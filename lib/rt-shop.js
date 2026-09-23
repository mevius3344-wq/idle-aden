/**
 * 🌐 P5a/P5b 商店價目／購買／販售（伺服器權威）
 */
"use strict";

const path = require("path");
const crypto = require("crypto");
const {
  normSlot,
  goldOf,
  walletRevOf,
  applyDebitGold,
  applyCreditGold,
  applyRemoveInv,
  sqlMutateSlot,
} = require("./rt-cloud-wallet");

const BUNDLE = {
  wpn_5: { unit: 100, amount: 1000 },
  wpn_22: { unit: 200, amount: 1000 },
};

/** 賣價＝定價 30%（與客戶端 getSellPrice 一致） */
const SELL_RATE = 0.3;
const SELL_BATCH_MAX = 80;

let _prices = null;
function loadPrices() {
  if (_prices) return _prices;
  try {
    _prices = require("./shop-prices-data.json");
  } catch (e) {
    _prices = {};
  }
  return _prices;
}

let _nosell = null;
function loadNosell() {
  if (_nosell) return _nosell;
  try {
    _nosell = require("./shop-nosell-data.json");
  } catch (e) {
    _nosell = {};
  }
  return _nosell;
}

function isNosellId(itemId) {
  const id = String(itemId || "");
  return !!(loadNosell()[id]);
}

/**
 * 單件賣價（含詞綴疊乘）：對齊客戶端 getSellPrice
 * @param {{ id: string, attr?: any, bless?: any, anc?: any, rental?: any, expireAt?: any, lock?: any }} it
 */
function sellUnitOf(it) {
  if (!it || !it.id) return { ok: false, error: "bad_item" };
  if (it.lock) return { ok: false, error: "locked", message: "鎖定物品無法販售。" };
  if (it.rental || Number(it.expireAt) > 0) {
    return { ok: false, error: "rental", message: "限時裝備無法販售。" };
  }
  const id = String(it.id || "").slice(0, 64);
  if (isNosellId(id)) {
    return { ok: false, error: "no_sell", message: "此物品無法販售。" };
  }
  const base = unitPriceOf(id);
  if (base == null) {
    return { ok: false, error: "unknown_item", message: "此物品尚無伺服器價目，無法販售。" };
  }
  if (base <= 0) {
    return { ok: false, error: "no_sell", message: "此物品無法販售。" };
  }
  let price = Math.floor(base * SELL_RATE);
  if (base > 0 && price < 1) price = 1;
  let mult = 1;
  // 屬性詞綴：非空且非 false
  if (it.attr && it.attr !== false && it.attr !== "false") mult *= 10;
  if (it.bless === true) mult *= 10;
  if (it.anc) mult *= 10;
  const unit = price * mult;
  return { ok: true, itemId: id, unit: unit, base: base };
}

function newUid() {
  return "s" + Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
}

function unitPriceOf(itemId) {
  const id = String(itemId || "").slice(0, 64);
  if (BUNDLE[id]) return BUNDLE[id].unit;
  const table = loadPrices();
  const p = table[id];
  if (p == null) return null;
  return Math.max(0, Math.min(5e8, Math.floor(Number(p) || 0)));
}

function buyQuote(itemId, qty) {
  const id = String(itemId || "").slice(0, 64);
  const q = Math.max(1, Math.min(999, Math.floor(Number(qty) || 1)));
  if (BUNDLE[id]) {
    const b = BUNDLE[id];
    return {
      ok: true,
      itemId: id,
      qty: q,
      unit: b.unit,
      cost: b.unit * q,
      gained: b.amount * q,
      bundle: true,
    };
  }
  const unit = unitPriceOf(id);
  if (unit == null || unit <= 0) {
    return { ok: false, error: "unknown_item", message: "此商品尚無伺服器價目，無法購買。" };
  }
  const cost = unit * q;
  if (cost > 5e9) {
    return { ok: false, error: "cost_cap", message: "購買金額過大。" };
  }
  return {
    ok: true,
    itemId: id,
    qty: q,
    unit: unit,
    cost: cost,
    gained: q,
    bundle: false,
  };
}

function applyGainInv(data, itemId, cnt) {
  if (!data || !data.p) return { ok: false, error: "no_save" };
  if (!Array.isArray(data.p.inv)) data.p.inv = [];
  const id = String(itemId || "").slice(0, 64);
  const n = Math.max(1, Math.min(999999, Math.floor(Number(cnt) || 1)));
  // 可堆疊：同 id 且無強化／詞綴的簡易堆疊
  const stack = data.p.inv.find(
    (it) =>
      it &&
      it.id === id &&
      !(it.en > 0) &&
      !it.attr &&
      !it.anc &&
      !it.bless &&
      !it.seteff
  );
  if (stack) {
    stack.cnt = Math.max(1, Math.floor(Number(stack.cnt) || 1)) + n;
    return { ok: true, uid: stack.uid || "", stacked: true };
  }
  const uid = newUid();
  data.p.inv.push({
    id: id,
    uid: uid,
    cnt: n,
    en: 0,
    bless: false,
    anc: false,
    attr: false,
    seteff: false,
    lock: false,
    junk: false,
  });
  return { ok: true, uid: uid, stacked: false };
}

async function shopBuy(sql, account, slot, itemId, qty) {
  const quote = buyQuote(itemId, qty);
  if (!quote.ok) return quote;
  const result = await sqlMutateSlot(sql, account, slot, (data) => {
    const deb = applyDebitGold(data, quote.cost);
    if (!deb.ok) return deb;
    const gain = applyGainInv(data, quote.itemId, quote.gained);
    if (!gain.ok) return gain;
    return {
      ok: true,
      goldAfter: goldOf(data),
      walletRev: deb.walletRev || walletRevOf(data),
      gained: quote.gained,
      uid: gain.uid || "",
      cost: quote.cost,
      itemId: quote.itemId,
    };
  });
  return result;
}

/**
 * 正規化販售行：[{ uid, qty }]；單筆亦可 { uid, qty }
 */
function normalizeSellLines(body) {
  const lines = [];
  if (body && Array.isArray(body.items)) {
    for (const row of body.items) {
      if (!row) continue;
      const uid = String(row.uid || "").slice(0, 64);
      const qty = Math.max(1, Math.min(99999, Math.floor(Number(row.qty) || 1)));
      if (uid) lines.push({ uid, qty });
    }
  } else if (body && body.uid) {
    lines.push({
      uid: String(body.uid || "").slice(0, 64),
      qty: Math.max(1, Math.min(99999, Math.floor(Number(body.qty != null ? body.qty : body.count) || 1))),
    });
  }
  if (!lines.length) return { ok: false, error: "need_uid", message: "缺少販售物品。" };
  if (lines.length > SELL_BATCH_MAX) {
    return { ok: false, error: "batch_cap", message: "一次最多販售 " + SELL_BATCH_MAX + " 筆。" };
  }
  return { ok: true, lines };
}

/**
 * 販售：依雲端背包 uid 扣物＋入帳（忽略客戶端報價）
 */
async function shopSell(sql, account, slot, body) {
  const norm = normalizeSellLines(body);
  if (!norm.ok) return norm;
  const result = await sqlMutateSlot(sql, account, slot, (data) => {
    let credit = 0;
    const sold = [];
    for (const line of norm.lines) {
      const inv = data.p && Array.isArray(data.p.inv) ? data.p.inv : null;
      if (!inv) return { ok: false, error: "no_inv", message: "雲端背包資料異常。" };
      const it = inv.find((x) => x && String(x.uid || "") === line.uid);
      if (!it) {
        return { ok: false, error: "item_missing", message: "雲端背包找不到此物品（請先存檔同步後再販售）。" };
      }
      const quote = sellUnitOf(it);
      if (!quote.ok) return quote;
      const have = Math.max(1, Math.floor(Number(it.cnt) || 1));
      const qty = Math.min(line.qty, have);
      if (qty < 1) return { ok: false, error: "item_short", message: "數量不足。" };
      const rem = applyRemoveInv(data, line.uid, qty, quote.itemId);
      if (!rem.ok) return rem;
      const got = quote.unit * qty;
      credit += got;
      sold.push({
        uid: line.uid,
        itemId: quote.itemId,
        qty: qty,
        unit: quote.unit,
        credit: got,
      });
    }
    if (credit <= 0) {
      return { ok: false, error: "zero_credit", message: "販售金額為 0。" };
    }
    if (credit > 5e9) {
      return { ok: false, error: "credit_cap", message: "販售金額過大。" };
    }
    const cred = applyCreditGold(data, credit);
    if (!cred.ok) return cred;
    return {
      ok: true,
      goldAfter: goldOf(data),
      walletRev: cred.walletRev || walletRevOf(data),
      credit: credit,
      sold: sold,
    };
  });
  return result;
}

function econAuthEnabled() {
  const v = String(process.env.ECON_AUTH || "").trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  if (v === "1" || v === "true" || v === "on") return true;
  // 有資料庫則預設開（部署）；明確關才關
  return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

module.exports = {
  BUNDLE,
  unitPriceOf,
  buyQuote,
  shopBuy,
  sellUnitOf,
  shopSell,
  normalizeSellLines,
  econAuthEnabled,
  loadPrices,
  loadNosell,
  isNosellId,
  newUid,
  normSlot,
};

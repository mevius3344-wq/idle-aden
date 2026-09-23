/**
 * 🌐 Sprint3：支出 sink 白名單（伺服器定價，不信客戶端 amount）
 */
"use strict";

const { sqlMutateSlot, applyDebitGold, goldOf, walletRevOf, normSlot } = require("./rt-cloud-wallet");

/**
 * kind → 固定金幣（qty 倍乘，預設 1）
 * 僅列「固定大額／可刷」支出；商店買／賣／抽獎／倉庫另有專屬 API。
 */
const SINK_TABLE = {
  obel_track: { gold: 100000, label: "奧貝勒追蹤" },
  elf_switch: { gold: 500000, label: "精靈屬性轉換" },
  oblivion_boat: { gold: 100000, label: "遺忘之島船資" },
  siege_entry: { gold: 1000000, label: "肯特城戰入場" },
  mastery_switch: { gold: 3000000, label: "更換精通" },
  uncurse_gold: { gold: 1000000, label: "金幣解除詛咒" },
};

function sinkQuote(kind, qty) {
  const k = String(kind || "").slice(0, 64);
  const row = SINK_TABLE[k];
  if (!row) {
    return { ok: false, error: "unknown_sink", message: "未知的支出類型。" };
  }
  const q = Math.max(1, Math.min(20, Math.floor(Number(qty) || 1)));
  const cost = row.gold * q;
  if (cost > 5e9) {
    return { ok: false, error: "cost_cap", message: "支出金額過大。" };
  }
  return {
    ok: true,
    kind: k,
    qty: q,
    unit: row.gold,
    cost: cost,
    label: row.label,
  };
}

async function econSink(sql, account, slot, kind, qty) {
  const quote = sinkQuote(kind, qty);
  if (!quote.ok) return quote;
  const result = await sqlMutateSlot(sql, account, normSlot(slot), (data) => {
    const deb = applyDebitGold(data, quote.cost);
    if (!deb.ok) return deb;
    return {
      ok: true,
      kind: quote.kind,
      qty: quote.qty,
      cost: quote.cost,
      label: quote.label,
      goldAfter: goldOf(data),
      walletRev: deb.walletRev || walletRevOf(data),
    };
  });
  return result;
}

module.exports = {
  SINK_TABLE,
  sinkQuote,
  econSink,
};

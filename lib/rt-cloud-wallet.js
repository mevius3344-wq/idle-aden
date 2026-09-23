"use strict";

/**
 * B2：雲端角色錢包（金幣／背包）伺服器結算輔助。
 * 與 cloud_slots 搭配：扣款時遞增 p._walletRev，雲端 PUT 若本機序號較舊則強制採用伺服器金幣。
 */

const { accountKey, normalizeAccountId } = require("./game-utils");

function normSlot(slot) {
  const n = Math.floor(Number(slot) || 0);
  if (n >= 1 && n <= 8) return n;
  if (n === 0) return 1;
  return Math.max(1, Math.min(8, n || 1));
}

function walletRevOf(data) {
  return Math.max(0, Math.floor(Number(data && data.p && data.p._walletRev) || 0));
}

function goldOf(data) {
  return Math.max(0, Math.floor(Number(data && data.p && data.p.gold) || 0));
}

function bumpWalletRev(data) {
  if (!data || !data.p) return 0;
  const next = walletRevOf(data) + 1;
  data.p._walletRev = next;
  data.p.savedAt = Date.now();
  return next;
}

/** 雲端 PUT 合併：伺服器錢包序號較新時，金幣以伺服器為準；禁止無 credit 抬高金幣。 */
function mergeWalletAuthority(incoming, existing) {
  if (!incoming || !incoming.p || !existing || !existing.p) return incoming;
  const exRev = walletRevOf(existing);
  const inRev = walletRevOf(incoming);
  const exGold = goldOf(existing);
  const inGold = goldOf(incoming);
  // P5a：伺服器序號較新 → 整段採用伺服器金幣
  if (exRev > inRev) {
    incoming.p.gold = exGold;
    incoming.p._walletRev = exRev;
    return incoming;
  }
  // P5a：禁止 PUT 抬高金幣（只能透過伺服器 credit／賣店等 API）
  if (inGold > exGold) {
    incoming.p.gold = exGold;
  }
  return incoming;
}

function applyDebitGold(data, amount) {
  const need = Math.max(0, Math.floor(Number(amount) || 0));
  if (!data || !data.p) return { ok: false, error: "no_save", message: "找不到雲端角色存檔，請先存檔後再試。" };
  if (need <= 0) {
    return { ok: true, goldAfter: goldOf(data), walletRev: walletRevOf(data), debited: 0 };
  }
  const g = goldOf(data);
  if (g < need) {
    return {
      ok: false,
      error: "gold_short",
      message: "金幣不足（雲端餘額 " + g.toLocaleString() + "，需要 " + need.toLocaleString() + "）。",
      gold: g,
      need,
    };
  }
  data.p.gold = g - need;
  const walletRev = bumpWalletRev(data);
  return { ok: true, goldAfter: data.p.gold, walletRev, debited: need };
}

function applyCreditGold(data, amount) {
  const add = Math.max(0, Math.floor(Number(amount) || 0));
  if (!data || !data.p) return { ok: false, error: "no_save" };
  if (add <= 0) return { ok: true, goldAfter: goldOf(data), walletRev: walletRevOf(data) };
  data.p.gold = goldOf(data) + add;
  const walletRev = bumpWalletRev(data);
  return { ok: true, goldAfter: data.p.gold, walletRev };
}

/**
 * 從雲端背包移除 sourceUid 指定數量；可選 expectId 核對物品 id。
 */
function applyRemoveInv(data, sourceUid, cnt, expectId) {
  if (!data || !data.p || !Array.isArray(data.p.inv)) {
    return { ok: false, error: "no_inv", message: "雲端背包資料異常。" };
  }
  const uid = String(sourceUid || "").slice(0, 64);
  if (!uid) return { ok: false, error: "need_uid", message: "缺少物品識別。" };
  const need = Math.max(1, Math.min(99999, Math.floor(Number(cnt) || 1)));
  const inv = data.p.inv;
  const idx = inv.findIndex((it) => it && String(it.uid || "") === uid);
  if (idx < 0) return { ok: false, error: "item_missing", message: "雲端背包找不到此物品（請先存檔同步後再上架）。" };
  const it = inv[idx];
  const id = String(it.id || "");
  if (expectId && id !== String(expectId)) {
    return { ok: false, error: "item_mismatch", message: "物品與上架資料不符。" };
  }
  const have = Math.max(1, Math.floor(Number(it.cnt) || 1));
  if (have < need) return { ok: false, error: "item_short", message: "雲端背包數量不足。" };
  if (have === need) inv.splice(idx, 1);
  else it.cnt = have - need;
  bumpWalletRev(data);
  return { ok: true };
}

async function sqlLoadSlot(sql, account, slot) {
  const ak = accountKey(normalizeAccountId(account) || account);
  const s = normSlot(slot);
  const rows = await sql`SELECT data, updated_at FROM cloud_slots WHERE account_key = ${ak} AND slot = ${s} LIMIT 1`;
  if (!rows.length) return null;
  return { ak, slot: s, data: rows[0].data, updatedAt: Number(rows[0].updated_at) || 0 };
}

async function sqlSaveSlot(sql, ak, slot, data, expectedUpdatedAt) {
  const now = Date.now();
  const s = normSlot(slot);
  if (expectedUpdatedAt != null && Number(expectedUpdatedAt) > 0) {
    const rows = await sql`
      UPDATE cloud_slots SET data = ${data}, updated_at = ${now}
      WHERE account_key = ${ak} AND slot = ${s} AND updated_at = ${expectedUpdatedAt}
      RETURNING updated_at`;
    if (!rows.length) return { ok: false, error: "conflict" };
    return { ok: true, updatedAt: now };
  }
  await sql`INSERT INTO cloud_slots (account_key, slot, data, updated_at) VALUES (${ak}, ${s}, ${data}, ${now})
    ON CONFLICT (account_key, slot) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`;
  return { ok: true, updatedAt: now };
}

async function sqlMutateSlot(sql, account, slot, mutator) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const loaded = await sqlLoadSlot(sql, account, slot);
    if (!loaded) {
      return { ok: false, error: "no_save", message: "找不到雲端角色存檔，請先存檔後再試。" };
    }
    // neon jsonb 可能已是 object；確保可寫
    const data = loaded.data && typeof loaded.data === "object" ? loaded.data : null;
    if (!data || !data.p) {
      return { ok: false, error: "no_save", message: "雲端存檔格式異常。" };
    }
    const result = mutator(data);
    if (!result || !result.ok) return result || { ok: false, error: "mutate_failed" };
    const saved = await sqlSaveSlot(sql, loaded.ak, loaded.slot, data, loaded.updatedAt);
    if (saved.ok) {
      return Object.assign({}, result, { goldAfter: goldOf(data), walletRev: walletRevOf(data) });
    }
  }
  return { ok: false, error: "conflict", message: "存檔忙碌中，請稍後再試。" };
}

async function sqlDebitGold(sql, account, slot, amount) {
  return sqlMutateSlot(sql, account, slot, (data) => applyDebitGold(data, amount));
}

async function sqlDebitGoldAndRemoveItem(sql, account, slot, amount, sourceUid, cnt, expectId) {
  return sqlMutateSlot(sql, account, slot, (data) => {
    const rem = applyRemoveInv(data, sourceUid, cnt, expectId);
    if (!rem.ok) return rem;
    return applyDebitGold(data, amount);
  });
}

module.exports = {
  normSlot,
  walletRevOf,
  goldOf,
  bumpWalletRev,
  mergeWalletAuthority,
  applyDebitGold,
  applyCreditGold,
  applyRemoveInv,
  sqlLoadSlot,
  sqlSaveSlot,
  sqlMutateSlot,
  sqlDebitGold,
  sqlDebitGoldAndRemoveItem,
};

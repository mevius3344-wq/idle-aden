/**
 * 🌐 P5c 倉庫權威：存／領物品與金幣（雲端 shared 倉＋角色 slot 原子轉移）
 */
"use strict";

const crypto = require("crypto");
const { accountKey, normalizeAccountId } = require("./game-utils");
const {
  normSlot,
  goldOf,
  walletRevOf,
  bumpWalletRev,
  applyDebitGold,
  applyCreditGold,
  sqlLoadSlot,
  sqlSaveSlot,
} = require("./rt-cloud-wallet");

const WH_MAX = 5000;
const WH_NO_STORE = new Set([
  "item_dk_insignia",
  "item_mastery_proof",
  "item_pride_pass_11",
  "item_pride_pass_21",
  "item_pride_pass_31",
  "item_pride_pass_41",
  "item_pride_pass_51",
  "item_pride_pass_61",
  "item_pride_pass_71",
  "item_pride_pass_81",
  "item_pride_pass_91",
  "item_dantes_letter",
  "item_elf_whisper",
  "item_ancient_book",
  "item_sealed_intel",
  "item_spy_report",
  "item_chaos_key",
  "item_royal_order",
  "wpn_shaha_arrow",
  "new_item_196",
  "new_item_198",
  "new_item_206",
  "new_item_144",
  "new_item_208",
  "item_nightvision",
  "item_ancientkey",
  "new_item_204",
  "new_item_205",
  "new_item_203",
  "new_item_214",
  "new_item_212",
  "new_item_240",
  "new_item_199",
  "new_item_200",
  "new_item_201",
  "new_item_202",
  "new_item_213",
  "item_blueflute",
  "item_death_oath",
  "item_orc_elder_head",
  "item_yeti_head",
  "item_fallen_key",
  "item_ant_fruit",
  "item_ant_branch",
  "item_ant_bark",
  "item_elmore_heart",
  "item_time_orb",
  "item_wyvern_blood",
  "new_item_207",
  "new_item_226",
  "new_item_225",
  "item_cyclops_blood",
  "new_item_219",
  "new_item_234",
  "item_demon_search",
  "item_demon_spy",
  "item_yeti_heart",
  "item_soulfire_ash",
  "new_item_197",
  "new_item_211",
  "item_lost_soul",
  "mat_flame_sword",
  "mat_flame_eye",
  "mat_flame_claw",
  "mat_flame_heart",
]);

function newUid() {
  return "w" + Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
}

function whSharedName(classic) {
  return classic ? "warehouse_classic" : "warehouse";
}

function itemSig(it) {
  if (!it) return "";
  const ams = Math.max(1, Math.min(3, Math.floor(Number(it.attrMagicStar) || 1)));
  let base =
    String(it.id || "") +
    "|" +
    (it.en || 0) +
    "|" +
    (it.bless === true ? "B" : it.bless ? "C" : 0) +
    "|" +
    (it.anc === true ? "A" : it.anc || 0) +
    "|" +
    (it.attr || "") +
    "|" +
    (it.seteff || "") +
    (it.attrMagic ? "|" + it.attrMagic + (ams > 1 ? "@" + ams : "") : "");
  if (it.expireAt) base += "|X" + Math.floor(Number(it.expireAt) || 0);
  return base;
}

function sameItemSig(a, b) {
  return itemSig(a) === itemSig(b);
}

function clearJunk(it) {
  if (!it) return it;
  delete it.junk;
  delete it.junkSince;
  delete it._autoSellQty;
  delete it._ruleJunk;
  return it;
}

function cloneItem(it, cnt) {
  const o = Object.assign({}, it);
  o.cnt = Math.max(1, Math.floor(Number(cnt != null ? cnt : it.cnt) || 1));
  clearJunk(o);
  return o;
}

function findStack(arr, it) {
  if (!it || it.gw || !Array.isArray(arr)) return null;
  return arr.find((x) => x && !x.gw && sameItemSig(x, it)) || null;
}

function absorbStack(stack, src, n) {
  stack.cnt = Math.max(1, Math.floor(Number(stack.cnt) || 1)) + n;
  if (src && src.lock) {
    stack.lock = true;
    stack.junk = false;
  }
}

function whRevOf(wh) {
  return Math.max(0, Math.floor(Number(wh && wh._whRev) || 0));
}

function bumpWhRev(wh) {
  if (!wh || typeof wh !== "object") return 0;
  const next = whRevOf(wh) + 1;
  wh._whRev = next;
  return next;
}

function normWh(raw) {
  const wh =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw
      : { items: [], gold: 0, _whRev: 0 };
  if (!Array.isArray(wh.items)) wh.items = [];
  wh.gold = Math.max(0, Math.floor(Number(wh.gold) || 0));
  wh._whRev = whRevOf(wh);
  return wh;
}

function isRentalLike(it) {
  return !!(it && (it.rental || Number(it.expireAt) > 0));
}

async function sqlLoadShared(sql, account, name) {
  const ak = accountKey(normalizeAccountId(account) || account);
  const n = String(name || "").slice(0, 64);
  const rows = await sql`SELECT data, updated_at FROM cloud_shared WHERE account_key = ${ak} AND name = ${n} LIMIT 1`;
  if (!rows.length) return { ak, name: n, data: null, updatedAt: 0, missing: true };
  return {
    ak,
    name: n,
    data: rows[0].data,
    updatedAt: Number(rows[0].updated_at) || 0,
    missing: false,
  };
}

async function sqlSaveShared(sql, ak, name, data, expectedUpdatedAt) {
  const now = Date.now();
  const n = String(name || "").slice(0, 64);
  if (expectedUpdatedAt != null && Number(expectedUpdatedAt) > 0) {
    const rows = await sql`
      UPDATE cloud_shared SET data = ${data}, updated_at = ${now}
      WHERE account_key = ${ak} AND name = ${n} AND updated_at = ${expectedUpdatedAt}
      RETURNING updated_at`;
    if (!rows.length) return { ok: false, error: "conflict" };
    return { ok: true, updatedAt: now };
  }
  if (expectedUpdatedAt === 0) {
    // 新建：若已有列則衝突
    try {
      await sql`INSERT INTO cloud_shared (account_key, name, data, updated_at) VALUES (${ak}, ${n}, ${data}, ${now})`;
      return { ok: true, updatedAt: now };
    } catch (e) {
      return { ok: false, error: "conflict" };
    }
  }
  await sql`INSERT INTO cloud_shared (account_key, name, data, updated_at) VALUES (${ak}, ${n}, ${data}, ${now})
    ON CONFLICT (account_key, name) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`;
  return { ok: true, updatedAt: now };
}

function resolveClassic(body, slotData) {
  if (body && body.classic != null) return !!body.classic;
  if (body && body.classicMode != null) return !!body.classicMode;
  return !!(slotData && slotData.p && slotData.p.classicMode);
}

function snapshotWh(wh) {
  return JSON.parse(JSON.stringify(normWh(wh)));
}

function applyDepositItem(slotData, wh, uid, qty) {
  if (!slotData || !slotData.p || !Array.isArray(slotData.p.inv)) {
    return { ok: false, error: "no_inv", message: "雲端背包資料異常。" };
  }
  const idUid = String(uid || "").slice(0, 64);
  if (!idUid) return { ok: false, error: "need_uid", message: "缺少物品識別。" };
  const inv = slotData.p.inv;
  const idx = inv.findIndex((x) => x && String(x.uid || "") === idUid);
  if (idx < 0) {
    return { ok: false, error: "item_missing", message: "雲端背包找不到此物品（請先存檔同步）。" };
  }
  const it = inv[idx];
  const itemId = String(it.id || "");
  if (WH_NO_STORE.has(itemId)) {
    return { ok: false, error: "no_store", message: "此物品無法存入倉庫。" };
  }
  if (isRentalLike(it)) {
    return { ok: false, error: "rental", message: "限時裝備無法存入倉庫。" };
  }
  if (it.lock) {
    return { ok: false, error: "locked", message: "鎖定物品需先解鎖才能存入倉庫。" };
  }
  const have = Math.max(1, Math.floor(Number(it.cnt) || 1));
  const n = Math.max(1, Math.min(have, Math.floor(Number(qty) || have)));
  const stack = findStack(wh.items, it);
  if (!stack && wh.items.length >= WH_MAX) {
    return { ok: false, error: "wh_full", message: "倉庫已滿（上限 " + WH_MAX + " 格）。" };
  }
  let moved;
  if (n >= have) {
    moved = clearJunk(inv.splice(idx, 1)[0]);
    if (stack) absorbStack(stack, moved, have);
    else wh.items.push(moved);
  } else {
    it.cnt = have - n;
    moved = cloneItem(it, n);
    moved.uid = newUid();
    if (stack) absorbStack(stack, moved, n);
    else wh.items.push(moved);
  }
  bumpWalletRev(slotData);
  bumpWhRev(wh);
  return {
    ok: true,
    moved: { uid: moved.uid || idUid, id: itemId, qty: n },
    goldAfter: goldOf(slotData),
    walletRev: walletRevOf(slotData),
    whGold: wh.gold,
    whRev: whRevOf(wh),
    warehouse: { items: wh.items, gold: wh.gold, _whRev: wh._whRev },
  };
}

function applyWithdrawItem(slotData, wh, uid, qty) {
  if (!slotData || !slotData.p) {
    return { ok: false, error: "no_save", message: "找不到雲端角色存檔。" };
  }
  if (!Array.isArray(slotData.p.inv)) slotData.p.inv = [];
  const idUid = String(uid || "").slice(0, 64);
  if (!idUid) return { ok: false, error: "need_uid", message: "缺少物品識別。" };
  const idx = wh.items.findIndex((x) => x && String(x.uid || "") === idUid);
  if (idx < 0) {
    return { ok: false, error: "item_missing", message: "雲端倉庫找不到此物品。" };
  }
  const it = wh.items[idx];
  const have = Math.max(1, Math.floor(Number(it.cnt) || 1));
  const n = Math.max(1, Math.min(have, Math.floor(Number(qty) || have)));
  let moved;
  if (n >= have) {
    moved = clearJunk(wh.items.splice(idx, 1)[0]);
    if (!moved.uid || slotData.p.inv.some((x) => x && x.uid === moved.uid)) moved.uid = newUid();
  } else {
    it.cnt = have - n;
    moved = cloneItem(it, n);
    moved.uid = newUid();
  }
  const stack = findStack(slotData.p.inv, moved);
  if (stack) absorbStack(stack, moved, n);
  else slotData.p.inv.push(moved);
  bumpWalletRev(slotData);
  bumpWhRev(wh);
  return {
    ok: true,
    moved: { uid: moved.uid, id: String(moved.id || ""), qty: n },
    goldAfter: goldOf(slotData),
    walletRev: walletRevOf(slotData),
    whGold: wh.gold,
    whRev: whRevOf(wh),
    warehouse: { items: wh.items, gold: wh.gold, _whRev: wh._whRev },
  };
}

function applyGoldMove(slotData, wh, dir, amount) {
  const amt = Math.max(0, Math.floor(Number(amount) || 0));
  if (amt <= 0) return { ok: false, error: "bad_amount", message: "金幣數量無效。" };
  if (dir === "in") {
    const deb = applyDebitGold(slotData, amt);
    if (!deb.ok) return deb;
    wh.gold = Math.max(0, Math.floor(Number(wh.gold) || 0)) + amt;
    bumpWhRev(wh);
    return {
      ok: true,
      moved: { kind: "gold", qty: amt, dir: "in" },
      goldAfter: goldOf(slotData),
      walletRev: walletRevOf(slotData),
      whGold: wh.gold,
      whRev: whRevOf(wh),
      warehouse: { items: wh.items, gold: wh.gold, _whRev: wh._whRev },
    };
  }
  if (dir === "out") {
    const have = Math.max(0, Math.floor(Number(wh.gold) || 0));
    if (have < amt) {
      return {
        ok: false,
        error: "wh_gold_short",
        message: "倉庫金幣不足（現有 " + have.toLocaleString() + "）。",
        gold: have,
        need: amt,
      };
    }
    wh.gold = have - amt;
    bumpWhRev(wh);
    const cred = applyCreditGold(slotData, amt);
    if (!cred.ok) return cred;
    return {
      ok: true,
      moved: { kind: "gold", qty: amt, dir: "out" },
      goldAfter: goldOf(slotData),
      walletRev: walletRevOf(slotData),
      whGold: wh.gold,
      whRev: whRevOf(wh),
      warehouse: { items: wh.items, gold: wh.gold, _whRev: wh._whRev },
    };
  }
  return { ok: false, error: "bad_dir", message: "dir 須為 in 或 out。" };
}

/**
 * 雙寫：先寫「來源」再寫「目的」；目的失敗則還原來源。
 */
async function warehouseMove(sql, account, slot, body) {
  const s = normSlot(slot);
  const dir = String((body && body.dir) || "").toLowerCase();
  const kind = String((body && body.kind) || (body && body.gold != null ? "gold" : "item")).toLowerCase();
  if (dir !== "in" && dir !== "out") {
    return { ok: false, error: "bad_dir", message: "dir 須為 in 或 out。" };
  }
  if (kind !== "item" && kind !== "gold") {
    return { ok: false, error: "bad_kind", message: "kind 須為 item 或 gold。" };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const loaded = await sqlLoadSlot(sql, account, s);
    if (!loaded) {
      return { ok: false, error: "no_save", message: "找不到雲端角色存檔，請先存檔後再試。" };
    }
    const slotData =
      loaded.data && typeof loaded.data === "object" ? loaded.data : null;
    if (!slotData || !slotData.p) {
      return { ok: false, error: "no_save", message: "雲端存檔格式異常。" };
    }

    const classic = resolveClassic(body, slotData);
    const sharedName = whSharedName(classic);
    const shared = await sqlLoadShared(sql, account, sharedName);
    const wh = normWh(shared.missing ? { items: [], gold: 0, _whRev: 0 } : shared.data);
    const whBefore = snapshotWh(wh);
    const slotBeforeGold = goldOf(slotData);
    const slotBeforeInv = JSON.parse(JSON.stringify(slotData.p.inv || []));
    const slotBeforeRev = walletRevOf(slotData);

    let result;
    if (kind === "gold") {
      const amt = body.amount != null ? body.amount : body.qty != null ? body.qty : body.gold;
      result = applyGoldMove(slotData, wh, dir, amt);
    } else {
      const uid = body.uid || body.sourceUid;
      const qty = body.qty != null ? body.qty : body.count;
      result =
        dir === "in"
          ? applyDepositItem(slotData, wh, uid, qty)
          : applyWithdrawItem(slotData, wh, uid, qty);
    }
    if (!result || !result.ok) return result || { ok: false, error: "move_failed" };

    // 寫入順序：item in → 先 slot 再 wh；item out → 先 wh 再 slot；gold 同理
    const firstIsSlot = (kind === "item" && dir === "in") || (kind === "gold" && dir === "in");

    const saveSlot = () => sqlSaveSlot(sql, loaded.ak, loaded.slot, slotData, loaded.updatedAt);
    const saveWh = () =>
      sqlSaveShared(
        sql,
        shared.ak,
        sharedName,
        { items: wh.items, gold: wh.gold, _whRev: wh._whRev },
        shared.missing ? 0 : shared.updatedAt
      );

    if (firstIsSlot) {
      const s1 = await saveSlot();
      if (!s1.ok) continue;
      const s2 = await saveWh();
      if (!s2.ok) {
        // 還原 slot
        slotData.p.inv = slotBeforeInv;
        slotData.p.gold = slotBeforeGold;
        slotData.p._walletRev = slotBeforeRev;
        await sqlSaveSlot(sql, loaded.ak, loaded.slot, slotData, null);
        continue;
      }
    } else {
      const s1 = await saveWh();
      if (!s1.ok) continue;
      const s2 = await saveSlot();
      if (!s2.ok) {
        // 還原 warehouse
        await sqlSaveShared(sql, shared.ak, sharedName, whBefore, null);
        continue;
      }
    }

    return Object.assign({}, result, {
      classic: classic,
      sharedName: sharedName,
      goldAfter: goldOf(slotData),
      walletRev: walletRevOf(slotData),
      whGold: wh.gold,
      whRev: whRevOf(wh),
      warehouse: { items: wh.items, gold: wh.gold, _whRev: wh._whRev },
    });
  }
  return { ok: false, error: "conflict", message: "存檔忙碌中，請稍後再試。" };
}

async function warehouseGet(sql, account, classic) {
  const name = whSharedName(!!classic);
  const shared = await sqlLoadShared(sql, account, name);
  const wh = normWh(shared.missing ? { items: [], gold: 0, _whRev: 0 } : shared.data);
  return {
    ok: true,
    classic: !!classic,
    sharedName: name,
    gold: wh.gold,
    whRev: whRevOf(wh),
    items: wh.items,
    warehouse: { items: wh.items, gold: wh.gold, _whRev: wh._whRev },
    updatedAt: shared.updatedAt || 0,
  };
}

function isWarehouseSharedName(name) {
  const n = String(name || "");
  return n === "warehouse" || n === "warehouse_classic";
}

module.exports = {
  WH_MAX,
  WH_NO_STORE,
  whSharedName,
  itemSig,
  whRevOf,
  normWh,
  warehouseMove,
  warehouseGet,
  isWarehouseSharedName,
  sqlLoadShared,
  sqlSaveShared,
};

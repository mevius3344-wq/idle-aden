"use strict";

const path = require("path");
const { getSql, ensureSchema } = require("./db");
const { jsonRes, corsPreflight, accountKey, normalizeAccountId } = require("./game-utils");
const {
  AUCTION_MAX_LISTINGS,
  AUCTION_MAX_PER_ACCOUNT,
  AUCTION_TTL_MS,
  AUCTION_LIST_FEE_RATE,
  AUCTION_LIST_FEE_MIN,
  AUCTION_LIST_FEE_MAX,
  AUCTION_BUY_FEE_RATE,
  AUCTION_PRICE_MIN,
  partySanitizeName,
  partyMemberKey,
  newId,
  parseJsonBody,
  auctionFeesForPrice,
  auctionSanitizeItem,
  auctionPublic,
} = require("./rt-common");
const {
  normSlot,
  sqlDebitGoldAndRemoveItem,
  sqlDebitGoldAndAddItem,
  sqlCreditGold,
  sqlAddItem,
  sqlMutateSlot,
  applyCreditGold,
  applyAddItem,
} = require("./rt-cloud-wallet");
const { verifyAccountSessionSql } = require("./rt-account-session");
const _antiCheat = require("./rt-anti-cheat");

const ROOT = path.join(__dirname, "..");

async function auctionRequireAuth(data, res, sql) {
  const auth = _antiCheat.authFromBody(data || {}, ROOT);
  if (!auth.ok) {
    jsonRes(res, 401, {
      ok: false,
      error: auth.error || "auth_required",
      message: "拍賣行需要有效登入，請重新登入。",
    });
    return null;
  }
  const bodyAcc = normalizeAccountId((data && data.account) || "") || String((data && data.account) || "").trim();
  if (bodyAcc && accountKey(bodyAcc) !== accountKey(auth.account)) {
    jsonRes(res, 403, { ok: false, error: "account_mismatch", message: "帳號與登入令牌不符。" });
    return null;
  }
  const ak = accountKey(auth.account);
  const sessOk = await verifyAccountSessionSql(sql, ak, auth.sessionId);
  if (!sessOk) {
    jsonRes(res, 401, {
      ok: false,
      error: "session_invalid",
      message: "登入已失效（可能已在其他裝置登入）。請重新登入。",
    });
    return null;
  }
  return auth;
}

function listingFromRow(row) {
  if (!row) return null;
  const p = row.payload || {};
  return {
    id: row.id,
    sellerAccount: p.sellerAccount || row.seller_account,
    sellerSlot: p.sellerSlot || 0,
    sellerName: p.sellerName || "未命名",
    sellerKey: p.sellerKey || "",
    price: p.price || 0,
    listFee: p.listFee || 0,
    item: p.item,
    createdAt: p.createdAt || Number(row.created_at) || 0,
    expiresAt: p.expiresAt || Number(row.expires_at) || 0,
  };
}

async function loadAllListings(sql) {
  const rows = await sql`SELECT id, seller_account, payload, expires_at, created_at FROM rt_auction_listings`;
  return rows.map(listingFromRow).filter(Boolean);
}

async function saveListing(sql, L) {
  const payload = {
    sellerAccount: L.sellerAccount,
    sellerSlot: L.sellerSlot,
    sellerName: L.sellerName,
    sellerKey: L.sellerKey,
    price: L.price,
    listFee: L.listFee,
    item: L.item,
    createdAt: L.createdAt,
    expiresAt: L.expiresAt,
  };
  await sql`INSERT INTO rt_auction_listings (id, seller_account, payload, expires_at, created_at)
    VALUES (${L.id}, ${L.sellerAccount}, ${payload}, ${L.expiresAt}, ${L.createdAt})
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at`;
}

async function deleteListing(sql, id) {
  await sql`DELETE FROM rt_auction_listings WHERE id = ${id}`;
}

async function loadClaims(sql, account) {
  const rows = await sql`SELECT claim_id, payload FROM rt_auction_claims WHERE account = ${account} ORDER BY at ASC`;
  return rows.map((r) => ({ id: r.claim_id, ...r.payload }));
}

async function pushClaim(sql, account, claim) {
  const a = String(account || "").trim().slice(0, 24);
  if (!a || !claim) return;
  await sql`INSERT INTO rt_auction_claims (account, claim_id, payload, at)
    VALUES (${a}, ${claim.id}, ${claim}, ${claim.at || Date.now()})
    ON CONFLICT (account, claim_id) DO NOTHING`;
  const rows = await sql`SELECT claim_id FROM rt_auction_claims WHERE account = ${a} ORDER BY at ASC`;
  if (rows.length > 200) {
    const drop = rows.slice(0, rows.length - 200);
    for (const r of drop) await sql`DELETE FROM rt_auction_claims WHERE account = ${a} AND claim_id = ${r.claim_id}`;
  }
}

async function auctionCountByAccount(listings, account) {
  let n = 0;
  for (const L of listings) if (L && L.sellerAccount === account) n++;
  return n;
}

async function auctionExpireStale(sql) {
  const now = Date.now();
  const rows = await sql`SELECT id, seller_account, payload FROM rt_auction_listings WHERE expires_at <= ${now}`;
  for (const row of rows) {
    const L = listingFromRow(row);
    if (!L) continue;
    await pushClaim(sql, L.sellerAccount, {
      id: newId("X"),
      type: "item",
      item: L.item,
      reason: "expire",
      listingId: L.id,
      price: L.price,
      slot: L.sellerSlot || 0,
      at: now,
    });
    await deleteListing(sql, L.id);
  }
}

async function handleAuctionApi(req, res, u) {
  if (req.method === "OPTIONS") return corsPreflight(res, "GET,POST,OPTIONS");
  const sql = getSql();
  await ensureSchema();
  await auctionExpireStale(sql);

  if (u === "/api/auction/fees" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const price = Math.floor(Number(url.searchParams.get("price")) || 1000);
    const fees = auctionFeesForPrice(price);
    return jsonRes(res, 200, {
      ok: true,
      listFeeRate: AUCTION_LIST_FEE_RATE,
      listFeeMin: AUCTION_LIST_FEE_MIN,
      listFeeMax: AUCTION_LIST_FEE_MAX,
      buyFeeRate: AUCTION_BUY_FEE_RATE,
      ttlMs: AUCTION_TTL_MS,
      maxPerAccount: AUCTION_MAX_PER_ACCOUNT,
      sample: fees,
    });
  }

  if (u === "/api/auction/list" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 40);
    const seller = String(url.searchParams.get("seller") || "").trim().toLowerCase().slice(0, 24);
    const viewer = String(url.searchParams.get("account") || "").replace(/[<>&"']/g, "").trim().slice(0, 24);
    const page = Math.max(1, Math.min(100, Math.floor(Number(url.searchParams.get("page")) || 1)));
    const pageSize = 40;
    const listings = await loadAllListings(sql);
    let rows = [];
    for (const L of listings) {
      if (!L || !L.item) continue;
      if (seller && String(L.sellerName || "").toLowerCase().indexOf(seller) < 0 && String(L.sellerAccount || "").toLowerCase() !== seller) continue;
      if (q) {
        const hay = (String(L.item.id || "") + " " + String(L.item._n || "") + " " + String(L.sellerName || "")).toLowerCase();
        if (hay.indexOf(q) < 0) continue;
      }
      const pub = auctionPublic(L);
      if (pub && viewer && L.sellerAccount === viewer) pub.isMine = true;
      rows.push(pub);
    }
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    rows = rows.slice(start, start + pageSize);
    return jsonRes(res, 200, {
      ok: true,
      listings: rows,
      total,
      page,
      pageSize,
      fees: {
        listFeeRate: AUCTION_LIST_FEE_RATE,
        listFeeMin: AUCTION_LIST_FEE_MIN,
        listFeeMax: AUCTION_LIST_FEE_MAX,
        buyFeeRate: AUCTION_BUY_FEE_RATE,
        ttlMs: AUCTION_TTL_MS,
      },
    });
  }

  if (u === "/api/auction/mine" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const account = String(url.searchParams.get("account") || "").replace(/[<>&"']/g, "").trim().slice(0, 24);
    if (!account) return jsonRes(res, 400, { ok: false, error: "need account" });
    const listings = await loadAllListings(sql);
    const rows = [];
    for (const L of listings) if (L && L.sellerAccount === account) rows.push(auctionPublic(L, { mine: true }));
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const claims = await loadClaims(sql, account);
    return jsonRes(res, 200, { ok: true, listings: rows, claims });
  }

  if (u === "/api/auction/claims" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const account = String(url.searchParams.get("account") || "").replace(/[<>&"']/g, "").trim().slice(0, 24);
    if (!account) return jsonRes(res, 400, { ok: false, error: "need account" });
    const claims = await loadClaims(sql, account);
    return jsonRes(res, 200, { ok: true, claims });
  }

  // ===== B2：寫入類 API 需登入＋雲端錢包結算 =====
  if (u === "/api/auction/create" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const auth = await auctionRequireAuth(data, res, sql);
    if (!auth) return;
    const account = auth.account;
    const slot = normSlot(data.slot);
    const name = partySanitizeName(data.name) || "未命名";
    const key = partyMemberKey(account, slot, name);
    const item = auctionSanitizeItem(data.item);
    if (!item) return jsonRes(res, 400, { ok: false, error: "bad item", message: "物品資料無效（限時／特殊道具無法上架）。" });
    const itemName = String(data.itemName || "").replace(/[<>&"']/g, "").trim().slice(0, 40);
    if (itemName) item._n = itemName;
    const sourceUid = String(data.sourceUid || "").slice(0, 64);
    if (!sourceUid) {
      return jsonRes(res, 400, { ok: false, error: "need_uid", message: "上架缺少物品識別，請更新客戶端後重試。" });
    }
    const fees = auctionFeesForPrice(data.price);
    if (fees.price < AUCTION_PRICE_MIN) return jsonRes(res, 400, { ok: false, error: "bad price", message: "價格過低。" });
    const listings = await loadAllListings(sql);
    if (listings.length >= AUCTION_MAX_LISTINGS) return jsonRes(res, 400, { ok: false, error: "full", message: "拍賣行目前已滿，請稍後再試。" });
    if ((await auctionCountByAccount(listings, account)) >= AUCTION_MAX_PER_ACCOUNT) {
      return jsonRes(res, 400, { ok: false, error: "limit", message: "每個帳號最多同時上架 " + AUCTION_MAX_PER_ACCOUNT + " 件。" });
    }
    const wallet = await sqlDebitGoldAndRemoveItem(sql, account, slot, fees.listFee, sourceUid, item.cnt, item.id);
    if (!wallet.ok) {
      return jsonRes(res, wallet.error === "gold_short" ? 400 : 409, {
        ok: false,
        error: wallet.error || "wallet",
        message: wallet.message || "上架扣款／扣物失敗。",
      });
    }
    const now = Date.now();
    const listing = {
      id: newId("A"),
      sellerAccount: account,
      sellerSlot: slot,
      sellerName: name,
      sellerKey: key,
      price: fees.price,
      listFee: fees.listFee,
      item,
      createdAt: now,
      expiresAt: now + AUCTION_TTL_MS,
    };
    try {
      await saveListing(sql, listing);
    } catch (e) {
      // 上架寫入失敗：把雲端金幣／物品退回存檔
      try {
        await sqlMutateSlot(sql, account, slot, (pdata) => {
          applyCreditGold(pdata, fees.listFee);
          const add = applyAddItem(pdata, Object.assign({}, item, { uid: sourceUid }));
          if (!add.ok) return add;
          return { ok: true };
        });
      } catch (e2) {
        await pushClaim(sql, account, {
          id: newId("R"),
          type: "item",
          item,
          reason: "create_rollback_item",
          slot,
          at: Date.now(),
        });
        await pushClaim(sql, account, {
          id: newId("R"),
          type: "gold",
          amount: fees.listFee,
          reason: "create_rollback_gold",
          slot,
          at: Date.now(),
        });
      }
      return jsonRes(res, 500, { ok: false, error: "save_failed", message: "上架寫入失敗，已嘗試退回費用與物品。" });
    }
    return jsonRes(res, 200, {
      ok: true,
      listing: auctionPublic(listing, { mine: true }),
      listFee: fees.listFee,
      goldAfter: wallet.goldAfter,
      walletRev: wallet.walletRev,
      message: "上架成功。已收取上架手續費 " + fees.listFee.toLocaleString() + " 金幣。",
    });
  }

  if (u === "/api/auction/buy" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const auth = await auctionRequireAuth(data, res, sql);
    if (!auth) return;
    const account = auth.account;
    const slot = normSlot(data.slot);
    const buyerName = partySanitizeName(data.name) || "未命名";
    const listingId = String(data.listingId || "").slice(0, 48);
    const rows = await sql`
      DELETE FROM rt_auction_listings WHERE id = ${listingId}
      RETURNING id, seller_account, payload, expires_at, created_at`;
    const L = listingFromRow(rows[0]);
    if (!L) return jsonRes(res, 404, { ok: false, error: "gone", message: "此商品已售出或下架。" });
    if (L.sellerAccount === account) {
      await saveListing(sql, L);
      return jsonRes(res, 400, { ok: false, error: "self", message: "不能購買自己的商品。" });
    }
    const fees = auctionFeesForPrice(L.price);
    // 扣款＋入包同一事務，避免金幣已扣但物品只在本機、雲端 PUT 被擋或重複
    const wallet = await sqlDebitGoldAndAddItem(sql, account, slot, fees.totalBuy, L.item);
    if (!wallet.ok) {
      await saveListing(sql, L);
      return jsonRes(res, 400, {
        ok: false,
        error: wallet.error || "gold_short",
        message: wallet.message || "金幣不足。",
      });
    }
    await pushClaim(sql, L.sellerAccount, {
      id: newId("G"),
      type: "gold",
      amount: fees.price,
      reason: "sale",
      listingId: L.id,
      buyerName,
      slot: L.sellerSlot || 0,
      at: Date.now(),
    });
    return jsonRes(res, 200, {
      ok: true,
      item: wallet.item || L.item,
      price: fees.price,
      buyFee: fees.buyFee,
      totalPaid: fees.totalBuy,
      sellerName: L.sellerName,
      goldAfter: wallet.goldAfter,
      walletRev: wallet.walletRev,
      message: "購買成功。支付 " + fees.price.toLocaleString() + "＋手續費 " + fees.buyFee.toLocaleString() + "＝" + fees.totalBuy.toLocaleString() + " 金幣。",
    });
  }

  if (u === "/api/auction/cancel" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const auth = await auctionRequireAuth(data, res, sql);
    if (!auth) return;
    const account = auth.account;
    const listingId = String(data.listingId || "").slice(0, 48);
    const rows = await sql`
      DELETE FROM rt_auction_listings WHERE id = ${listingId}
      RETURNING id, seller_account, payload, expires_at, created_at`;
    const L = listingFromRow(rows[0]);
    if (!L) return jsonRes(res, 404, { ok: false, error: "gone", message: "找不到此上架。" });
    if (L.sellerAccount !== account) {
      await saveListing(sql, L);
      return jsonRes(res, 403, { ok: false, error: "forbidden", message: "只能下架自己的商品。" });
    }
    const sellerSlot = normSlot(L.sellerSlot || data.slot);
    const restored = await sqlAddItem(sql, account, sellerSlot, L.item);
    if (!restored.ok) {
      // 雲端入包失敗：改待領取，避免物品消失
      await pushClaim(sql, account, {
        id: newId("C"),
        type: "item",
        item: L.item,
        reason: "cancel_fallback",
        listingId: L.id,
        slot: sellerSlot,
        at: Date.now(),
      });
      return jsonRes(res, 200, {
        ok: true,
        item: L.item,
        deferred: true,
        message: "已下架。物品已改為待領取（雲端背包忙碌），請至「我的」領回。上架手續費不退還。",
      });
    }
    return jsonRes(res, 200, {
      ok: true,
      item: restored.item || L.item,
      goldAfter: restored.goldAfter,
      walletRev: restored.walletRev,
      message: "已下架。上架手續費不退還。",
    });
  }

  if (u === "/api/auction/claim" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const auth = await auctionRequireAuth(data, res, sql);
    if (!auth) return;
    const account = auth.account;
    const viewerSlot = normSlot(data.slot);
    const claimId = data.claimId ? String(data.claimId).slice(0, 48) : "";
    let taken = [];
    if (claimId) {
      const rows = await sql`
        DELETE FROM rt_auction_claims
        WHERE account = ${account} AND claim_id = ${claimId}
        RETURNING claim_id, payload`;
      if (!rows.length) return jsonRes(res, 404, { ok: false, error: "gone", message: "找不到此筆領取。" });
      taken = rows.map((r) => ({ id: r.claim_id, ...r.payload }));
    } else {
      const rows = await sql`
        DELETE FROM rt_auction_claims WHERE account = ${account}
        RETURNING claim_id, payload`;
      taken = rows.map((r) => ({ id: r.claim_id, ...r.payload }));
    }

    // 伺服器入帳：金幣／物品必須寫入 cloud_slots，否則本機加錢會被 mergeWalletAuthority 擋掉
    const applied = [];
    let goldAfter = null;
    let walletRev = null;
    for (const c of taken) {
      if (!c) continue;
      const cSlot = normSlot(c.slot != null && c.slot !== "" ? c.slot : viewerSlot);
      if (c.type === "gold") {
        const amt = Math.max(0, Math.floor(Number(c.amount) || 0));
        if (amt <= 0) {
          applied.push(Object.assign({}, c, { applied: false, error: "bad_amount" }));
          continue;
        }
        const r = await sqlCreditGold(sql, account, cSlot, amt);
        if (!r.ok) {
          // 入帳失敗：放回待領取
          await pushClaim(sql, account, Object.assign({}, c, { id: c.id || newId("G") }));
          applied.push(Object.assign({}, c, { applied: false, error: r.error || "credit_failed" }));
          continue;
        }
        applied.push(Object.assign({}, c, { applied: true, slot: cSlot }));
        if (cSlot === viewerSlot) {
          goldAfter = r.goldAfter;
          walletRev = r.walletRev;
        }
      } else if (c.type === "item" && c.item) {
        const r = await sqlAddItem(sql, account, cSlot, c.item);
        if (!r.ok) {
          await pushClaim(sql, account, Object.assign({}, c, { id: c.id || newId("X") }));
          applied.push(Object.assign({}, c, { applied: false, error: r.error || "add_failed" }));
          continue;
        }
        applied.push(
          Object.assign({}, c, {
            applied: true,
            slot: cSlot,
            item: r.item || c.item,
          })
        );
        if (cSlot === viewerSlot) {
          goldAfter = r.goldAfter != null ? r.goldAfter : goldAfter;
          walletRev = r.walletRev != null ? r.walletRev : walletRev;
        }
      } else {
        applied.push(Object.assign({}, c, { applied: false, error: "unknown_type" }));
      }
    }

    const okApplied = applied.filter((x) => x && x.applied);
    return jsonRes(res, 200, {
      ok: true,
      claims: okApplied,
      deferred: applied.filter((x) => x && !x.applied),
      goldAfter,
      walletRev,
      message: okApplied.length
        ? "領取成功（已寫入雲端錢包／背包）。"
        : taken.length
          ? "領取入帳失敗，已保留待領取，請稍後再試。"
          : "沒有待領取內容。",
    });
  }

  return jsonRes(res, 404, { ok: false, error: "unknown auction api" });
}

module.exports = { handleAuctionApi };

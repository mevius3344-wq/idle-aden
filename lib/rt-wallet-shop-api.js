/**
 * 🌐 P5a 錢包／商店 API
 */
"use strict";

const path = require("path");
const { getSql, ensureSchema } = require("./db");
const { jsonRes, corsPreflight, accountKey, normalizeAccountId } = require("./game-utils");
const { parseJsonBody } = require("./rt-common");
const { goldOf, walletRevOf, sqlLoadSlot, normSlot } = require("./rt-cloud-wallet");
const { shopBuy, shopSell, econAuthEnabled, buyQuote, sellUnitOf } = require("./rt-shop");
const { warehouseMove, warehouseGet } = require("./rt-warehouse");
const { econSink, sinkQuote, SINK_TABLE } = require("./rt-econ-sink");
const { verifyAccountSessionSql } = require("./rt-account-session");
const _antiCheat = require("./rt-anti-cheat");

const ROOT = path.join(__dirname, "..");

async function requireAuth(data, res, sql) {
  const auth = _antiCheat.authFromBody(data || {}, ROOT);
  if (!auth.ok) {
    jsonRes(res, 401, {
      ok: false,
      error: auth.error || "auth_required",
      message: "需要有效登入，請重新登入。",
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
      message: "登入已失效，請重新登入。",
    });
    return null;
  }
  return auth;
}

async function handleWalletShopApi(req, res, u) {
  if (req.method === "OPTIONS") {
    return corsPreflight(res, "GET,POST,OPTIONS");
  }

  if (u === "/api/econ/status" && req.method === "GET") {
    return jsonRes(res, 200, {
      ok: true,
      econAuth: econAuthEnabled(),
      p5a: true,
      p5b: true,
      p5c: true,
      sprint3: true,
      sinks: Object.keys(SINK_TABLE),
    });
  }

  if (!econAuthEnabled()) {
    return jsonRes(res, 503, {
      ok: false,
      error: "econ_off",
      message: "經濟權威未啟用（ECON_AUTH）。",
    });
  }

  const sql = getSql();
  await ensureSchema();

  if (u === "/api/wallet" && req.method === "GET") {
    // query: account, slot, auth via header not available — use body-less GET with query authToken?
    // 與拍賣一致：可 POST 查，或 GET + query
    const url = new URL(req.url || "/", "http://localhost");
    const account = String(url.searchParams.get("account") || "").trim();
    const slot = normSlot(url.searchParams.get("slot"));
    const authToken = String(url.searchParams.get("authToken") || "").trim();
    const sessionId = String(url.searchParams.get("sessionId") || "").trim();
    const auth = await requireAuth({ account, authToken, sessionId }, res, sql);
    if (!auth) return;
    const loaded = await sqlLoadSlot(sql, auth.account, slot);
    if (!loaded) {
      return jsonRes(res, 404, {
        ok: false,
        error: "no_save",
        message: "找不到雲端角色存檔，請先存檔後再試。",
      });
    }
    return jsonRes(res, 200, {
      ok: true,
      gold: goldOf(loaded.data),
      walletRev: walletRevOf(loaded.data),
      slot: loaded.slot,
      updatedAt: loaded.updatedAt,
    });
  }

  if (u === "/api/shop/quote" && req.method === "POST") {
    let data;
    try {
      data = await parseJsonBody(req);
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad_json" });
    }
    const q = buyQuote(data.itemId, data.qty);
    return jsonRes(res, q.ok ? 200 : 400, q);
  }

  if (u === "/api/shop/buy" && req.method === "POST") {
    let data;
    try {
      data = await parseJsonBody(req);
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad_json" });
    }
    const auth = await requireAuth(data, res, sql);
    if (!auth) return;
    const slot = normSlot(data.slot);
    const result = await shopBuy(sql, auth.account, slot, data.itemId, data.qty);
    if (!result || !result.ok) {
      const code =
        result && result.error === "gold_short"
          ? 402
          : result && result.error === "no_save"
            ? 404
            : 400;
      return jsonRes(res, code, result || { ok: false, error: "buy_failed" });
    }
    return jsonRes(res, 200, {
      ok: true,
      gold: result.goldAfter,
      walletRev: result.walletRev,
      itemId: result.itemId,
      gained: result.gained,
      cost: result.cost,
      uid: result.uid || "",
    });
  }

  // 🌐 P5b：販售（單筆 uid／或 items:[{uid,qty}] 批次）
  if (u === "/api/shop/sell" && req.method === "POST") {
    let data;
    try {
      data = await parseJsonBody(req);
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad_json" });
    }
    const auth = await requireAuth(data, res, sql);
    if (!auth) return;
    const slot = normSlot(data.slot);
    const result = await shopSell(sql, auth.account, slot, data);
    if (!result || !result.ok) {
      const code =
        result && result.error === "no_save"
          ? 404
          : result && (result.error === "item_missing" || result.error === "item_short")
            ? 409
            : 400;
      return jsonRes(res, code, result || { ok: false, error: "sell_failed" });
    }
    return jsonRes(res, 200, {
      ok: true,
      gold: result.goldAfter,
      walletRev: result.walletRev,
      credit: result.credit,
      sold: result.sold || [],
    });
  }

  // 可選：報價（不寫檔；依客戶端傳入的詞綴試算，權威仍以雲端實物為準）
  if (u === "/api/shop/sell-quote" && req.method === "POST") {
    let data;
    try {
      data = await parseJsonBody(req);
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad_json" });
    }
    const q = sellUnitOf({
      id: data.itemId || data.id,
      attr: data.attr,
      bless: data.bless,
      anc: data.anc,
      lock: data.lock,
      rental: data.rental,
      expireAt: data.expireAt,
    });
    const qty = Math.max(1, Math.min(99999, Math.floor(Number(data.qty) || 1)));
    if (!q.ok) return jsonRes(res, 400, q);
    return jsonRes(res, 200, {
      ok: true,
      itemId: q.itemId,
      unit: q.unit,
      qty: qty,
      credit: q.unit * qty,
    });
  }

  // 🌐 P5c：倉庫查詢（帳號共用·classic 決定 warehouse / warehouse_classic）
  if (u === "/api/warehouse" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const account = String(url.searchParams.get("account") || "").trim();
    const authToken = String(url.searchParams.get("authToken") || "").trim();
    const sessionId = String(url.searchParams.get("sessionId") || "").trim();
    const classic =
      url.searchParams.get("classic") === "1" ||
      url.searchParams.get("classic") === "true" ||
      url.searchParams.get("classicMode") === "1" ||
      url.searchParams.get("classicMode") === "true";
    const auth = await requireAuth({ account, authToken, sessionId }, res, sql);
    if (!auth) return;
    const got = await warehouseGet(sql, auth.account, classic);
    return jsonRes(res, 200, got);
  }

  // 🌐 P5c：倉庫存／領（物品或金幣）
  if (u === "/api/warehouse/move" && req.method === "POST") {
    let data;
    try {
      data = await parseJsonBody(req);
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad_json" });
    }
    const auth = await requireAuth(data, res, sql);
    if (!auth) return;
    const slot = normSlot(data.slot);
    const result = await warehouseMove(sql, auth.account, slot, data);
    if (!result || !result.ok) {
      const err = result && result.error;
      const code =
        err === "no_save"
          ? 404
          : err === "gold_short" || err === "wh_gold_short"
            ? 402
            : err === "item_missing" || err === "item_short" || err === "conflict" || err === "wh_full"
              ? 409
              : 400;
      return jsonRes(res, code, result || { ok: false, error: "move_failed" });
    }
    return jsonRes(res, 200, {
      ok: true,
      dir: data.dir,
      kind: data.kind || "item",
      gold: result.goldAfter,
      goldAfter: result.goldAfter,
      walletRev: result.walletRev,
      whGold: result.whGold,
      whRev: result.whRev,
      warehouse: result.warehouse,
      moved: result.moved || null,
      classic: result.classic,
    });
  }

  // 🌐 Sprint3：白名單支出（固定價·不信客戶端 amount）
  if (u === "/api/econ/sink-quote" && req.method === "POST") {
    let data;
    try {
      data = await parseJsonBody(req);
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad_json" });
    }
    const q = sinkQuote(data.kind, data.qty);
    return jsonRes(res, q.ok ? 200 : 400, q);
  }

  if (u === "/api/econ/sink" && req.method === "POST") {
    let data;
    try {
      data = await parseJsonBody(req);
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad_json" });
    }
    const auth = await requireAuth(data, res, sql);
    if (!auth) return;
    const slot = normSlot(data.slot);
    const result = await econSink(sql, auth.account, slot, data.kind, data.qty);
    if (!result || !result.ok) {
      const err = result && result.error;
      const code =
        err === "no_save"
          ? 404
          : err === "gold_short"
            ? 402
            : err === "conflict"
              ? 409
              : 400;
      return jsonRes(res, code, result || { ok: false, error: "sink_failed" });
    }
    return jsonRes(res, 200, {
      ok: true,
      kind: result.kind,
      qty: result.qty,
      cost: result.cost,
      label: result.label,
      gold: result.goldAfter,
      goldAfter: result.goldAfter,
      walletRev: result.walletRev,
    });
  }

  return jsonRes(res, 404, { ok: false, error: "unknown econ api" });
}

module.exports = { handleWalletShopApi, econAuthEnabled };

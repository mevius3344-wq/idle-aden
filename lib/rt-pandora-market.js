"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { getSql, ensureSchema } = require("./db");
const { jsonRes, corsPreflight, normalizeAccountId, accountKey } = require("./game-utils");
const { parseJsonBody, newId } = require("./rt-common");

const PANDORA_LOT_MS = 20 * 60 * 1000;
const PANDORA_LOT_ID = "global";
const MIN_BID_ABS = 1000;

let _pool = null;

function loadPool() {
  if (_pool) return _pool;
  try {
    const p = path.join(__dirname, "pandora-gacha-pool.json");
    _pool = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    _pool = [{ id: "wpn_ssword", weight: 100 }];
  }
  return _pool;
}

function rand01() {
  return crypto.randomInt(0, 1_000_000) / 1_000_000;
}

function pickWeighted(pool) {
  let total = 0;
  for (const row of pool) total += Math.max(1, Number(row.weight) || 1);
  let r = rand01() * total;
  for (const row of pool) {
    r -= Math.max(1, Number(row.weight) || 1);
    if (r <= 0) return row.id;
  }
  return pool[pool.length - 1].id;
}

function rollStartPrice(weight) {
  const w = Math.max(1, Math.min(100, Number(weight) || 100));
  let base = 10000;
  let lo = 11;
  let hi = 100;
  if (w === 1) {
    base = 100000;
    lo = 11;
    hi = 1000;
  } else {
    lo = Math.max(1, 11 - 0.1 * w);
    hi = lo * 100;
  }
  const mult = lo + rand01() * (hi - lo);
  return Math.max(1, Math.round(base * mult));
}

function minNextBid(lot) {
  const cur = Math.max(0, Number(lot.highBid) || 0);
  const start = Math.max(1, Number(lot.startPrice) || 1);
  if (cur <= 0) return start;
  return cur + Math.max(MIN_BID_ABS, Math.floor(cur * 0.05));
}

async function loadLotRow(sql) {
  const rows = await sql`SELECT payload FROM rt_pandora_lot WHERE id = ${PANDORA_LOT_ID} LIMIT 1`;
  if (!rows.length || !rows[0].payload) return null;
  return rows[0].payload;
}

async function saveLotRow(sql, lot) {
  const now = Date.now();
  await sql`INSERT INTO rt_pandora_lot (id, payload, updated_at) VALUES (${PANDORA_LOT_ID}, ${lot}, ${now})
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`;
}

async function pushClaim(sql, account, claim) {
  const a = String(account || "").trim().slice(0, 32);
  if (!a || !claim) return;
  await sql`INSERT INTO rt_pandora_claims (account, claim_id, payload, at)
    VALUES (${a}, ${claim.id}, ${claim}, ${claim.at || Date.now()})
    ON CONFLICT (account, claim_id) DO NOTHING`;
  const rows = await sql`SELECT claim_id FROM rt_pandora_claims WHERE account = ${a} ORDER BY at ASC`;
  if (rows.length > 120) {
    for (const r of rows.slice(0, rows.length - 120)) {
      await sql`DELETE FROM rt_pandora_claims WHERE account = ${a} AND claim_id = ${r.claim_id}`;
    }
  }
}

async function settleLot(sql, lot) {
  if (!lot || !lot.itemId) return;
  const now = Date.now();
  if (lot.highAccount && lot.highBid > 0) {
    await pushClaim(sql, lot.highAccount, {
      id: newId("P"),
      type: "item",
      itemId: lot.itemId,
      bless: !!lot.bless,
      price: lot.highBid,
      lotId: lot.lotId,
      at: now,
    });
  }
}

async function createLot(sql) {
  const pool = loadPool();
  const itemId = pickWeighted(pool);
  const row = pool.find((p) => p.id === itemId) || { weight: 100 };
  const bless = rand01() < 0.01;
  const startPrice = rollStartPrice(row.weight);
  const now = Date.now();

  const orders = await sql`SELECT account, item_id, max_price, char_name, slot FROM rt_pandora_buy_orders WHERE item_id = ${itemId} ORDER BY max_price DESC LIMIT 1`;
  const sponsor = orders[0] || null;

  const prev = await loadLotRow(sql);
  const lot = {
    lotId: newId("lot"),
    itemId,
    bless,
    weight: row.weight,
    startPrice,
    highBid: 0,
    highAccount: "",
    highCharName: "",
    highSlot: 0,
    endsAt: now + PANDORA_LOT_MS,
    createdAt: now,
    seq: (Number(prev && prev.seq) || 0) + 1,
    sponsorAccount: sponsor ? sponsor.account : "",
    sponsorCharName: sponsor ? sponsor.char_name : "",
    sponsorMax: sponsor ? Number(sponsor.max_price) : 0,
  };
  await saveLotRow(sql, lot);
  return lot;
}

async function ensureLot(sql) {
  let lot = await loadLotRow(sql);
  const now = Date.now();
  if (!lot || !lot.itemId || !lot.endsAt || now >= Number(lot.endsAt)) {
    if (lot && lot.itemId && now >= Number(lot.endsAt)) await settleLot(sql, lot);
    lot = await createLot(sql);
  }
  return lot;
}

function publicLot(lot, account) {
  if (!lot) return null;
  const ak = accountKey(account || "");
  return {
    lotId: lot.lotId,
    itemId: lot.itemId,
    bless: !!lot.bless,
    weight: lot.weight || 100,
    startPrice: lot.startPrice,
    highBid: lot.highBid || 0,
    highCharName: lot.highCharName || "",
    highAccount: lot.highAccount || "",
    isLeader: !!(ak && lot.highAccount && accountKey(lot.highAccount) === ak),
    endsAt: lot.endsAt,
    msLeft: Math.max(0, Number(lot.endsAt) - Date.now()),
    sponsorCharName: lot.sponsorCharName || "",
    sponsorMax: lot.sponsorMax || 0,
    minBid: minNextBid(lot),
  };
}

async function handlePandoraApi(req, res, u) {
  if (req.method === "OPTIONS") return corsPreflight(res, "GET,POST,DELETE,OPTIONS");
  const sql = getSql();
  await ensureSchema();

  if (u === "/api/pandora/status" && req.method === "GET") {
    const lot = await ensureLot(sql);
    return jsonRes(res, 200, {
      ok: true,
      enabled: true,
      lotMs: PANDORA_LOT_MS,
      lot: publicLot(lot, ""),
    });
  }

  if (u === "/api/pandora/market" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const account = normalizeAccountId(url.searchParams.get("account") || "");
    const lot = await ensureLot(sql);
    let myOrders = [];
    if (account) {
      const rows = await sql`SELECT item_id, max_price, char_name, slot, created_at FROM rt_pandora_buy_orders WHERE account = ${account}`;
      myOrders = rows.map((r) => ({
        itemId: r.item_id,
        maxPrice: Number(r.max_price),
        charName: r.char_name,
        slot: r.slot,
        createdAt: Number(r.created_at),
      }));
    }
    return jsonRes(res, 200, {
      ok: true,
      lot: publicLot(lot, account),
      myBuyOrders: myOrders,
    });
  }

  if (u === "/api/pandora/bid" && req.method === "POST") {
    const data = await parseJsonBody(req);
    const account = normalizeAccountId(data.account);
    if (!account) return jsonRes(res, 403, { ok: false, error: "login_required" });
    const amount = Math.floor(Number(data.amount));
    const slot = Math.max(1, Math.min(8, parseInt(data.slot, 10) || 1));
    const charName = String(data.charName || "未命名").slice(0, 16);
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonRes(res, 400, { ok: false, error: "bad_amount" });
    }

    let lot = await ensureLot(sql);
    const now = Date.now();
    if (now >= Number(lot.endsAt)) {
      await settleLot(sql, lot);
      lot = await createLot(sql);
      return jsonRes(res, 409, { ok: false, error: "lot_ended", lot: publicLot(lot, account) });
    }

    const need = minNextBid(lot);
    if (amount < need) {
      return jsonRes(res, 409, {
        ok: false,
        error: "bid_too_low",
        minBid: need,
        lot: publicLot(lot, account),
      });
    }
    const sameLeader = lot.highAccount && accountKey(lot.highAccount) === accountKey(account);
    if (sameLeader && amount <= lot.highBid) {
      return jsonRes(res, 409, { ok: false, error: "already_leading" });
    }

    const prevAccount = sameLeader ? "" : lot.highAccount;
    const prevBid = sameLeader ? 0 : lot.highBid;
    lot.highBid = amount;
    lot.highAccount = account;
    lot.highCharName = charName;
    lot.highSlot = slot;
    await saveLotRow(sql, lot);

    if (prevAccount && prevBid > 0 && accountKey(prevAccount) !== accountKey(account)) {
      await pushClaim(sql, prevAccount, {
        id: newId("R"),
        type: "gold_refund",
        amount: prevBid,
        lotId: lot.lotId,
        reason: "outbid",
        at: now,
      });
    }

    return jsonRes(res, 200, { ok: true, lot: publicLot(lot, account) });
  }

  if (u === "/api/pandora/buy-order" && req.method === "POST") {
    const data = await parseJsonBody(req);
    const account = normalizeAccountId(data.account);
    if (!account) return jsonRes(res, 403, { ok: false, error: "login_required" });
    const itemId = String(data.itemId || "").slice(0, 80);
    const maxPrice = Math.floor(Number(data.maxPrice));
    const slot = Math.max(1, Math.min(8, parseInt(data.slot, 10) || 1));
    const charName = String(data.charName || "未命名").slice(0, 16);
    if (!itemId || !Number.isFinite(maxPrice) || maxPrice <= 0) {
      return jsonRes(res, 400, { ok: false, error: "bad_order" });
    }
    const now = Date.now();
    await sql`INSERT INTO rt_pandora_buy_orders (account, item_id, max_price, char_name, slot, created_at)
      VALUES (${account}, ${itemId}, ${maxPrice}, ${charName}, ${slot}, ${now})
      ON CONFLICT (account, item_id) DO UPDATE SET max_price = EXCLUDED.max_price, char_name = EXCLUDED.char_name, slot = EXCLUDED.slot, created_at = EXCLUDED.created_at`;
    return jsonRes(res, 200, { ok: true, itemId, maxPrice });
  }

  if (u === "/api/pandora/buy-order" && req.method === "DELETE") {
    const url = new URL(req.url || "/", "http://localhost");
    const account = normalizeAccountId(url.searchParams.get("account") || "");
    const itemId = String(url.searchParams.get("itemId") || "").slice(0, 80);
    if (!account || !itemId) return jsonRes(res, 400, { ok: false, error: "bad_request" });
    await sql`DELETE FROM rt_pandora_buy_orders WHERE account = ${account} AND item_id = ${itemId}`;
    return jsonRes(res, 200, { ok: true });
  }

  if (u === "/api/pandora/claims" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const account = normalizeAccountId(url.searchParams.get("account") || "");
    if (!account) return jsonRes(res, 403, { ok: false, error: "login_required" });
    const rows = await sql`SELECT claim_id, payload FROM rt_pandora_claims WHERE account = ${account} ORDER BY at ASC`;
    return jsonRes(res, 200, {
      ok: true,
      claims: rows.map((r) => ({ id: r.claim_id, ...r.payload })),
    });
  }

  if (u === "/api/pandora/claim" && req.method === "POST") {
    const data = await parseJsonBody(req);
    const account = normalizeAccountId(data.account);
    const claimId = String(data.claimId || "");
    if (!account || !claimId) return jsonRes(res, 400, { ok: false, error: "bad_request" });
    const rows = await sql`SELECT payload FROM rt_pandora_claims WHERE account = ${account} AND claim_id = ${claimId} LIMIT 1`;
    if (!rows.length) return jsonRes(res, 404, { ok: false, error: "missing" });
    const claim = rows[0].payload;
    await sql`DELETE FROM rt_pandora_claims WHERE account = ${account} AND claim_id = ${claimId}`;
    return jsonRes(res, 200, { ok: true, claim });
  }

  return jsonRes(res, 404, { ok: false, error: "unknown pandora api" });
}

module.exports = { handlePandoraApi, PANDORA_LOT_MS };

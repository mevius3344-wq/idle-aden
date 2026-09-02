"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { getSql, ensureSchema } = require("./db");
const { jsonRes, corsPreflight, normalizeAccountId, accountKey } = require("./game-utils");
const { parseJsonBody, newId, nextCounter } = require("./rt-common");

const PANDORA_LOT_MS = 20 * 60 * 1000;
const PANDORA_GAP_MS = 60 * 60 * 1000;
const PANDORA_LOT_ID = "global";
const MIN_BID_ABS = 1000;
const CHAT_MAX = 250;

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

async function trimChat(sql) {
  const rows = await sql`SELECT COUNT(*)::int AS c FROM rt_chat`;
  const extra = (rows[0]?.c || 0) - CHAT_MAX;
  if (extra <= 0) return;
  await sql`DELETE FROM rt_chat WHERE seq IN (
    SELECT seq FROM rt_chat ORDER BY seq ASC LIMIT ${extra}
  )`;
}

async function pushWorldBroadcast(sql, text, extra) {
  const seq = await nextCounter(sql, "chat_seq");
  const at = Date.now();
  const payload = {
    v: 1,
    id: "pandora_" + newId("b"),
    ch: "world",
    text: String(text || "").slice(0, 120),
    name: "潘朵拉",
    alignment: 0,
    classic: true,
    account: "",
    at,
    seq,
    ...(extra || {}),
  };
  await sql`INSERT INTO rt_chat (seq, payload, at) VALUES (${seq}, ${payload}, ${at})`;
  await trimChat(sql);
  return payload;
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

function gapState(prevSeq, unsoldLot) {
  const now = Date.now();
  const state = {
    phase: "gap",
    seq: Number(prevSeq) || 0,
    nextLotAt: now + PANDORA_GAP_MS,
  };
  if (unsoldLot && unsoldLot.itemId && !(Number(unsoldLot.highBid) > 0 && unsoldLot.highAccount)) {
    state.retainItem = {
      itemId: unsoldLot.itemId,
      bless: !!unsoldLot.bless,
      weight: unsoldLot.weight || 100,
      startPrice: unsoldLot.startPrice,
    };
  }
  return state;
}

async function reactivateLot(sql, retain, prevSeq) {
  const now = Date.now();
  const lot = {
    phase: "active",
    lotId: newId("lot"),
    itemId: retain.itemId,
    bless: !!retain.bless,
    weight: retain.weight || 100,
    startPrice: retain.startPrice,
    highBid: 0,
    highAccount: "",
    highCharName: "",
    highSlot: 0,
    endsAt: now + PANDORA_LOT_MS,
    createdAt: now,
    seq: (Number(prevSeq) || 0) + 1,
  };
  await saveLotRow(sql, lot);
  return lot;
}

async function createLot(sql, prevSeq) {
  const pool = loadPool();
  const itemId = pickWeighted(pool);
  const row = pool.find((p) => p.id === itemId) || { weight: 100 };
  const bless = rand01() < 0.01;
  const startPrice = rollStartPrice(row.weight);
  const now = Date.now();

  const lot = {
    phase: "active",
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
    seq: (Number(prevSeq) || 0) + 1,
  };
  await saveLotRow(sql, lot);
  await pushWorldBroadcast(
    sql,
    `【潘朵拉黑市】新商品上架競標！代碼 ${itemId}，起標 ${startPrice.toLocaleString()} 金，競標 20 分鐘！`,
    { pandoraLot: { itemId, bless, startPrice: lot.startPrice, weight: lot.weight, seq: lot.seq } }
  );
  return lot;
}

async function ensureLot(sql) {
  let state = await loadLotRow(sql);
  const now = Date.now();

  if (!state) {
    return await createLot(sql, 0);
  }

  // 舊版資料（無 phase）：補上 active / gap 狀態
  if (!state.phase && state.itemId && state.endsAt) {
    state.phase = now >= Number(state.endsAt) ? "gap" : "active";
    if (state.phase === "gap" && !state.nextLotAt) {
      state = gapState(state.seq);
    }
  }

  if (state.phase === "active" && state.itemId && state.endsAt && now >= Number(state.endsAt)) {
    const hadWinner = !!(state.highAccount && state.highBid > 0);
    await settleLot(sql, state);
    state = gapState(state.seq, hadWinner ? null : state);
    await saveLotRow(sql, state);
    return state;
  }

  if (state.phase === "gap") {
    if (!state.nextLotAt || now >= Number(state.nextLotAt)) {
      if (state.retainItem && state.retainItem.itemId) {
        return await reactivateLot(sql, state.retainItem, state.seq);
      }
      return await createLot(sql, state.seq);
    }
    return state;
  }

  if (!state.itemId) {
    return await createLot(sql, state.seq || 0);
  }

  if (!state.phase) state.phase = "active";
  return state;
}

function publicLot(state, account) {
  if (!state) return null;
  const now = Date.now();
  if (state.phase === "gap") {
    const retain = state.retainItem || null;
    return {
      phase: "gap",
      seq: state.seq || 0,
      nextLotAt: state.nextLotAt || 0,
      msUntilNext: Math.max(0, Number(state.nextLotAt || 0) - now),
      gapMs: PANDORA_GAP_MS,
      retainItemId: retain ? retain.itemId : null,
      retainBless: retain ? !!retain.bless : false,
      retainWeight: retain ? retain.weight || 100 : 0,
    };
  }
  const ak = accountKey(account || "");
  return {
    phase: "active",
    lotId: state.lotId,
    itemId: state.itemId,
    bless: !!state.bless,
    weight: state.weight || 100,
    startPrice: state.startPrice,
    highBid: state.highBid || 0,
    highCharName: state.highCharName || "",
    highAccount: state.highAccount || "",
    isLeader: !!(ak && state.highAccount && accountKey(state.highAccount) === ak),
    endsAt: state.endsAt,
    msLeft: Math.max(0, Number(state.endsAt) - now),
    lotMs: PANDORA_LOT_MS,
    seq: state.seq || 0,
    minBid: minNextBid(state),
  };
}

async function handlePandoraApi(req, res, u) {
  if (req.method === "OPTIONS") return corsPreflight(res, "GET,POST,OPTIONS");
  const sql = getSql();
  await ensureSchema();

  if (u === "/api/pandora/status" && req.method === "GET") {
    const lot = await ensureLot(sql);
    return jsonRes(res, 200, {
      ok: true,
      enabled: true,
      lotMs: PANDORA_LOT_MS,
      gapMs: PANDORA_GAP_MS,
      lot: publicLot(lot, ""),
    });
  }

  if (u === "/api/pandora/market" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const account = normalizeAccountId(url.searchParams.get("account") || "");
    const lot = await ensureLot(sql);
    return jsonRes(res, 200, {
      ok: true,
      lot: publicLot(lot, account),
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
    if (lot.phase === "gap" || !lot.itemId) {
      return jsonRes(res, 409, { ok: false, error: "lot_gap", lot: publicLot(lot, account) });
    }
    const now = Date.now();
    if (now >= Number(lot.endsAt)) {
      const hadWinner = !!(lot.highAccount && lot.highBid > 0);
      await settleLot(sql, lot);
      const gap = gapState(lot.seq, hadWinner ? null : lot);
      await saveLotRow(sql, gap);
      return jsonRes(res, 409, { ok: false, error: "lot_ended", lot: publicLot(gap, account) });
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

module.exports = { handlePandoraApi, PANDORA_LOT_MS, PANDORA_GAP_MS };

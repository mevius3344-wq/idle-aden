"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { getSql, ensureSchema } = require("./db");
const { jsonRes, corsPreflight, normalizeAccountId, accountKey } = require("./game-utils");
const { parseJsonBody, newId, nextCounter } = require("./rt-common");

/** 🌐 P5 後：潘朵拉改「抽抽樂」——停用全服競標，改付費權重抽獎 */
const PANDORA_MODE = "gacha";
const PANDORA_DRAW_COST = 100000; // 單抽金幣
const PANDORA_DRAW_MAX = 10;
/** 0＝不限次數（v3.8.501） */
const PANDORA_DRAW_DAILY_CAP = 0;
const PANDORA_BLESS_RATE = 0.01;

const PANDORA_LOT_MS = 20 * 60 * 1000;
const PANDORA_GAP_MS = 60 * 60 * 1000;
const PANDORA_LOT_ID = "global";
const MIN_BID_ABS = 1000;
const CHAT_MAX = 250;

let _pool = null;

function isGachaCardId(id) {
  const s = String(id || "");
  return s.startsWith("card_") || s.startsWith("card_p_") || s.startsWith("card_s_") || s.startsWith("card_g_");
}

function loadPool() {
  if (_pool) return _pool;
  try {
    const p = path.join(__dirname, "pandora-gacha-pool.json");
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    // 🎴 v3.8.498：伺服器抽獎池排除怪物卡（雙重保險；動態卡本就不在 json）
    _pool = (Array.isArray(raw) ? raw : []).filter((row) => row && row.id && !isGachaCardId(row.id));
    if (!_pool.length) _pool = [{ id: "wpn_ssword", weight: 100 }];
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

function drawCostOf(qty) {
  const q = Math.max(1, Math.min(PANDORA_DRAW_MAX, Math.floor(Number(qty) || 1)));
  let cost = PANDORA_DRAW_COST * q;
  if (q >= 10) cost = Math.floor(cost * 0.9); // 十連九折
  return { qty: q, cost };
}

function dayStartMs(now) {
  const d = new Date(now || Date.now());
  // 以 UTC+8 日切
  const local = new Date(d.getTime() + 8 * 3600 * 1000);
  local.setUTCHours(0, 0, 0, 0);
  return local.getTime() - 8 * 3600 * 1000;
}

function gachaPublicStatus() {
  return {
    mode: PANDORA_MODE,
    drawCost: PANDORA_DRAW_COST,
    drawMax: PANDORA_DRAW_MAX,
    dailyCap: PANDORA_DRAW_DAILY_CAP,
    blessRate: PANDORA_BLESS_RATE,
    tenDrawDiscount: 0.9,
  };
}

async function countDrawsToday(sql, account) {
  const a = String(account || "").trim().slice(0, 32);
  if (!a) return 0;
  const since = dayStartMs();
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS c FROM rt_pandora_claims
      WHERE account = ${a}
        AND at >= ${since}
        AND payload->>'source' = 'draw'`;
    return Number(rows[0] && rows[0].c) || 0;
  } catch (e) {
    return 0;
  }
}

function rollDrawResult() {
  const pool = loadPool();
  let itemId = pickWeighted(pool);
  // 🎴 若舊池殘留卡片 id：重抽最多 8 次
  for (let n = 0; n < 8 && isGachaCardId(itemId); n++) {
    itemId = pickWeighted(pool);
  }
  if (isGachaCardId(itemId)) {
    itemId = "scroll_teleport";
  }
  const row = pool.find((p) => p.id === itemId) || { weight: 100 };
  const bless = rand01() < PANDORA_BLESS_RATE;
  return {
    itemId,
    bless,
    weight: Math.max(1, Number(row.weight) || 100),
  };
}

/**
 * 抽獎：優先雲端錢包扣款；無存檔／經濟關則 clientDebit，由客戶端扣金。
 */
async function performDraw(sql, account, slot, qty) {
  const acc = normalizeAccountId(account);
  if (!acc) return { ok: false, error: "login_required", message: "請先登入帳號。" };
  const quote = drawCostOf(qty);
  const used = await countDrawsToday(sql, acc);
  if (PANDORA_DRAW_DAILY_CAP > 0 && used + quote.qty > PANDORA_DRAW_DAILY_CAP) {
    return {
      ok: false,
      error: "daily_cap",
      message: "今日抽獎次數已達上限（" + PANDORA_DRAW_DAILY_CAP + "）。",
      used,
      dailyCap: PANDORA_DRAW_DAILY_CAP,
    };
  }

  let clientDebit = true;
  let goldAfter = null;
  let walletRev = null;

  try {
    const { econAuthEnabled } = require("./rt-shop");
    const { sqlMutateSlot, applyDebitGold, goldOf, walletRevOf, normSlot } = require("./rt-cloud-wallet");
    if (econAuthEnabled()) {
      const deb = await sqlMutateSlot(sql, acc, normSlot(slot), (data) => {
        return applyDebitGold(data, quote.cost);
      });
      if (deb && deb.ok) {
        clientDebit = false;
        goldAfter = deb.goldAfter;
        walletRev = deb.walletRev;
      } else if (deb && deb.error === "gold_short") {
        return {
          ok: false,
          error: "gold_short",
          message: "金幣不足（雲端餘額）。",
          need: quote.cost,
        };
      } else if (deb && deb.error === "no_save") {
        clientDebit = true;
      } else if (deb && !deb.ok && deb.error !== "no_save") {
        // 衝突等：仍允許 clientDebit 以免卡死
        clientDebit = true;
      }
    }
  } catch (e) {
    clientDebit = true;
  }

  const now = Date.now();
  const results = [];
  for (let i = 0; i < quote.qty; i++) {
    const roll = rollDrawResult();
    const claimId = newId("D");
    const claim = {
      id: claimId,
      type: "item",
      itemId: roll.itemId,
      bless: !!roll.bless,
      weight: roll.weight,
      source: "draw",
      price: Math.floor(quote.cost / quote.qty),
      at: now + i,
    };
    await pushClaim(sql, acc, claim);
    results.push({
      claimId,
      itemId: roll.itemId,
      bless: !!roll.bless,
      weight: roll.weight,
    });
  }

  // 珍稀（權重 1）世界廣播
  const rares = results.filter((r) => r.weight === 1);
  for (const r of rares) {
    try {
      await pushWorldBroadcast(
        sql,
        `【潘朵拉抽抽樂】有人抽中珍稀寶物（代碼 ${r.itemId}）！`,
        { pandoraDraw: { itemId: r.itemId, bless: r.bless, weight: r.weight } }
      );
    } catch (e2) {}
  }

  return {
    ok: true,
    mode: PANDORA_MODE,
    cost: quote.cost,
    qty: quote.qty,
    clientDebit,
    goldAfter,
    walletRev,
    results,
    usedToday: used + quote.qty,
    dailyCap: PANDORA_DRAW_DAILY_CAP,
    ...gachaPublicStatus(),
  };
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

let _dupCleanupDone = false;

/**
 * 歷史髒資料：並發結標曾寫入多筆同一 lot 的 item claim。
 * 同一 account + lotId 只保留 at／claim_id 最早的一筆。
 */
async function cleanupDuplicatePandoraItemClaims(sql, opts) {
  const dryRun = !!(opts && opts.dryRun);
  const rows = await sql`
    SELECT account, claim_id, payload, at
    FROM rt_pandora_claims
    WHERE payload->>'type' = 'item'
    ORDER BY at ASC, claim_id ASC`;
  const best = new Map();
  const drop = [];
  for (const r of rows) {
    const lotId = String((r.payload && r.payload.lotId) || "").trim();
    if (!lotId) continue;
    const key = String(r.account || "") + "\0" + lotId;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, r);
      continue;
    }
    const rAt = Number(r.at) || 0;
    const pAt = Number(prev.at) || 0;
    if (rAt < pAt || (rAt === pAt && String(r.claim_id) < String(prev.claim_id))) {
      drop.push(prev);
      best.set(key, r);
    } else {
      drop.push(r);
    }
  }
  if (!dryRun) {
    for (const d of drop) {
      await sql`DELETE FROM rt_pandora_claims WHERE account = ${d.account} AND claim_id = ${d.claim_id}`;
    }
  }
  return { scanned: rows.length, groups: best.size, deleted: drop.length };
}

async function maybeCleanupDuplicateClaims(sql) {
  if (_dupCleanupDone) return;
  _dupCleanupDone = true;
  try {
    const r = await cleanupDuplicatePandoraItemClaims(sql, { dryRun: false });
    if (r.deleted > 0) {
      console.log("[pandora] cleaned duplicate item claims:", r.deleted);
    }
  } catch (e) {
    _dupCleanupDone = false;
    console.warn("[pandora] duplicate claim cleanup failed:", e && e.message ? e.message : e);
  }
}

async function settleLot(sql, lot) {
  if (!lot || !lot.itemId) return;
  const now = Date.now();
  if (lot.highAccount && lot.highBid > 0) {
    // 冪等：同一 lot 只允許一筆得標 claim（並發 ensureLot／bid 結標時 ON CONFLICT 擋掉重複）
    const lotKey = String(lot.lotId || "").trim() || "unknown";
    await pushClaim(sql, lot.highAccount, {
      id: "P:" + lotKey,
      type: "item",
      itemId: lot.itemId,
      bless: !!lot.bless,
      price: lot.highBid,
      lotId: lot.lotId,
      at: now,
    });
  }
}

/** 競標逾時：先寫得標 claim，再 CAS 切 gap，避免並發重複結標／重複領 */
async function closeLotIfExpired(sql, state) {
  if (!state || state.phase !== "active" || !state.itemId || !state.endsAt) return state;
  const now = Date.now();
  if (now < Number(state.endsAt)) return state;

  await settleLot(sql, state);
  const hadWinner = !!(state.highAccount && state.highBid > 0);
  const gap = gapState(state.seq, hadWinner ? null : state);
  gap.settledLotId = state.lotId || "";

  const lotKey = String(state.lotId || "");
  const updated = await sql`
    UPDATE rt_pandora_lot
    SET payload = ${gap}, updated_at = ${now}
    WHERE id = ${PANDORA_LOT_ID}
      AND payload->>'phase' = 'active'
      AND COALESCE(payload->>'lotId', '') = ${lotKey}
    RETURNING id`;
  if (!updated.length) {
    return (await loadLotRow(sql)) || gap;
  }
  return gap;
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
    return await closeLotIfExpired(sql, state);
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
  await maybeCleanupDuplicateClaims(sql);

  if (u === "/api/pandora/status" && req.method === "GET") {
    return jsonRes(res, 200, {
      ok: true,
      enabled: true,
      ...gachaPublicStatus(),
    });
  }

  if (u === "/api/pandora/market" && req.method === "GET") {
    return jsonRes(res, 200, {
      ok: true,
      ...gachaPublicStatus(),
      lot: null,
    });
  }

  // 🌐 抽抽樂：付費權重抽獎
  if (u === "/api/pandora/draw" && req.method === "POST") {
    let data;
    try {
      data = await parseJsonBody(req);
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad_json" });
    }
    const account = normalizeAccountId(data.account);
    if (!account) return jsonRes(res, 403, { ok: false, error: "login_required", message: "請先登入帳號。" });
    const result = await performDraw(sql, account, data.slot, data.qty);
    if (!result || !result.ok) {
      const code =
        result && result.error === "gold_short"
          ? 402
          : result && result.error === "daily_cap"
            ? 429
            : result && result.error === "login_required"
              ? 403
              : 400;
      return jsonRes(res, code, result || { ok: false, error: "draw_failed" });
    }
    return jsonRes(res, 200, result);
  }

  if (u === "/api/pandora/bid" && req.method === "POST") {
    return jsonRes(res, 410, {
      ok: false,
      error: "auction_retired",
      message: "潘朵拉已改為抽抽樂，請使用抽獎。",
      ...gachaPublicStatus(),
    });
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
    // 原子領取：並發 POST 只有一筆能 DELETE 成功，避免重複發放
    const rows = await sql`
      DELETE FROM rt_pandora_claims
      WHERE account = ${account} AND claim_id = ${claimId}
      RETURNING payload`;
    if (!rows.length) return jsonRes(res, 404, { ok: false, error: "missing" });
    const claim = rows[0].payload;
    return jsonRes(res, 200, { ok: true, claim });
  }

  return jsonRes(res, 404, { ok: false, error: "unknown pandora api" });
}

module.exports = {
  handlePandoraApi,
  cleanupDuplicatePandoraItemClaims,
  PANDORA_LOT_MS,
  PANDORA_GAP_MS,
  PANDORA_MODE,
  PANDORA_DRAW_COST,
  performDraw,
};

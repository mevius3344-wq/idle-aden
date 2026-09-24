"use strict";

/**
 * GM 後台：全服倍率（server_config）、帳號封鎖、GM 信箱發道具／金幣、操作紀錄。
 * GM API 以環境變數 GM_TOKEN（≥12 字元）驗證；玩家端只開放 /api/gm/mail/claim。
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { getSql, ensureSchema } = require("./db");
const { normalizeAccountId, accountKey, readBody, clientIp, jsonRes, corsPreflight } = require("./game-utils");
const _antiCheat = require("./rt-anti-cheat");
const { verifyAccountSessionSql, releaseAccountSessionSql } = require("./rt-account-session");
const { applyCreditGold, sqlMutateSlot, normSlot } = require("./rt-cloud-wallet");
const { getServerRates } = require("./rt-server-status");

const ROOT = path.join(__dirname, "..");
const PERMA_BAN_UNTIL = 253402300799000;
const RATE_MAX = 50;
const RATES_CACHE_MS = 10000;
const GRANT_CNT_MAX = 9999;
const GRANT_EN_MAX = 15;
const GRANT_GOLD_MAX = 500000000;
const CLAIM_BATCH = 20;
const EQUIP_TYPES = new Set(["wpn", "arm", "acc"]);

let _ratesCache = { at: 0, value: null };
let _itemDb;
const _authFails = new Map();

/* ───────── 倍率 ───────── */

function clampMult(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(RATE_MAX, Math.round(n * 10) / 10));
}

function effectiveRates(cfg, now) {
  const base = getServerRates();
  const out = {
    expMult: 1,
    goldMult: base.goldMult,
    dropMult: base.dropMult,
    rateEndsAt: 0,
    rateLabel: "",
  };
  if (!cfg) return out;
  const endsAt = Math.max(0, Number(cfg.endsAt) || 0);
  if (endsAt && endsAt <= now) return out;
  out.expMult = clampMult(cfg.expMult, 1);
  out.goldMult = clampMult(cfg.goldMult, base.goldMult);
  out.dropMult = clampMult(cfg.dropMult, base.dropMult);
  out.rateEndsAt = endsAt;
  out.rateLabel = String(cfg.label || "").slice(0, 40);
  return out;
}

async function loadRatesConfigSql(sql) {
  const rows = await sql`SELECT value FROM server_config WHERE key = 'rates' LIMIT 1`;
  return rows.length ? rows[0].value || null : null;
}

async function getEffectiveRatesSql(sql) {
  const now = Date.now();
  if (!_ratesCache.value || now - _ratesCache.at > RATES_CACHE_MS) {
    let cfg = null;
    try {
      cfg = await loadRatesConfigSql(sql);
    } catch (e) {}
    _ratesCache = { at: now, value: { cfg } };
  }
  return effectiveRates(_ratesCache.value.cfg, now);
}

/* ───────── 封鎖 ───────── */

function banActive(until, now) {
  const u = Number(until) || 0;
  return u > (now == null ? Date.now() : now);
}

function banMessage(until, reason) {
  const u = Number(until) || 0;
  let when = "永久";
  if (u < PERMA_BAN_UNTIL) {
    try {
      when = new Date(u).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }) + " 解除";
    } catch (e) {
      when = String(u);
    }
  }
  const r = String(reason || "").trim();
  return "此帳號已被停權（" + when + "）。" + (r ? "原因：" + r : "如有疑問請聯絡管理員。");
}

function banPayload(until, reason) {
  return {
    ok: false,
    error: "banned",
    bannedUntil: Number(until) || 0,
    message: banMessage(until, reason),
  };
}

async function accountBanSql(sql, key) {
  const rows = await sql`SELECT banned_until, ban_reason FROM accounts WHERE account_key = ${key} LIMIT 1`;
  if (!rows.length) return null;
  const until = Number(rows[0].banned_until) || 0;
  if (!banActive(until)) return null;
  return banPayload(until, rows[0].ban_reason);
}

/** 心跳：一次查封鎖狀態＋待領 GM 信件數 */
async function heartbeatGmInfoSql(sql, key, slot) {
  const s = Math.floor(Number(slot) || 0);
  const rows = await sql`
    SELECT a.banned_until, a.ban_reason,
      (SELECT COUNT(*)::int FROM gm_grants g
        WHERE g.account_key = a.account_key AND g.claimed_at IS NULL AND g.cancelled_at IS NULL
          AND (g.slot IS NULL OR g.slot = ${s})) AS mail
    FROM accounts a WHERE a.account_key = ${key} LIMIT 1`;
  if (!rows.length) return { ban: null, mail: 0 };
  const until = Number(rows[0].banned_until) || 0;
  return {
    ban: banActive(until) ? banPayload(until, rows[0].ban_reason) : null,
    mail: s >= 1 ? Number(rows[0].mail) || 0 : 0,
  };
}

/* ───────── 物品資料 ───────── */

function loadItemDb() {
  if (_itemDb !== undefined) return _itemDb;
  _itemDb = null;
  try {
    const src = fs.readFileSync(path.join(ROOT, "js", "00-data.js"), "utf8");
    const noop = function () {};
    const ctx = {
      console: { log: noop, info: noop, warn: noop, error: noop, debug: noop },
      document: { getElementById: () => null, querySelector: () => null, addEventListener: noop },
      localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
      sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
      navigator: {},
      location: { protocol: "http:", hostname: "localhost" },
      setTimeout: noop,
      setInterval: noop,
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(src + "\n;this.__GM_ITEMS = DB.items;", ctx, { timeout: 5000 });
    if (ctx.__GM_ITEMS && typeof ctx.__GM_ITEMS === "object") _itemDb = ctx.__GM_ITEMS;
  } catch (e) {
    console.error("GM_ITEM_DB_LOAD", e && e.message ? e.message : e);
  }
  return _itemDb;
}

function itemListPayload() {
  const db = loadItemDb();
  if (!db) return [];
  return Object.keys(db).map((id) => {
    const d = db[id] || {};
    return {
      id,
      n: String(d.n || id),
      t: String(d.type || ""),
      eq: EQUIP_TYPES.has(d.type) && !d.isArrow ? 1 : 0,
      card: d.eff === "card" ? 1 : 0,
    };
  });
}

/* ───────── GM 驗證／紀錄 ───────── */

function gmTokenConfigured() {
  const t = String(process.env.GM_TOKEN || "").trim();
  return t.length >= 12 ? t : "";
}

function tokenEquals(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function gmAuthCheck(req) {
  const expected = gmTokenConfigured();
  if (!expected) return { ok: false, code: 503, error: "not_configured", message: "伺服器未設定 GM_TOKEN 環境變數（至少 12 字元）。" };
  const ip = clientIp(req);
  const now = Date.now();
  const rec = _authFails.get(ip);
  if (rec && rec.n >= 10 && now - rec.at < 600000) {
    return { ok: false, code: 429, error: "too_many", message: "驗證失敗次數過多，請 10 分鐘後再試。" };
  }
  const auth = String(req.headers.authorization || "");
  const given = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (given && tokenEquals(given, expected)) {
    _authFails.delete(ip);
    return { ok: true, ip };
  }
  const next = rec && now - rec.at < 600000 ? { n: rec.n + 1, at: rec.at } : { n: 1, at: now };
  _authFails.set(ip, next);
  return { ok: false, code: 401, error: "unauthorized", message: "GM_TOKEN 無效。" };
}

async function audit(sql, ip, action, target, detail) {
  try {
    await sql`INSERT INTO gm_audit (at, action, target, detail, ip)
      VALUES (${Date.now()}, ${action}, ${String(target || "").slice(0, 80)}, ${detail || {}}, ${String(ip || "").slice(0, 64)})`;
  } catch (e) {
    console.error("GM_AUDIT", e && e.message ? e.message : e);
  }
}

async function readJson(req) {
  try {
    return JSON.parse((await readBody(req)) || "{}") || {};
  } catch (e) {
    return null;
  }
}

function newGrantUid() {
  return "g" + Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
}

function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (m) => "\\" + m);
}

async function findAccountSql(sql, raw) {
  const account = normalizeAccountId(raw);
  if (!account) return null;
  const key = accountKey(account);
  const rows = await sql`SELECT account_key, account, created_at, banned_until, ban_reason FROM accounts WHERE account_key = ${key} LIMIT 1`;
  return rows.length ? rows[0] : null;
}

/* ───────── 玩家端：領取 GM 信箱 ───────── */

async function handleMailClaim(req, res, sql) {
  const data = await readJson(req);
  if (!data) return jsonRes(res, 400, { ok: false, error: "bad json" });
  const auth = _antiCheat.authFromBody(data, ROOT);
  if (!auth.ok) return jsonRes(res, 401, { ok: false, error: auth.error || "auth_required", message: "登入已失效，請重新登入。" });
  const ak = accountKey(auth.account);
  if (!(await verifyAccountSessionSql(sql, ak, auth.sessionId))) {
    return jsonRes(res, 401, { ok: false, error: "session_invalid", message: "登入已失效，請重新登入。" });
  }
  const ban = await accountBanSql(sql, ak);
  if (ban) return jsonRes(res, 403, ban);
  const slot = normSlot(data.slot);
  const now = Date.now();
  const rows = await sql`
    UPDATE gm_grants SET claimed_at = ${now}, claimed_slot = ${slot}
    WHERE id IN (
      SELECT id FROM gm_grants
      WHERE account_key = ${ak} AND claimed_at IS NULL AND cancelled_at IS NULL AND (slot IS NULL OR slot = ${slot})
      ORDER BY id LIMIT ${CLAIM_BATCH}
      FOR UPDATE SKIP LOCKED)
    RETURNING id, kind, item_id, cnt, en, bless, amount, note`;
  if (!rows.length) return jsonRes(res, 200, { ok: true, items: [], gold: 0 });

  const items = [];
  const goldRows = [];
  let gold = 0;
  for (const r of rows) {
    if (r.kind === "gold") {
      const amt = Math.max(0, Math.floor(Number(r.amount) || 0));
      if (amt > 0) {
        gold += amt;
        goldRows.push(Number(r.id));
      }
      continue;
    }
    items.push({
      grantId: Number(r.id),
      kind: r.kind === "card" ? "card" : "item",
      id: String(r.item_id),
      cnt: Math.max(1, Math.floor(Number(r.cnt) || 1)),
      en: Math.max(0, Math.floor(Number(r.en) || 0)),
      bless: !!r.bless,
      uid: newGrantUid(),
      note: String(r.note || ""),
    });
  }

  let goldAfter = null;
  let walletRev = null;
  const mut = await sqlMutateSlot(sql, auth.account, slot, (save) => {
    if (!Array.isArray(save.p.inv)) save.p.inv = [];
    for (const it of items) {
      if (it.kind !== "item") continue;
      save.p.inv.push({
        id: it.id,
        uid: it.uid,
        cnt: it.cnt,
        en: it.en,
        bless: it.bless,
        anc: false,
        attr: false,
        seteff: false,
        lock: false,
        junk: false,
      });
    }
    if (gold > 0) return applyCreditGold(save, gold);
    return { ok: true };
  });
  if (mut && mut.ok) {
    if (gold > 0) {
      goldAfter = mut.goldAfter;
      walletRev = mut.walletRev;
    }
  } else if (goldRows.length) {
    // 金幣須寫進雲端錢包；角色尚無雲端存檔時退回待領，下次再發
    await sql`UPDATE gm_grants SET claimed_at = NULL, claimed_slot = NULL WHERE id = ANY(${goldRows})`;
    gold = 0;
  }
  return jsonRes(res, 200, { ok: true, items, gold, goldAfter, walletRev, slot });
}

/* ───────── GM 端 ───────── */

async function gmOverview(res, sql) {
  const cfg = await loadRatesConfigSql(sql);
  const now = Date.now();
  const eff = effectiveRates(cfg, now);
  const base = getServerRates();
  const pending = await sql`SELECT COUNT(*)::int AS c FROM gm_grants WHERE claimed_at IS NULL AND cancelled_at IS NULL`;
  const banned = await sql`SELECT COUNT(*)::int AS c FROM accounts WHERE banned_until > ${now}`;
  const accounts = await sql`SELECT COUNT(*)::int AS c FROM accounts`;
  return jsonRes(res, 200, {
    ok: true,
    now,
    rates: { config: cfg, effective: eff, envBase: base, max: RATE_MAX },
    counts: {
      accounts: accounts[0]?.c || 0,
      banned: banned[0]?.c || 0,
      pendingGrants: pending[0]?.c || 0,
    },
  });
}

async function gmSearch(res, sql, q) {
  const s = String(q || "").trim().slice(0, 32);
  if (!s) return jsonRes(res, 200, { ok: true, accounts: [], chars: [] });
  const like = escapeLike(s) + "%";
  const likeAny = "%" + escapeLike(s) + "%";
  const now = Date.now();
  const accounts = await sql`
    SELECT account, created_at, banned_until FROM accounts
    WHERE account ILIKE ${like} ORDER BY account LIMIT 20`;
  const chars = await sql`
    SELECT name, account, slot FROM char_names
    WHERE name ILIKE ${likeAny} ORDER BY name LIMIT 20`;
  return jsonRes(res, 200, {
    ok: true,
    accounts: accounts.map((r) => ({
      account: r.account,
      createdAt: Number(r.created_at) || 0,
      banned: banActive(r.banned_until, now),
    })),
    chars: chars.map((r) => ({ name: r.name, account: r.account, slot: Number(r.slot) || 0 })),
  });
}

async function gmAccountDetail(res, sql, raw) {
  const acc = await findAccountSql(sql, raw);
  if (!acc) return jsonRes(res, 404, { ok: false, error: "missing", message: "查無此帳號。" });
  const key = acc.account_key;
  const slots = await sql`
    SELECT slot, updated_at,
      data->'p'->>'name' AS name, data->'p'->>'cls' AS cls,
      data->'p'->>'lv' AS lv, data->'p'->>'gold' AS gold,
      COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(data->'p'->'inv') = 'array' THEN data->'p'->'inv' ELSE '[]'::jsonb END), 0) AS inv_n
    FROM cloud_slots WHERE account_key = ${key} ORDER BY slot`;
  const sess = await sql`SELECT last_seen_ms FROM account_sessions WHERE account_key = ${key} LIMIT 1`;
  const grants = await sql`
    SELECT id, slot, kind, item_id, cnt, en, bless, amount, note, created_at, claimed_at, claimed_slot, cancelled_at
    FROM gm_grants WHERE account_key = ${key} ORDER BY id DESC LIMIT 40`;
  const now = Date.now();
  return jsonRes(res, 200, {
    ok: true,
    account: acc.account,
    createdAt: Number(acc.created_at) || 0,
    bannedUntil: Number(acc.banned_until) || 0,
    banned: banActive(acc.banned_until, now),
    banReason: acc.ban_reason || "",
    lastSeenMs: sess.length ? Number(sess[0].last_seen_ms) || 0 : 0,
    slots: slots.map((r) => ({
      slot: Number(r.slot),
      name: r.name || "",
      cls: r.cls || "",
      lv: Number(r.lv) || 0,
      gold: Number(r.gold) || 0,
      invCount: Number(r.inv_n) || 0,
      updatedAt: Number(r.updated_at) || 0,
    })),
    grants: grants.map((r) => ({
      id: Number(r.id),
      slot: r.slot == null ? null : Number(r.slot),
      kind: r.kind,
      itemId: r.item_id,
      cnt: Number(r.cnt) || 0,
      en: Number(r.en) || 0,
      bless: !!r.bless,
      amount: Number(r.amount) || 0,
      note: r.note || "",
      createdAt: Number(r.created_at) || 0,
      claimedAt: r.claimed_at == null ? 0 : Number(r.claimed_at),
      claimedSlot: r.claimed_slot == null ? null : Number(r.claimed_slot),
      cancelledAt: r.cancelled_at == null ? 0 : Number(r.cancelled_at),
    })),
  });
}

async function gmSlotInventory(res, sql, raw, slotRaw) {
  const acc = await findAccountSql(sql, raw);
  if (!acc) return jsonRes(res, 404, { ok: false, error: "missing", message: "查無此帳號。" });
  const slot = normSlot(slotRaw);
  const rows = await sql`SELECT data->'p'->'inv' AS inv, updated_at FROM cloud_slots WHERE account_key = ${acc.account_key} AND slot = ${slot} LIMIT 1`;
  if (!rows.length) return jsonRes(res, 404, { ok: false, error: "no_save", message: "此存檔位沒有雲端角色。" });
  const inv = Array.isArray(rows[0].inv) ? rows[0].inv : [];
  return jsonRes(res, 200, {
    ok: true,
    slot,
    updatedAt: Number(rows[0].updated_at) || 0,
    inv: inv.slice(0, 300).map((it) => ({
      id: String((it && it.id) || ""),
      cnt: Math.max(1, Math.floor(Number(it && it.cnt) || 1)),
      en: Math.floor(Number(it && it.en) || 0),
      bless: it && it.bless === true ? true : it && it.bless === "cursed" ? "cursed" : false,
      lock: !!(it && it.lock),
    })),
  });
}

async function gmGrant(req, res, sql, ip) {
  const data = await readJson(req);
  if (!data) return jsonRes(res, 400, { ok: false, error: "bad json" });
  const acc = await findAccountSql(sql, data.account);
  if (!acc) return jsonRes(res, 404, { ok: false, error: "missing", message: "查無此帳號。" });
  const slotN = Math.floor(Number(data.slot) || 0);
  const slot = slotN >= 1 && slotN <= 8 ? slotN : null;
  const note = String(data.note || "").replace(/[<>]/g, "").trim().slice(0, 60);
  const now = Date.now();

  if (data.kind === "gold") {
    const amount = Math.floor(Number(data.amount) || 0);
    if (amount < 1 || amount > GRANT_GOLD_MAX) {
      return jsonRes(res, 400, { ok: false, error: "bad_amount", message: "金幣數量需介於 1 ～ " + GRANT_GOLD_MAX.toLocaleString() + "。" });
    }
    const rows = await sql`
      INSERT INTO gm_grants (account_key, account, slot, kind, amount, note, created_at)
      VALUES (${acc.account_key}, ${acc.account}, ${slot}, 'gold', ${amount}, ${note}, ${now}) RETURNING id`;
    await audit(sql, ip, "grant_gold", acc.account, { id: Number(rows[0].id), slot, amount, note });
    return jsonRes(res, 200, { ok: true, id: Number(rows[0].id) });
  }

  const itemId = String(data.itemId || "").trim();
  if (!/^[A-Za-z0-9_]{1,64}$/.test(itemId)) return jsonRes(res, 400, { ok: false, error: "bad_item", message: "物品代碼格式錯誤。" });
  const db = loadItemDb();
  const d = db ? db[itemId] : null;
  if (db && !d) return jsonRes(res, 400, { ok: false, error: "unknown_item", message: "物品資料庫中沒有「" + itemId + "」。" });
  const isEquip = !!(d && EQUIP_TYPES.has(d.type) && !d.isArrow);
  const isCard = !!(d && d.eff === "card");
  const cnt = Math.max(1, Math.min(GRANT_CNT_MAX, Math.floor(Number(data.cnt) || 1)));
  const en = isEquip ? Math.max(0, Math.min(GRANT_EN_MAX, Math.floor(Number(data.en) || 0))) : 0;
  const bless = isEquip && data.bless === true;
  const kind = isCard ? "card" : "item";
  const rows = await sql`
    INSERT INTO gm_grants (account_key, account, slot, kind, item_id, cnt, en, bless, note, created_at)
    VALUES (${acc.account_key}, ${acc.account}, ${slot}, ${kind}, ${itemId}, ${cnt}, ${en}, ${bless}, ${note}, ${now}) RETURNING id`;
  await audit(sql, ip, "grant_item", acc.account, {
    id: Number(rows[0].id),
    slot,
    itemId,
    name: d ? d.n : "",
    cnt,
    en,
    bless,
    note,
  });
  return jsonRes(res, 200, { ok: true, id: Number(rows[0].id) });
}

async function gmGrantCancel(req, res, sql, ip) {
  const data = await readJson(req);
  if (!data) return jsonRes(res, 400, { ok: false, error: "bad json" });
  const id = Math.floor(Number(data.id) || 0);
  if (id < 1) return jsonRes(res, 400, { ok: false, error: "bad_id" });
  const rows = await sql`
    UPDATE gm_grants SET cancelled_at = ${Date.now()}
    WHERE id = ${id} AND claimed_at IS NULL AND cancelled_at IS NULL
    RETURNING account, kind, item_id, cnt, amount`;
  if (!rows.length) return jsonRes(res, 409, { ok: false, error: "not_pending", message: "此筆已被領取或已取消。" });
  await audit(sql, ip, "grant_cancel", rows[0].account, { id, kind: rows[0].kind, itemId: rows[0].item_id, cnt: Number(rows[0].cnt), amount: Number(rows[0].amount) });
  return jsonRes(res, 200, { ok: true });
}

async function gmBan(req, res, sql, ip) {
  const data = await readJson(req);
  if (!data) return jsonRes(res, 400, { ok: false, error: "bad json" });
  const acc = await findAccountSql(sql, data.account);
  if (!acc) return jsonRes(res, 404, { ok: false, error: "missing", message: "查無此帳號。" });
  const hours = Number(data.hours);
  const permanent = !Number.isFinite(hours) || hours <= 0;
  const until = permanent ? PERMA_BAN_UNTIL : Date.now() + Math.min(hours, 24 * 3650) * 3600000;
  const reason = String(data.reason || "").replace(/[<>]/g, "").trim().slice(0, 100);
  await sql`UPDATE accounts SET banned_until = ${Math.floor(until)}, ban_reason = ${reason} WHERE account_key = ${acc.account_key}`;
  await releaseAccountSessionSql(sql, acc.account_key, "");
  await audit(sql, ip, "ban", acc.account, { until: Math.floor(until), permanent, hours: permanent ? 0 : hours, reason });
  return jsonRes(res, 200, { ok: true, bannedUntil: Math.floor(until), permanent });
}

async function gmUnban(req, res, sql, ip) {
  const data = await readJson(req);
  if (!data) return jsonRes(res, 400, { ok: false, error: "bad json" });
  const acc = await findAccountSql(sql, data.account);
  if (!acc) return jsonRes(res, 404, { ok: false, error: "missing", message: "查無此帳號。" });
  await sql`UPDATE accounts SET banned_until = 0, ban_reason = '' WHERE account_key = ${acc.account_key}`;
  await audit(sql, ip, "unban", acc.account, {});
  return jsonRes(res, 200, { ok: true });
}

async function gmKick(req, res, sql, ip) {
  const data = await readJson(req);
  if (!data) return jsonRes(res, 400, { ok: false, error: "bad json" });
  const acc = await findAccountSql(sql, data.account);
  if (!acc) return jsonRes(res, 404, { ok: false, error: "missing", message: "查無此帳號。" });
  await releaseAccountSessionSql(sql, acc.account_key, "");
  await audit(sql, ip, "kick", acc.account, {});
  return jsonRes(res, 200, { ok: true });
}

async function gmSetRates(req, res, sql, ip) {
  const data = await readJson(req);
  if (!data) return jsonRes(res, 400, { ok: false, error: "bad json" });
  const now = Date.now();
  if (data.reset === true) {
    await sql`DELETE FROM server_config WHERE key = 'rates'`;
    _ratesCache = { at: 0, value: null };
    await audit(sql, ip, "rates_reset", "", {});
    return jsonRes(res, 200, { ok: true, effective: effectiveRates(null, now) });
  }
  const base = getServerRates();
  let endsAt = Math.floor(Number(data.endsAt) || 0);
  if (endsAt && endsAt <= now) {
    return jsonRes(res, 400, { ok: false, error: "bad_end", message: "結束時間必須晚於現在。" });
  }
  if (endsAt < 0) endsAt = 0;
  const cfg = {
    expMult: clampMult(data.expMult, 1),
    goldMult: clampMult(data.goldMult, base.goldMult),
    dropMult: clampMult(data.dropMult, base.dropMult),
    endsAt,
    label: String(data.label || "").replace(/[<>]/g, "").trim().slice(0, 40),
    updatedAt: now,
  };
  await sql`INSERT INTO server_config (key, value, updated_at) VALUES ('rates', ${cfg}, ${now})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`;
  _ratesCache = { at: 0, value: null };
  await audit(sql, ip, "rates_set", "", cfg);
  return jsonRes(res, 200, { ok: true, config: cfg, effective: effectiveRates(cfg, now) });
}

async function gmAuditList(res, sql, limitRaw) {
  const limit = Math.max(1, Math.min(200, Math.floor(Number(limitRaw) || 60)));
  const rows = await sql`SELECT id, at, action, target, detail, ip FROM gm_audit ORDER BY id DESC LIMIT ${limit}`;
  return jsonRes(res, 200, {
    ok: true,
    rows: rows.map((r) => ({
      id: Number(r.id),
      at: Number(r.at) || 0,
      action: r.action,
      target: r.target,
      detail: r.detail || {},
      ip: r.ip || "",
    })),
  });
}

async function handleGmApi(req, res, u) {
  if (req.method === "OPTIONS") return corsPreflight(res, "GET,POST,OPTIONS", "Content-Type, Authorization");
  const sql = getSql();
  await ensureSchema();

  if (u === "/api/gm/mail/claim" && req.method === "POST") return handleMailClaim(req, res, sql);

  const auth = gmAuthCheck(req);
  if (!auth.ok) return jsonRes(res, auth.code, { ok: false, error: auth.error, message: auth.message });
  const q = new URL(req.url || "/", "http://localhost").searchParams;

  if (req.method === "GET") {
    if (u === "/api/gm/overview") return gmOverview(res, sql);
    if (u === "/api/gm/items") return jsonRes(res, 200, { ok: true, items: itemListPayload() });
    if (u === "/api/gm/search") return gmSearch(res, sql, q.get("q"));
    if (u === "/api/gm/account") return gmAccountDetail(res, sql, q.get("account"));
    if (u === "/api/gm/inventory") return gmSlotInventory(res, sql, q.get("account"), q.get("slot"));
    if (u === "/api/gm/audit") return gmAuditList(res, sql, q.get("limit"));
  }
  if (req.method === "POST") {
    if (u === "/api/gm/grant") return gmGrant(req, res, sql, auth.ip);
    if (u === "/api/gm/grant/cancel") return gmGrantCancel(req, res, sql, auth.ip);
    if (u === "/api/gm/ban") return gmBan(req, res, sql, auth.ip);
    if (u === "/api/gm/unban") return gmUnban(req, res, sql, auth.ip);
    if (u === "/api/gm/kick") return gmKick(req, res, sql, auth.ip);
    if (u === "/api/gm/rates") return gmSetRates(req, res, sql, auth.ip);
  }
  return jsonRes(res, 404, { ok: false, error: "unknown gm api", path: u });
}

module.exports = {
  PERMA_BAN_UNTIL,
  handleGmApi,
  getEffectiveRatesSql,
  effectiveRates,
  accountBanSql,
  heartbeatGmInfoSql,
  banMessage,
  loadItemDb,
};

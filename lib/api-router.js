"use strict";

const crypto = require("crypto");
const path = require("path");
const { getSql, ensureSchema } = require("./db");
const {
  CLOUD_ACCOUNT_DEFAULT,
  normalizeAccountId,
  accountKey,
  normalizeCharName,
  charNameKey,
  safeAccount,
  safeName,
  charNameSameSlotOwner,
  findRegisteredCharNameForSlot,
  cloudSaveBeats,
  cloudIdentityConflict,
  readBody,
  clientIp,
  jsonRes,
  corsPreflight,
} = require("./game-utils");
const { handleChatApi } = require("./rt-chat");
const { handlePartyApi } = require("./rt-party");
const { handleClanApi } = require("./rt-clan");
const { handleAuctionApi } = require("./rt-auction");
const { handlePandoraApi } = require("./rt-pandora-market");
const _antiCheat = require("./rt-anti-cheat");
const {
  claimAccountSessionSql,
  touchAccountSessionSql,
  releaseAccountSessionSql,
  verifyAccountSessionSql,
} = require("./rt-account-session");

const ROOT = path.join(__dirname, "..");

const IP_SESSION_MAX = Math.max(1, Number(process.env.IP_SESSION_MAX || 2));
const IP_SESSION_TTL_MS = Math.max(15000, Number(process.env.IP_SESSION_TTL_MS || 90000));
const IP_SESSION_ENABLED = process.env.IP_SESSION_LIMIT !== "0";
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 16) ||
  process.env.BUILD_ID ||
  "neon-" + crypto.createHash("sha1").update("idle-aden-neon-v1").digest("hex").slice(0, 12);
const GAME_VERSION = "v3.8.138";

const LEADERBOARD_CLASS_NAMES = {
  royal: "王族",
  knight: "騎士",
  elf: "妖精",
  mage: "法師",
  dark: "黑暗妖精",
  dragon: "龍騎士",
  warrior: "戰士",
  illusion: "幻術士",
};
const LEADERBOARD_BOARDS = new Set(["level", "gold", "pride", "rift"]);
let leaderboardCache = { at: 0, entries: [] };

function cloudRejectGuest(res, account) {
  if (safeAccount(account) !== CLOUD_ACCOUNT_DEFAULT) return false;
  jsonRes(res, 403, {
    ok: false,
    error: "login_required",
    message: "請先登入帳號再使用雲端存檔，避免與其他玩家共用進度。",
  });
  return true;
}

async function pruneIpSessions(sql) {
  const cutoff = Date.now() - IP_SESSION_TTL_MS;
  await sql`DELETE FROM ip_sessions WHERE last_seen_ms < ${cutoff}`;
}

async function ipSessionCount(sql, ip) {
  await pruneIpSessions(sql);
  const rows = await sql`SELECT COUNT(*)::int AS c FROM ip_sessions WHERE ip = ${ip}`;
  return rows[0]?.c || 0;
}

async function claimIpSession(sql, ip, clientId) {
  await pruneIpSessions(sql);
  const now = Date.now();
  const existing = await sql`SELECT client_id FROM ip_sessions WHERE ip = ${ip} AND client_id = ${clientId}`;
  if (existing.length) {
    await sql`UPDATE ip_sessions SET last_seen_ms = ${now} WHERE ip = ${ip} AND client_id = ${clientId}`;
    const count = await ipSessionCount(sql, ip);
    return { ok: true, count, max: IP_SESSION_MAX };
  }
  const count = await ipSessionCount(sql, ip);
  if (count >= IP_SESSION_MAX) {
    return {
      ok: false,
      error: "limit",
      message: "此 IP 已達雙開上限（最多 2 個連線）。請先關閉其他視窗後再試。",
      count,
      max: IP_SESSION_MAX,
    };
  }
  await sql`INSERT INTO ip_sessions (ip, client_id, last_seen_ms) VALUES (${ip}, ${clientId}, ${now})`;
  const newCount = await ipSessionCount(sql, ip);
  return { ok: true, count: newCount, max: IP_SESSION_MAX };
}

async function loadCharNamesMap(sql) {
  const rows = await sql`SELECT name_key, name, account, slot, en_seed, claimed_at FROM char_names`;
  const map = Object.create(null);
  for (const r of rows) {
    map[r.name_key] = {
      name: r.name,
      account: r.account,
      slot: r.slot,
      enSeed: r.en_seed || "",
      claimedAt: Number(r.claimed_at) || 0,
    };
  }
  return map;
}

async function upsertCharName(sql, mapKey, row) {
  await sql`INSERT INTO char_names (name_key, name, account, slot, en_seed, claimed_at)
    VALUES (${mapKey}, ${row.name}, ${row.account}, ${row.slot}, ${row.enSeed || ""}, ${row.claimedAt || Date.now()})
    ON CONFLICT (name_key) DO UPDATE SET
      name = EXCLUDED.name,
      account = EXCLUDED.account,
      slot = EXCLUDED.slot,
      en_seed = EXCLUDED.en_seed,
      claimed_at = EXCLUDED.claimed_at`;
}

async function deleteCharName(sql, mapKey) {
  await sql`DELETE FROM char_names WHERE name_key = ${mapKey}`;
}

async function handleSessionApi(req, res, u) {
  if (!IP_SESSION_ENABLED) {
    return jsonRes(res, 200, { ok: true, disabled: true, max: IP_SESSION_MAX });
  }
  if (req.method === "OPTIONS") return corsPreflight(res, "GET,POST,OPTIONS");
  const sql = getSql();
  await ensureSchema();
  const ip = clientIp(req);

  if (u === "/api/session/status" && req.method === "GET") {
    const count = await ipSessionCount(sql, ip);
    return jsonRes(res, 200, {
      ok: true,
      ipMasked: ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.*.*"),
      count,
      max: IP_SESSION_MAX,
      ttlMs: IP_SESSION_TTL_MS,
    });
  }

  if (u === "/api/session/claim" && req.method === "POST") {
    let data = {};
    try {
      data = JSON.parse((await readBody(req)) || "{}");
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad json" });
    }
    let clientId = String(data.clientId || "").trim();
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(clientId)) clientId = "c_" + crypto.randomBytes(12).toString("hex");
    const result = await claimIpSession(sql, ip, clientId);
    if (!result.ok) return jsonRes(res, 429, result);
    return jsonRes(res, 200, Object.assign({ clientId }, result));
  }

  if (u === "/api/session/heartbeat" && req.method === "POST") {
    let data = {};
    try {
      data = JSON.parse((await readBody(req)) || "{}");
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad json" });
    }
    const clientId = String(data.clientId || "").trim();
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(clientId)) {
      return jsonRes(res, 400, { ok: false, error: "bad clientId" });
    }
    const now = Date.now();
    const rows = await sql`UPDATE ip_sessions SET last_seen_ms = ${now} WHERE ip = ${ip} AND client_id = ${clientId} RETURNING client_id`;
    if (!rows.length) {
      const claim = await claimIpSession(sql, ip, clientId);
      if (!claim.ok) return jsonRes(res, 429, claim);
      return jsonRes(res, 200, Object.assign({ clientId, reclaimed: true }, claim));
    }
    const count = await ipSessionCount(sql, ip);
    return jsonRes(res, 200, { ok: true, clientId, count, max: IP_SESSION_MAX });
  }

  if (u === "/api/session/release" && req.method === "POST") {
    let data = {};
    try {
      data = JSON.parse((await readBody(req)) || "{}");
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad json" });
    }
    const clientId = String(data.clientId || "").trim();
    if (/^[A-Za-z0-9_-]{8,80}$/.test(clientId)) {
      await sql`DELETE FROM ip_sessions WHERE ip = ${ip} AND client_id = ${clientId}`;
    }
    return jsonRes(res, 200, { ok: true });
  }

  return jsonRes(res, 404, { ok: false, error: "unknown session api" });
}

async function handleAccountsApi(req, res, u) {
  if (req.method === "OPTIONS") return corsPreflight(res, "GET,POST,OPTIONS");
  const sql = getSql();
  await ensureSchema();

  if (u === "/api/accounts/status" && req.method === "GET") {
    return jsonRes(res, 200, { ok: true, enabled: true, backend: "neon" });
  }

  if (u === "/api/accounts/check" && req.method === "GET") {
    const q = new URL(req.url || "/", "http://localhost");
    const account = normalizeAccountId(q.searchParams.get("account") || "");
    if (!account) return jsonRes(res, 400, { ok: false, error: "bad account", taken: false });
    const key = accountKey(account);
    const rows = await sql`SELECT 1 FROM accounts WHERE account_key = ${key} LIMIT 1`;
    return jsonRes(res, 200, { ok: true, account, taken: rows.length > 0 });
  }

  if (u === "/api/accounts/register" && req.method === "POST") {
    let data = {};
    try {
      data = JSON.parse((await readBody(req)) || "{}");
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad json" });
    }
    const account = normalizeAccountId(data.account);
    const password = String(data.password == null ? "" : data.password);
    if (!account) return jsonRes(res, 400, { ok: false, error: "bad account" });
    if (password.length > 64) return jsonRes(res, 400, { ok: false, error: "password too long" });
    const key = accountKey(account);
    const exists = await sql`SELECT 1 FROM accounts WHERE account_key = ${key} LIMIT 1`;
    if (exists.length) {
      return jsonRes(res, 409, {
        ok: false,
        error: "taken",
        message: "此帳號已被註冊，請換一個帳號。",
      });
    }
    await sql`INSERT INTO accounts (account_key, account, password, created_at) VALUES (${key}, ${account}, ${password}, ${Date.now()})`;
    return jsonRes(res, 200, { ok: true, account });
  }

  if (u === "/api/accounts/login" && req.method === "POST") {
    let data = {};
    try {
      data = JSON.parse((await readBody(req)) || "{}");
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad json" });
    }
    const account = normalizeAccountId(data.account);
    const password = String(data.password == null ? "" : data.password);
    const clientId = String(data.clientId || "").trim().slice(0, 80);
    if (!account) return jsonRes(res, 400, { ok: false, error: "bad account" });
    const key = accountKey(account);
    const rows = await sql`SELECT account, password FROM accounts WHERE account_key = ${key} LIMIT 1`;
    if (!rows.length) {
      return jsonRes(res, 404, { ok: false, error: "missing", message: "帳號不存在，請先註冊。" });
    }
    if (String(rows[0].password) !== password) {
      return jsonRes(res, 401, { ok: false, error: "bad password", message: "帳號或密碼錯誤。" });
    }
    const sess = await claimAccountSessionSql(sql, key, clientId);
    if (!sess.ok) return jsonRes(res, 409, sess);
    const authToken = _antiCheat.issueAuthToken(rows[0].account || account, ROOT, sess.sessionId);
    return jsonRes(res, 200, {
      ok: true,
      account: rows[0].account || account,
      authToken,
      sessionId: sess.sessionId,
    });
  }

  if (u === "/api/accounts/session/heartbeat" && req.method === "POST") {
    let data = {};
    try {
      data = JSON.parse((await readBody(req)) || "{}");
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad json" });
    }
    const auth = _antiCheat.authFromBody(data, ROOT);
    if (!auth.ok) return jsonRes(res, 401, { ok: false, error: auth.error || "bad_token", message: "登入已失效，請重新登入。" });
    const key = accountKey(auth.account);
    const touch = await touchAccountSessionSql(sql, key, auth.sessionId);
    if (!touch.ok) return jsonRes(res, 401, touch);
    return jsonRes(res, 200, { ok: true, account: auth.account });
  }

  if (u === "/api/accounts/logout" && req.method === "POST") {
    let data = {};
    try {
      data = JSON.parse((await readBody(req)) || "{}");
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad json" });
    }
    const auth = _antiCheat.authFromBody(data, ROOT);
    if (auth.ok) {
      await releaseAccountSessionSql(sql, accountKey(auth.account), auth.sessionId);
    }
    return jsonRes(res, 200, { ok: true });
  }

  return jsonRes(res, 404, { ok: false, error: "unknown accounts api" });
}

async function handleNamesApi(req, res, u) {
  if (req.method === "OPTIONS") return corsPreflight(res, "GET,POST,OPTIONS");
  const sql = getSql();
  await ensureSchema();

  if (u === "/api/names/status" && req.method === "GET") {
    const rows = await sql`SELECT COUNT(*)::int AS c FROM char_names`;
    return jsonRes(res, 200, { ok: true, enabled: true, count: rows[0]?.c || 0 });
  }

  if (u === "/api/names/check" && req.method === "GET") {
    const q = new URL(req.url || "/", "http://localhost");
    const name = normalizeCharName(q.searchParams.get("name") || "");
    if (!name) return jsonRes(res, 400, { ok: false, error: "bad name", taken: false });
    const key = charNameKey(name);
    const rows = await sql`SELECT name, account, slot, en_seed FROM char_names WHERE name_key = ${key} LIMIT 1`;
    const row = rows[0];
    return jsonRes(res, 200, {
      ok: true,
      name,
      taken: !!row,
      owner: row
        ? { account: row.account || "", slot: row.slot || 0, enSeed: row.en_seed || "" }
        : null,
    });
  }

  if (u === "/api/names/claim" && req.method === "POST") {
    let data = {};
    try {
      data = JSON.parse((await readBody(req)) || "{}");
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad json" });
    }
    const name = normalizeCharName(data.name);
    const account = normalizeAccountId(data.account);
    if (!account || account === CLOUD_ACCOUNT_DEFAULT) {
      return jsonRes(res, 401, {
        ok: false,
        error: "login_required",
        message: "請先登入帳號再創建角色。",
      });
    }
    const slot = Math.max(1, Math.min(8, parseInt(data.slot, 10) || 1));
    const enSeed = String(data.enSeed || "");
    const prevName = normalizeCharName(data.prevName || "");
    if (!name) return jsonRes(res, 400, { ok: false, error: "bad name", message: "請輸入角色名稱。" });

    const map = await loadCharNamesMap(sql);
    const key = charNameKey(name);
    const row = map[key];
    if (row && !charNameSameSlotOwner(row, account, slot)) {
      return jsonRes(res, 409, {
        ok: false,
        error: "taken",
        message: "此角色名稱已被使用，請換一個名稱。",
      });
    }
    const locked = findRegisteredCharNameForSlot(map, account, slot, enSeed);
    if (locked && charNameKey(locked.name) !== key) {
      return jsonRes(res, 403, {
        ok: false,
        error: "name_locked",
        message: "角色名稱設定後不可更改。",
      });
    }
    if (prevName && charNameKey(prevName) !== key) {
      return jsonRes(res, 403, {
        ok: false,
        error: "name_locked",
        message: "角色名稱設定後不可更改。",
      });
    }
    await upsertCharName(sql, key, {
      name,
      account,
      slot,
      enSeed: enSeed || (row && row.enSeed) || (locked && locked.enSeed) || "",
      claimedAt: (locked && locked.claimedAt) || Date.now(),
    });
    return jsonRes(res, 200, { ok: true, name, account, slot });
  }

  if (u === "/api/names/release" && req.method === "POST") {
    let data = {};
    try {
      data = JSON.parse((await readBody(req)) || "{}");
    } catch (e) {
      return jsonRes(res, 400, { ok: false, error: "bad json" });
    }
    const name = normalizeCharName(data.name);
    const account = normalizeAccountId(data.account) || "";
    const slot = Math.max(0, Math.min(8, parseInt(data.slot, 10) || 0));
    const enSeed = String(data.enSeed || "");
    if (!name) return jsonRes(res, 200, { ok: true, released: false });
    const key = charNameKey(name);
    const rows = await sql`SELECT name, account, slot, en_seed FROM char_names WHERE name_key = ${key} LIMIT 1`;
    const row = rows[0];
    if (!row) return jsonRes(res, 200, { ok: true, released: false });
    const ownerOk =
      (!account || accountKey(row.account || "") === accountKey(account)) &&
      (!slot || Number(row.slot) === slot) &&
      (!enSeed || !row.en_seed || String(row.en_seed) === enSeed);
    if (!ownerOk) return jsonRes(res, 403, { ok: false, error: "forbidden" });
    await deleteCharName(sql, key);
    return jsonRes(res, 200, { ok: true, released: true });
  }

  return jsonRes(res, 404, { ok: false, error: "unknown names api" });
}

async function handleCloudApi(req, res, u) {
  if (req.method === "OPTIONS") return corsPreflight(res, "GET,PUT,DELETE,OPTIONS");
  const sql = getSql();
  await ensureSchema();

  if (u === "/api/cloud/status" && req.method === "GET") {
    return jsonRes(res, 200, {
      ok: true,
      enabled: true,
      dir: "neon",
      account: CLOUD_ACCOUNT_DEFAULT,
      ephemeralHint: false,
      backend: "neon",
    });
  }

  let m = u.match(/^\/api\/cloud\/(?:([^/]+)\/)?slot\/(\d+)$/);
  if (m) {
    const account = safeAccount(m[1] || CLOUD_ACCOUNT_DEFAULT);
    if (cloudRejectGuest(res, account)) return;
    const slot = Math.max(1, Math.min(8, parseInt(m[2], 10) || 1));
    const ak = accountKey(account);

    if (req.method === "GET") {
      const rows = await sql`SELECT data, updated_at FROM cloud_slots WHERE account_key = ${ak} AND slot = ${slot} LIMIT 1`;
      if (!rows.length) return jsonRes(res, 404, { ok: false, error: "missing" });
      return jsonRes(res, 200, {
        ok: true,
        account,
        slot,
        data: rows[0].data,
        meta: { mtimeMs: Number(rows[0].updated_at) || 0 },
      });
    }

    if (req.method === "PUT") {
      let data;
      try {
        data = JSON.parse(await readBody(req));
      } catch (e) {
        return jsonRes(res, 400, { ok: false, error: "bad json" });
      }
      if (!data || typeof data !== "object" || !data.p) {
        return jsonRes(res, 400, { ok: false, error: "invalid save object" });
      }
      const existingRows = await sql`SELECT data FROM cloud_slots WHERE account_key = ${ak} AND slot = ${slot} LIMIT 1`;
      if (existingRows.length) {
        const existing = existingRows[0].data;
        if (existing && existing.p && data.p && cloudIdentityConflict(data, existing)) {
          return jsonRes(res, 409, {
            ok: false,
            error: "identity_conflict",
            message: "此存檔位已有不同角色，無法以另一角色覆蓋。請使用其他存檔位或先刪除雲端角色。",
          });
        }
        if (existing && existing.p && data.p && !cloudSaveBeats(data, existing)) {
          return jsonRes(res, 409, {
            ok: false,
            error: "stale_save",
            message: "伺服器存檔較新或進度較高，已拒絕較舊上傳，避免覆蓋洗白。",
          });
        }
      }
      const display = normalizeCharName(data.p && data.p.name);
      if (display) {
        const map = await loadCharNamesMap(sql);
        const nkey = charNameKey(display);
        const row = map[nkey];
        const enSeed = String((data.p && data.p.enSeed) || "");
        if (row && !charNameSameSlotOwner(row, account, slot)) {
          return jsonRes(res, 409, {
            ok: false,
            error: "name_taken",
            message: "此角色名稱已被使用，請換一個名稱。",
          });
        }
        const locked = findRegisteredCharNameForSlot(map, account, slot, enSeed);
        if (locked && charNameKey(locked.name) !== nkey) {
          return jsonRes(res, 403, {
            ok: false,
            error: "name_locked",
            message: "角色名稱設定後不可更改。",
          });
        }
        await upsertCharName(sql, nkey, {
          name: display,
          account,
          slot,
          enSeed: enSeed || (row && row.enSeed) || (locked && locked.enSeed) || "",
          claimedAt: (locked && locked.claimedAt) || Date.now(),
        });
      }
      const now = Date.now();
      await sql`INSERT INTO cloud_slots (account_key, slot, data, updated_at) VALUES (${ak}, ${slot}, ${data}, ${now})
        ON CONFLICT (account_key, slot) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`;
      leaderboardCache.at = 0;
      return jsonRes(res, 200, { ok: true, account, slot, meta: { mtimeMs: now } });
    }

    if (req.method === "DELETE") {
      const existingRows = await sql`SELECT data FROM cloud_slots WHERE account_key = ${ak} AND slot = ${slot} LIMIT 1`;
      if (existingRows.length) {
        try {
          const data = existingRows[0].data;
          const display = normalizeCharName(data && data.p && data.p.name);
          if (display) {
            const nkey = charNameKey(display);
            const rows = await sql`SELECT account, slot FROM char_names WHERE name_key = ${nkey} LIMIT 1`;
            const row = rows[0];
            if (row && accountKey(row.account || "") === ak && Number(row.slot) === slot) {
              await deleteCharName(sql, nkey);
            }
          }
        } catch (e) {}
      }
      await sql`DELETE FROM cloud_slots WHERE account_key = ${ak} AND slot = ${slot}`;
      return jsonRes(res, 200, { ok: true, account, slot });
    }
  }

  m = u.match(/^\/api\/cloud\/(?:([^/]+)\/)?shared\/([a-z0-9_-]+)$/i);
  if (m) {
    const account = safeAccount(m[1] || CLOUD_ACCOUNT_DEFAULT);
    if (cloudRejectGuest(res, account)) return;
    const name = safeName(m[2]);
    if (!name) return jsonRes(res, 400, { ok: false, error: "bad name" });
    const ak = accountKey(account);

    if (req.method === "GET") {
      const rows = await sql`SELECT data, updated_at FROM cloud_shared WHERE account_key = ${ak} AND name = ${name} LIMIT 1`;
      if (!rows.length) return jsonRes(res, 404, { ok: false, error: "missing" });
      return jsonRes(res, 200, {
        ok: true,
        account,
        name,
        data: rows[0].data,
        meta: { mtimeMs: Number(rows[0].updated_at) || 0 },
      });
    }
    if (req.method === "PUT") {
      let data;
      try {
        data = JSON.parse(await readBody(req));
      } catch (e) {
        return jsonRes(res, 400, { ok: false, error: "bad json" });
      }
      const now = Date.now();
      const payload = data == null ? {} : data;
      await sql`INSERT INTO cloud_shared (account_key, name, data, updated_at) VALUES (${ak}, ${name}, ${payload}, ${now})
        ON CONFLICT (account_key, name) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`;
      return jsonRes(res, 200, { ok: true, account, name, meta: { mtimeMs: now } });
    }
    if (req.method === "DELETE") {
      await sql`DELETE FROM cloud_shared WHERE account_key = ${ak} AND name = ${name}`;
      return jsonRes(res, 200, { ok: true, account, name });
    }
  }

  m = u.match(/^\/api\/cloud\/(?:([^/]+)\/)?bundle$/);
  if (m && req.method === "GET") {
    const account = safeAccount(m[1] || CLOUD_ACCOUNT_DEFAULT);
    if (cloudRejectGuest(res, account)) return;
    const ak = accountKey(account);
    const slotRows = await sql`SELECT slot, data FROM cloud_slots WHERE account_key = ${ak} ORDER BY slot`;
    const slots = {};
    for (const r of slotRows) slots[r.slot] = r.data;
    const sharedRows = await sql`SELECT name, data FROM cloud_shared WHERE account_key = ${ak}`;
    const shared = {};
    for (const r of sharedRows) shared[r.name] = r.data;
    return jsonRes(res, 200, { ok: true, account, slots, shared });
  }

  return jsonRes(res, 404, { ok: false, error: "unknown cloud api" });
}

function leaderboardClassName(cls) {
  return LEADERBOARD_CLASS_NAMES[cls] || cls || "未知";
}

async function collectLeaderboardEntries(sql) {
  const rows = await sql`SELECT account_key, slot, data FROM cloud_slots`;
  const byId = Object.create(null);
  for (const r of rows) {
    const p = r.data && r.data.p;
    if (!p || !p.cls) continue;
    const display = normalizeCharName(p.name);
    const id = display
      ? "name:" + charNameKey(display)
      : "acct:" + r.account_key + ":" + r.slot;
    const prideBest = p.prideRank && p.prideRank.best ? p.prideRank.best : null;
    const riftBest = p.riftRank && p.riftRank.best ? p.riftRank.best : null;
    const entry = {
      name: display || "未命名",
      accountKey: r.account_key,
      slot: r.slot,
      cls: String(p.cls || ""),
      clsName: leaderboardClassName(p.cls),
      lv: Math.max(1, Math.floor(Number(p.lv) || 1)),
      exp: Math.max(0, Math.floor(Number(p.exp) || 0)),
      gold: Math.max(0, Math.floor(Number(p.gold) || 0)),
      prideFloor: prideBest ? Math.max(0, Math.floor(Number(prideBest.floor) || 0)) : 0,
      prideMs: prideBest ? Math.max(0, Math.floor(Number(prideBest.ms) || 0)) : 0,
      riftMs: riftBest ? Math.max(0, Math.floor(Number(riftBest.ms) || 0)) : 0,
      eq: p.eq || null,
    };
    const old = byId[id];
    if (!old) byId[id] = entry;
    else {
      if (entry.lv !== old.lv) byId[id] = entry.lv > old.lv ? entry : old;
      else if (entry.exp !== old.exp) byId[id] = entry.exp > old.exp ? entry : old;
      else if (entry.gold !== old.gold) byId[id] = entry.gold > old.gold ? entry : old;
      else if (entry.prideFloor !== old.prideFloor) byId[id] = entry.prideFloor > old.prideFloor ? entry : old;
      else if (entry.prideFloor > 0 && old.prideFloor > 0 && entry.prideMs !== old.prideMs) {
        byId[id] = entry.prideMs < old.prideMs ? entry : old;
      } else if (entry.riftMs !== old.riftMs) byId[id] = entry.riftMs > old.riftMs ? entry : old;
      else byId[id] = old;
    }
  }
  return Object.values(byId);
}

function leaderboardSort(board, entries) {
  const list = entries.slice();
  if (board === "gold") list.sort((a, b) => b.gold - a.gold || b.lv - a.lv);
  else if (board === "pride") {
    list.sort((a, b) => b.prideFloor - a.prideFloor || a.prideMs - b.prideMs || b.lv - a.lv);
  } else if (board === "rift") {
    list.sort((a, b) => (b.riftMs || 0) - (a.riftMs || 0) || b.lv - a.lv);
  } else list.sort((a, b) => b.lv - a.lv || b.exp - a.exp);
  return list;
}

function leaderboardValueLabel(board, row) {
  if (board === "gold") return row.gold.toLocaleString() + " 金幣";
  if (board === "pride") {
    if (!row.prideFloor) return "—";
    const sec = Math.floor(Math.max(0, row.prideMs) / 1000);
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    const t = min > 0 ? min + " 分 " + rem + " 秒" : rem + " 秒";
    return row.prideFloor + "F / " + t;
  }
  if (board === "rift") {
    if (!row.riftMs) return "—";
    const sec = Math.floor(Math.max(0, row.riftMs) / 1000);
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return min > 0 ? min + " 分 " + rem + " 秒" : rem + " 秒";
  }
  return "Lv." + row.lv;
}

const LEADERBOARD_EQ_SLOTS = [
  "wpn", "offwpn", "helm", "armor", "shin", "shield", "cloak", "tshirt", "gloves", "boots",
  "amulet", "ear1", "ear2", "ring1", "ring2", "ring3", "ring4", "belt", "doll", "arrow",
];

function leaderboardSanitizeEquipItem(it) {
  if (!it || !it.id || typeof it.id !== "string") return null;
  const out = { id: it.id };
  const en = Math.floor(Number(it.en) || 0);
  if (en) out.en = en;
  if (it.bless === "cursed") out.bless = "cursed";
  else if (it.bless) out.bless = true;
  if (it.anc) out.anc = it.anc === true ? true : String(it.anc);
  if (it.attr) out.attr = String(it.attr);
  if (it.attrMagic) out.attrMagic = String(it.attrMagic);
  const star = Math.floor(Number(it.attrMagicStar) || 0);
  if (star > 1) out.attrMagicStar = Math.max(1, Math.min(3, star));
  return out;
}

function leaderboardSanitizeEquip(eq) {
  const out = {};
  if (!eq || typeof eq !== "object") return out;
  for (const k of LEADERBOARD_EQ_SLOTS) {
    const it = leaderboardSanitizeEquipItem(eq[k]);
    if (it) out[k] = it;
  }
  return out;
}

function leaderboardLoadPlayerEquip(entries, name) {
  const key = charNameKey(normalizeCharName(name));
  if (!key) return null;
  const row = entries.find((r) => charNameKey(r.name) === key);
  if (!row || !row.eq) return null;
  return {
    name: row.name,
    cls: row.cls,
    clsName: row.clsName || leaderboardClassName(row.cls),
    lv: row.lv,
    eq: leaderboardSanitizeEquip(row.eq),
  };
}

async function handleLeaderboardEquipApi(req, res, u, sql) {
  const q = new URL(req.url || "/", "http://localhost");
  const name = normalizeCharName(q.searchParams.get("name") || "");
  if (!name) {
    return jsonRes(res, 400, { ok: false, error: "need_name", message: "請指定角色名稱。" });
  }
  const now = Date.now();
  if (!leaderboardCache.entries.length || now - leaderboardCache.at > 60000) {
    leaderboardCache = { at: now, entries: await collectLeaderboardEntries(sql) };
  }
  const data = leaderboardLoadPlayerEquip(leaderboardCache.entries, name);
  if (!data) {
    return jsonRes(res, 404, {
      ok: false,
      error: "not_found",
      message: "找不到該角色的公開裝備（可能尚未上傳雲端存檔）。",
    });
  }
  return jsonRes(res, 200, { ok: true, ...data });
}

async function handleLeaderboardApi(req, res, u) {
  if (req.method === "OPTIONS") return corsPreflight(res, "GET,OPTIONS");
  if (req.method !== "GET") {
    return jsonRes(res, 404, { ok: false, error: "unknown leaderboard api" });
  }
  const sql = getSql();
  await ensureSchema();
  if (u.startsWith("/api/leaderboard/equip")) {
    return handleLeaderboardEquipApi(req, res, u, sql);
  }
  if (u !== "/api/leaderboard") {
    return jsonRes(res, 404, { ok: false, error: "unknown leaderboard api" });
  }
  const q = new URL(req.url || "/", "http://localhost");
  const board = LEADERBOARD_BOARDS.has(q.searchParams.get("board") || "")
    ? q.searchParams.get("board")
    : "level";
  const limit = Math.max(1, Math.min(100, parseInt(q.searchParams.get("limit"), 10) || 50));
  const now = Date.now();
  if (!leaderboardCache.entries.length || now - leaderboardCache.at > 60000) {
    leaderboardCache = { at: now, entries: await collectLeaderboardEntries(sql) };
  }
  const sorted = leaderboardSort(board, leaderboardCache.entries).slice(0, limit);
  const rows = sorted.map((row, i) => ({
    rank: i + 1,
    name: row.name,
    cls: row.cls,
    clsName: row.clsName,
    lv: row.lv,
    value:
      board === "gold"
        ? row.gold
        : board === "pride"
          ? row.prideFloor
          : board === "rift"
            ? row.riftMs
            : row.lv,
    valueLabel: leaderboardValueLabel(board, row),
  }));
  return jsonRes(res, 200, {
    ok: true,
    board,
    updatedAt: leaderboardCache.at,
    total: leaderboardCache.entries.length,
    rows,
  });
}

async function routeRequest(req, res, pathname) {
  const u = decodeURIComponent(String(pathname || "/").split("?")[0]);

  if (u === "/api/version" || u === "/api/build") {
    if (req.method === "OPTIONS") return corsPreflight(res, "GET,OPTIONS");
    return jsonRes(res, 200, {
      ok: true,
      buildId: BUILD_ID,
      gameVersion: GAME_VERSION,
      startedAt: Date.now(),
      backend: "vercel-neon",
    });
  }

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    return jsonRes(res, 503, {
      ok: false,
      error: "no_database",
      message: "DATABASE_URL 未設定。請在 Vercel 專案環境變數加入 Neon 連線字串。",
    });
  }

  try {
    if (u.startsWith("/api/session")) return handleSessionApi(req, res, u);
    if (u.startsWith("/api/accounts")) return handleAccountsApi(req, res, u);
    if (u.startsWith("/api/names")) return handleNamesApi(req, res, u);
    if (u.startsWith("/api/cloud")) return handleCloudApi(req, res, u);
    if (u.startsWith("/api/leaderboard")) return handleLeaderboardApi(req, res, u);
    if (u.startsWith("/api/chat")) return handleChatApi(req, res, u);
    if (u.startsWith("/api/party")) return handlePartyApi(req, res, u);
    if (u.startsWith("/api/clan")) return handleClanApi(req, res, u);
    if (u.startsWith("/api/auction")) return handleAuctionApi(req, res, u);
    if (u.startsWith("/api/pandora")) return handlePandoraApi(req, res, u);
    if (u.startsWith("/api/player-data")) {
      return jsonRes(res, 404, { ok: false, error: "desktop_only", message: "僅本機 node _serve.js 提供。" });
    }
    return jsonRes(res, 404, { ok: false, error: "unknown api", path: u });
  } catch (e) {
    console.error("API_ERROR", u, e);
    return jsonRes(res, 500, {
      ok: false,
      error: "server_error",
      message: String(e && e.message ? e.message : e),
    });
  }
}

module.exports = { routeRequest, BUILD_ID };

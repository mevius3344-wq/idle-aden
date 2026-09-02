"use strict";

const crypto = require("crypto");
const fs = require("fs");

const ACCOUNT_SESSION_TTL_MS = Math.max(30000, Number(process.env.ACCOUNT_SESSION_TTL_MS || 90000));

function newSessionId() {
  return crypto.randomBytes(16).toString("hex");
}

function sessionActive(row, now) {
  if (!row) return false;
  return now - Number(row.last_seen_ms || row.lastSeenMs || 0) < ACCOUNT_SESSION_TTL_MS;
}

/** 純邏輯：是否允許佔用帳號連線（同 client 可重連） */
function claimSessionLogic(existing, clientId, now) {
  const cid = String(clientId || "").trim().slice(0, 80);
  if (sessionActive(existing, now)) {
    if (cid && String(existing.client_id || existing.clientId || "") === cid) {
      return {
        ok: true,
        sessionId: existing.session_id || existing.sessionId,
        clientId: cid,
        reused: true,
      };
    }
    return {
      ok: false,
      error: "session_active",
      message: "此帳號已在其他裝置登入。請先於該裝置登出後再試。",
    };
  }
  const sessionId = newSessionId();
  return {
    ok: true,
    sessionId,
    clientId: cid || newSessionId(),
    reused: false,
  };
}

async function pruneAccountSessionsSql(sql) {
  const cutoff = Date.now() - ACCOUNT_SESSION_TTL_MS;
  await sql`DELETE FROM account_sessions WHERE last_seen_ms < ${cutoff}`;
}

async function getAccountSessionSql(sql, accountKey) {
  await pruneAccountSessionsSql(sql);
  const rows =
    await sql`SELECT session_id, client_id, issued_at, last_seen_ms FROM account_sessions WHERE account_key = ${accountKey} LIMIT 1`;
  return rows[0] || null;
}

async function claimAccountSessionSql(sql, accountKey, clientId) {
  const now = Date.now();
  const existing = await getAccountSessionSql(sql, accountKey);
  const result = claimSessionLogic(existing, clientId, now);
  if (!result.ok) return result;
  await sql`INSERT INTO account_sessions (account_key, session_id, client_id, issued_at, last_seen_ms)
    VALUES (${accountKey}, ${result.sessionId}, ${result.clientId}, ${now}, ${now})
    ON CONFLICT (account_key) DO UPDATE SET
      session_id = EXCLUDED.session_id,
      client_id = EXCLUDED.client_id,
      issued_at = EXCLUDED.issued_at,
      last_seen_ms = EXCLUDED.last_seen_ms`;
  return Object.assign({ ok: true }, result);
}

async function touchAccountSessionSql(sql, accountKey, sessionId) {
  await pruneAccountSessionsSql(sql);
  const now = Date.now();
  const rows =
    await sql`UPDATE account_sessions SET last_seen_ms = ${now} WHERE account_key = ${accountKey} AND session_id = ${sessionId} RETURNING session_id`;
  if (!rows.length) {
    return {
      ok: false,
      error: "session_invalid",
      message: "登入已失效（可能已在其他裝置登入）。請重新登入。",
    };
  }
  return { ok: true };
}

async function verifyAccountSessionSql(sql, accountKey, sessionId) {
  await pruneAccountSessionsSql(sql);
  const rows =
    await sql`SELECT session_id FROM account_sessions WHERE account_key = ${accountKey} AND session_id = ${sessionId} LIMIT 1`;
  return !!rows.length;
}

async function releaseAccountSessionSql(sql, accountKey, sessionId) {
  if (sessionId) {
    await sql`DELETE FROM account_sessions WHERE account_key = ${accountKey} AND session_id = ${sessionId}`;
  } else {
    await sql`DELETE FROM account_sessions WHERE account_key = ${accountKey}`;
  }
}

function createFileAccountSessionStore(filePath) {
  function readMap() {
    try {
      if (!fs.existsSync(filePath)) return {};
      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch (e) {
      return {};
    }
  }

  function writeMap(map) {
    try {
      fs.mkdirSync(require("path").dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(map || {}, null, 0), "utf8");
    } catch (e) {}
  }

  function pruneMap(map, now) {
    const cutoff = now - ACCOUNT_SESSION_TTL_MS;
    for (const key of Object.keys(map)) {
      const row = map[key];
      if (!row || Number(row.lastSeenMs || 0) < cutoff) delete map[key];
    }
  }

  async function claim(accountKey, clientId) {
    const now = Date.now();
    const map = readMap();
    pruneMap(map, now);
    const existing = map[accountKey]
      ? {
          session_id: map[accountKey].sessionId,
          client_id: map[accountKey].clientId,
          last_seen_ms: map[accountKey].lastSeenMs,
        }
      : null;
    const result = claimSessionLogic(existing, clientId, now);
    if (!result.ok) return result;
    map[accountKey] = {
      sessionId: result.sessionId,
      clientId: result.clientId,
      issuedAt: now,
      lastSeenMs: now,
    };
    writeMap(map);
    return Object.assign({ ok: true }, result);
  }

  async function touch(accountKey, sessionId) {
    const now = Date.now();
    const map = readMap();
    pruneMap(map, now);
    const row = map[accountKey];
    if (!row || row.sessionId !== sessionId) {
      return {
        ok: false,
        error: "session_invalid",
        message: "登入已失效（可能已在其他裝置登入）。請重新登入。",
      };
    }
    row.lastSeenMs = now;
    map[accountKey] = row;
    writeMap(map);
    return { ok: true };
  }

  async function verify(accountKey, sessionId) {
    const now = Date.now();
    const map = readMap();
    pruneMap(map, now);
    const row = map[accountKey];
    return !!(row && row.sessionId === sessionId);
  }

  async function release(accountKey, sessionId) {
    const map = readMap();
    const row = map[accountKey];
    if (!row) return;
    if (!sessionId || row.sessionId === sessionId) delete map[accountKey];
    writeMap(map);
  }

  return { claim, touch, verify, release };
}

module.exports = {
  ACCOUNT_SESSION_TTL_MS,
  newSessionId,
  claimSessionLogic,
  claimAccountSessionSql,
  touchAccountSessionSql,
  verifyAccountSessionSql,
  releaseAccountSessionSql,
  createFileAccountSessionStore,
};

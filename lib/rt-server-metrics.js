"use strict";

const { ACCOUNT_SESSION_TTL_MS } = require("./rt-account-session");
const { getServerRates } = require("./rt-server-status");

const IP_SESSION_TTL_MS = Math.max(15000, Number(process.env.IP_SESSION_TTL_MS || 45000));

const NEON_FREE_MB = 512;
const CCU_COMFORT = 50;
const CCU_STRESS = 100;

function metricsAuthOk(req) {
  const expected = String(process.env.METRICS_TOKEN || "").trim();
  if (!expected || expected.length < 8) return false;
  const auth = String(req.headers.authorization || "");
  if (auth.startsWith("Bearer ") && auth.slice(7).trim() === expected) return true;
  try {
    const u = new URL(req.url || "/", "http://localhost");
    const q = String(u.searchParams.get("token") || "").trim();
    if (q && q === expected) return true;
  } catch (e) {}
  return false;
}

function metricsAuthRequired(res, jsonRes) {
  return jsonRes(res, 401, {
    ok: false,
    error: "unauthorized",
    message: "請提供有效的 METRICS_TOKEN（Header: Authorization: Bearer …）。",
  });
}

function metricsNotConfigured(res, jsonRes) {
  return jsonRes(res, 503, {
    ok: false,
    error: "not_configured",
    message: "伺服器未設定 METRICS_TOKEN 環境變數。",
  });
}

function bytesToMb(n) {
  return Math.round((Number(n) || 0) / 104857.6) / 10;
}

function processMemory() {
  const m = process.memoryUsage();
  return {
    rssMb: bytesToMb(m.rss),
    heapUsedMb: bytesToMb(m.heapUsed),
    heapTotalMb: bytesToMb(m.heapTotal),
  };
}

function capacityHints(payload) {
  const online = Number(payload.online && payload.online.accountSessions) || 0;
  const dbMb = Number(payload.database && payload.database.totalMb) || 0;
  const ipSessions = Number(payload.online && payload.online.ipSessions) || 0;
  let ccuStatus = "ok";
  let ccuLabel = "正常";
  if (online > CCU_STRESS) {
    ccuStatus = "critical";
    ccuLabel = "過載風險";
  } else if (online > CCU_COMFORT) {
    ccuStatus = "warn";
    ccuLabel = "偏高";
  }
  let storageStatus = "ok";
  let storageLabel = "充裕";
  if (dbMb > NEON_FREE_MB * 0.88) {
    storageStatus = "critical";
    storageLabel = "即將滿";
  } else if (dbMb > NEON_FREE_MB * 0.65) {
    storageStatus = "warn";
    storageLabel = "偏緊";
  }
  const accountsRegistered = (payload.database && payload.database.accounts) || 0;
  const accountsSafeMax = Math.max(0, Math.floor((NEON_FREE_MB * 0.65) / 1.2));
  return {
    ccuComfort: CCU_COMFORT,
    ccuStress: CCU_STRESS,
    ccuStatus,
    ccuLabel,
    storageFreeMb: NEON_FREE_MB,
    storageStatus,
    storageLabel,
    accountsRegistered,
    accountsSafeMax,
    ipConnections: ipSessions,
  };
}

async function collectDbMetrics(sql) {
  const t0 = Date.now();
  const cutoffAccount = Date.now() - ACCOUNT_SESSION_TTL_MS;
  const cutoffIp = Date.now() - IP_SESSION_TTL_MS;

  await sql`DELETE FROM account_sessions WHERE last_seen_ms < ${cutoffAccount}`;
  await sql`DELETE FROM ip_sessions WHERE last_seen_ms < ${cutoffIp}`;

  const [
    dbSizeRows,
    accountRows,
    sessionRows,
    ipRows,
    slotRows,
    sharedRows,
    chatRows,
    partyRows,
    cloudBytesRows,
  ] = await Promise.all([
    sql`SELECT pg_database_size(current_database())::bigint AS bytes`,
    sql`SELECT COUNT(*)::int AS c FROM accounts`,
    sql`SELECT COUNT(*)::int AS c FROM account_sessions`,
    sql`SELECT COUNT(*)::int AS c FROM ip_sessions`,
    sql`SELECT COUNT(*)::int AS c FROM cloud_slots`,
    sql`SELECT COUNT(*)::int AS c FROM cloud_shared`,
    sql`SELECT COUNT(*)::int AS c FROM rt_chat`,
    sql`SELECT COUNT(*)::int AS c FROM rt_parties`,
    sql`SELECT COALESCE(SUM(pg_column_size(data)), 0)::bigint AS bytes FROM cloud_slots`,
  ]);

  const dbPingMs = Date.now() - t0;
  const rates = getServerRates();

  const payload = {
    ok: true,
    at: Date.now(),
    backend: "vercel-neon",
    uptimeSec: Math.floor(process.uptime()),
    memory: processMemory(),
    rates,
    online: {
      accountSessions: sessionRows[0]?.c || 0,
      ipSessions: ipRows[0]?.c || 0,
    },
    database: {
      totalMb: bytesToMb(dbSizeRows[0]?.bytes),
      cloudDataMb: bytesToMb(cloudBytesRows[0]?.bytes),
      accounts: accountRows[0]?.c || 0,
      cloudSlots: slotRows[0]?.c || 0,
      cloudShared: sharedRows[0]?.c || 0,
      chatRows: chatRows[0]?.c || 0,
      parties: partyRows[0]?.c || 0,
    },
    latency: {
      dbPingMs,
    },
  };
  payload.capacity = capacityHints(payload);
  return payload;
}

module.exports = {
  metricsAuthOk,
  metricsAuthRequired,
  metricsNotConfigured,
  collectDbMetrics,
  processMemory,
  capacityHints,
  bytesToMb,
  CCU_COMFORT,
  CCU_STRESS,
  NEON_FREE_MB,
};

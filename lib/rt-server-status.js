"use strict";

const { ACCOUNT_SESSION_TTL_MS } = require("./rt-account-session");
const { PARTY_TTL_MS } = require("./rt-common");

const SERVER_GOLD_MULT = Math.max(1, Number(process.env.SERVER_GOLD_MULT || 1));
const SERVER_DROP_MULT = Math.max(1, Number(process.env.SERVER_DROP_MULT || 1));

function getServerRates() {
  return {
    goldMult: SERVER_GOLD_MULT,
    dropMult: SERVER_DROP_MULT,
  };
}

/** 線上人數：優先組隊 presence（MMORPG 同圖心跳），否則退回帳號 session */
async function countOnlinePlayersSql(sql) {
  const presenceCutoff = Date.now() - PARTY_TTL_MS;
  try {
    const presenceRows = await sql`
      SELECT COUNT(*)::int AS c FROM rt_party_presence WHERE last_seen >= ${presenceCutoff}`;
    const presenceN = presenceRows[0]?.c || 0;
    if (presenceN > 0) return presenceN;
  } catch (e) {}

  const cutoff = Date.now() - ACCOUNT_SESSION_TTL_MS;
  await sql`DELETE FROM account_sessions WHERE last_seen_ms < ${cutoff}`;
  const rows = await sql`SELECT COUNT(*)::int AS c FROM account_sessions`;
  return rows[0]?.c || 0;
}

module.exports = {
  SERVER_GOLD_MULT,
  SERVER_DROP_MULT,
  getServerRates,
  countOnlinePlayersSql,
};

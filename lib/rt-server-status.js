"use strict";

const { ACCOUNT_SESSION_TTL_MS } = require("./rt-account-session");

const SERVER_GOLD_MULT = Math.max(1, Number(process.env.SERVER_GOLD_MULT || 1));
const SERVER_DROP_MULT = Math.max(1, Number(process.env.SERVER_DROP_MULT || 1));

function getServerRates() {
  return {
    goldMult: SERVER_GOLD_MULT,
    dropMult: SERVER_DROP_MULT,
  };
}

async function countOnlinePlayersSql(sql) {
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

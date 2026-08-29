"use strict";

const { neon } = require("@neondatabase/serverless");

let _sql = null;
let _schemaReady = null;

function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!_sql) _sql = neon(url);
  return _sql;
}

async function ensureSchema() {
  if (_schemaReady) return _schemaReady;
  _schemaReady = (async () => {
    const sql = getSql();
    await sql`CREATE TABLE IF NOT EXISTS accounts (
      account_key TEXT PRIMARY KEY,
      account TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS char_names (
      name_key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      account TEXT NOT NULL,
      slot INT NOT NULL,
      en_seed TEXT NOT NULL DEFAULT '',
      claimed_at BIGINT NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS cloud_slots (
      account_key TEXT NOT NULL,
      slot INT NOT NULL CHECK (slot >= 1 AND slot <= 8),
      data JSONB NOT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (account_key, slot)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS cloud_shared (
      account_key TEXT NOT NULL,
      name TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (account_key, name)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS ip_sessions (
      ip TEXT NOT NULL,
      client_id TEXT NOT NULL,
      last_seen_ms BIGINT NOT NULL,
      PRIMARY KEY (ip, client_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ip_sessions_last_seen ON ip_sessions (last_seen_ms)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cloud_slots_account ON cloud_slots (account_key)`;

    await sql`CREATE TABLE IF NOT EXISTS rt_counters (
      name TEXT PRIMARY KEY,
      value BIGINT NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS rt_rate_limits (
      kind TEXT NOT NULL,
      ip TEXT NOT NULL,
      last_ms BIGINT NOT NULL,
      PRIMARY KEY (kind, ip)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS rt_chat (
      seq BIGINT PRIMARY KEY,
      payload JSONB NOT NULL,
      at BIGINT NOT NULL
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rt_chat_at ON rt_chat (at)`;
    await sql`CREATE TABLE IF NOT EXISTS rt_parties (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at BIGINT NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS rt_party_presence (
      member_key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      last_seen BIGINT NOT NULL
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rt_party_presence_last ON rt_party_presence (last_seen)`;
    await sql`CREATE TABLE IF NOT EXISTS rt_party_invites (
      id TEXT PRIMARY KEY,
      to_key TEXT NOT NULL,
      payload JSONB NOT NULL,
      at BIGINT NOT NULL
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rt_party_invites_to ON rt_party_invites (to_key, at)`;
    await sql`CREATE TABLE IF NOT EXISTS rt_party_events (
      seq BIGINT PRIMARY KEY,
      party_id TEXT,
      to_key TEXT,
      payload JSONB NOT NULL,
      at BIGINT NOT NULL
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rt_party_events_to ON rt_party_events (to_key, seq)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rt_party_events_party ON rt_party_events (party_id, seq)`;
    await sql`CREATE TABLE IF NOT EXISTS rt_clans (
      id TEXT PRIMARY KEY,
      name_lower TEXT NOT NULL UNIQUE,
      payload JSONB NOT NULL,
      updated_at BIGINT NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS rt_clan_presence (
      member_key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      last_seen BIGINT NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS rt_auction_listings (
      id TEXT PRIMARY KEY,
      seller_account TEXT NOT NULL,
      payload JSONB NOT NULL,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rt_auction_seller ON rt_auction_listings (seller_account)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rt_auction_expires ON rt_auction_listings (expires_at)`;
    await sql`CREATE TABLE IF NOT EXISTS rt_auction_claims (
      account TEXT NOT NULL,
      claim_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      at BIGINT NOT NULL,
      PRIMARY KEY (account, claim_id)
    )`;
  })();
  return _schemaReady;
}

module.exports = { getSql, ensureSchema };

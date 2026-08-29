#!/usr/bin/env node
"use strict";

/**
 * 將本機 data/accounts.json、data/char-names.json、data/cloud/ 匯入 Neon。
 * 需先 npm run db:migrate
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { getSql, ensureSchema } = require("../lib/db");
const { accountKey, charNameKey, safeAccount, safeName } = require("../lib/game-utils");

const ROOT = path.join(__dirname, "..");
const DATA = process.env.DATA_DIR || path.join(ROOT, "data");
const ACCOUNTS_FILE = path.join(DATA, "accounts.json");
const NAMES_FILE = path.join(DATA, "char-names.json");
const CLOUD_ROOT = path.join(DATA, "cloud");

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return fallback;
  }
}

async function importAccounts(sql) {
  const map = readJson(ACCOUNTS_FILE, {});
  let n = 0;
  for (const key of Object.keys(map)) {
    const row = map[key];
    if (!row) continue;
    const account = String(row.account || key);
    const ak = accountKey(account);
    await sql`INSERT INTO accounts (account_key, account, password, created_at)
      VALUES (${ak}, ${account}, ${String(row.password || "")}, ${Number(row.createdAt) || Date.now()})
      ON CONFLICT (account_key) DO NOTHING`;
    n++;
  }
  return n;
}

async function importNames(sql) {
  const map = readJson(NAMES_FILE, {});
  let n = 0;
  for (const key of Object.keys(map)) {
    const row = map[key];
    if (!row || !row.name) continue;
    const nk = charNameKey(row.name);
    await sql`INSERT INTO char_names (name_key, name, account, slot, en_seed, claimed_at)
      VALUES (${nk}, ${row.name}, ${row.account || ""}, ${Number(row.slot) || 1}, ${row.enSeed || ""}, ${Number(row.claimedAt) || Date.now()})
      ON CONFLICT (name_key) DO NOTHING`;
    n++;
  }
  return n;
}

async function importCloud(sql) {
  if (!fs.existsSync(CLOUD_ROOT)) return { slots: 0, shared: 0 };
  let slots = 0;
  let shared = 0;
  const accounts = fs.readdirSync(CLOUD_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const dir of accounts) {
    const account = safeAccount(dir.name);
    const ak = accountKey(account);
    const adir = path.join(CLOUD_ROOT, dir.name);
    for (let slot = 1; slot <= 8; slot++) {
      const file = path.join(adir, `slot-${slot}.json`);
      if (!fs.existsSync(file)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        const stat = fs.statSync(file);
        await sql`INSERT INTO cloud_slots (account_key, slot, data, updated_at)
          VALUES (${ak}, ${slot}, ${data}, ${Math.floor(stat.mtimeMs)})
          ON CONFLICT (account_key, slot) DO UPDATE SET
            data = EXCLUDED.data,
            updated_at = GREATEST(cloud_slots.updated_at, EXCLUDED.updated_at)`;
        slots++;
      } catch (e) {
        console.warn("skip slot", account, slot, e.message);
      }
    }
    for (const name of fs.readdirSync(adir)) {
      const m = name.match(/^([a-z0-9_-]+)\.json$/i);
      if (!m || /^slot-\d+\.json$/i.test(name)) continue;
      const sname = safeName(m[1]);
      if (!sname) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(adir, name), "utf8"));
        const stat = fs.statSync(path.join(adir, name));
        await sql`INSERT INTO cloud_shared (account_key, name, data, updated_at)
          VALUES (${ak}, ${sname}, ${data}, ${Math.floor(stat.mtimeMs)})
          ON CONFLICT (account_key, name) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`;
        shared++;
      } catch (e) {
        console.warn("skip shared", account, name, e.message);
      }
    }
  }
  return { slots, shared };
}

async function importRt(sql) {
  let parties = 0;
  let clans = 0;
  let listings = 0;
  let claims = 0;
  const partiesFile = path.join(DATA, "parties.json");
  const clansFile = path.join(DATA, "clans.json");
  const auctionFile = path.join(DATA, "auction.json");

  try {
    const raw = readJson(partiesFile, {});
    const list = Array.isArray(raw.parties) ? raw.parties : [];
    for (const p of list) {
      if (!p || !p.id || !Array.isArray(p.members) || !p.members.length) continue;
      await sql`INSERT INTO rt_parties (id, payload, updated_at)
        VALUES (${String(p.id).slice(0, 48)}, ${{
          leaderKey: p.leaderKey,
          members: p.members,
          applications: [],
          shareAtByKey: {},
          createdAt: p.createdAt || Date.now(),
          lastShareAt: 0,
        }}, ${Date.now()})
        ON CONFLICT (id) DO NOTHING`;
      parties++;
    }
  } catch (e) {
    console.warn("parties import:", e.message);
  }

  try {
    const raw = readJson(clansFile, {});
    const list = Array.isArray(raw.clans) ? raw.clans : [];
    for (const c of list) {
      if (!c || !c.id || !c.name) continue;
      const nameLower = String(c.name).toLowerCase();
      await sql`INSERT INTO rt_clans (id, name_lower, payload, updated_at)
        VALUES (${String(c.id).slice(0, 48)}, ${nameLower}, ${{
          name: c.name,
          leaderKey: c.leaderKey,
          members: c.members || [],
          faction: c.faction || "tros",
          createdAt: c.createdAt || Date.now(),
        }}, ${Date.now()})
        ON CONFLICT (id) DO NOTHING`;
      clans++;
    }
  } catch (e) {
    console.warn("clans import:", e.message);
  }

  try {
    const raw = readJson(auctionFile, {});
    const list = Array.isArray(raw.listings) ? raw.listings : [];
    for (const L of list) {
      if (!L || !L.id || !L.sellerAccount) continue;
      await sql`INSERT INTO rt_auction_listings (id, seller_account, payload, expires_at, created_at)
        VALUES (${String(L.id).slice(0, 48)}, ${String(L.sellerAccount).slice(0, 24)}, ${L}, ${Number(L.expiresAt) || Date.now()}, ${Number(L.createdAt) || Date.now()})
        ON CONFLICT (id) DO NOTHING`;
      listings++;
    }
    const claimMap = raw.claims && typeof raw.claims === "object" ? raw.claims : {};
    for (const acc of Object.keys(claimMap)) {
      const arr = Array.isArray(claimMap[acc]) ? claimMap[acc] : [];
      for (const c of arr) {
        if (!c || !c.id) continue;
        await sql`INSERT INTO rt_auction_claims (account, claim_id, payload, at)
          VALUES (${String(acc).slice(0, 24)}, ${String(c.id).slice(0, 48)}, ${c}, ${Number(c.at) || Date.now()})
          ON CONFLICT (account, claim_id) DO NOTHING`;
        claims++;
      }
    }
  } catch (e) {
    console.warn("auction import:", e.message);
  }

  return { parties, clans, listings, claims };
}

async function main() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.error("缺少 DATABASE_URL");
    process.exit(1);
  }
  await ensureSchema();
  const sql = getSql();
  const ac = await importAccounts(sql);
  const nm = await importNames(sql);
  const cloud = await importCloud(sql);
  const rt = await importRt(sql);
  console.log("Import done:", { accounts: ac, names: nm, cloudSlots: cloud.slots, cloudShared: cloud.shared, rt });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

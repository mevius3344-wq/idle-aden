"use strict";

const crypto = require("crypto");
const { readBody } = require("./game-utils");

const CHAT_MAX = 250;
const CHAT_RATE_MS = 1000;
const CHAT_TEXT_MAX = 60;
const CHAT_WAIT_MAX_MS = 20000;

const PARTY_MAX = 8;
const PARTY_TTL_MS = 90000;
const PARTY_MEMBER_TTL_MS = 12 * 60 * 60 * 1000;
const PARTY_INVITE_MS = 60000;
const PARTY_APPLY_MS = 120000;
const PARTY_SHARE_RATE_MS = 80;
const PARTY_WAIT_MAX_MS = 20000;
const PARTY_EVENT_MAX = 120;

const CLAN_MAX = 40;
const CLAN_TTL_MS = 180000;

const AUCTION_MAX_LISTINGS = 2000;
const AUCTION_MAX_PER_ACCOUNT = 20;
const AUCTION_TTL_MS = 72 * 60 * 60 * 1000;
const AUCTION_LIST_FEE_RATE = 0.02;
const AUCTION_LIST_FEE_MIN = 100;
const AUCTION_LIST_FEE_MAX = 50000;
const AUCTION_BUY_FEE_RATE = 0.05;
const AUCTION_PRICE_MIN = 1;
const AUCTION_PRICE_MAX = 999999999;

function partySanitizeName(raw) {
  return String(raw || "")
    .replace(/[<>&"']/g, "")
    .trim()
    .slice(0, 16);
}

function partyMemberKey(account, slot, _name) {
  const a = String(account || "")
    .replace(/[<>&"']/g, "")
    .trim()
    .slice(0, 24);
  const s = Math.max(0, Math.min(8, Number(slot) || 0));
  if (!a) return "";
  return a + "#" + s;
}

function clanSanitizeName(raw) {
  return String(raw || "")
    .replace(/[<>&"']/g, "")
    .trim()
    .slice(0, 20);
}

function chatSanitizeText(raw) {
  return String(raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, CHAT_TEXT_MAX);
}

function newId(prefix) {
  return (prefix || "X") + Date.now().toString(36) + crypto.randomBytes(2).toString("hex");
}

async function parseJsonBody(req) {
  const body = await readBody(req);
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (e) {
    return null;
  }
}

async function pollWait(checkReady, waitMs, intervalMs) {
  const maxWait = Math.max(0, Math.min(waitMs, CHAT_WAIT_MAX_MS));
  if (maxWait <= 0) return checkReady();
  const deadline = Date.now() + maxWait;
  let out = checkReady();
  if (out.ready) return out;
  while (Date.now() < deadline) {
    const sleep = Math.min(intervalMs || 400, deadline - Date.now());
    if (sleep <= 0) break;
    await new Promise((r) => setTimeout(r, sleep));
    out = checkReady();
    if (out.ready) return out;
  }
  return checkReady();
}

async function nextCounter(sql, name) {
  const rows = await sql`
    INSERT INTO rt_counters (name, value) VALUES (${name}, 1)
    ON CONFLICT (name) DO UPDATE SET value = rt_counters.value + 1
    RETURNING value`;
  return Number(rows[0].value) || 1;
}

async function getCounter(sql, name) {
  const rows = await sql`SELECT value FROM rt_counters WHERE name = ${name} LIMIT 1`;
  return rows.length ? Number(rows[0].value) || 0 : 0;
}

async function checkRate(sql, kind, ip, ms) {
  const now = Date.now();
  const rows = await sql`SELECT last_ms FROM rt_rate_limits WHERE kind = ${kind} AND ip = ${ip} LIMIT 1`;
  const last = rows.length ? Number(rows[0].last_ms) || 0 : 0;
  if (now - last < ms) return false;
  await sql`INSERT INTO rt_rate_limits (kind, ip, last_ms) VALUES (${kind}, ${ip}, ${now})
    ON CONFLICT (kind, ip) DO UPDATE SET last_ms = EXCLUDED.last_ms`;
  return true;
}

function auctionFeesForPrice(price) {
  const p = Math.max(AUCTION_PRICE_MIN, Math.min(AUCTION_PRICE_MAX, Math.floor(Number(price) || 0)));
  let listFee = Math.floor(p * AUCTION_LIST_FEE_RATE);
  if (listFee < AUCTION_LIST_FEE_MIN) listFee = AUCTION_LIST_FEE_MIN;
  if (listFee > AUCTION_LIST_FEE_MAX) listFee = AUCTION_LIST_FEE_MAX;
  const buyFee = Math.max(0, Math.floor(p * AUCTION_BUY_FEE_RATE));
  return { price: p, listFee, buyFee, totalBuy: p + buyFee };
}

function auctionSanitizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "")
    .replace(/[<>&"']/g, "")
    .trim()
    .slice(0, 48);
  if (!id || !/^[a-z0-9_]+$/i.test(id)) return null;
  const cnt = Math.max(1, Math.min(99999, Math.floor(Number(raw.cnt) || 1)));
  const en = Math.max(-15, Math.min(30, Math.floor(Number(raw.en) || 0)));
  let bless = false;
  if (raw.bless === true || raw.bless === "blessed") bless = true;
  else if (raw.bless === "cursed") bless = "cursed";
  let anc = false;
  if (raw.anc === true) anc = true;
  else if (typeof raw.anc === "string" && raw.anc) anc = String(raw.anc).slice(0, 16);
  let attr = false;
  if (raw.attr === true) attr = true;
  else if (typeof raw.attr === "string" && raw.attr) attr = String(raw.attr).slice(0, 24);
  let seteff = false;
  if (typeof raw.seteff === "string" && raw.seteff) seteff = String(raw.seteff).slice(0, 24);
  const out = { id, cnt, en, bless, anc, attr, seteff, lock: false, junk: false };
  if (Number(raw.expireAt) > 0) return null;
  if (raw.gw) return null;
  if (raw.rental) return null;
  const n = String(raw._n || raw.n || "")
    .replace(/[<>&"']/g, "")
    .trim()
    .slice(0, 40);
  if (n) out._n = n;
  return out;
}

function auctionPublic(listing, opts) {
  opts = opts || {};
  if (!listing) return null;
  const fees = auctionFeesForPrice(listing.price);
  const out = {
    id: listing.id,
    sellerName: listing.sellerName,
    sellerAccount: opts.revealSeller ? listing.sellerAccount : undefined,
    price: listing.price,
    listFee: listing.listFee,
    buyFee: fees.buyFee,
    totalBuy: fees.totalBuy,
    item: listing.item,
    createdAt: listing.createdAt,
    expiresAt: listing.expiresAt,
  };
  if (opts.mine) {
    out.sellerAccount = listing.sellerAccount;
    out.sellerSlot = listing.sellerSlot;
    out.sellerKey = listing.sellerKey;
  }
  return out;
}

module.exports = {
  CHAT_MAX,
  CHAT_RATE_MS,
  CHAT_WAIT_MAX_MS,
  PARTY_MAX,
  PARTY_TTL_MS,
  PARTY_MEMBER_TTL_MS,
  PARTY_INVITE_MS,
  PARTY_APPLY_MS,
  PARTY_SHARE_RATE_MS,
  PARTY_WAIT_MAX_MS,
  PARTY_EVENT_MAX,
  CLAN_MAX,
  CLAN_TTL_MS,
  AUCTION_MAX_LISTINGS,
  AUCTION_MAX_PER_ACCOUNT,
  AUCTION_TTL_MS,
  AUCTION_LIST_FEE_RATE,
  AUCTION_LIST_FEE_MIN,
  AUCTION_LIST_FEE_MAX,
  AUCTION_BUY_FEE_RATE,
  AUCTION_PRICE_MIN,
  AUCTION_PRICE_MAX,
  partySanitizeName,
  partyMemberKey,
  clanSanitizeName,
  chatSanitizeText,
  newId,
  parseJsonBody,
  pollWait,
  nextCounter,
  getCounter,
  checkRate,
  auctionFeesForPrice,
  auctionSanitizeItem,
  auctionPublic,
};

"use strict";

const crypto = require("crypto");
const path = require("path");

const PANACEA_USE_MAX = 30;
const INV_STACK_MAX = 9999;
const INV_SLOTS_MAX = 180;

/** 各等級合理金幣上限（寬鬆·防離譜改檔） */
function maxGoldForLevel(lv) {
  const L = Math.max(1, Math.min(100, Math.floor(Number(lv) || 1)));
  return Math.min(500000000, 5000000 + L * L * 2500000);
}

/** 各等級合理累計經驗上限 */
function maxExpForLevel(lv) {
  const L = Math.max(1, Math.min(100, Math.floor(Number(lv) || 1)));
  if (L >= 100) return 999999999;
  return Math.floor(Math.pow(L + 5, 3.2) * 120000);
}

function clampInt(v, lo, hi) {
  const n = Math.floor(Number(v) || 0);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function authSecret(root) {
  const env = process.env.AUTH_SECRET;
  if (env && String(env).length >= 16) return String(env);
  return crypto.createHash("sha256").update(String(root || "") + "|fb5-anti-cheat-v1").digest("hex");
}

function issueAuthToken(account, root, sessionId) {
  const { normalizeAccountId } = require("./game-utils");
  const acc = normalizeAccountId(account);
  const sid = String(sessionId || "").trim().slice(0, 64);
  if (!acc || !sid) return "";
  const exp = Date.now() + 86400000;
  const payload = acc + "." + exp + "." + sid;
  const sig = crypto.createHmac("sha256", authSecret(root)).update(payload).digest("hex").slice(0, 32);
  return payload + "." + sig;
}

function parseAuthToken(token, root) {
  const parts = String(token || "").split(".");
  if (parts.length !== 4) return null;
  const [acc, expStr, sessionId, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  if (!sessionId || sessionId.length > 64) return null;
  const { normalizeAccountId } = require("./game-utils");
  const accountNorm = normalizeAccountId(acc);
  if (!accountNorm) return null;
  const payload = acc + "." + expStr + "." + sessionId;
  const expected = crypto.createHmac("sha256", authSecret(root)).update(payload).digest("hex").slice(0, 32);
  if (sig !== expected) return null;
  return { account: accountNorm, exp, sessionId };
}

function verifyAuthToken(account, token, root) {
  const { normalizeAccountId } = require("./game-utils");
  const parsed = parseAuthToken(token, root);
  if (!parsed) return false;
  return parsed.account === normalizeAccountId(account);
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(String(pw), salt, 120000, 32, "sha256").toString("hex");
  return "pbkdf2:" + salt + ":" + hash;
}

function verifyPassword(pw, stored) {
  const s = String(stored == null ? "" : stored);
  if (s.startsWith("pbkdf2:")) {
    const parts = s.split(":");
    if (parts.length < 3) return false;
    const salt = parts[1];
    const hash = parts[2];
    const h = crypto.pbkdf2Sync(String(pw), salt, 120000, 32, "sha256").toString("hex");
    return h === hash;
  }
  return s === String(pw);
}

function needsPasswordUpgrade(stored) {
  return !String(stored || "").startsWith("pbkdf2:");
}

/**
 * 驗證存檔合理性；嚴重作弊回 ok:false，輕微異常回 clamp 建議值。
 */
function validatePlayerSave(p) {
  const issues = [];
  if (!p || typeof p !== "object" || !p.cls) {
    return { ok: false, severe: true, issues: ["no_player"], clamp: null };
  }
  const lv = clampInt(p.lv, 1, 100);
  if (lv !== Math.floor(Number(p.lv) || 0)) issues.push("lv");
  const gold = Math.max(0, Math.floor(Number(p.gold) || 0));
  const maxGold = maxGoldForLevel(lv);
  if (gold > maxGold) issues.push("gold");
  const exp = Math.max(0, Math.floor(Number(p.exp) || 0));
  const maxExp = maxExpForLevel(lv);
  if (exp > maxExp) issues.push("exp");
  const panUsed = Math.max(0, Math.floor(Number(p.panaceaUsed) || 0));
  if (panUsed > PANACEA_USE_MAX) issues.push("panacea");
  let invN = 0;
  if (Array.isArray(p.inv)) {
    if (p.inv.length > INV_SLOTS_MAX) issues.push("inv_slots");
    for (const it of p.inv) {
      if (!it || !it.id) continue;
      invN += 1;
      const cnt = Math.max(1, Math.floor(Number(it.cnt) || 1));
      if (cnt > INV_STACK_MAX) issues.push("inv_cnt");
      if (typeof it.id !== "string" || it.id.length > 64) issues.push("inv_id");
    }
  }
  const severe = issues.some((x) =>
    ["gold", "exp", "panacea", "inv_slots", "inv_cnt", "no_player"].includes(x)
  );
  const clamp = {
    lv,
    gold: Math.min(gold, maxGold),
    exp: Math.min(exp, maxExp),
    panaceaUsed: Math.min(panUsed, PANACEA_USE_MAX),
  };
  return { ok: issues.length === 0, severe, issues, clamp };
}

function applySaveClamp(data, clamp) {
  if (!data || !data.p || !clamp) return data;
  data.p.lv = clamp.lv;
  data.p.gold = clamp.gold;
  data.p.exp = clamp.exp;
  data.p.panaceaUsed = clamp.panaceaUsed;
  if (Array.isArray(data.p.inv)) {
    data.p.inv = data.p.inv.slice(0, INV_SLOTS_MAX).map((it) => {
      if (!it || typeof it !== "object") return it;
      const cnt = Math.max(1, Math.min(INV_STACK_MAX, Math.floor(Number(it.cnt) || 1)));
      return Object.assign({}, it, { cnt });
    });
  }
  return data;
}

function authFromBody(body, root) {
  const { normalizeAccountId, accountKey } = require("./game-utils");
  const account = normalizeAccountId((body && body.account) || "");
  const token = String((body && body.authToken) || "").slice(0, 160);
  if (!account || !token) return { ok: false, account: "", sessionId: "", error: "auth_required" };
  const parsed = parseAuthToken(token, root);
  if (!parsed || accountKey(parsed.account) !== accountKey(account)) {
    return { ok: false, account, sessionId: "", error: "bad_token" };
  }
  return { ok: true, account: parsed.account, sessionId: parsed.sessionId, error: null };
}

module.exports = {
  PANACEA_USE_MAX,
  maxGoldForLevel,
  maxExpForLevel,
  issueAuthToken,
  parseAuthToken,
  verifyAuthToken,
  hashPassword,
  verifyPassword,
  needsPasswordUpgrade,
  validatePlayerSave,
  applySaveClamp,
  authFromBody,
};

"use strict";

const CLOUD_ACCOUNT_DEFAULT = "guest";

function normalizeAccountId(raw) {
  let s = String(raw == null ? "" : raw).replace(/^\s+|\s+$/g, "");
  try {
    if (typeof s.normalize === "function") s = s.normalize("NFC");
  } catch (e) {}
  if (!s || s.length > 32) return "";
  if (!/^[\u4e00-\u9fffA-Za-z0-9_-]+$/.test(s)) return "";
  return s;
}

function accountKey(name) {
  return normalizeAccountId(name).toLowerCase();
}

function normalizeCharName(raw) {
  let s = String(raw == null ? "" : raw)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>&"']/g, "")
    .replace(/^\s+|\s+$/g, "")
    .slice(0, 12);
  try {
    if (typeof s.normalize === "function") s = s.normalize("NFC");
  } catch (e) {}
  return s;
}

function charNameKey(name) {
  return normalizeCharName(name).toLowerCase();
}

function safeAccount(name) {
  const s = String(name || CLOUD_ACCOUNT_DEFAULT).trim();
  if (!s || s.length > 32) return CLOUD_ACCOUNT_DEFAULT;
  if (!/^[\u4e00-\u9fffA-Za-z0-9_-]+$/.test(s)) return CLOUD_ACCOUNT_DEFAULT;
  return s;
}

function safeName(name) {
  return /^[a-z0-9_-]{1,40}$/i.test(name) ? name : null;
}

function charNameSameSlotOwner(row, account, slot) {
  return (
    row &&
    accountKey(row.account || "") === accountKey(account) &&
    Number(row.slot) === slot
  );
}

function findRegisteredCharNameForSlot(mapOrRows, account, slot, enSeed) {
  const ak = accountKey(account);
  const list = Array.isArray(mapOrRows)
    ? mapOrRows
    : Object.keys(mapOrRows || {}).map((k) => mapOrRows[k]);
  for (const r of list) {
    if (!r) continue;
    if (accountKey(r.account || "") !== ak) continue;
    if (Number(r.slot) !== slot) continue;
    const seed = r.enSeed != null ? r.enSeed : r.en_seed;
    if (enSeed && seed && String(seed) !== String(enSeed)) continue;
    return r;
  }
  return null;
}

function cloudSaveProgressScore(data) {
  const p = data && data.p;
  if (!p || !p.cls) return -1;
  const lv = Math.max(1, Math.floor(Number(p.lv) || 1));
  const exp = Math.max(0, Math.floor(Number(p.exp) || 0));
  const gold = Math.max(0, Math.floor(Number(p.gold) || 0));
  let invN = 0;
  if (Array.isArray(p.inv)) {
    for (let i = 0; i < p.inv.length; i++) {
      const it = p.inv[i];
      invN += Math.max(1, Math.floor(Number(it && it.cnt) || 1));
    }
  }
  return lv * 1e12 + exp * 1e3 + Math.min(gold, 1e11) + invN;
}

function cloudSaveTime(data) {
  if (!data) return 0;
  const t = Number((data.p && data.p.savedAt) || data.savedAt || 0);
  return Number.isFinite(t) && t > 0 ? Math.floor(t) : 0;
}

function cloudSaveBeats(a, b) {
  if (!a || !a.p) return false;
  if (!b || !b.p) return true;
  const sa = cloudSaveProgressScore(a);
  const sb = cloudSaveProgressScore(b);
  if (sa !== sb) return sa > sb;
  return cloudSaveTime(a) >= cloudSaveTime(b);
}

function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") return Promise.resolve(req.body);
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString("utf8"));
    if (typeof req.body === "object") return Promise.resolve(JSON.stringify(req.body));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 40 * 1024 * 1024) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  if (xf) return xf;
  return String(req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "127.0.0.1")
    .replace(/^::ffff:/, "");
}

function jsonRes(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function corsPreflight(res, methods) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end();
}

module.exports = {
  CLOUD_ACCOUNT_DEFAULT,
  normalizeAccountId,
  accountKey,
  normalizeCharName,
  charNameKey,
  safeAccount,
  safeName,
  charNameSameSlotOwner,
  findRegisteredCharNameForSlot,
  cloudSaveProgressScore,
  cloudSaveTime,
  cloudSaveBeats,
  readBody,
  clientIp,
  jsonRes,
  corsPreflight,
};

/**
 * 👑 原版世界王：頭目在自己的地圖固定地點重生，全服（所有頻道）共用一隻、共用血量。
 * - 擊殺：掉落給傷害最高者（lootKey），經驗依傷害比例（expShare）
 * - 重生 1 小時；狀態寫 persistFile("field-bosses.json")，重部署不重置
 * - 怪物 sid＝"b:<bossId>"，在該地圖的每個頻道房都以同一 slot 出現
 */
"use strict";

const fs = require("fs");
const path = require("path");

const RESPAWN_MS = Math.max(5000, Number(process.env.WB_RESPAWN_MS || 3600000));
const SLOT_MIN = 200;
const SLOT_MAX = 239;
const SAVE_DEBOUNCE_MS = 5000;

/** @type {Map<string, object>} bossId -> row */
const bosses = new Map();
let rev = 0;
let persistPath = "";
let onSpawn = null;
let onKill = null;
let saveTimer = null;

function cleanId(v) {
  return String(v || "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 48);
}

function cleanText(v, max) {
  return String(v || "").replace(/[<>&"']/g, "").trim().slice(0, max || 40);
}

function clampInt(v, lo, hi, dflt) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

function bump() {
  rev += 1;
  return rev;
}

function saveNow() {
  if (!persistPath) return;
  try {
    const out = {};
    for (const [id, b] of bosses.entries()) {
      out[id] = {
        mapId: b.mapId,
        mapName: b.mapName,
        slot: b.slot,
        n: b.n,
        mhp: b.mhp,
        hp: b.hp,
        lv: b.lv,
        ac: b.ac,
        dr: b.dr,
        hardSkin: b.hardSkin,
        er: b.er,
        x: b.x,
        y: b.y,
        dead: !!b.dead,
        respawnAt: b.respawnAt || 0,
        killSeq: b.killSeq || 0,
        lastKillerName: b.lastKillerName || "",
        lastKillAt: b.lastKillAt || 0,
      };
    }
    fs.mkdirSync(path.dirname(persistPath), { recursive: true });
    const tmp = persistPath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, bosses: out }), "utf8");
    fs.renameSync(tmp, persistPath);
  } catch (e) {}
}

function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, SAVE_DEBOUNCE_MS);
  if (saveTimer.unref) saveTimer.unref();
}

function load() {
  if (!persistPath) return;
  try {
    if (!fs.existsSync(persistPath)) return;
    const data = JSON.parse(fs.readFileSync(persistPath, "utf8"));
    const src = (data && data.bosses) || {};
    for (const id of Object.keys(src)) {
      const r = src[id];
      const bid = cleanId(id);
      if (!bid || !r || !r.mapId || !r.n) continue;
      const mhp = clampInt(r.mhp, 1, 2e9, 1);
      bosses.set(bid, {
        id: bid,
        sid: "b:" + bid,
        mapId: String(r.mapId).slice(0, 64),
        mapName: cleanText(r.mapName, 40),
        slot: clampInt(r.slot, SLOT_MIN, SLOT_MAX, SLOT_MIN),
        n: cleanText(r.n, 40),
        mhp: mhp,
        hp: clampInt(r.hp, 0, mhp, mhp),
        lv: clampInt(r.lv, 1, 200, 1),
        ac: clampInt(r.ac, -50, 80, 10),
        dr: clampInt(r.dr, 0, 200, 0),
        hardSkin: clampInt(r.hardSkin, 0, 200, 0),
        er: clampInt(r.er, 0, 100, 0),
        x: Math.round(Number(r.x) || 0),
        y: Math.round(Number(r.y) || 0),
        dead: !!r.dead,
        respawnAt: Number(r.respawnAt) || 0,
        killSeq: clampInt(r.killSeq, 0, 1e9, 0),
        lastKillerName: cleanText(r.lastKillerName, 24),
        lastKillAt: Number(r.lastKillAt) || 0,
        hitters: new Map(),
        hitterNames: new Map(),
      });
    }
    if (bosses.size) bump();
  } catch (e) {}
}

function configure(opts) {
  const o = opts || {};
  if (o.persistPath && o.persistPath !== persistPath) {
    persistPath = String(o.persistPath);
    load();
  }
  if (typeof o.onSpawn === "function") onSpawn = o.onSpawn;
  if (typeof o.onKill === "function") onKill = o.onKill;
}

/** 客戶端進圖時提報該圖的頭目（先到先登記；已登記的不覆蓋） */
function define(mapId, list) {
  const mid = String(mapId || "").split("#")[0].slice(0, 64);
  if (!mid || !Array.isArray(list)) return false;
  let changed = false;
  for (const d of list.slice(0, 8)) {
    if (!d) continue;
    const bid = cleanId(d.id);
    const n = cleanText(d.n, 40);
    if (!bid || !n || bosses.has(bid)) continue;
    const mhp = clampInt(d.mhp, 1, 2e9, 1);
    bosses.set(bid, {
      id: bid,
      sid: "b:" + bid,
      mapId: mid,
      mapName: cleanText(d.mapName, 40),
      slot: clampInt(d.slot, SLOT_MIN, SLOT_MAX, SLOT_MIN),
      n: n,
      mhp: mhp,
      hp: mhp,
      lv: clampInt(d.lv, 1, 200, 1),
      ac: clampInt(d.ac, -50, 80, 10),
      dr: clampInt(d.dr, 0, 200, 0),
      hardSkin: clampInt(d.hardSkin, 0, 200, 0),
      er: clampInt(d.er, 0, 100, 0),
      x: Math.round(Number(d.x) || 0),
      y: Math.round(Number(d.y) || 0),
      dead: false,
      respawnAt: 0,
      killSeq: 0,
      lastKillerName: "",
      lastKillAt: 0,
      hitters: new Map(),
      hitterNames: new Map(),
    });
    changed = true;
  }
  if (changed) {
    bump();
    saveSoon();
  }
  return changed;
}

function get(sid) {
  const s = String(sid || "");
  if (s.indexOf("b:") !== 0) return null;
  return bosses.get(s.slice(2)) || null;
}

function forMap(mapId) {
  const mid = String(mapId || "").split("#")[0];
  const out = [];
  for (const b of bosses.values()) if (b.mapId === mid) out.push(b);
  return out;
}

function publicRow(b) {
  return {
    sid: b.sid,
    slot: b.slot,
    n: b.n,
    hp: Math.max(0, Math.floor(b.hp || 0)),
    mhp: Math.max(1, Math.floor(b.mhp || 1)),
    x: b.x,
    y: b.y,
    dead: !!(b.dead || b.hp <= 0),
    boss: true,
  };
}

function rowsForMap(mapId) {
  return forMap(mapId).map(publicRow);
}

/** 重生到期 → 回滿血；回傳有變動的 mapId 清單 */
function tick(now) {
  const t = now || Date.now();
  const maps = [];
  for (const b of bosses.values()) {
    if (!b.dead || !b.respawnAt || t < b.respawnAt) continue;
    b.dead = false;
    b.hp = b.mhp;
    b.respawnAt = 0;
    b.hitters = new Map();
    b.hitterNames = new Map();
    if (maps.indexOf(b.mapId) < 0) maps.push(b.mapId);
    try {
      if (onSpawn) onSpawn(b);
    } catch (e) {}
  }
  if (maps.length) {
    bump();
    saveNow();
  }
  return maps;
}

function applyHit(sid, dmg, byKey, byName, meta) {
  const b = get(sid);
  if (!b) return null;
  tick();
  const base = {
    sid: b.sid,
    uid: b.sid,
    slot: b.slot,
    n: b.n,
    mhp: b.mhp,
    mapId: b.mapId,
    boss: true,
    killSeq: b.killSeq || 0,
    mobRow: b,
  };
  if (b.dead || b.hp <= 0) {
    return Object.assign(base, {
      dmg: 0,
      hp: 0,
      dead: true,
      already: true,
      rev: rev,
      lootKey: b.lootKey || "",
      expKeys: b.expShare ? Object.keys(b.expShare) : [],
      expShare: b.expShare || {},
    });
  }
  const dealt = Math.max(0, Math.min(50000, Math.floor(Number(dmg) || 0)));
  const flags = {
    crit: !!(meta && meta.crit),
    heavy: !!(meta && meta.heavy),
    graze: !!(meta && meta.graze),
  };
  if (dealt <= 0) {
    return Object.assign(base, flags, {
      dmg: 0,
      hp: b.hp,
      dead: false,
      already: false,
      miss: true,
      rev: rev,
      lootKey: "",
      expKeys: [],
    });
  }
  const who = String(byKey || "").slice(0, 64);
  const hit = Math.min(dealt, b.hp);
  if (who) {
    b.hitters.set(who, (b.hitters.get(who) || 0) + hit);
    if (byName) b.hitterNames.set(who, cleanText(byName, 24));
  }
  b.hp = Math.max(0, b.hp - dealt);
  const dead = b.hp <= 0;
  let lootKey = "";
  let expShare = {};
  if (dead) {
    let total = 0;
    let top = "";
    let topDmg = -1;
    for (const [k, v] of b.hitters.entries()) {
      total += v;
      if (v > topDmg) {
        topDmg = v;
        top = k;
      }
    }
    for (const [k, v] of b.hitters.entries()) {
      expShare[k] = total > 0 ? Math.round((v / total) * 10000) / 10000 : 0;
    }
    lootKey = top || who;
    if (lootKey && expShare[lootKey] == null) expShare[lootKey] = 1;
    b.dead = true;
    b.respawnAt = Date.now() + RESPAWN_MS;
    b.killSeq = (b.killSeq || 0) + 1;
    b.lootKey = lootKey;
    b.expShare = expShare;
    b.lastKillerName = b.hitterNames.get(lootKey) || cleanText(byName, 24) || "勇者";
    b.lastKillAt = Date.now();
    saveNow();
    try {
      if (onKill) onKill(b, { lootKey: lootKey, killerName: b.lastKillerName });
    } catch (e) {}
  } else {
    saveSoon();
  }
  bump();
  return Object.assign(base, flags, {
    dmg: dealt,
    hp: b.hp,
    dead: dead,
    already: false,
    rev: rev,
    killSeq: b.killSeq || 0,
    lootKey: lootKey,
    expKeys: Object.keys(expShare),
    expShare: expShare,
  });
}

function status() {
  tick();
  const now = Date.now();
  const out = [];
  for (const b of bosses.values()) {
    out.push({
      id: b.id,
      n: b.n,
      lv: b.lv,
      mapId: b.mapId,
      mapName: b.mapName,
      hp: b.hp,
      mhp: b.mhp,
      dead: !!b.dead,
      respawnAt: b.dead ? b.respawnAt || 0 : 0,
      remainMs: b.dead && b.respawnAt ? Math.max(0, b.respawnAt - now) : 0,
      lastKillerName: b.lastKillerName || "",
      lastKillAt: b.lastKillAt || 0,
    });
  }
  return out;
}

function handleApi(req, res, u, json) {
  if (u === "/api/worldboss/status" || u.indexOf("/api/worldboss/status?") === 0) {
    json(res, 200, { ok: true, now: Date.now(), respawnMs: RESPAWN_MS, rev: rev, bosses: status() });
    return true;
  }
  json(res, 404, { ok: false, error: "not_found" });
  return true;
}

module.exports = {
  RESPAWN_MS,
  SLOT_MIN,
  configure,
  define,
  get,
  forMap,
  rowsForMap,
  tick,
  applyHit,
  status,
  handleApi,
  getRev: () => rev,
  _bosses: bosses,
};

"use strict";

const path = require("path");

let _antiCheat = null;
try {
  _antiCheat = require("./rt-anti-cheat");
} catch (e) {}

const ROOT = path.join(__dirname, "..");

const WB_RESPAWN_MS = Math.max(30000, Number(process.env.WB_RESPAWN_MS || 3600000));   // 預設 1 小時全服重生
const WB_SYNC_TTL_MS = 120000;
const WB_PRESENCE_TTL_MS = 90000;

/** @type {Map<string, object>} mapId -> boss state */
const wbStates = new Map();
/** @type {Map<string, object>} playerKey -> { mapId, at, name } */
const wbPresence = new Map();
let wbEventSeq = 0;
/** @type {object[]} */
const wbEvents = [];

function wbPlayerKey(data) {
  const acc = String(data.account || "").trim().slice(0, 64);
  const slot = Math.max(0, Math.floor(Number(data.slot) || 0));
  if (!acc) return "";
  return acc + "#" + slot;
}

function wbSanitizeSlots(slots) {
  if (!Array.isArray(slots)) return [];
  return slots
    .slice(0, 5)
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const i = Math.max(0, Math.min(4, Math.floor(Number(s.i) || 0)));
      if (s.dead || !s.n) return { i, dead: 1 };
      return {
        i,
        n: String(s.n || "")
          .replace(/[<>&"']/g, "")
          .trim()
          .slice(0, 40),
        uid: String(s.uid || "").slice(0, 24),
        hp: Math.max(0, Math.floor(Number(s.hp) || 0)),
        mhp: Math.max(1, Math.floor(Number(s.mhp) || 1)),
        boss: !!s.boss,
        dead: !!(s.dead || Number(s.hp) <= 0),
      };
    })
    .filter(Boolean);
}

function wbMobIdFromMap(mapId) {
  const m = String(mapId || "");
  return m.startsWith("wb_") ? m.slice(3) : "";
}

function wbGetState(mapId) {
  return wbStates.get(mapId) || null;
}

function wbEnsureState(mapId, mobId, mobName, mhp) {
  let st = wbStates.get(mapId);
  const now = Date.now();
  if (!st) {
    st = {
      mapId,
      mobId: mobId || wbMobIdFromMap(mapId),
      mobName: mobName || mobId || "",
      hp: mhp,
      mhp: mhp,
      dead: false,
      respawnAt: 0,
      hostKey: "",
      rev: 0,
      at: now,
    };
    wbStates.set(mapId, st);
    return st;
  }
  if (mobId) st.mobId = mobId;
  if (mobName) st.mobName = mobName;
  if (mhp > 0) {
    if (!st.mhp || st.dead) {
      st.mhp = mhp;
      st.hp = mhp;
    }
  }
  return st;
}

function wbPickHost(mapId) {
  const now = Date.now();
  let best = null;
  for (const [key, pre] of wbPresence.entries()) {
    if (!pre || pre.mapId !== mapId) continue;
    if (now - (pre.at || 0) > WB_PRESENCE_TTL_MS) continue;
    if (!best || (pre.at || 0) < (best.at || 0)) best = { key, at: pre.at || 0 };
  }
  return best ? best.key : "";
}

function wbPushEvent(ev) {
  wbEventSeq += 1;
  const row = Object.assign({ seq: wbEventSeq, at: Date.now() }, ev || {});
  wbEvents.push(row);
  if (wbEvents.length > WB_EVENT_MAX) wbEvents.splice(0, wbEvents.length - WB_EVENT_MAX);
  return row;
}

const WB_EVENT_MAX = 200;

function wbPublicState(st) {
  if (!st) return null;
  return {
    mapId: st.mapId,
    mobId: st.mobId,
    mobName: st.mobName,
    hp: st.hp,
    mhp: st.mhp,
    dead: !!st.dead,
    respawnAt: st.respawnAt || 0,
    hostKey: st.hostKey || "",
    rev: st.rev || 0,
    at: st.at || 0,
  };
}

function wbSyncForClient(mapId, key) {
  const st = wbGetState(mapId);
  if (!st) return null;
  const now = Date.now();
  if (st.dead && st.respawnAt && now >= st.respawnAt) {
    st.dead = false;
    st.hp = st.mhp;
    st.respawnAt = 0;
    st.rev = (st.rev || 0) + 1;
    st.at = now;
    wbPushEvent({ type: "wb_respawn", mapId, mobName: st.mobName });
  }
  const hostKey = wbPickHost(mapId) || st.hostKey || "";
  st.hostKey = hostKey;
  const isHost = !!(hostKey && key && hostKey === key);
  let slots = [];
  if (st.dead) {
    slots = [{ i: 1, dead: 1 }];
  } else if (st.slots && st.slots.length) {
    slots = wbSanitizeSlots(st.slots);
  } else if (st.mobName && st.hp > 0) {
    slots = [
      {
        i: 1,
        n: st.mobName,
        uid: st.uid || "wb-" + st.mapId,
        hp: st.hp,
        mhp: st.mhp,
        boss: 1,
        dead: 0,
      },
    ];
  }
  if (isHost) return null;
  if (!slots.length) return null;
  return {
    mapId,
    hostKey,
    rev: st.rev || 0,
    slots,
    dead: !!st.dead,
    respawnAt: st.respawnAt || 0,
    at: st.at || 0,
  };
}

function wbCleanup(now) {
  const t = now || Date.now();
  for (const [key, pre] of wbPresence.entries()) {
    if (!pre || t - (pre.at || 0) > WB_PRESENCE_TTL_MS) wbPresence.delete(key);
  }
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function handleWorldBossApi(req, res, u, jsonFn) {
  const send = jsonFn || json;
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  wbCleanup();

  if (u === "/api/worldboss/heartbeat" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return send(res, 400, { ok: false, error: "bad json" });
    }
    const key = wbPlayerKey(data);
    const mapId = String(data.mapId || "").slice(0, 64);
    if (!key || !mapId || !mapId.startsWith("wb_")) {
      return send(res, 400, { ok: false, error: "need account and wb mapId" });
    }
    if (_antiCheat) {
      const auth = _antiCheat.authFromBody(data, ROOT);
      if (!auth.ok) {
        return send(res, 401, {
          ok: false,
          error: auth.error || "auth_required",
          message: "世界王需要有效登入，請重新登入。",
        });
      }
    }
    const now = Date.now();
    wbPresence.set(key, {
      mapId,
      at: now,
      name: String(data.name || "").slice(0, 24),
    });
    const mobId = String(data.mobId || wbMobIdFromMap(mapId)).slice(0, 64);
    const mobName = String(data.mobName || "").slice(0, 40);
    const mhp = Math.max(1, Math.floor(Number(data.mhp) || 1));
    const st = wbEnsureState(mapId, mobId, mobName, mhp);
    const hostKey = wbPickHost(mapId);
    st.hostKey = hostKey;
    const isHost = hostKey === key;

    if (data.damage && typeof data.damage === "object") {
      const dmg = Math.max(0, Math.floor(Number(data.damage.amount) || 0));
      const uid = String(data.damage.uid || "").slice(0, 24);
      if (dmg > 0 && !st.dead) {
        const maxDmg = Math.max(1, Math.floor(Number(data.mhp) || st.mhp || 1));
        dmg = Math.min(dmg, maxDmg);
        st.hp = Math.max(0, (st.hp || 0) - dmg);
        st.rev = (st.rev || 0) + 1;
        st.at = now;
        if (st.hp <= 0) {
          st.dead = true;
          st.respawnAt = now + WB_RESPAWN_MS;
          st.slots = [{ i: 1, dead: 1 }];
          wbPushEvent({
            type: "wb_kill",
            mapId,
            mobName: st.mobName,
            killerKey: key,
            killerName: String(data.name || "").slice(0, 24),
          });
        } else if (st.slots && st.slots[0]) {
          st.slots[0].hp = st.hp;
        }
      }
      if (uid) st.uid = uid;
    }

    if (isHost && data.mobSync && typeof data.mobSync === "object") {
      const slots = wbSanitizeSlots(data.mobSync.slots);
      if (slots.length) {
        st.slots = slots;
        const bossSlot = slots.find((s) => s && s.n && !s.dead);
        if (bossSlot) {
          st.mobName = bossSlot.n;
          st.hp = bossSlot.hp;
          st.mhp = bossSlot.mhp;
          st.uid = bossSlot.uid;
          st.dead = false;
          st.respawnAt = 0;
        } else if (slots.every((s) => !s || s.dead)) {
          if (!st.dead) {
            st.dead = true;
            st.respawnAt = now + WB_RESPAWN_MS;
            wbPushEvent({
              type: "wb_kill",
              mapId,
              mobName: st.mobName,
              killerKey: key,
              killerName: String(data.name || "").slice(0, 24),
            });
          }
        }
        st.rev = Math.max(st.rev || 0, Math.floor(Number(data.mobSync.rev) || 0));
        st.at = now;
      }
    }

    const wbSync = wbSyncForClient(mapId, key);
    const wbState = wbPublicState(st);
    return send(res, 200, {
      ok: true,
      key,
      isHost,
      hostKey,
      wbSync,
      wbState,
      seq: wbEventSeq,
    });
  }

  if (u === "/api/worldboss/poll" && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const since = Math.floor(Number(url.searchParams.get("since")) || 0);
    const mapId = String(url.searchParams.get("mapId") || "").slice(0, 64);
    const key = wbPlayerKey({
      account: url.searchParams.get("account"),
      slot: url.searchParams.get("slot"),
    });
    const events = wbEvents.filter((e) => (e.seq || 0) > since);
    let wbSync = null;
    let wbState = null;
    if (mapId && mapId.startsWith("wb_")) {
      wbSync = wbSyncForClient(mapId, key);
      wbState = wbPublicState(wbGetState(mapId));
    }
    return send(res, 200, {
      ok: true,
      events,
      wbSync,
      wbState,
      seq: wbEventSeq,
    });
  }

  if (u === "/api/worldboss/status" && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const mapId = String(url.searchParams.get("mapId") || "").slice(0, 64);
    if (!mapId) {
      const all = [];
      for (const st of wbStates.values()) all.push(wbPublicState(st));
      return send(res, 200, { ok: true, bosses: all, respawnMs: WB_RESPAWN_MS });
    }
    return send(res, 200, { ok: true, state: wbPublicState(wbGetState(mapId)), respawnMs: WB_RESPAWN_MS });
  }

  return send(res, 404, { ok: false, error: "not found" });
}

module.exports = {
  handleWorldBossApi,
  wbGetState,
  wbPublicState,
  WB_RESPAWN_MS,
};

/**
 * 🌐 P1 同圖共用怪（伺服器權威實體）
 * - 穩定 sid（非各端 uid）
 * - 出生／血量／死亡／重生由伺服器管
 * - 客戶端以 mobs snap 對齊
 * - 🪵 training＝個人練習區，不進 MapRoom
 * - 🌐 P4：房鍵 = mapId#channel
 */
"use strict";

const ROOM_IDLE_TTL_MS = 180000;
const RESPAWN_MS_DEFAULT = 8000;
const MAX_SLOTS = 40;

/** @type {Map<string, object>} roomKey -> room */
const mapRooms = new Map();

function mapAllowed(mapId) {
  const id = String(mapId || "").split("#")[0].slice(0, 64);
  if (!id || id.indexOf("town_") === 0) return false;
  if (id === "training") return false;
  if (id === "arena_pvp" || id === "rift_battle") return false;
  if (id.indexOf("wb_") === 0 || id.indexOf("world_boss") === 0) return false;
  if (id.indexOf("king_") === 0 || id.indexOf("siege") >= 0) return false;
  return true;
}

function roomKeyOf(mapId, channel) {
  const id = String(mapId || "").split("#")[0].slice(0, 64);
  if (String(mapId || "").indexOf("#") > 0 && channel == null) return String(mapId);
  const ch = Math.max(1, Math.min(8, Math.floor(Number(channel) || 1)));
  return id + "#" + ch;
}

function mapIdOfKey(key) {
  const s = String(key || "");
  const i = s.lastIndexOf("#");
  return i > 0 ? s.slice(0, i) : s;
}

function channelOfKey(key) {
  const s = String(key || "");
  const i = s.lastIndexOf("#");
  if (i < 0) return 1;
  return Math.max(1, Math.floor(Number(s.slice(i + 1)) || 1));
}

function makeSid(mapId, slot) {
  const id = mapIdOfKey(mapId);
  return "s:" + String(id).slice(0, 48) + ":" + Math.max(0, Math.floor(Number(slot) || 0));
}

function emptyRoom(mapId, channel) {
  const id = mapIdOfKey(mapId);
  const ch = Math.max(1, Math.floor(Number(channel) || channelOfKey(mapId) || 1));
  return {
    mapId: id,
    channel: ch,
    roomKey: roomKeyOf(id, ch),
    rev: 0,
    mobs: new Map(),
    at: Date.now(),
    seeded: false,
  };
}

/**
 * @param {string} mapIdOrKey
 * @param {number|boolean} [channelOrCreate]
 * @param {boolean} [create]
 */
function getRoom(mapIdOrKey, channelOrCreate, create) {
  let channel = 1;
  let doCreate = false;
  if (typeof channelOrCreate === "boolean") {
    doCreate = channelOrCreate;
  } else if (channelOrCreate != null) {
    channel = channelOrCreate;
    doCreate = !!create;
  } else {
    doCreate = !!create;
  }
  const id = mapIdOfKey(mapIdOrKey);
  if (!mapAllowed(id)) return null;
  const key =
    String(mapIdOrKey).indexOf("#") > 0 ? String(mapIdOrKey) : roomKeyOf(id, channel);
  let room = mapRooms.get(key);
  if (!room && doCreate) {
    room = emptyRoom(id, channelOfKey(key));
    mapRooms.set(key, room);
  }
  return room || null;
}

function bump(room) {
  room.rev = (room.rev || 0) + 1;
  room.at = Date.now();
  return room.rev;
}

function publicMob(m) {
  if (!m) return null;
  return {
    sid: m.sid,
    slot: m.slot,
    n: m.n || "",
    hp: Math.max(0, Math.floor(Number(m.hp) || 0)),
    mhp: Math.max(1, Math.floor(Number(m.mhp) || 1)),
    x: Math.round(Number(m.x) || 0),
    y: Math.round(Number(m.y) || 0),
    dead: !!(m.dead || m.hp <= 0),
  };
}

function snapOf(mapIdOrKey, channel) {
  const room = getRoom(mapIdOrKey, channel, false);
  if (!room) return null;
  tickRespawns(room);
  const list = [];
  for (const m of room.mobs.values()) {
    const p = publicMob(m);
    if (p) list.push(p);
  }
  list.sort((a, b) => (a.slot || 0) - (b.slot || 0));
  return {
    mapId: room.mapId,
    channel: room.channel || 1,
    rev: room.rev || 0,
    mobs: list,
    at: Date.now(),
  };
}

function seedRoster(mapIdOrKey, slots, channel) {
  const id = mapIdOfKey(mapIdOrKey);
  if (!mapAllowed(id)) return null;
  const room = getRoom(mapIdOrKey, channel, true);
  if (!room) return null;
  if (room.seeded && room.mobs.size) {
    tickRespawns(room);
    return snapOf(room.roomKey);
  }
  const arr = Array.isArray(slots) ? slots.slice(0, MAX_SLOTS) : [];
  room.mobs.clear();
  for (const s of arr) {
    if (!s) continue;
    const slot = Math.max(0, Math.min(MAX_SLOTS - 1, Math.floor(Number(s.slot) || 0)));
    const n = String(s.n || "")
      .replace(/[<>&"']/g, "")
      .trim()
      .slice(0, 40);
    if (!n) continue;
    const mhp = Math.max(1, Math.min(2e9, Math.floor(Number(s.mhp) || 1)));
    const hpHint = s.hp != null ? Math.floor(Number(s.hp)) : mhp;
    const hp = Math.max(0, Math.min(mhp, hpHint));
    const lv = Math.max(1, Math.min(200, Math.floor(Number(s.lv) || 1)));
    const ac = Math.max(-50, Math.min(80, Math.floor(Number(s.ac != null ? s.ac : 10))));
    const dr = Math.max(0, Math.min(200, Math.floor(Number(s.dr) || 0)));
    const hardSkin = Math.max(0, Math.min(200, Math.floor(Number(s.hardSkin) || 0)));
    const er = Math.max(0, Math.min(100, Math.floor(Number(s.er) || 0)));
    const sid = makeSid(id, slot);
    room.mobs.set(sid, {
      sid,
      slot,
      n,
      mhp,
      hp,
      lv,
      ac,
      dr,
      hardSkin,
      er,
      x: Math.round(Number(s.x) || 0),
      y: Math.round(Number(s.y) || 0),
      dead: hp <= 0,
      respawnAt: hp <= 0 ? Date.now() + RESPAWN_MS_DEFAULT : 0,
      tpl: { n, mhp, lv, ac, dr, hardSkin, er },
    });
  }
  room.seeded = room.mobs.size > 0;
  if (room.seeded) bump(room);
  return snapOf(room.roomKey);
}

function findMob(room, sidOrSlot) {
  if (!room) return null;
  const key = String(sidOrSlot || "");
  if (room.mobs.has(key)) return room.mobs.get(key);
  let slot = -1;
  if (key.indexOf("f:") === 0) slot = parseInt(key.slice(2), 10);
  else if (key.indexOf("s:") === 0) {
    const parts = key.split(":");
    slot = parseInt(parts[parts.length - 1], 10);
  } else if (/^\d+$/.test(key)) slot = parseInt(key, 10);
  if (slot >= 0) {
    for (const m of room.mobs.values()) {
      if (m && m.slot === slot) return m;
    }
  }
  return null;
}

function tickRespawns(room) {
  if (!room) return false;
  const now = Date.now();
  let changed = false;
  for (const m of room.mobs.values()) {
    if (!m) continue;
    if (m.dead || m.hp <= 0) {
      if (!m.respawnAt) m.respawnAt = now + RESPAWN_MS_DEFAULT;
      if (now >= m.respawnAt) {
        const tpl = m.tpl || { n: m.n, mhp: m.mhp };
        m.n = tpl.n || m.n;
        m.mhp = Math.max(1, Math.floor(Number(tpl.mhp) || m.mhp || 1));
        m.hp = m.mhp;
        if (tpl.lv != null) m.lv = tpl.lv;
        if (tpl.ac != null) m.ac = tpl.ac;
        if (tpl.dr != null) m.dr = tpl.dr;
        if (tpl.hardSkin != null) m.hardSkin = tpl.hardSkin;
        if (tpl.er != null) m.er = tpl.er;
        m.dead = false;
        m.respawnAt = 0;
        m.hitters = new Map();
        m.killerKey = "";
        m.killSeq = (m.killSeq || 0) + 1;
        changed = true;
      }
    }
  }
  if (changed) bump(room);
  return changed;
}

function applyHit(mapIdOrKey, sid, dmg, byKey, meta, channel) {
  const room = getRoom(mapIdOrKey, channel, false);
  if (!room) return null;
  tickRespawns(room);
  const mob = findMob(room, sid);
  if (!mob) return null;
  const dealt = Math.max(0, Math.min(50000, Math.floor(Number(dmg) || 0)));
  if (mob.dead || mob.hp <= 0) {
    return {
      sid: mob.sid,
      slot: mob.slot,
      uid: mob.sid,
      dmg: 0,
      hp: 0,
      mhp: mob.mhp,
      n: mob.n,
      dead: true,
      already: true,
      rev: room.rev,
      lootKey: mob.killerKey || "",
      expKeys: mob.hitters ? Array.from(mob.hitters.keys()) : [],
      killSeq: mob.killSeq || 0,
      mobRow: mob,
      channel: room.channel,
    };
  }
  if (dealt <= 0) {
    return {
      sid: mob.sid,
      slot: mob.slot,
      uid: mob.sid,
      dmg: 0,
      hp: mob.hp,
      mhp: mob.mhp,
      n: mob.n,
      dead: false,
      already: false,
      miss: true,
      rev: room.rev,
      lootKey: "",
      expKeys: [],
      killSeq: mob.killSeq || 0,
      crit: !!(meta && meta.crit),
      heavy: !!(meta && meta.heavy),
      graze: !!(meta && meta.graze),
      mobRow: mob,
      channel: room.channel,
    };
  }
  const attacker = String(byKey || "").slice(0, 64);
  if (attacker) {
    if (!mob.hitters) mob.hitters = new Map();
    mob.hitters.set(attacker, (mob.hitters.get(attacker) || 0) + dealt);
  }
  mob.hp = Math.max(0, mob.hp - dealt);
  mob.at = Date.now();
  const dead = mob.hp <= 0;
  let lootKey = "";
  let expKeys = [];
  let killSeq = mob.killSeq || 0;
  if (dead) {
    mob.dead = true;
    mob.respawnAt = Date.now() + RESPAWN_MS_DEFAULT;
    lootKey = attacker || "";
    mob.killerKey = lootKey;
    expKeys = mob.hitters ? Array.from(mob.hitters.keys()) : [];
    if (lootKey && expKeys.indexOf(lootKey) < 0) expKeys.push(lootKey);
    killSeq = (mob.killSeq || 0) + 1;
    mob.killSeq = killSeq;
  }
  bump(room);
  return {
    sid: mob.sid,
    slot: mob.slot,
    uid: mob.sid,
    dmg: dealt,
    hp: mob.hp,
    mhp: mob.mhp,
    n: mob.n,
    dead: dead,
    already: false,
    rev: room.rev,
    lootKey: lootKey,
    expKeys: expKeys,
    killSeq: killSeq,
    crit: !!(meta && meta.crit),
    heavy: !!(meta && meta.heavy),
    graze: !!(meta && meta.graze),
    mobRow: mob,
    channel: room.channel,
  };
}

function cleanupIdle(now) {
  const t = now || Date.now();
  for (const [id, room] of mapRooms.entries()) {
    if (!room || t - (room.at || 0) > ROOM_IDLE_TTL_MS) mapRooms.delete(id);
  }
}

setInterval(() => {
  try {
    cleanupIdle(Date.now());
    for (const room of mapRooms.values()) {
      if (room) tickRespawns(room);
    }
  } catch (e) {}
}, 1000).unref?.();

module.exports = {
  mapAllowed,
  makeSid,
  getRoom,
  seedRoster,
  snapOf,
  applyHit,
  tickRespawns,
  findMob,
  mapRooms,
  roomKeyOf,
  mapIdOfKey,
};

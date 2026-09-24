/**
 * 🌐 MMORPG 即時世界通道（WebSocket）
 * - 同圖玩家座標／狀態推送（取代純 HTTP 4~5 秒輪詢）
 * - 複用 _serve.js 的 partyPresence
 * - 無額外套件：純 Node HTTP upgrade + RFC6455 文字幀
 */
"use strict";

const crypto = require("crypto");
const mapMobs = require("./rt-map-mobs");
const combatDmg = require("./rt-combat-dmg");
const channels = require("./rt-map-channels");

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MOVE_MIN_MS = 80; // 每連線最快推送間隔
const SNAP_THROTTLE_MS = 100;
const HIT_MIN_MS = 50; // 每連線最快攻擊結算間隔（再由 combat.aspdMs 收斂）
const HIT_DMG_MAX = 50000;
const AUTH_MOB_TTL_MS = 120000;
const AUTH_MOB_CAP = 80; // 每圖最多追蹤隻數（舊 uid 路徑備援）
const COMBAT_SNAP_TTL_MS = 120000;

/** @type {Map<string, Set<object>>} roomKey(mapId#ch) -> sockets */
const rooms = new Map();
/** @type {WeakMap<object, object>} socket meta */
const metaOf = new WeakMap();
/** @type {Map<string, Map<string, object>>} mapId -> uid -> {hp,mhp,n,at} */
const authMobs = new Map();

function wsAcceptKey(secKey) {
  return crypto.createHash("sha1").update(String(secKey) + WS_GUID).digest("base64");
}

function wsSend(socket, obj) {
  if (!socket || socket.destroyed || socket.readyState === "closed") return;
  try {
    const payload = Buffer.from(JSON.stringify(obj), "utf8");
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81;
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(len, 6);
    }
    socket.write(Buffer.concat([header, payload]));
  } catch (e) {}
}

function wsClose(socket, code) {
  try {
    if (socket && !socket.destroyed) {
      const buf = Buffer.alloc(4);
      buf[0] = 0x88;
      buf[1] = 0x02;
      buf.writeUInt16BE(code || 1000, 2);
      socket.write(buf);
      socket.end();
    }
  } catch (e) {}
}

function parseFrames(buffer) {
  const out = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let hdr = 2;
    if (len === 126) {
      if (offset + 4 > buffer.length) break;
      len = buffer.readUInt16BE(offset + 2);
      hdr = 4;
    } else if (len === 127) {
      if (offset + 10 > buffer.length) break;
      len = Number(buffer.readUInt32BE(offset + 6));
      hdr = 10;
    }
    const maskLen = masked ? 4 : 0;
    if (offset + hdr + maskLen + len > buffer.length) break;
    let payload = buffer.slice(offset + hdr + maskLen, offset + hdr + maskLen + len);
    if (masked) {
      const mask = buffer.slice(offset + hdr, offset + hdr + 4);
      const decoded = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i++) decoded[i] = payload[i] ^ mask[i % 4];
      payload = decoded;
    }
    offset += hdr + maskLen + len;
    if (opcode === 0x8) out.push({ type: "close" });
    else if (opcode === 0x9) out.push({ type: "ping", data: payload });
    else if (opcode === 0xa) out.push({ type: "pong" });
    else if (opcode === 0x1) out.push({ type: "text", data: payload.toString("utf8") });
  }
  return { messages: out, rest: buffer.slice(offset) };
}

function leaveRoom(socket) {
  const meta = metaOf.get(socket);
  if (!meta || !meta.roomKey) {
    if (meta) {
      meta.mapId = "";
      meta.channel = 1;
      meta.roomKey = "";
    }
    return;
  }
  const set = rooms.get(meta.roomKey);
  if (set) {
    set.delete(socket);
    if (!set.size) rooms.delete(meta.roomKey);
  }
  meta.mapId = "";
  meta.channel = 1;
  meta.roomKey = "";
}

function joinRoom(socket, mapId, channel) {
  const id = channels.sanitizeMapId(mapId) || String(mapId || "").slice(0, 64);
  const ch = channels.sanitizeChannel(channel) || 1;
  const key = id ? channels.roomKey(id, ch) : "";
  const meta = metaOf.get(socket);
  if (!meta) return;
  if (meta.roomKey === key && meta.mapId === id) {
    meta.channel = ch;
    return;
  }
  leaveRoom(socket);
  meta.mapId = id;
  meta.channel = ch;
  meta.roomKey = key;
  if (!id || !key) return;
  // 村莊也進房（人數／未來村莊可見），training 仍進房但 snap 空
  let set = rooms.get(key);
  if (!set) {
    set = new Set();
    rooms.set(key, set);
  }
  set.add(socket);
}

function playerPublic(pre) {
  if (!pre) return null;
  return {
    key: pre.key,
    name: pre.name || "冒險者",
    cls: pre.cls || "",
    lv: pre.lv || 1,
    hp: pre.hp || 0,
    mhp: pre.mhp || 1,
    wx: pre.wx || 0,
    wy: pre.wy || 0,
    pvpOn: !!pre.pvpOn,
    online: true,
  };
}

function authMapAllowed(mapId) {
  return mapMobs.mapAllowed(mapId);
}

function authRoom(mapId) {
  const id = String(mapId || "").slice(0, 64);
  if (!authMapAllowed(id)) return null;
  let room = authMobs.get(id);
  if (!room) {
    room = new Map();
    authMobs.set(id, room);
  }
  return room;
}

function authCleanup(mapId, now) {
  const room = authMobs.get(mapId);
  if (!room) return;
  const t = now || Date.now();
  for (const [uid, row] of room.entries()) {
    if (!row || t - (row.at || 0) > AUTH_MOB_TTL_MS) room.delete(uid);
  }
  if (!room.size) authMobs.delete(mapId);
}

function authEnsureMob(mapId, uid, mhp, n, hpHint, allowRespawn) {
  const room = authRoom(mapId);
  if (!room || !uid) return null;
  authCleanup(mapId);
  let row = room.get(uid);
  const maxHp = Math.max(1, Math.min(2e9, Math.floor(Number(mhp) || 1)));
  if (!row) {
    if (room.size >= AUTH_MOB_CAP) {
      // 擠掉最舊
      let oldest = null;
      let oldestAt = Infinity;
      for (const [u, r] of room.entries()) {
        if ((r.at || 0) < oldestAt) {
          oldestAt = r.at || 0;
          oldest = u;
        }
      }
      if (oldest) room.delete(oldest);
    }
    const seedHp = hpHint != null ? Math.max(0, Math.min(maxHp, Math.floor(Number(hpHint)))) : maxHp;
    row = { hp: seedHp, mhp: maxHp, n: String(n || "").slice(0, 40), at: Date.now() };
    room.set(uid, row);
  } else {
    row.mhp = Math.max(row.mhp || 1, maxHp);
    if (n) row.n = String(n).slice(0, 40);
    // 僅 mob_seed 可重生；hit 帶 hpBefore 不得把已死怪救活
    if (allowRespawn && row.hp <= 0 && hpHint != null && Math.floor(Number(hpHint)) > 0) {
      row.hp = Math.max(0, Math.min(maxHp, Math.floor(Number(hpHint))));
      row.mhp = maxHp;
    }
    row.at = Date.now();
  }
  return row;
}

function authApplyHit(mapId, uid, dmg, mhp, n, hpBefore) {
  const id = String(mapId || "").slice(0, 64);
  const u = String(uid || "").slice(0, 48);
  if (!authMapAllowed(id) || !u) return null;
  const dealt = Math.max(0, Math.min(HIT_DMG_MAX, Math.floor(Number(dmg) || 0)));
  const row = authEnsureMob(id, u, mhp || 1, n, hpBefore != null ? Math.floor(Number(hpBefore)) : undefined, false);
  if (!row) return null;
  if (row.hp <= 0) {
    return { uid: u, dmg: 0, hp: 0, mhp: row.mhp, n: row.n, dead: true, already: true };
  }
  if (dealt <= 0) {
    return { uid: u, dmg: 0, hp: row.hp, mhp: row.mhp, n: row.n, dead: false, already: false, miss: true };
  }
  // 不以客戶端 hpBefore 抬高伺服器血量（避免各端未同步時把血量重置）
  row.hp = Math.max(0, row.hp - dealt);
  row.at = Date.now();
  const dead = row.hp <= 0;
  return { uid: u, dmg: dealt, hp: row.hp, mhp: row.mhp, n: row.n, dead: dead, already: false };
}

function broadcastRoom(mapId, obj, exceptSocket) {
  const id = String(mapId || "");
  const set = rooms.get(id);
  if (!set || !set.size) return;
  for (const sock of set) {
    if (sock === exceptSocket) continue;
    wsSend(sock, obj);
  }
}

/**
 * @param {object} deps
 * @param {Function} deps.upsertPresence - (body) => {key, presence}|null
 * @param {Function} deps.mapPlayersHere - (mapId, excludeKey, now) => players[]
 * @param {Function} deps.electHost - (mapId, now) => hostKey
 * @param {Function} [deps.onLog]
 */
function attachWorldWs(server, deps) {
  const upsertPresence = deps.upsertPresence;
  const mapPlayersHere = deps.mapPlayersHere;
  const electHost = deps.electHost;
  const getPresenceValues = deps.getPresenceValues || function () { return []; };
  const presenceTtlMs = deps.presenceTtlMs || 90000;
  const onLog = deps.onLog || function () {};

  function pushMobsSnap(mapIdOrKey, onlySocket, channel) {
    const key =
      String(mapIdOrKey || "").indexOf("#") > 0
        ? String(mapIdOrKey)
        : mapMobs.roomKeyOf(mapIdOrKey, channel || 1);
    const id = mapMobs.mapIdOfKey(key);
    if (!mapMobs.mapAllowed(id)) return;
    const snap = mapMobs.snapOf(key);
    if (!snap) return;
    const pack = Object.assign({ t: "mobs" }, snap);
    if (onlySocket) {
      wsSend(onlySocket, pack);
      return;
    }
    broadcastRoom(key, pack, null);
  }

  function pushMapSnap(mapIdOrKey, exceptSocket, channel) {
    const parsed = channels.parseRoomKey(
      String(mapIdOrKey || "").indexOf("#") > 0
        ? mapIdOrKey
        : channels.roomKey(mapIdOrKey, channel || 1)
    );
    const id = parsed.mapId;
    const ch = parsed.channel;
    const key = channels.roomKey(id, ch);
    if (!id || id.indexOf("town_") === 0) return;
    if (id === "training") return;
    const set = rooms.get(key);
    if (!set || !set.size) return;
    const now = Date.now();
    const host = electHost ? electHost(id, now, ch) || "" : "";
    for (const sock of set) {
      if (sock === exceptSocket) continue;
      const m = metaOf.get(sock);
      if (!m || !m.key) continue;
      if (m.lastSnapAt && now - m.lastSnapAt < SNAP_THROTTLE_MS) continue;
      m.lastSnapAt = now;
      const players = mapPlayersHere(id, m.key, now, ch) || [];
      wsSend(sock, {
        t: "map",
        mapId: id,
        channel: ch,
        players: players,
        host: host,
        at: now,
      });
    }
  }

  server.on("upgrade", (req, socket, head) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.pathname !== "/ws/world") {
        socket.destroy();
        return;
      }
      const key = req.headers["sec-websocket-key"];
      if (!key) {
        socket.destroy();
        return;
      }
      const accept = wsAcceptKey(key);
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          "Sec-WebSocket-Accept: " +
          accept +
          "\r\n\r\n"
      );
      if (head && head.length) socket.unshift(head);

      const meta = {
        key: "",
        mapId: "",
        channel: 1,
        roomKey: "",
        name: "",
        lastMoveAt: 0,
        lastSnapAt: 0,
        lastHitAt: 0,
        lastEnterAt: 0,
        combat: null,
        buf: Buffer.alloc(0),
      };
      metaOf.set(socket, meta);
      socket.setNoDelay(true);

      socket.on("data", (chunk) => {
        meta.buf = Buffer.concat([meta.buf, chunk]);
        if (meta.buf.length > 1e6) {
          wsClose(socket, 1009);
          return;
        }
        const parsed = parseFrames(meta.buf);
        meta.buf = parsed.rest;
        for (const msg of parsed.messages) {
          if (msg.type === "close") {
            cleanup(socket);
            return;
          }
          if (msg.type === "ping") {
            // pong
            try {
              const len = msg.data ? msg.data.length : 0;
              const hdr = Buffer.alloc(2);
              hdr[0] = 0x8a;
              hdr[1] = len;
              socket.write(Buffer.concat([hdr, msg.data || Buffer.alloc(0)]));
            } catch (e) {}
            continue;
          }
          if (msg.type !== "text") continue;
          let data;
          try {
            data = JSON.parse(msg.data);
          } catch (e) {
            continue;
          }
          handleClient(socket, meta, data);
        }
      });

      socket.on("close", () => cleanup(socket));
      socket.on("error", () => cleanup(socket));
      onLog("ws world connected");
    } catch (e) {
      try {
        socket.destroy();
      } catch (e2) {}
    }
  });

  function cleanup(socket) {
    try {
      const m = metaOf.get(socket);
      const prevKey = m && m.roomKey;
      leaveRoom(socket);
      if (prevKey) pushMapSnap(prevKey, socket);
    } catch (e) {}
    try {
      if (!socket.destroyed) socket.destroy();
    } catch (e2) {}
  }

  function handleClient(socket, meta, data) {
    if (!data || typeof data !== "object") return;
    const t = String(data.t || "");
    if (t === "ping") {
      wsSend(socket, { t: "pong", at: Date.now() });
      return;
    }
    // 🌐 P4：進出圖閘門＋頻道分配
    if (t === "enter") {
      if (!meta.key) {
        // 允許先 enter 再帶 account
        const up0 = upsertPresence(data);
        if (!up0 || !up0.key) {
          wsSend(socket, { t: "enter_rej", error: "need_account" });
          return;
        }
        meta.key = up0.key;
        if (up0.presence && up0.presence.name) meta.name = String(up0.presence.name);
      }
      const now = Date.now();
      if (now - (meta.lastEnterAt || 0) < channels.ENTER_COOLDOWN_MS) {
        wsSend(socket, {
          t: "enter_rej",
          error: "cooldown",
          waitMs: channels.ENTER_COOLDOWN_MS - (now - (meta.lastEnterAt || 0)),
        });
        return;
      }
      const mapId = channels.sanitizeMapId(data.mapId);
      if (!mapId) {
        wsSend(socket, { t: "enter_rej", error: "bad_map" });
        return;
      }
      const loads = channels.channelLoads(getPresenceValues(), now, presenceTtlMs);
      const picked = channels.pickChannel(mapId, data.channel, loads);
      if (picked.error === "bad_map") {
        wsSend(socket, { t: "enter_rej", error: "bad_map" });
        return;
      }
      const ch = picked.channel;
      const prevKey = meta.roomKey;
      // 寫入 presence（含 channel）
      const up = upsertPresence(
        Object.assign({}, data, { mapId: mapId, channel: ch, account: data.account || undefined, name: data.name || meta.name })
      );
      if (up && up.key) meta.key = up.key;
      if (up && up.presence && up.presence.name) meta.name = String(up.presence.name);
      joinRoom(socket, mapId, ch);
      meta.lastEnterAt = now;
      if (data.combat && typeof data.combat === "object") {
        meta.combat = combatDmg.sanitizeCombatSnap(data.combat);
      }
      if (prevKey && prevKey !== meta.roomKey) pushMapSnap(prevKey, socket);
      const players =
        mapId.indexOf("town_") === 0 || mapId === "training"
          ? []
          : mapPlayersHere(mapId, meta.key, now, ch) || [];
      const host = electHost ? electHost(mapId, now, ch) || "" : "";
      wsSend(socket, {
        t: "enter_ok",
        mapId: mapId,
        channel: ch,
        roomKey: meta.roomKey,
        players: players,
        host: host,
        full: !!picked.full,
        maxCh: channels.MAX_CHANNELS,
        cap: channels.CAP_PER_CHANNEL,
        at: now,
        p4: true,
      });
      if (mapId.indexOf("town_") !== 0 && mapId !== "training") {
        pushMapSnap(meta.roomKey, null);
        if (mapMobs.mapAllowed(mapId)) pushMobsSnap(meta.roomKey, socket);
      }
      return;
    }
    if (t === "hello" || t === "move" || t === "state") {
      const up = upsertPresence(data);
      if (!up || !up.key) {
        wsSend(socket, { t: "err", error: "need_account" });
        return;
      }
      meta.key = up.key;
      if (up.presence && up.presence.name) meta.name = String(up.presence.name);
      else if (data.name) meta.name = String(data.name).slice(0, 24);
      if (data.combat && typeof data.combat === "object") {
        meta.combat = combatDmg.sanitizeCombatSnap(data.combat);
      }
      const mapId = String((up.presence && up.presence.mapId) || data.mapId || "");
      const ch =
        channels.sanitizeChannel(data.channel) ||
        channels.sanitizeChannel(up.presence && up.presence.channel) ||
        meta.channel ||
        1;
      const prevKey = meta.roomKey;
      joinRoom(socket, mapId, ch);
      if (t === "hello") {
        wsSend(socket, {
          t: "hello_ok",
          key: up.key,
          mapId: meta.mapId,
          channel: meta.channel,
          at: Date.now(),
          p3: true,
          p4: true,
        });
      }
      const now = Date.now();
      if (t === "move") {
        if (now - meta.lastMoveAt < MOVE_MIN_MS) return;
        meta.lastMoveAt = now;
      }
      if (mapId && mapId.indexOf("town_") !== 0) {
        pushMapSnap(meta.roomKey || channels.roomKey(mapId, ch), null);
        if (prevKey && prevKey !== meta.roomKey) pushMapSnap(prevKey, null);
      }
      if (mapId && mapId.indexOf("town_") !== 0 && mapId !== "training") {
        const players = mapPlayersHere(mapId, up.key, now, ch) || [];
        const host = electHost ? electHost(mapId, now, ch) || "" : "";
        wsSend(socket, {
          t: "map",
          mapId: mapId,
          channel: ch,
          players: players,
          host: host,
          at: now,
        });
        if (mapMobs.mapAllowed(mapId)) {
          pushMobsSnap(meta.roomKey || channels.roomKey(mapId, ch), socket);
        }
      } else if (mapId === "training") {
        wsSend(socket, { t: "map", mapId: mapId, channel: 1, players: [], host: "", at: now });
      }
      return;
    }
    // P1：客戶端提議花名冊（空房才種子）
    if (t === "mob_roster") {
      if (!meta.key) return;
      const mapId = String(meta.mapId || data.mapId || "").slice(0, 64);
      const ch = meta.channel || 1;
      if (!mapMobs.mapAllowed(mapId)) return;
      const snap = mapMobs.seedRoster(mapId, data.slots, ch);
      if (snap) {
        const pack = Object.assign({ t: "mobs" }, snap);
        const rk = meta.roomKey || channels.roomKey(mapId, ch);
        wsSend(socket, pack);
        broadcastRoom(rk, pack, socket);
      }
      return;
    }
    // ⚔️ 伺服器權威傷害：P3 用戰鬥快照擲骰（不信客戶端 dmg）
    if (t === "hit") {
      if (!meta.key) {
        wsSend(socket, { t: "err", error: "need_hello" });
        return;
      }
      const now = Date.now();
      const combat = meta.combat;
      const aspdGate = combat && combat.aspdMs ? Math.max(HIT_MIN_MS, Math.min(2000, combat.aspdMs * 0.45)) : HIT_MIN_MS;
      if (now - (meta.lastHitAt || 0) < aspdGate) return;
      meta.lastHitAt = now;
      const mapId = String(meta.mapId || data.mapId || "").slice(0, 64);
      const ch = meta.channel || 1;
      const rk = meta.roomKey || channels.roomKey(mapId, ch);
      if (!authMapAllowed(mapId) || mapId.indexOf("town_") === 0) {
        wsSend(socket, { t: "hit_rej", error: "bad_map" });
        return;
      }
      if (!combat || now - (combat.at || 0) > COMBAT_SNAP_TTL_MS) {
        wsSend(socket, { t: "hit_rej", error: "need_combat" });
        return;
      }
      const sid = String(data.sid || data.uid || "").slice(0, 64);
      const kind = String(data.kind || "phys").slice(0, 12) === "magic" ? "magic" : "phys";
      let mobRow = null;
      try {
        const room = mapMobs.getRoom(rk, false);
        if (room) mobRow = mapMobs.findMob(room, sid);
      } catch (eFind) {}
      const mobDef = combatDmg.mobDefFromRow(
        mobRow || {
          lv: data.mobLv,
          ac: data.mobAc,
          dr: data.mobDr,
          hardSkin: data.mobHardSkin,
          er: data.mobEr,
        }
      );
      const rolled = combatDmg.rollDamage(combat, mobDef, kind);
      let dealt = Math.max(0, Math.min(HIT_DMG_MAX, Math.floor(Number(rolled.dmg) || 0)));
      let result = mapMobs.applyHit(rk, sid, dealt, meta.key, {
        crit: !!rolled.crit,
        heavy: !!rolled.heavy,
        graze: !!rolled.graze,
      });
      if (!result) {
        result = authApplyHit(mapId, data.uid || sid, dealt, data.mhp, data.n, data.hpBefore);
        if (result) {
          result.crit = !!rolled.crit;
          result.heavy = !!rolled.heavy;
          result.graze = !!rolled.graze;
          if (dealt <= 0) result.miss = true;
        }
      }
      if (!result) {
        wsSend(socket, { t: "hit_rej", error: "bad_hit" });
        return;
      }
      const pack = {
        t: "hit_fx",
        mapId: mapId,
        channel: ch,
        sid: result.sid || result.uid,
        uid: result.uid || result.sid,
        slot: result.slot,
        dmg: result.dmg,
        hp: result.hp,
        mhp: result.mhp,
        n: result.n || "",
        dead: !!result.dead,
        already: !!result.already,
        miss: !!result.miss || (!result.already && result.dmg <= 0),
        crit: !!result.crit,
        heavy: !!result.heavy,
        graze: !!result.graze,
        kind: kind,
        rev: result.rev || 0,
        by: meta.key,
        byName: meta.name || "冒險者",
        at: now,
      };
      wsSend(socket, Object.assign({}, pack, { t: "hit_ok" }));
      if (!result.already && result.dmg > 0) {
        broadcastRoom(rk, pack, socket);
      }
      if (result.dead && !result.already) {
        const killPack = {
          t: "kill",
          mapId: mapId,
          channel: ch,
          sid: result.sid || result.uid,
          uid: result.uid || result.sid,
          slot: result.slot,
          n: result.n || "",
          lootKey: result.lootKey || meta.key,
          expKeys: Array.isArray(result.expKeys) && result.expKeys.length ? result.expKeys : [meta.key],
          killSeq: result.killSeq || 0,
          by: meta.key,
          byName: meta.name || "冒險者",
          at: now,
        };
        for (const sock of rooms.get(rk) || []) {
          wsSend(sock, killPack);
        }
        pushMobsSnap(rk, null);
      } else if (result.dead && result.already) {
        // 🩹 v3.9.32：已死重打仍補發 kill，讓卡在 _awaitAuthKill 的客戶端能入帳
        const killPackAlready = {
          t: "kill",
          mapId: mapId,
          channel: ch,
          sid: result.sid || result.uid,
          uid: result.uid || result.sid,
          slot: result.slot,
          n: result.n || "",
          lootKey: result.lootKey || meta.key,
          expKeys: Array.isArray(result.expKeys) && result.expKeys.length ? result.expKeys : [meta.key],
          killSeq: result.killSeq || 0,
          by: meta.key,
          byName: meta.name || "冒險者",
          at: now,
          already: true,
        };
        wsSend(socket, killPackAlready);
      }
      return;
    }
    // 註冊／對齊怪血（出生或進圖時）— 舊路徑保留
    if (t === "mob_seed") {
      if (!meta.key) return;
      const mapId = String(meta.mapId || data.mapId || "").slice(0, 64);
      if (!authMapAllowed(mapId)) return;
      const uid = String(data.uid || data.sid || "").slice(0, 48);
      if (!uid) return;
      const row = authEnsureMob(mapId, uid, data.mhp, data.n, data.hp, true);
      if (!row) return;
      wsSend(socket, {
        t: "mob_hp",
        mapId: mapId,
        uid: uid,
        sid: uid,
        hp: row.hp,
        mhp: row.mhp,
        n: row.n,
        dead: row.hp <= 0,
        at: Date.now(),
      });
      return;
    }
  }

  // 重生 tick：有人在房時推 snap
  setInterval(() => {
    try {
      for (const [rk, set] of rooms.entries()) {
        if (!set || !set.size) continue;
        if (!mapMobs.mapAllowed(rk)) continue;
        const room = mapMobs.getRoom(rk, false);
        if (!room) continue;
        const before = room.rev;
        mapMobs.tickRespawns(room);
        if (room.rev !== before) pushMobsSnap(rk, null);
      }
    } catch (e) {}
  }, 1200).unref?.();

  return {
    rooms: rooms,
    broadcastMap: pushMapSnap,
    pushMobsSnap: pushMobsSnap,
    authMobs: authMobs,
    mapRooms: mapMobs.mapRooms,
  };
}

module.exports = { attachWorldWs, playerPublic, authMapAllowed, channels };

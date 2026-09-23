/**
 * 🌐 P4 地圖頻道／進出圖閘門
 * - roomKey = mapId#channel
 * - 負載分頻：滿員自動開下一頻
 * - enter 冷卻、地圖 id 淨化
 */
"use strict";

const MAX_CHANNELS = 8;
const CAP_PER_CHANNEL = 40;
const ENTER_COOLDOWN_MS = 1200;
const BLOCKED_MAPS = new Set(["town_sherine"]);

function sanitizeMapId(raw) {
  const id = String(raw || "")
    .trim()
    .slice(0, 64);
  if (!id) return "";
  if (!/^[a-zA-Z0-9_]+$/.test(id)) return "";
  if (BLOCKED_MAPS.has(id)) return "";
  return id;
}

function sanitizeChannel(raw) {
  const n = Math.floor(Number(raw) || 0);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(MAX_CHANNELS, n);
}

function roomKey(mapId, channel) {
  const id = sanitizeMapId(mapId) || String(mapId || "").slice(0, 64);
  const ch = sanitizeChannel(channel) || 1;
  return id + "#" + ch;
}

function parseRoomKey(key) {
  const s = String(key || "");
  const i = s.lastIndexOf("#");
  if (i <= 0) return { mapId: sanitizeMapId(s) || s, channel: 1 };
  return {
    mapId: sanitizeMapId(s.slice(0, i)) || s.slice(0, i),
    channel: sanitizeChannel(s.slice(i + 1)) || 1,
  };
}

/**
 * 統計各圖各頻人數
 * @param {Iterable<object>} presenceValues presence rows with mapId, channel, lastSeen
 * @param {number} now
 * @param {number} ttlMs
 */
function channelLoads(presenceValues, now, ttlMs) {
  const loads = Object.create(null); // mapId -> {1:n, 2:n, ...}
  const t = now || Date.now();
  for (const pre of presenceValues) {
    if (!pre || !pre.mapId) continue;
    if (ttlMs && t - (pre.lastSeen || 0) > ttlMs) continue;
    const id = sanitizeMapId(pre.mapId) || String(pre.mapId).slice(0, 64);
    if (!id) continue;
    const ch = sanitizeChannel(pre.channel) || 1;
    if (!loads[id]) loads[id] = Object.create(null);
    loads[id][ch] = (loads[id][ch] || 0) + 1;
  }
  return loads;
}

/**
 * 選頻道：指定頻未滿則用；否則找最空；全滿則仍塞進最空（允許略超，並回 full 警告）
 */
function pickChannel(mapId, prefer, loads) {
  const id = sanitizeMapId(mapId);
  if (!id) return { channel: 1, full: true, error: "bad_map" };
  // 個人圖：固定 1
  if (id === "training" || id === "arena_pvp" || id === "rift_battle") {
    return { channel: 1, full: false };
  }
  const byCh = (loads && loads[id]) || {};
  const pref = sanitizeChannel(prefer);
  if (pref && (byCh[pref] || 0) < CAP_PER_CHANNEL) {
    return { channel: pref, full: false };
  }
  let best = 1;
  let bestN = byCh[1] || 0;
  for (let c = 1; c <= MAX_CHANNELS; c++) {
    const n = byCh[c] || 0;
    if (n < CAP_PER_CHANNEL && (n < bestN || (byCh[best] || 0) >= CAP_PER_CHANNEL)) {
      best = c;
      bestN = n;
    } else if (n < bestN) {
      best = c;
      bestN = n;
    }
  }
  // 找真正最空且未滿
  let open = 0;
  let openN = Infinity;
  for (let c = 1; c <= MAX_CHANNELS; c++) {
    const n = byCh[c] || 0;
    if (n < CAP_PER_CHANNEL && n < openN) {
      open = c;
      openN = n;
    }
  }
  if (open) return { channel: open, full: false };
  return { channel: best, full: true };
}

function mapPopulationByMap(loads) {
  const counts = Object.create(null);
  for (const id of Object.keys(loads || {})) {
    let sum = 0;
    const row = loads[id] || {};
    for (const c of Object.keys(row)) sum += row[c] || 0;
    if (sum > 0) counts[id] = sum;
  }
  return counts;
}

module.exports = {
  MAX_CHANNELS,
  CAP_PER_CHANNEL,
  ENTER_COOLDOWN_MS,
  sanitizeMapId,
  sanitizeChannel,
  roomKey,
  parseRoomKey,
  channelLoads,
  pickChannel,
  mapPopulationByMap,
};

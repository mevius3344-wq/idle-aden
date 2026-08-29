"use strict";

const { getSql, ensureSchema } = require("./db");
const { jsonRes, corsPreflight } = require("./game-utils");
const {
  CLAN_MAX,
  CLAN_TTL_MS,
  partySanitizeName,
  partyMemberKey,
  clanSanitizeName,
  newId,
  parseJsonBody,
} = require("./rt-common");

function clanPublicMember(m) {
  if (!m) return null;
  return {
    key: m.key,
    account: m.account,
    slot: m.slot,
    name: m.name,
    lv: m.lv || 1,
    cls: m.cls || "",
    classic: !!m.classic,
    leader: !!m.leader,
    online: !!m.online,
    lastSeen: m.lastSeen || 0,
  };
}

function clanPublic(clan, opts) {
  if (!clan) return null;
  const brief = !!(opts && opts.brief);
  const onlineCount = (clan.members || []).filter((m) => m && m.online).length;
  const leader = (clan.members || []).find((m) => m && m.key === clan.leaderKey);
  const out = {
    id: clan.id,
    name: clan.name,
    leaderKey: clan.leaderKey,
    faction: clan.faction || "tros",
    memberCount: (clan.members || []).length,
    onlineCount,
    createdAt: clan.createdAt || 0,
    leaderName: leader ? leader.name : "",
  };
  if (!brief) out.members = (clan.members || []).map(clanPublicMember).filter(Boolean);
  return out;
}

function clanRowToObj(row) {
  if (!row) return null;
  const p = row.payload || {};
  return {
    id: row.id,
    name: p.name || "",
    leaderKey: p.leaderKey || "",
    members: Array.isArray(p.members) ? p.members : [],
    faction: p.faction || "tros",
    createdAt: p.createdAt || 0,
  };
}

async function loadAllClans(sql) {
  const rows = await sql`SELECT id, payload FROM rt_clans`;
  return rows.map(clanRowToObj).filter(Boolean);
}

async function saveClan(sql, clan) {
  const nameLower = clanSanitizeName(clan.name).toLowerCase();
  const payload = {
    name: clan.name,
    leaderKey: clan.leaderKey,
    members: clan.members || [],
    faction: clan.faction || "tros",
    createdAt: clan.createdAt || Date.now(),
  };
  await sql`INSERT INTO rt_clans (id, name_lower, payload, updated_at)
    VALUES (${clan.id}, ${nameLower}, ${payload}, ${Date.now()})
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at, name_lower = EXCLUDED.name_lower`;
}

async function deleteClan(sql, id) {
  await sql`DELETE FROM rt_clans WHERE id = ${id}`;
}

async function loadClanPresenceMap(sql) {
  const rows = await sql`SELECT member_key, payload, last_seen FROM rt_clan_presence`;
  const map = new Map();
  for (const r of rows) map.set(r.member_key, { ...r.payload, key: r.member_key, lastSeen: Number(r.last_seen) || 0 });
  return map;
}

async function upsertClanPresence(sql, row) {
  await sql`INSERT INTO rt_clan_presence (member_key, payload, last_seen)
    VALUES (${row.key}, ${row}, ${row.lastSeen || Date.now()})
    ON CONFLICT (member_key) DO UPDATE SET payload = EXCLUDED.payload, last_seen = EXCLUDED.last_seen`;
}

function clanFindByMemberKey(clans, key) {
  if (!key) return null;
  for (const c of clans) {
    if (c && Array.isArray(c.members) && c.members.some((m) => m && m.key === key)) return c;
  }
  return null;
}

function clanFindByName(clans, name) {
  const n = clanSanitizeName(name).toLowerCase();
  if (!n) return null;
  for (const c of clans) {
    if (c && String(c.name || "").toLowerCase() === n) return c;
  }
  return null;
}

async function clanMarkOfflineStale(clans, presenceMap) {
  const now = Date.now();
  for (const c of clans) {
    (c.members || []).forEach((m) => {
      if (!m) return;
      const pre = presenceMap.get(m.key);
      if (pre && now - (pre.lastSeen || 0) <= CLAN_TTL_MS) {
        m.online = true;
        m.name = pre.name || m.name;
        m.lv = pre.lv || m.lv;
        m.cls = pre.cls || m.cls;
        m.lastSeen = pre.lastSeen;
      } else if (now - (m.lastSeen || 0) > CLAN_TTL_MS) m.online = false;
    });
  }
}

async function clanUpsertPresence(sql, clans, presenceMap, body) {
  const account = String((body && body.account) || "").replace(/[<>&"']/g, "").trim().slice(0, 24);
  if (!account) return null;
  const slot = Math.max(0, Math.min(8, Number(body.slot) || 0));
  const name = partySanitizeName(body.name) || "未命名";
  const key = partyMemberKey(account, slot, name);
  if (!key) return null;
  const presence = {
    key,
    account,
    slot,
    name,
    lv: Math.max(1, Math.min(200, Number(body.lv) || 1)),
    cls: String(body.cls || "").slice(0, 16),
    classic: body.classic !== false,
    online: true,
    lastSeen: Date.now(),
  };
  presenceMap.set(key, presence);
  await upsertClanPresence(sql, presence);
  const clan = clanFindByMemberKey(clans, key);
  if (clan) {
    const mem = clan.members.find((m) => m.key === key);
    if (mem) {
      mem.name = presence.name;
      mem.lv = presence.lv;
      mem.cls = presence.cls;
      mem.classic = presence.classic;
      mem.online = true;
      mem.lastSeen = presence.lastSeen;
    }
  }
  return { key, presence, clan };
}

async function handleClanApi(req, res, u) {
  if (req.method === "OPTIONS") return corsPreflight(res, "GET,POST,OPTIONS");
  const sql = getSql();
  await ensureSchema();

  if (u === "/api/clan/status" && req.method === "GET") {
    const clans = await loadAllClans(sql);
    const presenceMap = await loadClanPresenceMap(sql);
    await clanMarkOfflineStale(clans, presenceMap);
    return jsonRes(res, 200, { ok: true, online: true, clans: clans.length, max: CLAN_MAX });
  }

  if (u === "/api/clan/search" && req.method === "GET") {
    const clans = await loadAllClans(sql);
    const presenceMap = await loadClanPresenceMap(sql);
    await clanMarkOfflineStale(clans, presenceMap);
    const url = new URL(req.url || "/", "http://localhost");
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 20);
    const list = [];
    for (const c of clans) {
      if (!c || !c.name) continue;
      if (q && String(c.name).toLowerCase().indexOf(q) < 0) continue;
      list.push(clanPublic(c, { brief: true }));
      if (list.length >= 40) break;
    }
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-Hant"));
    return jsonRes(res, 200, { ok: true, clans: list });
  }

  if (u === "/api/clan/mine" && req.method === "GET") {
    const clans = await loadAllClans(sql);
    const presenceMap = await loadClanPresenceMap(sql);
    await clanMarkOfflineStale(clans, presenceMap);
    const url = new URL(req.url || "/", "http://localhost");
    const account = String(url.searchParams.get("account") || "").replace(/[<>&"']/g, "").trim().slice(0, 24);
    const slot = Math.max(0, Math.min(8, Number(url.searchParams.get("slot")) || 0));
    const name = partySanitizeName(url.searchParams.get("name"));
    const key = partyMemberKey(account, slot, name);
    if (!key) return jsonRes(res, 400, { ok: false, error: "need account" });
    const clan = clanFindByMemberKey(clans, key);
    return jsonRes(res, 200, { ok: true, clan: clanPublic(clan), key });
  }

  if (u === "/api/clan/heartbeat" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const clans = await loadAllClans(sql);
    const presenceMap = await loadClanPresenceMap(sql);
    const up = await clanUpsertPresence(sql, clans, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account" });
    return jsonRes(res, 200, { ok: true, key: up.key, clan: clanPublic(up.clan) });
  }

  if (u === "/api/clan/create" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const clans = await loadAllClans(sql);
    const presenceMap = await loadClanPresenceMap(sql);
    const up = await clanUpsertPresence(sql, clans, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account", message: "請先登入帳號再創立血盟。" });
    if (String(data.cls || up.presence.cls || "") !== "royal") {
      return jsonRes(res, 403, { ok: false, error: "not royal", message: "只有王族可以創立血盟。" });
    }
    const existing = clanFindByMemberKey(clans, up.key);
    if (existing) return jsonRes(res, 200, { ok: true, clan: clanPublic(existing), already: true });
    const name = clanSanitizeName(data.clanName || data.nameClan);
    if (!name || name.length < 1) return jsonRes(res, 400, { ok: false, error: "bad name", message: "血盟名稱需為 1 至 20 個字。" });
    if (clanFindByName(clans, name)) return jsonRes(res, 409, { ok: false, error: "name taken", message: "此血盟名稱已被使用。" });
    const id = newId("C");
    const faction = data.faction === "esti" || data.avatar === "公主" ? "esti" : "tros";
    const member = { ...up.presence, leader: true, online: true };
    const clan = { id, name, leaderKey: up.key, members: [member], faction, createdAt: Date.now() };
    await saveClan(sql, clan);
    return jsonRes(res, 200, { ok: true, clan: clanPublic(clan) });
  }

  if (u === "/api/clan/join" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const clans = await loadAllClans(sql);
    const presenceMap = await loadClanPresenceMap(sql);
    const up = await clanUpsertPresence(sql, clans, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account", message: "請先登入帳號再加入血盟。" });
    if (clanFindByMemberKey(clans, up.key)) {
      return jsonRes(res, 400, { ok: false, error: "already in clan", message: "你已在血盟中，請先退出再加入。" });
    }
    let clan = null;
    const clanId = String(data.clanId || "").slice(0, 48);
    if (clanId) clan = clans.find((c) => c.id === clanId) || null;
    if (!clan && data.clanName) clan = clanFindByName(clans, data.clanName);
    if (!clan) return jsonRes(res, 404, { ok: false, error: "not found", message: "找不到此血盟。" });
    if (clan.members.length >= CLAN_MAX) return jsonRes(res, 400, { ok: false, error: "full", message: "血盟已滿（最多 " + CLAN_MAX + " 人）。" });
    clan.members.push({ ...up.presence, leader: false, online: true });
    await saveClan(sql, clan);
    return jsonRes(res, 200, { ok: true, clan: clanPublic(clan) });
  }

  if (u === "/api/clan/leave" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const clans = await loadAllClans(sql);
    const presenceMap = await loadClanPresenceMap(sql);
    const up = await clanUpsertPresence(sql, clans, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account" });
    const clan = clanFindByMemberKey(clans, up.key);
    if (!clan) return jsonRes(res, 200, { ok: true, left: true, empty: true });
    const wasLeader = clan.leaderKey === up.key;
    clan.members = clan.members.filter((m) => m && m.key !== up.key);
    if (!clan.members.length) {
      await deleteClan(sql, clan.id);
      return jsonRes(res, 200, { ok: true, left: true, dissolved: true });
    }
    if (wasLeader) {
      clan.members[0].leader = true;
      clan.leaderKey = clan.members[0].key;
      clan.members.forEach((m) => { m.leader = m.key === clan.leaderKey; });
    }
    await saveClan(sql, clan);
    return jsonRes(res, 200, { ok: true, left: true, clan: clanPublic(clan) });
  }

  if (u === "/api/clan/kick" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const clans = await loadAllClans(sql);
    const presenceMap = await loadClanPresenceMap(sql);
    const up = await clanUpsertPresence(sql, clans, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account" });
    const clan = clanFindByMemberKey(clans, up.key);
    if (!clan) return jsonRes(res, 400, { ok: false, error: "no clan", message: "你尚未加入血盟。" });
    if (clan.leaderKey !== up.key) return jsonRes(res, 403, { ok: false, error: "not leader", message: "只有盟主可以踢出成員。" });
    const targetKey = String(data.targetKey || "").slice(0, 96);
    const targetName = partySanitizeName(data.targetName);
    let target = null;
    if (targetKey) target = clan.members.find((m) => m && m.key === targetKey);
    if (!target && targetName) target = clan.members.find((m) => m && m.name === targetName);
    if (!target) return jsonRes(res, 404, { ok: false, error: "not found", message: "找不到該成員。" });
    if (target.key === up.key) return jsonRes(res, 400, { ok: false, error: "self", message: "不能踢出自己，請改用退出血盟。" });
    clan.members = clan.members.filter((m) => m && m.key !== target.key);
    await saveClan(sql, clan);
    return jsonRes(res, 200, { ok: true, clan: clanPublic(clan) });
  }

  return jsonRes(res, 404, { ok: false, error: "unknown clan api" });
}

module.exports = { handleClanApi };

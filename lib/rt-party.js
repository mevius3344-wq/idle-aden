"use strict";

const { getSql, ensureSchema } = require("./db");
const { jsonRes, corsPreflight } = require("./game-utils");
const {
  PARTY_MAX,
  PARTY_TTL_MS,
  PARTY_MEMBER_TTL_MS,
  PARTY_INVITE_MS,
  PARTY_APPLY_MS,
  PARTY_SHARE_RATE_MS,
  PARTY_WAIT_MAX_MS,
  PARTY_EVENT_MAX,
  partySanitizeName,
  partyMemberKey,
  newId,
  parseJsonBody,
  pollWait,
  nextCounter,
  getCounter,
} = require("./rt-common");

function partyPublicMember(m) {
  if (!m) return null;
  return {
    key: m.key,
    account: m.account,
    slot: m.slot,
    name: m.name,
    lv: m.lv || 1,
    cls: m.cls || "",
    mapId: m.mapId || "",
    mapName: m.mapName || "",
    hp: m.hp || 0,
    mhp: m.mhp || 0,
    classic: !!m.classic,
    leader: !!m.leader,
    online: !!m.online,
    lastSeen: m.lastSeen || 0,
  };
}

function partyPublic(party) {
  if (!party) return null;
  return {
    id: party.id,
    leaderKey: party.leaderKey,
    members: (party.members || []).map(partyPublicMember).filter(Boolean),
    createdAt: party.createdAt || 0,
  };
}

function partyRowToObj(row) {
  if (!row) return null;
  const p = row.payload || {};
  return {
    id: row.id,
    leaderKey: p.leaderKey || "",
    members: Array.isArray(p.members) ? p.members : [],
    applications: Array.isArray(p.applications) ? p.applications : [],
    shareAtByKey: p.shareAtByKey || {},
    createdAt: p.createdAt || 0,
    lastShareAt: p.lastShareAt || 0,
  };
}

async function loadAllParties(sql) {
  const rows = await sql`SELECT id, payload FROM rt_parties`;
  return rows.map(partyRowToObj).filter(Boolean);
}

async function saveParty(sql, party) {
  if (!party || !party.id) return;
  const payload = {
    leaderKey: party.leaderKey,
    members: party.members || [],
    applications: party.applications || [],
    shareAtByKey: party.shareAtByKey || {},
    createdAt: party.createdAt || Date.now(),
    lastShareAt: party.lastShareAt || 0,
  };
  await sql`INSERT INTO rt_parties (id, payload, updated_at) VALUES (${party.id}, ${payload}, ${Date.now()})
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`;
}

async function deleteParty(sql, id) {
  await sql`DELETE FROM rt_parties WHERE id = ${id}`;
}

async function loadPresenceMap(sql) {
  const rows = await sql`SELECT member_key, payload, last_seen FROM rt_party_presence`;
  const map = new Map();
  for (const r of rows) map.set(r.member_key, { ...r.payload, key: r.member_key, lastSeen: Number(r.last_seen) || 0 });
  return map;
}

async function upsertPresence(sql, row) {
  await sql`INSERT INTO rt_party_presence (member_key, payload, last_seen)
    VALUES (${row.key}, ${row}, ${row.lastSeen || Date.now()})
    ON CONFLICT (member_key) DO UPDATE SET payload = EXCLUDED.payload, last_seen = EXCLUDED.last_seen`;
}

async function prunePresence(sql, now) {
  const cutoff = now - PARTY_TTL_MS;
  await sql`DELETE FROM rt_party_presence WHERE last_seen < ${cutoff}`;
}

async function loadInvitesFor(sql, toKey) {
  const rows = await sql`SELECT id, payload, at FROM rt_party_invites WHERE to_key = ${toKey} ORDER BY at DESC`;
  return rows.map((r) => ({ id: r.id, ...r.payload, at: Number(r.at) || 0 }));
}

async function saveInvite(sql, inv) {
  await sql`INSERT INTO rt_party_invites (id, to_key, payload, at)
    VALUES (${inv.id}, ${inv.toKey}, ${inv}, ${inv.at || Date.now()})
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, at = EXCLUDED.at`;
}

async function deleteInvite(sql, id) {
  await sql`DELETE FROM rt_party_invites WHERE id = ${id}`;
}

async function clearInvitesForParty(sql, toKey, partyId) {
  const rows = await loadInvitesFor(sql, toKey);
  for (const inv of rows) {
    if (inv.partyId === partyId) await deleteInvite(sql, inv.id);
  }
}

async function partyPushEvent(sql, ev) {
  const seq = await nextCounter(sql, "party_event_seq");
  const at = Date.now();
  const payload = { ...ev, seq, at };
  await sql`INSERT INTO rt_party_events (seq, party_id, to_key, payload, at)
    VALUES (${seq}, ${ev.partyId || null}, ${ev.toKey || null}, ${payload}, ${at})`;
  const countRows = await sql`SELECT COUNT(*)::int AS c FROM rt_party_events`;
  const extra = (countRows[0]?.c || 0) - PARTY_EVENT_MAX;
  if (extra > 0) {
    await sql`DELETE FROM rt_party_events WHERE seq IN (
      SELECT seq FROM rt_party_events ORDER BY seq ASC LIMIT ${extra}
    )`;
  }
  return payload;
}

async function partyEventsFor(sql, key, since, partyId) {
  const s = Math.max(0, Number(since) || 0);
  let rows;
  if (partyId) {
    rows = await sql`
      SELECT payload FROM rt_party_events
      WHERE seq > ${s} AND (to_key = ${key} OR party_id = ${partyId})
      ORDER BY seq ASC LIMIT 80`;
  } else {
    rows = await sql`
      SELECT payload FROM rt_party_events
      WHERE seq > ${s} AND to_key = ${key}
      ORDER BY seq ASC LIMIT 80`;
  }
  return rows.map((r) => r.payload);
}

function partyFindByMemberKey(parties, key) {
  if (!key) return null;
  for (const p of parties) {
    if (p && Array.isArray(p.members) && p.members.some((m) => m && m.key === key)) return p;
  }
  return null;
}

function partyMemberOnline(m, pre, t) {
  return !!(pre && t - (pre.lastSeen || 0) < PARTY_TTL_MS);
}

function partyMemberActive(m, pre, t) {
  if (!m) return false;
  const last = pre && pre.lastSeen ? pre.lastSeen : m.lastSeen || 0;
  const fallback = Math.max(Number(m.joinedAt) || 0, Number(m.lastSeen) || 0);
  const use = last > 0 ? last : fallback > 0 ? fallback : t;
  return t - use < PARTY_MEMBER_TTL_MS;
}

function partyPublicSummary(party, viewerKey, presenceMap) {
  if (!party) return null;
  const leader = (party.members || []).find((m) => m && m.key === party.leaderKey);
  const onlineCount = (party.members || []).filter((m) => m && partyMemberOnline(m, presenceMap.get(m.key), Date.now())).length;
  const apps = party.applications || [];
  return {
    id: party.id,
    leaderName: leader ? leader.name : "—",
    leaderLv: leader ? leader.lv || 1 : 1,
    leaderCls: leader ? leader.cls || "" : "",
    mapName: leader ? leader.mapName || leader.mapId || "—" : "—",
    memberCount: (party.members || []).length,
    max: PARTY_MAX,
    onlineCount,
    applied: viewerKey ? apps.some((a) => a && a.key === viewerKey) : false,
    open: (party.members || []).length < PARTY_MAX && onlineCount > 0,
  };
}

async function partyUpsertPresence(sql, parties, presenceMap, body) {
  const account = String(body.account || "")
    .replace(/[<>&"']/g, "")
    .trim()
    .slice(0, 24);
  const name = partySanitizeName(body.name);
  const slot = Math.max(0, Math.min(8, Number(body.slot) || 0));
  const key = partyMemberKey(account, slot, name);
  if (!key) return null;
  const now = Date.now();
  const prev = presenceMap.get(key);
  const partyEarly = partyFindByMemberKey(parties, key);
  const mem = partyEarly && (partyEarly.members || []).find((x) => x && x.key === key);
  const base = prev || mem || {};
  const pickStr = (v, fallback) => (v != null && String(v) !== "" ? v : fallback);
  const pickNum = (v, fallback) => (v != null && Number.isFinite(Number(v)) ? Number(v) : fallback);
  const row = {
    key,
    account,
    slot,
    name: name || base.name || "未命名",
    sessionId: String(pickStr(body.sessionId, base.sessionId) || "").slice(0, 96),
    lv: Math.max(1, Math.min(100, pickNum(body.lv, base.lv) || 1)),
    cls: String(pickStr(body.cls, base.cls) || "").slice(0, 24),
    mapId: String(pickStr(body.mapId, base.mapId) || "").slice(0, 64),
    mapName: String(pickStr(body.mapName, base.mapName) || "")
      .replace(/[<>&"']/g, "")
      .trim()
      .slice(0, 40),
    hp: Math.max(0, pickNum(body.hp, base.hp) || 0),
    mhp: Math.max(0, pickNum(body.mhp, base.mhp) || 0),
    classic: body.classic !== false && base.classic !== false,
    lastSeen: now,
  };
  presenceMap.set(key, row);
  await upsertPresence(sql, row);
  const party = partyEarly || partyFindByMemberKey(parties, key);
  if (party) {
    const m = party.members.find((x) => x && x.key === key);
    if (m) {
      Object.assign(m, {
        name: row.name,
        mapId: row.mapId,
        mapName: row.mapName,
        lv: row.lv,
        hp: row.hp,
        mhp: row.mhp,
        cls: row.cls,
        classic: row.classic,
        sessionId: row.sessionId,
        online: true,
        lastSeen: now,
      });
      await saveParty(sql, party);
    }
  }
  return { key, presence: row, party };
}

async function partyCleanupStale(sql, parties, presenceMap) {
  const t = Date.now();
  await prunePresence(sql, t);
  for (const [key, pre] of [...presenceMap.entries()]) {
    if (!pre || t - (pre.lastSeen || 0) > PARTY_TTL_MS) presenceMap.delete(key);
  }
  let dirty = false;
  for (const party of [...parties]) {
    if (!party || !Array.isArray(party.members)) {
      await deleteParty(sql, party.id);
      dirty = true;
      continue;
    }
    party.members.forEach((m) => {
      if (!m) return;
      const pre = presenceMap.get(m.key);
      m.online = partyMemberOnline(m, pre, t);
      if (pre) {
        m.mapId = pre.mapId || m.mapId;
        m.mapName = pre.mapName || m.mapName;
        m.lv = pre.lv || m.lv;
        m.hp = pre.hp;
        m.mhp = pre.mhp;
        m.cls = pre.cls || m.cls;
        m.name = pre.name || m.name;
        m.lastSeen = pre.lastSeen || m.lastSeen || t;
      } else if (!m.lastSeen) m.lastSeen = m.joinedAt || t;
    });
    const before = party.members.slice();
    const activeMembers = party.members.filter((m) => partyMemberActive(m, presenceMap.get(m.key), t));
    const dropped = before.filter((m) => m && !activeMembers.some((a) => a && a.key === m.key));
    for (const m of dropped) {
      await partyPushEvent(sql, { type: "leave", partyId: party.id, name: m.name, key: m.key, reason: "expire", toKey: m.key });
      dirty = true;
    }
    if (!activeMembers.length) {
      const keys = before.map((m) => m && m.key).filter(Boolean);
      await deleteParty(sql, party.id);
      for (const k of keys) await partyPushEvent(sql, { type: "disband", partyId: party.id, toKey: k, reason: "expire" });
      dirty = true;
      continue;
    }
    party.members = activeMembers;
    const leaderStill = party.members.some((m) => m && m.key === party.leaderKey);
    if (!leaderStill) {
      const online = party.members.filter((m) => m && m.online);
      const pick = online[0] || party.members[0];
      if (pick) {
        party.leaderKey = pick.key;
        party.members.forEach((m) => {
          if (m) m.leader = m.key === party.leaderKey;
        });
        await partyPushEvent(sql, { type: "leader", partyId: party.id, leaderKey: party.leaderKey, name: pick.name });
        dirty = true;
      }
    }
    if (Array.isArray(party.applications)) {
      party.applications = party.applications.filter(
        (a) => a && t - (a.at || 0) < PARTY_APPLY_MS && !party.members.some((m) => m && m.key === a.key)
      );
    }
    if (dirty || dropped.length) await saveParty(sql, party);
  }
  return parties.filter((p) => p && p.members && p.members.length);
}

async function partySnapshotFor(sql, key, parties, presenceMap) {
  const party = partyFindByMemberKey(parties, key);
  const invites = (await loadInvitesFor(sql, key))
    .filter((inv) => Date.now() - (inv.at || 0) < PARTY_INVITE_MS)
    .map((inv) => ({ id: inv.id, partyId: inv.partyId, fromName: inv.fromName, fromKey: inv.fromKey, at: inv.at }));
  const applications =
    party && party.leaderKey === key
      ? (party.applications || [])
          .filter((a) => a && Date.now() - (a.at || 0) < PARTY_APPLY_MS)
          .map((a) => ({ id: a.id, key: a.key, name: a.name, lv: a.lv || 1, cls: a.cls || "", at: a.at }))
      : [];
  const seq = await getCounter(sql, "party_event_seq");
  return { ok: true, key, seq, party: partyPublic(party), invites, applications, events: [] };
}

async function handlePartyApi(req, res, u) {
  if (req.method === "OPTIONS") return corsPreflight(res, "GET,POST,OPTIONS");
  const sql = getSql();
  await ensureSchema();

  if (u === "/api/party/status" && req.method === "GET") {
    const parties = await loadAllParties(sql);
    const presenceMap = await loadPresenceMap(sql);
    await partyCleanupStale(sql, parties, presenceMap);
    const seq = await getCounter(sql, "party_event_seq");
    return jsonRes(res, 200, { ok: true, online: true, parties: parties.length, presence: presenceMap.size, seq, max: PARTY_MAX });
  }

  if (u === "/api/party/online" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 24);
    const selfAccount = String(url.searchParams.get("account") || "").replace(/[<>&"']/g, "").trim().slice(0, 24);
    const selfSlot = Math.max(0, Math.min(8, Number(url.searchParams.get("slot")) || 0));
    const selfName = partySanitizeName(url.searchParams.get("name"));
    const selfKey = partyMemberKey(selfAccount, selfSlot, selfName);
    const parties = await loadAllParties(sql);
    const presenceMap = await loadPresenceMap(sql);
    await partyCleanupStale(sql, parties, presenceMap);
    const list = [];
    for (const pre of presenceMap.values()) {
      if (!pre || !pre.name) continue;
      if (selfKey && pre.key === selfKey) continue;
      if (q && String(pre.name).toLowerCase().indexOf(q) < 0) continue;
      list.push({
        name: pre.name,
        lv: pre.lv || 1,
        cls: pre.cls || "",
        mapName: pre.mapName || pre.mapId || "",
        classic: !!pre.classic,
        inParty: !!partyFindByMemberKey(parties, pre.key),
      });
      if (list.length >= 40) break;
    }
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-Hant"));
    return jsonRes(res, 200, { ok: true, players: list });
  }

  if (u === "/api/party/list" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const selfAccount = String(url.searchParams.get("account") || "").replace(/[<>&"']/g, "").trim().slice(0, 24);
    const selfSlot = Math.max(0, Math.min(8, Number(url.searchParams.get("slot")) || 0));
    const selfName = partySanitizeName(url.searchParams.get("name"));
    const selfKey = partyMemberKey(selfAccount, selfSlot, selfName);
    const parties = await loadAllParties(sql);
    const presenceMap = await loadPresenceMap(sql);
    await partyCleanupStale(sql, parties, presenceMap);
    const list = [];
    for (const party of parties) {
      if (!party || !Array.isArray(party.members)) continue;
      if (party.members.length >= PARTY_MAX) continue;
      if (selfKey && party.members.some((m) => m && m.key === selfKey)) continue;
      const summary = partyPublicSummary(party, selfKey, presenceMap);
      if (!summary || !summary.open) continue;
      list.push(summary);
      if (list.length >= 30) break;
    }
    list.sort(
      (a, b) =>
        (b.onlineCount || 0) - (a.onlineCount || 0) ||
        (a.memberCount || 0) - (b.memberCount || 0) ||
        String(a.leaderName).localeCompare(String(b.leaderName), "zh-Hant")
    );
    return jsonRes(res, 200, { ok: true, parties: list });
  }

  if (u === "/api/party/heartbeat" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const parties = await loadAllParties(sql);
    const presenceMap = await loadPresenceMap(sql);
    const up = await partyUpsertPresence(sql, parties, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account" });
    const seq = await getCounter(sql, "party_event_seq");
    return jsonRes(res, 200, { ok: true, key: up.key, party: partyPublic(up.party), seq });
  }

  if (u === "/api/party/create" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const parties = await loadAllParties(sql);
    const presenceMap = await loadPresenceMap(sql);
    const up = await partyUpsertPresence(sql, parties, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account", message: "請先登入帳號再組隊。" });
    const existing = partyFindByMemberKey(parties, up.key);
    if (existing) return jsonRes(res, 200, { ok: true, party: partyPublic(existing), already: true });
    const id = newId("P");
    const member = { ...up.presence, leader: true, online: true, lastSeen: Date.now(), joinedAt: Date.now() };
    const party = { id, leaderKey: up.key, members: [member], createdAt: Date.now(), lastShareAt: 0, shareAtByKey: {}, applications: [] };
    parties.push(party);
    await saveParty(sql, party);
    await partyPushEvent(sql, { type: "create", partyId: id, toKey: up.key });
    return jsonRes(res, 200, { ok: true, party: partyPublic(party) });
  }

  if (u === "/api/party/invite" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const parties = await loadAllParties(sql);
    const presenceMap = await loadPresenceMap(sql);
    const up = await partyUpsertPresence(sql, parties, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account", message: "請先登入帳號。" });
    const party = partyFindByMemberKey(parties, up.key);
    if (!party) return jsonRes(res, 400, { ok: false, error: "no party", message: "請先建立隊伍再邀請。" });
    if (party.leaderKey !== up.key) return jsonRes(res, 403, { ok: false, error: "not leader", message: "只有隊長可以邀請。" });
    if (party.members.length >= PARTY_MAX) return jsonRes(res, 400, { ok: false, error: "full", message: "隊伍已滿（最多 " + PARTY_MAX + " 人）。" });
    const targetName = partySanitizeName(data.targetName);
    if (!targetName) return jsonRes(res, 400, { ok: false, error: "empty", message: "請輸入對方角色名稱。" });
    await partyCleanupStale(sql, parties, presenceMap);
    const wantClassic = data.classic !== false;
    let target = null;
    let fallback = null;
    for (const pre of presenceMap.values()) {
      if (!pre || pre.name !== targetName) continue;
      if (pre.classic === wantClassic) { target = pre; break; }
      if (!fallback) fallback = pre;
    }
    if (!target) target = fallback;
    if (!target) return jsonRes(res, 404, { ok: false, error: "offline", message: "找不到線上的「" + targetName + "」。對方需登入並進入遊戲。" });
    if (target.key === up.key) return jsonRes(res, 400, { ok: false, error: "self", message: "無法邀請自己。" });
    if (party.members.some((m) => m && m.key === target.key)) return jsonRes(res, 400, { ok: false, error: "already", message: "對方已在隊伍中。" });
    if (partyFindByMemberKey(parties, target.key)) return jsonRes(res, 400, { ok: false, error: "busy", message: "對方已在其他隊伍中。" });
    const inviteId = newId("I");
    const inv = { id: inviteId, partyId: party.id, fromKey: up.key, fromName: up.presence.name, toKey: target.key, at: Date.now() };
    await clearInvitesForParty(sql, target.key, party.id);
    await saveInvite(sql, inv);
    await partyPushEvent(sql, { type: "invite", toKey: target.key, inviteId, partyId: party.id, fromName: up.presence.name });
    return jsonRes(res, 200, { ok: true, inviteId, targetName: target.name });
  }

  if (u === "/api/party/respond" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const parties = await loadAllParties(sql);
    const presenceMap = await loadPresenceMap(sql);
    const up = await partyUpsertPresence(sql, parties, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account" });
    const inviteId = String(data.inviteId || "").slice(0, 48);
    const accept = !!data.accept;
    const list = await loadInvitesFor(sql, up.key);
    const inv = list.find((x) => x && x.id === inviteId);
    if (inv) await deleteInvite(sql, inv.id);
    if (!inv) return jsonRes(res, 404, { ok: false, error: "gone", message: "邀請已失效。" });
    if (Date.now() - (inv.at || 0) > PARTY_INVITE_MS) return jsonRes(res, 410, { ok: false, error: "expired", message: "邀請已過期。" });
    if (!accept) {
      await partyPushEvent(sql, { type: "decline", partyId: inv.partyId, name: up.presence.name, toKey: inv.fromKey });
      return jsonRes(res, 200, { ok: true, accepted: false });
    }
    if (partyFindByMemberKey(parties, up.key)) return jsonRes(res, 400, { ok: false, error: "busy", message: "你已在隊伍中，請先離隊。" });
    const party = parties.find((p) => p.id === inv.partyId);
    if (!party) return jsonRes(res, 404, { ok: false, error: "no party", message: "隊伍已解散。" });
    if (party.members.length >= PARTY_MAX) return jsonRes(res, 400, { ok: false, error: "full", message: "隊伍已滿。" });
    party.members.push({ ...up.presence, leader: false, online: true, lastSeen: Date.now(), joinedAt: Date.now() });
    await saveParty(sql, party);
    await partyPushEvent(sql, { type: "join", partyId: party.id, name: up.presence.name, key: up.key });
    return jsonRes(res, 200, { ok: true, accepted: true, party: partyPublic(party) });
  }

  if (u === "/api/party/apply" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const parties = await loadAllParties(sql);
    const presenceMap = await loadPresenceMap(sql);
    const up = await partyUpsertPresence(sql, parties, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account", message: "請先登入帳號。" });
    if (partyFindByMemberKey(parties, up.key)) return jsonRes(res, 400, { ok: false, error: "busy", message: "你已在隊伍中，請先離隊。" });
    const partyId = String(data.partyId || "").slice(0, 48);
    const party = parties.find((p) => p.id === partyId);
    if (!party) return jsonRes(res, 404, { ok: false, error: "gone", message: "隊伍已解散。" });
    if (party.members.length >= PARTY_MAX) return jsonRes(res, 400, { ok: false, error: "full", message: "隊伍已滿。" });
    if (!party.applications) party.applications = [];
    if (party.applications.some((a) => a && a.key === up.key)) {
      return jsonRes(res, 200, { ok: true, pending: true, message: "已送出申請，等待隊長審核。" });
    }
    const applyId = newId("A");
    party.applications.push({ id: applyId, key: up.key, name: up.presence.name, lv: up.presence.lv, cls: up.presence.cls, at: Date.now() });
    await saveParty(sql, party);
    await partyPushEvent(sql, { type: "apply", partyId: party.id, toKey: party.leaderKey, applyId, fromKey: up.key, name: up.presence.name });
    return jsonRes(res, 200, { ok: true, pending: true, applyId, message: "已申請加入，等待隊長審核。" });
  }

  if (u === "/api/party/review" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const parties = await loadAllParties(sql);
    const presenceMap = await loadPresenceMap(sql);
    const up = await partyUpsertPresence(sql, parties, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account" });
    const party = partyFindByMemberKey(parties, up.key);
    if (!party) return jsonRes(res, 400, { ok: false, error: "no party", message: "你不在隊伍中。" });
    if (party.leaderKey !== up.key) return jsonRes(res, 403, { ok: false, error: "not leader", message: "只有隊長可以審核申請。" });
    const applyId = String(data.applyId || "").slice(0, 48);
    const accept = !!data.accept;
    const apps = party.applications || [];
    const app = apps.find((a) => a && a.id === applyId);
    party.applications = apps.filter((a) => a && a.id !== applyId);
    if (!app) return jsonRes(res, 404, { ok: false, error: "gone", message: "申請已失效。" });
    if (!accept) {
      await saveParty(sql, party);
      await partyPushEvent(sql, { type: "apply_reject", partyId: party.id, toKey: app.key, leaderName: up.presence.name });
      return jsonRes(res, 200, { ok: true, accepted: false });
    }
    if (party.members.length >= PARTY_MAX) return jsonRes(res, 400, { ok: false, error: "full", message: "隊伍已滿。" });
    if (partyFindByMemberKey(parties, app.key)) return jsonRes(res, 400, { ok: false, error: "busy", message: "對方已在其他隊伍中。" });
    await partyCleanupStale(sql, parties, presenceMap);
    const pre = presenceMap.get(app.key);
    if (!pre || Date.now() - (pre.lastSeen || 0) > PARTY_TTL_MS) return jsonRes(res, 404, { ok: false, error: "offline", message: "對方已離線。" });
    party.members.push({ ...pre, leader: false, online: true, lastSeen: Date.now(), joinedAt: Date.now() });
    await saveParty(sql, party);
    await partyPushEvent(sql, { type: "join", partyId: party.id, name: pre.name, key: app.key });
    await partyPushEvent(sql, { type: "apply_accept", partyId: party.id, toKey: app.key });
    return jsonRes(res, 200, { ok: true, accepted: true, party: partyPublic(party) });
  }

  if (u === "/api/party/leave" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const parties = await loadAllParties(sql);
    const presenceMap = await loadPresenceMap(sql);
    const up = await partyUpsertPresence(sql, parties, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account" });
    const party = partyFindByMemberKey(parties, up.key);
    if (!party) return jsonRes(res, 200, { ok: true, left: true });
    const wasLeader = party.leaderKey === up.key;
    party.members = party.members.filter((m) => m && m.key !== up.key);
    await partyPushEvent(sql, { type: "leave", partyId: party.id, name: up.presence.name, key: up.key });
    if (!party.members.length) {
      await deleteParty(sql, party.id);
      await partyPushEvent(sql, { type: "disband", partyId: party.id, toKey: up.key });
    } else if (wasLeader) {
      party.leaderKey = party.members[0].key;
      party.members.forEach((m) => { if (m) m.leader = m.key === party.leaderKey; });
      await saveParty(sql, party);
      await partyPushEvent(sql, { type: "leader", partyId: party.id, leaderKey: party.leaderKey, name: party.members[0].name });
    } else await saveParty(sql, party);
    return jsonRes(res, 200, { ok: true, left: true });
  }

  if (u === "/api/party/kick" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const parties = await loadAllParties(sql);
    const presenceMap = await loadPresenceMap(sql);
    const up = await partyUpsertPresence(sql, parties, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account" });
    const party = partyFindByMemberKey(parties, up.key);
    if (!party) return jsonRes(res, 400, { ok: false, error: "no party" });
    if (party.leaderKey !== up.key) return jsonRes(res, 403, { ok: false, error: "not leader", message: "只有隊長可以踢人。" });
    const targetKey = String(data.targetKey || "").slice(0, 80);
    if (!targetKey || targetKey === up.key) return jsonRes(res, 400, { ok: false, error: "bad target", message: "無法踢除。" });
    const kicked = party.members.find((m) => m && m.key === targetKey);
    party.members = party.members.filter((m) => m && m.key !== targetKey);
    if (kicked) await partyPushEvent(sql, { type: "kick", partyId: party.id, name: kicked.name, key: targetKey, toKey: targetKey });
    await saveParty(sql, party);
    return jsonRes(res, 200, { ok: true, party: partyPublic(party) });
  }

  if (u === "/api/party/disband" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const parties = await loadAllParties(sql);
    const presenceMap = await loadPresenceMap(sql);
    const up = await partyUpsertPresence(sql, parties, presenceMap, data);
    if (!up) return jsonRes(res, 400, { ok: false, error: "need account" });
    const party = partyFindByMemberKey(parties, up.key);
    if (!party) return jsonRes(res, 200, { ok: true, disbanded: true });
    if (party.leaderKey !== up.key) return jsonRes(res, 403, { ok: false, error: "not leader", message: "只有隊長可以解散隊伍。" });
    const pid = party.id;
    const keys = party.members.map((m) => m && m.key).filter(Boolean);
    await deleteParty(sql, pid);
    for (const k of keys) await partyPushEvent(sql, { type: "disband", partyId: pid, toKey: k });
    return jsonRes(res, 200, { ok: true, disbanded: true });
  }

  if (u === "/api/party/share" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const parties = await loadAllParties(sql);
    const presenceMap = await loadPresenceMap(sql);
    const up = await partyUpsertPresence(sql, parties, presenceMap, data);
    if (!up || !up.party) return jsonRes(res, 400, { ok: false, error: "no party" });
    const party = up.party;
    const now = Date.now();
    if (!party.shareAtByKey) party.shareAtByKey = {};
    if (now - (party.shareAtByKey[up.key] || 0) < PARTY_SHARE_RATE_MS) return jsonRes(res, 429, { ok: false, error: "rate" });
    party.shareAtByKey[up.key] = now;
    party.lastShareAt = now;
    const exp = Math.max(0, Math.min(500000, Math.floor(Number(data.exp) || 0)));
    const gold = Math.max(0, Math.min(200000, Math.floor(Number(data.gold) || 0)));
    const mapId = String(data.mapId || "").slice(0, 64);
    const mobName = String(data.mobName || "").replace(/[<>&"']/g, "").trim().slice(0, 40);
    if (!exp && !gold) return jsonRes(res, 200, { ok: true, skipped: true });
    await saveParty(sql, party);
    await partyPushEvent(sql, { type: "share", partyId: party.id, fromKey: up.key, fromName: up.presence.name, mapId, exp, gold, mobName });
    return jsonRes(res, 200, { ok: true });
  }

  if (u === "/api/party/poll" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const account = String(url.searchParams.get("account") || "").replace(/[<>&"']/g, "").trim().slice(0, 24);
    const slot = Math.max(0, Math.min(8, Number(url.searchParams.get("slot")) || 0));
    const name = partySanitizeName(url.searchParams.get("name"));
    const key = partyMemberKey(account, slot, name);
    if (!key) return jsonRes(res, 400, { ok: false, error: "need account" });
    const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
    let waitMs = Number(url.searchParams.get("wait"));
    if (!Number.isFinite(waitMs) || waitMs < 0) waitMs = 0;
    waitMs = Math.min(PARTY_WAIT_MAX_MS, waitMs);

    let parties = await loadAllParties(sql);
    let presenceMap = await loadPresenceMap(sql);
    await partyUpsertPresence(sql, parties, presenceMap, { account, slot, name });

    const build = async () => {
      parties = await loadAllParties(sql);
      presenceMap = await loadPresenceMap(sql);
      await partyCleanupStale(sql, parties, presenceMap);
      const snap = await partySnapshotFor(sql, key, parties, presenceMap);
      const party = partyFindByMemberKey(parties, key);
      snap.events = await partyEventsFor(sql, key, since, party ? party.id : "");
      if (snap.events.length) {
        const maxSeq = Math.max(...snap.events.map((e) => e.seq || 0));
        if (maxSeq > snap.seq) snap.seq = maxSeq;
      }
      return snap;
    };

    if (since === 0 || waitMs <= 0) return jsonRes(res, 200, await build());

    const result = await pollWait(
      async () => {
        const parties = await loadAllParties(sql);
        const party = partyFindByMemberKey(parties, key);
        const events = await partyEventsFor(sql, key, since, party ? party.id : "");
        return { ready: events.length > 0, events };
      },
      waitMs,
      400
    );
    const snap = await build();
    if (result.events && result.events.length) snap.events = result.events;
    return jsonRes(res, 200, snap);
  }

  return jsonRes(res, 404, { ok: false, error: "unknown party api" });
}

module.exports = { handlePartyApi };

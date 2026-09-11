"use strict";

/**
 * 野外 PK（同圖、攻擊者開啟 pvpOn）：伺服器權威扣血，無掉裝。
 * 未開 PK 者可被打，但不能還手。
 */
const path = require("path");
const { getSql, ensureSchema } = require("./db");
const { jsonRes, corsPreflight } = require("./game-utils");
const {
  PARTY_TTL_MS,
  partySanitizeName,
  partyMemberKey,
  parseJsonBody,
  nextCounter,
  PARTY_EVENT_MAX,
} = require("./rt-common");

const ROOT = path.join(__dirname, "..");
let _antiCheat = null;
try {
  _antiCheat = require("./rt-anti-cheat");
} catch (e) {}

const HIT_COOLDOWN_MS = 900;
const MAX_HIT_DMG = 8000;
/** @type {Map<string, number>} */
const _hitAt = new Map();

function mapPvpAllowed(mapId) {
  const id = String(mapId || "").slice(0, 64);
  if (!id || id.startsWith("town_")) return false;
  if (id === "training" || id === "arena_pvp" || id === "rift_battle") return false;
  if (id.indexOf("wb_") === 0 || id.indexOf("world_boss") === 0) return false;
  if (id.indexOf("king_") === 0 || id.indexOf("siege") >= 0) return false;
  return true;
}

async function loadPresence(sql, key) {
  const rows = await sql`SELECT payload, last_seen FROM rt_party_presence WHERE member_key = ${key} LIMIT 1`;
  if (!rows.length) return null;
  return { ...(rows[0].payload || {}), key, lastSeen: Number(rows[0].last_seen) || 0 };
}

async function savePresence(sql, row) {
  if (!row || !row.key) return;
  const now = Date.now();
  row.lastSeen = now;
  await sql`INSERT INTO rt_party_presence (member_key, payload, last_seen)
    VALUES (${row.key}, ${row}, ${now})
    ON CONFLICT (member_key) DO UPDATE SET payload = EXCLUDED.payload, last_seen = EXCLUDED.last_seen`;
}

async function pushToKey(sql, toKey, ev) {
  const seq = await nextCounter(sql, "party_event_seq");
  const at = Date.now();
  const payload = { ...ev, seq, at };
  await sql`INSERT INTO rt_party_events (seq, party_id, to_key, payload, at)
    VALUES (${seq}, ${null}, ${toKey}, ${payload}, ${at})`;
  const countRows = await sql`SELECT COUNT(*)::int AS c FROM rt_party_events`;
  const extra = (countRows[0]?.c || 0) - PARTY_EVENT_MAX;
  if (extra > 0) {
    await sql`DELETE FROM rt_party_events WHERE seq IN (
      SELECT seq FROM rt_party_events ORDER BY seq ASC LIMIT ${extra}
    )`;
  }
}

function sameParty(a, b) {
  // presence may carry partyId later; for now rely on client + optional partyId on payload
  if (!a || !b) return false;
  const pa = String(a.partyId || "");
  const pb = String(b.partyId || "");
  return !!(pa && pb && pa === pb);
}

function calcHitDmg(attacker) {
  const lv = Math.max(1, Math.min(100, Number(attacker.lv) || 1));
  return Math.max(8, Math.min(MAX_HIT_DMG, Math.floor(lv * 4 + 20)));
}

async function handleFieldPvpApi(req, res, u) {
  if (req.method === "OPTIONS") return corsPreflight(res, "GET,POST,OPTIONS");
  const sql = getSql();
  await ensureSchema();

  if (u === "/api/pvp/hit" && req.method === "POST") {
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    if (_antiCheat) {
      const auth = _antiCheat.authFromBody(data, ROOT);
      if (!auth.ok) {
        return jsonRes(res, 401, {
          ok: false,
          error: auth.error || "auth_required",
          message: "野外 PK 需要有效登入。",
        });
      }
    }
    const account = String(data.account || "")
      .replace(/[<>&"']/g, "")
      .trim()
      .slice(0, 24);
    const slot = Math.max(0, Math.min(8, Number(data.slot) || 0));
    const name = partySanitizeName(data.name);
    const fromKey = partyMemberKey(account, slot, name);
    const targetKey = String(data.targetKey || "").trim().slice(0, 48);
    const mapId = String(data.mapId || "").slice(0, 64);
    if (!fromKey || !targetKey || fromKey === targetKey) {
      return jsonRes(res, 400, { ok: false, error: "bad_target" });
    }
    if (!mapPvpAllowed(mapId)) {
      return jsonRes(res, 409, { ok: false, error: "safe_zone", message: "此地無法野外 PK。" });
    }

    const now = Date.now();
    const last = _hitAt.get(fromKey) || 0;
    if (now - last < HIT_COOLDOWN_MS) {
      return jsonRes(res, 429, { ok: false, error: "cooldown" });
    }

    const attacker = await loadPresence(sql, fromKey);
    const victim = await loadPresence(sql, targetKey);
    if (!attacker || !victim) {
      return jsonRes(res, 404, { ok: false, error: "offline", message: "對方已離線。" });
    }
    if (now - (attacker.lastSeen || 0) > PARTY_TTL_MS || now - (victim.lastSeen || 0) > PARTY_TTL_MS) {
      return jsonRes(res, 404, { ok: false, error: "offline", message: "對方已離線。" });
    }
    if (String(attacker.mapId || "") !== mapId || String(victim.mapId || "") !== mapId) {
      return jsonRes(res, 409, { ok: false, error: "diff_map", message: "必須在同一張地圖。" });
    }
    if (!attacker.pvpOn) {
      return jsonRes(res, 409, { ok: false, error: "pvp_off", message: "請先開啟野外 PK。" });
    }
    if (sameParty(attacker, victim)) {
      return jsonRes(res, 409, { ok: false, error: "party", message: "不可攻擊同隊隊員。" });
    }

    const mhp = Math.max(1, Math.floor(Number(victim.mhp) || 1));
    let hp = Math.max(0, Math.floor(Number(victim.hp) || 0));
    if (hp <= 0) {
      return jsonRes(res, 200, { ok: true, alreadyDead: true, hp: 0, mhp });
    }

    const dmg = calcHitDmg(attacker);
    hp = Math.max(0, hp - dmg);
    victim.hp = hp;
    await savePresence(sql, victim);
    _hitAt.set(fromKey, now);

    const killed = hp <= 0;
    await pushToKey(sql, targetKey, {
      type: "pvp_hit",
      fromKey,
      fromName: attacker.name || "冒險者",
      mapId,
      dmg,
      hp,
      mhp,
      killed,
    });
    if (killed) {
      await pushToKey(sql, targetKey, {
        type: "pvp_death",
        fromKey,
        fromName: attacker.name || "冒險者",
        mapId,
      });
    }

    return jsonRes(res, 200, {
      ok: true,
      dmg,
      hp,
      mhp,
      killed,
      targetKey,
      targetName: victim.name || "",
    });
  }

  return jsonRes(res, 404, { ok: false, error: "unknown pvp api" });
}

module.exports = { handleFieldPvpApi, mapPvpAllowed };

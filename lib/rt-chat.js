"use strict";

const { getSql, ensureSchema } = require("./db");
const { clientIp, jsonRes, corsPreflight } = require("./game-utils");
const {
  CHAT_MAX,
  CHAT_RATE_MS,
  CHAT_WAIT_MAX_MS,
  chatSanitizeText,
  parseJsonBody,
  pollWait,
  nextCounter,
  getCounter,
  checkRate,
} = require("./rt-common");

async function trimChat(sql) {
  const rows = await sql`SELECT COUNT(*)::int AS c FROM rt_chat`;
  const extra = (rows[0]?.c || 0) - CHAT_MAX;
  if (extra <= 0) return;
  await sql`DELETE FROM rt_chat WHERE seq IN (
    SELECT seq FROM rt_chat ORDER BY seq ASC LIMIT ${extra}
  )`;
}

async function chatPush(sql, msg) {
  const seq = await nextCounter(sql, "chat_seq");
  const at = Date.now();
  const payload = { ...msg, seq, at };
  await sql`INSERT INTO rt_chat (seq, payload, at) VALUES (${seq}, ${payload}, ${at})`;
  await trimChat(sql);
  return payload;
}

async function chatMessagesSince(sql, since) {
  const s = Math.max(0, Number(since) || 0);
  if (s === 0) {
    const rows = await sql`SELECT payload FROM rt_chat ORDER BY seq DESC LIMIT 80`;
    return rows.reverse().map((r) => r.payload);
  }
  const rows = await sql`SELECT payload FROM rt_chat WHERE seq > ${s} ORDER BY seq ASC LIMIT 120`;
  return rows.map((r) => r.payload);
}

async function handleChatApi(req, res, u) {
  if (req.method === "OPTIONS") return corsPreflight(res, "GET,POST,OPTIONS");
  const sql = getSql();
  await ensureSchema();

  if (u === "/api/chat/status" && req.method === "GET") {
    const seq = await getCounter(sql, "chat_seq");
    const rows = await sql`SELECT COUNT(*)::int AS c FROM rt_chat`;
    return jsonRes(res, 200, {
      ok: true,
      online: true,
      seq,
      count: rows[0]?.c || 0,
      rateMs: CHAT_RATE_MS,
    });
  }

  if (u === "/api/chat/send" && req.method === "POST") {
    const ip = clientIp(req);
    if (!(await checkRate(sql, "chat", ip, CHAT_RATE_MS))) {
      return jsonRes(res, 429, { ok: false, error: "rate", message: "發言過快，請稍候。" });
    }
    const data = await parseJsonBody(req);
    if (data === null) return jsonRes(res, 400, { ok: false, error: "bad json" });
    const text = chatSanitizeText(data.text);
    if (!text) return jsonRes(res, 400, { ok: false, error: "empty" });
    let ch = String(data.ch || "world");
    if (ch !== "world" && ch !== "clan" && ch !== "party") ch = "world";
    const now = Date.now();
    const name =
      String(data.name || "未命名")
        .replace(/[<>&"']/g, "")
        .trim()
        .slice(0, 16) || "未命名";
    const msg = await chatPush(sql, {
      v: 1,
      id: String(data.id || "").slice(0, 64) || "c" + now.toString(36),
      ch,
      text,
      name,
      alignment: Number(data.alignment) || 0,
      classic: data.classic !== false,
      clanKey: String(data.clanKey || "").slice(0, 80),
      partyId: String(data.partyId || "").slice(0, 48),
      slot: Number(data.slot) || 0,
      sessionId: String(data.sessionId || "").slice(0, 96),
      fp: String(data.fp || "").slice(0, 120),
      account: String(data.account || "")
        .replace(/[<>&"']/g, "")
        .trim()
        .slice(0, 24),
      at: now,
    });
    return jsonRes(res, 200, { ok: true, seq: msg.seq, id: msg.id });
  }

  if (u === "/api/chat/poll" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
    let waitMs = Number(url.searchParams.get("wait"));
    if (!Number.isFinite(waitMs) || waitMs < 0) waitMs = 0;
    waitMs = Math.min(CHAT_WAIT_MAX_MS, waitMs);

    if (since === 0) {
      const hist = await chatMessagesSince(sql, 0);
      const seq = await getCounter(sql, "chat_seq");
      return jsonRes(res, 200, { ok: true, messages: hist, seq });
    }

    const result = await pollWait(
      async () => {
        const messages = await chatMessagesSince(sql, since);
        const seq = await getCounter(sql, "chat_seq");
        return { ready: messages.length > 0 || waitMs <= 0, messages, seq };
      },
      waitMs,
      400
    );
    return jsonRes(res, 200, { ok: true, messages: result.messages || [], seq: result.seq || 0 });
  }

  return jsonRes(res, 404, { ok: false, error: "unknown chat api" });
}

module.exports = { handleChatApi };

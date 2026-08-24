const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 5173);
// Online (Render) keeps this off. Local Windows serve writes editable JSON to Desktop.
const ENABLE_DESKTOP_SAVES =
  process.env.DESKTOP_PLAYER_DATA === "1" ||
  (process.env.DESKTOP_PLAYER_DATA !== "0" && !process.env.RENDER && process.platform === "win32");

// Same IP may keep at most 2 live clients (dual-open). Heartbeat refreshes; TTL drops dead tabs.
const IP_SESSION_MAX = Math.max(1, Number(process.env.IP_SESSION_MAX || 2));
const IP_SESSION_TTL_MS = Math.max(15000, Number(process.env.IP_SESSION_TTL_MS || 90000));
const IP_SESSION_ENABLED = process.env.IP_SESSION_LIMIT !== "0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

/** @type {Map<string, Map<string, number>>} ip -> (clientId -> lastSeenMs) */
const ipSessions = new Map();

function resolveDesktopPlayerDir() {
  const home = os.homedir();
  const parents = [
    path.join(home, "Desktop"),
    path.join(home, "桌面"),
    path.join(home, "OneDrive", "Desktop"),
    path.join(home, "OneDrive", "桌面"),
  ];
  for (const p of parents) {
    if (fs.existsSync(p)) return path.join(p, "天堂玩家資料");
  }
  return path.join(home, "Desktop", "天堂玩家資料");
}

const DESKTOP_DIR = resolveDesktopPlayerDir();

function ensureDesktopDir() {
  fs.mkdirSync(DESKTOP_DIR, { recursive: true });
  const readme = path.join(DESKTOP_DIR, "說明.txt");
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      [
        "經典天堂 - 玩家資料（可直接用記事本修改）",
        "",
        "檔案說明：",
        "  slot-1.json ~ slot-8.json  → 各存檔位角色",
        "  warehouse_classic.json     → 經典模式共用倉庫",
        "  pets_classic.json          → 經典模式寵物名冊",
        "",
        "修改流程：",
        "  1. 用本機 node _serve.js 開遊戲（localhost）",
        "  2. 遊戲存檔後會自動同步到此資料夾",
        "  3. 關閉遊戲或返回角色選單後，用記事本改 JSON",
        "  4. 再載入該角色 → 會優先讀取這裡的檔案",
        "",
        "注意：請保持 JSON 格式正確（逗號、引號）。改完記得存檔。",
        "線上版（Render）不會寫入此資料夾。",
        "",
      ].join("\r\n"),
      "utf8"
    );
  }
  return DESKTOP_DIR;
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function readBody(req) {
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

function safeName(name) {
  return /^[a-z0-9_-]{1,40}$/i.test(name) ? name : null;
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  if (xf) return xf;
  const real = String(req.headers["x-real-ip"] || "").trim();
  if (real) return real;
  const ra = req.socket && req.socket.remoteAddress ? String(req.socket.remoteAddress) : "";
  return ra.replace(/^::ffff:/, "") || "unknown";
}

function pruneIpBucket(bucket, now) {
  for (const [id, ts] of bucket) {
    if (!ts || now - ts > IP_SESSION_TTL_MS) bucket.delete(id);
  }
}

function claimIpSession(ip, clientId) {
  const now = Date.now();
  let bucket = ipSessions.get(ip);
  if (!bucket) {
    bucket = new Map();
    ipSessions.set(ip, bucket);
  }
  pruneIpBucket(bucket, now);
  if (bucket.has(clientId)) {
    bucket.set(clientId, now);
    return { ok: true, count: bucket.size, max: IP_SESSION_MAX, renewed: true };
  }
  if (bucket.size >= IP_SESSION_MAX) {
    return {
      ok: false,
      error: "ip_limit",
      message: "此 IP 已達雙開上限（最多 " + IP_SESSION_MAX + " 個連線）。請先關閉其他視窗後再試。",
      count: bucket.size,
      max: IP_SESSION_MAX,
    };
  }
  bucket.set(clientId, now);
  return { ok: true, count: bucket.size, max: IP_SESSION_MAX, renewed: false };
}

function heartbeatIpSession(ip, clientId) {
  const now = Date.now();
  let bucket = ipSessions.get(ip);
  if (!bucket) return { ok: false, error: "missing" };
  pruneIpBucket(bucket, now);
  if (!bucket.has(clientId)) return { ok: false, error: "missing" };
  bucket.set(clientId, now);
  return { ok: true, count: bucket.size, max: IP_SESSION_MAX };
}

function releaseIpSession(ip, clientId) {
  const bucket = ipSessions.get(ip);
  if (!bucket) return { ok: true };
  bucket.delete(clientId);
  if (bucket.size === 0) ipSessions.delete(ip);
  return { ok: true };
}

function parseClientId(raw) {
  const id = String(raw || "").trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return null;
  return id;
}

async function handleSessionApi(req, res, u) {
  if (!IP_SESSION_ENABLED) {
    return json(res, 200, { ok: true, disabled: true, max: IP_SESSION_MAX });
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  const ip = clientIp(req);

  if (u === "/api/session/status" && req.method === "GET") {
    const bucket = ipSessions.get(ip) || new Map();
    pruneIpBucket(bucket, Date.now());
    return json(res, 200, {
      ok: true,
      ipMasked: ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.*.*"),
      count: bucket.size,
      max: IP_SESSION_MAX,
      ttlMs: IP_SESSION_TTL_MS,
    });
  }

  if (u === "/api/session/claim" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    let clientId = parseClientId(data.clientId);
    if (!clientId) clientId = "c_" + crypto.randomBytes(12).toString("hex");
    const result = claimIpSession(ip, clientId);
    if (!result.ok) return json(res, 429, result);
    return json(res, 200, Object.assign({ clientId: clientId }, result));
  }

  if (u === "/api/session/heartbeat" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const clientId = parseClientId(data.clientId);
    if (!clientId) return json(res, 400, { ok: false, error: "bad clientId" });
    const result = heartbeatIpSession(ip, clientId);
    if (!result.ok) {
      const claim = claimIpSession(ip, clientId);
      if (!claim.ok) return json(res, 429, claim);
      return json(res, 200, Object.assign({ clientId: clientId, reclaimed: true }, claim));
    }
    return json(res, 200, Object.assign({ clientId: clientId }, result));
  }

  if (u === "/api/session/release" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const clientId = parseClientId(data.clientId);
    if (clientId) releaseIpSession(ip, clientId);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { ok: false, error: "unknown session api" });
}

async function handlePlayerDataApi(req, res, u) {
  if (!ENABLE_DESKTOP_SAVES) {
    return json(res, 404, { ok: false, error: "desktop saves disabled" });
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (u === "/api/player-data/status" && req.method === "GET") {
    const dir = ensureDesktopDir();
    return json(res, 200, { ok: true, dir, enabled: true });
  }

  let m = u.match(/^\/api\/player-data\/slot\/(\d+)$/);
  if (m) {
    const slot = Math.max(1, Math.min(8, parseInt(m[1], 10) || 1));
    const file = path.join(ensureDesktopDir(), `slot-${slot}.json`);
    if (req.method === "GET") {
      if (!fs.existsSync(file)) return json(res, 404, { ok: false, error: "missing" });
      const raw = fs.readFileSync(file, "utf8");
      return json(res, 200, { ok: true, slot, data: JSON.parse(raw) });
    }
    if (req.method === "PUT") {
      const body = await readBody(req);
      const data = JSON.parse(body);
      if (!data || typeof data !== "object" || !data.p) {
        return json(res, 400, { ok: false, error: "invalid save object" });
      }
      fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
      return json(res, 200, { ok: true, slot, file });
    }
    if (req.method === "DELETE") {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return json(res, 200, { ok: true, slot });
    }
  }

  m = u.match(/^\/api\/player-data\/shared\/([a-z0-9_-]+)$/i);
  if (m) {
    const name = safeName(m[1]);
    if (!name) return json(res, 400, { ok: false, error: "bad name" });
    const file = path.join(ensureDesktopDir(), `${name}.json`);
    if (req.method === "GET") {
      if (!fs.existsSync(file)) return json(res, 404, { ok: false, error: "missing" });
      const raw = fs.readFileSync(file, "utf8");
      return json(res, 200, { ok: true, name, data: JSON.parse(raw) });
    }
    if (req.method === "PUT") {
      const body = await readBody(req);
      const data = JSON.parse(body);
      fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
      return json(res, 200, { ok: true, name, file });
    }
    if (req.method === "DELETE") {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return json(res, 200, { ok: true, name });
    }
  }

  return json(res, 404, { ok: false, error: "unknown api" });
}

// ===== 雲端共用存檔（全站同一帳號共用進度）=====
const ENABLE_CLOUD_SAVE = process.env.CLOUD_SAVE !== "0";
const CLOUD_ROOT = process.env.CLOUD_SAVE_DIR
  ? path.resolve(process.env.CLOUD_SAVE_DIR)
  : path.join(ROOT, "data", "cloud");
const CLOUD_ACCOUNT_DEFAULT = "guest";

function safeAccount(name) {
  const s = String(name || CLOUD_ACCOUNT_DEFAULT).trim();
  if (!s || s.length > 32) return CLOUD_ACCOUNT_DEFAULT;
  if (!/^[\u4e00-\u9fffA-Za-z0-9_-]+$/.test(s)) return CLOUD_ACCOUNT_DEFAULT;
  return s;
}

function cloudAccountDir(account) {
  const dir = path.join(CLOUD_ROOT, safeAccount(account));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cloudFileMeta(file) {
  try {
    const st = fs.statSync(file);
    return { mtimeMs: st.mtimeMs, size: st.size };
  } catch (e) {
    return null;
  }
}

async function handleCloudApi(req, res, u) {
  if (!ENABLE_CLOUD_SAVE) {
    return json(res, 404, { ok: false, error: "cloud save disabled" });
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (u === "/api/cloud/status" && req.method === "GET") {
    try {
      fs.mkdirSync(CLOUD_ROOT, { recursive: true });
    } catch (e) {}
    return json(res, 200, {
      ok: true,
      enabled: true,
      dir: CLOUD_ROOT,
      account: CLOUD_ACCOUNT_DEFAULT,
      ephemeralHint: !!process.env.RENDER && !process.env.CLOUD_SAVE_DIR,
    });
  }

  let m = u.match(/^\/api\/cloud\/(?:([^/]+)\/)?slot\/(\d+)$/);
  if (m) {
    const account = safeAccount(m[1] || CLOUD_ACCOUNT_DEFAULT);
    const slot = Math.max(1, Math.min(8, parseInt(m[2], 10) || 1));
    const file = path.join(cloudAccountDir(account), `slot-${slot}.json`);
    if (req.method === "GET") {
      if (!fs.existsSync(file)) return json(res, 404, { ok: false, error: "missing" });
      const raw = fs.readFileSync(file, "utf8");
      const meta = cloudFileMeta(file);
      return json(res, 200, { ok: true, account, slot, data: JSON.parse(raw), meta });
    }
    if (req.method === "PUT") {
      const body = await readBody(req);
      const data = JSON.parse(body);
      if (!data || typeof data !== "object" || !data.p) {
        return json(res, 400, { ok: false, error: "invalid save object" });
      }
      // 雲端存檔時同步鎖定角色名稱（全站唯一）；若被他人佔用或試圖改名則拒絕寫入
      const display = normalizeCharName(data.p && data.p.name);
      if (display) {
        const map = loadCharNames();
        const key = charNameKey(display);
        const row = map[key];
        const enSeed = String((data.p && data.p.enSeed) || "");
        const sameOwner =
          row &&
          accountKey(row.account || "") === accountKey(account) &&
          Number(row.slot) === slot &&
          (!enSeed || !row.enSeed || String(row.enSeed) === enSeed);
        if (row && !sameOwner) {
          return json(res, 409, {
            ok: false,
            error: "name_taken",
            message: "此角色名稱已被使用，請換一個名稱。",
          });
        }
        const locked = findRegisteredCharNameForSlot(map, account, slot, enSeed);
        if (locked && charNameKey(locked.name) !== key) {
          return json(res, 403, {
            ok: false,
            error: "name_locked",
            message: "角色名稱設定後不可更改。",
          });
        }
        map[key] = {
          name: display,
          account: account,
          slot: slot,
          enSeed: enSeed || (row && row.enSeed) || (locked && locked.enSeed) || "",
          claimedAt: (locked && locked.claimedAt) || Date.now(),
        };
        saveCharNames(map);
      }
      fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
      leaderboardCache.at = 0;
      return json(res, 200, { ok: true, account, slot, meta: cloudFileMeta(file) });
    }
    if (req.method === "DELETE") {
      if (fs.existsSync(file)) {
        try {
          const raw = fs.readFileSync(file, "utf8");
          const data = JSON.parse(raw);
          const display = normalizeCharName(data && data.p && data.p.name);
          if (display) {
            const map = loadCharNames();
            const key = charNameKey(display);
            const row = map[key];
            if (
              row &&
              accountKey(row.account || "") === accountKey(account) &&
              Number(row.slot) === slot
            ) {
              delete map[key];
              saveCharNames(map);
            }
          }
        } catch (e) {}
        fs.unlinkSync(file);
      }
      return json(res, 200, { ok: true, account, slot });
    }
  }

  m = u.match(/^\/api\/cloud\/(?:([^/]+)\/)?shared\/([a-z0-9_-]+)$/i);
  if (m) {
    const account = safeAccount(m[1] || CLOUD_ACCOUNT_DEFAULT);
    const name = safeName(m[2]);
    if (!name) return json(res, 400, { ok: false, error: "bad name" });
    const file = path.join(cloudAccountDir(account), `${name}.json`);
    if (req.method === "GET") {
      if (!fs.existsSync(file)) return json(res, 404, { ok: false, error: "missing" });
      const raw = fs.readFileSync(file, "utf8");
      return json(res, 200, {
        ok: true,
        account,
        name,
        data: JSON.parse(raw),
        meta: cloudFileMeta(file),
      });
    }
    if (req.method === "PUT") {
      const body = await readBody(req);
      const data = JSON.parse(body);
      fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
      return json(res, 200, { ok: true, account, name, meta: cloudFileMeta(file) });
    }
    if (req.method === "DELETE") {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return json(res, 200, { ok: true, account, name });
    }
  }

  // 一次拉回該帳號全部槽位＋共用桶（登入／選角用）
  m = u.match(/^\/api\/cloud\/(?:([^/]+)\/)?bundle$/);
  if (m && req.method === "GET") {
    const account = safeAccount(m[1] || CLOUD_ACCOUNT_DEFAULT);
    const dir = cloudAccountDir(account);
    const slots = {};
    for (let i = 1; i <= 8; i++) {
      const file = path.join(dir, `slot-${i}.json`);
      if (fs.existsSync(file)) {
        try {
          slots[i] = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch (e) {}
      }
    }
    const shared = {};
    ["warehouse", "warehouse_classic", "pets", "pets_classic"].forEach((name) => {
      const file = path.join(dir, `${name}.json`);
      if (fs.existsSync(file)) {
        try {
          shared[name] = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch (e) {}
      }
    });
    return json(res, 200, { ok: true, account, slots, shared });
  }

  return json(res, 404, { ok: false, error: "unknown cloud api" });
}

// ===== 💬 Online realtime chat (world / clan). In-memory ring; lost on restart. =====
const CHAT_MAX = 250;
const CHAT_RATE_MS = 1000;
const CHAT_TEXT_MAX = 60;
const CHAT_WAIT_MAX_MS = 20000;
/** @type {Array<object>} */
const chatMessages = [];
let chatSeq = 0;
/** @type {Map<string, number>} ip -> last send ms */
const chatRateByIp = new Map();
/** @type {Array<{since:number, resolve:Function, timer:any}>} */
const chatWaiters = [];

function chatSanitizeText(raw) {
  return String(raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, CHAT_TEXT_MAX);
}

function chatMessagesSince(since) {
  const s = Math.max(0, Number(since) || 0);
  return chatMessages.filter((m) => m && m.seq > s);
}

function chatNotifyWaiters() {
  if (!chatWaiters.length) return;
  const pending = chatWaiters.splice(0);
  pending.forEach((w) => {
    try {
      clearTimeout(w.timer);
    } catch (e) {}
    try {
      w.resolve(chatMessagesSince(w.since));
    } catch (e) {}
  });
}

function chatPush(msg) {
  chatSeq += 1;
  msg.seq = chatSeq;
  chatMessages.push(msg);
  while (chatMessages.length > CHAT_MAX) chatMessages.shift();
  chatNotifyWaiters();
  return msg;
}

function chatCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function handleChatApi(req, res, u) {
  if (req.method === "OPTIONS") {
    chatCors(res);
    res.writeHead(204);
    return res.end();
  }

  if (u === "/api/chat/status" && req.method === "GET") {
    return json(res, 200, {
      ok: true,
      online: true,
      seq: chatSeq,
      count: chatMessages.length,
      rateMs: CHAT_RATE_MS,
    });
  }

  if (u === "/api/chat/send" && req.method === "POST") {
    const ip = clientIp(req);
    const now = Date.now();
    const last = chatRateByIp.get(ip) || 0;
    if (now - last < CHAT_RATE_MS) {
      return json(res, 429, { ok: false, error: "rate", message: "發言過快，請稍候。" });
    }
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const text = chatSanitizeText(data.text);
    if (!text) return json(res, 400, { ok: false, error: "empty" });
    let ch = String(data.ch || "world");
    if (ch !== "world" && ch !== "clan" && ch !== "party") ch = "world";
    const name = String(data.name || "未命名")
      .replace(/[<>&"']/g, "")
      .trim()
      .slice(0, 16) || "未命名";
    const sessionId = String(data.sessionId || "").slice(0, 96);
    const id = String(data.id || "").slice(0, 64) || ("c" + now.toString(36));
    const msg = chatPush({
      v: 1,
      id: id,
      ch: ch,
      text: text,
      name: name,
      alignment: Number(data.alignment) || 0,
      classic: data.classic !== false,
      clanKey: String(data.clanKey || "").slice(0, 80),
      slot: Number(data.slot) || 0,
      sessionId: sessionId,
      fp: String(data.fp || "").slice(0, 120),
      account: String(data.account || "")
        .replace(/[<>&"']/g, "")
        .trim()
        .slice(0, 24),
      at: now,
    });
    chatRateByIp.set(ip, now);
    return json(res, 200, { ok: true, seq: msg.seq, id: msg.id });
  }

  if (u === "/api/chat/poll" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
    let waitMs = Number(url.searchParams.get("wait"));
    if (!Number.isFinite(waitMs) || waitMs < 0) waitMs = 0;
    waitMs = Math.min(CHAT_WAIT_MAX_MS, waitMs);
    const ready = chatMessagesSince(since);
    // First connect (since=0): return recent history immediately.
    if (since === 0) {
      const hist = chatMessages.slice(-80);
      return json(res, 200, { ok: true, messages: hist, seq: chatSeq });
    }
    if (ready.length || waitMs <= 0) {
      return json(res, 200, { ok: true, messages: ready, seq: chatSeq });
    }
    await new Promise((resolve) => {
      let done = false;
      const finish = (msgs) => {
        if (done) return;
        done = true;
        try {
          clearTimeout(waiter.timer);
        } catch (e) {}
        const idx = chatWaiters.indexOf(waiter);
        if (idx >= 0) chatWaiters.splice(idx, 1);
        try {
          json(res, 200, { ok: true, messages: msgs || [], seq: chatSeq });
        } catch (e) {}
        resolve();
      };
      const waiter = {
        since: since,
        resolve: finish,
        timer: null,
      };
      waiter.timer = setTimeout(() => {
        finish(chatMessagesSince(since));
      }, waitMs);
      chatWaiters.push(waiter);
      req.on("close", () => {
        if (done) return;
        done = true;
        try {
          clearTimeout(waiter.timer);
        } catch (e) {}
        const idx = chatWaiters.indexOf(waiter);
        if (idx >= 0) chatWaiters.splice(idx, 1);
        resolve();
      });
    });
    return;
  }

  return json(res, 404, { ok: false, error: "unknown chat api" });
}

// ===== 帳號註冊（全站唯一）＋角色名稱登錄（全站唯一 ID）=====
const ACCOUNTS_FILE = path.join(ROOT, "data", "accounts.json");
const CHAR_NAMES_FILE = path.join(ROOT, "data", "char-names.json");

function ensureDataDir() {
  try {
    fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
  } catch (e) {}
}

function readJsonFile(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJsonFile(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

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

/** 查詢此帳號＋存檔位（＋可選 enSeed）已登錄的角色名稱；用於禁止改名 */
function findRegisteredCharNameForSlot(map, account, slot, enSeed) {
  const ak = accountKey(account);
  for (const k of Object.keys(map || {})) {
    const r = map[k];
    if (!r) continue;
    if (accountKey(r.account || "") !== ak) continue;
    if (Number(r.slot) !== slot) continue;
    if (enSeed && r.enSeed && String(r.enSeed) !== String(enSeed)) continue;
    return r;
  }
  return null;
}

function loadAccounts() {
  return readJsonFile(ACCOUNTS_FILE, {});
}

function saveAccounts(map) {
  writeJsonFile(ACCOUNTS_FILE, map || {});
}

function loadCharNames() {
  return readJsonFile(CHAR_NAMES_FILE, {});
}

function saveCharNames(map) {
  writeJsonFile(CHAR_NAMES_FILE, map || {});
}

/** 掃描雲端存檔，補建角色名稱登錄（先到先得，不覆蓋既有登錄） */
function bootstrapCharNamesFromCloud() {
  if (!ENABLE_CLOUD_SAVE) return;
  try {
    if (!fs.existsSync(CLOUD_ROOT)) return;
    const map = loadCharNames();
    let changed = false;
    const accounts = fs.readdirSync(CLOUD_ROOT, { withFileTypes: true });
    for (const ent of accounts) {
      if (!ent.isDirectory()) continue;
      const account = normalizeAccountId(ent.name) || ent.name;
      for (let i = 1; i <= 8; i++) {
        const file = path.join(CLOUD_ROOT, ent.name, `slot-${i}.json`);
        if (!fs.existsSync(file)) continue;
        try {
          const data = JSON.parse(fs.readFileSync(file, "utf8"));
          const p = data && data.p;
          if (!p || !p.cls) continue;
          const display = normalizeCharName(p.name || "");
          if (!display) continue;
          const key = charNameKey(display);
          if (map[key]) continue;
          map[key] = {
            name: display,
            account: account,
            slot: i,
            enSeed: String(p.enSeed || ""),
            claimedAt: Date.now(),
          };
          changed = true;
        } catch (e) {}
      }
    }
    if (changed) saveCharNames(map);
  } catch (e) {
    console.log("CHAR_NAMES_BOOTSTRAP_ERR " + (e && e.message ? e.message : e));
  }
}

async function handleAccountsApi(req, res, u) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (u === "/api/accounts/status" && req.method === "GET") {
    return json(res, 200, { ok: true, enabled: true });
  }

  if (u === "/api/accounts/check" && req.method === "GET") {
    const q = new URL(req.url || "/", "http://localhost");
    const account = normalizeAccountId(q.searchParams.get("account") || "");
    if (!account) return json(res, 400, { ok: false, error: "bad account", taken: false });
    const map = loadAccounts();
    const taken = !!map[accountKey(account)];
    return json(res, 200, { ok: true, account, taken });
  }

  if (u === "/api/accounts/register" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = JSON.parse(body || "{}");
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const account = normalizeAccountId(data.account);
    const password = String(data.password == null ? "" : data.password);
    if (!account) return json(res, 400, { ok: false, error: "bad account" });
    if (password.length > 64) return json(res, 400, { ok: false, error: "password too long" });
    const map = loadAccounts();
    const key = accountKey(account);
    if (map[key]) {
      return json(res, 409, { ok: false, error: "taken", message: "此帳號已被註冊，請換一個帳號。" });
    }
    map[key] = {
      account: account,
      password: password,
      createdAt: Date.now(),
    };
    saveAccounts(map);
    return json(res, 200, { ok: true, account });
  }

  if (u === "/api/accounts/login" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = JSON.parse(body || "{}");
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const account = normalizeAccountId(data.account);
    const password = String(data.password == null ? "" : data.password);
    if (!account) return json(res, 400, { ok: false, error: "bad account" });
    const map = loadAccounts();
    const row = map[accountKey(account)];
    if (!row) {
      return json(res, 404, { ok: false, error: "missing", message: "帳號不存在，請先註冊。" });
    }
    if (String(row.password) !== password) {
      return json(res, 401, { ok: false, error: "bad password", message: "帳號或密碼錯誤。" });
    }
    return json(res, 200, { ok: true, account: row.account || account });
  }

  return json(res, 404, { ok: false, error: "unknown accounts api" });
}

async function handleNamesApi(req, res, u) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (u === "/api/names/status" && req.method === "GET") {
    return json(res, 200, { ok: true, enabled: true, count: Object.keys(loadCharNames()).length });
  }

  if (u === "/api/names/check" && req.method === "GET") {
    const q = new URL(req.url || "/", "http://localhost");
    const name = normalizeCharName(q.searchParams.get("name") || "");
    if (!name) return json(res, 400, { ok: false, error: "bad name", taken: false });
    const map = loadCharNames();
    const row = map[charNameKey(name)];
    return json(res, 200, {
      ok: true,
      name,
      taken: !!row,
      owner: row
        ? { account: row.account || "", slot: row.slot || 0, enSeed: row.enSeed || "" }
        : null,
    });
  }

  if (u === "/api/names/claim" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = JSON.parse(body || "{}");
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const name = normalizeCharName(data.name);
    const account = normalizeAccountId(data.account) || "guest";
    const slot = Math.max(1, Math.min(8, parseInt(data.slot, 10) || 1));
    const enSeed = String(data.enSeed || "");
    const prevName = normalizeCharName(data.prevName || "");
    if (!name) return json(res, 400, { ok: false, error: "bad name", message: "請輸入角色名稱。" });

    const map = loadCharNames();
    const key = charNameKey(name);
    const row = map[key];
    const sameOwner =
      row &&
      accountKey(row.account || "") === accountKey(account) &&
      Number(row.slot) === slot &&
      (!enSeed || !row.enSeed || String(row.enSeed) === enSeed);

    if (row && !sameOwner) {
      return json(res, 409, {
        ok: false,
        error: "taken",
        message: "此角色名稱已被使用，請換一個名稱。",
      });
    }

    const locked = findRegisteredCharNameForSlot(map, account, slot, enSeed);
    if (locked && charNameKey(locked.name) !== key) {
      return json(res, 403, {
        ok: false,
        error: "name_locked",
        message: "角色名稱設定後不可更改。",
      });
    }
    if (prevName && charNameKey(prevName) !== key) {
      return json(res, 403, {
        ok: false,
        error: "name_locked",
        message: "角色名稱設定後不可更改。",
      });
    }

    map[key] = {
      name: name,
      account: account,
      slot: slot,
      enSeed: enSeed || (row && row.enSeed) || (locked && locked.enSeed) || "",
      claimedAt: (locked && locked.claimedAt) || Date.now(),
    };

    saveCharNames(map);
    return json(res, 200, { ok: true, name, account, slot });
  }

  if (u === "/api/names/release" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = JSON.parse(body || "{}");
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const name = normalizeCharName(data.name);
    const account = normalizeAccountId(data.account) || "";
    const slot = Math.max(0, Math.min(8, parseInt(data.slot, 10) || 0));
    const enSeed = String(data.enSeed || "");
    if (!name) return json(res, 200, { ok: true, released: false });
    const map = loadCharNames();
    const key = charNameKey(name);
    const row = map[key];
    if (!row) return json(res, 200, { ok: true, released: false });
    const ownerOk =
      (!account || accountKey(row.account || "") === accountKey(account)) &&
      (!slot || Number(row.slot) === slot) &&
      (!enSeed || !row.enSeed || String(row.enSeed) === enSeed);
    if (!ownerOk) {
      return json(res, 403, { ok: false, error: "forbidden", message: "無法釋放他人角色名稱。" });
    }
    delete map[key];
    saveCharNames(map);
    return json(res, 200, { ok: true, released: true, name });
  }

  return json(res, 404, { ok: false, error: "unknown names api" });
}

// ===== 全服排行榜（掃描雲端存檔）=====
const LEADERBOARD_CLASS_NAMES = {
  royal: "王族",
  knight: "騎士",
  elf: "妖精",
  mage: "法師",
  dark: "黑暗妖精",
  dragon: "龍騎士",
  warrior: "戰士",
  illusion: "幻術士",
};
const LEADERBOARD_BOARDS = new Set(["level", "gold", "pride", "rift"]);
const LEADERBOARD_CACHE_MS = 60 * 1000;
let leaderboardCache = { at: 0, entries: [] };

function leaderboardClassName(cls) {
  return LEADERBOARD_CLASS_NAMES[cls] || cls || "未知";
}

function leaderboardDisplayName(p) {
  const n = normalizeCharName(p && p.name);
  return n || leaderboardClassName(p && p.cls);
}

function leaderboardIdentity(p, account, slot) {
  const enSeed = String((p && p.enSeed) || "");
  if (enSeed) return "seed:" + enSeed;
  const name = normalizeCharName(p && p.name);
  if (name) return "name:" + charNameKey(name);
  return "acct:" + accountKey(account) + ":" + slot;
}

function leaderboardFormatMs(ms) {
  const total = Math.max(0, Math.floor(Number(ms) || 0));
  const sec = Math.floor(total / 1000);
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min > 0) return min + " 分 " + rem + " 秒";
  return rem + " 秒";
}

function collectLeaderboardEntries() {
  const out = [];
  if (!ENABLE_CLOUD_SAVE) return out;
  try {
    fs.mkdirSync(CLOUD_ROOT, { recursive: true });
  } catch (e) {}
  let accounts = [];
  try {
    accounts = fs
      .readdirSync(CLOUD_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch (e) {
    return out;
  }
  for (const account of accounts) {
    const dir = path.join(CLOUD_ROOT, account);
    for (let slot = 1; slot <= 8; slot++) {
      const file = path.join(dir, "slot-" + slot + ".json");
      if (!fs.existsSync(file)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        const p = data && data.p;
        if (!p || !p.cls) continue;
        const prideBest = p.prideRank && p.prideRank.best ? p.prideRank.best : null;
        const riftBest = p.riftRank && p.riftRank.best ? p.riftRank.best : null;
        out.push({
          id: leaderboardIdentity(p, account, slot),
          name: leaderboardDisplayName(p),
          cls: String(p.cls || ""),
          clsName: leaderboardClassName(p.cls),
          lv: Math.max(1, Math.floor(Number(p.lv) || 1)),
          exp: Math.max(0, Math.floor(Number(p.exp) || 0)),
          gold: Math.max(0, Math.floor(Number(p.gold) || 0)),
          prideFloor: prideBest ? Math.max(0, Math.floor(Number(prideBest.floor) || 0)) : 0,
          prideMs: prideBest ? Math.max(0, Math.floor(Number(prideBest.ms) || 0)) : 0,
          riftMs: riftBest ? Math.max(0, Math.floor(Number(riftBest.ms) || 0)) : 0,
        });
      } catch (e) {}
    }
  }
  return out;
}

function leaderboardDedupe(entries) {
  const map = {};
  for (const row of entries) {
    const prev = map[row.id];
    if (!prev) {
      map[row.id] = row;
      continue;
    }
    if (row.lv > prev.lv || (row.lv === prev.lv && row.exp > prev.exp)) map[row.id] = row;
    else if (row.lv === prev.lv && row.exp === prev.exp) {
      if (row.gold > prev.gold) map[row.id] = row;
      else if (row.prideFloor > prev.prideFloor) map[row.id] = row;
      else if (row.prideFloor === prev.prideFloor && row.prideMs > 0 && (prev.prideMs <= 0 || row.prideMs < prev.prideMs)) map[row.id] = row;
      else if (row.riftMs > prev.riftMs) map[row.id] = row;
    }
  }
  return Object.values(map);
}

function leaderboardSort(board, rows) {
  const list = rows.slice();
  if (board === "gold") {
    list.sort((a, b) => b.gold - a.gold || b.lv - a.lv || a.name.localeCompare(b.name, "zh-Hant"));
  } else if (board === "pride") {
    list.sort(
      (a, b) =>
        b.prideFloor - a.prideFloor ||
        (a.prideFloor > 0 && b.prideFloor > 0 ? a.prideMs - b.prideMs : 0) ||
        b.lv - a.lv ||
        a.name.localeCompare(b.name, "zh-Hant")
    );
  } else if (board === "rift") {
    list.sort((a, b) => b.riftMs - a.riftMs || b.lv - a.lv || a.name.localeCompare(b.name, "zh-Hant"));
  } else {
    list.sort((a, b) => b.lv - a.lv || b.exp - a.exp || b.gold - a.gold || a.name.localeCompare(b.name, "zh-Hant"));
  }
  return list;
}

function leaderboardValueLabel(board, row) {
  if (board === "gold") return row.gold.toLocaleString() + " 金幣";
  if (board === "pride") {
    if (!row.prideFloor) return "—";
    return row.prideFloor + "F / " + leaderboardFormatMs(row.prideMs);
  }
  if (board === "rift") {
    if (!row.riftMs) return "—";
    return leaderboardFormatMs(row.riftMs);
  }
  return "Lv." + row.lv;
}

function getLeaderboardEntries() {
  const now = Date.now();
  if (!leaderboardCache.entries.length || now - leaderboardCache.at > LEADERBOARD_CACHE_MS) {
    leaderboardCache = { at: now, entries: leaderboardDedupe(collectLeaderboardEntries()) };
  }
  return leaderboardCache.entries;
}

async function handleLeaderboardApi(req, res, u) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }
  if (u !== "/api/leaderboard" || req.method !== "GET") {
    return json(res, 404, { ok: false, error: "unknown leaderboard api" });
  }
  const q = new URL(req.url || "/", "http://localhost");
  const board = LEADERBOARD_BOARDS.has(q.searchParams.get("board") || "")
    ? q.searchParams.get("board")
    : "level";
  const limit = Math.max(1, Math.min(100, parseInt(q.searchParams.get("limit"), 10) || 50));
  if (!ENABLE_CLOUD_SAVE) {
    return json(res, 503, { ok: false, error: "offline", message: "排行榜需要線上伺服器。" });
  }
  const sorted = leaderboardSort(board, getLeaderboardEntries()).slice(0, limit);
  const rows = sorted.map((row, i) => ({
    rank: i + 1,
    name: row.name,
    cls: row.cls,
    clsName: row.clsName,
    lv: row.lv,
    value: board === "gold" ? row.gold : board === "pride" ? row.prideFloor : board === "rift" ? row.riftMs : row.lv,
    valueLabel: leaderboardValueLabel(board, row),
  }));
  return json(res, 200, {
    ok: true,
    board,
    updatedAt: leaderboardCache.at,
    total: getLeaderboardEntries().length,
    rows,
  });
}

const server = http.createServer(async (req, res) => {
  let u = decodeURIComponent((req.url || "/").split("?")[0]);
  try {
    if (u.startsWith("/api/session")) {
      await handleSessionApi(req, res, u);
      return;
    }
    if (u.startsWith("/api/cloud")) {
      await handleCloudApi(req, res, u);
      return;
    }
    if (u.startsWith("/api/chat")) {
      await handleChatApi(req, res, u);
      return;
    }
    if (u.startsWith("/api/accounts")) {
      await handleAccountsApi(req, res, u);
      return;
    }
    if (u.startsWith("/api/names")) {
      await handleNamesApi(req, res, u);
      return;
    }
    if (u.startsWith("/api/player-data")) {
      await handlePlayerDataApi(req, res, u);
      return;
    }
    if (u.startsWith("/api/leaderboard")) {
      await handleLeaderboardApi(req, res, u);
      return;
    }
  } catch (e) {
    return json(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
  }

  if (u === "/") u = "/index.html";
  const rel = u.replace(/^\/+/, "");
  const full = path.normalize(path.join(ROOT, rel));
  if (!full.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not Found");
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log("PORT_IN_USE http://localhost:" + PORT);
    process.exit(0);
  }
  throw e;
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("READY http://localhost:" + PORT);
  console.log(
    "IP_SESSION " +
      (IP_SESSION_ENABLED ? "max=" + IP_SESSION_MAX + " ttlMs=" + IP_SESSION_TTL_MS : "off")
  );
  console.log(
    "CLOUD_SAVE " + (ENABLE_CLOUD_SAVE ? CLOUD_ROOT : "off")
  );
  try {
    bootstrapCharNamesFromCloud();
    console.log("ACCOUNTS " + Object.keys(loadAccounts()).length + " CHAR_NAMES " + Object.keys(loadCharNames()).length);
  } catch (e) {
    console.log("REGISTRY_ERR " + (e && e.message ? e.message : e));
  }
  console.log("CHAT online ring=" + CHAT_MAX);
  if (ENABLE_DESKTOP_SAVES) {
    try {
      const dir = ensureDesktopDir();
      console.log("PLAYER_DATA " + dir);
    } catch (e) {
      console.log("PLAYER_DATA_ERR " + (e && e.message ? e.message : e));
    }
  } else {
    console.log("PLAYER_DATA off");
  }
});

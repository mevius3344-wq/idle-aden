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

function cloudAccountIsGuest(account) {
  const a = safeAccount(account);
  return !a || a === CLOUD_ACCOUNT_DEFAULT;
}

function cloudRejectGuest(res, account) {
  if (!cloudAccountIsGuest(account)) return false;
  json(res, 403, {
    ok: false,
    error: "login_required",
    message: "請先登入帳號再使用雲端存檔，避免與其他玩家共用進度。",
  });
  return true;
}

function cloudFileMeta(file) {
  try {
    const st = fs.statSync(file);
    return { mtimeMs: st.mtimeMs, size: st.size };
  } catch (e) {
    return null;
  }
}

/** 雲端存檔進度分數：擋「較舊／較貧」PUT 覆蓋洗白 */
function cloudSaveProgressScore(data) {
  const p = data && data.p;
  if (!p || !p.cls) return -1;
  const lv = Math.max(1, Math.floor(Number(p.lv) || 1));
  const exp = Math.max(0, Math.floor(Number(p.exp) || 0));
  const gold = Math.max(0, Math.floor(Number(p.gold) || 0));
  let invN = 0;
  if (Array.isArray(p.inv)) {
    for (const it of p.inv) invN += Math.max(1, Math.floor(Number(it && it.cnt) || 1));
  }
  return lv * 1e12 + exp * 1e3 + Math.min(gold, 1e11) + invN;
}

function cloudSaveTime(data) {
  const t = Number((data && data.p && data.p.savedAt) || (data && data.savedAt) || 0);
  return Number.isFinite(t) && t > 0 ? Math.floor(t) : 0;
}

function cloudSaveBeats(a, b) {
  if (!a || !a.p) return false;
  if (!b || !b.p) return true;
  const sa = cloudSaveProgressScore(a);
  const sb = cloudSaveProgressScore(b);
  if (sa !== sb) return sa > sb;
  return cloudSaveTime(a) >= cloudSaveTime(b);
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
    if (cloudRejectGuest(res, account)) return;
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
      // 同角色(enSeed)拒絕用較貧／較舊進度覆蓋雲端（防多開／舊分頁洗白）
      if (fs.existsSync(file)) {
        try {
          const existing = JSON.parse(fs.readFileSync(file, "utf8"));
          const exSeed = String((existing && existing.p && existing.p.enSeed) || "");
          const inSeed = String((data.p && data.p.enSeed) || "");
          if (exSeed && inSeed && exSeed === inSeed && !cloudSaveBeats(data, existing)) {
            return json(res, 409, {
              ok: false,
              error: "stale_save",
              message: "伺服器存檔較新或進度較高，已拒絕較舊上傳，避免覆蓋洗白。",
              meta: cloudFileMeta(file),
            });
          }
        } catch (e) {}
      }
      // 雲端存檔時同步鎖定角色名稱（全站唯一）；若被他人佔用或試圖改名則拒絕寫入
      const display = normalizeCharName(data.p && data.p.name);
      if (display) {
        const map = loadCharNames();
        const key = charNameKey(display);
        const row = map[key];
        const enSeed = String((data.p && data.p.enSeed) || "");
        // 同帳號同存檔位可更新 enSeed（刪角重創、創角中斷後重試）
        if (row && !charNameSameSlotOwner(row, account, slot)) {
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
    if (cloudRejectGuest(res, account)) return;
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
    if (cloudRejectGuest(res, account)) return;
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
      partyId: String(data.partyId || "").slice(0, 48),
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

// ===== 🤝 Realtime party (invite / roster / share). In-memory; lost on restart. =====
const PARTY_MAX = 8;
const PARTY_TTL_MS = 90000; // 線上 presence（顯示綠點／同圖分享）
const PARTY_MEMBER_TTL_MS = 12 * 60 * 60 * 1000; // 成員資格保留（對齊離線掛機 12h 上限）
const PARTY_INVITE_MS = 60000;
const PARTY_APPLY_MS = 120000;
const PARTY_SHARE_RATE_MS = 80;
const PARTY_WAIT_MAX_MS = 20000;
const PARTY_EVENT_MAX = 120;
/** @type {Map<string, object>} partyId -> party */
const parties = new Map();
/** @type {Map<string, object>} memberKey -> presence */
const partyPresence = new Map();
/** @type {Map<string, object[]>} memberKey -> pending invites */
const partyInvites = new Map();
/** @type {Array<{since:number, resolve:Function, timer:any, key:string}>} */
const partyWaiters = [];
let partyEventSeq = 0;
/** @type {Array<object>} */
const partyEvents = [];

function partyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function partySanitizeName(raw) {
  return String(raw || "")
    .replace(/[<>&"']/g, "")
    .trim()
    .slice(0, 16);
}

function partyMemberKey(account, slot, name) {
  const a = String(account || "")
    .replace(/[<>&"']/g, "")
    .trim()
    .slice(0, 24);
  const s = Math.max(0, Math.min(8, Number(slot) || 0));
  const n = partySanitizeName(name) || "未命名";
  if (!a) return "";
  return a + "#" + s + "#" + n;
}

function partyNewId() {
  return "P" + Date.now().toString(36) + crypto.randomBytes(2).toString("hex");
}

function partyPushEvent(ev) {
  partyEventSeq += 1;
  ev.seq = partyEventSeq;
  ev.at = Date.now();
  partyEvents.push(ev);
  while (partyEvents.length > PARTY_EVENT_MAX) partyEvents.shift();
  partyNotifyWaiters();
  return ev;
}

function partyNotifyWaiters() {
  if (!partyWaiters.length) return;
  const pending = partyWaiters.splice(0);
  pending.forEach((w) => {
    try {
      clearTimeout(w.timer);
    } catch (e) {}
    try {
      w.resolve(true);
    } catch (e) {}
  });
}

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

function partyFindByMemberKey(key) {
  if (!key) return null;
  for (const p of parties.values()) {
    if (!p || !Array.isArray(p.members)) continue;
    if (p.members.some((m) => m && m.key === key)) return p;
  }
  return null;
}

function partyMemberLastSeen(m, pre) {
  if (pre && pre.lastSeen) return pre.lastSeen;
  return m && m.lastSeen ? m.lastSeen : 0;
}

function partyMemberOnline(m, pre, t) {
  return !!(pre && t - (pre.lastSeen || 0) < PARTY_TTL_MS);
}

function partyMemberActive(m, pre, t) {
  if (!m) return false;
  const last = partyMemberLastSeen(m, pre);
  return last > 0 && t - last < PARTY_MEMBER_TTL_MS;
}

function partyCleanupStale(now) {
  const t = now || Date.now();
  for (const [key, pre] of partyPresence.entries()) {
    if (!pre || t - (pre.lastSeen || 0) > PARTY_TTL_MS) partyPresence.delete(key);
  }
  for (const [key, list] of partyInvites.entries()) {
    const keep = (list || []).filter((inv) => inv && t - (inv.at || 0) < PARTY_INVITE_MS);
    if (keep.length) partyInvites.set(key, keep);
    else partyInvites.delete(key);
  }
  for (const [pid, party] of parties.entries()) {
    if (!party || !Array.isArray(party.members)) {
      parties.delete(pid);
      continue;
    }
    party.members.forEach((m) => {
      if (!m) return;
      const pre = partyPresence.get(m.key);
      m.online = partyMemberOnline(m, pre, t);
      if (pre) {
        m.mapId = pre.mapId || m.mapId;
        m.mapName = pre.mapName || m.mapName;
        m.lv = pre.lv || m.lv;
        m.hp = pre.hp;
        m.mhp = pre.mhp;
        m.cls = pre.cls || m.cls;
        m.lastSeen = pre.lastSeen || m.lastSeen || t;
      }
    });
    const activeMembers = party.members.filter((m) => partyMemberActive(m, partyPresence.get(m.key), t));
    if (!activeMembers.length) {
      parties.delete(pid);
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
        partyPushEvent({
          type: "leader",
          partyId: party.id,
          leaderKey: party.leaderKey,
          name: pick.name,
        });
      }
    }
    if (Array.isArray(party.applications)) {
      party.applications = party.applications.filter(
        (a) => a && t - (a.at || 0) < PARTY_APPLY_MS && !party.members.some((m) => m && m.key === a.key)
      );
    }
    if (!party.members.length) parties.delete(pid);
  }
}

function partyPublicSummary(party, viewerKey) {
  if (!party) return null;
  const leader = (party.members || []).find((m) => m && m.key === party.leaderKey);
  const onlineCount = (party.members || []).filter((m) => m && m.online).length;
  const apps = party.applications || [];
  return {
    id: party.id,
    leaderName: leader ? leader.name : "—",
    leaderLv: leader ? leader.lv || 1 : 1,
    leaderCls: leader ? leader.cls || "" : "",
    mapName: leader ? leader.mapName || leader.mapId || "—" : "—",
    memberCount: (party.members || []).length,
    max: PARTY_MAX,
    onlineCount: onlineCount,
    applied: viewerKey ? apps.some((a) => a && a.key === viewerKey) : false,
    open: (party.members || []).length < PARTY_MAX && onlineCount > 0,
  };
}

function partyUpsertPresence(body) {
  const account = String(body.account || "")
    .replace(/[<>&"']/g, "")
    .trim()
    .slice(0, 24);
  const name = partySanitizeName(body.name);
  const slot = Math.max(0, Math.min(8, Number(body.slot) || 0));
  const key = partyMemberKey(account, slot, name);
  if (!key) return null;
  const now = Date.now();
  const row = {
    key: key,
    account: account,
    slot: slot,
    name: name || "未命名",
    sessionId: String(body.sessionId || "").slice(0, 96),
    lv: Math.max(1, Math.min(100, Number(body.lv) || 1)),
    cls: String(body.cls || "").slice(0, 24),
    mapId: String(body.mapId || "").slice(0, 64),
    mapName: String(body.mapName || "")
      .replace(/[<>&"']/g, "")
      .trim()
      .slice(0, 40),
    hp: Math.max(0, Number(body.hp) || 0),
    mhp: Math.max(0, Number(body.mhp) || 0),
    classic: body.classic !== false,
    lastSeen: now,
  };
  partyPresence.set(key, row);
  const party = partyFindByMemberKey(key);
  if (party) {
    const m = party.members.find((x) => x && x.key === key);
    if (m) {
      Object.assign(m, {
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
    }
  }
  return { key: key, presence: row, party: party };
}

function partyEventsFor(key, since) {
  const s = Math.max(0, Number(since) || 0);
  const party = partyFindByMemberKey(key);
  const pid = party ? party.id : "";
  return partyEvents.filter((ev) => {
    if (!ev || !(ev.seq > s)) return false;
    if (ev.toKey && ev.toKey === key) return true;
    if (ev.partyId && pid && ev.partyId === pid) return true;
    return false;
  });
}

function partySnapshotFor(key) {
  partyCleanupStale(Date.now());
  const party = partyFindByMemberKey(key);
  const invites = (partyInvites.get(key) || []).map((inv) => ({
    id: inv.id,
    partyId: inv.partyId,
    fromName: inv.fromName,
    fromKey: inv.fromKey,
    at: inv.at,
  }));
  const applications =
    party && party.leaderKey === key
      ? (party.applications || [])
          .filter((a) => a && Date.now() - (a.at || 0) < PARTY_APPLY_MS)
          .map((a) => ({
            id: a.id,
            key: a.key,
            name: a.name,
            lv: a.lv || 1,
            cls: a.cls || "",
            at: a.at,
          }))
      : [];
  return {
    ok: true,
    seq: partyEventSeq,
    party: partyPublic(party),
    invites: invites,
    applications: applications,
    events: [],
  };
}

async function handlePartyApi(req, res, u) {
  if (req.method === "OPTIONS") {
    partyCors(res);
    res.writeHead(204);
    return res.end();
  }

  if (u === "/api/party/status" && req.method === "GET") {
    partyCleanupStale(Date.now());
    return json(res, 200, {
      ok: true,
      online: true,
      parties: parties.size,
      presence: partyPresence.size,
      seq: partyEventSeq,
      max: PARTY_MAX,
    });
  }

  // 線上玩家名單（組隊搜尋／邀請）
  if (u === "/api/party/online" && req.method === "GET") {
    partyCleanupStale(Date.now());
    const url = new URL(req.url || "/", "http://localhost");
    const q = String(url.searchParams.get("q") || "")
      .trim()
      .toLowerCase()
      .slice(0, 24);
    const selfAccount = String(url.searchParams.get("account") || "")
      .replace(/[<>&"']/g, "")
      .trim()
      .slice(0, 24);
    const selfSlot = Math.max(0, Math.min(8, Number(url.searchParams.get("slot")) || 0));
    const selfName = partySanitizeName(url.searchParams.get("name"));
    const selfKey = partyMemberKey(selfAccount, selfSlot, selfName);
    const list = [];
    for (const pre of partyPresence.values()) {
      if (!pre || !pre.name) continue;
      if (selfKey && pre.key === selfKey) continue;
      if (q && String(pre.name).toLowerCase().indexOf(q) < 0) continue;
      list.push({
        name: pre.name,
        lv: pre.lv || 1,
        cls: pre.cls || "",
        mapName: pre.mapName || pre.mapId || "",
        classic: !!pre.classic,
        inParty: !!partyFindByMemberKey(pre.key),
      });
      if (list.length >= 40) break;
    }
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-Hant"));
    return json(res, 200, { ok: true, players: list });
  }

  // 公開隊伍列表（申請加入）
  if (u === "/api/party/list" && req.method === "GET") {
    partyCleanupStale(Date.now());
    const url = new URL(req.url || "/", "http://localhost");
    const selfAccount = String(url.searchParams.get("account") || "")
      .replace(/[<>&"']/g, "")
      .trim()
      .slice(0, 24);
    const selfSlot = Math.max(0, Math.min(8, Number(url.searchParams.get("slot")) || 0));
    const selfName = partySanitizeName(url.searchParams.get("name"));
    const selfKey = partyMemberKey(selfAccount, selfSlot, selfName);
    const list = [];
    for (const party of parties.values()) {
      if (!party || !Array.isArray(party.members)) continue;
      if (party.members.length >= PARTY_MAX) continue;
      if (selfKey && party.members.some((m) => m && m.key === selfKey)) continue;
      const summary = partyPublicSummary(party, selfKey);
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
    return json(res, 200, { ok: true, parties: list });
  }

  if (u === "/api/party/heartbeat" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = partyUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account" });
    return json(res, 200, {
      ok: true,
      key: up.key,
      party: partyPublic(up.party),
      seq: partyEventSeq,
    });
  }

  if (u === "/api/party/create" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = partyUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account", message: "請先登入帳號再組隊。" });
    const existing = partyFindByMemberKey(up.key);
    if (existing) {
      return json(res, 200, { ok: true, party: partyPublic(existing), already: true });
    }
    const id = partyNewId();
    const member = {
      ...up.presence,
      leader: true,
      online: true,
      lastSeen: Date.now(),
      joinedAt: Date.now(),
    };
    const party = {
      id: id,
      leaderKey: up.key,
      members: [member],
      createdAt: Date.now(),
      lastShareAt: 0,
    };
    parties.set(id, party);
    partyPushEvent({ type: "create", partyId: id, toKey: up.key });
    return json(res, 200, { ok: true, party: partyPublic(party) });
  }

  if (u === "/api/party/invite" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = partyUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account", message: "請先登入帳號。" });
    let party = partyFindByMemberKey(up.key);
    if (!party) {
      return json(res, 400, { ok: false, error: "no party", message: "請先建立隊伍再邀請。" });
    }
    if (party.leaderKey !== up.key) {
      return json(res, 403, { ok: false, error: "not leader", message: "只有隊長可以邀請。" });
    }
    if (party.members.length >= PARTY_MAX) {
      return json(res, 400, { ok: false, error: "full", message: "隊伍已滿（最多 " + PARTY_MAX + " 人）。" });
    }
    const targetName = partySanitizeName(data.targetName);
    if (!targetName) return json(res, 400, { ok: false, error: "empty", message: "請輸入對方角色名稱。" });
    partyCleanupStale(Date.now());
    const wantClassic = data.classic !== false;
    let target = null;
    let fallback = null;
    for (const pre of partyPresence.values()) {
      if (!pre || pre.name !== targetName) continue;
      if (pre.classic === wantClassic) {
        target = pre;
        break;
      }
      if (!fallback) fallback = pre; // 經典／一般旗標不一致時仍允許同名邀請
    }
    if (!target) target = fallback;
    if (!target) {
      return json(res, 404, { ok: false, error: "offline", message: "找不到線上的「" + targetName + "」。對方需登入並進入遊戲。" });
    }
    if (target.key === up.key) {
      return json(res, 400, { ok: false, error: "self", message: "無法邀請自己。" });
    }
    if (party.members.some((m) => m && m.key === target.key)) {
      return json(res, 400, { ok: false, error: "already", message: "對方已在隊伍中。" });
    }
    if (partyFindByMemberKey(target.key)) {
      return json(res, 400, { ok: false, error: "busy", message: "對方已在其他隊伍中。" });
    }
    const inviteId = "I" + Date.now().toString(36) + crypto.randomBytes(2).toString("hex");
    const inv = {
      id: inviteId,
      partyId: party.id,
      fromKey: up.key,
      fromName: up.presence.name,
      toKey: target.key,
      at: Date.now(),
    };
    const list = partyInvites.get(target.key) || [];
    const filtered = list.filter((x) => x && x.partyId !== party.id);
    filtered.push(inv);
    partyInvites.set(target.key, filtered);
    partyPushEvent({
      type: "invite",
      toKey: target.key,
      inviteId: inviteId,
      partyId: party.id,
      fromName: up.presence.name,
    });
    return json(res, 200, { ok: true, inviteId: inviteId, targetName: target.name });
  }

  if (u === "/api/party/respond" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = partyUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account" });
    const inviteId = String(data.inviteId || "").slice(0, 48);
    const accept = !!data.accept;
    const list = partyInvites.get(up.key) || [];
    const inv = list.find((x) => x && x.id === inviteId);
    partyInvites.set(
      up.key,
      list.filter((x) => x && x.id !== inviteId)
    );
    if (!inv) return json(res, 404, { ok: false, error: "gone", message: "邀請已失效。" });
    if (Date.now() - (inv.at || 0) > PARTY_INVITE_MS) {
      return json(res, 410, { ok: false, error: "expired", message: "邀請已過期。" });
    }
    if (!accept) {
      partyPushEvent({
        type: "decline",
        partyId: inv.partyId,
        name: up.presence.name,
        toKey: inv.fromKey,
      });
      return json(res, 200, { ok: true, accepted: false });
    }
    if (partyFindByMemberKey(up.key)) {
      return json(res, 400, { ok: false, error: "busy", message: "你已在隊伍中，請先離隊。" });
    }
    const party = parties.get(inv.partyId);
    if (!party) return json(res, 404, { ok: false, error: "no party", message: "隊伍已解散。" });
    if (party.members.length >= PARTY_MAX) {
      return json(res, 400, { ok: false, error: "full", message: "隊伍已滿。" });
    }
    party.members.push({
      ...up.presence,
      leader: false,
      online: true,
      lastSeen: Date.now(),
      joinedAt: Date.now(),
    });
    partyPushEvent({
      type: "join",
      partyId: party.id,
      name: up.presence.name,
      key: up.key,
    });
    return json(res, 200, { ok: true, accepted: true, party: partyPublic(party) });
  }

  if (u === "/api/party/apply" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = partyUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account", message: "請先登入帳號。" });
    if (partyFindByMemberKey(up.key)) {
      return json(res, 400, { ok: false, error: "busy", message: "你已在隊伍中，請先離隊。" });
    }
    const partyId = String(data.partyId || "").slice(0, 48);
    const party = parties.get(partyId);
    if (!party) return json(res, 404, { ok: false, error: "gone", message: "隊伍已解散。" });
    if (party.members.length >= PARTY_MAX) {
      return json(res, 400, { ok: false, error: "full", message: "隊伍已滿。" });
    }
    if (!party.applications) party.applications = [];
    if (party.applications.some((a) => a && a.key === up.key)) {
      return json(res, 200, { ok: true, pending: true, message: "已送出申請，等待隊長審核。" });
    }
    const applyId = "A" + Date.now().toString(36) + crypto.randomBytes(2).toString("hex");
    party.applications.push({
      id: applyId,
      key: up.key,
      name: up.presence.name,
      lv: up.presence.lv,
      cls: up.presence.cls,
      at: Date.now(),
    });
    partyPushEvent({
      type: "apply",
      partyId: party.id,
      toKey: party.leaderKey,
      applyId: applyId,
      fromKey: up.key,
      name: up.presence.name,
    });
    return json(res, 200, { ok: true, pending: true, applyId: applyId, message: "已申請加入，等待隊長審核。" });
  }

  if (u === "/api/party/review" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = partyUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account" });
    const party = partyFindByMemberKey(up.key);
    if (!party) return json(res, 400, { ok: false, error: "no party", message: "你不在隊伍中。" });
    if (party.leaderKey !== up.key) {
      return json(res, 403, { ok: false, error: "not leader", message: "只有隊長可以審核申請。" });
    }
    const applyId = String(data.applyId || "").slice(0, 48);
    const accept = !!data.accept;
    const apps = party.applications || [];
    const app = apps.find((a) => a && a.id === applyId);
    party.applications = apps.filter((a) => a && a.id !== applyId);
    if (!app) return json(res, 404, { ok: false, error: "gone", message: "申請已失效。" });
    if (!accept) {
      partyPushEvent({
        type: "apply_reject",
        partyId: party.id,
        toKey: app.key,
        leaderName: up.presence.name,
      });
      return json(res, 200, { ok: true, accepted: false });
    }
    if (party.members.length >= PARTY_MAX) {
      return json(res, 400, { ok: false, error: "full", message: "隊伍已滿。" });
    }
    if (partyFindByMemberKey(app.key)) {
      return json(res, 400, { ok: false, error: "busy", message: "對方已在其他隊伍中。" });
    }
    partyCleanupStale(Date.now());
    const pre = partyPresence.get(app.key);
    if (!pre || Date.now() - (pre.lastSeen || 0) > PARTY_TTL_MS) {
      return json(res, 404, { ok: false, error: "offline", message: "對方已離線。" });
    }
    party.members.push({
      ...pre,
      leader: false,
      online: true,
      lastSeen: Date.now(),
      joinedAt: Date.now(),
    });
    partyPushEvent({
      type: "join",
      partyId: party.id,
      name: pre.name,
      key: app.key,
    });
    partyPushEvent({
      type: "apply_accept",
      partyId: party.id,
      toKey: app.key,
    });
    return json(res, 200, { ok: true, accepted: true, party: partyPublic(party) });
  }

  if (u === "/api/party/leave" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = partyUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account" });
    const party = partyFindByMemberKey(up.key);
    if (!party) return json(res, 200, { ok: true, left: true });
    const wasLeader = party.leaderKey === up.key;
    party.members = party.members.filter((m) => m && m.key !== up.key);
    partyPushEvent({ type: "leave", partyId: party.id, name: up.presence.name, key: up.key });
    if (!party.members.length) {
      parties.delete(party.id);
      partyPushEvent({ type: "disband", partyId: party.id, toKey: up.key });
    } else if (wasLeader) {
      party.leaderKey = party.members[0].key;
      party.members.forEach((m) => {
        if (m) m.leader = m.key === party.leaderKey;
      });
      partyPushEvent({
        type: "leader",
        partyId: party.id,
        leaderKey: party.leaderKey,
        name: party.members[0].name,
      });
    }
    return json(res, 200, { ok: true, left: true });
  }

  if (u === "/api/party/kick" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = partyUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account" });
    const party = partyFindByMemberKey(up.key);
    if (!party) return json(res, 400, { ok: false, error: "no party" });
    if (party.leaderKey !== up.key) {
      return json(res, 403, { ok: false, error: "not leader", message: "只有隊長可以踢人。" });
    }
    const targetKey = String(data.targetKey || "").slice(0, 80);
    if (!targetKey || targetKey === up.key) {
      return json(res, 400, { ok: false, error: "bad target", message: "無法踢除。" });
    }
    const kicked = party.members.find((m) => m && m.key === targetKey);
    party.members = party.members.filter((m) => m && m.key !== targetKey);
    if (kicked) {
      partyPushEvent({
        type: "kick",
        partyId: party.id,
        name: kicked.name,
        key: targetKey,
        toKey: targetKey,
      });
    }
    return json(res, 200, { ok: true, party: partyPublic(party) });
  }

  if (u === "/api/party/disband" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = partyUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account" });
    const party = partyFindByMemberKey(up.key);
    if (!party) return json(res, 200, { ok: true, disbanded: true });
    if (party.leaderKey !== up.key) {
      return json(res, 403, { ok: false, error: "not leader", message: "只有隊長可以解散隊伍。" });
    }
    const pid = party.id;
    const keys = party.members.map((m) => m && m.key).filter(Boolean);
    parties.delete(pid);
    keys.forEach((k) => {
      partyPushEvent({ type: "disband", partyId: pid, toKey: k });
    });
    return json(res, 200, { ok: true, disbanded: true });
  }

  if (u === "/api/party/share" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = partyUpsertPresence(data);
    if (!up || !up.party) return json(res, 400, { ok: false, error: "no party" });
    const party = up.party;
    const now = Date.now();
    if (!party.shareAtByKey) party.shareAtByKey = {};
    if (now - (party.shareAtByKey[up.key] || 0) < PARTY_SHARE_RATE_MS) {
      return json(res, 429, { ok: false, error: "rate" });
    }
    party.shareAtByKey[up.key] = now;
    party.lastShareAt = now;
    const exp = Math.max(0, Math.min(500000, Math.floor(Number(data.exp) || 0)));
    const gold = Math.max(0, Math.min(200000, Math.floor(Number(data.gold) || 0)));
    const mapId = String(data.mapId || "").slice(0, 64);
    const mobName = String(data.mobName || "")
      .replace(/[<>&"']/g, "")
      .trim()
      .slice(0, 40);
    if (!exp && !gold) return json(res, 200, { ok: true, skipped: true });
    partyPushEvent({
      type: "share",
      partyId: party.id,
      fromKey: up.key,
      fromName: up.presence.name,
      mapId: mapId,
      exp: exp,
      gold: gold,
      mobName: mobName,
    });
    return json(res, 200, { ok: true });
  }

  if (u === "/api/party/poll" && req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const account = String(url.searchParams.get("account") || "")
      .replace(/[<>&"']/g, "")
      .trim()
      .slice(0, 24);
    const slot = Math.max(0, Math.min(8, Number(url.searchParams.get("slot")) || 0));
    const name = partySanitizeName(url.searchParams.get("name"));
    const key = partyMemberKey(account, slot, name);
    if (!key) return json(res, 400, { ok: false, error: "need account" });
    const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
    let waitMs = Number(url.searchParams.get("wait"));
    if (!Number.isFinite(waitMs) || waitMs < 0) waitMs = 0;
    waitMs = Math.min(PARTY_WAIT_MAX_MS, waitMs);

    const build = () => {
      partyCleanupStale(Date.now());
      const snap = partySnapshotFor(key);
      snap.events = partyEventsFor(key, since);
      if (snap.events.length) {
        const maxSeq = Math.max.apply(
          null,
          snap.events.map((e) => e.seq || 0)
        );
        if (maxSeq > snap.seq) snap.seq = maxSeq;
      }
      return snap;
    };

    const ready = partyEventsFor(key, since);
    if (ready.length || waitMs <= 0 || since === 0) {
      return json(res, 200, build());
    }
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try {
          clearTimeout(waiter.timer);
        } catch (e) {}
        const idx = partyWaiters.indexOf(waiter);
        if (idx >= 0) partyWaiters.splice(idx, 1);
        try {
          json(res, 200, build());
        } catch (e) {}
        resolve();
      };
      const waiter = {
        since: since,
        key: key,
        resolve: finish,
        timer: null,
      };
      waiter.timer = setTimeout(finish, waitMs);
      partyWaiters.push(waiter);
      req.on("close", () => {
        if (done) return;
        done = true;
        try {
          clearTimeout(waiter.timer);
        } catch (e) {}
        const idx = partyWaiters.indexOf(waiter);
        if (idx >= 0) partyWaiters.splice(idx, 1);
        resolve();
      });
    });
    return;
  }

  return json(res, 404, { ok: false, error: "unknown party api" });
}

// ===== 🩸 Realtime player clans (create / search / join). Persisted to data/clans.json. =====
const CLAN_MAX = 40;
const CLAN_TTL_MS = 180000;
const CLANS_FILE = path.join(ROOT, "data", "clans.json");
/** @type {Map<string, object>} clanId -> clan */
const rtClans = new Map();
/** @type {Map<string, object>} memberKey -> presence (reuse party presence shape) */
const clanPresence = new Map();
let clanSaveTimer = null;

function clanSanitizeName(raw) {
  return String(raw || "")
    .replace(/[<>&"']/g, "")
    .trim()
    .slice(0, 20);
}

function clanNewId() {
  return "C" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
}

function clanLoadFromDisk() {
  try {
    ensureDataDir();
    if (!fs.existsSync(CLANS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(CLANS_FILE, "utf8"));
    const list = Array.isArray(raw && raw.clans) ? raw.clans : [];
    rtClans.clear();
    list.forEach((c) => {
      if (!c || !c.id || !c.name) return;
      const members = Array.isArray(c.members)
        ? c.members
            .filter((m) => m && m.key && m.account)
            .map((m) => ({
              key: String(m.key).slice(0, 96),
              account: String(m.account || "").slice(0, 24),
              slot: Math.max(0, Math.min(8, Number(m.slot) || 0)),
              name: partySanitizeName(m.name) || "未命名",
              lv: Math.max(1, Math.min(200, Number(m.lv) || 1)),
              cls: String(m.cls || "").slice(0, 16),
              classic: m.classic !== false,
              leader: !!m.leader,
              online: false,
              lastSeen: Math.max(0, Number(m.lastSeen) || 0),
            }))
            .slice(0, CLAN_MAX)
        : [];
      if (!members.length) return;
      let leaderKey = String(c.leaderKey || "").slice(0, 96);
      if (!members.some((m) => m.key === leaderKey)) {
        members[0].leader = true;
        leaderKey = members[0].key;
      }
      members.forEach((m) => {
        m.leader = m.key === leaderKey;
      });
      rtClans.set(String(c.id).slice(0, 48), {
        id: String(c.id).slice(0, 48),
        name: clanSanitizeName(c.name),
        leaderKey: leaderKey,
        members: members,
        faction: c.faction === "esti" ? "esti" : "tros",
        createdAt: Math.max(0, Number(c.createdAt) || Date.now()),
      });
    });
  } catch (e) {
    console.warn("[clan] load failed:", e && e.message ? e.message : e);
  }
}

function clanSaveToDiskSoon() {
  if (clanSaveTimer) return;
  clanSaveTimer = setTimeout(() => {
    clanSaveTimer = null;
    try {
      ensureDataDir();
      const clans = [];
      for (const c of rtClans.values()) {
        if (!c || !c.id) continue;
        clans.push({
          id: c.id,
          name: c.name,
          leaderKey: c.leaderKey,
          faction: c.faction || "tros",
          createdAt: c.createdAt || Date.now(),
          members: (c.members || []).map((m) => ({
            key: m.key,
            account: m.account,
            slot: m.slot,
            name: m.name,
            lv: m.lv,
            cls: m.cls,
            classic: !!m.classic,
            leader: !!m.leader,
            lastSeen: m.lastSeen || 0,
          })),
        });
      }
      fs.writeFileSync(CLANS_FILE, JSON.stringify({ v: 1, clans: clans }, null, 0), "utf8");
    } catch (e) {
      console.warn("[clan] save failed:", e && e.message ? e.message : e);
    }
  }, 400);
}

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
  const out = {
    id: clan.id,
    name: clan.name,
    leaderKey: clan.leaderKey,
    faction: clan.faction || "tros",
    memberCount: (clan.members || []).length,
    onlineCount: onlineCount,
    createdAt: clan.createdAt || 0,
  };
  if (!brief) out.members = (clan.members || []).map(clanPublicMember).filter(Boolean);
  const leader = (clan.members || []).find((m) => m && m.key === clan.leaderKey);
  out.leaderName = leader ? leader.name : "";
  return out;
}

function clanFindByMemberKey(key) {
  if (!key) return null;
  for (const c of rtClans.values()) {
    if (c && Array.isArray(c.members) && c.members.some((m) => m && m.key === key)) return c;
  }
  return null;
}

function clanFindByName(name) {
  const n = clanSanitizeName(name).toLowerCase();
  if (!n) return null;
  for (const c of rtClans.values()) {
    if (c && String(c.name || "").toLowerCase() === n) return c;
  }
  return null;
}

function clanUpsertPresence(body) {
  const account = String((body && body.account) || "")
    .replace(/[<>&"']/g, "")
    .trim()
    .slice(0, 24);
  if (!account) return null;
  const slot = Math.max(0, Math.min(8, Number(body.slot) || 0));
  const name = partySanitizeName(body.name) || "未命名";
  const key = partyMemberKey(account, slot, name);
  if (!key) return null;
  const presence = {
    key: key,
    account: account,
    slot: slot,
    name: name,
    lv: Math.max(1, Math.min(200, Number(body.lv) || 1)),
    cls: String(body.cls || "").slice(0, 16),
    classic: body.classic !== false,
    online: true,
    lastSeen: Date.now(),
  };
  clanPresence.set(key, presence);
  const clan = clanFindByMemberKey(key);
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
  return { key: key, presence: presence, clan: clan };
}

function clanMarkOfflineStale(now) {
  now = now || Date.now();
  for (const c of rtClans.values()) {
    (c.members || []).forEach((m) => {
      if (!m) return;
      if (now - (m.lastSeen || 0) > CLAN_TTL_MS) m.online = false;
    });
  }
}

try {
  clanLoadFromDisk();
} catch (e) {}

async function handleClanApi(req, res, u) {
  if (req.method === "OPTIONS") {
    partyCors(res);
    res.writeHead(204);
    return res.end();
  }

  if (u === "/api/clan/status" && req.method === "GET") {
    clanMarkOfflineStale(Date.now());
    return json(res, 200, {
      ok: true,
      online: true,
      clans: rtClans.size,
      max: CLAN_MAX,
    });
  }

  // 搜尋血盟（名稱關鍵字）
  if (u === "/api/clan/search" && req.method === "GET") {
    clanMarkOfflineStale(Date.now());
    const url = new URL(req.url || "/", "http://localhost");
    const q = String(url.searchParams.get("q") || "")
      .trim()
      .toLowerCase()
      .slice(0, 20);
    const list = [];
    for (const c of rtClans.values()) {
      if (!c || !c.name) continue;
      if (q && String(c.name).toLowerCase().indexOf(q) < 0) continue;
      list.push(clanPublic(c, { brief: true }));
      if (list.length >= 40) break;
    }
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-Hant"));
    return json(res, 200, { ok: true, clans: list });
  }

  if (u === "/api/clan/mine" && req.method === "GET") {
    clanMarkOfflineStale(Date.now());
    const url = new URL(req.url || "/", "http://localhost");
    const account = String(url.searchParams.get("account") || "")
      .replace(/[<>&"']/g, "")
      .trim()
      .slice(0, 24);
    const slot = Math.max(0, Math.min(8, Number(url.searchParams.get("slot")) || 0));
    const name = partySanitizeName(url.searchParams.get("name"));
    const key = partyMemberKey(account, slot, name);
    if (!key) return json(res, 400, { ok: false, error: "need account" });
    const clan = clanFindByMemberKey(key);
    return json(res, 200, { ok: true, clan: clanPublic(clan), key: key });
  }

  if (u === "/api/clan/heartbeat" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = clanUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account" });
    return json(res, 200, { ok: true, key: up.key, clan: clanPublic(up.clan) });
  }

  if (u === "/api/clan/create" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = clanUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account", message: "請先登入帳號再創立血盟。" });
    if (String(data.cls || up.presence.cls || "") !== "royal") {
      return json(res, 403, { ok: false, error: "not royal", message: "只有王族可以創立血盟。" });
    }
    const existing = clanFindByMemberKey(up.key);
    if (existing) {
      return json(res, 200, { ok: true, clan: clanPublic(existing), already: true });
    }
    const name = clanSanitizeName(data.clanName || data.nameClan);
    if (!name || name.length < 1) {
      return json(res, 400, { ok: false, error: "bad name", message: "血盟名稱需為 1 至 20 個字。" });
    }
    if (clanFindByName(name)) {
      return json(res, 409, { ok: false, error: "name taken", message: "此血盟名稱已被使用。" });
    }
    const id = clanNewId();
    const faction = data.faction === "esti" || data.avatar === "公主" ? "esti" : "tros";
    const member = {
      ...up.presence,
      leader: true,
      online: true,
    };
    const clan = {
      id: id,
      name: name,
      leaderKey: up.key,
      members: [member],
      faction: faction,
      createdAt: Date.now(),
    };
    rtClans.set(id, clan);
    clanSaveToDiskSoon();
    return json(res, 200, { ok: true, clan: clanPublic(clan) });
  }

  if (u === "/api/clan/join" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = clanUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account", message: "請先登入帳號再加入血盟。" });
    if (clanFindByMemberKey(up.key)) {
      return json(res, 400, { ok: false, error: "already in clan", message: "你已在血盟中，請先退出再加入。" });
    }
    let clan = null;
    const clanId = String(data.clanId || "").slice(0, 48);
    if (clanId) clan = rtClans.get(clanId) || null;
    if (!clan && data.clanName) clan = clanFindByName(data.clanName);
    if (!clan) return json(res, 404, { ok: false, error: "not found", message: "找不到此血盟。" });
    if (clan.members.length >= CLAN_MAX) {
      return json(res, 400, { ok: false, error: "full", message: "血盟已滿（最多 " + CLAN_MAX + " 人）。" });
    }
    clan.members.push({
      ...up.presence,
      leader: false,
      online: true,
    });
    clanSaveToDiskSoon();
    return json(res, 200, { ok: true, clan: clanPublic(clan) });
  }

  if (u === "/api/clan/leave" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = clanUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account" });
    const clan = clanFindByMemberKey(up.key);
    if (!clan) return json(res, 200, { ok: true, left: true, empty: true });
    const wasLeader = clan.leaderKey === up.key;
    clan.members = clan.members.filter((m) => m && m.key !== up.key);
    if (!clan.members.length) {
      rtClans.delete(clan.id);
      clanSaveToDiskSoon();
      return json(res, 200, { ok: true, left: true, dissolved: true });
    }
    if (wasLeader) {
      clan.members[0].leader = true;
      clan.leaderKey = clan.members[0].key;
      clan.members.forEach((m) => {
        m.leader = m.key === clan.leaderKey;
      });
    }
    clanSaveToDiskSoon();
    return json(res, 200, { ok: true, left: true, clan: clanPublic(clan) });
  }

  if (u === "/api/clan/kick" && req.method === "POST") {
    const body = await readBody(req);
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      return json(res, 400, { ok: false, error: "bad json" });
    }
    const up = clanUpsertPresence(data);
    if (!up) return json(res, 400, { ok: false, error: "need account" });
    const clan = clanFindByMemberKey(up.key);
    if (!clan) return json(res, 400, { ok: false, error: "no clan", message: "你尚未加入血盟。" });
    if (clan.leaderKey !== up.key) {
      return json(res, 403, { ok: false, error: "not leader", message: "只有盟主可以踢出成員。" });
    }
    const targetKey = String(data.targetKey || "").slice(0, 96);
    const targetName = partySanitizeName(data.targetName);
    let target = null;
    if (targetKey) target = clan.members.find((m) => m && m.key === targetKey);
    if (!target && targetName) target = clan.members.find((m) => m && m.name === targetName);
    if (!target) return json(res, 404, { ok: false, error: "not found", message: "找不到該成員。" });
    if (target.key === up.key) {
      return json(res, 400, { ok: false, error: "self", message: "不能踢出自己，請改用退出血盟。" });
    }
    clan.members = clan.members.filter((m) => m && m.key !== target.key);
    clanSaveToDiskSoon();
    return json(res, 200, { ok: true, clan: clanPublic(clan) });
  }

  return json(res, 404, { ok: false, error: "unknown clan api" });
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
function charNameSameSlotOwner(row, account, slot) {
  return (
    row &&
    accountKey(row.account || "") === accountKey(account) &&
    Number(row.slot) === slot
  );
}

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
    const account = normalizeAccountId(data.account);
    if (!account || account === CLOUD_ACCOUNT_DEFAULT) {
      return json(res, 401, {
        ok: false,
        error: "login_required",
        message: "請先登入帳號再創建角色。",
      });
    }
    const slot = Math.max(1, Math.min(8, parseInt(data.slot, 10) || 1));
    const enSeed = String(data.enSeed || "");
    const prevName = normalizeCharName(data.prevName || "");
    if (!name) return json(res, 400, { ok: false, error: "bad name", message: "請輸入角色名稱。" });

    const map = loadCharNames();
    const key = charNameKey(name);
    const row = map[key];
    // 同帳號同存檔位可更新 enSeed（刪角重創、創角中斷後重試）
    if (row && !charNameSameSlotOwner(row, account, slot)) {
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

function leaderboardSeedHash(str) {
  str = String(str);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 與客戶端存檔一致的角色唯一識別（enSeed 或名稱+職業衍生） */
function leaderboardEnSeed(p) {
  const direct = String((p && p.enSeed) || "").trim();
  if (direct) return direct;
  const name = normalizeCharName(p && p.name);
  const cls = String((p && p.cls) || "");
  if (name && cls) {
    return "es" + leaderboardSeedHash(name + "|" + cls + "|lz").toString(36);
  }
  return "";
}

function leaderboardDisplayName(p) {
  return normalizeCharName(p && p.name) || "";
}

function leaderboardIdentity(p, account, slot) {
  // 角色名稱為全站唯一 ID；排行榜以名稱去重（避免刪角重創、guest/登入雲端各一份造成同名多筆）
  const display = leaderboardDisplayName(p);
  if (display) return "name:" + charNameKey(display);
  const seed = leaderboardEnSeed(p);
  if (seed) return "seed:" + seed;
  return "acct:" + accountKey(account) + ":" + slot;
}

function leaderboardMergeKeepBest(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (b.lv !== a.lv) return b.lv > a.lv ? b : a;
  if (b.exp !== a.exp) return b.exp > a.exp ? b : a;
  if (b.gold !== a.gold) return b.gold > a.gold ? b : a;
  if (b.prideFloor !== a.prideFloor) return b.prideFloor > a.prideFloor ? b : a;
  if (b.prideFloor > 0 && a.prideFloor > 0 && b.prideMs !== a.prideMs) {
    return b.prideMs < a.prideMs ? b : a;
  }
  if (b.riftMs !== a.riftMs) return b.riftMs > a.riftMs ? b : a;
  return a;
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
        const display = leaderboardDisplayName(p);
        if (!display) continue;   // 未命名角色不進榜（避免整排「騎士／法師」假名）
        const prideBest = p.prideRank && p.prideRank.best ? p.prideRank.best : null;
        const riftBest = p.riftRank && p.riftRank.best ? p.riftRank.best : null;
        out.push({
          id: leaderboardIdentity(p, account, slot),
          name: display,
          account: safeAccount(account),
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
    map[row.id] = leaderboardMergeKeepBest(map[row.id], row);
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
    if (u.startsWith("/api/party")) {
      await handlePartyApi(req, res, u);
      return;
    }
    if (u.startsWith("/api/clan")) {
      await handleClanApi(req, res, u);
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

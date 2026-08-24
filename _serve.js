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
        "  warehouse.json             → 一般模式共用倉庫",
        "  warehouse_classic.json     → 經典模式共用倉庫",
        "  pets.json                  → 一般模式寵物名冊",
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
const CLOUD_ACCOUNT_DEFAULT = "天堂";

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
      fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
      return json(res, 200, { ok: true, account, slot, meta: cloudFileMeta(file) });
    }
    if (req.method === "DELETE") {
      if (fs.existsSync(file)) fs.unlinkSync(file);
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
    if (u.startsWith("/api/player-data")) {
      await handlePlayerDataApi(req, res, u);
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

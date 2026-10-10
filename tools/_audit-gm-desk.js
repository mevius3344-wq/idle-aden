// 桌面「天堂GM後台」實測：遊戲伺服器（檔案模式、暫存資料夾）＋ GM 後台（環境變數指向它），跑完整線上 GM 流程並截圖
// 用法：node tools/_audit-gm-desk.js   截圖 → tools/lin/_out/gmdesk_*.png
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const GM_DIR = path.join(ROOT, "..", "天堂GM後台");
const GAME_PORT = 9341;
const GM_PORT = 9342;
const CDP_PORT = 9343;
const GAME = "http://127.0.0.1:" + GAME_PORT;
const GMU = "http://127.0.0.1:" + GM_PORT;
const GM_TOKEN = "audit-desk-token-" + Date.now();
const GM_PASSWORD = "audit-pass";
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "gmdesk-"));
const OUT = path.join(__dirname, "lin", "_out");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const START = Date.now();

let fails = 0;
function check(name, ok, extra) {
  console.log((ok ? "  OK   " : "  FAIL ") + name + (extra ? "  " + extra : ""));
  if (!ok) fails++;
}

async function call(base, method, u, body, bearer) {
  const headers = { "Content-Type": "application/json" };
  if (bearer) headers.Authorization = "Bearer " + bearer;
  const r = await fetch(base + u, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try {
    data = await r.json();
  } catch (e) {}
  return { status: r.status, data: data || {} };
}

async function waitUp(url) {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch (e) {}
    await sleep(250);
  }
  return false;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const gameEnv = Object.assign({}, process.env, { PORT: String(GAME_PORT), CLOUD_SAVE_DIR: DIR, GM_TOKEN, IP_SESSION_LIMIT: "0" });
  delete gameEnv.DATABASE_URL;
  delete gameEnv.POSTGRES_URL;
  const game = spawn(process.execPath, ["_serve.js"], { cwd: ROOT, env: gameEnv, stdio: "ignore" });
  const gmEnv = Object.assign({}, process.env, { GM_PORT: String(GM_PORT), GM_TOKEN, GM_CLOUD_API: GAME, GM_PASSWORD });
  const desk = spawn(process.execPath, ["gm-server.js"], { cwd: GM_DIR, env: gmEnv, stdio: "ignore" });
  let br = null;
  try {
    check("game server up", await waitUp(GAME + "/api/version"));
    check("GM desk up", await waitUp(GMU + "/api/gm/status"));

    const db = require("../lib/rt-gm").loadItemDb() || {};
    const ids = Object.keys(db);
    const gloveId = ids.find((k) => db[k].slot === "gloves");
    const potId = ids.find((k) => db[k].type === "pot");
    const acc = "DeskTest1";
    await call(GAME, "POST", "/api/accounts/register", { account: acc, password: "pw123456" });
    const login = await call(GAME, "POST", "/api/accounts/login", { account: acc, password: "pw123456", clientId: "c1" });
    const auth = login.data.authToken;
    const save = { p: { name: "桌面測試", cls: "dark", lv: 12, exp: 0, gold: 50, inv: [{ id: potId, uid: "i1", cnt: 2 }], eq: { gloves: { id: gloveId, uid: "u1", cnt: 1 } }, enSeed: "s1" } };
    check("player save", (await call(GAME, "PUT", "/api/cloud/" + acc + "/slot/1", { account: acc, authToken: auth, save })).data.ok);

    console.log("=== 桌面後台 API ===");
    check("status points at game", (await call(GMU, "GET", "/api/gm/status")).data.cloudApi === GAME);
    check("bad password", (await call(GMU, "POST", "/api/gm/login", { password: "x" })).status === 401);
    const tok = (await call(GMU, "POST", "/api/gm/login", { password: GM_PASSWORD })).data.token;
    check("desk login", !!tok);
    const get = (u) => call(GMU, "GET", u, null, tok);
    const post = (u, b) => call(GMU, "POST", u, b, tok);

    const ov = await get("/api/gm/overview");
    check("overview cloud ok", ov.data.cloud && ov.data.cloud.ok && ov.data.cloud.storage === "file", JSON.stringify(ov.data.cloud || {}).slice(0, 160));
    check("overview online=1", ov.data.cloud && ov.data.cloud.online === 1);
    const accs = await get("/api/gm/accounts");
    check("accounts online list", (accs.data.onlineAccounts || []).some((a) => a.account === acc));
    const det = await get("/api/gm/online/account?account=" + acc);
    check("online account detail", det.data.ok && det.data.slots[0].clsName === "黑暗妖精", det.data.slots && det.data.slots[0] && det.data.slots[0].clsName);
    const slot = await get("/api/gm/online/slot?account=" + acc + "&slot=1");
    const gl = (slot.data.eq || []).find((e) => e.slot === "gloves");
    check("online slot gloves", !!gl && !gl.empty, gl && gl.name);
    check("online slot inv", (slot.data.inv || []).length === 1);

    const g1 = await post("/api/gm/grant", { target: "cloud", account: acc, slot: 0, kind: "item", itemId: potId, cnt: 5, note: "桌面測試" });
    check("grant any-slot", g1.data.ok, JSON.stringify(g1.data).slice(0, 160));
    const go = await post("/api/gm/grant-online", { kind: "gold", amount: 1000, note: "全服補償" });
    check("grant-online", go.data.ok && go.data.sent.length === 1, go.data.message);
    const det2 = await get("/api/gm/online/account?account=" + acc);
    const pend = (det2.data.grants || []).filter((g) => !g.claimedAt && !g.cancelledAt);
    check("2 pending grants", pend.length === 2);
    const anySlot = (det2.data.grants || []).find((g) => g.kind === "item");
    check("any-slot grant has slot null", anySlot && anySlot.slot == null);
    check("cancel via desk", (await post("/api/gm/grant/cancel", { id: anySlot.id })).data.ok);
    const hb = await call(GAME, "POST", "/api/accounts/session/heartbeat", { account: acc, authToken: auth, clientId: "c1", slot: 1 });
    check("player sees 1 mail", hb.data.gmMail === 1);

    check("rates via desk", (await post("/api/gm/rates", { target: "cloud", expMult: 3, goldMult: 1, dropMult: 2, label: "週末" })).data.ok);
    const ov2 = await get("/api/gm/overview");
    check("overview rates exp×3", ov2.data.cloud.rates && ov2.data.cloud.rates.expMult === 3);
    check("rates reset", (await post("/api/gm/rates", { target: "cloud", reset: true })).data.ok);

    check("kick via desk", (await post("/api/gm/kick", { account: acc })).data.ok);
    const hb2 = await call(GAME, "POST", "/api/accounts/session/heartbeat", { account: acc, authToken: auth, clientId: "c1", slot: 1 });
    check("player kicked", hb2.status === 401);
    check("ban via desk", (await post("/api/gm/ban", { target: "cloud", account: acc, hours: 2, reason: "測試" })).data.ok);
    check("player login banned", (await call(GAME, "POST", "/api/accounts/login", { account: acc, password: "pw123456", clientId: "c1" })).status === 403);
    check("unban via desk", (await post("/api/gm/unban", { target: "cloud", account: acc })).data.ok);
    await call(GAME, "POST", "/api/accounts/login", { account: acc, password: "pw123456", clientId: "c1" });

    const au = await get("/api/gm/audit?limit=100");
    const acts = (au.data.rows || []).map((r) => r.action);
    for (const a of ["grant_item", "grant_gold", "grant_online", "grant_cancel", "rates_set", "kick", "ban", "unban"]) check("audit " + a, acts.indexOf(a) >= 0);

    console.log("=== 介面（headless Edge） ===");
    const exe = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), "gmdesk-br-"));
    br = spawn(exe, ["--headless=new", "--remote-debugging-port=" + CDP_PORT, "--user-data-dir=" + udd, "--no-first-run", "--window-size=1400,1000", "about:blank"], { stdio: "ignore" });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) {
      await sleep(250);
      try {
        targets = await (await fetch("http://127.0.0.1:" + CDP_PORT + "/json/list")).json();
      } catch (e) {}
    }
    const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r));
    let id = 0;
    const pendMap = new Map();
    const errors = [];
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pendMap.has(m.id)) {
        pendMap.get(m.id)(m);
        pendMap.delete(m.id);
      }
      if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text + " " + ((m.params.exceptionDetails.exception || {}).description || ""));
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pendMap.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
    const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, "base64")); };
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: GMU + "/" });
    await sleep(1200);
    await ev(`document.getElementById('gm-pass').value=${JSON.stringify(GM_PASSWORD)};document.getElementById('btn-login').click();1`);
    await sleep(2500);
    const kp = await ev("document.querySelectorAll('#ov-kpis .gm-kpi').length");
    check("UI overview KPIs", kp >= 6, "kpis=" + kp);
    check("UI overview online row", (await ev("document.querySelectorAll('#ov-online .gm-item').length")) === 1);
    check("UI overview audit rows", (await ev("document.querySelectorAll('#ov-audit tbody tr').length")) >= 5);
    await shot("gmdesk_overview.png");
    await ev("document.querySelector('#ov-online .gm-item').click();1");
    await sleep(2500);
    check("UI bag tab opened", await ev("!document.getElementById('tab-bag').classList.contains('hidden')"));
    check("UI mail table", (await ev("document.querySelectorAll('#bag-mail tbody tr').length")) === 2);
    check("UI mail item name", await ev("document.getElementById('bag-mail').textContent.indexOf(" + JSON.stringify(db[potId].n) + ")>=0"));
    check("UI source label", (await ev("document.getElementById('bag-summary').textContent")).indexOf("線上伺服器") >= 0);
    check("UI gloves row", await ev("[...document.querySelectorAll('#bag-eq tr')].some(r=>r.textContent.indexOf('手套')>=0 && r.textContent.indexOf('—')<0)"));
    await shot("gmdesk_bag.png");
    await ev("document.querySelector('[data-tab=audit]').click();1");
    await sleep(1500);
    check("UI audit tab rows", (await ev("document.querySelectorAll('#audit-table tbody tr').length")) >= 8);
    await shot("gmdesk_audit.png");
    check("no page JS errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    ws.close();
  } catch (e) {
    check("exception", false, e && e.stack ? e.stack : String(e));
  } finally {
    if (br) br.kill();
    desk.kill();
    game.kill();
    await sleep(300);
    try {
      const auditFile = path.join(ROOT, "data", "gm-desk-audit.json");
      const log = JSON.parse(fs.readFileSync(auditFile, "utf8"));
      log.entries = (log.entries || []).filter((e) => !(e.action === "grant_online" && e.at >= START));
      fs.writeFileSync(auditFile, JSON.stringify(log, null, 2), "utf8");
    } catch (e) {}
    try {
      fs.rmSync(DIR, { recursive: true, force: true });
    } catch (e) {}
  }
  console.log("\nRESULT: " + (fails ? "FAIL (" + fails + ")" : "PASS"));
  process.exit(fails ? 1 : 0);
})();

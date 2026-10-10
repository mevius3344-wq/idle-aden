// 檔案模式（無 DATABASE_URL）GM API 實測：起一台暫存資料夾的 _serve.js，跑完整 GM 流程
// 用法：node tools/_audit-gm-file.js
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = 9341;
const BASE = "http://127.0.0.1:" + PORT;
const GM_TOKEN = "audit-gm-token-" + Date.now();
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "gmfile-"));

let fails = 0;
function check(name, ok, extra) {
  console.log((ok ? "  OK   " : "  FAIL ") + name + (extra ? "  " + extra : ""));
  if (!ok) fails++;
}

async function call(method, u, body, gm) {
  const headers = { "Content-Type": "application/json" };
  if (gm) headers.Authorization = "Bearer " + gm;
  const r = await fetch(BASE + u, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try {
    data = await r.json();
  } catch (e) {}
  return { status: r.status, data: data || {} };
}
const gmGet = (u) => call("GET", u, null, GM_TOKEN);
const gmPost = (u, b) => call("POST", u, b, GM_TOKEN);

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + "/api/version");
      if (r.ok) return true;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

(async () => {
  const env = Object.assign({}, process.env, {
    PORT: String(PORT),
    CLOUD_SAVE_DIR: DIR,
    GM_TOKEN,
    IP_SESSION_LIMIT: "0",
  });
  delete env.DATABASE_URL;
  delete env.POSTGRES_URL;
  const srv = spawn(process.execPath, ["_serve.js"], { cwd: ROOT, env, stdio: "ignore" });
  try {
    check("server up", await waitUp());
    const db = require("../lib/rt-gm").loadItemDb() || {};
    const ids = Object.keys(db);
    const gloveId = ids.find((k) => db[k].slot === "gloves");
    const useId = ids.find((k) => db[k].type === "pot");
    const acc = "GmTest1";
    const pw = "pw123456";

    await call("POST", "/api/accounts/register", { account: acc, password: pw });
    let login = await call("POST", "/api/accounts/login", { account: acc, password: pw, clientId: "c1" });
    check("login", login.data.ok, login.data.message);
    let auth = login.data.authToken;
    const save = { p: { name: "測試員", cls: "knight", lv: 5, exp: 0, gold: 100, inv: [], eq: { gloves: { id: gloveId, uid: "u1", cnt: 1 } }, enSeed: "seed1" } };
    const put = await call("PUT", "/api/cloud/" + acc + "/slot/1", { account: acc, authToken: auth, save });
    check("cloud save", put.data.ok, JSON.stringify(put.data).slice(0, 120));

    const hb = (slot) => call("POST", "/api/accounts/session/heartbeat", { account: acc, authToken: auth, clientId: "c1", slot });

    console.log("=== 驗證 ===");
    check("no token -> 401", (await call("GET", "/api/gm/overview")).status === 401);
    check("bad token -> 401", (await call("GET", "/api/gm/overview", null, "wrong-token-123456")).status === 401);
    const ov = await gmGet("/api/gm/overview");
    check("overview file mode", ov.data.ok && ov.data.storage === "file" && ov.data.counts.accounts >= 1, JSON.stringify(ov.data.counts));

    console.log("=== 查詢 ===");
    const sr = await gmGet("/api/gm/search?q=gmtest");
    check("search account", (sr.data.accounts || []).some((a) => a.account === acc));
    const sr2 = await gmGet("/api/gm/search?q=" + encodeURIComponent("測試"));
    check("search char name", (sr2.data.chars || []).some((c) => c.name === "測試員"));
    const on = await gmGet("/api/gm/online");
    const onRow = (on.data.online || []).find((a) => a.account === acc);
    check("online list", !!onRow && onRow.chars.some((c) => c.name === "測試員"), JSON.stringify(onRow || {}).slice(0, 120));
    const det = await gmGet("/api/gm/account?account=" + acc);
    check("account detail", det.data.ok && det.data.slots.length === 1 && det.data.slots[0].clsName === "騎士");
    const inv = await gmGet("/api/gm/inventory?account=" + acc + "&slot=1");
    const gl = (inv.data.eq || []).find((e) => e.slot === "gloves");
    check("inventory gloves shown", !!gl && !gl.empty, gl && gl.name);
    check("inventory class name", inv.data.summary && inv.data.summary.clsName === "騎士");
    check("items list", ((await gmGet("/api/gm/items")).data.items || []).length > 100);

    console.log("=== GM 信箱 ===");
    const g1 = await gmPost("/api/gm/grant", { account: acc, slot: 1, kind: "item", itemId: useId, cnt: 3, note: "補償" });
    const g2 = await gmPost("/api/gm/grant", { account: acc, slot: 1, kind: "gold", amount: 500 });
    const g3 = await gmPost("/api/gm/grant", { account: acc, kind: "item", itemId: useId, cnt: 1 });
    check("grant item/gold", g1.data.ok && g2.data.ok && g3.data.ok);
    check("grant unknown item rejected", (await gmPost("/api/gm/grant", { account: acc, kind: "item", itemId: "no_such_item_x" })).status === 400);
    check("grant unknown account 404", (await gmPost("/api/gm/grant", { account: "nobody999", kind: "gold", amount: 1 })).status === 404);
    check("cancel pending", (await gmPost("/api/gm/grant/cancel", { id: g3.data.id })).data.ok);
    check("cancel twice -> 409", (await gmPost("/api/gm/grant/cancel", { id: g3.data.id })).status === 409);
    let h = await hb(1);
    check("heartbeat gmMail=2", h.data.gmMail === 2, "gmMail=" + h.data.gmMail);
    check("heartbeat other slot gmMail=0", (await hb(2)).data.gmMail === 0);
    const cl = await call("POST", "/api/gm/mail/claim", { account: acc, authToken: auth, slot: 1 });
    check("claim items", cl.data.ok && cl.data.items.length === 1 && cl.data.items[0].cnt === 3, JSON.stringify(cl.data).slice(0, 160));
    check("claim gold -> wallet", cl.data.gold === 500 && cl.data.goldAfter === 600 && cl.data.walletRev >= 1);
    check("heartbeat gmMail=0 after claim", (await hb(1)).data.gmMail === 0);
    const det2 = await gmGet("/api/gm/account?account=" + acc);
    check("detail grants status", det2.data.grants.length === 3 && det2.data.grants.filter((g) => g.claimedAt).length === 2 && det2.data.grants.filter((g) => g.cancelledAt).length === 1);

    console.log("=== 倍率 ===");
    check("rates set", (await gmPost("/api/gm/rates", { expMult: 2, goldMult: 1.5, dropMult: 1, label: "測試活動" })).data.ok);
    h = await hb(1);
    check("heartbeat sees rates", h.data.rates && h.data.rates.expMult === 2 && h.data.rates.rateLabel === "測試活動");
    check("rates reset", (await gmPost("/api/gm/rates", { reset: true })).data.ok);
    check("heartbeat rates back", (await hb(1)).data.rates.expMult === 1);

    console.log("=== 踢線／封鎖 ===");
    check("kick", (await gmPost("/api/gm/kick", { account: acc })).data.ok);
    check("heartbeat after kick -> 401", (await hb(1)).status === 401);
    login = await call("POST", "/api/accounts/login", { account: acc, password: pw, clientId: "c1" });
    auth = login.data.authToken;
    check("relogin after kick", login.data.ok);
    check("ban 1h", (await gmPost("/api/gm/ban", { account: acc, hours: 1, reason: "測試" })).data.ok);
    check("heartbeat after ban rejected", (await hb(1)).status >= 400);
    login = await call("POST", "/api/accounts/login", { account: acc, password: pw, clientId: "c1" });
    check("login banned -> 403", login.status === 403 && login.data.error === "banned");
    check("overview banned=1", (await gmGet("/api/gm/overview")).data.counts.banned === 1);
    check("unban", (await gmPost("/api/gm/unban", { account: acc })).data.ok);
    login = await call("POST", "/api/accounts/login", { account: acc, password: pw, clientId: "c1" });
    check("login after unban", login.data.ok);

    console.log("=== 操作紀錄 ===");
    const au = await gmGet("/api/gm/audit?limit=50");
    const acts = (au.data.rows || []).map((r) => r.action);
    for (const a of ["grant_item", "grant_gold", "grant_cancel", "rates_set", "rates_reset", "kick", "ban", "unban"]) {
      check("audit has " + a, acts.indexOf(a) >= 0);
    }
  } catch (e) {
    check("exception", false, e && e.stack ? e.stack : String(e));
  } finally {
    srv.kill();
    try {
      fs.rmSync(DIR, { recursive: true, force: true });
    } catch (e) {}
  }
  console.log("\nRESULT: " + (fails ? "FAIL (" + fails + ")" : "PASS"));
  process.exit(fails ? 1 : 0);
})();

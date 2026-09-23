"use strict";
/**
 * 🌐 H｜P5 部署驗收清單
 * 用法：
 *   node tools/_p5-deploy-check.js           # 離線斷言＋印清單
 *   SMOKE_HTTP=1 node tools/_p5-deploy-check.js   # 另探測本機 /api/econ/status
 *   BASE=https://your.host SMOKE_HTTP=1 node tools/_p5-deploy-check.js
 */
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const BASE = String(process.env.BASE || ("http://127.0.0.1:" + (process.env.PORT || "3000"))).replace(/\/$/, "");

console.log("══════════════════════════════════════");
console.log(" P5 部署驗收清單（手動＋自動）");
console.log("══════════════════════════════════════");
console.log("");
console.log("【環境】");
console.log("  □ DATABASE_URL 或 POSTGRES_URL 已設定");
console.log("  □ 未設 ECON_AUTH=0／false／off（有 DB 時預設開）");
console.log("  □ 伺服器行程已啟動，可達 " + BASE);
console.log("");
console.log("【帳號】");
console.log("  □ 非 guest 帳號已登入（有 authToken／session）");
console.log("  □ 角色已至少存檔一次（雲端 slot 存在）");
console.log("");
console.log("【閉環操作】（登入後於遊戲內各做一次；或用帳密跑 live 腳本）");
console.log("  □ GET  /api/econ/status → ok:true, econAuth:true, p5a/p5b/p5c");
console.log("  □ GET  /api/wallet → 金幣與畫面一致");
console.log("  □ POST /api/shop/buy  買 1 張瞬間移動卷軸 → 雲端扣金、背包＋1");
console.log("  □ POST /api/shop/sell 賣 1 件非 nosell → 入帳≈價×30%（祝福×10）");
console.log("  □ POST /api/warehouse/move dir=in kind=gold → 背包金幣減、倉庫金幣加");
console.log("  □ POST /api/warehouse/move dir=out kind=gold → 還原");
console.log("  □ POST /api/warehouse/move dir=in kind=item → 背包物進倉（不可自由 PUT shared/warehouse）");
console.log("  □ POST /api/econ/sink kind=obel_track → 扣 10 萬（白名單）");
console.log("  □ POST /api/pandora/draw qty=1 → 扣 10 萬（或 clientDebit）、無卡片");
console.log("  □ 故意併發兩次購買：應出現 conflict 提示並可重試成功");
console.log("  □ 自動化：npm run test:live   （或 SMOKE_ACCOUNT=… SMOKE_PASSWORD=… node tools/_j-live-smoke.js）");
console.log("  □ 回歸閘門：npm run test:gate:p5   （編碼／HUD／VFX／P5 離線；CI 已掛 Regression Gate）");
console.log("");
console.log("【回歸】");
console.log("  □ 自動瞬移逃 BOSS＝短距＋日誌「短暫退避」");
console.log("  □ 手動傳送＝遠距、不貼海／牆、落地約 2 秒不受傷");
console.log("  □ 抽抽樂：連線徽章／金幣不足禁用／十連浮層／最近抽紀錄");
console.log("  □ 倉庫：econAuth 開啟時存／領走 API；直接 PUT /shared/warehouse* → 403");
console.log("  □ Sprint3 sink：追蹤／精靈轉換／船資／城戰／精通／金幣解咒走 /api/econ/sink");
console.log("  □ bump 後可 GATE=1 node tools/_bump-version.js 強制跑閘門");
console.log("");

let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log("  OK  ", name, detail || "");
  else {
    failed++;
    console.log("  FAIL", name, detail || "");
  }
}

console.log("── 自動：離線煙測（_smoke-p5-econ）──");
{
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools/_smoke-p5-econ.js")], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  ok("smoke-p5-econ exit 0", r.status === 0, "status=" + r.status);
}

console.log("── 自動：傳送落地／短無敵源碼──");
{
  const core = fs.readFileSync(path.join(ROOT, "js/03-combat-core.js"), "utf8");
  const tp = fs.readFileSync(path.join(ROOT, "js/02-stats-recompute.js"), "utf8");
  const ex = fs.readFileSync(path.join(ROOT, "js/44-map-explore.js"), "utf8");
  const atk = fs.readFileSync(path.join(ROOT, "js/04-combat-attack.js"), "utf8");
  ok("inTpSafe / grantTpSafe", /function inTpSafe/.test(core) && /function grantTpSafe/.test(core));
  ok("doTeleport grants safe + clears target", /grantTpSafe\(20\)/.test(tp) && /targetIdx = -1/.test(tp));
  ok("escape log", /短暫退避/.test(tp));
  ok("sea/border pad in teleport", /seaY/.test(ex) && /border/.test(ex));
  ok("phys/magic gate inTpSafe", /inTpSafe\(\)/.test(atk));
}

console.log("── 自動：抽抽樂 UX 源碼──");
{
  const gacha = fs.readFileSync(path.join(ROOT, "js/14-craft-pandora.js"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "css/style.css"), "utf8");
  ok("pandoraOnDrawComplete / recent / overlay", /function pandoraOnDrawComplete/.test(gacha) && /pandoraShowDrawOverlay/.test(gacha) && /pandoraRenderRecentHTML/.test(gacha));
  ok("gold afford gate", /約可單抽/.test(gacha) && /pandora-draw-btn-disabled/.test(gacha));
  ok("link badge", /pandoraGachaStatusBadgeHTML/.test(gacha) && /pandora-gacha-badge/.test(css));
  ok("overlay css", /pandora-draw-overlay/.test(css));
}

console.log("── 自動：P5c 倉庫權威源碼──");
{
  const wh = fs.readFileSync(path.join(ROOT, "lib/rt-warehouse.js"), "utf8");
  const api = fs.readFileSync(path.join(ROOT, "lib/rt-wallet-shop-api.js"), "utf8");
  const npc = fs.readFileSync(path.join(ROOT, "js/12-npc-quests.js"), "utf8");
  ok("rt-warehouse warehouseMove", /function warehouseMove/.test(wh) || /async function warehouseMove/.test(wh));
  ok("API p5c + move", /p5c:\s*true/.test(api) && /\/api\/warehouse\/move/.test(api));
  ok("client hooks", /rtWarehouseMoveSecure/.test(npc) && /whDepositLocal/.test(npc));
}

console.log("── 自動：K 回歸閘門（編碼＋HUD＋VFX）──");
{
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools/_regression-gate.js")], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  ok("regression-gate exit 0", r.status === 0, "status=" + r.status);
}

console.log("── 可選 HTTP／閉環：" + BASE + " ──");
async function httpProbe() {
  if (process.env.SMOKE_HTTP !== "1") {
    console.log("  SKIP（設 SMOKE_HTTP=1 探測 " + BASE + "；加帳密跑 _smoke-p5-live）");
    return;
  }
  try {
    const res = await fetch(BASE + "/api/econ/status", { cache: "no-store" });
    const j = await res.json();
    ok("econ status HTTP " + res.status, res.ok && j && j.ok, JSON.stringify(j));
    ok("econAuth true（部署應為 true）", !!(j && j.econAuth), JSON.stringify(j));
    ok("p5a && p5b && p5c", !!(j && j.p5a && j.p5b && j.p5c), JSON.stringify(j));
    if (j && j.ok && !j.econAuth) {
      console.log("  NOTE  econAuth=false：檢查 DATABASE_URL 或 ECON_AUTH 環境變數");
    }
  } catch (e) {
    ok("econ status reachable", false, String(e.message || e));
  }
  console.log("── 自動：_smoke-p5-live（帳密可選）──");
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools/_smoke-p5-live.js")], {
    cwd: ROOT,
    encoding: "utf8",
    env: Object.assign({}, process.env, { SMOKE_HTTP: "1", BASE }),
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  ok("smoke-p5-live exit 0", r.status === 0, "status=" + r.status);
}

httpProbe().then(() => {
  console.log("");
  console.log(failed ? "RESULT: FAIL (" + failed + ")" : "RESULT: PASS（其餘請依上方 □ 手動勾）");
  process.exit(failed ? 1 : 0);
});

"use strict";
/**
 * 🌐 J｜正式環境 live 煙測包裝
 *
 * 用法：
 *   node tools/_j-live-smoke.js
 *   BASE=https://idle-aden.vercel.app node tools/_j-live-smoke.js
 *   BASE=https://host SMOKE_ACCOUNT=… SMOKE_PASSWORD=… node tools/_j-live-smoke.js
 *
 * 預設依序探測候補 BASE，選第一個 /api/econ/status 可用者；
 * 皆不可用則印清單並 exit 2（離線驗收請改跑 _p5-deploy-check／_regression-gate）。
 */
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const CANDIDATES = [
  process.env.BASE,
  process.env.RENDER_URL,
  "https://idle-aden.onrender.com",
  "https://idle-aden.vercel.app",
  "http://127.0.0.1:" + (process.env.PORT || "3000"),
].filter(Boolean);

async function probe(base) {
  const url = String(base).replace(/\/$/, "") + "/api/econ/status";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    return { base: String(base).replace(/\/$/, ""), status: res.status, data, ok: !!(res.ok && data && data.ok) };
  } catch (e) {
    return { base: String(base).replace(/\/$/, ""), status: 0, data: null, ok: false, err: String(e.message || e) };
  }
}

async function main() {
  console.log("══════════════════════════════════════");
  console.log(" J｜P5 live 探測");
  console.log("══════════════════════════════════════");
  const seen = new Set();
  const results = [];
  for (const b of CANDIDATES) {
    const key = String(b).replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    process.stdout.write("  probe " + key + " … ");
    const r = await probe(key);
    results.push(r);
    if (r.ok) {
      console.log("OK", JSON.stringify(r.data));
    } else {
      console.log("FAIL", r.status || r.err || "no-response", r.data ? JSON.stringify(r.data) : "");
    }
  }

  const hit = results.find((r) => r.ok);
  if (!hit) {
    console.log("\n  無可用 /api/econ/status。");
    console.log("  常見原因：Render 休眠／暫停、Vercel 尚未部署含 P5 的版本、本機未開伺服器。");
    console.log("  離線請跑：node tools/_p5-deploy-check.js");
    console.log("  回歸閘門：node tools/_regression-gate.js");
    console.log("\nRESULT: SKIP-LIVE (exit 2)");
    process.exit(2);
  }

  console.log("\n  選用 BASE=" + hit.base);
  if (hit.data && hit.data.econAuth === false) {
    console.log("  NOTE econAuth=false → 閉環買／賣／倉會 503（需 DATABASE_URL）");
  }

  const env = Object.assign({}, process.env, {
    SMOKE_HTTP: "1",
    BASE: hit.base,
  });
  console.log("\n── 轉呼 _smoke-p5-live ──");
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools/_smoke-p5-live.js")], {
    cwd: ROOT,
    encoding: "utf8",
    env,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  process.exit(r.status == null ? 1 : r.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

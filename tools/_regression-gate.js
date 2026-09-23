"use strict";
/**
 * 🌐 K｜回歸閘門：編碼＋combat-hud＋VFX／八方（＋可選 P5 離線）
 *
 * 用法：
 *   node tools/_regression-gate.js
 *   GATE_P5=1 node tools/_regression-gate.js          # 另跑 _smoke-p5-econ
 *   GATE_STRICT=1 node tools/_regression-gate.js      # 亂碼掃描 hits>0 也失敗（預設同）
 *
 * 建議：每次大改／bump 前跑；CI 可 npm run test:gate
 */
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
let failed = 0;

function run(name, rel, extraEnv) {
  console.log("\n══════════════════════════════════════");
  console.log(" ▶", name);
  console.log("══════════════════════════════════════");
  const r = spawnSync(process.execPath, [path.join(ROOT, rel)], {
    cwd: ROOT,
    encoding: "utf8",
    env: Object.assign({}, process.env, extraEnv || {}),
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    failed++;
    console.log("  ✖ FAIL", name, "exit=" + r.status);
  } else {
    console.log("  ✔ PASS", name);
  }
  return r.status === 0;
}

console.log("K｜回歸閘門");
console.log("cwd=", ROOT);

run("登入／關鍵字編碼", "tools/_verify-login-enc.js");
run("UI 亂碼掃描", "tools/_scan-ui-mojibake.js");
run("戰鬥 HUD／VFX 節點", "tools/_verify-combat-hud.js");
run("VFX 座標＋八方", "tools/_check-vfx-8dir.js");

if (
  process.env.GATE_P5 === "1" ||
  process.env.GATE_P5 === "true" ||
  process.argv.includes("--p5")
) {
  run("P5 離線經濟煙測", "tools/_smoke-p5-econ.js");
}

console.log("\n══════════════════════════════════════");
if (failed) {
  console.log(" RESULT: FAIL (" + failed + " suites)");
  process.exit(1);
}
console.log(" RESULT: PASS");
process.exit(0);

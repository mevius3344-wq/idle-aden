"use strict";
/**
 * 安全改版本號（UTF-8）：勿再用 PowerShell Get-Content|Set-Content 改含中文檔。
 *
 * 用法：
 *   node tools/_bump-version.js 3.8.504
 *   node tools/_bump-version.js          # 自動 +1 末段
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILES = [
  "js/00-data.js",
  "index.html",
  // 其他常夾 ?v= 的檔可再加
];

function readUtf8(p) {
  let buf = fs.readFileSync(p);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) buf = buf.slice(3);
  return buf.toString("utf8");
}

function writeUtf8(p, s) {
  // 不寫 BOM；LF 維持檔案原換行
  fs.writeFileSync(p, s, { encoding: "utf8" });
}

function currentVer() {
  const s = readUtf8(path.join(ROOT, "js/00-data.js"));
  const m = s.match(/GAME_VERSION\s*=\s*'([^']+)'/);
  if (!m) throw new Error("GAME_VERSION not found");
  return m[1];
}

function bump(ver) {
  const m = String(ver).match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error("bad ver " + ver);
  let a = +m[1],
    b = +m[2],
    c = +m[3] + 1;
  if (c >= 100) {
    b += 1;
    c = 0;
  }
  return "v" + a + "." + b + "." + c;
}

const arg = process.argv[2];
const from = currentVer();
const to = arg ? (String(arg).startsWith("v") ? arg : "v" + arg) : bump(from);

console.log(from, "->", to);

for (const rel of FILES) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  let s = readUtf8(p);
  const before = s;
  s = s.replace(/GAME_VERSION\s*=\s*'[^']+'/g, "GAME_VERSION = '" + to + "'");
  s = s.replace(/\?v=v3\.\d+\.\d+/g, "?v=" + to);
  s = s.replace(/v3\.\d+\.\d+/g, (m) => {
    // only replace version-like tokens that were the old from, or all v3.x.y in index cache bust
    if (rel === "index.html") return to;
    return m === from ? to : m;
  });
  // Safer index: only ?v= and meta content
  if (rel === "index.html") {
    s = before
      .replace(/\?v=v3\.\d+\.\d+/g, "?v=" + to)
      .replace(/(content=["'])v3\.\d+\.\d+(["'])/g, "$1" + to + "$2")
      .replace(/(GAME_VERSION\s*=\s*')[^']+(')/g, "$1" + to + "$2");
  }
  if (s !== before) {
    writeUtf8(p, s);
    console.log("updated", rel);
  } else {
    console.log("no change", rel);
  }
}

console.log("done");

// 🌐 K：GATE=1 時 bump 後自動跑回歸閘門
if (process.env.GATE === "1" || process.env.GATE === "true" || process.argv.includes("--gate")) {
  const { spawnSync } = require("child_process");
  console.log("\n── GATE=1 → _regression-gate --p5 ──");
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools/_regression-gate.js"), "--p5"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

"use strict";
/**
 * 掃描使用者可見亂碼：中文夾 ?、壞掉 HTML 屬性、U+FFFD
 * 忽略：tools 腳本、正規式、HTML 註解內的說明文字
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SKIP_DIR = new Set(["node_modules", ".git", "assets", "data", "天堂玩家資料", "tools"]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(js|html|css)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

function stripComments(line, file) {
  if (/\.html$/i.test(file)) {
    return line.replace(/<!--[\s\S]*?-->/g, "").replace(/<!--.*$/g, "");
  }
  if (/\.js$/i.test(file)) {
    return line.replace(/\/\/.*$/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  }
  if (/\.css$/i.test(file)) {
    return line.replace(/\/\*[\s\S]*?\*\//g, "");
  }
  return line;
}

function isSuspect(raw, file) {
  const line = stripComments(raw, file);
  if (!line.trim()) return false;
  if (/\uFFFD/.test(line)) return true;
  // regex false positives
  if (/\(\?:/.test(line) || /\[\^/.test(line)) return false;
  // intentional unknown-name placeholder (世界頻道)
  if (/return\s+'<span[^>]*>\?{3}<\/span>'/.test(line)) return false;
  if (/>\?{3}</.test(line) && /wc-name|unknown|placeholder/i.test(line)) return false;
  if (/placeholder="[^"]*\?\s*value=/.test(line)) return true;
  if (/\?\?\/[a-zA-Z]+>/.test(line)) return true;
  // visible CJK broken by ?
  if (/[\u4e00-\u9fff]\?|\?[\u4e00-\u9fff]/.test(line)) return true;
  // login-like broken labels (but not intentional ???)
  if (/>\?{1,6}</.test(line) && !/>\?{3}</.test(line) && /<(button|label|span|h1|h2|p|div)\b/i.test(line)) return true;
  return false;
}

const hits = [];
for (const f of walk(ROOT)) {
  const lines = fs.readFileSync(f, "utf8").split(/\n/);
  const bad = [];
  for (let i = 0; i < lines.length; i++) {
    if (isSuspect(lines[i], f)) bad.push({ line: i + 1, text: lines[i].trim().slice(0, 140) });
  }
  if (bad.length) hits.push({ file: path.relative(ROOT, f), count: bad.length, sample: bad.slice(0, 10) });
}
hits.sort((a, b) => b.count - a.count);
console.log("suspect files", hits.length);
for (const h of hits) {
  console.log("---", h.file, "count=" + h.count);
  for (const s of h.sample) console.log("  L" + s.line, s.text);
}

// Login-specific assertions on index.html
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const asserts = [
  ["title 重生放置", html.includes("重生放置")],
  ["btn 登入", />登入</.test(html)],
  ["btn 註冊", />註冊</.test(html)],
  ["placeholder 帳號", html.includes('placeholder="請輸入帳號"')],
  ["placeholder 密碼", html.includes('placeholder="請輸入密碼"')],
  ["開始遊戲", html.includes("開始遊戲")],
  ["選擇角色", html.includes("選擇角色")],
  ["金幣 label", html.includes(">金幣<")],
  ["等級 label", html.includes(">等級<")],
  ["no broken ph", !/placeholder="[^"]*\?\s*value=/.test(html)],
  ["auth-login.js", html.includes("auth-login.js")],
  ["00-data.js", html.includes("00-data.js")],
  ["charset UTF-8", /charset\s*=\s*"?UTF-8/i.test(html)],
];
let fail = 0;
console.log("\n=== login assertions ===");
for (const [n, ok] of asserts) {
  console.log(ok ? "  OK " : "  FAIL", n);
  if (!ok) fail++;
}

// Critical game strings in 00-data.js
const data = fs.readFileSync(path.join(ROOT, "js", "00-data.js"), "utf8");
const dataAsserts = [
  ["GAME_TITLE 重生放置", data.includes("重生放置")],
  ["scroll_teleport 瞬間移動卷軸", data.includes("瞬間移動卷軸")],
  ["00-data no FFFD", !/\uFFFD/.test(data)],
  ["GAME_VERSION present", /GAME_VERSION\s*=\s*'v[\d.]+'/.test(data)],
];
console.log("\n=== 00-data assertions ===");
for (const [n, ok] of dataAsserts) {
  console.log(ok ? "  OK " : "  FAIL", n);
  if (!ok) fail++;
}

if (hits.length || fail) {
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");

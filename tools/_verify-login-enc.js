"use strict";
/** 快速驗證登入相關可見字串編碼（不靠 PowerShell） */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

function check(name, ok) {
  console.log(ok ? "OK " : "FAIL", name);
  return ok;
}

let pass = true;
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const data = fs.readFileSync(path.join(ROOT, "js", "00-data.js"), "utf8");
const boot = fs.readFileSync(path.join(ROOT, "js", "00-boot-game.js"), "utf8");

const checks = [
  ["index title", html.includes("<title>躺著變強</title>")],
  ["index game-title", /account-auth-game-title[^>]*>躺著變強</.test(html)],
  ["index tagline", html.includes("登入帳號 · 開始冒險")],
  ["index 登入 btn", />登入</.test(html)],
  ["index 註冊 btn", />註冊</.test(html)],
  ["index ph 帳號", html.includes('placeholder="請輸入帳號"')],
  ["index ph 密碼", html.includes('placeholder="請輸入密碼"')],
  ["index status", html.includes("請輸入帳號與密碼")],
  ["index charset", /charset\s*=\s*"?UTF-8/i.test(html)],
  ["index no FFFD", !/\uFFFD/.test(html)],
  ["index no ?中文", !/[\u4e00-\u9fff]\?|\?[\u4e00-\u9fff]/.test(html)],
  ["data GAME_TITLE", data.includes("GAME_TITLE = '躺著變強'")],
  ["data version", /GAME_VERSION = 'v\d+\.\d+\.\d+'/.test(data)],
  ["data no FFFD", !/\uFFFD/.test(data)],
  ["boot no FFFD", !/\uFFFD/.test(boot)],
];

for (const [n, ok] of checks) {
  if (!check(n, ok)) pass = false;
}

// auth-login visible strings
const authPath = path.join(ROOT, "js", "auth-login.js");
if (fs.existsSync(authPath)) {
  const auth = fs.readFileSync(authPath, "utf8");
  if (!check("auth-login no FFFD", !/\uFFFD/.test(auth))) pass = false;
  if (!check("auth-login has 登入", /登入/.test(auth))) pass = false;
}

console.log(pass ? "\nVERIFY PASS" : "\nVERIFY FAIL");
process.exit(pass ? 0 : 1);

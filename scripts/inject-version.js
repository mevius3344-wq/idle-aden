"use strict";
// Vercel 建置時注入版本號到 index.html
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dataJs = fs.readFileSync(path.join(root, "js", "00-data.js"), "utf8");
const m = dataJs.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
const ver = m ? m[1] : "v0.0.0";
const indexPath = path.join(root, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
html = html.replace(/__GAME_VERSION__/g, ver);
fs.writeFileSync(indexPath, html, "utf8");
console.log("inject-version: " + ver);

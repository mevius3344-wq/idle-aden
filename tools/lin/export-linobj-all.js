// 對所有已匯出的原版地圖（assets/linmap/*/meta.json）產生遮擋物件：node tools/lin/export-linobj-all.js [name ...]
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const DIR = path.join(__dirname, "..", "..", "assets", "linmap");
const only = process.argv.slice(2);
for (const name of fs.readdirSync(DIR)) {
  if (only.length && !only.includes(name)) continue;
  if (!fs.existsSync(path.join(DIR, name, "meta.json"))) continue;
  const out = execFileSync(process.execPath, ["--max-old-space-size=6144", path.join(__dirname, "export-linobj.js"), name], { encoding: "utf8", maxBuffer: 1 << 26 });
  console.log(out.trim().split("\n").pop());
}

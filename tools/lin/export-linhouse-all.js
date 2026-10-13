// 對所有已匯出的原版地圖產生「進屋收外殼」補圖，有房子的地圖再重跑遮擋物件（標記外殼）：node tools/lin/export-linhouse-all.js [name ...]
// 跑完要 node tools/lin/build-linmap-data.js 把房子數寫進 js/49-linmap-data.js
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const DIR = path.join(__dirname, "..", "..", "assets", "linmap");
const only = process.argv.slice(2);
const run = (script, name) => execFileSync(process.execPath, ["--max-old-space-size=6144", path.join(__dirname, script), name], { encoding: "utf8", maxBuffer: 1 << 26 }).trim().split("\n").pop();
for (const name of fs.readdirSync(DIR)) {
  if (only.length && !only.includes(name)) continue;
  const metaPath = path.join(DIR, name, "meta.json");
  if (!fs.existsSync(metaPath) || !fs.existsSync(path.join(DIR, name, "walk.bin"))) continue;
  const had = !!JSON.parse(fs.readFileSync(metaPath, "utf8")).houses;
  console.log(run("export-linhouse.js", name));
  const has = !!JSON.parse(fs.readFileSync(metaPath, "utf8")).houses;
  if (has || had) console.log(run("export-linobj.js", name));
}

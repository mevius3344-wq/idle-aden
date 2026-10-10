// 匯出全部原版村莊地圖區域（assets/linmap/tw_*）
// 用法：node tools/lin/build-towns.js [tw_giran ...] [--force]
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const CFG = require("./towns-config");

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith("--"));
const force = args.includes("--force");
for (const [name, c] of Object.entries(CFG)) {
  if (only.length && !only.includes(name)) continue;
  const meta = path.join(__dirname, "..", "..", "assets", "linmap", name, "meta.json");
  if (fs.existsSync(meta) && !force) { console.log("skip", name); continue; }
  const t0 = Date.now();
  const out = execFileSync(process.execPath, [path.join(__dirname, "export-linmap.js"), String(c.map), name, "72", "--around", [c.x, c.y, c.r].join(",")], { encoding: "utf8", maxBuffer: 1 << 26 });
  const last = out.trim().split("\n").pop();
  console.log(name, ((Date.now() - t0) / 1000).toFixed(0) + "s", last.slice(0, 160));
}

// 批次匯出野外／地監原版拼塊（tools/lin/fields-config.js）
// 用法：node tools/lin/export-fields.js [--force] [id ...]
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const CFG = require("./fields-config");

const force = process.argv.includes("--force");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const QUALITY = 60;
for (const [id, [lin, out, x, y, r]] of Object.entries(CFG)) {
  if (only.length && !only.includes(id)) continue;
  const meta = path.join(__dirname, "..", "..", "assets", "linmap", out, "meta.json");
  if (!force && fs.existsSync(meta)) { console.log("skip", id, out); continue; }
  const args = [path.join(__dirname, "export-linmap.js"), String(lin), out, String(QUALITY)];
  if (x) args.push("--around", `${x},${y},${r}`);
  console.log("export", id, lin, out, x ? `${x},${y},${r}` : "full");
  const res = execFileSync(process.execPath, args, { encoding: "utf8" });
  console.log(res.trim().split("\n").pop().slice(0, 160));
}

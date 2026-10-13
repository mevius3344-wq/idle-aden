// 原版伺服器地圖通行（l1j-en classic maps/<mapid>.txt，每格 bit0＝可往東 x+1、bit1＝可往北 y-1）→ walk.bin
//   客戶端 s32 兩個屬性是「邊」不是「格」：舊版只要任一邊是牆就整格不可走，房屋內部／門口全被封死。
//   這裡改用伺服器的邊界資料：walk.bin bit0＝可站（l1j isPassable：四邊任一可通）、bit1＝安全區（沿用客戶端）、
//   bit2＝東邊可通、bit3＝北邊可通、bit4＝有邊界資料（js/49-linmap.js linmapCanStep 依此判斷每一步）
// 用法：node tools/lin/l1j-walk.js <outName...>   （l1j 地圖放 %TEMP%/l1jmaps/<mapid>.txt，可用 L1JMAPS 指定資料夾）
const fs = require("fs");
const os = require("os");
const path = require("path");

const DIR = process.env.L1JMAPS || path.join(os.tmpdir(), "l1jmaps");

function loadL1jMap(mapId) {
  const file = path.join(DIR, mapId + ".txt");
  if (!fs.existsSync(file)) return null;
  const row = require("./l1jdb").rows("mapids").find((r) => +r.mapid === +mapId);
  if (!row) return null;
  const rows = fs.readFileSync(file, "latin1").trim().split(/\r?\n/).map((r) => r.split(",").map((v) => v | 0));
  const sx = +row.startX, sy = +row.startY;
  return (x, y) => { const r = rows[y - sy]; return r && x - sx >= 0 && x - sx < r.length ? r[x - sx] : 0; };
}

/** walk（Uint8Array nx*ny，原 bit0 可走／bit1 安全區）就地改成 l1j 邊界通行；回傳是否有套用 */
function applyL1jWalk(walk, meta) {
  const tile = loadL1jMap(meta.linMap);
  if (!tile) return false;
  const nx = meta.tiles.nx, ny = meta.tiles.ny;
  const X0 = (meta.tiles.bx0 - 0x7fff) * 64 + 0x7fff - 64;
  const Y0 = (meta.tiles.by0 - 0x7fff) * 64 + 0x7fff - 64;
  // 同 l1j L1V1Map.isInMap：本土西／北緣不在地圖內
  const out = (x, y) => +meta.linMap === 4 && (x < 32520 || y < 32070 || (y < 32190 && x < 33950));
  const T = (gx, gy) => {
    const x = X0 + gx, y = Y0 + gy, t = tile(x, y);
    return (t & 0x80) || out(x, y) ? 0 : t;
  };
  for (let gy = 0; gy < ny; gy++) {
    for (let gx = 0; gx < nx; gx++) {
      const t = T(gx, gy);
      const pass = (t & 3) || (T(gx - 1, gy) & 1) || (T(gx, gy + 1) & 2);
      const i = gy * nx + gx;
      walk[i] = (walk[i] & 2) | (pass ? 1 : 0) | (t & 1 ? 4 : 0) | (t & 2 ? 8 : 0) | 16;
    }
  }
  return true;
}

module.exports = { loadL1jMap, applyL1jWalk };

if (require.main === module) {
  const names = process.argv.slice(2);
  if (!names.length) { console.error("usage: node tools/lin/l1j-walk.js <outName...>"); process.exit(1); }
  for (const name of names) {
    const dir = path.join(__dirname, "..", "..", "assets", "linmap", name);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
    const walk = new Uint8Array(fs.readFileSync(path.join(dir, "walk.bin")));
    const before = walk.reduce((n, v) => n + (v & 1), 0);
    if (!applyL1jWalk(walk, meta)) { console.log(name, "no l1j map for", meta.linMap); continue; }
    fs.writeFileSync(path.join(dir, "walk.bin"), walk);
    console.log(name, "map", meta.linMap, "walkable", before, "->", walk.reduce((n, v) => n + (v & 1), 0));
  }
}

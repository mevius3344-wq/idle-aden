// 原版房屋「進屋收外殼」：每間房子匯出一張屋內補圖（底圖扣掉外殼群組重畫，只留外殼原本蓋住的像素）
// 用法：node tools/lin/export-linhouse.js <outName>   （需先有 export-linmap.js 產生的 meta.json／walk.bin；之後要重跑 export-linobj.js 標記外殼）
// 輸出：assets/linmap/<outName>/h_<id>.webp ＋ houses.json：[[ix, iy, w, h, [gx,gy, gx,gy, ...]], ...]（匯出圖座標／原版格）；meta.houses＝房子數
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const R = require("./render");
const H = require("./linhouse");

const outName = process.argv[2];
if (!outName) { console.error("usage: node tools/lin/export-linhouse.js <outName>"); process.exit(1); }
const outDir = path.join(__dirname, "..", "..", "assets", "linmap", outName);
const meta = JSON.parse(fs.readFileSync(path.join(outDir, "meta.json"), "utf8"));
const mapId = String(meta.linMap);
const nX = meta.tiles.nx / 64, nY = meta.tiles.ny / 64;
const minBx = meta.tiles.bx0, minBy = meta.tiles.by0;
const blocks = R.listBlocks(mapId).filter((b) => b.bx >= minBx && b.bx < minBx + nX && b.by >= minBy && b.by < minBy + nY);
const walk = fs.readFileSync(path.join(outDir, "walk.bin"));
const { houses } = H.detectHouses(mapId, meta, blocks, walk);

(async () => {
  for (const f of fs.readdirSync(outDir)) if (/^h_\d+\.webp$/.test(f) || f === "houses.json") fs.unlinkSync(path.join(outDir, f));
  const index = [];
  let bytes = 0;
  for (const h of houses) {
    const p = h.patch;
    const out = await sharp(Buffer.from(p.buf), { raw: { width: p.W, height: p.H, channels: 4 } }).webp({ quality: 82, alphaQuality: 100, effort: 5 }).toBuffer();
    fs.writeFileSync(path.join(outDir, "h_" + h.id + ".webp"), out);
    bytes += out.length;
    index.push([p.x0, p.y0, p.W, p.H, [].concat(...h.cells)]);
  }
  if (index.length) fs.writeFileSync(path.join(outDir, "houses.json"), JSON.stringify(index), "utf8");
  if (index.length) meta.houses = index.length;
  else delete meta.houses;
  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta), "utf8");
  console.log("done", outName, "houses", houses.length, (bytes / 1048576).toFixed(1) + "MB");
})();

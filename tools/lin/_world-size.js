// 偵錯：原版地圖區塊數／涵蓋範圍（評估整張大地圖輸出大小）
const R = require("./render");
for (const id of process.argv.slice(2)) {
  const b = R.listBlocks(id);
  const bx = b.map((q) => q.bx), by = b.map((q) => q.by);
  const x0 = Math.min(...bx), x1 = Math.max(...bx), y0 = Math.min(...by), y1 = Math.max(...by);
  const toLin = (v) => (v - 0x7fff) * 64 + 0x7fff - 64;
  console.log("map", id, "blocks", b.length, "bbox", (x1 - x0 + 1) + "x" + (y1 - y0 + 1),
    "lin x", toLin(x0), "-", toLin(x1) + 63, "y", toLin(y0), "-", toLin(y1) + 63);
}

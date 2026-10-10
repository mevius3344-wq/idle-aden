// 從天堂客戶端 Sprite*.pak 匯出樂園風 HUD 用的原版介面素材 → assets/ui/lin/
// .img 格式：w,h,flag(u16) + w*h RGB555 + 尾 u16 透明色鍵（flag=1 時有效）
// cornerKey：檔內沒標透明（flag=0）但底色是填色的，用左上角顏色當透明色
// hole：圓環中心半徑內改透明（讓按鈕底色透出來）
// 用法：node tools/lin/build-ui-kit.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { openPak } = require("./pak");

const OUT = path.join(__dirname, "..", "..", "assets", "ui", "lin");
const KIT = [
  { src: "1198", out: "stone.webp", crop: [20, 26, 22, 24], note: "暗色石紋底板（去黑邊）" },
  { src: "1200", out: "frame.png", note: "金色雕花框（中空）" },
  { src: "1116", out: "ring.png", cornerKey: true, hole: 10.5, note: "金色圓環（圓鈕外框，中心挖空）" },
];

const names = ["Sprite"].concat(Array.from({ length: 16 }, (_, i) => "Sprite" + String(i).padStart(2, "0")));
const paks = names.map((n) => { try { return openPak(n); } catch (e) { return null; } }).filter(Boolean);
const find = (n) => { for (const p of paks) { const b = p.read(n + ".img"); if (b) return b; } return null; };

function decode(b, cornerKey) {
  const w = b.readUInt16LE(0), h = b.readUInt16LE(2), flag = b.readUInt16LE(4);
  const keyOff = 6 + w * h * 2;
  let key = -1;
  if (cornerKey) key = b.readUInt16LE(6);
  else if (flag === 1 && b.length >= keyOff + 2) key = b.readUInt16LE(keyOff);
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = b.readUInt16LE(6 + i * 2);
    const r = (v >> 10) & 31, g = (v >> 5) & 31, bl = v & 31;
    px[i * 4] = (r << 3) | (r >> 2);
    px[i * 4 + 1] = (g << 3) | (g >> 2);
    px[i * 4 + 2] = (bl << 3) | (bl >> 2);
    px[i * 4 + 3] = v === key ? 0 : 255;
  }
  return { w, h, px };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const report = [];
  for (const k of KIT) {
    const b = find(k.src);
    if (!b) { report.push("MISSING " + k.src); continue; }
    const d = decode(b, k.cornerKey);
    if (k.hole) {
      const cx = (d.w - 1) / 2, cy = (d.h - 1) / 2;
      for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
        const r = Math.hypot(x - cx, y - cy);
        if (r <= k.hole) d.px[(y * d.w + x) * 4 + 3] = 0;
        else if (r <= k.hole + 1) d.px[(y * d.w + x) * 4 + 3] >>= 1;
      }
    }
    let img = sharp(d.px, { raw: { width: d.w, height: d.h, channels: 4 } });
    if (k.crop) {
      const [l, t, r, bt] = k.crop;
      img = sharp(await img.extract({ left: l, top: t, width: d.w - l - r, height: d.h - t - bt }).png().toBuffer());
    }
    const file = path.join(OUT, k.out);
    if (k.out.endsWith(".webp")) await img.webp({ quality: 90 }).toFile(file);
    else await img.png({ compressionLevel: 9 }).toFile(file);
    report.push(`${k.out} ← ${k.src}.img ${d.w}x${d.h} ${k.note}`);
  }
  console.log(report.join("\n"));
})();

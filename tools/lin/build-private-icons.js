// 私服道具自製圖示：tools/lin/icon-src/pi_base_*.jpg（純色底）→ assets/icons/private/<道具id>.png（64×64 透明）
// 去背：取四邊像素中位色當背景，色差門檻＋柔邊；變體：換液體色／寶石色＋右下角數字或字牌
// 用法：node tools/lin/build-private-icons.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(__dirname, "icon-src");
const OUT = path.join(ROOT, "assets", "icons", "private");
const SIZE = 64, WORK = 512;

function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** 讀底圖 → WORK×WORK RGBA，背景透明 */
async function keyed(name) {
  const { data, info } = await sharp(path.join(SRC, "pi_base_" + name + ".jpg")).resize(WORK, WORK).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const border = [];
  for (let i = 0; i < W; i++) for (const y of [0, 1, H - 2, H - 1]) border.push(y * W + i);
  for (let j = 0; j < H; j++) for (const x of [0, 1, W - 2, W - 1]) border.push(j * W + x);
  const med = [0, 1, 2].map((c) => border.map((p) => data[p * 3 + c]).sort((a, b) => a - b)[border.length >> 1]);
  const out = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    const r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2];
    const dist = Math.hypot(r - med[0], g - med[1], b - med[2]);
    let a = dist < 60 ? 0 : dist > 120 ? 255 : Math.round((dist - 60) / 60 * 255);
    let rr = r, gg = g, bb = b;
    if (a > 0 && a < 255) {
      // 去掉柔邊上的背景色溢色
      const k = a / 255;
      rr = Math.max(0, Math.min(255, (r - med[0] * (1 - k)) / k));
      gg = Math.max(0, Math.min(255, (g - med[1] * (1 - k)) / k));
      bb = Math.max(0, Math.min(255, (b - med[2] * (1 - k)) / k));
    }
    out[p * 4] = rr; out[p * 4 + 1] = gg; out[p * 4 + 2] = bb; out[p * 4 + 3] = a;
  }
  return { data: out, W, H };
}

/** 依條件改色（hueTo＝目標色相；sat＝飽和度；pick(h,s,v,x,y)） */
function recolor(img, pick, hueTo, sat) {
  const { data, W } = img;
  const d = Buffer.from(data);
  for (let p = 0; p < d.length / 4; p++) {
    if (d[p * 4 + 3] === 0) continue;
    const [h, s, v] = rgb2hsv(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]);
    if (!pick(h, s, v, p % W, (p / W) | 0)) continue;
    const [r, g, b] = hsv2rgb(hueTo, sat != null ? Math.max(s, sat) : s, v);
    d[p * 4] = r; d[p * 4 + 1] = g; d[p * 4 + 2] = b;
  }
  return { data: d, W: img.W, H: img.H };
}

async function toIcon(img) {
  const trimmed = await sharp(img.data, { raw: { width: img.W, height: img.H, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer();
  return sharp(trimmed).resize(SIZE - 4, SIZE - 4, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
    .extend({ top: 2, bottom: 2, left: 2, right: 2, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

/** 右下角字牌（數字或中文字） */
function badge(text, color) {
  const cjk = /[^\x00-\x7f]/.test(text);
  const fs_ = cjk ? 17 : (text.length >= 4 ? 13 : 15);
  const w = cjk ? 22 : Math.round(text.length * fs_ * 0.62) + 8;
  const h = cjk ? 22 : fs_ + 5;
  const x = SIZE - w - 1, y = SIZE - h - 1;
  const font = cjk ? "Microsoft JhengHei, PMingLiU, sans-serif" : "Arial Black, Arial, sans-serif";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="rgba(20,12,4,0.82)" stroke="#d8b25a" stroke-width="1.2"/>
  <text x="${x + w / 2}" y="${y + h / 2}" dy="0.36em" text-anchor="middle" font-family="${font}" font-weight="900" font-size="${fs_}" fill="${color || "#ffe9a8"}" stroke="#000" stroke-width="0.6" paint-order="stroke">${text}</text>
</svg>`);
}

async function write(id, iconBuf, label, color) {
  let s = sharp(iconBuf);
  if (label) s = s.composite([{ input: badge(label, color) }]);
  await s.png({ compressionLevel: 9 }).toFile(path.join(OUT, id + ".png"));
  return id;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const done = [];
  const isGold = (h, s, v) => h >= 28 && h <= 62 && s > 0.35 && v > 0.35;
  const potion = await keyed("potion");
  const EXP = [["potion_exp130", 120, "130%"], ["potion_exp150", 185, "150%"], ["potion_exp170", 215, "170%"], ["potion_exp200", 275, "200%"], ["potion_exp250", 20, "250%"], ["potion_exp300", 350, "300%"]];
  // 只換液體：瓶身中段（軟木塞在上方 30% 不動）
  for (const [id, hue, lab] of EXP) done.push(await write(id, await toIcon(recolor(potion, (h, s, v, x, y) => isGold(h, s, v) && y > WORK * 0.32, hue, 0.6)), lab));
  done.push(await write("potion_exp2", await toIcon(potion), "200%", "#fff4c0"));

  const town = await toIcon(await keyed("townscroll"));
  const TOWNS = [["scroll_town_talking", "說"], ["scroll_town_gludin", "古"], ["scroll_town_silver_knight", "銀"], ["scroll_town_gludio", "燃"], ["scroll_town_elf", "妖"], ["scroll_town_giran", "奇"], ["scroll_town_heine", "海"], ["scroll_town_oren", "歐"], ["scroll_town_witon", "威"], ["scroll_town_aden", "亞"]];
  for (const [id, ch] of TOWNS) done.push(await write(id, town, ch));

  const doll = await toIcon(await keyed("dollpick"));
  const TIER = ["二", "三", "四", "五", "六"];
  for (let i = 0; i < TIER.length; i++) done.push(await write("doll_pick_" + (i + 2), doll, TIER[i], "#f3d0ff"));

  for (const [id, name] of [["fn_home", "home"], ["fn_tele", "tele"], ["fn_auto", "auto"], ["fn_settings", "settings"], ["fn_drop", "drop"], ["item_newbie_embark", "newbie"]]) {
    done.push(await write(id, await toIcon(await keyed(name))));
  }

  const attr = await keyed("attr");
  // 中央白水晶（低飽和、高亮度，位於畫面中段）染成屬性色
  const inGem = (h, s, v, x, y) => s < 0.28 && v > 0.55 && x > WORK * 0.33 && x < WORK * 0.67 && y > WORK * 0.25 && y < WORK * 0.7;
  for (const [id, hue] of [["scroll_attr_fire", 8], ["scroll_attr_water", 210], ["scroll_attr_wind", 125], ["scroll_attr_earth", 32]]) {
    done.push(await write(id, await toIcon(recolor(attr, inGem, hue, 0.7))));
  }
  console.log("icons", done.length, "→ assets/icons/private/");
})();

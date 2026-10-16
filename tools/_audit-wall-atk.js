// 實測：原版地圖攻擊不可穿牆（鄰格隔牆＝距離 1 仍打不到）
// 用法：node tools/_audit-wall-atk.js
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let fails = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? "  ok   " : "  FAIL ") + name + (detail ? "  " + detail : ""));
  if (!cond) fails++;
};

console.log("=== 源碼：攻擊視線 ===");
const lin = fs.readFileSync(path.join(ROOT, "js/49-linmap.js"), "utf8");
const ex = fs.readFileSync(path.join(ROOT, "js/44-map-explore.js"), "utf8");
const atk = fs.readFileSync(path.join(ROOT, "js/04-combat-attack.js"), "utf8");
const cc = fs.readFileSync(path.join(ROOT, "js/03-combat-core.js"), "utf8");
ok("linmapAttackLos 存在且掛 window", /function linmapAttackLos\(name, gx0, gy0, gx1, gy1\)/.test(lin) && /global\.linmapAttackLos = linmapAttackLos/.test(lin));
ok("exploreMobCanHitPlayer 要視線", /exploreLinAttackLos\(mob\._fx/.test(ex) && /function exploreLinAttackLos\(/.test(ex));
ok("隔牆不站著空揮（繼續繞路）", /toPlayerT <= exploreLinMobRange\(m\) && exploreLinAttackLos\(/.test(ex));
ok("玩家普攻也查視線", /exploreLinAttackLos\(_px, _py, target\._fx/.test(atk));
ok("打中幀再查一次 canHit（躲牆後落空）", /_hitOk[\s\S]{0,120}exploreMobCanHitPlayer\(m\)/.test(cc));
ok("場戰魔法也要 canHit（不可牆後施法）", /_fieldMag[\s\S]{0,180}exploreMobCanHitPlayer\(m\)/.test(cc) && /!exploreMobCanHitPlayer\(m\)\) continue/.test(cc));
ok("掛機交戰站定要視線（隔牆繼續繞／換目標）", /hasLos[\s\S]{0,120}exploreLinAttackLos\(_tx, _ty/.test(ex) && /engaged = !!\(inRange && hasLos\)/.test(ex));
ok("掛機隔牆不來回走（貼牆快換／繞路 8 秒放棄／不站 stand-off）",
  /CHASE_WALL_GIVEUP_MS = 8000/.test(ex) &&
  /_chaseWallAdjSince > 700/.test(ex) &&
  /dist <= COMBAT_STAND_OFF && !\(linChase && !hasLos\)/.test(ex) &&
  /losPen = 180/.test(ex) &&
  /chaseMarkUnreach/.test(ex));
ok("視線斜向不可切角（linmapAttackStep）", /function linmapAttackStep\(/.test(lin) && /linmapAttackStep\(name, x, y, mx, my\)/.test(lin));

console.log("\n=== 離線：奇岩牆邊鄰格不可攻擊視線 ===");
// 與 js/49-linmap.js 的 linmapCanStep／linmapAttackLos 同邏輯（用 walk.bin 直接驗）
const vm = require("vm");
const box = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/49-linmap-data.js"), "utf8"), { window: box });
const L = box.LINMAP_DATA && box.LINMAP_DATA.wd_main;
const nx = L && L.nx, ny = L && L.ny, x0 = L && L.x0, y0 = L && L.y0;
ok("wd_main 地圖參數", nx > 0 && ny > 0, "nx=" + nx + " ny=" + ny + " x0=" + x0);
const w = fs.readFileSync(path.join(ROOT, "assets/linmap/wd_main/walk.bin"));
ok("walk.bin 長度對", w.length === nx * ny, w.length + " vs " + (nx * ny));

function cell(gx, gy) {
  if (gx < 0 || gy < 0 || gx >= nx || gy >= ny) return 0;
  return w[gy * nx + gx];
}
function canStep(gx, gy, sx, sy) {
  const c0 = cell(gx, gy);
  const cd = cell(gx + sx, gy + sy);
  if (!(cd & 1)) return false;
  if (!(c0 & 16) || !(c0 & 1)) {
    if (!(sx && sy)) return true;
    return (cell(gx + sx, gy) & 1) || (cell(gx, gy + sy) & 1);
  }
  const ex = (xx, yy, ssx) => (cell(ssx > 0 ? xx : xx - 1, yy) & 4) === 4;
  const nyb = (xx, yy, ssy) => (cell(xx, ssy < 0 ? yy : yy + 1) & 8) === 8;
  if (!sy) return ex(gx, gy, sx);
  if (!sx) return nyb(gx, gy, sy);
  return (ex(gx, gy, sx) && nyb(gx + sx, gy, sy)) || (nyb(gx, gy, sy) && ex(gx, gy + sy, sx));
}
function attackStep(gx, gy, sx, sy) {
  if (!sx && !sy) return false;
  if (!sx || !sy) return canStep(gx, gy, sx, sy);
  return canStep(gx, gy, sx, 0) && canStep(gx, gy, 0, sy);
}
function attackLos(ax, ay, bx, by) {
  if (ax === bx && ay === by) return false;
  let x = ax, y = ay;
  const adx = Math.abs(bx - ax), ady = Math.abs(by - ay);
  const ssx = ax < bx ? 1 : -1, ssy = ay < by ? 1 : -1;
  if (!adx) {
    while (y !== by) { if (!attackStep(x, y, 0, ssy)) return false; y += ssy; }
    return true;
  }
  if (!ady) {
    while (x !== bx) { if (!attackStep(x, y, ssx, 0)) return false; x += ssx; }
    return true;
  }
  let err = adx - ady, guard = adx + ady + 2;
  while ((x !== bx || y !== by) && guard-- > 0) {
    const e2 = err * 2;
    let mx = 0, my = 0;
    if (e2 > -ady) { err -= ady; mx = ssx; }
    if (e2 < adx) { err += adx; my = ssy; }
    if (!mx && !my) return false;
    if (!attackStep(x, y, mx, my)) return false;
    x += mx; y += my;
  }
  return x === bx && y === by;
}

let wall = 0, losBlocked = 0, openOk = 0;
const c0x = 33440 - x0, c0y = 32820 - y0;
const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
for (let y = c0y - 50; y <= c0y + 50; y++) {
  for (let x = c0x - 50; x <= c0x + 50; x++) {
    if (!(cell(x, y) & 1)) continue;
    for (const [dx, dy] of dirs) {
      if (!(cell(x + dx, y + dy) & 1)) continue;
      const stepOk = canStep(x, y, dx, dy);
      const los = attackLos(x, y, x + dx, y + dy);
      if (!stepOk) {
        wall++;
        if (!los) losBlocked++;
      } else if (los) openOk++;
    }
  }
}
ok("找到隔牆鄰格（兩邊可走、中間不可步）", wall >= 20, "wall=" + wall);
ok("隔牆鄰格攻擊視線全擋", wall > 0 && losBlocked === wall, losBlocked + "/" + wall);
ok("可走鄰格攻擊視線通", openOk >= 50, "open=" + openOk);

console.log(fails ? "\nFAIL " + fails : "\nALL PASS");
process.exit(fails ? 1 : 0);

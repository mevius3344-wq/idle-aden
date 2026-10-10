// 原版怪物動畫匯出：assets/anim/<怪名>/d0..d7/{idle,walk,attack,hurt,death}_N.png（與現有八向管線同格式）
// 用法：
//   node tools/lin/export-mob-spr.js --maps talking_island,zone_13,zone_14 [--dry] [--force]
//   node tools/lin/export-mob-spr.js 哥布林 妖魔 ...
// 畫布：同一隻怪所有方向／動作共用；水平以站立點置中；站立點下方保留 FOOT_PAD（js 以 translate 補回）
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { loadSpr } = require("./spr");
const { loadListSpr } = require("./listspr");

const ROOT = path.join(__dirname, "..", "..");
const FOOT_PAD = 32;
const ANCHOR_X = 24, ANCHOR_Y = 12;
const ACTIONS = [["walk", 0], ["attack", 1], ["hurt", 2], ["idle", 3], ["death", 8]];

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

function gameData() {
  const src = fs.readFileSync(path.join(ROOT, "js", "00-data.js"), "utf8");
  const a = src.indexOf("\n    mobs: {"), b = src.indexOf("\n    towns: {", a);
  const names = {};
  for (const m of src.slice(a, b).matchAll(/^\s*"?([\w\u4e00-\u9fff]+)"?\s*:\s*\{[^\n]*?\bn:\s*"([^"]+)"/gm)) names[m[1]] = m[2];
  const spawns = {};
  const mi = src.indexOf("\n    maps: {");
  for (const m of src.slice(mi).matchAll(/^\s*"([\w]+)":\s*\[([^\]]*)\]/gm)) spawns[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  return { names, spawns };
}

function targets(gfxMap) {
  const { names, spawns } = gameData();
  let list = args.filter((x) => !x.startsWith("--") && x !== opt("--maps"));
  const maps = opt("--maps");
  if (maps) for (const z of maps.split(",")) for (const k of spawns[z] || []) list.push(names[k] || k);
  if (flag("--all")) list = Object.keys(gfxMap);
  return [...new Set(list)];
}

// 無空手攻擊的怪（如妖魔弓箭手）改用持弓走路／攻擊
const BOW_ACT = { 0: 20, 1: 21 };

// 無普攻的施法怪用施法動作；無死亡（或死亡圖檔損毀）用受擊
const ALT_ACT = { 1: [18, 19, 30], 8: [2] };

function framesOf(entry, act, dir) {
  const bow = !entry.actions[1] && entry.actions[21] && BOW_ACT[act] != null;
  const main = framesOfAct(entry, bow ? BOW_ACT[act] : act, dir);
  if (main) return main;
  for (const alt of ALT_ACT[act] || []) {
    const fr = framesOfAct(entry, alt, dir);
    if (fr) return fr;
  }
  return null;
}

function framesOfAct(entry, act, dir) {
  const a = entry.actions[act];
  if (!a) return null;
  const out = [];
  let seq = a.frames;
  // 死亡動作開頭常掛一張不在原地的屍體幀（如 40.11 排在 40.0 前）
  if (act === 8 && seq.length > 2 && seq[0].img === seq[1].img && seq[0].frame > seq[1].frame) seq = seq.slice(1);
  for (const fr of seq) {
    const sub = fr.img + (a.dir ? dir : 0);
    const fs_ = loadSpr(entry.sprite, sub);
    const f = fs_ && fs_[fr.frame];
    if (f) out.push(f);
  }
  return out.length ? out : null;
}

function tightBox(f) {
  if (f._box !== undefined) return f._box;
  let x0 = f.w, y0 = f.h, x1 = -1, y1 = -1;
  const on = (x, y) => x >= 0 && y >= 0 && x < f.w && y < f.h && f.px[(y * f.w + x) * 4 + 3] !== 0;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    if (!on(x, y)) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && on(x + dx, y + dy)) n++;
    if (n < 2) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return (f._box = x1 < 0 ? null : { x0: f.x + x0, y0: f.y + y0, x1: f.x + x1 + 1, y1: f.y + y1 + 1 });
}

async function exportMob(name, gfx, list) {
  const entry = list.get(gfx);
  const seqs = {};
  let half = 0, top = 0;
  for (const [key, act] of ACTIONS) {
    for (let d = 0; d < 8; d++) {
      const fr = framesOf(entry, act, d);
      if (!fr) continue;
      (seqs[key] || (seqs[key] = []))[d] = fr;
      for (const f of fr) {
        const b = tightBox(f);
        if (!b) continue;
        half = Math.max(half, ANCHOR_X - b.x0, b.x1 - ANCHOR_X);
        top = Math.min(top, b.y0 - ANCHOR_Y);
      }
    }
  }
  if (!seqs.walk && !seqs.idle) return { ok: false, why: "no walk/idle" };
  if (!seqs.idle) seqs.idle = seqs.walk.map((fr) => fr && [fr[0]]);
  if (!seqs.walk) seqs.walk = seqs.idle;
  // 真地圖怪圖上限 寬184×高192（css）：超出部分（爆散粒子等）裁掉，避免整隻被縮小
  half = Math.min(half, 92);
  top = Math.max(top, -(192 - FOOT_PAD));
  const W = Math.ceil(half) * 2, H = -top + FOOT_PAD;
  const ax = W / 2, ay = -top;
  const dir = path.join(ROOT, "assets", "anim", name);
  let files = 0;
  for (let d = 0; d < 8; d++) {
    const dd = path.join(dir, "d" + d);
    fs.mkdirSync(dd, { recursive: true });
    for (const f of fs.readdirSync(dd)) if (/^(idle|walk|attack|hurt|death)_\d+\.png$/.test(f)) fs.unlinkSync(path.join(dd, f));
    for (const key of Object.keys(seqs)) {
      const fr = seqs[key][d] || seqs[key].find(Boolean);
      if (!fr) continue;
      for (let i = 0; i < fr.length; i++) {
        const f = fr[i];
        const left = Math.round(ax + f.x - ANCHOR_X), topPx = Math.round(ay + f.y - ANCHOR_Y);
        const ex = { left: Math.max(0, -left), top: Math.max(0, -topPx) };
        ex.width = Math.min(f.w - ex.left, W - Math.max(0, left));
        ex.height = Math.min(f.h - ex.top, H - Math.max(0, topPx));
        const comps = [];
        if (ex.width > 0 && ex.height > 0) {
          const piece = await sharp(f.px, { raw: { width: f.w, height: f.h, channels: 4 } }).extract(ex).png().toBuffer();
          comps.push({ input: piece, left: Math.max(0, left), top: Math.max(0, topPx) });
        }
        await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
          .composite(comps).png({ compressionLevel: 9 }).toFile(path.join(dd, `${key}_${i}.png`));
        files++;
      }
    }
  }
  return { ok: true, W, H, files, acts: Object.keys(seqs).map((k) => k + ":" + (seqs[k].find(Boolean) || []).length).join(" ") };
}

(async () => {
  const gfxMap = JSON.parse(fs.readFileSync(path.join(__dirname, "mob-gfx.json"), "utf8"));
  const list = loadListSpr();
  const done = [];
  for (const name of targets(gfxMap)) {
    const g = gfxMap[name];
    const has8 = fs.existsSync(path.join(ROOT, "assets", "anim", name, "d6"));
    const marker = path.join(ROOT, "assets", "anim", name, "d6", ".lin");
    const isOurs = fs.existsSync(marker);
    if (!g) { console.log("SKIP 無對照", name); continue; }
    if (has8 && !isOurs && !flag("--force")) { console.log("SKIP 已有八向", name); continue; }
    if (flag("--dry")) { console.log("WOULD", name, "gfx", g.gfx, g.sprName); continue; }
    let r;
    try { r = await exportMob(name, g.gfx, list); } catch (e) { r = { ok: false, why: String(e.message || e) }; }
    if (r.ok) {
      fs.writeFileSync(marker, String(g.gfx));
      done.push(name);
    }
    console.log(r.ok ? "OK  " : "FAIL", name, "gfx", g.gfx, JSON.stringify(r));
  }
  if (!flag("--dry")) {
    const regPath = path.join(ROOT, "js", "49-linmob-data.js");
    let prev = [];
    try { prev = JSON.parse(/LIN_SPR_MOBS = (\[.*\]);/.exec(fs.readFileSync(regPath, "utf8"))[1]); } catch (e) {}
    const all = [...new Set(prev.concat(done))].sort();
    fs.writeFileSync(regPath,
      "// 🤖 tools/lin/export-mob-spr.js 產生：使用原版 .spr 八向動畫的怪（站立點在畫布底上方 FOOT_PAD）\n" +
      "var LIN_SPR_FOOT_PAD = " + FOOT_PAD + ";\n" +
      "var LIN_SPR_MOBS = " + JSON.stringify(all) + ";\n", "utf8");
    console.log("registry", all.length);
  }
})();

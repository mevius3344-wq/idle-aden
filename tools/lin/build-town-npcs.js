// 原版村莊 NPC：位置／朝向／名稱（l1j spawnlist_npc）＋原版 .spr 待機動畫條
// 產出：assets/linnpc/<gfx>_<heading>.png（橫向幀條）、js/52-lintown-data.js
// 用法：node tools/lin/build-town-npcs.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const DB = require("./l1jdb");
const CFG = require("./towns-config");
const { readDesc } = require("./text");
const { loadSpr } = require("./spr");
const { loadListSpr } = require("./listspr");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "assets", "linnpc");
const FOOT_PAD = 32;
const ANCHOR_X = 24, ANCHOR_Y = 12;
const MAX_HALF = 120, MAX_TOP = 260;

const descC = readDesc("c").map((s) => (s || "").trim());
const descE = readDesc("e").map((s) => (s || "").trim().toLowerCase());
const eIdx = new Map();
descE.forEach((s, i) => { if (s && !eIdx.has(s)) eIdx.set(s, i); });
const cname = (en) => { const i = eIdx.get(String(en || "").toLowerCase()); return i != null ? descC[i] : ""; };

const npcs = new Map(DB.rows("npc").map((n) => [n.npcid, n]));
const spawns = DB.rows("spawnlist_npc");
const list = loadListSpr();

// 101＝影子 spr、105＝[件數, 服裝 spr...]（頭髮／上衣／褲／鞋，與本體同幀編號疊上）
function layerSprites(e) {
  const shadow = (e.attrs[101] || [])[0];
  const clothes = (e.attrs[105] || []).slice(1);
  return { under: shadow != null ? [shadow] : [], over: clothes };
}

function framesFor(gfx, h) {
  const e = list.get(gfx);
  if (!e) return null;
  const ly = layerSprites(e);
  for (const act of [3, 0]) {
    const a = e.actions[act];
    if (!a || !a.frames.length) continue;
    const seq = act === 3 ? a.frames : a.frames.slice(0, 1);
    const out = [];
    for (const fr of seq) {
      const sub = fr.img + (a.dir ? h : 0);
      const fs_ = loadSpr(e.sprite, sub);
      const f = fs_ && fs_[fr.frame];
      if (!f) continue;
      const layers = [];
      for (const id of ly.under) { const s = loadSpr(id, sub); if (s && s[fr.frame]) layers.push(s[fr.frame]); }
      layers.push(f);
      for (const id of ly.over) { const s = loadSpr(id, sub); if (s && s[fr.frame]) layers.push(s[fr.frame]); }
      out.push({ layers, dur: Math.max(1, fr.dur) });
    }
    if (out.length) return out;
  }
  return null;
}

const strips = {};
async function exportStrip(gfx, h) {
  const key = gfx + "_" + h;
  if (key in strips) return strips[key];
  let fr = null;
  try { fr = framesFor(gfx, h); } catch (e) { fr = null; }
  if (!fr) return (strips[key] = null);
  let half = 8, top = -8;
  for (const { layers } of fr) for (const f of layers) {
    half = Math.max(half, ANCHOR_X - f.x, f.x + f.w - ANCHOR_X);
    top = Math.min(top, f.y - ANCHOR_Y);
  }
  half = Math.min(Math.ceil(half), MAX_HALF);
  top = Math.max(top, -MAX_TOP);
  const W = half * 2, H = -top + FOOT_PAD;
  const comps = [];
  for (let i = 0; i < fr.length; i++) {
    for (const f of fr[i].layers) {
      const left = Math.round(half + f.x - ANCHOR_X), topPx = Math.round(-top + f.y - ANCHOR_Y);
      const ex = { left: Math.max(0, -left), top: Math.max(0, -topPx) };
      ex.width = Math.min(f.w - ex.left, W - Math.max(0, left));
      ex.height = Math.min(f.h - ex.top, H - Math.max(0, topPx));
      if (ex.width <= 0 || ex.height <= 0) continue;
      const piece = await sharp(f.px, { raw: { width: f.w, height: f.h, channels: 4 } }).extract(ex).png().toBuffer();
      comps.push({ input: piece, left: i * W + Math.max(0, left), top: Math.max(0, topPx) });
    }
  }
  if (!comps.length) return (strips[key] = null);
  await sharp({ create: { width: W * fr.length, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(comps).png({ compressionLevel: 9 }).toFile(path.join(OUT, key + ".png"));
  const ms = fr.reduce((a, x) => a + x.dur, 0) * 40;
  return (strips[key] = { w: W, h: H, n: fr.length, ms });
}

// 本遊戲村莊 NPC 名（js/00-data.js DB.towns）；配對規則同 js/52-lin-town.js nameMatch
const DATA_SRC = fs.readFileSync(path.join(ROOT, "js", "00-data.js"), "utf8");
function gameTownNames(tid) {
  const a = DATA_SRC.indexOf('"' + tid + '": {', DATA_SRC.indexOf("\n    towns: {"));
  if (a < 0) return [];
  const s = DATA_SRC.indexOf("npcs: [", a);
  let depth = 0, b = s;
  for (let i = s + 6; i < DATA_SRC.length; i++) {
    const ch = DATA_SRC[i];
    if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) { b = i; break; }
  }
  return [...DATA_SRC.slice(s, b).matchAll(/\bn:\s*"([^"]+)"/g)].map((m) => m[1]);
}
function nameMatch(a, b) {
  a = String(a || "").replace(/\s+/g, ""); b = String(b || "").replace(/\s+/g, "");
  if (!a || !b) return false;
  return a === b || (a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a)));
}
const starts = {};
// 整張大地圖（tools/lin/worlds-config.js）：該 map 的村莊座標改用大地圖
const WORLDS = require("./worlds-config");
function worldFolder(map) {
  for (const [n, w] of Object.entries(WORLDS)) {
    if (w.map === map && fs.existsSync(path.join(ROOT, "assets", "linmap", n, "meta.json"))) return n;
  }
  return null;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/^\d+_\d\.png$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const towns = {};
  for (const [name, c] of Object.entries(CFG)) {
    const folder = worldFolder(c.map) || name;
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "linmap", folder, "meta.json"), "utf8"));
    const nx = meta.tiles.nx, ny = meta.tiles.ny;
    const X0 = (meta.tiles.bx0 - 0x7fff) * 64 + 0x7fff - 64;
    const Y0 = (meta.tiles.by0 - 0x7fff) * 64 + 0x7fff - 64;
    const toWorld = (gx, gy) => {
      const px = (gx + gy) * 24 + meta.iso.ox, py = (gy - gx) * 12 + meta.iso.oy;
      return { x: Math.round(px - meta.w / 2), y: Math.round(meta.h / 2 - py) };
    };
    const out = [];
    for (const s of spawns) {
      if (s.mapid !== c.map) continue;
      const gx = s.locx - X0, gy = s.locy - Y0;
      if (gx < 1 || gy < 1 || gx >= nx - 1 || gy >= ny - 1) continue;
      if (Math.abs(s.locx - c.x) > c.r || Math.abs(s.locy - c.y) > c.r) continue;
      const n = npcs.get(s.npc_templateid);
      if (!n || !n.gfxid) continue;
      const h = ((Number(s.heading) || 0) % 8 + 8) % 8;
      const st = await exportStrip(n.gfxid, h);
      if (!st) continue;
      const full = cname(n.name);
      if ((!full || full === "-") && n.impl !== "L1FieldObject") continue;
      const parts = full.split("^");
      const w = toWorld(gx, gy);
      out.push({ x: w.x, y: w.y, lx: s.locx, ly: s.locy, s: n.gfxid + "_" + h, n: parts.length > 1 ? parts[1] : (full === "-" ? "" : full), t: parts.length > 1 ? parts[0] : "", en: n.name, k: n.impl.replace(/^L1/, "") });
    }
    out.sort((a, b) => b.y - a.y);
    towns[name] = out;
    // 村莊出生點：本遊戲 NPC 對到的原版站位重心 → 最近的可站格（安全區優先）
    const walk = fs.readFileSync(path.join(ROOT, "assets", "linmap", folder, "walk.bin"));
    const W = (gx, gy) => (gx >= 0 && gy >= 0 && gx < nx && gy < ny) ? walk[gy * nx + gx] : 0;
    const roomy = (gx, gy) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].every(([dx, dy]) => W(gx + dx, gy + dy) & 1);
    for (const tid of c.towns) {
      const names = gameTownNames(tid);
      const hits = [];
      for (const n of names) {
        const o = out.find((o) => o.n && nameMatch(o.n, n));
        if (o) hits.push(o);
      }
      let hx = c.x, hy = c.y;
      if (hits.length) {
        hx = hits.reduce((a, o) => a + o.lx, 0) / hits.length;
        hy = hits.reduce((a, o) => a + o.ly, 0) / hits.length;
      }
      let best = null, bd = Infinity;
      const gx0 = Math.round(hx) - X0, gy0 = Math.round(hy) - Y0, R = c.r + 8;
      for (let gy = Math.max(0, gy0 - R); gy < Math.min(ny, gy0 + R); gy++) for (let gx = Math.max(0, gx0 - R); gx < Math.min(nx, gx0 + R); gx++) {
        if (!roomy(gx, gy)) continue;
        const d = (X0 + gx - hx) ** 2 + (Y0 + gy - hy) ** 2 + ((W(gx, gy) & 2) ? 0 : 400);
        if (d < bd) { bd = d; best = [gx, gy]; }
      }
      if (best) starts[tid] = toWorld(best[0], best[1]);
      console.log("  start", tid, best ? (X0 + best[0]) + "," + (Y0 + best[1]) : "-", "from", hits.length + "/" + names.length);
    }
    console.log(name, out.length, out.filter((o) => o.n).slice(0, 12).map((o) => o.n).join(" "));
  }
  const used = {};
  for (const k of Object.keys(strips)) if (strips[k]) used[k] = strips[k];
  const js = "// 由 tools/lin/build-town-npcs.js 產生：原版村莊 NPC（世界座標／名稱／原版待機動畫條 assets/linnpc/<gfx>_<朝向>.png）\n"
    + "var LINTOWN_FOOT_PAD = " + FOOT_PAD + ";\n"
    + "var LINTOWN_SPR = " + JSON.stringify(used) + ";\n"
    + "var LINTOWN_NPCS = " + JSON.stringify(towns) + ";\n"
    + "var LINTOWN_START = " + JSON.stringify(starts) + ";\n";
  fs.writeFileSync(path.join(ROOT, "js", "52-lintown-data.js"), js, "utf8");
  const bytes = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
  console.log("strips", Object.keys(used).length, (bytes / 1048576).toFixed(1) + "MB", "data", (js.length / 1024).toFixed(0) + "KB");
})();

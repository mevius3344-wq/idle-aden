// 原版房屋偵測：客戶端把房子拆成「屋內」（地板／內牆／櫃台）＋「外殼」（屋頂＋前牆，一個高物件群組）。
// 屋內地板（平的低 layer 群組）在預設畫面幾乎整片被外殼蓋住 → 這組外殼＝房子，站在地板格上＝進屋，原版會把外殼收掉。
// 匯出座標同 export-linmap.js：區塊 (i,j) 原點 ox=(i+j)*1536+M, oy=(j-i)*768+offY+M+756。
const R = require("./render");
const { loadTil } = require("./til");

const M = 96;
const SHELL_MIN_TALL = 80;   // 外殼底座以上至少這麼高
const SHELL_MIN_PX = 3000;   // 外殼不透明像素下限（排除路燈、招牌）
const FLOOR_MAX_LAYER = 4;
const FLOOR_MIN_PX = 400;
const COVER_MIN = 0.8;       // 地板被外殼蓋住的比例
const SHELL_PART_MIN = 0.15; // 外殼由多組組成時，每組至少蓋住地板這麼多
const SHADOW_LAYER = 128;    // 屋頂投影等最後畫的群組（layer ≥ 128）跟著外殼收掉
const SHELL_MIN_OBJS = 40;   // 外殼拼塊數下限（樹／石柱只有幾塊，房屋屋頂上百塊）
const FLOOR_WALK_MIN = 0.5;  // 地板格至少一半可走（進得去）
const HOUSE_MIN_H = 142;     // 外殼整體高度下限（推車、柴堆、攤位、遮雨棚都比小屋矮）
const FLOOR_SAFE_MIN = 0.5;
const INTERIOR_MIN_PX = 600; // 外殼底下藏的立體物件（內牆、家具）像素下限
const CHANGED_MIN = 0.25;    // 收掉外殼後外殼範圍內至少這麼多像素真的變了  // 地板格至少一半在村莊安全區（野外的樹、瀑布、城門不算房子）

function tile(v) {
  const t = loadTil(v >> 8);
  return t && t[v & 0xff];
}

function blockOrigin(meta, b) {
  const nX = meta.tiles.nx / 64;
  const offY = (nX - 1) * 768;
  const i = b.bx - meta.tiles.bx0, j = b.by - meta.tiles.by0;
  return { i, j, ox: (i + j) * 1536 + M, oy: (j - i) * 768 + offY + M + 756 };
}

function piecesOf(objs, ox, oy) {
  const out = [];
  for (const o of objs) {
    const blk = tile(o.v);
    if (!blk) continue;
    const mx = o.x >> 1;
    const sx = ox + o.x * 24 - mx * 24 + o.y * 24, sy = oy + o.y * 12 - mx * 12;
    out.push({ o, blk, px: sx + blk.x, py: sy + blk.y, base: sy + 12 });
  }
  return out;
}

function bbox(ps) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of ps) {
    x0 = Math.min(x0, p.px); y0 = Math.min(y0, p.py);
    x1 = Math.max(x1, p.px + p.blk.w); y1 = Math.max(y1, p.py + p.blk.h);
  }
  return { x0, y0, x1, y1 };
}

/** 群組像素遮罩（minAlpha：255＝只算不透明；1＝含半透明） */
function maskOf(ps, bb, minAlpha) {
  const W = bb.x1 - bb.x0, H = bb.y1 - bb.y0;
  const m = new Uint8Array(W * H);
  let n = 0;
  for (const p of ps) {
    const { blk } = p;
    for (let y = 0; y < blk.h; y++) {
      const row = (p.py - bb.y0 + y) * W + p.px - bb.x0;
      for (let x = 0; x < blk.w; x++) {
        if (blk.px[(y * blk.w + x) * 4 + 3] < minAlpha) continue;
        if (!m[row + x]) { m[row + x] = 1; n++; }
      }
    }
  }
  return { m, W, H, n, bb };
}

function maskHas(mk, x, y) {
  const lx = x - mk.bb.x0, ly = y - mk.bb.y0;
  return lx >= 0 && ly >= 0 && lx < mk.W && ly < mk.H && mk.m[ly * mk.W + lx] === 1;
}

/**
 * 回傳 houses：[{ file, groups:Set(g)（要收掉的群組）, cells:[[gx,gy]...], bb }]，
 * 以及 shellOf：Map("file:g" → 房子編號)
 */
function detectHouses(mapId, meta, blocks, walk) {
  const NX = meta.tiles.nx, NY = meta.tiles.ny;
  const cellAt = (x, y) => (!walk || x < 0 || y < 0 || x >= NX || y >= NY ? 0 : walk[y * NX + x]);
  const houses = [];
  const shellOf = new Map();
  const rr = makeRenderer(mapId, meta, blocks);
  const sorted = blocks.slice().sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  for (const b of sorted) {
    const { i, j, ox, oy } = blockOrigin(meta, b);
    const d = R.readBlock(mapId, b.file);
    const groups = new Map();
    d.objs.forEach((o, k) => { if (!groups.has(o.g)) groups.set(o.g, []); groups.get(o.g).push({ ...o, k }); });
    const tall = [], flat = [], shadow = [], solid = [];
    for (const [g, objs] of groups) {
      const ps = piecesOf(objs, ox, oy);
      if (!ps.length) continue;
      const bb = bbox(ps);
      const maxL = Math.max(...objs.map((o) => o.layer)), minL = Math.min(...objs.map((o) => o.layer));
      const gBase = Math.max(...ps.map((p) => p.base));
      if (minL >= SHADOW_LAYER) { shadow.push({ g, ps, bb }); continue; }
      if (maxL <= FLOOR_MAX_LAYER) { flat.push({ g, objs, ps, bb }); continue; }
      const so = { g, ps, bb };
      solid.push(so);
      if (gBase - bb.y0 < SHELL_MIN_TALL || objs.length < SHELL_MIN_OBJS) continue;
      so.mk = maskOf(ps, bb, 255);
      if (so.mk.n < SHELL_MIN_PX) continue;
      tall.push({ g, ps, bb, mk: so.mk });
    }
    if (!tall.length || !flat.length) continue;
    const local = [];
    for (const f of flat) {
      const fm = maskOf(f.ps, f.bb, 255);
      if (fm.n < FLOOR_MIN_PX) continue;
      const near = tall.filter((t) => t.bb.x0 < f.bb.x1 && t.bb.x1 > f.bb.x0 && t.bb.y0 < f.bb.y1 && t.bb.y1 > f.bb.y0);
      if (!near.length) continue;
      // 每組蓋到的地板像素
      const hits = near.map(() => []);
      for (let y = 0; y < fm.H; y++) for (let x = 0; x < fm.W; x++) {
        const n = y * fm.W + x;
        if (!fm.m[n]) continue;
        const X = f.bb.x0 + x, Y = f.bb.y0 + y;
        near.forEach((t, q) => { if (maskHas(t.mk, X, Y)) hits[q].push(n); });
      }
      // 貪婪挑外殼：先挑蓋最多的，之後只收「再多蓋到一成五以上新地板」的組（屋內內牆／櫃台都在屋頂底下，不會多蓋）
      const done = new Uint8Array(fm.W * fm.H);
      const shells = [];
      let cov = 0;
      for (;;) {
        let best = -1, bestNew = 0;
        hits.forEach((hs, q) => {
          if (shells.includes(near[q].g)) return;
          let nw = 0;
          for (const n of hs) if (!done[n]) nw++;
          if (nw > bestNew) { bestNew = nw; best = q; }
        });
        if (best < 0 || bestNew / fm.n < SHELL_PART_MIN) break;
        shells.push(near[best].g);
        for (const n of hits[best]) if (!done[n]) { done[n] = 1; cov++; }
      }
      if (!shells.length || cov / fm.n < COVER_MIN) continue;
      const cells = new Set();
      for (const o of f.objs) cells.add((i * 64 + (o.x >> 1)) + "," + (j * 64 + o.y));
      local.push({ shells: new Set(shells), cells });
    }
    // 共用外殼的地板併成同一間
    const merged = [];
    for (const h of local) {
      const hit = merged.find((m) => [...h.shells].some((g) => m.shells.has(g)));
      if (hit) { h.shells.forEach((g) => hit.shells.add(g)); h.cells.forEach((c) => hit.cells.add(c)); }
      else merged.push({ shells: new Set(h.shells), cells: new Set(h.cells) });
    }
    for (const h of merged) {
      if (walk) {
        let wk = 0, safe = 0;
        for (const c of h.cells) { const [x, y] = c.split(",").map(Number); const v = cellAt(x, y); if (v & 1) wk++; if (v & 2) safe++; }
        if (wk / h.cells.size < FLOOR_WALK_MIN || safe / h.cells.size < FLOOR_SAFE_MIN) continue;
      }
      const shellPs = tall.filter((t) => h.shells.has(t.g));
      const sbb = shellPs.reduce((a, t) => ({ x0: Math.min(a.x0, t.bb.x0), y0: Math.min(a.y0, t.bb.y0), x1: Math.max(a.x1, t.bb.x1), y1: Math.max(a.y1, t.bb.y1) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
      const groupsHide = new Set(h.shells);
      for (const s of shadow) {
        if (s.bb.x0 < sbb.x1 && s.bb.x1 > sbb.x0 && s.bb.y0 < sbb.y1 && s.bb.y1 > sbb.y0) groupsHide.add(s.g);
      }
      const hidePs = [];
      for (const [g, objs] of groups) if (groupsHide.has(g)) hidePs.push(...piecesOf(objs, ox, oy));
      const hbb = bbox(hidePs);
      if (hbb.y1 - hbb.y0 < HOUSE_MIN_H) continue;
      // 屋內要有東西（內牆／櫃台／家具被外殼蓋住）：樹底下只有平的草皮
      let inner = 0;
      for (const s of solid) {
        if (h.shells.has(s.g) || s.bb.x0 >= sbb.x1 || s.bb.x1 <= sbb.x0 || s.bb.y0 >= sbb.y1 || s.bb.y1 <= sbb.y0) continue;
        if (!s.mk) s.mk = maskOf(s.ps, s.bb, 255);
        let c = 0;
        for (let y = 0; y < s.mk.H; y++) for (let x = 0; x < s.mk.W; x++) {
          if (!s.mk.m[y * s.mk.W + x]) continue;
          const X = s.bb.x0 + x, Y = s.bb.y0 + y;
          if (shellPs.some((t) => maskHas(t.mk, X, Y))) c++;
        }
        if (c >= s.mk.n * 0.6) inner += c;
      }
      if (inner < INTERIOR_MIN_PX) continue;
      // 收掉外殼後畫面真的有變（外殼沒被別棟屋頂整個蓋住）
      const patch = rr.renderHouse(b.file, groupsHide, hbb, hidePs);
      if (patch.changed < CHANGED_MIN) continue;
      const id = houses.length;
      houses.push({ id, file: b.file, groups: groupsHide, cells: [...h.cells].map((c) => c.split(",").map(Number)), bb: hbb, patch });
      for (const g of groupsHide) shellOf.set(b.file + ":" + g, id);
    }
  }
  return { houses, shellOf };
}

/** 跟 export-linmap.js 同順序畫指定範圍：所有區塊地面 → 所有區塊物件（各區塊依 layer） */
function makeRenderer(mapId, meta, blocks) {
  const data = blocks.map((b) => ({ ...b, ...blockOrigin(meta, b) })).sort((a, b) => (a.j - a.i) - (b.j - b.i) || a.i - b.i);
  const cache = new Map();
  function blockData(b) {
    if (!cache.has(b.file)) {
      const d = R.readBlock(mapId, b.file);
      const objs = d.objs.map((o, k) => ({ ...o, k })).sort((a, c) => a.layer - c.layer || a.k - c.k);
      cache.set(b.file, { d, objs });
      if (cache.size > 64) cache.delete(cache.keys().next().value);
    }
    return cache.get(b.file);
  }
  function drawInto(buf, bx0, by0, W, Hh, v, sx, sy) {
    const blk = tile(v);
    if (!blk) return;
    const left = sx + blk.x - bx0, top = sy + blk.y - by0;
    if (left >= W || top >= Hh || left + blk.w <= 0 || top + blk.h <= 0) return;
    for (let y = 0; y < blk.h; y++) {
      const ty = top + y;
      if (ty < 0 || ty >= Hh) continue;
      for (let x = 0; x < blk.w; x++) {
        const tx = left + x;
        if (tx < 0 || tx >= W) continue;
        const so = (y * blk.w + x) * 4;
        const a = blk.px[so + 3];
        if (!a) continue;
        const d = (ty * W + tx) * 4;
        if (a === 255) { buf[d] = blk.px[so]; buf[d + 1] = blk.px[so + 1]; buf[d + 2] = blk.px[so + 2]; }
        else { const k = a / 255; for (let c = 0; c < 3; c++) buf[d + c] = buf[d + c] * (1 - k) + blk.px[so + c] * k; }
        buf[d + 3] = 255;
      }
    }
  }
  const cellPos = (b, cx, cy) => { const mx = cx >> 1; return [b.ox + cx * 24 - mx * 24 + cy * 24, b.oy + cy * 12 - mx * 12]; };
  function render(x0, y0, W, Hh, skipFile, skip) {
    const buf = new Uint8Array(W * Hh * 4);
    const near = data.filter((b) => b.ox - 600 < x0 + W && b.ox + 3072 + 600 > x0 && b.oy - 756 - 900 < y0 + Hh && b.oy + 800 + 600 > y0);
    for (const b of near) {
      const { d } = blockData(b);
      for (let cy = 0; cy < 64; cy++) for (let cx = 0; cx < 128; cx++) {
        const [sx, sy] = cellPos(b, cx, cy);
        if (sx + 96 < x0 || sx - 96 > x0 + W || sy + 96 < y0 || sy - 96 > y0 + Hh) continue;
        drawInto(buf, x0, y0, W, Hh, d.ground[cy * 128 + cx], sx, sy);
      }
    }
    for (const b of near) {
      for (const o of blockData(b).objs) {
        if (skip && b.file === skipFile && skip.has(o.g)) continue;
        const [sx, sy] = cellPos(b, o.x, o.y);
        drawInto(buf, x0, y0, W, Hh, o.v, sx, sy);
      }
    }
    return buf;
  }
  /** 屋內補圖：扣掉外殼重畫，只留外殼原本畫到的像素（外擴 1px 蓋住底圖有損壓縮的邊）；changed＝真的變了的比例 */
  function renderHouse(file, groupsHide, hbb, hidePs) {
    const PAD = 1;
    const x0 = hbb.x0 - PAD, y0 = hbb.y0 - PAD, W = hbb.x1 - hbb.x0 + PAD * 2, Hh = hbb.y1 - hbb.y0 + PAD * 2;
    const keep = new Uint8Array(W * Hh);
    for (const p of hidePs) {
      const { blk } = p;
      for (let y = 0; y < blk.h; y++) for (let x = 0; x < blk.w; x++) {
        if (!blk.px[(y * blk.w + x) * 4 + 3]) continue;
        const lx = p.px - x0 + x, ly = p.py - y0 + y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = lx + dx, Y = ly + dy;
          if (X >= 0 && Y >= 0 && X < W && Y < Hh) keep[Y * W + X] = 1;
        }
      }
    }
    const full = render(x0, y0, W, Hh, null, null);
    const buf = render(x0, y0, W, Hh, file, groupsHide);
    let nKeep = 0, nChg = 0;
    for (let n = 0; n < keep.length; n++) {
      if (!keep[n]) { buf[n * 4 + 3] = 0; continue; }
      nKeep++;
      const q = n * 4;
      if (Math.abs(full[q] - buf[q]) + Math.abs(full[q + 1] - buf[q + 1]) + Math.abs(full[q + 2] - buf[q + 2]) > 60) nChg++;
    }
    return { x0, y0, W, H: Hh, buf, changed: nKeep ? nChg / nKeep : 0 };
  }
  return { renderHouse };
}

module.exports = { detectHouses, blockOrigin };

// 產生 js/49-linmap-data.js：各原版地圖尺寸／圖塊清單／出生點／練功點／傳送點（世界座標）
// 用法：node tools/lin/build-linmap-data.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const LIN_DIR = path.join(ROOT, "assets", "linmap");

// 地圖 X0/Y0：天堂座標 = X0 + gx（X0 = (bx0-0x7fff)*64 + 0x7fff - 64）
// anchor 以天堂原版座標或格子座標指定
const CONFIG = {
  ti_island: {
    spots: 40,
    keys: {
      dungeonDoor: { lin: [32477, 32851] },
      village: { safeCentroid: true },
      eastCoast: { extreme: "east" },
    },
  },
  ti_dungeon1: { spots: 22, keys: { entry: { center: true }, down: { farFrom: "entry" } } },
  ti_dungeon2: { spots: 22, keys: { entry: { center: true } } },
};
// 原版村莊（tools/lin/towns-config.js）：中心＝倉庫／雜貨商一帶，exit＝離中心最近的安全區外緣
const TOWNS = require("./towns-config");
for (const [name, c] of Object.entries(TOWNS)) {
  CONFIG[name] = { spots: 0, town: true, keys: { center: { lin: [c.x, c.y] }, exit: { exitNear: "center" } } };
}

// 野外／地監（tools/lin/fields-config.js）：每個既有傳送門一個關鍵點 p<i>
//   優先原版連結座標（l1j dungeon 表）→ 朝相鄰區域／村莊方向 → 舊傳送門方位
const FIELDS = require("./fields-config");
{
  const defs = require("./mapdefs-vm").loadDefs().MAP_DEFS || {};
  const links = require("./l1jdb").rows("dungeon");
  const townOf = {};
  for (const c of Object.values(TOWNS)) for (const t of c.towns) townOf[t] = c;
  const SIDE = { east: [1, 1], west: [-1, -1], north: [1, -1], south: [-1, 1] };
  for (const [id, [lin, out]] of Object.entries(FIELDS)) {
    if (!fs.existsSync(path.join(LIN_DIR, out, "meta.json"))) continue;
    const portals = ((defs[id] && defs[id].portals) || []).filter(Boolean);
    const keys = {}, pd = [];
    portals.forEach((p, i) => {
      const dest = FIELDS[p.dest], town = townOf[p.dest];
      const dl = dest ? dest[0] : town ? town.map : null;
      const spec = { side: SIDE[p.side] || SIDE.east };
      if (dl != null) {
        spec.linAny = links.filter((r) => +r.src_mapid === lin && +r.new_mapid === dl).map((r) => [+r.src_x, +r.src_y]);
        if (dl === lin) spec.toward = dest && dest[2] ? [dest[2], dest[3]] : town ? [town.x, town.y] : null;
      }
      keys["p" + i] = spec;
      pd.push(p.dest);
    });
    const isDungeon = !FIELDS[id][2] || lin !== 4;
    CONFIG[out] = { spots: isDungeon ? 26 : 36, keys, pd, mapId: id };
  }
}

function load(name) {
  const dir = path.join(LIN_DIR, name);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
  const walk = fs.readFileSync(path.join(dir, "walk.bin"));
  return { meta, walk };
}

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function build(name, cfg) {
  const { meta, walk } = load(name);
  const nx = meta.tiles.nx, ny = meta.tiles.ny;
  const X0 = (meta.tiles.bx0 - 0x7fff) * 64 + 0x7fff - 64;
  const Y0 = (meta.tiles.by0 - 0x7fff) * 64 + 0x7fff - 64;
  const W = (gx, gy) => (gx >= 0 && gy >= 0 && gx < nx && gy < ny) ? walk[gy * nx + gx] : 0;
  const toWorld = (gx, gy) => {
    const px = (gx + gy) * 24 + meta.iso.ox, py = (gy - gx) * 12 + meta.iso.oy;
    return { x: Math.round(px - meta.w / 2), y: Math.round(meta.h / 2 - py) };
  };

  // 最大連通可走區（含安全區）
  const comp = new Int32Array(nx * ny).fill(-1);
  let best = -1, bestN = 0, cid = 0;
  for (let i = 0; i < nx * ny; i++) {
    if (!(walk[i] & 1) || comp[i] >= 0) continue;
    const q = [i]; comp[i] = cid; let n = 0;
    while (q.length) {
      const c = q.pop(); n++;
      const cx = c % nx, cy = (c / nx) | 0;
      for (const [dx, dy] of N8) {
        const x = cx + dx, y = cy + dy;
        if (!(W(x, y) & 1)) continue;
        const k = y * nx + x;
        if (comp[k] < 0) { comp[k] = cid; q.push(k); }
      }
    }
    if (n > bestN) { bestN = n; best = cid; }
    cid++;
  }
  const inMain = (gx, gy) => (W(gx, gy) & 1) && comp[gy * nx + gx] === best;
  // 角色腳寬：四周一格都可走才算「站得住」
  const roomy = (gx, gy) => inMain(gx, gy) && N8.every(([dx, dy]) => W(gx + dx, gy + dy) & 1);

  function nearest(gx, gy, pred) {
    let bestT = null, bd = Infinity;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      if (!pred(x, y)) continue;
      const d = (x - gx) ** 2 + (y - gy) ** 2;
      if (d < bd) { bd = d; bestT = [x, y]; }
    }
    return bestT;
  }
  function bfsDist(from) {
    const dist = new Int32Array(nx * ny).fill(-1);
    const q = [from[1] * nx + from[0]]; dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const c = q[h]; const cx = c % nx, cy = (c / nx) | 0;
      for (const [dx, dy] of N8) {
        const x = cx + dx, y = cy + dy;
        if (!inMain(x, y)) continue;
        const k = y * nx + x;
        if (dist[k] < 0) { dist[k] = dist[c] + 1; q.push(k); }
      }
    }
    return dist;
  }

  const keys = {};
  const inside = (p) => p && p[0] - X0 >= 0 && p[1] - Y0 >= 0 && p[0] - X0 < nx && p[1] - Y0 < ny;
  const apart = (x, y) => Object.values(keys).every(({ tile: [kx, ky] }) => (x - kx) ** 2 + (y - ky) ** 2 >= 16 * 16);
  // 取景圖邊緣外是黑的：方位門離邊至少 EDGE 格
  const EDGE = 12;
  const extremeDir = ([dx, dy]) => {
    let bv = -Infinity, bt = null;
    for (let y = EDGE; y < ny - EDGE; y++) for (let x = EDGE; x < nx - EDGE; x++) {
      if (!roomy(x, y) || (W(x, y) & 2) || !apart(x, y)) continue;
      const v = x * dx + y * dy;
      if (v > bv) { bv = v; bt = [x, y]; }
    }
    return bt;
  };
  for (const [k, spec] of Object.entries(cfg.keys)) {
    let t = null;
    if (spec.linAny || spec.side) {
      const hit = (spec.linAny || []).find(inside);
      if (hit) {
        const c = nearest(hit[0] - X0, hit[1] - Y0, roomy);
        if (c && (c[0] - hit[0] + X0) ** 2 + (c[1] - hit[1] + Y0) ** 2 <= 12 * 12) t = c;
      }
      if (!t && spec.toward) {
        if (inside(spec.toward)) t = nearest(spec.toward[0] - X0, spec.toward[1] - Y0, (x, y) => roomy(x, y) && !(W(x, y) & 2) && apart(x, y));
        else {
          const cx = X0 + nx / 2, cy = Y0 + ny / 2;
          t = extremeDir([spec.toward[0] - cx, spec.toward[1] - cy]);
        }
      }
      if (!t) t = extremeDir(spec.side);
    } else if (spec.lin) t = nearest(spec.lin[0] - X0, spec.lin[1] - Y0, (x, y) => roomy(x, y));
    else if (spec.center) t = nearest(nx / 2, ny / 2, roomy);
    else if (spec.safeCentroid) {
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < nx * ny; i++) if (walk[i] & 2) { sx += i % nx; sy += (i / nx) | 0; n++; }
      t = nearest(sx / n, sy / n, (x, y) => roomy(x, y) && (W(x, y) & 2));
    } else if (spec.extreme === "east") {
      let bv = -Infinity;
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) if (roomy(x, y) && !(W(x, y) & 2) && x + y > bv) { bv = x + y; t = [x, y]; }
    } else if (spec.exitNear) {
      const [cx, cy] = keys[spec.exitNear].tile;
      const d = bfsDist(keys[spec.exitNear].tile);
      let bd = Infinity;
      for (let i = 0; i < nx * ny; i++) {
        const x = i % nx, y = (i / nx) | 0;
        if (d[i] < 0 || (W(x, y) & 2) || !roomy(x, y)) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 < 14 * 14) continue;
        if (d[i] < bd) { bd = d[i]; t = [x, y]; }
      }
    } else if (spec.farFrom) {
      const d = bfsDist(keys[spec.farFrom].tile);
      let bd = -1;
      for (let i = 0; i < nx * ny; i++) if (d[i] > bd && roomy(i % nx, (i / nx) | 0)) { bd = d[i]; t = [i % nx, (i / nx) | 0]; }
    }
    if (!t) throw new Error(name + " key " + k + " not found");
    keys[k] = { tile: t, lin: [X0 + t[0], Y0 + t[1]], world: toWorld(t[0], t[1]) };
  }

  // 抵達點：離關鍵點 5～9 格、可站、非安全區（村莊除外）
  // 優先：走路距離 5～9 格且直線上全可走（走回傳送門不被牆擋）
  const clearLine = (x0, y0, x1, y1) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      if (!roomy(x, y) && !(x === x1 && y === y1)) return false;
    }
    return true;
  };
  function arrivalNear(key, allowSafe) {
    const [gx, gy] = keys[key].tile;
    const dist = bfsDist([gx, gy]);
    let best = null, bd = Infinity;
    for (let i = 0; i < nx * ny; i++) {
      const d = dist[i];
      if (d < 5 || d > 9) continue;
      const x = i % nx, y = (i / nx) | 0;
      if (!roomy(x, y) || (!allowSafe && (W(x, y) & 2)) || !clearLine(x, y, gx, gy)) continue;
      if (d < bd) { bd = d; best = [x, y]; }
    }
    if (best) return toWorld(best[0], best[1]);
    const t = nearest(gx, gy, (x, y) => {
      const d2 = (x - gx) ** 2 + (y - gy) ** 2;
      return d2 >= 25 && d2 <= 81 && roomy(x, y) && (allowSafe || !(W(x, y) & 2));
    }) || nearest(gx, gy, (x, y) => roomy(x, y) && ((x - gx) ** 2 + (y - gy) ** 2) >= 16);
    return toWorld(t[0], t[1]);
  }
  for (const k of Object.keys(keys)) keys[k].arrive = arrivalNear(k, !!cfg.town);

  // 練功點：主區、可站、非安全區、彼此距離 ≥ minD、遠離抵達點
  if (!cfg.spots) {
    return {
      w: meta.w, h: meta.h, chunk: meta.chunk, chunks: meta.chunks,
      nx, ny, ox: meta.iso.ox, oy: meta.iso.oy, x0: X0, y0: Y0, town: !!cfg.town,
      keys: Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, { x: v.world.x, y: v.world.y, ax: v.arrive.x, ay: v.arrive.y, lin: v.lin }])),
      spots: [],
    };
  }
  const rnd = seeded(name.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const cand = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) if (roomy(x, y) && !(W(x, y) & 2)) cand.push([x, y]);
  const avoid = Object.values(keys).map((k) => k.tile);
  let minD = Math.sqrt(cand.length / cfg.spots) * 0.9;
  let spots = [];
  for (let pass = 0; pass < 6 && spots.length < cfg.spots; pass++) {
    spots = [];
    for (let tries = 0; tries < cand.length * 2 && spots.length < cfg.spots; tries++) {
      const c = cand[(rnd() * cand.length) | 0];
      if (avoid.some(([ax, ay]) => (c[0] - ax) ** 2 + (c[1] - ay) ** 2 < 12 * 12)) continue;
      if (spots.some(([sx, sy]) => (c[0] - sx) ** 2 + (c[1] - sy) ** 2 < minD * minD)) continue;
      spots.push(c);
    }
    minD *= 0.85;
  }

  return {
    w: meta.w, h: meta.h, chunk: meta.chunk, chunks: meta.chunks,
    nx, ny, ox: meta.iso.ox, oy: meta.iso.oy, x0: X0, y0: Y0,
    keys: Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, { x: v.world.x, y: v.world.y, ax: v.arrive.x, ay: v.arrive.y, lin: v.lin }])),
    spots: spots.map((s, i) => ({ id: i, ...toWorld(s[0], s[1]), label: `${X0 + s[0]},${Y0 + s[1]}` })),
    ...(cfg.mapId ? { mapId: cfg.mapId, pd: cfg.pd } : {}),
  };
}

const out = {};
for (const [name, cfg] of Object.entries(CONFIG)) {
  out[name] = build(name, cfg);
  const o = out[name];
  console.log(name, "W", o.w, "H", o.h, "spots", o.spots.length, "keys", JSON.stringify(o.keys));
}
const js = "// 由 tools/lin/build-linmap-data.js 產生（天堂原版地圖：尺寸／圖塊／傳送點／練功點，世界座標）\n"
  + "window.LINMAP_DATA = " + JSON.stringify(out) + ";\n";
fs.writeFileSync(path.join(ROOT, "js", "49-linmap-data.js"), js, "utf8");
console.log("wrote js/49-linmap-data.js", (js.length / 1024).toFixed(1) + "KB");

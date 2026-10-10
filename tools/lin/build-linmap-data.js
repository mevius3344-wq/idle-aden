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
// 整張大地圖（tools/lin/worlds-config.js）：該原版 mapid 的村莊／野外不再各自取景
const WORLDS = require("./worlds-config");
const worldOfMap = {};
for (const [name, w] of Object.entries(WORLDS)) {
  if (fs.existsSync(path.join(LIN_DIR, name, "meta.json"))) worldOfMap[w.map] = name;
}
for (const name of Object.keys(WORLDS)) if (worldOfMap[WORLDS[name].map] === name) delete CONFIG[name];

// 原版村莊（tools/lin/towns-config.js）：中心＝倉庫／雜貨商一帶，exit＝離中心最近的安全區外緣
const TOWNS = require("./towns-config");
for (const [name, c] of Object.entries(TOWNS)) {
  if (worldOfMap[c.map]) continue;
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
  for (const [id, [lin, out, cx]] of Object.entries(FIELDS)) {
    if (worldOfMap[lin] && cx != null) continue;
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

// 整張大地圖：區域（村莊安全區／野外最近中心）＋各區練功點、出生點、對外傳送門（同圖目的地不設門，走過去）
function buildWorld(name, wcfg) {
  const { meta, walk } = load(name);
  const nx = meta.tiles.nx, ny = meta.tiles.ny;
  const X0 = (meta.tiles.bx0 - 0x7fff) * 64 + 0x7fff - 64;
  const Y0 = (meta.tiles.by0 - 0x7fff) * 64 + 0x7fff - 64;
  const W = (gx, gy) => (gx >= 0 && gy >= 0 && gx < nx && gy < ny) ? walk[gy * nx + gx] : 0;
  const toWorld = (gx, gy) => {
    const px = (gx + gy) * 24 + meta.iso.ox, py = (gy - gx) * 12 + meta.iso.oy;
    return { x: Math.round(px - meta.w / 2), y: Math.round(meta.h / 2 - py) };
  };
  const defs = require("./mapdefs-vm").loadDefs().MAP_DEFS || {};
  const links = require("./l1jdb").rows("dungeon");

  const towns = Object.entries(TOWNS).filter(([, c]) => c.map === wcfg.map).map(([key, c]) => ({ key, ids: c.towns, c: [c.x, c.y], r: c.r }));
  const fields = [];
  for (const [id, f] of Object.entries(FIELDS)) if (f[0] === wcfg.map && f[2] != null) fields.push({ id, c: [f[2], f[3]] });
  for (const [id, c] of Object.entries(wcfg.extraFields || {})) fields.push({ id, c });
  const inWorld = new Set([...fields.map((f) => f.id), ...towns.flatMap((t) => t.ids)]);

  // 村莊範圍：方框內安全區＋不經安全區走不到方框外的非安全格（與 js/49-linmap.js linmapTownMasks 相同）
  const masks = towns.map((t) => {
    const R = t.r, N = 2 * R + 1, gx0 = t.c[0] - R - X0, gy0 = t.c[1] - R - Y0;
    const cell = (x, y) => W(gx0 + x, gy0 + y);
    const open = (x, y) => (cell(x, y) & 1) === 1 && (cell(x, y) & 2) === 0;
    const reach = new Uint8Array(N * N), q = [];
    for (let k = 0; k < N; k++) {
      for (const [x, y] of [[k, 0], [k, N - 1], [0, k], [N - 1, k]]) {
        const j = y * N + x;
        if (!reach[j] && open(x, y)) { reach[j] = 1; q.push(j); }
      }
    }
    for (let h = 0; h < q.length; h++) {
      const x = q[h] % N, y = (q[h] / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx2 = x + dx, ny2 = y + dy;
        if (nx2 < 0 || ny2 < 0 || nx2 >= N || ny2 >= N) continue;
        const j = ny2 * N + nx2;
        if (!reach[j] && open(nx2, ny2)) { reach[j] = 1; q.push(j); }
      }
    }
    const m = new Uint8Array(N * N);
    for (let k = 0; k < N * N; k++) {
      const c = cell(k % N, (k / N) | 0);
      m[k] = ((c & 2) || ((c & 1) && !reach[k])) ? 1 : 0;
    }
    return { gx0, gy0, N, m };
  });
  // 區域：與 js/49-linmap.js linmapRegionAt 相同規則
  const regionAt = (gx, gy) => {
    const lx = X0 + gx, ly = Y0 + gy;
    for (let i = 0; i < masks.length; i++) {
      const M = masks[i], mx = gx - M.gx0, my = gy - M.gy0;
      if (mx >= 0 && my >= 0 && mx < M.N && my < M.N && M.m[my * M.N + mx]) return towns[i].ids[0];
    }
    let best = null, bd = Infinity;
    for (const f of fields) {
      const d = (lx - f.c[0]) ** 2 + (ly - f.c[1]) ** 2;
      if (d < bd) { bd = d; best = f.id; }
    }
    return best;
  };
  const regNames = [];
  const regOf = new Uint8Array(nx * ny);
  for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
    const r = regionAt(gx, gy);
    let k = regNames.indexOf(r);
    if (k < 0) { k = regNames.length; regNames.push(r); }
    regOf[gy * nx + gx] = k;
  }

  // 可站：連通塊夠大（排除孤立小島／牆內死角）＋四周一格可走
  const comp = new Int32Array(nx * ny).fill(-1);
  const compN = [];
  for (let i = 0; i < nx * ny; i++) {
    if (!(walk[i] & 1) || comp[i] >= 0) continue;
    const id = compN.length, q = [i]; comp[i] = id; let n = 0;
    while (q.length) {
      const c = q.pop(); n++;
      const cx = c % nx, cy = (c / nx) | 0;
      for (const [dx, dy] of N8) {
        const x = cx + dx, y = cy + dy;
        if (!(W(x, y) & 1)) continue;
        const k = y * nx + x;
        if (comp[k] < 0) { comp[k] = id; q.push(k); }
      }
    }
    compN.push(n);
  }
  const big = (gx, gy) => (W(gx, gy) & 1) && compN[comp[gy * nx + gx]] >= 4000;
  const roomy = (gx, gy) => big(gx, gy) && N8.every(([dx, dy]) => W(gx + dx, gy + dy) & 1);
  const nearestIn = (gx, gy, rad, pred) => {
    let bt = null, bd = Infinity;
    for (let y = Math.max(0, gy - rad); y < Math.min(ny, gy + rad + 1); y++) {
      for (let x = Math.max(0, gx - rad); x < Math.min(nx, gx + rad + 1); x++) {
        if (!pred(x, y)) continue;
        const d = (x - gx) ** 2 + (y - gy) ** 2;
        if (d < bd) { bd = d; bt = [x, y]; }
      }
    }
    return bt;
  };
  const clearLine = (x0, y0, x1, y1) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      if (!roomy(x, y) && !(x === x1 && y === y1)) return false;
    }
    return true;
  };
  const arrivalNear = ([gx, gy]) => {
    for (let r2 = 5; r2 <= 10; r2++) {
      const t = nearestIn(gx, gy, r2, (x, y) => {
        const d2 = (x - gx) ** 2 + (y - gy) ** 2;
        return d2 >= 25 && d2 <= r2 * r2 && roomy(x, y) && !(W(x, y) & 2) && clearLine(x, y, gx, gy);
      });
      if (t) return toWorld(t[0], t[1]);
    }
    const t = nearestIn(gx, gy, 16, (x, y) => roomy(x, y) && ((x - gx) ** 2 + (y - gy) ** 2) >= 16);
    return toWorld(t[0], t[1]);
  };
  const SIDE = { east: [1, 1], west: [-1, -1], north: [1, -1], south: [-1, 1] };

  const areas = {};
  for (const f of fields) {
    const cg = [f.c[0] - X0, f.c[1] - Y0];
    const fk = regNames.indexOf(f.id);
    const mine = (x, y) => regOf[y * nx + x] === fk;
    const ok = (x, y) => roomy(x, y) && !(W(x, y) & 2) && mine(x, y);
    const st = nearestIn(cg[0], cg[1], 400, ok);
    if (!st) throw new Error(name + " field " + f.id + " has no standable tile");
    const keyTiles = [];
    const keys = {}, pd = [], keep = [];
    const olds = ((defs[f.id] && defs[f.id].portals) || []).filter(Boolean);
    olds.forEach((p, i) => {
      if (inWorld.has(p.dest)) return;
      const dest = FIELDS[p.dest], town = Object.values(TOWNS).find((c) => c.towns.includes(p.dest));
      const dl = dest ? dest[0] : town ? town.map : null;
      let t = null;
      const fixed = (wcfg.portalAt || {})[f.id + ">" + p.dest];
      const cand = fixed ? [fixed] : (dl != null ? links.filter((r) => +r.src_mapid === wcfg.map && +r.new_mapid === dl).map((r) => [+r.src_x, +r.src_y]) : []);
      cand.sort((a, b) => ((a[0] - f.c[0]) ** 2 + (a[1] - f.c[1]) ** 2) - ((b[0] - f.c[0]) ** 2 + (b[1] - f.c[1]) ** 2));
      for (const [lx, ly] of cand) {
        const c = nearestIn(lx - X0, ly - Y0, 12, roomy);
        if (c && mine(c[0], c[1])) { t = c; break; }
      }
      if (!t) {
        const [dx, dy] = SIDE[p.side] || SIDE.south;
        let bv = -Infinity;
        for (let y = Math.max(0, cg[1] - 60); y < Math.min(ny, cg[1] + 61); y++) {
          for (let x = Math.max(0, cg[0] - 60); x < Math.min(nx, cg[0] + 61); x++) {
            if (!ok(x, y) || keyTiles.some(([kx, ky]) => (x - kx) ** 2 + (y - ky) ** 2 < 256)) continue;
            const v = (x - cg[0]) * dx + (y - cg[1]) * dy;
            if (v > bv) { bv = v; t = [x, y]; }
          }
        }
      }
      if (!t) throw new Error(name + " " + f.id + " portal " + p.dest + " not placed");
      keyTiles.push(t);
      const w = toWorld(t[0], t[1]), a = arrivalNear(t);
      keys["p" + i] = { x: w.x, y: w.y, ax: a.x, ay: a.y, lin: [X0 + t[0], Y0 + t[1]] };
      pd[i] = p.dest;
      keep.push(i);
    });
    // 練功點：本區、離中心 100 格內優先（大區域邊緣不灑滿）
    const rnd = seeded((name + f.id).split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const SPOTS = 36;
    let cand = [];
    for (const R of [100, 160, 400]) {
      cand = [];
      for (let y = Math.max(0, cg[1] - R); y < Math.min(ny, cg[1] + R + 1); y++) {
        for (let x = Math.max(0, cg[0] - R); x < Math.min(nx, cg[0] + R + 1); x++) if (ok(x, y)) cand.push([x, y]);
      }
      if (cand.length >= SPOTS * 60) break;
    }
    let minD = Math.sqrt(cand.length / SPOTS) * 0.9, spots = [];
    for (let pass = 0; pass < 6 && spots.length < SPOTS; pass++) {
      spots = [];
      for (let tries = 0; tries < cand.length * 2 && spots.length < SPOTS; tries++) {
        const c = cand[(rnd() * cand.length) | 0];
        if (keyTiles.some(([ax, ay]) => (c[0] - ax) ** 2 + (c[1] - ay) ** 2 < 144)) continue;
        if (spots.some(([sx, sy]) => (c[0] - sx) ** 2 + (c[1] - sy) ** 2 < minD * minD)) continue;
        spots.push(c);
      }
      minD *= 0.85;
    }
    areas[f.id] = {
      start: toWorld(st[0], st[1]),
      keys, pd, keep,
      spots: spots.map((s, i) => ({ id: i, ...toWorld(s[0], s[1]), label: `${X0 + s[0]},${Y0 + s[1]}` })),
    };
    console.log("  field", f.id, "spots", spots.length, "portals", keep.map((i) => pd[i] + "@" + keys["p" + i].lin).join(" "));
  }
  for (const t of towns) {
    const tiles = [];
    for (let y = Math.max(0, t.c[1] - Y0 - t.r); y <= Math.min(ny - 1, t.c[1] - Y0 + t.r); y++) {
      for (let x = Math.max(0, t.c[0] - X0 - t.r); x <= Math.min(nx - 1, t.c[0] - X0 + t.r); x++) if (W(x, y) & 2) tiles.push(1);
    }
    console.log("  town", t.ids.join("/"), "safe tiles", tiles.length);
  }
  return {
    w: meta.w, h: meta.h, chunk: meta.chunk, chunks: meta.chunks,
    nx, ny, ox: meta.iso.ox, oy: meta.iso.oy, x0: X0, y0: Y0,
    world: true, linMap: wcfg.map, towns, fields, areas, spots: [], keys: {},
  };
}

const out = {};
for (const [name, cfg] of Object.entries(CONFIG)) {
  out[name] = build(name, cfg);
  const o = out[name];
  console.log(name, "W", o.w, "H", o.h, "spots", o.spots.length, "keys", JSON.stringify(o.keys));
}
for (const [name, wcfg] of Object.entries(WORLDS)) {
  if (worldOfMap[wcfg.map] !== name) continue;
  out[name] = buildWorld(name, wcfg);
  console.log(name, "WORLD W", out[name].w, "H", out[name].h, "areas", Object.keys(out[name].areas).length);
}
const js = "// 由 tools/lin/build-linmap-data.js 產生（天堂原版地圖：尺寸／圖塊／傳送點／練功點，世界座標）\n"
  + "window.LINMAP_DATA = " + JSON.stringify(out) + ";\n";
fs.writeFileSync(path.join(ROOT, "js", "49-linmap-data.js"), js, "utf8");
console.log("wrote js/49-linmap-data.js", (js.length / 1024).toFixed(1) + "KB");

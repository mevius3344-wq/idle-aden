/**
 * Regenerate Teon-style floors: scenic cover as base (readable place art),
 * light seamless grain + soft edge only. Skips talking_island (hand-painted).
 * Fixes muddy/dark batch from the old soft-light + heavy wall mask pipeline.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'area', 'maps');
const SEAM = path.join(ROOT, 'assets', 'area', 'seamless');
const MAPDEF = path.join(ROOT, 'js', '47-mapdef.js');
const SIZE = 1024;
const SKIP = new Set(['talking_island']); // keep hand-painted

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickBiome(id, scenic) {
  const s = id + ' ' + scenic;
  if (/fire_dragon|valakas|lava|火龍|巴拉|炎魔|火山/.test(s)) return 'lava';
  if (/crystal|水晶/.test(s)) return 'crystal';
  if (/heine|fafurion|coast|port|海賊|海音|法利|港口|夢幻|遺忘/.test(s)) return 'coast';
  if (/desert|thebes|tikal|蚂蚁|螞蟻|沙漠|底比斯|提卡|沙棘/.test(s)) return 'desert';
  if (/snow|oren|zone_03|雪|歐瑞雪/.test(s)) return 'snow';
  if (/forest|elf|mirror|twilight|zone_01|windwood|森林|精靈|鏡子|黃昏|風木|銀騎/.test(s)) return 'forest';
  if (/pride|tower|ivory|zone_3[7-9]|zone_4[01]|傲慢|象牙/.test(s)) return 'tower';
  if (/dungeon|cave|zone_|rastabad|grave|tomb|temple|lab|necro|elder|demon|shadow|eva|地監|洞穴|墓|神殿|塔|通道|訓練|研究室|王國|拉斯塔/.test(s)) return 'dungeon';
  return 'wild';
}

function biomeSeamless(biome) {
  const map = {
    lava: 'lava.png',
    dungeon: 'dungeon.png',
    desert: 'desert.png',
    forest: 'forest.png',
    snow: 'snow.png',
    coast: 'coast.png',
    crystal: 'crystal.png',
    tower: 'tower.png',
    wild: 'wild.png',
    swamp: 'swamp.png'
  };
  return map[biome] || 'wild.png';
}

function softEdgeVignette(seed) {
  const rnd = mulberry32(seed);
  const strength = 28 + Math.round(rnd() * 18);
  const start = 0.78 + rnd() * 0.08;
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const dx = (x - SIZE / 2) / (SIZE / 2);
      const dy = (y - SIZE / 2) / (SIZE / 2);
      const r = Math.sqrt(dx * dx + dy * dy);
      buf[i] = 18;
      buf[i + 1] = 14;
      buf[i + 2] = 10;
      buf[i + 3] = Math.round(Math.max(0, r - start) / (1.05 - start) * strength);
    }
  }
  return buf;
}

async function grainOverlay(seamlessFile, opacity) {
  const tile = await sharp(path.join(SEAM, seamlessFile))
    .resize(SIZE, SIZE, { fit: 'cover' })
    .modulate({ brightness: 1.05, saturation: 0.92 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const data = tile.data;
  const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255);
  for (let i = 3; i < data.length; i += 4) data[i] = a;
  return sharp(data, {
    raw: { width: tile.info.width, height: tile.info.height, channels: 4 }
  })
    .png()
    .toBuffer();
}

async function buildFloor(spec) {
  const seed = hashStr(spec.id + '|' + spec.scenic + '|v2');
  const rnd = mulberry32(seed);
  const scenicPath = spec.scenicPath;
  if (!fs.existsSync(scenicPath)) {
    throw new Error('missing scenic ' + scenicPath);
  }

  // Primary: place art (cover crop into square playfield)
  const base = await sharp(scenicPath)
    .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
    .modulate({
      brightness: 1.08 + rnd() * 0.06,
      saturation: 1.02 + rnd() * 0.08
    })
    .linear(1.04, 4)
    .ensureAlpha()
    .png()
    .toBuffer();

  const grain = await grainOverlay(biomeSeamless(spec.biome), 0.18 + rnd() * 0.08);
  const vig = softEdgeVignette(seed);

  const outPath = path.join(OUT, spec.id + '_floor.png');
  await sharp(base)
    .composite([
      { input: grain, blend: 'soft-light' },
      { input: vig, raw: { width: SIZE, height: SIZE, channels: 4 }, blend: 'over' }
    ])
    .png({ compressionLevel: 8 })
    .toFile(outPath);
  return outPath;
}

function parseMapdefs() {
  const src = fs.readFileSync(MAPDEF, 'utf8');
  const entries = [];
  const re = /([a-z0-9_]+):\s*\{[\s\S]*?floor:\s*'([^']+)'[\s\S]*?scenicFar:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) {
    entries.push({ id: m[1], floor: m[2], scenic: m[3] });
  }
  return entries;
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const entries = parseMapdefs();
  console.log('mapdefs with scenicFar', entries.length);
  let ok = 0;
  let fail = 0;
  const avgs = [];
  for (const e of entries) {
    if (SKIP.has(e.id)) {
      console.log('skip hand', e.id);
      continue;
    }
    const scenicPath = path.join(ROOT, e.scenic.replace(/\//g, path.sep));
    const biome = pickBiome(e.id, path.basename(e.scenic, path.extname(e.scenic)));
    try {
      const out = await buildFloor({ id: e.id, scenic: e.scenic, scenicPath, biome });
      const st = await sharp(out).stats();
      const avg = (st.channels[0].mean + st.channels[1].mean + st.channels[2].mean) / 3;
      avgs.push(avg);
      ok++;
      if (ok % 15 === 0) console.log('…', ok, 'floors lastAvg', avg.toFixed(1));
    } catch (err) {
      fail++;
      console.error('FAIL', e.id, err.message);
    }
  }
  avgs.sort((a, b) => a - b);
  const mean = avgs.length ? avgs.reduce((s, v) => s + v, 0) / avgs.length : 0;
  const dark = avgs.filter((v) => v < 70).length;
  console.log('generated', ok, 'fail', fail, 'avgMean', mean.toFixed(1), 'dark<70', dark + '/' + avgs.length);
})();

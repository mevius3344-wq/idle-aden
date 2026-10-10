#!/usr/bin/env node
/**
 * Regenerate js/anim-manifest.js from on-disk sprite folders.
 * Scans assets/anim, assets/classanim, assets/morphanim.
 *
 * Prefix = everything before the trailing frame index digits in "*.png"
 * e.g. idle_0.png → idle_ ; d3/walk_s_2.png → d3/walk_s_
 * Count = longest contiguous run starting at 0.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TREES = ['assets/anim', 'assets/classanim', 'assets/morphanim'];
const OUT = path.join(ROOT, 'js', 'anim-manifest.js');

function countContiguous(indices) {
  let n = 0;
  while (indices.has(n)) n++;
  return n;
}

function scanFolder(absDir, relKey) {
  /** @type {Map<string, Set<number>>} */
  const groups = new Map();

  function walk(dir, relPrefix) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const name = ent.name;
      if (ent.isDirectory()) {
        walk(path.join(dir, name), relPrefix ? relPrefix + name + '/' : name + '/');
        continue;
      }
      if (!ent.isFile() || !name.endsWith('.png')) continue;
      const m = /^(.+?)(\d+)\.png$/i.exec(name);
      if (!m) continue;
      const pfx = (relPrefix || '') + m[1];
      const idx = parseInt(m[2], 10);
      if (!groups.has(pfx)) groups.set(pfx, new Set());
      groups.get(pfx).add(idx);
    }
  }

  walk(absDir, '');
  if (!groups.size) return null;
  const out = {};
  for (const [pfx, set] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const n = countContiguous(set);
    if (n > 0) out[pfx] = n;
  }
  return Object.keys(out).length ? out : null;
}

function main() {
  const manifest = {};
  let folders = 0;
  let withWalk = 0;
  for (const tree of TREES) {
    const absTree = path.join(ROOT, tree);
    if (!fs.existsSync(absTree)) continue;
    for (const name of fs.readdirSync(absTree)) {
      const abs = path.join(absTree, name);
      if (!fs.statSync(abs).isDirectory()) continue;
      const key = tree.replace(/\\/g, '/') + '/' + name;
      const ent = scanFolder(abs, key);
      if (!ent) continue;
      manifest[key] = ent;
      folders++;
      if (Object.keys(ent).some((k) => /(^|\/)walk_/.test(k) && !/walk_s_/.test(k))) withWalk++;
    }
  }
  const keys = Object.keys(manifest).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  const sorted = {};
  for (const k of keys) sorted[k] = manifest[k];

  const body =
    '// 🤖 自動生成·勿手改 —— 跑 `node tools/gen-anim-manifest.js` 重生。\n' +
    '// 資料夾數 ' +
    folders +
    ' · 含根或八向 walk_ 序列 ' +
    withWalk +
    ' · ' +
    new Date().toISOString().slice(0, 10) +
    '\n' +
    'const ANIM_MANIFEST = ' +
    JSON.stringify(sorted) +
    ';\n';

  fs.writeFileSync(OUT, body, 'utf8');
  console.log('wrote', OUT);
  console.log('folders', folders, 'withWalk', withWalk);
}

main();

"use strict";

/**
 * 檔案模式資料備份：把持久資料夾（CLOUD_SAVE_DIR 或 data/）整包打成 gzip JSON。
 * 格式：{ v:1, at, root, files: { "相對路徑": "檔案內容(utf8)" } }
 * 自動快照存 <dataDir>/.backups/（帳號名不允許「.」，不會與帳號資料夾撞名）。
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SNAP_DIR_NAME = ".backups";
const SNAP_KEEP = 7;
const SNAP_EVERY_MS = 24 * 3600 * 1000;
const FILE_MAX_BYTES = 8 * 1024 * 1024;
const SKIP_NAMES = new Set([SNAP_DIR_NAME, "account-sessions.json"]);

function stampName(at) {
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, "0");
  return (
    "backup-" + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + "-" + p(d.getUTCHours()) + p(d.getUTCMinutes()) + ".json.gz"
  );
}

function createBackupStore(dataDir) {
  const root = path.resolve(dataDir);
  const snapDir = path.join(root, SNAP_DIR_NAME);
  let timer = null;

  function walk(dir, rel, out) {
    let ents = [];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const ent of ents) {
      if (SKIP_NAMES.has(ent.name) || ent.name.endsWith(".tmp")) continue;
      const abs = path.join(dir, ent.name);
      const r = rel ? rel + "/" + ent.name : ent.name;
      if (ent.isDirectory()) walk(abs, r, out);
      else if (ent.isFile() && ent.name.endsWith(".json")) out.push({ abs, rel: r });
    }
  }

  /** 資料夾統計：檔案數、總位元組、帳號資料夾數 */
  function stats() {
    const files = [];
    walk(root, "", files);
    let bytes = 0;
    const accDirs = new Set();
    for (const f of files) {
      try {
        bytes += fs.statSync(f.abs).size;
      } catch (e) {}
      const i = f.rel.indexOf("/");
      if (i > 0) accDirs.add(f.rel.slice(0, i));
    }
    return { files: files.length, bytes, accountDirs: accDirs.size };
  }

  function build() {
    const files = [];
    walk(root, "", files);
    const at = Date.now();
    const bundle = { v: 1, at, root: path.basename(root), files: {} };
    let skipped = 0;
    for (const f of files) {
      try {
        const st = fs.statSync(f.abs);
        if (st.size > FILE_MAX_BYTES) {
          skipped++;
          continue;
        }
        bundle.files[f.rel] = fs.readFileSync(f.abs, "utf8");
      } catch (e) {
        skipped++;
      }
    }
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(bundle), "utf8"), { level: 9 });
    return { name: stampName(at), at, count: Object.keys(bundle.files).length, skipped, gz };
  }

  function list() {
    let names = [];
    try {
      names = fs.readdirSync(snapDir).filter((n) => /^backup-\d{8}-\d{4}\.json\.gz$/.test(n));
    } catch (e) {
      return [];
    }
    return names
      .map((name) => {
        let st = null;
        try {
          st = fs.statSync(path.join(snapDir, name));
        } catch (e) {}
        return { name, bytes: st ? st.size : 0, at: st ? Math.floor(st.mtimeMs) : 0 };
      })
      .sort((a, b) => b.at - a.at);
  }

  function readSnapshot(name) {
    if (!/^backup-\d{8}-\d{4}\.json\.gz$/.test(String(name || ""))) return null;
    const file = path.join(snapDir, name);
    try {
      return fs.readFileSync(file);
    } catch (e) {
      return null;
    }
  }

  function snapshot() {
    const b = build();
    fs.mkdirSync(snapDir, { recursive: true });
    const file = path.join(snapDir, b.name);
    fs.writeFileSync(file + ".tmp", b.gz);
    fs.renameSync(file + ".tmp", file);
    for (const old of list().slice(SNAP_KEEP)) {
      try {
        fs.unlinkSync(path.join(snapDir, old.name));
      } catch (e) {}
    }
    return { name: b.name, at: b.at, count: b.count, bytes: b.gz.length };
  }

  /** 每小時檢查一次，距上次快照滿 24 小時就再拍一份 */
  function startDaily() {
    if (timer) return;
    const tick = () => {
      try {
        const last = list()[0];
        if (!last || Date.now() - last.at >= SNAP_EVERY_MS) {
          const s = snapshot();
          console.log("[backup] 自動快照 " + s.name + "（" + s.count + " 檔，" + s.bytes + " bytes）");
        }
      } catch (e) {
        console.error("[backup] 自動快照失敗", e && e.message ? e.message : e);
      }
    };
    setTimeout(tick, 60 * 1000).unref();
    timer = setInterval(tick, 3600 * 1000);
    timer.unref();
  }

  return { root, snapDir, stats, build, list, readSnapshot, snapshot, startDaily };
}

module.exports = { createBackupStore, SNAP_KEEP, SNAP_DIR_NAME };

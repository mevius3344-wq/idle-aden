#!/usr/bin/env node
"use strict";

/**
 * 從 Neon 雲端存檔刪除幻術士／龍騎士／戰士角色（暫停開放職業）。
 * 用法：
 *   npm run db:purge-closed-classes
 *   npm run db:purge-closed-classes -- --dry-run
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { ensureSchema, getSql } = require("../lib/db");
const { accountKey, charNameKey, normalizeCharName } = require("../lib/game-utils");

const CLOSED = new Set(["illusion", "dragon", "warrior"]);
const dryRun = process.argv.includes("--dry-run");

async function deleteCharName(sql, mapKey) {
  if (dryRun) return;
  await sql`DELETE FROM char_names WHERE name_key = ${mapKey}`;
}

async function purgeNeon() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.error("缺少 DATABASE_URL（略過 Neon 清理）");
    return 0;
  }
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`SELECT account_key, slot, data FROM cloud_slots`;
  let removed = 0;
  for (const r of rows) {
    const p = r.data && r.data.p;
    if (!p || !CLOSED.has(p.cls)) continue;
    const display = normalizeCharName(p.name);
    console.log(
      (dryRun ? "[dry-run] would remove" : "removed"),
      r.account_key,
      "slot",
      r.slot,
      display || "(未命名)",
      p.cls
    );
    if (!dryRun) {
      if (display) {
        const nkey = charNameKey(display);
        try {
          const cr = await sql`SELECT account, slot FROM char_names WHERE name_key = ${nkey} LIMIT 1`;
          const row = cr[0];
          if (row && accountKey(row.account || "") === r.account_key && Number(row.slot) === r.slot) {
            await deleteCharName(sql, nkey);
          }
        } catch (e) {}
      }
      await sql`DELETE FROM cloud_slots WHERE account_key = ${r.account_key} AND slot = ${r.slot}`;
    }
    removed++;
  }
  return removed;
}

function purgeLocalFiles() {
  const root = path.join(__dirname, "..", "data", "cloud");
  if (!fs.existsSync(root)) return 0;
  let removed = 0;
  const accounts = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const acc of accounts) {
    const dir = path.join(root, acc.name);
    for (let slot = 1; slot <= 8; slot++) {
      const file = path.join(dir, `slot-${slot}.json`);
      if (!fs.existsSync(file)) continue;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (e) {
        continue;
      }
      const p = data && data.p;
      if (!p || !CLOSED.has(p.cls)) continue;
      console.log(
        (dryRun ? "[dry-run] would remove file" : "removed file"),
        path.relative(path.join(__dirname, ".."), file),
        normalizeCharName(p.name) || "(未命名)",
        p.cls
      );
      if (!dryRun) fs.unlinkSync(file);
      removed++;
    }
  }
  return removed;
}

async function main() {
  if (dryRun) console.log("DRY RUN — 不會實際刪除");
  const neonN = await purgeNeon();
  const fileN = purgeLocalFiles();
  console.log("Done.", dryRun ? "Would remove" : "Removed", neonN, "Neon slot(s),", fileN, "local file(s).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

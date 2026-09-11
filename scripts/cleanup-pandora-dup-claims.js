#!/usr/bin/env node
"use strict";

/**
 * 清理潘朵拉得標重複 claim：同一 account + lotId 的 item 只留最早一筆。
 * 用法：
 *   node scripts/cleanup-pandora-dup-claims.js
 *   node scripts/cleanup-pandora-dup-claims.js --dry-run
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { ensureSchema, getSql } = require("../lib/db");
const { cleanupDuplicatePandoraItemClaims } = require("../lib/rt-pandora-market");

const dryRun = process.argv.includes("--dry-run");

async function main() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.error("缺少 DATABASE_URL／POSTGRES_URL");
    process.exit(1);
  }
  await ensureSchema();
  const sql = getSql();
  const result = await cleanupDuplicatePandoraItemClaims(sql, { dryRun });
  console.log(
    dryRun ? "[dry-run]" : "[done]",
    "itemClaims=",
    result.scanned,
    "dupGroups=",
    result.groups,
    "wouldDelete=",
    result.deleted
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

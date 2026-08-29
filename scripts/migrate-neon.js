#!/usr/bin/env node
"use strict";

/**
 * 建立 Neon 資料表（與 lib/db.js ensureSchema 相同）。
 * 用法：在 .env.local 設定 DATABASE_URL 後執行 npm run db:migrate
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { ensureSchema, getSql } = require("../lib/db");

async function main() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.error("缺少 DATABASE_URL。請複製 .env.example 為 .env.local 並填入 Neon 連線字串。");
    process.exit(1);
  }
  await ensureSchema();
  const sql = getSql();
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`;
  console.log("Schema OK. Tables:", tables.map((r) => r.table_name).join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

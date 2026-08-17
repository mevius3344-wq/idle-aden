"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SAVE = path.join(process.env.DATA_DIR || path.join(ROOT, "data"), "world.json");

let pool = null;
let lastSave = Date.now();
let saving = false;
let pending = false;

function fileSavePath() {
  return SAVE;
}

function usingDb() {
  return !!pool;
}

function lastSaveAt() {
  return lastSave;
}

async function init() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) return { mode: "file", path: SAVE };
  const { Pool } = require("pg");
  const local = /localhost|127\.0\.0\.1/.test(url);
  pool = new Pool({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
    max: 2,
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS world_state (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  return { mode: "postgres" };
}

function readFileWorld() {
  fs.mkdirSync(path.dirname(SAVE), { recursive: true });
  if (!fs.existsSync(SAVE)) return null;
  let raw = fs.readFileSync(SAVE, "utf8");
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

async function load(world) {
  if (pool) {
    const r = await pool.query("SELECT data FROM world_state WHERE id = 1");
    if (r.rows[0] && r.rows[0].data) Object.assign(world, r.rows[0].data);
    return;
  }
  try {
    const data = readFileWorld();
    if (data) Object.assign(world, data);
  } catch (e) {
    console.log("load fail", e.message);
  }
}

async function flush(world) {
  lastSave = Date.now();
  if (pool) {
    await pool.query(
      `INSERT INTO world_state (id, data, updated_at)
       VALUES (1, $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [JSON.stringify(world)]
    );
    return;
  }
  fs.mkdirSync(path.dirname(SAVE), { recursive: true });
  fs.writeFileSync(SAVE, JSON.stringify(world));
}

function save(world) {
  if (saving) {
    pending = true;
    return Promise.resolve();
  }
  saving = true;
  return flush(world)
    .catch((e) => console.log("save fail", e.message))
    .finally(() => {
      saving = false;
      if (pending) {
        pending = false;
        save(world);
      }
    });
}

async function close() {
  if (pool) {
    try { await pool.end(); } catch (_) {}
    pool = null;
  }
}

module.exports = {
  init,
  load,
  save,
  close,
  usingDb,
  lastSaveAt,
  fileSavePath,
};

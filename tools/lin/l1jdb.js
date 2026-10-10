// 讀 l1j-en 資料庫 SQL（db/l1jdb_m10.sql）：rows(table) → [{欄位: 值}]
// 來源：https://github.com/l1j-en/classic （預設放 %TEMP%/l1jen/db/l1jdb_m10.sql，可用 L1JDB 環境變數指定）
const fs = require("fs");
const os = require("os");
const path = require("path");

const SQL = process.env.L1JDB || path.join(os.tmpdir(), "l1jen", "db", "l1jdb_m10.sql");
let _src = null;
const _cache = new Map();

function src() {
  if (_src == null) _src = fs.readFileSync(SQL, "utf8");
  return _src;
}

function columns(table) {
  const s = src();
  const i = s.indexOf("CREATE TABLE `" + table + "`");
  if (i < 0) throw new Error("no table " + table);
  const j = s.indexOf("\n)", i);
  const cols = [];
  for (const m of s.slice(i, j).matchAll(/^\s*`(\w+)`\s/gm)) cols.push(m[1]);
  return cols;
}

function parseTuple(str, pos) {
  const vals = [];
  let i = pos;
  while (i < str.length) {
    while (str[i] === " " || str[i] === ",") i++;
    if (str[i] === ")") return { vals, end: i + 1 };
    if (str[i] === "'") {
      let out = "";
      i++;
      while (i < str.length) {
        const c = str[i];
        if (c === "\\") { const n = str[i + 1]; out += n === "n" ? "\n" : n === "r" ? "\r" : n === "t" ? "\t" : n; i += 2; continue; }
        if (c === "'" && str[i + 1] === "'") { out += "'"; i += 2; continue; }
        if (c === "'") { i++; break; }
        out += c; i++;
      }
      vals.push(out);
    } else {
      let j = i;
      while (j < str.length && str[j] !== "," && str[j] !== ")") j++;
      const raw = str.slice(i, j).trim();
      vals.push(/^null$/i.test(raw) ? null : (raw !== "" && !isNaN(+raw) ? +raw : raw));
      i = j;
    }
  }
  return { vals, end: i };
}

function rows(table) {
  if (_cache.has(table)) return _cache.get(table);
  const cols = columns(table);
  const s = src();
  const head = "INSERT INTO `" + table + "` VALUES ";
  const out = [];
  let i = s.indexOf(head);
  while (i >= 0) {
    let p = i + head.length;
    while (s[p] === "(") {
      const { vals, end } = parseTuple(s, p + 1);
      const o = {};
      cols.forEach((c, k) => { const v = vals[k]; o[c] = typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? +v : v; });
      out.push(o);
      p = end;
      if (s[p] === ",") p++;
      while (s[p] === " " || s[p] === "\n" || s[p] === "\r") p++;
    }
    i = s.indexOf(head, p);
  }
  _cache.set(table, out);
  return out;
}

module.exports = { rows, columns, SQL };

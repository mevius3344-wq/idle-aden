// list.spr 動作表解析（Lin.Helper.Core SprListParser 標準格式移植）
// #<id> <imageCount>[=<linkedId>] <name> 後接 <actId>.<name>(<directional> <frameCount>,<img>.<frame>:<dur>[mods] ...) 與 <attrId>.<name>(params)
const { readText } = require("./text");

const ACTION_RE = /(-?\d+)\.([a-zA-Z_][a-zA-Z0-9_\s-]*)?\((-?\d+)\s+(-?\d+),([^)]*)\)/g;
const ATTR_RE = /(-?\d+)\.([a-zA-Z_][a-zA-Z0-9_\s-]*)?\(([^)]*)\)/g;
const FRAME_RE = /^(-?\d+)\.(-?\d+):(-?\d+)/;

function parseFrames(s) {
  const out = [];
  for (const part of s.split(/\s+/)) {
    const m = FRAME_RE.exec(part);
    if (!m) continue;
    const rest = part.slice(m[0].length);
    out.push({ img: +m[1], frame: +m[2], dur: +m[3], hit: rest.includes("!") });
  }
  return out;
}

function parseEntry(id, header, body) {
  const hm = /^#(\d+)\s+(\d+)(?:=(\d+))?\s*(.*)$/.exec(header);
  const e = { id, count: hm ? +hm[2] : 0, linked: hm && hm[3] ? +hm[3] : null, name: "", actions: {}, attrs: {} };
  const full = ((hm ? hm[4] : "") + " " + body).trim();
  const nameEnd = full.search(/(^|\s)-?\d+\./);
  e.name = (nameEnd < 0 ? full : full.slice(0, nameEnd)).trim();
  const used = [];
  for (const m of full.matchAll(ACTION_RE)) {
    e.actions[+m[1]] = { id: +m[1], name: (m[2] || "").trim(), dir: +m[3] === 1, frames: parseFrames(m[5]) };
    used.push([m.index, m.index + m[0].length]);
  }
  for (const m of full.matchAll(ATTR_RE)) {
    if (used.some(([a, b]) => m.index >= a && m.index < b)) continue;
    const aid = +m[1];
    if (aid >= 100) e.attrs[aid] = m[3].split(/[\s,]+/).filter(Boolean).map(Number);
  }
  e.sprite = e.linked != null ? e.linked : e.id;
  return e;
}

let _cache = null;
function loadListSpr() {
  if (_cache) return _cache;
  const text = readText("list.spr").toString("latin1");
  const lines = text.split(/\r?\n/);
  const map = new Map();
  let cur = null, body = [];
  const flush = () => {
    if (!cur) return;
    const id = +/^#(\d+)/.exec(cur)[1];
    map.set(id, parseEntry(id, cur, body.join(" ")));
  };
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (t.startsWith("#")) { flush(); cur = t; body = []; }
    else if (cur) body.push(t);
  }
  flush();
  _cache = map;
  return map;
}

module.exports = { loadListSpr };

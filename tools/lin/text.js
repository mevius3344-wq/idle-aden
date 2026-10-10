// 客戶端 Text.pak（idx 與內容皆為 L1 區塊加密）
const fs = require("fs");
const path = require("path");
const { CLIENT_ROOT } = require("./pak");
const { decode } = require("./l1crypt");

let _E = null;
function entries() {
  if (_E) return _E;
  const d = decode(fs.readFileSync(path.join(CLIENT_ROOT, "Text.idx")), 4);
  _E = new Map();
  for (let o = 0; o + 28 <= d.length; o += 28) {
    let nm = d.slice(o + 4, o + 24).toString("latin1");
    const z = nm.indexOf("\0");
    if (z >= 0) nm = nm.slice(0, z);
    _E.set(nm.toLowerCase(), { off: d.readUInt32LE(o), size: d.readInt32LE(o + 24) });
  }
  return _E;
}

function readText(name) {
  const e = entries().get(name.toLowerCase());
  if (!e) return null;
  const fd = fs.openSync(path.join(CLIENT_ROOT, "Text.pak"), "r");
  const b = Buffer.alloc(e.size);
  fs.readSync(fd, b, 0, e.size, e.off);
  fs.closeSync(fd);
  return decode(b, 0);
}

/** desc-*.tbl：首行為筆數，其後每行一筆；回傳 lines[]（lines[0]＝首行） */
function readDesc(lang) {
  const b = readText(`desc-${lang}.tbl`);
  const enc = lang === "c" ? "big5" : lang === "k" ? "euc-kr" : lang === "j" ? "shift_jis" : "latin1";
  return new TextDecoder(enc).decode(b).split(/\r?\n/);
}

module.exports = { readText, readDesc };

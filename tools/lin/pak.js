// 天堂客戶端 .idx/.pak 讀取（未加密格式：uint32 count + N×{offset u32, name[20], size u32}）
const fs = require("fs");
const path = require("path");

const CLIENT_ROOT = process.env.LIN_CLIENT || "C:\\Users\\FUTURE\\Desktop\\京沅天堂\\京沅天堂\\京沅天堂";

function openPak(base) {
  const idx = fs.readFileSync(path.join(CLIENT_ROOT, base + ".idx"));
  const count = idx.readUInt32LE(0);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    const o = 4 + i * 28;
    if (o + 28 > idx.length) break;
    const offset = idx.readUInt32LE(o);
    let name = idx.slice(o + 4, o + 24).toString("latin1");
    const z = name.indexOf("\0");
    if (z >= 0) name = name.slice(0, z);
    const size = idx.readUInt32LE(o + 24);
    entries.set(name.toLowerCase(), { name, offset, size });
  }
  const fd = fs.openSync(path.join(CLIENT_ROOT, base + ".pak"), "r");
  return {
    entries,
    read(name) {
      const e = entries.get(String(name).toLowerCase());
      if (!e) return null;
      const buf = Buffer.alloc(e.size);
      fs.readSync(fd, buf, 0, e.size, e.offset);
      return buf;
    },
    close() { fs.closeSync(fd); },
  };
}

module.exports = { CLIENT_ROOT, openPak };

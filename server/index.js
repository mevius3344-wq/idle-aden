"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "0.0.0.0";
const store = require("./store");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

const sessions = new Map();
let world = emptyWorld();

function emptyWorld() {
  return {
    accounts: {},
    market: [],
    parties: [],
    bosses: {
      wb1: bossTpl(25000),
      wb2: bossTpl(80000),
      wb3: bossTpl(200000),
    },
    tax: 0,
  };
}
function bossTpl(max) {
  return { max, hp: max, alive: true, next: 0, ranks: {} };
}

function ensureBosses() {
  for (const id of ["wb1", "wb2", "wb3"]) {
    if (!world.bosses[id]) world.bosses[id] = bossTpl(id === "wb3" ? 200000 : id === "wb2" ? 80000 : 25000);
  }
}
function saveWorld() {
  return store.save(world);
}
function now() { return Date.now(); }
function hash(s) {
  return crypto.createHash("sha256").update("aden|" + s).digest("hex");
}
function uid() { return crypto.randomBytes(6).toString("hex"); }

function send(ses, obj) {
  if (!ses || !ses.ws || ses.ws.readyState !== 1) return;
  try { ses.ws.send(JSON.stringify(obj)); } catch (_) {}
}
function broadcast(obj) {
  const json = JSON.stringify(obj);
  for (const ses of sessions.values()) {
    if (ses.ws && ses.ws.readyState === 1) {
      try { ses.ws.send(json); } catch (_) {}
    }
  }
}
function accOf(ses) {
  return ses.user ? world.accounts[ses.user] : null;
}
function findChar(acc, id) {
  return (acc && acc.chars || []).find((c) => c.id === id) || null;
}
function currentChar(ses) {
  const acc = accOf(ses);
  return acc && ses.charId ? findChar(acc, ses.charId) : null;
}
function publicAccount(acc) {
  return { user: acc.user, chars: acc.chars || [], warehouse: acc.warehouse || [] };
}
function nameTaken(name, exceptId) {
  for (const acc of Object.values(world.accounts)) {
    for (const c of acc.chars || []) {
      if (c.name === name && c.id !== exceptId) return true;
    }
  }
  return false;
}

function broadcastWorld() {
  const maps = {};
  const players = [];
  let online = 0, maxLv = 1, tax = 0;
  for (const ses of sessions.values()) {
    const ch = currentChar(ses);
    if (!ch) continue;
    online += 1;
    const lv = Number(ch.level) || 1;
    if (lv > maxLv) maxLv = lv;
    tax += Number(ch.gold) || 0;
    if (ch.mapId) maps[ch.mapId] = (maps[ch.mapId] || 0) + 1;
    players.push({ name: ch.name, lv, classId: ch.classId, mapId: ch.mapId || "", hunting: !!ch.hunting });
  }
  world.tax = tax;
  broadcast({
    t: "world", online, maps, tax, serverLv: maxLv,
    parties: world.parties, market: world.market, bosses: world.bosses, players,
  });
}
function chatAll(ch, name, msg, cls) {
  broadcast({ t: "chat", ch, name, msg, cls, time: now() });
}

function handle(ses, msg) {
  const t = msg && msg.t;
  switch (t) {
    case "register": return register(ses, msg, false);
    case "login": return register(ses, msg, true);
    case "create": return createChar(ses, msg);
    case "enter": return enter(ses, msg);
    case "sync": return sync(ses, msg);
    case "chat": return chat(ses, msg);
    case "map": return setMap(ses, msg);
    case "marketList": return marketList(ses, msg);
    case "marketBuy": return marketBuy(ses, msg);
    case "partyCreate": return partyCreate(ses, msg);
    case "partyJoin": return partyJoin(ses, msg);
    case "bossHit": return bossHit(ses, msg);
    case "announce": return announce(ses, msg);
    case "changepass": return changePass(ses, msg);
    case "logout":
      ses.charId = null;
      ses.user = null;
      broadcastWorld();
      break;
    default: break;
  }
}

function register(ses, msg, isLogin) {
  const user = String(msg.user || "").trim();
  const passRaw = String(msg.pass || "");
  if (user.length < 2 || passRaw.length < 2) return send(ses, { t: "err", msg: "帳號密碼至少 2 字" });
  const pass = hash(passRaw);
  if (!isLogin) {
    if (world.accounts[user]) return send(ses, { t: "err", msg: "此帳號已存在" });
    world.accounts[user] = { user, pass, chars: [], warehouse: [], last: now() };
    saveWorld();
  }
  const acc = world.accounts[user];
  if (!acc || acc.pass !== pass) return send(ses, { t: "err", msg: "帳號或密碼錯誤" });
  ses.user = user;
  send(ses, { t: "login", account: publicAccount(acc) });
  send(ses, { t: "market", market: world.market });
  broadcastWorld();
}

function createChar(ses, msg) {
  const acc = accOf(ses);
  if (!acc) return;
  if ((acc.chars || []).length >= 3) return send(ses, { t: "err", msg: "最多 3 名角色" });
  const ch = msg.char;
  if (!ch || !String(ch.name || "").trim()) return send(ses, { t: "err", msg: "請輸入名稱" });
  if (nameTaken(ch.name, null)) return send(ses, { t: "err", msg: "名稱已被使用" });
  ch.lastSync = now();
  acc.chars.push(ch);
  saveWorld();
  send(ses, { t: "account", account: publicAccount(acc) });
}

function enter(ses, msg) {
  const acc = accOf(ses);
  if (!acc) return;
  const ch = findChar(acc, msg.id);
  if (!ch) return;
  ses.charId = ch.id;
  const last = Number(ch.lastSync || acc.last || now());
  const offline = Math.max(0, now() - last);
  ch.lastSync = now();
  send(ses, { t: "enter", char: ch, offline, warehouse: acc.warehouse || [] });
  broadcastWorld();
  chatAll("sys", "系統", ch.name + " 進入了亞丁。", "sys");
}

function sync(ses, msg) {
  const acc = accOf(ses);
  if (!acc || !msg.char) return;
  const i = (acc.chars || []).findIndex((c) => c.id === msg.char.id);
  if (i < 0) return;
  msg.char.lastSync = now();
  acc.chars[i] = msg.char;
  acc.last = now();
  ses.charId = msg.char.id;
  if (Array.isArray(msg.warehouse)) acc.warehouse = msg.warehouse;
  if (Date.now() - store.lastSaveAt() > 8000) saveWorld();
}

function chat(ses, msg) {
  const ch = currentChar(ses);
  if (!ch) return;
  let text = String(msg.msg || "").trim();
  if (!text) return;
  if (text.length > 80) text = text.slice(0, 80);
  const channel = msg.ch === "party" ? "party" : "world";
  chatAll(channel, ch.name, text, channel);
}

function setMap(ses, msg) {
  const ch = currentChar(ses);
  if (!ch) return;
  ch.mapId = msg.mapId || "";
  ch.hunting = !!msg.hunting;
  broadcastWorld();
}

function marketList(ses, msg) {
  const ch = currentChar(ses);
  if (!ch || !msg.it || !(Number(msg.price) > 0)) return;
  world.market.unshift({ id: uid(), seller: ch.name, user: ses.user, it: msg.it, price: Number(msg.price) });
  if (world.market.length > 80) world.market.pop();
  saveWorld();
  broadcast({ t: "market", market: world.market });
}

function marketBuy(ses, msg) {
  const ch = currentChar(ses);
  if (!ch) return;
  const idx = world.market.findIndex((x) => x.id === msg.id);
  if (idx < 0) return send(ses, { t: "err", msg: "商品已下架" });
  const row = world.market[idx];
  if ((Number(ch.gold) || 0) < row.price) return send(ses, { t: "err", msg: "金幣不足" });
  ch.gold = Number(ch.gold) - row.price;
  world.market.splice(idx, 1);
  const seller = world.accounts[row.user];
  if (seller && seller.chars && seller.chars[0]) {
    seller.chars[0].gold = (Number(seller.chars[0].gold) || 0) + row.price;
    for (const s of sessions.values()) {
      if (s.user === row.user) send(s, { t: "goldAdd", gold: row.price, msg: "交易所售出 +" + row.price });
    }
  }
  send(ses, { t: "bought", it: row.it, gold: ch.gold });
  saveWorld();
  broadcast({ t: "market", market: world.market });
  chatAll("sys", "交易所", ch.name + " 買下了商品。", "sys");
}

function partyCreate(ses, msg) {
  const ch = currentChar(ses);
  if (!ch) return;
  world.parties.unshift({
    id: uid(), leader: ch.name, leaderId: ch.id, map: msg.map || "大廳",
    max: 5, auto: true, members: [ch.name],
  });
  if (world.parties.length > 30) world.parties.pop();
  broadcastWorld();
  send(ses, { t: "ok", msg: "隊伍已建立" });
}

function partyJoin(ses, msg) {
  const ch = currentChar(ses);
  if (!ch) return;
  const p = world.parties.find((x) => x.id === msg.id);
  if (!p) return;
  p.members = p.members || [];
  if (p.members.length >= (p.max || 5)) return send(ses, { t: "err", msg: "隊伍已滿" });
  if (!p.members.includes(ch.name)) p.members.push(ch.name);
  broadcastWorld();
  send(ses, { t: "ok", msg: "已加入 " + p.leader + " 的隊伍" });
}

function bossHit(ses, msg) {
  const ch = currentChar(ses);
  if (!ch) return;
  const mapId = msg.mapId;
  let dmg = Number(msg.dmg) || 0;
  if (dmg < 1) return;
  if (dmg > 800) dmg = 800;
  const b = world.bosses[mapId];
  if (!b || !b.alive) return;
  b.hp = Math.max(0, (Number(b.hp) || 0) - dmg);
  b.ranks = b.ranks || {};
  b.ranks[ch.name] = (Number(b.ranks[ch.name]) || 0) + dmg;
  if (b.hp <= 0) {
    b.alive = false;
    const wait = mapId === "wb3" ? 480 : mapId === "wb2" ? 300 : 180;
    b.next = now() + wait * 1000;
    broadcast({ t: "mq", text: "⚔ 世界王已被擊敗！" });
    chatAll("sys", "世界王", ch.name + " 參與擊殺了世界王。", "sys");
    const gold = 800 + Math.floor(Math.random() * 400);
    for (const s of sessions.values()) {
      if (s.charId) send(s, { t: "bossKill", mapId, gold, exp: 1200 });
    }
  }
  broadcast({ t: "boss", bosses: world.bosses });
}

function announce(ses, msg) {
  if (!currentChar(ses) || !msg.text) return;
  broadcast({ t: "mq", text: String(msg.text) });
}

function changePass(ses, msg) {
  const acc = accOf(ses);
  if (!acc) return send(ses, { t: "err", msg: "請先登入" });
  const oldRaw = String(msg.oldPass || "");
  const nextRaw = String(msg.newPass || "");
  if (nextRaw.length < 2) return send(ses, { t: "err", msg: "新密碼至少 2 字" });
  if (hash(oldRaw) !== acc.pass) return send(ses, { t: "err", msg: "舊密碼錯誤" });
  if (oldRaw === nextRaw) return send(ses, { t: "err", msg: "新密碼不可與舊密碼相同" });
  acc.pass = hash(nextRaw);
  saveWorld();
  send(ses, { t: "passok", msg: "密碼已更新" });
}

function tick() {
  for (const id of ["wb1", "wb2", "wb3"]) {
    const b = world.bosses[id];
    if (!b) continue;
    if (!b.alive && now() >= Number(b.next || 0)) {
      b.alive = true;
      b.hp = b.max;
      b.ranks = {};
      broadcast({ t: "mq", text: "世界王已重生！" });
    }
  }
  broadcastWorld();
  if (Date.now() - store.lastSaveAt() > 20000) saveWorld();
}

function serveFile(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  if (urlPath.includes("..")) { res.writeHead(400); res.end(); return; }
  const file = path.join(ROOT, urlPath.replace(/^\//, "").replace(/\//g, path.sep));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

let WebSocketServer;
try {
  WebSocketServer = require("ws").WebSocketServer;
} catch (_) {
  console.log("提示：尚未安裝 ws，請執行 npm install");
  process.exit(1);
}

async function start() {
  const info = await store.init();
  await store.load(world);
  ensureBosses();
  if (info.mode === "postgres") console.log("存檔：PostgreSQL");
  else console.log("存檔：檔案 " + info.path);

  const server = http.createServer(serveFile);
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    const ses = { id: uid(), ws, user: null, charId: null };
    sessions.set(ses.id, ses);
    ws.on("message", (buf) => {
      let msg;
      try { msg = JSON.parse(String(buf)); } catch { return; }
      try { handle(ses, msg); } catch (e) { console.log("handle", e); }
    });
    ws.on("close", () => {
      sessions.delete(ses.id);
      broadcastWorld();
    });
  });

  server.listen(PORT, HOST, () => {
    console.log("放置亞丁雲端伺服器 http://" + HOST + ":" + PORT);
    for (const n of Object.values(os.networkInterfaces())) {
      for (const a of n || []) {
        if (a.family === "IPv4" && !a.internal) console.log("區網 http://" + a.address + ":" + PORT);
      }
    }
  });

  setInterval(tick, 2000);
  const shutdown = async () => {
    await saveWorld();
    await store.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((e) => {
  console.log("啟動失敗", e);
  process.exit(1);
});

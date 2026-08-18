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
const BOSS_CFG = {
  wb1: { name: "巨大蟻后", max: 25000, respawn: 1800, reward: { gold: [800, 1200], exp: 1200 } },
  wb2: { name: "死亡騎士", max: 80000, respawn: 3600, reward: { gold: [1200, 2000], exp: 2200 } },
  wb3: { name: "思克巴女皇", max: 160000, respawn: 5400, reward: { gold: [1800, 2800], exp: 3200 } },
  wb4: { name: "巴風特", max: 120000, respawn: 3600, reward: { gold: [2000, 3200], exp: 3600 } },
  wb5: { name: "黑長老", max: 150000, respawn: 5400, reward: { gold: [2400, 3800], exp: 4200 } },
  wb6: { name: "林德拜爾", max: 180000, respawn: 7200, reward: { gold: [3000, 4800], exp: 5000 } },
  wb7: { name: "法利昂", max: 220000, respawn: 7200, reward: { gold: [3200, 5200], exp: 5400 } },
  wb8: { name: "安塔瑞斯", max: 280000, respawn: 10800, reward: { gold: [4000, 6500], exp: 6500 } },
  wb9: { name: "巴拉卡斯", max: 350000, respawn: 14400, reward: { gold: [5000, 8000], exp: 8000 } },
};
const BOSS_IDS = Object.keys(BOSS_CFG);

function bossTpl(id) {
  const cfg = BOSS_CFG[id] || { max: 25000, respawn: 1800 };
  return { max: cfg.max, hp: cfg.max, alive: true, next: 0, ranks: {} };
}

function emptyWorld() {
  const bosses = {};
  for (const id of BOSS_IDS) bosses[id] = bossTpl(id);
  return {
    accounts: {},
    market: [],
    parties: [],
    clans: [],
    bosses,
    tax: 0,
    taxRate: 0.05,
    taxVer: 2,
  };
}
let world = emptyWorld();
const MAX_ONLINE_PER_IP = Math.max(1, Number(process.env.MAX_ONLINE_PER_IP || 1));
const MAX_CONN_PER_IP = Math.max(MAX_ONLINE_PER_IP + 2, Number(process.env.MAX_CONN_PER_IP || 6));

function bossReward(mapId) {
  const r = (BOSS_CFG[mapId] && BOSS_CFG[mapId].reward) || { gold: [800, 1200], exp: 1200 };
  const g = r.gold || [800, 1200];
  const gold = g[0] + Math.floor(Math.random() * Math.max(1, g[1] - g[0] + 1));
  return { gold, exp: r.exp || 1200 };
}

function bossRespawnSec(mapId) {
  return (BOSS_CFG[mapId] && BOSS_CFG[mapId].respawn) || 1800;
}

function fmtWait(sec) {
  sec = Math.max(0, Math.ceil(Number(sec) || 0));
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return m ? `${h} 小時 ${m} 分` : `${h} 小時`;
  }
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${m} 分 ${s} 秒` : `${m} 分`;
  }
  return `${sec} 秒`;
}

function ensureBosses() {
  if (!world.bosses) world.bosses = {};
  let dirty = false;
  const needVer = 2;
  if (world.bossVer !== needVer) {
    for (const id of BOSS_IDS) {
      if (!world.bosses[id]) {
        world.bosses[id] = bossTpl(id);
        dirty = true;
      }
    }
    world.bossVer = needVer;
    dirty = true;
  }
  for (const id of BOSS_IDS) {
    const cfg = BOSS_CFG[id];
    if (!cfg) continue;
    if (!world.bosses[id]) {
      world.bosses[id] = bossTpl(id);
      dirty = true;
    }
    const b = world.bosses[id];
    if (cfg.max && b.max !== cfg.max) {
      b.max = cfg.max;
      if (b.alive !== false) b.hp = cfg.max;
      dirty = true;
    }
    if (b.alive !== false && (!b.hp || b.hp > b.max)) {
      b.hp = b.max;
      dirty = true;
    }
  }
  return dirty;
}
function ensureTax() {
  let dirty = false;
  if (world.taxVer !== 2) {
    world.tax = 0;
    world.taxVer = 2;
    dirty = true;
  }
  const rate = Number(world.taxRate);
  const nextRate = rate > 0 && rate < 1 ? rate : 0.05;
  if (world.taxRate !== nextRate) {
    world.taxRate = nextRate;
    dirty = true;
  }
  world.tax = Math.max(0, Math.floor(Number(world.tax) || 0));
  return dirty;
}
function saveWorld() {
  return store.save(world);
}
function now() { return Date.now(); }
function hash(s) {
  return crypto.createHash("sha256").update("aden|" + s).digest("hex");
}
function uid() { return crypto.randomBytes(6).toString("hex"); }

function normIp(ip) {
  if (!ip) return "unknown";
  let s = String(ip).trim().replace(/^::ffff:/i, "");
  if (s === "::1") s = "127.0.0.1";
  return s;
}
function clientIp(req) {
  const xf = req && req.headers && req.headers["x-forwarded-for"];
  if (xf) return normIp(String(xf).split(",")[0]);
  const real = req && req.headers && req.headers["x-real-ip"];
  if (real) return normIp(real);
  return normIp(req && req.socket && req.socket.remoteAddress);
}
function connCountOnIp(ip) {
  let n = 0;
  for (const s of sessions.values()) if (s.ip === ip) n += 1;
  return n;
}
function onlineCharsOnIp(ip, exceptId) {
  const list = [];
  for (const s of sessions.values()) {
    if (s.ip === ip && s.charId && s.id !== exceptId) list.push(s);
  }
  return list;
}
function dropSes(ses, msg) {
  if (!ses) return;
  send(ses, { t: "kicked", msg: msg || "連線已中斷" });
  ses.user = null;
  ses.charId = null;
  setTimeout(() => {
    try { if (ses.ws) ses.ws.close(); } catch (_) {}
  }, 60);
}

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
  let online = 0, maxLv = 1;
  for (const ses of sessions.values()) {
    const ch = currentChar(ses);
    if (!ch) continue;
    online += 1;
    const lv = Number(ch.level) || 1;
    if (lv > maxLv) maxLv = lv;
    if (ch.mapId) maps[ch.mapId] = (maps[ch.mapId] || 0) + 1;
    players.push({ name: ch.name, lv, classId: ch.classId, mapId: ch.mapId || "", hunting: !!ch.hunting });
  }
  broadcast({
    t: "world", online, maps, tax: world.tax || 0, taxRate: world.taxRate || 0.05, serverLv: maxLv,
    parties: world.parties, clans: world.clans || [], market: world.market, bosses: world.bosses, players,
  });
}
function chatAll(ch, name, msg, cls) {
  broadcast({ t: "chat", ch, name, msg, cls: cls || ch, time: now() });
}
function sendToNames(names, obj) {
  const set = new Set(names || []);
  for (const ses of sessions.values()) {
    const c = currentChar(ses);
    if (c && set.has(c.name)) send(ses, obj);
  }
}
function partyOf(ch) {
  if (!ch) return null;
  return (world.parties || []).find((p) => (p.members || []).includes(ch.name)) || null;
}
function clanOf(ch) {
  if (!ch) return null;
  const list = world.clans || [];
  if (ch.clanId) return list.find((c) => c.id === ch.clanId) || null;
  return list.find((c) => (c.members || []).includes(ch.name)) || null;
}
function setCharClan(ch, clan) {
  ch.clanId = clan ? clan.id : "";
  ch.clanName = clan ? clan.name : "";
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
    case "marketUnlist": return marketUnlist(ses, msg);
    case "partyCreate": return partyCreate(ses, msg);
    case "partyJoin": return partyJoin(ses, msg);
    case "partyLeave": return partyLeave(ses);
    case "clanCreate": return clanCreate(ses, msg);
    case "clanJoin": return clanJoin(ses, msg);
    case "clanLeave": return clanLeave(ses);
    case "bossHit": return bossHit(ses, msg);
    case "announce": return announce(ses, msg);
    case "changepass": return changePass(ses, msg);
    case "shopTax": return shopTax(ses, msg);
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
  for (const s of sessions.values()) {
    if (s !== ses && s.user === user) dropSes(s, "帳號已在其他視窗登入");
  }
  ses.user = user;
  ses.charId = null;
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
  const others = onlineCharsOnIp(ses.ip, ses.id);
  if (others.length >= MAX_ONLINE_PER_IP) {
    return send(ses, { t: "err", msg: "同一網路同時只能進入 " + MAX_ONLINE_PER_IP + " 名角色，請勿多開。" });
  }
  for (const s of sessions.values()) {
    if (s !== ses && s.charId === ch.id) dropSes(s, "角色已在其他視窗進入");
  }
  ses.charId = ch.id;
  const clan = clanOf(ch);
  if (clan) setCharClan(ch, clan);
  else if (ch.clanId) setCharClan(ch, null);
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
  const prev = acc.chars[i];
  if (prev && prev.clanId && !msg.char.clanId) {
    msg.char.clanId = prev.clanId;
    msg.char.clanName = prev.clanName || "";
  }
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
  const channel = msg.ch;
  const payload = { t: "chat", ch: "world", name: ch.name, msg: text, cls: "world", time: now() };
  if (channel === "party") {
    const p = partyOf(ch);
    if (!p) return send(ses, { t: "err", msg: "尚未加入隊伍" });
    payload.ch = "party";
    payload.cls = "party";
    sendToNames(p.members, payload);
    return;
  }
  if (channel === "clan") {
    const clan = clanOf(ch);
    if (!clan) return send(ses, { t: "err", msg: "尚未加入血盟" });
    payload.ch = "clan";
    payload.cls = "clan";
    sendToNames(clan.members, payload);
    return;
  }
  if (channel === "sys") return send(ses, { t: "err", msg: "系統頻道無法發言" });
  chatAll("world", ch.name, text, "world");
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
  if (!ch || !msg.it) return;
  const price = Math.floor(Number(msg.price) || 0);
  if (price < 1 || price > 99999999) return send(ses, { t: "err", msg: "價格需為 1～99,999,999" });
  const qty = Math.max(1, Math.floor(Number(msg.it.qty) || 1));
  const it = { ...msg.it, qty };
  const cat = ["weapon", "armor", "use", "mat"].includes(msg.cat) ? msg.cat : "use";
  world.market.unshift({
    id: uid(), seller: ch.name, user: ses.user, charId: ch.id,
    it, price, cat, time: now(),
  });
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
  if (row.charId === ch.id || (row.user === ses.user && row.seller === ch.name)) {
    return send(ses, { t: "err", msg: "這是你上架的商品，請改下架" });
  }
  if ((Number(ch.gold) || 0) < row.price) return send(ses, { t: "err", msg: "金幣不足" });
  ch.gold = Number(ch.gold) - row.price;
  world.market.splice(idx, 1);
  const seller = world.accounts[row.user];
  if (seller && seller.chars) {
    const sc = seller.chars.find((c) => c.id === row.charId) || seller.chars.find((c) => c.name === row.seller) || seller.chars[0];
    if (sc) {
      sc.gold = (Number(sc.gold) || 0) + row.price;
      for (const s of sessions.values()) {
        if (s.user === row.user && (s.charId === sc.id || !s.charId)) {
          send(s, { t: "goldAdd", gold: row.price, msg: "交易所售出 +" + row.price });
        }
      }
    }
  }
  send(ses, { t: "bought", it: row.it, gold: ch.gold });
  saveWorld();
  broadcast({ t: "market", market: world.market });
  chatAll("sys", "交易所", ch.name + " 買下了商品。", "sys");
}

function marketUnlist(ses, msg) {
  const ch = currentChar(ses);
  if (!ch) return;
  const idx = world.market.findIndex((x) => x.id === msg.id);
  if (idx < 0) return send(ses, { t: "err", msg: "商品已下架" });
  const row = world.market[idx];
  if (row.user !== ses.user && row.charId !== ch.id) return send(ses, { t: "err", msg: "只能下架自己的商品" });
  world.market.splice(idx, 1);
  send(ses, { t: "unlist", it: row.it });
  saveWorld();
  broadcast({ t: "market", market: world.market });
}

function partyCreate(ses, msg) {
  const ch = currentChar(ses);
  if (!ch) return;
  if (partyOf(ch)) return send(ses, { t: "err", msg: "已在隊伍中" });
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
  if (partyOf(ch)) return send(ses, { t: "err", msg: "已在隊伍中" });
  const p = world.parties.find((x) => x.id === msg.id);
  if (!p) return send(ses, { t: "err", msg: "隊伍不存在" });
  p.members = p.members || [];
  if (p.members.length >= (p.max || 5)) return send(ses, { t: "err", msg: "隊伍已滿" });
  if (!p.members.includes(ch.name)) p.members.push(ch.name);
  broadcastWorld();
  send(ses, { t: "ok", msg: "已加入 " + p.leader + " 的隊伍" });
}

function partyLeave(ses) {
  const ch = currentChar(ses);
  if (!ch) return;
  const p = partyOf(ch);
  if (!p) return send(ses, { t: "err", msg: "不在隊伍中" });
  p.members = (p.members || []).filter((n) => n !== ch.name);
  if (!p.members.length) world.parties = world.parties.filter((x) => x.id !== p.id);
  else if (p.leader === ch.name) p.leader = p.members[0];
  broadcastWorld();
  send(ses, { t: "ok", msg: "已離開隊伍" });
}

function clanCreate(ses, msg) {
  const ch = currentChar(ses);
  if (!ch) return;
  if (!world.clans) world.clans = [];
  if (clanOf(ch)) return send(ses, { t: "err", msg: "已有血盟" });
  const name = String(msg.name || "").trim();
  if (name.length < 2 || name.length > 8) return send(ses, { t: "err", msg: "血盟名稱 2～8 字" });
  if (world.clans.some((c) => c.name === name)) return send(ses, { t: "err", msg: "此血盟名稱已被使用" });
  const clan = { id: uid(), name, leader: ch.name, leaderId: ch.id, members: [ch.name], max: 20 };
  world.clans.unshift(clan);
  if (world.clans.length > 80) world.clans.pop();
  setCharClan(ch, clan);
  saveWorld();
  send(ses, { t: "clan", clanId: clan.id, clanName: clan.name });
  broadcastWorld();
  chatAll("sys", "血盟", ch.name + " 成立了血盟「" + clan.name + "」。", "sys");
}

function clanJoin(ses, msg) {
  const ch = currentChar(ses);
  if (!ch) return;
  if (!world.clans) world.clans = [];
  if (clanOf(ch)) return send(ses, { t: "err", msg: "已有血盟" });
  const clan = world.clans.find((x) => x.id === msg.id);
  if (!clan) return send(ses, { t: "err", msg: "血盟不存在" });
  clan.members = clan.members || [];
  if (clan.members.length >= (clan.max || 20)) return send(ses, { t: "err", msg: "血盟已滿" });
  if (!clan.members.includes(ch.name)) clan.members.push(ch.name);
  setCharClan(ch, clan);
  saveWorld();
  send(ses, { t: "clan", clanId: clan.id, clanName: clan.name });
  broadcastWorld();
  sendToNames(clan.members, { t: "chat", ch: "clan", name: "血盟", msg: ch.name + " 加入了血盟。", cls: "sys", time: now() });
}

function clanLeave(ses) {
  const ch = currentChar(ses);
  if (!ch) return;
  if (!world.clans) world.clans = [];
  const clan = clanOf(ch);
  if (!clan) return send(ses, { t: "err", msg: "尚未加入血盟" });
  clan.members = (clan.members || []).filter((n) => n !== ch.name);
  if (!clan.members.length) world.clans = world.clans.filter((x) => x.id !== clan.id);
  else if (clan.leader === ch.name) clan.leader = clan.members[0];
  setCharClan(ch, null);
  saveWorld();
  send(ses, { t: "clan", clanId: "", clanName: "" });
  broadcastWorld();
  send(ses, { t: "ok", msg: "已退出血盟" });
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
    const wait = bossRespawnSec(mapId);
    b.next = now() + wait * 1000;
    const bname = (BOSS_CFG[mapId] && BOSS_CFG[mapId].name) || "世界王";
    broadcast({ t: "mq", text: `⚔ ${bname} 已被擊敗！${fmtWait(wait)} 後重生。` });
    chatAll("sys", "世界王", ch.name + " 參與擊殺了「" + bname + "」。", "sys");
    const rw = bossReward(mapId);
    for (const s of sessions.values()) {
      if (s.charId) send(s, { t: "bossKill", mapId, gold: rw.gold, exp: rw.exp });
    }
  }
  broadcast({ t: "boss", bosses: world.bosses });
}

function shopTax(ses, msg) {
  if (!currentChar(ses)) return;
  const fee = Math.floor(Number(msg.fee) || 0);
  if (fee < 1 || fee > 100000) return;
  world.tax = Math.max(0, Math.floor(Number(world.tax) || 0)) + fee;
  saveWorld();
  broadcastWorld();
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
  for (const id of BOSS_IDS) {
    const b = world.bosses[id];
    if (!b) continue;
    if (!b.alive && now() >= Number(b.next || 0)) {
      b.alive = true;
      b.hp = b.max;
      b.ranks = {};
      b.next = 0;
      const bname = (BOSS_CFG[id] && BOSS_CFG[id].name) || "世界王";
      broadcast({ t: "mq", text: `⚔ ${bname} 已重生！` });
      broadcast({ t: "boss", bosses: world.bosses });
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
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    });
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
  if (ensureBosses()) await saveWorld();
  if (ensureTax()) await saveWorld();
  if (!Array.isArray(world.clans)) world.clans = [];
  if (!Array.isArray(world.parties)) world.parties = [];
  if (info.mode === "postgres") console.log("存檔：PostgreSQL");
  else console.log("存檔：檔案 " + info.path);

  const server = http.createServer(serveFile);
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const ip = clientIp(req);
    if (connCountOnIp(ip) >= MAX_CONN_PER_IP) {
      try {
        ws.send(JSON.stringify({ t: "kicked", msg: "此網路連線過多，請稍後再試" }));
        ws.close();
      } catch (_) {}
      return;
    }
    const ses = { id: uid(), ws, user: null, charId: null, ip };
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
    console.log("同 IP 同時進場上限：" + MAX_ONLINE_PER_IP);
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

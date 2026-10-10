"use strict";

/**
 * GM API（檔案模式）：無 DATABASE_URL 時與 lib/rt-gm.js 相同路徑／回應格式。
 * 資料：accounts.json（封鎖）、gm-rates.json（倍率）、gm-mail.json（GM 信箱）、gm-audit.json（操作紀錄）。
 */

const fs = require("fs");
const path = require("path");
const G = require("./rt-gm");
const { applyCreditGold } = require("./rt-cloud-wallet");

const AUDIT_MAX = 500;
const MAIL_KEEP_DONE = 2000;

function createFileGmApi(ctx) {
  const {
    dataDir,
    cloudRoot,
    ratesFile,
    loadAccounts,
    saveAccounts,
    loadCharNames,
    sessions,
    presenceRows,
    presenceTtlMs,
    walletMutate,
    authFromBody,
    getServerRates,
    normalizeAccountId,
    accountKey,
    clientIp,
    json,
    readBody,
  } = ctx;

  const MAIL_FILE = path.join(dataDir, "gm-mail.json");
  const AUDIT_FILE = path.join(dataDir, "gm-audit.json");

  function readFile(file, fallback) {
    try {
      if (!fs.existsSync(file)) return fallback;
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      return data && typeof data === "object" ? data : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeFile(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data), "utf8");
    fs.renameSync(tmp, file);
  }

  function loadMail() {
    const m = readFile(MAIL_FILE, null);
    return m && Array.isArray(m.grants) ? m : { seq: 0, grants: [] };
  }

  function saveMail(m) {
    const pending = m.grants.filter((g) => !g.claimedAt && !g.cancelledAt);
    const done = m.grants.filter((g) => g.claimedAt || g.cancelledAt).slice(-MAIL_KEEP_DONE);
    m.grants = done.concat(pending).sort((a, b) => a.id - b.id);
    writeFile(MAIL_FILE, m);
  }

  function audit(ip, action, target, detail) {
    try {
      const log = readFile(AUDIT_FILE, { seq: 0, rows: [] });
      if (!Array.isArray(log.rows)) log.rows = [];
      log.seq = (Number(log.seq) || 0) + 1;
      log.rows.unshift({
        id: log.seq,
        at: Date.now(),
        action,
        target: String(target || "").slice(0, 80),
        detail: detail || {},
        ip: String(ip || "").slice(0, 64),
      });
      log.rows = log.rows.slice(0, AUDIT_MAX);
      writeFile(AUDIT_FILE, log);
    } catch (e) {
      console.error("GM_FILE_AUDIT", e && e.message ? e.message : e);
    }
  }

  function findAccount(raw) {
    const account = normalizeAccountId(raw);
    if (!account) return null;
    const key = accountKey(account);
    const map = loadAccounts();
    const row = map[key];
    if (!row) return null;
    return { key, account: row.account || account, row, map };
  }

  function loadRatesCfg() {
    return readFile(ratesFile, null);
  }

  function effectiveRates(cfg, now) {
    const base = getServerRates();
    const out = { expMult: 1, goldMult: base.goldMult, dropMult: base.dropMult, rateEndsAt: 0, rateLabel: "" };
    if (!cfg) return out;
    const endsAt = Math.max(0, Number(cfg.endsAt) || 0);
    if (endsAt && endsAt <= now) return out;
    out.expMult = G.clampMult(cfg.expMult, 1);
    out.goldMult = G.clampMult(cfg.goldMult, base.goldMult);
    out.dropMult = G.clampMult(cfg.dropMult, base.dropMult);
    out.rateEndsAt = endsAt;
    out.rateLabel = String(cfg.label || "").slice(0, 40);
    return out;
  }

  function accountDirs(key, account) {
    const dirs = account ? [path.join(cloudRoot, account)] : [];
    if (key && key !== account) dirs.push(path.join(cloudRoot, key));
    return dirs;
  }

  function readSlot(key, account, slot) {
    for (const dir of accountDirs(key, account)) {
      const file = path.join(dir, "slot-" + slot + ".json");
      const data = readFile(file, null);
      if (data && data.p) {
        let mtime = 0;
        try {
          mtime = fs.statSync(file).mtimeMs;
        } catch (e) {}
        return { data, mtime };
      }
    }
    return null;
  }

  async function body(req) {
    try {
      return JSON.parse((await readBody(req)) || "{}") || {};
    } catch (e) {
      return null;
    }
  }

  /** 心跳用：此帳號＋存檔位待領信件數 */
  function pendingMailCount(key, slot) {
    const s = Math.floor(Number(slot) || 0);
    if (s < 1) return 0;
    return loadMail().grants.filter(
      (g) => g.accountKey === key && !g.claimedAt && !g.cancelledAt && (g.slot == null || g.slot === s)
    ).length;
  }

  /* ───────── 玩家端 ───────── */

  async function mailClaim(req, res) {
    const data = await body(req);
    if (!data) return json(res, 400, { ok: false, error: "bad json" });
    const auth = authFromBody(data);
    if (!auth.ok) return json(res, 401, { ok: false, error: auth.error || "auth_required", message: "登入已失效，請重新登入。" });
    const ak = accountKey(auth.account);
    if (sessions && !(await sessions.verify(ak, auth.sessionId))) {
      return json(res, 401, { ok: false, error: "session_invalid", message: "登入已失效，請重新登入。" });
    }
    const acc = findAccount(auth.account);
    if (acc && G.banActive(acc.row.bannedUntil)) {
      return json(res, 403, { ok: false, error: "banned", bannedUntil: Number(acc.row.bannedUntil), message: G.banMessage(acc.row.bannedUntil, acc.row.banReason) });
    }
    const slot = Math.max(1, Math.min(8, Math.floor(Number(data.slot) || 1)));
    const now = Date.now();
    const mail = loadMail();
    const picked = mail.grants
      .filter((g) => g.accountKey === ak && !g.claimedAt && !g.cancelledAt && (g.slot == null || g.slot === slot))
      .slice(0, G.CLAIM_BATCH);
    if (!picked.length) return json(res, 200, { ok: true, items: [], gold: 0 });

    const items = [];
    let gold = 0;
    const goldIds = [];
    for (const g of picked) {
      if (g.kind === "gold") {
        gold += Math.max(0, Math.floor(Number(g.amount) || 0));
        goldIds.push(g.id);
        continue;
      }
      items.push({
        grantId: g.id,
        kind: g.kind === "card" ? "card" : "item",
        id: String(g.itemId),
        cnt: Math.max(1, Math.floor(Number(g.cnt) || 1)),
        en: Math.max(0, Math.floor(Number(g.en) || 0)),
        bless: !!g.bless,
        uid: G.newGrantUid(),
        note: String(g.note || ""),
      });
    }
    let goldAfter = null;
    let walletRev = null;
    if (gold > 0) {
      const mut = walletMutate(auth.account, slot, (save) => applyCreditGold(save, gold));
      if (mut && mut.ok) {
        goldAfter = mut.goldAfter;
        walletRev = mut.walletRev;
      } else {
        // 角色尚無雲端存檔：金幣留待下次領
        gold = 0;
        goldIds.length = 0;
      }
    }
    const claimed = new Set(items.map((it) => it.grantId).concat(goldIds));
    for (const g of mail.grants) {
      if (claimed.has(g.id)) {
        g.claimedAt = now;
        g.claimedSlot = slot;
      }
    }
    saveMail(mail);
    return json(res, 200, { ok: true, items, gold, goldAfter, walletRev, slot });
  }

  /* ───────── GM 端 ───────── */

  function overview(res) {
    const now = Date.now();
    const cfg = loadRatesCfg();
    const map = loadAccounts();
    let banned = 0;
    for (const k of Object.keys(map)) if (G.banActive(map[k] && map[k].bannedUntil, now)) banned++;
    const pending = loadMail().grants.filter((g) => !g.claimedAt && !g.cancelledAt).length;
    return json(res, 200, {
      ok: true,
      now,
      storage: "file",
      rates: { config: cfg, effective: effectiveRates(cfg, now), envBase: getServerRates(), max: G.RATE_MAX },
      counts: { accounts: Object.keys(map).length, banned, pendingGrants: pending },
    });
  }

  function search(res, q) {
    const s = String(q || "").trim().slice(0, 32).toLowerCase();
    if (!s) return json(res, 200, { ok: true, accounts: [], chars: [] });
    const now = Date.now();
    const map = loadAccounts();
    const accounts = Object.keys(map)
      .map((k) => map[k])
      .filter((r) => r && String(r.account || "").toLowerCase().indexOf(s) >= 0)
      .sort((a, b) => String(a.account).localeCompare(String(b.account)))
      .slice(0, 30)
      .map((r) => ({ account: r.account, createdAt: Number(r.createdAt) || 0, banned: G.banActive(r.bannedUntil, now) }));
    const names = loadCharNames();
    const chars = Object.keys(names)
      .map((k) => names[k])
      .filter((r) => r && String(r.name || "").toLowerCase().indexOf(s) >= 0)
      .slice(0, 30)
      .map((r) => ({ name: r.name, account: r.account, slot: Number(r.slot) || 0 }));
    return json(res, 200, { ok: true, accounts, chars });
  }

  async function online(res, q) {
    const now = Date.now();
    const filter = String(q || "").trim().toLowerCase().slice(0, 32);
    const map = loadAccounts();
    const byAcc = new Map();
    function ensure(acc) {
      const name = String(acc || "").trim();
      if (!name) return null;
      const lk = name.toLowerCase();
      let row = byAcc.get(lk);
      if (!row) {
        const reg = map[accountKey(name)];
        row = {
          account: (reg && reg.account) || name,
          source: "online",
          online: true,
          banned: !!(reg && G.banActive(reg.bannedUntil, now)),
          lastSeenMs: 0,
          chars: [],
          maps: [],
        };
        byAcc.set(lk, row);
      }
      return row;
    }
    for (const p of presenceRows()) {
      if (!p || now - (Number(p.lastSeen) || 0) > presenceTtlMs) continue;
      const row = ensure(p.account);
      if (!row) continue;
      row.lastSeenMs = Math.max(row.lastSeenMs, Number(p.lastSeen) || 0);
      if (p.name && !row.chars.some((c) => c.name === p.name && c.slot === Number(p.slot))) {
        row.chars.push({ slot: Number(p.slot) || 0, name: p.name, lv: Number(p.lv) || 0, clsName: G.CLS_NAMES[p.cls] || String(p.cls || ""), mapId: p.mapId || "", mapName: p.mapName || "" });
      }
      const label = String(p.mapName || p.mapId || "").trim();
      if (label && row.maps.indexOf(label) < 0) row.maps.push(label);
    }
    if (sessions && typeof sessions.list === "function") {
      for (const s of await sessions.list()) {
        const reg = map[s.accountKey];
        const row = ensure((reg && reg.account) || s.accountKey);
        if (row) row.lastSeenMs = Math.max(row.lastSeenMs, s.lastSeenMs);
      }
    }
    for (const row of byAcc.values()) {
      if (row.chars.length) continue;
      const key = accountKey(row.account);
      for (let i = 1; i <= 8; i++) {
        const got = readSlot(key, row.account, i);
        if (got) row.chars.push({ slot: i, name: got.data.p.name || "", lv: Number(got.data.p.lv) || 0, clsName: G.CLS_NAMES[got.data.p.cls] || got.data.p.cls || "", mapId: "", mapName: "" });
      }
    }
    let list = Array.from(byAcc.values());
    if (filter) {
      list = list.filter((r) => (r.account + " " + r.chars.map((c) => c.name).join(" ") + " " + r.maps.join(" ")).toLowerCase().indexOf(filter) >= 0);
    }
    list.sort((a, b) => b.lastSeenMs - a.lastSeenMs);
    list = list.slice(0, 100).map((r) =>
      Object.assign(r, { charCount: r.chars.length, mapLabel: r.maps.slice(0, 2).join("、") })
    );
    return json(res, 200, { ok: true, now, online: list, total: list.length, ttlMs: presenceTtlMs });
  }

  async function accountDetail(res, raw) {
    const acc = findAccount(raw);
    if (!acc) return json(res, 404, { ok: false, error: "missing", message: "查無此帳號。" });
    const now = Date.now();
    const slots = [];
    for (let i = 1; i <= 8; i++) {
      const got = readSlot(acc.key, acc.account, i);
      if (!got) continue;
      const p = got.data.p;
      slots.push({
        slot: i,
        empty: false,
        name: p.name || "",
        cls: p.cls || "",
        clsName: G.CLS_NAMES[p.cls] || p.cls || "",
        lv: Number(p.lv) || 0,
        gold: Math.max(0, Math.floor(Number(p.gold) || 0)),
        invCount: Array.isArray(p.inv) ? p.inv.length : 0,
        updatedAt: Math.floor(got.mtime) || 0,
      });
    }
    let lastSeenMs = 0;
    if (sessions && typeof sessions.list === "function") {
      const s = (await sessions.list()).find((x) => x.accountKey === acc.key);
      if (s) lastSeenMs = s.lastSeenMs;
    }
    const grants = loadMail()
      .grants.filter((g) => g.accountKey === acc.key)
      .sort((a, b) => b.id - a.id)
      .slice(0, 40)
      .map((g) => ({
        id: g.id,
        slot: g.slot == null ? null : g.slot,
        kind: g.kind,
        itemId: g.itemId || null,
        cnt: Number(g.cnt) || 0,
        en: Number(g.en) || 0,
        bless: !!g.bless,
        amount: Number(g.amount) || 0,
        note: g.note || "",
        createdAt: g.createdAt || 0,
        claimedAt: g.claimedAt || 0,
        claimedSlot: g.claimedSlot == null ? null : g.claimedSlot,
        cancelledAt: g.cancelledAt || 0,
      }));
    return json(res, 200, {
      ok: true,
      account: acc.account,
      createdAt: Number(acc.row.createdAt) || 0,
      bannedUntil: Number(acc.row.bannedUntil) || 0,
      banned: G.banActive(acc.row.bannedUntil, now),
      banReason: acc.row.banReason || "",
      lastSeenMs,
      slots,
      grants,
    });
  }

  function slotInventory(res, raw, slotRaw) {
    const acc = findAccount(raw);
    if (!acc) return json(res, 404, { ok: false, error: "missing", message: "查無此帳號。" });
    const slot = Math.max(1, Math.min(8, Math.floor(Number(slotRaw) || 1)));
    const got = readSlot(acc.key, acc.account, slot);
    if (!got) return json(res, 404, { ok: false, error: "no_save", message: "此存檔位沒有雲端角色。" });
    const out = G.slotInventoryPayload(acc.account, slot, got.data, Math.floor(got.mtime));
    out.source = "server";
    out.summary.source = "server";
    return json(res, 200, out);
  }

  async function grant(req, res, ip) {
    const data = await body(req);
    if (!data) return json(res, 400, { ok: false, error: "bad json" });
    const acc = findAccount(data.account);
    if (!acc) return json(res, 404, { ok: false, error: "missing", message: "查無此帳號。" });
    const slotN = Math.floor(Number(data.slot) || 0);
    const slot = slotN >= 1 && slotN <= 8 ? slotN : null;
    const note = String(data.note || "").replace(/[<>]/g, "").trim().slice(0, 60);
    const now = Date.now();
    const mail = loadMail();
    const row = { id: (Number(mail.seq) || 0) + 1, accountKey: acc.key, account: acc.account, slot, createdAt: now, note };

    if (data.kind === "gold") {
      const amount = Math.floor(Number(data.amount) || 0);
      if (amount < 1 || amount > G.GRANT_GOLD_MAX) {
        return json(res, 400, { ok: false, error: "bad_amount", message: "金幣數量需介於 1 ～ " + G.GRANT_GOLD_MAX.toLocaleString() + "。" });
      }
      Object.assign(row, { kind: "gold", amount });
    } else {
      const itemId = String(data.itemId || "").trim();
      if (!/^[A-Za-z0-9_]{1,64}$/.test(itemId)) return json(res, 400, { ok: false, error: "bad_item", message: "物品代碼格式錯誤。" });
      const db = G.loadItemDb();
      const d = db ? db[itemId] : null;
      if (db && !d) return json(res, 400, { ok: false, error: "unknown_item", message: "物品資料庫中沒有「" + itemId + "」。" });
      const isEquip = !!(d && G.EQUIP_TYPES.has(d.type) && !d.isArrow);
      Object.assign(row, {
        kind: d && d.eff === "card" ? "card" : "item",
        itemId,
        cnt: Math.max(1, Math.min(G.GRANT_CNT_MAX, Math.floor(Number(data.cnt) || 1))),
        en: isEquip ? Math.max(0, Math.min(G.GRANT_EN_MAX, Math.floor(Number(data.en) || 0))) : 0,
        bless: isEquip && data.bless === true,
        name: d ? d.n : "",
      });
    }
    mail.seq = row.id;
    mail.grants.push(row);
    saveMail(mail);
    audit(ip, row.kind === "gold" ? "grant_gold" : "grant_item", acc.account, row);
    return json(res, 200, { ok: true, id: row.id });
  }

  async function grantCancel(req, res, ip) {
    const data = await body(req);
    if (!data) return json(res, 400, { ok: false, error: "bad json" });
    const id = Math.floor(Number(data.id) || 0);
    if (id < 1) return json(res, 400, { ok: false, error: "bad_id" });
    const mail = loadMail();
    const g = mail.grants.find((x) => x.id === id);
    if (!g || g.claimedAt || g.cancelledAt) return json(res, 409, { ok: false, error: "not_pending", message: "此筆已被領取或已取消。" });
    g.cancelledAt = Date.now();
    saveMail(mail);
    audit(ip, "grant_cancel", g.account, { id, kind: g.kind, itemId: g.itemId, cnt: g.cnt, amount: g.amount });
    return json(res, 200, { ok: true });
  }

  async function ban(req, res, ip) {
    const data = await body(req);
    if (!data) return json(res, 400, { ok: false, error: "bad json" });
    const acc = findAccount(data.account);
    if (!acc) return json(res, 404, { ok: false, error: "missing", message: "查無此帳號。" });
    const hours = Number(data.hours);
    const permanent = !Number.isFinite(hours) || hours <= 0;
    const until = Math.floor(permanent ? G.PERMA_BAN_UNTIL : Date.now() + Math.min(hours, 24 * 3650) * 3600000);
    const reason = String(data.reason || "").replace(/[<>]/g, "").trim().slice(0, 100);
    acc.row.bannedUntil = until;
    acc.row.banReason = reason;
    acc.map[acc.key] = acc.row;
    saveAccounts(acc.map);
    if (sessions) await sessions.release(acc.key, "");
    audit(ip, "ban", acc.account, { until, permanent, hours: permanent ? 0 : hours, reason });
    return json(res, 200, { ok: true, bannedUntil: until, permanent });
  }

  async function unban(req, res, ip) {
    const data = await body(req);
    if (!data) return json(res, 400, { ok: false, error: "bad json" });
    const acc = findAccount(data.account);
    if (!acc) return json(res, 404, { ok: false, error: "missing", message: "查無此帳號。" });
    acc.row.bannedUntil = 0;
    acc.row.banReason = "";
    acc.map[acc.key] = acc.row;
    saveAccounts(acc.map);
    audit(ip, "unban", acc.account, {});
    return json(res, 200, { ok: true });
  }

  async function kick(req, res, ip) {
    const data = await body(req);
    if (!data) return json(res, 400, { ok: false, error: "bad json" });
    const acc = findAccount(data.account);
    if (!acc) return json(res, 404, { ok: false, error: "missing", message: "查無此帳號。" });
    if (sessions) await sessions.release(acc.key, "");
    audit(ip, "kick", acc.account, {});
    return json(res, 200, { ok: true });
  }

  async function setRates(req, res, ip) {
    const data = await body(req);
    if (!data) return json(res, 400, { ok: false, error: "bad json" });
    const now = Date.now();
    if (data.reset === true) {
      try {
        if (fs.existsSync(ratesFile)) fs.unlinkSync(ratesFile);
      } catch (e) {}
      audit(ip, "rates_reset", "", {});
      return json(res, 200, { ok: true, effective: effectiveRates(null, now) });
    }
    const base = getServerRates();
    let endsAt = Math.floor(Number(data.endsAt) || 0);
    if (endsAt && endsAt <= now) return json(res, 400, { ok: false, error: "bad_end", message: "結束時間必須晚於現在。" });
    if (endsAt < 0) endsAt = 0;
    const cfg = {
      expMult: G.clampMult(data.expMult, 1),
      goldMult: G.clampMult(data.goldMult, base.goldMult),
      dropMult: G.clampMult(data.dropMult, base.dropMult),
      endsAt,
      label: String(data.label || "").replace(/[<>]/g, "").trim().slice(0, 40),
      updatedAt: now,
    };
    writeFile(ratesFile, cfg);
    audit(ip, "rates_set", "", cfg);
    return json(res, 200, { ok: true, config: cfg, effective: effectiveRates(cfg, now) });
  }

  function auditList(res, limitRaw) {
    const limit = Math.max(1, Math.min(200, Math.floor(Number(limitRaw) || 60)));
    const log = readFile(AUDIT_FILE, { rows: [] });
    return json(res, 200, { ok: true, rows: (log.rows || []).slice(0, limit) });
  }

  async function handle(req, res, u) {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
      return res.end();
    }
    if (u === "/api/gm/mail/claim" && req.method === "POST") return mailClaim(req, res);

    const auth = G.gmAuthCheck(req);
    if (!auth.ok) return json(res, auth.code, { ok: false, error: auth.error, message: auth.message });
    const ip = auth.ip || clientIp(req);
    const q = new URL(req.url || "/", "http://localhost").searchParams;

    if (req.method === "GET") {
      if (u === "/api/gm/overview") return overview(res);
      if (u === "/api/gm/items") return json(res, 200, { ok: true, items: G.itemListPayload() });
      if (u === "/api/gm/search") return search(res, q.get("q"));
      if (u === "/api/gm/online") return online(res, q.get("q"));
      if (u === "/api/gm/account") return accountDetail(res, q.get("account"));
      if (u === "/api/gm/inventory") return slotInventory(res, q.get("account"), q.get("slot"));
      if (u === "/api/gm/audit") return auditList(res, q.get("limit"));
    }
    if (req.method === "POST") {
      if (u === "/api/gm/grant") return grant(req, res, ip);
      if (u === "/api/gm/grant/cancel") return grantCancel(req, res, ip);
      if (u === "/api/gm/ban") return ban(req, res, ip);
      if (u === "/api/gm/unban") return unban(req, res, ip);
      if (u === "/api/gm/kick") return kick(req, res, ip);
      if (u === "/api/gm/rates") return setRates(req, res, ip);
    }
    return json(res, 404, { ok: false, error: "unknown gm api", path: u });
  }

  return { handle, pendingMailCount };
}

module.exports = { createFileGmApi };

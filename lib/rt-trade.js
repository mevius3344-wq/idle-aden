"use strict";

/**
 * 玩家對玩家交易（原版風：邀請 → 雙方放物品／金幣 → 雙方鎖定 → 成交）。
 * 鎖定時由伺服器從「自己的」雲端存檔扣物／扣金（託管）；成交或取消後，貨物以待領取方式
 * 交給對方／退回本人，由收貨者自己的請求寫入其雲端存檔（不替別人的存檔寫入）。
 */

const fs = require("fs");
const crypto = require("crypto");

const TRADE_MAX_ITEMS = 5;
const TRADE_ASK_MS = 15000;
const TRADE_IDLE_MS = 5 * 60 * 1000;
const TRADE_GOLD_MAX = 2000000000;

function createTradeApi(deps) {
  const {
    json,
    readBody,
    requireAuth,
    walletMutate,
    wallet,
    sanitizeItem,
    sanitizeName,
    memberKey,
    presenceGet,
    presenceTtlMs,
    pushEvent,
    tradeLog,
    persistPath,
    sameAccount,
  } = deps;

  const trades = new Map();
  const byKey = new Map();
  const claims = new Map();
  let saveTimer = null;

  function newId(prefix) {
    return prefix + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
  }

  function saveSoon() {
    if (saveTimer || !persistPath) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        const active = [];
        for (const T of trades.values()) {
          if (T && (T.state === "ask" || T.state === "open")) active.push(T);
        }
        const out = {};
        for (const [k, arr] of claims.entries()) if (arr && arr.length) out[k] = arr;
        fs.writeFileSync(persistPath, JSON.stringify({ trades: active, claims: out, savedAt: Date.now() }, null, 2), "utf8");
      } catch (e) {
        console.warn("[trade] save failed:", e && e.message ? e.message : e);
      }
    }, 300);
  }

  function pushClaim(side, payload, reason, tradeId, fromName) {
    const items = (payload && payload.items) || [];
    const gold = Math.max(0, Math.floor(Number(payload && payload.gold) || 0));
    if (!items.length && !gold) return;
    const list = claims.get(side.key) || [];
    list.push({
      id: newId("C"),
      tradeId: tradeId,
      account: side.account,
      slot: side.slot,
      items: items.map((x) => Object.assign({}, x)),
      gold: gold,
      reason: reason,
      fromName: fromName || "",
      at: Date.now(),
    });
    claims.set(side.key, list.slice(-200));
  }

  /** 伺服器重啟：進行中交易一律取消，已託管的貨退回本人 */
  function load() {
    if (!persistPath) return;
    try {
      if (!fs.existsSync(persistPath)) return;
      const raw = JSON.parse(fs.readFileSync(persistPath, "utf8")) || {};
      Object.keys(raw.claims || {}).forEach((k) => {
        const arr = Array.isArray(raw.claims[k]) ? raw.claims[k] : [];
        if (arr.length) claims.set(k, arr);
      });
      (Array.isArray(raw.trades) ? raw.trades : []).forEach((T) => {
        (T.sides || []).forEach((s) => {
          if (s && s.escrow) pushClaim(s, s.escrow, "return", T.id, "");
        });
      });
      saveSoon();
    } catch (e) {
      console.warn("[trade] load failed:", e && e.message ? e.message : e);
    }
  }

  function online(key, now) {
    const p = presenceGet(key);
    if (!p) return null;
    if ((now || Date.now()) - (p.lastSeen || 0) > presenceTtlMs) return null;
    return p;
  }

  function sideOf(T, key) {
    if (!T) return -1;
    if (T.sides[0].key === key) return 0;
    if (T.sides[1].key === key) return 1;
    return -1;
  }

  function pubSide(s, mine) {
    return {
      name: s.name,
      key: s.key,
      gold: s.gold,
      locked: !!s.locked,
      items: s.items.map((x) => (mine ? { uid: x.uid, cnt: x.cnt, item: x.item } : { cnt: x.cnt, item: x.item })),
    };
  }

  function pub(T, key) {
    if (!T) return null;
    const i = sideOf(T, key);
    if (i < 0) return null;
    return {
      id: T.id,
      state: T.state,
      rev: T.rev,
      requester: i === 0,
      askLeftMs: T.state === "ask" ? Math.max(0, T.askUntil - Date.now()) : 0,
      reason: T.reason || "",
      me: pubSide(T.sides[i], true),
      them: pubSide(T.sides[1 - i], false),
    };
  }

  function notify(T, extra) {
    T.rev += 1;
    T.updatedAt = Date.now();
    T.sides.forEach((s) => {
      pushEvent(Object.assign({ type: "trade", toKey: s.key, trade: pub(T, s.key) }, extra || {}));
    });
    saveSoon();
  }

  function finish(T, state, reason) {
    T.state = state;
    T.reason = reason || "";
    T.sides.forEach((s) => {
      if (byKey.get(s.key) === T.id) byKey.delete(s.key);
    });
    notify(T);
    trades.delete(T.id);
  }

  function cancel(T, reason) {
    if (!T || (T.state !== "ask" && T.state !== "open")) return;
    T.sides.forEach((s) => {
      if (s.escrow) pushClaim(s, s.escrow, "return", T.id, "");
      s.escrow = null;
      s.locked = false;
    });
    finish(T, "cancel", reason);
    T.sides.forEach((s) => notifyClaim(s.key));
  }

  function notifyClaim(key) {
    const n = (claims.get(key) || []).length;
    if (n) pushEvent({ type: "trade_claim", toKey: key, count: n });
  }

  function complete(T) {
    const [a, b] = T.sides;
    pushClaim(b, a.escrow, "trade", T.id, a.name);
    pushClaim(a, b.escrow, "trade", T.id, b.name);
    const summary = (s) =>
      s.items.map((x) => (x.item._n || x.item.id) + (x.cnt > 1 ? "x" + x.cnt : "")).join("、") +
      (s.gold ? (s.items.length ? "、" : "") + s.gold + "金" : "");
    try {
      tradeLog({
        id: T.id,
        type: "p2p",
        at: Date.now(),
        sellerAccount: a.account,
        sellerName: a.name,
        buyerAccount: b.account,
        buyerName: b.name,
        price: a.gold + b.gold,
        itemName: (summary(a) || "無") + " ⇄ " + (summary(b) || "無"),
        status: "done",
      });
    } catch (e) {}
    a.escrow = null;
    b.escrow = null;
    finish(T, "done", "");
    notifyClaim(a.key);
    notifyClaim(b.key);
  }

  function sweep(now) {
    now = now || Date.now();
    for (const T of [...trades.values()]) {
      if (T.state === "ask" && now > T.askUntil) {
        cancel(T, "對方沒有回應。");
        continue;
      }
      if (now - T.updatedAt > TRADE_IDLE_MS) {
        cancel(T, "交易逾時。");
        continue;
      }
      for (const s of T.sides) {
        if (!online(s.key, now)) {
          cancel(T, s.name + " 已離線。");
          break;
        }
      }
    }
  }
  const sweepTimer = setInterval(() => {
    try {
      sweep(Date.now());
    } catch (e) {}
  }, 5000);
  if (sweepTimer.unref) sweepTimer.unref();

  async function body(req, res) {
    const raw = await readBody(req);
    try {
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      json(res, 400, { ok: false, error: "bad json" });
      return null;
    }
  }

  /** 驗證登入＋算出自己的角色鍵（account#slot） */
  async function me(data, res) {
    const auth = await requireAuth(data, res);
    if (!auth) return null;
    const acc = String(data.account || auth.account || "").trim();
    if (sameAccount && !sameAccount(acc, auth.account)) {
      json(res, 403, { ok: false, error: "forbidden", message: "帳號不符。" });
      return null;
    }
    const slot = wallet.normSlot(data.slot);
    const key = memberKey(acc, slot);
    if (!key) {
      json(res, 400, { ok: false, error: "need account", message: "請先登入帳號。" });
      return null;
    }
    return { account: auth.account, slot: slot, key: key, name: sanitizeName(data.name) || "冒險者" };
  }

  function activeFor(key) {
    const id = byKey.get(key);
    const T = id ? trades.get(id) : null;
    if (!T || (T.state !== "ask" && T.state !== "open")) {
      if (id) byKey.delete(key);
      return null;
    }
    return T;
  }

  function cleanOffer(raw) {
    const list = Array.isArray(raw) ? raw.slice(0, TRADE_MAX_ITEMS + 1) : [];
    if (list.length > TRADE_MAX_ITEMS) return { ok: false, message: "最多放 " + TRADE_MAX_ITEMS + " 種物品。" };
    const seen = Object.create(null);
    const out = [];
    for (const r of list) {
      const uid = String((r && r.uid) || "").slice(0, 64);
      if (!uid) return { ok: false, message: "物品缺少識別，請重新放入。" };
      if (seen[uid]) return { ok: false, message: "同一件物品不可重複放入。" };
      seen[uid] = 1;
      const item = sanitizeItem(r.item);
      if (!item) return { ok: false, message: "此物品無法交易（限時／特殊道具）。" };
      const cnt = Math.max(1, Math.min(99999, Math.floor(Number(r.cnt) || 1)));
      item.cnt = cnt;
      out.push({ uid: uid, cnt: cnt, item: item });
    }
    return { ok: true, items: out };
  }

  async function handle(req, res, u) {
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    const now = Date.now();
    sweep(now);

    if (u.startsWith("/api/trade/state") && req.method === "GET") {
      const url = new URL(req.url || "/", "http://localhost");
      const key = memberKey(url.searchParams.get("account"), wallet.normSlot(url.searchParams.get("slot")));
      if (!key) return json(res, 400, { ok: false, error: "need account" });
      const T = activeFor(key);
      return json(res, 200, { ok: true, trade: pub(T, key), claims: (claims.get(key) || []).length });
    }

    if (req.method !== "POST") return json(res, 404, { ok: false, error: "unknown trade api" });
    const data = await body(req, res);
    if (!data) return;
    const self = await me(data, res);
    if (!self) return;

    if (u === "/api/trade/request") {
      const targetKey = String(data.targetKey || "").slice(0, 64);
      if (!targetKey || targetKey === self.key) return json(res, 400, { ok: false, message: "請選擇要交易的玩家。" });
      const mine = online(self.key, now);
      const them = online(targetKey, now);
      if (!them) return json(res, 404, { ok: false, message: "對方不在線上。" });
      if (sameAccount && sameAccount(them.account, self.account)) return json(res, 400, { ok: false, message: "不能跟自己的角色交易。" });
      if (!mine || !mine.mapId || mine.mapId !== them.mapId) {
        return json(res, 400, { ok: false, message: "要在同一張地圖才能交易。" });
      }
      if (activeFor(self.key)) return json(res, 409, { ok: false, message: "你正在交易中。" });
      if (activeFor(targetKey)) return json(res, 409, { ok: false, message: "對方正在跟別人交易。" });
      const T = {
        id: newId("T"),
        state: "ask",
        rev: 0,
        createdAt: now,
        updatedAt: now,
        askUntil: now + TRADE_ASK_MS,
        reason: "",
        sides: [
          { key: self.key, account: self.account, slot: self.slot, name: self.name, items: [], gold: 0, locked: false, escrow: null },
          {
            key: targetKey,
            account: them.account,
            slot: wallet.normSlot(them.slot),
            name: sanitizeName(them.name) || "冒險者",
            items: [],
            gold: 0,
            locked: false,
            escrow: null,
          },
        ],
      };
      trades.set(T.id, T);
      byKey.set(self.key, T.id);
      byKey.set(targetKey, T.id);
      notify(T);
      return json(res, 200, { ok: true, trade: pub(T, self.key), message: "已向 " + T.sides[1].name + " 提出交易。" });
    }

    if (u === "/api/trade/claim") {
      const list = claims.get(self.key) || [];
      if (!list.length) return json(res, 200, { ok: true, items: [], gold: 0, claims: [] });
      const taken = list.slice();
      const result = await walletMutate(self.account, self.slot, (pdata) => {
        const added = [];
        let gold = 0;
        for (const c of taken) {
          for (const x of c.items || []) {
            const r = wallet.applyAddItem(pdata, Object.assign({}, x.item, { cnt: x.cnt }));
            if (!r.ok) return r;
            added.push(r.item);
          }
          gold += Math.max(0, Math.floor(Number(c.gold) || 0));
        }
        if (gold > 0) {
          const g = wallet.applyCreditGold(pdata, gold);
          if (!g.ok) return g;
        }
        return { ok: true, added: added, gold: gold };
      });
      if (!result || !result.ok) {
        return json(res, 409, { ok: false, error: (result && result.error) || "wallet", message: (result && result.message) || "領取失敗，請稍後再試。" });
      }
      const rest = (claims.get(self.key) || []).filter((c) => !taken.some((t) => t.id === c.id));
      if (rest.length) claims.set(self.key, rest);
      else claims.delete(self.key);
      saveSoon();
      return json(res, 200, {
        ok: true,
        items: result.added,
        gold: result.gold,
        goldAfter: result.goldAfter,
        walletRev: result.walletRev,
        claims: taken.map((c) => ({ id: c.id, reason: c.reason, fromName: c.fromName, tradeId: c.tradeId })),
      });
    }

    const T = activeFor(self.key);
    if (!T || (data.tradeId && String(data.tradeId) !== T.id)) {
      return json(res, 404, { ok: false, error: "gone", message: "交易已結束。" });
    }
    const i = sideOf(T, self.key);
    const S = T.sides[i];
    const O = T.sides[1 - i];

    if (u === "/api/trade/respond") {
      if (T.state !== "ask" || i !== 1) return json(res, 400, { ok: false, message: "沒有待回覆的交易邀請。" });
      if (!data.accept) {
        cancel(T, S.name + " 拒絕了交易。");
        return json(res, 200, { ok: true, trade: null });
      }
      T.state = "open";
      notify(T);
      return json(res, 200, { ok: true, trade: pub(T, self.key) });
    }

    if (u === "/api/trade/cancel") {
      cancel(T, S.name + " 取消了交易。");
      return json(res, 200, { ok: true, trade: null });
    }

    if (T.state !== "open") return json(res, 400, { ok: false, message: "對方還沒接受交易。" });

    if (u === "/api/trade/offer") {
      if (S.locked) return json(res, 400, { ok: false, message: "已鎖定，不能再更改。" });
      const off = cleanOffer(data.items);
      if (!off.ok) return json(res, 400, { ok: false, message: off.message });
      const gold = Math.max(0, Math.min(TRADE_GOLD_MAX, Math.floor(Number(data.gold) || 0)));
      S.items = off.items;
      S.gold = gold;
      let msg = "";
      if (O.locked) {
        if (O.escrow) pushClaim(O, O.escrow, "return", T.id, "");
        O.escrow = null;
        O.locked = false;
        msg = S.name + " 更改了內容，對方的鎖定已解除。";
        notifyClaim(O.key);
      }
      notify(T, msg ? { note: msg } : null);
      return json(res, 200, { ok: true, trade: pub(T, self.key) });
    }

    if (u === "/api/trade/lock") {
      if (S.locked) return json(res, 200, { ok: true, trade: pub(T, self.key) });
      if (!S.items.length && !S.gold && !O.items.length && !O.gold) {
        return json(res, 400, { ok: false, message: "雙方都還沒放東西。" });
      }
      if (data.rev != null && Number(data.rev) !== T.rev) {
        return json(res, 409, { ok: false, error: "changed", message: "交易內容剛變更，請再確認一次。", trade: pub(T, self.key) });
      }
      let w = { ok: true };
      if (S.items.length || S.gold) {
        if (T.busy) return json(res, 409, { ok: false, message: "處理中，請稍候。" });
        T.busy = true;
        try {
          w = await walletMutate(self.account, self.slot, (pdata) => {
            for (const x of S.items) {
              const r = wallet.applyRemoveInv(pdata, x.uid, x.cnt, x.item.id);
              if (!r.ok) return r;
            }
            return wallet.applyDebitGold(pdata, S.gold);
          });
        } finally {
          T.busy = false;
        }
        if (!w || !w.ok) {
          return json(res, w && w.error === "gold_short" ? 400 : 409, {
            ok: false,
            error: (w && w.error) || "wallet",
            message: (w && w.message) || "鎖定失敗。",
          });
        }
      }
      if (!trades.has(T.id) || T.state !== "open") {
        if (S.items.length || S.gold) {
          pushClaim(S, { items: S.items, gold: S.gold }, "return", T.id, "");
          notifyClaim(S.key);
        }
        return json(res, 409, { ok: false, message: "交易已結束，物品將退回。" });
      }
      S.escrow = { items: S.items.map((x) => ({ uid: x.uid, cnt: x.cnt, item: x.item })), gold: S.gold };
      S.locked = true;
      const removed = S.items.map((x) => ({ uid: x.uid, cnt: x.cnt }));
      const resp = { ok: true, removed: removed, gold: S.gold, goldAfter: w.goldAfter, walletRev: w.walletRev };
      if (O.locked) {
        complete(T);
        resp.trade = Object.assign(pub(T, self.key) || {}, { state: "done" });
        resp.done = true;
      } else {
        notify(T);
        resp.trade = pub(T, self.key);
      }
      return json(res, 200, resp);
    }

    return json(res, 404, { ok: false, error: "unknown trade api" });
  }

  load();
  return { handle, sweep, _state: { trades, byKey, claims } };
}

module.exports = { createTradeApi, TRADE_MAX_ITEMS, TRADE_ASK_MS };

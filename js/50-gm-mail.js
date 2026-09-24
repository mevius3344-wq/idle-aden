"use strict";

/**
 * GM 信箱：心跳回報有待領信件時，向 /api/gm/mail/claim 領取並放進目前角色背包。
 * 金幣由伺服器寫入雲端錢包（walletRev），本機同步加上。
 */
(function () {
  var _busy = false;
  var _lastAt = 0;
  var _applied = {};

  function account() {
    try {
      if (window.__fb5AuthAccount) return String(window.__fb5AuthAccount || "").trim();
      if (window.GameAccountAuth && typeof window.GameAccountAuth.currentAccount === "function") {
        return String(window.GameAccountAuth.currentAccount() || "").trim();
      }
    } catch (e) {}
    return "";
  }

  function ready() {
    if (typeof player === "undefined" || !player || !player.cls || player.dead) return false;
    if (typeof currentSlot === "undefined") return false;
    try {
      if (typeof catchupActive === "function" && catchupActive()) return false;
    } catch (e) {}
    return true;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[<>&"']/g, "");
  }

  function log(html) {
    try {
      if (typeof logSys === "function") logSys(html);
    } catch (e) {}
  }

  function itemLabel(inst) {
    try {
      if (typeof getItemFullName === "function") {
        var cls = typeof getItemColor === "function" ? getItemColor(inst) : "";
        return '<span class="' + cls + ' font-bold">' + getItemFullName(inst) + "</span>";
      }
    } catch (e) {}
    var d = typeof DB !== "undefined" && DB.items ? DB.items[inst.id] : null;
    return '<span class="font-bold">' + esc((d && d.n) || inst.id) + "</span>";
  }

  function addExactItem(it) {
    if (!Array.isArray(player.inv)) player.inv = [];
    var probe = { id: it.id, en: it.en, bless: it.bless, anc: false, attr: false, seteff: false };
    var ex = null;
    if (typeof sameItemSig === "function") {
      for (var i = 0; i < player.inv.length; i++) {
        var cur = player.inv[i];
        if (cur && !cur.gw && sameItemSig(cur, probe)) {
          ex = cur;
          break;
        }
      }
    }
    if (ex) {
      ex.cnt = Math.max(1, Math.floor(Number(ex.cnt) || 1)) + it.cnt;
      return ex;
    }
    var row = {
      id: it.id,
      uid: it.uid || (typeof uid === "function" ? uid() : "g" + Date.now()),
      cnt: it.cnt,
      en: it.en,
      bless: it.bless,
      anc: false,
      attr: false,
      seteff: false,
      lock: false,
      junk: false,
    };
    player.inv.push(row);
    try {
      if (typeof registerEquipObtained === "function") registerEquipObtained(it.id);
      if (typeof registerMiscObtained === "function") registerMiscObtained(it.id);
      if (typeof registerRelicObtained === "function") registerRelicObtained(it.id);
    } catch (e) {}
    return row;
  }

  function applyItem(it) {
    var d = typeof DB !== "undefined" && DB.items ? DB.items[it.id] : null;
    if (!d) {
      log('<span class="text-red-400">【GM 信箱】物品「' + esc(it.id) + "」不存在於目前版本，請聯絡管理員。</span>");
      return;
    }
    var inst = { id: it.id, en: it.en, bless: it.bless };
    if (it.kind === "card" && d.cardMob && d.cardTier && typeof acquireCard === "function") {
      acquireCard(d.cardMob, d.cardTier, it.cnt);
    } else if (it.en > 0 || it.bless) {
      addExactItem(it);
    } else if (typeof gainItem === "function") {
      gainItem(it.id, it.cnt, true, true, false, true);
    } else {
      addExactItem(it);
    }
    log(
      '<span class="text-sky-300 font-bold">【GM 信箱】</span>獲得 ' +
        itemLabel(inst) +
        (it.cnt > 1 ? " ×" + it.cnt.toLocaleString() : "") +
        (it.note ? '<span class="text-gray-400">（' + esc(it.note) + "）</span>" : "") +
        "。"
    );
  }

  function applyResult(data) {
    var items = Array.isArray(data.items) ? data.items : [];
    var changed = false;
    items.forEach(function (raw) {
      var gid = String(raw && raw.grantId);
      if (!gid || _applied[gid]) return;
      _applied[gid] = 1;
      applyItem({
        kind: raw.kind === "card" ? "card" : "item",
        id: String(raw.id || ""),
        cnt: Math.max(1, Math.floor(Number(raw.cnt) || 1)),
        en: Math.max(0, Math.floor(Number(raw.en) || 0)),
        bless: raw.bless === true,
        uid: raw.uid ? String(raw.uid) : "",
        note: raw.note ? String(raw.note) : "",
      });
      changed = true;
    });
    var gold = Math.max(0, Math.floor(Number(data.gold) || 0));
    if (gold > 0) {
      if (typeof addPlayerGold === "function") addPlayerGold(gold);
      else player.gold = (Number(player.gold) || 0) + gold;
      if (data.walletRev != null && Number.isFinite(Number(data.walletRev))) {
        player._walletRev = Math.max(0, Math.floor(Number(data.walletRev)));
      }
      log(
        '<span class="text-sky-300 font-bold">【GM 信箱】</span>獲得 <span class="text-yellow-300 font-bold">' +
          gold.toLocaleString() +
          "</span> 金幣。"
      );
      changed = true;
    }
    if (!changed) return;
    try {
      if (typeof renderTabs === "function") renderTabs(true);
      if (typeof updateUI === "function") updateUI();
    } catch (e) {}
    try {
      if (typeof saveGame === "function") saveGame();
    } catch (e2) {}
  }

  function claim() {
    if (_busy || !ready()) return Promise.resolve(false);
    if (Date.now() - _lastAt < 5000) return Promise.resolve(false);
    var acc = account();
    var token = "";
    try {
      if (typeof window.anticheatGetAuthToken === "function") token = window.anticheatGetAuthToken();
    } catch (e) {}
    if (!acc || !token) return Promise.resolve(false);
    _busy = true;
    _lastAt = Date.now();
    return fetch("/api/gm/mail/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: acc, authToken: token, slot: Number(currentSlot) || 1 }),
      cache: "no-store",
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && typeof player !== "undefined" && player && player.cls) applyResult(data);
        return !!(data && data.ok);
      })
      .catch(function () {
        return false;
      })
      .finally(function () {
        _busy = false;
      });
  }

  window.GmMail = { claim: claim };
})();

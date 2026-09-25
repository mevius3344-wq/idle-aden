// 潘朵拉抽抽樂：付費權重抽獎（連線 API）·舊全服競標已停用
(function () {
  "use strict";

  var _ready = null;
  var _readyAt = 0;
  var _readyPromise = null;
  var _pollBusy = false;
  var _drawBusy = false;
  var _appliedClaimIds = Object.create(null);
  var _gachaMeta = null;

  function _httpOk() {
    try {
      return location.protocol === "http:" || location.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function _account() {
    try {
      if (window.__fb5AuthAccount) return String(window.__fb5AuthAccount || "").trim();
      if (window.GameAccountAuth && typeof window.GameAccountAuth.currentAccount === "function") {
        return String(window.GameAccountAuth.currentAccount() || "").trim();
      }
    } catch (e) {}
    return "";
  }

  function _slot() {
    try {
      if (typeof currentSlot !== "undefined" && currentSlot) return currentSlot;
    } catch (e) {}
    return 1;
  }

  function pandoraProbeServer() {
    if (_readyPromise) return _readyPromise;
    _readyAt = Date.now();
    _readyPromise = fetch("/api/pandora/status?t=" + Date.now(), { cache: "no-store" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        _ready = !!(data && data.ok && data.enabled);
        try {
          window._pandoraServerReady = _ready;
        } catch (eR) {}
        if (data && data.ok) {
          _gachaMeta = {
            mode: data.mode || "gacha",
            drawCost: Math.max(1, Math.floor(Number(data.drawCost) || 100000)),
            drawMax: Math.max(1, Math.floor(Number(data.drawMax) || 10)),
            dailyCap: Math.max(0, Math.floor(Number(data.dailyCap) || 0)),
            blessRate: Number(data.blessRate) || 0.01,
          };
          window._pandoraGachaMeta = _gachaMeta;
        }
        return _ready;
      })
      .catch(function () {
        _ready = false;
        try {
          window._pandoraServerReady = false;
        } catch (eF) {}
        return false;
      })
      .finally(function () {
        _readyPromise = null;
      });
    return _readyPromise;
  }

  function pandoraServerEnabled() {
    if (!_httpOk()) return false;
    if (_ready === true) return true;
    // 探測中／失敗：不可樂觀當「已連線」（否則會擋本機抽、或對未就緒 API 送 draw）
    if (_ready === false && Date.now() - _readyAt < 60000) return false;
    pandoraProbeServer();
    return false;
  }

  function pandoraDrawCostLocal(qty) {
    var meta = window._pandoraGachaMeta || _gachaMeta || { drawCost: 100000 };
    var q = Math.max(1, Math.min(10, Math.floor(Number(qty) || 1)));
    var cost = Math.max(1, Math.floor(Number(meta.drawCost) || 100000)) * q;
    if (q >= 10) cost = Math.floor(cost * 0.9);
    return cost;
  }

  function pandoraSyncServerLot() {
    // 競標已停用：只更新 gacha meta
    if (!pandoraServerEnabled()) return Promise.resolve(false);
    return pandoraProbeServer().then(function (ok) {
      window._pandoraServerLot = null;
      try {
        if (typeof renderSyslogPandora === "function") renderSyslogPandora();
      } catch (e) {}
      if (typeof _pandoraDiv !== "undefined" && _pandoraDiv && document.body.contains(_pandoraDiv)) {
        try {
          if (typeof pandoraRenderMarket === "function") pandoraRenderMarket(_pandoraDiv);
        } catch (e2) {}
      }
      return !!ok;
    });
  }

  function pandoraPollClaims() {
    if (_pollBusy || !pandoraServerEnabled()) return Promise.resolve(false);
    var acc = _account();
    if (!acc) return Promise.resolve(false);
    _pollBusy = true;
    return fetch("/api/pandora/claims?account=" + encodeURIComponent(acc), { cache: "no-store" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok || !Array.isArray(data.claims) || !data.claims.length) return false;
        var any = false;
        return Promise.all(
          data.claims.map(function (c) {
            var cid = String(c.id || "");
            if (cid && _appliedClaimIds[cid]) {
              // 已由 draw 回應發放 → 仍需刪除伺服器 claim
              return fetch("/api/pandora/claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account: acc, claimId: cid }),
              }).catch(function () {});
            }
            return fetch("/api/pandora/claim", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ account: acc, claimId: c.id }),
            })
              .then(function (res) {
                return res.json();
              })
              .then(function (body) {
                if (!body || !body.ok || !body.claim) return;
                any = true;
                pandoraApplyClaim(body.claim);
              });
          })
        ).then(function () {
          return any;
        });
      })
      .catch(function () {
        return false;
      })
      .finally(function () {
        _pollBusy = false;
      });
  }

  function pandoraApplyClaim(claim, opts) {
    if (!claim || typeof player === "undefined" || !player) return;
    var silent = !!(opts && opts.silent);
    var cid = String(claim.id || claim.claimId || "");
    if (cid) {
      if (_appliedClaimIds[cid]) return;
      _appliedClaimIds[cid] = 1;
    }
    if (claim.type === "gold_refund") {
      var amt = Math.max(0, Math.floor(Number(claim.amount) || 0));
      if (amt > 0) {
        player.gold = (player.gold || 0) + amt;
        if (!silent) {
          try {
            if (typeof logSys === "function") {
              logSys(
                '<span class="text-amber-300">【潘朵拉】</span>退還 <span class="text-yellow-300">' +
                  amt.toLocaleString() +
                  "</span> 金幣。"
              );
            }
          } catch (e) {}
        }
        try {
          if (typeof updateUI === "function") updateUI();
        } catch (e2) {}
        try {
          if (typeof saveGame === "function") saveGame();
        } catch (e3) {}
      }
      return;
    }
    if ((claim.type === "item" || claim.itemId) && claim.itemId) {
      var inst;
      try {
        var d = DB.items[claim.itemId];
        if (d && d.eff === "card" && d.cardMob && d.cardTier && typeof acquireCard === "function") {
          acquireCard(d.cardMob, d.cardTier, 1);
          inst = { id: claim.itemId };
        } else if (typeof gainItem === "function") {
          inst = gainItem(claim.itemId, 1, true, false, false, false, { bless: claim.bless === true });
        }
      } catch (e4) {}
      inst = inst || { id: claim.itemId, bless: claim.bless === true };
      if (!silent) {
        try {
          if (typeof logSys === "function") {
            var rare = Number(claim.weight) === 1;
            logSys(
              '<span class="text-purple-300 font-bold">【潘朵拉抽抽樂】</span>獲得 <span class="' +
                getItemColor(inst) +
                ' font-bold">' +
                getItemFullName(inst) +
                "</span>" +
                (rare ? '<span class="text-purple-300">（珍稀）</span>' : "") +
                "！"
            );
          }
        } catch (e5) {}
      }
      try {
        if (typeof updateUI === "function") updateUI();
      } catch (e6) {}
      try {
        if (typeof saveGame === "function") saveGame();
      } catch (e7) {}
      try {
        if (typeof player !== "undefined" && player && Number(claim.weight) === 1) {
          player.pandoraAnnounce = claim.itemId;
          player.pandoraAnnounceBless = claim.bless === true;
          if (typeof renderPandoraBanner === "function") renderPandoraBanner();
        }
      } catch (e8) {}
    }
  }

  function pandoraPlaceServerDraw(qty) {
    if (_drawBusy) return Promise.resolve(false);
    var acc = _account();
    if (!acc) {
      // 未登入帳號：改本機抽（單機／訪客仍可玩）
      if (typeof pandoraDoLocalDraw === "function") {
        pandoraDoLocalDraw(qty);
        return Promise.resolve(true);
      }
      alert("請先登入帳號再抽獎。");
      return Promise.resolve(false);
    }
    qty = Math.max(1, Math.min(10, Math.floor(Number(qty) || 1)));
    var need = pandoraDrawCostLocal(qty);
    if ((player.gold || 0) < need) {
      alert("金幣不足（需要 " + need.toLocaleString() + "）。");
      return Promise.resolve(false);
    }
    _drawBusy = true;
    var auth = (typeof anticheatAuthExtras === "function") ? anticheatAuthExtras() : {};
    var body = {
      account: acc,
      slot: _slot(),
      qty: qty,
      authToken: auth.authToken || "",
      sessionId: auth.sessionId || "",
      charName: (typeof player !== "undefined" && player && player.name) ? String(player.name).slice(0, 16) : "",
    };
    try {
      if (player && player._walletRev != null) body.walletRev = Math.max(0, Math.floor(Number(player._walletRev) || 0));
    } catch (eRev) {}
    return fetch("/api/pandora/draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (r) {
        var data = r.data || {};
        if (!data || !data.ok) {
          var msg =
            typeof econErrorMessage === "function"
              ? econErrorMessage(data, "抽獎失敗。")
              : data.error === "gold_short"
                ? "金幣不足（雲端餘額）。"
                : data.error === "daily_cap"
                  ? data.message || "今日抽獎次數已達上限。"
                  : data.error === "conflict"
                    ? "雲端忙碌中，請稍後再抽。"
                    : data.message || "抽獎失敗。";
          if (data.error === "conflict" && typeof rtWalletPull === "function") {
            try { rtWalletPull(); } catch (eP) {}
          }
          alert(msg);
          return false;
        }
        var cost = Math.max(0, Math.floor(Number(data.cost) || need));
        if (data.clientDebit !== false) {
          if ((player.gold || 0) < cost) {
            alert("金幣不足。");
            return false;
          }
          player.gold -= cost;
        } else if (data.goldAfter != null && Number.isFinite(Number(data.goldAfter))) {
          player.gold = Math.max(0, Math.floor(Number(data.goldAfter)));
        } else {
          player.gold = Math.max(0, (player.gold || 0) - cost);
        }
        if (data.walletRev != null) {
          try {
            player._walletRev = Math.max(0, Math.floor(Number(data.walletRev)));
          } catch (eW) {}
        }
        var results = Array.isArray(data.results) ? data.results : [];
        var names = [];
        var resultRows = [];
        for (var i = 0; i < results.length; i++) {
          var row = results[i];
          if (!row || !row.itemId) continue;
          pandoraApplyClaim(
            {
              id: row.claimId,
              type: "item",
              itemId: row.itemId,
              bless: !!row.bless,
              weight: row.weight,
              source: "draw",
            },
            { silent: results.length > 1 }
          );
          try {
            var inst = { id: row.itemId, bless: !!row.bless };
            var nameHtml =
              '<span class="' +
              getItemColor(inst) +
              ' font-bold">' +
              getItemFullName(inst) +
              "</span>";
            names.push(nameHtml + (Number(row.weight) === 1 ? "✦" : ""));
            resultRows.push({
              itemId: row.itemId,
              bless: !!row.bless,
              weight: Number(row.weight) || 100,
              rare: Number(row.weight) === 1,
              nameHtml: nameHtml,
            });
          } catch (eN) {
            resultRows.push({
              itemId: row.itemId,
              bless: !!row.bless,
              weight: Number(row.weight) || 100,
              rare: Number(row.weight) === 1,
            });
          }
        }
        try {
          if (typeof logSys === "function") {
            if (results.length > 1) {
              logSys(
                '<span class="text-purple-300 font-bold">【潘朵拉抽抽樂】</span>十連／連抽 ×' +
                  results.length +
                  "，花費 <span class=\"text-yellow-300\">" +
                  cost.toLocaleString() +
                  "</span> 金：" +
                  names.join("、")
              );
            } else if (results.length === 1) {
              // 單抽已在 applyClaim 打日誌
            }
          }
        } catch (eL) {}
        try {
          if (typeof updateUI === "function") updateUI();
        } catch (eU) {}
        try {
          if (typeof saveGame === "function") saveGame();
        } catch (eS) {}
        try {
          if (typeof pandoraOnDrawComplete === "function") {
            pandoraOnDrawComplete(resultRows, cost);
          } else if (typeof pandoraRenderMarket === "function" && typeof _pandoraDiv !== "undefined" && _pandoraDiv) {
            pandoraRenderMarket(_pandoraDiv);
          }
        } catch (eR) {}
        // 清掉已發放的 claim，避免重登重複領
        pandoraPollClaims();
        return true;
      })
      .catch(function () {
        // 連線失敗：回退本機抽，避免點抽沒反應／只跳錯誤
        try {
          if (typeof pandoraDoLocalDraw === "function") {
            pandoraDoLocalDraw(qty);
            return true;
          }
        } catch (eLoc) {}
        alert("無法連線抽獎伺服器。");
        return false;
      })
      .finally(function () {
        _drawBusy = false;
      });
  }

  /** @deprecated 競標已停用 */
  function pandoraPlaceServerBid() {
    alert("潘朵拉已改為抽抽樂，請使用抽獎按鈕。");
    return Promise.resolve(false);
  }

  function pandoraServerTick() {
    if (!pandoraServerEnabled()) return;
    pandoraProbeServer();
    pandoraPollClaims();
  }

  window.pandoraServerEnabled = pandoraServerEnabled;
  window.pandoraSyncServerLot = pandoraSyncServerLot;
  window.pandoraPollClaims = pandoraPollClaims;
  window.pandoraPlaceServerBid = pandoraPlaceServerBid;
  window.pandoraPlaceServerDraw = pandoraPlaceServerDraw;
  window.pandoraDrawCostLocal = pandoraDrawCostLocal;
  window.pandoraServerTick = pandoraServerTick;
  window.pandoraApplyClaim = pandoraApplyClaim;

  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(pandoraServerTick, 1500);
      setInterval(pandoraServerTick, 20000);
    });
  }
})();

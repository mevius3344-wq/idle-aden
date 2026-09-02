// 潘朵拉黑市：全服單件競標（每 20 分鐘一件）·需連線 API
(function () {
  "use strict";

  var _ready = null;
  var _readyAt = 0;
  var _pollBusy = false;

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

  function pandoraServerEnabled() {
    if (!_httpOk()) return false;
    if (_ready === true) return true;
    if (_ready === false && Date.now() - _readyAt < 60000) return false;
    _readyAt = Date.now();
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "/api/pandora/status", false);
      xhr.send();
      if (xhr.status >= 200 && xhr.status < 300) {
        var data = JSON.parse(xhr.responseText || "{}");
        _ready = !!(data && data.ok && data.enabled);
        return _ready;
      }
    } catch (e2) {}
    _ready = false;
    return false;
  }

  function _charName() {
    try {
      if (typeof player !== "undefined" && player && player.name) return String(player.name).trim();
    } catch (e) {}
    return "未命名";
  }

  function _slot() {
    try {
      if (typeof currentSlot !== "undefined" && currentSlot) return currentSlot;
    } catch (e) {}
    return 1;
  }

  function pandoraSyncServerLot() {
    if (!pandoraServerEnabled()) return Promise.resolve(false);
    var acc = _account();
    var url = "/api/pandora/market" + (acc ? "?account=" + encodeURIComponent(acc) : "");
    return fetch(url, { cache: "no-store" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) return false;
        window._pandoraServerLot = data.lot || null;
        window._pandoraMyBuyOrders = data.myBuyOrders || [];
        try {
          if (typeof renderSyslogPandora === "function") renderSyslogPandora();
        } catch (e) {}
        if (_pandoraDiv && document.body.contains(_pandoraDiv) && _pandoraDiv.querySelector("#pandora-msg")) {
          try {
            if (typeof pandoraRenderMarket === "function") pandoraRenderMarket(_pandoraDiv);
          } catch (e2) {}
        }
        return true;
      })
      .catch(function () {
        return false;
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

  function pandoraApplyClaim(claim) {
    if (!claim || typeof player === "undefined" || !player) return;
    if (claim.type === "gold_refund") {
      var amt = Math.max(0, Math.floor(Number(claim.amount) || 0));
      if (amt > 0) {
        player.gold = (player.gold || 0) + amt;
        try {
          if (typeof logSys === "function") {
            logSys(
              '<span class="text-amber-300">【潘朵拉競標】</span>出價被超越，已退還 <span class="text-yellow-300">' +
                amt.toLocaleString() +
                "</span> 金幣。"
            );
          }
        } catch (e) {}
        try {
          if (typeof updateUI === "function") updateUI();
        } catch (e2) {}
        try {
          if (typeof saveGame === "function") saveGame();
        } catch (e3) {}
      }
      return;
    }
    if (claim.type === "item" && claim.itemId) {
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
      try {
        if (typeof logSys === "function") {
          logSys(
            '<span class="text-purple-300 font-bold">【潘朵拉競標】</span>你贏得 <span class="' +
              getItemColor(inst) +
              ' font-bold">' +
              getItemFullName(inst) +
              "</span>！"
          );
        }
      } catch (e5) {}
      try {
        if (typeof updateUI === "function") updateUI();
      } catch (e6) {}
      try {
        if (typeof saveGame === "function") saveGame();
      } catch (e7) {}
    }
  }

  function pandoraPlaceServerBid(amount) {
    var acc = _account();
    if (!acc) {
      alert("請先登入帳號再參與全服競標。");
      return Promise.resolve(false);
    }
    amount = Math.floor(Number(amount));
    if (!Number.isFinite(amount) || amount <= 0) return Promise.resolve(false);
    var prevLot = window._pandoraServerLot || {};
    var wasLeader = !!prevLot.isLeader;
    var prevBid = wasLeader ? Math.max(0, Number(prevLot.highBid) || 0) : 0;
    var pay = wasLeader ? Math.max(0, amount - prevBid) : amount;
    if (pay <= 0) {
      alert("出價必須高於你目前的競標價。");
      return Promise.resolve(false);
    }
    if ((player.gold || 0) < pay) {
      alert("金幣不足。");
      return Promise.resolve(false);
    }
    return fetch("/api/pandora/bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account: acc,
        slot: _slot(),
        charName: _charName(),
        amount: amount,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (r) {
        var data = r.data || {};
        if (data.lot) window._pandoraServerLot = data.lot;
        if (!data || !data.ok) {
          var msg =
            data.error === "bid_too_low"
              ? "出價過低，至少需要 " + (data.minBid || 0).toLocaleString() + " 金幣。"
              : data.error === "lot_ended"
                ? "本輪競標已結束，請稍候新商品。"
                : "出價失敗。";
          alert(msg);
          return false;
        }
        var lot = data.lot || window._pandoraServerLot || {};
        player.gold -= pay;
        try {
          if (typeof logSys === "function") {
            logSys(
              '<span class="text-purple-300">【潘朵拉競標】</span>你出價 <span class="text-yellow-300">' +
                amount.toLocaleString() +
                "</span> 金幣，目前領先！"
            );
          }
        } catch (e) {}
        try {
          if (typeof updateUI === "function") updateUI();
        } catch (e2) {}
        try {
          if (typeof saveGame === "function") saveGame();
        } catch (e3) {}
        if (_pandoraDiv) {
          try {
            if (typeof pandoraRenderMarket === "function") pandoraRenderMarket(_pandoraDiv);
          } catch (e4) {}
        }
        return true;
      })
      .catch(function () {
        alert("無法連線競標伺服器。");
        return false;
      });
  }

  function pandoraSubmitServerBuyOrder(itemId, maxPrice) {
    var acc = _account();
    if (!acc) {
      alert("請先登入帳號再登記收購。");
      return Promise.resolve(false);
    }
    return fetch("/api/pandora/buy-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account: acc,
        slot: _slot(),
        charName: _charName(),
        itemId: itemId,
        maxPrice: maxPrice,
      }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) {
          alert("收購登記失敗。");
          return false;
        }
        return pandoraSyncServerLot();
      });
  }

  function pandoraCancelServerBuyOrder(itemId) {
    var acc = _account();
    if (!acc) return Promise.resolve(false);
    return fetch(
      "/api/pandora/buy-order?account=" + encodeURIComponent(acc) + "&itemId=" + encodeURIComponent(itemId),
      { method: "DELETE" }
    )
      .then(function (res) {
        return res.json();
      })
      .then(function () {
        return pandoraSyncServerLot();
      });
  }

  function pandoraServerTick() {
    if (!pandoraServerEnabled()) return;
    pandoraSyncServerLot();
    pandoraPollClaims();
  }

  window.pandoraServerEnabled = pandoraServerEnabled;
  window.pandoraSyncServerLot = pandoraSyncServerLot;
  window.pandoraPollClaims = pandoraPollClaims;
  window.pandoraPlaceServerBid = pandoraPlaceServerBid;
  window.pandoraSubmitServerBuyOrder = pandoraSubmitServerBuyOrder;
  window.pandoraCancelServerBuyOrder = pandoraCancelServerBuyOrder;
  window.pandoraServerTick = pandoraServerTick;

  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(pandoraServerTick, 1500);
      setInterval(pandoraServerTick, 15000);
    });
  }
})();

"use strict";

/**
 * 帳號單一登入：同一帳號不可在不同裝置同時連線。
 * 需搭配 /api/accounts/session/heartbeat 與登入時回傳的 authToken。
 */
(function () {
  var HEARTBEAT_MS = 20000;
  var _held = false;
  var _timer = null;

  function postJson(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      cache: "no-store",
    }).then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    });
  }

  function authPayload() {
    var account = "";
    try {
      if (window.__fb5AuthAccount) account = String(window.__fb5AuthAccount || "").trim();
      else if (window.GameAccountAuth && typeof window.GameAccountAuth.currentAccount === "function") {
        account = String(window.GameAccountAuth.currentAccount() || "").trim();
      }
    } catch (e) {}
    var authToken = "";
    try {
      if (typeof window.anticheatGetAuthToken === "function") authToken = window.anticheatGetAuthToken();
    } catch (e2) {}
    if (!account || !authToken) return null;
    var clientId = "";
    try {
      if (window.IpSessionLimit && typeof window.IpSessionLimit.getClientId === "function") {
        clientId = window.IpSessionLimit.getClientId();
      }
    } catch (e3) {}
    return { account: account, authToken: authToken, clientId: clientId };
  }

  function stopHeartbeat() {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  }

  function onSessionLost(payload) {
    _held = false;
    stopHeartbeat();
    try {
      if (typeof window.anticheatSetAuthToken === "function") window.anticheatSetAuthToken("");
    } catch (e) {}
    try {
      if (typeof window.GameAccountAuth === "object" && window.GameAccountAuth.onAccountSessionLost) {
        window.GameAccountAuth.onAccountSessionLost(payload);
      }
    } catch (e2) {}
  }

  function startHeartbeat() {
    stopHeartbeat();
    _timer = setInterval(function () {
      if (!_held) return;
      var body = authPayload();
      if (!body) return;
      postJson("/api/accounts/session/heartbeat", body)
        .then(function (r) {
          if (!r || !r.data || !r.data.ok) {
            onSessionLost(r && r.data);
          }
        })
        .catch(function () {});
    }, HEARTBEAT_MS);
  }

  function validate() {
    var body = authPayload();
    if (!body) return Promise.resolve({ ok: false, offline: true });
    return postJson("/api/accounts/session/heartbeat", body)
      .then(function (r) {
        if (r && r.data && r.data.ok) {
          _held = true;
          startHeartbeat();
          return r.data;
        }
        if (r && r.status === 401) return r.data || { ok: false, error: "session_invalid" };
        return r && r.data ? r.data : { ok: false, error: "offline" };
      })
      .catch(function () {
        _held = true;
        return { ok: true, offline: true };
      });
  }

  function hold() {
    _held = true;
    startHeartbeat();
    return Promise.resolve({ ok: true });
  }

  function release() {
    var body = authPayload();
    _held = false;
    stopHeartbeat();
    if (!body) return Promise.resolve({ ok: true });
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(body)], { type: "application/json" });
        navigator.sendBeacon("/api/accounts/logout", blob);
        return Promise.resolve({ ok: true });
      }
    } catch (e) {}
    return postJson("/api/accounts/logout", body)
      .then(function () {
        return { ok: true };
      })
      .catch(function () {
        return { ok: true };
      });
  }

  window.AccountSessionLimit = {
    validate: validate,
    hold: hold,
    release: release,
    isHeld: function () {
      return !!_held;
    },
  };

  window.addEventListener("pagehide", function () {
    release();
  });
})();

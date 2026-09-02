"use strict";

/**
 * 帳號單一登入：同一帳號不可在不同裝置同時連線。
 * 需搭配 /api/accounts/session/heartbeat 與登入時回傳的 authToken。
 */
(function () {
  var HEARTBEAT_MS = 10000;
  var FETCH_TIMEOUT_MS = 15000;
  var LOGIN_GRACE_MS = 30000;
  var _held = false;
  var _timer = null;
  var _holdSinceMs = 0;
  var _hbFailStreak = 0;

  function isOnlineHost() {
    try {
      return location.protocol === "http:" || location.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function postJson(url, body) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          try {
            controller.abort();
          } catch (e) {}
        }, FETCH_TIMEOUT_MS)
      : null;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      cache: "no-store",
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") {
          return {
            status: 0,
            data: { ok: false, error: "timeout", message: "連線逾時，請稍後再試。" },
          };
        }
        throw err;
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  function normalizeAccountId(raw) {
    var s = String(raw == null ? "" : raw).replace(/^\s+|\s+$/g, "");
    try {
      if (typeof s.normalize === "function") s = s.normalize("NFC");
    } catch (e) {}
    if (!s || s.length > 32) return "";
    if (!/^[\u4e00-\u9fffA-Za-z0-9_-]+$/.test(s)) return "";
    return s;
  }

  function authPayload() {
    var account = "";
    try {
      if (window.__fb5AuthAccount) account = String(window.__fb5AuthAccount || "").trim();
      else if (window.GameAccountAuth && typeof window.GameAccountAuth.currentAccount === "function") {
        account = String(window.GameAccountAuth.currentAccount() || "").trim();
      }
    } catch (e) {}
    account = normalizeAccountId(account);
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
    var lastActivityMs = Date.now();
    try {
      if (window.IdleLogout && typeof window.IdleLogout.getLastActivityMs === "function") {
        lastActivityMs = window.IdleLogout.getLastActivityMs();
      }
    } catch (e4) {}
    return { account: account, authToken: authToken, clientId: clientId, lastActivityMs: lastActivityMs };
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

  function handleHeartbeatResult(r) {
    if (r && r.data && r.data.ok) {
      _hbFailStreak = 0;
      return;
    }
    var inGrace = _holdSinceMs > 0 && Date.now() - _holdSinceMs < LOGIN_GRACE_MS;
    if (inGrace && _hbFailStreak < 4) {
      _hbFailStreak += 1;
      return;
    }
    onSessionLost(r && r.data);
  }

  function startHeartbeat() {
    stopHeartbeat();
    _timer = setInterval(function () {
      if (!_held) return;
      var body = authPayload();
      if (!body) return;
      postJson("/api/accounts/session/heartbeat", body)
        .then(handleHeartbeatResult)
        .catch(function () {
          // 網路瞬斷不踢出，下一輪心跳再試
        });
    }, HEARTBEAT_MS);
  }

  function validate() {
    var body = authPayload();
    if (!body) return Promise.resolve({ ok: false, offline: true });
    return postJson("/api/accounts/session/heartbeat", body)
      .then(function (r) {
        if (r && r.data && r.data.ok) {
          _held = true;
          _holdSinceMs = Date.now();
          _hbFailStreak = 0;
          startHeartbeat();
          return r.data;
        }
        if (r && r.status === 401) return r.data || { ok: false, error: "session_invalid" };
        return r && r.data ? r.data : { ok: false, error: "offline" };
      })
      .catch(function () {
        if (!isOnlineHost()) {
          _held = true;
          return { ok: true, offline: true };
        }
        return { ok: false, error: "network", message: "無法連線伺服器驗證帳號連線。" };
      });
  }

  function hold() {
    _held = true;
    _holdSinceMs = Date.now();
    _hbFailStreak = 0;
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
})();

"use strict";

/**
 * IP 雙開限制：同一 IP 最多 2 個瀏覽器分頁／視窗同時佔位。
 * 需搭配 node _serve.js（含 /api/session/*）；file:// 或 API 不可用時放行。
 */
(function () {
  var CLIENT_KEY = "fb5_ip_client_id";
  var HEARTBEAT_MS = 20000;
  var _clientId = "";
  var _held = false;
  var _timer = null;
  var _apiOk = null; // null unknown, true/false

  function newId() {
    try {
      if (window.crypto && crypto.getRandomValues) {
        var a = new Uint8Array(12);
        crypto.getRandomValues(a);
        var s = "";
        for (var i = 0; i < a.length; i++) s += ("0" + a[i].toString(16)).slice(-2);
        return "c_" + s;
      }
    } catch (e) {}
    return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function getClientId() {
    if (_clientId) return _clientId;
    try {
      _clientId = sessionStorage.getItem(CLIENT_KEY) || "";
    } catch (e) {
      _clientId = "";
    }
    if (!_clientId || !/^[A-Za-z0-9_-]{8,80}$/.test(_clientId)) {
      _clientId = newId();
      try {
        sessionStorage.setItem(CLIENT_KEY, _clientId);
      } catch (e2) {}
    }
    return _clientId;
  }

  function postJson(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      keepalive: true,
    }).then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    });
  }

  function stopHeartbeat() {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    _timer = setInterval(function () {
      if (!_held) return;
      postJson("/api/session/heartbeat", { clientId: getClientId() })
        .then(function (r) {
          if (!r || !r.data || !r.data.ok) {
            _held = false;
            stopHeartbeat();
            try {
              if (typeof window.GameAccountAuth === "object" && window.GameAccountAuth.onIpSessionLost) {
                window.GameAccountAuth.onIpSessionLost(r && r.data);
              }
            } catch (e) {}
          }
        })
        .catch(function () {});
    }, HEARTBEAT_MS);
  }

  function release() {
    if (!_held && !_clientId) return Promise.resolve({ ok: true });
    var id = getClientId();
    _held = false;
    stopHeartbeat();
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify({ clientId: id })], { type: "application/json" });
        navigator.sendBeacon("/api/session/release", blob);
        return Promise.resolve({ ok: true });
      }
    } catch (e) {}
    return postJson("/api/session/release", { clientId: id })
      .then(function () {
        return { ok: true };
      })
      .catch(function () {
        return { ok: true };
      });
  }

  function claim() {
    return postJson("/api/session/claim", { clientId: getClientId() })
      .then(function (r) {
        _apiOk = true;
        if (r && r.data && r.data.disabled) {
          _held = true;
          return { ok: true, disabled: true };
        }
        if (r && r.data && r.data.ok) {
          if (r.data.clientId) {
            _clientId = r.data.clientId;
            try {
              sessionStorage.setItem(CLIENT_KEY, _clientId);
            } catch (e) {}
          }
          _held = true;
          startHeartbeat();
          return r.data;
        }
        _held = false;
        stopHeartbeat();
        return r && r.data
          ? r.data
          : { ok: false, error: "ip_limit", message: "此 IP 已達雙開上限。" };
      })
      .catch(function () {
        // file:// or static host without API → allow play
        _apiOk = false;
        _held = true;
        return { ok: true, offline: true };
      });
  }

  function isHeld() {
    return !!_held;
  }

  window.IpSessionLimit = {
    claim: claim,
    release: release,
    isHeld: isHeld,
    getClientId: getClientId,
  };

  window.addEventListener("pagehide", function () {
    release();
  });
  window.addEventListener("beforeunload", function () {
    release();
  });
})();

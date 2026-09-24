"use strict";

/**
 * 遊戲主機保活 ping（Railway 通常不休眠；仍保留輕量心跳）。
 */
(function () {
  var PULSE_MS = 4 * 60 * 1000;
  var _timer = null;
  var _lastOkMs = 0;

  function isOnlineHost() {
    try {
      var p = String(location.protocol || "");
      return p === "http:" || p === "https:";
    } catch (e) {
      return false;
    }
  }

  function isLocalHost() {
    try {
      if (window.GAME_HOST && typeof GAME_HOST.isLocal === "function" && GAME_HOST.isLocal()) return true;
      var h = String(location.hostname || "").toLowerCase();
      return h === "localhost" || h === "127.0.0.1" || h === "";
    } catch (e) {
      return false;
    }
  }

  function gameWakeUrl() {
    if (isLocalHost()) return "";
    try {
      if (window.GAME_HOST) {
        if (GAME_HOST.assetBase) {
          return String(GAME_HOST.assetBase).replace(/\/$/, "") + "/api/version";
        }
        if (typeof GAME_HOST.isGameHost === "function" && GAME_HOST.isGameHost()) {
          return "/api/version";
        }
        if (typeof GAME_HOST.isRender === "function" && GAME_HOST.isRender()) {
          return "/api/version";
        }
        if (typeof GAME_HOST.isRailway === "function" && GAME_HOST.isRailway()) {
          return "/api/version";
        }
        if (typeof GAME_HOST.isVercel === "function" && GAME_HOST.isVercel()) {
          var o = GAME_HOST.gameOrigin || window.__GAME_ORIGIN || "";
          if (o) return String(o).replace(/\/$/, "") + "/api/version";
        }
      }
    } catch (e) {}
    try {
      var h = String(location.hostname || "").toLowerCase();
      if (/\.up\.railway\.app$/i.test(h) || /\.railway\.app$/i.test(h) || /\.onrender\.com$/i.test(h)) {
        return "/api/version";
      }
      if (/\.vercel\.app$/i.test(h)) {
        var origin = (window.__GAME_ORIGIN || "https://game-production-b224.up.railway.app").replace(
          /\/$/,
          ""
        );
        return origin + "/api/version";
      }
    } catch (e2) {}
    return "";
  }

  function pingOnce(timeoutMs) {
    var url = gameWakeUrl();
    if (!url || !isOnlineHost()) return Promise.resolve(false);
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          try {
            controller.abort();
          } catch (e) {}
        }, Math.max(5000, Number(timeoutMs) || 30000))
      : null;
    var full = url + (url.indexOf("?") >= 0 ? "&" : "?") + "wake=" + Date.now();
    return fetch(full, { method: "GET", cache: "no-store", signal: controller ? controller.signal : undefined })
      .then(function (res) {
        return res.json().then(
          function (data) {
            return !!(res.ok && data && data.ok);
          },
          function () {
            return !!res.ok;
          }
        );
      })
      .then(function (ok) {
        if (ok) _lastOkMs = Date.now();
        return ok;
      })
      .catch(function () {
        return false;
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  function pulse() {
    if (document.hidden) return;
    pingOnce(30000).catch(function () {});
  }

  function startPulse() {
    if (_timer || !gameWakeUrl()) return;
    pulse();
    _timer = setInterval(pulse, PULSE_MS);
    try {
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) pulse();
      });
    } catch (e) {}
  }

  function ensureAwake(maxWaitMs) {
    if (isLocalHost() || !gameWakeUrl()) {
      _lastOkMs = Date.now();
      return Promise.resolve({ ok: true, warm: true, local: true });
    }
    var limit = Math.max(8000, Number(maxWaitMs) || 25000);
    var started = Date.now();
    var delay = 800;

    function attempt() {
      if (_lastOkMs > started - 60000) return Promise.resolve({ ok: true, warm: true });
      return pingOnce(Math.min(20000, limit)).then(function (ok) {
        if (ok) return { ok: true, warm: false };
        if (Date.now() - started >= limit) return { ok: false, error: "timeout" };
        return new Promise(function (resolve) {
          setTimeout(resolve, delay);
        }).then(function () {
          delay = Math.min(5000, Math.floor(delay * 1.35));
          return attempt();
        });
      });
    }

    return attempt();
  }

  window.GameServerWake = {
    ping: pulse,
    ensureAwake: ensureAwake,
    renderWakeUrl: gameWakeUrl,
    gameWakeUrl: gameWakeUrl,
    lastOkMs: function () {
      return _lastOkMs;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startPulse);
  } else {
    startPulse();
  }
})();

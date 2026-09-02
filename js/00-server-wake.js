"use strict";

/**
 * 防止 Render 免費方案休眠：開頁即 ping、定時保活、登入前確保已喚醒。
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

  function renderWakeUrl() {
    try {
      if (window.GAME_HOST) {
        if (GAME_HOST.assetBase) {
          return String(GAME_HOST.assetBase).replace(/\/$/, "") + "/api/version";
        }
        if (typeof GAME_HOST.isRender === "function" && GAME_HOST.isRender()) {
          return "/api/version";
        }
        if (typeof GAME_HOST.isVercel === "function" && GAME_HOST.isVercel()) {
          return "https://idle-aden.onrender.com/api/version";
        }
      }
    } catch (e) {}
    try {
      var h = String(location.hostname || "").toLowerCase();
      if (/\.onrender\.com$/i.test(h)) return "/api/version";
      if (/\.vercel\.app$/i.test(h)) return "https://idle-aden.onrender.com/api/version";
    } catch (e2) {}
    return "";
  }

  function pingOnce(timeoutMs) {
    var url = renderWakeUrl();
    if (!url || !isOnlineHost()) return Promise.resolve(false);
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          try {
            controller.abort();
          } catch (e) {}
        }, Math.max(5000, Number(timeoutMs) || 30000))
      : null;
    var full = url.indexOf("/api/") === 0 ? url + "?wake=" + Date.now() : url + "?wake=" + Date.now();
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
    if (_timer || !renderWakeUrl()) return;
    pulse();
    _timer = setInterval(pulse, PULSE_MS);
    try {
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) pulse();
      });
    } catch (e) {}
  }

  /**
   * 登入／連線前確保 Render 已喚醒。冷啟動最多等 maxWaitMs（預設 90 秒）。
   */
  function ensureAwake(maxWaitMs) {
    var limit = Math.max(15000, Number(maxWaitMs) || 90000);
    var started = Date.now();
    var delay = 1200;

    function attempt() {
      if (_lastOkMs > started - 60000) return Promise.resolve({ ok: true, warm: true });
      return pingOnce(Math.min(45000, limit)).then(function (ok) {
        if (ok) return { ok: true, warm: false };
        if (Date.now() - started >= limit) return { ok: false, error: "timeout" };
        return new Promise(function (resolve) {
          setTimeout(resolve, delay);
        }).then(function () {
          delay = Math.min(8000, Math.floor(delay * 1.4));
          return attempt();
        });
      });
    }

    return attempt();
  }

  window.GameServerWake = {
    ping: pulse,
    ensureAwake: ensureAwake,
    renderWakeUrl: renderWakeUrl,
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

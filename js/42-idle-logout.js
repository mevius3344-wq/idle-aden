"use strict";

/**
 * 閒置過久強制登出：無鍵鼠／觸控操作超過時限則自動登出並釋放帳號連線。
 */
(function () {
  var IDLE_LOGOUT_MS = 30 * 60 * 1000;
  var IDLE_WARN_MS = 28 * 60 * 1000;
  var CHECK_MS = 10000;
  var MOVE_THROTTLE_MS = 1500;

  var _lastActivityMs = Date.now();
  var _lastMoveMs = 0;
  var _timer = null;
  var _warnEl = null;
  var _loggingOut = false;

  function isLoggedIn() {
    try {
      var auth = document.getElementById("account-auth-panel");
      if (auth && !auth.classList.contains("hidden")) return false;
    } catch (e0) {}
    try {
      if (window.GameAccountAuth && typeof window.GameAccountAuth.currentAccount === "function") {
        return !!String(window.GameAccountAuth.currentAccount() || "").trim();
      }
    } catch (e) {}
    return false;
  }

  function bumpActivity() {
    _lastActivityMs = Date.now();
    hideWarn();
  }

  function onActivity(ev) {
    if (!isLoggedIn()) return;
    if (ev && ev.type === "mousemove") {
      var now = Date.now();
      if (now - _lastMoveMs < MOVE_THROTTLE_MS) return;
      _lastMoveMs = now;
    }
    bumpActivity();
  }

  function hideWarn() {
    try {
      if (_warnEl && _warnEl.parentNode) _warnEl.parentNode.removeChild(_warnEl);
    } catch (e) {}
    _warnEl = null;
  }

  function showWarn(remainMs) {
    var mins = Math.max(1, Math.ceil(remainMs / 60000));
    var text = "您已閒置一段時間，約 " + mins + " 分鐘後將自動登出。點擊任意處可繼續遊玩。";
    try {
      if (!_warnEl) {
        _warnEl = document.createElement("div");
        _warnEl.id = "idle-logout-warn";
        _warnEl.setAttribute("role", "alert");
        _warnEl.style.cssText =
          "position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:99998;max-width:min(92vw,440px);padding:10px 16px;border-radius:10px;border:1px solid #b45309;background:linear-gradient(135deg,#451a03,#78350f);color:#ffedd5;font:700 14px/1.45 sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.45);text-align:center;cursor:pointer";
        _warnEl.addEventListener("click", bumpActivity);
        (document.body || document.documentElement).appendChild(_warnEl);
      }
      _warnEl.textContent = text;
    } catch (e2) {}
  }

  function forceLogout() {
    if (_loggingOut || !isLoggedIn()) return;
    _loggingOut = true;
    hideWarn();
    try {
      if (typeof player !== "undefined" && player && player.cls && typeof saveGame === "function") saveGame();
    } catch (e) {}
    try {
      if (typeof _flushSaveNow === "function") _flushSaveNow();
    } catch (e2) {}
    try {
      if (window.GameAccountAuth && typeof window.GameAccountAuth.logoutAccount === "function") {
        window.GameAccountAuth.logoutAccount({
          message: "閒置超過 30 分鐘，已自動登出。",
          tone: "err",
        });
        return;
      }
    } catch (e3) {}
    _loggingOut = false;
  }

  function tick() {
    if (!isLoggedIn()) {
      hideWarn();
      _loggingOut = false;
      _lastActivityMs = Date.now();
      return;
    }
    var idleMs = Date.now() - _lastActivityMs;
    if (idleMs >= IDLE_LOGOUT_MS) {
      forceLogout();
      return;
    }
    if (idleMs >= IDLE_WARN_MS) showWarn(IDLE_LOGOUT_MS - idleMs);
    else hideWarn();
  }

  function bindEvents() {
    var types = ["mousedown", "keydown", "touchstart", "click", "wheel", "pointerdown"];
    for (var i = 0; i < types.length; i++) {
      window.addEventListener(types[i], onActivity, { passive: true, capture: true });
    }
    window.addEventListener("mousemove", onActivity, { passive: true, capture: true });
  }

  function start() {
    if (_timer) return;
    bindEvents();
    _timer = setInterval(tick, CHECK_MS);
    tick();
  }

  window.IdleLogout = {
    getLastActivityMs: function () {
      return _lastActivityMs;
    },
    resetActivity: bumpActivity,
    getIdleMs: function () {
      return Date.now() - _lastActivityMs;
    },
    IDLE_LOGOUT_MS: IDLE_LOGOUT_MS,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

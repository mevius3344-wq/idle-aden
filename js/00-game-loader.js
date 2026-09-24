"use strict";
/**
 * 🩹 v3.8.333：分批載入遊戲腳本；單檔逾時可跳過；登入選單不自動預載。
 */
(function () {
  var VER = "v3.8.333";
  try {
    var meta = document.querySelector('meta[name="game-version"]');
    if (meta && meta.content) VER = String(meta.content);
  } catch (e0) {}

  var URLS = [
    "js/anim-manifest.js",
    "js/00-data.js",
    "js/01-drops-config.js",
    "js/42-idle-logout.js",
    "js/02-stats-recompute.js",
    "js/39-talent-tree.js",
    "js/03-combat-core.js",
    "js/04-combat-attack.js",
    "js/05-kill-progression.js",
    "js/06-status-allies.js",
    "js/07-skills-cast.js",
    "js/08-items-equip.js",
    "js/45-q-anim.js",
    "js/09-vfx-render.js",
    "js/10-ui-tabs.js",
    "js/11-world-map.js",
    "js/12-npc-quests.js",
    "js/13-shop-save.js",
    "js/14-craft-pandora.js",
    "js/15-cards.js",
    "js/16-equip-book.js",
    "js/18-misc-book.js",
    "js/17-audio.js",
    "js/19-equipment-window.js",
    "js/20-warehouse-window.js",
    "js/21-relic-book.js",
    "js/23-summons.js",
    "js/22-pets.js",
    "js/24-pandora-relic-market.js",
    "js/25-clan-system.js",
    "js/26-world-channel.js",
    "js/36-realtime-party.js",
    "js/40-world-boss.js",
    "js/41-map-population.js",
    "js/48-realtime-world.js",
    "js/49-econ-wallet.js",
    "js/43-field-pvp.js",
    "js/47-mapdef.js",
    "js/44-map-explore.js",
    "js/46-combat-hud.js",
    "js/37-auction-house.js",
    "js/27-offline-rewards.js",
    "js/28-pvp-arena.js",
    "js/29-siege-v2-data.js",
    "js/30-siege-v2.js",
    "js/31-castle-guards.js",
    "js/32-threat.js",
    "js/33-desktop-player-files.js",
    "js/38-pandora-global-auction.js",
    "js/38-live-update.js",
  ];

  var HEAVY = {
    "js/anim-manifest.js": 1,
    "js/00-data.js": 1,
    "js/09-vfx-render.js": 1,
    "js/10-ui-tabs.js": 1,
    "js/01-drops-config.js": 1,
    "js/29-siege-v2-data.js": 1,
    "js/27-offline-rewards.js": 1,
    "js/44-map-explore.js": 1,
  };

  var _promise = null;
  var _ready = false;
  var _welcomeBackup = "";

  function withVer(path) {
    return path + (path.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(VER);
  }

  function yieldMs(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function yieldFrame() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  }

  function setProgress(pct, file) {
    var short = file ? String(file).replace(/^js\//, "") : "";
    var msg = "載入遊戲資源 " + pct + "%" + (short ? "（" + short + "）" : "") + "……";
    try {
      var statusEl = document.getElementById("auth-status");
      var welcomeEl = document.getElementById("auth-welcome");
      var auth = document.getElementById("account-auth-panel");
      var authHidden = !!(auth && auth.classList.contains("hidden"));
      if (!authHidden && statusEl) {
        statusEl.textContent = msg;
        statusEl.classList.add("ok");
      } else if (welcomeEl) {
        if (!_welcomeBackup && welcomeEl.textContent && welcomeEl.textContent.indexOf("載入遊戲資源") !== 0) {
          _welcomeBackup = welcomeEl.textContent;
        }
        welcomeEl.textContent = msg;
      }
    } catch (eS) {}
  }

  function restoreWelcome() {
    try {
      var welcomeEl = document.getElementById("auth-welcome");
      if (!welcomeEl) return;
      if (_welcomeBackup) {
        welcomeEl.textContent = _welcomeBackup;
        return;
      }
      if (welcomeEl.textContent.indexOf("載入遊戲資源") === 0) {
        var acc = "";
        try {
          acc = sessionStorage.getItem("fb5_auth_session") || "";
        } catch (eA) {}
        if (acc) welcomeEl.textContent = "歡迎「" + acc + "」進入重生放置";
        else welcomeEl.textContent = "";
      }
    } catch (eW) {}
  }

  function loadOne(src, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var s = document.createElement("script");
      s.src = withVer(src);
      s.async = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        try {
          if (s.parentNode) s.parentNode.removeChild(s);
        } catch (eR) {}
        reject(new Error("timeout " + src));
      }, timeoutMs || 20000);
      s.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      s.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error("fail " + src));
      };
      (document.body || document.head).appendChild(s);
    });
  }

  function runLateBoots() {
    try {
      if (typeof migrateSaves === "function") migrateSaves();
    } catch (e1) {}
    try {
      if (typeof _applyVfxPref === "function") _applyVfxPref();
      if (typeof _applyPlayerIdPref === "function") _applyPlayerIdPref();
    } catch (e2) {}
    try {
      var _v = document.getElementById("login-version");
      if (_v && typeof GAME_VERSION !== "undefined") _v.textContent = GAME_VERSION;
    } catch (e3) {}
    try {
      if (typeof wireBuffEnders === "function") wireBuffEnders();
    } catch (e4) {}
    try {
      if (typeof _migrateAllSavesToClassicMode === "function") _migrateAllSavesToClassicMode();
    } catch (e5) {}
    try {
      if (typeof applyCreationClassAvailability === "function") applyCreationClassAvailability();
    } catch (e6) {}
    try {
      if (typeof initUnifiedLogTab === "function") initUnifiedLogTab();
    } catch (e7) {}
  }

  function ensureGameScripts(opts) {
    opts = opts || {};
    if (_ready) return Promise.resolve(true);
    if (_promise) return _promise;
    var i = 0;
    var errors = [];
    _promise = (async function () {
      await yieldFrame();
      for (; i < URLS.length; i++) {
        var src = URLS[i];
        if (opts.progress !== false) {
          setProgress(Math.min(99, Math.round((i / URLS.length) * 100)), src);
        }
        await yieldFrame();
        try {
          var tmo = HEAVY[src] ? 45000 : 20000;
          await loadOne(src, tmo);
        } catch (err) {
          errors.push(String(err && err.message ? err.message : err));
          try {
            console.warn("[game-loader]", err);
          } catch (eC) {}
        }
        var pause = HEAVY[src] ? 150 : 50;
        await yieldMs(pause);
        await yieldFrame();
      }
      _ready = true;
      runLateBoots();
      try {
        window.__gameScriptsReady = true;
      } catch (eR) {}
      restoreWelcome();
      if (errors.length) {
        try {
          console.warn("[game-loader] skipped", errors.length, errors);
        } catch (e2) {}
      }
      return true;
    })().catch(function (err) {
      _promise = null;
      restoreWelcome();
      throw err;
    });
    return _promise;
  }

  function ensureGameThen(fn) {
    return ensureGameScripts({ progress: true }).then(function () {
      if (typeof fn === "function") return fn();
    });
  }

  window.ensureGameScripts = ensureGameScripts;
  window.ensureGameThen = ensureGameThen;
  window.__gameScriptsReady = false;
})();

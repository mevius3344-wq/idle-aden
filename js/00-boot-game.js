"use strict";
/**
 * 🔧 v3.8.452：開局腳本載入順序
 * - 選角後優先載入 09-vfx／45-q／44-explore／anim-manifest
 * - 其餘模組隨後載入（個別失敗 catch 後繼續）
 */
(function () {
  var VER = "v3.8.503";
  try {
    var meta = document.querySelector('meta[name="game-version"]');
    if (meta && meta.content) VER = String(meta.content);
  } catch (e0) {}

  try {
    if (typeof ANIM_MANIFEST === "undefined") window.ANIM_MANIFEST = {};
  } catch (e1) {}

  var CORE = [
    "js/00-data.js",
    "js/01-drops-config.js",
    "js/42-idle-logout.js",
    "js/02-stats-recompute.js",
    "js/03-combat-core.js",
    "js/08-items-equip.js",
    "js/13-shop-save.js",
    "js/14-craft-pandora.js",
    // 🔧 v3.8.452：選角後就載完動畫相關（否則進場易黑塊／錯錨）
    "js/anim-manifest.js",
    "js/45-q-anim.js",
    "js/09-vfx-render.js",
    "js/47-mapdef.js",
    "js/44-map-explore.js",
    "js/04-combat-attack.js",
    "js/46-combat-hud.js",
  ];

  // 選角後其餘遊戲模組
  var REST = [
    "js/39-talent-tree.js",
    "js/05-kill-progression.js",
    "js/06-status-allies.js",
    "js/07-skills-cast.js",
    "js/10-ui-tabs.js",
    "js/11-world-map.js",
    "js/12-npc-quests.js",
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
    "js/37-auction-house.js",
    "js/27-offline-rewards.js",
    "js/28-pvp-arena.js",
    "js/30-siege-v2.js",
    "js/31-castle-guards.js",
    "js/32-threat.js",
    "js/33-desktop-player-files.js",
    "js/38-pandora-global-auction.js",
    "js/38-live-update.js",
    "js/29-siege-v2-data.js",
  ];

  // 必載模組（CORE 已含；此處再確認）
  var MUST = [
    "js/anim-manifest.js",
    "js/45-q-anim.js",
    "js/09-vfx-render.js",
    "js/47-mapdef.js",
    "js/44-map-explore.js",
    "js/04-combat-attack.js",
    "js/46-combat-hud.js",
  ];

  var _coreReady = false;
  var _restReady = false;
  var _corePromise = null;
  var _restPromise = null;
  var _overlay = null;
  var _loaded = Object.create(null);

  function withVer(src) {
    return src + (src.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(VER);
  }

  function yieldMs(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function yieldPaint() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          setTimeout(resolve, 0);
        });
      });
    });
  }

  function hideOverlay() {
    try {
      var el = document.getElementById("boot-game-overlay");
      if (el && el.parentNode) el.parentNode.removeChild(el);
      _overlay = null;
    } catch (e) {}
  }

  function ensureOverlay() {
    hideOverlay();
    var el = document.createElement("div");
    el.id = "boot-game-overlay";
    el.setAttribute("role", "status");
    el.style.cssText =
      "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(0,0,0,.78);color:#f2d77f;font:600 16px/1.5 sans-serif;text-align:center;padding:24px;";
    el.innerHTML = '<div id="boot-game-msg">載入中…</div>';
    document.body.appendChild(el);
    _overlay = el;
    return el;
  }

  function setMsg(text) {
    if (_coreReady) return;
    try {
      ensureOverlay();
      var m = document.getElementById("boot-game-msg");
      if (m) m.textContent = text;
    } catch (e) {}
  }

  function loadScript(src) {
    if (_loaded[src]) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = withVer(src);
      s.async = false;
      var done = false;
      var t = setTimeout(function () {
        if (done) return;
        done = true;
        try {
          if (s.parentNode) s.parentNode.removeChild(s);
        } catch (eR) {}
        reject(new Error("timeout " + src));
      }, 25000);
      s.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(t);
        _loaded[src] = 1;
        resolve();
      };
      s.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(t);
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

  function loadList(list, label, quiet) {
    return (async function () {
      for (var i = 0; i < list.length; i++) {
        var src = list[i];
        if (!quiet && !_coreReady) {
          var pct = Math.min(99, Math.round((i / list.length) * 100));
          setMsg((label || "載入") + " " + pct + "%\n" + src.replace(/^js\//, ""));
          await yieldPaint();
        } else {
          await yieldMs(0);
        }
        try {
          await loadScript(src);
        } catch (err) {
          try {
            console.warn("[boot-game]", err);
          } catch (eC) {}
        }
        await yieldMs(quiet || _coreReady ? 8 : src.indexOf("00-data") >= 0 ? 100 : 20);
      }
    })();
  }

  function bootCore() {
    if (_coreReady) return Promise.resolve(true);
    if (_corePromise) return _corePromise;
    ensureOverlay();
    _corePromise = loadList(CORE, "準備中", false)
      .then(function () {
        _coreReady = true;
        runLateBoots();
        hideOverlay();
        bootRest();
        return true;
      })
      .catch(function (err) {
        _corePromise = null;
        setMsg("載入失敗，請重新整理");
        throw err;
      });
    return _corePromise;
  }

  function bootRest() {
    if (_restReady) return Promise.resolve(true);
    if (_restPromise) return _restPromise;
    hideOverlay();
    _restPromise = loadList(REST, "背景", true)
      .then(function () {
        _restReady = true;
        hideOverlay();
        try {
          window.__gameScriptsReady = true;
        } catch (eR) {}
        return true;
      })
      .catch(function () {
        _restPromise = null;
        hideOverlay();
      });
    return _restPromise;
  }

  function mustReady() {
    for (var i = 0; i < MUST.length; i++) {
      if (!_loaded[MUST[i]]) return false;
    }
    return typeof _mobAnimApply === "function" && typeof _playerMorphApply === "function";
  }

  function ensureMustModules(showOverlay) {
    return (async function () {
      var restP = bootRest();
      if (showOverlay) {
        hideOverlay();
        var el = document.createElement("div");
        el.id = "boot-game-overlay";
        el.style.cssText =
          "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;" +
          "background:rgba(0,0,0,.78);color:#f2d77f;font:600 16px/1.5 sans-serif;text-align:center;padding:24px;";
        el.innerHTML = '<div id="boot-game-msg">載入戰鬥模組…</div>';
        document.body.appendChild(el);
        _overlay = el;
      }
      for (var i = 0; i < MUST.length; i++) {
        if (_loaded[MUST[i]]) continue;
        try {
          var m = document.getElementById("boot-game-msg");
          if (m) m.textContent = "載入戰鬥模組…\n" + MUST[i].replace(/^js\//, "");
        } catch (eM) {}
        try {
          await loadScript(MUST[i]);
        } catch (e) {
          try {
            console.warn("[boot-game] must", e);
          } catch (e2) {}
        }
        await yieldMs(20);
      }
      await restP.catch(function () {});
      hideOverlay();
      return mustReady();
    })();
  }

  function kickBattleVisuals() {
    // 🔧 v3.8.452：場戰視覺鎖。造景／legacy 由 MOB_USE_LEGACY_LINEAGE 決定
    try {
      var bv = document.getElementById("battle-view");
      var tv = document.getElementById("town-view");
      var inTown = !!(tv && !tv.classList.contains("hidden"));
      var mapId = "";
      try {
        mapId = String((typeof mapState !== "undefined" && mapState && mapState.current) || "");
      } catch (eM) {}
      var fieldOn = true;
      var mapOn = true;
      try {
        fieldOn = !(typeof exploreFieldCombatActive === "function") || !!exploreFieldCombatActive();
      } catch (eF) { fieldOn = true; }
      try {
        mapOn = !(typeof exploreAllowed === "function") || !!exploreAllowed();
      } catch (eA) { mapOn = !inTown && mapId !== "training"; }
      if (bv && !inTown && mapId !== "training") {
        bv.classList.add("area-fit");
        if (mapOn) bv.classList.add("is-world-scroll");
        else bv.classList.remove("is-world-scroll");
        var ml = document.getElementById("mob-list");
        if (ml) {
          if (fieldOn) ml.classList.add("is-field-combat");
          else ml.classList.remove("is-field-combat");
        }
      }
    } catch (eLock) {}
    try {
      if (typeof _expandMob8DirFromLegacyManifest === "function") _expandMob8DirFromLegacyManifest();
    } catch (e8e) {}
    // 清舊動畫快取，避免黑塊／錯幀（v3.8.452）
    try {
      if (typeof MOB_USE_LEGACY_LINEAGE !== "undefined" && MOB_USE_LEGACY_LINEAGE && window.__legacyAnimCacheVer !== "v3.8.452") {
        window.__legacyAnimCacheVer = "v3.8.452";
        window.__legacyAnimCacheCleared = true;
        if (typeof _mobAnimCache === "object" && _mobAnimCache) {
          for (var ck in _mobAnimCache) { if (Object.prototype.hasOwnProperty.call(_mobAnimCache, ck)) delete _mobAnimCache[ck]; }
        }
        if (typeof _mob8Cache === "object" && _mob8Cache) {
          for (var ck8 in _mob8Cache) { if (Object.prototype.hasOwnProperty.call(_mob8Cache, ck8)) delete _mob8Cache[ck8]; }
        }
      }
    } catch (eClr) {}
    try {
      if (typeof exploreEnsureAllFieldPos === "function") exploreEnsureAllFieldPos();
    } catch (ePos) {}
    try {
      if (typeof exploreApplyFieldDomPos === "function") exploreApplyFieldDomPos();
    } catch (eDom) {}
    try {
      if (typeof _mobAnimApply === "function") _mobAnimApply();
    } catch (e1) {}
    try {
      if (typeof _playerMorphApply === "function") _playerMorphApply();
    } catch (e2) {}
    try {
      if (typeof enableCombatHud === "function") enableCombatHud();
    } catch (e3) {}
    setTimeout(function () {
      try {
        if (typeof exploreApplyFieldDomPos === "function") exploreApplyFieldDomPos();
      } catch (eD2) {}
      try {
        if (typeof _mobAnimApply === "function") _mobAnimApply();
      } catch (e4) {}
      try {
        if (typeof _playerMorphApply === "function") _playerMorphApply();
      } catch (e5) {}
    }, 200);
    setTimeout(function () {
      try {
        if (typeof _mobAnimApply === "function") _mobAnimApply();
      } catch (e6) {}
      try {
        if (typeof _playerMorphApply === "function") _playerMorphApply();
      } catch (e7) {}
    }, 800);
  }

  function resolveFn(fnOrName) {
    if (typeof fnOrName === "function") return fnOrName;
    if (typeof fnOrName === "string" && typeof window[fnOrName] === "function") return window[fnOrName];
    return null;
  }

  function bootGameThen(fnOrName) {
    return bootCore().then(function () {
      hideOverlay();
      var fn = resolveFn(fnOrName);
      if (!fn && typeof fnOrName === "string") fn = window[fnOrName];
      if (typeof fn === "function") return fn();
      if (typeof openLoadSelect === "function") return openLoadSelect();
    });
  }

  window.bootGameScripts = function () {
    return bootCore().then(bootRest);
  };
  window.bootGameThen = bootGameThen;
  window.ensureGameScripts = window.bootGameScripts;
  window.ensureGameThen = bootGameThen;
  window.__gameScriptsReady = false;
  window.__ensurePlayModules = function () {
    return ensureMustModules(true);
  };
  window.__kickBattleVisuals = kickBattleVisuals;
})();

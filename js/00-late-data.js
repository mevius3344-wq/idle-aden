"use strict";
/**
 * 🩹 v3.8.334：超大資料包延後載入。
 * 登入選單期間不拉 anim-manifest／siege 資料，避免再開一次「網頁無回應」。
 */
(function () {
  var VER = "v3.8.334";
  try {
    var meta = document.querySelector('meta[name="game-version"]');
    if (meta && meta.content) VER = String(meta.content);
  } catch (e0) {}

  if (typeof ANIM_MANIFEST === "undefined") {
    try {
      window.ANIM_MANIFEST = {};
    } catch (e1) {}
  }

  var _started = false;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src + (src.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(VER);
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error(src));
      };
      (document.body || document.head).appendChild(s);
    });
  }

  function loadHeavyData() {
    if (_started) return;
    _started = true;
    // 分兩段拉，中間讓出主執行緒
    loadScript("js/anim-manifest.js")
      .catch(function () {})
      .then(function () {
        return new Promise(function (r) {
          setTimeout(r, 400);
        });
      })
      .then(function () {
        return loadScript("js/29-siege-v2-data.js");
      })
      .catch(function () {});
  }

  window.ensureGameScripts = function () {
    return Promise.resolve(true);
  };
  window.ensureGameThen = function (fn) {
    if (typeof fn === "function") return Promise.resolve(fn());
    return Promise.resolve();
  };
  window.__loadHeavyGameData = loadHeavyData;

  // 進選角／進遊戲才載大包
  document.addEventListener(
    "click",
    function (ev) {
      var t = ev.target;
      if (!t) return;
      var id = t.id || (t.closest && t.closest("button") && t.closest("button").id) || "";
      if (id === "btn-start-menu" || id === "btn-start" || id === "btn-auth-login") {
        setTimeout(loadHeavyData, 800);
      }
    },
    true
  );

  // 或 game-screen 顯示後載
  try {
    var gs = document.getElementById("game-screen");
    if (gs && window.MutationObserver) {
      var obs = new MutationObserver(function () {
        if (gs && !gs.classList.contains("hidden")) {
          loadHeavyData();
          try {
            obs.disconnect();
          } catch (eD) {}
        }
      });
      obs.observe(gs, { attributes: true, attributeFilter: ["class"] });
    }
  } catch (eO) {}
})();

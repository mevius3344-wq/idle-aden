// 部署連線：Railway 跑遊戲＋素材，Vercel 跑 Neon API（帳號／雲端／即時組隊同圖／聊天等）。
// 本機開發（localhost）維持同源 _serve.js，不轉發。
(function () {
  'use strict';

  // 🧪 本機預設關線上組隊／同圖／聊天／雲端；線上部署維持連線（可手動覆寫 window.__DEV_OFFLINE）
  try {
    if (window.__DEV_OFFLINE == null) {
      var _h = String(location.hostname || '').toLowerCase();
      window.__DEV_OFFLINE = (_h === 'localhost' || _h === '127.0.0.1' || _h === '');
    }
  } catch (e0) {}

  var VERCEL_API = 'https://idle-aden.vercel.app';
  // 預設 Railway 公開網址（部署後若不同，設 PUBLIC_GAME_ORIGIN 或 window.__GAME_ORIGIN）
  var DEFAULT_GAME_ORIGIN = 'https://idle-aden-production.up.railway.app';

  function host() {
    try {
      return String(location.hostname || '').toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function isLocal() {
    var h = host();
    return h === 'localhost' || h === '127.0.0.1' || h === '';
  }

  function isRender() {
    return /\.onrender\.com$/i.test(host());
  }

  function isRailway() {
    return /\.up\.railway\.app$/i.test(host()) || /\.railway\.app$/i.test(host());
  }

  function isVercel() {
    return /\.vercel\.app$/i.test(host());
  }

  /** 遊戲主機（玩家入口）：Railway；相容舊 Render */
  function isGameHost() {
    return isRailway() || isRender();
  }

  function resolveGameOrigin() {
    try {
      if (window.__GAME_ORIGIN) return String(window.__GAME_ORIGIN).replace(/\/$/, '');
    } catch (e1) {}
    try {
      var meta = document.querySelector('meta[name="game-origin"]');
      if (meta && meta.content) return String(meta.content).replace(/\/$/, '');
    } catch (e2) {}
    return DEFAULT_GAME_ORIGIN;
  }

  var GAME_ORIGIN = resolveGameOrigin();

  var apiBase = '';
  var assetBase = '';

  try {
    if (window.__API_BASE != null) apiBase = String(window.__API_BASE);
    if (window.__ASSET_BASE != null) assetBase = String(window.__ASSET_BASE);
  } catch (e) {}

  if (!apiBase && isGameHost()) apiBase = VERCEL_API;
  if (!assetBase && isVercel()) assetBase = GAME_ORIGIN;

  apiBase = apiBase.replace(/\/$/, '');
  assetBase = assetBase.replace(/\/$/, '');

  /** 需 Neon 持久化的 API 走 Vercel（帳號／雲端／聊天／組隊／同圖／拍賣／潘朵拉） */
  function useVercelApi(path) {
    if (!apiBase) return false;
    var p = String(path || '');
    if (p.indexOf('/api/') !== 0) return false;
    if (p === '/api/version' || p === '/api/build') return false;
    // 世界王仍掛遊戲主機記憶體（尚未 Neon 化）
    if (p.indexOf('/api/worldboss') === 0) return false;
    // 排行榜／素材版號仍走遊戲主機同源
    if (p.indexOf('/api/leaderboard') === 0) return false;
    return true;
  }

  function apiUrl(path) {
    var p = String(path || '');
    if (!p) return apiBase || '/';
    if (/^https?:\/\//i.test(p)) return p;
    if (p.charAt(0) !== '/') p = '/' + p;
    if (!useVercelApi(p)) return p;
    return apiBase ? apiBase + p : p;
  }

  function assetUrl(path) {
    var p = String(path || '');
    if (!p) return assetBase || '/';
    if (/^https?:\/\//i.test(p)) return p;
    if (p.charAt(0) !== '/') p = '/' + p;
    return assetBase ? assetBase + p : p;
  }

  function onlineSuspended() {
    try {
      return !!(window.__DEV_OFFLINE || window.__onlineIdleForced || window.__wildOnlineForced);
    } catch (e) {
      return false;
    }
  }

  window.GAME_HOST = {
    apiBase: apiBase,
    assetBase: assetBase,
    gameOrigin: GAME_ORIGIN,
    apiUrl: apiUrl,
    assetUrl: assetUrl,
    isLocal: isLocal,
    isRender: isRender,
    isRailway: isRailway,
    isGameHost: isGameHost,
    isVercel: isVercel,
    onlineSuspended: onlineSuspended,
  };
  try { window.gameOnlineSuspended = onlineSuspended; } catch (e4) {}

  if (typeof window.fetch === 'function') {
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      if (typeof input === 'string' && input.indexOf('/api/') === 0) {
        input = useVercelApi(input) ? apiUrl(input) : input;
      }
      return origFetch.call(this, input, init);
    };
  }

  if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype.open) {
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof url === 'string' && url.indexOf('/api/') === 0 && useVercelApi(url)) {
        args[1] = apiUrl(url);
      }
      return origOpen.apply(this, args);
    };
  }

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    var origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (typeof url === 'string' && url.indexOf('/api/') === 0 && useVercelApi(url)) {
        url = apiUrl(url);
      }
      return origBeacon(url, data);
    };
  }

  try {
    if (isVercel() && assetBase && !document.querySelector('base[data-game-host]')) {
      var base = document.createElement('base');
      base.href = assetBase + '/';
      base.setAttribute('data-game-host', '1');
      document.head.insertBefore(base, document.head.firstChild);
    }
  } catch (e2) {}

  try {
    console.info(
      '[host-config] game=' + GAME_ORIGIN +
        ' api=' + (apiBase || '(same-origin)') +
        ' asset=' + (assetBase || '(same-origin)')
    );
  } catch (e3) {}
})();

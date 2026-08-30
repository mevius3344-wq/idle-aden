// 部署連線：Render 跑遊戲＋素材，Vercel 跑 Neon API（帳號／雲端／聊天等）。
// 本機開發（localhost）維持同源 _serve.js，不轉發。
(function () {
  'use strict';

  var VERCEL_API = 'https://idle-aden.vercel.app';
  var RENDER_ASSETS = 'https://idle-aden.onrender.com';

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

  function isVercel() {
    return /\.vercel\.app$/i.test(host());
  }

  var apiBase = '';
  var assetBase = '';

  try {
    if (window.__API_BASE != null) apiBase = String(window.__API_BASE);
    if (window.__ASSET_BASE != null) assetBase = String(window.__ASSET_BASE);
  } catch (e) {}

  if (!apiBase && isRender()) apiBase = VERCEL_API;
  if (!assetBase && isVercel()) assetBase = RENDER_ASSETS;

  apiBase = apiBase.replace(/\/$/, '');
  assetBase = assetBase.replace(/\/$/, '');

  function apiUrl(path) {
    var p = String(path || '');
    if (!p) return apiBase || '/';
    if (/^https?:\/\//i.test(p)) return p;
    if (p.charAt(0) !== '/') p = '/' + p;
    return apiBase ? apiBase + p : p;
  }

  function assetUrl(path) {
    var p = String(path || '');
    if (!p) return assetBase || '/';
    if (/^https?:\/\//i.test(p)) return p;
    if (p.charAt(0) !== '/') p = '/' + p;
    return assetBase ? assetBase + p : p;
  }

  window.GAME_HOST = {
    apiBase: apiBase,
    assetBase: assetBase,
    apiUrl: apiUrl,
    assetUrl: assetUrl,
    isLocal: isLocal,
    isRender: isRender,
    isVercel: isVercel,
  };

  if (typeof window.fetch === 'function') {
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      if (typeof input === 'string' && input.indexOf('/api/') === 0) {
        input = apiUrl(input);
      }
      return origFetch.call(this, input, init);
    };
  }

  if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype.open) {
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof url === 'string' && url.indexOf('/api/') === 0) {
        args[1] = apiUrl(url);
      }
      return origOpen.apply(this, args);
    };
  }

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    var origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (typeof url === 'string' && url.indexOf('/api/') === 0) {
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
      '[host-config] api=' + (apiBase || '(same-origin)') + ' asset=' + (assetBase || '(same-origin)')
    );
  } catch (e3) {}
})();

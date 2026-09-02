/* 🔄 即時同步：僅在伺服器 gameVersion 變更時重載（避免無限重整） */
(function () {
    'use strict';

    var POLL_MS = 60000;
    var RELOAD_DELAY_MS = 800;
    var _bootGameVersion = null;
    var _reloading = false;
    var _timer = null;

    function _clientVer() {
        try {
            if (typeof GAME_VERSION !== 'undefined') return String(GAME_VERSION);
        } catch (e) {}
        try {
            var v = window.__CLIENT_GAME_VERSION;
            if (v && String(v).indexOf('__GAME') === -1) return String(v);
        } catch (e2) {}
        return '';
    }

    function _isHttp() {
        try {
            var p = String(location.protocol || '');
            return p === 'http:' || p === 'https:';
        } catch (e) { return false; }
    }

    function _banner(msg) {
        try {
            var el = document.getElementById('live-update-banner');
            if (!el) {
                el = document.createElement('div');
                el.id = 'live-update-banner';
                el.setAttribute('role', 'status');
                el.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:99999;max-width:min(92vw,420px);padding:10px 16px;border-radius:10px;border:1px solid #ca8a04;background:linear-gradient(135deg,#422006,#713f12);color:#fef3c7;font:700 14px/1.4 sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.45);text-align:center;pointer-events:none';
                (document.body || document.documentElement).appendChild(el);
            }
            el.textContent = msg;
        } catch (e) {}
    }

    function _flushSave() {
        try {
            if (typeof player !== 'undefined' && player && player.cls && typeof saveGame === 'function') saveGame();
        } catch (e) {}
        try {
            if (typeof _flushSaveNow === 'function') _flushSaveNow();
        } catch (e2) {}
    }

    function _doReload(reason, targetVer) {
        if (_reloading) return;
        _reloading = true;
        _banner(reason || '偵測到新版本，正在更新…');
        _flushSave();
        setTimeout(function () {
            try {
                var url = location.href.split('#')[0].replace(/([?&])_v=[^&]*/g, '').replace(/([?&])_build=[^&]*/g, '').replace(/[?&]$/, '');
                var join = url.indexOf('?') >= 0 ? '&' : '?';
                location.replace(url + join + '_v=' + encodeURIComponent(String(targetVer || _clientVer() || Date.now())) + '&_t=' + Date.now());
            } catch (e) {
                try { location.reload(); } catch (e2) {}
            }
        }, RELOAD_DELAY_MS);
    }

    function _poll() {
        if (!_isHttp() || _reloading) return;
        fetch('/api/version?t=' + Date.now(), { method: 'GET', cache: 'no-store' })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (!data || !data.ok || !data.gameVersion) return;
                var serverVer = String(data.gameVersion);
                var client = _clientVer();
                if (!client) {
                    _bootGameVersion = serverVer;
                    return;
                }
                if (!_bootGameVersion) {
                    _bootGameVersion = serverVer;
                    if (serverVer !== client) _doReload('新版本 ' + serverVer + ' 已上線，正在更新…', serverVer);
                    return;
                }
                if (serverVer !== _bootGameVersion) _doReload('新版本 ' + serverVer + ' 已上線，正在更新…', serverVer);
            })
            .catch(function () {});
    }

    function _start() {
        if (!_isHttp()) return;
        setTimeout(_poll, 3000);
        if (_timer) return;
        _timer = setInterval(_poll, POLL_MS);
        try {
            document.addEventListener('visibilitychange', function () { if (!document.hidden) _poll(); });
            window.addEventListener('pageshow', function (ev) { if (ev && ev.persisted) _poll(); });
        } catch (e) {}
    }

    window.LiveUpdate = { poll: _poll };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _start);
    else _start();
})();

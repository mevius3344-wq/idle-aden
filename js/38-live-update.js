/* 🔄 強制即時同步：伺服器 gameVersion / buildId 變更 → 存檔並強制重載（含手機） */
(function () {
    'use strict';

    var POLL_MS = 5000;
    var RELOAD_DELAY_MS = 800;
    var _bootBuildId = null;
    var _reloading = false;
    var _timer = null;

    function _clientVer() {
        try {
            if (window.__CLIENT_GAME_VERSION) return String(window.__CLIENT_GAME_VERSION);
        } catch (e) {}
        try {
            if (typeof GAME_VERSION !== 'undefined') return String(GAME_VERSION);
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
            var id = 'live-update-banner';
            var el = document.getElementById(id);
            if (!el) {
                el = document.createElement('div');
                el.id = id;
                el.setAttribute('role', 'status');
                el.style.cssText = [
                    'position:fixed', 'left:50%', 'top:12px', 'transform:translateX(-50%)',
                    'z-index:99999', 'max-width:min(92vw,420px)', 'padding:10px 16px',
                    'border-radius:10px', 'border:1px solid #ca8a04',
                    'background:linear-gradient(135deg,#422006,#713f12)',
                    'color:#fef3c7', 'font:700 14px/1.4 sans-serif',
                    'box-shadow:0 8px 28px rgba(0,0,0,.45)', 'text-align:center',
                    'pointer-events:none'
                ].join(';');
                (document.body || document.documentElement).appendChild(el);
            }
            el.textContent = msg;
            el.classList.remove('hidden');
        } catch (e) {}
        try {
            if (typeof logSys === 'function') {
                logSys('<span class="text-amber-300 font-bold">' + String(msg || '') + '</span>');
            }
        } catch (e2) {}
    }

    function _flushSave() {
        try {
            if (typeof player === 'undefined' || !player || !player.cls) return;
            if (typeof saveGame === 'function') saveGame();
        } catch (e) {}
        try {
            if (typeof _flushSaveNow === 'function') _flushSaveNow();
        } catch (e2) {}
        try {
            if (typeof window.cloudFlushLocalToCloud === 'function') window.cloudFlushLocalToCloud();
        } catch (e3) {}
    }

    function _reloadUrl(targetVer) {
        var url = location.href.split('#')[0];
        url = url.replace(/([?&])_v=[^&]*/g, '').replace(/([?&])_build=[^&]*/g, '').replace(/[?&]$/, '');
        var join = url.indexOf('?') >= 0 ? '&' : '?';
        var v = targetVer || _clientVer() || Date.now();
        return url + join + '_v=' + encodeURIComponent(String(v)) + '&_t=' + Date.now();
    }

    function _doReload(reason, targetVer) {
        if (_reloading) return;
        _reloading = true;
        _banner(reason || '偵測到新版本，正在強制更新…');
        _flushSave();
        setTimeout(function () {
            try {
                location.replace(_reloadUrl(targetVer));
            } catch (e) {
                try { location.reload(true); } catch (e2) {
                    try { location.reload(); } catch (e3) {}
                }
            }
        }, RELOAD_DELAY_MS);
    }

    function _versionUrl() {
        try {
            if (window.GAME_HOST && typeof window.GAME_HOST.apiUrl === 'function') {
                return window.GAME_HOST.apiUrl('/api/version?t=' + Date.now());
            }
        } catch (e) {}
        return '/api/version?t=' + Date.now();
    }

    function _needsReload(data) {
        if (!data || !data.ok) return false;
        var client = _clientVer();
        var serverVer = data.gameVersion ? String(data.gameVersion) : '';
        var buildId = data.buildId ? String(data.buildId) : '';
        if (serverVer && client && serverVer !== client) {
            return { reload: true, reason: '新版本 ' + serverVer + ' 已上線，正在更新…', ver: serverVer };
        }
        if (buildId) {
            if (!_bootBuildId) {
                _bootBuildId = buildId;
                try { window.__fb5BootBuildId = buildId; } catch (e) {}
            } else if (buildId !== _bootBuildId) {
                return { reload: true, reason: '伺服器已更新，正在同步…', ver: serverVer || buildId };
            }
        }
        if (typeof GAME_VERSION !== 'undefined' && client && String(GAME_VERSION) !== client) {
            return { reload: true, reason: '資源快取過期，正在更新…', ver: client };
        }
        return false;
    }

    function _poll() {
        if (!_isHttp() || _reloading) return;
        fetch(_versionUrl(), { method: 'GET', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                var need = _needsReload(data);
                if (need && need.reload) _doReload(need.reason, need.ver);
            })
            .catch(function () {});
    }

    function _start() {
        if (!_isHttp()) return;
        _poll();
        if (_timer) return;
        _timer = setInterval(_poll, POLL_MS);
        try {
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) _poll();
            });
        } catch (e) {}
        try {
            window.addEventListener('focus', function () { _poll(); });
        } catch (e) {}
        try {
            window.addEventListener('pageshow', function (ev) {
                if (ev && ev.persisted) _poll();
            });
        } catch (e2) {}
    }

    window.LiveUpdate = {
        poll: _poll,
        forceReload: function (reason, ver) { _doReload(reason, ver); },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _start);
    } else {
        _start();
    }
})();

/* 🔄 線上即時偵測伺服器部署：buildId 變更時自動存檔並重新載入，免玩家手動重製／硬重載 */
(function () {
    'use strict';

    var POLL_MS = 45000;
    var RELOAD_DELAY_MS = 2500;
    var _bootBuildId = null;
    var _reloading = false;
    var _timer = null;
    var _failStreak = 0;

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
    }

    function _doReload() {
        if (_reloading) return;
        _reloading = true;
        _banner('伺服器已更新，正在同步新版本…');
        _flushSave();
        setTimeout(function () {
            try {
                var url = location.href.split('#')[0];
                var join = url.indexOf('?') >= 0 ? '&' : '?';
                // 強制繞過快取重載
                location.replace(url.replace(/([?&])_build=\w+/g, '').replace(/[?&]$/, '') + join + '_build=' + Date.now());
            } catch (e) {
                try { location.reload(); } catch (e2) {}
            }
        }, RELOAD_DELAY_MS);
    }

    function _poll() {
        if (!_isHttp() || _reloading) return;
        if (typeof document !== 'undefined' && document.hidden) return;
        fetch('/api/version?t=' + Date.now(), { method: 'GET', cache: 'no-store' })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                _failStreak = 0;
                if (!data || !data.ok || !data.buildId) return;
                if (!_bootBuildId) {
                    _bootBuildId = String(data.buildId);
                    try { window.__fb5BuildId = _bootBuildId; } catch (e) {}
                    return;
                }
                if (String(data.buildId) !== String(_bootBuildId)) {
                    _doReload();
                }
            })
            .catch(function () {
                _failStreak += 1;
                // 連續失敗不重載，避免部署中瞬間 502 誤觸
            });
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _start);
    } else {
        _start();
    }
})();

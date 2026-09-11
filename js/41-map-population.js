// ===== 👥 地圖即時人數＋同圖可見玩家（組隊 presence 彙總）=====
// 人數越多 → 出怪延遲倍率越高；players 供戰場顯示其他冒險者（不限同隊）
(function () {
    var _mapPopCounts = {};
    var _mapPopPlayers = [];
    var _mapPopAt = 0;
    var _mapPopTimer = null;

    function mapPopOnline() {
        return typeof rtPartyIsHttp === 'function' && rtPartyIsHttp();
    }

    function mapPopCount(mapId) {
        if (!mapId || !mapPopOnline()) return 0;
        var n = _mapPopCounts[mapId];
        return (n > 0) ? Math.floor(n) : 0;
    }

    // 出怪延遲倍率：1 人=1.0；每多 1 人 +10%（上限 3.0≈21 人）
    function mapPopCrowdMult(mapId) {
        var n = mapPopCount(mapId);
        if (n <= 1) return 1;
        return Math.min(3, 1 + (n - 1) * 0.1);
    }

    function mapPopSuffix(mapId) {
        var n = mapPopCount(mapId);
        if (!mapPopOnline() || n <= 0) return '';
        return ' (' + n + '人)';
    }

    /** 同地圖其他線上玩家（不含自己），供戰場 sprite */
    function mapPopSameMapPlayers() {
        if (!mapPopOnline()) return [];
        var mapId = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
        if (!mapId || String(mapId).indexOf('town_') === 0) return [];
        return (_mapPopPlayers || []).filter(function (m) {
            return m && m.key && m.cls;
        }).map(function (m) {
            return {
                key: m.key,
                name: m.name || '冒險者',
                cls: m.cls,
                lv: m.lv || 1,
                hp: Math.max(0, Math.floor(Number(m.hp) || 0)),
                mhp: Math.max(1, Math.floor(Number(m.mhp) || 1)),
                online: m.online !== false,
                party: !!m.party
            };
        });
    }

    function mapPopApply(payload) {
        if (!payload || typeof payload !== 'object') return;
        var counts = payload.counts;
        if (counts && typeof counts === 'object') {
            _mapPopCounts = {};
            for (var k in counts) {
                if (!Object.prototype.hasOwnProperty.call(counts, k)) continue;
                var v = Math.max(0, Math.floor(Number(counts[k]) || 0));
                if (v > 0) _mapPopCounts[k] = v;
            }
        }
        if (Array.isArray(payload.players)) {
            _mapPopPlayers = payload.players.filter(function (m) {
                return m && m.key && m.cls;
            }).slice(0, 24);
        }
        _mapPopAt = payload.at || Date.now();
        mapPopRefreshSelectOptions();
        mapPopUpdateIndicator();
    }

    function mapPopRefreshSelectOptions() {
        if (!mapPopOnline()) return;
        var sel = document.getElementById('map-select');
        if (!sel) return;
        var cur = sel.value;
        Array.prototype.forEach.call(sel.options || [], function (o) {
            if (!o || !o.value) return;
            var base = o.getAttribute('data-base-title');
            if (!base) {
                base = o.textContent.replace(/\s*\(\d+人\)\s*$/, '');
                o.setAttribute('data-base-title', base);
            }
            o.textContent = base + mapPopSuffix(o.value);
        });
        if (cur) sel.value = cur;
    }

    function mapPopUpdateIndicator() {
        var el = document.getElementById('map-pop-indicator');
        if (!el) return;
        if (typeof mapState === 'undefined' || !mapState || !mapState.current) {
            el.classList.add('hidden');
            return;
        }
        var mapId = mapState.current;
        if (mapId.startsWith('town_')) {
            el.classList.add('hidden');
            return;
        }
        var n = mapPopCount(mapId);
        var peers = (_mapPopPlayers && _mapPopPlayers.length) || 0;
        if (!mapPopOnline() || (n <= 0 && peers <= 0)) {
            el.classList.add('hidden');
            return;
        }
        var showN = Math.max(n, peers + 1);
        var mult = mapPopCrowdMult(mapId);
        var slowHint = mult > 1.05 ? ' · 出怪較慢' : '';
        el.textContent = '👥 ' + showN + ' 人' + slowHint;
        el.classList.remove('hidden');
    }

    function mapPopIdentityQs() {
        var qs = '';
        try {
            if (typeof rtPartyIdentity === 'function') {
                var id = rtPartyIdentity();
                if (id && id.account) {
                    qs = '&account=' + encodeURIComponent(id.account)
                        + '&slot=' + encodeURIComponent(String(id.slot))
                        + '&name=' + encodeURIComponent(id.name || '');
                }
            }
        } catch (e) {}
        return qs;
    }

    function mapPopPollOnce() {
        if (!mapPopOnline()) return Promise.resolve();
        var mapId = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
        var url = '/api/map/population?mapId=' + encodeURIComponent(mapId || '') + mapPopIdentityQs();
        return fetch(url).then(function (res) { return res.json(); })
            .then(function (data) {
                if (data && data.ok && data.mapPop) mapPopApply(data.mapPop);
            }).catch(function () {});
    }

    function mapPopInGame() {
        try {
            var game = document.getElementById('game-screen');
            return !!(game && !game.classList.contains('hidden')
                && typeof player !== 'undefined' && player && player.cls);
        } catch (e) { return false; }
    }

    function mapPopStartWatch() {
        if (_mapPopTimer) return;
        _mapPopTimer = setInterval(function () {
            try {
                if (!mapPopOnline() || !mapPopInGame()) return;
                if (typeof mapState !== 'undefined' && mapState && mapState.current
                    && String(mapState.current).indexOf('town_') !== 0) {
                    mapPopPollOnce();
                }
            } catch (e) {}
        }, 5000);
    }

    window.mapPopCount = mapPopCount;
    window.mapPopCrowdMult = mapPopCrowdMult;
    window.mapPopSuffix = mapPopSuffix;
    window.mapPopSameMapPlayers = mapPopSameMapPlayers;
    window.mapPopApply = mapPopApply;
    window.mapPopRefreshSelectOptions = mapPopRefreshSelectOptions;
    window.mapPopUpdateIndicator = mapPopUpdateIndicator;
    window.mapPopPollOnce = mapPopPollOnce;
    mapPopStartWatch();
})();

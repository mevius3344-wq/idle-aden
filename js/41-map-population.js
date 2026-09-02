// ===== 👥 地圖即時人數（組隊 presence 彙總）=====
// 人數越多 → 出怪延遲倍率越高（分流狩獵壓力）
(function () {
    var _mapPopCounts = {};
    var _mapPopAt = 0;

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
        if (!mapPopOnline() || n <= 0) {
            el.classList.add('hidden');
            return;
        }
        var mult = mapPopCrowdMult(mapId);
        var slowHint = mult > 1.05 ? ' · 出怪較慢' : '';
        el.textContent = '👥 ' + n + ' 人' + slowHint;
        el.classList.remove('hidden');
    }

    function mapPopPollOnce() {
        if (!mapPopOnline()) return Promise.resolve();
        var mapId = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
        var url = '/api/map/population?mapId=' + encodeURIComponent(mapId || '');
        return fetch(url).then(function (res) { return res.json(); })
            .then(function (data) {
                if (data && data.ok && data.mapPop) mapPopApply(data.mapPop);
            }).catch(function () {});
    }

    window.mapPopCount = mapPopCount;
    window.mapPopCrowdMult = mapPopCrowdMult;
    window.mapPopSuffix = mapPopSuffix;
    window.mapPopApply = mapPopApply;
    window.mapPopRefreshSelectOptions = mapPopRefreshSelectOptions;
    window.mapPopUpdateIndicator = mapPopUpdateIndicator;
    window.mapPopPollOnce = mapPopPollOnce;
})();

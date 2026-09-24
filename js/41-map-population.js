// ===== 👥 地圖即時人數＋同圖可見玩家＋同圖共用怪（組隊 presence 彙總）=====
// 人數越多 → 出怪延遲倍率越高；players 供戰場顯示其他冒險者（不限同隊）
// 同圖 ≥2 人：穩定主機權威刷怪，其餘鏡像（_mapMirror）
(function () {
    var _mapPopCounts = {};
    var _mapPopPlayers = [];
    var _mapPopAt = 0;
    var _mapPopTimer = null;
    var _mapMobRev = 0;
    var _mapHostKey = '';

    function mapPopOnline() {
        try {
            if (typeof window !== 'undefined' && typeof window.gameOnlineSuspended === 'function' && window.gameOnlineSuspended()) return false;
            if (typeof window !== 'undefined' && window.__DEV_OFFLINE) return false;
        } catch (e) {}
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
        // 🪵 修練場個人區：不顯示其他人
        if (String(mapId) === 'training') return [];
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
                wx: Math.round(Number(m.wx) || 0),
                wy: Math.round(Number(m.wy) || 0),
                online: m.online !== false,
                party: !!m.party,
                pvpOn: !!m.pvpOn
            };
        });
    }

    function mapMobMapAllowed(mapId) {
        var id = String(mapId || '');
        if (!id || id.indexOf('town_') === 0) return false;
        if (id === 'training' || id === 'arena_pvp' || id === 'rift_battle') return false;
        try {
            if (typeof isWorldBossMap === 'function' && isWorldBossMap(id)) return false;
        } catch (e) {}
        try {
            if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS && KING_ROOMS[id]) return false;
        } catch (e2) {}
        try {
            if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS && PURE_BOSS_MAPS.indexOf(id) >= 0) return false;
        } catch (e3) {}
        try {
            if (typeof isSiegeArea === 'function' && isSiegeArea(id)) return false;
        } catch (e4) {}
        return true;
    }

    function mapMobMyKey() {
        try {
            if (typeof rtPartyMyKey === 'function') return rtPartyMyKey() || '';
        } catch (e) {}
        return '';
    }

    function mapMobElectHostLocal() {
        var me = mapMobMyKey();
        if (!me) return '';
        var keys = [me];
        (_mapPopPlayers || []).forEach(function (p) {
            if (p && p.key) keys.push(String(p.key));
        });
        if (keys.length < 2 && mapPopCount((typeof mapState !== 'undefined' && mapState) ? mapState.current : '') < 2) {
            return '';
        }
        keys.sort(function (a, b) { return a.localeCompare(b); });
        return keys[0] || '';
    }

    function mapMobShouldSync() {
        if (!mapPopOnline()) return false;
        var mapId = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
        if (!mapMobMapAllowed(mapId)) return false;
        if (_mapHostKey) return true;
        if ((_mapPopPlayers || []).length > 0) return true;
        return mapPopCount(mapId) > 1;
    }

    function mapMobHostKey() {
        if (_mapHostKey) return _mapHostKey;
        return mapMobElectHostLocal();
    }

    function mapMobShouldHost() {
        var host = mapMobHostKey();
        var me = mapMobMyKey();
        return !!(mapMobShouldSync() && host && me && host === me);
    }

    function mapMobShouldFollow() {
        var host = mapMobHostKey();
        var me = mapMobMyKey();
        return !!(mapMobShouldSync() && host && me && host !== me);
    }

    function mapMobDefByName(n) {
        if (!n || typeof DB === 'undefined' || !DB.mobs) return null;
        for (var k in DB.mobs) {
            if (DB.mobs[k] && DB.mobs[k].n === n) return k;
        }
        return null;
    }

    function mapMobPackSync() {
        if (typeof mapState === 'undefined' || !mapState || !Array.isArray(mapState.mobs)) return null;
        var mapId = mapState.current || '';
        if (!mapMobMapAllowed(mapId)) return null;
        var slots = [];
        var limit = (typeof backSlotsActive === 'function' && backSlotsActive()) ? 5 : 3;
        for (var i = 0; i < limit; i++) {
            var m = mapState.mobs[i];
            if (!m || m._dead || (m.curHp != null && m.curHp <= 0)) {
                slots.push({ i: i, dead: 1 });
                continue;
            }
            slots.push({
                i: i,
                n: m.n || '',
                uid: String(m.uid || ''),
                hp: Math.max(0, Math.floor(Number(m.curHp) || 0)),
                mhp: Math.max(1, Math.floor(Number(m.hp) || 1)),
                boss: !!m.boss,
                dead: 0
            });
        }
        _mapMobRev += 1;
        return { mapId: mapId, rev: _mapMobRev, slots: slots };
    }

    function mapMobApplySync(sync) {
        if (!sync || !sync.mapId || typeof mapState === 'undefined' || !mapState) return;
        if (sync.mapId !== mapState.current) return;
        if (mapMobShouldHost()) return;
        var rev = Math.floor(Number(sync.rev) || 0);
        if (rev && rev <= _mapMobRev) return;
        _mapMobRev = rev || _mapMobRev;
        if (sync.hostKey) _mapHostKey = String(sync.hostKey);
        var slots = sync.slots || [];
        var changed = false;
        slots.forEach(function (s) {
            if (!s || s.i == null) return;
            var idx = Math.max(0, Math.min(4, Math.floor(Number(s.i) || 0)));
            if (s.dead || !s.n) {
                var deadM = mapState.mobs[idx];
                if (deadM && deadM._mapMirror) {
                    mapState.mobs[idx] = null;
                    if (mapState.spawnAt) mapState.spawnAt[idx] = null;
                    changed = true;
                }
                return;
            }
            var cur = mapState.mobs[idx];
            if (!cur || String(cur.uid) !== String(s.uid)) {
                var mobId = mapMobDefByName(s.n);
                var base = mobId && DB.mobs[mobId] ? DB.mobs[mobId] : null;
                if (!base) return;
                mapState.mobs[idx] = Object.assign({}, base, {
                    curHp: Math.max(0, Math.floor(Number(s.hp) || 0)),
                    hp: Math.max(1, Math.floor(Number(s.mhp) || base.hp || 1)),
                    uid: String(s.uid || (typeof uid === 'function' ? uid() : String(Date.now()))),
                    _mapMirror: true,
                    _magCd: {},
                    justHit: false,
                    st: (typeof newMobStatus === 'function') ? newMobStatus() : {},
                    _born: (typeof _mobBornSeq !== 'undefined') ? (++_mobBornSeq) : 0
                });
                if (base.hard && typeof initHardSkin === 'function') initHardSkin(mapState.mobs[idx]);
                changed = true;
            } else if (cur._mapMirror) {
                cur.curHp = Math.max(0, Math.floor(Number(s.hp) || 0));
                if (s.mhp) cur.hp = Math.max(1, Math.floor(Number(s.mhp) || cur.hp || 1));
                changed = true;
            }
        });
        if (changed) {
            try { if (typeof renderMobs === 'function') renderMobs(); } catch (e) {}
        }
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

    /** 🌐 WebSocket 同圖快照：只更新本圖人數／玩家，不清掉其他圖 count */
    var _mapPopPrevKeys = Object.create(null);
    function mapPopApplyWsSnap(mapId, players, at, channel) {
        var id = String(mapId || '');
        if (!id) return;
        if (id === 'training') {
            _mapPopPlayers = [];
            _mapPopCounts[id] = 1;
            _mapPopAt = at || Date.now();
            _mapPopPrevKeys = Object.create(null);
            mapPopRefreshSelectOptions();
            mapPopUpdateIndicator();
            return;
        }
        var list = Array.isArray(players) ? players.filter(function (m) {
            return m && m.key && m.cls;
        }).slice(0, 24) : [];
        // 🩹 v3.9.46：僅在「已在圖上」時提示新人加入（首包不把原住民全當新人）
        try {
            var curMap = (typeof mapState !== 'undefined' && mapState) ? String(mapState.current || '') : '';
            if (curMap && curMap === id) {
                var hadPrev = false;
                for (var _pk in _mapPopPrevKeys) { if (Object.prototype.hasOwnProperty.call(_mapPopPrevKeys, _pk)) { hadPrev = true; break; } }
                var nextKeys = Object.create(null);
                list.forEach(function (m) {
                    if (!m || !m.key) return;
                    nextKeys[m.key] = 1;
                    if (hadPrev && !_mapPopPrevKeys[m.key] && typeof logSys === 'function') {
                        var nm = m.name || '冒險者';
                        logSys('<span class="text-emerald-300">【同圖】' + nm + ' 進入此地圖。</span>');
                    }
                });
                _mapPopPrevKeys = nextKeys;
            } else {
                _mapPopPrevKeys = Object.create(null);
            }
        } catch (eJoinLog) {}
        _mapPopPlayers = list;
        _mapPopCounts[id] = 1 + list.length;
        _mapPopAt = at || Date.now();
        if (channel != null) {
            try { window.__rtWorldChannel = Math.max(1, Math.floor(Number(channel) || 1)); } catch (e) {}
        }
        mapPopRefreshSelectOptions();
        mapPopUpdateIndicator();
        try {
            if (typeof _remotePartySpritesApply === 'function') _remotePartySpritesApply();
            else if (typeof window._remotePartySpritesApply === 'function') window._remotePartySpritesApply();
        } catch (eSpr2) {}
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
        var shareHint = mapMobShouldSync() ? ' · 共用怪' : '';
        var pvpHint = (typeof fieldPvpSelfOn === 'function' && fieldPvpSelfOn()) ? ' · PK' : '';
        var ch = 1;
        try {
            if (typeof rtWorldChannel === 'function') ch = rtWorldChannel() || 1;
            else if (window.__rtWorldChannel) ch = window.__rtWorldChannel;
        } catch (eCh) {}
        var chHint = (ch > 0) ? ('頻' + ch + ' · ') : '';
        el.textContent = chHint + '👥 ' + showN + ' 人' + shareHint + pvpHint + slowHint;
        el.classList.remove('hidden');
        el.title = '點擊切換頻道（1～8）';
        el.style.cursor = 'pointer';
        if (!el._chBound) {
            el._chBound = true;
            el.addEventListener('click', function () {
                try {
                    if (typeof rtWorldSwitchChannel !== 'function') return;
                    var cur = (typeof rtWorldChannel === 'function') ? rtWorldChannel() : 1;
                    var next = (cur % 8) + 1;
                    rtWorldSwitchChannel(next);
                } catch (eSw) {}
            });
        }
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
                if (data && data.mapHost) _mapHostKey = String(data.mapHost || '');
                if (data && data.mapMobs) mapMobApplySync(data.mapMobs);
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
    window.mapPopApplyWsSnap = mapPopApplyWsSnap;
    window.mapPopRefreshSelectOptions = mapPopRefreshSelectOptions;
    window.mapPopUpdateIndicator = mapPopUpdateIndicator;
    window.mapPopPollOnce = mapPopPollOnce;
    window.mapMobShouldSync = mapMobShouldSync;
    window.mapMobShouldHost = mapMobShouldHost;
    window.mapMobShouldFollow = mapMobShouldFollow;
    window.mapMobPackSync = mapMobPackSync;
    window.mapMobApplySync = mapMobApplySync;
    window.mapMobSetHostKey = function (k) { _mapHostKey = String(k || ''); };
    mapPopStartWatch();
})();

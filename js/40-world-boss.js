// ===== 👑 世界王（原版：頭目在自己的地圖固定地點出現）=====
// 頭目回到原出沒地圖固定點（slot 200+），全服所有頻道共用一隻、共用血量（伺服器 lib/rt-field-boss.js 權威）。
// 掉落給傷害最高者，經驗依傷害比例；擊敗後 1 小時重生。「世界王」分類／傳送師分頁＝重生時刻表＋地點。
// 軍王之室、純BOSS房（三龍窟／祭壇／聖地等）維持原機制不變。
(function () {
    var BOSS_SLOT_BASE = 200;   // 練功槽（練功點×每點隻數）之後，不跟一般怪搶格
    var _wbRegistry = [];
    var _wbStates = {};
    var _wbScheduleRespawnMs = 3600000;
    var _wbScheduleVisible = false;
    var _wbScheduleFetchAt = 0;
    var _wbScheduleTick = null;

    function wbIsHttp() {
        return typeof rtPartyIsHttp === 'function' && rtPartyIsHttp();
    }

    /** 舊版 wb_ 專屬欄位（已移除）；僅用來把舊存檔帶回頭目原地圖 */
    function isWorldBossMap(v) {
        return typeof v === 'string' && v.indexOf('wb_') === 0;
    }

    function wbExcludeMap(mapId) {
        if (!mapId || mapId.indexOf('town_') === 0 || isWorldBossMap(mapId)) return true;
        if (mapId.indexOf('pride_f') === 0 || mapId === 'pride_climb') return true;
        if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.indexOf(mapId) >= 0) return true;
        if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[mapId]) return true;
        if (mapId === 'training' || mapId === 'arena_pvp' || mapId === 'rift_battle' || mapId === 'oblivion_travel') return true;
        if (typeof isSiegeArea === 'function' && isSiegeArea(mapId)) return true;
        if (typeof SIEGE_CASTLES !== 'undefined' && SIEGE_CASTLES.indexOf(mapId) >= 0) return true;
        return false;
    }

    function wbExcludeMob(mobId, mob) {
        if (!mob || !mob.boss) return true;
        if (mob.siegeEnemy || mob.trollPlayer || mobId === 'obli_portal') return true;
        return false;
    }

    function wbBuildRegistry() {
        if (typeof DB === 'undefined' || !DB.maps || !DB.mobs) return;
        var seen = {};
        var out = [];
        function pushEntry(mobId, home) {
            if (seen[mobId] || !home) return;
            var mob = DB.mobs[mobId];
            if (!mob || wbExcludeMob(mobId, mob)) return;
            seen[mobId] = true;
            out.push({ mobId: mobId, home: home, t: mob.n, lv: mob.lv || 0 });
        }
        for (var mapId in DB.maps) {
            if (wbExcludeMap(mapId)) continue;
            (DB.maps[mapId] || []).forEach(function (mobId) { pushEntry(mobId, mapId); });
        }
        pushEntry('kari', 'zone_31');
        pushEntry('lindvior', 'dragon_valley');
        pushEntry('demon_assassin', 'hidden_cave');
        out.sort(function (a, b) {
            return (a.lv - b.lv) || String(a.t).localeCompare(String(b.t), 'zh-Hant');
        });
        _wbRegistry = out;
    }

    function wbEntryByMob(mobId) {
        for (var i = 0; i < _wbRegistry.length; i++) if (_wbRegistry[i].mobId === mobId) return _wbRegistry[i];
        return null;
    }

    /** 能從地區選單／傳送師直接前往的地圖（其餘＝走路過去） */
    function wbTravelEntry(mapId) {
        if (typeof mapRegionOf !== 'function' || !mapRegionOf(mapId)) return null;
        return (typeof mapEntryOf === 'function') ? mapEntryOf(mapId) : null;
    }

    var WB_EXTRA_MAP_NAMES = { oblivion_island: '遺忘之島', dream_island: '夢幻之島' };

    function wbMapTitle(mapId) {
        var e = (typeof mapEntryOf === 'function') ? mapEntryOf(mapId) : null;
        if (e && e.t) return e.t;
        if (typeof HIDDEN_AREA_NAMES !== 'undefined' && HIDDEN_AREA_NAMES[mapId]) return HIDDEN_AREA_NAMES[mapId];
        return WB_EXTRA_MAP_NAMES[mapId] || mapId;
    }

    function wbBossRollDisabled(mapId) {
        if (mapId === 'oblivion_travel') return false;   // 🏝️ 途中傳送門頭目仍在此圖隨機出現
        if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.indexOf(mapId) >= 0) return false;
        if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[mapId]) return false;
        if (mapId === 'rift_battle' || mapId === 'training' || mapId === 'arena_pvp') return false;
        if (typeof isSiegeArea === 'function' && isSiegeArea(mapId)) return false;
        if (typeof ANTHARAS_AREA_BOSS !== 'undefined' && ANTHARAS_AREA_BOSS[mapId]) return false;
        return true;
    }

    /** 本圖世界王＋固定重生點（離出生點最遠的練功點起依序排；各端算法一致） */
    function wbBossDefsForMap(mapId) {
        var list = _wbRegistry.filter(function (e) { return e.home === mapId; });
        if (!list.length) return [];
        list.sort(function (a, b) { return a.mobId < b.mobId ? -1 : (a.mobId > b.mobId ? 1 : 0); });
        var spots = (typeof mapdefSpawns === 'function' ? mapdefSpawns(mapId) : null) || [];
        spots = spots.filter(function (s) { return s && isFinite(s.x) && isFinite(s.y); });
        var def = (typeof mapdefOf === 'function') ? mapdefOf(mapId) : null;
        var sx = def && def.start ? Number(def.start.x) || 0 : 0;
        var sy = def && def.start ? Number(def.start.y) || 0 : 0;
        spots.sort(function (a, b) {
            var da = (a.x - sx) * (a.x - sx) + (a.y - sy) * (a.y - sy);
            var db = (b.x - sx) * (b.x - sx) + (b.y - sy) * (b.y - sy);
            return (db - da) || String(a.id || '').localeCompare(String(b.id || ''));
        });
        var mapName = wbMapTitle(mapId);
        return list.slice(0, 8).map(function (e, k) {
            var base = DB.mobs[e.mobId] || {};
            var spot = spots.length ? spots[k % spots.length] : { x: 0, y: 0 };
            var tmp = Object.assign({}, base);
            if (base.hard && typeof initHardSkin === 'function') { try { initHardSkin(tmp); } catch (eH) {} }
            return {
                id: e.mobId,
                slot: BOSS_SLOT_BASE + k,
                n: base.n || e.t,
                mhp: Math.max(1, Math.floor(Number(base.hp) || 1)),
                lv: Math.max(1, Math.floor(Number(base.lv) || 1)),
                ac: Math.floor(Number(base.ac != null ? base.ac : 10)),
                dr: Math.max(0, Math.floor(Number(base.dr) || 0)),
                hardSkin: Math.max(0, Math.floor(Number(tmp.hardSkin) || 0)),
                er: Math.max(0, Math.floor(Number(base.er) || 0)),
                x: Math.round(Number(spot.x) || 0),
                y: Math.round(Number(spot.y) || 0),
                mapName: mapName
            };
        });
    }

    /** 「世界王」分類：每隻頭目一個選項，前往＝牠的原地圖（沿用該地圖的進入條件） */
    function wbWorldBossList() {
        var out = [];
        _wbRegistry.forEach(function (e) {
            var me = wbTravelEntry(e.home);
            if (!me) return;
            out.push(Object.assign({}, me, { v: e.home, t: e.t + '｜' + me.t, c: '#fb923c', mobId: e.mobId }));
        });
        return out;
    }

    function wbRegionMapList(cat) {
        if (cat === 'worldboss') return wbWorldBossList();
        return null;
    }

    function wbFormatCountdown(ms) {
        if (!ms || ms <= 0) return '—';
        var sec = Math.ceil(ms / 1000);
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = sec % 60;
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        if (h > 0) return h + ':' + p(m) + ':' + p(s);
        return m + ':' + p(s);
    }

    function wbFetchScheduleStatus(force) {
        var now = Date.now();
        if (!force && now - _wbScheduleFetchAt < 8000) return Promise.resolve();
        _wbScheduleFetchAt = now;
        if (!wbIsHttp()) return Promise.resolve();
        return fetch('/api/worldboss/status', { cache: 'no-store' })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (!data || !data.ok) return;
                if (data.respawnMs) _wbScheduleRespawnMs = Math.max(5000, Number(data.respawnMs) || 3600000);
                var map = {};
                (data.bosses || []).forEach(function (st) {
                    if (st && st.id) map[st.id] = st;
                });
                _wbStates = map;
                wbRenderSchedule();
            })
            .catch(function () {});
    }

    function wbEsc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function wbScheduleRows(withGo) {
        var now = Date.now();
        return _wbRegistry.map(function (e) {
            var st = _wbStates[e.mobId] || null;
            var home = (st && st.mapId) || e.home;
            var statusHtml = '<span class="wb-schedule-alive">存活</span>';
            var cdHtml = '<span class="text-slate-500">—</span>';
            if (st) {
                if (st.dead && st.respawnAt && st.respawnAt > now) {
                    statusHtml = '<span class="wb-schedule-dead">已擊敗</span>';
                    cdHtml = '<span class="wb-schedule-cd">' + wbFormatCountdown(st.respawnAt - now) + '</span>';
                } else if (!st.dead && st.hp > 0 && st.mhp > 0) {
                    var pct = Math.max(0, Math.min(100, Math.round((st.hp / st.mhp) * 100)));
                    statusHtml = '<span class="wb-schedule-alive">存活</span> <span class="wb-schedule-hp">(' + pct + '%)</span>';
                }
            }
            var go = '';
            if (withGo) {
                var me = wbTravelEntry(home);
                var dis = !me || (typeof mapOptDisabled === 'function' && mapOptDisabled(me));
                var here = typeof mapState !== 'undefined' && mapState && mapState.current === home;
                if (here) go = '<td><span class="wb-schedule-alive">📍 此地</span></td>';
                else if (!me) go = '<td><span class="text-slate-500">步行前往</span></td>';
                else go = '<td><button type="button" class="tp-map-btn wb-go" data-map="' + wbEsc(home) + '"' + (dis ? ' disabled' : '') + '>' + (dis ? '無法前往' : '前往') + '</button></td>';
            }
            return '<tr data-wb-mob="' + wbEsc(e.mobId) + '"><td class="wb-schedule-name">' + wbEsc(e.t) + '</td><td>' + (e.lv || '—') + '</td><td>' + wbEsc(wbMapTitle(home)) + '</td><td>' + statusHtml + '</td><td>' + cdHtml + '</td>' + go + '</tr>';
        }).join('');
    }

    function wbScheduleMetaHtml() {
        var mins = Math.max(1, Math.round(_wbScheduleRespawnMs / 60000));
        return '頭目在自己的地圖出現 · 擊敗後 <b>' + mins + '</b> 分鐘重生 · 全服共用一隻 · 掉落歸傷害最高者、經驗依傷害比例';
    }

    /** 傳送師「世界王」分頁內容 */
    function wbScheduleHtml(withGo) {
        var rows = wbScheduleRows(!!withGo);
        return '<div class="wb-schedule-panel wb-schedule-inline">' +
            '<div class="wb-schedule-head"><span class="wb-schedule-title">🌍 世界王時間表</span>' +
            '<span class="wb-schedule-meta">' + wbScheduleMetaHtml() + '</span></div>' +
            '<div class="wb-schedule-scroll"><table class="wb-schedule-table"><thead><tr><th>頭目</th><th>Lv</th><th>地點</th><th>狀態</th><th>重生</th>' + (withGo ? '<th></th>' : '') + '</tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="6" class="text-slate-500 text-center">尚無世界王資料</td></tr>') + '</tbody></table></div></div>';
    }

    function wbRenderSchedule() {
        var panel = document.getElementById('wb-schedule-panel');
        var body = document.getElementById('wb-schedule-body');
        var meta = document.getElementById('wb-schedule-meta');
        if (!panel || !body) return;
        if (!_wbScheduleVisible) {
            panel.classList.add('hidden');
            return;
        }
        panel.classList.remove('hidden');
        if (meta) meta.innerHTML = wbScheduleMetaHtml();
        body.innerHTML = wbScheduleRows(false) || '<tr><td colspan="5" class="text-slate-500 text-center">尚無世界王資料</td></tr>';
    }

    function wbOnCategoryChange(cat) {
        _wbScheduleVisible = cat === 'worldboss';
        var panel = document.getElementById('wb-schedule-panel');
        if (panel) panel.classList.toggle('hidden', !_wbScheduleVisible);
        if (_wbScheduleVisible) {
            wbFetchScheduleStatus(true);
            wbRenderSchedule();
        }
    }

    /** 舊存檔停在已移除的 wb_ 欄位 → 帶回頭目原地圖 */
    function wbMigrateLegacyMap() {
        if (typeof mapState === 'undefined' || !mapState || !isWorldBossMap(mapState.current)) return;
        if (typeof player === 'undefined' || !player || !player.cls) return;
        var e = wbEntryByMob(String(mapState.current).slice(3));
        var target = (e && wbTravelEntry(e.home)) ? e.home : (typeof getHomeTown === 'function' ? getHomeTown() : 'town_giran');
        try {
            if (typeof setMapSelectors === 'function') setMapSelectors(target);
            if (typeof changeMap === 'function') changeMap(true);
        } catch (eMv) {}
    }

    function wbStartScheduleLoop() {
        if (_wbScheduleTick) return;
        _wbScheduleTick = setInterval(function () {
            wbMigrateLegacyMap();
            var catEl = document.getElementById('map-category');
            var cat = catEl ? catEl.value : '';
            if (cat === 'worldboss') {
                if (!_wbScheduleVisible) wbOnCategoryChange('worldboss');
                wbFetchScheduleStatus(false);
                wbRenderSchedule();
            } else if (_wbScheduleVisible) {
                wbOnCategoryChange(cat);
            }
        }, 1000);
    }

    function wbInit() {
        wbBuildRegistry();
        wbStartScheduleLoop();
        var catEl = document.getElementById('map-category');
        if (catEl && catEl.value === 'worldboss') wbOnCategoryChange('worldboss');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wbInit);
    } else {
        setTimeout(wbInit, 0);
    }

    window.isWorldBossMap = isWorldBossMap;
    window.wbBossRollDisabled = wbBossRollDisabled;
    window.wbBossDefsForMap = wbBossDefsForMap;
    window.wbRegionMapList = wbRegionMapList;
    window.wbWorldBossList = wbWorldBossList;
    window.wbOnCategoryChange = wbOnCategoryChange;
    window.wbRenderSchedule = wbRenderSchedule;
    window.wbScheduleHtml = wbScheduleHtml;
    window.wbFetchScheduleStatus = wbFetchScheduleStatus;
    window.wbBossRegistry = function () { return _wbRegistry.slice(); };
})();

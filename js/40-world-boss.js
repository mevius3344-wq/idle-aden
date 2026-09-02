// ===== 👑 世界王（全服即時）=====
// 野外／地監頭目不再個別隨機刷出，改由「世界王」或「BOSS專區」進入專用欄位，全服共用血量。
// 軍王之室、純BOSS房（三龍窟／祭壇／聖地等）維持原機制不變。
(function () {
    var WB_MAP_PREFIX = 'wb_';
    var _wbRegistry = [];
    var _wbByMap = {};
    var _wbRev = 0;
    var _wbSeq = 0;
    var _wbLastState = null;
    var _wbDamaged = false;

    function wbIsHttp() {
        return typeof rtPartyIsHttp === 'function' && rtPartyIsHttp();
    }

    function wbIdentity() {
        if (typeof rtPartyIdentity === 'function') return rtPartyIdentity();
        if (typeof player === 'undefined' || !player) return null;
        var acc = (player._cloudAccount || player.account || '').trim();
        if (!acc) return null;
        return { account: acc, slot: player._cloudSlot || 0, name: player.name || '' };
    }

    function wbMyKey() {
        var id = wbIdentity();
        if (!id || !id.account) return '';
        return id.account + '#' + (id.slot || 0);
    }

    function isWorldBossMap(v) {
        return typeof v === 'string' && v.startsWith(WB_MAP_PREFIX);
    }

    function wbMobIdFromMap(v) {
        return isWorldBossMap(v) ? v.slice(WB_MAP_PREFIX.length) : '';
    }

    function wbMapIdFromMob(mobId) {
        return WB_MAP_PREFIX + mobId;
    }

    function wbEntryByMap(v) {
        return _wbByMap[v] || null;
    }

    function wbEntryByMob(mobId) {
        return _wbRegistry.find(function (e) { return e.mobId === mobId; }) || null;
    }

    function wbExcludeMap(mapId) {
        if (!mapId || mapId.startsWith('town_') || mapId.startsWith(WB_MAP_PREFIX)) return true;
        if (mapId.startsWith('pride_f') || mapId === 'pride_climb' || mapId === 'town_pride') return true;
        if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.indexOf(mapId) >= 0) return true;
        if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[mapId]) return true;
        if (mapId === 'training' || mapId === 'arena_pvp' || mapId === 'rift_battle') return true;
        if (mapId === 'dream_island' || mapId === 'oblivion_travel' || mapId === 'oblivion_island') return true;
        if (typeof isSiegeArea === 'function' && isSiegeArea(mapId)) return true;
        if (typeof SIEGE_CASTLES !== 'undefined' && SIEGE_CASTLES.indexOf(mapId) >= 0) return true;
        return false;
    }

    function wbExcludeMob(mobId, mob) {
        if (!mob || !mob.boss) return true;
        if (mob.siegeEnemy || mob.trollPlayer || mob.noAutoTeleport && mobId === 'obli_portal') return true;
        if (mobId === 'obli_portal') return true;
        return false;
    }

    function wbBuildRegistry() {
        if (typeof DB === 'undefined' || !DB.maps || !DB.mobs) return;
        var seen = {};
        var dreamBosses = {};
        var oblivionBosses = {};
        (DB.maps.dream_island || []).forEach(function (id) {
            if (DB.mobs[id] && DB.mobs[id].boss) dreamBosses[id] = true;
        });
        (DB.maps.oblivion_island || []).forEach(function (id) {
            if (DB.mobs[id] && DB.mobs[id].boss) oblivionBosses[id] = true;
        });
        var out = [];
        function pushEntry(mobId, srcMap, zone) {
            if (seen[mobId]) return;
            var mob = DB.mobs[mobId];
            if (!mob || wbExcludeMob(mobId, mob)) return;
            seen[mobId] = true;
            var wbMap = wbMapIdFromMob(mobId);
            var entry = {
                mobId: mobId,
                srcMap: srcMap || '',
                zone: zone || 'global',
                v: wbMap,
                t: mob.n,
                c: '#fb923c'
            };
            out.push(entry);
            _wbByMap[wbMap] = entry;
            if (!DB.maps[wbMap]) DB.maps[wbMap] = [];
        }
        for (var mapId in DB.maps) {
            if (wbExcludeMap(mapId)) continue;
            (DB.maps[mapId] || []).forEach(function (mobId) {
                if (dreamBosses[mobId] || oblivionBosses[mobId]) return;
                pushEntry(mobId, mapId, 'global');
            });
        }
        for (var dId in dreamBosses) pushEntry(dId, 'dream_island', 'dream');
        for (var oId in oblivionBosses) pushEntry(oId, 'oblivion_island', 'oblivion');
        pushEntry('kari', 'zone_31', 'global');
        pushEntry('lindvior', 'dragon_valley', 'global');
        pushEntry('demon_assassin', 'hidden_cave', 'global');
        out.sort(function (a, b) {
            var la = (DB.mobs[a.mobId] && DB.mobs[a.mobId].lv) || 0;
            var lb = (DB.mobs[b.mobId] && DB.mobs[b.mobId].lv) || 0;
            return la - lb || String(a.t).localeCompare(String(b.t), 'zh-Hant');
        });
        _wbRegistry = out;
    }

    function wbBossRollDisabled(mapId) {
        if (isWorldBossMap(mapId)) return false;
        if (mapId === 'oblivion_travel') return false;   // 🏝️ 途中傳送門頭目仍在此圖隨機出現
        if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.indexOf(mapId) >= 0) return false;
        if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[mapId]) return false;
        if (mapId === 'rift_battle' || mapId === 'training' || mapId === 'arena_pvp') return false;
        if (typeof isSiegeArea === 'function' && isSiegeArea(mapId)) return false;
        if (typeof ANTHARAS_AREA_BOSS !== 'undefined' && ANTHARAS_AREA_BOSS[mapId]) return false;
        return true;
    }

    function wbBossZoneVisible() {
        if (typeof mapState === 'undefined' || !mapState) return false;
        if (mapState.current === 'dream_island') return true;
        if (typeof state !== 'undefined' && state && state.oblivion) return true;
        if (mapState.current === 'oblivion_travel' || mapState.current === 'oblivion_island') return true;
        return false;
    }

    function wbWorldBossList() {
        return _wbRegistry.filter(function (e) { return e.zone === 'global'; });
    }

    function wbBossZoneList() {
        if (!wbBossZoneVisible()) return [];
        var zones = [];
        if (typeof mapState !== 'undefined' && mapState) {
            if (mapState.current === 'dream_island') zones.push('dream');
            if (state && state.oblivion) zones.push('oblivion');
            if (mapState.current === 'oblivion_travel' || mapState.current === 'oblivion_island') zones.push('oblivion');
        }
        zones = zones.filter(function (z, i, a) { return a.indexOf(z) === i; });
        return _wbRegistry.filter(function (e) { return zones.indexOf(e.zone) >= 0; });
    }

    function wbShouldHost() {
        if (!isWorldBossMap(mapState.current)) return false;
        if (!wbIsHttp()) return true;
        if (!_wbLastState) return true;
        return !!_wbLastState.isHost;
    }

    function wbShouldFollow() {
        if (!isWorldBossMap(mapState.current)) return false;
        if (!wbIsHttp()) return false;
        if (!_wbLastState) return false;
        return !_wbLastState.isHost && !!_wbLastState.hostKey;
    }

    function wbMobDefByName(n) {
        if (!n || !DB.mobs) return null;
        for (var k in DB.mobs) {
            if (DB.mobs[k] && DB.mobs[k].n === n) return k;
        }
        return null;
    }

    function wbPackMobSync() {
        if (!isWorldBossMap(mapState.current) || !mapState.mobs) return null;
        var slots = [];
        for (var i = 0; i < 3; i++) {
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
        _wbRev += 1;
        return { mapId: mapState.current, rev: _wbRev, slots: slots };
    }

    function wbApplySync(sync) {
        if (!sync || !sync.mapId || typeof mapState === 'undefined' || !mapState) return;
        if (sync.mapId !== mapState.current) return;
        if (wbShouldHost()) return;
        var rev = Math.floor(Number(sync.rev) || 0);
        if (rev && rev <= _wbRev) return;
        _wbRev = rev || _wbRev;
        var slots = sync.slots || [];
        var changed = false;
        slots.forEach(function (s) {
            if (!s || s.i == null) return;
            var idx = Math.max(0, Math.min(4, Math.floor(Number(s.i) || 0)));
            if (s.dead || !s.n) {
                var deadM = mapState.mobs[idx];
                if (deadM && (deadM._wbMirror || deadM._worldBossMirror)) {
                    mapState.mobs[idx] = null;
                    if (mapState.spawnAt) mapState.spawnAt[idx] = null;
                    changed = true;
                }
                return;
            }
            var cur = mapState.mobs[idx];
            if (!cur || String(cur.uid) !== String(s.uid)) {
                var mobId = wbMobDefByName(s.n);
                var base = mobId && DB.mobs[mobId] ? DB.mobs[mobId] : null;
                if (!base) return;
                mapState.mobs[idx] = Object.assign({}, base, {
                    curHp: Math.max(0, Math.floor(Number(s.hp) || 0)),
                    hp: Math.max(1, Math.floor(Number(s.mhp) || base.hp || 1)),
                    uid: String(s.uid || (typeof uid === 'function' ? uid() : String(Date.now()))),
                    _wbMirror: true,
                    _worldBossMirror: true,
                    _magCd: {},
                    justHit: false,
                    st: (typeof newMobStatus === 'function') ? newMobStatus() : {},
                    _born: (typeof _mobBornSeq !== 'undefined') ? (++_mobBornSeq) : 0
                });
                if (base.hard && typeof initHardSkin === 'function') initHardSkin(mapState.mobs[idx]);
                changed = true;
            } else if (cur._wbMirror || cur._worldBossMirror) {
                cur.curHp = Math.max(0, Math.floor(Number(s.hp) || 0));
                if (s.mhp) cur.hp = Math.max(1, Math.floor(Number(s.mhp) || cur.hp || 1));
                changed = true;
            }
        });
        if (changed) {
            try { if (typeof renderMobs === 'function') renderMobs(); } catch (e) {}
        }
    }

    function wbReportDamage(mob, dmg) {
        if (!wbIsHttp() || !isWorldBossMap(mapState.current) || !mob || dmg <= 0) return;
        _wbDamaged = true;
        var pack = {
            mapId: mapState.current,
            mobId: wbMobIdFromMap(mapState.current),
            mobName: mob.n || '',
            mhp: Math.max(1, Math.floor(Number(mob.hp) || 1)),
            damage: { uid: String(mob.uid || ''), amount: Math.max(0, Math.floor(dmg)) }
        };
        wbPostHeartbeat(pack);
    }

    function wbPostHeartbeat(extra) {
        var id = wbIdentity();
        if (!id) return Promise.resolve();
        var body = Object.assign({
            account: id.account,
            slot: id.slot,
            name: id.name || ''
        }, (typeof anticheatAuthExtras === 'function' ? anticheatAuthExtras() : {}), extra || {});
        return fetch('/api/worldboss/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (res) { return res.json(); })
            .then(function (data) {
                if (!data || !data.ok) return;
                _wbLastState = data;
                if (data.wbSync) wbApplySync(data.wbSync);
                if (data.seq && data.seq > _wbSeq) _wbSeq = data.seq;
            }).catch(function () {});
    }

    function wbHeartbeat() {
        if (!isWorldBossMap(mapState.current)) return Promise.resolve();
        var mobId = wbMobIdFromMap(mapState.current);
        var base = mobId && DB.mobs[mobId] ? DB.mobs[mobId] : null;
        var extra = {
            mapId: mapState.current,
            mobId: mobId,
            mobName: base ? base.n : '',
            mhp: base ? base.hp : 1
        };
        if (wbShouldHost()) {
            var pack = wbPackMobSync();
            if (pack) extra.mobSync = pack;
        }
        return wbPostHeartbeat(extra);
    }

    function wbPollOnce() {
        if (!wbIsHttp()) return Promise.resolve();
        var id = wbIdentity();
        if (!id) return Promise.resolve();
        var mapId = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
        if (!isWorldBossMap(mapId)) return Promise.resolve();
        var url = '/api/worldboss/poll?account=' + encodeURIComponent(id.account)
            + '&slot=' + encodeURIComponent(String(id.slot))
            + '&since=' + encodeURIComponent(String(_wbSeq))
            + '&mapId=' + encodeURIComponent(mapId);
        return fetch(url).then(function (res) { return res.json(); })
            .then(function (data) {
                if (!data || !data.ok) return;
                if (data.wbSync) wbApplySync(data.wbSync);
                if (data.seq && data.seq > _wbSeq) _wbSeq = data.seq;
                if (data.events && data.events.length) {
                    data.events.forEach(function (ev) {
                        if (!ev || ev.type !== 'wb_kill') return;
                        if (ev.mapId !== mapState.current) return;
                        if (typeof pushBossMarquee === 'function') {
                            try { pushBossMarquee('【世界王】' + (ev.killerName || '勇者') + ' 擊敗了 ' + (ev.mobName || '頭目') + '！', { online: true }); } catch (e) {}
                        }
                    });
                }
            }).catch(function () {});
    }

    function wbOnMapEnter() {
        _wbRev = 0;
        _wbDamaged = false;
        _wbLastState = null;
        wbHeartbeat();
    }

    function wbSpawnCenterBoss() {
        if (!isWorldBossMap(mapState.current)) return;
        if (wbShouldFollow()) return;
        var mobId = wbMobIdFromMap(mapState.current);
        var base = mobId && DB.mobs[mobId] ? DB.mobs[mobId] : null;
        if (!base) return;
        if (mapState.mobs[1] && mapState.mobs[1].boss && !mapState.mobs[1]._dead) return;
        mapState.mobs[1] = Object.assign({}, base, {
            curHp: base.hp,
            uid: (typeof uid === 'function') ? uid() : String(Date.now()),
            _born: (typeof _mobBornSeq !== 'undefined') ? (++_mobBornSeq) : 0,
            _bornMs: Date.now(),
            _magCd: {},
            justHit: false,
            st: (typeof newMobStatus === 'function') ? newMobStatus() : {}
        });
        if (base.hard && typeof initHardSkin === 'function') initHardSkin(mapState.mobs[1]);
        if (typeof vfxBossEntrance === 'function') { try { vfxBossEntrance(mapState.mobs[1]); } catch (e) {} }
        if (typeof announceBossSpawn === 'function') { try { announceBossSpawn(mapState.mobs[1]); } catch (e) {} }
        if (mapState.spawnAt) mapState.spawnAt[1] = null;
        try { if (typeof renderMobs === 'function') renderMobs(); } catch (e) {}
    }

    function wbRegionMapList(cat) {
        if (cat === 'worldboss') return wbWorldBossList();
        if (cat === 'boss_zone') return wbBossZoneList();
        return null;
    }

    function wbServerState() {
        return _wbLastState && _wbLastState.wbState ? _wbLastState.wbState : null;
    }

    function wbUpdateIndicator() {
        var ind = document.getElementById('pride-floor-indicator');
        if (!ind) return;
        if (!isWorldBossMap(mapState.current)) return;
        var entry = wbEntryByMap(mapState.current);
        var st = _wbLastState && _wbLastState.wbState;
        var extra = '';
        if (st && st.dead && st.respawnAt) {
            var sec = Math.max(0, Math.ceil((st.respawnAt - Date.now()) / 1000));
            extra = ' · 復活 ' + sec + ' 秒';
        } else if (st && st.hp > 0) {
            extra = ' · HP ' + Math.max(0, st.hp) + '/' + st.mhp;
        }
        ind.textContent = '👑 世界王：' + (entry ? entry.t : '') + extra;
        ind.classList.remove('hidden');
    }

    var _wbTimer = null;
    function wbStartLoop() {
        if (_wbTimer) return;
        _wbTimer = setInterval(function () {
            if (typeof mapState === 'undefined' || !mapState || !isWorldBossMap(mapState.current)) return;
            wbHeartbeat();
            wbPollOnce();
            wbUpdateIndicator();
        }, 3000);
    }

    function wbInit() {
        wbBuildRegistry();
        wbStartLoop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wbInit);
    } else {
        setTimeout(wbInit, 0);
    }

    window.isWorldBossMap = isWorldBossMap;
    window.wbBossRollDisabled = wbBossRollDisabled;
    window.wbShouldHost = wbShouldHost;
    window.wbShouldFollow = wbShouldFollow;
    window.wbSpawnCenterBoss = wbSpawnCenterBoss;
    window.wbOnMapEnter = wbOnMapEnter;
    window.wbReportDamage = wbReportDamage;
    window.wbRegionMapList = wbRegionMapList;
    window.wbBossZoneVisible = wbBossZoneVisible;
    window.wbEntryByMap = wbEntryByMap;
    window.wbWorldBossList = wbWorldBossList;
    window.wbBossZoneList = wbBossZoneList;
    window.wbServerState = wbServerState;
    window.wbUpdateIndicator = wbUpdateIndicator;
})();

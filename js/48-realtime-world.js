// ===== 🌐 MMORPG 即時世界（WebSocket 同圖玩家）=====
// 目標：同圖可見／座標近即時；HTTP 組隊輪詢降為備援。
(function () {
    'use strict';

    var WS_PATH = '/ws/world';
    var RECONNECT_MS = 1800;
    var MOVE_SEND_MS = 100;
    var HELLO_MS = 2500;
    var _ws = null;
    var _want = true;
    var _retryTimer = null;
    var _helloTimer = null;
    var _lastMoveSent = 0;
    var _lastWx = null;
    var _lastWy = null;
    var _lastMap = '';
    var _connected = false;
    var _myKey = '';
    var _channel = 1;
    var _pendingEnter = null;

    function rtWorldOnline() {
        try {
            if (typeof window !== 'undefined' && typeof window.gameOnlineSuspended === 'function' && window.gameOnlineSuspended()) return false;
            if (typeof window !== 'undefined' && window.__DEV_OFFLINE) return false;
        } catch (e) {}
        try {
            var p = String(location.protocol || '');
            return p === 'http:' || p === 'https:';
        } catch (e2) { return false; }
    }

    function rtWorldInGame() {
        try {
            var game = document.getElementById('game-screen');
            return !!(game && !game.classList.contains('hidden')
                && typeof player !== 'undefined' && player && player.cls);
        } catch (e) { return false; }
    }

    function rtWorldAuthMapOk(mapId) {
        var id = String(mapId || '');
        if (!id || id.indexOf('town_') === 0) return false;
        // 🪵 新兵修練場＝個人練習區（不共用怪／不權威擊殺）
        if (id === 'training') return false;
        if (id === 'arena_pvp' || id === 'rift_battle') return false;
        if (id.indexOf('wb_') === 0 || id.indexOf('world_boss') === 0) return false;
        if (id.indexOf('king_') === 0 || id.indexOf('siege') >= 0) return false;
        return true;
    }

    /** 場戰且 WS 在線 → 攻擊走伺服器結算／同圖同步（修練場除外） */
    function rtWorldAuthCombatActive() {
        if (!_connected || !rtWorldOnline()) return false;
        var mapId = '';
        try { mapId = (typeof mapState !== 'undefined' && mapState) ? (mapState.current || '') : ''; } catch (e2) {}
        if (!rtWorldAuthMapOk(mapId)) return false;
        try {
            if (typeof exploreFieldCombatActive === 'function' && exploreFieldCombatActive()) return true;
        } catch (e) {}
        return false;
    }

    var _mobsRev = 0;

    function rtWorldFindMob(uid) {
        if (!uid || typeof mapState === 'undefined' || !mapState || !Array.isArray(mapState.mobs)) return null;
        var key = String(uid);
        for (var i = 0; i < mapState.mobs.length; i++) {
            var m = mapState.mobs[i];
            if (!m) continue;
            if (String(m.uid) === key) return m;
            if (m._authId && String(m._authId) === key) return m;
            if (m._serverMobId && String(m._serverMobId) === key) return m;
        }
        if (key.indexOf('f:') === 0) {
            var si = parseInt(key.slice(2), 10);
            if (si >= 0 && si < mapState.mobs.length) return mapState.mobs[si] || null;
        }
        if (key.indexOf('s:') === 0) {
            var parts = key.split(':');
            var slot = parseInt(parts[parts.length - 1], 10);
            if (slot >= 0 && slot < mapState.mobs.length) return mapState.mobs[slot] || null;
        }
        return null;
    }

    function rtWorldFindMobIdx(uid) {
        if (!uid || typeof mapState === 'undefined' || !mapState || !Array.isArray(mapState.mobs)) return -1;
        var key = String(uid);
        for (var i = 0; i < mapState.mobs.length; i++) {
            var m = mapState.mobs[i];
            if (!m) continue;
            if (String(m.uid) === key) return i;
            if (m._authId && String(m._authId) === key) return i;
            if (m._serverMobId && String(m._serverMobId) === key) return i;
        }
        if (key.indexOf('f:') === 0) {
            var si = parseInt(key.slice(2), 10);
            if (si >= 0 && si < mapState.mobs.length && mapState.mobs[si]) return si;
        }
        if (key.indexOf('s:') === 0) {
            var parts = key.split(':');
            var slot = parseInt(parts[parts.length - 1], 10);
            if (slot >= 0 && slot < mapState.mobs.length && mapState.mobs[slot]) return slot;
        }
        return -1;
    }

    /** P1：優先 server sid */
    function rtWorldMobAuthId(mob) {
        if (!mob) return '';
        if (mob._serverMobId) return String(mob._serverMobId);
        if (mob._authId) return String(mob._authId);
        try {
            var mapId = (typeof mapState !== 'undefined' && mapState) ? String(mapState.current || '') : '';
            var idx = -1;
            if (typeof mapState !== 'undefined' && mapState && Array.isArray(mapState.mobs)) {
                idx = mapState.mobs.indexOf(mob);
                if (idx < 0) {
                    for (var i = 0; i < mapState.mobs.length; i++) {
                        if (mapState.mobs[i] && mapState.mobs[i].uid === mob.uid) { idx = i; break; }
                    }
                }
            }
            if (mapId && idx >= 0) {
                mob._serverMobId = 's:' + mapId + ':' + idx;
                mob._authId = mob._serverMobId;
                return mob._serverMobId;
            }
            if (typeof exploreFieldCombatActive === 'function' && exploreFieldCombatActive() && idx >= 0) {
                mob._authId = 'f:' + idx;
                return mob._authId;
            }
        } catch (e) {}
        return String(mob.uid || '');
    }

    function rtWorldDefByName(n) {
        if (!n || typeof DB === 'undefined' || !DB.mobs) return null;
        for (var k in DB.mobs) {
            if (DB.mobs[k] && DB.mobs[k].n === n) return k;
        }
        return null;
    }

    function rtWorldSpawnFromSnap(slot, row) {
        if (!row || !row.n || typeof mapState === 'undefined' || !mapState) return null;
        var defId = rtWorldDefByName(row.n);
        var base = defId && DB.mobs[defId] ? DB.mobs[defId] : null;
        if (!base) {
            // 最低限度 stub（木頭人等）
            base = { n: row.n, hp: row.mhp || 1, lv: 1, s: 'S', beh: '被動', race: '訓練', e: 'none', ac: 10, mr: 0, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [0, 0], db: 0, hit: 0, noAttack: true, noGold: true };
        }
        var uidFn = (typeof uid === 'function') ? uid : function () { return 'm' + Date.now(); };
        var mob = Object.assign({}, base, {
            curHp: Math.max(0, Math.floor(Number(row.hp) || 0)),
            hp: Math.max(1, Math.floor(Number(row.mhp) || base.hp || 1)),
            uid: uidFn(),
            _serverMobId: String(row.sid || ''),
            _authId: String(row.sid || ('f:' + slot)),
            _sharedSnap: true,
            _magCd: {},
            justHit: false,
            st: (typeof newMobStatus === 'function') ? newMobStatus() : {},
            _born: (typeof _mobBornSeq !== 'undefined') ? (++_mobBornSeq) : 0
        });
        if (row.x != null) mob._fx = Number(row.x) || 0;
        if (row.y != null) mob._fy = Number(row.y) || 0;
        if (mob.n === '木頭人') mob.trainingDummy = true;
        return mob;
    }

    /** P1：套用伺服器 mobs snap */
    function rtWorldApplyMobsSnap(data) {
        if (!data || !data.mapId || typeof mapState === 'undefined' || !mapState) return;
        if (data.mapId !== mapState.current) return;
        // 🪵 修練場個人區：忽略伺服器共用怪
        if (data.mapId === 'training') return;
        var rev = Math.floor(Number(data.rev) || 0);
        if (rev && rev < _mobsRev) return;
        _mobsRev = rev || _mobsRev;
        if (!Array.isArray(mapState.mobs)) mapState.mobs = [];
        var list = data.mobs || [];
        var seen = {};
        var needRender = false;
        for (var i = 0; i < list.length; i++) {
            var row = list[i];
            if (!row) continue;
            var slot = Math.max(0, Math.floor(Number(row.slot) || 0));
            seen[slot] = 1;
            while (mapState.mobs.length <= slot) mapState.mobs.push(null);
            var cur = mapState.mobs[slot];
            var sid = String(row.sid || '');
            var hp = Math.max(0, Math.floor(Number(row.hp) || 0));
            var mhp = Math.max(1, Math.floor(Number(row.mhp) || 1));
            var dead = !!(row.dead || hp <= 0);
            if (dead) {
                if (cur && cur._awaitAuthKill && !cur._authKillOk) {
                    // P2：等 kill 授權，勿被 snap 提前清掉
                    cur.curHp = 0;
                    continue;
                }
                if (cur && !cur._dead) {
                    // 遠端／伺服器死亡：靜默清（自己擊殺仍走 killMob）
                    if (!cur._localKillPending) {
                        cur._dead = true;
                        cur.curHp = 0;
                        mapState.mobs[slot] = null;
                        needRender = true;
                    }
                } else if (cur) {
                    mapState.mobs[slot] = null;
                    needRender = true;
                }
                continue;
            }
            if (!cur || cur._dead || (cur.n && row.n && cur.n !== row.n)) {
                var spawned = rtWorldSpawnFromSnap(slot, row);
                if (spawned) {
                    mapState.mobs[slot] = spawned;
                    needRender = true;
                    try {
                        if (typeof exploreAssignFieldPos === 'function' && typeof exploreFieldCombatActive === 'function' && exploreFieldCombatActive()) {
                            exploreAssignFieldPos(spawned, slot);
                        }
                    } catch (ePos) {}
                }
                continue;
            }
            cur._serverMobId = sid || cur._serverMobId;
            cur._authId = sid || cur._authId;
            cur.hp = mhp;
            if (hp < (cur.curHp || 0)) {
                cur.curHp = hp;
                cur.justHit = true;
                needRender = true;
            } else if (hp > (cur.curHp || 0) && (cur.curHp || 0) <= 0) {
                cur.curHp = hp;
                cur._dead = false;
                needRender = true;
            } else {
                cur.curHp = hp;
            }
            if (row.x != null && cur._fx == null) cur._fx = Number(row.x) || 0;
            if (row.y != null && cur._fy == null) cur._fy = Number(row.y) || 0;
        }
        if (needRender) {
            try {
                if (!state || !state.ff) {
                    if (typeof renderMobs === 'function') renderMobs();
                }
            } catch (eR) {}
        }
    }

    /** 把本地怪編成花名冊送給伺服器（空房種子） */
    function rtWorldPushRoster() {
        if (!_connected || !rtWorldOnline()) return false;
        var mapId = '';
        try { mapId = mapState.current || ''; } catch (e) { return false; }
        if (!rtWorldAuthMapOk(mapId)) return false;
        if (typeof exploreFieldCombatActive !== 'function' || !exploreFieldCombatActive()) return false;
        if (!mapState || !Array.isArray(mapState.mobs)) return false;
        var slots = [];
        for (var i = 0; i < mapState.mobs.length && i < 40; i++) {
            var m = mapState.mobs[i];
            if (!m || m._dead || !(m.curHp > 0)) continue;
            slots.push({
                slot: i,
                n: String(m.n || '').slice(0, 40),
                mhp: Math.max(1, Math.floor(Number(m.hp) || 1)),
                hp: Math.max(0, Math.floor(Number(m.curHp) || 0)),
                lv: Math.max(1, Math.floor(Number(m.lv) || 1)),
                ac: Math.floor(Number(m.ac != null ? m.ac : 10)),
                dr: Math.max(0, Math.floor(Number(m.dr) || 0)),
                hardSkin: Math.max(0, Math.floor(Number(m.hardSkin) || 0)),
                er: Math.max(0, Math.floor(Number(m.er) || 0)),
                x: Math.round(Number(m._fx) || 0),
                y: Math.round(Number(m._fy) || 0)
            });
        }
        if (!slots.length) return false;
        return rtWorldSend({ t: 'mob_roster', mapId: mapId, slots: slots });
    }

    function rtWorldClearMobSilent(uid) {
        var idx = rtWorldFindMobIdx(uid);
        if (idx < 0) return;
        var mob = mapState.mobs[idx];
        if (!mob || mob._dead) return;
        mob._dead = true;
        mob.curHp = 0;
        try { if (typeof vfxKill === 'function') vfxKill(mob); } catch (e) {}
        mapState.mobs[idx] = null;
        try {
            if (mapState.spawnAt && mapState.spawnAt.length > idx) {
                var delay = 80 + (idx % 7) * 10;
                mapState.spawnAt[idx] = (typeof state !== 'undefined' && state && state.ticks != null)
                    ? (state.ticks + delay)
                    : delay;
            }
        } catch (e2) {}
        try {
            if (typeof mapState.targetIdx === 'number' && mapState.targetIdx === idx) mapState.targetIdx = -1;
        } catch (e3) {}
    }

    function rtWorldApplyHitFx(data, isSelf) {
        if (!data || !(data.uid || data.sid)) return;
        try {
            if (data.mapId && typeof mapState !== 'undefined' && mapState && data.mapId !== mapState.current) return;
        } catch (e) {}
        var key = data.sid || data.uid;
        var mob = rtWorldFindMob(key);
        if (!mob && data.slot != null) {
            var si = Math.floor(Number(data.slot));
            if (si >= 0 && mapState.mobs && mapState.mobs[si]) mob = mapState.mobs[si];
        }
        if (!mob) return;
        if (data.sid) {
            mob._serverMobId = String(data.sid);
            mob._authId = String(data.sid);
        }
        var srvHp = Math.max(0, Math.floor(Number(data.hp) || 0));
        var dmg = Math.max(0, Math.floor(Number(data.dmg) || 0));
        if (!isSelf) {
            if (srvHp < (mob.curHp || 0)) mob.curHp = srvHp;
            else if (data.dead) mob.curHp = 0;
            if (dmg > 0) {
                mob.justHit = true;
                try { if (typeof mobWake === 'function') mobWake(mob); } catch (eW) {}
                try {
                    if (data.byName && typeof logCombat === 'function') {
                        logCombat('<span class="text-sky-300">' + String(data.byName).replace(/[<>]/g, '') + '</span> 命中 <span class="' + (typeof getMobColor === 'function' ? getMobColor(mob.lv) : '') + '">' + (mob.n || '') + '</span>，造成 ' + dmg + ' 點傷害。', 'party');
                    }
                } catch (eL) {}
            }
            // P2：遠端致死不給獎；等 kill 封包（或僅清畫面）
            if (data.dead || srvHp <= 0) {
                mob._awaitAuthKill = true;
                mob.curHp = 0;
            }
        } else {
            // P3：伺服器為準——樂觀本地傷害偏高／未命中時校正回來
            if (srvHp !== (mob.curHp || 0)) mob.curHp = srvHp;
            if (data.dead || srvHp <= 0) {
                mob.curHp = 0;
                mob._awaitAuthKill = true;
                // 等 t:kill 授權再 killMob／經驗
            }
        }
        try {
            if (!state || !state.ff) {
                if (typeof renderMobs === 'function') renderMobs();
            }
        } catch (eR) {}
    }

    /** P2：伺服器擊殺授權 */
    function rtWorldApplyKill(data) {
        if (!data || !(data.sid || data.uid)) return;
        try {
            if (data.mapId && typeof mapState !== 'undefined' && mapState && data.mapId !== mapState.current) return;
        } catch (e) {}
        var key = data.sid || data.uid;
        var idx = rtWorldFindMobIdx(key);
        if (idx < 0 && data.slot != null) {
            var si = Math.floor(Number(data.slot));
            if (si >= 0 && mapState.mobs && mapState.mobs[si]) idx = si;
        }
        var mob = (idx >= 0 && mapState.mobs) ? mapState.mobs[idx] : null;
        var myKey = _myKey || '';
        var lootKey = String(data.lootKey || '');
        var expKeys = Array.isArray(data.expKeys) ? data.expKeys : [];
        var isLoot = !!(myKey && lootKey && myKey === lootKey);
        var isExp = !!(myKey && expKeys.indexOf(myKey) >= 0);
        // 🩹 v3.9.32：hello key 尚未對齊／lootKey 空時，本地已 await 的擊殺仍要入帳
        if (!isLoot && mob && mob._awaitAuthKill && !mob._dead) {
            if ((myKey && data.by && data.by === myKey) || mob._localKillPending) isLoot = true;
        }
        if (!isExp && myKey && data.by && data.by === myKey) isExp = true;

        if (isLoot) {
            if (mob && mob._dead) return; // fallback 已結算
            if (!mob) {
                // 本地已被清：用名稱補刷一隻再結算（極少見）
                try {
                    if (typeof rtWorldSpawnFromSnap === 'function' && data.n) {
                        mob = rtWorldSpawnFromSnap(Math.max(0, idx), {
                            sid: key, slot: Math.max(0, idx), n: data.n, hp: 0, mhp: 1, dead: true
                        });
                        if (mob && idx >= 0) mapState.mobs[idx] = mob;
                    }
                } catch (eSp) {}
            }
            if (mob && idx >= 0) {
                try {
                    if (mob._authFbTimer) { clearTimeout(mob._authFbTimer); mob._authFbTimer = null; }
                } catch (eClr) {}
                mob._authKillOk = true;
                mob._awaitAuthKill = false;
                mob._dead = false;
                mob.curHp = 0;
                try { if (typeof killMob === 'function') killMob(idx); } catch (eK) {}
            }
            return;
        }

        // 參與者：只拿經驗
        if (isExp) {
            try {
                if (typeof grantAuthKillExp === 'function') {
                    grantAuthKillExp(mob || data.n || '');
                }
            } catch (eE) {}
        }

        // 非掉落者：靜默清怪
        if (mob) {
            try {
                if (mob._authFbTimer) { clearTimeout(mob._authFbTimer); mob._authFbTimer = null; }
            } catch (eClr2) {}
            rtWorldClearMobSilent(key);
        } else if (idx >= 0 && mapState.mobs) mapState.mobs[idx] = null;

        try {
            if (data.byName && typeof logCombat === 'function' && !isExp) {
                logCombat('<span class="text-slate-400">' + String(data.byName).replace(/[<>]/g, '') + ' 擊敗了 ' + String(data.n || '敵人').replace(/[<>]/g, '') + '。</span>', 'party');
            }
        } catch (eL2) {}
        try {
            if (!state || !state.ff) {
                if (typeof renderMobs === 'function') renderMobs();
            }
        } catch (eR2) {}
    }

    /** 🩹 權威擊殺失敗／拒收時，立刻結算本地已打死仍在等授權的怪 */
    function rtWorldFlushAuthKillFallback() {
        try {
            if (typeof mapState === 'undefined' || !mapState || !Array.isArray(mapState.mobs)) return;
            for (var i = 0; i < mapState.mobs.length; i++) {
                var m = mapState.mobs[i];
                if (!m || m._dead || m._authKillOk) continue;
                if (!(m._awaitAuthKill || m._localKillPending) || !(m.curHp <= 0)) continue;
                try {
                    if (m._authFbTimer) { clearTimeout(m._authFbTimer); m._authFbTimer = null; }
                } catch (eC) {}
                m._authKillOk = true;
                m._authFallback = true;
                try { if (typeof killMob === 'function') killMob(i); } catch (eK) {}
            }
        } catch (e) {}
    }

    function rtWorldIdentityBody() {
        var body = {};
        try {
            if (typeof rtPartyIdentity === 'function') {
                var id = rtPartyIdentity();
                if (id) {
                    body.account = id.account;
                    body.slot = id.slot;
                    body.name = id.name;
                    body.sessionId = id.sessionId || '';
                }
            }
        } catch (e) {}
        try {
            if (typeof player !== 'undefined' && player) {
                body.lv = player.lv || 1;
                body.cls = player.cls || '';
                body.hp = player.hp || 0;
                body.mhp = player.mhp || 1;
                body.classic = player.classicMode !== false;
                if (!body.name && player.name) body.name = player.name;
            }
        } catch (e2) {}
        try {
            if (typeof mapState !== 'undefined' && mapState) {
                body.mapId = mapState.current || '';
                if (typeof mapDisplayName === 'function') body.mapName = mapDisplayName(mapState.current) || '';
            }
        } catch (e3) {}
        try {
            // 🩹 v3.9.45：廣播人物世界座標（非相機），同圖才能正確對位
            if (typeof explorePlayerX === 'function') body.wx = Math.round(Number(explorePlayerX()) || 0);
            else if (typeof exploreCamX === 'function') body.wx = Math.round(Number(exploreCamX()) || 0);
            if (typeof explorePlayerY === 'function') body.wy = Math.round(Number(explorePlayerY()) || 0);
            else if (typeof exploreCamY === 'function') body.wy = Math.round(Number(exploreCamY()) || 0);
        } catch (e4) {}
        try {
            if (typeof fieldPvpIsOn === 'function') body.pvpOn = !!fieldPvpIsOn();
            else if (typeof player !== 'undefined' && player) body.pvpOn = !!player.pvpOn;
        } catch (e5) {}
        try {
            body.combat = rtWorldBuildCombatSnap();
        } catch (e6) {}
        body.channel = _channel || 1;
        return body;
    }

    function rtWorldBuildCombatSnap() {
        var snap = {
            lv: 1,
            diceMax: 2,
            hitBonus: 0,
            dmgBonus: 0,
            extraDmg: 0,
            critRate: 0,
            critDmg: 100,
            ranged: false,
            magicDice: 8,
            magicDmg: 0,
            magicCrit: 0,
            magicCritDmg: 100,
            aspdMs: 400
        };
        if (typeof player === 'undefined' || !player) return snap;
        snap.lv = Math.max(1, Math.floor(Number(player.lv) || 1));
        var d = player.d || {};
        var wpn = null;
        try {
            if (player.eq && player.eq.wpn && typeof DB !== 'undefined' && DB.items) {
                wpn = DB.items[player.eq.wpn.id] || null;
            }
        } catch (eW) {}
        var ranged = !!(wpn && wpn.ranged);
        snap.ranged = ranged;
        var isLarge = false;
        try {
            var tgt = (typeof getTarget === 'function') ? getTarget() : null;
            if (tgt && tgt.s === 'L') isLarge = true;
        } catch (eT) {}
        var dice = 2;
        if (wpn) dice = isLarge ? (wpn.dmgL || wpn.dmgS || 2) : (wpn.dmgS || 2);
        snap.diceMax = Math.max(1, Math.floor(Number(dice) || 2));
        snap.hitBonus = Math.floor(Number(ranged ? d.rangedHit : d.meleeHit) || 0) + Math.floor(Number(d.extraHit) || 0);
        snap.dmgBonus = Math.floor(Number(ranged ? d.rangedDmg : d.meleeDmg) || 0);
        snap.extraDmg = Math.max(0, Math.floor(Number(d.extraDmg) || 0));
        snap.critRate = Math.max(0, Math.floor(Number(ranged ? d.rangedCrit : d.meleeCrit) || 0));
        snap.critDmg = Math.max(0, Math.floor(Number(ranged ? d.rangedCritDmg : d.meleeCritDmg) || 100));
        snap.magicDice = Math.max(1, Math.floor(Number(d.magicDice || d.spDice || 8) || 8));
        snap.magicDmg = Math.floor(Number(d.magicDmg || d.spDmg || d.int || 0) || 0);
        snap.magicCrit = Math.max(0, Math.floor(Number(d.magicCrit) || 0));
        snap.magicCritDmg = Math.max(0, Math.floor(Number(d.magicCritDmg) || 100));
        var aspd = Number(d.aspd);
        if (!(aspd > 0)) aspd = 0.4;
        snap.aspdMs = Math.max(80, Math.min(5000, Math.round(aspd * 1000)));
        return snap;
    }

    function rtWorldSend(obj) {
        if (!_ws || _ws.readyState !== 1) return false;
        try {
            _ws.send(JSON.stringify(obj));
            return true;
        } catch (e) { return false; }
    }

    function rtWorldApplyMap(data) {
        if (!data || !data.mapId) return;
        // 🩹 v3.9.45：忽略非當前地圖快照，避免進出圖清空／蓋掉同圖名單
        try {
            var cur = (typeof mapState !== 'undefined' && mapState) ? String(mapState.current || '') : '';
            if (cur && String(data.mapId) !== cur) return;
        } catch (eCur) {}
        if (data.channel != null) {
            _channel = Math.max(1, Math.min(8, Math.floor(Number(data.channel) || 1)));
            try { window.__rtWorldChannel = _channel; } catch (eCh) {}
        }
        // 🪵 修練場個人區：強制不顯示其他玩家
        if (data.mapId === 'training') {
            data = { mapId: data.mapId, channel: 1, players: [], host: '', at: data.at };
        }
        try {
            if (typeof mapPopApplyWsSnap === 'function') {
                mapPopApplyWsSnap(data.mapId, data.players || [], data.at, data.channel);
            } else if (typeof mapPopApply === 'function') {
                var o = {};
                o[data.mapId] = 1 + ((data.players && data.players.length) || 0);
                mapPopApply({ counts: o, players: data.players || [], at: data.at });
            }
        } catch (e) {}
        try {
            if (data.host && typeof mapMobSetHostKey === 'function') mapMobSetHostKey(data.host);
        } catch (e2) {}
        try {
            if (typeof mapPopUpdateIndicator === 'function') mapPopUpdateIndicator();
        } catch (e3) {}
    }

    /** 🌐 P4：進出圖閘門（伺服器分配頻道） */
    function rtWorldEnter(mapId, preferChannel) {
        if (!rtWorldOnline() || !_connected) return false;
        var id = String(mapId || '');
        try { if (!id && mapState) id = mapState.current || ''; } catch (e) {}
        if (!id) return false;
        var body = rtWorldIdentityBody();
        if (!body.account) return false;
        body.t = 'enter';
        body.mapId = id;
        if (preferChannel) body.channel = preferChannel;
        else delete body.channel; // 讓伺服器自動選
        _pendingEnter = id;
        return rtWorldSend(body);
    }

    function rtWorldApplyEnterOk(data) {
        if (!data || !data.mapId) return;
        _channel = Math.max(1, Math.min(8, Math.floor(Number(data.channel) || 1)));
        try { window.__rtWorldChannel = _channel; } catch (e) {}
        _pendingEnter = null;
        // 進圖當下立刻套用「已在此地圖的玩家」名單（enter_ok.players）
        rtWorldApplyMap(data);
        try {
            var n = Array.isArray(data.players) ? data.players.length : 0;
            if (typeof logSys === 'function') {
                if (n > 0) {
                    var names = data.players.slice(0, 6).map(function (p) {
                        return (p && p.name) ? String(p.name) : '冒險者';
                    }).join('、');
                    var more = n > 6 ? ' 等' : '';
                    logSys('<span class="text-sky-300">【同圖】此地圖已有 ' + n + ' 位冒險者：' + names + more + '。他們會出現在戰場上。</span>');
                } else if (String(data.mapId).indexOf('town_') !== 0 && data.mapId !== 'training') {
                    logSys('<span class="text-slate-400">【同圖】目前僅你一人在此頻道。</span>');
                }
            }
        } catch (eLog) {}
        // 立刻重繪遠端 sprite（不必等動畫 interval）
        try {
            if (typeof _remotePartySpritesApply === 'function') _remotePartySpritesApply();
            else if (typeof window._remotePartySpritesApply === 'function') window._remotePartySpritesApply();
        } catch (eSpr) {}
        if (data.full) {
            try {
                if (typeof logSys === 'function') {
                    logSys('<span class="text-amber-300">【頻道】各頻接近滿員，已分配至第 ' + _channel + ' 頻道。</span>');
                }
            } catch (e2) {}
        } else {
            try {
                if (typeof logSys === 'function' && _channel > 1) {
                    logSys('<span class="text-sky-300">【頻道】目前第 ' + _channel + ' 頻道。</span>');
                }
            } catch (e3) {}
        }
        try { if (typeof mapPopUpdateIndicator === 'function') mapPopUpdateIndicator(); } catch (e4) {}
        // 進圖後再推一次座標，讓原住民立刻對上你的位置
        try { setTimeout(function () { rtWorldPushMove(true); }, 80); } catch (eMv) {}
    }

    function rtWorldApplyEnterRej(data) {
        _pendingEnter = null;
        var err = data && data.error ? String(data.error) : 'unknown';
        try {
            if (typeof logSys === 'function') {
                if (err === 'cooldown') logSys('<span class="text-slate-400">進出圖冷卻中，請稍候。</span>');
                else if (err === 'bad_map') logSys('<span class="text-red-400">無法進入該地圖。</span>');
                else logSys('<span class="text-red-400">進出圖被拒（' + err + '）。</span>');
            }
        } catch (e) {}
    }

    function rtWorldChannel() { return _channel || 1; }

    function rtWorldSwitchChannel(ch) {
        var n = Math.max(1, Math.min(8, Math.floor(Number(ch) || 1)));
        var mapId = '';
        try { mapId = mapState.current || ''; } catch (e) {}
        if (!mapId) return false;
        return rtWorldEnter(mapId, n);
    }

    function rtWorldHello() {
        if (!rtWorldInGame()) return;
        var body = rtWorldIdentityBody();
        if (!body.account) return;
        body.t = 'hello';
        rtWorldSend(body);
        _lastMap = String(body.mapId || '');
        _lastWx = body.wx;
        _lastWy = body.wy;
        // P1：進圖後稍後推花名冊（等本地刷怪完成）
        setTimeout(function () {
            try { rtWorldPushRoster(); } catch (eR) {}
        }, 400);
    }

    /** 場戰移動時呼叫：高頻推座標 */
    function rtWorldPushMove(force) {
        if (!rtWorldOnline() || !_connected || !rtWorldInGame()) return;
        var body = rtWorldIdentityBody();
        if (!body.account) return;
        var mapId = String(body.mapId || '');
        if (!mapId || mapId.indexOf('town_') === 0) return;
        var now = Date.now();
        if (!force && now - _lastMoveSent < MOVE_SEND_MS) return;
        var wx = Math.round(Number(body.wx) || 0);
        var wy = Math.round(Number(body.wy) || 0);
        if (!force && mapId === _lastMap && wx === _lastWx && wy === _lastWy) return;
        _lastMoveSent = now;
        _lastMap = mapId;
        _lastWx = wx;
        _lastWy = wy;
        body.t = 'move';
        body.wx = wx;
        body.wy = wy;
        rtWorldSend(body);
    }

    function rtWorldConnect() {
        if (!rtWorldOnline() || !_want) return;
        if (_ws && (_ws.readyState === 0 || _ws.readyState === 1)) return;
        var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        var url = proto + '//' + location.host + WS_PATH;
        try {
            _ws = new WebSocket(url);
        } catch (e) {
            scheduleRetry();
            return;
        }
        _ws.onopen = function () {
            _connected = true;
            _myKey = '';
            rtWorldHello();
            // P4：連上後立刻 enter 當前圖以拿頻道
            try {
                if (typeof mapState !== 'undefined' && mapState && mapState.current) {
                    rtWorldEnter(mapState.current);
                }
            } catch (eEnt0) {}
            if (_helloTimer) clearInterval(_helloTimer);
            _helloTimer = setInterval(function () {
                if (_connected && rtWorldInGame()) rtWorldHello();
            }, HELLO_MS);
        };
        _ws.onmessage = function (ev) {
            var data;
            try { data = JSON.parse(ev.data); } catch (e) { return; }
            if (!data || !data.t) return;
            if (data.t === 'map') rtWorldApplyMap(data);
            else if (data.t === 'mobs') rtWorldApplyMobsSnap(data);
            else if (data.t === 'enter_ok') rtWorldApplyEnterOk(data);
            else if (data.t === 'enter_rej') rtWorldApplyEnterRej(data);
            else if (data.t === 'hello_ok') {
                _myKey = data.key || _myKey;
                if (data.channel != null) {
                    _channel = Math.max(1, Math.min(8, Math.floor(Number(data.channel) || 1)));
                    try { window.__rtWorldChannel = _channel; } catch (eH) {}
                }
            }
            else if (data.t === 'pong') { /* ok */ }
            else if (data.t === 'hit_ok') rtWorldApplyHitFx(data, true);
            else if (data.t === 'hit_fx') {
                if (_myKey && data.by && data.by === _myKey) return;
                rtWorldApplyHitFx(data, false);
            }
            else if (data.t === 'kill') rtWorldApplyKill(data);
            else if (data.t === 'hit_rej') rtWorldFlushAuthKillFallback();
            else if (data.t === 'mob_hp') {
                var m = rtWorldFindMob(data.sid || data.uid);
                if (m && data.hp != null) {
                    var hp = Math.max(0, Math.floor(Number(data.hp) || 0));
                    if (hp < (m.curHp || 0)) m.curHp = hp;
                    if (data.dead || hp <= 0) rtWorldClearMobSilent(data.sid || data.uid);
                }
            }
        };
        _ws.onclose = function () {
            _connected = false;
            if (_helloTimer) { clearInterval(_helloTimer); _helloTimer = null; }
            scheduleRetry();
        };
        _ws.onerror = function () {
            try { _ws.close(); } catch (e) {}
        };
    }

    function scheduleRetry() {
        if (!_want || !rtWorldOnline()) return;
        if (_retryTimer) return;
        _retryTimer = setTimeout(function () {
            _retryTimer = null;
            rtWorldConnect();
        }, RECONNECT_MS);
    }

    function rtWorldStart() {
        _want = true;
        rtWorldConnect();
    }

    function rtWorldStop() {
        _want = false;
        _connected = false;
        if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
        if (_helloTimer) { clearInterval(_helloTimer); _helloTimer = null; }
        try { if (_ws) _ws.close(); } catch (e) {}
        _ws = null;
    }

    function rtWorldIsConnected() { return !!_connected; }

    /** 場戰命中上報：伺服器依戰鬥快照擲骰扣血（P3 不信客戶端 dmg） */
    function rtWorldHit(mob, dmg, hpBefore, kind) {
        if (!rtWorldAuthCombatActive() || !mob) return false;
        var authId = rtWorldMobAuthId(mob);
        if (!authId) return false;
        var mapId = '';
        try { mapId = mapState.current || ''; } catch (e) {}
        if (!rtWorldAuthMapOk(mapId)) return false;
        var k = (String(kind || 'phys') === 'magic') ? 'magic' : 'phys';
        var before = hpBefore != null ? Math.floor(Number(hpBefore)) : Math.floor(Number(mob.curHp) || 0);
        // 附帶 mob 防禦（舊 auth 路徑／房未種子時備援）
        return rtWorldSend({
            t: 'hit',
            mapId: mapId,
            sid: authId,
            uid: authId,
            kind: k,
            mhp: Math.max(1, Math.floor(Number(mob.hp) || 1)),
            n: String(mob.n || '').slice(0, 40),
            hpBefore: before,
            mobLv: Math.max(1, Math.floor(Number(mob.lv) || 1)),
            mobAc: Math.floor(Number(mob.ac != null ? mob.ac : 10)),
            mobDr: Math.max(0, Math.floor(Number(mob.dr) || 0)),
            mobHardSkin: Math.max(0, Math.floor(Number(mob.hardSkin) || 0)),
            mobEr: Math.max(0, Math.floor(Number(mob.er) || 0))
        });
    }

    /** 怪出生時註冊伺服器血量 */
    function rtWorldSeedMob(mob) {
        if (!rtWorldAuthCombatActive() || !mob) return false;
        var authId = rtWorldMobAuthId(mob);
        if (!authId) return false;
        var mapId = '';
        try { mapId = mapState.current || ''; } catch (e) {}
        if (!rtWorldAuthMapOk(mapId)) return false;
        return rtWorldSend({
            t: 'mob_seed',
            mapId: mapId,
            sid: authId,
            uid: authId,
            hp: Math.max(0, Math.floor(Number(mob.curHp) || 0)),
            mhp: Math.max(1, Math.floor(Number(mob.hp) || 1)),
            n: String(mob.n || '').slice(0, 40)
        });
    }

    window.rtWorldStart = rtWorldStart;
    window.rtWorldStop = rtWorldStop;
    window.rtWorldPushMove = rtWorldPushMove;
    window.rtWorldHello = rtWorldHello;
    window.rtWorldIsConnected = rtWorldIsConnected;
    window.rtWorldHit = rtWorldHit;
    window.rtWorldSeedMob = rtWorldSeedMob;
    window.rtWorldPushRoster = rtWorldPushRoster;
    window.rtWorldAuthCombatActive = rtWorldAuthCombatActive;
    window.rtWorldApplyMobsSnap = rtWorldApplyMobsSnap;
    window.rtWorldEnter = rtWorldEnter;
    window.rtWorldChannel = rtWorldChannel;
    window.rtWorldSwitchChannel = rtWorldSwitchChannel;

    // 進遊戲自動連；visibility 恢復重連
    try {
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && _want) rtWorldConnect();
        });
    } catch (eVis) {}

    // 與組隊啟動掛勾
    var _boot = setInterval(function () {
        try {
            if (rtWorldInGame() && typeof rtPartyIdentity === 'function') {
                var id = rtPartyIdentity();
                if (id && id.account) {
                    clearInterval(_boot);
                    rtWorldStart();
                }
            }
        } catch (e) {}
    }, 1200);
})();

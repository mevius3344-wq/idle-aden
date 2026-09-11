// ===== 🗺️ v3.8.182 世界 8 向平移相機（又一個地下城風）=====
// 角色鎖 #battle-view 正中央；--wx/--wy 驅動背景視差、#mob-list、遠端玩家同步反向平移。
// 本地傭兵／寵物不套世界平移，簇擁於中央主角。左右極限亮傳送門，持續前進碰撞切圖。
(function () {
    'use strict';

    var CAM_MAX = 160;        // 相機世界座標極限（邏輯單位）
    var CAM_STEP = 7.5;       // 每 tick 步幅（約 20fps）
    var PORTAL_AT = 120;      // 達此偏移亮傳送門
    var PORTAL_HOLD_TICKS = 6;// 頂著邊界再按幾 tick 自動進門
    var TICK_MS = 50;
    var PARALLAX_X = 0.14;    // 背景視差倍率
    var PARALLAX_Y = 0.11;

    var _cx = 0;              // 相機 X：往右走 + → 世界 --wx 負向平移
    var _cy = 0;              // 相機 Y：往上走 + → 世界 --wy 正向（視覺上背景／怪往下）
    var _keys = Object.create(null);
    var _moving = false;
    var _faceD = 5;
    var _tickTimer = null;
    var _lastMap = '';
    var _portalBusy = false;
    var _portalHoldL = 0;
    var _portalHoldR = 0;

    var MAP_PORTAL_LINKS = {
        talking_island: { left: 'town_talking', right: 'talking_island_port' },
        talking_island_port: { left: 'talking_island', right: null },
        silver_knight: { left: 'town_silver_knight', right: 'zone_01' },
        zone_01: { left: 'silver_knight', right: 'elf_forest' },
        elf_forest: { left: 'zone_01', right: 'gludio' },
        gludio: { left: 'elf_forest', right: 'windwood' },
        windwood: { left: 'gludio', right: 'desert' },
        desert: { left: 'windwood', right: 'kent' },
        kent: { left: 'desert', right: 'dragon_valley' },
        dragon_valley: { left: 'kent', right: 'fire_dragon' },
        fire_dragon: { left: 'dragon_valley', right: null },
        giran: { left: 'town_giran', right: 'heine' },
        heine: { left: 'giran', right: 'twilight_mt' },
        twilight_mt: { left: 'heine', right: 'mirror_forest' },
        mirror_forest: { left: 'twilight_mt', right: null },
        zone_02: { left: 'town_oren', right: 'zone_03' },
        zone_03: { left: 'zone_02', right: 'zone_04' },
        zone_04: { left: 'zone_03', right: 'zone_05' },
        zone_05: { left: 'zone_04', right: null }
    };

    function exploreBuildDungeonChains() {
        try {
            if (typeof MAP_CATEGORIES === 'undefined' || !MAP_CATEGORIES.dungeon) return;
            var floors = MAP_CATEGORIES.dungeon.filter(function (m) {
                return m && m.v && !m.needKey && !m.keyHoldReq && !m.questReq && !m.affinityReq;
            });
            for (var i = 0; i < floors.length; i++) {
                var cur = floors[i].v;
                var prev = i > 0 ? floors[i - 1].v : null;
                var next = i < floors.length - 1 ? floors[i + 1].v : null;
                function sameChain(a, b) {
                    if (!a || !b) return false;
                    var ma = String(a).match(/^(.*?)(\d+)$/);
                    var mb = String(b).match(/^(.*?)(\d+)$/);
                    if (!ma || !mb || ma[1] !== mb[1]) return false;
                    return Math.abs(Number(ma[2]) - Number(mb[2])) === 1;
                }
                var left = prev && sameChain(cur, prev) ? prev : null;
                var right = next && sameChain(cur, next) ? next : null;
                if (!MAP_PORTAL_LINKS[cur]) MAP_PORTAL_LINKS[cur] = { left: left, right: right };
                else {
                    if (left && !MAP_PORTAL_LINKS[cur].left) MAP_PORTAL_LINKS[cur].left = left;
                    if (right && !MAP_PORTAL_LINKS[cur].right) MAP_PORTAL_LINKS[cur].right = right;
                }
            }
        } catch (e) {}
    }

    function exploreMapTitle(mapId) {
        try {
            if (typeof MAP_CATEGORIES !== 'undefined') {
                for (var cat in MAP_CATEGORIES) {
                    var list = MAP_CATEGORIES[cat] || [];
                    for (var i = 0; i < list.length; i++) {
                        if (list[i] && list[i].v === mapId) return list[i].t || mapId;
                    }
                }
            }
        } catch (e) {}
        return mapId || '';
    }

    function exploreAllowed() {
        try {
            if (typeof mapState === 'undefined' || !mapState || !mapState.current) return false;
            var id = String(mapState.current);
            if (id.indexOf('town_') === 0) return false;
            if (id === 'training' || id === 'arena_pvp' || id === 'rift_battle') return false;
            if (typeof isWorldBossMap === 'function' && isWorldBossMap(id)) return false;
            if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS && KING_ROOMS[id]) return false;
            if (typeof isSiegeArea === 'function' && isSiegeArea(id)) return false;
            var bv = document.getElementById('battle-view');
            if (!bv || bv.classList.contains('hidden') || !bv.classList.contains('area-fit')) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    function exploreWorldActive() { return exploreAllowed(); }
    function exploreIsMoving() { return !!(exploreAllowed() && _moving); }
    function exploreFaceDir() { return _faceD; }
    function exploreCamX() { return _cx; }
    function exploreCamY() { return _cy; }

    function explorePortalsFor(mapId) {
        var row = MAP_PORTAL_LINKS[mapId] || {};
        return { left: row.left || null, right: row.right || null };
    }

    // 螢幕向量 → 8 向（x 右、y 下；與 _vec2dir 一致）
    function exploreVec2Dir(dx, dy) {
        if (typeof _vec2dir === 'function') return _vec2dir(dx, dy);
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return _faceD;
        var deg = Math.atan2(dy, dx) * 180 / Math.PI;
        if (deg >= -22.5 && deg < 22.5) return 3;
        if (deg >= 22.5 && deg < 67.5) return 4;
        if (deg >= 67.5 && deg < 112.5) return 5;
        if (deg >= 112.5 && deg < 157.5) return 6;
        if (deg >= 157.5 || deg < -157.5) return 7;
        if (deg >= -157.5 && deg < -112.5) return 0;
        if (deg >= -112.5 && deg < -67.5) return 1;
        return 2;
    }

    /** 將相機寫入 CSS：--wx/--wy＝世界層反向平移；背景視差微移 */
    function exploreApplyWorld() {
        var bv = document.getElementById('battle-view');
        if (!bv) return;
        var on = exploreAllowed();
        // 視覺詐欺：世界往相機反方向移，角色看起來鎖中央
        var wx = -_cx;
        var wy = _cy;
        bv.style.setProperty('--wx', wx.toFixed(1) + 'px');
        bv.style.setProperty('--wy', wy.toFixed(1) + 'px');
        bv.style.setProperty('--cam-x', _cx.toFixed(1));
        bv.style.setProperty('--cam-y', _cy.toFixed(1));
        var bx = 50 + (_cx * PARALLAX_X);
        var by = 50 - (_cy * PARALLAX_Y);
        if (bv.classList.contains('has-bg')) {
            bv.style.backgroundPosition = bx.toFixed(2) + '% ' + by.toFixed(2) + '%';
        }
        bv.classList.toggle('is-world-scroll', on);
        bv.classList.toggle('is-exploring', on && (Math.abs(_cx) > 1 || Math.abs(_cy) > 1));
        bv.classList.toggle('portal-ready-left', on && _cx <= -PORTAL_AT);
        bv.classList.toggle('portal-ready-right', on && _cx >= PORTAL_AT);
    }

    function exploreReset(reason) {
        _cx = 0;
        _cy = 0;
        _moving = false;
        _portalHoldL = 0;
        _portalHoldR = 0;
        exploreApplyWorld();
        exploreRenderPortals();
        if (reason === 'map' || reason === 'portal') {
            _lastMap = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
        }
    }

    function exploreRenderPortals() {
        var leftBtn = document.getElementById('explore-portal-left');
        var rightBtn = document.getElementById('explore-portal-right');
        var hint = document.getElementById('explore-hint');
        if (!leftBtn || !rightBtn) return;
        if (!exploreAllowed()) {
            leftBtn.classList.add('hidden');
            rightBtn.classList.add('hidden');
            if (hint) hint.classList.add('hidden');
            return;
        }
        var p = explorePortalsFor(mapState.current);
        if (p.left) {
            leftBtn.classList.remove('hidden');
            leftBtn.textContent = '◀ ' + exploreMapTitle(p.left);
            leftBtn.setAttribute('data-to', p.left);
            leftBtn.classList.toggle('is-ready', _cx <= -PORTAL_AT);
        } else leftBtn.classList.add('hidden');
        if (p.right) {
            rightBtn.classList.remove('hidden');
            rightBtn.textContent = exploreMapTitle(p.right) + ' ▶';
            rightBtn.setAttribute('data-to', p.right);
            rightBtn.classList.toggle('is-ready', _cx >= PORTAL_AT);
        } else rightBtn.classList.add('hidden');
        if (hint) {
            hint.classList.remove('hidden');
            hint.textContent = 'WASD／方向鍵 8 向 · 角色鎖中央 · 邊緣傳送門切圖';
        }
    }

    function explorePersistMap(to) {
        try {
            if (typeof saveGame === 'function') saveGame();
        } catch (e0) {}
        try {
            if (typeof cloudMirrorAfterSave === 'function') cloudMirrorAfterSave();
            else if (typeof window.CloudSave === 'object' && window.CloudSave && typeof window.CloudSave.mirror === 'function') {
                window.CloudSave.mirror();
            }
        } catch (e1) {}
    }

    function exploreTryPortal(side, fromHold) {
        if (_portalBusy || !exploreAllowed()) return false;
        var p = explorePortalsFor(mapState.current);
        var to = side === 'left' ? p.left : p.right;
        if (!to) return false;
        // 尚未到門：先把相機吸到門檻（點擊用）
        if (!fromHold) {
            if (side === 'left' && _cx > -PORTAL_AT) {
                _cx = Math.max(-CAM_MAX, _cx - CAM_STEP * 4);
                exploreApplyWorld();
                exploreRenderPortals();
                return true;
            }
            if (side === 'right' && _cx < PORTAL_AT) {
                _cx = Math.min(CAM_MAX, _cx + CAM_STEP * 4);
                exploreApplyWorld();
                exploreRenderPortals();
                return true;
            }
        } else {
            if (side === 'left' && _cx > -PORTAL_AT) return false;
            if (side === 'right' && _cx < PORTAL_AT) return false;
        }
        _portalBusy = true;
        try {
            if (typeof logSys === 'function') {
                logSys('<span class="text-cyan-300 font-bold">【傳送門】</span>前往 <span class="text-amber-200">' + exploreMapTitle(to) + '</span>…');
            }
        } catch (e) {}
        var sel = document.getElementById('map-select');
        if (sel) {
            var found = false;
            Array.prototype.forEach.call(sel.options || [], function (o) {
                if (o && o.value === to) found = true;
            });
            if (!found) {
                var opt = document.createElement('option');
                opt.value = to;
                opt.textContent = exploreMapTitle(to);
                sel.appendChild(opt);
            }
            sel.value = to;
        }
        exploreReset('portal');
        try {
            if (typeof changeMap === 'function') changeMap(true);
        } catch (e2) {}
        // changeMap 內已 save；再補一次雲端鏡像（Neon／帳號雲，離線旗標開啟時會自動跳過）
        setTimeout(function () {
            explorePersistMap(to);
            _portalBusy = false;
        }, 600);
        return true;
    }

    function exploreReadInput() {
        var l = !!( _keys.ArrowLeft || _keys.a || _keys.A );
        var r = !!( _keys.ArrowRight || _keys.d || _keys.D );
        var u = !!( _keys.ArrowUp || _keys.w || _keys.W );
        var d = !!( _keys.ArrowDown || _keys.s || _keys.S );
        var dx = (r ? 1 : 0) - (l ? 1 : 0);
        var dy = (d ? 1 : 0) - (u ? 1 : 0);
        if (dx && dy) {
            var inv = 1 / Math.SQRT2;
            dx *= inv;
            dy *= inv;
        }
        return { dx: dx, dy: dy, left: l, right: r };
    }

    function exploreTick() {
        if (!exploreAllowed()) {
            if (_moving || document.getElementById('battle-view') && document.getElementById('battle-view').classList.contains('is-world-scroll')) {
                _moving = false;
                exploreApplyWorld();
                exploreRenderPortals();
            }
            return;
        }
        var mapId = mapState.current;
        if (mapId !== _lastMap) {
            _lastMap = mapId;
            _cx = 0;
            _cy = 0;
            _portalHoldL = 0;
            _portalHoldR = 0;
        }
        var inp = exploreReadInput();
        if (inp.dx || inp.dy) {
            _cx += inp.dx * CAM_STEP;
            _cy += (-inp.dy) * CAM_STEP;
            if (_cx < -CAM_MAX) _cx = -CAM_MAX;
            if (_cx > CAM_MAX) _cx = CAM_MAX;
            if (_cy < -CAM_MAX) _cy = -CAM_MAX;
            if (_cy > CAM_MAX) _cy = CAM_MAX;
            _moving = true;
            _faceD = exploreVec2Dir(inp.dx, inp.dy);
            try {
                if (typeof player !== 'undefined' && player) player._faceD = _faceD;
            } catch (e) {}
        } else {
            _moving = false;
        }

        // 邊緣碰撞：頂著左右極限持續前進 → 自動進傳送門
        var ports = explorePortalsFor(mapId);
        if (inp.left && ports.left && _cx <= -PORTAL_AT) {
            _portalHoldL += 1;
            if (_portalHoldL >= PORTAL_HOLD_TICKS) {
                _portalHoldL = 0;
                exploreTryPortal('left', true);
            }
        } else _portalHoldL = 0;
        if (inp.right && ports.right && _cx >= PORTAL_AT) {
            _portalHoldR += 1;
            if (_portalHoldR >= PORTAL_HOLD_TICKS) {
                _portalHoldR = 0;
                exploreTryPortal('right', true);
            }
        } else _portalHoldR = 0;

        exploreApplyWorld();
        exploreRenderPortals();
    }

    function exploreEnsureUi() {
        var bv = document.getElementById('battle-view');
        if (!bv || document.getElementById('explore-portal-left')) return;
        var left = document.createElement('button');
        left.type = 'button';
        left.id = 'explore-portal-left';
        left.className = 'explore-portal explore-portal-left hidden';
        left.addEventListener('click', function () { exploreTryPortal('left', false); });
        var right = document.createElement('button');
        right.type = 'button';
        right.id = 'explore-portal-right';
        right.className = 'explore-portal explore-portal-right hidden';
        right.addEventListener('click', function () { exploreTryPortal('right', false); });
        var hint = document.createElement('div');
        hint.id = 'explore-hint';
        hint.className = 'explore-hint hidden';
        bv.appendChild(left);
        bv.appendChild(right);
        bv.appendChild(hint);
    }

    function exploreOnMapChange() {
        exploreEnsureUi();
        exploreReset('map');
        exploreRenderPortals();
    }

    // 探索模式：本地隊伍簇擁中央（供 js/09 讀取）
    function explorePartySpritePos() {
        return {
            P: { x: '50%', b: 10 },
            A: [
                { x: '38%', b: 8 },
                { x: '62%', b: 8 },
                { x: '32%', b: 18 },
                { x: '68%', b: 18 },
                { x: '44%', b: 22 },
                { x: '56%', b: 22 },
                { x: '50%', b: 26 }
            ]
        };
    }

    window.exploreWorldActive = exploreWorldActive;
    window.exploreIsMoving = exploreIsMoving;
    window.exploreFaceDir = exploreFaceDir;
    window.exploreCamX = exploreCamX;
    window.exploreCamY = exploreCamY;
    window.exploreTryPortal = exploreTryPortal;
    window.exploreOnMapChange = exploreOnMapChange;
    window.exploreReset = exploreReset;
    window.explorePartySpritePos = explorePartySpritePos;
    window.MAP_PORTAL_LINKS = MAP_PORTAL_LINKS;

    document.addEventListener('DOMContentLoaded', function () {
        exploreBuildDungeonChains();
        exploreEnsureUi();
        exploreRenderPortals();
        if (!_tickTimer) _tickTimer = setInterval(exploreTick, TICK_MS);
    });
    // 若腳本晚於 DOMContentLoaded 載入
    if (document.readyState !== 'loading') {
        exploreBuildDungeonChains();
        exploreEnsureUi();
        if (!_tickTimer) _tickTimer = setInterval(exploreTick, TICK_MS);
    }

    document.addEventListener('keydown', function (e) {
        if (!exploreAllowed()) return;
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        var k = e.key;
        if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown'
            || k === 'a' || k === 'A' || k === 'd' || k === 'D'
            || k === 'w' || k === 'W' || k === 's' || k === 'S') {
            _keys[k] = 1;
            if (k.indexOf('Arrow') === 0) e.preventDefault();
        }
        if (k === 'Enter') {
            if (_cx <= -PORTAL_AT) exploreTryPortal('left', true);
            else if (_cx >= PORTAL_AT) exploreTryPortal('right', true);
        }
    });
    document.addEventListener('keyup', function (e) {
        delete _keys[e.key];
    });
    window.addEventListener('blur', function () {
        _keys = Object.create(null);
        _moving = false;
    });

    var _hooked = false;
    function exploreHookChangeMap() {
        if (_hooked || typeof changeMap !== 'function') return;
        _hooked = true;
        var orig = changeMap;
        window.changeMap = function () {
            var r = orig.apply(this, arguments);
            try { exploreOnMapChange(); } catch (e) {}
            return r;
        };
    }
    setTimeout(exploreHookChangeMap, 0);
    setTimeout(exploreHookChangeMap, 1500);
})();

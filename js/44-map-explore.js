// ===== 🗺️ 地圖探索 v1：橫向假走＋邊緣傳送門（又一個地下城風起步）=====
// 尚未真座標大世界；在固定戰鬥框內左右移動背景，走到邊緣可進相鄰地圖。
(function () {
    'use strict';

    var EXPLORE_MAX = 42;          // 背景平移極限（%）
    var EXPLORE_STEP = 3.5;        // 每次移動
    var EXPLORE_PORTAL_AT = 34;    // 達此偏離量可觸發傳送門
    var _x = 0;
    var _keys = Object.create(null);
    var _tickTimer = null;
    var _lastMap = '';
    var _portalBusy = false;

    /** 手動精選野外／村莊相鄰；地監樓層由 MAP_CATEGORIES 自動串 */
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
                    if (!ma || !mb) return false;
                    if (ma[1] !== mb[1]) return false;
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
            if (typeof mapCategoryOf === 'function') {
                // fall through
            }
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

    function explorePortalsFor(mapId) {
        var row = MAP_PORTAL_LINKS[mapId] || {};
        return {
            left: row.left || null,
            right: row.right || null
        };
    }

    function exploreApplyBg() {
        var bv = document.getElementById('battle-view');
        if (!bv) return;
        // center + offset：負＝往左看（像往右走）
        var pct = 50 + _x;
        bv.style.backgroundPosition = pct + '% center';
        bv.classList.toggle('is-exploring', exploreAllowed() && Math.abs(_x) > 0.5);
    }

    function exploreReset(reason) {
        _x = 0;
        exploreApplyBg();
        exploreRenderPortals();
        if (reason === 'map') _lastMap = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
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
        var mapId = mapState.current;
        var p = explorePortalsFor(mapId);
        if (p.left) {
            leftBtn.classList.remove('hidden');
            leftBtn.textContent = '◀ ' + exploreMapTitle(p.left);
            leftBtn.setAttribute('data-to', p.left);
            leftBtn.classList.toggle('is-ready', _x <= -EXPLORE_PORTAL_AT);
        } else {
            leftBtn.classList.add('hidden');
        }
        if (p.right) {
            rightBtn.classList.remove('hidden');
            rightBtn.textContent = exploreMapTitle(p.right) + ' ▶';
            rightBtn.setAttribute('data-to', p.right);
            rightBtn.classList.toggle('is-ready', _x >= EXPLORE_PORTAL_AT);
        } else {
            rightBtn.classList.add('hidden');
        }
        if (hint) {
            hint.classList.remove('hidden');
            hint.textContent = 'A/D 或 ←→ 移動 · 走到邊緣可進傳送門';
        }
    }

    function exploreTryPortal(side) {
        if (_portalBusy || !exploreAllowed()) return false;
        var p = explorePortalsFor(mapState.current);
        var to = side === 'left' ? p.left : p.right;
        if (!to) return false;
        if (side === 'left' && _x > -EXPLORE_PORTAL_AT) {
            _x = Math.max(-EXPLORE_MAX, _x - EXPLORE_STEP * 2);
            exploreApplyBg();
            exploreRenderPortals();
            return true;
        }
        if (side === 'right' && _x < EXPLORE_PORTAL_AT) {
            _x = Math.min(EXPLORE_MAX, _x + EXPLORE_STEP * 2);
            exploreApplyBg();
            exploreRenderPortals();
            return true;
        }
        _portalBusy = true;
        try {
            if (typeof logSys === 'function') {
                logSys('<span class="text-cyan-300 font-bold">【傳送門】</span>前往 <span class="text-amber-200">' + exploreMapTitle(to) + '</span>…');
            }
        } catch (e) {}
        var sel = document.getElementById('map-select');
        if (sel) {
            // 確保 option 存在
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
        setTimeout(function () { _portalBusy = false; }, 800);
        return true;
    }

    function exploreMove(dir) {
        if (!exploreAllowed()) return;
        var mapId = mapState.current;
        if (mapId !== _lastMap) {
            _lastMap = mapId;
            _x = 0;
        }
        _x += dir * EXPLORE_STEP;
        if (_x < -EXPLORE_MAX) _x = -EXPLORE_MAX;
        if (_x > EXPLORE_MAX) _x = EXPLORE_MAX;
        exploreApplyBg();
        exploreRenderPortals();
        var p = explorePortalsFor(mapId);
        if (dir < 0 && p.left && _x <= -EXPLORE_PORTAL_AT) {
            // 亮門，需再按一次或點門才傳（避免誤觸）
        }
        if (dir > 0 && p.right && _x >= EXPLORE_PORTAL_AT) {
        }
    }

    function exploreTick() {
        if (!exploreAllowed()) return;
        if (_keys.ArrowLeft || _keys.a || _keys.A) exploreMove(-1);
        if (_keys.ArrowRight || _keys.d || _keys.D) exploreMove(1);
    }

    function exploreEnsureUi() {
        var bv = document.getElementById('battle-view');
        if (!bv || document.getElementById('explore-portal-left')) return;
        var left = document.createElement('button');
        left.type = 'button';
        left.id = 'explore-portal-left';
        left.className = 'explore-portal explore-portal-left hidden';
        left.addEventListener('click', function () { exploreTryPortal('left'); });
        var right = document.createElement('button');
        right.type = 'button';
        right.id = 'explore-portal-right';
        right.className = 'explore-portal explore-portal-right hidden';
        right.addEventListener('click', function () { exploreTryPortal('right'); });
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

    window.exploreMove = exploreMove;
    window.exploreTryPortal = exploreTryPortal;
    window.exploreOnMapChange = exploreOnMapChange;
    window.exploreReset = exploreReset;
    window.MAP_PORTAL_LINKS = MAP_PORTAL_LINKS;

    document.addEventListener('DOMContentLoaded', function () {
        exploreBuildDungeonChains();
        exploreEnsureUi();
        exploreRenderPortals();
        if (!_tickTimer) _tickTimer = setInterval(exploreTick, 80);
    });

    document.addEventListener('keydown', function (e) {
        if (!exploreAllowed()) return;
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            _keys[e.key] = 1;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
        }
        if (e.key === 'Enter') {
            if (_x <= -EXPLORE_PORTAL_AT) exploreTryPortal('left');
            else if (_x >= EXPLORE_PORTAL_AT) exploreTryPortal('right');
        }
    });
    document.addEventListener('keyup', function (e) {
        delete _keys[e.key];
    });

    // 換圖後重設（包一層 changeMap）
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

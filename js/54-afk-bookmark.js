// 📋 掛機報告（本次掛機累計：時間／擊殺／經驗／金幣／死亡／取得物品；換地圖不歸零）
// 🔖 書籤（原版：記錄目前位置，傳送時消耗 1 張瞬間移動卷軸；沒卷軸自動買 1 張）
(function () {
    'use strict';

    var BOOKMARK_MAX = 20;

    function _esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function _num(n) { return Math.floor(Number(n) || 0).toLocaleString(); }
    function _dur(ms) {
        var s = Math.max(0, Math.floor(ms / 1000));
        var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
        return (h ? h + ' 小時 ' : '') + (h || m ? m + ' 分 ' : '') + r + ' 秒';
    }
    function _log(html) { try { if (typeof logSys === 'function') logSys(html); } catch (e) {} }
    function _charKey() {
        try { return player ? String(player.enSeed || player.name || '') : ''; } catch (e) { return ''; }
    }
    function _mapName(id) {
        var n = null;
        try { if (typeof mapDisplayName === 'function') n = mapDisplayName(id); } catch (e) {}
        try { if (!n && DB.towns && DB.towns[id]) n = DB.towns[id].n; } catch (e2) {}
        return n || id;
    }

    // ───────── 掛機報告 ─────────
    var _afk = null;
    function afkReset() {
        _afk = {
            key: _charKey(),
            start: Date.now(),
            huntMs: 0,
            gold0: (typeof player !== 'undefined' && player) ? (player.gold || 0) : 0,
            kills: 0,
            exp: 0,
            deaths: 0,
            items: {}
        };
        afkRender();
    }
    function _afkEnsure() {
        if (!_afk || _afk.key !== _charKey()) afkReset();
        return _afk;
    }
    function _hunting() {
        try {
            if (!player || player.dead || !mapState || !mapState.current) return false;
            if (String(mapState.current).indexOf('town_') === 0) return false;
            return !(state && state.autoHunt === false);
        } catch (e) { return false; }
    }

    function _wrap(name, after) {
        var orig = window[name];
        if (typeof orig !== 'function' || orig.__afkWrapped) return;
        var w = function () {
            var pre = null;
            try { if (after.pre) pre = after.pre.apply(this, arguments); } catch (e0) {}
            try {
                return orig.apply(this, arguments);
            } finally {
                try { after.post.call(this, arguments, pre); } catch (e) {}
            }
        };
        w.__afkWrapped = true;
        window[name] = w;
    }
    _wrap('auditTrackKill', {
        pre: function () { try { return window.auditStats ? window.auditStats().exp : 0; } catch (e) { return 0; } },
        post: function (args, exp0) {
            var a = _afkEnsure();
            a.kills++;
            try { var d = window.auditStats().exp - exp0; if (d > 0) a.exp += d; } catch (e) {}
        }
    });
    // 只算打怪掉落（擊殺／地上撿取），不算商店與自動購買
    var _lootDepth = 0;
    ['killMob', 'commitWorldLootDrop'].forEach(function (fn) {
        _wrap(fn, {
            pre: function () { _lootDepth++; return null; },
            post: function () { _lootDepth = Math.max(0, _lootDepth - 1); }
        });
    });
    _wrap('auditTrackGain', {
        post: function (args) {
            if (!_lootDepth) return;
            var res = args[0];
            if (!res || !res.id || typeof DB === 'undefined' || !DB.items[res.id]) return;
            var a = _afkEnsure();
            a.items[res.id] = (a.items[res.id] || 0) + (Number(res.cnt) || 1);
        }
    });
    _wrap('revive', {
        pre: function () { try { return !!(player && (player.dead || !(player.hp > 0))); } catch (e) { return false; } },
        post: function (args, wasDead) { if (wasDead) _afkEnsure().deaths++; }
    });

    var _lastTick = Date.now();
    setInterval(function () {
        var now = Date.now();
        var dt = Math.min(5000, now - _lastTick);
        _lastTick = now;
        if (typeof player === 'undefined' || !player) return;
        var a = _afkEnsure();
        if (_hunting()) a.huntMs += dt;
        var w = document.getElementById('afk-win');
        if (w && !w.classList.contains('hidden')) afkRender();
    }, 1000);

    // 掛機報告＝唯一的統計畫面（舊「統計」分頁併進來）：報告／本圖掉落 兩頁
    var _afkView = 'report';
    function _afkDropsHtml() {
        var rows = typeof auditMapDropRows === 'function' ? auditMapDropRows() : [];
        if (!rows.length) return '<div class="trade-empty">目前地圖沒有怪物掉落資料</div>';
        return rows.map(function (r) {
            var names = r.drops.map(function (id) { return _esc((DB.items[id] || {}).n || id); }).join('、');
            return '<div class="lin-row afk-drop-row"><span class="afk-drop-mob">' + (r.mob.boss ? '頭目 ' : '') + _esc(r.mob.n) +
                ' <small>Lv.' + _num(r.mob.lv) + '</small></span><span class="afk-drop-items">' + (names || '（無掉落物）') + '</span></div>';
        }).join('');
    }
    function afkRender() {
        var w = document.getElementById('afk-win');
        if (!w || w.classList.contains('hidden') || !_afk) return;
        w.querySelectorAll('[data-view]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-view') === _afkView); });
        var resetBtn = w.querySelector('[data-act="reset"]');
        if (resetBtn) resetBtn.style.visibility = _afkView === 'report' ? '' : 'hidden';
        var body = w.querySelector('.afk-body');
        if (_afkView === 'drops') {
            if (body.getAttribute('data-map') === String(mapState.current)) return;
            body.setAttribute('data-map', String(mapState.current));
            body.innerHTML = '<div class="trade-bag-title">' + _esc(_mapName(mapState.current)) + '：出沒怪物與掉落（不含機率）</div>' +
                '<div class="lin-list">' + _afkDropsHtml() + '</div>';
            return;
        }
        body.removeAttribute('data-map');
        var a = _afk;
        var gold = ((typeof player !== 'undefined' && player) ? (player.gold || 0) : 0) - a.gold0;
        var hrs = Math.max(1 / 60, a.huntMs / 3600000);
        var ids = Object.keys(a.items).sort(function (x, y) { return a.items[y] - a.items[x]; });
        var itemsHtml = ids.length ? ids.map(function (id) {
            var d = DB.items[id] || {};
            return '<div class="lin-row"><span>' + _esc(d.n || id) + '</span><b>× ' + _num(a.items[id]) + '</b></div>';
        }).join('') : '<div class="trade-empty">尚未取得物品</div>';
        body.innerHTML =
            '<div class="lin-stat-grid">' +
            '<div><span>掛機時間</span><b>' + _dur(a.huntMs) + '</b></div>' +
            '<div><span>擊殺／死亡</span><b>' + _num(a.kills) + '／' + _num(a.deaths) + '</b></div>' +
            '<div><span>經驗（每小時）</span><b>' + _num(a.exp) + '<small>（' + _num(a.exp / hrs) + '）</small></b></div>' +
            '<div><span>金幣淨增（每小時）</span><b>' + _num(gold) + '<small>（' + _num(gold / hrs) + '）</small></b></div>' +
            '</div>' +
            '<div class="trade-bag-title">取得物品（' + ids.length + ' 種）</div>' +
            '<div class="lin-list">' + itemsHtml + '</div>';
    }
    function afkReportOpen(view) {
        _afkEnsure();
        _afkView = view === 'drops' ? 'drops' : 'report';
        var w = document.getElementById('afk-win');
        if (!w) {
            w = document.createElement('div');
            w.id = 'afk-win';
            w.className = 'trade-win';
            w.innerHTML = '<div class="trade-box">' +
                '<div class="trade-head">掛機報告</div>' +
                '<div class="afk-tabs">' +
                '<button type="button" data-view="report">報告</button>' +
                '<button type="button" data-view="drops">本圖掉落</button>' +
                '</div>' +
                '<div class="afk-body"></div>' +
                '<div class="trade-actions">' +
                '<button type="button" class="trade-btn" data-act="reset">重新計算</button>' +
                '<button type="button" class="trade-btn trade-btn-main" data-act="close">關閉</button>' +
                '</div></div>';
            w.addEventListener('click', function (ev) {
                var b = ev.target.closest('[data-act],[data-view]');
                if (ev.target === w || (b && b.getAttribute('data-act') === 'close')) { w.classList.add('hidden'); return; }
                if (!b) return;
                if (b.getAttribute('data-act') === 'reset') afkReset();
                else if (b.hasAttribute('data-view')) { _afkView = b.getAttribute('data-view'); afkRender(); }
            });
            document.body.appendChild(w);
        }
        w.querySelector('.afk-body').removeAttribute('data-map');
        w.classList.remove('hidden');
        afkRender();
    }

    // ───────── 書籤 ─────────
    function _bmList() {
        if (!player) return [];
        if (!Array.isArray(player.bookmarks)) player.bookmarks = [];
        return player.bookmarks;
    }
    function _mapDef(id) {
        if (typeof MAP_CATEGORIES === 'undefined') return null;
        for (var c in MAP_CATEGORIES) {
            var e = (MAP_CATEGORIES[c] || []).find(function (m) { return m.v === id; });
            if (e) return e;
        }
        return null;
    }
    /** 可記錄／可傳送的地圖：村莊或一般地圖選單內、不需鑰匙的地圖；攻城、隱藏區、傲慢之塔、軍王之室、單 BOSS 房除外 */
    function _bmMapBlock(id) {
        if (!id) return '這裡無法記錄書籤。';
        if (typeof isSiegeArea === 'function' && isSiegeArea(id)) return '攻城區域無法使用書籤。';
        if (typeof HIDDEN_AREA_NAMES !== 'undefined' && HIDDEN_AREA_NAMES[id]) return '隱藏區域無法使用書籤。';
        if (/^pride_/.test(id)) return '傲慢之塔無法使用書籤。';
        if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[id]) return '軍王之室無法使用書籤。';
        if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.includes(id)) return '頭目巢穴無法使用書籤。';
        if (String(id).indexOf('town_') === 0) return '';
        var def = _mapDef(id);
        if (!def) return '這裡無法記錄書籤。';
        if (def.needKey) return '需要鑰匙的地圖無法使用書籤。';
        return '';
    }
    function _hereBlock() {
        if (!player || player.dead) return '死亡中無法使用書籤。';
        if (state.prideClimb || state.oblivion || state.riftRun || state.antharas) return '目前所在區域無法使用書籤。';
        if (!(typeof window.exploreWorldActive === 'function' && window.exploreWorldActive() && typeof explorePlayerX === 'function')) return '這裡無法使用書籤。';
        return _bmMapBlock(mapState.current);
    }

    function bookmarkAdd() {
        var why = _hereBlock();
        if (why) { _bmToast(why); return false; }
        var list = _bmList();
        if (list.length >= BOOKMARK_MAX) { _bmToast('書籤已滿（最多 ' + BOOKMARK_MAX + ' 個）。'); return false; }
        var def0 = _mapName(mapState.current);
        var nm = (typeof window.prompt === 'function') ? window.prompt('書籤名稱', def0) : def0;
        if (nm == null) return false;
        nm = String(nm).trim().slice(0, 16) || def0;
        list.push({ n: nm, m: mapState.current, x: Math.round(explorePlayerX()), y: Math.round(explorePlayerY()), at: Date.now() });
        try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
        _bmToast('已記錄書籤「' + nm + '」。');
        bookmarkRender();
        return true;
    }
    function bookmarkRemove(idx) {
        var list = _bmList();
        if (!list[idx]) return;
        list.splice(idx, 1);
        try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
        bookmarkRender();
    }
    function bookmarkGo(idx) {
        var bm = _bmList()[idx];
        if (!bm) return false;
        var why = _hereBlock() || _bmMapBlock(bm.m);
        if (why) { _bmToast(why); return false; }
        var st = player.statuses || {};
        if (st.stone > 0 || st.paralyze > 0 || st.freeze > 0 || st.stun > 0 || st.sleep > 0) { _bmToast('你目前無法行動，無法傳送。'); return false; }
        if (typeof prideTeleportBlocked === 'function' && prideTeleportBlocked()) { _bmToast('目前無法傳送。'); return false; }
        var def = _mapDef(bm.m);
        if (def && typeof mapOptDisabled === 'function' && mapOptDisabled(def)) { _bmToast('尚未滿足進入條件，無法傳送到「' + bm.n + '」。'); return false; }
        if (typeof window.exploreTeleportTo !== 'function') return false;
        var item = invFindPref('scroll_teleport');
        if (!item) {
            var cost = (typeof shopPrice === 'function') ? shopPrice(DB.items.scroll_teleport.p) : DB.items.scroll_teleport.p;
            if (!(player.gold >= cost)) { _bmToast('沒有瞬間移動卷軸，金幣也不夠買。'); return false; }
            player.gold -= cost;
            gainItem('scroll_teleport', 1, true, true);
            item = player.inv.find(function (i) { return i && i.id === 'scroll_teleport'; });
            if (!item) return false;
            _log('<span class="text-slate-300">自動購買 1 張瞬間移動卷軸（' + _num(cost) + ' 金幣）。</span>');
        }
        var same = mapState.current === bm.m;
        try { if (typeof npcClanOnLeaveBattleArea === 'function') npcClanOnLeaveBattleArea(); } catch (e0) {}
        try { if (typeof playTeleportFx === 'function') playTeleportFx(); } catch (e1) {}
        if (!window.exploreTeleportTo(bm.m, bm.x, bm.y)) return false;
        consume(item);
        if (same) {
            mapState.mobs = [null, null, null, null, null];
            mapState.spawnAt = [null, null, null, null, null];
            mapState.targetIdx = -1;
            try {
                if (typeof exploreInitFieldSpawns === 'function' && typeof exploreFieldCombatActive === 'function' && exploreFieldCombatActive()) {
                    exploreInitFieldSpawns((state && state.ticks) || 0);
                }
            } catch (eFs) {}
            try { if (typeof renderMobs === 'function') renderMobs(); } catch (eR) {}
        }
        try { if (typeof grantTpSafe === 'function') grantTpSafe(20); } catch (eS) {}
        try { if (typeof saveGame === 'function') saveGame(); } catch (eSv) {}
        _log('<span class="text-sky-300">使用瞬間移動卷軸，傳送到書籤「' + _esc(bm.n) + '」。</span>');
        var w = document.getElementById('bm-win');
        if (w) w.classList.add('hidden');
        return true;
    }

    function _bmToast(msg) {
        var s = document.querySelector('#bm-win .trade-status');
        if (s) s.textContent = msg;
        _log('<span class="text-amber-300">' + _esc(msg) + '</span>');
    }
    function bookmarkRender() {
        var w = document.getElementById('bm-win');
        if (!w || w.classList.contains('hidden')) return;
        var list = _bmList();
        var cnt = invCountPref('scroll_teleport');
        w.querySelector('.bm-count').textContent = '（' + list.length + '/' + BOOKMARK_MAX + '）瞬間移動卷軸 ' + cnt + ' 張';
        w.querySelector('.lin-list').innerHTML = list.length ? list.map(function (b, i) {
            return '<div class="lin-row">' +
                '<button type="button" class="lin-row-main" data-go="' + i + '"><b>' + _esc(b.n) + '</b><small>' + _esc(_mapName(b.m)) + '</small></button>' +
                '<button type="button" class="trade-btn trade-btn-sm" data-del="' + i + '">刪除</button></div>';
        }).join('') : '<div class="trade-empty">還沒有書籤，到想記的地方按「記錄目前位置」。</div>';
    }
    function bookmarkOpen() {
        var w = document.getElementById('bm-win');
        if (!w) {
            w = document.createElement('div');
            w.id = 'bm-win';
            w.className = 'trade-win';
            w.innerHTML = '<div class="trade-box">' +
                '<div class="trade-head">書籤<span class="trade-with bm-count"></span></div>' +
                '<div class="lin-list"></div>' +
                '<div class="trade-status">點書籤傳送（消耗 1 張瞬間移動卷軸）</div>' +
                '<div class="trade-actions">' +
                '<button type="button" class="trade-btn trade-btn-main" data-act="add">記錄目前位置</button>' +
                '<button type="button" class="trade-btn" data-act="close">關閉</button>' +
                '</div></div>';
            w.addEventListener('click', function (ev) {
                var t = ev.target;
                var b = t.closest('[data-act],[data-go],[data-del]');
                if (t === w || (b && b.getAttribute('data-act') === 'close')) { w.classList.add('hidden'); return; }
                if (!b) return;
                if (b.getAttribute('data-act') === 'add') { bookmarkAdd(); return; }
                if (b.hasAttribute('data-go')) { bookmarkGo(parseInt(b.getAttribute('data-go'), 10)); return; }
                if (b.hasAttribute('data-del')) {
                    var i = parseInt(b.getAttribute('data-del'), 10);
                    var bm = _bmList()[i];
                    if (bm && (typeof window.confirm !== 'function' || window.confirm('刪除書籤「' + bm.n + '」？'))) bookmarkRemove(i);
                }
            });
            document.body.appendChild(w);
        }
        w.classList.remove('hidden');
        var s = w.querySelector('.trade-status');
        if (s) s.textContent = '點書籤傳送（消耗 1 張瞬間移動卷軸）';
        bookmarkRender();
    }

    window.afkReportOpen = afkReportOpen;
    window.afkReportReset = afkReset;
    window.afkReportState = function () { return _afk; };
    window.bookmarkOpen = bookmarkOpen;
    window.bookmarkAdd = bookmarkAdd;
    window.bookmarkGo = bookmarkGo;
    window.bookmarkRemove = bookmarkRemove;
})();

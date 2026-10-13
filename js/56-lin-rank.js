// 排行榜：原版石紋金框視窗（照新創）——上排職業分頁＋血盟、下排綜合榜；名次｜職業｜角色｜血盟｜等級，前三名獎盃，自己固定在最底
(function () {
    var CLS_TABS = [['royal', '王族'], ['knight', '騎士'], ['elf', '妖精'], ['mage', '法師'], ['dark', '黑妖'], ['clan', '血盟']];
    var MISC_TABS = [['level', '等級總榜'], ['gold', '金幣'], ['pride', '傲慢之塔'], ['rift', '時空裂痕']];
    var CLS_AVATAR = { royal: '王子', knight: '男騎士', elf: '男妖精', mage: '男法師', dark: '男黑暗妖精', dragon: '男龍騎士', illusion: '男幻術士', warrior: '男戰士' };
    var LIMIT = 100;
    var _tab = '';
    var _cache = {};
    var _busy = {};

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
    }
    function myName() {
        var n = (typeof player !== 'undefined' && player && player.name) || '';
        return typeof normalizeCharNameId === 'function' ? normalizeCharNameId(n) : String(n).trim();
    }
    function nameKey(n) {
        if (typeof charNameIdKey === 'function') return charNameIdKey(n);
        return String(n || '').trim().toLowerCase();
    }
    function apiUrl(tab) {
        var u = '/api/leaderboard?limit=' + LIMIT;
        if (tab === 'clan') u += '&board=clan';
        else if (MISC_TABS.some(function (t) { return t[0] === tab; })) u += '&board=' + tab;
        else u += '&board=cls&cls=' + encodeURIComponent(tab);
        var me = myName();
        if (me) u += '&me=' + encodeURIComponent(me);
        return u + '&t=' + Date.now();
    }
    function trophy(rank) {
        if (rank > 3) return '<span class="lr-rk-n">' + rank + '</span>';
        return '<span class="lr-rk-cup lr-rk-' + rank + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v3h3v2a5 5 0 0 1-4.6 5A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 8.6 13 5 5 0 0 1 4 8V6h3V3zm-1 5c0 1.3.9 2.5 2 2.9V8H6zm12 0h-2v2.9c1.1-.4 2-1.6 2-2.9z"/></svg></span><span class="lr-rk-n lr-rk-c' + rank + '">' + rank + '</span>';
    }
    function clsIcon(row) {
        var av = row.avatar || CLS_AVATAR[row.cls] || '';
        if (!av) return '<span class="lr-cls"></span>';
        return '<span class="lr-cls" title="' + esc(row.clsName || '') + '"><img src="assets/character/' + encodeURIComponent(av) + '.png" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'"></span>';
    }
    function valueCell(tab, row) {
        if (tab === 'gold' || tab === 'pride' || tab === 'rift') return esc(row.valueLabel || '—');
        return 'Lv.' + Math.max(1, Number(row.lv) || 1);
    }
    function headHtml(tab) {
        if (tab === 'clan') return '<div class="lr-row lr-head is-clan"><span>名次</span><span>血盟</span><span>人數</span><span>等級總和</span></div>';
        var last = tab === 'gold' ? '金幣' : (tab === 'pride' || tab === 'rift') ? '成績' : '等級';
        return '<div class="lr-row lr-head"><span>名次</span><span></span><span>角色</span><span>血盟</span><span>' + last + '</span></div>';
    }
    function rowHtml(tab, row, mine) {
        if (tab === 'clan') {
            return '<div class="lr-row is-clan' + (mine ? ' is-me' : '') + (row.rank <= 3 ? ' is-top' : '') + '">' +
                '<span class="lr-rk">' + trophy(row.rank) + '</span>' +
                '<span class="lr-name">' + esc(row.name) + (row.leader ? '<small>盟主 ' + esc(row.leader) + '</small>' : '') + '</span>' +
                '<span class="lr-dim">' + (row.members || 0) + ' 人</span>' +
                '<span class="lr-lv">' + (row.lvSum || 0) + '</span></div>';
        }
        return '<div class="lr-row' + (mine ? ' is-me' : '') + (row.rank <= 3 ? ' is-top' : '') + '" data-name="' + esc(row.name) + '">' +
            '<span class="lr-rk">' + trophy(row.rank) + '</span>' +
            clsIcon(row) +
            '<span class="lr-name">' + esc(row.name) + '</span>' +
            '<span class="lr-clan">' + (row.clan ? esc(row.clan) : '—') + '</span>' +
            '<span class="lr-lv">' + valueCell(tab, row) + '</span></div>';
    }
    function meHtml(tab, d) {
        var me = d && d.me;
        if (tab === 'clan') {
            if (!me) return '<div class="lr-me is-empty">你目前沒有加入線上血盟</div>';
            return '<div class="lr-me">' + rowHtml(tab, me, true) + '</div>';
        }
        if (me) return '<div class="lr-me">' + rowHtml(tab, me, true) + '</div>';
        var p = (typeof player !== 'undefined' && player) || {};
        var isCls = !MISC_TABS.some(function (t) { return t[0] === tab; });
        var tip = (isCls && p.cls && p.cls !== tab) ? '非本職業榜' : '尚未上榜（存檔上傳雲端後才會列入）';
        return '<div class="lr-me is-empty">' + esc(p.name || '') + ' · ' + tip + '</div>';
    }
    function render() {
        var w = $('lm-win-rank');
        if (!w) return;
        w.querySelectorAll('.lr-tabs [data-tab]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === _tab); });
        var body = w.querySelector('.lr-list');
        var foot = w.querySelector('.lr-foot');
        var d = _cache[_tab];
        if (location.protocol !== 'http:' && location.protocol !== 'https:') {
            body.innerHTML = '<div class="lr-msg">排行榜需要連線至伺服器遊玩。</div>'; foot.innerHTML = ''; return;
        }
        if (!d) { body.innerHTML = '<div class="lr-msg">' + (_busy[_tab] ? '載入排行榜中…' : '') + '</div>'; foot.innerHTML = ''; return; }
        if (d.err) { body.innerHTML = '<div class="lr-msg">' + esc(d.err) + '</div>'; foot.innerHTML = ''; return; }
        var meKey = nameKey(myName());
        var rows = (d.rows || []).map(function (r) {
            var mine = _tab === 'clan' ? !!(d.me && d.me.name === r.name) : !!(meKey && nameKey(r.name) === meKey);
            return rowHtml(_tab, r, mine);
        }).join('');
        body.innerHTML = headHtml(_tab) + (rows || '<div class="lr-msg">目前尚無上榜資料</div>');
        foot.innerHTML = meHtml(_tab, d);
    }
    function load(tab, force) {
        var c = _cache[tab];
        if (!force && c && !c.err && Date.now() - c.at < 30000) { render(); return; }
        if (_busy[tab]) return;
        if (location.protocol !== 'http:' && location.protocol !== 'https:') { render(); return; }
        _busy[tab] = true;
        render();
        fetch(apiUrl(tab), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
            _busy[tab] = false;
            _cache[tab] = (d && d.ok) ? { at: Date.now(), rows: d.rows || [], me: d.me || null, total: d.total || 0 }
                : { at: Date.now(), err: (d && d.message) || '無法載入排行榜，請稍後再試。' };
            if (_tab === tab) render();
        }).catch(function () {
            _busy[tab] = false;
            _cache[tab] = { at: Date.now(), err: '無法連線至排行榜伺服器。' };
            if (_tab === tab) render();
        });
    }
    function build() {
        var w = $('lm-win-rank');
        if (w) return w;
        w = document.createElement('div');
        w.id = 'lm-win-rank';
        w.className = 'lm-win lr-win hidden';
        w.innerHTML = '<div class="lm-frame lr-frame">' +
            '<div class="lm-title">排行榜<button type="button" class="lm-x" aria-label="關閉">×</button></div>' +
            '<div class="lr-tabs lr-tabs-cls">' + CLS_TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
            '<div class="lr-tabs lr-tabs-misc">' + MISC_TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
            '<div class="lr-list"></div><div class="lr-foot"></div></div>';
        w.addEventListener('click', function (ev) {
            if (ev.target === w || ev.target.closest('.lm-x')) { w.classList.add('hidden'); return; }
            var t = ev.target.closest('.lr-tabs [data-tab]');
            if (t) { _tab = t.getAttribute('data-tab'); load(_tab, false); return; }
            var r = ev.target.closest('.lr-row[data-name]');
            if (r && typeof viewLeaderboardEquip === 'function') viewLeaderboardEquip(r.getAttribute('data-name'));
        });
        document.body.appendChild(w);
        return w;
    }
    function linRankOpen(tab) {
        document.querySelectorAll('.lm-win').forEach(function (x) { x.classList.add('hidden'); });
        try { if (typeof setMobileTabPanelOpen === 'function') setMobileTabPanelOpen(false); } catch (e) {}
        var w = build();
        if (tab) _tab = tab;
        if (!_tab) {
            var c = (typeof player !== 'undefined' && player && player.cls) || '';
            _tab = CLS_TABS.some(function (t) { return t[0] === c; }) ? c : 'level';
        }
        w.classList.remove('hidden');
        load(_tab, false);
        return w;
    }
    window.linRankOpen = linRankOpen;
})();

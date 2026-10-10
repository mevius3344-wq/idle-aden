// ===== 🎮 樂園風 HUD：右上地圖名＋座標＋小地圖、信件、左側夥伴、5 格快捷道具、底部選單列、整條經驗條、小聊天框；點地面移動 =====
(function () {
    'use strict';

    var QUICK_N = 5;
    var QUICK_DEFAULT = ['potion_heal', 'potion_strong', 'potion_haste', 'scroll_teleport', 'potion_blue'];
    var QUICK_TYPES = { pot: 1, scroll: 1, food: 1 };
    var CHAT_LABELS = { 'logtab-btn-combat': '戰', 'chattab-btn-world': '世', 'chattab-btn-clan': '盟', 'chattab-btn-party': '隊', 'logtab-btn-sys': '系' };
    var CHAT_PH = '點擊輸入聊天內容';
    var CHAT_ORDER = ['logtab-btn-combat', 'chattab-btn-world', 'chattab-btn-clan', 'chattab-btn-party', 'logtab-btn-sys'];
    var MENU = [
        { key: 'stats', label: '角色', tab: 'stats', svg: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><circle cx="12" cy="10" r="3"/><path d="M7.5 17c1-2.4 2.6-3.5 4.5-3.5s3.5 1.1 4.5 3.5"/>' },
        { key: 'equip', label: '裝備', tab: 'equip', svg: '<path d="M4 13c0-5 3.6-9 8-9s8 4 8 9v6h-5v-5H9v5H4z"/><path d="M9 9h6"/>' },
        { key: 'items', label: '背包', tab: 'items', svg: '<path d="M6 8h12l1 13H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M9 13h6"/>' },
        { key: 'skill', label: '技能', tab: 'skill', svg: '<path d="M12 3c5 0 8 3 8 7 0 3-2.5 5-5 5-2 0-3.5-1.4-3.5-3.2 0-1.5 1.2-2.6 2.6-2.6"/><path d="M12 21c-5 0-8-3-8-7 0-3 2.5-5 5-5"/>' },
        { key: 'menu', label: '選單', svg: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>' }
    ];

    var _built = false;
    var _mmAt = 0;
    var _partySig = '';
    var _quickSig = '';
    var _pressT = null;

    function gs() { return document.getElementById('game-screen'); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function el(tag, id, cls, html) {
        var e = document.createElement(tag);
        if (id) e.id = id;
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }
    function svgIcon(inner) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
    }
    function inTown() {
        var s = gs();
        return !!(s && s.classList.contains('chud-in-town'));
    }

    // ---------- 快捷道具 ----------
    function quickKey() { return 'lr_quick_v1_' + (typeof currentSlot !== 'undefined' ? currentSlot : 0); }
    function quickLoad() {
        try {
            var a = JSON.parse(localStorage.getItem(quickKey()) || 'null');
            if (Array.isArray(a) && a.length === QUICK_N) return a;
        } catch (e) {}
        return QUICK_DEFAULT.slice();
    }
    function quickSave(a) { try { localStorage.setItem(quickKey(), JSON.stringify(a)); } catch (e) {} }
    function invCount(id) {
        var n = 0;
        try { (player.inv || []).forEach(function (i) { if (i && i.id === id && !i.gw) n += Math.max(1, Number(i.cnt) || 1); }); } catch (e) {}
        return n;
    }
    function itemDef(id) { return (typeof DB !== 'undefined' && DB.items) ? DB.items[id] : null; }
    function itemIcon(id) {
        var d = itemDef(id);
        if (!d) return '';
        try { if (typeof getIconUrl === 'function') return getIconUrl(d); } catch (e) {}
        return 'assets/icons/items/' + d.n + '.png';
    }
    function quickUsable(d) { return !!(d && !d.noUse && (QUICK_TYPES[d.type] || d.eff)); }

    function renderQuick(force) {
        var box = document.getElementById('lr-quick-slots');
        if (!box || typeof player === 'undefined' || !player) return;
        var ids = quickLoad();
        var sig = ids.map(function (id) { return id + ':' + (id ? invCount(id) : 0); }).join('|');
        if (!force && sig === _quickSig) return;
        _quickSig = sig;
        var html = '';
        for (var i = 0; i < QUICK_N; i++) {
            var id = ids[i];
            var d = id ? itemDef(id) : null;
            if (!d) { html += '<button type="button" class="lr-slot is-empty" data-q="' + i + '" aria-label="空快捷格"></button>'; continue; }
            var n = invCount(id);
            html += '<button type="button" class="lr-slot' + (n ? '' : ' is-none') + '" data-q="' + i + '" title="' + esc(d.n) + '">' +
                '<img src="' + esc(itemIcon(id)) + '" alt="" draggable="false" onerror="this.style.opacity=0.25">' +
                '<span class="lr-slot-n">' + (n ? n.toLocaleString() : '0') + '</span></button>';
        }
        box.innerHTML = html;
    }

    function quickUse(i) {
        var id = quickLoad()[i];
        if (!id || !itemDef(id)) { openPicker(i); return; }
        var it = (player.inv || []).find(function (x) { return x && x.id === id && !x.gw; });
        if (!it) {
            try { if (typeof logSys === 'function') logSys('<span class="text-slate-400">快捷欄：身上沒有 ' + esc(itemDef(id).n) + '。長按可更換。</span>'); } catch (e) {}
            return;
        }
        try { if (typeof useItem === 'function') useItem(it.uid); } catch (e2) {}
        renderQuick(true);
    }

    function openPicker(i) {
        closePicker();
        var seen = {};
        var rows = [];
        (player.inv || []).forEach(function (x) {
            if (!x || seen[x.id]) return;
            var d = itemDef(x.id);
            if (!quickUsable(d)) return;
            seen[x.id] = 1;
            rows.push('<button type="button" class="lr-pick-row" data-id="' + esc(x.id) + '"><img src="' + esc(itemIcon(x.id)) + '" alt="" onerror="this.style.opacity=0.25"><span>' + esc(d.n) + '</span><em>' + invCount(x.id).toLocaleString() + '</em></button>');
        });
        var p = el('div', 'lr-picker', 'lr-picker',
            '<div class="lr-pick-head">快捷欄 ' + (i + 1) + '：選擇道具</div>' +
            '<div class="lr-pick-list">' + (rows.join('') || '<div class="lr-pick-empty">背包裡沒有可使用的道具</div>') + '</div>' +
            '<div class="lr-pick-foot"><button type="button" data-act="clear">清空此格</button><button type="button" data-act="close">關閉</button></div>');
        p.addEventListener('click', function (e) {
            var b = e.target.closest('button');
            if (!b) return;
            var ids = quickLoad();
            if (b.getAttribute('data-id')) { ids[i] = b.getAttribute('data-id'); quickSave(ids); }
            else if (b.getAttribute('data-act') === 'clear') { ids[i] = ''; quickSave(ids); }
            closePicker();
            renderQuick(true);
        });
        gs().appendChild(p);
    }
    function closePicker() {
        var p = document.getElementById('lr-picker');
        if (p) p.remove();
    }

    function bindQuick(box) {
        box.addEventListener('pointerdown', function (e) {
            var b = e.target.closest('[data-q]');
            if (!b) return;
            var i = +b.getAttribute('data-q');
            clearTimeout(_pressT);
            b._lrLong = false;
            _pressT = setTimeout(function () { b._lrLong = true; openPicker(i); }, 550);
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
            box.addEventListener(ev, function () { clearTimeout(_pressT); });
        });
        box.addEventListener('click', function (e) {
            var b = e.target.closest('[data-q]');
            if (!b) return;
            e.preventDefault();
            if (b._lrLong) { b._lrLong = false; return; }
            quickUse(+b.getAttribute('data-q'));
        });
        box.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }

    // ---------- 夥伴清單 ----------
    function renderParty() {
        var box = document.getElementById('lr-party');
        if (!box || typeof player === 'undefined' || !player || !player.cls) return;
        var list = [];
        try {
            if (typeof petsOutList === 'function') petsOutList().forEach(function (p) {
                var mhp = (typeof petMhpEff === 'function') ? petMhpEff(p) : p.mhp;
                list.push({ n: (typeof petDisplayName === 'function') ? petDisplayName(p) : p.form, hp: p._downed ? 0 : p.hp, mhp: mhp });
            });
            var sm = (typeof summonV2List === 'function') ? summonV2List() : [];
            if (typeof necroSkeletonList === 'function') sm = sm.concat(necroSkeletonList());
            sm.forEach(function (s) { if (s && !s._downed && s.hp > 0) list.push({ n: s.n || s.form, hp: s.hp, mhp: s.mhp }); });
            if (typeof guardV2List === 'function') guardV2List().forEach(function (s) { if (s) list.push({ n: s.n || s.form, hp: s._downed ? 0 : s.hp, mhp: s.mhp }); });
        } catch (e) {}
        list = list.slice(0, 6);
        var sig = list.map(function (x) { return x.n + ':' + Math.round((x.hp || 0) / Math.max(1, x.mhp || 1) * 40); }).join('|');
        if (sig === _partySig) return;
        _partySig = sig;
        box.innerHTML = list.map(function (x) {
            var pct = Math.max(0, Math.min(100, (x.hp || 0) / Math.max(1, x.mhp || 1) * 100));
            return '<div class="lr-mate' + (pct <= 0 ? ' is-down' : '') + '"><span class="lr-mate-n">' + esc(x.n) + '</span>' +
                '<span class="lr-mate-bar"><i style="width:' + pct.toFixed(1) + '%"></i></span></div>';
        }).join('');
        box.classList.toggle('is-empty', !list.length);
    }

    // ---------- 地圖名＋座標＋小地圖 ----------
    function curMapId() { return (typeof mapState !== 'undefined' && mapState) ? String(mapState.current || '') : ''; }
    function mapName(id) {
        var n = null;
        try { if (typeof mapDisplayName === 'function') n = mapDisplayName(id); } catch (e) {}
        if (!n) {
            var tn = document.getElementById('town-name');
            if (tn && id.indexOf('town_') === 0 && tn.textContent) n = tn.textContent;
        }
        return n || id || '—';
    }
    function exploreOn() {
        try { return typeof window.exploreWorldActive === 'function' && window.exploreWorldActive() && typeof explorePlayerX === 'function'; } catch (e) { return false; }
    }
    function playerCoords() {
        if (!exploreOn()) return null;
        var x = explorePlayerX(), y = explorePlayerY();
        var def = (typeof exploreActiveMapDef === 'function') ? exploreActiveMapDef() : null;
        if (def && def.lin && typeof linmapTileAt === 'function' && typeof linmapData === 'function') {
            var d = linmapData(def.lin);
            var t = linmapTileAt(def.lin, x, y);
            if (d && t) return [d.x0 + t.gx, d.y0 + t.gy];
        }
        return [Math.round(x / 24) + 32768, Math.round(-y / 12) + 32768];
    }
    function renderMapBox() {
        var id = curMapId();
        var nm = document.getElementById('lr-map-name');
        var co = document.getElementById('lr-map-coord');
        if (nm) { var t = mapName(id); if (nm.textContent !== t) nm.textContent = t; }
        if (co) {
            var c = playerCoords();
            var s = c ? (c[0] + ',' + c[1]) : '';
            if (co.textContent !== s) co.textContent = s;
        }
    }

    function renderMinimap(now) {
        var cv = document.getElementById('lr-minimap-cv');
        if (!cv || !cv.getContext) return;
        var every = window.__powerSave ? 2000 : 1000;
        if (now - _mmAt < every) return;
        _mmAt = now;
        var ctx = cv.getContext('2d');
        var W = cv.width, H = cv.height;
        ctx.clearRect(0, 0, W, H);
        if (!exploreOn()) return;
        var px = explorePlayerX(), py = explorePlayerY();
        var def = (typeof exploreActiveMapDef === 'function') ? exploreActiveMapDef() : null;
        var S = 24;
        var img = ctx.createImageData(W, H);
        var buf = img.data;
        var lin = def && def.lin;
        for (var j = 0; j < H; j += 2) {
            for (var i = 0; i < W; i += 2) {
                var wx = px + (i - W / 2) * S, wy = py - (j - H / 2) * S;
                var ok, safe = false;
                if (lin && typeof linmapWalkable === 'function') {
                    ok = linmapWalkable(lin, wx, wy);
                    safe = ok && typeof linmapSafeZone === 'function' && linmapSafeZone(lin, wx, wy);
                } else {
                    ok = (typeof mapdefWalkable === 'function' && def) ? mapdefWalkable(def, wx, wy) : true;
                }
                var r = ok ? (safe ? 92 : 128) : 24, g = ok ? (safe ? 122 : 104) : 28, b = ok ? (safe ? 70 : 70) : 34;
                for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) {
                    var k = ((j + dy) * W + (i + dx)) * 4;
                    buf[k] = r; buf[k + 1] = g; buf[k + 2] = b; buf[k + 3] = 235;
                }
            }
        }
        ctx.putImageData(img, 0, 0);
        try {
            if (typeof mapdefPortals === 'function') {
                (mapdefPortals(curMapId()) || []).forEach(function (p) {
                    if (!p) return;
                    var x = W / 2 + (p.x + (p.w || 40) / 2 - px) / S, y = H / 2 - (p.y + (p.h || 40) / 2 - py) / S;
                    if (x < 0 || y < 0 || x > W || y > H) return;
                    ctx.fillStyle = '#60a5fa';
                    ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
                });
            }
        } catch (eP) {}
        ctx.fillStyle = '#ef4444';
        (typeof mapState !== 'undefined' && mapState.mobs || []).forEach(function (m) {
            if (!m || m._fx == null || m.hp <= 0) return;
            var x = W / 2 + (m._fx - px) / S, y = H / 2 - (m._fy - py) / S;
            if (x < 0 || y < 0 || x > W || y > H) return;
            ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        });
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // ---------- 聊天框 ----------
    function chatIsChat() {
        var t = (typeof _unifiedLogTab !== 'undefined') ? _unifiedLogTab : 'combat';
        return t === 'world' || t === 'clan' || t === 'party';
    }
    function setupChat() {
        var head = document.querySelector('#combat-log-panel > .panel-header');
        var tabs = head && head.firstElementChild;
        if (!tabs || tabs._lrDone) return;
        tabs._lrDone = true;
        tabs.classList.add('lr-chat-tabs');
        CHAT_ORDER.forEach(function (bid) {
            var b = document.getElementById(bid);
            if (!b) return;
            b.setAttribute('data-lr', CHAT_LABELS[bid]);
            tabs.appendChild(b);
        });
        var up = el('button', 'lr-chat-expand', 'lr-chat-expand', '▲');
        up.type = 'button';
        up.title = '放大／縮小聊天框';
        up.onclick = function (e) {
            e.preventDefault();
            var s = gs();
            var big = !s.classList.contains('lr-chat-big');
            s.classList.toggle('lr-chat-big', big);
            up.textContent = big ? '▼' : '▲';
        };
        tabs.insertBefore(up, tabs.firstChild);
        var input = document.getElementById('world-input');
        if (input) {
            input.placeholder = CHAT_PH;
            try {
                new MutationObserver(function () {
                    if (input.placeholder !== CHAT_PH) input.placeholder = CHAT_PH;
                }).observe(input, { attributes: true, attributeFilter: ['placeholder'] });
            } catch (eO) {}
            input.addEventListener('focus', function () {
                if (!chatIsChat() && typeof switchUnifiedLogTab === 'function') switchUnifiedLogTab('world');
            });
        }
        var send = document.getElementById('world-send');
        if (send) send.textContent = '發送';
    }

    // ---------- 建立 ----------
    function build() {
        var s = gs();
        if (!s || _built) return;
        _built = true;
        s.classList.add('lr-hud');

        var mb = el('div', 'lr-mapbox', 'lr-mapbox lr-hud-block', '<div id="lr-map-name" class="lr-map-name">—</div><div id="lr-map-coord" class="lr-map-coord"></div>');
        var mm = el('div', 'lr-minimap', 'lr-minimap lr-hud-block', '<canvas id="lr-minimap-cv" width="112" height="112"></canvas>');
        var mail = el('button', 'lr-mail', 'lr-mail lr-hud-block', svgIcon('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6.5L20.5 7"/>'));
        mail.type = 'button';
        mail.title = '信箱（GM 信件自動領取）';
        mail.onclick = function (e) {
            e.preventDefault();
            try { if (window.GmMail && typeof window.GmMail.claim === 'function') window.GmMail.claim(); } catch (eM) {}
            try { if (typeof switchUnifiedLogTab === 'function') switchUnifiedLogTab('sys'); } catch (eS) {}
        };
        var party = el('div', 'lr-party', 'lr-party is-empty');

        var quick = el('div', 'lr-quick', 'lr-quick lr-hud-block', '<div id="lr-quick-slots" class="lr-quick-slots"></div>');
        var home = el('button', 'lr-home', 'lr-home', svgIcon('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>'));
        home.type = 'button';
        home.title = '回村';
        home.onclick = function (e) {
            e.preventDefault();
            try { if (typeof returnToTown === 'function') returnToTown(); } catch (eT) {}
        };
        quick.appendChild(home);
        bindQuick(quick.querySelector('#lr-quick-slots'));

        var bar = el('div', 'lr-menubar', 'lr-menubar lr-hud-block', MENU.map(function (m) {
            return '<button type="button" class="lr-menu-btn" data-menu="' + m.key + '" title="' + m.label + '">' + svgIcon(m.svg) + '<span>' + m.label + '</span></button>';
        }).join(''));
        bar.addEventListener('click', function (e) {
            var b = e.target.closest('[data-menu]');
            if (!b) return;
            e.preventDefault();
            var m = MENU.find(function (x) { return x.key === b.getAttribute('data-menu'); });
            if (!m) return;
            try {
                if (m.key === 'menu') {
                    if (typeof toggleChudRightMenu === 'function') toggleChudRightMenu();
                    return;
                }
                var tb = document.querySelector('#col-right .tab-bar-buttons [data-tab="' + m.tab + '"]');
                var col = document.getElementById('col-right');
                var open = col && col.classList.contains('mobile-tab-open') && tb && tb.classList.contains('active');
                if (open) { if (typeof collapseMobileTabPanel === 'function') collapseMobileTabPanel(); }
                else if (typeof switchTab === 'function') switchTab(m.tab, tb || null);
            } catch (eB) {}
        });

        var exp = el('div', 'lr-expbar', 'lr-expbar lr-hud-block');
        var oldExp = document.querySelector('#status-panel .status-exp-bar');
        if (oldExp) exp.appendChild(oldExp);

        [mb, mm, mail, party, quick, bar, exp].forEach(function (x) { s.appendChild(x); });
        setupChat();
        if (!s.classList.contains('log-open')) s.classList.add('log-open');
        renderQuick(true);
    }

    function tick() {
        var s = gs();
        if (!s || s.classList.contains('hidden') || !s.classList.contains('combat-hud')) return;
        if (!_built) build();
        if (!s.classList.contains('lr-hud')) s.classList.add('lr-hud');
        if (!s.classList.contains('log-open')) s.classList.add('log-open');
        var wi = document.getElementById('world-input');
        if (wi && wi.placeholder !== CHAT_PH) wi.placeholder = CHAT_PH;
        renderMapBox();
        renderParty();
        renderQuick(false);
        var mmOn = !inTown() && exploreOn();
        if (s.classList.contains('lr-no-mm') === mmOn) s.classList.toggle('lr-no-mm', !mmOn);
        if (mmOn) renderMinimap(Date.now());
        try {
            var src = document.getElementById('align-badge');
            var dst = document.getElementById('lr-align');
            if (src && !dst) {
                var row = document.querySelector('#status-panel .status-defense-row');
                if (row) { dst = el('span', 'lr-align', 'lr-align'); row.appendChild(dst); }
            }
            if (src && dst && dst.textContent !== src.textContent) dst.textContent = src.textContent;
        } catch (eA) {}
    }

    window.lrHudActive = function () { var s = gs(); return !!(s && s.classList.contains('lr-hud')); };
    window.lrHudQuickUse = quickUse;
    setInterval(tick, 500);
})();

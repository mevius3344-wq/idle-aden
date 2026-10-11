/* 🤝 玩家交易（原版風）：點同圖玩家 → 交易 → 雙方放物品／金幣 → 雙方鎖定 → 成交。
 * 鎖定時伺服器從自己的雲端存檔託管物品／金幣（本機同步扣除）；成交後對方的貨以待領取自動入包。 */
(function () {
    'use strict';

    var TRADE_MAX_ITEMS = 5;
    var _trade = null;
    var _busy = false;
    var _claimBusy = false;
    var _askTimer = null;
    var _pickUid = '';

    function _isHttp() {
        try { return location.protocol === 'http:' || location.protocol === 'https:'; } catch (e) { return false; }
    }
    function _id() {
        return (typeof rtPartyIdentity === 'function') ? rtPartyIdentity() : null;
    }
    function _esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function _log(html) {
        try { if (typeof logSys === 'function') logSys('<span class="text-amber-200">【交易】</span>' + html); } catch (e) {}
    }
    function _fmt(n) { return Math.max(0, Math.floor(Number(n) || 0)).toLocaleString(); }

    function _post(path, extra) {
        if (!_isHttp()) return Promise.resolve({ ok: false, message: '請透過伺服器網頁登入後再交易。' });
        var id = _id();
        if (!id) return Promise.resolve({ ok: false, message: '請先登入帳號。' });
        var auth = (typeof anticheatAuthExtras === 'function') ? anticheatAuthExtras() : {};
        var body = Object.assign({ account: id.account, slot: id.slot, name: id.name }, auth, extra || {});
        return fetch('/api/trade/' + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (res) {
            return res.json().catch(function () { return { ok: false, message: '伺服器回應異常。' }; });
        }).catch(function () { return { ok: false, message: '無法連線交易伺服器。' }; });
    }

    function _applyWallet(data) {
        if (!data || typeof player === 'undefined' || !player) return;
        if (data.goldAfter != null && Number.isFinite(Number(data.goldAfter))) player.gold = Math.max(0, Math.floor(Number(data.goldAfter)));
        if (data.walletRev != null && Number.isFinite(Number(data.walletRev))) player._walletRev = Math.max(0, Math.floor(Number(data.walletRev)));
    }

    function _syncCloud() {
        try { if (typeof saveGame === 'function') saveGame(); } catch (e0) {}
        if (typeof cloudPushSlotSync !== 'function' || typeof saveStateJson !== 'function' || typeof currentSlot === 'undefined') {
            return { ok: false, message: '雲端同步未就緒，請重新登入後再試。' };
        }
        try {
            if (!cloudPushSlotSync(currentSlot, JSON.parse(saveStateJson()))) {
                return { ok: false, message: '雲端存檔同步失敗（可能進度衝突），請重新整理後再交易。' };
            }
        } catch (e1) {
            return { ok: false, message: '雲端同步失敗，請稍後再試。' };
        }
        return { ok: true };
    }

    function _afterInvChange() {
        try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
        try { if (typeof renderTabs === 'function') renderTabs(); } catch (e2) {}
        try { if (typeof saveGame === 'function') saveGame(); } catch (e3) {}
    }

    // ── 物品 ──
    function _canTrade(item) {
        if (!item || !item.id) return '無效物品';
        if (item.lock) return '鎖定中的物品不能交易';
        if (typeof isRentalItem === 'function' && isRentalItem(item)) return '限時物品不能交易';
        if (item.gw || Number(item.expireAt) > 0) return '特殊道具不能交易';
        var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[item.id] : null;
        if (!d) return '未知物品';
        if (d.noSell) return '此物品不能交易';
        if (d.doll || d.slot === 'doll') return '魔法娃娃不能交易';
        return '';
    }
    function _ensureUid(item) {
        if (!item.uid) item.uid = (typeof uid === 'function' ? uid() : ('tr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)));
        return String(item.uid);
    }
    function _snap(item, cnt) {
        var name = '';
        try { var d = DB.items[item.id]; name = d && d.n ? String(d.n) : ''; } catch (e) {}
        return {
            id: item.id, cnt: cnt, en: Math.floor(Number(item.en) || 0), bless: item.bless || false,
            anc: item.anc || false, attr: item.attr || false, seteff: item.seteff || false, _n: name
        };
    }
    function _label(item, cnt) {
        if (!item) return '';
        var it = Object.assign({}, item, { cnt: cnt || item.cnt || 1 });
        try { if (typeof getItemFullName === 'function') return getItemFullName(it) + ((it.cnt || 1) > 1 ? ' ×' + _fmt(it.cnt) : ''); } catch (e) {}
        return String(it._n || it.id);
    }
    function _iconCell(item, cnt, opts) {
        opts = opts || {};
        if (!item) return '<div class="trade-cell is-empty"></div>';
        var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[item.id] : null;
        var url = (d && typeof getIconUrl === 'function') ? getIconUrl(d) : '';
        try { if (window.GAME_HOST && typeof window.GAME_HOST.assetUrl === 'function') url = window.GAME_HOST.assetUrl(url); } catch (e) {}
        var c = Math.max(1, Math.floor(Number(cnt) || 1));
        var corner = (Number(item.en) || 0) > 0 ? '<span class="trade-cell-en">+' + item.en + '</span>'
            : (c > 1 ? '<span class="trade-cell-cnt">' + _fmt(c) + '</span>' : '');
        var color = (typeof getItemColor === 'function') ? getItemColor(Object.assign({}, item, { cnt: c })) : '';
        return '<button type="button" class="trade-cell' + (opts.sel ? ' is-sel' : '') + '"' +
            (opts.onclick ? ' onclick="' + opts.onclick + '"' : ' disabled') +
            ' title="' + _esc(_label(item, c)) + '">' +
            '<img src="' + _esc(url) + '" alt="" draggable="false" onerror="this.style.opacity=0">' + corner +
            '<span class="trade-cell-name ' + color + '">' + _esc(_label(item, c)) + '</span></button>';
    }

    // ── 視窗 ──
    function _win() {
        var el = document.getElementById('trade-win');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'trade-win';
        el.className = 'trade-win hidden';
        el.setAttribute('role', 'dialog');
        document.body.appendChild(el);
        return el;
    }
    function _myOfferItems() { return (_trade && _trade.me && _trade.me.items) || []; }

    function _offeredCnt(uidStr) {
        var n = 0;
        _myOfferItems().forEach(function (x) { if (x && String(x.uid) === String(uidStr)) n += x.cnt; });
        return n;
    }

    function tradeRender() {
        var el = _win();
        var T = _trade;
        if (!T || T.state !== 'open') {
            el.classList.add('hidden');
            el.innerHTML = '';
            return;
        }
        var me = T.me || {}, them = T.them || {};
        var mine = me.items || [], theirs = them.items || [];
        var html = '<div class="trade-box">';
        html += '<div class="trade-head">交易 <span class="trade-with">與 ' + _esc(them.name || '對方') + '</span></div>';
        html += '<div class="trade-side' + (them.locked ? ' is-locked' : '') + '">' +
            '<div class="trade-side-title">' + _esc(them.name || '對方') + ' 放的（' + theirs.length + '/' + TRADE_MAX_ITEMS + '）' +
            (them.locked ? '<span class="trade-lock-tag">已鎖定</span>' : '') + '</div><div class="trade-grid">';
        for (var i = 0; i < TRADE_MAX_ITEMS; i++) html += theirs[i] ? _iconCell(theirs[i].item, theirs[i].cnt) : _iconCell(null);
        html += '</div><div class="trade-gold">金幣 <b>' + _fmt(them.gold) + '</b></div></div>';

        html += '<div class="trade-side is-mine' + (me.locked ? ' is-locked' : '') + '">' +
            '<div class="trade-side-title">我放的（' + mine.length + '/' + TRADE_MAX_ITEMS + '）' +
            (me.locked ? '<span class="trade-lock-tag">已鎖定</span>' : '') + '</div><div class="trade-grid">';
        for (var j = 0; j < TRADE_MAX_ITEMS; j++) {
            html += mine[j] ? _iconCell(mine[j].item, mine[j].cnt, me.locked ? null : { onclick: 'tradeRemoveOffer(' + j + ')' }) : _iconCell(null);
        }
        html += '</div><div class="trade-gold">金幣 <b>' + _fmt(me.gold) + '</b>' +
            (me.locked ? '' : ' <button type="button" class="trade-btn trade-btn-sm" onclick="tradeSetGold()">放入金幣</button>') + '</div></div>';

        if (!me.locked) {
            var bag = (player && Array.isArray(player.inv) ? player.inv : []).filter(function (it) {
                return it && !_canTrade(it) && (it.cnt || 1) - _offeredCnt(it.uid) > 0;
            });
            html += '<div class="trade-bag-title">背包（點物品放入）</div><div class="trade-bag">';
            if (!bag.length) html += '<div class="trade-empty">沒有可交易的物品</div>';
            bag.slice(0, 120).forEach(function (it) {
                var left = (it.cnt || 1) - _offeredCnt(it.uid);
                html += _iconCell(it, left, { onclick: 'tradeAddFromBag(\'' + _esc(_ensureUid(it)) + '\')' });
            });
            html += '</div>';
        }
        var status = me.locked && them.locked ? '成交中…'
            : me.locked ? '已鎖定，等待對方鎖定。對方更改內容時會自動解除。'
            : them.locked ? '對方已鎖定，確認內容後按「鎖定交易」即成交。'
            : '雙方放好後各自按「鎖定交易」，兩邊都鎖定就成交。';
        html += '<div class="trade-status">' + status + '</div>';
        html += '<div class="trade-actions">' +
            (me.locked ? '' : '<button type="button" class="trade-btn trade-btn-main" onclick="tradeLock()">鎖定交易</button>') +
            '<button type="button" class="trade-btn" onclick="tradeCancel()">取消交易</button></div>';
        html += '</div>';
        el.innerHTML = html;
        el.classList.remove('hidden');
    }

    function _setTrade(t, note) {
        var prev = _trade;
        _trade = t && (t.state === 'ask' || t.state === 'open') ? t : null;
        if (t && t.state === 'done') _log('與 ' + _esc((t.them && t.them.name) || '對方') + ' 交易完成。');
        else if (t && t.state === 'cancel' && prev) _log(_esc(t.reason || '交易已取消。'));
        if (note) _log(_esc(note));
        _renderAsk();
        tradeRender();
    }

    // ── 邀請提示（被邀請方，15 秒） ──
    function _renderAsk() {
        var box = document.getElementById('trade-ask');
        var T = _trade;
        var show = T && T.state === 'ask' && !T.requester;
        if (!show) {
            if (box) box.remove();
            if (_askTimer) { clearInterval(_askTimer); _askTimer = null; }
            return;
        }
        if (!box) {
            box = document.createElement('div');
            box.id = 'trade-ask';
            box.className = 'trade-ask';
            document.body.appendChild(box);
        }
        var until = Date.now() + (T.askLeftMs || 15000);
        var draw = function () {
            var left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
            box.innerHTML = '<div class="trade-ask-text"><b>' + _esc((T.them && T.them.name) || '玩家') + '</b> 想跟你交易（' + left + '）</div>' +
                '<div class="trade-actions"><button type="button" class="trade-btn trade-btn-main" onclick="tradeRespond(true)">接受</button>' +
                '<button type="button" class="trade-btn" onclick="tradeRespond(false)">拒絕</button></div>';
            if (left <= 0) { _trade = null; _renderAsk(); }
        };
        draw();
        if (_askTimer) clearInterval(_askTimer);
        _askTimer = setInterval(draw, 500);
    }

    // ── 動作 ──
    function tradeRequest(key, name) {
        if (_busy || !key) return;
        if (_trade) { _log('你正在交易中。'); return; }
        _busy = true;
        _post('request', { targetKey: key }).then(function (data) {
            _busy = false;
            if (!data || !data.ok) { _log(_esc((data && data.message) || '無法提出交易。')); return; }
            _trade = data.trade || null;
            _log(_esc(data.message || ('已向 ' + (name || '對方') + ' 提出交易，等待回應…')));
        });
    }

    function tradeRespond(accept) {
        if (_busy || !_trade) return;
        _busy = true;
        _post('respond', { tradeId: _trade.id, accept: !!accept }).then(function (data) {
            _busy = false;
            if (!data || !data.ok) { _log(_esc((data && data.message) || '回覆失敗。')); _setTrade(null); return; }
            _setTrade(data.trade || null);
        });
    }

    function tradeCancel() {
        if (!_trade) return;
        var id = _trade.id;
        _post('cancel', { tradeId: id }).then(function () {
            if (_trade && _trade.id === id) _setTrade(null);
            tradeClaim();
        });
    }

    function _sendOffer(items, gold) {
        if (_busy || !_trade) return;
        _busy = true;
        _post('offer', {
            tradeId: _trade.id,
            gold: gold,
            items: items.map(function (x) { return { uid: x.uid, cnt: x.cnt, item: x.item }; })
        }).then(function (data) {
            _busy = false;
            if (!data || !data.ok) { _log(_esc((data && data.message) || '更新失敗。')); return; }
            _setTrade(data.trade || null);
        });
    }

    function tradeAddFromBag(uidStr) {
        if (!_trade || !_trade.me || _trade.me.locked) return;
        var it = (player.inv || []).find(function (x) { return x && String(x.uid) === String(uidStr); });
        if (!it) return;
        var why = _canTrade(it);
        if (why) { _log(why); return; }
        var items = _myOfferItems().slice();
        var left = (it.cnt || 1) - _offeredCnt(it.uid);
        if (left <= 0) return;
        var exists = items.findIndex(function (x) { return String(x.uid) === String(it.uid); });
        if (exists < 0 && items.length >= TRADE_MAX_ITEMS) { _log('最多放 ' + TRADE_MAX_ITEMS + ' 種物品。'); return; }
        var cnt = 1;
        if (left > 1) {
            var raw = prompt('放入數量（可放 ' + left + '）', String(left));
            if (raw === null) return;
            cnt = Math.floor(Number(raw));
            if (!cnt || cnt < 1 || cnt > left) { _log('數量無效。'); return; }
        }
        if (exists >= 0) {
            var cur = items[exists];
            items[exists] = { uid: cur.uid, cnt: cur.cnt + cnt, item: _snap(it, cur.cnt + cnt) };
        } else {
            items.push({ uid: _ensureUid(it), cnt: cnt, item: _snap(it, cnt) });
        }
        _sendOffer(items, (_trade.me && _trade.me.gold) || 0);
    }

    function tradeRemoveOffer(idx) {
        if (!_trade || !_trade.me || _trade.me.locked) return;
        var items = _myOfferItems().slice();
        if (idx < 0 || idx >= items.length) return;
        items.splice(idx, 1);
        _sendOffer(items, _trade.me.gold || 0);
    }

    function tradeSetGold() {
        if (!_trade || !_trade.me || _trade.me.locked) return;
        var have = Math.max(0, Math.floor(Number(player && player.gold) || 0));
        var raw = prompt('放入金幣（持有 ' + _fmt(have) + '）', String(_trade.me.gold || 0));
        if (raw === null) return;
        var g = Math.floor(Number(String(raw).replace(/,/g, '')));
        if (!(g >= 0) || g > have) { _log('金幣數量無效。'); return; }
        _sendOffer(_myOfferItems(), g);
    }

    function tradeLock() {
        if (_busy || !_trade || !_trade.me || _trade.me.locked) return;
        var me = _trade.me;
        if ((me.gold || 0) > (player.gold || 0)) { _log('金幣不足。'); return; }
        for (var i = 0; i < (me.items || []).length; i++) {
            var x = me.items[i];
            var it = (player.inv || []).find(function (v) { return v && String(v.uid) === String(x.uid); });
            if (!it || (it.cnt || 1) < x.cnt) { _log('背包裡的「' + _esc(_label(x.item, x.cnt)) + '」數量不足，請重新放入。'); return; }
        }
        if ((me.items || []).length || me.gold) {
            var sync = _syncCloud();
            if (!sync.ok) { _log(_esc(sync.message)); return; }
        }
        _busy = true;
        _post('lock', { tradeId: _trade.id, rev: _trade.rev }).then(function (data) {
            _busy = false;
            if (!data || !data.ok) {
                _log(_esc((data && data.message) || '鎖定失敗。'));
                if (data && data.trade) _setTrade(data.trade);
                return;
            }
            (data.removed || []).forEach(function (r) {
                var it = (player.inv || []).find(function (v) { return v && String(v.uid) === String(r.uid); });
                if (!it) return;
                it.cnt = (it.cnt || 1) - r.cnt;
                if (it.cnt <= 0) player.inv = player.inv.filter(function (v) { return v !== it; });
            });
            if (data.goldAfter != null) _applyWallet(data);
            else if (data.gold) player.gold = Math.max(0, (player.gold || 0) - data.gold);
            _afterInvChange();
            _setTrade(data.trade || null);
            if (data.done) tradeClaim();
        });
    }

    /** 領取成交／退回的貨：伺服器寫入自己的雲端存檔後，本機同步入包 */
    function tradeClaim() {
        if (_claimBusy || !_isHttp() || !_id()) return Promise.resolve(false);
        _claimBusy = true;
        return _post('claim', {}).then(function (data) {
            _claimBusy = false;
            if (!data || !data.ok) return false;
            var items = data.items || [];
            if (!items.length && !data.gold) return false;
            var names = [];
            items.forEach(function (snap) {
                var it = {
                    id: snap.id, uid: snap.uid, cnt: Math.max(1, Math.floor(Number(snap.cnt) || 1)),
                    en: Math.floor(Number(snap.en) || 0), bless: snap.bless || false, anc: snap.anc || false,
                    attr: snap.attr || false, seteff: snap.seteff || false, lock: false, junk: false
                };
                if (typeof invAddOrStack === 'function') invAddOrStack(it);
                else { if (!Array.isArray(player.inv)) player.inv = []; player.inv.push(it); }
                names.push(_esc(_label(it, it.cnt)));
            });
            _applyWallet(data);
            if (data.gold && data.goldAfter == null) player.gold = (player.gold || 0) + data.gold;
            var back = (data.claims || []).every(function (c) { return c && c.reason === 'return'; });
            if (data.gold) names.push('金幣 ' + _fmt(data.gold));
            _log((back ? '退回：' : '收到：') + names.join('、'));
            _afterInvChange();
            return true;
        });
    }

    function tradeOnEvent(ev) {
        if (!ev) return;
        if (ev.type === 'trade_claim') { tradeClaim(); return; }
        if (ev.type !== 'trade' || !ev.trade) return;
        var t = ev.trade;
        if (_trade && _trade.id === t.id && (t.rev || 0) < (_trade.rev || 0)) return;
        if (!_trade && t.state === 'cancel') { _setTrade(null); return; }
        _setTrade(t, ev.note || '');
    }

    function tradeResume() {
        var id = _id();
        if (!id || !_isHttp()) return;
        fetch('/api/trade/state?account=' + encodeURIComponent(id.account) + '&slot=' + encodeURIComponent(String(id.slot)), { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data || !data.ok) return;
                if (data.trade) _setTrade(data.trade);
                if (data.claims) tradeClaim();
            }).catch(function () {});
    }

    // ── 點同圖玩家的選單 ──
    function _closeMenu() {
        var m = document.getElementById('peer-menu');
        if (m) m.remove();
    }
    function peerMenuOpen(key, name, isParty, ev) {
        _closeMenu();
        var m = document.createElement('div');
        m.id = 'peer-menu';
        m.className = 'peer-menu';
        var n = _esc(name || '冒險者');
        m.innerHTML = '<div class="peer-menu-name">' + n + '</div>' +
            '<button type="button" data-act="trade">交易</button>' +
            (isParty ? '' : '<button type="button" data-act="party">邀請組隊</button>') +
            '<button type="button" data-act="close">關閉</button>';
        m.addEventListener('click', function (e) {
            var b = e.target && e.target.closest ? e.target.closest('button') : null;
            if (!b) return;
            e.stopPropagation();
            var act = b.getAttribute('data-act');
            _closeMenu();
            if (act === 'trade') tradeRequest(key, name);
            else if (act === 'party' && typeof rtPartyPickInvite === 'function') rtPartyPickInvite(name);
        });
        document.body.appendChild(m);
        var x = ev && ev.clientX != null ? ev.clientX : window.innerWidth / 2;
        var y = ev && ev.clientY != null ? ev.clientY : window.innerHeight / 2;
        var w = m.offsetWidth || 120, h = m.offsetHeight || 120;
        m.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, x - w / 2)) + 'px';
        m.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, y - h - 12)) + 'px';
        setTimeout(function () {
            document.addEventListener('pointerdown', function off(e2) {
                var mm = document.getElementById('peer-menu');
                if (mm && e2.target && mm.contains(e2.target)) return;
                document.removeEventListener('pointerdown', off, true);
                _closeMenu();
            }, true);
        }, 0);
    }

    window.tradeRequest = tradeRequest;
    window.tradeRespond = tradeRespond;
    window.tradeCancel = tradeCancel;
    window.tradeAddFromBag = tradeAddFromBag;
    window.tradeRemoveOffer = tradeRemoveOffer;
    window.tradeSetGold = tradeSetGold;
    window.tradeLock = tradeLock;
    window.tradeClaim = tradeClaim;
    window.tradeOnEvent = tradeOnEvent;
    window.tradeRender = tradeRender;
    window.tradeResume = tradeResume;
    window.tradeCurrent = function () { return _trade; };
    window.peerMenuOpen = peerMenuOpen;

    (function watch() {
        var lastId = '';
        setInterval(function () {
            var id = _id();
            var cur = id ? id.account + '#' + id.slot : '';
            if (cur && cur !== lastId) tradeResume();
            if (!cur && _trade) _setTrade(null);
            lastId = cur;
        }, 3000);
    })();
})();

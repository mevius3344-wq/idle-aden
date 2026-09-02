/* 🏛 即時全服拍賣行：玩家上架／購買，含上架費與購買手續費 */
(function () {
    'use strict';

    var _auctionTab = 'browse'; // browse | list | mine
    var _auctionListings = [];
    var _auctionMine = [];
    var _auctionClaims = [];
    var _auctionFeesMeta = null;
    var _auctionQuery = '';
    var _auctionBusy = false;
    var _auctionPollTimer = null;
    var _auctionFeeDefaults = {
        listFeeRate: 0.02,
        listFeeMin: 100,
        listFeeMax: 50000,
        buyFeeRate: 0.05,
        ttlMs: 72 * 60 * 60 * 1000,
        maxPerAccount: 20
    };

    function _ahIsHttp() {
        try {
            var p = String(location.protocol || '');
            return p === 'http:' || p === 'https:';
        } catch (e) { return false; }
    }
    function _ahAccount() {
        try {
            if (typeof window !== 'undefined' && window.__fb5AuthAccount) return String(window.__fb5AuthAccount || '').trim();
            if (typeof GameAccountAuth !== 'undefined' && GameAccountAuth && typeof GameAccountAuth.currentAccount === 'function')
                return String(GameAccountAuth.currentAccount() || '').trim();
        } catch (e) {}
        return '';
    }
    function _ahIdentity() {
        if (typeof player === 'undefined' || !player || !player.cls) return null;
        var account = _ahAccount();
        if (!account) return null;
        return {
            account: account,
            slot: (typeof currentSlot !== 'undefined' ? currentSlot : 0),
            name: player.name || '未命名',
            lv: player.lv || 1,
            cls: player.cls || ''
        };
    }
    function _ahPost(path, extra) {
        if (!_ahIsHttp()) return Promise.resolve({ ok: false, error: 'offline', message: '請透過伺服器網頁登入後使用拍賣行。' });
        var base = _ahIdentity();
        if (!base) return Promise.resolve({ ok: false, error: 'need account', message: '請先登入帳號再使用拍賣行。' });
        var body = Object.assign({}, base, extra || {});
        return fetch('/api/auction/' + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (res) {
            return res.json().then(function (data) {
                if (data && typeof data === 'object') data._http = res.status;
                return data;
            });
        }).catch(function () {
            return { ok: false, error: 'network', message: '無法連線拍賣伺服器。' };
        });
    }
    function _ahGet(pathWithQuery) {
        if (!_ahIsHttp()) return Promise.resolve({ ok: false, error: 'offline', message: '請透過伺服器網頁登入。' });
        return fetch('/api/auction/' + pathWithQuery, { method: 'GET' })
            .then(function (res) { return res.json(); })
            .catch(function () { return { ok: false, error: 'network', message: '無法連線拍賣伺服器。' }; });
    }

    function _ahCalcFees(price) {
        var meta = _auctionFeesMeta || _auctionFeeDefaults;
        var p = Math.max(1, Math.min(999999999, Math.floor(Number(price) || 0)));
        var listFee = Math.floor(p * (meta.listFeeRate || 0.02));
        if (listFee < (meta.listFeeMin || 100)) listFee = meta.listFeeMin || 100;
        if (listFee > (meta.listFeeMax || 50000)) listFee = meta.listFeeMax || 50000;
        var buyFee = Math.max(0, Math.floor(p * (meta.buyFeeRate || 0.05)));
        return { price: p, listFee: listFee, buyFee: buyFee, totalBuy: p + buyFee };
    }

    function _ahEsc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function _ahItemLabel(item) {
        if (!item) return '未知物品';
        try {
            if (typeof getItemFullName === 'function') return getItemFullName(item);
        } catch (e) {}
        var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[item.id] : null;
        var n = d && d.n ? d.n : item.id;
        var en = item.en > 0 ? ('+' + item.en + ' ') : '';
        var cnt = item.cnt > 1 ? (' ×' + item.cnt) : '';
        return en + n + cnt;
    }

    function _ahIconHtml(item) {
        if (!item || !item.id) return '<div class="ah-item-icon ah-item-icon--empty" aria-hidden="true"></div>';
        var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[item.id] : null;
        if (!d) return '<div class="ah-item-icon ah-item-icon--empty" aria-hidden="true"></div>';
        var imgUrl = (typeof getIconUrl === 'function') ? getIconUrl(d) : '';
        try {
            if (window.GAME_HOST && typeof window.GAME_HOST.assetUrl === 'function') imgUrl = window.GAME_HOST.assetUrl(imgUrl);
        } catch (e0) {}
        var glow = (typeof getGlowClass === 'function') ? getGlowClass(item, d) : '';
        var corner = (Number(item.en) || 0) > 0
            ? ('<span class="classic-icon-corner-value is-enhance">+' + ((typeof capEn === 'function') ? capEn(item.en, d) : item.en) + '</span>')
            : ((item.cnt || 1) > 1 ? ('<span class="classic-icon-corner-value is-count">' + (item.cnt || 1).toLocaleString() + '</span>') : '');
        return '<div class="ah-item-icon classic-icon-box" aria-hidden="true">' +
            '<img src="' + _ahEsc(imgUrl) + '" alt="" class="ah-item-icon-img object-contain pointer-events-none ' + glow + '" onerror="this.style.opacity=\'0\';">' +
            corner + '</div>';
    }

    function _ahItemTitleHtml(item) {
        return '<div class="ah-item-title flex gap-2.5 items-start min-w-0 flex-1">' +
            _ahIconHtml(item) +
            '<div class="text-sm leading-snug min-w-0 ' + ((typeof getItemColor === 'function') ? getItemColor(item) : '') + ' font-bold">' + _ahItemLabel(item) + '</div>' +
            '</div>';
    }

    function _ahCanListItem(item) {
        if (!item || !item.id) return { ok: false, reason: '無效物品' };
        if (item.lock) return { ok: false, reason: '鎖定中無法上架' };
        if (typeof isRentalItem === 'function' && isRentalItem(item)) return { ok: false, reason: '限時裝備無法上架' };
        if (item.gw) return { ok: false, reason: '特殊道具無法上架' };
        var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[item.id] : null;
        if (!d) return { ok: false, reason: '未知物品' };
        if (d.noSell) return { ok: false, reason: '此物品無法上架' };
        if (d.doll || d.slot === 'doll') return { ok: false, reason: '魔法娃娃無法上架' };
        return { ok: true };
    }

    function _ahSnapshotItem(item, cnt) {
        return {
            id: item.id,
            cnt: Math.max(1, Math.floor(Number(cnt) || 1)),
            en: Math.floor(Number(item.en) || 0),
            bless: item.bless || false,
            anc: item.anc || false,
            attr: item.attr || false,
            seteff: item.seteff || false,
            lock: false,
            junk: false
        };
    }

    function _ahGrantItem(snap) {
        if (!snap || !snap.id) return false;
        var it = {
            id: snap.id,
            uid: (typeof uid === 'function' ? uid() : ('ah' + Date.now().toString(36))),
            cnt: Math.max(1, Math.floor(Number(snap.cnt) || 1)),
            en: Math.floor(Number(snap.en) || 0),
            bless: snap.bless || false,
            anc: snap.anc || false,
            attr: snap.attr || false,
            seteff: snap.seteff || false,
            lock: false,
            junk: false
        };
        if (typeof invAddOrStack === 'function') invAddOrStack(it);
        else {
            if (!Array.isArray(player.inv)) player.inv = [];
            player.inv.push(it);
        }
        return true;
    }

    function _ahRemoveInv(uid, cnt) {
        if (!player || !Array.isArray(player.inv)) return false;
        var item = player.inv.find(function (i) { return i && i.uid === uid; });
        if (!item) return false;
        var n = Math.max(1, Math.floor(Number(cnt) || 1));
        if ((item.cnt || 1) < n) return false;
        item.cnt = (item.cnt || 1) - n;
        if (item.cnt <= 0) player.inv = player.inv.filter(function (i) { return i && i.uid !== uid; });
        return true;
    }

    function _ahFmtGold(n) {
        return Math.max(0, Math.floor(Number(n) || 0)).toLocaleString();
    }

    function _ahFmtRemain(ms) {
        ms = Math.max(0, Math.floor(Number(ms) || 0));
        var h = Math.floor(ms / 3600000);
        var m = Math.floor((ms % 3600000) / 60000);
        if (h >= 48) return Math.floor(h / 24) + ' 天';
        if (h > 0) return h + ' 時 ' + m + ' 分';
        return m + ' 分';
    }

    function _ahEnsurePoll() {
        if (_auctionPollTimer) return;
        _auctionPollTimer = setInterval(function () {
            var panel = document.getElementById('tab-auction');
            if (!panel || panel.classList.contains('hidden')) return;
            if (_auctionTab === 'browse') auctionRefreshBrowse(false);
            else if (_auctionTab === 'mine') auctionRefreshMine(false);
        }, 12000);
    }

    function auctionRefreshFees() {
        return _ahGet('fees').then(function (data) {
            if (data && data.ok) {
                _auctionFeesMeta = {
                    listFeeRate: data.listFeeRate,
                    listFeeMin: data.listFeeMin,
                    listFeeMax: data.listFeeMax,
                    buyFeeRate: data.buyFeeRate,
                    ttlMs: data.ttlMs,
                    maxPerAccount: data.maxPerAccount
                };
            }
            return data;
        });
    }

    function auctionRefreshBrowse(forceRender) {
        var q = encodeURIComponent(_auctionQuery || '');
        var acc = _ahAccount();
        var qs = 'list?q=' + q + '&page=1' + (acc ? ('&account=' + encodeURIComponent(acc)) : '');
        return _ahGet(qs).then(function (data) {
            if (data && data.ok) {
                _auctionListings = Array.isArray(data.listings) ? data.listings : [];
                if (data.fees) {
                    _auctionFeesMeta = Object.assign({}, _auctionFeesMeta || _auctionFeeDefaults, data.fees);
                }
            } else if (forceRender !== false) {
                _auctionListings = [];
            }
            if (forceRender !== false && _auctionTab === 'browse') renderAuctionTab();
            return data;
        });
    }

    function auctionRefreshMine(forceRender) {
        var account = _ahAccount();
        if (!account) {
            _auctionMine = [];
            _auctionClaims = [];
            if (forceRender !== false) renderAuctionTab();
            return Promise.resolve({ ok: false });
        }
        return _ahGet('mine?account=' + encodeURIComponent(account)).then(function (data) {
            if (data && data.ok) {
                _auctionMine = Array.isArray(data.listings) ? data.listings : [];
                _auctionClaims = Array.isArray(data.claims) ? data.claims : [];
            }
            if (forceRender !== false && (_auctionTab === 'mine' || _auctionTab === 'list')) renderAuctionTab();
            return data;
        });
    }

    function _ahFeeBannerHtml() {
        var meta = _auctionFeesMeta || _auctionFeeDefaults;
        var listPct = Math.round((meta.listFeeRate || 0.02) * 100);
        var buyPct = Math.round((meta.buyFeeRate || 0.05) * 100);
        return '<div class="text-xs text-slate-400 leading-relaxed border border-slate-700 rounded-lg p-2 bg-slate-900/60">' +
            '全服即時拍賣 · 上架費 <span class="text-amber-300 font-bold">' + listPct + '%</span>（最低 ' + _ahFmtGold(meta.listFeeMin) + '／最高 ' + _ahFmtGold(meta.listFeeMax) + '）' +
            ' · 購買手續費 <span class="text-amber-300 font-bold">' + buyPct + '%</span>（買家另付）' +
            ' · 上架期限 ' + Math.round((meta.ttlMs || 0) / 3600000) + ' 小時 · 每帳號最多 ' + (meta.maxPerAccount || 20) + ' 件' +
            '</div>';
    }

    function _ahBrowseHtml() {
        var rows = _auctionListings || [];
        var html = '';
        html += '<div class="flex gap-2 items-center">' +
            '<input id="ah-q" type="text" maxlength="40" placeholder="搜尋物品 ID／賣家…" value="' + _ahEsc(_auctionQuery) + '" ' +
            'class="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100 outline-none" ' +
            'onkeydown="if(event.key===\'Enter\'){auctionSearch();}">' +
            '<button type="button" class="btn px-3 py-1.5 text-sm font-bold" onclick="auctionSearch()">搜尋</button>' +
            '<button type="button" class="btn px-3 py-1.5 text-sm" onclick="auctionRefreshBrowse(true)">重新整理</button>' +
            '</div>';
        if (!rows.length) {
            html += '<div class="text-sm text-slate-500 py-6 text-center">目前沒有上架商品。</div>';
            return html;
        }
        rows.forEach(function (L) {
            if (!L) return;
            var fees = _ahCalcFees(L.price);
            var remain = _ahFmtRemain((L.expiresAt || 0) - Date.now());
            var isMine = !!L.isMine;
            html += '<div class="border border-slate-700 rounded-lg p-2.5 bg-slate-800/80 flex flex-col gap-1.5">' +
                '<div class="flex justify-between gap-2 items-start">' +
                _ahItemTitleHtml(L.item) +
                '<div class="text-amber-300 font-bold text-sm whitespace-nowrap">' + _ahFmtGold(L.price) + ' 金</div>' +
                '</div>' +
                '<div class="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">' +
                '<span>賣家 <span class="text-slate-200">' + _ahEsc(L.sellerName || '？') + '</span></span>' +
                '<span>剩餘 ' + remain + '</span>' +
                '<span>實付 <span class="text-yellow-300">' + _ahFmtGold(fees.totalBuy) + '</span>（含手續費 ' + _ahFmtGold(fees.buyFee) + '）</span>' +
                '</div>' +
                '<div class="flex justify-end">' +
                (isMine
                    ? '<span class="text-xs text-slate-500">自己的上架</span>'
                    : '<button type="button" class="btn px-3 py-1 text-sm font-bold text-emerald-200" style="border-color:#059669;background:linear-gradient(135deg,#064e3b,#065f46);" onclick="auctionBuy(\'' + _ahEsc(L.id) + '\')">購買</button>') +
                '</div></div>';
        });
        return html;
    }

    function _ahListableInv() {
        if (!player || !Array.isArray(player.inv)) return [];
        return player.inv.filter(function (it) {
            return _ahCanListItem(it).ok;
        });
    }

    function _ahListHtml() {
        var items = _ahListableInv();
        var html = '<div class="text-xs text-slate-400">選擇背包物品上架。上架時先扣上架手續費，商品由伺服器託管；下架不退手續費。</div>';
        if (!items.length) {
            html += '<div class="text-sm text-slate-500 py-6 text-center">背包沒有可上架的物品（鎖定／限時／不可販售除外）。</div>';
            return html;
        }
        items.slice(0, 80).forEach(function (it) {
            html += '<div class="border border-slate-700 rounded-lg p-2 bg-slate-800/70 flex items-center justify-between gap-2">' +
                _ahItemTitleHtml(it) +
                '<button type="button" class="btn px-3 py-1 text-sm font-bold text-sky-200 shrink-0" style="border-color:#0284c7;background:linear-gradient(135deg,#0c4a6e,#075985);" ' +
                'onclick="auctionPromptList(\'' + _ahEsc(it.uid) + '\')">上架</button></div>';
        });
        return html;
    }

    function _ahMineHtml() {
        var html = '';
        var claims = _auctionClaims || [];
        if (claims.length) {
            html += '<div class="border border-amber-800/60 rounded-lg p-2.5 bg-amber-950/30 flex flex-col gap-2">' +
                '<div class="flex justify-between items-center">' +
                '<span class="text-amber-200 font-bold text-sm">待領取（' + claims.length + '）</span>' +
                '<button type="button" class="btn px-3 py-1 text-sm font-bold" onclick="auctionClaimAll()">全部領取</button>' +
                '</div>';
            claims.forEach(function (c) {
                if (!c) return;
                var label = c.type === 'gold'
                    ? ('金幣 <span class="text-yellow-300 font-bold">' + _ahFmtGold(c.amount) + '</span>' + (c.buyerName ? (' · 買家 ' + _ahEsc(c.buyerName)) : ''))
                    : ('<span class="flex gap-2 items-center min-w-0">' + _ahIconHtml(c.item) + '<span class="min-w-0">物品 ' + _ahItemLabel(c.item) + ' <span class="text-slate-500">(' + _ahEsc(c.reason || '') + ')</span></span></span>');
                html += '<div class="flex justify-between items-center gap-2 text-sm">' +
                    '<div>' + label + '</div>' +
                    '<button type="button" class="btn px-2 py-0.5 text-xs" onclick="auctionClaimOne(\'' + _ahEsc(c.id) + '\')">領取</button></div>';
            });
            html += '</div>';
        }

        var rows = _auctionMine || [];
        if (!rows.length) {
            html += '<div class="text-sm text-slate-500 py-4 text-center">目前沒有自己的上架。</div>';
            return html;
        }
        rows.forEach(function (L) {
            if (!L) return;
            var remain = _ahFmtRemain((L.expiresAt || 0) - Date.now());
            html += '<div class="border border-slate-700 rounded-lg p-2.5 bg-slate-800/80 flex flex-col gap-1.5">' +
                '<div class="flex justify-between gap-2 items-start">' + _ahItemTitleHtml(L.item) +
                '<div class="text-amber-300 font-bold text-sm whitespace-nowrap">' + _ahFmtGold(L.price) + ' 金</div></div>' +
                '<div class="text-xs text-slate-400">剩餘 ' + remain + ' · 上架費已付 ' + _ahFmtGold(L.listFee) + '</div>' +
                '<div class="flex justify-end"><button type="button" class="btn px-3 py-1 text-sm" onclick="auctionCancel(\'' + _ahEsc(L.id) + '\')">下架取回</button></div></div>';
        });
        return html;
    }

    function renderAuctionTab() {
        var root = document.getElementById('tab-auction');
        if (!root) return;
        if (!_ahIsHttp()) {
            root.innerHTML = '<div class="text-sm text-slate-400 p-3">請透過伺服器網頁登入後使用全服拍賣行。</div>';
            return;
        }
        if (!_ahAccount()) {
            root.innerHTML = '<div class="text-sm text-slate-400 p-3">請先登入帳號。</div>';
            return;
        }
        _ahEnsurePoll();
        var tabs = [
            { k: 'browse', n: '瀏覽' },
            { k: 'list', n: '上架' },
            { k: 'mine', n: '我的／領取' }
        ];
        var html = '<div class="flex flex-col gap-2">';
        html += '<div class="text-base font-bold text-amber-200 tracking-wide">🏛 全服拍賣行</div>';
        html += _ahFeeBannerHtml();
        html += '<div class="flex gap-1.5 flex-wrap">';
        tabs.forEach(function (t) {
            var on = _auctionTab === t.k;
            html += '<button type="button" class="btn px-3 py-1 text-sm font-bold ' + (on ? 'ring-1 ring-amber-400/70' : '') + '" ' +
                'onclick="auctionSwitchSub(\'' + t.k + '\')">' + t.n +
                (t.k === 'mine' && _auctionClaims.length ? (' <span class="text-amber-300">(' + _auctionClaims.length + ')</span>') : '') +
                '</button>';
        });
        html += '</div>';
        html += '<div class="flex flex-col gap-2">';
        if (_auctionTab === 'browse') html += _ahBrowseHtml();
        else if (_auctionTab === 'list') html += _ahListHtml();
        else html += _ahMineHtml();
        html += '</div></div>';
        root.innerHTML = html;
    }

    function auctionSwitchSub(k) {
        _auctionTab = k === 'list' || k === 'mine' ? k : 'browse';
        if (_auctionTab === 'browse') auctionRefreshBrowse(true);
        else if (_auctionTab === 'mine') auctionRefreshMine(true);
        else renderAuctionTab();
    }

    function auctionSearch() {
        var el = document.getElementById('ah-q');
        _auctionQuery = el ? String(el.value || '').trim().slice(0, 40) : '';
        auctionRefreshBrowse(true);
    }

    function auctionPromptList(uidStr) {
        if (_auctionBusy) return;
        if (!player) return;
        var item = (player.inv || []).find(function (i) { return i && i.uid === uidStr; });
        if (!item) { if (typeof logSys === 'function') logSys('找不到物品。'); return; }
        var can = _ahCanListItem(item);
        if (!can.ok) { if (typeof logSys === 'function') logSys(can.reason); return; }

        var maxCnt = item.cnt || 1;
        var cnt = 1;
        if (maxCnt > 1) {
            var rawCnt = prompt('上架數量（持有 ' + maxCnt + '）', String(maxCnt));
            if (rawCnt === null) return;
            cnt = Math.floor(Number(rawCnt));
            if (!cnt || cnt < 1 || cnt > maxCnt) {
                if (typeof logSys === 'function') logSys('數量無效。');
                return;
            }
        }
        var rawPrice = prompt('設定單價（金幣）', '1000');
        if (rawPrice === null) return;
        var price = Math.floor(Number(rawPrice));
        if (!price || price < 1) {
            if (typeof logSys === 'function') logSys('價格無效。');
            return;
        }
        var fees = _ahCalcFees(price);
        var ok = confirm(
            '上架確認\n' +
            '價格：' + fees.price.toLocaleString() + ' 金\n' +
            '上架手續費：' + fees.listFee.toLocaleString() + ' 金（立即扣除，下架不退）\n' +
            '買家實付約：' + fees.totalBuy.toLocaleString() + ' 金（含購買手續費）\n' +
            '數量：' + cnt + '\n\n確定上架？'
        );
        if (!ok) return;
        if ((player.gold || 0) < fees.listFee) {
            if (typeof logSys === 'function') logSys('金幣不足，無法支付上架手續費 ' + fees.listFee.toLocaleString() + '。');
            return;
        }

        var snap = _ahSnapshotItem(item, cnt);
        var itemName = '';
        try {
            var d0 = (typeof DB !== 'undefined' && DB.items) ? DB.items[item.id] : null;
            itemName = d0 && d0.n ? String(d0.n) : String(item.id);
        } catch (e0) { itemName = String(item.id); }
        _auctionBusy = true;
        player.gold -= fees.listFee;
        if (!_ahRemoveInv(uidStr, cnt)) {
            player.gold += fees.listFee;
            _auctionBusy = false;
            if (typeof logSys === 'function') logSys('扣除物品失敗。');
            return;
        }
        try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}

        _ahPost('create', { price: fees.price, item: snap, itemName: itemName }).then(function (data) {
            _auctionBusy = false;
            if (!data || !data.ok) {
                // 回滾
                player.gold = (player.gold || 0) + fees.listFee;
                _ahGrantItem(snap);
                try { if (typeof updateUI === 'function') updateUI(); } catch (e2) {}
                try { if (typeof renderTabs === 'function') renderTabs(); } catch (e3) {}
                if (typeof logSys === 'function') logSys((data && data.message) || '上架失敗。');
                renderAuctionTab();
                return;
            }
            if (typeof logSys === 'function') logSys('<span class="text-amber-300">' + (data.message || '上架成功') + '</span>');
            try { if (typeof saveGame === 'function') saveGame(); } catch (e4) {}
            try { if (typeof renderTabs === 'function') renderTabs(); } catch (e5) {}
            _auctionTab = 'mine';
            auctionRefreshMine(true);
        });
    }

    function auctionBuy(listingId) {
        if (_auctionBusy || !listingId) return;
        var L = (_auctionListings || []).find(function (x) { return x && x.id === listingId; });
        var price = L ? L.price : 0;
        var fees = _ahCalcFees(price || (L && L.price) || 0);
        if (L) fees = _ahCalcFees(L.price);
        else {
            // 列表可能過期，仍嘗試買；費用以伺服器為準
            fees = null;
        }
        var preview = fees
            ? ('實付 ' + fees.totalBuy.toLocaleString() + ' 金（商品 ' + fees.price.toLocaleString() + '＋手續費 ' + fees.buyFee.toLocaleString() + '）')
            : '將依伺服器計算價格與手續費';
        if (!confirm('確定購買此商品？\n' + preview)) return;

        var need = fees ? fees.totalBuy : 0;
        if (fees && (player.gold || 0) < need) {
            if (typeof logSys === 'function') logSys('金幣不足（需要 ' + need.toLocaleString() + '）。');
            return;
        }

        _auctionBusy = true;
        _ahPost('buy', { listingId: listingId }).then(function (data) {
            _auctionBusy = false;
            if (!data || !data.ok) {
                if (typeof logSys === 'function') logSys((data && data.message) || '購買失敗。');
                auctionRefreshBrowse(true);
                return;
            }
            var total = Math.max(0, Math.floor(Number(data.totalPaid) || ((data.price || 0) + (data.buyFee || 0))));
            if ((player.gold || 0) < total) {
                // 理論上不該發生；若金幣中途變少，仍發放物品但記 log（伺服器已成交）
                if (typeof logSys === 'function') logSys('<span class="text-red-300">金幣不足但交易已成立，請確認存檔。應扣 ' + total.toLocaleString() + '</span>');
            }
            player.gold = Math.max(0, (player.gold || 0) - total);
            _ahGrantItem(data.item);
            if (typeof logSys === 'function') logSys('<span class="text-emerald-300">' + (data.message || '購買成功') + '</span>');
            try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
            try { if (typeof renderTabs === 'function') renderTabs(); } catch (e2) {}
            try { if (typeof saveGame === 'function') saveGame(); } catch (e3) {}
            auctionRefreshBrowse(true);
        });
    }

    function auctionCancel(listingId) {
        if (_auctionBusy || !listingId) return;
        if (!confirm('確定下架並取回物品？上架手續費不退還。')) return;
        _auctionBusy = true;
        _ahPost('cancel', { listingId: listingId }).then(function (data) {
            _auctionBusy = false;
            if (!data || !data.ok) {
                if (typeof logSys === 'function') logSys((data && data.message) || '下架失敗。');
                auctionRefreshMine(true);
                return;
            }
            _ahGrantItem(data.item);
            if (typeof logSys === 'function') logSys('<span class="text-sky-300">' + (data.message || '已下架') + '</span>');
            try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
            try { if (typeof renderTabs === 'function') renderTabs(); } catch (e2) {}
            try { if (typeof saveGame === 'function') saveGame(); } catch (e3) {}
            auctionRefreshMine(true);
        });
    }

    function _ahApplyClaims(claims) {
        if (!Array.isArray(claims) || !claims.length) return { gold: 0, items: 0 };
        var gold = 0, items = 0;
        claims.forEach(function (c) {
            if (!c) return;
            if (c.type === 'gold') {
                var amt = Math.max(0, Math.floor(Number(c.amount) || 0));
                player.gold = (player.gold || 0) + amt;
                gold += amt;
            } else if (c.type === 'item' && c.item) {
                _ahGrantItem(c.item);
                items += 1;
            }
        });
        return { gold: gold, items: items };
    }

    function auctionClaimOne(claimId) {
        if (_auctionBusy || !claimId) return;
        _auctionBusy = true;
        _ahPost('claim', { claimId: claimId }).then(function (data) {
            _auctionBusy = false;
            if (!data || !data.ok) {
                if (typeof logSys === 'function') logSys((data && data.message) || '領取失敗。');
                auctionRefreshMine(true);
                return;
            }
            var r = _ahApplyClaims(data.claims);
            if (typeof logSys === 'function') {
                logSys('<span class="text-amber-300">已領取' +
                    (r.gold ? (' 金幣 ' + r.gold.toLocaleString()) : '') +
                    (r.items ? (' 物品 ' + r.items + ' 件') : '') +
                    '。</span>');
            }
            try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
            try { if (typeof renderTabs === 'function') renderTabs(); } catch (e2) {}
            try { if (typeof saveGame === 'function') saveGame(); } catch (e3) {}
            auctionRefreshMine(true);
        });
    }

    function auctionClaimAll() {
        if (_auctionBusy) return;
        _auctionBusy = true;
        _ahPost('claim', {}).then(function (data) {
            _auctionBusy = false;
            if (!data || !data.ok) {
                if (typeof logSys === 'function') logSys((data && data.message) || '領取失敗。');
                auctionRefreshMine(true);
                return;
            }
            var r = _ahApplyClaims(data.claims);
            if (!r.gold && !r.items) {
                if (typeof logSys === 'function') logSys('沒有待領取內容。');
            } else if (typeof logSys === 'function') {
                logSys('<span class="text-amber-300">已領取' +
                    (r.gold ? (' 金幣 ' + r.gold.toLocaleString()) : '') +
                    (r.items ? ('、物品 ' + r.items + ' 件') : '') +
                    '。</span>');
            }
            try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
            try { if (typeof renderTabs === 'function') renderTabs(); } catch (e2) {}
            try { if (typeof saveGame === 'function') saveGame(); } catch (e3) {}
            auctionRefreshMine(true);
        });
    }

    function auctionOnOpen() {
        auctionRefreshFees().then(function () {
            if (_auctionTab === 'mine') return auctionRefreshMine(true);
            if (_auctionTab === 'list') { renderAuctionTab(); return auctionRefreshMine(false); }
            return auctionRefreshBrowse(true);
        });
        // 背景順便拉待領取
        auctionRefreshMine(false);
    }

    // 進遊戲後偶爾檢查待領取（賣出金幣／過期退回）
    var _ahClaimHintTimer = null;
    function auctionStartClaimHint() {
        if (_ahClaimHintTimer) return;
        _ahClaimHintTimer = setInterval(function () {
            if (!_ahAccount() || !_ahIsHttp()) return;
            if (typeof player === 'undefined' || !player || !player.cls) return;
            _ahGet('claims?account=' + encodeURIComponent(_ahAccount())).then(function (data) {
                if (!data || !data.ok) return;
                var n = (data.claims || []).length;
                _auctionClaims = data.claims || [];
                var btn = document.getElementById('btn-auction');
                if (btn) {
                    var dot = document.getElementById('btn-auction-dot');
                    if (n > 0) {
                        if (!dot) {
                            dot = document.createElement('span');
                            dot.id = 'btn-auction-dot';
                            dot.className = 'logtab-dot';
                            btn.appendChild(dot);
                        }
                        dot.classList.remove('hidden');
                    } else if (dot) {
                        dot.classList.add('hidden');
                    }
                }
            });
        }, 45000);
    }

    window.renderAuctionTab = renderAuctionTab;
    window.auctionSwitchSub = auctionSwitchSub;
    window.auctionSearch = auctionSearch;
    window.auctionRefreshBrowse = auctionRefreshBrowse;
    window.auctionRefreshMine = auctionRefreshMine;
    window.auctionPromptList = auctionPromptList;
    window.auctionBuy = auctionBuy;
    window.auctionCancel = auctionCancel;
    window.auctionClaimOne = auctionClaimOne;
    window.auctionClaimAll = auctionClaimAll;
    window.auctionOnOpen = auctionOnOpen;
    window.auctionStartClaimHint = auctionStartClaimHint;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', auctionStartClaimHint);
    } else {
        auctionStartClaimHint();
    }
})();

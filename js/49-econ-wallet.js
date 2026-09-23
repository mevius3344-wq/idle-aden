// ===== 🌐 P5a 經濟權威：錢包同步＋商店購買 =====
(function () {
    'use strict';

    var _econOn = null;
    var _econCheckedAt = 0;
    var _pulling = false;

    function econHttpOk() {
        try {
            var p = String(location.protocol || '');
            return p === 'http:' || p === 'https:';
        } catch (e) { return false; }
    }

    function econIsLocalHost() {
        try {
            var h = String(location.hostname || '').toLowerCase();
            return h === 'localhost' || h === '127.0.0.1' || h === '';
        } catch (e) { return true; }
    }

    function econAccount() {
        try {
            if (window.__fb5AuthAccount) return String(window.__fb5AuthAccount || '').trim();
            if (typeof GameAccountAuth !== 'undefined' && GameAccountAuth && typeof GameAccountAuth.currentAccount === 'function') {
                return String(GameAccountAuth.currentAccount() || '').trim();
            }
        } catch (e) {}
        return '';
    }

    function econIdentity() {
        if (typeof player === 'undefined' || !player || !player.cls) return null;
        var account = econAccount();
        if (!account || account.toLowerCase() === 'guest') return null;
        return {
            account: account,
            slot: (typeof currentSlot !== 'undefined' ? currentSlot : 1),
            name: player.name || '未命名'
        };
    }

    /**
     * 本機預設關（可 __ECON_AUTH=true 強制開）
     * 部署：預設開，/api/econ/status 可關掉
     */
    function econAuthActive() {
        try {
            if (typeof window !== 'undefined' && window.__DEV_OFFLINE) return false;
        } catch (e0) {}
        try {
            if (typeof window !== 'undefined' && window.__ECON_AUTH === false) return false;
            if (typeof window !== 'undefined' && window.__ECON_AUTH === true) return true;
        } catch (e1) {}
        if (econIsLocalHost()) return false;
        if (_econOn === false) return false;
        if (_econOn === true) return true;
        // 線上尚未探測完成：樂觀視為開（失敗再退回本地）
        econProbeStatus();
        return true;
    }

    function econProbeStatus() {
        if (!econHttpOk()) {
            _econOn = false;
            return;
        }
        if (Date.now() - _econCheckedAt < 30000 && _econOn != null) return;
        _econCheckedAt = Date.now();
        fetch('/api/econ/status', { method: 'GET', cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                _econOn = !!(d && d.ok && d.econAuth);
            })
            .catch(function () {
                // 探測失敗：線上維持樂觀 true，本機 false
                if (econIsLocalHost()) _econOn = false;
            });
    }

    function econApplyWallet(data) {
        if (!data || typeof player === 'undefined' || !player) return;
        if (data.gold != null && Number.isFinite(Number(data.gold))) {
            player.gold = Math.max(0, Math.floor(Number(data.gold)));
        }
        if (data.goldAfter != null && Number.isFinite(Number(data.goldAfter))) {
            player.gold = Math.max(0, Math.floor(Number(data.goldAfter)));
        }
        if (data.walletRev != null && Number.isFinite(Number(data.walletRev))) {
            player._walletRev = Math.max(0, Math.floor(Number(data.walletRev)));
        }
        try {
            if (typeof updateUI === 'function') updateUI();
        } catch (e) {}
    }

    /** 🌐 v3.8.499：統一經濟錯誤文案（含 walletRev 衝突） */
    function econErrorMessage(data, fallback) {
        if (!data) return fallback || '操作失敗。';
        var e = String(data.error || '');
        if (data.message && (e === 'gold_short' || e === 'no_save' || e === 'unknown_item' || e === 'no_sell' || e === 'daily_cap')) {
            return String(data.message);
        }
        if (e === 'gold_short') return '金幣不足（雲端餘額）。請確認已同步存檔。';
        if (e === 'no_save') return '雲端尚無此角色存檔，請先存檔後再試。';
        if (e === 'conflict') return '雲端存檔忙碌或版本衝突，已嘗試同步金幣，請再試一次。';
        if (e === 'auth_required' || e === 'session_invalid') return '登入已失效，請重新登入後再操作。';
        if (e === 'account_mismatch') return '帳號與登入令牌不符，請重新登入。';
        if (e === 'need_account') return '請先登入帳號。';
        if (e === 'item_missing' || e === 'item_short') return '雲端背包找不到此物品（或數量不足），請先存檔同步。';
        if (e === 'unknown_item') return '此商品尚無伺服器價目。';
        if (e === 'no_sell' || e === 'locked' || e === 'rental') return data.message || '此物品無法販售。';
        if (e === 'network') return '無法連線經濟伺服器。';
        if (e === 'econ_off') return '經濟權威未啟用。';
        return data.message || fallback || '操作失敗。';
    }

    function econAttachWalletRev(body) {
        body = body || {};
        try {
            if (typeof player !== 'undefined' && player && player._walletRev != null) {
                body.walletRev = Math.max(0, Math.floor(Number(player._walletRev) || 0));
            }
        } catch (e) {}
        return body;
    }

    function econLogErr(data, fallback) {
        var msg = econErrorMessage(data, fallback);
        try {
            if (typeof logSys === 'function') logSys('<span class="text-red-400">' + msg + '</span>');
        } catch (e) {}
        return msg;
    }

    function rtWalletPull() {
        if (!econAuthActive()) return Promise.resolve({ ok: false, error: 'econ_off' });
        var id = econIdentity();
        if (!id) return Promise.resolve({ ok: false, error: 'need_account' });
        var auth = (typeof anticheatAuthExtras === 'function') ? anticheatAuthExtras() : {};
        if (!auth.authToken) return Promise.resolve({ ok: false, error: 'auth_required' });
        if (_pulling) return Promise.resolve({ ok: false, error: 'busy' });
        _pulling = true;
        var q =
            '?account=' + encodeURIComponent(id.account) +
            '&slot=' + encodeURIComponent(String(id.slot)) +
            '&authToken=' + encodeURIComponent(String(auth.authToken || '')) +
            '&sessionId=' + encodeURIComponent(String(auth.sessionId || ''));
        return fetch('/api/wallet' + q, { method: 'GET', cache: 'no-store' })
            .then(function (res) {
                return res.json().then(function (data) {
                    if (data && data.ok) econApplyWallet(data);
                    return data || { ok: false };
                });
            })
            .catch(function () {
                return { ok: false, error: 'network' };
            })
            .then(function (r) {
                _pulling = false;
                return r;
            });
    }

    function rtShopBuy(itemId, qty) {
        if (!econAuthActive()) return Promise.resolve({ ok: false, error: 'econ_off' });
        var id = econIdentity();
        if (!id) return Promise.resolve({ ok: false, error: 'need_account', message: '請先登入帳號。' });
        var auth = (typeof anticheatAuthExtras === 'function') ? anticheatAuthExtras() : {};
        if (!auth.authToken) {
            return Promise.resolve({ ok: false, error: 'auth_required', message: '登入令牌失效，請重新登入。' });
        }
        var body = econAttachWalletRev(Object.assign({}, id, auth, {
            itemId: String(itemId || ''),
            qty: Math.max(1, Math.floor(Number(qty) || 1))
        }));
        return fetch('/api/shop/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
            .then(function (res) {
                return res.json().then(function (data) {
                    if (data && typeof data === 'object') data._http = res.status;
                    return data;
                });
            })
            .catch(function () {
                return { ok: false, error: 'network', message: '無法連線經濟伺服器。' };
            });
    }

    function rtShopBuyApplyLocal(data, itemId) {
        econApplyWallet(data);
        var id = String((data && data.itemId) || itemId || '');
        var gained = Math.max(1, Math.floor(Number((data && data.gained) != null ? data.gained : 1) || 1));
        if (!id || typeof player === 'undefined' || !player) return;
        if (!Array.isArray(player.inv)) player.inv = [];
        var stack = null;
        for (var i = 0; i < player.inv.length; i++) {
            var it = player.inv[i];
            if (it && it.id === id && !(it.en > 0) && !it.attr && !it.anc && !it.bless && !it.seteff) {
                stack = it;
                break;
            }
        }
        if (stack) {
            stack.cnt = Math.max(1, Math.floor(Number(stack.cnt) || 1)) + gained;
        } else {
            var uidFn = (typeof uid === 'function') ? uid : function () { return 'e' + Date.now(); };
            player.inv.push({
                id: id,
                uid: (data && data.uid) || uidFn(),
                cnt: gained,
                en: 0,
                bless: false,
                anc: false,
                attr: false,
                seteff: false,
                lock: false,
                junk: false
            });
        }
        try {
            if (typeof renderTabs === 'function') renderTabs(true);
            if (typeof updateUI === 'function') updateUI();
            if (typeof renderShopItems === 'function') renderShopItems();
        } catch (e) {}
    }

    /** @returns {Promise<null|boolean>} null=走舊路徑；true/false=權威結果 */
    function rtShopBuySecure(itemId, qty) {
        if (!econAuthActive()) return Promise.resolve(null);
        function handle(data, retried) {
            if (data && data.error === 'econ_off') return null;
            if (!data || !data.ok) {
                // 網路／503：退回本地舊路徑
                if (data && (data.error === 'network' || data.error === 'econ_off' || data._http === 503)) {
                    return null;
                }
                // 衝突：拉一次錢包後重試一次
                if (data && data.error === 'conflict' && !retried) {
                    return rtWalletPull().then(function () {
                        return rtShopBuy(itemId, qty).then(function (d2) { return handle(d2, true); });
                    });
                }
                econLogErr(data, '購買失敗。');
                return false;
            }
            rtShopBuyApplyLocal(data, itemId);
            try {
                var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[itemId] : null;
                var n = (d && d.n) || itemId;
                if (itemId === 'wpn_5') n = '箭';
                if (itemId === 'wpn_22') n = '銀箭';
                var g = Math.max(1, Math.floor(Number(data.gained) || 1));
                var suffix = (itemId === 'wpn_5' || itemId === 'wpn_22') ? '根' : '';
                if (typeof logSys === 'function') {
                    logSys('購買了 ' + n + (g > 1 ? ' (' + g.toLocaleString() + suffix + ')' : '') + '。');
                }
            } catch (e2) {}
            return true;
        }
        return rtShopBuy(itemId, qty).then(function (data) { return handle(data, false); });
    }

    /** @param {Array<{uid:string,qty:number}>|string} linesOrUid @param {number} [qty] */
    function rtShopSell(linesOrUid, qty) {
        if (!econAuthActive()) return Promise.resolve({ ok: false, error: 'econ_off' });
        var id = econIdentity();
        if (!id) return Promise.resolve({ ok: false, error: 'need_account', message: '請先登入帳號。' });
        var auth = (typeof anticheatAuthExtras === 'function') ? anticheatAuthExtras() : {};
        if (!auth.authToken) {
            return Promise.resolve({ ok: false, error: 'auth_required', message: '登入令牌失效，請重新登入。' });
        }
        var body = econAttachWalletRev(Object.assign({}, id, auth));
        if (Array.isArray(linesOrUid)) {
            body.items = linesOrUid.map(function (row) {
                return {
                    uid: String((row && row.uid) || ''),
                    qty: Math.max(1, Math.floor(Number((row && row.qty) != null ? row.qty : 1) || 1))
                };
            }).filter(function (r) { return r.uid; });
        } else {
            body.uid = String(linesOrUid || '');
            body.qty = Math.max(1, Math.floor(Number(qty) || 1));
        }
        return fetch('/api/shop/sell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
            .then(function (res) {
                return res.json().then(function (data) {
                    if (data && typeof data === 'object') data._http = res.status;
                    return data;
                });
            })
            .catch(function () {
                return { ok: false, error: 'network', message: '無法連線經濟伺服器。' };
            });
    }

    function rtShopSellApplyLocal(data) {
        econApplyWallet(data);
        if (!data || !Array.isArray(data.sold) || typeof player === 'undefined' || !player) return;
        if (!Array.isArray(player.inv)) player.inv = [];
        var gone = {};
        for (var i = 0; i < data.sold.length; i++) {
            var s = data.sold[i];
            if (!s || !s.uid) continue;
            var qty = Math.max(1, Math.floor(Number(s.qty) || 1));
            var it = null;
            for (var j = 0; j < player.inv.length; j++) {
                if (player.inv[j] && String(player.inv[j].uid) === String(s.uid)) {
                    it = player.inv[j];
                    break;
                }
            }
            if (!it) continue;
            var have = Math.max(1, Math.floor(Number(it.cnt) || 1));
            var left = have - qty;
            if (left <= 0) gone[s.uid] = true;
            else {
                it.cnt = left;
                it.junk = false;
                try { delete it.junkSince; delete it._autoSellQty; } catch (e0) {}
            }
        }
        if (Object.keys(gone).length) {
            player.inv = player.inv.filter(function (x) { return x && !gone[x.uid]; });
        }
        try {
            if (typeof renderTabs === 'function') renderTabs();
            if (typeof updateUI === 'function') updateUI();
        } catch (e1) {}
    }

    /**
     * @returns {Promise<null|boolean|{ok:true,credit:number,sold:Array}>}
     * null=走舊路徑；false=權威拒絕；物件=成功
     */
    function rtShopSellSecure(linesOrUid, qty) {
        if (!econAuthActive()) return Promise.resolve(null);
        function handle(data, retried) {
            if (data && data.error === 'econ_off') return null;
            if (!data || !data.ok) {
                if (data && (data.error === 'network' || data.error === 'econ_off' || data._http === 503)) {
                    return null;
                }
                if (data && data.error === 'conflict' && !retried) {
                    return rtWalletPull().then(function () {
                        return rtShopSell(linesOrUid, qty).then(function (d2) { return handle(d2, true); });
                    });
                }
                econLogErr(data, '販售失敗。');
                return false;
            }
            rtShopSellApplyLocal(data);
            return {
                ok: true,
                credit: Math.max(0, Math.floor(Number(data.credit) || 0)),
                sold: data.sold || []
            };
        }
        return rtShopSell(linesOrUid, qty).then(function (data) { return handle(data, false); });
    }

    // ─── 🌐 P5c 倉庫權威 ───
    function econAttachWhRev(body) {
        body = body || {};
        try {
            if (typeof loadWarehouse === 'function') {
                var w = loadWarehouse();
                if (w && w._whRev != null) {
                    body.whRev = Math.max(0, Math.floor(Number(w._whRev) || 0));
                }
            }
        } catch (e) {}
        return body;
    }

    function rtWarehouseWriteLocal(wh) {
        if (!wh || typeof wh !== 'object') return false;
        try {
            if (typeof saveWarehouse !== 'function') return false;
            var payload = {
                items: Array.isArray(wh.items) ? wh.items : [],
                gold: Math.max(0, Math.floor(Number(wh.gold) || 0)),
                _whRev: Math.max(0, Math.floor(Number(wh._whRev) || 0))
            };
            // 權威路徑：寫本機桶，saveWarehouse 在 econAuth 下不會再 PUT shared
            try { if (typeof _whLoadOk !== 'undefined') _whLoadOk = true; } catch (e0) {}
            return !!saveWarehouse(payload);
        } catch (e1) {
            return false;
        }
    }

    function rtWarehouseApplyMove(data, dir, kind, uid, qty, amount) {
        if (!data || !data.ok) return;
        econApplyWallet(data);
        if (data.warehouse) rtWarehouseWriteLocal(data.warehouse);
        else if (data.whGold != null && typeof loadWarehouse === 'function' && typeof saveWarehouse === 'function') {
            try {
                var w = loadWarehouse();
                w.gold = Math.max(0, Math.floor(Number(data.whGold) || 0));
                if (data.whRev != null) w._whRev = Math.max(0, Math.floor(Number(data.whRev) || 0));
                saveWarehouse(w);
            } catch (eW) {}
        }
        // 背包：依同口径本地轉移（與伺服器公式對齊）；金幣已由 econApplyWallet 套用
        try {
            if (kind === 'gold') {
                // gold already applied via wallet + warehouse write
            } else if (kind === 'item' && typeof player !== 'undefined' && player && uid) {
                if (dir === 'in') {
                    if (!Array.isArray(player.inv)) player.inv = [];
                    var idx = player.inv.findIndex(function (i) { return i && String(i.uid) === String(uid); });
                    if (idx >= 0) {
                        var it = player.inv[idx];
                        var total = Math.max(1, Math.floor(Number(it.cnt) || 1));
                        var n = Math.max(1, Math.min(total, Math.floor(Number(qty) || total)));
                        if (n >= total) player.inv.splice(idx, 1);
                        else it.cnt = total - n;
                    }
                } else if (dir === 'out' && data.moved) {
                    // 伺服器回傳 moved；倉庫已覆寫。背包補上：若本機還缺則依 moved 補一件簡易堆疊
                    if (!Array.isArray(player.inv)) player.inv = [];
                    var mid = String(data.moved.id || '');
                    var mqty = Math.max(1, Math.floor(Number(data.moved.qty) || 1));
                    var muid = String(data.moved.uid || '');
                    if (mid) {
                        var have = player.inv.some(function (x) { return x && String(x.uid) === muid; });
                        if (!have) {
                            var stack = null;
                            if (typeof _whStackFind === 'function') {
                                stack = _whStackFind(player.inv, { id: mid, en: 0 });
                            }
                            // 簡化：直接 push；完整詞綴以倉庫覆寫為準、背包用 moved 最小欄位
                            if (!stack) {
                                var uidFn = (typeof uid === 'function') ? uid : function () { return 'w' + Date.now(); };
                                player.inv.push({
                                    id: mid,
                                    uid: muid || uidFn(),
                                    cnt: mqty,
                                    en: 0,
                                    bless: false,
                                    anc: false,
                                    attr: false,
                                    seteff: false,
                                    lock: false,
                                    junk: false
                                });
                            } else if (typeof _whStackAbsorb === 'function') {
                                _whStackAbsorb(stack, null, mqty);
                            } else {
                                stack.cnt = Math.max(1, Math.floor(Number(stack.cnt) || 1)) + mqty;
                            }
                        }
                    }
                }
            }
        } catch (eInv) {}
        try {
            if (typeof saveGame === 'function') saveGame();
            if (typeof renderTabs === 'function') renderTabs(true);
            if (typeof updateUI === 'function') updateUI();
            var el = document.getElementById('warehouse-window-content') || document.getElementById('interaction-content');
            if (el && typeof renderWarehouseNPC === 'function') renderWarehouseNPC(el);
        } catch (eUi) {}
    }

    function rtWarehouseMove(opts) {
        if (!econAuthActive()) return Promise.resolve({ ok: false, error: 'econ_off' });
        var id = econIdentity();
        if (!id) return Promise.resolve({ ok: false, error: 'need_account', message: '請先登入帳號。' });
        var auth = (typeof anticheatAuthExtras === 'function') ? anticheatAuthExtras() : {};
        if (!auth.authToken) {
            return Promise.resolve({ ok: false, error: 'auth_required', message: '登入令牌失效，請重新登入。' });
        }
        var classic = !!(typeof player !== 'undefined' && player && player.classicMode);
        var body = econAttachWhRev(econAttachWalletRev(Object.assign({}, id, auth, {
            dir: String((opts && opts.dir) || ''),
            kind: String((opts && opts.kind) || 'item'),
            uid: opts && opts.uid != null ? String(opts.uid) : undefined,
            qty: opts && opts.qty != null ? Math.max(1, Math.floor(Number(opts.qty) || 1)) : undefined,
            amount: opts && opts.amount != null ? Math.max(0, Math.floor(Number(opts.amount) || 0)) : undefined,
            classic: classic,
            classicMode: classic
        })));
        return fetch('/api/warehouse/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
            .then(function (res) {
                return res.json().then(function (data) {
                    if (data && typeof data === 'object') data._http = res.status;
                    return data;
                });
            })
            .catch(function () {
                return { ok: false, error: 'network', message: '無法連線經濟伺服器。' };
            });
    }

    function rtWarehousePull() {
        if (!econAuthActive()) return Promise.resolve({ ok: false, error: 'econ_off' });
        var id = econIdentity();
        if (!id) return Promise.resolve({ ok: false, error: 'need_account' });
        var auth = (typeof anticheatAuthExtras === 'function') ? anticheatAuthExtras() : {};
        if (!auth.authToken) return Promise.resolve({ ok: false, error: 'auth_required' });
        var classic = !!(typeof player !== 'undefined' && player && player.classicMode);
        var q =
            '?account=' + encodeURIComponent(id.account) +
            '&classic=' + (classic ? '1' : '0') +
            '&authToken=' + encodeURIComponent(String(auth.authToken || '')) +
            '&sessionId=' + encodeURIComponent(String(auth.sessionId || ''));
        return fetch('/api/warehouse' + q, { method: 'GET', cache: 'no-store' })
            .then(function (res) {
                return res.json().then(function (data) {
                    if (data && data.ok && data.warehouse) rtWarehouseWriteLocal(data.warehouse);
                    else if (data && data.ok && data.items) {
                        rtWarehouseWriteLocal({ items: data.items, gold: data.gold, _whRev: data.whRev });
                    }
                    return data || { ok: false };
                });
            })
            .catch(function () {
                return { ok: false, error: 'network' };
            });
    }

    /**
     * @returns {Promise<null|boolean>} null=走舊本地路徑；true=權威成功；false=權威拒絕
     */
    function rtWarehouseMoveSecure(opts) {
        if (!econAuthActive()) return Promise.resolve(null);
        var dir = String((opts && opts.dir) || '');
        var kind = String((opts && opts.kind) || 'item');
        var uidv = opts && opts.uid;
        var qty = opts && opts.qty;
        var amount = opts && opts.amount;
        function handle(data, retried) {
            if (data && data.error === 'econ_off') return null;
            if (!data || !data.ok) {
                if (data && (data.error === 'network' || data.error === 'econ_off' || data._http === 503)) {
                    return null;
                }
                if (data && data.error === 'conflict' && !retried) {
                    return Promise.all([rtWalletPull(), rtWarehousePull()]).then(function () {
                        return rtWarehouseMove(opts).then(function (d2) { return handle(d2, true); });
                    });
                }
                econLogErr(data, '倉庫操作失敗。');
                return false;
            }
            // 權威成功：以伺服器倉庫為準；背包依本地轉移再 saveGame
            if (kind === 'item' && dir === 'in') {
                // 先套倉庫＋金幣，再本地扣背包（與伺服器一致）
                econApplyWallet(data);
                if (data.warehouse) rtWarehouseWriteLocal(data.warehouse);
                try {
                    if (!Array.isArray(player.inv)) player.inv = [];
                    var idx = player.inv.findIndex(function (i) { return i && String(i.uid) === String(uidv); });
                    if (idx >= 0) {
                        var it = player.inv[idx];
                        var total = Math.max(1, Math.floor(Number(it.cnt) || 1));
                        var n = Math.max(1, Math.min(total, Math.floor(Number(qty) || total)));
                        if (n >= total) player.inv.splice(idx, 1);
                        else it.cnt = total - n;
                    }
                    if (typeof saveGame === 'function') saveGame();
                } catch (eIn) {}
            } else if (kind === 'item' && dir === 'out') {
                econApplyWallet(data);
                if (data.warehouse) rtWarehouseWriteLocal(data.warehouse);
                try {
                    // 用伺服器回傳的 moved 補背包（避免本機詞綴殘缺）
                    if (!Array.isArray(player.inv)) player.inv = [];
                    var moved = data.moved || {};
                    var addId = String(moved.id || '');
                    var addQty = Math.max(1, Math.floor(Number(moved.qty) || 1));
                    var addUid = String(moved.uid || '');
                    if (addId) {
                        // 從本機舊倉庫快照找完整物件（若還在記憶體）較佳——否則用最小欄位
                        var full = null;
                        try {
                            // moved 可能只有 id；倉庫已更新不含此件。用 opts._itemSnap 若有
                            full = opts && opts._itemSnap ? JSON.parse(JSON.stringify(opts._itemSnap)) : null;
                        } catch (eS) { full = null; }
                        if (full) {
                            full.uid = addUid || full.uid;
                            full.cnt = addQty;
                            if (typeof _whClearJunkState === 'function') _whClearJunkState(full);
                            var st = typeof _whStackFind === 'function' ? _whStackFind(player.inv, full) : null;
                            if (st && typeof _whStackAbsorb === 'function') _whStackAbsorb(st, full, addQty);
                            else player.inv.push(full);
                        } else {
                            var uidFn = (typeof uid === 'function') ? uid : function () { return 'w' + Date.now(); };
                            player.inv.push({
                                id: addId, uid: addUid || uidFn(), cnt: addQty,
                                en: 0, bless: false, anc: false, attr: false, seteff: false, lock: false, junk: false
                            });
                        }
                    }
                    if (typeof saveGame === 'function') saveGame();
                } catch (eOut) {}
            } else if (kind === 'gold') {
                econApplyWallet(data);
                if (data.warehouse) rtWarehouseWriteLocal(data.warehouse);
                try { if (typeof saveGame === 'function') saveGame(); } catch (eG) {}
            }
            try {
                if (typeof renderTabs === 'function') renderTabs(true);
                if (typeof updateUI === 'function') updateUI();
                var el = document.getElementById('warehouse-window-content') || document.getElementById('interaction-content');
                if (el && typeof renderWarehouseNPC === 'function') renderWarehouseNPC(el);
            } catch (eUi) {}
            return true;
        }
        return rtWarehouseMove(opts).then(function (data) { return handle(data, false); });
    }

    // 擴充錯誤文案
    var _econErrPrev = econErrorMessage;
    econErrorMessage = function (data, fallback) {
        if (data) {
            var e = String(data.error || '');
            if (e === 'wh_full') return data.message || '倉庫已滿。';
            if (e === 'wh_gold_short') return data.message || '倉庫金幣不足。';
            if (e === 'no_store') return data.message || '此物品無法存入倉庫。';
            if (e === 'warehouse_auth') return data.message || '倉庫請使用存／領操作。';
            if (e === 'unknown_sink') return data.message || '未知的支出類型。';
        }
        return _econErrPrev(data, fallback);
    };

    // ─── 🌐 Sprint3：白名單支出 ───
    function rtEconSink(kind, qty) {
        if (!econAuthActive()) return Promise.resolve({ ok: false, error: 'econ_off' });
        var id = econIdentity();
        if (!id) return Promise.resolve({ ok: false, error: 'need_account', message: '請先登入帳號。' });
        var auth = (typeof anticheatAuthExtras === 'function') ? anticheatAuthExtras() : {};
        if (!auth.authToken) {
            return Promise.resolve({ ok: false, error: 'auth_required', message: '登入令牌失效，請重新登入。' });
        }
        var body = econAttachWalletRev(Object.assign({}, id, auth, {
            kind: String(kind || ''),
            qty: Math.max(1, Math.floor(Number(qty) || 1))
        }));
        return fetch('/api/econ/sink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
            .then(function (res) {
                return res.json().then(function (data) {
                    if (data && typeof data === 'object') data._http = res.status;
                    return data;
                });
            })
            .catch(function () {
                return { ok: false, error: 'network', message: '無法連線經濟伺服器。' };
            });
    }

    /**
     * @returns {Promise<null|boolean>} null=走舊本地扣款；true=權威成功；false=權威拒絕
     */
    function rtEconSinkSecure(kind, qty) {
        if (!econAuthActive()) return Promise.resolve(null);
        function handle(data, retried) {
            if (data && data.error === 'econ_off') return null;
            if (!data || !data.ok) {
                if (data && (data.error === 'network' || data.error === 'econ_off' || data._http === 503)) {
                    return null;
                }
                if (data && data.error === 'conflict' && !retried) {
                    return rtWalletPull().then(function () {
                        return rtEconSink(kind, qty).then(function (d2) { return handle(d2, true); });
                    });
                }
                econLogErr(data, '支出失敗。');
                return false;
            }
            econApplyWallet(data);
            try {
                if (typeof saveGame === 'function') saveGame();
                if (typeof updateUI === 'function') updateUI();
            } catch (eS) {}
            return true;
        }
        return rtEconSink(kind, qty).then(function (data) { return handle(data, false); });
    }

    window.econAuthActive = econAuthActive;
    window.rtWalletPull = rtWalletPull;
    window.rtShopBuy = rtShopBuy;
    window.rtShopBuySecure = rtShopBuySecure;
    window.rtShopSell = rtShopSell;
    window.rtShopSellSecure = rtShopSellSecure;
    window.rtShopSellApplyLocal = rtShopSellApplyLocal;
    window.rtWarehouseMove = rtWarehouseMove;
    window.rtWarehouseMoveSecure = rtWarehouseMoveSecure;
    window.rtWarehousePull = rtWarehousePull;
    window.rtWarehouseWriteLocal = rtWarehouseWriteLocal;
    window.rtEconSink = rtEconSink;
    window.rtEconSinkSecure = rtEconSinkSecure;
    window.econProbeStatus = econProbeStatus;
    window.econErrorMessage = econErrorMessage;
    window.econApplyWallet = econApplyWallet;

    try {
        if (document.readyState === 'complete') econProbeStatus();
        else window.addEventListener('load', function () { econProbeStatus(); });
    } catch (eL) {}
})();

// ================= 🤝 玩家即時組隊（線上邀請／成員／同圖分享經驗金幣／跟隨隊長）=================
// 伺服器：/api/party/*（記憶體房間）；隊伍頻道改走線上並帶 partyId。
(function () {
    'use strict';

    var RT_PARTY_SHARE_EXP = 0.5;
    var RT_PARTY_SHARE_GOLD = 0.35;
    var RT_PARTY_LV_RANGE = 25;
    var RT_HEARTBEAT_MS = 4000;

    var _rtParty = null;
    var _rtPartyKey = '';
    var _rtPartySeq = 0;
    var _rtPartyInvites = [];
    var _rtPartyPolling = false;
    var _rtPartyAbort = null;
    var _rtPartyHbTimer = null;
    var _rtPartyUiSig = '';
    var _rtPartySeenShare = Object.create(null);
    var _rtPartyAccShare = { exp: 0, gold: 0, t: 0 };
    var _rtPartyOnlineCache = [];
    var _rtPartyOnlineAt = 0;
    var _rtPartyOnlineFetch = null;
    var _rtPartyListCache = [];
    var _rtPartyListAt = 0;
    var _rtPartyListFetch = null;
    var _rtPartyApplications = [];
    var _rtPartyInviteDraft = '';
    var _rtPartySearchTimer = null;

    function rtPartyEsc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    function rtPartyIsHttp() {
        try {
            var p = String(location.protocol || '');
            return p === 'http:' || p === 'https:';
        } catch (e) { return false; }
    }

    function rtPartyAccount() {
        try {
            if (typeof window !== 'undefined' && window.__fb5AuthAccount) return String(window.__fb5AuthAccount || '').trim();
            if (typeof GameAccountAuth !== 'undefined' && GameAccountAuth && typeof GameAccountAuth.currentAccount === 'function')
                return String(GameAccountAuth.currentAccount() || '').trim();
        } catch (e) {}
        return '';
    }

    function rtPartyMapName(id) {
        try {
            if (typeof mapDisplayName === 'function') {
                var n = mapDisplayName(id);
                if (n) return n;
            }
            if (typeof mapEntryOf === 'function') {
                var e = mapEntryOf(id);
                if (e && e.t) return e.t;
            }
        } catch (e2) {}
        return id || '';
    }

    function rtPartyIdentity() {
        if (typeof player === 'undefined' || !player || !player.cls) return null;
        var account = rtPartyAccount();
        if (!account) return null;
        return {
            account: account,
            slot: (typeof currentSlot !== 'undefined' ? currentSlot : 0),
            name: player.name || '未命名',
            sessionId: (typeof _roleSessionId !== 'undefined' ? _roleSessionId : ''),
            lv: player.lv || 1,
            cls: player.cls || '',
            mapId: (typeof mapState !== 'undefined' && mapState ? mapState.current : '') || '',
            mapName: '',
            hp: player.hp || 0,
            mhp: player.mhp || 1,
            classic: !(player.classicMode === false)
        };
    }

    function rtPartyBodyExtras() {
        var id = rtPartyIdentity();
        if (!id) return null;
        id.mapName = rtPartyMapName(id.mapId);
        return id;
    }

    function rtPartyPost(path, extra) {
        if (!rtPartyIsHttp()) return Promise.resolve(null);
        var base = rtPartyBodyExtras();
        if (!base) return Promise.resolve({ ok: false, error: 'need account', message: '請先登入帳號再組隊。' });
        var body = Object.assign({}, base, extra || {});
        return fetch('/api/party/' + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (res) {
            return res.json().then(function (data) {
                if (data && typeof data === 'object') data._http = res.status;
                return data;
            });
        }).catch(function () { return { ok: false, error: 'net' }; });
    }

    function rtPartyMyKey() {
        var id = rtPartyIdentity();
        if (!id) return '';
        return id.account + '#' + id.slot + '#' + (id.name || '未命名');
    }

    function rtPartyIsLeader() {
        if (!_rtParty || !_rtParty.leaderKey) return false;
        return _rtParty.leaderKey === rtPartyMyKey();
    }

    function rtPartyId() {
        return (_rtParty && _rtParty.id) ? String(_rtParty.id) : '';
    }

    function rtPartySameMapAllies() {
        if (!_rtParty || !Array.isArray(_rtParty.members)) return 0;
        var me = rtPartyMyKey();
        var mapId = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
        var n = 0;
        _rtParty.members.forEach(function (m) {
            if (!m || m.key === me || !m.online) return;
            if (m.mapId && mapId && m.mapId === mapId) n++;
        });
        return n;
    }

    function rtPartyMemberCount() {
        if (!_rtParty || !Array.isArray(_rtParty.members)) return 0;
        return _rtParty.members.filter(function (m) { return m && m.online; }).length;
    }

    function rtPartyLog(msg) {
        try {
            if (typeof _chatAppend === 'function') _chatAppend('party', '<span class="wc-sys">' + msg + '</span>');
            else if (typeof logSys === 'function') logSys(msg);
        } catch (e) {}
    }

    function rtPartyFlushShareLog() {
        if (!_rtPartyAccShare.exp && !_rtPartyAccShare.gold) return;
        var exp = _rtPartyAccShare.exp;
        var gold = _rtPartyAccShare.gold;
        _rtPartyAccShare.exp = 0;
        _rtPartyAccShare.gold = 0;
        _rtPartyAccShare.t = Date.now();
        var parts = [];
        if (exp) parts.push('經驗 +' + exp);
        if (gold) parts.push('金幣 +' + gold);
        rtPartyLog('組隊分享：' + parts.join('、') + '。');
    }

    function rtPartyApplyShare(ev) {
        if (!ev || ev.type !== 'share') return;
        var me = rtPartyMyKey();
        if (ev.fromKey && ev.fromKey === me) return;
        if (ev.seq && _rtPartySeenShare[ev.seq]) return;
        if (ev.seq) {
            _rtPartySeenShare[ev.seq] = Date.now();
            var keys = Object.keys(_rtPartySeenShare);
            if (keys.length > 80) keys.slice(0, keys.length - 40).forEach(function (k) { delete _rtPartySeenShare[k]; });
        }
        if (typeof player === 'undefined' || !player || !player.cls) return;
        var myMap = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
        if (!ev.mapId || !myMap || ev.mapId !== myMap) return;
        if (Math.abs((player.lv || 1) - (Number(ev.fromLv) || player.lv || 1)) > RT_PARTY_LV_RANGE) {
            // server doesn't send fromLv; compare via party roster
        }
        var leader = (_rtParty && _rtParty.members || []).find(function (m) { return m && m.key === ev.fromKey; });
        if (leader && Math.abs((player.lv || 1) - (leader.lv || 1)) > RT_PARTY_LV_RANGE) return;

        var expIn = Math.floor((Number(ev.exp) || 0) * RT_PARTY_SHARE_EXP);
        var goldIn = Math.floor((Number(ev.gold) || 0) * RT_PARTY_SHARE_GOLD);
        if (typeof getExpGainMult === 'function') expIn = Math.floor(expIn * getExpGainMult(player.lv || 1));
        if (expIn > 0) {
            player.exp = (Number(player.exp) || 0) + expIn;
            try { if (typeof checkLvUp === 'function') checkLvUp(); } catch (e) {}
            _rtPartyAccShare.exp += expIn;
        }
        if (goldIn > 0) {
            if (typeof addPlayerGold === 'function') addPlayerGold(goldIn);
            else player.gold = (Number(player.gold) || 0) + goldIn;
            _rtPartyAccShare.gold += goldIn;
        }
        if (Date.now() - (_rtPartyAccShare.t || 0) > 2500) rtPartyFlushShareLog();
        try { if (typeof updateUI === 'function') updateUI(); } catch (e2) {}
    }

    function rtPartyHandleEvents(events) {
        if (!Array.isArray(events) || !events.length) return;
        events.forEach(function (ev) {
            if (!ev) return;
            if (ev.seq && ev.seq > _rtPartySeq) _rtPartySeq = ev.seq;
            if (ev.type === 'invite') {
                // invites arrive via snapshot too
            } else if (ev.type === 'join') {
                rtPartyLog((rtPartyEsc(ev.name) || '隊員') + ' 加入了隊伍。');
            } else if (ev.type === 'leave') {
                rtPartyLog((rtPartyEsc(ev.name) || '隊員') + ' 離開了隊伍。');
            } else if (ev.type === 'kick') {
                if (ev.key === rtPartyMyKey() || ev.toKey === rtPartyMyKey()) {
                    if (!rtPartyIsSuspended()) {
                        _rtParty = null;
                        rtPartyLog('你被移出隊伍。');
                    }
                } else {
                    rtPartyLog((rtPartyEsc(ev.name) || '隊員') + ' 被移出隊伍。');
                }
            } else if (ev.type === 'disband') {
                if (rtPartyIsSuspended()) return;
                _rtParty = null;
                rtPartyLog('隊伍已解散。');
            } else if (ev.type === 'leader') {
                rtPartyLog((rtPartyEsc(ev.name) || '隊員') + ' 成為新隊長。');
            } else if (ev.type === 'decline') {
                rtPartyLog((rtPartyEsc(ev.name) || '對方') + ' 拒絕了組隊邀請。');
            } else if (ev.type === 'apply') {
                if (rtPartyIsLeader()) {
                    rtPartyLog((rtPartyEsc(ev.name) || '玩家') + ' 申請加入隊伍。');
                    rtPartyPollOnce();
                }
            } else if (ev.type === 'apply_accept') {
                if (ev.toKey === rtPartyMyKey() || !ev.toKey) {
                    rtPartyLog('申請已通過，已加入隊伍。');
                    rtPartyStart();
                    rtPartyPollOnce();
                }
            } else if (ev.type === 'apply_reject') {
                if (ev.toKey === rtPartyMyKey() || !ev.toKey) {
                    rtPartyLog('隊長拒絕了你的組隊申請。');
                    rtPartyFetchList(true);
                }
            } else if (ev.type === 'share') {
                rtPartyApplyShare(ev);
            }
        });
    }

    function rtPartyIsSuspended() {
        try {
            return !!(typeof window !== 'undefined' && (window.__onlineIdleForced || window.__wildOnlineForced));
        } catch (e) { return false; }
    }

    function rtPartyApplySnapshot(data) {
        if (!data || !data.ok) return;
        if (data.seq && data.seq > _rtPartySeq) _rtPartySeq = data.seq;
        if (data.party) _rtParty = data.party;
        else if (_rtParty && data.party === null && !rtPartyIsSuspended()) _rtParty = null;
        _rtPartyKey = rtPartyMyKey();
        _rtPartyInvites = Array.isArray(data.invites) ? data.invites : [];
        _rtPartyApplications = Array.isArray(data.applications) ? data.applications : [];
        rtPartyHandleEvents(data.events || []);
        rtPartyRender();
        rtPartyRenderInvites();
    }

    function rtPartyNotifyKill(info) {
        if (!info) return;
        if (!_rtParty || rtPartyMemberCount() < 2) return;
        var same = rtPartySameMapAllies();
        if (!same) return;
        var exp = Math.max(0, Math.floor(Number(info.exp) || 0));
        var gold = Math.max(0, Math.floor(Number(info.gold) || 0));
        if (!exp && !gold) return;
        rtPartyPost('share', {
            exp: exp,
            gold: gold,
            mapId: info.mapId || ((typeof mapState !== 'undefined' && mapState) ? mapState.current : ''),
            mobName: info.mobName || ''
        });
    }

    function rtPartyCreate() {
        return rtPartyPost('create').then(function (data) {
            if (data && data.ok) {
                _rtParty = data.party || null;
                rtPartyLog(data.already ? '你已在隊伍中。' : '已創建隊伍。可邀請玩家或等待他人申請加入。');
                rtPartyRender();
                rtPartyStart();
            } else if (data && data.message) {
                rtPartyLog(rtPartyEsc(data.message));
            } else {
                rtPartyLog('建立隊伍失敗。');
            }
            return data;
        });
    }

    function rtPartyInvite() {
        var input = document.getElementById('rt-party-invite-name');
        var name = input ? String(input.value || '').trim() : String(_rtPartyInviteDraft || '').trim();
        if (!name) {
            rtPartyLog('請輸入要邀請的角色名稱。');
            return;
        }
        _rtPartyInviteDraft = name;
        return rtPartyPost('invite', { targetName: name }).then(function (data) {
            if (data && data.ok) {
                rtPartyLog('已邀請「' + rtPartyEsc(data.targetName || name) + '」。');
                _rtPartyInviteDraft = '';
                if (input) input.value = '';
                rtPartyFetchOnline(true);
            } else if (data && data.message) {
                rtPartyLog(rtPartyEsc(data.message));
            } else {
                rtPartyLog('邀請失敗。');
            }
        });
    }

    function rtPartyPickInvite(name) {
        name = String(name || '').trim();
        if (!name) return;
        _rtPartyInviteDraft = name;
        var input = document.getElementById('rt-party-invite-name');
        if (input) {
            input.value = name;
            try { input.focus(); } catch (e) {}
        }
        if (rtPartyIsLeader()) rtPartyInvite();
        else rtPartyLog('請先創建隊伍再邀請。');
    }

    function rtPartyApply(partyId) {
        partyId = String(partyId || '').trim();
        if (!partyId) return;
        return rtPartyPost('apply', { partyId: partyId }).then(function (data) {
            if (data && data.ok) {
                rtPartyLog(rtPartyEsc(data.message || '已申請加入。'));
                rtPartyFetchList(true);
            } else if (data && data.message) {
                rtPartyLog(rtPartyEsc(data.message));
            } else {
                rtPartyLog('申請失敗。');
            }
            return data;
        });
    }

    function rtPartyReviewApply(applyId, accept) {
        applyId = String(applyId || '').trim();
        if (!applyId) return;
        return rtPartyPost('review', { applyId: applyId, accept: !!accept }).then(function (data) {
            if (data && data.ok && data.accepted) {
                _rtParty = data.party || _rtParty;
                rtPartyLog('已接受組隊申請。');
                rtPartyRender(true);
            } else if (data && data.ok && !data.accepted) {
                rtPartyLog('已拒絕組隊申請。');
                _rtPartyApplications = (_rtPartyApplications || []).filter(function (x) {
                    return x && x.id !== applyId;
                });
                rtPartyRender(true);
            } else if (data && data.message) {
                rtPartyLog(rtPartyEsc(data.message));
            }
        });
    }

    function rtPartyStableSig() {
        var partyBits = null;
        if (_rtParty) {
            partyBits = {
                id: _rtParty.id,
                leader: _rtParty.leaderKey,
                members: (_rtParty.members || []).map(function (m) {
                    if (!m) return null;
                    return {
                        k: m.key,
                        n: m.name,
                        lv: m.lv,
                        cls: m.cls,
                        map: m.mapId,
                        on: !!m.online,
                        lead: !!m.leader
                    };
                })
            };
        }
        return JSON.stringify({
            a: rtPartyAccount(),
            p: partyBits,
            i: (_rtPartyInvites || []).map(function (x) { return x && x.id; }),
            k: rtPartyMyKey(),
            o: (_rtPartyOnlineCache || []).map(function (x) { return x && (x.name + (x.inParty ? '1' : '0')); }),
            l: (_rtPartyListCache || []).map(function (x) {
                return x && (x.id + ':' + (x.memberCount || 0) + ':' + (x.applied ? '1' : '0'));
            }),
            r: (_rtPartyApplications || []).map(function (x) { return x && x.id; }),
            d: _rtPartyInviteDraft
        });
    }

    function rtPartyFetchList(force) {
        if (!rtPartyIsHttp()) return Promise.resolve([]);
        var id = rtPartyIdentity();
        if (!id) return Promise.resolve([]);
        var now = Date.now();
        if (!force && _rtPartyListAt && now - _rtPartyListAt < 4000) {
            return Promise.resolve(_rtPartyListCache);
        }
        if (_rtPartyListFetch) return _rtPartyListFetch;
        var url = '/api/party/list?account=' + encodeURIComponent(id.account)
            + '&slot=' + encodeURIComponent(String(id.slot))
            + '&name=' + encodeURIComponent(id.name);
        _rtPartyListFetch = fetch(url)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                _rtPartyListFetch = null;
                if (data && data.ok && Array.isArray(data.parties)) {
                    _rtPartyListCache = data.parties;
                    _rtPartyListAt = Date.now();
                    rtPartyRender();
                    return _rtPartyListCache;
                }
                return _rtPartyListCache;
            })
            .catch(function () {
                _rtPartyListFetch = null;
                return _rtPartyListCache;
            });
        return _rtPartyListFetch;
    }

    function rtPartyFetchOnline(force) {
        if (!rtPartyIsHttp()) return Promise.resolve([]);
        var id = rtPartyIdentity();
        if (!id) return Promise.resolve([]);
        var now = Date.now();
        if (!force && _rtPartyOnlineAt && now - _rtPartyOnlineAt < 4000) {
            return Promise.resolve(_rtPartyOnlineCache);
        }
        if (_rtPartyOnlineFetch) return _rtPartyOnlineFetch;
        var q = String(_rtPartyInviteDraft || '').trim();
        var url = '/api/party/online?account=' + encodeURIComponent(id.account)
            + '&slot=' + encodeURIComponent(String(id.slot))
            + '&name=' + encodeURIComponent(id.name)
            + (q ? '&q=' + encodeURIComponent(q) : '');
        _rtPartyOnlineFetch = fetch(url)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                _rtPartyOnlineFetch = null;
                if (data && data.ok && Array.isArray(data.players)) {
                    _rtPartyOnlineCache = data.players;
                    _rtPartyOnlineAt = Date.now();
                    rtPartyRender();
                    return _rtPartyOnlineCache;
                }
                return _rtPartyOnlineCache;
            })
            .catch(function () {
                _rtPartyOnlineFetch = null;
                return _rtPartyOnlineCache;
            });
        return _rtPartyOnlineFetch;
    }

    function rtPartyOnInviteInput() {
        var input = document.getElementById('rt-party-invite-name');
        _rtPartyInviteDraft = input ? String(input.value || '') : '';
        if (_rtPartySearchTimer) clearTimeout(_rtPartySearchTimer);
        _rtPartySearchTimer = setTimeout(function () {
            _rtPartySearchTimer = null;
            rtPartyFetchOnline(true);
        }, 250);
    }

    function rtPartyListHtml() {
        var list = _rtPartyListCache || [];
        if (!list.length) {
            return '<div class="rt-party-online empty">目前沒有可加入的隊伍；你也可以創建隊伍等人申請。</div>';
        }
        return '<div class="rt-party-online rt-party-open-list">'
            + list.slice(0, 20).map(function (p) {
                if (!p || !p.id) return '';
                var pid = encodeURIComponent(p.id);
                var act = '';
                if (p.applied) {
                    act = '<span class="rt-party-off">已申請</span>';
                } else if (p.open) {
                    act = '<button type="button" class="rt-party-btn rt-party-btn-mini rt-party-btn-main" data-pid="' + pid + '" onclick="rtPartyApply(decodeURIComponent(this.getAttribute(\'data-pid\')))">申請加入</button>';
                } else {
                    act = '<span class="rt-party-off">已滿</span>';
                }
                return '<div class="rt-party-online-row">'
                    + '<div class="rt-party-online-info">'
                    + '<span class="rt-party-name">隊長 ' + rtPartyEsc(p.leaderName || '—') + '</span>'
                    + '<span class="rt-party-meta">Lv.' + (p.leaderLv || 1) + ' ' + rtPartyEsc(rtPartyClsLabel(p.leaderCls))
                    + ' · ' + rtPartyEsc(p.mapName || '—')
                    + ' · ' + (p.memberCount || 0) + '/' + (p.max || 8) + ' 人'
                    + (p.onlineCount ? ' · 線上 ' + p.onlineCount : '') + '</span>'
                    + '</div>' + act + '</div>';
            }).join('')
            + '</div>';
    }

    function rtPartyApplicationsHtml() {
        var list = _rtPartyApplications || [];
        if (!list.length) return '';
        return '<div class="rt-party-section">'
            + '<div class="rt-party-section-title">待審申請</div>'
            + '<div class="rt-party-online">'
            + list.map(function (a) {
                if (!a || !a.id) return '';
                var aid = encodeURIComponent(a.id);
                return '<div class="rt-party-online-row">'
                    + '<div class="rt-party-online-info">'
                    + '<span class="rt-party-name">' + rtPartyEsc(a.name || '玩家') + '</span>'
                    + '<span class="rt-party-meta">Lv.' + (a.lv || 1) + ' ' + rtPartyEsc(rtPartyClsLabel(a.cls)) + '</span>'
                    + '</div>'
                    + '<div class="rt-party-actions" style="margin:0;flex-wrap:nowrap;">'
                    + '<button type="button" class="rt-party-btn rt-party-btn-mini rt-party-btn-main" data-aid="' + aid + '" onclick="rtPartyReviewApply(decodeURIComponent(this.getAttribute(\'data-aid\')), true)">接受</button>'
                    + '<button type="button" class="rt-party-btn rt-party-btn-mini" data-aid="' + aid + '" onclick="rtPartyReviewApply(decodeURIComponent(this.getAttribute(\'data-aid\')), false)">拒絕</button>'
                    + '</div></div>';
            }).join('')
            + '</div></div>';
    }

    function rtPartyOnlineListHtml(leader) {
        var list = _rtPartyOnlineCache || [];
        if (!list.length) {
            return '<div class="rt-party-online empty">目前沒有其他線上玩家' + (_rtPartyInviteDraft ? '符合搜尋' : '') + '。</div>';
        }
        return '<div class="rt-party-online">'
            + list.slice(0, 12).map(function (p) {
                if (!p) return '';
                var busy = p.inParty ? ' <span class="rt-party-off">組隊中</span>' : '';
                var act = leader
                    ? '<button type="button" class="rt-party-btn rt-party-btn-mini" data-name="' + encodeURIComponent(p.name) + '" onclick="rtPartyPickInvite(decodeURIComponent(this.getAttribute(\'data-name\')))">邀請</button>'
                    : '';
                return '<div class="rt-party-online-row">'
                    + '<div class="rt-party-online-info">'
                    + '<span class="rt-party-name">' + rtPartyEsc(p.name) + busy + '</span>'
                    + '<span class="rt-party-meta">Lv.' + (p.lv || 1) + ' ' + rtPartyEsc(rtPartyClsLabel(p.cls)) + ' · ' + rtPartyEsc(p.mapName || '—') + '</span>'
                    + '</div>' + act + '</div>';
            }).join('')
            + '</div>';
    }

    function rtPartyPreserveInviteFocus(body) {
        var prev = document.getElementById('rt-party-invite-name');
        var keepVal = _rtPartyInviteDraft;
        var keepFocus = false;
        var selStart = 0;
        var selEnd = 0;
        if (prev && document.activeElement === prev) {
            keepFocus = true;
            keepVal = String(prev.value || '');
            _rtPartyInviteDraft = keepVal;
            try {
                selStart = prev.selectionStart || 0;
                selEnd = prev.selectionEnd || 0;
            } catch (e) {}
        } else if (prev) {
            keepVal = String(prev.value || keepVal || '');
            _rtPartyInviteDraft = keepVal;
        }
        return function restore() {
            var next = body ? body.querySelector('#rt-party-invite-name') : document.getElementById('rt-party-invite-name');
            if (!next) return;
            next.value = keepVal || '';
            if (keepFocus) {
                try {
                    next.focus();
                    if (typeof next.setSelectionRange === 'function') next.setSelectionRange(selStart, selEnd);
                } catch (e2) {}
            }
        };
    }

    function rtPartyPatchHpBars() {
        try {
            if (!_rtParty || !Array.isArray(_rtParty.members)) return;
            var rows = document.querySelectorAll('.rt-party-row[data-key]');
            for (var i = 0; i < rows.length; i++) {
                var el = rows[i];
                var key = el.getAttribute('data-key') || '';
                var mem = (_rtParty.members || []).find(function (x) { return x && x.key === key; });
                if (!mem) continue;
                var mapEl = el.querySelector('.rt-party-map');
                if (!mapEl) continue;
                var pct = mem.mhp > 0 ? Math.max(0, Math.min(100, Math.round((mem.hp || 0) / mem.mhp * 100))) : 0;
                mapEl.textContent = (mem.mapName || mem.mapId || '—') + ' · HP ' + pct + '%';
            }
        } catch (e) {}
    }

    function rtPartyRespond(inviteId, accept) {
        return rtPartyPost('respond', { inviteId: inviteId, accept: !!accept }).then(function (data) {
            if (data && data.ok && data.accepted) {
                _rtParty = data.party || null;
                rtPartyLog('已加入隊伍。');
                rtPartyStart();
                try {
                    var btn = document.getElementById('btn-party');
                    if (btn && typeof switchTab === 'function') switchTab('party', btn);
                } catch (e) {}
            } else if (data && data.ok && !data.accepted) {
                rtPartyLog('已拒絕組隊邀請。');
            } else if (data && data.message) {
                rtPartyLog(rtPartyEsc(data.message));
            }
            _rtPartyInvites = (_rtPartyInvites || []).filter(function (x) { return x && x.id !== inviteId; });
            rtPartyRender();
            rtPartyRenderInvites();
        });
    }

    function rtPartyLeave() {
        return rtPartyPost('leave').then(function () {
            _rtParty = null;
            rtPartyLog('已離開隊伍。');
            rtPartyRender();
        });
    }

    function rtPartyDisband() {
        return rtPartyPost('disband').then(function (data) {
            if (data && data.ok) {
                _rtParty = null;
                rtPartyLog('隊伍已解散。');
                rtPartyRender();
            } else if (data && data.message) {
                rtPartyLog(rtPartyEsc(data.message));
            }
        });
    }

    function rtPartyKick(targetKey) {
        if (!targetKey) return;
        return rtPartyPost('kick', { targetKey: targetKey }).then(function (data) {
            if (data && data.ok) {
                _rtParty = data.party || null;
                rtPartyRender();
            } else if (data && data.message) {
                rtPartyLog(rtPartyEsc(data.message));
            }
        });
    }

    function rtPartyFollowLeader() {
        if (!_rtParty || !Array.isArray(_rtParty.members)) return;
        var leader = _rtParty.members.find(function (m) { return m && m.key === _rtParty.leaderKey; });
        if (!leader || !leader.mapId) {
            rtPartyLog('找不到隊長位置。');
            return;
        }
        if (typeof mapState !== 'undefined' && mapState && mapState.current === leader.mapId) {
            rtPartyLog('你已與隊長在同一地圖。');
            return;
        }
        var sel = document.getElementById('map-select');
        if (!sel) return;
        var opt = Array.prototype.find.call(sel.options || [], function (o) { return o && o.value === leader.mapId; });
        if (!opt) {
            // try set category then map
            try {
                if (typeof mapRegionOf === 'function' && typeof setMapSelectors === 'function') {
                    setMapSelectors(leader.mapId);
                } else if (typeof syncMapSelectors === 'function') {
                    // fall through
                }
            } catch (e) {}
            opt = Array.prototype.find.call(sel.options || [], function (o) { return o && o.value === leader.mapId; });
        }
        if (!opt) {
            rtPartyLog('無法傳送到隊長所在地圖（可能未解鎖或不可進入）。');
            return;
        }
        sel.value = leader.mapId;
        try {
            if (typeof changeMap === 'function') changeMap();
            rtPartyLog('正在前往隊長所在：' + rtPartyEsc(leader.mapName || leader.mapId) + '。');
        } catch (e2) {
            rtPartyLog('跟隨隊長失敗。');
        }
    }

    function rtPartyClsLabel(cls) {
        try {
            if (typeof DB !== 'undefined' && DB && DB.classes && DB.classes[cls] && DB.classes[cls].n) return DB.classes[cls].n;
        } catch (e) {}
        return cls || '';
    }

    function rtPartyRender(force) {
        var body = document.getElementById('rt-party-body');
        if (!body) return;
        var inGame = false;
        try {
            var game = document.getElementById('game-screen');
            inGame = !!(game && !game.classList.contains('hidden') && typeof player !== 'undefined' && player && player.cls);
        } catch (e) {}
        if (!inGame) {
            body.innerHTML = '<div class="rt-party-hint">進入遊戲後可與其他玩家即時組隊。</div>';
            _rtPartyUiSig = '';
            return;
        }

        var account = rtPartyAccount();
        var sig = rtPartyStableSig();
        if (!force && sig === _rtPartyUiSig) {
            rtPartyPatchHpBars();
            return;
        }
        var restoreInvite = rtPartyPreserveInviteFocus(body);
        _rtPartyUiSig = sig;

        if (!account) {
            body.innerHTML = '<div class="rt-party-hint">登入帳號後可與其他玩家即時組隊。</div>';
            return;
        }

        var html = '';
        var leader = false;
        if (!_rtParty) {
            html += '<div class="rt-party-actions">'
                + '<button type="button" class="rt-party-btn rt-party-btn-main" onclick="rtPartyCreate()">創建隊伍</button>'
                + '</div>';
            html += '<div class="rt-party-hint">創建後可邀請玩家；或從下方列表申請加入他人隊伍。同地圖可分享經驗／金幣。</div>';
            html += '<div class="rt-party-section">'
                + '<div class="rt-party-section-title">目前隊伍</div>'
                + rtPartyListHtml()
                + '</div>';
            rtPartyFetchList(false);
        } else {
            var me = rtPartyMyKey();
            leader = rtPartyIsLeader();
            html += rtPartyApplicationsHtml();
            html += '<div class="rt-party-roster">';
            (_rtParty.members || []).forEach(function (m) {
                if (!m) return;
                var isMe = m.key === me;
                var tag = m.leader ? '<span class="rt-party-tag leader">隊長</span>' : '<span class="rt-party-tag">隊員</span>';
                var online = m.online ? '' : ' <span class="rt-party-off">離線</span>';
                var hpPct = m.mhp > 0 ? Math.max(0, Math.min(100, Math.round((m.hp || 0) / m.mhp * 100))) : 0;
                html += '<div class="rt-party-row' + (isMe ? ' me' : '') + '" data-key="' + rtPartyEsc(m.key) + '">'
                    + '<div class="rt-party-row-top">'
                    + '<span class="rt-party-name">' + tag + ' ' + rtPartyEsc(m.name) + online + '</span>'
                    + '<span class="rt-party-meta">Lv.' + (m.lv || 1) + ' ' + rtPartyEsc(rtPartyClsLabel(m.cls)) + '</span>'
                    + '</div>'
                    + '<div class="rt-party-map">' + rtPartyEsc(m.mapName || m.mapId || '—') + ' · HP ' + hpPct + '%</div>';
                if (leader && !isMe) {
                    html += '<button type="button" class="rt-party-btn rt-party-btn-kick" data-key="' + encodeURIComponent(m.key) + '" onclick="rtPartyKick(decodeURIComponent(this.getAttribute(\'data-key\')))">踢出</button>';
                }
                html += '</div>';
            });
            html += '</div>';

            if (leader) {
                html += '<div class="rt-party-invite-row">'
                    + '<input id="rt-party-invite-name" type="text" maxlength="16" placeholder="輸入或搜尋角色名稱" autocomplete="off" value="' + rtPartyEsc(_rtPartyInviteDraft) + '"'
                    + ' oninput="rtPartyOnInviteInput()" onkeydown="if(event.key===\'Enter\'){event.preventDefault();rtPartyInvite();}">'
                    + '<button type="button" class="rt-party-btn" onclick="rtPartyInvite()">邀請</button>'
                    + '</div>';
                html += rtPartyOnlineListHtml(true);
                rtPartyFetchOnline(false);
            }
            html += '<div class="rt-party-actions">';
            if (!leader) {
                html += '<button type="button" class="rt-party-btn" onclick="rtPartyFollowLeader()">跟隨隊長</button>';
                html += '<button type="button" class="rt-party-btn" onclick="rtPartyLeave()">離開隊伍</button>';
            } else {
                html += '<button type="button" class="rt-party-btn" onclick="rtPartyLeave()">離開隊伍</button>';
                html += '<button type="button" class="rt-party-btn rt-party-btn-danger" onclick="rtPartyDisband()">解散隊伍</button>';
            }
            html += '</div>';
            html += '<div class="rt-party-hint">同地圖隊員可分享擊殺經驗／金幣；隊伍頻道可即時通話。</div>';
        }
        body.innerHTML = html;
        restoreInvite();
    }

    function rtPartyRenderInvites() {
        var box = document.getElementById('rt-party-invite-toast');
        if (!box) return;
        var list = _rtPartyInvites || [];
        var dots = [
            document.getElementById('btn-party-dot'),
            document.getElementById('btn-party-dot-mobile')
        ];
        dots.forEach(function (dot) {
            if (!dot) return;
            if (list.length) dot.classList.remove('hidden');
            else dot.classList.add('hidden');
        });
        if (!list.length) {
            box.classList.add('hidden');
            box.innerHTML = '';
            return;
        }
        box.classList.remove('hidden');
        box.innerHTML = list.map(function (inv) {
            var iid = encodeURIComponent(inv.id || '');
            return '<div class="rt-party-invite-card">'
                + '<div><b>' + rtPartyEsc(inv.fromName || '玩家') + '</b> 邀請你組隊</div>'
                + '<div class="rt-party-actions">'
                + '<button type="button" class="rt-party-btn rt-party-btn-main" data-id="' + iid + '" onclick="rtPartyRespond(decodeURIComponent(this.getAttribute(\'data-id\')), true)">接受</button>'
                + '<button type="button" class="rt-party-btn" data-id="' + iid + '" onclick="rtPartyRespond(decodeURIComponent(this.getAttribute(\'data-id\')), false)">拒絕</button>'
                + '</div></div>';
        }).join('');
    }

    function rtPartyHeartbeat() {
        if (!rtPartyIdentity() || rtPartyIsSuspended()) return Promise.resolve();
        return rtPartyPost('heartbeat').then(function (data) {
            if (data && data.ok) {
                if (data.party) _rtParty = data.party;
                else if (_rtParty && data.party === null && !rtPartyIsSuspended()) _rtParty = null;
                if (data.seq && data.seq > _rtPartySeq) { /* poll will catch */ }
                rtPartyRender();
            }
        });
    }

    function rtPartyPollOnce() {
        if (!rtPartyIsHttp() || rtPartyIsSuspended()) return Promise.resolve();
        var id = rtPartyIdentity();
        if (!id) return Promise.resolve();
        var wait = _rtPartySeq > 0 ? 16000 : 0;
        var url = '/api/party/poll?account=' + encodeURIComponent(id.account)
            + '&slot=' + encodeURIComponent(String(id.slot))
            + '&name=' + encodeURIComponent(id.name)
            + '&since=' + encodeURIComponent(String(_rtPartySeq))
            + '&wait=' + wait;
        var ctrl = null;
        try { ctrl = new AbortController(); _rtPartyAbort = ctrl; } catch (e) { ctrl = null; }
        return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                rtPartyApplySnapshot(data);
            })
            .catch(function (err) {
                if (err && err.name === 'AbortError') return;
            });
    }

    function rtPartyStartPolling() {
        if (_rtPartyPolling || !rtPartyIsHttp()) return;
        if (typeof window !== 'undefined' && (window.__onlineIdleForced || window.__wildOnlineForced)) return;
        _rtPartyPolling = true;
        (function loop() {
            if (!_rtPartyPolling) return;
            rtPartyPollOnce().then(function () {
                if (!_rtPartyPolling) return;
                setTimeout(loop, 300);
            });
        })();
    }

    function rtPartyStopPolling() {
        _rtPartyPolling = false;
        try { if (_rtPartyAbort) _rtPartyAbort.abort(); } catch (e) {}
        _rtPartyAbort = null;
    }

    function rtPartyStop() {
        rtPartyStopPolling();
        if (_rtPartyHbTimer) {
            clearInterval(_rtPartyHbTimer);
            _rtPartyHbTimer = null;
        }
    }

    function rtPartyStart() {
        if (!rtPartyIsHttp() || rtPartyIsSuspended()) return;
        rtPartyStartPolling();
        if (_rtPartyHbTimer) return;
        _rtPartyHbTimer = setInterval(function () {
            try {
                var game = document.getElementById('game-screen');
                if (game && !game.classList.contains('hidden') && typeof player !== 'undefined' && player && player.cls) {
                    rtPartyHeartbeat();
                    if (Date.now() - (_rtPartyAccShare.t || 0) > 2500) rtPartyFlushShareLog();
                }
            } catch (e) {}
        }, RT_HEARTBEAT_MS);
        rtPartyHeartbeat();
        rtPartyRender();
    }

    // expose
    window.rtPartyCreate = rtPartyCreate;
    window.rtPartyInvite = rtPartyInvite;
    window.rtPartyApply = rtPartyApply;
    window.rtPartyReviewApply = rtPartyReviewApply;
    window.rtPartyPickInvite = rtPartyPickInvite;
    window.rtPartyOnInviteInput = rtPartyOnInviteInput;
    window.rtPartyRespond = rtPartyRespond;
    window.rtPartyLeave = rtPartyLeave;
    window.rtPartyDisband = rtPartyDisband;
    window.rtPartyKick = rtPartyKick;
    window.rtPartyFollowLeader = rtPartyFollowLeader;
    window.rtPartyNotifyKill = rtPartyNotifyKill;
    window.rtPartyId = rtPartyId;
    window.rtPartySameMapAllies = rtPartySameMapAllies;
    window.rtPartyIsLeader = rtPartyIsLeader;
    window.rtPartyMemberCount = rtPartyMemberCount;
    window.rtPartyGet = function () { return _rtParty; };
    window.rtPartyStart = rtPartyStart;
    window.rtPartyStop = rtPartyStop;
    window.rtPartyPollOnce = rtPartyPollOnce;
    window.rtPartyRender = rtPartyRender;

    (function watch() {
        function poke() {
            try {
                if (typeof window !== 'undefined' && (window.__onlineIdleForced || window.__wildOnlineForced)) return;
                var game = document.getElementById('game-screen');
                if (game && !game.classList.contains('hidden') && typeof player !== 'undefined' && player && player.cls) {
                    rtPartyStart();
                    rtPartyRender();
                } else {
                    rtPartyRender();
                }
            } catch (e) {}
        }
        if (typeof MutationObserver !== 'undefined') {
            try {
                var game = document.getElementById('game-screen');
                if (game) new MutationObserver(poke).observe(game, { attributes: true, attributeFilter: ['class'] });
            } catch (e2) {}
        }
        setInterval(poke, 5000);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poke);
        else poke();
    })();
})();

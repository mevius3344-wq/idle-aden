// ===== ⚔️ 野外 PK（同圖・攻擊者 pvpOn・伺服器權威扣血）=====
// ⚔️ v3.9.36：擊殺噴寶＝依性向真實扣除 → 同一批快照轉交擊殺者（不少不多）；未開 PK 者可被打但不能還手。
(function () {
    'use strict';

    var _fpTargetKey = '';
    var _fpBusy = false;
    var _fpLastHitAt = 0;
    var _fpDying = false;

    function fpMapAllowed(mapId) {
        var id = String(mapId || '');
        if (!id || id.indexOf('town_') === 0) return false;
        if (id === 'training' || id === 'arena_pvp' || id === 'rift_battle') return false;
        try {
            if (typeof isWorldBossMap === 'function' && isWorldBossMap(id)) return false;
        } catch (e) {}
        try {
            if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS && KING_ROOMS[id]) return false;
        } catch (e2) {}
        try {
            if (typeof isSiegeArea === 'function' && isSiegeArea(id)) return false;
        } catch (e3) {}
        return true;
    }

    function fpSelfOn() {
        try {
            if (typeof pvpEnsureState === 'function') pvpEnsureState();
            return !!(typeof player !== 'undefined' && player && player.pvpOn);
        } catch (e) {
            return false;
        }
    }

    function fpSetMode(on) {
        if (typeof setPvpMode === 'function') setPvpMode(!!on);
        else {
            if (typeof player !== 'undefined' && player) player.pvpOn = !!on;
            try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
        }
        fpUpdateToggleUi();
        try { if (typeof mapPopUpdateIndicator === 'function') mapPopUpdateIndicator(); } catch (e2) {}
    }

    function fpToggle() {
        fpSetMode(!fpSelfOn());
        try {
            if (typeof logSys === 'function') {
                logSys(fpSelfOn()
                    ? '<span class="text-red-300 font-bold">【野外 PK】已開啟</span>：可攻擊同圖玩家；未開 PK 者無法還手。擊殺依性向噴寶，對方失去的物品會轉到你身上。'
                    : '<span class="text-slate-300">【野外 PK】已關閉</span>：你不能攻擊他人（仍可能被開 PK 者攻擊）。');
            }
        } catch (e) {}
    }

    function fpUpdateToggleUi() {
        var on = fpSelfOn();
        var btn = document.getElementById('btn-field-pvp');
        if (btn) {
            btn.classList.toggle('is-on', on);
            btn.textContent = on ? '⚔️ PK 開' : '⚔️ PK 關';
            btn.title = on
                ? '野外 PK 開啟：可攻擊同圖玩家；擊殺依性向噴寶（失去＝撿取 1:1）'
                : '點擊開啟野外 PK（單方開即可攻擊；未開不能還手）';
        }
        var chud = document.getElementById('chud-pvp');
        if (chud) {
            chud.classList.toggle('is-on', on);
            chud.setAttribute('aria-pressed', on ? 'true' : 'false');
            chud.title = on
                ? '野外 PK 開啟：可攻擊同圖玩家；擊殺噴寶 1:1 轉交'
                : '點擊開啟野外 PK';
            var sub = chud.querySelector('.chud-pvp-sub');
            if (sub) sub.textContent = on ? '開' : '關';
        }
    }

    function fpSelectTarget(key, name) {
        if (!key) return;
        if (!fpSelfOn()) {
            try { alert('請先開啟野外 PK 才能攻擊。'); } catch (e) {}
            return;
        }
        if (typeof rtPartyMyKey === 'function' && key === rtPartyMyKey()) return;
        _fpTargetKey = String(key);
        try {
            if (typeof logSys === 'function') {
                logSys('<span class="text-red-300">【野外 PK】鎖定目標：</span>' + String(name || '冒險者'));
            }
        } catch (e2) {}
        try {
            document.querySelectorAll('.remote-party.is-fp-target').forEach(function (el) {
                el.classList.remove('is-fp-target');
            });
            var nodes = document.querySelectorAll('.remote-party[data-peer-key]');
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].getAttribute('data-peer-key') === _fpTargetKey) {
                    nodes[i].classList.add('is-fp-target');
                    break;
                }
            }
        } catch (e3) {}
    }

    function fpClearTarget() {
        _fpTargetKey = '';
        try {
            document.querySelectorAll('.remote-party.is-fp-target').forEach(function (el) {
                el.classList.remove('is-fp-target');
            });
        } catch (e) {}
    }

    function fpTargetKey() {
        return _fpTargetKey || '';
    }

    function fpAuthBody() {
        var body = {};
        try {
            if (typeof rtPartyBodyExtras === 'function') Object.assign(body, rtPartyBodyExtras() || {});
            else if (typeof rtPartyIdentity === 'function') Object.assign(body, rtPartyIdentity() || {});
            if (typeof anticheatAuthExtras === 'function') Object.assign(body, anticheatAuthExtras() || {});
        } catch (e) {}
        return body;
    }

    /** 被害方：真實扣除 → 回報伺服器轉交擊殺者（失敗則原樣還回，避免憑空少裝）。 */
    function fpTransferDeathLoot(killerKey, killerName) {
        if (!killerKey || typeof pvpResolveDeathItemLoss !== 'function') return;
        var result = pvpResolveDeathItemLoss({ arkata: false });
        if (!result || !result.items || !result.items.length) {
            try {
                if (typeof logSys === 'function') {
                    logSys('<span class="text-slate-400">【野外 PK】本次死亡未遺失物品。</span>');
                }
            } catch (e0) {}
            return;
        }
        var snaps = result.items.map(function (x) { return x.item; });
        var names = result.items.map(function (x) { return x.name; });
        var listHtml = names.map(function (n) {
            return '<span class="text-amber-200">' + n + '</span>';
        }).join('、');
        try {
            if (typeof logSys === 'function') {
                logSys('<span class="text-red-400 font-bold">【野外 PK】你遺失了 ' + listHtml + '，由 ' + String(killerName || '對手') + ' 撿取。</span>');
            }
        } catch (e1) {}
        try { if (typeof calcStats === 'function') calcStats(); } catch (e2) {}
        try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e3) {}
        try { if (typeof updateUI === 'function') updateUI(); } catch (e4) {}

        var body = fpAuthBody();
        body.items = snaps;
        fetch('/api/pvp/loot-transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (res) { return res.json(); }).then(function (data) {
            if (data && data.ok) {
                try { if (typeof saveGame === 'function') saveGame(); } catch (e5) {}
                return;
            }
            // 轉交失敗 → 原樣還回，避免「少了卻沒人拿到」
            try {
                if (typeof pvpGainTransferredItems === 'function') {
                    pvpGainTransferredItems(snaps, '', { restore: true });
                }
                if (typeof logSys === 'function') {
                    logSys('<span class="text-amber-300">【野外 PK】掉落轉交失敗，物品已退回你的背包。</span>');
                }
            } catch (e6) {}
        }).catch(function () {
            try {
                if (typeof pvpGainTransferredItems === 'function') {
                    pvpGainTransferredItems(snaps, '', { restore: true });
                }
                if (typeof logSys === 'function') {
                    logSys('<span class="text-amber-300">【野外 PK】掉落轉交失敗，物品已退回你的背包。</span>');
                }
            } catch (e7) {}
        });
    }

    function fpApplyHitEvent(ev) {
        if (!ev || typeof player === 'undefined' || !player) return;
        var dmg = Math.max(0, Math.floor(Number(ev.dmg) || 0));
        var hp = ev.hp != null ? Math.max(0, Math.floor(Number(ev.hp) || 0)) : null;
        if (dmg > 0) {
            player.hp = Math.max(0, (player.hp || 0) - dmg);
            try {
                if (typeof logCombat === 'function') {
                    logCombat(
                        '<span class="text-red-300 font-bold">【野外 PK】</span>' +
                        String(ev.fromName || '對手') +
                        ' 對你造成 <span class="text-red-200 font-bold">' + dmg + '</span> 點傷害。' +
                        (!fpSelfOn() ? ' <span class="text-slate-400">（你未開 PK，無法還手）</span>' : ''),
                        'player'
                    );
                }
            } catch (e) {}
        }
        if (hp != null) player.hp = Math.min(player.hp || 0, hp);
        try { if (typeof updateUI === 'function') updateUI(); } catch (e2) {}
        if (ev.killed || (player.hp || 0) <= 0) fpHandleDeath(ev.fromName || '對手', ev.fromKey || '');
    }

    function fpApplyLootEvent(ev) {
        if (!ev || !Array.isArray(ev.items) || !ev.items.length) return;
        if (typeof pvpGainTransferredItems === 'function') {
            pvpGainTransferredItems(ev.items, ev.fromName || '對手');
        }
    }

    function fpHandleDeath(fromName, fromKey) {
        if (_fpDying) return;
        _fpDying = true;
        setTimeout(function () { _fpDying = false; }, 4000);
        fpClearTarget();
        fpTransferDeathLoot(fromKey || '', fromName || '對手');
        try {
            if (typeof logSys === 'function') {
                logSys('<span class="text-red-400 font-bold">【野外 PK】你被 ' + String(fromName || '對手') + ' 擊敗，已送回村莊。</span>');
            }
        } catch (e) {}
        player.hp = Math.max(1, Math.floor((player.mhp || 1) * 0.3));
        try {
            if (typeof returnToTown === 'function') returnToTown();
            else if (typeof revive === 'function') revive();
        } catch (e2) {}
        try { if (typeof saveGame === 'function') saveGame(); } catch (e3) {}
        try { if (typeof updateUI === 'function') updateUI(); } catch (e4) {}
    }

    function fpTryAttack() {
        if (!fpSelfOn() || !_fpTargetKey) return false;
        if (typeof mapState === 'undefined' || !mapState || !fpMapAllowed(mapState.current)) {
            fpClearTarget();
            return false;
        }
        if (_fpBusy) return true;
        var now = Date.now();
        if (now - _fpLastHitAt < 850) return true;
        _fpBusy = true;
        _fpLastHitAt = now;
        var body = fpAuthBody();
        body.targetKey = _fpTargetKey;
        body.mapId = mapState.current;
        body.pvpOn = true;
        fetch('/api/pvp/hit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (res) { return res.json(); }).then(function (data) {
            if (!data || !data.ok) {
                var msg = (data && data.message) || (data && data.error === 'pvp_off' ? '請先開啟野外 PK。' : '攻擊失敗');
                if (data && data.error === 'diff_map') fpClearTarget();
                try { if (typeof logSys === 'function') logSys('<span class="text-amber-300">【野外 PK】' + msg + '</span>'); } catch (e) {}
                return;
            }
            try {
                if (typeof logCombat === 'function') {
                    logCombat(
                        '<span class="text-red-300 font-bold">【野外 PK】</span>對 ' +
                        String(data.targetName || '對手') +
                        ' 造成 <span class="text-yellow-300 font-bold">' + (data.dmg || 0) + '</span> 點傷害' +
                        (data.killed ? '（擊倒！等待對方掉落物轉交…）' : '') + '。',
                        'player'
                    );
                }
            } catch (e2) {}
            if (data.killed) fpClearTarget();
            try { if (typeof mapPopPollOnce === 'function') mapPopPollOnce(); } catch (e3) {}
        }).catch(function () {}).finally(function () { _fpBusy = false; });
        return true;
    }

    function fpOnRemoteClick(key, name, peerPvpOn, isParty) {
        if (isParty) return;
        if (!fpSelfOn()) {
            try { if (typeof logSys === 'function') logSys('<span class="text-slate-400">【野外 PK】請先開啟 PK 才能攻擊（未開不能還手）。</span>'); } catch (e) {}
            return;
        }
        fpSelectTarget(key, name);
    }

    window.fieldPvpToggle = fpToggle;
    window.fieldPvpSetMode = fpSetMode;
    window.fieldPvpTryAttack = fpTryAttack;
    window.fieldPvpApplyHitEvent = fpApplyHitEvent;
    window.fieldPvpApplyLootEvent = fpApplyLootEvent;
    window.fieldPvpHandleDeath = fpHandleDeath;
    window.fieldPvpOnRemoteClick = fpOnRemoteClick;
    window.fieldPvpTargetKey = fpTargetKey;
    window.fieldPvpUpdateToggleUi = fpUpdateToggleUi;
    window.fieldPvpSelfOn = fpSelfOn;

    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(fpUpdateToggleUi, 800);
            setInterval(fpUpdateToggleUi, 5000);
        });
    }
})();

// ===== 🎮 v3.8.457 戰鬥優先 HUD：目標列／冷卻／低血／回村／附加能力圖示回右上 =====
(function () {
    'use strict';

    var _stickActive = false;
    var _stickId = null;
    var _stickOriginX = 0;
    var _stickOriginY = 0;
    var _tapMoveActive = false;
    var _tapMoveId = null;
    var _afkSec = 0;
    var _afkTimer = null;
    var _hotbarSig = '';
    var _modeObs = null;

    function gs() { return document.getElementById('game-screen'); }

    function isTownVisible() {
        var tv = document.getElementById('town-view');
        return !!(tv && !tv.classList.contains('hidden'));
    }

    function syncTownMode() {
        var screen = gs();
        if (!screen) return;
        var inTown = isTownVisible();
        var wasTown = screen.classList.contains('chud-in-town');
        if (wasTown !== inTown) screen.classList.toggle('chud-in-town', inTown);
        if (inTown) {
            endStick();
            if (typeof exploreSetVirtualStick === 'function') exploreSetVirtualStick(0, 0, false);
            // 🩹 v3.8.460：只在剛進村莊時展開日誌一次；勿每秒強制打開
            if (!wasTown) screen.classList.add('log-open');
        }
        syncLogFab();
        mountStatusIconBar();
    }

    /** 🩹 v3.8.457：附加能力圖示改回右上（掛 #game-screen，村莊／戰鬥皆可見） */
    function mountStatusIconBar() {
        var bar = document.getElementById('status-icon-bar');
        var bv = document.getElementById('battle-view');
        var screen = gs();
        if (!bar) return;
        var hudOn = !!(screen && screen.classList.contains('combat-hud') && !screen.classList.contains('hidden'));
        if (hudOn && screen) {
            if (bar.parentElement !== screen) screen.appendChild(bar);
            if (!bar.classList.contains('chud-status-icons')) bar.classList.add('chud-status-icons');
            if (bar.classList.contains('hidden')) bar.classList.remove('hidden');
            if (bar.style.display === 'none') bar.style.display = '';
        } else if (bv) {
            if (bar.classList.contains('chud-status-icons')) bar.classList.remove('chud-status-icons');
            if (bar.parentElement !== bv) {
                var ml = document.getElementById('mob-list');
                if (ml && ml.parentElement === bv) bv.insertBefore(bar, ml);
                else bv.appendChild(bar);
            }
        }
    }

    /** 補齊重建 index 時可能漏掉的 HUD 節點（大頭照／右側選單鈕） */
    function ensureHudShell() {
        try {
            var sp = document.getElementById('status-panel');
            if (sp && !document.getElementById('status-avatar')) {
                var img = document.createElement('img');
                img.id = 'status-avatar';
                img.className = 'status-avatar';
                img.alt = '';
                img.draggable = false;
                img.setAttribute('aria-hidden', 'true');
                sp.insertBefore(img, sp.firstChild);
            }
            var tabBar = document.querySelector('#col-right > .tab-bar');
            if (tabBar && !document.getElementById('btn-chud-menu')) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.id = 'btn-chud-menu';
                btn.className = 'btn chud-menu-toggle';
                btn.setAttribute('aria-expanded', 'false');
                btn.setAttribute('aria-controls', 'chud-menu-rail');
                btn.title = '展開／收合右側選單';
                btn.textContent = '選單';
                btn.onclick = function () {
                    try { if (typeof toggleChudRightMenu === 'function') toggleChudRightMenu(); } catch (e) {}
                };
                var rail = tabBar.querySelector('.mobile-tab-primary');
                if (rail && !rail.id) rail.id = 'chud-menu-rail';
                tabBar.insertBefore(btn, tabBar.firstChild);
            }
        } catch (eShell) {}
    }

    function ensureHudDom() {
        var screen = gs();
        if (!screen) return;
        ensureHudShell();
        if (document.getElementById('combat-hud-controls')) {
            // 熱更新：補上新元件（不重綁整層）
            var wrap0 = document.getElementById('combat-hud-controls');
            if (wrap0 && !document.getElementById('chud-target')) {
                var t = document.createElement('div');
                t.id = 'chud-target';
                t.className = 'chud-target';
                t.setAttribute('aria-hidden', 'true');
                t.innerHTML = '<div class="chud-target-name" id="chud-target-name">—</div>' +
                    '<div class="chud-target-bar"><div class="chud-target-fill" id="chud-target-fill"></div></div>' +
                    '<div class="chud-target-hp" id="chud-target-hp"></div>';
                wrap0.insertBefore(t, wrap0.firstChild);
            }
            if (wrap0 && !document.getElementById('chud-fab-town')) {
                var tb = document.createElement('button');
                tb.type = 'button';
                tb.id = 'chud-fab-town';
                tb.className = 'chud-fab-town';
                tb.title = '回村莊';
                tb.textContent = '回村';
                var logB = document.getElementById('chud-fab-log');
                if (logB && logB.nextSibling) wrap0.insertBefore(tb, logB.nextSibling);
                else wrap0.appendChild(tb);
                tb.onclick = function (e) {
                    e.preventDefault();
                    try {
                        if (typeof returnToTown === 'function') returnToTown();
                    } catch (err) {}
                };
            }
            _hotbarSig = '';
            return;
        }
        var wrap = document.createElement('div');
        wrap.id = 'combat-hud-controls';
        wrap.innerHTML =
            '<div class="chud-target" id="chud-target" aria-hidden="true">' +
            '<div class="chud-target-name" id="chud-target-name">—</div>' +
            '<div class="chud-target-bar"><div class="chud-target-fill" id="chud-target-fill"></div></div>' +
            '<div class="chud-target-hp" id="chud-target-hp"></div>' +
            '</div>' +
            '<div class="chud-joystick" id="chud-joystick" aria-hidden="true">' +
            '<div class="chud-joystick-knob" id="chud-joystick-knob"></div></div>' +
            '<div class="chud-dps" id="chud-dps" aria-hidden="true">' +
            '<span>擊殺<em id="chud-kills">0</em></span>' +
            '<span>EXP/分<em id="chud-expm">0</em></span>' +
            '<span>金/分<em id="chud-goldm">0</em></span>' +
            '</div>' +
            '<button type="button" class="chud-fab-log" id="chud-fab-log" title="戰鬥日誌">日誌</button>' +
            '<button type="button" class="chud-fab-town" id="chud-fab-town" title="回村莊">回村</button>' +
            '<button type="button" class="chud-auto is-on" id="chud-auto" title="自動戰鬥／掛機">' +
            '<span id="chud-auto-label">AUTO</span>' +
            '<span class="chud-auto-sub" id="chud-auto-sub">掛機</span></button>' +
            '<button type="button" class="chud-pvp" id="chud-pvp" title="野外 PK" aria-pressed="false">' +
            '<span class="chud-pvp-lab">PK</span>' +
            '<span class="chud-pvp-sub">關</span></button>' +
            '<div class="chud-hotbar" id="chud-hotbar" aria-label="技能快捷列"></div>';
        screen.appendChild(wrap);
        bindHud();
    }

    var _hudBusy = false;
    var _hudWantOn = null;
    function setCombatHud(on) {
        if (_hudBusy) return;
        _hudBusy = true;
        try {
            var screen = gs();
            if (!screen) return;
            var want = !!on;
            // 🩹 v3.8.458：任何 class 變動（log-open／低血／sheet-open）都會觸發 observer；
            // 若 HUD 已是目標狀態就直接返回，避免重跑熱鍵列／掛載→頁面無回應。
            if (_hudWantOn === want && screen.classList.contains('combat-hud') === want) {
                return;
            }
            _hudWantOn = want;
            ensureHudDom();
            screen.classList.toggle('combat-hud', want);
            if (want) {
                if (typeof state !== 'undefined' && state && state.autoHunt == null) state.autoHunt = true;
                syncAutoBtn();
                refreshHotbar(true);
                startAfkClock();
                syncTownMode();
                watchTownBattle();
                mountStatusIconBar();
                try { if (typeof fieldPvpUpdateToggleUi === 'function') fieldPvpUpdateToggleUi(); } catch (eP) {}
                // 🩹 v3.8.479：開 HUD 立刻重套大頭照（避免仍停在 display:none／無 src）
                try {
                    var _av = document.getElementById('status-avatar');
                    if (_av) {
                        _av.style.display = '';
                        _av.style.visibility = 'visible';
                        _av.style.opacity = '1';
                    }
                    if (typeof updateUI === 'function') updateUI();
                } catch (eAv) {}
                try {
                    if (typeof mapState !== 'undefined' && mapState && String(mapState.current || '').indexOf('town_') === 0
                        && typeof ensureTownMapBackground === 'function') {
                        ensureTownMapBackground(mapState.current);
                    }
                } catch (eTown) {}
            } else {
                stopAfkClock();
                screen.classList.remove('chud-in-town');
                endStick();
                if (typeof exploreSetVirtualStick === 'function') exploreSetVirtualStick(0, 0, false);
                mountStatusIconBar();
            }
        } finally {
            _hudBusy = false;
        }
    }

    function watchTownBattle() {
        if (_modeObs) return;
        var tv = document.getElementById('town-view');
        var bv = document.getElementById('battle-view');
        if (!tv && !bv) return;
        _modeObs = new MutationObserver(function () { syncTownMode(); });
        if (tv) _modeObs.observe(tv, { attributes: true, attributeFilter: ['class'] });
        if (bv) _modeObs.observe(bv, { attributes: true, attributeFilter: ['class'] });
        syncTownMode();
    }

    function startAfkClock() {
        stopAfkClock();
        _afkSec = 0;
        _afkTimer = setInterval(function () {
            try {
                if (typeof state === 'undefined' || !state || !state.running || state.autoHunt === false) return;
                if (isTownVisible()) return;
                _afkSec++;
                var btn = document.getElementById('chud-auto');
                if (btn) btn.title = '自動戰鬥／掛機 ' + Math.floor(_afkSec / 60) + ' 分';
            } catch (e) {}
        }, 1000);
    }
    function stopAfkClock() {
        if (_afkTimer) { clearInterval(_afkTimer); _afkTimer = null; }
    }

    function syncAutoBtn() {
        var btn = document.getElementById('chud-auto');
        var lab = document.getElementById('chud-auto-label');
        var sub = document.getElementById('chud-auto-sub');
        if (!btn) return;
        var on = !(typeof state !== 'undefined' && state && state.autoHunt === false);
        btn.classList.toggle('is-off', !on);
        btn.classList.toggle('is-on', on);
        if (lab) lab.textContent = on ? 'AUTO' : '手動';
        if (sub) sub.textContent = on ? '掛機' : 'OFF';
    }

    function toggleAuto() {
        if (typeof state === 'undefined' || !state) return;
        state.autoHunt = !(state.autoHunt !== false);
        if (state.autoHunt) {
            state.running = true;
            _afkSec = 0;
            try {
                if (typeof ensureGameTimers === 'function') ensureGameTimers();
                else if (typeof startGameTimers === 'function') startGameTimers();
            } catch (eT) {}
        }
        syncAutoBtn();
        try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
    }

    function syncLogFab() {
        var screen = gs();
        var logBtn = document.getElementById('chud-fab-log');
        if (!logBtn) return;
        var on = !!(screen && screen.classList.contains('log-open'));
        logBtn.textContent = on ? '收合' : '日誌';
        logBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
        logBtn.title = on ? '收合日誌' : '展開日誌';
    }

    function toggleLogDrawer() {
        var screen = gs();
        if (!screen) return;
        screen.classList.toggle('log-open');
        syncLogFab();
    }

    function setKnob(dx, dy) {
        var knob = document.getElementById('chud-joystick-knob');
        if (!knob) return;
        var max = 44;
        var x = Math.max(-max, Math.min(max, dx));
        var y = Math.max(-max, Math.min(max, dy));
        knob.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    }

    function dockJoystick() {
        var joy = document.getElementById('chud-joystick');
        if (!joy) return;
        joy.classList.remove('is-show', 'is-free');
        joy.classList.add('is-dock');
        joy.style.left = '';
        joy.style.top = '';
        joy.style.bottom = '';
        joy.style.margin = '';
        setKnob(0, 0);
    }

    function syncJoystickDomPos() {
        var joy = document.getElementById('chud-joystick');
        var screen = gs();
        if (!joy || !screen) return;
        var r = screen.getBoundingClientRect();
        // 中心錨點（搭配 .is-free 的 translate(-50%,-50%)）
        joy.style.left = (_stickOriginX - r.left) + 'px';
        joy.style.top = (_stickOriginY - r.top) + 'px';
        joy.style.bottom = 'auto';
        joy.style.margin = '0';
        joy.classList.add('is-free');
    }

    function placeJoystick(clientX, clientY) {
        var joy = document.getElementById('chud-joystick');
        var screen = gs();
        if (!joy || !screen) return;
        var r = screen.getBoundingClientRect();
        var x = clientX - r.left;
        var y = clientY - r.top;
        var pad = 84;
        var bottomReserve = 150;
        x = Math.max(pad, Math.min(r.width * 0.58, Math.min(r.width - pad, x)));
        y = Math.max(pad, Math.min(r.height - bottomReserve, y));
        _stickOriginX = r.left + x;
        _stickOriginY = r.top + y;
        joy.style.left = x + 'px';
        joy.style.top = y + 'px';
        joy.style.bottom = 'auto';
        joy.style.margin = '0';
        joy.classList.add('is-show', 'is-free');
        joy.classList.remove('is-dock');
        setKnob(0, 0);
    }

    function hideJoystick() { dockJoystick(); }

    function applyStick(clientX, clientY) {
        var dx = clientX - _stickOriginX;
        var dy = clientY - _stickOriginY;
        var max = 68;
        var len = Math.hypot(dx, dy) || 1;
        // 超出範圍才緩緩跟手（門檻較高，精準走位不易漂）
        if (len > max * 1.35) {
            var push = len - max;
            _stickOriginX += (dx / len) * push * 0.45;
            _stickOriginY += (dy / len) * push * 0.45;
            syncJoystickDomPos();
            dx = clientX - _stickOriginX;
            dy = clientY - _stickOriginY;
            len = Math.hypot(dx, dy) || 1;
        }
        var knobMax = 44;
        setKnob(dx * knobMax / max, dy * knobMax / max);
        var nx = dx / max;
        var ny = dy / max;
        var mag = Math.hypot(nx, ny);
        if (mag < 0.08) {
            if (typeof exploreSetVirtualStick === 'function') exploreSetVirtualStick(0, 0, true);
            return;
        }
        var curved = Math.min(1, mag);
        nx = (nx / mag) * curved;
        ny = (ny / mag) * curved;
        if (typeof exploreSetVirtualStick === 'function') exploreSetVirtualStick(nx, ny, true);
    }

    function endStick() {
        _stickActive = false;
        _stickId = null;
        hideJoystick();
        if (typeof exploreSetVirtualStick === 'function') exploreSetVirtualStick(0, 0, false);
    }

    function endTapMove() {
        _tapMoveActive = false;
        _tapMoveId = null;
        // 抵達後由 explore 自己清；鬆手仍繼續走到目的地
    }

    function cancelTapMove() {
        _tapMoveActive = false;
        _tapMoveId = null;
        if (typeof exploreClearTapMove === 'function') exploreClearTapMove();
    }

    function isUiBlockTarget(el) {
        if (!el || !el.closest) return false;
        return !!el.closest(
            '#chud-auto, #chud-pvp, #chud-hotbar, #chud-fab-log, #chud-fab-town, #chud-target, #col-left, #col-right, #log-row, ' +
            '#map-view-panel > .panel-header, #status-panel, .chud-dps, ' +
            '#tab-content-panel, #mobile-tab-sub, ' +
            '.mob-target, .town-npc, #status-icon-bar, #boss-marquee, #wb-schedule-panel, ' +
            'button, select, a, input, textarea, label'
        );
    }

    function pointerOnDock(clientX, clientY) {
        var joy = document.getElementById('chud-joystick');
        if (!joy) return false;
        var r = joy.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        // 底座可點區（約 0.9 倍半徑）
        return Math.hypot(clientX - cx, clientY - cy) <= Math.max(r.width, r.height) * 0.9;
    }

    function bindHud() {
        var screen = gs();
        var autoBtn = document.getElementById('chud-auto');
        var pvpBtn = document.getElementById('chud-pvp');
        var logBtn = document.getElementById('chud-fab-log');
        var townBtn = document.getElementById('chud-fab-town');
        if (autoBtn) autoBtn.onclick = function (e) { e.preventDefault(); toggleAuto(); };
        if (pvpBtn) pvpBtn.onclick = function (e) {
            e.preventDefault();
            try { if (typeof fieldPvpToggle === 'function') fieldPvpToggle(); } catch (err) {}
        };
        if (logBtn) logBtn.onclick = function (e) { e.preventDefault(); toggleLogDrawer(); };
        if (townBtn) townBtn.onclick = function (e) {
            e.preventDefault();
            try {
                if (typeof returnToTown === 'function') returnToTown();
                else if (typeof getLastTown === 'function' && typeof setMapSelectors === 'function' && typeof changeMap === 'function') {
                    setMapSelectors(getLastTown());
                    changeMap();
                }
            } catch (errT) {}
        };
        dockJoystick();
        if (!screen) {
            syncLogFab();
            return;
        }
        if (!screen._chudLogFabObs) {
            screen._chudLogFabObs = new MutationObserver(function () { syncLogFab(); });
            screen._chudLogFabObs.observe(screen, { attributes: true, attributeFilter: ['class'] });
        }
        syncLogFab();
        if (screen._chudStickBound) return;
        screen._chudStickBound = true;

        screen.addEventListener('pointerdown', function (e) {
            var s = gs();
            if (!s || s.classList.contains('hidden') || !s.classList.contains('combat-hud')) return;
            if (isTownVisible() || s.classList.contains('chud-in-town')) return;
            if (e.button != null && e.button !== 0) return;
            if (isUiBlockTarget(e.target)) return;
            var bv = document.getElementById('battle-view');
            if (!bv || bv.classList.contains('hidden')) return;
            var cc = document.getElementById('col-center');
            if (!bv.contains(e.target) && e.target !== bv && !(cc && cc.contains(e.target))) return;

            var onDock = pointerOnDock(e.clientX, e.clientY);

            // 🩹 v3.8.351：左下搖桿＝虛擬搖桿；點螢幕其餘處＝走向該點（不再把搖桿搬過去／放大）
            if (onDock) {
                e.preventDefault();
                cancelTapMove();
                _stickActive = true;
                _stickId = e.pointerId;
                try { screen.setPointerCapture(e.pointerId); } catch (err) {}
                var joy = document.getElementById('chud-joystick');
                if (joy) {
                    var jr = joy.getBoundingClientRect();
                    _stickOriginX = jr.left + jr.width / 2;
                    _stickOriginY = jr.top + jr.height / 2;
                    joy.classList.add('is-show');
                    joy.classList.remove('is-dock', 'is-free');
                    joy.style.left = '';
                    joy.style.top = '';
                    joy.style.bottom = '';
                    joy.style.margin = '';
                }
                applyStick(e.clientX, e.clientY);
                return;
            }

            // 點戰場 → 點選移動
            e.preventDefault();
            endStick();
            _tapMoveActive = true;
            _tapMoveId = e.pointerId;
            try { screen.setPointerCapture(e.pointerId); } catch (err2) {}
            if (typeof exploreSetTapMoveFromScreen === 'function') {
                exploreSetTapMoveFromScreen(e.clientX, e.clientY);
            }
        }, { passive: false });
        screen.addEventListener('pointermove', function (e) {
            if (_stickActive && (_stickId == null || e.pointerId === _stickId)) {
                e.preventDefault();
                applyStick(e.clientX, e.clientY);
                return;
            }
            if (_tapMoveActive && (_tapMoveId == null || e.pointerId === _tapMoveId)) {
                e.preventDefault();
                if (typeof exploreSetTapMoveFromScreen === 'function') {
                    exploreSetTapMoveFromScreen(e.clientX, e.clientY);
                }
            }
        }, { passive: false });
        screen.addEventListener('pointerup', function (e) {
            if (_stickActive && (_stickId == null || e.pointerId === _stickId)) {
                endStick();
                return;
            }
            if (_tapMoveActive && (_tapMoveId == null || e.pointerId === _tapMoveId)) {
                endTapMove();
            }
        });
        screen.addEventListener('pointercancel', function () {
            if (_stickActive) endStick();
            if (_tapMoveActive) endTapMove();
        });
        screen.addEventListener('lostpointercapture', function () {
            if (_stickActive) endStick();
            if (_tapMoveActive) endTapMove();
        });
    }

    function skillIconUrl(skId) {
        try {
            var sk = (typeof DB !== 'undefined' && DB.skills) ? DB.skills[skId] : null;
            if (sk && typeof getIconUrl === 'function') return getIconUrl(sk, true);
        } catch (e) {}
        return 'assets/icons/skills/' + encodeURIComponent(skId) + '.png';
    }

    /** 🩹 v3.9.16：普攻改武器圖（勿用 emoji） */
    function atkIconUrl() {
        var ver = (typeof GAME_VERSION !== 'undefined') ? GAME_VERSION : 'v3.9.16';
        return 'assets/icons/weapons/' + encodeURIComponent('克特之劍') + '.png?v=' + ver;
    }

    function refreshHotbar(force) {
        var bar = document.getElementById('chud-hotbar');
        if (!bar) return;
        var skills = [];
        try {
            if (typeof player !== 'undefined' && player && Array.isArray(player.skills)) {
                skills = player.skills.filter(function (id) {
                    var sk = (typeof DB !== 'undefined' && DB.skills) ? DB.skills[id] : null;
                    return sk && sk.type === 'manual';
                }).slice(0, 5);
            }
        } catch (e) {}
        var sig = skills.join('|');
        if (!force && sig === _hotbarSig && bar.childNodes.length) return;
        _hotbarSig = sig;
        bar.classList.add('is-ring');
        var html = '<button type="button" class="chud-hot-slot is-atk is-ready" title="一般攻擊" data-chud="atk">' +
            '<img class="chud-hot-ico" src="' + atkIconUrl() + '" alt="" onerror="this.onerror=null;this.src=\'assets/icons/weapons/' + encodeURIComponent('侵略者之劍') + '.png\'">' +
            '</button>';
        for (var i = 0; i < 5; i++) {
            var id = skills[i];
            if (!id) {
                html += '<button type="button" class="chud-hot-slot is-empty" disabled aria-label="空技能格"></button>';
                continue;
            }
            var name = (DB.skills[id] && DB.skills[id].n) || id;
            html += '<button type="button" class="chud-hot-slot is-ready" title="' + name.replace(/"/g, '') + '" data-sk="' + id + '">' +
                '<img class="chud-hot-ico" src="' + skillIconUrl(id) + '" alt="" onerror="this.style.opacity=\'0.2\'">' +
                '<span class="chud-hot-cd" hidden><span class="chud-hot-cd-num"></span></span></button>';
        }
        bar.innerHTML = html;
        bar.onclick = function (e) {
            var btn = e.target && e.target.closest ? e.target.closest('[data-sk],[data-chud]') : null;
            if (!btn) return;
            e.preventDefault();
            if (btn.getAttribute('data-chud') === 'atk') {
                try { if (typeof playerAttack === 'function') playerAttack(); } catch (err) {}
                return;
            }
            var sk = btn.getAttribute('data-sk');
            if (sk && typeof manualCast === 'function') {
                try { manualCast(sk); } catch (err2) {}
            }
            syncHotbarCds();
        };
        syncHotbarCds();
    }

    function syncHotbarCds() {
        var bar = document.getElementById('chud-hotbar');
        if (!bar) return;
        var cds = (typeof player !== 'undefined' && player && player.manualCd) ? player.manualCd : null;
        var slots = bar.querySelectorAll('[data-sk]');
        for (var i = 0; i < slots.length; i++) {
            var btn = slots[i];
            var sk = btn.getAttribute('data-sk');
            var cdEl = btn.querySelector('.chud-hot-cd');
            var numEl = btn.querySelector('.chud-hot-cd-num');
            if (!cdEl) continue;
            var ticks = cds ? (Number(cds[sk]) || 0) : 0;
            if (ticks > 0) {
                var max = Number(btn.getAttribute('data-cd-max')) || 0;
                if (ticks > max) {
                    max = ticks;
                    btn.setAttribute('data-cd-max', String(max));
                }
                var pct = max > 0 ? Math.max(0, Math.min(1, ticks / max)) : 0;
                btn.classList.add('is-cd');
                btn.classList.remove('is-ready');
                cdEl.hidden = false;
                cdEl.style.setProperty('--cd-pct', pct.toFixed(4));
                if (numEl) numEl.textContent = String(Math.max(1, Math.ceil(ticks / 10)));
            } else {
                btn.classList.remove('is-cd');
                btn.classList.add('is-ready');
                btn.removeAttribute('data-cd-max');
                cdEl.hidden = true;
                cdEl.style.removeProperty('--cd-pct');
                if (numEl) numEl.textContent = '';
            }
        }
    }

    /** 🩹 v3.9.40：頂部目標列停用；名稱／血條改怪卡上常顯 */
    function syncTargetHud() {
        var box = document.getElementById('chud-target');
        if (!box) return;
        box.classList.remove('is-show', 'is-boss');
        box.setAttribute('aria-hidden', 'true');
        try { box.style.display = 'none'; } catch (eHide) {}
    }

    function syncVitalAlert() {
        var screen = gs();
        if (!screen || typeof player === 'undefined' || !player) return;
        var mhp = Math.max(1, Number(player.mhp) || 1);
        var hp = Math.max(0, Number(player.hp) || 0);
        var pct = hp / mhp;
        screen.classList.toggle('chud-low-hp', pct > 0 && pct <= 0.25 && !player.dead);
        screen.classList.toggle('chud-crit-hp', pct > 0 && pct <= 0.12 && !player.dead);
        var panel = document.getElementById('status-panel');
        if (panel) {
            panel.classList.toggle('is-low-hp', pct > 0 && pct <= 0.25 && !player.dead);
            panel.classList.toggle('is-crit-hp', pct > 0 && pct <= 0.12 && !player.dead);
        }
    }

    function syncDpsChips() {
        try {
            var k = document.getElementById('chud-kills');
            var e = document.getElementById('chud-expm');
            var g = document.getElementById('chud-goldm');
            if (!k) return;
            var a = (typeof auditStats === 'function') ? auditStats() : null;
            k.textContent = String((a && a.kills) || 0);
            if (!a) return;
            var mins = Math.max(1 / 60, (Date.now() - (a.start || Date.now())) / 60000);
            if (e) e.textContent = String(Math.max(0, Math.floor((a.exp || 0) / mins)));
            if (g) {
                var goldGain = (typeof player !== 'undefined' && player)
                    ? ((player.gold || 0) - (a.gold0 || 0)) : 0;
                g.textContent = String(Math.max(0, Math.floor(goldGain / mins)));
            }
        } catch (err) {}
    }

    var _obs = null;
    var _obsHidden = null;
    function watchGameScreen() {
        var screen = gs();
        if (!screen) return;
        var on = !screen.classList.contains('hidden');
        _obsHidden = screen.classList.contains('hidden');
        setCombatHud(on);
        if (!_obs) {
            _obs = new MutationObserver(function () {
                var s = gs();
                if (!s) return;
                // 🩹 v3.8.458：只在 hidden 真正切換時開關 HUD（忽略 log-open／低血等 class）
                var hidden = s.classList.contains('hidden');
                if (hidden === _obsHidden) return;
                _obsHidden = hidden;
                setCombatHud(!hidden);
            });
            _obs.observe(screen, { attributes: true, attributeFilter: ['class'] });
        }
    }

    var _tabObs = null;
    function watchTabSheet() {
        var right = document.getElementById('col-right');
        var screen = gs();
        if (!right || !screen || _tabObs) return;
        function syncSheet() {
            var open = right.classList.contains('mobile-tab-open');
            // 🩹 v3.8.327：開關都走同一掛載函式（關也要移回右欄，勿只加 sheet-open）
            try {
                if (typeof _mountCombatHudSheet === 'function') _mountCombatHudSheet(open);
                else {
                    screen.classList.toggle('sheet-open', open);
                    var panel = document.getElementById('tab-content-panel');
                    var sub = document.getElementById('mobile-tab-sub');
                    if (open) {
                        if (panel && panel.parentElement !== screen) screen.appendChild(panel);
                        if (sub && sub.parentElement !== screen) screen.appendChild(sub);
                    }
                }
            } catch (e) {}
        }
        _tabObs = new MutationObserver(syncSheet);
        _tabObs.observe(right, { attributes: true, attributeFilter: ['class'] });
        syncSheet();
    }

    window.enableCombatHud = function () { setCombatHud(true); };
    window.disableCombatHud = function () { setCombatHud(false); };
    window.refreshCombatHudHotbar = refreshHotbar;
    window.syncCombatHudAuto = syncAutoBtn;
    window.syncCombatHudTownMode = syncTownMode;
    window.syncCombatHudLogFab = syncLogFab;

    var _hudBooted = false;
    // 🩹 v3.8.337：HUD 延到真正進遊戲再啟動（選角時 game-screen hidden，勿卡死載入）
    function boot() {
        try {
            var screen = gs();
            if (!screen || screen.classList.contains('hidden')) return;
        } catch (e0) { return; }
        if (_hudBooted) return;
        _hudBooted = true;
        ensureHudDom();
        watchGameScreen();
        watchTabSheet();
        watchTownBattle();
        setInterval(function () {
            var s = gs();
            if (!s || s.classList.contains('hidden') || !s.classList.contains('combat-hud')) return;
            // 只同步村莊狀態，勿再走 setCombatHud
            try { syncTownMode(); } catch (eT) {}
            refreshHotbar(false);
            syncDpsChips();
            syncAutoBtn();
        }, 1200);
        setInterval(function () {
            var s = gs();
            if (!s || s.classList.contains('hidden') || !s.classList.contains('combat-hud')) return;
            if (isTownVisible()) {
                syncTargetHud();
                return;
            }
            syncHotbarCds();
            syncTargetHud();
            syncVitalAlert();
        }, 200);
    }

    function scheduleBoot() {
        setTimeout(boot, 0);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleBoot);
    else scheduleBoot();
    try {
        var _gs = document.getElementById('game-screen');
        if (_gs && window.MutationObserver) {
            var _hudObs = new MutationObserver(function () {
                if (_gs && !_gs.classList.contains('hidden')) scheduleBoot();
            });
            _hudObs.observe(_gs, { attributes: true, attributeFilter: ['class'] });
        }
    } catch (eObs) {}
})();

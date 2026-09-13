// ===== 🎮 v3.8.260 戰鬥優先 HUD：隱藏式全螢幕搖桿／AUTO／快捷列／日誌抽屜 =====
(function () {
    'use strict';

    var _stickActive = false;
    var _stickId = null;
    var _stickOriginX = 0;
    var _stickOriginY = 0;
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
        screen.classList.toggle('chud-in-town', inTown);
        if (inTown) {
            endStick();
            if (typeof exploreSetVirtualStick === 'function') exploreSetVirtualStick(0, 0, false);
        }
    }

    function ensureHudDom() {
        var screen = gs();
        if (!screen || document.getElementById('combat-hud-controls')) return;
        var wrap = document.createElement('div');
        wrap.id = 'combat-hud-controls';
        wrap.innerHTML =
            '<div class="chud-joystick" id="chud-joystick" aria-hidden="true">' +
            '<div class="chud-joystick-knob" id="chud-joystick-knob"></div></div>' +
            '<div class="chud-dps" id="chud-dps" aria-hidden="true">' +
            '<span>擊殺<em id="chud-kills">0</em></span>' +
            '<span>EXP/分<em id="chud-expm">0</em></span>' +
            '<span>金/分<em id="chud-goldm">0</em></span>' +
            '</div>' +
            '<button type="button" class="chud-fab-log" id="chud-fab-log" title="戰鬥日誌">日誌</button>' +
            '<button type="button" class="chud-auto is-on" id="chud-auto" title="自動戰鬥／掛機">' +
            '<span id="chud-auto-label">AUTO</span>' +
            '<span class="chud-auto-sub" id="chud-auto-sub">掛機</span></button>' +
            '<div class="chud-hotbar" id="chud-hotbar" aria-label="技能快捷列"></div>';
        screen.appendChild(wrap);
        bindHud();
    }

    function setCombatHud(on) {
        var screen = gs();
        if (!screen) return;
        ensureHudDom();
        screen.classList.toggle('combat-hud', !!on);
        if (on) {
            if (typeof state !== 'undefined' && state && state.autoHunt == null) state.autoHunt = true;
            syncAutoBtn();
            refreshHotbar(true);
            startAfkClock();
            syncTownMode();
            watchTownBattle();
        } else {
            stopAfkClock();
            screen.classList.remove('chud-in-town');
            endStick();
            if (typeof exploreSetVirtualStick === 'function') exploreSetVirtualStick(0, 0, false);
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
        }
        syncAutoBtn();
        try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
    }

    function toggleLogDrawer() {
        var screen = gs();
        if (!screen) return;
        screen.classList.toggle('log-open');
    }

    function setKnob(dx, dy) {
        var knob = document.getElementById('chud-joystick-knob');
        if (!knob) return;
        var max = 36;
        var x = Math.max(-max, Math.min(max, dx));
        var y = Math.max(-max, Math.min(max, dy));
        knob.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    }

    function dockJoystick() {
        var joy = document.getElementById('chud-joystick');
        if (!joy) return;
        joy.classList.remove('is-show');
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
        joy.style.left = (_stickOriginX - r.left) + 'px';
        joy.style.top = (_stickOriginY - r.top) + 'px';
        joy.style.bottom = 'auto';
        joy.style.margin = '0';
    }

    function placeJoystick(clientX, clientY) {
        var joy = document.getElementById('chud-joystick');
        var screen = gs();
        if (!joy || !screen) return;
        var r = screen.getBoundingClientRect();
        var x = clientX - r.left;
        var y = clientY - r.top;
        var pad = 66;
        var bottomReserve = 130;
        x = Math.max(pad, Math.min(r.width * 0.62, Math.min(r.width - pad, x)));
        y = Math.max(pad, Math.min(r.height - bottomReserve, y));
        _stickOriginX = r.left + x;
        _stickOriginY = r.top + y;
        joy.style.left = x + 'px';
        joy.style.top = y + 'px';
        joy.style.bottom = 'auto';
        joy.style.margin = '0';
        joy.classList.add('is-show');
        joy.classList.remove('is-dock');
        setKnob(0, 0);
    }

    function hideJoystick() { dockJoystick(); }

    function applyStick(clientX, clientY) {
        var dx = clientX - _stickOriginX;
        var dy = clientY - _stickOriginY;
        var max = 54;
        var len = Math.hypot(dx, dy) || 1;
        if (len > max) {
            var push = len - max;
            _stickOriginX += (dx / len) * push;
            _stickOriginY += (dy / len) * push;
            syncJoystickDomPos();
            dx = clientX - _stickOriginX;
            dy = clientY - _stickOriginY;
            len = Math.hypot(dx, dy) || 1;
        }
        setKnob(dx * 36 / max, dy * 36 / max);
        var nx = dx / max;
        var ny = dy / max;
        var mag = Math.hypot(nx, ny);
        if (mag < 0.12) {
            if (typeof exploreSetVirtualStick === 'function') exploreSetVirtualStick(0, 0, true);
            return;
        }
        var curved = Math.min(1, Math.pow(mag, 0.9));
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

    function isUiBlockTarget(el) {
        if (!el || !el.closest) return false;
        return !!el.closest(
            '#chud-auto, #chud-hotbar, #chud-fab-log, #col-left, #col-right, #log-row, ' +
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
        return Math.hypot(clientX - cx, clientY - cy) <= Math.max(r.width, r.height) * 0.62;
    }

    function bindHud() {
        var screen = gs();
        var autoBtn = document.getElementById('chud-auto');
        var logBtn = document.getElementById('chud-fab-log');
        if (autoBtn) autoBtn.onclick = function (e) { e.preventDefault(); toggleAuto(); };
        if (logBtn) logBtn.onclick = function (e) { e.preventDefault(); toggleLogDrawer(); };
        dockJoystick();
        if (!screen || screen._chudStickBound) return;
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

            var sr = s.getBoundingClientRect();
            var relX = (e.clientX - sr.left) / Math.max(1, sr.width);
            var relY = (e.clientY - sr.top) / Math.max(1, sr.height);
            var onDock = pointerOnDock(e.clientX, e.clientY);
            if (!onDock && (relX > 0.55 || relY > 0.84)) return;

            e.preventDefault();
            _stickActive = true;
            _stickId = e.pointerId;
            try { screen.setPointerCapture(e.pointerId); } catch (err) {}
            if (onDock) {
                var joy = document.getElementById('chud-joystick');
                if (joy) {
                    var jr = joy.getBoundingClientRect();
                    _stickOriginX = jr.left + jr.width / 2;
                    _stickOriginY = jr.top + jr.height / 2;
                    joy.classList.add('is-show');
                    joy.classList.remove('is-dock');
                }
            } else {
                placeJoystick(e.clientX, e.clientY);
            }
            applyStick(e.clientX, e.clientY);
        }, { passive: false });
        screen.addEventListener('pointermove', function (e) {
            if (!_stickActive || (_stickId != null && e.pointerId !== _stickId)) return;
            e.preventDefault();
            applyStick(e.clientX, e.clientY);
        }, { passive: false });
        screen.addEventListener('pointerup', function (e) {
            if (!_stickActive || (_stickId != null && e.pointerId !== _stickId)) return;
            endStick();
        });
        screen.addEventListener('pointercancel', function () {
            if (_stickActive) endStick();
        });
        screen.addEventListener('lostpointercapture', function () {
            if (_stickActive) endStick();
        });
    }

    function skillIconUrl(skId) {
        try {
            var sk = (typeof DB !== 'undefined' && DB.skills) ? DB.skills[skId] : null;
            if (sk && typeof getIconUrl === 'function') return getIconUrl(sk, true);
        } catch (e) {}
        return 'assets/icons/skills/' + encodeURIComponent(skId) + '.png';
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
        var html = '<button type="button" class="chud-hot-slot is-atk" title="一般攻擊" data-chud="atk">⚔</button>';
        for (var i = 0; i < 5; i++) {
            var id = skills[i];
            if (!id) {
                html += '<button type="button" class="chud-hot-slot is-empty" disabled></button>';
                continue;
            }
            var name = (DB.skills[id] && DB.skills[id].n) || id;
            html += '<button type="button" class="chud-hot-slot" title="' + name.replace(/"/g, '') + '" data-sk="' + id + '">' +
                '<img src="' + skillIconUrl(id) + '" alt="" onerror="this.style.display=\'none\'"></button>';
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
        };
    }

    function syncDpsChips() {
        try {
            var k = document.getElementById('chud-kills');
            var e = document.getElementById('chud-expm');
            var g = document.getElementById('chud-goldm');
            if (!k) return;
            var audit = (typeof player !== 'undefined' && player && player.audit) ? player.audit : null;
            if (audit && k) k.textContent = String(audit.kills || 0);
            if (e && typeof player !== 'undefined' && player) {
                e.textContent = String(Math.max(0, Math.floor((player._expPerMin || 0))));
            }
            if (g && typeof player !== 'undefined' && player) {
                g.textContent = String(Math.max(0, Math.floor((player._goldPerMin || 0))));
            }
        } catch (err) {}
    }

    var _obs = null;
    function watchGameScreen() {
        var screen = gs();
        if (!screen) return;
        var on = !screen.classList.contains('hidden');
        setCombatHud(on);
        if (!_obs) {
            _obs = new MutationObserver(function () {
                var s = gs();
                if (!s) return;
                setCombatHud(!s.classList.contains('hidden'));
            });
            _obs.observe(screen, { attributes: true, attributeFilter: ['class'] });
        }
    }

    var _tabObs = null;
    function watchTabSheet() {
        var right = document.getElementById('col-right');
        var screen = gs();
        if (!right || !screen || _tabObs) return;
        _tabObs = new MutationObserver(function () {
            screen.classList.toggle('sheet-open', right.classList.contains('mobile-tab-open'));
        });
        _tabObs.observe(right, { attributes: true, attributeFilter: ['class'] });
    }

    window.enableCombatHud = function () { setCombatHud(true); };
    window.disableCombatHud = function () { setCombatHud(false); };
    window.refreshCombatHudHotbar = refreshHotbar;
    window.syncCombatHudAuto = syncAutoBtn;
    window.syncCombatHudTownMode = syncTownMode;

    function boot() {
        ensureHudDom();
        watchGameScreen();
        watchTabSheet();
        watchTownBattle();
        setInterval(function () {
            var s = gs();
            if (!s || s.classList.contains('hidden') || !s.classList.contains('combat-hud')) return;
            syncTownMode();
            refreshHotbar(false);
            syncDpsChips();
            syncAutoBtn();
        }, 1200);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();

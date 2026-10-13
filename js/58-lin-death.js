/* 死亡（原版天堂）：倒地不自動回村，畫面中間跳「重新開始」視窗，按下才回村甦醒（revive） */
(function () {
    'use strict';
    var _el = null;

    function build() {
        if (_el) return _el;
        _el = document.createElement('div');
        _el.id = 'lin-death';
        _el.className = 'lin-death hidden';
        _el.innerHTML =
            '<div class="lm-frame lin-death-frame">' +
            '<div class="lm-title">死亡</div>' +
            '<div class="lin-death-msg">你已經死亡。<br>要重新開始嗎？</div>' +
            '<div class="lin-death-sub">重新開始會回到村莊甦醒</div>' +
            '<button type="button" class="lm-btn lin-death-btn" id="lin-death-restart">重新開始</button>' +
            '</div>';
        (document.getElementById('app-stage') || document.body).appendChild(_el);
        _el.querySelector('#lin-death-restart').addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            linDeathRestart();
        });
        return _el;
    }

    function duelExempt() {
        try { return typeof pvpArenaDeathExempt === 'function' && pvpArenaDeathExempt(); } catch (e) { return false; }
    }

    function shouldShow() {
        if (typeof player === 'undefined' || !player || !player.dead) return false;
        var gs = document.getElementById('game-screen');
        if (!gs || gs.classList.contains('hidden')) return false;
        return !duelExempt();
    }

    function linDeathRestart() {
        if (typeof player === 'undefined' || !player || !player.dead) { linDeathSync(); return; }
        try {
            if (typeof revive === 'function') revive();
        } catch (eRev) {
            try {
                player.dead = false;
                player.hp = 1;
                var home = (typeof getHomeTown === 'function') ? getHomeTown() : 'town_giran';
                if (typeof setMapSelectors === 'function') setMapSelectors(home);
                if (typeof changeMap === 'function') changeMap(true);
            } catch (eFb) {}
        }
        linDeathSync();
    }

    function linDeathSync() {
        var on = shouldShow();
        if (!on && !_el) return;
        var el = build();
        if (el.classList.contains('hidden') === !on) return;
        el.classList.toggle('hidden', !on);
    }

    window.linDeathRestart = linDeathRestart;
    window.linDeathSync = linDeathSync;
    setInterval(linDeathSync, 300);
})();

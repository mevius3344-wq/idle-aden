// 設定／內掛選單／輔助設定（照新創：石紋金框視窗＋分頁）
// 設定欄位沿用 #tab-automation 裡原本的元素（同 id，存檔與自動化照讀），開窗時搬進對應分頁。
(function () {
    'use strict';

    var WINS = {
        settings: { title: '設定', sub: '遊戲選單' },
        auto: { title: '內掛選單', tabs: [['hunt', '狩獵'], ['supply', '補給'], ['magic', '魔法'], ['summon', '召喚']] },
        assist: { title: '輔助設定', tabs: [['general', '一般'], ['potion', '藥水'], ['status', '狀態'], ['aux', '輔助']] }
    };
    var _tab = { auto: 'hunt', assist: 'general' };

    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function grab(id) { var e = $(id); return e || document.createElement('span'); }
    function labelOf(id) { var e = $(id); return (e && e.closest('label')) || grab(id); }
    function row() {
        var r = document.createElement('div');
        r.className = 'lm-row';
        for (var i = 0; i < arguments.length; i++) {
            var a = arguments[i];
            if (a == null) continue;
            if (typeof a === 'string') { var s = document.createElement('span'); s.innerHTML = a; r.appendChild(s); }
            else r.appendChild(a);
        }
        return r;
    }
    function note(txt) { var d = document.createElement('div'); d.className = 'lm-note'; d.textContent = txt; return d; }
    function head(txt) { var d = document.createElement('div'); d.className = 'lm-head'; d.textContent = txt; return d; }
    function box() { var d = document.createElement('div'); d.className = 'lm-box'; for (var i = 0; i < arguments.length; i++) if (arguments[i]) d.appendChild(arguments[i]); return d; }
    function btn(txt, fn, cls) { var b = document.createElement('button'); b.type = 'button'; b.className = 'lm-btn' + (cls ? ' ' + cls : ''); b.textContent = txt; b.addEventListener('click', fn); return b; }

    // 應急道具：主城符＋身上有的村莊傳送卷軸
    function fillEmergItems() {
        var sel = $('set-emerg-item');
        if (!sel) return;
        var cur = sel.value || 'fn_home';
        var ids = ['fn_home'];
        Object.keys(DB.items).forEach(function (id) {
            var d = DB.items[id];
            if (d && (d.eff === 'town_tp' || d.eff === 'town_recall') && ids.indexOf(id) < 0) ids.push(id);
        });
        sel.innerHTML = ids.map(function (id) {
            var have = (player && player.inv || []).some(function (i) { return i.id === id; });
            return '<option value="' + id + '">' + esc((DB.items[id] || {}).n || id) + (have ? '' : '（無）') + '</option>';
        }).join('');
        sel.value = ids.indexOf(cur) >= 0 ? cur : 'fn_home';
    }

    function syncAutoBtn(w) {
        var b = w && w.querySelector('.lm-auto-toggle');
        if (!b) return;
        var on = !(typeof state !== 'undefined' && state && state.autoHunt === false);
        b.textContent = on ? '停止掛機' : '開始掛機';
        b.classList.toggle('is-on', on);
    }

    function buildPane(kind, key) {
        var p = document.createElement('div');
        p.className = 'lm-pane';
        p.setAttribute('data-pane', key);
        if (kind === 'auto' && key === 'hunt') {
            var tg = btn('開始掛機', function () { var a = $('chud-auto'); if (a) a.click(); syncAutoBtn(p.closest('.lm-win')); }, 'lm-auto-toggle');
            p.appendChild(tg);
            p.appendChild(box(
                row('巡邏範圍', grab('set-patrol'), '格'),
                note('以開始掛機的位置為中心，只打 N 格內的怪，打完走回原點（0＝不限制）。'),
                row(labelOf('set-teleport')),
                row(labelOf('set-nomob-tp')),
                note('看見頭目自動瞬移、附近沒怪自動瞬移都用瞬間移動卷軸（沒有時自動買）。')));
        } else if (kind === 'auto' && key === 'supply') {
            p.appendChild(box(
                head('自動購買選單'),
                row(labelOf('set-auto-buy-pot'), '一次購買 ×', grab('set-buy-qty-pot')),
                note('補血藥水用完（0 瓶）時，買「輔助設定→藥水」選的那一種。'),
                row(labelOf('set-auto-buy-arrow'), '一次購買 ×', grab('set-buy-qty-arrow')),
                note('加速、勇敢、變身等狀態道具在「輔助設定→狀態」勾選，沒有時自動買 1 個。')));
        } else if (kind === 'auto' && key === 'magic') {
            p.appendChild(box(
                head('攻擊魔法'),
                row('使用', grab('sel-atk-skill')),
                row('魔力低於', grab('set-mp-atk'), '% 時不施法，改用普通攻擊'),
                note('只會在掛機打怪時施放；清單是已學會的攻擊魔法。')));
            p.appendChild(box(
                head('治癒魔法'),
                row('使用', grab('sel-heal-skill')),
                row('HP 低於', grab('set-mp-heal'), '% 時施放')));
            p.appendChild(box(
                head('消耗 HP 的技能'),
                row('HP 低於', grab('set-hp-skill'), '% 時暫停施放'),
                note('所有會扣 HP 的技能（含轉換魔法）都看這個門檻；0＝不限制。')));
            var cv = $('ui-convert-row');
            if (cv) p.appendChild(box(head('洗魔魔法'), cv));
        } else if (kind === 'auto' && key === 'summon') {
            p.appendChild(box(
                head('寵物補血'),
                row('寵物體力低於', grab('set-pet-heal-hp'), '% 時喝補血藥水'),
                note('用「輔助設定→藥水」選的補血藥水；寵物保管裡個別設定過的寵物以個別設定為準。0＝只看個別設定。')));
            p.appendChild(box(
                head('自動召喚'),
                note('召喚術、召喚屬性精靈等召喚魔法在「輔助設定→狀態」的魔法清單勾選，召喚物消失時自動再召喚。')));
        } else if (kind === 'assist' && key === 'general') {
            p.appendChild(box(
                head('一般顯示設定'),
                row(labelOf('set-vfx-on')),
                row(labelOf('set-vfxnum-on')),
                row(labelOf('set-power-save')),
                note('省電模式會關閉戰鬥特效與傷害數字，降低換幀，手機較不發燙。')));
        } else if (kind === 'assist' && key === 'potion') {
            p.appendChild(box(
                head('補血'),
                row(grab('set-pot'), 'HP 小於', grab('set-hp-pot'), '%')));
            p.appendChild(box(
                head('應急'),
                row('HP 小於', grab('set-emerg-hp'), '% 使用', grab('set-emerg-item')),
                note('建議設定回城道具；回到村莊就不再觸發。0＝關閉。')));
        } else if (kind === 'assist' && key === 'status') {
            var g = document.createElement('div');
            g.className = 'lm-grid';
            ['set-haste', 'ui-brave-row', 'set-blue', 'ui-cautious-row', 'ui-elfcookie-row', 'set-poly', 'set-magicbarrier'].forEach(function (id) {
                var e = /^ui-/.test(id) ? $(id) : labelOf(id);
                if (e) g.appendChild(e);
            });
            p.appendChild(box(head('補狀態道具'), g, note('勾選的會自動保持；沒有時自動買 1 個。')));
            var ab = $('auto-buff-skills');
            if (ab) p.appendChild(box(head('補狀態魔法'), ab, note('已學會的輔助、召喚魔法；勾選的會自動保持。')));
        } else if (kind === 'assist' && key === 'aux') {
            p.appendChild(box(
                head('自動解毒'),
                row(labelOf('set-auto-cure')),
                note('中毒時自動飲用翡翠藥水（沒有時自動買 1 瓶）。學會解毒術的職業也可在「狀態」勾選解毒術。')));
            p.appendChild(box(
                head('自動變身'),
                note('在「狀態」勾選變形卷軸，變身效果消失時自動使用。')));
        }
        return p;
    }

    function wrapCureLabel() {
        var c = $('set-auto-cure');
        if (c && !c.closest('label')) {
            var l = document.createElement('label');
            l.className = 'cursor-pointer flex items-center gap-2';
            c.parentNode.insertBefore(l, c);
            l.appendChild(c);
            l.insertAdjacentHTML('beforeend', ' <span>中毒時自動使用翡翠藥水</span>');
        }
    }

    function settingsList(w) {
        var body = w.querySelector('.lm-body');
        body.innerHTML = '';
        var list = document.createElement('div');
        list.className = 'lm-list';
        var ps = $('set-power-save');
        var fsOn = !!document.fullscreenElement;
        [
            ['輔助設定（喝水／狀態／解毒／變身）', function () { linMenuOpen('assist'); }],
            ['內掛選單（巡邏／補給／魔法／召喚）', function () { linMenuOpen('auto'); }],
            ['自動賣出', function () { linMenuClose(); if (typeof openAutoSellRules === 'function') openAutoSellRules(); }],
            ['書籤', function () { linMenuClose(); if (typeof bookmarkOpen === 'function') bookmarkOpen(); }],
            ['排行榜', function () { if (typeof linRankOpen === 'function') linRankOpen(); }],
            ['音樂／音效音量', function () { audioPage(w); }],
            ['畫面：' + (ps && ps.checked ? '省電（目前）→ 點一下改標準' : '標準（目前）→ 點一下改省電'), function () {
                if (!ps) return;
                ps.checked = !ps.checked;
                try { setPowerSaveOn(ps.checked); } catch (e) {}
                settingsList(w);
            }],
            [fsOn ? '離開全螢幕' : '全螢幕顯示', function () {
                try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {}
                setTimeout(function () { settingsList(w); }, 300);
            }],
            ['回選角', function () { linMenuClose(); if (typeof returnToCharacterSelect === 'function') returnToCharacterSelect(); }],
            ['刪除角色', function () { linMenuClose(); if (typeof deleteCurrentCharacter === 'function') deleteCurrentCharacter(); }, 'is-danger'],
            ['離開', function () { linMenuClose(); }]
        ].forEach(function (it) { list.appendChild(btn(it[0], it[1], it[2])); });
        body.appendChild(list);
    }

    function audioPage(w) {
        var body = w.querySelector('.lm-body');
        body.innerHTML = '';
        body.appendChild(box(
            head('音樂（背景音樂）'),
            row(labelOf('set-bgm-on'), grab('set-bgm-vol'))));
        body.appendChild(box(
            head('音效（攻擊、技能等）'),
            row(labelOf('set-sfx-on'), grab('set-sfx-vol'))));
        body.appendChild(btn('返回遊戲選單', function () { settingsList(w); }, 'lm-back'));
    }

    function build(kind) {
        var id = 'lm-win-' + kind;
        var w = $(id);
        if (w) return w;
        var cfg = WINS[kind];
        w = document.createElement('div');
        w.id = id;
        w.className = 'lm-win hidden';
        w.innerHTML = '<div class="lm-frame">' +
            '<div class="lm-title">' + esc(cfg.title) + '<button type="button" class="lm-x" aria-label="關閉">×</button></div>' +
            (cfg.sub ? '<div class="lm-sub">' + esc(cfg.sub) + '</div>' : '') +
            (cfg.tabs ? '<div class="lm-tabs">' + cfg.tabs.map(function (t) { return '<button type="button" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>'; }).join('') + '</div>' : '') +
            '<div class="lm-body"></div></div>';
        w.addEventListener('click', function (ev) {
            if (ev.target === w || ev.target.closest('.lm-x')) { linMenuClose(); return; }
            var t = ev.target.closest('.lm-tabs [data-tab]');
            if (t) showTab(kind, t.getAttribute('data-tab'));
        });
        document.body.appendChild(w);
        if (cfg.tabs) {
            wrapCureLabel();
            var body = w.querySelector('.lm-body');
            cfg.tabs.forEach(function (t) { body.appendChild(buildPane(kind, t[0])); });
        }
        return w;
    }

    function showTab(kind, key) {
        var w = $('lm-win-' + kind);
        if (!w) return;
        _tab[kind] = key;
        w.querySelectorAll('.lm-tabs [data-tab]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === key); });
        w.querySelectorAll('.lm-pane').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-pane') === key); });
    }

    function linMenuClose() {
        document.querySelectorAll('.lm-win').forEach(function (w) { w.classList.add('hidden'); });
        try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
    }

    function linMenuOpen(kind) {
        if (!WINS[kind]) kind = 'settings';
        document.querySelectorAll('.lm-win').forEach(function (w) { w.classList.add('hidden'); });
        try { if (typeof setMobileTabPanelOpen === 'function') setMobileTabPanelOpen(false); } catch (e) {}
        try { if (typeof renderSkillSelects === 'function' && player && player.cls) renderSkillSelects(); } catch (e) {}
        try { if (typeof updateClassPotionRows === 'function') updateClassPotionRows(); } catch (e) {}
        var w = build(kind);
        if (kind === 'settings') settingsList(w);
        else showTab(kind, _tab[kind]);
        if (kind === 'assist') fillEmergItems();
        syncAutoBtn(w);
        w.classList.remove('hidden');
        return w;
    }

    window.linMenuOpen = linMenuOpen;
    window.linMenuClose = linMenuClose;
})();

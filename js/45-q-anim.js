// ===== 🎨 v3.8.207 韓國 Q 版（已停用）=====
// 🩹 v3.8.348：新 Q 造型無動態→永久關閉；人物走 classanim、怪物走 assets/anim（舊版有動態）
(function () {
    'use strict';

    var Q_FPS = 8;
    var _mobPackCache = Object.create(null);
    var _playerPackCache = Object.create(null);
    var _bootOnce = false;

    try { window.Q_PLAYER_SKIN = false; } catch (e0) {}
    try { window.Q_BATTLE_SKIN = false; } catch (e1) {}
    try {
        if (typeof _lsSet === 'function') {
            _lsSet('fb5_q_player', '0');
            _lsSet('fb5_q_battle', '0');
        } else {
            localStorage.setItem('fb5_q_player', '0');
            localStorage.setItem('fb5_q_battle', '0');
        }
    } catch (e2) {}

    function qBattleSkinOn() { return false; }
    function qPlayerPackEnabled() { return false; }
    function setClassicPixelLook() { return true; }
    function isClassicPixelLook() { return true; }

    function qSafeSeg(s) {
        return String(s || '').replace(/[\\\/:*?"<>|]/g, '_');
    }

    function qMobPackDir(name) {
        return 'assets/qskin/mobs/' + qSafeSeg(name) + '/';
    }

    function qPlayerPackDir(cls, avatar) {
        var c = String(cls || 'knight');
        if (c === 'illusion') c = 'mage';
        // 👑 王族獨立包；戰士／龍騎暫共用騎士；黑暗妖精用 dark／dark_f
        if (c === 'warrior' || c === 'dragon') c = 'knight';
        if (c !== 'elf' && c !== 'mage' && c !== 'knight' && c !== 'royal' && c !== 'dark') c = 'knight';
        var av = avatar;
        if (av == null) {
            try { av = (typeof player !== 'undefined' && player) ? player.avatar : ''; } catch (e) { av = ''; }
        }
        if (/女|公主/.test(String(av || ''))) c = c + '_f';
        return 'assets/qskin/player/' + c + '/';
    }

    function qProbeFrames(baseDir, acts, maxN, done) {
        var out = {};
        var pending = 0;
        var any = false;
        acts.forEach(function (act) {
            out[act] = [];
            for (var i = 0; i < maxN; i++) {
                (function (action, idx) {
                    pending++;
                    var url = baseDir + action + '_' + idx + '.png';
                    var im = new Image();
                    im.onload = function () {
                        out[action][idx] = url;
                        any = true;
                        pending--;
                        if (pending <= 0) done(any ? out : null);
                    };
                    im.onerror = function () {
                        pending--;
                        if (pending <= 0) done(any ? out : null);
                    };
                    im.src = url + (url.indexOf('?') >= 0 ? '' : ('?v=' + (window.GAME_VERSION || 'q')));
                })(act, i);
            }
        });
        if (pending <= 0) done(null);
    }

    function qCompact(arr) {
        if (!arr) return [];
        var r = [];
        for (var i = 0; i < arr.length; i++) if (arr[i]) r.push(arr[i]);
        return r;
    }

    function qGetMobPack(name) {
        if (!name) return null;
        var c = _mobPackCache[name];
        if (c === null) return null;
        if (c && c !== 'probing') return c;
        if (c === 'probing') return null;
        _mobPackCache[name] = 'probing';
        // 需有 q.json 才算「真 Q 包」，避免誤用從 anim 複製的種子蓋掉原生多幀戰鬥動畫
        var metaUrl = qMobPackDir(name) + 'q.json';
        fetch(metaUrl).then(function (r) {
            if (!r.ok) throw new Error('no q meta');
            return r.json();
        }).then(function () {
            qProbeFrames(qMobPackDir(name), ['idle', 'attack', 'hurt'], 6, function (raw) {
                if (!raw) { _mobPackCache[name] = null; return; }
                var pack = {
                    ready: true,
                    idle: qCompact(raw.idle),
                    attack: qCompact(raw.attack),
                    hurt: qCompact(raw.hurt)
                };
                if (!pack.idle.length && !pack.attack.length) { _mobPackCache[name] = null; return; }
                if (!pack.idle.length) pack.idle = pack.attack.slice();
                _mobPackCache[name] = pack;
                try { if (typeof renderMobs === 'function') renderMobs(); } catch (e) {}
            });
        }).catch(function () {
            _mobPackCache[name] = null;
        });
        return null;
    }

    function qGetPlayerPack(cls, avatar) {
        if (!qPlayerPackEnabled()) return null;
        var av = avatar;
        if (av == null) {
            try { av = (typeof player !== 'undefined' && player) ? player.avatar : ''; } catch (e) { av = ''; }
        }
        var folderKey = qPlayerPackDir(cls, av).replace(/^assets\/qskin\/player\//, '').replace(/\/$/, '');
        // 女角無 *_f 包時不探測男包，避免男女同造型
        if (/_f$/.test(folderKey) && window._qPackFolderExist && window._qPackFolderExist[folderKey] === false) {
            return null;
        }
        var key = folderKey;
        var c = _playerPackCache[key];
        if (c === null) return null;
        if (c && c !== 'probing') return c;
        if (c === 'probing') return null;
        _playerPackCache[key] = 'probing';
        qProbeFrames(qPlayerPackDir(cls, av), ['idle', 'walk', 'attack'], 8, function (raw) {
            if (!raw) { _playerPackCache[key] = null; return; }
            var pack = {
                idle: qCompact(raw.idle),
                walk: qCompact(raw.walk),
                attack: qCompact(raw.attack)
            };
            if (!pack.idle.length) { _playerPackCache[key] = null; return; }
            _playerPackCache[key] = pack;
        });
        return null;
    }

    /** 有專用 Q 包（且含 q.json）→回第一幀；否則 null＝走各怪唯一 anim */
    function qMobSpriteFor(m) {
        if (!m || !qBattleSkinOn()) return null;
        if (m.siegeEnemy && m.race === '建築') return null;
        var pack = qGetMobPack(m.n);
        if (pack && pack.ready && pack.idle && pack.idle[0]) return pack.idle[0];
        return null;
    }

    /** 狀態欄等：回傳 Q idle 第一幀；未就緒→null 用原本 character 頭像 */
    function qPlayerSpriteFor(clsHint, avatarHint) {
        if (!qPlayerPackEnabled()) return null;
        var cls = clsHint || ((typeof player !== 'undefined' && player && player.cls) ? player.cls : 'knight');
        var av = avatarHint;
        if (av == null) {
            try { av = (typeof player !== 'undefined' && player) ? player.avatar : ''; } catch (e) { av = ''; }
        }
        // 女角優先維持 character/<avatar>.png（男女頭像本就分開）
        if (/女|公主/.test(String(av || ''))) return null;
        var pack = qGetPlayerPack(cls, av);
        if (pack && pack.idle && pack.idle[0]) return pack.idle[0];
        return null;
    }

    function qPastelInline(name, uid) {
        var h = 0;
        var s = String(name || 'm') + '|' + String(uid || '');
        for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
        h = Math.abs(h);
        var rims = ['#f9a8d4', '#c4b5fd', '#86efac', '#7dd3fc', '#fcd34d', '#fda4af', '#a5b4fc', '#6ee7b7'];
        return '--skin-rim:' + rims[h % rims.length] + ';';
    }

    function qApplyActor(el, asQ) {
        if (!el) return;
        try {
            if (asQ) {
                el.classList.add('q-chibi-actor', 'q-style-actor');
                el.classList.remove('aden-skin');
            } else {
                el.classList.remove('q-chibi-actor', 'q-style-actor', 'aden-skin');
            }
        } catch (e) {}
    }

    function qFrameIndex(len, offsetMs) {
        if (len <= 1) return 0;
        return Math.floor((Date.now() + (offsetMs || 0)) / (1000 / Q_FPS)) % len;
    }

    /** 怪物卡：若有 Q 包則輪播；否則保持原 anim 系統 */
    function qAnimApplyMobs() {
        if (!qBattleSkinOn()) return;
        if (typeof mapState === 'undefined' || !mapState.mobs) return;
        var ml = document.getElementById('mob-list');
        if (!ml) return;
        for (var i = 0; i < mapState.mobs.length; i++) {
            var m = mapState.mobs[i];
            if (!m || m._dead || !(m.curHp > 0)) continue;
            var pack = qGetMobPack(m.n);
            if (!pack) continue;
            var card = ml.querySelector('.mob-target[data-uid="' + m.uid + '"]');
            if (!card) continue;
            var img = card.querySelector('.mob-img-inner.q-mob-art > img:not(.mob-anim-shadow):not(.mob-anim-weapon)');
            if (!img) continue;
            var seq = pack.idle;
            if (m._qAct === 'hurt' && pack.hurt.length) seq = pack.hurt;
            else if (m._qAct === 'attack' && pack.attack.length) seq = pack.attack;
            if (!seq.length) continue;
            var fi = qFrameIndex(seq.length, (m.uid || i) * 37);
            if (m._qAct && m._qActT && Date.now() - m._qActT > (1000 / Q_FPS) * seq.length) {
                m._qAct = null;
                seq = pack.idle;
                fi = qFrameIndex(seq.length, (m.uid || i) * 37);
            }
            var url = seq[Math.min(fi, seq.length - 1)];
            if (url && img.src.indexOf(url.split('?')[0]) < 0) img.src = url;
        }
    }

    /** 角色幀由 js/09 _playerMorphApply＋Q form 播；此處僅預熱包 */
    function qAnimApplyPlayer() {
        if (!qPlayerPackEnabled()) return false;
        try {
            var cls = (typeof player !== 'undefined' && player && player.cls) ? player.cls : 'knight';
            var av = (typeof player !== 'undefined' && player) ? player.avatar : '';
            qGetPlayerPack(cls, av);
        } catch (e) {}
        return true;
    }

    function qAnimApplyAllies() {
        // 傭兵仍走職業動畫
    }

    function qTick() {
        if (!qBattleSkinOn()) return;
        try { qAnimApplyMobs(); } catch (e0) {}
        try { qAnimApplyPlayer(); } catch (e1) {}
    }

    function qBootProbeCommon() {
        if (_bootOnce) return;
        _bootOnce = true;
        try { qAnimApplyPlayer(); } catch (e0) {}
    }

    window.qBattleSkinOn = qBattleSkinOn;
    window.qPlayerPackEnabled = qPlayerPackEnabled;
    window.qMobSpriteFor = qMobSpriteFor;
    window.qPlayerSpriteFor = qPlayerSpriteFor;
    window.qPastelInline = qPastelInline;
    window.qApplyActor = qApplyActor;
    window.qGetMobPack = qGetMobPack;
    window.qGetPlayerPack = qGetPlayerPack;
    window.qAnimApplyPlayer = qAnimApplyPlayer;
    window.qAnimTick = qTick;
    window.qMobPackDir = qMobPackDir;
    window.setClassicPixelLook = setClassicPixelLook;
    window.isClassicPixelLook = isClassicPixelLook;

    if (typeof setInterval === 'function') {
        setInterval(qTick, Math.max(50, Math.floor(1000 / Q_FPS)));
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', qBootProbeCommon);
        else qBootProbeCommon();
    }
})();

// 對話泡泡（原版天堂：一般說話顯示在角色頭上）：自己／同畫面玩家在世界頻道說話時，頭上冒出文字框 5 秒
(function () {
    var SHOW_MS = 5000;
    var _live = [];

    function headOf(host) {
        if (!host) return 0;
        if (host.id === 'player-morph-sprite') return (typeof _pmState !== 'undefined' && _pmState && _pmState._nameHead) || 0;
        var key = host.getAttribute('data-peer-key');
        var st = key && typeof _remotePartySpriteStates !== 'undefined' ? _remotePartySpriteStates[key] : null;
        return (st && st.head) || 0;
    }
    function hostFor(name, self) {
        if (self) return document.getElementById('player-morph-sprite');
        var list = document.querySelectorAll('#battle-view .party-sprite.remote-party[data-peer-name]');
        for (var i = 0; i < list.length; i++) if (list[i].getAttribute('data-peer-name') === name) return list[i];
        return null;
    }
    function place(b) {
        var h = headOf(b.host);
        var px = Math.round((h > 0 ? h : 90) + 22) + 'px';
        if (b.el.style.bottom !== px) b.el.style.bottom = px;
    }
    function tick() {
        var now = Date.now();
        _live = _live.filter(function (b) {
            if (now >= b.until || !b.host.isConnected || !b.el.isConnected) {
                try { b.el.remove(); } catch (e) {}
                return false;
            }
            place(b);
            return true;
        });
        if (_live.length) setTimeout(tick, 200);
    }

    function chatBubbleShow(name, text, self) {
        var t = String(text == null ? '' : text).trim();
        if (!t) return false;
        var bv = document.getElementById('battle-view');
        if (!bv || !bv.classList.contains('is-world-scroll')) return false;
        var host = hostFor(String(name || ''), !!self);
        if (!host) return false;
        _live = _live.filter(function (b) {
            if (b.host !== host) return true;
            try { b.el.remove(); } catch (e) {}
            return false;
        });
        var el = document.createElement('div');
        el.className = 'chat-bubble';
        el.textContent = t.slice(0, 60);
        host.appendChild(el);
        var b = { el: el, host: host, until: Date.now() + SHOW_MS };
        place(b);
        _live.push(b);
        if (_live.length === 1) setTimeout(tick, 200);
        return true;
    }

    window.chatBubbleShow = chatBubbleShow;
})();

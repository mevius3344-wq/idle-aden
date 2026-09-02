// 🛡️ 防修改器：客戶端數值夾限 + API 登入令牌
(function () {
    var TOKEN_KEY = 'fb5_auth_token';

    function maxGoldForLevel(lv) {
        var L = Math.max(1, Math.min(100, Math.floor(Number(lv) || 1)));
        return Math.min(500000000, 5000000 + L * L * 2500000);
    }

    function maxExpForLevel(lv) {
        var L = Math.max(1, Math.min(100, Math.floor(Number(lv) || 1)));
        if (L >= 100) return 999999999;
        return Math.floor(Math.pow(L + 5, 3.2) * 120000);
    }

  function anticheatSetAuthToken(token) {
        try {
            if (token) sessionStorage.setItem(TOKEN_KEY, String(token));
            else sessionStorage.removeItem(TOKEN_KEY);
        } catch (e) {}
    }

    function anticheatGetAuthToken() {
        try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
    }

    function anticheatAuthExtras() {
        var account = '';
        try {
            if (typeof window.__fb5AuthAccount === 'string') account = window.__fb5AuthAccount;
            else if (typeof currentAccount === 'function') account = currentAccount();
        } catch (e) {}
        var token = anticheatGetAuthToken();
        if (!account || !token) return {};
        return { account: account, authToken: token };
    }

    function anticheatClampPlayer() {
        if (typeof player !== 'object' || !player) return;
        var lv = Math.max(1, Math.min(100, Math.floor(Number(player.lv) || 1) || 1));
        player.lv = lv;
        var maxG = maxGoldForLevel(lv);
        var maxE = maxExpForLevel(lv);
        var g = Math.floor(Number(player.gold) || 0);
        if (!Number.isFinite(g) || g < 0) g = 0;
        if (g > maxG) {
            player.gold = maxG;
            try { if (typeof logSys === 'function') logSys('<span class="text-amber-300">偵測到異常金幣數值，已自動校正。</span>'); } catch (e) {}
        }
        var ex = Math.floor(Number(player.exp) || 0);
        if (!Number.isFinite(ex) || ex < 0) ex = 0;
        if (ex > maxE) {
            player.exp = maxE;
            try { if (typeof logSys === 'function') logSys('<span class="text-amber-300">偵測到異常經驗值，已自動校正。</span>'); } catch (e) {}
        }
        var panMax = (typeof PANACEA_USE_MAX === 'number') ? PANACEA_USE_MAX : 30;
        var pu = Math.floor(Number(player.panaceaUsed) || 0);
        if (pu > panMax) player.panaceaUsed = panMax;
        if (player.panacea && typeof player.panacea === 'object') {
            var sum = 0;
            ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (k) { sum += Math.max(0, Math.floor(Number(player.panacea[k]) || 0)); });
            if (sum > panMax) {
                var ratio = panMax / sum;
                ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (k) {
                    player.panacea[k] = Math.floor((Number(player.panacea[k]) || 0) * ratio);
                });
                player.panaceaUsed = panMax;
            }
        }
        if (Array.isArray(player.inv) && player.inv.length > 180) {
            player.inv = player.inv.slice(0, 180);
        }
        if (Array.isArray(player.inv)) {
            player.inv.forEach(function (it) {
                if (!it) return;
                var cnt = Math.floor(Number(it.cnt) || 1);
                if (cnt > 9999) it.cnt = 9999;
                if (typeof DB !== 'undefined' && DB.items && it.id && !DB.items[it.id]) {
                    it.id = 'junk_rag';
                }
            });
        }
    }

    window.anticheatSetAuthToken = anticheatSetAuthToken;
    window.anticheatGetAuthToken = anticheatGetAuthToken;
    window.anticheatAuthExtras = anticheatAuthExtras;
    window.anticheatClampPlayer = anticheatClampPlayer;
    window.anticheatMaxGoldForLevel = maxGoldForLevel;
})();

// 實測跑完刪掉自己註冊的測試帳號（線上伺服器不留垃圾帳號；本機不處理）。
// 用法：實測開頭 require('./_gm-cleanup').autoCleanup(); —— 記下成功註冊的帳號，程式結束時用 GM API 刪除。
// GM 權杖：環境變數 GM_TOKEN，否則讀桌面 天堂GM後台/gm-cloud.json；權杖不輸出。
const fs = require('fs');
const path = require('path');

function gmToken() {
    if (process.env.GM_TOKEN) return String(process.env.GM_TOKEN).trim();
    try {
        const f = path.join(__dirname, '..', '..', '天堂GM後台', 'gm-cloud.json');
        return String(JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')).token || '').trim();
    } catch (e) {
        return '';
    }
}

function isLocal(origin) {
    return /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(origin);
}

async function deleteTestAccounts(origin, accounts) {
    const token = gmToken();
    const out = [];
    for (const account of accounts) {
        if (!token) { out.push(account + ':no_token'); continue; }
        try {
            const r = await fetch(origin + '/api/gm/account/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ account, confirm: account }),
            });
            const d = await r.json().catch(() => ({}));
            out.push(account + ':' + (d.ok ? 'deleted' : (d.error || r.status)));
        } catch (e) {
            out.push(account + ':' + (e && e.message));
        }
    }
    const failed = out.filter((s) => !/:deleted$/.test(s));
    console.log((failed.length ? 'WARN 線上測試帳號未全部刪除：' : 'INFO 線上測試帳號已刪除：') + out.join(', '));
    return out;
}

function autoCleanup() {
    if (global.__gmCleanupOn) return;
    global.__gmCleanupOn = true;
    const made = [];
    const orig = global.fetch;
    global.fetch = async function (url, opts) {
        const r = await orig.apply(this, arguments);
        try {
            const u = String(url && url.url ? url.url : url);
            if (/\/api\/accounts\/register(\?|$)/.test(u) && opts && String(opts.method || '').toUpperCase() === 'POST' && r.ok) {
                const origin = new URL(u).origin;
                const account = JSON.parse(String(opts.body || '{}')).account;
                if (account && !isLocal(origin)) made.push({ origin, account: String(account) });
            }
        } catch (e) {}
        return r;
    };
    process.on('exit', () => {
        if (!made.length) return;
        try {
            require('child_process').execFileSync(process.execPath, [__filename, '--run', JSON.stringify(made)], { stdio: 'inherit', timeout: 60000 });
        } catch (e) {
            console.log('WARN 線上測試帳號清理失敗：' + made.map((m) => m.account).join(', '));
        }
    });
}

if (require.main === module && process.argv[2] === '--run') {
    (async () => {
        const made = JSON.parse(process.argv[3] || '[]');
        const byOrigin = {};
        for (const m of made) (byOrigin[m.origin] = byOrigin[m.origin] || []).push(m.account);
        for (const o of Object.keys(byOrigin)) await deleteTestAccounts(o, byOrigin[o]);
    })();
}

module.exports = { autoCleanup, deleteTestAccounts };

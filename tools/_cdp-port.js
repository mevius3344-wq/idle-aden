// 稽核用：同步取一個空的本機 CDP 埠（上一輪無頭 Edge 子行程可能還佔著固定埠）；取不到就用預設
module.exports = function cdpPort(pref) {
    try {
        const out = require('child_process').execFileSync(process.execPath, ['-e',
            "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close();})"]).toString();
        return +out || pref;
    } catch (e) { return pref; }
};

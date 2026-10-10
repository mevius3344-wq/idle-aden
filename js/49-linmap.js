/**
 * 🗺️ 天堂原版拼塊地圖（tools/lin 匯出）：可走格子＋相機附近圖塊。
 * 世界座標 1:1 對應匯出圖像素：wx = px - w/2，wy = h/2 - py（y 向上）。
 * 格子中心：px = (gx+gy)*24 + ox，py = (gy-gx)*12 + oy。
 */
(function (global) {
    'use strict';

    var DATA = global.LINMAP_DATA || {};
    var PAD_PX = 320;
    var _walk = Object.create(null);
    var _loading = Object.create(null);
    var _chunkSet = Object.create(null);
    var _imgs = Object.create(null);
    var _layerName = '';
    var _layerKey = '';

    function linmapVer() {
        return (typeof GAME_VERSION !== 'undefined') ? GAME_VERSION : '1';
    }

    function linmapData(name) {
        return (name && DATA[name]) || null;
    }

    function linmapChunks(name) {
        if (_chunkSet[name]) return _chunkSet[name];
        var d = linmapData(name);
        var set = Object.create(null);
        if (d && d.chunks) for (var i = 0; i < d.chunks.length; i++) set[d.chunks[i]] = true;
        _chunkSet[name] = set;
        return set;
    }

    function linmapLoadWalk(name) {
        if (!linmapData(name) || _walk[name] || _loading[name]) return;
        if (typeof fetch !== 'function') return;
        _loading[name] = true;
        fetch('assets/linmap/' + name + '/walk.bin?v=' + linmapVer())
            .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
            .then(function (buf) { if (buf) _walk[name] = new Uint8Array(buf); })
            .catch(function () {})
            .then(function () { _loading[name] = false; });
    }

    function linmapWalkReady(name) {
        return !!_walk[name];
    }

    function linmapTileAt(name, wx, wy) {
        var d = linmapData(name);
        if (!d) return null;
        var u = ((Number(wx) || 0) + d.w / 2 - d.ox) / 24;
        var v = (d.h / 2 - (Number(wy) || 0) - d.oy) / 12;
        return { gx: Math.round((u - v) / 2), gy: Math.round((u + v) / 2) };
    }

    /** 格子中心的世界座標（linmapTileAt 的反函數） */
    function linmapTileCenter(name, gx, gy) {
        var d = linmapData(name);
        if (!d) return null;
        return { x: (gx + gy) * 24 + d.ox - d.w / 2, y: d.h / 2 - d.oy - (gy - gx) * 12 };
    }

    function linmapCell(name, wx, wy) {
        var d = linmapData(name);
        var w = _walk[name];
        if (!d || !w) return -1;
        var t = linmapTileAt(name, wx, wy);
        if (t.gx < 0 || t.gy < 0 || t.gx >= d.nx || t.gy >= d.ny) return 0;
        return w[t.gy * d.nx + t.gx];
    }

    /** 資料未載入前視為可走（避免進圖瞬間卡死） */
    function linmapWalkable(name, wx, wy) {
        var c = linmapCell(name, wx, wy);
        if (c < 0) return true;
        return (c & 1) === 1;
    }

    function linmapSafeZone(name, wx, wy) {
        var c = linmapCell(name, wx, wy);
        return c > 0 && (c & 2) === 2;
    }

    /**
     * 村莊範圍（村中心 ±r 方框內）：安全區＋「不經安全區就走不到方框外」的非安全格（村內角落）。
     * 與 tools/lin/build-linmap-data.js townMask 相同。
     */
    var _townMasks = Object.create(null);
    function linmapTownMasks(name) {
        if (_townMasks[name]) return _townMasks[name];
        var d = linmapData(name), w = _walk[name];
        var out = [];
        for (var i = 0; i < d.towns.length; i++) {
            var tw = d.towns[i], R = tw.r, N = 2 * R + 1;
            var gx0 = tw.c[0] - R - d.x0, gy0 = tw.c[1] - R - d.y0;
            var cell = function (x, y) {
                var gx = gx0 + x, gy = gy0 + y;
                return (gx >= 0 && gy >= 0 && gx < d.nx && gy < d.ny) ? w[gy * d.nx + gx] : 0;
            };
            var open = function (x, y) { var c = cell(x, y); return (c & 1) === 1 && (c & 2) === 0; };
            var reach = new Uint8Array(N * N), q = [], x, y, k;
            for (k = 0; k < N; k++) {
                [[k, 0], [k, N - 1], [0, k], [N - 1, k]].forEach(function (p) {
                    var j = p[1] * N + p[0];
                    if (!reach[j] && open(p[0], p[1])) { reach[j] = 1; q.push(j); }
                });
            }
            for (var h = 0; h < q.length; h++) {
                x = q[h] % N; y = (q[h] / N) | 0;
                for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
                    var nx2 = x + dx, ny2 = y + dy;
                    if (nx2 < 0 || ny2 < 0 || nx2 >= N || ny2 >= N) continue;
                    var j2 = ny2 * N + nx2;
                    if (!reach[j2] && open(nx2, ny2)) { reach[j2] = 1; q.push(j2); }
                }
            }
            var m = new Uint8Array(N * N);
            for (k = 0; k < N * N; k++) {
                var c0 = cell(k % N, (k / N) | 0);
                m[k] = ((c0 & 2) || ((c0 & 1) && !reach[k])) ? 1 : 0;
            }
            out.push({ gx0: gx0, gy0: gy0, N: N, m: m });
        }
        _townMasks[name] = out;
        return out;
    }

    /**
     * 整張大地圖（world）：該點屬於哪一區（地圖 id 陣列；村莊可能多個 id 共用）。
     * 規則同 tools/lin/build-linmap-data.js buildWorld：村莊範圍優先，其餘歸最近野外中心。
     * 可走資料未載入／非大地圖 → null
     */
    function linmapRegionAt(name, wx, wy) {
        var d = linmapData(name);
        if (!d || !d.world || !_walk[name]) return null;
        var t = linmapTileAt(name, wx, wy);
        if (t.gx < 0 || t.gy < 0 || t.gx >= d.nx || t.gy >= d.ny) return null;
        var lx = d.x0 + t.gx, ly = d.y0 + t.gy;
        var i;
        var masks = linmapTownMasks(name);
        for (i = 0; i < masks.length; i++) {
            var M = masks[i], mx = t.gx - M.gx0, my = t.gy - M.gy0;
            if (mx >= 0 && my >= 0 && mx < M.N && my < M.N && M.m[my * M.N + mx]) return d.towns[i].ids;
        }
        var best = null, bd = Infinity;
        for (i = 0; i < d.fields.length; i++) {
            var f = d.fields[i];
            var dd = (lx - f.c[0]) * (lx - f.c[0]) + (ly - f.c[1]) * (ly - f.c[1]);
            if (dd < bd) { bd = dd; best = f.id; }
        }
        return best ? [best] : null;
    }

    function linmapEnsureLayer(bv) {
        var el = document.getElementById('explore-linmap');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'explore-linmap';
        el.className = 'explore-linmap hidden';
        el.setAttribute('aria-hidden', 'true');
        bv.insertBefore(el, bv.firstChild);
        return el;
    }

    /** 探索地板層會被 exploreSyncWorldBg 以 inline !important 強制顯示，CSS 蓋不過 */
    var OLD_FLOOR_IDS = ['explore-world-bg', 'explore-world-bg-blend', 'explore-world-bg-far'];
    function linmapSetOldFloor(hide) {
        for (var i = 0; i < OLD_FLOOR_IDS.length; i++) {
            var f = document.getElementById(OLD_FLOOR_IDS[i]);
            if (!f) continue;
            if (hide) {
                f.style.setProperty('display', 'none', 'important');
                f.setAttribute('data-lin-hid', '1');
            } else if (f.getAttribute('data-lin-hid')) {
                f.removeAttribute('data-lin-hid');
                if (f.style.getPropertyValue('display') === 'none') f.style.removeProperty('display');
            }
        }
    }

    function linmapHide(bv) {
        var el = document.getElementById('explore-linmap');
        if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
        if (bv) bv.classList.remove('is-linmap');
        linmapSetOldFloor(false);
    }

    /**
     * 每幀同步：anchorBottom＝世界 y＝camY 對應的畫面 bottom（與角色腳底同一錨點）
     */
    function linmapSync(bv, name, camX, camY, anchorBottom) {
        if (!bv) return;
        var d = linmapData(name);
        if (!d) { linmapHide(bv); return; }
        linmapLoadWalk(name);
        var layer = linmapEnsureLayer(bv);
        layer.classList.remove('hidden');
        bv.classList.add('is-linmap');
        linmapSetOldFloor(true);
        if (_layerName !== name) {
            layer.innerHTML = '';
            _imgs = Object.create(null);
            _layerName = name;
            _layerKey = '';
            layer.setAttribute('data-map', name);
        }
        var cx = Number(camX) || 0;
        var cy = Number(camY) || 0;
        var ab = Number(anchorBottom) || 0;
        layer.style.bottom = ab.toFixed(1) + 'px';
        layer.style.transform = 'translate3d(' + (-cx).toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';

        var vw = bv.clientWidth || 1280;
        var vh = bv.clientHeight || 720;
        var ch = d.chunk;
        var ix0 = cx - vw / 2 - PAD_PX + d.w / 2;
        var ix1 = cx + vw / 2 + PAD_PX + d.w / 2;
        var wyHi = cy + (vh - ab) + PAD_PX;
        var wyLo = cy - ab - PAD_PX;
        var iy0 = d.h / 2 - wyHi;
        var iy1 = d.h / 2 - wyLo;
        var c0 = Math.max(0, Math.floor(ix0 / ch));
        var c1 = Math.floor(ix1 / ch);
        var r0 = Math.max(0, Math.floor(iy0 / ch));
        var r1 = Math.floor(iy1 / ch);
        var key = c0 + ',' + c1 + ',' + r0 + ',' + r1;
        if (key === _layerKey) return;
        _layerKey = key;

        var set = linmapChunks(name);
        var want = Object.create(null);
        for (var r = r0; r <= r1; r++) {
            for (var c = c0; c <= c1; c++) {
                var id = c + '_' + r;
                if (!set[id]) continue;
                want[id] = true;
                if (_imgs[id]) continue;
                var img = document.createElement('img');
                img.className = 'explore-linmap-chunk';
                img.alt = '';
                img.draggable = false;
                img.decoding = 'async';
                var w = Math.min(ch, d.w - c * ch);
                var h = Math.min(ch, d.h - r * ch);
                img.style.left = (c * ch - d.w / 2) + 'px';
                img.style.bottom = (d.h / 2 - r * ch - h) + 'px';
                img.style.width = w + 'px';
                img.style.height = h + 'px';
                img.src = 'assets/linmap/' + name + '/c_' + id + '.webp?v=' + linmapVer();
                layer.appendChild(img);
                _imgs[id] = img;
            }
        }
        for (var k in _imgs) {
            if (want[k]) continue;
            var old = _imgs[k];
            if (old && old.parentNode) old.parentNode.removeChild(old);
            delete _imgs[k];
        }
    }

    global.linmapData = linmapData;
    global.linmapLoadWalk = linmapLoadWalk;
    global.linmapWalkReady = linmapWalkReady;
    global.linmapTileAt = linmapTileAt;
    global.linmapTileCenter = linmapTileCenter;
    global.linmapWalkable = linmapWalkable;
    global.linmapSafeZone = linmapSafeZone;
    global.linmapRegionAt = linmapRegionAt;
    global.linmapSync = linmapSync;
    global.linmapHide = linmapHide;
})(typeof window !== 'undefined' ? window : this);

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
    global.linmapWalkable = linmapWalkable;
    global.linmapSafeZone = linmapSafeZone;
    global.linmapSync = linmapSync;
    global.linmapHide = linmapHide;
})(typeof window !== 'undefined' ? window : this);

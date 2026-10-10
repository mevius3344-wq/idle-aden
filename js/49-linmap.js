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
        linmapObjClear();
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

    /* ---------- 遮擋物件（tools/lin/export-linobj.js）----------
     * 底圖已烤進物件；只有「物件底座在角色南邊、且畫面上蓋到角色」時，才在角色上方再疊一次該物件：
     * 顏色＝底圖圖塊（同一張圖、像素完全對齊），形狀＝遮罩圖集。各物件自己 transform，與人／怪／NPC 同一層排 z。
     * 擋住玩家本人＝半透明（看得到被擋的人物）。 */
    var OBJ_PAD = 640;
    var _objName = '';
    var _objIdx = Object.create(null);
    var _objSet = Object.create(null);
    var _objEls = [];

    function linmapObjClear() {
        var layer = document.getElementById('explore-linobj');
        if (layer) layer.innerHTML = '';
        _objEls = [];
        _objIdx = Object.create(null);
        _objName = '';
    }

    function linmapObjLoad(name, key) {
        _objIdx[key] = 'loading';
        if (typeof fetch !== 'function') return;
        var base = 'assets/linmap/' + name + '/o_' + key;
        fetch(base + '.json?v=' + linmapVer())
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (rows) {
                if (_objName !== name) return;
                var d = linmapData(name);
                var url = base + '.webp?v=' + linmapVer();
                _objIdx[key] = (rows || []).map(function (s, i) {
                    return {
                        id: key + ':' + i, url: url, ax: s[0], ay: s[1], w: s[2], h: s[3], ix: s[4], iy: s[5],
                        wl: s[4] - d.w / 2, wt: d.h / 2 - s[5], wb: d.h / 2 - s[5] - s[3], wbase: d.h / 2 - s[6]
                    };
                });
            })
            .catch(function () { if (_objName === name) _objIdx[key] = []; });
    }

    /** 物件矩形內用到的底圖圖塊（多張背景疊起來，位置對齊物件左上角） */
    function linmapObjBg(name, d, s) {
        var ch = d.chunk, set = linmapChunks(name);
        var imgs = [], pos = [], size = [];
        for (var r = Math.floor(s.iy / ch); r <= Math.floor((s.iy + s.h - 1) / ch); r++) {
            for (var c = Math.floor(s.ix / ch); c <= Math.floor((s.ix + s.w - 1) / ch); c++) {
                var id = c + '_' + r;
                if (!set[id]) continue;
                imgs.push('url("assets/linmap/' + name + '/c_' + id + '.webp?v=' + linmapVer() + '")');
                pos.push((c * ch - s.ix) + 'px ' + (r * ch - s.iy) + 'px');
                size.push(Math.min(ch, d.w - c * ch) + 'px ' + Math.min(ch, d.h - r * ch) + 'px');
            }
        }
        return { img: imgs.join(','), pos: pos.join(','), size: size.join(',') };
    }

    /**
     * actors：[{x,y,w,h,hero}] 角色腳底框（世界座標，y 向上，h＝腳底往上高度）
     * depthZ(worldY)：與角色同一套 z；screenBottom(worldY)：世界 y → 戰場 bottom px
     */
    function linmapObjSync(bv, name, camX, camY, actors, depthZ, screenBottom) {
        var d = linmapData(name);
        var layer = document.getElementById('explore-linobj');
        if (!d || !d.objChunks || !bv) { if (layer && layer.childElementCount) linmapObjClear(); return; }
        if (!layer) {
            layer = document.createElement('div');
            layer.id = 'explore-linobj';
            layer.className = 'explore-linobj';
            layer.setAttribute('aria-hidden', 'true');
            var mapLayer = document.getElementById('explore-linmap');
            if (mapLayer && mapLayer.parentNode === bv) bv.insertBefore(layer, mapLayer.nextSibling);
            else bv.appendChild(layer);
        }
        if (_objName !== name) {
            linmapObjClear();
            _objName = name;
            _objSet = Object.create(null);
            for (var q = 0; q < d.objChunks.length; q++) _objSet[d.objChunks[q]] = true;
        }
        var cx = Number(camX) || 0, cy = Number(camY) || 0;
        var vw = bv.clientWidth || 1280, vh = bv.clientHeight || 720;
        var ch = d.chunk;
        var c0 = Math.max(0, Math.floor((cx - vw / 2 - OBJ_PAD + d.w / 2) / ch));
        var c1 = Math.floor((cx + vw / 2 + OBJ_PAD + d.w / 2) / ch);
        var r0 = Math.max(0, Math.floor((d.h / 2 - (cy + vh + OBJ_PAD)) / ch));
        var r1 = Math.floor((d.h / 2 - (cy - vh - OBJ_PAD)) / ch);
        var xl = cx - vw / 2 - 64, xr = cx + vw / 2 + 64;
        var want = [];
        for (var r = r0; r <= r1; r++) {
            for (var c = c0; c <= c1; c++) {
                var key = c + '_' + r;
                if (!_objSet[key]) continue;
                var list = _objIdx[key];
                if (!list) { linmapObjLoad(name, key); continue; }
                if (list === 'loading') continue;
                for (var i = 0; i < list.length; i++) {
                    var s = list[i];
                    if (s.wl > xr || s.wl + s.w < xl) continue;
                    var hit = false, hero = false;
                    for (var k = 0; k < actors.length; k++) {
                        var a = actors[k];
                        if (a.y <= s.wbase) continue;
                        if (a.x + a.w / 2 <= s.wl || a.x - a.w / 2 >= s.wl + s.w) continue;
                        if (a.y + a.h <= s.wb || a.y >= s.wt) continue;
                        hit = true;
                        if (a.hero) { hero = true; break; }
                    }
                    if (hit) want.push({ s: s, hero: hero });
                }
            }
        }
        while (_objEls.length < want.length) {
            var el = document.createElement('div');
            el.className = 'explore-linobj-spr';
            layer.appendChild(el);
            _objEls.push(el);
        }
        for (var j = 0; j < _objEls.length; j++) {
            var e = _objEls[j];
            if (j >= want.length) {
                if (!e.hidden) e.hidden = true;
                continue;
            }
            var w = want[j], sp = w.s;
            if (e._sid !== sp.id) {
                e._sid = sp.id;
                var bg = linmapObjBg(name, d, sp);
                e.style.width = sp.w + 'px';
                e.style.height = sp.h + 'px';
                e.style.backgroundImage = bg.img;
                e.style.backgroundPosition = bg.pos;
                e.style.backgroundSize = bg.size;
                var mask = 'url("' + sp.url + '")';
                var mpos = (-sp.ax) + 'px ' + (-sp.ay) + 'px';
                e.style.webkitMaskImage = mask;
                e.style.maskImage = mask;
                e.style.webkitMaskPosition = mpos;
                e.style.maskPosition = mpos;
                e.setAttribute('data-base', String(Math.round(sp.wbase)));
            }
            var tr = 'translate3d(' + (sp.wl - cx).toFixed(1) + 'px,' + (-screenBottom(sp.wb)).toFixed(1) + 'px,0)';
            if (e._tr !== tr) { e.style.transform = tr; e._tr = tr; }
            var z = String(depthZ(sp.wbase));
            if (e._z !== z) { e.style.zIndex = z; e._z = z; }
            if (e.classList.contains('is-veil') !== w.hero) e.classList.toggle('is-veil', w.hero);
            if (e.hidden) e.hidden = false;
        }
    }

    global.linmapObjSync = linmapObjSync;
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

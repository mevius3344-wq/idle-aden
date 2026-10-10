/**
 * 🏘️ v3.9.63 原版村莊：NPC 站在天堂原版位置（js/52-lintown-data.js，l1j spawnlist_npc），
 * 原版 .spr 待機動畫＋服裝疊層；本遊戲 NPC 依中文名對上原版 NPC，對不上的接手剩餘原版商人站位。
 * 點 NPC＝interactNPC（與舊村莊相同功能）；警衛等原版 NPC 為場景（不可互動）。
 */
(function (global) {
    'use strict';

    var LAYER_ID = 'lin-town-npcs';
    var FOOT = (typeof LINTOWN_FOOT_PAD !== 'undefined') ? LINTOWN_FOOT_PAD : 32;
    var SPOT_KINDS = { Merchant: 1, Dwarf: 1, Teleporter: 1, Npc: 1, Housekeeper: 1, Auctioneer: 1 };
    var _town = '';
    var _layerKey = '';
    var _ents = [];
    var _raf = 0;
    var _dlgHome = null;

    function curMap() {
        try { return (typeof mapState !== 'undefined' && mapState) ? String(mapState.current || '') : ''; } catch (e) { return ''; }
    }
    function townDef(id) {
        var d = (typeof mapdefOf === 'function') ? mapdefOf(id) : null;
        return (d && d.townLin && d.lin) ? d : null;
    }
    /** 整張大地圖：同圖各村（同原版村莊只取一個 id；目前所在村優先） */
    function worldTowns(world, cur) {
        var defs = global.MAP_DEFS || {};
        var byKey = {};
        var order = [];
        Object.keys(defs).forEach(function (id) {
            var d = defs[id];
            if (!d || !d.townLin || d.world !== world) return;
            var k = d.townKey || d.lin;
            if (!(k in byKey)) order.push(k);
            if (!(k in byKey) || id === cur) byKey[k] = id;
        });
        return order.map(function (k) { return byKey[k]; });
    }
    function nameKey(s) {
        return String(s || '').replace(/^.*\^/, '').replace(/\s+/g, '');
    }
    function nameMatch(a, b) {
        a = nameKey(a); b = nameKey(b);
        if (!a || !b) return false;
        if (a === b) return true;
        return a.length >= 2 && b.length >= 2 && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0);
    }

    /** 本遊戲 NPC ↔ 原版站位：同名優先，其餘依離村中心距離接手剩餘原版商人位 */
    function linTownPlan(townId) {
        var def = townDef(townId);
        if (!def) return [];
        var orig = ((typeof LINTOWN_NPCS !== 'undefined') && LINTOWN_NPCS[def.townKey || def.lin]) || [];
        var L = (typeof linmapData === 'function') ? linmapData(def.lin) : null;
        var hub = (typeof LINTOWN_START !== 'undefined' && LINTOWN_START) ? LINTOWN_START[townId] : null;
        var cx = hub ? hub.x : (L && L.keys && L.keys.center ? L.keys.center.x : 0);
        var cy = hub ? hub.y : (L && L.keys && L.keys.center ? L.keys.center.y : 0);
        var game = (typeof townVisibleNpcs === 'function') ? townVisibleNpcs(townId) : [];
        var taken = new Array(orig.length);
        var out = [];
        var rest = [];
        game.forEach(function (g) {
            var hit = -1;
            for (var i = 0; i < orig.length; i++) {
                if (!taken[i] && orig[i].n && nameMatch(orig[i].n, g.n)) { hit = i; break; }
            }
            if (hit >= 0) { taken[hit] = true; out.push({ o: orig[hit], npc: g }); } else rest.push(g);
        });
        var free = [];
        for (var j = 0; j < orig.length; j++) {
            if (!taken[j] && orig[j].n && SPOT_KINDS[orig[j].k]) free.push(j);
        }
        free.sort(function (a, b) {
            var da = Math.pow(orig[a].x - cx, 2) + Math.pow(orig[a].y - cy, 2);
            var db = Math.pow(orig[b].x - cx, 2) + Math.pow(orig[b].y - cy, 2);
            return da - db;
        });
        var ring = 0;
        rest.forEach(function (g) {
            if (free.length) {
                var k = free.shift();
                taken[k] = true;
                out.push({ o: orig[k], npc: g });
            } else {
                var base = orig[0] || { s: '' };
                var ang = ring++ * 0.9;
                out.push({ o: { x: Math.round(cx + Math.cos(ang) * 120), y: Math.round(cy + Math.sin(ang) * 60), s: base.s }, npc: g });
            }
        });
        for (var m = 0; m < orig.length; m++) {
            if (!taken[m]) out.push({ o: orig[m], npc: null });
        }
        return out;
    }

    function ensureLayer() {
        var bv = document.getElementById('battle-view');
        if (!bv) return null;
        var el = document.getElementById(LAYER_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = LAYER_ID;
            el.className = 'lin-town-npcs';
            var ml = document.getElementById('mob-list');
            if (ml && ml.parentElement === bv) bv.insertBefore(el, ml);
            else bv.appendChild(el);
        }
        return el;
    }

    /** NPC 浮動視窗原本掛在 #town-view 內；原版村莊時 town-view 隱藏 → 暫移到舞台上 */
    function mountDialog(walk) {
        var dlg = document.getElementById('town-interaction-container');
        var tv = document.getElementById('town-view');
        if (!dlg || !tv) return;
        if (walk) {
            var stage = document.getElementById('app-stage') || document.getElementById('game-screen') || document.body;
            if (dlg.parentElement !== stage) {
                if (!_dlgHome) _dlgHome = { parent: dlg.parentElement, next: dlg.nextSibling };
                stage.appendChild(dlg);
            }
        } else if (_dlgHome && dlg.parentElement !== _dlgHome.parent) {
            if (_dlgHome.next && _dlgHome.next.parentNode === _dlgHome.parent) _dlgHome.parent.insertBefore(dlg, _dlgHome.next);
            else _dlgHome.parent.appendChild(dlg);
        }
    }

    /** 精靈表第一格最上緣不透明列 → 頭頂離腳底多高（px）；載入後回呼，-1＝量不到 */
    var _headCache = Object.create(null);
    function sprHeadAbove(key, spr, url, cb) {
        var c = _headCache[key];
        if (typeof c === 'number') { cb(c); return; }
        if (c) { c.push(cb); return; }
        _headCache[key] = [cb];
        var done = function (v) {
            var q = _headCache[key];
            _headCache[key] = v;
            for (var i = 0; i < q.length; i++) q[i](v);
        };
        var img = new Image();
        img.onload = function () {
            var v = -1;
            try {
                var sy = img.naturalHeight / spr.h;
                var fw = Math.max(1, Math.round(img.naturalWidth / Math.max(1, spr.n)));
                var fh = img.naturalHeight;
                var cv = document.createElement('canvas');
                cv.width = fw; cv.height = fh;
                var g = cv.getContext('2d');
                g.drawImage(img, 0, 0, fw, fh, 0, 0, fw, fh);
                var a = g.getImageData(0, 0, fw, fh).data;
                var top = -1;
                for (var y = 0; y < fh && top < 0; y++) {
                    for (var x = 0; x < fw; x++) if (a[(y * fw + x) * 4 + 3] > 60) { top = y; break; }
                }
                if (top >= 0) v = Math.max(24, spr.h - FOOT - top / sy);
            } catch (e) {}
            done(v);
        };
        img.onerror = function () { done(-1); };
        img.src = url;
    }

    function buildEntity(p, townId, live) {
        var o = p.o, npc = p.npc;
        var spr = (typeof LINTOWN_SPR !== 'undefined' && LINTOWN_SPR[o.s]) || null;
        if (!spr) return null;
        var el = document.createElement('div');
        el.className = 'lin-npc' + (npc && live ? ' is-game' : ' is-decor');
        var body = document.createElement('div');
        body.className = 'lin-npc-spr';
        body.style.width = spr.w + 'px';
        body.style.height = spr.h + 'px';
        var sprUrl = 'assets/linnpc/' + o.s + '.png?v=' + ((typeof GAME_VERSION !== 'undefined') ? GAME_VERSION : '1');
        body.style.backgroundImage = 'url("' + sprUrl + '")';
        body.style.backgroundSize = (spr.w * spr.n) + 'px ' + spr.h + 'px';
        if (spr.n > 1) {
            body.style.setProperty('--sw', (spr.w * spr.n) + 'px');
            body.style.animation = 'lin-npc-play ' + Math.max(240, spr.ms) + 'ms steps(' + spr.n + ') infinite';
        }
        body.style.bottom = (-FOOT) + 'px';
        el.appendChild(body);
        var label = npc ? npc.n : (o.k === 'FieldObject' ? '' : o.n);
        if (label) {
            var nm = document.createElement('div');
            nm.className = 'lin-npc-name';
            nm.style.bottom = Math.max(40, spr.h - FOOT - 18) + 'px';
            nm.textContent = label;
            if (npc && npc.title) {
                var t = document.createElement('span');
                t.className = 'lin-npc-title';
                t.textContent = npc.title;
                nm.insertBefore(t, nm.firstChild);
            }
            el.appendChild(nm);
            sprHeadAbove(o.s, spr, sprUrl, function (head) {
                if (head > 0) nm.style.bottom = Math.round(head + 3) + 'px';
            });
        }
        el.style.width = Math.min(spr.w, 72) + 'px';
        el.style.height = Math.max(24, Math.min(spr.h - FOOT, 110)) + 'px';
        if (npc && live) {
            el.setAttribute('data-npc', npc.id);
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                try { if (typeof exploreClearTapMove === 'function') exploreClearTapMove(); } catch (eC) {}
                if (typeof interactNPC === 'function') interactNPC(npc.id, townId);
            });
        }
        return { el: el, x: o.x, y: o.y };
    }

    function setWalkClass(on) {
        var gs = document.getElementById('game-screen');
        if (gs && gs.classList.contains('lin-town-walk') !== on) gs.classList.toggle('lin-town-walk', on);
    }

    function linTownClear() {
        _ents = [];
        var layer = document.getElementById(LAYER_ID);
        if (layer) layer.innerHTML = '';
        _town = '';
        _layerKey = '';
    }

    /** mapId＝目前地圖：原版村莊，或整張大地圖上的野外（同圖各村 NPC 照樣站著，只有所在村可點） */
    function linTownEnter(mapId) {
        var def = (typeof mapdefOf === 'function') ? mapdefOf(mapId) : null;
        var inTown = !!townDef(mapId);
        var towns = (def && def.world && def.lin) ? worldTowns(def.world, mapId) : (inTown ? [mapId] : []);
        if (!towns.length) { linTownLeave(); return; }
        mountDialog(inTown);
        setWalkClass(inTown);
        var layer = ensureLayer();
        if (!layer) return;
        var key = towns.join(',') + '|' + (inTown ? mapId : '');
        _town = mapId;
        layer.classList.remove('hidden');
        if (key !== _layerKey) {
            _ents = [];
            layer.innerHTML = '';
            _layerKey = key;
            var frag = document.createDocumentFragment();
            towns.forEach(function (tid) {
                linTownPlan(tid).forEach(function (p) {
                    var ent = buildEntity(p, tid, tid === mapId);
                    if (!ent) return;
                    frag.appendChild(ent.el);
                    _ents.push(ent);
                });
            });
            layer.appendChild(frag);
        }
        if (!_raf) _raf = requestAnimationFrame(frame);
    }

    function linTownLeave() {
        linTownClear();
        setWalkClass(false);
        var layer = document.getElementById(LAYER_ID);
        if (layer) layer.classList.add('hidden');
        mountDialog(false);
    }

    function frame() {
        _raf = 0;
        var cur = curMap();
        if (!_town) return;
        if (cur !== _town) {
            linTownEnter(cur);
            if (!_town) return;
        }
        var bv = document.getElementById('battle-view');
        var on = bv && !bv.classList.contains('hidden') && typeof exploreCamX === 'function' && typeof exploreMobScreenBottom === 'function';
        if (on) {
            var cx = exploreCamX(), cy = exploreCamY();
            var halfW = (bv.clientWidth || 1280) / 2 + 160;
            var vh = (bv.clientHeight || 720) + 200;
            for (var i = 0; i < _ents.length; i++) {
                var e = _ents[i];
                var dx = e.x - cx;
                var b = exploreMobScreenBottom(e.y);
                var vis = Math.abs(dx) < halfW && b > -240 && b < vh;
                if (vis !== !e.el.hidden) e.el.hidden = !vis;
                if (!vis) continue;
                var tr = 'translate3d(' + dx.toFixed(1) + 'px,' + (-b).toFixed(1) + 'px,0)';
                if (e._tr !== tr) { e.el.style.transform = tr; e._tr = tr; }
                var z = String(typeof exploreDepthZ === 'function' ? exploreDepthZ(e.y, 16, 92) : Math.max(16, Math.min(92, Math.round(50 - (e.y - cy) * 0.06))));
                if (e._z !== z) { e.el.style.zIndex = z; e._z = z; }
            }
        }
        _raf = requestAnimationFrame(frame);
    }

    /** 原版遮擋物件用：畫面上的 NPC 腳底框（世界座標） */
    global.linTownActors = function () {
        var out = [];
        for (var i = 0; i < _ents.length; i++) {
            if (!_ents[i].el.hidden) out.push({ x: _ents[i].x, y: _ents[i].y, w: 40, h: 72 });
        }
        return out;
    };
    global.linTownEnter = linTownEnter;
    global.linTownLeave = linTownLeave;
    global.linTownPlan = linTownPlan;
    global.linTownActive = function () { return !!(_town && townDef(_town)); };
})(typeof window !== 'undefined' ? window : this);

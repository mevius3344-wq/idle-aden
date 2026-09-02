// ===== 🌟 九天星盤 · 全職業共享天賦樹（LOL 18 點 · 4 層三選一互斥）=====
const TALENT_POINT_CAP = 18;
const TALENT_ATTR_CAP = 35;
const TALENT_MIN_LV = 50;
const TALENT_TIER_NEED = { 1: 0, 2: 5, 3: 5, 4: 5 };
const TALENT_TIER_MAX_LV = { 1: 5, 2: 5, 3: 5, 4: 1 };

const TALENT_TIER_ROWS = {
    1: ['fury_t1', 'survival_t1', 'transcend_t1'],
    2: ['fury_t2', 'survival_t2', 'transcend_t2'],
    3: ['fury_t3', 'survival_t3', 'transcend_t3'],
    4: ['fury_t4', 'survival_t4', 'transcend_t4']
};

const TALENT_NODE_META = {
    fury_t1:      { path: 'fury', tier: 1, col: 0, name: '裂空之刃',   short: '力→近傷', desc: '每級：近距離傷害 +(有效力量÷10)×0.5%（有效力量上限35）' },
    survival_t1:  { path: 'survival', tier: 1, col: 1, name: '磐石之軀', short: '體→減傷', desc: '每級：傷害減免 +(有效體質÷10)×0.5點（有效體質上限35）' },
    transcend_t1: { path: 'transcend', tier: 1, col: 2, name: '靈脈湧動', short: '敏→MP', desc: '每級：額外魔法點數 +(有效敏捷÷10)×0.8點（有效敏捷上限35）' },
    fury_t2:      { path: 'fury', tier: 2, col: 0, name: '狂獸之怒',   short: '近爆率', desc: '每級：近距離爆擊率 +0.8%' },
    survival_t2:  { path: 'survival', tier: 2, col: 1, name: '堅韌意志', short: 'HP', desc: '每級：最大 HP +12' },
    transcend_t2: { path: 'transcend', tier: 2, col: 2, name: '奧術共鳴', short: '智→魔傷', desc: '每級：魔法傷害 +(有效智力÷10)×0.5%（有效智力上限35）' },
    fury_t3:      { path: 'fury', tier: 3, col: 0, name: '破陣重擊',   short: '近爆傷', desc: '每級：近距離爆擊傷害 +1.0%' },
    survival_t3:  { path: 'survival', tier: 3, col: 1, name: '鐵壁守護', short: 'AC', desc: '每級：AC -1（防禦提升）' },
    transcend_t3: { path: 'transcend', tier: 3, col: 2, name: '心靈澄明', short: '魔耗', desc: '每級：MP 消耗減免 +0.6%' },
    fury_t4:      { path: 'fury', tier: 4, col: 0, name: '終焉斬擊',   short: '核心', desc: '核心（限1點）：近距離傷害 +1.5%' },
    survival_t4:  { path: 'survival', tier: 4, col: 1, name: '不朽壁壘', short: '核心', desc: '核心（限1點）：傷害減免 +2' },
    transcend_t4: { path: 'transcend', tier: 4, col: 2, name: '星盤覺醒', short: '核心', desc: '核心（限1點）：魔法爆擊率 +1.5%' }
};

const TALENT_PATH_LABEL = {
    fury: '凶暴火力',
    survival: '堅決生存',
    transcend: '超越策略'
};

function talentState() {
    if (!player) return { bought: 0, ranks: {} };
    if (!player.talent || typeof player.talent !== 'object') player.talent = { bought: 0, ranks: {} };
    if (!player.talent.ranks || typeof player.talent.ranks !== 'object') player.talent.ranks = {};
    player.talent.bought = Math.max(0, Math.min(TALENT_POINT_CAP, Math.floor(Number(player.talent.bought) || 0)));
    return player.talent;
}

function talentEligibleBuySlots(lv) {
    let level = Math.floor(Number(lv) || 0);
    if (level < TALENT_MIN_LV) return 0;
    return Math.min(TALENT_POINT_CAP, Math.floor((level - TALENT_MIN_LV) / 2) + 1);
}

function talentAllocatedPoints(t) {
    t = t || talentState();
    let sum = 0;
    for (let id in TALENT_NODE_META) sum += Math.max(0, Math.floor(Number(t.ranks[id]) || 0));
    return sum;
}

function talentUnspentPoints(t) {
    t = t || talentState();
    return Math.max(0, t.bought - talentAllocatedPoints(t));
}

function talentTierPoints(t, tier) {
    t = t || talentState();
    let sum = 0;
    (TALENT_TIER_ROWS[tier] || []).forEach(id => { sum += Math.max(0, Math.floor(Number(t.ranks[id]) || 0)); });
    return sum;
}

function talentTierActiveId(t, tier) {
    t = t || talentState();
    let hit = null;
    (TALENT_TIER_ROWS[tier] || []).forEach(id => {
        if ((Number(t.ranks[id]) || 0) > 0) hit = id;
    });
    return hit;
}

function talentTierUnlocked(t, tier) {
    if (tier <= 1) return true;
    return talentTierPoints(t, tier - 1) >= TALENT_TIER_NEED[tier];
}

function talentNodeLevel(t, id) {
    return Math.max(0, Math.floor(Number((t || talentState()).ranks[id]) || 0));
}

function talentNodeMaxLv(id) {
    let meta = TALENT_NODE_META[id];
    if (!meta) return 0;
    return TALENT_TIER_MAX_LV[meta.tier] || 0;
}

function talentIsNodeLocked(t, id) {
    t = t || talentState();
    let meta = TALENT_NODE_META[id];
    if (!meta) return true;
    if (!talentTierUnlocked(t, meta.tier)) return true;
    let active = talentTierActiveId(t, meta.tier);
    if (active && active !== id) return true;
    return false;
}

function talentCanAllocate(t, id) {
    t = t || talentState();
    if (talentAllocatedPoints(t) >= t.bought) return false;
    if (talentIsNodeLocked(t, id)) return false;
    if (talentNodeLevel(t, id) >= talentNodeMaxLv(id)) return false;
    return true;
}

function talentCanDeallocate(t, id) {
    t = t || talentState();
    let lv = talentNodeLevel(t, id);
    if (lv <= 0) return false;
    let meta = TALENT_NODE_META[id];
    if (!meta) return false;
    for (let tier = meta.tier + 1; tier <= 4; tier++) {
        if (talentTierPoints(t, tier) > 0) return false;
    }
    return true;
}

function talentBuyCost(nextPoint) {
    let n = Math.floor(Number(nextPoint) || 0) + 1;
    if (n <= 5) return { gold: 1000000, items: [{ id: 'new_item_164', cnt: 2000 }], weapon: false };
    if (n <= 10) return { gold: 5000000, items: [{ id: 'scroll_weapon', cnt: 50 }], weapon: false };
    if (n <= 15) return { gold: 20000000, items: [{ id: 'scroll_armor', cnt: 100 }], weapon: false };
    return { gold: 50000000, items: [], weapon: true };
}

function talentCostLabel(nextPoint) {
    let c = talentBuyCost(nextPoint);
    let parts = [(c.gold || 0).toLocaleString() + ' 金幣'];
    (c.items || []).forEach(it => {
        let nm = (DB.items[it.id] && DB.items[it.id].n) || it.id;
        parts.push(nm + ' ×' + it.cnt);
    });
    if (c.weapon) parts.push('熔毀一把 +9 以上武器（永久消失）');
    return parts.join('、');
}

function talentEligibleWeapons() {
    if (!player || !player.inv) return [];
    return player.inv.filter(it => {
        if (!it || it.lock) return false;
        let d = DB.items[it.id];
        if (!d || d.type !== 'wpn') return false;
        return (Number(it.en) || 0) >= 9;
    });
}

function talentConsumeCost(cost, weaponUid) {
    if ((player.gold || 0) < (cost.gold || 0)) return '金幣不足。';
    for (let it of (cost.items || [])) {
        let have = typeof invCountId === 'function' ? invCountId(it.id) : 0;
        if (have < it.cnt) return ((DB.items[it.id] && DB.items[it.id].n) || it.id) + ' 不足。';
    }
    if (cost.weapon) {
        if (!weaponUid) return '請選擇一把強化 +9 以上的武器作為祭獻。';
        let w = player.inv.find(i => i.uid === weaponUid);
        if (!w || w.lock) return '所選武器無效。';
        let d = DB.items[w.id];
        if (!d || d.type !== 'wpn' || (Number(w.en) || 0) < 9) return '所選武器強化等級不足 +9。';
    }
    player.gold -= cost.gold || 0;
    for (let it of (cost.items || [])) {
        if (typeof questConsumeId === 'function') questConsumeId(it.id, it.cnt);
    }
    if (cost.weapon && weaponUid) {
        let idx = player.inv.findIndex(i => i.uid === weaponUid);
        if (idx >= 0) {
            let w = player.inv[idx];
            let nm = getItemFullName ? getItemFullName(w) : ((DB.items[w.id] || {}).n || w.id);
            player.inv.splice(idx, 1);
            logSys('<span class="text-amber-300 font-bold">🔥 天賦祭獻：</span><span class="text-red-300">' + nm + '</span><span class="text-slate-300"> 已永久熔毀。</span>');
        }
    }
    return null;
}

function talentBuyPoint(weaponUid) {
    if (!player) return;
    let t = talentState();
    if (t.bought >= TALENT_POINT_CAP) { logSys('<span class="text-red-400">天賦點數已達終身上限（18 點）。</span>'); return; }
    let slots = talentEligibleBuySlots(player.lv);
    if (t.bought >= slots) {
        logSys('<span class="text-red-400">等級不足：50 級起每升 2 級解鎖 1 點購買資格（目前可購 ' + slots + ' 點）。</span>');
        return;
    }
    let cost = talentBuyCost(t.bought);
    let err = talentConsumeCost(cost, weaponUid);
    if (err) { logSys('<span class="text-red-400">' + err + '</span>'); renderTalentTab(); return; }
    t.bought += 1;
    logSys('<span class="text-cyan-300 font-bold">🌟 獲得天賦點數！</span><span class="text-slate-300"> 已購買 ' + t.bought + ' / ' + TALENT_POINT_CAP + ' 點。</span>');
    calcStats();
    saveGame();
    renderTalentTab();
}

function talentAllocate(nodeId) {
    let t = talentState();
    if (talentAllocatedPoints(t) >= t.bought) { logSys('<span class="text-red-400">可用天賦點不足，請先購買天賦點。</span>'); return; }
    if (!talentCanAllocate(t, nodeId)) { logSys('<span class="text-red-400">此節點目前無法配點（互斥鎖定或未解鎖）。</span>'); return; }
    let meta = TALENT_NODE_META[nodeId];
    if (meta) (TALENT_TIER_ROWS[meta.tier] || []).forEach(id => { if (id !== nodeId) delete t.ranks[id]; });
    t.ranks[nodeId] = talentNodeLevel(t, nodeId) + 1;
    calcStats();
    saveGame();
    renderTalentTab();
}

function talentDeallocate(nodeId) {
    let t = talentState();
    if (!talentCanDeallocate(t, nodeId)) { logSys('<span class="text-red-400">無法退點：下層已有配點或本節點為 0 級。</span>'); return; }
    t.ranks[nodeId] = talentNodeLevel(t, nodeId) - 1;
    if (t.ranks[nodeId] <= 0) delete t.ranks[nodeId];
    calcStats();
    saveGame();
    renderTalentTab();
}

function talentResetAll() {
    if (!player) return;
    let t = talentState();
    if (!talentAllocatedPoints(t)) { logSys('<span class="text-slate-400">目前沒有已分配的天賦點。</span>'); return; }
    t.ranks = {};
    logSys('<span class="text-cyan-200 font-bold">🌟 天賦已重置</span><span class="text-slate-300">，配點已歸還（已購買 ' + t.bought + ' 點保留）。</span>');
    calcStats();
    saveGame();
    renderTalentTab();
}

function talentEffAttr(d, key) {
    return Math.min(TALENT_ATTR_CAP, Math.max(0, Math.floor(Number(d[key]) || 0)));
}

function applyTalentToStats(d, p) {
    if (!p || !d) return;
    let t = talentState();
    let ranks = t.ranks || {};
    let pct = v => v / 100;

    function lv(id) { return Math.max(0, Math.floor(Number(ranks[id]) || 0)); }

    let l1 = lv('fury_t1');
    if (l1) d.meleeDmg += Math.max(0, Math.floor(d.meleeDmg * pct((talentEffAttr(d, 'str') / 10) * 0.5 * l1)));

    l1 = lv('survival_t1');
    if (l1) d.dr += (talentEffAttr(d, 'con') / 10) * 0.5 * l1;

    l1 = lv('transcend_t1');
    if (l1) d.extraMp += Math.floor((talentEffAttr(d, 'dex') / 10) * 0.8 * l1);

    let l2 = lv('fury_t2');
    if (l2) d.meleeCrit += 0.8 * l2;

    l2 = lv('survival_t2');
    if (l2) p.mhp = (p.mhp || 0) + 12 * l2;

    l2 = lv('transcend_t2');
    if (l2) d.magicDmg += Math.max(0, Math.floor(d.magicDmg * pct((talentEffAttr(d, 'int') / 10) * 0.5 * l2)));

    let l3 = lv('fury_t3');
    if (l3) d.meleeCritDmg += 1.0 * l3;

    l3 = lv('survival_t3');
    if (l3) d.ac -= 1 * l3;

    l3 = lv('transcend_t3');
    if (l3) d.mpReduce += 0.6 * l3;

    if (lv('fury_t4')) d.meleeDmg += Math.max(0, Math.floor(d.meleeDmg * pct(1.5)));
    if (lv('survival_t4')) d.dr += 2;
    if (lv('transcend_t4')) d.magicCrit += 1.5;
}

function talentNodeBtnClass(t, id) {
    let lv = talentNodeLevel(t, id);
    let locked = talentIsNodeLocked(t, id);
    let active = lv > 0;
    let canUp = talentCanAllocate(t, id);
    let cls = 'talent-node-btn';
    if (locked && !active) cls += ' talent-node-locked';
    else if (active) cls += ' talent-node-active';
    else if (canUp) cls += ' talent-node-ready';
    return cls;
}

function renderTalentTab() {
    let root = document.getElementById('tab-talent');
    if (!root || !player) return;
    let t = talentState();
    let slots = talentEligibleBuySlots(player.lv);
    let alloc = talentAllocatedPoints(t);
    let unspent = talentUnspentPoints(t);
    let nextCost = t.bought < TALENT_POINT_CAP ? talentCostLabel(t.bought) : '—';
    let weapons = talentEligibleWeapons();
    let needWeapon = t.bought >= 15 && t.bought < TALENT_POINT_CAP;
    let weaponPick = needWeapon ? `
        <div class="talent-sacrifice-box">
            <div class="talent-sacrifice-title">第 16～18 點需祭獻武器（+9 以上·永久熔毀）</div>
            <div class="talent-sacrifice-list">${weapons.length ? weapons.map(w => {
                let nm = typeof getItemFullName === 'function' ? getItemFullName(w) : ((DB.items[w.id] || {}).n || w.id);
                return `<button type="button" class="btn talent-sacrifice-btn" data-wuid="${w.uid}" onclick="talentBuyPoint('${w.uid}')">${nm} (+${w.en || 0})</button>`;
            }).join('') : '<span class="text-slate-500 text-sm">背包中無符合條件的武器</span>'}
            </div>
        </div>` : '';

    let cols = ['fury', 'survival', 'transcend'].map(path => {
        let nodes = Object.keys(TALENT_NODE_META).filter(id => TALENT_NODE_META[id].path === path);
        nodes.sort((a, b) => TALENT_NODE_META[a].tier - TALENT_NODE_META[b].tier);
        return `<div class="talent-path-col" data-path="${path}">
            <div class="talent-path-title">${TALENT_PATH_LABEL[path]}</div>
            ${nodes.map(id => {
                let m = TALENT_NODE_META[id];
                let lv = talentNodeLevel(t, id);
                let max = talentNodeMaxLv(id);
                let locked = talentIsNodeLocked(t, id) && lv <= 0;
                let tierOk = talentTierUnlocked(t, m.tier);
                return `<div class="talent-tier-wrap" data-tier="${m.tier}" data-node="${id}">
                    <button type="button" id="talent-btn-${id}" class="${talentNodeBtnClass(t, id)}"
                        ${locked ? 'disabled' : ''}
                        title="${m.desc}"
                        onclick="talentOnNodeClick('${id}')">
                        <span class="talent-node-tier">T${m.tier}</span>
                        <span class="talent-node-name">${m.name}</span>
                        <span class="talent-node-lv">${lv}/${max}</span>
                        <span class="talent-node-short">${m.short}</span>
                    </button>
                </div>`;
            }).join('')}
        </div>`;
    }).join('');

    root.innerHTML = `
        <div class="talent-panel">
            <div class="talent-header">
                <h3 class="talent-title">九天星盤 · 4階層全三選一常駐互斥天賦樹</h3>
                <p class="talent-sub">全職業共享 · 50 級解鎖 · 終身 18 點 · 純常駐面板（無移速／反傷／觸發技）</p>
            </div>
            <div class="talent-status-bar">
                <span>等級資格 <b class="text-cyan-300">${slots}</b> 點</span>
                <span>已購買 <b class="text-amber-300">${t.bought}</b> / ${TALENT_POINT_CAP}</span>
                <span>已分配 <b class="text-rose-300">${alloc}</b></span>
                <span>可分配 <b class="text-emerald-300">${unspent}</b></span>
            </div>
            <div class="talent-buy-row">
                ${t.bought < TALENT_POINT_CAP && t.bought < slots ? (
                    needWeapon ? '' : `<button type="button" class="btn talent-buy-btn" onclick="talentBuyPoint()">購買天賦點（${nextCost}）</button>`
                ) : '<span class="text-slate-500 text-sm">' + (t.bought >= TALENT_POINT_CAP ? '已達購買上限' : '等級不足，無法購買更多天賦點') + '</span>'}
                <button type="button" class="btn talent-reset-btn" onclick="talentResetAll()">一鍵重置配點</button>
            </div>
            ${weaponPick}
            <div class="talent-tree-wrap">
                <svg id="talent-svg-lines" class="talent-svg-lines" aria-hidden="true"></svg>
                <div class="talent-tree-cols">${cols}</div>
            </div>
            <p class="talent-hint">左鍵 +1 · Shift+左鍵 -1 · 同層三選一互斥 · 上層滿 5 點解鎖下層（T4 限 1 點）</p>
        </div>`;
    requestAnimationFrame(() => { talentDrawLines(); });
}

function talentOnNodeClick(nodeId) {
    if (window.event && window.event.shiftKey) talentDeallocate(nodeId);
    else talentAllocate(nodeId);
}

function talentDrawLines() {
    let svg = document.getElementById('talent-svg-lines');
    let wrap = svg && svg.parentElement;
    if (!svg || !wrap) return;
    let t = talentState();
    let rect = wrap.getBoundingClientRect();
    svg.setAttribute('width', Math.max(1, wrap.clientWidth));
    svg.setAttribute('height', Math.max(1, wrap.clientHeight));
    svg.innerHTML = '';
    ['fury', 'survival', 'transcend'].forEach(path => {
        let prev = null;
        for (let tier = 1; tier <= 4; tier++) {
            let id = (TALENT_TIER_ROWS[tier] || []).find(nid => TALENT_NODE_META[nid].path === path);
            let btn = document.getElementById('talent-btn-' + id);
            if (!btn) continue;
            let br = btn.getBoundingClientRect();
            let cx = br.left + br.width / 2 - rect.left;
            let cy = br.top + br.height / 2 - rect.top;
            if (prev) {
                let lit = talentNodeLevel(t, id) > 0 && talentNodeLevel(t, prev.id) > 0;
                let line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', prev.cx);
                line.setAttribute('y1', prev.cy);
                line.setAttribute('x2', cx);
                line.setAttribute('y2', cy);
                line.setAttribute('class', lit ? 'talent-line talent-line-lit' : 'talent-line talent-line-dim');
                svg.appendChild(line);
            }
            prev = { id: id, cx: cx, cy: cy };
        }
    });
}

let _talentResizeHooked = false;
function talentHookResize() {
    if (_talentResizeHooked) return;
    _talentResizeHooked = true;
    window.addEventListener('resize', () => {
        let panel = document.getElementById('tab-talent');
        if (panel && !panel.classList.contains('hidden')) talentDrawLines();
    });
}

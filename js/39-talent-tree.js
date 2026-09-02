// ===== 🌟 九天星盤 · 全職業共享天賦樹（LOL 18 點 · 4 層×3 路×3 選一）=====
const TALENT_POINT_CAP = 18;
const TALENT_ATTR_CAP = 35;
const TALENT_MIN_LV = 50;
const TALENT_TIER_NEED = 5;
const TALENT_TIER_MAX_LV = { 1: 5, 2: 5, 3: 5, 4: 1 };

const TALENT_PATH_LABEL = { fury: '凶暴 · 傷害發育', survival: '堅決 · 生存意志', transcend: '超越 · 藥理潛能' };
const TALENT_PATH_META = {
    fury: { name: '凶暴', tag: '傷害發育', blurb: '物／遠／魔輸出與攻速' },
    survival: { name: '堅決', tag: '生存意志', blurb: '血量、抗性與保命' },
    transcend: { name: '超越', tag: '藥理潛能', blurb: '回復、藥水與極限條件' }
};
const TALENT_TIER_LABEL = { 1: '根基', 2: '專精', 3: '突破', 4: '核心' };

function _talentNodeId(path, tier, slot) { return path + '_t' + tier + '_' + slot; }

const TALENT_NODE_META = {};
(function () {
    const add = (path, tier, slot, name, short, desc, req) => {
        let id = _talentNodeId(path, tier, slot);
        TALENT_NODE_META[id] = { path, tier, slot, name, short, desc, req: req || null };
    };
  // 走向一：凶暴
    add('fury', 1, 'l', '蠻力共鳴', '力→物攻', '每級：每 10 點 STR（上限35）物理攻擊 +0.5%');
    add('fury', 1, 'c', '疾風共鳴', '敏→遠攻', '每級：每 10 點 DEX（上限35）遠程傷害 +0.5%、遠程命中 +1%');
    add('fury', 1, 'r', '魔能共鳴', '智→魔攻', '每級：每 10 點 INT（上限35）魔法攻擊 +0.5%');
    add('fury', 2, 'l', '單手快刀', '單手攻速', '【裝備連動】單手劍/短刀：基礎物理攻速 +0.6%/級');
    add('fury', 2, 'c', '疾風風箏', '弓攻速', '【裝備連動】弓箭：基礎遠程攻速 +0.6%/級');
    add('fury', 2, 'r', '巨刃吟唱', '雙手/杖速', '【裝備連動】雙手劍/法杖：揮砍與施法速度 +0.6%/級');
    add('fury', 3, 'l', '力量突破', '武卷物攻', 'STR≥25：武器強化每+1，物理攻擊 +0.4/級', { key: 'str', min: 25 });
    add('fury', 3, 'c', '敏捷突破', '物爆傷', 'DEX≥25：物理爆擊傷害 +3%/級（滿級+15%）', { key: 'dex', min: 25 });
    add('fury', 3, 'r', '智力突破', '魔傷%', 'INT≥25：魔法傷害 +3%/級（滿級+15%）', { key: 'int', min: 25 });
    add('fury', 4, 'l', '重擊利刃', '物爆率', '核心：物理爆擊率 +2%');
    add('fury', 4, 'c', '破空看破', '破甲', '核心：無視目標 3% 有效 AC（防卷強化）');
    add('fury', 4, 'r', '法能激盪', '施法速度', '核心：施法速度 +2.5%');
  // 走向二：堅決
    add('survival', 1, 'l', '血脈增幅', '體→HP%', '每級：每 10 點 CON（上限35）最大 HP +0.6%');
    add('survival', 1, 'c', '意志屏障', '精→抗魔', '每級：每 10 點 WIS（上限35）魔法防禦 +0.6%');
    add('survival', 1, 'r', '氣場防護', '魅→AC', '每級：每 10 點 CHA（上限35）AC +1');
    add('survival', 2, 'l', '重盾格擋', '盾格擋', '【裝備連動】持盾：格擋率 +0.5%/級（純格擋·無反傷）');
    add('survival', 2, 'c', '防卷共鳴', '防卷減傷', '【裝備連動】防具總強化每+1，受玩家攻擊傷害 -0.1/級');
    add('survival', 2, 'r', '不屈之軀', '雙防', '物理與魔法防禦 +2/級（滿級+10）');
    add('survival', 3, 'l', '精神威壓', 'PVP抗控', 'WIS≥25：PVP/攻城受控時間 -5%/級', { key: 'wis', min: 25 });
    add('survival', 3, 'c', '體能開拓', '厚血', 'CON≥25：最大 HP +20/級、AC +2/級', { key: 'con', min: 25 });
    add('survival', 3, 'r', '心靈屏障', '純抗魔', 'CHA≥20：魔法防禦 +2.5%/級（滿級+12.5%·無反傷）', { key: 'cha', min: 20 });
    add('survival', 4, 'l', '絕境魔相', '免死', '核心：致命傷且 MP>100 時消耗 100 MP 留 1 HP（CD 90 秒）');
    add('survival', 4, 'c', '重裝庇護', 'AC', '核心：AC +8');
    add('survival', 4, 'r', '法能禦魔', '抗魔%', '核心：魔法防禦 +4%');
  // 走向三：超越
    add('transcend', 1, 'l', '防護冥想', '敏→MP', '每級：每 10 點 DEX（上限35）最大 MP +5（零移速）');
    add('transcend', 1, 'c', '鍊金精修', '藥效', '每級：每 10 點 INT（上限35）藥水恢復 +0.8%');
    add('transcend', 1, 'r', '貴族血統', '魅→回血', '每級：每 10 點 CHA（上限35）HP 自然恢復 +1');
    add('transcend', 2, 'l', '快速消化', '藥CD', '喝藥冷卻 -0.01 秒/級');
    add('transcend', 2, 'c', '體能再生', 'HP回', 'HP 自然恢復 +1/級');
    add('transcend', 2, 'r', '魔能泉源', 'MP回', 'MP 自然恢復 +1/級');
    add('transcend', 3, 'l', '鋼鐵外殼', 'AC', 'CHA≥20：AC +2/級（滿級+8）', { key: 'cha', min: 20 });
    add('transcend', 3, 'c', '敏捷激盪', '攻速施法', 'DEX≥25：攻擊與施法速度 +1.5%/級', { key: 'dex', min: 25 });
    add('transcend', 3, 'r', '僕從同調', '召喚強化', 'WIS≥25：召喚物攻擊與 HP +4%/級', { key: 'wis', min: 25 });
    add('transcend', 4, 'l', '極限潛能·力量', '力最高', '核心：若 STR 最高→物爆 +2%、物攻 +3');
    add('transcend', 4, 'c', '極限潛能·敏捷', '敏最高', '核心：若 DEX 最高→命中 +3、物爆傷 +4%');
    add('transcend', 4, 'r', '神聖吸取', '吸血', '核心：物/魔傷害 +1% 吸血');
})();

const _TALENT_V1_MIGRATE = {
    fury_t1: 'fury_t1_l', fury_t2: 'fury_t2_l', fury_t3: 'fury_t3_l', fury_t4: 'fury_t4_l',
    survival_t1: 'survival_t1_l', survival_t2: 'survival_t2_l', survival_t3: 'survival_t3_l', survival_t4: 'survival_t4_l',
    transcend_t1: 'transcend_t1_l', transcend_t2: 'transcend_t2_l', transcend_t3: 'transcend_t3_l', transcend_t4: 'transcend_t4_l'
};

function talentState() {
    if (!player) return { bought: 0, ranks: {} };
    if (!player.talent || typeof player.talent !== 'object') player.talent = { bought: 0, ranks: {} };
    if (!player.talent.ranks || typeof player.talent.ranks !== 'object') player.talent.ranks = {};
    for (let oldId in _TALENT_V1_MIGRATE) {
        let nv = _TALENT_V1_MIGRATE[oldId];
        if (player.talent.ranks[oldId] && !player.talent.ranks[nv]) {
            player.talent.ranks[nv] = player.talent.ranks[oldId];
            delete player.talent.ranks[oldId];
        }
    }
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

function talentUnspentPoints(t) { t = t || talentState(); return Math.max(0, t.bought - talentAllocatedPoints(t)); }

function talentNodeLevel(t, id) { return Math.max(0, Math.floor(Number((t || talentState()).ranks[id]) || 0)); }

function talentNodeMaxLv(id) {
    let meta = TALENT_NODE_META[id];
    if (!meta) return 0;
    return TALENT_TIER_MAX_LV[meta.tier] || 0;
}

function talentPathTierNodes(path, tier) {
    return Object.keys(TALENT_NODE_META).filter(id => {
        let m = TALENT_NODE_META[id];
        return m.path === path && m.tier === tier;
    });
}

function talentPathTierPoints(t, path, tier) {
    t = t || talentState();
    let sum = 0;
    talentPathTierNodes(path, tier).forEach(id => { sum += talentNodeLevel(t, id); });
    return sum;
}

function talentTierUnlocked(t, path, tier) {
    if (tier <= 1) return true;
    return talentPathTierPoints(t, path, tier - 1) >= TALENT_TIER_NEED;
}

function talentMeetsReq(id) {
    let meta = TALENT_NODE_META[id];
    if (!meta || !meta.req || !player || !player.d) return true;
    return Math.floor(Number(player.d[meta.req.key]) || 0) >= meta.req.min;
}

function talentIsNodeLocked(t, id) {
    t = t || talentState();
    let meta = TALENT_NODE_META[id];
    if (!meta) return true;
    if (!talentTierUnlocked(t, meta.path, meta.tier)) return true;
    let active = talentPathTierNodes(meta.path, meta.tier).find(nid => talentNodeLevel(t, nid) > 0);
    if (active && active !== id) return true;
    if (!talentMeetsReq(id) && talentNodeLevel(t, id) <= 0) return true;
    return false;
}

function talentCanAllocate(t, id) {
    t = t || talentState();
    if (talentAllocatedPoints(t) >= t.bought) return false;
    if (talentIsNodeLocked(t, id)) return false;
    if (!talentMeetsReq(id)) return false;
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
        if (talentPathTierPoints(t, meta.path, tier) > 0) return false;
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
    (c.items || []).forEach(it => { parts.push(((DB.items[it.id] || {}).n || it.id) + ' ×' + it.cnt); });
    if (c.weapon) parts.push('熔毀一把 +9 以上武器（永久消失）');
    return parts.join('、');
}

function talentEligibleWeapons() {
    if (!player || !player.inv) return [];
    return player.inv.filter(it => {
        if (!it || it.lock) return false;
        let d = DB.items[it.id];
        return d && d.type === 'wpn' && (Number(it.en) || 0) >= 9;
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
    if (t.bought >= slots) { logSys('<span class="text-red-400">等級不足：50 級起每升 2 級解鎖 1 點購買資格（目前可購 ' + slots + ' 點）。</span>'); return; }
    let cost = talentBuyCost(t.bought);
    let err = talentConsumeCost(cost, weaponUid);
    if (err) { logSys('<span class="text-red-400">' + err + '</span>'); renderTalentTab(); return; }
    t.bought += 1;
    logSys('<span class="text-cyan-300 font-bold">🌟 獲得天賦點數！</span><span class="text-slate-300"> 已購買 ' + t.bought + ' / ' + TALENT_POINT_CAP + ' 點。</span>');
    calcStats(); saveGame(); renderTalentTab();
}

function talentAllocate(nodeId) {
    _talentSelectedId = nodeId;
    let t = talentState();
    if (talentAllocatedPoints(t) >= t.bought) { logSys('<span class="text-red-400">可用天賦點不足，請先購買天賦點。</span>'); return; }
    if (!talentMeetsReq(nodeId)) { logSys('<span class="text-red-400">屬性未達標，無法學習此天賦。</span>'); return; }
    if (!talentCanAllocate(t, nodeId)) { logSys('<span class="text-red-400">此節點目前無法配點（互斥鎖定或未解鎖）。</span>'); return; }
    talentPathTierNodes(TALENT_NODE_META[nodeId].path, TALENT_NODE_META[nodeId].tier).forEach(id => { if (id !== nodeId) delete t.ranks[id]; });
    t.ranks[nodeId] = talentNodeLevel(t, nodeId) + 1;
    calcStats(); saveGame(); renderTalentTab();
}

function talentDeallocate(nodeId) {
    _talentSelectedId = nodeId;
    let t = talentState();
    if (!talentCanDeallocate(t, nodeId)) { logSys('<span class="text-red-400">無法退點：下層已有配點或本節點為 0 級。</span>'); return; }
    t.ranks[nodeId] = talentNodeLevel(t, nodeId) - 1;
    if (t.ranks[nodeId] <= 0) delete t.ranks[nodeId];
    calcStats(); saveGame(); renderTalentTab();
}

function talentResetAll() {
    if (!player) return;
    let t = talentState();
    if (!talentAllocatedPoints(t)) { logSys('<span class="text-slate-400">目前沒有已分配的天賦點。</span>'); return; }
    t.ranks = {};
    logSys('<span class="text-cyan-200 font-bold">🌟 天賦已重置</span><span class="text-slate-300">，配點已歸還（已購買 ' + t.bought + ' 點保留）。</span>');
    calcStats(); saveGame(); renderTalentTab();
}

function talentEffAttr(d, key) { return Math.min(TALENT_ATTR_CAP, Math.max(0, Math.floor(Number(d[key]) || 0))); }

function talentLv(id) { return talentNodeLevel(talentState(), id); }

function talentWpnTags() {
    if (!player || !player.eq || !player.eq.wpn || typeof getWeaponTags !== 'function') return [];
    return getWeaponTags(player.eq.wpn.id);
}

function talentWpnDef() {
    return (player && player.eq && player.eq.wpn) ? DB.items[player.eq.wpn.id] : null;
}

function talentHasShield() { return !!(player && player.eq && player.eq.shield); }

function talentIs1hSwordOrDagger() {
    let t = talentWpnTags();
    return t.includes('單手劍') || t.includes('匕首');
}

function talentIsBow() {
    let w = talentWpnDef();
    return !!(w && (w.isBow || w.ranged));
}

function talentIs2hSwordOrStaff() {
    let w = talentWpnDef();
    let t = talentWpnTags();
    return !!(w && (w.w2h || w.isWand || (typeof isWandWeapon === 'function' && isWandWeapon(w)) || t.includes('雙手劍')));
}

function talentWeaponEn() {
    return (player && player.eq && player.eq.wpn) ? Math.max(0, Number(player.eq.wpn.en) || 0) : 0;
}

function talentArmorEnSum() {
    let sum = 0;
    if (!player || !player.eq) return 0;
    for (let k in player.eq) {
        if (k === 'wpn' || k === 'offwpn' || k === 'arrow') continue;
        let e = player.eq[k];
        if (!e) continue;
        let ed = DB.items[e.id];
        if (ed && ed.type === 'arm') sum += Math.max(0, Number(e.en) || 0);
    }
    return sum;
}

function talentHighestAttrKey(d) {
    let keys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    let best = keys[0], val = Math.floor(Number(d[best]) || 0);
    for (let i = 1; i < keys.length; i++) {
        let v = Math.floor(Number(d[keys[i]]) || 0);
        if (v > val) { val = v; best = keys[i]; }
    }
    return best;
}

function applyTalentToStats(d, p) {
    if (!p || !d) return;
    let pct = v => v / 100;
    d.talentBlockBonus = 0;
    d.talentAcIgnorePct = 0;
    d.talentAtkSpdPct = 0;
    d.talentCastSpdPct = 0;
    d.talentPotionBonusPct = 0;
    d.talentPotionCdReduce = 0;
    d.talentCcReducePct = 0;
    d.talentLifestealPct = 0;
    d.talentSummonStatPct = 0;
    d.talentPvpFlatReduce = 0;
    d.talentDespair = false;

    let lv;
    // --- 凶暴 T1 ---
    if ((lv = talentLv('fury_t1_l'))) d.meleeDmg += Math.max(0, Math.floor(d.meleeDmg * pct((talentEffAttr(d, 'str') / 10) * 0.5 * lv)));
    if ((lv = talentLv('fury_t1_c'))) {
        d.rangedDmg += Math.max(0, Math.floor(d.rangedDmg * pct((talentEffAttr(d, 'dex') / 10) * 0.5 * lv)));
        d.rangedHit += lv;
    }
    if ((lv = talentLv('fury_t1_r'))) d.magicDmg += Math.max(0, Math.floor(d.magicDmg * pct((talentEffAttr(d, 'int') / 10) * 0.5 * lv)));
    // --- 凶暴 T2 ---
    if ((lv = talentLv('fury_t2_l')) && talentIs1hSwordOrDagger()) d.talentAtkSpdPct += 0.6 * lv;
    if ((lv = talentLv('fury_t2_c')) && talentIsBow()) d.talentAtkSpdPct += 0.6 * lv;
    if ((lv = talentLv('fury_t2_r')) && talentIs2hSwordOrStaff()) d.talentCastSpdPct += 0.6 * lv, d.talentAtkSpdPct += 0.6 * lv;
    // --- 凶暴 T3 ---
    if ((lv = talentLv('fury_t3_l')) && talentMeetsReq('fury_t3_l')) d.meleeDmg += talentWeaponEn() * 0.4 * lv;
    if ((lv = talentLv('fury_t3_c')) && talentMeetsReq('fury_t3_c')) d.meleeCritDmg += 3 * lv;
    if ((lv = talentLv('fury_t3_r')) && talentMeetsReq('fury_t3_r')) d.magicDmg += Math.max(0, Math.floor(d.magicDmg * pct(3 * lv)));
    // --- 凶暴 T4 ---
    if (talentLv('fury_t4_l')) d.meleeCrit += 2;
    if (talentLv('fury_t4_c')) d.talentAcIgnorePct = 3;
    if (talentLv('fury_t4_r')) d.talentCastSpdPct += 2.5;

    // --- 堅決 T1 ---
    if ((lv = talentLv('survival_t1_l'))) p.mhp = Math.max(1, Math.floor(p.mhp * (1 + pct((talentEffAttr(d, 'con') / 10) * 0.6 * lv))));
    if ((lv = talentLv('survival_t1_c'))) d.mr += Math.max(0, Math.floor(d.mr * pct((talentEffAttr(d, 'wis') / 10) * 0.6 * lv)));
    if ((lv = talentLv('survival_t1_r'))) d.ac -= Math.floor((talentEffAttr(d, 'cha') / 10) * lv);

    // --- 堅決 T2 ---
    if ((lv = talentLv('survival_t2_l')) && talentHasShield()) d.talentBlockBonus += 0.5 * lv;
    if ((lv = talentLv('survival_t2_c'))) d.talentPvpFlatReduce = talentArmorEnSum() * 0.1 * lv;
    if ((lv = talentLv('survival_t2_r'))) { d.ac -= 2 * lv; d.mr += 2 * lv; }

    // --- 堅決 T3 ---
    if ((lv = talentLv('survival_t3_l')) && talentMeetsReq('survival_t3_l')) d.talentCcReducePct = 5 * lv;
    if ((lv = talentLv('survival_t3_c')) && talentMeetsReq('survival_t3_c')) { p.mhp += 20 * lv; d.ac -= 2 * lv; }
    if ((lv = talentLv('survival_t3_r')) && talentMeetsReq('survival_t3_r')) d.mr += Math.max(0, Math.floor(d.mr * pct(2.5 * lv)));

    // --- 堅決 T4 ---
    if (talentLv('survival_t4_l')) d.talentDespair = true;
    if (talentLv('survival_t4_c')) d.ac -= 8;
    if (talentLv('survival_t4_r')) d.mr += Math.max(0, Math.floor(d.mr * 0.04));

    // --- 超越 T1 ---
    if ((lv = talentLv('transcend_t1_l'))) p.mmp += Math.floor((talentEffAttr(d, 'dex') / 10) * 5 * lv);
    if ((lv = talentLv('transcend_t1_c'))) d.talentPotionBonusPct += (talentEffAttr(d, 'int') / 10) * 0.8 * lv;
    if ((lv = talentLv('transcend_t1_r'))) d.hpR += Math.floor((talentEffAttr(d, 'cha') / 10) * lv);

    // --- 超越 T2 ---
    if ((lv = talentLv('transcend_t2_l'))) d.talentPotionCdReduce += 0.01 * lv;
    if ((lv = talentLv('transcend_t2_c'))) d.hpR += lv;
    if ((lv = talentLv('transcend_t2_r'))) d.mpR += lv;

    // --- 超越 T3 ---
    if ((lv = talentLv('transcend_t3_l')) && talentMeetsReq('transcend_t3_l')) d.ac -= 2 * lv;
    if ((lv = talentLv('transcend_t3_c')) && talentMeetsReq('transcend_t3_c')) { d.talentAtkSpdPct += 1.5 * lv; d.talentCastSpdPct += 1.5 * lv; }
    if ((lv = talentLv('transcend_t3_r')) && talentMeetsReq('transcend_t3_r')) d.talentSummonStatPct = 4 * lv;

    // --- 超越 T4 ---
    if (talentLv('transcend_t4_l') && talentHighestAttrKey(d) === 'str') { d.meleeCrit += 2; d.meleeDmg += 3; }
    if (talentLv('transcend_t4_c') && talentHighestAttrKey(d) === 'dex') { d.extraHit += 3; d.meleeCritDmg += 4; }
    if (talentLv('transcend_t4_r')) d.talentLifestealPct = 1;

    if (d.talentAtkSpdPct) d.aspd = d.aspd / (1 + d.talentAtkSpdPct / 100);
    if (d.talentCastSpdPct) {
        d.castLock = Math.max(1, d.castLock / (1 + d.talentCastSpdPct / 100));
        d.supportCastLock = d.castLock;
    }
}

function talentIsPvpContext(mob) {
    if (!mob) return false;
    if (mob.trollPlayer || mob.siegePlayer) return true;
    return typeof isSiegeArea === 'function' && isSiegeArea(mapState.current);
}

function talentMitigateIncomingDamage(totalDmg, mob) {
    if (!player || !player.d || totalDmg <= 0) return totalDmg;
    let dmg = totalDmg;
    if (player.d.talentPvpFlatReduce > 0 && talentIsPvpContext(mob)) {
        dmg = Math.max(0, dmg - player.d.talentPvpFlatReduce);
    }
    if (player.d.talentDespair && dmg >= player.hp && player.mp > 100 && (player._talentDespairCd || 0) <= state.ticks) {
        player.mp -= 100;
        player._talentDespairCd = state.ticks + 900;
        logCombat('<span class="text-cyan-300 font-bold">【絕境魔相】</span>以 100 MP 抵銷致命一擊，強制保留 1 點生命！', 'magic');
        return Math.max(0, player.hp - 1);
    }
    return dmg;
}

function talentCcDurationTicks(ticks, mob) {
    if (!player || !player.d || !mob) return ticks;
    let reduce = player.d.talentCcReducePct || 0;
    if (reduce <= 0 || !talentIsPvpContext(mob)) return ticks;
    return Math.max(1, Math.floor(ticks * (1 - reduce / 100)));
}

function talentApplyLifesteal(dmg, isMagic) {
    if (!player || !player.d || dmg <= 0) return;
    let pct = player.d.talentLifestealPct || 0;
    if (pct <= 0) return;
    let heal = Math.max(1, Math.floor(dmg * pct / 100));
    player.hp = Math.min(player.mhp, player.hp + heal);
}

function playerOnDealDamage(dmg) {
    if (typeof talentApplyLifesteal === 'function') talentApplyLifesteal(dmg, false);
}

function talentPotCdTicks() {
    let reduce = (player && player.d && player.d.talentPotionCdReduce) || 0;
    return Math.max(1, Math.round(10 - reduce * 10));
}

function talentSetPlayerCc(kind, ticks, mob) {
    if (!player) return;
    if (!player.statuses) player.statuses = {};
    let t = typeof talentCcDurationTicks === 'function' ? talentCcDurationTicks(ticks, mob) : ticks;
    player.statuses[kind] = t;
}

function talentSummonStatMult(owner) {
    if (!owner || owner !== player || !owner.d) return 1;
    let pct = owner.d.talentSummonStatPct || 0;
    return pct > 0 ? (1 + pct / 100) : 1;
}

function talentMobHitBonus(target) {
    if (!player || !player.d || !target) return 0;
    let pct = player.d.talentAcIgnorePct || 0;
    if (pct <= 0 || typeof mobEffAC !== 'function') return 0;
    return Math.floor(Math.abs(mobEffAC(target)) * pct / 100);
}

function talentPathSpent(t, path) {
    t = t || talentState();
    let sum = 0;
    for (let tier = 1; tier <= 4; tier++) sum += talentPathTierPoints(t, path, tier);
    return sum;
}

function talentNodeBtnClass(t, id) {
    let lv = talentNodeLevel(t, id);
    let locked = talentIsNodeLocked(t, id);
    let cls = 'talent-node-btn';
    if (locked && !lv) cls += ' talent-node-locked';
    else if (lv > 0) cls += ' talent-node-active';
    else if (talentCanAllocate(t, id)) cls += ' talent-node-ready';
    else cls += ' talent-node-idle';
    return cls;
}

function _talentEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

var _talentSelectedId = null;

function _talentAttrCn(key) {
    return { str: '力量 STR', dex: '敏捷 DEX', con: '體質 CON', int: '智力 INT', wis: '精神 WIS', cha: '魅力 CHA' }[key] || key;
}

function _talentFmt(n, d) {
    d = d == null ? 1 : d;
    let v = Math.round(Number(n) * Math.pow(10, d)) / Math.pow(10, d);
    return (v % 1 === 0 ? String(v) : v.toFixed(d));
}

function _talentPlayerAttr(key) {
    if (!player || !player.d) return 0;
    return talentEffAttr(player.d, key);
}

function _talentSlotLabel(slot) {
    return { l: '左', c: '中', r: '右' }[slot] || slot;
}

/** 依 applyTalentToStats 公式產生可讀的能力加成說明 */
function talentDescribeNode(id, curLv) {
    let meta = TALENT_NODE_META[id];
    if (!meta) return null;
    let maxLv = talentNodeMaxLv(id);
    let lv = Math.max(0, Math.floor(Number(curLv) || 0));
    let out = {
        id: id,
        name: meta.name,
        short: meta.short,
        desc: meta.desc,
        path: (TALENT_PATH_META[meta.path] ? (TALENT_PATH_META[meta.path].name + ' · ' + TALENT_PATH_META[meta.path].tag) : (TALENT_PATH_LABEL[meta.path] || meta.path)),
        tier: meta.tier,
        lv: lv,
        maxLv: maxLv,
        tags: [],
        perLevel: [],
        current: [],
        next: [],
        max: [],
        req: [],
        equip: [],
        note: [],
    };

    if (meta.req) {
        let have = _talentPlayerAttr(meta.req.key);
        let ok = have >= meta.req.min;
        out.req.push({
            ok: ok,
            text: _talentAttrCn(meta.req.key) + ' ≥ ' + meta.req.min + '（目前 ' + have + '）',
        });
    }

    let t = talentState();
    if (talentIsNodeLocked(t, id) && lv <= 0) {
        let active = talentPathTierNodes(meta.path, meta.tier).find(nid => talentNodeLevel(t, nid) > 0);
        if (active && active !== id) {
            let am = TALENT_NODE_META[active];
            out.note.push('同層互斥：已選「' + (am ? am.name : active) + '」');
        } else if (!talentTierUnlocked(t, meta.path, meta.tier)) {
            out.note.push('需先在上一層投入 ' + TALENT_TIER_NEED + ' 點才能解鎖');
        }
    }

    function addPer(s) { out.perLevel.push(s); }
    function addCur(s) { if (lv > 0) out.current.push(s); }
    function addNext(s) { if (lv < maxLv) out.next.push(s); }
    function addMax(s) { out.max.push(s); }
    function addTag(s) { if (out.tags.indexOf(s) < 0) out.tags.push(s); }

    switch (id) {
    case 'fury_t1_l':
        addTag('物理攻擊'); addPer('每級：每 10 點 STR（上限35）→ 物理攻擊 +0.5%');
        { let s = _talentPlayerAttr('str'), p = (s / 10) * 0.5 * lv, pm = (s / 10) * 0.5 * maxLv;
          addCur('物理攻擊 +' + _talentFmt(p) + '%（STR ' + s + '）'); addNext('物理攻擊 +' + _talentFmt((s / 10) * 0.5 * (lv + 1)) + '%'); addMax('滿級：物理攻擊 +' + _talentFmt(pm) + '%'); }
        break;
    case 'fury_t1_c':
        addTag('遠程傷害'); addTag('遠程命中'); addPer('每級：每 10 點 DEX（上限35）→ 遠程傷害 +0.5%、遠程命中 +1');
        { let s = _talentPlayerAttr('dex'), p = (s / 10) * 0.5 * lv;
          addCur('遠程傷害 +' + _talentFmt(p) + '%、遠程命中 +' + lv); addNext('遠程命中 +' + (lv + 1)); addMax('滿級：遠程傷害 +' + _talentFmt((s / 10) * 0.5 * maxLv) + '%、遠程命中 +' + maxLv); }
        break;
    case 'fury_t1_r':
        addTag('魔法攻擊'); addPer('每級：每 10 點 INT（上限35）→ 魔法攻擊 +0.5%');
        { let s = _talentPlayerAttr('int'), p = (s / 10) * 0.5 * lv;
          addCur('魔法攻擊 +' + _talentFmt(p) + '%（INT ' + s + '）'); addMax('滿級：魔法攻擊 +' + _talentFmt((s / 10) * 0.5 * maxLv) + '%'); }
        break;
    case 'fury_t2_l':
        addTag('攻擊速度'); addPer('每級：基礎物理攻速 +0.6%');
        if (talentIs1hSwordOrDagger()) out.equip.push({ ok: true, text: '已裝備單手劍／匕首，攻速加成生效中' });
        else out.equip.push({ ok: false, text: '需裝備單手劍或匕首才生效' });
        addCur('攻擊速度 +' + _talentFmt(0.6 * lv) + '%'); addMax('滿級：攻擊速度 +' + _talentFmt(0.6 * maxLv) + '%');
        break;
    case 'fury_t2_c':
        addTag('攻擊速度'); addPer('每級：基礎遠程攻速 +0.6%');
        if (talentIsBow()) out.equip.push({ ok: true, text: '已裝備弓箭，遠程攻速加成生效中' });
        else out.equip.push({ ok: false, text: '需裝備弓箭才生效' });
        addCur('遠程攻速 +' + _talentFmt(0.6 * lv) + '%'); addMax('滿級：遠程攻速 +' + _talentFmt(0.6 * maxLv) + '%');
        break;
    case 'fury_t2_r':
        addTag('攻擊速度'); addTag('施法速度'); addPer('每級：揮砍與施法速度 +0.6%');
        if (talentIs2hSwordOrStaff()) out.equip.push({ ok: true, text: '已裝備雙手劍／法杖，加成生效中' });
        else out.equip.push({ ok: false, text: '需裝備雙手劍或法杖才生效' });
        addCur('攻速／施法 +' + _talentFmt(0.6 * lv) + '%'); addMax('滿級：攻速／施法 +' + _talentFmt(0.6 * maxLv) + '%');
        break;
    case 'fury_t3_l':
        addTag('物理攻擊'); addPer('每級：武器強化每 +1 → 物理攻擊 +0.4（需 STR≥25）');
        { let en = talentWeaponEn(), flat = en * 0.4 * lv;
          addCur('物理攻擊 +' + _talentFmt(flat) + '（武器 +' + en + '）'); addMax('滿級：+' + _talentFmt(en * 0.4 * maxLv)); }
        break;
    case 'fury_t3_c':
        addTag('物理爆擊傷害'); addPer('每級：物理爆擊傷害 +3%（需 DEX≥25）');
        addCur('爆擊傷害 +' + _talentFmt(3 * lv) + '%'); addMax('滿級：爆擊傷害 +15%');
        break;
    case 'fury_t3_r':
        addTag('魔法傷害'); addPer('每級：魔法傷害 +3%（需 INT≥25）');
        addCur('魔法傷害 +' + _talentFmt(3 * lv) + '%'); addMax('滿級：魔法傷害 +15%');
        break;
    case 'fury_t4_l':
        addTag('物理爆擊率'); addPer('核心天賦（1 點）'); addCur('物理爆擊率 +2%'); addMax('物理爆擊率 +2%');
        break;
    case 'fury_t4_c':
        addTag('破甲'); addPer('核心天賦（1 點）'); addCur('無視目標 3% 有效 AC'); addMax('無視目標 3% 有效 AC');
        break;
    case 'fury_t4_r':
        addTag('施法速度'); addPer('核心天賦（1 點）'); addCur('施法速度 +2.5%'); addMax('施法速度 +2.5%');
        break;
    case 'survival_t1_l':
        addTag('最大 HP'); addPer('每級：每 10 點 CON（上限35）→ 最大 HP +0.6%');
        { let s = _talentPlayerAttr('con'), p = (s / 10) * 0.6 * lv;
          addCur('最大 HP +' + _talentFmt(p) + '%（CON ' + s + '）'); addMax('滿級：最大 HP +' + _talentFmt((s / 10) * 0.6 * maxLv) + '%'); }
        break;
    case 'survival_t1_c':
        addTag('魔法防禦'); addPer('每級：每 10 點 WIS（上限35）→ 魔法防禦 +0.6%');
        { let s = _talentPlayerAttr('wis'), p = (s / 10) * 0.6 * lv;
          addCur('魔法防禦 +' + _talentFmt(p) + '%（WIS ' + s + '）'); addMax('滿級：魔法防禦 +' + _talentFmt((s / 10) * 0.6 * maxLv) + '%'); }
        break;
    case 'survival_t1_r':
        addTag('AC'); addPer('每級：每 10 點 CHA（上限35）→ AC +1');
        { let s = _talentPlayerAttr('cha'), flat = Math.floor((s / 10) * lv);
          addCur('AC +' + flat + '（CHA ' + s + '）'); addMax('滿級：AC +' + Math.floor((s / 10) * maxLv)); }
        break;
    case 'survival_t2_l':
        addTag('格擋率'); addPer('每級：格擋率 +0.5%（純格擋·無反傷）');
        if (talentHasShield()) out.equip.push({ ok: true, text: '已持盾，格擋加成生效中' });
        else out.equip.push({ ok: false, text: '需裝備盾牌才生效' });
        addCur('格擋率 +' + _talentFmt(0.5 * lv) + '%'); addMax('滿級：格擋率 +' + _talentFmt(0.5 * maxLv) + '%');
        break;
    case 'survival_t2_c':
        addTag('PVP 減傷'); addPer('每級：防具總強化每 +1 → 受玩家攻擊固定傷害 -0.1');
        { let en = talentArmorEnSum(), red = en * 0.1 * lv;
          addCur('PVP 固定減傷 -' + _talentFmt(red) + '（防具總 +' + en + '）'); addMax('滿級：-' + _talentFmt(en * 0.1 * maxLv)); }
        break;
    case 'survival_t2_r':
        addTag('AC'); addTag('魔法防禦'); addPer('每級：AC +2、魔法防禦 +2');
        addCur('AC +' + (2 * lv) + '、魔防 +' + (2 * lv)); addMax('滿級：AC +10、魔防 +10');
        break;
    case 'survival_t3_l':
        addTag('抗控'); addPer('每級：PVP／攻城受控時間 -5%（需 WIS≥25）');
        addCur('受控時間 -' + _talentFmt(5 * lv) + '%'); addMax('滿級：受控時間 -25%');
        break;
    case 'survival_t3_c':
        addTag('最大 HP'); addTag('AC'); addPer('每級：最大 HP +20、AC +2（需 CON≥25）');
        addCur('HP +' + (20 * lv) + '、AC +' + (2 * lv)); addMax('滿級：HP +100、AC +10');
        break;
    case 'survival_t3_r':
        addTag('魔法防禦'); addPer('每級：魔法防禦 +2.5%（需 CHA≥20·無反傷）');
        addCur('魔法防禦 +' + _talentFmt(2.5 * lv) + '%'); addMax('滿級：魔法防禦 +12.5%');
        break;
    case 'survival_t4_l':
        addTag('保命'); addPer('核心天賦（1 點）');
        addCur('致命傷且 MP>100：消耗 100 MP 留 1 HP（冷卻 90 秒）');
        out.note.push('僅在受到致命傷害時觸發');
        break;
    case 'survival_t4_c':
        addTag('AC'); addPer('核心天賦（1 點）'); addCur('AC +8'); addMax('AC +8');
        break;
    case 'survival_t4_r':
        addTag('魔法防禦'); addPer('核心天賦（1 點）'); addCur('魔法防禦 +4%'); addMax('魔法防禦 +4%');
        break;
    case 'transcend_t1_l':
        addTag('最大 MP'); addPer('每級：每 10 點 DEX（上限35）→ 最大 MP +5（零移速）');
        { let s = _talentPlayerAttr('dex'), flat = Math.floor((s / 10) * 5 * lv);
          addCur('最大 MP +' + flat + '（DEX ' + s + '）'); addMax('滿級：最大 MP +' + Math.floor((s / 10) * 5 * maxLv)); }
        break;
    case 'transcend_t1_c':
        addTag('藥水恢復'); addPer('每級：每 10 點 INT（上限35）→ 藥水恢復 +0.8%');
        { let s = _talentPlayerAttr('int'), p = (s / 10) * 0.8 * lv;
          addCur('藥水恢復 +' + _talentFmt(p) + '%（INT ' + s + '）'); addMax('滿級：藥水恢復 +' + _talentFmt((s / 10) * 0.8 * maxLv) + '%'); }
        break;
    case 'transcend_t1_r':
        addTag('HP 回復'); addPer('每級：每 10 點 CHA（上限35）→ HP 自然恢復 +1');
        { let s = _talentPlayerAttr('cha'), flat = Math.floor((s / 10) * lv);
          addCur('HP 自然恢復 +' + flat + '（CHA ' + s + '）'); addMax('滿級：HP 自然恢復 +' + Math.floor((s / 10) * maxLv)); }
        break;
    case 'transcend_t2_l':
        addTag('喝藥冷卻'); addPer('每級：喝藥冷卻 -0.01 秒');
        addCur('冷卻縮短 ' + _talentFmt(0.01 * lv, 2) + ' 秒'); addMax('滿級：冷卻縮短 0.05 秒');
        break;
    case 'transcend_t2_c':
        addTag('HP 回復'); addPer('每級：HP 自然恢復 +1');
        addCur('HP 自然恢復 +' + lv); addMax('滿級：HP 自然恢復 +5');
        break;
    case 'transcend_t2_r':
        addTag('MP 回復'); addPer('每級：MP 自然恢復 +1');
        addCur('MP 自然恢復 +' + lv); addMax('滿級：MP 自然恢復 +5');
        break;
    case 'transcend_t3_l':
        addTag('AC'); addPer('每級：AC +2（需 CHA≥20）');
        addCur('AC +' + (2 * lv)); addMax('滿級：AC +8');
        break;
    case 'transcend_t3_c':
        addTag('攻擊速度'); addTag('施法速度'); addPer('每級：攻擊與施法速度 +1.5%（需 DEX≥25）');
        addCur('攻速／施法 +' + _talentFmt(1.5 * lv) + '%'); addMax('滿級：攻速／施法 +7.5%');
        break;
    case 'transcend_t3_r':
        addTag('召喚強化'); addPer('每級：召喚物攻擊與 HP +4%（需 WIS≥25）');
        addCur('召喚物強化 +' + _talentFmt(4 * lv) + '%'); addMax('滿級：召喚物強化 +20%');
        break;
    case 'transcend_t4_l':
        addTag('物理爆擊'); addTag('物理攻擊'); addPer('核心天賦（1 點）');
        { let hk = player && player.d ? talentHighestAttrKey(player.d) : 'str';
          out.note.push('條件：STR 為六維最高（目前最高：' + _talentAttrCn(hk) + '）');
          addMax('物爆率 +2%、物理攻擊 +3（STR 須為六維最高）');
          if (lv > 0) {
              if (hk === 'str') out.current.push('物爆率 +2%、物理攻擊 +3');
              else out.current.push('條件未滿足，加成未生效');
          } }
        break;
    case 'transcend_t4_c':
        addTag('命中'); addTag('物理爆擊傷害'); addPer('核心天賦（1 點）');
        { let hk = player && player.d ? talentHighestAttrKey(player.d) : 'dex';
          out.note.push('條件：DEX 為六維最高（目前最高：' + _talentAttrCn(hk) + '）');
          addMax('命中 +3、物爆傷 +4%（DEX 須為六維最高）');
          if (lv > 0) {
              if (hk === 'dex') out.current.push('命中 +3、物爆傷 +4%');
              else out.current.push('條件未滿足，加成未生效');
          } }
        break;
    case 'transcend_t4_r':
        addTag('吸血'); addPer('核心天賦（1 點）'); addCur('物理／魔法傷害 1% 轉為生命'); addMax('吸血 1%');
        break;
    default:
        addPer(meta.desc);
    }
    return out;
}

function _talentDetailSection(title, lines, cls) {
    if (!lines || !lines.length) return '';
    let body = lines.map(function (line) {
        if (line && typeof line === 'object' && line.text) {
            return '<li class="' + (line.ok === false ? 'talent-detail-bad' : line.ok === true ? 'talent-detail-good' : '') + '">' + _talentEsc(line.text) + '</li>';
        }
        return '<li>' + _talentEsc(line) + '</li>';
    }).join('');
    return '<div class="talent-detail-block ' + (cls || '') + '"><div class="talent-detail-block-title">' + _talentEsc(title) + '</div><ul class="talent-detail-list">' + body + '</ul></div>';
}

function talentRenderDetailPanel(id) {
    if (!id || !TALENT_NODE_META[id]) {
        return '<div class="talent-detail-panel talent-detail-empty"><p class="text-slate-500 text-sm text-center m-0">點選上方天賦節點，查看能力加成說明</p></div>';
    }
    let t = talentState();
    let lv = talentNodeLevel(t, id);
    let info = talentDescribeNode(id, lv);
    if (!info) return '';
    let canAdd = talentCanAllocate(t, id);
    let canSub = talentCanDeallocate(t, id);
    let tags = info.tags.map(function (tg) { return '<span class="talent-detail-tag">' + _talentEsc(tg) + '</span>'; }).join('');
    let pathCls = 'talent-detail-path-' + (TALENT_NODE_META[id].path || 'fury');
    return '<div class="talent-detail-panel ' + pathCls + '" id="talent-detail-panel">' +
        '<div class="talent-detail-head"><div><div class="talent-detail-path">' + _talentEsc(info.path) + ' · T' + info.tier + '</div>' +
        '<div class="talent-detail-name">' + _talentEsc(info.name) + ' <span class="talent-detail-lv">Lv ' + lv + '/' + info.maxLv + '</span></div>' +
        '<div class="talent-detail-short">' + _talentEsc(info.short) + '</div></div>' +
        (tags ? '<div class="talent-detail-tags">' + tags + '</div>' : '') + '</div>' +
        '<p class="talent-detail-desc">' + _talentEsc(info.desc) + '</p>' +
        '<div class="talent-detail-grid">' +
        _talentDetailSection('每級效果', info.perLevel, 'talent-detail-per') +
        _talentDetailSection('目前加成', info.current, 'talent-detail-cur') +
        _talentDetailSection('下一級預覽', info.next, 'talent-detail-next') +
        _talentDetailSection('滿級效果', info.max, 'talent-detail-max') +
        _talentDetailSection('屬性條件', info.req) +
        _talentDetailSection('裝備條件', info.equip) +
        _talentDetailSection('備註', info.note) +
        '</div>' +
        '<div class="talent-detail-actions">' +
        '<button type="button" class="btn talent-detail-add-btn"' + (canAdd ? '' : ' disabled') + ' onclick="talentAllocate(\'' + id + '\')">配點 +1</button>' +
        '<button type="button" class="btn talent-detail-sub-btn"' + (canSub ? '' : ' disabled') + ' onclick="talentDeallocate(\'' + id + '\')">退點 -1</button>' +
        '</div></div>';
}

function renderTalentTab() {
    let root = document.getElementById('tab-talent');
    if (!root) return;
    if (!player) {
        root.innerHTML = '<div class="talent-panel"><p class="text-slate-400 text-sm text-center p-4">請先登入並選擇角色後再開啟天賦樹。</p></div>';
        return;
    }
    let t = talentState();
    let slots = talentEligibleBuySlots(player.lv);
    let needWeapon = t.bought >= 15 && t.bought < TALENT_POINT_CAP;
    let weapons = talentEligibleWeapons();
    let weaponPick = needWeapon ? `<div class="talent-sacrifice-box"><div class="talent-sacrifice-title">第 16～18 點需祭獻武器（+9 以上·永久熔毀）</div><div class="talent-sacrifice-list">${weapons.length ? weapons.map(w => {
        let nm = typeof getItemFullName === 'function' ? getItemFullName(w) : ((DB.items[w.id] || {}).n || w.id);
        return `<button type="button" class="btn talent-sacrifice-btn" onclick="talentBuyPoint('${w.uid}')">${nm} (+${w.en || 0})</button>`;
    }).join('') : '<span class="text-slate-500 text-sm">背包中無符合條件的武器</span>'}</div></div>` : '';

    let cols = ['fury', 'survival', 'transcend'].map(path => {
        let pm = TALENT_PATH_META[path] || { name: path, tag: '', blurb: '' };
        let spent = talentPathSpent(t, path);
        let body = '';
        for (let tier = 1; tier <= 4; tier++) {
            if (tier > 1) {
                let prevPts = talentPathTierPoints(t, path, tier - 1);
                let unlocked = talentTierUnlocked(t, path, tier);
                let pct = Math.min(100, Math.round((prevPts / TALENT_TIER_NEED) * 100));
                body += `<div class="talent-gate${unlocked ? ' is-open' : ' is-locked'}" data-path="${path}" data-to-tier="${tier}">` +
                    `<div class="talent-gate-rail" aria-hidden="true"></div>` +
                    `<div class="talent-gate-chip"><span class="talent-gate-label">${unlocked ? '已解鎖' : '解鎖下層'}</span>` +
                    `<span class="talent-gate-prog">${prevPts}/${TALENT_TIER_NEED}</span>` +
                    `<div class="talent-gate-bar"><i style="width:${pct}%"></i></div></div></div>`;
            }
            let unlockedTier = talentTierUnlocked(t, path, tier);
            let nodes = ['l', 'c', 'r'].map(slot => {
                let id = _talentNodeId(path, tier, slot);
                let m = TALENT_NODE_META[id];
                let lv = talentNodeLevel(t, id);
                let max = talentNodeMaxLv(id);
                let locked = talentIsNodeLocked(t, id) && lv <= 0;
                let selected = _talentSelectedId === id;
                let fill = max > 0 ? Math.min(100, Math.round((lv / max) * 100)) : 0;
                return `<button type="button" id="talent-btn-${id}" class="${talentNodeBtnClass(t, id)}${selected ? ' talent-node-selected' : ''}" data-path="${path}" data-tier="${tier}" data-slot="${slot}" ${locked ? 'disabled' : ''} onclick="talentOnNodeClick('${id}')">` +
                    `<span class="talent-node-slot">${_talentSlotLabel(slot)}</span>` +
                    `<span class="talent-node-name">${_talentEsc(m.name)}</span>` +
                    `<span class="talent-node-short">${_talentEsc(m.short)}</span>` +
                    `<span class="talent-node-lv">${lv}/${max}</span>` +
                    `<span class="talent-node-fill" aria-hidden="true"><i style="width:${fill}%"></i></span>` +
                    `</button>`;
            }).join('');
            body += `<div class="talent-tier-block${unlockedTier ? '' : ' is-locked'}" data-tier="${tier}">` +
                `<div class="talent-tier-meta"><span class="talent-tier-badge">T${tier}</span>` +
                `<span class="talent-tier-name">${TALENT_TIER_LABEL[tier] || ('第' + tier + '層')}</span>` +
                `<span class="talent-tier-xor">同層三選一</span>` +
                `<span class="talent-tier-cap">滿級 ${TALENT_TIER_MAX_LV[tier]}</span></div>` +
                `<div class="talent-tier-row-btns">${nodes}</div></div>`;
        }
        return `<div class="talent-path-col" data-path="${path}">` +
            `<div class="talent-path-head"><div class="talent-path-name">${_talentEsc(pm.name)}</div>` +
            `<div class="talent-path-tag">${_talentEsc(pm.tag)}</div>` +
            `<div class="talent-path-blurb">${_talentEsc(pm.blurb)}</div>` +
            `<div class="talent-path-spent">本路投入 <b>${spent}</b> 點</div></div>${body}</div>`;
    }).join('');

    root.innerHTML = `<div class="talent-panel">
        <div class="talent-header"><h3 class="talent-title">九天星盤</h3>
        <p class="talent-sub">三路並行 · 每層三選一 · 上一層滿 ${TALENT_TIER_NEED} 點解鎖下一層 · 終身 ${TALENT_POINT_CAP} 點</p></div>
        <div class="talent-status-bar"><span>等級資格 <b class="text-cyan-300">${slots}</b></span><span>已購買 <b class="text-amber-300">${t.bought}</b>/${TALENT_POINT_CAP}</span><span>已分配 <b class="text-rose-300">${talentAllocatedPoints(t)}</b></span><span>可分配 <b class="text-emerald-300">${talentUnspentPoints(t)}</b></span></div>
        <div class="talent-legend" aria-hidden="true">
            <span class="talent-legend-item talent-legend-ready">可配點</span>
            <span class="talent-legend-item talent-legend-active">已投入</span>
            <span class="talent-legend-item talent-legend-locked">未解鎖／互斥</span>
            <span class="talent-legend-item talent-legend-selected">檢視中</span>
        </div>
        <div class="talent-buy-row">${t.bought < TALENT_POINT_CAP && t.bought < slots ? (needWeapon ? '' : `<button type="button" class="btn talent-buy-btn" onclick="talentBuyPoint()">購買天賦點（${talentCostLabel(t.bought)}）</button>`) : '<span class="text-slate-500 text-sm">' + (t.bought >= TALENT_POINT_CAP ? '已達購買上限' : '等級不足（50 級起每 2 級 +1 購買資格）') + '</span>'}<button type="button" class="btn talent-reset-btn" onclick="talentResetAll()">一鍵重置配點</button></div>
        ${weaponPick}
        <div class="talent-tree-wrap"><svg id="talent-svg-lines" class="talent-svg-lines" aria-hidden="true"></svg><div class="talent-tree-cols">${cols}</div></div>
        ${talentRenderDetailPanel(_talentSelectedId)}
        <p class="talent-hint">點選節點查看說明 · 同層只能選一條分支 · 連線越亮代表你目前的成長路線</p></div>`;
    requestAnimationFrame(() => talentDrawLines());
}

function talentOnNodeClick(nodeId) {
    _talentSelectedId = nodeId;
    renderTalentTab();
}

function _talentBtnCenter(btn, wrapRect) {
    let br = btn.getBoundingClientRect();
    return {
        x: br.left + br.width / 2 - wrapRect.left,
        yTop: br.top - wrapRect.top,
        yMid: br.top + br.height / 2 - wrapRect.top,
        yBot: br.bottom - wrapRect.top
    };
}

function _talentSvgLine(svg, x1, y1, x2, y2, cls) {
    let line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('class', cls);
    svg.appendChild(line);
}

function _talentSvgPath(svg, d, cls) {
    let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', cls);
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
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
        for (let tier = 1; tier < 4; tier++) {
            let activePrev = talentPathTierNodes(path, tier).find(id => talentNodeLevel(t, id) > 0);
            let prevId = activePrev || _talentNodeId(path, tier, 'c');
            let prevBtn = document.getElementById('talent-btn-' + prevId);
            if (!prevBtn) continue;
            let from = _talentBtnCenter(prevBtn, rect);
            let nextIds = ['l', 'c', 'r'].map(slot => _talentNodeId(path, tier + 1, slot));
            let nextPts = nextIds.map(id => {
                let btn = document.getElementById('talent-btn-' + id);
                return btn ? { id, btn, p: _talentBtnCenter(btn, rect), lv: talentNodeLevel(t, id) } : null;
            }).filter(Boolean);
            if (!nextPts.length) continue;

            let midY = (from.yBot + Math.min.apply(null, nextPts.map(n => n.p.yTop))) / 2;
            let prevLit = !!(activePrev && talentNodeLevel(t, activePrev) > 0);
            let stemCls = 'talent-line talent-line-' + path + (prevLit ? ' talent-line-lit' : ' talent-line-dim');

            // 主幹：上一層選中節點 → 分岔點
            _talentSvgLine(svg, from.x, from.yBot, from.x, midY, stemCls);

            // 橫向匯流：覆蓋三個子節點中心
            let xs = nextPts.map(n => n.p.x);
            let xMin = Math.min.apply(null, xs.concat([from.x]));
            let xMax = Math.max.apply(null, xs.concat([from.x]));
            _talentSvgLine(svg, xMin, midY, xMax, midY, stemCls);

            nextPts.forEach(n => {
                let childLit = prevLit && n.lv > 0;
                let childCls = 'talent-line talent-line-' + path + (childLit ? ' talent-line-lit' : ' talent-line-dim');
                // 分岔 → 各子節點頂端（弧線更像技能樹分支）
                let d = 'M ' + n.p.x + ' ' + midY + ' C ' + n.p.x + ' ' + (midY + (n.p.yTop - midY) * 0.35) + ', ' +
                    n.p.x + ' ' + (midY + (n.p.yTop - midY) * 0.65) + ', ' + n.p.x + ' ' + n.p.yTop;
                _talentSvgPath(svg, d, childCls);
            });
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

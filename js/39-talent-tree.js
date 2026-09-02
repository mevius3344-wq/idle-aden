// ===== 🌟 九天星盤 · 全職業共享天賦樹（LOL 18 點 · 4 層×3 路×3 選一）=====
const TALENT_POINT_CAP = 18;
const TALENT_ATTR_CAP = 35;
const TALENT_MIN_LV = 50;
const TALENT_TIER_NEED = 5;
const TALENT_TIER_MAX_LV = { 1: 5, 2: 5, 3: 5, 4: 1 };

const TALENT_PATH_LABEL = { fury: '凶暴 · 傷害發育', survival: '堅決 · 生存意志', transcend: '超越 · 藥理潛能' };

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
    let t = talentState();
    if (talentAllocatedPoints(t) >= t.bought) { logSys('<span class="text-red-400">可用天賦點不足，請先購買天賦點。</span>'); return; }
    if (!talentMeetsReq(nodeId)) { logSys('<span class="text-red-400">屬性未達標，無法學習此天賦。</span>'); return; }
    if (!talentCanAllocate(t, nodeId)) { logSys('<span class="text-red-400">此節點目前無法配點（互斥鎖定或未解鎖）。</span>'); return; }
    talentPathTierNodes(TALENT_NODE_META[nodeId].path, TALENT_NODE_META[nodeId].tier).forEach(id => { if (id !== nodeId) delete t.ranks[id]; });
    t.ranks[nodeId] = talentNodeLevel(t, nodeId) + 1;
    calcStats(); saveGame(); renderTalentTab();
}

function talentDeallocate(nodeId) {
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

function talentNodeBtnClass(t, id) {
    let lv = talentNodeLevel(t, id);
    let locked = talentIsNodeLocked(t, id);
    let cls = 'talent-node-btn';
    if (locked && !lv) cls += ' talent-node-locked';
    else if (lv > 0) cls += ' talent-node-active';
    else if (talentCanAllocate(t, id)) cls += ' talent-node-ready';
    return cls;
}

function renderTalentTab() {
    let root = document.getElementById('tab-talent');
    if (!root || !player) return;
    let t = talentState();
    let slots = talentEligibleBuySlots(player.lv);
    let needWeapon = t.bought >= 15 && t.bought < TALENT_POINT_CAP;
    let weapons = talentEligibleWeapons();
    let weaponPick = needWeapon ? `<div class="talent-sacrifice-box"><div class="talent-sacrifice-title">第 16～18 點需祭獻武器（+9 以上·永久熔毀）</div><div class="talent-sacrifice-list">${weapons.length ? weapons.map(w => {
        let nm = typeof getItemFullName === 'function' ? getItemFullName(w) : ((DB.items[w.id] || {}).n || w.id);
        return `<button type="button" class="btn talent-sacrifice-btn" onclick="talentBuyPoint('${w.uid}')">${nm} (+${w.en || 0})</button>`;
    }).join('') : '<span class="text-slate-500 text-sm">背包中無符合條件的武器</span>'}</div></div>` : '';

    let cols = ['fury', 'survival', 'transcend'].map(path => {
        let tiers = [1, 2, 3, 4].map(tier => {
            let nodes = ['l', 'c', 'r'].map(slot => {
                let id = _talentNodeId(path, tier, slot);
                let m = TALENT_NODE_META[id];
                let lv = talentNodeLevel(t, id);
                let max = talentNodeMaxLv(id);
                let locked = talentIsNodeLocked(t, id) && lv <= 0;
                return `<button type="button" id="talent-btn-${id}" class="${talentNodeBtnClass(t, id)}" ${locked ? 'disabled' : ''} title="${m.desc}" onclick="talentOnNodeClick('${id}')"><span class="talent-node-tier">T${tier}</span><span class="talent-node-name">${m.name}</span><span class="talent-node-lv">${lv}/${max}</span></button>`;
            }).join('');
            return `<div class="talent-tier-row" data-tier="${tier}"><div class="talent-tier-row-btns">${nodes}</div></div>`;
        }).join('');
        return `<div class="talent-path-col" data-path="${path}"><div class="talent-path-title">${TALENT_PATH_LABEL[path]}</div>${tiers}</div>`;
    }).join('');

    root.innerHTML = `<div class="talent-panel">
        <div class="talent-header"><h3 class="talent-title">九天星盤 · 4階層全三選一常駐互斥天賦樹</h3>
        <p class="talent-sub">全職業共享 · 50 級解鎖 · 終身 18 點 · 純常駐（零移速／零反傷）</p></div>
        <div class="talent-status-bar"><span>等級資格 <b class="text-cyan-300">${slots}</b></span><span>已購買 <b class="text-amber-300">${t.bought}</b>/${TALENT_POINT_CAP}</span><span>已分配 <b class="text-rose-300">${talentAllocatedPoints(t)}</b></span><span>可分配 <b class="text-emerald-300">${talentUnspentPoints(t)}</b></span></div>
        <div class="talent-buy-row">${t.bought < TALENT_POINT_CAP && t.bought < slots ? (needWeapon ? '' : `<button type="button" class="btn talent-buy-btn" onclick="talentBuyPoint()">購買天賦點（${talentCostLabel(t.bought)}）</button>`) : '<span class="text-slate-500 text-sm">' + (t.bought >= TALENT_POINT_CAP ? '已達購買上限' : '等級不足') + '</span>'}<button type="button" class="btn talent-reset-btn" onclick="talentResetAll()">一鍵重置配點</button></div>
        ${weaponPick}
        <div class="talent-tree-wrap"><svg id="talent-svg-lines" class="talent-svg-lines" aria-hidden="true"></svg><div class="talent-tree-cols">${cols}</div></div>
        <p class="talent-hint">各路徑內同層三選一互斥 · 上路徑滿 5 點解鎖下層 · 左鍵+1 Shift+左鍵-1</p></div>`;
    requestAnimationFrame(() => talentDrawLines());
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
            let activeId = talentPathTierNodes(path, tier).find(id => talentNodeLevel(t, id) > 0);
            let btn = activeId ? document.getElementById('talent-btn-' + activeId) : document.getElementById('talent-btn-' + _talentNodeId(path, tier, 'l'));
            if (!btn) continue;
            let br = btn.getBoundingClientRect();
            let cx = br.left + br.width / 2 - rect.left;
            let cy = br.top + br.height / 2 - rect.top;
            if (prev) {
                let lit = !!(activeId && talentNodeLevel(t, activeId) > 0 && prev.lit);
                let line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', prev.cx); line.setAttribute('y1', prev.cy);
                line.setAttribute('x2', cx); line.setAttribute('y2', cy);
                line.setAttribute('class', lit ? 'talent-line talent-line-lit' : 'talent-line talent-line-dim');
                svg.appendChild(line);
            }
            prev = { cx, cy, lit: !!(activeId && talentNodeLevel(t, activeId) > 0) };
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

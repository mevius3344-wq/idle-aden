function newMobStatus() {
    return { freeze:0, stun:0, stone:0, sleep:0, paralyze:0, poison:0, poisonTick:30, poisonDmg:0, poisonStacks:0, poisonUnit:0,
             blind:0, blindVal:0, weaken:0, disease:0, vacuum:0, broken:0, slow:0, mrhalf:0, magicseal:0, fragile:0, shatter:0, armorbreak:0, confuse:0, panic:0, guardbreak:0, terror:0, doom:0, strawCurse:0, muddywater:0, bind:0 };   // 🌊 污濁之水：頭目回血減半（js/03）；⚡ v3.7.52 paralyze 麻痺（審判落雷·硬控同暈眩）；🕸️ v3.7.75 bind 束縛
}
// 🕸️ v3.7.75 束縛：被束縛者「原地不動」——本身不是硬控（仍可施法／使用技能），只擋一般攻擊：
//   ‧ 被束縛的玩家／傭兵：手上不是遠距離武器就打不出一般攻擊（裝弓/十字弓＝隔空射擊·不受影響）。
//   ‧ 被束縛的怪物：搆不到「裝備遠距離武器」的玩家／傭兵，那一次一般攻擊落空（近戰目標照打）。
//   對頭目無效（BOSS_IMMUNE 已含 bind）。
function isRangedArmed(ent) {
    let w = (ent && ent.eq && ent.eq.wpn) ? DB.items[ent.eq.wpn.id] : null;
    return !!(w && (w.ranged || w.isBow));
}
function bindSelfBlocked(ent) {   // 玩家／傭兵：自己被束縛且非遠距離武器→無法一般攻擊
    let st = (typeof player !== 'undefined' && ent === player) ? player.statuses : (ent && ent.statuses);
    return !!(st && st.bind > 0) && !isRangedArmed(ent);
}
function bindMobBlockedVs(m, target) {   // 怪物：自己被束縛且目標為遠距離武器持有者→這次一般攻擊搆不到
    if (!(m && m.st && m.st.bind > 0) || !isRangedArmed(target)) return false;
    if (state.ticks - (m._bindLogAt == null ? -999 : m._bindLogAt) >= 30) {   // 每 3 秒最多一則（攻速快的怪每 1~2 秒一次會洗版）
        m._bindLogAt = state.ticks;
        logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 被束縛住，構不到遠距離攻擊的你們。`, 'miss');
    }
    return true;
}
function mobEffAC(m, actor) { let _weakOk = (m.weakExpose > 0) && ((actor && actor !== player) ? allyHasMastery(actor, 'k_weakness') : hasMastery('k_weakness')); return (m.ac || 0) + ((m.st && m.st.disease > 0) ? 8 : 0) + ((m.st && (m.st.confuse > 0 || m.st.panic > 0)) ? 5 : 0) + ((m.st && m.st.guardbreak > 0) ? 10 : 0) + (_weakOk ? 3 * Math.min(5, m.weakExpose) : 0) - ((m.st && m.st.shatter > 0) ? 10 : 0) - ((m._acGuardEnd > state.ticks) ? (m._acGuardVal || 0) : 0); }   // 🔮 月光碎裂：AC-10；混亂/恐慌：AC+5；🐉 護衛毀滅：AC+10；🐉 弱點精通：每層弱點曝光 AC+3（更易被命中·讀「攻擊者」精通：傭兵傳 actor→吃傭兵自身精通、玩家/召喚無 actor→吃玩家精通）   // 🗼 鋼鐵防護：暫時降低 AC
function moonShatterOnDamage(owner, target, dmg) {
    if (owner === player && dmg > 0 && typeof playerOnDealDamage === 'function') playerOnDealDamage(dmg);
    if (target && target.boss && dmg > 0 && typeof isWorldBossMap === 'function' && isWorldBossMap(mapState.current)
        && typeof wbReportDamage === 'function' && typeof wbShouldFollow === 'function' && wbShouldFollow()) {
        wbReportDamage(target, dmg);
    }
    if (!owner || !owner._setMoon5 || !target || target._dead || (target.curHp || 0) <= 0 || !(dmg > 0)) return false;
    if (!target.st) target.st = newMobStatus();
    let firstApply = !(target.st.shatter > 0);
    target.st.shatter = 30;   // 月光 5/5：碎裂 3 秒，最多 1 層、重複傷害刷新
    return firstApply;
}
function mobActDisabled(m) {
    let s = m.st; if(!s) return false;
    return s.freeze > 0 || s.stun > 0 || s.stone > 0 || s.sleep > 0 || s.paralyze > 0;   // ⚡ v3.7.52 麻痺＝硬控（審判落雷）
}
// 怪物受到任何傷害時觸發（解除沉睡）
function mobWake(m) {
    if(m.st && m.st.sleep > 0) { m.st.sleep = 0; logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 從沉睡中醒來。`, 'magic'); }
}
function traumaPhysicalBonus(target) {
    return (target && target._trauma && target._trauma.until > state.ticks) ? (target._trauma.dmg || 5) * (target._trauma.s || 1) : 0;
}
const STATUS_NAME = { freeze:'冰凍', stun:'暈眩', stone:'石化', sleep:'沉睡', paralyze:'麻痺', poison:'中毒',
    blind:'目盲', weaken:'弱化', disease:'疾病', vacuum:'真空', broken:'損壞', slow:'緩速', mrhalf:'魔抗減半', magicseal:'魔法封印', fragile:'脆弱', shatter:'碎裂', armorbreak:'破甲', confuse:'混亂', panic:'恐慌', guardbreak:'護衛毀滅', terror:'恐懼', doom:'死神', muddywater:'污濁', bind:'束縛' };   // 🔮 脆弱（白鳥5）：受所有傷害+10%；月光碎裂：AC-10；🐉 護衛毀滅/恐懼/死神；🌊 污濁（污濁之水·頭目回血減半）；🕸️ v3.7.75 束縛
// 特定狀態的專屬套用訊息（接於怪物名稱後）
const STATUS_MSG = { magicseal:'的魔法遭到封印了。' };
// 對 BOSS 無效的行動限制類狀態
const BOSS_IMMUNE = ['freeze','stun','stone','sleep','paralyze','bind'];   // ⚡ v3.7.52 麻痺＝行動限制類·頭目免疫；🕸️ v3.7.75 束縛（行動限制類）亦對頭目無效
// 異常魔法命中判定（玩家對怪物，共用）：命中值 = 玩家等級 + 魔法命中 − (怪等級−10) − 怪MR/10，
// clamp[0,20]，擲 1d20（與一般攻擊相同：擲20必中、擲1必失、其餘 命中值≥骰值 即命中），命中率 5%~95%。
// 異常魔法命中（玩家對怪物）：d20 機制，命中值 hv 上限預設 20（最高 95%）。
// 🔧 傳入 maxHv 可降低成功率上限：maxHv=12 → 最高 60%（起死回生術、迷魅術用）。自然20必中、自然1必失。
function abnormalMagicHit(m, maxHv, hitOff) {
    let hv = player.lv + (player.d.magicHit || 0) + (hitOff || 0) - ((m.lv || 0) - 10) - ((m.mr || 0) / 10);
    hv = Math.max(0, Math.min(maxHv || 20, hv));
    let r = roll(1, 20);
    return (r === 20) || (r !== 1 && hv >= r);
}
function allyAbnormalMagicHit(ally, m, maxHv, hitOff) {
    let savedPlayer = player;
    player = ally;
    try { return abnormalMagicHit(m, maxHv, hitOff); }
    finally { player = savedPlayer; }
}
function applyMobStatus(m, st, skillName, damageCoef) {
    if(!m.st) m.st = newMobStatus();
    if(BOSS_IMMUNE.includes(st.kind) && m.boss) return;
    if(st.pct != null && Math.random() * 100 >= st.pct) return;   // 🏺 v3.7.20 st.pct：固定機率擲骰（寒冰尖刺 50% 冰凍·搭配 force 跳過魔抗判定；未附 pct 者行為不變）
    // 異常狀態魔法命中（玩家對怪物）：見 abnormalMagicHit；st.hitOff＝命中加值（🏛️ 真．冥皇執行劍 衝擊之暈 +4≈命中率+20%）
    // ⚡ st.force：跳過魔抗命中判定，由呼叫端自行擲固定機率（雷神之鎚電光衝擊／伊娃的責罵水之矛的 5% 固定附加）；BOSS 免疫仍上方先擋
    if(!st.force && !abnormalMagicHit(m, undefined, st.hitOff)) {
        logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 抵抗了${skillName || '異常狀態'}。`, 'miss');
        return;
    }
    // 持續時間：支援固定 dur(秒) 或隨機 durRand:[最小,最大]（秒）
    let durSec = st.durRand ? roll(st.durRand[0], st.durRand[1]) : (st.dur || 6);
    let dur = durSec * 10;
    let k = st.kind;
    if(k === 'poison') {
        m.st.poison = dur; m.st.poisonTick = (st.tick || 3) * 10;
        m.st.poisonDmg = Math.max(1, Math.floor(roll(st.dmg[0], st.dmg[1]) * (damageCoef || 1) * wpnEnFinalMult(player && player.eq && player.eq.wpn)));   // 傷害魔法毒咒吃統一係數；通用武器毒傷未傳係數，維持原樣
        m.st.poisonStacks = 1; m.st.poisonUnit = m.st.poisonDmg;   // 技能類中毒：單層（不疊加），仍顯示層數符號
        m.st.poisonSrc = (player && player._allyName) ? _dpsAllySrc(player) : 'player';   // 🎯 DPS 歸因：技能型中毒也要記施加者（傭兵路徑已把 player 換身成 ally）；不寫會沿用前一位施加者的來源或誤記到玩家
    } else if(k === 'blind') {
        m.st.blind = dur; m.st.blindVal = st.hit || 4;
    } else if(k in m.st) {
        m.st[k] = dur;
    }
    
    // 👇 統一將狀態改變改寫為「施展 XXX，對 OOO 造成 XX 狀態」（🔧 中毒不輸出「敵人中毒」套用訊息，只保留每秒中毒傷害日誌）
    if(k !== 'poison') {
        let prefix = skillName ? `施展 ${skillName}，` : ``;
        if(STATUS_MSG[k]) {
            logCombat(`${prefix}<span class="${getMobColor(m.lv)}">${m.n}</span> ${STATUS_MSG[k]}`, 'magic');
        } else {
            logCombat(`${prefix}對 <span class="${getMobColor(m.lv)}">${m.n}</span> 造成 ${STATUS_NAME[k]||k} 狀態。`, 'magic');
        }
    }
}
function mobHasTag(m, tag) {
    if(tag === 'undead') return !!m.un;
    // 元素生物標籤：在怪物定義中加入「elem: true」即視為元素生物，
    //   會被「釋放元素(sk_elf_release)」依機率即死。範例見 salamander(火蜥蜴)。
    if(tag === 'element') return !!m.elem;
    if(tag === '硬皮') return !!m.hard;   // 🔧 硬皮：額外物理減傷（魔法不減），會被攻擊消磨、每10秒再生
    return false;
}

// ===== 🔧 硬皮系統 =====
// 硬皮值＝額外的「物理」傷害減免（魔法傷害不減）。最大值：一般怪 等級÷2、頭目 等級×1、四大龍(法利昂/安塔瑞斯/巴拉卡斯/林德拜爾) 等級×2、
// 城門 = 玩家等級、守護塔 = 玩家等級÷2；席琳的世界 ×1（不再加成）。
// 消磨（現行·見下方 wearHardSkin 為單一真相）：玩家/傭兵一般攻擊命中固定 -1，並與「粉碎武器(eff:crush) -1」
//       「單手鈍器鈍擊 -1」「武器 hardWear（大馬士革鋼爪/雙刀）」疊加。每 10 秒恢復 3% 最大值。
//       ⚠️ 2026-06 起「重擊(heavy)額外削減」已全數移除（原 -20 雙手鈍器/屠龍劍、-5 單手鈍器、-2 通用）；
//          魔擊亦以 heavy 呼叫→隨之不再削減，故魔法與共鳴皆不消磨硬皮。
function initHardSkin(m) {
    if (!m || !m.hard) return;
    let mx;
    if (m.n === '肯特城門' || m.n === '風木城門') mx = Math.max(1, player.lv);              // 🔧 城門：硬皮 = 玩家等級
    else if (m.n === '肯特守護塔' || m.n === '風木守護塔') mx = Math.max(1, Math.floor(player.lv / 2));   // 🔧 守護塔：硬皮 = 玩家等級÷2
    else {
        let per = ['安塔瑞斯', '法利昂', '巴拉卡斯', '林德拜爾'].includes(m.n) ? 2 : (m.boss ? 1 : 0.5);   // 四大龍×2、其餘頭目×1、一般怪×0.5
        mx = Math.max(1, Math.floor((m.lv || 1) * per));   // 席琳的世界 ×1（不再加成；攻城區不觸發 _sherine，城門/守護塔不受影響）
    }
    m.hardSkinMax = mx;
    m.hardSkin = mx;
}
function mobHardSkin(m) { return (m && m.hardSkin > 0) ? m.hardSkin : 0; }   // 物理減傷量（供傷害公式扣減）
// 依武器特效與重擊/鈍擊消磨硬皮值；wpnId 為攻擊者（玩家或傭兵）的武器 id
function wearHardSkin(target, wpnId, heavy, bluntProc, basic, suppressEff) {
    if (!target || !(target.hardSkin > 0)) return;
    let dec = 0;
    let _wd = wpnId ? DB.items[wpnId] : null;
    let _isCrush = !suppressEff && !!(_wd && _wd.eff === 'crush');   // 🎮 經典模式：停用重擊(粉碎)
    // 🔧 2026-06 取消「重擊(heavy)額外削減硬皮值」(原 -20粉碎/屠龍、-5單手鈍器、-2通用 全移除)；魔擊以 heavy 呼叫→隨之不再削減→魔法與共鳴皆不削減硬皮值
    if (_isCrush) dec += 1;   // 🔧 粉碎武器：一般攻擊命中磨 1 硬皮值（保留·非重擊額外）
    if (bluntProc) dec += 1;   // 單手鈍器鈍擊
    if (basic) dec += 1;   // 🔧 玩家/傭兵一般攻擊命中：固定再磨 1 硬皮值（與上述重擊/粉碎/鈍擊削減疊加）
    if (_wd && _wd.hardWear) dec += _wd.hardWear;   // 🔧 大馬士革鋼爪/雙刀：一般攻擊命中額外削減硬皮值
    if (dec > 0) target.hardSkin = Math.max(0, target.hardSkin - dec);
}
function tryInstakill(m, ik, skillName, idx, deferKill) {
    if(m.boss) return false;

    // 👇 加上 ik.tag 的存在判定：只有在規定了特定 tag 時，才去檢查怪物有沒有該 tag
    if(ik.tag && !mobHasTag(m, ik.tag)) return false;

    // 固定機率即死（骰子匕首 ik.p=0.01 → 1%）；技能型即死(無 ik.p)才用異常魔法命中公式
    // 🔧 ik.cap 限制成功率上限（起死回生術 cap=12 → 最高 60%）；未設定則維持 5%~95%
    if(typeof ik.p === 'number') { if(Math.random() >= ik.p) return false; }
    else if(!abnormalMagicHit(m, ik.cap)) return false;

    logCombat(`${skillName} 使 <span class="${getMobColor(m.lv)}">${m.n}</span> 立即死亡！`, 'player-special');
    m.curHp = 0;
    // 🔧 deferKill：傭兵即死技在「player 暫時換身成傭兵」的視窗內呼叫；此時不可結算 killMob
    //    （否則經驗/金幣/掉落會加到傭兵身上隨即遺失、且 killMob 結尾的 updateUI 會閃現傭兵資料）。
    //    改由呼叫端在「還原 player 之後」再對該怪 killMob，確保結算與 UI 都歸真實玩家。
    if(!deferKill) killMob(idx);
    return true;
}
// 出血：對怪物施加一層出血（每秒造成 hitDmg 的 20%，持續 8 秒）。預設最多 5 層；🔧 出血精通：匕首/矛/雙刀可達 10 層、每秒總傷害 ×(1+0.1×層數)；已滿時新層取代最舊層。
function applyBleed(m, hitDmg, maxLayers, masteryBoost, src) {
    if(!m.bleeds) m.bleeds = [];
    let cap = Math.max(maxLayers || 5, m._bleedCap || 0);   // 🔧 多來源共用同一出血層陣列：取「本段出血曾出現過的最高上限」，避免低上限來源(如玩家匕首5層)把高上限來源(黑妖傭兵出血精通10層)的層數砍掉
    m._bleedCap = cap;
    let dps = Math.max(1, Math.floor(hitDmg * 0.20));
    while(m.bleeds.length >= cap) m.bleeds.shift();      // 超過上限：移除最舊的，由新層取代
    m.bleeds.push({ dmg: dps, ticksLeft: 80 });          // 8 秒 = 80 ticks
    m._bleedSrc = src || 'player';                       // 🎯 DPS：出血 DoT 施加者（多來源→取最後施加者·單一標記簡化）；玩家路徑不傳 src→'player'
    if(masteryBoost) m._bleedMastery = true;             // 🔧 出血精通：此怪出血每秒總傷害 ×(1+0.1×層數)（10 層 = +100%）
    // 🔧 不再輸出「敵人陷入出血」套用訊息（依需求只保留每秒出血傷害日誌）
}
// 🏺 v3.1.80 永不終止的夢魘（dotCrit）：隊伍（玩家優先，其次非倒地傭兵）任一人裝備 → 我方施加的持續傷害（中毒/出血/猛爆劇毒）可觸發爆擊。
//    機率＝5% + 裝備者近距離爆擊率；傷害 ×(1+裝備者近距離爆擊傷害%)（基礎 50%→×1.5、黑妖 100%→×2）。回傳 {dmg, crit}。
function _teamDotCrit(base) {
    let w = null;
    if (typeof player !== 'undefined' && player && !player.dead && player.d && player.d.dotCrit) w = player;
    else { let _as = (typeof player !== 'undefined' && player && player.allies) || []; for (let _i = 0; _i < _as.length; _i++) { let a = _as[_i]; if (a && !a._downed && a.d && a.d.dotCrit) { w = a; break; } } }
    if (!w || base <= 0) return { dmg: base, crit: false };
    if (Math.random() * 100 >= (5 + ((w.d.meleeCrit) || 0))) return { dmg: base, crit: false };
    return { dmg: Math.max(1, Math.floor(base * (1 + ((w.d.meleeCritDmg) || 50) / 100))), crit: true };
}
// 每 tick 處理怪物身上的狀態（倒數、中毒 DoT）。回傳 true 代表該怪物已死亡。
function processMobStatusTick(m, i) {
    if(!m.st) { m.st = newMobStatus(); return false; }
    let s = m.st;
    ['freeze','stun','stone','sleep','paralyze','blind','weaken','disease','vacuum','broken','slow','mrhalf','magicseal','fragile','shatter','armorbreak','confuse','panic','guardbreak','terror','doom','muddywater','bind'].forEach(k => {   // 🔮 含脆弱、月光碎裂、🔧 含破壞盔甲、🔮 含混亂/恐慌、🐉 含護衛毀滅/恐懼/死神、🌊 含污濁、⚡ 含麻痺、🕸️ 含束縛
        if(s[k] > 0) s[k]--;
    });
    if(s.blind <= 0) s.blindVal = 0;
    if(s.poison > 0) {
        s.poison--;
        if(state.ticks % (s.poisonTick || 30) === 0) {
            let _pdc = _teamDotCrit(s.poisonDmg);   // 🏺 v3.1.80 永不終止的夢魘：中毒 DoT 可爆擊
            m.curHp -= _pdc.dmg; m.justHit = 'magic'; mobWake(m); _dpsCreditDot(s.poisonSrc, _pdc.dmg);   // 🎯 DPS：中毒 DoT 依施加者歸因（玩家/傭兵/召喚·未標記→玩家）
            logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 受到中毒傷害 ${_pdc.dmg} 點。${_pdc.crit ? ' <span class="text-yellow-500 font-bold">(爆擊!)</span>' : ''}`, 'dot');   // 🟢 中毒 DoT→綠色持續傷害分類
            if(m.curHp <= 0) { killMob(i); return true; }
        }
        if(s.poison <= 0) { s.poisonStacks = 0; s.poisonUnit = 0; s.poisonDmg = 0; s.poisonSrc = undefined; }   // 中毒結束：清空層數與 DPS 歸因來源（不清會跨中毒週期污染下一位施加者的統計）
    }
    // 出血 DoT：可疊 5 層，每層各自獨立計時，每秒(10 ticks)造成一次傷害；同 tick 觸發的多層合併為一次顯示
    if(m.bleeds && m.bleeds.length) {
        let bleedTotal = 0;
        for(let bi = m.bleeds.length - 1; bi >= 0; bi--) {
            let b = m.bleeds[bi];
            b.ticksLeft--;
            if(b.ticksLeft % 10 === 0) bleedTotal += b.dmg;
            if(b.ticksLeft <= 0) m.bleeds.splice(bi, 1);
        }
        if(bleedTotal > 0) {
            // 🔧 出血精通：每秒出血總傷害 ×(1 + 0.1×層數)（每層 +10%、10 層 = +100%）
            if(m._bleedMastery) bleedTotal = Math.floor(bleedTotal * (1 + 0.10 * m.bleeds.length));
            let _bdc = _teamDotCrit(bleedTotal);   // 🏺 v3.1.80 永不終止的夢魘：出血 DoT 可爆擊
            m.curHp -= _bdc.dmg; m.justHit = 'magic'; mobWake(m); _dpsCreditDot(m._bleedSrc, _bdc.dmg);   // 🎯 DPS：出血 DoT 依施加者歸因（玩家/傭兵/寵物·未標記→玩家）
            logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 受到出血傷害 ${_bdc.dmg} 點（${m.bleeds.length} 層）。${_bdc.crit ? ' <span class="text-yellow-500 font-bold">(爆擊!)</span>' : ''}`, 'dot');   // 🟢 出血 DoT→綠色持續傷害分類(原 'player' 藍色一般攻擊)
            if(m.curHp <= 0) { killMob(i); return true; }
            if(!state.ff) renderMobs();
        }
        if(m.bleeds.length === 0) { m._bleedMastery = false; m._bleedCap = 0; }   // 出血結束：清除精通旗標與層數上限
    }
    // 💥 猛爆劇毒 DoT：每秒(10 ticks)固定 100 真傷（無視硬皮/魔抗），持續 5 秒(50 ticks)、最多 1 層；獨立於一般中毒/出血
    if(m._burstPoison && m._burstPoison.left > 0) {
        m._burstPoison.left--;
        if(m._burstPoison.left % 10 === 0) {
            let _udc = _teamDotCrit(m._burstPoison.dmg);   // 🏺 v3.1.80 永不終止的夢魘：猛爆劇毒 DoT 可爆擊
            m.curHp -= _udc.dmg; m.justHit = 'magic'; mobWake(m); _dpsCreditDot(m._burstPoison.src, _udc.dmg);   // 🎯 DPS：猛爆劇毒 DoT 依施加者歸因（未標記→玩家）
            logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 受到猛爆劇毒傷害 ${_udc.dmg} 點。${_udc.crit ? ' <span class="text-yellow-500 font-bold">(爆擊!)</span>' : ''}`, 'dot');   // 🟢 猛爆劇毒 DoT→綠色持續傷害分類(原 'player' 藍色一般攻擊)
            if(m.curHp <= 0) { m._burstPoison = null; killMob(i); return true; }
            if(!state.ff) renderMobs();
        }
        if(m._burstPoison.left <= 0) m._burstPoison = null;
    }
    // 🔥 灼燒 DoT（熔岩灼燒的雙拳·procBurn）：每 tick 造成 dmg 火傷，持續 left ticks；獨立於中毒/出血/猛爆劇毒
    if(m._burnDot && m._burnDot.left > 0) {
        m._burnDot.left--;
        if(m._burnDot.left % (m._burnDot.tick || 10) === 0) {
            let _fdc = _teamDotCrit(m._burnDot.dmg);   // 🏺 灼燒 DoT 可爆擊（與中毒/出血一致）
            m.curHp -= _fdc.dmg; m.justHit = 'fire'; mobWake(m); _dpsCreditDot(m._burnDot.src, _fdc.dmg);   // 🎯 DPS：灼燒 DoT 依施加者歸因（未標記→玩家）
            logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 受到灼燒傷害 ${_fdc.dmg} 點。${_fdc.crit ? ' <span class="text-yellow-500 font-bold">(爆擊!)</span>' : ''}`, 'dot');   // 🟢 灼燒 DoT→綠色持續傷害分類
            if(m.curHp <= 0) { m._burnDot = null; killMob(i); return true; }
            if(!state.ff) renderMobs();
        }
        if(m._burnDot.left <= 0) m._burnDot = null;
    }
    return m.curHp <= 0;
}

// ---------- 召喚物 ----------
function summonTierByLevel(lv) {
    // dmgMult：階級最終傷害倍率；hardSkinPen：忽略硬皮比例；高階觸發技改為固定間隔，避免長時間不發動或魅力多段造成爆量傷害。
    if(lv >= 72) return { n:'召喚：黑豹', dmgDice:[2,14], dmgDiv:6, dmgLvDiv:10, dmgMult:1.28, hardSkinPen:0.75, interval:10, kind:'melee', hitLvOff:20, proc:{ p:1, cd:80, dmgDice:[6,10], ele:'none', name:'撕咬' } };
    if(lv >= 64) return { n:'召喚：地獄束縛犬', dmgDice:[3,15], dmgDiv:4, dmgLvDiv:15, dmgMult:1.22, hardSkinPen:0.50, interval:20, kind:'melee', hitLvOff:15, proc:{ p:1, cd:100, dmgDice:[4,12], ele:'fire', name:'噴火' } };
    if(lv >= 60) return { n:'召喚：地獄奴隸', dmgDice:[3,12], dmgDiv:4, dmgLvDiv:20, dmgMult:1.18, hardSkinPen:0.50, interval:20, kind:'melee', hitLvOff:12, proc:{ p:1, cd:120, dmgDice:[1,32], ele:'earth', name:'地獄之牙' } };
    if(lv >= 52) return { n:'召喚：魔狼', dmgDice:[1,15], dmgDiv:5, dmgLvDiv:25, dmgMult:1.12, hardSkinPen:0.25, interval:10, kind:'melee', hitLvOff:10 };
    if(lv >= 40) return { n:'召喚：食人妖精', dmgDice:[2,11], dmgDiv:4, dmgLvDiv:30, dmgMult:1.08, interval:20, kind:'melee', hitLvOff:7 };
    if(lv >= 32) return { n:'召喚：甘地妖魔', dmgDice:[2,8], dmgDiv:5, dmgLvDiv:35, dmgMult:1.00, interval:20, kind:'melee', hitLvOff:3 };
    return { n:'召喚：哈柏哥布林', dmgDice:[1,15], dmgDiv:5, dmgLvDiv:40, dmgMult:0.90, interval:20, kind:'melee', hitLvOff:0 };
}
// 🧱 v3.4.50 傭兵召喚物「戰鬥實體」欄位（用戶要求：無 sprite 在場·但有受擊判定與血量）：
//   給 ally.summon 補 uid/form/lv/hp/mhp → 進 js/04 受害者池(物理+傷害型魔法)·受擊走 js/23 enemyAttackSummon/applyMobMagicToSummon(通用·靠 _sumDeriveAny 算 ac/dr)。
//   HP 鏡像玩家 v2 資料：召喚術＝該怪 v2 hp×隻數·造屍＝ZOMBIE_TIERS.hp·精靈＝SPIRIT_DEF/_KING hp；舊分階 fallback＝100+等級×5。
//   ⚠️只作用於傭兵(owner!==player)——玩家迷魅(sk_charm)走同一 buildSummon 但 owner===player→不附加(維持無敵抽象)。欄位全為純值·無循環參照(可入存檔)。
function _mercSummonAttachEntity(sm, owner) {
    if (!sm || !owner || (typeof player !== 'undefined' && owner === player)) return sm;
    try {
        let hp = 0, lv = sm._v2lv || owner.lv || 1, form = sm._v2form || sm.n;
        if (sm.skId === 'sk_zombie') { let t = (typeof ZOMBIE_TIERS !== 'undefined') ? ZOMBIE_TIERS.find(x => x.lv === lv) : null; hp = t ? t.hp : 0; form = '人形殭屍'; }
        else if (sm.skId === 'sk_elf_summon' || sm.skId === 'sk_elf_summon2') { let spec = (typeof _spiritSpec === 'function') ? _spiritSpec(sm.skId, sm.ele, !!sm._king) : null; if (spec) { hp = spec.hp; lv = spec.lv; } form = sm.n; }
        else if (sm._v2form && typeof _sumTierOf === 'function') { let e = _sumTierOf(sm._v2form); hp = ((e && e.mob && e.mob.hp) || 0) * (sm._v2count || 1); form = sm._v2form; }
        if (!(hp > 0)) hp = 100 + (owner.lv || 1) * 5;   // 舊分階模型 fallback（低等傭兵）
        sm.uid = sm.uid || (typeof uid === 'function' ? uid() : String(Date.now()) + Math.random());
        sm.form = form; sm.lv = lv; sm.mhp = hp; sm.hp = hp; sm._downed = false;
    } catch (e) {}
    return sm;
}
// 🧱 v3.5.94 傭兵召喚物「重新規劃後回流實體欄位」：refreshSummonBalance 的 v2 分支原本只更新 _v2*（進攻面·js/07 讀），
//   防禦面的 sm.form/sm.lv/sm.mhp 卻只在初次召喚時由 _mercSummonAttachEntity 寫入，導致傭兵升級後
//   js/23 的受擊命中判定(s.lv)與 ac/dr 推導(_sumDeriveAny 以 s.form 優先於 s.n)永遠停在初次召喚的階級、血量也不隨階級成長。
//   ⚠️血量按舊比例換算到新上限（勿趁升級偷偷補滿血）·已倒下(_downed)者維持倒下不被復活。
function _mercSummonRefreshEntity(sm, owner) {
    if (!sm || !owner || (typeof player !== 'undefined' && owner === player)) return sm;
    let oldMax = sm.mhp > 0 ? sm.mhp : 0, oldHp = sm.hp > 0 ? sm.hp : 0, wasDowned = !!sm._downed;
    let ratio = oldMax > 0 ? Math.max(0, Math.min(1, oldHp / oldMax)) : 1;
    _mercSummonAttachEntity(sm, owner);   // 依已更新的 _v2form/_v2lv 重算 form/lv/mhp（內部會補滿 hp 並清 _downed→下面還原）
    if (wasDowned) { sm.hp = 0; sm._downed = true; }
    else if (oldMax > 0 && sm.mhp > 0) sm.hp = Math.max(1, Math.min(sm.mhp, Math.round(sm.mhp * ratio)));
    return sm;
}
function buildSummon(skId, def, durSec, owner) {
    owner = owner || player;   // 🩸 v2.6.25 owner 參數化：分階依 owner.lv、屬性精靈依 owner.elfEle（傭兵召喚共用）
    // 🧙 v3.3.23 傭兵召喚術改用玩家 v2 傷害模型（抽象輸出·不上場）：依傭兵等級＋召喚控制戒指選怪（SUMMON_TIERS）·每攻擊週期打 count 隻份 v2 傷害。玩家 sk_summon 走 js/23 v2 實體制不經此；此分支只作用於傭兵(owner!==player)。無法召喚(等級/魅力不足)則落回下方舊分階模型。
    if (skId === 'sk_summon' && owner !== player && typeof mercSummonV2Plan === 'function') {
        let _plan = mercSummonV2Plan(owner);
        if (_plan) {
            let _d0 = _sumDerive({ form: _plan.form, n: _plan.form }, owner);
            return _mercSummonAttachEntity({ skId: skId, n: _plan.form + ' ×' + _plan.count, _v2form: _plan.form, _v2count: _plan.count, _v2lv: _plan.lv,
                interval: _d0.aspd || 20, cd: _d0.aspd || 20, kind: 'v2', ele: 'none', dmgDice: [1, 1], dmgDiv: 5, dmgLvDiv: 0, elemScale: 20, dmgMult: 1, hardSkinPen: 0, mrPenBase: 0, hitLvOff: 0, proc: null,
                endTick: state.ticks + (durSec || 3600) * 10 }, owner);   // 🧱 v3.4.50 附戰鬥實體欄位
        }
    }
    // 🧟 v3.3.24 傭兵造屍術改用玩家 v2 傷害模型（抽象輸出·不上場）：殭屍階級依傭兵等級（_zmbTierForPlayer）·單隻·每週期 1 刀 v2 傷害（_zmbDerive）。等級不足回 null 則落回下方舊模型。
    if (skId === 'sk_zombie' && owner !== player && typeof _zmbTierForPlayer === 'function') {
        let _zt = _zmbTierForPlayer(owner);
        if (_zt) {
            let _zd = _zmbDerive({ lv: _zt.lv, skId: 'sk_zombie' }, owner);
            return _mercSummonAttachEntity({ skId: skId, n: '人形殭屍 Lv.' + _zt.lv, _v2form: '人形殭屍', _v2zmb: true, _v2count: 1, _v2lv: _zt.lv,
                interval: _zd.aspd || 12, cd: _zd.aspd || 12, kind: 'v2', ele: 'none', dmgDice: [1, 1], dmgDiv: 5, dmgLvDiv: 0, elemScale: 20, dmgMult: 1, hardSkinPen: 0, mrPenBase: 0, hitLvOff: 0, proc: null,
                endTick: state.ticks + (durSec || 3600) * 10 }, owner);   // 🧱 v3.4.50 附戰鬥實體欄位
        }
    }
    let base = def.tiered ? summonTierByLevel(owner.lv) : def;
    let ele = base.ele || 'none';
    if(def.eleFromPlayer) ele = owner.elfEle || 'none';
    let nm = base.n;
    if(def.eleFromPlayer) {
        let eleZh = { fire:'火', water:'水', wind:'風', earth:'地', none:'無' }[ele] || '';
        nm = base.n.replace('{ele}', eleZh);
    }
    let _sm = {
        skId: skId, n: nm, dmgDice: base.dmgDice, interval: base.interval || 20,
        ele: ele, kind: base.kind || 'melee', hitLvOff: base.hitLvOff || 0,
        dmgDiv: base.dmgDiv || 5, dmgLvDiv: base.dmgLvDiv || 0, elemScale: base.elemScale || 20,
        dmgMult: base.dmgMult || 1, hardSkinPen: base.hardSkinPen || 0, mrPenBase: base.mrPenBase || 0,
        proc: base.proc ? { ...base.proc, cdCur: base.proc.cd } : null,
        cd: base.interval || 20, endTick: state.ticks + (durSec || 3600) * 10
    };
    if (typeof _elfSpiritKingOverride === 'function') _elfSpiritKingOverride(_sm, owner);   // 👑 v3.2.25 精靈精通→精靈王（傭兵鏡像）
    return _mercSummonAttachEntity(_sm, owner);   // 🧱 v3.4.50 傭兵→附戰鬥實體欄位；玩家(迷魅)→原樣返回
}
function refreshSummonBalance(sm, owner) {
    owner = owner || player;
    if (sm && owner !== player && !(sm.mhp > 0)) _mercSummonAttachEntity(sm, owner);   // 🧱 v3.4.50 舊存檔遷移：讀檔後傭兵召喚物缺血量欄位→補齊（滿血）
    if (sm && sm._v2zmb) {   // 🧟 v3.3.24 傭兵造屍術 v2：讀檔後依當前等級重算殭屍階級與攻速（抽象輸出·無 dmgDice）
        let _zt = (typeof _zmbTierForPlayer === 'function') ? _zmbTierForPlayer(owner) : null;
        if (_zt) { let _zd = _zmbDerive({ lv: _zt.lv, skId: 'sk_zombie' }, owner); sm._v2lv = _zt.lv; sm.interval = _zd.aspd || 12; sm.n = '人形殭屍 Lv.' + _zt.lv; _mercSummonRefreshEntity(sm, owner); }   // 🧱 v3.5.94 新階級回流 form/lv/mhp（否則受擊判定仍吃舊 s.lv）
        return sm;
    }
    if (sm && sm._v2form) {   // 🧙 v3.3.23 傭兵召喚術 v2：讀檔後依當前等級/魅力/戒指重算選怪與攻速（抽象輸出·無 dmgDice·避免被下方舊分階模型洗回）
        let _plan = (typeof mercSummonV2Plan === 'function') ? mercSummonV2Plan(owner) : null;
        if (_plan) { let _d0 = _sumDerive({ form: _plan.form, n: _plan.form }, owner); sm._v2form = _plan.form; sm._v2count = _plan.count; sm._v2lv = _plan.lv; sm.interval = _d0.aspd || 20; sm.n = _plan.form + ' ×' + _plan.count; _mercSummonRefreshEntity(sm, owner); }   // 🧱 v3.5.94 新形態/隻數回流 form/lv/mhp（_sumDeriveAny 以 s.form 優先→不同步會用舊階級算 ac/dr）
        return sm;
    }
    if(!sm || !sm.skId || !DB.skills[sm.skId] || !DB.skills[sm.skId].summon) return sm;
    let def = DB.skills[sm.skId].summon;
    let base = def.tiered ? summonTierByLevel(owner.lv) : def;
    sm.dmgDice = base.dmgDice;
    sm.interval = base.interval || 20;
    sm.hitLvOff = base.hitLvOff || 0;
    sm.dmgDiv = base.dmgDiv || 5;
    sm.dmgLvDiv = base.dmgLvDiv || 0;
    sm.elemScale = base.elemScale || 20;
    sm.dmgMult = base.dmgMult || 1;
    sm.hardSkinPen = base.hardSkinPen || 0;
    sm.mrPenBase = base.mrPenBase || 0;
    if(base.proc) {
        let oldCd = sm.proc && sm.proc.cdCur;
        sm.proc = { ...base.proc, cdCur: Math.min(oldCd > 0 ? oldCd : base.proc.cd, base.proc.cd) };
    } else sm.proc = null;
    if (typeof _elfSpiritKingOverride === 'function') _elfSpiritKingOverride(sm, owner);   // 👑 v3.2.25 讀檔重算後補套精靈王覆寫（否則被 def 原值洗回）
    _mercSummonRefreshEntity(sm, owner);   // 🧱 v3.5.94 舊分階/精靈路徑同樣回流 lv/mhp（與上面兩條 v2 分支同機制：不同步→受擊判定永遠停在初次召喚等級；精靈王覆寫後才算才吃得到王的 hp）
    return sm;
}
function setupSummon(skId, sk, owner) {
    owner = owner || player;   // 🩸 v2.6.25 owner 參數化：owner=player（玩家）或 ally（傭兵）；召喚物存於 owner.summon
    if(!owner.buffs) owner.buffs = {};
    // 同時只能有一個召喚物：清除其他召喚 buff
    (owner.skills || []).forEach(s => { let d = DB.skills[s]; if(d && d.summon) owner.buffs[s] = 0; });
    if(skId !== 'sk_charm') owner.buffs[skId] = sk.dur || 3600;
    owner.summon = buildSummon(skId, sk.summon, sk.dur || 3600, owner);
    if(sk.eleFromPlayer) owner.summon.ele = owner.elfEle || 'none';
    if(owner === player) logCombat(`你召喚了 <span class="text-purple-300">${owner.summon.n}</span>。`, 'magic', 'summon');
}
function summonElementDamage(dice, ele, t, flatBonus, mult, mrPen) {
    let mrBase = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    mrBase = Math.max(0, mrBase - (mrPen || 0));
    let mrFactor = mrMult(mrBase);
    let base = (roll(dice[0], dice[1]) + (flatBonus || 0)) * (mult || 1);
    return Math.max(1, Math.floor(Math.max(1, Math.floor(base * mrFactor)) * fragileMult(t) * elementCounterMult(ele, t.e)));   // 🔮 魔法不受物理 DR；脆弱＋屬性剋制仍保留
}
// ===== Offline save-slot ally system removed (stubs for callers) =====
function allySlotList() { return []; }
const ALLY_ACTIVE_MAX = 0;
const ROYAL_ALLY_ACTIVE_MAX = 0;
function allyActiveCap() { return 0; }
function royalAllyMult() { return 1; }
function isAllyActive(slotN) { return false; }
function syncMercenaryEmploymentRegistry(force) { return true; }
function currentRoleMercenaryEmployer() { return null; }
function currentRoleIsMercenary() { return false; }
function mercRoleSafeAreaOnly() { return false; }
function mercEmployerOfSlot(slotN, who) { return null; }
function mercEmploymentMap() { return {}; }
function mercSlotHiredByOther(slotN, hiredMap) { return null; }
function mercClaimLosesTo(ally, rival) { return false; }
function mercenaryRoleNotifySafeAreaOnly() {}
function mercenaryRoleBattleBlocked(targetMap, notify) { return false; }
function enforceMercenarySafeArea() { return false; }
function allyName(a) { return (a && (a._allyName || a.name)) || '隊友'; }
function snapshotMercPrefs(ally) {}
function applyMercPrefs(ally) {}
function purgeReplacedAllies() { if (player) player.allies = []; }
function buildAlly(slotN) { return null; }
function alliesChangeAlignment(delta) {}
function _allyQuestLootKey(ally) { return ''; }
function _allyQuestLootBucket(ally) { return {}; }
function _allyQuestLootCount(ally, itemId) { return 0; }
function _queueAllyQuestItem(itemId, cnt, predicate) {}
function allyTrialItemActive(itemId) { return false; }
function allyQueueTrialQuestItem(itemId, cnt) {}
function allyStageQuestItemActive(itemId) { return false; }
function allyQueueStageQuestItem(itemId, cnt) {}
function allyUnbonusBonus(ally, t) { return 0; }
function allyQiguAttack(ally, t, wpn) { return false; }
function allyAttackOnce(ally, _arrowDelay) { return false; }
function allyComboAttack(ally, t, fullDmg) {}
function allyWarriorDualWieldWpnOk(ally, id) { return false; }
function allyDualWieldOffhandOk(ally) { return false; }
function allyOffhandInstakillProc(ally, inst, def, t) { return false; }
function allyOffhandDmgMods(ally, def, t, dmg) { return dmg; }
function allyOffhandAfterHit(ally, inst, def, t, dmg) {}
function allyDualWieldOffhandAttack(ally, t) {}
function allyCastMagic(ally, sk) { return false; }
function allyCastNonDamage(ally, sk) { return false; }
function allyCastPhysicalSkill(ally, sk) { return false; }
function allyMageAct(ally) { return false; }
function allyRapidfire(ally, forceProc, classicOk) { return false; }
function _allyProcTarget(target) { return null; }
function _allyDamageMob(ally, t, dmg, ele, terrorKind) {}
function _allyAtkBuffProcs(ally, dmg, isRanged) {}
function allyStrikeRoll(ally, t, opts) { return { hit: false, dmg: 0 }; }
function allyProcLightArrow(ally, t) {}
function allyWitchIceLance(ally) {}
function allyProcMoonburst(ally, t) {}
function _allyProcWeaponSpellHit(ally, t, sp, en, illusionRecoverMp) { return 0; }
function allyProcWeaponSpell(ally, t, sp, en) {}
function allyProcFreeMagicSkill(ally, t, skId, en, areaHit, sourceItem, illusionRecoverMp) {}
function allyLaiaWandHitProc(ally, t) {}
function allyDollAttackProcs(ally, target) {}
function allyAttrMagicProc(ally, target, inst, wpn) {}
function _allyMagicStrikeHit(ally, t, wpnInst, wpn) { return 0; }
function allySpecterProc(ally, target, wpnInst, wpn) {}
function allyWeaponProcs(ally, target, hitInfo, instOverride) {}
function allyOnHitEffects(ally, t, res) {}
function allyReflectOnHit(ally, mob, dmgTaken, isMagic) { return 0; }
function _allyStrikeWithIllu(ally, mob, opts) { return { hit: false, dmg: 0 }; }
function allyReactCounter(mob, blocked) {}
function allyReactIai(mob) {}
function allyTripleShot(ally) {}
function allyElfAct(ally) { return false; }
function allyDarkAct(ally) { return false; }
function allyKnightAct(ally) { return false; }
function allyWarriorAct(ally) { return false; }
function allyRoyalFreeCast(ally) { return false; }
function allyRoyalAct(ally) { return false; }
function allyDragonAct(ally) { return false; }
function allyIllusionAct(ally) { return false; }
function _allyWpnFullHpMpHalf(ally, cost) { return cost; }
function allyManaMasteryRefund(ally, spent) {}
function _allyIllusionMagicDmg(ally, dmg, recoverMp) { return dmg; }
function allyCubeTick(ally) {}
function allyStormTick(ally, sk, noMageBonus) {}
function allyCastCrush(ally, sk) { return false; }
function allyCastFixedStatus(ally, sk) { return false; }
function allyCastSlaughter(ally, sk) { return false; }
function allyCastMpDmg(ally, sk) { return false; }
function allyFlywingDouble(ally, t) {}
function allyDarkCrit(ally, t) {}
function processAllyStatusTick(ally) { return false; }
function allyAtkSkillInterval(ally, support, current) { return 0; }
function allyActWithSkillGate(ally, actFn) { return false; }
function allyCastConvert(ally, sk) { return false; }
function _mercAutoOn(ally, sid) { return false; }
function allySkillElementOk(ally, sid) { return true; }
function _mercPreferredHelmBuffCovers(ally, sid) { return false; }
function _applyMercCubeRes(ally) {}
function _isMercSelfBuff(sk, sid) { return false; }
function allyAutoCastableSkills(ally) { return []; }
function allyMaintainPoly(ally) { return false; }
function allyMaintainBuffs(ally) {}
function allyTryDispel(ally) { return false; }
function allyAttackIntervalTicks(ally, st) { return 999; }
function allyOffhandIntervalTicks(ally, st) { return 0; }
function alliesTick() { if (player && player.allies && player.allies.length) player.allies = []; }
function allyTryHeal(ally) { return false; }
function allyTryPotion(ally) { return false; }
function allyTryBluePotion(ally) { return false; }
function reviveMercenary(slotN, method) { return false; }
function tryAutoReviveMercScroll(ally) { return false; }
function _reviveAllyDone(ally, via) {}
function reviveDownedMercsAtTown() {}
function _allyLevelRecompute(ally) {}
function refreshAllyOnce(slotN) { return null; }
function refreshAllAllies() { if (player) player.allies = []; }
function mercLedgerPurgeSlot(slotN) {}
function mercExpClaimPending(_retry) {}
function toggleAlly(slotN) {}
function dismissAlly(slotN) { if (player) player.allies = []; }
function dismissAllAllies() { if (player) player.allies = []; }
const ALLY_EQUIP_SLOT_NAME = {};
function openAllyEquipmentManager(slotN) {}
function closeAllyEquipmentManager() {}
function allyEquipItem(slotN, encodedUid) {}
function allyUnequipItem(slotN, slot) {}
function renderAllyEquipmentManager(div, slotN) { if (div) div.innerHTML = ''; }
function openAllyQuestManager(slotN) {}
function closeAllyQuestManager() {}
function allyAcceptTrialQuest(slotN, key) {}
function allyAcceptTrial50(slotN) {}
function allyTurnInTrial50(slotN) {}
function allyCompleteTrialQuest(slotN, key) {}
function allyCompleteTrial50(slotN) {}
function allyRepeatTrial50(slotN) {}
function renderAllyQuestManager(div, slotN) { if (div) div.innerHTML = ''; }
function renderAllyNPC(div) {
    if (!div) return;
    if (player) player.allies = [];
    div.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-slate-400 py-12 gap-3"><span class="text-5xl">🚫</span><span class="text-xl font-bold text-amber-200">功能已移除</span><span class="text-sm text-center leading-relaxed max-w-md">離線存檔位協力招募已從遊戲中移除。請使用寵物、召喚、城堡護衛或即時組隊。</span></div>';
}
function enemyAttackAlly(mob, ally, fromPool) {}
function mercAggroWeight(c) { return 0; }

function teamRecoverMp(amount) {
    if (player) player.mp = Math.min(player.mmp || 0, (player.mp || 0) + amount);
    (player && player.allies || []).forEach(a => { if (a && !a._downed) a.mp = Math.min(a.mmp || 0, (a.mp || 0) + amount); });
    try { if (typeof petsOutList === 'function') petsOutList().forEach(p => { if (p && !p._downed && p.mmp != null) p.mp = Math.min(p.mmp || 0, (p.mp || 0) + amount); }); } catch (e) {}   // 🩹 v3.2.67 回魔也惠及出戰寵物（召喚物無 MP 池·略過）
}
// 🩹 v3.2.67 治癒/輔助受益者擴充（單一真相）：把「出戰未倒地寵物＋未倒地召喚物」也納入「玩家/傭兵以外可受益對象」。
//   欄位異質：玩家 hp/mhp·statuses；傭兵 curHp/mhp·statuses；寵物 hp/mhp·_statuses（有 outSlot/無 curHp/無 skId）；召喚物 hp/mhp（無 mp/無狀態·有 skId）。
//   下列統一存取器供 瞬間治癒(玩家 castSkillInner/傭兵 allyTryHeal)、團隊 HoT(js/03)、選人 共用；淨化/回魔各自於本檔擴充。
function healBeneficiaries() {   // 全部「能被治癒/HoT 惠及」的存活隊伍成員
    let arr = [];
    if (typeof player !== 'undefined' && player && !player.dead) arr.push(player);
    (typeof player !== 'undefined' && player && player.allies || []).forEach(a => { if (a && !a._downed && (a.curHp || 0) > 0) arr.push(a); });
    try { if (typeof petsOutList === 'function') petsOutList().forEach(p => { if (p && !p._downed && (p.hp || 0) > 0) arr.push(p); }); } catch (e) {}
    try { if (typeof summonV2List === 'function') summonV2List().forEach(s => { if (s && !s._noHeal && !s._downed && (s.hp || 0) > 0) arr.push(s); }); } catch (e) {}
    try { if (typeof mercSummonList === 'function') mercSummonList().forEach(s => { if (s && !s._downed && (s.hp || 0) > 0) arr.push(s); }); } catch (e) {}   // 🩹 v3.4.71 傭兵召喚物（v3.4.50 起有血）也納入治癒受益池·欄位 hp/mhp 與玩家召喚物一致走 _sup* else 分支
    try { if (typeof guardAliveList === 'function') guardAliveList().forEach(g => { if (g && !g._downed && (g.hp || 0) > 0) arr.push(g); }); } catch (e) {}   // 🛡️ v3.8.4 城堡護衛納入治癒/HoT 受益池（欄位 hp/mhp·無 curHp/skId → 走 _sup* else 分支；無狀態無 MP 故不進淨化/回魔，同召喚物）
    return arr;
}
function _supHp(m) { return (m === player) ? (m.hp || 0) : (m && m.curHp != null ? (m.curHp || 0) : (m ? (m.hp || 0) : 0)); }   // 傭兵=curHp·其餘=hp
function _supMhp(m) { if (m && m !== player && m.curHp == null && m.form && typeof PET_BOOK !== 'undefined' && PET_BOOK[m.form] && typeof petMhpEff === 'function') return petMhpEff(m); return (m && m.mhp) || 1; }   // 🏺 v3.7.20 寵物治癒上限含 petHpAll 光環（蜥蜴領主的王冠 +100）
function _supHeal(m, amt) { let mx = _supMhp(m), v = Math.min(mx, _supHp(m) + amt); if (m === player) m.hp = v; else if (m.curHp != null) m.curHp = v; else m.hp = v; }
function _supName(m) { if (m === player) return (player && player.name) || '你'; if (m && m.curHp != null) return (m._allyName || '隊友'); if (m && m.skId) return '召喚·' + (m.form || '召喚物'); if (m && m.city != null) return '護衛·' + (m.form || '城堡護衛'); return '寵物·' + ((m && m.form) || '夥伴'); }   // 🛡️ v3.8.4 護衛以 city 欄位辨識（寵物/召喚物皆無此欄）·否則會被誤標成「寵物·」
function _supStatuses(m) { return (m && m.statuses) ? m.statuses : ((m && m._statuses) ? m._statuses : null); }   // 玩家/傭兵=statuses·寵物=_statuses
// 🍶🛡️ v2.6.4：把「喝藥水門檻」與「停耗HP技門檻」拆成兩個獨立設定；皆回退舊 _hpSafePct(相容既有存檔)、再回退 0。
function _shareBuffLegalForTarget(t, sk) {
    let w = (t.eq && t.eq.wpn) ? DB.items[t.eq.wpn.id] : null;
    if (sk.reqWpn === 'w2h' && (!w || !w.w2h)) return false;
    if (sk.reqWpnMelee && (!w || w.isBow || w.ranged)) return false;
    if (sk.reqWpnBlunt && (!t.eq || !t.eq.wpn || !(getWeaponTags(t.eq.wpn.id).includes('單手鈍器') || getWeaponTags(t.eq.wpn.id).includes('雙手鈍器')))) return false;
    if (sk.reqShield && !(t.eq && t.eq.shield) && !(t.eq && t.eq.wpn && getWeaponTags(t.eq.wpn.id).includes('武士刀'))) return false;
    return true;
}
// 🎩 v3.4.48 力盔/敏盔版＝同效果（用戶指定）：目標身上有頭盔版 buff→「判定已有該 buff」不分享法術版。
//   通暢氣脈術↔敏盔1(js/02:59 recompute 會歸零·此閘兼防 MP 流失迴圈)、體魄強健術↔力盔3(recompute 無歸零對→原本會 +5 疊 +5)、加速術↔敏盔2(haste:true 設 buffs.haste·上方加速閘其實已涵蓋·此為顯式保險)。
//   擬似魔法武器↔力盔1／無所遁形↔力盔2 不在 TEAM_SHARE_BUFFS 免列。
//   🤝 v3.5.87 值改陣列（任一持有＝視為已有）：加速術↔強力加速術互為等效（有其一就不補另一個·兩者皆與敏盔2等效），避免玩家/隊友同時被補兩種加速。
const _SHARE_HELM_EQUIV = { sk_dex_up: ['sk_helm_dex1'], sk_str_up: ['sk_helm_str3'], sk_haste_spell: ['sk_helm_dex2', 'sk_greater_haste'], sk_greater_haste: ['sk_helm_dex2', 'sk_haste_spell'] };
function shareTeamBuffs(caster) {
    if (typeof TEAM_SHARE_BUFFS === 'undefined' || !caster || !caster.skills || !caster.buffs) return;
    if (typeof mapState !== 'undefined' && mapState.current && mapState.current.startsWith('town_')) return;   // 安全區不施放
    let cst = caster.statuses || {};
    if (cst.silence > 0 || cst.magicseal > 0 || cst.stun > 0 || cst.freeze > 0 || cst.stone > 0 || cst.paralyze > 0 || cst.sleep > 0) return;   // 施法者硬控/沉默→不施放
    let team = [];
    if (typeof player !== 'undefined' && player && !player.dead) team.push(player);
    if (typeof player !== 'undefined' && player && player.allies) player.allies.forEach(a => { if (a && !a._downed) team.push(a); });
    for (let j = 0; j < team.length; j++) {
        let t = team[j];
        if (t === caster) continue;
        if (!t.buffs) t.buffs = {};
        let applied = false;
        for (let i = 0; i < caster.skills.length; i++) {
            let sid = caster.skills[i];
            if (!TEAM_SHARE_BUFFS.has(sid)) continue;
            let sk = DB.skills[sid]; if (!sk || sk.type !== 'buff') continue;
            if ((caster.buffs[sid] || 0) <= 0) continue;                 // 施法者自己要有此 buff 才分享
            if ((t.buffs[sid] || 0) > 0) continue;                       // 目標已有此 buff→跳過
            if (sk.haste && ((t.buffs.haste || 0) > 0 || t._equipHaste || t._mercPermanentPotions)) continue;   // 目標已有加速來源→跳過（🤝 v3.5.87 含傭兵常駐職業藥水加速 _mercPermanentPotions：對其分享加速術/強力加速術＝白耗施法者 MP·視為「不缺」）
            { let _helmEq = _SHARE_HELM_EQUIV[sid]; if (_helmEq && _helmEq.some(b => (t.buffs[b] || 0) > 0)) continue; }   // 🎩 v3.4.48 目標有力盔/敏盔版＝判定已有該 buff 不分享（通暢氣脈/體魄強健/加速三組·dex_up 兼防 js/02:59 歸零→MP 流失迴圈）；v3.5.87 陣列版＝任一等效 buff 在身即跳過（含兩種加速互斥）
            if (!_shareBuffLegalForTarget(t, sk)) continue;
            let cost = (caster.d && typeof caster.d.getMpCost === 'function') ? caster.d.getMpCost(sk.mp, sk.tier) : (sk.mp || 0);
            if ((caster.mp || 0) < cost) break;                          // MP 不夠→這位施法者本次停止分享
            caster.mp -= cost;
            if (caster !== player && typeof allyManaMasteryRefund === 'function') allyManaMasteryRefund(caster, cost);   // 傭兵魔導精通退魔（玩家 getMpCost 已含折扣）
            t.buffs[sid] = sk.dur;
            if (sk.haste) t.buffs.haste = Math.max(t.buffs.haste || 0, sk.dur);
            applied = true;
        }
        if (applied) { if (t === player) { try { if (typeof calcStats === 'function') calcStats(); } catch (e) {} } else { try { if (typeof _allyLevelRecompute === 'function') _allyLevelRecompute(t); } catch (e) {} } }
    }
}
// 🆕 v2.6.28 淨化共用（魔法相消術/聖潔之光/解毒術·玩家與傭兵共用）：施法者(自己)受硬控(石化/冰凍/暈眩/麻痺/沉睡)或沉默/魔封→無法施放；否則幫隊員解可解狀態。
//    v2.6.29 改「一次只解一人·優先主要玩家」：teamCleanseOne 依 _dispelTeamMembers 順序(玩家排首→傭兵)找第一個有可解狀態者，只清除該一人的該類狀態並回傳被解者。
function _dispelTeamMembers() { let arr = []; if (typeof player !== 'undefined' && player) { arr.push(player); (player.allies || []).forEach(a => { if (a && !a._downed) arr.push(a); }); } try { if (typeof petsOutList === 'function') petsOutList().forEach(p => { if (p && !p._downed) arr.push(p); }); } catch (e) {} return arr; }   // 🩹 v3.2.67 淨化也惠及出戰寵物（讀 _statuses·召喚物無狀態→不列入）
function teamHasCurableStatus(kinds) { return _dispelTeamMembers().some(m => { let st = _supStatuses(m); return st && kinds.some(k => (st[k] || 0) > 0); }); }
function teamCleanseOne(kinds) { let members = _dispelTeamMembers(); for (let i = 0; i < members.length; i++) { let m = members[i]; let st = _supStatuses(m); if (st && kinds.some(k => (st[k] || 0) > 0)) { kinds.forEach(k => { if (st[k]) st[k] = 0; }); return m; } } return null; }   // 一次只解一人·優先主要玩家（player 已排首）·回傳被解者供 log
function _dispelTargetName(m) { if (typeof player !== 'undefined' && m === player) return '自己'; if (m && m.curHp != null) return (m._allyName || '隊友'); if (m && m.form) return '寵物·' + m.form; return '隊友'; }
function dispelCasterBlocked(st) { return !!(st && (st.stun > 0 || st.freeze > 0 || st.stone > 0 || st.paralyze > 0 || st.sleep > 0 || st.silence > 0 || st.magicseal > 0)); }
function hasSummonCtrlRing(owner) {
    owner = owner || player;   // 🩸 v2.6.25 owner 參數化：讀 owner.eq（傭兵召喚控制戒指亦生效）
    let eq = owner.eq || {};
    let r1 = eq.ring1, r2 = eq.ring2, r3 = eq.ring3, r4 = eq.ring4;
    if ((r1 && r1.id === 'acc_summon_ctrl') || (r2 && r2.id === 'acc_summon_ctrl') || (r3 && r3.id === 'acc_summon_ctrl') || (r4 && r4.id === 'acc_summon_ctrl')) return true;
    if (eq.shin && DB.items[eq.shin.id] && DB.items[eq.shin.id].summonCtrl) return true;   // 🏺 遺物 召喚儀式的魔術布（脛甲）：等同召喚控制戒指
    return false;
}
// 🏺 遺物 巨靈的承諾（耳環）：裝備於耳飾欄時，傭兵/寵物死亡立即自動使用復活卷軸（跳過復活冷卻·仍消耗卷軸）。純看玩家裝備。
function playerHasAutoReviveEarring() {
    let eq = (player && player.eq) || {};
    let e1 = eq.ear1, e2 = eq.ear2;
    return !!((e1 && DB.items[e1.id] && DB.items[e1.id].autoReviveScroll) || (e2 && DB.items[e2.id] && DB.items[e2.id].autoReviveScroll));
}

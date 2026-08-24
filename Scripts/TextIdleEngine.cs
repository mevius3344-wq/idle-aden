using System;
using System.Text;
using UnityEngine;

/// <summary>
/// 文字掛機戰鬥所屬門派職業（與傳送門派對應：武當 ≈ 太極門）。
/// </summary>
public enum IdleFaction
{
    ShaoLin = 0,
    TangMen = 1,
    WuDang = 2,
    XueDao = 3,
}

/// <summary>
/// 文字掛機日誌一筆（方便未來綁 ScrollView）。
/// </summary>
public readonly struct IdleLogEntry
{
    public readonly string PlainText;
    public readonly string RichText;
    public readonly Color Color;
    public readonly IdleFaction Faction;

    public IdleLogEntry(string plainText, string richText, Color color, IdleFaction faction)
    {
        PlainText = plainText;
        RichText = richText;
        Color = color;
        Faction = faction;
    }
}

/// <summary>
/// 結合暴走門派職業的「文字刷怪掛機日誌引擎」。
/// 掛在玩家或戰鬥管理器上；進入 TextIdle 模式後每 1.5 秒打一回合，結果用彩色 Debug.Log 輸出。
/// </summary>
[DisallowMultipleComponent]
public class TextIdleEngine : MonoBehaviour
{
    const float DefaultTickInterval = 1.5f;

    [Header("模式")]
    [SerializeField] bool textIdleCombatActive;
    [SerializeField] IdleFaction faction = IdleFaction.ShaoLin;
    [SerializeField] float tickInterval = DefaultTickInterval;

    [Header("角色屬性（簡易 stub，之後可接正式角色卡）")]
    [SerializeField] int strength = 12;   // 臂力 → 偏物理傷害
    [SerializeField] int insight = 10;    // 悟性 → 偏技巧／內勁傷害
    [SerializeField] int baseDamage = 8;

    [Header("收益")]
    [SerializeField] int potentialMin = 1;
    [SerializeField] int potentialMax = 4;
    [SerializeField] int goldMin = 3;
    [SerializeField] int goldMax = 12;

    [Header("目前文字怪")]
    [SerializeField] string monsterName = "野豬";
    [SerializeField] int monsterMaxHp = 40;
    [SerializeField] int monsterHp = 40;

    static readonly string[] MonsterPool = { "野豬", "枯骨兵", "史萊姆", "山賊學徒", "暴走小雞" };

    // —— 門派文本庫（各 4~5 句）——
    static readonly string[] ShaoLinLines =
    {
        "你敲了一下木魚，木魚回敲你的額頭，順便把野怪敲進西天預備班。",
        "金剛掌拍出金光：『罪過罪過——先罪過你的血量！』",
        "少林羅漢陣啟動，你邊念經邊輸出，野怪懷疑自己撞進廟會。",
        "你使出韋陀杵，野怪被杵成扁平紀念幣，還帶開光特效。",
        "師父傳音：『定力不足也能刷怪，這就是現代少林。』一掌拍出暴擊！",
    };

    static readonly string[] TangMenLines =
    {
        "袖中飛刀三連發，野怪身上多了三個『唐門品質認證』孔。",
        "你疊了三層毒，野怪血條開始像進度條一樣誠懇下降。",
        "暗器雨落下，野怪大喊：『這是天氣警報還是唐門訂閱制？』",
        "你拋出煙霧彈，自己都差點中毒，好在野怪中得更徹底。",
        "唐門心法發動：『不見面也能砍人。』飛刀遠距簽收成功。",
    };

    static readonly string[] WuDangLines =
    {
        "太極陣緩緩旋轉，野怪的衝撞擊中自己，達成哲學性暴擊。",
        "你借力打力，野怪越用力，自己飛得越遠，像被退貨。",
        "雲手一圈，野怪的攻擊被導向旁邊的石頭，石頭表示無辜。",
        "武當輕功墊步，你飄過野怪頭頂，順便用腳跟蓋了個章。",
        "柔勁卸力成功：野怪愣在原地，懷疑人生與牛頓定律。",
    };

    static readonly string[] XueDaoLines =
    {
        "殘血覺醒！你血越少刀越紅，野怪先被氣勢嚇掉一半血。",
        "血刀一揮，野怪以為在拍恐怖片，嚇到主動交出弱點。",
        "你低語：『血刀門歡迎體驗服。』野怪體驗後立刻想退訂。",
        "暴走斬命中，野怪哭著說只是出來曬太陽的。",
        "你把刀擦得反光，野怪被自己的倒影嚇哭，傷害照算。",
    };

    float _timer;
    int _lastLineIndex = -1;
    readonly StringBuilder _uiBuffer = new StringBuilder(256);

    /// <summary>每寫入一筆日誌時觸發，可接 ScrollView / Text 元件。</summary>
    public event Action<IdleLogEntry> OnLogEmitted;

    public bool IsTextIdleActive => textIdleCombatActive;
    public IdleFaction Faction => faction;
    public string MonsterName => monsterName;
    public int MonsterHp => monsterHp;
    public int MonsterMaxHp => monsterMaxHp;
    public int Strength { get => strength; set => strength = Mathf.Max(0, value); }
    public int Insight { get => insight; set => insight = Mathf.Max(0, value); }

    void OnEnable()
    {
        if (monsterHp <= 0 || string.IsNullOrEmpty(monsterName))
            SpawnNextMonster();
    }

    void Update()
    {
        if (!textIdleCombatActive)
            return;

        _timer += Time.deltaTime;
        if (_timer < Mathf.Max(0.1f, tickInterval))
            return;

        _timer = 0f;
        ExecuteTextRound();
    }

    /// <summary>進入／離開文字掛機戰鬥模式。</summary>
    public void SetTextIdleMode(bool active)
    {
        textIdleCombatActive = active;
        _timer = 0f;
        Emit(
            active
                ? $"【文字掛機】模式開啟！門派：{FactionDisplayName(faction)}，目標：{monsterName}（HP {monsterHp}/{monsterMaxHp}）"
                : "【文字掛機】模式關閉。野怪表示終於可以喘口氣。",
            faction
        );
    }

    public void SetFaction(IdleFaction next)
    {
        faction = next;
        Emit($"【轉職口氣】你把掛機腳本切到「{FactionDisplayName(faction)}」風格輸出。", faction);
    }

    /// <summary>手動打一回合（測試用）。</summary>
    public void ExecuteTextRound()
    {
        if (monsterHp <= 0)
            SpawnNextMonster();

        string line = PickFactionLine(faction);
        int damage = CalcDamage(faction);
        monsterHp = Mathf.Max(0, monsterHp - damage);

        string battle =
            $"{line}  → 對【{monsterName}】造成 <b>{damage}</b> 傷害（剩 {monsterHp}/{monsterMaxHp}）";
        Emit(battle, faction);

        if (monsterHp > 0)
            return;

        int pot = UnityEngine.Random.Range(potentialMin, potentialMax + 1);
        int gold = UnityEngine.Random.Range(goldMin, goldMax + 1);
        Emit($"怪物死亡！獲得門派潛能 +{pot} 與金幣 +{gold}！", faction);
        SpawnNextMonster();
        Emit($"下一隻文字怪出現：【{monsterName}】HP {monsterHp}/{monsterMaxHp}", faction);
    }

    int CalcDamage(IdleFaction f)
    {
        // 臂力偏少林／血刀；悟性偏唐門／武當；再加一點亂數手感。
        float strWeight;
        float insightWeight;
        switch (f)
        {
            case IdleFaction.ShaoLin:
                strWeight = 1.1f;
                insightWeight = 0.35f;
                break;
            case IdleFaction.TangMen:
                strWeight = 0.45f;
                insightWeight = 1.15f;
                break;
            case IdleFaction.WuDang:
                strWeight = 0.55f;
                insightWeight = 1.05f;
                break;
            case IdleFaction.XueDao:
                strWeight = 1.2f;
                insightWeight = 0.4f;
                break;
            default:
                strWeight = 0.8f;
                insightWeight = 0.8f;
                break;
        }

        float raw = baseDamage
            + strength * strWeight
            + insight * insightWeight
            + UnityEngine.Random.Range(0f, 4f);

        // 血刀殘血風：怪物血越低，你輸出略高（惡搞版「殘血爆發」）
        if (f == IdleFaction.XueDao && monsterMaxHp > 0)
        {
            float missing = 1f - (monsterHp / (float)monsterMaxHp);
            raw *= 1f + missing * 0.35f;
        }

        return Mathf.Max(1, Mathf.RoundToInt(raw));
    }

    void SpawnNextMonster()
    {
        string next;
        do
        {
            next = MonsterPool[UnityEngine.Random.Range(0, MonsterPool.Length)];
        } while (MonsterPool.Length > 1 && next == monsterName);

        monsterName = next;
        monsterMaxHp = UnityEngine.Random.Range(28, 56) + strength / 2;
        monsterHp = monsterMaxHp;
    }

    string PickFactionLine(IdleFaction f)
    {
        string[] pool = GetLines(f);
        int index;
        do
        {
            index = UnityEngine.Random.Range(0, pool.Length);
        } while (pool.Length > 1 && index == _lastLineIndex);

        _lastLineIndex = index;
        return pool[index];
    }

    static string[] GetLines(IdleFaction f)
    {
        switch (f)
        {
            case IdleFaction.TangMen: return TangMenLines;
            case IdleFaction.WuDang: return WuDangLines;
            case IdleFaction.XueDao: return XueDaoLines;
            default: return ShaoLinLines;
        }
    }

    static Color FactionColor(IdleFaction f)
    {
        switch (f)
        {
            case IdleFaction.ShaoLin: return new Color(1f, 0.92f, 0.2f);      // 黃
            case IdleFaction.TangMen: return new Color(0.35f, 0.95f, 0.45f);   // 綠
            case IdleFaction.WuDang: return new Color(0.45f, 0.75f, 1f);       // 藍
            case IdleFaction.XueDao: return new Color(1f, 0.35f, 0.35f);       // 紅
            default: return Color.white;
        }
    }

    static string FactionDisplayName(IdleFaction f)
    {
        switch (f)
        {
            case IdleFaction.ShaoLin: return "少林";
            case IdleFaction.TangMen: return "唐門";
            case IdleFaction.WuDang: return "武當";
            case IdleFaction.XueDao: return "血刀";
            default: return f.ToString();
        }
    }

    void Emit(string plain, IdleFaction f)
    {
        Color c = FactionColor(f);
        string hex = ColorUtility.ToHtmlStringRGB(c);
        // 整行包色，方便直接丟給 ScrollView Text（與 UI 範例同格式）。
        string rich = $"<color=#{hex}>【{FactionDisplayName(f)}】{plain}</color>";

        Debug.Log(rich);

        // 核心黏合點：丟給文字掛機 UI。
        if (TextIdleUIController.Instance != null)
            TextIdleUIController.Instance.AddLogMessage(rich);

        var entry = new IdleLogEntry(plain, rich, c, f);
        OnLogEmitted?.Invoke(entry);

        _uiBuffer.AppendLine(rich);
        if (_uiBuffer.Length > 4000)
            _uiBuffer.Remove(0, _uiBuffer.Length - 3000);
    }

    /// <summary>取得累積富文字日誌（給 ScrollView 初次綁定）。</summary>
    public string GetAccumulatedRichLog() => _uiBuffer.ToString();

#if UNITY_EDITOR
    [ContextMenu("Debug/Start Text Idle")]
    void ContextStart() => SetTextIdleMode(true);

    [ContextMenu("Debug/Stop Text Idle")]
    void ContextStop() => SetTextIdleMode(false);

    [ContextMenu("Debug/Force One Round")]
    void ContextRound() => ExecuteTextRound();
#endif
}

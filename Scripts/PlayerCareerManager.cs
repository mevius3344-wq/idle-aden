using System;
using UnityEngine;

/// <summary>
/// 玩家門派職業。Beginner = 江湖小蝦米。
/// </summary>
public enum CareerFaction
{
    Beginner = 0,
    ShaoLin = 1,
    TaiJi = 2,
    TangMen = 3,
    XueDao = 4,
}

/// <summary>
/// 玩家生涯／屬性管理：門派、臂力、悟性、根骨、身法。
/// 掛在玩家物件上，供掌門拜師與文字掛機讀取。
/// </summary>
[DisallowMultipleComponent]
public class PlayerCareerManager : MonoBehaviour
{
    [Header("門派")]
    [SerializeField] CareerFaction currentFaction = CareerFaction.Beginner;

    [Header("基礎屬性")]
    [SerializeField] int strength = 10;  // 臂力
    [SerializeField] int insight = 10;   // 悟性
    [SerializeField] int bone = 10;      // 根骨
    [SerializeField] int agility = 10;   // 身法

    [Header("連動")]
    [SerializeField] TextIdleEngine textIdleEngine;

    public CareerFaction CurrentFaction => currentFaction;
    public bool IsBeginner => currentFaction == CareerFaction.Beginner;

    public int Strength => strength;
    public int Insight => insight;
    public int Bone => bone;
    public int Agility => agility;

    public event Action<CareerFaction> OnFactionChanged;

    void Awake()
    {
        if (textIdleEngine == null)
            textIdleEngine = GetComponent<TextIdleEngine>() ?? GetComponentInChildren<TextIdleEngine>();
    }

    public static string FactionDisplayName(CareerFaction f)
    {
        switch (f)
        {
            case CareerFaction.Beginner: return "江湖小蝦米";
            case CareerFaction.ShaoLin: return "少林";
            case CareerFaction.TaiJi: return "太極門";
            case CareerFaction.TangMen: return "唐門";
            case CareerFaction.XueDao: return "血刀門";
            default: return f.ToString();
        }
    }

    /// <summary>CareerFaction → 文字掛機 IdleFaction（太極對應武當文風）。</summary>
    public static IdleFaction ToIdleFaction(CareerFaction f)
    {
        switch (f)
        {
            case CareerFaction.TangMen: return IdleFaction.TangMen;
            case CareerFaction.TaiJi: return IdleFaction.WuDang;
            case CareerFaction.XueDao: return IdleFaction.XueDao;
            case CareerFaction.ShaoLin: return IdleFaction.ShaoLin;
            default: return IdleFaction.ShaoLin;
        }
    }

    /// <summary>
    /// 拜師轉職成功：改門派、套用永久屬性、同步 TextIdleEngine。
    /// </summary>
    public bool JoinFaction(CareerFaction next)
    {
        if (next == CareerFaction.Beginner)
            return false;

        if (!IsBeginner)
            return false;

        ApplyJoinBonuses(next);
        currentFaction = next;
        SyncTextIdleEngine();
        OnFactionChanged?.Invoke(currentFaction);
        return true;
    }

    void ApplyJoinBonuses(CareerFaction next)
    {
        switch (next)
        {
            case CareerFaction.ShaoLin:
                strength += 20;
                bone += 10;
                break;
            case CareerFaction.TaiJi:
                insight += 20;
                strength += 10;
                break;
            case CareerFaction.TangMen:
                agility += 30;
                break;
            case CareerFaction.XueDao:
                strength += 30;
                break;
        }
    }

    /// <summary>核心連動：轉職後立刻切換文字掛機門派台詞與屬性 stub。</summary>
    public void SyncTextIdleEngine()
    {
        if (textIdleEngine == null)
            textIdleEngine = GetComponent<TextIdleEngine>() ?? GetComponentInChildren<TextIdleEngine>();

        if (textIdleEngine == null)
            return;

        if (currentFaction != CareerFaction.Beginner)
            textIdleEngine.SetFaction(ToIdleFaction(currentFaction));

        textIdleEngine.Strength = strength;
        textIdleEngine.Insight = insight;
    }

#if UNITY_EDITOR
    [ContextMenu("Debug/Reset To Beginner (no refund)")]
    void DebugResetBeginner()
    {
        currentFaction = CareerFaction.Beginner;
        SyncTextIdleEngine();
    }
#endif
}

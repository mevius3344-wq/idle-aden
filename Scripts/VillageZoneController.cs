using System.Collections;
using UnityEngine;

/// <summary>
/// 全域地圖狀態。村莊內強制鎖定為 <see cref="SafeZone"/>。
/// </summary>
public enum WorldZoneState
{
    Combat = 0,
    SafeZone = 1,
}

/// <summary>
/// 簡易全域狀態。任何戰鬥系統請先讀 <see cref="Current"/> 再決定是否允許攻擊。
/// </summary>
public static class GameWorldState
{
    public static WorldZoneState Current { get; private set; } = WorldZoneState.Combat;

    public static bool IsSafeZone => Current == WorldZoneState.SafeZone;

    public static void Set(WorldZoneState state)
    {
        Current = state;
    }
}

/// <summary>
/// 玩家血量／內力。掛在玩家物件上即可被村莊控制器補滿。
/// </summary>
public class PlayerVitals : MonoBehaviour
{
    [SerializeField] int maxHp = 100;
    [SerializeField] int maxMp = 50;
    [SerializeField] int hp = 100;
    [SerializeField] int mp = 50;

    public int MaxHp => maxHp;
    public int MaxMp => maxMp;
    public int Hp => hp;
    public int Mp => mp;

    public void Restore(int hpAmount, int mpAmount)
    {
        hp = Mathf.Min(maxHp, hp + Mathf.Max(0, hpAmount));
        mp = Mathf.Min(maxMp, mp + Mathf.Max(0, mpAmount));
    }
}

/// <summary>
/// 實體 2D 像素村莊（安全區）核心控制：鎖定全域狀態、攔截 J/K 攻擊、就地打坐續航。
/// 掛在村莊 Trigger Collider 2D（Is Trigger）上，玩家需有 Collider 2D。
/// </summary>
[DisallowMultipleComponent]
[RequireComponent(typeof(Collider2D))]
public class VillageZoneController : MonoBehaviour
{
    const KeyCode NormalAttackKey = KeyCode.J;
    const KeyCode UltimateKey = KeyCode.K;
    const float RegenInterval = 1f;
    const int RegenHp = 5;
    const int RegenMp = 2;

    static readonly string[] BanterLines =
    {
        "村長大喊：『平安鎮禁止械鬥！違者罰掃大街三天！』",
        "雜貨店大娘抄起掃帚：『想開刀？先幫我把米袋搬完再說！』",
        "巡邏兵一臉無奈：『這裡是安全區啦，刀收一收，去茶館坐坐。』",
        "路邊小孩起哄：『英雄桑，這裡不能暴走喔～會被扣聲望的！』",
        "公告欄發出金光：『《暴走英雄譚》第零條：村莊內揮刀者，今日便當自理。』",
        "土地公從神龕探頭：『年輕人，內力留給副本，別嚇到小雞。』",
        "鐵匠把你的刀按回去：『回火還沒好，現在砍人刀會彎。』",
        "村長秘書蓋章：『攻擊申請駁回。理由：和平。』",
    };

    [Header("玩家")]
    [SerializeField] Transform player;
    [SerializeField] PlayerVitals vitals;
    [SerializeField] string playerTag = "Player";

    [Header("打坐提示")]
    [SerializeField] Vector3 overheadOffset = new Vector3(0f, 1.2f, 0f);
    [SerializeField] Color hintColor = new Color(0.45f, 0.95f, 0.55f, 1f);

    [Header("行為")]
    [Tooltip("未使用 Trigger 進出時，只要本腳本啟用就視為人在村內。")]
    [SerializeField] bool lockEntireScene = true;

    bool playerInside;
    Coroutine regenRoutine;
    TextMesh overheadHint;
    int lastBanterIndex = -1;

    public bool IsPlayerInVillage => lockEntireScene || playerInside;

    void Reset()
    {
        var col = GetComponent<Collider2D>();
        if (col != null)
            col.isTrigger = true;
    }

    void Awake()
    {
        ResolvePlayer();
        EnsureOverheadHint();
    }

    void OnEnable()
    {
        if (lockEntireScene)
            EnterSafeZone();
    }

    void OnDisable()
    {
        LeaveSafeZone();
    }

    void Update()
    {
        if (!IsPlayerInVillage)
            return;

        GameWorldState.Set(WorldZoneState.SafeZone);
        InterceptCombatInput();
        FollowOverheadHint();
    }

    void OnTriggerEnter2D(Collider2D other)
    {
        if (!IsPlayerCollider(other))
            return;

        playerInside = true;
        if (player == null)
            player = other.transform;
        if (vitals == null)
            vitals = other.GetComponent<PlayerVitals>() ?? other.GetComponentInParent<PlayerVitals>();

        EnterSafeZone();
    }

    void OnTriggerStay2D(Collider2D other)
    {
        if (!IsPlayerCollider(other))
            return;

        playerInside = true;
        GameWorldState.Set(WorldZoneState.SafeZone);
    }

    void OnTriggerExit2D(Collider2D other)
    {
        if (!IsPlayerCollider(other))
            return;

        playerInside = false;
        if (!lockEntireScene)
            LeaveSafeZone();
    }

    void EnterSafeZone()
    {
        GameWorldState.Set(WorldZoneState.SafeZone);
        if (regenRoutine == null)
            regenRoutine = StartCoroutine(MeditateRegenLoop());
        SetHintVisible(true);
    }

    void LeaveSafeZone()
    {
        if (regenRoutine != null)
        {
            StopCoroutine(regenRoutine);
            regenRoutine = null;
        }

        SetHintVisible(false);

        if (GameWorldState.IsSafeZone)
            GameWorldState.Set(WorldZoneState.Combat);
    }

    void InterceptCombatInput()
    {
        bool pressedAttack = Input.GetKeyDown(NormalAttackKey);
        bool pressedUlt = Input.GetKeyDown(UltimateKey);
        if (!pressedAttack && !pressedUlt)
            return;

        // 完全禁止揮刀：不轉發任何攻擊事件。
        Debug.Log(PickBanter(pressedUlt));
    }

    string PickBanter(bool isUltimate)
    {
        int index;
        do
        {
            index = Random.Range(0, BanterLines.Length);
        } while (BanterLines.Length > 1 && index == lastBanterIndex);

        lastBanterIndex = index;
        string prefix = isUltimate ? "【暴走絕招被攔截】" : "【普攻被攔截】";
        return prefix + " " + BanterLines[index];
    }

    IEnumerator MeditateRegenLoop()
    {
        var wait = new WaitForSeconds(RegenInterval);
        while (enabled)
        {
            yield return wait;
            if (!IsPlayerInVillage)
                continue;

            ResolvePlayer();
            if (vitals == null)
                continue;

            vitals.Restore(RegenHp, RegenMp);
            UpdateHintText();
        }
    }

    void ResolvePlayer()
    {
        if (player == null)
        {
            var tagged = GameObject.FindGameObjectWithTag(playerTag);
            if (tagged != null)
                player = tagged.transform;
        }

        if (vitals == null && player != null)
            vitals = player.GetComponent<PlayerVitals>() ?? player.GetComponentInParent<PlayerVitals>();
    }

    bool IsPlayerCollider(Collider2D other)
    {
        if (other == null)
            return false;
        if (!string.IsNullOrEmpty(playerTag) && other.CompareTag(playerTag))
            return true;
        return player != null && (other.transform == player || other.transform.IsChildOf(player));
    }

    void EnsureOverheadHint()
    {
        if (overheadHint != null)
            return;

        var go = new GameObject("VillageRegenHint");
        go.transform.SetParent(transform, false);
        overheadHint = go.AddComponent<TextMesh>();
        overheadHint.alignment = TextAlignment.Center;
        overheadHint.anchor = TextAnchor.LowerCenter;
        overheadHint.characterSize = 0.08f;
        overheadHint.fontSize = 48;
        overheadHint.color = hintColor;
        overheadHint.text = "打坐續航中 +HP/MP";
        go.SetActive(false);
    }

    void FollowOverheadHint()
    {
        if (overheadHint == null || player == null)
            return;

        overheadHint.transform.position = player.position + overheadOffset;
        var cam = Camera.main;
        if (cam != null)
        {
            Vector3 dir = overheadHint.transform.position - cam.transform.position;
            dir.z = 0f;
            if (dir.sqrMagnitude > 0.0001f)
                overheadHint.transform.up = Vector3.up;
        }
    }

    void SetHintVisible(bool visible)
    {
        if (overheadHint == null)
            return;
        overheadHint.gameObject.SetActive(visible);
        if (visible)
            UpdateHintText();
    }

    void UpdateHintText()
    {
        if (overheadHint == null)
            return;

        if (vitals != null)
            overheadHint.text = $"打坐續航中  HP {vitals.Hp}/{vitals.MaxHp}  內力 {vitals.Mp}/{vitals.MaxMp}";
        else
            overheadHint.text = "打坐續航中 +HP5 / +MP2";
    }
}

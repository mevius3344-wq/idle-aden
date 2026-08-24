using UnityEngine;

/// <summary>
/// 《暴走英雄譚》四大門派掌門人：拜師轉職 NPC。
/// 掛在掌門人物件上（建議加 Trigger Collider2D 方便靠近互動）。
/// </summary>
[DisallowMultipleComponent]
public class FactionNPCController : MonoBehaviour
{
    const KeyCode InteractKey = KeyCode.E;

    [Header("掌門設定")]
    [SerializeField] CareerFaction faction = CareerFaction.ShaoLin;
    [SerializeField] string masterName = "空聞方丈";
    [TextArea(2, 4)]
    [SerializeField] string joinSuccessBanter =
        "空聞方丈敲木魚：『善哉！從今天起你就是少林編外弟子，木魚自己買。』";

    [Header("互動")]
    [SerializeField] string playerTag = "Player";
    [SerializeField] bool requireProximity = true;
    [SerializeField] float talkRange = 2.2f;
    [SerializeField] bool enableHotkey = true;

    bool playerInRange;
    Transform cachedPlayer;

    void Reset()
    {
        ApplyDefaultMasterPreset(faction);
        var col = GetComponent<Collider2D>();
        if (col != null)
            col.isTrigger = true;
    }

    void OnValidate()
    {
        // 切換門派枚舉時，若仍是預設名則套用對應掌門預設（不強制覆寫自訂名稱）。
        if (string.IsNullOrWhiteSpace(masterName))
            ApplyDefaultMasterPreset(faction);
    }

    void Update()
    {
        if (!enableHotkey)
            return;
        if (!CanInteractNow())
            return;
        if (!Input.GetKeyDown(InteractKey))
            return;

        var player = ResolvePlayerObject();
        if (player != null)
            TryJoinFaction(player);
    }

    void OnTriggerEnter2D(Collider2D other)
    {
        if (IsPlayerCollider(other))
        {
            playerInRange = true;
            cachedPlayer = other.transform;
        }
    }

    void OnTriggerExit2D(Collider2D other)
    {
        if (IsPlayerCollider(other))
            playerInRange = false;
    }

    /// <summary>
    /// 嘗試拜入本掌門所屬門派。
    /// </summary>
    /// <returns>是否轉職成功。</returns>
    public bool TryJoinFaction(GameObject player)
    {
        if (player == null)
        {
            Debug.LogWarning($"[{masterName}] 玩家物件為 null，無法拜師。");
            return false;
        }

        if (faction == CareerFaction.Beginner)
        {
            Debug.LogWarning($"[{masterName}] 掌門門派不可設為 Beginner。");
            return false;
        }

        var career = player.GetComponent<PlayerCareerManager>()
                     ?? player.GetComponentInParent<PlayerCareerManager>()
                     ?? player.GetComponentInChildren<PlayerCareerManager>();

        if (career == null)
        {
            Debug.LogWarning($"[{masterName}] 找不到 PlayerCareerManager，先幫玩家掛上生涯腳本再來拜師。");
            return false;
        }

        // 已有別的門派 → 大怒拒絕
        if (!career.IsBeginner && career.CurrentFaction != faction)
        {
            Debug.Log(BuildRejectBanter(career.CurrentFaction));
            return false;
        }

        // 已是本門 → 打發
        if (career.CurrentFaction == faction)
        {
            Debug.Log($"{masterName}：『你已經是{PlayerCareerManager.FactionDisplayName(faction)}的人了，還拜什麼師？去刷怪！』");
            return false;
        }

        // 江湖小蝦米 → 轉職成功
        if (!career.JoinFaction(faction))
        {
            Debug.Log($"{masterName}：『嗯？拜師手續辦失敗，大概是腳本沒掛好。』");
            return false;
        }

        string success = string.IsNullOrWhiteSpace(joinSuccessBanter)
            ? BuildDefaultSuccessBanter()
            : joinSuccessBanter;

        Debug.Log(success);
        Debug.Log(
            $"【轉職成功】{PlayerCareerManager.FactionDisplayName(faction)}｜" +
            $"臂力 {career.Strength} 悟性 {career.Insight} 根骨 {career.Bone} 身法 {career.Agility}"
        );

        // 同步文字掛機（JoinFaction 內已呼叫；再保險一次）
        career.SyncTextIdleEngine();

        if (TextIdleUIController.Instance != null)
        {
            TextIdleUIController.Instance.AddLogMessage(
                $"<color=#FFE082>【拜師】{success}</color>"
            );
        }

        return true;
    }

    string BuildRejectBanter(CareerFaction already)
    {
        string alreadyName = PlayerCareerManager.FactionDisplayName(already);
        string hereName = PlayerCareerManager.FactionDisplayName(faction);

        switch (faction)
        {
            case CareerFaction.XueDao:
                return $"{masterName}大罵：「你已經是{alreadyName}的偽君子了，還想來我血刀門當大魔頭？滾！」";
            case CareerFaction.ShaoLin:
                return $"{masterName}拂袖：「阿彌陀佛！你身上一股{alreadyName}味，少林不收二心弟子。去去去！」";
            case CareerFaction.TaiJi:
                return $"{masterName}慢悠悠搖扇：「以柔克剛可以，以{alreadyName}混太極不行。請回吧。」";
            case CareerFaction.TangMen:
                return $"{masterName}冷笑：「唐門戶籍系統顯示你是{alreadyName}。飛刀不砍自己人——但你不是。滾。」";
            default:
                return $"{masterName}大怒：「你已是{alreadyName}弟子，還想來{hereName}？拒絕！」";
        }
    }

    string BuildDefaultSuccessBanter()
    {
        switch (faction)
        {
            case CareerFaction.ShaoLin:
                return "空聞方丈敲木魚：『善哉！從今天起你就是少林編外弟子，木魚自己買。』";
            case CareerFaction.TaiJi:
                return "大師兄甄建比了個圓：『歡迎入太極。記得打怪要用圓的，別用直的。』";
            case CareerFaction.TangMen:
                return "唐老太太拍桌：『進來就對了！暗器免費試用三天，中毒自負。』";
            case CareerFaction.XueDao:
                return "血刀老祖大笑：『好！有殺氣！今晚加菜——加的是你自己的血條！』";
            default:
                return $"{masterName}：『收下了！走你！』";
        }
    }

    void ApplyDefaultMasterPreset(CareerFaction f)
    {
        switch (f)
        {
            case CareerFaction.ShaoLin:
                masterName = "空聞方丈";
                joinSuccessBanter = BuildDefaultSuccessBanter();
                break;
            case CareerFaction.TaiJi:
                masterName = "大師兄甄建";
                joinSuccessBanter = "大師兄甄建比了個圓：『歡迎入太極。記得打怪要用圓的，別用直的。』";
                break;
            case CareerFaction.TangMen:
                masterName = "唐老太太";
                joinSuccessBanter = "唐老太太拍桌：『進來就對了！暗器免費試用三天，中毒自負。』";
                break;
            case CareerFaction.XueDao:
                masterName = "血刀老祖";
                joinSuccessBanter = "血刀老祖大笑：『好！有殺氣！今晚加菜——加的是你自己的血條！』";
                break;
        }
    }

    bool CanInteractNow()
    {
        if (!requireProximity)
            return true;
        if (playerInRange)
            return true;

        var p = ResolvePlayerObject();
        if (p == null)
            return false;
        return Vector2.Distance(p.transform.position, transform.position) <= talkRange;
    }

    GameObject ResolvePlayerObject()
    {
        if (cachedPlayer != null)
            return cachedPlayer.gameObject;

        var tagged = GameObject.FindGameObjectWithTag(playerTag);
        if (tagged != null)
        {
            cachedPlayer = tagged.transform;
            return tagged;
        }

        return null;
    }

    bool IsPlayerCollider(Collider2D other)
    {
        if (other == null)
            return false;
        if (!string.IsNullOrEmpty(playerTag) && other.CompareTag(playerTag))
            return true;
        return cachedPlayer != null &&
               (other.transform == cachedPlayer || other.transform.IsChildOf(cachedPlayer));
    }

#if UNITY_EDITOR
    void OnDrawGizmosSelected()
    {
        Gizmos.color = new Color(1f, 0.85f, 0.2f, 0.35f);
        Gizmos.DrawWireSphere(transform.position, talkRange);
    }
#endif
}

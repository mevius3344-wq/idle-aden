using System.Collections;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// 可傳送的門派總部，以及回平安鎮。
/// </summary>
public enum FactionDestination
{
    ShaoLin = 0,
    TaiJi = 1,
    TangMen = 2,
    XueDao = 3,
    /// <summary>平安鎮村莊中央（傳送師據點）。</summary>
    PingAnVillage = 4,
}

/// <summary>
/// 村莊中央「門派傳送師」：一鍵瞬移各大門派／回平安鎮，附像素光束爆炸與暴走英雄譚風吐槽。
/// 掛在傳送師 NPC（或對話觸發區）上；在 Inspector 指定各門派 Transform 錨點與可選 VFX Prefab。
/// </summary>
[DisallowMultipleComponent]
public class VillageTeleporter : MonoBehaviour
{
    const KeyCode TalkKey = KeyCode.E;

    [System.Serializable]
    public class FactionPad
    {
        public FactionDestination destination;
        public Transform anchor;
        [Tooltip("此目標的搞笑台詞（留空則用內建預設）。")]
        public string[] banterLines;
    }

    [Header("玩家")]
    [SerializeField] Transform player;
    [SerializeField] string playerTag = "Player";

    [Header("錨點（預留門派總部座標）")]
    [SerializeField] Transform shaoLinPad;
    [SerializeField] Transform taiJiPad;
    [SerializeField] Transform tangMenPad;
    [SerializeField] Transform xueDaoPad;
    [SerializeField] Transform pingAnVillageCenter;

    [Header("互動")]
    [Tooltip("玩家靠近後按 E 與傳送師對話（需 Collider2D Is Trigger）。")]
    [SerializeField] bool requireProximity = true;
    [SerializeField] float talkRange = 2.5f;
    [SerializeField] bool enableHotkeys = true;

    [Header("傳送特效")]
    [Tooltip("像素光束爆炸 Prefab；留空則用內建簡易粒子閃光。")]
    [SerializeField] GameObject beamBurstVfxPrefab;
    [SerializeField] float vfxLifetime = 0.55f;
    [SerializeField] Color beamColor = new Color(0.55f, 0.95f, 1f, 1f);

    [Header("自訂台詞（可覆寫）")]
    [SerializeField] FactionPad[] customPads;

    bool playerInRange;
    int lastBanterIndex = -1;

    static readonly Dictionary<FactionDestination, string[]> DefaultBanter =
        new Dictionary<FactionDestination, string[]>
        {
            {
                FactionDestination.ShaoLin, new[]
                {
                    "傳送師大喊：『頭上一顆光，照亮去少林的路！走你！』",
                    "傳送師搓掌：『少林素齋管飽，但別跟木人樁比臉皮硬度。走你！』",
                }
            },
            {
                FactionDestination.TaiJi, new[]
                {
                    "傳送師慢悠悠：『太極門講究以柔克剛——傳送也一樣，輕輕一推，人就飛了。走你！』",
                    "傳送師比劃圓弧：『去太極記得深呼吸，別把雲手練成雲手抓雞。走你！』",
                }
            },
            {
                FactionDestination.TangMen, new[]
                {
                    "傳送師壓低嗓子：『唐門暗器多，進門先數手指還在不在。走你！』",
                    "傳送師眨眼：『唐門歡迎你——尤其歡迎會閃的你。走你！』",
                }
            },
            {
                FactionDestination.XueDao, new[]
                {
                    "傳送師悄悄說：『去血刀門記得穿紅衣服，這樣被打出鮮血才看不出來，走你！』",
                    "傳送師遞抹布：『血刀門地板很滑，不是水，你懂的。走你！』",
                }
            },
            {
                FactionDestination.PingAnVillage, new[]
                {
                    "傳送師招手：『想家了？平安鎮茶還熱著，回來掃大街也算居家服務。走你！』",
                    "傳送師敲鑼：『一鍵回村！暴走值清零、村長滿意、小雞存活。走你！』",
                }
            },
        };

    void Awake()
    {
        ResolvePlayer();
        EnsureVillageCenterFallback();
    }

    void Update()
    {
        if (!enableHotkeys)
            return;

        if (!CanTalkNow())
            return;

        if (Input.GetKeyDown(TalkKey))
            TalkToTeleporter();

        // 測試／原型快捷鍵：1~4 門派、0 回村
        if (Input.GetKeyDown(KeyCode.Alpha1) || Input.GetKeyDown(KeyCode.Keypad1))
            TeleportToFaction(GetPlayerObject(), FactionDestination.ShaoLin);
        else if (Input.GetKeyDown(KeyCode.Alpha2) || Input.GetKeyDown(KeyCode.Keypad2))
            TeleportToFaction(GetPlayerObject(), FactionDestination.TaiJi);
        else if (Input.GetKeyDown(KeyCode.Alpha3) || Input.GetKeyDown(KeyCode.Keypad3))
            TeleportToFaction(GetPlayerObject(), FactionDestination.TangMen);
        else if (Input.GetKeyDown(KeyCode.Alpha4) || Input.GetKeyDown(KeyCode.Keypad4))
            TeleportToFaction(GetPlayerObject(), FactionDestination.XueDao);
        else if (Input.GetKeyDown(KeyCode.Alpha0) || Input.GetKeyDown(KeyCode.Keypad0))
            ReturnToVillage(GetPlayerObject());
    }

    void OnTriggerEnter2D(Collider2D other)
    {
        if (IsPlayerCollider(other))
            playerInRange = true;
    }

    void OnTriggerExit2D(Collider2D other)
    {
        if (IsPlayerCollider(other))
            playerInRange = false;
    }

    /// <summary>
    /// 與傳送師對話：列出目的地，並提示快捷鍵。可隨時呼叫（UI 按鈕亦可）。
    /// </summary>
    public void TalkToTeleporter()
    {
        Debug.Log(
            "傳送師推了推草帽：『客官要去哪裡開大？』\n" +
            "  [1] 少林寺  [2] 太極門  [3] 唐門  [4] 血刀門  [0] 回平安鎮中央\n" +
            "（也可直接呼叫 TeleportToFaction / ReturnToVillage）"
        );
    }

    /// <summary>
    /// 從各大門派一鍵回「平安鎮村莊中央」。
    /// </summary>
    public void ReturnToVillage(GameObject playerObject)
    {
        TeleportToFaction(playerObject, FactionDestination.PingAnVillage);
    }

    /// <summary>
    /// 瞬移玩家至指定門派／平安鎮錨點，並在起點與終點觸發像素光束爆炸。
    /// </summary>
    public void TeleportToFaction(GameObject playerObject, FactionDestination destination)
    {
        if (playerObject == null)
        {
            Debug.LogWarning("[VillageTeleporter] 玩家物件為 null，無法傳送。");
            return;
        }

        Transform pad = ResolvePad(destination);
        if (pad == null)
        {
            Debug.LogWarning($"[VillageTeleporter] 尚未指定 {destination} 的 Transform 錨點。");
            return;
        }

        Vector3 from = playerObject.transform.position;
        Vector3 to = pad.position;
        to.z = from.z; // 2D 像素場景保持同一深度

        SpawnBeamBurst(from);
        playerObject.transform.position = to;
        SpawnBeamBurst(to);

        if (player == null)
            player = playerObject.transform;

        Debug.Log(PickBanter(destination));
    }

    Transform ResolvePad(FactionDestination destination)
    {
        if (customPads != null)
        {
            for (int i = 0; i < customPads.Length; i++)
            {
                var entry = customPads[i];
                if (entry != null && entry.destination == destination && entry.anchor != null)
                    return entry.anchor;
            }
        }

        switch (destination)
        {
            case FactionDestination.ShaoLin: return shaoLinPad;
            case FactionDestination.TaiJi: return taiJiPad;
            case FactionDestination.TangMen: return tangMenPad;
            case FactionDestination.XueDao: return xueDaoPad;
            case FactionDestination.PingAnVillage: return pingAnVillageCenter != null ? pingAnVillageCenter : transform;
            default: return null;
        }
    }

    string PickBanter(FactionDestination destination)
    {
        string[] lines = null;

        if (customPads != null)
        {
            for (int i = 0; i < customPads.Length; i++)
            {
                var entry = customPads[i];
                if (entry != null && entry.destination == destination && entry.banterLines != null && entry.banterLines.Length > 0)
                {
                    lines = entry.banterLines;
                    break;
                }
            }
        }

        if (lines == null)
            DefaultBanter.TryGetValue(destination, out lines);

        if (lines == null || lines.Length == 0)
            return $"傳送師：『去 {destination}！走你！』";

        int index;
        do
        {
            index = Random.Range(0, lines.Length);
        } while (lines.Length > 1 && index == lastBanterIndex);

        lastBanterIndex = index;
        return lines[index];
    }

    void SpawnBeamBurst(Vector3 worldPos)
    {
        if (beamBurstVfxPrefab != null)
        {
            var fx = Instantiate(beamBurstVfxPrefab, worldPos, Quaternion.identity);
            Destroy(fx, Mathf.Max(0.1f, vfxLifetime));
            return;
        }

        StartCoroutine(FallbackPixelBeamBurst(worldPos));
    }

    IEnumerator FallbackPixelBeamBurst(Vector3 worldPos)
    {
        var root = new GameObject("PixelBeamBurst");
        root.transform.position = worldPos;

        var particles = root.AddComponent<ParticleSystem>();
        var main = particles.main;
        main.duration = vfxLifetime;
        main.loop = false;
        main.startLifetime = 0.35f;
        main.startSpeed = 3.5f;
        main.startSize = 0.12f;
        main.startColor = beamColor;
        main.gravityModifier = 0f;
        main.simulationSpace = ParticleSystemSimulationSpace.World;
        main.maxParticles = 48;

        var emission = particles.emission;
        emission.rateOverTime = 0f;
        emission.SetBursts(new[] { new ParticleSystem.Burst(0f, 36) });

        var shape = particles.shape;
        shape.shapeType = ParticleSystemShapeType.Circle;
        shape.radius = 0.05f;

        var colorOverLifetime = particles.colorOverLifetime;
        colorOverLifetime.enabled = true;
        var grad = new Gradient();
        grad.SetKeys(
            new[]
            {
                new GradientColorKey(beamColor, 0f),
                new GradientColorKey(Color.white, 0.35f),
                new GradientColorKey(beamColor, 1f),
            },
            new[]
            {
                new GradientAlphaKey(1f, 0f),
                new GradientAlphaKey(0f, 1f),
            }
        );
        colorOverLifetime.color = grad;

        var renderer = root.GetComponent<ParticleSystemRenderer>();
        renderer.renderMode = ParticleSystemRenderMode.Billboard;

        particles.Play();
        yield return new WaitForSeconds(vfxLifetime + 0.1f);
        if (root != null)
            Destroy(root);
    }

    bool CanTalkNow()
    {
        if (!requireProximity)
            return true;

        if (playerInRange)
            return true;

        ResolvePlayer();
        if (player == null)
            return false;

        return Vector2.Distance(player.position, transform.position) <= talkRange;
    }

    GameObject GetPlayerObject()
    {
        ResolvePlayer();
        return player != null ? player.gameObject : null;
    }

    void ResolvePlayer()
    {
        if (player != null)
            return;

        var tagged = GameObject.FindGameObjectWithTag(playerTag);
        if (tagged != null)
            player = tagged.transform;
    }

    void EnsureVillageCenterFallback()
    {
        if (pingAnVillageCenter == null)
            pingAnVillageCenter = transform;
    }

    bool IsPlayerCollider(Collider2D other)
    {
        if (other == null)
            return false;
        if (!string.IsNullOrEmpty(playerTag) && other.CompareTag(playerTag))
            return true;
        return player != null && (other.transform == player || other.transform.IsChildOf(player));
    }

#if UNITY_EDITOR
    void OnDrawGizmosSelected()
    {
        Gizmos.color = new Color(0.4f, 0.85f, 1f, 0.35f);
        Gizmos.DrawWireSphere(transform.position, talkRange);

        DrawPadGizmo(shaoLinPad, Color.yellow);
        DrawPadGizmo(taiJiPad, Color.cyan);
        DrawPadGizmo(tangMenPad, Color.magenta);
        DrawPadGizmo(xueDaoPad, Color.red);
        DrawPadGizmo(pingAnVillageCenter != null ? pingAnVillageCenter : transform, Color.green);
    }

    static void DrawPadGizmo(Transform pad, Color color)
    {
        if (pad == null)
            return;
        Gizmos.color = color;
        Gizmos.DrawWireCube(pad.position, Vector3.one * 0.4f);
    }
#endif
}

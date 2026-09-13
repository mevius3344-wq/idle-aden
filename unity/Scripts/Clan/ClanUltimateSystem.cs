using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// 血盟終極系統（平衡版）：十萬金幣捐獻、精確升級條件、無限人數。
/// 血盟等級唯一戰鬥作用＝解鎖更強的「限時狀態」；無藥劑、無永久被動屬性加成。
/// </summary>
[DisallowMultipleComponent]
public class ClanUltimateSystem : MonoBehaviour
{
    // ─────────────────────────────────────────────
    // 常數
    // ─────────────────────────────────────────────
    public const int MaxClanLevel = 5;
    public const int StatusOptionCount = 4;
    public const long DonateCostGold = 100000L;
    public const long ExpPerDonate = 10L;
    public const long ContributionPerDonate = 1L;

    /// <summary>購買任一狀態選項的售價（個人貢獻度）。</summary>
    public const long StatusPurchaseCostContribution = 1L;

    /// <summary>單次購買增加的時效（1 小時）。</summary>
    public const float StatusPurchaseAddSeconds = 3600f;

    /// <summary>單一狀態最高累加時效（12 小時）。</summary>
    public const float StatusMaxAccumulateSeconds = 43200f;

    /// <summary>相容舊常數名稱：等同單次購買增加秒數。</summary>
    public const float StatusDurationSeconds = StatusPurchaseAddSeconds;

    /// <summary>各級升級所需的 clanTotalExp 門檻（索引＝當前等級 1~4）。</summary>
    public static readonly long[] LevelUpExpThreshold =
    {
        0L,      // 占位（等級從 1 開始）
        1000L,   // Lv.1 → Lv.2：等同全盟共捐 10,000,000 金幣
        5000L,   // Lv.2 → Lv.3：等同全盟共捐 50,000,000 金幣
        20000L,  // Lv.3 → Lv.4：等同全盟共捐 200,000,000 金幣
        100000L  // Lv.4 → Lv.5：等同全盟共捐 1,000,000,000 金幣
    };

    // ─────────────────────────────────────────────
    // 變數
    // ─────────────────────────────────────────────
    /// <summary>血盟等級（初始為 1，最高 5）。</summary>
    public int clanLevel = 1;

    /// <summary>血盟總經驗（累積）。</summary>
    public long clanTotalExp = 0L;

    /// <summary>玩家個人貢獻度（允許無限累積）。</summary>
    public long playerContribution = 0L;

    /// <summary>玩家持有金幣（長整數貨幣）。</summary>
    public long playerGold = 0L;

    /// <summary>成員清單（僅紀錄身分；人數無上限、不做任何人數檢查）。</summary>
    public readonly List<string> memberIds = new List<string>();

    /// <summary>各狀態是否啟用中（多選自由開啟）。</summary>
    public bool[] isActive = new bool[StatusOptionCount];

    /// <summary>各狀態剩餘計時器（秒）；可累加，最高 43200（12 小時）。</summary>
    public float[] currentTimer = new float[StatusOptionCount];

    /// <summary>最近一次購買的狀態選項 ID（UI 標示用）。</summary>
    public int selectedStatusOption = 0;

    // ─────────────────────────────────────────────
    // 黃金平衡版：階梯式狀態加成二維陣列
    // 列 = 狀態 ID（0~3）
    // 欄 = 血盟等級 Lv.1 ~ Lv.5（索引 0~4）
    // 僅在對應狀態開啟時效內才套用；未開啟恒為 0。
    // ─────────────────────────────────────────────
    public float[,] buffValuesMatrix = new float[,]
    {
        //          Lv.1     Lv.2     Lv.3     Lv.4     Lv.5
        { 0.020f, 0.025f, 0.030f, 0.040f, 0.050f }, // ID 0 (世界樹祝福: 回血回魔 +2% ~ +5%)
        { 0.015f, 0.020f, 0.030f, 0.040f, 0.050f }, // ID 1 (十字軍壁壘: 傷害減免 +1.5% ~ +5%)
        { 0.020f, 0.030f, 0.040f, 0.050f, 0.060f }, // ID 2 (天鷹之眼: 命中率 +2% ~ +6%)
        { 0.020f, 0.030f, 0.040f, 0.050f, 0.060f }  // ID 3 (戰神狂怒: 最終傷害 +2% ~ +6%)
    };

    /// <summary>四個狀態選項 ID 嚴格對齊名稱。</summary>
    public static readonly string[] StatusOptionNames =
    {
        "世界樹祝福", // ID 0
        "十字軍壁壘", // ID 1
        "天鷹之眼",   // ID 2
        "戰神狂怒"    // ID 3
    };

    public static readonly string[] StatusOptionDescs =
    {
        "回血回魔", // ID 0
        "傷害減免", // ID 1
        "命中率",   // ID 2
        "最終傷害"  // ID 3
    };

    // ─────────────────────────────────────────────
    // 血盟頁：4 個獨立狀態選項 UI 組件
    // 每組包含 Image 圖標、Button 購買按鈕、Text 倒數文字
    // ─────────────────────────────────────────────
    [Serializable]
    public class ClanStatusOptionUi
    {
        [Tooltip("狀態圖標")]
        public Image icon;

        [Tooltip("購買按鈕（售價 1 點個人貢獻度）")]
        public Button buyButton;

        [Tooltip("倒數文字（剩餘時效）")]
        public Text countdownText;

        [Tooltip("可選：狀態名稱文字")]
        public Text nameText;

        [Tooltip("可選：效果／售價說明文字")]
        public Text infoText;
    }

    [Header("面板")]
    public GameObject clanPanelRoot;
    public GameObject statusOptionPanelRoot;

    [Header("血盟資訊文字")]
    public Text textClanLevel;
    public Text textClanTotalExp;
    public Text textPlayerContribution;
    public Text textPlayerGold;
    public Text textMemberCount;
    public Text textNextLevelHint;
    public Text textFeedback;

    [Header("狀態總覽（可選）")]
    public Text textStatusActive;
    public Text textStatusRemain;
    public Text textStatusPower;

    [Header("血盟頁狀態選項 UI（嚴格 ID 0~3）")]
    public ClanStatusOptionUi statusUiId0_WorldTree;
    public ClanStatusOptionUi statusUiId1_CrusaderWall;
    public ClanStatusOptionUi statusUiId2_EagleEye;
    public ClanStatusOptionUi statusUiId3_WarGodRage;

    [Header("操作按鈕")]
    public Button buttonDonateGold;
    public Button buttonOpenClanPanel;
    public Button buttonCloseClanPanel;
    public Button buttonOpenStatusOptions;
    public Button buttonCloseStatusOptions;
    public Button buttonDeactivateStatus;

    // ─────────────────────────────────────────────
    // Unity 生命週期
    // ─────────────────────────────────────────────
    private void Awake()
    {
        EnsureStatusRuntimeArrays();
        ClampClanLevel();
        BindUiButtons();
        RefreshAllUi();
        if (clanPanelRoot != null) clanPanelRoot.SetActive(false);
        if (statusOptionPanelRoot != null) statusOptionPanelRoot.SetActive(false);
    }

    private void Update()
    {
        // 每幀以 Time.deltaTime 遞減所有 isActive == true 的狀態計時器，並同步 UI 狀態切換
        TickIndependentStatusTimers(Time.deltaTime);
    }

    /// <summary>
    /// 獨立計時與 UI 狀態切換：
    /// 迴圈遞減所有 isActive 為 true 的 currentTimer；
    /// 時間歸零 → isActive = false、失去效果；
    /// isActive true → 倒數顯示 HH:MM:SS、Image = Color.white；
    /// isActive false → 倒數顯示「未開啟」、Image = 半透明灰色。
    /// </summary>
    private void TickIndependentStatusTimers(float deltaTime)
    {
        EnsureStatusRuntimeArrays();
        bool anyEnded = false;

        for (int id = 0; id < StatusOptionCount; id++)
        {
            if (!isActive[id])
            {
                currentTimer[id] = 0f;
                ApplyStatusOptionUiState(id);
                continue;
            }

            // isActive == true：每幀遞減計時器
            currentTimer[id] -= deltaTime;

            if (currentTimer[id] <= 0f)
            {
                // 時間歸零：自動轉為 false，失去效果
                currentTimer[id] = 0f;
                isActive[id] = false;
                anyEnded = true;
                SetFeedback("【" + StatusOptionNames[id] + "】時效已結束，效果已失去。");
            }

            ApplyStatusOptionUiState(id);
        }

        if (anyEnded)
        {
            RefreshAllUi();
        }
        else if (IsBuffWindowActive())
        {
            RefreshStatusOverviewTexts();
        }
    }

    /// <summary>相容舊名稱。</summary>
    private void TickClanStatus(float deltaTime)
    {
        TickIndependentStatusTimers(deltaTime);
    }

    /// <summary>
    /// 依 isActive 切換該選項 Image 顏色與倒數文字。
    /// true  → Color.white + HH:MM:SS（如 11:59:59）
    /// false → 半透明灰色 +「未開啟」
    /// </summary>
    private void ApplyStatusOptionUiState(int id)
    {
        ClanStatusOptionUi ui = GetStatusUi(id);
        if (ui == null) return;

        bool active = id >= 0 && id < StatusOptionCount && isActive[id] && currentTimer[id] > 0f;

        if (ui.icon != null)
        {
            if (active)
            {
                ui.icon.color = Color.white;
            }
            else
            {
                // 半透明灰色
                ui.icon.color = new Color(Color.gray.r, Color.gray.g, Color.gray.b, 0.5f);
            }
        }

        if (ui.countdownText != null)
        {
            if (active)
            {
                ui.countdownText.color = Color.white;
                ui.countdownText.text = FormatCountdown(currentTimer[id]);
            }
            else
            {
                ui.countdownText.color = Color.gray;
                ui.countdownText.text = "未開啟";
            }
        }
    }

    private void EnsureStatusRuntimeArrays()
    {
        if (isActive == null || isActive.Length != StatusOptionCount)
        {
            bool[] nextActive = new bool[StatusOptionCount];
            if (isActive != null)
            {
                int copy = Math.Min(isActive.Length, StatusOptionCount);
                for (int i = 0; i < copy; i++) nextActive[i] = isActive[i];
            }
            isActive = nextActive;
        }

        if (currentTimer == null || currentTimer.Length != StatusOptionCount)
        {
            float[] nextTimer = new float[StatusOptionCount];
            if (currentTimer != null)
            {
                int copy = Math.Min(currentTimer.Length, StatusOptionCount);
                for (int i = 0; i < copy; i++) nextTimer[i] = currentTimer[i];
            }
            currentTimer = nextTimer;
        }

        for (int i = 0; i < StatusOptionCount; i++)
        {
            if (currentTimer[i] < 0f) currentTimer[i] = 0f;
            if (currentTimer[i] > StatusMaxAccumulateSeconds)
            {
                currentTimer[i] = StatusMaxAccumulateSeconds;
            }
            isActive[i] = currentTimer[i] > 0f;
        }
    }

    private ClanStatusOptionUi GetStatusUi(int statusId)
    {
        switch (statusId)
        {
            case 0: return statusUiId0_WorldTree;
            case 1: return statusUiId1_CrusaderWall;
            case 2: return statusUiId2_EagleEye;
            case 3: return statusUiId3_WarGodRage;
            default: return null;
        }
    }

    private void BindUiButtons()
    {
        if (buttonDonateGold != null)
        {
            buttonDonateGold.onClick.RemoveAllListeners();
            buttonDonateGold.onClick.AddListener(DonateGold);
        }

        if (buttonOpenClanPanel != null)
        {
            buttonOpenClanPanel.onClick.RemoveAllListeners();
            buttonOpenClanPanel.onClick.AddListener(OpenClanPanel);
        }

        if (buttonCloseClanPanel != null)
        {
            buttonCloseClanPanel.onClick.RemoveAllListeners();
            buttonCloseClanPanel.onClick.AddListener(CloseClanPanel);
        }

        if (buttonOpenStatusOptions != null)
        {
            buttonOpenStatusOptions.onClick.RemoveAllListeners();
            buttonOpenStatusOptions.onClick.AddListener(OpenStatusOptionPanel);
        }

        if (buttonCloseStatusOptions != null)
        {
            buttonCloseStatusOptions.onClick.RemoveAllListeners();
            buttonCloseStatusOptions.onClick.AddListener(CloseStatusOptionPanel);
        }

        if (buttonDeactivateStatus != null)
        {
            buttonDeactivateStatus.onClick.RemoveAllListeners();
            buttonDeactivateStatus.onClick.AddListener(DeactivateAllClanStatus);
        }

        for (int id = 0; id < StatusOptionCount; id++)
        {
            ClanStatusOptionUi ui = GetStatusUi(id);
            if (ui == null || ui.buyButton == null) continue;

            int statusId = id;
            ui.buyButton.onClick.RemoveAllListeners();
            ui.buyButton.onClick.AddListener(() => ActivateSelectedBuff(statusId));
        }
    }

    // ─────────────────────────────────────────────
    // 捐獻
    // ─────────────────────────────────────────────
    /// <summary>
    /// 每次成功執行：扣除玩家 100000 金幣；
    /// playerContribution 固定 +1；clanTotalExp 固定 +10；
    /// 隨後呼叫 CheckLevelUp。
    /// </summary>
    public void DonateGold()
    {
        if (playerGold < DonateCostGold)
        {
            SetFeedback("金幣不足，需要 100,000 金幣。");
            RefreshAllUi();
            return;
        }

        playerGold -= DonateCostGold;
        playerContribution += ContributionPerDonate;
        clanTotalExp += ExpPerDonate;

        CheckLevelUp();
        SetFeedback("捐獻成功：-100,000 金幣，貢獻 +1，血盟經驗 +10。");
        RefreshAllUi();
    }

    // ─────────────────────────────────────────────
    // 升級條件（寫入 CheckLevelUp）
    // ─────────────────────────────────────────────
    /// <summary>
    /// 依 clanTotalExp 檢查是否可升級（最高 Lv.5）。
    /// 當前 Lv.1 → Lv.2：clanTotalExp 需累積滿 1,000。
    /// 當前 Lv.2 → Lv.3：clanTotalExp 需累積滿 5,000。
    /// 當前 Lv.3 → Lv.4：clanTotalExp 需累積滿 20,000。
    /// 當前 Lv.4 → Lv.5：clanTotalExp 需累積滿 100,000。
    /// </summary>
    public void CheckLevelUp()
    {
        ClampClanLevel();

        while (clanLevel < MaxClanLevel)
        {
            long need = LevelUpExpThreshold[clanLevel];
            if (clanTotalExp < need) break;

            int from = clanLevel;
            clanLevel += 1;
            SetFeedback("血盟升級成功：Lv." + from + " → Lv." + clanLevel + "。");
        }

        ClampClanLevel();
    }

    private void ClampClanLevel()
    {
        if (clanLevel < 1) clanLevel = 1;
        if (clanLevel > MaxClanLevel) clanLevel = MaxClanLevel;
    }

    // ─────────────────────────────────────────────
    // 人數：徹底無上限
    // ─────────────────────────────────────────────
    /// <summary>加入成員。不做任何人數上限檢查（等同無限大）。</summary>
    public bool AddMember(string memberId)
    {
        if (string.IsNullOrEmpty(memberId)) return false;
        if (memberIds.Contains(memberId)) return false;
        memberIds.Add(memberId);
        RefreshAllUi();
        return true;
    }

    /// <summary>移除成員。同樣不做人數相關限制。</summary>
    public bool RemoveMember(string memberId)
    {
        bool removed = memberIds.Remove(memberId);
        if (removed) RefreshAllUi();
        return removed;
    }

    // ─────────────────────────────────────────────
    // 限時狀態：多選自由開啟 + 最高累加 12 小時
    // 點擊按鈕 → ActivateSelectedBuff(id)
    // ─────────────────────────────────────────────
    /// <summary>
    /// 啟用／續購指定狀態（頁面按鈕多選自由開啟）。
    /// 1. 扣除 1 點個人貢獻度
    /// 2. 單次購買累加 +3600 秒至 currentTimer
    /// 3. 若 currentTimer + 3600 &gt; 43200（12 小時上限）→ 拒絕並警告
    /// 4. 成功後 isActive = true；加成依最新 clanLevel 自 buffValuesMatrix 動態抓取
    /// </summary>
    public void ActivateSelectedBuff(int id)
    {
        EnsureStatusRuntimeArrays();

        if (id < 0 || id >= StatusOptionCount)
        {
            SetFeedback("無效的狀態選項。");
            return;
        }

        // 時間限制與疊加：最高累加 12 小時
        if (currentTimer[id] + StatusPurchaseAddSeconds > StatusMaxAccumulateSeconds)
        {
            SetFeedback("警告！【" + StatusOptionNames[id] + "】該狀態已達 12 小時累積上限！");
            RefreshAllUi();
            return;
        }

        if (playerContribution < StatusPurchaseCostContribution)
        {
            SetFeedback("個人貢獻度不足，需要 1 點才能購買。");
            RefreshAllUi();
            return;
        }

        playerContribution -= StatusPurchaseCostContribution;
        currentTimer[id] += StatusPurchaseAddSeconds;
        isActive[id] = true;
        selectedStatusOption = id;

        ClampClanLevel();
        float buffValue = GetBuffValueAt(id, clanLevel);

        SetFeedback(
            "購買成功！【" + StatusOptionNames[id] + "】已啟用" +
            "（" + StatusOptionDescs[id] +
            " +" + (buffValue * 100f).ToString("0.#") + "%" +
            "，依目前 Lv." + clanLevel + " 動態套用" +
            "，剩餘 " + FormatCountdown(currentTimer[id]) +
            "／上限 12 小時）。"
        );
        RefreshAllUi();
    }

    /// <summary>相容舊呼叫：等同 ActivateSelectedBuff。</summary>
    public void PurchaseStatusOption(int statusId)
    {
        ActivateSelectedBuff(statusId);
    }

    /// <summary>相容舊呼叫：等同 ActivateSelectedBuff。</summary>
    public void OnClickStatusOption(int optionIndex)
    {
        ActivateSelectedBuff(optionIndex);
    }

    public void DeactivateClanStatus(int statusId)
    {
        EnsureStatusRuntimeArrays();
        if (statusId < 0 || statusId >= StatusOptionCount) return;
        currentTimer[statusId] = 0f;
        isActive[statusId] = false;
        ApplyStatusOptionUiState(statusId);
        SetFeedback("已關閉【" + StatusOptionNames[statusId] + "】。");
        RefreshAllUi();
    }

    public void DeactivateAllClanStatus()
    {
        EnsureStatusRuntimeArrays();
        for (int i = 0; i < StatusOptionCount; i++)
        {
            currentTimer[i] = 0f;
            isActive[i] = false;
            ApplyStatusOptionUiState(i);
        }
        SetFeedback("已關閉全部血盟限時狀態。");
        RefreshAllUi();
    }

    /// <summary>威力階層＝當前血盟等級（Lv.1~5）；與矩陣欄位對齊。</summary>
    public int GetCurrentStatusPowerTier(int optionIndex)
    {
        ClampClanLevel();
        if (optionIndex < 0 || optionIndex >= StatusOptionCount) return 0;
        return clanLevel;
    }

    /// <summary>
    /// 讀取 buffValuesMatrix[buffId, levelIndex] 階梯加成（不檢查是否開啟）。
    /// level 為血盟等級 1~5；內部轉成欄位索引 0~4。
    /// </summary>
    public float GetBuffValueAt(int buffId, int level)
    {
        if (buffValuesMatrix == null) return 0f;
        if (buffId < 0 || buffId >= buffValuesMatrix.GetLength(0)) return 0f;
        int levelIndex = level - 1;
        if (levelIndex < 0 || levelIndex >= buffValuesMatrix.GetLength(1)) return 0f;
        return buffValuesMatrix[buffId, levelIndex];
    }

    /// <summary>指定狀態是否在時效內（isActive 且 currentTimer &gt; 0）。</summary>
    public bool IsStatusActive(int statusId)
    {
        EnsureStatusRuntimeArrays();
        if (statusId < 0 || statusId >= StatusOptionCount) return false;
        return isActive[statusId] && currentTimer[statusId] > 0f;
    }

    /// <summary>
    /// 戰鬥端讀取指定狀態加成。
    /// 僅在該 ID 開啟時效內，依「最新 clanLevel」自 buffValuesMatrix 動態抓取；否則 0。
    /// </summary>
    public float GetActiveBuffValue(int statusId)
    {
        if (!IsStatusActive(statusId)) return 0f;
        ClampClanLevel();
        return GetBuffValueAt(statusId, clanLevel);
    }

    /// <summary>
    /// 戰鬥端讀取最近購買／選中狀態的加成。
    /// 未開啟恒為 0。
    /// </summary>
    public float GetActiveBuffValue()
    {
        return GetActiveBuffValue(selectedStatusOption);
    }

    /// <summary>回傳四個狀態在當前血盟等級的加成預覽（UI 用）。</summary>
    public float[] GetBuffRowPreviewForCurrentLevel()
    {
        ClampClanLevel();
        float[] values = new float[StatusOptionCount];
        for (int id = 0; id < StatusOptionCount; id++)
        {
            values[id] = GetBuffValueAt(id, clanLevel);
        }
        return values;
    }

    public int GetActiveStatusPowerTier()
    {
        if (!IsStatusActive(selectedStatusOption)) return 0;
        return GetCurrentStatusPowerTier(selectedStatusOption);
    }

    public string GetActiveStatusOptionName()
    {
        if (!IsStatusActive(selectedStatusOption)) return string.Empty;
        return StatusOptionNames[selectedStatusOption];
    }

    public bool IsBuffWindowActive()
    {
        EnsureStatusRuntimeArrays();
        for (int i = 0; i < StatusOptionCount; i++)
        {
            if (isActive[i] && currentTimer[i] > 0f) return true;
        }
        return false;
    }

    public float GetStatusRemainSeconds(int statusId)
    {
        EnsureStatusRuntimeArrays();
        if (statusId < 0 || statusId >= StatusOptionCount) return 0f;
        return Mathf.Max(0f, currentTimer[statusId]);
    }

    /// <summary>續購後是否會超過 12 小時上限。</summary>
    public bool WouldExceedMaxAccumulate(int statusId)
    {
        EnsureStatusRuntimeArrays();
        if (statusId < 0 || statusId >= StatusOptionCount) return true;
        return currentTimer[statusId] + StatusPurchaseAddSeconds > StatusMaxAccumulateSeconds;
    }

    // ─────────────────────────────────────────────
    // 面板控制
    // ─────────────────────────────────────────────
    public void OpenClanPanel()
    {
        if (clanPanelRoot != null) clanPanelRoot.SetActive(true);
        RefreshAllUi();
    }

    public void CloseClanPanel()
    {
        if (clanPanelRoot != null) clanPanelRoot.SetActive(false);
    }

    public void OpenStatusOptionPanel()
    {
        if (statusOptionPanelRoot != null) statusOptionPanelRoot.SetActive(true);
        RefreshAllUi();
    }

    public void CloseStatusOptionPanel()
    {
        if (statusOptionPanelRoot != null) statusOptionPanelRoot.SetActive(false);
    }

    // ─────────────────────────────────────────────
    // UI 刷新
    // ─────────────────────────────────────────────
    public void RefreshAllUi()
    {
        ClampClanLevel();
        EnsureStatusRuntimeArrays();

        if (textClanLevel != null)
        {
            textClanLevel.text = "血盟等級：Lv." + clanLevel + " / " + MaxClanLevel;
        }

        if (textClanTotalExp != null)
        {
            textClanTotalExp.text = "血盟經驗：" + clanTotalExp.ToString("N0");
        }

        if (textPlayerContribution != null)
        {
            textPlayerContribution.text = "個人貢獻：" + playerContribution.ToString("N0");
        }

        if (textPlayerGold != null)
        {
            textPlayerGold.text = "持有金幣：" + playerGold.ToString("N0");
        }

        if (textMemberCount != null)
        {
            textMemberCount.text = "成員人數：" + memberIds.Count + "（無上限）";
        }

        if (textNextLevelHint != null)
        {
            textNextLevelHint.text = BuildNextLevelHint();
        }

        RefreshStatusOverviewTexts();
        RefreshStatusOptionUiGroups();
    }

    private void RefreshStatusOverviewTexts()
    {
        EnsureStatusRuntimeArrays();

        if (textStatusActive != null)
        {
            System.Text.StringBuilder sb = new System.Text.StringBuilder();
            bool any = false;
            for (int id = 0; id < StatusOptionCount; id++)
            {
                if (!IsStatusActive(id)) continue;
                if (any) sb.Append("、");
                sb.Append(StatusOptionNames[id]);
                any = true;
            }
            textStatusActive.text = any
                ? "狀態：開啟中【" + sb.ToString() + "】（可多選）"
                : "狀態：未開啟";
        }

        if (textStatusRemain != null)
        {
            if (IsStatusActive(selectedStatusOption))
            {
                textStatusRemain.text =
                    StatusOptionNames[selectedStatusOption] + " 剩餘：" +
                    FormatCountdown(currentTimer[selectedStatusOption]) +
                    "／上限 12:00:00";
            }
            else
            {
                textStatusRemain.text = "剩餘：—";
            }
        }

        if (textStatusPower != null)
        {
            if (IsStatusActive(selectedStatusOption))
            {
                float activeBuff = GetActiveBuffValue(selectedStatusOption);
                textStatusPower.text =
                    "【" + StatusOptionNames[selectedStatusOption] + "】" +
                    StatusOptionDescs[selectedStatusOption] +
                    " +" + (activeBuff * 100f).ToString("0.#") + "%" +
                    "（依最新 Lv." + clanLevel + "）";
            }
            else
            {
                float preview = GetBuffValueAt(0, clanLevel);
                textStatusPower.text =
                    "未開啟｜世界樹祝福預覽 +" + (preview * 100f).ToString("0.#") +
                    "%（購買後依最新等級動態生效）";
            }
        }
    }

    private void RefreshStatusOptionUiGroups()
    {
        for (int id = 0; id < StatusOptionCount; id++)
        {
            ClanStatusOptionUi ui = GetStatusUi(id);
            if (ui == null) continue;

            float buff = GetBuffValueAt(id, clanLevel);
            bool active = IsStatusActive(id);
            bool atCap = WouldExceedMaxAccumulate(id);

            if (ui.nameText != null)
            {
                ui.nameText.text =
                    (active ? "★ " : "") +
                    "ID " + id + " " + StatusOptionNames[id];
            }

            if (ui.infoText != null)
            {
                ui.infoText.text =
                    StatusOptionDescs[id] + " +" + (buff * 100f).ToString("0.#") + "%" +
                    "｜售價 " + StatusPurchaseCostContribution + " 貢獻" +
                    "｜單次 +" + (StatusPurchaseAddSeconds / 3600f).ToString("0") + " 小時" +
                    "｜最高累加 12 小時" +
                    "｜Lv." + clanLevel;
            }

            if (ui.buyButton != null)
            {
                bool canAfford = playerContribution >= StatusPurchaseCostContribution;
                // 仍可點擊以觸發上限警告；金幣不足才鎖住亦可——此處允許點擊，ActivateSelectedBuff 內處理拒絕
                ui.buyButton.interactable = true;
                Text buyLabel = ui.buyButton.GetComponentInChildren<Text>();
                if (buyLabel != null)
                {
                    if (atCap)
                    {
                        buyLabel.text = "已達 12 小時上限";
                    }
                    else if (!canAfford)
                    {
                        buyLabel.text = "貢獻不足（需 1）";
                    }
                    else if (active)
                    {
                        buyLabel.text = "續購 +1 小時（1 貢獻）";
                    }
                    else
                    {
                        buyLabel.text = "購買（1 貢獻／1 小時）";
                    }
                }
            }
        }

        RefreshStatusOptionUiCountdowns();
    }

    private void RefreshStatusOptionUiCountdowns()
    {
        EnsureStatusRuntimeArrays();
        for (int id = 0; id < StatusOptionCount; id++)
        {
            ApplyStatusOptionUiState(id);
        }
    }

    /// <summary>倒數顯示為時分秒，例如 11:59:59。</summary>
    private static string FormatCountdown(float seconds)
    {
        int total = Mathf.CeilToInt(Mathf.Max(0f, seconds));
        int h = total / 3600;
        int m = (total % 3600) / 60;
        int s = total % 60;
        return h.ToString("00") + ":" + m.ToString("00") + ":" + s.ToString("00");
    }

    private string BuildNextLevelHint()
    {
        if (clanLevel >= MaxClanLevel)
        {
            return "已達最高等級 Lv.5。升級唯一作用：解鎖更強限時狀態威力。";
        }

        long need = LevelUpExpThreshold[clanLevel];
        long remain = Math.Max(0L, need - clanTotalExp);
        long goldEquiv = remain / ExpPerDonate * DonateCostGold;

        return
            "升級至 Lv." + (clanLevel + 1) +
            " 條件：clanTotalExp 需達 " + need.ToString("N0") +
            "（尚差 " + remain.ToString("N0") +
            "，約等同再捐 " + goldEquiv.ToString("N0") + " 金幣）。";
    }

    private void SetFeedback(string message)
    {
        if (textFeedback != null)
        {
            textFeedback.text = message;
        }
        Debug.Log("[ClanUltimateSystem] " + message);
    }

    // ─────────────────────────────────────────────
    // 存檔 / 讀檔輔助（可選呼叫）
    // ─────────────────────────────────────────────
    public ClanSaveData ToSaveData()
    {
        EnsureStatusRuntimeArrays();
        return new ClanSaveData
        {
            clanLevel = clanLevel,
            clanTotalExp = clanTotalExp,
            playerContribution = playerContribution,
            playerGold = playerGold,
            memberIds = new List<string>(memberIds),
            selectedStatusOption = selectedStatusOption,
            isActive = (bool[])isActive.Clone(),
            currentTimer = (float[])currentTimer.Clone(),
            statusRemainById = (float[])currentTimer.Clone()
        };
    }

    public void LoadFromSaveData(ClanSaveData data)
    {
        if (data == null) return;

        clanLevel = data.clanLevel;
        clanTotalExp = data.clanTotalExp;
        playerContribution = data.playerContribution;
        playerGold = data.playerGold;
        memberIds.Clear();
        if (data.memberIds != null) memberIds.AddRange(data.memberIds);
        selectedStatusOption = data.selectedStatusOption;

        EnsureStatusRuntimeArrays();

        float[] loadedTimer = data.currentTimer;
        if (loadedTimer == null || loadedTimer.Length == 0) loadedTimer = data.statusRemainById;

        if (loadedTimer != null)
        {
            int copy = Math.Min(loadedTimer.Length, StatusOptionCount);
            for (int i = 0; i < copy; i++) currentTimer[i] = loadedTimer[i];
            for (int i = copy; i < StatusOptionCount; i++) currentTimer[i] = 0f;
        }

        if (data.isActive != null && data.isActive.Length > 0)
        {
            int copy = Math.Min(data.isActive.Length, StatusOptionCount);
            for (int i = 0; i < copy; i++) isActive[i] = data.isActive[i];
            for (int i = copy; i < StatusOptionCount; i++) isActive[i] = currentTimer[i] > 0f;
        }
        else
        {
            for (int i = 0; i < StatusOptionCount; i++) isActive[i] = currentTimer[i] > 0f;
        }

        // 相容舊存檔：單一 remain 欄位
        if (data.clanStatusActive && data.clanStatusRemainSeconds > 0f)
        {
            int id = Mathf.Clamp(selectedStatusOption, 0, StatusOptionCount - 1);
            if (currentTimer[id] <= 0f)
            {
                currentTimer[id] = data.clanStatusRemainSeconds;
                isActive[id] = true;
            }
        }

        EnsureStatusRuntimeArrays();
        ClampClanLevel();
        CheckLevelUp();
        RefreshAllUi();
    }

    [Serializable]
    public class ClanSaveData
    {
        public int clanLevel = 1;
        public long clanTotalExp = 0L;
        public long playerContribution = 0L;
        public long playerGold = 0L;
        public List<string> memberIds = new List<string>();
        public int selectedStatusOption = 0;
        public bool[] isActive = new bool[StatusOptionCount];
        public float[] currentTimer = new float[StatusOptionCount];
        public float[] statusRemainById = new float[StatusOptionCount];

        // 舊版相容欄位
        public bool clanStatusActive = false;
        public float clanStatusRemainSeconds = 0f;
    }
}

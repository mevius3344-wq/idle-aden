using System.Collections;
using TMPro;
using UnityEngine;

/// <summary>
/// 《暴走英雄譚》帳號密碼登入／註冊面板。
/// 掛在登入 Canvas 上，綁定 TMP 輸入框與村莊場景開關。
/// </summary>
[DisallowMultipleComponent]
public class GameLoginManager : MonoBehaviour
{
    const string PrefsAccountPrefix = "bht_account_";
    const string PrefsPasswordPrefix = "bht_password_";
    const float EnterVillageDelay = 1f;

    static readonly string[] LoginFailBanter =
    {
        "暗號錯誤！傳送師懷疑你是血刀門派來的臥底！",
        "查無此人，你是不是走錯平安鎮了？",
        "六扇門戶籍系統跳出紅字：『此人未報到，或暗號寫成繁體武當。』",
        "掌櫃搖頭：『帳號對、暗號不對——很像唐門試毒失敗的感覺。』",
        "巡邏兵攔下你：『少林木魚密碼都比你這串有節奏。再試一次！』",
        "土地公托夢：『無名小卒還想進村？先註冊戶籍再說。』",
    };

    [Header("UI 綁定")]
    [SerializeField] TMP_InputField accountField;
    [SerializeField] TMP_InputField passwordField;
    [SerializeField] TextMeshProUGUI statusText;

    [Header("場景切換")]
    [SerializeField] GameObject loginPanelGameObject;
    [SerializeField] GameObject villageSceneGameObject;

    [Header("行為")]
    [SerializeField] bool hideVillageOnAwake = true;

    Coroutine _enterRoutine;
    int _lastFailIndex = -1;

    void Awake()
    {
        if (hideVillageOnAwake && villageSceneGameObject != null)
            villageSceneGameObject.SetActive(false);

        if (loginPanelGameObject != null)
            loginPanelGameObject.SetActive(true);

        if (passwordField != null)
            passwordField.contentType = TMP_InputField.ContentType.Password;

        SetStatus("歡迎來到平安鎮。先註冊戶籍，或輸入暗號踏入江湖。");
    }

    /// <summary>
    /// 【初入武林】註冊帳號。可綁 Button OnClick。
    /// </summary>
    public void RegisterAccount()
    {
        string account = ReadAccount();
        string password = ReadPassword();

        if (string.IsNullOrEmpty(account) || string.IsNullOrEmpty(password))
        {
            SetStatus("連名字都沒有，你是哪來的無名小卒？");
            return;
        }

        if (IsAccountRegistered(account))
        {
            SetStatus("這個江湖名號太響亮了，已經被別的大俠捷足先登！");
            return;
        }

        PlayerPrefs.SetString(PrefsAccountPrefix + account, account);
        PlayerPrefs.SetString(PrefsPasswordPrefix + account, password);
        PlayerPrefs.Save();

        SetStatus("註冊成功！你已正式登錄六扇門戶籍管理系統。");
    }

    /// <summary>
    /// 【踏入江湖】登入帳號。可綁 Button OnClick。
    /// </summary>
    public void LoginAccount()
    {
        string account = ReadAccount();
        string password = ReadPassword();

        if (string.IsNullOrEmpty(account) || string.IsNullOrEmpty(password))
        {
            SetStatus("連名字都沒有，你是哪來的無名小卒？");
            return;
        }

        if (!IsAccountRegistered(account) || !IsPasswordCorrect(account, password))
        {
            SetStatus(PickLoginFailBanter());
            return;
        }

        SetStatus("驗證成功！大俠請進！");

        if (_enterRoutine != null)
            StopCoroutine(_enterRoutine);
        _enterRoutine = StartCoroutine(EnterVillageAfterDelay());
    }

    IEnumerator EnterVillageAfterDelay()
    {
        yield return new WaitForSeconds(EnterVillageDelay);

        if (loginPanelGameObject != null)
            loginPanelGameObject.SetActive(false);

        if (villageSceneGameObject != null)
            villageSceneGameObject.SetActive(true);
        else
            Debug.LogWarning("[GameLoginManager] villageSceneGameObject 未綁定，無法開啟村莊場景。");

        _enterRoutine = null;
    }

    string ReadAccount()
    {
        return accountField != null ? accountField.text.Trim() : string.Empty;
    }

    string ReadPassword()
    {
        return passwordField != null ? passwordField.text : string.Empty;
    }

    static bool IsAccountRegistered(string account)
    {
        return PlayerPrefs.HasKey(PrefsAccountPrefix + account);
    }

    static bool IsPasswordCorrect(string account, string password)
    {
        string saved = PlayerPrefs.GetString(PrefsPasswordSuffixKey(account), string.Empty);
        return saved == password;
    }

    static string PrefsPasswordSuffixKey(string account)
    {
        return PrefsPasswordPrefix + account;
    }

    string PickLoginFailBanter()
    {
        int index;
        do
        {
            index = Random.Range(0, LoginFailBanter.Length);
        } while (LoginFailBanter.Length > 1 && index == _lastFailIndex);

        _lastFailIndex = index;
        return LoginFailBanter[index];
    }

    void SetStatus(string message)
    {
        if (statusText != null)
            statusText.text = message;
        Debug.Log("[登入] " + message);
    }

#if UNITY_EDITOR
    [ContextMenu("Debug/Clear All Saved Accounts (PlayerPrefs keys with prefix)")]
    void DebugClearHint()
    {
        Debug.LogWarning(
            "[GameLoginManager] 請用 PlayerPrefs.DeleteAll() 或自行刪除 bht_account_ / bht_password_ 開頭的鍵。"
        );
    }
#endif
}

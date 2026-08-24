using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// 文字掛機日誌 UI：接收引擎的富文字，丟進 ScrollView 面板。
/// 場景中放一個本元件（建議掛在 Canvas 下），指定 Content 上的 Text。
/// </summary>
[DisallowMultipleComponent]
public class TextIdleUIController : MonoBehaviour
{
    public static TextIdleUIController Instance { get; private set; }

    [Header("ScrollView 綁定（uGUI）")]
    [SerializeField] ScrollRect scrollRect;
    [Tooltip("ScrollView → Content 底下的 Text（需勾選 Rich Text / Support Rich Text）。")]
    [SerializeField] Text logText;
    [SerializeField] int maxLines = 80;
    [SerializeField] bool autoScrollToBottom = true;
    [SerializeField] bool alsoMirrorToConsole = false;

    readonly Queue<string> _lines = new Queue<string>(128);
    readonly StringBuilder _builder = new StringBuilder(2048);

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Debug.LogWarning("[TextIdleUIController] 場景已有實例，銷毀重複物件。");
            Destroy(gameObject);
            return;
        }

        Instance = this;
    }

    void OnDestroy()
    {
        if (Instance == this)
            Instance = null;
    }

    /// <summary>
    /// 核心黏合點：引擎每回合把搞笑富文字丟進來顯示。
    /// </summary>
    public void AddLogMessage(string richLogText)
    {
        if (string.IsNullOrEmpty(richLogText))
            return;

        if (alsoMirrorToConsole)
            Debug.Log(richLogText);

        _lines.Enqueue(richLogText);
        while (_lines.Count > Mathf.Max(10, maxLines))
            _lines.Dequeue();

        RebuildText();

        if (autoScrollToBottom && scrollRect != null)
        {
            Canvas.ForceUpdateCanvases();
            scrollRect.verticalNormalizedPosition = 0f;
        }
    }

    public void ClearLog()
    {
        _lines.Clear();
        RebuildText();
    }

    void RebuildText()
    {
        if (logText == null)
            return;

        _builder.Length = 0;
        bool first = true;
        foreach (var line in _lines)
        {
            if (!first)
                _builder.Append('\n');
            first = false;
            _builder.Append(line);
        }

        logText.supportRichText = true;
        logText.text = _builder.ToString();
    }

#if UNITY_EDITOR
    void OnValidate()
    {
        if (logText != null)
            logText.supportRichText = true;
    }

    [ContextMenu("Debug/Add Sample ShaoLin Line")]
    void DebugSample()
    {
        AddLogMessage(
            "<color=#FFD700>【少林】你使出大力金剛掌，一巴掌把史萊姆拍進牆裡，扣除 80 點血量！</color>"
        );
    }
#endif
}

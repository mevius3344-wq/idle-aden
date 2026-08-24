using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// 復古武俠風格登入背景：宣紙底、遠山剪影、墨暈與燈籠光。
/// 掛在登入 Canvas（或全螢幕 Panel）上，執行時自動鋪滿。
/// </summary>
[DisallowMultipleComponent]
[RequireComponent(typeof(RectTransform))]
public class LoginWuxiaBackground : MonoBehaviour
{
    [Header("層級（可留空，執行時自動建立）")]
    [SerializeField] Image paperLayer;
    [SerializeField] Image skyLayer;
    [SerializeField] Image mountainFar;
    [SerializeField] Image mountainNear;
    [SerializeField] Image mistLayer;
    [SerializeField] Image vignetteLayer;
    [SerializeField] Image inkWashLeft;
    [SerializeField] Image inkWashRight;
    [SerializeField] Image lanternGlow;

    [Header("配色（復古水墨）")]
    [SerializeField] Color paperColor = new Color(0.93f, 0.88f, 0.78f, 1f);
    [SerializeField] Color skyTop = new Color(0.55f, 0.35f, 0.28f, 1f);
    [SerializeField] Color skyBottom = new Color(0.82f, 0.62f, 0.42f, 1f);
    [SerializeField] Color mountainFarColor = new Color(0.42f, 0.32f, 0.28f, 0.55f);
    [SerializeField] Color mountainNearColor = new Color(0.22f, 0.16f, 0.14f, 0.85f);
    [SerializeField] Color mistColor = new Color(0.95f, 0.90f, 0.82f, 0.22f);
    [SerializeField] Color inkColor = new Color(0.12f, 0.10f, 0.09f, 0.35f);
    [SerializeField] Color lanternColor = new Color(1f, 0.55f, 0.25f, 0.18f);
    [SerializeField] Color vignetteColor = new Color(0.08f, 0.05f, 0.03f, 0.55f);

    [Header("動態")]
    [SerializeField] bool animate = true;
    [SerializeField] float mistDriftSpeed = 12f;
    [SerializeField] float lanternPulseSpeed = 1.4f;

    RectTransform _root;
    RectTransform _mistRect;
    float _mistOffset;
    float _lanternBaseAlpha;

    void Awake()
    {
        _root = transform as RectTransform;
        EnsureLayers();
        ApplyColors();
        StretchFull(_root);
    }

    void Update()
    {
        if (!animate)
            return;

        if (_mistRect != null)
        {
            _mistOffset += mistDriftSpeed * Time.deltaTime;
            float x = Mathf.Sin(_mistOffset * 0.03f) * 40f;
            _mistRect.anchoredPosition = new Vector2(x, _mistRect.anchoredPosition.y);
        }

        if (lanternGlow != null)
        {
            float pulse = 0.75f + 0.25f * Mathf.Sin(Time.time * lanternPulseSpeed);
            var c = lanternGlow.color;
            c.a = _lanternBaseAlpha * pulse;
            lanternGlow.color = c;
        }
    }

    void EnsureLayers()
    {
        // 由下到上：宣紙 → 天色 → 遠山 → 近山 → 霧 → 墨暈 → 燈籠 → 暗角
        paperLayer = EnsureImage(paperLayer, "Layer_Paper", 0);
        skyLayer = EnsureImage(skyLayer, "Layer_Sky", 1);
        mountainFar = EnsureImage(mountainFar, "Layer_MountainFar", 2);
        mountainNear = EnsureImage(mountainNear, "Layer_MountainNear", 3);
        mistLayer = EnsureImage(mistLayer, "Layer_Mist", 4);
        inkWashLeft = EnsureImage(inkWashLeft, "Layer_InkLeft", 5);
        inkWashRight = EnsureImage(inkWashRight, "Layer_InkRight", 6);
        lanternGlow = EnsureImage(lanternGlow, "Layer_Lantern", 7);
        vignetteLayer = EnsureImage(vignetteLayer, "Layer_Vignette", 8);

        _mistRect = mistLayer != null ? mistLayer.rectTransform : null;

        // 遠／近山用底部錨點，做出地平線剪影
        PinBottom(mountainFar, 0.42f);
        PinBottom(mountainNear, 0.32f);

        // 墨暈偏左右上角
        PinCorner(inkWashLeft, new Vector2(0f, 1f), new Vector2(0.45f, 0.55f));
        PinCorner(inkWashRight, new Vector2(1f, 1f), new Vector2(0.45f, 0.55f));

        // 燈籠光偏上方中央
        if (lanternGlow != null)
        {
            var rt = lanternGlow.rectTransform;
            rt.anchorMin = new Vector2(0.2f, 0.55f);
            rt.anchorMax = new Vector2(0.8f, 1f);
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
        }

        // 霧帶加寬，方便左右漂移
        if (mistLayer != null)
        {
            var rt = mistLayer.rectTransform;
            rt.anchorMin = new Vector2(-0.15f, 0.15f);
            rt.anchorMax = new Vector2(1.15f, 0.55f);
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
        }
    }

    void ApplyColors()
    {
        if (paperLayer != null)
            paperLayer.color = paperColor;

        if (skyLayer != null)
        {
            // 用垂直漸層貼圖模擬黃昏天色
            skyLayer.sprite = CreateVerticalGradientSprite(skyTop, skyBottom, 64);
            skyLayer.type = Image.Type.Simple;
            skyLayer.color = Color.white;
            skyLayer.preserveAspect = false;
        }

        if (mountainFar != null)
        {
            mountainFar.sprite = CreateMountainSilhouetteSprite(96, 48, 0.55f, 3);
            mountainFar.color = mountainFarColor;
            mountainFar.type = Image.Type.Simple;
        }

        if (mountainNear != null)
        {
            mountainNear.sprite = CreateMountainSilhouetteSprite(96, 48, 0.72f, 5);
            mountainNear.color = mountainNearColor;
            mountainNear.type = Image.Type.Simple;
        }

        if (mistLayer != null)
        {
            mistLayer.sprite = CreateSoftBlobSprite(64);
            mistLayer.color = mistColor;
            mistLayer.type = Image.Type.Sliced;
        }

        if (inkWashLeft != null)
        {
            inkWashLeft.sprite = CreateSoftBlobSprite(64);
            inkWashLeft.color = inkColor;
            inkWashLeft.rectTransform.localScale = new Vector3(1.2f, 1f, 1f);
        }

        if (inkWashRight != null)
        {
            inkWashRight.sprite = CreateSoftBlobSprite(64);
            inkWashRight.color = new Color(inkColor.r, inkColor.g, inkColor.b, inkColor.a * 0.85f);
            inkWashRight.rectTransform.localScale = new Vector3(-1.1f, 0.9f, 1f);
        }

        if (lanternGlow != null)
        {
            lanternGlow.sprite = CreateSoftBlobSprite(64);
            lanternGlow.color = lanternColor;
            _lanternBaseAlpha = lanternColor.a;
        }

        if (vignetteLayer != null)
        {
            vignetteLayer.sprite = CreateVignetteSprite(128);
            vignetteLayer.color = Color.white;
            var c = vignetteColor;
            // 用材質色乘以暗角強度
            vignetteLayer.color = new Color(1f, 1f, 1f, c.a);
            // 實際暗角顏色寫進貼圖，這裡只調 alpha
            vignetteLayer.sprite = CreateVignetteSprite(128, c);
        }
    }

    Image EnsureImage(Image existing, string name, int siblingIndex)
    {
        if (existing != null)
            return existing;

        var child = transform.Find(name);
        GameObject go;
        if (child != null)
        {
            go = child.gameObject;
        }
        else
        {
            go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            go.transform.SetParent(transform, false);
        }

        go.transform.SetSiblingIndex(Mathf.Clamp(siblingIndex, 0, transform.childCount - 1));
        var img = go.GetComponent<Image>();
        img.raycastTarget = false;
        StretchFull(go.transform as RectTransform);
        return img;
    }

    static void StretchFull(RectTransform rt)
    {
        if (rt == null)
            return;
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
        rt.localScale = Vector3.one;
    }

    static void PinBottom(Image img, float heightFraction)
    {
        if (img == null)
            return;
        var rt = img.rectTransform;
        rt.anchorMin = new Vector2(0f, 0f);
        rt.anchorMax = new Vector2(1f, heightFraction);
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }

    static void PinCorner(Image img, Vector2 corner, Vector2 size)
    {
        if (img == null)
            return;
        var rt = img.rectTransform;
        rt.anchorMin = corner;
        rt.anchorMax = corner;
        rt.pivot = corner;
        rt.sizeDelta = new Vector2(Screen.width * size.x, Screen.height * size.y);
        // 用錨點比例更穩
        if (corner.x < 0.5f && corner.y > 0.5f)
        {
            rt.anchorMin = new Vector2(0f, 1f - size.y);
            rt.anchorMax = new Vector2(size.x, 1f);
        }
        else
        {
            rt.anchorMin = new Vector2(1f - size.x, 1f - size.y);
            rt.anchorMax = new Vector2(1f, 1f);
        }
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
        rt.pivot = new Vector2(0.5f, 0.5f);
    }

    static Sprite CreateVerticalGradientSprite(Color top, Color bottom, int height)
    {
        height = Mathf.Max(8, height);
        var tex = new Texture2D(2, height, TextureFormat.RGBA32, false);
        tex.wrapMode = TextureWrapMode.Clamp;
        tex.filterMode = FilterMode.Bilinear;
        for (int y = 0; y < height; y++)
        {
            float t = y / (float)(height - 1);
            Color c = Color.Lerp(bottom, top, t);
            tex.SetPixel(0, y, c);
            tex.SetPixel(1, y, c);
        }
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, 2, height), new Vector2(0.5f, 0.5f), 100f);
    }

    static Sprite CreateMountainSilhouetteSprite(int width, int height, float peakScale, int seed)
    {
        width = Mathf.Max(16, width);
        height = Mathf.Max(16, height);
        var tex = new Texture2D(width, height, TextureFormat.RGBA32, false);
        tex.filterMode = FilterMode.Point;
        tex.wrapMode = TextureWrapMode.Clamp;

        var rng = new System.Random(seed);
        float[] peaks = new float[width];
        float h = 0.2f;
        for (int x = 0; x < width; x++)
        {
            h += ((float)rng.NextDouble() - 0.5f) * 0.12f;
            h = Mathf.Clamp(h, 0.15f, 0.95f);
            float ridge = Mathf.Sin(x / (float)width * Mathf.PI * (2 + seed % 3)) * 0.25f;
            peaks[x] = Mathf.Clamp01((h + ridge) * peakScale);
        }

        for (int y = 0; y < height; y++)
        {
            float yn = y / (float)(height - 1);
            for (int x = 0; x < width; x++)
            {
                bool fill = yn <= peaks[x];
                tex.SetPixel(x, y, fill ? Color.white : Color.clear);
            }
        }

        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, width, height), new Vector2(0.5f, 0f), 100f);
    }

    static Sprite CreateSoftBlobSprite(int size)
    {
        size = Mathf.Max(16, size);
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        tex.filterMode = FilterMode.Bilinear;
        float half = (size - 1) * 0.5f;
        for (int y = 0; y < size; y++)
        {
            for (int x = 0; x < size; x++)
            {
                float nx = (x - half) / half;
                float ny = (y - half) / half;
                float d = Mathf.Sqrt(nx * nx + ny * ny);
                float a = Mathf.Clamp01(1f - d);
                a = a * a * (3f - 2f * a);
                tex.SetPixel(x, y, new Color(1f, 1f, 1f, a));
            }
        }
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }

    static Sprite CreateVignetteSprite(int size, Color? tint = null)
    {
        size = Mathf.Max(32, size);
        Color edge = tint ?? new Color(0.08f, 0.05f, 0.03f, 1f);
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        tex.filterMode = FilterMode.Bilinear;
        float half = (size - 1) * 0.5f;
        for (int y = 0; y < size; y++)
        {
            for (int x = 0; x < size; x++)
            {
                float nx = (x - half) / half;
                float ny = (y - half) / half;
                float d = Mathf.Sqrt(nx * nx + ny * ny);
                float a = Mathf.Clamp01((d - 0.35f) / 0.85f);
                a = a * a;
                tex.SetPixel(x, y, new Color(edge.r, edge.g, edge.b, a * edge.a));
            }
        }
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }

#if UNITY_EDITOR
    [ContextMenu("Rebuild Background")]
    void Rebuild()
    {
        EnsureLayers();
        ApplyColors();
    }
#endif
}

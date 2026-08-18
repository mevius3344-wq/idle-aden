# 雲州閒俠 · 即時連線（可上雲端）

原創直式武俠放置 RPG。帳號、聊天、交易所、隊伍、江湖霸主都在伺服器共用。

## 本機

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

開 http://127.0.0.1:5173

## 雲端（24 小時公開網址）

伺服器已改成 Node.js，可佈到 Render / Fly.io 等平台。最快方式：

1. 把這個資料夾推到 GitHub（或用 Render 直接上傳）
2. 到 [Render](https://render.com/) 註冊 → **New → Blueprint**
3. 選這個專案，會讀 `render.yaml` 自動建立網站
4. 佈署完成後會得到 `https://xxxx.onrender.com`，手機跟朋友都可進

免費方案閒置約 15 分鐘會休眠，第一次打開可能要等半分鐘；連上後即可多人即時遊玩。

本機 `start.ps1` 仍可當區網伺服器。雲端與本機用同一套協定，資料在伺服器的 `data/world.json`。

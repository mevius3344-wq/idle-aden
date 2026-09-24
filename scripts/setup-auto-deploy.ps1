# 一鍵設定 GitHub 自動部署（Railway + Vercel）
# 用法：雙擊「幫我設定自動部署.bat」
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Repo = "mevius3344-wq/idle-aden"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location -LiteralPath $Root

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  躺著變強 — 自動部署一鍵設定" -ForegroundColor Cyan
Write-Host "  （Railway 遊戲主機 + Vercel API）" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "跟著做幾次「複製 → 貼上 → Enter」，之後 push main 就會自動更新。"
Write-Host ""

$gh = $null
foreach ($p in @(
  "C:\Program Files\GitHub CLI\gh.exe",
  "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe",
  "gh"
)) {
  if (Get-Command $p -ErrorAction SilentlyContinue) { $gh = $p; break }
}

if (-not $gh) {
  Write-Host "正在安裝 GitHub CLI..." -ForegroundColor Yellow
  winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements 2>$null
  foreach ($p in @("C:\Program Files\GitHub CLI\gh.exe", "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe")) {
    if (Test-Path $p) { $gh = $p; break }
  }
}

if (-not $gh) {
  Write-Host "無法自動安裝 GitHub CLI。" -ForegroundColor Red
  Write-Host "請手動到 https://github.com/$Repo/settings/secrets/actions 設定 Secret。" -ForegroundColor Yellow
  Read-Host "按 Enter 結束"
  exit 1
}

$auth = & $gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "【步驟 0】請在瀏覽器登入 GitHub（只要做一次）" -ForegroundColor Green
  & $gh auth login -h github.com -p https -w
}

Write-Host ""
Write-Host "【步驟 1】Railway 遊戲主機" -ForegroundColor Green
Write-Host "  1) 開 https://railway.app → New Project → Deploy from GitHub → idle-aden"
Write-Host "  2) Settings → Networking → Generate Domain（記下網址）"
Write-Host "  3) Variables 加 PUBLIC_GAME_ORIGIN=https://你的網域.up.railway.app"
Write-Host "  4) Settings → Deploy → 建立 Deploy Hook，複製網址"
Start-Process "https://railway.app/dashboard"
Start-Sleep -Seconds 2

$railHook = Read-Host "請貼上 Railway Deploy Hook（整串 https://...，可空白略過）"
if ($railHook -and $railHook -match "^https://") {
  & $gh secret set RAILWAY_DEPLOY_HOOK --body $railHook --repo $Repo
  Write-Host "  ✓ RAILWAY_DEPLOY_HOOK 已設定" -ForegroundColor Green
} else {
  Write-Host "  略過 Deploy Hook" -ForegroundColor Yellow
}

$railUrl = Read-Host "請貼上 Railway 公開網址（例 https://xxx.up.railway.app，可空白）"
if ($railUrl -and $railUrl -match "^https://") {
  $railUrl = $railUrl.TrimEnd("/")
  & $gh secret set RAILWAY_PUBLIC_URL --body $railUrl --repo $Repo
  Write-Host "  ✓ RAILWAY_PUBLIC_URL 已設定" -ForegroundColor Green
} else {
  Write-Host "  略過公開網址（之後可再設）" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "【步驟 2】Vercel 部署網址（帳號／Neon API）" -ForegroundColor Green
Write-Host "  → Settings → Git → Deploy Hooks → Create Hook → Production"
Start-Process "https://vercel.com/dashboard"
Start-Sleep -Seconds 2
$vercelHook = Read-Host "請貼上 Vercel Deploy Hook 網址（整串 https://...）"

if ($vercelHook -and $vercelHook -match "^https://") {
  & $gh secret set VERCEL_DEPLOY_HOOK --body $vercelHook --repo $Repo
  Write-Host "  ✓ Vercel 已設定" -ForegroundColor Green
} else {
  Write-Host "  略過 Vercel（未貼網址）" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "【步驟 3】觸發一次部署..." -ForegroundColor Green
& $gh workflow run deploy-production.yml --repo $Repo
Write-Host "  ✓ 已送出" -ForegroundColor Green
Write-Host ""
Write-Host "約數分鐘後用 Railway 網址測試；進度："
Write-Host "  https://github.com/$Repo/actions" -ForegroundColor White
Write-Host ""
Read-Host "完成！按 Enter 關閉"

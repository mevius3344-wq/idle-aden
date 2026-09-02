# 一鍵設定 GitHub 自動部署（中文引導）
# 用法：雙擊「幫我設定自動部署.bat」
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Repo = "mevius3344-wq/idle-aden"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location -LiteralPath $Root

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  躺著變強 — 自動部署一鍵設定" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "只要跟著做 2 次「複製 → 貼上 → Enter」，之後 push 就會自動更新手機版。"
Write-Host ""

# 找 gh
$gh = $null
foreach ($p in @(
  "C:\Program Files\GitHub CLI\gh.exe",
  "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe",
  "gh"
)) {
  if (Get-Command $p -ErrorAction SilentlyContinue) { $gh = $p; break }
}

if (-not $gh) {
  Write-Host "正在安裝 GitHub CLI（用來自動寫入密鑰）..." -ForegroundColor Yellow
  winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements 2>$null
  foreach ($p in @("C:\Program Files\GitHub CLI\gh.exe", "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe")) {
    if (Test-Path $p) { $gh = $p; break }
  }
}

if (-not $gh) {
  Write-Host ""
  Write-Host "無法自動安裝 GitHub CLI。" -ForegroundColor Red
  Write-Host "請手動開啟以下網址，把兩個 Secret 貼上去：" -ForegroundColor Yellow
  Write-Host "  https://github.com/$Repo/settings/secrets/actions" -ForegroundColor White
  Write-Host ""
  Read-Host "按 Enter 結束"
  exit 1
}

# 登入 GitHub
$auth = & $gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "【步驟 0】請在跳出的瀏覽器登入 GitHub（只要做一次）" -ForegroundColor Green
  & $gh auth login -h github.com -p https -w
}

Write-Host ""
Write-Host "【步驟 1】Render 部署網址" -ForegroundColor Green
Write-Host "  瀏覽器即將開啟 Render 設定頁..."
Write-Host "  → 點「Create Deploy Hook」→ 名稱隨便填 → 複製產生的網址"
Start-Process "https://dashboard.render.com"
Start-Sleep -Seconds 2
$renderHook = Read-Host "請貼上 Render Deploy Hook 網址（整串 https://...）"

if ($renderHook -and $renderHook -match "^https://") {
  & $gh secret set RENDER_DEPLOY_HOOK --body $renderHook --repo $Repo
  Write-Host "  ✓ Render 已設定" -ForegroundColor Green
} else {
  Write-Host "  略過 Render（未貼網址）" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "【步驟 2】Vercel 部署網址" -ForegroundColor Green
Write-Host "  瀏覽器即將開啟 Vercel 設定頁..."
Write-Host "  → Settings → Git → Deploy Hooks → Create Hook → Production"
Write-Host "  → 複製產生的網址"
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
Write-Host "【步驟 3】立刻觸發一次部署..." -ForegroundColor Green
& $gh workflow run deploy-production.yml --repo $Repo
Write-Host "  ✓ 已送出部署請求" -ForegroundColor Green
Write-Host ""
Write-Host "約 3～5 分鐘後，手機開遊戲應會自動更新到 v3.8.138。"
Write-Host "可在此查看進度："
Write-Host "  https://github.com/$Repo/actions" -ForegroundColor White
Write-Host ""
Read-Host "完成！按 Enter 關閉"

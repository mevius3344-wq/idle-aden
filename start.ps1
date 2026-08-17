$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 5173
$env:Path = "C:\Program Files\nodejs;" + $env:Path
$env:PORT = "$port"
$env:HOST = "0.0.0.0"

Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  ForEach-Object { if ($_.OwningProcess) { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }
Start-Sleep -Milliseconds 400

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "請先安裝 Node.js：https://nodejs.org/"
  exit 1
}

Set-Location $root
if (-not (Test-Path "node_modules\ws")) {
  Write-Host "安裝相依套件…"
  npm install --omit=dev --no-audit --no-fund
}

Write-Host "啟動雲端相容伺服器 http://127.0.0.1:$port"
Start-Process "http://127.0.0.1:$port/"
node server/index.js

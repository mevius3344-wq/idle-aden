# 本機啟動空白專案
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "Starting blank server on http://localhost:5173 ..."
node server/index.js

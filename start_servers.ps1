# BTC Analysis - Start All Servers
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Get local IP
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\." } |
       Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "  BTC Analysis - Starting Services"       -ForegroundColor Cyan
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host ""
Write-Host "  Local IP : $ip"                          -ForegroundColor Yellow
Write-Host "  FastAPI  : http://${ip}:8000"            -ForegroundColor Green
Write-Host "  Docs     : http://${ip}:8000/docs"       -ForegroundColor Green
Write-Host "  Streamlit: http://${ip}:8501"            -ForegroundColor Green
Write-Host ""
Write-Host "  [mobile/constants/config.ts]"            -ForegroundColor Yellow
Write-Host "  API_BASE_URL = `"http://${ip}:8000`""    -ForegroundColor Yellow
Write-Host ""

# Start FastAPI
Write-Host "[1] Starting FastAPI (port 8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$root'; py -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload"

Start-Sleep -Seconds 2

# Start Streamlit
Write-Host "[2] Starting Streamlit (port 8501)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$root'; py -m streamlit run app.py"

Write-Host ""
Write-Host "Both servers started!" -ForegroundColor Green
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

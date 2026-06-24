# IEEE Dashboard - Quick Start Script
# PowerShell version for Windows

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   IEEE Dashboard - Quick Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host

Write-Host "[1/3] Installing dependencies..." -ForegroundColor Yellow
& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✗ Failed to install dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "   ✓ Dependencies installed successfully" -ForegroundColor Green
Write-Host

Write-Host "[2/3] Restarting dashboard server..." -ForegroundColor Yellow
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run restart"
Start-Sleep 3
Write-Host "   ✓ Dashboard server restarted on http://localhost:3001" -ForegroundColor Green
Write-Host

Write-Host "[3/3] Opening login page in browser..." -ForegroundColor Yellow
Start-Process "http://localhost:3001/index.html"
Write-Host "   ✓ Login page opened in browser" -ForegroundColor Green
Write-Host

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   🚀 PROJECT IS NOW RUNNING!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host
Write-Host "✅ Dashboard Server: http://localhost:3001" -ForegroundColor Green
Write-Host "✅ Login Page: http://localhost:3001/index.html" -ForegroundColor Green
Write-Host
Write-Host "To stop the service, close this window or press Ctrl+C" -ForegroundColor Yellow
Write-Host

Read-Host "Press Enter to exit"

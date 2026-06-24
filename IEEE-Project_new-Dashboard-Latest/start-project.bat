@echo off
echo ========================================
echo    IEEE Dashboard - Server Startup
echo ========================================
echo.

echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo    ✗ Failed to install dependencies
    pause
    exit /b 1
)
echo    ✓ Dependencies installed successfully
echo.

echo [2/3] Restarting dashboard server...
start /B npm run restart
timeout /t 3 /nobreak >nul
echo    ✓ Dashboard server restarted on http://localhost:3001
echo.

echo [3/3] Opening login page in browser...
start "" "http://localhost:3001/index.html"
echo    ✓ Login page opened in browser
echo.

echo ========================================
echo    🚀 PROJECT IS NOW RUNNING!
echo ========================================
echo.
echo ✅ Dashboard Server: http://localhost:3001
echo ✅ Login Page: http://localhost:3001/index.html
echo.
echo To stop the service, close this window or press Ctrl+C
echo.
pause

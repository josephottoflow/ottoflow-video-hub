@echo off
title Product Video Dashboard
echo ==========================================
echo   Product Video Editor Dashboard
echo ==========================================
echo.

cd /d "%~dp0"

:: Kill anything already on port 3000
echo [*] Checking port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    echo [*] Killing PID %%a on port 3000...
    taskkill /F /PID %%a >nul 2>&1
)

:: Small delay to let the port free up
timeout /t 1 /nobreak >nul

echo [*] Starting dashboard on http://localhost:3000
echo.

:: Open browser after a short delay (gives Next.js time to boot)
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: Launch Next.js dev server
npx next dev --port 3000

pause

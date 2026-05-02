@echo off
title Video Auto-Watcher
echo ==========================================
echo   Auto Video Pipeline — Live Watcher
echo   Watching: input\ folder
echo   Output:   outputs\ folder
echo ==========================================
echo.
echo   Drop product photo folders into input\
echo   and videos will be generated automatically.
echo.
echo   Press Ctrl+C to stop.
echo.
cd /d "%~dp0"
npx tsx src/cli/watch-videos.ts
pause

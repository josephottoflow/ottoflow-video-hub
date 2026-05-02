@echo off
title Process All Product Videos
echo ==========================================
echo   Auto Video Pipeline — Batch Mode
echo ==========================================
echo.
cd /d "%~dp0"
echo [*] Scanning input\ folder for product photos...
echo [*] Building video data + rendering all templates...
echo.
npx tsx src/cli/process-videos.ts
echo.
echo [*] Done! Check the outputs\ folder.
pause

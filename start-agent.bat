@echo off
title Ottoflow Agent
cd /d "D:\tiktok-product-video-factory"
echo.
echo  =============================================
echo   Ottoflow Agent - Starting...
echo   Worker will start automatically.
echo   Minimize this window. Do NOT close it.
echo  =============================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Install from nodejs.org then try again.
  pause
  exit /b 1
)
node local-agent.js
echo.
echo  Agent stopped. See worker.log for details.
pause

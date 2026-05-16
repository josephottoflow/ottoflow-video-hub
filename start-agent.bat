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
node local-agent.js
pause

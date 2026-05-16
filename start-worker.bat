@echo off
title Ottoflow Render Worker
cd /d "D:\tiktok-product-video-factory"
echo.
echo  =============================================
echo   Ottoflow Render Worker - Starting...
echo  =============================================
echo.
echo  Keep this window open while rendering.
echo  You can minimize it — just don't close it.
echo.
npm run worker
pause

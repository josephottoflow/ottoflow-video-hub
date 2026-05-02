@echo off
echo ==========================================
echo  CINEMATIC VIDEO RENDER — Camping Chair
echo ==========================================
echo.
echo Rendering 27s cinematic video (1080x1920 @ 30fps)...
echo This may take 2-5 minutes depending on your CPU.
echo.
npx remotion render src/remotion/index.ts cinematic --props=cinematic-test-props.json --output=output/cinematic-camping-chair.mp4 --log=verbose
echo.
echo ==========================================
echo  RENDER COMPLETE
echo  Output: output\cinematic-camping-chair.mp4
echo ==========================================
pause

@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "%~dp0大肥鱼离线桌宠.exe" (
  echo Please extract the complete portable ZIP before launching.
  pause
  exit /b 1
)
start "" "%~dp0大肥鱼离线桌宠.exe" --compatible

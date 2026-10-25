@echo off
rem Mistville Overlay: double-click to start. It reads Torchlight: Infinite's log and shows its advice over the game.
title Mistville Overlay
cd /d "%~dp0"

set "ELECTRON=node_modules\electron\dist\electron.exe"

if not exist "%ELECTRON%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo.
    echo  Mistville Overlay needs Node.js the first time. Install the LTS version from https://nodejs.org
    echo  then double-click this file again.
    echo.
    pause
    exit /b 1
  )
  echo  First start: installing Electron, the program the overlay runs in. This takes a few minutes, once.
  call npm install --no-audit --no-fund
  if not exist "node_modules\electron\dist\electron.exe" call node node_modules\electron\install.js
)
if not exist "%ELECTRON%" set "ELECTRON=node_modules\electron\dist\electron.exe"
if not exist "%ELECTRON%" (
  echo.
  echo  Electron couldn't be installed. Check your internet connection and try again.
  pause
  exit /b 1
)

start "" "%ELECTRON%" "%~dp0."
exit /b 0

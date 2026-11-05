@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup.ps1"
if errorlevel 1 (
  echo.
  echo Setup did not complete. See START_HERE.txt, README_en.txt or README_ja.txt.
  pause
)

@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\aios-control.ps1" -Action Start
echo.
echo Lampstand Project startup check is complete.
echo This window may now be closed.
pause

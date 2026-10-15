@echo off
setlocal
title PDF
cd /d "%~dp0"
if not exist "runtime\pythonw.exe" (
  echo Extrae TODO el ZIP en una carpeta antes de abrir PDF.cmd.
  pause
  exit /b 1
)
start "" "%~dp0runtime\pythonw.exe" -I -B "%~dp0launcher.py"
endlocal

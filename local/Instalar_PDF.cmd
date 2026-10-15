@echo off
setlocal
title Instalar PDF
cd /d "%~dp0"
if not exist "runtime\pythonw.exe" (
  echo Extrae TODO el ZIP en una carpeta antes de instalar PDF.
  pause
  exit /b 1
)
start "" "%~dp0runtime\pythonw.exe" -I -B "%~dp0install.py"
endlocal

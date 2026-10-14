@echo off
setlocal
title PDF
cd /d "%~dp0"
if not exist "runtime\python.exe" (
  echo Extrae TODO el ZIP en una carpeta antes de abrir PDF.cmd.
  pause
  exit /b 1
)
"%~dp0runtime\python.exe" -I -B "%~dp0launcher.py"
if errorlevel 1 pause
endlocal

@echo off
setlocal
chcp 65001 >nul
title PDF - Comprobacion local del certificado
if not exist "%~dp0diagnosticar-p12.ps1" (
  echo Extrae TODO el ZIP en una carpeta antes de abrir este archivo.
  pause
  exit /b 1
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0diagnosticar-p12.ps1"
echo.
pause

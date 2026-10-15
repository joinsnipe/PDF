@echo off
setlocal
if not exist "%~dp0runtime\pythonw.exe" (
  echo Extrae TODO el ZIP antes de abrir PDF.
  pause
  exit /b 1
)
start "" "%~dp0runtime\pythonw.exe" -I -B "%~dp0install.py" --unregister
exit /b 0

@echo off
setlocal
cd /d "%~dp0"
if exist "runtime\pythonw.exe" start "" "%~dp0runtime\pythonw.exe" -I -B "%~dp0launcher.py" --stop
endlocal

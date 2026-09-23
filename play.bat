@echo off
cd /d "%~dp0"
set PY=python
where py >nul 2>nul && set PY=py
echo Starting 3SX Web at http://localhost:8030/  (close this window to stop)
start "" /b %PY% -m http.server 8030
timeout /t 1 /nobreak >nul
start "" http://localhost:8030/
pause >nul

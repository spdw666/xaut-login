@echo off
setlocal
set "APP_DIR=%~dp0"

where pythonw >nul 2>nul
if not errorlevel 1 (
  start "" pythonw "%APP_DIR%captcha-server.py"
  exit /b 0
)

where python >nul 2>nul
if not errorlevel 1 (
  start "" python "%APP_DIR%captcha-server.py"
  exit /b 0
)

where py >nul 2>nul
if not errorlevel 1 (
  start "" py "%APP_DIR%captcha-server.py"
  exit /b 0
)

echo [ERROR] Python was not found. Run "一键安装.bat" first.
pause
exit /b 1

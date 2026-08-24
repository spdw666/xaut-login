@echo off
where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Python not found. Install from https://www.python.org/downloads/
    echo         and check "Add Python to PATH", then run this again.
    pause
    exit /b 1
  )
  set PY=py
) else (
  set PY=python
)
echo Installing dependencies (takes a minute)...
%PY% -m pip install --disable-pip-version-check -r "%~dp0requirements.txt"
if errorlevel 1 ( echo [ERROR] pip install failed. & pause & exit /b 1 )
where pythonw >nul 2>nul && start "" pythonw "%~dp0captcha-server.py" || start "" %PY% "%~dp0captcha-server.py"
echo Done! OCR service started in background.
echo Now import xaut-login.user.js into Tampermonkey and open the login page.
pause

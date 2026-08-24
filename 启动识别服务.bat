@echo off
where pythonw >nul 2>nul && start "" pythonw "D:\xaut-login\captcha-server.py" || start "" python "D:\xaut-login\captcha-server.py"

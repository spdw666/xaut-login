@echo off
set SRC=%~dp0启动识别服务.exe
set DST=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\西理工验证码服务.lnk
if not exist "%SRC%" (echo [ERROR] 没找到 启动识别服务.exe，请把本文件放在它旁边再运行 & pause & exit /b 1)
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%DST%');$s.TargetPath='%SRC%';$s.WorkingDirectory='%~dp0';$s.Save()"
echo 完成！已设置开机自启（登录 Windows 后自动启动识别服务）。
pause

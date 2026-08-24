@echo off
setlocal
set "XAUT_APP_DIR=%~dp0"

rem Keep this file ASCII-only so it works in every Windows console code page.
powershell -NoProfile -Command "$apps=@(Get-ChildItem -LiteralPath $env:XAUT_APP_DIR -Filter '*.exe' -File); if($apps.Count -ne 1){ Write-Error 'Expected exactly one service .exe beside this script.'; exit 2 }; $dst=Join-Path ([Environment]::GetFolderPath('Startup')) 'XAUT Captcha Service.lnk'; $s=(New-Object -ComObject WScript.Shell).CreateShortcut($dst); $s.TargetPath=$apps[0].FullName; $s.WorkingDirectory=$apps[0].DirectoryName; $s.Save()"
if errorlevel 1 (
  echo [ERROR] Startup shortcut was not created. Keep this script beside one service .exe.
  pause
  exit /b 1
)

echo Done. The service will start when you sign in to Windows.
pause

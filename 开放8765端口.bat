@echo off
:: 以管理员身份运行，为 8765 端口添加入站放行规则（仅专用网络 profile）
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator privileges...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
netsh advfirewall firewall delete rule name="XAUT OCR 8765" >nul 2>&1
netsh advfirewall firewall add rule name="XAUT OCR 8765" dir=in action=allow protocol=TCP localport=8765 profile=private
echo.
echo Done. Port 8765 is now open for the Private network.
echo Public network profiles are not changed by this script.
echo Verify with:  netstat -an | findstr 8765
pause

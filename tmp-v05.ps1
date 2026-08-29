$ErrorActionPreference = 'Continue'
git -C D:/xaut-login add -A
git -C D:/xaut-login commit -m "Support calendar-style UL/LI timetable grid in iframe (v0.5)"
git -C D:/xaut-login push origin main
$s = (git -C D:/xaut-login rev-parse HEAD).Trim()
Write-Output ("SHA: " + $s)
try {
  $resp = Invoke-WebRequest -Uri ('https://cdn.jsdelivr.net/gh/spdw666/xaut-login@' + $s + '/xaut-login.user.js') -TimeoutSec 20 -UseBasicParsing
  $v = [regex]::Match($resp.Content, '@version[ 	]+([0-9.]+)').Groups[1].Value
  Write-Output ('pinned jsDelivr: v' + $v)
} catch { Write-Output ('verify FAILED: ' + $_.Exception.Message) }

$ErrorActionPreference = 'Continue'
git -C D:/xaut-login add -A
git -C D:/xaut-login commit -m "Fix @version metadata to 0.5"
git -C D:/xaut-login push origin main
git -C D:/xaut-login status --short
$s = (git -C D:/xaut-login rev-parse HEAD).Trim()
Write-Output ("SHA: " + $s)
try {
  $resp = Invoke-WebRequest -Uri ('https://raw.githubusercontent.com/spdw666/xaut-login/main/xaut-login.user.js') -TimeoutSec 20 -UseBasicParsing
  $v = [regex]::Match($resp.Content, '@version[ 	]+([0-9.]+)').Groups[1].Value
  Write-Output ('raw: v' + $v + ' len=' + $resp.Content.Length)
} catch { Write-Output ('raw FAILED: ' + $_.Exception.Message) }

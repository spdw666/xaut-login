# 西理工教务系统登录助手

> 本地运行的验证码识别服务 + Tampermonkey 脚本：自动填写登录信息、每天自动检查云端更新、一键导出每周课表。

![Platform](https://img.shields.io/badge/platform-Windows%2010%20%2F%2011-0f6cbd?style=flat-square)
![Runtime](https://img.shields.io/badge/runtime-local%20only-0b8f66?style=flat-square)
![Version](https://img.shields.io/badge/version-0.7.5-7c3aed?style=flat-square)

## 功能

- **自动登录信息**：兼容两种登录页——新版登录页（智慧教学管理与服务平台，无验证码）自动填账号密码；旧版登录页自动识别验证码并填入
- **手机可用**：识别服务支持局域网监听（`启动识别服务(局域网).bat`），手机 Edge 装 Tampermonkey 后在“登录助手”设置里填电脑的局域网地址即可识别验证码
- **云更新**：脚本每天自动检查一次 GitHub 最新版本，有新版本时右下角弹提示，点击即可更新（Tampermonkey 也会按 `@updateURL` 自动检测）
- **按周导出课表**：在教务系统“个人课表”页面右下角点击“📅 导出课表”，可直接下载 A4 横向 PDF，也可选择格式化 Excel 工作簿或打印网页版课表

## 开始使用

| 你使用的是 | 推荐方式 |
| --- | --- |
| 普通用户 | 前往 [Releases](../../releases) 下载最新的 `xaut-login.user.js`，在 Tampermonkey 中确认安装。 |
| 开发者 / 源码用户 | 克隆本仓库，双击 `一键安装.bat`，再导入 `xaut-login.user.js`。 |

### 首次配置

1. 在浏览器中安装 Tampermonkey。
2. 从 Tampermonkey 的“实用工具”导入 `xaut-login.user.js`。
3. 打开教务系统登录页；脚本会显示简洁的设置卡片，用于填写学号和密码。
4. 服务启动后，访问 `http://127.0.0.1:8765/health`。出现 `{"status":"ok"}` 即表示服务正常。

之后登录页右下角会有“登录助手”按钮；可随时打开它更新本机保存的账号或密码。

## 项目结构

```text
captcha-server.py       本地 OCR 服务（仅监听 127.0.0.1）
xaut-login.user.js     Tampermonkey 脚本与首次配置界面
一键安装.bat            安装 Python 依赖并启动源码服务
启动识别服务.bat        从当前文件夹启动源码服务
安装开机自启.bat        为 Release 中唯一的 .exe 创建开机启动快捷方式
requirements.txt        Python 依赖范围
```

## 隐私与安全边界

- OCR 服务默认仅监听本机回环地址 `127.0.0.1`，不会对局域网或互联网开放。
- **局域网模式**（`启动识别服务(局域网).bat`，`XAUT_HOST=0.0.0.0`）会向同一网络内的所有设备开放识别接口（仅接收图片、返回验证码），请在可信网络使用，用完可切回本机模式。
- 脚本只把验证码图片发送给本机 OCR 服务；账号和密码保存在浏览器的 Tampermonkey 本地存储中。
- 请仅在获得授权且符合学校教务系统规则的情况下使用，不要用于批量访问或绕过系统管理要求。

## 常见问题

**如何修改账号或密码？** 点击登录页右下角的“登录助手”，保存新的账号信息即可。

**验证码没有自动填写？** 先打开 `http://127.0.0.1:8765/health` 检查服务；随后确认 Tampermonkey 脚本已启用。

**如何导出每周课表？** 登录教务系统后打开“个人课表”页面，等课表加载完成后，右下角会出现绿色“📅 导出课表”按钮。选择第几周并点击“导出”后，脚本会调用页面本身的周次切换控件、等课表刷新完成，再下载 CSV（带 UTF-8 BOM，Excel 直接打开中文不乱码）。

**手机上能用吗？** 可以，三种方式任选：
- **手机本地识别（推荐，任何网络可用）**：手机先装 Termux——下载地址：F-Droid（[f-droid.org/packages/com.termux](https://f-droid.org/packages/com.termux/)，推荐）或 [GitHub Releases](https://github.com/termux/termux-app/releases)（Google Play 版已停止维护）。在 Termux 里执行 `curl -fLO https://raw.githubusercontent.com/spdw666/xaut-login/main/termux-setup-ocr.sh && bash termux-setup-ocr.sh`（一键安装识别服务），服务跑在手机自己的 `127.0.0.1:8765`，脚本设置里填 `http://127.0.0.1:8765/predict`，不依赖电脑与网络。
- **同 Wi-Fi 直连电脑**：电脑双击 `启动识别服务(局域网).bat`（首次再双击 `开放8765端口.bat`）；手机脚本设置里填 `http://电脑局域网IP:8765/predict`（电脑 IP 用 `ipconfig` 查看）。
- **不同网络**：异地组网（蒲公英/ZeroTier，防火墙已放行所有配置文件）后填电脑虚拟 IP，或手机本地识别。
新版登录页无验证码，手机上不配服务地址也能自动填账号密码。

**脚本怎么更新？** 脚本每天自动检查一次新版本；有新版本时右下角会弹出提示，点击即可安装。也可以在 Tampermonkey 管理面板手动“检查更新”。更新源为 GitHub 的最新 Release；每次发布新版 Release 后，所有已安装脚本都会从同一个稳定地址获取更新，不依赖 `main` 分支或 CDN 缓存。

**源码放在别的磁盘可以吗？** 可以。所有源码启动脚本都使用自身所在目录，不再依赖固定的 `D:` 路径。

## 开发检查

提交前可运行：

```powershell
py -m py_compile captcha-server.py
node --check xaut-login.user.js
```

GitHub Actions 会在推送至 `main` 或创建 Pull Request 时执行相同的语法检查。

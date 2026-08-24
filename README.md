# 西理工教务系统登录助手

> 本地运行的验证码识别服务 + Tampermonkey 脚本，帮助用户更快填写教务系统登录信息。

![Platform](https://img.shields.io/badge/platform-Windows%2010%20%2F%2011-0f6cbd?style=flat-square)
![Runtime](https://img.shields.io/badge/runtime-local%20only-0b8f66?style=flat-square)
![Version](https://img.shields.io/badge/version-0.2-7c3aed?style=flat-square)

## 开始使用

| 你使用的是 | 推荐方式 |
| --- | --- |
| 普通用户 | 前往 [Releases](../../releases) 下载 `xaut-login-pack.zip`，并阅读包内 `使用说明书.txt`。 |
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

- OCR 服务仅监听本机回环地址 `127.0.0.1`，不会对局域网或互联网开放。
- 脚本只把验证码图片发送给本机 OCR 服务；账号和密码保存在浏览器的 Tampermonkey 本地存储中。
- 请仅在获得授权且符合学校教务系统规则的情况下使用，不要用于批量访问或绕过系统管理要求。

## 常见问题

**如何修改账号或密码？** 点击登录页右下角的“登录助手”，保存新的账号信息即可。

**验证码没有自动填写？** 先打开 `http://127.0.0.1:8765/health` 检查服务；随后确认 Tampermonkey 脚本已启用。

**源码放在别的磁盘可以吗？** 可以。所有源码启动脚本都使用自身所在目录，不再依赖固定的 `D:` 路径。

## 开发检查

提交前可运行：

```powershell
py -m py_compile captcha-server.py
node --check xaut-login.user.js
```

GitHub Actions 会在推送至 `main` 或创建 Pull Request 时执行相同的语法检查。

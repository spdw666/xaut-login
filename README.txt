西理工教务系统自动登录（免验证码）使用说明
=================================================

原理：本地运行一个 ddddocr 验证码识别服务(127.0.0.1:8765)，配合 Tampermonkey
油猴脚本。打开登录页后脚本自动填好学号/密码，并在验证码图片每次刷新时自动
识别新验证码填入——你只需要点一下"登 录"。

安装（新电脑三步）：
0. 首次需要 Python：https://www.python.org/downloads/ 下载安装，
   安装时务必勾选 "Add Python to PATH"。
   或者直接双击 "一键安装.bat"，它会自动装依赖并启动服务。
1. 启动识别服务：双击 "启动识别服务.bat"（闪一下窗口即后台运行，无窗口）。
   开机自启：启动文件夹(shell:startup)里已有"西理工验证码服务.vbs"隐藏启动器，
   登录 Windows 时自动启动服务。删掉该 .vbs 即取消自启。
2. 装 Tampermonkey（Edge 扩展）：
   https://microsoftedge.microsoft.com/addons 搜索 "Tampermonkey" 安装。
3. 装脚本：Tampermonkey 图标 → 管理面板 → 实用工具 → "从文件导入" →
   选择 xaut-login.user.js → 安装。
   （也可以：管理面板 → 新建脚本 → 粘贴文件全部内容 → Ctrl+S）

使用：打开 https://jwgl.xaut.edu.cn/jsxsd/ 登录页 → 首次会弹窗问学号和密码
（只存本机，各人填各人的）→ 之后每次打开自动填好账号密码和验证码 → 点"登 录"。
若识别错了登录失败：点一下验证码图片换一张，会自动重新识别填入。

转交给别人：
- 把整个文件夹打包发给对方（xaut-login-pack.zip），让对方按上面三步装。
- 只发 xaut-login.user.js 不够——识别服务必须在对方电脑上本地运行。
- 脚本和 zip 里都不含任何人的学号密码，可放心转发。

改学号/密码：Tampermonkey 管理面板 → 编辑脚本 → 删除浏览器控制台里
GM_setValue 存的值，或直接删脚本重装。

常见问题：
- 打开登录页验证码没自动填：确认服务已启动（访问
  http://127.0.0.1:8765/predict 应返回 405），以及脚本已启用（图标彩色）。
- "一键安装.bat"报 Python 找不到：先装 Python 并勾选 Add to PATH。

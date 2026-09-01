#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# 西理工教务验证码识别服务 - Termux 手机本地一键安装脚本
# 用途：在手机 Termux 里直接运行识别服务，手机连自己的
#       127.0.0.1:8765 即可，不需要电脑、局域网或任何组网，
#       4G/5G/任何 Wi-Fi 下都能用。
# 注意：本脚本由仓库维护者编写，未在真机实测；某一步失败时
#       请把终端里的错误信息反馈给维护者。
# 使用：先安装 Termux（F-Droid: https://f-droid.org/packages/com.termux/
#       或 GitHub: https://github.com/termux/termux-app/releases），
#       然后在 Termux 里执行：
#       curl -fLO https://raw.githubusercontent.com/spdw666/xaut-login/main/termux-setup-ocr.sh
#       bash termux-setup-ocr.sh
# ============================================================

set -e

echo "=== 1/5 更新 Termux 软件源（首次运行较慢，请耐心等待）==="
pkg update -y
pkg upgrade -y

echo "=== 2/5 启用 x11 扩展仓库（opencv 的 Python 绑定在这里）==="
pkg install -y x11-repo
pkg update

echo "=== 3/5 安装 Python 及识别依赖（走 Termux 官方包，避免 pip 没有安卓预编译包）==="
# opencv 的 Python 绑定包名是 opencv-python（在 x11-repo 里）；
# onnxruntime / numpy / pillow 都在主仓库。
# 若某包提示找不到，先执行 termux-change-repo 换源（选国内镜像）再重试。
pkg install -y python opencv-python onnxruntime python-numpy python-pillow

echo "=== 4/5 安装 ddddocr（不装依赖，依赖已由上面的 Termux 包提供）==="
pip install --no-deps ddddocr

echo "=== 5/5 下载识别服务源码并启动 ==="
cd ~
curl -fLO https://raw.githubusercontent.com/spdw666/xaut-login/main/captcha-server.py

echo ""
echo "=============================================="
echo " 安装完成！正在启动识别服务..."
echo " 服务地址：http://127.0.0.1:8765 (手机本机)"
echo " 请保持本窗口开着；然后到浏览器脚本的"
echo " 「登录助手」设置里把识别服务地址填为"
echo " http://127.0.0.1:8765/predict"
echo "=============================================="
echo ""
python captcha-server.py

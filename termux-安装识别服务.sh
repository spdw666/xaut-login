#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# 西理工教务验证码识别服务 - Termux 手机本地一键安装脚本
# 用途：在手机 Termux 里直接运行识别服务，手机连自己的
#       127.0.0.1:8765 即可，不需要电脑、局域网或任何组网，
#       4G/5G/任何 Wi-Fi 下都能用。
# 注意：本脚本由仓库维护者编写，未在真机实测；某一步失败时
#       请把终端里的错误信息反馈给维护者。
# 使用：把本文件放到手机 Termux 可访问的位置后执行
#       bash termux-安装识别服务.sh
# ============================================================

set -e

echo "=== 1/4 更新 Termux 软件源（首次运行较慢，请耐心等待）==="
pkg update -y
pkg upgrade -y

echo "=== 2/4 安装 Python 及识别依赖（走 Termux 官方包，避免 pip 没有安卓预编译包）==="
# onnxruntime / opencv / numpy / pillow 都有 Termux 预编译包；
# 若某包提示找不到，先执行 termux-change-repo 换源（选国内镜像）再重试。
pkg install -y python python-opencv onnxruntime python-numpy python-pillow

echo "=== 3/4 安装 ddddocr（不装依赖，依赖已由上面的 Termux 包提供）==="
pip install --no-deps ddddocr

echo "=== 4/4 下载识别服务源码并启动 ==="
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

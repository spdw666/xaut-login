# -*- coding: utf-8 -*-
# XAUT 教务系统验证码本地识别服务 (ddddocr + Flask)
# 启动: python captcha-server.py   端口: 127.0.0.1:8765
from flask import Flask, request, jsonify
import ddddocr, base64, sys, os, traceback

ocr = ddddocr.DdddOcr(show_ad=False)
app = Flask(__name__)

@app.post("/predict")
def predict():
    data = request.get_json(silent=True) or {}
    raw = base64.b64decode(data["img"]) if data.get("img") else request.data
    return jsonify(code=ocr.classification(raw))

if __name__ == "__main__":
    try:
        app.run(host="127.0.0.1", port=8765)
    except OSError:
        pass  # 端口被占用=服务已在运行(开机自启与手动启动并存时)，静默退出
    except Exception:
        # 无窗口模式下把启动失败原因写到 exe 旁边，方便排查
        try:
            base = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(os.path.abspath(__file__))
            with open(os.path.join(base, "captcha-server.log"), "w", encoding="utf-8") as f:
                traceback.print_exc(file=f)
        except Exception:
            pass

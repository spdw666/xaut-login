# -*- coding: utf-8 -*-
"""XAUT 教务系统验证码本地识别服务。"""

import os
import sys
import traceback
from base64 import b64decode
from binascii import Error as Base64Error

import ddddocr
from flask import Flask, jsonify, request

ocr = ddddocr.DdddOcr(show_ad=False)
app = Flask(__name__)
MAX_IMAGE_BYTES = 2 * 1024 * 1024


@app.get("/health")
def health():
    """Return a simple, browser-friendly readiness check."""
    return jsonify(status="ok")


@app.post("/predict")
def predict():
    data = request.get_json(silent=True)
    if data is not None:
        if not isinstance(data, dict) or not data.get("img"):
            return jsonify(error="an image is required"), 400
        try:
            raw = b64decode(data["img"], validate=True)
        except (Base64Error, TypeError):
            return jsonify(error="img must be valid base64 data"), 400
    else:
        raw = request.get_data()

    if not raw:
        return jsonify(error="an image is required"), 400
    if len(raw) > MAX_IMAGE_BYTES:
        return jsonify(error="image is too large"), 413

    try:
        return jsonify(code=ocr.classification(raw))
    except Exception:
        return jsonify(error="the image could not be recognized"), 422


if __name__ == "__main__":
    try:
        app.run(host="127.0.0.1", port=8765)
    except OSError:
        # 开机自启与手动启动同时发生时，已有服务继续运行即可。
        pass
    except Exception:
        # 无窗口模式下把启动失败原因写到 exe 旁边，方便排查
        try:
            base = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(os.path.abspath(__file__))
            with open(os.path.join(base, "captcha-server.log"), "w", encoding="utf-8") as f:
                traceback.print_exc(file=f)
        except Exception:
            pass

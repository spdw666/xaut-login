// ==UserScript==
// @name         西理工教务登录助手
// @namespace    xaut-local
// @version      0.2
// @description  本地 OCR 识别验证码，并提供简洁的账号设置界面
// @match        https://jwgl.xaut.edu.cn/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      127.0.0.1
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const STORAGE = { uid: "uid", password: "pwd" };
  const SERVICE_URL = "http://127.0.0.1:8765/predict";
  const input = document.getElementById("RANDOMCODE");
  const accountInput = document.getElementById("userAccount");
  const passwordInput = document.getElementById("userPassword");
  const captchaImage = document.getElementById("SafeCodeImg");

  if (!input || !captchaImage) return;

  let failures = 0;
  let launcher;

  function getCredentials() {
    return {
      uid: GM_getValue(STORAGE.uid, ""),
      password: GM_getValue(STORAGE.password, ""),
    };
  }

  function fillCredentials() {
    const credentials = getCredentials();
    if (accountInput && credentials.uid) accountInput.value = credentials.uid;
    if (passwordInput && credentials.password) passwordInput.value = credentials.password;
  }

  function setStatus(text, state) {
    if (!launcher) return;
    launcher.dataset.state = state || "idle";
    launcher.querySelector(".xaut-login-assistant__status").textContent = text;
  }

  function closeSettings() {
    const modal = document.getElementById("xaut-login-assistant-modal");
    if (modal) modal.remove();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    }[character]));
  }

  function openSettings() {
    closeSettings();
    const credentials = getCredentials();
    const modal = document.createElement("div");
    modal.id = "xaut-login-assistant-modal";
    modal.innerHTML = `
      <style>
        #xaut-login-assistant-modal { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; padding: 20px; background: rgba(8, 20, 43, .48); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        #xaut-login-assistant-modal * { box-sizing: border-box; }
        .xaut-login-assistant__card { width: min(100%, 390px); overflow: hidden; border: 1px solid rgba(255, 255, 255, .38); border-radius: 18px; background: #fff; box-shadow: 0 24px 70px rgba(8, 20, 43, .28); }
        .xaut-login-assistant__header { padding: 24px 26px 21px; color: #fff; background: linear-gradient(135deg, #0f4c81, #236fb6); }
        .xaut-login-assistant__eyebrow { margin: 0 0 8px; opacity: .78; font-size: 12px; letter-spacing: .08em; }
        .xaut-login-assistant__title { margin: 0; font-size: 22px; letter-spacing: .01em; }
        .xaut-login-assistant__body { padding: 24px 26px 26px; color: #172033; }
        .xaut-login-assistant__hint { margin: 0 0 20px; color: #61708a; font-size: 13px; line-height: 1.65; }
        .xaut-login-assistant__label { display: block; margin: 14px 0 7px; font-size: 13px; font-weight: 650; }
        .xaut-login-assistant__input { width: 100%; height: 42px; border: 1px solid #cbd5e1; border-radius: 9px; padding: 0 12px; color: #172033; font-size: 14px; outline: none; transition: border-color .15s, box-shadow .15s; }
        .xaut-login-assistant__input:focus { border-color: #236fb6; box-shadow: 0 0 0 3px rgba(35, 111, 182, .15); }
        .xaut-login-assistant__actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 23px; }
        .xaut-login-assistant__button { min-width: 84px; height: 38px; border: 0; border-radius: 9px; padding: 0 15px; cursor: pointer; font-size: 14px; font-weight: 650; }
        .xaut-login-assistant__button--ghost { color: #52617a; background: #eef2f7; }
        .xaut-login-assistant__button--primary { color: #fff; background: #1769aa; }
        .xaut-login-assistant__button--primary:hover { background: #0f5b96; }
      </style>
      <section class="xaut-login-assistant__card" role="dialog" aria-modal="true" aria-labelledby="xaut-login-assistant-title">
        <header class="xaut-login-assistant__header">
          <p class="xaut-login-assistant__eyebrow">XAUT LOGIN ASSISTANT</p>
          <h2 class="xaut-login-assistant__title" id="xaut-login-assistant-title">设置登录信息</h2>
        </header>
        <form class="xaut-login-assistant__body">
          <p class="xaut-login-assistant__hint">信息仅保存在当前浏览器的 Tampermonkey 本地存储中，不会发送给识别服务。</p>
          <label class="xaut-login-assistant__label" for="xaut-login-assistant-uid">学号</label>
          <input class="xaut-login-assistant__input" id="xaut-login-assistant-uid" required autocomplete="username" value="${escapeHtml(credentials.uid)}">
          <label class="xaut-login-assistant__label" for="xaut-login-assistant-password">密码</label>
          <input class="xaut-login-assistant__input" id="xaut-login-assistant-password" type="password" required autocomplete="current-password" value="${escapeHtml(credentials.password)}">
          <div class="xaut-login-assistant__actions">
            <button class="xaut-login-assistant__button xaut-login-assistant__button--ghost" type="button" data-action="cancel">取消</button>
            <button class="xaut-login-assistant__button xaut-login-assistant__button--primary" type="submit">保存并填入</button>
          </div>
        </form>
      </section>`;

    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.dataset.action === "cancel") closeSettings();
    });
    modal.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const uid = modal.querySelector("#xaut-login-assistant-uid").value.trim();
      const password = modal.querySelector("#xaut-login-assistant-password").value;
      if (!uid || !password) return;
      GM_setValue(STORAGE.uid, uid);
      GM_setValue(STORAGE.password, password);
      fillCredentials();
      closeSettings();
      setStatus("账号信息已填入", "ready");
      predict();
    });
    document.body.appendChild(modal);
    modal.querySelector("#xaut-login-assistant-uid").focus();
  }

  function createLauncher() {
    launcher = document.createElement("button");
    launcher.type = "button";
    launcher.id = "xaut-login-assistant-launcher";
    launcher.dataset.state = "idle";
    launcher.title = "打开登录助手设置";
    launcher.innerHTML = `
      <style>
        #xaut-login-assistant-launcher { position: fixed; right: 22px; bottom: 22px; z-index: 2147483646; display: flex; align-items: center; gap: 9px; border: 0; border-radius: 999px; padding: 11px 15px; color: #fff; background: #0f4c81; box-shadow: 0 10px 25px rgba(15, 76, 129, .3); cursor: pointer; font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; transition: transform .15s, background .15s; }
        #xaut-login-assistant-launcher:hover { transform: translateY(-2px); background: #0b3e69; }
        #xaut-login-assistant-launcher[data-state="ready"] { background: #0b7a61; }
        #xaut-login-assistant-launcher[data-state="error"] { background: #b45309; }
        .xaut-login-assistant__dot { width: 8px; height: 8px; border-radius: 50%; background: #9ee9d7; box-shadow: 0 0 0 3px rgba(158, 233, 215, .18); }
      </style>
      <span class="xaut-login-assistant__dot" aria-hidden="true"></span>
      <span class="xaut-login-assistant__status">登录助手</span>`;
    launcher.addEventListener("click", openSettings);
    document.body.appendChild(launcher);
  }

  function retryPrediction() {
    if (failures++ < 3) {
      setStatus("正在重试识别…", "idle");
      setTimeout(predict, 800);
    } else {
      setStatus("请检查本地识别服务", "error");
    }
  }

  function predict() {
    if (!captchaImage.naturalWidth) {
      setStatus("正在加载验证码…", "idle");
      return setTimeout(predict, 300);
    }

    const canvas = document.createElement("canvas");
    canvas.width = captchaImage.naturalWidth;
    canvas.height = captchaImage.naturalHeight;
    canvas.getContext("2d").drawImage(captchaImage, 0, 0);
    setStatus("正在识别验证码…", "idle");

    GM_xmlhttpRequest({
      method: "POST",
      url: SERVICE_URL,
      timeout: 8000,
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ img: canvas.toDataURL("image/png").split(",")[1] }),
      onload(response) {
        try {
          const code = JSON.parse(response.responseText).code;
          if (response.status >= 200 && response.status < 300 && /^[0-9a-zA-Z]{4,6}$/.test(code)) {
            input.value = code;
            failures = 0;
            setStatus("验证码已填入", "ready");
            return;
          }
        } catch (_) {
          // The retry branch below gives users a useful status without interrupting the page.
        }
        retryPrediction();
      },
      onerror: retryPrediction,
      ontimeout: retryPrediction,
    });
  }

  createLauncher();
  fillCredentials();
  captchaImage.addEventListener("load", () => {
    failures = 0;
    setTimeout(predict, 160);
  });
  new MutationObserver(() => {
    failures = 0;
    setTimeout(predict, 200);
  }).observe(captchaImage, { attributes: true, attributeFilter: ["src"] });

  if (!getCredentials().uid || !getCredentials().password) openSettings();
  else setTimeout(predict, 300);
})();

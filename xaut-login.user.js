// ==UserScript==
// @name         西理工教务登录助手
// @namespace    xaut-local
// @version      0.3
// @description  本地 OCR 识别验证码 + 云更新检查 + 一键导出每周课表
// @match        https://jwgl.xaut.edu.cn/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      127.0.0.1
// @connect      cdn.jsdelivr.net
// @connect      raw.githubusercontent.com
// @updateURL    https://cdn.jsdelivr.net/gh/spdw666/xaut-login@main/xaut-login.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/spdw666/xaut-login@main/xaut-login.user.js
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

  // ================= 云更新（每天自动检查一次） =================
  const UPDATE_URL = "https://cdn.jsdelivr.net/gh/spdw666/xaut-login@main/xaut-login.user.js";
  const UPDATE_FALLBACK_URL = "https://raw.githubusercontent.com/spdw666/xaut-login/main/xaut-login.user.js";
  const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000;

  function compareVersions(a, b) {
    const pa = String(a).split(".").map(Number);
    const pb = String(b).split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pa[i] || 0) - (pb[i] || 0);
      if (diff) return diff > 0 ? 1 : -1;
    }
    return 0;
  }

  function showToast(message, onClick) {
    const toast = document.createElement("div");
    toast.id = "xaut-login-toast";
    toast.innerHTML = `
      <style>
        #xaut-login-toast { position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%); z-index: 2147483647; max-width: min(92vw, 480px); padding: 11px 18px; border-radius: 10px; color: #fff; background: rgba(15, 76, 129, .94); box-shadow: 0 12px 32px rgba(8, 20, 43, .3); font: 600 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; text-align: center; cursor: ${onClick ? "pointer" : "default"}; }
        #xaut-login-toast:hover { background: rgba(15, 76, 129, 1); }
      </style>
      <span>${message}</span>`;
    if (onClick) toast.addEventListener("click", onClick);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 20000);
  }

  function checkForUpdate() {
    const lastCheckedAt = GM_getValue("xautUpdateCheckedAt", 0);
    if (Date.now() - lastCheckedAt < UPDATE_CHECK_INTERVAL) return;
    GM_setValue("xautUpdateCheckedAt", Date.now());

    const probe = (url, fallbackUrl) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: 10000,
        onload(response) {
          const match = /@version\s+([0-9.]+)/.exec(response.responseText || "");
          if (match && compareVersions(match[1], GM_info.script.version) > 0) {
            showToast(
              `发现新版本 v${match[1]}（当前 v${GM_info.script.version}），点击更新`,
              () => window.open(url, "_blank")
            );
          }
        },
        onerror: () => { if (fallbackUrl) probe(fallbackUrl, null); },
        ontimeout: () => { if (fallbackUrl) probe(fallbackUrl, null); },
      });
    };
    probe(UPDATE_URL, UPDATE_FALLBACK_URL);
  }

  // ================= 每周课表导出 =================
  function findTimetableTable() {
    const direct = document.getElementById("kbtable");
    if (direct) return direct;
    for (const table of document.querySelectorAll("table")) {
      const firstRow = table.querySelector("tr");
      if (firstRow && /节次/.test(firstRow.textContent) && /星期一/.test(firstRow.textContent)) return table;
    }
    return null;
  }

  function cellText(cell) {
    const content = cell.querySelector(".kbcontent, .kbcontent1, .kbcontent2");
    return ((content || cell).innerText || "").replace(/\s+/g, " ").trim();
  }

  function buildTimetableCsv(table) {
    const rows = [...table.querySelectorAll("tr")];
    const headerCells = [...rows[0].querySelectorAll("th, td")].map((c) => (c.innerText || "").trim());
    const dayCount = headerCells.length - 1;
    const lines = [[headerCells[0] || "节次", ...headerCells.slice(1, 1 + dayCount)]];
    for (let i = 1; i < rows.length; i++) {
      const cells = [...rows[i].querySelectorAll("th, td")];
      const label = (cells[0].innerText || "").split("\n")[0].trim();
      if (!/^第?\s*\d+(\s*-\s*\d+)?\s*节/.test(label)) continue; // 跳过午休等非课节行
      const row = [label];
      for (let d = 1; d <= dayCount; d++) row.push(cells[d] ? cellText(cells[d]) : "");
      lines.push(row);
    }
    // 带 BOM 的 UTF-8，Excel 直接打开中文不乱码
    return "\uFEFF" + lines.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  }

  function exportTimetable() {
    const table = findTimetableTable();
    if (!table) {
      showToast("未找到课表，请先打开教务系统的课表页面");
      return;
    }
    const csv = buildTimetableCsv(table);
    if (csv.replace(/\uFEFF/, "").trim().length < 20) {
      showToast("课表内容为空，请先在课表页面选择学年学期");
      return;
    }
    const xnm = document.getElementById("xnm");
    const xqm = document.getElementById("xqm");
    const semester = [xnm && xnm.value, xqm && xqm.selectedOptions[0] && xqm.selectedOptions[0].textContent.trim()]
      .filter(Boolean).join("-");
    const name = (semester || String(new Date().getFullYear())).replace(/[\\/:*?"<>|]/g, "_");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `课表_${name}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast("课表已导出，请查看浏览器下载文件（可用 Excel 打开）");
  }

  function initTimetableExport() {
    let attempts = 0;
    const timer = setInterval(() => {
      if (findTimetableTable()) {
        clearInterval(timer);
        const button = document.createElement("button");
        button.type = "button";
        button.id = "xaut-login-export-btn";
        button.textContent = "📅 导出课表";
        button.title = "导出当前每周课表为 CSV（Excel 可直接打开）";
        button.style.cssText = "position:fixed;right:22px;bottom:22px;z-index:2147483646;border:0;border-radius:999px;padding:11px 15px;color:#fff;background:#0b7a61;box-shadow:0 10px 25px rgba(11,122,97,.3);cursor:pointer;font:600 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;transition:transform .15s,background .15s";
        button.addEventListener("mouseenter", () => { button.style.background = "#086a54"; });
        button.addEventListener("mouseleave", () => { button.style.background = "#0b7a61"; });
        button.addEventListener("click", exportTimetable);
        document.body.appendChild(button);
      } else if (++attempts > 20) {
        clearInterval(timer); // 约 10 秒内未出现课表则放弃（非课表页面）
      }
    }, 500);
  }

  // 每个页面都执行：云更新检查 + 课表导出按钮
  checkForUpdate();
  initTimetableExport();

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

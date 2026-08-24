// ==UserScript==
// @name         西理工教务验证码自动填充
// @namespace    xaut-local
// @version      0.1
// @description  自动填学号密码 + 本地ddddocr识别验证码，打开登录页直接点"登 录"
// @match        https://jwgl.xaut.edu.cn/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      127.0.0.1
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";
  var inp = document.getElementById("RANDOMCODE");
  if (!inp) return; // 非登录页（已登录/其他页面）直接跳过

  // 首次运行询问学号密码，之后存本地(Tampermonkey存储)，不传任何服务器
  if (!GM_getValue("uid")) {
    var uid = prompt("西理工教务：请输入学号");
    var pwd = uid ? prompt("请输入密码") : null;
    if (uid && pwd) { GM_setValue("uid", uid); GM_setValue("pwd", pwd); }
  }
  var u = document.getElementById("userAccount");
  var p = document.getElementById("userPassword");
  if (u && GM_getValue("uid")) { u.value = GM_getValue("uid"); p.value = GM_getValue("pwd"); }

  var img = document.getElementById("SafeCodeImg");
  if (!img) return;
  var fails = 0;

  function predict() {
    if (!img.naturalWidth) return setTimeout(predict, 300); // 等图片加载完
    var c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    GM_xmlhttpRequest({
      method: "POST",
      url: "http://127.0.0.1:8765/predict",
      timeout: 8000,
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ img: c.toDataURL().split(",")[1] }),
      onload: function (r) {
        try {
          var code = JSON.parse(r.responseText).code;
          if (code && /^[0-9a-zA-Z]{4,6}$/.test(code)) { inp.value = code; fails = 0; return; }
        } catch (e) {}
        if (fails++ < 3) setTimeout(predict, 800); // 结果不合法就重试
      },
      onerror: function () { if (fails++ < 3) setTimeout(predict, 800); }
    });
  }

  // 验证码图片每次刷新(点图换一张/登录失败自动刷新)都会自动重新识别填入
  new MutationObserver(function () { fails = 0; setTimeout(predict, 200); })
    .observe(img, { attributes: true, attributeFilter: ["src"] });

  setTimeout(predict, 300);
})();

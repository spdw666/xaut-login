// ==UserScript==
// @name         西理工教务登录助手
// @namespace    xaut-local
// @version      0.7.2
// @description  本地 OCR 识别验证码 + 云更新检查 + 一键导出每周课表
// @match        https://jwgl.xaut.edu.cn/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      127.0.0.1
// @connect      cdn.jsdelivr.net
// @connect      raw.githubusercontent.com
// @connect      github.com
// @connect      objects.githubusercontent.com
// @updateURL    https://github.com/spdw666/xaut-login/releases/latest/download/xaut-login.user.js
// @downloadURL  https://github.com/spdw666/xaut-login/releases/latest/download/xaut-login.user.js
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
  // latest/download 会随最新 GitHub Release 切换；避免 main 分支和 CDN 的缓存延迟。
  const UPDATE_URL = "https://github.com/spdw666/xaut-login/releases/latest/download/xaut-login.user.js";
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

    // 双源探测：jsDelivr 缓存可能滞后，GitHub raw 永远最新；任一源发现新版本就提示
    let notified = false;
    [UPDATE_URL, UPDATE_FALLBACK_URL].forEach((url) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: 10000,
        onload(response) {
          if (notified) return;
          const match = /@version\s+([0-9.]+)/.exec(response.responseText || "");
          if (match && compareVersions(match[1], GM_info.script.version) > 0) {
            notified = true;
            showToast(
              `发现新版本 v${match[1]}（当前 v${GM_info.script.version}），点击更新`,
              () => window.open(url, "_blank")
            );
          }
        },
      });
    });
  }

  // ================= 每周课表导出 =================
  function isTopFrame() {
    try { return window.top === window; } catch (_) { return true; }
  }

  function allDocuments() {
    const docs = [];
    const visited = new Set();
    const visit = (frame) => {
      try {
        if (!frame || visited.has(frame)) return;
        visited.add(frame);
        const doc = frame.document;
        if (doc) docs.push(doc);
        for (let i = 0; i < frame.frames.length; i++) visit(frame.frames[i]);
      } catch (_) {
        // 跨域 iframe 无权访问，跳过即可；同源课表 iframe 会递归纳入搜索。
      }
    };
    try { visit(window.top); } catch (_) { visit(window); }
    return docs;
  }

  function hostDocument() {
    try { return window.top.document; } catch (_) { return document; }
  }

  // 在普通 DOM + shadow DOM + 同源 iframe 中找课表。
  // 日历式课表必须返回 table-header 本身；v0.5 曾错误地返回它的父容器，
  // 导致后续把所有 li（含课程行）当成星期表头，课程自然无法落入正确单元格。
  function findTimetableGrid() {
    const dayPattern = /(周|星期)[一二三四五六日天]/;
    for (const doc of allDocuments()) {
      const calendarHeader = [...doc.querySelectorAll(".table-header")].find((el) => {
        const text = el.textContent || "";
        return dayPattern.test(text) && el.querySelectorAll("li").length >= 6;
      });
      if (calendarHeader) return { element: calendarHeader, type: "calendar", document: doc };

      let best = null;
      const walk = (root) => {
        for (const el of root.querySelectorAll("*")) {
          const t = el.textContent || "";
          if (t.includes("节次") && dayPattern.test(t) && t.length > 50 && (!best || t.length < best.len)) {
            best = { el, len: t.length };
          }
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(doc);
      if (best) {
        const table = best.el.closest("table");
        if (table) return { element: table, type: "table", document: doc };
        const header = best.el.matches(".table-header") ? best.el : best.el.querySelector(".table-header");
        if (header) return { element: header, type: "calendar", document: doc };
      }
    }
    return null;
  }

  function cellText(el) {
    return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function csvLine(row) {
    return row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
  }

  function xmlEscape(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", "\"": "&quot;",
    }[character]));
  }

  function excelColumn(index) {
    let result = "";
    for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + (value - 1) % 26) + result;
    return result;
  }

  // 生成一个不依赖第三方库的最小 XLSX 文件。CSV 无法保存列宽、自动换行和行高，打开后会像截图一样拥挤。
  function crc32(bytes) {
    let crc = -1;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
    return (crc ^ -1) >>> 0;
  }

  function zipStore(files) {
    const encoder = new TextEncoder();
    const parts = [];
    const directory = [];
    let offset = 0;
    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = encoder.encode(file.content);
      const header = new Uint8Array(30 + name.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x04034B50, true);
      view.setUint16(4, 20, true);
      view.setUint16(26, name.length, true);
      view.setUint32(14, crc32(data), true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      header.set(name, 30);
      parts.push(header, data);
      directory.push({ name, data, offset });
      offset += header.length + data.length;
    }
    const directoryOffset = offset;
    for (const entry of directory) {
      const header = new Uint8Array(46 + entry.name.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x02014B50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint32(16, crc32(entry.data), true);
      view.setUint32(20, entry.data.length, true);
      view.setUint32(24, entry.data.length, true);
      view.setUint16(28, entry.name.length, true);
      view.setUint32(42, entry.offset, true);
      header.set(entry.name, 46);
      parts.push(header);
      offset += header.length;
    }
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054B50, true);
    endView.setUint16(8, directory.length, true);
    endView.setUint16(10, directory.length, true);
    endView.setUint32(12, offset - directoryOffset, true);
    endView.setUint32(16, directoryOffset, true);
    parts.push(end);
    return new Blob(parts, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  function worksheetXml(rows, widths, contentRowHeight) {
    const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
    const data = rows.map((row, rowIndex) => {
      const cells = row.map((value, columnIndex) => `<c r="${excelColumn(columnIndex)}${rowIndex + 1}" s="${rowIndex ? 2 : 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`).join("");
      return `<row r="${rowIndex + 1}" ht="${rowIndex ? contentRowHeight : 26}" customHeight="1">${cells}</row>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${data}</sheetData></worksheet>`;
  }

  function createTimetableWorkbook(result) {
    const overview = result.rows || [];
    const details = [["星期", "节次", "课程信息"], ...(result.records || [])];
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Microsoft YaHei"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B7A61"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/></border><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf xfId="0"/><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>`;
    return zipStore([
      { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
      { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="课表" sheetId="1" r:id="rId1"/><sheet name="课程明细" sheetId="2" r:id="rId2"/></sheets></workbook>` },
      { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: "xl/styles.xml", content: styles },
      { name: "xl/worksheets/sheet1.xml", content: worksheetXml(overview, [16, 34, 34, 34, 34, 34, 34, 34], 92) },
      { name: "xl/worksheets/sheet2.xml", content: worksheetXml(details, [16, 18, 72], 62) },
    ]);
  }

  function createPrintableTimetable(result, title) {
    const rows = result.rows || [];
    const header = rows[0] || [];
    const body = rows.slice(1).map((row) => `<tr>${row.map((value) => `<td>${xmlEscape(value).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`).join("");
    const detailRows = (result.records || []).map((row) => `<tr>${row.map((value) => `<td>${xmlEscape(value).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`).join("");
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${xmlEscape(title)}</title><style>body{margin:32px;background:#f5f7f7;color:#19242b;font:15px/1.55 "Microsoft YaHei",sans-serif}h1{margin:0 0 6px;font-size:26px}p{margin:0 0 22px;color:#607078}h2{margin:30px 0 10px;font-size:19px}table{width:100%;border-collapse:collapse;table-layout:fixed;background:#fff;box-shadow:0 2px 12px #0b7a6114}th,td{border:1px solid #d9e0e2;padding:10px;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#0b7a61;color:#fff;text-align:center;font-weight:700}td:first-child{width:130px;background:#f0f7f5;font-weight:700}.details{table-layout:auto}.details td:nth-child(1){width:120px}.details td:nth-child(2){width:130px}@media print{body{margin:10mm;background:#fff}h1{font-size:20px}th,td{padding:7px;font-size:11px;box-shadow:none}}</style></head><body><h1>${xmlEscape(title)}</h1><p>打印版课表：浏览器中打开后可直接打印，或在打印窗口选择“另存为 PDF”。</p><h2>周课表</h2><table><thead><tr>${header.map((value) => `<th>${xmlEscape(value)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table><h2>课程明细</h2><table class="details"><thead><tr><th>星期</th><th>节次</th><th>课程信息</th></tr></thead><tbody>${detailRows}</tbody></table></body></html>`;
  }

  function drawWrappedCanvasText(context, text, x, y, width, lineHeight, maxLines) {
    const source = String(text || "").replace(/\s+/g, " ").trim();
    const lines = [];
    let line = "";
    for (const character of source) {
      if (context.measureText(line + character).width > width && line) {
        lines.push(line);
        line = character;
      } else line += character;
    }
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((value, index) => context.fillText(value, x, y + index * lineHeight));
    if (lines.length > maxLines) context.fillText("…", x + Math.max(0, width - context.measureText("…").width), y + (maxLines - 1) * lineHeight);
  }

  function pdfFromJpeg(jpeg, imageWidth, imageHeight) {
    const encoder = new TextEncoder();
    const parts = [];
    const offsets = [];
    let offset = 0;
    const addText = (text) => { const bytes = encoder.encode(text); parts.push(bytes); offset += bytes.length; };
    const addBytes = (bytes) => { parts.push(bytes); offset += bytes.length; };
    const object = (number, content) => { offsets[number] = offset; addText(`${number} 0 obj\n${content}\nendobj\n`); };
    const content = "q\n842 0 0 595 0 0 cm\n/Im0 Do\nQ\n";
    addText("%PDF-1.4\n");
    object(1, "<< /Type /Catalog /Pages 2 0 R >>");
    object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    object(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
    offsets[4] = offset;
    addText(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    addBytes(jpeg);
    addText("\nendstream\nendobj\n");
    object(5, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
    const xref = offset;
    addText("xref\n0 6\n0000000000 65535 f \n");
    for (let i = 1; i <= 5; i++) addText(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
    addText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, { type: "application/pdf" });
  }

  async function createTimetablePdf(result, title) {
    const rows = result.rows || [];
    const canvas = hostDocument().createElement("canvas");
    canvas.width = 1684;
    canvas.height = 1191;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#15332d";
    context.font = "700 34px Microsoft YaHei, sans-serif";
    context.fillText(title, 56, 64);
    context.fillStyle = "#68777b";
    context.font = "20px Microsoft YaHei, sans-serif";
    context.fillText("由西理工教务登录助手导出", 56, 98);
    const top = 130;
    const headerHeight = 64;
    const firstColumn = 176;
    const columnWidth = (canvas.width - 56 - firstColumn) / Math.max(1, (rows[0] || []).length - 1);
    const rowHeight = (canvas.height - top - headerHeight - 54) / Math.max(1, rows.length - 1);
    const drawCell = (x, y, width, height, value, header) => {
      context.fillStyle = header ? "#0b7a61" : (x === 56 ? "#f0f7f5" : "#ffffff");
      context.fillRect(x, y, width, height);
      context.strokeStyle = "#d3dcde";
      context.lineWidth = 1;
      context.strokeRect(x, y, width, height);
      context.fillStyle = header ? "#ffffff" : "#1c2c30";
      context.font = header ? "700 20px Microsoft YaHei, sans-serif" : (x === 56 ? "700 18px Microsoft YaHei, sans-serif" : "18px Microsoft YaHei, sans-serif");
      context.textBaseline = "top";
      const padding = 12;
      drawWrappedCanvasText(context, value, x + padding, y + padding, width - padding * 2, 25, Math.max(2, Math.floor((height - padding * 2) / 25)));
    };
    (rows[0] || []).forEach((value, index) => drawCell(index ? 56 + firstColumn + (index - 1) * columnWidth : 56, top, index ? columnWidth : firstColumn, headerHeight, value, true));
    rows.slice(1).forEach((row, rowIndex) => row.forEach((value, columnIndex) => drawCell(columnIndex ? 56 + firstColumn + (columnIndex - 1) * columnWidth : 56, top + headerHeight + rowIndex * rowHeight, columnIndex ? columnWidth : firstColumn, rowHeight, value, false)));
    const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
    if (!jpeg) throw new Error("无法生成课表 PDF 图片");
    return pdfFromJpeg(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height);
  }

  // 经典正方 <table> 课表
  function buildTableCsv(table) {
    const rows = [...table.querySelectorAll("tr")];
    let headerIndex = -1;
    let dayCount = 0;
    for (let i = 0; i < rows.length && headerIndex < 0; i++) {
      const cells = [...rows[i].querySelectorAll("th, td")];
      dayCount = cells.filter((c) => /^(周|星期)[一二三四五六日天]/.test((c.innerText || "").trim())).length;
      if (dayCount >= 5) headerIndex = i;
    }
    if (headerIndex < 0) return { csv: "", rows: [], records: [], courseCount: 0 };
    const headerRow = [...rows[headerIndex].querySelectorAll("th, td")];
    const lines = [[(headerRow[0].innerText || "节次").trim(), ...headerRow.slice(1, 1 + dayCount).map((c) => (c.innerText || "").trim())]];
    const records = [];
    let courseCount = 0;
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const cells = [...rows[i].querySelectorAll("th, td")];
      if (cells.length < dayCount + 1) continue;
      const label = (cells[0].innerText || "").split("\n")[0].trim();
      if (!/(大节|小节|节)/.test(label)) continue; // 跳过午休等非课节行
      const row = [label];
      for (let d = 1; d <= dayCount; d++) {
        const text = cells[d] ? cellText(cells[d]) : "";
        if (text) {
          courseCount++;
          records.push([lines[0][d], label, text]);
        }
        row.push(text);
      }
      lines.push(row);
    }
    // 带 BOM 的 UTF-8，Excel 直接打开中文不乱码
    return { csv: "\uFEFF" + lines.map(csvLine).join("\r\n"), rows: lines, records, courseCount };
  }

  // 新版日历式 UL/LI 课表（如西理工：table-header + table-body + 绝对定位课程块）
  function buildUlGridCsv(headerUl) {
    const grid = headerUl.closest(".table, .timetable, .schedule, .calendar") || headerUl.parentElement;
    if (!grid) return { csv: "", rows: [], records: [], courseCount: 0 };
    const headerLis = [...headerUl.children].filter((el) => el.tagName === "LI");
    const dayCount = headerLis.length - 1;
    if (dayCount < 5) return { csv: "", rows: [], records: [], courseCount: 0 };
    const lines = [["节次", ...headerLis.slice(1, 1 + dayCount).map(cellText)]];
    const body = grid.querySelector(".table-body");
    if (!body) return { csv: "", rows: [], records: [], courseCount: 0 };

    const rowElements = [...body.children].filter((child) => child.tagName === "UL");
    const rowLabels = rowElements.map((row) => cellText(row.querySelector("li") || row))
      .filter((label) => /(大节|小节|节)|^\d+(?:\s*[-~]\s*\d+)?$/.test(label));
    if (!rowLabels.length) return { csv: "", rows: [], records: [], courseCount: 0 };

    const cells = rowLabels.map(() => Array(dayCount).fill(""));
    const dayHeaders = headerLis.slice(1, 1 + dayCount);
    const indexByRenderedPosition = (block, references, axis) => {
      const blockRect = block.getBoundingClientRect();
      if (!(blockRect.width && blockRect.height)) return -1;
      const center = axis === "x" ? blockRect.left + blockRect.width / 2 : blockRect.top + blockRect.height / 2;
      const rectangles = references.map((element) => element.getBoundingClientRect());
      if (rectangles.some((rect) => !(rect.width && rect.height))) return -1;
      let best = -1;
      let distance = Infinity;
      rectangles.forEach((rect, index) => {
        const referenceCenter = axis === "x" ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
        const currentDistance = Math.abs(center - referenceCenter);
        if (currentDistance < distance) { best = index; distance = currentDistance; }
      });
      return best;
    };
    // 优先取页面标记为 div-context 的叶子课程块。若页面版本没有该类名，才回退到不含嵌套 table-class 的叶子节点。
    const markedBlocks = [...body.querySelectorAll(".table-class.div-context, [data-course-name], [data-course]")];
    const courseBlocks = markedBlocks.length ? markedBlocks : [...body.querySelectorAll(".table-class")]
      .filter((block) => !block.querySelector(".table-class"));
    const records = [];
    let courseCount = 0;
    for (const block of courseBlocks) {
      const className = String(block.className || "");
      const dayMatch = /(?:^|\s)day(\d+)(?:\s|$)/.exec(className);
      const renderedDay = indexByRenderedPosition(block, dayHeaders, "x");
      const renderedRow = indexByRenderedPosition(block, rowElements, "y");
      const dayValue = block.dataset.day || block.dataset.column || (dayMatch && dayMatch[1]);
      // 坐标不可用时才回退。仅截取 top: 的值，避免把 left: 中的星期序号误当节次序号。
      const styleText = block.getAttribute("style") || block.style.cssText || "";
      const topText = block.dataset.row || block.dataset.index || ((/(?:^|;)\s*top\s*:\s*([^;]+)/i.exec(styleText) || [])[1]) || "";
      const topMatch = /calc\(\s*\(\s*(\d+)\s*\*/.exec(String(topText));
      const day = renderedDay >= 0 ? renderedDay : Number(dayValue);
      const row = renderedRow >= 0 ? renderedRow : (topMatch ? Number(topMatch[1]) : -1);
      if (!Number.isInteger(day) || day < 0 || day >= dayCount || row < 0 || row >= rowLabels.length) continue;

      // 课程块通常还包含教师和地点；保留完整文字，避免只导出课程名或丢失课程名。
      const title = cellText(block) || block.dataset.courseName || block.dataset.course;
      if (!title) continue;
      cells[row][day] = cells[row][day] ? `${cells[row][day]} / ${title}` : title;
      records.push([lines[0][day + 1], rowLabels[row], title]);
      courseCount++;
    }
    for (let i = 0; i < rowLabels.length; i++) lines.push([rowLabels[i], ...cells[i]]);
    return { csv: "\uFEFF" + lines.map(csvLine).join("\r\n"), rows: lines, records, courseCount };
  }

  function buildTimetableCsv(found) {
    return found.type === "table" || found.element.tagName === "TABLE" ? buildTableCsv(found.element) : buildUlGridCsv(found.element);
  }

  function timetableSignature(found) {
    const grid = found.element.closest(".table, .timetable, .schedule, .calendar") || found.element.parentElement || found.element;
    return cellText(grid).slice(0, 4000);
  }

  async function exportTimetable(week, format = "xlsx") {
    const found = findTimetableGrid();
    if (!found) {
      showToast("未找到课表，请先打开教务系统的课表页面");
      return;
    }
    const result = buildTimetableCsv(found);
    if (!result.csv || !result.courseCount) {
      showToast("没有识别到课程：请等课表加载完成后再导出");
      return;
    }
    // 文件名：优先取页面可见日期/学期（可能在 iframe 或顶层页面）
    let label = "";
    for (const doc of [document, hostDocument()]) {
      try {
        const t = doc.body ? doc.body.innerText : "";
        const date = t.match(/20\d{2}-\d{2}-\d{2}/);
        if (date) { label = date[0]; break; }
        const sem = t.match(/20\d{2}-\d{2,4}-\d/);
        if (sem) { label = sem[0]; break; }
      } catch (_) {}
    }
    const name = (label || String(new Date().getFullYear())).replace(/[\\/:*?"<>|]/g, "_");
    const weekSuffix = week ? `_第${week}周` : "";
    const printable = format === "html";
    const pdf = format === "pdf";
    const title = `第 ${week || "当前"} 周课表`;
    const blob = pdf ? await createTimetablePdf(result, title) : (printable ? new Blob([createPrintableTimetable(result, title)], { type: "text/html;charset=utf-8" }) : createTimetableWorkbook(result));
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `课表_${name}${weekSuffix}.${pdf ? "pdf" : (printable ? "html" : "xlsx")}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast(pdf ? "PDF 课表已导出" : (printable ? "打印版课表已导出（可用浏览器打开后打印或另存为 PDF）" : "Excel 课表已导出（含“课表”和“课程明细”两张表）"));
  }

  function displayedWeek() {
    for (const doc of allDocuments()) {
      const match = (doc.body && (doc.body.innerText || doc.body.textContent) || "").match(/第\s*(\d{1,2})\s*周/);
      if (match) return Number(match[1]);
    }
    return null;
  }

  function weekSelect(target) {
    for (const doc of allDocuments()) {
      for (const select of doc.querySelectorAll("select")) {
        const option = [...select.options].find((item) => new RegExp(`第\\s*${target}\\s*周`).test(item.textContent || ""));
        if (!option) continue;
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function weekStep(target, current) {
    const forward = target > current;
    const pattern = forward ? /(下一周|后?一周|next\s*week)/i : /(上一周|前一周|prev(?:ious)?\s*week)/i;
    for (const doc of allDocuments()) {
      const control = [...doc.querySelectorAll("button, a, [role=button]")].find((el) => pattern.test(`${el.textContent || ""} ${el.title || ""} ${el.getAttribute("aria-label") || ""}`));
      if (!control) continue;
      for (let i = 0; i < Math.abs(target - current); i++) control.click();
      return true;
    }
    return false;
  }

  function exportRequestedWeek(target, format) {
    const found = findTimetableGrid();
    if (!found) return showToast("未找到课表，请先打开教务系统的个人课表页面");
    const current = displayedWeek();
    if (!target || target === current) return exportTimetable(target || current, format);
    const before = timetableSignature(found);
    const switched = weekSelect(target) || (current && weekStep(target, current));
    if (!switched) {
      showToast("页面没有可识别的周次切换控件，请先在教务系统中切到目标周后再导出");
      return;
    }
    let attempts = 0;
    const waitForRefresh = setInterval(() => {
      const refreshed = findTimetableGrid();
      if (refreshed && (timetableSignature(refreshed) !== before || ++attempts >= 20)) {
        clearInterval(waitForRefresh);
        exportTimetable(target, format);
      }
    }, 300);
  }

  function openExportDialog() {
    const host = hostDocument();
    const old = host.getElementById("xaut-login-export-dialog");
    if (old) old.remove();
    const current = displayedWeek();
    const options = Array.from({ length: 30 }, (_, i) => i + 1)
      .map((week) => `<option value="${week}"${week === current ? " selected" : ""}>第 ${week} 周</option>`).join("");
    const dialog = host.createElement("div");
    dialog.id = "xaut-login-export-dialog";
    dialog.innerHTML = `<style>#xaut-login-export-dialog{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(8,20,43,.48);font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}#xaut-login-export-dialog .card{width:min(92vw,360px);padding:22px;border-radius:14px;background:#fff;box-shadow:0 18px 48px rgba(8,20,43,.3);color:#172033}#xaut-login-export-dialog h3{margin:0 0 8px;font-size:18px}#xaut-login-export-dialog p{margin:0 0 16px;color:#52617a}#xaut-login-export-dialog label{display:block;margin:12px 0 6px;font-weight:650}#xaut-login-export-dialog select{width:100%;height:40px;padding:0 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px}#xaut-login-export-dialog .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}#xaut-login-export-dialog button{height:36px;padding:0 14px;border:0;border-radius:8px;cursor:pointer;font-weight:650}#xaut-login-export-dialog [data-action=cancel]{background:#eef2f7;color:#52617a}#xaut-login-export-dialog [data-action=export]{background:#0b7a61;color:#fff}</style><section class="card" role="dialog" aria-modal="true"><h3>导出课表</h3><p>可直接下载 PDF，也可选 Excel 或打印网页版。</p><label>选择周次</label><select data-field="week" aria-label="选择导出周次">${options}</select><label>导出格式</label><select data-field="format" aria-label="选择导出格式"><option value="pdf">PDF（A4 横向周课表）</option><option value="xlsx">Excel（课表 + 课程明细）</option><option value="html">打印网页版（可另存为 PDF）</option></select><div class="actions"><button type="button" data-action="cancel">取消</button><button type="button" data-action="export">导出</button></div></section>`;
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target.dataset.action === "cancel") dialog.remove();
      if (event.target.dataset.action === "export") {
        const week = Number(dialog.querySelector('[data-field="week"]').value);
        const format = dialog.querySelector('[data-field="format"]').value;
        dialog.remove();
        exportRequestedWeek(week, format);
      }
    });
    host.body.appendChild(dialog);
  }

  function initTimetableExport() {
    // 仅顶层页管理按钮。若每个 iframe 都改同一个顶层按钮，会造成显示/隐藏互相覆盖而闪烁。
    if (!isTopFrame()) return;
    // 持续监听：课表可能在嵌套 iframe/SPA 中延迟加载，永不放弃；按钮挂在顶层页面
    setInterval(() => {
      const host = hostDocument();
      const existing = host.getElementById("xaut-login-export-btn");
      const found = findTimetableGrid();
      if (existing) {
        existing.style.display = found ? "" : "none";
        return;
      }
      if (!found) return;
      const button = host.createElement("button");
      button.type = "button";
      button.id = "xaut-login-export-btn";
      button.textContent = "📅 导出课表";
      button.title = "导出当前每周课表为格式化 Excel 文件";
      button.style.cssText = "position:fixed;right:22px;bottom:22px;z-index:2147483646;border:0;border-radius:999px;padding:11px 15px;color:#fff;background:#0b7a61;box-shadow:0 10px 25px rgba(11,122,97,.3);cursor:pointer;font:600 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;transition:transform .15s,background .15s";
      button.addEventListener("mouseenter", () => { button.style.background = "#086a54"; });
      button.addEventListener("mouseleave", () => { button.style.background = "#0b7a61"; });
      button.addEventListener("click", openExportDialog);
      host.body.appendChild(button);
    }, 1000);
  }

  // 仅顶层页检查更新、创建导出按钮；登录表单填充仍可在其所在 iframe 内正常执行。
  if (isTopFrame()) {
    checkForUpdate();
    initTimetableExport();
  }

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

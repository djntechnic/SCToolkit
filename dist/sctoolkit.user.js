// ==UserScript==
// @name         SCToolkit
// @namespace    https://github.com/djntechnic/SCToolkit
// @version      3.0.0-alpha.0
// @description  Userscript toolkit for sports card database browsing: filtering, shortcuts, and polite CSV export.
// @author       djntechnic
// @license      MIT
// @homepageURL  https://github.com/djntechnic/SCToolkit
// @supportURL   https://github.com/djntechnic/SCToolkit/issues
// @updateURL    https://raw.githubusercontent.com/djntechnic/SCToolkit/main/dist/sctoolkit.user.js
// @downloadURL  https://raw.githubusercontent.com/djntechnic/SCToolkit/main/dist/sctoolkit.user.js
// @match        *://*.tcdb.com/*
// @match        *://tcdb.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_info
// @run-at       document-end
// ==/UserScript==

(() => {
  // src/main.js
  var VERSION = typeof GM_info !== "undefined" ? GM_info.script.version : "dev";
  function boot() {
    console.log(
      `%c SCToolkit %c v${VERSION} `,
      "background:#1f2937;color:#f9fafb;border-radius:3px 0 0 3px;padding:1px 4px",
      "background:#2563eb;color:#fff;border-radius:0 3px 3px 0;padding:1px 4px"
    );
  }
  boot();
})();

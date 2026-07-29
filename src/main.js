/**
 * SCToolkit entry point.
 *
 * Phase 0 scaffold: this bootstrap exists so the build, lint, test, and
 * auto-update pipeline can be exercised end to end before any behaviour is
 * ported. Phase 1 replaces the body with the extracted module graph
 * (core/ net/ data/ ui/ modules/) without changing this file's contract:
 * one IIFE, one entry, no top-level side effects beyond `boot()`.
 */

const VERSION = typeof GM_info !== 'undefined' ? GM_info.script.version : 'dev';

function boot() {
  console.log(
    `%c SCToolkit %c v${VERSION} `,
    'background:#1f2937;color:#f9fafb;border-radius:3px 0 0 3px;padding:1px 4px',
    'background:#2563eb;color:#fff;border-radius:0 3px 3px 0;padding:1px 4px'
  );
}

boot();

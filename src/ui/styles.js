/**
 * Design tokens and component CSS, as strings injected at runtime.
 *
 * Kept as JS template literals rather than a separate stylesheet because a
 * userscript ships as one file — there is nowhere to link a `.css` from.
 */

/** Tokens plus toolbar, badge, filter, and toast styling. */
export const TOOLBAR_CSS = `
/* ---- Design tokens ----
   Kept on :root rather than a scoping class because the toolbar, toasts,
   settings modal, and filter bar mount in four different places in the page.
   The --tk- prefix is specific enough that collision with the site's own
   variables is not a real risk. Dark values override by attribute below. */
:root {
    /* Surfaces & Neutrals (Light Mode - Deep Blue Slate Tint) */
    --tk-bg-base: #f0f4f8;
    --tk-bg-elevated: #ffffff;
    --tk-bg-hover: #e2e8f0;
    --tk-border: #7d8597;
    --tk-border-strong: #5c677d;
    --tk-text: #001233;
    --tk-text-muted: #33415c;

    /* Accents & Signals (Palette: #0466c8, #0353a4, #023e7d) */
    --tk-accent: #0466c8;
    --tk-teal: #0891b2;
    --tk-blue: #0353a4;
    --tk-violet: #7c3aed;
    --tk-indigo: #6366f1;
    --tk-magenta: #db2777;
    --tk-amber: #d97706;
    --tk-green: #059669;
    --tk-red: #dc2626;

    /* Typography & Elevation */
    --tk-font-ui: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --tk-font-mono: "JetBrains Mono", "Geist Mono", "SF Mono", "Cascadia Code", monospace;
    --tk-radius-sm: 4px;
    --tk-radius-md: 6px;
    --tk-shadow-elevated: 0 10px 25px -5px rgba(2, 62, 125, 0.15), 0 8px 10px -6px rgba(2, 62, 125, 0.08);
}

/* Icons are <use> references into the injected sprite. */
.tk-icon { flex-shrink: 0; display: block; align-self: center; }

/* Filter hiding. A class rather than an inline style so the filter never has
   to read or restore a row's own display value. */
.tk-hidden { display: none !important; }

/* Dark palette. Only the values change; every rule below is theme-agnostic. */
:root[data-sctk-theme="dark"] {
    /* Surfaces & Neutrals (Dark Mode - Midnight Navy Deep) */
    --tk-bg-base: #001233;
    --tk-bg-elevated: #001845;
    --tk-bg-hover: #002855;
    --tk-border: #002855;
    --tk-border-strong: #33415c;
    --tk-text: #f1f5f9;
    --tk-text-muted: #979dac;

    /* Accents & Signals */
    --tk-accent: #0466c8;
    --tk-teal: #2dd4bf;
    --tk-blue: #0353a4;
    --tk-violet: #c084fc;
    --tk-indigo: #818cf8;
    --tk-magenta: #f472b6;
    --tk-amber: #fbbf24;
    --tk-green: #34d399;
    --tk-red: #f87171;

    --tk-shadow-elevated: 0 20px 25px -5px rgba(0, 18, 51, 0.7), 0 8px 10px -6px rgba(0, 18, 51, 0.5);
}

/* Solid-fill badges need dark text against the brighter dark-mode accents. */
:root[data-sctk-theme="dark"] .tk-badge-link-fs,
:root[data-sctk-theme="dark"] .tk-badge-link-w,
:root[data-sctk-theme="dark"] .tk-badge-link-y:hover { color: #16181b; }
:root[data-sctk-theme="dark"] .sctk-btn:hover:not(:disabled),
:root[data-sctk-theme="dark"] #tk-center-context .tk-scroll-btn:hover { color: #ffffff; }

#sctk-toolbar { position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; background: linear-gradient(180deg, #e4eef8 0%, #d1e2f3 100%); color: var(--tk-text); display: flex; align-items: center; min-height: 34px; padding: 2px 8px; font-family: var(--tk-font-ui); font-size: 11px; border-bottom: 2px solid var(--tk-accent); box-shadow: 0 3px 10px rgba(4, 102, 200, 0.18); box-sizing: border-box; flex-wrap: nowrap; }

:root[data-sctk-theme="dark"] #sctk-toolbar { background: linear-gradient(180deg, #001845 0%, #001233 100%); border-bottom: 2px solid var(--tk-accent); box-shadow: 0 4px 14px rgba(0, 18, 51, 0.6); }

/* Wordmark */
#sctk-toolbar .tk-wordmark { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 2px 6px; margin-right: 8px; flex-shrink: 0; background: var(--tk-bg-elevated); border: 1px solid var(--tk-border-strong); border-top: 2px solid var(--tk-accent); border-radius: 0 0 3px 3px; line-height: 1.1; }
#sctk-toolbar .tk-wordmark-title { font-family: var(--tk-font-mono); font-weight: 700; font-size: 11px; letter-spacing: 0.02em; color: var(--tk-text); text-align: center; display: block; width: 100%; }
#sctk-toolbar .tk-wordmark-sub { font-family: var(--tk-font-mono); font-size: 7.5px; letter-spacing: 0.14em; color: var(--tk-text-muted); text-transform: uppercase; text-align: center; display: block; width: 100%; }

#sctk-toolbar .toolbar-group { display: flex; gap: 4px; margin-right: 8px; border-right: 1px solid var(--tk-border); padding-right: 8px; flex-shrink: 0; align-items: center; }

/* Responsive Center Context Bar */
#tk-center-context { flex-grow: 1; flex-shrink: 1; display: flex; align-items: center; justify-content: center; gap: 4px; overflow: hidden; min-width: 120px; padding: 0 4px; }
#tk-center-context .tk-scroll-btn, #tk-center-context .tk-scroll-btn:visited { background: var(--tk-bg-elevated); color: var(--tk-blue); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 1px 6px 0 6px; height: 20px; cursor: pointer; font-family: var(--tk-font-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.02em; flex-shrink: 0; user-select: none; display: inline-flex; align-items: center; justify-content: center; gap: 3px; line-height: 1; box-sizing: border-box; text-decoration: none !important; }
#tk-center-context .tk-scroll-btn:hover, #tk-center-context .tk-scroll-btn:hover:visited { background: var(--tk-bg-hover); border-color: var(--tk-accent); color: #000000; text-decoration: none !important; }
#tk-center-context .context-label { display: inline-flex; align-items: center; height: 20px; font-family: var(--tk-font-mono); font-weight: 600; color: var(--tk-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; line-height: 1; margin: 0; padding-top: 1px; box-sizing: border-box; }

/* Right-Aligned Status Bar */
#tk-status-wrap { position: relative; display: inline-flex; flex-shrink: 0; align-items: center; }
#tk-status { flex-shrink: 0; background: transparent; border: none; margin: 0; font-family: var(--tk-font-mono); font-weight: 700; font-size: 10px; letter-spacing: 0.02em; color: var(--tk-accent); cursor: pointer; text-align: right; justify-content: flex-end; padding: 1px 4px 0 4px; white-space: nowrap; display: inline-flex; align-items: center; height: 20px; box-sizing: border-box; }
#tk-status:hover { color: var(--tk-blue); text-decoration: underline; }
:root[data-sctk-theme="dark"] #tk-status:hover { color: var(--tk-teal); }

#tk-settings-trigger.tk-scroll-btn { background: var(--tk-bg-elevated); color: #000000; border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 1px 7px 0 7px; height: 20px; margin-left: 0; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-family: var(--tk-font-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.02em; flex-shrink: 0; cursor: pointer; box-sizing: border-box; }
#tk-settings-trigger.tk-scroll-btn:hover { background: var(--tk-bg-hover); border-color: var(--tk-accent); color: #000000; }
:root[data-sctk-theme="dark"] #tk-settings-trigger.tk-scroll-btn { background: var(--tk-bg-elevated); color: #ffffff; border-color: var(--tk-border-strong); }
:root[data-sctk-theme="dark"] #tk-settings-trigger.tk-scroll-btn:hover { background: var(--tk-bg-hover); border-color: var(--tk-accent); color: #ffffff; }

.sctk-btn, .sctk-btn:visited { display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: var(--tk-bg-elevated); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 1px 7px 0 7px; height: 22px; cursor: pointer; font-family: var(--tk-font-ui); font-size: 10.5px; font-weight: 600; white-space: nowrap; line-height: 1; box-sizing: border-box; text-decoration: none !important; }
.sctk-btn svg { flex-shrink: 0; }
.sctk-btn:hover:not(:disabled), .sctk-btn:hover:not(:disabled):visited { background: var(--tk-bg-hover); border-color: var(--tk-accent); color: #000000; text-decoration: none !important; }
.sctk-btn-danger { border-color: var(--tk-red); color: var(--tk-red); }
.sctk-btn-danger:hover:not(:disabled) { background: var(--tk-red); border-color: var(--tk-red); color: #ffffff; }
.sctk-btn[hidden] { display: none; }
.sctk-btn:disabled { background: var(--tk-bg-base); border-color: var(--tk-border); color: var(--tk-text-muted); cursor: not-allowed; opacity: 0.7; }

/* Visible keyboard focus */
#sctk-toolbar button:focus-visible,
#sctk-toolbar a:focus-visible,
#sctk-toolbar span[role="button"]:focus-visible,
#sctk-toolbar input:focus-visible,
.tk-dropdown-content a:focus-visible,
.tk-dropdown-content span[role="button"]:focus-visible {
    outline: 2px solid var(--tk-accent); outline-offset: 1px; border-radius: var(--tk-radius-sm);
}

@media (prefers-reduced-motion: no-preference) {
    #tk-center-context .tk-scroll-btn, .sctk-btn, .sctk-badge, .tk-dropbtn, .tk-pin-remove {
        transition: background-color .15s ease, border-color .15s ease, color .15s ease, box-shadow .15s ease;
    }
}

/* Dropdown Styling for Pins */
.tk-dropdown { position: relative; display: inline-block; }
.tk-dropdown-content { display: none; position: absolute; left: 0; top: 100%; margin-top: 2px; background-color: var(--tk-bg-elevated); min-width: 460px; max-width: 640px; box-shadow: var(--tk-shadow-elevated); z-index: 100000; border-radius: var(--tk-radius-md); border: 1px solid var(--tk-border-strong); max-height: 450px; overflow-y: auto; text-align: left; }
/* Click-only. Hover-open cannot be dismissed on a touch device and fires by
   accident on the way to something else on desktop. */
.tk-dropdown.tk-show .tk-dropdown-content { display: block; }

.tk-dropdown-content .tk-pin-item { color: var(--tk-text); padding: 5px 8px; display: flex; flex-direction: column; gap: 1.5px; font-size: 10.5px; border-bottom: 1px solid var(--tk-border); }
.tk-dropdown-content .tk-pin-item:last-child { border-bottom: none; }
.tk-dropdown-content .tk-pin-item:hover { background-color: var(--tk-bg-hover); }
.tk-dropdown-content .tk-pin-header { display: flex; justify-content: space-between; align-items: flex-start; width: 100%; gap: 6px; }
.tk-dropdown-content .tk-pin-title { font-family: var(--tk-font-mono); font-weight: 700; font-size: 10.5px; color: var(--tk-accent); text-decoration: none; flex: 1 1 auto; min-width: 0; word-break: break-word; text-align: left; line-height: 1.2; white-space: normal; }
.tk-dropdown-content .tk-pin-title:hover { text-decoration: underline; color: var(--tk-blue); }

.tk-dropdown-content .tk-pin-actions { display: flex; gap: 3px; align-items: center; flex-wrap: wrap; margin-top: 0; }
.tk-dropdown-content .tk-pin-actions .sctk-badge { margin-left: 0; margin-right: 0; flex-shrink: 0; }

.tk-pin-remove { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: 1px solid var(--tk-red); background: transparent; color: var(--tk-red); border-radius: var(--tk-radius-sm); cursor: pointer; flex-shrink: 0; }
.tk-pin-remove:hover { background: var(--tk-red); color: #fff; }

.tk-dropbtn { display: inline-flex; align-items: center; gap: 3px; background: var(--tk-bg-elevated); border: 1px solid var(--tk-border-strong); color: var(--tk-text); border-radius: var(--tk-radius-sm); padding: 1px 6px 0 6px; height: 20px; cursor: pointer; font-family: var(--tk-font-mono); font-size: 10px; font-weight: 700; line-height: 1; box-sizing: border-box; }
.tk-dropbtn:hover { border-color: var(--tk-accent); color: var(--tk-accent); background: var(--tk-bg-hover); }
.tk-dropbtn:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }

/* Injected Badge Group Container */
.tk-injected-badge-group { margin-left: 8px; vertical-align: middle; }

/* Overflow menu — the toolbar no longer wraps, so anything that does not fit
   moves in here rather than pushing page content down. */
#tk-overflow { flex-shrink: 0; }
#tk-overflow[hidden] { display: none; }
#tk-overflow .tk-dropdown-content { right: 0; left: auto; min-width: 220px; padding: 4px; }
#tk-overflow .tk-dropdown-content .sctk-btn { width: 100%; justify-content: flex-start; margin: 2px 0; }

/* Compact Badge Styles */
.sctk-badge, .sctk-badge:visited { display: inline-flex; align-items: center; justify-content: center; gap: 3px; font-family: var(--tk-font-mono); padding: 1px 5px 0 5px; height: 20px; margin: 0; text-decoration: none !important; font-size: 9.5px; font-weight: 700; letter-spacing: 0.01em; border-radius: var(--tk-radius-sm); line-height: 1; box-sizing: border-box; cursor: pointer; white-space: nowrap; background: var(--tk-bg-elevated); border: 1px solid var(--tk-border-strong); color: var(--tk-text); }
.sctk-badge:hover, .sctk-badge:hover:visited { background: var(--tk-bg-hover); border-color: var(--tk-accent); color: var(--tk-accent); text-decoration: none !important; }

.tk-badge-action, .tk-badge-action:visited { background: var(--tk-bg-elevated); border-color: var(--tk-blue); color: var(--tk-blue); }
.tk-badge-action:hover, .tk-badge-action:hover:visited { background: var(--tk-blue); color: #ffffff; }

.tk-badge-action-h, .tk-badge-action-h:visited { background: var(--tk-bg-elevated); border-color: var(--tk-teal); color: var(--tk-teal); }
.tk-badge-action-h:hover, .tk-badge-action-h:hover:visited { background: var(--tk-teal); color: #ffffff; }

.tk-badge-link-c, .tk-badge-link-c:visited { background: var(--tk-bg-elevated); border-color: var(--tk-blue); color: var(--tk-blue); }
.tk-badge-link-c:hover, .tk-badge-link-c:hover:visited { background: var(--tk-blue); color: #ffffff; }

.tk-badge-link-y, .tk-badge-link-y:visited { background: var(--tk-bg-elevated); border-color: var(--tk-amber); color: var(--tk-amber); }
.tk-badge-link-y:hover, .tk-badge-link-y:hover:visited { background: var(--tk-amber); color: #ffffff; }

.tk-badge-link-i, .tk-badge-link-i:visited { background: var(--tk-bg-elevated); border-color: var(--tk-violet); color: var(--tk-violet); }
.tk-badge-link-i:hover, .tk-badge-link-i:hover:visited { background: var(--tk-violet); color: #ffffff; }

.tk-badge-link-p, .tk-badge-link-p:visited { background: var(--tk-bg-elevated); border-color: var(--tk-magenta); color: var(--tk-magenta); }
.tk-badge-link-p:hover, .tk-badge-link-p:hover:visited { background: var(--tk-magenta); color: #ffffff; }

.tk-badge-link-fs, .tk-badge-link-fs:visited { background: var(--tk-green); border-color: var(--tk-green); color: #ffffff; }
.tk-badge-link-fs:hover, .tk-badge-link-fs:hover:visited { background: #146c43; border-color: #146c43; color: #ffffff; }

.tk-badge-link-fsm, .tk-badge-link-fsm:visited { background: var(--tk-bg-elevated); border-color: var(--tk-green); color: var(--tk-green); }
.tk-badge-link-fsm:hover, .tk-badge-link-fsm:hover:visited { background: var(--tk-green); color: #ffffff; }

.tk-badge-link-w, .tk-badge-link-w:visited { background: var(--tk-red); border-color: var(--tk-red); color: #ffffff; }
.tk-badge-link-w:hover, .tk-badge-link-w:hover:visited { background: #b02a37; border-color: #b02a37; color: #ffffff; }

/* Filter Bar CSS */
#tk-checklist-filter-wrap { margin: 8px 0; display: flex; align-items: center; gap: 6px; background: var(--tk-bg-elevated); border: 1px solid var(--tk-border-strong); border-left: 3px solid var(--tk-accent); padding: 6px 10px; border-radius: 4px; font-family: var(--tk-font-ui); color: var(--tk-text); font-size: 11.5px; }
#tk-checklist-filter-wrap strong { font-family: var(--tk-font-mono); font-size: 9.5px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--tk-accent); font-weight: 700; flex-shrink: 0; }
#tk-checklist-filter-container { position: relative; display: inline-flex; align-items: center; }
#tk-checklist-filter { padding: 3px 22px 3px 6px; border: 1px solid var(--tk-border-strong); background: var(--tk-bg-elevated); color: var(--tk-text); border-radius: 3px; font-size: 11.5px; width: 320px; font-family: var(--tk-font-ui); box-sizing: border-box; }
#tk-checklist-filter-clear { position: absolute; right: 4px; background: transparent; border: none; color: var(--tk-text-muted); padding: 2px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; border-radius: 2px; height: 16px; width: 16px; margin: 0; }
#tk-checklist-filter-clear:hover { color: var(--tk-red); background: var(--tk-bg-hover); }
#tk-checklist-filter-select-all { height: 22px; padding: 1px 8px 0 8px; font-size: 10.5px; flex-shrink: 0; }
#tk-checklist-filter-copy-friendly, #tk-checklist-filter-copy-tsv { height: 22px; width: 22px; padding: 0; flex-shrink: 0; }
#tk-filter-count { font-family: var(--tk-font-mono); font-size: 10px; color: var(--tk-text-muted); white-space: nowrap; flex-shrink: 0; }
#tk-checklist-filter:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; border-color: var(--tk-accent); }

/* Responsive Breakpoints */
@media (max-width: 900px) {
    #sctk-toolbar .tk-wordmark { display: none; }
    #tk-center-context .context-label { max-width: 160px; }
}

@media (max-width: 650px) {
    #tk-center-context .context-label { display: none; }
    #tk-center-context { justify-content: flex-start; }
    #tk-checklist-filter { width: 160px; }
}

/* Command palette */
#tk-palette-overlay { position: fixed; inset: 0; z-index: 200001; background: rgba(0,0,0,0.45); display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh; font-family: var(--tk-font-ui); }
#tk-palette-panel { background: var(--tk-bg-elevated); color: var(--tk-text); width: min(560px, 92vw); border-radius: var(--tk-radius-md); border: 1px solid var(--tk-border-strong); box-shadow: var(--tk-shadow-elevated); overflow: hidden; }
#tk-palette-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: none; border-bottom: 1px solid var(--tk-border); background: var(--tk-bg-elevated); color: var(--tk-text); font-family: var(--tk-font-ui); font-size: 13px; }
#tk-palette-input:focus { outline: none; }
#tk-palette-results { max-height: 46vh; overflow-y: auto; }
.tk-palette-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 12px; cursor: pointer; font-size: 11.5px; border-left: 2px solid transparent; }
.tk-palette-item:hover { background: var(--tk-bg-hover); }
.tk-palette-item.active { background: var(--tk-bg-hover); border-left-color: var(--tk-accent); }
.tk-palette-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tk-palette-hint { flex-shrink: 0; font-family: var(--tk-font-mono); font-size: 9.5px; color: var(--tk-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.tk-palette-empty { padding: 12px; color: var(--tk-text-muted); font-size: 11.5px; }

/* Toast System */
.tk-toast-container { position: fixed; z-index: 100000; display: flex; flex-direction: column; gap: 6px; pointer-events: none; font-family: var(--tk-font-ui); }
.tk-toast-bottom-right { bottom: 16px; right: 16px; align-items: flex-end; }
.tk-toast-bottom-left { bottom: 16px; left: 16px; align-items: flex-start; }
.tk-toast-top-right { top: 44px; right: 16px; align-items: flex-end; }
.tk-toast-top-left { top: 44px; left: 16px; align-items: flex-start; }
.tk-toast-message { padding: 8px 12px; border-radius: var(--tk-radius-sm); background: var(--tk-bg-elevated); color: var(--tk-text); border: 1px solid var(--tk-border); border-left: 3px solid var(--tk-teal); box-shadow: var(--tk-shadow-elevated); opacity: 0; pointer-events: auto; line-height: 1.35; max-width: 320px; word-wrap: break-word; text-align: left; font-size: 11.5px; }
.tk-toast-message.tk-toast-show { opacity: 1; }
@media (prefers-reduced-motion: no-preference) {
    .tk-toast-message, .sctk-qty-counter { transition: opacity 0.25s ease, transform 0.25s ease; }
    .tk-toast-message { transform: translateY(8px); }
    .tk-toast-message.tk-toast-show { transform: translateY(0); }
}
.tk-toast-hint { font-family: var(--tk-font-mono); font-size: 9px; color: var(--tk-text-muted); border: 1px solid var(--tk-border-strong); border-radius: 3px; padding: 0 3px; }
.tk-toast-detail { color: var(--tk-text-muted); margin-top: 3px; font-variant-numeric: tabular-nums; }
.tk-toast-cancel { margin-top: 6px; background: transparent; border: 1px solid var(--tk-border-strong); color: var(--tk-text); border-radius: var(--tk-radius-sm); padding: 2px 8px; font-family: var(--tk-font-ui); font-size: 10.5px; font-weight: 600; cursor: pointer; }
.tk-toast-cancel:hover:not(:disabled) { background: var(--tk-red); border-color: var(--tk-red); color: #fff; }
.tk-toast-cancel:disabled { opacity: 0.6; cursor: default; }
.tk-toast-cancel:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-toast-message ul, .tk-toast-message ol { text-align: left; margin: 3px 0 0 0; padding-left: 16px; }
.tk-toast-message li { text-align: left; margin-bottom: 2px; }

/* Player Quick Links / Card Name Formatter */
.tk-formatter-popover { position: absolute; z-index: 200000; background: var(--tk-bg-elevated); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 4px 8px; box-shadow: var(--tk-shadow-elevated); font-family: var(--tk-font-ui); font-size: 11px; display: flex; align-items: center; gap: 8px; }
.tk-popover-label { font-family: var(--tk-font-mono); white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
.tk-formatter-popover .sctk-btn { height: 20px; padding: 0 6px; }

.tk-player-quick-links-inline { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; margin-top: 2px; line-height: 1; }
.sctk-inline-btn, .sctk-inline-btn:visited { display: inline-flex; align-items: center; justify-content: center; gap: 2px; background: var(--tk-bg-elevated); color: var(--tk-text-muted); border: 1px solid var(--tk-border-strong); border-radius: 2px; padding: 0 2px; height: 12px; min-width: 12px; cursor: pointer; font-family: var(--tk-font-mono); font-size: 8px; font-weight: 600; white-space: nowrap; line-height: 1; box-sizing: border-box; text-decoration: none !important; }
.sctk-inline-btn:hover:not(:disabled), .sctk-inline-btn:hover:not(:disabled):visited { background: var(--tk-bg-hover); border-color: var(--tk-accent); color: var(--tk-text); text-decoration: none !important; }
.sctk-inline-btn svg { width: 8px; height: 8px; flex-shrink: 0; }

/* Quantity Counter Widget */
.sctk-qty-counter { font-family: var(--tk-font-ui); font-size: 11.5px; color: var(--tk-text); background: var(--tk-bg-elevated); border: 1px solid var(--tk-border-strong); border-left: 3px solid var(--tk-accent); border-radius: var(--tk-radius-sm); padding: 5px 10px; box-shadow: var(--tk-shadow-elevated); display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; user-select: none; pointer-events: auto; }
.sctk-qty-counter-bottom-right { position: relative; inset: auto; z-index: auto; }
.sctk-qty-counter-bottom-left { position: relative; inset: auto; z-index: auto; }
.sctk-qty-counter-toolbar { position: relative; z-index: auto; border-radius: var(--tk-radius-sm); margin-left: 6px; padding: 2px 8px; height: 22px; box-shadow: none; }
.sctk-qty-counter .tk-qty-label { font-family: var(--tk-font-mono); font-size: 10px; font-weight: 700; color: var(--tk-accent); text-transform: uppercase; }
.sctk-qty-counter .tk-qty-val { font-family: var(--tk-font-mono); font-size: 12px; font-weight: 700; color: var(--tk-text); }
.sctk-qty-counter .tk-qty-sep, .sctk-qty-counter .tk-qty-total { font-family: var(--tk-font-mono); font-size: 11px; color: var(--tk-text-muted); }
.sctk-qty-counter .tk-qty-sub { font-size: 10.5px; color: var(--tk-text-muted); margin-left: 4px; }

/* Height is measured and written to this variable by a ResizeObserver. The
   old fixed 38px was wrong the moment the toolbar wrapped to a second row, and
   the toolbar covered the top of the page. */
body { padding-top: var(--tk-toolbar-height, 38px) !important; }
`;

/** Settings modal styling. */
export const SETTINGS_CSS = `
#tk-settings-overlay { position: fixed; inset: 0; z-index: 200000; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-family: var(--tk-font-ui); }
#tk-settings-panel { background: var(--tk-bg-elevated); color: var(--tk-text); width: min(580px, 92vw); height: min(580px, 85vh); min-height: 480px; border-radius: var(--tk-radius-md); border: 1px solid var(--tk-border-strong); box-shadow: var(--tk-shadow-elevated); display: flex; flex-direction: column; overflow: hidden; text-align: left; }
#tk-settings-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--tk-border); flex-shrink: 0; background: var(--tk-bg-base); text-align: left; }
#tk-settings-header h2 { margin: 0; font-family: var(--tk-font-mono); font-size: 12px; font-weight: 700; letter-spacing: 0.02em; color: var(--tk-accent); text-align: left; }
#tk-settings-close { display: inline-flex; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--tk-border-strong); color: var(--tk-text-muted); border-radius: var(--tk-radius-sm); width: 22px; height: 22px; cursor: pointer; }
#tk-settings-close:hover { background: var(--tk-red); border-color: var(--tk-red); color: #fff; }
#tk-settings-close:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
#tk-settings-body { display: flex; flex-direction: column; overflow: hidden; flex-grow: 1; text-align: left; }
#tk-settings-tabs { display: flex; gap: 2px; padding: 4px 14px 0; border-bottom: 1px solid var(--tk-border); flex-shrink: 0; background: var(--tk-bg-base); text-align: left; }
.tk-settings-tab { background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--tk-text-muted); font-family: var(--tk-font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 6px 8px; cursor: pointer; }
.tk-settings-tab:hover { color: var(--tk-text); }
.tk-settings-tab.active { color: var(--tk-accent); border-bottom-color: var(--tk-accent); }
.tk-settings-tab:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: -2px; }
#tk-settings-tab-content { overflow-y: auto; flex-grow: 1; padding: 14px 16px; text-align: left; }
#tk-settings-modules, #tk-settings-global { width: 100%; text-align: left; }
.tk-settings-section-title { font-family: var(--tk-font-mono); font-size: 10px; font-weight: 700; color: var(--tk-teal); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 8px 0; text-align: left; }
.tk-settings-module-row { border-bottom: 1px solid var(--tk-border); padding: 4px 0; text-align: left; }
.tk-settings-module-row:last-child { border-bottom: none; }
.tk-accordion-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; cursor: pointer; padding: 6px 8px; border-radius: var(--tk-radius-sm); user-select: none; }
.tk-accordion-header:hover { background: var(--tk-bg-hover); }
.tk-accordion-header-left { display: flex; flex-direction: column; gap: 3px; flex: 1 1 auto; min-width: 0; }
.tk-accordion-header label.tk-module-label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11.5px; font-weight: 700; text-align: left; margin: 0; }
.tk-settings-module-desc { font-size: 10.5px; color: var(--tk-text-muted); margin: 0 0 0 20px; line-height: 1.35; text-align: left; white-space: normal; word-break: break-word; }
.tk-accordion-toggle-btn { display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--tk-text-muted); padding: 2px; margin-top: 2px; border-radius: var(--tk-radius-sm); cursor: pointer; flex-shrink: 0; transition: transform 0.2s ease, color 0.2s ease; }
.tk-accordion-toggle-btn:hover { color: var(--tk-accent); }
.tk-accordion-toggle-btn:focus-visible { outline: 2px solid var(--tk-accent); }
.tk-accordion-open .tk-accordion-toggle-btn { transform: rotate(180deg); color: var(--tk-accent); }
.tk-accordion-body { padding: 6px 8px 6px 20px; }
.tk-settings-actions { margin: 4px 0 6px 0; display: flex; flex-direction: column; gap: 3px; text-align: left; }
.tk-settings-actions label { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 400; cursor: pointer; color: var(--tk-text-muted); text-align: left; }
.tk-settings-field { margin-bottom: 12px; text-align: left; }
.tk-settings-field label { display: block; font-size: 10.5px; font-weight: 700; margin-bottom: 3px; text-align: left; }
.tk-settings-field .tk-field-value { color: var(--tk-teal); font-weight: 400; font-family: var(--tk-font-mono); }
.tk-settings-field input[type="range"] { width: 100%; accent-color: var(--tk-accent); }
.tk-settings-field select { width: 100%; padding: 4px; background: var(--tk-bg-base); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); font-size: 11px; }
.tk-settings-field select:focus-visible,
#tk-settings-panel input[type="checkbox"]:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
#tk-settings-panel input[type="checkbox"] { accent-color: var(--tk-accent); }
.tk-contract-list { list-style: none; margin: 4px 0 0 0; padding: 0; font-family: var(--tk-font-mono); font-size: 10px; line-height: 1.5; text-align: left; }
.tk-contract-list li { text-align: left; }
.tk-contract-list li.ok { color: var(--tk-text-muted); }
.tk-contract-list li.bad { color: var(--tk-red); font-weight: 700; }
#tk-settings-diagnostics { text-align: left; }
#tk-settings-diagnostics .tk-settings-section-title { text-align: left; }
#tk-settings-diagnostics .tk-settings-field { text-align: left; }
#tk-settings-diagnostics .tk-settings-field label { text-align: left; }
.tk-diag-list { display: grid; grid-template-columns: 140px 1fr; gap: 6px 16px; margin: 0 0 14px 0; font-size: 11px; text-align: left; align-items: baseline; }
.tk-diag-list dt { font-family: var(--tk-font-mono); font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tk-text-muted); text-align: left; }
.tk-diag-list dd { margin: 0; word-break: break-word; text-align: left; color: var(--tk-text); }
#tk-settings-help { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--tk-border); font-size: 10.5px; color: var(--tk-text-muted); line-height: 1.5; text-align: left; }
#tk-settings-help a { color: var(--tk-blue); }

.tk-settings-hint { font-size: 10px; color: var(--tk-text-muted); margin-top: 2px; line-height: 1.3; text-align: left; }

.tk-route-editor { margin: 6px 0 4px 16px; text-align: left; }
.tk-route-editor-title { font-family: var(--tk-font-mono); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--tk-text-muted); margin-bottom: 4px; text-align: left; }
.tk-route-rows { display: flex; flex-direction: column; gap: 4px; }
.tk-route-row { display: flex; gap: 4px; align-items: center; }
.tk-route-row input[type="text"] { flex: 1 1 auto; min-width: 0; padding: 4px 6px; background: var(--tk-bg-elevated); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); font-family: var(--tk-font-mono); font-size: 10px; }
.tk-route-row input[type="text"]:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-route-row.tk-route-row-invalid input[type="text"] { border-color: var(--tk-red); }
.tk-route-row select { flex-shrink: 0; padding: 4px 5px; background: var(--tk-bg-base); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); font-size: 10px; font-family: var(--tk-font-ui); }
.tk-route-row select:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-route-remove-btn { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: transparent; border: 1px solid var(--tk-border-strong); color: var(--tk-text-muted); border-radius: var(--tk-radius-sm); cursor: pointer; }
.tk-route-remove-btn:hover { background: var(--tk-red); border-color: var(--tk-red); color: #fff; }
.tk-route-remove-btn:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-route-add-btn { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; padding: 4px 8px; background: var(--tk-bg-base); border: 1px solid var(--tk-border-strong); color: var(--tk-teal); border-radius: var(--tk-radius-sm); font-family: var(--tk-font-ui); font-size: 10.5px; font-weight: 600; cursor: pointer; }
.tk-route-add-btn:hover { border-color: var(--tk-teal); color: #fff; background: var(--tk-teal); }
.tk-route-add-btn:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-route-error { font-size: 9.5px; color: var(--tk-red); margin-top: 3px; line-height: 1.3; min-height: 0; }

/* RegEx & Route Tester Panes */
.tk-tester-pane { display: flex; flex-direction: column; gap: 10px; width: 100%; text-align: left; }
.tk-tester-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.tk-tester-row-input { flex: 1 1 auto; min-width: 0; }
.tk-tester-input { width: 100%; box-sizing: border-box; padding: 6px 8px; background: var(--tk-bg-base); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); font-family: var(--tk-font-mono); font-size: 11px; }
.tk-tester-input:focus-visible, .tk-tester-textarea:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-tester-textarea { width: 100%; box-sizing: border-box; min-height: 70px; padding: 6px 8px; background: var(--tk-bg-base); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); font-family: var(--tk-font-mono); font-size: 11px; resize: vertical; line-height: 1.4; }
.tk-regex-flags { display: flex; gap: 6px; align-items: center; user-select: none; }
.tk-regex-flag-label { display: inline-flex; align-items: center; gap: 3px; font-family: var(--tk-font-mono); font-size: 10.5px; cursor: pointer; color: var(--tk-text-muted); }
.tk-regex-flag-label input { accent-color: var(--tk-accent); margin: 0; }
.tk-preset-chips { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.tk-preset-chip { font-family: var(--tk-font-mono); font-size: 9.5px; background: var(--tk-bg-base); color: var(--tk-text-muted); border: 1px solid var(--tk-border-strong); border-radius: 12px; padding: 2px 8px; cursor: pointer; user-select: none; }
.tk-preset-chip:hover { border-color: var(--tk-accent); color: var(--tk-accent); background: var(--tk-bg-hover); }
.tk-tester-status-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border-radius: var(--tk-radius-sm); font-family: var(--tk-font-mono); font-size: 11px; font-weight: 700; background: var(--tk-bg-base); border: 1px solid var(--tk-border-strong); }
.tk-status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--tk-radius-sm); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.tk-status-badge.matched { background: rgba(5, 150, 105, 0.2); color: var(--tk-green); border: 1px solid var(--tk-green); }
.tk-status-badge.unmatched { background: rgba(220, 38, 38, 0.15); color: var(--tk-red); border: 1px solid var(--tk-red); }
.tk-status-badge.error { background: rgba(220, 38, 38, 0.25); color: var(--tk-red); border: 1px solid var(--tk-red); }
.tk-status-badge.disabled { background: rgba(151, 157, 172, 0.2); color: var(--tk-text-muted); border: 1px solid var(--tk-border-strong); }
.tk-regex-highlight-box { background: var(--tk-bg-base); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 8px 10px; font-family: var(--tk-font-mono); font-size: 11px; line-height: 1.5; max-height: 140px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
.tk-regex-match-hl { background: rgba(4, 102, 200, 0.35); color: var(--tk-text); border-bottom: 2px solid var(--tk-accent); border-radius: 2px; padding: 0 1px; font-weight: 700; }
.tk-regex-groups-table { width: 100%; border-collapse: collapse; font-family: var(--tk-font-mono); font-size: 10.5px; margin-top: 4px; }
.tk-regex-groups-table th { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--tk-border-strong); color: var(--tk-text-muted); font-size: 9.5px; text-transform: uppercase; }
.tk-regex-groups-table td { padding: 4px 6px; border-bottom: 1px solid var(--tk-border); color: var(--tk-text); word-break: break-all; }
.tk-route-card { border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 8px 10px; background: var(--tk-bg-base); display: flex; flex-direction: column; gap: 4px; }
.tk-route-card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tk-route-card-title { font-weight: 700; font-size: 11.5px; color: var(--tk-text); }
.tk-route-rules-list { font-family: var(--tk-font-mono); font-size: 10px; margin-top: 4px; display: flex; flex-direction: column; gap: 2px; }
.tk-route-rule-item { display: flex; align-items: center; gap: 6px; color: var(--tk-text-muted); }
.tk-route-rule-item.pass { color: var(--tk-green); }
.tk-route-rule-item.fail { color: var(--tk-red); }

/* Pin Configuration Tab */
#tk-settings-pins { text-align: left; }
.tk-pin-config-list { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; }
.tk-pin-config-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--tk-border); border-radius: var(--tk-radius-sm); background: var(--tk-bg-base); cursor: default; user-select: none; transition: background 0.1s ease, opacity 0.15s ease; }
.tk-pin-config-row:hover { background: var(--tk-bg-hover); }
.tk-pin-config-row.tk-pin-row-dragging { opacity: 0.4; }
.tk-pin-config-row.tk-pin-row-drag-over { border-color: var(--tk-accent); background: var(--tk-bg-hover); box-shadow: 0 0 0 2px rgba(4,102,200,0.25); }
.tk-pin-config-row.tk-pin-disabled { opacity: 0.5; }
.tk-pin-drag-handle { display: inline-flex; align-items: center; justify-content: center; color: var(--tk-text-muted); cursor: grab; flex-shrink: 0; width: 16px; padding: 0 2px; }
.tk-pin-drag-handle:active { cursor: grabbing; }
.tk-pin-config-toggle { flex-shrink: 0; accent-color: var(--tk-accent); width: 14px; height: 14px; cursor: pointer; }
.tk-pin-config-name { flex: 1 1 auto; min-width: 0; font-size: 11px; font-weight: 600; color: var(--tk-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tk-pin-config-name a { color: inherit; text-decoration: none; }
.tk-pin-config-name a:hover { color: var(--tk-accent); text-decoration: underline; }
.tk-pin-config-year { font-family: var(--tk-font-mono); font-size: 9.5px; color: var(--tk-text-muted); flex-shrink: 0; }
.tk-pin-config-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.tk-pin-reorder-btn { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: transparent; border: 1px solid var(--tk-border-strong); color: var(--tk-text-muted); border-radius: var(--tk-radius-sm); cursor: pointer; padding: 0; }
.tk-pin-reorder-btn:hover:not(:disabled) { background: var(--tk-bg-hover); border-color: var(--tk-accent); color: var(--tk-accent); }
.tk-pin-reorder-btn:disabled { opacity: 0.25; cursor: default; }
.tk-pin-reorder-btn:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-pin-remove-btn { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: transparent; border: 1px solid var(--tk-border-strong); color: var(--tk-text-muted); border-radius: var(--tk-radius-sm); cursor: pointer; padding: 0; }
.tk-pin-remove-btn:hover { background: var(--tk-red); border-color: var(--tk-red); color: #fff; }
.tk-pin-remove-btn:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-pin-config-empty { color: var(--tk-text-muted); font-size: 11px; padding: 16px 0; text-align: center; }

@media (max-width: 480px) {
    .tk-route-row { flex-wrap: wrap; }
    .tk-route-row input[type="text"] { flex-basis: 100%; }
}

/* Quick Add Grid Enhancer */
table tr td .tk-inline-add,
.table tr td .tk-inline-add,
.table td .tk-inline-add,
.tk-inline-add {
    display: inline-flex !important;
    flex-direction: row !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
    margin-top: 4px !important;
    margin-bottom: 2px !important;
    width: max-content !important;
    min-width: 0 !important;
    max-width: 100% !important;
    vertical-align: middle !important;
    opacity: 0.95;
    transition: opacity 0.2s ease-in-out;
}
.tk-inline-add:hover {
    opacity: 1;
}
table tr td input.tk-qty-input,
.table tr td input.tk-qty-input,
.table td input.tk-qty-input,
input.tk-qty-input {
    width: 28px !important;
    min-width: 28px !important;
    max-width: 28px !important;
    flex: 0 0 28px !important;
    height: 22px !important;
    text-align: center !important;
    border: 1px solid var(--tk-border-strong) !important;
    border-right: none !important;
    border-radius: var(--tk-radius-sm) 0 0 var(--tk-radius-sm) !important;
    font-size: 11px !important;
    font-family: var(--tk-font-mono) !important;
    padding: 0 !important;
    margin: 0 !important;
    outline: none !important;
    background: var(--tk-bg-elevated) !important;
    color: var(--tk-text) !important;
    box-sizing: border-box !important;
    line-height: 20px !important;
    -moz-appearance: textfield;
}
.tk-qty-input::-webkit-outer-spin-button,
.tk-qty-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
.tk-qty-input:focus {
    border-color: var(--tk-accent) !important;
}
table tr td button.tk-add-btn,
.table tr td button.tk-add-btn,
.table td button.tk-add-btn,
button.tk-add-btn {
    width: 24px !important;
    min-width: 24px !important;
    max-width: 24px !important;
    flex: 0 0 24px !important;
    height: 22px !important;
    background: var(--tk-accent) !important;
    color: #ffffff !important;
    border: 1px solid var(--tk-accent) !important;
    border-radius: 0 var(--tk-radius-sm) var(--tk-radius-sm) 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    font-size: 12px !important;
    font-family: var(--tk-font-ui) !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out !important;
    box-sizing: border-box !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    line-height: 1 !important;
    user-select: none !important;
}
.tk-add-btn:hover:not(:disabled) {
    background: var(--tk-blue) !important;
    border-color: var(--tk-blue) !important;
}
.tk-add-btn:disabled {
    background: var(--tk-border-strong) !important;
    border-color: var(--tk-border-strong) !important;
    color: var(--tk-text-muted) !important;
    cursor: not-allowed !important;
}
.tk-add-btn.tk-add-btn-success {
    background: var(--tk-green) !important;
    border-color: var(--tk-green) !important;
    color: #ffffff !important;
}
.tk-add-btn.tk-add-btn-error {
    background: var(--tk-red) !important;
    border-color: var(--tk-red) !important;
    color: #ffffff !important;
}
`;


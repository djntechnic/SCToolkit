/**
 * Settings modal: global thresholds on one tab, per-module enablement and
 * route rules on the other.
 */

import { Config, SettingsStore, syncExportConfig, configToXml, xmlToConfig } from '../core/config.js';
import { Log, RuntimeSettings } from '../core/log.js';
import { ModuleRegistry } from '../core/registry.js';
import * as cache from '../net/cache.js';
import { createBtn, debounce, injectStyle } from './dom.js';
import { icon } from './icons.js';
import { SETTINGS_CSS } from './styles.js';
import { THEMES, applyTheme } from './theme.js';
import { Routes } from '../core/routes.js';
import { resolveModules } from '../core/registry.js';
import { BLOCK_TS_KEY, getValue } from '../core/storage.js';
import { getContractResults } from '../core/contracts.js';
import { showToast } from './toast.js';
import { Toolbar } from './toolbar.js';
import { reinjectSetActions } from '../modules/setListEnhancer.js';
import { DiagnosticTests } from '../core/diagnostics.js';
import { getAppVersion } from '../core/version.js';

export const SettingsUI = {
  overlayId: 'tk-settings-overlay',

  /** Debounced writer, rebuilt whenever the debounce interval itself changes. */
  _persist: () => {},

  /** Whether the modal's stylesheet has been added to the page yet. */
  _stylesInjected: false,

  init: () => {
    SettingsUI._rebuildPersist();

    const trigger = document.createElement('button');
    trigger.id = 'tk-settings-trigger';
    trigger.type = 'button';
    trigger.className = 'tk-scroll-btn';
    trigger.innerHTML = `${icon('gear')}<span>SETTINGS</span>`;
    trigger.title = 'SCToolkit Settings';
    trigger.setAttribute('aria-label', 'SCToolkit Settings');
    trigger.addEventListener('click', () => SettingsUI.open());

    const statusEl = document.getElementById('tk-status');
    if (statusEl && statusEl.parentNode) {
      statusEl.parentNode.insertBefore(trigger, statusEl);
    }
  },

  /**
   * Rebuild the debounced save.
   *
   * v2.42.0 built this once at startup, so changing the debounce slider had no
   * effect until the next page load — the setting silently described something
   * that was not happening.
   */
  _rebuildPersist: () => {
    SettingsUI._persist = debounce(() => {
      SettingsStore.save(Config);
      Log('Settings saved to GM storage.', 'info');
      showToast({
        message: 'Settings saved — reload the page to apply changes.',
        variant: 'success'
      });
    }, Config.global.settingsSaveDebounceMs);
  },

  open: () => {
    if (document.getElementById(SettingsUI.overlayId)) return;

    // ~55 rules that only matter once this modal exists. Injecting them at page
    // load made every page parse a stylesheet for a panel most sessions never
    // open.
    if (!SettingsUI._stylesInjected) {
      injectStyle(SETTINGS_CSS);
      SettingsUI._stylesInjected = true;
    }

    const overlay = document.createElement('div');
    overlay.id = SettingsUI.overlayId;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) SettingsUI.close();
    });

    const panel = document.createElement('div');
    panel.id = 'tk-settings-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'SCToolkit Settings');
    panel.appendChild(SettingsUI._buildHeader());
    panel.appendChild(SettingsUI._buildTabbedBody());

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Remember where focus came from, so closing returns it rather than
    // dropping the user at the top of the page.
    SettingsUI._returnFocusTo = document.activeElement;
    SettingsUI._trapFocus(panel);
    panel.querySelector('button, input, select')?.focus();
  },

  /**
   * Keep Tab inside the dialog and close on Escape.
   *
   * Without this the keyboard walks straight out of a modal that is still
   * covering the page — the user is then tabbing through content they cannot
   * see or click.
   *
   * @param {HTMLElement} panel
   */
  _trapFocus: (panel) => {
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        SettingsUI.close();
        return;
      }
      if (e.key !== 'Tab') return;

      const isVisible = (el) => (
        typeof el.checkVisibility === 'function'
          ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
          : (el.offsetWidth > 0 || el.offsetHeight > 0 || el.style.display !== 'none')
      );

      const focusable = Array.from(
        panel.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.disabled && isVisible(el));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  },

  close: () => {
    const overlay = document.getElementById(SettingsUI.overlayId);
    if (overlay) overlay.remove();
    SettingsUI._returnFocusTo?.focus?.();
    SettingsUI._returnFocusTo = null;
  },

  _buildHeader: () => {
    const header = document.createElement('div');
    header.id = 'tk-settings-header';

    const title = document.createElement('h2');
    title.textContent = 'SCToolkit Settings';

    const closeBtn = document.createElement('button');
    closeBtn.id = 'tk-settings-close';
    closeBtn.type = 'button';
    closeBtn.innerHTML = icon('x');
    closeBtn.title = 'Close';
    closeBtn.setAttribute('aria-label', 'Close settings');
    closeBtn.addEventListener('click', () => SettingsUI.close());

    header.appendChild(title);
    header.appendChild(closeBtn);
    return header;
  },

  _buildTabbedBody: () => {
    const body = document.createElement('div');
    body.id = 'tk-settings-body';

    const tabBar = document.createElement('div');
    tabBar.id = 'tk-settings-tabs';

    const globalTab = document.createElement('button');
    globalTab.type = 'button';
    globalTab.className = 'tk-settings-tab active';
    globalTab.textContent = 'Global';

    const routesTab = document.createElement('button');
    routesTab.type = 'button';
    routesTab.className = 'tk-settings-tab';
    routesTab.textContent = 'Modules & Routes';

    const diagTab = document.createElement('button');
    diagTab.type = 'button';
    diagTab.className = 'tk-settings-tab';
    diagTab.textContent = 'Diagnostics';

    tabBar.append(globalTab, routesTab, diagTab);

    const content = document.createElement('div');
    content.id = 'tk-settings-tab-content';

    const panes = {
      global: SettingsUI._buildGlobalPane(),
      routes: SettingsUI._buildModulesPane(),
      diagnostics: SettingsUI._buildDiagnosticsPane()
    };
    const tabs = { global: globalTab, routes: routesTab, diagnostics: diagTab };

    Object.values(panes).forEach((pane) => content.appendChild(pane));

    const activate = (name) => {
      Object.entries(tabs).forEach(([key, tab]) => tab.classList.toggle('active', key === name));
      Object.entries(panes).forEach(([key, pane]) => { pane.style.display = key === name ? '' : 'none'; });
      content.scrollTop = 0;
    };

    Object.entries(tabs).forEach(([name, tab]) => tab.addEventListener('click', () => activate(name)));
    activate('global');

    body.appendChild(tabBar);
    body.appendChild(content);
    return body;
  },

  _buildModulesPane: () => {
    const pane = document.createElement('div');
    pane.id = 'tk-settings-modules';

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'tk-settings-section-title';
    sectionTitle.textContent = 'Modules & Routes';
    pane.appendChild(sectionTitle);

    ModuleRegistry.forEach((mod) => {
      const cfg = Config.modules[mod.id];
      if (!cfg) return;

      const row = document.createElement('div');
      row.className = 'tk-settings-module-row';

      const label = document.createElement('label');
      label.className = 'tk-module-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!cfg.enabled;
      checkbox.title = 'Enable or disable this module on matching pages.';
      checkbox.addEventListener('change', () => {
        cfg.enabled = checkbox.checked;
        Log(`Config change: module '${mod.id}' enabled = ${cfg.enabled}`, 'info');
        SettingsUI._persist();
      });

      const nameSpan = document.createElement('span');
      nameSpan.textContent = mod.name;

      label.appendChild(checkbox);
      label.appendChild(nameSpan);
      row.appendChild(label);

      const desc = document.createElement('div');
      desc.className = 'tk-settings-module-desc';
      desc.textContent = mod.description;
      row.appendChild(desc);

      if (mod.actionLabels && Object.keys(mod.actionLabels).length > 0) {
        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'tk-settings-actions';

        Object.keys(mod.actionLabels).forEach((actionKey) => {
          const actionLabel = document.createElement('label');
          const actionCheckbox = document.createElement('input');
          actionCheckbox.type = 'checkbox';
          actionCheckbox.checked = !!cfg.actions[actionKey];
          actionCheckbox.title = 'Toggle this sub-feature independently of the module itself.';
          actionCheckbox.addEventListener('change', () => {
            cfg.actions[actionKey] = actionCheckbox.checked;
            Log(`Config change: module '${mod.id}' action '${actionKey}' = ${actionCheckbox.checked}`, 'info');
            SettingsUI._persist();
          });

          const actionText = document.createElement('span');
          actionText.textContent = mod.actionLabels[actionKey];

          actionLabel.appendChild(actionCheckbox);
          actionLabel.appendChild(actionText);
          actionsWrap.appendChild(actionLabel);
        });

        row.appendChild(actionsWrap);
      }

      row.appendChild(SettingsUI._buildRouteEditor(mod, cfg));
      pane.appendChild(row);
    });

    return pane;
  },

  _buildRouteEditor: (mod, cfg) => {
    const wrap = document.createElement('div');
    wrap.className = 'tk-route-editor';

    const title = document.createElement('div');
    title.className = 'tk-route-editor-title';
    title.textContent = 'Route Patterns';
    wrap.appendChild(title);

    const rowsEl = document.createElement('div');
    rowsEl.className = 'tk-route-rows';
    wrap.appendChild(rowsEl);

    const errorEl = document.createElement('div');
    errorEl.className = 'tk-route-error';

    // Validate every row before committing any of them: a half-applied rule set
    // would silently change which pages the module runs on.
    const commit = debounce(() => {
      const rules = [];
      const errors = [];

      Array.from(rowsEl.children).forEach((rowEl, idx) => {
        const input = rowEl.querySelector('input[type="text"]');
        const select = rowEl.querySelector('select');
        const pattern = input.value.trim();
        rowEl.classList.remove('tk-route-row-invalid');
        if (!pattern) return;
        try {
          new RegExp(pattern, 'i');
          rules.push({ pattern, exclude: select.value === 'exclude' });
        } catch (error) {
          rowEl.classList.add('tk-route-row-invalid');
          errors.push(`Row ${idx + 1}: ${error.message}`);
        }
      });

      if (errors.length > 0) {
        errorEl.textContent = errors.join(' · ');
        return;
      }

      errorEl.textContent = '';
      cfg.urlMatch = rules;
      Log(`Config change: module '${mod.id}' urlMatch updated (${rules.length} rule(s))`, 'info');
      SettingsUI._persist();
    }, 500);

    const addRow = (pattern, exclude) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'tk-route-row';

      const input = document.createElement('input');
      input.type = 'text';
      input.value = pattern || '';
      input.placeholder = 'regex pattern (matches full page URL)';
      input.addEventListener('input', commit);

      const select = document.createElement('select');
      select.title = 'Include: page must match this pattern. Exclude: page must NOT match this pattern.';
      [['include', 'Include'], ['exclude', 'Exclude']].forEach(([value, text]) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        if ((value === 'exclude') === !!exclude) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener('change', commit);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'tk-route-remove-btn';
      removeBtn.innerHTML = icon('x');
      removeBtn.title = 'Remove This Pattern';
      removeBtn.setAttribute('aria-label', 'Remove This Pattern');
      removeBtn.addEventListener('click', () => {
        rowEl.remove();
        commit();
      });

      rowEl.appendChild(input);
      rowEl.appendChild(select);
      rowEl.appendChild(removeBtn);
      rowsEl.appendChild(rowEl);
    };

    const existing = cfg.urlMatch || [];
    if (existing.length === 0) {
      addRow('', false);
    } else {
      existing.forEach((r) => addRow(r.pattern, r.exclude));
    }

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'tk-route-add-btn';
    addBtn.innerHTML = `${icon('plus')}<span>Add Pattern</span>`;
    addBtn.addEventListener('click', () => addRow('', false));

    wrap.appendChild(errorEl);
    wrap.appendChild(addBtn);
    return wrap;
  },

  _buildGlobalPane: () => {
    const pane = document.createElement('div');
    pane.id = 'tk-settings-global';

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'tk-settings-section-title';
    sectionTitle.textContent = 'Global Settings';
    pane.appendChild(sectionTitle);

    GLOBAL_FIELDS.forEach((field) => pane.appendChild(SettingsUI._buildRangeField(field)));

    const themeField = document.createElement('div');
    themeField.className = 'tk-settings-field';
    const themeLabel = document.createElement('label');
    themeLabel.textContent = 'Theme';
    const themeSelect = document.createElement('select');
    themeSelect.title = 'auto follows your operating system. The site itself has no theme to follow.';
    THEMES.forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value.charAt(0).toUpperCase() + value.slice(1);
      if (Config.global.theme === value) opt.selected = true;
      themeSelect.appendChild(opt);
    });
    themeSelect.addEventListener('change', () => {
      Config.global.theme = themeSelect.value;
      // Applies immediately: a theme you have to reload to see is a theme you
      // cannot evaluate while choosing it.
      applyTheme();
      Log(`Config change: global.theme = ${themeSelect.value}`, 'info');
      SettingsUI._persist();
    });
    themeField.append(themeLabel, themeSelect);
    pane.appendChild(themeField);

    const logField = document.createElement('div');
    logField.className = 'tk-settings-field';
    const logLabel = document.createElement('label');
    logLabel.textContent = 'Console Log Level';
    const logSelect = document.createElement('select');
    logSelect.title = 'debug: everything. info: normal operation (default). warn: only problems worth noticing. error: only failures.';
    ['debug', 'info', 'warn', 'error'].forEach((lvl) => {
      const opt = document.createElement('option');
      opt.value = lvl;
      opt.textContent = lvl.charAt(0).toUpperCase() + lvl.slice(1);
      if (Config.global.logLevel === lvl) opt.selected = true;
      logSelect.appendChild(opt);
    });
    logSelect.addEventListener('change', () => {
      Config.global.logLevel = logSelect.value;
      RuntimeSettings.logLevel = logSelect.value;
      Log(`Config change: global.logLevel = ${logSelect.value}`, 'info');
      SettingsUI._persist();
    });
    logField.appendChild(logLabel);
    logField.appendChild(logSelect);
    pane.appendChild(logField);

    const tzField = document.createElement('div');
    tzField.className = 'tk-settings-field';
    const tzLabel = document.createElement('label');
    tzLabel.textContent = 'Log Timezone';
    const tzSelect = document.createElement('select');
    tzSelect.title = 'Select timezone for console/diagnostic logging. Auto-detect uses your local browser timezone with fallback to US Central (America/Chicago).';
    [
      { value: 'auto', label: 'Auto-Detect (Client Local)' },
      { value: 'America/Chicago', label: 'US Central (America/Chicago)' },
      { value: 'America/New_York', label: 'US Eastern (America/New_York)' },
      { value: 'America/Denver', label: 'US Mountain (America/Denver)' },
      { value: 'America/Los_Angeles', label: 'US Pacific (America/Los_Angeles)' },
      { value: 'UTC', label: 'UTC' }
    ].forEach(({ value, label }) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if ((Config.global.timezone || 'auto') === value) opt.selected = true;
      tzSelect.appendChild(opt);
    });
    tzSelect.addEventListener('change', () => {
      Config.global.timezone = tzSelect.value;
      RuntimeSettings.timezone = tzSelect.value;
      Log(`Config change: global.timezone = ${tzSelect.value}`, 'info');
      SettingsUI._persist();
    });
    tzField.append(tzLabel, tzSelect);
    pane.appendChild(tzField);

    const tsFormatField = document.createElement('div');
    tsFormatField.className = 'tk-settings-field';
    const tsFormatLabel = document.createElement('label');
    tsFormatLabel.textContent = 'Log Timestamp Format';
    const tsFormatInput = document.createElement('input');
    tsFormatInput.type = 'text';
    tsFormatInput.value = Config.global.timestampFormat || 'HH:mm:ss.SSS TZ';
    tsFormatInput.style.cssText = 'width:100%; padding:4px 6px; background:var(--tk-bg-base); color:var(--tk-text); border:1px solid var(--tk-border-strong); border-radius:var(--tk-radius-sm); font-family:var(--tk-font-mono); font-size:11px;';
    tsFormatInput.title = 'Tokens: YYYY, YY, MM, DD, HH, hh, mm, ss, SSS, A, TZ';
    tsFormatInput.addEventListener('change', () => {
      const val = tsFormatInput.value.trim() || 'HH:mm:ss.SSS TZ';
      Config.global.timestampFormat = val;
      RuntimeSettings.timestampFormat = val;
      Log(`Config change: global.timestampFormat = ${val}`, 'info');
      SettingsUI._persist();
    });
    const tsFormatHint = document.createElement('div');
    tsFormatHint.className = 'tk-settings-hint';
    tsFormatHint.textContent = 'Tokens: YYYY, YY, MM, DD, HH, hh, mm, ss, SSS, A, TZ (e.g. HH:mm:ss.SSS TZ, YYYYmmDDHHMMSS, YYYY-MM-DD HH:mm:ss)';
    tsFormatField.append(tsFormatLabel, tsFormatInput, tsFormatHint);
    pane.appendChild(tsFormatField);

    const formatterSectionTitle = document.createElement('div');
    formatterSectionTitle.className = 'tk-settings-section-title';
    formatterSectionTitle.textContent = 'Card Name Formatter Settings';
    formatterSectionTitle.style.marginTop = '14px';
    formatterSectionTitle.style.paddingTop = '10px';
    formatterSectionTitle.style.borderTop = '1px solid var(--tk-border)';
    pane.appendChild(formatterSectionTitle);

    const templateField = document.createElement('div');
    templateField.className = 'tk-settings-field';
    const templateLabel = document.createElement('label');
    templateLabel.textContent = 'Template Format';
    const templateInput = document.createElement('input');
    templateInput.type = 'text';
    templateInput.value = Config.global.cardFormatterTemplate || '{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}';
    templateInput.style.cssText = 'width:100%; padding:4px 6px; background:var(--tk-bg-base); color:var(--tk-text); border:1px solid var(--tk-border-strong); border-radius:var(--tk-radius-sm); font-family:var(--tk-font-mono); font-size:11px;';
    templateInput.title = 'Tokens: {PlayerName}, {Year}, {SetName}, {Tags}, {PR}, {CardNo}';
    templateInput.addEventListener('change', () => {
      Config.global.cardFormatterTemplate = templateInput.value.trim();
      Log(`Config change: global.cardFormatterTemplate = ${Config.global.cardFormatterTemplate}`, 'info');
      SettingsUI._persist();
    });
    const templateHint = document.createElement('div');
    templateHint.className = 'tk-settings-hint';
    templateHint.textContent = 'Tokens: {PlayerName}, {Year}, {SetName}, {Tags}, {PR}, {CardNo}';
    templateField.append(templateLabel, templateInput, templateHint);
    pane.appendChild(templateField);

    const outputModeField = document.createElement('div');
    outputModeField.className = 'tk-settings-field';
    const outputModeLabel = document.createElement('label');
    outputModeLabel.textContent = 'Output Mode';
    const outputModeSelect = document.createElement('select');
    outputModeSelect.title = 'popover: show floating copy button near text. clipboard: auto-copy to clipboard.';
    [
      { value: 'popover', label: 'Floating Popover' },
      { value: 'clipboard', label: 'Auto-Copy to Clipboard' }
    ].forEach(({ value, label }) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (Config.global.cardFormatterOutputMode === value) opt.selected = true;
      outputModeSelect.appendChild(opt);
    });
    outputModeSelect.addEventListener('change', () => {
      Config.global.cardFormatterOutputMode = outputModeSelect.value;
      Log(`Config change: global.cardFormatterOutputMode = ${outputModeSelect.value}`, 'info');
      SettingsUI._persist();
    });
    outputModeField.append(outputModeLabel, outputModeSelect);
    pane.appendChild(outputModeField);

    const displaySectionTitle = document.createElement('div');
    displaySectionTitle.className = 'tk-settings-section-title';
    displaySectionTitle.textContent = 'Button Display Settings';
    displaySectionTitle.style.marginTop = '14px';
    displaySectionTitle.style.paddingTop = '10px';
    displaySectionTitle.style.borderTop = '1px solid var(--tk-border)';
    pane.appendChild(displaySectionTitle);

    const DISPLAY_MODES = [
      { value: 'both', label: 'Icon & Text' },
      { value: 'icon', label: 'Icon Only' },
      { value: 'text', label: 'Text Only' }
    ];

    const displayFields = [
      {
        key: 'toolbarButtonDisplay',
        label: 'Toolbar Button Display',
        title: 'Choose whether toolbar shortcut buttons show icons, text, or both.',
        onUpdate: () => Toolbar.renderCenterContext()
      },
      {
        key: 'pinButtonDisplay',
        label: 'Pinned Set Button Display',
        title: 'Choose whether buttons in pinned set dropdowns show icons, text, or both.',
        onUpdate: () => Toolbar.renderPins()
      },
      {
        key: 'setButtonDisplay',
        label: 'Injected Set Button Display',
        title: 'Choose whether buttons injected beside set links on pages show icons, text, or both.',
        onUpdate: () => reinjectSetActions()
      }
    ];

    displayFields.forEach(({ key, label: fieldLabelText, title: fieldTitleText, onUpdate }) => {
      const field = document.createElement('div');
      field.className = 'tk-settings-field';

      const fieldLabel = document.createElement('label');
      fieldLabel.textContent = fieldLabelText;

      const select = document.createElement('select');
      select.title = fieldTitleText;

      DISPLAY_MODES.forEach(({ value, label: optLabel }) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = optLabel;
        if ((Config.global[key] || 'both') === value) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', () => {
        Config.global[key] = select.value;
        Log(`Config change: global.${key} = ${select.value}`, 'info');
        if (onUpdate) onUpdate();
        SettingsUI._persist();
      });

      field.appendChild(fieldLabel);
      field.appendChild(select);
      pane.appendChild(field);
    });

    pane.appendChild(SettingsUI._buildXmlPanel());

    const help = document.createElement('div');
    help.id = 'tk-settings-help';
    help.innerHTML =
      'Module, action, route-pattern, and threshold changes apply on next page load. ' +
      'The log level change above applies immediately to this page’s console output.<br><br>' +
      `Version: ${SettingsUI._version()}<br>` +
      'Documentation and issue tracker: ' +
      '<a href="https://github.com/djntechnic/SCToolkit" target="_blank" rel="noopener noreferrer">github.com/djntechnic/SCToolkit</a>';
    pane.appendChild(help);

    return pane;
  },

  _buildXmlPanel: () => {
    const field = document.createElement('div');
    field.className = 'tk-settings-field';
    field.style.marginTop = '14px';
    field.style.paddingTop = '10px';
    field.style.borderTop = '1px solid var(--tk-border)';

    const label = document.createElement('label');
    label.textContent = 'XML Import / Export Settings';

    const hint = document.createElement('div');
    hint.className = 'tk-settings-hint';
    hint.textContent = 'Backup all SCToolkit settings (globals, module states, sub-actions, route rules) to XML or restore from file.';

    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '8px';
    btnGroup.style.marginTop = '6px';

    const exportBtn = createBtn('tk-xml-export', 'Export XML', () => {
      try {
        const xml = configToXml(Config);
        const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sctoolkit-settings-v${Config.schemaVersion || 3}.xml`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast({ message: 'Settings exported to XML file.', variant: 'success' });
      } catch (err) {
        showToast({ message: `Export failed: ${err.message}`, variant: 'error' });
      }
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xml,text/xml';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new window.FileReader();
      reader.onload = (evt) => {
        try {
          const xmlText = evt.target.result;
          const imported = xmlToConfig(xmlText);
          Config.schemaVersion = imported.schemaVersion;
          Config.global = imported.global;
          Config.modules = imported.modules;

          syncExportConfig();
          applyTheme();
          SettingsStore.save(Config);
          Log('Settings successfully imported from XML file.', 'info');
          showToast({ message: 'Settings imported from XML! Reload page for full module updates.', variant: 'success' });

          const body = document.getElementById('tk-settings-body');
          if (body) {
            const activeTab = body.querySelector('.tk-settings-tab.active')?.textContent?.toLowerCase() || 'global';
            const newBody = SettingsUI._buildTabbedBody();
            body.replaceWith(newBody);
            const targetTabName = activeTab.includes('module') ? 'routes' : activeTab.includes('diag') ? 'diagnostics' : 'global';
            newBody.querySelector(`.tk-settings-tab:${targetTabName === 'routes' ? 'nth-child(2)' : targetTabName === 'diagnostics' ? 'nth-child(3)' : 'first-child'}`)?.click();
          }
        } catch (err) {
          showToast({ message: `Import failed: ${err.message}`, variant: 'error' });
        }
      };
      reader.readAsText(file);
    });

    const importBtn = createBtn('tk-xml-import', 'Import XML', () => {
      fileInput.value = '';
      fileInput.click();
    });

    btnGroup.appendChild(exportBtn);
    btnGroup.appendChild(importBtn);
    btnGroup.appendChild(fileInput);

    field.appendChild(label);
    field.appendChild(hint);
    field.appendChild(btnGroup);
    return field;
  },

  /**
   * What the script currently thinks about this page.
   *
   * Contract-check results, active-module resolution, and the block timestamp
   * previously only ever reached the console — which meant that when a user
   * reported "the filter didn't appear", nobody could tell whether the module
   * had run at all.
   */
  _buildDiagnosticsPane: () => {
    const pane = document.createElement('div');
    pane.id = 'tk-settings-diagnostics';

    const title = document.createElement('div');
    title.className = 'tk-settings-section-title';
    title.textContent = 'Diagnostics';
    pane.appendChild(title);

    const active = resolveModules().map((m) => m.name);
    const lastBlock = getValue(BLOCK_TS_KEY, 0);
    const routes = Object.keys(Routes).filter((key) => {
      try { return Routes[key](); } catch { return false; }
    });

    const themeFormatted = (Config.global.theme || 'auto').charAt(0).toUpperCase() + (Config.global.theme || 'auto').slice(1);
    const resolvedTheme = document.documentElement.getAttribute('data-sctk-theme') || '';
    const resolvedFormatted = resolvedTheme ? (resolvedTheme.charAt(0).toUpperCase() + resolvedTheme.slice(1)) : '';

    const rows = [
      ['Version', SettingsUI._version()],
      ['URL', window.location.pathname + window.location.search],
      ['Matched Routes', routes.length ? routes.join(', ') : 'none'],
      ['Active Modules', active.length ? `${active.length}: ${active.join(', ')}` : 'none on this page'],
      ['Last Block Detected', lastBlock ? new Date(lastBlock).toLocaleString() : 'never'],
      ['Theme', `${themeFormatted}${resolvedFormatted ? ` (Resolved: ${resolvedFormatted})` : ''}`]
    ];

    const table = document.createElement('dl');
    table.className = 'tk-diag-list';
    rows.forEach(([label, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      table.append(dt, dd);
    });
    pane.appendChild(table);

    pane.appendChild(SettingsUI._buildDiagnosticsTestPanel());
    pane.appendChild(SettingsUI._buildContractPanel());
    pane.appendChild(SettingsUI._buildCachePanel());
    return pane;
  },

  /**
   * Render diagnostic self-test results for CSV escaping, Pacing state, and route matching.
   */
  _buildDiagnosticsTestPanel: () => {
    const field = document.createElement('div');
    field.className = 'tk-settings-field';

    const label = document.createElement('label');
    label.textContent = 'Diagnostic Self-Tests';
    field.appendChild(label);

    const testResults = DiagnosticTests.run();
    const list = document.createElement('ul');
    list.className = 'tk-contract-list';

    testResults.forEach(({ name, pass, detail }) => {
      const item = document.createElement('li');
      item.className = pass ? 'ok' : 'bad';
      item.textContent = `${pass ? 'PASS' : 'FAIL'} · ${name} · ${detail}`;
      list.appendChild(item);
    });

    field.appendChild(list);
    return field;
  },

  /**
   * Every DOM assumption checked on this page, and whether it held.
   *
   * This is the answer to "the feature didn't appear". A failing row names the
   * selector that did not match, which turns a vague report into a
   * selector-drift issue someone can act on.
   */
  _buildContractPanel: () => {
    const field = document.createElement('div');
    field.className = 'tk-settings-field';

    const label = document.createElement('label');
    label.textContent = 'Page Contract Checks';
    field.appendChild(label);

    const checks = getContractResults();
    if (checks.length === 0) {
      const none = document.createElement('div');
      none.className = 'tk-settings-hint';
      none.textContent = 'No checks ran — no modules are active on this page.';
      field.appendChild(none);
      return field;
    }

    const list = document.createElement('ul');
    list.className = 'tk-contract-list';
    checks.forEach(({ moduleId, label: text, ok }) => {
      const item = document.createElement('li');
      item.className = ok ? 'ok' : 'bad';
      item.textContent = `${ok ? 'OK' : 'MISSING'} · ${moduleId} · ${text}`;
      list.appendChild(item);
    });
    field.appendChild(list);

    const failed = checks.filter((c) => !c.ok).length;
    if (failed > 0) {
      const hint = document.createElement('div');
      hint.className = 'tk-settings-hint';
      hint.textContent =
        `${failed} check(s) failed. If a feature is missing, this is why — ` +
        'please open a selector-drift issue and paste these lines.';
      field.appendChild(hint);
    }
    return field;
  },

  /**
   * Cache occupancy plus a purge control.
   *
   * Surfacing the numbers matters: a cache that silently serves a stale export
   * is indistinguishable from a bug unless the user can see it exists and empty
   * it.
   */
  _buildCachePanel: () => {
    const field = document.createElement('div');
    field.className = 'tk-settings-field';

    const label = document.createElement('label');
    label.textContent = 'Cached Exports';

    const summary = document.createElement('div');
    summary.className = 'tk-settings-hint';

    const refresh = () => {
      const { sets, rows } = cache.stats(Config.global.exportCacheTtlHours);
      summary.textContent = sets === 0
        ? 'Nothing cached. Completed exports are stored here and reused within the lifetime above.'
        : `${sets} set(s), ${rows} row(s) stored. Re-exporting any of them makes no requests.`;
    };
    refresh();

    const purge = createBtn('tk-cache-purge', 'Clear Cache', () => {
      cache.clear();
      refresh();
      showToast({ message: 'Export cache cleared.', variant: 'success' });
    });

    field.appendChild(label);
    field.appendChild(summary);
    field.appendChild(purge);
    return field;
  },

  /**
   * @param {{label: string, key: string, min: number, max: number, step: number,
   *   unit: string, hint: string}} spec
   */
  _buildRangeField: ({ label: labelText, key, min, max, step, unit, hint }) => {
    const field = document.createElement('div');
    field.className = 'tk-settings-field';

    const label = document.createElement('label');
    const valueSpan = document.createElement('span');
    valueSpan.className = 'tk-field-value';
    valueSpan.textContent = `${Config.global[key]}${unit}`;
    label.append(`${labelText}: `, valueSpan);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(Config.global[key]);
    if (hint) input.title = hint;
    input.setAttribute('aria-label', labelText);

    input.addEventListener('input', () => {
      valueSpan.textContent = `${input.value}${unit}`;
    });
    input.addEventListener('change', () => {
      Config.global[key] = Number(input.value);
      syncExportConfig();
      if (key === 'settingsSaveDebounceMs') SettingsUI._rebuildPersist();
      Log(`Config change: global.${key} = ${Config.global[key]}`, 'info');
      SettingsUI._persist();
    });

    field.appendChild(label);
    field.appendChild(input);
    if (hint) {
      const hintEl = document.createElement('div');
      hintEl.className = 'tk-settings-hint';
      hintEl.textContent = hint;
      field.appendChild(hintEl);
    }
    return field;
  },

  _version: () => getAppVersion()
};

/** Declarative spec for every numeric global setting. */
export const GLOBAL_FIELDS = [
  {
    label: 'Export Base Delay', key: 'exportBaseDelayMs', min: 200, max: 2000, step: 50, unit: 'ms',
    hint: 'Minimum wait between paginated checklist-fetch requests.'
  },
  {
    label: 'Export Jitter', key: 'exportJitterMaxMs', min: 0, max: 2000, step: 50, unit: 'ms',
    hint: 'Random amount added on top of the base delay, so request timing isn’t a fixed, fingerprintable interval.'
  },
  {
    label: 'Max Retries Per Page', key: 'exportMaxRetries', min: 0, max: 8, step: 1, unit: '',
    hint: 'Retry attempts for a single page on HTTP 429/503 before the export fails.'
  },
  {
    label: 'Retry Backoff — Base', key: 'exportBackoffBaseMs', min: 250, max: 5000, step: 250, unit: 'ms',
    hint: 'Starting wait before the first retry; doubles on each subsequent attempt up to the cap below.'
  },
  {
    label: 'Retry Backoff — Cap', key: 'exportBackoffCapMs', min: 2000, max: 60000, step: 1000, unit: 'ms',
    hint: 'Upper limit on the doubling backoff delay, regardless of retry count.'
  },
  {
    label: 'Pagination Safety Ceiling', key: 'exportMaxPages', min: 20, max: 500, step: 10, unit: ' pages',
    hint: 'Hard stop on discovered page count — protects against a pagination-parsing bug turning into a runaway fetch loop.'
  },
  {
    label: 'Request Timeout', key: 'exportRequestTimeoutMs', min: 5000, max: 120000, step: 5000, unit: 'ms',
    hint: 'Abandon a single request that never answers. Without this a hung request stalls the whole export queue indefinitely.'
  },
  {
    label: 'Anti-Scraping Cooldown', key: 'exportBlockCooldownMinutes', min: 0, max: 30, step: 1, unit: ' min',
    hint: 'After a detected block (captcha/verification page), refuse new exports for this long. 0 disables the cooldown.'
  },
  {
    label: 'Export Cache Lifetime', key: 'exportCacheTtlHours', min: 0, max: 168, step: 1, unit: ' h',
    hint: 'Re-exporting a set within this window reuses the stored result and makes no requests at all. 0 disables caching.'
  },
  {
    label: 'Toast Display Duration', key: 'toastDurationMs', min: 1500, max: 10000, step: 250, unit: 'ms',
    hint: 'How long status/confirmation toasts stay visible before fading out.'
  },
  {
    label: 'Checklist Filter Debounce', key: 'checklistFilterDebounceMs', min: 0, max: 500, step: 25, unit: 'ms',
    hint: 'Delay after typing stops before the real-time table filter re-scans rows.'
  },
  {
    label: 'Pagination Loader Delay', key: 'paginationLoaderDelayMs', min: 300, max: 3000, step: 100, unit: 'ms',
    hint: 'Fixed wait before the CSV export button is enabled on paginated pages. Not a real completion signal — still a timing guess, just a configurable one.'
  },
  {
    label: 'Settings Save Debounce', key: 'settingsSaveDebounceMs', min: 100, max: 2000, step: 100, unit: 'ms',
    hint: 'How long to wait after the last settings change before writing to storage.'
  },
  {
    label: 'Card Formatter Popover Duration', key: 'cardFormatterPopoverDurationMs', min: 1000, max: 10000, step: 500, unit: 'ms',
    hint: 'How long the floating copy popover stays visible before auto-dismissing.'
  }
];

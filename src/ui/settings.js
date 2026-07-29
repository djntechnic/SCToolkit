/**
 * Settings modal: global thresholds on one tab, per-module enablement and
 * route rules on the other.
 */

import { Config, SettingsStore, syncExportConfig } from '../core/config.js';
import { Log, RuntimeSettings } from '../core/log.js';
import { ModuleRegistry } from '../core/registry.js';
import { debounce, injectStyle } from './dom.js';
import { Icons } from './icons.js';
import { SETTINGS_CSS } from './styles.js';
import { showToast } from './toast.js';

export const SettingsUI = {
  overlayId: 'tk-settings-overlay',

  /** Debounced writer, rebuilt whenever the debounce interval itself changes. */
  _persist: () => {},

  init: () => {
    injectStyle(SETTINGS_CSS);
    SettingsUI._rebuildPersist();

    const trigger = document.createElement('button');
    trigger.id = 'tk-settings-trigger';
    trigger.type = 'button';
    trigger.className = 'tk-scroll-btn';
    trigger.innerHTML = Icons.gear();
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
        accent: 'var(--tk-green)'
      });
    }, Config.global.settingsSaveDebounceMs);
  },

  open: () => {
    if (document.getElementById(SettingsUI.overlayId)) return;

    const overlay = document.createElement('div');
    overlay.id = SettingsUI.overlayId;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) SettingsUI.close();
    });

    const panel = document.createElement('div');
    panel.id = 'tk-settings-panel';
    panel.appendChild(SettingsUI._buildHeader());
    panel.appendChild(SettingsUI._buildTabbedBody());

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  },

  close: () => {
    const overlay = document.getElementById(SettingsUI.overlayId);
    if (overlay) overlay.remove();
  },

  _buildHeader: () => {
    const header = document.createElement('div');
    header.id = 'tk-settings-header';

    const title = document.createElement('h2');
    title.textContent = 'SCToolkit Settings';

    const closeBtn = document.createElement('button');
    closeBtn.id = 'tk-settings-close';
    closeBtn.type = 'button';
    closeBtn.innerHTML = Icons.x();
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

    tabBar.appendChild(globalTab);
    tabBar.appendChild(routesTab);

    const content = document.createElement('div');
    content.id = 'tk-settings-tab-content';

    const globalPane = SettingsUI._buildGlobalPane();
    const modulesPane = SettingsUI._buildModulesPane();
    modulesPane.style.display = 'none';

    content.appendChild(globalPane);
    content.appendChild(modulesPane);

    const activate = (tab) => {
      globalTab.classList.toggle('active', tab === 'global');
      routesTab.classList.toggle('active', tab === 'routes');
      globalPane.style.display = tab === 'global' ? '' : 'none';
      modulesPane.style.display = tab === 'routes' ? '' : 'none';
      content.scrollTop = 0;
    };

    globalTab.addEventListener('click', () => activate('global'));
    routesTab.addEventListener('click', () => activate('routes'));

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
    title.textContent = 'Route patterns';
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
      removeBtn.innerHTML = Icons.x();
      removeBtn.title = 'Remove this pattern';
      removeBtn.setAttribute('aria-label', 'Remove this pattern');
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
    addBtn.innerHTML = `${Icons.plus()}<span>Add pattern</span>`;
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

    const logField = document.createElement('div');
    logField.className = 'tk-settings-field';
    const logLabel = document.createElement('label');
    logLabel.textContent = 'Console log level';
    const logSelect = document.createElement('select');
    logSelect.title = 'debug: everything. info: normal operation (default). warn: only problems worth noticing. error: only failures.';
    ['debug', 'info', 'warn', 'error'].forEach((lvl) => {
      const opt = document.createElement('option');
      opt.value = lvl;
      opt.textContent = lvl;
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

  _version: () => {
    try {
      if (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) {
        return GM_info.script.version;
      }
    } catch { /* GM_info unavailable outside a userscript manager */ }
    return 'unknown';
  }
};

/** Declarative spec for every numeric global setting. */
export const GLOBAL_FIELDS = [
  {
    label: 'Export base delay', key: 'exportBaseDelayMs', min: 200, max: 2000, step: 50, unit: 'ms',
    hint: 'Minimum wait between paginated checklist-fetch requests.'
  },
  {
    label: 'Export jitter', key: 'exportJitterMaxMs', min: 0, max: 2000, step: 50, unit: 'ms',
    hint: 'Random amount added on top of the base delay, so request timing isn’t a fixed, fingerprintable interval.'
  },
  {
    label: 'Max retries per page', key: 'exportMaxRetries', min: 0, max: 8, step: 1, unit: '',
    hint: 'Retry attempts for a single page on HTTP 429/503 before the export fails.'
  },
  {
    label: 'Retry backoff — base', key: 'exportBackoffBaseMs', min: 250, max: 5000, step: 250, unit: 'ms',
    hint: 'Starting wait before the first retry; doubles on each subsequent attempt up to the cap below.'
  },
  {
    label: 'Retry backoff — cap', key: 'exportBackoffCapMs', min: 2000, max: 60000, step: 1000, unit: 'ms',
    hint: 'Upper limit on the doubling backoff delay, regardless of retry count.'
  },
  {
    label: 'Pagination safety ceiling', key: 'exportMaxPages', min: 20, max: 500, step: 10, unit: ' pages',
    hint: 'Hard stop on discovered page count — protects against a pagination-parsing bug turning into a runaway fetch loop.'
  },
  {
    label: 'Anti-scraping cooldown', key: 'exportBlockCooldownMinutes', min: 0, max: 30, step: 1, unit: ' min',
    hint: 'After a detected block (captcha/verification page), refuse new exports for this long. 0 disables the cooldown.'
  },
  {
    label: 'Toast display duration', key: 'toastDurationMs', min: 1500, max: 10000, step: 250, unit: 'ms',
    hint: 'How long status/confirmation toasts stay visible before fading out.'
  },
  {
    label: 'Checklist filter debounce', key: 'checklistFilterDebounceMs', min: 0, max: 500, step: 25, unit: 'ms',
    hint: 'Delay after typing stops before the real-time table filter re-scans rows.'
  },
  {
    label: 'Pagination loader delay', key: 'paginationLoaderDelayMs', min: 300, max: 3000, step: 100, unit: 'ms',
    hint: 'Fixed wait before the CSV export button is enabled on paginated pages. Not a real completion signal — still a timing guess, just a configurable one.'
  },
  {
    label: 'Settings save debounce', key: 'settingsSaveDebounceMs', min: 100, max: 2000, step: 100, unit: 'ms',
    hint: 'How long to wait after the last settings change before writing to storage.'
  }
];

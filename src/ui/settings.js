/**
 * Settings modal: global thresholds on one tab, per-module enablement and
 * route rules on the other.
 */

import { Config, SettingsStore, syncExportConfig, configToXml, xmlToConfig, testUrlMatch } from '../core/config.js';
import { Log, RuntimeSettings } from '../core/log.js';
import { ModuleRegistry } from '../core/registry.js';
import * as cache from '../net/cache.js';
import { createBtn, debounce, injectStyle } from './dom.js';
import { icon } from './icons.js';
import { SETTINGS_CSS } from './styles.js';
import { THEMES, applyTheme } from './theme.js';
import { Routes } from '../core/routes.js';
import { resolveModules } from '../core/registry.js';
import { BLOCK_TS_KEY, getValue, Pins } from '../core/storage.js';
import { getContractResults } from '../core/contracts.js';
import { showToast } from './toast.js';
import { Toolbar } from './toolbar.js';
import { reinjectSetActions } from '../modules/setListEnhancer.js';
import { DiagnosticTests } from '../core/diagnostics.js';
import { getAppVersion } from '../core/version.js';
import { BADGES } from './badges.js';

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

    const pinsTab = document.createElement('button');
    pinsTab.type = 'button';
    pinsTab.className = 'tk-settings-tab';
    pinsTab.textContent = 'Pins';

    const routesTab = document.createElement('button');
    routesTab.type = 'button';
    routesTab.className = 'tk-settings-tab';
    routesTab.textContent = 'Modules & Routes';

    const regexTab = document.createElement('button');
    regexTab.type = 'button';
    regexTab.className = 'tk-settings-tab';
    regexTab.textContent = 'RegEx Tester';

    const routeTesterTab = document.createElement('button');
    routeTesterTab.type = 'button';
    routeTesterTab.className = 'tk-settings-tab';
    routeTesterTab.textContent = 'Route Tester';

    const diagTab = document.createElement('button');
    diagTab.type = 'button';
    diagTab.className = 'tk-settings-tab';
    diagTab.textContent = 'Diagnostics';


    const badgesTab = document.createElement('button');
    badgesTab.type = 'button';
    badgesTab.className = 'tk-settings-tab';
    badgesTab.textContent = 'Badges';

    tabBar.append(globalTab, pinsTab, badgesTab, routesTab, regexTab, routeTesterTab, diagTab);

    const content = document.createElement('div');
    content.id = 'tk-settings-tab-content';

    const panes = {
      global: SettingsUI._buildGlobalPane(),
      pins: SettingsUI._buildPinsPane(),
      badges: SettingsUI._buildBadgesPane(),
      routes: SettingsUI._buildModulesPane(),
      regex: SettingsUI._buildRegexPane(),
      routetester: SettingsUI._buildRouteTesterPane(),
      diagnostics: SettingsUI._buildDiagnosticsPane()
    };
    const tabs = {
      global: globalTab,
      pins: pinsTab,
      badges: badgesTab,
      routes: routesTab,
      regex: regexTab,
      routetester: routeTesterTab,
      diagnostics: diagTab
    };

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

  /**
   * Pin Configuration tab.
   *
   * Lists every stored pin with a toggle (enabled/disabled), a drag handle for
   * reordering, Up/Down keyboard controls, and a remove button. Every mutation
   * writes immediately to storage and re-renders the toolbar.
   */
  _buildPinsPane: () => {
    const pane = document.createElement('div');
    pane.id = 'tk-settings-pins';

    const title = document.createElement('div');
    title.className = 'tk-settings-section-title';
    title.textContent = 'Pin Configuration';
    pane.appendChild(title);

    const hint = document.createElement('div');
    hint.className = 'tk-settings-hint';
    hint.style.marginBottom = '10px';
    hint.textContent =
      'Toggle pins on/off and drag rows (or use the ↑↓ buttons) to set their order. ' +
      'Disabled pins are hidden from the toolbar but remain saved. Changes apply immediately.';
    pane.appendChild(hint);

    const list = document.createElement('div');
    list.className = 'tk-pin-config-list';
    pane.appendChild(list);

    // ------------------------------------------------------------------ //
    // Internal state: a mutable working copy of the pin array.            //
    // Every mutation rebuilds the list DOM and flushes to storage.        //
    // ------------------------------------------------------------------ //
    let workingPins = Pins.all(); // live reference, mutated in place

    const flush = () => {
      Pins.reorder(workingPins);
      Toolbar.renderPins();
    };

    const rebuild = () => {
      list.innerHTML = '';
      workingPins = Pins.all(); // re-read after external changes (remove via toolbar)

      if (workingPins.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'tk-pin-config-empty';
        empty.textContent = 'No pins saved. Pin a set from any set page to get started.';
        list.appendChild(empty);
        return;
      }

      workingPins.forEach((pin, idx) => {
        const row = document.createElement('div');
        row.className = 'tk-pin-config-row' + (pin.enabled === false ? ' tk-pin-disabled' : '');
        row.draggable = true;
        row.dataset.pinId = pin.id;

        // --- Drag handle ---
        const handle = document.createElement('span');
        handle.className = 'tk-pin-drag-handle';
        handle.title = 'Drag to reorder';
        handle.innerHTML = '&#9776;'; // ≡ hamburger
        handle.setAttribute('aria-hidden', 'true');
        row.appendChild(handle);

        // --- Enable toggle ---
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.className = 'tk-pin-config-toggle';
        toggle.checked = pin.enabled !== false;
        toggle.title = toggle.checked ? 'Disable this pin' : 'Enable this pin';
        toggle.setAttribute('aria-label', `Toggle ${pin.name}`);
        toggle.addEventListener('change', () => {
          Pins.toggle(pin.id);
          workingPins = Pins.all();
          Toolbar.renderPins();
          rebuild();
          Log(`Pin '${pin.name}' ${toggle.checked ? 'enabled' : 'disabled'}.`, 'debug');
        });
        row.appendChild(toggle);

        // --- Name (clickable link) ---
        const nameWrap = document.createElement('span');
        nameWrap.className = 'tk-pin-config-name';
        const nameLink = document.createElement('a');
        nameLink.href = pin.url;
        nameLink.textContent = pin.name;
        nameLink.title = `Navigate to ${pin.name}`;
        nameWrap.appendChild(nameLink);
        row.appendChild(nameWrap);

        // --- Year label ---
        const yearLabel = document.createElement('span');
        yearLabel.className = 'tk-pin-config-year';
        yearLabel.textContent = pin.year || '';
        row.appendChild(yearLabel);

        // --- Reorder + Remove actions ---
        const actions = document.createElement('span');
        actions.className = 'tk-pin-config-actions';

        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'tk-pin-reorder-btn';
        upBtn.title = 'Move up';
        upBtn.setAttribute('aria-label', `Move ${pin.name} up`);
        upBtn.innerHTML = '&#8593;';
        upBtn.disabled = idx === 0;
        upBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (idx === 0) return;
          workingPins = Pins.all();
          [workingPins[idx - 1], workingPins[idx]] = [workingPins[idx], workingPins[idx - 1]];
          flush();
          rebuild();
        });

        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'tk-pin-reorder-btn';
        downBtn.title = 'Move down';
        downBtn.setAttribute('aria-label', `Move ${pin.name} down`);
        downBtn.innerHTML = '&#8595;';
        downBtn.disabled = idx === workingPins.length - 1;
        downBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (idx === workingPins.length - 1) return;
          workingPins = Pins.all();
          [workingPins[idx], workingPins[idx + 1]] = [workingPins[idx + 1], workingPins[idx]];
          flush();
          rebuild();
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'tk-pin-remove-btn';
        removeBtn.title = `Remove ${pin.name}`;
        removeBtn.setAttribute('aria-label', `Remove pin: ${pin.name}`);
        removeBtn.innerHTML = icon('x');
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          Pins.remove(pin.id);
          workingPins = Pins.all();
          Toolbar.renderPins();
          rebuild();
          Log(`Pin removed from settings: ${pin.name}`, 'debug');
        });

        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        actions.appendChild(removeBtn);
        row.appendChild(actions);

        // ---------------------------------------------------------------- //
        // HTML5 drag-and-drop reordering                                   //
        // ---------------------------------------------------------------- //
        row.addEventListener('dragstart', (e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(idx));
          setTimeout(() => row.classList.add('tk-pin-row-dragging'), 0);
        });

        row.addEventListener('dragend', () => {
          row.classList.remove('tk-pin-row-dragging');
          list.querySelectorAll('.tk-pin-row-drag-over').forEach((r) => r.classList.remove('tk-pin-row-drag-over'));
        });

        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          list.querySelectorAll('.tk-pin-row-drag-over').forEach((r) => r.classList.remove('tk-pin-row-drag-over'));
          row.classList.add('tk-pin-row-drag-over');
        });

        row.addEventListener('dragleave', () => {
          row.classList.remove('tk-pin-row-drag-over');
        });

        row.addEventListener('drop', (e) => {
          e.preventDefault();
          row.classList.remove('tk-pin-row-drag-over');
          const srcIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (isNaN(srcIdx) || srcIdx === idx) return;
          workingPins = Pins.all();
          const [moved] = workingPins.splice(srcIdx, 1);
          workingPins.splice(idx, 0, moved);
          flush();
          rebuild();
        });

        list.appendChild(row);
      });
    };

    rebuild();
    return pane;
  },

  /**
   * Badge Configuration tab.
   *
   * Two groups — Toolbar Badges and Set Link Badges — each rendered as a
   * draggable, togglable list. Changes write to Config.global and live-update
   * the toolbar / injected badge groups immediately.
   */
  _buildBadgesPane: () => {
    const pane = document.createElement('div');
    pane.id = 'tk-settings-badges';

    const title = document.createElement('div');
    title.className = 'tk-settings-section-title';
    title.textContent = 'Badge Configuration';
    pane.appendChild(title);

    const hint = document.createElement('div');
    hint.className = 'tk-settings-hint';
    hint.style.marginBottom = '12px';
    hint.textContent =
      'Toggle individual action badges on/off and drag rows (or use the ↑↓ buttons) to set their order. ' +
      'Changes apply immediately to the toolbar and injected set-link badges.';
    pane.appendChild(hint);

    /**
     * Build one sortable/togglable badge list section.
     *
     * @param {string} sectionTitle
     * @param {string} configKey  - 'toolbarBadges' | 'setLinkBadges'
     * @param {() => void} onApply  - called after any change to re-render the UI
     */
    const buildSection = (sectionTitle, configKey, onApply) => {
      const section = document.createElement('div');
      section.style.marginBottom = '16px';

      const secTitle = document.createElement('div');
      secTitle.style.cssText = 'font-family:var(--tk-font-mono);font-size:10px;font-weight:700;color:var(--tk-teal);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;';
      secTitle.textContent = sectionTitle;
      section.appendChild(secTitle);

      const list = document.createElement('div');
      list.className = 'tk-pin-config-list';
      section.appendChild(list);

      const getEntries = () => Config.global[configKey] || [];

      const flush = () => {
        SettingsUI._persist();
        onApply();
      };

      const rebuild = () => {
        list.innerHTML = '';
        const entries = getEntries();

        entries.forEach((entry, idx) => {
          const badgeDef = BADGES[entry.key];
          if (!badgeDef) return; // skip unknown keys

          const row = document.createElement('div');
          row.className = 'tk-pin-config-row' + (entry.enabled === false ? ' tk-pin-disabled' : '');
          row.draggable = true;
          row.dataset.badgeKey = entry.key;

          // --- Drag handle ---
          const handle = document.createElement('span');
          handle.className = 'tk-pin-drag-handle';
          handle.title = 'Drag to reorder';
          handle.innerHTML = '&#9776;';
          handle.setAttribute('aria-hidden', 'true');
          row.appendChild(handle);

          // --- Enable toggle ---
          const toggle = document.createElement('input');
          toggle.type = 'checkbox';
          toggle.className = 'tk-pin-config-toggle';
          toggle.checked = entry.enabled !== false;
          toggle.title = toggle.checked ? 'Disable this badge' : 'Enable this badge';
          toggle.setAttribute('aria-label', `Toggle ${badgeDef.text || entry.key} badge`);
          toggle.addEventListener('change', () => {
            entry.enabled = toggle.checked;
            row.classList.toggle('tk-pin-disabled', !toggle.checked);
            Log(`Config change: ${configKey}[${entry.key}].enabled = ${toggle.checked}`, 'info');
            flush();
          });
          row.appendChild(toggle);

          // --- Badge name ---
          const nameWrap = document.createElement('span');
          nameWrap.className = 'tk-pin-config-name';
          nameWrap.textContent = badgeDef.title || entry.key;
          row.appendChild(nameWrap);

          // --- Badge key chip ---
          const keyChip = document.createElement('span');
          keyChip.className = 'tk-pin-config-year';
          keyChip.textContent = badgeDef.text || entry.key;
          row.appendChild(keyChip);

          // --- Reorder + actions ---
          const actions = document.createElement('span');
          actions.className = 'tk-pin-config-actions';

          const upBtn = document.createElement('button');
          upBtn.type = 'button';
          upBtn.className = 'tk-pin-reorder-btn';
          upBtn.title = 'Move up';
          upBtn.setAttribute('aria-label', `Move ${entry.key} up`);
          upBtn.innerHTML = '&#8593;';
          upBtn.disabled = idx === 0;
          upBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (idx === 0) return;
            const arr = getEntries();
            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
            Config.global[configKey] = arr;
            Log(`Config change: ${configKey} reordered`, 'info');
            flush();
            rebuild();
          });

          const downBtn = document.createElement('button');
          downBtn.type = 'button';
          downBtn.className = 'tk-pin-reorder-btn';
          downBtn.title = 'Move down';
          downBtn.setAttribute('aria-label', `Move ${entry.key} down`);
          downBtn.innerHTML = '&#8595;';
          downBtn.disabled = idx === entries.length - 1;
          downBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (idx === entries.length - 1) return;
            const arr = getEntries();
            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
            Config.global[configKey] = arr;
            Log(`Config change: ${configKey} reordered`, 'info');
            flush();
            rebuild();
          });

          actions.appendChild(upBtn);
          actions.appendChild(downBtn);
          row.appendChild(actions);

          // --- HTML5 drag-and-drop ---
          row.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(idx));
            setTimeout(() => row.classList.add('tk-pin-row-dragging'), 0);
          });

          row.addEventListener('dragend', () => {
            row.classList.remove('tk-pin-row-dragging');
            list.querySelectorAll('.tk-pin-row-drag-over').forEach((r) => r.classList.remove('tk-pin-row-drag-over'));
          });

          row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            list.querySelectorAll('.tk-pin-row-drag-over').forEach((r) => r.classList.remove('tk-pin-row-drag-over'));
            row.classList.add('tk-pin-row-drag-over');
          });

          row.addEventListener('dragleave', () => {
            row.classList.remove('tk-pin-row-drag-over');
          });

          row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.classList.remove('tk-pin-row-drag-over');
            const srcIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
            if (isNaN(srcIdx) || srcIdx === idx) return;
            const arr = getEntries();
            const [moved] = arr.splice(srcIdx, 1);
            arr.splice(idx, 0, moved);
            Config.global[configKey] = arr;
            Log(`Config change: ${configKey} reordered via drag`, 'info');
            flush();
            rebuild();
          });

          list.appendChild(row);
        });
      };

      rebuild();
      return section;
    };

    pane.appendChild(buildSection(
      'Toolbar Badges',
      'toolbarBadges',
      () => Toolbar.renderCenterContext()
    ));

    pane.appendChild(buildSection(
      'Set Link Badges',
      'setLinkBadges',
      () => reinjectSetActions()
    ));

    return pane;
  },

  _buildModulesPane: () => {
    const pane = document.createElement('div');
    pane.id = 'tk-settings-modules';

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'tk-settings-section-title';
    sectionTitle.textContent = 'Modules & Routes';
    pane.appendChild(sectionTitle);

    // Alphabetize modules by display name
    const sortedModules = [...ModuleRegistry].sort((a, b) => a.name.localeCompare(b.name));

    sortedModules.forEach((mod) => {
      const cfg = Config.modules[mod.id];
      if (!cfg) return;

      const row = document.createElement('div');
      row.className = 'tk-settings-module-row tk-accordion-item';

      const header = document.createElement('div');
      header.className = 'tk-accordion-header';

      const headerLeft = document.createElement('div');
      headerLeft.className = 'tk-accordion-header-left';

      const label = document.createElement('label');
      label.className = 'tk-module-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!cfg.enabled;
      checkbox.title = 'Enable or disable this module on matching pages.';
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      checkbox.addEventListener('change', () => {
        cfg.enabled = checkbox.checked;
        Log(`Config change: module '${mod.id}' enabled = ${cfg.enabled}`, 'info');
        SettingsUI._persist();
      });

      const nameSpan = document.createElement('span');
      nameSpan.className = 'tk-module-name';
      nameSpan.textContent = mod.name;

      label.appendChild(checkbox);
      label.appendChild(nameSpan);

      const desc = document.createElement('div');
      desc.className = 'tk-settings-module-desc';
      desc.textContent = mod.description;

      headerLeft.appendChild(label);
      headerLeft.appendChild(desc);
      header.appendChild(headerLeft);

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'tk-accordion-toggle-btn';
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.setAttribute('aria-label', `Expand routes for ${mod.name}`);
      toggleBtn.title = 'Expand route patterns';
      toggleBtn.innerHTML = icon('chevronDown');

      header.appendChild(toggleBtn);
      row.appendChild(header);

      const body = document.createElement('div');
      body.className = 'tk-accordion-body';
      body.style.display = 'none';

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

        body.appendChild(actionsWrap);
      }

      body.appendChild(SettingsUI._buildRouteEditor(mod, cfg));
      row.appendChild(body);

      const toggleAccordion = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.closest('label.tk-module-label')) {
          return;
        }
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        toggleBtn.setAttribute('aria-expanded', String(!isOpen));
        row.classList.toggle('tk-accordion-open', !isOpen);
      };

      header.addEventListener('click', toggleAccordion);
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

  _buildCollapsibleSection: (title, contentElements, description = '', defaultExpanded = false) => {
    const section = document.createElement('div');
    section.className = 'tk-settings-collapsible-section';
    section.style.cssText = 'margin-bottom:12px; border:1px solid var(--tk-border); border-radius:var(--tk-radius-md); overflow:hidden; background:var(--tk-bg-surface);';

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'tk-settings-section-header';
    header.style.cssText = 'width:100%; display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--tk-bg-subtle); border:none; color:var(--tk-teal); font-weight:700; font-size:12px; letter-spacing:0.5px; text-transform:uppercase; cursor:pointer; text-align:left; user-select:none; transition:background 0.15s ease;';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;

    const toggleIconSpan = document.createElement('span');
    toggleIconSpan.className = 'tk-section-toggle-icon';
    toggleIconSpan.style.cssText = 'display:inline-flex; align-items:center; transition:transform 0.2s ease;';
    toggleIconSpan.innerHTML = icon('chevronDown');

    header.appendChild(titleSpan);
    header.appendChild(toggleIconSpan);

    const body = document.createElement('div');
    body.className = 'tk-settings-section-body';
    body.style.cssText = 'padding:12px 14px; border-top:1px solid var(--tk-border);';

    if (description) {
      const desc = document.createElement('div');
      desc.className = 'tk-settings-hint';
      desc.style.marginBottom = '10px';
      desc.textContent = description;
      body.appendChild(desc);
    }

    if (Array.isArray(contentElements)) {
      contentElements.forEach((el) => {
        if (el) body.appendChild(el);
      });
    } else if (contentElements) {
      body.appendChild(contentElements);
    }

    let isExpanded = defaultExpanded;
    const updateState = () => {
      body.style.display = isExpanded ? 'block' : 'none';
      toggleIconSpan.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
      header.setAttribute('aria-expanded', String(isExpanded));
    };

    header.addEventListener('click', () => {
      isExpanded = !isExpanded;
      updateState();
    });

    section._setExpanded = (expanded) => {
      isExpanded = expanded;
      updateState();
    };

    section._isExpanded = () => isExpanded;
    section._defaultExpanded = defaultExpanded;

    updateState();

    section.appendChild(header);
    section.appendChild(body);
    return section;
  },

  _buildGlobalPane: () => {
    const pane = document.createElement('div');
    pane.id = 'tk-settings-global';

    // Search Bar Component (Global Pane Only)
    const searchWrap = document.createElement('div');
    searchWrap.id = 'tk-settings-search-wrap';
    searchWrap.style.cssText = 'margin-bottom:12px; display:flex; align-items:center; gap:8px;';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'tk-settings-search-input';
    searchInput.placeholder = 'Search global settings (e.g. pacing, retry, delay, theme, cache)...';
    searchInput.style.cssText = 'flex:1; padding:6px 10px; border-radius:var(--tk-radius-sm); border:1px solid var(--tk-border-strong); background:var(--tk-bg-base); color:var(--tk-text); font-size:12px; outline:none;';

    const clearSearchBtn = document.createElement('button');
    clearSearchBtn.type = 'button';
    clearSearchBtn.style.cssText = 'background:none; border:none; color:var(--tk-text-muted); cursor:pointer; padding:4px; display:none; align-items:center; justify-content:center;';
    clearSearchBtn.innerHTML = icon('x');
    clearSearchBtn.title = 'Clear search filter';

    searchWrap.append(searchInput, clearSearchBtn);
    pane.appendChild(searchWrap);

    const filterGlobalSettings = (query) => {
      const q = query.trim().toLowerCase();
      clearSearchBtn.style.display = q ? 'inline-flex' : 'none';

      const globalSections = pane.querySelectorAll('.tk-settings-collapsible-section');
      globalSections.forEach((section) => {
        if (!q) {
          section.style.display = '';
          if (typeof section._setExpanded === 'function') {
            section._setExpanded(section._defaultExpanded ?? false);
          }
          const fields = section.querySelectorAll('.tk-settings-field');
          fields.forEach((f) => { f.style.display = ''; });
          return;
        }

        const sectionHeaderText = section.querySelector('.tk-settings-section-header')?.textContent?.toLowerCase() || '';
        const fields = section.querySelectorAll('.tk-settings-field');
        let matchedCount = 0;

        fields.forEach((field) => {
          const text = field.textContent.toLowerCase();
          const matches = sectionHeaderText.includes(q) || text.includes(q);
          field.style.display = matches ? '' : 'none';
          if (matches) matchedCount++;
        });

        if (sectionHeaderText.includes(q) || matchedCount > 0) {
          section.style.display = '';
          if (typeof section._setExpanded === 'function') {
            section._setExpanded(true);
          }
        } else {
          section.style.display = 'none';
        }
      });
    };

    searchInput.addEventListener('input', () => filterGlobalSettings(searchInput.value));
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      filterGlobalSettings('');
      searchInput.focus();
    });

    GLOBAL_SECTIONS.forEach((section) => {
      const fields = section.fields.map((field) => SettingsUI._buildRangeField(field));
      pane.appendChild(
        SettingsUI._buildCollapsibleSection(section.title, fields, section.description, false)
      );
    });

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
      applyTheme();
      Log(`Config change: global.theme = ${themeSelect.value}`, 'info');
      SettingsUI._persist();
    });
    themeField.append(themeLabel, themeSelect);

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

    pane.appendChild(
      SettingsUI._buildCollapsibleSection(
        'Appearance & Diagnostic Logging',
        [themeField, logField, tzField, tsFormatField],
        'Control visual dark/light themes and console logger formatting.',
        false
      )
    );

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

    pane.appendChild(
      SettingsUI._buildCollapsibleSection(
        'Card Name Formatter Settings',
        [templateField, outputModeField],
        'Configure custom copy templates and floating popover output modes.',
        false
      )
    );

    const DISPLAY_MODES = [
      { value: 'both', label: 'Icon & Text' },
      { value: 'icon', label: 'Icon Only' },
      { value: 'text', label: 'Text Only' }
    ];

    const displayFieldsConfig = [
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

    const displayNodes = displayFieldsConfig.map(({ key, label: fieldLabelText, title: fieldTitleText, onUpdate }) => {
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
      return field;
    });

    const posField = document.createElement('div');
    posField.className = 'tk-settings-field';
    const posLabel = document.createElement('label');
    posLabel.textContent = 'Quantity Counter Position';
    const posSelect = document.createElement('select');
    posSelect.title = 'Select position for Collection Quantity Counter widget.';
    [
      { value: 'bottom-right', label: 'Bottom-Right Corner (Overlay)' },
      { value: 'bottom-left', label: 'Bottom-Left Corner (Overlay)' },
      { value: 'toolbar', label: 'SCToolkit Toolbar' }
    ].forEach(({ value, label }) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if ((Config.global.quantityCounterPosition || 'bottom-right') === value) opt.selected = true;
      posSelect.appendChild(opt);
    });
    posSelect.addEventListener('change', () => {
      Config.global.quantityCounterPosition = posSelect.value;
      Log(`Config change: global.quantityCounterPosition = ${posSelect.value}`, 'info');
      SettingsUI._persist();
    });
    posField.append(posLabel, posSelect);

    pane.appendChild(
      SettingsUI._buildCollapsibleSection(
        'Button Display Settings',
        [...displayNodes, posField],
        'Choose whether buttons show icons, text, or both across toolbars and page set links.',
        false
      )
    );

    pane.appendChild(SettingsUI._buildXmlPanel());

    const help = document.createElement('div');
    help.id = 'tk-settings-help';
    help.style.marginTop = '16px';
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
    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '8px';
    btnGroup.style.marginTop = '4px';

    const exportBtn = createBtn('tk-xml-export', 'Export XML', () => {
      try {
        const xml = configToXml(Config);
        const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sctoolkit-settings-v${Config.schemaVersion || 3}.xml`;
        a.click();
        URL.revokeObjectURL(url);
        showToast({ variant: 'success', message: 'Settings exported to XML.' });
      } catch (err) {
        showToast({ variant: 'error', message: `XML export failed: ${err.message}` });
      }
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xml,text/xml,application/xml';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const xmlText = await file.text();
        const imported = xmlToConfig(xmlText);
        Config.schemaVersion = imported.schemaVersion;
        Config.global = imported.global;
        Config.modules = imported.modules;

        syncExportConfig();
        applyTheme();
        SettingsStore.save(Config);
        Log('Settings successfully imported from XML file.', 'info');
        showToast({ message: 'Settings imported from XML! Reloading page...', variant: 'success' });

        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        showToast({ message: `Import failed: ${err.message}`, variant: 'error' });
      }
      fileInput.value = '';
    });

    const importBtn = createBtn('tk-xml-import', 'Import XML', () => {
      fileInput.value = '';
      fileInput.click();
    });

    btnGroup.appendChild(exportBtn);
    btnGroup.appendChild(importBtn);
    btnGroup.appendChild(fileInput);

    return SettingsUI._buildCollapsibleSection(
      'XML Import / Export Settings',
      [btnGroup],
      'Backup all SCToolkit settings (globals, module states, sub-actions, route rules) to XML or restore from file.',
      true
    );
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

  _buildRegexPane: () => {
    const pane = document.createElement('div');
    pane.id = 'tk-settings-regex-tester';
    pane.className = 'tk-tester-pane';

    const title = document.createElement('div');
    title.className = 'tk-settings-section-title';
    title.textContent = 'RegEx Expression Builder & Tester';
    pane.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'tk-settings-hint';
    desc.textContent = 'Build, test, and evaluate regular expressions in real-time with pattern presets, flag toggles, visual match highlighting, and capture group details.';
    pane.appendChild(desc);

    const patternRow = document.createElement('div');
    patternRow.className = 'tk-tester-row';

    const patternInputWrap = document.createElement('div');
    patternInputWrap.className = 'tk-tester-row-input';

    const patternLabel = document.createElement('label');
    patternLabel.style.display = 'block';
    patternLabel.style.fontSize = '10.5px';
    patternLabel.style.fontWeight = '700';
    patternLabel.style.marginBottom = '3px';
    patternLabel.textContent = 'RegEx Pattern';

    const patternInput = document.createElement('input');
    patternInput.type = 'text';
    patternInput.className = 'tk-tester-input';
    patternInput.placeholder = 'e.g. /viewcollection.*\\.cfm or PageIndex=(\\d+)';
    patternInput.value = '/viewcollectionmode\\.cfm';

    patternInputWrap.append(patternLabel, patternInput);
    patternRow.appendChild(patternInputWrap);

    const flagsWrap = document.createElement('div');
    flagsWrap.className = 'tk-regex-flags';
    const flagValues = { i: true, g: false, m: false, s: false, u: false };

    ['i', 'g', 'm', 's', 'u'].forEach((flag) => {
      const label = document.createElement('label');
      label.className = 'tk-regex-flag-label';
      label.title = `Flag ${flag}`;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = flagValues[flag];
      cb.addEventListener('change', () => {
        flagValues[flag] = cb.checked;
        updateRegex();
      });
      label.append(cb, document.createTextNode(flag));
      flagsWrap.appendChild(label);
    });

    patternRow.appendChild(flagsWrap);
    pane.appendChild(patternRow);

    const presetsWrap = document.createElement('div');
    presetsWrap.className = 'tk-preset-chips';
    const presets = [
      { name: 'Checklist', pattern: '/checklist\\.cfm' },
      { name: 'View Collection', pattern: '/viewcollectionmode\\.cfm' },
      { name: 'For Sale / Trade', pattern: '/viewcollectionforsaletrade\\.cfm' },
      { name: 'Wantlist', pattern: '/viewcollectionwantlist\\.cfm' },
      { name: 'Add Multiples', pattern: '/collectionaddmultiples' },
      { name: 'Inserts', pattern: '/inserts\\.cfm' },
      { name: 'ViewSet', pattern: '/viewset\\.cfm' },
      { name: 'SID Capture', pattern: '/sid/(\\d+)' }
    ];

    presets.forEach((p) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tk-preset-chip';
      chip.textContent = p.name;
      chip.title = `Use pattern: ${p.pattern}`;
      chip.addEventListener('click', () => {
        patternInput.value = p.pattern;
        updateRegex();
      });
      presetsWrap.appendChild(chip);
    });
    pane.appendChild(presetsWrap);

    const subjectWrap = document.createElement('div');
    subjectWrap.className = 'tk-settings-field';
    subjectWrap.style.marginBottom = '6px';

    const subjectLabel = document.createElement('label');
    subjectLabel.textContent = 'Test Subject / URL';

    const subjectInput = document.createElement('textarea');
    subjectInput.className = 'tk-tester-textarea';
    subjectInput.placeholder = 'Type or paste test string/URL here...';
    subjectInput.value = 'https://www.tcdb.com/ViewCollectionMode.cfm?Member=djncards&CollectionID=6';

    subjectWrap.append(subjectLabel, subjectInput);
    pane.appendChild(subjectWrap);

    const statusBar = document.createElement('div');
    statusBar.className = 'tk-tester-status-bar';

    const statusText = document.createElement('span');
    statusText.textContent = 'Status';

    const statusBadge = document.createElement('span');
    statusBadge.className = 'tk-status-badge unmatched';
    statusBadge.textContent = 'NO MATCH';

    statusBar.append(statusText, statusBadge);
    pane.appendChild(statusBar);

    const highlightTitle = document.createElement('div');
    highlightTitle.className = 'tk-route-editor-title';
    highlightTitle.textContent = 'Matched Output Highlight';
    pane.appendChild(highlightTitle);

    const highlightBox = document.createElement('div');
    highlightBox.className = 'tk-regex-highlight-box';
    pane.appendChild(highlightBox);

    const groupsTitle = document.createElement('div');
    groupsTitle.className = 'tk-route-editor-title';
    groupsTitle.style.marginTop = '6px';
    groupsTitle.textContent = 'Capture Groups Breakdown';
    pane.appendChild(groupsTitle);

    const groupsContainer = document.createElement('div');
    groupsContainer.style.overflowX = 'auto';
    pane.appendChild(groupsContainer);

    function updateRegex() {
      const patStr = patternInput.value.trim();
      const subjectStr = subjectInput.value;
      const flagsStr = Object.keys(flagValues).filter((f) => flagValues[f]).join('');

      highlightBox.innerHTML = '';
      groupsContainer.innerHTML = '';

      if (!patStr) {
        statusBadge.className = 'tk-status-badge disabled';
        statusBadge.textContent = 'NO PATTERN';
        highlightBox.textContent = subjectStr;
        return;
      }

      let re;
      try {
        re = new RegExp(patStr, flagsStr);
      } catch (err) {
        statusBadge.className = 'tk-status-badge error';
        statusBadge.textContent = `SYNTAX ERROR: ${err.message}`;
        highlightBox.textContent = subjectStr;
        return;
      }

      const esc = (str) => String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      const matches = [];
      if (re.global) {
        let m;
        while ((m = re.exec(subjectStr)) !== null) {
          matches.push(m);
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      } else {
        const m = re.exec(subjectStr);
        if (m) matches.push(m);
      }

      if (matches.length === 0) {
        statusBadge.className = 'tk-status-badge unmatched';
        statusBadge.textContent = 'NO MATCH';
        highlightBox.textContent = subjectStr;
        return;
      }

      statusBadge.className = 'tk-status-badge matched';
      statusBadge.textContent = `MATCHED (${matches.length} match${matches.length > 1 ? 'es' : ''})`;

      let html = '';
      let lastIndex = 0;
      matches.forEach((m) => {
        const start = m.index;
        const end = start + m[0].length;
        html += esc(subjectStr.slice(lastIndex, start));
        html += `<mark class="tk-regex-match-hl">${esc(m[0])}</mark>`;
        lastIndex = end;
      });
      html += esc(subjectStr.slice(lastIndex));
      highlightBox.innerHTML = html;

      const tbl = document.createElement('table');
      tbl.className = 'tk-regex-groups-table';
      tbl.innerHTML = `
        <thead>
          <tr>
            <th>Match #</th>
            <th>Group</th>
            <th>Value</th>
            <th>Range</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = tbl.querySelector('tbody');

      matches.forEach((m, mIdx) => {
        m.forEach((val, gIdx) => {
          const tr = document.createElement('tr');
          const groupName = gIdx === 0 ? '0 (Full)' : `$${gIdx}`;
          const start = gIdx === 0 ? m.index : '-';
          const end = gIdx === 0 ? m.index + m[0].length : '-';
          const rangeStr = start !== '-' ? `[${start}, ${end}]` : '-';

          tr.innerHTML = `
            <td>#${mIdx + 1}</td>
            <td><strong>${groupName}</strong></td>
            <td><code>${esc(val !== undefined ? val : '')}</code></td>
            <td>${rangeStr}</td>
          `;
          tbody.appendChild(tr);
        });
      });
      groupsContainer.appendChild(tbl);
    }

    patternInput.addEventListener('input', updateRegex);
    subjectInput.addEventListener('input', updateRegex);

    updateRegex();
    return pane;
  },

  _buildRouteTesterPane: () => {
    const pane = document.createElement('div');
    pane.id = 'tk-settings-route-tester';
    pane.className = 'tk-tester-pane';

    const title = document.createElement('div');
    title.className = 'tk-settings-section-title';
    title.textContent = 'URL Route Match Tester';
    pane.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'tk-settings-hint';
    desc.textContent = 'Test any page URL against all module route matching rules to evaluate which modules will run on that page.';
    pane.appendChild(desc);

    const urlWrap = document.createElement('div');
    urlWrap.className = 'tk-settings-field';
    urlWrap.style.marginBottom = '6px';

    const urlLabel = document.createElement('label');
    urlLabel.textContent = 'Target Page URL';

    const urlRow = document.createElement('div');
    urlRow.className = 'tk-tester-row';

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'tk-tester-input tk-tester-row-input';
    urlInput.placeholder = 'https://www.tcdb.com/ViewCollectionMode.cfm?Member=djncards';
    urlInput.value = typeof window !== 'undefined' ? window.location.href : 'https://www.tcdb.com/ViewCollectionMode.cfm?Member=djncards';

    const useCurrentBtn = document.createElement('button');
    useCurrentBtn.type = 'button';
    useCurrentBtn.className = 'tk-route-add-btn';
    useCurrentBtn.style.marginTop = '0';
    useCurrentBtn.textContent = 'Current Page';
    useCurrentBtn.addEventListener('click', () => {
      if (typeof window !== 'undefined') {
        urlInput.value = window.location.href;
        updateRouteTester();
      }
    });

    urlRow.append(urlInput, useCurrentBtn);
    urlWrap.append(urlLabel, urlRow);
    pane.appendChild(urlWrap);

    const samplesWrap = document.createElement('div');
    samplesWrap.className = 'tk-preset-chips';
    const samples = [
      { name: 'Checklist', url: 'https://www.tcdb.com/Checklist.cfm/sid/11172' },
      { name: 'View Collection', url: 'https://www.tcdb.com/ViewCollectionMode.cfm?Member=djncards&CollectionID=6' },
      { name: 'For Sale / Trade', url: 'https://www.tcdb.com/ViewCollectionForSaleTrade.cfm?Member=djncards' },
      { name: 'Add Multiples', url: 'https://www.tcdb.com/CollectionAddMultiplesText.cfm?SetID=11172' },
      { name: 'Inserts', url: 'https://www.tcdb.com/Inserts.cfm/sid/11172' }
    ];
    samples.forEach((s) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tk-preset-chip';
      chip.textContent = s.name;
      chip.addEventListener('click', () => {
        urlInput.value = s.url;
        updateRouteTester();
      });
      samplesWrap.appendChild(chip);
    });
    pane.appendChild(samplesWrap);

    const cardsContainer = document.createElement('div');
    cardsContainer.style.display = 'flex';
    cardsContainer.style.flexDirection = 'column';
    cardsContainer.style.gap = '8px';
    cardsContainer.style.marginTop = '8px';
    pane.appendChild(cardsContainer);

    function updateRouteTester() {
      const testUrl = urlInput.value.trim();
      cardsContainer.innerHTML = '';

      if (!testUrl) {
        const empty = document.createElement('div');
        empty.className = 'tk-settings-hint';
        empty.textContent = 'Enter a URL above to evaluate module matching.';
        cardsContainer.appendChild(empty);
        return;
      }

      ModuleRegistry.forEach((mod) => {
        const cfg = Config.modules[mod.id];
        if (!cfg) return;

        const card = document.createElement('div');
        card.className = 'tk-route-card';

        const header = document.createElement('div');
        header.className = 'tk-route-card-header';

        const titleEl = document.createElement('div');
        titleEl.className = 'tk-route-card-title';
        titleEl.textContent = mod.name;

        let isMatch = false;
        let throwsError = false;
        try {
          isMatch = testUrlMatch(cfg.urlMatch, testUrl);
        } catch {
          throwsError = true;
        }

        const badge = document.createElement('span');
        if (isMatch && !throwsError) {
          badge.className = 'tk-status-badge matched';
          badge.textContent = 'MATCH';
        } else {
          badge.className = 'tk-status-badge unmatched';
          badge.textContent = 'NO MATCH';
        }

        header.append(titleEl, badge);
        card.appendChild(header);

        const rulesList = document.createElement('div');
        rulesList.className = 'tk-route-rules-list';

        if (!cfg.urlMatch || cfg.urlMatch.length === 0) {
          const rItem = document.createElement('div');
          rItem.className = 'tk-route-rule-item pass';
          rItem.textContent = '✓ No route rules defined — matches all URLs by default';
          rulesList.appendChild(rItem);
        } else {
          cfg.urlMatch.forEach((rule) => {
            let ruleMatches = false;
            try {
              ruleMatches = new RegExp(rule.pattern, 'i').test(testUrl);
            } catch {
              ruleMatches = false;
            }

            const rItem = document.createElement('div');
            if (rule.exclude) {
              rItem.className = ruleMatches ? 'tk-route-rule-item fail' : 'tk-route-rule-item';
              rItem.textContent = ruleMatches
                ? `✗ Exclude match: "${rule.pattern}" (EXCLUDED)`
                : `— Exclude rule: "${rule.pattern}" (Passed)`;
            } else {
              rItem.className = ruleMatches ? 'tk-route-rule-item pass' : 'tk-route-rule-item';
              rItem.textContent = ruleMatches
                ? `✓ Include match: "${rule.pattern}" (MATCHED)`
                : `— Include rule: "${rule.pattern}" (Not matched)`;
            }
            rulesList.appendChild(rItem);
          });
        }

        card.appendChild(rulesList);
        cardsContainer.appendChild(card);
      });
    }

    urlInput.addEventListener('input', updateRouteTester);
    updateRouteTester();

    return pane;
  },

  _version: () => getAppVersion()
};

/** Declarative specs for global settings, organized into logical sections. */
export const GLOBAL_SECTIONS = [
  {
    title: 'Network Pacing & Rate Limits',
    description: 'Configure request spacing, random jitter, cross-tab serialization, and adaptive server strain thresholds.',
    fields: [
      {
        label: 'Export Base Delay', key: 'exportBaseDelayMs', min: 500, max: 5000, step: 50, unit: 'ms',
        hint: 'Minimum wait between paginated fetch requests. Configures fundamental request pacing.'
      },
      {
        label: 'Export Jitter', key: 'exportJitterMaxMs', min: 0, max: 2000, step: 50, unit: 'ms',
        hint: 'Random amount added on top of base delay to randomize request cadence and avoid WAF fingerprinting.'
      },
      {
        label: 'Pagination Throttle Start Page', key: 'paginationThrottleStartPage', min: 1, max: 50, step: 1, unit: ' pages',
        hint: 'Page threshold at which request pacing and throttling delays activate during auto-pagination.'
      },
      {
        label: 'Pacing Strain Penalty Step', key: 'pacingPenaltyStepMs', min: 100, max: 2000, step: 50, unit: 'ms',
        hint: 'Adaptive penalty step added to pacing delay whenever server strain (slow response or throttle) is detected.'
      },
      {
        label: 'Pacing Strain Penalty Ceiling', key: 'pacingPenaltyCapMs', min: 1000, max: 30000, step: 500, unit: 'ms',
        hint: 'Upper ceiling on accumulated server strain penalty.'
      },
      {
        label: 'Pacing Slow Response Latency', key: 'pacingSlowResponseMs', min: 1000, max: 10000, step: 250, unit: 'ms',
        hint: 'Response latency threshold above which a fetch is flagged as server strain.'
      },
      {
        label: 'Pacing Latency Sample Window', key: 'pacingSampleWindow', min: 3, max: 50, step: 1, unit: ' samples',
        hint: 'Number of recent response latency samples used to compute rolling median latency.'
      },
      {
        label: 'Pacing Strain Relief Step', key: 'pacingReliefStepMs', min: 10, max: 500, step: 10, unit: 'ms',
        hint: 'Amount subtracted from strain penalty per successful, unremarkable response.'
      },
      {
        label: 'Cross-Tab Throttle Wait Slice', key: 'throttleMaxSliceMs', min: 50, max: 1000, step: 25, unit: 'ms',
        hint: 'Slice interval before re-evaluating cross-tab request slot locks.'
      },
      {
        label: 'Hierarchy Export Min Delay', key: 'exportHierarchyMinDelayMs', min: 1000, max: 30000, step: 500, unit: 'ms',
        hint: 'Minimum delay before fetching each parent set in hierarchy export.'
      },
      {
        label: 'Hierarchy Export Max Delay', key: 'exportHierarchyMaxDelayMs', min: 1000, max: 60000, step: 500, unit: 'ms',
        hint: 'Maximum delay before fetching each parent set in hierarchy export.'
      }
    ]
  },
  {
    title: 'Retry & Safety Safeguards',
    description: 'Manage retry backoffs, request timeouts, pagination limits, and anti-scraping cooldown protection.',
    fields: [
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
        hint: 'Hard stop on discovered page count — protects against runaway fetch loops on massive sets.'
      },
      {
        label: 'Request Timeout', key: 'exportRequestTimeoutMs', min: 5000, max: 120000, step: 5000, unit: 'ms',
        hint: 'Abandon a single request that never answers. Without this a hung request stalls the whole queue indefinitely.'
      },
      {
        label: 'Anti-Scraping Cooldown', key: 'exportBlockCooldownMinutes', min: 0, max: 30, step: 1, unit: ' min',
        hint: 'After a detected block (captcha/verification page), refuse new exports for this long. 0 disables the cooldown.'
      }
    ]
  },
  {
    title: 'Local Storage & Caching',
    description: 'Configure local browser cache retention, TTL, and storage limits for exported sets.',
    fields: [
      {
        label: 'Export Cache Lifetime', key: 'exportCacheTtlHours', min: 0, max: 168, step: 1, unit: ' h',
        hint: 'Re-exporting a set within this window reuses the stored result and makes no requests at all. 0 disables caching.'
      },
      {
        label: 'Export Cache Max Entries', key: 'exportCacheMaxEntries', min: 5, max: 100, step: 5, unit: ' sets',
        hint: 'Maximum number of exported set results retained in local storage cache.'
      },
      {
        label: 'Export Cache Max Rows', key: 'exportCacheMaxRows', min: 1000, max: 100000, step: 1000, unit: ' rows',
        hint: 'Maximum rows allowed for a single set before cache storage skips saving it.'
      }
    ]
  },
  {
    title: 'UI & Performance Settings',
    description: 'Customize UI toast notifications, page component delays, debounces, and batch rendering chunk sizes.',
    fields: [
      {
        label: 'Toast Display Duration', key: 'toastDurationMs', min: 1500, max: 10000, step: 250, unit: 'ms',
        hint: 'How long status/confirmation toasts stay visible before fading out.'
      },
      {
        label: 'Toast Stack Limit', key: 'toastStackLimit', min: 1, max: 10, step: 1, unit: ' toasts',
        hint: 'Maximum number of toast notifications allowed to stack on screen simultaneously.'
      },
      {
        label: 'Checklist Filter Debounce', key: 'checklistFilterDebounceMs', min: 0, max: 500, step: 25, unit: 'ms',
        hint: 'Delay after typing stops before the real-time table filter re-scans rows.'
      },
      {
        label: 'Pagination Loader Delay', key: 'paginationLoaderDelayMs', min: 300, max: 3000, step: 100, unit: 'ms',
        hint: 'Fixed wait before the CSV export button is enabled on paginated pages.'
      },
      {
        label: 'Add Multiples Focus Deadline', key: 'addMultiplesFocusDeadlineMs', min: 300, max: 5000, step: 100, unit: 'ms',
        hint: 'Timeout deadline for auto-focusing quantity input fields on Add Multiples forms.'
      },
      {
        label: 'Set List Enhancer Chunk Size', key: 'setListEnhancerChunkSize', min: 5, max: 100, step: 5, unit: ' links',
        hint: 'Batch rendering chunk size for injecting set list link badges.'
      },
      {
        label: 'Settings Save Debounce', key: 'settingsSaveDebounceMs', min: 100, max: 2000, step: 100, unit: 'ms',
        hint: 'How long to wait after the last settings change before writing to storage.'
      },
      {
        label: 'Card Formatter Popover Duration', key: 'cardFormatterPopoverDurationMs', min: 1000, max: 10000, step: 500, unit: 'ms',
        hint: 'How long the floating copy popover stays visible before auto-dismissing.'
      }
    ]
  }
];

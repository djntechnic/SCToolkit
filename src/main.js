/**
 * SCToolkit bootstrap.
 *
 * Contract for this file: one entry point, bundled to a single IIFE, with no
 * top-level side effects beyond scheduling `boot()`. Everything else is
 * imported and constructed inside it.
 *
 * Order matters:
 *   1. config, because the log level and every threshold come from it;
 *   2. the toolbar, because modules mount buttons and status text into it;
 *   3. settings, which anchors its trigger next to the status readout;
 *   4. modules, resolved against the current URL.
 */

import { initConfig } from './core/config.js';
import { Log } from './core/log.js';
import { resolveModules } from './core/registry.js';
import { EXPORT_BUTTON_IDS } from './modules/csvExportEngine.js';
import { escapeHtml } from './ui/dom.js';
import { SettingsUI } from './ui/settings.js';
import { enableAction, setStatus } from './ui/status.js';
import { showToast } from './ui/toast.js';
import { Toolbar } from './ui/toolbar.js';

async function boot() {
  initConfig();
  Log('Starting core execution sequence');

  Toolbar.init();
  SettingsUI.init();

  const activeModules = resolveModules();
  const loadedModuleNames = [];
  const pendingAsyncTasks = [];

  activeModules.forEach((mod) => {
    try {
      // Lifecycle logging belongs to the registry, not to the modules; a module
      // that also announces itself produces two lines for one event.
      Log(`Module init starting: ${mod.name}`, 'debug');
      const result = mod.init();
      if (mod.isAsync) pendingAsyncTasks.push(result);
      loadedModuleNames.push(mod.name);
    } catch (error) {
      // One broken module must not take the rest of the toolbar down with it.
      Log(`Module '${mod.name}' failed to initialize: ${error.message}`, 'error');
    }
  });

  if (pendingAsyncTasks.length > 0) {
    await Promise.all(pendingAsyncTasks);
  }

  EXPORT_BUTTON_IDS.forEach(enableAction);

  setStatus(
    `${loadedModuleNames.length} Modules Active`,
    `Active Modules:\n• ${loadedModuleNames.join('\n• ')}`
  );

  showToast({
    message: `<b>SCToolkit Active</b><ul>${loadedModuleNames.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`,
    location: 'bottom-right',
    accent: 'var(--tk-accent)'
  });

  Log(`Core execution sequence complete. ${loadedModuleNames.length} modules loaded: ${loadedModuleNames.join(', ')}`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

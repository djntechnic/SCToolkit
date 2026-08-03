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
import { Utils } from './core/utils.js';
import { SettingsUI } from './ui/settings.js';
import { initTheme } from './ui/theme.js';
import { initPalette } from './ui/palette.js';
import { enableAction, setStatus } from './ui/status.js';
import { showToast } from './ui/toast.js';
import { Toolbar } from './ui/toolbar.js';

async function boot() {
  initConfig();
  // Before any chrome is built, so nothing renders in the wrong palette first.
  initTheme();
  Log('Starting core execution sequence');

  Toolbar.init();
  SettingsUI.init();
  initPalette({ openSettings: () => SettingsUI.open() });

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
    `Active Modules:\n• ${loadedModuleNames.join('\n• ')}`,
    loadedModuleNames
  );

  showToast({
    message: `<b>SCToolkit Active</b> <span class="tk-toast-hint">Ctrl+K</span><ul>${loadedModuleNames.map((m) => `<li>${Utils.escape.html(m)}</li>`).join('')}</ul>`,
    location: 'bottom-right',
    variant: 'warn'
  });

  Log(`Core execution sequence complete. ${loadedModuleNames.length} modules loaded: ${loadedModuleNames.join(', ')}`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

import { Routes } from '../core/routes.js';
import { Toolbar } from '../ui/toolbar.js';
import { exportSetHierarchyCSV } from '../net/setHierarchyExport.js';

export function initSetHierarchyExport() {
  if (Routes.isViewAllSets()) {
    Toolbar.addAction(
      'btn-export-hierarchy',
      'Export Set Hierarchy',
      () => {
        exportSetHierarchyCSV(window.location.href);
      },
      true
    );
  }
}

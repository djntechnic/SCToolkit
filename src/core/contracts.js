/**
 * DOM contract checks.
 *
 * The project's main failure mode is not a crash — it is the site changing its
 * markup so that a selector stops matching and a feature quietly does nothing.
 * That is exactly what happened to the checklist filter on three of its four
 * routes, and nobody noticed for the life of v2.x.
 *
 * A contract is a named assumption about the page. Recording the results makes
 * the difference between "the filter didn't appear" and "the filter ran, and
 * `#main-content-area` was not there".
 */

import { Log } from './log.js';

/**
 * @typedef {object} ContractResult
 * @property {string} moduleId
 * @property {string} label
 * @property {string} selector
 * @property {boolean} ok
 */

/** @type {ContractResult[]} */
const results = [];

/** Every contract evaluated on this page, in the order they ran. */
export const getContractResults = () => results.slice();

/** Discard recorded results. For tests. */
export const resetContracts = () => { results.length = 0; };

/**
 * Check that the selectors a feature depends on resolve, and record the answer.
 *
 * A failed check is informational: the caller decides whether to continue. It
 * never throws, because a markup change should degrade a feature, not take the
 * toolbar down with it.
 *
 * @param {string} moduleId
 * @param {Array<{selector: string, context?: ParentNode, label?: string,
 *   optional?: boolean}>} checks `optional` records the result without warning
 * @returns {boolean} true when every non-optional selector resolved
 */
export function assertContract(moduleId, checks) {
  const failures = [];

  checks.forEach(({ selector, context = document, label, optional = false }) => {
    let found;
    try {
      found = context.querySelector(selector);
    } catch {
      // An invalid selector is a bug in this script, not a site change, but it
      // is reported the same way rather than thrown at the user.
      found = null;
    }

    results.push({ moduleId, label: label || selector, selector, ok: !!found });
    if (!found && !optional) failures.push(label || selector);
  });

  if (failures.length === 0) return true;

  Log(
    `[Contract] '${moduleId}' — selector(s) not found: ${failures.join('; ')}. ` +
    'Site markup may have changed; affected functionality may silently no-op. ' +
    'Settings → Diagnostics lists every check.',
    'warn'
  );
  return false;
}

/**
 * Record a check whose outcome is already known.
 *
 * For assumptions that are not a single `querySelector` — "the export found
 * rows", "a set id was present" — so Diagnostics can report them alongside the
 * selector-based ones.
 *
 * @param {string} moduleId
 * @param {string} label
 * @param {boolean} ok
 */
export function recordContract(moduleId, label, ok) {
  results.push({ moduleId, label, selector: '(runtime check)', ok });
}

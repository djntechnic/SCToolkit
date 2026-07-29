/**
 * Accessible dropdown behaviour, shared by the pin menus and the overflow menu.
 *
 * v2.42.0 opened these on `:hover`, `:focus-within`, *and* click. Hover-open
 * cannot be dismissed on a touch device — the menu appears on tap and stays —
 * and on desktop it fires on the way to something else. This is click-only,
 * with the keyboard support the CSS approach could never provide.
 */

/** Close every open dropdown except, optionally, one. */
export function closeAllDropdowns(except = null) {
  document.querySelectorAll('.tk-dropdown.tk-show').forEach((el) => {
    if (el === except) return;
    el.classList.remove('tk-show');
    el.querySelector('[aria-expanded]')?.setAttribute('aria-expanded', 'false');
  });
}

/** @param {HTMLElement} dropdown @returns {HTMLElement[]} */
const itemsOf = (dropdown) =>
  Array.from(dropdown.querySelectorAll('.tk-dropdown-content a, .tk-dropdown-content button, .tk-dropdown-content [role="button"]'))
    .filter((el) => el.offsetParent !== null || el.hidden === false);

/**
 * Wire a trigger and its panel together.
 *
 * @param {HTMLElement} dropdown the `.tk-dropdown` wrapper
 * @param {HTMLElement} trigger the button that opens it
 */
export function initDropdown(dropdown, trigger) {
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-haspopup', 'true');

  const setOpen = (open) => {
    dropdown.classList.toggle('tk-show', open);
    trigger.setAttribute('aria-expanded', String(open));
  };

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    const willOpen = !dropdown.classList.contains('tk-show');
    closeAllDropdowns(dropdown);
    setOpen(willOpen);
    if (willOpen) itemsOf(dropdown)[0]?.focus();
  });

  dropdown.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Focus returns to the trigger, or the menu strands the keyboard user.
      setOpen(false);
      trigger.focus();
      return;
    }

    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;

    const items = itemsOf(dropdown);
    if (items.length === 0) return;
    e.preventDefault();

    const current = items.indexOf(document.activeElement);
    const next = {
      ArrowDown: current < 0 ? 0 : (current + 1) % items.length,
      ArrowUp: current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1
    }[e.key];

    items[next].focus();
  });
}

/** Close dropdowns on an outside click or a global Escape. Call once. */
export function initDropdownDismissal() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tk-dropdown')) closeAllDropdowns();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllDropdowns();
  });
}

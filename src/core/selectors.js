/**
 * Central registry of DOM and CSS selectors used across modules.
 *
 * Decouples hardcoded selector string constants into a single maintainable authority.
 */

export const SELECTOR_REGISTRY = {
  checklist: {
    scopes: ['#main-content-area', '#content'],
    dataRows: 'a[href*="ViewCard" i], a[href*="Checklist" i], a[href*="ViewSet" i], a[href*="/sid/" i], a[href*="ViewAll" i], a[href*="ViewAllC" i], a[href*="Person" i], a[href*="Team" i], input, select',
    itemElements: 'table tr, ul > li, ol > li',
    chrome: '.col-md-3, .col-md-4, nav, .breadcrumb, .navbar, #topnav, #sctk-toolbar, .menu-linksV, .list-unstyled, .set-wrapper, .set-dropdown, #setDropdown, #setList, .offcanvas, .dropdown-menu, .dropdown, .modal, .btn-group'
  },
  setDropdown: {
    wrapper: '#setWrapper',
    dropdown: '#setDropdown',
    search: '#setSearch',
    list: '#setList'
  },
  setLinks: [
    'a[href*="ViewSet" i]',
    'a[href*="CollectionSummary" i]',
    'a[href*="Checklist" i]',
    'a[href*="sid=" i]',
    'a[href*="/sid/" i]'
  ]
};

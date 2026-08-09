/**
 * Central registry of DOM and CSS selectors used across modules.
 *
 * Decouples hardcoded selector string constants into a single maintainable authority.
 */

export const SELECTOR_REGISTRY = {
  checklist: {
    scopes: ['#main-content-area', '#content'],
    dataRows: 'a[href*="ViewCard.cfm"], a[href*="Checklist.cfm"], a[href*="ViewSet.cfm"], a[href*="/sid/"], a[href*="ViewAll.cfm"], a[href*="Person.cfm"], a[href*="Team.cfm"], input, select',
    itemElements: 'table tr, ul > li, ol > li',
    chrome: '.col-md-3, .col-md-4, nav, .breadcrumb, .navbar, #topnav, #sctk-toolbar, .menu-linksV, .list-unstyled, .set-wrapper, .set-dropdown, #setDropdown, #setList, .offcanvas, .dropdown-menu, .dropdown, .modal, .btn-group'
  },
  setLinks: [
    'a[href*="ViewSet" i]',
    'a[href*="CollectionSummary" i]',
    'a[href*="Checklist" i]',
    'a[href*="sid=" i]',
    'a[href*="/sid/" i]'
  ]
};

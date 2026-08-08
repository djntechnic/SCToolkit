/**
 * Page-shape predicates for the current URL.
 *
 * These answer "what kind of page is this?" for *content* decisions — which
 * heading to read, which filename suffix to use. They are deliberately not the
 * gate for whether a module runs at all: that is the registry's job, driven by
 * the user-editable `urlMatch` rules in settings.
 */

const path = () => window.location.pathname.toLowerCase();

/** Path fragments that identify a page belonging to a single card set. */
const SET_PAGE_PREDICATES = [
  'isChecklist',
  'isViewSet',
  'isViewAll',
  'isInserts',
  'isForSaleTrade',
  'isWantlist',
  'isAddMultiples'
];

export const Routes = {
  isCollection: () =>
    path().includes('collection') &&
    !path().includes('addmultiples') &&
    !path().includes('printyourcollection') &&
    !window.location.search.toLowerCase().includes('mode=print'),
  isCollectionBrowse: () =>
    path().includes('collectionbrowse.cfm') &&
    !path().includes('collectionbrowsep.cfm') &&
    !path().includes('collectionbrowset.cfm'),
  isCollectionBrowseP: () => path().includes('collectionbrowsep.cfm'),
  isCollectionBrowseT: () => path().includes('collectionbrowset.cfm'),
  isPlayerCollection: () =>
    path().includes('/person') && window.location.search.toLowerCase().includes('collection'),
  isPlayerPage: () => path().includes('/person.cfm'),
  isCardPage: () => path().includes('/viewcard.cfm'),
  isChecklist: () => path().includes('/checklist.cfm'),
  isViewSet: () => path().includes('/viewset.cfm'),
  isInserts: () => path().includes('/inserts.cfm'),
  isPrintPDF: () =>
    path().includes('/print.cfm') ||
    path().includes('printyourcollectionpdf.cfm') ||
    path().includes('printyourcollection') ||
    (path().includes('collection') && window.location.search.toLowerCase().includes('mode=print')),
  isViewAll: () => path().includes('/viewall.cfm') || path().includes('/inserts.cfm'),
  isViewAllSets: () =>
    (path().includes('/viewall.cfm') || path().includes('/viewallc.cfm')) &&
    path().includes('/sp/') &&
    path().includes('/year/'),
  isForSaleTrade: () => path().includes('/viewcollectionforsaletrade.cfm'),
  isWantlist: () => path().includes('/viewcollectionwantlist.cfm'),
  isAddMultiples: () => path().includes('/collectionaddmultiples'),

  /**
   * True on any page scoped to one set. Composed from the individual
   * predicates rather than re-listing the same seven path fragments, so adding
   * a set-scoped route cannot leave this out of date.
   */
  isSetPage: () => SET_PAGE_PREDICATES.some((key) => Routes[key]()),

  hasPagination: (root = document) => !path().includes('addmultiples') && (!!root.querySelector('.pagination') || Routes.isSetPage() || Routes.isCollection() || Routes.isPlayerCollection())
};

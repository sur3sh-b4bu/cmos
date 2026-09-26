export type FilterFieldType = 'select' | 'dateRange';

export interface FilterSelectOption {
  value: string | number;
  label: string;
}

/** One independently-settable filter control in a coms-filter-bar --
 * 'select' renders as a pick-one menu (plus a built-in "All" to clear just
 * that one field); 'dateRange' renders a from/to datepicker pair. Several of
 * these sit side by side and combine via AND (see FilterBarComponent's own
 * comment), so a list can be narrowed by Priest AND Gender AND a date range
 * all at once instead of only ever matching one free-text search term. */
export interface FilterFieldDef {
  key: string;
  /** A translation key, resolved via the `translate` pipe. */
  label: string;
  type: FilterFieldType;
  /** 'select' only -- typically populated from a masters lookup. */
  options?: FilterSelectOption[];
}

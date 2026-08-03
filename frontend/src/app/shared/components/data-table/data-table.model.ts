export interface DataTableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  hiddenByDefault?: boolean;
  accessor?: (row: T) => unknown;
  exportAccessor?: (row: T) => string | number;
}

export interface DataTableSort {
  active: string;
  direction: 'asc' | 'desc' | '';
}

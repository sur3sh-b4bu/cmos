import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ImportField, ImportMapping, ImportPreview, ImportSourceColumn } from '../../utils/excel-import.util';

export interface ImportMappingDialogData {
  fileName: string;
  preview: ImportPreview;
}

interface MappingRow {
  field: ImportField;
  /** Ticked = this field is imported. Required fields are always ticked. */
  enabled: boolean;
  /** 1-based sheet column chosen for the field, or null. */
  column: number | null;
}

/** Excel's own column letters: 1 -> A, 26 -> Z, 27 -> AA. */
export function columnLetter(number: number): string {
  let n = number;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/**
 * The "match columns" step of an Excel import: for every field the list can
 * import, a checkbox (import this field or skip it) and a dropdown listing the
 * columns of the picked file, pre-filled wherever a heading matched on its
 * own. Closes with an ImportMapping ({ fieldKey: sheet column number }) when
 * the user confirms, or undefined if they cancel.
 */
@Component({
  selector: 'coms-import-mapping-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatSelectModule, TranslatePipe],
  templateUrl: './import-mapping-dialog.html',
  styleUrl: './import-mapping-dialog.scss',
})
export class ImportMappingDialogComponent {
  data = inject<ImportMappingDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject<MatDialogRef<ImportMappingDialogComponent, ImportMapping | undefined>>(MatDialogRef);

  readonly columns: ImportSourceColumn[] = this.data.preview.sourceColumns;
  readonly rows = signal<MappingRow[]>(this.autoMatch());
  readonly autoMatchedCount = this.data.preview.fields.filter((f) => f.suggestedColumn !== null).length;

  /** Ticked fields that have no column yet -- these block the import. */
  readonly problems = computed(() => new Set(this.rows().filter((r) => r.enabled && r.column === null).map((r) => r.field.key)));

  /**
   * Fields that share their column with another ticked field, mapped to the labels of those others.
   * Allowed on purpose (e.g. one "Details" column feeding two fields), so it only warns, never blocks.
   */
  readonly sharedColumns = computed(() => {
    const rows = this.rows().filter((r) => r.enabled && r.column !== null);
    const result = new Map<string, string[]>();
    for (const row of rows) {
      const others = rows.filter((r) => r !== row && r.column === row.column).map((r) => r.field.label);
      if (others.length) result.set(row.field.key, others);
    }
    return result;
  });

  readonly enabledCount = computed(() => this.rows().filter((r) => r.enabled).length);
  /** Fields that will actually be imported: ticked and given a column. */
  readonly mappedCount = computed(() => this.rows().filter((r) => r.enabled && r.column !== null).length);
  readonly canImport = computed(() => this.enabledCount() > 0 && this.problems().size === 0);
  readonly warningCount = computed(() => this.sharedColumns().size);

  private autoMatch(): MappingRow[] {
    const claimed = new Set<number>();
    return this.data.preview.fields.map((field) => {
      // If two fields ever suggested the same column, only the first keeps it.
      const column = field.suggestedColumn !== null && !claimed.has(field.suggestedColumn) ? field.suggestedColumn : null;
      if (column !== null) claimed.add(column);
      return { field, column, enabled: field.required || column !== null };
    });
  }

  reset(): void {
    this.rows.set(this.autoMatch());
  }

  toggle(index: number, enabled: boolean): void {
    this.patch(index, { enabled: this.rows()[index].field.required ? true : enabled });
  }

  /** Choosing a column for a skipped field switches it on; choosing "Not mapped" for an optional one switches it off. */
  choose(index: number, column: number | null): void {
    const row = this.rows()[index];
    this.patch(index, { column, enabled: column !== null ? true : row.field.required });
  }

  private patch(index: number, change: Partial<MappingRow>): void {
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, ...change } : r)));
  }

  optionLabel(column: ImportSourceColumn): string {
    return column.heading ? `${columnLetter(column.number)} — ${column.heading}` : `${columnLetter(column.number)}`;
  }

  samplesOf(column: number | null): string {
    if (column === null) return '';
    return this.columns.find((c) => c.number === column)?.samples.join('  ·  ') ?? '';
  }

  confirm(): void {
    if (!this.canImport()) return;
    const mapping: ImportMapping = {};
    for (const row of this.rows()) {
      if (row.enabled && row.column !== null) mapping[row.field.key] = row.column;
    }
    this.dialogRef.close(mapping);
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}

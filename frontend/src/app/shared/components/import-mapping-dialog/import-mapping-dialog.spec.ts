import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { StaticTranslateLoader } from '../../../core/i18n/static-translate-loader';
import { ImportPreview } from '../../utils/excel-import.util';
import { ImportMappingDialogComponent, columnLetter } from './import-mapping-dialog';

const PREVIEW: ImportPreview = {
  rowCount: 3,
  sourceColumns: [
    { number: 1, heading: 'Full name', samples: ['Anna', 'Ben'] },
    { number: 2, heading: 'Sex', samples: ['Female', 'Male'] },
    { number: 3, heading: '', samples: ['05-04-2016'] },
    { number: 4, heading: 'Notes', samples: ['a'] },
  ],
  fields: [
    { key: 'name', label: 'Name', required: true, suggestedColumn: null },
    { key: 'gender', label: 'Gender', required: true, suggestedColumn: 2 },
    { key: 'born', label: 'Date of Birth', required: true, suggestedColumn: null },
    { key: 'remarks', label: 'Remarks', required: false, suggestedColumn: 4 },
    { key: 'phone', label: 'Phone', required: false, suggestedColumn: null },
  ],
};

async function open(preview: ImportPreview = PREVIEW) {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideTranslateService({ lang: 'en', fallbackLang: 'en', loader: provideTranslateLoader(StaticTranslateLoader) }),
      { provide: MAT_DIALOG_DATA, useValue: { fileName: 'people.xlsx', preview } },
      { provide: MatDialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ImportMappingDialogComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, close };
}

describe('columnLetter', () => {
  it('names columns like Excel does', () => {
    expect([1, 2, 26, 27, 52, 53, 702, 703].map(columnLetter)).toEqual(['A', 'B', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA']);
  });
});

describe('ImportMappingDialogComponent', () => {
  it('pre-fills the columns that matched by heading and ticks them; required fields are always ticked', async () => {
    const { component } = await open();
    const byKey = Object.fromEntries(component.rows().map((r) => [r.field.key, r]));
    expect(byKey['gender']).toMatchObject({ enabled: true, column: 2 });
    expect(byKey['remarks']).toMatchObject({ enabled: true, column: 4 });
    expect(byKey['name']).toMatchObject({ enabled: true, column: null }); // required, still to be chosen
    expect(byKey['phone']).toMatchObject({ enabled: false, column: null }); // optional, no match -> skipped
    expect(component.autoMatchedCount).toBe(2);
  });

  it('cannot import until every required field has a column', async () => {
    const { component } = await open();
    expect(component.canImport()).toBe(false);
    expect(component.problems().has('name')).toBe(true);
    expect(component.problems().has('born')).toBe(true);

    component.choose(0, 1); // Name <- A
    component.choose(2, 3); // Date of Birth <- C (a column with no heading)
    expect(component.canImport()).toBe(true);
  });

  it('confirms with exactly the ticked fields and their chosen columns', async () => {
    const { component, close } = await open();
    component.choose(0, 1);
    component.choose(2, 3);
    component.toggle(3, false); // untick Remarks
    component.confirm();
    expect(close).toHaveBeenCalledWith({ name: 1, gender: 2, born: 3 });
  });

  it('will not let a required field be unticked', async () => {
    const { component } = await open();
    component.toggle(1, false);
    expect(component.rows()[1].enabled).toBe(true);
  });

  it('warns when one column is chosen for two fields, but still lets the import go ahead', async () => {
    const { component, close, fixture } = await open();
    component.choose(0, 2); // Name <- B, and Gender already uses B
    component.choose(2, 3);
    expect(component.sharedColumns().get('name')).toEqual(['Gender']);
    expect(component.sharedColumns().get('gender')).toEqual(['Name']);
    expect(component.warningCount()).toBe(2);
    expect(component.problems().size).toBe(0);
    expect(component.canImport()).toBe(true);

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="import-map-banner"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="import-map-warning-name"]')?.textContent).toContain('Gender');
    expect((el.querySelector('[data-testid="import-map-confirm"]') as HTMLButtonElement).disabled).toBe(false);

    component.confirm();
    expect(close).toHaveBeenCalledWith({ name: 2, gender: 2, born: 3, remarks: 4 }); // Remarks kept its automatic match
  });

  it('lists every other field sharing the column, and the warning goes away once they no longer share', async () => {
    const { component } = await open();
    component.choose(0, 2);
    component.choose(2, 2); // Name, Gender and Date of Birth all on B
    expect(component.sharedColumns().get('gender')).toEqual(['Name', 'Date of Birth']);
    component.choose(0, 1);
    component.choose(2, 3);
    expect(component.warningCount()).toBe(0);
  });

  it('does not warn about a field that is unticked, even if its old column is shared', async () => {
    const { component } = await open();
    component.choose(0, 1);
    component.choose(2, 3);
    component.choose(4, 4); // Phone <- D, same as Remarks
    expect(component.warningCount()).toBe(2);
    component.toggle(4, false);
    expect(component.warningCount()).toBe(0);
  });

  it('a skipped optional field frees its column, and picking a column for it ticks it', async () => {
    const { component } = await open();
    component.choose(0, 1);
    component.choose(2, 3);
    component.toggle(3, false); // Remarks off -> its column 4 is free
    component.choose(4, 4); // Phone <- D
    expect(component.rows()[4].enabled).toBe(true);
    expect(component.canImport()).toBe(true);
    component.choose(4, null); // back to "Not mapped"
    expect(component.rows()[4].enabled).toBe(false);
  });

  it('resets to the automatic match', async () => {
    const { component } = await open();
    component.choose(0, 1);
    component.toggle(3, false);
    component.reset();
    expect(component.rows()[0].column).toBeNull();
    expect(component.rows()[3]).toMatchObject({ enabled: true, column: 4 });
  });

  it('shows a field\'s hint (how the register number gets its prefix) under its name, and only for fields that have one', async () => {
    const withHint: ImportPreview = {
      ...PREVIEW,
      fields: PREVIEW.fields.map((f) => (f.key === 'remarks' ? { ...f, hint: 'Only the number is used: 12 becomes RCT0012.' } : f)),
    };
    const { fixture } = await open(withHint);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="import-map-hint-remarks"]')?.textContent).toContain('12 becomes RCT0012');
    expect(el.querySelector('[data-testid="import-map-hint-name"]')).toBeNull();
  });

  it('cancelling closes with nothing', async () => {
    const { component, close } = await open();
    component.cancel();
    expect(close).toHaveBeenCalledWith(undefined);
  });

  it('renders a row, a checkbox and a dropdown for every field, and disables Import while something is missing', async () => {
    const { fixture } = await open();
    const el = fixture.nativeElement as HTMLElement;
    for (const f of PREVIEW.fields) {
      expect(el.querySelector(`[data-testid="import-map-row-${f.key}"]`)).not.toBeNull();
      expect(el.querySelector(`[data-testid="import-map-check-${f.key}"]`)).not.toBeNull();
      expect(el.querySelector(`[data-testid="import-map-select-${f.key}"]`)).not.toBeNull();
    }
    expect((el.querySelector('[data-testid="import-map-confirm"]') as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector('[data-testid="import-map-problem-name"]')).not.toBeNull();
  });
});

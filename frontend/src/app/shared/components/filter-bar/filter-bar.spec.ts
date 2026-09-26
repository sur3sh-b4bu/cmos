import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { FilterBarComponent } from './filter-bar';
import { FilterFieldDef } from './filter-bar.model';
import { StaticTranslateLoader } from '../../../core/i18n/static-translate-loader';

const PRIEST_FIELD: FilterFieldDef = {
  key: 'priest_id',
  label: 'certificates.common.priest',
  type: 'select',
  options: [
    { value: 1, label: 'Fr. John' },
    { value: 2, label: 'Fr. Peter' },
  ],
};

const DATE_FIELD: FilterFieldDef = {
  key: 'date_of_baptism',
  label: 'certificates.baptism.colDateOfBaptism',
  type: 'dateRange',
};

async function createComponent(fields: FilterFieldDef[]): Promise<FilterBarComponent> {
  await TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideTranslateService({ lang: 'en', fallbackLang: 'en', loader: provideTranslateLoader(StaticTranslateLoader) }),
      // The dateRange branch of the template renders a mat-datepicker input,
      // which needs a DateAdapter to even construct -- the app's own
      // DD-MM-YYYY one isn't relevant to what these tests check, so the
      // stock native adapter is enough here.
      provideNativeDateAdapter(),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(FilterBarComponent);
  const component = fixture.componentInstance;
  component.fields = fields;
  fixture.detectChanges();
  return component;
}

describe('FilterBarComponent', () => {
  it('emits nothing active by default', async () => {
    const component = await createComponent([PRIEST_FIELD]);
    expect(component.hasActive()).toBe(false);
    expect(component.isActive('priest_id')).toBe(false);
  });

  it('selecting an option marks that field active and emits its value', async () => {
    const component = await createComponent([PRIEST_FIELD]);
    const emitted: Record<string, string>[] = [];
    component.filtersChange.subscribe((v) => emitted.push(v));

    component.selectOption('priest_id', '2');

    expect(component.isActive('priest_id')).toBe(true);
    expect(component.activeValueText(PRIEST_FIELD)).toBe('Fr. Peter');
    expect(emitted.at(-1)).toEqual({ priest_id: '2' });
  });

  it('selecting the "All" option (empty value) clears that field', async () => {
    const component = await createComponent([PRIEST_FIELD]);
    component.selectOption('priest_id', '2');

    component.selectOption('priest_id', '');

    expect(component.isActive('priest_id')).toBe(false);
    expect(component.activeValueText(PRIEST_FIELD)).toBeNull();
  });

  it('filteredOptions narrows by a case-insensitive label match', async () => {
    const component = await createComponent([PRIEST_FIELD]);
    component.setMenuSearch('priest_id', 'john');
    expect(component.filteredOptions(PRIEST_FIELD)).toEqual([{ value: 1, label: 'Fr. John' }]);
  });

  it('filteredOptions returns everything when the search is empty', async () => {
    const component = await createComponent([PRIEST_FIELD]);
    expect(component.filteredOptions(PRIEST_FIELD)).toHaveLength(2);
  });

  it('a dateRange field becomes active once either end is set, and emits <key>From/<key>To', async () => {
    const component = await createComponent([DATE_FIELD]);
    const emitted: Record<string, string>[] = [];
    component.filtersChange.subscribe((v) => emitted.push(v));

    component.setRangeFrom('date_of_baptism', new Date(2026, 0, 1));
    component.applyRange();

    expect(component.isActive('date_of_baptism')).toBe(true);
    expect(emitted.at(-1)).toEqual({ date_of_baptismFrom: '2026-01-01' });

    component.setRangeTo('date_of_baptism', new Date(2026, 0, 31));
    component.applyRange();

    expect(emitted.at(-1)).toEqual({ date_of_baptismFrom: '2026-01-01', date_of_baptismTo: '2026-01-31' });
  });

  it('clearOne removes just that field, leaving others active', async () => {
    const component = await createComponent([PRIEST_FIELD, DATE_FIELD]);
    component.selectOption('priest_id', '1');
    component.setRangeFrom('date_of_baptism', new Date(2026, 0, 1));
    component.applyRange();

    component.clearOne('priest_id');

    expect(component.isActive('priest_id')).toBe(false);
    expect(component.isActive('date_of_baptism')).toBe(true);
  });

  it('clearAll removes every active filter and emits an empty object', async () => {
    const component = await createComponent([PRIEST_FIELD, DATE_FIELD]);
    component.selectOption('priest_id', '1');
    component.setRangeFrom('date_of_baptism', new Date(2026, 0, 1));
    component.applyRange();
    const emitted: Record<string, string>[] = [];
    component.filtersChange.subscribe((v) => emitted.push(v));

    component.clearAll();

    expect(component.hasActive()).toBe(false);
    expect(emitted.at(-1)).toEqual({});
  });
});

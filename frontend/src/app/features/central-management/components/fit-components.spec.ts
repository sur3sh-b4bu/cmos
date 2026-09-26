import { Type, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { StaticTranslateLoader } from '../../../core/i18n/static-translate-loader';
import { Insight, OverviewChurch } from '../central.models';
import { ChurchCardsComponent } from './church-cards';
import { InsightSnapshotComponent } from './insight-snapshot';
import { KpiCardComponent } from './kpi-card';
import { MomentumRow, MomentumTableComponent } from './momentum-table';
import { RankBarsComponent, RankItem } from './rank-bars';

/** A ResizeObserver a test can drive, so a component can be given a box of any size. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  constructor(private cb: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(): void {
    /* the test drives the size through fire() */
  }
  disconnect(): void {
    /* nothing to release */
  }
  fire(width: number, height: number): void {
    this.cb([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

async function mount<T>(type: Type<T>, inputs: Record<string, unknown>): Promise<ComponentFixture<T>> {
  await TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideTranslateService({ lang: 'en', fallbackLang: 'en', loader: provideTranslateLoader(StaticTranslateLoader) })],
  }).compileComponents();
  const fixture = TestBed.createComponent(type);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture;
}

async function resize<T>(fixture: ComponentFixture<T>, width: number, height: number): Promise<void> {
  FakeResizeObserver.instances[FakeResizeObserver.instances.length - 1].fire(width, height);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

const text = (fixture: ComponentFixture<unknown>) => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ').trim();
const count = (fixture: ComponentFixture<unknown>, selector: string) => (fixture.nativeElement as HTMLElement).querySelectorAll(selector).length;

beforeEach(() => {
  FakeResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});
afterEach(() => vi.unstubAllGlobals());

const INR = { code: 'INR', symbol: '₹' };
const delta = (value: number) => ({ value, previous: value, changePct: 0 });
const church = (id: number): OverviewChurch => ({
  id,
  name: `Church ${id}`,
  nameTa: null,
  branches: 1,
  intentions: delta(10),
  certificates: { ...delta(2), baptism: 1, marriage: 1, death: 0 },
  contributions: { ...delta(1000), count: 3 },
  activity: delta(12),
  level: 'medium',
  spark: [1, 2, 3],
});

describe('ChurchCardsComponent - as many cards as fit, the rest behind "View all"', () => {
  const churches = (n: number) => Array.from({ length: n }, (_, i) => church(i + 1));

  it('shows every church when they all fit', async () => {
    const f = await mount(ChurchCardsComponent, { churches: churches(6), currency: INR });
    await resize(f, 620, 300); // 3 columns x 3 rows
    expect(count(f, '[data-testid^=church-card-]')).toBe(6);
    expect(count(f, '[data-testid=church-cards-view-all]')).toBe(0);
  });

  it('gives the last slot to "View all" when they do not', async () => {
    const f = await mount(ChurchCardsComponent, { churches: churches(20), currency: INR });
    await resize(f, 620, 300); // room for 9 slots
    expect(count(f, '[data-testid^=church-card-]')).toBe(8);
    expect(count(f, '[data-testid=church-cards-view-all]')).toBe(1);
    expect(text(f)).toContain('View all 20 churches');
  });

  it('uses fewer columns in a narrower box, so 50 churches never need scrolling', async () => {
    const f = await mount(ChurchCardsComponent, { churches: churches(50), currency: INR });
    await resize(f, 420, 200); // 2 columns x 2 rows
    expect(count(f, '[data-testid^=church-card-]')).toBe(3);
    expect(count(f, '[data-testid=church-cards-view-all]')).toBe(1);
  });

  it('emits the church that was clicked', async () => {
    const f = await mount(ChurchCardsComponent, { churches: churches(3), currency: INR });
    const picked: number[] = [];
    f.componentInstance.churchSelect.subscribe((id) => picked.push(id));
    await resize(f, 620, 300);
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid=church-card-2]')!.click();
    expect(picked).toEqual([2]);
  });
});

describe('MomentumTableComponent - rows that fit, the rest behind "View all"', () => {
  const rows = (n: number): MomentumRow[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Church ${i + 1}`, current: '₹1L', previous: '₹90K', change: '+11%', direction: 'up' }));

  it('shows all rows when there is room (20px header + 25px per row)', async () => {
    const f = await mount(MomentumTableComponent, { rows: rows(6) });
    await resize(f, 500, 170);
    expect(count(f, '.mo__row')).toBe(6);
    expect(count(f, '.mo__more')).toBe(0);
  });

  it('keeps one slot for "View all" when rows are hidden', async () => {
    const f = await mount(MomentumTableComponent, { rows: rows(9) });
    await resize(f, 500, 120); // 4 rows of room
    expect(count(f, '.mo__row')).toBe(3);
    expect(text(f)).toContain('View all (9)');
  });

  it('always shows at least one row, however short the box', async () => {
    const f = await mount(MomentumTableComponent, { rows: rows(9) });
    await resize(f, 500, 30);
    expect(count(f, '.mo__row')).toBe(1);
  });
});

describe('RankBarsComponent', () => {
  const items = (n: number): RankItem[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, label: `Church ${i + 1}`, value: (n - i) * 10, display: String((n - i) * 10) }));

  it('draws the longest bar at full width and the rest in proportion', async () => {
    const f = await mount(RankBarsComponent, { items: items(3) });
    await resize(f, 400, 200);
    const bars = Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.rb__bar')).map((b) => parseFloat(b.style.width));
    expect(bars[0]).toBe(100);
    expect(bars[1]).toBeCloseTo(66.67, 1);
    expect(bars[2]).toBeCloseTo(33.33, 1);
  });

  it('turns the rows that do not fit into "View all"', async () => {
    const f = await mount(RankBarsComponent, { items: items(12) });
    await resize(f, 400, 27 * 5); // 5 slots
    expect(count(f, '.rb__row')).toBe(4);
    expect(text(f)).toContain('View all (12)');
  });

  it('says so when there is nothing to rank', async () => {
    const f = await mount(RankBarsComponent, { items: [] });
    await resize(f, 400, 200);
    expect(text(f)).toContain('No activity in this period');
  });
});

describe('KpiCardComponent', () => {
  it('shows the change against the previous period, and "new" when there is nothing to compare with', async () => {
    const up = await mount(KpiCardComponent, { label: 'Received', value: '₹1.2L', changePct: 12.5 });
    expect(text(up)).toContain('+12.5%');
    TestBed.resetTestingModule();
    const fresh = await mount(KpiCardComponent, { label: 'Received', value: '₹1.2L', changePct: null });
    expect(count(fresh, '.kpi__chip--new')).toBe(1);
    TestBed.resetTestingModule();
    const none = await mount(KpiCardComponent, { label: 'Churches', value: '9' });
    expect(count(none, '.kpi__chip')).toBe(0);
  });

  it('offers the full text of a name that had to be cut short', async () => {
    const f = await mount(KpiCardComponent, { label: 'Busiest', value: 'St. Francis Xavier Church, Old Harbour Road Parish', textValue: true });
    expect(f.componentInstance.hover()).toBe('St. Francis Xavier Church, Old Harbour Road Parish');
    TestBed.resetTestingModule();
    const money = await mount(KpiCardComponent, { label: 'Received', value: '₹1.2L', tooltip: '₹1,24,300' });
    expect(money.componentInstance.hover()).toBe('₹1,24,300');
  });
});

describe('InsightSnapshotComponent - plain sentences from calculated numbers', () => {
  const items: Insight[] = [
    { key: 'contributions', tone: 'up', params: { changePct: 26.7, amount: 1748840, previous: 1380740 } },
    { key: 'intentions', tone: 'down', params: { changePct: -9, value: 631, previous: 688 } },
    { key: 'certificatesTop', tone: 'flat', params: { church: { id: 2, name: 'Holy Cross Cathedral', nameTa: null }, count: 20 } },
    { key: 'inactive', tone: 'attention', params: { count: 5, churches: [{ id: 9, name: 'Chapel A', nameTa: null }, { id: 8, name: 'Chapel B', nameTa: null }] } },
  ];

  it('words each insight with its own numbers, in rupees written the Indian way', async () => {
    const f = await mount(InsightSnapshotComponent, { items, currency: INR, max: 4 });
    const t = text(f);
    expect(t).toContain('Contributions received are up 26.7% — ₹17.5L vs ₹13.8L in the previous period.');
    expect(t).toContain('Mass Intention activity is down 9% (631 vs 688).');
    expect(t).toContain('Certificate activity is highest in Holy Cross Cathedral (20 in the period).');
  });

  it('names the idle churches, and marks that the list was cut short', async () => {
    const f = await mount(InsightSnapshotComponent, { items, currency: INR, max: 4 });
    expect(text(f)).toContain('5 church(es) recorded no activity in this period: Chapel A, Chapel B….');
  });

  it('shows only as many as asked, leaving the rest to "View full insight"', async () => {
    const f = await mount(InsightSnapshotComponent, { items, currency: INR, max: 2 });
    expect(count(f, '.ins__line')).toBe(2);
    expect(text(f)).toContain('View full insight');
  });
});

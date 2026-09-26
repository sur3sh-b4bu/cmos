import { AppLang } from '../../core/i18n/translations';
import { localizedName } from '../../core/utils/localized-name.util';
import { ChurchRef, Granularity } from './central.models';

/** Locale used for number and month/day formatting: Indian digit grouping for both English and Tamil. */
const LOCALE: Record<AppLang, string> = { en: 'en-IN', ta: 'ta-IN' };

export interface CurrencyInfo {
  code: string;
  symbol: string;
}

export function formatCount(value: number, lang: AppLang = 'en'): string {
  return new Intl.NumberFormat(LOCALE[lang]).format(Math.round(value));
}

export function formatDecimal(value: number, lang: AppLang = 'en'): string {
  return new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 1 }).format(value);
}

/**
 * A compact amount for a KPI or chart label: Indian rupees use lakh and crore (₹1.24L, ₹2.5Cr), every other
 * currency K / M / B. Below a thousand the exact amount is shown. `full` gives the exact, grouped figure for
 * tooltips (₹1,24,300).
 */
export function formatMoney(value: number, currency: CurrencyInfo, lang: AppLang = 'en', full = false): string {
  const symbol = currency.symbol || currency.code;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (full || abs < 1000) {
    return `${sign}${symbol}${new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 2 }).format(abs)}`;
  }
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: n >= 100 ? 0 : 1 }).format(n);
  if (currency.code === 'INR') {
    if (abs >= 1e7) return `${sign}${symbol}${fmt(abs / 1e7)}Cr`;
    if (abs >= 1e5) return `${sign}${symbol}${fmt(abs / 1e5)}L`;
    return `${sign}${symbol}${fmt(abs / 1e3)}K`;
  }
  if (abs >= 1e9) return `${sign}${symbol}${fmt(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}${symbol}${fmt(abs / 1e6)}M`;
  return `${sign}${symbol}${fmt(abs / 1e3)}K`;
}

/** "+14.8%", "-3.2%", or an en dash when there is no previous figure to compare with. */
export function formatChange(changePct: number | null): string {
  if (changePct === null) return '–';
  if (changePct === 0) return '0%';
  return `${changePct > 0 ? '+' : '-'}${Math.abs(changePct)}%`;
}

export type TrendDirection = 'up' | 'down' | 'flat' | 'new';

/** Within ±2% is "flat": a swing that small is noise, not movement. */
export function trendDirection(changePct: number | null): TrendDirection {
  if (changePct === null) return 'new';
  if (changePct > 2) return 'up';
  if (changePct < -2) return 'down';
  return 'flat';
}

export function churchLabel(ref: Pick<ChurchRef, 'name' | 'nameTa'> | null | undefined, lang: AppLang): string {
  return ref ? localizedName({ name: ref.name, name_ta: ref.nameTa }, lang) : '';
}

/** A named row from the API (intention type, contribution type): its Tamil name in Tamil, else English, else `fallback`. */
export function namedLabel(row: { name: string | null; nameTa: string | null }, lang: AppLang, fallback: string): string {
  if (lang === 'ta' && row.nameTa) return row.nameTa;
  return row.name || fallback;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** The label under a chart point: "25 Sep" for a day, "Sep 26" for a month, "2026" for a year. */
export function bucketLabel(key: string, granularity: Granularity, lang: AppLang = 'en'): string {
  if (granularity === 'year') return key;
  const date = parseKey(granularity === 'month' ? `${key}-01` : key);
  if (granularity === 'month') return new Intl.DateTimeFormat(LOCALE[lang], { month: 'short', year: '2-digit' }).format(date);
  return new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'short' }).format(date);
}

/** "25 Sep 2026", the same way everywhere a full date is shown. */
export function fullDate(key: string, lang: AppLang = 'en'): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'short', year: 'numeric' }).format(parseKey(key));
}

/** MySQL DAYOFWEEK: 1 = Sunday ... 7 = Saturday. */
export function weekdayShort(dow: number, lang: AppLang = 'en'): string {
  const sunday = new Date(2023, 0, 1); // a Sunday
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'short' }).format(new Date(sunday.getFullYear(), 0, 1 + (dow - 1)));
}

export function monthShort(month: number, lang: AppLang = 'en'): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { month: 'short' }).format(new Date(2023, month - 1, 1));
}

/** Round, human-friendly axis ticks (0, 20, 40, 60) so a gridline's label matches where it is drawn. */
export function niceTicks(maxValue: number, target = 4): number[] {
  if (maxValue <= 0) return [0, 1];
  const rawStep = maxValue / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  // Counts and rupees come in whole numbers, so a gridline never sits between two of them.
  const step = Math.max(1, (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude);
  const niceMax = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/** Which of `count` labels to draw so they never overlap: an evenly spaced subset that always includes the ends. */
export function thinIndices(count: number, maxLabels: number): number[] {
  if (count <= 0) return [];
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil((count - 1) / Math.max(1, maxLabels - 1));
  const indices: number[] = [];
  for (let i = 0; i < count; i += step) indices.push(i);
  if (indices[indices.length - 1] !== count - 1) {
    if (count - 1 - indices[indices.length - 1] < step / 2) indices[indices.length - 1] = count - 1;
    else indices.push(count - 1);
  }
  return indices;
}

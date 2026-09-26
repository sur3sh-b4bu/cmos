import { Observable, firstValueFrom } from 'rxjs';
import { CentralAnalyticsService } from './central-analytics.service';
import {
  BranchesResponse,
  CentralQuery,
  CertificatesResponse,
  ContributionsResponse,
  Context,
  MassIntentionsResponse,
  OverviewResponse,
  RegisterResponse,
} from './central.models';
import { Cell, ReportSheet } from './report-builder';

export type ReportCategory = 'activity' | 'financial' | 'people' | 'management';

/** What a report needs to turn API numbers into a sheet: the current language's church names and column labels. */
export interface ReportEnv {
  analytics: CentralAnalyticsService;
  query: CentralQuery;
  name: (ref: { name: string; nameTa: string | null } | null | undefined) => string;
  t: (key: string) => string;
}

export interface ReportResult {
  context: Context;
  sheets: ReportSheet[];
}

export interface ReportDefinition {
  id: string;
  category: ReportCategory;
  icon: string;
  run: (env: ReportEnv) => Promise<ReportResult>;
}

const get = <T>(source: Observable<T>) => firstValueFrom(source);
const col = (env: ReportEnv, ...keys: string[]) => keys.map((k) => env.t(`central.reports.col.${k}`));
const change = (v: number | null): Cell => (v === null ? null : v);
const monthly = (context: Context, values: number[]): Cell[][] => context.period.buckets.map((key, i) => [key, values[i] ?? 0]);

/**
 * The reports the Reports & Insights workspace can generate. Every one is built from the SAME live analytics the
 * Central Management screens show (same filters, same definitions), so a report can never disagree with a screen.
 * Amounts are written as numbers, not formatted text, so they can be summed in Excel.
 */
export const REPORTS: ReportDefinition[] = [
  // ------------------------------------------------------------------ activity
  {
    id: 'church-activity',
    category: 'activity',
    icon: 'insights',
    run: async (env) => {
      const o: OverviewResponse = await get(env.analytics.overview(env.query));
      return {
        context: o.context,
        sheets: [
          {
            name: env.t('central.reports.name.church-activity'),
            headers: col(env, 'church', 'branches', 'intentions', 'certificates', 'contributions', 'activity', 'previousActivity', 'change', 'level'),
            rows: o.churches.map((c) => [env.name(c), c.branches, c.intentions.value, c.certificates.value, c.contributions.value, c.activity.value, c.activity.previous, change(c.activity.changePct), env.t(`central.level.${c.level}`)]),
          },
        ],
      };
    },
  },
  {
    id: 'certificate-activity',
    category: 'activity',
    icon: 'description',
    run: async (env) => {
      const o: OverviewResponse = await get(env.analytics.overview(env.query));
      return {
        context: o.context,
        sheets: [
          {
            name: env.t('central.reports.name.certificate-activity'),
            headers: col(env, 'church', 'baptism', 'marriage', 'death', 'certificates', 'previous', 'change'),
            rows: o.churches.map((c) => [env.name(c), c.certificates.baptism, c.certificates.marriage, c.certificates.death, c.certificates.value, c.certificates.previous, change(c.certificates.changePct)]),
          },
        ],
      };
    },
  },
  {
    id: 'mass-intention-report',
    category: 'activity',
    icon: 'volunteer_activism',
    run: async (env) => {
      const m: MassIntentionsResponse = await get(env.analytics.massIntentions(env.query));
      return {
        context: m.context,
        sheets: [
          {
            name: env.t('central.reports.name.mass-intention-report'),
            headers: col(env, 'church', 'intentions', 'previous', 'change', 'paid', 'unpaid', 'share'),
            rows: m.byChurch.map((c) => [env.name(c), c.value, c.previous, change(c.changePct), c.paid, c.unpaid, c.share]),
          },
          {
            name: env.t('central.reports.col.type'),
            headers: col(env, 'type', 'intentions', 'share'),
            rows: m.types.map((ty) => [ty.key === 'custom' ? env.t('central.mi.customIntention') : ty.key === 'other' ? env.t('central.others') : ty.name ?? '', ty.value, ty.share]),
          },
        ],
      };
    },
  },
  {
    id: 'prayer-participation',
    category: 'activity',
    icon: 'menu_book',
    run: async (env) => {
      const r: RegisterResponse = await get(env.analytics.register(env.query));
      return {
        context: r.context,
        sheets: [
          {
            name: env.t('central.reports.name.prayer-participation'),
            headers: col(env, 'church', 'registrations', 'previous', 'change', 'share'),
            rows: r.byChurch.map((c) => [env.name(c), c.value, c.previous, change(c.changePct), c.share]),
          },
          { name: env.t('central.reports.col.period'), headers: col(env, 'period', 'registrations'), rows: monthly(r.context, r.trend.map((p) => p.value)) },
        ],
      };
    },
  },

  // ------------------------------------------------------------------ financial
  {
    id: 'contribution-summary',
    category: 'financial',
    icon: 'redeem',
    run: async (env) => {
      const c: ContributionsResponse = await get(env.analytics.contributions(env.query));
      return {
        context: c.context,
        sheets: [
          {
            name: env.t('central.reports.name.contribution-summary'),
            headers: col(env, 'measure', 'value', 'previous', 'change'),
            rows: [
              [env.t('central.con.received'), c.kpis.received.value, c.kpis.received.previous, change(c.kpis.received.changePct)],
              [env.t('central.con.count'), c.kpis.count.value, c.kpis.count.previous, change(c.kpis.count.changePct)],
              [env.t('central.con.avgPerChurch'), c.kpis.avgPerChurch.value, c.kpis.avgPerChurch.previous, change(c.kpis.avgPerChurch.changePct)],
              [env.t('central.con.yearToDate'), c.kpis.yearToDate.value, null, null],
            ],
          },
          {
            name: env.t('central.con.composition'),
            headers: col(env, 'type', 'count', 'amount', 'share'),
            rows: c.composition.map((x) => [x.key === 'other' ? env.t('central.con.unspecified') : x.name ?? env.t('central.con.unspecified'), x.count, x.value, x.share]),
          },
        ],
      };
    },
  },
  {
    id: 'church-contribution',
    category: 'financial',
    icon: 'account_balance',
    run: async (env) => {
      const c: ContributionsResponse = await get(env.analytics.contributions(env.query));
      return {
        context: c.context,
        sheets: [
          {
            name: env.t('central.reports.name.church-contribution'),
            headers: col(env, 'church', 'amount', 'previousAmount', 'change', 'count', 'share'),
            rows: c.byChurch.map((x) => [env.name(x), x.value, x.previous, change(x.changePct), x.count, x.share]),
          },
        ],
      };
    },
  },
  {
    id: 'monthly-financial',
    category: 'financial',
    icon: 'trending_up',
    run: async (env) => {
      const c: ContributionsResponse = await get(env.analytics.contributions(env.query));
      return {
        context: c.context,
        sheets: [{ name: env.t('central.reports.name.monthly-financial'), headers: col(env, 'period', 'amount'), rows: monthly(c.context, c.trend.map((p) => p.value)) }],
      };
    },
  },

  // ------------------------------------------------------------------ people & sacraments
  ...(['baptism', 'marriage', 'death'] as const).map(
    (type): ReportDefinition => ({
      id: `${type}-summary`,
      category: 'people',
      icon: { baptism: 'water_drop', marriage: 'favorite', death: 'church' }[type],
      run: async (env) => {
        const c: CertificatesResponse = await get(env.analytics.certificates(type, env.query));
        return {
          context: c.context,
          sheets: [
            {
              name: env.t(`central.reports.name.${type}-summary`),
              headers: col(env, 'church', 'events', 'previous', 'change', 'share'),
              rows: c.byChurch.map((x) => [env.name(x), x.value, x.previous, change(x.changePct), x.share]),
            },
            { name: env.t('central.reports.col.period'), headers: col(env, 'period', 'events'), rows: monthly(c.context, c.trend.map((p) => p.value)) },
            {
              name: env.t('central.cert.timeliness'),
              headers: col(env, 'measure', 'value'),
              rows: [
                [env.t('central.cert.enteredOnTime'), c.timeliness.onTime],
                [env.t('central.cert.enteredLater'), c.timeliness.late],
              ],
            },
          ],
        };
      },
    })
  ),

  // ------------------------------------------------------------------ management
  {
    id: 'church-comparison',
    category: 'management',
    icon: 'compare_arrows',
    run: async (env) => {
      const o: OverviewResponse = await get(env.analytics.overview(env.query));
      return {
        context: o.context,
        sheets: [
          {
            name: env.t('central.reports.name.church-comparison'),
            headers: col(env, 'church', 'intentions', 'previous', 'certificates', 'previous', 'contributions', 'previousAmount', 'activity', 'previous', 'change'),
            rows: o.churches.map((c) => [env.name(c), c.intentions.value, c.intentions.previous, c.certificates.value, c.certificates.previous, c.contributions.value, c.contributions.previous, c.activity.value, c.activity.previous, change(c.activity.changePct)]),
          },
        ],
      };
    },
  },
  {
    id: 'branch-performance',
    category: 'management',
    icon: 'alt_route',
    run: async (env) => {
      const b: BranchesResponse = await get(env.analytics.branches(env.query));
      return {
        context: b.context,
        sheets: [
          {
            name: env.t('central.reports.name.branch-performance'),
            headers: col(env, 'church', 'branch', 'intentions', 'certificates', 'contributions', 'count'),
            rows: b.rows.map((r) => [env.name(r.church), r.branch ? r.branch.name : env.t('central.drawer.churchWide'), r.intentions.value, r.certificates.value, r.contributions.value, r.contributions.count]),
          },
        ],
      };
    },
  },
  {
    id: 'monthly-management',
    category: 'management',
    icon: 'summarize',
    run: async (env) => {
      const o: OverviewResponse = await get(env.analytics.overview(env.query));
      const b = o.context.period.buckets;
      return {
        context: o.context,
        sheets: [
          {
            name: env.t('central.reports.name.monthly-management'),
            headers: col(env, 'period', 'intentions', 'certificates', 'contributions', 'activity'),
            rows: b.map((key, i) => [key, o.kpis.intentions.spark[i] ?? 0, o.kpis.certificates.spark[i] ?? 0, o.kpis.contributions.spark[i] ?? 0, o.kpis.activity.spark[i] ?? 0]),
          },
        ],
      };
    },
  },
];

export const CATEGORIES: ReportCategory[] = ['activity', 'financial', 'people', 'management'];

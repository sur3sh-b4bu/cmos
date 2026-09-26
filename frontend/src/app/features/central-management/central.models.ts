/** Shapes returned by the Central Management analytics API (backend/src/central/centralService.js). */

export type Period = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
export type Granularity = 'day' | 'month' | 'year';
export type ActivityLevel = 'high' | 'medium' | 'low' | 'none';
export type CertificateType = 'baptism' | 'marriage' | 'death';

/** What the filters ask for; sent as query parameters. */
export interface CentralQuery {
  period: Period;
  from?: string;
  to?: string;
  churchId?: number | null;
  branchId?: number | null;
}

/** A number, what it was in the previous period, and the change. `changePct` is null when there is nothing to compare with. */
export interface Delta {
  value: number;
  previous: number;
  changePct: number | null;
}

export interface ChurchRef {
  id: number;
  name: string;
  nameTa: string | null;
}

export interface Context {
  period: { preset: Period; from: string; to: string; previous: { from: string; to: string }; granularity: Granularity; buckets: string[] };
  scope: { churchId: number | null; branchId: number | null };
  currency: { code: string; symbol: string };
  generatedAt: string;
}

export interface TrendPoint {
  key: string;
  value: number;
}

export interface ChurchRank extends ChurchRef {
  value: number;
  previous: number;
  changePct: number | null;
  share: number;
}

export interface NamedValue {
  key: string;
  name: string | null;
  nameTa: string | null;
  value: number;
  share: number;
}

// ---------------------------------------------------------------------------- overview

export interface OverviewChurch extends ChurchRef {
  branches: number;
  intentions: Delta;
  certificates: Delta & { baptism: number; marriage: number; death: number };
  contributions: Delta & { count: number };
  activity: Delta;
  level: ActivityLevel;
  spark: number[];
}

export interface OverviewResponse {
  context: Context;
  kpis: {
    churches: { value: number; newInPeriod: number };
    branches: { value: number };
    activity: Delta & { spark: number[] };
    intentions: Delta & { spark: number[] };
    certificates: Delta & { spark: number[] };
    contributions: Delta & { count: number; spark: number[] };
  };
  churches: OverviewChurch[];
}

// ---------------------------------------------------------------------------- module analytics

export interface MostActive {
  id: number;
  name: string;
  nameTa: string | null;
  value: number;
}

export interface MassIntentionsResponse {
  context: Context;
  kpis: {
    total: Delta;
    paid: { value: number; ofTotalPct: number };
    unpaid: { value: number; ofTotalPct: number };
    avgPerChurch: Delta;
    busiestChurch: MostActive | null;
  };
  trend: TrendPoint[];
  byChurch: (ChurchRank & { paid: number; unpaid: number })[];
  types: NamedValue[];
}

export interface RegisterResponse {
  context: Context;
  kpis: {
    registrations: Delta;
    today: { value: number; date: string };
    dailyAverage: Delta;
    peakDay: { date: string; n: number } | null;
    mostActiveChurch: MostActive | null;
    activeDaysPct: Delta;
    activeDays: { active: number; total: number };
  };
  trend: TrendPoint[];
  byChurch: ChurchRank[];
  heat: { slots: ('morning' | 'afternoon' | 'evening')[]; rows: { dow: number; morning: number; afternoon: number; evening: number }[]; max: number };
}

export interface CertificatesResponse {
  context: Context;
  type: CertificateType;
  kpis: {
    inPeriod: Delta;
    yearToDate: { value: number };
    recorded: { value: number };
    onTimePct: Delta;
    mostActiveChurch: MostActive | null;
  };
  trend: TrendPoint[];
  byChurch: ChurchRank[];
  distributions: { key: 'ageBands' | 'gender' | 'seasonality'; items: TrendPoint[] }[];
  timeliness: { onTime: number; late: number; total: number };
}

export interface ContributionsResponse {
  context: Context;
  kpis: {
    received: Delta;
    count: Delta;
    yearToDate: { value: number };
    avgPerChurch: Delta;
    topChurch: MostActive | null;
  };
  trend: TrendPoint[];
  byChurch: (ChurchRank & { count: number })[];
  composition: (NamedValue & { count: number })[];
}

// ---------------------------------------------------------------------------- insights, drawer, branches

export type InsightTone = 'up' | 'down' | 'flat' | 'new' | 'attention';

export interface Insight {
  key: 'contributions' | 'intentions' | 'certificatesTop' | 'register' | 'contributionShare' | 'inactive';
  tone: InsightTone;
  params: Record<string, unknown>;
}

export interface InsightsResponse {
  context: Context;
  items: Insight[];
}

export interface BranchRow {
  church: ChurchRef;
  branch: { id: number; name: string } | null;
  intentions: Delta;
  certificates: Delta;
  contributions: Delta & { count: number };
}

export interface BranchesResponse {
  context: Context;
  rows: BranchRow[];
}

export interface ChurchDetailResponse {
  context: Context;
  church: ChurchRef & { branches: number };
  metrics: {
    intentions: Delta;
    certificates: Delta & { baptism: number; marriage: number; death: number };
    contributions: Delta & { count: number };
    registerActiveDaysPct: Delta;
  };
  spark: number[];
  recent: { date: string; intentions: number; contributions: number; certificatesRecorded: number }[];
  branches: BranchRow[];
}

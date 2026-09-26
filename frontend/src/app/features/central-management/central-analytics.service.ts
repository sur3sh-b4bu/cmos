import { HttpClient, HttpParams } from '@angular/common/http';
import { DestroyRef, Injectable, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MasterLookupService } from '../../core/services/master-lookup.service';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import {
  BranchesResponse,
  CentralQuery,
  CertificateType,
  CertificatesResponse,
  ChurchDetailResponse,
  ContributionsResponse,
  InsightsResponse,
  MassIntentionsResponse,
  OverviewResponse,
  Period,
  RegisterResponse,
} from './central.models';

/** Every Central Management screen reads from these; each call is one live aggregation on the server. */
@Injectable({ providedIn: 'root' })
export class CentralAnalyticsService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/central`;

  overview(q: CentralQuery): Observable<OverviewResponse> {
    return this.get('overview', q);
  }
  massIntentions(q: CentralQuery): Observable<MassIntentionsResponse> {
    return this.get('mass-intentions', q);
  }
  register(q: CentralQuery): Observable<RegisterResponse> {
    return this.get('register', q);
  }
  certificates(type: CertificateType, q: CentralQuery): Observable<CertificatesResponse> {
    return this.get(`certificates/${type}`, q);
  }
  contributions(q: CentralQuery): Observable<ContributionsResponse> {
    return this.get('contributions', q);
  }
  insights(q: CentralQuery): Observable<InsightsResponse> {
    return this.get('insights', q);
  }
  branches(q: CentralQuery): Observable<BranchesResponse> {
    return this.get('branches', q);
  }
  church(id: number, q: CentralQuery): Observable<ChurchDetailResponse> {
    return this.get(`church/${id}`, { ...q, churchId: undefined });
  }

  private get<T>(path: string, q: CentralQuery): Observable<T> {
    let params = new HttpParams().set('period', q.period);
    if (q.period === 'custom' && q.from && q.to) params = params.set('from', q.from).set('to', q.to);
    if (q.churchId) params = params.set('churchId', q.churchId);
    if (q.churchId && q.branchId) params = params.set('branchId', q.branchId);
    return this.http.get<{ data: T }>(`${this.base}/${path}`, { params }).pipe(map((res) => res.data));
  }
}

export interface ChurchOption {
  id: number;
  name: string;
  name_ta?: string | null;
}

export interface BranchOption {
  id: number;
  name: string;
}

const STORAGE_KEY = 'coms.central.filters';
const PERIODS: Period[] = ['today', 'week', 'month', 'quarter', 'year', 'custom'];

interface StoredFilters {
  churchId: number | null;
  branchId: number | null;
  preset: Period;
  from: string;
  to: string;
}

/**
 * The one set of filters every Central Management screen shares: church, branch and period. Kept for the
 * browser session so moving between screens (or reloading) does not reset what the administrator was looking at.
 */
@Injectable({ providedIn: 'root' })
export class CentralFilterService {
  private masterLookup = inject(MasterLookupService);

  readonly churchId = signal<number | null>(null);
  readonly branchId = signal<number | null>(null);
  readonly preset = signal<Period>('month');
  readonly from = signal('');
  readonly to = signal('');

  readonly churches = signal<ChurchOption[]>([]);
  readonly branches = signal<BranchOption[]>([]);

  /** What the API is asked for. A custom period is only sent once both dates are filled in. */
  readonly query: Signal<CentralQuery> = computed(() => ({
    period: this.preset() === 'custom' && !(this.from() && this.to()) ? 'month' : this.preset(),
    from: this.from() || undefined,
    to: this.to() || undefined,
    churchId: this.churchId(),
    branchId: this.branchId(),
  }));

  constructor() {
    const stored = this.read();
    if (stored) {
      this.churchId.set(stored.churchId);
      this.branchId.set(stored.branchId);
      this.preset.set(stored.preset);
      this.from.set(stored.from);
      this.to.set(stored.to);
    }
    effect(() => {
      const value: StoredFilters = { churchId: this.churchId(), branchId: this.branchId(), preset: this.preset(), from: this.from(), to: this.to() };
      untracked(() => this.write(value));
    });
  }

  /** Loads the church list (once) and the branches of the chosen church. */
  loadOptions(): void {
    if (!this.churches().length) {
      this.masterLookup.list<ChurchOption>('churches').subscribe({ next: (rows) => this.churches.set(rows), error: () => this.churches.set([]) });
    }
    this.loadBranches();
  }

  setChurch(id: number | null): void {
    this.churchId.set(id);
    this.branchId.set(null);
    this.loadBranches();
  }

  setBranch(id: number | null): void {
    this.branchId.set(id);
  }

  setPreset(preset: Period): void {
    this.preset.set(preset);
  }

  setCustom(from: string, to: string): void {
    this.from.set(from);
    this.to.set(to);
    this.preset.set('custom');
  }

  private loadBranches(): void {
    const churchId = this.churchId();
    if (!churchId) {
      this.branches.set([]);
      return;
    }
    this.masterLookup.list<BranchOption>('branches', { church_id: churchId }).subscribe({ next: (rows) => this.branches.set(rows), error: () => this.branches.set([]) });
  }

  private read(): StoredFilters | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw) as StoredFilters;
      return PERIODS.includes(v.preset) ? v : null;
    } catch {
      return null;
    }
  }

  private write(value: StoredFilters): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage blocked: the filters still work for this page's lifetime.
    }
  }
}

export interface Loader<T> {
  data: Signal<T | null>;
  loading: Signal<boolean>;
  error: Signal<string | null>;
}

/**
 * Loads a screen's data and reloads it whenever the shared filters change. Call from a component's field
 * initializer. A slower, older response never overwrites a newer one (the filters can change faster than the API answers).
 */
export function createLoader<T>(fetch: (query: CentralQuery) => Observable<T>): Loader<T> {
  const filters = inject(CentralFilterService);
  const destroyRef = inject(DestroyRef);
  const data = signal<T | null>(null);
  const loading = signal(true);
  const error = signal<string | null>(null);
  let latest = 0;
  let subscription: { unsubscribe(): void } | null = null;
  destroyRef.onDestroy(() => subscription?.unsubscribe());

  effect(() => {
    const query = filters.query();
    untracked(() => {
      const mine = (latest += 1);
      subscription?.unsubscribe();
      loading.set(true);
      error.set(null);
      subscription = fetch(query).subscribe({
        next: (value) => {
          if (mine !== latest) return;
          data.set(value);
          loading.set(false);
        },
        error: (err) => {
          if (mine !== latest) return;
          error.set(extractErrorMessage(err));
          loading.set(false);
        },
      });
    });
  });

  return { data, loading, error };
}

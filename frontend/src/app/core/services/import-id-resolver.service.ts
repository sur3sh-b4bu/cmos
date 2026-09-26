import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MasterLookupService } from './master-lookup.service';

/**
 * Resolves a relational import cell (see excel-import.util.ts) to the
 * numeric foreign-key id a create() call actually needs -- accepting either
 * the raw id itself or the referenced row's name (case-insensitive), so a
 * sheet built by editing an Export -- which shows names, e.g. "Male" for
 * Gender, not the underlying gender_id -- imports back without the reader
 * needing to already know internal ids.
 *
 * Not every relational master is reachable through the generic masters API
 * (Roles is its own top-level resource, not /api/masters/roles) -- callers
 * for those pass an explicit `fetch` override to preload() instead of
 * relying on the MasterLookupService default.
 */
@Injectable({ providedIn: 'root' })
export class ImportIdResolverService {
  private masterLookup = inject(MasterLookupService);
  private cache = new Map<string, Map<string, number>>(); // masterKey -> (name.toLowerCase() -> id)

  /** Fetches each distinct masterKey once (skipping ones already cached from
   * an earlier call in the same session) so resolve() can run synchronously
   * per row afterward. Call before processing any rows. */
  async preload(masterKeys: string[], fetchOverrides: Record<string, () => Promise<{ id: number; name?: string }[]>> = {}): Promise<void> {
    const uniqueKeys = [...new Set(masterKeys)].filter((k) => !this.cache.has(k));
    await Promise.all(
      uniqueKeys.map(async (key) => {
        const rows = fetchOverrides[key]
          ? await fetchOverrides[key]()
          : await firstValueFrom(this.masterLookup.list<{ id: number; name?: string; label?: string }>(key));
        const byName = new Map<string, number>();
        for (const row of rows) {
          const name = String((row as any).name ?? (row as any).label ?? '').trim().toLowerCase();
          if (name) byName.set(name, row.id);
        }
        this.cache.set(key, byName);
      })
    );
  }

  /** Synchronous -- preload() must have already been called for this
   * masterKey. Tries the value as a raw id first (whole numbers only, so a
   * name that happens to start with a digit, e.g. "1st Communion", isn't
   * mistaken for one), then falls back to a case-insensitive name match.
   * Returns undefined for a blank cell or one that matches nothing. */
  resolve(masterKey: string, value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    const trimmed = String(value).trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    return this.cache.get(masterKey)?.get(trimmed.toLowerCase());
  }
}

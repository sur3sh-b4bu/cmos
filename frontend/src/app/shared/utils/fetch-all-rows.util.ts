import { Observable, firstValueFrom } from 'rxjs';
import { ApiListResponse } from '../../core/models/api-response.model';

/** Backend's own hard cap per request (see backend/src/utils/pagination.js's
 * MAX_PAGE_SIZE) -- the largest single page a list endpoint will ever return
 * regardless of what pageSize is asked for. */
const MAX_PAGE_SIZE = 1000;

/**
 * Fetches every row matching the current filters/search, ignoring whatever
 * page the list is actually showing on screen -- for "Export Excel", which
 * must cover the full result set (e.g. all 2000 matching records, not just
 * the 25/50/100 rows of the current page). Pages through at the server's own
 * max page size until every row `meta.total` promised has been collected.
 *
 * `fetchPage` should call the same list() the screen's own fetch() uses,
 * passing through the current search/filters but with the given page/
 * pageSize in place of whatever's on screen -- see any *-list.ts's
 * `exportAllRows` for the pattern.
 */
export async function fetchAllRows<T>(
  fetchPage: (page: number, pageSize: number) => Observable<ApiListResponse<T>>
): Promise<T[]> {
  const rows: T[] = [];
  let total = Infinity;
  let page = 1;
  while (rows.length < total) {
    const res = await firstValueFrom(fetchPage(page, MAX_PAGE_SIZE));
    total = res.meta.total;
    rows.push(...res.data);
    // Defensive: an empty page means there's nothing more to fetch even if
    // `total` disagrees (stale count, concurrent deletes) -- stops here
    // rather than requesting page after page forever.
    if (!res.data.length) break;
    page += 1;
  }
  return rows;
}

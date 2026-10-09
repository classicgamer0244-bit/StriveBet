const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface PageParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  /** "YYYY-MM-DD", inclusive whole-day range — see dateRangeFilter(). */
  from?: string;
  to?: string;
}

/** Reads page/pageSize/search/status/from/to off a request's query string,
 * clamped to sane bounds — the one place every paginated admin/superadmin
 * route parses its list params from. */
export function parsePageParams(searchParams: URLSearchParams): PageParams {
  const page = Math.max(1, Math.trunc(Number(searchParams.get("page")) || 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE)));
  const search = searchParams.get("search")?.trim() || undefined;
  const status = searchParams.get("status")?.trim() || undefined;
  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;
  return { page, pageSize, search, status, from, to };
}

/** Inclusive whole-day range → a Prisma createdAt-style filter. Mirrors the
 * boundary convention the player-facing transactions list already uses
 * client-side (components/account/my-transactions-list.tsx:70-79): `from`
 * starts at 00:00:00.000 and `to` ends at 23:59:59.999 of the named day, so
 * picking the same date for both bounds returns that whole day. Either side
 * can be omitted for an open-ended range. Returns undefined when neither is
 * set, so a caller can `if (range) where.createdAt = range` without an empty
 * `{}` sneaking into the where-clause. */
export function dateRangeFilter(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (from) {
    const gte = new Date(from);
    if (!Number.isNaN(gte.getTime())) {
      gte.setHours(0, 0, 0, 0);
      range.gte = gte;
    }
  }
  if (to) {
    const lte = new Date(to);
    if (!Number.isNaN(lte.getTime())) {
      lte.setHours(23, 59, 59, 999);
      range.lte = lte;
    }
  }
  return Object.keys(range).length > 0 ? range : undefined;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Runs a count + a skip/take findMany in parallel and packages the result —
 * every paginated list route wraps its own `where` with this instead of
 * hand-rolling the skip/take math per route. */
export async function paginate<T>({
  page,
  pageSize,
  count,
  findMany,
}: {
  page: number;
  pageSize: number;
  count: () => Promise<number>;
  findMany: (args: { skip: number; take: number }) => Promise<T[]>;
}): Promise<PaginatedResult<T>> {
  const skip = (page - 1) * pageSize;
  const [total, items] = await Promise.all([count(), findMany({ skip, take: pageSize })]);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

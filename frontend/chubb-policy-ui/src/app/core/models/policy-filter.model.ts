/** The complete query state for the policy list. Mirrors the backend's
 *  PolicyFilterRequest 1:1 and is the single source of truth mirrored into the URL. */
export interface PolicyFilter {
  page: number;
  size: number;
  /** "field,asc" | "field,desc" — server-side sorting. */
  sort: string;
  status: string | null;
  lineOfBusiness: string | null;
  region: string | null;
  effectiveDateFrom: string | null;
  effectiveDateTo: string | null;
  search: string | null;
  /** null = all, true = flagged only, false = unflagged only. */
  flagged: boolean | null;
}

export const DEFAULT_FILTER: PolicyFilter = {
  page: 1,
  size: 20,
  sort: 'createdAt,desc',
  status: null,
  lineOfBusiness: null,
  region: null,
  effectiveDateFrom: null,
  effectiveDateTo: null,
  search: null,
  flagged: null,
};

export type SortableField =
  | 'policyNumber'
  | 'policyholderName'
  | 'lineOfBusiness'
  | 'status'
  | 'premiumAmount'
  | 'effectiveDate'
  | 'expiryDate'
  | 'region'
  | 'underwriter'
  | 'createdAt';

export const PAGE_SIZES = [10, 20, 50, 100] as const;

/** Which filter fields count as "narrowing the result set" — drives the active
 *  filter chips and the empty-state's "clear filters" affordance. Page/size/sort
 *  are view state, not filters, so they are deliberately excluded. */
export const FILTERABLE_KEYS = [
  'status',
  'lineOfBusiness',
  'region',
  'effectiveDateFrom',
  'effectiveDateTo',
  'search',
  'flagged',
] as const satisfies readonly (keyof PolicyFilter)[];

export function activeFilterCount(filter: PolicyFilter): number {
  return FILTERABLE_KEYS.filter((k) => filter[k] !== null && filter[k] !== '').length;
}

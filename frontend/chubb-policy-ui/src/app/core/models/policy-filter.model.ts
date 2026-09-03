export interface PolicyFilter {
  page: number;
  size: number;
  sort: string;
  status: string | null;
  lineOfBusiness: string | null;
  region: string | null;
  effectiveDateFrom: string | null;
  effectiveDateTo: string | null;
  search: string | null;
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
  search: null
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

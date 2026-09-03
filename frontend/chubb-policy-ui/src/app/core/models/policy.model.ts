export type PolicyStatus = 'Active' | 'Expired' | 'Pending' | 'Cancelled';
export type LineOfBusiness = 'Property' | 'Casualty' | 'A&H' | 'Marine';
export type Currency = 'USD' | 'SGD' | 'HKD' | 'AUD' | 'JPY' | 'THB';
export type Region =
  | 'Singapore'
  | 'Hong Kong'
  | 'Australia'
  | 'Japan'
  | 'Thailand'
  | 'Indonesia'
  | 'Malaysia'
  | 'Philippines';

export interface Policy {
  id: string;
  policyNumber: string;
  policyholderName: string;
  lineOfBusiness: LineOfBusiness;
  status: PolicyStatus;
  premiumAmount: number;
  currency: Currency;
  effectiveDate: string;
  expiryDate: string;
  region: Region;
  underwriter: string;
  flaggedForReview: boolean;
  createdAt: string;
  updatedAt: string;
}

export const POLICY_STATUSES: PolicyStatus[] = ['Active', 'Expired', 'Pending', 'Cancelled'];
export const LINES_OF_BUSINESS: LineOfBusiness[] = ['Property', 'Casualty', 'A&H', 'Marine'];
export const REGIONS: Region[] = [
  'Singapore',
  'Hong Kong',
  'Australia',
  'Japan',
  'Thailand',
  'Indonesia',
  'Malaysia',
  'Philippines'
];

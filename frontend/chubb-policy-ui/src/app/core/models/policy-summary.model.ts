/** Mirrors PolicySummaryDto. Every field is served by GET /api/v1/policies/summary
 *  under the same filters as the list, so the numbers always describe the set the
 *  user is currently looking at. */
export interface PolicySummary {
  countsByStatus: Record<string, number>;
  premiumByLineOfBusiness: Record<string, number>;
  expiringSoonCount: number;
  flaggedCount: number;
  totalCount: number;
  countsByRegion: Record<string, number>;
}

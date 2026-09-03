export interface PolicySummary {
  countsByStatus: Record<string, number>;
  premiumByLineOfBusiness: Record<string, number>;
  expiringSoonCount: number;
}

/** Mirrors the AI contracts served under /api/v1/ai. */

import { PolicyFilter } from './policy-filter.model';

/** The filter fields the backend accepts as AI scope — paging and sort are
 *  meaningless to a question about the portfolio, so they are excluded. */
export interface AiScope {
  status?: string | null;
  lineOfBusiness?: string | null;
  region?: string | null;
  effectiveDateFrom?: string | null;
  effectiveDateTo?: string | null;
  search?: string | null;
  flagged?: boolean | null;
}

/** Provenance shown next to every AI answer: which model produced it, how long
 *  it took, and whether it came from the server's in-memory cache. */
export interface AiUsage {
  provider: string;
  model: string;
  latencyMs: number;
  cached: boolean;
}

export interface PromptResponse {
  id: string;
  prompt: string;
  answer: string;
  /** Human-readable description of the filter the answer was grounded in. */
  contextSummary: string;
  usage: AiUsage;
  createdAt: string;
}

export interface RiskAssessment {
  policyId: string;
  policyNumber: string;
  riskScore: number;
  riskBand: 'Low' | 'Medium' | 'High';
  factors: string[];
  recommendation: string;
  /** True when the model judges the policy worth flagging and it is not already
   *  flagged — surfaced as a one-click action in the detail drawer. */
  suggestFlag: boolean;
  summary: string;
  usage: AiUsage;
  createdAt: string;
}

export interface PortfolioBrief {
  brief: string;
  contextSummary: string;
  usage: AiUsage;
  createdAt: string;
}

export interface AiHealth {
  provider: string;
  model: string;
  liveInference: boolean;
  detail: string;
}

/** One event from POST /ai/prompt/stream. */
export type AiStreamEvent =
  | { type: 'token'; value: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** Strips paging/sort so the AI request carries only what narrows the set. */
export function toAiScope(filter: PolicyFilter): AiScope {
  return {
    status: filter.status,
    lineOfBusiness: filter.lineOfBusiness,
    region: filter.region,
    effectiveDateFrom: filter.effectiveDateFrom,
    effectiveDateTo: filter.effectiveDateTo,
    search: filter.search,
    flagged: filter.flagged,
  };
}

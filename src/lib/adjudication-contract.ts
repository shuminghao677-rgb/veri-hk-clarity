import type { ReportVerdict, SourceFreshness } from "./report-contract";

export type AdjudicationFactValue =
  | string
  | number
  | boolean
  | null
  | AdjudicationFactValue[]
  | { [key: string]: AdjudicationFactValue };

export type AdjudicationEvidenceInput = {
  evidence_id: string;
  source: string;
  source_type: string;
  title: string;
  content: string;
  published_at?: string;
  updated_at?: string;
  retrieved_at: string;
  freshness: SourceFreshness | "unknown";
  structured_facts?: Record<string, AdjudicationFactValue>;
};

export type AdjudicationInput = {
  claim: {
    id: string;
    text: string;
    category: string;
  };
  evidence: AdjudicationEvidenceInput[];
};

export type AdjudicationOutput = {
  claim_id: string;
  verdict: ReportVerdict;
  confidence: number;
  evidence_ids_used: string[];
  supported_elements: string[];
  contradicted_elements: string[];
  missing_elements: string[];
  explanation: string;
  recommendation: string;
};

export type ValidatedAdjudication =
  | { ok: true; output: AdjudicationOutput }
  | { ok: false; reason: string };

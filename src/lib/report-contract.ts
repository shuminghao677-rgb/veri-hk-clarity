export type AnalysisType = "preliminary_ai_analysis";
export type EvidenceCoverage = "none" | "low" | "medium" | "high";
export type ReportVerdict = "supported" | "refuted" | "insufficient_evidence";

export type OfficialSourceKey = "hko" | "td" | "edb" | "govnews";
export type SourceFreshness = "fresh" | "stale" | "unavailable";

export interface PhaseOneEvidence {
  id: string;
  source_key: OfficialSourceKey;
  source_name: string;
  source_authority?: "official";
  source_type: "hko_warning" | "rss_item" | "live_page" | "official_api";
  category?: string;
  relevance_score?: number;
  title: string;
  excerpt?: string;
  summary: string;
  url: string;
  published_at: string | null;
  updated_at: string | null;
  retrieved_at: string;
  freshness: SourceFreshness;
}

export interface PhaseOneClaim {
  id: string;
  text: string;
  verdict: ReportVerdict;
  confidence: number;
  explanation: string;
  recommendation: string;
  evidence: PhaseOneEvidence[];
}

export interface PhaseOneReport {
  report_id: string;
  analysis_type: AnalysisType;
  input_content: string;
  checked_at: string;
  overall_confidence: number;
  evidence_coverage: EvidenceCoverage;
  source_freshness?: Array<{
    source_key: OfficialSourceKey;
    source_name: string;
    freshness: SourceFreshness;
    retrieved_at: string;
    updated_at: string | null;
    message: string;
  }>;
  retrieval_counts?: {
    official_sources_queried: number;
    feed_items_fetched: number;
    relevant_evidence_attached: number;
  };
  claims: PhaseOneClaim[];
}

export interface AnalyzeTextInput {
  text: string;
}

export const PENDING_INPUT_KEY = "verihk:pending-input";
export const LATEST_REPORT_KEY = "verihk:latest-report";
export const MAX_ANALYSIS_INPUT_CHARS = 8000;

export function isPhaseOneReport(value: unknown): value is PhaseOneReport {
  if (!isRecord(value)) return false;
  if (value.analysis_type !== "preliminary_ai_analysis") return false;
  if (typeof value.report_id !== "string" || value.report_id.trim() === "") return false;
  if (typeof value.input_content !== "string") return false;
  if (typeof value.checked_at !== "string" || Number.isNaN(Date.parse(value.checked_at))) {
    return false;
  }
  if (!isConfidence(value.overall_confidence)) return false;
  if (!["none", "low", "medium", "high"].includes(String(value.evidence_coverage))) return false;
  if (!Array.isArray(value.claims) || value.claims.length < 1 || value.claims.length > 3) {
    return false;
  }

  return value.claims.every(isPhaseOneClaim);
}

function isPhaseOneClaim(value: unknown): value is PhaseOneClaim {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || value.id.trim() === "") return false;
  if (typeof value.text !== "string" || value.text.trim() === "") return false;
  if (!["supported", "refuted", "insufficient_evidence"].includes(String(value.verdict))) {
    return false;
  }
  if (!isConfidence(value.confidence)) return false;
  if (typeof value.explanation !== "string" || value.explanation.trim() === "") return false;
  if (typeof value.recommendation !== "string" || value.recommendation.trim() === "") {
    return false;
  }
  return Array.isArray(value.evidence) && value.evidence.every(isPhaseOneEvidence);
}

function isPhaseOneEvidence(value: unknown): value is PhaseOneEvidence {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || value.id.trim() === "") return false;
  if (!["hko", "td", "edb", "govnews"].includes(String(value.source_key))) return false;
  if (typeof value.source_name !== "string" || value.source_name.trim() === "") return false;
  if (
    !["hko_warning", "rss_item", "live_page", "official_api"].includes(String(value.source_type))
  ) {
    return false;
  }
  if (
    value.relevance_score !== undefined &&
    (typeof value.relevance_score !== "number" ||
      !Number.isFinite(value.relevance_score) ||
      value.relevance_score < 0)
  ) {
    return false;
  }
  if (typeof value.title !== "string") return false;
  if (typeof value.summary !== "string") return false;
  if (typeof value.url !== "string") return false;
  if (value.published_at !== null && typeof value.published_at !== "string") return false;
  if (value.updated_at !== null && typeof value.updated_at !== "string") return false;
  if (typeof value.retrieved_at !== "string" || Number.isNaN(Date.parse(value.retrieved_at))) {
    return false;
  }
  return ["fresh", "stale", "unavailable"].includes(String(value.freshness));
}

function isConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

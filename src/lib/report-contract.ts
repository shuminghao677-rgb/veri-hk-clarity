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
  source_type:
    | "hko_warning"
    | "rss_item"
    | "live_page"
    | "official_api"
    | "government_rss"
    | "government_webpage";
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
  traffic_metadata?: TrafficEvidenceMetadata;
}

export interface TrafficEvidenceMetadata {
  road_name?: string;
  nearby_landmark?: string;
  district?: string;
  direction?: string;
  event_type?: string;
  scope?: string;
  current_status?: string;
  transport_mode?: "MTR" | "bus" | "minibus" | "ferry" | "tram" | "unknown";
  route_or_line?: string;
  station_or_stop?: string;
  service_status?:
    | "disrupted"
    | "suspended"
    | "delayed"
    | "adjusted"
    | "cancelled"
    | "resumed"
    | "resuming"
    | "normal"
    | "unknown";
  cause?: string;
  latitude?: number;
  longitude?: number;
  coordinate_source?: "Official TD coordinates";
  map_location_key?: string;
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
    unique_relevant_evidence_records?: number;
    claim_evidence_links?: number;
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
    ![
      "hko_warning",
      "rss_item",
      "live_page",
      "official_api",
      "government_rss",
      "government_webpage",
    ].includes(String(value.source_type))
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
  if (value.traffic_metadata !== undefined && !isTrafficEvidenceMetadata(value.traffic_metadata)) {
    return false;
  }
  if (value.published_at !== null && typeof value.published_at !== "string") return false;
  if (value.updated_at !== null && typeof value.updated_at !== "string") return false;
  if (typeof value.retrieved_at !== "string" || Number.isNaN(Date.parse(value.retrieved_at))) {
    return false;
  }
  return ["fresh", "stale", "unavailable"].includes(String(value.freshness));
}

function isTrafficEvidenceMetadata(value: unknown): value is TrafficEvidenceMetadata {
  if (!isRecord(value)) return false;
  const keys: Array<keyof TrafficEvidenceMetadata> = [
    "road_name",
    "nearby_landmark",
    "district",
    "direction",
    "event_type",
    "scope",
    "current_status",
    "transport_mode",
    "route_or_line",
    "station_or_stop",
    "service_status",
    "cause",
    "coordinate_source",
    "map_location_key",
  ];
  const stringsValid = keys.every((key) => {
    if (key === "coordinate_source") {
      return value[key] === undefined || value[key] === "Official TD coordinates";
    }
    if (key === "transport_mode") {
      return (
        value[key] === undefined ||
        ["MTR", "bus", "minibus", "ferry", "tram", "unknown"].includes(String(value[key]))
      );
    }
    if (key === "service_status") {
      return (
        value[key] === undefined ||
        [
          "disrupted",
          "suspended",
          "delayed",
          "adjusted",
          "cancelled",
          "resumed",
          "resuming",
          "normal",
          "unknown",
        ].includes(String(value[key]))
      );
    }
    return value[key] === undefined || typeof value[key] === "string";
  });
  const latitudeValid =
    value.latitude === undefined ||
    (typeof value.latitude === "number" &&
      Number.isFinite(value.latitude) &&
      value.latitude >= -90 &&
      value.latitude <= 90);
  const longitudeValid =
    value.longitude === undefined ||
    (typeof value.longitude === "number" &&
      Number.isFinite(value.longitude) &&
      value.longitude >= -180 &&
      value.longitude <= 180);
  const notNullIsland = !(value.latitude === 0 && value.longitude === 0);
  return stringsValid && latitudeValid && longitudeValid && notNullIsland;
}

function isConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

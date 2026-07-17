import { isPhaseOneReport, type PhaseOneReport } from "./report-contract";

export const REPORT_HISTORY_KEY = "verihk:report-history";
const MAX_HISTORY_ITEMS = 50;

export interface ReportHistoryItem {
  report_id: string;
  title: string;
  checked_at: string;
  stored_at: string;
  claims_count: number;
  supported_count: number;
  refuted_count: number;
  insufficient_count: number;
  evidence_count: number;
  report: PhaseOneReport;
}

type HistoryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function addReportToHistory(
  storage: HistoryStorage,
  report: PhaseOneReport,
): ReportHistoryItem[] {
  const item = toHistoryItem(report);
  const existing = getReportHistory(storage).filter(
    (historyItem) => historyItem.report_id !== report.report_id,
  );
  const next = [item, ...existing].slice(0, MAX_HISTORY_ITEMS);
  storage.setItem(REPORT_HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function getReportHistory(storage: Pick<Storage, "getItem">): ReportHistoryItem[] {
  const raw = storage.getItem(REPORT_HISTORY_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReportHistoryItem);
  } catch {
    return [];
  }
}

export function removeReportFromHistory(
  storage: HistoryStorage,
  reportId: string,
): ReportHistoryItem[] {
  const next = getReportHistory(storage).filter((item) => item.report_id !== reportId);
  if (next.length === 0) {
    storage.removeItem(REPORT_HISTORY_KEY);
  } else {
    storage.setItem(REPORT_HISTORY_KEY, JSON.stringify(next));
  }
  return next;
}

export function clearReportHistory(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(REPORT_HISTORY_KEY);
}

function toHistoryItem(report: PhaseOneReport): ReportHistoryItem {
  const supported = report.claims.filter((claim) => claim.verdict === "supported").length;
  const refuted = report.claims.filter((claim) => claim.verdict === "refuted").length;
  const insufficient = report.claims.filter(
    (claim) => claim.verdict === "insufficient_evidence",
  ).length;
  const evidenceCount = new Set(
    report.claims.flatMap((claim) => claim.evidence.map((evidence) => evidence.id)),
  ).size;

  return {
    report_id: report.report_id,
    title: buildHistoryTitle(report),
    checked_at: report.checked_at,
    stored_at: new Date().toISOString(),
    claims_count: report.claims.length,
    supported_count: supported,
    refuted_count: refuted,
    insufficient_count: insufficient,
    evidence_count: evidenceCount,
    report,
  };
}

function buildHistoryTitle(report: PhaseOneReport): string {
  const firstClaim = report.claims[0]?.text.trim();
  if (firstClaim) {
    return firstClaim.length > 92 ? `${firstClaim.slice(0, 89)}...` : firstClaim;
  }

  const input = report.input_content.trim().replace(/\s+/g, " ");
  return input.length > 92 ? `${input.slice(0, 89)}...` : input || "Untitled report";
}

function isReportHistoryItem(value: unknown): value is ReportHistoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ReportHistoryItem>;
  return (
    typeof item.report_id === "string" &&
    typeof item.title === "string" &&
    typeof item.checked_at === "string" &&
    typeof item.stored_at === "string" &&
    typeof item.claims_count === "number" &&
    typeof item.supported_count === "number" &&
    typeof item.refuted_count === "number" &&
    typeof item.insufficient_count === "number" &&
    typeof item.evidence_count === "number" &&
    isPhaseOneReport(item.report)
  );
}

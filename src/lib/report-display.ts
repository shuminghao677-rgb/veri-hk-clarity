import type { PhaseOneClaim, PhaseOneEvidence, PhaseOneReport } from "./report-contract";

export function getGeneratedReportLabel(report: PhaseOneReport): string {
  const hasEvidenceBackedVerdict = report.claims.some(
    (claim) =>
      (claim.verdict === "supported" || claim.verdict === "refuted") &&
      claim.evidence.some(
        (item) => item.source_authority === "official" || item.source_key === "hko",
      ),
  );
  if (hasEvidenceBackedVerdict && report.evidence_coverage === "high") {
    return "Live Official Verification Report";
  }
  if ((report.retrieval_counts?.official_sources_queried ?? 0) > 0) {
    return "Preliminary Analysis with Live Source Check";
  }
  return "Preliminary AI Analysis";
}

export function getHeaderReportLabels(report: PhaseOneReport | null): string[] {
  return [report ? getGeneratedReportLabel(report) : "Verification report"];
}

export function getEvidenceItemText(count: number): string {
  return `Retrieved ${count} relevant official evidence ${count === 1 ? "item" : "items"}.`;
}

export function getSourceConsistencyText(claim: PhaseOneClaim): string {
  const hasDeterministicHkoWarning =
    (claim.verdict === "supported" || claim.verdict === "refuted") &&
    claim.evidence.some((item) => item.source_key === "hko" && item.category === "weather_warning");
  if (hasDeterministicHkoWarning) {
    return "HKO warning summary is the authoritative current-status source for active weather warnings.";
  }

  const hasSpecificForecastVerdict =
    (claim.verdict === "supported" || claim.verdict === "refuted") &&
    claim.evidence.some((item) => item.source_key === "hko" && item.id.startsWith("hko-fnd"));
  if (hasSpecificForecastVerdict) {
    return "The HKO forecast records directly address the claimed date and measurable weather value.";
  }

  const explanationText = `${claim.text} ${claim.explanation}`.toLowerCase();
  if (
    claim.verdict === "insufficient_evidence" &&
    /future weather|forecast|tomorrow|later|next/.test(explanationText)
  ) {
    return "HKO forecasts were checked, but the claim is too broad to map to a specific warning or measurable condition.";
  }

  return "Selected live official sources were checked for directly relevant evidence.";
}

export function getOfficialUpdateLabel(
  evidence: PhaseOneEvidence,
  formatTime: (value: string) => string,
): string {
  return evidence.updated_at
    ? `Official update: ${formatTime(evidence.updated_at)}`
    : "Official update: Not stated";
}

export function getRetrievedByVeriHkLabel(
  evidence: PhaseOneEvidence,
  formatTime: (value: string) => string,
): string {
  return `Retrieved by VeriHK: ${formatTime(evidence.retrieved_at)}`;
}

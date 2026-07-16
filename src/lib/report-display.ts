import type {
  PhaseOneClaim,
  PhaseOneEvidence,
  PhaseOneReport,
  ReportVerdict,
  TrafficEvidenceMetadata,
} from "./report-contract";

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

export type ClaimDisplayExplanation = {
  officialEvidence: string;
  sourceConsistency: string;
  verdictExplanation: string;
  recommendation: string;
};

export type TransportVerdictExplanationInput = {
  claim: PhaseOneClaim;
  verdict: ReportVerdict;
  evidence?: PhaseOneEvidence;
  trafficMetadata?: TrafficEvidenceMetadata;
};

export function buildClaimDisplayExplanation(claim: PhaseOneClaim): ClaimDisplayExplanation {
  return {
    officialEvidence:
      claim.evidence.length > 0
        ? getEvidenceItemText(claim.evidence.length)
        : "Selected live official sources were checked, but no directly relevant official evidence was found for this claim.",
    sourceConsistency: getSourceConsistencyText(claim),
    verdictExplanation: buildDisplayVerdictExplanation(claim),
    recommendation: buildDisplayRecommendation(claim),
  };
}

export function getSourceConsistencyText(claim: PhaseOneClaim): string {
  const transportEvidence = claim.evidence.find((item) => item.source_key === "td");
  if (transportEvidence) {
    const metadata = transportEvidence.traffic_metadata;
    if (metadata?.transport_mode || metadata?.route_or_line || metadata?.station_or_stop) {
      return "The matched Transport Department notice directly addresses the specified public transport service and current service status.";
    }
    if (
      claim.verdict === "insufficient_evidence" &&
      transportEvidence.category &&
      /closure/.test(String(transportEvidence.category))
    ) {
      return "The official notice concerns the same road and location, but does not establish the full scope stated in the claim.";
    }
    if (metadata?.road_name || metadata?.nearby_landmark || metadata?.current_status) {
      return "The matched Transport Department notice directly addresses the specified road, location and current traffic status.";
    }
  }

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

export function buildDisplayVerdictExplanation(claim: PhaseOneClaim): string {
  const transportEvidence = claim.evidence.find((item) => item.source_key === "td");
  if (transportEvidence) {
    return buildTransportVerdictExplanation({
      claim,
      verdict: claim.verdict,
      evidence: transportEvidence,
      trafficMetadata: transportEvidence.traffic_metadata,
    });
  }

  return claim.explanation;
}

export function buildDisplayRecommendation(claim: PhaseOneClaim): string {
  const transportEvidence = claim.evidence.find((item) => item.source_key === "td");
  if (transportEvidence) {
    return buildTransportRecommendation(claim.verdict, transportEvidence.traffic_metadata);
  }

  return claim.recommendation;
}

export function buildTransportVerdictExplanation({
  claim,
  verdict,
  evidence,
  trafficMetadata,
}: TransportVerdictExplanationInput): string {
  const metadata = trafficMetadata ?? evidence?.traffic_metadata;
  const status = metadata?.current_status;
  const eventType = metadata?.event_type ?? evidence?.category;
  const serviceStatus = metadata?.service_status;
  const location = buildTransportLocationPhrase(metadata);
  const scope = buildTrafficScopePhrase(metadata?.scope);
  const isClosureClaim = /closed|closure|blocked|shut/i.test(claim.text);
  const isReopeningClaim = /reopen|re-open|resum/i.test(claim.text);
  const isNormalServiceClaim = /operating normally|normal service|services are normal|running normally/i.test(
    claim.text,
  );
  const isCauseClaim = /caused by|cause is|due to|because of|technical fault/i.test(claim.text);

  if (eventType === "public_transport_disruption" || metadata?.transport_mode) {
    const serviceLocation = buildPublicTransportLocationPhrase(metadata);
    const cause = metadata?.cause ? ` due to a ${metadata.cause.toLowerCase()}` : "";
    const activeDisruption =
      serviceStatus === "disrupted" ||
      serviceStatus === "suspended" ||
      serviceStatus === "delayed" ||
      serviceStatus === "adjusted" ||
      serviceStatus === "cancelled";

    if (verdict === "insufficient_evidence" && isCauseClaim && !metadata?.cause) {
      return "The current official update does not state that the incident was caused by a train technical fault.";
    }
    if (activeDisruption && verdict === "supported" && isCauseClaim && metadata?.cause) {
      return `The same official update states that the disruption is caused by a ${metadata.cause.toLowerCase()}.`;
    }
    if (activeDisruption && verdict === "supported") {
      return `The latest Transport Department update reports a service disruption ${serviceLocation}${cause}.`;
    }
    if (activeDisruption && verdict === "refuted" && isNormalServiceClaim) {
      return `The latest Transport Department update reports an active disruption ${serviceLocation}, contradicting the claim that services are operating normally.`;
    }
    if (serviceStatus === "resuming" && verdict === "refuted") {
      const stationNote = metadata?.station_or_stop
        ? ""
        : " The official record does not specify the station named in the claim.";
      return `The latest Transport Department update states that the incident is now over and service is returning to normal, contradicting the claim that an active disruption is still ongoing.${stationNote}`;
    }
    if (serviceStatus === "resuming" && verdict === "supported") {
      return `The latest Transport Department update states that the incident ${serviceLocation} is now over and service is returning to normal.`;
    }
    if ((serviceStatus === "normal" || serviceStatus === "resumed") && verdict === "supported") {
      return `The latest Transport Department update reports that service ${serviceLocation} is operating normally.`;
    }
    if ((serviceStatus === "normal" || serviceStatus === "resumed") && verdict === "refuted") {
      return `The latest Transport Department update reports that service ${serviceLocation} has resumed, contradicting the disruption claim.`;
    }
    return claim.explanation;
  }

  if (status === "reopened" || eventType === "road_reopened") {
    if (verdict === "refuted" && isClosureClaim) {
      return `The latest Transport Department update states that ${scope} ${location} have reopened to all traffic, contradicting the claim that they are currently closed.`;
    }
    if (verdict === "supported" || isReopeningClaim) {
      return `The latest Transport Department update states that ${scope} ${location} have reopened to all traffic, supporting the claim.`;
    }
  }

  if (status === "closed" || eventType === "road_closure" || eventType === "lane_closure") {
    if (verdict === "supported" && isClosureClaim) {
      return `The latest Transport Department update reports that ${scope} ${location} remain closed to traffic.`;
    }
    if (verdict === "refuted" && isReopeningClaim) {
      return `The latest Transport Department update still reports an active closure ${location}, contradicting the claim that the road has reopened.`;
    }
  }

  if (eventType === "traffic_congestion") {
    return `The latest Transport Department update reports busy or congested traffic ${location}.`;
  }

  if (verdict === "insufficient_evidence" && !evidence) {
    return "The selected live Transport Department sources were checked, but no directly matching current notice was found. Absence from the feed does not prove the road is open.";
  }

  return claim.explanation;
}

export function buildTransportRecommendation(
  verdict: ReportVerdict,
  metadata?: TrafficEvidenceMetadata,
): string {
  if (verdict === "insufficient_evidence") {
    return "Check the latest Transport Department Special Traffic News or Traffic Notices before acting on this claim.";
  }
  if (metadata?.current_status === "reopened" || metadata?.event_type === "road_reopened") {
    if (verdict === "supported") {
      return "Traffic has resumed at the specified location, but check the latest Transport Department update before travelling.";
    }
    if (verdict === "refuted") {
      return "Treat the closure claim as refuted for the current Transport Department update. Check again if conditions are changing.";
    }
  }
  if (metadata?.transport_mode || metadata?.route_or_line || metadata?.station_or_stop) {
    if (metadata.service_status === "normal" || metadata.service_status === "resumed") {
      return "Treat the public transport service status as supported by the latest Transport Department update, and check the operator before travelling.";
    }
    if (verdict === "refuted") {
      return "Do not rely on the normal-service claim until Transport Department reports that service has resumed.";
    }
    return "Check the latest Transport Department and operator updates before travelling.";
  }
  if (metadata?.current_status === "closed" || /closure/.test(metadata?.event_type ?? "")) {
    if (verdict === "supported") {
      return "Follow the latest Transport Department notice and allow extra travel time.";
    }
    if (verdict === "refuted") {
      return "Treat the reopening claim as refuted until Transport Department reports that the road has reopened.";
    }
  }
  return "Check the latest Transport Department update before travelling.";
}

export function buildTrafficScopePhrase(scope: string | undefined): string {
  if (scope === "part_of_lanes") return "part of the lanes";
  if (scope === "one_lane") return "one lane";
  if (scope === "all_lanes") return "all lanes";
  if (scope === "entire_road" || scope === "complete_road") return "the entire road";
  if (scope === "partial") return "part of the road";
  return "the affected road section";
}

export function buildTransportLocationPhrase(metadata?: TrafficEvidenceMetadata): string {
  const road = metadata?.road_name?.trim();
  const landmark = metadata?.nearby_landmark?.trim();
  const district = metadata?.district?.trim();

  if (road && landmark) return `on ${road} near ${landmark}`;
  if (road && district) return `on ${road} in ${district}`;
  if (road) return `on ${road}`;
  return "at the affected road section";
}

export function buildPublicTransportLocationPhrase(metadata?: TrafficEvidenceMetadata): string {
  const line = metadata?.route_or_line?.trim();
  const station = metadata?.station_or_stop?.trim();
  const mode = metadata?.transport_mode?.trim();

  if (line && station) return `on the ${line} near ${station}`;
  if (line) return `on the ${line}`;
  if (station) return `near ${station}`;
  if (mode && mode !== "unknown") return `on the affected ${mode} service`;
  return "on the affected public transport service";
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

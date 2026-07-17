import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildLiveSourceSummary,
  buildTrafficScopePhrase,
  buildTransportVerdictExplanation,
  getEvidenceItemText,
  getLiveSourceMatchingText,
  getRetrievedVsMatchedSentence,
} from "./report-display";
import type {
  PhaseOneClaim,
  PhaseOneEvidence,
  PhaseOneReport,
  ReportVerdict,
  TrafficEvidenceMetadata,
} from "./report-contract";

export function runReportDisplayTests(): void {
  testHongChongReopeningRefutesClosure();
  testPrincessMargaretReopeningUsesOwnLocation();
  testMissingNearbyLandmarkUsesRoadOnly();
  testMissingRoadUsesAffectedRoadFallback();
  testScopeWording();
  testReopeningSupportsReopeningClaim();
  testReopeningRefutesClosureClaim();
  testActiveClosureRefutesReopeningClaim();
  testPublicTransportDisruptionExplanation();
  testPublicTransportCauseExplanation();
  testPublicTransportResumingRefutesActiveDisruptionExplanation();
  testPublicTransportMissingCauseExplanation();
  testPublicTransportNormalServiceRefutedExplanation();
  testInsufficientEvidenceDoesNotInventLocation();
  testProductionDisplayHelpersHaveNoCompetitionRoadLiterals();
  testEvidenceCountGrammar();
  testTrafficLiveSourceSummarySeparatesRetrievedAndMatched();
  testTrafficLiveSourceSummaryMatchedWording();
  testWeatherLiveSourceSummary();
  testAutoDetectLiveSourceSummaryUsesRoutedSource();
  testReportWithoutDiagnosticsUsesSafeFallback();
  testLiveSourceSummaryDoesNotEmitUndefinedFields();
  testResultsPageDeveloperDetailsVisibilityCondition();
  testInsightsPieTooltipRemoved();
}

describe("report display", () => {
  it("formats evidence and transport explanations", () => {
    runReportDisplayTests();
  });
});

function testHongChongReopeningRefutesClosure(): void {
  const explanation = buildTransportVerdictExplanation({
    claim: claim("Part of the lanes of Hong Chong Road are currently closed.", "refuted"),
    verdict: "refuted",
    evidence: evidence(metadata({
      road_name: "Hong Chong Road",
      nearby_landmark: "Hong Kong Polytechnic University",
      scope: "part_of_lanes",
      current_status: "reopened",
      event_type: "road_reopened",
    })),
  });

  assertIncludes(explanation, "Hong Chong Road", "uses Hong Chong Road");
  assertIncludes(explanation, "Hong Kong Polytechnic University", "uses actual landmark");
  assertNotIncludes(explanation, "Pui Ching Road", "does not leak old landmark");
}

function testPrincessMargaretReopeningUsesOwnLocation(): void {
  const explanation = buildTransportVerdictExplanation({
    claim: claim("Part of the lanes of Princess Margaret Road are currently closed.", "refuted"),
    verdict: "refuted",
    evidence: evidence(metadata({
      road_name: "Princess Margaret Road",
      nearby_landmark: "Pui Ching Road",
      scope: "part_of_lanes",
      current_status: "reopened",
      event_type: "road_reopened",
    })),
  });

  assertIncludes(explanation, "Princess Margaret Road", "uses road");
  assertIncludes(explanation, "Pui Ching Road", "uses landmark");
}

function testMissingNearbyLandmarkUsesRoadOnly(): void {
  const explanation = buildTransportVerdictExplanation({
    claim: claim("Hong Chong Road has reopened.", "supported"),
    verdict: "supported",
    evidence: evidence(metadata({
      road_name: "Hong Chong Road",
      scope: "part_of_lanes",
      current_status: "reopened",
      event_type: "road_reopened",
    })),
  });

  assertIncludes(explanation, "on Hong Chong Road", "uses road-only fallback");
}

function testMissingRoadUsesAffectedRoadFallback(): void {
  const explanation = buildTransportVerdictExplanation({
    claim: claim("The road has reopened.", "supported"),
    verdict: "supported",
    evidence: evidence(metadata({
      scope: "unknown",
      current_status: "reopened",
      event_type: "road_reopened",
    })),
  });

  assertIncludes(explanation, "at the affected road section", "uses generic fallback");
}

function testScopeWording(): void {
  assertEqual(buildTrafficScopePhrase("part_of_lanes"), "part of the lanes", "part scope");
  assertEqual(buildTrafficScopePhrase("all_lanes"), "all lanes", "all lanes scope");
  assertEqual(buildTrafficScopePhrase("unknown"), "the affected road section", "unknown scope");
}

function testReopeningSupportsReopeningClaim(): void {
  const explanation = buildTransportVerdictExplanation({
    claim: claim("Hong Chong Road has reopened.", "supported"),
    verdict: "supported",
    evidence: evidence(metadata({
      road_name: "Hong Chong Road",
      nearby_landmark: "Hong Kong Polytechnic University",
      scope: "part_of_lanes",
      current_status: "reopened",
      event_type: "road_reopened",
    })),
  });

  assertIncludes(explanation, "supporting the claim", "supporting wording");
}

function testReopeningRefutesClosureClaim(): void {
  const explanation = buildTransportVerdictExplanation({
    claim: claim("Hong Chong Road is currently closed.", "refuted"),
    verdict: "refuted",
    evidence: evidence(metadata({
      road_name: "Hong Chong Road",
      nearby_landmark: "Hong Kong Polytechnic University",
      scope: "part_of_lanes",
      current_status: "reopened",
      event_type: "road_reopened",
    })),
  });

  assertIncludes(explanation, "contradicting the claim", "contradiction wording");
}

function testActiveClosureRefutesReopeningClaim(): void {
  const explanation = buildTransportVerdictExplanation({
    claim: claim("Hong Chong Road has reopened.", "refuted"),
    verdict: "refuted",
    evidence: evidence(metadata({
      road_name: "Hong Chong Road",
      nearby_landmark: "Hong Kong Polytechnic University",
      current_status: "closed",
      event_type: "lane_closure",
    })),
  });

  assertIncludes(explanation, "still reports an active closure", "active closure wording");
}

function testPublicTransportDisruptionExplanation(): void {
  const explanation = buildTransportVerdictExplanation({
    claim: claim(
      "The Tseung Kwan O Line is experiencing a service disruption near Yau Tong Station.",
      "supported",
    ),
    verdict: "supported",
    evidence: evidence(metadata({
      transport_mode: "MTR",
      route_or_line: "Tseung Kwan O Line",
      station_or_stop: "Yau Tong Station",
      event_type: "public_transport_disruption",
      service_status: "disrupted",
      cause: "Train Technical Fault",
    })),
  });

  assertIncludes(explanation, "Tseung Kwan O Line", "uses railway line");
  assertIncludes(explanation, "Yau Tong Station", "uses station");
  assertIncludes(explanation, "train technical fault", "uses cause");
  assertNotIncludes(explanation, "road", "does not present route as a road");
}

function testPublicTransportCauseExplanation(): void {
  const explanation = buildTransportVerdictExplanation({
    claim: claim(
      "The service disruption on the Tseung Kwan O Line is caused by a train technical fault.",
      "supported",
    ),
    verdict: "supported",
    evidence: evidence(metadata({
      transport_mode: "MTR",
      route_or_line: "Tseung Kwan O Line",
      station_or_stop: "Yau Tong Station",
      event_type: "public_transport_disruption",
      service_status: "disrupted",
      cause: "Train Technical Fault",
    })),
  });

  assertEqual(
    explanation,
    "The same official update states that the disruption is caused by a train technical fault.",
    "cause claim uses cause-specific wording",
  );
}

function testPublicTransportResumingRefutesActiveDisruptionExplanation(): void {
  const explanation = buildTransportVerdictExplanation({
    claim: claim(
      "The Tseung Kwan O Line is experiencing a service disruption near Yau Tong Station.",
      "refuted",
    ),
    verdict: "refuted",
    evidence: evidence(metadata({
      transport_mode: "MTR",
      route_or_line: "Tseung Kwan O Line",
      event_type: "public_transport_resumed",
      service_status: "resuming",
    })),
  });

  assertIncludes(explanation, "incident is now over", "uses resuming wording");
  assertIncludes(explanation, "active disruption is still ongoing", "contradicts active disruption");
  assertIncludes(explanation, "does not specify the station", "acknowledges absent station");
  assertNotIncludes(explanation, "reports a service disruption", "does not use active disruption wording");
}

function testPublicTransportMissingCauseExplanation(): void {
  const explanation = buildTransportVerdictExplanation({
    claim: claim(
      "The service disruption on the Tseung Kwan O Line is caused by a train technical fault.",
      "insufficient_evidence",
    ),
    verdict: "insufficient_evidence",
    evidence: evidence(metadata({
      transport_mode: "MTR",
      route_or_line: "Tseung Kwan O Line",
      event_type: "public_transport_resumed",
      service_status: "resuming",
    })),
  });

  assertEqual(
    explanation,
    "The current official update does not state that the incident was caused by a train technical fault.",
    "missing cause uses insufficient wording",
  );
}

function testPublicTransportNormalServiceRefutedExplanation(): void {
  const explanation = buildTransportVerdictExplanation({
    claim: claim("The Tseung Kwan O Line is operating normally near Yau Tong Station.", "refuted"),
    verdict: "refuted",
    evidence: evidence(metadata({
      transport_mode: "MTR",
      route_or_line: "Tseung Kwan O Line",
      station_or_stop: "Yau Tong Station",
      event_type: "public_transport_disruption",
      service_status: "disrupted",
    })),
  });

  assertIncludes(explanation, "active disruption", "uses active disruption wording");
  assertIncludes(explanation, "operating normally", "contradicts normal-service wording");
}

function testInsufficientEvidenceDoesNotInventLocation(): void {
  const explanation = buildTransportVerdictExplanation({
    claim: claim("Hong Chong Road is currently closed.", "insufficient_evidence"),
    verdict: "insufficient_evidence",
  });

  assertNotIncludes(explanation, "Hong Chong Road", "generic insufficient wording has no location");
}

function testProductionDisplayHelpersHaveNoCompetitionRoadLiterals(): void {
  const source = readFileSync("src/lib/report-display.ts", "utf8");
  assertNotIncludes(source, "Pui Ching Road", "no old landmark literal");
  assertNotIncludes(source, "Princess Margaret Road", "no old road literal");
  assertNotIncludes(source, "Hong Chong Road", "no new road literal");
  assertNotIncludes(source, "Hong Kong Polytechnic University", "no new landmark literal");
}

function testEvidenceCountGrammar(): void {
  assertEqual(getEvidenceItemText(1), "Retrieved 1 relevant official evidence item.", "singular");
  assertEqual(getEvidenceItemText(2), "Retrieved 2 relevant official evidence items.", "plural");
}

function testTrafficLiveSourceSummarySeparatesRetrievedAndMatched(): void {
  const summary = buildLiveSourceSummary(reportWithDiagnostics({
    mode: "traffic",
    routedSource: "TD",
    endpointLabel: "TD Special Traffic News XML",
    recordsRetrieved: 1,
    relevantEvidence: 0,
    parsingStatus: "success",
    matchingStatus: "no_match",
    deterministicResult: "insufficient_evidence",
    adjudicatorCalled: false,
    freshness: "fresh",
    officialUpdatedAt: "2026-07-17T09:07:00.000Z",
  }));

  assertEqual(summary?.officialSource, "Transport Department", "traffic source label");
  assertEqual(summary?.recordsRetrieved, 1, "records retrieved");
  assertEqual(summary?.relevantRecordsMatched, 0, "relevant records matched");
  assertEqual(
    summary?.matchingResult,
    "No directly relevant current record was matched.",
    "neutral no-match wording",
  );
  assertEqual(
    getRetrievedVsMatchedSentence(1, 0),
    "1 official record was retrieved, but no directly relevant current record was matched to this claim.",
    "retrieved-vs-matched sentence",
  );
}

function testTrafficLiveSourceSummaryMatchedWording(): void {
  assertEqual(
    getLiveSourceMatchingText(
      {
        mode: "traffic",
        routedSource: "TD",
        endpointLabel: "TD Special Traffic News XML",
        recordsRetrieved: 1,
        relevantEvidence: 1,
        parsingStatus: "success",
        matchingStatus: "matched",
        deterministicResult: "supported",
        adjudicatorCalled: false,
      },
      1,
    ),
    "Relevant official evidence matched.",
    "matched wording",
  );
}

function testWeatherLiveSourceSummary(): void {
  const summary = buildLiveSourceSummary(reportWithDiagnostics({
    mode: "weather",
    routedSource: "HKO",
    endpointLabel: "HKO Current Warning Summary",
    recordsRetrieved: 1,
    relevantEvidence: 1,
    parsingStatus: "success",
    matchingStatus: "matched",
    deterministicResult: "supported",
    adjudicatorCalled: false,
    freshness: "fresh",
  }));

  assertEqual(summary?.mode, "Weather", "weather mode label");
  assertEqual(summary?.officialSource, "Hong Kong Observatory", "weather source label");
  assertEqual(summary?.endpoint, "HKO Current Warning Summary", "weather endpoint");
}

function testAutoDetectLiveSourceSummaryUsesRoutedSource(): void {
  const summary = buildLiveSourceSummary(reportWithDiagnostics({
    mode: "auto",
    routedSource: "TD",
    endpointLabel: "TD Special Traffic News XML",
    recordsRetrieved: 2,
    relevantEvidence: 1,
    parsingStatus: "success",
    matchingStatus: "matched",
    deterministicResult: "supported",
    adjudicatorCalled: false,
  }));

  assertEqual(summary?.mode, "Auto Detect", "auto mode label");
  assertEqual(summary?.officialSource, "Transport Department", "uses recorded routed source");
}

function testReportWithoutDiagnosticsUsesSafeFallback(): void {
  const summary = buildLiveSourceSummary({
    ...baseReport(),
    diagnostics: undefined,
    retrieval_counts: {
      official_sources_queried: 1,
      feed_items_fetched: 1,
      relevant_evidence_attached: 0,
    },
    source_freshness: [
      {
        source_key: "td",
        source_name: "Transport Department",
        freshness: "fresh",
        retrieved_at: "2026-07-17T09:00:00.000Z",
        updated_at: null,
        message: "Fetched latest Transport Department item.",
      },
    ],
  });

  assertEqual(summary?.officialSource, "Transport Department", "fallback source");
  assertEqual(summary?.recordsRetrieved, 1, "fallback records retrieved");
  assertEqual(summary?.relevantRecordsMatched, 0, "fallback matched records");
}

function testLiveSourceSummaryDoesNotEmitUndefinedFields(): void {
  const summary = buildLiveSourceSummary(reportWithDiagnostics({
    mode: "traffic",
    routedSource: "TD",
    endpointLabel: "TD Special Traffic News XML",
    recordsRetrieved: 1,
    relevantEvidence: 0,
    parsingStatus: "success",
    matchingStatus: "no_match",
    deterministicResult: "insufficient_evidence",
    adjudicatorCalled: false,
  }));

  const values = [
    summary?.mode,
    summary?.officialSource,
    summary?.endpoint,
    summary?.matchingResult,
    ...(summary?.developerFields.map((field) => field.value) ?? []),
  ];
  if (values.some((value) => value === undefined || value === "undefined")) {
    throw new Error("summary should not emit undefined values");
  }
}

function testResultsPageDeveloperDetailsVisibilityCondition(): void {
  const source = readFileSync("src/routes/_app.results.tsx", "utf8");
  assertIncludes(source, "VITE_SHOW_DEVELOPER_DETAILS", "has developer details env flag");
  assertIncludes(source, "import.meta.env.DEV", "has dev visibility condition");
}

function testInsightsPieTooltipRemoved(): void {
  const source = readFileSync("src/routes/_app.results.tsx", "utf8");
  const pieBlock = source.match(/<PieChart>[\s\S]*?<\/PieChart>/)?.[0] ?? "";
  assertNotIncludes(pieBlock, "RTooltip", "pie chart no longer renders duplicate tooltip count");
}

function reportWithDiagnostics(diagnostics: NonNullable<PhaseOneReport["diagnostics"]>): PhaseOneReport {
  return {
    ...baseReport(),
    diagnostics,
    retrieval_counts: {
      official_sources_queried: 1,
      feed_items_fetched: diagnostics.recordsRetrieved,
      relevant_evidence_attached: diagnostics.relevantEvidence,
      unique_relevant_evidence_records: diagnostics.relevantEvidence,
      claim_evidence_links: diagnostics.relevantEvidence,
    },
  };
}

function baseReport(): PhaseOneReport {
  return {
    report_id: "report-test",
    analysis_type: "preliminary_ai_analysis",
    input_content: "Traffic is busy on Nathan Road.",
    checked_at: "2026-07-17T09:00:00.000Z",
    overall_confidence: 0.5,
    evidence_coverage: "none",
    claims: [
      {
        id: "claim-1",
        text: "Traffic is busy on Nathan Road.",
        verdict: "insufficient_evidence",
        confidence: 0.5,
        explanation: "No directly relevant current record was matched.",
        recommendation: "Check official sources.",
        evidence: [],
      },
    ],
  };
}

function metadata(value: TrafficEvidenceMetadata): TrafficEvidenceMetadata {
  return value;
}

function evidence(trafficMetadata: TrafficEvidenceMetadata): PhaseOneEvidence {
  return {
    id: "td-test",
    source_key: "td",
    source_name: "Transport Department",
    source_authority: "official",
    source_type: "government_webpage",
    category: trafficMetadata.event_type,
    title: "Transport evidence",
    summary: "Transport evidence summary",
    url: "https://www.td.gov.hk/en/special_news/trafficnews.xml",
    published_at: null,
    updated_at: "2099-01-01T00:00:00.000Z",
    retrieved_at: "2099-01-01T00:00:00.000Z",
    freshness: "fresh",
    traffic_metadata: trafficMetadata,
  };
}

function claim(text: string, verdict: ReportVerdict): PhaseOneClaim {
  return {
    id: text.slice(0, 12),
    text,
    verdict,
    confidence: 0.8,
    explanation: "Original explanation.",
    recommendation: "Original recommendation.",
    evidence: [],
  };
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertIncludes(value: string, expected: string, message: string): void {
  if (!value.includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(value)} to include ${expected}`);
  }
}

function assertNotIncludes(value: string, unexpected: string, message: string): void {
  if (value.includes(unexpected)) {
    throw new Error(`${message}: expected ${JSON.stringify(value)} not to include ${unexpected}`);
  }
}

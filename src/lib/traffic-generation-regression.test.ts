import { describe, expect, it } from "vitest";
import type { PhaseOneClaim, PhaseOneEvidence, TrafficGenerationMetadata } from "./report-contract";
import {
  evaluateTrafficClaimWithSources,
  type TrafficSourceSnapshot,
} from "./traffic-sources";

describe("traffic generated-claim snapshot consistency", () => {
  it("source success with records retrieved never says source unavailable", () => {
    const result = evaluateTrafficClaimWithSources(
      claim("Traffic is busy on Nathan Road."),
      snapshot([trafficEvidence("td-other", "Queens Road Central")], "fresh", 1),
    );

    expect(result.verdict).toBe("insufficient_evidence");
    expect(result.explanation).toBe(
      "The Transport Department feed was retrieved successfully, but no directly relevant current record matched this claim.",
    );
    expect(result.explanation).not.toContain("unavailable");
  });

  it("stale and unavailable source states are represented separately", () => {
    const stale = evaluateTrafficClaimWithSources(
      claim("Traffic is busy on Nathan Road."),
      snapshot([trafficEvidence("td-stale", "Nathan Road")], "stale", 1),
    );
    const unavailable = evaluateTrafficClaimWithSources(
      claim("Traffic is busy on Nathan Road."),
      snapshot([], "unavailable", 0),
    );

    expect(stale.explanation).toBe("The latest retrieved Transport Department update may be outdated.");
    expect(unavailable.explanation).toBe("The Transport Department source could not be retrieved.");
  });

  it("generated record missing from next snapshot uses event-updated-or-removed explanation", () => {
    const result = evaluateTrafficClaimWithSources(
      claim("Traffic is busy on Nathan Road."),
      snapshot([trafficEvidence("td-new", "Queens Road Central")], "fresh", 1),
      generationMetadata("td-old"),
    );

    expect(result.verdict).toBe("insufficient_evidence");
    expect(result.explanation).toBe(
      "The official event used to create this example was not present in the latest Transport Department feed. The event may have been updated, resolved or removed between generation and verification.",
    );
  });

  it("manual claims do not require generation metadata", () => {
    const result = evaluateTrafficClaimWithSources(
      claim("Traffic is busy on Nathan Road."),
      snapshot([trafficEvidence("td-new", "Queens Road Central")], "fresh", 1),
    );

    expect(result.verdict).toBe("insufficient_evidence");
    expect(result.explanation).toBe(
      "The Transport Department feed was retrieved successfully, but no directly relevant current record matched this claim.",
    );
  });

  it("record ID traceability does not force a supported verdict", () => {
    const result = evaluateTrafficClaimWithSources(
      claim("Traffic is busy on Nathan Road."),
      snapshot([trafficEvidence("td-same", "Queens Road Central")], "fresh", 1),
      generationMetadata("td-same"),
    );

    expect(result.verdict).toBe("insufficient_evidence");
    expect(result.explanation).toBe(
      "The official event used to create this example is still present in the latest Transport Department feed, but it did not semantically match the full submitted claim.",
    );
  });
});

function claim(text: string): PhaseOneClaim {
  return {
    id: "claim-traffic",
    text,
    verdict: "insufficient_evidence",
    confidence: 0.5,
    explanation: "Original preliminary explanation.",
    recommendation: "Original recommendation.",
    evidence: [],
  };
}

function snapshot(
  evidence: PhaseOneEvidence[],
  freshness: "fresh" | "stale" | "unavailable",
  itemsFetched: number,
): TrafficSourceSnapshot {
  return {
    evidence,
    freshness: [
      {
        source_key: "td",
        source_name: "Transport Department Special Traffic News XML",
        freshness,
        retrieved_at: "2026-07-17T09:00:00.000Z",
        updated_at: freshness === "unavailable" ? null : "2026-07-17T07:00:00.000Z",
        message: "Mocked traffic snapshot.",
      },
    ],
    itemsFetched,
    sourceKeys: ["td"],
    endpointKeys: ["td:special_news_xml"],
  };
}

function trafficEvidence(id: string, roadName: string): PhaseOneEvidence {
  return {
    id,
    source_key: "td",
    source_name: "Transport Department",
    source_authority: "official",
    source_type: "government_webpage",
    category: "traffic_congestion",
    title: `Busy Traffic on ${roadName}`,
    summary: `Traffic is busy on ${roadName}.`,
    url: "https://www.td.gov.hk/en/special_news/trafficnews.xml",
    published_at: null,
    updated_at: "2026-07-17T08:50:00.000Z",
    retrieved_at: "2026-07-17T09:00:00.000Z",
    freshness: "fresh",
    traffic_metadata: {
      road_name: roadName,
      event_type: "traffic_congestion",
    },
  };
}

function generationMetadata(sourceRecordId: string): TrafficGenerationMetadata {
  return {
    sourceRecordId,
    sourceOfficialUpdatedAt: "2026-07-17T08:50:00.000Z",
    sourceCurrentStatus: "unknown",
    generatedClaimKind: "supported",
    generatedSemanticField: "event_type:traffic_congestion",
    generatedAt: "2026-07-17T09:00:00.000Z",
  };
}

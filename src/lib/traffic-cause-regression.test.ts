import { describe, expect, it } from "vitest";
import type { PhaseOneClaim } from "./report-contract";
import { adjudicateEvidenceRetrievalResult } from "./live-sources";
import {
  evaluateTrafficClaimWithSources,
  normalizeTrafficCause,
  tdSnapshotFromXml,
  type TrafficSourceSnapshot,
} from "./traffic-sources";

const RETRIEVED_AT = "2026-07-16T02:00:00.000Z";
const NON_STALE_XML_TIME = "2099-07-16T19:21:00";

describe("Transport traffic cause verification", () => {
  it("supports a busy-traffic claim when the claimed cause matches TD evidence", () => {
    const result = evaluateTrafficClaimWithSources(
      claim(
        "The busy traffic on Tseung Kwan O Road near the Kwun Tong Disciplined Services Quarters is caused by a traffic accident.",
      ),
      tseungKwanORoadSnapshot("Traffic Accident"),
    );

    expect(result.verdict).toBe("supported");
    expect(result.evidence).toHaveLength(1);
    expect(result.explanation.toLowerCase()).toContain("traffic accident");
  });

  it("refutes a busy-traffic claim when the claimed cause conflicts with TD evidence", () => {
    const result = evaluateTrafficClaimWithSources(
      claim(
        "The busy traffic on Tseung Kwan O Road near the Kwun Tong Disciplined Services Quarters is caused by road works.",
      ),
      tseungKwanORoadSnapshot("Traffic Accident"),
    );

    expect(result.verdict).toBe("refuted");
    expect(result.evidence).toHaveLength(1);
    expect(result.explanation).toContain("road works");
    expect(result.explanation).toContain("traffic accident");
  });

  it("does not call the adjudicator for an explicit deterministic traffic-cause contradiction", async () => {
    const trafficClaim = evaluateTrafficClaimWithSources(
      claim(
        "The busy traffic on Tseung Kwan O Road near the Kwun Tong Disciplined Services Quarters is caused by road works.",
      ),
      tseungKwanORoadSnapshot("Traffic Accident"),
    );
    let calls = 0;

    const result = await adjudicateEvidenceRetrievalResult(
      {
        claims: [trafficClaim],
        freshness: [],
        coverage: "high",
        counts: {
          official_sources_queried: 1,
          feed_items_fetched: 1,
          relevant_evidence_attached: 1,
        },
      },
      {
        adjudicateFn: async () => {
          calls += 1;
          return {};
        },
      },
    );

    expect(result.claims[0]?.verdict).toBe("refuted");
    expect(calls).toBe(0);
  });

  it("returns insufficient evidence when the claim has a cause but matched TD evidence has no reliable cause", () => {
    const result = evaluateTrafficClaimWithSources(
      claim("The busy traffic on Tseung Kwan O Road is caused by road works."),
      tseungKwanORoadSnapshot(""),
    );

    expect(result.verdict).toBe("insufficient_evidence");
    expect(result.explanation).toContain("does not state a reliable cause");
  });

  it("preserves existing supported behavior when the busy-traffic claim has no cause", () => {
    const result = evaluateTrafficClaimWithSources(
      claim(
        "Traffic is currently busy on Tseung Kwan O Road near the Kwun Tong Disciplined Services Quarters.",
      ),
      tseungKwanORoadSnapshot("Traffic Accident"),
    );

    expect(result.verdict).toBe("supported");
  });

  it("normalizes traffic cause aliases deterministically", () => {
    expect(normalizeTrafficCause("accident")).toBe("traffic_accident");
    expect(normalizeTrafficCause("roadworks")).toBe("road_works");
    expect(normalizeTrafficCause("broken-down vehicle")).toBe("vehicle_breakdown");
  });

  it("does not borrow a cause from an unrelated unmatched TD record", () => {
    const result = evaluateTrafficClaimWithSources(
      claim("The busy traffic on Tseung Kwan O Road is caused by road works."),
      multiRecordSnapshot(),
    );

    expect(result.verdict).toBe("insufficient_evidence");
    expect(result.evidence[0]?.traffic_metadata?.road_name).toBe("Tseung Kwan O Road");
    expect(result.evidence[0]?.traffic_metadata?.cause).toBeUndefined();
  });
});

function tseungKwanORoadSnapshot(cause: string): TrafficSourceSnapshot {
  const causeSentence = cause ? `Due to ${cause.toLowerCase()}, ` : "";
  const detail = cause ? `<INCIDENT_DETAIL_EN>${cause}</INCIDENT_DETAIL_EN>` : "<INCIDENT_DETAIL_EN/>";
  return tdSnapshotFromXml(
    trafficXml(`
      <message>
        <INCIDENT_NUMBER>IN-26-07001</INCIDENT_NUMBER>
        <INCIDENT_HEADING_EN>Busy Traffic</INCIDENT_HEADING_EN>
        ${detail}
        <LOCATION_EN>Tseung Kwan O Road</LOCATION_EN>
        <DISTRICT_EN>Kwun Tong</DISTRICT_EN>
        <DIRECTION_EN>Kwun Tong</DIRECTION_EN>
        <ANNOUNCEMENT_DATE>${NON_STALE_XML_TIME}</ANNOUNCEMENT_DATE>
        <INCIDENT_STATUS_EN>NEW</INCIDENT_STATUS_EN>
        <NEAR_LANDMARK_EN>Kwun Tong Disciplined Services Quarters</NEAR_LANDMARK_EN>
        <BETWEEN_LANDMARK_EN/>
        <ID>17001</ID>
        <CONTENT_EN>${causeSentence}part of the lanes of Tseung Kwan O Road (Kwun Tong bound) near Kwun Tong Disciplined Services Quarters is closed to all traffic. Only remaining lanes are available to motorists. Traffic is busy now.</CONTENT_EN>
        <LATITUDE/>
        <LONGITUDE/>
      </message>
    `),
    RETRIEVED_AT,
  );
}

function multiRecordSnapshot(): TrafficSourceSnapshot {
  return tdSnapshotFromXml(
    trafficXml(`
      <message>
        <INCIDENT_NUMBER>IN-26-07001</INCIDENT_NUMBER>
        <INCIDENT_HEADING_EN>Busy Traffic</INCIDENT_HEADING_EN>
        <INCIDENT_DETAIL_EN/>
        <LOCATION_EN>Tseung Kwan O Road</LOCATION_EN>
        <DISTRICT_EN>Kwun Tong</DISTRICT_EN>
        <DIRECTION_EN>Kwun Tong</DIRECTION_EN>
        <ANNOUNCEMENT_DATE>${NON_STALE_XML_TIME}</ANNOUNCEMENT_DATE>
        <INCIDENT_STATUS_EN>NEW</INCIDENT_STATUS_EN>
        <NEAR_LANDMARK_EN>Kwun Tong Disciplined Services Quarters</NEAR_LANDMARK_EN>
        <BETWEEN_LANDMARK_EN/>
        <ID>17001</ID>
        <CONTENT_EN>Part of the lanes of Tseung Kwan O Road (Kwun Tong bound) near Kwun Tong Disciplined Services Quarters is closed to all traffic. Traffic is busy now.</CONTENT_EN>
        <LATITUDE/>
        <LONGITUDE/>
      </message>
      <message>
        <INCIDENT_NUMBER>IN-26-07002</INCIDENT_NUMBER>
        <INCIDENT_HEADING_EN>Road Incident</INCIDENT_HEADING_EN>
        <INCIDENT_DETAIL_EN>Road Works</INCIDENT_DETAIL_EN>
        <LOCATION_EN>Other Road</LOCATION_EN>
        <DISTRICT_EN>Kwun Tong</DISTRICT_EN>
        <DIRECTION_EN/>
        <ANNOUNCEMENT_DATE>${NON_STALE_XML_TIME}</ANNOUNCEMENT_DATE>
        <INCIDENT_STATUS_EN>NEW</INCIDENT_STATUS_EN>
        <NEAR_LANDMARK_EN>Other Landmark</NEAR_LANDMARK_EN>
        <BETWEEN_LANDMARK_EN/>
        <ID>17002</ID>
        <CONTENT_EN>Due to road works, traffic on Other Road is busy now.</CONTENT_EN>
        <LATITUDE/>
        <LONGITUDE/>
      </message>
    `),
    RETRIEVED_AT,
  );
}

function trafficXml(messages: string): string {
  return `<list xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${messages}</list>`;
}

function claim(text: string): PhaseOneClaim {
  return {
    id: "claim",
    text,
    verdict: "insufficient_evidence",
    confidence: 0.7,
    explanation: "Mock claim.",
    recommendation: "Mock recommendation.",
    evidence: [],
  };
}

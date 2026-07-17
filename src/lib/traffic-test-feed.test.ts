import { describe, expect, it } from "vitest";
import type { PhaseOneEvidence } from "./report-contract";
import {
  buildTrafficTestFeedResponse,
  generateTrafficTestClaims,
  type TrafficTestRecord,
} from "./traffic-test-feed";
import type { TrafficSourceSnapshot } from "./traffic-sources";

describe("traffic test feed helpers", () => {
  it("returns all parsed records separately from retrieved count", () => {
    const response = buildTrafficTestFeedResponse(snapshot([
      trafficEvidence("busy", {
        event_type: "traffic_congestion",
        road_name: "Nathan Road",
        current_status: "unknown",
      }),
      trafficEvidence("reopened", {
        event_type: "road_reopened",
        road_name: "Sha Tin Rural Committee Road",
        nearby_landmark: "Lek Yuen Estate",
        scope: "part_of_lanes",
        current_status: "reopened",
      }),
    ], 3));

    expect(response.recordsRetrieved).toBe(3);
    expect(response.parsedRecordsAvailable).toBe(2);
    expect(response.records).toHaveLength(2);
  });

  it("omits missing optional fields safely", () => {
    const response = buildTrafficTestFeedResponse(snapshot([
      trafficEvidence("minimal", {
        event_type: "traffic_congestion",
        road_name: "Nathan Road",
      }),
    ]));

    expect("nearbyLandmark" in response.records[0]).toBe(false);
    expect("direction" in response.records[0]).toBe(false);
    expect(JSON.stringify(response)).not.toContain("undefined");
  });

  it("generates a supported busy-road claim", () => {
    const claims = generateTrafficTestClaims({
      id: "busy",
      title: "Busy Traffic on Nathan Road",
      eventType: "traffic_congestion",
      roadName: "Nathan Road",
      nearbyLandmark: "Jordan MTR Station",
      direction: "Mong Kok Bound",
    });

    expect(claims.supported).toBe(
      "Traffic is currently busy on Nathan Road near Jordan MTR Station in the Mong Kok Bound direction.",
    );
  });

  it("generates a supported reopened-road claim", () => {
    const claims = generateTrafficTestClaims({
      id: "reopened",
      title: "Lane Reopening",
      eventType: "road_reopened",
      currentStatus: "reopened",
      roadName: "Sha Tin Rural Committee Road",
      nearbyLandmark: "Lek Yuen Estate",
      scope: "part_of_lanes",
    });

    expect(claims.supported).toBe(
      "Part of the lanes on Sha Tin Rural Committee Road near Lek Yuen Estate have reopened to traffic.",
    );
  });

  it("does not generate a reopened supported claim for a closed record", () => {
    const claims = generateTrafficTestClaims({
      id: "closed",
      title: "Lane Closure",
      eventType: "lane_closure",
      currentStatus: "closed",
      roadName: "Tseung Kwan O Road",
      nearbyLandmark: "Kwun Tong Disciplined Services Quarters",
      scope: "part_of_lanes",
    });

    expect(claims.supported).toBe(
      "Part of the lanes on Tseung Kwan O Road near Kwun Tong Disciplined Services Quarters are currently closed.",
    );
    expect(claims.supported).not.toContain("reopened");
  });

  it("does not generate a reopened supported claim for a busy record", () => {
    const claims = generateTrafficTestClaims({
      id: "busy-not-reopened",
      title: "Busy Traffic",
      eventType: "traffic_congestion",
      roadName: "Tseung Kwan O Road",
      nearbyLandmark: "Kwun Tong Disciplined Services Quarters",
    });

    expect(claims.supported).toContain("Traffic is currently busy");
    expect(claims.supported).not.toContain("reopened");
  });

  it("does not generate a reopened supported claim when reopened status is missing", () => {
    const claims = generateTrafficTestClaims({
      id: "missing-status",
      title: "Generic Road Event",
      eventType: "road_reopened",
      roadName: "Tseung Kwan O Road",
      nearbyLandmark: "Kwun Tong Disciplined Services Quarters",
      scope: "part_of_lanes",
    });

    expect(claims.supported).toBeUndefined();
  });

  it("uses latest-available wording for stale reopened records", () => {
    const claims = generateTrafficTestClaims({
      id: "stale-reopened",
      title: "Lane Reopening",
      freshness: "stale",
      eventType: "road_reopened",
      currentStatus: "reopened",
      roadName: "Tseung Kwan O Road",
      scope: "part_of_lanes",
    });

    expect(claims.supported).toBe(
      "Part of the lanes on Tseung Kwan O Road had reopened to traffic.",
    );
    expect(claims.supported).not.toContain("currently");
  });

  it("generates a traffic-accident cause contradiction", () => {
    const claims = generateTrafficTestClaims({
      id: "cause",
      title: "Traffic Restriction",
      eventType: "lane_closure",
      roadName: "Sha Tin Rural Committee Road",
      nearbyLandmark: "Lek Yuen Estate",
      cause: "Traffic Accident",
    });

    expect(claims.refuted).toBe(
      "The traffic restriction on Sha Tin Rural Committee Road near Lek Yuen Estate was caused by road works.",
    );
  });

  it("generates a scope contradiction for partial-lane active closure", () => {
    const claims = generateTrafficTestClaims({
      id: "partial",
      title: "Lane Closure",
      eventType: "lane_closure",
      roadName: "Sha Tin Rural Committee Road",
      scope: "part_of_lanes",
    });

    expect(claims.refuted).toBe("All lanes of Sha Tin Rural Committee Road are closed.");
  });

  it("generates a supported public-transport suspension claim", () => {
    const claims = generateTrafficTestClaims({
      id: "tram",
      title: "Tram Service Suspended",
      eventType: "public_transport_disruption",
      transportMode: "tram",
      routeOrLine: "Tram",
      serviceStatus: "suspended",
    });

    expect(claims.supported).toBe("Tram service is currently suspended.");
    expect(claims.refuted).toBe("Tram service is operating normally.");
  });

  it("does not return raw XML or unsafe internal data", () => {
    const response = buildTrafficTestFeedResponse(snapshot([
      trafficEvidence("safe", {
        event_type: "traffic_congestion",
        road_name: "Nathan Road",
      }),
    ]));

    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("<message");
    expect(serialized).not.toContain("raw");
    expect(serialized).not.toContain("candidate");
    expect(serialized).not.toContain("stack");
    expect(serialized).not.toContain("GEMINI");
  });
});

function snapshot(evidence: PhaseOneEvidence[], itemsFetched = evidence.length): TrafficSourceSnapshot {
  return {
    evidence,
    freshness: [
      {
        source_key: "td",
        source_name: "Transport Department Special Traffic News XML",
        freshness: "fresh",
        retrieved_at: "2026-07-17T09:00:00.000Z",
        updated_at: "2026-07-17T08:50:00.000Z",
        message: "Fetched Transport Department Special Traffic News v2 XML.",
      },
    ],
    itemsFetched,
    sourceKeys: ["td"],
    endpointKeys: ["td:special_news_xml"],
  };
}

function trafficEvidence(
  id: string,
  metadata: NonNullable<PhaseOneEvidence["traffic_metadata"]>,
): PhaseOneEvidence {
  return {
    id,
    source_key: "td",
    source_name: "Transport Department",
    source_authority: "official",
    source_type: "government_webpage",
    category: metadata.event_type,
    title: `TD record ${id}`,
    summary: "Safe display summary",
    url: "https://www.td.gov.hk/en/special_news/trafficnews.xml",
    published_at: null,
    updated_at: "2026-07-17T08:50:00.000Z",
    retrieved_at: "2026-07-17T09:00:00.000Z",
    freshness: "fresh",
    traffic_metadata: metadata,
  };
}

import { describe, expect, it } from "vitest";
import type { PhaseOneClaim } from "./report-contract";
import {
  evaluateTrafficClaimWithSources,
  normalizeTrafficCause,
  tdSnapshotFromXml,
  type TrafficSourceSnapshot,
} from "./traffic-sources";

const RETRIEVED_AT = "2026-07-16T02:00:00.000Z";
const NON_STALE_XML_TIME = "2099-07-16T19:21:00";

describe("TD traffic classification precedence", () => {
  it("keeps an MTR-station-bound road direction as a road traffic reopening event", () => {
    const item = shaTinMtrStationBoundRoadSnapshot().evidence[0];

    expect(item?.category).toBe("road_reopened");
    expect(item?.traffic_metadata?.transport_mode).toBeUndefined();
    expect(item?.traffic_metadata?.road_name).toBe("Sha Tin Rural Committee Road");
    expect(item?.traffic_metadata?.nearby_landmark).toBe("Lek Yuen Estate");
    expect(item?.traffic_metadata?.district).toBe("Sha Tin");
    expect(item?.traffic_metadata?.direction).toBe("Sha Tin Mtr Station bound");
    expect(item?.traffic_metadata?.event_type).toBe("road_reopened");
    expect(item?.traffic_metadata?.current_status).toBe("reopened");
  });

  it("keeps a road notice near an MTR station as road traffic", () => {
    const item = nathanRoadNearMtrStationSnapshot().evidence[0];

    expect(item?.category).toBe("lane_closure");
    expect(item?.traffic_metadata?.transport_mode).toBeUndefined();
    expect(item?.traffic_metadata?.road_name).toBe("Nathan Road");
    expect(item?.traffic_metadata?.nearby_landmark).toBe("Jordan Mtr Station");
  });

  it("still classifies a genuine MTR service incident as public transport disruption", () => {
    const item = eastRailServiceSuspendedSnapshot().evidence[0];

    expect(item?.category).toBe("public_transport_disruption");
    expect(item?.traffic_metadata?.transport_mode).toBe("MTR");
    expect(item?.traffic_metadata?.route_or_line).toBe("East Rail Line");
    expect(item?.traffic_metadata?.service_status).toBe("suspended");
  });

  it("preserves reopening precedence over historical closed wording", () => {
    const item = shaTinMtrStationBoundRoadSnapshot().evidence[0];

    expect(item?.traffic_metadata?.current_status).toBe("reopened");
    expect(item?.excerpt?.toLowerCase()).toContain("reopened to all traffic");
  });

  it("normalizes part-of-lanes scope as partial lane scope, not complete road", () => {
    const item = shaTinMtrStationBoundRoadSnapshot().evidence[0];

    expect(item?.traffic_metadata?.scope).toBe("part_of_lanes");
    expect(item?.traffic_metadata?.scope).not.toBe("complete_road");
  });

  it("preserves traffic accident cause in metadata and canonical cause normalization", () => {
    const item = shaTinMtrStationBoundRoadSnapshot().evidence[0];

    expect(item?.traffic_metadata?.cause).toBe("Traffic Accident");
    expect(normalizeTrafficCause(item?.traffic_metadata?.cause)).toBe("traffic_accident");
  });

  it("supports a reopening claim for the corrected Sha Tin road record", () => {
    const result = evaluateTrafficClaimWithSources(
      claim(
        "The affected lanes of Sha Tin Rural Committee Road near Lek Yuen Estate have been reopened to traffic.",
      ),
      shaTinMtrStationBoundRoadSnapshot(),
    );

    expect(result.verdict).toBe("supported");
    expect(result.evidence).toHaveLength(1);
  });

  it("refutes a still-closed claim for the corrected Sha Tin road record", () => {
    const result = evaluateTrafficClaimWithSources(
      claim("The affected lanes of Sha Tin Rural Committee Road near Lek Yuen Estate remain closed."),
      shaTinMtrStationBoundRoadSnapshot(),
    );

    expect(result.verdict).toBe("refuted");
    expect(result.evidence).toHaveLength(1);
  });
});

function shaTinMtrStationBoundRoadSnapshot(): TrafficSourceSnapshot {
  return tdSnapshotFromXml(
    trafficXml(`
      <message>
        <INCIDENT_NUMBER>IN-26-08001</INCIDENT_NUMBER>
        <INCIDENT_HEADING_EN>Road Incident</INCIDENT_HEADING_EN>
        <INCIDENT_DETAIL_EN>Traffic Accident</INCIDENT_DETAIL_EN>
        <LOCATION_EN>Sha Tin Rural Committee Road</LOCATION_EN>
        <DISTRICT_EN>Sha Tin</DISTRICT_EN>
        <DIRECTION_EN>Sha Tin MTR Station</DIRECTION_EN>
        <ANNOUNCEMENT_DATE>${NON_STALE_XML_TIME}</ANNOUNCEMENT_DATE>
        <INCIDENT_STATUS_EN>UPDATED</INCIDENT_STATUS_EN>
        <NEAR_LANDMARK_EN>Lek Yuen Estate</NEAR_LANDMARK_EN>
        <BETWEEN_LANDMARK_EN/>
        <ID>18001</ID>
        <CONTENT_EN>Part of the lanes of Sha Tin Rural Committee Road (Sha Tin MTR Station bound) near Lek Yuen Estate which was closed due to traffic accident is re-opened to all traffic.</CONTENT_EN>
        <LATITUDE/>
        <LONGITUDE/>
      </message>
    `),
    RETRIEVED_AT,
  );
}

function nathanRoadNearMtrStationSnapshot(): TrafficSourceSnapshot {
  return tdSnapshotFromXml(
    trafficXml(`
      <message>
        <INCIDENT_NUMBER>IN-26-08002</INCIDENT_NUMBER>
        <INCIDENT_HEADING_EN>Road Incident</INCIDENT_HEADING_EN>
        <INCIDENT_DETAIL_EN/>
        <LOCATION_EN>Nathan Road</LOCATION_EN>
        <DISTRICT_EN>Yau Tsim Mong</DISTRICT_EN>
        <DIRECTION_EN/>
        <ANNOUNCEMENT_DATE>${NON_STALE_XML_TIME}</ANNOUNCEMENT_DATE>
        <INCIDENT_STATUS_EN>NEW</INCIDENT_STATUS_EN>
        <NEAR_LANDMARK_EN>Jordan MTR Station</NEAR_LANDMARK_EN>
        <BETWEEN_LANDMARK_EN/>
        <ID>18002</ID>
        <CONTENT_EN>Part of the lanes of Nathan Road near Jordan MTR Station is closed to all traffic.</CONTENT_EN>
        <LATITUDE/>
        <LONGITUDE/>
      </message>
    `),
    RETRIEVED_AT,
  );
}

function eastRailServiceSuspendedSnapshot(): TrafficSourceSnapshot {
  return tdSnapshotFromXml(
    trafficXml(`
      <message>
        <INCIDENT_NUMBER>IN-26-08003</INCIDENT_NUMBER>
        <INCIDENT_HEADING_EN>Public Transport Service Disruption</INCIDENT_HEADING_EN>
        <INCIDENT_DETAIL_EN/>
        <LOCATION_EN>East Rail Line</LOCATION_EN>
        <DISTRICT_EN>Sha Tin</DISTRICT_EN>
        <DIRECTION_EN/>
        <ANNOUNCEMENT_DATE>${NON_STALE_XML_TIME}</ANNOUNCEMENT_DATE>
        <INCIDENT_STATUS_EN>NEW</INCIDENT_STATUS_EN>
        <NEAR_LANDMARK_EN>Sha Tin Station</NEAR_LANDMARK_EN>
        <BETWEEN_LANDMARK_EN/>
        <ID>18003</ID>
        <CONTENT_EN>Train service on the East Rail Line is suspended between Sha Tin and Tai Wai.</CONTENT_EN>
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

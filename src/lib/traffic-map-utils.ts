import type {
  PhaseOneClaim,
  PhaseOneEvidence,
  ReportVerdict,
  TrafficEvidenceMetadata,
} from "./report-contract";
import { trafficMapLocations, type TrafficMapLocation } from "./traffic-map-locations";

export type TrafficMapEvidenceItem = {
  id: string;
  claimId: string;
  claimText: string;
  verdict: ReportVerdict;
  evidence: PhaseOneEvidence;
  metadata: TrafficEvidenceMetadata;
  location: TrafficMapLocation | null;
};

export function getTrafficEvidenceMapItems(claims: PhaseOneClaim[]): TrafficMapEvidenceItem[] {
  return claims.flatMap((claim) =>
    claim.evidence
      .filter((item) => item.source_key === "td")
      .map((item) => {
        const metadata = item.traffic_metadata ?? {};
        return {
          id: `${claim.id}:${item.id}`,
          claimId: claim.id,
          claimText: claim.text,
          verdict: claim.verdict,
          evidence: item,
          metadata,
          location: resolveTrafficMapLocation(metadata),
        };
      }),
  );
}

export function hasMatchedTransportEvidence(claims: PhaseOneClaim[]): boolean {
  return claims.some((claim) => claim.evidence.some((item) => item.source_key === "td"));
}

export function getTrafficVerdictLabel(verdict: ReportVerdict): string {
  if (verdict === "supported") return "Supported";
  if (verdict === "refuted") return "Refuted";
  return "Need More Evidence";
}

export function getTrafficCoordinateSourceText(item: TrafficMapEvidenceItem): string {
  if (!item.location) return "No official coordinates available";
  return item.location.approximate ? "Approximate demo location" : "Official TD coordinates";
}

function resolveTrafficMapLocation(metadata: TrafficEvidenceMetadata): TrafficMapLocation | null {
  if (hasValidOfficialCoordinates(metadata)) {
    return {
      key: `official-td-${metadata.latitude}-${metadata.longitude}`,
      roadName: metadata.road_name ?? "Transport Department location",
      nearbyLandmark: metadata.nearby_landmark ?? "Not stated",
      district: metadata.district ?? "Not stated",
      coordinates: [metadata.latitude, metadata.longitude],
      label: metadata.road_name ?? "Official TD location",
      approximate: false,
      sourceName: "Official TD coordinates",
      sourceUrl: "https://www.td.gov.hk/en/special_news/trafficnews.xml",
    };
  }

  if (!metadata.map_location_key) return null;
  const location = trafficMapLocations[metadata.map_location_key];
  if (!location) return null;

  const roadMatches = sameText(metadata.road_name, location.roadName);
  const landmarkMatches = sameText(metadata.nearby_landmark, location.nearbyLandmark);
  return roadMatches && landmarkMatches ? location : null;
}

function hasValidOfficialCoordinates(
  metadata: TrafficEvidenceMetadata,
): metadata is TrafficEvidenceMetadata & { latitude: number; longitude: number } {
  return (
    typeof metadata.latitude === "number" &&
    Number.isFinite(metadata.latitude) &&
    metadata.latitude >= -90 &&
    metadata.latitude <= 90 &&
    typeof metadata.longitude === "number" &&
    Number.isFinite(metadata.longitude) &&
    metadata.longitude >= -180 &&
    metadata.longitude <= 180 &&
    !(metadata.latitude === 0 && metadata.longitude === 0)
  );
}

function sameText(left: string | undefined, right: string): boolean {
  return normalize(left) === normalize(right);
}

function normalize(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
